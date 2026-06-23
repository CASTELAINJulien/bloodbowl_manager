// =============================================================
// Inducements BB2025 - Coups de Pouce officiels
// Source : Blood Bowl 2025 Core Rulebook
// =============================================================
// Champs :
//   key             : identifiant unique
//   label           : nom affiché (FR)
//   description     : effet en jeu
//   max             : nombre maximum
//   cost            : coût standard (en k)
//   discountedCost  : coût réduit si la special rule de la team le permet
//   discountRule    : nom de la règle qui donne droit au discount
//   discountedMax   : max augmenté si la règle s'applique
//   requiresRule    : si défini, l'inducement n'est dispo que pour ces règles
//   excludesRule    : exclu pour ces règles (ex: Apothicaire pour les morts-vivants)
//   excludesIf      : exclu si l'équipe a "apothecary: false"
// =============================================================
 
const INDUCEMENTS = [
  // ------- Inducements génériques (toutes équipes) -------
  {
    key: 'bribes',
    label: 'Pots-de-vin',
    max: 3, cost: 100,
    discountRule: 'Chantage et Corruption',
    discountedCost: 50, discountedMax: 6,
  },
  {
    key: 'bloodweiser_kegs',
    label: 'Fûts de Blitz Premium',
    max: 2, cost: 50,
  },
  {
    key: 'temp_agency_cheerleaders',
    label: 'Pom-pom girls intérimaires',
    max: 4, cost: 5,
  },
  {
    key: 'wizard',
    label: 'Sorcier Sportif',
    max: 1, cost: 150,
  },
  {
    key: 'wandering_apothecary',
    label: 'Apothicaire itinérant',
    max: 2, cost: 100,
    excludesIf: 'noApothecary',
  },
  {
    key: 'biased_referee',
    label: 'Arbitre partial',
    max: 1, cost: 120,
    discountRule: 'Chantage et Corruption',
    discountedCost: 80,
  },
  {
    key: 'mortuary_assistant',
    label: 'Assistant de morgue',
    max: 1, cost: 100,
    requiresRule: 'Maîtres de la Non-vie',
  },
  {
    key: 'plague_doctor',
    label: 'Médecin de la Peste',
    max: 1, cost: 100,
    requiresRule: 'Favoris de Nurgle',
  },
  {
    key: 'weather_mage',
    label: 'Mage Météo',
    max: 1, cost: 30,
  },
  {
    key: 'master_chef',
    label: 'Chef cuistot Halfling',
    max: 1, cost: 300,
    discountRule: 'Coupe Dé à Coudre Halfling',
    discountedCost: 100,
  },
  {
    key: 'cavorting_nurgling',
    label: 'Nurgling Bondissant',
    max: 1, cost: 30,
    requiresRule: 'Favoris de Nurgle',
  },
  {
    key: 'dwarven_runesmith',
    label: 'Forgerune Nain',
    max: 1, cost: 70,
    requiresRule: 'Classique du Vieux Monde',
  },
  {
    key: 'halfling_hot_pot',
    label: 'Marmite Halfling',
    max: 1, cost: 100,
    requiresRule: 'Coupe Dé à Coudre Halfling',
  },
  {
    key: 'nuffle_prayers',
    label: 'Prières à Nuffle',
    max: 3, cost: 10,
  },
  {
    key: 'team_mascot',
    label: 'Mascotte',
    max: 1, cost: 25,
  },
  {
    key: 'plucky_underdogs',
    label: 'Débutants Déchaînés',
    max: 1, cost: 150,
    requiresRule: 'Trois-Quarts à Vil Prix',
  },
];
 
// Helper : retourne les inducements disponibles pour une équipe donnée
function getAvailableInducements(roster) {
  const teamRules = roster.specialRules || [];
  const noApo = !roster.apothecary;
 
  return INDUCEMENTS.filter(ind => {
    // Exclu si l'équipe n'a pas d'apothicaire (mort-vivants etc.)
    if (ind.excludesIf === 'noApothecary' && noApo) return false;
 
    // Restreint à certaines special rules
    if (ind.requiresRule && !teamRules.some(r => r.includes(ind.requiresRule))) return false;
 
    // Exclu pour certaines special rules
    if (ind.excludesRules && ind.excludesRules.some(r =>
      teamRules.some(tr => tr.includes(r))
    )) return false;
 
    return true;
  }).map(ind => {
    // Calcul du discount applicable
    const hasDiscount = ind.discountRule && teamRules.some(r => r.includes(ind.discountRule));
    return {
      ...ind,
      effectiveCost: hasDiscount ? ind.discountedCost : ind.cost,
      effectiveMax: hasDiscount && ind.discountedMax ? ind.discountedMax : ind.max,
      hasDiscount,
    };
  });
}
 
export { INDUCEMENTS, getAvailableInducements };
