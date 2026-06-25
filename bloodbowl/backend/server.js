import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import db from './db.js';
import { hashPassword, verifyPassword, generateToken, authMiddleware, adminOnly } from './auth.js';
import { computeStandings, generateNextRound } from './pairings.js';
import { ROSTERS, SIDELINE_STAFF } from './rosters.js';
import { INDUCEMENTS, getAvailableInducements } from './inducements.js';
import { STAR_PLAYERS, getAvailableStars, starMembers } from './stars.js';
import {
  getAvailableSkillsForPosition,
  STAT_INCREASES,
  SKILL_COST_PRIMARY,
  SKILL_COST_SECONDARY,
} from './skills-bb2025.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limiter sur l'auth
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// Liste des races BB officielles (Blood Bowl 2025)
const BB_RACES = [
  'Amazons', 'Black Orcs', 'Chaos Chosen', 'Chaos Dwarfs', 'Chaos Renegades',
  'Dark Elves', 'Dwarfs', 'Elven Union', 'Goblins', 'Halflings',
  'High Elves', 'Humans', 'Imperial Nobility', 'Khorne', 'Lizardmen',
  'Necromantic Horror', 'Norse', 'Nurgle', 'Ogres', 'Old World Alliance',
  'Orcs', 'Shambling Undead', 'Skaven', 'Slann', 'Snotlings',
  'Tomb Kings', 'Underworld Denizens', 'Vampires', 'Wood Elves'
];

// === Route santé ===
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/races', (req, res) => res.json(BB_RACES));

// === Authentification ===
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Champs invalides (mot de passe min 6 caractères)' });
  }
  try {
    const hash = await hashPassword(password);
    // Premier utilisateur = admin
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const isAdmin = count === 0 ? 1 : 0;
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)'
    ).run(username, email, hash, isAdmin);
    const user = db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json({ token: generateToken(user), user });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Nom d\'utilisateur ou email déjà utilisé' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Champs requis' });
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
  if (!user) return res.status(401).json({ error: 'Identifiants invalides' });
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Identifiants invalides' });
  res.json({
    token: generateToken(user),
    user: { id: user.id, username: user.username, is_admin: !!user.is_admin },
  });
});

app.get('/api/auth/me', authMiddleware(), (req, res) => res.json({ user: req.user }));

// Demande de réinitialisation de mot de passe (traitée par un admin)
app.post('/api/auth/forgot-password', authLimiter, (req, res) => {
  const { identifier } = req.body || {};
  if (!identifier) return res.status(400).json({ error: 'Identifiant requis' });
  const user = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(identifier, identifier);
  if (user) {
    db.prepare('UPDATE users SET reset_requested_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  }
  // Réponse générique : ne révèle pas si le compte existe
  res.json({ ok: true });
});

// Mot de passe temporaire lisible (sans caractères ambigus)
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

// === Profil utilisateur ===
app.get('/api/profile', authMiddleware(), (req, res) => {
  const u = db.prepare('SELECT id, username, email, is_admin, created_at, naf_number FROM users WHERE id = ?').get(req.user.id);
  if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
  u.teams_count = db.prepare('SELECT COUNT(*) AS c FROM roster_teams WHERE user_id = ?').get(req.user.id).c;

  // Bilan victoires / nuls / défaites par race, sur les matchs de tournois terminés
  const userTeams = db.prepare('SELECT id, race FROM teams WHERE user_id = ?').all(req.user.id);
  const byRace = {};
  for (const team of userTeams) {
    const matches = db.prepare(
      "SELECT team1_id, team2_id, td1, td2 FROM matches WHERE status = 'completed' AND (team1_id = ? OR team2_id = ?)"
    ).all(team.id, team.id);
    for (const mt of matches) {
      if (mt.team1_id == null || mt.team2_id == null) continue; // bye
      const isTeam1 = mt.team1_id === team.id;
      const myTd = isTeam1 ? mt.td1 : mt.td2;
      const oppTd = isTeam1 ? mt.td2 : mt.td1;
      const r = byRace[team.race] || (byRace[team.race] = { race: team.race, wins: 0, draws: 0, losses: 0 });
      if (myTd > oppTd) r.wins++;
      else if (myTd < oppTd) r.losses++;
      else r.draws++;
    }
  }
  u.race_records = Object.values(byRace)
    .map(r => ({ ...r, played: r.wins + r.draws + r.losses }))
    .sort((a, b) => b.played - a.played || a.race.localeCompare(b.race));

  res.json(u);
});

// Mise à jour du profil (numéro NAF)
app.put('/api/profile', authMiddleware(), (req, res) => {
  if (!('naf_number' in (req.body || {}))) return res.status(400).json({ error: 'Rien à modifier' });
  const naf = (req.body.naf_number == null || String(req.body.naf_number).trim() === '')
    ? null : String(req.body.naf_number).trim();
  db.prepare('UPDATE users SET naf_number = ? WHERE id = ?').run(naf, req.user.id);
  res.json({ ok: true, naf_number: naf });
});

app.put('/api/profile/password', authMiddleware(), async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
  }
  if (String(new_password).length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 6 caractères' });
  }
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const ok = await verifyPassword(current_password, u.password_hash);
  if (!ok) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
  const hash = await hashPassword(new_password);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});

// === Administration (réservé aux administrateurs) ===
app.get('/api/admin/users', authMiddleware(), adminOnly, (req, res) => {
  const users = db.prepare(
    'SELECT id, username, email, is_admin, created_at, reset_requested_at FROM users ORDER BY created_at'
  ).all();
  res.json(users);
});

// Réinitialisation du mot de passe d'un utilisateur par un admin -> mot de passe temporaire
app.post('/api/admin/users/:id/reset-password', authMiddleware(), adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const temp = generateTempPassword();
  const hash = await hashPassword(temp);
  db.prepare('UPDATE users SET password_hash = ?, reset_requested_at = NULL WHERE id = ?').run(hash, id);
  res.json({ temp_password: temp });
});

app.put('/api/admin/users/:id', authMiddleware(), adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (!('is_admin' in (req.body || {}))) return res.status(400).json({ error: 'is_admin requis' });
  const newVal = req.body.is_admin ? 1 : 0;
  // On ne peut pas retirer ses propres droits (évite de se verrouiller dehors)
  if (id === req.user.id && newVal === 0) {
    return res.status(400).json({ error: 'Vous ne pouvez pas retirer vos propres droits administrateur' });
  }
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(newVal, id);
  res.json({ id, is_admin: newVal });
});

