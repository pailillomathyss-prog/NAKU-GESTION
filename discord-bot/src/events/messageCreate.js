const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getWarns, addWarn, getConfig, setConfig } = require('../utils/config');
const { sendLog } = require('../utils/logger');
const { checkLink, checkSpam, checkSticker } = require('../utils/automod');
const { incrementMessages } = require('../utils/stats');
const {
  parseDuration: parseGwDuration, CONDITION_LABELS: GW_CONDITION_LABELS,
  createGiveaway, endGiveaway, rerollGiveaway, findByMessageId, listActive,
} = require('../utils/giveaway');
const fs = require('fs');
const path = require('path');

const PREFIX = '!';

const DURATIONS_MS = {
  '10m': 10 * 60 * 1000, '30m': 30 * 60 * 1000,
  '1h': 3600 * 1000, '6h': 6 * 3600 * 1000,
  '12h': 12 * 3600 * 1000, '1j': 86400 * 1000,
  '3j': 3 * 86400 * 1000, '7j': 7 * 86400 * 1000,
};

const sanctionCooldown = new Map();

function isAdmin(member)    { return member.permissions.has(PermissionFlagsBits.Administrator); }
function isMod(member)      { return member.permissions.has(PermissionFlagsBits.ModerateMembers); }
function canBan(member)     { return member.permissions.has(PermissionFlagsBits.BanMembers); }
function canKick(member)    { return member.permissions.has(PermissionFlagsBits.KickMembers); }
function canManageMsg(member) { return member.permissions.has(PermissionFlagsBits.ManageMessages); }
function canManageCh(member)  { return member.permissions.has(PermissionFlagsBits.ManageChannels); }

