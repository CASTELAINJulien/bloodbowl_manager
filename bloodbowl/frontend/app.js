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

// Heure locale d'un timestamp SQLite (stocké en UTC : "YYYY-MM-DD HH:MM:SS")
const fmtTime = (s) => {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return isNaN(d) ? '' : d.toLocaleTimeString('fr-FR');
};

// Lit un fichier image, le redimensionne (max maxSize px) et renvoie une data URL PNG
function readImageAsDataURL(file, maxSize = 256) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) { reject(new Error('Veuillez choisir un fichier image')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier échouée'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image invalide'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

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

  const nav = $('.nav');

  // Lien "Mon profil" : visible pour tout utilisateur connecté
  let profileLink = $('.nav a[data-route="profile"]');
  if (state.user) {
    if (!profileLink) {
      profileLink = el('a', { href: '#/profile', 'data-route': 'profile' }, 'Mon profil');
      nav.appendChild(profileLink);
    }
  } else if (profileLink) {
    profileLink.remove();
  }

  // Lien "Administration" dans la nav : visible uniquement pour les admins
  let adminLink = $('.nav a[data-route="admin"]');
  if (state.user && state.user.is_admin) {
    if (!adminLink) {
      adminLink = el('a', { href: '#/admin', 'data-route': 'admin' }, 'Administration');
      nav.appendChild(adminLink);
    }
  } else if (adminLink) {
    adminLink.remove();
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
    el('div', { style: 'text-align:center; margin-top:14px;' },
      el('a', { href: '#', style: 'color:var(--text-dim); font-size:13px;',
        onclick: (e) => { e.preventDefault(); closeModal(); showForgotPassword(); } }, 'Mot de passe oublié ?')),
  );
  const wrap = el('div', {}, el('h2', {}, 'Connexion'), form);
  openModal(wrap);
}

function showForgotPassword() {
  const form = el('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ identifier: fd.get('identifier') }) });
      closeModal();
      toast("Demande envoyée. Contactez l'administrateur pour récupérer votre accès.", 'success');
    } catch (err) { toast(err.message, 'error'); }
  }},
    el('div', { style: 'color:var(--text-dim); font-size:13px; margin-bottom:14px;' },
      "Saisissez votre nom d'utilisateur ou votre email. Une demande sera transmise à l'administrateur, qui vous communiquera un mot de passe temporaire."),
    el('div', { class: 'field' }, el('label', {}, "Nom d'utilisateur ou email"),
      el('input', { name: 'identifier', required: true })),
    el('div', { class: 'modal-actions' },
      el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { closeModal(); showLogin(); } }, 'Retour'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, 'Envoyer la demande')),
  );
  openModal(el('div', {}, el('h2', {}, 'Mot de passe oublié'), form));
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
// Polling de la page "match en direct" — arrêté dès qu'on quitte la page.
let livePollTimer = null;
function stopLivePoll() {
  if (livePollTimer) { clearInterval(livePollTimer); livePollTimer = null; }
}

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
  stopLivePoll(); // toute navigation coupe le polling live en cours
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
    } else if (segments[0] === 'profile') {
      $$('.nav a[data-route="profile"]').forEach(a => a.classList.add('active'));
      await renderProfile(view);
    } else if (segments[0] === 'admin') {
      $$('.nav a[data-route="admin"]').forEach(a => a.classList.add('active'));
      await renderAdmin(view);
    } else if (segments[0] === 'match' && segments[1] && segments[2] === 'live') {
      await renderMatchLive(view, segments[1]);
    } else if (segments[0] === 'match' && segments[1]) {
      await renderMatchRecap(view, segments[1]);
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
      (teams.length >= 2 && t.status !== 'completed') ? el('button', { class: 'btn btn-primary', onclick: () => nextRound(t.id) },
        t.current_round === 0 ? 'Démarrer le tournoi' : 'Tour suivant') : null,
      t.status !== 'completed' ? el('button', { class: 'btn btn-gold', onclick: () => updateStatus(t.id, 'completed') }, 'Clôturer') : null,
      t.status === 'completed' ? el('button', { class: 'btn btn-gold', onclick: () => exportTournamentNaf(t) }, '⬇ Export XML (NAF)') : null,
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
    ['stats', 'Statistiques'],
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
  else if (tab === 'stats') renderStats(content, t);
}

// --- Graphique en barres horizontales (sans dépendance) ---
function hBarChart(items, color) {
  const max = Math.max(1, ...items.map(i => i.value || 0));
  const wrap = el('div', { style: 'display:flex; flex-direction:column; gap:8px;' });
  for (const it of items) {
    const pct = Math.round(((it.value || 0) / max) * 100);
    wrap.appendChild(el('div', { style: 'display:flex; align-items:center; gap:10px;' },
      el('span', { style: 'flex:0 0 150px; font-size:13px; color:var(--text-dim); text-align:right; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;' }, it.label),
      el('div', { style: 'flex:1; background:rgba(255,255,255,0.05); border-radius:5px; overflow:hidden; height:22px;' },
        el('div', { style: `width:${pct}%; min-width:2px; height:100%; background:${color || 'var(--netblitz-yellow)'};` })),
      el('span', { style: 'flex:0 0 36px; font-family:var(--font-mono); font-weight:700; color:var(--bone); text-align:right;' }, String(it.value || 0)),
    ));
  }
  return wrap;
}

