// Pluggable persistence + similarity-search backends for the vector store.
// The VectorStore facade picks one of these at startup based on DATABASE_URL.

import fs from 'fs-extra';
import path from 'path';
import { Pool } from 'pg';

export interface StoredChunk {
  id: string;
  text: string;
  source: string;
  page: number;
  embedding: number[];
  // Optional owning session. Null/undefined = global corpus (legacy behaviour).
  sessionId?: string | null;
}

export interface VectorBackend {
  name: 'postgres' | 'json';
  init(): Promise<void>;
  loadAll(): Promise<StoredChunk[]>;
  add(chunks: StoredChunk[]): Promise<void>;
  // When sessionId is provided, search is restricted to that session's chunks.
  searchTopK(queryEmbedding: number[], topK: number, sessionId?: string): Promise<Array<StoredChunk & { score: number }>>;
  // Remove every chunk belonging to one document (a (sessionId, source) pair).
  // Returns the ids of the chunks that were removed so callers can prune the
  // in-memory mirror and the entity graph. This is the "rebuild the index
  // without those chunks" step — for Postgres it's a scoped DELETE; for JSON
  // it rewrites the file without them.
  deleteBySource(sessionId: string, source: string): Promise<string[]>;
  clear(): Promise<void>;
}

// JSON backend — equivalent to the original vectorstore/index.json behaviour.
// Kept so the system still works with no Postgres available.
export class JsonVectorBackend implements VectorBackend {
  readonly name = 'json' as const;
  private readonly storePath = path.join(process.cwd(), 'vectorstore', 'index.json');

  async init() {
    await fs.ensureDir(path.dirname(this.storePath));
  }

  async loadAll(): Promise<StoredChunk[]> {
    if (!(await fs.pathExists(this.storePath))) return [];
    const raw = await fs.readJson(this.storePath);
    return (Array.isArray(raw) ? raw : []).filter(c => c && c.id && Array.isArray(c.embedding));
  }

  async add(chunks: StoredChunk[]) {
    const existing = await this.loadAll();
    const merged = [...existing, ...chunks];
    await fs.writeJson(this.storePath, merged);
  }

