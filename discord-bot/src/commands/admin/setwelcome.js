const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setConfig } = require('../../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Configurer le salon de bienvenue')
    .addChannelOption(o => o.setName('salon').setDescription('Le salon de bienvenue').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon');
    setConfig(interaction.guild.id, 'welcomeChannel', channel.id);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('✅ Salon de bienvenue configuré')
        .setDescription(`Les messages de bienvenue seront envoyés dans ${channel}.`)
        .setTimestamp()],
      flags: 64,
    });
  },
};
