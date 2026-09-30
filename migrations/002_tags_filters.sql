ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS spoiler_logs BOOLEAN NOT NULL DEFAULT false;

-- channels/users excluded from logging
CREATE TABLE IF NOT EXISTS log_ignores (
  guild_id  TEXT NOT NULL,
  target_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, target_id)
);

CREATE TABLE IF NOT EXISTS tags (
  guild_id   TEXT NOT NULL,
  name       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, name)
);
