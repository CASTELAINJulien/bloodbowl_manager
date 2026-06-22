// Génération des appariements et calcul des classements

import db from './db.js';

/**
 * Calcule le classement actuel d'un tournoi.
 * Retourne un tableau trié par points -> diff TD -> diff cas.
 */
export function computeStandings(tournamentId) {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!tournament) return [];

  const teams = db.prepare('SELECT * FROM teams WHERE tournament_id = ?').all(tournamentId);
  const matches = db.prepare(
    "SELECT * FROM matches WHERE tournament_id = ? AND status = 'completed'"
  ).all(tournamentId);

  const stats = {};
  for (const t of teams) {
    stats[t.id] = {
      team_id: t.id,
      team_name: t.name,
      coach_name: t.coach_name,
      race: t.race,
      played: 0, wins: 0, draws: 0, losses: 0,
      td_for: 0, td_against: 0, td_diff: 0,
      cas_for: 0, cas_against: 0, cas_diff: 0,
      passes_for: 0, passes_against: 0,
      aggressions_for: 0, aggressions_against: 0,
      points: 0,
      opponents: [], // pour le système suisse
    };
  }

  for (const m of matches) {
    if (!m.team1_id || !m.team2_id) continue; // bye
    const a = stats[m.team1_id];
    const b = stats[m.team2_id];
    if (!a || !b) continue;

    a.played++; b.played++;
    a.td_for += m.td1; a.td_against += m.td2;
    b.td_for += m.td2; b.td_against += m.td1;
    a.cas_for += m.cas1; a.cas_against += m.cas2;
    b.cas_for += m.cas2; b.cas_against += m.cas1;
    a.passes_for += (m.passes1 || 0); a.passes_against += (m.passes2 || 0);
    b.passes_for += (m.passes2 || 0); b.passes_against += (m.passes1 || 0);
    a.aggressions_for += (m.aggressions1 || 0); a.aggressions_against += (m.aggressions2 || 0);
    b.aggressions_for += (m.aggressions2 || 0); b.aggressions_against += (m.aggressions1 || 0);
    a.opponents.push(m.team2_id);
    b.opponents.push(m.team1_id);

    if (m.td1 > m.td2) {
      a.wins++; b.losses++;
      a.points += tournament.win_points;
      b.points += tournament.loss_points;
    } else if (m.td1 < m.td2) {
      b.wins++; a.losses++;
      b.points += tournament.win_points;
      a.points += tournament.loss_points;
    } else {
      a.draws++; b.draws++;
      a.points += tournament.draw_points;
      b.points += tournament.draw_points;
    }
  }

  for (const id in stats) {
    stats[id].td_diff = stats[id].td_for - stats[id].td_against;
    stats[id].cas_diff = stats[id].cas_for - stats[id].cas_against;
  }

  return Object.values(stats).sort((a, b) =>
    b.points - a.points ||
    b.td_diff - a.td_diff ||
    b.cas_diff - a.cas_diff ||
    a.team_name.localeCompare(b.team_name)
  );
}

/**
 * Génère les appariements pour le prochain tour.
 * Méthodes : swiss, round_robin, single_elim
 */
export function generateNextRound(tournamentId) {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!tournament) throw new Error('Tournoi introuvable');

  const teams = db.prepare('SELECT * FROM teams WHERE tournament_id = ?').all(tournamentId);
  if (teams.length < 2) throw new Error('Pas assez d\'équipes');

  const nextRound = (tournament.current_round || 0) + 1;

  // Vérifier que le tour précédent est complet
  if (tournament.current_round > 0) {
    const pending = db.prepare(
      "SELECT COUNT(*) as c FROM matches WHERE tournament_id = ? AND round = ? AND status != 'completed'"
    ).get(tournamentId, tournament.current_round);
    if (pending.c > 0) throw new Error('Le tour en cours n\'est pas terminé');
  }

  let pairings = [];

  if (tournament.format === 'round_robin') {
    pairings = generateRoundRobin(teams, nextRound);
  } else if (tournament.format === 'single_elim') {
    pairings = generateSingleElim(tournamentId, teams, nextRound);
  } else {
    // Swiss par défaut (et "league")
    pairings = generateSwiss(tournamentId, teams, nextRound);
  }

  const insert = db.prepare(`
    INSERT INTO matches (tournament_id, round, team1_id, team2_id, status)
    VALUES (?, ?, ?, ?, 'pending')
  `);
  const tx = db.transaction(() => {
    for (const p of pairings) {
      insert.run(tournamentId, nextRound, p.team1_id, p.team2_id);
    }
    db.prepare('UPDATE tournaments SET current_round = ? WHERE id = ?').run(nextRound, tournamentId);
  });
  tx();

  return { round: nextRound, pairings };
}

