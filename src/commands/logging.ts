import {
  ChannelType, PermissionFlagsBits, SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { pool } from '../db.js';
import { LOG_EVENT_TYPES } from '../logger.js';

export const data = new SlashCommandBuilder()
  .setName('logging')
  .setDescription('Configure log channels')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) => s.setName('set').setDescription('Send an event type to a channel')
    .addStringOption((o) => o.setName('event').setDescription('Event type').setRequired(true)
      .addChoices(...LOG_EVENT_TYPES.map((e) => ({ name: e, value: e }))))
    .addChannelOption((o) => o.setName('channel').setDescription('Target channel').setRequired(true)
      .addChannelTypes(ChannelType.GuildText)))
  .addSubcommand((s) => s.setName('all').setDescription('Send all event types to one channel')
    .addChannelOption((o) => o.setName('channel').setDescription('Target channel').setRequired(true)
      .addChannelTypes(ChannelType.GuildText)))
  .addSubcommand((s) => s.setName('disable').setDescription('Stop logging an event type')
    .addStringOption((o) => o.setName('event').setDescription('Event type').setRequired(true)
      .addChoices(...LOG_EVENT_TYPES.map((e) => ({ name: e, value: e })))))
  .addSubcommand((s) => s.setName('spoiler').setDescription('Hide log contents behind spoilers')
    .addBooleanOption((o) => o.setName('enabled').setDescription('On/off').setRequired(true)))
  .addSubcommand((s) => s.setName('ignore').setDescription('Toggle ignoring a channel or user')
    .addChannelOption((o) => o.setName('channel').setDescription('Channel to ignore'))
    .addUserOption((o) => o.setName('user').setDescription('User to ignore')))
  .addSubcommand((s) => s.setName('retention').setDescription('Set message retention in days')
    .addIntegerOption((o) => o.setName('days').setDescription('1-30').setMinValue(1).setMaxValue(30).setRequired(true)));

const upsert = `INSERT INTO log_channels (guild_id, event_type, channel_id) VALUES ($1,$2,$3)
  ON CONFLICT (guild_id, event_type) DO UPDATE SET channel_id = EXCLUDED.channel_id`;

export async function execute(i: ChatInputCommandInteraction) {
  if (!i.guildId) return;
  const sub = i.options.getSubcommand();
  if (sub === 'set') {
    const ch = i.options.getChannel('channel', true);
    await pool.query(upsert, [i.guildId, i.options.getString('event', true), ch.id]);
    return void i.reply({ content: `Logging set to <#${ch.id}>.`, ephemeral: true });
  }
  if (sub === 'all') {
    const ch = i.options.getChannel('channel', true);
    for (const e of LOG_EVENT_TYPES) await pool.query(upsert, [i.guildId, e, ch.id]);
    return void i.reply({ content: `All events now log to <#${ch.id}>.`, ephemeral: true });
  }
  if (sub === 'disable') {
    await pool.query('DELETE FROM log_channels WHERE guild_id=$1 AND event_type=$2',
      [i.guildId, i.options.getString('event', true)]);
    return void i.reply({ content: 'Disabled.', ephemeral: true });
  }
  if (sub === 'spoiler') {
    const on = i.options.getBoolean('enabled', true);
    await pool.query(`INSERT INTO guild_settings (guild_id, spoiler_logs) VALUES ($1,$2)
      ON CONFLICT (guild_id) DO UPDATE SET spoiler_logs = EXCLUDED.spoiler_logs`, [i.guildId, on]);
    return void i.reply({ content: `Spoiler mode ${on ? 'enabled' : 'disabled'}.`, ephemeral: true });
  }
  if (sub === 'ignore') {
    const target = i.options.getChannel('channel') ?? i.options.getUser('user');
    if (!target) return void i.reply({ content: 'Provide a channel or user.', ephemeral: true });
    const del = await pool.query('DELETE FROM log_ignores WHERE guild_id=$1 AND target_id=$2', [i.guildId, target.id]);
    if (!del.rowCount) await pool.query('INSERT INTO log_ignores (guild_id, target_id) VALUES ($1,$2)', [i.guildId, target.id]);
    return void i.reply({ content: del.rowCount ? 'No longer ignored.' : 'Now ignored.', ephemeral: true });
  }
  if (sub === 'retention') {
    const days = i.options.getInteger('days', true);
    await pool.query(`INSERT INTO guild_settings (guild_id, retention_days) VALUES ($1,$2)
      ON CONFLICT (guild_id) DO UPDATE SET retention_days = EXCLUDED.retention_days`, [i.guildId, days]);
    return void i.reply({ content: `Retention set to ${days} days (applies to new messages).`, ephemeral: true });
  }
}
