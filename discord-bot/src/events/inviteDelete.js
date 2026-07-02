const { sendLog } = require('../utils/logger');
const { removeInvite } = require('../utils/invites');

module.exports = {
  name: 'inviteDelete',
  async execute(invite, client) {
    if (!invite.guild) return;
    removeInvite(invite.guild.id, invite.code);
    await sendLog(client, invite.guild.id, 'invite_delete', {
      title: '🔗 Invitation Supprimée',
      fields: [
        { name: 'Code', value: `\`${invite.code}\``, inline: true },
        { name: 'Salon', value: invite.channel?.toString() || '—', inline: true },
      ],
    });
  },
};
