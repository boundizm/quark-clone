import { EmbedBuilder, type Client } from 'discord.js';
import { sendLog } from '../logger.js';

export function registerVoiceEvents(client: Client) {
  client.on('voiceStateUpdate', (oldS, newS) => {
    if (oldS.channelId === newS.channelId || !newS.guild) return;
    const text = !oldS.channelId ? `joined <#${newS.channelId}>`
      : !newS.channelId ? `left <#${oldS.channelId}>`
      : `moved <#${oldS.channelId}> → <#${newS.channelId}>`;
    return sendLog(newS.guild, 'voice', new EmbedBuilder().setColor(0x9b59b6)
      .setTitle('Voice activity').setDescription(`<@${newS.id}> ${text}`));
  });
}
