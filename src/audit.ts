import type { AuditLogEvent, Guild } from 'discord.js';

// Finds the moderator behind a recent action via the audit log.
export async function executor(guild: Guild, type: AuditLogEvent, targetId?: string) {
  const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
  const e = logs?.entries.find((x) =>
    (!targetId || x.targetId === targetId) && Date.now() - x.createdTimestamp < 15_000);
  return e ? { by: e.executorId ? `<@${e.executorId}>` : 'unknown', reason: e.reason ?? 'none' } : null;
}
