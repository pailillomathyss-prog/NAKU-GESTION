const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {
    const guild = newMember.guild;

    // ── Changement de pseudo ─────────────────────────────────────────
    if (oldMember.nickname !== newMember.nickname) {
      await sendLog(client, guild.id, 'nickname_change', {
        title: 'Pseudo Modifié',
        thumbnail: newMember.user.displayAvatarURL({ dynamic: true }),
        fields: [
          { name: 'Membre', value: `${newMember.user.tag}`, inline: true },
          { name: 'Avant', value: oldMember.nickname || '*Aucun*', inline: true },
          { name: 'Après', value: newMember.nickname || '*Aucun*', inline: true },
        ],
      });
    }

    // ── Rôles ajoutés ────────────────────────────────────────────────
    const rolesAdded = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id) && r.id !== guild.id);
    if (rolesAdded.size > 0) {
      await sendLog(client, guild.id, 'role_add', {
        title: 'Rôle(s) Ajouté(s)',
        thumbnail: newMember.user.displayAvatarURL({ dynamic: true }),
        fields: [
          { name: 'Membre', value: `${newMember.user.tag}`, inline: true },
          { name: 'Rôle(s)', value: rolesAdded.map(r => r.toString()).join(', '), inline: true },
        ],
      });
    }

    // ── Rôles retirés ────────────────────────────────────────────────
    const rolesRemoved = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id) && r.id !== guild.id);
    if (rolesRemoved.size > 0) {
      await sendLog(client, guild.id, 'role_remove', {
        title: 'Rôle(s) Retiré(s)',
        thumbnail: newMember.user.displayAvatarURL({ dynamic: true }),
        fields: [
          { name: 'Membre', value: `${newMember.user.tag}`, inline: true },
          { name: 'Rôle(s)', value: rolesRemoved.map(r => r.toString()).join(', '), inline: true },
        ],
      });
    }

    // ── Timeout ──────────────────────────────────────────────────────
    const wasTimedOut = !!oldMember.communicationDisabledUntil;
    const isTimedOut = !!newMember.communicationDisabledUntil;
    if (!wasTimedOut && isTimedOut) {
      await sendLog(client, guild.id, 'mute', {
        title: 'Membre en Timeout',
        thumbnail: newMember.user.displayAvatarURL({ dynamic: true }),
        fields: [
          { name: 'Membre', value: `${newMember.user.tag}`, inline: true },
          { name: 'Fin', value: `<t:${Math.floor(newMember.communicationDisabledUntil / 1000)}:R>`, inline: true },
        ],
      });
    }
    if (wasTimedOut && !isTimedOut) {
      await sendLog(client, guild.id, 'unmute', {
        title: 'Timeout Levé',
        thumbnail: newMember.user.displayAvatarURL({ dynamic: true }),
        fields: [{ name: 'Membre', value: `${newMember.user.tag}`, inline: true }],
      });
    }
  },
};
