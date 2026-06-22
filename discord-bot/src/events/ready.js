const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const cloudSync = require('../utils/cloudSync');
const { restoreFromCloud } = require('../utils/config');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`\n🤖 Connecté : ${client.user.tag}`);
    console.log(`📡 Serveurs : ${client.guilds.cache.size}`);
    client.user.setActivity('🛡️ PV•PROTECT | !help', { type: 3 });

    // ── Nom du bot ────────────────────────────────────────────────────
    if (client.user.username !== 'PV•PROTECT') {
      await client.user.setUsername('PV•PROTECT').catch(err => {
        console.warn('⚠️  Nom non mis à jour (cooldown 1h) :', err.message);
      });
      console.log('✅ Nom appliqué : PV•PROTECT');
    }

    // ── Initialiser le système de persistance Discord ─────────────────────
    cloudSync.init(client);
    await restoreFromCloud();

    // ── Avatar & Bannière ─────────────────────────────────────────────────
    const avatarPath = path.join(__dirname, '..', '..', 'assets', 'avatar.jpg');
    const bannerPath = path.join(__dirname, '..', '..', 'assets', 'banner.gif');

    if (fs.existsSync(avatarPath)) {
      await client.user.setAvatar(avatarPath).catch(err => {
        console.warn('⚠️  Avatar non mis à jour (peut être en cooldown) :', err.message);
      });
      console.log('✅ Avatar appliqué.');
    }

    if (fs.existsSync(bannerPath)) {
      await client.user.setBanner(bannerPath).catch(err => {
        console.warn('⚠️  Bannière non appliquée (requiert bot vérifié) :', err.message);
      });
    }

    // ── Auto-déploiement des commandes slash ──────────────────────────────
    if (!process.env.CLIENT_ID) {
      console.warn('⚠️  CLIENT_ID manquant — commandes slash non déployées.');
      return;
    }

    try {
      const commands = [];
      const commandsPath = path.join(__dirname, '..', 'commands');

      function loadCommands(dir) {
        for (const file of fs.readdirSync(dir)) {
          const full = path.join(dir, file);
          if (fs.statSync(full).isDirectory()) { loadCommands(full); continue; }
          if (!file.endsWith('.js')) continue;
          const cmd = require(full);
          if (cmd.data) commands.push(cmd.data.toJSON());
        }
      }
      loadCommands(commandsPath);

      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
      const route = process.env.GUILD_ID
        ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
        : Routes.applicationCommands(process.env.CLIENT_ID);

      await rest.put(route, { body: commands });
      console.log(`✅ ${commands.length} commandes slash déployées.`);
    } catch (err) {
      console.error('❌ Erreur déploiement commandes:', err.message);
    }
  },
};
