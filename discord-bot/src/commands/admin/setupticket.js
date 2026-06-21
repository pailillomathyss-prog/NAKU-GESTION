const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType } = require('discord.js');
const { setConfig } = require('../../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupticket')
    .setDescription('Configurer le système de tickets')
    .addChannelOption(o => o.setName('salon').setDescription('Salon où poster le panneau de tickets').setRequired(true))
    .addRoleOption(o => o.setName('staff').setDescription('Rôle du staff qui peut voir les tickets').setRequired(false))
    .addChannelOption(o => o.setName('catégorie').setDescription('Catégorie pour les tickets').setRequired(false))
    .addStringOption(o => o.setName('titre').setDescription('Titre du message de ticket').setRequired(false))
    .addStringOption(o => o.setName('description').setDescription('Description du message de ticket').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const channel = interaction.options.getChannel('salon');
    const staffRole = interaction.options.getRole('staff');
    const category = interaction.options.getChannel('catégorie');
    const titre = interaction.options.getString('titre') || '🎫 Support NAKU';
    const description = interaction.options.getString('description') || 'Clique sur le bouton ci-dessous pour ouvrir un ticket.\nNotre équipe te répondra dès que possible.';

    if (staffRole) setConfig(interaction.guild.id, 'staffRole', staffRole.id);
    if (category) setConfig(interaction.guild.id, 'ticketCategory', category.id);

    const embed = new EmbedBuilder()
      .setColor(0x00AAFF)
      .setTitle(titre)
      .setDescription(description)
      .setFooter({ text: interaction.guild.name })
      .setTimestamp();

    const btn = new ButtonBuilder()
      .setCustomId('open_ticket')
      .setLabel('📩 Ouvrir un ticket')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(btn);

    await channel.send({ embeds: [embed], components: [row] });

    await interaction.editReply({ content: `✅ Panneau de tickets posté dans ${channel}.` });
  },
};
