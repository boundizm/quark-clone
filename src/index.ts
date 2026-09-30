import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';
import { commands } from './commands/index.js';
import { registerMemberEvents } from './events/members.js';
import { registerMessageEvents, startRetentionJob } from './events/messages.js';
import { registerVoiceEvents } from './events/voice.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,        // privileged
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,      // privileged
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.GuildMember],
});

registerMessageEvents(client);
registerMemberEvents(client);
registerVoiceEvents(client);
startRetentionJob();

client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand() || !i.inGuild()) return;
  await commands.get(i.commandName)?.execute(i).catch(async (e) => {
    console.error(e);
    const msg = { content: 'Command failed (check my permissions and role position).', ephemeral: true };
    await (i.replied || i.deferred ? i.followUp(msg) : i.reply(msg)).catch(() => undefined);
  });
});

client.once(Events.ClientReady, (c) => console.log(`Ready as ${c.user.tag}`));
await client.login(config.token);
