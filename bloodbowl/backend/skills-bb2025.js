// =============================================================
// Compétences Blood Bowl 2025 - Version FR officielle
// =============================================================
// Catégories :
//   G = Général       A = Agilité (Esquive)
//   F = Force         P = Passe
//   M = Mutation      S = Scélérates
// =============================================================

const SKILLS_BY_CATEGORY = {
  G: [
    'Blocage',
    'Intrépide',
    'Parade',
    'Frénésie',
    'Lutte',
    'Pro',
    'Frappe précise',
    'Rétablissement',
    'Appuis sûrs',
    'Arracher le ballon',
    'Prise sûre',
    'Tacle',
    'Provocation',
  ],
  A: [
    'Réception',
    'Réception plongeante',
    'Tacle Plongeant',
    'Défenseur',
    'Esquive',
    'Glissade Contrôlée',
    'Frappe-et-court',
    'Rétablissement',
    'Libération contrôlée',
    'Saut',
    'Sprint',
    'Equilibre',
  ],
  S: [
    'Joueur déloyal',
    'Fourchette',
    'Fumblerooski',
    'Vol Fatal',
    'Agresseur Solitaire',
    'Marteau-pilon',
    'Coup de crampons',
    'Agression éclair',
    'Saboteur',
    'Poursuite',
    'Sournois',
    'Innovateur Violent',
  ],
  P: [
    'Précision',
    'Perce-nuages',
    'Canionnier',
    'Délestage',
    'Transmission dans la course',
    'Passe désespérée',
    'Chef',
    'Nerfs d\'acier',
    'Sur le ballon',
    'Passe',
    'Dégagement',
    'Passe assurée',
  ],
  M: [
    'Bras Supplémentaire',
    'Cornes',
    'Main démesurée',
    'Présence perturbante',
    'Griffes',
    'Répulsion',
    'Peau de fer',
    'Grande Gueule',
    'Queue Préhensile',
    'Tentacules',
    'Très longues jambes',
    'Deux têtes',
  ],
  F: [
    'Clé de bras',
    'Bagarreur',
    'Esquive en force',
    'Dans le mille',
    'Projection',
    'Garde',
    'Juggernaut',
    'Châtaigne',
    'Blocage multiple',
    'Stabilité',
    'Bras musclé',
    'Crâne épais',
  ],
};

const STAT_INCREASES = [
  { key: 'ma', label: 'Mouvement +1 (MA)', cost: 30 },
  { key: 'av', label: 'Armure +1 (AV)', cost: 30 },
  { key: 'pa', label: 'Passe +1 (PA, -1 sur le dé)', cost: 20 },
  { key: 'ag', label: 'Agilité +1 (AG, -1 sur le dé)', cost: 40 },
  { key: 'st', label: 'Force +1 (ST)', cost: 80 },
];

const SKILL_CATEGORY_LABELS = {
  G: 'Général',
  A: 'Agilité',
  S: 'Force',
  P: 'Passe',
  M: 'Mutation',
  F: 'Fourbe',
};

// Coûts BB2025 pour ajout de skill
const SKILL_COST_PRIMARY = 20;    // accès primaire (catégorie "normal")
const SKILL_COST_SECONDARY = 40;  // accès secondaire (catégorie "double")

// Helper : récupérer toutes les skills accessibles à un positionnel
// Retourne un tableau enrichi { name, category, accessType, cost }
function getAvailableSkillsForPosition(position) {
  const result = [];
  const seen = new Set();

  // Skills primaires (accès normal)
  for (const cat of position.normal || []) {
    for (const skill of SKILLS_BY_CATEGORY[cat] || []) {
      const key = skill;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        name: skill,
        category: cat,
        categoryLabel: SKILL_CATEGORY_LABELS[cat],
        accessType: 'primary',
        cost: SKILL_COST_PRIMARY,
      });
    }
  }

  // Skills secondaires (accès double)
  for (const cat of position.double || []) {
    for (const skill of SKILLS_BY_CATEGORY[cat] || []) {
      const key = skill;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        name: skill,
        category: cat,
        categoryLabel: SKILL_CATEGORY_LABELS[cat],
        accessType: 'secondary',
        cost: SKILL_COST_SECONDARY,
      });
    }
  }

  // Tri : primaires d'abord, puis par catégorie, puis alphabétique
  result.sort((a, b) => {
    if (a.accessType !== b.accessType) return a.accessType === 'primary' ? -1 : 1;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });

  return result;
}

export {
  SKILLS_BY_CATEGORY,
  SKILL_CATEGORY_LABELS,
  STAT_INCREASES,
  SKILL_COST_PRIMARY,
  SKILL_COST_SECONDARY,
  getAvailableSkillsForPosition,
};
