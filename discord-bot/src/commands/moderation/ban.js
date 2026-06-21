const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannir un membre du serveur')
    .addUserOption(o => o.setName('membre').setDescription('Le membre à bannir').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison du bannissement').setRequired(false))
    .addIntegerOption(o => o.setName('jours').setDescription('Jours de messages à supprimer (0-7)').setMinValue(0).setMaxValue(7).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction, client) {
    const target = interaction.options.getMember('membre');
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';
    const jours = interaction.options.getInteger('jours') ?? 0;

    if (!target) return interaction.reply({ content: '❌ Membre introuvable.', flags: 64 });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ Tu ne peux pas te bannir toi-même.', flags: 64 });
    if (!target.bannable) return interaction.reply({ content: '❌ Je ne peux pas bannir ce membre (permissions insuffisantes).', flags: 64 });

    await interaction.deferReply();

    try {
      await target.user.send({
        embeds: [new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle(`🔨 Vous avez été banni de ${interaction.guild.name}`)
          .addFields(
            { name: 'Raison', value: raison },
            { name: 'Modérateur', value: interaction.user.tag },
          )
          .setTimestamp()],
      }).catch(() => {});

      await target.ban({ deleteMessageSeconds: jours * 86400, reason: raison });

      await sendLog(client, interaction.guild.id, 'ban', {
        title: 'Membre Banni',
        fields: [
          { name: 'Membre', value: `${target.user.tag} (${target.user.id})`, inline: true },
          { name: 'Modérateur', value: `${interaction.user.tag}`, inline: true },
          { name: 'Raison', value: raison, inline: false },
          { name: 'Messages supprimés', value: `${jours} jour(s)`, inline: true },
        ],
        thumbnail: target.user.displayAvatarURL({ dynamic: true }),
      });

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('✅ Membre Banni')
          .addFields(
            { name: 'Membre', value: `${target.user.tag}`, inline: true },
            { name: 'Raison', value: raison, inline: true },
          )
          .setTimestamp()],
      });
    } catch (err) {
      await interaction.editReply({ content: `❌ Erreur : ${err.message}` });
    }
  },
};
