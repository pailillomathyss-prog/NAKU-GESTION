const {
  InteractionType, ChannelType, PermissionFlagsBits,
  EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { getConfig, setTicket, getTickets, deleteTicket } = require('../utils/config');
const { sendLog } = require('../utils/logger');
const { createCaptcha, verifyCaptcha } = require('../utils/captcha');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ── Commandes slash ─────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(err);
        const msg = { content: '❌ Une erreur est survenue.', flags: 64 };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => {});
        } else {
          await interaction.reply(msg).catch(() => {});
        }
      }
      return;
    }

    // ── Bouton : Démarrer la vérification captcha ────────────────────
    if (interaction.isButton() && interaction.customId === 'start_verif') {
      const config = getConfig(interaction.guild.id);

      if (config.verifRole) {
        const alreadyVerified = interaction.member.roles.cache.has(config.verifRole);
        if (alreadyVerified) {
          return interaction.reply({ content: '✅ Tu es déjà vérifié !', flags: 64 });
        }
      }

      const code = createCaptcha(interaction.user.id);

      const captchaDisplay = formatCaptcha(code);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🔐 Vérification — Captcha')
        .setDescription(
          `Recopie exactement le code ci-dessous dans le formulaire :\n\n${captchaDisplay}\n\n` +
          `⏳ Ce code expire dans **5 minutes**.\n` +
          `> Les espaces et la casse n'ont pas d'importance.`
        )
        .setFooter({ text: 'Clique sur "Entrer le code" ci-dessous' })
        .setTimestamp();

      const btn = new ButtonBuilder()
        .setCustomId('enter_captcha')
        .setLabel('📝 Entrer le code')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(btn);

      return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    }

    // ── Bouton : Ouvrir le modal de saisie captcha ───────────────────
    if (interaction.isButton() && interaction.customId === 'enter_captcha') {
      const modal = new ModalBuilder()
        .setCustomId('captcha_modal')
        .setTitle('🔐 Entrez votre code captcha');

      const input = new TextInputBuilder()
        .setCustomId('captcha_input')
        .setLabel('Code captcha (lettres et chiffres)')
        .setStyle(TextInputStyle.Short)
        .setMinLength(6)
        .setMaxLength(6)
        .setPlaceholder('Ex: X7K2P9')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // ── Modal : Vérification du captcha ─────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId === 'captcha_modal') {
      await interaction.deferReply({ flags: 64 });

      const input = interaction.fields.getTextInputValue('captcha_input');
      const result = verifyCaptcha(interaction.user.id, input);

      if (!result.valid) {
        const msg = result.reason === 'expired'
          ? '⏰ Ton code a expiré. Clique à nouveau sur **🔐 Se vérifier** pour en obtenir un nouveau.'
          : '❌ Code incorrect. Clique à nouveau sur **🔐 Se vérifier** pour obtenir un nouveau code.';
        return interaction.editReply({ content: msg });
      }

      const config = getConfig(interaction.guild.id);

      if (!config.verifRole) {
        return interaction.editReply({ content: '⚠️ Aucun rôle de vérification configuré. Contactez un administrateur.' });
      }

      const role = interaction.guild.roles.cache.get(config.verifRole);
      if (!role) {
        return interaction.editReply({ content: '⚠️ Le rôle de vérification est introuvable. Contactez un administrateur.' });
      }

      try {
        await interaction.member.roles.add(role);
      } catch {
        return interaction.editReply({ content: '❌ Impossible d\'attribuer le rôle. Vérifie que le bot a la permission **Gérer les rôles** et que son rôle est au-dessus du rôle de vérification.' });
      }

      await sendLog(client, interaction.guild.id, 'member_join', {
        title: '✅ Membre Vérifié',
        description: `${interaction.user} a passé la vérification captcha et a reçu le rôle **${role.name}**.`,
        thumbnail: interaction.user.displayAvatarURL({ dynamic: true }),
        fields: [
          { name: 'Utilisateur', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
          { name: 'Rôle attribué', value: role.name, inline: true },
        ],
      });

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x00FF88)
          .setTitle('✅ Vérification réussie !')
          .setDescription(`Bienvenue sur **${interaction.guild.name}** !\nTu as reçu le rôle <@&${role.id}> et peux maintenant accéder aux salons. 🎉`)
          .setTimestamp()],
      });
    }

    // ── Bouton : Ouvrir un ticket ────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'open_ticket') {
      await interaction.deferReply({ flags: 64 });

      const config = getConfig(interaction.guild.id);
      const tickets = getTickets(interaction.guild.id);

      const existing = Object.values(tickets).find(t => t.userId === interaction.user.id);
      if (existing) {
        const ch = interaction.guild.channels.cache.get(existing.channelId);
        return interaction.editReply({ content: `❌ Tu as déjà un ticket ouvert : ${ch ? ch.toString() : 'introuvable'}.` });
      }

      const ticketCount = Object.keys(tickets).length + 1;
      const categoryId = config.ticketCategory || null;

      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          ...(config.staffRole ? [{ id: config.staffRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
        ],
      });

      const ticketData = { channelId: channel.id, userId: interaction.user.id, number: ticketCount, openedAt: new Date().toISOString() };
      setTicket(interaction.guild.id, channel.id, ticketData);

      const closeBtn = new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Fermer le ticket').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(closeBtn);

      const embed = new EmbedBuilder()
        .setColor(0x00AAFF)
        .setTitle('🎫 Nouveau Ticket')
        .setDescription(`Bonjour ${interaction.user}, merci d'avoir ouvert un ticket !\n\nExplique-nous ton problème, l'équipe sera là pour t'aider.`)
        .setFooter({ text: `Ticket #${ticketCount}` })
        .setTimestamp();

      await channel.send({ content: `${interaction.user}${config.staffRole ? ` <@&${config.staffRole}>` : ''}`, embeds: [embed], components: [row] });

      await sendLog(client, interaction.guild.id, 'ticket_open', {
        title: 'Ticket Ouvert',
        fields: [
          { name: 'Utilisateur', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
          { name: 'Salon', value: channel.toString(), inline: true },
        ],
      });

      return interaction.editReply({ content: `✅ Ton ticket a été créé : ${channel}` });
    }

    // ── Bouton : Fermer le ticket ────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
      await interaction.deferReply({ flags: 64 });

      const config = getConfig(interaction.guild.id);
      const tickets = getTickets(interaction.guild.id);
      const ticket = tickets[interaction.channel.id];

      if (!ticket) return interaction.editReply({ content: '❌ Ce salon n\'est pas un ticket.' });

      const hasStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      const isOwner = ticket.userId === interaction.user.id;
      if (!hasStaff && !isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply({ content: '❌ Tu n\'as pas la permission de fermer ce ticket.' });
      }

      await sendLog(client, interaction.guild.id, 'ticket_close', {
        title: 'Ticket Fermé',
        fields: [
          { name: 'Fermé par', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
          { name: 'Propriétaire du ticket', value: `<@${ticket.userId}>`, inline: true },
        ],
      });

      deleteTicket(interaction.guild.id, interaction.channel.id);

      await interaction.editReply({ content: '🔒 Fermeture du ticket dans 5 secondes...' });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
  },
};

function formatCaptcha(code) {
  const blocks = {
    A:'🅰', B:'🅱', C:'🇨', D:'🇩', E:'🇪', F:'🇫', G:'🇬', H:'🇭',
    J:'🇯', K:'🇰', L:'🇱', M:'🇲', N:'🇳', P:'🇵', Q:'🇶', R:'🇷',
    S:'🇸', T:'🇹', U:'🇺', V:'🇻', W:'🇼', X:'🇽', Y:'🇾', Z:'🇿',
    '2':'2️⃣', '3':'3️⃣', '4':'4️⃣', '5':'5️⃣', '6':'6️⃣',
    '7':'7️⃣', '8':'8️⃣', '9':'9️⃣',
  };
  return `> ## ${code.split('').map(c => blocks[c] || c).join(' ')}`;
}
