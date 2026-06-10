// =============================================
//  BLOOD BOWL MANAGER · Frontend
// =============================================

import { generateTeamPDF } from '/pdf-export.js';

const API = '/api';

// --- État global ---
const state = {
  user: null,
  token: localStorage.getItem('bb_token') || null,
  races: [],
};

// --- Utilitaires ---
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
};

const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_LABELS = {
  draft: 'Brouillon',
  registration: 'Inscriptions',
  in_progress: 'En cours',
  completed: 'Terminé',
};

const FORMAT_LABELS = {
  swiss: 'Système Suisse',
  round_robin: 'Round Robin',
  single_elim: 'Élimination directe',
  league: 'Ligue',
};

// --- Toasts ---
function toast(msg, type = '') {
  const t = el('div', { class: `toast ${type}` }, msg);
  $('#toastRoot').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; }, 2700);
  setTimeout(() => t.remove(), 3000);
}

// --- Modal ---
function openModal(content) {
  const root = $('#modalRoot');
  const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) closeModal(); } });
  const modal = el('div', { class: 'modal' });
  modal.appendChild(content);
  bg.appendChild(modal);
  root.appendChild(bg);
  return { close: closeModal };
}
function closeModal() { $('#modalRoot').innerHTML = ''; }

// --- API ---
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// --- Auth ---
async function loadMe() {
  if (!state.token) { state.user = null; return; }
  try {
    const data = await api('/auth/me');
    state.user = data.user;
  } catch {
    state.token = null;
    localStorage.removeItem('bb_token');
    state.user = null;
  }
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('bb_token');
  toast('Déconnecté');
  navigate('home');
  renderUserZone();
}

function renderUserZone() {
  const zone = $('#userZone');
  zone.innerHTML = '';
  if (state.user) {
    zone.appendChild(el('span', { class: 'username' }, '◆ ' + state.user.username));
    zone.appendChild(el('button', { class: 'btn btn-ghost btn-sm', onclick: logout }, 'Déconnexion'));
  } else {
    zone.appendChild(el('button', { class: 'btn btn-sm', onclick: showLogin }, 'Connexion'));
    zone.appendChild(el('button', { class: 'btn btn-gold btn-sm', onclick: showRegister }, 'Inscription'));
  }
}

function showLogin() {
  const form = el('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }),
      });
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('bb_token', data.token);
      toast(`Bienvenue, coach ${data.user.username}`, 'success');
      closeModal(); renderUserZone(); renderRoute();
    } catch (err) { toast(err.message, 'error'); }
  }},
    el('div', { class: 'field' },
      el('label', {}, 'Nom d\'utilisateur ou email'),
      el('input', { name: 'username', required: true, autocomplete: 'username' })),
    el('div', { class: 'field' },
      el('label', {}, 'Mot de passe'),
      el('input', { name: 'password', type: 'password', required: true, autocomplete: 'current-password' })),
    el('div', { class: 'modal-actions' },
      el('button', { type: 'button', class: 'btn btn-ghost', onclick: closeModal }, 'Annuler'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, 'Connexion')),
  );
  const wrap = el('div', {}, el('h2', {}, 'Connexion'), form);
  openModal(wrap);
}

function showRegister() {
  const form = el('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: fd.get('username'),
          email: fd.get('email'),
          password: fd.get('password'),
        }),
      });
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('bb_token', data.token);
      toast('Compte créé ! Bienvenue dans la fosse', 'success');
      closeModal(); renderUserZone(); renderRoute();
    } catch (err) { toast(err.message, 'error'); }
  }},
    el('div', { class: 'field' }, el('label', {}, 'Nom de coach'),
      el('input', { name: 'username', required: true, minlength: 3 })),
    el('div', { class: 'field' }, el('label', {}, 'Email'),
      el('input', { name: 'email', type: 'email', required: true })),
    el('div', { class: 'field' }, el('label', {}, 'Mot de passe (6+ caractères)'),
      el('input', { name: 'password', type: 'password', required: true, minlength: 6 })),
    el('div', { class: 'modal-actions' },
      el('button', { type: 'button', class: 'btn btn-ghost', onclick: closeModal }, 'Annuler'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, 'Créer le compte')),
  );
  openModal(el('div', {}, el('h2', {}, 'Inscription'), form));
}

// =============================================
//  ROUTER
// =============================================
function navigate(route, params = {}) {
  const hash = '#/' + (route === 'home' ? '' : route) +
    (params.id ? '/' + params.id : '') +
    (params.tab ? '?tab=' + params.tab : '');
  window.location.hash = hash;
}

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = {};
  if (queryPart) for (const pair of queryPart.split('&')) {
    const [k, v] = pair.split('=');
    query[k] = decodeURIComponent(v || '');
  }
  return { segments, query };
}

async function renderRoute() {
  const { segments, query } = parseHash();
  const view = $('#view');
  view.innerHTML = '<div class="empty">Chargement…</div>';

  // Active nav
  $$('.nav a').forEach(a => a.classList.remove('active'));

  try {
    if (segments.length === 0) {
      $$('.nav a[data-route="home"]').forEach(a => a.classList.add('active'));
      await renderHome(view);
    } else if (segments[0] === 'new') {
      $$('.nav a[data-route="new"]').forEach(a => a.classList.add('active'));
      await renderNewTournament(view);
    } else if (segments[0] === 't' && segments[1]) {
      await renderTournament(view, segments[1], query.tab || 'overview');
    } else if (segments[0] === 'myteams' && !segments[1]) {
      $$('.nav a[data-route="myteams"]').forEach(a => a.classList.add('active'));
      await renderMyTeams(view);
    } else if (segments[0] === 'myteams' && segments[1]) {
      await renderTeamBuilder(view, segments[1]);
    } else {
      view.innerHTML = '<div class="empty">Page introuvable</div>';
    }
  } catch (err) {
    view.innerHTML = `<div class="empty">${escape(err.message)}</div>`;
  }
}

// =============================================
//  HOME : liste des tournois
// =============================================
async function renderHome(view) {
  const tournaments = await api('/tournaments');
  view.innerHTML = '';

  // Hero
  const hero = el('section', { class: 'hero' },
    el('div', { class: 'hero-eyebrow' }, '◆ NETBLITZ · BLOOD BOWL ◆'),
    el('h1', { class: 'hero-title' },
      'BLOOD ',
      el('span', { class: 'accent' }, 'BOWL'),
      ' MANAGER'
    ),
    el('div', { class: 'hero-divider' }, el('span', {}, '⚔')),
    el('p', { class: 'hero-tagline' },
      'Salut à toi, ',
      el('strong', {}, 'buveur de bière'),
      ', amateur de ',
      el('strong', {}, 'contacts physiques'),
      ' — bienvenue dans la fosse.'
    ),
  );
  view.appendChild(hero);

  // Header tournois
  const header = el('div', { style: 'display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:24px; gap:20px; flex-wrap:wrap;' },
    el('div', {},
      el('h2', { class: 'page-title', style: 'font-size:32px;' }, 'Tournois'),
      el('div', { class: 'page-subtitle', style: 'margin-bottom:0;' }, `${tournaments.length} compétition${tournaments.length > 1 ? 's' : ''}`),
    ),
    state.user ? el('button', { class: 'btn btn-primary', onclick: () => navigate('new') }, '+ Nouveau tournoi') : null,
  );
  view.appendChild(header);

  if (tournaments.length === 0) {
    view.appendChild(el('div', { class: 'empty' }, 'Aucun tournoi pour l\'instant. ' + (state.user ? 'Crée le premier !' : 'Connecte-toi pour en créer un.')));
    return;
  }

  const grid = el('div', { class: 'tournaments-grid' });
  for (const t of tournaments) {
    grid.appendChild(tournamentCard(t));
  }
  view.appendChild(grid);
}

