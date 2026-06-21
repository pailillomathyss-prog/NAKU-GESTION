# 🤖 NAKU — Bot de Gestion Discord

Bot Discord complet pour la gestion de serveur : modération avancée, logs automatiques, règlement personnalisable et système de tickets.

---

## ✨ Fonctionnalités

### 🛡️ Modération
| Commande | Description |
|----------|-------------|
| `/ban` | Bannir un membre (avec suppression de messages) |
| `/unban` | Débannir un utilisateur par ID |
| `/kick` | Expulser un membre |
| `/mute` | Mettre en timeout (10m, 30m, 1h, 6h, 12h, 1j, 3j, 7j) |
| `/unmute` | Retirer le timeout |
| `/warn` | Avertir un membre |
| `/warns liste` | Voir les avertissements d'un membre |
| `/warns supprimer` | Supprimer un avertissement |
| `/clear` | Supprimer des messages en masse (1-100) |

### 📋 Logs Automatiques
Le bot logue automatiquement dans le salon configuré :
- Bans / Kicks / Mutes / Warns / Unbans
- Messages supprimés & modifiés
- Arrivées & départs de membres
- Création / suppression de salons
- Création / suppression de rôles
- Ouverture / fermeture de tickets

### 📜 Règlement
| Commande | Description |
|----------|-------------|
| `/reglement definir` | Définir jusqu'à 10 règles personnalisées |
| `/reglement afficher` | Voir le règlement actuel |
| `/reglement poster` | Poster le règlement dans un salon |

### 🎫 Tickets
| Commande | Description |
|----------|-------------|
| `/setupticket` | Créer le panneau de tickets dans un salon |
| Bouton "Ouvrir un ticket" | Crée un salon privé avec l'équipe |
| Bouton "Fermer le ticket" | Supprime le salon de ticket |

### ⚙️ Configuration
| Commande | Description |
|----------|-------------|
| `/setlog` | Définir le salon de logs |
| `/setwelcome` | Définir le salon de bienvenue |
| `/config voir` | Voir toute la configuration |
| `/config autorole` | Rôle donné automatiquement aux nouveaux membres |

---

## 🚀 Déploiement sur Railway

### Variables d'environnement requises sur Railway :

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Token de votre bot (Discord Developer Portal) |
| `CLIENT_ID` | ID de votre application Discord |

### Étapes :

1. **Fork / Clone** ce dépôt sur GitHub
2. Aller sur [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Sélectionner ce repo, choisir le dossier `discord-bot` comme root
4. Ajouter les variables d'environnement : `DISCORD_TOKEN` et `CLIENT_ID`
5. Railway démarre automatiquement le bot ✅

### Déployer les commandes slash (une seule fois) :

```bash
cd discord-bot
npm install
CLIENT_ID=ton_client_id DISCORD_TOKEN=ton_token node src/deploy-commands.js
```

> **Note :** Les commandes globales peuvent prendre jusqu'à 1h à apparaître. Pour un test immédiat, ajoute `GUILD_ID=ton_guild_id` pour un déploiement instantané sur un seul serveur.

---

## 📁 Structure du projet

```
discord-bot/
├── src/
│   ├── index.js              # Point d'entrée
│   ├── deploy-commands.js    # Déploiement des commandes slash
│   ├── handlers/
│   │   ├── commandHandler.js
│   │   └── eventHandler.js
│   ├── commands/
│   │   ├── moderation/       # ban, kick, mute, unmute, warn, warns, clear, unban
│   │   └── admin/            # setlog, setwelcome, setrules, setupticket, config
│   ├── events/               # ready, interactionCreate, guildMemberAdd, ...
│   └── utils/
│       ├── logger.js         # Système de logs
│       └── config.js         # Gestion de la configuration JSON
├── data/                     # Données persistantes (config, warns, tickets)
├── railway.json              # Config Railway
├── Procfile                  # Commande de démarrage
├── package.json
└── .env.example
```

---

## ⚙️ Configuration rapide après démarrage

1. `/setlog #salon-logs` — Activer les logs
2. `/setwelcome #bienvenue` — Messages de bienvenue
3. `/config autorole @Membre` — Rôle automatique
4. `/reglement definir` — Créer votre règlement
5. `/reglement poster #reglement` — Poster le règlement
6. `/setupticket #support @Staff` — Activer les tickets
