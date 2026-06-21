const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getWarns, addWarn } = require('../utils/config');
const { sendLog } = require('../utils/logger');

const PREFIX = '!';

const DURATIONS_MS = {
  '10m': 10 * 60 * 1000, '30m': 30 * 60 * 1000,
  '1h': 3600 * 1000, '6h': 6 * 3600 * 1000,
  '12h': 12 * 3600 * 1000, '1j': 86400 * 1000,
  '3j': 3 * 86400 * 1000, '7j': 7 * 86400 * 1000,
};

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // ── !help ────────────────────────────────────────────────────────
    if (cmd === 'help') {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📖 NAKU — Commandes préfixe `!`')
        .addFields(
          { name: '🛡️ Modération', value: '`!ban @user [raison]`\n`!kick @user [raison]`\n`!mute @user <durée> [raison]`\n`!unmute @user`\n`!unban <id> [raison]`\n`!warn @user <raison>`\n`!warns @user`\n`!clear <1-100>`', inline: false },
          { name: '⚙️ Admin', value: '`!setlog #salon`\n`!setwelcome #salon`', inline: false },
          { name: '🔢 Durées pour !mute', value: '`10m` `30m` `1h` `6h` `12h` `1j` `3j` `7j`', inline: false },
        )
        .setFooter({ text: 'Les commandes /slash sont également disponibles' });
      return message.reply({ embeds: [embed] });
    }

    // ── !ping ────────────────────────────────────────────────────────
    if (cmd === 'ping') {
      return message.reply(`🏓 Pong ! Latence : **${client.ws.ping}ms**`);
    }

    // ── !ban ─────────────────────────────────────────────────────────
    if (cmd === 'ban') {
      if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
        return message.reply('❌ Tu n\'as pas la permission de bannir.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ Mentionne un membre. Ex: `!ban @user raison`');
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
      return message.reply(`✅ **${target.user.tag}** a été banni. Raison : ${raison}`);
    }

    // ── !kick ────────────────────────────────────────────────────────
    if (cmd === 'kick') {
      if (!message.member.permissions.has(PermissionFlagsBits.KickMembers))
        return message.reply('❌ Tu n\'as pas la permission d\'expulser.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ Mentionne un membre. Ex: `!kick @user raison`');
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
      return message.reply(`✅ **${target.user.tag}** a été expulsé. Raison : ${raison}`);
    }

    // ── !mute ────────────────────────────────────────────────────────
    if (cmd === 'mute') {
      if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
        return message.reply('❌ Tu n\'as pas la permission de mute.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ Mentionne un membre. Ex: `!mute @user 1h raison`');
      const dureeKey = args[1];
      const ms = DURATIONS_MS[dureeKey];
      if (!ms) return message.reply(`❌ Durée invalide. Utilise : ${Object.keys(DURATIONS_MS).join(', ')}`);
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
      return message.reply(`✅ **${target.user.tag}** mute pour **${dureeKey}**. Raison : ${raison}`);
    }

    // ── !unmute ──────────────────────────────────────────────────────
    if (cmd === 'unmute') {
      if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
        return message.reply('❌ Tu n\'as pas la permission.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ Mentionne un membre.');
      if (!target.isCommunicationDisabled()) return message.reply('❌ Ce membre n\'est pas mute.');
      await target.timeout(null);
      return message.reply(`✅ **${target.user.tag}** a été unmute.`);
    }

    // ── !unban ───────────────────────────────────────────────────────
    if (cmd === 'unban') {
      if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
        return message.reply('❌ Tu n\'as pas la permission.');
      const userId = args[0];
      if (!userId) return message.reply('❌ Fournis l\'ID du membre. Ex: `!unban 123456789`');
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
        return message.reply('❌ Tu n\'as pas la permission.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Mentionne un membre. Ex: `!warn @user raison`');
      const raison = args.slice(1).join(' ');
      if (!raison) return message.reply('❌ Fournis une raison.');
      addWarn(message.guild.id, target.id, { raison, modId: message.author.id, modTag: message.author.tag, date: new Date().toISOString() });
      await sendLog(client, message.guild.id, 'warn', {
        title: 'Membre Averti',
        fields: [
          { name: 'Membre', value: `${target.tag}`, inline: true },
          { name: 'Modérateur', value: message.author.tag, inline: true },
          { name: 'Raison', value: raison, inline: false },
        ],
      });
      return message.reply(`⚠️ **${target.tag}** a reçu un avertissement. Raison : ${raison}`);
    }

    // ── !warns ───────────────────────────────────────────────────────
    if (cmd === 'warns') {
      if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
        return message.reply('❌ Tu n\'as pas la permission.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Mentionne un membre.');
      const warns = getWarns(message.guild.id, target.id);
      if (!warns.length) return message.reply(`✅ **${target.tag}** n'a aucun avertissement.`);
      const embed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle(`⚠️ Avertissements de ${target.tag}`)
        .setDescription(warns.map((w, i) => `**#${i + 1}** — ${w.raison} *(${new Date(w.date).toLocaleDateString('fr-FR')})*`).join('\n'))
        .setFooter({ text: `${warns.length} avertissement(s)` });
      return message.reply({ embeds: [embed] });
    }

    // ── !clear ───────────────────────────────────────────────────────
    if (cmd === 'clear') {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
        return message.reply('❌ Tu n\'as pas la permission.');
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
      if (!channel) return message.reply('❌ Mentionne un salon. Ex: `!setlog #logs`');
      const { setConfig } = require('../utils/config');
      setConfig(message.guild.id, 'logChannel', channel.id);
      return message.reply(`✅ Salon de logs défini : ${channel}`);
    }

    // ── !setwelcome ──────────────────────────────────────────────────
    if (cmd === 'setwelcome') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
        return message.reply('❌ Administrateur requis.');
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('❌ Mentionne un salon. Ex: `!setwelcome #bienvenue`');
      const { setConfig } = require('../utils/config');
      setConfig(message.guild.id, 'welcomeChannel', channel.id);
      return message.reply(`✅ Salon de bienvenue défini : ${channel}`);
    }
  },
};
