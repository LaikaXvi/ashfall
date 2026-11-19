// Game Item Database, Weapons, Armor, Meds, Valuables, and Zones
window.GAME_DATA = {
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
      reloadTime: 2.6,
      spread: 0.035,
      adsSpread: 0.001,
      recoil: 0.075,
      adsFov: 32,
      range: 240,
      pellets: 1,
      color: 0x454a3a,
      desc: '7.62mm bolt-action rifle. High-zoom optics, lethal precision.'
    },

    // === AMMO ===
    ammo_9x18: {
      id: 'ammo_9x18',
      name: '9x18mm FMJ',
      type: 'ammo',
      rarity: 'common',
      value: 15, // per round
      weight: 0.01,
      stackable: true,
      buyQty: 24,
      desc: 'Standard 9x18mm pistol rounds.'
    },
    ammo_9x19: {
      id: 'ammo_9x19',
      name: '9x19mm Parabellum',
      type: 'ammo',
      rarity: 'common',
      value: 20,
      weight: 0.012,
      stackable: true,
      buyQty: 30,
      desc: '9x19mm rounds for pistols and SMGs.'
    },
    ammo_545: {
      id: 'ammo_545',
      name: '5.45x39mm BP',
      type: 'ammo',
      rarity: 'uncommon',
      value: 35,
      weight: 0.015,
      stackable: true,
      buyQty: 30,
      desc: 'Armor-piercing 5.45mm rifle cartridges.'
    },
    ammo_12g: {
      id: 'ammo_12g',
      name: '12ga Buckshot',
      type: 'ammo',
      rarity: 'common',
      value: 45,
      weight: 0.04,
      stackable: true,
      buyQty: 12,
      desc: '12-gauge 00 buckshot shells.'
    },
    ammo_762: {
      id: 'ammo_762',
      name: '7.62x51mm M80',
      type: 'ammo',
      rarity: 'rare',
      value: 90,
      weight: 0.025,
      stackable: true,
      buyQty: 10,
      desc: 'Heavy full-power rifle cartridges.'
    },

    // === ARMOR (DMZ 1-3 Plate Vests & Ceramic Plates) ===
    vest_1plate: {
      id: 'vest_1plate',
      name: '1-Plate Carrier',
      type: 'armor',
      rarity: 'common',
      value: 2200,
      weight: 2.2,
      plateSlots: 1,
      maxArmor: 50,
      desc: 'Standard 1-plate tactical carrier (50 Armor).'
    },
    vest_2plate: {
      id: 'vest_2plate',
      name: '2-Plate Carrier',
      type: 'armor',
      rarity: 'rare',
      value: 5800,
      weight: 3.4,
      plateSlots: 2,
      maxArmor: 100,
      desc: 'Reinforced 2-plate carrier (100 Armor).'
    },
    vest_3plate: {
      id: 'vest_3plate',
      name: '3-Plate Heavy Vest',
      type: 'armor',
      rarity: 'epic',
      value: 11500,
      weight: 4.8,
      plateSlots: 3,
      maxArmor: 150,
      desc: 'Special-ops 3-plate carrier (150 Armor).'
    },
    armor_plate: {
      id: 'armor_plate',
      name: 'Ceramic Armor Plate',
      type: 'plate',
      rarity: 'uncommon',
      value: 450,
      weight: 0.45,
      plateArmor: 50,
      stackable: true,
      buyQty: 3,
      desc: 'Restores 1 armor plate (+50 Armor). Press [G] to insert.'
    },
    // Legacy save compatibility
    vest_scrap: {
      id: 'vest_scrap',
      name: '1-Plate Carrier',
      type: 'armor',
      rarity: 'common',
      value: 2200,
      weight: 2.2,
      plateSlots: 1,
      maxArmor: 50,
      desc: 'Standard 1-plate tactical carrier (50 Armor).'
    },
    vest_tactical: {
      id: 'vest_tactical',
      name: '2-Plate Carrier',
      type: 'armor',
      rarity: 'rare',
      value: 5800,
      weight: 3.4,
      plateSlots: 2,
      maxArmor: 100,
      desc: 'Reinforced 2-plate carrier (100 Armor).'
    },

    // === MEDS ===
    medkit: {
      id: 'medkit',
      name: 'Field Medkit',
      type: 'med',
      rarity: 'uncommon',
      value: 950,
      weight: 0.4,
      healAmount: 55,
      stackable: true,
      buyQty: 1,
      desc: 'Restores 55 HP during combat (Press H).'
    },

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
      throwSpeed: 17.5,
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
      throwSpeed: 26.0,
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
      throwSpeed: 16.5,
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
      throwSpeed: 17.5,
      stackable: true,
      buyQty: 2,
      desc: 'Disorients and stuns hostiles in blast radius for 5s ([Q]).'
    },

    // === BARTER / VALUABLES ===
    scrap_metal: {
      id: 'scrap_metal',
      name: 'Salvaged Electronics',
      type: 'valuable',
      rarity: 'common',
      value: 650,
      weight: 0.6,
      desc: 'Intact circuit boards and copper wiring.'
    },
    water_filter: {
      id: 'water_filter',
      name: 'Military Water Filter',
      type: 'valuable',
      rarity: 'uncommon',
      value: 1450,
      weight: 0.8,
      desc: 'High-demand survival purifier.'
    },
    fuel_can: {
      id: 'fuel_can',
      name: 'Refined Fuel Canister',
      type: 'valuable',
      rarity: 'uncommon',
      value: 2100,
      weight: 2.2,
      desc: 'Clean generator fuel. Heavy but valuable.'
    },
    intel_drive: {
      id: 'intel_drive',
      name: 'Encrypted Hard Drive',
      type: 'valuable',
      rarity: 'rare',
      value: 3800,
      weight: 0.4,
      desc: 'Pre-collapse bunker telemetry data.'
    },
    gold_watch: {
      id: 'gold_watch',
      name: 'Antique Officer Watch',
      type: 'valuable',
      rarity: 'rare',
      value: 4600,
      weight: 0.15,
      desc: 'Pristine mechanical timepiece.'
    },
    gpu_unit: {
      id: 'gpu_unit',
      name: 'Military GPU Module',
      type: 'valuable',
      rarity: 'epic',
      value: 8200,
      weight: 1.1,
      desc: 'Rare intact tactical compute board.'
    },
    dogtag: {
      id: 'dogtag',
      name: 'Raider Dogtag',
      type: 'valuable',
      rarity: 'uncommon',
      value: 1200,
      weight: 0.05,
      desc: 'Proof of hostile elimination.'
    }
  },

  TRADER_STOCK: {
    weapons: ['pm9', 'g17', 'mp5k', 'm870', 'ak74m', 'm24'],
    ammo: ['ammo_9x18', 'ammo_9x19', 'ammo_12g', 'ammo_545', 'ammo_762'],
    gear: ['medkit', 'armor_plate', 'vest_1plate', 'vest_2plate', 'vest_3plate', 'frag_grenade', 'throwing_knife', 'smoke_grenade', 'concussion_grenade']
  },

  ZONES: {
    outpost: {
      id: 'outpost',
      name: 'Dustline Outpost',
      raidDuration: 420, // 7 minutes
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
      raidDuration: 480, // 8 minutes
      enemyCount: 10,
      raiderChance: 0.5,
      heavyChance: 0.2,
      lootTierBonus: 1,
      fogColor: 0x2b2d2b,
      skyColor: 0x383b38
    }
  },

  LOOT_TABLES: {
    military: [
      { id: 'ammo_545', min: 15, max: 30, w: 22 },
      { id: 'ammo_762', min: 5, max: 12, w: 12 },
      { id: 'ammo_12g', min: 6, max: 12, w: 14 },
      { id: 'intel_drive', min: 1, max: 1, w: 14 },
      { id: 'gpu_unit', min: 1, max: 1, w: 7 },
      { id: 'armor_plate', min: 1, max: 3, w: 14 },
      { id: 'vest_2plate', min: 1, max: 1, w: 6 },
      { id: 'vest_3plate', min: 1, max: 1, w: 3 },
      { id: 'mp5k', min: 1, max: 1, w: 6 },
      { id: 'ak74m', min: 1, max: 1, w: 5 },
      { id: 'medkit', min: 1, max: 1, w: 11 }
    ],
    medical: [
      { id: 'medkit', min: 1, max: 2, w: 55 },
      { id: 'water_filter', min: 1, max: 1, w: 25 },
      { id: 'gold_watch', min: 1, max: 1, w: 10 },
      { id: 'scrap_metal', min: 1, max: 2, w: 10 }
    ],
    supply: [
      { id: 'scrap_metal', min: 1, max: 2, w: 28 },
      { id: 'water_filter', min: 1, max: 1, w: 20 },
      { id: 'fuel_can', min: 1, max: 1, w: 16 },
      { id: 'ammo_9x19', min: 12, max: 25, w: 16 },
      { id: 'ammo_9x18', min: 10, max: 20, w: 10 },
      { id: 'gold_watch', min: 1, max: 1, w: 6 },
      { id: 'medkit', min: 1, max: 1, w: 4 }
    ]
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
