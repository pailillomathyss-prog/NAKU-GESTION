const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addWarn } = require('../../utils/config');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Avertir un membre')
    .addUserOption(o => o.setName('membre').setDescription('Le membre à avertir').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison de l\'avertissement').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, client) {
    const target = interaction.options.getMember('membre');
    const raison = interaction.options.getString('raison');

    if (!target) return interaction.reply({ content: '❌ Membre introuvable.', flags: 64 });
    if (target.user.bot) return interaction.reply({ content: '❌ Tu ne peux pas avertir un bot.', flags: 64 });

    await interaction.deferReply();

    const warn = {
      raison,
      modId: interaction.user.id,
      modTag: interaction.user.tag,
      date: new Date().toISOString(),
    };

    addWarn(interaction.guild.id, target.user.id, warn);

    await target.user.send({
      embeds: [new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle(`⚠️ Avertissement sur ${interaction.guild.name}`)
        .addFields(
          { name: 'Raison', value: raison },
          { name: 'Modérateur', value: interaction.user.tag },
        )
        .setTimestamp()],
    }).catch(() => {});

    await sendLog(client, interaction.guild.id, 'warn', {
      title: 'Membre Averti',
      fields: [
        { name: 'Membre', value: `${target.user.tag} (${target.user.id})`, inline: true },
        { name: 'Modérateur', value: `${interaction.user.tag}`, inline: true },
        { name: 'Raison', value: raison, inline: false },
      ],
      thumbnail: target.user.displayAvatarURL({ dynamic: true }),
    });

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle('⚠️ Avertissement Envoyé')
        .addFields(
          { name: 'Membre', value: `${target.user.tag}`, inline: true },
          { name: 'Raison', value: raison, inline: true },
        )
        .setTimestamp()],
    });
  },
};
