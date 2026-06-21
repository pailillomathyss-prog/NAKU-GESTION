const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../../data/config.json');
const ticketsPath = path.join(__dirname, '../../data/tickets.json');
const warnsPath = path.join(__dirname, '../../data/warns.json');

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '{}', 'utf8');
  }
}

function readJSON(filePath) {
  ensureFile(filePath);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getConfig(guildId) {
  const data = readJSON(configPath);
  return data[guildId] || {};
}

function setConfig(guildId, key, value) {
  const data = readJSON(configPath);
  if (!data[guildId]) data[guildId] = {};
  data[guildId][key] = value;
  writeJSON(configPath, data);
}

function getWarns(guildId, userId) {
  const data = readJSON(warnsPath);
  return (data[guildId] && data[guildId][userId]) || [];
}

function addWarn(guildId, userId, warn) {
  const data = readJSON(warnsPath);
  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId][userId]) data[guildId][userId] = [];
  data[guildId][userId].push(warn);
  writeJSON(warnsPath, data);
}

function removeWarn(guildId, userId, index) {
  const data = readJSON(warnsPath);
  if (!data[guildId] || !data[guildId][userId]) return false;
  data[guildId][userId].splice(index, 1);
  writeJSON(warnsPath, data);
  return true;
}

function getTickets(guildId) {
  const data = readJSON(ticketsPath);
  return data[guildId] || {};
}

function setTicket(guildId, channelId, ticketData) {
  const data = readJSON(ticketsPath);
  if (!data[guildId]) data[guildId] = {};
  data[guildId][channelId] = ticketData;
  writeJSON(ticketsPath, data);
}

function deleteTicket(guildId, channelId) {
  const data = readJSON(ticketsPath);
  if (data[guildId]) {
    delete data[guildId][channelId];
    writeJSON(ticketsPath, data);
  }
}

module.exports = {
  getConfig, setConfig,
  getWarns, addWarn, removeWarn,
  getTickets, setTicket, deleteTicket,
};
