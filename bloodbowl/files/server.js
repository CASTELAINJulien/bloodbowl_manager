import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import db from './db.js';
import { hashPassword, verifyPassword, generateToken, authMiddleware, adminOnly } from './auth.js';
import { computeStandings, generateNextRound } from './pairings.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limiter sur l'auth
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// Liste des races BB officielles (Blood Bowl 2020)
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

app.post('/api/tournaments/:id/teams', authMiddleware(), (req, res) => {
  const { name, coach_name, race, team_value = 0 } = req.body || {};
  if (!name || !coach_name || !race) return res.status(400).json({ error: 'Champs requis' });
  if (!BB_RACES.includes(race)) return res.status(400).json({ error: 'Race invalide' });

  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tournoi introuvable' });
  if (t.status !== 'registration' && !canManage(req, req.params.id)) {
    return res.status(400).json({ error: 'Inscriptions fermées' });
  }
  if (t.max_teams) {
    const c = db.prepare('SELECT COUNT(*) as c FROM teams WHERE tournament_id = ?').get(req.params.id).c;
    if (c >= t.max_teams) return res.status(400).json({ error: 'Tournoi complet' });
  }

  const result = db.prepare(`
    INSERT INTO teams (tournament_id, name, coach_name, race, team_value, user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, name, coach_name, race, team_value, req.user.id);
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

app.put('/api/matches/:id', authMiddleware(), (req, res) => {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match introuvable' });
  if (!canManage(req, match.tournament_id)) {
    // Les coachs participants peuvent aussi enregistrer le score
    const t1 = db.prepare('SELECT user_id FROM teams WHERE id = ?').get(match.team1_id);
    const t2 = db.prepare('SELECT user_id FROM teams WHERE id = ?').get(match.team2_id);
    if (!t1 || !t2 || (t1.user_id !== req.user.id && t2.user_id !== req.user.id)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
  }
  const { td1, td2, cas1 = 0, cas2 = 0, status = 'completed', notes } = req.body || {};
  if (typeof td1 !== 'number' || typeof td2 !== 'number') {
    return res.status(400).json({ error: 'Touchdowns requis' });
  }
  db.prepare(`
    UPDATE matches SET td1 = ?, td2 = ?, cas1 = ?, cas2 = ?,
      status = ?, notes = ?, played_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(td1, td2, cas1, cas2, status, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id));
});

// === Classement ===
app.get('/api/tournaments/:id/standings', (req, res) => {
  res.json(computeStandings(req.params.id));
});

// === Erreur globale ===
app.use((err, req, res, next) => {
  console.error('[ERR]', err);
  res.status(500).json({ error: 'Erreur serveur' });
});

app.listen(PORT, () => {
  console.log(`🏈 Blood Bowl Manager API en écoute sur le port ${PORT}`);
});
