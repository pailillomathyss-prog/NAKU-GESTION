const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'inviteDelete',
  async execute(invite, client) {
    if (!invite.guild) return;
    await sendLog(client, invite.guild.id, 'invite_delete', {
      title: '🔗 Invitation Supprimée',
      fields: [
        { name: 'Code', value: `\`${invite.code}\``, inline: true },
        { name: 'Salon', value: invite.channel?.toString() || '—', inline: true },
      ],
    });
  },
};
