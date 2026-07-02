// Cache mémoire des invitations par serveur : Map(guildId -> Map(code -> { uses, inviterId }))
const guildInviteCache = new Map();

async function cacheGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    const map = new Map();
    invites.forEach(inv => map.set(inv.code, { uses: inv.uses || 0, inviterId: inv.inviter?.id || null }));
    guildInviteCache.set(guild.id, map);
  } catch {
    guildInviteCache.set(guild.id, new Map());
  }
}

function setInvite(guildId, code, uses, inviterId) {
  if (!guildInviteCache.has(guildId)) guildInviteCache.set(guildId, new Map());
  guildInviteCache.get(guildId).set(code, { uses: uses || 0, inviterId: inviterId || null });
}

function removeInvite(guildId, code) {
  guildInviteCache.get(guildId)?.delete(code);
}

// Compare le cache avant/après l'arrivée d'un membre pour déterminer quelle invitation a été utilisée
async function findUsedInvite(guild) {
  const before = guildInviteCache.get(guild.id) || new Map();
  let after;
  try {
    after = await guild.invites.fetch();
  } catch {
    return null;
  }

  let used = null;
  for (const [, inv] of after) {
    const prev = before.get(inv.code);
    const uses = inv.uses || 0;
    if (!prev) {
      if (uses > 0) { used = inv; break; }
      continue;
    }
    if (uses > prev.uses) { used = inv; break; }
  }

  const map = new Map();
  after.forEach(inv => map.set(inv.code, { uses: inv.uses || 0, inviterId: inv.inviter?.id || null }));
  guildInviteCache.set(guild.id, map);

  return used;
}

module.exports = {
  cacheGuildInvites,
  setInvite,
  removeInvite,
  findUsedInvite,
};
