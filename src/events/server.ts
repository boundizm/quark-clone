import { AuditLogEvent, EmbedBuilder, type Client, type Guild } from 'discord.js';
import { executor } from '../audit.js';
import { sendLog, type LogEventType } from '../logger.js';

async function log(guild: Guild, type: LogEventType, title: string, color: number, lines: string[], audit?: AuditLogEvent, targetId?: string) {
  const a = audit !== undefined ? await executor(guild, audit, targetId) : null;
  if (a) lines.push(`By: ${a.by}`, `Reason: ${a.reason}`);
  await sendLog(guild, type, new EmbedBuilder().setColor(color).setTitle(title).setDescription(lines.join('\n')));
}

export function registerServerEvents(client: Client) {
  // Roles
  client.on('roleCreate', (r) => log(r.guild, 'role', 'Role created', 0x2ecc71, [`${r.name} (${r.id})`], AuditLogEvent.RoleCreate, r.id));
  client.on('roleDelete', (r) => log(r.guild, 'role', 'Role deleted', 0xe74c3c, [`${r.name} (${r.id})`], AuditLogEvent.RoleDelete, r.id));
  client.on('roleUpdate', (o, n) => {
    const c: string[] = [];
    if (o.name !== n.name) c.push(`Name: \`${o.name}\` → \`${n.name}\``);
    if (o.color !== n.color) c.push(`Color: #${o.color.toString(16)} → #${n.color.toString(16)}`);
    if (o.hoist !== n.hoist) c.push(`Hoisted: ${o.hoist} → ${n.hoist}`);
    if (o.mentionable !== n.mentionable) c.push(`Mentionable: ${o.mentionable} → ${n.mentionable}`);
    if (!o.permissions.equals(n.permissions)) c.push('Permissions changed');
    if (c.length) return log(n.guild, 'role', 'Role updated', 0x3498db, [`<@&${n.id}>`, ...c], AuditLogEvent.RoleUpdate, n.id);
  });

  // Channels
  client.on('channelCreate', (c) => log(c.guild, 'channel', 'Channel created', 0x2ecc71, [`<#${c.id}> (${c.name})`], AuditLogEvent.ChannelCreate, c.id));
  client.on('channelDelete', (c) => { if (!c.isDMBased()) return log(c.guild, 'channel', 'Channel deleted', 0xe74c3c, [`#${c.name} (${c.id})`], AuditLogEvent.ChannelDelete, c.id); });
  client.on('channelUpdate', (o, n) => {
    if (n.isDMBased() || o.isDMBased()) return;
    const c: string[] = [];
    if (o.name !== n.name) c.push(`Name: \`${o.name}\` → \`${n.name}\``);
    if ('topic' in o && 'topic' in n && o.topic !== n.topic) c.push(`Topic: \`${o.topic ?? '—'}\` → \`${n.topic ?? '—'}\``);
    if ('nsfw' in o && 'nsfw' in n && o.nsfw !== n.nsfw) c.push(`NSFW: ${o.nsfw} → ${n.nsfw}`);
    if ('rateLimitPerUser' in o && 'rateLimitPerUser' in n && o.rateLimitPerUser !== n.rateLimitPerUser) c.push(`Slowmode: ${o.rateLimitPerUser}s → ${n.rateLimitPerUser}s`);
    if (!c.length) return;
    return log(n.guild, 'channel', 'Channel updated', 0x3498db, [`<#${n.id}>`, ...c], AuditLogEvent.ChannelUpdate, n.id);
  });

  // Webhooks, server, emojis, invites, threads
  client.on('webhooksUpdate', (ch) => log(ch.guild, 'webhook', 'Webhooks changed', 0xf39c12, [`In <#${ch.id}>`], AuditLogEvent.WebhookUpdate));
  client.on('guildUpdate', (o, n) => {
    const c: string[] = [];
    if (o.name !== n.name) c.push(`Name: \`${o.name}\` → \`${n.name}\``);
    if (o.verificationLevel !== n.verificationLevel) c.push(`Verification level: ${o.verificationLevel} → ${n.verificationLevel}`);
    if (o.afkChannelId !== n.afkChannelId) c.push('AFK channel changed');
    if (o.systemChannelId !== n.systemChannelId) c.push('System channel changed');
    if (o.icon !== n.icon) c.push('Icon changed');
    if (c.length) return log(n, 'server', 'Server updated', 0x3498db, c, AuditLogEvent.GuildUpdate);
  });
  client.on('emojiCreate', (e) => log(e.guild, 'emoji', 'Emoji created', 0x2ecc71, [`${e.name} (${e.id})`], AuditLogEvent.EmojiCreate, e.id));
  client.on('emojiDelete', (e) => log(e.guild, 'emoji', 'Emoji deleted', 0xe74c3c, [`${e.name} (${e.id})`], AuditLogEvent.EmojiDelete, e.id));
  client.on('inviteCreate', (i) => { if (i.guild && 'fetchAuditLogs' in i.guild) return log(i.guild as Guild, 'invite', 'Invite created', 0x2ecc71, [`\`${i.code}\` → <#${i.channelId}>`, `Created by: ${i.inviter ? `<@${i.inviter.id}>` : 'unknown'}`]); });
  client.on('inviteDelete', (i) => { if (i.guild && 'fetchAuditLogs' in i.guild) return log(i.guild as Guild, 'invite', 'Invite deleted', 0xe74c3c, [`\`${i.code}\``]); });
  client.on('threadCreate', (t) => log(t.guild, 'thread', 'Thread created', 0x2ecc71, [`<#${t.id}> in <#${t.parentId}>`]));
  client.on('threadDelete', (t) => log(t.guild, 'thread', 'Thread deleted', 0xe74c3c, [`${t.name} (${t.id})`]));
}
