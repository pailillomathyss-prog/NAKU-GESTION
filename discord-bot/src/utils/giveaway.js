const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUserStats } = require('./stats');

const gwPath = path.join(__dirname, '../../data/giveaways.json');

function ensureFile() {
  if (!fs.existsSync(gwPath)) fs.writeFileSync(gwPath, '{}', 'utf8');
}

function readAll() {
  ensureFile();
  try { return JSON.parse(fs.readFileSync(gwPath, 'utf8')); } catch { return {}; }
}

function writeAll(data) {
  fs.writeFileSync(gwPath, JSON.stringify(data, null, 2), 'utf8');
}

const DURATIONS_MS = {
  '1m': 60 * 1000, '5m': 5 * 60 * 1000, '10m': 10 * 60 * 1000, '30m': 30 * 60 * 1000,
  '1h': 3600 * 1000, '6h': 6 * 3600 * 1000, '12h': 12 * 3600 * 1000,
  '1j': 86400 * 1000, '3j': 3 * 86400 * 1000, '7j': 7 * 86400 * 1000,
};

const CONDITION_LABELS = {
  aucune: 'Aucune condition — ouvert à tous',
  invitations: 'Nombre d\'invitations',
  messages: 'Nombre de messages envoyés',
  vocal: 'Minutes passées en vocal',
};

function conditionMet(guildId, userId, condition, seuil) {
  if (!condition || condition === 'aucune') return true;
  const stats = getUserStats(guildId, userId);
  if (condition === 'invitations') return stats.invites >= seuil;
  if (condition === 'messages') return stats.messages >= seuil;
  if (condition === 'vocal') return stats.voiceMinutes >= seuil;
  return true;
}

function buildEmbed(gw) {
  const endTs = Math.floor(gw.endAt / 1000);
  return new EmbedBuilder()
    .setColor(gw.ended ? 0x888888 : 0xFFD700)
    .setTitle(`🎉 GIVEAWAY — ${gw.prize}`)
    .setDescription(
      `Clique sur **🎉 Participer** pour tenter ta chance !\n\n` +
      `🏆 **Lot :** ${gw.prize}\n` +
      `🕐 **Fin :** <t:${endTs}:R> (<t:${endTs}:f>)\n` +
      `🎖️ **Gagnant(s) :** ${gw.winnersCount}\n` +
      `📋 **Condition :** ${CONDITION_LABELS[gw.condition] || CONDITION_LABELS.aucune}${gw.condition !== 'aucune' ? ` (**${gw.seuil}** requis)` : ''}\n` +
      `👥 **Participants :** ${gw.participants.length}`
    )
    .setFooter({ text: `Organisé par ${gw.hostTag}` })
    .setTimestamp(gw.endAt);
}

function buildRow(gwId, ended = false) {
  const btn = new ButtonBuilder()
    .setCustomId(`gw_join_${gwId}`)
    .setLabel(ended ? '🎉 Giveaway terminé' : '🎉 Participer')
    .setStyle(ended ? ButtonStyle.Secondary : ButtonStyle.Success)
    .setDisabled(ended);
  return new ActionRowBuilder().addComponents(btn);
}

function pickWinners(gw) {
  const pool = [...gw.participants];
  const winners = [];
  const count = Math.min(gw.winnersCount, pool.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }
  return winners;
}

async function createGiveaway(client, { guild, channel, host, prize, durationKey, winnersCount, condition, seuil }) {
  const ms = DURATIONS_MS[durationKey];
  if (!ms) throw new Error('DUREE_INVALIDE');

  const endAt = Date.now() + ms;
  const gwId = `${channel.id}_${Date.now()}`;

  const gw = {
    id: gwId, guildId: guild.id, channelId: channel.id, messageId: null,
    prize, endAt, winnersCount, condition, seuil: seuil || 0,
    hostId: host.id, hostTag: host.tag,
    participants: [], ended: false, winners: [],
  };

  const msg = await channel.send({ embeds: [buildEmbed(gw)], components: [buildRow(gwId)] });
  gw.messageId = msg.id;

  const all = readAll();
  all[gwId] = gw;
  writeAll(all);

  return { gw, message: msg };
}

