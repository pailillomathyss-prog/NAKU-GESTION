const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'channelCreate',
  async execute(channel, client) {
    if (!channel.guild) return;
    await sendLog(client, channel.guild.id, 'channel_create', {
      title: 'Salon Créé',
      fields: [
        { name: 'Nom', value: channel.name, inline: true },
        { name: 'Type', value: String(channel.type), inline: true },
        { name: 'ID', value: channel.id, inline: true },
      ],
    });
  },
};
