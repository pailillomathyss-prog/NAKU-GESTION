const {
  InteractionType, ChannelType, PermissionFlagsBits,
  EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { getConfig, setTicket, getTickets, deleteTicket } = require('../utils/config');
const { sendLog } = require('../utils/logger');
const { createCaptcha, verifyCaptcha } = require('../utils/captcha');

// Groupes de rôles pour le panneau de sélection
const ROLE_GROUPS = {
  activite:  ['NUIT', 'JOURS'],
  identite:  ['BOY', 'GIRL', 'EGIRL', 'TRANS'],
};

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ── Commandes slash ─────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      // Vérification stricte : seuls les Administrateurs peuvent utiliser les commandes
      if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚫 Accès refusé')
            .setDescription('Tu dois avoir la permission **Administrateur** pour utiliser les commandes de ce bot.')
            .setTimestamp()],
          flags: 64,
        });
      }

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

    // ── Select Menu : Sélection de rôles ────────────────────────────
    if (interaction.isStringSelectMenu() && (interaction.customId === 'role_activite' || interaction.customId === 'role_identite')) {
      await interaction.deferReply({ flags: 64 });

      const config = getConfig(interaction.guild.id);
      const rolePanel = config.rolePanel;

      if (!rolePanel) {
        return interaction.editReply({ content: '❌ Panneau de rôles non configuré. Lance `/setuproles`.' });
      }

      const groupKey = interaction.customId === 'role_activite' ? 'activite' : 'identite';
      const groupKeys = ROLE_GROUPS[groupKey];
      const selected = interaction.values[0]; // max 1 par groupe

      // Retirer tous les rôles du groupe actuel du membre
      const toRemove = groupKeys
        .filter(k => rolePanel[k])
        .map(k => rolePanel[k])
        .filter(id => interaction.member.roles.cache.has(id));

      for (const roleId of toRemove) {
        await interaction.member.roles.remove(roleId).catch(() => {});
      }

      // Si "Aucun" ou pas de sélection → juste retirer
      if (!selected || selected.startsWith('NONE_')) {
        return interaction.editReply({
          content: `✅ Rôles **${groupKey === 'activite' ? 'activité' : 'identité'}** retirés.`,
        });
      }

      // Ajouter le nouveau rôle
      const roleId = rolePanel[selected];
      if (!roleId) {
        return interaction.editReply({ content: '❌ Rôle introuvable dans la configuration.' });
      }

      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) {
        return interaction.editReply({ content: '❌ Le rôle n\'existe plus sur le serveur.' });
      }

      await interaction.member.roles.add(role).catch(() => {});

      // Calculer les rôles du panneau que le membre a maintenant
      const allPanelRoleIds = Object.values(rolePanel);
      const memberPanelRoles = interaction.member.roles.cache
        .filter(r => allPanelRoleIds.includes(r.id))
        .map(r => r.toString());

      // Mettre à jour le membre (forcer le rechargement)
      await interaction.member.fetch();
      const updatedRoles = interaction.member.roles.cache
        .filter(r => allPanelRoleIds.includes(r.id))
        .map(r => r.toString());

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x00FF88)
          .setTitle('✅ Rôles mis à jour')
          .addFields(
            { name: '🎭 Rôle ajouté', value: role.toString(), inline: true },
            { name: '📋 Tes rôles actuels', value: updatedRoles.length ? updatedRoles.join(', ') : 'Aucun', inline: true },
          )
          .setTimestamp()],
      });
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

      return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)], flags: 64 });
    }

    // ── Bouton : Ouvrir le modal captcha ─────────────────────────────
    if (interaction.isButton() && interaction.customId === 'enter_captcha') {
      const modal = new ModalBuilder()
        .setCustomId('captcha_modal')
        .setTitle('🔐 Entrez votre code captcha');

      const input = new TextInputBuilder()
        .setCustomId('captcha_input')
        .setLabel('Code captcha (6 caractères)')
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
          ? '⏰ Ton code a expiré. Clique à nouveau sur **🔐 Se vérifier**.'
          : '❌ Code incorrect. Clique à nouveau sur **🔐 Se vérifier** pour un nouveau code.';
        return interaction.editReply({ content: msg });
      }

      const config = getConfig(interaction.guild.id);

      if (!config.verifRole) {
        return interaction.editReply({ content: '⚠️ Aucun rôle de vérification configuré.' });
      }

      const role = interaction.guild.roles.cache.get(config.verifRole);
      if (!role) {
        return interaction.editReply({ content: '⚠️ Le rôle de vérification est introuvable.' });
      }

      try {
        await interaction.member.roles.add(role);
      } catch {
        return interaction.editReply({ content: '❌ Impossible d\'attribuer le rôle. Vérifie les permissions du bot.' });
      }

      await sendLog(client, interaction.guild.id, 'member_join', {
        title: '✅ Membre Vérifié',
        description: `${interaction.user} a passé la vérification et reçu **${role.name}**.`,
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

      const embed = new EmbedBuilder()
        .setColor(0x00AAFF)
        .setTitle('🎫 Nouveau Ticket')
        .setDescription(`Bonjour ${interaction.user}, merci d'avoir ouvert un ticket !\n\nExplique-nous ton problème, l'équipe sera là pour t'aider.`)
        .setFooter({ text: `Ticket #${ticketCount}` })
        .setTimestamp();

      await channel.send({ content: `${interaction.user}${config.staffRole ? ` <@&${config.staffRole}>` : ''}`, embeds: [embed], components: [new ActionRowBuilder().addComponents(closeBtn)] });

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
          { name: 'Fermé par', value: `${interaction.user.tag}`, inline: true },
          { name: 'Propriétaire', value: `<@${ticket.userId}>`, inline: true },
        ],
      });

      deleteTicket(interaction.guild.id, interaction.channel.id);
      await interaction.editReply({ content: '🔒 Fermeture dans 5 secondes...' });
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
