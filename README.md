# AGX-RAG: Graph-Augmented Retrieval System

A high-performance, minimalist RAG (Retrieval-Augmented Generation) system built with a Swiss Design aesthetic. AGX-RAG combines semantic vector search with persistent knowledge graphs and a hybrid re-ranking pipeline to provide grounded, verifiable AI responses.

## 🇨🇭 System Architecture

The system is partitioned into six core processing layers:

### 1. Unified Interface (Swiss UI)
- **Design Philosophy**: Minimalist, high-contrast typography (Space Grotesk + Inter).
- **Core Components**: Document Dashboard for ingestion management and a dedicated Reasoning Chat for interaction.

### 2. Document Processor
- **Ingestion**: Multi-stage PDF parsing with page-aware chunking.
- **Granularity**: Adaptive chunking optimized for both semantic overlap and entity density.

### 3. Vector Core
- **Model**: `Xenova/bge-small-en-v1.5` (BAAI) running locally via Transformers.js.
- **Search**: Flat Inner Product (FlatIP) semantic similarity search.

### 4. Persistent Knowledge Graph
- **Builder**: Entity extraction (NER) using `compromise`.
- **Structure**: Persistent `graphology` MultiDiGraph.
- **Edges**: Bidirectional links between entities and their source document chunks.
- **Persistence**: Serialized JSON storage in `vectorstore/persistent_graph.json`.

### 5. Hybrid Re-Ranking Pipeline
Implements the **F(d)** scoring function to determine the most relevant evidence:
**F(d) = α·S + β·Gc + γ·Rc − λ·Cp**

- **S**: Semantic Similarity Score.
- **Gc**: Graph Connectivity (Entity density).
- **Rc**: Relational Weight (Bridging chunks between query entities).
- **Cp**: Contradiction Penalty (Identifies high-similarity but low-affinity chunks).

### 6. Grounded Generation
- **LLM**: GPT-4o (OpenAI integration).
- **Reasoning**: Automatic extraction of the "Reasoning Path" from model tokens.
- **Confidence**: Token overlap ratio calculation between output and source evidence.

---

## 🚀 Setup & Execution

### Environment Variables
Create a `.env` file in the root directory (refer to `.env.example`):
```env
OPENAI_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here (optional fallback)
```

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

## 🛠 Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide icons.
- **Backend**: Node.js/Express, Multer (memory-storage).
- **AI/ML**: OpenAI SDK, @xenova/transformers, Graphology, Compromise.js.
- **Database**: Local Filesystem (vectorstore/ for persistence).
