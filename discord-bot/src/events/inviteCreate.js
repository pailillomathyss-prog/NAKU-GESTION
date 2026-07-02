const { sendLog } = require('../utils/logger');
const { setInvite } = require('../utils/invites');

module.exports = {
  name: 'inviteCreate',
  async execute(invite, client) {
    if (!invite.guild) return;
    setInvite(invite.guild.id, invite.code, invite.uses || 0, invite.inviter?.id || null);
    await sendLog(client, invite.guild.id, 'invite_create', {
      title: '🔗 Invitation Créée',
      fields: [
        { name: 'Créateur', value: invite.inviter ? `${invite.inviter.tag}` : 'Inconnu', inline: true },
        { name: 'Code', value: `\`${invite.code}\``, inline: true },
        { name: 'Salon', value: invite.channel?.toString() || '—', inline: true },
        { name: 'Utilisations max', value: invite.maxUses ? `${invite.maxUses}` : 'Illimitées', inline: true },
        { name: 'Expire', value: invite.expiresAt ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>` : 'Jamais', inline: true },
      ],
    });
  },
};
