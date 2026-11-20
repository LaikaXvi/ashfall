// 3D Post-Apocalyptic Wasteland World Builder
class WastelandWorld {
  constructor(scene, zoneConfig) {
    this.scene = scene;
    this.zone = zoneConfig;
    this.colliders = [];      // { minX, maxX, minY, maxY, minZ, maxZ }
    this.shootableMeshes = []; // Static geometry meshes for bullet/LOS raycasts
    this.lootContainers = []; // { id, name, mesh, position, items, searched, requiresKey }
    this.groundItems = [];    // { id, qty, mesh, position, ringMesh } physical loose & dropped loot
    this.extractZones = [];   // { name, position, radius, beaconMesh, ringMesh }
    this.pois = [];           // { name, x, z, color } for minimap & logical looting
    this.activeSmokes = [];
    this.spawnPoints = [];    // Enemy patrol/spawn positions
    this.operatorSpawns = []; // Far-spaced perimeter & outer-sector Operator Squad infil points
    this.playerSpawn = new THREE.Vector3(0, 1.7, 162);

    this._materials = this._createMaterials();
    this._buildEnvironment();
    this._buildMapLayout();
  }

  _createGroundTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#4a4337';
    ctx.fillRect(0, 0, 512, 512);

    // Dusty patches & rubble noise
    for (let i = 0; i < 4500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const s = Math.random() * 4 + 1;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(95,85,68,0.35)' : 'rgba(38,34,28,0.35)';
      ctx.fillRect(x, y, s, s);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(110, 110);
    return tex;
  }

  _createConcreteTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#5a5c58';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(110,112,108,0.28)' : 'rgba(40,42,40,0.28)';
      ctx.fillRect(x, y, 3, 3);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  _createMaterials() {
    const concreteTex = this._createConcreteTexture();
    return {
      ground: new THREE.MeshLambertMaterial({ map: this._createGroundTexture() }),
      road: new THREE.MeshLambertMaterial({ color: 0x2c2d2b }),
      concrete: new THREE.MeshLambertMaterial({ map: concreteTex, color: 0x777973 }),
      darkConcrete: new THREE.MeshLambertMaterial({ map: concreteTex, color: 0x4b4d49 }),
      rustRed: new THREE.MeshLambertMaterial({ color: 0x6b3a2c }),
      rustOlive: new THREE.MeshLambertMaterial({ color: 0x424a38 }),
      rustBlue: new THREE.MeshLambertMaterial({ color: 0x324652 }),
      wood: new THREE.MeshLambertMaterial({ color: 0x52402d }),
      metal: new THREE.MeshLambertMaterial({ color: 0x3b3e40 }),
      crateMil: new THREE.MeshLambertMaterial({ color: 0x3d4f32 }),
      crateMed: new THREE.MeshLambertMaterial({ color: 0xcfd6cf }),
      crateSup: new THREE.MeshLambertMaterial({ color: 0x78552b })
    };
  }

  _buildEnvironment() {
    // Open Wasteland Ground Plane (900x900m stretching smoothly into the Red Zone horizon)
    this.mapHalfSize = 190;
    const groundGeo = new THREE.PlaneGeometry(900, 900);
    const ground = new THREE.Mesh(groundGeo, this._materials.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.shootableMeshes.push(ground);

    // Main cracked asphalt highways running N-S and E-W across the entire 380m sector
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(11, 380), this._materials.road);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.y = 0.02;
    this.scene.add(roadNS);

    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(380, 11), this._materials.road);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.set(0, 0.025, -12);
    this.scene.add(roadEW);

    // Secondary outer perimeter service roads connecting outer POIs
    const ringN = new THREE.Mesh(new THREE.PlaneGeometry(240, 7), this._materials.road);
    ringN.rotation.x = -Math.PI / 2;
    ringN.position.set(0, 0.022, -108);
    this.scene.add(ringN);

    const ringS = new THREE.Mesh(new THREE.PlaneGeometry(240, 7), this._materials.road);
    ringS.rotation.x = -Math.PI / 2;
    ringS.position.set(0, 0.022, 86);
    this.scene.add(ringS);

    const ringW = new THREE.Mesh(new THREE.PlaneGeometry(7, 200), this._materials.road);
    ringW.rotation.x = -Math.PI / 2;
    ringW.position.set(-112, 0.023, -12);
    this.scene.add(ringW);

