import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { createServer as createViteServer } from 'vite';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { processPdf } from './backend/documentProcessor.js';
import { vectorStore } from './backend/vectorStore.js';
import { graphBuilder } from './backend/graphBuilder.js';
import { ragPipeline } from './backend/ragPipeline.js';
import { llmGenerator } from './backend/llmGenerator.js';
import { orchestratorAgent } from './backend/agents/orchestrator.js';
import { settings } from './backend/settings.js';
import { metrics } from './backend/metrics.js';
import { warmupNli, isNliEnabled } from './backend/agents/nli.js';
import { runMigrations } from './backend/migrations.js';
import { requireAuth } from './backend/auth.js';
import { authRouter } from './backend/authRoutes.js';
import { sessionRouter } from './backend/sessionRoutes.js';
import { getPool } from './backend/db.js';

// Ownership gate for session-scoped read endpoints (/api/documents, /api/graph).
// Requires a `session_id` query param and verifies the session belongs to the
// authenticated user. Writes the error response itself and returns the validated
// session id, or null when the caller may not proceed. Emits an audit line:
//   [auth] GET <route> session_id=<id> user_id=<uid> — ALLOWED | DENIED
async function gateSessionRead(route: string, req: any, res: any): Promise<string | null> {
  const userId: string | undefined = req.user?.id;
  const sessionId = (req.query?.session_id as string) || '';

  if (!sessionId) {
    console.log(`[auth] GET ${route} session_id=(missing) user_id=${userId} — DENIED`);
    res.status(400).json({ error: 'session_id is required' });
    return null;
  }

  const pool = getPool();
  if (!pool) {
    res.status(503).json({ error: 'Session database unavailable' });
    return null;
  }

  try {
    const owns = await pool.query(
      'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId],
    );
    if (owns.rowCount === 0) {
      console.log(`[auth] GET ${route} session_id=${sessionId} user_id=${userId} — DENIED`);
      res.status(403).json({ error: 'You do not have access to this session' });
      return null;
    }
  } catch (err: any) {
    res.status(500).json({ error: `Ownership check failed: ${err.message}` });
    return null;
  }

  console.log(`[auth] GET ${route} session_id=${sessionId} user_id=${userId} — ALLOWED`);
  return sessionId;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Load persistent data
  await settings.load();

  // Apply auth + multi-session schema migrations before anything else touches
  // the database. No-op when DATABASE_URL is unset/unreachable.
  await runMigrations();

  await vectorStore.load();
  await graphBuilder.load();

  // Warm the embedding + NLI models at startup so the first query doesn't pay
  // the cold-start initialisation cost (previously 20-100s on first query).
  // Both instances are cached at module level and reused by every query.
  const modelsStart = Date.now();
  await Promise.all([
    vectorStore.warmup(),
    warmupNli(),
  ]);
  console.log(
    `[models] embedding + NLI ready in ${Date.now() - modelsStart}ms` +
      (isNliEnabled() ? '' : ' (NLI disabled — heuristic fallback)'),
  );

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Auth routes (register/login/me/logout) — public, no token required.
  app.use('/api/auth', authRouter);

  // Session management routes — all gated by requireAuth inside the router.
  app.use('/api/sessions', sessionRouter);

  // Multer for uploads
  const upload = multer({ storage: multer.memoryStorage() });

  // --- API Routes ---

  // TASK 1: Health Check
  app.get('/api/health', (req, res) => {
    const llmHigh = process.env.OPENAI_API_KEY
      ? 'OpenAI'
      : process.env.NVIDIA_API_KEY
        ? 'NVIDIA NIM'
        : process.env.OLLAMA_ENABLED === 'true'
          ? 'Ollama'
          : 'Mock';
    const llmLow = process.env.NVIDIA_API_KEY
      ? 'NVIDIA NIM'
      : process.env.OLLAMA_ENABLED === 'true'
        ? 'Ollama'
        : process.env.OPENAI_API_KEY
          ? 'OpenAI'
          : 'Mock';
    const backend = vectorStore.backendName();
    res.json({
      status: 'ok',
      service: 'AGX-RAG CGoT-MARS',
      modules: {
        vector: backend === 'postgres' ? 'Postgres (pgvector)' : backend === 'json' ? 'JSON file' : 'Loaded',
        graph: 'Active',
        reranker: 'Hybrid-F(d)',
        agents: 'Orchestrator + 4 specialists',
        nli: process.env.LOCAL_NLI_ENABLED === 'false' ? 'Heuristic' : 'Local (deberta-v3-xsmall)',
        llmHigh,
        llmLow,
      },
      vectorBackend: backend,
    });
  });

  // TASK 1: Upload (Task 2, 3, 4 integration)
  app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Optional session scope (multipart text field). When present, the
      // document's chunks + graph are scoped to that session.
      const sessionId: string | undefined = req.body?.sessionId || undefined;
      const userId = (req as any).user?.id as string | undefined;

      // If a session was given, verify the caller owns it before ingesting.
      if (sessionId) {
        const pool = getPool();
        if (!pool) return res.status(503).json({ error: 'Session database unavailable' });
        const owns = await pool.query(
          'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
          [sessionId, userId],
        );
        if (owns.rowCount === 0) return res.status(404).json({ error: 'Session not found' });
      }

      console.log(`Processing file: ${req.file.originalname}${sessionId ? ` (session ${sessionId})` : ''}`);
      const rawChunks = await processPdf(req.file.buffer, req.file.originalname);

      const processedChunks = await vectorStore.addChunks(rawChunks, sessionId);
      const { entitiesExtracted } = await graphBuilder.updateGraph(processedChunks, sessionId);
      metrics.recordUpload(req.file.originalname, rawChunks.length);

      // Record the document against the session and report the session graph's
      // updated size for the toast.
      const graphStats = graphBuilder.stats(sessionId);
      if (sessionId) {
        const pool = getPool();
        if (pool) {
          await pool.query(
            `INSERT INTO session_documents (session_id, filename, chunk_count)
             VALUES ($1, $2, $3)`,
            [sessionId, req.file.originalname, rawChunks.length],
          );
          await pool.query('UPDATE chat_sessions SET last_active = now() WHERE id = $1', [sessionId]);
        }
      }

      res.json({
        message: 'Upload successful',
        document: {
          name: req.file.originalname,
          chunks: rawChunks.length,
          status: 'Processed',
        },
        chunkCount: rawChunks.length,
        nodeCount: graphStats.node_count,
        edgeCount: graphStats.edge_count,
        entitiesExtracted,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      metrics.log('error', `upload failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Query — CGoT-MARS multi-agent pipeline.
  // Set toggles.useAgentPipeline=false (via /api/settings) to fall back to the
  // legacy single-pass pipeline.
  app.post('/api/query', requireAuth, async (req, res) => {
    const { query, sessionId } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    console.log(`Processing query: ${query}${sessionId ? ` (session ${sessionId})` : ''}`);
    const startTime = Date.now();
    const useAgents = settings.get().toggles.useAgentPipeline;

    try {
      if (useAgents) {
        const result = await orchestratorAgent.run(query, sessionId);
        metrics.recordQuery({
          latencyMs: Date.now() - startTime,
          confidence: result.confidence,
          contradictions: result.contradictions.length,
          agentSteps: result.agentTrace.length,
        });

        // Build top-chunks panel: prefer evidence-chain order, fall back to
        // retrieval order so the UI still has chunks when the chain is empty.
        const chunkById = new Map(result.retrievedChunks.map(c => [c.id, c]));
        const orderedIds: string[] = [];
        for (const claimId of result.evidenceChain) {
          const claim = result.claimGraph.nodes.find(n => n.id === claimId);
          if (claim && claim.sourceChunkId && !orderedIds.includes(claim.sourceChunkId)) {
            orderedIds.push(claim.sourceChunkId);
          }
        }
        for (const c of result.retrievedChunks) {
          if (!orderedIds.includes(c.id)) orderedIds.push(c.id);
        }
        const topChunks = orderedIds.slice(0, 5).map(id => {
          const c = chunkById.get(id);
          if (!c) return { id, text: '', source: '', score: 0, semanticScore: 0, graphScore: 0, relationalScore: 0, contradictionPenalty: 0, isContradiction: false };
          return {
            id: c.id,
            text: c.text,
            source: c.source,
            score: c.finalScore,
            semanticScore: c.score,
            graphScore: c.graphScore,
            relationalScore: c.relationalScore,
            contradictionPenalty: c.contradictionPenalty,
            isContradiction: c.contradictionPenalty > 0,
          };
        });

        const knowledgeGraph = graphBuilder.getQuerySubgraph(
          query,
          topChunks.map(c => ({ id: c.id, text: c.text ?? '', source: c.source ?? '' })),
          sessionId,
        );

        res.json({
          answer: result.answer,
          confidence: result.confidence,
          latency: `${Date.now() - startTime}ms`,
          sources: result.sources,
          reasoningPath: result.reasoningPath,
          knowledgeGraph,
          claimGraph: result.claimGraph,
          contradictions: result.contradictions,
          evidenceChain: result.evidenceChain,
          agentTrace: result.agentTrace,
          topChunks,
        });
        return;
      }

      // Legacy path.
      const reRankedResults = await ragPipeline.process(query, 20, sessionId);
      const topChunks = reRankedResults.slice(0, 5);
      const generation = await llmGenerator.generate(query, topChunks);
      const knowledgeGraph = graphBuilder.getQuerySubgraph(query, topChunks, sessionId);
      metrics.recordQuery({
        latencyMs: Date.now() - startTime,
        confidence: generation.confidence,
        contradictions: 0,
        agentSteps: 0,
      });
      res.json({
        answer: generation.answer,
        confidence: generation.confidence,
        latency: `${Date.now() - startTime}ms`,
        sources: generation.sources,
        reasoningPath: generation.reasoningPath,
        knowledgeGraph,
        topChunks: topChunks.map(r => ({
          id: r.id,
          text: r.text,
          source: r.source,
          score: r.finalScore,
          semanticScore: r.score,
          graphScore: r.graphScore,
          relationalScore: r.relationalScore,
          contradictionPenalty: r.contradictionPenalty,
          isContradiction: r.contradictionPenalty > 0,
        })),
      });
    } catch (error: any) {
      console.error('Query error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Documents for ONE session the caller owns. Sourced from session_documents
  // (the authoritative per-session record), never the shared in-memory chunk
  // pool — that pool mixes every user's uploads and leaked across sessions.
  app.get('/api/documents', requireAuth, async (req, res) => {
    const sessionId = await gateSessionRead('/documents', req, res);
    if (!sessionId) return; // response already sent by the gate

    const pool = getPool();
    if (!pool) return res.status(503).json({ error: 'Session database unavailable' });
    try {
      const r = await pool.query(
        `SELECT id, filename, chunk_count, uploaded_at
         FROM session_documents WHERE session_id = $1 ORDER BY uploaded_at ASC`,
        [sessionId],
      );
      res.json(
        r.rows.map((d: any) => ({
          id: d.id,
          name: d.filename,
          chunks: d.chunk_count,
          status: 'Processed',
          date: d.uploaded_at,
        })),
      );
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Entity graph for ONE session the caller owns. Loads that session's graph
  // from disk and exports only it — never the global graph.
  app.get('/api/graph', requireAuth, async (req, res) => {
    const sessionId = await gateSessionRead('/graph', req, res);
    if (!sessionId) return; // response already sent by the gate

    await graphBuilder.ensureLoaded(sessionId);
    res.json(graphBuilder.exportFull(sessionId));
  });

  // TASK 1: Clear Corpus
  app.post('/api/clear', async (req, res) => {
    await vectorStore.clear();
    await graphBuilder.clear();
    metrics.log('warn', 'corpus cleared');
    res.json({ message: 'Corpus and Graph cleared' });
  });

  // Configuration: read + write app settings.
  app.get('/api/settings', (_req, res) => {
    res.json(settings.get());
  });
  app.post('/api/settings', async (req, res) => {
    try {
      const next = await settings.update(req.body ?? {});
      res.json(next);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Real telemetry: corpus + graph + query stats + recent logs.
  app.get('/api/health/metrics', (_req, res) => {
    const corpusChunks = vectorStore.getAllChunks().length;
    const graphExport = graphBuilder.exportFull();
    res.json(metrics.snapshot(corpusChunks, graphExport.node_count, graphExport.edge_count));
  });

  // --- Vite / Static Handling ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false 
      },
      appType: 'spa',
      root: process.cwd(),
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = await fs.readFile(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
