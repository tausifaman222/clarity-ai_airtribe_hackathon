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
