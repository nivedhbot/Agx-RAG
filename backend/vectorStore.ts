import { randomUUID } from 'crypto';
import { pipeline } from '@huggingface/transformers';
import { pickBackend, type VectorBackend, type StoredChunk } from './vectorBackends.js';

interface Chunk {
  text: string;
  source: string;
  page: number;
  embedding?: number[];
  id?: string;
  sessionId?: string | null;
}

/**
 * Vector store with pluggable persistence (Postgres + pgvector, or JSON file).
 * Uses @huggingface/transformers (bge-small-en-v1.5, 384-dim) for embeddings.
 * Keeps an in-memory mirror of all chunks so the synchronous callers
 * (server.ts, metrics) don't have to become async.
 */
export class VectorStore {
  private chunks: Chunk[] = [];
  private extractor: any = null;
  private backend: VectorBackend | null = null;

  private async getExtractor() {
    if (!this.extractor) {
      console.log('Initializing Embedding Model (bge-small-en-v1.5)...');
      this.extractor = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
    }
    return this.extractor;
  }

  // Load and cache the embedding model ahead of the first query so queries
  // don't pay the cold-start cost. Safe to call multiple times — the instance
  // is reused once initialised.
  async warmup() {
    await this.getExtractor();
  }

  private async getBackend(): Promise<VectorBackend> {
    if (!this.backend) this.backend = await pickBackend();
    return this.backend;
  }

  backendName(): 'postgres' | 'json' | 'unknown' {
    return this.backend?.name ?? 'unknown';
  }

  async addChunks(newChunks: Chunk[], sessionId?: string) {
    const extractor = await this.getExtractor();
    const backend = await this.getBackend();

    console.log(`Generating embeddings for ${newChunks.length} chunks${sessionId ? ` (session ${sessionId})` : ''}...`);

    const texts = newChunks.map(c => c.text);
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    const batchSize = output.dims[0];
    const embeddingSize = output.dims[1];

    const stored: StoredChunk[] = [];
    for (let i = 0; i < batchSize; i++) {
      const startIndex = i * embeddingSize;
      const embedding = Array.from(output.data.slice(startIndex, startIndex + embeddingSize)) as number[];
      newChunks[i].embedding = embedding;
      // Collision-free chunk id. The old Math.random().toString(36) scheme
      // produced only ~4-6 weak characters, and any collision was silently
      // swallowed by the backend's ON CONFLICT (id) DO NOTHING, dropping the
      // uploaded chunk. UUIDv4 removes that data-loss path.
      newChunks[i].id = randomUUID();
      newChunks[i].sessionId = sessionId ?? null;
      this.chunks.push(newChunks[i]);
      stored.push({
        id: newChunks[i].id!,
        text: newChunks[i].text,
        source: newChunks[i].source,
        page: newChunks[i].page,
        embedding,
        sessionId: sessionId ?? null,
      });
    }

    await backend.add(stored);
    return newChunks;
  }

  async search(query: string, topK: number = 20, sessionId?: string) {
    const extractor = await this.getExtractor();
    const backend = await this.getBackend();
    const output = await extractor(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(output.data) as number[];

    // Delegate to backend. Postgres uses pgvector's <#> operator; JSON does
    // an in-memory linear scan. Both restrict to the session when provided.
    const results = await backend.searchTopK(queryEmbedding, topK, sessionId);
    return results.map(r => ({
      id: r.id,
      text: r.text,
      source: r.source,
      page: r.page,
      embedding: r.embedding,
      score: r.score,
    }));
  }

  async load() {
    const backend = await this.getBackend();
    const all = await backend.loadAll();
    this.chunks = all.map(c => ({
      id: c.id,
      text: c.text,
      source: c.source,
      page: c.page,
      embedding: c.embedding,
      sessionId: c.sessionId ?? null,
    }));
    if (this.chunks.length > 0) {
      console.log(`Loaded ${this.chunks.length} chunks from ${backend.name} backend.`);
    }
  }

  async clear() {
    this.chunks = [];
    const backend = await this.getBackend();
    await backend.clear();
  }

  // Remove one document's chunks (a (sessionId, source) pair) from both the
  // persistent backend and the in-memory mirror. Returns the removed chunk ids
  // so the caller can prune the entity graph by the same ids.
  async deleteDocument(sessionId: string, source: string): Promise<string[]> {
    const backend = await this.getBackend();
    const removedIds = await backend.deleteBySource(sessionId, source);
    if (removedIds.length > 0) {
      const gone = new Set(removedIds);
      this.chunks = this.chunks.filter(c => !(c.id && gone.has(c.id)));
    }
    return removedIds;
  }

  // All chunks in the in-memory mirror. With a sessionId, returns only that
  // session's chunks (used by /reprocess so a session's graph is rebuilt from
  // its OWN documents, never the whole corpus). With no argument, returns every
  // chunk — used for corpus-wide telemetry only.
  getAllChunks(sessionId?: string) {
    if (sessionId === undefined) return this.chunks;
    return this.chunks.filter(c => (c.sessionId ?? null) === sessionId);
  }
}

export const vectorStore = new VectorStore();
