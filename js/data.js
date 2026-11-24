// Game Item Database, 5-Tier Loot Rarity, Logical POI Tables, Workbench & Attachments
// IMPORTANT: Semantic pre-release versioning ONLY (game is NOT release-ready — never use >=1.0.0).
// Scheme is 0.MINOR.PATCH with channel/stage labels, e.g. "Alpha RC 0.2.65".
// With EVERY new commit: bump VERSION_INFO.patch (or minor) + VERSION string + ?v= cache-busters in index.html!
window.GAME_DATA = {
  VERSION: 'Alpha RC 0.2.82',
  VERSION_INFO: {
    major: 0,
    minor: 2,
    patch: 82,
    channel: 'Alpha', // Alpha | Beta — never blank while major === 0
    stage: 'RC',     // RC = Release Candidate
    updated: 'Nov 24, 2026',
    changelog: 'Koschei Complex ZAVOD-9 expansion + Engine Remaster: 4 sector bunker entrances across Vostok, Factory Admin & Shopkeeper dead-drop barter, Dual Bosses (The Rhinoceros & The Sniper) with C4 laser tripwires and Weapons Case Vault, R4D UV Detector cipher boards, single-WebGL-context consolidation, GeoPool/PBR shader pipeline, and O(1) AABB slab raycaster.',
    get semver() { return `${this.major}.${this.minor}.${this.patch}`; },
    get label() { return `${this.channel} ${this.stage} ${this.major}.${this.minor}.${this.patch}`; }
  },
  CHEMICAL_CONVERSION: {
    syringe: 5,
    basic_chemicals: 4,
    scrubs: 3,
    sterile_cloth: 2
  },
  getChemicalYield(itemId) {
    return (this.CHEMICAL_CONVERSION && this.CHEMICAL_CONVERSION[itemId]) || 0;
  },
  OPERATOR_STATS: {
    maxHp: 75,
    plateArmor: 35,
    walkSpeed: 6.8,
    sprintSpeed: 9.6,
    tacSprintSpeed: 12.4,
    crouchSpeed: 3.9,
    adsSpeed: 4.3,
    proneSpeed: 1.15,
    downedSpeed: 1.9,
    slideStartSpeed: 13.6,
    slideEndSpeed: 4.6
  },
  SQUAD_COLORS: ['#69f0ae', '#42a5f5', '#ffeb3b', '#ff69b4'], // Green, Blue, Yellow, Pink

  RARITIES: {
    common:    { id: 'common',    label: 'COMMON',    color: '#4caf50', bg: 'rgba(76, 175, 80, 0.14)',  revealTime: 0.42 },
    rare:      { id: 'rare',      label: 'RARE',      color: '#42a5f5', bg: 'rgba(66, 165, 245, 0.15)', revealTime: 0.85 },
    epic:      { id: 'epic',      label: 'EPIC',      color: '#ab47bc', bg: 'rgba(171, 71, 188, 0.16)', revealTime: 1.35 },
    legendary: { id: 'legendary', label: 'LEGENDARY', color: '#ffc107', bg: 'rgba(255, 193, 7, 0.18)',  revealTime: 2.00 },
    ultra:     { id: 'ultra',     label: 'ULTRA',     color: '#ff3d3d', bg: 'rgba(255, 61, 61, 0.20)',  revealTime: 2.75 }
  },

  ITEMS: {
    // === WEAPONS (Sidearms) ===
    pm9: {
      id: 'pm9',
      name: 'PM-9 Makarov',
      type: 'weapon',
      slot: 'secondary',
      rarity: 'common',
      value: 1800,
      weight: 0.8,
      ammoType: 'ammo_9x18',
      magSize: 8,
      damage: 28,
      fireRate: 0.22, // seconds between shots
      auto: false,
      reloadTime: 1.4,
      spread: 0.014,
      adsSpread: 0.004,
      recoil: 0.025,
      adsFov: 60,
      adsZoom: 1.25,
      adsTime: 0.145,
      sprintToFire: 0.065,
      tacSprintToFire: 0.115,
      adsMoveMult: 0.88,
      idleSway: 0.55,
      gunKick: 0.75,
      flinchRes: 0.85,
      range: 70,
      pellets: 1,
      color: 0x3b3f42,
      desc: '9x18mm compact sidearm. Reliable backup.'
    },
    g17: {
      id: 'g17',
      name: 'G-17 Tactical',
      type: 'weapon',
      slot: 'secondary',
      rarity: 'uncommon',
      value: 3400,
      weight: 0.9,
      ammoType: 'ammo_9x19',
      magSize: 17,
      damage: 32,
      fireRate: 0.16,
      auto: false,
      reloadTime: 1.5,
      spread: 0.012,
      adsSpread: 0.003,
      recoil: 0.022,
      adsFov: 58,
      adsZoom: 1.25,
      adsTime: 0.155,
      sprintToFire: 0.075,
      tacSprintToFire: 0.125,
      adsMoveMult: 0.86,
      idleSway: 0.52,
      gunKick: 0.72,
      flinchRes: 0.88,
      range: 80,
      pellets: 1,
      color: 0x222528,
      desc: '9x19mm high-capacity polymer pistol.'
    },

    // === WEAPONS (Primaries) ===
    mp5k: {
      id: 'mp5k',
      name: 'MP5-K Wasteland',
      type: 'weapon',
      slot: 'primary',
      rarity: 'uncommon',
      value: 5200,
      weight: 2.6,
      ammoType: 'ammo_9x19',
      magSize: 30,
      damage: 24,
      fireRate: 0.085,
      auto: true,
      reloadTime: 1.9,
      spread: 0.024,
      adsSpread: 0.007,
      recoil: 0.018,
      adsFov: 54,
      adsZoom: 1.35,
      adsTime: 0.195,
      sprintToFire: 0.110,
      tacSprintToFire: 0.190,
      adsMoveMult: 0.78,
      idleSway: 0.72,
      gunKick: 0.82,
      flinchRes: 0.92,
      range: 85,
      pellets: 1,
      color: 0x26292c,
      desc: '9x19mm submachine gun. High ROF, CQB dominant.'
    },
    ak74m: {
      id: 'ak74m',
      name: 'AK-74M Carbine',
      type: 'weapon',
      slot: 'primary',
      rarity: 'rare',
      value: 8500,
      weight: 3.4,
      ammoType: 'ammo_545',
      magSize: 30,
      damage: 36,
      fireRate: 0.105,
      auto: true,
      reloadTime: 2.2,
      spread: 0.022,
      adsSpread: 0.004,
      recoil: 0.028,
      adsFov: 50,
      adsZoom: 1.45,
      adsTime: 0.260,
      sprintToFire: 0.185,
      tacSprintToFire: 0.285,
      adsMoveMult: 0.62,
      idleSway: 1.00,
      gunKick: 1.05,
      flinchRes: 1.00,
      range: 140,
      pellets: 1,
      color: 0x3b2f26,
      desc: '5.45x39mm assault rifle. Rugged wasteland workhorse.'
    },
    m870: {
      id: 'm870',
      name: 'M870 Trenchgun',
      type: 'weapon',
      slot: 'primary',
      rarity: 'uncommon',
      value: 5800,
      weight: 3.2,
      ammoType: 'ammo_12g',
      magSize: 6,
      damage: 34, // per pellet (8 pellets = 272 max)
      fireRate: 0.75,
      auto: false,
      reloadTime: 2.4,
      spread: 0.052,
      adsSpread: 0.032,
      recoil: 0.065,
      adsFov: 56,
      adsZoom: 1.30,
      adsTime: 0.245,
      sprintToFire: 0.145,
      tacSprintToFire: 0.235,
      adsMoveMult: 0.68,
      idleSway: 0.85,
      gunKick: 1.35,
      flinchRes: 1.05,
      range: 42,
      pellets: 8,
      color: 0x3a322c,
      desc: '12ga pump shotgun. Devastating at close quarters.'
    },
    m24: {
      id: 'm24',
      name: 'M24 Marksman',
      type: 'weapon',
      slot: 'primary',
      rarity: 'epic',
      value: 12500,
      weight: 4.1,
      ammoType: 'ammo_762',
      magSize: 5,
      damage: 88,
      fireRate: 1.05,
      auto: false,
      boltAction: true,
      reloadTime: 2.6,
      spread: 0.035,
      adsSpread: 0.001,
      recoil: 0.075,
      adsFov: 22,
      adsZoom: 4.0,
      adsTime: 0.430,
      sprintToFire: 0.255,
      tacSprintToFire: 0.380,
      adsMoveMult: 0.48,
      idleSway: 1.45,
      gunKick: 1.48,
      flinchRes: 0.82,
      range: 950,
      pellets: 1,
      color: 0x454a3a,
      desc: '7.62mm bolt-action rifle. High-zoom optics, lethal precision.'
    },
    mosin9130: {
      id: 'mosin9130',
      name: 'M91/30 Mosin',
      type: 'weapon',
      slot: 'primary',
      rarity: 'rare',
      value: 7400,
      weight: 3.9,
      ammoType: 'ammo_762',
      magSize: 5,
      damage: 94,
      fireRate: 1.28,
      auto: false,
      boltAction: true,
      clipFed: true,
      reloadTime: 2.75,
      spread: 0.036,
      adsSpread: 0.0012,
      recoil: 0.082,
      adsFov: 44,
      adsZoom: 1.65,
      adsTime: 0.340,
      sprintToFire: 0.220,
      tacSprintToFire: 0.330,
      adsMoveMult: 0.54,
      idleSway: 1.28,
      gunKick: 1.40,
      flinchRes: 0.88,
      range: 900,
      pellets: 1,
      color: 0x6b4122,
      desc: 'Classic 5-round stripper-clip bolt-action rifle. Hard-hitting iron sights.'
    },
    awm338: {
      id: 'awm338',
      name: 'AWM .338 Sniper',
      type: 'weapon',
      slot: 'primary',
      rarity: 'epic',
      value: 16500,
      weight: 5.2,
      ammoType: 'ammo_762',
      magSize: 5,
      damage: 118,
      fireRate: 1.48,
      auto: false,
      boltAction: true,
      reloadTime: 2.9,
      spread: 0.042,
      adsSpread: 0.0004,
      recoil: 0.095,
      adsFov: 15,
      adsZoom: 6.0,
      adsTime: 0.520,
      sprintToFire: 0.295,
      tacSprintToFire: 0.440,
      adsMoveMult: 0.44,
      idleSway: 1.65,
      gunKick: 1.68,
      flinchRes: 0.78,
      range: 1250,
      pellets: 1,
      color: 0x3b4834,
      desc: 'True bolt-action .338 precision sniper rifle. Devastating long-range stopping power.'
    },

    // === AMMO ===
    // === AMMO (Logical Stack Limits: Light/Heavy 120, Shotgun 25, Sniper 40, Rockets 3) ===
    ammo_9x18: {
      id: 'ammo_9x18',
      name: '9x18mm Light Ammo',
      type: 'ammo',
      rarity: 'common',
      value: 12,
      weight: 0.01,
      stackable: true,
      maxStack: 120,
      buyQty: 30,
      desc: 'Light pistol rounds. Stacks up to 120.'
    },
    ammo_9x19: {
      id: 'ammo_9x19',
      name: '9x19mm Light Ammo',
      type: 'ammo',
      rarity: 'common',
      value: 16,
      weight: 0.012,
      stackable: true,
      maxStack: 120,
      buyQty: 30,
      desc: 'Light SMG & pistol cartridges. Stacks up to 120.'
    },
    ammo_545: {
      id: 'ammo_545',
      name: '5.45mm Heavy Ammo',
      type: 'ammo',
      rarity: 'common',
      value: 28,
      weight: 0.015,
      stackable: true,
      maxStack: 120,
      buyQty: 30,
      desc: 'Heavy assault rifle cartridges. Stacks up to 120.'
    },
    ammo_12g: {
      id: 'ammo_12g',
      name: '12ga Buckshot',
      type: 'ammo',
      rarity: 'common',
      value: 45,
      weight: 0.04,
      stackable: true,
      maxStack: 25,
      buyQty: 12,
      desc: '12-gauge buckshot shells. Stacks up to 25.'
    },
    ammo_762: {
      id: 'ammo_762',
      name: '7.62mm Sniper Ammo',
      type: 'ammo',
      rarity: 'rare',
      value: 75,
      weight: 0.025,
      stackable: true,
      maxStack: 40,
      buyQty: 10,
      desc: 'High-velocity sniper & marksman rounds. Stacks up to 40.'
    },
    ammo_rocket: {
      id: 'ammo_rocket',
      name: 'HE Launcher Rockets',
      type: 'ammo',
      rarity: 'epic',
      value: 650,
      weight: 1.2,
      stackable: true,
      maxStack: 3,
      buyQty: 1,
      desc: 'High-explosive ordnance for launchers. Stacks up to 3.'
    },

    // === ARMOR VESTS (1-3 Plate Carriers, Gel, Helmet, Heavy) ===
    vest_1plate: {
      id: 'vest_1plate',
      name: '1-Plate Carrier',
      type: 'armor',
      rarity: 'common',
      value: 2000,
      weight: 2.2,
      plateSlots: 1,
      maxArmor: 50,
      desc: 'Common 1-plate tactical carrier (50 Armor).'
    },
    vest_2plate: {
      id: 'vest_2plate',
      name: '2-Plate Carrier',
      type: 'armor',
      rarity: 'rare',
      value: 5200,
      weight: 3.4,
      plateSlots: 2,
      maxArmor: 100,
      desc: 'Rare 2-plate carrier (100 Armor).'
    },
    vest_2plate_gel: {
      id: 'vest_2plate_gel',
      name: '2-Plate Ballistic Gel Vest',
      type: 'armor',
      rarity: 'rare',
      value: 6800,
      weight: 3.2,
      plateSlots: 2,
      maxArmor: 100,
      desc: 'Rare ballistic-gel lined 2-plate vest with blunt trauma dampening.'
    },
    vest_2plate_helmet: {
      id: 'vest_2plate_helmet',
      name: '2-Plate Helmet Armor Vest',
      type: 'armor',
      rarity: 'epic',
      value: 9600,
      weight: 4.0,
      plateSlots: 2,
      maxArmor: 100,
      headshotResist: 0.35,
      desc: 'Epic 2-plate carrier paired with a ballistic helmet (-35% headshot damage).'
    },
    vest_3plate: {
      id: 'vest_3plate',
      name: '3-Plate Heavy Vest',
      type: 'armor',
      rarity: 'ultra',
      value: 16500,
      weight: 4.8,
      plateSlots: 3,
      maxArmor: 150,
      desc: 'Ultra-tier 3-plate heavy assault carrier (150 Armor).'
    },
    armor_plate: {
      id: 'armor_plate',
      name: 'Ceramic Armor Plate',
      type: 'plate',
      rarity: 'common',
      value: 400,
      weight: 0.45,
      plateArmor: 50,
      stackable: true,
      maxStack: 6,
      containerMaxStack: 3,
      buyQty: 3,
      desc: 'Restores 1 plate (+50 Armor). Stacks to 6 in rig/pack, up to 3 in crates.'
    },
    vest_scrap: { id: 'vest_scrap', name: '1-Plate Carrier', type: 'armor', rarity: 'common', value: 2000, weight: 2.2, plateSlots: 1, maxArmor: 50, desc: 'Common 1-plate carrier.' },
    vest_tactical: { id: 'vest_tactical', name: '2-Plate Carrier', type: 'armor', rarity: 'rare', value: 5200, weight: 3.4, plateSlots: 2, maxArmor: 100, desc: 'Rare 2-plate carrier.' },

    // === BACKPACKS ===
    bag_small: { id: 'bag_small', name: 'Daypack (8 Slots)', type: 'backpack', rarity: 'common', value: 1400, weight: 0.6, slots: 8, desc: 'Compact 8-slot tactical daypack.' },
    bag_medium: { id: 'bag_medium', name: 'Assault Pack (12 Slots)', type: 'backpack', rarity: 'rare', value: 4200, weight: 1.0, slots: 12, desc: 'Reinforced 12-slot operator backpack.' },
    bag_large: { id: 'bag_large', name: 'Expedition Rucksack (16 Slots)', type: 'backpack', rarity: 'epic', value: 8800, weight: 1.5, slots: 16, desc: 'High-capacity 16-slot wasteland rucksack.' },
    bag_weapon: { id: 'bag_weapon', name: 'Weapon Backpack (16 + WPN)', type: 'backpack', rarity: 'legendary', value: 11800, weight: 1.8, slots: 16, weaponSlot: true, desc: '16-slot weapon backpack with a dedicated double-wide weapon slot in the top-left.' },

    // === FIELD UPGRADES ===
    fu_ammo_box: { id: 'fu_ammo_box', name: 'Munitions Box', type: 'field_upgrade', rarity: 'rare', value: 3200, weight: 1.2, chargeTime: 45, desc: 'Restocks reserve ammo, plates & throwables on activation ([Z]).' },
    fu_dead_silence: { id: 'fu_dead_silence', name: 'Dead Silence', type: 'field_upgrade', rarity: 'epic', value: 5400, weight: 0.3, chargeTime: 40, desc: 'Silences footsteps & boosts sprint speed for 12s ([Z]).' },
    fu_trophy: { id: 'fu_trophy', name: 'Trophy System', type: 'field_upgrade', rarity: 'rare', value: 3800, weight: 1.0, chargeTime: 50, desc: 'Active defense unit that intercepts incoming ordnance ([Z]).' },

    // === KILLSTREAKS ===
    ks_uav: { id: 'ks_uav', name: 'UAV Recon Drone', type: 'killstreak', rarity: 'epic', value: 6200, weight: 0.8, desc: 'Reveals all hostiles & operator squads on the minimap for 20s.' },
    ks_airstrike: { id: 'ks_airstrike', name: 'Precision Airstrike', type: 'killstreak', rarity: 'legendary', value: 11500, weight: 1.0, desc: 'Calls a devastating jet strafe run on your target coordinates.' },

    // === MELEE WEAPONS ===
    melee_knife: { id: 'melee_knife', name: 'Combat Knife', type: 'melee', rarity: 'common', value: 900, weight: 0.3, damage: 65, desc: 'Standard issue tactical combat blade.' },
    melee_karambit: { id: 'melee_karambit', name: 'Tactical Karambit', type: 'melee', rarity: 'epic', value: 5800, weight: 0.25, damage: 85, desc: 'Curved CQB karambit with rapid slash recovery.' },
    melee_axe: { id: 'melee_axe', name: 'Breaching Hatchet', type: 'melee', rarity: 'legendary', value: 9400, weight: 0.8, damage: 115, desc: 'Heavy carbon-steel breaching tomahawk.' },

    // === MEDICAL ITEMS (Clinics, Strip-Towns, Med-Tents & Triage Sites) ===
    bandage: { id: 'bandage', name: 'Bandage', type: 'med', category: 'medical', rarity: 'common', value: 260, weight: 0.12, healAmount: 22, stackable: true, maxStack: 5, buyQty: 2, desc: 'Basic rolled gauze dressing (+22 HP).' },
    sterile_bandage: { id: 'sterile_bandage', name: 'Sterile Bandage', type: 'med', category: 'medical', rarity: 'rare', value: 520, weight: 0.15, healAmount: 35, stackable: true, maxStack: 4, buyQty: 2, desc: 'Vacuum-sealed trauma dressing (+35 HP & restores disabled health).' },
    sterile_cloth: { id: 'sterile_cloth', name: 'Sterile Cloth', type: 'material', category: 'medical', rarity: 'common', value: 300, weight: 0.15, stackable: true, maxStack: 10, desc: 'Autoclaved medical weave. Auto-converts into +2 Chemicals in your top-right backpack store.' },
    scrubs: { id: 'scrubs', name: 'Scrubs', type: 'material', category: 'medical', rarity: 'common', value: 340, weight: 0.30, stackable: true, maxStack: 6, desc: 'Vostok clinic surgical scrubs. Auto-converts into +3 Chemicals in your top-right backpack store.' },
    basic_chemicals: { id: 'basic_chemicals', name: 'Basic Chemicals', type: 'material', category: 'medical', rarity: 'common', value: 420, weight: 0.35, stackable: true, maxStack: 10, desc: 'Antiseptic & reagent bottles. Auto-converts into +4 Chemicals in your top-right backpack store.' },
    syringe: { id: 'syringe', name: 'Syringe', type: 'material', category: 'medical', rarity: 'rare', value: 960, weight: 0.10, stackable: true, maxStack: 4, desc: 'Medical injector & reagent vial. Auto-converts into +5 Chemicals in your top-right backpack store.' },
    painkillers: { id: 'painkillers', name: 'Tactical Painkillers', type: 'med', category: 'medical', rarity: 'rare', value: 1100, weight: 0.2, healAmount: 40, stackable: true, maxStack: 3, buyQty: 1, desc: 'Fast-acting analgesic bottle (+40 HP).' },
    medkit: { id: 'medkit', name: 'Medkit', type: 'med', category: 'medical', rarity: 'rare', value: 1500, weight: 0.4, healAmount: 55, stackable: true, maxStack: 3, buyQty: 1, desc: 'Full IFAK field medical kit (+55 HP & clears trauma, Press H).' },

    // === THROWABLES (Lethals & Tacticals) ===
    frag_grenade: {
      id: 'frag_grenade',
      name: 'M67 Frag Grenade',
      type: 'lethal',
      category: 'military',
      rarity: 'uncommon',
      value: 850,
      weight: 0.4,
      fuseTime: 5.0,
      blastRadius: 9.0,
      damage: 145,
      throwSpeed: 25.5,
      stackable: true,
      buyQty: 2,
      desc: '5-second timed fragmentation grenade. Hold [F] to pull pin & cook.'
    },
    throwing_knife: {
      id: 'throwing_knife',
      name: 'Throwing Knife',
      type: 'lethal',
      category: 'military',
      rarity: 'rare',
      value: 700,
      weight: 0.25,
      damage: 135,
      throwSpeed: 28.0,
      stackable: true,
      buyQty: 2,
      desc: 'Silent, high-velocity lethal blade. Hold [F] to aim.'
    },
    smoke_grenade: {
      id: 'smoke_grenade',
      name: 'M18 Smoke Grenade',
      type: 'tactical',
      category: 'military',
      rarity: 'common',
      value: 600,
      weight: 0.35,
      fuseTime: 1.6,
      smokeRadius: 6.5,
      smokeDuration: 28.0,
      throwSpeed: 22.0,
      stackable: true,
      buyQty: 2,
      desc: 'Deploys a dense smoke screen that blocks enemy line-of-sight ([Q]).'
    },
    concussion_grenade: {
      id: 'concussion_grenade',
      name: 'M84 Concussion',
      type: 'tactical',
      category: 'military',
      rarity: 'uncommon',
      value: 750,
      weight: 0.35,
      fuseTime: 1.4,
      stunRadius: 9.5,
      stunDuration: 5.0,
      throwSpeed: 23.5,
      stackable: true,
      buyQty: 2,
      desc: 'Disorients and stuns hostiles in blast radius for 5s ([Q]).'
    },

    // === MILITARY MATERIALS & ORDNANCE COMPONENTS (Compounds A-F, Dam, Hangars) ===
    scrap_metal: {
      id: 'scrap_metal',
      name: 'Salvaged Steel',
      type: 'material',
      category: 'military',
      rarity: 'common',
      value: 320,
      weight: 0.35,
      stackable: true,
      maxStack: 10,
      desc: 'Common crafting steel. Stacks to 10. Used at Workbench or sold in bulk.'
    },
    cloth_roll: {
      id: 'cloth_roll',
      name: 'Ballistic Cloth',
      type: 'material',
      category: 'military',
      rarity: 'common',
      value: 340,
      weight: 0.25,
      stackable: true,
      maxStack: 10,
      desc: 'High-tensile woven ballistic fabric for armor carriers & packs. Stacks to 10.'
    },
    kevlar_padding: {
      id: 'kevlar_padding',
      name: 'Kevlar Padding',
      type: 'material',
      category: 'military',
      rarity: 'rare',
      value: 940,
      weight: 0.35,
      stackable: true,
      maxStack: 8,
      desc: 'Multi-layer aramid trauma liner used to fabricate ballistic vests & plates.'
    },
    gunpowder: {
      id: 'gunpowder',
      name: 'Gunpowder',
      type: 'material',
      category: 'military',
      rarity: 'common',
      value: 380,
      weight: 0.3,
      stackable: true,
      maxStack: 10,
      desc: 'Smokeless rifle & pistol propellant for crafting ammo & grenades. Stacks to 10.'
    },
    brass_casings: {
      id: 'brass_casings',
      name: 'Brass Casings',
      type: 'material',
      category: 'military',
      rarity: 'common',
      value: 320,
      weight: 0.28,
      stackable: true,
      maxStack: 10,
      desc: 'Cleaned small-caliber brass cartridge cases for reloading 9mm & 5.45mm.'
    },
    heavy_gunpowder: {
      id: 'heavy_gunpowder',
      name: 'Heavy Gunpowder',
      type: 'material',
      category: 'military',
      rarity: 'rare',
      value: 880,
      weight: 0.40,
      stackable: true,
      maxStack: 10,
      desc: 'High-energy magnum & ordnance propellant for sniper rounds & explosives.'
    },
    heavy_casings: {
      id: 'heavy_casings',
      name: 'Heavy Casings',
      type: 'material',
      category: 'military',
      rarity: 'rare',
      value: 820,
      weight: 0.38,
      stackable: true,
      maxStack: 10,
      desc: 'Thick-walled rifle & marksman brass casings for high-pressure loads.'
    },
    casings_12g: {
      id: 'casings_12g',
      name: '12-Gauge Casings',
      type: 'material',
      category: 'military',
      rarity: 'common',
      value: 360,
      weight: 0.26,
      stackable: true,
      maxStack: 10,
      desc: 'Crimped red polymer 12ga hulls with brass bases for buckshot reloading.'
    },
    metallic_alloy: {
      id: 'metallic_alloy',
      name: 'Metallic Alloy',
      type: 'material',
      category: 'military',
      rarity: 'rare',
      value: 980,
      weight: 0.55,
      stackable: true,
      maxStack: 10,
      desc: 'Hardened titanium-vanadium military alloy billet from Vostok depots.'
    },
    reactive_metals: {
      id: 'reactive_metals',
      name: 'Reactive Metals',
      type: 'material',
      category: 'military',
      rarity: 'epic',
      value: 2650,
      weight: 0.65,
      stackable: true,
      maxStack: 6,
      desc: 'Volatile military-grade reactive metal core sealed in a hazard canister.'
    },
    polymer_parts: {
      id: 'polymer_parts',
      name: 'Polymer Components',
      type: 'material',
      category: 'military',
      rarity: 'common',
      value: 300,
      weight: 0.25,
      stackable: true,
      maxStack: 10,
      desc: 'Tactical polymer housings for Workbench crafting. Stacks to 10.'
    },

    // === OFFICE DOCUMENTS & RECORDS (TV Station, City Hall, Airport, Superstore, Cruise Terminal) ===
    payroll_documents: {
      id: 'payroll_documents',
      name: 'Payroll Documents',
      type: 'valuable',
      category: 'office',
      rarity: 'common',
      value: 480,
      weight: 0.12,
      stackable: true,
      maxStack: 5,
      desc: 'Vostok municipal & garrison wage disbursements prior to evacuation.'
    },
    vacation_planner: {
      id: 'vacation_planner',
      name: 'Vacation Planner',
      type: 'valuable',
      category: 'office',
      rarity: 'common',
      value: 360,
      weight: 0.10,
      stackable: true,
      maxStack: 5,
      desc: 'Wall & desk travel calendar marking cancelled southern cruise departures.'
    },
    financial_ledger: {
      id: 'financial_ledger',
      name: 'Financial Ledger',
      type: 'valuable',
      category: 'office',
      rarity: 'rare',
      value: 1550,
      weight: 0.35,
      stackable: true,
      maxStack: 3,
      desc: 'Hardbound accounting ledger tracking illicit mercenary wire transfers.'
    },
    documents: {
      id: 'documents',
      name: 'Documents',
      type: 'valuable',
      category: 'office',
      rarity: 'common',
      value: 420,
      weight: 0.12,
      stackable: true,
      maxStack: 5,
      desc: 'Stamped Vostok administrative paperwork and transit manifests.'
    },
    classified_documents: {
      id: 'classified_documents',
      name: 'Classified Documents',
      type: 'valuable',
      category: 'office',
      rarity: 'epic',
      value: 4800,
      weight: 0.15,
      stackable: true,
      maxStack: 3,
      desc: 'Red-stamped eyes-only intelligence detailing rogue operator defections.'
    },
    back_room_inventory_list: {
      id: 'back_room_inventory_list',
      name: 'Back Room Inventory List',
      type: 'valuable',
      category: 'office',
      rarity: 'common',
      value: 540,
      weight: 0.12,
      stackable: true,
      maxStack: 5,
      desc: 'Clipboard manifest logging requisitioned Superstore and depot stock.'
    },
    hourly_schedule: {
      id: 'hourly_schedule',
      name: 'Hourly Schedule',
      type: 'valuable',
      category: 'office',
      rarity: 'common',
      value: 320,
      weight: 0.08,
      stackable: true,
      maxStack: 5,
      desc: 'Shift roster abandoned mid-rotation when Vostok defenses collapsed.'
    },

    // === HOUSEHOLD ITEMS (Roadside Strip-Town Houses, City Apartments, Evac Cars) ===
    tools: {
      id: 'tools',
      name: 'Tools',
      type: 'material',
      category: 'household',
      rarity: 'common',
      value: 580,
      weight: 0.75,
      stackable: true,
      maxStack: 6,
      desc: 'Assorted wrenches, pliers & drivers useful for Workbench fabrication.'
    },
    clothes: {
      id: 'clothes',
      name: 'Clothes',
      type: 'material',
      category: 'household',
      rarity: 'common',
      value: 260,
      weight: 0.35,
      stackable: true,
      maxStack: 8,
      desc: 'Heavy Northern Russian winter garments left in hastily packed homes.'
    },
    cleaning_supplies: {
      id: 'cleaning_supplies',
      name: 'Cleaning Supplies',
      type: 'material',
      category: 'household',
      rarity: 'common',
      value: 340,
      weight: 0.45,
      stackable: true,
      maxStack: 8,
      desc: 'Bleach and solvent bottles salvageable for chemical synthesis.'
    },
    kids_drawing: {
      id: 'kids_drawing',
      name: "Kid's Drawing",
      type: 'valuable',
      category: 'household',
      rarity: 'common',
      value: 290,
      weight: 0.04,
      stackable: true,
      maxStack: 5,
      desc: 'Crayon sketch of a sunny house by the Vostok lighthouse, left behind in haste.'
    },
    family_photo: {
      id: 'family_photo',
      name: 'Family Photo',
      type: 'valuable',
      category: 'household',
      rarity: 'common',
      value: 380,
      weight: 0.05,
      stackable: true,
      maxStack: 5,
      desc: 'Framed photograph of a Vostok family before the incursion.'
    },
    picture_of_man: {
      id: 'picture_of_man',
      name: 'Picture of a Man',
      type: 'valuable',
      category: 'household',
      rarity: 'common',
      value: 350,
      weight: 0.05,
      stackable: true,
      maxStack: 5,
      desc: 'Weathered portrait photograph tucked inside an apartment drawer.'
    },
    nature_photo: {
      id: 'nature_photo',
      name: 'Nature Photo',
      type: 'valuable',
      category: 'household',
      rarity: 'common',
      value: 340,
      weight: 0.05,
      stackable: true,
      maxStack: 5,
      desc: 'Glossy print of the NW Vostok mountains and reservoir pine valley.'
    },

    // === HEADGEAR (Gas Mask / NVG) ===
    gas_mask: {
      id: 'gas_mask',
      name: 'M50 Gas Mask',
      type: 'headgear',
      rarity: 'rare',
      value: 3200,
      weight: 0.45,
      desc: 'Filtered tactical respirator. Protects against radiation & gas clouds.'
    },
    nvg_goggles: {
      id: 'nvg_goggles',
      name: 'GPNVG-18 Night Vision',
      type: 'headgear',
      rarity: 'epic',
      value: 7400,
      weight: 0.65,
      desc: 'Panoramic quad-tube night vision goggles for low-light operations.'
    },
    zavod_rebreather: {
      id: 'zavod_rebreather',
      name: 'Tactical Rebreather',
      type: 'headgear',
      rarity: 'rare',
      value: 2800,
      weight: 0.9,
      desc: 'Closed-circuit underwater breathing apparatus. Lets you dive through fully flooded ZAVOD-9 chambers.'
    },

    // === ZAVOD-9 COMPLEX QUEST ITEMS (Koschei-style sector puzzles) ===
    bunker_battery: {
      id: 'bunker_battery',
      name: 'Car Battery',
      type: 'quest',
      category: 'quest',
      rarity: 'rare',
      value: 400,
      weight: 6.0,
      stackable: false,
      desc: 'Heavy 12V car battery. With Jumper Cables it powers the A/1 rotunda breaker or the C/1-C/2 Alpha Cluster airlock panels.'
    },
    jumper_cables: {
      id: 'jumper_cables',
      name: 'Jumper Cables',
      type: 'quest',
      category: 'quest',
      rarity: 'common',
      value: 250,
      weight: 1.2,
      stackable: false,
      desc: 'Insulated jumper leads. Pair with a Car Battery at a ZAVOD-9 breaker or power panel.'
    },
    bunker_fuse: {
      id: 'bunker_fuse',
      name: 'Security Fuse',
      type: 'quest',
      category: 'quest',
      rarity: 'uncommon',
      value: 300,
      weight: 0.3,
      stackable: true,
      maxStack: 4,
      desc: 'Ceramic 60A security fuse. The B/2 fuse box needs two to kill the laser gates and open the airlock.'
    },
    drd_key_a: {
      id: 'drd_key_a',
      name: 'DRD Exit Key A',
      type: 'key',
      category: 'quest',
      rarity: 'epic',
      value: 1800,
      weight: 0.05,
      stackable: false,
      desc: 'Defense Research Division exit key (A). With key B it opens the yellow hermetic seal straight to the Factory.'
    },
    drd_key_b: {
      id: 'drd_key_b',
      name: 'DRD Exit Key B',
      type: 'key',
      category: 'quest',
      rarity: 'epic',
      value: 1800,
      weight: 0.05,
      stackable: false,
      desc: 'Defense Research Division exit key (B). With key A it opens the yellow hermetic seal straight to the Factory.'
    },
    b1_key_a: {
      id: 'b1_key_a',
      name: 'Barracks Exit Key A',
      type: 'key',
      category: 'quest',
      rarity: 'epic',
      value: 1800,
      weight: 0.05,
      stackable: false,
      desc: 'Flooded Barracks exit key (A) from the main dorms. Pair with Key B at the Barracks secret airlock to reach the Factory.'
    },
    b1_key_b: {
      id: 'b1_key_b',
      name: 'Barracks Exit Key B',
      type: 'key',
      category: 'quest',
      rarity: 'epic',
      value: 2400,
      weight: 0.05,
      stackable: false,
      desc: 'Flooded Barracks exit key (B) from the submerged secret vault behind the boarded breach wall. Pair with Key A to reach the Factory.'
    },
    zavod_factory_key: {
      id: 'zavod_factory_key',
      name: 'Factory Key',
      type: 'key',
      category: 'quest',
      rarity: 'epic',
      value: 2200,
      weight: 0.05,
      stackable: false,
      desc: 'Hidden in the Chemical Plant ventilation shafts. Opens airlock D/1 or D/2 into the Weapons Manufacturing Factory.'
    },
    zavod_l2_keycard: {
      id: 'zavod_l2_keycard',
      name: 'L2 Keycard',
      type: 'key',
      category: 'quest',
      rarity: 'legendary',
      value: 4800,
      weight: 0.05,
      stackable: false,
      desc: 'Level-2 security keycard. Opens the Alpha Cluster L2 door and activates the L2 exfil lift (visible to every team).'
    },
    zavod_laptop: {
      id: 'zavod_laptop',
      name: 'al-Qatala Laptop',
      type: 'quest',
      category: 'quest',
      rarity: 'rare',
      value: 1400,
      weight: 1.6,
      stackable: false,
      desc: 'Encrypted field laptop. Uplink three at the Alpha Cluster platforms to open the sealed archive.'
    },
    r4d_detector: {
      id: 'r4d_detector',
      name: 'R4D UV Detector',
      type: 'quest',
      category: 'quest',
      rarity: 'epic',
      value: 3200,
      weight: 0.6,
      stackable: false,
      desc: 'Handheld ultraviolet forensics scanner. Required to decode hidden chalk cipher boards in the Alpha Cluster.'
    },
    server_tape_red: {
      id: 'server_tape_red',
      name: 'Red Server Tape',
      type: 'valuable',
      category: 'valuables',
      rarity: 'epic',
      value: 2600,
      weight: 0.3,
      stackable: true,
      maxStack: 4,
      desc: 'Encrypted Koschei mainframe magnetic reel. Sought by the Factory Admin Shopkeeper for high-tier barter trades.'
    },
    server_tape_black: {
      id: 'server_tape_black',
      name: 'Black Server Tape',
      type: 'valuable',
      category: 'valuables',
      rarity: 'rare',
      value: 1650,
      weight: 0.3,
      stackable: true,
      maxStack: 4,
      desc: 'Backup optical telemetry spool from Alpha Cluster server racks. Accepted in Shopkeeper barter orders.'
    },
    aseptic_blocker: {
      id: 'aseptic_blocker',
      name: 'Aseptic Blocker',
      type: 'valuable',
      category: 'medical',
      rarity: 'epic',
      value: 2900,
      weight: 0.4,
      stackable: true,
      maxStack: 4,
      desc: 'Experimental Russian bio-prophylactic compound from DRD Labs. High trade value with the Shopkeeper.'
    },
    zavod_weapons_case: {
      id: 'zavod_weapons_case',
      name: 'ZAVOD-9 Weapons Case',
      type: 'valuable',
      category: 'valuables',
      rarity: 'legendary',
      value: 25000,
      weight: 4.5,
      stackable: false,
      desc: 'Heavy armored prototype weapons case seized from The Rhinoceros and The Sniper. Extract for +1,500 XP & massive payout!'
    },

    // === SELF-REVIVE, KEYS & HIGH-VALUE VOSTOK VALUABLES ===
    self_revive: {
      id: 'self_revive',
      name: 'Self-Revive Kit',
      type: 'self_revive',
      category: 'medical',
      rarity: 'epic',
      value: 6500,
      weight: 0.6,
      desc: 'Dedicated emergency epinephrine auto-injector. Hold [E] while downed to revive yourself.'
    },
    boss_key: {
      id: 'boss_key',
      name: 'Vostok Command Key',
      type: 'key',
      rarity: 'legendary',
      value: 12000,
      weight: 0.05,
      desc: 'Unlocks the Vostok Command Armory Key Room (Guaranteed Legendary/Ultra weapon + high-tier valuables).'
    },
    decorative_bowl: {
      id: 'decorative_bowl',
      name: 'Decorative Bowl',
      type: 'valuable',
      category: 'valuable',
      rarity: 'rare',
      value: 2200,
      weight: 0.55,
      desc: 'Gilded Northern porcelain bowl with cobalt filigree.'
    },
    antique_watch: {
      id: 'antique_watch',
      name: 'Antique Watch',
      type: 'valuable',
      category: 'valuable',
      rarity: 'epic',
      value: 6600,
      weight: 0.15,
      desc: 'Intricate pre-war mechanical pocket watch in working order.'
    },
    pure_silver: {
      id: 'pure_silver',
      name: 'Pure Silver',
      type: 'valuable',
      category: 'valuable',
      rarity: 'epic',
      value: 5600,
      weight: 0.90,
      desc: 'Assayed .999 fine silver ingot recovered from Vostok quarry & vaults.'
    },
    gold_bar: {
      id: 'gold_bar',
      name: 'Gold Bar',
      type: 'valuable',
      category: 'valuable',
      rarity: 'legendary',
      value: 15800,
      weight: 1.50,
      desc: 'Stamped 24-karat state reserve bullion bar.'
    },
    ancient_coin: {
      id: 'ancient_coin',
      name: 'Ancient Coin',
      type: 'valuable',
      category: 'valuable',
      rarity: 'rare',
      value: 2900,
      weight: 0.06,
      stackable: true,
      maxStack: 5,
      desc: 'Imperial gold & silver trade coin unearthed in Northern Russia.'
    },
    golden_skull: {
      id: 'golden_skull',
      name: 'Golden Skull',
      type: 'valuable',
      category: 'valuable',
      rarity: 'ultra',
      value: 24500,
      weight: 2.10,
      desc: 'Ornate solid-gold warlord trophy coveted by rogue mercenary syndicates.'
    },
    heart_of_vostok: {
      id: 'heart_of_vostok',
      name: 'Heart of Vostok',
      type: 'valuable',
      category: 'valuable',
      rarity: 'ultra',
      value: 38000,
      weight: 0.45,
      desc: 'Mythic deep-crimson faceted gemstone artifact — the crown jewel of Vostok.'
    },
    exp_radio_transmitter: {
      id: 'exp_radio_transmitter',
      name: 'Experimental Radio Transmitter',
      type: 'valuable',
      category: 'valuable',
      rarity: 'legendary',
      value: 13600,
      weight: 1.35,
      desc: 'Encrypted frequency-hopping military satcom transceiver prototype.'
    },
    reactive_compounds: {
      id: 'reactive_compounds',
      name: 'Reactive Compounds',
      type: 'valuable',
      category: 'valuable',
      rarity: 'epic',
      value: 5200,
      weight: 0.60,
      desc: 'Pressurized containment flask of high-yield chemical catalyst.'
    },
    nylon_cloth_roll: {
      id: 'nylon_cloth_roll',
      name: 'Nylon Cloth Roll',
      type: 'material',
      category: 'valuable',
      rarity: 'rare',
      value: 1650,
      weight: 0.40,
      stackable: true,
      maxStack: 6,
      desc: 'Ripstop mil-spec Cordura nylon bolt for high-capacity rucksacks & rigs.'
    },
    carbon_fibre_sample: {
      id: 'carbon_fibre_sample',
      name: 'Carbon Fibre Sample',
      type: 'material',
      category: 'valuable',
      rarity: 'epic',
      value: 4400,
      weight: 0.30,
      stackable: true,
      maxStack: 6,
      desc: 'Aerospace-grade woven carbon-fibre laminate plate.'
    },
    classified_dossier: {
      id: 'classified_dossier',
      name: 'Classified Dossier',
      type: 'valuable',
      category: 'valuable',
      rarity: 'legendary',
      value: 14200,
      weight: 0.25,
      desc: 'Sealed leather-bound NATO/Vostok intelligence dossier on rogue mercenaries.'
    },
    water_filter: {
      id: 'water_filter',
      name: 'Military Water Filter',
      type: 'valuable',
      category: 'valuable',
      rarity: 'rare',
      value: 2400,
      weight: 0.8,
      desc: 'Rare survival purifier.'
    },
    fuel_can: {
      id: 'fuel_can',
      name: 'Refined Fuel Canister',
      type: 'valuable',
      category: 'valuable',
      rarity: 'rare',
      value: 3100,
      weight: 2.2,
      desc: 'Rare clean generator fuel.'
    },
    intel_drive: {
      id: 'intel_drive',
      name: 'Encrypted Hard Drive',
      type: 'valuable',
      category: 'valuable',
      rarity: 'epic',
      value: 5800,
      weight: 0.4,
      desc: 'Epic pre-collapse bunker telemetry data.'
    },
    gold_watch: {
      id: 'gold_watch',
      name: 'Antique Officer Watch',
      type: 'valuable',
      category: 'valuable',
      rarity: 'epic',
      value: 6600,
      weight: 0.15,
      desc: 'Epic mechanical gold timepiece.'
    },
    gpu_unit: {
      id: 'gpu_unit',
      name: 'Military GPU Module',
      type: 'valuable',
      category: 'valuable',
      rarity: 'legendary',
      value: 12800,
      weight: 1.1,
      desc: 'Legendary intact tactical compute board.'
    },
    black_box: {
      id: 'black_box',
      name: 'Classified Flight Recorder',
      type: 'valuable',
      category: 'valuable',
      rarity: 'ultra',
      value: 22500,
      weight: 1.4,
      desc: 'Ultra-rare downed military aircraft flight recorder.'
    },
    dogtag: {
      id: 'dogtag',
      name: 'Operator Dogtag',
      type: 'valuable',
      category: 'military',
      rarity: 'rare',
      value: 1800,
      weight: 0.05,
      desc: 'Proof of rogue operator elimination.'
    }
  },

  WORKBENCH_RECIPES: [
    {
      id: 'craft_plates',
      outputId: 'armor_plate',
      outputQty: 3,
      name: '3x Ceramic Armor Plates',
      desc: 'Bond metallic alloy or steel with ballistic cloth into 3 ceramic plates.',
      ingredients: [{ id: 'cloth_roll', qty: 2 }, { id: 'metallic_alloy', qty: 1 }]
    },
    {
      id: 'craft_sterile_bandage',
      outputId: 'sterile_bandage',
      outputQty: 2,
      name: '2x Sterile Bandages',
      desc: 'Treat gauze dressings with refined Chemicals into 2 trauma dressings.',
      ingredients: [{ id: 'bandage', qty: 1 }, { id: 'chemicals', qty: 4 }]
    },
    {
      id: 'craft_reactive_compounds',
      outputId: 'reactive_compounds',
      outputQty: 1,
      name: 'Reactive Compounds',
      desc: 'Distill concentrated Chemicals with reactive metals into high-value Reactive Compounds.',
      ingredients: [{ id: 'chemicals', qty: 12 }, { id: 'reactive_metals', qty: 1 }]
    },
    {
      id: 'craft_medkit',
      outputId: 'medkit',
      outputQty: 1,
      name: 'Medkit',
      desc: 'Assemble a full IFAK Medkit from refined Chemicals & ballistic cloth.',
      ingredients: [{ id: 'chemicals', qty: 8 }, { id: 'cloth_roll', qty: 1 }]
    },
    {
      id: 'craft_self_revive',
      outputId: 'self_revive',
      outputQty: 1,
      name: 'Self-Revive Kit',
      desc: 'Synthesize an Epic Self-Revive auto-injector for solo or last-stand recovery.',
      ingredients: [{ id: 'chemicals', qty: 14 }, { id: 'tools', qty: 1 }]
    },
    {
      id: 'craft_ammo_545',
      outputId: 'ammo_545',
      outputQty: 60,
      name: '60x 5.45mm Heavy Ammo',
      desc: 'Reload 60 assault rifle cartridges from brass casings & gunpowder.',
      ingredients: [{ id: 'brass_casings', qty: 2 }, { id: 'gunpowder', qty: 2 }]
    },
    {
      id: 'craft_ammo_12g',
      outputId: 'ammo_12g',
      outputQty: 24,
      name: '24x 12ga Buckshot',
      desc: 'Crimp 24 buckshot shells from 12-gauge casings & gunpowder.',
      ingredients: [{ id: 'casings_12g', qty: 2 }, { id: 'gunpowder', qty: 1 }]
    },
    {
      id: 'craft_ammo_762',
      outputId: 'ammo_762',
      outputQty: 25,
      name: '25x 7.62mm Sniper Ammo',
      desc: 'Precision-load 25 marksman cartridges from heavy casings & heavy gunpowder.',
      ingredients: [{ id: 'heavy_casings', qty: 2 }, { id: 'heavy_gunpowder', qty: 2 }]
    },
    {
      id: 'craft_frag',
      outputId: 'frag_grenade',
      outputQty: 2,
      name: '2x M67 Frag Grenades',
      desc: 'Pack heavy gunpowder into metallic alloy fragmentation bodies.',
      ingredients: [{ id: 'metallic_alloy', qty: 1 }, { id: 'heavy_gunpowder', qty: 1 }]
    },
    {
      id: 'craft_gel_vest',
      outputId: 'vest_2plate_gel',
      outputQty: 1,
      name: '2-Plate Ballistic Gel Vest',
      desc: 'Fabricate a Rare 2-plate carrier from Kevlar padding & ballistic cloth.',
      ingredients: [{ id: 'kevlar_padding', qty: 2 }, { id: 'cloth_roll', qty: 2 }]
    },
    {
      id: 'craft_heavy_vest',
      outputId: 'vest_3plate',
      outputQty: 1,
      name: '3-Plate Heavy Vest',
      desc: 'Laminate carbon fibre, Kevlar padding & reactive metals into an Ultra 3-plate carrier.',
      ingredients: [{ id: 'carbon_fibre_sample', qty: 2 }, { id: 'kevlar_padding', qty: 2 }, { id: 'reactive_metals', qty: 1 }]
    },
    {
      id: 'craft_med_bag',
      outputId: 'bag_large',
      outputQty: 1,
      name: 'Expedition Rucksack (16 Slots)',
      desc: 'Stitch an Epic 16-slot rucksack from nylon cloth rolls & ballistic cloth.',
      ingredients: [{ id: 'nylon_cloth_roll', qty: 2 }, { id: 'cloth_roll', qty: 2 }]
    },
    {
      id: 'craft_boss_key',
      outputId: 'boss_key',
      outputQty: 1,
      name: 'Vostok Command Key',
      desc: 'Mill a Legendary Command Armory Key using tools, metallic alloy & reactive metals.',
      ingredients: [{ id: 'metallic_alloy', qty: 2 }, { id: 'reactive_metals', qty: 1 }, { id: 'tools', qty: 1 }]
    }
  ],

  TRADER_STOCK: {
    weapons: ['pm9', 'g17', 'mp5k', 'm870', 'ak74m', 'mosin9130', 'm24', 'awm338'],
    ammo: ['ammo_9x18', 'ammo_9x19', 'ammo_12g', 'ammo_545', 'ammo_762', 'ammo_rocket'],
    gear: [
      'bandage', 'sterile_bandage', 'painkillers', 'medkit', 'self_revive',
      'gas_mask', 'nvg_goggles', 'zavod_rebreather', 'armor_plate',
      'vest_1plate', 'vest_2plate', 'vest_2plate_gel', 'vest_2plate_helmet', 'vest_3plate',
      'bag_small', 'bag_medium', 'bag_large', 'bag_weapon',
      'fu_ammo_box', 'fu_dead_silence', 'fu_trophy',
      'ks_uav', 'ks_airstrike',
      'melee_knife', 'melee_karambit', 'melee_axe',
      'frag_grenade', 'throwing_knife', 'smoke_grenade', 'concussion_grenade',
      'boss_key'
    ]
  },

  ZONES: {
    outpost: {
      id: 'outpost',
      name: 'Vostok',
      raidDuration: 900, // 15 minutes
      enemyCount: 10,
      raiderChance: 0.45,
      heavyChance: 0.12,
      lootTierBonus: 0,
      fogColor: 0x8d9aa2,
      skyColor: 0x7c8e99
    },
    industrial: {
      id: 'industrial',
      name: 'Vostok // High Threat',
      raidDuration: 900, // 15 minutes
      enemyCount: 14,
      raiderChance: 0.62,
      heavyChance: 0.25,
      lootTierBonus: 1,
      fogColor: 0x6d7982,
      skyColor: 0x5c6973
    },
    bunker: {
      id: 'bunker',
      name: 'ZAVOD-9 Complex',
      mapType: 'zavod',
      underground: true,
      transferOnly: true, // Reached only through the Vostok ZAVOD-9 service elevator (Koschei-style)
      raidDuration: 1200, // 20 minutes underground (final 4 minutes = Final Exfil)
      enemyCount: 40,
      raiderChance: 0.7,
      heavyChance: 0.3,
      lootTierBonus: 2,
      fogColor: 0x0b0d0f,
      skyColor: 0x050607,
      desc: 'Standalone underground weapons-manufacturing & chemical-processing complex. 4 isolated puzzle sectors feed the dark Chemical Plant, Factory & Alpha Cluster.'
    }
  },

  LOOT_TABLES: {
    // Location-based logical loot tables across Vostok
    hospital: [
      { id: 'bandage', min: 1, max: 3, w: 22 },
      { id: 'sterile_bandage', min: 1, max: 2, w: 18 },
      { id: 'sterile_cloth', min: 1, max: 3, w: 16 },
      { id: 'scrubs', min: 1, max: 2, w: 12 },
      { id: 'basic_chemicals', min: 1, max: 3, w: 14 },
      { id: 'syringe', min: 1, max: 2, w: 14 },
      { id: 'medkit', min: 1, max: 2, w: 18 },
      { id: 'self_revive', min: 1, max: 1, w: 8 },
      { id: 'aseptic_blocker', min: 1, max: 1, w: 3 }
    ],
    medical: [
      { id: 'bandage', min: 1, max: 3, w: 24 },
      { id: 'sterile_bandage', min: 1, max: 2, w: 20 },
      { id: 'sterile_cloth', min: 1, max: 3, w: 16 },
      { id: 'scrubs', min: 1, max: 2, w: 12 },
      { id: 'basic_chemicals', min: 1, max: 2, w: 14 },
      { id: 'syringe', min: 1, max: 2, w: 14 },
      { id: 'medkit', min: 1, max: 1, w: 16 },
      { id: 'self_revive', min: 1, max: 1, w: 5 }
    ],
    office: [
      { id: 'payroll_documents', min: 1, max: 2, w: 18 },
      { id: 'vacation_planner', min: 1, max: 1, w: 14 },
      { id: 'financial_ledger', min: 1, max: 1, w: 12 },
      { id: 'documents', min: 1, max: 2, w: 20 },
      { id: 'classified_documents', min: 1, max: 1, w: 8 },
      { id: 'back_room_inventory_list', min: 1, max: 2, w: 14 },
      { id: 'hourly_schedule', min: 1, max: 2, w: 16 },
      { id: 'classified_dossier', min: 1, max: 1, w: 4 },
      { id: 'antique_watch', min: 1, max: 1, w: 5 },
      { id: 'server_tape_black', min: 1, max: 1, w: 3 },
      { id: 'server_tape_red', min: 1, max: 1, w: 2 }
    ],
    household: [
      { id: 'tools', min: 1, max: 2, w: 18 },
      { id: 'clothes', min: 1, max: 2, w: 18 },
      { id: 'cleaning_supplies', min: 1, max: 2, w: 16 },
      { id: 'kids_drawing', min: 1, max: 1, w: 11 },
      { id: 'family_photo', min: 1, max: 1, w: 11 },
      { id: 'picture_of_man', min: 1, max: 1, w: 10 },
      { id: 'nature_photo', min: 1, max: 1, w: 10 },
      { id: 'decorative_bowl', min: 1, max: 1, w: 6 },
      { id: 'ancient_coin', min: 1, max: 1, w: 5 },
      { id: 'bandage', min: 1, max: 2, w: 10 }
    ],
    police_fire: [
      { id: 'vest_1plate', min: 1, max: 1, w: 14 },
      { id: 'vest_2plate', min: 1, max: 1, w: 9 },
      { id: 'bag_small', min: 1, max: 1, w: 10 },
      { id: 'pm9', min: 1, max: 1, w: 10 },
      { id: 'g17', min: 1, max: 1, w: 10 },
      { id: 'mp5k', min: 1, max: 1, w: 7 },
      { id: 'm870', min: 1, max: 1, w: 7 },
      { id: 'armor_plate', min: 1, max: 3, w: 14 },
      { id: 'ammo_9x19', min: 20, max: 45, w: 12 },
      { id: 'ammo_12g', min: 8, max: 16, w: 10 },
      { id: 'tools', min: 1, max: 2, w: 10 },
      { id: 'documents', min: 1, max: 2, w: 8 },
      { id: 'concussion_grenade', min: 1, max: 2, w: 8 }
    ],
    military: [
      { id: 'cloth_roll', min: 1, max: 3, w: 12 },
      { id: 'kevlar_padding', min: 1, max: 2, w: 10 },
      { id: 'gunpowder', min: 1, max: 3, w: 12 },
      { id: 'brass_casings', min: 1, max: 3, w: 11 },
      { id: 'heavy_gunpowder', min: 1, max: 2, w: 8 },
      { id: 'heavy_casings', min: 1, max: 2, w: 8 },
      { id: 'casings_12g', min: 1, max: 3, w: 10 },
      { id: 'frag_grenade', min: 1, max: 2, w: 10 },
      { id: 'throwing_knife', min: 1, max: 2, w: 6 },
      { id: 'smoke_grenade', min: 1, max: 2, w: 9 },
      { id: 'concussion_grenade', min: 1, max: 2, w: 8 },
      { id: 'metallic_alloy', min: 1, max: 2, w: 9 },
      { id: 'reactive_metals', min: 1, max: 1, w: 5 },
      { id: 'ammo_545', min: 20, max: 45, w: 14 },
      { id: 'ammo_762', min: 8, max: 18, w: 9 },
      { id: 'armor_plate', min: 1, max: 3, w: 12 },
      { id: 'vest_2plate_gel', min: 1, max: 1, w: 6 },
      { id: 'vest_2plate_helmet', min: 1, max: 1, w: 4 },
      { id: 'vest_3plate', min: 1, max: 1, w: 2 },
      { id: 'bag_medium', min: 1, max: 1, w: 5 },
      { id: 'bag_weapon', min: 1, max: 1, w: 3 },
      { id: 'gas_mask', min: 1, max: 1, w: 4 },
      { id: 'nvg_goggles', min: 1, max: 1, w: 3 },
      { id: 'zavod_rebreather', min: 1, max: 1, w: 5 },
      { id: 'ak74m', min: 1, max: 1, w: 6 },
      { id: 'mosin9130', min: 1, max: 1, w: 5 },
      { id: 'm24', min: 1, max: 1, w: 4 },
      { id: 'awm338', min: 1, max: 1, w: 2 },
      { id: 'exp_radio_transmitter', min: 1, max: 1, w: 3 },
      { id: 'classified_dossier', min: 1, max: 1, w: 3 },
      { id: 'boss_key', min: 1, max: 1, w: 3 }
    ],
    supply: [
      { id: 'tools', min: 1, max: 2, w: 16 },
      { id: 'cloth_roll', min: 2, max: 4, w: 14 },
      { id: 'gunpowder', min: 1, max: 3, w: 12 },
      { id: 'brass_casings', min: 1, max: 3, w: 12 },
      { id: 'casings_12g', min: 1, max: 3, w: 10 },
      { id: 'metallic_alloy', min: 1, max: 2, w: 10 },
      { id: 'nylon_cloth_roll', min: 1, max: 2, w: 9 },
      { id: 'carbon_fibre_sample', min: 1, max: 1, w: 6 },
      { id: 'reactive_compounds', min: 1, max: 1, w: 6 },
      { id: 'cleaning_supplies', min: 1, max: 2, w: 10 },
      { id: 'basic_chemicals', min: 1, max: 2, w: 10 }
    ],
    valuables: [
      { id: 'decorative_bowl', min: 1, max: 1, w: 16 },
      { id: 'ancient_coin', min: 1, max: 2, w: 15 },
      { id: 'nylon_cloth_roll', min: 1, max: 2, w: 12 },
      { id: 'antique_watch', min: 1, max: 1, w: 10 },
      { id: 'pure_silver', min: 1, max: 1, w: 10 },
      { id: 'reactive_compounds', min: 1, max: 1, w: 9 },
      { id: 'carbon_fibre_sample', min: 1, max: 1, w: 8 },
      { id: 'classified_documents', min: 1, max: 1, w: 8 },
      { id: 'gold_bar', min: 1, max: 1, w: 5 },
      { id: 'exp_radio_transmitter', min: 1, max: 1, w: 5 },
      { id: 'classified_dossier', min: 1, max: 1, w: 5 },
      { id: 'golden_skull', min: 1, max: 1, w: 2 },
      { id: 'heart_of_vostok', min: 1, max: 1, w: 1 }
    ],
    // Vostok Command Key Room pools (ZERO common items!)
    boss_epic: [
      'vest_2plate_helmet', 'bag_large', 'bag_weapon', 'antique_watch', 'pure_silver',
      'reactive_compounds', 'carbon_fibre_sample', 'classified_documents', 'gold_bar',
      'exp_radio_transmitter', 'classified_dossier', 'golden_skull', 'heart_of_vostok',
      'fu_dead_silence', 'ks_uav', 'melee_karambit'
    ],
    boss_rare: [
      'vest_2plate_gel', 'bag_medium', 'decorative_bowl', 'ancient_coin', 'nylon_cloth_roll',
      'kevlar_padding', 'metallic_alloy', 'sterile_bandage', 'syringe', 'medkit', 'ammo_762'
    ],
    boss_legendary_weapons: ['ak74m', 'm24', 'awm338', 'mosin9130', 'mp5k', 'm870']
  },

  normalizeWeaponMods(mods) {
    const out = {};
    if (!mods || typeof mods !== 'object') return out;
    const keys = ['optic', 'muzzle', 'underbarrel', 'magazine', 'stock', 'camo', 'sticker', 'charm'];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (mods[k] && mods[k] !== 'none') out[k] = mods[k];
    }
    return out;
  },

  resolveWeaponRarity(weaponId, mods = null, rarityOverride = null) {
    const clean = this.normalizeWeaponMods(mods);
    const hasFunctionalAtt = ['optic', 'muzzle', 'underbarrel', 'magazine', 'stock'].some((k) => !!clean[k]);
    if (hasFunctionalAtt) {
      return this.getWeaponRarityAndValue(weaponId, clean).rarity;
    }
    if (rarityOverride && this.RARITIES && this.RARITIES[rarityOverride]) {
      return rarityOverride;
    }
    const base = this.ITEMS && this.ITEMS[weaponId];
    return (base && base.rarity) || 'common';
  },

  getWeaponRarityAndValue(weaponId, mods = {}) {
    const base = this.ITEMS[weaponId];
    if (!base) return { rarity: 'common', value: 1000 };
    const slotKeys = ['optic', 'muzzle', 'underbarrel', 'magazine', 'stock'];
    let attCount = 0;
    let attValue = 0;
    for (const k of slotKeys) {
      const id = mods && mods[k];
      if (id && id !== 'none') {
        attCount += 1;
        const att = this.ATTACHMENTS[k] && this.ATTACHMENTS[k][id];
        if (att) attValue += Math.round(att.price * 0.75);
      }
    }
    const tiers = ['common', 'rare', 'epic', 'legendary', 'ultra'];
    // Gun rarity is strictly equal to the number of attachments equipped (0=common, 1=rare, 2=epic, 3=legendary, 4-5=ultra)
    const finalIdx = Math.min(tiers.length - 1, attCount);
    return {
      rarity: tiers[finalIdx],
      value: Math.round(base.value * (1 + attCount * 0.28) + attValue),
      attachmentCount: attCount
    };
  },

  rollRandomAttachmentsForRarity(weaponId, targetRarity = null) {
    const base = this.ITEMS[weaponId];
    if (!base || base.type !== 'weapon') return { mods: {}, rarity: targetRarity || 'common' };
    const tiers = ['common', 'rare', 'epic', 'legendary', 'ultra'];
    const rar = (targetRarity && tiers.includes(targetRarity))
      ? targetRarity
      : (tiers.includes(base.rarity) ? base.rarity : 'common');
    const tierIdx = tiers.indexOf(rar);
    // Exact attachment count matching rarity: 0=common, 1=rare, 2=epic, 3=legendary, 4 or 5=ultra
    const wantCount = tierIdx >= 4 ? (Math.random() < 0.5 ? 5 : 4) : tierIdx;
    const mods = {};
    if (wantCount <= 0) return { mods, rarity: 'common' };

    const slotKeys = ['optic', 'muzzle', 'underbarrel', 'magazine', 'stock'];
    // Shuffle slot order so attachments are genuinely randomized per gun
    const shuffled = [...slotKeys].sort(() => Math.random() - 0.5);
    const chosenSlots = shuffled.slice(0, Math.min(wantCount, shuffled.length));

    const isPistol = base.slot === 'secondary';
    const isShotgun = base.pellets && base.pellets > 1;
    const isSniper = base.id === 'm24' || base.id === 'awm338' || base.id === 'mosin9130' || (base.adsFov && base.adsFov <= 35);

    for (const slot of chosenSlots) {
      const poolObj = this.ATTACHMENTS[slot];
      if (!poolObj) continue;
      let candidates = Object.keys(poolObj).filter(k => k !== 'none');
      if (slot === 'optic') {
        if (isPistol || isShotgun) {
          candidates = candidates.filter(k => k === 'red_dot' || k === 'holo');
        } else if (isSniper) {
          candidates = candidates.filter(k => k === 'acog_2x' || k === 'lpvo_4x' || k === 'sniper_8x');
        } else {
          candidates = candidates.filter(k => k !== 'sniper_8x');
        }
      }
      if (candidates.length === 0) candidates = Object.keys(poolObj).filter(k => k !== 'none');
      if (candidates.length > 0) {
        mods[slot] = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    const calc = this.getWeaponRarityAndValue(weaponId, mods);
    return { mods, rarity: calc.rarity };
  },

  ATTACHMENTS: {
    optic: {
      none: { id: 'none', name: 'Factory Sights', price: 0, recoilMult: 1.0, spreadMult: 1.0, adsSpreadMult: 1.0, adsAdd: 0.0, idleSwayMult: 1.0, zoom: null, adsFovOverride: null, desc: 'Standard factory iron sights / default optic.' },
      red_dot: { id: 'red_dot', name: 'Cobra Reflex Red Dot', price: 2200, recoilMult: 1.0, spreadMult: 1.0, adsSpreadMult: 0.72, adsAdd: 0.008, idleSwayMult: 0.98, zoom: 1.25, adsFovOverride: 62, desc: '1.25x slim open reflex sight (+8ms ADS, -28% ADS spread).' },
      holo: { id: 'holo', name: 'EXPS3 Holographic', price: 2800, recoilMult: 0.98, spreadMult: 1.0, adsSpreadMult: 0.66, adsAdd: 0.015, idleSwayMult: 0.96, zoom: 1.35, adsFovOverride: 58, desc: '1.35x hooded circle-dot holographic sight (+15ms ADS, -34% ADS spread).' },
      acog_2x: { id: 'acog_2x', name: 'TA-31 3x Prism Scope', price: 4200, recoilMult: 1.0, spreadMult: 1.0, adsSpreadMult: 0.54, adsAdd: 0.028, idleSwayMult: 1.02, zoom: 3.0, adsFovOverride: 29, desc: '3x cylindrical prism optic with BDC reticle (+28ms ADS, -46% ADS spread).' },
      lpvo_4x: { id: 'lpvo_4x', name: 'Vortex 1-4x LPVO', price: 5600, recoilMult: 1.0, spreadMult: 1.0, adsSpreadMult: 0.44, adsAdd: 0.042, idleSwayMult: 1.06, zoom: 4.0, adsFovOverride: 22, desc: '4x variable tactical tube optic (+42ms ADS, -56% ADS spread).' },
      sniper_8x: { id: 'sniper_8x', name: 'Mk5 8x Long-Range', price: 7800, recoilMult: 1.0, spreadMult: 1.0, adsSpreadMult: 0.30, adsAdd: 0.068, idleSwayMult: 1.12, zoom: 8.0, adsFovOverride: 11, desc: '8x precision sniper optic with mil-dot stadia (+68ms ADS, -70% ADS spread).' }
    },
    muzzle: {
      none: { id: 'none', name: 'Factory Muzzle', price: 0, recoilMult: 1.0, gunKickMult: 1.0, spreadMult: 1.0, adsAdd: 0.0, idleSwayMult: 1.0, suppressed: false, desc: 'Standard barrel crown.' },
      compensator: { id: 'compensator', name: 'Tactical Compensator', price: 1800, recoilMult: 0.72, gunKickMult: 0.76, spreadMult: 0.92, adsAdd: 0.014, idleSwayMult: 0.98, suppressed: false, desc: 'Ported brake (-28% recoil, -24% gun kick, +14ms ADS).' },
      suppressor: { id: 'suppressor', name: 'PBS Tactical Suppressor', price: 3800, recoilMult: 0.82, gunKickMult: 0.86, spreadMult: 0.95, adsAdd: 0.024, idleSwayMult: 1.06, suppressed: true, desc: 'Muffles gunfire & halves alert radius (-18% recoil, +24ms ADS).' }
    },
    underbarrel: {
      none: { id: 'none', name: 'Standard Rail', price: 0, recoilMult: 1.0, gunKickMult: 1.0, spreadMult: 1.0, adsAdd: 0.0, stfMult: 1.0, idleSwayMult: 1.0, laser: false, desc: 'No underbarrel attachment.' },
      vert_grip: { id: 'vert_grip', name: 'RK-1 Vertical Grip', price: 1600, recoilMult: 0.78, gunKickMult: 0.80, spreadMult: 0.85, adsAdd: 0.018, stfMult: 1.04, idleSwayMult: 0.72, laser: false, desc: '-28% ADS idle sway, -22% recoil, -20% gun kick (+18ms ADS).' },
      laser: { id: 'laser', name: 'PEQ-15 Tactical Laser', price: 2400, recoilMult: 0.94, gunKickMult: 0.96, spreadMult: 0.62, adsAdd: -0.026, stfMult: 0.78, idleSwayMult: 0.68, laser: true, desc: '-26ms ADS, -22% Sprint-to-Fire, -32% ADS idle sway & tight Tac-Stance.' }
    },
    magazine: {
      none: { id: 'none', name: 'Standard Mag', price: 0, magMult: 1.0, adsAdd: 0.0, stfMult: 1.0, desc: 'Factory magazine capacity.' },
      ext_mag: { id: 'ext_mag', name: 'Extended Magazine', price: 2600, magMult: 1.35, adsAdd: 0.022, stfMult: 1.08, desc: '+35% mag capacity (+22ms ADS, +8% Sprint-to-Fire).' }
    },
    stock: {
      none: { id: 'none', name: 'Factory Stock', price: 0, recoilMult: 1.0, gunKickMult: 1.0, spreadMult: 1.0, adsSpreadMult: 1.0, adsAdd: 0.0, stfMult: 1.0, adsMoveMult: 1.0, idleSwayMult: 1.0, flinchMult: 1.0, desc: 'Standard factory buttstock / endplate.' },
      collapsed: { id: 'collapsed', name: 'PDW Wire Stock', price: 1600, recoilMult: 0.88, gunKickMult: 1.12, spreadMult: 0.92, adsSpreadMult: 0.94, adsAdd: -0.034, stfMult: 0.80, adsMoveMult: 1.14, idleSwayMult: 1.22, flinchMult: 1.10, desc: '-34ms ADS, -20% Sprint-to-Fire, +14% ADS Strafe (+22% idle sway).' },
      tactical: { id: 'tactical', name: 'CTR Tactical Stock', price: 2800, recoilMult: 0.76, gunKickMult: 0.84, spreadMult: 0.95, adsSpreadMult: 0.82, adsAdd: -0.010, stfMult: 0.94, adsMoveMult: 1.08, idleSwayMult: 0.76, flinchMult: 0.88, desc: '-24% ADS idle sway, -10ms ADS, +8% ADS Strafe, -24% recoil.' },
      heavy_marksman: { id: 'heavy_marksman', name: 'PRS Marksman Stock', price: 4400, recoilMult: 0.66, gunKickMult: 0.70, spreadMult: 0.96, adsSpreadMult: 0.72, adsAdd: 0.036, stfMult: 1.10, adsMoveMult: 0.90, idleSwayMult: 0.52, flinchMult: 0.68, desc: '-48% ADS idle sway, -32% hit flinch, -34% recoil (+36ms ADS).' }
    }
  },

  getWeaponAttachmentOptions(weaponId) {
    const def = this.ITEMS[weaponId];
    if (!def) return {};
    if (def.slot === 'secondary') {
      return {
        optic: ['none', 'red_dot'],
        muzzle: ['none', 'suppressor'],
        underbarrel: ['none', 'laser'],
        magazine: ['none', 'ext_mag']
      };
    }
    if (weaponId === 'm870') {
      return {
        optic: ['none', 'red_dot', 'holo', 'acog_2x'],
        muzzle: ['none', 'compensator', 'suppressor'],
        underbarrel: ['none', 'vert_grip', 'laser'],
        magazine: ['none', 'ext_mag']
      };
    }
    const optics = weaponId === 'mp5k'
      ? ['none', 'red_dot', 'holo', 'acog_2x', 'lpvo_4x']
      : ['none', 'red_dot', 'holo', 'acog_2x', 'lpvo_4x', 'sniper_8x'];
    return {
      optic: optics,
      muzzle: ['none', 'compensator', 'suppressor'],
      underbarrel: ['none', 'vert_grip', 'laser'],
      magazine: ['none', 'ext_mag'],
      stock: ['none', 'collapsed', 'tactical', 'heavy_marksman']
    };
  },

  computeAdsFov(baseFov = 75, zoom = 1.25, adsFovMode = null) {
    const bf = Math.max(40, Math.min(130, Number(baseFov) || 75));
    const z = Math.max(1.0, Number(zoom) || 1.0);
    const mode = adsFovMode || ((typeof window !== 'undefined' && window.ADS_FOV_MODE === 'independent') ? 'independent' : 'affected');
    // MW4 DMZ ADS Field of View:
    //  - Affected: scales dynamically from chosen baseFov (wider periphery, significantly lower perceived visual recoil)
    //  - Independent: low-zoom optics (<2.5x) lock onto MW4's standardized 80° baseline (larger distant targets, stronger visual bounce)
    const refFov = (mode === 'independent' && z < 2.5) ? Math.min(bf, 80) : bf;
    const halfRad = (refFov * 0.5) * (Math.PI / 180);
    const adsRad = 2 * Math.atan(Math.tan(halfRad) / z);
    return Math.max(6.0, Math.min(bf, adsRad * (180 / Math.PI)));
  },

  getZoomSensitivityMultiplier(cameraFov, baseFov = 75, isADS = false) {
    const bf = Math.max(40, Math.min(130, Number(baseFov) || 75));
    const cf = Math.max(5.0, Math.min(135, Number(cameraFov) || bf));
    const tanRatio = Math.tan((cf * 0.5) * (Math.PI / 180)) / Math.max(0.05, Math.tan((bf * 0.5) * (Math.PI / 180)));
    if (!isADS) return Math.min(1.0, tanRatio);
    // Exact focal-length 1/zoom sensitivity scaling with subtle ADS steadiness factor (0.78 at 1x -> 0.26 at 3x -> 0.20 at 4x -> 0.10 at 8x)
    return Math.max(0.06, Math.min(0.85, tanRatio * 0.78));
  },

  getEffectiveWeaponStats(weaponId, mods = {}) {
    const base = this.ITEMS[weaponId];
    if (!base) return null;
    const opt = this.ATTACHMENTS.optic[mods.optic || 'none'] || this.ATTACHMENTS.optic.none;
    const muz = this.ATTACHMENTS.muzzle[mods.muzzle || 'none'] || this.ATTACHMENTS.muzzle.none;
    const und = this.ATTACHMENTS.underbarrel[mods.underbarrel || 'none'] || this.ATTACHMENTS.underbarrel.none;
    const mag = this.ATTACHMENTS.magazine[mods.magazine || 'none'] || this.ATTACHMENTS.magazine.none;
    const stk = this.ATTACHMENTS.stock[mods.stock || 'none'] || this.ATTACHMENTS.stock.none;
    const adsZoom = opt.zoom || base.adsZoom || 1.25;
    const liveBaseFov = (typeof window !== 'undefined' && window.BASE_FOV) ? window.BASE_FOV : 75;
    const computedAdsFov = Math.round(this.computeAdsFov(liveBaseFov, adsZoom));

    const adsAddSum = (opt.adsAdd || 0) + (muz.adsAdd || 0) + (und.adsAdd || 0) + (mag.adsAdd || 0) + (stk.adsAdd || 0);
    const stfMult = (und.stfMult || 1.0) * (mag.stfMult || 1.0) * (stk.stfMult || 1.0);
    const idleSwayMult = (opt.idleSwayMult || 1.0) * (muz.idleSwayMult || 1.0) * (und.idleSwayMult || 1.0) * (stk.idleSwayMult || 1.0);
    const gunKickMult = (muz.gunKickMult || 1.0) * (und.gunKickMult || 1.0) * (stk.gunKickMult || 1.0);
    const flinchMult = stk.flinchMult || 1.0;

    return {
      ...base,
      recoil: base.recoil * muz.recoilMult * und.recoilMult * stk.recoilMult,
      horizRecoil: (base.horizRecoil != null ? base.horizRecoil : base.recoil * 0.48) * muz.recoilMult * und.recoilMult * stk.recoilMult,
      gunKick: (base.gunKick || 1.0) * gunKickMult,
      spread: base.spread * muz.spreadMult * und.spreadMult * stk.spreadMult,
      adsSpread: base.adsSpread * opt.adsSpreadMult * stk.adsSpreadMult,
      adsTime: Math.max(0.085, (base.adsTime || 0.24) + adsAddSum),
      sprintToFire: Math.max(0.045, (base.sprintToFire || 0.16) * stfMult),
      tacSprintToFire: Math.max(0.080, (base.tacSprintToFire || 0.25) * stfMult),
      adsMoveMult: Math.min(0.96, Math.max(0.35, (base.adsMoveMult || 0.65) * (stk.adsMoveMult || 1.0))),
      idleSway: Math.max(0.18, (base.idleSway || 1.0) * idleSwayMult),
      flinchRes: (base.flinchRes || 1.0) / flinchMult,
      adsZoom,
      adsFov: computedAdsFov,
      magSize: Math.ceil(base.magSize * mag.magMult),
      suppressed: !!muz.suppressed,
      hasLaser: !!und.laser,
      mods: {
        optic: opt.id,
        muzzle: muz.id,
        underbarrel: und.id,
        magazine: mag.id,
        stock: stk.id,
        camo: mods.camo || 'none',
        sticker: mods.sticker || 'none',
        charm: mods.charm || 'none'
      }
    };
  },

  COSMETICS: {
    camo: {
      none: { id: 'none', name: 'Factory Finish', price: 0, desc: 'Standard factory receiver finish.' },
      desert_tan: { id: 'desert_tan', name: 'Sahara Sand', price: 1200, color: 0xb89f78, desc: 'Matte wasteland desert tan coating.' },
      od_green: { id: 'od_green', name: 'Ranger Olive', price: 1200, color: 0x4b5c3e, desc: 'Military olive-drab finish.' },
      digital_urban: { id: 'digital_urban', name: 'Urban Digital', price: 2400, pattern: 'digital', desc: 'Pixelated grey-slate urban camouflage.' },
      crimson_tiger: { id: 'crimson_tiger', name: 'Crimson Tiger', price: 3200, pattern: 'tiger', desc: 'Aggressive red & charcoal tiger stripes.' },
      gold_plated: { id: 'gold_plated', name: 'Cartel Gold', price: 6500, color: 0xd4a437, desc: 'Polished gold-plated receiver.' }
    },
    sticker: {
      none: { id: 'none', name: 'No Sticker', price: 0, desc: 'Clean receiver.' },
      skull: { id: 'skull', name: 'Wasteland Skull', price: 800, glyph: '☠', bg: '#1e1e1e', fg: '#e6e4dd', desc: 'Gritty skull emblem on receiver.' },
      hazard: { id: 'hazard', name: 'Biohazard', price: 900, glyph: '☣', bg: '#2b2410', fg: '#f5c542', desc: 'Deadzone biohazard warning decal.' },
      ace: { id: 'ace', name: 'Ace of Spades', price: 1100, glyph: '♠', bg: '#161618', fg: '#ffffff', desc: 'Lucky spade card decal.' },
      star: { id: 'star', name: 'Red Star', price: 1000, glyph: '★', bg: '#2a1212', fg: '#ff4444', desc: 'Crimson tactical star emblem.' }
    },
    charm: {
      none: { id: 'none', name: 'No Charm', price: 0, desc: 'No weapon charm.' },
      dogtag: { id: 'dogtag', name: 'Silver Dogtag', price: 1200, desc: 'Dangling stamped steel dogtag.' },
      bullet: { id: 'bullet', name: 'Brass Cartridge', price: 1400, desc: 'Polished 9mm brass round charm.' },
      cube: { id: 'cube', name: 'Lucky Die', price: 1600, desc: 'Weighted tactical die charm.' },
      grenade: { id: 'grenade', name: 'Mini Frag', price: 2200, desc: 'Miniature olive frag grenade charm.' }
    }
  },

  MISSIONS: [
    { id: 'm_scav_hunt', faction: 'VANGUARD', title: 'SECTOR SWEEP', type: 'kills', target: 5, rewardCredits: 4500, rewardXp: 350, desc: 'Eliminate 5 hostile combatants in any sector.' },
    { id: 'm_loot_run', faction: 'PHANTOM', title: 'SALVAGE RUN', type: 'loot', target: 6, rewardCredits: 3500, rewardXp: 250, desc: 'Open and search 6 loot containers across Vostok.' },
    { id: 'm_clean_exfil', faction: 'VANGUARD', title: 'CLEAN EXTRACTION', type: 'extracts', target: 1, rewardCredits: 5000, rewardXp: 400, desc: 'Successfully extract from an active operation.' },
    { id: 'm_heavy_haul', faction: 'BLACKWOOD', title: 'HIGH-VALUE HAUL', type: 'value', target: 12000, rewardCredits: 7500, rewardXp: 600, desc: 'Extract with ₽12,000+ in recovered loot value.' },
    { id: 'm_operator_bounty', faction: 'BLACKWOOD', title: 'OPERATOR BOUNTY', type: 'kills', target: 12, rewardCredits: 10000, rewardXp: 900, desc: 'Eliminate 12 hostiles across Vostok operations.' },
    { id: 'm_supply_chain', faction: 'PHANTOM', title: 'SUPPLY CHAIN', type: 'extracts', target: 3, rewardCredits: 12000, rewardXp: 1100, desc: 'Complete 3 successful extractions from the wasteland.' }
  ]
};

// ==================== SEMANTIC PRE-RELEASE VERSIONING (0.X.XX ONLY — never >=1.0.0 pre-launch) ====================
// Canonical build label lives in GAME_DATA.VERSION_INFO; GAME_DATA.VERSION is its display string.
// Bump minor/patch per commit, e.g. Alpha RC 0.2.65 -> Alpha RC 0.2.66.
(function initAshfallVersioning() {
  if (!window.GAME_DATA || window.GAME_DATA.__versioningReady) return;
  const info = window.GAME_DATA.VERSION_INFO || { major: 0, minor: 2, patch: 65, channel: 'Alpha', stage: 'RC' };
  window.GAME_DATA.VERSION_INFO = info;
  if (typeof info.semver !== 'string') {
    Object.defineProperty(info, 'semver', { get() { return `${this.major}.${this.minor}.${this.patch}`; }, enumerable: true });
  }
  if (typeof info.label !== 'string') {
    Object.defineProperty(info, 'label', { get() { return `${this.channel} ${this.stage} ${this.major}.${this.minor}.${this.patch}`; }, enumerable: true });
  }
  window.GAME_DATA.VERSION = info.label || window.GAME_DATA.VERSION;

  window.GAME_DATA.parseVersion = function parseVersion(v) {
    const raw = String(v || '').trim();
    if (!raw) return null;
    const m = raw.match(/\b(\d+)\.(\d+)\.(\d+)\b/);
    if (m) {
      const parts = m.slice(1, 4).map(n => parseInt(n, 10) || 0);
      const rest = raw.replace(m[0], '').trim();
      const lowerTag = rest.toLowerCase();
      const channelRank = lowerTag.includes('beta') ? 2 : (lowerTag.includes('alpha') ? 1 : 0);
      return { major: parts[0], minor: parts[1], patch: parts[2], tag: rest, channelRank };
    }
    // Map legacy pre-0.2.65 "v2.64" labels into 0.2.xx (< 0.2.65) so stale tabs never look newer
    const leg = raw.match(/^v(\d+)\.(\d+)$/i);
    if (leg) {
      return { major: 0, minor: parseInt(leg[1], 10) || 0, patch: parseInt(leg[2], 10) || 0, tag: 'legacy', channelRank: 0 };
    }
    return null;
  };
  window.GAME_DATA.getCacheBuster = function getCacheBuster() {
    const p = window.GAME_DATA.parseVersion(window.GAME_DATA.VERSION);
    if (!p) return '0273';
    return `${p.major}${p.minor}${String(p.patch).padStart(2, '0')}`;
  };
  window.GAME_DATA.isNewerVersion = function isNewerVersion(remote, local) {
    const r = window.GAME_DATA.parseVersion(remote);
    const l = window.GAME_DATA.parseVersion(local);
    // Never trigger an update alert when either string fails semantic parsing!
    if (!r || !l) return false;
    for (const k of ['major', 'minor', 'patch']) {
      if ((r[k] || 0) > (l[k] || 0)) return true;
      if ((r[k] || 0) < (l[k] || 0)) return false;
    }
    if (r.channelRank > 0 && l.channelRank > 0 && r.channelRank !== l.channelRank) {
      return r.channelRank > l.channelRank;
    }
    return false;
  };
  window.GAME_DATA.__versioningReady = true;
})();
