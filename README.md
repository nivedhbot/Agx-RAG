# AGX-RAG: CGoT-MARS

**Contrastive Graph-of-Thought Multi-Agent Reasoning System** — a multi-agent RAG pipeline with explicit claim graphs, contradiction detection, and explainable evidence chains, wrapped in a Swiss-design UI.

## Architecture

### Five-Agent Pipeline

| Agent | Role |
|-------|------|
| **Orchestrator** | Decomposes the query, runs a self-reflective retrieve-verify-traverse loop (max 3 iterations), and gates synthesis on confidence + contradiction signals. |
| **Retriever** | Expands the query into 2-3 variants, runs the hybrid F(d) pipeline across all variants, and merges results with graph-bridging boosts. |
| **Verifier** | Extracts atomic claims (batched LLM call), classifies claim-claim and claim-query relations via local NLI, builds a contrastive claim graph, and flags contradictions. |
| **Graph Reasoner** | Scores claims by support/contradict degree and source diversity, then extracts the ordered evidence chain from the claim graph. |
| **Synthesizer** | Generates the final answer with contrastive prompting (separating supporting vs contradicting evidence), produces structured citations, and computes a blended confidence (coverage + diversity − contradictions). |

### Hybrid F(d) Re-Ranking

The retriever uses **F(d) = α·S + β·Gc + γ·Rc − λ·Cp**:

- **S**: Semantic similarity (BGE-small-en-v1.5, 384-dim, L2-normalised)
- **Gc**: Graph connectivity (entity overlap between query and chunk)
- **Rc**: Relational weight (bridging chunks across query entities)
- **Cp**: Contradiction penalty

All four weights are tunable at runtime via `/api/settings`.

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, TailwindCSS v4, Recharts, Motion |
| Backend | Node.js + Express, Multer |
| Embeddings | `@huggingface/transformers` — `Xenova/bge-small-en-v1.5` (local) |
| NLI | `Xenova/nli-deberta-v3-xsmall` (local zero-shot, no API) |
| Knowledge graph | `graphology` MultiDirectedGraph + `compromise` NER |
| LLM router | OpenAI → NVIDIA NIM → Ollama → mock (priority-based fallback) |
| Vector store | Postgres + pgvector (auto-fallback to JSON file) |
| Build | Vite 6 (dev), esbuild (server bundle) |

### LLM Routing

Two priority lanes — set whichever provider keys you have:

- `'high'` (final synthesis): OpenAI → NVIDIA → Ollama → mock
- `'low'` (claim extraction, query expansion): NVIDIA → Ollama → OpenAI → mock

If only one provider is configured, it handles both lanes. With no providers, the mock provider returns deterministic stubs so the pipeline still runs end-to-end.

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment

Create `.env`:

```env
# At least one of these for real generation:
OPENAI_API_KEY=sk-...
NVIDIA_API_KEY=nvapi-...
OLLAMA_ENABLED=true        # uses local Ollama if installed

# Optional — Postgres for vector storage (otherwise JSON file)
DATABASE_URL=postgresql://agx:agx@localhost:5432/agxrag
```

### 3. Optional: Postgres + pgvector

If you set `DATABASE_URL`, start the database first:

```bash
docker compose up -d
```

This launches `pgvector/pgvector:pg16` on port 5432 with the matching credentials. The server creates the `chunks` table and `vector` extension on first connect. If the DB is unreachable, the server logs a warning and falls back to JSON.

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000.

## API

| Route | Method | Description |
|-------|--------|-------------|
| `/api/health` | GET | Service status, configured providers, vector backend |
| `/api/health/metrics` | GET | Corpus/graph/query telemetry + recent logs |
| `/api/upload` | POST | Multipart PDF → page-aware chunking → embed → graph |
| `/api/query` | POST | Multi-agent pipeline; returns answer, claim graph, evidence chain, agent trace |
| `/api/documents` | GET | List ingested documents |
| `/api/graph` | GET | Export persistent knowledge graph |
| `/api/settings` | GET/POST | Runtime tunables (F(d) weights, agent iteration limit, toggles) |
| `/api/clear` | POST | Purge corpus + graph |

Set `toggles.useAgentPipeline = false` via `/api/settings` to fall back to the legacy single-pass RAG.

## Scripts

- `npm run dev` — tsx dev server with Vite middleware
- `npm run build` — Vite build + esbuild server bundle
- `npm start` — run the production bundle
- `npm run lint` — type-check (`tsc --noEmit`)
- `npx tsx scripts/smoke.ts` — phase-1+2 smoke tests (router, chunking, orchestrator with mock LLM)

## Notes

- Embeddings and NLI run locally — no API calls for verification.
- Claim graphs are per-query (ephemeral); only the entity graph is persisted.
- The orchestrator's self-reflective loop is gated on confidence + contradictions; lower the threshold in settings to force fewer iterations.
