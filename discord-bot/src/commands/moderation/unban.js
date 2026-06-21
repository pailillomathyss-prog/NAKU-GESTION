const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Débannir un utilisateur')
    .addStringOption(o => o.setName('id').setDescription('ID de l\'utilisateur à débannir').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction, client) {
    const userId = interaction.options.getString('id');
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

    await interaction.deferReply();

    try {
      const ban = await interaction.guild.bans.fetch(userId);
      if (!ban) return interaction.editReply({ content: '❌ Cet utilisateur n\'est pas banni.' });

      await interaction.guild.members.unban(userId, raison);

      await sendLog(client, interaction.guild.id, 'unban', {
        title: 'Membre Débanni',
        fields: [
          { name: 'Utilisateur', value: `${ban.user.tag} (${userId})`, inline: true },
          { name: 'Modérateur', value: `${interaction.user.tag}`, inline: true },
          { name: 'Raison', value: raison, inline: false },
        ],
      });

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Membre Débanni')
          .addFields(
            { name: 'Utilisateur', value: `${ban.user.tag}`, inline: true },
            { name: 'Raison', value: raison, inline: true },
          )
          .setTimestamp()],
      });
    } catch {
      await interaction.editReply({ content: '❌ ID invalide ou utilisateur non banni.' });
    }
  },
};
