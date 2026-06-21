const { InteractionType, ChannelType, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getConfig, setTicket, getTickets, deleteTicket } = require('../utils/config');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ── Commandes slash ─────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(err);
        const msg = { content: '❌ Une erreur est survenue.', flags: 64 };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => {});
        } else {
          await interaction.reply(msg).catch(() => {});
        }
      }
      return;
    }

    // ── Bouton "Ouvrir un ticket" ────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'open_ticket') {
      await interaction.deferReply({ flags: 64 });

      const config = getConfig(interaction.guild.id);
      const tickets = getTickets(interaction.guild.id);

      const existing = Object.values(tickets).find(t => t.userId === interaction.user.id);
      if (existing) {
        const ch = interaction.guild.channels.cache.get(existing.channelId);
        return interaction.editReply({ content: `❌ Tu as déjà un ticket ouvert : ${ch ? ch.toString() : 'introuvable'}.` });
      }

      const ticketCount = Object.keys(tickets).length + 1;
      const categoryId = config.ticketCategory || null;

      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          ...(config.staffRole ? [{ id: config.staffRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
        ],
      });

      const ticketData = { channelId: channel.id, userId: interaction.user.id, number: ticketCount, openedAt: new Date().toISOString() };
      setTicket(interaction.guild.id, channel.id, ticketData);

      const closeBtn = new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Fermer le ticket').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(closeBtn);

      const embed = new EmbedBuilder()
        .setColor(0x00AAFF)
        .setTitle('🎫 Nouveau Ticket')
        .setDescription(`Bonjour ${interaction.user}, merci d'avoir ouvert un ticket !\n\nExplique-nous ton problème, l'équipe sera là pour t'aider.`)
        .setFooter({ text: `Ticket #${ticketCount}` })
        .setTimestamp();

      await channel.send({ content: `${interaction.user}${config.staffRole ? ` <@&${config.staffRole}>` : ''}`, embeds: [embed], components: [row] });

      await sendLog(client, interaction.guild.id, 'ticket_open', {
        title: 'Ticket Ouvert',
        fields: [
          { name: 'Utilisateur', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
          { name: 'Salon', value: channel.toString(), inline: true },
        ],
      });

      return interaction.editReply({ content: `✅ Ton ticket a été créé : ${channel}` });
    }

    // ── Bouton "Fermer le ticket" ────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
      await interaction.deferReply({ flags: 64 });

      const config = getConfig(interaction.guild.id);
      const tickets = getTickets(interaction.guild.id);
      const ticket = tickets[interaction.channel.id];

      if (!ticket) return interaction.editReply({ content: '❌ Ce salon n\'est pas un ticket.' });

      const hasStaff = config.staffRole && interaction.member.roles.cache.has(config.staffRole);
      const isOwner = ticket.userId === interaction.user.id;
      if (!hasStaff && !isOwner && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply({ content: '❌ Tu n\'as pas la permission de fermer ce ticket.' });
      }

      await sendLog(client, interaction.guild.id, 'ticket_close', {
        title: 'Ticket Fermé',
        fields: [
          { name: 'Fermé par', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
          { name: 'Propriétaire du ticket', value: `<@${ticket.userId}>`, inline: true },
        ],
      });

      deleteTicket(interaction.guild.id, interaction.channel.id);

      await interaction.editReply({ content: '🔒 Fermeture du ticket dans 5 secondes...' });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
  },
};