    const ringE = new THREE.Mesh(new THREE.PlaneGeometry(7, 200), this._materials.road);
    ringE.rotation.x = -Math.PI / 2;
    ringE.position.set(112, 0.023, -12);
    this.scene.add(ringE);
  }

  _addBox(x, y, z, w, h, d, material, addCollider = true) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.shootableMeshes.push(mesh);

    if (addCollider) {
      this.colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minY: y - h / 2,
        maxY: y + h / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2
      });
    }
    return mesh;
  }

  _addBuilding(cx, cz, w, d, h = 4.5, doorSide = 'south') {
    const t = 0.5; // wall thickness
    const doorW = 3.2;

    // Floor slab
    this._addBox(cx, 0.08, cz, w, 0.16, d, this._materials.darkConcrete, false);
    // Roof
    this._addBox(cx, h + 0.15, cz, w + 0.4, 0.3, d + 0.4, this._materials.darkConcrete, true);

    const buildWallWithDoor = (wx, wz, length, isHorizontal) => {
      const sideLen = (length - doorW) / 2;
      if (isHorizontal) {
        this._addBox(wx - (doorW / 2 + sideLen / 2), h / 2, wz, sideLen, h, t, this._materials.concrete);
        this._addBox(wx + (doorW / 2 + sideLen / 2), h / 2, wz, sideLen, h, t, this._materials.concrete);
        // Header above door
        this._addBox(wx, h - 0.6, wz, doorW, 1.2, t, this._materials.concrete);
      } else {
        this._addBox(wx, h / 2, wz - (doorW / 2 + sideLen / 2), t, h, sideLen, this._materials.concrete);
        this._addBox(wx, h / 2, wz + (doorW / 2 + sideLen / 2), t, h, sideLen, this._materials.concrete);
        this._addBox(wx, h - 0.6, wz, t, 1.2, doorW, this._materials.concrete);
      }
    };

    // North
    if (doorSide === 'north') buildWallWithDoor(cx, cz - d / 2, w, true);
    else this._addBox(cx, h / 2, cz - d / 2, w, h, t, this._materials.concrete);

    // South
    if (doorSide === 'south') buildWallWithDoor(cx, cz + d / 2, w, true);
    else this._addBox(cx, h / 2, cz + d / 2, w, h, t, this._materials.concrete);

    // West
    if (doorSide === 'west') buildWallWithDoor(cx - w / 2, cz, d, false);
    else this._addBox(cx - w / 2, h / 2, cz, t, h, d, this._materials.concrete);

    // East
    if (doorSide === 'east') buildWallWithDoor(cx + w / 2, cz, d, false);
    else this._addBox(cx + w / 2, h / 2, cz, t, h, d, this._materials.concrete);
  }

  _addContainer(x, z, rotY = 0, mat = this._materials.rustRed) {
    const w = rotY === 0 ? 2.6 : 6.5;
    const d = rotY === 0 ? 6.5 : 2.6;
    this._addBox(x, 1.4, z, w, 2.8, d, mat);
  }

  _addBarrier(x, z, horizontal = true) {
    if (horizontal) {
      this._addBox(x, 0.65, z, 3.6, 1.3, 0.7, this._materials.concrete);
    } else {
      this._addBox(x, 0.65, z, 0.7, 1.3, 3.6, this._materials.concrete);
    }
  }

  _addDeadTree(x, z) {
    this._addBox(x, 2.0, z, 0.45, 4.0, 0.45, this._materials.wood);
    this._addBox(x + 0.6, 3.4, z, 1.4, 0.22, 0.22, this._materials.wood, false);
    this._addBox(x - 0.5, 2.9, z + 0.4, 0.2, 0.2, 1.2, this._materials.wood, false);
  }

  _rollLoot(tableKey, count = 2) {
    const table = GAME_DATA.LOOT_TABLES[tableKey] || GAME_DATA.LOOT_TABLES.supply;
    const totalW = table.reduce((s, e) => s + e.w, 0);
    const items = [];

    for (let i = 0; i < count; i++) {
      let r = Math.random() * totalW;
      for (const entry of table) {
        r -= entry.w;
        if (r <= 0) {
          let qty = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
          const def = GAME_DATA.ITEMS[entry.id];
          if (def && def.containerMaxStack) qty = Math.min(qty, def.containerMaxStack);
          items.push({ id: entry.id, qty, revealed: false });
          break;
        }
      }
    }
    return items;
  }

  _rollBossKeyRoomLoot() {
    // Guaranteed 1 Legendary weapon (25% chance Ultra), 4 Epic spawns, 8 Rare spawns, ZERO common items!
    const items = [];
    const wPool = GAME_DATA.LOOT_TABLES.boss_legendary_weapons || ['ak74m', 'm24'];
    const wId = wPool[Math.floor(Math.random() * wPool.length)];
    const isUltra = Math.random() < 0.25;
    const mods = isUltra
      ? { optic: 'lpvo_4x', muzzle: 'suppressor', underbarrel: 'vert_grip', magazine: 'ext_mag', stock: 'heavy_marksman' }
      : { optic: 'acog_2x', muzzle: 'compensator', underbarrel: 'vert_grip', magazine: 'ext_mag' };
    items.push({ id: wId, qty: 1, mods, rarityOverride: isUltra ? 'ultra' : 'legendary', revealed: false });

    const epicPool = GAME_DATA.LOOT_TABLES.boss_epic || ['intel_drive'];
    for (let i = 0; i < 4; i++) {
      const id = epicPool[Math.floor(Math.random() * epicPool.length)];
      items.push({ id, qty: 1, revealed: false });
    }
    const rarePool = GAME_DATA.LOOT_TABLES.boss_rare || ['water_filter'];
    for (let i = 0; i < 8; i++) {
      const id = rarePool[Math.floor(Math.random() * rarePool.length)];
      const def = GAME_DATA.ITEMS[id];
      const qty = (def && def.type === 'ammo') ? 20 : 1;
      items.push({ id, qty, revealed: false });
    }
    return items;
  }

  _addLootContainer(x, y, z, kind = 'supply', customName = null, requiresKey = null) {
    let mat = this._materials.crateSup;
    let name = customName || 'Supply Crate';
    let w = 1.1, h = 0.75, d = 0.75;
    let count = 2 + this.zone.lootTierBonus;
    let items;

    if (kind === 'boss_key_room') {
      mat = new THREE.MeshLambertMaterial({ color: 0x8f6b1e });
      name = customName || 'Boss Armory Vault [KEY ROOM]';
      w = 1.8; h = 0.9; d = 1.0;
      items = this._rollBossKeyRoomLoot();
    } else if (kind === 'military') {
      mat = this._materials.crateMil;
      name = customName || 'Military Weapon Case';
      w = 1.4; h = 0.65; d = 0.8;
      count = 3 + this.zone.lootTierBonus;
      items = this._rollLoot('military', count);
    } else if (kind === 'hospital' || kind === 'medical') {
      mat = this._materials.crateMed;
      name = customName || 'Clinic Medical Cabinet';
      w = 0.85; h = 0.6; d = 0.6;
      items = this._rollLoot('hospital', 3);
    } else if (kind === 'police_fire') {
      mat = this._materials.rustBlue;
      name = customName || 'Police / Fire Locker';
      w = 1.2; h = 0.8; d = 0.75;
      items = this._rollLoot('police_fire', 3);
    } else {
      items = this._rollLoot('supply', count);
    }

    const mesh = this._addBox(x, y + h / 2, z, w, h, d, mat, true);
    this.lootContainers.push({
      id: 'crate_' + this.lootContainers.length,
      name,
      kind,
      mesh,
      position: new THREE.Vector3(x, y + h / 2, z),
      items,
      requiresKey: requiresKey || null,
      unlocked: !requiresKey,
      searched: false
    });
  }

  _addExtractZone(name, x, z, radius = 5.5) {
    const ringGeo = new THREE.RingGeometry(radius - 0.35, radius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x55ff88,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(x, 0.06, z);
    this.scene.add(ringMesh);

    const beamGeo = new THREE.CylinderGeometry(0.45, 0.9, 28, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x44ff77,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide
    });
    const beaconMesh = new THREE.Mesh(beamGeo, beamMat);
    beaconMesh.position.set(x, 14, z);
    this.scene.add(beaconMesh);

    this.extractZones.push({
      name,
      position: new THREE.Vector3(x, 0, z),
      radius,
      ringMesh,
      beaconMesh
    });
  }

  _buildMapLayout() {
    // Open Sector Perimeter — NO outer concrete walls! Visual 3D Red Zone hazard border lines & warning posts at ±190m
    const B = this.mapHalfSize || 190;
    const redLineMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
    const redZoneMat = new THREE.MeshBasicMaterial({ color: 0xff1e1e, transparent: true, opacity: 0.16, side: THREE.DoubleSide });
    const addRedBorderStrip = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), redLineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.05, z);
      this.scene.add(m);
    };
    const addRedZoneBand = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), redZoneMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.04, z);
      this.scene.add(m);
    };
    // Glowing crimson perimeter border lines at ±190m
    addRedBorderStrip(0, -B, B * 2, 0.9);
    addRedBorderStrip(0, B, B * 2, 0.9);
    addRedBorderStrip(-B, 0, 0.9, B * 2);
    addRedBorderStrip(B, 0, 0.9, B * 2);
    // Red-tinted out-of-bounds ground band surrounding the entire sector (190m -> 310m)
    const bandW = 120;
    addRedZoneBand(0, -(B + bandW / 2), (B + bandW) * 2, bandW);
    addRedZoneBand(0, (B + bandW / 2), (B + bandW) * 2, bandW);
    addRedZoneBand(-(B + bandW / 2), 0, bandW, B * 2);
    addRedZoneBand((B + bandW / 2), 0, bandW, B * 2);

    // Sparse hazard warning beacons along the Red Zone edge
    const postMat = new THREE.MeshLambertMaterial({ color: 0x2a2c2e });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xff3d3d });
    for (let p = -B; p <= B; p += 38) {
      const pts = [[p, -B], [p, B], [-B, p], [B, p]];
      for (const [px, pz] of pts) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.2, 0.28), postMat);
        post.position.set(px, 1.1, pz);
        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), bulbMat);
        bulb.position.set(px, 2.35, pz);
        this.scene.add(post, bulb);
      }
    }

    // === 8 SPREAD-OUT TACTICAL POI BUILDINGS & LANDMARKS ===

    // 1. Military Compound (North-West Sector) -> Gun Lockers, Armory Shelves, Workbench & Wall First Aid
    this._addBuilding(-88, -86, 18, 16, 5.0, 'east');
    this.pois.push({ name: 'COMPOUND', x: -88, z: -86, color: '#ab47bc' });
    this._addGunLocker(-96.1, -89.0, Math.PI / 2, 'military', 'Compound Rifle Locker');
    this._addGunLocker(-96.1, -83.5, Math.PI / 2, 'military', 'Compound Armory Locker');
    this._addLootContainer(-93.2, 0.16, -79.8, 'supply', 'Compound Materials Crate');
    this._addWallFirstAidKit(-84.0, -78.55, 'south', 'Compound Wall First Aid Kit');
    this._addMetalShelf(-90.0, -92.9, 0, [
      { id: 'ammo_545', qty: 30 },
      { id: 'armor_plate', qty: 2 },
      { id: 'frag_grenade', qty: 1 }
    ]);
    this._addMetalShelf(-85.0, -92.9, 0, [
      { id: 'ammo_762', qty: 20 },
      { id: 'gunpowder', qty: 2 },
      { id: 'polymer_parts', qty: 2 }
    ]);
    this._addWorkbenchTable(-87.5, -86.0, 0, [
      { id: 'armor_plate', qty: 2 },
      { id: 'scrap_metal', qty: 3 }
    ]);

    // 2. Field Hospital & Clinic (East Sector) -> Wall First Aid Kits, Bathroom Medicine Cabinet, Medical Shelves & Triage Table
    this._addBuilding(94, -56, 14, 12, 4.4, 'west');
    this.pois.push({ name: 'CLINIC', x: 94, z: -56, color: '#69f0ae' });
    this._addWallFirstAidKit(91.5, -61.55, 'north', 'Clinic Wall First Aid Kit');
    this._addWallFirstAidKit(100.55, -57.5, 'east', 'Trauma Room First Aid Kit');
    this._addBox(96.8, 1.7, -52.2, 0.22, 3.2, 3.2, this._materials.concrete);
    this._addMedicineCabinet(98.6, -50.45, 'south', 'Clinic Bathroom Medicine Cabinet');
    this._addLootContainer(99.2, 0.16, -60.2, 'hospital', 'Hospital Trauma Crate');
    this._addMetalShelf(95.2, -61.1, 0, [
      { id: 'bandage', qty: 2 },
      { id: 'painkillers', qty: 1 },
      { id: 'cloth_roll', qty: 2 }
    ]);
    this._addWorkbenchTable(93.5, -55.5, 0, [
      { id: 'medkit', qty: 1 },
      { id: 'water_filter', qty: 1 }
    ]);

    // 3. Police & Fire Station (South-West Sector) -> Police Gun Lockers, Bathroom Medicine Cabinet, Wall First Aid & Evidence Shelves
    this._addBuilding(-96, 74, 16, 12, 4.4, 'east');
    this.pois.push({ name: 'POLICE/FIRE', x: -96, z: 74, color: '#42a5f5' });
    this._addGunLocker(-103.1, 71.8, Math.PI / 2, 'police_fire', 'Police Gun Locker');
    this._addGunLocker(-103.1, 75.8, Math.PI / 2, 'police_fire', 'Fire & Rescue Gear Locker');
    this._addWallFirstAidKit(-92.0, 68.45, 'north', 'Station Wall First Aid Kit');
    this._addBox(-94.2, 1.7, 77.6, 0.22, 3.2, 3.0, this._materials.concrete);
    this._addMedicineCabinet(-92.0, 79.55, 'south', 'Station Bathroom Medicine Cabinet');
    this._addMetalShelf(-97.5, 68.9, 0, [
      { id: 'armor_plate', qty: 2 },
      { id: 'ammo_9x19', qty: 24 },
      { id: 'ammo_12g', qty: 12 }
    ]);
    this._addWorkbenchTable(-96.0, 74.0, 0, [
      { id: 'smoke_grenade', qty: 1 },
      { id: 'armor_plate', qty: 1 }
    ]);

    // 4. Boss Encampment & Armory Key Room (Far North-East Fortress)
    this._addBuilding(116, -126, 14, 14, 4.8, 'south');
    this.pois.push({ name: 'BOSS CAMP', x: 116, z: -126, color: '#ffc107' });
    this._addLootContainer(116, 0.16, -130.8, 'boss_key_room', 'Boss Encampment Key Room', 'boss_key');
    this._addGunLocker(122.1, -126.5, -Math.PI / 2, 'military', 'Boss Guard Gun Locker');
    this._addWallFirstAidKit(109.45, -124.2, 'west', 'Encampment Wall First Aid Kit');
    this._addWorkbenchTable(116.0, -125.2, 0, [
      { id: 'ammo_762', qty: 20 },
      { id: 'gold_watch', qty: 1 }
    ]);
    // Outer defensive sandbag/concrete perimeter around Boss Camp
    this._addBarrier(105, -116, true);
    this._addBarrier(126, -116, true);
    this._addContainer(102, -130, 0, this._materials.rustOlive);

    // 5. Central Logistics Warehouse (Mid-Sector Crossroads Hub)
    this._addBuilding(-24, -22, 20, 14, 5.2, 'south');
    this.pois.push({ name: 'WAREHOUSE', x: -24, z: -22, color: '#ff9800' });
    this._addLootContainer(-31.8, 0.16, -26.8, 'military', 'Warehouse Armory Case');
    this._addLootContainer(-16.2, 0.16, -26.8, 'supply', 'Logistics Cargo Crate');
    this._addMetalShelf(-27.0, -28.0, 0, [
      { id: 'scrap_metal', qty: 3 },
      { id: 'polymer_parts', qty: 2 },
      { id: 'ammo_545', qty: 24 }
    ]);
    this._addMetalShelf(-21.0, -28.0, 0, [
      { id: 'cloth_roll', qty: 2 },
      { id: 'gunpowder', qty: 2 },
      { id: 'fuel_can', qty: 1 }
    ]);
    this._addWorkbenchTable(-24.0, -21.5, 0, [
      { id: 'medkit', qty: 1 },
      { id: 'armor_plate', qty: 2 }
    ]);

    // 6. Fuel & Radio Outpost (South-East Sector)
    this._addBuilding(104, 82, 14, 12, 4.4, 'west');
    this.pois.push({ name: 'RADIO OUTPOST', x: 104, z: 82, color: '#26c6da' });
    this._addGunLocker(110.1, 80.2, -Math.PI / 2, 'military', 'Outpost Comms Locker');
    this._addLootContainer(109.2, 0.16, 85.8, 'supply', 'Fuel & Parts Supply Crate');
    this._addWallFirstAidKit(101.5, 76.45, 'north', 'Outpost First Aid Kit');
    this._addWorkbenchTable(104.0, 82.0, 0, [
      { id: 'intel_drive', qty: 1 },
      { id: 'fuel_can', qty: 1 }
    ]);
    this._addContainer(92, 92, 1, this._materials.rustRed);

    // 7. Rail Yard / Container Depot (Far West Sector)
    this.pois.push({ name: 'RAIL YARD', x: -126, z: -8, color: '#ef5350' });
    this._addContainer(-126, -16, 1, this._materials.rustRed);
    this._addContainer(-126, -4, 1, this._materials.rustBlue);
    this._addContainer(-134, 4, 0, this._materials.rustOlive);
    this._addContainer(-118, 6, 0, this._materials.rustRed);
    this._addLootContainer(-126, 0, -10, 'military', 'Rail Yard Weapon Case');
    this._addLootContainer(-122, 0, 8, 'supply', 'Freight Cargo Crate');
    this._addWorkbenchTable(-130, 2, 0, [
      { id: 'armor_plate', qty: 2 },
      { id: 'ammo_762', qty: 20 }
    ], 0);

    // 8. Northern Watchtower Bunker (Far North Sector)
    this._addBuilding(-22, -138, 12, 10, 4.5, 'south');
    this.pois.push({ name: 'NORTH BUNKER', x: -22, z: -138, color: '#ec407a' });
    this._addGunLocker(-27.1, -138.5, Math.PI / 2, 'military', 'Bunker Marksman Locker');
    this._addLootContainer(-17.8, 0.16, -141.2, 'military', 'Bunker Munitions Case');
    this._addWallFirstAidKit(-22.0, -142.55, 'north', 'Bunker First Aid Kit');

    // === MID-FIELD COVER, CHECKPOINTS & SHIPPING CONTAINERS (Sightline Breaks Across Wasteland) ===
    // South Highway Checkpoint (safe first loot stop north of player spawn)
    this._addBarrier(-8, 134, true);
    this._addBarrier(8, 126, true);
    this._addContainer(-16, 122, 0, this._materials.rustOlive);
    this._addLootContainer(-13, 0, 124, 'supply', 'Highway Checkpoint Crate');

    // Central Crossroads & Mid-Road Cover
    this._addContainer(18, 22, 0, this._materials.rustRed);
    this._addContainer(22, 22, 0, this._materials.rustOlive);
    this._addContainer(34, -18, 1, this._materials.rustBlue);
    this._addContainer(28, -68, 0, this._materials.rustRed);
    this._addContainer(-54, -46, 1, this._materials.rustOlive);
    this._addContainer(-48, 36, 0, this._materials.rustBlue);
    this._addContainer(52, 46, 1, this._materials.rustRed);
    this._addContainer(56, -96, 1, this._materials.rustOlive);
    this._addContainer(-58, -118, 0, this._materials.rustRed);
    this._addContainer(142, 16, 0, this._materials.rustBlue);
    this._addContainer(-142, 124, 1, this._materials.rustOlive);

    // Concrete Barriers along highways & flanks
    const barriers = [
      [-7, 74, true], [7, 58, true], [-7, 14, false], [7, -42, false],
      [-7, -76, true], [7, -112, true], [48, -18, false], [-52, -6, false],
      [62, 18, true], [-64, 52, true], [82, -92, true], [-76, -124, true],
      [42, 108, true], [-46, 118, true], [136, -42, false], [-136, -64, false]
    ];
    for (const [bx, bz, horiz] of barriers) {
      this._addBarrier(bx, bz, horiz);
    }

    // Scattered outdoor loot crates along routes
    this._addLootContainer(20, 0, 26, 'supply');
    this._addLootContainer(26, 0, -64, 'supply');
    this._addLootContainer(54, 0, 48, 'military');
    this._addLootContainer(4, 0, -104, 'medical');
    this._addLootContainer(-52, 0, 38, 'supply');
    this._addLootContainer(140, 0, 18, 'military');
    this._addLootContainer(-56, 0, -116, 'supply');

    // === LOGICAL LOOSE LOOT SPAWNS ACROSS CHECKPOINTS & COVER ===
    this._spawnLogicalLooseLoot();

    // Dead trees & wasteland groves for mid-range cover & landmarks
    const treeCoords = [
      [-148, -148], [-152, 34], [-138, 142], [148, -28], [154, 132], [138, -158],
      [-48, -162], [58, 144], [-34, 88], [44, -44], [-68, 12], [68, -22],
      [-112, -138], [122, 34], [-82, 124], [86, 136], [-156, -78], [158, -86],
      [18, -146], [-12, 96], [76, 48], [-74, -48], [32, 68], [-38, -68]
    ];
    for (const [tx, tz] of treeCoords) {
      this._addDeadTree(tx, tz);
    }

    // === 3 SPREAD-OUT EXTRACTION ZONES (OUTER RIM) ===
    this._addExtractZone('NORTH HELIPAD', -14, -172, 6.0);
    this._addExtractZone('EAST BUNKER GATE', 172, -18, 6.0);
    this._addExtractZone('WEST CONVOY EXIT', -172, 118, 6.0);

    // === FAR-SPACED OPERATOR SQUAD INFIL POINTS (Every squad starts >= 90m from player & spread around the 380m perimeter!) ===
    this.operatorSpawns = [
      new THREE.Vector3(-156, 0, -152), // Far NW
      new THREE.Vector3(156, 0, -156),  // Far NE
      new THREE.Vector3(-160, 0, 26),   // Far West
      new THREE.Vector3(158, 0, 142),   // Far SE
      new THREE.Vector3(158, 0, -68),   // Far East
      new THREE.Vector3(-148, 0, 148),  // Far SW
      new THREE.Vector3(38, 0, -162),   // Far North
      new THREE.Vector3(-68, 0, -156)   // North-NW
    ];

    // === GENERAL PATROL / SPAWN POINTS ACROSS ALL SECTORS ===
    this.spawnPoints = [
      new THREE.Vector3(-76, 0, -82),
      new THREE.Vector3(84, 0, -54),
      new THREE.Vector3(-84, 0, 72),
      new THREE.Vector3(106, 0, -118),
      new THREE.Vector3(-14, 0, -16),
      new THREE.Vector3(94, 0, 80),
      new THREE.Vector3(-118, 0, -6),
      new THREE.Vector3(-18, 0, -130),
      new THREE.Vector3(46, 0, 38),
      new THREE.Vector3(-48, 0, 32),
      new THREE.Vector3(48, 0, -78),
      new THREE.Vector3(-56, 0, -114)
    ];
  }

  spawnGroundItem(id, qty = 1, pos = new THREE.Vector3(0, 0.02, 0), opts = {}) {
    const def = GAME_DATA.ITEMS[id];
    if (!def) return null;

    const rarKey = def.rarity || 'common';
    const rarInfo = (GAME_DATA.RARITIES && GAME_DATA.RARITIES[rarKey]) || { color: '#4caf50' };
    const rarColor = new THREE.Color(rarInfo.color);

    const g = new THREE.Group();
    const yBase = pos.y !== undefined ? pos.y : 0.02;
    g.position.set(pos.x, yBase, pos.z);
    g.rotation.y = opts.rotY !== undefined ? opts.rotY : Math.random() * Math.PI * 2;

    // Subtle rarity halo ring so loose & dropped items are readable on shelves, tables, or ground
    const ringInner = opts.onSurface ? 0.13 : 0.20;
    const ringOuter = opts.onSurface ? 0.18 : 0.27;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(ringInner, ringOuter, 20),
      new THREE.MeshBasicMaterial({ color: rarColor, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    g.add(ring);

    // Distinct 3D item silhouette based on item category
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x26292c });
    const accentMat = new THREE.MeshLambertMaterial({ color: rarColor });
    if (def.type === 'weapon') {
      let built = null;
      if (!this._wpnBuilder && typeof WeaponSystem !== 'undefined') {
        this._wpnBuilder = new WeaponSystem(this.scene, new THREE.Object3D());
      }
      const wb = this._wpnBuilder || (window.itemIcons && window.itemIcons._ensureWeaponBuilder && window.itemIcons._ensureWeaponBuilder());
      if (wb && typeof wb.buildThirdPersonWeapon === 'function') {
        built = wb.buildThirdPersonWeapon(def, opts.mods || {});
      }
      if (built && built.group) {
        const wGroup = built.group;
        const s = built.isPistol ? 1.32 : 1.42;
        wGroup.scale.setScalar(s);
        // Lay the physical 3D weapon flat on its side on the ground / table surface
        wGroup.rotation.set(0.06, 0, Math.PI / 2 - 0.10);
        wGroup.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(wGroup);
        const center = new THREE.Vector3();
        box.getCenter(center);
        wGroup.position.x -= center.x;
        wGroup.position.z -= center.z;
        wGroup.position.y -= (box.min.y - 0.022);
        g.add(wGroup);
      } else {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, 0.62), darkMat);
        body.position.y = 0.06;
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.26), new THREE.MeshLambertMaterial({ color: 0x151719 }));
        barrel.position.set(0, 0.07, 0.36);
        g.add(body, barrel);
      }
    } else if (def.type === 'med') {
      const pouch = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.11, 0.19),
        new THREE.MeshLambertMaterial({ color: id === 'painkillers' ? 0xd8a84a : 0xdde3df })
      );
      pouch.position.y = 0.065;
      g.add(pouch);
      if (id === 'medkit') {
        const crossMat = new THREE.MeshBasicMaterial({ color: 0xd93838 });
        const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.04), crossMat);
        const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.12), crossMat);
        c1.position.y = 0.125;
        c2.position.y = 0.125;
        g.add(c1, c2);
      }
    } else if (def.type === 'ammo') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.14), new THREE.MeshLambertMaterial({ color: 0x5d643d }));
      box.position.y = 0.065;
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.03, 0.145), new THREE.MeshLambertMaterial({ color: 0xc99c3c }));
      band.position.y = 0.08;
      g.add(box, band);
    } else if (def.type === 'plate' || def.type === 'armor') {
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.36), new THREE.MeshLambertMaterial({ color: 0x353c34 }));
      vest.position.y = 0.055;
      g.add(vest);
    } else if (def.type === 'backpack') {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.42), new THREE.MeshLambertMaterial({ color: 0x4b4636 }));
      pack.position.y = 0.085;
      g.add(pack);
    } else {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), accentMat);
      crate.position.y = 0.075;
      g.add(crate);
    }

    this.scene.add(g);
    const entry = {
      uid: opts.uid || ('gi_' + Math.random().toString(36).slice(2, 9)),
      id,
      qty,
      mods: opts.mods || null,
      mag: opts.mag !== undefined ? opts.mag : undefined,
      mesh: g,
      ringMesh: ring,
      position: new THREE.Vector3(pos.x, yBase, pos.z)
    };
    this.groundItems.push(entry);
    return entry;
  }

  removeGroundItemByUid(uid) {
    if (!uid) return;
    const entry = this.groundItems.find(g => g && g.uid === uid);
    if (entry) this.removeGroundItem(entry);
  }

  removeGroundItem(entry) {
    if (!entry) return;
    const idx = this.groundItems.indexOf(entry);
    if (idx !== -1) this.groundItems.splice(idx, 1);
    if (entry.mesh && this.scene) this.scene.remove(entry.mesh);
  }

  spawnBossPack(pos, bossName = 'Sector Boss') {
    const g = new THREE.Group();
    const yBase = Math.max(0.02, pos.y || 0.02);
    g.position.set(pos.x, yBase, pos.z);
    g.rotation.y = Math.random() * Math.PI * 2;

    const packMat = new THREE.MeshLambertMaterial({ color: 0x3a2f24 });
    const strapMat = new THREE.MeshLambertMaterial({ color: 0x1c1e1d });
    const trimMat = new THREE.MeshBasicMaterial({ color: 0xffc107 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.34), packMat);
    body.position.y = 0.12;
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), strapMat);
    pocket.position.set(0, 0.10, 0.20);
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.02), trimMat);
    tag.position.set(0, 0.25, 0);
    g.add(body, pocket, tag);
    this.scene.add(g);

    const legWpns = (GAME_DATA.LOOT_TABLES && GAME_DATA.LOOT_TABLES.boss_legendary_weapons) || ['ak74m', 'm24', 'm870'];
    const legPick = legWpns[Math.floor(Math.random() * legWpns.length)];
    const legId = typeof legPick === 'string' ? legPick : legPick.id;
    const valuables = ['gold_watch', 'intel_drive', 'water_filter', 'fuel_can'].sort(() => Math.random() - 0.5);

    const items = [
      { id: 'boss_key', qty: 1, revealed: false },
      { id: legId, qty: 1, rarityOverride: 'legendary', revealed: false },
      { id: valuables[0], qty: 1, revealed: false },
      { id: valuables[1], qty: 1, revealed: false }
    ];

    const container = {
      id: 'boss_pack_' + this.lootContainers.length,
      name: `${bossName} Small Pack`,
      kind: 'boss',
      mesh: g,
      position: new THREE.Vector3(pos.x, yBase + 0.22, pos.z),
      items,
      requiresKey: null,
      unlocked: true,
      searched: false
    };
    this.lootContainers.push(container);
    return container;
  }

  _addGunLocker(x, z, rotY = 0, kind = 'military', customName = 'Gun Locker') {
    const g = new THREE.Group();
    g.position.set(x, 0.16, z);
    g.rotation.y = rotY;

    const bodyMat = kind === 'police_fire'
      ? new THREE.MeshLambertMaterial({ color: 0x2f4352 })
      : new THREE.MeshLambertMaterial({ color: 0x354231 });
    const trimMat = new THREE.MeshLambertMaterial({ color: 0x1a1e1d });
    const handleMat = new THREE.MeshLambertMaterial({ color: 0xb0b8b4 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.05, 0.62), bodyMat);
    body.position.y = 1.025;
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.95, 0.04), trimMat);
    seam.position.set(0, 1.025, 0.31);
    const ventL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.03), trimMat);
    ventL.position.set(-0.28, 1.78, 0.31);
    const ventR = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.03), trimMat);
    ventR.position.set(0.28, 1.78, 0.31);
    const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.06), handleMat);
    handleL.position.set(-0.08, 1.05, 0.33);
    const handleR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.06), handleMat);
    handleR.position.set(0.08, 1.05, 0.33);

    g.add(body, seam, ventL, ventR, handleL, handleR);
    this.scene.add(g);

    const w = Math.abs(Math.sin(rotY)) > 0.5 ? 0.65 : 1.15;
    const d = Math.abs(Math.sin(rotY)) > 0.5 ? 1.15 : 0.65;
    this.colliders.push({
      minX: x - w / 2, maxX: x + w / 2,
      minY: 0.16, maxY: 2.21,
      minZ: z - d / 2, maxZ: z + d / 2
    });
    this.shootableMeshes.push(body);

    const count = 3 + this.zone.lootTierBonus;
    const items = this._rollLoot(kind === 'police_fire' ? 'police_fire' : 'military', count);
    this.lootContainers.push({
      id: 'locker_' + this.lootContainers.length,
      name: customName,
      kind,
      mesh: g,
      position: new THREE.Vector3(x, 1.15, z),
      items,
      requiresKey: null,
      unlocked: true,
      searched: false
    });
  }

  _addWallFirstAidKit(x, z, wallSide = 'north', customName = 'Wall First Aid Kit') {
    const g = new THREE.Group();
    const rotMap = { north: 0, south: Math.PI, west: Math.PI / 2, east: -Math.PI / 2 };
    g.position.set(x, 1.48, z);
    g.rotation.y = rotMap[wallSide] || 0;

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.42, 0.18),
      new THREE.MeshLambertMaterial({ color: 0xe2e8e4 })
    );
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xd93030 });
    const cH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.02), crossMat);
    const cV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.02), crossMat);
    cH.position.z = 0.095;
    cV.position.z = 0.095;
    g.add(box, cH, cV);
    this.scene.add(g);

    const items = this._rollLoot('hospital', 2);
    // Guarantee at least one medical item (medkit/bandage/painkillers) inside wall first aid kits
    if (!items.some(it => it.id === 'medkit' || it.id === 'bandage' || it.id === 'painkillers')) {
      items.unshift({ id: 'medkit', qty: 1, revealed: false });
    }
    this.lootContainers.push({
      id: 'firstaid_' + this.lootContainers.length,
      name: customName,
      kind: 'hospital',
      mesh: g,
      position: new THREE.Vector3(x, 1.48, z),
      items,
      requiresKey: null,
      unlocked: true,
      searched: false
    });
  }

  _addMedicineCabinet(x, z, wallSide = 'south', customName = 'Bathroom Medicine Cabinet') {
    const g = new THREE.Group();
    const rotMap = { north: 0, south: Math.PI, west: Math.PI / 2, east: -Math.PI / 2 };
    g.position.set(x, 1.52, z);
    g.rotation.y = rotMap[wallSide] || 0;

    // White cabinet frame + reflective pale mirror face
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.78, 0.18),
      new THREE.MeshLambertMaterial({ color: 0xd8deda })
    );
    const mirror = new THREE.Mesh(
      new THREE.BoxGeometry(0.60, 0.66, 0.02),
      new THREE.MeshLambertMaterial({ color: 0x8fb0bf })
    );
    mirror.position.z = 0.09;
    // Sink vanity below cabinet
    const sink = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.16, 0.44),
      new THREE.MeshLambertMaterial({ color: 0xcfd4d0 })
    );
    sink.position.set(0, -0.68, 0.16);
    g.add(frame, mirror, sink);
    this.scene.add(g);

    const items = this._rollLoot('hospital', 2);
    if (!items.some(it => it.id === 'medkit' || it.id === 'painkillers')) {
      items.unshift({ id: Math.random() < 0.65 ? 'medkit' : 'painkillers', qty: 1, revealed: false });
    }
    this.lootContainers.push({
      id: 'medcab_' + this.lootContainers.length,
      name: customName,
      kind: 'hospital',
      mesh: g,
      position: new THREE.Vector3(x, 1.52, z),
      items,
      requiresKey: null,
      unlocked: true,
      searched: false
    });
  }

  _addMetalShelf(x, z, rotY = 0, lootItems = []) {
    const g = new THREE.Group();
    const floorY = 0.16;
    g.position.set(x, floorY, z);
    g.rotation.y = rotY;

    const postMat = this._materials.metal;
    const boardMat = this._materials.darkConcrete;
    const w = 2.0, d = 0.62, h = 1.95;

    for (const px of [-w / 2 + 0.04, w / 2 - 0.04]) {
      for (const pz of [-d / 2 + 0.04, d / 2 - 0.04]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), postMat);
        post.position.set(px, h / 2, pz);
        g.add(post);
      }
    }
    const shelfHeights = [0.55, 1.15, 1.75];
    for (const sy of shelfHeights) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), boardMat);
      board.position.y = sy;
      g.add(board);
      this.shootableMeshes.push(board);
    }
    this.scene.add(g);

    const cw = Math.abs(Math.sin(rotY)) > 0.5 ? d : w;
    const cd = Math.abs(Math.sin(rotY)) > 0.5 ? w : d;
    this.colliders.push({
      minX: x - cw / 2, maxX: x + cw / 2,
      minY: floorY, maxY: floorY + h,
      minZ: z - cd / 2, maxZ: z + cd / 2
    });

    // Spawn loose loot resting cleanly ON the shelf boards!
    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);
    lootItems.forEach((it, idx) => {
      if (!GAME_DATA.ITEMS[it.id] || Math.random() > 0.88) return;
      const localX = (idx - (lootItems.length - 1) / 2) * 0.58;
      const shelfY = floorY + (idx % 2 === 0 ? 1.18 : 0.58);
      const wx = x + localX * cosR;
      const wz = z - localX * sinR;
      this.spawnGroundItem(it.id, it.qty, new THREE.Vector3(wx, shelfY, wz), { onSurface: true, rotY });
    });
  }

  _addWorkbenchTable(x, z, rotY = 0, lootItems = [], floorY = 0.16) {
    const g = new THREE.Group();
    g.position.set(x, floorY, z);
    g.rotation.y = rotY;

    const w = 2.0, d = 0.88, h = 0.82;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), this._materials.wood);
    top.position.y = h;
    g.add(top);
    this.shootableMeshes.push(top);

    for (const lx of [-w / 2 + 0.08, w / 2 - 0.08]) {
      for (const lz of [-d / 2 + 0.08, d / 2 - 0.08]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.08), this._materials.metal);
        leg.position.set(lx, h / 2, lz);
        g.add(leg);
      }
    }
    this.scene.add(g);

    const cw = Math.abs(Math.sin(rotY)) > 0.5 ? d : w;
    const cd = Math.abs(Math.sin(rotY)) > 0.5 ? w : d;
    this.colliders.push({
      minX: x - cw / 2, maxX: x + cw / 2,
      minY: floorY, maxY: floorY + h + 0.04,
      minZ: z - cd / 2, maxZ: z + cd / 2
    });

    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);
    lootItems.forEach((it, idx) => {
      if (!GAME_DATA.ITEMS[it.id] || Math.random() > 0.90) return;
      const localX = (idx - (lootItems.length - 1) / 2) * 0.65;
      const wx = x + localX * cosR;
      const wz = z - localX * sinR;
      this.spawnGroundItem(it.id, it.qty, new THREE.Vector3(wx, floorY + h + 0.04, wz), { onSurface: true, rotY });
    });
  }

  _spawnLogicalLooseLoot() {
    // Outdoor field tables & crate tops near shipping containers & roadblock checkpoints (never dumped on bare dirt!)
    this._addWorkbenchTable(-12.5, 126.5, 0, [
      { id: 'scrap_metal', qty: 2 },
      { id: 'bandage', qty: 1 }
    ], 0);
    this._addWorkbenchTable(24.5, 22.8, Math.PI / 2, [
      { id: 'gunpowder', qty: 2 },
      { id: 'ammo_9x18', qty: 20 }
    ], 0);
    this._addWorkbenchTable(31.2, -66.5, 0, [
      { id: 'ammo_545', qty: 24 },
      { id: 'polymer_parts', qty: 2 }
    ], 0);
    this._addWorkbenchTable(-51.5, -43.2, Math.PI / 2, [
      { id: 'armor_plate', qty: 1 },
      { id: 'frag_grenade', qty: 1 }
    ], 0);
    this._addWorkbenchTable(54.2, 49.5, 0, [
      { id: 'medkit', qty: 1 },
      { id: 'ammo_9x19', qty: 24 }
    ], 0);
  }

  update(dt, time) {
    // Animate extraction beacons
    for (const ez of this.extractZones) {
      ez.beaconMesh.rotation.y += dt * 0.8;
      const pulse = 0.18 + Math.sin(time * 3.0) * 0.08;
      ez.beaconMesh.material.opacity = pulse;
    }
    // Subtle pulse on loose & dropped ground item rings
    for (const gi of this.groundItems) {
      if (gi.ringMesh && gi.ringMesh.material) {
        gi.ringMesh.material.opacity = 0.48 + Math.sin(time * 3.2 + gi.position.x) * 0.20;
      }
    }
  }
}
