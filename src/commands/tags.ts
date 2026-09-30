import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { pool } from '../db.js';

export const data = new SlashCommandBuilder().setName('tags').setDescription('Reusable message snippets')
  .addSubcommand((s) => s.setName('send').setDescription('Send a tag')
    .addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true).setMaxLength(32)))
  .addSubcommand((s) => s.setName('list').setDescription('List tags'))
  .addSubcommandGroup((g) => g.setName('manage').setDescription('Create or delete tags')
    .addSubcommand((s) => s.setName('create').setDescription('Create or overwrite a tag')
      .addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true).setMaxLength(32))
      .addStringOption((o) => o.setName('content').setDescription('Tag content').setRequired(true).setMaxLength(2000)))
    .addSubcommand((s) => s.setName('delete').setDescription('Delete a tag')
      .addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true))));

export async function execute(i: ChatInputCommandInteraction) {
  const gid = i.guildId!;
  const group = i.options.getSubcommandGroup(false);
  const sub = i.options.getSubcommand();
  if (group === 'manage') {
    if (!i.memberPermissions?.has(PermissionFlagsBits.ManageMessages))
      return void i.reply({ content: 'You need Manage Messages.', ephemeral: true });
    const name = i.options.getString('name', true).toLowerCase();
    if (sub === 'create') {
      await pool.query(`INSERT INTO tags (guild_id, name, content, created_by) VALUES ($1,$2,$3,$4)
        ON CONFLICT (guild_id, name) DO UPDATE SET content = EXCLUDED.content`,
        [gid, name, i.options.getString('content', true), i.user.id]);
      return void i.reply({ content: `Tag \`${name}\` saved.`, ephemeral: true });
    }
    const r = await pool.query('DELETE FROM tags WHERE guild_id=$1 AND name=$2', [gid, name]);
    return void i.reply({ content: r.rowCount ? 'Deleted.' : 'Not found.', ephemeral: true });
  }
  if (sub === 'list') {
    const { rows } = await pool.query('SELECT name FROM tags WHERE guild_id=$1 ORDER BY name', [gid]);
    return void i.reply({ content: rows.length ? rows.map((r) => `\`${r.name}\``).join(', ') : 'No tags yet.', ephemeral: true });
  }
  const { rows } = await pool.query('SELECT content FROM tags WHERE guild_id=$1 AND name=$2',
    [gid, i.options.getString('name', true).toLowerCase()]);
  if (!rows[0]) return void i.reply({ content: 'Tag not found.', ephemeral: true });
  await i.reply({ content: rows[0].content, allowedMentions: { parse: [] } });
}
