const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'channelDelete',
  async execute(channel, client) {
    if (!channel.guild) return;
    await sendLog(client, channel.guild.id, 'channel_delete', {
      title: 'Salon Supprimé',
      fields: [
        { name: 'Nom', value: channel.name, inline: true },
        { name: 'Type', value: String(channel.type), inline: true },
        { name: 'ID', value: channel.id, inline: true },
      ],
    });
  },
};
