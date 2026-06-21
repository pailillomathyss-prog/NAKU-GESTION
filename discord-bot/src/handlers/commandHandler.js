const { Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = (client) => {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, '..', 'commands');

  function loadCommands(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        loadCommands(fullPath);
      } else if (file.endsWith('.js')) {
        const command = require(fullPath);
        if (command.data && command.execute) {
          client.commands.set(command.data.name, command);
          console.log(`✅ Commande chargée : /${command.data.name}`);
        }
      }
    }
  }

  loadCommands(commandsPath);
};
