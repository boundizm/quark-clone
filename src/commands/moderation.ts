import {
  PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction,
} from 'discord.js';

const reasonOpt = (o: any) => o.setName('reason').setDescription('Reason (goes to audit log)');

export const ban = {
  data: new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(reasonOpt),
  async execute(i: ChatInputCommandInteraction) {
    const user = i.options.getUser('user', true);
    await i.guild!.members.ban(user, { reason: i.options.getString('reason') ?? undefined });
    await i.reply({ content: `Banned ${user.tag}.`, ephemeral: true });
  },
};

export const unban = {
  data: new SlashCommandBuilder().setName('unban').setDescription('Unban a user by ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((o) => o.setName('user_id').setDescription('User ID').setRequired(true))
    .addStringOption(reasonOpt),
  async execute(i: ChatInputCommandInteraction) {
    await i.guild!.members.unban(i.options.getString('user_id', true), i.options.getString('reason') ?? undefined);
    await i.reply({ content: 'Unbanned.', ephemeral: true });
  },
};

export const kick = {
  data: new SlashCommandBuilder().setName('kick').setDescription('Kick a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(reasonOpt),
  async execute(i: ChatInputCommandInteraction) {
    const user = i.options.getUser('user', true);
    await i.guild!.members.kick(user, i.options.getString('reason') ?? undefined);
    await i.reply({ content: `Kicked ${user.tag}.`, ephemeral: true });
  },
};

export const mute = {
  data: new SlashCommandBuilder().setName('mute').setDescription('Timeout a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption((o) => o.setName('minutes').setDescription('Duration (max 40320)').setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(reasonOpt),
  async execute(i: ChatInputCommandInteraction) {
    const user = i.options.getUser('user', true);
    const m = await i.guild!.members.fetch(user.id);
    await m.timeout(i.options.getInteger('minutes', true) * 60_000, i.options.getString('reason') ?? undefined);
    await i.reply({ content: `Muted ${user.tag}.`, ephemeral: true });
  },
};

export const unmute = {
  data: new SlashCommandBuilder().setName('unmute').setDescription('Remove a timeout')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(reasonOpt),
  async execute(i: ChatInputCommandInteraction) {
    const user = i.options.getUser('user', true);
    const m = await i.guild!.members.fetch(user.id);
    await m.timeout(null, i.options.getString('reason') ?? undefined);
    await i.reply({ content: `Unmuted ${user.tag}.`, ephemeral: true });
  },
};
