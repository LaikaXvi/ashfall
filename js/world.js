// 3D Post-Apocalyptic Wasteland World Builder
class WastelandWorld {
  constructor(scene, zoneConfig) {
    this.scene = scene;
    this.zone = zoneConfig;
    this.colliders = [];      // { minX, maxX, minY, maxY, minZ, maxZ }
    this.shootableMeshes = []; // Static geometry meshes for bullet/LOS raycasts
    this.lootContainers = []; // { id, name, mesh, position, items, searched }
    this.extractZones = [];   // { name, position, radius, beaconMesh, ringMesh }
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
          const qty = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
          items.push({ id: entry.id, qty });
          break;
        }
      }
    }
    return items;
  }

  _addLootContainer(x, y, z, kind = 'supply') {
    let mat = this._materials.crateSup;
    let name = 'Supply Crate';
    let w = 1.1, h = 0.75, d = 0.75;
    let count = 2 + this.zone.lootTierBonus;

    if (kind === 'military') {
      mat = this._materials.crateMil;
      name = 'Military Weapon Case';
      w = 1.4; h = 0.65; d = 0.8;
      count = 3 + this.zone.lootTierBonus;
    } else if (kind === 'medical') {
      mat = this._materials.crateMed;
      name = 'Field Medical Box';
      w = 0.8; h = 0.55; d = 0.6;
      count = 2;
    }

    const mesh = this._addBox(x, y + h / 2, z, w, h, d, mat, true);
    this.lootContainers.push({
      id: 'crate_' + this.lootContainers.length,
      name,
      kind,
      mesh,
      position: new THREE.Vector3(x, y + h / 2, z),
      items: this._rollLoot(kind, count),
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

    // === BUILDINGS ===
    // 1. Central Command Warehouse (north-west of crossroads)
    this._addBuilding(-24, -26, 16, 14, 5.0, 'east');
    this._addLootContainer(-28, 0.16, -29, 'military');
    this._addLootContainer(-28, 0.16, -23, 'supply');

    // 2. Field Med Station (east of crossroads)
    this._addBuilding(24, -18, 12, 10, 4.2, 'west');
    this._addLootContainer(26, 0.16, -18, 'medical');
    this._addLootContainer(23, 0.16, -15, 'supply');

    // 3. Barracks / Guardhouse (south-west)
    this._addBuilding(-28, 22, 14, 10, 4.2, 'east');
    this._addLootContainer(-31, 0.16, 22, 'military');
    this._addLootContainer(-26, 0.16, 19, 'medical');

    // 4. Ammo Depot (north-east)
    this._addBuilding(34, -48, 12, 12, 4.5, 'south');
    this._addLootContainer(34, 0.16, -51, 'military');
    this._addLootContainer(37, 0.16, -47, 'military');

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

  update(dt, time) {
    // Animate extraction beacons
    for (const ez of this.extractZones) {
      ez.beaconMesh.rotation.y += dt * 0.8;
      const pulse = 0.18 + Math.sin(time * 3.0) * 0.08;
      ez.beaconMesh.material.opacity = pulse;
    }
  }
}