function tournamentCard(t) {
  return el('div', {
    class: 'card card-link t-card',
    onclick: () => navigate('t', { id: t.id }),
  },
    el('div', { style: 'display:flex; justify-content:space-between; align-items:flex-start; gap:12px;' },
      el('h3', { class: 't-name' }, t.name),
      el('span', { class: `badge badge-${t.status}` }, STATUS_LABELS[t.status] || t.status),
    ),
    el('div', { class: 't-meta' },
      el('span', {}, FORMAT_LABELS[t.format] || t.format),
      t.start_date ? el('span', {}, '◆ ' + fmtDate(t.start_date)) : null,
      t.organizer_name ? el('span', {}, '◆ ' + t.organizer_name) : null,
    ),
    t.description ? el('p', { class: 't-desc' }, t.description) : null,
    el('div', { class: 't-stats' },
      el('div', { class: 't-stat' },
        el('span', { class: 't-stat-value' }, String(t.teams_count)),
        el('span', { class: 't-stat-label' }, 'Équipes'),
      ),
      el('div', { class: 't-stat' },
        el('span', { class: 't-stat-value' }, String(t.current_round)),
        el('span', { class: 't-stat-label' }, 'Tour'),
      ),
    ),
  );
}

// =============================================
//  CREATION DE TOURNOI
// =============================================
async function renderNewTournament(view) {
  if (!state.user) {
    view.innerHTML = '<div class="empty">Connecte-toi pour créer un tournoi</div>';
    return;
  }
  view.innerHTML = '';
  view.appendChild(el('h1', { class: 'page-title' }, 'Nouveau tournoi'));
  view.appendChild(el('div', { class: 'page-subtitle' }, 'Définis les règles de l\'arène'));

  const form = el('form', { class: 'form' });
  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {
      name: fd.get('name'),
      description: fd.get('description'),
      format: fd.get('format'),
      max_teams: fd.get('max_teams') ? parseInt(fd.get('max_teams')) : null,
      start_date: fd.get('start_date') || null,
      end_date: fd.get('end_date') || null,
      win_points: parseInt(fd.get('win_points')) || 3,
      draw_points: parseInt(fd.get('draw_points')) || 1,
      loss_points: parseInt(fd.get('loss_points')) || 0,
    };
    try {
      const t = await api('/tournaments', { method: 'POST', body: JSON.stringify(body) });
      toast('Tournoi créé', 'success');
      navigate('t', { id: t.id });
    } catch (err) { toast(err.message, 'error'); }
  };
  form.addEventListener('submit', submit);

  form.appendChild(el('div', { class: 'field' },
    el('label', {}, 'Nom du tournoi'),
    el('input', { name: 'name', required: true, placeholder: 'ex: Coupe du Vieux Monde 2026' }),
  ));
  form.appendChild(el('div', { class: 'field' },
    el('label', {}, 'Description'),
    el('textarea', { name: 'description', placeholder: 'Présentation, règles spéciales, lieu…' }),
  ));
  form.appendChild(el('div', { class: 'field' },
    el('label', {}, 'Format'),
    (() => {
      const sel = el('select', { name: 'format' });
      for (const [k, v] of Object.entries(FORMAT_LABELS)) {
        sel.appendChild(el('option', { value: k }, v));
      }
      return sel;
    })(),
  ));
  form.appendChild(el('div', { class: 'field-row' },
    el('div', { class: 'field' }, el('label', {}, 'Date de début'),
      el('input', { name: 'start_date', type: 'date' })),
    el('div', { class: 'field' }, el('label', {}, 'Date de fin'),
      el('input', { name: 'end_date', type: 'date' })),
    el('div', { class: 'field' }, el('label', {}, 'Nombre max d\'équipes'),
      el('input', { name: 'max_teams', type: 'number', min: 2, placeholder: 'illimité' })),
  ));
  form.appendChild(el('div', { class: 'field-row' },
    el('div', { class: 'field' }, el('label', {}, 'Points victoire'),
      el('input', { name: 'win_points', type: 'number', value: 3, min: 0 })),
    el('div', { class: 'field' }, el('label', {}, 'Points nul'),
      el('input', { name: 'draw_points', type: 'number', value: 1, min: 0 })),
    el('div', { class: 'field' }, el('label', {}, 'Points défaite'),
      el('input', { name: 'loss_points', type: 'number', value: 0, min: 0 })),
  ));
  form.appendChild(el('div', { style: 'display:flex; gap:10px; margin-top:10px;' },
    el('button', { type: 'submit', class: 'btn btn-primary' }, 'Créer le tournoi'),
    el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => navigate('home') }, 'Annuler'),
  ));

  view.appendChild(form);
}

// =============================================
//  PAGE TOURNOI : onglets
// =============================================
async function renderTournament(view, id, tab) {
  const [t, teams, matches, standings] = await Promise.all([
    api(`/tournaments/${id}`),
    api(`/tournaments/${id}/teams`),
    api(`/tournaments/${id}/matches`),
    api(`/tournaments/${id}/standings`),
  ]);

  view.innerHTML = '';
  const isOrganizer = state.user && (state.user.is_admin || state.user.id === t.organizer_id);

  // Header
  const header = el('section', { class: 'detail-header' },
    el('div', { style: 'display:flex; gap:12px; align-items:center; flex-wrap:wrap;' },
      el('h1', { class: 'page-title', style: 'margin:0;' }, t.name),
      el('span', { class: `badge badge-${t.status}` }, STATUS_LABELS[t.status] || t.status),
    ),
    t.description ? el('p', { style: 'color:var(--text-dim); max-width:700px; margin:8px 0 0;' }, t.description) : null,
    el('div', { class: 'meta' },
      el('span', {}, FORMAT_LABELS[t.format]),
      el('span', {}, `Tour ${t.current_round}${t.rounds_total ? ' / ' + t.rounds_total : ''}`),
      el('span', {}, `${teams.length} équipe${teams.length > 1 ? 's' : ''}`),
      t.start_date ? el('span', {}, '◆ Début ' + fmtDate(t.start_date)) : null,
      t.organizer_name ? el('span', {}, '◆ Organisé par ' + t.organizer_name) : null,
    ),
    isOrganizer ? el('div', { class: 'detail-actions' },
      teams.length >= 2 ? el('button', { class: 'btn btn-primary', onclick: () => nextRound(t.id) },
        t.current_round === 0 ? 'Démarrer le tournoi' : 'Tour suivant') : null,
      t.status !== 'completed' ? el('button', { class: 'btn btn-gold', onclick: () => updateStatus(t.id, 'completed') }, 'Clôturer') : null,
      el('button', { class: 'btn btn-danger', onclick: () => deleteTournament(t.id) }, 'Supprimer'),
    ) : null,
  );
  view.appendChild(header);

  // Tabs
  const tabs = el('div', { class: 'tabs' });
  const tabsCfg = [
    ['overview', 'Vue d\'ensemble'],
    ['teams', `Équipes (${teams.length})`],
    ['matches', 'Matchs'],
    ['standings', 'Classement'],
  ];
  for (const [k, label] of tabsCfg) {
    tabs.appendChild(el('button', {
      class: 'tab' + (k === tab ? ' active' : ''),
      onclick: () => navigate('t', { id: t.id, tab: k }),
    }, label));
  }
  view.appendChild(tabs);

  const content = el('div');
  view.appendChild(content);

  if (tab === 'overview') renderOverview(content, t, teams, matches, standings, isOrganizer);
  else if (tab === 'teams') renderTeams(content, t, teams, isOrganizer);
  else if (tab === 'matches') renderMatches(content, t, teams, matches, isOrganizer);
  else if (tab === 'standings') renderStandings(content, standings);
}

