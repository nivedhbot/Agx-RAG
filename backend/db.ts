// Shared application Postgres pool for auth + multi-session features.
//
// This is separate from the vector store's own pool (see vectorBackends.ts):
// that one is dedicated to pgvector similarity search, while this pool serves
// the relational auth/session tables created by backend/migrations.
//
// The pool is lazily created on first use and only when DATABASE_URL is set.
// When it isn't, getPool() returns null and callers fall back gracefully so the
// system still runs offline (mirroring the vector store's JSON fallback).

import { Pool } from 'pg';

let pool: Pool | null = null;
let initialised = false;

export function isDbEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool | null {
  if (initialised) return pool;
  initialised = true;
  const url = process.env.DATABASE_URL;
  if (!url) {
    pool = null;
    return null;
  }
  pool = new Pool({
    connectionString: url,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
  });
  return pool;
}

// Verify the connection is actually reachable. Returns false instead of
// throwing so startup can degrade gracefully.
export async function pingDb(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await p.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
