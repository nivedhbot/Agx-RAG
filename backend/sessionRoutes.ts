// Session CRUD routes for the multi-session Reasoning Lab.
// All routes require auth and are scoped to the authenticated user — a user can
// only see and mutate their own sessions. Mounted at /api/sessions.
//
// Tables (see backend/migrations/001_auth_sessions.sql): chat_sessions,
// session_messages, session_documents.

import { Router, type Response } from 'express';
import { getPool } from './db.js';
import { requireAuth, type AuthedRequest } from './auth.js';
import { graphBuilder } from './graphBuilder.js';
import { vectorStore } from './vectorStore.js';

export const sessionRouter = Router();

// Every route is gated.
sessionRouter.use(requireAuth);

function db(res: Response) {
  const pool = getPool();
  if (!pool) {
    res.status(503).json({ error: 'Session database unavailable' });
    return null;
  }
  return pool;
}

// First 5 words of a query, used as an auto-generated session title.
function titleFromQuery(query: string): string {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  const title = words.join(' ');
  return title.length > 0 ? title : 'New Session';
}

// POST /api/sessions — create a new (empty) session, return it.
sessionRouter.post('/', async (req: AuthedRequest, res: Response) => {
  const pool = db(res);
  if (!pool) return;
  try {
    const result = await pool.query(
      `INSERT INTO chat_sessions (user_id) VALUES ($1)
       RETURNING id, title, created_at, last_active`,
      [req.user!.id],
    );
    res.status(201).json({ session: { ...result.rows[0], document_count: 0, message_count: 0 } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions — list the user's sessions, newest activity first, each
// with its document and message counts.
sessionRouter.get('/', async (req: AuthedRequest, res: Response) => {
  const pool = db(res);
  if (!pool) return;
  try {
    const result = await pool.query(
      `SELECT s.id, s.title, s.created_at, s.last_active,
              COUNT(DISTINCT d.id)::int AS document_count,
              COUNT(DISTINCT m.id)::int AS message_count
       FROM chat_sessions s
       LEFT JOIN session_documents d ON d.session_id = s.id
       LEFT JOIN session_messages  m ON m.session_id = s.id
       WHERE s.user_id = $1
       GROUP BY s.id
       ORDER BY s.last_active DESC`,
      [req.user!.id],
    );
    res.json({ sessions: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { titleFromQuery };

// Verify a session belongs to the requesting user. Returns the row or null
// (and sends 404) so handlers can't leak/modify another user's session.
async function ownedSession(pool: any, sessionId: string, userId: string, res: Response) {
  const r = await pool.query(
    'SELECT id, title, created_at, last_active FROM chat_sessions WHERE id = $1 AND user_id = $2',
    [sessionId, userId],
  );
  if (r.rowCount === 0) {
    res.status(404).json({ error: 'Session not found' });
    return null;
  }
  return r.rows[0];
}

// GET /api/sessions/:id — full session: metadata, messages (chronological),
// and documents.
sessionRouter.get('/:id', async (req: AuthedRequest, res: Response) => {
  const pool = db(res);
  if (!pool) return;
  try {
    const session = await ownedSession(pool, req.params.id, req.user!.id, res);
    if (!session) return;

    const [messages, documents] = await Promise.all([
      pool.query(
        `SELECT id, role, content, metadata, created_at
         FROM session_messages WHERE session_id = $1 ORDER BY created_at ASC`,
        [req.params.id],
      ),
      pool.query(
        `SELECT id, filename, chunk_count, uploaded_at
         FROM session_documents WHERE session_id = $1 ORDER BY uploaded_at ASC`,
        [req.params.id],
      ),
    ]);

    res.json({ session, messages: messages.rows, documents: documents.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id — cascade removes messages + documents via FK.
sessionRouter.delete('/:id', async (req: AuthedRequest, res: Response) => {
  const pool = db(res);
  if (!pool) return;
  try {
    const r = await pool.query(
      'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user!.id],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Session not found' });
    // Drop the session's entity graph file too (chunks stay but are filtered
    // out of every query by session_id, so they never surface elsewhere).
    await graphBuilder.clearSession(req.params.id);
    res.json({ deleted: r.rows[0].id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/messages — persist one message. When it's the first
// user message in a still-titled-'New Session' session, auto-title from the
// first 5 words. Always bumps last_active. Returns the (possibly new) title.
sessionRouter.post('/:id/messages', async (req: AuthedRequest, res: Response) => {
  const pool = db(res);
  if (!pool) return;
  const { role, content, metadata } = req.body ?? {};
  if (role !== 'user' && role !== 'assistant') {
    return res.status(400).json({ error: "role must be 'user' or 'assistant'" });
  }
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'content is required' });
  }
  try {
    const session = await ownedSession(pool, req.params.id, req.user!.id, res);
    if (!session) return;

    await pool.query(
      `INSERT INTO session_messages (session_id, role, content, metadata)
       VALUES ($1, $2, $3, $4)`,
      [req.params.id, role, content, metadata ? JSON.stringify(metadata) : null],
    );

    let title = session.title;
    const shouldTitle = role === 'user' && (!title || title === 'New Session');
    if (shouldTitle) {
      title = titleFromQuery(content);
      await pool.query(
        'UPDATE chat_sessions SET title = $1, last_active = now() WHERE id = $2',
        [title, req.params.id],
      );
    } else {
      await pool.query('UPDATE chat_sessions SET last_active = now() WHERE id = $1', [req.params.id]);
    }

    res.status(201).json({ title });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id/documents/:docId — remove ONE document from a
// session: its chunks leave the vector index and its single-document entities
// leave the knowledge graph. Chunks shared by no other doc and entities that
// only appeared here are pruned; entities spanning multiple documents stay.
// The on-disk vectorstore/sessions/{id}/ folder is intentionally left intact
// for audit — only the index/graph state is rebuilt.
sessionRouter.delete('/:id/documents/:docId', async (req: AuthedRequest, res: Response) => {
  const pool = db(res);
  if (!pool) return;
  try {
    const session = await ownedSession(pool, req.params.id, req.user!.id, res);
    if (!session) return;

    // Resolve the document (and its filename, which is how chunks are tagged).
    const docRes = await pool.query(
      'SELECT id, filename FROM session_documents WHERE id = $1 AND session_id = $2',
      [req.params.docId, req.params.id],
    );
    if (docRes.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const filename = docRes.rows[0].filename as string;

    // 1. Drop this document's chunks from the vector store (index rebuild).
    const removedChunkIds = await vectorStore.deleteDocument(req.params.id, filename);

    // 2. Prune the session graph by those chunk ids — orphaned (single-doc)
    //    entities go, multi-doc entities stay.
    const graphResult = await graphBuilder.removeChunks(removedChunkIds, req.params.id);

    // 3. Remove the document record.
    await pool.query('DELETE FROM session_documents WHERE id = $1', [req.params.docId]);

    // 4. Remaining document count for the session.
    const countRes = await pool.query(
      'SELECT COUNT(*)::int AS n FROM session_documents WHERE session_id = $1',
      [req.params.id],
    );
    await pool.query('UPDATE chat_sessions SET last_active = now() WHERE id = $1', [req.params.id]);

    res.json({
      deleted: req.params.docId,
      filename,
      chunks_removed: removedChunkIds.length,
      document_count: countRes.rows[0].n,
      nodes_removed: graphResult.nodes_removed,
      edges_removed: graphResult.edges_removed,
      node_count: graphResult.node_count,
      edge_count: graphResult.edge_count,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
