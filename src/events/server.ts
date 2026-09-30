import { AuditLogEvent, type Client, type Guild, type GuildAuditLogsEntry } from 'discord.js';
import { executor } from '../audit.js';
import { log, type LogEventType } from '../logger.js';

const ex = async (g: Guild, ev: AuditLogEvent, id?: string) => {
  const a = await executor(g, ev, id);
  return a ? [`By: ${a.by}`, `Reason: ${a.reason}`] : [];
};

export function registerServerEvents(client: Client) {
  // Roles
  client.on('roleCreate', async (r) => log(r.guild, 'role_create', 'Role created', 0x2ecc71, [`${r.name} (${r.id})`, ...await ex(r.guild, AuditLogEvent.RoleCreate, r.id)]));
  client.on('roleDelete', async (r) => log(r.guild, 'role_delete', 'Role deleted', 0xe74c3c, [`${r.name} (${r.id})`, ...await ex(r.guild, AuditLogEvent.RoleDelete, r.id)]));
  client.on('roleUpdate', async (o, n) => {
    const c: string[] = [];
    if (o.name !== n.name) c.push(`Name: \`${o.name}\` → \`${n.name}\``);
    if (o.color !== n.color) c.push(`Color: #${o.color.toString(16)} → #${n.color.toString(16)}`);
    if (o.hoist !== n.hoist) c.push(`Hoisted: ${o.hoist} → ${n.hoist}`);
    if (o.mentionable !== n.mentionable) c.push(`Mentionable: ${o.mentionable} → ${n.mentionable}`);
    const added = n.permissions.missing(o.permissions), removed = o.permissions.missing(n.permissions);
    if (added.length) c.push(`Permissions removed: ${added.join(', ')}`);
    if (removed.length) c.push(`Permissions added: ${removed.join(', ')}`);
    if (c.length) await log(n.guild, 'role_update', 'Role updated', 0x3498db, [`<@&${n.id}>`, ...c, ...await ex(n.guild, AuditLogEvent.RoleUpdate, n.id)]);
  });

  // Channels
  client.on('channelCreate', async (c) => log(c.guild, 'channel_create', 'Channel created', 0x2ecc71, [`<#${c.id}> (${c.name})`, ...await ex(c.guild, AuditLogEvent.ChannelCreate, c.id)]));
  client.on('channelDelete', async (c) => { if (!c.isDMBased()) await log(c.guild, 'channel_delete', 'Channel deleted', 0xe74c3c, [`#${c.name} (${c.id})`, ...await ex(c.guild, AuditLogEvent.ChannelDelete, c.id)]); });
  client.on('channelUpdate', async (o, n) => {
    if (n.isDMBased() || o.isDMBased()) return;
    const c: string[] = [];
    if (o.name !== n.name) c.push(`Name: \`${o.name}\` → \`${n.name}\``);
    if ('topic' in o && 'topic' in n && o.topic !== n.topic) c.push(`Topic: \`${o.topic ?? '—'}\` → \`${n.topic ?? '—'}\``);
    if ('nsfw' in o && 'nsfw' in n && o.nsfw !== n.nsfw) c.push(`NSFW: ${o.nsfw} → ${n.nsfw}`);
    if ('rateLimitPerUser' in o && 'rateLimitPerUser' in n && o.rateLimitPerUser !== n.rateLimitPerUser) c.push(`Slowmode: ${o.rateLimitPerUser}s → ${n.rateLimitPerUser}s`);
    if (o.parentId !== n.parentId) c.push(`Category: ${o.parentId ? `<#${o.parentId}>` : '—'} → ${n.parentId ? `<#${n.parentId}>` : '—'}`);
    if (c.length) await log(n.guild, 'channel_update', 'Channel updated', 0x3498db, [`<#${n.id}>`, ...c, ...await ex(n.guild, AuditLogEvent.ChannelUpdate, n.id)]);
  });
  client.on('webhooksUpdate', async (ch) => log(ch.guild, 'webhook_update', 'Webhooks changed', 0xf39c12, [`In <#${ch.id}>`, ...await ex(ch.guild, AuditLogEvent.WebhookUpdate)]));

  // Server
  client.on('guildUpdate', async (o, n) => {
    const c: string[] = [];
    if (o.name !== n.name) c.push(`Name: \`${o.name}\` → \`${n.name}\``);
    if (o.verificationLevel !== n.verificationLevel) c.push(`Verification level: ${o.verificationLevel} → ${n.verificationLevel}`);
    if (o.afkChannelId !== n.afkChannelId) c.push('AFK channel changed');
    if (o.systemChannelId !== n.systemChannelId) c.push('System channel changed');
    if (c.length) await log(n, 'server_update', 'Server updated', 0x3498db, [...c, ...await ex(n, AuditLogEvent.GuildUpdate)]);
    if (o.icon !== n.icon) await log(n, 'server_icon', 'Server icon changed', 0x9b59b6, [n.iconURL() ?? 'removed', ...await ex(n, AuditLogEvent.GuildUpdate)]);
    if (o.premiumSubscriptionCount !== n.premiumSubscriptionCount)
      await log(n, 'server_boost', 'Boost count changed', 0xff73fa, [`${o.premiumSubscriptionCount ?? 0} → ${n.premiumSubscriptionCount ?? 0} (tier ${n.premiumTier})`]);
  });

  // Actions
  client.on('emojiCreate', async (e) => log(e.guild, 'emoji_create', 'Emoji created', 0x2ecc71, [`${e.name} (${e.id})`, ...await ex(e.guild, AuditLogEvent.EmojiCreate, e.id)]));
  client.on('emojiUpdate', async (o, n) => log(n.guild, 'emoji_update', 'Emoji updated', 0x3498db, [`\`${o.name}\` → \`${n.name}\``, ...await ex(n.guild, AuditLogEvent.EmojiUpdate, n.id)]));
  client.on('emojiDelete', async (e) => log(e.guild, 'emoji_delete', 'Emoji deleted', 0xe74c3c, [`${e.name} (${e.id})`, ...await ex(e.guild, AuditLogEvent.EmojiDelete, e.id)]));
  client.on('inviteCreate', (i) => i.guild && 'channels' in i.guild ? log(i.guild as Guild, 'invite_create', 'Invite created', 0x2ecc71, [`\`${i.code}\` → <#${i.channelId}>`, `By: ${i.inviter ? `<@${i.inviter.id}>` : 'unknown'}`]) : undefined);
  client.on('inviteDelete', (i) => i.guild && 'channels' in i.guild ? log(i.guild as Guild, 'invite_delete', 'Invite deleted', 0xe74c3c, [`\`${i.code}\``]) : undefined);
  client.on('guildScheduledEventCreate', (e) => e.guild && log(e.guild, 'event_create', 'Event created', 0x2ecc71, [`${e.name}`, e.creatorId ? `By: <@${e.creatorId}>` : '']));
  client.on('guildScheduledEventUpdate', (_o, e) => e.guild && log(e.guild, 'event_update', 'Event updated', 0x3498db, [`${e.name} (status ${e.status})`]));
  client.on('guildScheduledEventDelete', (e) => e.guild && log(e.guild, 'event_delete', 'Event deleted', 0xe74c3c, [`${e.name}`]));

  // Audit-log-only events: prune + channel permission overwrites
  client.on('guildAuditLogEntryCreate', (e: GuildAuditLogsEntry, guild: Guild) => {
    const by = e.executorId ? `By: <@${e.executorId}>` : 'By: unknown';
    const map: Partial<Record<AuditLogEvent, [LogEventType, string]>> = {
      [AuditLogEvent.MemberPrune]: ['members_prune', 'Members pruned'],
      [AuditLogEvent.ChannelOverwriteCreate]: ['perms_add', 'Channel permissions added'],
      [AuditLogEvent.ChannelOverwriteUpdate]: ['perms_update', 'Channel permissions changed'],
      [AuditLogEvent.ChannelOverwriteDelete]: ['perms_remove', 'Channel permissions removed'],
    };
    const hit = map[e.action];
    if (!hit) return;
    const extra = e.action === AuditLogEvent.MemberPrune
      ? [`Removed: ${(e.extra as { removed?: number })?.removed ?? '?'}`]
      : [`Channel: <#${e.targetId}>`];
    return log(guild, hit[0], hit[1], 0xf39c12, [...extra, by]);
  });
}
