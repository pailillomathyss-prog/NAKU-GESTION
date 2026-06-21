const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getConfig, setConfig } = require('../../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reglement')
    .setDescription('Gérer le règlement du serveur')
    .addSubcommand(s => s
      .setName('afficher')
      .setDescription('Afficher le règlement actuel'))
    .addSubcommand(s => s
      .setName('poster')
      .setDescription('Poster le règlement dans un salon')
      .addChannelOption(o => o.setName('salon').setDescription('Salon où poster le règlement').setRequired(true)))
    .addSubcommand(s => s
      .setName('definir')
      .setDescription('Définir le règlement (jusqu\'à 10 règles)')
      .addStringOption(o => o.setName('regle1').setDescription('Règle 1').setRequired(true))
      .addStringOption(o => o.setName('regle2').setDescription('Règle 2').setRequired(false))
      .addStringOption(o => o.setName('regle3').setDescription('Règle 3').setRequired(false))
      .addStringOption(o => o.setName('regle4').setDescription('Règle 4').setRequired(false))
      .addStringOption(o => o.setName('regle5').setDescription('Règle 5').setRequired(false))
      .addStringOption(o => o.setName('regle6').setDescription('Règle 6').setRequired(false))
      .addStringOption(o => o.setName('regle7').setDescription('Règle 7').setRequired(false))
      .addStringOption(o => o.setName('regle8').setDescription('Règle 8').setRequired(false))
      .addStringOption(o => o.setName('regle9').setDescription('Règle 9').setRequired(false))
      .addStringOption(o => o.setName('regle10').setDescription('Règle 10').setRequired(false)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guild.id);

    if (sub === 'definir') {
      const regles = [];
      for (let i = 1; i <= 10; i++) {
        const r = interaction.options.getString(`regle${i}`);
        if (r) regles.push(r);
      }

      setConfig(interaction.guild.id, 'rules', regles);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('✅ Règlement défini')
        .setDescription(`${regles.length} règle(s) enregistrée(s).`);

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (sub === 'afficher' || sub === 'poster') {
      const rules = config.rules || [];
      if (!rules.length) {
        return interaction.reply({ content: '❌ Aucun règlement défini. Utilisez `/reglement definir` d\'abord.', flags: 64 });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📜 Règlement de ${interaction.guild.name}`)
        .setDescription(rules.map((r, i) => `**${i + 1}.** ${r}`).join('\n\n'))
        .setFooter({ text: 'En rejoignant ce serveur, vous acceptez ce règlement.' })
        .setTimestamp();

      if (sub === 'afficher') {
        return interaction.reply({ embeds: [embed], flags: 64 });
      }

      const channel = interaction.options.getChannel('salon');
      await channel.send({ embeds: [embed] });
      return interaction.reply({ content: `✅ Règlement posté dans ${channel}.`, flags: 64 });
    }
  },
};
