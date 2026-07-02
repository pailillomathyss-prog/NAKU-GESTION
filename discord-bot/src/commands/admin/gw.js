const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const {
  CONDITION_LABELS,
  createGiveaway, endGiveaway, rerollGiveaway, findByMessageId, listActive,
} = require('../../utils/giveaway');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gw')
    .setDescription('Gérer les giveaways du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Lancer un nouveau giveaway')
        .addStringOption(o => o.setName('lot').setDescription('Le lot à gagner').setRequired(true))
        .addStringOption(o => o.setName('duree').setDescription('Durée du giveaway').setRequired(true)
          .addChoices(
            { name: '1 minute', value: '1m' },
            { name: '5 minutes', value: '5m' },
            { name: '10 minutes', value: '10m' },
            { name: '30 minutes', value: '30m' },
            { name: '1 heure', value: '1h' },
            { name: '6 heures', value: '6h' },
            { name: '12 heures', value: '12h' },
            { name: '1 jour', value: '1j' },
            { name: '3 jours', value: '3j' },
            { name: '7 jours', value: '7j' },
          ))
        .addIntegerOption(o => o.setName('gagnants').setDescription('Nombre de gagnants').setRequired(true).setMinValue(1))
        .addStringOption(o => o.setName('condition').setDescription('Condition de participation').setRequired(true)
          .addChoices(
            { name: 'Aucune condition', value: 'aucune' },
            { name: 'Invitations', value: 'invitations' },
            { name: 'Messages envoyés', value: 'messages' },
            { name: 'Minutes en vocal', value: 'vocal' },
          ))
        .addIntegerOption(o => o.setName('seuil').setDescription('Seuil requis (si condition différente de "aucune")').setRequired(false).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('Terminer un giveaway immédiatement et tirer les gagnants')
        .addStringOption(o => o.setName('message_id').setDescription('ID du message du giveaway').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reroll')
        .setDescription('Retirer un nouveau gagnant pour un giveaway déjà terminé')
        .addStringOption(o => o.setName('message_id').setDescription('ID du message du giveaway').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Lister les giveaways actifs sur ce serveur')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    // ── /gw start ─────────────────────────────────────────────────────
    if (sub === 'start') {
      const prize     = interaction.options.getString('lot');
      const duree     = interaction.options.getString('duree');
      const gagnants  = interaction.options.getInteger('gagnants');
      const condition = interaction.options.getString('condition');
      const seuil     = interaction.options.getInteger('seuil') || 0;

      if (condition !== 'aucune' && seuil < 1) {
        return interaction.reply({
          content: `❌ Précise un \`seuil\` (nombre requis) pour la condition **${condition}**.`,
          flags: 64,
        });
      }

      await interaction.deferReply({ flags: 64 });

      const { gw } = await createGiveaway(client, {
        guild: interaction.guild, channel: interaction.channel, host: interaction.user,
        prize, durationKey: duree, winnersCount: gagnants, condition, seuil,
      });

      // ── DM à tous les membres pour annoncer le giveaway ──────────────
      await interaction.guild.members.fetch();
      const members = interaction.guild.members.cache.filter(m => !m.user.bot);
      const jumpLink = `https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}/${gw.messageId}`;

      const announceEmbed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`🎉 Nouveau Giveaway sur ${interaction.guild.name} !`)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setDescription(
          `🏆 **Lot :** ${prize}\n` +
          `🕐 **Fin :** <t:${Math.floor(gw.endAt / 1000)}:R>\n` +
          `🎖️ **Gagnant(s) :** ${gagnants}\n` +
          `📋 **Condition :** ${CONDITION_LABELS[condition]}${condition !== 'aucune' ? ` (**${seuil}** requis)` : ''}\n\n` +
          `👉 [Clique ici pour participer](${jumpLink})`
        )
        .setFooter({ text: `Organisé par ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply(`✅ Giveaway lancé dans ${interaction.channel} !\n⏳ Envoi des DM d'annonce à **${members.size}** membre(s)...`);

      let sent = 0, failed = 0, count = 0;
      for (const [, member] of members) {
        try { await member.user.send({ embeds: [announceEmbed] }); sent++; }
        catch { failed++; }
        count++;
        if (count % 10 === 0) {
          await interaction.editReply(`⏳ Envoi des DM d'annonce... (${count}/${members.size})`).catch(() => {});
        }
        await new Promise(r => setTimeout(r, 1100));
      }

      await interaction.editReply(
        `✅ Giveaway lancé pour **${prize}** dans ${interaction.channel} !\n📨 ${sent} membre(s) prévenu(s) par DM${failed ? ` (${failed} DM échoué(s), DMs désactivés)` : ''}.`
      );
      return;
    }

    // ── /gw end ───────────────────────────────────────────────────────
    if (sub === 'end') {
      const messageId = interaction.options.getString('message_id');
      const found = findByMessageId(interaction.guild.id, messageId);
      if (!found) return interaction.reply({ content: '❌ Giveaway introuvable. Vérifie l\'ID du message.', flags: 64 });

      const [gwId, gw] = found;
      if (gw.ended) return interaction.reply({ content: '❌ Ce giveaway est déjà terminé.', flags: 64 });

      await interaction.deferReply({ flags: 64 });
      const winners = await endGiveaway(client, gwId);
      return interaction.editReply(
        winners && winners.length
          ? `✅ Giveaway terminé. Gagnant(s) : ${winners.map(id => `<@${id}>`).join(', ')}`
          : '✅ Giveaway terminé, aucun participant valide.'
      );
    }

    // ── /gw reroll ────────────────────────────────────────────────────
    if (sub === 'reroll') {
      const messageId = interaction.options.getString('message_id');
      const found = findByMessageId(interaction.guild.id, messageId);
      if (!found) return interaction.reply({ content: '❌ Giveaway introuvable. Vérifie l\'ID du message.', flags: 64 });

      const [gwId, gw] = found;
      if (!gw.ended) return interaction.reply({ content: '❌ Ce giveaway n\'est pas encore terminé. Utilise `/gw end` d\'abord.', flags: 64 });

      await interaction.deferReply({ flags: 64 });
      const winners = await rerollGiveaway(client, gwId);
      return interaction.editReply(
        winners && winners.length
          ? `✅ Reroll effectué. Nouveau(x) gagnant(s) : ${winners.map(id => `<@${id}>`).join(', ')}`
          : '❌ Aucun participant valide pour le reroll.'
      );
    }

    // ── /gw list ──────────────────────────────────────────────────────
    if (sub === 'list') {
      const active = listActive(interaction.guild.id);
      if (!active.length) return interaction.reply({ content: '📭 Aucun giveaway actif sur ce serveur.', flags: 64 });

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎉 Giveaways actifs')
        .setDescription(active.map(g =>
          `**${g.prize}** — <t:${Math.floor(g.endAt / 1000)}:R> — ${g.participants.length} participant(s)\n[Voir le giveaway](https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId})`
        ).join('\n\n'))
        .setTimestamp();
      return interaction.reply({ embeds: [embed], flags: 64 });
    }
  },
};
