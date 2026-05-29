// Authentication: bcrypt password hashing + stateless JWT (7-day expiry).
//
// Exposes an Express router (/api/auth/*) and a requireAuth middleware that
// the rest of the API uses to gate access. User records live in the `users`
// table created by backend/migrations/001_auth_sessions.sql.
//
// Tokens are stateless: logout is purely client-side (drop the token), so the
// /logout route just returns 200. The signing secret comes from JWT_SECRET.

import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getPool } from './db.js';

const TOKEN_TTL = '7d';

// Resolve the signing secret lazily so a missing JWT_SECRET surfaces as a clear
// 500 at request time rather than a crash at import time. Falls back to a dev
// default only outside production.
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set');
  }
  return 'dev-insecure-secret-change-me';
}

export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  role: 'user' | 'admin';
}

interface JwtPayload {
  sub: string;
  email: string;
}

// Emails listed in ADMIN_EMAILS (comma-separated) are always treated as admins,
// regardless of their stored role. This bootstraps the first admin without a
// manual SQL step; the DB `role` column covers everyone else.
function adminAllowlist(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

// Effective role: 'admin' if the stored role is admin OR the email is in the
// ADMIN_EMAILS allowlist; otherwise whatever is stored (default 'user').
export function resolveRole(email: string, storedRole?: string | null): 'user' | 'admin' {
  if (storedRole === 'admin') return 'admin';
  if (adminAllowlist().has(email.toLowerCase())) return 'admin';
  return 'user';
}

// Express's Request has no `user` field by default. We attach the decoded user
// in requireAuth; downstream handlers read it via (req as AuthedRequest).user.
export interface AuthedRequest extends Request {
  user?: AuthUser;
}

function signToken(user: AuthUser): string {
  const payload: JwtPayload = { sub: user.id, email: user.email };
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_TTL });
}

// --- Middleware -----------------------------------------------------------

// Validates `Authorization: Bearer <token>`. On success attaches req.user and
// calls next(); otherwise responds 401. Looks the user up in the DB so deleted
// users can't keep using a still-valid token.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  const token = header.slice('Bearer '.length).trim();

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, getSecret()) as JwtPayload;
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const pool = getPool();
  if (!pool) {
    return res.status(503).json({ error: 'Auth database unavailable' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, display_name, role FROM users WHERE id = $1',
      [payload.sub],
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    const row = result.rows[0];
    (req as AuthedRequest).user = {
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      role: resolveRole(row.email, row.role),
    };
    next();
  } catch (err: any) {
    res.status(500).json({ error: `Auth lookup failed: ${err.message}` });
  }
}

// Gate for admin-only actions. Must run after requireAuth (which attaches the
// resolved role). Responds 403 for authenticated non-admins.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthedRequest).user;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (user.role !== 'admin') {
    console.log(`[auth] admin route ${req.method} ${req.path} user_id=${user.id} — DENIED`);
    return res.status(403).json({ error: 'Administrator access required' });
  }
  next();
}

export { signToken, getSecret };
