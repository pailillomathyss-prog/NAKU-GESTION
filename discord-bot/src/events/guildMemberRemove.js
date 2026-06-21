const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    await sendLog(client, member.guild.id, 'member_leave', {
      title: 'Membre Parti',
      description: `${member.user.tag} a quitté le serveur.`,
      thumbnail: member.user.displayAvatarURL({ dynamic: true }),
      fields: [
        { name: 'Tag', value: member.user.tag, inline: true },
        { name: 'ID', value: member.user.id, inline: true },
        { name: 'Rôles', value: member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.name).join(', ') || 'Aucun', inline: false },
        { name: 'Membres restants', value: `${member.guild.memberCount}`, inline: true },
      ],
    });
  },
};