// --- Vue d'ensemble ---
function renderOverview(root, t, teams, matches, standings, isOrganizer) {
  root.innerHTML = '';
  const completedMatches = matches.filter(m => m.status === 'completed').length;
  const totalMatches = matches.length;

  const stats = el('div', { class: 'tournaments-grid', style: 'margin-bottom:32px;' },
    statCard('Équipes', teams.length, t.max_teams ? `/ ${t.max_teams} max` : ''),
    statCard('Tours joués', t.current_round, t.rounds_total ? `/ ${t.rounds_total} prévus` : ''),
    statCard('Matchs joués', completedMatches, `/ ${totalMatches}`),
    statCard('Touchdowns', matches.reduce((s, m) => s + (m.td1 || 0) + (m.td2 || 0), 0), 'au total'),
  );
  root.appendChild(stats);

  // Top 3
  if (standings.length >= 1) {
    root.appendChild(el('h3', { style: 'font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--gold); margin: 0 0 16px;' }, 'Podium actuel'));
    const podium = el('div', { class: 'tournaments-grid' });
    standings.slice(0, 3).forEach((s, i) => {
      const medals = ['🥇', '🥈', '🥉'];
      podium.appendChild(el('div', { class: 'card t-card' },
        el('div', { style: 'font-size:36px;' }, medals[i] || ''),
        el('h3', { class: 't-name' }, s.team_name),
        el('div', { class: 't-meta' },
          el('span', {}, s.coach_name),
          el('span', {}, s.race),
        ),
        el('div', { class: 't-stats' },
          el('div', { class: 't-stat' },
            el('span', { class: 't-stat-value' }, String(s.points)),
            el('span', { class: 't-stat-label' }, 'Points')),
          el('div', { class: 't-stat' },
            el('span', { class: 't-stat-value' }, String(s.td_diff > 0 ? '+' + s.td_diff : s.td_diff)),
            el('span', { class: 't-stat-label' }, 'Diff TD')),
        ),
      ));
    });
    root.appendChild(podium);
  }
}

function statCard(label, value, sub) {
  return el('div', { class: 'card', style: 'text-align:center;' },
    el('div', { style: 'font-family:var(--font-display); font-size:48px; font-weight:900; color:var(--gold); line-height:1;' }, String(value)),
    el('div', { style: 'font-family:var(--font-mono); font-size:11px; letter-spacing:0.15em; text-transform:uppercase; color:var(--text-faint); margin-top:8px;' }, label),
    sub ? el('div', { style: 'font-family:var(--font-mono); font-size:10px; color:var(--text-faint); margin-top:4px;' }, sub) : null,
  );
}

// --- Équipes ---
function renderTeams(root, t, teams, isOrganizer) {
  root.innerHTML = '';

  if (state.user && (t.status === 'registration' || isOrganizer)) {
    root.appendChild(el('button', {
      class: 'btn btn-primary',
      style: 'margin-bottom:20px;',
      onclick: () => showAddTeamModal(t.id),
    }, '+ Inscrire une équipe'));
  }

  if (teams.length === 0) {
    root.appendChild(el('div', { class: 'empty' }, 'Aucune équipe inscrite'));
    return;
  }

  const wrap = el('div', { class: 'table-wrap' });
  const table = el('table');
  const thead = el('thead', {}, el('tr', {},
    el('th', {}, 'Équipe'),
    el('th', {}, 'Coach'),
    el('th', {}, 'Race'),
    el('th', { class: 'td-num' }, 'Valeur'),
    el('th', { style: 'width:120px;' }, ''),
  ));
  const tbody = el('tbody');
  for (const team of teams) {
    const canEdit = state.user && (isOrganizer || state.user.id === team.user_id);
    tbody.appendChild(el('tr', {},
      el('td', { style: 'font-weight:600; color:var(--bone);' }, team.name),
      el('td', {}, team.coach_name),
      el('td', {}, team.race),
      el('td', { class: 'td-num' }, String(team.team_value || '—')),
      el('td', {},
        canEdit ? el('button', {
          class: 'btn btn-danger btn-sm',
          onclick: () => deleteTeam(team.id),
        }, '✕') : null,
      ),
    ));
  }
  table.appendChild(thead); table.appendChild(tbody);
  wrap.appendChild(table);
  root.appendChild(wrap);
}

function showAddTeamModal(tournamentId) {
  const form = el('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await api(`/tournaments/${tournamentId}/teams`, {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          coach_name: fd.get('coach_name'),
          race: fd.get('race'),
          team_value: parseInt(fd.get('team_value')) || 0,
        }),
      });
      toast('Équipe inscrite', 'success');
      closeModal(); renderRoute();
    } catch (err) { toast(err.message, 'error'); }
  }},
    el('div', { class: 'field' }, el('label', {}, 'Nom de l\'équipe'),
      el('input', { name: 'name', required: true, placeholder: 'ex: Reikland Reavers' })),
    el('div', { class: 'field' }, el('label', {}, 'Nom du coach'),
      el('input', { name: 'coach_name', required: true, value: state.user?.username || '' })),
    el('div', { class: 'field' }, el('label', {}, 'Race'),
      (() => {
        const sel = el('select', { name: 'race', required: true });
        sel.appendChild(el('option', { value: '' }, '-- choisir --'));
        for (const r of state.races) sel.appendChild(el('option', { value: r }, r));
        return sel;
      })(),
    ),
    el('div', { class: 'field' }, el('label', {}, 'Team Value (TV)'),
      el('input', { name: 'team_value', type: 'number', min: 0, step: 10000, placeholder: 'ex: 1100000' })),
    el('div', { class: 'modal-actions' },
      el('button', { type: 'button', class: 'btn btn-ghost', onclick: closeModal }, 'Annuler'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, 'Inscrire')),
  );
  openModal(el('div', {}, el('h2', {}, 'Nouvelle équipe'), form));
}

async function deleteTeam(id) {
  if (!confirm('Supprimer cette équipe ?')) return;
  try {
    await api('/teams/' + id, { method: 'DELETE' });
    toast('Équipe supprimée', 'success');
    renderRoute();
  } catch (err) { toast(err.message, 'error'); }
}

// --- Matchs ---
function renderMatches(root, t, teams, matches, isOrganizer) {
  root.innerHTML = '';
  if (matches.length === 0) {
    root.appendChild(el('div', { class: 'empty' }, 'Aucun match généré. ' + (isOrganizer ? 'Lance le premier tour !' : '')));
    return;
  }

  // Group par round
  const rounds = {};
  for (const m of matches) {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  }
  const roundNums = Object.keys(rounds).sort((a, b) => b - a);

  for (const r of roundNums) {
    const list = el('div', { class: 'matches-list', style: 'margin-bottom:32px;' });
    list.appendChild(el('h3', { style: 'font-family:var(--font-display); font-size:20px; letter-spacing:0.1em; text-transform:uppercase; color:var(--gold); margin:0 0 12px; padding-bottom:8px; border-bottom:1px solid var(--line);' },
      `Tour ${r}`));
    for (const m of rounds[r]) {
      list.appendChild(matchRow(m, t, teams, isOrganizer));
    }
    root.appendChild(list);
  }
}