function getGiveaway(gwId) {
  const all = readAll();
  return all[gwId] || null;
}

function findByMessageId(guildId, messageId) {
  const all = readAll();
  const entry = Object.entries(all).find(([, gw]) => gw.guildId === guildId && gw.messageId === messageId);
  return entry || null;
}

function addParticipant(gwId, userId) {
  const all = readAll();
  const gw = all[gwId];
  if (!gw || gw.ended) return { ok: false, reason: 'ENDED' };
  if (gw.participants.includes(userId)) return { ok: false, reason: 'ALREADY' };
  gw.participants.push(userId);
  writeAll(all);
  return { ok: true, gw };
}

function listActive(guildId) {
  const all = readAll();
  return Object.values(all).filter(g => g.guildId === guildId && !g.ended);
}

async function announceResult(client, gw, winners, { reroll = false } = {}) {
  const guild = client.guilds.cache.get(gw.guildId);
  if (!guild) return;
  const channel = guild.channels.cache.get(gw.channelId);

  if (channel) {
    if (!reroll) {
      try {
        const msg = await channel.messages.fetch(gw.messageId);
        const resultEmbed = new EmbedBuilder()
          .setColor(winners.length ? 0x00FF88 : 0xFF4444)
          .setTitle(`🎉 GIVEAWAY TERMINÉ — ${gw.prize}`)
          .setDescription(
            winners.length
              ? `🏆 Félicitations ${winners.map(id => `<@${id}>`).join(', ')} !`
              : '❌ Aucun participant valide, pas de gagnant.'
          )
          .setFooter({ text: `Organisé par ${gw.hostTag}` })
          .setTimestamp();
        await msg.edit({ embeds: [resultEmbed], components: [buildRow(gw.id, true)] });
      } catch {}
    }

    await channel.send({
      content: winners.length
        ? `🎉 ${reroll ? 'Nouveau tirage — ' : ''}${winners.map(id => `<@${id}>`).join(', ')} — Vous avez gagné **${gw.prize}** ! Contacte <@${gw.hostId}> pour récupérer ton lot.`
        : `😢 Aucun gagnant valide pour **${gw.prize}**.`,
    }).catch(() => {});
  }

  for (const uid of winners) {
    try {
      const user = await client.users.fetch(uid);
      await user.send({
        embeds: [new EmbedBuilder()
          .setColor(0x00FF88)
          .setTitle(`🎉 Tu as gagné un giveaway${reroll ? ' (reroll)' : ''} !`)
          .setDescription(`Félicitations ! Tu as gagné **${gw.prize}** sur **${guild.name}** !\nContacte un administrateur pour récupérer ton lot.`)
          .setTimestamp()],
      }).catch(() => {});
    } catch {}
  }
}

async function endGiveaway(client, gwId) {
  const all = readAll();
  const gw = all[gwId];
  if (!gw || gw.ended) return null;

  const winners = pickWinners(gw);
  gw.ended = true;
  gw.winners = winners;
  all[gwId] = gw;
  writeAll(all);

  await announceResult(client, gw, winners);
  return winners;
}

async function rerollGiveaway(client, gwId) {
  const all = readAll();
  const gw = all[gwId];
  if (!gw || !gw.ended) return null;

  const winners = pickWinners(gw);
  gw.winners = winners;
  all[gwId] = gw;
  writeAll(all);

  await announceResult(client, gw, winners, { reroll: true });
  return winners;
}

async function checkExpiredGiveaways(client) {
  const all = readAll();
  const now = Date.now();
  for (const [gwId, gw] of Object.entries(all)) {
    if (!gw.ended && gw.endAt <= now) {
      await endGiveaway(client, gwId).catch(err => console.error('Erreur fin giveaway:', err.message));
    }
  }
}

module.exports = {
  DURATIONS_MS, CONDITION_LABELS, conditionMet,
  buildEmbed, buildRow, createGiveaway, endGiveaway, rerollGiveaway,
  checkExpiredGiveaways, getGiveaway, findByMessageId, addParticipant, listActive,
};
