PRAGMA foreign_keys = ON;

-- Existing catalog tables are intentionally left intact. These additions are safe
-- to apply to the current D1 database.
CREATE TABLE IF NOT EXISTS secure_action_log (
  id TEXT PRIMARY KEY,
  firebase_uid TEXT NOT NULL,
  action TEXT NOT NULL,
  request_hash TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_secure_action_uid_time ON secure_action_log(firebase_uid, created_at);

CREATE TABLE IF NOT EXISTS stage_sessions (
  token TEXT PRIMARY KEY,
  firebase_uid TEXT NOT NULL,
  song_id TEXT,
  difficulty TEXT,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_stage_sessions_uid ON stage_sessions(firebase_uid, started_at);

CREATE TABLE IF NOT EXISTS catalog_contract_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_version TEXT,
  imported_assets INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rate_limit_events (
  bucket TEXT NOT NULL,
  firebase_uid TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(bucket, firebase_uid, window_start)
);
