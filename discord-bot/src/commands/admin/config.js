const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getConfig, setConfig } = require('../../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Voir ou modifier la configuration du bot')
    .addSubcommand(s => s.setName('voir').setDescription('Voir la configuration actuelle'))
    .addSubcommand(s => s.setName('autorole').setDescription('Définir le rôle automatique à l\'arrivée')
      .addRoleOption(o => o.setName('rôle').setDescription('Le rôle à donner automatiquement').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guild.id);

    if (sub === 'voir') {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`⚙️ Configuration de ${interaction.guild.name}`)
        .addFields(
          { name: '📋 Salon de logs', value: config.logChannel ? `<#${config.logChannel}>` : 'Non défini', inline: true },
          { name: '👋 Salon de bienvenue', value: config.welcomeChannel ? `<#${config.welcomeChannel}>` : 'Non défini', inline: true },
          { name: '🏷️ Rôle auto', value: config.autoRole ? `<@&${config.autoRole}>` : 'Non défini', inline: true },
          { name: '🛡️ Rôle Staff', value: config.staffRole ? `<@&${config.staffRole}>` : 'Non défini', inline: true },
          { name: '🎫 Catégorie tickets', value: config.ticketCategory ? `<#${config.ticketCategory}>` : 'Non définie', inline: true },
          { name: '📜 Règlement', value: config.rules?.length ? `${config.rules.length} règle(s)` : 'Non défini', inline: true },
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (sub === 'autorole') {
      const role = interaction.options.getRole('rôle');
      setConfig(interaction.guild.id, 'autoRole', role.id);
      return interaction.reply({ content: `✅ Rôle automatique défini : ${role}`, flags: 64 });
    }
  },
};
