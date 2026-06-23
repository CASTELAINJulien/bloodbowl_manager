# 🏈 Blood Bowl Manager

Gestionnaire auto-hébergé de tournois et ligues **Blood Bowl** — inspiré de TourPlay.

Stack légère pensée pour tourner sur un petit serveur perso :
- **Backend** : Node.js + Express + SQLite (zéro service externe)
- **Frontend** : SPA HTML/CSS/JS vanilla (pas de build, pas de npm côté client)
- **Reverse-proxy** : Caddy 2 (HTTPS automatique via Let's Encrypt)
- **Conteneurisation** : Docker Compose

## ✨ Fonctionnalités

- Authentification (JWT) avec rôle admin (premier inscrit)
- Création de tournois en formats **Suisse**, **Round Robin**, **Élimination directe** ou **Ligue**
- Inscriptions d'équipes avec les 29 races officielles Blood Bowl 2020
- Génération automatique des appariements tour par tour
- Saisie des scores (TD + Casualties) par les organisateurs ou les coachs concernés
- Classement temps réel : points, différentiel TD, différentiel CAS
- Système de points configurable (par défaut 3 / 1 / 0)
- Vue podium, statistiques, historique des matchs

## 🚀 Mise en route

### 1. Prérequis
- Docker + Docker Compose installés
- Pour HTTPS public : un nom de domaine pointant vers votre serveur, ports 80 et 443 ouverts

### 2. Installation
```bash
git clone <votre-repo> bloodbowl-manager
cd bloodbowl-manager
cp .env.example .env
```

### 3. Configurer `.env`
```bash
# Génère un secret JWT solide
openssl rand -base64 48
```
Édite `.env` :
```env
JWT_SECRET=<le secret généré ci-dessus>
SITE_ADDRESS=bloodbowl.mondomaine.fr   # ou "localhost" pour test
```

### 4. Lancer
```bash
docker compose up -d --build
```

C'est tout. Caddy obtient automatiquement le certificat HTTPS si vous utilisez un vrai domaine.

### 5. Accéder
- Avec un domaine : `https://bloodbowl.mondomaine.fr`
- En local : `https://localhost` (accepter le certificat auto-signé) ou `http://localhost` si vous mettez `SITE_ADDRESS=:80`

> **Le premier compte créé devient automatiquement administrateur.** Inscrivez-vous immédiatement !

## 🗂️ Structure
```
bloodbowl-manager/
├── docker-compose.yml      # Orchestration
├── .env.example            # Modèle de configuration
├── caddy/
│   └── Caddyfile           # Reverse-proxy + HTTPS auto
├── backend/
│   ├── Dockerfile
│   ├── server.js           # API Express
│   ├── db.js               # Schéma SQLite
│   ├── auth.js             # JWT + bcrypt
│   └── pairings.js         # Algos d'appariement
└── frontend/
    ├── index.html
    ├── styles.css          # Thème "Iron & Blood"
    └── app.js              # SPA + router
```

## 🔧 Commandes utiles
```bash
# Logs en direct
docker compose logs -f

# Redémarrer après modif Caddyfile
docker compose restart caddy

# Reconstruire le backend après modif code
docker compose up -d --build backend

# Sauvegarder la base
docker compose exec backend sh -c "cp /app/data/bloodbowl.db /app/data/backup-$(date +%F).db"

# Tout arrêter
docker compose down

# Tout supprimer (⚠ efface les données)
docker compose down -v
```

## 💾 Sauvegardes
Les données SQLite sont dans le volume Docker `bb_data`. Pour sauvegarder :
```bash
docker run --rm -v bloodbowl-manager_bb_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/bb-backup-$(date +%F).tar.gz -C /data .
```

## 🎨 Personnaliser
- **Thème** : modifier les variables CSS dans `frontend/styles.css` (section `:root`)
- **Races** : ajuster la liste `BB_RACES` dans `backend/server.js`
- **Système de points** : configurable par tournoi dans l'interface

## 🔒 Sécurité
- Toujours utiliser un `JWT_SECRET` fort et unique
- Caddy gère TLS automatiquement avec Let's Encrypt
- Rate-limiting actif sur les routes d'authentification
- Le backend n'est jamais exposé directement, uniquement via Caddy

## 🛣️ Idées d'évolution
- Bracket visuel pour l'élimination directe
- Export PDF du classement
- Stats joueurs individuels (skills, MVP, etc.)
- Mode ligue persistante avec saisons
- Webhooks Discord pour annoncer les résultats
- Intégration NAF Rank

## 📜 Licence
À vous de choisir — ce code est fourni tel quel pour usage personnel.
