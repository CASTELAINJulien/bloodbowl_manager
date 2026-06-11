# Blood Bowl Manager

Gestionnaire auto-hébergé de tournois et ligues **Blood Bowl**, inspiré de TourPlay.

Stack légère conçue pour un petit serveur perso :

| Composant | Technologie |
|-----------|-------------|
| Backend | Node.js 20 + Express + SQLite (better-sqlite3) |
| Frontend | SPA HTML/CSS/JS vanilla — aucun build requis |
| Reverse-proxy | Caddy 2 — HTTPS automatique via Let's Encrypt |
| Conteneurisation | Docker Compose |

## Fonctionnalités

**Tournois**
- Formats : **Suisse**, **Round Robin**, **Élimination directe**, **Ligue**
- Génération automatique des appariements tour par tour
- Saisie des scores (TD + Casualties) par l'organisateur ou les coachs concernés
- Classement temps réel : points, différentiel TD, différentiel CAS
- Système de points configurable (défaut : 3 / 1 / 0)
- Vue podium, statistiques et historique des matchs
- Export PDF du classement

**Équipes & Joueurs**
- 29 races officielles Blood Bowl 2020
- Gestion complète de rosters (joueurs, stats, compétences BB 2025, trésorerie, relances)
- Système d'inducements

**Gestion**
- Authentification JWT — le premier compte créé devient automatiquement administrateur
- Rate-limiting sur les routes d'authentification

## Mise en route

### Prérequis
- Docker + Docker Compose
- Pour HTTPS public : un domaine pointant vers le serveur, ports 80 et 443 ouverts

### Installation
```bash
git clone <votre-repo> bloodbowl-manager
cd bloodbowl-manager
cp .env.example .env
```

### Configurer `.env`

Générez un secret JWT robuste :
```bash
openssl rand -base64 48
```

Puis éditez `.env` :
```env
JWT_SECRET=<le secret généré ci-dessus>
SITE_ADDRESS=bloodbowl.mondomaine.fr   # ou "localhost" pour test local

# Optionnel — valeurs par défaut indiquées
HTTP_PORT=80
HTTPS_PORT=443
DB_DIR=/app/data
```

### Lancer
```bash
docker compose up -d --build
```

Caddy obtient automatiquement le certificat HTTPS si vous utilisez un vrai domaine.

### Accéder
- Avec un domaine : `https://bloodbowl.mondomaine.fr`
- En local : `https://localhost` (accepter le certificat auto-signé)
- HTTP uniquement : mettre `SITE_ADDRESS=:80`

> **Le premier compte créé devient automatiquement administrateur.** Inscrivez-vous immédiatement après le démarrage.

## Structure du projet
```
bloodbowl-manager/
├── docker-compose.yml
├── .env.example
├── caddy/
│   └── Caddyfile             # Reverse-proxy + HTTPS + en-têtes de sécurité
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js             # API Express
│   ├── db.js                 # Schéma SQLite + migrations
│   ├── auth.js               # JWT + bcrypt
│   ├── pairings.js           # Algorithmes d'appariement
│   ├── rosters.js            # Gestion des rosters
│   ├── inducements.js        # Système d'inducements
│   └── skills-bb2025.js      # Compétences Blood Bowl 2025
└── frontend/
    ├── index.html
    ├── app.js                # SPA + routeur
    ├── rosters.js            # Interface roster
    ├── pdf-export.js         # Export PDF
    └── styles.css            # Thème NETBLITZ
```

## Commandes utiles
```bash
# Logs en direct
docker compose logs -f

# Reconstruire le backend après modification du code
docker compose up -d --build backend

# Redémarrer Caddy après modification du Caddyfile
docker compose restart caddy

# Sauvegarder la base
docker compose exec backend sh -c "cp /app/data/bloodbowl.db /app/data/backup-$(date +%F).db"

# Tout arrêter
docker compose down

# Tout supprimer (⚠ efface les données)
docker compose down -v
```

## Sauvegardes

Les données SQLite sont dans le volume Docker `bb_data` :
```bash
docker run --rm \
  -v bloodbowl-manager_bb_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/bb-backup-$(date +%F).tar.gz -C /data .
```

## Personnalisation
- **Thème** : variables CSS dans `frontend/styles.css` (section `:root`)
- **Races** : liste `BB_RACES` dans `backend/server.js`
- **Système de points** : configurable par tournoi dans l'interface

## Sécurité
- Utiliser un `JWT_SECRET` fort et unique
- Caddy gère TLS automatiquement (Let's Encrypt) et applique les en-têtes de sécurité (HSTS, X-Frame-Options, etc.)
- Rate-limiting actif sur les routes `/auth/*` (20 requêtes / 15 min)
- Le backend n'est jamais exposé directement, uniquement via Caddy

## Idées d'évolution
- Bracket visuel pour l'élimination directe
- Stats joueurs individuels (SPP, MVP, blessures persistantes)
- Mode ligue persistante avec saisons
- Webhooks Discord pour annoncer les résultats
- Intégration NAF Rank

## Licence
Code fourni tel quel pour usage personnel — libre à vous de choisir une licence.