app.delete('/api/admin/users/:id', authMiddleware(), adminOnly, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

// === Tournois ===
app.get('/api/tournaments', (req, res) => {
  const list = db.prepare(`
    SELECT t.*, u.username AS organizer_name,
      (SELECT COUNT(*) FROM teams WHERE tournament_id = t.id) AS teams_count
    FROM tournaments t
    LEFT JOIN users u ON u.id = t.organizer_id
    ORDER BY t.created_at DESC
  `).all();
  res.json(list);
});

app.get('/api/tournaments/:id', (req, res) => {
  const t = db.prepare(`
    SELECT t.*, u.username AS organizer_name
    FROM tournaments t
    LEFT JOIN users u ON u.id = t.organizer_id
    WHERE t.id = ?
  `).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tournoi introuvable' });
  res.json(t);
});

app.post('/api/tournaments', authMiddleware(), (req, res) => {
  const {
    name, description, format = 'swiss', max_teams,
    start_date, end_date, scoring_system = 'standard',
    win_points = 3, draw_points = 1, loss_points = 0,
    rounds_total = 0,
  } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  if (!['swiss', 'round_robin', 'single_elim', 'league'].includes(format)) {
    return res.status(400).json({ error: 'Format invalide' });
  }
  const result = db.prepare(`
    INSERT INTO tournaments
      (name, description, format, max_teams, start_date, end_date,
       scoring_system, win_points, draw_points, loss_points,
       rounds_total, organizer_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'registration')
  `).run(name, description, format, max_teams || null, start_date || null, end_date || null,
    scoring_system, win_points, draw_points, loss_points, rounds_total, req.user.id);
  res.json(db.prepare('SELECT * FROM tournaments WHERE id = ?').get(result.lastInsertRowid));
});

// Helper : vérifie que l'utilisateur peut gérer ce tournoi
function canManage(req, tournamentId) {
  if (!req.user) return false;
  if (req.user.is_admin) return true;
  const t = db.prepare('SELECT organizer_id FROM tournaments WHERE id = ?').get(tournamentId);
  return t && t.organizer_id === req.user.id;
}

// Vrai si l'utilisateur connecté est l'un des deux coachs du match
function isMatchCoach(req, match) {
  if (!req.user || !match) return false;
  const t1 = match.team1_id ? db.prepare('SELECT user_id FROM teams WHERE id = ?').get(match.team1_id) : null;
  const t2 = match.team2_id ? db.prepare('SELECT user_id FROM teams WHERE id = ?').get(match.team2_id) : null;
  return (t1 && t1.user_id === req.user.id) || (t2 && t2.user_id === req.user.id);
}

// Météo Blood Bowl selon la somme de 2d6
function weatherFor(sum) {
  if (sum === 2) return 'Canicule';
  if (sum === 3) return 'Très ensoleillé';
  if (sum === 11) return 'Averse';
  if (sum === 12) return 'Blizzard';
  return 'Météo clémente'; // 4 à 10
}

function listMatchEvents(matchId) {
  return db.prepare('SELECT * FROM match_events WHERE match_id = ? ORDER BY id').all(matchId);
}

// Tour global (1..16) déduit de l'état du match ; 0 avant le coup d'envoi
function currentGlobalTurn(match) {
  const t = match.active_team === 1 ? (match.turn1 || 0) : (match.turn2 || 0);
  return (Math.max(1, match.half || 1) - 1) * 8 + t;
}

function logMatchEvent(matchId, type, teamSide, detail, turn = null) {
  db.prepare('INSERT INTO match_events (match_id, type, team_side, detail, turn) VALUES (?, ?, ?, ?, ?)')
    .run(matchId, type, teamSide ?? null, detail || null, turn ?? null);
}

// Nombre de fans dédiés d'une équipe inscrite (via son roster lié), défaut 1
function teamFans(teamId) {
  if (!teamId) return 1;
  const tm = db.prepare('SELECT roster_team_id FROM teams WHERE id = ?').get(teamId);
  if (tm && tm.roster_team_id) {
    const rt = db.prepare('SELECT dedicated_fans FROM roster_teams WHERE id = ?').get(tm.roster_team_id);
    if (rt && rt.dedicated_fans != null) return rt.dedicated_fans;
  }
  return 1;
}

// Valeur d'équipe (en or complet) calculée depuis le roster builder, avec la
// même formule que le frontend : joueurs (coût + progressions) + staff de banc
// + inducements achetés. Le builder raisonne en "k" (1000k = 1M) → ×1000 pour
// rester cohérent avec les TV saisies à la main dans les tournois.
function computeRosterTeamValue(rosterTeamId) {
  const team = db.prepare('SELECT * FROM roster_teams WHERE id = ?').get(rosterTeamId);
  if (!team) return 0;
  const roster = ROSTERS[team.race_key];

  const players = db.prepare(
    'SELECT cost, extras_cost FROM roster_players WHERE roster_team_id = ?'
  ).all(rosterTeamId);
  const playersCost = players.reduce((s, p) => s + (p.cost || 0) + (p.extras_cost || 0), 0);

  const rerollCost = roster ? roster.rerollCost : 0;
  const sidelineCost =
      (team.rerolls || 0) * rerollCost
    + (team.apothecary || 0) * 50
    + (team.assistant_coaches || 0) * 10
    + (team.cheerleaders || 0) * 10
    + Math.max(0, (team.dedicated_fans || 0) - 1) * 10;

  let inducementsCost = 0;
  if (roster) {
    const available = getAvailableInducements(roster);
    const rows = db.prepare(
      'SELECT inducement_key, quantity FROM roster_inducements WHERE roster_team_id = ?'
    ).all(rosterTeamId);
    const qtyByKey = {};
    for (const r of rows) qtyByKey[r.inducement_key] = r.quantity;
    for (const ind of available) inducementsCost += (qtyByKey[ind.key] || 0) * ind.effectiveCost;
  }

  return (playersCost + sidelineCost + inducementsCost) * 1000;
}

app.put('/api/tournaments/:id', authMiddleware(), (req, res) => {
  if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'Non autorisé' });
  const allowed = ['name', 'description', 'format', 'status', 'max_teams', 'start_date', 'end_date',
    'win_points', 'draw_points', 'loss_points', 'rounds_total'];
  const fields = []; const values = [];
  for (const k of allowed) {
    if (k in req.body) { fields.push(`${k} = ?`); values.push(req.body[k]); }
  }
  if (!fields.length) return res.status(400).json({ error: 'Aucun champ à modifier' });
  values.push(req.params.id);
  db.prepare(`UPDATE tournaments SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json(db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id));
});

app.delete('/api/tournaments/:id', authMiddleware(), (req, res) => {
  if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'Non autorisé' });
  db.prepare('DELETE FROM tournaments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// === Équipes ===
app.get('/api/tournaments/:id/teams', (req, res) => {
  const teams = db.prepare(`
    SELECT t.*, u.username AS user_name
    FROM teams t LEFT JOIN users u ON u.id = t.user_id
    WHERE t.tournament_id = ? ORDER BY t.name
  `).all(req.params.id);
  res.json(teams);
});

// Assigner une de SES équipes (roster builder) à un tournoi pas encore commencé
app.post('/api/tournaments/:id/assign-team', authMiddleware(), (req, res) => {
  const { roster_team_id } = req.body || {};
  if (!roster_team_id) return res.status(400).json({ error: 'roster_team_id requis' });

  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tournoi introuvable' });
  if (t.status === 'in_progress' || t.status === 'completed') {
    return res.status(400).json({ error: 'Le tournoi a déjà commencé' });
  }

  // L'équipe doit appartenir à l'utilisateur connecté
  const roster = db.prepare('SELECT * FROM roster_teams WHERE id = ? AND user_id = ?')
    .get(roster_team_id, req.user.id);
  if (!roster) return res.status(404).json({ error: 'Équipe introuvable' });

  // Numéro NAF (du compte) obligatoire pour s'inscrire à un tournoi
  const account = db.prepare('SELECT naf_number FROM users WHERE id = ?').get(req.user.id);
  if (!account || !account.naf_number || String(account.naf_number).trim() === '') {
    return res.status(400).json({ error: 'Numéro NAF requis : renseignez-le dans « Mon profil » avant de vous inscrire.' });
  }

  // Pas deux fois la même équipe dans le même tournoi
  const dup = db.prepare(
    'SELECT id FROM teams WHERE tournament_id = ? AND roster_team_id = ?'
  ).get(req.params.id, roster.id);
  if (dup) return res.status(400).json({ error: 'Cette équipe est déjà inscrite à ce tournoi' });

  // Une seule équipe par personne (sauf organisateur/admin qui peut en aligner plusieurs)
  if (!canManage(req, req.params.id)) {
    const mine = db.prepare(
      'SELECT id FROM teams WHERE tournament_id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);
    if (mine) return res.status(400).json({ error: 'Vous avez déjà une équipe dans ce tournoi (1 par personne)' });
  }

  if (t.max_teams) {
    const c = db.prepare('SELECT COUNT(*) AS c FROM teams WHERE tournament_id = ?').get(req.params.id).c;
    if (c >= t.max_teams) return res.status(400).json({ error: 'Tournoi complet' });
  }

  const raceName = ROSTERS[roster.race_key] ? ROSTERS[roster.race_key].name : roster.race_key;
  const coachName = roster.coach_name || req.user.username;
  const teamValue = computeRosterTeamValue(roster.id);

  const result = db.prepare(`
    INSERT INTO teams (tournament_id, name, coach_name, race, team_value, user_id, roster_team_id, logo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, roster.name, coachName, raceName, teamValue, req.user.id, roster.id, roster.logo || null);

  res.json(db.prepare('SELECT * FROM teams WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/teams/:id', authMiddleware(), (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Équipe introuvable' });
  const isOwner = team.user_id === req.user.id;
  if (!isOwner && !canManage(req, team.tournament_id)) return res.status(403).json({ error: 'Non autorisé' });
  const { name, coach_name, race, team_value } = req.body || {};
  db.prepare(`
    UPDATE teams SET
      name = COALESCE(?, name),
      coach_name = COALESCE(?, coach_name),
      race = COALESCE(?, race),
      team_value = COALESCE(?, team_value)
    WHERE id = ?
  `).run(name, coach_name, race, team_value, req.params.id);
  res.json(db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id));
});

app.delete('/api/teams/:id', authMiddleware(), (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Équipe introuvable' });
  if (!canManage(req, team.tournament_id) && team.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// === Matchs et appariements ===
app.get('/api/tournaments/:id/matches', (req, res) => {
  const matches = db.prepare(`
    SELECT m.*, t1.name AS team1_name, t1.race AS team1_race, t1.coach_name AS team1_coach,
           t2.name AS team2_name, t2.race AS team2_race, t2.coach_name AS team2_coach
    FROM matches m
    LEFT JOIN teams t1 ON t1.id = m.team1_id
    LEFT JOIN teams t2 ON t2.id = m.team2_id
    WHERE m.tournament_id = ?
    ORDER BY m.round, m.id
  `).all(req.params.id);
  res.json(matches);
});

app.post('/api/tournaments/:id/next-round', authMiddleware(), (req, res) => {
  if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'Non autorisé' });
  const tour = db.prepare('SELECT status FROM tournaments WHERE id = ?').get(req.params.id);
  if (tour && tour.status === 'completed') {
    return res.status(400).json({ error: 'Tournoi clôturé : impossible de générer un nouveau tour' });
  }
  try {
    const result = generateNextRound(req.params.id);
    // Si on génère le premier tour, on passe en in_progress
    db.prepare("UPDATE tournaments SET status = 'in_progress' WHERE id = ? AND status = 'registration'")
      .run(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Correspondance race (clé roster FR) -> nom NAF officiel (EN)
const NAF_RACE_BY_KEY = {
  alliance_vieux_monde: 'old world alliance',
  amazones: 'amazon',
  bas_fonds: 'underworld denizens',
  bretonniens: 'bretonnian',
  elfes_noirs: 'dark elf',
  elfes_sylvains: 'wood elf',
  elus_chaos: 'chaos chosen',
  gnomes: 'gnome',
  gobelins: 'goblin',
  halflings: 'halfling',
  hauts_elfes: 'high elf',
  hommes_lezards: 'lizardmen',
  horreurs_necromantiques: 'necromantic horror',
  humains: 'human',
  khorne: 'khorne',
  morts_ambulants: 'shambling undead',
  nains: 'dwarf',
  nains_chaos: 'chaos dwarf',
  noblesse_imperiale: 'imperial nobility',
  nordiques: 'norse',
  nurgle: 'nurgle',
  ogres: 'ogre',
  orques: 'orc',
  orques_noirs: 'black orc',
  renegats_chaos: 'chaos renegade',
  rois_tombes: 'tomb kings',
  skavens: 'skaven',
  snotlings: 'snotling',
  union_elfique: 'elven union',
  vampires: 'vampire',
};

// Export des résultats au format NAF (XML) — tournoi clôturé
app.get('/api/tournaments/:id/export-naf', authMiddleware(), (req, res) => {
  if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'Non autorisé' });
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tournoi introuvable' });

  const org = t.organizer_id ? db.prepare('SELECT username FROM users WHERE id = ?').get(t.organizer_id) : null;

  // Équipes avec le numéro NAF récupéré depuis le roster lié
  const teams = db.prepare(`
    SELECT te.*, u.naf_number AS naf, rt.race_key AS race_key
    FROM teams te
    LEFT JOIN roster_teams rt ON rt.id = te.roster_team_id
    LEFT JOIN users u ON u.id = te.user_id
    WHERE te.tournament_id = ?
    ORDER BY te.id
  `).all(req.params.id);
  const teamById = {};
  for (const tm of teams) teamById[tm.id] = tm;
  // Nom NAF (EN) si on connaît la clé de roster, sinon la race stockée
  const nafRace = (tm) => (tm && NAF_RACE_BY_KEY[tm.race_key]) || (tm ? tm.race : '');

  const matches = db.prepare(`
    SELECT * FROM matches
    WHERE tournament_id = ? AND status = 'completed' AND team1_id IS NOT NULL AND team2_id IS NOT NULL
    ORDER BY round, id
  `).all(req.params.id);

  const esc = (s) => String(s ?? '').replace(/[<>&'"]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  const naf = (tm) => (tm && tm.naf != null && String(tm.naf).trim() !== '') ? esc(tm.naf) : '0';
  const record = (tm, td, cas) =>
    `<playerRecord><name>${esc(tm ? tm.coach_name : '')}</name><number>${naf(tm)}</number>` +
    `<teamRating>132</teamRating><touchDowns>${td || 0}</touchDowns><badlyHurt>${cas || 0}</badlyHurt></playerRecord>`;

  let xml = '<?xml version="1.0" encoding="utf-8"?>';
  xml += '<nafReport xmlns:blo="http://www.bloodbowl.net">';
  xml += `<organiser>${esc(org ? org.username : '')}</organiser>`;
  xml += '<coaches>';
  for (const tm of teams) {
    xml += `<coach><name>${esc(tm.coach_name)}</name><number>${naf(tm)}</number><team>${esc(nafRace(tm))}</team></coach>`;
  }
  xml += '</coaches>';
  for (const m of matches) {
    const ts = String(m.played_at || '').replace('T', ' ').slice(0, 16);
    xml += '<game>';
    xml += `<timeStamp>${esc(ts)}</timeStamp>`;
    xml += record(teamById[m.team1_id], m.td1, m.cas1);
    xml += record(teamById[m.team2_id], m.td2, m.cas2);
    xml += '</game>';
  }
  xml += '</nafReport>';

  const filename = `NAF-${String(t.name || 'tournoi').replace(/[^a-zA-Z0-9]+/g, '_')}.xml`;
  res.json({ xml, filename });
});

app.put('/api/matches/:id', authMiddleware(), (req, res) => {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match introuvable' });
  if (!canManage(req, match.tournament_id) && !isMatchCoach(req, match)) {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  const {
    td1, td2, cas1 = 0, cas2 = 0,
    passes1 = 0, passes2 = 0, aggressions1 = 0, aggressions2 = 0,
    status = 'completed', notes,
  } = req.body || {};
  if (typeof td1 !== 'number' || typeof td2 !== 'number') {
    return res.status(400).json({ error: 'Touchdowns requis' });
  }
  db.prepare(`
    UPDATE matches SET td1 = ?, td2 = ?, cas1 = ?, cas2 = ?,
      passes1 = ?, passes2 = ?, aggressions1 = ?, aggressions2 = ?,
      status = ?, notes = ?, played_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(td1, td2, cas1, cas2, passes1, passes2, aggressions1, aggressions2,
         status, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id));
});

// Détail d'un match enrichi (équipes + rosters) pour le récap et le suivi live
app.get('/api/matches/:id', (req, res) => {
  const m = db.prepare(`
    SELECT m.*,
      tt.name AS tournament_name, tt.organizer_id AS organizer_id, tt.status AS tournament_status,
      t1.name AS team1_name, t1.race AS team1_race, t1.coach_name AS team1_coach,
      t1.team_value AS team1_tv, t1.roster_team_id AS team1_roster_id, t1.user_id AS team1_user, t1.logo_url AS team1_logo,
      t2.name AS team2_name, t2.race AS team2_race, t2.coach_name AS team2_coach,
      t2.team_value AS team2_tv, t2.roster_team_id AS team2_roster_id, t2.user_id AS team2_user, t2.logo_url AS team2_logo
    FROM matches m
    LEFT JOIN tournaments tt ON tt.id = m.tournament_id
    LEFT JOIN teams t1 ON t1.id = m.team1_id
    LEFT JOIN teams t2 ON t2.id = m.team2_id
    WHERE m.id = ?
  `).get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Match introuvable' });

  const loadPlayers = (rosterId) => {
    if (!rosterId) return [];
    const players = db.prepare(`
      SELECT number, position_title, player_name, ma, st, ag, pa, av, skills, extra_skills, cost,
             stat_ma_bonus, stat_st_bonus, stat_ag_bonus, stat_pa_bonus, stat_av_bonus
      FROM roster_players WHERE roster_team_id = ? AND dead = 0 ORDER BY number
    `).all(rosterId);
    for (const p of players) {
      try { p.skills = p.skills ? JSON.parse(p.skills) : []; } catch { p.skills = []; }
      try { p.extra_skills = p.extra_skills ? JSON.parse(p.extra_skills) : []; } catch { p.extra_skills = []; }
    }
    return players;
  };
  m.team1_players = loadPlayers(m.team1_roster_id);
  m.team2_players = loadPlayers(m.team2_roster_id);
  m.events = listMatchEvents(m.id);
  res.json(m);
});

// Jet de météo (2d6), idempotent : ne lance qu'une fois par match
app.post('/api/matches/:id/roll-weather', authMiddleware(), (req, res) => {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match introuvable' });
  if (!canManage(req, match.tournament_id) && !isMatchCoach(req, match)) {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  // Météo (2d6) — lancée une seule fois
  if (!match.weather) {
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    const weather = weatherFor(d1 + d2);
    db.prepare('UPDATE matches SET weather = ?, weather_d1 = ?, weather_d2 = ? WHERE id = ?')
      .run(weather, d1, d2, req.params.id);
    logMatchEvent(req.params.id, 'weather', null, `Météo : ${weather} (dés ${d1} + ${d2} = ${d1 + d2})`, 0);
  }

  // Popularité de chaque équipe (dedicated fans + 1 D3) — lancée une seule fois
  if (match.pop1 == null) {
    for (const side of [1, 2]) {
      const fans = teamFans(side === 1 ? match.team1_id : match.team2_id);
      const d3 = 1 + Math.floor(Math.random() * 3);
      const pop = fans + d3;
      db.prepare(`UPDATE matches SET pop${side} = ?, pop${side}_d3 = ? WHERE id = ?`).run(pop, d3, req.params.id);
      logMatchEvent(req.params.id, 'popularity', side,
        `Popularité : ${fans} fan${fans > 1 ? 's' : ''} + ${d3} = ${pop}`, 0);
    }
  }

  const m2 = db.prepare('SELECT weather, weather_d1, weather_d2, pop1, pop1_d3, pop2, pop2_d3 FROM matches WHERE id = ?')
    .get(req.params.id);
  res.json(m2);
});

// Mise à jour du suivi en direct (compteurs + compte-tours)
app.patch('/api/matches/:id/live', authMiddleware(), (req, res) => {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match introuvable' });
  if (!canManage(req, match.tournament_id) && !isMatchCoach(req, match)) {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  const allowed = ['td1','td2','cas1','cas2','passes1','passes2','aggressions1','aggressions2',
                   'half','turn1','turn2','active_team','turn_active'];
  const fields = []; const values = [];
  for (const k of allowed) {
    if (k in req.body) {
      const n = Number(req.body[k]);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: `Valeur invalide pour ${k}` });
      fields.push(`${k} = ?`); values.push(Math.floor(n));
    }
  }
  if (!fields.length) return res.status(400).json({ error: 'Rien à mettre à jour' });
  // Dès qu'on touche au live, le match passe en cours (s'il était en attente)
  if (match.status === 'pending') fields.push("status = 'in_progress'");
  values.push(req.params.id);
  db.prepare(`UPDATE matches SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);

  // Journal d'évènements optionnel envoyé par le client (tour calculé côté serveur)
  if (Array.isArray(req.body.log)) {
    const turn = currentGlobalTurn(updated);
    for (const ev of req.body.log) {
      if (ev && ev.type) logMatchEvent(req.params.id, String(ev.type), ev.team_side ?? null, ev.detail || null, turn);
    }
  }

  updated.events = listMatchEvents(req.params.id);
  res.json(updated);
});

// === Classement ===
app.get('/api/tournaments/:id/standings', (req, res) => {
  res.json(computeStandings(req.params.id));
});

// === Statistiques du tournoi ===
app.get('/api/tournaments/:id/stats', (req, res) => {
  const id = req.params.id;
  const races = db.prepare(
    'SELECT race, COUNT(*) AS count FROM teams WHERE tournament_id = ? GROUP BY race ORDER BY count DESC, race'
  ).all(id);
  const tot = db.prepare(`
    SELECT
      COALESCE(SUM(td1 + td2), 0) AS td,
      COALESCE(SUM(cas1 + cas2), 0) AS cas,
      COALESCE(SUM(passes1 + passes2), 0) AS passes,
      COALESCE(SUM(aggressions1 + aggressions2), 0) AS aggressions,
      COUNT(*) AS played
    FROM matches WHERE tournament_id = ? AND status = 'completed' AND team2_id IS NOT NULL
  `).get(id);
  res.json({
    races,
    totals: { td: tot.td, cas: tot.cas, passes: tot.passes, aggressions: tot.aggressions },
    matches_played: tot.played,
  });
});

// === Rosters disponibles (lecture seule) ===
app.get('/api/rosters', (req, res) => {
  // Liste résumée pour le sélecteur
  const list = Object.entries(ROSTERS).map(([key, r]) => ({
    key, name: r.name, tier: r.tier, rerollCost: r.rerollCost,
  }));
  res.json(list);
});

// Star players disponibles pour un roster (selon sa/ses league(s))
app.get('/api/rosters/:key/stars', (req, res) => {
  const r = ROSTERS[req.params.key];
  if (!r) return res.status(404).json({ error: 'Roster inconnu' });
  res.json(getAvailableStars(r));
});

app.get('/api/rosters/:key/inducements', (req, res) => {
  const r = ROSTERS[req.params.key];
  if (!r) return res.status(404).json({ error: 'Roster inconnu' });
  res.json(getAvailableInducements(r));
});

// === Liste tous les inducements existants (référentiel) ===
app.get('/api/inducements', (req, res) => {
  res.json(INDUCEMENTS);
});
 
app.get('/api/rosters/:key', (req, res) => {
  const r = ROSTERS[req.params.key];
  if (!r) return res.status(404).json({ error: 'Roster inconnu' });
  res.json({ key: req.params.key, ...r, sidelineStaff: SIDELINE_STAFF });
});
 
// === Team Builder : équipes sauvegardées ===
app.get('/api/myteams', authMiddleware(), (req, res) => {
  const teams = db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM roster_players WHERE roster_team_id = t.id) AS players_count,
      EXISTS(SELECT 1 FROM teams WHERE roster_team_id = t.id) AS frozen
    FROM roster_teams t WHERE user_id = ?
    ORDER BY t.updated_at DESC
  `).all(req.user.id);
  res.json(teams);
});
 
app.get('/api/myteams/:id', authMiddleware(), (req, res) => {
  const team = db.prepare('SELECT * FROM roster_teams WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!team) return res.status(404).json({ error: 'Équipe introuvable' });
 
  const players = db.prepare(
    'SELECT * FROM roster_players WHERE roster_team_id = ? ORDER BY number'
  ).all(team.id);
  for (const p of players) {
    try { p.skills = p.skills ? JSON.parse(p.skills) : []; } catch { p.skills = []; }
    try { p.extra_skills = p.extra_skills ? JSON.parse(p.extra_skills) : []; } catch { p.extra_skills = []; }
  }
 
  // Charger les inducements achetés
  const inducementRows = db.prepare(
    'SELECT inducement_key, quantity FROM roster_inducements WHERE roster_team_id = ?'
  ).all(team.id);
  const inducements = {};
  for (const row of inducementRows) inducements[row.inducement_key] = row.quantity;

  const registrations = rosterTeamRegistrations(team.id);
  res.json({ ...team, players, inducements, registrations, frozen: registrations.length > 0 });
});
 
app.post('/api/myteams', authMiddleware(), (req, res) => {
  const { name, coach_name, race_key, treasury = 1000, naf_number, logo } = req.body || {};
  if (!name || !race_key) return res.status(400).json({ error: 'name et race_key requis' });
  if (!ROSTERS[race_key]) return res.status(400).json({ error: 'Roster invalide' });
  const result = db.prepare(`
    INSERT INTO roster_teams (user_id, name, coach_name, race_key, treasury, dedicated_fans, naf_number, logo)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(req.user.id, name, coach_name || null, race_key, treasury, naf_number || null, logo || null);
  res.json({ id: result.lastInsertRowid });
});

// === Gel : une équipe (roster) inscrite à un tournoi ne peut plus être modifiée ===
function rosterTeamRegistrations(rosterTeamId) {
  return db.prepare(`
    SELECT te.id AS team_id, te.tournament_id, t.name AS tournament_name, t.status AS tournament_status
    FROM teams te JOIN tournaments t ON t.id = te.tournament_id
    WHERE te.roster_team_id = ?
    ORDER BY t.created_at
  `).all(rosterTeamId);
}
function isRosterTeamFrozen(rosterTeamId) {
  return !!db.prepare('SELECT 1 FROM teams WHERE roster_team_id = ? LIMIT 1').get(rosterTeamId);
}
function rejectIfFrozen(rosterTeamId, res) {
  if (isRosterTeamFrozen(rosterTeamId)) {
    res.status(409).json({ error: 'Équipe verrouillée : inscrite à un tournoi. Désinscrivez-la pour la modifier.' });
    return true;
  }
  return false;
}

app.put('/api/myteams/:id', authMiddleware(), (req, res) => {
  const team = db.prepare('SELECT * FROM roster_teams WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!team) return res.status(404).json({ error: 'Équipe introuvable' });
  if (rejectIfFrozen(team.id, res)) return;
  const allowed = ['name','coach_name','treasury','rerolls','apothecary',
                   'assistant_coaches','cheerleaders','dedicated_fans','notes','naf_number','logo'];
  const fields = []; const values = [];
  for (const k of allowed) {
    if (k in req.body) { fields.push(`${k} = ?`); values.push(req.body[k]); }
  }
  if (!fields.length) return res.status(400).json({ error: 'Rien à modifier' });
  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(req.params.id);
  db.prepare(`UPDATE roster_teams SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  // Propage le logo aux équipes déjà inscrites en tournoi issues de ce roster
  if ('logo' in req.body) {
    db.prepare('UPDATE teams SET logo_url = ? WHERE roster_team_id = ?').run(req.body.logo || null, req.params.id);
  }
  res.json({ ok: true });
});
 
app.delete('/api/myteams/:id', authMiddleware(), (req, res) => {
  const team = db.prepare('SELECT id FROM roster_teams WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!team) return res.status(404).json({ error: 'Équipe introuvable' });
  if (rejectIfFrozen(team.id, res)) return;
  db.prepare('DELETE FROM roster_teams WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
 
// === Joueurs d'une équipe ===
app.post('/api/myteams/:id/players', authMiddleware(), (req, res) => {
  const team = db.prepare('SELECT * FROM roster_teams WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!team) return res.status(404).json({ error: 'Équipe introuvable' });
  if (rejectIfFrozen(team.id, res)) return;

  const { number, position_title, player_name } = req.body || {};
  if (!number || !position_title) return res.status(400).json({ error: 'Champs manquants' });
 
  const roster = ROSTERS[team.race_key];
  const pos = roster.positions.find(p => p.title === position_title);
  if (!pos) return res.status(400).json({ error: 'Position invalide' });
 
  // Vérifier la limite max de cette position
  const currentCount = db.prepare(
    "SELECT COUNT(*) as c FROM roster_players WHERE roster_team_id = ? AND position_title = ? AND dead = 0"
  ).get(team.id, position_title).c;
  if (currentCount >= pos.max) {
    return res.status(400).json({ error: `Maximum ${pos.max} ${position_title} dans cette équipe` });
  }

  // Vérifier la limite globale de Gros Bras (Élus, Bas-fonds, AVM, Renégats)
  if (pos.inBigGuyGroup && roster.bigGuyGroupLimit) {
    const groupTitles = roster.positions
      .filter(p => p.inBigGuyGroup)
      .map(p => p.title);
    const placeholders = groupTitles.map(() => '?').join(',');
    const groupCount = db.prepare(
      `SELECT COUNT(*) as c FROM roster_players
       WHERE roster_team_id = ? AND dead = 0
       AND position_title IN (${placeholders})`
    ).get(team.id, ...groupTitles).c;
    if (groupCount >= roster.bigGuyGroupLimit) {
      return res.status(400).json({
        error: `Maximum ${roster.bigGuyGroupLimit} Gros Bras au total dans cette équipe (toutes catégories confondues)`
      });
    }
  }
 
  // Vérifier le numéro non utilisé
  const numTaken = db.prepare(
    "SELECT id FROM roster_players WHERE roster_team_id = ? AND number = ?"
  ).get(team.id, number);
  if (numTaken) return res.status(400).json({ error: `Numéro ${number} déjà utilisé` });
 
  const result = db.prepare(`
    INSERT INTO roster_players
      (roster_team_id, number, position_title, player_name, ma, st, ag, pa, av, skills, cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(team.id, number, position_title, player_name || null,
    pos.ma, pos.st, pos.ag, pos.pa, pos.av,
    JSON.stringify(pos.skills), pos.cost);
 
  db.prepare('UPDATE roster_teams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(team.id);
  res.json({ id: result.lastInsertRowid });
});

// Engager un star player (selon la disponibilité par league)
app.post('/api/myteams/:id/stars', authMiddleware(), (req, res) => {
  const team = db.prepare('SELECT * FROM roster_teams WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!team) return res.status(404).json({ error: 'Équipe introuvable' });
  if (rejectIfFrozen(team.id, res)) return;

  const { star_key } = req.body || {};
  const star = STAR_PLAYERS.find(s => s.key === star_key);
  if (!star) return res.status(400).json({ error: 'Star player invalide' });

  const roster = ROSTERS[team.race_key];
  if (!roster) return res.status(400).json({ error: 'Roster invalide' });
  if (!getAvailableStars(roster).some(s => s.key === star_key)) {
    return res.status(400).json({ error: "Ce star player n'est pas disponible pour la league de cette équipe" });
  }

  const members = starMembers(star);

  // Aucun des membres ne doit déjà être présent
  for (const mem of members) {
    const already = db.prepare(
      "SELECT id FROM roster_players WHERE roster_team_id = ? AND position_title = ? AND dead = 0"
    ).get(team.id, mem.name);
    if (already) return res.status(400).json({ error: `${mem.name} est déjà dans l'équipe` });
  }

  // Place pour tous les membres (16 joueurs max)
  const used = new Set(db.prepare('SELECT number FROM roster_players WHERE roster_team_id = ?').all(team.id).map(r => r.number));
  if (used.size + members.length > 16) {
    return res.status(400).json({ error: 'Pas assez de place dans l\'effectif (16 joueurs max)' });
  }

  // Répartition du coût combiné entre les membres (le 1er prend l'arrondi)
  const n = members.length;
  const base = Math.floor((star.cost || 0) / n);
  const costs = members.map((_, i) => i === 0 ? (star.cost || 0) - base * (n - 1) : base);

  // Identifiant de duo : présent seulement si plusieurs membres (lie les renvois)
  const group = members.length > 1 ? star.key : null;
  const insert = db.prepare(`
    INSERT INTO roster_players
      (roster_team_id, number, position_title, ma, st, ag, pa, av, skills, cost, is_star, special_rules, star_group)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  members.forEach((mem, i) => {
    let num = 1; while (used.has(num) && num <= 16) num++;
    used.add(num);
    insert.run(team.id, num, mem.name, mem.ma, mem.st, mem.ag, mem.pa, mem.av,
      JSON.stringify(mem.skills || []), costs[i], (mem.specialRules || []).join(' | '), group);
  });

  db.prepare('UPDATE roster_teams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(team.id);
  res.json({ ok: true });
});

app.put('/api/myplayers/:id', authMiddleware(), (req, res) => {
  const player = db.prepare(`
    SELECT p.*, t.user_id FROM roster_players p
    JOIN roster_teams t ON t.id = p.roster_team_id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!player || player.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Joueur introuvable' });
  }
  if (rejectIfFrozen(player.roster_team_id, res)) return;
  const allowed = ['player_name','number','spp','mng','ni','dead','extra_skills'];
  const fields = []; const values = [];
  for (const k of allowed) {
    if (k in req.body) {
      fields.push(`${k} = ?`);
      values.push(k === 'extra_skills' ? JSON.stringify(req.body[k]) : req.body[k]);
    }
  }
  if (!fields.length) return res.status(400).json({ error: 'Rien à modifier' });
  values.push(req.params.id);
  db.prepare(`UPDATE roster_players SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  db.prepare('UPDATE roster_teams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(player.roster_team_id);
  res.json({ ok: true });
});
 
app.delete('/api/myplayers/:id', authMiddleware(), (req, res) => {
  const player = db.prepare(`
    SELECT p.*, t.user_id FROM roster_players p
    JOIN roster_teams t ON t.id = p.roster_team_id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!player || player.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Joueur introuvable' });
  }
  if (rejectIfFrozen(player.roster_team_id, res)) return;
  if (player.star_group) {
    // Membre d'un duo : on renvoie tout le groupe
    db.prepare('DELETE FROM roster_players WHERE roster_team_id = ? AND star_group = ?')
      .run(player.roster_team_id, player.star_group);
  } else {
    db.prepare('DELETE FROM roster_players WHERE id = ?').run(req.params.id);
  }
  db.prepare('UPDATE roster_teams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(player.roster_team_id);
  res.json({ ok: true });
});

// === Modifier les inducements d'une équipe ===
app.put('/api/myteams/:id/inducements/:key', authMiddleware(), (req, res) => {
  const team = db.prepare('SELECT * FROM roster_teams WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!team) return res.status(404).json({ error: 'Équipe introuvable' });
  if (rejectIfFrozen(team.id, res)) return;

  const roster = ROSTERS[team.race_key];
  if (!roster) return res.status(400).json({ error: 'Roster invalide' });
 
  const available = getAvailableInducements(roster);
  const ind = available.find(i => i.key === req.params.key);
  if (!ind) return res.status(400).json({ error: 'Inducement non disponible pour cette équipe' });
 
  const quantity = parseInt(req.body.quantity);
  if (isNaN(quantity) || quantity < 0) {
    return res.status(400).json({ error: 'Quantité invalide' });
  }
  if (quantity > ind.effectiveMax) {
    return res.status(400).json({ error: `Maximum ${ind.effectiveMax} ${ind.label}` });
  }
 
  if (quantity === 0) {
    db.prepare('DELETE FROM roster_inducements WHERE roster_team_id = ? AND inducement_key = ?')
      .run(team.id, req.params.key);
  } else {
    db.prepare(`
      INSERT INTO roster_inducements (roster_team_id, inducement_key, quantity)
      VALUES (?, ?, ?)
      ON CONFLICT(roster_team_id, inducement_key) DO UPDATE SET quantity = excluded.quantity
    `).run(team.id, req.params.key, quantity);
  }
 
  db.prepare('UPDATE roster_teams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(team.id);
  res.json({ ok: true });
});

// === Liste des skills disponibles pour un positionnel donné ===
app.get('/api/rosters/:key/positions/:title/skills', (req, res) => {
  const r = ROSTERS[req.params.key];
  if (!r) return res.status(404).json({ error: 'Roster inconnu' });
  const pos = r.positions.find(p => p.title === req.params.title);
  if (!pos) return res.status(404).json({ error: 'Positionnel inconnu' });
 
  res.json({
    skills: getAvailableSkillsForPosition(pos),
    statIncreases: STAT_INCREASES,
  });
});
 
// === Ajouter une compétence à un joueur ===
app.post('/api/myplayers/:id/skills', authMiddleware(), (req, res) => {
  const { skill_name, access_type } = req.body;
  if (!skill_name || !['primary', 'secondary'].includes(access_type)) {
    return res.status(400).json({ error: 'skill_name et access_type (primary|secondary) requis' });
  }
 
  const player = db.prepare(`
    SELECT p.*, t.user_id, t.race_key
    FROM roster_players p
    JOIN roster_teams t ON t.id = p.roster_team_id
    WHERE p.id = ? AND t.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!player) return res.status(404).json({ error: 'Joueur introuvable' });
  if (rejectIfFrozen(player.roster_team_id, res)) return;
 
  // Vérifier que la skill est bien accessible au positionnel
  const roster = ROSTERS[player.race_key];
  const pos = roster?.positions.find(p => p.title === player.position_title);
  if (!pos) return res.status(400).json({ error: 'Positionnel invalide' });
 
  const available = getAvailableSkillsForPosition(pos);
  const skillDef = available.find(s => s.name === skill_name && s.accessType === access_type);
  if (!skillDef) return res.status(400).json({ error: 'Compétence non accessible à ce positionnel' });
 
  // Charger les skills existantes
  let extras = [];
  try { extras = player.extra_skills ? JSON.parse(player.extra_skills) : []; } catch {}
  if (extras.includes(skill_name)) {
    return res.status(400).json({ error: 'Compétence déjà acquise' });
  }
  // Vérifier qu'elle n'est pas déjà dans les skills de base
  let baseSkills = [];
  try { baseSkills = player.skills ? JSON.parse(player.skills) : []; } catch {}
  if (baseSkills.includes(skill_name)) {
    return res.status(400).json({ error: 'Compétence déjà présente de base' });
  }
 
  extras.push(skill_name);
  const newCost = (player.extras_cost || 0) + skillDef.cost;
 
  db.prepare(`
    UPDATE roster_players
    SET extra_skills = ?, extras_cost = ?
    WHERE id = ?
  `).run(JSON.stringify(extras), newCost, player.id);
 
  db.prepare('UPDATE roster_teams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(player.roster_team_id);
  res.json({ ok: true, skill: skill_name, cost: skillDef.cost, total_extras_cost: newCost });
});
 
 
// === Retirer une compétence d'un joueur ===
app.delete('/api/myplayers/:id/skills/:skill', authMiddleware(), (req, res) => {
  const skillName = decodeURIComponent(req.params.skill);
 
  const player = db.prepare(`
    SELECT p.*, t.user_id, t.race_key
    FROM roster_players p
    JOIN roster_teams t ON t.id = p.roster_team_id
    WHERE p.id = ? AND t.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!player) return res.status(404).json({ error: 'Joueur introuvable' });
  if (rejectIfFrozen(player.roster_team_id, res)) return;
 
  let extras = [];
  try { extras = player.extra_skills ? JSON.parse(player.extra_skills) : []; } catch {}
  if (!extras.includes(skillName)) {
    return res.status(404).json({ error: 'Cette compétence n\'a pas été ajoutée' });
  }
 
  const roster = ROSTERS[player.race_key];
  const pos = roster?.positions.find(p => p.title === player.position_title);
  const skillDef = pos ? getAvailableSkillsForPosition(pos).find(s => s.name === skillName) : null;
  const refund = skillDef ? skillDef.cost : 0;
 
  extras = extras.filter(s => s !== skillName);
  const newCost = Math.max(0, (player.extras_cost || 0) - refund);
 
  db.prepare(`
    UPDATE roster_players
    SET extra_skills = ?, extras_cost = ?
    WHERE id = ?
  `).run(JSON.stringify(extras), newCost, player.id);
 
  db.prepare('UPDATE roster_teams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(player.roster_team_id);
  res.json({ ok: true, refund });
});
 
 
// === Augmenter une stat d'un joueur ===
app.post('/api/myplayers/:id/stats', authMiddleware(), (req, res) => {
  const { stat } = req.body;  // 'ma' | 'st' | 'ag' | 'pa' | 'av'
  const def = STAT_INCREASES.find(s => s.key === stat);
  if (!def) return res.status(400).json({ error: 'Stat invalide' });
 
  const player = db.prepare(`
    SELECT p.*, t.user_id
    FROM roster_players p
    JOIN roster_teams t ON t.id = p.roster_team_id
    WHERE p.id = ? AND t.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!player) return res.status(404).json({ error: 'Joueur introuvable' });
  if (rejectIfFrozen(player.roster_team_id, res)) return;
 
  // Limites raisonnables : on ne va pas au-delà de +2 par stat
  const colName = `stat_${stat}_bonus`;
  const currentBonus = player[colName] || 0;
  if (currentBonus >= 2) {
    return res.status(400).json({ error: 'Limite de +2 atteinte sur cette stat' });
  }
 
  const newCost = (player.extras_cost || 0) + def.cost;
  db.prepare(`UPDATE roster_players SET ${colName} = ?, extras_cost = ? WHERE id = ?`)
    .run(currentBonus + 1, newCost, player.id);
 
  db.prepare('UPDATE roster_teams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(player.roster_team_id);
  res.json({ ok: true, new_bonus: currentBonus + 1, total_extras_cost: newCost });
});
 
 
// === Annuler une augmentation de stat ===
app.delete('/api/myplayers/:id/stats/:stat', authMiddleware(), (req, res) => {
  const stat = req.params.stat;
  const def = STAT_INCREASES.find(s => s.key === stat);
  if (!def) return res.status(400).json({ error: 'Stat invalide' });
 
  const player = db.prepare(`
    SELECT p.*, t.user_id
    FROM roster_players p
    JOIN roster_teams t ON t.id = p.roster_team_id
    WHERE p.id = ? AND t.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!player) return res.status(404).json({ error: 'Joueur introuvable' });
  if (rejectIfFrozen(player.roster_team_id, res)) return;
 
  const colName = `stat_${stat}_bonus`;
  const currentBonus = player[colName] || 0;
  if (currentBonus <= 0) {
    return res.status(400).json({ error: 'Aucune augmentation à retirer sur cette stat' });
  }
 
  const newCost = Math.max(0, (player.extras_cost || 0) - def.cost);
  db.prepare(`UPDATE roster_players SET ${colName} = ?, extras_cost = ? WHERE id = ?`)
    .run(currentBonus - 1, newCost, player.id);
 
  db.prepare('UPDATE roster_teams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(player.roster_team_id);
  res.json({ ok: true, new_bonus: currentBonus - 1 });
});

// === Erreur globale ===
app.use((err, req, res, next) => {
  console.error('[ERR]', err);
  res.status(500).json({ error: 'Erreur serveur' });
});

app.listen(PORT, () => {
  console.log(`🏈 Blood Bowl Manager API en écoute sur le port ${PORT}`);
});
