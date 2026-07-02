const fs = require('fs');
const path = require('path');

const statsPath = path.join(__dirname, '../../data/stats.json');

function ensureFile() {
  if (!fs.existsSync(statsPath)) fs.writeFileSync(statsPath, '{}', 'utf8');
}

function readJSON() {
  ensureFile();
  try { return JSON.parse(fs.readFileSync(statsPath, 'utf8')); } catch { return {}; }
}

function writeJSON(data) {
  fs.writeFileSync(statsPath, JSON.stringify(data, null, 2), 'utf8');
}

function ensureUser(data, guildId, userId) {
  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId][userId]) data[guildId][userId] = { messages: 0, voiceMinutes: 0, invites: 0 };
  return data[guildId][userId];
}

function getUserStats(guildId, userId) {
  const data = readJSON();
  return (data[guildId] && data[guildId][userId]) || { messages: 0, voiceMinutes: 0, invites: 0 };
}

function incrementMessages(guildId, userId) {
  const data = readJSON();
  ensureUser(data, guildId, userId).messages++;
  writeJSON(data);
}

function addVoiceMinutes(guildId, userId, minutes) {
  if (minutes <= 0) return;
  const data = readJSON();
  ensureUser(data, guildId, userId).voiceMinutes += minutes;
  writeJSON(data);
}

function addInvites(guildId, userId, amount = 1) {
  const data = readJSON();
  ensureUser(data, guildId, userId).invites += amount;
  writeJSON(data);
}

module.exports = {
  getUserStats,
  incrementMessages,
  addVoiceMinutes,
  addInvites,
};
