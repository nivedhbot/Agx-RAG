# AGX-RAG: CGoT-MARS

**Contrastive Graph-of-Thought Multi-Agent Reasoning System** — a multi-agent RAG pipeline with explicit claim graphs, contradiction detection, and explainable evidence chains, wrapped in a Swiss-design UI.

Documents, knowledge graphs, and chat history are scoped per user and per session behind JWT authentication. Each session has its own vector index and entity graph, so one user's uploads never appear in another's retrieval or graph.

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
| Auth | JWT (`jsonwebtoken`) + bcrypt password hashing |
| Persistence | Postgres via `pg`; SQL migrations applied on startup |
| Build | Vite 6 (dev), esbuild (server bundle) |

### LLM Routing

Two priority lanes — set whichever provider keys you have:

- `'high'` (final synthesis): OpenAI → NVIDIA → Ollama → mock
- `'low'` (claim extraction, query expansion): NVIDIA → Ollama → OpenAI → mock

If only one provider is configured, it handles both lanes. With no providers, the mock provider returns deterministic stubs so the pipeline still runs end-to-end.

### Authentication and Sessions

Auth is JWT-based. Registration hashes passwords with bcrypt; the signing secret comes from `JWT_SECRET` (required in production, with a clearly marked dev-only fallback otherwise). Tokens carry a 7-day lifetime and are sent as a `Bearer` header on every protected request.

State is organized as user, then session, then documents:

- A **user** owns many **chat sessions**.
- A **session** owns its **documents**, its slice of the vector index (chunks tagged with the session id), its **entity graph**, and its **message history** with full pipeline metadata.

Every session-scoped endpoint verifies that the session belongs to the caller before returning data. A request for a session the caller does not own is rejected, and each ownership decision for the document and graph reads is written to the server log as an `[auth]` audit line. This means uploading, querying, viewing the knowledge graph, and listing documents are all confined to the authenticated user's own sessions.

Accounts carry a role, `user` (default) or `admin`. Admins are the only callers allowed to clear the global corpus or change global settings; ordinary users can still read settings and health metrics. The effective role is the stored `users.role` value, overridden to `admin` when the account's email is listed in the `ADMIN_EMAILS` environment variable. The allowlist bootstraps the first administrator without a manual database step; thereafter roles can be granted directly in the `role` column.

Schema is created and kept current by SQL migrations in `backend/migrations/`, applied automatically on startup. The relevant tables are `users` (with a `role` column), `chat_sessions`, `session_documents`, `session_messages`, and `chunks` (the last carrying a nullable `session_id` so the shared global corpus and per-session uploads coexist in one index).

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

# Postgres connection. Required for auth, sessions, and message history.
# Without it the server still serves the global corpus from a JSON file,
# but registration, login, and per-session features are unavailable.
DATABASE_URL=postgresql://agx:agx@localhost:5432/agxrag

# Secret used to sign JWTs. Required in production (the server throws on
# startup if it is missing). A dev-only fallback is used otherwise.
JWT_SECRET=replace-with-a-long-random-string

# Comma-separated emails always treated as admins, regardless of stored role.
# Used to bootstrap the first administrator.
ADMIN_EMAILS=you@example.com
```

### 3. Postgres + pgvector

Auth and sessions are backed by Postgres, so start the database before running:

```bash
docker compose up -d
```

This launches `pgvector/pgvector:pg16` on port 5432 with the matching credentials. On first connect the server applies the SQL migrations in `backend/migrations/`, creating the `vector` extension and all tables. If the DB is unreachable, the server logs a warning and serves the global corpus from a JSON file, with auth-dependent features disabled.

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000.

## API

All routes except `/api/health` and the auth register/login routes require a `Bearer` token. Routes marked session-scoped additionally verify that the session belongs to the caller.

### Auth

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/register` | POST | Create an account, returns a token and user |
| `/api/auth/login` | POST | Exchange email and password for a token |
| `/api/auth/logout` | POST | Stateless acknowledgement (token is discarded client-side) |
| `/api/auth/me` | GET | Resolve the current user from the token |

### Sessions

| Route | Method | Description |
|-------|--------|-------------|
| `/api/sessions` | GET | List the caller's sessions |
| `/api/sessions` | POST | Create a session |
| `/api/sessions/:id` | GET | Session detail: messages, documents, title (session-scoped) |
| `/api/sessions/:id` | PATCH | Rename a session (session-scoped) |
| `/api/sessions/:id` | DELETE | Delete a session (session-scoped) |
| `/api/sessions/:id/messages` | POST | Append a message with pipeline metadata (session-scoped) |
| `/api/sessions/:id/documents/:docId` | DELETE | Remove one document: rebuilds the index without its chunks and prunes its single-document entities from the graph (session-scoped) |

### Core

| Route | Method | Description |
|-------|--------|-------------|
| `/api/health` | GET | Service status, configured providers, vector backend (public) |
| `/api/health/metrics` | GET | Corpus/graph/query telemetry and recent logs |
| `/api/upload` | POST | Multipart PDF (PDF only, 25 MB limit) into a session: chunk, embed, build graph |
| `/api/query` | POST | Multi-agent pipeline; returns answer, claim graph, evidence chain, agent trace. Session-scoped when a `sessionId` is supplied |
| `/api/documents` | GET | List a session's documents (requires `session_id`, session-scoped) |
| `/api/graph` | GET | Export a session's entity graph (requires `session_id`, session-scoped) |
| `/api/settings` | GET/POST | GET for any authenticated user; POST (global config write) is admin-only |
| `/api/clear` | POST | Purge the global corpus and graph (admin-only) |

Set `toggles.useAgentPipeline = false` via `/api/settings` to fall back to the legacy single-pass RAG.

## Scripts

- `npm run dev` — tsx dev server with Vite middleware
- `npm run build` — Vite build + esbuild server bundle
- `npm start` — run the production bundle
- `npm run lint` — type-check (`tsc --noEmit`)
- `npx tsx scripts/smoke.ts` — phase-1+2 smoke tests (router, chunking, orchestrator with mock LLM)

## Notes

- Embeddings and NLI run locally — no API calls for verification.
- Claim graphs are per-query (ephemeral); the entity graph is persisted per session.
- Retrieval, the entity graph, and the document list are all scoped to the active session. The Knowledge Map can be filtered by document to show which entities a given document contributes, and which entities bridge multiple documents.
- Message history is persisted with full pipeline metadata, so reloading a session restores answers, confidence, evidence chunks, and the agent trace, not just the text.
- The orchestrator's self-reflective loop is gated on confidence + contradictions; lower the threshold in settings to force fewer iterations.
