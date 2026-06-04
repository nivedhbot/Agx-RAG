# AGX-RAG (CGoT-MARS) — Project Report

A complete technical report for hackathon presentation and judging. Covers what
the system is, how it is built, the security model, the recent security review,
and a suggested demo script.

---

## 1. One-line pitch

AGX-RAG is a multi-agent retrieval-augmented-generation system that does not just
answer questions over your documents — it builds an explicit **claim graph**,
**detects contradictions** between sources using a local NLI model, and returns a
traceable **evidence chain** so every answer is explainable, all behind per-user,
per-session data isolation.

## 2. The problem

Standard RAG retrieves a few chunks and asks an LLM to summarise them. It hides
three weaknesses that matter in any serious setting:

1. **No contradiction awareness.** If two sources disagree, vanilla RAG silently
   picks one or blends them. The user never learns the sources conflicted.
2. **No provenance.** Answers cite "sources" but rarely show the reasoning path
   from evidence to conclusion.
3. **No isolation.** Most demo RAG apps dump every document into one shared index.

AGX-RAG (CGoT-MARS — Contrastive Graph-of-Thought Multi-Agent Reasoning System)
addresses all three.

## 3. What makes it different

- **Five specialised agents** instead of one prompt: Orchestrator, Retriever,
  Verifier, Graph Reasoner, Synthesizer.
- **Contrastive claim graph.** Claims are extracted from retrieved passages and
  classified pairwise (support / contradict / neutral) by a local NLI model, then
  assembled into a graph. Contradictions surface in the UI.
- **Hybrid F(d) re-ranking** that blends semantic similarity with an entity
  knowledge graph, not just cosine distance.
- **Everything runs locally for the verification half** — embeddings and NLI are
  local transformer models, so claim extraction and contradiction detection cost
  zero API calls.
- **Per-user / per-session isolation** behind JWT auth, with an audited ownership
  gate on every session-scoped endpoint.

## 4. Architecture

### 4.1 Five-agent pipeline

| Agent | Responsibility |
|-------|----------------|
| **Orchestrator** | Decomposes the query and runs a self-reflective retrieve → verify → traverse loop (up to 3 iterations), gating synthesis on confidence and contradiction signals. |
| **Retriever** | Expands the query into 2–3 variants, runs the hybrid F(d) pipeline across all variants, and merges with graph-bridging boosts. |
| **Verifier** | Extracts atomic claims (batched LLM call), classifies claim-claim and claim-query relations via local NLI, builds the contrastive claim graph, flags contradictions. |
| **Graph Reasoner** | Scores claims by support/contradict degree and source diversity, then extracts the ordered evidence chain. |
| **Synthesizer** | Generates the final answer with contrastive prompting (supporting vs contradicting evidence separated), structured citations, and a blended confidence score. |

### 4.2 Hybrid F(d) re-ranking

Retrieval is not pure vector search. Each candidate chunk is scored:

```
F(d) = α·S + β·Gc + γ·Rc − λ·Cp
```

- **S** — semantic similarity (BGE-small-en-v1.5, 384-dim, L2-normalised)
- **Gc** — graph connectivity (entity overlap between query and chunk)
- **Rc** — relational weight (chunks that bridge multiple query entities)
- **Cp** — contradiction penalty

All four weights are tunable at runtime via `/api/settings` (admin-only write).

### 4.3 Knowledge graph

A per-session entity graph (`graphology` MultiDirectedGraph) is built from
extracted entities (`compromise` NER) with co-occurrence edges. It powers the
Gc / Rc terms above and the interactive Knowledge Map, which can be filtered by
document to show which entities a document contributes and which entities bridge
multiple documents.

### 4.4 Data model (Postgres)

| Table | Purpose |
|-------|---------|
| `users` | id, email, bcrypt `password_hash`, display_name, `role` (`user`/`admin`) |
| `chat_sessions` | id, user_id, title, timestamps |
| `session_documents` | id, session_id, filename, chunk_count, uploaded_at |
| `session_messages` | id, session_id, role, content, `metadata` JSONB (full pipeline payload) |
| `chunks` | vector rows; **nullable `session_id`** so the global corpus (NULL) and per-session uploads share one index |

The `metadata` JSONB on messages stores the entire pipeline output (confidence,
latency, sources, reasoning path, top chunks, knowledge graph, claim graph,
contradictions, evidence chain, agent trace), so reloading a session restores the
full reasoning view — not just the answer text.

