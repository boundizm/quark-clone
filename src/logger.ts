import { AttachmentBuilder, EmbedBuilder, type Guild, type TextBasedChannel } from 'discord.js';
import { pool } from './db.js';

export const LOG_CATALOG = {
  members: ['member_join', 'member_leave', 'bot_add', 'bot_remove', 'nickname_update', 'role_add', 'role_remove', 'members_prune', 'avatar_update'],
  messages: ['message_delete', 'message_bulk_delete', 'message_edit', 'message_pin', 'message_unpin', 'reaction_remove', 'poll_delete', 'thread_create', 'thread_update', 'thread_delete'],
  voice: ['voice_join', 'voice_leave', 'voice_move', 'voice_stream_start', 'voice_stream_end', 'voice_video_start', 'voice_video_end',
    'voice_mute', 'voice_unmute', 'voice_deafen', 'voice_undeafen', 'stage_start', 'stage_update', 'stage_end', 'stage_speaker'],
  actions: ['invite_create', 'invite_delete', 'emoji_create', 'emoji_update', 'emoji_delete', 'event_create', 'event_update', 'event_delete'],
  channels: ['channel_create', 'channel_update', 'channel_delete', 'perms_add', 'perms_update', 'perms_remove', 'webhook_update'],
  server: ['server_update', 'server_icon', 'server_boost', 'role_create', 'role_update', 'role_delete'],
  moderation: ['ban', 'unban', 'kick', 'timeout'],
  config: ['config_update'],
} as const;

export type Category = keyof typeof LOG_CATALOG;
export type LogEventType = (typeof LOG_CATALOG)[Category][number];

export const CATEGORIES = Object.keys(LOG_CATALOG) as Category[];
export const ALL_TYPES: string[] = Object.values(LOG_CATALOG).flat();

const categoryOf = new Map<string, Category>(
  (Object.entries(LOG_CATALOG) as [Category, readonly string[]][]).flatMap(([c, ts]) => ts.map((t) => [t, c] as const)),
);
export const isValidTarget = (t: string) => ALL_TYPES.includes(t) || (CATEGORIES as string[]).includes(t);
export const expandTarget = (t: string): string[] =>
  (CATEGORIES as string[]).includes(t) ? [t] : [t];

// A specific type route wins over its category route.
export async function sendLog(guild: Guild, type: LogEventType, embed: EmbedBuilder, files: AttachmentBuilder[] = []) {
  const { rows } = await pool.query(
    'SELECT event_type, channel_id FROM log_channels WHERE guild_id = $1 AND event_type = ANY($2)',
    [guild.id, [type, categoryOf.get(type)]],
  );
  const row = rows.find((r) => r.event_type === type) ?? rows[0];
  if (!row) return;
  const channel = guild.channels.cache.get(row.channel_id) as TextBasedChannel | undefined;
  if (!channel || !('send' in channel)) return;
  embed.setTimestamp();
  const { rows: s } = await pool.query('SELECT spoiler_logs FROM guild_settings WHERE guild_id = $1', [guild.id]);
  if (s[0]?.spoiler_logs) {
    const d = embed.data.description;
    if (d) embed.setDescription(`||${d}||`);
    for (const f of embed.data.fields ?? []) f.value = `||${f.value}||`;
  }
  await channel.send({ embeds: [embed], files, allowedMentions: { parse: [] } }).catch(() => undefined);
}

export async function isIgnored(guildId: string, ...ids: (string | null | undefined)[]): Promise<boolean> {
  const list = ids.filter(Boolean) as string[];
  if (!list.length) return false;
  const { rowCount } = await pool.query(
    'SELECT 1 FROM log_ignores WHERE guild_id = $1 AND target_id = ANY($2)', [guildId, list]);
  return (rowCount ?? 0) > 0;
}

export const log = (guild: Guild, type: LogEventType, title: string, color: number, lines: string[]) =>
  sendLog(guild, type, new EmbedBuilder().setColor(color).setTitle(title).setDescription(lines.join('\n')));
