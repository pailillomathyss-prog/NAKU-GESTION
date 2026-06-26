const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('massdm')
    .setDescription('Envoyer un DM à tous les membres du serveur avec une annonce')
    .addStringOption(o =>
      o.setName('message')
        .setDescription('Le texte de l\'annonce à envoyer')
        .setRequired(true)
        .setMaxLength(1800)
    )
    .addStringOption(o =>
      o.setName('lien')
        .setDescription('Lien d\'invitation du serveur à inclure (ex: https://discord.gg/xxx)')
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('titre')
        .setDescription('Titre de l\'annonce (défaut: "📢 Annonce")')
        .setRequired(false)
        .setMaxLength(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });

    const messageText = interaction.options.getString('message');
    const inviteLink  = interaction.options.getString('lien') || null;
    const titre       = interaction.options.getString('titre') || `📢 Annonce — ${interaction.guild.name}`;

    // Valider le lien si fourni
    if (inviteLink) {
      try {
        const url = new URL(inviteLink);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        return interaction.editReply({ content: '❌ Le lien fourni n\'est pas valide. Il doit commencer par `https://`.' });
      }
    }

    // Charger tous les membres du serveur
    await interaction.guild.members.fetch();
    const members = interaction.guild.members.cache.filter(m => !m.user.bot);

    if (members.size === 0) {
      return interaction.editReply({ content: '❌ Aucun membre trouvé sur le serveur.' });
    }

    // Construire l'embed d'annonce
    const announcembed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(titre)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }))
      .setDescription(messageText)
      .setFooter({ text: `Message envoyé depuis ${interaction.guild.name}`, iconURL: interaction.guild.iconURL({ dynamic: true }) })
      .setTimestamp();

    if (inviteLink) {
      announcembed.addFields({ name: '🔗 Rejoindre le serveur', value: inviteLink, inline: false });
    }

    // Confirmer le début de l'envoi
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle('⏳ Envoi en cours...')
        .setDescription(`Envoi du DM à **${members.size}** membres.\n> Cette opération peut prendre plusieurs minutes selon la taille du serveur.`)
        .addFields({ name: '⚡ Progression', value: `0 / ${members.size}`, inline: true })
        .setTimestamp()],
    });

    let sent   = 0;
    let failed = 0;
    let count  = 0;

    for (const [, member] of members) {
      try {
        await member.user.send({ embeds: [announcembed] });
        sent++;
      } catch {
        // DMs désactivés ou bloqué
        failed++;
      }

      count++;

      // Mettre à jour la progression toutes les 5 personnes
      if (count % 5 === 0) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xFFAA00)
            .setTitle('⏳ Envoi en cours...')
            .setDescription(`Envoi du DM à **${members.size}** membres.`)
            .addFields(
              { name: '⚡ Progression', value: `${count} / ${members.size}`, inline: true },
              { name: '✅ Envoyés', value: `${sent}`, inline: true },
              { name: '❌ Échoués', value: `${failed}`, inline: true },
            )
            .setTimestamp()],
        }).catch(() => {});
      }

      // Pause pour éviter le rate limit Discord (1 DM/s recommandé)
      await new Promise(r => setTimeout(r, 1100));
    }

    // Résumé final
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(sent > 0 ? 0x00FF88 : 0xFF4444)
        .setTitle('✅ Mass DM terminé !')
        .addFields(
          { name: '✅ Envoyés',  value: `**${sent}**`,           inline: true },
          { name: '❌ Échoués',  value: `**${failed}**`,          inline: true },
          { name: '👥 Total',   value: `**${members.size}**`,    inline: true },
        )
        .setDescription(
          failed > 0
            ? `> ⚠️ Les DMs échoués concernent les membres qui ont **désactivé les DMs** des serveurs dans leurs paramètres Discord.`
            : '> Tous les membres ont bien reçu le DM !'
        )
        .setTimestamp()],
    });
  },
};
