-- Clarity AI database schema. Idempotent: safe to run again on an existing database.
-- Apply with `npm run db:migrate` (uses DATABASE_URL), or paste into your provider's SQL editor.
-- On Replit, run it against the development database; Publish carries the changes to production.

CREATE TABLE IF NOT EXISTS clarity_attempts (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  input_mode TEXT NOT NULL CHECK(input_mode IN ('spoken','typed')),
  score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),
  report JSONB NOT NULL,
  display_name VARCHAR(40),
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- v2: custom scenarios (job interviews, negotiations, ...) are saved privately with stage 'custom'.
ALTER TABLE clarity_attempts DROP CONSTRAINT IF EXISTS clarity_attempts_stage_check;
ALTER TABLE clarity_attempts ADD CONSTRAINT clarity_attempts_stage_check CHECK(stage IN ('idea','preseed','seed','seriesa','custom'));
CREATE INDEX IF NOT EXISTS clarity_attempts_ranking
  ON clarity_attempts(stage,input_mode,score DESC) WHERE published = TRUE;
CREATE INDEX IF NOT EXISTS clarity_attempts_owner
  ON clarity_attempts(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS clarity_auth_users (
  id UUID PRIMARY KEY,
  username VARCHAR(24) NOT NULL UNIQUE,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clarity_auth_username_lowercase CHECK (username = lower(username))
);
-- v2: Google sign-in. Accounts can have a password, a Google identity, or both.
ALTER TABLE clarity_auth_users ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE clarity_auth_users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE clarity_auth_users ADD COLUMN IF NOT EXISTS display_name VARCHAR(80);
ALTER TABLE clarity_auth_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE clarity_auth_users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE clarity_auth_users DROP CONSTRAINT IF EXISTS clarity_auth_password_hash_format;
ALTER TABLE clarity_auth_users ADD CONSTRAINT clarity_auth_password_hash_format
  CHECK (password_hash IS NULL OR password_hash LIKE 'scrypt$%');
ALTER TABLE clarity_auth_users DROP CONSTRAINT IF EXISTS clarity_auth_has_login;
ALTER TABLE clarity_auth_users ADD CONSTRAINT clarity_auth_has_login
  CHECK (password_hash IS NOT NULL OR google_sub IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS clarity_auth_users_google_sub ON clarity_auth_users(google_sub) WHERE google_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS clarity_auth_sessions (
  session_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES clarity_auth_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clarity_auth_sessions_expiry_idx
  ON clarity_auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS clarity_auth_login_limits (
  limit_key CHAR(64) PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v2: anonymous usage counters (replaces data/stats.json, which serverless hosts can't keep).
CREATE TABLE IF NOT EXISTS clarity_event_counts (
  day DATE NOT NULL,
  type TEXT NOT NULL,
  count BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (day, type)
);
CREATE TABLE IF NOT EXISTS clarity_visitors (
  visitor_hash CHAR(64) PRIMARY KEY,
  first_day DATE NOT NULL
);
