const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'threadDelete',
  async execute(thread, client) {
    if (!thread.guild) return;
    await sendLog(client, thread.guild.id, 'thread_delete', {
      title: '🧵 Thread Supprimé',
      fields: [
        { name: 'Nom', value: thread.name, inline: true },
        { name: 'Salon parent', value: thread.parent?.toString() || '—', inline: true },
      ],
    });
  },
};
