const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Déverrouiller un salon — tout le monde peut à nouveau écrire')
    .addChannelOption(o => o
      .setName('salon')
      .setDescription('Salon à déverrouiller (par défaut : salon actuel)')
      .setRequired(false))
    .addStringOption(o => o
      .setName('raison')
      .setDescription('Raison du déverrouillage')
      .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    const channel = interaction.options.getChannel('salon') || interaction.channel;
    const raison  = interaction.options.getString('raison') || 'Aucune raison fournie';

    // Remettre SendMessages à null (hérite des permissions par défaut)
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: null,
    }).catch(() => {});

    const embed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle('🔓 Salon Déverrouillé')
      .setDescription(`Ce salon a été déverrouillé par ${interaction.user}.`)
      .addFields({ name: 'Raison', value: raison })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => {});

    await sendLog(client, interaction.guild.id, 'channel_update', {
      title: '🔓 Salon Déverrouillé',
      fields: [
        { name: 'Salon', value: channel.toString(), inline: true },
        { name: 'Par', value: `${interaction.user.tag}`, inline: true },
        { name: 'Raison', value: raison, inline: false },
      ],
    });

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x00FF88)
        .setDescription(`✅ ${channel} est maintenant **déverrouillé**.`)
        .setTimestamp()],
      flags: 64,
    });
  },
};
