import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';
import * as logging from './commands/logging.js';
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
  if (i.isChatInputCommand() && i.commandName === logging.data.name) {
    await logging.execute(i).catch(console.error);
  }
});

client.once(Events.ClientReady, (c) => console.log(`Ready as ${c.user.tag}`));
await client.login(config.token);
