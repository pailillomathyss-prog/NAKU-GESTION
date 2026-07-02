const { sendLog } = require('../utils/logger');
const { addVoiceMinutes } = require('../utils/stats');

// Timestamp de connexion en vocal par membre : Map(`${guildId}_${userId}` -> timestamp)
const voiceJoinTimestamps = new Map();

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;
    const guild = newState.guild || oldState.guild;
    const key = `${guild.id}_${member.id}`;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // Rejoindre un vocal
    if (!oldChannel && newChannel) {
      voiceJoinTimestamps.set(key, Date.now());
      return sendLog(client, guild.id, 'voice_join', {
        title: '🎙️ Vocal — Connexion',
        thumbnail: member.user.displayAvatarURL({ dynamic: true }),
        fields: [
          { name: 'Membre', value: `${member.user.tag}`, inline: true },
          { name: 'Salon', value: newChannel.name, inline: true },
        ],
      });
    }

    // Quitter un vocal
    if (oldChannel && !newChannel) {
      const joinedAt = voiceJoinTimestamps.get(key);
      if (joinedAt) {
        const minutes = Math.floor((Date.now() - joinedAt) / 60000);
        addVoiceMinutes(guild.id, member.id, minutes);
        voiceJoinTimestamps.delete(key);
      }
      return sendLog(client, guild.id, 'voice_leave', {
        title: '🎙️ Vocal — Déconnexion',
        thumbnail: member.user.displayAvatarURL({ dynamic: true }),
        fields: [
          { name: 'Membre', value: `${member.user.tag}`, inline: true },
          { name: 'Salon quitté', value: oldChannel.name, inline: true },
        ],
      });
    }

    // Changer de salon vocal
    if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      return sendLog(client, guild.id, 'voice_move', {
        title: '🎙️ Vocal — Déplacement',
        thumbnail: member.user.displayAvatarURL({ dynamic: true }),
        fields: [
          { name: 'Membre', value: `${member.user.tag}`, inline: true },
          { name: 'Avant', value: oldChannel.name, inline: true },
          { name: 'Après', value: newChannel.name, inline: true },
        ],
      });
    }
  },
};
