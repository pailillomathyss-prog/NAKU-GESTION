const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'roleDelete',
  async execute(role, client) {
    await sendLog(client, role.guild.id, 'role_delete', {
      title: 'Rôle Supprimé',
      fields: [
        { name: 'Nom', value: role.name, inline: true },
        { name: 'ID', value: role.id, inline: true },
      ],
    });
  },
};
