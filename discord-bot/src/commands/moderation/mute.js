const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../../utils/logger');

const DURATIONS = {
  '10m': 10 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1j': 24 * 60 * 60 * 1000,
  '3j': 3 * 24 * 60 * 60 * 1000,
  '7j': 7 * 24 * 60 * 60 * 1000,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mettre en sourdine un membre (timeout)')
    .addUserOption(o => o.setName('membre').setDescription('Le membre à mute').setRequired(true))
    .addStringOption(o => o.setName('durée').setDescription('Durée (10m, 30m, 1h, 6h, 12h, 1j, 3j, 7j)').setRequired(true)
      .addChoices(
        { name: '10 minutes', value: '10m' },
        { name: '30 minutes', value: '30m' },
        { name: '1 heure', value: '1h' },
        { name: '6 heures', value: '6h' },
        { name: '12 heures', value: '12h' },
        { name: '1 jour', value: '1j' },
        { name: '3 jours', value: '3j' },
        { name: '7 jours', value: '7j' },
      ))
    .addStringOption(o => o.setName('raison').setDescription('Raison du mute').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client) {
    const target = interaction.options.getMember('membre');
    const dureeKey = interaction.options.getString('durée');
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';
    const ms = DURATIONS[dureeKey];

    if (!target) return interaction.reply({ content: '❌ Membre introuvable.', flags: 64 });
    if (!target.moderatable) return interaction.reply({ content: '❌ Je ne peux pas mute ce membre.', flags: 64 });

    await interaction.deferReply();

    try {
      await target.timeout(ms, raison);

      await sendLog(client, interaction.guild.id, 'mute', {
        title: 'Membre Mute',
        fields: [
          { name: 'Membre', value: `${target.user.tag} (${target.user.id})`, inline: true },
          { name: 'Modérateur', value: `${interaction.user.tag}`, inline: true },
          { name: 'Durée', value: dureeKey, inline: true },
          { name: 'Raison', value: raison, inline: false },
        ],
        thumbnail: target.user.displayAvatarURL({ dynamic: true }),
      });

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xFFAA00)
          .setTitle('🔇 Membre Mute')
          .addFields(
            { name: 'Membre', value: `${target.user.tag}`, inline: true },
            { name: 'Durée', value: dureeKey, inline: true },
            { name: 'Raison', value: raison, inline: false },
          )
          .setTimestamp()],
      });
    } catch (err) {
      await interaction.editReply({ content: `❌ Erreur : ${err.message}` });
    }
  },
};
