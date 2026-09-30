import { EmbedBuilder, type Guild, type TextBasedChannel } from 'discord.js';
import { pool } from './db.js';

export type LogEventType =
  | 'message_delete'
  | 'message_edit'
  | 'member_join'
  | 'member_leave'
  | 'member_update'
  | 'voice'
  | 'ban'
  | 'unban'
  | 'kick'
  | 'timeout';

export const LOG_EVENT_TYPES: LogEventType[] = [
  'message_delete', 'message_edit', 'member_join', 'member_leave',
  'member_update', 'voice', 'ban', 'unban', 'kick', 'timeout',
];

export async function sendLog(guild: Guild, type: LogEventType, embed: EmbedBuilder) {
  const { rows } = await pool.query(
    'SELECT channel_id FROM log_channels WHERE guild_id = $1 AND event_type = $2',
    [guild.id, type],
  );
  if (!rows[0]) return;
  const channel = guild.channels.cache.get(rows[0].channel_id) as TextBasedChannel | undefined;
  if (!channel || !('send' in channel)) return;
  embed.setTimestamp();
  const { rows: s } = await pool.query('SELECT spoiler_logs FROM guild_settings WHERE guild_id = $1', [guild.id]);
  if (s[0]?.spoiler_logs) {
    const d = embed.data.description;
    if (d) embed.setDescription(`||${d}||`);
    for (const f of embed.data.fields ?? []) f.value = `||${f.value}||`;
  }
  await channel.send({ embeds: [embed] }).catch(() => undefined);
}

export async function isIgnored(guildId: string, ...ids: (string | null | undefined)[]): Promise<boolean> {
  const list = ids.filter(Boolean) as string[];
  if (!list.length) return false;
  const { rowCount } = await pool.query(
    'SELECT 1 FROM log_ignores WHERE guild_id = $1 AND target_id = ANY($2)', [guildId, list]);
  return (rowCount ?? 0) > 0;
}
