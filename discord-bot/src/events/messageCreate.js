const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getWarns, addWarn, getConfig, setConfig } = require('../utils/config');
const { sendLog } = require('../utils/logger');
const { checkLink, checkSpam, checkSticker } = require('../utils/automod');

const PREFIX = '!';

const DURATIONS_MS = {
  '10m': 10 * 60 * 1000, '30m': 30 * 60 * 1000,
  '1h': 3600 * 1000, '6h': 6 * 3600 * 1000,
  '12h': 12 * 3600 * 1000, '1j': 86400 * 1000,
  '3j': 3 * 86400 * 1000, '7j': 7 * 86400 * 1000,
};

// Cooldown anti-spam pour éviter les doubles sanctions
const sanctionCooldown = new Map();

async function handleAutomod(message, client) {
  if (!message.guild || message.author.bot) return false;

  // Ignorer les membres avec Manage Messages (modérateurs)
  if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

  const userId = message.author.id;
  const now = Date.now();

  // Éviter double sanction dans les 3 secondes
  if (sanctionCooldown.has(userId) && now - sanctionCooldown.get(userId) < 3000) return false;

  // ── Anti-Sticker externe ─────────────────────────────────────────
  if (checkSticker(message)) {
    await message.delete().catch(() => {});
    const warn = await message.channel.send({ content: `${message.author} ❌ Stickers externes non autorisés.` });
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    sanctionCooldown.set(userId, now);
    await sendLog(client, message.guild.id, 'message_delete', {
      title: '🎭 AutoMod — Sticker Externe Supprimé',
      fields: [
        { name: 'Utilisateur', value: `${message.author.tag} (${userId})`, inline: true },
        { name: 'Salon', value: message.channel.toString(), inline: true },
      ],
    });
    return true;
  }

  // ── Anti-Lien ────────────────────────────────────────────────────
  const linkResult = checkLink(message);
  if (linkResult) {
    await message.delete().catch(() => {});
    sanctionCooldown.set(userId, now);
    const warn = await message.channel.send({ content: `${message.author} ❌ ${linkResult.reason}.` });
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    await sendLog(client, message.guild.id, 'message_delete', {
      title: `🔗 AutoMod — Lien Bloqué (${linkResult.type})`,
      fields: [
        { name: 'Utilisateur', value: `${message.author.tag} (${userId})`, inline: true },
        { name: 'Salon', value: message.channel.toString(), inline: true },
        { name: 'Contenu', value: message.content.slice(0, 500), inline: false },
      ],
    });
    return true;
  }

  // ── Anti-Spam ────────────────────────────────────────────────────
  if (checkSpam(message)) {
    sanctionCooldown.set(userId, now);
    // Supprimer les messages récents
    const recent = await message.channel.messages.fetch({ limit: 10 });
    const toDelete = recent.filter(m => m.author.id === userId && Date.now() - m.createdTimestamp < 5000);
    await message.channel.bulkDelete(toDelete, true).catch(() => {});

    // Mute 10 minutes
    if (message.member?.moderatable) {
      await message.member.timeout(10 * 60 * 1000, 'AutoMod — Spam détecté').catch(() => {});
    }

    const warn = await message.channel.send({ content: `${message.author} ❌ **Spam détecté** — Tu as été mis en sourdine 10 minutes.` });
    setTimeout(() => warn.delete().catch(() => {}), 8000);

    await sendLog(client, message.guild.id, 'mute', {
      title: '📨 AutoMod — Spam',
      fields: [
        { name: 'Utilisateur', value: `${message.author.tag} (${userId})`, inline: true },
        { name: 'Salon', value: message.channel.toString(), inline: true },
        { name: 'Action', value: 'Mute 10 minutes', inline: true },
      ],
    });
    return true;
  }

  return false;
}

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    // ── AutoMod (avant tout) ─────────────────────────────────────────
    if (!message.author?.bot && message.guild) {
      const blocked = await handleAutomod(message, client);
      if (blocked) return;
    }

    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // ── !help ────────────────────────────────────────────────────────
    if (cmd === 'help') {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📖 NAKU — Commandes `!`')
        .addFields(
          { name: '🛡️ Modération', value: '`!ban @user [raison]`\n`!kick @user [raison]`\n`!mute @user <durée> [raison]`\n`!unmute @user`\n`!unban <id>`\n`!warn @user <raison>`\n`!warns @user`\n`!clear <1-100>`', inline: true },
          { name: '⚙️ Config', value: '`!setlog #salon`\n`!setwelcome #salon`\n`!ping`', inline: true },
          { name: '🔢 Durées !mute', value: '`10m` `30m` `1h` `6h` `12h` `1j` `3j` `7j`', inline: false },
        )
        .setFooter({ text: 'Commandes /slash également disponibles' });
      return message.reply({ embeds: [embed] });
    }

    // ── !ping ────────────────────────────────────────────────────────
    if (cmd === 'ping') {
      return message.reply(`🏓 Pong ! Latence : **${client.ws.ping}ms**`);
    }

    // ── !ban ─────────────────────────────────────────────────────────
    if (cmd === 'ban') {
      if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
        return message.reply('❌ Permission manquante : Bannir des membres.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ `!ban @user [raison]`');
      if (!target.bannable) return message.reply('❌ Je ne peux pas bannir ce membre.');
      const raison = args.slice(1).join(' ') || 'Aucune raison';
      await target.ban({ reason: raison });
      await sendLog(client, message.guild.id, 'ban', {
        title: 'Membre Banni',
        fields: [
          { name: 'Membre', value: `${target.user.tag} (${target.user.id})`, inline: true },
          { name: 'Modérateur', value: message.author.tag, inline: true },
          { name: 'Raison', value: raison, inline: false },
        ],
      });
      return message.reply(`✅ **${target.user.tag}** banni. Raison : ${raison}`);
    }

    // ── !kick ────────────────────────────────────────────────────────
    if (cmd === 'kick') {
      if (!message.member.permissions.has(PermissionFlagsBits.KickMembers))
        return message.reply('❌ Permission manquante : Expulser des membres.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ `!kick @user [raison]`');
      if (!target.kickable) return message.reply('❌ Je ne peux pas expulser ce membre.');
      const raison = args.slice(1).join(' ') || 'Aucune raison';
      await target.kick(raison);
      await sendLog(client, message.guild.id, 'kick', {
        title: 'Membre Expulsé',
        fields: [
          { name: 'Membre', value: `${target.user.tag} (${target.user.id})`, inline: true },
          { name: 'Modérateur', value: message.author.tag, inline: true },
          { name: 'Raison', value: raison, inline: false },
        ],
      });
      return message.reply(`✅ **${target.user.tag}** expulsé. Raison : ${raison}`);
    }

    // ── !mute ────────────────────────────────────────────────────────
    if (cmd === 'mute') {
      if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
        return message.reply('❌ Permission manquante : Modérer les membres.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ `!mute @user <durée> [raison]`');
      const dureeKey = args[1];
      const ms = DURATIONS_MS[dureeKey];
      if (!ms) return message.reply(`❌ Durée invalide. Options : ${Object.keys(DURATIONS_MS).join(', ')}`);
      if (!target.moderatable) return message.reply('❌ Je ne peux pas mute ce membre.');
      const raison = args.slice(2).join(' ') || 'Aucune raison';
      await target.timeout(ms, raison);
      await sendLog(client, message.guild.id, 'mute', {
        title: 'Membre Mute',
        fields: [
          { name: 'Membre', value: `${target.user.tag}`, inline: true },
          { name: 'Durée', value: dureeKey, inline: true },
          { name: 'Raison', value: raison, inline: false },
        ],
      });
      return message.reply(`✅ **${target.user.tag}** mute **${dureeKey}**. Raison : ${raison}`);
    }

    // ── !unmute ──────────────────────────────────────────────────────
    if (cmd === 'unmute') {
      if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
        return message.reply('❌ Permission manquante.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ `!unmute @user`');
      if (!target.isCommunicationDisabled()) return message.reply('❌ Ce membre n\'est pas mute.');
      await target.timeout(null);
      return message.reply(`✅ **${target.user.tag}** unmute.`);
    }

    // ── !unban ───────────────────────────────────────────────────────
    if (cmd === 'unban') {
      if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
        return message.reply('❌ Permission manquante.');
      const userId = args[0];
      if (!userId) return message.reply('❌ `!unban <id>`');
      try {
        await message.guild.members.unban(userId);
        return message.reply(`✅ Utilisateur \`${userId}\` débanni.`);
      } catch {
        return message.reply('❌ ID invalide ou utilisateur non banni.');
      }
    }

    // ── !warn ────────────────────────────────────────────────────────
    if (cmd === 'warn') {
      if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
        return message.reply('❌ Permission manquante.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ `!warn @user <raison>`');
      const raison = args.slice(1).join(' ');
      if (!raison) return message.reply('❌ Fournis une raison.');
      addWarn(message.guild.id, target.id, { raison, modId: message.author.id, modTag: message.author.tag, date: new Date().toISOString() });
      await sendLog(client, message.guild.id, 'warn', {
        title: 'Membre Averti',
        fields: [
          { name: 'Membre', value: target.tag, inline: true },
          { name: 'Modérateur', value: message.author.tag, inline: true },
          { name: 'Raison', value: raison, inline: false },
        ],
      });
      return message.reply(`⚠️ **${target.tag}** averti. Raison : ${raison}`);
    }

    // ── !warns ───────────────────────────────────────────────────────
    if (cmd === 'warns') {
      if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
        return message.reply('❌ Permission manquante.');
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

    // ── !clear ───────────────────────────────────────────────────────
    if (cmd === 'clear') {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
        return message.reply('❌ Permission manquante.');
      const nb = parseInt(args[0]);
      if (isNaN(nb) || nb < 1 || nb > 100) return message.reply('❌ Nombre invalide (1-100).');
      await message.delete().catch(() => {});
      const msgs = await message.channel.messages.fetch({ limit: nb });
      const recent = msgs.filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
      const deleted = await message.channel.bulkDelete(recent, true);
      const confirm = await message.channel.send(`✅ ${deleted.size} message(s) supprimé(s).`);
      setTimeout(() => confirm.delete().catch(() => {}), 3000);
    }

    // ── !setlog ──────────────────────────────────────────────────────
    if (cmd === 'setlog') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
        return message.reply('❌ Administrateur requis.');
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('❌ `!setlog #salon`');
      setConfig(message.guild.id, 'logChannel', channel.id);
      return message.reply(`✅ Logs → ${channel}`);
    }

    // ── !setwelcome ──────────────────────────────────────────────────
    if (cmd === 'setwelcome') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
        return message.reply('❌ Administrateur requis.');
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('❌ `!setwelcome #salon`');
      setConfig(message.guild.id, 'welcomeChannel', channel.id);
      return message.reply(`✅ Bienvenue → ${channel}`);
    }
  },
};
