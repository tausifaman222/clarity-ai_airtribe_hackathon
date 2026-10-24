-- Development schema reference. Publish applies managed production schema changes.
-- Do not execute schema changes on application startup.
CREATE TABLE IF NOT EXISTS clarity_attempts (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK(stage IN ('idea','preseed','seed','seriesa')),
  input_mode TEXT NOT NULL CHECK(input_mode IN ('spoken','typed')),
  score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),
  report JSONB NOT NULL,
  display_name VARCHAR(40),
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clarity_attempts_ranking
  ON clarity_attempts(stage,input_mode,score DESC) WHERE published = TRUE;
CREATE INDEX IF NOT EXISTS clarity_attempts_owner
  ON clarity_attempts(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS clarity_auth_users (
  id UUID PRIMARY KEY,
  username VARCHAR(24) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clarity_auth_username_lowercase CHECK (username = lower(username)),
  CONSTRAINT clarity_auth_password_hash_format CHECK (password_hash LIKE 'scrypt$%')
);

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
