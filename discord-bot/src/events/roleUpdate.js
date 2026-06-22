const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'roleUpdate',
  async execute(oldRole, newRole, client) {
    const changes = [];
    if (oldRole.name !== newRole.name)
      changes.push({ name: 'Nom', value: `\`${oldRole.name}\` → \`${newRole.name}\``, inline: false });
    if (oldRole.hexColor !== newRole.hexColor)
      changes.push({ name: 'Couleur', value: `\`${oldRole.hexColor}\` → \`${newRole.hexColor}\``, inline: true });
    if (oldRole.hoist !== newRole.hoist)
      changes.push({ name: 'Affiché séparément', value: `${oldRole.hoist} → ${newRole.hoist}`, inline: true });
    if (oldRole.mentionable !== newRole.mentionable)
      changes.push({ name: 'Mentionnable', value: `${oldRole.mentionable} → ${newRole.mentionable}`, inline: true });

    if (!changes.length) return;

    await sendLog(client, newRole.guild.id, 'role_update', {
      title: 'Rôle Modifié',
      fields: [
        { name: 'Rôle', value: newRole.toString(), inline: true },
        ...changes,
      ],
    });
  },
};
