const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`\n🤖 Connecté : ${client.user.tag}`);
    console.log(`📡 Serveurs : ${client.guilds.cache.size}`);
    client.user.setActivity('🛡️ NAKU Gestion | !help', { type: 3 });

    // Auto-déploiement des commandes slash au démarrage
    if (!process.env.CLIENT_ID) {
      console.warn('⚠️  CLIENT_ID manquant — commandes slash non déployées. Ajoutez CLIENT_ID dans les variables Railway.');
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
      console.log(`✅ ${commands.length} commandes slash déployées automatiquement.`);
    } catch (err) {
      console.error('❌ Erreur déploiement commandes:', err.message);
    }
  },
};