### 4.5 Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, TailwindCSS v4, Recharts, Motion (Swiss design system) |
| Backend | Node.js + Express, Multer, single `server.ts` |
| Embeddings | `@huggingface/transformers` — `Xenova/bge-small-en-v1.5` (local) |
| NLI | `Xenova/nli-deberta-v3-xsmall` (local zero-shot) |
| Knowledge graph | `graphology` MultiDirectedGraph + `compromise` NER |
| LLM router | OpenAI → NVIDIA NIM → Ollama → mock (priority fallback) |
| Vector store | Postgres + pgvector, auto-fallback to a JSON file |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Build | Vite 6 (dev/front), esbuild (server bundle) |

Roughly **8,000 lines of TypeScript across 47 source files**, 41 commits.

### 4.6 LLM routing

Two priority lanes; configure whatever provider keys you have:

- `high` (final synthesis): OpenAI → NVIDIA → Ollama → mock
- `low` (claim extraction, query expansion): NVIDIA → Ollama → OpenAI → mock

With no providers configured, a deterministic mock provider keeps the whole
pipeline runnable end-to-end — useful for offline demos and CI.

## 5. Request flow (query path)

1. `POST /api/query` with `{ query, sessionId? }`, `Bearer` token required.
2. If `sessionId` is present, ownership is verified before anything runs (a
   sessionId the caller does not own would otherwise leak another user's chunks).
3. The Orchestrator runs the retrieve → verify → traverse loop.
4. Retrieval is **session-scoped** when a session is given, otherwise restricted
   to the global (NULL-session) corpus only.
5. The response carries the answer, confidence, latency, sources, reasoning path,
   knowledge subgraph, claim graph, contradictions, evidence chain, agent trace,
   and the top evidence chunks with their per-term scores.

## 6. Security model

- **Auth.** Stateless JWT, 7-day expiry, bcrypt password hashing. `JWT_SECRET` is
  required in production (the server throws on startup if missing); a clearly
  marked dev fallback is used otherwise. `requireAuth` re-loads the user from the
  DB on every request, so a deleted user's still-valid token stops working.
- **Isolation rule.** Every session-scoped endpoint verifies the session belongs
  to the caller before reading or mutating. The shared helper is
  `userOwnsSession()` (server.ts) / `ownedSession()` (sessionRoutes.ts); the
  latter returns 404 for not-owned sessions to avoid leaking their existence.
  Document and graph reads also emit an `[auth] … ALLOWED|DENIED` audit line.
- **Roles.** `resolveRole()` returns `admin` when the stored role is admin OR the
  email is in the `ADMIN_EMAILS` allowlist (bootstraps the first admin without a
  manual SQL step). Destructive/global endpoints (`/api/clear`, `/api/settings`
  POST) are `requireAdmin`.
- **Input handling.** All SQL is parameterized. Registration validates email
  (regex) and password (8-char minimum). Uploads are PDF-only, capped at 25 MB,
  one file, held in memory (raw PDFs never touch disk), with clean 413/415
  responses.
- **Secrets.** `.env` is gitignored and was **never committed** — verified across
  the full git history; no API key or secret appears in any commit.

### Endpoint gate summary

| Endpoint | Gate |
|----------|------|
| `/api/health` | public |
| `/api/auth/register`, `/login` | public (validated) |
| `/api/query` | auth; ownership-checked when `sessionId` given |
| `/api/upload` | auth; ownership-checked; PDF-only; 25 MB |
| `/api/documents`, `/api/graph` | auth; ownership-checked (`session_id` required) |
| `/api/sessions/*` | auth; per-user / per-session ownership |
| `/api/health/metrics` | auth |
| `/api/clear` | auth + **admin** |
| `/api/settings` | GET auth; POST **admin** |

## 7. Security review and bug fixes (this pass)

A full review of the backend was performed before going public. Git history was
scanned for committed secrets (none found) and every backend module was read for
correctness and security defects. Three real bugs were found and fixed.

### Fixed

1. **Cross-session leak in `/reprocess` (also broke the build).**
   `vectorStore.getAllChunks()` took no argument and returned every chunk from
   every user, but `server.ts` called `getAllChunks(sessionId)`. The session's
   knowledge graph was being rebuilt from the **entire corpus**, and the extra
   argument failed `tsc`, breaking `npm run build`.
   *Fix:* `getAllChunks(sessionId?)` now filters to the session's own chunks; the
   no-argument form (corpus telemetry) is unchanged.

2. **Unscoped queries leaked session-scoped chunks.**
   When no `sessionId` was supplied, `searchTopK` ran with no `WHERE` clause and
   returned **all** chunks — including other users' session uploads. A query with
   no session could surface another user's document content.
   *Fix:* an unscoped query is now restricted to the global corpus
   (`session_id IS NULL`) in both the Postgres and JSON backends.

3. **Weak chunk IDs causing silent data loss.**
   Chunk IDs were `Math.random().toString(36).substring(7)` — only ~4–6 weak
   characters. Collisions hit `ON CONFLICT (id) DO NOTHING` and silently dropped
   the uploaded chunk.
   *Fix:* `crypto.randomUUID()`.

All three fixes verified clean against `npm run lint` (tsc) and `npm run build`.

### Recommended hardening (not yet applied — config / judgment calls)

- **Rotate the OpenAI key and strengthen `JWT_SECRET`.** The local `.env` carries
  a real OpenAI key and the JWT secret `agx-rag-secret-key`. Neither was ever
  committed, so the public repo is clean — but since the key exists on disk and
  the secret is weak, rotate the key and set a long random `JWT_SECRET` for any
  shared/production deployment.
- **CORS is currently open (`app.use(cors())`).** Fine for local demo; lock to
  the known frontend origin before any public deployment. (Auth is Bearer-token,
  not cookie, so CSRF exposure is limited.)
- **Add rate limiting** on `/api/auth/login` and `/register` to blunt brute-force.
- **Prompt-injection note.** Uploaded document text flows into LLM prompts; a
  malicious PDF could attempt instruction injection. The cross-session leak fixes
  above remove the path to exfiltrating *other users'* data this way; per-session
  injection is inherent to RAG and worth a delimiting/guard pass later.
- **Concurrency note.** Per-session graph writes are not locked; concurrent
  uploads/deletes to the same session could race. Low risk for a single-user demo.
- **Migration safety / schema.** Consider wrapping each migration file in a
  transaction and making `chat_sessions.user_id NOT NULL`.

## 8. Setup (judge / reviewer quickstart)

```bash
npm install
docker compose up -d          # pgvector/pgvector:pg16 on :5432 (agx/agx/agxrag)
cp .env.example .env          # then set OPENAI_API_KEY, JWT_SECRET, ADMIN_EMAILS
npm run dev                   # http://localhost:3000
```

Without `DATABASE_URL` the server still runs (JSON vector store), but auth and
sessions are disabled. Without any LLM key the mock provider keeps the pipeline
runnable end-to-end.

## 9. Suggested demo script (5 minutes)

1. **Register / log in.** Show the JWT-gated UI and the ADMIN/USER role chip.
2. **Create a session, upload two PDFs that disagree** on some fact (e.g. two
   reports with conflicting figures).
3. **Ask a question that touches the conflict.** Point out:
   - the **answer** with confidence,
   - the **claim graph** and the flagged **contradiction**,
   - the **evidence chain** and per-chunk F(d) score breakdown,
   - the **agent trace** showing the retrieve → verify → traverse loop.
4. **Open the Knowledge Map**, filter by one document, show entity provenance and
   the cross-document bridge entities.
5. **Delete one document** — show the index rebuild and single-document entity
   pruning (multi-document entities survive).
6. **Isolation proof.** Log in as a second user; show their session list and
   retrieval are completely separate. Mention the `[auth]` audit lines in the
   server log.
7. **Mention the security review:** three real bugs found and fixed before going
   public, including a cross-session leak, with the build green.

## 10. Talking points for judges

- "Verification is **local and free** — embeddings and NLI never call an API, so
  contradiction detection scales without per-query cost."
- "Every answer is **traceable** — claim graph, evidence chain, and per-term
  retrieval scores, not a black box."
- "**Isolation is enforced and audited**, not assumed — one helper, used on every
  session-scoped route, with allow/deny logging."
- "It **degrades gracefully** — no DB falls back to JSON, no LLM key falls back to
  a deterministic mock, so it always runs."

## 11. Limitations and future work

- Single-node, in-process server; not horizontally scaled.
- Per-session graph writes are unsynchronised (see §7).
- Claim extraction quality is bounded by the `low` LLM lane and the NER step.
- Frontend bundle is a single ~825 KB chunk — code-splitting would help load time.
- PDF-only ingestion today; other formats are future work.

---

*Generated as part of a pre-public security and quality review. Build status:
`npm run lint` and `npm run build` both green.*
