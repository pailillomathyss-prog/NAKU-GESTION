const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../../data/config.json');

function getConfig() {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

const LOG_COLORS = {
  ban: 0xFF0000,
  kick: 0xFF6600,
  mute: 0xFFAA00,
  warn: 0xFFFF00,
  unban: 0x00FF00,
  unmute: 0x00FF00,
  message_delete: 0x888888,
  message_edit: 0x4444FF,
  member_join: 0x00CCFF,
  member_leave: 0xFF4444,
  channel_create: 0x00FF88,
  channel_delete: 0xFF2222,
  role_create: 0x88FF00,
  role_delete: 0xFF8800,
  ticket_open: 0x00AAFF,
  ticket_close: 0x888888,
};

const LOG_ICONS = {
  ban: '🔨',
  kick: '👢',
  mute: '🔇',
  warn: '⚠️',
  unban: '✅',
  unmute: '🔊',
  message_delete: '🗑️',
  message_edit: '✏️',
  member_join: '📥',
  member_leave: '📤',
  channel_create: '📁',
  channel_delete: '🗂️',
  role_create: '🏷️',
  role_delete: '🔖',
  ticket_open: '🎫',
  ticket_close: '🔒',
};

async function sendLog(client, guildId, type, data) {
  const config = getConfig();
  const guildConfig = config[guildId];
  if (!guildConfig || !guildConfig.logChannel) return;

  const channel = await client.channels.fetch(guildConfig.logChannel).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(LOG_COLORS[type] || 0x5865F2)
    .setTitle(`${LOG_ICONS[type] || '📋'} ${data.title || type.replace('_', ' ').toUpperCase()}`)
    .setTimestamp();

  if (data.description) embed.setDescription(data.description);
  if (data.fields) embed.addFields(data.fields);
  if (data.footer) embed.setFooter({ text: data.footer });
  if (data.thumbnail) embed.setThumbnail(data.thumbnail);

  await channel.send({ embeds: [embed] }).catch(console.error);
}

module.exports = { sendLog };
