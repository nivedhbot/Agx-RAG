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
}

interface JwtPayload {
  sub: string;
  email: string;
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
      'SELECT id, email, display_name FROM users WHERE id = $1',
      [payload.sub],
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    (req as AuthedRequest).user = result.rows[0] as AuthUser;
    next();
  } catch (err: any) {
    res.status(500).json({ error: `Auth lookup failed: ${err.message}` });
  }
}

export { signToken, getSecret };
