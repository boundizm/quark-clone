import { AuditLogEvent, type Client } from 'discord.js';
import { executor } from '../audit.js';
import { log } from '../logger.js';

export function registerMemberEvents(client: Client) {
  client.on('guildMemberAdd', (m) => m.user.bot
    ? log(m.guild, 'bot_add', 'Bot added', 0x1abc9c, [`<@${m.id}> (${m.user.tag})`])
    : log(m.guild, 'member_join', 'Member joined', 0x2ecc71, [`<@${m.id}> (${m.user.tag})`]));

  client.on('guildMemberRemove', async (m) => {
    const kick = await executor(m.guild, AuditLogEvent.MemberKick, m.id);
    if (kick) return log(m.guild, 'kick', 'Member kicked', 0xe67e22, [`<@${m.id}> (${m.user.tag})`, `By: ${kick.by}`, `Reason: ${kick.reason}`]);
    return m.user.bot
      ? log(m.guild, 'bot_remove', 'Bot removed', 0x95a5a6, [`<@${m.id}> (${m.user.tag})`])
      : log(m.guild, 'member_leave', 'Member left', 0x95a5a6, [`<@${m.id}> (${m.user.tag})`]);
  });

  client.on('guildMemberUpdate', async (o, n) => {
    if (o.communicationDisabledUntilTimestamp !== n.communicationDisabledUntilTimestamp) {
      const until = n.communicationDisabledUntilTimestamp;
      const active = !!until && until > Date.now();
      const t = await executor(n.guild, AuditLogEvent.MemberUpdate, n.id);
      await log(n.guild, 'timeout', active ? 'Member timed out' : 'Timeout removed', 0xd35400, [
        `<@${n.id}>`, ...(active ? [`Until: <t:${Math.floor(until! / 1000)}:f>`] : []),
        `By: ${t?.by ?? 'unknown'}`, `Reason: ${t?.reason ?? 'none'}`]);
    }
    if (o.nickname !== n.nickname) {
      const t = await executor(n.guild, AuditLogEvent.MemberUpdate, n.id);
      await log(n.guild, 'nickname_update', 'Nickname changed', 0x3498db, [
        `<@${n.id}>`, `\`${o.nickname ?? '—'}\` → \`${n.nickname ?? '—'}\``, ...(t ? [`By: ${t.by}`] : [])]);
    }
    const added = n.roles.cache.filter((r) => !o.roles.cache.has(r.id));
    const removed = o.roles.cache.filter((r) => !n.roles.cache.has(r.id));
    if (added.size || removed.size) {
      const t = await executor(n.guild, AuditLogEvent.MemberRoleUpdate, n.id);
      const by = t ? [`By: ${t.by}`] : [];
      if (added.size) await log(n.guild, 'role_add', 'Role(s) given', 0x2ecc71, [`<@${n.id}>`, added.map((r) => `<@&${r.id}>`).join(' '), ...by]);
      if (removed.size) await log(n.guild, 'role_remove', 'Role(s) removed', 0xe74c3c, [`<@${n.id}>`, removed.map((r) => `<@&${r.id}>`).join(' '), ...by]);
    }
    if (o.avatar !== n.avatar) await log(n.guild, 'avatar_update', 'Server avatar changed', 0x9b59b6, [`<@${n.id}>`, n.avatarURL() ?? 'removed']);
  });

  client.on('guildBanAdd', async (ban) => {
    const b = await executor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    return log(ban.guild, 'ban', 'Member banned', 0xc0392b, [ban.user.tag, `By: ${b?.by ?? 'unknown'}`, `Reason: ${b?.reason ?? 'none'}`]);
  });
  client.on('guildBanRemove', async (ban) => {
    const b = await executor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    return log(ban.guild, 'unban', 'Member unbanned', 0x27ae60, [ban.user.tag, `By: ${b?.by ?? 'unknown'}`]);
  });
}
