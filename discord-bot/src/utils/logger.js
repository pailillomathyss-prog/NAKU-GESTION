const { EmbedBuilder } = require('discord.js');
const { getConfig } = require('./config');

const LOG_COLORS = {
  ban:             0xFF0000,
  kick:            0xFF6600,
  mute:            0xFFAA00,
  warn:            0xFFFF00,
  unban:           0x00FF00,
  unmute:          0x00FF00,
  message_delete:  0x888888,
  message_edit:    0x4444FF,
  member_join:     0x00CCFF,
  member_leave:    0xFF4444,
  nickname_change: 0xAAAAAA,
  role_add:        0x00FF88,
  role_remove:     0xFF8800,
  channel_create:  0x00FF88,
  channel_delete:  0xFF2222,
  channel_update:  0x4488FF,
  role_create:     0x88FF00,
  role_delete:     0xFF8800,
  role_update:     0xFFCC00,
  voice_join:      0x00DDAA,
  voice_leave:     0xFF6644,
  voice_move:      0x4499FF,
  ticket_open:     0x00AAFF,
  ticket_close:    0x888888,
  invite_create:   0x77AAFF,
  invite_delete:   0xFF7777,
  emoji_create:    0xFFDD00,
  emoji_delete:    0xFF9900,
  thread_create:   0x99EEFF,
  thread_delete:   0xFF9988,
};

const LOG_ICONS = {
  ban:             '🔨',
  kick:            '👢',
  mute:            '🔇',
  warn:            '⚠️',
  unban:           '✅',
  unmute:          '🔊',
  message_delete:  '🗑️',
  message_edit:    '✏️',
  member_join:     '📥',
  member_leave:    '📤',
  nickname_change: '🏷️',
  role_add:        '➕',
  role_remove:     '➖',
  channel_create:  '📁',
  channel_delete:  '🗂️',
  channel_update:  '📝',
  role_create:     '🏷️',
  role_delete:     '🔖',
  role_update:     '🖊️',
  voice_join:      '🎙️',
  voice_leave:     '🔇',
  voice_move:      '↔️',
  ticket_open:     '🎫',
  ticket_close:    '🔒',
  invite_create:   '🔗',
  invite_delete:   '🚫',
  emoji_create:    '😀',
  emoji_delete:    '💨',
  thread_create:   '🧵',
  thread_delete:   '🗑️',
};

async function sendLog(client, guildId, type, data) {
  const config = getConfig(guildId);
  if (!config.logChannel) return;

  const channel = await client.channels.fetch(config.logChannel).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(LOG_COLORS[type] || 0x5865F2)
    .setTitle(`${LOG_ICONS[type] || '📋'} ${data.title || type.replace(/_/g, ' ').toUpperCase()}`)
    .setTimestamp();

  if (data.description) embed.setDescription(data.description);
  if (data.fields?.length) embed.addFields(data.fields);
  if (data.footer) embed.setFooter({ text: data.footer });
  if (data.thumbnail) embed.setThumbnail(data.thumbnail);

  await channel.send({ embeds: [embed] }).catch(console.error);
}

module.exports = { sendLog };
