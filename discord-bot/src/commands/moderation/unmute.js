const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Retirer le mute d\'un membre')
    .addUserOption(o => o.setName('membre').setDescription('Le membre à unmute').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client) {
    const target = interaction.options.getMember('membre');
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

    if (!target) return interaction.reply({ content: '❌ Membre introuvable.', flags: 64 });
    if (!target.isCommunicationDisabled()) return interaction.reply({ content: '❌ Ce membre n\'est pas mute.', flags: 64 });

    await interaction.deferReply();

    await target.timeout(null, raison);

    await sendLog(client, interaction.guild.id, 'unmute', {
      title: 'Membre Unmute',
      fields: [
        { name: 'Membre', value: `${target.user.tag} (${target.user.id})`, inline: true },
        { name: 'Modérateur', value: `${interaction.user.tag}`, inline: true },
        { name: 'Raison', value: raison, inline: false },
      ],
    });

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🔊 Membre Unmute')
        .addFields(
          { name: 'Membre', value: `${target.user.tag}`, inline: true },
          { name: 'Raison', value: raison, inline: true },
        )
        .setTimestamp()],
    });
  },
};
