import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { AttachmentBuilder, type Attachment } from 'discord.js';
import { config } from './config.js';
import { decrypt, encrypt } from './crypto.js';
import { pool } from './db.js';

// Archives attachments (encrypted at rest) so they survive deletion on Discord's CDN.
export async function archiveAttachments(guildId: string, messageId: string, list: Iterable<Attachment>) {
  for (const a of list) {
    if (a.size > config.maxAttachmentBytes) continue;
    try {
      const res = await fetch(a.url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const dir = join(config.attachmentDir, guildId);
      await mkdir(dir, { recursive: true });
      const path = join(dir, `${a.id}.bin`);
      await writeFile(path, encrypt(buf.toString('base64')));
      await pool.query(
        `INSERT INTO attachments (id, message_id, guild_id, filename, size, path) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [a.id, messageId, guildId, a.name, a.size, path]);
    } catch (e) { console.error('attachment archive failed', e); }
  }
}

export async function loadAttachments(messageIds: string[]): Promise<AttachmentBuilder[]> {
  const { rows } = await pool.query('SELECT filename, path FROM attachments WHERE message_id = ANY($1) LIMIT 10', [messageIds]);
  const out: AttachmentBuilder[] = [];
  for (const r of rows) {
    try { out.push(new AttachmentBuilder(Buffer.from(decrypt(await readFile(r.path)), 'base64'), { name: r.filename })); }
    catch { /* file gone */ }
  }
  return out;
}

export async function purgeAttachmentFiles(where: string, params: unknown[]) {
  const { rows } = await pool.query(`SELECT path FROM attachments WHERE ${where}`, params);
  await Promise.all(rows.map((r) => rm(r.path, { force: true })));
}
