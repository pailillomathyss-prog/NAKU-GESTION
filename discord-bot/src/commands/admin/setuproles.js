const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ActionRowBuilder,
} = require('discord.js');
const { setConfig } = require('../../utils/config');

// Groupes de rôles — mutuellement exclusifs au sein du groupe
const ROLE_GROUPS = [
  {
    id: 'activite',
    label: '🕐 Activité',
    options: [
      { key: 'NUIT',  label: '𝐍 𝐔 𝐈 𝐓',  emoji: '🌙', desc: 'Je suis actif la nuit' },
      { key: 'JOURS', label: '𝐉 𝐎 𝐔 𝐑 𝐒', emoji: '☀️', desc: 'Je suis actif le jour' },
    ],
  },
  {
    id: 'identite',
    label: '🎭 Identité',
    options: [
      { key: 'BOY',   label: '𝐁 𝐎 𝐘',   emoji: '👦', desc: 'Garçon' },
      { key: 'GIRL',  label: '𝐆 𝐈 𝐑 𝐋',  emoji: '👧', desc: 'Fille' },
      { key: 'EGIRL', label: '𝐄 𝐆 𝐈 𝐑 𝐋', emoji: '🎮', desc: 'E-girl' },
      { key: 'TRANS', label: '𝐓 𝐑 𝐀 𝐍 𝐒', emoji: '🏳️‍⚧️', desc: 'Trans' },
    ],
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setuproles')
    .setDescription('Poster le panneau de sélection de rôles (max 2 rôles : 1 activité + 1 identité)')
    .addChannelOption(o => o.setName('salon').setDescription('Salon où poster le panneau').setRequired(true))
    // Rôles du groupe Activité
    .addRoleOption(o => o.setName('nuit').setDescription('Rôle @𝐍 𝐔 𝐈 𝐓').setRequired(true))
    .addRoleOption(o => o.setName('jours').setDescription('Rôle @𝐉 𝐎 𝐔 𝐑 𝐒').setRequired(true))
    // Rôles du groupe Identité
    .addRoleOption(o => o.setName('boy').setDescription('Rôle @𝐁 𝐎 𝐘').setRequired(true))
    .addRoleOption(o => o.setName('girl').setDescription('Rôle @𝐆 𝐈 𝐑 𝐋').setRequired(true))
    .addRoleOption(o => o.setName('egirl').setDescription('Rôle @𝐄 𝐆 𝐈 𝐑 𝐋').setRequired(true))
    .addRoleOption(o => o.setName('trans').setDescription('Rôle @𝐓 𝐑 𝐀 𝐍 𝐒').setRequired(true))
    .addStringOption(o => o.setName('titre').setDescription('Titre du panneau').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const channel = interaction.options.getChannel('salon');
    const titre = interaction.options.getString('titre') || '🎭 Sélection de Rôles';

    // Récupérer les IDs des rôles
    const roleMap = {
      NUIT:  interaction.options.getRole('nuit').id,
      JOURS: interaction.options.getRole('jours').id,
      BOY:   interaction.options.getRole('boy').id,
      GIRL:  interaction.options.getRole('girl').id,
      EGIRL: interaction.options.getRole('egirl').id,
      TRANS: interaction.options.getRole('trans').id,
    };

    // Sauvegarder la config
    setConfig(interaction.guild.id, 'rolePanel', roleMap);

    // Menu activité
    const activiteMenu = new StringSelectMenuBuilder()
      .setCustomId('role_activite')
      .setPlaceholder('🕐 Activité — Choisis 1 rôle (optionnel)')
      .setMinValues(0)
      .setMaxValues(1)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('𝐍 𝐔 𝐈 𝐓').setDescription('Je suis actif la nuit').setEmoji('🌙').setValue('NUIT'),
        new StringSelectMenuOptionBuilder().setLabel('𝐉 𝐎 𝐔 𝐑 𝐒').setDescription('Je suis actif le jour').setEmoji('☀️').setValue('JOURS'),
        new StringSelectMenuOptionBuilder().setLabel('❌ Aucun').setDescription('Retirer mon rôle d\'activité').setEmoji('🚫').setValue('NONE_activite'),
      );

    // Menu identité
    const identiteMenu = new StringSelectMenuBuilder()
      .setCustomId('role_identite')
      .setPlaceholder('🎭 Identité — Choisis 1 rôle (optionnel)')
      .setMinValues(0)
      .setMaxValues(1)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('𝐁 𝐎 𝐘').setDescription('Garçon').setEmoji('👦').setValue('BOY'),
        new StringSelectMenuOptionBuilder().setLabel('𝐆 𝐈 𝐑 𝐋').setDescription('Fille').setEmoji('👧').setValue('GIRL'),
        new StringSelectMenuOptionBuilder().setLabel('𝐄 𝐆 𝐈 𝐑 𝐋').setDescription('E-girl').setEmoji('🎮').setValue('EGIRL'),
        new StringSelectMenuOptionBuilder().setLabel('𝐓 𝐑 𝐀 𝐍 𝐒').setDescription('Trans').setEmoji('🏳️‍⚧️').setValue('TRANS'),
        new StringSelectMenuOptionBuilder().setLabel('❌ Aucun').setDescription('Retirer mon rôle d\'identité').setEmoji('🚫').setValue('NONE_identite'),
      );

    const row1 = new ActionRowBuilder().addComponents(activiteMenu);
    const row2 = new ActionRowBuilder().addComponents(identiteMenu);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(titre)
      .setDescription(
        '> Choisis jusqu\'à **2 rôles** — un par catégorie.\n' +
        '> Tu peux changer tes rôles à tout moment.\n\u200b'
      )
      .addFields(
        {
          name: '🕐 Activité — choisir 1',
          value: `🌙 <@&${roleMap.NUIT}> — Actif la nuit\n☀️ <@&${roleMap.JOURS}> — Actif le jour`,
          inline: true,
        },
        {
          name: '🎭 Identité — choisir 1',
          value: `👦 <@&${roleMap.BOY}>\n👧 <@&${roleMap.GIRL}>\n🎮 <@&${roleMap.EGIRL}>\n🏳️‍⚧️ <@&${roleMap.TRANS}>`,
          inline: true,
        },
      )
      .setFooter({ text: `${interaction.guild.name} • Max 2 rôles (1 par catégorie)` })
      .setTimestamp();

    await channel.send({ embeds: [embed], components: [row1, row2] });
    await interaction.editReply({ content: `✅ Panneau de sélection de rôles posté dans ${channel}.` });
  },
};
