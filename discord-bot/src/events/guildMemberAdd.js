const { EmbedBuilder } = require('discord.js');
const { getConfig } = require('../utils/config');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const config = getConfig(member.guild.id);

    // Log arrivée
    await sendLog(client, member.guild.id, 'member_join', {
      title: 'Membre Rejoint',
      description: `${member.user} a rejoint le serveur.`,
      thumbnail: member.user.displayAvatarURL({ dynamic: true }),
      fields: [
        { name: 'Tag', value: member.user.tag, inline: true },
        { name: 'ID', value: member.user.id, inline: true },
        { name: 'Compte créé le', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'Membres total', value: `${member.guild.memberCount}`, inline: true },
      ],
    });

    // Message de bienvenue
    if (config.welcomeChannel) {
      const channel = member.guild.channels.cache.get(config.welcomeChannel);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0x00CCFF)
          .setTitle(`👋 Bienvenue sur ${member.guild.name} !`)
          .setDescription(`Bienvenue ${member} sur le serveur !\nTu es le **${member.guild.memberCount}ème** membre.`)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    // Rôle automatique
    if (config.autoRole) {
      const role = member.guild.roles.cache.get(config.autoRole);
      if (role) await member.roles.add(role).catch(() => {});
    }
  },
};
