-- event_type in log_channels may now hold either a category (e.g. "members") or a single type (e.g. "role_add").
-- Old coarse types are migrated to their closest category.
UPDATE log_channels SET event_type = 'messages' WHERE event_type IN ('message_delete','message_edit');
UPDATE log_channels SET event_type = 'members'  WHERE event_type IN ('member_join','member_leave','member_update');
UPDATE log_channels SET event_type = 'voice'    WHERE event_type = 'voice';
UPDATE log_channels SET event_type = 'moderation' WHERE event_type IN ('ban','unban','kick','timeout');
UPDATE log_channels SET event_type = 'channels' WHERE event_type IN ('channel','webhook');
UPDATE log_channels SET event_type = 'server'   WHERE event_type IN ('server','role');
UPDATE log_channels SET event_type = 'actions'  WHERE event_type IN ('emoji','invite');
UPDATE log_channels SET event_type = 'messages' WHERE event_type = 'thread';
DELETE FROM log_channels a USING log_channels b
  WHERE a.ctid < b.ctid AND a.guild_id = b.guild_id AND a.event_type = b.event_type;
