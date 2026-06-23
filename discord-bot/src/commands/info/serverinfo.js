const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Afficher les informations complètes du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const guild = interaction.guild;
    await guild.fetch();

    const totalMembers  = guild.memberCount;
    const botCount      = guild.members.cache.filter(m => m.user.bot).size;
    const humanCount    = totalMembers - botCount;
    const onlineCount   = guild.presences.cache.filter(p => p.status !== 'offline').size;

    const textChannels  = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories    = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
    const threads       = guild.channels.cache.filter(c => c.isThread()).size;

    const roleCount     = guild.roles.cache.size - 1; // exclut @everyone
    const emojiCount    = guild.emojis.cache.size;
    const boostCount    = guild.premiumSubscriptionCount || 0;
    const boostTier     = guild.premiumTier;

    const owner         = await guild.fetchOwner().catch(() => null);
    const createdAt     = `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`;
    const createdAgo    = `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`;

    const verif = ['Aucune', 'Faible', 'Moyenne', 'Élevée', 'Très élevée'];

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📊 ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '👑 Propriétaire', value: owner ? `${owner.user.tag}` : '—', inline: true },
        { name: '🆔 ID', value: guild.id, inline: true },
        { name: '📅 Créé le', value: `${createdAt} (${createdAgo})`, inline: false },
        { name: '👥 Membres', value: [
          `Total : **${totalMembers}**`,
          `Humains : **${humanCount}**`,
          `Bots : **${botCount}**`,
          `En ligne : **${onlineCount}**`,
        ].join('\n'), inline: true },
        { name: '💬 Salons', value: [
          `Texte : **${textChannels}**`,
          `Vocal : **${voiceChannels}**`,
          `Catégories : **${categories}**`,
          `Threads : **${threads}**`,
        ].join('\n'), inline: true },
        { name: '🏷️ Rôles', value: `**${roleCount}** rôles`, inline: true },
        { name: '😀 Emojis', value: `**${emojiCount}** emojis`, inline: true },
        { name: '🔒 Vérification', value: verif[guild.verificationLevel] || '—', inline: true },
        { name: '🚀 Boosts', value: `**${boostCount}** boosts (Tier **${boostTier}**)`, inline: true },
      )
      .setTimestamp();

    if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 1024 }));

    return interaction.editReply({ embeds: [embed] });
  },
};
