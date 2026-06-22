const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban, client) {
    await sendLog(client, ban.guild.id, 'ban', {
      title: 'Membre Banni',
      thumbnail: ban.user.displayAvatarURL({ dynamic: true }),
      fields: [
        { name: 'Utilisateur', value: `${ban.user.tag}`, inline: true },
        { name: 'ID', value: ban.user.id, inline: true },
        { name: 'Raison', value: ban.reason || 'Aucune raison fournie', inline: false },
      ],
    });
  },
};