// --- Statistiques ---
async function renderStats(root, t) {
  root.innerHTML = '<div class="empty">Chargement…</div>';
  let stats;
  try { stats = await api('/tournaments/' + t.id + '/stats'); }
  catch (err) { root.innerHTML = `<div class="empty">${escape(err.message)}</div>`; return; }
  root.innerHTML = '';

  const sectionTitle = (txt, mt) => el('h3', {
    style: `font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--gold); margin:${mt || 0} 0 16px;`,
  }, txt);

  // Cartes des totaux
  root.appendChild(el('div', { class: 'tournaments-grid', style: 'margin-bottom:32px;' },
    statCard('🏈 Touchdowns', stats.totals.td, ''),
    statCard('💀 Sorties', stats.totals.cas, ''),
    statCard('🎯 Passes', stats.totals.passes, ''),
    statCard('👊 Agressions', stats.totals.aggressions, ''),
  ));
  root.appendChild(el('div', { style: 'color:var(--text-faint); font-size:12px; margin:-20px 0 24px;' },
    `${stats.matches_played} match${stats.matches_played > 1 ? 's' : ''} terminé${stats.matches_played > 1 ? 's' : ''} pris en compte`));

  // Graphique : répartition des races
  root.appendChild(sectionTitle('Races jouées'));
  if (stats.races.length) {
    root.appendChild(hBarChart(stats.races.map(r => ({ label: r.race, value: r.count })), 'var(--gold)'));
  } else {
    root.appendChild(el('div', { class: 'empty' }, 'Aucune équipe inscrite.'));
  }

  // Graphique : actions du tournoi
  root.appendChild(sectionTitle('Actions du tournoi', '36px'));
  root.appendChild(hBarChart([
    { label: '🏈 Touchdowns', value: stats.totals.td },
    { label: '💀 Sorties', value: stats.totals.cas },
    { label: '🎯 Passes', value: stats.totals.passes },
    { label: '👊 Agressions', value: stats.totals.aggressions },
  ], 'var(--blood-bright)'));
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

  // Faits marquants : meilleures équipes par sorties / agressions / passes
  const leaderCard = (label, emoji, field) => {
    let best = null;
    for (const s of standings) {
      if (!best || (s[field] || 0) > (best[field] || 0)) best = s;
    }
    const val = best ? (best[field] || 0) : 0;
    return el('div', { class: 'card', style: 'text-align:center;' },
      el('div', { style: 'font-size:32px;' }, emoji),
      el('div', { style: 'font-family:var(--font-mono); font-size:11px; letter-spacing:0.15em; text-transform:uppercase; color:var(--text-faint); margin-top:6px;' }, label),
      el('div', { style: 'font-family:var(--font-display); font-size:20px; font-weight:900; color:var(--netblitz-yellow); margin-top:6px;' },
        val > 0 ? best.team_name : '—'),
      el('div', { style: 'font-family:var(--font-mono); font-size:13px; color:var(--text-dim); margin-top:2px;' },
        val > 0 ? `${val} ${label.toLowerCase()}` : 'aucune'),
    );
  };
  if (standings.length >= 1) {
    root.appendChild(el('h3', { style: 'font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--gold); margin: 0 0 16px;' }, 'Faits marquants'));
    root.appendChild(el('div', { class: 'tournaments-grid', style: 'margin-bottom:32px;' },
      leaderCard('Sorties', '💀', 'cas_for'),
      leaderCard('Agressions', '👊', 'aggressions_for'),
      leaderCard('Passes', '🎯', 'passes_for'),
    ));
  }

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

  const notStarted = t.status !== 'in_progress' && t.status !== 'completed';
  const hasMyTeam = state.user && teams.some(tm => tm.user_id === state.user.id);
  if (state.user && notStarted) {
    // Organisateurs/admins : autant d'équipes qu'ils veulent.
    // Utilisateurs normaux : une seule par personne.
    if (isOrganizer || !hasMyTeam) {
      root.appendChild(el('button', {
        class: 'btn btn-primary',
        style: 'margin-bottom:20px;',
        onclick: () => showAssignTeamModal(t.id),
      }, '+ Assigner une de mes équipes'));
    } else {
      root.appendChild(el('div', { style: 'color:var(--text-dim); font-size:13px; margin-bottom:20px;' },
        '✓ Vous participez déjà (1 équipe par personne)'));
    }
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
      el('td', {}, el('div', { style: 'display:flex; align-items:center; gap:8px;' },
        team.logo_url ? el('img', { src: team.logo_url, alt: '', style: 'width:24px; height:24px; object-fit:contain; border-radius:4px; flex:none;' }) : null,
        el('span', { style: 'font-weight:600; color:var(--bone);' }, team.name),
      )),
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

async function showAssignTeamModal(tournamentId) {
  let myteams, me;
  try {
    [myteams, me] = await Promise.all([api('/myteams'), api('/profile')]);
  } catch (err) { toast(err.message, 'error'); return; }

  // Numéro NAF du compte requis pour s'inscrire
  if (!me || !me.naf_number || String(me.naf_number).trim() === '') {
    openModal(el('div', {},
      el('h2', {}, 'Numéro NAF requis'),
      el('p', { style: 'color:var(--text-dim); margin:0 0 20px;' },
        "Renseignez votre numéro NAF dans « Mon profil » avant d'inscrire une équipe à un tournoi."),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn btn-ghost', onclick: closeModal }, 'Fermer'),
        el('button', { class: 'btn btn-primary', onclick: () => { closeModal(); window.location.hash = '#/profile'; } }, 'Mon profil')),
    ));
    return;
  }

  if (!myteams.length) {
    openModal(el('div', {},
      el('h2', {}, 'Assigner une équipe'),
      el('p', { style: 'color:var(--text-dim); margin:0 0 20px;' },
        "Vous n'avez pas encore d'équipe. Créez-en une dans « Mes équipes » avant de l'assigner à un tournoi."),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn btn-ghost', onclick: closeModal }, 'Fermer'),
        el('button', { class: 'btn btn-primary', onclick: () => { closeModal(); navigate('myteams'); } }, 'Mes équipes')),
    ));
    return;
  }

  const form = el('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const rosterTeamId = fd.get('roster_team_id');
    if (!rosterTeamId) { toast('Choisissez une équipe', 'error'); return; }
    try {
      await api(`/tournaments/${tournamentId}/assign-team`, {
        method: 'POST',
        body: JSON.stringify({ roster_team_id: Number(rosterTeamId) }),
      });
      toast('Équipe assignée au tournoi', 'success');
      closeModal(); renderRoute();
    } catch (err) { toast(err.message, 'error'); }
  }},
    el('div', { class: 'field' }, el('label', {}, 'Votre équipe'),
      (() => {
        const sel = el('select', { name: 'roster_team_id', required: true });
        sel.appendChild(el('option', { value: '' }, '-- choisir --'));
        for (const tm of myteams) {
          const count = tm.players_count != null ? ` · ${tm.players_count} joueur${tm.players_count > 1 ? 's' : ''}` : '';
          sel.appendChild(el('option', { value: String(tm.id) }, `${tm.name}${count}`));
        }
        return sel;
      })(),
    ),
    el('p', { style: 'color:var(--text-faint); font-size:12px; margin:4px 0 0;' },
      `Le nom, la race et la valeur sont repris de votre équipe. Inscription avec votre numéro NAF : ${me.naf_number}.`),
    el('div', { class: 'modal-actions' },
      el('button', { type: 'button', class: 'btn btn-ghost', onclick: closeModal }, 'Annuler'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, 'Assigner')),
  );
  openModal(el('div', {}, el('h2', {}, 'Assigner une de mes équipes'), form));
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
      (canScore && t.status === 'in_progress' && !isCompleted)
        ? el('button', { class: 'btn btn-primary btn-sm', onclick: () => navigate('match', { id: m.id }) }, '▶ Jouer')
        : null,
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

// =============================================
//  JOUR DE MATCH : récap + suivi en direct
// =============================================

// Un utilisateur peut piloter le match s'il est admin, organisateur, ou l'un
// des deux coachs.
function canPlayMatch(m) {
  return !!state.user && (
    state.user.is_admin ||
    m.organizer_id === state.user.id ||
    m.team1_user === state.user.id ||
    m.team2_user === state.user.id
  );
}

