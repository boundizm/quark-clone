import {
  ChannelType, PermissionFlagsBits, SlashCommandBuilder,
  type AutocompleteInteraction, type ChatInputCommandInteraction,
} from 'discord.js';
import { pool } from '../db.js';
import { limitsFor } from '../tiers.js';
import { ALL_TYPES, CATEGORIES, isValidTarget, log } from '../logger.js';

const targets = [...CATEGORIES, ...ALL_TYPES];
const eventOpt = (o: any) => o.setName('event').setDescription('Category (e.g. members) or single type (e.g. role_add)')
  .setRequired(true).setAutocomplete(true);
const channelOpt = (o: any) => o.setName('channel').setDescription('Target channel').setRequired(true)
  .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

export const data = new SlashCommandBuilder()
  .setName('logging')
  .setDescription('Configure log channels')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) => s.setName('set').setDescription('Send a category or event type to a channel')
    .addStringOption(eventOpt).addChannelOption(channelOpt))
  .addSubcommand((s) => s.setName('all').setDescription('Send every category to one channel')
    .addChannelOption(channelOpt))
  .addSubcommand((s) => s.setName('disable').setDescription('Stop logging a category or event type')
    .addStringOption(eventOpt))
  .addSubcommand((s) => s.setName('show').setDescription('Show current configuration'))
  .addSubcommand((s) => s.setName('spoiler').setDescription('Hide log contents behind spoilers')
    .addBooleanOption((o) => o.setName('enabled').setDescription('On/off').setRequired(true)))
  .addSubcommand((s) => s.setName('ignore').setDescription('Toggle ignoring a channel or user')
    .addChannelOption((o) => o.setName('channel').setDescription('Channel to ignore'))
    .addUserOption((o) => o.setName('user').setDescription('User to ignore')))
  .addSubcommand((s) => s.setName('retention').setDescription('Set message retention in days')
    .addIntegerOption((o) => o.setName('days').setDescription('1-30').setMinValue(1).setMaxValue(30).setRequired(true)));

const upsert = `INSERT INTO log_channels (guild_id, event_type, channel_id) VALUES ($1,$2,$3)
  ON CONFLICT (guild_id, event_type) DO UPDATE SET channel_id = EXCLUDED.channel_id`;

export async function autocomplete(i: AutocompleteInteraction) {
  const q = i.options.getFocused().toLowerCase();
  await i.respond(targets.filter((t) => t.includes(q)).slice(0, 25).map((t) => ({ name: t, value: t })));
}

export async function execute(i: ChatInputCommandInteraction) {
  const gid = i.guildId!;
  const sub = i.options.getSubcommand();
  const reply = (content: string) => i.reply({ content, ephemeral: true });
  const audit = (what: string) => log(i.guild!, 'config_update', 'Configuration changed', 0x7f8c8d, [`<@${i.user.id}>`, what]);

  if (sub === 'set' || sub === 'disable') {
    const ev = i.options.getString('event', true);
    if (!isValidTarget(ev)) return reply('Unknown event or category.');
    if (sub === 'set') {
      const ch = i.options.getChannel('channel', true);
      await pool.query(upsert, [gid, ev, ch.id]);
      await audit(`\`${ev}\` → <#${ch.id}>`);
      return reply(`\`${ev}\` now logs to <#${ch.id}>.`);
    }
    await pool.query('DELETE FROM log_channels WHERE guild_id=$1 AND event_type=$2', [gid, ev]);
    await audit(`\`${ev}\` disabled`);
    return reply(`\`${ev}\` disabled.`);
  }
  if (sub === 'all') {
    const ch = i.options.getChannel('channel', true);
    for (const c of CATEGORIES) await pool.query(upsert, [gid, c, ch.id]);
    await audit(`all categories → <#${ch.id}>`);
    return reply(`All categories now log to <#${ch.id}>.`);
  }
  if (sub === 'show') {
    const { rows } = await pool.query('SELECT event_type, channel_id FROM log_channels WHERE guild_id=$1 ORDER BY event_type', [gid]);
    return reply(rows.length ? rows.map((r) => `\`${r.event_type}\` → <#${r.channel_id}>`).join('\n') : 'Nothing configured. Try `/logging all`.');
  }
  if (sub === 'spoiler') {
    const on = i.options.getBoolean('enabled', true);
    await pool.query(`INSERT INTO guild_settings (guild_id, spoiler_logs) VALUES ($1,$2)
      ON CONFLICT (guild_id) DO UPDATE SET spoiler_logs = EXCLUDED.spoiler_logs`, [gid, on]);
    await audit(`spoiler ${on ? 'on' : 'off'}`);
    return reply(`Spoiler mode ${on ? 'enabled' : 'disabled'}.`);
  }
  if (sub === 'ignore') {
    const target = i.options.getChannel('channel') ?? i.options.getUser('user');
    if (!target) return reply('Provide a channel or user.');
    const del = await pool.query('DELETE FROM log_ignores WHERE guild_id=$1 AND target_id=$2', [gid, target.id]);
    if (!del.rowCount) {
      const n = await pool.query('SELECT count(*)::int AS c FROM log_ignores WHERE guild_id=$1', [gid]);
      if (n.rows[0].c >= (await limitsFor(gid)).maxIgnores) return reply('Ignore list limit reached for your plan.');
    }
    if (!del.rowCount) await pool.query('INSERT INTO log_ignores (guild_id, target_id) VALUES ($1,$2)', [gid, target.id]);
    await audit(`${del.rowCount ? 'unignored' : 'ignored'} ${target.id}`);
    return reply(del.rowCount ? 'No longer ignored.' : 'Now ignored.');
  }
  const days = i.options.getInteger('days', true);
  const lim = await limitsFor(gid);
  if (days > lim.maxRetentionDays) return reply(`The maximum retention is ${lim.maxRetentionDays} days.`);
  await pool.query(`INSERT INTO guild_settings (guild_id, retention_days) VALUES ($1,$2)
    ON CONFLICT (guild_id) DO UPDATE SET retention_days = EXCLUDED.retention_days`, [gid, days]);
  await audit(`retention ${days}d`);
  return reply(`Retention set to ${days} days (applies to new messages).`);
}
