import { AuditLogEvent, EmbedBuilder, type Client, type Guild } from 'discord.js';
import { sendLog } from '../logger.js';

async function executor(guild: Guild, type: AuditLogEvent, targetId: string) {
  const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
  const e = logs?.entries.find((x) => x.targetId === targetId && Date.now() - x.createdTimestamp < 15_000);
  return e ? { by: e.executorId ? `<@${e.executorId}>` : 'unknown', reason: e.reason ?? 'none' } : null;
}

export function registerMemberEvents(client: Client) {
  client.on('guildMemberAdd', (m) =>
    sendLog(m.guild, 'member_join', new EmbedBuilder().setColor(0x2ecc71).setTitle('Member joined')
      .setDescription(`<@${m.id}> (${m.user.tag})`)));

  client.on('guildMemberRemove', async (m) => {
    const kick = await executor(m.guild, AuditLogEvent.MemberKick, m.id);
    if (kick) {
      return sendLog(m.guild, 'kick', new EmbedBuilder().setColor(0xe67e22).setTitle('Member kicked')
        .setDescription(`<@${m.id}> (${m.user.tag})\nBy: ${kick.by}\nReason: ${kick.reason}`));
    }
    return sendLog(m.guild, 'member_leave', new EmbedBuilder().setColor(0x95a5a6).setTitle('Member left')
      .setDescription(`<@${m.id}> (${m.user.tag})`));
  });

  client.on('guildMemberUpdate', async (oldM, newM) => {
    if (oldM.communicationDisabledUntilTimestamp !== newM.communicationDisabledUntilTimestamp) {
      const until = newM.communicationDisabledUntilTimestamp;
      const t = await executor(newM.guild, AuditLogEvent.MemberUpdate, newM.id);
      await sendLog(newM.guild, 'timeout', new EmbedBuilder().setColor(0xd35400)
        .setTitle(until && until > Date.now() ? 'Member timed out' : 'Timeout removed')
        .setDescription(`<@${newM.id}>${until && until > Date.now() ? `\nUntil: <t:${Math.floor(until / 1000)}:f>` : ''}\nBy: ${t?.by ?? 'unknown'}\nReason: ${t?.reason ?? 'none'}`));
    }
    const changes: string[] = [];
    if (oldM.nickname !== newM.nickname) changes.push(`Nickname: \`${oldM.nickname ?? '—'}\` → \`${newM.nickname ?? '—'}\``);
    const added = newM.roles.cache.filter((r) => !oldM.roles.cache.has(r.id));
    const removed = oldM.roles.cache.filter((r) => !newM.roles.cache.has(r.id));
    if (added.size) changes.push(`Roles added: ${added.map((r) => r.name).join(', ')}`);
    if (removed.size) changes.push(`Roles removed: ${removed.map((r) => r.name).join(', ')}`);
    if (!changes.length) return;
    return sendLog(newM.guild, 'member_update', new EmbedBuilder().setColor(0x3498db)
      .setTitle('Member updated').setDescription(`<@${newM.id}>\n${changes.join('\n')}`));
  });

  client.on('guildBanAdd', async (ban) => {
    const b = await executor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    return sendLog(ban.guild, 'ban', new EmbedBuilder().setColor(0xc0392b).setTitle('Member banned')
      .setDescription(`${ban.user.tag}\nBy: ${b?.by ?? 'unknown'}\nReason: ${b?.reason ?? 'none'}`));
  });

  client.on('guildBanRemove', (ban) =>
    sendLog(ban.guild, 'unban', new EmbedBuilder().setColor(0x27ae60).setTitle('Member unbanned')
      .setDescription(ban.user.tag)));
}
