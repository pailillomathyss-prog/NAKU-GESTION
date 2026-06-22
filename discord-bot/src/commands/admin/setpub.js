const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getConfig, setConfig } = require('../../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setpub')
    .setDescription('Configurer le rôle automatique @PUB (statut Discord)')
    .addSubcommand(s => s
      .setName('configurer')
      .setDescription('Définir le rôle et les mots-clés à détecter dans les statuts')
      .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer (ex: @𝐏 𝐔 𝐁)').setRequired(true))
      .addStringOption(o => o.setName('tag').setDescription('Tag du serveur à détecter dans le statut (ex: nakami)').setRequired(true))
      .addStringOption(o => o.setName('extra').setDescription('Mots-clés supplémentaires séparés par des virgules (ex: /nakami,naku)').setRequired(false)))
    .addSubcommand(s => s
      .setName('statut')
      .setDescription('Voir la configuration actuelle'))
    .addSubcommand(s => s
      .setName('scanner')
      .setDescription('Scanner tous les membres en ligne et attribuer/retirer le rôle immédiatement'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guild.id);

    if (sub === 'configurer') {
      const role = interaction.options.getRole('role');
      const tag = interaction.options.getString('tag').trim().toLowerCase();
      const extra = interaction.options.getString('extra') || '';

      const triggers = [tag, ...extra.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)];
      const unique = [...new Set(triggers)];

      setConfig(interaction.guild.id, 'pubRole', role.id);
      setConfig(interaction.guild.id, 'pubTriggers', unique);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('✅ Système @PUB configuré')
          .addFields(
            { name: '🏷️ Rôle', value: role.toString(), inline: true },
            { name: '🔍 Triggers détectés dans le statut', value: unique.map(t => `\`${t}\``).join(', '), inline: false },
            { name: '⚙️ Fonctionnement', value: 'Quand un membre met un des triggers dans son statut Discord → rôle ajouté automatiquement.\nQuand il le retire → rôle retiré.', inline: false },
            { name: '⚠️ Prérequis Railway', value: '`GuildPresences` doit être activé dans le **Discord Developer Portal** (Privileged Gateway Intents).', inline: false },
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
          .setTitle('📢 Configuration @PUB')
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

      await interaction.guild.members.fetch();
      const presences = interaction.guild.presences.cache;

      let added = 0, removed = 0;

      for (const [userId, presence] of presences) {
        const member = interaction.guild.members.cache.get(userId);
        if (!member || member.user.bot) continue;

        const custom = presence.activities?.find(a => a.type === 4);
        const statusText = [custom?.name, custom?.state, custom?.details].filter(Boolean).join(' ').toLowerCase();
        const matches = triggers.some(t => statusText.includes(t));
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
            { name: '👥 Membres scannés', value: `${presences.size}`, inline: true },
          )
          .setTimestamp()],
      });
    }
  },
};
