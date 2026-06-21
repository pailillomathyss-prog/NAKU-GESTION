const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage, client) {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    await sendLog(client, oldMessage.guild.id, 'message_edit', {
      title: 'Message Modifié',
      fields: [
        { name: 'Auteur', value: oldMessage.author ? `${oldMessage.author.tag}` : 'Inconnu', inline: true },
        { name: 'Salon', value: oldMessage.channel.toString(), inline: true },
        { name: 'Avant', value: oldMessage.content?.slice(0, 1024) || '*Inconnu*', inline: false },
        { name: 'Après', value: newMessage.content?.slice(0, 1024) || '*Vide*', inline: false },
      ],
    });
  },
};
