// Auth HTTP routes: register, login, me, logout.
// Mounted at /api/auth in server.ts.

import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { getPool } from './db.js';
import { signToken, requireAuth, resolveRole, type AuthedRequest, type AuthUser } from './auth.js';

const BCRYPT_ROUNDS = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authRouter = Router();

// Guard: every auth route needs the DB. Respond 503 rather than throwing when
// DATABASE_URL is unset/unreachable.
function ensureDb(res: Response): ReturnType<typeof getPool> | null {
  const pool = getPool();
  if (!pool) {
    res.status(503).json({ error: 'Auth database unavailable' });
    return null;
  }
  return pool;
}

// POST /api/auth/register — { email, password, display_name } -> { token, user }
authRouter.post('/register', async (req: AuthedRequest, res: Response) => {
  const pool = ensureDb(res);
  if (!pool) return;

  const { email, password, display_name } = req.body ?? {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, role`,
      [email.toLowerCase(), hash, typeof display_name === 'string' ? display_name : null],
    );
    const row = result.rows[0];
    const user: AuthUser = {
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      role: resolveRole(row.email, row.role),
    };
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err: any) {
    // 23505 = unique_violation (email already registered)
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login — { email, password } -> { token, user }
authRouter.post('/login', async (req: AuthedRequest, res: Response) => {
  const pool = ensureDb(res);
  if (!pool) return;

  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, display_name, password_hash, role FROM users WHERE email = $1',
      [email.toLowerCase()],
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const row = result.rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user: AuthUser = {
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      role: resolveRole(row.email, row.role),
    };
    const token = signToken(user);
    res.json({ token, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me — requires Bearer token; returns the current user.
authRouter.get('/me', requireAuth, (req: AuthedRequest, res: Response) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout — JWT is stateless, so logout is client-side only.
authRouter.post('/logout', (_req, res: Response) => {
  res.status(200).json({ message: 'Logged out' });
});