  async searchTopK(q: number[], topK: number, sessionId?: string) {
    const all = await this.loadAll();
    // With a sessionId, restrict to that session. Without one, restrict to the
    // GLOBAL corpus (session_id null) only — never spill other users'
    // session-scoped chunks into an unscoped query.
    const pool = sessionId
      ? all.filter(c => c.sessionId === sessionId)
      : all.filter(c => c.sessionId == null);
    const scored = pool.map(c => ({ ...c, score: dot(q, c.embedding) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  async clear() {
    if (await fs.pathExists(this.storePath)) await fs.remove(this.storePath);
  }

  async deleteBySource(sessionId: string, source: string): Promise<string[]> {
    const all = await this.loadAll();
    const removed = all.filter(c => c.sessionId === sessionId && c.source === source);
    if (removed.length === 0) return [];
    const kept = all.filter(c => !(c.sessionId === sessionId && c.source === source));
    await fs.writeJson(this.storePath, kept);
    return removed.map(c => c.id);
  }
}

// Postgres + pgvector backend. Stores 384-dim embeddings in a `chunks` table.
// Search uses the inner-product operator (<#>) — equivalent to cosine when
// embeddings are L2-normalised (which our bge-small extractor returns).
const EMBED_DIM = 384;

export class PostgresVectorBackend implements VectorBackend {
  readonly name = 'postgres' as const;
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      // Keep the pool small — single-node dev/demo.
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 3_000,
    });
  }

  async init() {
    await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        text TEXT NOT NULL,
        page INTEGER NOT NULL DEFAULT 1,
        embedding vector(${EMBED_DIM}) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    // Session scoping — added idempotently so existing deployments upgrade in
    // place. NULL session_id = global corpus (legacy chunks).
    await this.pool.query(`ALTER TABLE chunks ADD COLUMN IF NOT EXISTS session_id TEXT`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS chunks_source_idx ON chunks (source)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS chunks_session_idx ON chunks (session_id)`);
  }

  async loadAll(): Promise<StoredChunk[]> {
    const res = await this.pool.query<{ id: string; source: string; text: string; page: number; embedding: string; session_id: string | null }>(
      'SELECT id, source, text, page, session_id, embedding::text AS embedding FROM chunks ORDER BY created_at',
    );
    return res.rows.map(r => ({
      id: r.id,
      source: r.source,
      text: r.text,
      page: r.page,
      sessionId: r.session_id,
      embedding: parseVector(r.embedding),
    }));
  }

  async add(chunks: StoredChunk[]) {
    if (chunks.length === 0) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const c of chunks) {
        if (c.embedding.length !== EMBED_DIM) {
          throw new Error(`expected ${EMBED_DIM}-dim embedding, got ${c.embedding.length}`);
        }
        await client.query(
          'INSERT INTO chunks (id, source, text, page, embedding, session_id) VALUES ($1, $2, $3, $4, $5::vector, $6) ON CONFLICT (id) DO NOTHING',
          [c.id, c.source, c.text, c.page, formatVector(c.embedding), c.sessionId ?? null],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async searchTopK(q: number[], topK: number, sessionId?: string) {
    // pgvector's <#> is NEGATIVE inner product, so ORDER BY ASC gives best match.
    // We flip the sign back so callers see "higher is better".
    // With a sessionId, restrict to that session. Without one, restrict to the
    // GLOBAL corpus (session_id IS NULL) only — an unscoped query must never
    // return another user's session-scoped chunks.
    const where = sessionId ? 'WHERE session_id = $3' : 'WHERE session_id IS NULL';
    const params: any[] = sessionId ? [formatVector(q), topK, sessionId] : [formatVector(q), topK];
    const res = await this.pool.query<{ id: string; source: string; text: string; page: number; embedding: string; session_id: string | null; neg_ip: string }>(
      `SELECT id, source, text, page, session_id, embedding::text AS embedding,
              (embedding <#> $1::vector) AS neg_ip
       FROM chunks
       ${where}
       ORDER BY embedding <#> $1::vector ASC
       LIMIT $2`,
      params,
    );
    return res.rows.map(r => ({
      id: r.id,
      source: r.source,
      text: r.text,
      page: r.page,
      sessionId: r.session_id,
      embedding: parseVector(r.embedding),
      score: -Number(r.neg_ip),
    }));
  }

  async clear() {
    await this.pool.query('TRUNCATE TABLE chunks');
  }

  async deleteBySource(sessionId: string, source: string): Promise<string[]> {
    const res = await this.pool.query<{ id: string }>(
      'DELETE FROM chunks WHERE session_id = $1 AND source = $2 RETURNING id',
      [sessionId, source],
    );
    return res.rows.map(r => r.id);
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async end() {
    await this.pool.end();
  }
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// pgvector text format: "[v1,v2,v3]"
function formatVector(v: number[]): string {
  return `[${v.join(',')}]`;
}

function parseVector(s: string): number[] {
  if (!s) return [];
  const trimmed = s.replace(/^\[/, '').replace(/\]$/, '');
  if (trimmed.length === 0) return [];
  return trimmed.split(',').map(Number);
}

// Pick a backend at startup. If DATABASE_URL is set AND we can ping, use Postgres.
// Otherwise fall back to JSON so the system still works offline.
export async function pickBackend(): Promise<VectorBackend> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pg = new PostgresVectorBackend(url);
    try {
      await pg.init();
      const ok = await pg.ping();
      if (ok) {
        console.log('[vectorStore] using Postgres backend (DATABASE_URL set, ping ok)');
        return pg;
      }
      console.warn('[vectorStore] DATABASE_URL set but ping failed — falling back to JSON');
      await pg.end().catch(() => {});
    } catch (err) {
      console.warn('[vectorStore] Postgres init failed, falling back to JSON:', (err as Error).message);
      await pg.end().catch(() => {});
    }
  } else {
    console.log('[vectorStore] DATABASE_URL not set — using JSON backend');
  }
  const json = new JsonVectorBackend();
  await json.init();
  return json;
}
