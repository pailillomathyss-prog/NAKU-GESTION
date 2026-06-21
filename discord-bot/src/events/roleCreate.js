const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'roleCreate',
  async execute(role, client) {
    await sendLog(client, role.guild.id, 'role_create', {
      title: 'Rôle Créé',
      fields: [
        { name: 'Nom', value: role.name, inline: true },
        { name: 'ID', value: role.id, inline: true },
        { name: 'Couleur', value: role.hexColor, inline: true },
      ],
    });
  },
};
