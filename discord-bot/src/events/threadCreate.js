const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'threadCreate',
  async execute(thread, newlyCreated, client) {
    if (!newlyCreated || !thread.guild) return;
    await sendLog(client, thread.guild.id, 'thread_create', {
      title: '🧵 Thread Créé',
      fields: [
        { name: 'Nom', value: thread.name, inline: true },
        { name: 'Salon parent', value: thread.parent?.toString() || '—', inline: true },
        { name: 'Créateur', value: thread.ownerId ? `<@${thread.ownerId}>` : '—', inline: true },
      ],
    });
  },
};
