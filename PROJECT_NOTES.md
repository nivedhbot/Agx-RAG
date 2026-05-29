# AGX-RAG Project Notes

Internal engineering notes and codebase analysis. Read this first to get oriented
before working on the project. Kept deliberately factual and current.

## What this is

AGX-RAG (CGoT-MARS) is a multi-agent retrieval-augmented-generation app:
a five-agent reasoning pipeline over a hybrid vector + entity-graph store, with
per-query claim graphs and contradiction detection, behind a Swiss-design React
UI. All document/graph/chat state is scoped per user and per session behind JWT
auth.

- Frontend: React 18 + Vite 6 + Tailwind (Swiss design system in `src/components/SwissUI`).
- Server: single Express app in `server.ts`, run via `tsx server.ts` (dev) /
  esbuild bundle to `dist/server.cjs` (build). `npm run dev` serves API + Vite.
- Data: Postgres + pgvector (auto-fallback to a JSON file store when no DB).
- Models: local embeddings (bge-small-en-v1.5) + local NLI
  (Xenova/nli-deberta-v3-xsmall) via transformers.js; LLM via OpenAI / NVIDIA /
  Ollama / deterministic mock.

## Key directories

- `server.ts` — all HTTP routes, multer upload config, ownership gates.
- `backend/auth.ts` — JWT sign/verify, `requireAuth`, `requireAdmin`,
  `resolveRole`, `AuthUser` type.
- `backend/authRoutes.ts` — register / login / logout / me.
- `backend/sessionRoutes.ts` — session CRUD, messages, document delete; all
  ownership-checked via `ownedSession()`.
- `backend/vectorStore.ts` + `backend/vectorBackends.ts` — chunk storage; two
  backends (Postgres pgvector, JSON file) behind one interface.
- `backend/graphBuilder.ts` — per-session entity graph (graphology), persisted to
  `vectorstore/graphs/{sessionId}.json`.
- `backend/migrations/` + `backend/migrations.ts` — idempotent SQL migrations run
  on startup. Tracked by re-running every `.sql` with `IF NOT EXISTS` guards.
- `src/App.tsx` — top-level view router (state-based, not URL-based) + auth state.
- `src/lib/api.ts` — `authFetch` (injects Bearer token, emits `agx:unauthorized`
  on 401). `src/lib/auth.ts` — `getToken/getCurrentUser/logout/isAuthenticated`.

## Data model (Postgres)

- `users` — id, email, password_hash (bcrypt), display_name, **role** (`user`|`admin`).
- `chat_sessions` — id, user_id, title, timestamps.
- `session_documents` — id, session_id, filename, chunk_count, uploaded_at.
- `session_messages` — id, session_id, role, content, **metadata JSONB** (full
  pipeline payload: confidence, latency, sources, reasoningPath, topChunks,
  knowledgeGraph, claimGraph, contradictions, evidenceChain, agentTrace).
- `chunks` — vector rows; **nullable `session_id`** so the shared global corpus
  (NULL) and per-session uploads coexist in one index.

## Security model (important — verified)

Auth is JWT (7-day expiry), bcrypt password hashing, `JWT_SECRET` required in
production (server throws on startup without it; clearly-marked dev fallback
otherwise). Email/password validated on register (regex + 8-char min). All SQL
is parameterized. `.env` is gitignored and was never committed.

Isolation rule: **every session-scoped endpoint must verify the session belongs
to the caller before returning or mutating data.** The shared helper is
`userOwnsSession(sessionId, userId)` in `server.ts`; session routes use
`ownedSession()` in `sessionRoutes.ts` (returns 404 for not-owned, to avoid
leaking existence). Document/graph reads also emit an `[auth] ... ALLOWED|DENIED`
audit log line.

