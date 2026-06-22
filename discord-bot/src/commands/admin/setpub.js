const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getConfig, setConfig } = require('../../utils/config');
const { ActivityType } = require('discord.js');

function getStatusText(presence) {
  if (!presence?.activities) return '';
  const custom = presence.activities.find(a => a.type === ActivityType.Custom);
  return [custom?.name, custom?.state, custom?.details].filter(Boolean).join(' ').toLowerCase();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setpub')
    .setDescription('Configurer le rôle automatique basé sur le statut Discord')
    .addSubcommand(s => s
      .setName('configurer')
      .setDescription('Définir le rôle et les mots-clés à détecter dans les statuts')
      .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer automatiquement').setRequired(true))
      .addStringOption(o => o.setName('trigger').setDescription('Mot-clé principal à détecter (ex: /larpeurs)').setRequired(true))
      .addStringOption(o => o.setName('extra').setDescription('Autres mots-clés séparés par des virgules (ex: larpeur,larp)').setRequired(false)))
    .addSubcommand(s => s
      .setName('statut')
      .setDescription('Voir la configuration actuelle'))
    .addSubcommand(s => s
      .setName('scanner')
      .setDescription('Scanner tous les membres en ligne et appliquer le rôle immédiatement'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guild.id);

    if (sub === 'configurer') {
      const role = interaction.options.getRole('role');
      const trigger = interaction.options.getString('trigger').trim().toLowerCase();
      const extra = interaction.options.getString('extra') || '';

      const triggers = [trigger, ...extra.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)];
      const unique = [...new Set(triggers)];

      setConfig(interaction.guild.id, 'pubRole', role.id);
      setConfig(interaction.guild.id, 'pubTriggers', unique);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('✅ Système de statut configuré')
          .addFields(
            { name: '🏷️ Rôle attribué', value: role.toString(), inline: true },
            { name: '🔍 Triggers détectés', value: unique.map(t => `\`${t}\``).join(', '), inline: false },
            { name: '⚙️ Fonctionnement', value: [
              '• Dès qu\'un membre met un trigger dans son statut → rôle ajouté',
              '• Dès qu\'il le retire → rôle retiré',
              '• Détection en **temps réel** + scan automatique au démarrage du bot',
            ].join('\n'), inline: false },
          )
          .setTimestamp()],
        flags: 64,
      });
    }

    if (sub === 'statut') {
      const triggers = config.pubTriggers || [];
      const roleId = config.pubRole;
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📢 Configuration rôle statut')
          .addFields(
            { name: 'Rôle', value: roleId ? `<@&${roleId}>` : '❌ Non configuré', inline: true },
            { name: 'Triggers', value: triggers.length ? triggers.map(t => `\`${t}\``).join(', ') : '❌ Aucun', inline: true },
          )
          .setTimestamp()],
        flags: 64,
      });
    }

    if (sub === 'scanner') {
      await interaction.deferReply({ flags: 64 });

      const roleId = config.pubRole;
      const triggers = (config.pubTriggers || []).map(t => t.toLowerCase());

      if (!roleId || !triggers.length) {
        return interaction.editReply({ content: '❌ Configure d\'abord avec `/setpub configurer`.' });
      }

      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) return interaction.editReply({ content: '❌ Rôle introuvable.' });

      // Fetch tous les membres pour avoir les présences complètes
      await interaction.guild.members.fetch();
      const presences = interaction.guild.presences.cache;

      let added = 0, removed = 0, scanned = 0;

      for (const [userId, presence] of presences) {
        const member = interaction.guild.members.cache.get(userId);
        if (!member || member.user.bot) continue;
        scanned++;

        const text = getStatusText(presence);
        const matches = triggers.some(t => text.includes(t));
        const hasRole = member.roles.cache.has(role.id);

        if (matches && !hasRole) {
          await member.roles.add(role).catch(() => {});
          added++;
        } else if (!matches && hasRole) {
          await member.roles.remove(role).catch(() => {});
          removed++;
        }
      }

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x00FF88)
          .setTitle('🔍 Scan terminé')
          .addFields(
            { name: '✅ Rôles ajoutés', value: `${added}`, inline: true },
            { name: '❌ Rôles retirés', value: `${removed}`, inline: true },
            { name: '👥 Membres scannés', value: `${scanned}`, inline: true },
          )
          .setTimestamp()],
      });
    }
  },
};
