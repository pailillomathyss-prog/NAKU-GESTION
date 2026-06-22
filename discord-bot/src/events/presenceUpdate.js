const { ActivityType } = require('discord.js');
const { getConfig } = require('../utils/config');
const { sendLog } = require('../utils/logger');

/** Extrait tout le texte du statut personnalisé */
function getStatusText(presence) {
  if (!presence?.activities) return '';
  const custom = presence.activities.find(a => a.type === ActivityType.Custom);
  if (!custom) return '';
  return [custom.name, custom.state, custom.details].filter(Boolean).join(' ').toLowerCase();
}

module.exports = {
  name: 'presenceUpdate',
  async execute(oldPresence, newPresence, client) {
    // Ignorer si aucun changement de statut personnalisé
    const oldText = getStatusText(oldPresence);
    const newText = getStatusText(newPresence);
    if (oldText === newText) return;

    const member = newPresence?.member ?? oldPresence?.member;
    if (!member || member.user.bot) return;

    const guild = newPresence?.guild ?? oldPresence?.guild;
    if (!guild) return;

    const config = getConfig(guild.id);
    if (!config.pubRole || !config.pubTriggers?.length) return;

    const role = guild.roles.cache.get(config.pubRole);
    if (!role) return;

    const triggers = config.pubTriggers.map(t => t.toLowerCase());
    const hasRole = member.roles.cache.has(role.id);
    const matches = triggers.some(t => newText.includes(t));

    // Attribuer si trigger détecté et pas encore le rôle
    if (matches && !hasRole) {
      await member.roles.add(role, 'AutoPub — trigger dans le statut').catch(() => {});
      await sendLog(client, guild.id, 'role_create', {
        title: '📢 Rôle @PUB Attribué',
        description: `${member.user} a le trigger dans son statut.`,
        fields: [
          { name: 'Utilisateur', value: `${member.user.tag}`, inline: true },
          { name: 'Rôle', value: role.name, inline: true },
          { name: 'Statut détecté', value: `\`${newText.slice(0, 200)}\``, inline: false },
        ],
        thumbnail: member.user.displayAvatarURL({ dynamic: true }),
      });
      return;
    }

    // Retirer si trigger disparu et a encore le rôle
    if (!matches && hasRole) {
      await member.roles.remove(role, 'AutoPub — trigger retiré du statut').catch(() => {});
      await sendLog(client, guild.id, 'role_delete', {
        title: '📢 Rôle @PUB Retiré',
        description: `${member.user} n'a plus le trigger dans son statut.`,
        fields: [
          { name: 'Utilisateur', value: `${member.user.tag}`, inline: true },
          { name: 'Rôle', value: role.name, inline: true },
          { name: 'Ancien statut', value: `\`${oldText.slice(0, 200) || '—'}\``, inline: false },
        ],
      });
    }
  },
};
