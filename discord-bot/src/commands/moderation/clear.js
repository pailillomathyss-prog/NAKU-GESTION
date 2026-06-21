const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprimer des messages en masse')
    .addIntegerOption(o => o.setName('nombre').setDescription('Nombre de messages à supprimer (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('membre').setDescription('Supprimer uniquement les messages de ce membre').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const nombre = interaction.options.getInteger('nombre');
    const target = interaction.options.getUser('membre');

    await interaction.deferReply({ flags: 64 });

    let messages = await interaction.channel.messages.fetch({ limit: 100 });

    if (target) {
      messages = messages.filter(m => m.author.id === target.id).first(nombre);
    } else {
      messages = messages.first(nombre);
    }

    const recent = messages.filter ? messages.filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000) : messages;
    const toDelete = recent.size !== undefined ? [...recent.values()] : recent;

    if (!toDelete.length) {
      return interaction.editReply({ content: '❌ Aucun message récent à supprimer (max 14 jours).' });
    }

    await interaction.channel.bulkDelete(toDelete, true);
    await interaction.editReply({ content: `✅ ${toDelete.length} message(s) supprimé(s).` });
  },
};
