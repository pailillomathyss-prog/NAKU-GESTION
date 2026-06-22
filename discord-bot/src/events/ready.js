const { REST, Routes, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const cloudSync = require('../utils/cloudSync');
const { restoreFromCloud, getConfig } = require('../utils/config');

/** Extrait le texte du statut personnalisé d'une Presence */
function getStatusText(presence) {
  if (!presence?.activities) return '';
  const custom = presence.activities.find(a => a.type === ActivityType.Custom);
  return [custom?.name, custom?.state, custom?.details].filter(Boolean).join(' ').toLowerCase();
}

/** Scan tous les membres en ligne et attribue/retire le rôle @PUB selon le trigger */
async function scanPresences(guild, client) {
  const config = getConfig(guild.id);
  if (!config.pubRole || !config.pubTriggers?.length) return;

  const role = guild.roles.cache.get(config.pubRole);
  if (!role) return;

  const triggers = config.pubTriggers.map(t => t.toLowerCase());
  let added = 0, removed = 0;

  for (const [, presence] of guild.presences.cache) {
    const member = guild.members.cache.get(presence.userId);
    if (!member || member.user.bot) continue;

    const text = getStatusText(presence);
    const matches = triggers.some(t => text.includes(t));
    const hasRole = member.roles.cache.has(role.id);

    if (matches && !hasRole) {
      await member.roles.add(role, 'AutoPub — scan démarrage').catch(() => {});
      added++;
    } else if (!matches && hasRole) {
      await member.roles.remove(role, 'AutoPub — scan démarrage').catch(() => {});
      removed++;
    }
  }

  if (added || removed) {
    console.log(`📢 [AutoPub] ${guild.name} — +${added} / -${removed} rôles`);
  }
}

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`\n🤖 Connecté : ${client.user.tag}`);
    console.log(`📡 Serveurs : ${client.guilds.cache.size}`);
    client.user.setActivity('🛡️ PV•PROTECT | !help', { type: ActivityType.Watching });

    // ── Nom du bot ────────────────────────────────────────────────────
    if (client.user.username !== 'PV•PROTECT') {
      await client.user.setUsername('PV•PROTECT').catch(err => {
        console.warn('⚠️  Nom non mis à jour (cooldown 1h) :', err.message);
      });
      console.log('✅ Nom appliqué : PV•PROTECT');
    }

    // ── Persistance Discord ───────────────────────────────────────────
    cloudSync.init(client);
    await restoreFromCloud();

    // ── Avatar & Bannière ─────────────────────────────────────────────
    const avatarPath = path.join(__dirname, '..', '..', 'assets', 'avatar.jpg');
    const bannerPath = path.join(__dirname, '..', '..', 'assets', 'banner.gif');

    if (fs.existsSync(avatarPath)) {
      await client.user.setAvatar(avatarPath).catch(err => {
        console.warn('⚠️  Avatar non mis à jour (cooldown) :', err.message);
      });
    }

    if (fs.existsSync(bannerPath)) {
      await client.user.setBanner(bannerPath).catch(err => {
        console.warn('⚠️  Bannière non appliquée (requiert bot vérifié) :', err.message);
      });
    }

    // ── Scan présences au démarrage (détection immédiate @PUB) ────────
    // Charge tous les membres pour avoir les présences complètes
    for (const [, guild] of client.guilds.cache) {
      try {
        await guild.members.fetch();
        await scanPresences(guild, client);
      } catch (err) {
        console.warn(`⚠️  Scan présences ${guild.name} :`, err.message);
      }
    }

    // ── Auto-déploiement des commandes slash ──────────────────────────
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
