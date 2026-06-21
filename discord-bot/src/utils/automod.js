const { getConfig, setConfig } = require('./config');

// ── Stockage en mémoire ──────────────────────────────────────────────────────
const spamTracker = new Map();  // userId -> [timestamps]
const raidTracker = new Map();  // guildId -> [timestamps]
const warnCooldown = new Map(); // userId -> last warn timestamp

// ── Regex ────────────────────────────────────────────────────────────────────
const DISCORD_INVITE = /discord(?:\.gg|\.com\/invite|app\.com\/invite)\/[a-zA-Z0-9-]+/i;
const YOUTUBE_LINK   = /(?:youtu\.be\/|youtube\.com\/(?:watch|shorts|live))/i;
const HTTP_LINK      = /https?:\/\/[^\s]+/i;
const APP_LINK       = /(?:apps\.discord\.com|discord\.com\/application-directory|discord\.com\/discovery)/i;

const SPAM_PATTERNS = [
  /(.{5,})\1{3,}/i,
  /[\u2800-\u28ff]{10,}/,
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function getAutomod(guildId) {
  const config = getConfig(guildId);
  return config.automod || {};
}

function isChannelWhitelisted(guildId, channelId) {
  const am = getAutomod(guildId);
  return (am.whitelist || []).includes(channelId);
}

// ── Anti-Link ────────────────────────────────────────────────────────────────
function checkLink(message) {
  const am = getAutomod(message.guild.id);
  if (!am.antiLink) return null;
  if (isChannelWhitelisted(message.guild.id, message.channel.id)) return null;

  const content = message.content;

  // Discord invites — toujours bloqués si activé
  if (DISCORD_INVITE.test(content)) return { type: 'invite', reason: 'Lien d\'invitation Discord interdit' };

  // Liens d'applications
  if (am.antiApp && APP_LINK.test(content)) return { type: 'app', reason: 'Lien d\'application interdit' };

  // YouTube
  if (am.antiYoutube && YOUTUBE_LINK.test(content)) return { type: 'youtube', reason: 'Lien YouTube interdit' };

  // Tous liens externes
  if (am.antiExternalLinks && HTTP_LINK.test(content)) return { type: 'link', reason: 'Lien externe interdit' };

  return null;
}

// ── Anti-Spam ────────────────────────────────────────────────────────────────
function checkSpam(message) {
  const am = getAutomod(message.guild.id);
  if (!am.antiSpam) return false;

  const userId = message.author.id;
  const now = Date.now();
  const limit = am.spamLimit || 5;
  const interval = am.spamInterval || 4000;

  if (!spamTracker.has(userId)) spamTracker.set(userId, []);
  const timestamps = spamTracker.get(userId).filter(t => now - t < interval);
  timestamps.push(now);
  spamTracker.set(userId, timestamps);

  // Patterns de spam (répétitions, zalgo, etc.)
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(message.content)) return true;
  }

  return timestamps.length >= limit;
}

// ── Anti-Sticker / Sticker externe ──────────────────────────────────────────
function checkSticker(message) {
  const am = getAutomod(message.guild.id);
  if (!am.antiSticker) return false;
  if (isChannelWhitelisted(message.guild.id, message.channel.id)) return false;

  if (message.stickers?.size > 0) {
    const external = message.stickers.some(s => s.guildId !== message.guild.id);
    return external;
  }
  return false;
}

// ── Anti-Raid ────────────────────────────────────────────────────────────────
function checkRaid(guildId) {
  const am = getAutomod(guildId);
  if (!am.antiRaid) return false;

  const threshold = am.raidThreshold || 8;
  const interval = am.raidInterval || 10000;
  const now = Date.now();

  if (!raidTracker.has(guildId)) raidTracker.set(guildId, []);
  const joins = raidTracker.get(guildId).filter(t => now - t < interval);
  joins.push(now);
  raidTracker.set(guildId, joins);

  return joins.length >= threshold;
}

// ── Anti-Bot ─────────────────────────────────────────────────────────────────
function checkBot(member) {
  const am = getAutomod(member.guild.id);
  if (!am.antiBot) return false;
  if (!member.user.bot) return false;
  const whitelist = am.botWhitelist || [];
  return !whitelist.includes(member.user.id);
}

// ── Nettoyage périodique ──────────────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of spamTracker) {
    const fresh = v.filter(t => now - t < 10000);
    if (fresh.length === 0) spamTracker.delete(k); else spamTracker.set(k, fresh);
  }
  for (const [k, v] of raidTracker) {
    const fresh = v.filter(t => now - t < 30000);
    if (fresh.length === 0) raidTracker.delete(k); else raidTracker.set(k, fresh);
  }
}, 30000);

module.exports = { checkLink, checkSpam, checkSticker, checkRaid, checkBot, getAutomod };