function matchRow(m, t, teams, isOrganizer) {
  const isCompleted = m.status === 'completed';

  if (!m.team2_id) {
    return el('div', { class: 'match completed' },
      el('div', { class: 'match-team' },
        el('span', { class: 'name' }, m.team1_name || '—'),
        el('span', { class: 'meta' }, m.team1_race || ''),
      ),
      el('div', { class: 'match-bye', style: 'grid-column:span 2;' }, '— BYE —'),
      el('div', {}),
    );
  }

  // Permission de saisir : organisateur ou coach concerné
  const canScore = state.user && (isOrganizer || teams.some(team =>
    (team.id === m.team1_id || team.id === m.team2_id) && team.user_id === state.user.id
  ));

  return el('div', { class: 'match ' + (isCompleted ? 'completed' : 'pending') },
    el('div', { class: 'match-team' },
      el('span', { class: 'name' }, m.team1_name),
      el('span', { class: 'meta' }, `${m.team1_coach} · ${m.team1_race}`),
    ),
    el('div', { class: 'match-score ' + (isCompleted ? '' : 'pending') },
      isCompleted ? `${m.td1} - ${m.td2}` : 'VS',
    ),
    el('div', { class: 'match-team right' },
      el('span', { class: 'name' }, m.team2_name),
      el('span', { class: 'meta' }, `${m.team2_coach} · ${m.team2_race}`),
    ),
    el('div', { class: 'match-actions' },
      canScore ? el('button', { class: 'btn btn-sm', onclick: () => showScoreModal(m) },
        isCompleted ? 'Modifier' : 'Saisir') : null,
    ),
  );
}

function showScoreModal(m) {
  const form = el('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await api('/matches/' + m.id, {
        method: 'PUT',
        body: JSON.stringify({
          td1: parseInt(fd.get('td1')) || 0,
          td2: parseInt(fd.get('td2')) || 0,
          cas1: parseInt(fd.get('cas1')) || 0,
          cas2: parseInt(fd.get('cas2')) || 0,
          status: 'completed',
          notes: fd.get('notes') || null,
        }),
      });
      toast('Score enregistré', 'success');
      closeModal(); renderRoute();
    } catch (err) { toast(err.message, 'error'); }
  }},
    el('div', { style: 'display:grid; grid-template-columns:1fr auto 1fr; gap:16px; align-items:center;' },
      el('div', { style: 'text-align:center;' },
        el('div', { style: 'font-family:var(--font-display); font-size:18px; color:var(--bone);' }, m.team1_name),
        el('div', { style: 'font-size:12px; color:var(--text-faint); margin-top:4px;' }, m.team1_race),
      ),
      el('div', { style: 'color:var(--blood); font-family:var(--font-display); font-size:24px;' }, 'VS'),
      el('div', { style: 'text-align:center;' },
        el('div', { style: 'font-family:var(--font-display); font-size:18px; color:var(--bone);' }, m.team2_name),
        el('div', { style: 'font-size:12px; color:var(--text-faint); margin-top:4px;' }, m.team2_race),
      ),
    ),
    el('div', { class: 'field-row' },
      el('div', { class: 'field' }, el('label', {}, 'TD ' + m.team1_name),
        el('input', { name: 'td1', type: 'number', min: 0, value: m.td1 || 0, required: true })),
      el('div', { class: 'field' }, el('label', {}, 'TD ' + m.team2_name),
        el('input', { name: 'td2', type: 'number', min: 0, value: m.td2 || 0, required: true })),
    ),
    el('div', { class: 'field-row' },
      el('div', { class: 'field' }, el('label', {}, 'CAS ' + m.team1_name),
        el('input', { name: 'cas1', type: 'number', min: 0, value: m.cas1 || 0 })),
      el('div', { class: 'field' }, el('label', {}, 'CAS ' + m.team2_name),
        el('input', { name: 'cas2', type: 'number', min: 0, value: m.cas2 || 0 })),
    ),
    el('div', { class: 'field' }, el('label', {}, 'Notes (optionnel)'),
      el('textarea', { name: 'notes' }, m.notes || '')),
    el('div', { class: 'modal-actions' },
      el('button', { type: 'button', class: 'btn btn-ghost', onclick: closeModal }, 'Annuler'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, 'Enregistrer')),
  );
  openModal(el('div', {}, el('h2', {}, `Score · Tour ${m.round}`), form));
}

