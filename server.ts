import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { processPdf } from './backend/documentProcessor.js';
import { vectorStore } from './backend/vectorStore.js';
import { graphBuilder } from './backend/graphBuilder.js';
import { ragPipeline } from './backend/ragPipeline.js';
import { llmGenerator } from './backend/llmGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Load persistent data
  await vectorStore.load();
  await graphBuilder.load();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Multer for uploads
  const upload = multer({ storage: multer.memoryStorage() });

  // --- API Routes ---

  // TASK 1: Health Check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'AGX-RAG Multi-Agent System',
      modules: {
        vector: 'Loaded',
        graph: 'Active',
        reranker: 'Hybrid-F(d)',
        llm: process.env.OPENAI_API_KEY ? 'OpenAI' : (process.env.GEMINI_API_KEY ? 'Gemini' : 'Mock')
      }
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
      
      // Add to vector store (TASK 3)
      const processedChunks = await vectorStore.addChunks(rawChunks);
      
      // Update graph (TASK 4)
      await graphBuilder.updateGraph(processedChunks);

      res.json({ 
        message: 'Upload successful', 
        document: {
          name: req.file.originalname,
          chunks: rawChunks.length,
          status: 'Processed'
        },
        chunkCount: rawChunks.length 
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // TASK 5 & 6: Query (Hybrid Search + LLM Generation)
  app.post('/api/query', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    console.log(`Processing query: ${query}`);
    const startTime = Date.now();

    try {
      // 1. Hybrid Pipeline (TASK 5)
      const reRankedResults = await ragPipeline.process(query, 20);
      
      // 2. LLM Generation (TASK 6)
      // We pass the top 5 chunks for context
      const generation = await llmGenerator.generate(query, reRankedResults.slice(0, 5));

      const latency = `${Date.now() - startTime}ms`;

      res.json({
        answer: generation.answer,
        confidence: generation.confidence,
        latency,
        sources: generation.sources,
        reasoningPath: generation.reasoningPath,
        topChunks: reRankedResults.slice(0, 5).map(r => ({
          text: r.text,
          source: r.source,
          score: r.finalScore,
          isContradiction: r.contradictionPenalty > 0
        }))
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
    // We could export the graph from graphBuilder, but it might be too large
    // For now, let's return a summary
    res.json({
      message: "Graph data available via builder"
    });
  });

  // TASK 1: Clear Corpus
  app.post('/api/clear', async (req, res) => {
    await vectorStore.clear();
    await graphBuilder.clear();
    res.json({ message: 'Corpus and Graph cleared' });
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
