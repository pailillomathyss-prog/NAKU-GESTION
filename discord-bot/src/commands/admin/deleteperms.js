const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deleteperms')
    .setDescription('Supprimer toutes les permissions (overwrites) de tous les salons du serveur')
    .addBooleanOption(o =>
      o.setName('confirmer')
        .setDescription('Confirmer la suppression réelle (défaut : simulation)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const confirm = interaction.options.getBoolean('confirmer') ?? false;

    const validTypes = [
      ChannelType.GuildText,
      ChannelType.GuildVoice,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildForum,
      ChannelType.GuildStageVoice,
      ChannelType.GuildCategory,
    ];

    const channels = interaction.guild.channels.cache.filter(c => validTypes.includes(c.type));

    let cleared = 0;
    let skipped = 0;
    const errors = [];

    if (confirm) {
      for (const [, channel] of channels) {
        try {
          // Récupérer tous les overwrites et les supprimer un par un
          const overwrites = [...channel.permissionOverwrites.cache.values()];
          for (const overwrite of overwrites) {
            await channel.permissionOverwrites.delete(overwrite.id).catch(() => {});
          }
          cleared++;
        } catch (err) {
          errors.push(`#${channel.name}: ${err.message}`);
          skipped++;
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(confirm ? 0xFF4444 : 0xFFAA00)
      .setTitle(confirm ? '🗑️ Permissions supprimées' : '👁️ Simulation — Suppression de permissions')
      .setDescription(
        confirm
          ? `Toutes les permissions ont été supprimées sur **${cleared}** salon(s).\n` +
            `${skipped > 0 ? `⚠️ ${skipped} salon(s) ignoré(s) (permissions insuffisantes).` : ''}\n\n` +
            `> ⚠️ Les salons n'ont plus aucune restriction — tout le monde peut tout voir.`
          : `**${channels.size}** salon(s) seraient affectés.\n\n` +
            `Tous les permission overwrites (rôles, membres, @everyone) seraient **supprimés**.\n\n` +
            `Relance avec \`confirmer: Oui\` pour appliquer réellement.`
      )
      .addFields(
        { name: '📋 Salons traités', value: `${confirm ? cleared : channels.size}`, inline: true },
        { name: '🔧 Mode', value: confirm ? '✅ Appliqué' : '🔶 Simulation', inline: true },
      )
      .setTimestamp();

    if (errors.length > 0) {
      embed.addFields({ name: '❌ Erreurs', value: errors.slice(0, 5).join('\n'), inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
