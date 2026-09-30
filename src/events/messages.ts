import { EmbedBuilder, type Client, type Message, type PartialMessage } from 'discord.js';
import { config } from '../config.js';
import { decrypt, encrypt } from '../crypto.js';
import { pool } from '../db.js';
import { sendLog } from '../logger.js';

async function retentionDays(guildId: string): Promise<number> {
  const { rows } = await pool.query('SELECT retention_days FROM guild_settings WHERE guild_id = $1', [guildId]);
  return rows[0]?.retention_days ?? config.defaultRetentionDays;
}

export function registerMessageEvents(client: Client) {
  client.on('messageCreate', async (msg: Message) => {
    if (!msg.guild || msg.author.bot) return;
    const days = await retentionDays(msg.guild.id);
    const content = [msg.content, ...msg.attachments.map((a) => a.url)].join('\n');
    await pool.query(
      `INSERT INTO messages (id, guild_id, channel_id, author_id, content_enc, expires_at)
       VALUES ($1,$2,$3,$4,$5, now() + ($6 || ' days')::interval)
       ON CONFLICT (id) DO NOTHING`,
      [msg.id, msg.guild.id, msg.channelId, msg.author.id, encrypt(content), String(days)],
    );
  });

  client.on('messageUpdate', async (oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage) => {
    if (!newMsg.guild || newMsg.author?.bot || newMsg.content == null) return;
    const { rows } = await pool.query('SELECT content_enc FROM messages WHERE id = $1', [newMsg.id]);
    if (!rows[0]) return;
    const before = decrypt(rows[0].content_enc);
    if (before === newMsg.content) return;
    await pool.query('INSERT INTO message_edits (message_id, content_enc) VALUES ($1,$2)', [newMsg.id, encrypt(newMsg.content)]);
    await pool.query('UPDATE messages SET content_enc = $2 WHERE id = $1', [newMsg.id, encrypt(newMsg.content)]);
    await sendLog(newMsg.guild, 'message_edit', new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('Message edited')
      .setDescription(`<@${newMsg.author?.id}> in <#${newMsg.channelId}> — [jump](${newMsg.url})`)
      .addFields(
        { name: 'Before', value: before.slice(0, 1024) || '—' },
        { name: 'After', value: newMsg.content.slice(0, 1024) || '—' },
      ));
  });

  client.on('messageDelete', async (msg: Message | PartialMessage) => {
    if (!msg.guild) return;
    const { rows } = await pool.query('SELECT author_id, content_enc FROM messages WHERE id = $1', [msg.id]);
    if (!rows[0]) return;
    const content = decrypt(rows[0].content_enc);
    await pool.query('DELETE FROM messages WHERE id = $1', [msg.id]);
    await sendLog(msg.guild, 'message_delete', new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('Message deleted')
      .setDescription(`<@${rows[0].author_id}> in <#${msg.channelId}>`)
      .addFields({ name: 'Content', value: content.slice(0, 1024) || '—' }));
  });
}

// Periodic cleanup of expired messages (retention)
export function startRetentionJob() {
  setInterval(() => {
    pool.query('DELETE FROM messages WHERE expires_at < now()').catch(console.error);
  }, 60 * 60 * 1000).unref();
}
