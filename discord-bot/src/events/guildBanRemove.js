const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildBanRemove',
  async execute(ban, client) {
    await sendLog(client, ban.guild.id, 'unban', {
      title: 'Membre Débanni',
      thumbnail: ban.user.displayAvatarURL({ dynamic: true }),
      fields: [
        { name: 'Utilisateur', value: `${ban.user.tag}`, inline: true },
        { name: 'ID', value: ban.user.id, inline: true },
      ],
    });
  },
};
