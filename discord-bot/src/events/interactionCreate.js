const {
  ChannelType, PermissionFlagsBits,
  EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getConfig, setTicket, getTickets, deleteTicket } = require('../utils/config');
const { sendLog } = require('../utils/logger');
const { createCaptcha, verifyCaptcha } = require('../utils/captcha');
const { getGiveaway, addParticipant, conditionMet, buildEmbed: buildGwEmbed } = require('../utils/giveaway');

// ── Smash or Pass — stockage des votes ──────────────────────────────────────
const sopPath = path.join(__dirname, '../../data/smashvotes.json');

function readSopVotes() {
  if (!fs.existsSync(sopPath)) return {};
  try { return JSON.parse(fs.readFileSync(sopPath, 'utf8')); } catch { return {}; }
}
function writeSopVotes(data) {
  fs.writeFileSync(sopPath, JSON.stringify(data, null, 2), 'utf8');
}

// Suivi des utilisateurs en attente de soumission (pour éviter les doubles clics)
const pendingSubmissions = new Set();

// Groupes de rôles
const ROLE_GROUPS = {
  activite: ['NUIT', 'JOURS'],
  identite: ['BOY', 'GIRL', 'EGIRL', 'TRANS'],
};

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ── Commandes slash ──────────────────────────��───────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

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
        if (interaction.replied || interaction.deferred)
          await interaction.followUp(msg).catch(() => {});
        else
          await interaction.reply(msg).catch(() => {});
      }
      return;
    }

    // ══════════════════════════════════════════════════════════════════
    // ── GIVEAWAY — Bouton : Participer ───────────────────────────────
    // ══════════════════════════════════════════════════════════════════
    if (interaction.isButton() && interaction.customId.startsWith('gw_join_')) {
      const gwId = interaction.customId.replace('gw_join_', '');
      const gw = getGiveaway(gwId);

      if (!gw) return interaction.reply({ content: '❌ Ce giveaway n\'existe plus.', flags: 64 });
      if (gw.ended || gw.endAt <= Date.now()) return interaction.reply({ content: '❌ Ce giveaway est terminé.', flags: 64 });

      if (gw.participants.includes(interaction.user.id)) {
        return interaction.reply({ content: '✅ Tu participes déjà à ce giveaway !', flags: 64 });
      }

      if (!conditionMet(interaction.guild.id, interaction.user.id, gw.condition, gw.seuil)) {
        const labels = { invitations: 'invitation(s)', messages: 'message(s) envoyé(s)', vocal: 'minute(s) en vocal' };
        return interaction.reply({
          content: `❌ Tu ne remplis pas la condition pour participer : **${gw.seuil}** ${labels[gw.condition] || ''} requis.`,
          flags: 64,
        });
      }

      const result = addParticipant(gwId, interaction.user.id);
      if (!result.ok) return interaction.reply({ content: '❌ Impossible de rejoindre ce giveaway.', flags: 64 });

      const updatedGw = getGiveaway(gwId);
      try {
        await interaction.update({ embeds: [buildGwEmbed(updatedGw)] });
        await interaction.followUp({ content: '✅ Tu participes maintenant au giveaway ! Bonne chance 🍀', flags: 64 });
      } catch {
        await interaction.reply({ content: '✅ Participation enregistrée !', flags: 64 }).catch(() => {});
      }
      return;
    }

    // ══════════════════════════════════════════════════════════════════
    // ── SMASH OR PASS — Bouton : Soumettre une photo ─────────────────
    // ══════════════════════════════════════════════════════════════════
    if (interaction.isButton() && interaction.customId === 'sop_submit') {
      const userId = interaction.user.id;

      // Anti-doublon : empêche de cliquer plusieurs fois
      if (pendingSubmissions.has(userId)) {
        return interaction.reply({
          content: '⏳ Tu as déjà une soumission en cours ! Envoie ta photo dans ce salon.',
          flags: 64,
        });
      }

      const config = getConfig(interaction.guild.id);
      if (!config.smashVoteChannel) {
        return interaction.reply({
          content: '❌ Le système Smash or Pass n\'est pas encore configuré. Un administrateur doit lancer `/setupsmash`.',
          flags: 64,
        });
      }

      pendingSubmissions.add(userId);

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xFF69B4)
          .setTitle('📸 Envoie ta photo !')
          .setDescription(
            '**Ouvre ta galerie et envoie ton image directement dans ce salon.**\n\n' +
            '• Sur **téléphone** : appuie sur le 📎 ou l\'icône image\n' +
            '• Sur **PC** : glisse l\'image ou clique sur 📎\n\n' +
            '⏳ Tu as **2 minutes** pour envoyer ta photo.\n' +
            '> Seules les images sont acceptées (jpg, png, gif, webp…)'
          )
          .setFooter({ text: 'Ta photo sera supprimée de ce salon et envoyée au salon de vote' })
          .setTimestamp()],
        flags: 64,
      });

      // Filtre : message du bon utilisateur avec au moins une image en pièce jointe
      const filter = m =>
        m.author.id === userId &&
        m.attachments.some(a => a.contentType && a.contentType.startsWith('image/'));

      try {
        const collected = await interaction.channel.awaitMessages({
          filter,
          max: 1,
          time: 120_000,
          errors: ['time'],
        });

        const userMessage = collected.first();
        const attachment  = userMessage.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));

        // Supprimer le message de l'utilisateur (garder le salon propre)
        await userMessage.delete().catch(() => {});

        const voteChannel = interaction.guild.channels.cache.get(config.smashVoteChannel);
        if (!voteChannel) {
          pendingSubmissions.delete(userId);
          return interaction.followUp({
            content: '❌ Le salon de vote est introuvable. Contacte un administrateur.',
            flags: 64,
          });
        }

        const botMember = interaction.guild.members.me;
        if (!voteChannel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
          pendingSubmissions.delete(userId);
          return interaction.followUp({
            content: `❌ Je n'ai pas la permission d'envoyer des messages dans ${voteChannel}.`,
            flags: 64,
          });
        }

        // Construire l'embed de vote avec l'image attachée
        const embed = new EmbedBuilder()
          .setColor(0xFF69B4)
          .setTitle('💘 Smash or Pass ?')
          .setDescription('Donne ton avis avec les boutons ci-dessous !')
          .setImage(attachment.url)
          .addFields(
            { name: '💚 Smash', value: '**0** vote(s)', inline: true },
            { name: '❌ Pass',  value: '**0** vote(s)', inline: true },
          )
          .setFooter({ text: `Soumis par ${interaction.user.tag}` })
          .setTimestamp();

        // Envoyer avec boutons temporaires
        const tempSmash = new ButtonBuilder().setCustomId('sop_smash_TMP').setLabel('💚 Smash').setStyle(ButtonStyle.Success);
        const tempPass  = new ButtonBuilder().setCustomId('sop_pass_TMP').setLabel('❌ Pass').setStyle(ButtonStyle.Danger);
        const sentMsg   = await voteChannel.send({
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(tempSmash, tempPass)],
        });

        // Remettre les vrais customIds avec le message ID réel
        const realSmash = new ButtonBuilder().setCustomId(`sop_smash_${sentMsg.id}`).setLabel('💚 Smash').setStyle(ButtonStyle.Success);
        const realPass  = new ButtonBuilder().setCustomId(`sop_pass_${sentMsg.id}`).setLabel('❌ Pass').setStyle(ButtonStyle.Danger);
        await sentMsg.edit({ embeds: [embed], components: [new ActionRowBuilder().addComponents(realSmash, realPass)] });

        pendingSubmissions.delete(userId);

        return interaction.followUp({
          embeds: [new EmbedBuilder()
            .setColor(0x00FF88)
            .setTitle('✅ Photo soumise avec succès !')
            .setDescription(`Ta photo a été envoyée dans ${voteChannel} pour le vote Smash or Pass ! 🎉`)
            .setTimestamp()],
          flags: 64,
        });

      } catch {
        // Timeout : l'utilisateur n'a pas envoyé de photo à temps
        pendingSubmissions.delete(userId);
        return interaction.followUp({
          embeds: [new EmbedBuilder()
            .setColor(0xFF4444)
            .setTitle('⏰ Temps écoulé !')
            .setDescription('Tu n\'as pas envoyé de photo dans les 2 minutes.\nClique à nouveau sur **📸 Soumettre ma photo** pour réessayer.')
            .setTimestamp()],
          flags: 64,
        });
      }
    }

    // ── SMASH OR PASS — Boutons de vote ─────��───────────────────────
    if (interaction.isButton() && (interaction.customId.startsWith('sop_smash_') || interaction.customId.startsWith('sop_pass_'))) {
      await interaction.deferReply({ flags: 64 });

      const parts     = interaction.customId.split('_');
      const choice    = parts[1];
      const messageId = parts[2];

      if (!messageId || messageId === 'TMP') return interaction.editReply({ content: '❌ Vote invalide.' });

      const votes = readSopVotes();
      if (!votes[messageId]) votes[messageId] = { smash: [], pass: [] };

      const entry    = votes[messageId];
      const userId   = interaction.user.id;
      const hadSmash = entry.smash.includes(userId);
      const hadPass  = entry.pass.includes(userId);

      entry.smash = entry.smash.filter(id => id !== userId);
      entry.pass  = entry.pass.filter(id => id !== userId);

      let replyText;
      if (choice === 'smash') {
        if (hadSmash) {
          replyText = '↩️ Ton vote **Smash** a été retiré.';
        } else {
          entry.smash.push(userId);
          replyText = hadPass ? '🔄 Changé de **Pass** à **💚 Smash** !' : '💚 Tu as voté **Smash** !';
        }
      } else {
        if (hadPass) {
          replyText = '↩️ Ton vote **Pass** a été retiré.';
        } else {
          entry.pass.push(userId);
          replyText = hadSmash ? '🔄 Changé de **Smash** à **❌ Pass** !' : '❌ Tu as voté **Pass** !';
        }
      }

      writeSopVotes(votes);

      // Mettre à jour l'embed
      const originalMessage = await interaction.message.fetch().catch(() => null);
      if (originalMessage) {
        const oldEmbed = originalMessage.embeds[0];
        if (oldEmbed) {
          const updatedEmbed = EmbedBuilder.from(oldEmbed).setFields(
            { name: '💚 Smash', value: `**${entry.smash.length}** vote(s)`, inline: true },
            { name: '❌ Pass',  value: `**${entry.pass.length}** vote(s)`,  inline: true },
          );
          await originalMessage.edit({ embeds: [updatedEmbed] }).catch(() => {});
        }
      }

      return interaction.editReply({ content: replyText });
    }

    // ══════════════════════════════════════════════════════════════════
    // ── Select Menu : Sélection de rôles ────────────────────────────
    // ══════════════════════════════════════════════════════════════════
    if (interaction.isStringSelectMenu() && (interaction.customId === 'role_activite' || interaction.customId === 'role_identite')) {
      await interaction.deferReply({ flags: 64 });

      const config    = getConfig(interaction.guild.id);
      const rolePanel = config.rolePanel;

      if (!rolePanel) return interaction.editReply({ content: '❌ Panneau de rôles non configuré. Lance `/setuproles`.' });

      const groupKey  = interaction.customId === 'role_activite' ? 'activite' : 'identite';
      const groupKeys = ROLE_GROUPS[groupKey];
      const selected  = interaction.values[0];

      const toRemove = groupKeys
        .filter(k => rolePanel[k])
        .map(k => rolePanel[k])
        .filter(id => interaction.member.roles.cache.has(id));

      for (const roleId of toRemove) await interaction.member.roles.remove(roleId).catch(() => {});

      if (!selected || selected.startsWith('NONE_')) {
        return interaction.editReply({ content: `✅ Rôles **${groupKey === 'activite' ? 'activité' : 'identité'}** retirés.` });
      }

      const roleId = rolePanel[selected];
      if (!roleId) return interaction.editReply({ content: '❌ Rôle introuvable dans la configuration.' });

      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) return interaction.editReply({ content: '❌ Le rôle n\'existe plus sur le serveur.' });

      await interaction.member.roles.add(role).catch(() => {});
      await interaction.member.fetch();

      const allPanelRoleIds = Object.values(rolePanel);
      const updatedRoles    = interaction.member.roles.cache
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
        if (interaction.member.roles.cache.has(config.verifRole))
          return interaction.reply({ content: '✅ Tu es déjà vérifié !', flags: 64 });
      }

      const code = createCaptcha(interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🔐 Vérification — Captcha')
        .setDescription(
          `Recopie exactement le code ci-dessous dans le formulaire :\n\n${formatCaptcha(code)}\n\n` +
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
        .setMinLength(6).setMaxLength(6)
        .setPlaceholder('Ex: X7K2P9')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // ── Modal : Vérification du captcha ──────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId === 'captcha_modal') {
      await interaction.deferReply({ flags: 64 });

      const input  = interaction.fields.getTextInputValue('captcha_input');
      const result = verifyCaptcha(interaction.user.id, input);

      if (!result.valid) {
        const msg = result.reason === 'expired'
          ? '⏰ Ton code a expiré. Clique à nouveau sur **🔐 Se vérifier**.'
          : '❌ Code incorrect. Clique à nouveau sur **🔐 Se vérifier** pour un nouveau code.';
        return interaction.editReply({ content: msg });
      }

      const config = getConfig(interaction.guild.id);
      if (!config.verifRole) return interaction.editReply({ content: '⚠️ Aucun rôle de vérification configuré.' });

      const role = interaction.guild.roles.cache.get(config.verifRole);
      if (!role) return interaction.editReply({ content: '⚠️ Le rôle de vérification est introuvable.' });

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

    // ── Bouton : Ouvrir un ticket ─────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'open_ticket') {
      await interaction.deferReply({ flags: 64 });

      const config  = getConfig(interaction.guild.id);
      const tickets = getTickets(interaction.guild.id);

      const existing = Object.values(tickets).find(t => t.userId === interaction.user.id);
      if (existing) {
        const ch = interaction.guild.channels.cache.get(existing.channelId);
        return interaction.editReply({ content: `❌ Tu as déjà un ticket ouvert : ${ch ? ch.toString() : 'introuvable'}.` });
      }

      const ticketCount = Object.keys(tickets).length + 1;
      const categoryId  = config.ticketCategory || null;

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

      await channel.send({
        content: `${interaction.user}${config.staffRole ? ` <@&${config.staffRole}>` : ''}`,
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(closeBtn)],
      });

      await sendLog(client, interaction.guild.id, 'ticket_open', {
        title: 'Ticket Ouvert',
        fields: [
          { name: 'Utilisateur', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
          { name: 'Salon', value: channel.toString(), inline: true },
        ],
      });

      return interaction.editReply({ content: `✅ Ton ticket a été créé : ${channel}` });
    }

    // ── Bouton : Fermer le ticket ─────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
      await interaction.deferReply({ flags: 64 });

      const config  = getConfig(interaction.guild.id);
      const tickets = getTickets(interaction.guild.id);
      const ticket  = tickets[interaction.channel.id];

      if (!ticket) return interaction.editReply({ content: '❌ Ce salon n\'est pas un ticket.' });

      const hasStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      const isOwner  = ticket.userId === interaction.user.id;
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
    A: '🅰', B: '🅱', C: '🇨', D: '🇩', E: '🇪', F: '🇫', G: '🇬', H: '🇭',
    J: '🇯', K: '🇰', L: '🇱', M: '🇲', N: '🇳', P: '🇵', Q: '🇶', R: '🇷',
    S: '🇸', T: '���', U: '🇺', V: '🇻', W: '🇼', X: '🇽', Y: '🇾', Z: '🇿',
    '2': '2️⃣', '3': '3️⃣', '4': '4️⃣', '5': '5️⃣', '6': '6️⃣',
    '7': '7️⃣', '8': '8️⃣', '9': '9️⃣',
  };
  return `> ## ${code.split('').map(c => blocks[c] || c).join(' ')}`;
}
