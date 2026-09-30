import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { commands } from './commands/index.js';

const rest = new REST().setToken(config.token);
await rest.put(Routes.applicationCommands(config.clientId), { body: [...commands.values()].map((c) => c.data.toJSON()) });
console.log('Commands deployed');
