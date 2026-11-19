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
    this.playerSpawn = new THREE.Vector3(0, 1.7, 64);

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
    tex.repeat.set(24, 24);
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
    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const ground = new THREE.Mesh(groundGeo, this._materials.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.shootableMeshes.push(ground);

    // Cracked asphalt road running N-S and E-W
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(10, 160), this._materials.road);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.y = 0.02;
    this.scene.add(roadNS);

    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(160, 10), this._materials.road);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.set(0, 0.025, -10);
    this.scene.add(roadEW);
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
    // Perimeter walls (160x160 arena: -80 to +80)
    const wallH = 5.5;
    this._addBox(0, wallH / 2, -80, 160, wallH, 1.5, this._materials.darkConcrete);
    this._addBox(0, wallH / 2, 80, 160, wallH, 1.5, this._materials.darkConcrete);
    this._addBox(-80, wallH / 2, 0, 1.5, wallH, 160, this._materials.darkConcrete);
    this._addBox(80, wallH / 2, 0, 1.5, wallH, 160, this._materials.darkConcrete);

    // === LOGICAL POI BUILDINGS ===
    // 1. Military Compound (north-west of crossroads) -> Rare/Epic gear, gel/helmet vests, rifles
    this._addBuilding(-24, -26, 16, 14, 5.0, 'east');
    this.pois.push({ name: 'COMPOUND', x: -24, z: -26, color: '#ab47bc' });
    this._addLootContainer(-28, 0.16, -29, 'military', 'Compound Armory Crate');
    this._addLootContainer(-28, 0.16, -23, 'supply', 'Compound Materials Crate');

    // 2. Field Hospital & Clinic (east of crossroads) -> Medkits, Bandages, Painkillers
    this._addBuilding(24, -18, 12, 10, 4.2, 'west');
    this.pois.push({ name: 'CLINIC', x: 24, z: -18, color: '#69f0ae' });
    this._addLootContainer(26, 0.16, -18, 'hospital', 'Hospital Trauma Locker');
    this._addLootContainer(23, 0.16, -15, 'hospital', 'Clinic Pharmacy Cabinet');

    // 3. Police & Fire Station (south-west) -> 1-2 Plate Carriers, Small Packs, Small Arms
    this._addBuilding(-28, 22, 14, 10, 4.2, 'east');
    this.pois.push({ name: 'POLICE/FIRE', x: -28, z: 22, color: '#42a5f5' });
    this._addLootContainer(-31, 0.16, 22, 'police_fire', 'Police Armory Locker');
    this._addLootContainer(-26, 0.16, 19, 'police_fire', 'Fire Station Gear Locker');

    // 4. Boss Encampment & Armory Key Room (north-east) -> Guaranteed Legendary/Ultra + 4 Epic + 8 Rare (0 Common!)
    this._addBuilding(34, -48, 12, 12, 4.5, 'south');
    this.pois.push({ name: 'BOSS CAMP', x: 34, z: -48, color: '#ffc107' });
    this._addLootContainer(34, 0.16, -51, 'boss_key_room', 'Boss Encampment Key Room', 'boss_key');
    this._addLootContainer(37, 0.16, -47, 'military', 'Boss Guard Weapon Case');

    // === SHIPPING CONTAINERS & COVER ===
    this._addContainer(-8, 12, 0, this._materials.rustRed);
    this._addContainer(-4.5, 12, 0, this._materials.rustOlive);
    this._addContainer(12, 8, 1, this._materials.rustBlue);
    this._addContainer(14, -36, 0, this._materials.rustRed);
    this._addContainer(-44, -4, 1, this._materials.rustOlive);
    this._addContainer(44, 24, 0, this._materials.rustRed);

    // Concrete Barriers along roads
    this._addBarrier(-6, 36, true);
    this._addBarrier(6, 28, true);
    this._addBarrier(-6, -14, false);
    this._addBarrier(6, -22, false);
    this._addBarrier(16, 4, true);
    this._addBarrier(-18, -8, true);

    // Scattered outdoor loot crates
    this._addLootContainer(-6, 0, 15, 'supply');
    this._addLootContainer(12, 0, -34, 'supply');
    this._addLootContainer(42, 0, 26, 'military');
    this._addLootContainer(2, 0, -55, 'medical');

    // === LOGICAL LOOSE LOOT SPAWNS ACROSS POIs & COVER ===
    this._spawnLogicalLooseLoot();

    // Dead trees & wasteland props
    const treeCoords = [
      [-55, -55], [-60, 15], [-48, 52], [52, -12],
      [60, 48], [45, -62], [-18, -62], [22, 54]
    ];
    for (const [tx, tz] of treeCoords) {
      this._addDeadTree(tx, tz);
    }

    // === EXTRACTION ZONES ===
    this._addExtractZone('NORTH HELIPAD', -4, -68, 5.5);
    this._addExtractZone('EAST BUNKER GATE', 68, -10, 5.5);

    // === ENEMY SPAWN / PATROL POINTS ===
    this.spawnPoints = [
      new THREE.Vector3(-14, 0, -24),
      new THREE.Vector3(16, 0, -16),
      new THREE.Vector3(-20, 0, 20),
      new THREE.Vector3(28, 0, -42),
      new THREE.Vector3(0, 0, -48),
      new THREE.Vector3(38, 0, 18),
      new THREE.Vector3(-42, 0, -10),
      new THREE.Vector3(14, 0, 12),
      new THREE.Vector3(-12, 0, -56),
      new THREE.Vector3(52, 0, -20)
    ];
  }

  spawnGroundItem(id, qty = 1, pos = new THREE.Vector3(0, 0.02, 0)) {
    const def = GAME_DATA.ITEMS[id];
    if (!def) return null;

    const rarKey = def.rarity || 'common';
    const rarInfo = (GAME_DATA.RARITIES && GAME_DATA.RARITIES[rarKey]) || { color: '#4caf50' };
    const rarColor = new THREE.Color(rarInfo.color);

    const g = new THREE.Group();
    const yBase = Math.max(0.02, pos.y || 0.02);
    g.position.set(pos.x, yBase, pos.z);
    g.rotation.y = Math.random() * Math.PI * 2;

    // Subtle rarity halo ring on the floor so loose & dropped items are easy to spot
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.20, 0.27, 20),
      new THREE.MeshBasicMaterial({ color: rarColor, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    g.add(ring);

    // Distinct 3D item silhouette based on item category
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x26292c });
    const accentMat = new THREE.MeshLambertMaterial({ color: rarColor });
    if (def.type === 'weapon') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, 0.62), darkMat);
      body.position.y = 0.06;
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.26), new THREE.MeshLambertMaterial({ color: 0x151719 }));
      barrel.position.set(0, 0.07, 0.36);
      g.add(body, barrel);
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
      uid: 'gi_' + Math.random().toString(36).slice(2, 9),
      id,
      qty,
      mesh: g,
      ringMesh: ring,
      position: new THREE.Vector3(pos.x, yBase, pos.z)
    };
    this.groundItems.push(entry);
    return entry;
  }

  removeGroundItem(entry) {
    if (!entry) return;
    const idx = this.groundItems.indexOf(entry);
    if (idx !== -1) this.groundItems.splice(idx, 1);
    if (entry.mesh && this.scene) this.scene.remove(entry.mesh);
  }

  _spawnLogicalLooseLoot() {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const spawnSpots = [
      // Field Hospital & Clinic (medical supplies)
      { x: 21.5, y: 0.16, z: -20.0, pool: [{ id: 'medkit', qty: 1 }, { id: 'bandage', qty: 2 }, { id: 'painkillers', qty: 1 }] },
      { x: 25.0, y: 0.16, z: -15.5, pool: [{ id: 'medkit', qty: 1 }, { id: 'painkillers', qty: 1 }] },
      { x: 22.0, y: 0.16, z: -16.2, pool: [{ id: 'bandage', qty: 2 }, { id: 'cloth_roll', qty: 2 }, { id: 'water_filter', qty: 1 }] },
      { x: 27.2, y: 0.16, z: -20.5, pool: [{ id: 'medkit', qty: 1 }, { id: 'bandage', qty: 1 }] },

      // Police & Fire Station (armor plates, small arms, tactical gear)
      { x: -24.5, y: 0.16, z: 24.0, pool: [{ id: 'armor_plate', qty: 2 }, { id: 'ammo_9x19', qty: 24 }, { id: 'ammo_12g', qty: 12 }] },
      { x: -29.0, y: 0.16, z: 24.5, pool: [{ id: 'pm9', qty: 1 }, { id: 'm870', qty: 1 }, { id: 'vest_1plate', qty: 1 }] },
      { x: -24.0, y: 0.16, z: 19.8, pool: [{ id: 'smoke_grenade', qty: 1 }, { id: 'concussion_grenade', qty: 1 }, { id: 'armor_plate', qty: 1 }] },
      { x: -31.5, y: 0.16, z: 19.5, pool: [{ id: 'bag_small', qty: 1 }, { id: 'ammo_9x19', qty: 30 }] },

      // Military Compound (rifles, rifle ammo, plates, explosives, materials)
      { x: -21.0, y: 0.16, z: -29.5, pool: [{ id: 'ammo_545', qty: 30 }, { id: 'ammo_762', qty: 20 }, { id: 'armor_plate', qty: 2 }] },
      { x: -24.0, y: 0.16, z: -22.5, pool: [{ id: 'mp5k', qty: 1 }, { id: 'ak74m', qty: 1 }, { id: 'frag_grenade', qty: 1 }] },
      { x: -19.5, y: 0.16, z: -24.0, pool: [{ id: 'gunpowder', qty: 2 }, { id: 'polymer_parts', qty: 2 }, { id: 'scrap_metal', qty: 3 }] },
      { x: -27.5, y: 0.16, z: -26.2, pool: [{ id: 'medkit', qty: 1 }, { id: 'armor_plate', qty: 2 }] },

      // Boss Encampment (high-value loose loot)
      { x: 31.5, y: 0.16, z: -45.5, pool: [{ id: 'armor_plate', qty: 2 }, { id: 'medkit', qty: 1 }, { id: 'ammo_762', qty: 20 }] },
      { x: 36.2, y: 0.16, z: -50.2, pool: [{ id: 'gold_watch', qty: 1 }, { id: 'intel_drive', qty: 1 }, { id: 'painkillers', qty: 1 }] },

      // Shipping Containers & Roadblocks (salvage, ammo, basic meds)
      { x: -6.2,  y: 0.02, z: 16.5,  pool: [{ id: 'scrap_metal', qty: 2 }, { id: 'cloth_roll', qty: 2 }, { id: 'bandage', qty: 1 }] },
      { x: 14.5,  y: 0.02, z: 9.2,   pool: [{ id: 'gunpowder', qty: 2 }, { id: 'polymer_parts', qty: 2 }, { id: 'ammo_9x18', qty: 20 }] },
      { x: -4.2,  y: 0.02, z: 34.5,  pool: [{ id: 'ammo_9x19', qty: 18 }, { id: 'bandage', qty: 1 }, { id: 'armor_plate', qty: 1 }] },
      { x: 7.5,   y: 0.02, z: 26.5,  pool: [{ id: 'water_filter', qty: 1 }, { id: 'scrap_metal', qty: 2 }] },
      { x: 15.5,  y: 0.02, z: -34.0, pool: [{ id: 'ammo_545', qty: 24 }, { id: 'medkit', qty: 1 }] },
      { x: -41.5, y: 0.02, z: -3.2,  pool: [{ id: 'polymer_parts', qty: 2 }, { id: 'gunpowder', qty: 2 }, { id: 'frag_grenade', qty: 1 }] }
    ];

    for (const sp of spawnSpots) {
      // ~85% spawn chance per logical spot for organic raid variety
      if (Math.random() < 0.85) {
        const chosen = pick(sp.pool);
        if (GAME_DATA.ITEMS[chosen.id]) {
          this.spawnGroundItem(chosen.id, chosen.qty, new THREE.Vector3(sp.x, sp.y, sp.z));
        }
      }
    }
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
