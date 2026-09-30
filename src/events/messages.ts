import { AttachmentBuilder, AuditLogEvent, EmbedBuilder, type Client, type Message, type PartialMessage } from 'discord.js';
import { archiveAttachments, loadAttachments, purgeAttachmentFiles } from '../attachments.js';
import { executor } from '../audit.js';
import { config } from '../config.js';
import { decrypt, encrypt } from '../crypto.js';
import { pool } from '../db.js';
import { isIgnored, log, sendLog } from '../logger.js';

async function retentionDays(guildId: string): Promise<number> {
  const { rows } = await pool.query('SELECT retention_days FROM guild_settings WHERE guild_id = $1', [guildId]);
  return rows[0]?.retention_days ?? config.defaultRetentionDays;
}

export function registerMessageEvents(client: Client) {
  client.on('messageCreate', async (msg: Message) => {
    if (!msg.guild || msg.author.bot) return;
    if (await isIgnored(msg.guild.id, msg.channelId, msg.author.id)) return;
    const days = await retentionDays(msg.guild.id);
    await pool.query(
      `INSERT INTO messages (id, guild_id, channel_id, author_id, content_enc, expires_at)
       VALUES ($1,$2,$3,$4,$5, now() + ($6 || ' days')::interval) ON CONFLICT (id) DO NOTHING`,
      [msg.id, msg.guild.id, msg.channelId, msg.author.id, encrypt(msg.content), String(days)]);
    if (msg.attachments.size) await archiveAttachments(msg.guild.id, msg.id, msg.attachments.values());
  });

  client.on('messageUpdate', async (o: Message | PartialMessage, n: Message | PartialMessage) => {
    if (!n.guild || n.author?.bot) return;
    if (o.pinned !== null && n.pinned !== null && o.pinned !== n.pinned) {
      await log(n.guild, n.pinned ? 'message_pin' : 'message_unpin', n.pinned ? 'Message pinned' : 'Message unpinned', 0xf1c40f, [`[Jump](${n.url}) in <#${n.channelId}>`]);
    }
    if (n.content == null) return;
    const { rows } = await pool.query('SELECT content_enc FROM messages WHERE id = $1', [n.id]);
    if (!rows[0]) return;
    const before = decrypt(rows[0].content_enc);
    if (before === n.content) return;
    await pool.query('INSERT INTO message_edits (message_id, content_enc) VALUES ($1,$2)', [n.id, rows[0].content_enc]); // keep previous version
    await pool.query('UPDATE messages SET content_enc = $2 WHERE id = $1', [n.id, encrypt(n.content)]);
    await sendLog(n.guild, 'message_edit', new EmbedBuilder().setColor(0xf1c40f).setTitle('Message edited')
      .setDescription(`<@${n.author?.id}> in <#${n.channelId}> — [jump](${n.url})`)
      .addFields({ name: 'Before', value: before.slice(0, 1024) || '—' }, { name: 'After', value: n.content.slice(0, 1024) || '—' }));
  });

  client.on('messageDelete', async (msg: Message | PartialMessage) => {
    if (!msg.guild) return;
    if (msg.poll) {
      await log(msg.guild, 'poll_delete', 'Poll deleted', 0xe74c3c, [`${msg.poll.question.text ?? 'poll'} in <#${msg.channelId}>`]);
    }
    const { rows } = await pool.query('SELECT author_id, content_enc FROM messages WHERE id = $1', [msg.id]);
    if (!rows[0]) return;
    const content = decrypt(rows[0].content_enc);
    const files = await loadAttachments([msg.id]);
    const a = await executor(msg.guild, AuditLogEvent.MessageDelete, rows[0].author_id);
    await sendLog(msg.guild, 'message_delete', new EmbedBuilder().setColor(0xe74c3c).setTitle('Message deleted')
      .setDescription(`<@${rows[0].author_id}> in <#${msg.channelId}>${a ? `\nDeleted by: ${a.by}` : ''}`)
      .addFields({ name: 'Content', value: content.slice(0, 1024) || '—' }), files);
    await purgeAttachmentFiles('message_id = $1', [msg.id]);
    await pool.query('DELETE FROM messages WHERE id = $1', [msg.id]);
  });

  client.on('messageDeleteBulk', async (msgs, channel) => {
    const ids = [...msgs.keys()];
    const { rows } = await pool.query('SELECT id, author_id, content_enc, created_at FROM messages WHERE id = ANY($1) ORDER BY created_at', [ids]);
    const text = rows.map((r) => `[${r.created_at.toISOString()}] ${r.author_id}: ${decrypt(r.content_enc)}`).join('\n') || '(no stored content)';
    await sendLog(channel.guild, 'message_bulk_delete', new EmbedBuilder().setColor(0xc0392b).setTitle('Messages bulk deleted')
      .setDescription(`${ids.length} messages in <#${channel.id}> (${rows.length} archived)`),
      [new AttachmentBuilder(Buffer.from(text), { name: 'deleted-messages.txt' })]);
    await purgeAttachmentFiles('message_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM messages WHERE id = ANY($1)', [ids]);
  });

  client.on('messageReactionRemove', async (r, user) => {
    const m = r.message;
    if (!m.guild || user.bot) return;
    await log(m.guild, 'reaction_remove', 'Reaction removed', 0x95a5a6, [`${r.emoji.toString()} by <@${user.id}> on [message](${m.url}) in <#${m.channelId}>`]);
  });

  client.on('threadCreate', (t) => log(t.guild, 'thread_create', 'Thread created', 0x2ecc71, [`<#${t.id}> in <#${t.parentId}>`]));
  client.on('threadUpdate', (o, n) => {
    const c: string[] = [];
    if (o.name !== n.name) c.push(`Name: \`${o.name}\` → \`${n.name}\``);
    if (o.archived !== n.archived) c.push(`Archived: ${o.archived} → ${n.archived}`);
    if (o.locked !== n.locked) c.push(`Locked: ${o.locked} → ${n.locked}`);
    if (c.length) return log(n.guild, 'thread_update', 'Thread updated', 0x3498db, [`<#${n.id}>`, ...c]);
  });
  client.on('threadDelete', (t) => log(t.guild, 'thread_delete', 'Thread deleted', 0xe74c3c, [`${t.name} (${t.id})`]));
}

// Hourly retention cleanup (attachments first, then rows)
export function startRetentionJob() {
  setInterval(async () => {
    try {
      await purgeAttachmentFiles('message_id IN (SELECT id FROM messages WHERE expires_at < now())', []);
      await pool.query('DELETE FROM messages WHERE expires_at < now()');
    } catch (e) { console.error(e); }
  }, 60 * 60 * 1000).unref();
}
