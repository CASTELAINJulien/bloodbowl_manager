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
      'Solitaire (4+)', 'Sans ballon', 'Glissade contrôlée', 'Minus', 'Microbe',
    ],
    specialRules: [
      'Rage Aveugle : Akhorne a le droit de relancer le D6 lors du jet pour la compétence Intrépide.',
    ],
    cost: 80, // en k
    leagues: ['Bagarre des Terres Arides','Super-Ligue du Bord du Monde','Classique du Vieux Monde','Ligue des Royaumes Elfiques','Défi des Bas-Fonds', 'Coupe du Dé à Coudre Halfling','Super-Ligue de Lustrie','Spot de Sylvanie','Clash du Chaos','Ligue Sylvestre'], // disponible dans toutes les leagues — à restreindre si besoin
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
    leagues: ['Classique du Vieux Monde', 'Coupe du Dé à Coudre Halfling',
    ], 
  },
  {
    key: 'comte_luthor_von_drakenborg',
    name: "Comte Luthor Von Drakenborg",
    ma: 6, st: 5, ag: 2, pa: '2', av: 10,
    skills: [
      'Blocage', 'Glissade contrôlée', 'Regard hypnotique', 'Régénération', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Star du Show : Une fois par match, quand le Comte Luthor marque un TouchDown, son coach gagne 1 relance d\'équipe jusqu\'à la fin de la phase suivante. Si cette relance d\'équipe n\'est pas utilisée avant la fin de la phase suivante, elle est perdue',
    ],
    cost: 300, // en k
    leagues: ['Spot de Sylvanie',
    ], 
  },
  {
    key: 'deeproot_strongbranch',
    name: "Deeproot Strongbranch",
    ma: 2, st: 7, ag: 5, pa: '4', av: 11,
    skills: [
      'Blocage', 'Bras musclé', 'Châtaigne', 'Crane épais', 'Dans le mille', 'Lancer de coéquipier', 'Stabilité', 'Timmm-ber!', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Fiable : Si Deeproot fait une maladresse sur Lancer quand il effectue une action de lancer de coéquiper, le joueur lancé rebondit normalement mais atterit automatiquement sans mal.',
    ],
    cost: 280, // en k
    leagues: ['Ligue Sylvestre',
    ], 
  },
  {
    key: 'eldril_sidewinder',
    name: "Eldril Sidewinder",
    ma: 8, st: 3, ag: 2, pa: '3', av: 8,
    skills: [
      'Esquive', 'Nerfs d\'acier', 'Réception', 'Regard hypnotique', 'Sur le ballon', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Danse Hypnotisante : Une fois par mi-temps, Eldril peut relancer le dé quand il effectue une action spéciale de regard hypnotique.',
    ],
    cost: 220, // en k
    leagues: ['Ligue des Royaumes Elfiques',
    ], 
  },
  {
    key: 'estelle_la_veneaux',
    name: "Estelle la Veneaux",
    ma: 6, st: 3, ag: 3, pa: '4', av: 8,
    skills: [
      'Esquive', 'Garde', 'Glissade contrôlée', 'Présence perturbante', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Malédiction Funeste : Une fois par match, au début de l\'activation d\'Estelle, elle a le droit de choisir un joueur adverse à 5 cases ou moins d\'elle puis de jeter un D6. Sur 2+, le joueur choisi devient déconcentré et il ne peut pas être activé au tour suivant.',
    ],
    cost: 190, // en k
    leagues: ['Super Ligue de Lustrie',
    ], 
  },
  {
    key: 'fungus_le_cinglé',
    name: "Fungus le Cinglé",
    ma: 4, st: 7, ag: 3, pa: '-', av: 8,
    skills: [
      'Arme secrète', 'Chaîne et boulet', 'Châtaigne', 'Minus', 'Sans ballon','Solitaire (4+)', 
    ],
    specialRules: [
      'Derviche Tourbillonant : Une fois par activation, Fungus peut relancer le D6 quand il détermine dans quelle direction il se déplace',
    ],
    cost: 80, // en k
    leagues: ['Bagarre des Terres Arides', 'Défi des Bas-Fonds',
    ], 
  },
  {
    key: 'glart_smashrip',
    name: "Glart Smashrip",
    ma: 5, st: 4, ag: 4, pa: '6', av: 9,
    skills: [
      'Blocage', 'Griffes', 'Juggernaut', 'Projection', 'Stabilité','Solitaire (4+)', 
    ],
    specialRules: [
      'Ruée Frénétique : Une fois par mi-temps, quand Glart déclare une action de Blitz, il peut gagner la compétence Frénésie jusqu\'à la fin de son activation. Glart ne peut pas utiliser la compétence Projection à un tour auquel il utilise cette règle spéciale.',
    ],
    cost: 175, // en k
    leagues: ['Défi des Bas-Fonds',
    ], 
  },
  {
    key: 'gloriel_summerbloom',
    name: "Gloriel Summerbloom",
    ma: 7, st: 2, ag: 2, pa: '2', av: 8,
    skills: [
      'Esquive', 'Glissade contrôlée', 'Passe', 'Précision', 'Prise sûre', 'Solitaire (3+)', 
    ],
    specialRules: [
      'Tout ou Rien : Une fois par match, quand Gloriel est activée, elle peut utiliser cette règle spéciale. En ce cas, Gloriel gagne la compétence passe désespérée jusqu\'à la fin de son activation.',
    ],
    cost: 150, // en k
    leagues: ['Ligue des Royaumes Elfiques',
    ], 
  },
  {
    key: 'glotl_stop',
    name: "Glotl Stop",
    ma: 6, st: 6, ag: 5, pa: '6', av: 10,
    skills: [
      'Châtaigne', 'Crane épais', 'Frénésie', 'Queue préhensile', 'Sauvagerie animale', 'Stabilité', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Sauvagerie Primordiale : Une fois par match, quand Glotl rate un jet de Sauvagerie Animale, il peut s\'en prendre à un joueur adverse plutôt qu\'à un coéquipier.',
    ],
    cost: 260, // en k
    leagues: ['Super Ligue de Lustrie',
    ], 
  },
  {
    key: 'gobbo_le_noir',
    name: "Gobbo le Noir",
    ma: 6, st: 2, ag: 3, pa: '3', av: 8,
    skills: [
      'Bombardier', 'Esquive', 'Glissade contrôlée', 'Minus', 'Poignard', 'Présence perturbante', 'Sournois', 'Solitaire (3+)', 
    ],
    specialRules: [
      'Le plus sournois de tous : Si votre équipe inclut Gobbo le Noir, vous pouvez déclarer deux actions d\'agression par tour au lieu d\'une. Cependant, l\'une d\'elles doit être déclarée par Gobbo le Noir lui-même',
    ],
    cost: 210, // en k
    leagues: ['Bagarre des Terres Arides', 'Défi des Bas-Fonds',
    ], 
  },
  {
    key: 'grashnak_backhoof',
    name: "Grashnak Backhoof",
    ma: 6, st: 6, ag: 4, pa: '6', av: 9,
    skills: [
      'Châtaigne', 'Cornes', 'Crâne épais', 'Frénésie', 'Fureur débridée', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Encorné par le taureau : Une fois par match, quand Grashnak effectue une action de blocage dans le cadre d\'une action de Blitz, il peut lancer 1 dé de blocage supplémentaire contre le joueur adverse quelle que soit sa Force, jusqu\'à un maximum de 3 dés de blocage. Si Grashnak effectue une seconde Action de Blocage en raison de la compétence Frénésie, la seconde action de blocage bénéficie aussi de cette règle.',
    ],
    cost: 240, // en k
    leagues: ['Clash du Chaos',
    ], 
  },
  {
    key: 'gretchen_watcer',
    name: "Gretchen Wätcher",
    ma: 7, st: 3, ag: 2, pa: '-', av: 9,
    skills: [
      'Esquive', 'Glissade contrôlée', 'Poursuite', 'Présence perturbante', 'Régénération', 'Répulsion', 'Rétablissement', 'Sans ballon', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Ethérée : Une fois par match, quand Gretchen est activée, elle peut utiliser cette règle spéciale. Jusqu\'à la fin de son activation, Gretchen n\'a pas à faire de jet d\'esquive pour quitter une case dans la zone de tacle d\'un joueur adverse.',
    ],
    cost: 180, // en k
    leagues: ['Spot de Sylvanie',
    ], 
  },
  {
    key: 'griff_oberwald',
    name: "Griff Oberwald",
    ma: 7, st: 4, ag: 2, pa: '3', av: 9,
    skills: [
      'Blocage', 'Esquive', 'Equilibre', 'Parade', 'Sprint', 'Solitaire (3+)', 
    ],
    specialRules: [
      'Grand professionnel : Une fois par match, Griff peut appliquer un modificateur de +1 à un test d\'Agilité qu\'il a fait. Ce modificateur peut être appliqué après avoir fait le jet.',
    ],
    cost: 300, // en k
    leagues: ['Classique du Vieux Monde',
    ], 
  },
  {
    key: 'grim_ironjaw',
    name: "Grim Ironjaw",
    ma: 5, st: 4, ag: 3, pa: '6', av: 9,
    skills: [
      'Blocage', 'Blocage multiple', 'Crâne épais', 'Frénésie', 'Haine (Big Guy)', 'Intrépide', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Tueur : Une fois par match, quand un Gros Bras adverse est plaqué suite à une action de blocage effectuée par Grim, vous pouvez appliquer un modificateur de +1 au jet d\'armure ou au jet de blessure. Ce modificateur peut être appliqué après avoir fait le jet.',
    ],
    cost: 200, // en k
    leagues: ['Super Ligue du Bord du Monde',
    ], 
  },
  {
    key: 'grombrindal',
    name: "Grombrindal",
    ma: 5, st: 3, ag: 3, pa: '4', av: 10,
    skills: [
      'Blocage', 'Châtaigne', 'Crâne épais', 'Equilibre', 'Esquive en force', 'Intrépide', 'Stabilité', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Sagesse du Nain Blanc : Une fois par match, quand Grombrindal est activé, il peut choisir un coéquipier à 2 cases ou moins. Ce coéquipier gagne une des compétences suivantes jusqu\'à la fin du tour : Châtaigne, équilibre, esquive en force, Intrépide',
    ],
    cost: 170, // en k
    leagues: ['Super Ligue du Bord du Monde', 'Classique du Vieux Monde', 'Coupe du Dé à Coudre Halfling',
    ], 
  },
  {
    key: 'guffle_pusmaw',
    name: "Guffle Pusmaw",
    ma: 5, st: 4, ag: 4, pa: '6', av: 10,
    skills: [
      'Contagieux', 'Grande gueule', 'Nerfs d\'acier', 'Répulsion', 'Sur le ballon', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Cass-croûte : Une fois par match, si Guffle marque un joueur adverse qui réceptionne le ballon, il peut faire immédiatement un jet d\'armure contre le joueur. Si l\'armure de la cible est pénétrée, Guffle prend immédiatement possession du ballon. Aucun turnover ne survient suite à l\'usage de cette règle spéciale.',
    ],
    cost: 150, // en k
    leagues: ['Favoris de Nurgle',
    ], 
  },
  {
    key: 'hthark_limplacable',
    name: "H'thark l'Implacable",
    ma: 6, st: 6, ag: 4, pa: '6', av: 10,
    skills: [
      'Blocage', 'Crâne épais', 'Défenseur', 'Equilibre', 'Esquive en force', 'Instable', 'Juggernaut', 'Sprint', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Elan implacable : Chaque fois que H\'thark effectue une action de blocage dans le cadre d\'une action de Blitz, il peut relancer un unique dé de blocage.',
    ],
    cost: 300, // en k
    leagues: ['Bagarre des Terres Arides', 'Favoris de Hashut',
    ], 
  },
  {
    key: 'hakflem_skuttlespike',
    name: "Hakflem Skuttlespike",
    ma: 8, st: 3, ag: 2, pa: '3', av: 8,
    skills: [
      'Bras supplémentaire', 'Deux têtes', 'Esquive', 'Queue préhensile', 'Solitaire (4+)', 
    ],
    specialRules: [
      'Traître : Une fois par match, Si Hakflem est adjacent à un coéquipier qui est en possession du ballon quand il est activé, Hakflem a le droit d\'entrer en possession du ballon. S\'il le fait, le coéquipier est immédiatement plaqué. Cela n\'entraine pas de turnover même si le coéquipier est éliminé.',
    ],
    cost: 200, // en k
    leagues: ['Défi des Bas-Fonds',
    ], 
  },
  {
    key: 'helmut_wulf',
    name: "Helmut Wulf",
    ma: 6, st: 3, ag: 3, pa: '-', av: 9,
    skills: [
      'Arme secrète', 'Pro', 'Sans ballon', 'Stabilité', 'Tronçonneuse', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Vieux pro : Une fois par match, Helmut peut utiliser sa compétence Pro pour relancer un unique dé d'un jet d'armure.",
    ],
    cost: 140, // en k
    leagues: ['Classique du Vieux Monde',
    ], 
  },
  {
    key: 'ivan_deathshroud',
    name: "Ivan \"L'animal\" Deathshroud",
    ma: 6, st: 4, ag: 4, pa: '5', av: 9,
    skills: [
      'Arracher le ballon', 'Blocage', 'Haine (Nains)', 'Juggernaut', 'Présence perturbante', 'Régénération', 'Tacle', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Fléau des nains : Une fois par match, quand un joueur adverse est plaqué suite à une action de blocage effectuée par Ivan, vous pouvez appliquer un modificateur supplémentaire de +1 au jet d'armiue ou au jet de blessure. Si c'est contre un joueur Nain, ce peut être un modificateur de +2 à la place.",
    ],
    cost: 210, // en k
    leagues: ['Spot de Sylvanie',
    ], 
  },
  {
    key: 'ivar_eriksson',
    name: "Ivar Eriksson",
    ma: 6, st: 4, ag: 3, pa: '4', av: 9,
    skills: [
      'Blocage', 'Garde', 'Tacle', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Maraudage : Une fois par phase, quand Ivar commence son activation, il peut choisir un coéquipier démarqué à 5 cases ou moins. Le joueur choisi peut immédiatement se déplacer d'une case, mais à l'issue de ce déplacement il doit marquer un joueur adverse.",
    ],
    cost: 215, // en k
    leagues: ['Classique du Vieux Monde',
    ], 
  },
  {
    key: 'jeremiah_kool',
    name: "Jeremiah Kool",
    ma: 8, st: 3, ag: 1, pa: '2', av: 9,
    skills: [
      'Blocage', 'Délestage', 'Esquive', 'Glissade contrôlée', 'Nerfs d\'acier', 'Passe', 'Réception plongeante', 'Sur le ballon', 'Solitaire (4+)', 
    ],
    specialRules: [
      "La lame éclair : Une fois par match, au début de son activation, Jeremiah peut annoncer une action spéciale de Poignard contre un joueur adverse qu'il marque. Après avoir fait cette action spéciale, Jeremiah peut ensuite effectuer une action de Mouvement avant que son activation prenne fin.",
    ],
    cost: 300, // en k
    leagues: ['Ligue des Royaumes Elfiques',
    ], 
  },
  {
    key: 'jordell_freshbreeze',
    name: "Jordell Freshbreeze",
    ma: 8, st: 3, ag: 1, pa: '3', av: 8,
    skills: [
      'Appuis sûrs', 'Blocage', 'Esquive', 'Glissade contrôlée', 'Réception plongeante', 'Saut', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Vif comme la bise : Une fois par match, Jordell a le droit de réussir un seul test d'Esquive, de Saut ou de Foncer sur 2+ quels que soient les modificateurs.",
    ],
    cost: 280, // en k
    leagues: ['Ligue des Royaumes Elfiques', 'Ligue Sylvestre'
    ], 
  },
  {
    key: 'josef_bugman',
    name: "Josef Bugman",
    ma: 5, st: 3, ag: 3, pa: '4', av: 9,
    skills: [
      'Blocage', 'Crâne épais', 'Ivrogne', 'Parade', 'Provocation', 'Tacle', 'Solitaire (3+)', 
    ],
    specialRules: [
      "Robustesse des nains : Une fois par match, quand on pénètre l'armure de Josef suite à un jet d'armure, vous avez le droit de faire relancer le jet d'armure.",
    ],
    cost: 180, // en k
    leagues: ['Super Ligue du Bord du Monde', 'Classique du Vieux Monde'
    ], 
  },
  {
    key: 'karla_von_kill',
    name: "Karla von Kill",
    ma: 6, st: 4, ag: 3, pa: '3', av: 9,
    skills: [
      'Blocage', 'Esquive', 'Intrépide', 'Rétablissement', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Indomptable : Une fois par match, quand Karla réussit son jet pour la compétence intrépide, elle peut augmenter sa caractéristique de Force afin qu'elle soit le double de celle de la cible de l'action de Blocage.",
    ],
    cost: 210, // en k
    leagues: ['Classique du Vieux Monde', 'Super Ligue de Lustrie'
    ], 
  },
  {
    key: 'kiroth_krakeneye',
    name: "Kiroth Krakeneye",
    ma: 7, st: 3, ag: 2, pa: '3', av: 8,
    skills: [
      'Présence perturbante', 'Répulsion', 'Sur le ballon', 'Tacle', 'Tentacules', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Encre noire : Une fois par match, au début de n'importe laquelle de ses activations, Kiroth a le droit de choisir un joueur adverse qu'il marque. Le joueur choisit devient Déconcentré jusqu'à sa prochaine activation.",
    ],
    cost: 160, // en k
    leagues: ['Ligue des Royaumes Elfiques',
    ], 
  },
  {
    key: 'kreek_rustgouger',
    name: "Kreek Rustgouger",
    ma: 4, st: 7, ag: 4, pa: '-', av: 10,
    skills: [
      'Arme secrète', 'Chaîne et boulet', 'Châtaigne', 'Queue préhensile', 'Sans ballon', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Je reviendrai ! : La première fois pendant le match où Kreek est censé être explusé en raison du Trait Arme Secrète, il ne l'est pas et peut continuer à prendre part au match. Le coach de Kreek ne peut pas contester la décision quand Kreek utilise cette règle spéciale.",
    ],
    cost: 180, // en k
    leagues: ['Défi des Bas-Fonds',
    ], 
  },
  {
    key: 'lord_borak_le_destructeur',
    name: "Lord Borak le Destructeur",
    ma: 5, st: 5, ag: 3, pa: '5', av: 10,
    skills: [
      'Blocage', 'Châtaigne', 'Chef', 'Coup de crampons', 'Joueur déloyal', 'Sournois', 'Solitaire (3+)', 
    ],
    specialRules: [
      "Seigneur du Chaos : Une fois par match, quand Lord Borak effectue une action de blocage, il peut relancer un unique dé de blocage.",
    ],
    cost: 270, // en k
    leagues: ['Clash du Chaos',
    ], 
  },
  {
    key: 'max_spleenripper',
    name: "Max Spleenripper",
    ma: 5, st: 4, ag: 4, pa: '-', av: 9,
    skills: [
      'Arme secrète', 'Sans ballon', 'Tronçonneuse', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Carnage maximal : Une fois par match, après que Max ait effectué une action spéciale de tronçonneuse, il peut immédiatement effectuer une autre action spéciale de tronçonneuse qui cible un joueur adverse différent.",
    ],
    cost: 130, // en k
    leagues: ['Favoris de Khorne',
    ], 
  },
  {
    key: 'morg_n_thorg',
    name: "Morg'n'Thorg",
    ma: 6, st: 6, ag: 3, pa: '4', av: 11,
    skills: [
      'Blocage', 'Châtaigne', 'Crâne épais', 'Dans le mille', 'Haine (Morts Vivants)', 'Lancer de coéquipier', 'Solitaire (4+)', 
    ],
    specialRules: [
      "La Baliste : Une fois par match, quand Morg effectue une action de Lancer de Coéquipier, il peut relancer le test de capacité de passe.",
    ],
    cost: 340, // en k
    leagues: ['Bagarre des Terres Arides', 'Super Ligue du Bord du Monde', 'Classique du Vieux Monde', 'Ligue des Royaumes Elfiques', 'Défi des Bas-Fonds', 'Coupe du Dé à Coudre Halfling', 'Super Ligue de Lustrie', 'Clash du Chaos', 'Ligue Sylvestre',
    ], 
  },
  {
    key: 'nobbla_blackwart',
    name: "Nobbla Blackwart",
    ma: 6, st: 2, ag: 3, pa: '-', av: 8,
    skills: [
      'Arme secrète', 'Blocage', 'Esquive', 'Minus', 'Saboteur', 'Sans ballon', 'Tronçonneuse', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Fô les kogner tant k'ils sont à terre ! : Une fois par match, Nobbla peut utiliser l'action spéciale d'attaque de tronçonneuse contre un joueur advere à terre ou sonné. Ceci ne compte pas comme une action d'agression et Nobbla ne peut pas être expulsé quand il utilise cette règle spéciale.",
    ],
    cost: 120, // en k
    leagues: ['Bagarre des Terres Arides', 'Défi des Bas-Fonds',
    ], 
  },
  {
    key: 'puggy_baconbreath',
    name: "Puggy Baconbreath",
    ma: 5, st: 3, ag: 3, pa: '3', av: 8,
    skills: [
      'Blocage', 'Esquive', 'Minus', 'Nerfs d\'acier', 'Poids plume', 'Solitaire (3+)', 
    ],
    specialRules: [
      "Chance du Halfling : Une fois par match, Puggy peut relancer un unique dé jeté dans le cadre d'un jet de dé unique ou d'un jet de plusieurs dés, mais il ne peut s'agir d'un dé jeté dans le cadre d'un jet d'armure, d'un jet de blessure ni d'un jet d'élimination.",
    ],
    cost: 120, // en k
    leagues: ['Classique du Vieux Monde', 'Coupe du Dé à Coudre Halfling',
    ], 
  },
  {
    key: 'rashnak_backstabber',
    name: "Rashnak Backstabber",
    ma: 7, st: 3, ag: 3, pa: '5', av: 8,
    skills: [
      'Glissade Contrôlée', 'Poignard', 'Poursuite', 'Sournois', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Expert en toxines : Une fois par match quand Rashnak réussit à pénétrer l'armure d'un joueur adverse suite à une action spéciale de Poignard, vous pouvez appliquer un modifiateur de +1 au jet de Blessure. Ce modificateur peut etre appliqué après avoir fait le jet.",
    ],
    cost: 120, // en k
    leagues: ['Bagarre des Terres Arides',
    ], 
  },
  {
    key: 'ripper_bolgrot',
    name: "Ripper Bolgrot",
    ma: 5, st: 6, ag: 5, pa: '4', av: 10,
    skills: [
      'Châtaigne', 'Dans le mille', 'Lancer de Coéquipier', 'Projection', 'Régénération', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Cerveau des trolls : Une fois par mi-temps, Ripper peut relancer un unique dé jeté dans le cadre d'un jet de dé unique, d'un jet de plusieurs dés ou d'un groupe de dés, mais il ne peut s'agir d'un dé jeté dans le cadre d'un jet d'armure, d'un jet de blessure ni d'un jet d'élimination.",
    ],
    cost: 250, // en k
    leagues: ['Bagarre des Terres Arides', 'Défi des Bas-Fonds',
    ], 
  },
  {
    key: 'rodney_roachbait',
    name: "Rodney Roachbait",
    ma: 6, st: 2, ag: 3, pa: '4', av: 7,
    skills: [
      'Glissade Contrôlée', 'Lutte', 'Minus', 'Réception', 'Réception plongeante', 'Rétablissement', 'Sur le ballon', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Prise du jour : Une fois par mi-temps, si Rodney est debout et commence son activation à 3 cases ou moins d'un ballon au sol, il peut jeter un D6. Sur 1-2 rien ne se passe. Sur 3+, Rodney prend immédiatement possession du ballon.",
    ],
    cost: 70, // en k
    leagues: ['Ligue Sylvestre',
    ], 
  },
  {
    key: 'roxanna_darknail',
    name: "Roxanna Darknail",
    ma: 8, st: 3, ag: 1, pa: '3', av: 8,
    skills: [
      'Esquive', 'Frénésie', 'Juggernaut', 'Rétablissement', 'Saut', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Ongles acérés : Une fois par mi-temps, quand Roxanna annonce une action de Blitz, elle gagne la compétence Griffes jusqu'à la fin de son activation.",
    ],
    cost: 270, // en k
    leagues: ['Ligue des Royaumes Elfiques',
    ], 
  },
  {
    key: 'scrappa_sorehead',
    name: "Scrappa Sorehead",
    ma: 7, st: 2, ag: 3, pa: '4', av: 8,
    skills: [
      'Equilibre', 'Esquive', 'Joueur déloyal', 'Minus', 'Monté sur ressort', 'Poids plume', 'Sprint', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Schboing ! : Une fois par match, quand Scrappa tente d'intercepter une action de Passe, il peut jeter un D6. Sur 2+n Scrappa n'a pas besoin de faire un jet pour intercepter; à la place, il intercepte automatiquement l'action de passe et prend possession du ballon.",
    ],
    cost: 120, // en k
    leagues: ['Bagarre des Terres Arides', 'Défi des Bas-Fonds'
    ], 
  },
  {
    key: 'scyla_anfingrimm',
    name: "Scyla Anfingrimm",
    ma: 5, st: 5, ag: 4, pa: '6', av: 10,
    skills: [
      'Châtaigne', 'Crâne épais', 'Frénésie', 'Griffes', 'Queue préhensile', 'Fureur débridée', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Fureur du dieur du sang : Une fois par match, si Scyla obtient un 1 pour son jet de Fureur Débridée après avoir annoncé une action de blocage, alors au lieu d'appliquer les effets habituels de Fureur débridée, Scyla peut effectuer deux actions de blocage à la place. La première action de blocage doit être entièrement résolue, y compris l'utilisation de la compétence Frénésie, avant d'effectuer la seconde.",
    ],
    cost: 200, // en k
    leagues: ['Favoris de Khorne',
    ], 
  },
  {
    key: 'skitter_stab-stab',
    name: "Skitter Stab-Stab",
    ma: 9, st: 2, ag: 2, pa: '4', av: 8,
    skills: [
      'Esquive', 'Poignard', 'Poursuite', 'Queue préhensile', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Maître assassin : Une fois par match, quand Skitter effectue une action spéciale de poignard, il peut relancer le jet d'armure.",
    ],
    cost: 170, // en k
    leagues: ['Défi des Bas-Fonds',
    ], 
  },
  {
    key: 'skrorg_snowpelt',
    name: "Skrorg Snowpelt",
    ma: 5, st: 5, ag: 4, pa: '6', av: 9,
    skills: [
      'Blocage', 'Châtaigne', 'Griffes', 'Juggernaut', 'Présence perturbante', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Faire vibrer le public : Une fois par match, quand Skrorg provoque le retrait d'un joueur adverse en raison d'une élimination suite à une action de blocage, le coach de Skrorg gagne 1 relance d'équipe jusqu'à la fin de la phase en cours. Si cette relance d'équipe n'a pas été utilisée d'ici la fin de la phase, elle est perdue.",
    ],
    cost: 240, // en k
    leagues: ['Super Ligue du Bord du Monde', 'Classique du Vieux Monde',
    ], 
  },
  {
    key: 'skrull_halfheigh',
    name: "Skrull Halfheigh",
    ma: 6, st: 3, ag: 4, pa: '3', av: 9,
    skills: [
      'Crâne épais', 'Nerfs d\'acier', 'Passe', 'Précision', 'Prise sûre', 'Régénération', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Fort en jeu de passe : Une fois par match, quand Skrull effectue une action de passe, il peut modifier le résultat du test de compétence de passe de la valeur de sa caractéristique de Force, jusqu'à un maximum de 6.",
    ],
    cost: 240, // en k
    leagues: ['Super Ligue du Bord du Monde', 'Spot de Sylvanie',
    ], 
  },
  {
    key: 'swiftvine_glimmershard',
    name: "Swiftvine Glimmershard",
    ma: 7, st: 2, ag: 3, pa: '5', av: 7,
    skills: [
      'Glissade contrôlée', 'Minus', 'Parade', 'Poignard', 'Présence perturbante', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Explosion de fureur : Une fois par mi-temps, tant qu'elle est débout au début de son activation, Swiftvine peut se placer adjacente à un joueur adverse debout à 3 cases ou moins d'elle et faire immédiatement une action spéciale de poignard contre lui. Elle peut ensuite se placer sur une case inocupée à 3 cases ou moins de sa nouvelle position. Puis, son activation prend immédiatement fin. Ceci compte comme l'action de Blitz de l'équipe pour le tour",
    ],
    cost: 110, // en k
    leagues: ['Ligue Sylvestre',
    ], 
  },
  {
    key: 'thorsson_stoutmead',
    name: "Thorsson Stoutmead",
    ma: 6, st: 3, ag: 4, pa: '3', av: 8,
    skills: [
      'Blocage', 'Crâne épais', 'Ivrogne', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Coup de fût de bière : Une fois par phase, au début de son activation, Thorsson peut choisir un joueur adverse à 3 cases ou moins et jeter un D6. Sur 3+, le joueur est immédiatement plaqué. Sur 2, rien ne se passe. Sur 1, Thorsson chute. Après avoir utilisé cette règle spéciale, l'activation de Thorsson prend fin.",
    ],
    cost: 170, // en k
    leagues: ['Super Ligue du Bord du Monde', 'Classique du Vieux Monde'
    ], 
  },
  {
    key: 'varag_mache-goule',
    name: "Varag Mache-Goule",
    ma: 6, st: 5, ag: 3, pa: '5', av: 10,
    skills: [
      'Blocage', 'Crâne épais', 'Châtaigne', 'Rétablissement', 'Haine (Morts-Vivants)', 'Instable', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Krazer et Klater : Une fois par match, quand un joueur est plaqué suite à une action de blocage effectuée par Varag, ce dernier peut relancer le jet d'armure.",
    ],
    cost: 260, // en k
    leagues: ['Bagarre des Terres Arides',
    ], 
  },
  {
    key: 'wilhelm_chaney',
    name: "Wilhelm Chaney",
    ma: 8, st: 4, ag: 3, pa: '5', av: 9,
    skills: [
      'Frénésie', 'Griffes', 'Lutte', 'Réception', 'Régénération', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Mutilation sauvage : Une fois par match, quand Wilhelm fait un jet de blessure contre un joueur adverse, il peut relancer le résultat.",
    ],
    cost: 220, // en k
    leagues: ['Spot de Sylvanie',
    ], 
  },
  {
    key: 'willow_rosebark',
    name: "Willow Rosebark",
    ma: 8, st: 4, ag: 3, pa: '4', av: 9,
    skills: [
      'Crâne épais', 'Glissade contrôlée', 'Intrépide', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Fureur sylvestre : Une fois par match, quand Willow effectue une action de blocage ayant pour conséquence qu'elle est plaquée, elle peut relancer un unique dé de blocage.",
    ],
    cost: 160, // en k
    leagues: ['Spot de Sylvanie',
    ], 
  },
  {
    key: 'withergrasp_doubledrool',
    name: "Withergrasp Doubledrool",
    ma: 6, st: 3, ag: 3, pa: '4', av: 9,
    skills: [
      'Deux têtes', 'Lutte', 'Queue préhensile', 'Répulsion', 'Tacle', 'Tentacules', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Attention ! : La première fois à chaque phase que Withergrasp est la cible d'une action de blocage effectuée par un joueur adverse, il compte comme ayant la compétence Esquive.",
    ],
    cost: 170, // en k
    leagues: ['Favoris de Nurgle',
    ], 
  },
  {
    key: 'zolcath_le_zoat',
    name: "Zolcath le Zoat",
    ma: 5, st: 5, ag: 4, pa: '5', av: 10,
    skills: [
      'Châtaigne', 'Equilibre', 'Queue préhensile', 'Juggernaut', 'Présence perturbante', 'Régénération', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Excusez-moi, êtes-vous un Zoat ? : Une fois par match, quand Zolcath est activé, il peut choisir un joueur adverse à 3 cases ou moins. Le joueur choisi perd immédiatement sa zone de tacle jusqu'à sa prochaine activation.",
    ],
    cost: 220, // en k
    leagues: ['Ligue des Royaumes Elfiques', 'Super Ligue de Lustrie'
    ], 
  },
  {
    key: 'zug_la_bete',
    name: "Zug la Bête",
    ma: 5, st: 5, ag: 4, pa: '6', av: 10,
    skills: [
      'Blocage', 'Châtaigne', 'Instable', 'Solitaire (4+)', 
    ],
    specialRules: [
      "Coup destructeur : Une fois par match, quand un joueur adverse est plaqué suite à une action de blocage effectuée par Zug, vous pouvez appliquer un modificateur supplémentaire de +1 au jet d'armure. Ce modificateur peut être appliqué après avoir effectué le jet.",
    ],
    cost: 220, // en k
    leagues: ['Classique du Vieux Monde', 'Super Ligue de Lustrie'
    ], 
  },
  {
    key: 'zzharg_madeye',
    name: "Zzharg Madeye",
    ma: 4, st: 4, ag: 4, pa: '3', av: 10,
    skills: [
      'Arme secrète', 'Canonnier', 'Crâne épais', 'Nerfs d\'acier', 'Passe désespérée', 'Solitaire (4+)', 
    ],
    specialRules: [
      "La Poudre résout tous les problèmes : Une fois par mi-temps, au début de son activation, Zzharg peut choisir un joueur adverse debout à 3 cases ou moins et jeter un D6. Sur 3+, le joueur choisi est touché. Sur 2, le coach adverse choisit un joueur (de n'importe quelle équipe, mais pas Zzharg) à 3 cases ou moins de celui initialement choisi pour qu'il soit touché. Sur 1, Zzharg est touché. Faites un jet d'armure pour le joueur touché. Puis l'activation de Zzharg prend immédiatement fin.",
    ],
    cost: 130, // en k
    leagues: ['Favoris de Hashut',
    ],
  },
  // === DUO : se paie d'un bloc, les 2 stars rejoignent l'équipe ===
  // Pour un duo : tableau `members` (chaque membre = un profil complet) + un
  // `cost` combiné. Le coût est réparti entre les membres pour la valeur d'équipe.
  // (Stats de Dribl & Drull à confirmer/ajuster.)
  {
    key: 'dribl_drull',
    name: 'Dribl & Drull',
    cost: 230, // coût combiné des deux
    leagues: ['Super Ligue de Lustrie'], // à ajuster
    members: [
      {
        name: 'Dribl',
        ma: 8, st: 2, ag: 3, pa: '4', av: 8,
        skills: ['Esquive', 'Agression éclair', 'Glissade contrôlée', 'Joueur déloyal', 'Minus', 'Sournois', 'Solitaire (4+)'],
        specialRules: ["Duo Sournois : Dribl et Drull doivent être embauchés en tant que paire. De plus, chaque fois que Dribl ou Drull effectue soit une action d'agression soit une action spéciale de Poignard contre un joueur adverse marqué à la fois par Dribl et Drull, il peut appliquer un modificateur de +1 au jet."],
      },
      {
        name: 'Drull',
        ma: 8, st: 2, ag: 3, pa: '4', av: 8,
        skills: ['Esquive', 'Glissade contrôlée', 'Minus', 'Poignard', 'Solitaire (4+)'],
        specialRules: ["Duo Sournois : Dribl et Drull doivent être embauchés en tant que paire. De plus, chaque fois que Dribl ou Drull effectue soit une action d'agression soit une action spéciale de Poignard contre un joueur adverse marqué à la fois par Dribl et Drull, il peut appliquer un modificateur de +1 au jet."],
      },
    ],
  },
  {
    key: 'les_jumeaux_swift',
    name: 'Les jumeaux swift',
    cost: 300, // coût combiné des deux
    leagues: ['Ligue des Royaumes Elfiques'], // à ajuster
    members: [
      {
        name: 'Lucien Swift',
        ma: 7, st: 3, ag: 2, pa: '3', av: 9,
        skills: ['Blocage', 'Châtaigne', 'Tacle', 'Solitaire (4+)'],
        specialRules: ["Travail en tandem : Les jumeaux Swift doivent être embauchés en tant que paire. De plus, si Valen effectue une action de passe qui cible une case où se trouve Lucien, alors Valen ne subit aucun modificateur au test de CP en raison de la portée de l'action de Passe."],
      },
      {
        name: 'Valen Swift',
        ma: 8, st: 2, ag: 3, pa: '4', av: 8,
        skills: ['Nerfs d\'acier', 'Passe', 'Passe Assurée', 'Précision', 'Prise sûre', 'Solitaire (4+)'],
        specialRules: ["Travail en tandem : Les jumeaux Swift doivent être embauchés en tant que paire. De plus, si Valen effectue une action de passe qui cible une case où se trouve Lucien, alors Valen ne subit aucun modificateur au test de CP en raison de la portée de l'action de Passe."],
      },
    ],
  },
  {
    key: 'grak_et_crumbleberry',
    name: 'Grak et Crumbleberry',
    cost: 250, // coût combiné des deux
    leagues: ['Bagarre des Terres Arides', 'Super Ligue du Bord du Monde', 'Classique du Vieux Monde', 'Ligue des Royaumes Elfiques', 'Défi des Bas-fonds', 'Coupe du Dé à Coudre Halfling', 'Super Ligue de Lustrie', 'Spot de Sylvanie', 'Clash du Chaos', 'Ligue Sylvestre'], // à ajuster
    members: [
      {
        name: 'Grak',
        ma: 5, st: 5, ag: 4, pa: '4', av: 10,
        skills: ['Botté de coéquipier', 'Châtaigne', 'Crâne épais', 'Cerveau lent', 'Solitaire (4+)'],
        specialRules: ["Je te porte : Grak & Crumbleberry doivent être embauchés en tant que paire. De plus, une fois par mi-temps, si Grak commence son activation adjacent à Crumbleberry, il peut le ramasser; retirez Crumbleberry temporairement. A la fin de l'activation de Grak, placez Crumbleberry sur une case inoccupée adjacente à Grak."],
      },
      {
        name: 'Crumbleberry',
        ma: 5, st: 2, ag: 3, pa: '5', av: 8,
        skills: ['Esquive', 'Minus', 'Poids plume', 'Prise sûre', 'Vol fatal', 'Solitaire (4+)'],
        specialRules: ["Je te porte : Grak & Crumbleberry doivent être embauchés en tant que paire. De plus, une fois par mi-temps, si Grak commence son activation adjacent à Crumbleberry, il peut le ramasser; retirez Crumbleberry temporairement. A la fin de l'activation de Grak, placez Crumbleberry sur une case inoccupée adjacente à Grak."],
      },
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

// Star players disponibles pour un roster donné, triés par coût croissant
function getAvailableStars(roster) {
  const leagues = rosterLeagues(roster);
  return STAR_PLAYERS
    .filter(s =>
      (s.leagues || []).includes('*') ||
      (s.leagues || []).some(l => leagues.includes(l))
    )
    .sort((a, b) => (a.cost || 0) - (b.cost || 0));
}

// Membres d'un star : pour un duo on renvoie `members` ; pour un star simple,
// on renvoie le star lui-même normalisé en membre unique.
function starMembers(star) {
  if (Array.isArray(star.members) && star.members.length) return star.members;
  return [{
    name: star.name,
    ma: star.ma, st: star.st, ag: star.ag, pa: star.pa, av: star.av,
    skills: star.skills || [],
    specialRules: star.specialRules || [],
  }];
}

export { STAR_PLAYERS, getAvailableStars, starMembers };