Endpoints and their gates:
- `/api/documents`, `/api/graph` — require `session_id`, ownership-checked (403).
- `/api/query` — ownership-checked when a `sessionId` is passed (retrieval is
  session-scoped, so an unchecked sessionId would leak another user's chunks).
  No sessionId = global corpus, allowed.
- `/api/upload` — ownership-checked; PDF-only; 25 MB limit; 1 file. Returns clean
  413 (too large) / 415 (wrong type). Uses multer memoryStorage (raw PDFs never
  hit disk).
- `/api/clear` — **admin-only** (`requireAdmin`). Wipes the global corpus + graph.
- `/api/settings` — GET any authed user; **POST admin-only** (changes the global
  LLM pipeline for everyone).
- `/api/health/metrics` — any authed user (read-only telemetry).
- `/api/health` — public.

Roles: `resolveRole(email, storedRole)` returns `admin` if the stored role is
admin OR the email is in `ADMIN_EMAILS` (comma-separated env allowlist, used to
bootstrap the first admin). Frontend reflects role: nav chip shows ADMIN/USER,
SettingsPage is read-only for non-admins, Dashboard PURGE button is admin-only.

## Document delete semantics (subtle)

`DELETE /api/sessions/:id/documents/:docId`:
1. Deletes the doc's chunks by `(session_id, source=filename)` — there is NO
   chunk→document FK; the filename is the link. Returns removed chunk ids.
2. Prunes the graph: drops those chunk nodes, then drops any entity left with
   zero remaining chunk edges (an entity that appeared ONLY in that doc). Entities
   still linked to other docs' chunks survive — this is the "keep multi-document
   entities" requirement.
3. Removes the `session_documents` row, returns updated counts + node/edge deltas.
4. Does NOT delete anything from disk (audit requirement). Raw PDFs were never on
   disk anyway (memoryStorage); the graph JSON is rewritten in place.

## Knowledge Map per-document provenance

`graphBuilder.exportFull()` emits `source` on chunk nodes. The panel
(`EntityGraphPanel.tsx`) derives, per entity, the set of documents it appears in
(via chunk→source). `VIEW_BY_DOCUMENT` dropdown: ALL (merged) or one doc. When
filtered, in-doc entities are sienna + larger, cross-doc entities deeper sienna
(bridges), others gray with faded edges. Entity Detail shows MENTIONED_IN docs +
doc-scoped chunks.

## Operational gotchas

- **`tsx server.ts` does NOT hot-reload the server.** After backend changes,
  kill the process on port 3000 and `npm run dev` again, or backend edits won't
  take effect (the frontend hot-reloads via Vite, the server does not).
- Postgres runs via `docker compose up -d` (pgvector/pgvector:pg16, port 5432,
  agx/agx/agxrag). Migrations apply on boot; look for `[migrations] applied`.
- On Windows, test temp dirs (`.tmp-test/`) sometimes keep a file handle briefly
  after a tsx run — `rm -rf` may report "Device or resource busy"; it's gitignored
  and harmless. Retry after a few seconds.
- `npm run lint` = `tsc --noEmit` (typecheck only). `npm run build` = Vite
  frontend + esbuild server. Both must be clean before committing.
- Verify flows with a throwaway script that hits the live API (register → session
  → upload → query). A minimal valid PDF can be hand-generated; see git history
  for the generator pattern if needed.

## Work completed (feature tasks + hardening)

1. Per-user/session data isolation on `/documents` + `/graph` (403/400 + audit).
2. Per-document delete (index rebuild + single-doc entity pruning).
3. Knowledge Map per-document entity provenance filter.
4. Knowledge Map clarifying subtitle.
5. Session-scoped upload verification toasts (chunk + entity counts).
6. Security pass: fixed cross-user `/api/query` leak; gated `/clear`, `/settings`
   POST, `/health/metrics`; bounded uploads (size + PDF-only).
7. Admin role: `users.role` + `ADMIN_EMAILS` allowlist + `requireAdmin`; gated
   destructive/global endpoints; frontend role indicators.

## Conventions for this repo

- Commit messages: short, **no colons**, **no Co-Authored-By trailer**.
- Push each task to `origin main` after it's done.
- Do not modify the Swiss design tokens, the graph visualisation engine, or the
  Engine Config page unless a task explicitly calls for it.
- README must stay free of emoji and AI filler.
