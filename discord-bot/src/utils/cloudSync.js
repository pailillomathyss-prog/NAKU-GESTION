/**
 * cloudSync.js — Persistance de la config via un salon Discord privé.
 * Le bot stocke config.json / tickets.json / warns.json comme pièces jointes
 * dans un salon "backup" et les restaure automatiquement au démarrage.
 *
 * Config : variable d'environnement CONFIG_BACKUP_CHANNEL = ID du salon
 */

const https = require('https');
const { AttachmentBuilder } = require('discord.js');

const TAGS = {
  config:  '🔒 NAKU-CONFIG',
  tickets: '🔒 NAKU-TICKETS',
  warns:   '🔒 NAKU-WARNS',
};

let _client = null;

function init(client) {
  _client = client;
}

function getChannel() {
  const channelId = process.env.CONFIG_BACKUP_CHANNEL;
  if (!channelId || !_client) return null;
  return _client.channels.cache.get(channelId) || null;
}

/** Télécharge le contenu d'une URL Discord (attachment) */
function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Restaure un fichier JSON depuis le salon Discord.
 * @param {'config'|'tickets'|'warns'} type
 * @returns {Object|null}
 */
async function restore(type) {
  const channel = getChannel();
  if (!channel) return null;

  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const tag = TAGS[type];

    const target = messages.find(m =>
      m.author.id === _client.user.id &&
      m.content === tag &&
      m.attachments.size > 0
    );

    if (!target) return null;

    const attachment = target.attachments.first();
    const raw = await downloadUrl(attachment.url);
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[cloudSync] Erreur restauration ${type}:`, err.message);
    return null;
  }
}

/**
 * Sauvegarde un objet JSON dans le salon Discord (remplace le message existant).
 * @param {'config'|'tickets'|'warns'} type
 * @param {Object} data
 */
async function save(type, data) {
  const channel = getChannel();
  if (!channel) return;

  try {
    const tag = TAGS[type];
    const json = JSON.stringify(data, null, 2);
    const attachment = new AttachmentBuilder(
      Buffer.from(json, 'utf8'),
      { name: `${type}.json` }
    );

    // Chercher et supprimer l'ancien message
    const messages = await channel.messages.fetch({ limit: 50 });
    const old = messages.find(m =>
      m.author.id === _client.user.id && m.content === tag
    );
    if (old) await old.delete().catch(() => {});

    // Envoyer le nouveau
    await channel.send({ content: tag, files: [attachment] });
  } catch (err) {
    console.error(`[cloudSync] Erreur sauvegarde ${type}:`, err.message);
  }
}

module.exports = { init, restore, save };
