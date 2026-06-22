const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'emojiDelete',
  async execute(emoji, client) {
    await sendLog(client, emoji.guild.id, 'emoji_delete', {
      title: '😀 Emoji Supprimé',
      fields: [
        { name: 'Nom', value: `:${emoji.name}:`, inline: true },
        { name: 'ID', value: emoji.id, inline: true },
      ],
    });
  },
};