// --- Round Robin (Berger) ---
function generateRoundRobin(teams, round) {
  const list = [...teams];
  if (list.length % 2 === 1) list.push({ id: null, name: 'BYE' }); // bye virtuel
  const n = list.length;
  const totalRounds = n - 1;
  const r = ((round - 1) % totalRounds);

  // Algorithme du cercle
  const fixed = list[0];
  const rotating = list.slice(1);
  // rotation
  for (let i = 0; i < r; i++) rotating.unshift(rotating.pop());
  const half = n / 2;
  const left = [fixed, ...rotating.slice(0, half - 1)];
  const right = rotating.slice(half - 1).reverse();

  const pairings = [];
  for (let i = 0; i < half; i++) {
    if (left[i].id && right[i].id) {
      pairings.push({ team1_id: left[i].id, team2_id: right[i].id });
    } else if (left[i].id) {
      pairings.push({ team1_id: left[i].id, team2_id: null }); // bye
    } else if (right[i].id) {
      pairings.push({ team1_id: right[i].id, team2_id: null });
    }
  }
  return pairings;
}

// --- Système Suisse ---
function generateSwiss(tournamentId, teams, round) {
  if (round === 1) {
    // Premier tour : appariement aléatoire
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const pairings = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      pairings.push({
        team1_id: shuffled[i].id,
        team2_id: shuffled[i + 1] ? shuffled[i + 1].id : null,
      });
    }
    return pairings;
  }

  // Tours suivants : par classement, en évitant les rematches
  const standings = computeStandings(tournamentId);
  const remaining = standings.map(s => ({
    id: s.team_id,
    points: s.points,
    opponents: s.opponents,
  }));

  const pairings = [];
  const used = new Set();

  for (let i = 0; i < remaining.length; i++) {
    if (used.has(remaining[i].id)) continue;
    const a = remaining[i];
    let pair = null;

    // Chercher un adversaire pas encore rencontré, classement le plus proche
    for (let j = i + 1; j < remaining.length; j++) {
      const b = remaining[j];
      if (used.has(b.id)) continue;
      if (!a.opponents.includes(b.id)) { pair = b; break; }
    }
    // Sinon (rematch inévitable), prendre le premier dispo
    if (!pair) {
      for (let j = i + 1; j < remaining.length; j++) {
        if (!used.has(remaining[j].id)) { pair = remaining[j]; break; }
      }
    }

    if (pair) {
      pairings.push({ team1_id: a.id, team2_id: pair.id });
      used.add(a.id); used.add(pair.id);
    } else {
      pairings.push({ team1_id: a.id, team2_id: null }); // bye
      used.add(a.id);
    }
  }
  return pairings;
}

// --- Élimination directe ---
function generateSingleElim(tournamentId, teams, round) {
  if (round === 1) {
    // Tirage : on complète à la puissance de 2 supérieure avec des byes
    const n = teams.length;
    const size = Math.pow(2, Math.ceil(Math.log2(n)));
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    while (shuffled.length < size) shuffled.push(null);

    const pairings = [];
    for (let i = 0; i < size; i += 2) {
      pairings.push({
        team1_id: shuffled[i] ? shuffled[i].id : null,
        team2_id: shuffled[i + 1] ? shuffled[i + 1].id : null,
      });
    }
    return pairings;
  }

  // Tours suivants : prendre les vainqueurs du tour précédent dans l'ordre
  const previous = db.prepare(
    "SELECT * FROM matches WHERE tournament_id = ? AND round = ? ORDER BY id"
  ).all(tournamentId, round - 1);

  const winners = previous.map(m => {
    if (!m.team1_id) return m.team2_id;
    if (!m.team2_id) return m.team1_id;
    if (m.td1 > m.td2) return m.team1_id;
    if (m.td2 > m.td1) return m.team2_id;
    return m.team1_id; // tie-break arbitraire (à ajuster en cas d'égalité réelle)
  });

  const pairings = [];
  for (let i = 0; i < winners.length; i += 2) {
    pairings.push({
      team1_id: winners[i],
      team2_id: winners[i + 1] || null,
    });
  }
  return pairings;
}