function teamRecapPanel(m, side) {
  const name = m[`team${side}_name`] || '—';
  const coach = m[`team${side}_coach`] || '';
  const race = m[`team${side}_race`] || '';
  const tv = m[`team${side}_tv`];
  const logo = m[`team${side}_logo`];
  const players = m[`team${side}_players`] || [];

  const panel = el('div', { class: 'card', style: 'flex:1; min-width:280px;' },
    el('div', { style: 'display:flex; align-items:center; gap:12px;' },
      logo ? el('img', { src: logo, alt: '', style: 'width:48px; height:48px; object-fit:contain; border-radius:8px; flex:none;' }) : null,
      el('div', { style: 'font-family:var(--font-display); font-size:24px; font-weight:900; color:var(--netblitz-yellow);' }, name),
    ),
    el('div', { class: 'meta', style: 'margin:6px 0 14px;' },
      el('span', {}, '◆ ' + coach),
      el('span', {}, '◆ ' + race),
      tv ? el('span', {}, '◆ ' + tv + ' or') : null,
    ),
  );

  if (players.length) {
    const wrap = el('div', { class: 'table-wrap' });
    const table = el('table');
    table.appendChild(el('thead', {}, el('tr', {},
      el('th', { style: 'width:36px;' }, '#'),
      el('th', {}, 'Poste'),
      el('th', { class: 'td-num' }, 'MA'),
      el('th', { class: 'td-num' }, 'ST'),
      el('th', { class: 'td-num' }, 'AG'),
      el('th', { class: 'td-num' }, 'AV'),
      el('th', {}, 'Compétences'),
    )));
    const tbody = el('tbody');
    for (const p of players) {
      const ma = p.ma + (p.stat_ma_bonus || 0);
      const st = p.st + (p.stat_st_bonus || 0);
      const ag = p.ag !== null ? Math.max(1, p.ag - (p.stat_ag_bonus || 0)) : null;
      const allSkills = [...(p.skills || []), ...(p.extra_skills || [])];
      tbody.appendChild(el('tr', {},
        el('td', { class: 'td-num' }, String(p.number)),
        el('td', { style: 'color:#fff; font-weight:600;' },
          p.player_name ? `${p.position_title} · ${p.player_name}` : p.position_title),
        el('td', { class: 'td-num' }, String(ma)),
        el('td', { class: 'td-num' }, String(st)),
        el('td', { class: 'td-num' }, ag !== null ? ag + '+' : '—'),
        el('td', { class: 'td-num' }, p.av + '+'),
        el('td', { style: 'font-size:12px; color:var(--text-dim);' }, allSkills.length ? allSkills.join(', ') : '—'),
      ));
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    panel.appendChild(wrap);
  } else {
    panel.appendChild(el('div', { style: 'color:var(--text-faint); font-size:13px;' },
      'Pas de feuille d\'équipe détaillée (équipe non liée au constructeur).'));
  }
  return panel;
}

async function renderMatchRecap(view, matchId) {
  const m = await api('/matches/' + matchId);
  view.innerHTML = '';

  view.appendChild(el('div', { class: 'detail-actions', style: 'margin-bottom:16px;' },
    el('button', { class: 'btn btn-ghost', onclick: () => navigate('t', { id: m.tournament_id, tab: 'matches' }) }, '← Retour au tournoi'),
  ));

  view.appendChild(el('h1', { class: 'page-title', style: 'text-align:center;' },
    `${m.team1_name} vs ${m.team2_name}`));
  view.appendChild(el('div', { style: 'text-align:center; color:var(--text-dim); font-family:var(--font-mono); letter-spacing:0.1em; text-transform:uppercase; margin-bottom:24px;' },
    `${m.tournament_name || ''} · Tour ${m.round}`));

  view.appendChild(el('div', { style: 'display:flex; gap:20px; flex-wrap:wrap; align-items:flex-start;' },
    teamRecapPanel(m, 1),
    teamRecapPanel(m, 2),
  ));

  const isCompleted = m.status === 'completed';
  if (isCompleted) {
    view.appendChild(el('div', { style: 'text-align:center; margin-top:28px; color:var(--text-dim);' },
      `Match terminé · Score final ${m.td1} - ${m.td2}`));
  } else if (canPlayMatch(m)) {
    view.appendChild(el('div', { style: 'text-align:center; margin-top:32px;' },
      el('button', {
        class: 'btn btn-gold',
        style: 'font-size:18px; padding:16px 32px;',
        onclick: async () => {
          // Lance la météo (idempotent côté serveur) avant d'entrer dans le live
          try { await api('/matches/' + matchId + '/roll-weather', { method: 'POST' }); } catch { /* le live réessaiera */ }
          window.location.hash = `#/match/${matchId}/live`;
        },
      }, "🥊  Let's get ready to rumble !"),
    ));
  } else {
    view.appendChild(el('div', { style: 'text-align:center; margin-top:28px; color:var(--text-faint);' },
      'Seuls les coachs de ce match peuvent lancer la rencontre.'));
  }
}

async function renderMatchLive(view, matchId) {
  let m = await api('/matches/' + matchId);

  if (m.status === 'completed') {
    // Déjà joué : on renvoie vers le récap
    navigate('match', { id: matchId });
    return;
  }

  const editable = canPlayMatch(m);
  const HALF_TURNS = 8;

  // Filet de sécurité : si la météo n'a pas été lancée (accès direct au live), on
  // la lance ici puis on recharge le match pour récupérer l'évènement météo.
  if ((!m.weather || m.pop1 == null) && editable) {
    try {
      await api('/matches/' + matchId + '/roll-weather', { method: 'POST' });
      m = await api('/matches/' + matchId);
    } catch { /* ignoré */ }
  }

  // Numéro de tour global (1→8 en 1re mi-temps, 9→16 en 2e)
  const globalTurn = (half, t) => (half - 1) * HALF_TURNS + t;

  // Signature : ne re-render que si l'état (ou le journal) a vraiment changé.
  const signature = (x) => [
    x.td1, x.td2, x.cas1, x.cas2, x.passes1, x.passes2, x.aggressions1, x.aggressions2,
    x.half, x.turn1, x.turn2, x.active_team, x.turn_active, x.status, x.weather, x.pop1,
    (x.events ? x.events.length : 0),
  ].join('|');
  let lastSig = signature(m);

  const patchLive = async (patch, log) => {
    const scrollY = window.scrollY;
    try {
      // Le PATCH renvoie la ligne du match (+ events) sans les noms d'équipes
      // joints : on fusionne pour garder le reste de l'objet courant.
      const body = log && log.length ? { ...patch, log } : patch;
      const updated = await api('/matches/' + matchId + '/live', { method: 'PATCH', body: JSON.stringify(body) });
      m = { ...m, ...updated };
      lastSig = signature(m);
      render();
      window.scrollTo(0, scrollY);
    } catch (err) { toast(err.message, 'error'); }
  };

  const STAT_LABELS = { td: 'Touchdown', cas: 'Sortie', passes: 'Passe', aggressions: 'Agression' };
  const playerLabel = (p) => `#${p.number} ${p.position_title}${p.player_name ? ' · ' + p.player_name : ''}`;

  // Applique +1 sur une stat et journalise (avec le joueur si fourni)
  const applyStat = (base, side, player) => {
    const field = base + side;
    const detail = player
      ? `${STAT_LABELS[base]} — ${playerLabel(player)}`
      : `${STAT_LABELS[base]} — ${m[`team${side}_name`]}`;
    patchLive({ [field]: (m[field] || 0) + 1 }, [{ type: base, team_side: side, detail }]);
  };

  // Retrait (correction) : on décrémente sans journaliser
  const removeStat = (base, side) => {
    if (!editable) return;
    const field = base + side;
    patchLive({ [field]: Math.max(0, (m[field] || 0) - 1) });
  };

  // Modale de sélection du joueur auteur de l'action
  const pickPlayerForStat = (base, side) => {
    if (!editable) return;
    const players = m[`team${side}_players`] || [];
    if (!players.length) { applyStat(base, side, null); return; } // pas de roster lié
    const wrap = el('div', {},
      el('h2', {}, `${STAT_LABELS[base]} — ${m[`team${side}_name`]}`),
      el('div', { style: 'color:var(--text-dim); font-size:13px; margin-bottom:14px;' },
        'À quel joueur attribuer cette action ?'),
    );
    const list = el('div', { style: 'display:flex; flex-direction:column; gap:6px; max-height:50vh; overflow-y:auto;' });
    for (const p of players) {
      list.appendChild(el('button', {
        class: 'btn',
        style: 'justify-content:flex-start; text-align:left;',
        onclick: () => { closeModal(); applyStat(base, side, p); },
      }, playerLabel(p)));
    }
    wrap.appendChild(list);
    wrap.appendChild(el('div', { class: 'modal-actions', style: 'margin-top:14px;' },
      el('button', { class: 'btn btn-ghost', onclick: closeModal }, 'Annuler'),
      el('button', { class: 'btn btn-ghost', onclick: () => { closeModal(); applyStat(base, side, null); } }, 'Sans joueur'),
    ));
    openModal(wrap);
  };

  const toggleTurn = () => {
    if (!editable) return;

    // Tout premier tour du match : on démarre le tour de l'équipe active.
    // (seul moment où le bouton "Début de tour" est proposé)
    if (!m.turn_active) {
      const newTurn = Math.min(HALF_TURNS, (m.active_team === 1 ? (m.turn1 || 0) : (m.turn2 || 0)) + 1);
      const patch = { turn_active: 1 };
      if (m.active_team === 1) patch.turn1 = newTurn; else patch.turn2 = newTurn;
      patchLive(patch, [{ type: 'turn', team_side: m.active_team,
        detail: `Tour ${globalTurn(m.half, newTurn)} — ${m[`team${m.active_team}_name`]}` }]);
      return;
    }

    // Fin de tour : on enchaîne automatiquement sur le tour de l'autre équipe.
    const t1 = m.turn1 || 0, t2 = m.turn2 || 0;
    const halfOver = t1 >= HALF_TURNS && t2 >= HALF_TURNS;

    if (halfOver && m.half >= 2) {
      // Dernier tour de la 2e mi-temps terminé -> fin du match
      patchLive({ turn_active: 0 }, [{ type: 'turn', team_side: null, detail: 'Fin du match' }]);
      return;
    }
    if (halfOver && m.half === 1) {
      // BB : l'équipe qui a commencé la 1re MT ne commence pas la 2e.
      // L'équipe 1 a démarré le match -> l'équipe 2 lance la 2e mi-temps.
      patchLive({ half: 2, turn1: 0, turn2: 1, active_team: 2, turn_active: 1 }, [
        { type: 'turn', team_side: null, detail: '— Mi-temps 2 —' },
        { type: 'turn', team_side: 2, detail: `Tour ${globalTurn(2, 1)} — ${m.team2_name}` },
      ]);
      return;
    }

    // Sinon on passe la main à l'autre équipe et on démarre directement son tour
    const nextActive = m.active_team === 1 ? 2 : 1;
    const nextTurn = Math.min(HALF_TURNS, (nextActive === 1 ? t1 : t2) + 1);
    const patch = { active_team: nextActive, turn_active: 1 };
    if (nextActive === 1) patch.turn1 = nextTurn; else patch.turn2 = nextTurn;
    patchLive(patch, [{ type: 'turn', team_side: nextActive,
      detail: `Tour ${globalTurn(m.half, nextTurn)} — ${m[`team${nextActive}_name`]}` }]);
  };

  const endMatch = async () => {
    if (!confirm('Mettre fin au match ? Le score sera enregistré et le classement mis à jour.')) return;
    try {
      await api('/matches/' + matchId, { method: 'PUT', body: JSON.stringify({
        td1: m.td1 || 0, td2: m.td2 || 0, cas1: m.cas1 || 0, cas2: m.cas2 || 0,
        passes1: m.passes1 || 0, passes2: m.passes2 || 0,
        aggressions1: m.aggressions1 || 0, aggressions2: m.aggressions2 || 0,
        status: 'completed',
      }) });
      toast('Match terminé', 'success');
      navigate('t', { id: m.tournament_id, tab: 'matches' });
    } catch (err) { toast(err.message, 'error'); }
  };

  const statCounter = (label, field, side) => {
    const f = field + side;
    return el('div', { style: 'display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid var(--line);' },
      el('span', { style: 'font-size:13px; color:var(--text-dim);' }, label),
      el('div', { style: 'display:flex; align-items:center; gap:10px;' },
        editable ? el('button', { class: 'btn btn-sm', onclick: () => removeStat(field, side) }, '−') : null,
        el('span', { style: 'font-family:var(--font-mono); font-weight:700; min-width:28px; text-align:center; color:var(--netblitz-yellow); font-size:18px;' }, String(m[f] || 0)),
        editable ? el('button', { class: 'btn btn-primary btn-sm', onclick: () => pickPlayerForStat(field, side) }, '+') : null,
      ),
    );
  };

  const teamStatsCard = (side) => {
    const active = m.active_team === side;
    return el('div', { class: 'card', style: `flex:1; min-width:260px; ${active ? 'border-top:4px solid var(--netblitz-yellow);' : ''}` },
      el('div', { style: 'font-family:var(--font-display); font-size:20px; font-weight:900; color:#fff; margin-bottom:4px;' },
        m[`team${side}_name`]),
      el('div', { style: 'font-size:12px; color:var(--text-faint); margin-bottom:12px;' },
        `Tours joués : ${m[`turn${side}`] || 0} / ${HALF_TURNS}` + (active ? ' · à son tour' : '')),
      statCounter('🏈 Touchdowns', 'td', side),
      statCounter('💀 Sorties', 'cas', side),
      statCounter('🎯 Passes', 'passes', side),
      statCounter('👊 Agressions', 'aggressions', side),
    );
  };

  // Revenir à un tour précédent (correction) en cliquant sur une case :
  // l'équipe redevient active sur le tour choisi, et l'adversaire est réaligné
  // pour rester synchronisé (l'équipe 1 mène toujours l'ordre des tours).
  const goToTurn = (side, turnNum) => {
    if (!editable) return;
    // L'équipe 1 mène la 1re mi-temps, l'équipe 2 mène la 2e (elle a le coup d'envoi).
    const leader = m.half >= 2 ? 2 : 1;
    const follower = leader === 1 ? 2 : 1;
    const patch = { active_team: side, turn_active: 1 };
    if (side === leader) {
      // Le meneur est sur le tour N -> le suiveur a terminé le tour N-1
      patch[`turn${leader}`] = turnNum;
      patch[`turn${follower}`] = Math.max(0, turnNum - 1);
    } else {
      // Le suiveur est sur le tour N -> le meneur a déjà joué son tour N
      patch[`turn${follower}`] = turnNum;
      patch[`turn${leader}`] = turnNum;
    }
    patchLive(patch, [{ type: 'turn', team_side: side,
      detail: `Retour au tour ${globalTurn(m.half, turnNum)} — ${m[`team${side}_name`]}` }]);
  };

  // Cases du compte-tours d'UNE équipe : 1→8 en 1re mi-temps, 9→16 en 2e.
  // La case jaune = tour courant de cette équipe. Cliquable pour revenir en arrière.
  const teamTurnBoxes = (side) => {
    const matchComplete = m.half >= 2 && (m.turn1 || 0) >= HALF_TURNS && (m.turn2 || 0) >= HALF_TURNS && !m.turn_active;
    const cur = m[`turn${side}`] || 0;
    const isActive = m.active_team === side && !matchComplete;
    // Équipe active : tour en cours (ou prochain à démarrer) ; sinon, dernier tour joué.
    const current = isActive
      ? (m.turn_active ? cur : Math.min(HALF_TURNS, cur + 1))
      : cur;
    const base = m.half >= 2 ? HALF_TURNS : 0;                   // décalage 9..16

    const row = el('div', { style: 'display:flex; gap:4px; justify-content:center; flex-wrap:wrap; margin-top:8px;' });
    for (let i = 1; i <= HALF_TURNS; i++) {
      const isCurrent = current > 0 && i === current;
      const isPast = i < current;
      row.appendChild(el('div', {
        title: editable ? `Revenir au tour ${base + i}` : null,
        onclick: editable ? () => goToTurn(side, i) : null,
        style: 'width:28px; height:28px; display:flex; align-items:center; justify-content:center;'
          + ' font-family:var(--font-mono); font-weight:700; font-size:12px; border-radius:5px;'
          + ` border:1px solid ${isCurrent ? 'var(--netblitz-yellow)' : 'var(--line)'};`
          + ` background:${isCurrent ? 'var(--netblitz-yellow)' : (isPast ? 'rgba(255,255,255,0.06)' : 'transparent')};`
          + ` color:${isCurrent ? '#1a1a1a' : (isPast ? 'var(--text-dim)' : 'var(--text-faint)')};`
          + (editable ? ' cursor:pointer;' : ''),
      }, String(base + i)));
    }
    return row;
  };

  // Historique des actions de jeu (+ météo, popularité) : TD, sorties, passes, agressions
  const ACTION_TYPES = ['weather', 'popularity', 'td', 'cas', 'passes', 'aggressions'];
  const EVENT_ICON = { weather: '🌦️', popularity: '📣', td: '🏈', cas: '💀', passes: '🎯', aggressions: '👊' };
  const historyCard = () => {
    const events = (m.events || []).filter(ev => ACTION_TYPES.includes(ev.type));
    const card = el('div', { class: 'card', style: 'margin:24px auto; max-width:560px;' });
    card.appendChild(el('h3', { style: 'font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--gold); margin:0 0 12px; text-align:center;' },
      'Historique des actions'));
    if (!events.length) {
      card.appendChild(el('div', { style: 'color:var(--text-faint); font-size:13px; text-align:center;' }, 'Aucune action pour le moment.'));
      return card;
    }
    const list = el('div', { style: 'max-height:300px; overflow-y:auto;' });
    [...events].reverse().forEach(ev => {
      const global = ev.team_side == null;  // météo / évènement global
      const right = ev.team_side === 2;     // coach de droite
      const turnEl = ev.turn
        ? el('span', { style: 'font-family:var(--font-mono); color:var(--netblitz-yellow); font-size:11px; white-space:nowrap;' }, `Tour ${ev.turn}`)
        : null;
      const iconEl = el('span', { style: 'font-size:16px;' }, EVENT_ICON[ev.type] || '•');
      const detailEl = el('span', { style: global ? 'color:var(--text-dim); font-style:italic;' : 'color:var(--bone);' },
        ev.detail || ev.type);
      // Météo : centrée, sans tour. Équipe 2 : à droite. Équipe 1 : à gauche.
      let parts, justify;
      if (global) { parts = [iconEl, detailEl]; justify = 'center'; }
      else if (right) { parts = [turnEl, detailEl, iconEl]; justify = 'flex-end'; }
      else { parts = [iconEl, detailEl, turnEl]; justify = 'flex-start'; }
      list.appendChild(el('div', {
        style: 'display:flex; align-items:center; gap:8px; padding:5px 4px; font-size:13px; border-bottom:1px solid var(--line);'
          + ` justify-content:${justify};`,
      }, ...parts));
    });
    card.appendChild(list);
    return card;
  };

  function render() {
    view.innerHTML = '';
    const matchComplete = m.half >= 2 && (m.turn1 || 0) >= HALF_TURNS && (m.turn2 || 0) >= HALF_TURNS && !m.turn_active;
    const activeName = m[`team${m.active_team}_name`];

    view.appendChild(el('div', { class: 'detail-actions', style: 'margin-bottom:16px;' },
      el('button', { class: 'btn btn-ghost', onclick: () => navigate('match', { id: matchId }) }, '← Récap'),
    ));

    // Tableau de score — chaque équipe a ses cases de compte-tours sous son nom
    view.appendChild(el('div', { style: 'text-align:center; margin-bottom:8px;' },
      el('div', { style: 'font-family:var(--font-mono); font-size:12px; letter-spacing:0.15em; text-transform:uppercase; color:var(--text-faint);' },
        `Mi-temps ${m.half} / 2`),
      el('div', { style: 'display:flex; align-items:flex-start; justify-content:center; gap:24px; margin-top:8px;' },
        el('div', { style: 'display:flex; flex-direction:column; align-items:center; max-width:320px;' },
          m.team1_logo ? el('img', { src: m.team1_logo, alt: '', style: 'width:40px; height:40px; object-fit:contain; border-radius:6px; margin-bottom:4px;' }) : null,
          el('span', { style: 'font-family:var(--font-display); font-size:22px; color:#fff;' }, m.team1_name),
          teamTurnBoxes(1),
        ),
        el('span', { style: 'font-family:var(--font-display); font-size:48px; font-weight:900; color:var(--netblitz-yellow); line-height:1;' },
          `${m.td1 || 0} - ${m.td2 || 0}`),
        el('div', { style: 'display:flex; flex-direction:column; align-items:center; max-width:320px;' },
          m.team2_logo ? el('img', { src: m.team2_logo, alt: '', style: 'width:40px; height:40px; object-fit:contain; border-radius:6px; margin-bottom:4px;' }) : null,
          el('span', { style: 'font-family:var(--font-display); font-size:22px; color:#fff;' }, m.team2_name),
          teamTurnBoxes(2),
        ),
      ),
    ));

    // Compte-tours
    if (!matchComplete) {
      view.appendChild(el('div', { style: 'text-align:center; margin:20px 0;' },
        el('div', { style: 'color:var(--text-dim); margin-bottom:10px;' },
          m.turn_active ? `Tour en cours : ${activeName}` : `Au tour de : ${activeName}`),
        editable ? el('button', {
          class: m.turn_active ? 'btn btn-gold' : 'btn btn-primary',
          style: 'font-size:16px; padding:12px 28px;',
          onclick: toggleTurn,
        }, m.turn_active ? `⏹ Fin du tour de ${activeName}` : `▶ Début du tour de ${activeName}`) : null,
      ));
    } else {
      view.appendChild(el('div', { style: 'text-align:center; margin:20px 0; color:var(--moss, #4a7c2a); font-weight:700;' },
        '✓ Les deux mi-temps (8 tours) sont jouées'));
    }

    // Historique des actions — au milieu de la page
    view.appendChild(historyCard());

    // Cartes stats par équipe
    view.appendChild(el('div', { style: 'display:flex; gap:20px; flex-wrap:wrap; margin-top:8px;' },
      teamStatsCard(1),
      teamStatsCard(2),
    ));

    // Fin de match
    if (editable) {
      view.appendChild(el('div', { style: 'text-align:center; margin-top:28px;' },
        el('button', {
          class: 'btn btn-danger',
          style: 'font-size:16px; padding:14px 30px;',
          disabled: !matchComplete,
          onclick: matchComplete ? endMatch : null,
        }, '🏁 Fin de Match'),
        !matchComplete ? el('div', { style: 'color:var(--text-faint); font-size:12px; margin-top:8px;' },
          'Disponible une fois les 2 mi-temps de 8 tours jouées.') : null,
      ));
    }

    if (!editable) {
      view.appendChild(el('div', { style: 'text-align:center; margin-top:20px; color:var(--text-faint); font-size:13px;' },
        'Vue spectateur — seuls les coachs peuvent modifier le match.'));
    }
  }

  render();

  // Temps réel : on recharge l'état du match toutes les secondes. Le timer est
  // coupé automatiquement par stopLivePoll() dès qu'on change de route.
  stopLivePoll();
  livePollTimer = setInterval(async () => {
    try {
      const fresh = await api('/matches/' + matchId);
      if (fresh.status === 'completed') {
        // L'adversaire (ou l'organisateur) a mis fin au match → on bascule au récap
        stopLivePoll();
        navigate('match', { id: matchId });
        return;
      }
      const sig = signature(fresh);
      if (sig !== lastSig) {
        m = fresh;
        lastSig = sig;
        const scrollY = window.scrollY;
        render();
        window.scrollTo(0, scrollY);
      }
    } catch { /* erreurs réseau du polling ignorées */ }
  }, 1000);
}

// --- Classement ---
// Tableau de classement compact trié sur une statistique (sorties, agressions, passes)
function rankingTable(title, standings, field, valueLabel) {
  const rows = [...standings].sort((a, b) =>
    (b[field] || 0) - (a[field] || 0) || a.team_name.localeCompare(b.team_name));
  const section = el('div', { style: 'margin-top:32px;' });
  section.appendChild(el('h3', { style: 'font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--gold); margin:0 0 12px;' }, title));
  const wrap = el('div', { class: 'table-wrap' });
  const table = el('table');
  table.appendChild(el('thead', {}, el('tr', {},
    el('th', {}, '#'),
    el('th', {}, 'Équipe'),
    el('th', {}, 'Coach'),
    el('th', {}, 'Race'),
    el('th', { class: 'td-num' }, valueLabel),
  )));
  const tbody = el('tbody');
  rows.forEach((s, i) => {
    const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    tbody.appendChild(el('tr', {},
      el('td', { class: 'td-rank ' + rankClass }, String(i + 1)),
      el('td', { style: 'font-weight:600; color:var(--bone);' }, s.team_name),
      el('td', {}, s.coach_name),
      el('td', {}, s.race),
      el('td', { class: 'td-num', style: 'font-family:var(--font-display); font-weight:700; color:var(--netblitz-yellow); font-size:16px;' },
        String(s[field] || 0)),
    ));
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  return section;
}

function renderStandings(root, standings) {
  root.innerHTML = '';
  if (standings.length === 0) {
    root.appendChild(el('div', { class: 'empty' }, 'Pas encore de classement'));
    return;
  }
  root.appendChild(el('h3', { style: 'font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--gold); margin:0 0 12px;' },
    'Classement général'));
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

  // Sous-classements thématiques
  root.appendChild(rankingTable('Classement des sorties', standings, 'cas_for', 'Sorties'));
  root.appendChild(rankingTable('Classement des agressions', standings, 'aggressions_for', 'Agressions'));
  root.appendChild(rankingTable('Classement des passes', standings, 'passes_for', 'Passes'));
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

// Export des résultats du tournoi au format NAF (XML) puis téléchargement
async function exportTournamentNaf(t) {
  try {
    const { xml, filename } = await api(`/tournaments/${t.id}/export-naf`);
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `NAF-tournoi-${t.id}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Export XML généré', 'success');
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
 
  const makeCard = (t) => el('div', {
    class: 'card card-link t-card',
    onclick: () => navigate('myteams', { id: t.id }),
  },
    el('div', { style: 'display:flex; justify-content:space-between; gap:12px; align-items:center;' },
      el('div', { style: 'display:flex; align-items:center; gap:10px; min-width:0;' },
        t.logo ? el('img', { src: t.logo, alt: '', style: 'width:36px; height:36px; object-fit:contain; border-radius:6px; flex:none;' }) : null,
        el('h3', { class: 't-name', title: t.frozen ? 'Inscrite à un tournoi (verrouillée)' : '' },
          (t.frozen ? '🔒 ' : '') + t.name),
      ),
      el('span', { class: 'badge', style: 'color:var(--netblitz-yellow); border-color:var(--netblitz-yellow); flex:none;' },
        rosters.find(r => r.key === t.race_key)?.name || t.race_key),
    ),
    t.coach_name ? el('div', { class: 't-meta' },
      el('span', {}, '◆ Coach ' + t.coach_name),
    ) : null,
    el('div', { class: 't-stats' },
      el('div', { class: 't-stat' },
        el('span', { class: 't-stat-value' }, String(t.players_count)),
        el('span', { class: 't-stat-label' }, 'Joueurs')),
      el('div', { class: 't-stat' },
        el('span', { class: 't-stat-value' }, (t.treasury / 1000).toFixed(0) + 'k'),
        el('span', { class: 't-stat-label' }, 'Trésor')),
    ),
  );

  const section = (title, list) => {
    if (!list.length) return;
    view.appendChild(el('h3', { style: 'font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--netblitz-yellow); margin: 8px 0 12px;' },
      `${title} (${list.length})`));
    const grid = el('div', { class: 'tournaments-grid', style: 'margin-bottom:28px;' });
    list.forEach(t => grid.appendChild(makeCard(t)));
    view.appendChild(grid);
  };

  section('Équipes créées', teams.filter(t => !t.frozen));
  section('Inscrites à un tournoi', teams.filter(t => t.frozen));
}
 
function showCreateTeamModal(rosters) {
  let logoData = null;
  const preview = el('img', { style: 'display:none; width:72px; height:72px; object-fit:contain; border-radius:8px; border:1px solid var(--line); margin-top:8px; background:rgba(255,255,255,0.04);' });
  const fileInput = el('input', { type: 'file', accept: 'image/*', onchange: async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      logoData = await readImageAsDataURL(file);
      preview.src = logoData; preview.style.display = 'block';
    } catch (err) { toast(err.message, 'error'); }
  }});
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
          logo: logoData,
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
    el('div', { class: 'field' }, el('label', {}, 'Logo (facultatif)'), fileInput, preview),
    el('div', { class: 'modal-actions' },
      el('button', { type: 'button', class: 'btn btn-ghost', onclick: closeModal }, 'Annuler'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, 'Créer')),
  );
  openModal(el('div', {}, el('h2', {}, 'Nouvelle équipe'), form));
}

// Modale d'ajout / modification / retrait du logo d'une équipe existante
function showLogoModal(team) {
  let logoData = team.logo || null;
  const preview = el('img', {
    src: logoData || '',
    style: `${logoData ? '' : 'display:none;'} width:96px; height:96px; object-fit:contain; border-radius:10px; border:1px solid var(--line); background:rgba(255,255,255,0.04);`,
  });
  const fileInput = el('input', { type: 'file', accept: 'image/*', onchange: async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      logoData = await readImageAsDataURL(file);
      preview.src = logoData; preview.style.display = 'block';
    } catch (err) { toast(err.message, 'error'); }
  }});
  const save = async (value) => {
    try {
      await api('/myteams/' + team.id, { method: 'PUT', body: JSON.stringify({ logo: value }) });
      toast('Logo mis à jour', 'success');
      closeModal();
      renderRoute();
    } catch (err) { toast(err.message, 'error'); }
  };
  openModal(el('div', {},
    el('h2', {}, "Logo de l'équipe"),
    el('div', { style: 'display:flex; justify-content:center; margin-bottom:14px;' }, preview),
    el('div', { class: 'field' }, el('label', {}, 'Choisir une image'), fileInput),
    el('div', { class: 'modal-actions' },
      el('button', { class: 'btn btn-ghost', onclick: closeModal }, 'Annuler'),
      team.logo ? el('button', { class: 'btn btn-danger', onclick: () => save(null) }, 'Retirer') : null,
      el('button', { class: 'btn btn-primary', onclick: () => save(logoData) }, 'Enregistrer'),
    ),
  ));
}

// État (déplié ou non) de la liste des star players, conservé entre rafraîchissements
let starListExpanded = false;

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
  let availableStars = [];
  try {
    availableStars = await api('/rosters/' + team.race_key + '/stars');
  } catch (err) {
    console.warn('⚠️ Stars indisponibles:', err.message);
  }
  view.innerHTML = '';

  // Gel : équipe inscrite à un tournoi => non modifiable tant qu'elle n'est pas désinscrite
  const frozen = !!team.frozen;
  const registrations = team.registrations || [];

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
      el('div', { style: 'display:flex; align-items:center; gap:14px;' },
        team.logo ? el('img', { src: team.logo, alt: '', style: 'width:56px; height:56px; object-fit:contain; border-radius:8px; flex:none;' }) : null,
        el('div', {},
        el('h1', { class: 'page-title' }, team.name),
        el('div', { class: 'meta', style: 'margin-top:8px;' },
          el('span', {}, fullRoster.name),
          el('span', {}, '◆ Tier ' + fullRoster.tier),
          team.coach_name ? el('span', {}, '◆ Coach ' + team.coach_name) : null,
        ),
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
      frozen ? null : el('button', { class: 'btn btn-ghost', onclick: () => showLogoModal(team) }, '🖼 Logo'),
      frozen ? null : el('button', { class: 'btn btn-danger', onclick: () => deleteMyTeam(team.id) }, 'Supprimer'),
    ),
  ));

  // Bannière de gel + désinscription
  if (frozen) {
    const banner = el('div', { style: 'background:rgba(245,197,24,0.08); border:1px solid var(--netblitz-yellow); border-radius:8px; padding:14px 16px; margin:16px 0;' },
      el('div', { style: 'font-weight:700; color:var(--netblitz-yellow); margin-bottom:6px;' },
        '🔒 Équipe verrouillée — inscrite à un tournoi'),
      el('div', { style: 'color:var(--text-dim); font-size:13px; margin-bottom:10px;' },
        'Cette équipe ne peut plus être modifiée. Désinscrivez-la du/des tournoi(s) ci-dessous pour la débloquer.'),
    );
    const list = el('div', { style: 'display:flex; flex-direction:column; gap:8px;' });
    for (const reg of registrations) {
      list.appendChild(el('div', { style: 'display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;' },
        el('span', {},
          el('a', { href: `#/t/${reg.tournament_id}`, style: 'color:var(--bone); font-weight:600;' }, reg.tournament_name),
          el('span', { class: 'badge', style: 'margin-left:8px;' }, STATUS_LABELS[reg.tournament_status] || reg.tournament_status)),
        el('button', { class: 'btn btn-danger btn-sm', onclick: () => unregisterTeam(reg.team_id, reg.tournament_name) }, 'Désinscrire'),
      ));
    }
    banner.appendChild(list);
    view.appendChild(banner);
  }

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
    const canAdd = !frozen && owned < pos.max && !groupFull && remaining >= pos.cost;
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

  // === Star Players disponibles (rendu plus bas, sous l'effectif) ===
  const appendStarSection = () => {
    if (!availableStars.length) return;
    const starWrap = el('div', { class: 'table-wrap', style: starListExpanded ? '' : 'display:none;' });
    const chevron = el('span', {}, starListExpanded ? '▾' : '▸');
    view.appendChild(el('h3', {
      style: 'font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--netblitz-yellow); margin: 32px 0 12px; cursor:pointer; user-select:none; display:flex; align-items:center; gap:8px;',
      onclick: () => {
        starListExpanded = !starListExpanded;
        starWrap.style.display = starListExpanded ? '' : 'none';
        chevron.textContent = starListExpanded ? '▾' : '▸';
      },
    }, chevron, el('span', {}, `Star Players disponibles (${availableStars.length})`)));
    const starTable = el('table');
    starTable.appendChild(el('thead', {}, el('tr', {},
      el('th', {}, 'Star Player'),
      el('th', { class: 'td-num' }, 'MA'),
      el('th', { class: 'td-num' }, 'ST'),
      el('th', { class: 'td-num' }, 'AG'),
      el('th', { class: 'td-num' }, 'PA'),
      el('th', { class: 'td-num' }, 'AV'),
      el('th', {}, 'Compétences'),
      el('th', {}, 'Règle spéciale'),
      el('th', { class: 'td-num' }, 'Coût'),
      el('th', {}, ''),
    )));
    const starBody = el('tbody');
    for (const star of availableStars) {
      const members = (star.members && star.members.length) ? star.members : [star];
      const isDuo = members.length > 1;
      const owned = members.some(mem => team.players.some(p => p.is_star && p.position_title === mem.name && !p.dead));
      const canAdd = !frozen && !owned && remaining >= star.cost && (team.players.length + members.length) <= 16;
      const actionCell = owned
        ? el('span', { style: 'color:var(--moss, #4a7c2a); font-size:12px;' }, '✓ engagé')
        : (canAdd ? el('button', {
            class: 'btn btn-primary btn-sm',
            title: isDuo ? 'Engage le duo (les 2 joueurs)' : '',
            onclick: () => hireStarPlayer(team, star),
          }, isDuo ? '+ Engager (×2)' : '+ Engager') : null);

      members.forEach((mem, idx) => {
        const cells = [
          el('td', { style: 'font-weight:700; color:#fff;' },
            mem.name, isDuo ? el('span', { style: 'color:var(--gold); font-size:10px; margin-left:6px;' }, '· duo') : null),
          el('td', { class: 'td-num' }, String(mem.ma)),
          el('td', { class: 'td-num' }, String(mem.st)),
          el('td', { class: 'td-num' }, mem.ag + '+'),
          el('td', { class: 'td-num' }, mem.pa === '-' ? '—' : mem.pa + '+'),
          el('td', { class: 'td-num' }, mem.av + '+'),
          el('td', { style: 'font-size:12px; color:var(--text-dim); max-width:280px;' },
            (mem.skills && mem.skills.length) ? mem.skills.join(', ') : '—'),
          el('td', { style: 'font-size:11px; color:var(--text-faint); max-width:260px;' },
            (mem.specialRules && mem.specialRules.length) ? mem.specialRules.join(' ') : '—'),
        ];
        // Coût + action : une seule fois, fusionnés sur toutes les lignes du duo
        if (idx === 0) {
          cells.push(el('td', { class: 'td-num', rowspan: members.length, style: 'color:var(--netblitz-yellow); font-weight:700; vertical-align:middle;' }, star.cost + 'k'));
          cells.push(el('td', { rowspan: members.length, style: 'vertical-align:middle;' }, actionCell));
        }
        starBody.appendChild(el('tr', {}, ...cells));
      });
    }
    starTable.appendChild(starBody);
    starWrap.appendChild(starTable);
    view.appendChild(starWrap);
  };

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
      const realPa = (p.pa !== null && p.pa !== undefined && p.pa !== '-')
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
            readonly: frozen ? true : null,
            style: 'background:transparent; border:1px solid var(--line); color:var(--text); padding:4px 8px; width:100%; font-size:13px;',
            onblur: frozen ? null : (e) => updatePlayerName(p.id, e.target.value),
          }),
        ),
        el('td', {}, p.position_title),
        el('td', { class: 'td-num' }, fmtStat(realMa, p.stat_ma_bonus, false)),
        el('td', { class: 'td-num' }, fmtStat(realSt, p.stat_st_bonus, false)),
        el('td', { class: 'td-num' }, fmtStat(realAg, p.stat_ag_bonus, true)),
        el('td', { class: 'td-num' }, fmtStat(realPa, p.stat_pa_bonus, true)),
        el('td', { class: 'td-num' }, fmtStat(realAv, p.stat_av_bonus, true)),
        el('td', { style: 'font-size:12px; color:var(--text-dim); max-width:280px;' },
          skillsContent,
          (p.is_star && p.special_rules)
            ? el('div', { style: 'margin-top:4px; font-size:11px; color:var(--gold); font-style:italic;' }, '★ ' + p.special_rules)
            : null,
        ),
        el('td', { class: 'td-num' }, String(p.spp || 0)),
        el('td', { class: 'td-num', style: 'color:var(--netblitz-yellow); font-weight:700;' }, totalCost + 'k'),
        el('td', { style: 'display:flex; gap:4px;' },
          // Édition verrouillée si l'équipe est inscrite à un tournoi
          (frozen || p.is_star) ? null : el('button', {
            class: 'btn btn-gold btn-sm',
            title: 'Progression',
            onclick: () => showPlayerProgressModal(p, fullRoster),
          }, '⬆'),
          frozen ? null : el('button', {
            class: 'btn btn-danger btn-sm',
            title: p.star_group ? 'Renvoyer le duo' : 'Renvoyer',
            onclick: () => firePlayer(p),
          }, '✕'),
        ),
      ));
    }
    playersTable.appendChild(playersBody);
    const wrap2 = el('div', { class: 'table-wrap' });
    wrap2.appendChild(playersTable);
    view.appendChild(wrap2);
  }

  // Liste des star players, sous le tableau d'effectif
  appendStarSection();

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
          disabled: frozen || current <= (item.min || 0),
          onclick: () => updateStaff(team.id, item.key, current - 1),
        }, '−'),
        el('span', { style: 'font-family:var(--font-display); font-size:24px; color:var(--netblitz-yellow); min-width:40px; text-align:center; font-weight:900;' },
          String(current)),
        el('button', {
          class: 'btn btn-sm',
          disabled: frozen || current >= item.max || remaining < item.cost,
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
            disabled: frozen || current <= 0,
            onclick: () => updateInducement(team.id, ind.key, current - 1),
          }, '−'),
          el('span', { style: 'font-family:var(--font-display); font-size:24px; color:var(--netblitz-yellow); min-width:36px; text-align:center; font-weight:900;' },
            String(current)),
          el('button', {
            class: 'btn btn-sm',
            disabled: frozen || current >= max || remaining < cost,
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
// Re-render la fiche d'équipe courante (id lu depuis l'URL) SANS flash
// "Chargement…" ni saut de défilement. À préférer à renderRoute() pour toutes
// les actions de la page d'équipe.
async function refreshTeamBuilder() {
  const { segments } = parseHash();
  if (segments[0] !== 'myteams' || !segments[1]) { renderRoute(); return; }
  const scrollY = window.scrollY;
  try {
    await renderTeamBuilder($('#view'), segments[1]);
  } finally {
    window.scrollTo(0, scrollY);
  }
}

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
    await refreshTeamBuilder();
  } catch (err) { toast(err.message, 'error'); }
}

