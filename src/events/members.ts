import { EmbedBuilder, type Client } from 'discord.js';
import { sendLog } from '../logger.js';

export function registerMemberEvents(client: Client) {
  client.on('guildMemberAdd', (m) =>
    sendLog(m.guild, 'member_join', new EmbedBuilder().setColor(0x2ecc71).setTitle('Member joined')
      .setDescription(`<@${m.id}> (${m.user.tag})`)));

  client.on('guildMemberRemove', (m) =>
    sendLog(m.guild, 'member_leave', new EmbedBuilder().setColor(0x95a5a6).setTitle('Member left')
      .setDescription(`<@${m.id}> (${m.user.tag})`)));

  client.on('guildMemberUpdate', (oldM, newM) => {
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
    const b = await ban.fetch().catch(() => ban);
    return sendLog(ban.guild, 'ban', new EmbedBuilder().setColor(0xc0392b).setTitle('Member banned')
      .setDescription(`${ban.user.tag}\nReason: ${b.reason ?? 'none'}`));
  });

  client.on('guildBanRemove', (ban) =>
    sendLog(ban.guild, 'unban', new EmbedBuilder().setColor(0x27ae60).setTitle('Member unbanned')
      .setDescription(ban.user.tag)));
}
