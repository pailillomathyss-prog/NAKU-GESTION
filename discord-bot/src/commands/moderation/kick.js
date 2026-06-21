const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulser un membre du serveur')
    .addUserOption(o => o.setName('membre').setDescription('Le membre à expulser').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison de l\'expulsion').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction, client) {
    const target = interaction.options.getMember('membre');
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

    if (!target) return interaction.reply({ content: '❌ Membre introuvable.', flags: 64 });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ Tu ne peux pas t\'expulser toi-même.', flags: 64 });
    if (!target.kickable) return interaction.reply({ content: '❌ Je ne peux pas expulser ce membre.', flags: 64 });

    await interaction.deferReply();

    try {
      await target.user.send({
        embeds: [new EmbedBuilder()
          .setColor(0xFF6600)
          .setTitle(`👢 Vous avez été expulsé de ${interaction.guild.name}`)
          .addFields(
            { name: 'Raison', value: raison },
            { name: 'Modérateur', value: interaction.user.tag },
          )
          .setTimestamp()],
      }).catch(() => {});

      await target.kick(raison);

      await sendLog(client, interaction.guild.id, 'kick', {
        title: 'Membre Expulsé',
        fields: [
          { name: 'Membre', value: `${target.user.tag} (${target.user.id})`, inline: true },
          { name: 'Modérateur', value: `${interaction.user.tag}`, inline: true },
          { name: 'Raison', value: raison, inline: false },
        ],
        thumbnail: target.user.displayAvatarURL({ dynamic: true }),
      });

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xFF6600)
          .setTitle('✅ Membre Expulsé')
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
