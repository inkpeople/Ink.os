CREATE TABLE IF NOT EXISTS changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  change_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_changes_user_seq ON changes(user_id, seq);
CREATE INDEX IF NOT EXISTS idx_changes_user_entity ON changes(user_id, entity, record_id);
