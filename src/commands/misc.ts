import { EmbedBuilder, OAuth2Scopes, PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { commands } from './index.js';

export const help = {
  data: new SlashCommandBuilder().setName('help').setDescription('How to get started'),
  async execute(i: ChatInputCommandInteraction) {
    await i.reply({ ephemeral: true, embeds: [new EmbedBuilder().setTitle('Getting started')
      .setDescription('1. Run `/logging all #your-log-channel`\n2. Adjust per-event channels with `/logging set`\n3. Use `/commands` for the full list')] });
  },
};

export const commandsCmd = {
  data: new SlashCommandBuilder().setName('commands').setDescription('List all commands'),
  async execute(i: ChatInputCommandInteraction) {
    await i.reply({ ephemeral: true, content: [...commands.values()].map((c) => `\`/${c.data.name}\` — ${c.data.description}`).join('\n') });
  },
};

export const invite = {
  data: new SlashCommandBuilder().setName('invite').setDescription('Add the bot to your server'),
  async execute(i: ChatInputCommandInteraction) {
    const url = i.client.generateInvite({
      scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      permissions: [PermissionFlagsBits.ViewAuditLog, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers],
    });
    await i.reply({ content: url, ephemeral: true });
  },
};
