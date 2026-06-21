const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'messageDelete',
  async execute(message, client) {
    if (!message.guild || message.author?.bot) return;

    await sendLog(client, message.guild.id, 'message_delete', {
      title: 'Message Supprimé',
      fields: [
        { name: 'Auteur', value: message.author ? `${message.author.tag} (${message.author.id})` : 'Inconnu', inline: true },
        { name: 'Salon', value: message.channel.toString(), inline: true },
        { name: 'Contenu', value: message.content || '*Pas de contenu texte*', inline: false },
      ],
    });
  },
};
