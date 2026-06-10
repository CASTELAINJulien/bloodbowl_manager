import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = process.env.DB_DIR || './data';
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(path.join(DB_DIR, 'bloodbowl.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Schéma ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    format TEXT NOT NULL DEFAULT 'swiss', -- swiss, round_robin, single_elim, league
    status TEXT NOT NULL DEFAULT 'draft', -- draft, registration, in_progress, completed
    start_date TEXT,
    end_date TEXT,
    max_teams INTEGER,
    rounds_total INTEGER DEFAULT 0,
    current_round INTEGER DEFAULT 0,
    scoring_system TEXT DEFAULT 'standard', -- standard (3/1/0) ou custom
    win_points INTEGER DEFAULT 3,
    draw_points INTEGER DEFAULT 1,
    loss_points INTEGER DEFAULT 0,
    organizer_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    coach_name TEXT NOT NULL,
    race TEXT NOT NULL,
    team_value INTEGER DEFAULT 0,
    user_id INTEGER,
    logo_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    round INTEGER NOT NULL,
    team1_id INTEGER,
    team2_id INTEGER,
    score1 INTEGER,
    score2 INTEGER,
    td1 INTEGER DEFAULT 0,    -- touchdowns
    td2 INTEGER DEFAULT 0,
    cas1 INTEGER DEFAULT 0,   -- casualties
    cas2 INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed
    played_at TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team1_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (team2_id) REFERENCES teams(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_teams_tournament ON teams(tournament_id);
  CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
  CREATE INDEX IF NOT EXISTS idx_matches_round ON matches(tournament_id, round);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS roster_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    coach_name TEXT,
    race_key TEXT NOT NULL,
    treasury INTEGER DEFAULT 1000,  -- en k, 1000k = 1M
    rerolls INTEGER DEFAULT 0,
    apothecary INTEGER DEFAULT 0,
    assistant_coaches INTEGER DEFAULT 0,
    cheerleaders INTEGER DEFAULT 0,
    dedicated_fans INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
 
  CREATE TABLE IF NOT EXISTS roster_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roster_team_id INTEGER NOT NULL,
    number INTEGER NOT NULL,
    position_title TEXT NOT NULL,  -- ex: Lineman, Blitzer
    player_name TEXT,
    ma INTEGER, st INTEGER, ag INTEGER, pa INTEGER, av INTEGER,
    skills TEXT,  -- JSON array
    extra_skills TEXT,  -- JSON array (skills achetés en dev)
    cost INTEGER DEFAULT 0,
    spp INTEGER DEFAULT 0,
    -- statut joueur
    mng INTEGER DEFAULT 0,    -- miss next game
    ni INTEGER DEFAULT 0,     -- niggling injuries
    dead INTEGER DEFAULT 0,
    FOREIGN KEY (roster_team_id) REFERENCES roster_teams(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS roster_inducements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roster_team_id INTEGER NOT NULL,
    inducement_key TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    UNIQUE(roster_team_id, inducement_key),
    FOREIGN KEY (roster_team_id) REFERENCES roster_teams(id) ON DELETE CASCADE
  );
 
  CREATE INDEX IF NOT EXISTS idx_ri_team ON roster_inducements(roster_team_id);
  CREATE INDEX IF NOT EXISTS idx_rp_team ON roster_players(roster_team_id);
  CREATE INDEX IF NOT EXISTS idx_rt_user ON roster_teams(user_id);
`);

const playerColumns = db.prepare("PRAGMA table_info(roster_players)").all();
const hasStatBoosts = playerColumns.some(c => c.name === 'stat_ma_bonus');
 
if (!hasStatBoosts) {
  console.log('🔄 Migration : ajout des colonnes de progression statistique');
  db.exec(`
    ALTER TABLE roster_players ADD COLUMN stat_ma_bonus INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE roster_players ADD COLUMN stat_st_bonus INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE roster_players ADD COLUMN stat_ag_bonus INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE roster_players ADD COLUMN stat_pa_bonus INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE roster_players ADD COLUMN stat_av_bonus INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE roster_players ADD COLUMN extras_cost INTEGER NOT NULL DEFAULT 0;
  `);
}

export default db;
