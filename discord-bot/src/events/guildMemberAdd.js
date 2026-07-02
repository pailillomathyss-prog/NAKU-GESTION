const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig } = require('../utils/config');
const { sendLog } = require('../utils/logger');
const { checkRaid, checkBot } = require('../utils/automod');
const { findUsedInvite } = require('../utils/invites');
const { addInvites } = require('../utils/stats');

// Stockage des membres récemment kickés lors d'un raid (éviter boucle)
const raidKicked = new Set();

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const config = getConfig(member.guild.id);

    // ── Anti-Bot ─────────────────────────────────────────────────────
    if (checkBot(member)) {
      await sendLog(client, member.guild.id, 'kick', {
        title: '🤖 AutoMod — Bot Non Autorisé Kické',
        fields: [
          { name: 'Bot', value: `${member.user.tag} (${member.user.id})`, inline: true },
          { name: 'Action', value: 'Kick automatique', inline: true },
        ],
        thumbnail: member.user.displayAvatarURL({ dynamic: true }),
      });
      await member.kick('AutoMod — Bot non autorisé').catch(() => {});
      return;
    }

    // ── Anti-Raid ────────────────────────────────────────────────────
    if (checkRaid(member.guild.id)) {
      const am = config.automod || {};

      // Log du raid
      await sendLog(client, member.guild.id, 'ban', {
        title: '⚡ AutoMod — RAID DÉTECTÉ',
        description: `Une vague de membres a été détectée. Actions de protection en cours...`,
        fields: [
          { name: 'Seuil atteint', value: `${am.raidThreshold || 8} joins / ${(am.raidInterval || 10000) / 1000}s`, inline: true },
          { name: 'Dernier membre', value: `${member.user.tag}`, inline: true },
        ],
      });

      // Kick le membre actuel si compte récent (< 7 jours)
      const accountAge = Date.now() - member.user.createdTimestamp;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      if (accountAge < sevenDays && !raidKicked.has(member.user.id)) {
        raidKicked.add(member.user.id);
        setTimeout(() => raidKicked.delete(member.user.id), 30000);
        await member.kick('AutoMod — Protection anti-raid (compte trop récent)').catch(() => {});
        return;
      }

      // Lockdown : désactiver l'envoi de messages pour @everyone dans tous les salons texte
      try {
        const everyoneRole = member.guild.roles.everyone;
        const textChannels = member.guild.channels.cache.filter(c => c.isTextBased() && c.permissionsFor(member.guild.members.me)?.has(PermissionFlagsBits.ManageChannels));

        for (const [, channel] of textChannels) {
          await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false }).catch(() => {});
        }

        await sendLog(client, member.guild.id, 'ban', {
          title: '🔒 AutoMod — Serveur en Lockdown',
          description: 'Tous les salons ont été verrouillés en raison d\'un raid détecté.\nUtilise `/lockdown off` pour déverrouiller.',
        });
      } catch (err) {
        console.error('Erreur lockdown:', err.message);
      }

      return;
    }

    // ── Suivi des invitations (pour les conditions de giveaway) ───────
    try {
      const usedInvite = await findUsedInvite(member.guild);
      if (usedInvite?.inviter && !usedInvite.inviter.bot && usedInvite.inviter.id !== member.id) {
        addInvites(member.guild.id, usedInvite.inviter.id, 1);
      }
    } catch (err) {
      console.warn('⚠️  Suivi invitation :', err.message);
    }

    // ── Log arrivée normale ──────────────────────────────────────────
    await sendLog(client, member.guild.id, 'member_join', {
      title: 'Membre Rejoint',
      description: `${member.user} a rejoint le serveur.`,
      thumbnail: member.user.displayAvatarURL({ dynamic: true }),
      fields: [
        { name: 'Tag', value: member.user.tag, inline: true },
        { name: 'ID', value: member.user.id, inline: true },
        { name: 'Compte créé le', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'Membres total', value: `${member.guild.memberCount}`, inline: true },
      ],
    });

    // ── Message de bienvenue ───────────────────────────────────���─────
    if (config.welcomeChannel) {
      const channel = member.guild.channels.cache.get(config.welcomeChannel);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0x00CCFF)
          .setTitle(`👋 Bienvenue sur ${member.guild.name} !`)
          .setDescription(`Bienvenue ${member} !\nTu es le **${member.guild.memberCount}ème** membre.\n\n> Rends-toi dans le salon de vérification pour accéder au serveur.`)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    // ── Rôle automatique ─────────────────────────────────────────────
    if (config.autoRole) {
      const role = member.guild.roles.cache.get(config.autoRole);
      if (role) await member.roles.add(role).catch(() => {});
    }
  },
};
