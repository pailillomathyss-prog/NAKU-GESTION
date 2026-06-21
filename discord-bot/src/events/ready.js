module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`\n🤖 Bot connecté en tant que : ${client.user.tag}`);
    console.log(`📡 Serveurs : ${client.guilds.cache.size}`);
    client.user.setActivity('🛡️ NAKU Gestion', { type: 3 });
  },
};
