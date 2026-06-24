// =============================================================
// Star Players (joueurs vedettes) - Blood Bowl
// =============================================================
// Un star player est disponible pour une équipe si l'une des leagues de
// l'équipe (champ `league` du roster, qui peut contenir "X ou Y") figure
// dans le tableau `leagues` du star. Mettre `leagues: ['*']` pour "toutes".
//
// Stats : ma=MV, st=Force, ag (jet, ex 2 => "2+"), pa (P, '-' si pas de passe),
//         av=AR (jet, ex 6 => "6+"). cost en milliers (k).
// =============================================================

const STAR_PLAYERS = [
  {
    key: 'akhorne',
    name: "Akhorne l'Écureuil",
    ma: 7, st: 1, ag: 2, pa: '-', av: 6,
    skills: [
      'Griffes', 'Intrépide', 'Esquive', 'Frénésie', 'Rétablissement',
      'Solitaire (4+)', 'Sans les mains', 'Glissade contrôlée', 'Minus', 'Microbe',
    ],
    specialRules: [
      'Rage Aveugle : Akhorne a le droit de relancer le D6 lors du jet pour la compétence Intrépide.',
    ],
    cost: 80, // en k
    leagues: ['Bagarre des Terres Arides','Super-Ligue du Bord du Monde','Classique du Vieux Monde','Ligue des Royaumes Elfiques','Défi des Bas-Fonds', 'Coupe Dé à Coudre Halfling','Super-Ligue de Lustrie','Spot de Sylvanie','Clash du Chaos','Ligue Sylvestre'], // disponible dans toutes les leagues — à restreindre si besoin
  },
  {
    key: 'anqi_panqi',
    name: "Anqi Panqi",
    ma: 7, st: 4, ag: 5, pa: '6', av: 10,
    skills: [
      'Blocage', 'Instable', 'Projection', 'Stabilité','Solitaire (4+)',
    ],
    specialRules: [
      'Coup Sauvage : Une fois par match, quand Anqi fait une action de blocage contre un joueur adverse, il a le droit de relancer certains ou tous les dés de blocage',
    ],
    cost: 190, // en k
    leagues: ['Super-Ligue de Lustrie'], 
  },
  {
    key: 'barik_farblast',
    name: "Barik Farblast",
    ma: 6, st: 3, ag: 4, pa: '3', av: 9,
    skills: [
      'Arme secrète', 'Canonnier', 'Crane épais', 'Passe désespérée', 'Prise sûre', 'Passe','Solitaire (4+)', 
    ],
    specialRules: [
      'Et Boum ! : Chaque fois que Barik fait une passe désespérée, il peut relaner n\'importe quels résultats de déviation pour déterminer où le ballon atterit, et tout coéquipier qui tente de réceptionner le ballon applique un modificateur de +1 au jet',
    ],
    cost: 80, // en k
    leagues: ['Super-Ligue du Bord du Monde', 'Classique du Vieux Monde',
    ], 
  },
  {
    key: 'bilerot_vomitflesh',
    name: "Bilerot Vomitflesh",
    ma: 4, st: 5, ag: 4, pa: '6', av: 10,
    skills: [
      'Agresseur solitaire', 'Instable', 'Joueur déloyal', 'Présence perturbante', 'Régénération', 'Répulsion', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Régurgitation Putride : Une fois par mi-temps, Bilerot peut utiliser l\'action spéciale Gerbe de Vomi. Elle peut être utilisée même si Bilerot a déjà effectué une action de Blocage à ce tour.',
    ],
    cost: 180, // en k
    leagues: ['Favoris de Nurgle',
    ], 
  },
  {
    key: 'boa_konsstriktr',
    name: "Boa Kon'ssstriktr",
    ma: 6, st: 3, ag: 3, pa: '4', av: 9,
    skills: [
      'Esquive', 'Glissade contrôlée', 'Libération contrôlée', 'Parade', 'Queue préhensile', 'Regard hypnotique', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Regarde-moi dans les yeux : Une fois par match, si Boa commence son activation en marquant un joueur adverse en possession du ballon, il peut jeter un D6. Sur 1, rien ne se passe. Sur 2+, le jiueur adverse perd le ballon, Boa prend immédiatement possession du ballon, et l\'activation de Boa prend immédiatement fin.',
    ],
    cost: 180, // en k
    leagues: ['Super Ligue de Lustrie',
    ], 
  },
  {
    key: 'bomber_dribblesnot',
    name: "Bomber Dribblesnot",
    ma: 6, st: 2, ag: 3, pa: '3', av: 8,
    skills: [
      'Arme secrète', 'Bombardier', 'Esquive', 'Minus', 'Poids plume', 'Précision', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Kaboum ! : Une fois par match, si un joueur adverse réceptionne une bombe lancée par Bomber, vous avez le droit de décider qu\'elle explose plutôt que laisser le joueur adverse tenter de la renvoyer.',
    ],
    cost: 80, // en k
    leagues: ['Bagarre des Terres Arides', 'Défi des Bas-Fonds',
    ], 
  },
  {
    key: 'capitaine_karina_von_riesz',
    name: "Capitaine Karina von Riesz",
    ma: 7, st: 4, ag: 2, pa: '3', av: 9,
    skills: [
      'Esquive', 'Regard hypnotique', 'Rétablissement', 'Soif de sang (x+)', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Morceau de choix : Une fois par match, quand Karina rate un jet de Soif de sang, elle a le droit de mordre un joueur adverse ayant 3 ou moins en Force comme si c\'était un coequipier Trois-quart Sbire. Cette règle spéciale ne permet pas à Karina de mordre des Star Players',
    ],
    cost: 230, // en k
    leagues: ['Spot de Sylvanie',
    ], 
  },
  {
    key: 'cindy_piewhistle',
    name: "Cindy Piewhistle",
    ma: 5, st: 2, ag: 3, pa: '3', av: 7,
    skills: [
      'Arme secrète', 'Bombardier', 'Esquive', 'Minus', 'Précision', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Buffet à volonté : Une fois par match, Cindy peut effectuer 2 actions spéciales de lancer de bombe au lieu d\'une; mais elle doit s\'engager à le faire avant de faire la première Action. En ce cas, immédiatement après avoir fait la deuxième action Spéciale de lancer de Bombe, jetez un D-. Sur 1-3, Cindy est immédiatement explusée.',
    ],
    cost: 100, // en k
    leagues: ['Classique du Vieux Monde', 'Coupe Dé à Coudre Halfling',
    ], 
  },
];

// Leagues individuelles d'un roster. Le champ `league` est désormais un tableau
// (ex: ['Bagarre des Terres Arides','Clash du Chaos']) ; on accepte aussi une
// ancienne chaîne "X ou Y" par compatibilité.
function rosterLeagues(roster) {
  const lg = roster && roster.league;
  if (Array.isArray(lg)) return lg.map(s => String(s).trim()).filter(Boolean);
  return String(lg || '').split(' ou ').map(s => s.trim()).filter(Boolean);
}

// Star players disponibles pour un roster donné
function getAvailableStars(roster) {
  const leagues = rosterLeagues(roster);
  return STAR_PLAYERS.filter(s =>
    (s.leagues || []).includes('*') ||
    (s.leagues || []).some(l => leagues.includes(l))
  );
}

export { STAR_PLAYERS, getAvailableStars };
