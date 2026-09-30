CREATE TABLE IF NOT EXISTS attachments (
  id         TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  guild_id   TEXT NOT NULL,
  filename   TEXT NOT NULL,
  size       INTEGER NOT NULL,
  path       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attachments_message_idx ON attachments (message_id);
