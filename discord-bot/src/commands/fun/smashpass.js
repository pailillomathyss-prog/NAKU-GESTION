const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('smashpass')
    .setDescription('Envoyer une photo Smash or Pass dans un salon de vote')
    .addAttachmentOption(o =>
      o.setName('photo')
        .setDescription('La photo à soumettre au vote Smash or Pass')
        .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName('salon')
        .setDescription('Salon où envoyer le vote (défaut : salon actuel)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });

    const attachment = interaction.options.getAttachment('photo');
    const targetChannel = interaction.options.getChannel('salon') || interaction.channel;

    // Vérifier que le fichier est bien une image
    if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
      return interaction.editReply({ content: '❌ Le fichier doit être une image (jpg, png, gif, webp…).' });
    }

    // Vérifier que le bot peut envoyer dans le salon cible
    const botMember = interaction.guild.members.me;
    if (!targetChannel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({ content: `❌ Je n'ai pas la permission d'envoyer des messages dans ${targetChannel}.` });
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF69B4)
      .setTitle('💘 Smash or Pass ?')
      .setDescription('Vote avec les boutons ci-dessous !')
      .setImage(attachment.url)
      .addFields(
        { name: '💚 Smash', value: '**0** vote(s)', inline: true },
        { name: '❌ Pass', value: '**0** vote(s)', inline: true },
      )
      .setFooter({ text: `Soumis par ${interaction.user.tag}` })
      .setTimestamp();

    const smashBtn = new ButtonBuilder()
      .setCustomId('sop_smash_PLACEHOLDER')
      .setLabel('💚 Smash')
      .setStyle(ButtonStyle.Success);

    const passBtn = new ButtonBuilder()
      .setCustomId('sop_pass_PLACEHOLDER')
      .setLabel('❌ Pass')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(smashBtn, passBtn);

    // Envoyer d'abord le message pour obtenir son ID
    const sentMsg = await targetChannel.send({ embeds: [embed], components: [row] });

    // Mettre à jour les boutons avec le vrai ID du message
    const smashBtnReal = new ButtonBuilder()
      .setCustomId(`sop_smash_${sentMsg.id}`)
      .setLabel('💚 Smash')
      .setStyle(ButtonStyle.Success);

    const passBtnReal = new ButtonBuilder()
      .setCustomId(`sop_pass_${sentMsg.id}`)
      .setLabel('❌ Pass')
      .setStyle(ButtonStyle.Danger);

    const rowReal = new ActionRowBuilder().addComponents(smashBtnReal, passBtnReal);
    await sentMsg.edit({ embeds: [embed], components: [rowReal] });

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle('✅ Vote Smash or Pass lancé !')
        .setDescription(`La photo a été envoyée dans ${targetChannel} avec les boutons de vote.`)
        .setTimestamp()],
    });
  },
};
