// Game Item Database, 5-Tier Loot Rarity, Logical POI Tables, Workbench & Attachments
// IMPORTANT: Update GAME_DATA.VERSION (and ?v= cache-busters in index.html) with EVERY new commit!
window.GAME_DATA = {
  VERSION: 'v1.88',
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
      adsFov: 32,
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
      adsFov: 24,
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

    // === MEDS (Hospitals & Clinics) ===
    bandage: { id: 'bandage', name: 'Sterile Bandage', type: 'med', rarity: 'common', value: 350, weight: 0.15, healAmount: 25, stackable: true, maxStack: 4, buyQty: 2, desc: 'Quick field dressing (+25 HP).' },
    painkillers: { id: 'painkillers', name: 'Tactical Painkillers', type: 'med', rarity: 'rare', value: 1100, weight: 0.2, healAmount: 40, stackable: true, maxStack: 3, buyQty: 1, desc: 'Fast-acting analgesic bottle (+40 HP).' },
    medkit: { id: 'medkit', name: 'Field Medkit', type: 'med', rarity: 'rare', value: 1450, weight: 0.4, healAmount: 55, stackable: true, maxStack: 3, buyQty: 1, desc: 'Full IFAK medical kit (+55 HP, Press H).' },

    // === THROWABLES (Lethals & Tacticals) ===
    frag_grenade: {
      id: 'frag_grenade',
      name: 'M67 Frag Grenade',
      type: 'lethal',
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

    // === COMMON CRAFTING MATERIALS (Stack to 10; used in Workbench or bulk sold) ===
    scrap_metal: {
      id: 'scrap_metal',
      name: 'Salvaged Steel',
      type: 'material',
      rarity: 'common',
      value: 320,
      weight: 0.35,
      stackable: true,
      maxStack: 10,
      desc: 'Common crafting alloy. Stacks to 10. Used at Workbench or sold in bulk.'
    },
    cloth_roll: {
      id: 'cloth_roll',
      name: 'Ballistic Cloth',
      type: 'material',
      rarity: 'common',
      value: 280,
      weight: 0.25,
      stackable: true,
      maxStack: 10,
      desc: 'Common woven fabric for crafting meds, vests & packs. Stacks to 10.'
    },
    gunpowder: {
      id: 'gunpowder',
      name: 'Smokeless Powder',
      type: 'material',
      rarity: 'common',
      value: 360,
      weight: 0.3,
      stackable: true,
      maxStack: 10,
      desc: 'Common propellant for crafting ordnance & ammo. Stacks to 10.'
    },
    polymer_parts: {
      id: 'polymer_parts',
      name: 'Polymer Components',
      type: 'material',
      rarity: 'common',
      value: 300,
      weight: 0.25,
      stackable: true,
      maxStack: 10,
      desc: 'Common tactical polymers for Workbench crafting. Stacks to 10.'
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

    // === SELF-REVIVE & KEYS & HIGH-VALUE BARTER ===
    self_revive: {
      id: 'self_revive',
      name: 'Self-Revive Kit',
      type: 'self_revive',
      rarity: 'epic',
      value: 6500,
      weight: 0.6,
      desc: 'Dedicated emergency epinephrine auto-injector. Hold [E] while downed to revive yourself.'
    },
    boss_key: {
      id: 'boss_key',
      name: 'Encampment Armory Key',
      type: 'key',
      rarity: 'legendary',
      value: 12000,
      weight: 0.05,
      desc: 'Unlocks the Boss Encampment Key Room (Guaranteed Legendary/Ultra weapon + 4 Epic + 8 Rare).'
    },
    water_filter: {
      id: 'water_filter',
      name: 'Military Water Filter',
      type: 'valuable',
      rarity: 'rare',
      value: 2400,
      weight: 0.8,
      desc: 'Rare survival purifier.'
    },
    fuel_can: {
      id: 'fuel_can',
      name: 'Refined Fuel Canister',
      type: 'valuable',
      rarity: 'rare',
      value: 3100,
      weight: 2.2,
      desc: 'Rare clean generator fuel.'
    },
    intel_drive: {
      id: 'intel_drive',
      name: 'Encrypted Hard Drive',
      type: 'valuable',
      rarity: 'epic',
      value: 5800,
      weight: 0.4,
      desc: 'Epic pre-collapse bunker telemetry data.'
    },
    gold_watch: {
      id: 'gold_watch',
      name: 'Antique Officer Watch',
      type: 'valuable',
      rarity: 'epic',
      value: 6600,
      weight: 0.15,
      desc: 'Epic mechanical gold timepiece.'
    },
    gpu_unit: {
      id: 'gpu_unit',
      name: 'Military GPU Module',
      type: 'valuable',
      rarity: 'legendary',
      value: 12800,
      weight: 1.1,
      desc: 'Legendary intact tactical compute board.'
    },
    black_box: {
      id: 'black_box',
      name: 'Classified Flight Recorder',
      type: 'valuable',
      rarity: 'ultra',
      value: 22500,
      weight: 1.4,
      desc: 'Ultra-rare orbital command black box.'
    },
    dogtag: {
      id: 'dogtag',
      name: 'Operator Dogtag',
      type: 'valuable',
      rarity: 'rare',
      value: 1800,
      weight: 0.05,
      desc: 'Proof of operator elimination.'
    }
  },

  WORKBENCH_RECIPES: [
    {
      id: 'craft_plates',
      outputId: 'armor_plate',
      outputQty: 3,
      name: '3x Ceramic Armor Plates',
      desc: 'Press salvaged steel and ballistic cloth into 3 ceramic plates.',
      ingredients: [{ id: 'scrap_metal', qty: 2 }, { id: 'cloth_roll', qty: 1 }]
    },
    {
      id: 'craft_medkit',
      outputId: 'medkit',
      outputQty: 1,
      name: 'Field Medkit',
      desc: 'Assemble a full IFAK Field Medkit from sterile cloth and polymer.',
      ingredients: [{ id: 'cloth_roll', qty: 2 }, { id: 'polymer_parts', qty: 1 }]
    },
    {
      id: 'craft_self_revive',
      outputId: 'self_revive',
      outputQty: 1,
      name: 'Self-Revive Kit',
      desc: 'Synthesize an Epic Self-Revive auto-injector for solo or last-stand recovery.',
      ingredients: [{ id: 'cloth_roll', qty: 3 }, { id: 'polymer_parts', qty: 3 }, { id: 'scrap_metal', qty: 2 }]
    },
    {
      id: 'craft_frag',
      outputId: 'frag_grenade',
      outputQty: 2,
      name: '2x M67 Frag Grenades',
      desc: 'Pack smokeless powder into steel fragmentation casings.',
      ingredients: [{ id: 'scrap_metal', qty: 2 }, { id: 'gunpowder', qty: 2 }]
    },
    {
      id: 'craft_gel_vest',
      outputId: 'vest_2plate_gel',
      outputQty: 1,
      name: '2-Plate Ballistic Gel Vest',
      desc: 'Fabricate a Rare 2-plate ballistic gel armor carrier.',
      ingredients: [{ id: 'scrap_metal', qty: 3 }, { id: 'cloth_roll', qty: 3 }, { id: 'polymer_parts', qty: 2 }]
    },
    {
      id: 'craft_med_bag',
      outputId: 'bag_medium',
      outputQty: 1,
      name: 'Assault Pack (12 Slots)',
      desc: 'Stitch a Rare 12-slot operator backpack.',
      ingredients: [{ id: 'cloth_roll', qty: 4 }, { id: 'polymer_parts', qty: 2 }]
    },
    {
      id: 'craft_boss_key',
      outputId: 'boss_key',
      outputQty: 1,
      name: 'Encampment Armory Key',
      desc: 'Mill a Legendary Armory Key for Boss Encampment key rooms.',
      ingredients: [{ id: 'scrap_metal', qty: 4 }, { id: 'polymer_parts', qty: 4 }, { id: 'gunpowder', qty: 2 }]
    }
  ],

  TRADER_STOCK: {
    weapons: ['pm9', 'g17', 'mp5k', 'm870', 'ak74m', 'mosin9130', 'm24', 'awm338'],
    ammo: ['ammo_9x18', 'ammo_9x19', 'ammo_12g', 'ammo_545', 'ammo_762', 'ammo_rocket'],
    gear: [
      'bandage', 'painkillers', 'medkit', 'self_revive', 'gas_mask', 'nvg_goggles', 'armor_plate',
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
      name: 'Dustline Outpost',
      raidDuration: 600, // 10 minutes
      enemyCount: 6,
      raiderChance: 0.35,
      heavyChance: 0.05,
      lootTierBonus: 0,
      fogColor: 0x3a362e,
      skyColor: 0x4b463b
    },
    industrial: {
      id: 'industrial',
      name: 'Rustyard Compound',
      raidDuration: 660, // 11 minutes
      enemyCount: 10,
      raiderChance: 0.5,
      heavyChance: 0.2,
      lootTierBonus: 1,
      fogColor: 0x2b2d2b,
      skyColor: 0x383b38
    }
  },

  LOOT_TABLES: {
    // Location-based logical loot tables
    hospital: [
      { id: 'medkit', min: 1, max: 2, w: 30 },
      { id: 'bandage', min: 1, max: 3, w: 28 },
      { id: 'painkillers', min: 1, max: 2, w: 22 },
      { id: 'self_revive', min: 1, max: 1, w: 12 },
      { id: 'cloth_roll', min: 1, max: 3, w: 8 }
    ],
    police_fire: [
      { id: 'vest_1plate', min: 1, max: 1, w: 18 },
      { id: 'vest_2plate', min: 1, max: 1, w: 10 },
      { id: 'bag_small', min: 1, max: 1, w: 14 },
      { id: 'pm9', min: 1, max: 1, w: 12 },
      { id: 'g17', min: 1, max: 1, w: 10 },
      { id: 'mp5k', min: 1, max: 1, w: 8 },
      { id: 'armor_plate', min: 1, max: 3, w: 16 },
      { id: 'ammo_9x19', min: 20, max: 45, w: 12 }
    ],
    military: [
      { id: 'ammo_545', min: 20, max: 45, w: 18 },
      { id: 'ammo_762', min: 8, max: 16, w: 10 },
      { id: 'ammo_12g', min: 6, max: 12, w: 10 },
      { id: 'armor_plate', min: 1, max: 3, w: 14 },
      { id: 'vest_2plate_gel', min: 1, max: 1, w: 8 },
      { id: 'vest_2plate_helmet', min: 1, max: 1, w: 5 },
      { id: 'vest_3plate', min: 1, max: 1, w: 2 },
      { id: 'bag_medium', min: 1, max: 1, w: 6 },
      { id: 'bag_weapon', min: 1, max: 1, w: 4 },
      { id: 'gas_mask', min: 1, max: 1, w: 5 },
      { id: 'nvg_goggles', min: 1, max: 1, w: 3 },
      { id: 'intel_drive', min: 1, max: 1, w: 8 },
      { id: 'gpu_unit', min: 1, max: 1, w: 5 },
      { id: 'ak74m', min: 1, max: 1, w: 6 },
      { id: 'mosin9130', min: 1, max: 1, w: 5 },
      { id: 'awm338', min: 1, max: 1, w: 3 },
      { id: 'boss_key', min: 1, max: 1, w: 3 },
      { id: 'medkit', min: 1, max: 1, w: 5 }
    ],
    medical: [
      { id: 'medkit', min: 1, max: 2, w: 38 },
      { id: 'bandage', min: 1, max: 3, w: 30 },
      { id: 'painkillers', min: 1, max: 2, w: 22 },
      { id: 'cloth_roll', min: 1, max: 3, w: 10 }
    ],
    supply: [
      { id: 'scrap_metal', min: 2, max: 5, w: 24 },
      { id: 'cloth_roll', min: 2, max: 5, w: 20 },
      { id: 'gunpowder', min: 2, max: 4, w: 18 },
      { id: 'polymer_parts', min: 2, max: 5, w: 20 },
      { id: 'water_filter', min: 1, max: 1, w: 10 },
      { id: 'fuel_can', min: 1, max: 1, w: 8 }
    ],
    // Boss Encampment Key Room pools (ZERO common items!)
    boss_epic: ['vest_2plate_helmet', 'bag_large', 'bag_weapon', 'intel_drive', 'gold_watch', 'fu_dead_silence', 'ks_uav', 'melee_karambit', 'ammo_rocket'],
    boss_rare: ['vest_2plate_gel', 'bag_medium', 'water_filter', 'fuel_can', 'painkillers', 'medkit', 'fu_ammo_box', 'fu_trophy', 'ammo_762'],
    boss_legendary_weapons: ['ak74m', 'm24', 'awm338', 'mosin9130', 'mp5k', 'm870']
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
      none: { id: 'none', name: 'Factory Sights', price: 0, recoilMult: 1.0, spreadMult: 1.0, adsSpreadMult: 1.0, adsFovOverride: null, desc: 'Standard factory iron sights / default optic.' },
      red_dot: { id: 'red_dot', name: 'Cobra Reflex Red Dot', price: 2200, recoilMult: 1.0, spreadMult: 1.0, adsSpreadMult: 0.72, adsFovOverride: 62, desc: 'Slim open reflex sight. -28% ADS spread.' },
      holo: { id: 'holo', name: 'EXPS3 Holographic', price: 2800, recoilMult: 0.98, spreadMult: 1.0, adsSpreadMult: 0.66, adsFovOverride: 58, desc: 'Hooded circle-dot holographic sight. -34% ADS spread.' },
      acog_2x: { id: 'acog_2x', name: 'TA-31 3x Prism Scope', price: 4200, recoilMult: 1.0, spreadMult: 1.0, adsSpreadMult: 0.54, adsFovOverride: 40, desc: '3x cylindrical prism optic with BDC reticle. -46% ADS spread.' },
      lpvo_4x: { id: 'lpvo_4x', name: 'Vortex 1-4x LPVO', price: 5600, recoilMult: 1.0, spreadMult: 1.0, adsSpreadMult: 0.44, adsFovOverride: 30, desc: '4x variable tactical tube optic. -56% ADS spread.' },
      sniper_8x: { id: 'sniper_8x', name: 'Mk5 8x Long-Range', price: 7800, recoilMult: 1.0, spreadMult: 1.0, adsSpreadMult: 0.30, adsFovOverride: 18, desc: '8x precision sniper optic with mil-dot stadia. -70% ADS spread.' }
    },
    muzzle: {
      none: { id: 'none', name: 'Factory Muzzle', price: 0, recoilMult: 1.0, spreadMult: 1.0, suppressed: false, desc: 'Standard barrel crown.' },
      compensator: { id: 'compensator', name: 'Tactical Compensator', price: 1800, recoilMult: 0.72, spreadMult: 0.92, suppressed: false, desc: 'Ported brake. -28% recoil.' },
      suppressor: { id: 'suppressor', name: 'PBS Tactical Suppressor', price: 3800, recoilMult: 0.82, spreadMult: 0.95, suppressed: true, desc: 'Muffles gunfire & halves enemy alert radius (-18% recoil).' }
    },
    underbarrel: {
      none: { id: 'none', name: 'Standard Rail', price: 0, recoilMult: 1.0, spreadMult: 1.0, laser: false, desc: 'No underbarrel attachment.' },
      vert_grip: { id: 'vert_grip', name: 'RK-1 Vertical Grip', price: 1600, recoilMult: 0.78, spreadMult: 0.85, laser: false, desc: '-22% recoil, -15% hipfire spread.' },
      laser: { id: 'laser', name: 'PEQ-15 Tactical Laser', price: 2400, recoilMult: 0.94, spreadMult: 0.62, laser: true, desc: 'Visible aiming laser. -38% hipfire spread.' }
    },
    magazine: {
      none: { id: 'none', name: 'Standard Mag', price: 0, magMult: 1.0, desc: 'Factory magazine capacity.' },
      ext_mag: { id: 'ext_mag', name: 'Extended Magazine', price: 2600, magMult: 1.35, desc: '+35% magazine capacity.' }
    },
    stock: {
      none: { id: 'none', name: 'Factory Stock', price: 0, recoilMult: 1.0, spreadMult: 1.0, adsSpreadMult: 1.0, desc: 'Standard factory buttstock / endplate.' },
      collapsed: { id: 'collapsed', name: 'PDW Wire Stock', price: 1600, recoilMult: 0.88, spreadMult: 0.92, adsSpreadMult: 0.94, desc: 'Lightweight telescoping wire rails. -12% recoil, -8% hip spread.' },
      tactical: { id: 'tactical', name: 'CTR Tactical Stock', price: 2800, recoilMult: 0.76, spreadMult: 0.95, adsSpreadMult: 0.82, desc: 'Ergonomic carbine stock with rubber buttpad. -24% recoil, -18% ADS spread.' },
      heavy_marksman: { id: 'heavy_marksman', name: 'PRS Marksman Stock', price: 4400, recoilMult: 0.66, spreadMult: 0.96, adsSpreadMult: 0.72, desc: 'Heavy reinforced stock with cheek riser. -34% recoil, -28% ADS spread.' }
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

  getEffectiveWeaponStats(weaponId, mods = {}) {
    const base = this.ITEMS[weaponId];
    if (!base) return null;
    const opt = this.ATTACHMENTS.optic[mods.optic || 'none'] || this.ATTACHMENTS.optic.none;
    const muz = this.ATTACHMENTS.muzzle[mods.muzzle || 'none'] || this.ATTACHMENTS.muzzle.none;
    const und = this.ATTACHMENTS.underbarrel[mods.underbarrel || 'none'] || this.ATTACHMENTS.underbarrel.none;
    const mag = this.ATTACHMENTS.magazine[mods.magazine || 'none'] || this.ATTACHMENTS.magazine.none;
    const stk = this.ATTACHMENTS.stock[mods.stock || 'none'] || this.ATTACHMENTS.stock.none;

    return {
      ...base,
      recoil: base.recoil * muz.recoilMult * und.recoilMult * stk.recoilMult,
      horizRecoil: (base.horizRecoil != null ? base.horizRecoil : base.recoil * 0.48) * muz.recoilMult * und.recoilMult * stk.recoilMult,
      spread: base.spread * muz.spreadMult * und.spreadMult * stk.spreadMult,
      adsSpread: base.adsSpread * opt.adsSpreadMult * stk.adsSpreadMult,
      adsFov: opt.adsFovOverride || base.adsFov,
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
  }
};
