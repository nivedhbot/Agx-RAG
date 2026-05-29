-- 002_user_roles.sql
-- Adds a coarse role to users for admin-gated actions (global corpus clear,
-- global settings writes). Applied automatically on startup after 001.
-- Idempotent: ADD COLUMN IF NOT EXISTS, and the CHECK is added only if absent.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- Constrain to the known roles. DO block so re-running doesn't error on an
-- already-present constraint (ADD CONSTRAINT has no IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
  END IF;
END $$;
