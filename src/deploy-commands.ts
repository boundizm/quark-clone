import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import * as logging from './commands/logging.js';

const rest = new REST().setToken(config.token);
await rest.put(Routes.applicationCommands(config.clientId), { body: [logging.data.toJSON()] });
console.log('Commands deployed');