async function handleAutomod(message, client) {
  if (!message.guild || message.author.bot) return false;
  if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

  const userId = message.author.id;
  const now = Date.now();
  if (sanctionCooldown.has(userId) && now - sanctionCooldown.get(userId) < 3000) return false;

  if (checkSticker(message)) {
    await message.delete().catch(() => {});
    const warn = await message.channel.send({ content: `${message.author} ❌ Stickers externes non autorisés.` });
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    sanctionCooldown.set(userId, now);
    await sendLog(client, message.guild.id, 'message_delete', {
      title: '🎭 AutoMod — Sticker Externe Supprimé',
      fields: [{ name: 'Utilisateur', value: `${message.author.tag} (${userId})`, inline: true }, { name: 'Salon', value: message.channel.toString(), inline: true }],
    });
    return true;
  }

  const linkResult = checkLink(message);
  if (linkResult) {
    await message.delete().catch(() => {});
    sanctionCooldown.set(userId, now);
    const warn = await message.channel.send({ content: `${message.author} ❌ ${linkResult.reason}.` });
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    await sendLog(client, message.guild.id, 'message_delete', {
      title: `🔗 AutoMod — Lien Bloqué (${linkResult.type})`,
      fields: [{ name: 'Utilisateur', value: `${message.author.tag} (${userId})`, inline: true }, { name: 'Salon', value: message.channel.toString(), inline: true }, { name: 'Contenu', value: message.content.slice(0, 500), inline: false }],
    });
    return true;
  }

  if (checkSpam(message)) {
    sanctionCooldown.set(userId, now);
    const recent = await message.channel.messages.fetch({ limit: 10 });
    const toDelete = recent.filter(m => m.author.id === userId && Date.now() - m.createdTimestamp < 5000);
    await message.channel.bulkDelete(toDelete, true).catch(() => {});
    if (message.member?.moderatable) await message.member.timeout(10 * 60 * 1000, 'AutoMod — Spam').catch(() => {});
    const warn = await message.channel.send({ content: `${message.author} ❌ **Spam détecté** — Mute 10 minutes.` });
    setTimeout(() => warn.delete().catch(() => {}), 8000);
    await sendLog(client, message.guild.id, 'mute', {
      title: '📨 AutoMod — Spam',
      fields: [{ name: 'Utilisateur', value: `${message.author.tag} (${userId})`, inline: true }, { name: 'Action', value: 'Mute 10 minutes', inline: true }],
    });
    return true;
  }

  return false;
}

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {

    // ── AutoMod ──────────────────────────────────────────────────────
    if (!message.author?.bot && message.guild) {
      const blocked = await handleAutomod(message, client);
      if (blocked) return;
    }

    // ── Smash or Pass — Salon de sélection : photos uniquement ───────
    // Si le message est dans le salon de sélection configuré et n'est pas une image → suppression automatique
    if (!message.author?.bot && message.guild) {
      const config = getConfig(message.guild.id);
      if (config.smashSelectionChannel && message.channel.id === config.smashSelectionChannel) {
        const hasImage = message.attachments.some(a => a.contentType && a.contentType.startsWith('image/'));
        if (!hasImage) {
          await message.delete().catch(() => {});
          const warn = await message.channel.send({
            content: `${message.author} ❌ Ce salon est réservé aux **photos uniquement** ! Clique sur le bouton **📸 Soumettre ma photo** pour participer.`,
          });
          setTimeout(() => warn.delete().catch(() => {}), 5000);
        }
        // Image ou message supprimé → ne pas continuer vers les commandes prefix
        return;
      }
    }

    if (message.author.bot || !message.guild) return;

    // ── Statistiques (messages) — utilisées pour les conditions de giveaway ──
    incrementMessages(message.guild.id, message.author.id);

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // ── !help ───────────────��────────────────────────────────────────
    if (cmd === 'help') {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📖 PV•PROTECT — Toutes les commandes `!`')
        .addFields(
          { name: '🛡️ Modération', value: [
            '`!ban @user [raison]`',
            '`!kick @user [raison]`',
            '`!mute @user <durée> [raison]`',
            '`!unmute @user`',
            '`!unban <id>`',
            '`!warn @user <raison>`',
            '`!warns @user`',
            '`!delwarn @user <numéro>`',
            '`!clear <1-100>`',
            '`!lock [#salon] [raison]`',
            '`!unlock [#salon] [raison]`',
          ].join('\n'), inline: false },
          { name: '📊 Informations', value: [
            '`!serverinfo`',
            '`!userinfo [@user]`',
            '`!ping`',
          ].join('\n'), inline: true },
          { name: '⚙️ Configuration (Admin)', value: [
            '`!setlog #salon`',
            '`!setwelcome #salon`',
            '`!setstaff @role`',
            '`!setverif @role`',
            '`!setautorole @role`',
            '`!config`',
          ].join('\n'), inline: true },
          { name: '🎉 Giveaways (Admin)', value: [
            '`!gw start <durée> <gagnants> <condition> [seuil] <lot>`',
            '`!gw end <messageId>`',
            '`!gw reroll <messageId>`',
            '`!gw list`',
            'Conditions : `aucune` `invitations` `messages` `vocal`',
          ].join('\n'), inline: false },
          { name: '🔢 Durées pour `!mute` / `!gw`', value: '`10m` `30m` `1h` `6h` `12h` `1j` `3j` `7j`', inline: false },
          { name: '💡 Commandes slash `/` disponibles', value: 'setrules · setupticket · setupverif · automod · syncperms · setuproles · setpub · serverinfo · lock · unlock', inline: false },
        )
        .setFooter({ text: 'PV•PROTECT — Modération complète' })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (cmd === 'ping') {
      return message.reply(`🏓 Pong ! Latence : **${client.ws.ping}ms**`);
    }

    if (cmd === 'ban') {
      if (!canBan(message.member)) return message.reply('❌ Permission manquante : Bannir des membres.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ `!ban @user [raison]`');
      if (!target.bannable) return message.reply('❌ Je ne peux pas bannir ce membre.');
      const raison = args.slice(1).join(' ') || 'Aucune raison';
      await target.ban({ reason: raison });
      await sendLog(client, message.guild.id, 'ban', { title: 'Membre Banni', thumbnail: target.user.displayAvatarURL({ dynamic: true }), fields: [{ name: 'Membre', value: `${target.user.tag} (${target.user.id})`, inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'Raison', value: raison, inline: false }] });
      return message.reply(`✅ **${target.user.tag}** banni. Raison : ${raison}`);
    }

    if (cmd === 'kick') {
      if (!canKick(message.member)) return message.reply('❌ Permission manquante : Expulser des membres.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ `!kick @user [raison]`');
      if (!target.kickable) return message.reply('❌ Je ne peux pas expulser ce membre.');
      const raison = args.slice(1).join(' ') || 'Aucune raison';
      await target.kick(raison);
      await sendLog(client, message.guild.id, 'kick', { title: 'Membre Expulsé', thumbnail: target.user.displayAvatarURL({ dynamic: true }), fields: [{ name: 'Membre', value: `${target.user.tag}`, inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'Raison', value: raison, inline: false }] });
      return message.reply(`✅ **${target.user.tag}** expulsé. Raison : ${raison}`);
    }

    if (cmd === 'mute') {
      if (!isMod(message.member)) return message.reply('❌ Permission manquante : Modérer les membres.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ `!mute @user <durée> [raison]`');
      const dureeKey = args[1];
      const ms = DURATIONS_MS[dureeKey];
      if (!ms) return message.reply(`❌ Durée invalide. Options : ${Object.keys(DURATIONS_MS).join(', ')}`);
      if (!target.moderatable) return message.reply('❌ Je ne peux pas mute ce membre.');
      const raison = args.slice(2).join(' ') || 'Aucune raison';
      await target.timeout(ms, raison);
      await sendLog(client, message.guild.id, 'mute', { title: 'Membre Mute', thumbnail: target.user.displayAvatarURL({ dynamic: true }), fields: [{ name: 'Membre', value: target.user.tag, inline: true }, { name: 'Durée', value: dureeKey, inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'Raison', value: raison, inline: false }] });
      return message.reply(`✅ **${target.user.tag}** mute **${dureeKey}**. Raison : ${raison}`);
    }

    if (cmd === 'unmute') {
      if (!isMod(message.member)) return message.reply('❌ Permission manquante.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ `!unmute @user`');
      if (!target.isCommunicationDisabled()) return message.reply('❌ Ce membre n\'est pas mute.');
      await target.timeout(null);
      await sendLog(client, message.guild.id, 'unmute', { title: 'Membre Unmute', thumbnail: target.user.displayAvatarURL({ dynamic: true }), fields: [{ name: 'Membre', value: target.user.tag, inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }] });
      return message.reply(`✅ **${target.user.tag}** unmute.`);
    }

    if (cmd === 'unban') {
      if (!canBan(message.member)) return message.reply('❌ Permission manquante.');
      const userId = args[0];
      if (!userId) return message.reply('❌ `!unban <id>`');
      try {
        await message.guild.members.unban(userId);
        await sendLog(client, message.guild.id, 'unban', { title: 'Membre Débanni', fields: [{ name: 'ID', value: userId, inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }] });
        return message.reply(`✅ Utilisateur \`${userId}\` débanni.`);
      } catch {
        return message.reply('❌ ID invalide ou utilisateur non banni.');
      }
    }

    if (cmd === 'warn') {
      if (!isMod(message.member)) return message.reply('❌ Permission manquante.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ `!warn @user <raison>`');
      const raison = args.slice(1).join(' ');
      if (!raison) return message.reply('❌ Fournis une raison.');
      addWarn(message.guild.id, target.id, { raison, modId: message.author.id, modTag: message.author.tag, date: new Date().toISOString() });
      await sendLog(client, message.guild.id, 'warn', { title: 'Membre Averti', fields: [{ name: 'Membre', value: target.tag, inline: true }, { name: 'Modérateur', value: message.author.tag, inline: true }, { name: 'Raison', value: raison, inline: false }] });
      return message.reply(`⚠️ **${target.tag}** averti. Raison : ${raison}`);
    }

    if (cmd === 'warns') {
      if (!isMod(message.member)) return message.reply('❌ Permission manquante.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ `!warns @user`');
      const warns = getWarns(message.guild.id, target.id);
      if (!warns.length) return message.reply(`✅ **${target.tag}** n'a aucun avertissement.`);
      const embed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle(`⚠️ Avertissements — ${target.tag}`)
        .setDescription(warns.map((w, i) => `**#${i + 1}** — ${w.raison} *(${new Date(w.date).toLocaleDateString('fr-FR')})*`).join('\n'))
        .setFooter({ text: `${warns.length} avertissement(s)` });
      return message.reply({ embeds: [embed] });
    }

    if (cmd === 'delwarn') {
      if (!isMod(message.member)) return message.reply('❌ Permission manquante.');
      const target = message.mentions.users.first();
      const num = parseInt(args[1]);
      if (!target || isNaN(num)) return message.reply('❌ `!delwarn @user <numéro>`');
      const { removeWarn } = require('../utils/config');
      const ok = removeWarn(message.guild.id, target.id, num - 1);
      return message.reply(ok ? `✅ Avertissement **#${num}** de **${target.tag}** supprimé.` : '❌ Avertissement introuvable.');
    }

    if (cmd === 'clear') {
      if (!canManageMsg(message.member)) return message.reply('❌ Permission manquante.');
      const nb = parseInt(args[0]);
      if (isNaN(nb) || nb < 1 || nb > 100) return message.reply('❌ Nombre invalide (1-100).');
      await message.delete().catch(() => {});
      const msgs = await message.channel.messages.fetch({ limit: nb });
      const recent = msgs.filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
      const deleted = await message.channel.bulkDelete(recent, true);
      const confirm = await message.channel.send(`✅ ${deleted.size} message(s) supprimé(s).`);
      setTimeout(() => confirm.delete().catch(() => {}), 3000);
      return;
    }

    if (cmd === 'lock') {
      if (!canManageCh(message.member)) return message.reply('❌ Permission manquante : Gérer les salons.');
      const channel = message.mentions.channels.first() || message.channel;
      const raison = args.slice(message.mentions.channels.size ? 1 : 0).join(' ') || 'Aucune raison';
      await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }).catch(() => {});
      const embed = new EmbedBuilder().setColor(0xFF2222).setTitle('🔒 Salon Verrouillé').setDescription(`Verrouillé par ${message.author}.`).addFields({ name: 'Raison', value: raison }).setTimestamp();
      await channel.send({ embeds: [embed] }).catch(() => {});
      await sendLog(client, message.guild.id, 'channel_update', { title: '🔒 Salon Verrouillé', fields: [{ name: 'Salon', value: channel.toString(), inline: true }, { name: 'Par', value: message.author.tag, inline: true }, { name: 'Raison', value: raison, inline: false }] });
      if (channel.id !== message.channel.id) message.reply(`✅ ${channel} verrouillé.`);
      return;
    }

    if (cmd === 'unlock') {
      if (!canManageCh(message.member)) return message.reply('❌ Permission manquante : Gérer les salons.');
      const channel = message.mentions.channels.first() || message.channel;
      const raison = args.slice(message.mentions.channels.size ? 1 : 0).join(' ') || 'Aucune raison';
      await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }).catch(() => {});
      const embed = new EmbedBuilder().setColor(0x00FF88).setTitle('🔓 Salon Déverrouillé').setDescription(`Déverrouillé par ${message.author}.`).addFields({ name: 'Raison', value: raison }).setTimestamp();
      await channel.send({ embeds: [embed] }).catch(() => {});
      await sendLog(client, message.guild.id, 'channel_update', { title: '🔓 Salon Déverrouillé', fields: [{ name: 'Salon', value: channel.toString(), inline: true }, { name: 'Par', value: message.author.tag, inline: true }, { name: 'Raison', value: raison, inline: false }] });
      if (channel.id !== message.channel.id) message.reply(`✅ ${channel} déverrouillé.`);
      return;
    }

    if (cmd === 'serverinfo') {
      await message.guild.fetch();
      const guild = message.guild;
      const textCh  = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
      const voiceCh = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
      const bots    = guild.members.cache.filter(m => m.user.bot).size;
      const owner   = await guild.fetchOwner().catch(() => null);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📊 ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: '👑 Propriétaire', value: owner ? owner.user.tag : '—', inline: true },
          { name: '🆔 ID', value: guild.id, inline: true },
          { name: '📅 Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
          { name: '👥 Membres', value: `Total : **${guild.memberCount}** | Bots : **${bots}**`, inline: false },
          { name: '💬 Salons', value: `Texte : **${textCh}** | Vocal : **${voiceCh}**`, inline: true },
          { name: '🏷️ Rôles', value: `**${guild.roles.cache.size - 1}**`, inline: true },
          { name: '🚀 Boosts', value: `**${guild.premiumSubscriptionCount || 0}** (Tier ${guild.premiumTier})`, inline: true },
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (cmd === 'userinfo') {
      const target = message.mentions.members.first() || message.member;
      const user = target.user;
      const roles = target.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.toString()).join(', ') || 'Aucun';
      const warns = getWarns(message.guild.id, user.id);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`👤 ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: '🆔 ID', value: user.id, inline: true },
          { name: '🤖 Bot', value: user.bot ? 'Oui' : 'Non', inline: true },
          { name: '📅 Compte créé', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
          { name: '📥 A rejoint', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:D>`, inline: true },
          { name: '⚠️ Avertissements', value: `${warns.length}`, inline: true },
          { name: '🏷️ Pseudo', value: target.nickname || 'Aucun', inline: true },
          { name: `🎭 Rôles (${target.roles.cache.size - 1})`, value: roles.slice(0, 1024), inline: false },
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (cmd === 'setlog') {
      if (!isAdmin(message.member)) return message.reply('❌ Administrateur requis.');
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('❌ `!setlog #salon`');
      setConfig(message.guild.id, 'logChannel', channel.id);
      return message.reply(`✅ Salon de logs → ${channel}`);
    }

    if (cmd === 'setwelcome') {
      if (!isAdmin(message.member)) return message.reply('❌ Administrateur requis.');
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('❌ `!setwelcome #salon`');
      setConfig(message.guild.id, 'welcomeChannel', channel.id);
      return message.reply(`✅ Salon de bienvenue → ${channel}`);
    }

    if (cmd === 'setstaff') {
      if (!isAdmin(message.member)) return message.reply('❌ Administrateur requis.');
      const role = message.mentions.roles.first();
      if (!role) return message.reply('❌ `!setstaff @role`');
      setConfig(message.guild.id, 'staffRole', role.id);
      return message.reply(`✅ Rôle staff → ${role}`);
    }

    if (cmd === 'setverif') {
      if (!isAdmin(message.member)) return message.reply('❌ Administrateur requis.');
      const role = message.mentions.roles.first();
      if (!role) return message.reply('❌ `!setverif @role`');
      setConfig(message.guild.id, 'verifRole', role.id);
      return message.reply(`✅ Rôle vérification → ${role}`);
    }

    if (cmd === 'setautorole') {
      if (!isAdmin(message.member)) return message.reply('❌ Administrateur requis.');
      const role = message.mentions.roles.first();
      if (!role) return message.reply('❌ `!setautorole @role`');
      setConfig(message.guild.id, 'autoRole', role.id);
      return message.reply(`✅ Auto-rôle à l'arrivée → ${role}`);
    }

    if (cmd === 'config') {
      if (!isAdmin(message.member)) return message.reply('❌ Administrateur requis.');
      const config = getConfig(message.guild.id);
      const f = (id) => id ? `<#${id}>` : '❌';
      const r = (id) => id ? `<@&${id}>` : '❌';
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚙️ Configuration actuelle')
        .addFields(
          { name: '📋 Logs', value: f(config.logChannel), inline: true },
          { name: '👋 Bienvenue', value: f(config.welcomeChannel), inline: true },
          { name: '🎫 Tickets', value: config.ticketCategory ? `<#${config.ticketCategory}>` : '❌', inline: true },
          { name: '🛡️ Staff', value: r(config.staffRole), inline: true },
          { name: '✅ Vérif', value: r(config.verifRole), inline: true },
          { name: '🎭 Auto-rôle', value: r(config.autoRole), inline: true },
          { name: '📢 PUB Role', value: r(config.pubRole), inline: true },
          { name: '📢 PUB Triggers', value: config.pubTriggers?.join(', ') || '❌', inline: true },
          { name: '💘 Smash Sélection', value: f(config.smashSelectionChannel), inline: true },
          { name: '💘 Smash Vote', value: f(config.smashVoteChannel), inline: true },
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (cmd === 'gw') {
      if (!isAdmin(message.member)) return message.reply('❌ Administrateur requis.');
      const sub = (args[0] || '').toLowerCase();

      if (sub === 'start') {
        const duree = args[1];
        const gagnants = parseInt(args[2]);
        const condition = (args[3] || 'aucune').toLowerCase();
        const validConditions = ['aucune', 'invitations', 'messages', 'vocal'];

        if (!parseGwDuration(duree)) return message.reply('❌ Durée invalide. Format : un nombre suivi de `s` (secondes), `m` (minutes), `h` (heures) ou `j` (jours). Exemples : `30s`, `10m`, `10h`, `2j`.');
        if (isNaN(gagnants) || gagnants < 1) return message.reply('❌ Nombre de gagnants invalide.');
        if (!validConditions.includes(condition)) return message.reply(`❌ Condition invalide. Options : ${validConditions.join(', ')}`);

        let seuil = 0;
        let prizeArgs;
        if (condition !== 'aucune') {
          seuil = parseInt(args[4]);
          if (isNaN(seuil) || seuil < 1) return message.reply(`❌ \`!gw start <durée> <gagnants> ${condition} <seuil> <lot>\``);
          prizeArgs = args.slice(5);
        } else {
          prizeArgs = args.slice(4);
        }

        const prize = prizeArgs.join(' ');
        if (!prize) return message.reply('❌ Précise un lot. Exemple : `!gw start 1h 1 messages 50 Nitro Classic`');

        await message.delete().catch(() => {});

        const { gw } = await createGiveaway(client, {
          guild: message.guild, channel: message.channel, host: message.author,
          prize, durationKey: duree, winnersCount: gagnants, condition, seuil,
        });

        // ── DM à tous les membres pour annoncer le giveaway ──────────
        await message.guild.members.fetch();
        const members = message.guild.members.cache.filter(m => !m.user.bot);
        const jumpLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${gw.messageId}`;

        const announceEmbed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle(`🎉 Nouveau Giveaway sur ${message.guild.name} !`)
          .setThumbnail(message.guild.iconURL({ dynamic: true }))
          .setDescription(
            `🏆 **Lot :** ${prize}\n` +
            `🕐 **Fin :** <t:${Math.floor(gw.endAt / 1000)}:R>\n` +
            `🎖️ **Gagnant(s) :** ${gagnants}\n` +
            `📋 **Condition :** ${GW_CONDITION_LABELS[condition]}${condition !== 'aucune' ? ` (**${seuil}** requis)` : ''}\n\n` +
            `👉 [Clique ici pour participer](${jumpLink})`
          )
          .setFooter({ text: `Organisé par ${message.author.tag}` })
          .setTimestamp();

        const progress = await message.channel.send(`⏳ Envoi des DM d'annonce à **${members.size}** membre(s)...`);

        let sent = 0, failed = 0, count = 0;
        for (const [, member] of members) {
          try { await member.user.send({ embeds: [announceEmbed] }); sent++; }
          catch { failed++; }
          count++;
          if (count % 10 === 0) {
            await progress.edit(`⏳ Envoi des DM d'annonce... (${count}/${members.size})`).catch(() => {});
          }
          await new Promise(r => setTimeout(r, 1100));
        }

        await progress.edit(`✅ Giveaway lancé pour **${prize}** ! 📨 ${sent} membre(s) prévenu(s) par DM${failed ? ` (${failed} DM échoué(s), DMs désactivés)` : ''}.`).catch(() => {});
        setTimeout(() => progress.delete().catch(() => {}), 15000);
        return;
      }

      if (sub === 'end') {
        const messageId = args[1];
        if (!messageId) return message.reply('❌ `!gw end <messageId>`');
        const found = findByMessageId(message.guild.id, messageId);
        if (!found) return message.reply('❌ Giveaway introuvable.');
        const [gwId, gw] = found;
        if (gw.ended) return message.reply('❌ Ce giveaway est déjà terminé.');
        const winners = await endGiveaway(client, gwId);
        return message.reply(
          winners && winners.length
            ? `✅ Giveaway terminé. Gagnant(s) : ${winners.map(id => `<@${id}>`).join(', ')}`
            : '✅ Giveaway terminé, aucun participant valide.'
        );
      }

      if (sub === 'reroll') {
        const messageId = args[1];
        if (!messageId) return message.reply('❌ `!gw reroll <messageId>`');
        const found = findByMessageId(message.guild.id, messageId);
        if (!found) return message.reply('❌ Giveaway introuvable.');
        const [gwId, gw] = found;
        if (!gw.ended) return message.reply('❌ Ce giveaway n\'est pas encore terminé. Utilise `!gw end` d\'abord.');
        const winners = await rerollGiveaway(client, gwId);
        return message.reply(
          winners && winners.length
            ? `✅ Reroll effectué. Nouveau(x) gagnant(s) : ${winners.map(id => `<@${id}>`).join(', ')}`
            : '❌ Aucun participant valide pour le reroll.'
        );
      }

      if (sub === 'list') {
        const active = listActive(message.guild.id);
        if (!active.length) return message.reply('📭 Aucun giveaway actif sur ce serveur.');
        const embed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('🎉 Giveaways actifs')
          .setDescription(active.map(g =>
            `**${g.prize}** — <t:${Math.floor(g.endAt / 1000)}:R> — ${g.participants.length} participant(s)\n[Voir le giveaway](https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId})`
          ).join('\n\n'))
          .setTimestamp();
        return message.reply({ embeds: [embed] });
      }

      return message.reply('❌ `!gw start <durée> <gagnants> <condition> [seuil] <lot>` | `!gw end <messageId>` | `!gw reroll <messageId>` | `!gw list`');
    }

    if (cmd === 'delete') {
      if (!isAdmin(message.member)) return message.reply('❌ Administrateur requis.');

      await message.reply('🔄 Réinitialisation en cours...');

      const config = getConfig(message.guild.id);
      const welcomeId = config.welcomeChannel;

      let deletedChannels = 0;
      const channels = message.guild.channels.cache.filter(c =>
        c.id !== welcomeId &&
        c.id !== message.channel.id
      );

      for (const [, channel] of channels) {
        await channel.delete('!delete — réinitialisation complète').catch(() => {});
        deletedChannels++;
      }

      const dataDir = path.join(__dirname, '..', '..', 'data');
      for (const fileName of ['config.json', 'tickets.json', 'warns.json']) {
        const filePath = path.join(dataDir, fileName);
        if (fs.existsSync(filePath)) {
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            delete data[message.guild.id];
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
          } catch {}
        }
      }

      const summary = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle('✅ Réinitialisation terminée')
        .addFields(
          { name: '🗂️ Salons supprimés', value: `${deletedChannels}`, inline: true },
          { name: '⚙️ Config effacée', value: 'Oui (config, tickets, warns)', inline: true },
          { name: '👋 Salon conservé', value: welcomeId ? `<#${welcomeId}>` : 'Aucun (non configuré)', inline: false },
          { name: '🔄 Prochaine étape', value: 'Reconfigure le bot avec `/setlog`, `/setrules`, `/setupticket`, etc.', inline: false },
        )
        .setTimestamp();

      await message.channel.send({ embeds: [summary] }).catch(() => {});

      setTimeout(() => {
        if (message.channel.id !== welcomeId) {
          message.channel.delete('!delete — dernier salon').catch(() => {});
        }
      }, 3000);
    }
  },
};