async function hireStarPlayer(team, star) {
  try {
    await api(`/myteams/${team.id}/stars`, {
      method: 'POST',
      body: JSON.stringify({ star_key: star.key }),
    });
    toast(`${star.name} engagé`, 'success');
    await refreshTeamBuilder();
  } catch (err) { toast(err.message, 'error'); }
}

async function firePlayer(p) {
  const isDuo = !!p.star_group;
  if (!confirm(isDuo
    ? 'Ce star fait partie d\'un duo : le renvoyer renvoie aussi son binôme. Continuer ?'
    : 'Renvoyer ce joueur ?')) return;
  try {
    await api('/myplayers/' + p.id, { method: 'DELETE' });
    toast(isDuo ? 'Duo renvoyé' : 'Joueur renvoyé', 'success');
    await refreshTeamBuilder();
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
    await refreshTeamBuilder();
  } catch (err) { toast(err.message, 'error'); }
}

async function updateInducement(teamId, key, quantity) {
  try {
    await api(`/myteams/${teamId}/inducements/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    });
    await refreshTeamBuilder();
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

// Désinscrire l'équipe d'un tournoi (supprime la ligne `teams`) -> la débloque
async function unregisterTeam(teamId, tournamentName) {
  if (!confirm(`Désinscrire l'équipe de « ${tournamentName} » ? Elle redeviendra modifiable.`)) return;
  try {
    await api('/teams/' + teamId, { method: 'DELETE' });
    toast('Équipe désinscrite', 'success');
    await refreshTeamBuilder();
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
    await refreshTeamBuilder();
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
    await refreshTeamBuilder();
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
    await refreshTeamBuilder();
  } catch (err) { toast(err.message, 'error'); }
}
 
async function unboostStat(playerId, stat) {
  try {
    await api(`/myplayers/${playerId}/stats/${stat}`, { method: 'DELETE' });
    toast(`-1 ${stat.toUpperCase()}`, 'success');
    closeModal();
    await refreshTeamBuilder();
  } catch (err) { toast(err.message, 'error'); }
}

// =============================================
//  INIT
// =============================================
// =============================================
//  MON PROFIL
// =============================================
async function renderProfile(view) {
  if (!state.user) {
    view.innerHTML = '<div class="empty">Connectez-vous pour voir votre profil.</div>';
    return;
  }
  let me;
  try { me = await api('/profile'); }
  catch (err) { view.innerHTML = `<div class="empty">${escape(err.message)}</div>`; return; }

  view.innerHTML = '';
  view.appendChild(el('h1', { class: 'page-title' }, 'Mon profil'));

  // Résumé des informations
  const info = (label, value) => el('div', { style: 'display:flex; justify-content:space-between; gap:16px; padding:10px 0; border-bottom:1px solid var(--line);' },
    el('span', { style: 'color:var(--text-dim); font-size:13px;' }, label),
    el('span', { style: 'color:var(--bone); font-weight:600;' }, value),
  );
  view.appendChild(el('div', { class: 'card', style: 'max-width:560px; margin-bottom:28px;' },
    info("Nom d'utilisateur", me.username),
    info('Email', me.email),
    info('Numéro NAF', me.naf_number || '—'),
    info('Rôle', me.is_admin ? 'Administrateur' : 'Coach'),
    info('Membre depuis', fmtDate(me.created_at)),
    info('Mes équipes', String(me.teams_count)),
  ));

  // Édition du numéro NAF
  const nafForm = el('form', { class: 'form', style: 'max-width:560px; margin-bottom:28px;', onsubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(nafForm);
    try {
      await api('/profile', { method: 'PUT', body: JSON.stringify({ naf_number: (fd.get('naf_number') || '').trim() || null }) });
      toast('Numéro NAF enregistré', 'success');
      renderRoute();
    } catch (err) { toast(err.message, 'error'); }
  }},
    el('div', { class: 'field' }, el('label', {}, 'Mon numéro NAF'),
      el('input', { name: 'naf_number', inputmode: 'numeric', value: me.naf_number || '', placeholder: 'ex: 33131' })),
    el('div', { class: 'modal-actions' },
      el('button', { type: 'submit', class: 'btn btn-primary' }, 'Enregistrer le NAF')),
  );
  view.appendChild(el('h3', { style: 'font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--gold); margin:0 0 12px;' },
    'Numéro NAF'));
  view.appendChild(nafForm);

  // Bilan victoires / nuls / défaites par race (matchs de tournois terminés)
  view.appendChild(el('h3', { style: 'font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--gold); margin:0 0 12px;' },
    'Bilan par race'));
  const records = me.race_records || [];
  if (!records.length) {
    view.appendChild(el('div', { class: 'empty', style: 'margin-bottom:28px;' }, 'Aucun match de tournoi joué pour le moment.'));
  } else {
    const wrap = el('div', { class: 'table-wrap', style: 'max-width:560px; margin-bottom:28px;' });
    const table = el('table');
    table.appendChild(el('thead', {}, el('tr', {},
      el('th', {}, 'Race'),
      el('th', { class: 'td-num' }, 'J'),
      el('th', { class: 'td-num' }, 'V'),
      el('th', { class: 'td-num' }, 'N'),
      el('th', { class: 'td-num' }, 'D'),
      el('th', { class: 'td-num' }, '% V'),
    )));
    const tbody = el('tbody');
    for (const r of records) {
      const winPct = r.played ? Math.round((r.wins / r.played) * 100) : 0;
      tbody.appendChild(el('tr', {},
        el('td', { style: 'font-weight:600; color:var(--bone);' }, r.race),
        el('td', { class: 'td-num' }, String(r.played)),
        el('td', { class: 'td-num', style: 'color:var(--moss, #4a7c2a); font-weight:700;' }, String(r.wins)),
        el('td', { class: 'td-num', style: 'color:var(--text-dim);' }, String(r.draws)),
        el('td', { class: 'td-num', style: 'color:var(--blood-bright);' }, String(r.losses)),
        el('td', { class: 'td-num', style: 'font-family:var(--font-mono); color:var(--netblitz-yellow);' }, winPct + '%'),
      ));
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    view.appendChild(wrap);
  }

  // Changement de mot de passe
  const form = el('form', { class: 'form', style: 'max-width:560px;', onsubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    if (fd.get('new_password') !== fd.get('confirm_password')) {
      toast('La confirmation ne correspond pas', 'error'); return;
    }
    try {
      await api('/profile/password', { method: 'PUT', body: JSON.stringify({
        current_password: fd.get('current_password'),
        new_password: fd.get('new_password'),
      }) });
      toast('Mot de passe modifié', 'success');
      form.reset();
    } catch (err) { toast(err.message, 'error'); }
  }},
    el('div', { class: 'field' }, el('label', {}, 'Mot de passe actuel'),
      el('input', { name: 'current_password', type: 'password', required: true, autocomplete: 'current-password' })),
    el('div', { class: 'field' }, el('label', {}, 'Nouveau mot de passe (min 6 caractères)'),
      el('input', { name: 'new_password', type: 'password', required: true, minlength: 6, autocomplete: 'new-password' })),
    el('div', { class: 'field' }, el('label', {}, 'Confirmer le nouveau mot de passe'),
      el('input', { name: 'confirm_password', type: 'password', required: true, minlength: 6, autocomplete: 'new-password' })),
    el('div', { class: 'modal-actions' },
      el('button', { type: 'submit', class: 'btn btn-primary' }, 'Changer le mot de passe')),
  );
  view.appendChild(el('h3', { style: 'font-family:var(--font-display); letter-spacing:0.08em; text-transform:uppercase; color:var(--gold); margin:0 0 12px;' },
    'Changer mon mot de passe'));
  view.appendChild(form);
}

// =============================================
//  ADMINISTRATION (admins uniquement)
// =============================================
async function renderAdmin(view) {
  if (!state.user || !state.user.is_admin) {
    view.innerHTML = '<div class="empty">Accès réservé aux administrateurs.</div>';
    return;
  }
  let users;
  try { users = await api('/admin/users'); }
  catch (err) { view.innerHTML = `<div class="empty">${escape(err.message)}</div>`; return; }

  view.innerHTML = '';
  view.appendChild(el('h1', { class: 'page-title' }, 'Administration'));
  view.appendChild(el('p', { style: 'color:var(--text-dim); margin:0 0 24px;' },
    `${users.length} compte${users.length > 1 ? 's' : ''} enregistré${users.length > 1 ? 's' : ''}`));

  const wrap = el('div', { class: 'table-wrap' });
  const table = el('table');
  table.appendChild(el('thead', {}, el('tr', {},
    el('th', {}, 'Utilisateur'),
    el('th', {}, 'Email'),
    el('th', {}, 'Rôle'),
    el('th', {}, 'Inscrit le'),
    el('th', { style: 'width:320px;' }, ''),
  )));
  const tbody = el('tbody');
  for (const u of users) {
    const isSelf = u.id === state.user.id;
    tbody.appendChild(el('tr', {},
      el('td', { style: 'font-weight:600; color:var(--bone);' },
        u.username + (isSelf ? ' (vous)' : ''),
        u.reset_requested_at
          ? el('span', { class: 'badge', style: 'margin-left:8px; color:var(--blood-bright); border-color:var(--blood-bright); font-size:10px;' }, 'réinit. demandée')
          : null),
      el('td', {}, u.email),
      el('td', {}, u.is_admin
        ? el('span', { class: 'badge', style: 'color:var(--netblitz-yellow); border-color:var(--netblitz-yellow);' }, 'Admin')
        : el('span', { style: 'color:var(--text-dim);' }, 'Coach')),
      el('td', { style: 'color:var(--text-faint);' }, fmtDate(u.created_at)),
      el('td', {},
        el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap;' },
          el('button', { class: 'btn btn-sm', onclick: () => resetUserPassword(u) }, 'Réinit. mdp'),
          isSelf ? null : el('button', { class: 'btn btn-sm', onclick: () => toggleAdmin(u) },
            u.is_admin ? 'Retirer admin' : 'Rendre admin'),
          isSelf ? null : el('button', { class: 'btn btn-danger btn-sm', onclick: () => deleteUser(u) },
            'Supprimer'),
        ),
      ),
    ));
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  view.appendChild(wrap);
}

async function toggleAdmin(u) {
  try {
    await api('/admin/users/' + u.id, { method: 'PUT', body: JSON.stringify({ is_admin: u.is_admin ? 0 : 1 }) });
    toast(u.is_admin ? `${u.username} n'est plus admin` : `${u.username} est maintenant admin`, 'success');
    renderRoute();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteUser(u) {
  if (!confirm(`Supprimer définitivement le compte « ${u.username} » ?\nSes équipes (Mes équipes) seront aussi supprimées.`)) return;
  try {
    await api('/admin/users/' + u.id, { method: 'DELETE' });
    toast('Compte supprimé', 'success');
    renderRoute();
  } catch (err) { toast(err.message, 'error'); }
}

async function resetUserPassword(u) {
  if (!confirm(`Réinitialiser le mot de passe de « ${u.username} » ?\nUn mot de passe temporaire sera généré.`)) return;
  try {
    const r = await api('/admin/users/' + u.id + '/reset-password', { method: 'POST' });
    openModal(el('div', {},
      el('h2', {}, 'Mot de passe réinitialisé'),
      el('p', { style: 'color:var(--text-dim);' },
        `Communiquez ce mot de passe temporaire à ${u.username}. Il pourra le changer ensuite dans « Mon profil ».`),
      el('div', { style: 'font-family:var(--font-mono); font-size:22px; color:var(--netblitz-yellow); text-align:center; padding:16px; margin:12px 0; background:rgba(255,255,255,0.05); border:1px solid var(--line); border-radius:8px; user-select:all;' },
        r.temp_password),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn btn-primary', onclick: () => { closeModal(); renderRoute(); } }, 'Fermer')),
    ));
  } catch (err) { toast(err.message, 'error'); }
}

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
