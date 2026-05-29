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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Load persistent data
  await settings.load();
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
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log(`Processing file: ${req.file.originalname}`);
      const rawChunks = await processPdf(req.file.buffer, req.file.originalname);

      const processedChunks = await vectorStore.addChunks(rawChunks);
      await graphBuilder.updateGraph(processedChunks);
      metrics.recordUpload(req.file.originalname, rawChunks.length);

      res.json({
        message: 'Upload successful',
        document: {
          name: req.file.originalname,
          chunks: rawChunks.length,
          status: 'Processed',
        },
        chunkCount: rawChunks.length,
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
  app.post('/api/query', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    console.log(`Processing query: ${query}`);
    const startTime = Date.now();
    const useAgents = settings.get().toggles.useAgentPipeline;

    try {
      if (useAgents) {
        const result = await orchestratorAgent.run(query);
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
      const reRankedResults = await ragPipeline.process(query, 20);
      const topChunks = reRankedResults.slice(0, 5);
      const generation = await llmGenerator.generate(query, topChunks);
      const knowledgeGraph = graphBuilder.getQuerySubgraph(query, topChunks);
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

  // TASK 1: Get Documents
  app.get('/api/documents', (req, res) => {
    // Derive documents from vector store chunks
    const chunks = vectorStore.getAllChunks();
    const docMap = new Map();
    chunks.forEach(c => {
      if (!docMap.has(c.source)) {
        docMap.set(c.source, {
          id: Math.random().toString(36).substring(7),
          name: c.source,
          chunks: 0,
          status: 'Processed',
          date: 'N/A'
        });
      }
      docMap.get(c.source).chunks++;
    });
    res.json(Array.from(docMap.values()));
  });

  // TASK 1: Get Graph
  app.get('/api/graph', (req, res) => {
    res.json(graphBuilder.exportFull());
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
