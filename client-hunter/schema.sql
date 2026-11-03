CREATE TABLE IF NOT EXISTS owner_chats (
  chat_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  text TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  found_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_status_score ON leads(status, score DESC);
