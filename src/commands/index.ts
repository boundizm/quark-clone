import type { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder, SlashCommandBuilder } from 'discord.js';
import * as logging from './logging.js';
import * as history from './history.js';
import * as tags from './tags.js';
import { ban, kick, mute, unban, unmute } from './moderation.js';
import { commandsCmd, help, invite } from './misc.js';

type Builder = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
export interface Command { data: Builder; execute(i: ChatInputCommandInteraction): Promise<unknown>; autocomplete?(i: AutocompleteInteraction): Promise<unknown> }

export const commands = new Map<string, Command>(
  ([logging, tags, history, ban, unban, kick, mute, unmute, help, commandsCmd, invite] as Command[]).map((c) => [c.data.name, c]),
);
