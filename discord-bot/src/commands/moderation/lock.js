const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Verrouiller un salon — plus personne ne peut écrire')
    .addChannelOption(o => o
      .setName('salon')
      .setDescription('Salon à verrouiller (par défaut : salon actuel)')
      .setRequired(false))
    .addStringOption(o => o
      .setName('raison')
      .setDescription('Raison du verrouillage')
      .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    const channel = interaction.options.getChannel('salon') || interaction.channel;
    const raison  = interaction.options.getString('raison') || 'Aucune raison fournie';

    // Refuser l'envoi de messages pour @everyone
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: false,
    }).catch(() => {});

    const embed = new EmbedBuilder()
      .setColor(0xFF2222)
      .setTitle('🔒 Salon Verrouillé')
      .setDescription(`Ce salon a été verrouillé par ${interaction.user}.`)
      .addFields({ name: 'Raison', value: raison })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => {});

    await sendLog(client, interaction.guild.id, 'channel_update', {
      title: '🔒 Salon Verrouillé',
      fields: [
        { name: 'Salon', value: channel.toString(), inline: true },
        { name: 'Par', value: `${interaction.user.tag}`, inline: true },
        { name: 'Raison', value: raison, inline: false },
      ],
    });

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xFF2222)
        .setDescription(`✅ ${channel} est maintenant **verrouillé**.`)
        .setTimestamp()],
      flags: 64,
    });
  },
};
