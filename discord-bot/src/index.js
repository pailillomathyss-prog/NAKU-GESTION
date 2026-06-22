const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,       // bans
    GatewayIntentBits.GuildPresences,        // statuts (@PUB)
    GatewayIntentBits.GuildVoiceStates,      // vocal join/leave/move
    GatewayIntentBits.GuildInvites,          // invitations
    GatewayIntentBits.GuildEmojisAndStickers,// emojis & stickers
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

client.commands = new Collection();
client.prefix = '!';

const handlersPath = path.join(__dirname, 'handlers');
for (const file of fs.readdirSync(handlersPath).filter(f => f.endsWith('.js'))) {
  require(path.join(handlersPath, file))(client);
}

client.login(process.env.DISCORD_TOKEN);
