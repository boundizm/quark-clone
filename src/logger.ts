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
  | 'unban';

export const LOG_EVENT_TYPES: LogEventType[] = [
  'message_delete', 'message_edit', 'member_join', 'member_leave',
  'member_update', 'voice', 'ban', 'unban',
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
  await channel.send({ embeds: [embed] }).catch(() => undefined);
}
