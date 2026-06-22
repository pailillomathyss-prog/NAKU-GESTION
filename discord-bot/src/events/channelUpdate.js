const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'channelUpdate',
  async execute(oldChannel, newChannel, client) {
    if (!newChannel.guild) return;

    const changes = [];
    if (oldChannel.name !== newChannel.name)
      changes.push({ name: 'Nom', value: `\`${oldChannel.name}\` → \`${newChannel.name}\``, inline: false });
    if (oldChannel.topic !== newChannel.topic)
      changes.push({ name: 'Sujet', value: `\`${oldChannel.topic || '—'}\` → \`${newChannel.topic || '—'}\``, inline: false });
    if (oldChannel.nsfw !== newChannel.nsfw)
      changes.push({ name: 'NSFW', value: `${oldChannel.nsfw} → ${newChannel.nsfw}`, inline: true });
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser)
      changes.push({ name: 'Slowmode', value: `${oldChannel.rateLimitPerUser}s → ${newChannel.rateLimitPerUser}s`, inline: true });

    if (!changes.length) return;

    await sendLog(client, newChannel.guild.id, 'channel_update', {
      title: 'Salon Modifié',
      fields: [
        { name: 'Salon', value: newChannel.toString(), inline: true },
        ...changes,
      ],
    });
  },
};
