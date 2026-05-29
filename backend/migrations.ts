// Lightweight SQL migration runner.
//
// On server startup we apply every backend/migrations/*.sql file in filename
// order against the application Postgres pool. Each migration is expected to be
// idempotent (guarded with IF NOT EXISTS) so re-running on every boot is safe
// and we don't need a migrations-tracking table for this small demo schema.
//
// If DATABASE_URL is unset or unreachable we skip silently — the relational
// auth/session features simply stay disabled, mirroring the vector store's
// JSON fallback so the rest of the system still runs offline.

import fs from 'fs/promises';
import path from 'path';
import { getPool, pingDb } from './db.js';

const MIGRATIONS_DIR = path.join(process.cwd(), 'backend', 'migrations');

export async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log('[migrations] DATABASE_URL not set — skipping (auth/session tables disabled)');
    return;
  }

  const reachable = await pingDb();
  if (!reachable) {
    console.warn('[migrations] DATABASE_URL set but database unreachable — skipping migrations');
    return;
  }

  const pool = getPool();
  if (!pool) return;

  let files: string[];
  try {
    const entries = await fs.readdir(MIGRATIONS_DIR);
    files = entries.filter(f => f.endsWith('.sql')).sort();
  } catch (err) {
    console.warn(`[migrations] no migrations directory at ${MIGRATIONS_DIR} — skipping`);
    return;
  }

  if (files.length === 0) {
    console.log('[migrations] no .sql files found — nothing to apply');
    return;
  }

  for (const file of files) {
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');
    try {
      await pool.query(sql);
      console.log(`[migrations] applied ${file}`);
    } catch (err: any) {
      console.error(`[migrations] failed to apply ${file}: ${err.message}`);
      throw err;
    }
  }

  console.log(`[migrations] ${files.length} migration(s) up to date`);
}
