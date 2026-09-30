import type { Client } from 'discord.js';
import { log, type LogEventType } from '../logger.js';

export function registerVoiceEvents(client: Client) {
  client.on('voiceStateUpdate', async (o, n) => {
    const g = n.guild;
    const u = `<@${n.id}>`;
    const tasks: Promise<unknown>[] = [];
    const flag = (before: boolean | null, after: boolean | null, on: LogEventType, off: LogEventType, label: string) => {
      if (!!before === !!after) return;
      tasks.push(log(g, after ? on : off, `${label} ${after ? 'on' : 'off'}`, 0x9b59b6, [`${u} in <#${n.channelId ?? o.channelId}>`]));
    };
    if (o.channelId !== n.channelId) {
      if (!o.channelId) tasks.push(log(g, 'voice_join', 'Joined voice', 0x2ecc71, [`${u} → <#${n.channelId}>`]));
      else if (!n.channelId) tasks.push(log(g, 'voice_leave', 'Left voice', 0x95a5a6, [`${u} ← <#${o.channelId}>`]));
      else tasks.push(log(g, 'voice_move', 'Moved voice channel', 0x3498db, [`${u}: <#${o.channelId}> → <#${n.channelId}>`]));
    }
    if (n.channelId && o.channelId === n.channelId) {
      flag(o.streaming, n.streaming, 'voice_stream_start', 'voice_stream_end', 'Stream');
      flag(o.selfVideo, n.selfVideo, 'voice_video_start', 'voice_video_end', 'Camera');
      flag(o.mute || o.selfMute, n.mute || n.selfMute, 'voice_mute', 'voice_unmute', 'Muted');
      flag(o.deaf || o.selfDeaf, n.deaf || n.selfDeaf, 'voice_deafen', 'voice_undeafen', 'Deafened');
      if (n.channel?.isVoiceBased() && n.channel.type === 13 && o.suppress !== n.suppress)
        tasks.push(log(g, 'stage_speaker', n.suppress ? 'Moved to audience' : 'Became speaker', 0xf1c40f, [`${u} in <#${n.channelId}>`]));
    }
    await Promise.all(tasks);
  });

  client.on('stageInstanceCreate', (s) => s.guild && log(s.guild, 'stage_start', 'Stage started', 0x2ecc71, [`<#${s.channelId}>: ${s.topic}`]));
  client.on('stageInstanceUpdate', (_o, s) => s.guild && log(s.guild, 'stage_update', 'Stage updated', 0x3498db, [`<#${s.channelId}>: ${s.topic}`]));
  client.on('stageInstanceDelete', (s) => s.guild && log(s.guild, 'stage_end', 'Stage ended', 0x95a5a6, [`<#${s.channelId}>`]));
}
