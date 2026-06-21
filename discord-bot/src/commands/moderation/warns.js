const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getWarns, removeWarn } = require('../../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warns')
    .setDescription('Gérer les avertissements')
    .addSubcommand(s => s.setName('liste').setDescription('Voir les avertissements d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Le membre').setRequired(true)))
    .addSubcommand(s => s.setName('supprimer').setDescription('Supprimer un avertissement')
      .addUserOption(o => o.setName('membre').setDescription('Le membre').setRequired(true))
      .addIntegerOption(o => o.setName('numéro').setDescription('Numéro du warn (commence à 1)').setRequired(true).setMinValue(1)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('membre');

    if (sub === 'liste') {
      const warns = getWarns(interaction.guild.id, target.id);
      if (!warns.length) {
        return interaction.reply({ content: `✅ ${target.tag} n'a aucun avertissement.`, flags: 64 });
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle(`⚠️ Avertissements de ${target.tag}`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `${warns.length} avertissement(s)` });

      warns.forEach((w, i) => {
        embed.addFields({
          name: `#${i + 1} — ${new Date(w.date).toLocaleDateString('fr-FR')}`,
          value: `**Raison :** ${w.raison}\n**Mod :** ${w.modTag}`,
          inline: false,
        });
      });

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (sub === 'supprimer') {
      const num = interaction.options.getInteger('numéro');
      const warns = getWarns(interaction.guild.id, target.id);
      if (!warns.length || num > warns.length) {
        return interaction.reply({ content: '❌ Numéro d\'avertissement invalide.', flags: 64 });
      }
      removeWarn(interaction.guild.id, target.id, num - 1);
      return interaction.reply({ content: `✅ Avertissement #${num} de ${target.tag} supprimé.`, flags: 64 });
    }
  },
};
