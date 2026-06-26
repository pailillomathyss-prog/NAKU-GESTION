const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');
const { getConfig, setConfig } = require('../../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupsmash')
    .setDescription('Configurer le système Smash or Pass (salons + panel)')
    .addChannelOption(o =>
      o.setName('salon-selection')
        .setDescription('Salon où le panel de soumission de photo sera affiché')
        .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName('salon-vote')
        .setDescription('Salon où les photos seront envoyées pour les votes Smash/Pass')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });

    const selectionChannel = interaction.options.getChannel('salon-selection');
    const voteChannel      = interaction.options.getChannel('salon-vote');

    const botMember = interaction.guild.members.me;

    // Vérifier permissions dans les deux salons
    if (!selectionChannel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({ content: `❌ Je n'ai pas la permission d'envoyer des messages dans ${selectionChannel}.` });
    }
    if (!voteChannel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({ content: `❌ Je n'ai pas la permission d'envoyer des messages dans ${voteChannel}.` });
    }

    // Sauvegarder la configuration
    setConfig(interaction.guild.id, 'smashSelectionChannel', selectionChannel.id);
    setConfig(interaction.guild.id, 'smashVoteChannel', voteChannel.id);

    // Créer le panel dans le salon de sélection
    const embed = new EmbedBuilder()
      .setColor(0xFF69B4)
      .setTitle('💘 Smash or Pass — Soumets ta photo !')
      .setDescription(
        '**Comment ça marche ?**\n\n' +
        '1️⃣ Clique sur le bouton **📸 Soumettre ma photo** ci-dessous\n' +
        '2️⃣ Colle le **lien** de ta photo dans le formulaire\n' +
        '3️⃣ Ta photo sera envoyée dans le salon de vote\n' +
        '4️⃣ Les membres voteront **Smash** 💚 ou **Pass** ❌\n\n' +
        `📊 Les votes apparaissent dans ${voteChannel}`
      )
      .setFooter({ text: 'Un seul vote par personne • Tu peux changer d\'avis à tout moment' })
      .setTimestamp();

    const submitBtn = new ButtonBuilder()
      .setCustomId('sop_submit')
      .setLabel('📸 Soumettre ma photo')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(submitBtn);

    await selectionChannel.send({ embeds: [embed], components: [row] });

    // Réponse de confirmation
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle('✅ Smash or Pass configuré !')
        .addFields(
          { name: '📝 Salon de sélection', value: selectionChannel.toString(), inline: true },
          { name: '📊 Salon de vote', value: voteChannel.toString(), inline: true },
        )
        .setDescription('Le panel a été envoyé dans le salon de sélection. Les membres peuvent maintenant soumettre leurs photos !')
        .setTimestamp()],
    });
  },
};
