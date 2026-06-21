const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { getConfig } = require('../../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('syncperms')
    .setDescription('Synchroniser les permissions de tous les salons selon le rôle de vérification')
    .addChannelOption(o => o.setName('salon-public').setDescription('Salon visible par tous avant vérification (ex: #vérification, #règlement)').setRequired(false))
    .addBooleanOption(o => o.setName('confirmer').setDescription('Confirmer l\'application des permissions (défaut: simulation)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const config = getConfig(interaction.guild.id);
    const verifRoleId = config.verifRole;
    const publicChannel = interaction.options.getChannel('salon-public');
    const confirm = interaction.options.getBoolean('confirmer') ?? false;

    if (!verifRoleId) {
      return interaction.editReply({ content: '❌ Aucun rôle de vérification configuré. Lance d\'abord `/setupverif`.' });
    }

    const verifRole = interaction.guild.roles.cache.get(verifRoleId);
    if (!verifRole) {
      return interaction.editReply({ content: '❌ Le rôle de vérification est introuvable.' });
    }

    // Salons publics (toujours visibles par @everyone)
    const publicChannelIds = new Set();
    if (publicChannel) publicChannelIds.add(publicChannel.id);

    // Ajouter les salons de vérification définis dans la config
    if (config.verifChannel) publicChannelIds.add(config.verifChannel);

    const everyoneRole = interaction.guild.roles.everyone;
    const channels = interaction.guild.channels.cache.filter(c =>
      [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement,
       ChannelType.GuildForum, ChannelType.GuildStageVoice].includes(c.type)
    );

    let updated = 0;
    let skipped = 0;
    const errors = [];

    if (confirm) {
      for (const [, channel] of channels) {
        try {
          if (publicChannelIds.has(channel.id)) {
            // Salon public : @everyone peut voir, vérif aussi
            await channel.permissionOverwrites.edit(everyoneRole, { ViewChannel: true });
          } else {
            // Salons privés : @everyone ne peut pas voir, vérif peut voir
            await channel.permissionOverwrites.edit(everyoneRole, { ViewChannel: false });
            await channel.permissionOverwrites.edit(verifRole, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true,
            });
          }
          updated++;
        } catch (err) {
          errors.push(`${channel.name}: ${err.message}`);
          skipped++;
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(confirm ? 0x00FF88 : 0xFFAA00)
      .setTitle(confirm ? '✅ Permissions synchronisées' : '👁️ Simulation — Permissions (non appliquées)')
      .setDescription(
        confirm
          ? `Les permissions de **${updated}** salons ont été mises à jour.\n${skipped > 0 ? `⚠️ ${skipped} salon(s) ignoré(s) (permissions insuffisantes).` : ''}`
          : `**${channels.size}** salons seraient modifiés.\n\n**Résultat attendu :**\n• @everyone → ❌ Voir les salons (sauf salons publics)\n• ${verifRole} → ✅ Voir tous les salons\n\nRelance avec \`confirmer: Oui\` pour appliquer.`
      )
      .addFields(
        { name: '🔓 Salons publics (visibles par tous)', value: publicChannelIds.size > 0 ? [...publicChannelIds].map(id => `<#${id}>`).join(', ') : 'Aucun', inline: false },
        { name: '🔒 Salons privés (vérif requise)', value: `${channels.size - publicChannelIds.size} salon(s)`, inline: true },
        { name: '🏷️ Rôle vérification', value: verifRole.toString(), inline: true },
      )
      .setTimestamp();

    if (errors.length > 0) {
      embed.addFields({ name: '❌ Erreurs', value: errors.slice(0, 5).join('\n'), inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
