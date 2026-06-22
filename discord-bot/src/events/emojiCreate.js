const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'emojiCreate',
  async execute(emoji, client) {
    await sendLog(client, emoji.guild.id, 'emoji_create', {
      title: '😀 Emoji Ajouté',
      thumbnail: emoji.imageURL(),
      fields: [
        { name: 'Nom', value: `:${emoji.name}:`, inline: true },
        { name: 'ID', value: emoji.id, inline: true },
        { name: 'Animé', value: emoji.animated ? 'Oui' : 'Non', inline: true },
      ],
    });
  },
};
