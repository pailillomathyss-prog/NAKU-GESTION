const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getConfig, setConfig } = require('../../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configurer la protection automatique du serveur')

    .addSubcommand(s => s.setName('statut').setDescription('Voir la configuration actuelle'))

    .addSubcommand(s => s.setName('antilink')
      .setDescription('Anti-lien Discord / liens externes')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer/désactiver').setRequired(true))
      .addBooleanOption(o => o.setName('youtube').setDescription('Bloquer YouTube également').setRequired(false))
      .addBooleanOption(o => o.setName('externes').setDescription('Bloquer tous les liens externes').setRequired(false)))

    .addSubcommand(s => s.setName('antispam')
      .setDescription('Anti-spam de messages')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer/désactiver').setRequired(true))
      .addIntegerOption(o => o.setName('limite').setDescription('Nb max de messages avant action (défaut: 5)').setMinValue(2).setMaxValue(20).setRequired(false))
      .addIntegerOption(o => o.setName('intervalle').setDescription('Intervalle en secondes (défaut: 4)').setMinValue(1).setMaxValue(10).setRequired(false)))

    .addSubcommand(s => s.setName('antiraid')
      .setDescription('Anti-raid (vague de nouveaux membres)')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer/désactiver').setRequired(true))
      .addIntegerOption(o => o.setName('seuil').setDescription('Nb de joins en X sec pour déclencher (défaut: 8)').setMinValue(3).setMaxValue(30).setRequired(false))
      .addIntegerOption(o => o.setName('intervalle').setDescription('Intervalle en secondes (défaut: 10)').setMinValue(5).setMaxValue(60).setRequired(false)))

    .addSubcommand(s => s.setName('antibot')
      .setDescription('Kick automatique des bots non autorisés')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer/désactiver').setRequired(true))
      .addStringOption(o => o.setName('whitelist').setDescription('IDs de bots autorisés séparés par des virgules').setRequired(false)))

    .addSubcommand(s => s.setName('antisticker')
      .setDescription('Bloquer les stickers externes')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer/désactiver').setRequired(true)))

    .addSubcommand(s => s.setName('whitelist')
      .setDescription('Exempter un salon de l\'automod')
      .addChannelOption(o => o.setName('salon').setDescription('Salon à exempter').setRequired(true))
      .addBooleanOption(o => o.setName('retirer').setDescription('Retirer de la whitelist').setRequired(false)))

    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guild.id);
    const am = config.automod || {};

    if (sub === 'statut') {
      const on = '✅ Actif';
      const off = '❌ Inactif';
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🛡️ AutoMod — Configuration')
        .addFields(
          { name: '🔗 Anti-Lien Discord', value: am.antiLink ? on : off, inline: true },
          { name: '📺 Anti-YouTube', value: am.antiYoutube ? on : off, inline: true },
          { name: '🌐 Anti-Liens Externes', value: am.antiExternalLinks ? on : off, inline: true },
          { name: '📨 Anti-Spam', value: am.antiSpam ? `${on} (${am.spamLimit || 5} msg / ${am.spamInterval ? am.spamInterval / 1000 : 4}s)` : off, inline: true },
          { name: '⚡ Anti-Raid', value: am.antiRaid ? `${on} (${am.raidThreshold || 8} joins / ${am.raidInterval ? am.raidInterval / 1000 : 10}s)` : off, inline: true },
          { name: '🤖 Anti-Bot', value: am.antiBot ? on : off, inline: true },
          { name: '🎭 Anti-Sticker Externe', value: am.antiSticker ? on : off, inline: true },
          { name: '📱 Anti-App Discord', value: am.antiApp ? on : off, inline: true },
          { name: '✅ Salons exemptés', value: am.whitelist?.map(id => `<#${id}>`).join(', ') || 'Aucun', inline: false },
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (sub === 'antilink') {
      am.antiLink = interaction.options.getBoolean('actif');
      const yt = interaction.options.getBoolean('youtube');
      const ext = interaction.options.getBoolean('externes');
      if (yt !== null) am.antiYoutube = yt;
      if (ext !== null) am.antiExternalLinks = ext;
      am.antiApp = am.antiLink;
      setConfig(interaction.guild.id, 'automod', am);
      return interaction.reply({ content: `✅ Anti-lien **${am.antiLink ? 'activé' : 'désactivé'}**.`, flags: 64 });
    }

    if (sub === 'antispam') {
      am.antiSpam = interaction.options.getBoolean('actif');
      const limit = interaction.options.getInteger('limite');
      const interval = interaction.options.getInteger('intervalle');
      if (limit) am.spamLimit = limit;
      if (interval) am.spamInterval = interval * 1000;
      setConfig(interaction.guild.id, 'automod', am);
      return interaction.reply({ content: `✅ Anti-spam **${am.antiSpam ? 'activé' : 'désactivé'}**.`, flags: 64 });
    }

    if (sub === 'antiraid') {
      am.antiRaid = interaction.options.getBoolean('actif');
      const seuil = interaction.options.getInteger('seuil');
      const interval = interaction.options.getInteger('intervalle');
      if (seuil) am.raidThreshold = seuil;
      if (interval) am.raidInterval = interval * 1000;
      setConfig(interaction.guild.id, 'automod', am);
      return interaction.reply({ content: `✅ Anti-raid **${am.antiRaid ? 'activé' : 'désactivé'}**.`, flags: 64 });
    }

    if (sub === 'antibot') {
      am.antiBot = interaction.options.getBoolean('actif');
      const wl = interaction.options.getString('whitelist');
      if (wl) am.botWhitelist = wl.split(',').map(s => s.trim()).filter(Boolean);
      setConfig(interaction.guild.id, 'automod', am);
      return interaction.reply({ content: `✅ Anti-bot **${am.antiBot ? 'activé' : 'désactivé'}**.`, flags: 64 });
    }

    if (sub === 'antisticker') {
      am.antiSticker = interaction.options.getBoolean('actif');
      setConfig(interaction.guild.id, 'automod', am);
      return interaction.reply({ content: `✅ Anti-sticker externe **${am.antiSticker ? 'activé' : 'désactivé'}**.`, flags: 64 });
    }

    if (sub === 'whitelist') {
      const channel = interaction.options.getChannel('salon');
      const retirer = interaction.options.getBoolean('retirer') || false;
      if (!am.whitelist) am.whitelist = [];
      if (retirer) {
        am.whitelist = am.whitelist.filter(id => id !== channel.id);
        setConfig(interaction.guild.id, 'automod', am);
        return interaction.reply({ content: `✅ ${channel} retiré de la whitelist automod.`, flags: 64 });
      }
      if (!am.whitelist.includes(channel.id)) am.whitelist.push(channel.id);
      setConfig(interaction.guild.id, 'automod', am);
      return interaction.reply({ content: `✅ ${channel} exempté de l\'automod.`, flags: 64 });
    }
  },
};
