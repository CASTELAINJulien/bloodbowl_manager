// =============================================================
// Rosters Blood Bowl 2020 - Données officielles
// Format inspiré de bbtc.pl
// =============================================================
// Pour chaque race :
// - max : nombre max d'équipe (16 par défaut sur la plupart)
// - rerollCost : coût d'un re-roll en k
// - tier : tier de la race (1, 2, 3) pour info
// - positions : liste des positionnels
//   - title : nom du poste (ex: Lineman, Blitzer)
//   - max : nombre max sur la feuille
//   - cost : coût en k
//   - ma, st, ag, pa, av : stats (PA = '-' si pas de passe)
//   - skills : skills de base
//   - normal : catégories d'accès en skill normal
//   - double : catégories d'accès en double
// =============================================================

const ROSTERS = {
  // ============== HUMANS ==============
  human: {
    name: 'Humans',
    tier: 1,
    rerollCost: 50,
    apothecary: true,
    positions: [
      {
        title: 'Lineman',
        max: 16, cost: 50,
        ma: 6, st: 3, ag: 3, pa: 4, av: 9,
        skills: [],
        normal: ['G'], double: ['A','S','P'],
      },
      {
        title: 'Catcher',
        max: 4, cost: 65,
        ma: 8, st: 2, ag: 3, pa: 5, av: 8,
        skills: ['Catch','Dodge'],
        normal: ['G','A'], double: ['S','P'],
      },
      {
        title: 'Thrower',
        max: 2, cost: 75,
        ma: 6, st: 3, ag: 3, pa: 3, av: 9,
        skills: ['Pass','Sure Hands'],
        normal: ['G','P'], double: ['A','S'],
      },
      {
        title: 'Blitzer',
        max: 4, cost: 85,
        ma: 7, st: 3, ag: 3, pa: 4, av: 9,
        skills: ['Block'],
        normal: ['G','S'], double: ['A','P'],
      },
      {
        title: 'Halfling Hopeful',
        max: 3, cost: 30,
        ma: 5, st: 2, ag: 3, pa: 4, av: 7,
        skills: ['Dodge','Right Stuff','Stunty'],
        normal: ['A'], double: ['G','S','P'],
      },
      {
        title: 'Ogre',
        max: 1, cost: 140,
        ma: 5, st: 5, ag: 4, pa: 5, av: 10,
        skills: ['Loner (4+)','Bone Head','Mighty Blow (+1)','Thick Skull','Throw Team-mate'],
        normal: ['S'], double: ['G','A','P'],
      },
    ],
  },

  // ============== ORCS ==============
  orc: {
    name: 'Orcs',
    tier: 1,
    rerollCost: 60,
    apothecary: true,
    positions: [
      {
        title: 'Lineman',
        max: 16, cost: 50,
        ma: 5, st: 3, ag: 3, pa: 4, av: 10,
        skills: [],
        normal: ['G'], double: ['A','S','P'],
      },
      {
        title: 'Goblin',
        max: 4, cost: 40,
        ma: 6, st: 2, ag: 3, pa: 4, av: 8,
        skills: ['Dodge','Right Stuff','Stunty'],
        normal: ['A'], double: ['G','S','P'],
      },
      {
        title: 'Thrower',
        max: 2, cost: 75,
        ma: 5, st: 3, ag: 3, pa: 3, av: 10,
        skills: ['Pass','Sure Hands'],
        normal: ['G','P'], double: ['A','S'],
      },
      {
        title: 'Blitzer',
        max: 4, cost: 85,
        ma: 6, st: 3, ag: 3, pa: 5, av: 10,
        skills: ['Block'],
        normal: ['G','S'], double: ['A','P'],
      },
      {
        title: 'Big Un',
        max: 4, cost: 90,
        ma: 4, st: 4, ag: 4, pa: 5, av: 10,
        skills: [],
        normal: ['G','S'], double: ['A','P'],
      },
      {
        title: 'Troll',
        max: 1, cost: 115,
        ma: 4, st: 5, ag: 4, pa: 5, av: 10,
        skills: ['Loner (4+)','Always Hungry','Mighty Blow (+1)','Really Stupid','Regeneration','Throw Team-mate'],
        normal: ['S'], double: ['G','A','P'],
      },
    ],
  },

  // ============== DWARFS ==============
  dwarf: {
    name: 'Dwarfs',
    tier: 1,
    rerollCost: 50,
    apothecary: true,
    positions: [
      {
        title: 'Blocker',
        max: 16, cost: 70,
        ma: 4, st: 3, ag: 4, pa: 4, av: 10,
        skills: ['Block','Tackle','Thick Skull'],
        normal: ['G','S'], double: ['A','P'],
      },
      {
        title: 'Runner',
        max: 2, cost: 80,
        ma: 6, st: 3, ag: 3, pa: 3, av: 9,
        skills: ['Sure Hands','Thick Skull'],
        normal: ['G','P'], double: ['A','S'],
      },
      {
        title: 'Blitzer',
        max: 2, cost: 85,
        ma: 5, st: 3, ag: 3, pa: 4, av: 10,
        skills: ['Block','Thick Skull'],
        normal: ['G','S'], double: ['A','P'],
      },
      {
        title: 'Troll Slayer',
        max: 2, cost: 90,
        ma: 5, st: 3, ag: 3, pa: 5, av: 9,
        skills: ['Block','Dauntless','Frenzy','Thick Skull'],
        normal: ['G','S'], double: ['A','P'],
      },
      {
        title: 'Deathroller',
        max: 1, cost: 160,
        ma: 4, st: 7, ag: 4, pa: 6, av: 11,
        skills: ['Loner (4+)','Break Tackle','Dirty Player (+1)','Juggernaut','Mighty Blow (+1)','No Hands','Secret Weapon','Stand Firm'],
        normal: ['S'], double: ['G','A','P'],
      },
    ],
  },

  // ============== ELVEN UNION ==============
  elven_union: {
    name: 'Elven Union',
    tier: 1,
    rerollCost: 50,
    apothecary: true,
    positions: [
      {
        title: 'Lineman',
        max: 16, cost: 60,
        ma: 6, st: 3, ag: 4, pa: 4, av: 8,
        skills: [],
        normal: ['G','A'], double: ['S','P'],
      },
      {
        title: 'Thrower',
        max: 2, cost: 75,
        ma: 6, st: 3, ag: 4, pa: 2, av: 8,
        skills: ['Pass'],
        normal: ['G','A','P'], double: ['S'],
      },
      {
        title: 'Catcher',
        max: 4, cost: 100,
        ma: 8, st: 3, ag: 4, pa: 5, av: 8,
        skills: ['Catch','Nerves of Steel'],
        normal: ['G','A'], double: ['S','P'],
      },
      {
        title: 'Blitzer',
        max: 2, cost: 115,
        ma: 7, st: 3, ag: 4, pa: 5, av: 9,
        skills: ['Block','Side Step'],
        normal: ['G','A'], double: ['S','P'],
      },
    ],
  },

  // ============== WOOD ELVES ==============
  wood_elf: {
    name: 'Wood Elves',
    tier: 1,
    rerollCost: 50,
    apothecary: true,
    positions: [
      {
        title: 'Lineman',
        max: 16, cost: 70,
        ma: 7, st: 3, ag: 4, pa: 4, av: 8,
        skills: [],
        normal: ['G','A'], double: ['S','P'],
      },
      {
        title: 'Catcher',
        max: 4, cost: 100,
        ma: 8, st: 2, ag: 4, pa: 5, av: 8,
        skills: ['Catch','Dodge','Sprint'],
        normal: ['G','A'], double: ['S','P'],
      },
      {
        title: 'Thrower',
        max: 2, cost: 90,
        ma: 7, st: 3, ag: 4, pa: 2, av: 8,
        skills: ['Pass'],
        normal: ['G','A','P'], double: ['S'],
      },
      {
        title: 'Wardancer',
        max: 2, cost: 120,
        ma: 8, st: 3, ag: 4, pa: 4, av: 8,
        skills: ['Block','Dodge','Leap'],
        normal: ['G','A'], double: ['S','P'],
      },
      {
        title: 'Treeman',
        max: 1, cost: 120,
        ma: 2, st: 6, ag: 5, pa: 5, av: 11,
        skills: ['Loner (4+)','Mighty Blow (+1)','Stand Firm','Strong Arm','Take Root','Thick Skull','Throw Team-mate'],
        normal: ['S'], double: ['G','A','P'],
      },
    ],
  },

  // ============== SKAVEN ==============
  skaven: {
    name: 'Skaven',
    tier: 1,
    rerollCost: 60,
    apothecary: true,
    positions: [
      {
        title: 'Lineman',
        max: 16, cost: 50,
        ma: 7, st: 3, ag: 3, pa: 4, av: 8,
        skills: [],
        normal: ['G'], double: ['A','S','P'],
      },
      {
        title: 'Thrower',
        max: 2, cost: 80,
        ma: 7, st: 3, ag: 3, pa: 2, av: 8,
        skills: ['Pass','Sure Hands'],
        normal: ['G','P'], double: ['A','S'],
      },
      {
        title: 'Gutter Runner',
        max: 4, cost: 80,
        ma: 9, st: 2, ag: 4, pa: 4, av: 8,
        skills: ['Dodge'],
        normal: ['G','A'], double: ['S','P'],
      },
      {
        title: 'Blitzer',
        max: 2, cost: 90,
        ma: 7, st: 3, ag: 3, pa: 4, av: 9,
        skills: ['Block'],
        normal: ['G','S'], double: ['A','P'],
      },
      {
        title: 'Rat Ogre',
        max: 1, cost: 150,
        ma: 6, st: 5, ag: 4, pa: 6, av: 9,
        skills: ['Loner (4+)','Frenzy','Mighty Blow (+1)','Prehensile Tail','Wild Animal'],
        normal: ['S'], double: ['G','A','P'],
      },
    ],
  },

  // ============== LIZARDMEN ==============
  lizardmen: {
    name: 'Lizardmen',
    tier: 1,
    rerollCost: 60,
    apothecary: true,
    positions: [
      {
        title: 'Skink Runner',
        max: 16, cost: 60,
        ma: 8, st: 2, ag: 3, pa: 4, av: 8,
        skills: ['Dodge','Stunty'],
        normal: ['A'], double: ['G','S','P'],
      },
      {
        title: 'Saurus Blocker',
        max: 6, cost: 85,
        ma: 6, st: 4, ag: 5, pa: 6, av: 10,
        skills: [],
        normal: ['G','S'], double: ['A','P'],
      },
      {
        title: 'Chameleon Skink',
        max: 2, cost: 70,
        ma: 7, st: 2, ag: 3, pa: 4, av: 8,
        skills: ['Dodge','On the Ball','Shadowing','Stunty'],
        normal: ['A'], double: ['G','S','P'],
      },
      {
        title: 'Kroxigor',
        max: 1, cost: 140,
        ma: 6, st: 5, ag: 5, pa: 6, av: 10,
        skills: ['Loner (4+)','Bone Head','Mighty Blow (+1)','Prehensile Tail','Thick Skull'],
        normal: ['S'], double: ['G','A','P'],
      },
    ],
  },

  // ============== CHAOS CHOSEN ==============
  chaos_chosen: {
    name: 'Chaos Chosen',
    tier: 1,
    rerollCost: 60,
    apothecary: true,
    positions: [
      {
        title: 'Beastman Runner Lineman',
        max: 12, cost: 60,
        ma: 6, st: 3, ag: 3, pa: 4, av: 9,
        skills: ['Horns'],
        normal: ['G','S'], double: ['A','P'],
      },
      {
        title: 'Chosen Blocker',
        max: 4, cost: 100,
        ma: 5, st: 4, ag: 4, pa: 5, av: 10,
        skills: [],
        normal: ['G','S','M'], double: ['A','P'],
      },
      {
        title: 'Chaos Ogre',
        max: 1, cost: 140,
        ma: 5, st: 5, ag: 4, pa: 5, av: 10,
        skills: ['Loner (4+)','Bone Head','Mighty Blow (+1)','Thick Skull','Throw Team-mate'],
        normal: ['S'], double: ['G','A','P','M'],
      },
      {
        title: 'Minotaur',
        max: 1, cost: 150,
        ma: 5, st: 5, ag: 4, pa: 6, av: 9,
        skills: ['Loner (4+)','Frenzy','Horns','Mighty Blow (+1)','Thick Skull','Wild Animal'],
        normal: ['S'], double: ['G','A','P','M'],
      },
    ],
  },

  // ============== HALFLING ==============
  halfling: {
    name: 'Halflings',
    tier: 3,
    rerollCost: 60,
    apothecary: true,
    positions: [
      {
        title: 'Hopeful',
        max: 16, cost: 30,
        ma: 5, st: 2, ag: 3, pa: 4, av: 7,
        skills: ['Dodge','Right Stuff','Stunty'],
        normal: ['A'], double: ['G','S','P'],
      },
      {
        title: 'Hefty',
        max: 4, cost: 50,
        ma: 5, st: 3, ag: 4, pa: 5, av: 8,
        skills: ['Fend','Stunty','Thick Skull'],
        normal: ['G','A'], double: ['S','P'],
      },
      {
        title: 'Catcher',
        max: 2, cost: 65,
        ma: 7, st: 2, ag: 3, pa: 4, av: 7,
        skills: ['Catch','Dodge','Sprint','Stunty'],
        normal: ['A'], double: ['G','S','P'],
      },
      {
        title: 'Treeman',
        max: 2, cost: 120,
        ma: 2, st: 6, ag: 5, pa: 5, av: 11,
        skills: ['Loner (4+)','Mighty Blow (+1)','Stand Firm','Strong Arm','Take Root','Thick Skull','Throw Team-mate'],
        normal: ['S'], double: ['G','A','P'],
      },
    ],
  },

  // ============== UNDEAD ==============
  shambling_undead: {
    name: 'Shambling Undead',
    tier: 1,
    rerollCost: 70,
    apothecary: false,
    positions: [
      {
        title: 'Skeleton',
        max: 16, cost: 40,
        ma: 5, st: 3, ag: 3, pa: 5, av: 9,
        skills: ['Regeneration','Thick Skull'],
        normal: ['G'], double: ['A','S','P'],
      },
      {
        title: 'Zombie',
        max: 16, cost: 40,
        ma: 4, st: 3, ag: 3, pa: 5, av: 9,
        skills: ['Regeneration'],
        normal: ['G'], double: ['A','S','P'],
      },
      {
        title: 'Ghoul Runner',
        max: 4, cost: 75,
        ma: 7, st: 3, ag: 3, pa: 4, av: 8,
        skills: ['Dodge'],
        normal: ['G','A'], double: ['S','P'],
      },
      {
        title: 'Wight Blitzer',
        max: 2, cost: 90,
        ma: 6, st: 3, ag: 3, pa: 4, av: 10,
        skills: ['Block','Regeneration'],
        normal: ['G','S'], double: ['A','P'],
      },
      {
        title: 'Mummy',
        max: 2, cost: 120,
        ma: 3, st: 5, ag: 4, pa: 6, av: 10,
        skills: ['Mighty Blow (+1)','Regeneration'],
        normal: ['S'], double: ['G','A','P'],
      },
    ],
  },
};

const STAR_PLAYERS_NOTE =
  'Les Star Players sont gérés via les inducements (à venir).';

// Sideline Staff communs à toutes les races
const SIDELINE_STAFF = {
  reroll: { label: 'Re-roll', max: 8, useRosterCost: true }, // coût = roster.rerollCost
  apothecary: { label: 'Apothecary', max: 1, cost: 50, requireApothecary: true },
  assistant_coaches: { label: 'Assistant coaches', max: 6, cost: 10 },
  cheerleaders: { label: 'Cheerleaders', max: 6, cost: 10 },
  dedicated_fans: { label: 'Dedicated fans', max: 6, cost: 10, min: 1 },
};

// Catégories de skills pour info
const SKILL_CATEGORIES = {
  G: 'General',
  A: 'Agility',
  S: 'Strength',
  P: 'Passing',
  M: 'Mutation',
};

export { ROSTERS, SIDELINE_STAFF, SKILL_CATEGORIES };
