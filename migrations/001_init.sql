CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id       TEXT PRIMARY KEY,
  retention_days INTEGER NOT NULL DEFAULT 7,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- one row per (guild, event type) -> channel
CREATE TABLE IF NOT EXISTS log_channels (
  guild_id   TEXT NOT NULL,
  event_type TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, event_type)
);

-- message content is stored encrypted (AES-256-GCM)
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  author_id   TEXT NOT NULL,
  content_enc BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_expires_idx ON messages (expires_at);
CREATE INDEX IF NOT EXISTS messages_guild_idx ON messages (guild_id);

CREATE TABLE IF NOT EXISTS message_edits (
  id          BIGSERIAL PRIMARY KEY,
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  content_enc BYTEA NOT NULL,
  edited_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
