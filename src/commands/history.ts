import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { decrypt } from '../crypto.js';
import { pool } from '../db.js';

export const data = new SlashCommandBuilder().setName('history').setDescription('Show edit history of a logged message')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption((o) => o.setName('message_id').setDescription('Message ID').setRequired(true));

export async function execute(i: ChatInputCommandInteraction) {
  const id = i.options.getString('message_id', true);
  const cur = await pool.query('SELECT content_enc FROM messages WHERE id=$1 AND guild_id=$2', [id, i.guildId]);
  if (!cur.rows[0]) return void i.reply({ content: 'Message not found (expired or not logged).', ephemeral: true });
  const { rows } = await pool.query('SELECT content_enc, edited_at FROM message_edits WHERE message_id=$1 ORDER BY edited_at', [id]);
  const lines = [...rows.map((r, n) => `**v${n + 1}** (<t:${Math.floor(r.edited_at.getTime() / 1000)}:R>): ${decrypt(r.content_enc).slice(0, 300)}`),
    `**current**: ${decrypt(cur.rows[0].content_enc).slice(0, 300)}`];
  await i.reply({ content: lines.join('\n').slice(0, 1990), ephemeral: true, allowedMentions: { parse: [] } });
}