// --- Classement ---
function renderStandings(root, standings) {
  root.innerHTML = '';
  if (standings.length === 0) {
    root.appendChild(el('div', { class: 'empty' }, 'Pas encore de classement'));
    return;
  }
  const wrap = el('div', { class: 'table-wrap' });
  const table = el('table');
  table.appendChild(el('thead', {}, el('tr', {},
    el('th', {}, '#'),
    el('th', {}, 'Équipe'),
    el('th', {}, 'Coach'),
    el('th', {}, 'Race'),
    el('th', { class: 'td-num' }, 'J'),
    el('th', { class: 'td-num' }, 'V'),
    el('th', { class: 'td-num' }, 'N'),
    el('th', { class: 'td-num' }, 'D'),
    el('th', { class: 'td-num' }, 'TD+'),
    el('th', { class: 'td-num' }, 'TD-'),
    el('th', { class: 'td-num' }, '±'),
    el('th', { class: 'td-num' }, 'Cas±'),
    el('th', { class: 'td-num' }, 'Pts'),
  )));
  const tbody = el('tbody');
  standings.forEach((s, i) => {
    const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    tbody.appendChild(el('tr', {},
      el('td', { class: 'td-rank ' + rankClass }, String(i + 1)),
      el('td', { style: 'font-weight:600; color:var(--bone);' }, s.team_name),
      el('td', {}, s.coach_name),
      el('td', {}, s.race),
      el('td', { class: 'td-num' }, String(s.played)),
      el('td', { class: 'td-num' }, String(s.wins)),
      el('td', { class: 'td-num' }, String(s.draws)),
      el('td', { class: 'td-num' }, String(s.losses)),
      el('td', { class: 'td-num' }, String(s.td_for)),
      el('td', { class: 'td-num' }, String(s.td_against)),
      el('td', { class: 'td-num', style: `color: ${s.td_diff > 0 ? 'var(--moss)' : s.td_diff < 0 ? 'var(--blood-bright)' : 'var(--text-dim)'};` },
        s.td_diff > 0 ? '+' + s.td_diff : String(s.td_diff)),
      el('td', { class: 'td-num' }, s.cas_diff > 0 ? '+' + s.cas_diff : String(s.cas_diff)),
      el('td', { class: 'td-num', style: 'font-family:var(--font-display); font-weight:700; color:var(--gold); font-size:16px;' }, String(s.points)),
    ));
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  root.appendChild(wrap);
}

// --- Actions ---
async function nextRound(id) {
  if (!confirm('Générer le prochain tour ?')) return;
  try {
    const r = await api(`/tournaments/${id}/next-round`, { method: 'POST' });
    toast(`Tour ${r.round} généré (${r.pairings.length} matchs)`, 'success');
    renderRoute();
  } catch (err) { toast(err.message, 'error'); }
}

async function updateStatus(id, status) {
  try {
    await api(`/tournaments/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    toast('Statut mis à jour', 'success');
    renderRoute();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteTournament(id) {
  if (!confirm('Supprimer définitivement ce tournoi ? Cette action est irréversible.')) return;
  try {
    await api('/tournaments/' + id, { method: 'DELETE' });
    toast('Tournoi supprimé', 'success');
    navigate('home');
  } catch (err) { toast(err.message, 'error'); }
}

// --- Liste des équipes du coach ---
async function renderMyTeams(view) {
  if (!state.user) {
    view.innerHTML = '<div class="empty">Connecte-toi pour gérer tes équipes</div>';
    return;
  }
  const [teams, rosters] = await Promise.all([
    api('/myteams'), api('/rosters'),
  ]);
  view.innerHTML = '';
 
  view.appendChild(el('div', { style: 'display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:24px; gap:20px; flex-wrap:wrap;' },
    el('div', {},
      el('h1', { class: 'page-title' }, 'Mes équipes'),
      el('div', { class: 'page-subtitle', style: 'margin-bottom:0;' }, `${teams.length} roster${teams.length > 1 ? 's' : ''}`),
    ),
    el('button', { class: 'btn btn-primary', onclick: () => showCreateTeamModal(rosters) }, '+ Créer une équipe'),
  ));
 
  if (teams.length === 0) {
    view.appendChild(el('div', { class: 'empty' }, 'Aucune équipe sauvegardée. Crée ta première équipe !'));
    return;
  }
 
  const grid = el('div', { class: 'tournaments-grid' });
  for (const t of teams) {
    grid.appendChild(el('div', {
      class: 'card card-link t-card',
      onclick: () => navigate('myteams', { id: t.id }),
    },
      el('div', { style: 'display:flex; justify-content:space-between; gap:12px;' },
        el('h3', { class: 't-name' }, t.name),
        el('span', { class: 'badge', style: 'color:var(--netblitz-yellow); border-color:var(--netblitz-yellow);' },
          rosters.find(r => r.key === t.race_key)?.name || t.race_key),
      ),
      t.coach_name ? el('div', { class: 't-meta' }, el('span', {}, '◆ Coach ' + t.coach_name)) : null,
      el('div', { class: 't-stats' },
        el('div', { class: 't-stat' },
          el('span', { class: 't-stat-value' }, String(t.players_count)),
          el('span', { class: 't-stat-label' }, 'Joueurs')),
        el('div', { class: 't-stat' },
          el('span', { class: 't-stat-value' }, (t.treasury / 1000).toFixed(0) + 'k'),
          el('span', { class: 't-stat-label' }, 'Trésor')),
      ),
    ));
  }
  view.appendChild(grid);
}
 
function showCreateTeamModal(rosters) {
  const form = el('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      const t = await api('/myteams', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          coach_name: fd.get('coach_name') || state.user.username,
          race_key: fd.get('race_key'),
          treasury: parseInt(fd.get('treasury')) || 1000,
        }),
      });
      toast('Équipe créée', 'success');
      closeModal();
      navigate('myteams', { id: t.id });
    } catch (err) { toast(err.message, 'error'); }
  }},
    el('div', { class: 'field' }, el('label', {}, 'Nom de l\'équipe'),
      el('input', { name: 'name', required: true, placeholder: 'ex: Reikland Reavers' })),
    el('div', { class: 'field' }, el('label', {}, 'Nom du coach'),
      el('input', { name: 'coach_name', value: state.user.username })),
    el('div', { class: 'field' }, el('label', {}, 'Race / Roster'),
      (() => {
        const sel = el('select', { name: 'race_key', required: true });
        sel.appendChild(el('option', { value: '' }, '-- choisir --'));
        for (const r of rosters) {
          sel.appendChild(el('option', { value: r.key }, `${r.name} (Tier ${r.tier})`));
        }
        return sel;
      })(),
    ),
    el('div', { class: 'field' }, el('label', {}, 'Trésorerie de départ (k)'),
      el('input', { name: 'treasury', type: 'number', min: 0, step: 5, value: 1000 })),
    el('div', { class: 'modal-actions' },
      el('button', { type: 'button', class: 'btn btn-ghost', onclick: closeModal }, 'Annuler'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, 'Créer')),
  );
  openModal(el('div', {}, el('h2', {}, 'Nouvelle équipe'), form));
}
 
// --- Team Builder : éditeur d'une équipe ---
async function renderTeamBuilder(view, teamId) {
  const team = await api('/myteams/' + teamId);
  const fullRoster = await api('/rosters/' + team.race_key);
  fullRoster.key = team.race_key;
  let availableInducements = [];
  try {
    availableInducements = await api('/rosters/' + team.race_key + '/inducements');
  } catch (err) {
    console.warn('⚠️ Inducements indisponibles:', err.message);
  }
  view.innerHTML = '';
 
  // Calcul Team Value
  // Distinction trésor (or réellement dépensé) vs TV (qui inclut les progressions)
  const playersGoldCost = team.players.reduce((s, p) => s + (p.cost || 0), 0);
  const progressionTV = team.players.reduce((s, p) => s + (p.extras_cost || 0), 0);
  const playersCost = playersGoldCost + progressionTV;

  const rerollsCost = (team.rerolls || 0) * fullRoster.rerollCost;
  const apoCost = (team.apothecary || 0) * 50;
  const acCost = (team.assistant_coaches || 0) * 10;
  const chCost = (team.cheerleaders || 0) * 10;
  const fansCost = Math.max(0, (team.dedicated_fans || 0) - 1) * 10;
  const sidelineCost = rerollsCost + apoCost + acCost + chCost + fansCost;

  // Coût total des inducements achetés
  const teamInducements = team.inducements || {};
  const inducementsCost = availableInducements.reduce((sum, ind) => {
    const qty = teamInducements[ind.key] || 0;
    return sum + qty * ind.effectiveCost;
  }, 0);

  const totalTV = playersCost + sidelineCost + inducementsCost;
  // Trésorerie restante = on NE SOUSTRAIT PAS les progressions (gratuites en or)
  const remaining = (team.treasury || 0) - playersGoldCost - sidelineCost - inducementsCost;
 
  // Header
  view.appendChild(el('div', { class: 'detail-header' },
    el('div', { style: 'display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;' },
      el('div', {},
        el('h1', { class: 'page-title' }, team.name),
        el('div', { class: 'meta', style: 'margin-top:8px;' },
          el('span', {}, fullRoster.name),
          el('span', {}, '◆ Tier ' + fullRoster.tier),
          team.coach_name ? el('span', {}, '◆ Coach ' + team.coach_name) : null,
        ),
      ),
      el('div', { style: 'text-align:right;' },
        el('div', { style: 'font-family:var(--font-display); font-size:36px; font-weight:900; color:var(--netblitz-yellow); line-height:1;' },
          totalTV + 'k'),
        el('div', { style: 'font-family:var(--font-mono); font-size:11px; letter-spacing:0.15em; text-transform:uppercase; color:var(--text-faint); margin-top:4px;' }, "Valeur d'équipe"),
        el('div', { style: `font-family:var(--font-mono); font-size:13px; margin-top:8px; color:${remaining >= 0 ? 'var(--moss, #4a7c2a)' : 'var(--blood-bright)'};` },
          'Trésorerie restante : ' + remaining + 'k'),
      ),
    ),
    el('div', { class: 'detail-actions' },
      el('button', { class: 'btn btn-ghost', onclick: () => navigate('myteams') }, '← Retour'),
      el('button', {
        class: 'btn btn-gold',
        onclick: () => exportTeamToPDF(team, fullRoster, availableInducements),
      }, '📄 Export PDF'),
      el('button', { class: 'btn btn-danger', onclick: () => deleteMyTeam(team.id) }, 'Supprimer'),
    ),
  ));
 
  // === Roster (positionnels disponibles) ===
  view.appendChild(el('h3', { style: 'font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--netblitz-yellow); margin: 24px 0 12px;' },
    'Positionnels'));
 
  const wrap = el('div', { class: 'table-wrap' });
  const posTable = el('table');
  posTable.appendChild(el('thead', {}, el('tr', {},
    el('th', {}, 'Poste'),
    el('th', { class: 'td-num' }, 'Possédés / Max'),
    el('th', { class: 'td-num' }, 'MA'),
    el('th', { class: 'td-num' }, 'ST'),
    el('th', { class: 'td-num' }, 'AG'),
    el('th', { class: 'td-num' }, 'PA'),
    el('th', { class: 'td-num' }, 'AV'),
    el('th', {}, 'Compétences'),
    el('th', { class: 'td-num' }, 'Coût'),
    el('th', {}, ''),
  )));
  const posBody = el('tbody');
  // Calcul du nombre total de Gros Bras déjà engagés (pour limite groupée)
  const bigGuyTitles = fullRoster.positions.filter(p => p.inBigGuyGroup).map(p => p.title);
  const bigGuyTotal = team.players.filter(p => bigGuyTitles.includes(p.position_title) && !p.dead).length;

  for (const pos of fullRoster.positions) {
    const owned = team.players.filter(p => p.position_title === pos.title && !p.dead).length;
    const groupFull = pos.inBigGuyGroup && fullRoster.bigGuyGroupLimit
      && bigGuyTotal >= fullRoster.bigGuyGroupLimit;
    const canAdd = owned < pos.max && !groupFull && remaining >= pos.cost;
    posBody.appendChild(el('tr', {},
      el('td', { style: 'font-weight:700; color:#fff;' }, pos.title),
      el('td', { class: 'td-num', style: (owned >= pos.max || groupFull) ? 'color:var(--blood-bright);' : '' },
        groupFull && owned < pos.max
          ? `${owned} / ${pos.max} (groupe plein)`
          : `${owned} / ${pos.max}`),
      el('td', { class: 'td-num' }, String(pos.ma)),
      el('td', { class: 'td-num' }, String(pos.st)),
      el('td', { class: 'td-num' }, pos.ag + '+'),
      el('td', { class: 'td-num' }, pos.pa === '-' ? '—' : pos.pa + '+'),
      el('td', { class: 'td-num' }, pos.av + '+'),
      el('td', { style: 'font-size:12px; color:var(--text-dim); max-width:300px;' },
        pos.skills.length ? pos.skills.join(', ') : '—'),
      el('td', { class: 'td-num', style: 'color:var(--netblitz-yellow); font-weight:700;' }, pos.cost + 'k'),
      el('td', {},
        canAdd ? el('button', {
          class: 'btn btn-primary btn-sm',
          onclick: () => hirePlayer(team, pos),
        }, '+ Engager') : null,
      ),
    ));
  }
  posTable.appendChild(posBody);
  wrap.appendChild(posTable);
  view.appendChild(wrap);
 
  // === Joueurs de l'équipe ===
  if (team.players.length > 0) {
    view.appendChild(el('h3', { style: 'font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--netblitz-yellow); margin: 32px 0 12px;' },
      `Effectif (${team.players.length})`));
 
    const playersTable = el('table');
    playersTable.appendChild(el('thead', {}, el('tr', {},
      el('th', { style: 'width:50px;' }, '#'),
      el('th', {}, 'Nom'),
      el('th', {}, 'Poste'),
      el('th', { class: 'td-num' }, 'MA'),
      el('th', { class: 'td-num' }, 'ST'),
      el('th', { class: 'td-num' }, 'AG'),
      el('th', { class: 'td-num' }, 'PA'),
      el('th', { class: 'td-num' }, 'AV'),
      el('th', {}, 'Compétences'),
      el('th', { class: 'td-num' }, 'SPP'),
      el('th', { class: 'td-num' }, 'Coût'),
      el('th', {}, ''),
    )));
    const playersBody = el('tbody');
    const sortedPlayers = [...team.players].sort((a, b) => a.number - b.number);
    for (const p of sortedPlayers) {
      const totalCost = (p.cost || 0) + (p.extras_cost || 0);
 
      // Stats avec bonus
      const realMa = p.ma + (p.stat_ma_bonus || 0);
      const realSt = p.st + (p.stat_st_bonus || 0);
      const realAg = p.ag !== null ? Math.max(1, p.ag - (p.stat_ag_bonus || 0)) : null;
      const realPa = (p.pa !== null && p.pa !== undefined)
        ? Math.max(1, p.pa - (p.stat_pa_bonus || 0)) : null;
      const realAv = p.av + (p.stat_av_bonus || 0);
 
      const fmtStat = (val, bonus, asPlus) => {
        if (val === null || val === undefined) return '—';
        const display = asPlus ? val + '+' : String(val);
        if (!bonus) return display;
        return el('span', { style: 'color:#7fc44a; font-weight:700;' }, display);
      };
 
      // Skills : base normales + extras en italique doré
      const skillsContent = el('span', {});
      const baseSkills = p.skills || [];
      const extraSkills = p.extra_skills || [];
      const allParts = [
        ...baseSkills.map(s => ({ text: s, extra: false })),
        ...extraSkills.map(s => ({ text: s, extra: true })),
      ];
      allParts.forEach((part, idx) => {
        if (idx > 0) skillsContent.appendChild(document.createTextNode(', '));
        if (part.extra) {
          skillsContent.appendChild(el('span', {
            style: 'color:var(--netblitz-yellow); font-style:italic; font-weight:600;',
            title: 'Compétence acquise',
          }, part.text));
        } else {
          skillsContent.appendChild(document.createTextNode(part.text));
        }
      });
      if (allParts.length === 0) skillsContent.appendChild(document.createTextNode('—'));
 
      playersBody.appendChild(el('tr', { style: p.dead ? 'opacity:0.4; text-decoration:line-through;' : '' },
        el('td', { style: 'font-family:var(--font-display); font-weight:900; color:var(--netblitz-yellow); font-size:18px;' },
          String(p.number)),
        el('td', {},
          el('input', {
            type: 'text',
            value: p.player_name || '',
            placeholder: 'Nom du joueur',
            style: 'background:transparent; border:1px solid var(--line); color:var(--text); padding:4px 8px; width:100%; font-size:13px;',
            onblur: (e) => updatePlayerName(p.id, e.target.value),
          }),
        ),
        el('td', {}, p.position_title),
        el('td', { class: 'td-num' }, fmtStat(realMa, p.stat_ma_bonus, false)),
        el('td', { class: 'td-num' }, fmtStat(realSt, p.stat_st_bonus, false)),
        el('td', { class: 'td-num' }, fmtStat(realAg, p.stat_ag_bonus, true)),
        el('td', { class: 'td-num' }, fmtStat(realPa, p.stat_pa_bonus, true)),
        el('td', { class: 'td-num' }, fmtStat(realAv, p.stat_av_bonus, true)),
        el('td', { style: 'font-size:12px; color:var(--text-dim); max-width:280px;' }, skillsContent),
        el('td', { class: 'td-num' }, String(p.spp || 0)),
        el('td', { class: 'td-num', style: 'color:var(--netblitz-yellow); font-weight:700;' }, totalCost + 'k'),
        el('td', { style: 'display:flex; gap:4px;' },
          el('button', {
            class: 'btn btn-gold btn-sm',
            title: 'Progression',
            onclick: () => showPlayerProgressModal(p, fullRoster),
          }, '⬆'),
          el('button', {
            class: 'btn btn-danger btn-sm',
            title: 'Renvoyer',
            onclick: () => firePlayer(p.id),
          }, '✕'),
        ),
      ));
    }
    playersTable.appendChild(playersBody);
    const wrap2 = el('div', { class: 'table-wrap' });
    wrap2.appendChild(playersTable);
    view.appendChild(wrap2);
  }
 
  // === Sideline Staff ===
  view.appendChild(el('h3', { style: 'font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--netblitz-yellow); margin: 32px 0 12px;' },
    'Personnel & Re-rolls'));
 
  const staffGrid = el('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px;' });
  const staffItems = [
    { key: 'rerolls', label: 'Re-rolls', cost: fullRoster.rerollCost, max: 8 },
    { key: 'apothecary', label: 'Apothicaire', cost: 50, max: fullRoster.apothecary ? 1 : 0 },
    { key: 'assistant_coaches', label: 'Assistant coaches', cost: 10, max: 6 },
    { key: 'cheerleaders', label: 'Cheerleaders', cost: 10, max: 6 },
    { key: 'dedicated_fans', label: 'Fans dévoués', cost: 10, max: 6, min: 1 },
  ];
  for (const item of staffItems) {
    if (item.max === 0) continue;
    const current = team[item.key] || 0;
    staffGrid.appendChild(el('div', { class: 'card', style: 'padding:16px;' },
      el('div', { style: 'font-family:var(--font-mono); font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:var(--netblitz-yellow); margin-bottom:6px;' },
        item.label),
      el('div', { style: 'display:flex; align-items:center; gap:8px; margin-top:8px;' },
        el('button', {
          class: 'btn btn-sm',
          disabled: current <= (item.min || 0),
          onclick: () => updateStaff(team.id, item.key, current - 1),
        }, '−'),
        el('span', { style: 'font-family:var(--font-display); font-size:24px; color:var(--netblitz-yellow); min-width:40px; text-align:center; font-weight:900;' },
          String(current)),
        el('button', {
          class: 'btn btn-sm',
          disabled: current >= item.max || remaining < item.cost,
          onclick: () => updateStaff(team.id, item.key, current + 1),
        }, '+'),
	el('span', { style: 'font-family:var(--font-mono); font-size:11px; color:var(--text-faint); margin-left:auto;' },
  	(() => {
    	  if (item.key === 'dedicated_fans') {
      	    const billed = Math.max(0, current - 1);
      	    return current === 0
        	? '0k'
        	: (current === 1 ? '1er offert' : `1 offert + ${billed} × 10k = ${billed * 10}k`);
    	  }
    	  return item.cost + 'k × ' + current + ' = ' + (item.cost * current) + 'k';
  	})()),
      ),
    ));
  }
  view.appendChild(staffGrid);

// === Inducements ===
  if (availableInducements.length > 0) {
    view.appendChild(el('h3', { style: 'font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--netblitz-yellow); margin: 32px 0 12px;' },
      'Coups de Pouce (Inducements)'));
 
    const indGrid = el('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;' });
    for (const ind of availableInducements) {
      const current = teamInducements[ind.key] || 0;
      const cost = ind.effectiveCost;
      const max = ind.effectiveMax;
      const subtotal = current * cost;
 
      indGrid.appendChild(el('div', { class: 'card', style: 'padding:16px;' },
        // Titre + badge réduction
        el('div', { style: 'display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;' },
          el('div', { style: 'font-family:var(--font-mono); font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:var(--netblitz-yellow); font-weight:700;' },
            ind.label),
          ind.hasDiscount ? el('span', { style: 'font-size:9px; padding:2px 6px; background:var(--blood); color:#fff; border-radius:2px; font-weight:700; letter-spacing:0.1em; white-space:nowrap;' }, 'RÉDUIT') : null,
        ),
        // Compteur
        el('div', { style: 'display:flex; align-items:center; gap:8px;' },
          el('button', {
            class: 'btn btn-sm',
            disabled: current <= 0,
            onclick: () => updateInducement(team.id, ind.key, current - 1),
          }, '−'),
          el('span', { style: 'font-family:var(--font-display); font-size:24px; color:var(--netblitz-yellow); min-width:36px; text-align:center; font-weight:900;' },
            String(current)),
          el('button', {
            class: 'btn btn-sm',
            disabled: current >= max || remaining < cost,
            onclick: () => updateInducement(team.id, ind.key, current + 1),
          }, '+'),
          el('span', { style: 'font-family:var(--font-mono); font-size:11px; color:var(--text-faint); margin-left:auto; text-align:right;' },
            `${cost}k × ${current} = ${subtotal}k`),
        ),
        // Max et conditions spéciales
        el('div', { style: 'font-family:var(--font-mono); font-size:10px; color:var(--text-faint); margin-top:8px;' },
          `Max ${max}` + (ind.requiresRule ? ` · ${ind.requiresRule}` : '')),
      ));
    }
    view.appendChild(indGrid);
  } 

  // === Récap Team Value ===
  view.appendChild(el('div', { class: 'card', style: 'margin-top:24px;' },
    el('h3', { style: 'margin:0 0 12px; font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--netblitz-yellow);' },
      'Team Value'),
    el('div', { style: 'display:grid; grid-template-columns:1fr auto; gap:6px 30px; font-family:var(--font-mono); font-size:13px;' },
      el('span', {}, 'Joueurs (recrutement)'),
      el('span', { style: 'text-align:right;' }, playersGoldCost + 'k'),
      progressionTV > 0 ? el('span', { style: 'font-style:italic; color:var(--text-dim); padding-left:12px;' }, '↳ Progressions') : null,
      progressionTV > 0 ? el('span', { style: 'text-align:right; font-style:italic; color:var(--text-dim);' }, '+' + progressionTV + 'k') : null,
      el('span', {}, 'Re-rolls'), el('span', { style: 'text-align:right;' }, rerollsCost + 'k'),
      el('span', {}, 'Personnel'), el('span', { style: 'text-align:right;' }, (apoCost + acCost + chCost + fansCost) + 'k'),
      inducementsCost > 0 ? el('span', {}, 'Coups de Pouce') : null,
      inducementsCost > 0 ? el('span', { style: 'text-align:right;' }, inducementsCost + 'k') : null,
      el('span', { style: 'border-top:1px solid var(--line); padding-top:6px; font-weight:700; color:var(--netblitz-yellow);' }, 'TOTAL TV'),
      el('span', { style: 'border-top:1px solid var(--line); padding-top:6px; text-align:right; font-weight:700; color:var(--netblitz-yellow); font-size:16px;' },
        totalTV + 'k'),
    ),
  ));
}
 
// --- Actions Team Builder ---
async function hirePlayer(team, pos) {
  // Trouver le prochain numéro libre
  const used = new Set(team.players.map(p => p.number));
  let num = 1;
  while (used.has(num) && num <= 16) num++;
  if (num > 16) { toast('Roster plein', 'error'); return; }
 
  try {
    await api(`/myteams/${team.id}/players`, {
      method: 'POST',
      body: JSON.stringify({ number: num, position_title: pos.title }),
    });
    toast(`${pos.title} #${num} engagé`, 'success');
    renderRoute();
  } catch (err) { toast(err.message, 'error'); }
}
 
async function firePlayer(id) {
  if (!confirm('Renvoyer ce joueur ?')) return;
  try {
    await api('/myplayers/' + id, { method: 'DELETE' });
    toast('Joueur renvoyé', 'success');
    renderRoute();
  } catch (err) { toast(err.message, 'error'); }
}

async function showPlayerProgressModal(player, fullRoster) {
  let skillsData;
  try {
    skillsData = await api(
      `/rosters/${fullRoster.key}/positions/${encodeURIComponent(player.position_title)}/skills`
    );
  } catch (err) {
    toast('Erreur chargement skills : ' + err.message, 'error');
    return;
  }
 
  const baseSkills = player.skills || [];
  const extraSkills = player.extra_skills || [];
  const acquired = new Set([...baseSkills, ...extraSkills]);
 
  const primaries = skillsData.skills.filter(s => s.accessType === 'primary');
  const secondaries = skillsData.skills.filter(s => s.accessType === 'secondary');
 
  const renderSkillBtn = (s) => {
    const owned = acquired.has(s.name);
    return el('button', {
      class: 'btn btn-sm',
      style: owned
        ? 'opacity:0.4; cursor:not-allowed; margin:3px;'
        : (s.accessType === 'primary'
            ? 'margin:3px; border-color:var(--netblitz-yellow); color:var(--netblitz-yellow);'
            : 'margin:3px;'),
      disabled: owned,
      onclick: owned ? null : () => addSkillToPlayer(player.id, s.name, s.accessType),
    }, `${s.name} (${s.cost}k)`);
  };
 
  const renderStatRow = (statDef) => {
    const colName = `stat_${statDef.key}_bonus`;
    const current = player[colName] || 0;
    const maxed = current >= 2;
    return el('div', { style: 'display:flex; align-items:center; gap:8px; padding:8px 12px; background:rgba(255,255,255,0.04); border:1px solid var(--line); margin:4px 0;' },
      el('span', { style: 'flex:1; font-size:13px;' }, statDef.label),
      el('span', { style: 'font-family:var(--font-mono); color:var(--netblitz-yellow); min-width:35px; text-align:center; font-weight:700;' },
        current > 0 ? `+${current}` : '—'),
      el('button', {
        class: 'btn btn-sm',
        disabled: current === 0,
        onclick: () => unboostStat(player.id, statDef.key),
      }, '−'),
      el('button', {
        class: 'btn btn-primary btn-sm',
        disabled: maxed,
        onclick: () => boostStat(player.id, statDef.key),
      }, '+ ' + statDef.cost + 'k'),
    );
  };
 
  const acquiredList = el('div', { style: 'margin-bottom:16px;' });
  if (extraSkills.length > 0) {
    acquiredList.appendChild(el('div', { style: 'font-family:var(--font-mono); font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:var(--text-dim); margin-bottom:8px;' },
      'Compétences acquises'));
    extraSkills.forEach(s => {
      acquiredList.appendChild(el('span', {
        style: 'display:inline-flex; align-items:center; gap:8px; padding:5px 12px; margin:3px; background:rgba(245,197,24,0.12); border:1px solid var(--netblitz-yellow); color:var(--netblitz-yellow); font-size:12px; font-style:italic;',
      },
        s,
        el('button', {
          style: 'background:none; border:none; color:var(--blood-bright); cursor:pointer; padding:0 2px; font-size:14px; line-height:1;',
          title: 'Retirer cette compétence',
          onclick: () => removeSkillFromPlayer(player.id, s),
        }, '✕'),
      ));
    });
  }
 
  const totalCost = (player.cost || 0) + (player.extras_cost || 0);
 
  const wrap = el('div', {},
    el('h2', { style: 'margin:0 0 6px;' },
      `Progression #${player.number}${player.player_name ? ' · ' + player.player_name : ''}`),
    el('div', { style: 'font-family:var(--font-mono); font-size:12px; color:var(--text-dim); margin-bottom:20px;' },
      `${player.position_title} · Coût actuel : ${totalCost}k`),
 
    acquiredList,
 
    el('h3', { style: 'font-family:var(--font-display); font-size:14px; letter-spacing:0.1em; text-transform:uppercase; color:var(--netblitz-yellow); margin:20px 0 8px;' },
      'Compétences primaires (20k)'),
    primaries.length > 0
      ? el('div', { style: 'display:flex; flex-wrap:wrap;' }, ...primaries.map(renderSkillBtn))
      : el('div', { style: 'color:var(--text-faint); font-size:12px;' }, 'Aucune'),
 
    el('h3', { style: 'font-family:var(--font-display); font-size:14px; letter-spacing:0.1em; text-transform:uppercase; color:var(--gold); margin:20px 0 8px;' },
      'Compétences secondaires (40k)'),
    secondaries.length > 0
      ? el('div', { style: 'display:flex; flex-wrap:wrap;' }, ...secondaries.map(renderSkillBtn))
      : el('div', { style: 'color:var(--text-faint); font-size:12px;' }, 'Aucune'),
 
    el('h3', { style: 'font-family:var(--font-display); font-size:14px; letter-spacing:0.1em; text-transform:uppercase; color:var(--blood-bright); margin:20px 0 8px;' },
      'Augmentations de stats'),
    el('div', {}, ...skillsData.statIncreases.map(renderStatRow)),
 
    el('div', { class: 'modal-actions', style: 'margin-top:24px;' },
      el('button', { class: 'btn btn-ghost', onclick: closeModal }, 'Fermer'),
    ),
  );
  openModal(wrap);
}
 
async function updatePlayerName(id, name) {
  try {
    await api('/myplayers/' + id, {
      method: 'PUT',
      body: JSON.stringify({ player_name: name || null }),
    });
  } catch (err) { toast(err.message, 'error'); }
}
 
async function updateStaff(teamId, key, value) {
  try {
    await api('/myteams/' + teamId, {
      method: 'PUT',
      body: JSON.stringify({ [key]: value }),
    });
    renderRoute();
  } catch (err) { toast(err.message, 'error'); }
}

async function updateInducement(teamId, key, quantity) {
  try {
    await api(`/myteams/${teamId}/inducements/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    });
    renderRoute();
  } catch (err) { toast(err.message, 'error'); }
}
 
async function deleteMyTeam(id) {
  if (!confirm('Supprimer définitivement cette équipe ?')) return;
  try {
    await api('/myteams/' + id, { method: 'DELETE' });
    toast('Équipe supprimée', 'success');
    navigate('myteams');
  } catch (err) { toast(err.message, 'error'); }
}

async function exportTeamToPDF(team, roster, availableInducements) {
  try {
    toast('Génération du PDF…');
    await generateTeamPDF(team, roster, availableInducements);
    toast('PDF téléchargé', 'success');
  } catch (err) {
    console.error('Export PDF failed:', err);
    toast('Erreur export PDF : ' + err.message, 'error');
  }
}

async function addSkillToPlayer(playerId, skillName, accessType) {
  try {
    const result = await api(`/myplayers/${playerId}/skills`, {
      method: 'POST',
      body: JSON.stringify({ skill_name: skillName, access_type: accessType }),
    });
    toast(`+${skillName} (+${result.cost}k)`, 'success');
    closeModal();
    renderRoute();
  } catch (err) { toast(err.message, 'error'); }
}
 
async function removeSkillFromPlayer(playerId, skillName) {
  if (!confirm(`Retirer la compétence "${skillName}" ?`)) return;
  try {
    const result = await api(`/myplayers/${playerId}/skills/${encodeURIComponent(skillName)}`, {
      method: 'DELETE',
    });
    toast(`Compétence retirée (-${result.refund}k)`, 'success');
    closeModal();
    renderRoute();
  } catch (err) { toast(err.message, 'error'); }
}
 
async function boostStat(playerId, stat) {
  try {
    await api(`/myplayers/${playerId}/stats`, {
      method: 'POST',
      body: JSON.stringify({ stat }),
    });
    toast(`+1 ${stat.toUpperCase()}`, 'success');
    closeModal();
    renderRoute();
  } catch (err) { toast(err.message, 'error'); }
}
 
async function unboostStat(playerId, stat) {
  try {
    await api(`/myplayers/${playerId}/stats/${stat}`, { method: 'DELETE' });
    toast(`-1 ${stat.toUpperCase()}`, 'success');
    closeModal();
    renderRoute();
  } catch (err) { toast(err.message, 'error'); }
}

// =============================================
//  INIT
// =============================================
async function init() {
  // Liens nav
  $$('[data-route]').forEach(el => {
    el.addEventListener('click', (e) => {
      const r = el.getAttribute('data-route');
      if (r === 'new' && !state.user) { e.preventDefault(); showLogin(); return; }
    });
  });

  await loadMe();
  try { state.races = await api('/races'); } catch { state.races = []; }
  renderUserZone();
  renderRoute();
}

window.addEventListener('hashchange', renderRoute);
window.addEventListener('DOMContentLoaded', init);
