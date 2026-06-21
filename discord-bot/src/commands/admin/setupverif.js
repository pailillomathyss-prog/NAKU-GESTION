const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { setConfig, getConfig } = require('../../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupverif')
    .setDescription('Configurer le panneau de vérification avec captcha')
    .addChannelOption(o => o.setName('salon').setDescription('Salon où poster le panneau de vérification').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Rôle à donner après vérification (ex: @VÉRIF)').setRequired(true))
    .addStringOption(o => o.setName('titre').setDescription('Titre du panneau').setRequired(false))
    .addStringOption(o => o.setName('description').setDescription('Description du panneau').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const channel = interaction.options.getChannel('salon');
    const role = interaction.options.getRole('role');
    const titre = interaction.options.getString('titre') || '📋 Vérification — Règlement';
    const description = interaction.options.getString('description')
      || `Bienvenue sur **${interaction.guild.name}** !\n\nPour accéder au serveur, tu dois :\n\n**1.** Lire et accepter le règlement\n**2.** Cliquer sur **🔐 Se vérifier**\n**3.** Résoudre le captcha et entrer le code\n\nTu recevras automatiquement le rôle <@&${role.id}> qui te donnera accès aux salons.`;

    setConfig(interaction.guild.id, 'verifRole', role.id);

    const config = getConfig(interaction.guild.id);
    const rules = config.rules || [];

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(titre)
      .setDescription(description)
      .setFooter({ text: `${interaction.guild.name} • Vérification requise` })
      .setTimestamp();

    if (rules.length) {
      embed.addFields({
        name: '📜 Règlement',
        value: rules.map((r, i) => `**${i + 1}.** ${r}`).join('\n'),
        inline: false,
      });
    }

    embed.addFields({
      name: '\u200b',
      value: '> En cliquant sur **🔐 Se vérifier**, tu confirmes avoir lu et accepté le règlement.',
      inline: false,
    });

    const btn = new ButtonBuilder()
      .setCustomId('start_verif')
      .setLabel('🔐 Se vérifier')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(btn);

    await channel.send({ embeds: [embed], components: [row] });

    await interaction.editReply({ content: `✅ Panneau de vérification posté dans ${channel}.\nLe rôle **${role.name}** sera attribué après validation.` });
  },
};
