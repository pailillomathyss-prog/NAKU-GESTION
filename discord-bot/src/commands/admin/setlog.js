const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setConfig } = require('../../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setDescription('Configurer le salon de logs')
    .addChannelOption(o => o.setName('salon').setDescription('Le salon où envoyer les logs').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon');

    setConfig(interaction.guild.id, 'logChannel', channel.id);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('✅ Salon de logs configuré')
        .setDescription(`Les logs seront envoyés dans ${channel}.`)
        .setTimestamp()],
      flags: 64,
    });
  },
};
