import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { processPdf } from './backend/documentProcessor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors());
  app.use(express.json());

  // In-memory store for demo (Corpus)
  let corpus: any[] = [];
  let documents: any[] = [];

  // Multer for uploads
  const upload = multer({ storage: multer.memoryStorage() });

  // --- API Routes ---

  // TASK 1: Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'AGX-RAG Backend (Node.js)' });
  });

  // TASK 1: Upload (Task 2 integration)
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log(`Processing file: ${req.file.originalname}`);
      const chunks = await processPdf(req.file.buffer, req.file.originalname);
      
      const docId = Math.random().toString(36).substring(7);
      const newDoc = {
        id: docId,
        name: req.file.originalname,
        size: `${(req.file.size / 1024).toFixed(1)} KB`,
        chunks: chunks.length,
        status: 'Processed',
        date: new Date().toISOString().split('T')[0]
      };

      documents.push(newDoc);
      corpus.push(...chunks);

      res.json({ 
        message: 'Upload successful', 
        document: newDoc,
        chunkCount: chunks.length 
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // TASK 1: Query (Placeholder for RAG)
  app.post('/api/query', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    // Mock RAG response for now
    res.json({
      answer: `Analysis for "${query}": Based on the uploaded corpus, the architectural patterns suggest a decentralized graph structure. (Actual Gemini integration coming next)`,
      confidence: 0.87,
      latency: '1240ms',
      sources: documents.slice(0, 2).map(d => d.name)
    });
  });

  // TASK 1: Get Documents
  app.get('/api/documents', (req, res) => {
    res.json(documents);
  });

  // TASK 1: Get Graph (Placeholder)
  app.get('/api/graph', (req, res) => {
    res.json({
      nodes: documents.map(d => ({ id: d.id, label: d.name, type: 'document' })),
      edges: []
    });
  });

  // TASK 1: Clear Corpus
  app.post('/api/clear', (req, res) => {
    corpus = [];
    documents = [];
    res.json({ message: 'Corpus cleared' });
  });

  // --- Vite / Static Handling ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
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
