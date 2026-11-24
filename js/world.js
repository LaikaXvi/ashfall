// 3D Post-Apocalyptic Wasteland World Builder
class WastelandWorld {
  constructor(scene, zoneConfig) {
    this.scene = scene;
    this.zone = zoneConfig;
    this.colliders = [];      // { minX, maxX, minY, maxY, minZ, maxZ }
    this.shootableMeshes = []; // Static geometry meshes for bullet/airstrike raycasts
    this.wallMeshes = [];      // Fast low-poly box/structure meshes ONLY (excludes high-poly terrain for 60+ FPS LOS & wall-push!)
    this.lootContainers = []; // { id, name, mesh, position, items, searched, requiresKey, lid }
    this._animLids = [];      // Active container lids/doors animating toward ajar angle
    this.isIndoors = false;
    this._indoorTimer = 0;
    this._indoorRay = null;
    this._indoorOrigin = new THREE.Vector3();
    this._indoorUp = new THREE.Vector3(0, 1, 0);
    this.groundItems = [];    // { id, qty, mesh, position, ringMesh } physical loose & dropped loot
    this.doors = [];          // Interactive bidirectional hinged doors (open / peek / sprint bash / close)
    this.staircases = [];     // Registered multi-floor staircases { bottomEntry, topExit, bottomY, topY } for AI pathfinding
    this.munitionBoxes = [];  // Deployable physical 3D Munition Boxes { mesh, position, ownerName, usedBy: Set, ttl }
    this.extractZones = [];   // { name, position, radius, beaconMesh, ringMesh }
    this.pois = [];           // { name, x, z, color } for minimap & logical looting
    this.activeSmokes = [];
    this.spawnPoints = [];    // Enemy patrol/spawn positions
    this.operatorSpawns = []; // Randomized outer perimeter + 5 inner POI infil points
    this.perimeterSpawns = [];
    this.innerPoiSpawns = [];
    this.smokePlumes = [];    // Rising battle-scarred smoke columns across Vostok
    this.mapHalfSize = 620;   // Vostok sector silhouette within [-800..+800] 10x10 (A-J x 0-9) Tac-Map grid
    this.skyDome = null;
    this.fogLayers = [];

    // Vostok Northern Russia Perimeter Polygon:
    // NW Alpine Mountain Range (B1-D2), Northern Dam Gorge & Upper Reservoir (E2), NNE City/Compound Lobe (G1.5-G2),
    // East Taiga Bluff (H2-H6), Southern Beach & Oceanfront Pier (C7-G8), SW Lighthouse Promontory (C7) & West Airport Flank (B5-B3)
    this.MAP_BOUNDARY = [
      [-560, -560], [-465, -585], [-355, -570], [-245, -535], [-155, -515],
      [-65, -525],  [35, -530],   [135, -545],  [235, -555],  [325, -540],
      [415, -505],  [495, -455],  [555, -385],  [575, -295],  [545, -205],
      [525, -110],  [520, -10],   [522, 90],    [520, 195],   [505, 295],
      [475, 385],   [425, 465],   [355, 520],   [255, 535],   [145, 530],
      [35, 520],    [-85, 510],   [-205, 495],  [-315, 475],  [-415, 445],
      [-465, 385],  [-495, 305],  [-535, 215],  [-585, 125],  [-605, 40],
      [-605, -60],  [-600, -165], [-595, -270], [-585, -375], [-575, -475]
    ];

    // Northern Dam footprint in E2 (-45, -395) nestled between tall NW & NNE mountain ridges + Upper Reservoir above Dam
    this.DAM_BOUNDS = { minX: -150, maxX: 65, minZ: -468, maxZ: -322, cx: -42, cz: -395 };
    this.UPPER_RESERVOIR = { cx: -42, cz: -498, rx: 98, rz: 36, waterY: 18.6 };
    this.sunDir = new THREE.Vector3(0.55, 0.44, 0.42).normalize();
    this.lightSources = [
      { isDirectional: true, dir: this.sunDir.clone(), intensity: 1.05, flareScale: 1.25, anamorphic: true, ghosts: true }
    ];

    // Vostok Hydrography:
    //  - RIVER_A: Northern Dam spillway tailwater (E2) -> Central Confluence (E4) -> Valley Meander -> Southern Ocean Estuary (F7/G7)
    //  - RIVER_B: Reservoir Tributary above Dam -> runs south right through Vostok City (G2) & past S. Vostok Industrial (G3) -> Confluence!
    this.RIVER_A_CTRL = [
      [-42, -318, 34],
      [-36, -230, 30],
      [-22, -135, 46],
      [-28, -35, 48],
      [-38, 75, 34],
      [-10, 185, 30],
      [42, 295, 30],
      [82, 395, 34],
      [98, 485, 44]
    ];
    this.RIVER_B_CTRL = [
      [148, -545, 18],
      [162, -455, 17],
      [168, -365, 18],
      [152, -255, 19],
      [95, -180, 24],
      [-18, -130, 36]
    ];
    this.MAIN_START_WATER_Y = 1.65;
    this.CONFLUENCE_WATER_Y = 0.95;
    this.OUTLET_WATER_Y = 0.25;
    this.NE_START_WATER_Y = 4.20;
    this.LAKE_WATER_Y = 0.95;
    this.OCEAN_WATER_Y = 0.25;
    this.RIVER_WATER_Y = 0.95;
    this._riverA = this._buildSmoothRiverData(this.RIVER_A_CTRL, 8);
    this._riverB = this._buildSmoothRiverData(this.RIVER_B_CTRL, 8);
    this.RIVER_A = this._riverA.pts;
    this.RIVER_B = this._riverB.pts;
    this.RIVER_POLYGONS = [];
    this.OCEAN_POLY = null;
    this.RESERVOIR_POLY = null;
    this.waterMeshes = [];

    // Connected Vostok highway, city bridge & strip-town road network
    this.ROADS = [
      [-520, -240, -438, -388, 9],    // Compound Delta (B3) -> Quarry West Rim (C2)
      [-362, -395, -232, -395, 10],   // Quarry East Rim (C2) -> Compound Bravo (D2)
      [-232, -395, -172, -408, 10],   // Compound Bravo (D2) -> Northern Dam West Abutment (E2)
      [88, -408, 248, -368, 10],      // Northern Dam East Abutment -> Vostok City Center (G2, crosses City River Bridge!)
      [242, -485, 248, -368, 9],      // Compound Alpha (G1.5) -> Vostok City Center (G2)
      [118, -352, 215, -352, 9],      // Vostok City West Bank -> East City Plaza Bridge
      [248, -368, 252, -225, 10],     // Vostok City Center (G2) -> S. Vostok Industrial (G3)
      [252, -225, 248, -75, 10],      // S. Vostok Industrial (G3) -> East Strip-Town (G4)
      [248, -75, 402, 80, 9],         // East Strip-Town (G4) -> Compound Charlie (H5)
      [248, -75, 95, 85, 10],         // East Strip-Town (G4) -> Superstore (F5)
      [-240, -80, 95, 85, 10],        // TV Broadcast Station (D4) -> Superstore (F5, Central River Bridge!)
      [-232, -395, -240, -80, 9],     // Compound Bravo (D2) -> TV Broadcast Station (D4)
      [-398, -354, -390, -80, 9],     // Quarry South Rim (C2) -> West Strip-Town (C4)
      [-390, -80, -392, 80, 9],       // West Strip-Town (C4) -> Compound Echo (C5)
      [-520, -240, -522, 75, 9],      // Compound Delta (B3) -> Airport (B5)
      [-522, 75, -392, 80, 10],       // Airport (B5) -> Compound Echo (C5)
      [-392, 80, -240, -80, 9],       // Compound Echo (C5) -> TV Broadcast Station (D4)
      [-240, -80, -235, 225, 9],      // TV Broadcast Station (D4) -> SW Strip-Town (D6)
      [-235, 225, -375, 372, 9],      // SW Strip-Town (D6) -> Lighthouse (C7)
      [-235, 225, -82, 380, 9],       // SW Strip-Town (D6) -> Compound Foxtrot (E7)
      [95, 85, 155, 245, 10],         // Superstore (F5) -> SE Strip-Town (F6)
      [155, 245, 245, 408, 10],       // SE Strip-Town (F6) -> Cruise Terminal (G7)
      [-82, 380, 245, 408, 9],        // Compound Foxtrot (E7) -> Cruise Terminal (G7, South Estuary Bridge!)
      [402, 80, 245, 408, 9]          // Compound Charlie (H5) -> Cruise Terminal (G7)
    ];

    // Flat terrain pads for POIs (Quarry uses multi-tier sunken excavation in _evalAnalyticalTerrainHeight!)
    this._poiPads = [
      // Core Vostok Landmark POIs
      { x: -240, z: -80,  r: 36, h: 6.4 },  // TV Broadcast Station (D4)
      { x: -522, z:  75,  r: 46, h: 7.2 },  // Elevated Vostok Airport Plateau (B5)
      { x: -545, z:  15,  r: 28, h: 7.2 },  // Airport North Runway Extension
      { x: -545, z: 135,  r: 28, h: 7.2 },  // Airport South Runway Extension
      { x:   95, z:  85,  r: 40, h: 3.8 },  // Vostok Superstore (F5)
      { x:  245, z: 408,  r: 36, h: 2.1 },  // Cruise Terminal on Southern Beach (G7)
      { x: -375, z: 372,  r: 28, h: 12.8 }, // Coastal Lighthouse Sea-Cliff Promontory (C7)
      { x:  248, z: -368, r: 44, h: 6.8 },  // Vostok City Center East Plaza (G2)
      { x:  118, z: -355, r: 22, h: 6.4 },  // Vostok City West Riverbank Block
      { x:  252, z: -225, r: 38, h: 5.8 },  // South Vostok Industrial Construction (G3)
      // 6 Guarded Military Compounds (Alpha - Foxtrot)
      { x:  242, z: -485, r: 32, h: 10.6 }, // Compound Alpha (G1.5)
      { x: -232, z: -395, r: 32, h: 14.8 }, // Compound Bravo (D2)
      { x:  402, z:   80, r: 32, h: 5.6 },  // Compound Charlie (H5)
      { x: -520, z: -240, r: 32, h: 10.8 }, // Compound Delta (B3)
      { x: -392, z:   80, r: 32, h: 5.2 },  // Compound Echo (C5)
      { x:  -82, z:  380, r: 32, h: 2.4 },  // Compound Foxtrot (E7)
      // 4 Roadside Strip-Towns (Houses + % chance Clinic / Police / Fire)
      { x: -390, z:  -80, r: 30, h: 6.2 },  // West Highway Strip-Town (C4)
      { x: -235, z:  225, r: 30, h: 4.2 },  // SW Coastal Strip-Town (D6)
      { x:  248, z:  -75, r: 30, h: 5.0 },  // East Valley Strip-Town (G4)
      { x:  155, z:  245, r: 30, h: 3.0 },  // SE Oceanfront Road Strip-Town (F6)
      // Northern Dam West & East Mountain Gorge Abutments
      { x: -172, z: -408, r: 22, h: 17.8 },
      { x:   88, z: -408, r: 22, h: 17.8 },
      // ZAVOD-9 Mountain Complex plateau (carved into NW alpine massif)
      { x: -555, z: -490, r: 46, h: 34.0 },
      { x: -540, z: -447, r: 14, h: 34.0 }, // ZAVOD-9 service-elevator forecourt (flat apron in front of the lift door)
      // 4 Extraction Zone Pads
      { x: -485, z: -445, r: 16, h: 21.0 }, // NW Mountain Pass Helipad
      { x:  465, z: -185, r: 16, h: 6.4 },  // East Taiga Gate
      { x: -455, z:  285, r: 16, h: 6.2 },  // SW Cliffside Convoy
      { x:  365, z:  435, r: 16, h: 1.9 }   // SE Beach Evacuation Boat
    ];

    this._colliderCellSize = 18;
    this._colliderGrid = new Map();
    this._queryBuf = [];
    this._queryStamp = 0;

    this._rayCellSize = 24;
    this._shootGrid = new Map();
    this._wallGrid = new Map();
    this._rockCells = new Set();
    this._rockInst = null;
    this._worldRay = new THREE.Raycaster();
    this._rayCands = [];
    this._rayHits = [];
    this._rayQueryStamp = 0;
    this.terrainMesh = null;

    this._batchEntries = [];
    this._batchingOpen = true;
    this._batchedMeshes = [];

    this._materials = this._createMaterials();

    // ZAVOD-9 Underground Complex: a completely separate standalone map (not built under Vostok)
    if (zoneConfig && zoneConfig.mapType === 'zavod' && typeof this._initZavodMap === 'function') {
      this._initZavodMap();
      this._batchStaticGeometry();
      this.buildColliderGrid();
      this.buildRaycastGrid();
      if (!this.playerSpawn) this.playerSpawn = new THREE.Vector3(-328, 1.7, 163);
      this._staticSceneSet = new Set(this.scene.children); // static map props eligible for interior culling
      return;
    }

    this._buildSkybox();
    this._buildEnvironment();
    this._buildVolumetricFogLayers();
    this._buildMapLayout();
    this._buildForestAndFoliage();
    this._batchStaticGeometry();
    this.buildColliderGrid();
    this.buildRaycastGrid();

    // Pick a randomized infil point from Vostok's outer perimeter + 5 inner POI spawn pool!
    const infilPool = (this.operatorSpawns && this.operatorSpawns.length > 0)
      ? this.operatorSpawns
      : [new THREE.Vector3(-82, this.getTerrainHeight(-82, 415), 415)];
    const chosenInfil = infilPool[Math.floor(Math.random() * infilPool.length)];
    const spawnY = this.getTerrainHeight(chosenInfil.x, chosenInfil.z);
    this.playerSpawn = new THREE.Vector3(chosenInfil.x, spawnY + 1.7, chosenInfil.z);
  }

  buildColliderGrid() {
    this._colliderGrid.clear();
    const cs = this._colliderCellSize;
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      const cx0 = Math.floor(c.minX / cs);
      const cx1 = Math.floor(c.maxX / cs);
      const cz0 = Math.floor(c.minZ / cs);
      const cz1 = Math.floor(c.maxZ / cs);
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cz = cz0; cz <= cz1; cz++) {
          const key = (cx << 16) ^ cz;
          let bucket = this._colliderGrid.get(key);
          if (!bucket) {
            bucket = [];
            this._colliderGrid.set(key, bucket);
          }
          bucket.push(c);
        }
      }
    }
  }

  // Zero-allocation spatial hash lookup returning ONLY nearby colliders in O(1)
  getNearbyColliders(x, z, radius = 2.5) {
    const buf = this._queryBuf;
    buf.length = 0;
    const cs = this._colliderCellSize;
    const cx0 = Math.floor((x - radius) / cs);
    const cx1 = Math.floor((x + radius) / cs);
    const cz0 = Math.floor((z - radius) / cs);
    const cz1 = Math.floor((z + radius) / cs);
    const stamp = ++this._queryStamp;
    const grid = this._colliderGrid;
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const bucket = grid.get((cx << 16) ^ cz);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const c = bucket[i];
          if (c._qStamp !== stamp) {
            c._qStamp = stamp;
            buf.push(c);
          }
        }
      }
    }
    return buf;
  }

  buildRaycastGrid() {
    this._shootGrid.clear();
    this._wallGrid.clear();
    if (this.scene) this.scene.updateMatrixWorld(true);
    const cs = this._rayCellSize || 24;
    const tmpBox = new THREE.Box3();

    const indexList = (list, grid) => {
      if (!list) return;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (!m || !m.geometry) continue;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        if (!m.parent && m.matrix) m.matrixWorld.copy(m.matrix);
        tmpBox.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
        m._bbMinX = tmpBox.min.x; m._bbMaxX = tmpBox.max.x;
        m._bbMinY = tmpBox.min.y; m._bbMaxY = tmpBox.max.y;
        m._bbMinZ = tmpBox.min.z; m._bbMaxZ = tmpBox.max.z;
        const cx0 = Math.floor(m._bbMinX / cs);
        const cx1 = Math.floor(m._bbMaxX / cs);
        const cz0 = Math.floor(m._bbMinZ / cs);
        const cz1 = Math.floor(m._bbMaxZ / cs);
        for (let cx = cx0; cx <= cx1; cx++) {
          for (let cz = cz0; cz <= cz1; cz++) {
            const key = (cx << 16) ^ cz;
            let bucket = grid.get(key);
            if (!bucket) {
              bucket = [];
              grid.set(key, bucket);
            }
            bucket.push(m);
          }
        }
      }
    };

    indexList(this.shootableMeshes, this._shootGrid);
    indexList(this.wallMeshes, this._wallGrid);
  }

  raycastTerrain(origin, dir, near = 0, far = 300) {
    if (this.isBunkerMap) return this._zavodRaycastFloor(origin, dir, near, far);
    const maxD = Math.min(far, 1450);
    if (maxD <= near) return null;
    if (origin.y > 64 && dir.y >= 0) return null;
    let t = Math.max(0.05, near);
    let prevT = t;
    let hitFound = false;
    while (t < maxD) {
      const step = t < 80 ? 1.6 : (t < 260 ? 3.2 : 6.5);
      prevT = t;
      t = Math.min(maxD, t + step);
      const py = origin.y + dir.y * t;
      if (py <= 64) {
        const px = origin.x + dir.x * t;
        const pz = origin.z + dir.z * t;
        if (py <= this.getTerrainHeight(px, pz)) {
          hitFound = true;
          break;
        }
      }
    }
    if (!hitFound) return null;
    let lo = prevT;
    let hi = t;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) * 0.5;
      const my = origin.y + dir.y * mid;
      const mx = origin.x + dir.x * mid;
      const mz = origin.z + dir.z * mid;
      if (my <= this.getTerrainHeight(mx, mz)) {
        hi = mid;
      } else {
        lo = mid;
      }
    }
    const hx = origin.x + dir.x * hi;
    const mz = origin.z + dir.z * hi;
    const hy = this.getTerrainHeight(hx, mz);
    const nx = this.getTerrainHeight(hx - 0.8, mz) - this.getTerrainHeight(hx + 0.8, mz);
    const nz = this.getTerrainHeight(hx, mz - 0.8) - this.getTerrainHeight(hx, mz + 0.8);
    const normal = new THREE.Vector3(nx, 1.6, nz).normalize();
    return {
      distance: hi,
      point: new THREE.Vector3(hx, hy, mz),
      face: { normal },
      object: this.terrainMesh
    };
  }

  raycastWorld(origin, dir, near = 0.05, far = 300, opts = null) {
    if (far <= near) return null;
    const wallsOnly = !!(opts && opts.wallsOnly);
    const ignoreRoot = (opts && opts.ignoreRoot) || null;
    const ignoreFloorY = (opts && opts.ignoreFloorNormal) || 0;
    const grid = wallsOnly ? this._wallGrid : this._shootGrid;
    const cs = this._rayCellSize || 24;

    const cands = this._rayCands;
    cands.length = 0;
    const stamp = ++this._rayQueryStamp;
    let rockAdded = false;

    const ox = origin.x, oy = origin.y, oz = origin.z;
    const dx = dir.x, dy = dir.y, dz = dir.z;
    const sx = ox + dx * near;
    const sz = oz + dz * near;
    const ex = ox + dx * far;
    const ez = oz + dz * far;
    const segSpan = far - near;

    let cx = Math.floor(sx / cs);
    let cz = Math.floor(sz / cs);
    const endCx = Math.floor(ex / cs);
    const endCz = Math.floor(ez / cs);
    const stepX = dx > 1e-7 ? 1 : (dx < -1e-7 ? -1 : 0);
    const stepZ = dz > 1e-7 ? 1 : (dz < -1e-7 ? -1 : 0);
    const tDeltaX = stepX !== 0 ? Math.abs(cs / dx) : 1e30;
    const tDeltaZ = stepZ !== 0 ? Math.abs(cs / dz) : 1e30;
    let tMaxX = stepX > 0 ? (((cx + 1) * cs - sx) / dx) : (stepX < 0 ? ((cx * cs - sx) / dx) : 1e30);
    let tMaxZ = stepZ > 0 ? (((cz + 1) * cs - sz) / dz) : (stepZ < 0 ? ((cz * cs - sz) / dz) : 1e30);

    const invX = Math.abs(dx) > 1e-8 ? 1 / dx : 0;
    const invY = Math.abs(dy) > 1e-8 ? 1 / dy : 0;
    const invZ = Math.abs(dz) > 1e-8 ? 1 / dz : 0;
    const nearPad = near - 0.05;
    const farPad = far + 0.05;

    for (let s = 0; s < 120; s++) {
      const key = (cx << 16) ^ cz;
      const bucket = grid.get(key);
      if (bucket) {
        for (let i = 0; i < bucket.length; i++) {
          const m = bucket[i];
          if (m._rqStamp === stamp) continue;
          m._rqStamp = stamp;

          const minX = m._bbMinX - 0.05, maxX = m._bbMaxX + 0.05;
          const minY = m._bbMinY - 0.05, maxY = m._bbMaxY + 0.05;
          const minZ = m._bbMinZ - 0.05, maxZ = m._bbMaxZ + 0.05;

          let tmin = -1e30;
          let tmax = 1e30;
          if (invX !== 0) {
            const tx1 = (minX - ox) * invX;
            const tx2 = (maxX - ox) * invX;
            tmin = tx1 < tx2 ? tx1 : tx2;
            tmax = tx1 > tx2 ? tx1 : tx2;
          } else if (ox < minX || ox > maxX) {
            continue;
          }
          if (invY !== 0) {
            const ty1 = (minY - oy) * invY;
            const ty2 = (maxY - oy) * invY;
            const tymin = ty1 < ty2 ? ty1 : ty2;
            const tymax = ty1 > ty2 ? ty1 : ty2;
            if (tymin > tmin) tmin = tymin;
            if (tymax < tmax) tmax = tymax;
          } else if (oy < minY || oy > maxY) {
            continue;
          }
          if (tmin > tmax) continue;
          if (invZ !== 0) {
            const tz1 = (minZ - oz) * invZ;
            const tz2 = (maxZ - oz) * invZ;
            const tzmin = tz1 < tz2 ? tz1 : tz2;
            const tzmax = tz1 > tz2 ? tz1 : tz2;
            if (tzmin > tmin) tmin = tzmin;
            if (tzmax < tmax) tmax = tzmax;
          } else if (oz < minZ || oz > maxZ) {
            continue;
          }
          if (tmax >= Math.max(nearPad, tmin) && tmin <= farPad) {
            cands.push(m);
          }
        }
      }
      if (!wallsOnly && !rockAdded && this._rockInst && this._rockCells.has(key)) {
        rockAdded = true;
        cands.push(this._rockInst);
      }
      if (cx === endCx && cz === endCz) break;
      if (tMaxX < tMaxZ) {
        if (tMaxX > segSpan + 0.1) break;
        tMaxX += tDeltaX;
        cx += stepX;
      } else {
        if (tMaxZ > segSpan + 0.1) break;
        tMaxZ += tDeltaZ;
        cz += stepZ;
      }
    }

    let bestHit = null;
    if (cands.length > 0) {
      const ray = this._worldRay;
      ray.set(origin, dir);
      ray.near = near;
      ray.far = far;
      const hits = this._rayHits;
      hits.length = 0;
      ray.intersectObjects(cands, false, hits);
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i];
        if (ignoreFloorY > 0 && h.face && h.face.normal && h.face.normal.y > ignoreFloorY) continue;
        if (ignoreRoot) {
          let cur = h.object;
          let isSelf = false;
          while (cur) {
            if (cur === ignoreRoot) { isSelf = true; break; }
            cur = cur.parent;
          }
          if (isSelf) continue;
        }
        bestHit = h;
        break;
      }
    }

    if (!wallsOnly) {
      const terrFar = bestHit ? bestHit.distance : far;
      const terrHit = this.raycastTerrain(origin, dir, near, terrFar);
      if (terrHit && (!bestHit || terrHit.distance < bestHit.distance)) {
        bestHit = terrHit;
      }
    }
    return bestHit;
  }

  registerLightSource(pos, opts = {}) {
    if (!this.lightSources) this.lightSources = [];
    this.lightSources.push({
      pos: pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z),
      intensity: opts.intensity !== undefined ? opts.intensity : 0.85,
      maxDist: opts.maxDist || 190,
      flareScale: opts.flareScale || 0.85,
      anamorphic: opts.anamorphic !== false,
      ghosts: opts.ghosts !== false
    });
  }

  // Deterministic rolling terrain heightfield with hills, ridges, creek valley & smooth POI plateaus
  getTerrainHeight(x, z) {
    if (this.isBunkerMap) return 0;
    // Once the rendered terrain mesh is built, sample the EXACT rendered triangle height in O(1)
    // so players, operators, NPCs, loot & buildings NEVER clip underneath a coarse terrain triangle!
    if (this._terrainHeights) {
      const segs = this._terrainSegs;
      const half = this._terrainSize * 0.5;
      const fx = ((x + half) / this._terrainSize) * segs;
      const fz = ((z + half) / this._terrainSize) * segs;
      const gx = Math.max(0, Math.min(segs - 1, Math.floor(fx)));
      const gz = Math.max(0, Math.min(segs - 1, Math.floor(fz)));
      const tx = Math.max(0, Math.min(1, fx - gx));
      const tz = Math.max(0, Math.min(1, fz - gz));
      const row = segs + 1;
      const i00 = gz * row + gx;
      const h00 = this._terrainHeights[i00];
      const h10 = this._terrainHeights[i00 + 1];
      const h01 = this._terrainHeights[i00 + row];
      const h11 = this._terrainHeights[i00 + row + 1];
      // PlaneGeometry split diagonal matches (tx + tz <= 1) vs (tx + tz > 1)
      if (tx + tz <= 1) {
        return h00 + tx * (h10 - h00) + tz * (h01 - h00);
      } else {
        return h11 + (1 - tx) * (h01 - h11) + (1 - tz) * (h10 - h11);
      }
    }
    return this._evalAnalyticalTerrainHeight(x, z);
  }

  isInsideBoundary(x, z) {
    const poly = this.MAP_BOUNDARY;
    if (!poly || poly.length < 3) return Math.abs(x) <= this.mapHalfSize && Math.abs(z) <= this.mapHalfSize;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1];
      const xj = poly[j][0], zj = poly[j][1];
      if (((zi > z) !== (zj > z)) && (x < ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-9) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  // Signed distance outside MAP_BOUNDARY (> 0 = in Red Zone outside polygon, <= 0 = inside playable sector)
  getOutOfBoundsDist(x, z) {
    const poly = this.MAP_BOUNDARY;
    if (!poly || poly.length < 3) {
      return Math.max(Math.abs(x) - this.mapHalfSize, Math.abs(z) - this.mapHalfSize);
    }
    let bestSq = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const ax = poly[i][0], az = poly[i][1];
      const bx = poly[(i + 1) % poly.length][0], bz = poly[(i + 1) % poly.length][1];
      const dx = bx - ax, dz = bz - az;
      const lenSq = dx * dx + dz * dz || 1;
      let t = ((x - ax) * dx + (z - az) * dz) / lenSq;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const px = ax + dx * t - x;
      const pz = az + dz * t - z;
      const dSq = px * px + pz * pz;
      if (dSq < bestSq) bestSq = dSq;
    }
    const dist = Math.sqrt(bestSq);
    return this.isInsideBoundary(x, z) ? -dist : dist;
  }

  clampToHardBoundary(pos, maxOut = 42) {
    const poly = this.MAP_BOUNDARY;
    if (!pos || !poly || poly.length < 3) return;
    if (this.isInsideBoundary(pos.x, pos.z)) return;
    let bestSq = Infinity;
    let nearX = pos.x, nearZ = pos.z;
    for (let i = 0; i < poly.length; i++) {
      const ax = poly[i][0], az = poly[i][1];
      const bx = poly[(i + 1) % poly.length][0], bz = poly[(i + 1) % poly.length][1];
      const dx = bx - ax, dz = bz - az;
      const lenSq = dx * dx + dz * dz || 1;
      let t = ((pos.x - ax) * dx + (pos.z - az) * dz) / lenSq;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const cx = ax + dx * t;
      const cz = az + dz * t;
      const dSq = (pos.x - cx) * (pos.x - cx) + (pos.z - cz) * (pos.z - cz);
      if (dSq < bestSq) {
        bestSq = dSq;
        nearX = cx;
        nearZ = cz;
      }
    }
    const dist = Math.sqrt(bestSq);
    if (dist > maxOut && dist > 1e-4) {
      const k = maxOut / dist;
      pos.x = nearX + (pos.x - nearX) * k;
      pos.z = nearZ + (pos.z - nearZ) * k;
    }
  }

  _buildSmoothRiverData(ctrlPts, subdiv = 8) {
    const pts = [];
    const n = ctrlPts.length;
    const catmull = (p0, p1, p2, p3, t) => {
      const t2 = t * t;
      const t3 = t2 * t;
      const w0 = p0[2] || 18, w1 = p1[2] || 18, w2 = p2[2] || 18, w3 = p3[2] || 18;
      return [
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        Math.max(10, 0.5 * ((2 * w1) + (-w0 + w2) * t + (2 * w0 - 5 * w1 + 4 * w2 - w3) * t2 + (-w0 + 3 * w1 - 3 * w2 + w3) * t3))
      ];
    };
    for (let i = 0; i < n - 1; i++) {
      const p0 = ctrlPts[Math.max(0, i - 1)];
      const p1 = ctrlPts[i];
      const p2 = ctrlPts[i + 1];
      const p3 = ctrlPts[Math.min(n - 1, i + 2)];
      for (let s = 0; s < subdiv; s++) {
        pts.push(catmull(p0, p1, p2, p3, s / subdiv));
      }
    }
    const last = ctrlPts[n - 1];
    pts.push([last[0], last[1], last[2] || 18]);
    const cumLen = [0];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      cumLen.push(total);
    }
    return { pts, cumLen, totalLen: Math.max(1, total) };
  }

  _projectOntoRiver(x, z, riverData) {
    const pts = riverData.pts;
    const cum = riverData.cumLen;
    const total = riverData.totalLen;
    let bestMargin = Infinity;
    let bestDist = Infinity;
    let bestHalfW = 24;
    let bestS = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1], aw = pts[i][2] || 24;
      const bx = pts[i + 1][0], bz = pts[i + 1][1], bw = pts[i + 1][2] || 24;
      const dx = bx - ax, dz = bz - az;
      const lenSq = dx * dx + dz * dz || 1;
      let t = ((x - ax) * dx + (z - az) * dz) / lenSq;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const px = ax + dx * t - x;
      const pz = az + dz * t - z;
      const d = Math.hypot(px, pz);
      const hw = aw + (bw - aw) * t;
      const margin = d - hw;
      if (margin < bestMargin) {
        bestMargin = margin;
        bestDist = d;
        bestHalfW = hw;
        const segLen = cum[i + 1] - cum[i];
        bestS = (cum[i] + t * segLen) / total;
      }
    }
    return { dist: bestDist, halfW: bestHalfW, margin: bestMargin, s: bestS };
  }

  _riverWaterYA(s) {
    const c = Math.max(0, Math.min(1, s));
    if (c <= 0.12) {
      const u = c / 0.12;
      const e = u * u * (3 - 2 * u);
      return this.MAIN_START_WATER_Y + (this.CONFLUENCE_WATER_Y - this.MAIN_START_WATER_Y) * e;
    }
    if (c <= 0.28) {
      return this.CONFLUENCE_WATER_Y;
    }
    const u = (c - 0.28) / 0.72;
    return this.CONFLUENCE_WATER_Y + (this.OUTLET_WATER_Y - this.CONFLUENCE_WATER_Y) * u;
  }

  _riverWaterYB(s) {
    const c = Math.max(0, Math.min(1, s));
    const u = Math.min(1, c / 0.88);
    const e = u * u * (3 - 2 * u);
    return this.NE_START_WATER_Y + (this.CONFLUENCE_WATER_Y - this.NE_START_WATER_Y) * e;
  }

  _distToPolyline(x, z, pts) {
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1];
      const bx = pts[i + 1][0], bz = pts[i + 1][1];
      const dx = bx - ax, dz = bz - az;
      const lenSq = dx * dx + dz * dz || 1;
      let t = ((x - ax) * dx + (z - az) * dz) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t, pz = az + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best) best = d;
    }
    return best;
  }

  _shorelineZ(x) {
    // Smooth Northern Russian southern bay shoreline (~z=448..464) with SW Lighthouse promontory & G7 Cruise waterfront
    return 452.0 + Math.sin(x * 0.0055 + 0.6) * 16.0 - Math.max(0, (-x - 240.0) * 0.055);
  }

  _oceanDist(x, z) {
    return z - this._shorelineZ(x);
  }

  _oceanFactor(x, z) {
    return this._oceanDist(x, z) / 55.0;
  }

  _evalAnalyticalTerrainHeight(x, z) {
    // 0. Base Northern Russian taiga hills: elevated in north, gradually lowering southward toward the Southern Beach!
    const northLift = Math.max(0, (-z + 260) / 820) * 11.5;
    const southTaper = z > 180 ? Math.min(1, (z - 180) / 270) : 0;
    const h1 = Math.sin(x * 0.0068 + 0.4) * Math.cos(z * 0.0062 - 0.3) * 6.4 * (1 - southTaper * 0.72);
    const h2 = (Math.sin((x + z) * 0.0115) * 2.8 + Math.cos((x - z * 1.1) * 0.014) * 1.8) * (1 - southTaper * 0.68);
    const h3 = Math.sin(x * 0.029) * Math.sin(z * 0.027) * 0.65;
    let baseH = Math.max(1.85, (2.6 + northLift + h1 + h2 + h3) * (1 - southTaper * 0.52) + southTaper * 1.45);

    // 0b. Dramatic Top-Left NW Snow-Capped Mountain Range (A1-D2) & Dam Gorge Flanking Peaks
    const addMountainPeak = (px, pz, rx, rz, peakH) => {
      const u = Math.hypot((x - px) / rx, (z - pz) / rz);
      if (u >= 1.0) return 0;
      const k = 1 - u * u;
      const ridge = 0.80 + 0.20 * (1 - Math.abs(Math.sin(x * 0.036 + z * 0.030)));
      return peakH * k * k * ridge;
    };
    baseH += addMountainPeak(-525, -525, 235, 210, 44.0); // Main NW Alpine Massif (A1/B1)
    baseH += addMountainPeak(-380, -535, 195, 155, 36.0); // North Quarry Crag (C1)
    baseH += addMountainPeak(-225, -505, 155, 130, 29.0); // West Dam Gorge Mountain Shoulder (D1/D2)
    baseH += addMountainPeak(  95, -455, 120, 102, 24.5); // East Dam Gorge Mountain Shoulder (F2)
    baseH += addMountainPeak(-595, -355, 145, 185, 31.0); // Far-NW Mountain Spine (A2/B2)

    // 1. Carve River A (Dam tailwater -> Central Confluence -> Southern Ocean Estuary)
    //    & River B (Reservoir Tributary -> Vostok City -> Confluence) seamlessly via Math.min
    const carveBranch = (proj, wY) => {
      const bankW = 26;
      if (proj.margin >= bankW) return baseH;
      if (proj.margin <= 0) {
        const frac = proj.dist / Math.max(1, proj.halfW);
        const maxDepth = 1.42 + Math.min(0.80, Math.max(0, proj.halfW - 26) * 0.016);
        return wY - (maxDepth - (maxDepth - 0.45) * frac * frac);
      }
      const u = Math.max(0, Math.min(1, proj.margin / bankW));
      const prof = u * u * (3 - 2 * u);
      const rimBase = Math.max(wY + 0.65, baseH);
      return (wY - 0.45) * (1 - prof) + rimBase * prof;
    };

    const rA = this._projectOntoRiver(x, z, this._riverA);
    const rB = this._projectOntoRiver(x, z, this._riverB);
    const hA = carveBranch(rA, this._riverWaterYA(rA.s));
    const hB = carveBranch(rB, this._riverWaterYB(rB.s));
    let h = Math.min(hA, hB);

    // 1b. Upper Reservoir Basin north of Northern Dam (E1.5)
    const res = this.UPPER_RESERVOIR;
    if (res) {
      const ru = Math.hypot((x - res.cx) / res.rx, (z - res.cz) / res.rz);
      if (ru < 1.35 && z < -455) {
        const rk = Math.max(0, Math.min(1, (ru - 0.85) / 0.50));
        const rBlend = rk * rk * (3 - 2 * rk);
        const bedY = res.waterY - 2.2 * (1 - Math.min(1, ru) * 0.55);
        h = bedY * (1 - rBlend) + h * rBlend;
      }
    }

    // 2. Northern Dam Gorge & Lower Powerhouse Apron (E2: x in [-150..65], z in [-468..-322])
    const db = this.DAM_BOUNDS;
    if (db && x >= db.minX - 24 && x <= db.maxX + 24 && z >= db.minZ - 14 && z <= db.maxZ + 8) {
      let lx = 1.0;
      if (x < db.minX) lx = Math.max(0, (x - (db.minX - 24)) / 24);
      else if (x > db.maxX) lx = Math.max(0, ((db.maxX + 24) - x) / 24);
      let lz = 1.0;
      if (z < db.minZ) lz = Math.max(0, (z - (db.minZ - 14)) / 14);
      else if (z > db.maxZ - 2) lz = Math.max(0, ((db.maxZ + 6) - z) / 8);
      const wDam = (lx * lx * (3 - 2 * lx)) * (lz * lz * (3 - 2 * lz));
      if (wDam > 0.001) {
        let damTargetH;
        if (z <= -402) {
          damTargetH = 17.8;
        } else if (z <= -354) {
          const u = (z - (-402)) / 48;
          damTargetH = 17.8 + (3.2 - 17.8) * (u * u * (3 - 2 * u));
        } else {
          damTargetH = 3.2;
        }
        h = h * (1 - wDam) + damTargetH * wDam;
      }
    }

    // 2a. 3-Tier Sunken Open-Pit Quarry (C2: -400, -395) + Walkable Spiral Haul Ramp!
    const qr = Math.hypot(x + 400, z + 395);
    if (qr < 54) {
      const qa = Math.atan2(z + 395, x + 400);
      const qSmooth = (t) => {
        const c = Math.max(0, Math.min(1, t));
        return c * c * (3 - 2 * c);
      };
      let qTarget = 10.5;
      // Walkable SE-to-SW spiral haul ramp bridging upper rim (10.5m) -> mid bench (6.6m) -> pit floor (2.8m)
      let angDiff = Math.abs(qa - 0.55);
      if (angDiff > Math.PI) angDiff = Math.PI * 2 - angDiff;
      if (qr > 44) {
        const bOut = qSmooth((qr - 44) / 10);
        qTarget = 10.5 * (1 - bOut) + h * bOut;
      } else if (angDiff < 0.42 && qr >= 15 && qr <= 44) {
        const slopeT = (qr - 15) / (44 - 15);
        const rampH = 2.8 + (10.5 - 2.8) * slopeT;
        let benchH = 10.5;
        if (qr <= 17.5) benchH = 2.8;
        else if (qr <= 21) benchH = 2.8 + (6.6 - 2.8) * qSmooth((qr - 17.5) / 3.5);
        else if (qr <= 31) benchH = 6.6;
        else if (qr <= 34.5) benchH = 6.6 + (10.5 - 6.6) * qSmooth((qr - 31) / 3.5);
        const blendAng = 1 - qSmooth(Math.max(0, (angDiff - 0.22) / 0.20));
        qTarget = benchH * (1 - blendAng) + rampH * blendAng;
      } else if (qr <= 17.5) {
        qTarget = 2.8;
      } else if (qr <= 21) {
        qTarget = 2.8 + (6.6 - 2.8) * qSmooth((qr - 17.5) / 3.5);
      } else if (qr <= 31) {
        qTarget = 6.6;
      } else if (qr <= 34.5) {
        qTarget = 6.6 + (10.5 - 6.6) * qSmooth((qr - 31) / 3.5);
      } else {
        qTarget = 10.5;
      }
      if (qr <= 44) h = qTarget;
      else h = qTarget;
    }

    // 2b. Southern Beach & Ocean Shelf: gradual slope down to golden-gravel beach & sea floor!
    const oDist = this._oceanDist(x, z);
    if (oDist > -72) {
      if (oDist <= 0) {
        // Gentle walkable beach ramp from dry coastal plain down to OCEAN_WATER_Y (0.25m)
        const bt = (oDist + 72) / 72; // 0 inland -> 1 at surf line
        const bSmooth = bt * bt * (3 - 2 * bt);
        const surfRimY = this.OCEAN_WATER_Y + 0.12;
        const beachH = h * (1 - bSmooth) + surfRimY * bSmooth;
        h = Math.min(h, beachH);
      } else {
        // Submerged ocean shelf sloping cleanly down from 0.25m into deep coastal sea
        const seaDepth = Math.min(3.6, 0.22 + oDist * 0.042);
        h = Math.min(h, this.OCEAN_WATER_Y - seaDepth);
      }
    }

    // 3. Smoothly blend toward flat pads around POIs, Compounds, Strip-Towns & Extraction Zones
    if (this._poiPads) {
      for (let i = 0; i < this._poiPads.length; i++) {
        const pad = this._poiPads[i];
        const dx = x - pad.x;
        const dz = z - pad.z;
        const dist = Math.hypot(dx, dz);
        const outer = pad.r + 24;
        if (dist < outer) {
          if (dist <= pad.r) return pad.h;
          const t = (dist - pad.r) / (outer - pad.r);
          const blend = t * t * (3 - 2 * t);
          h = pad.h * (1 - blend) + h * blend;
        }
      }
    }
    return h;
  }

  _buildSkybox() {
    // Procedural atmospheric skybox dome with zenith gradient, horizon haze, solar disc/corona & drifting clouds
    // Radius 420 + depthTest:false + renderOrder:-1000 guarantees ZERO far-plane clipping at every LOD!
    const skyGeo = new THREE.SphereGeometry(420, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: this.sunDir ? this.sunDir.clone() : new THREE.Vector3(0.55, 0.44, 0.42).normalize() },
        uTopColor: { value: new THREE.Color(0x3a5875) },
        uMidColor: { value: new THREE.Color(0x889da8) },
        uHorizonColor: { value: new THREE.Color(this.zone.fogColor || 0xb7beb4) },
        uSunColor: { value: new THREE.Color(0xffe7ba) }
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        varying vec3 vWorldDir;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 sky = mix(uHorizonColor, uMidColor, pow(h, 0.42));
          sky = mix(sky, uTopColor, smoothstep(0.18, 0.85, h));

          // Solar halo + sun disc
          float sunDot = max(dot(dir, uSunDir), 0.0);
          sky += uSunColor * pow(sunDot, 10.0) * 0.28;
          sky += uSunColor * pow(sunDot, 160.0) * 0.95;
          sky += vec3(1.0, 0.97, 0.90) * smoothstep(0.9992, 0.9998, sunDot) * 1.4;

          // Soft high-altitude drifting clouds (faded cleanly above horizon to avoid distant shimmer)
          if (dir.y > 0.08) {
            vec2 uv = dir.xz / (dir.y + 0.26) * 1.65 + vec2(uTime * 0.005, uTime * 0.002);
            float c = noise(uv) * 0.60 + noise(uv * 2.1 + 4.1) * 0.40;
            float cloudMask = smoothstep(0.52, 0.78, c) * smoothstep(0.08, 0.30, dir.y) * 0.44;
            vec3 cloudCol = mix(vec3(0.84, 0.86, 0.88), uSunColor, pow(sunDot, 3.0) * 0.45);
            sky = mix(sky, cloudCol, cloudMask);
          }

          // Horizon ground haze blend
          float below = smoothstep(0.02, -0.14, dir.y);
          sky = mix(sky, uHorizonColor * 0.82, below);
          gl_FragColor = vec4(sky, 1.0);
        }
      `
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.skyDome.renderOrder = -1000;
    this.skyDome.frustumCulled = false;
    this.scene.add(this.skyDome);
  }

  _buildVolumetricFogLayers() {
    // Low-lying atmospheric mist blankets drifting gently across valleys & lowlands
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
    grad.addColorStop(0, 'rgba(200, 208, 200, 0.22)');
    grad.addColorStop(0.55, 'rgba(182, 192, 184, 0.10)');
    grad.addColorStop(1, 'rgba(182, 192, 184, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const mistTex = new THREE.CanvasTexture(canvas);
    const mistMat = new THREE.MeshBasicMaterial({
      map: mistTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.42,
      side: THREE.DoubleSide
    });
    const mistSpots = [
      [-42, -265, 210],   // Northern Dam tailwater gorge mist
      [-22, -95, 250],    // Central Vostok Confluence mist
      [165, -310, 200],   // Vostok City river channel mist
      [-35, 115, 220],    // Central valley river mist
      [75, 335, 230],     // Southern estuary & beach mist
      [-395, -245, 210],  // Quarry / NW mountain pass mist
      [-240, 145, 210],   // SW coastal plain mist
      [250, -95, 220],    // East taiga valley mist
      [245, 365, 220]     // Cruise Terminal waterfront mist
    ];
    for (const [mx, mz, size] of mistSpots) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mistMat);
      m.rotation.x = -Math.PI / 2;
      const my = this.getTerrainHeight(mx, mz) + 2.2;
      m.position.set(mx, my, mz);
      this.scene.add(m);
      this.fogLayers.push({ mesh: m, baseX: mx, baseZ: mz, phase: Math.random() * Math.PI * 2 });
    }
  }

  _createGroundTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Gritty PS2 / Tarkov desaturated olive & compacted soil base
    ctx.fillStyle = '#55573f';
    ctx.fillRect(0, 0, 256, 256);

    // Mottled dirt & dead-grass patches
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 8 + Math.random() * 22;
      ctx.fillStyle = Math.random() > 0.45 ? 'rgba(107, 94, 68, 0.36)' : 'rgba(74, 75, 51, 0.36)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dark soil grit specks
    for (let i = 0; i < 1100; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(42, 40, 30, 0.36)' : 'rgba(128, 120, 92, 0.24)';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }

    // Sparse 2px dried grass strokes
    const bladeCols = ['rgba(124,120,76,0.42)', 'rgba(94,96,62,0.46)', 'rgba(66,68,44,0.40)'];
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const len = 2 + Math.random() * 4;
      ctx.fillStyle = bladeCols[i % bladeCols.length];
      ctx.fillRect(x, y, 2, len);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(110, 110);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  _createGrassTuftTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);

    const cols = ['#7d7a4a', '#6a6c3f', '#8a8458'];
    for (let i = 0; i < 18; i++) {
      const bx = 10 + (i / 17) * 44 + (Math.random() - 0.5) * 3;
      const h = 24 + Math.random() * 30;
      const lean = (Math.random() - 0.5) * 18;
      ctx.strokeStyle = cols[i % cols.length];
      ctx.lineWidth = 2 + Math.random();
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx, 63);
      ctx.quadraticCurveTo(bx + lean * 0.4, 63 - h * 0.55, bx + lean, 63 - h);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  _createFernCardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);

    // Central woody sapling/fern stem
    ctx.strokeStyle = '#5a5634';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(64, 126);
    ctx.quadraticCurveTo(66, 70, 62, 14);
    ctx.stroke();

    // 7 pairs of sharp serrated frond strokes (zero round blobs)
    const frondCols = ['#4d5c33', '#5c693b', '#3e4d29', '#6d7745'];
    for (let p = 0; p < 7; p++) {
      const yBase = 112 - p * 14;
      const span = (16 + (1 - Math.abs(p - 2.5) / 4.5) * 28);
      for (const dir of [-1, 1]) {
        ctx.strokeStyle = frondCols[(p + (dir > 0 ? 1 : 0)) % frondCols.length];
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(64, yBase);
        ctx.lineTo(64 + dir * span, yBase - 14);
        ctx.stroke();
        // Sub-leaflets
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(64 + dir * span * 0.45, yBase - 6);
        ctx.lineTo(64 + dir * span * 0.65, yBase - 18);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  _canvasTex(size, drawFn) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  _applyWorldUVs(geo, w, h, d, tile = 2.0) {
    const uvAttr = geo && geo.attributes && geo.attributes.uv;
    if (!uvAttr) return;
    const t = tile > 0 ? tile : 2.0;
    const dims = [
      [d, h], // +X
      [d, h], // -X
      [w, d], // +Y
      [w, d], // -Y
      [w, h], // +Z
      [w, h]  // -Z
    ];
    for (let f = 0; f < 6; f++) {
      const fw = dims[f][0] / t;
      const fh = dims[f][1] / t;
      const base = f * 4;
      for (let v = 0; v < 4; v++) {
        const idx = base + v;
        if (idx >= uvAttr.count) break;
        uvAttr.setXY(idx, uvAttr.getX(idx) * fw, uvAttr.getY(idx) * fh);
      }
    }
    uvAttr.needsUpdate = true;
  }

  _texConcrete() {
    return this._canvasTex(512, (ctx, s) => {
      // Neutral light cast concrete (~0.72 lum) for crisp tinting
      ctx.fillStyle = '#babab6';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 6000; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const v = 155 + Math.floor(Math.random() * 55);
        ctx.fillStyle = `rgba(${v},${v},${v - 2},0.28)`;
        ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
      }
      // Subtle panel seams
      ctx.strokeStyle = 'rgba(85, 85, 82, 0.35)';
      ctx.lineWidth = 2;
      for (let g = 128; g < s; g += 128) {
        ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(s, g); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, s); ctx.stroke();
      }
      // Form-tie recess dots on grid
      for (let y = 64; y < s; y += 128) {
        for (let x = 64; x < s; x += 128) {
          ctx.fillStyle = 'rgba(72, 72, 70, 0.55)';
          ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(215, 215, 210, 0.40)';
          ctx.beginPath(); ctx.arc(x - 1, y - 1, 2.0, 0, Math.PI * 2); ctx.fill();
        }
      }
      // Vertical rain/grime streaks
      for (let i = 0; i < 42; i++) {
        const x = Math.random() * s;
        const y = Math.random() * (s * 0.6);
        const h = 50 + Math.random() * 140;
        const grad = ctx.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, 'rgba(65, 65, 62, 0.16)');
        grad.addColorStop(1, 'rgba(65, 65, 62, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, 2 + Math.random() * 4, h);
      }
      // Darker weathering band along bottom edge
      const botGrad = ctx.createLinearGradient(0, s * 0.72, 0, s);
      botGrad.addColorStop(0, 'rgba(60, 60, 58, 0)');
      botGrad.addColorStop(1, 'rgba(60, 60, 58, 0.28)');
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, s * 0.72, s, s * 0.28);
    });
  }

  _texPlaster() {
    return this._canvasTex(512, (ctx, s) => {
      ctx.fillStyle = '#c4c2bc';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 7500; i++) {
        const v = 165 + Math.floor(Math.random() * 55);
        ctx.fillStyle = `rgba(${v},${v},${v - 3},0.25)`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
      // Soft water stains
      for (let i = 0; i < 24; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 18 + Math.random() * 44;
        const g = ctx.createRadialGradient(x, y, 2, x, y, r);
        g.addColorStop(0, 'rgba(110, 106, 98, 0.16)');
        g.addColorStop(1, 'rgba(110, 106, 98, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      // Hairline plaster cracks
      ctx.strokeStyle = 'rgba(92, 90, 84, 0.35)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 10; i++) {
        let cx = Math.random() * s;
        let cy = Math.random() * s;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        for (let step = 0; step < 6; step++) {
          cx += (Math.random() - 0.5) * 32;
          cy += 6 + Math.random() * 18;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
    });
  }

  _texBrick() {
    return this._canvasTex(512, (ctx, s) => {
      // Mortar base
      ctx.fillStyle = '#8d8478';
      ctx.fillRect(0, 0, s, s);
      const courses = 8;
      const rowH = s / courses;
      const cols = 4;
      const colW = s / cols;
      const mortar = 5;
      for (let r = 0; r < courses; r++) {
        const offset = (r % 2) * (colW * 0.5);
        for (let c = -1; c <= cols; c++) {
          const bx = c * colW + offset + mortar * 0.5;
          const by = r * rowH + mortar * 0.5;
          const bw = colW - mortar;
          const bh = rowH - mortar;
          const red = 132 + Math.floor(Math.random() * 34);
          const grn = 48 + Math.floor(Math.random() * 22);
          const blu = 38 + Math.floor(Math.random() * 18);
          ctx.fillStyle = `rgb(${red},${grn},${blu})`;
          ctx.fillRect(bx, by, bw, bh);
          // Subtle brick face highlight / texture
          ctx.fillStyle = 'rgba(255,220,190,0.08)';
          ctx.fillRect(bx, by, bw, 4);
          ctx.fillStyle = 'rgba(30,18,14,0.16)';
          ctx.fillRect(bx, by + bh - 4, bw, 4);
        }
      }
      // Light grit & soot near bottom
      for (let i = 0; i < 2400; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(35,30,28,0.14)' : 'rgba(220,210,195,0.09)';
        ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
      const soot = ctx.createLinearGradient(0, s * 0.68, 0, s);
      soot.addColorStop(0, 'rgba(28, 24, 22, 0)');
      soot.addColorStop(1, 'rgba(28, 24, 22, 0.34)');
      ctx.fillStyle = soot;
      ctx.fillRect(0, s * 0.68, s, s * 0.32);
    });
  }

  _texSiding() {
    return this._canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#b4b6b2';
      ctx.fillRect(0, 0, s, s);
      // Vertical corrugated ribs every 16px
      for (let x = 0; x < s; x += 16) {
        const g = ctx.createLinearGradient(x, 0, x + 16, 0);
        g.addColorStop(0.0, 'rgba(65, 65, 65, 0.32)');
        g.addColorStop(0.28, 'rgba(235, 235, 235, 0.25)');
        g.addColorStop(0.55, 'rgba(180, 180, 180, 0.05)');
        g.addColorStop(0.85, 'rgba(55, 55, 55, 0.30)');
        g.addColorStop(1.0, 'rgba(65, 65, 65, 0.32)');
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, 16, s);
      }
      // Rust streaks dripping from top / panel seams
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(Math.random() * 16) * 16 + Math.random() * 6;
        const y = Math.random() < 0.5 ? 0 : Math.random() * 120;
        const h = 35 + Math.random() * 110;
        const rg = ctx.createLinearGradient(0, y, 0, y + h);
        rg.addColorStop(0, 'rgba(115, 58, 32, 0.34)');
        rg.addColorStop(1, 'rgba(115, 58, 32, 0)');
        ctx.fillStyle = rg;
        ctx.fillRect(x, y, 2 + Math.random() * 4, h);
      }
    });
  }

  _texFloorTile() {
    return this._canvasTex(512, (ctx, s) => {
      ctx.fillStyle = '#bab6ae';
      ctx.fillRect(0, 0, s, s);
      const count = 4; // 4 tiles per 2.4m = 0.6m each
      const step = s / count;
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          const delta = Math.floor((Math.random() - 0.5) * 14);
          const v = 186 + delta;
          ctx.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
          ctx.fillRect(c * step + 2, r * step + 2, step - 4, step - 4);
        }
      }
      // Grout lines
      ctx.strokeStyle = 'rgba(78, 76, 70, 0.52)';
      ctx.lineWidth = 3;
      for (let g = 0; g <= s; g += step) {
        ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(s, g); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, s); ctx.stroke();
      }
      // Subtle floor scuffs
      for (let i = 0; i < 65; i++) {
        ctx.strokeStyle = 'rgba(72, 70, 64, 0.16)';
        ctx.lineWidth = 1.5 + Math.random() * 2;
        const x = Math.random() * s;
        const y = Math.random() * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 28, y + (Math.random() - 0.5) * 28);
        ctx.stroke();
      }
    });
  }

  _texWood() {
    return this._canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#b9a690';
      ctx.fillRect(0, 0, s, s);
      const planks = 6;
      const ph = s / planks;
      for (let p = 0; p < planks; p++) {
        const y0 = p * ph;
        const tone = 172 + Math.floor((Math.random() - 0.5) * 26);
        ctx.fillStyle = `rgb(${tone + 10},${tone - 4},${tone - 22})`;
        ctx.fillRect(0, y0, s, ph - 2);
        ctx.fillStyle = 'rgba(55, 40, 26, 0.45)';
        ctx.fillRect(0, y0 + ph - 2, s, 2);
        // Horizontal wood grain lines
        for (let g = 0; g < 18; g++) {
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(85, 62, 42, 0.18)' : 'rgba(235, 220, 198, 0.12)';
          ctx.fillRect(0, y0 + Math.random() * (ph - 3), s, 1);
        }
        // Subtle knot
        if (Math.random() < 0.55) {
          ctx.fillStyle = 'rgba(70, 50, 32, 0.35)';
          ctx.beginPath();
          ctx.ellipse(30 + Math.random() * (s - 60), y0 + ph * 0.5, 8, 3.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  }

  _texRoofTar() {
    return this._canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#9e9c98';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 4500; i++) {
        const v = 115 + Math.floor(Math.random() * 80);
        ctx.fillStyle = `rgba(${v},${v},${v - 2},0.34)`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 2.2, 2.2);
      }
      // Felt roll seams
      ctx.strokeStyle = 'rgba(55, 55, 55, 0.35)';
      ctx.lineWidth = 2;
      for (let y = 64; y < s; y += 64) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
      }
    });
  }

  _texAsphalt() {
    return this._canvasTex(512, (ctx, s) => {
      ctx.fillStyle = '#a8a8a4';
      ctx.fillRect(0, 0, s, s);
      // Aggregate stone speckle
      for (let i = 0; i < 9500; i++) {
        const v = 110 + Math.floor(Math.random() * 95);
        ctx.fillStyle = `rgba(${v},${v},${v - 2},0.32)`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
      // Worn lighter tire-wear / weathered patches
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 20 + Math.random() * 48;
        const g = ctx.createRadialGradient(x, y, 2, x, y, r);
        g.addColorStop(0, 'rgba(195, 195, 190, 0.18)');
        g.addColorStop(1, 'rgba(195, 195, 190, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      // Branching pavement cracks
      ctx.strokeStyle = 'rgba(42, 42, 42, 0.45)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 8; i++) {
        let cx = Math.random() * s;
        let cy = Math.random() * s;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        for (let k = 0; k < 8; k++) {
          cx += (Math.random() - 0.5) * 38;
          cy += (Math.random() - 0.5) * 38;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
    });
  }

  _texMetal() {
    return this._canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#babec2';
      ctx.fillRect(0, 0, s, s);
      // Horizontal brushed steel streaks
      for (let i = 0; i < 420; i++) {
        const y = Math.random() * s;
        const x = Math.random() * s;
        const len = 18 + Math.random() * 75;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(235, 240, 244, 0.16)' : 'rgba(92, 98, 105, 0.18)';
        ctx.fillRect(x, y, len, 1.2);
      }
      // Scratches
      ctx.strokeStyle = 'rgba(230, 234, 238, 0.25)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 20);
        ctx.stroke();
      }
      // Light oxidation spots
      for (let i = 0; i < 12; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 6 + Math.random() * 14;
        const g = ctx.createRadialGradient(x, y, 1, x, y, r);
        g.addColorStop(0, 'rgba(130, 80, 48, 0.20)');
        g.addColorStop(1, 'rgba(130, 80, 48, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  _texCrate() {
    return this._canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#c0beb4';
      ctx.fillRect(0, 0, s, s);
      // Plywood grain noise
      for (let i = 0; i < 1600; i++) {
        const v = 160 + Math.floor(Math.random() * 55);
        ctx.fillStyle = `rgba(${v},${v - 2},${v - 6},0.22)`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 6, 1.5);
      }
      // Darker crate framing rails & diagonal batten hint
      ctx.strokeStyle = 'rgba(60, 58, 52, 0.55)';
      ctx.lineWidth = 18;
      ctx.strokeRect(9, 9, s - 18, s - 18);
      ctx.fillStyle = 'rgba(72, 70, 62, 0.32)';
      ctx.fillRect(24, s * 0.44, s - 48, 10);
      // Stencil markings
      ctx.fillStyle = 'rgba(42, 42, 38, 0.55)';
      ctx.fillRect(42, 42, 54, 10);
      ctx.fillRect(42, 58, 34, 6);
      ctx.fillRect(s - 76, s - 56, 36, 14);
    });
  }

  _createMaterials() {
    const concreteTex = this._texConcrete();
    const plasterTex = this._texPlaster();
    const brickTex = this._texBrick();
    const sidingTex = this._texSiding();
    const floorTileTex = this._texFloorTile();
    const woodTex = this._texWood();
    const roofTarTex = this._texRoofTar();
    const asphaltTex = this._texAsphalt();
    const metalTex = this._texMetal();
    const crateTex = this._texCrate();

    const makeMat = (opts, tile) => {
      const m = new THREE.MeshLambertMaterial(opts);
      m.userData.tile = tile;
      return m;
    };

    const windowGlassMat = new THREE.MeshPhongMaterial({
      color: 0x1d2c36,
      specular: 0xb8d8f0,
      shininess: 110,
      transparent: true,
      opacity: 0.72
    });
    windowGlassMat.userData.tile = 2.0;

    return {
      ground: new THREE.MeshLambertMaterial({ map: this._createGroundTexture(), vertexColors: true }),
      road: makeMat({ map: asphaltTex, color: 0x6a6a68, polygonOffset: true, polygonOffsetFactor: -2 }, 6.0),
      concrete: makeMat({ map: concreteTex, color: 0x9a9a94 }, 3.0),
      darkConcrete: makeMat({ map: concreteTex, color: 0x66665f }, 3.0),
      whiteWall: makeMat({ map: plasterTex, color: 0xf0efe8 }, 2.5),
      policeNavy: makeMat({ map: plasterTex, color: 0x3a5680 }, 2.5),
      fireRed: makeMat({ map: brickTex, color: 0xffffff }, 2.0),
      bossDark: makeMat({ map: concreteTex, color: 0x3c3e42 }, 3.0),
      interiorPlaster: makeMat({ map: plasterTex, color: 0xd9d4c8 }, 2.5),
      floorTile: makeMat({ map: floorTileTex, color: 0xcfcac0 }, 2.4),
      roofTar: makeMat({ map: roofTarTex, color: 0x5a5a58 }, 3.0),
      hazardAmber: makeMat({ color: 0xd99b26 }, 2.0),
      windowGlass: windowGlassMat,
      windowFrame: makeMat({ map: metalTex, color: 0x2a2e32 }, 1.5),
      doorWood: makeMat({ map: woodTex, color: 0x7a5a3c }, 1.5),
      doorSteel: makeMat({ map: metalTex, color: 0x56606a }, 1.5),
      rustRed: makeMat({ map: sidingTex, color: 0x8c4a36 }, 2.0),
      rustOlive: makeMat({ map: sidingTex, color: 0x6d7558 }, 2.0),
      rustBlue: makeMat({ map: sidingTex, color: 0x46627a }, 2.0),
      wood: makeMat({ map: woodTex, color: 0x8a6a4a }, 1.5),
      metal: makeMat({ map: metalTex, color: 0x6a6e72 }, 1.5),
      crateMil: makeMat({ map: crateTex, color: 0x55683f }, 1.2),
      crateMed: makeMat({ map: plasterTex, color: 0xe8ece8 }, 2.5),
      crateSup: makeMat({ map: crateTex, color: 0x9a7444 }, 1.2)
    };
  }

  _buildEnvironment() {
    // Subdivided Varying Wasteland Terrain Mesh (84x84 = 14k tris for crisp rolling hills at 60+ FPS!)
    const terrainSize = 2100;
    const segs = 192;
    const groundGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segs, segs);
    groundGeo.rotateX(-Math.PI / 2);

    const posAttr = groundGeo.attributes.position;
    const heights = new Float32Array(posAttr.count);
    const colors = new Float32Array(posAttr.count * 3);
    const colLow = new THREE.Color(0x525d46);     // Cool Northern Russian taiga moss
    const colMid = new THREE.Color(0x5f684c);     // Sub-arctic pine & heather meadow
    const colHigh = new THREE.Color(0x6d705c);    // Windswept northern tundra
    const colSlope = new THREE.Color(0x5e6266);   // Cold granite mountain rock
    const colSnow = new THREE.Color(0xdde5ea);    // Alpine snow-dusted mountain peaks
    const colSand = new THREE.Color(0xc4b588);    // Southern coastal beach sand & shingle
    const colWet = new THREE.Color(0x595642);     // Wet shoreline band
    const colShallow = new THREE.Color(0x3f585c); // Shallow submerged sea/river bed
    const colDeep = new THREE.Color(0x223844);    // Deep ocean & reservoir bed
    const tmpCol = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = this._evalAnalyticalTerrainHeight(vx, vz);
      posAttr.setY(i, vy);
      heights[i] = vy;

      // Compute approximate slope for granite rock & snow-peak blending
      const hx = this._evalAnalyticalTerrainHeight(vx + 3, vz) - vy;
      const hz = this._evalAnalyticalTerrainHeight(vx, vz + 3) - vy;
      const slope = Math.hypot(hx, hz) / 3;

      if (vy < 1.5) {
        tmpCol.copy(colLow).lerp(colMid, THREE.MathUtils.clamp((vy + 2.0) / 3.5, 0, 1));
      } else if (vy < 9.5) {
        tmpCol.copy(colMid).lerp(colHigh, THREE.MathUtils.clamp((vy - 1.5) / 8.0, 0, 1));
      } else {
        tmpCol.copy(colHigh).lerp(colSlope, THREE.MathUtils.clamp((vy - 9.5) / 9.0, 0, 0.72));
      }
      if (slope > 0.15) {
        tmpCol.lerp(colSlope, THREE.MathUtils.clamp((slope - 0.15) * 2.8, 0, 0.85));
      }
      // Snow-dusted Northern Russian mountain peaks (y > 21.5m in NW range & Dam shoulders)
      if (vy > 21.5) {
        const snowK = THREE.MathUtils.clamp((vy - 21.5) / 11.5, 0, 0.94) * (1 - THREE.MathUtils.clamp((slope - 0.52) * 1.3, 0, 0.52));
        tmpCol.lerp(colSnow, snowK);
      }

      // Southern coastal sandy beach band (gradually blending from coastal grass into beach sand)
      const oDist = this._oceanDist(vx, vz);
      if (oDist > -58 && oDist <= 6) {
        const sandK = THREE.MathUtils.clamp((oDist + 58) / 42, 0, 1);
        tmpCol.lerp(colSand, sandK * 0.86);
      }

      // Sandy/silty riverbank, reservoir & submerged ocean/riverbed tinting
      const wSurf = this.getWaterSurfaceY(vx, vz);
      if (wSurf !== null) {
        const subDepth = wSurf - vy;
        if (subDepth > -0.65 && subDepth <= 0.08) {
          tmpCol.lerp(colSand, 0.45);
          tmpCol.lerp(colWet, 0.35);
        }
        if (subDepth > 0.02) {
          const dk = Math.max(0, Math.min(1, subDepth / 2.2));
          tmpCol.lerp(colShallow, Math.min(0.85, 0.35 + dk * 0.5));
          if (subDepth > 1.35) tmpCol.lerp(colDeep, Math.min(0.92, (subDepth - 1.35) / 2.4));
        }
      }
      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();
    this._terrainSize = terrainSize;
    this._terrainSegs = segs;
    this._terrainHeights = heights;

    const ground = new THREE.Mesh(groundGeo, this._materials.ground);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.terrainMesh = ground;

    // Terrain-conforming segmented asphalt highways + walkable 3D concrete river bridges!
    const evalRoadY = (wx, wz) => {
      let wy = this.getTerrainHeight(wx, wz) + 0.09;
      const bridgeRamp = 18;
      const rA = this._projectOntoRiver(wx, wz, this._riverA);
      if (rA.margin < bridgeRamp) {
        const u = Math.max(0, rA.margin / bridgeRamp);
        const bridgeK = Math.cos(u * Math.PI * 0.5);
        const bridgeY = this._riverWaterYA(rA.s) + 1.08;
        wy = Math.max(wy, wy * (1 - bridgeK) + bridgeY * bridgeK);
      }
      const rB = this._projectOntoRiver(wx, wz, this._riverB);
      if (rB.margin < bridgeRamp) {
        const u = Math.max(0, rB.margin / bridgeRamp);
        const bridgeK = Math.cos(u * Math.PI * 0.5);
        const bridgeY = this._riverWaterYB(rB.s) + 1.08;
        wy = Math.max(wy, wy * (1 - bridgeK) + bridgeY * bridgeK);
      }
      return wy;
    };

    const addTerrainRoad = (x1, z1, x2, z2, width = 10) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const steps = Math.max(16, Math.round(len / 7));
      const geo = new THREE.PlaneGeometry(width, len, 2, steps);
      geo.rotateX(-Math.PI / 2);
      const angle = Math.atan2(x2 - x1, z2 - z1);
      const cx = (x1 + x2) * 0.5;
      const cz = (z1 + z2) * 0.5;
      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);
      const pa = geo.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const lx = pa.getX(i);
        const lz = pa.getZ(i);
        const wx = cx + lx * cosA + lz * sinA;
        const wz = cz - lx * sinA + lz * cosA;
        pa.setXYZ(i, wx, evalRoadY(wx, wz), wz);
      }
      geo.computeVertexNormals();
      const uvAttr = geo.attributes && geo.attributes.uv;
      if (uvAttr) {
        const tile = (this._materials.road && this._materials.road.userData && this._materials.road.userData.tile) || 6.0;
        for (let i = 0; i < uvAttr.count; i++) {
          uvAttr.setXY(i, uvAttr.getX(i) * (width / tile), uvAttr.getY(i) * (len / tile));
        }
        uvAttr.needsUpdate = true;
      }
      const mesh = new THREE.Mesh(geo, this._materials.road);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.shootableMeshes.push(mesh);

      // Build walkable concrete bridge deck colliders, side curbs & riverbed piers wherever road crosses water!
      const cSteps = Math.max(4, Math.ceil(len / 2.2));
      let pierCounter = 0;
      for (let s = 0; s <= cSteps; s++) {
        const t = s / cSteps;
        const sx = x1 + (x2 - x1) * t;
        const sz = z1 + (z2 - z1) * t;
        const rA = this._projectOntoRiver(sx, sz, this._riverA);
        const rB = this._projectOntoRiver(sx, sz, this._riverB);
        if (rA.margin < 16 || rB.margin < 16) {
          const deckY = evalRoadY(sx, sz);
          const terrY = this.getTerrainHeight(sx, sz);
          if (deckY > terrY + 0.16) {
            const halfSpan = width * 0.48;
            this.colliders.push({
              minX: sx - halfSpan, maxX: sx + halfSpan,
              minY: deckY - 0.45, maxY: deckY,
              minZ: sz - halfSpan, maxZ: sz + halfSpan
            });
            this._addDecor(sx, deckY - 0.24, sz, width + 0.6, 0.42, 2.5, this._materials.darkConcrete, angle);
            if ((rA.margin < 2 || rB.margin < 2) && (pierCounter++ % 7 === 3)) {
              const pierH = Math.max(1.2, deckY - terrY + 0.6);
              this._addBox(sx - cosA * (width * 0.36), deckY - 0.25 - pierH * 0.5, sz + sinA * (width * 0.36), 1.1, pierH, 1.1, this._materials.concrete, true);
              this._addBox(sx + cosA * (width * 0.36), deckY - 0.25 - pierH * 0.5, sz - sinA * (width * 0.36), 1.1, pierH, 1.1, this._materials.concrete, true);
            }
          }
        }
      }
    };

    for (const [rx1, rz1, rx2, rz2, rw] of this.ROADS) {
      addTerrainRoad(rx1, rz1, rx2, rz2, rw);
    }

    this._buildWater();
  }

  getWaterSurfaceY(x, z) {
    if (this.isBunkerMap) return this._zavodWaterSurfaceY(x, z);
    let level = -Infinity;
    const rA = this._projectOntoRiver(x, z, this._riverA);
    if (rA.margin < 3.0) {
      level = Math.max(level, this._riverWaterYA(rA.s));
    }
    const rB = this._projectOntoRiver(x, z, this._riverB);
    if (rB.margin < 3.0) {
      level = Math.max(level, this._riverWaterYB(rB.s));
    }
    if (this._oceanDist(x, z) > 0) {
      level = Math.max(level, this.OCEAN_WATER_Y);
    }
    const res = this.UPPER_RESERVOIR;
    if (res && z < -462) {
      const ru = Math.hypot((x - res.cx) / res.rx, (z - res.cz) / res.rz);
      if (ru <= 1.0) {
        level = Math.max(level, res.waterY);
      }
    }
    return level === -Infinity ? null : level;
  }

  getWaterDepth(x, z, feetY = null) {
    const level = this.getWaterSurfaceY(x, z);
    if (level === null) return 0;
    const t = (feetY !== null && Number.isFinite(feetY)) ? feetY : this.getTerrainHeight(x, z);
    return Math.max(0, level - t);
  }

  isInDeepWater(x, z, feetY = null) {
    return this.getWaterDepth(x, z, feetY) > 1.15;
  }

  _buildWater() {
    const mkWater = (color, opacity) => new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    });
    const riverMat = mkWater(0x2a6178, 0.85);
    const oceanMat = mkWater(0x1f4b63, 0.88);
    this.RIVER_POLYGONS = [];

    // Smooth variable-width sloped river & confluence basin ribbon mesh!
    const buildVariableSlopedRibbon = (riverData, evalYFn, mat) => {
      const pts = riverData.pts;
      const cum = riverData.cumLen;
      const total = riverData.totalLen;
      const verts = [];
      const idx = [];
      const leftBank2D = [];
      const rightBank2D = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const q = pts[Math.min(pts.length - 1, i + 1)];
        const o = pts[Math.max(0, i - 1)];
        let dx = q[0] - o[0];
        let dz = q[1] - o[1];
        const len = Math.hypot(dx, dz) || 1;
        dx /= len;
        dz /= len;
        const nx = -dz;
        const nz = dx;
        const hw = (p[2] || 20) + 2.0;
        const s = cum[i] / total;
        const wy = evalYFn(s);
        const lx = p[0] - nx * hw, lz = p[1] - nz * hw;
        const rx = p[0] + nx * hw, rz = p[1] + nz * hw;
        verts.push(lx, wy, lz);
        verts.push(rx, wy, rz);
        leftBank2D.push([lx, lz]);
        rightBank2D.push([rx, rz]);
        if (i > 0) {
          const b = i * 2;
          idx.push(b - 2, b - 1, b, b - 1, b + 1, b);
        }
      }
      this.RIVER_POLYGONS.push(leftBank2D.concat(rightBank2D.reverse()));
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.renderOrder = 2;
      this.scene.add(m);
      this.waterMeshes.push(m);
      return m;
    };

    buildVariableSlopedRibbon(this._riverA, (s) => this._riverWaterYA(s), riverMat);
    buildVariableSlopedRibbon(this._riverB, (s) => this._riverWaterYB(s), riverMat);

    // Upper Reservoir Lake north of the Northern Dam (E1.5, y = 13.6m)
    const res = this.UPPER_RESERVOIR;
    if (res) {
      const resGeo = new THREE.CircleGeometry(1, 32);
      resGeo.rotateX(-Math.PI / 2);
      resGeo.scale(res.rx, 1, res.rz);
      const resMesh = new THREE.Mesh(resGeo, riverMat);
      resMesh.position.set(res.cx, res.waterY, res.cz);
      resMesh.renderOrder = 2;
      this.scene.add(resMesh);
      this.waterMeshes.push(resMesh);
      const resPoly = [];
      for (let a = 0; a < 28; a++) {
        const th = (a / 28) * Math.PI * 2;
        resPoly.push([res.cx + Math.cos(th) * res.rx, res.cz + Math.sin(th) * res.rz]);
      }
      this.RESERVOIR_POLY = resPoly;
    }

    // Southern Ocean Expanse & White Beach Surf Foam (south of _shorelineZ(x))
    const oceanVerts = [];
    const oceanIdx = [];
    const foamVerts = [];
    const foamIdx = [];
    const shoreline2D = [];
    const stepsX = 48;
    for (let i = 0; i <= stepsX; i++) {
      const ox = -880 + (1760 * i) / stepsX;
      const sz = this._shorelineZ(ox) - 3.0;
      shoreline2D.push([ox, sz]);
      oceanVerts.push(ox, this.OCEAN_WATER_Y, sz);
      oceanVerts.push(ox, this.OCEAN_WATER_Y, 960);
      foamVerts.push(ox, this.OCEAN_WATER_Y + 0.04, sz - 0.5);
      foamVerts.push(ox, this.OCEAN_WATER_Y + 0.04, sz + 6.5);
      if (i > 0) {
        const b = i * 2;
        oceanIdx.push(b - 2, b - 1, b, b - 1, b + 1, b);
        foamIdx.push(b - 2, b - 1, b, b - 1, b + 1, b);
      }
    }
    const oGeo = new THREE.BufferGeometry();
    oGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(oceanVerts), 3));
    oGeo.setIndex(oceanIdx);
    oGeo.computeVertexNormals();
    const oMesh = new THREE.Mesh(oGeo, oceanMat);
    oMesh.renderOrder = 1;
    this.scene.add(oMesh);
    this.waterMeshes.push(oMesh);

    const fGeo = new THREE.BufferGeometry();
    fGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(foamVerts), 3));
    fGeo.setIndex(foamIdx);
    const fMesh = new THREE.Mesh(fGeo, mkWater(0xdbeaf0, 0.42));
    fMesh.renderOrder = 3;
    this.scene.add(fMesh);
    this.OCEAN_POLY = shoreline2D.concat([[880, 920], [-880, 920]]);
  }

  _buildForestAndFoliage() {
    // Deterministic PRNG so forests, foliage & boulders are consistent across multiplayer clients!
    let seed = 133742;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const isNearAnyRoad = (x, z, clearance = 11) => {
      if (!this.ROADS) return false;
      for (let i = 0; i < this.ROADS.length; i++) {
        const [ax, az, bx, bz, rw] = this.ROADS[i];
        const dx = bx - ax, dz = bz - az;
        const lSq = dx * dx + dz * dz || 1;
        let t = ((x - ax) * dx + (z - az) * dz) / lSq;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
        if (d < (rw || 9) * 0.5 + clearance) return true;
      }
      return false;
    };

    const isClearForNature = (x, z, padMargin = 8, strictInside = false) => {
      if (Math.abs(x) > this.mapHalfSize + 120 || Math.abs(z) > this.mapHalfSize + 120) return false;
      const outD = this.getOutOfBoundsDist(x, z);
      if (strictInside ? (outD > -4) : (outD > 95)) return false;
      // Keep forests off the Southern Beach & Ocean
      if (this._oceanDist && this._oceanDist(x, z) > -34) return false;
      // Keep forests out of rivers, reservoir & confluence basin
      if (this.getWaterDepth && this.getWaterDepth(x, z) > 0.12) return false;
      // Keep clear of Northern Dam structure
      const db = this.DAM_BOUNDS;
      if (db && x >= db.minX - 18 && x <= db.maxX + 18 && z >= db.minZ - 14 && z <= db.maxZ + 18) return false;
      // Keep clear of Airport Runway (-552, z in [-5..155])
      if (x >= -570 && x <= -532 && z >= -8 && z <= 158) return false;
      // Keep clear of tactical roads & bridges
      if (isNearAnyRoad(x, z, 8)) return false;
      // Keep clear of POI, Compound, Strip-Town & Extraction pads
      for (let i = 0; i < this._poiPads.length; i++) {
        const p = this._poiPads[i];
        if (Math.hypot(x - p.x, z - p.z) < p.r + padMargin) return false;
      }
      // Keep clear of operator spawn points
      for (let i = 0; i < this.operatorSpawns.length; i++) {
        const sp = this.operatorSpawns[i];
        if (Math.hypot(x - sp.x, z - sp.z) < 12) return false;
      }
      return true;
    };

    const dummy = new THREE.Object3D();

    // Helper: Build a crossed 3-plane star geometry for crisp see-through foliage clusters (1 draw call via InstancedMesh!)
    const buildCrossedPlanesGeo = (w, h, yOffset = 0, count = 3) => {
      const positions = [];
      const normals = [];
      const uvs = [];
      const indices = [];
      let vOff = 0;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI;
        const c = Math.cos(ang) * (w * 0.5);
        const s = Math.sin(ang) * (w * 0.5);
        positions.push(
          -c, yOffset, -s,
           c, yOffset,  s,
           c, yOffset + h,  s,
          -c, yOffset + h, -s
        );
        normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        indices.push(vOff, vOff + 1, vOff + 2, vOff, vOff + 2, vOff + 3);
        vOff += 4;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(indices);
      return g;
    };

    // Helper: Merge vertex-colored PS2 geometries (supports flatShading + vertexColors)
    const mergeColoredParts = (parts) => {
      let totalVerts = 0;
      const nonIdxList = parts.map((p) => {
        const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
        if (p.rot) g.rotateX(p.rot[0] || 0), g.rotateY(p.rot[1] || 0), g.rotateZ(p.rot[2] || 0);
        if (p.pos) g.translate(p.pos[0] || 0, p.pos[1] || 0, p.pos[2] || 0);
        totalVerts += g.attributes.position.count;
        return { g, color: new THREE.Color(p.color) };
      });
      const posArr = new Float32Array(totalVerts * 3);
      const normArr = new Float32Array(totalVerts * 3);
      const colArr = new Float32Array(totalVerts * 3);
      let vOff = 0;
      for (const item of nonIdxList) {
        const pa = item.g.attributes.position;
        const na = item.g.attributes.normal;
        for (let i = 0; i < pa.count; i++) {
          const idx3 = (vOff + i) * 3;
          posArr[idx3] = pa.getX(i);
          posArr[idx3 + 1] = pa.getY(i);
          posArr[idx3 + 2] = pa.getZ(i);
          if (na) {
            normArr[idx3] = na.getX(i);
            normArr[idx3 + 1] = na.getY(i);
            normArr[idx3 + 2] = na.getZ(i);
          } else {
            normArr[idx3 + 1] = 1;
          }
          colArr[idx3] = item.color.r;
          colArr[idx3 + 1] = item.color.g;
          colArr[idx3 + 2] = item.color.b;
        }
        vOff += pa.count;
        item.g.dispose();
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
      out.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
      return out;
    };

    // 1. Low-Poly PS2 Pine Trees & Bare/Dead Trees (760 total -> 2 draw calls!)
    const pineCount = 760;
    const livePineGeo = mergeColoredParts([
      { geo: new THREE.CylinderGeometry(0.16, 0.30, 2.2, 5), pos: [0, 1.1, 0], color: 0x4a3826 },
      { geo: new THREE.ConeGeometry(2.2, 2.6, 7), pos: [0, 2.9, 0], color: 0x2f4a2a },
      { geo: new THREE.ConeGeometry(1.7, 2.2, 7), pos: [0, 4.1, 0], color: 0x36522e },
      { geo: new THREE.ConeGeometry(1.1, 1.8, 7), pos: [0, 5.2, 0], color: 0x3e5b33 }
    ]);
    const deadTreeGeo = mergeColoredParts([
      { geo: new THREE.CylinderGeometry(0.14, 0.28, 4.4, 5), pos: [0, 2.2, 0], color: 0x5a4a38 },
      { geo: new THREE.BoxGeometry(0.13, 1.5, 0.13), pos: [0.42, 2.6, 0.12], rot: [0.2, 0, -0.68], color: 0x524231 },
      { geo: new THREE.BoxGeometry(0.12, 1.4, 0.12), pos: [-0.38, 3.2, -0.18], rot: [-0.25, 0, 0.62], color: 0x5a4a38 },
      { geo: new THREE.BoxGeometry(0.11, 1.1, 0.11), pos: [0.10, 3.8, 0.36], rot: [0.58, 0, 0.18], color: 0x4f4030 }
    ]);

    const treeMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const livePineInst = new THREE.InstancedMesh(livePineGeo, treeMat, pineCount);
    const deadTreeInst = new THREE.InstancedMesh(deadTreeGeo, treeMat, Math.ceil(pineCount * 0.35));
    livePineInst.castShadow = false;
    deadTreeInst.castShadow = false;

    let placedPines = 0;
    let placedLive = 0;
    let placedDead = 0;
    for (let tries = 0; tries < 3600 && placedPines < pineCount; tries++) {
      const x = (rand() * 2 - 1) * (this.mapHalfSize + 70);
      const z = (rand() * 2 - 1) * (this.mapHalfSize + 70);
      if (!isClearForNature(x, z, 6)) continue;
      const grove = Math.sin(x * 0.009) * Math.cos(z * 0.009) + Math.sin((x - z) * 0.006) * 0.5;
      if (grove < -0.35 && rand() < 0.62) continue;

      const y = this.getTerrainHeight(x, z);
      const s = 0.78 + rand() * 0.72;
      const isDead = rand() < 0.25 && placedDead < deadTreeInst.instanceMatrix.count;
      dummy.position.set(x, y - 0.15, z);
      dummy.rotation.set((rand() - 0.5) * 0.05, rand() * Math.PI * 2, (rand() - 0.5) * 0.05);
      dummy.scale.set(s, s * (0.9 + rand() * 0.28), s);
      dummy.updateMatrix();

      if (isDead) {
        deadTreeInst.setMatrixAt(placedDead++, dummy.matrix);
      } else {
        livePineInst.setMatrixAt(placedLive++, dummy.matrix);
      }

      if (this.getOutOfBoundsDist(x, z) <= 45) {
        const cr = 0.36 * s;
        this.colliders.push({
          minX: x - cr, maxX: x + cr,
          minY: y - 0.5, maxY: y + 4.8 * s,
          minZ: z - cr, maxZ: z + cr
        });
      }
      placedPines++;
    }
    livePineInst.count = placedLive;
    deadTreeInst.count = placedDead;
    livePineInst.userData.maxCount = placedLive;
    deadTreeInst.userData.maxCount = placedDead;
    livePineInst.instanceMatrix.needsUpdate = true;
    deadTreeInst.instanceMatrix.needsUpdate = true;
    livePineInst.matrixAutoUpdate = false;
    deadTreeInst.matrixAutoUpdate = false;
    this._pineMeshes = [livePineInst, deadTreeInst];
    this._maxPines = placedLive;
    this.scene.add(livePineInst, deadTreeInst);

    // 2. Crisp Grass Tufts (3,200 instances of 2-plane crossed cards -> 1 draw call!)
    const grassCount = 3200;
    const grassGeo = buildCrossedPlanesGeo(0.9, 0.55, -0.04, 2);
    const grassMat = new THREE.MeshLambertMaterial({
      map: this._createGrassTuftTexture(),
      alphaTest: 0.5,
      side: THREE.DoubleSide
    });
    const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
    grassInst.receiveShadow = false;
    grassInst.castShadow = false;

    let placedGrass = 0;
    for (let tries = 0; tries < 9500 && placedGrass < grassCount; tries++) {
      const x = (rand() * 2 - 1) * this.mapHalfSize;
      const z = (rand() * 2 - 1) * this.mapHalfSize;
      if (!isClearForNature(x, z, 2, true)) continue;
      const y = this.getTerrainHeight(x, z);
      const s = 0.72 + rand() * 0.75;
      dummy.position.set(x, y - 0.03, z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.set(s, s * (0.75 + rand() * 0.5), s);
      dummy.updateMatrix();
      grassInst.setMatrixAt(placedGrass++, dummy.matrix);
    }
    grassInst.count = placedGrass;
    grassInst.instanceMatrix.needsUpdate = true;
    grassInst.matrixAutoUpdate = false;
    this._bushInst = grassInst;
    this._maxBushes = placedGrass;
    this.scene.add(grassInst);

    // 3. Sharp PS2 Fern / Sapling Cards (700 instances of 3-plane cards -> 1 draw call!)
    const fernCount = 700;
    const fernGeo = buildCrossedPlanesGeo(1.6, 1.3, -0.05, 3);
    const fernMat = new THREE.MeshLambertMaterial({
      map: this._createFernCardTexture(),
      alphaTest: 0.5,
      side: THREE.DoubleSide
    });
    const fernInst = new THREE.InstancedMesh(fernGeo, fernMat, fernCount);
    fernInst.receiveShadow = false;
    fernInst.castShadow = false;

    let placedFerns = 0;
    for (let tries = 0; tries < 3600 && placedFerns < fernCount; tries++) {
      const x = (rand() * 2 - 1) * this.mapHalfSize;
      const z = (rand() * 2 - 1) * this.mapHalfSize;
      if (!isClearForNature(x, z, 3, true)) continue;
      const y = this.getTerrainHeight(x, z);
      const s = 0.75 + rand() * 0.65;
      dummy.position.set(x, y - 0.04, z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.set(s, s * (0.85 + rand() * 0.35), s);
      dummy.updateMatrix();
      fernInst.setMatrixAt(placedFerns++, dummy.matrix);
    }
    fernInst.count = placedFerns;
    fernInst.instanceMatrix.needsUpdate = true;
    fernInst.matrixAutoUpdate = false;
    this._fernInst = fernInst;
    this._maxFerns = placedFerns;
    this.scene.add(fernInst);

    // 3. Natural Rock Outcrops & Tactical Cover Boulders (110 formations with colliders -> 1 draw call!)
    const rockCount = 110;
    const rockGeo = new THREE.DodecahedronGeometry(2.1, 0);
    rockGeo.scale(1.25, 0.78, 1.05);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x67645e });
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rockInst.castShadow = false;
    rockInst.receiveShadow = true;

    let placedRocks = 0;
    for (let tries = 0; tries < 1400 && placedRocks < rockCount; tries++) {
      const x = (rand() * 2 - 1) * (this.mapHalfSize - 15);
      const z = (rand() * 2 - 1) * (this.mapHalfSize - 15);
      if (!isClearForNature(x, z, 8, true)) continue;
      const y = this.getTerrainHeight(x, z);
      const s = 0.75 + rand() * 1.15;
      dummy.position.set(x, y + 0.55 * s, z);
      dummy.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
      dummy.scale.set(s, s * (0.75 + rand() * 0.45), s);
      dummy.updateMatrix();
      rockInst.setMatrixAt(placedRocks, dummy.matrix);

      const rx = 1.85 * s;
      const rz = 1.65 * s;
      this.colliders.push({
        minX: x - rx, maxX: x + rx,
        minY: y - 0.5, maxY: y + 1.85 * s,
        minZ: z - rz, maxZ: z + rz
      });
      const rCs = this._rayCellSize || 24;
      const rcx0 = Math.floor((x - rx) / rCs);
      const rcx1 = Math.floor((x + rx) / rCs);
      const rcz0 = Math.floor((z - rz) / rCs);
      const rcz1 = Math.floor((z + rz) / rCs);
      for (let rcx = rcx0; rcx <= rcx1; rcx++) {
        for (let rcz = rcz0; rcz <= rcz1; rcz++) {
          this._rockCells.add((rcx << 16) ^ rcz);
        }
      }
      placedRocks++;
    }
    rockInst.count = placedRocks;
    rockInst.instanceMatrix.needsUpdate = true;
    if (rockInst.geometry) {
      rockInst.geometry.computeBoundingSphere();
      rockInst.geometry.computeBoundingBox();
    }
    rockInst.updateMatrixWorld(true);
    this.scene.add(rockInst);
    this._rockInst = rockInst;
  }

  _addBox(x, y, z, w, h, d, material, addCollider = true) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const tile = (material && material.userData && material.userData.tile) || 2.0;
    this._applyWorldUVs(geo, w, h, d, tile);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = h > 1.2 && w > 1.0;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.shootableMeshes.push(mesh);
    this.wallMeshes.push(mesh);

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
    if (this._batchingOpen && this._batchEntries) {
      this._batchEntries.push({ geometry: geo, matrix: mesh.matrix.clone(), material, castShadow: mesh.castShadow, source: mesh });
    }
    return mesh;
  }

  _batchStaticGeometry() {
    if (!this._batchEntries || this._batchEntries.length === 0) {
      this._batchingOpen = false;
      this._batchEntries = null;
      return;
    }
    const groups = new Map();
    for (let i = 0; i < this._batchEntries.length; i++) {
      const e = this._batchEntries[i];
      if (!e || !e.geometry || !e.material) continue;
      const ex = e.matrix.elements[12];
      const ez = e.matrix.elements[14];
      const bcs = this._batchCellSize || 96;
      const key = `${e.material.uuid}|${Math.floor(ex / bcs)}|${Math.floor(ez / bcs)}`;
      let bucket = groups.get(key);
      if (!bucket) {
        bucket = { material: e.material, entries: [] };
        groups.set(key, bucket);
      }
      bucket.entries.push(e);
    }

    const pVec = new THREE.Vector3();
    const nVec = new THREE.Vector3();
    const normMat = new THREE.Matrix3();

    for (const bucket of groups.values()) {
      const list = bucket.entries;
      let totalVerts = 0;
      let totalIndices = 0;
      let anyCastShadow = false;
      for (const e of list) {
        const g = e.geometry;
        totalVerts += g.attributes.position.count;
        totalIndices += g.index ? g.index.count : g.attributes.position.count;
        if (e.castShadow) anyCastShadow = true;
        if (e.source) {
          e.source.matrixWorld.copy(e.source.matrix);
          if (g && !g.boundingBox) g.computeBoundingBox();
          if (g && !g.boundingSphere) g.computeBoundingSphere();
          e.source.visible = false;
          if (this.scene) this.scene.remove(e.source);
        }
      }

      const positions = new Float32Array(totalVerts * 3);
      const normals = new Float32Array(totalVerts * 3);
      const uvs = new Float32Array(totalVerts * 2);
      const indices = totalVerts > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

      let vOffset = 0;
      let iOffset = 0;
      for (const e of list) {
        const g = e.geometry;
        const posAttr = g.attributes.position;
        const normAttr = g.attributes.normal;
        const uvAttr = g.attributes.uv;
        normMat.getNormalMatrix(e.matrix);

        for (let i = 0; i < posAttr.count; i++) {
          const vi3 = (vOffset + i) * 3;
          const vi2 = (vOffset + i) * 2;
          pVec.fromBufferAttribute(posAttr, i).applyMatrix4(e.matrix);
          positions[vi3] = pVec.x;
          positions[vi3 + 1] = pVec.y;
          positions[vi3 + 2] = pVec.z;

          if (normAttr) {
            nVec.fromBufferAttribute(normAttr, i).applyMatrix3(normMat).normalize();
            normals[vi3] = nVec.x;
            normals[vi3 + 1] = nVec.y;
            normals[vi3 + 2] = nVec.z;
          } else {
            normals[vi3 + 1] = 1;
          }

          if (uvAttr) {
            uvs[vi2] = uvAttr.getX(i);
            uvs[vi2 + 1] = uvAttr.getY(i);
          }
        }

        if (g.index) {
          const gIdx = g.index;
          for (let k = 0; k < gIdx.count; k++) {
            indices[iOffset++] = gIdx.getX(k) + vOffset;
          }
        } else {
          for (let k = 0; k < posAttr.count; k++) {
            indices[iOffset++] = k + vOffset;
          }
        }
        vOffset += posAttr.count;
      }

      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      merged.setIndex(new THREE.BufferAttribute(indices, 1));
      merged.computeBoundingSphere();

      const batchMesh = new THREE.Mesh(merged, bucket.material);
      batchMesh.receiveShadow = true;
      batchMesh.castShadow = anyCastShadow;
      batchMesh.matrixAutoUpdate = false;
      batchMesh.updateMatrix();
      this.scene.add(batchMesh);
      this._batchedMeshes.push(batchMesh);
    }

    this._batchingOpen = false;
    this._batchEntries = null;
  }

  _rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  _addDecor(x, y, z, w, h, d, mat, rotY = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const tile = (mat && mat.userData && mat.userData.tile) || 2.0;
    this._applyWorldUVs(geo, w, h, d, tile);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (rotY) mesh.rotation.y = rotY;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    if (this._batchingOpen && this._batchEntries) {
      this._batchEntries.push({ geometry: geo, matrix: mesh.matrix.clone(), material: mat, castShadow: false, source: null });
    } else {
      this.scene.add(mesh);
    }
    return mesh;
  }

  _addPartition(x1, z1, x2, z2, baseY, h, gaps = []) {
    const alongX = Math.abs(z2 - z1) < Math.abs(x2 - x1);
    const t = 0.2;
    const mat = this._materials.interiorPlaster;
    const sorted = [...gaps].sort((a, b) => a.at - b.at);
    const lintelH = Math.max(0.35, h - 2.65);
    const lintelY = baseY + 2.65 + lintelH * 0.5;

    if (alongX) {
      const z = (z1 + z2) * 0.5;
      let cur = Math.min(x1, x2);
      const end = Math.max(x1, x2);
      for (const gap of sorted) {
        const gw = gap.w || 1.7;
        const gStart = Math.max(cur, gap.at - gw * 0.5);
        const gEnd = Math.min(end, gap.at + gw * 0.5);
        if (gStart - cur > 0.05) {
          this._addBox((cur + gStart) * 0.5, baseY + h * 0.5, z, gStart - cur, h, t, mat, true);
        }
        if (gEnd > gStart) {
          this._addBox((gStart + gEnd) * 0.5, lintelY, z, gEnd - gStart, lintelH, t, mat, true);
          if (gap.door) {
            this._addDoor((gStart + gEnd) * 0.5, baseY + 0.16, z, gEnd - gStart, 2.6, 0, gap.label || 'Door', gap.door);
          }
        }
        cur = Math.max(cur, gEnd);
      }
      if (end - cur > 0.05) {
        this._addBox((cur + end) * 0.5, baseY + h * 0.5, z, end - cur, h, t, mat, true);
      }
    } else {
      const x = (x1 + x2) * 0.5;
      let cur = Math.min(z1, z2);
      const end = Math.max(z1, z2);
      for (const gap of sorted) {
        const gw = gap.w || 1.7;
        const gStart = Math.max(cur, gap.at - gw * 0.5);
        const gEnd = Math.min(end, gap.at + gw * 0.5);
        if (gStart - cur > 0.05) {
          this._addBox(x, baseY + h * 0.5, (cur + gStart) * 0.5, t, h, gStart - cur, mat, true);
        }
        if (gEnd > gStart) {
          this._addBox(x, lintelY, (gStart + gEnd) * 0.5, t, lintelH, gEnd - gStart, mat, true);
          if (gap.door) {
            this._addDoor(x, baseY + 0.16, (gStart + gEnd) * 0.5, gEnd - gStart, 2.6, Math.PI / 2, gap.label || 'Door', gap.door);
          }
        }
        cur = Math.max(cur, gEnd);
      }
      if (end - cur > 0.05) {
        this._addBox(x, baseY + h * 0.5, (cur + end) * 0.5, t, h, end - cur, mat, true);
      }
    }
  }

  _decorateFacade(cx, cz, w, d, h, baseY, opts = {}) {
    const doorSide = opts.doorSide || 'south';
    const wallMat = opts.wallMat || this._materials.concrete;
    const seed = opts.seed !== undefined ? opts.seed : (((cx * 73856093) ^ (cz * 19349663)) >>> 0);
    const rng = this._rng(seed);
    const doorW = opts.doorW || 2.0;

    // 1. Exterior plinth band (0.9m tall, 0.08 proud on every exterior face; split around entrance door!)
    const plinthT = 0.08;
    const plinthY = baseY + 0.45;
    const outerX = w * 0.5 + 0.25 + plinthT * 0.5;
    const outerZ = d * 0.5 + 0.25 + plinthT * 0.5;
    const fullW = w + 0.5 + plinthT * 2;
    const fullD = d + 0.5 + plinthT * 2;
    const addHorizPlinth = (pz, hasDoorGap) => {
      if (!hasDoorGap) {
        this._addDecor(cx, plinthY, pz, fullW, 0.9, plinthT, this._materials.darkConcrete);
      } else {
        const segLen = (fullW - doorW - 0.1) * 0.5;
        if (segLen > 0.1) {
          this._addDecor(cx - (doorW * 0.5 + 0.05 + segLen * 0.5), plinthY, pz, segLen, 0.9, plinthT, this._materials.darkConcrete);
          this._addDecor(cx + (doorW * 0.5 + 0.05 + segLen * 0.5), plinthY, pz, segLen, 0.9, plinthT, this._materials.darkConcrete);
        }
      }
    };
    const addVertPlinth = (px, hasDoorGap) => {
      if (!hasDoorGap) {
        this._addDecor(px, plinthY, cz, plinthT, 0.9, fullD, this._materials.darkConcrete);
      } else {
        const segLen = (fullD - doorW - 0.1) * 0.5;
        if (segLen > 0.1) {
          this._addDecor(px, plinthY, cz - (doorW * 0.5 + 0.05 + segLen * 0.5), plinthT, 0.9, segLen, this._materials.darkConcrete);
          this._addDecor(px, plinthY, cz + (doorW * 0.5 + 0.05 + segLen * 0.5), plinthT, 0.9, segLen, this._materials.darkConcrete);
        }
      }
    };
    addHorizPlinth(cz - outerZ, doorSide === 'north' && !opts.skipDoorFrame);
    if (!(doorSide === 'south' && opts.skipDoorFrame)) {
      addHorizPlinth(cz + outerZ, doorSide === 'south');
    }
    addVertPlinth(cx - outerX, doorSide === 'west' && !opts.skipDoorFrame);
    addVertPlinth(cx + outerX, doorSide === 'east' && !opts.skipDoorFrame);

    // 2. Corner pilasters (0.6 x h x 0.6)
    const pilMat = (wallMat === this._materials.concrete) ? this._materials.darkConcrete : this._materials.bossDark;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this._addDecor(cx + sx * (w * 0.5), baseY + h * 0.5, cz + sz * (d * 0.5), 0.6, h, 0.6, pilMat);
      }
    }

    // 3. Cornice band (0.35m tall, 0.12 proud at top of exterior walls)
    const cornT = 0.12;
    const cornY = baseY + h - 0.175;
    const cornX = w * 0.5 + 0.25 + cornT * 0.5;
    const cornZ = d * 0.5 + 0.25 + cornT * 0.5;
    this._addDecor(cx, cornY, cz - cornZ, w + 0.5 + cornT * 2, 0.35, cornT, this._materials.concrete);
    this._addDecor(cx, cornY, cz + cornZ, w + 0.5 + cornT * 2, 0.35, cornT, this._materials.concrete);
    this._addDecor(cx - cornX, cornY, cz, cornT, 0.35, d + 0.5, this._materials.concrete);
    this._addDecor(cx + cornX, cornY, cz, cornT, 0.35, d + 0.5, this._materials.concrete);

    // 4. Rooftop Parapet (0.9m tall, 0.3m thick WITH colliders for roof cover + 0.08m cap)
    const roofTopY = baseY + h + (opts.roofOffset !== undefined ? opts.roofOffset : 0.30);
    const paraH = 0.9;
    const paraT = 0.3;
    this._addBox(cx, roofTopY + paraH * 0.5, cz - d * 0.5, w + 0.3, paraH, paraT, wallMat, true);
    this._addBox(cx, roofTopY + paraH * 0.5, cz + d * 0.5, w + 0.3, paraH, paraT, wallMat, true);
    this._addBox(cx - w * 0.5, roofTopY + paraH * 0.5, cz, paraT, paraH, Math.max(0.4, d - 0.3), wallMat, true);
    this._addBox(cx + w * 0.5, roofTopY + paraH * 0.5, cz, paraT, paraH, Math.max(0.4, d - 0.3), wallMat, true);

    const capY = roofTopY + paraH + 0.04;
    this._addDecor(cx, capY, cz - d * 0.5, w + 0.42, 0.08, 0.36, this._materials.darkConcrete);
    this._addDecor(cx, capY, cz + d * 0.5, w + 0.42, 0.08, 0.36, this._materials.darkConcrete);
    this._addDecor(cx - w * 0.5, capY, cz, 0.36, 0.08, Math.max(0.4, d - 0.3), this._materials.darkConcrete);
    this._addDecor(cx + w * 0.5, capY, cz, 0.36, 0.08, Math.max(0.4, d - 0.3), this._materials.darkConcrete);

    // 5. Seeded Rooftop Clutter (at least 1.2m inside parapet)
    const spanX = Math.max(0.8, w * 0.5 - 2.1);
    const spanZ = Math.max(0.8, d * 0.5 - 2.1);
    if (!this._acFanGeo) this._acFanGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 12);
    const acCount = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < acCount; i++) {
      const ax = cx + (rng() * 2 - 1) * spanX;
      const az = cz + (rng() * 2 - 1) * spanZ;
      this._addDecor(ax, roofTopY + 0.45, az, 1.4, 0.9, 1.0, this._materials.metal);
      const fan = new THREE.Mesh(this._acFanGeo, this._materials.windowFrame);
      fan.position.set(ax, roofTopY + 0.94, az);
      fan.updateMatrix();
      fan.matrixAutoUpdate = false;
      if (this._batchingOpen && this._batchEntries) {
        this._batchEntries.push({ geometry: this._acFanGeo, matrix: fan.matrix.clone(), material: this._materials.windowFrame, castShadow: false, source: null });
      } else {
        this.scene.add(fan);
      }
    }
    for (let i = 0; i < 2; i++) {
      const vx = cx + (rng() * 2 - 1) * spanX;
      const vz = cz + (rng() * 2 - 1) * spanZ;
      this._addDecor(vx, roofTopY + 0.4, vz, 0.2, 0.8, 0.2, this._materials.metal);
      this._addDecor(vx, roofTopY + 0.84, vz, 0.32, 0.1, 0.32, this._materials.darkConcrete);
    }
    const hx = cx + (rng() * 2 - 1) * spanX * 0.8;
    const hz = cz + (rng() * 2 - 1) * spanZ * 0.8;
    this._addDecor(hx, roofTopY + 0.2, hz, 1.0, 0.4, 1.0, this._materials.doorSteel);

    // 6. Entrance door frame + sloped awning + small wall lamp
    if (!this._lampMat) this._lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1c4 });
    const awW = doorW + 1.2;
    let dx = cx, dz = cz, awRot = 0, outX = 0, outZ = 0;
    if (doorSide === 'north') { dz = cz - d * 0.5; awRot = 0; outZ = -1; }
    else if (doorSide === 'south') { dz = cz + d * 0.5; awRot = 0; outZ = 1; }
    else if (doorSide === 'west') { dx = cx - w * 0.5; awRot = Math.PI / 2; outX = -1; }
    else if (doorSide === 'east') { dx = cx + w * 0.5; awRot = Math.PI / 2; outX = 1; }

    if (!opts.skipDoorFrame) {
      if (outZ !== 0) {
        this._addDecor(dx - (doorW * 0.5 + 0.075), baseY + 1.4, dz, 0.15, 2.8, 0.62, this._materials.windowFrame);
        this._addDecor(dx + (doorW * 0.5 + 0.075), baseY + 1.4, dz, 0.15, 2.8, 0.62, this._materials.windowFrame);
        this._addDecor(dx, baseY + 2.75, dz, doorW + 0.32, 0.18, 0.62, this._materials.windowFrame);
      } else {
        this._addDecor(dx, baseY + 1.4, dz - (doorW * 0.5 + 0.075), 0.62, 2.8, 0.15, this._materials.windowFrame);
        this._addDecor(dx, baseY + 1.4, dz + (doorW * 0.5 + 0.075), 0.62, 2.8, 0.15, this._materials.windowFrame);
        this._addDecor(dx, baseY + 2.75, dz, 0.62, 0.18, doorW + 0.32, this._materials.windowFrame);
      }
      // Sloped exterior awning
      const awMesh = this._addDecor(dx + outX * 0.85, baseY + 3.0, dz + outZ * 0.85, awW, 0.12, 1.4, this._materials.metal, awRot);
      if (outZ !== 0) awMesh.rotation.x = outZ * 0.16;
      else awMesh.rotation.x = -outX * 0.16;
      awMesh.updateMatrix();
    }
    // Exterior entrance wall lamp
    const lampY = opts.skipDoorFrame ? (baseY + h - 0.55) : (baseY + 3.35);
    this._addDecor(dx + outX * 0.42, lampY, dz + outZ * 0.42, 0.25, 0.25, 0.25, this._lampMat);

    // 7. Interior ceiling light panels (skip if skipLights; optionally ground floor only via lightH)
    if (!opts.skipLights) {
      if (!this._ceilLightMat) this._ceilLightMat = new THREE.MeshBasicMaterial({ color: 0xf4f1e6 });
      const lh = opts.lightH || h;
      const ly = baseY + lh - 0.05;
      const nx = Math.max(1, Math.round(w / 6));
      const nz = Math.max(1, Math.round(d / 6));
      for (let ix = 0; ix < nx; ix++) {
        for (let iz = 0; iz < nz; iz++) {
          const lx = cx - w * 0.5 + ((ix + 0.5) / nx) * w;
          const lz = cz - d * 0.5 + ((iz + 0.5) / nz) * d;
          if (opts.stairwellAvoidX !== undefined && lx >= opts.stairwellAvoidX) continue;
          this._addDecor(lx, ly, lz, 1.2, 0.06, 0.5, this._ceilLightMat);
        }
      }
    }
  }

  _createSignTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');

    if (type && typeof type === 'object') {
      ctx.fillStyle = type.bg || '#1c2329';
      ctx.fillRect(0, 0, 512, 192);
      ctx.strokeStyle = type.accent || '#f5a623';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, 496, 176);
      ctx.fillStyle = type.accent || '#f5a623';
      ctx.fillRect(16, 16, 480, 12);
      ctx.fillStyle = type.fg || '#f2f6f9';
      const titleStr = String(type.title || 'VOSTOK');
      const fontSz = titleStr.length > 15 ? 40 : (titleStr.length > 11 ? 48 : 56);
      ctx.font = `900 ${fontSz}px Consolas, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(titleStr, 256, 84);
      ctx.fillStyle = type.accent || '#69f0ae';
      ctx.font = '700 22px Consolas, Arial, sans-serif';
      ctx.fillText(String(type.sub || 'VOSTOK // SECTOR'), 256, 140);
      return new THREE.CanvasTexture(canvas);
    }

    if (type === 'clinic') {
      // Crisp white medical signboard with big GREEN MEDICAL PLUS INSIDE A CIRCLE
      ctx.fillStyle = '#f2f7f4';
      ctx.fillRect(0, 0, 512, 192);
      ctx.strokeStyle = '#1b8a4b';
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, 496, 176);

      ctx.beginPath();
      ctx.arc(106, 96, 62, 0, Math.PI * 2);
      ctx.fillStyle = '#e6f7ed';
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#1ca858';
      ctx.stroke();

      ctx.fillStyle = '#1ca858';
      ctx.fillRect(92, 54, 28, 84);
      ctx.fillRect(64, 82, 84, 28);

      ctx.fillStyle = '#134e2c';
      ctx.font = '900 58px Consolas, Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('CLINIC', 192, 82);
      ctx.fillStyle = '#1ca858';
      ctx.font = '700 26px Consolas, Arial, sans-serif';
      ctx.fillText('MEDICAL CENTER', 194, 132);
    } else if (type === 'police') {
      ctx.fillStyle = '#162b4a';
      ctx.fillRect(0, 0, 512, 192);
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, 496, 176);
      ctx.fillStyle = '#f5c542';
      ctx.beginPath();
      ctx.moveTo(92, 38); ctx.lineTo(138, 52); ctx.lineTo(130, 118);
      ctx.lineTo(92, 154); ctx.lineTo(54, 118); ctx.lineTo(46, 52);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#162b4a';
      ctx.font = '900 32px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', 92, 96);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 60px Consolas, Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('POLICE', 168, 82);
      ctx.fillStyle = '#64b5f6';
      ctx.font = '700 24px Consolas, Arial, sans-serif';
      ctx.fillText('PRECINCT // HOLDING', 170, 134);
    } else if (type === 'fire') {
      ctx.fillStyle = '#8e1b18';
      ctx.fillRect(0, 0, 512, 192);
      ctx.strokeStyle = '#f5f2eb';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, 496, 176);
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.arc(92, 96, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8e1b18';
      ctx.fillRect(80, 56, 24, 80);
      ctx.fillRect(52, 84, 80, 24);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 54px Consolas, Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('FIRE DEPT', 166, 82);
      ctx.fillStyle = '#ffd54f';
      ctx.font = '700 24px Consolas, Arial, sans-serif';
      ctx.fillText('STATION 07 // RESCUE', 168, 134);
    } else if (type === 'dam') {
      ctx.fillStyle = '#24292e';
      ctx.fillRect(0, 0, 512, 192);
      ctx.strokeStyle = '#4fc3f7';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, 496, 176);
      ctx.fillStyle = '#f5a623';
      ctx.fillRect(16, 16, 480, 14);
      ctx.fillStyle = '#eef4f7';
      ctx.font = '900 58px Consolas, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HYDRO DAM', 256, 84);
      ctx.fillStyle = '#4fc3f7';
      ctx.font = '700 24px Consolas, Arial, sans-serif';
      ctx.fillText('SECTOR 04 // TURBINE & SPILLWAY', 256, 138);
    } else {
      ctx.fillStyle = '#181a1d';
      ctx.fillRect(0, 0, 512, 192);
      ctx.fillStyle = '#f5a623';
      for (let sx = -192; sx < 560; sx += 44) {
        ctx.beginPath();
        ctx.moveTo(sx, 0); ctx.lineTo(sx + 20, 0); ctx.lineTo(sx - 10, 28); ctx.lineTo(sx - 30, 28);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sx, 164); ctx.lineTo(sx + 20, 164); ctx.lineTo(sx - 10, 192); ctx.lineTo(sx - 30, 192);
        ctx.fill();
      }
      ctx.fillStyle = '#f5a623';
      ctx.font = '900 52px Consolas, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('COMMAND HQ', 256, 82);
      ctx.fillStyle = '#ff5252';
      ctx.font = '800 24px Consolas, Arial, sans-serif';
      ctx.fillText('RESTRICTED // HIGH THREAT', 256, 130);
    }

    return new THREE.CanvasTexture(canvas);
  }

  _addSignBoard(x, y, z, w, h, rotY, type) {
    const tex = this._createSignTexture(type);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    this.scene.add(mesh);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.16), this._materials.windowFrame);
    back.position.set(x - Math.sin(rotY) * 0.1, y, z - Math.cos(rotY) * 0.1);
    back.rotation.y = rotY;
    back.updateMatrix();
    back.matrixAutoUpdate = false;
    this.scene.add(back);
  }

  _addWindow(x, y, z, w, h, rotY = 0) {
    if (!this._winGlassDouble) {
      this._winGlassDouble = this._materials.windowGlass.clone();
      this._winGlassDouble.side = THREE.DoubleSide;
    }
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.rotation.y = rotY;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), this._winGlassDouble);
    const glassInner = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), this._winGlassDouble);
    glassInner.position.z = -0.55;
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, 0.12, 0.16), this._materials.windowFrame);
    topBar.position.y = h / 2;
    const botBar = topBar.clone();
    botBar.position.y = -h / 2;
    const midBar = new THREE.Mesh(new THREE.BoxGeometry(0.09, h, 0.14), this._materials.windowFrame);
    const horizMullion = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.12), this._materials.windowFrame);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.1, 0.22), this._materials.darkConcrete);
    sill.position.y = -h / 2 - 0.08;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.16, 0.2), this._materials.concrete);
    lintel.position.y = h / 2 + 0.1;
    grp.add(glass, glassInner, topBar, botBar, midBar, horizMullion, sill, lintel);
    grp.updateMatrixWorld(true);
    grp.matrixAutoUpdate = false;
    if (this._batchingOpen && this._batchEntries) {
      for (const ch of grp.children) {
        this._batchEntries.push({ geometry: ch.geometry, matrix: ch.matrixWorld.clone(), material: ch.material, castShadow: false, source: null });
      }
    } else {
      this.scene.add(grp);
    }
  }

  _addDoor(cx, baseY, cz, width = 1.65, height = 2.6, rotY = 0, label = 'Door', style = 'wood') {
    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);
    const hingeX = cx - cosR * (width * 0.5);
    const hingeZ = cz + sinR * (width * 0.5);

    const pivot = new THREE.Group();
    pivot.position.set(hingeX, baseY, hingeZ);
    pivot.rotation.y = rotY;

    const leafMat = style === 'steel' ? this._materials.doorSteel : this._materials.doorWood;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(width - 0.06, height, 0.12), leafMat);
    leaf.position.set(width * 0.5, height * 0.5, 0);
    const hFront = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.24), this._materials.hazardAmber);
    hFront.position.set(width - 0.22, height * 0.45, 0);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(width * 0.44, 0.56, 0.14), this._materials.windowGlass);
    pane.position.set(width * 0.5, height * 0.72, 0);
    pivot.add(leaf, hFront, pane);
    this.scene.add(pivot);

    const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.12, height + 0.1, 0.24), this._materials.windowFrame);
    jambL.position.set(hingeX, baseY + height * 0.5, hingeZ);
    jambL.rotation.y = rotY;
    jambL.updateMatrix();
    jambL.matrixAutoUpdate = false;
    const jambR = new THREE.Mesh(new THREE.BoxGeometry(0.12, height + 0.1, 0.24), this._materials.windowFrame);
    jambR.position.set(cx + cosR * (width * 0.5), baseY + height * 0.5, cz - sinR * (width * 0.5));
    jambR.rotation.y = rotY;
    jambR.updateMatrix();
    jambR.matrixAutoUpdate = false;
    this.scene.add(jambL, jambR);

    const halfSpanX = Math.abs(cosR) * (width * 0.5) + Math.abs(sinR) * 0.28;
    const halfSpanZ = Math.abs(sinR) * (width * 0.5) + Math.abs(cosR) * 0.28;
    const doorObj = {
      id: `door_${this.doors.length}`,
      label,
      pivot,
      leaf,
      center: new THREE.Vector3(cx, baseY + height * 0.5, cz),
      hingePos: new THREE.Vector3(hingeX, baseY, hingeZ),
      jambRightPos: new THREE.Vector3(cx + cosR * (width * 0.5), baseY, cz - sinR * (width * 0.5)),
      baseRotY: rotY,
      normal: new THREE.Vector3(sinR, 0, cosR).normalize(),
      width,
      height,
      halfThick: 0.075,
      minAngle: -1.68,
      maxAngle: 1.68,
      angle: 0,
      targetAngle: 0,
      angVel: 0,
      freeSwing: false,
      state: 'closed',
      passable: false,
      bashCooldown: 0,
      bashSpeed: 6.5
    };

    const collider = {
      minX: cx - halfSpanX,
      maxX: cx + halfSpanX,
      minY: baseY,
      maxY: baseY + height,
      minZ: cz - halfSpanZ,
      maxZ: cz + halfSpanZ,
      isDoorThreshold: true,
      doorRef: doorObj
    };
    doorObj.collider = collider;
    this.colliders.push(collider);
    this.doors.push(doorObj);
    return doorObj;
  }

  interactDoor(door, playerPos, isPeek = false) {
    if (!door || !playerPos) return;
    if (door.state === 'open' || door.state === 'peek' || Math.abs(door.angle) > 0.16) {
      door.targetAngle = 0;
      door.state = 'closed';
      door.freeSwing = false;
      door.angVel = 0;
      door.bashSpeed = 6.8;
      if (window.soundEngine && window.soundEngine.playDoorClose) {
        try { window.soundEngine.playDoorClose(); } catch (e) {}
      }
      return;
    }
    const toPlayerX = playerPos.x - door.center.x;
    const toPlayerZ = playerPos.z - door.center.z;
    const dot = toPlayerX * door.normal.x + toPlayerZ * door.normal.z;
    const swingDir = dot >= 0 ? 1 : -1;
    door.freeSwing = false;
    door.angVel = 0;
    if (isPeek) {
      door.targetAngle = swingDir * 0.44;
      door.state = 'peek';
      door.bashSpeed = 5.8;
      if (window.soundEngine && window.soundEngine.playDoorOpen) {
        try { window.soundEngine.playDoorOpen(true); } catch (e) {}
      }
    } else {
      door.targetAngle = swingDir * 1.54;
      door.state = 'open';
      door.bashSpeed = 7.4;
      if (window.soundEngine && window.soundEngine.playDoorOpen) {
        try { window.soundEngine.playDoorOpen(false); } catch (e) {}
      }
    }
  }

  _collidesStaticOnly(x, z, r, minY, maxY) {
    const list = this.getNearbyColliders ? this.getNearbyColliders(x, z, r + 0.5) : this.colliders;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.doorRef) continue;
      if (maxY <= c.minY + 0.02 || minY >= c.maxY - 0.42) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  }

  // Test sphere/capsule against the live rotated 3D door leaf segment (open, swinging, peeked, or closed!)
  hitTestDoorLeaves(x, z, r = 0.08, minY = 0, maxY = 1.8) {
    if (!this.doors || this.doors.length === 0) return null;
    for (let i = 0; i < this.doors.length; i++) {
      const d = this.doors[i];
      const baseY = d.hingePos.y;
      if (maxY <= baseY + 0.02 || minY >= baseY + d.height - 0.02) continue;
      const hx = d.hingePos.x;
      const hz = d.hingePos.z;
      const reach = d.width + r + 0.25;
      if (Math.abs(x - hx) > reach || Math.abs(z - hz) > reach) continue;

      const theta = d.baseRotY + d.angle;
      const uX = Math.cos(theta);
      const uZ = -Math.sin(theta);
      const relX = x - hx;
      const relZ = z - hz;
      const proj = Math.max(0, Math.min(d.width, relX * uX + relZ * uZ));
      const qx = hx + uX * proj;
      const qz = hz + uZ * proj;
      const dx = x - qx;
      const dz = z - qz;
      const minDist = r + (d.halfThick || 0.075);
      if (dx * dx + dz * dz < minDist * minDist) {
        return d;
      }
    }
    return null;
  }

  // Resolve entity circle vs live physical door leaf + apply realistic rotational push impulse (including pushing peeked & open doors!)
  resolveDoorEntityCollision(pos, radius, feetY, headY, velX = 0, velZ = 0, opts = null) {
    if (!this.doors || this.doors.length === 0 || !pos) return false;
    let collidedAny = false;
    const isSprinting = !!(opts && opts.isSprinting);
    const isAI = !!(opts && opts.isAI);
    const weaponSystem = opts && opts.weaponSystem;
    const dt = Math.min(0.05, Math.max(0.004, (opts && opts.dt) || 0.016));

    for (let i = 0; i < this.doors.length; i++) {
      const d = this.doors[i];
      const baseY = d.hingePos.y;
      if (headY <= baseY + 0.05 || feetY >= baseY + d.height - 0.05) continue;
      const hx = d.hingePos.x;
      const hz = d.hingePos.z;
      const reach = d.width + radius + 0.3;
      if (Math.abs(pos.x - hx) > reach || Math.abs(pos.z - hz) > reach) continue;

      const theta = d.baseRotY + d.angle;
      const uX = Math.cos(theta);
      const uZ = -Math.sin(theta);
      // Unit tangent in direction of +d(angle)
      const tX = -Math.sin(theta);
      const tZ = -Math.cos(theta);

      const relX = pos.x - hx;
      const relZ = pos.z - hz;
      const rawProj = relX * uX + relZ * uZ;
      const proj = Math.max(0, Math.min(d.width, rawProj));
      const qx = hx + uX * proj;
      const qz = hz + uZ * proj;
      let dx = pos.x - qx;
      let dz = pos.z - qz;
      let dist = Math.hypot(dx, dz);
      const minDist = radius + (d.halfThick || 0.075);
      if (dist >= minDist) continue;

      collidedAny = true;
      let nx, nz;
      if (dist > 1e-4) {
        nx = dx / dist;
        nz = dz / dist;
      } else {
        const sideSign = (relX * tX + relZ * tZ) >= 0 ? 1 : -1;
        nx = tX * sideSign;
        nz = tZ * sideSign;
        dist = 0;
      }

      const overlap = minDist - dist;
      const lever = Math.max(0, Math.min(1, proj / Math.max(0.4, d.width)));
      // Push direction from entity onto door is (-nx, -nz); project onto +angle tangent (tX, tZ)
      const tauSign = (-nx) * tX + (-nz) * tZ;
      const intoSpeed = Math.max(0, -(velX * nx + velZ * nz));
      const isLatchedClosed = (d.state === 'closed' && !d.freeSwing && Math.abs(d.angle) < 0.05);

      if (!d.locked) {
        if (isSprinting && !isAI && d.bashCooldown <= 0 && Math.abs(tauSign) > 0.35 && lever > 0.16 && Math.abs(d.angle) < 1.35) {
          // Tactical sprint bash slams closed, peeked, or ajar doors violently open!
          const bashDir = tauSign >= 0 ? 1 : -1;
          d.freeSwing = true;
          d.state = 'open';
          d.angVel = bashDir * 11.5;
          d.bashCooldown = 0.65;
          if (window.soundEngine && window.soundEngine.playDoorBash) {
            try { window.soundEngine.playDoorBash(); } catch (e) {}
          }
          if (weaponSystem && weaponSystem.triggerDoorBash) {
            weaponSystem.triggerDoorBash();
          }
        } else if (isLatchedClosed && isAI) {
          this.interactDoor(d, pos, false);
        } else if (!isLatchedClosed && lever > 0.14 && Math.abs(tauSign) > 0.22) {
          // Unlatched door (peeked, swinging, or open): entity physically pushes & swings the door leaf!
          if (d.state === 'peek') {
            d.state = 'open';
          }
          d.freeSwing = true;
          const pushDrive = (intoSpeed * 3.1 + overlap * 26.0) * (0.35 + 0.85 * lever);
          d.angVel = THREE.MathUtils.clamp(d.angVel + tauSign * pushDrive * dt * 14.0, -12.0, 12.0);
        }
      }

      // Solid physical collision response: push entity cleanly out of the door leaf (unless blocked by a static wall behind)
      const candX = pos.x + nx * overlap;
      const candZ = pos.z + nz * overlap;
      if (!this._collidesStaticOnly(candX, candZ, radius * 0.92, feetY, headY)) {
        pos.x = candX;
        pos.z = candZ;
      } else if (!this._collidesStaticOnly(candX, pos.z, radius * 0.92, feetY, headY)) {
        pos.x = candX;
      } else if (!this._collidesStaticOnly(pos.x, candZ, radius * 0.92, feetY, headY)) {
        pos.z = candZ;
      }
    }
    return collidedAny;
  }

  // Reflect thrown grenades cleanly off the live angled door leaf (while letting grenades pass freely through open doorways!)
  bounceProjectileOffDoors(pos, vel, r = 0.08) {
    if (!this.doors || this.doors.length === 0 || !pos || !vel) return 0;
    for (let i = 0; i < this.doors.length; i++) {
      const d = this.doors[i];
      const baseY = d.hingePos.y;
      if (pos.y + r <= baseY || pos.y - r >= baseY + d.height) continue;
      const hx = d.hingePos.x;
      const hz = d.hingePos.z;
      const reach = d.width + r + 0.25;
      if (Math.abs(pos.x - hx) > reach || Math.abs(pos.z - hz) > reach) continue;

      const theta = d.baseRotY + d.angle;
      const uX = Math.cos(theta);
      const uZ = -Math.sin(theta);
      const tX = -Math.sin(theta);
      const tZ = -Math.cos(theta);

      const relX = pos.x - hx;
      const relZ = pos.z - hz;
      const proj = Math.max(0, Math.min(d.width, relX * uX + relZ * uZ));
      const qx = hx + uX * proj;
      const qz = hz + uZ * proj;
      const dx = pos.x - qx;
      const dz = pos.z - qz;
      const dist = Math.hypot(dx, dz);
      const minDist = r + (d.halfThick || 0.075);
      if (dist >= minDist) continue;

      let nx, nz;
      if (dist > 1e-4) {
        nx = dx / dist;
        nz = dz / dist;
      } else {
        const sideSign = (relX * tX + relZ * tZ) >= 0 ? 1 : -1;
        nx = tX * sideSign;
        nz = tZ * sideSign;
      }
      pos.x = qx + nx * (minDist + 0.006);
      pos.z = qz + nz * (minDist + 0.006);

      const vDotN = vel.x * nx + vel.z * nz;
      const impact = Math.abs(vDotN);
      if (vDotN < 0) {
        vel.x -= (1 + 0.45) * vDotN * nx;
        vel.z -= (1 + 0.45) * vDotN * nz;
        vel.x *= 0.88;
        vel.z *= 0.88;
        if (!d.locked && !(d.state === 'closed' && !d.freeSwing && Math.abs(d.angle) < 0.05)) {
          const tau = ((-nx) * tX + (-nz) * tZ) * (proj / Math.max(0.5, d.width));
          d.freeSwing = true;
          if (d.state === 'peek') d.state = 'open';
          d.angVel = THREE.MathUtils.clamp(d.angVel + tau * impact * 0.16, -10, 10);
        }
      }
      return Math.max(0.5, impact);
    }
    return 0;
  }

  applyExplosionToDoors(blastPos, radius = 6.5) {
    if (!this.doors || !blastPos) return;
    for (let i = 0; i < this.doors.length; i++) {
      const d = this.doors[i];
      if (d.locked) continue;
      if (Math.abs(blastPos.y - d.center.y) > 3.2) continue;
      const dx = d.center.x - blastPos.x;
      const dz = d.center.z - blastPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= radius || dist < 1e-3) continue;
      const theta = d.baseRotY + d.angle;
      const tX = -Math.sin(theta);
      const tZ = -Math.cos(theta);
      const pushTau = (dx / dist) * tX + (dz / dist) * tZ;
      const falloff = 1 - dist / radius;
      d.freeSwing = true;
      d.state = 'open';
      d.angVel = THREE.MathUtils.clamp(d.angVel + (pushTau >= 0 ? 1 : -1) * (6.5 + 8.5 * falloff), -14, 14);
    }
  }

  updateDoors(dt, player, weaponSystem) {
    if (!this.doors || this.doors.length === 0) return;
    const stepDt = Math.min(0.05, Math.max(0.001, dt || 0.016));

    for (let i = 0; i < this.doors.length; i++) {
      const d = this.doors[i];
      if (d.bashCooldown > 0) d.bashCooldown = Math.max(0, d.bashCooldown - stepDt);

      if (d.freeSwing) {
        // Real inertial door physics: angular velocity + hinge friction damping + wall-stop rebound
        d.angle += d.angVel * stepDt;
        d.angVel *= Math.exp(-4.8 * stepDt);

        if (d.angle > d.maxAngle) {
          d.angle = d.maxAngle;
          d.angVel = -Math.abs(d.angVel) * 0.18;
        } else if (d.angle < d.minAngle) {
          d.angle = d.minAngle;
          d.angVel = Math.abs(d.angVel) * 0.18;
        }

        // Soft latch detent if pushed gently all the way back into the closed frame
        if (Math.abs(d.angle) < 0.035 && Math.abs(d.angVel) < 0.35) {
          d.angle = 0;
          d.angVel = 0;
          d.targetAngle = 0;
          d.freeSwing = false;
          d.state = 'closed';
        } else if (Math.abs(d.angVel) < 0.015) {
          d.angVel = 0;
        }
      } else if (Math.abs(d.angle - d.targetAngle) > 0.002) {
        d.angle = THREE.MathUtils.lerp(d.angle, d.targetAngle, Math.min(1, stepDt * d.bashSpeed));
      } else {
        d.angle = d.targetAngle;
      }

      d.pivot.rotation.y = d.baseRotY + d.angle;
      d.passable = Math.abs(d.angle) > 0.68;
    }
  }

  _addBuilding(cx, cz, w, d, h = 4.5, doorSide = 'south', wallMatOverride = null, layout = null) {
    const t = 0.5;
    const doorW = 2.0;
    const baseY = this.getTerrainHeight(cx, cz);
    const wMat = wallMatOverride || this._materials.concrete;

    this._addBox(cx, baseY - 0.5, cz, w + 0.6, 1.0, d + 0.6, this._materials.darkConcrete, false);
    this._addBox(cx, baseY + 0.08, cz, w, 0.16, d, this._materials.floorTile, false);
    this._addBox(cx, baseY + h + 0.15, cz, w + 0.4, 0.3, d + 0.4, this._materials.roofTar, true);

    const buildWallWithDoor = (wx, wz, length, isHorizontal, rotY) => {
      const sideLen = (length - doorW) / 2;
      const lintelH = Math.max(0.35, h - 2.65);
      const lintelY = baseY + 2.65 + lintelH * 0.5;
      if (isHorizontal) {
        this._addBox(wx - (doorW / 2 + sideLen / 2), baseY + h / 2, wz, sideLen, h, t, wMat);
        this._addBox(wx + (doorW / 2 + sideLen / 2), baseY + h / 2, wz, sideLen, h, t, wMat);
        this._addBox(wx, lintelY, wz, doorW, lintelH, t, wMat);
      } else {
        this._addBox(wx, baseY + h / 2, wz - (doorW / 2 + sideLen / 2), t, h, sideLen, wMat);
        this._addBox(wx, baseY + h / 2, wz + (doorW / 2 + sideLen / 2), t, h, sideLen, wMat);
        this._addBox(wx, lintelY, wz, t, lintelH, doorW, wMat);
      }
      this._addDoor(wx, baseY + 0.16, wz, doorW, 2.62, rotY, 'Entrance Door', 'steel');
    };

    if (doorSide === 'north') buildWallWithDoor(cx, cz - d / 2, w, true, 0);
    else {
      this._addBox(cx, baseY + h / 2, cz - d / 2, w, h, t, wMat);
      this._addWindow(cx - w * 0.24, baseY + h * 0.54, cz - d / 2 - 0.24, 2.2, 1.35, Math.PI);
      this._addWindow(cx + w * 0.24, baseY + h * 0.54, cz - d / 2 - 0.24, 2.2, 1.35, Math.PI);
    }

    if (doorSide === 'south') buildWallWithDoor(cx, cz + d / 2, w, true, 0);
    else {
      this._addBox(cx, baseY + h / 2, cz + d / 2, w, h, t, wMat);
      this._addWindow(cx - w * 0.24, baseY + h * 0.54, cz + d / 2 + 0.24, 2.2, 1.35, 0);
      this._addWindow(cx + w * 0.24, baseY + h * 0.54, cz + d / 2 + 0.24, 2.2, 1.35, 0);
    }

    if (doorSide === 'west') buildWallWithDoor(cx - w / 2, cz, d, false, Math.PI / 2);
    else {
      this._addBox(cx - w / 2, baseY + h / 2, cz, t, h, d, wMat);
      this._addWindow(cx - w / 2 - 0.24, baseY + h * 0.54, cz - d * 0.22, 2.1, 1.35, -Math.PI / 2);
      this._addWindow(cx - w / 2 - 0.24, baseY + h * 0.54, cz + d * 0.22, 2.1, 1.35, -Math.PI / 2);
    }

    if (doorSide === 'east') buildWallWithDoor(cx + w / 2, cz, d, false, Math.PI / 2);
    else {
      this._addBox(cx + w / 2, baseY + h / 2, cz, t, h, d, wMat);
      this._addWindow(cx + w / 2 + 0.24, baseY + h * 0.54, cz - d * 0.22, 2.1, 1.35, Math.PI / 2);
      this._addWindow(cx + w / 2 + 0.24, baseY + h * 0.54, cz + d * 0.22, 2.1, 1.35, Math.PI / 2);
    }

    if (typeof layout === 'function') {
      layout(baseY, h);
    }
    this._decorateFacade(cx, cz, w, d, h, baseY, { doorSide, wallMat: wMat });
  }

  _addContainer(x, z, rotY = 0, mat = this._materials.rustRed) {
    const w = rotY === 0 ? 2.6 : 6.5;
    const d = rotY === 0 ? 6.5 : 2.6;
    const baseY = this.getTerrainHeight(x, z);
    this._addBox(x, baseY + 1.4, z, w, 2.8, d, mat);
  }

  _addBarrier(x, z, horizontal = true) {
    const baseY = this.getTerrainHeight(x, z);
    if (horizontal) {
      this._addBox(x, baseY + 0.65, z, 3.6, 1.3, 0.7, this._materials.concrete);
    } else {
      this._addBox(x, baseY + 0.65, z, 0.7, 1.3, 3.6, this._materials.concrete);
    }
  }

  _addDeadTree(x, z) {
    const baseY = this.getTerrainHeight(x, z);
    this._addBox(x, baseY + 2.0, z, 0.45, 4.0, 0.45, this._materials.wood);
    this._addBox(x + 0.6, baseY + 3.4, z, 1.4, 0.22, 0.22, this._materials.wood, false);
    this._addBox(x - 0.5, baseY + 2.9, z + 0.4, 0.2, 0.2, 1.2, this._materials.wood, false);
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
          if (def && def.type === 'weapon' && GAME_DATA.rollRandomAttachmentsForRarity) {
            const rolled = GAME_DATA.rollRandomAttachmentsForRarity(entry.id, def.rarity);
            items.push({ id: entry.id, qty: 1, mods: rolled.mods, rarityOverride: rolled.rarity, revealed: false });
          } else {
            items.push({ id: entry.id, qty, revealed: false });
          }
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
    const rolledBossWpn = GAME_DATA.rollRandomAttachmentsForRarity
      ? GAME_DATA.rollRandomAttachmentsForRarity(wId, isUltra ? 'ultra' : 'legendary')
      : { mods: {}, rarity: isUltra ? 'ultra' : 'legendary' };
    items.push({ id: wId, qty: 1, mods: rolledBossWpn.mods, rarityOverride: rolledBossWpn.rarity, revealed: false });

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

  // === ZAVOD-9 SURFACE COMPLEX (NW alpine corner): brutalist block + service-elevator infil ===
  _addSovietBrutalistBlock(cx, cz, w = 46, d = 18, floors = 6) {
    const baseY = this.getTerrainHeight(cx, cz);
    const g = new THREE.Group();
    const concrete = this._materials.concrete;
    const dark = this._materials.darkConcrete;
    const floorH = 3.4;
    const totalH = floors * floorH;
    // Main stepped slab mass (upper floors step back into the mountainside)
    for (let f = 0; f < floors; f++) {
      const stepBack = f * 1.1;
      const fw = w - stepBack * 1.4;
      const sw = new THREE.Mesh(new THREE.BoxGeometry(fw, floorH - 0.5, d - f * 0.5), f % 2 ? dark : concrete);
      sw.position.set(-stepBack * 0.5, baseY + floorH * (f + 0.5), -f * 0.4);
      g.add(sw);
      // Ribbon window band
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(fw - 3, 1.1, 0.18),
        new THREE.MeshPhongMaterial({ color: 0x1d2c36, shininess: 90 })
      );
      band.position.set(-stepBack * 0.5, baseY + floorH * (f + 0.5) + 0.4, d / 2 - f * 0.25 + 0.02);
      g.add(band);
      // Pilotis fins on ground floor
      if (f === 0) {
        for (let px = -fw / 2 + 2; px < fw / 2 - 1; px += 5.5) {
          const fin = new THREE.Mesh(new THREE.BoxGeometry(1.1, floorH, d * 0.9), dark);
          fin.position.set(px, baseY + floorH * 0.5, -1);
          g.add(fin);
        }
      }
    }
    // Rooftop parapet + red star marker slab
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 1.2, 3), dark);
    cap.position.set(-w * 0.18, baseY + totalH + 0.6, -2);
    g.add(cap);
    this.scene.add(g);
    this._addBox(cx, baseY + totalH * 0.5, cz, w, totalH, d, concrete, true);
    return { group: g, baseY, totalH };
  }

  _addServiceElevator(ex, ez) {
    const baseY = this.getTerrainHeight(ex, ez);
    const conc = this._materials.concrete;
    const dark = this._materials.darkConcrete;
    const steel = this._materials.metal;
    // Walk-in concrete shaft house (8 x 8 m) with an open south doorway into the freight cab
    const H = 20, W = 8, T = 0.6;
    this._addBox(ex, baseY + H / 2, ez - W / 2, W, H, T, conc, true);                 // north
    this._addBox(ex - W / 2, baseY + H / 2, ez, T, H, W, conc, true);                 // west
    this._addBox(ex + W / 2, baseY + H / 2, ez, T, H, W, conc, true);                 // east
    this._addBox(ex - 2.6, baseY + H / 2, ez + W / 2, 2.8, H, T, conc, true);         // south (left of door)
    this._addBox(ex + 2.6, baseY + H / 2, ez + W / 2, 2.8, H, T, conc, true);         // south (right of door)
    this._addBox(ex, baseY + 4.2 + (H - 4.2) / 2, ez + W / 2, 2.4, H - 4.2, T, conc, true); // lintel
    this._addBox(ex, baseY + H + 0.5, ez, W + 1.6, 1.0, W + 1.6, dark, true);         // cap slab
    this._addBox(ex, baseY + 4.6, ez, W - T, 0.3, W - T, dark, false);                // cab ceiling
    this._addBox(ex, baseY + 0.08, ez, W - T, 0.16, W - T, steel, true);              // cab floor plate
    const g = new THREE.Group();
    const doorGlow = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.18, 0.2), new THREE.MeshBasicMaterial({ color: 0xffc107 }));
    doorGlow.position.set(ex, baseY + 4.35, ez + W / 2 + 0.32);
    const chev = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.7, 0.15), new THREE.MeshBasicMaterial({ color: 0xff3d3d }));
    chev.position.set(ex, baseY + 5.6, ez + W / 2 + 0.36);
    const cabLight = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.4), new THREE.MeshBasicMaterial({ color: 0xfff1cf }));
    cabLight.position.set(ex, baseY + 4.42, ez);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.2), new THREE.MeshBasicMaterial({ color: 0x2aa36a }));
    panel.position.set(ex + W / 2 - 0.45, baseY + 1.5, ez + 1.6);
    panel.rotation.y = -Math.PI / 2;
    g.add(doorGlow, chev, cabLight, panel);
    this.scene.add(g);
    if (this._addSignBoard) {
      try { this._addSignBoard(ex, baseY + 7.2, ez + W / 2 + 0.42, 5.2, 1.9, 0, { title: 'ЗАВОД-9 ЛИФТ', sub: 'SERVICE ELEVATOR // ZAVOD-9 COMPLEX', accent: '#ffca28', bg: '#16191b' }); } catch (e) {}
    }
    const entry = {
      id: 'zavod9_elevator',
      kind: 'bunker_elevator',
      name: 'ZAVOD-9 SERVICE ELEVATOR',
      mesh: g,
      glowMesh: doorGlow,
      // Interaction & transfer volume = inside the freight cab
      position: new THREE.Vector3(ex, baseY + 1.7, ez),
      cabRadius: 3.6,
      shaftBaseY: baseY
    };
    this.bunkerElevators = this.bunkerElevators || [];
    this.bunkerElevators.push(entry);
    return entry;
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
    } else if (kind === 'office') {
      mat = this._materials.metal;
      name = customName || 'Office Filing Cabinet';
      w = 0.72; h = 1.15; d = 0.62;
      items = this._rollLoot('office', 3);
    } else if (kind === 'household') {
      mat = this._materials.wood;
      name = customName || 'Household Cabinet';
      w = 1.05; h = 0.78; d = 0.65;
      items = this._rollLoot('household', 3);
    } else if (kind === 'valuables') {
      mat = this._materials.bossDark;
      name = customName || 'Security Safe';
      w = 0.82; h = 0.86; d = 0.72;
      items = this._rollLoot('valuables', 2 + this.zone.lootTierBonus);
    } else {
      items = this._rollLoot('supply', count);
    }

    const baseY = this.getTerrainHeight(x, z) + y;
    const recessMat = this._materials.darkTrim || (this._materials.darkTrim = new THREE.MeshLambertMaterial({ color: 0x131614 }));
    let mesh;
    let lid = null;

    if (kind === 'hospital' || kind === 'police_fire' || kind === 'office' || kind === 'valuables') {
      // Wall/medical cabinet with recessed interior & hinged front door
      mesh = this._addBox(x, baseY + h / 2, z - 0.02, w, h, Math.max(0.2, d - 0.04), mat, true);
      const back = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, h * 0.80, 0.02), recessMat);
      back.position.set(x, baseY + h / 2, z + d / 2 - 0.035);
      this.scene.add(back);

      const lidPivot = new THREE.Group();
      lidPivot.position.set(x - w * 0.48, baseY + h * 0.5, z + d / 2 - 0.01);
      const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, h * 0.88, 0.04), mat);
      doorMesh.position.set(w * 0.48, 0, 0);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.03), recessMat);
      handle.position.set(w * 0.88, 0, 0.025);
      lidPivot.add(doorMesh, handle);
      this.scene.add(lidPivot);
      lid = { pivot: lidPivot, axis: 'y', angle: 0, target: 0, openAngle: -1.35, opened: false };
    } else {
      // Top-opening crate / case / vault with statically batched lower body & hinged lid
      const bodyH = h * 0.86;
      const lidH = h * 0.14;
      mesh = this._addBox(x, baseY + bodyH / 2, z, w, bodyH, d, mat, true);
      const recess = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.02, d * 0.86), recessMat);
      recess.position.set(x, baseY + bodyH + 0.005, z);
      this.scene.add(recess);

      const lidPivot = new THREE.Group();
      lidPivot.position.set(x, baseY + bodyH, z - d / 2);
      const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, lidH, d + 0.02), mat);
      lidMesh.position.set(0, lidH * 0.5, d / 2);
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.03), recessMat);
      latch.position.set(0, lidH * 0.25, d + 0.015);
      lidPivot.add(lidMesh, latch);
      this.scene.add(lidPivot);
      lid = { pivot: lidPivot, axis: 'x', angle: 0, target: 0, openAngle: -1.25, opened: false };

      if (window.ModelSystem && window.ModelSystem.loadGLTFProp && (kind === 'supply' || kind === 'military')) {
        const refMesh = mesh;
        const refRecess = recess;
        const refLid = lidPivot;
        window.ModelSystem.loadGLTFProp('wooden_military_crate').then((proto) => {
          if (!proto || !this.scene) return;
          const clone = proto.clone(true);
          clone.userData.staticProp = true;
          const rawH = Math.max(0.05, (proto.userData._rawSize && proto.userData._rawSize.y) || 0.6);
          const sc = (h * 1.05) / rawH;
          clone.scale.setScalar(sc);
          clone.position.set(x, baseY, z);
          this.scene.add(clone);
          if (refMesh) refMesh.visible = false;
          if (refRecess) refRecess.visible = false;
          if (refLid) refLid.visible = false;
        });
      }
    }

    if (window.ModelSystem && window.ModelSystem.attachRealProp && kind === 'boss_key_room') {
      this.registerLightSource(new THREE.Vector3(x, baseY + h + 0.45, z), {
        intensity: 0.48, maxDist: 45, flareScale: 0.45, anamorphic: false, ghosts: false
      });
    }

    this.lootContainers.push({
      id: 'crate_' + this.lootContainers.length,
      name,
      kind,
      mesh,
      lid,
      position: new THREE.Vector3(x, baseY + h / 2, z),
      items,
      requiresKey: requiresKey || null,
      unlocked: !requiresKey,
      searched: false
    });
  }

  _addExtractZone(name, x, z, radius = 6.0) {
    const baseY = this.getTerrainHeight(x, z);
    const ringGeo = new THREE.RingGeometry(radius - 0.35, radius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x55ff88,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(x, baseY + 0.08, z);
    this.scene.add(ringMesh);

    const beamGeo = new THREE.CylinderGeometry(0.55, 1.1, 46, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x44ff77,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide
    });
    const beaconMesh = new THREE.Mesh(beamGeo, beamMat);
    beaconMesh.position.set(x, baseY + 23, z);
    this.scene.add(beaconMesh);

    this.extractZones.push({
      name,
      position: new THREE.Vector3(x, baseY, z),
      radius,
      ringMesh,
      beaconMesh
    });
    this.registerLightSource(new THREE.Vector3(x, baseY + 4.8, z), {
      intensity: 0.72, maxDist: 175, flareScale: 0.72, anamorphic: true, ghosts: false
    });
  }

  _buildMapLayout() {
    // Organic Sector Perimeter — Visual 3D Red Zone hazard warning beacons tracing MAP_BOUNDARY!
    const postMat = new THREE.MeshLambertMaterial({ color: 0x2a2c2e });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xff3d3d });
    if (this.MAP_BOUNDARY && this.MAP_BOUNDARY.length >= 3) {
      let distAcc = 0;
      const poly = this.MAP_BOUNDARY;
      for (let i = 0; i < poly.length; i++) {
        const [ax, az] = poly[i];
        const [bx, bz] = poly[(i + 1) % poly.length];
        const segLen = Math.hypot(bx - ax, bz - az) || 1;
        while (distAcc < segLen) {
          const t = distAcc / segLen;
          const px = ax + (bx - ax) * t;
          const pz = az + (bz - az) * t;
          const py = this.getTerrainHeight(px, pz);
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), postMat);
          post.position.set(px, py + 1.6, pz);
          const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), bulbMat);
          bulb.position.set(px, py + 3.4, pz);
          this.scene.add(post, bulb);
          distAcc += 78;
        }
        distAcc -= segLen;
      }
    }

    // Helper: Walkable staircase (stepH <= 0.30m so player._getSupportHeightAt walks smoothly up!)
    const addStaircase = (startX, baseY, startZ, steps, stepW, totalH, totalRun, dir = 'north') => {
      const stepH = totalH / steps;
      const stepD = totalRun / steps;
      for (let i = 0; i < steps; i++) {
        const curH = stepH * (i + 1);
        const offset = stepD * (i + 0.5);
        let sx = startX, sz = startZ, sw = stepW, sd = stepD + 0.08;
        if (dir === 'north') sz = startZ - offset;
        else if (dir === 'south') sz = startZ + offset;
        else if (dir === 'east') { sx = startX + offset; sw = stepD + 0.08; sd = stepW; }
        else if (dir === 'west') { sx = startX - offset; sw = stepD + 0.08; sd = stepW; }
        this._addBox(sx, baseY + curH * 0.5, sz, sw, curH, sd, this._materials.metal, true);
      }
      // Register staircase portal for 2.5D multi-floor AI pathfinding!
      const dxDir = dir === 'east' ? 1 : (dir === 'west' ? -1 : 0);
      const dzDir = dir === 'south' ? 1 : (dir === 'north' ? -1 : 0);
      this.staircases.push({
        bottomEntry: new THREE.Vector3(startX - dxDir * 1.1, baseY, startZ - dzDir * 1.1),
        topExit: new THREE.Vector3(startX + dxDir * (totalRun + 1.1), baseY + totalH, startZ + dzDir * (totalRun + 1.1)),
        bottomY: baseY,
        topY: baseY + totalH
      });
    };

    // Helper: Hospital Bed prop (steel frame + white mattress + pillow)
    const addHospitalBed = (bx, by, bz, rotY = 0) => {
      const horiz = Math.abs(Math.sin(rotY)) > 0.5;
      const w = horiz ? 2.1 : 1.05;
      const d = horiz ? 1.05 : 2.1;
      this._addBox(bx, by + 0.32, bz, w, 0.32, d, this._materials.metal, true);
      this._addBox(bx, by + 0.56, bz, w - 0.08, 0.18, d - 0.08, this._materials.crateMed, false);
      const px = horiz ? bx - 0.65 : bx;
      const pz = horiz ? bz : bz - 0.65;
      this._addBox(px, by + 0.70, pz, horiz ? 0.42 : 0.72, 0.12, horiz ? 0.72 : 0.42, this._materials.crateMed, false);
    };

    // Helper: Office / Detective Desk + Monitor prop
    const addDeskProp = (dx, by, dz) => {
      this._addBox(dx, by + 0.42, dz, 1.8, 0.82, 0.9, this._materials.wood, true);
      this._addBox(dx - 0.35, by + 1.05, dz - 0.2, 0.55, 0.38, 0.08, this._materials.metal, false);
    };

    // Helper: Military Canvas Tent with pitched roof & open front/back for lockers & crates
    const addMilitaryTent = (tx, by, tz, w = 8.5, d = 6.2) => {
      const h = 3.2;
      for (const sx of [-w / 2 + 0.2, w / 2 - 0.2]) {
        for (const sz of [-d / 2 + 0.2, d / 2 - 0.2]) {
          this._addBox(tx + sx, by + h * 0.42, tz + sz, 0.16, h * 0.84, 0.16, this._materials.metal, false);
        }
      }
      this._addBox(tx - w / 2, by + h * 0.38, tz, 0.14, h * 0.76, d, this._materials.rustOlive, true);
      this._addBox(tx + w / 2, by + h * 0.38, tz, 0.14, h * 0.76, d, this._materials.rustOlive, true);
      this._addBox(tx - w * 0.25, by + h * 0.85, tz, w * 0.56, 0.14, d + 0.3, this._materials.rustOlive, false);
      this._addBox(tx + w * 0.25, by + h * 0.85, tz, w * 0.56, 0.14, d + 0.3, this._materials.rustOlive, false);
      this._addBox(tx, by + h * 0.98, tz, w * 0.42, 0.18, d + 0.3, this._materials.crateMil, false);
    };

    // === VOSTOK BATTLEFIELD ATMOSPHERE HELPERS (Smoke Plumes, Wrecks, Downed Helis, Casualties, Compounds & Strip-Towns) ===
    const smokeTex = (() => {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 128;
      const cx2 = c.getContext('2d');
      const grd = cx2.createRadialGradient(64, 64, 6, 64, 64, 60);
      grd.addColorStop(0, 'rgba(32, 35, 38, 0.64)');
      grd.addColorStop(0.55, 'rgba(46, 50, 54, 0.30)');
      grd.addColorStop(1, 'rgba(58, 62, 66, 0.0)');
      cx2.fillStyle = grd;
      cx2.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();

    const addSmokePlume = (sx, baseY, sz, heightScale = 1.0) => {
      const puffs = [];
      for (let p = 0; p < 6; p++) {
        const mat = new THREE.SpriteMaterial({
          map: smokeTex,
          transparent: true,
          depthWrite: false,
          opacity: 0.48
        });
        const sp = new THREE.Sprite(mat);
        const sz0 = (5.5 + p * 2.8) * heightScale;
        sp.scale.set(sz0, sz0, 1);
        sp.position.set(sx, baseY + 2.0 + p * 6.5 * heightScale, sz);
        this.scene.add(sp);
        puffs.push({ sprite: sp, phase: p / 6, baseScale: sz0 });
      }
      const ember = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.25, 1.4),
        new THREE.MeshBasicMaterial({ color: 0xff5722 })
      );
      ember.position.set(sx, baseY + 0.14, sz);
      this.scene.add(ember);
      this.registerLightSource(new THREE.Vector3(sx, baseY + 0.85, sz), {
        intensity: 0.56, maxDist: 95, flareScale: 0.52, anamorphic: false, ghosts: true
      });
      this.smokePlumes.push({ x: sx, y: baseY, z: sz, scale: heightScale, puffs });
    };

    const addFloodlight = (fx, fz, rotY = 0, height = 10.5, bulbColor = 0xfff0cc) => {
      const fy = this.getTerrainHeight(fx, fz);
      if (window.ModelSystem && window.ModelSystem.createFloodlightTower) {
        const tower = window.ModelSystem.createFloodlightTower(height, bulbColor, true);
        tower.position.set(fx, fy, fz);
        tower.rotation.y = rotY;
        this.scene.add(tower);
      } else {
        this._addBox(fx, fy + height * 0.5, fz, 0.35, height, 0.35, this._materials.metal, false);
      }
      this.registerLightSource(new THREE.Vector3(fx, fy + height + 0.2, fz), {
        intensity: 0.92, maxDist: 210, flareScale: 0.85, anamorphic: true, ghosts: true
      });
    };

    const addPitchedRoof = (cx, topY, cz, w, d, ridgeH = 1.65, mat = this._materials.rustRed, alongZ = true) => {
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const frac = (i + 0.5) / steps;
        const yOff = topY + frac * ridgeH;
        const spanW = alongZ ? w * (1 - i * 0.22) : w;
        const spanD = alongZ ? d : d * (1 - i * 0.22);
        this._addBox(cx, yOff, cz, spanW, ridgeH / steps + 0.12, spanD, mat, false);
      }
    };

    const addArchedRoof = (cx, topY, cz, w, d, archH = 2.4, mat = this._materials.rustBlue) => {
      const segs = 5;
      for (let i = 0; i < segs; i++) {
        const frac = i / (segs - 1);
        const theta = frac * Math.PI * 0.45;
        const yOff = topY + Math.sin(frac * Math.PI * 0.5) * archH;
        const spanW = Math.max(2.0, w * Math.cos(theta));
        this._addBox(cx, yOff, cz, spanW, 0.42, d, mat, i === segs - 1);
      }
    };

    const addRockOutcrop = (rx, rz, scale = 1.0, seed = 1) => {
      const ry = this.getTerrainHeight(rx, rz);
      const blocks = [
        [0, 0, 3.8 * scale, 2.4 * scale, 3.2 * scale],
        [2.2 * scale, 1.0 * scale, 2.6 * scale, 1.7 * scale, 2.5 * scale],
        [-2.0 * scale, -0.8 * scale, 2.4 * scale, 1.9 * scale, 2.2 * scale]
      ];
      blocks.forEach(([ox, oz, bw, bh, bd], idx) => {
        const by = this.getTerrainHeight(rx + ox, rz + oz);
        this._addBox(rx + ox, by + bh * 0.44, rz + oz, bw, bh, bd, (idx % 2 === 0) ? this._materials.darkConcrete : this._materials.bossDark, true);
      });
    };

    const addTransmissionPylon = (px, pz) => {
      const py = this.getTerrainHeight(px, pz);
      for (const sx of [-2.4, 2.4]) {
        for (const sz of [-2.4, 2.4]) {
          this._addBox(px + sx, py + 7.5, pz + sz, 0.45, 15.0, 0.45, this._materials.metal, true);
        }
      }
      this._addBox(px, py + 15.0, pz, 2.2, 7.0, 2.2, this._materials.metal, false);
      this._addBox(px, py + 16.5, pz, 9.6, 0.55, 1.2, this._materials.darkConcrete, false);
      this._addBox(px, py + 13.8, pz, 8.0, 0.45, 1.1, this._materials.darkConcrete, false);
    };

    const addRoadCheckpoint = (cx, cz, horiz = true) => {
      const cy = this.getTerrainHeight(cx, cz);
      const off = 5.8;
      if (horiz) {
        this._addBox(cx - 3.5, cy + 0.65, cz - off, 3.8, 1.3, 0.75, this._materials.concrete, true);
        this._addBox(cx + 3.5, cy + 0.65, cz + off, 3.8, 1.3, 0.75, this._materials.concrete, true);
        this._addBox(cx + 6.4, cy + 1.5, cz - off - 1.4, 2.8, 3.0, 2.8, this._materials.rustOlive, true);
      } else {
        this._addBox(cx - off, cy + 0.65, cz - 3.5, 0.75, 1.3, 3.8, this._materials.concrete, true);
        this._addBox(cx + off, cy + 0.65, cz + 3.5, 0.75, 1.3, 3.8, this._materials.concrete, true);
        this._addBox(cx - off - 1.4, cy + 1.5, cz + 6.4, 2.8, 3.0, 2.8, this._materials.rustOlive, true);
      }
      this._addLootContainer(cx + (horiz ? 6.2 : -off - 1.2), 0.05, cz + (horiz ? -off - 3.2 : 8.5), 'supply', 'Checkpoint Supply Cache');
    };

    const addWreckedVehicle = (vx, vz, rotY = 0, isAPC = false, smoking = false) => {
      const vy = this.getTerrainHeight(vx, vz);
      let g;
      if (window.ModelSystem && window.ModelSystem.createVehicleWreck) {
        g = window.ModelSystem.createVehicleWreck(isAPC, this._materials);
      } else {
        g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(isAPC ? 2.7 : 1.95, 1.4, isAPC ? 6.4 : 4.2), this._materials.rustOlive);
        body.position.y = 0.8;
        g.add(body);
      }
      g.position.set(vx, vy, vz);
      g.rotation.y = rotY;
      this.scene.add(g);
      if (isAPC) {
        this.colliders.push({ minX: vx - 2.6, maxX: vx + 2.6, minY: vy, maxY: vy + 2.3, minZ: vz - 3.1, maxZ: vz + 3.1 });
      } else {
        this.colliders.push({ minX: vx - 1.8, maxX: vx + 1.8, minY: vy, maxY: vy + 1.6, minZ: vz - 2.1, maxZ: vz + 2.1 });
      }
      if (smoking) addSmokePlume(vx, vy + 1.35, vz, isAPC ? 1.15 : 0.75);
    };

    const addFallenCasualtyAndEvac = (ex, ez, rotY = 0) => {
      const ey = this.getTerrainHeight(ex, ez);
      const g = new THREE.Group();
      g.position.set(ex, ey, ez);
      g.rotation.y = rotY;
      const tarp = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.24, 1.78), this._materials.bossDark);
      tarp.position.set(0, 0.13, 0);
      const suitcase1 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.44), this._materials.rustBlue);
      suitcase1.position.set(0.85, 0.12, 0.35);
      suitcase1.rotation.y = 0.4;
      const suitcase2 = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.38, 0.26), this._materials.rustRed);
      suitcase2.position.set(-0.75, 0.19, -0.25);
      g.add(tarp, suitcase1, suitcase2);
      this.scene.add(g);
    };

    const addDownedHelicopter = (hx, hz, rotY = 0.4, crashName = 'Downed Mi-8 Gunship') => {
      const hy = this.getTerrainHeight(hx, hz);
      const scar = new THREE.Mesh(new THREE.CircleGeometry(7.8, 14), new THREE.MeshLambertMaterial({ color: 0x1c1d1b }));
      scar.rotation.x = -Math.PI / 2;
      scar.position.set(hx, hy + 0.05, hz);
      this.scene.add(scar);

      let g;
      if (window.ModelSystem && window.ModelSystem.createHelicopterWreck) {
        g = window.ModelSystem.createHelicopterWreck(this._materials);
      } else {
        g = new THREE.Group();
        const fuse = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.5, 8.6), this._materials.rustOlive);
        fuse.position.y = 1.35;
        g.add(fuse);
      }
      g.position.set(hx, hy, hz);
      g.rotation.set(0.08, rotY, -0.14);
      this.scene.add(g);

      this.colliders.push({ minX: hx - 3.6, maxX: hx + 3.6, minY: hy, maxY: hy + 3.1, minZ: hz - 4.8, maxZ: hz + 4.8 });
      addSmokePlume(hx, hy + 1.8, hz, 1.35);
      addFallenCasualtyAndEvac(hx + 4.8, hz + 2.2, rotY);
      this._addLootContainer(hx - 4.2, 0, hz + 1.5, 'military', `${crashName} Avionics Case`);
      if (Math.random() < 0.55) {
        this.spawnGroundItem('black_box', 1, new THREE.Vector3(hx + 3.8, hy + 0.05, hz - 2.0));
      }
    };

    const addFallenPineLog = (lx, lz, rotY = 0) => {
      const ly = this.getTerrainHeight(lx, lz);
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, 7.8, 7), this._materials.wood);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = rotY;
      log.position.set(lx, ly + 0.28, lz);
      const crater = new THREE.Mesh(new THREE.CircleGeometry(2.6, 10), new THREE.MeshLambertMaterial({ color: 0x26241f }));
      crater.rotation.x = -Math.PI / 2;
      crater.position.set(lx - Math.cos(rotY) * 3.6, ly + 0.04, lz + Math.sin(rotY) * 3.6);
      this.scene.add(log, crater);
    };

    // Rotational Micro-Cover Corridors (High-Voltage Transmission Pylons, Granite Outcrops & Highway Checkpoints)
    const buildRotationalCoverCorridors = () => {
      const pylonCoords = [[-42, -312], [65, -265], [178, -238], [185, -130], [140, -18], [95, 22]];
      for (const [px, pz] of pylonCoords) addTransmissionPylon(px, pz);

      const outcropCoords = [
        [-165, -225, 1.15], [40, -240, 1.1], [-320, 15, 1.05], [-145, 35, 1.2], [25, -45, 1.0],
        [185, 160, 1.15], [-120, 155, 1.25], [-315, 215, 1.1], [15, 290, 1.05], [335, -15, 1.15]
      ];
      outcropCoords.forEach(([ox, oz, sc], idx) => addRockOutcrop(ox, oz, sc, idx));

      addRoadCheckpoint(-155, -20, false);
      addRoadCheckpoint(42, 42, true);
      addRoadCheckpoint(-392, 0, false);
      addRoadCheckpoint(-240, 80, false);
      addRoadCheckpoint(248, -150, false);
      addRoadCheckpoint(90, 395, true);
    };
    buildRotationalCoverCorridors();

    // Reusable Guarded Military Compound Builder (Compounds Alpha - Foxtrot)
    const buildGuardedCompound = (codeName, gridRef, cx, cz) => {
      const wSpan = 42, dSpan = 38, wallH = 3.0;
      const baseY = this.getTerrainHeight(cx, cz);
      this._addBox(cx - 12.5, baseY + wallH * 0.5, cz - dSpan * 0.5, 17, wallH, 0.9, this._materials.darkConcrete, true);
      this._addBox(cx + 12.5, baseY + wallH * 0.5, cz - dSpan * 0.5, 17, wallH, 0.9, this._materials.darkConcrete, true);
      this._addBox(cx - 12.5, baseY + wallH * 0.5, cz + dSpan * 0.5, 17, wallH, 0.9, this._materials.darkConcrete, true);
      this._addBox(cx + 12.5, baseY + wallH * 0.5, cz + dSpan * 0.5, 17, wallH, 0.9, this._materials.darkConcrete, true);
      this._addBox(cx - wSpan * 0.5, baseY + wallH * 0.5, cz, 0.9, wallH, dSpan, this._materials.darkConcrete, true);
      this._addBox(cx + wSpan * 0.5, baseY + wallH * 0.5, cz, 0.9, wallH, dSpan, this._materials.darkConcrete, true);

      // Vehicular Gatehouse + Boom Barrier + Dual Walkable Corner Watchtowers!
      this._addBox(cx, baseY + 3.4, cz + dSpan * 0.5, 8.4, 0.45, 2.2, this._materials.bossDark, false);
      this._addBox(cx - 4.0, baseY + 1.5, cz + dSpan * 0.5 + 1.6, 2.6, 3.0, 2.6, this._materials.rustOlive, true);
      for (const [wx, wz, dir] of [[cx + wSpan * 0.5 - 2.6, cz + dSpan * 0.5 - 2.6, 'west'], [cx - wSpan * 0.5 + 2.6, cz - dSpan * 0.5 + 2.6, 'east']]) {
        const wy = this.getTerrainHeight(wx, wz);
        this._addBox(wx, wy + 3.4, wz, 4.4, 0.35, 4.4, this._materials.darkConcrete, true);
        this._addBox(wx, wy + 6.4, wz, 4.8, 0.25, 4.8, this._materials.roofTar, false);
        for (const [px, pz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) {
          this._addBox(wx + px, wy + 3.2, wz + pz, 0.35, 6.4, 0.35, this._materials.metal, true);
        }
        addStaircase(dir === 'west' ? wx - 2.2 : wx + 2.2, wy, wz, 12, 1.8, 3.4, 4.8, dir);
      }
      addFloodlight(cx + 1.0, cz + dSpan * 0.5 + 1.5, 0, 10.0, 0xfff0cc);

      this._addSignBoard(cx, baseY + 4.5, cz + dSpan * 0.5 + 0.4, 6.4, 2.1, 0, {
        title: `COMPOUND ${codeName}`,
        sub: `VOSTOK GARRISON // SECTOR ${gridRef}`,
        bg: '#1e241e',
        accent: '#ab47bc'
      });

      // 1. Permanent Primary Barracks with Pitched Roof (NW quadrant)
      const bx = cx - 10.5, bz = cz - 8.5;
      this._addBuilding(bx, bz, 14, 10, 4.4, 'south', this._materials.concrete, (by, bh) => {
        this._addPartition(bx + 2.2, bz - 5.0, bx + 2.2, bz + 5.0, by, bh, [
          { at: bz + 1.4, w: 1.7, door: 'wood', label: 'Barracks Arms Room' }
        ]);
        addDeskProp(bx + 4.8, by + 0.16, bz - 2.8);
      });
      addPitchedRoof(bx, baseY + 4.65, bz, 14.4, 10.4, 1.45, this._materials.rustOlive, true);
      this._addGunLocker(bx + 5.2, bz + 2.4, -Math.PI / 2, 'military', `${codeName} Barracks Gun Locker`);
      this._addLootContainer(bx - 4.2, 0.16, bz - 2.6, 'military', `${codeName} Barracks Footlocker`);
      this._addMetalShelf(bx - 4.2, bz + 2.4, 0, [
        { id: 'cloth_roll', qty: 2 }, { id: 'kevlar_padding', qty: 1 }, { id: 'sterile_bandage', qty: 1 }
      ]);

      // 2. Arched-Roof Supply Depot (NE quadrant)
      const sx = cx + 11.0, sz = cz - 9.0;
      this._addBuilding(sx, sz, 12, 9.5, 4.4, 'south', this._materials.rustOlive, () => {});
      addArchedRoof(sx, baseY + 4.6, sz, 12.2, 9.8, 1.85, this._materials.darkConcrete);
      this._addLootContainer(sx - 3.6, 0.16, sz - 2.4, 'supply', `${codeName} Depot Supply Crate`);
      this._addMetalShelf(sx + 3.2, sz - 2.2, 0, [
        { id: 'brass_casings', qty: 2 }, { id: 'gunpowder', qty: 2 }, { id: 'metallic_alloy', qty: 1 }
      ]);
      this._addWorkbenchTable(sx - 3.2, sz + 2.0, 0, [
        { id: 'heavy_casings', qty: 2 }, { id: 'casings_12g', qty: 2 }
      ]);

      // 3. Hardened Concrete Command Bunker with Sandbag Parapet (SE quadrant)
      const kbx = cx + 11.5, kbz = cz + 8.5;
      this._addBuilding(kbx, kbz, 11, 9, 3.8, 'west', this._materials.bossDark, (by) => {
        addDeskProp(kbx + 2.6, by + 0.16, kbz - 2.2);
      });
      this._addBox(kbx, baseY + 4.35, kbz, 11.6, 0.75, 9.6, this._materials.darkConcrete, true);
      this._addLootContainer(kbx + 2.8, 0.16, kbz + 2.2, 'military', `${codeName} Bunker Ordnance Case`);
      this._addLootContainer(kbx - 2.2, 0.16, kbz - 2.6, 'office', `${codeName} Intelligence Cabinet`);

      // 4. Dual Gear Tents (SW quadrant) sheltering Supply Crates & Weapon Lockers
      const t1x = cx - 11.0, t1z = cz + 8.5;
      addMilitaryTent(t1x, this.getTerrainHeight(t1x, t1z), t1z, 8.6, 6.4);
      this._addGunLocker(t1x - 2.4, t1z - 1.2, Math.PI / 2, 'military', `${codeName} Tent Weapon Locker`);
      this._addLootContainer(t1x + 2.2, 0, t1z + 1.0, 'supply', `${codeName} Tent Gear Crate`);

      const t2x = cx - 1.2, t2z = cz + 9.5;
      addMilitaryTent(t2x, this.getTerrainHeight(t2x, t2z), t2z, 7.6, 5.8);
      this._addLootContainer(t2x - 1.6, 0, t2z, 'military', `${codeName} Field Munitions Case`);
      this._addWallFirstAidKit(bx + 1.0, bz + 5.3, 'south', `${codeName} Triage First Aid`);

      this.pois.push({ name: `COMPOUND ${codeName}`, x: cx, z: cz, color: '#ab47bc', threat: 'high' });
    };

    // Reusable Roadside Strip-Town Builder (Distinct Houses + % chance Clinic, Police, or Fire Station!)
    const buildRoadsideStripTown = (cx, cz, verticalRoad = true) => {
      const plots = verticalRoad
        ? [
            { x: cx - 14.5, z: cz - 11.0, door: 'east' },
            { x: cx + 14.5, z: cz - 11.0, door: 'west' },
            { x: cx - 14.5, z: cz + 11.0, door: 'east' },
            { x: cx + 14.5, z: cz + 11.0, door: 'west' }
          ]
        : [
            { x: cx - 11.0, z: cz - 14.5, door: 'south' },
            { x: cx + 11.0, z: cz - 14.5, door: 'south' },
            { x: cx - 11.0, z: cz + 14.5, door: 'north' },
            { x: cx + 11.0, z: cz + 14.5, door: 'north' }
          ];

      const usedSpecial = new Set();
      for (let i = 0; i < plots.length; i++) {
        const pl = plots[i];
        const roll = Math.random();
        let bType = 'house';
        if (roll < 0.16 && !usedSpecial.has('clinic')) {
          bType = 'clinic';
          usedSpecial.add('clinic');
        } else if (roll < 0.31 && !usedSpecial.has('police')) {
          bType = 'police';
          usedSpecial.add('police');
        } else if (roll < 0.44 && !usedSpecial.has('fire')) {
          bType = 'fire';
          usedSpecial.add('fire');
        }

        const signRot = pl.door === 'east' ? Math.PI / 2 : (pl.door === 'west' ? -Math.PI / 2 : (pl.door === 'north' ? Math.PI : 0));
        const signOffX = pl.door === 'east' ? 5.6 : (pl.door === 'west' ? -5.6 : 0);
        const signOffZ = pl.door === 'south' ? 4.6 : (pl.door === 'north' ? -4.6 : 0);
        const py = this.getTerrainHeight(pl.x, pl.z);

        if (bType === 'clinic') {
          this._addBuilding(pl.x, pl.z, 10.5, 8.6, 4.0, pl.door, this._materials.whiteWall, (by) => {
            addHospitalBed(pl.x - 2.2, by + 0.16, pl.z - 1.8, 0);
            addDeskProp(pl.x + 2.4, by + 0.16, pl.z + 1.8);
          });
          this._addBox(pl.x + signOffX * 1.15, py + 2.85, pl.z + signOffZ * 1.15, pl.door === 'east' || pl.door === 'west' ? 2.4 : 4.2, 0.25, pl.door === 'east' || pl.door === 'west' ? 4.2 : 2.4, this._materials.whiteWall, false);
          this._addBox(pl.x, py + 4.45, pl.z, 1.8, 0.6, 0.5, this._materials.fireRed, false);
          this._addBox(pl.x, py + 4.45, pl.z, 0.5, 0.6, 1.8, this._materials.fireRed, false);
          this._addSignBoard(pl.x + signOffX, py + 3.4, pl.z + signOffZ, 4.2, 1.5, signRot, 'clinic');
          this._addLootContainer(pl.x + 2.8, 0.16, pl.z - 2.2, 'hospital', 'Roadside Clinic Med Cabinet');
          this._addWallFirstAidKit(pl.x - 4.6, pl.z + 1.2, 'east', 'Clinic First Aid Kit');
          this._addWorkbenchTable(pl.x - 2.0, pl.z + 2.2, 0, [
            { id: 'sterile_bandage', qty: 1 }, { id: 'syringe', qty: 1 }, { id: 'scrubs', qty: 1 }
          ]);
        } else if (bType === 'police') {
          this._addBuilding(pl.x, pl.z, 11.0, 8.8, 4.1, pl.door, this._materials.policeNavy, (by, bh) => {
            addDeskProp(pl.x - 2.2, by + 0.16, pl.z - 1.8);
            this._addPartition(pl.x + 1.6, pl.z - 4.2, pl.x + 1.6, pl.z + 4.2, by, bh, [
              { at: pl.z + 1.5, w: 1.4, door: 'steel', label: 'Holding Cell' }
            ]);
          });
          this._addBox(pl.x + 2.4, py + 5.8, pl.z - 2.0, 0.18, 3.4, 0.18, this._materials.metal, false);
          this._addSignBoard(pl.x + signOffX, py + 3.4, pl.z + signOffZ, 4.2, 1.5, signRot, 'police');
          this._addGunLocker(pl.x + 3.4, pl.z - 2.2, -Math.PI / 2, 'police_fire', 'Roadside Police Arms Locker');
          this._addLootContainer(pl.x - 2.8, 0.16, pl.z + 2.2, 'office', 'Precinct Records Cabinet');
        } else if (bType === 'fire') {
          this._addBuilding(pl.x, pl.z, 11.0, 9.0, 4.6, pl.door, this._materials.fireRed, () => {});
          this._addBox(pl.x - 3.6, py + 6.4, pl.z - 2.6, 2.8, 3.6, 2.8, this._materials.fireRed, false);
          this._addSignBoard(pl.x + signOffX, py + 3.5, pl.z + signOffZ, 4.2, 1.5, signRot, 'fire');
          this._addGunLocker(pl.x - 3.4, pl.z - 2.4, Math.PI / 2, 'police_fire', 'Firehouse Rescue Gear Locker');
          this._addWorkbenchTable(pl.x + 2.6, pl.z + 2.0, 0, [
            { id: 'tools', qty: 1 }, { id: 'medkit', qty: 1 }
          ]);
        } else {
          const hWall = (i % 2 === 0) ? this._materials.wood : this._materials.interiorPlaster;
          this._addBuilding(pl.x, pl.z, 10.2, 8.4, 3.8, pl.door, hWall, (by, bh) => {
            this._addPartition(pl.x, pl.z - 4.2, pl.x, pl.z + 4.2, by, bh, [
              { at: pl.z + 1.0, w: 1.5, door: 'wood', label: 'Bedroom Door' }
            ]);
          });
          addPitchedRoof(pl.x, py + 4.05, pl.z, 10.8, 9.0, 1.85, this._materials.rustRed, true);
          this._addBox(pl.x - 2.6, py + 5.6, pl.z - 1.8, 0.8, 1.6, 0.8, this._materials.darkConcrete, false);
          this._addLootContainer(pl.x - 2.8, 0.16, pl.z - 2.0, 'household', 'House Dresser');
          this._addMedicineCabinet(pl.x + 2.6, pl.z - 3.65, 'north', 'Home Medicine Cabinet');
          const housePool = ['kids_drawing', 'family_photo', 'picture_of_man', 'nature_photo', 'clothes', 'cleaning_supplies', 'tools'];
          const pick1 = housePool[(i * 2) % housePool.length];
          const pick2 = housePool[(i * 2 + 3) % housePool.length];
          this._addWorkbenchTable(pl.x + 2.6, pl.z + 2.0, 0, [
            { id: pick1, qty: 1 }, { id: pick2, qty: 1 }
          ]);
        }
      }
      addWreckedVehicle(cx + (verticalRoad ? 5.2 : 0), cz + (verticalRoad ? 0 : 5.2), verticalRoad ? 0.12 : 1.45, false, false);
      addFloodlight(cx + (verticalRoad ? -6.2 : 0), cz + (verticalRoad ? 0 : -6.2), 0, 9.5, 0xffe4aa);
    };

    // =========================================================================
    // === 15 WARZONE-INSPIRED MULTI-LEVEL VOSTOK POIs AT EXACT COORDINATES  ===
    // =========================================================================

    // 1. TV BROADCAST STATION (D4: -240, -80) — 2F Mezzanine + Accessible Roof + Satellite Dishes + 56m Mast
    {
      const cx = -240, cz = -80;
      const by0 = this.getTerrainHeight(cx, cz);
      const f1H = 4.2, f2H = 3.8, totH = f1H + f2H;
      this._addBuilding(cx, cz, 26, 20, totH, 'east', this._materials.concrete, (by) => {
        this._addPartition(cx - 2.0, cz - 10.0, cx - 2.0, cz + 10.0, by, f1H, [
          { at: cz - 3.0, w: 1.8, door: 'steel', label: 'Studio Control Door' },
          { at: cz + 4.5, w: 1.8, door: 'wood', label: 'Executive Suite Door' }
        ]);
        this._addPartition(cx - 13.0, cz + 1.0, cx - 2.0, cz + 1.0, by, f1H, []);
        this._addBox(cx + 5.5, by + 0.55, cz - 2.5, 4.2, 0.95, 1.4, this._materials.bossDark, true);
        addDeskProp(cx - 7.5, by + 0.16, cz - 5.5);
        addDeskProp(cx - 7.5, by + 0.16, cz + 5.5);
        // 2F Broadcast Control Gallery Mezzanine overlooking Studio A
        this._addBox(cx - 7.0, by + f1H - 0.15, cz, 11.2, 0.32, 19.2, this._materials.darkConcrete, true);
        addStaircase(cx + 1.5, by + 0.16, cz + 8.0, 15, 2.2, f1H - 0.16, 8.2, 'west');
        addDeskProp(cx - 8.0, by + f1H + 0.04, cz - 3.5);
      });
      // Glazed Entrance Atrium Rotunda + Exterior Fire Escape up to Accessible Roof Parapet!
      this._addBox(cx + 14.5, by0 + 2.2, cz, 3.8, 0.3, 9.0, this._materials.darkConcrete, true);
      this._addBox(cx + 15.8, by0 + 2.2, cz - 4.0, 0.5, 4.4, 0.5, this._materials.metal, true);
      this._addBox(cx + 15.8, by0 + 2.2, cz + 4.0, 0.5, 4.4, 0.5, this._materials.metal, true);
      this._addBox(cx + 14.5, by0 + 4.35, cz, 4.2, 0.35, 9.4, this._materials.windowFrame, true);
      addStaircase(cx + 14.4, by0 + 0.1, cz - 9.2, 22, 2.0, totH + 0.25, 13.5, 'north');
      // Rooftop Parapet Wall + Dual Satellite Dishes
      this._addBox(cx, by0 + totH + 0.8, cz - 9.8, 26.2, 1.0, 0.45, this._materials.darkConcrete, true);
      this._addBox(cx, by0 + totH + 0.8, cz + 9.8, 26.2, 1.0, 0.45, this._materials.darkConcrete, true);
      for (const sz of [cz - 5.2, cz + 5.2]) {
        const dish = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 0.35, 1.1, 14), this._materials.whiteWall);
        dish.position.set(cx - 6.0, by0 + totH + 1.4, sz);
        dish.rotation.z = -0.55;
        this.scene.add(dish);
      }
      this._addSignBoard(cx + 13.4, by0 + 5.6, cz, 8.2, 2.4, Math.PI / 2, {
        title: 'TV BROADCAST',
        sub: 'VOSTOK STATE TELEVISION // CH-04',
        bg: '#18222c',
        accent: '#29b6f6'
      });
      this._addLootContainer(cx - 9.5, 0.16, cz - 6.8, 'office', 'Broadcast Archive Cabinet');
      this._addLootContainer(cx - 9.5, f1H + 0.04, cz + 6.8, 'valuables', '2F Station Director Safe');
      this._addMetalShelf(cx + 6.5, cz + 6.5, 0, [
        { id: 'exp_radio_transmitter', qty: 1 }, { id: 'classified_documents', qty: 1 }, { id: 'payroll_documents', qty: 1 }
      ]);
      this._addLootContainer(cx - 2.5, totH + 0.35, cz, 'military', 'Rooftop Recon Spotter Case');

      // 56m Red/White Lattice Broadcast Mast with Aviation Strobe Beacon
      const mx = cx - 20, mz = cz - 15;
      const my = this.getTerrainHeight(mx, mz);
      for (let tier = 0; tier < 6; tier++) {
        const th = 8.2;
        const wT = 5.0 - tier * 0.62;
        const matT = (tier % 2 === 0) ? this._materials.fireRed : this._materials.whiteWall;
        this._addBox(mx, my + tier * th + th * 0.5, mz, wT, th, wT, matT, tier === 0);
      }
      this._addBox(mx, my + 52.0, mz, 0.35, 6.5, 0.35, this._materials.metal, false);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      beacon.position.set(mx, my + 55.6, mz);
      this.scene.add(beacon);
      this.registerLightSource(beacon.position, { intensity: 1.0, maxDist: 280, flareScale: 0.95, anamorphic: true });
      addFloodlight(cx + 16.5, cz + 10.5, -0.6, 10.5, 0xfff0cc);
      this.pois.push({ name: 'TV BROADCAST', x: cx, z: cz, color: '#29b6f6', threat: 'medium' });
    }

    // 2. VOSTOK AIRPORT (B5: -522, 75) — 2F Glazed Concourse, Jetway Bridge, Barrel-Arch Hangar & 15.5m ATC Tower
    {
      const cx = -522, cz = 75;
      const ay = this.getTerrainHeight(cx, cz);
      this._addBox(-552, ay + 0.06, cz, 20, 0.14, 154, this._materials.road, false);
      for (let k = -3; k <= 3; k++) {
        if (k === 0) continue;
        this._addBox(-552 + k * 2.2, ay + 0.14, cz - 68, 1.1, 0.04, 7.5, this._materials.whiteWall, false);
        this._addBox(-552 + k * 2.2, ay + 0.14, cz + 68, 1.1, 0.04, 7.5, this._materials.whiteWall, false);
      }
      // 2-Story Main Airport Concourse Terminal
      const tF1 = 4.4, tF2 = 4.0, tTot = tF1 + tF2;
      this._addBuilding(-512, 92, 22, 16, tTot, 'east', this._materials.whiteWall, (by) => {
        this._addPartition(-512 - 3.5, 92 - 8.0, -512 - 3.5, 92 + 8.0, by, tF1, [
          { at: 92, w: 2.0, door: 'steel', label: 'Customs Office Door' }
        ]);
        addDeskProp(-512 + 3.5, by + 0.16, 92 - 4.2);
        addDeskProp(-512 - 7.0, by + 0.16, 92 + 3.8);
        // 2F Departure Gallery Deck + Interior Stairs
        this._addBox(-512 - 2.0, by + tF1 - 0.15, 92, 17.5, 0.32, 15.4, this._materials.darkConcrete, true);
        addStaircase(-512 + 7.8, by + 0.16, 92 + 6.2, 16, 2.4, tF1 - 0.16, 8.8, 'north');
      });
      // Elevated Boarding Jetway extending from 2F Terminal West Wall out onto Airport Apron!
      this._addBox(-531, ay + tF1, 92, 16.5, 0.36, 3.8, this._materials.metal, true);
      this._addBox(-539, ay + tF1 * 0.5, 92, 1.4, tF1, 1.4, this._materials.darkConcrete, true);
      addStaircase(-539, ay, 92 - 1.5, 16, 2.2, tF1, 7.5, 'south');
      this._addSignBoard(-512 + 11.4, ay + 5.6, 92, 8.0, 2.3, Math.PI / 2, {
        title: 'VOSTOK AIRPORT',
        sub: 'TERMINAL A // EVACUATION HALTED',
        bg: '#162636',
        accent: '#4fc3f7'
      });
      this._addLootContainer(-512 - 7.5, 0.16, 92 - 4.8, 'office', 'Airport Manifest Cabinet');
      this._addLootContainer(-512 - 7.5, tF1 + 0.04, 92 + 5.6, 'valuables', '2F Customs Seizure Safe');
      this._addWorkbenchTable(-512 + 4.2, 92 + 4.5, 0, [
        { id: 'vacation_planner', qty: 1 }, { id: 'documents', qty: 2 }, { id: 'hourly_schedule', qty: 1 }
      ]);

      // Barrel-Vault Arched Maintenance Hangar + Interior Steel Catwalk
      const hx = -514, hz = 54;
      this._addBox(hx, ay + 0.08, hz, 19, 0.16, 20, this._materials.darkConcrete, false);
      this._addBox(hx - 9.2, ay + 3.4, hz, 0.55, 6.8, 20, this._materials.rustBlue, true);
      this._addBox(hx + 9.2, ay + 3.4, hz, 0.55, 6.8, 20, this._materials.rustBlue, true);
      this._addBox(hx, ay + 3.4, hz - 9.7, 19, 6.8, 0.55, this._materials.rustBlue, true);
      addArchedRoof(hx, ay + 6.9, hz, 19.6, 20.6, 2.8, this._materials.rustBlue);
      this._addBox(hx, ay + 3.8, hz - 7.8, 17.6, 0.3, 3.6, this._materials.metal, true);
      addStaircase(hx + 7.0, ay + 0.16, hz + 1.0, 14, 2.2, 3.65, 7.6, 'north');
      this._addGunLocker(hx - 7.6, hz - 5.5, Math.PI / 2, 'military', 'Hangar Security Locker');
      this._addLootContainer(hx + 6.6, 0.16, hz - 5.5, 'military', 'Airfield Ordnance Case');
      this._addMetalShelf(hx, hz - 8.2, 0, [
        { id: 'carbon_fibre_sample', qty: 1 }, { id: 'metallic_alloy', qty: 2 }, { id: 'tools', qty: 1 }
      ]);

      // 15.5m ATC Control Tower with Multi-Flight Switchback Stairs + Aviation Beacon!
      this._addBox(-528, ay + 6.2, 72, 6.4, 12.4, 6.4, this._materials.concrete, true);
      this._addBox(-528, ay + 12.6, 72, 9.6, 0.45, 9.6, this._materials.darkConcrete, true);
      this._addBox(-528, ay + 14.1, 72, 8.2, 2.8, 8.2, this._materials.windowFrame, true);
      addStaircase(-522.0, ay, 72, 22, 2.2, 6.2, 10.5, 'north');
      this._addBox(-522.0, ay + 6.1, 72 - 11.8, 3.2, 0.35, 3.2, this._materials.metal, true);
      addStaircase(-522.0, ay + 6.2, 72 - 13.0, 22, 2.2, 6.4, 10.5, 'south');
      this.registerLightSource(new THREE.Vector3(-528, ay + 16.0, 72), { intensity: 1.05, maxDist: 260, flareScale: 0.95 });

      addFloodlight(-544, 22, 0.3, 11.0, 0xfff0cc);
      addFloodlight(-544, 128, -0.3, 11.0, 0xfff0cc);
      addDownedHelicopter(-551, 42, 0.65, 'Runway Evac Helo');
      addFallenCasualtyAndEvac(-498, 92, 0.3);
      this.pois.push({ name: 'AIRPORT', x: cx, z: cz, color: '#4fc3f7', threat: 'high' });
    }

    // 3. VOSTOK SUPERSTORE (F5: 95, 85) — Atlas-Style Double-Height Skylit Hypermarket, 2F Mezzanine, Pallet Aisles & Loading Dock!
    {
      const cx = 95, cz = 85;
      const sy = this.getTerrainHeight(cx, cz);
      const sH = 7.6;
      this._addBuilding(cx, cz, 32, 26, sH, 'west', this._materials.rustBlue, (by) => {
        this._addPartition(cx + 8.5, cz - 13.0, cx + 8.5, cz + 13.0, by, 4.2, [
          { at: cz - 5.0, w: 2.0, door: 'steel', label: 'Superstore Back Room' },
          { at: cz + 6.0, w: 1.8, door: 'wood', label: 'Manager Office' }
        ]);
        this._addPartition(cx + 8.5, cz + 1.0, cx + 16.0, cz + 1.0, by, 4.2, []);
        addDeskProp(cx + 12.2, by + 0.16, cz + 6.5);
        // 2F Back-of-House Manager Mezzanine Balcony overlooking Sales Floor!
        this._addBox(cx + 11.8, by + 4.15, cz, 6.8, 0.32, 25.0, this._materials.darkConcrete, true);
        addStaircase(cx + 7.2, by + 0.16, cz + 11.2, 15, 2.2, 4.05, 8.2, 'north');
        // Tall Industrial Warehouse Pallet Racking Rows for Authentic Superstore CQB Lanes
        for (const rz of [cz - 7.5, cz, cz + 7.5]) {
          this._addBox(cx - 2.0, by + 2.4, rz, 10.5, 4.4, 1.5, this._materials.hazardAmber, true);
          this._addBox(cx - 11.5, by + 0.55, rz, 3.2, 0.95, 1.2, this._materials.darkConcrete, true);
        }
      });
      // Overhead Steel Roof Trusses + 3 Raised Skylight Monitors
      for (const skz of [cz - 7.0, cz, cz + 7.0]) {
        this._addBox(cx - 3.5, sy + sH + 0.7, skz, 12.0, 0.9, 3.2, this._materials.windowFrame, false);
      }
      // 3-Bay Rear Truck Loading Dock + Exterior Fire Escape Stairs to Roof!
      this._addBox(cx + 18.2, sy + 0.65, cz - 2.0, 4.2, 1.3, 18.0, this._materials.concrete, true);
      addStaircase(cx + 18.2, sy + 1.3, cz - 10.5, 22, 2.0, sH - 1.1, 13.0, 'north');
      addStaircase(cx - 17.5, sy, cz + 8.0, 6, 3.2, 1.2, 3.0, 'north');
      addFloodlight(cx - 22, cz - 14, 0.4, 11.5, 0xfff0cc);
      addFloodlight(cx - 22, cz + 14, -0.4, 11.5, 0xfff0cc);

      this._addSignBoard(cx - 16.4, sy + 5.8, cz, 9.6, 2.6, -Math.PI / 2, {
        title: 'SUPERSTORE',
        sub: 'VOSTOK HYPERMARKET // RETAIL & DEPOT',
        bg: '#152942',
        accent: '#ffb300'
      });
      this._addMetalShelf(cx - 7.8, cz - 4.0, 0, [
        { id: 'cleaning_supplies', qty: 2 }, { id: 'tools', qty: 1 }, { id: 'clothes', qty: 2 }
      ]);
      this._addMetalShelf(cx - 7.8, cz + 4.0, 0, [
        { id: 'bandage', qty: 2 }, { id: 'basic_chemicals', qty: 2 }, { id: 'nylon_cloth_roll', qty: 1 }
      ]);
      this._addMetalShelf(cx + 4.2, cz - 4.0, 0, [
        { id: 'decorative_bowl', qty: 1 }, { id: 'vacation_planner', qty: 1 }, { id: 'hourly_schedule', qty: 1 }
      ]);
      this._addLootContainer(cx + 12.4, 0.16, cz - 7.5, 'supply', 'Back Room Stock Crate');
      this._addLootContainer(cx + 12.2, 4.32, cz + 8.8, 'valuables', '2F Superstore Manager Safe');
      this._addWorkbenchTable(cx + 12.2, cz - 2.5, 0, [
        { id: 'back_room_inventory_list', qty: 2 }, { id: 'financial_ledger', qty: 1 }
      ]);
      this.pois.push({ name: 'SUPERSTORE', x: cx, z: cz, color: '#ffb300', threat: 'medium' });
    }

    // 4. NORTHERN DAM (E2: -42, -395) — 21.5m Gorge Dam, 3 Spillway Gate Towers, 2F Powerhouse & Transformer Yard!
    {
      const dcx = -42, crestZ = -408;
      const crestY = 21.5;
      const lowerY = 3.2;
      this.pois.push({ name: 'NORTHERN DAM', x: dcx, z: -395, color: '#90a4ae', threat: 'high' });

      this._addBox(dcx, (crestY + lowerY) * 0.5, crestZ, 216, crestY - lowerY + 0.4, 16.0, this._materials.concrete, true);
      this._addBox(dcx, 17.8, -442, 216, 0.6, 52, this._materials.darkConcrete, true);
      this._addBox(dcx, crestY + 0.6, crestZ - 7.8, 216, 1.2, 0.45, this._materials.darkConcrete, true);
      this._addBox(-134, crestY + 0.6, crestZ + 7.8, 32, 1.2, 0.45, this._materials.darkConcrete, true);
      this._addBox(dcx, crestY + 0.6, crestZ + 7.8, 140, 1.2, 0.45, this._materials.darkConcrete, true);
      this._addBox(50, crestY + 0.6, crestZ + 7.8, 32, 1.2, 0.45, this._materials.darkConcrete, true);
      addStaircase(-174, 17.8, crestZ, 16, 12.0, crestY - 17.8, 24.0, 'east');
      addStaircase(90, 17.8, crestZ, 16, 12.0, crestY - 17.8, 24.0, 'west');

      // 3 Hydroelectric Spillway Gatehouse Arch Towers across Dam Crest
      for (const gx of [dcx - 62, dcx, dcx + 62]) {
        this._addBox(gx - 5.6, crestY + 3.4, crestZ, 1.2, 6.8, 4.2, this._materials.bossDark, true);
        this._addBox(gx + 5.6, crestY + 3.4, crestZ, 1.2, 6.8, 4.2, this._materials.bossDark, true);
        this._addBox(gx, crestY + 6.4, crestZ, 13.8, 1.4, 4.8, this._materials.bossDark, true);
      }
      const damSign = { title: 'NORTHERN DAM', sub: 'VOSTOK HYDROELECTRIC // GORGE SECTOR', bg: '#20262c', accent: '#4fc3f7' };
      this._addSignBoard(dcx, crestY + 8.6, crestZ + 2.6, 11.4, 3.8, 0, damSign);
      this._addSignBoard(dcx, crestY + 8.6, crestZ - 2.6, 11.4, 3.8, Math.PI, damSign);
      this._addBox(dcx - 36, crestY + 1.4, crestZ - 3.6, 6.5, 2.8, 2.6, this._materials.rustOlive, true);
      addSmokePlume(dcx + 28, crestY + 0.5, crestZ + 2.5, 0.85);
      this._addLootContainer(dcx - 8.5, crestY - this.getTerrainHeight(dcx - 8.5, crestZ - 4.5) + 0.02, crestZ - 4.5, 'military', 'Dam Crest Convoy Case');
      this.registerLightSource(new THREE.Vector3(dcx - 62, crestY + 7.2, crestZ), { intensity: 0.95, maxDist: 230, flareScale: 0.85 });
      this.registerLightSource(new THREE.Vector3(dcx + 62, crestY + 7.2, crestZ), { intensity: 0.95, maxDist: 230, flareScale: 0.85 });

      // Stepped Spillway Face & Structural Concrete Buttress Piers
      this._addBox(dcx, 16.4, -396, 212, 5.2, 9.0, this._materials.concrete, true);
      this._addBox(dcx, 11.4, -387, 212, 5.2, 10.0, this._materials.darkConcrete, true);
      this._addBox(dcx, 6.8, -376, 212, 4.6, 12.0, this._materials.concrete, true);
      for (const px of [-132, -96, -60, -24, 12, 48]) {
        this._addBox(px, 12.2, -384, 3.4, 17.6, 34.0, this._materials.bossDark, true);
      }
      const midY = 12.2;
      this._addBox(dcx, midY - 0.15, -378, 174, 0.35, 4.6, this._materials.darkConcrete, true);
      addStaircase(-114, lowerY, -354, 28, 3.0, midY - lowerY, 21.0, 'north');
      addStaircase(-114, midY, -380.5, 28, 3.0, crestY - midY, 21.0, 'north');
      addStaircase(30, lowerY, -354, 28, 3.0, midY - lowerY, 21.0, 'north');
      addStaircase(30, midY, -380.5, 28, 3.0, crestY - midY, 21.0, 'north');

      // 2-Story Turbine Powerhouse + Transformer Yard
      const pbx = -42, pbz = -342;
      this._addBuilding(pbx, pbz, 26, 14, 6.4, 'south', this._materials.concrete, (hBy, hH) => {
        for (const tx of [pbx - 7.5, pbx - 1.0, pbx + 5.5]) {
          this._addBox(tx, hBy + 1.15, pbz - 2.2, 3.0, 2.0, 3.0, this._materials.metal, true);
        }
        this._addPartition(pbx + 8.2, pbz - 7.0, pbx + 8.2, pbz + 7.0, hBy, hH, [
          { at: pbz + 2.2, w: 1.8, door: 'steel', label: 'Turbine Control Door' }
        ]);
        addDeskProp(pbx + 10.6, hBy + 0.16, pbz - 4.0);
        this._addLootContainer(pbx + 10.8, 0.16, pbz + 4.4, 'valuables', 'Dam Control Vault');
      });
      for (const tx of [pbx + 18, pbx + 24]) {
        const ty = this.getTerrainHeight(tx, pbz - 2);
        this._addBox(tx, ty + 1.4, pbz - 2, 2.6, 2.8, 2.6, this._materials.rustBlue, true);
        this._addBox(tx, ty + 3.2, pbz - 2, 0.6, 1.0, 0.6, this._materials.whiteWall, false);
      }
      addFloodlight(pbx - 16, pbz + 10, 0, 11.0, 0xfff0cc);
      this._addGunLocker(pbx - 11.6, pbz + 2.2, Math.PI / 2, 'military', 'Powerhouse Security Locker');
      this._addLootContainer(pbx - 10.2, 0.16, pbz - 4.8, 'supply', 'Turbine Hall Parts Crate');
    }

    // 5. CRUISE TERMINAL (G7: 245, 408) — Wave-Canopy 2F Terminal, Floodlit Pier & Boardable Listing Ferry!
    {
      const cx = 245, cz = 408;
      const cy = this.getTerrainHeight(cx, cz);
      const cF1 = 4.2, cF2 = 3.6;
      this._addBuilding(cx, cz, 28, 16, cF1 + cF2, 'north', this._materials.whiteWall, (by, bh) => {
        this._addPartition(cx + 6.5, cz - 8.0, cx + 6.5, cz + 8.0, by, cF1, [
          { at: cz, w: 1.8, door: 'wood', label: 'VIP Cruise Lounge' }
        ]);
        addDeskProp(cx - 5.5, by + 0.16, cz + 3.5);
        addDeskProp(cx + 10.2, by + 0.16, cz - 4.2);
        this._addBox(cx - 2.5, by + cF1 - 0.15, cz, 22.0, 0.32, 15.2, this._materials.darkConcrete, true);
        addStaircase(cx + 8.5, by + 0.16, cz + 6.2, 15, 2.2, cF1 - 0.16, 8.2, 'north');
      });
      // Sculpted Stepped Maritime Roof Waves
      this._addBox(cx - 4.0, cy + cF1 + cF2 + 0.6, cz, 18.0, 0.7, 16.4, this._materials.rustBlue, false);
      this._addBox(cx + 7.5, cy + cF1 + cF2 + 0.9, cz, 12.0, 1.0, 15.6, this._materials.whiteWall, false);
      this._addSignBoard(cx, cy + 5.4, cz - 8.4, 8.8, 2.4, Math.PI, {
        title: 'CRUISE TERMINAL',
        sub: 'VOSTOK MARITIME PORT // OCEAN BERTH 01',
        bg: '#132a3a',
        accent: '#26c6da'
      });
      this._addLootContainer(cx + 10.8, 0.16, cz + 4.8, 'valuables', 'Purser Bullion & Valuables Safe');
      this._addLootContainer(cx - 9.5, cF1 + 0.04, cz - 4.5, 'office', '2F Port Embarkation Records');
      this._addWorkbenchTable(cx - 2.0, cz + 4.5, 0, [
        { id: 'vacation_planner', qty: 2 }, { id: 'antique_watch', qty: 1 }, { id: 'ancient_coin', qty: 1 }
      ]);

      const pierY = Math.max(cy + 0.25, this.OCEAN_WATER_Y + 1.85);
      this._addBox(cx, pierY - 0.25, 452, 12.0, 0.55, 68, this._materials.concrete, true);
      addStaircase(cx, cy, 417, 6, 8.0, Math.max(0.4, pierY - cy), 4.5, 'south');
      for (let pz = 428; pz <= 482; pz += 14) {
        this._addBox(cx - 5.2, pierY - 2.2, pz, 1.0, 4.2, 1.0, this._materials.darkConcrete, true);
        this._addBox(cx + 5.2, pierY - 2.2, pz, 1.0, 4.2, 1.0, this._materials.darkConcrete, true);
      }
      addFloodlight(cx - 5.4, 476, 0, 9.5, 0xfff0cc);
      this._addBox(cx - 3.2, pierY + 1.4, 466, 2.6, 2.8, 6.5, this._materials.rustBlue, true);
      this._addLootContainer(cx + 2.8, pierY - this.getTerrainHeight(cx + 2.8, 474) + 0.02, 474, 'military', 'Evacuation Pier Supply Case');
      addFallenCasualtyAndEvac(cx - 1.5, 444, 0.5);
      addFallenCasualtyAndEvac(cx + 8.5, 395, -0.4);

      // Walkable Steel Gangplank from Pier onto Boardable Cruise Ferry Main Deck!
      const shipX = cx + 19, shipZ = 472;
      const shipDeckY = pierY + 1.8;
      this._addBox(shipX, this.OCEAN_WATER_Y + 1.6, shipZ, 12.0, 3.6, 36.0, this._materials.bossDark, true);
      this._addBox(shipX, shipDeckY - 0.2, shipZ, 11.4, 0.4, 34.0, this._materials.whiteWall, true);
      this._addBox(shipX, shipDeckY + 1.6, shipZ - 6.0, 9.0, 3.2, 14.0, this._materials.whiteWall, true);
      this._addBox(shipX, shipDeckY + 4.2, shipZ + 6.5, 8.6, 2.4, 7.5, this._materials.windowFrame, true);
      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 4.8, 10), this._materials.fireRed);
      funnel.position.set(shipX, shipDeckY + 4.8, shipZ - 11.0);
      this.scene.add(funnel);
      addStaircase(cx + 5.8, pierY, 472, 10, 2.8, shipDeckY - pierY, 8.0, 'east');
      this._addLootContainer(shipX - 1.5, shipDeckY - this.getTerrainHeight(shipX - 1.5, shipZ + 11.0) + 0.02, shipZ + 11.0, 'valuables', 'Cruise Liner Captain Safe');
      addSmokePlume(shipX, shipDeckY + 5.2, shipZ - 11.0, 1.35);

      this.pois.push({ name: 'CRUISE TERMINAL', x: cx, z: cz, color: '#26c6da', threat: 'medium' });
    }

    // 6. COASTAL LIGHTHOUSE (C7: -375, 372) — 12.8m Sea-Cliff Promontory, Accessible Gallery Stairs & High-Intensity Fresnel Lantern!
    {
      const cx = -375, cz = 372;
      const ly = this.getTerrainHeight(cx, cz);
      const tx = cx - 6.5, tz = cz + 6.5;
      // Stone cliff retaining buttress
      this._addBox(tx, ly - 1.4, tz, 11.5, 5.2, 11.5, this._materials.darkConcrete, true);
      this._addBox(tx, ly + 1.2, tz, 7.4, 2.4, 7.4, this._materials.darkConcrete, true);
      for (let b = 0; b < 6; b++) {
        const rBot = 2.8 - b * 0.16;
        const rTop = 2.8 - (b + 1) * 0.16;
        const bandMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(rTop, rBot, 3.8, 14),
          (b % 2 === 0) ? this._materials.whiteWall : this._materials.fireRed
        );
        bandMesh.position.set(tx, ly + 2.4 + b * 3.8 + 1.9, tz);
        this.scene.add(bandMesh);
      }
      this.colliders.push({ minX: tx - 3.0, maxX: tx + 3.0, minY: ly, maxY: ly + 26, minZ: tz - 3.0, maxZ: tz + 3.0 });
      // Walkable mid-level Cliffside Observation Platform (+8.2m) wrapped around Lighthouse base!
      this._addBox(tx, ly + 8.2, tz, 9.4, 0.4, 9.4, this._materials.metal, true);
      addStaircase(tx + 4.4, ly, tz - 4.2, 18, 2.0, 4.2, 7.5, 'south');
      this._addBox(tx + 4.4, ly + 4.1, tz + 4.4, 2.8, 0.35, 2.8, this._materials.metal, true);
      addStaircase(tx + 3.2, ly + 4.2, tz + 4.4, 18, 2.0, 4.1, 7.5, 'west');

      const lantern = new THREE.Mesh(
        new THREE.CylinderGeometry(1.75, 1.75, 2.8, 12),
        new THREE.MeshBasicMaterial({ color: 0xfff5bd })
      );
      lantern.position.set(tx, ly + 26.6, tz);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.9, 12), this._materials.bossDark);
      cap.position.set(tx, ly + 28.8, tz);
      this.scene.add(lantern, cap);
      this.registerLightSource(lantern.position, { intensity: 1.25, maxDist: 340, flareScale: 1.25, anamorphic: true, ghosts: true });

      this._addBuilding(cx + 6.5, cz - 3.5, 12, 9.5, 4.0, 'north', this._materials.wood, (by) => {
        addDeskProp(cx + 9.2, by + 0.16, cz - 5.8);
      });
      addPitchedRoof(cx + 6.5, ly + 4.25, cz - 3.5, 12.6, 10.0, 1.8, this._materials.rustRed, true);
      this._addLootContainer(cx + 9.4, 0.16, cz - 1.2, 'valuables', 'Lighthouse Keeper Chest');
      this._addLootContainer(cx + 3.2, 0.16, cz - 5.8, 'household', 'Keeper Wardrobe');
      this._addWorkbenchTable(cx + 3.5, cz - 1.0, 0, [
        { id: 'nature_photo', qty: 1 }, { id: 'ancient_coin', qty: 1 }, { id: 'tools', qty: 1 }
      ]);
      this.pois.push({ name: 'LIGHTHOUSE', x: cx, z: cz, color: '#ffee58', threat: 'low' });
    }

    // 7. VOSTOK CITY CENTER (G2: 248, -368) — 3-Story Brutalist Command Tower, L-Shape Arcade Apartments & Obelisk Plaza
    {
      const cx = 248, cz = -368;
      const cy = this.getTerrainHeight(cx, cz);
      const hqx = cx + 10, hqz = cz - 10;
      const hqY = this.getTerrainHeight(hqx, hqz);
      const f1H = 4.2, f2H = 4.0;
      const f2Base = hqY + f1H;
      const f3Base = f2Base + f2H;
      this.bossSpawnPos = new THREE.Vector3(hqx - 3.0, f2Base + 0.30, hqz + 2.5);
      this.bossGuardSpawns = [
        new THREE.Vector3(hqx + 4.0, hqY + 0.25, hqz + 3.0),
        new THREE.Vector3(cx - 6.0, cy + 0.25, cz + 6.0),
        new THREE.Vector3(hqx - 3.0, f2Base + 0.30, hqz - 3.5)
      ];
      this._addBuilding(hqx, hqz, 22, 18, f1H + f2H, 'west', this._materials.bossDark, (by) => {
        this._addPartition(hqx + 2.0, hqz - 9.0, hqx + 2.0, hqz - 1.0, by, f1H, [
          { at: hqz - 5.0, w: 1.8, door: 'steel', label: 'Command Armory Door' }
        ]);
        this._addPartition(hqx + 2.0, hqz - 1.0, hqx + 11.0, hqz - 1.0, by, f1H, []);
        this._addLootContainer(hqx + 6.8, 0.16, hqz - 5.2, 'boss_key_room', 'Vostok Command Vault [KEY ROOM]', 'boss_key');
        this._addBox(hqx + 3.2, f2Base - 0.15, hqz, 15.2, 0.32, 17.4, this._materials.darkConcrete, true);
        addStaircase(hqx - 6.8, by + 0.16, hqz + 6.8, 16, 2.4, f1H - 0.16, 10.5, 'north');
        // Second flight up to Accessible 3F Sandbagged Roof Sniper Deck!
        addStaircase(hqx + 8.5, f2Base + 0.04, hqz - 7.0, 16, 2.2, f2H + 0.2, 10.5, 'south');
        addDeskProp(hqx + 5.5, f2Base + 0.02, hqz + 4.2);
      });
      // 3F Command Tower Rooftop Parapet Walls & Sandbags
      this._addBox(hqx, f3Base + 0.65, hqz - 8.8, 22.0, 1.0, 0.45, this._materials.darkConcrete, true);
      this._addBox(hqx, f3Base + 0.65, hqz + 8.8, 22.0, 1.0, 0.45, this._materials.darkConcrete, true);
      this._addSignBoard(hqx - 11.4, hqY + 5.4, hqz, 8.6, 2.4, -Math.PI / 2, {
        title: 'VOSTOK CITY',
        sub: 'MUNICIPAL COMMAND // RESTRICTED',
        bg: '#1c1818',
        accent: '#ffc107'
      });
      this._addLootContainer(hqx + 6.5, f1H + 0.04, hqz + 5.8, 'valuables', 'Commander Warlord Safe');
      this._addLootContainer(hqx - 5.0, f1H + f2H + 0.35, hqz + 2.0, 'military', '3F Rooftop Sniper Case');
      this._addGunLocker(hqx - 2.0, hqz - 7.2, 0, 'military', 'Garrison HQ Gun Locker');

      // 2-Story Apartment Block
      this._addBuilding(cx - 12, cz + 14, 18, 13, 7.8, 'north', this._materials.concrete, (by, bh) => {
        this._addPartition(cx - 12, cz + 7.5, cx - 12, cz + 20.5, by, 4.0, [
          { at: cz + 14, w: 1.7, door: 'wood', label: 'Apartment Hallway' }
        ]);
        this._addBox(cx - 12 + 2.4, by + 3.9, cz + 14, 12.6, 0.30, 12.4, this._materials.darkConcrete, true);
        addStaircase(cx - 19.0, by + 0.16, cz + 18.0, 15, 2.0, 3.85, 7.6, 'north');
      });
      this._addLootContainer(cx - 17.2, 0.16, cz + 16.5, 'household', 'City Apartment Cupboard');
      this._addLootContainer(cx - 6.8, 4.10, cz + 16.5, 'office', '2F Municipal Tax Office Cabinet');
      this._addWorkbenchTable(cx - 16.5, cz + 10.5, 0, [
        { id: 'family_photo', qty: 1 }, { id: 'pure_silver', qty: 1 }, { id: 'clothes', qty: 2 }
      ]);

      this._addBuilding(118, -355, 14, 12, 4.8, 'east', this._materials.interiorPlaster, () => {});
      this._addLootContainer(118 - 3.8, 0.16, -355 - 3.2, 'hospital', 'City Pharmacy Cabinet');
      this._addLootContainer(118 - 3.8, 0.16, -355 + 3.2, 'household', 'Riverfront Flat Closet');

      // Central Soviet Monument Obelisk + Plaza Floodlights
      this._addBox(cx - 8, cy + 0.6, cz - 4, 4.6, 1.2, 4.6, this._materials.darkConcrete, true);
      this._addBox(cx - 8, cy + 4.4, cz - 4, 1.4, 7.6, 1.4, this._materials.concrete, true);
      addFloodlight(cx - 4, cz + 2, 0.7, 10.5, 0xffe4aa);
      addWreckedVehicle(cx - 18, cz - 6, 0.55, true, true);
      this.pois.push({ name: 'VOSTOK CITY', x: cx, z: cz, color: '#ffc107', threat: 'boss' });
    }

    // 8. SOUTH VOSTOK INDUSTRIAL CONSTRUCTION (G3: 252, -225) — 3-Level Open-Frame Concrete Tower + 34m Aviation Crane + Twin Silos!
    {
      const cx = 252, cz = -225;
      const iy = this.getTerrainHeight(cx, cz);
      this._addBox(cx, iy + 0.12, cz, 22, 0.24, 18, this._materials.darkConcrete, false);
      // 2F (+4.4m) and 3F (+8.8m) Poured Concrete Construction Decks connected by Builder Stairs!
      this._addBox(cx + 2.5, iy + 4.4, cz, 16.5, 0.35, 17.5, this._materials.concrete, true);
      this._addBox(cx + 2.5, iy + 8.8, cz, 15.5, 0.35, 16.5, this._materials.concrete, true);
      // Center concrete elevator shaft core + columns
      this._addBox(cx + 6.5, iy + 5.5, cz - 5.5, 3.6, 11.0, 3.6, this._materials.darkConcrete, true);
      for (const px of [cx - 9.5, cx, cx + 9.5]) {
        for (const pz of [cz - 7.8, cz, cz + 7.8]) {
          this._addBox(px, iy + 6.2, pz, 0.75, 12.4, 0.75, this._materials.bossDark, true);
        }
      }
      // Hazard orange construction safety railings on 2F & 3F edges
      this._addBox(cx + 2.5, iy + 9.45, cz + 8.0, 15.2, 0.9, 0.18, this._materials.hazardAmber, false);
      this._addBox(cx + 2.5, iy + 5.05, cz - 8.4, 15.2, 0.9, 0.18, this._materials.hazardAmber, false);
      addStaircase(cx - 8.2, iy + 0.2, cz + 6.5, 16, 2.8, 4.35, 11.0, 'north');
      addStaircase(cx + 9.2, iy + 4.55, cz - 6.0, 16, 2.6, 4.35, 11.0, 'south');
      this._addLootContainer(cx + 6.2, 4.58, cz - 2.0, 'supply', '2F Deck Requisition Crate');
      this._addLootContainer(cx - 2.2, 9.0, cz + 2.5, 'military', '3F Roof Overlook Weapons Case');
      this._addWorkbenchTable(cx + 5.5, cz + 4.8, 0, [
        { id: 'carbon_fibre_sample', qty: 1 }, { id: 'metallic_alloy', qty: 2 }, { id: 'tools', qty: 2 }
      ], 4.58);

      // 34m Tower Crane with registered Aviation Warning Light
      const crX = cx - 16, crZ = cz - 14;
      const crY = this.getTerrainHeight(crX, crZ);
      this._addBox(crX, crY + 1.0, crZ, 5.2, 2.0, 5.2, this._materials.darkConcrete, true);
      this._addBox(crX, crY + 17.5, crZ, 2.2, 33.0, 2.2, this._materials.hazardAmber, true);
      this._addBox(crX + 11.0, crY + 34.2, crZ, 34.0, 1.4, 1.6, this._materials.hazardAmber, false);
      this._addBox(crX - 6.5, crY + 33.8, crZ, 3.6, 2.2, 2.4, this._materials.darkConcrete, false);
      this.registerLightSource(new THREE.Vector3(crX + 27.0, crY + 35.0, crZ), { intensity: 0.90, maxDist: 260, flareScale: 0.80 });

      this._addBuilding(cx + 15, cz + 14, 12, 8.5, 3.8, 'west', this._materials.rustBlue, (by) => {
        addDeskProp(cx + 17.5, by + 0.16, cz + 12.2);
      });
      this._addSignBoard(cx + 9.0, iy + 3.4, cz + 14, 7.6, 2.2, -Math.PI / 2, {
        title: 'S. VOSTOK IND.',
        sub: 'CONSTRUCTION SECTOR // BLOCK 03',
        bg: '#262116',
        accent: '#ff9800'
      });
      this._addLootContainer(cx + 17.8, 0.16, cz + 16.2, 'office', 'Foreman Blueprints & Ledger');
      this._addLootContainer(cx - 2.5, 0.24, cz - 4.5, 'supply', 'Industrial Materials Crate');
      for (const szOff of [-6, 2]) {
        const silo = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 12.0, 12), this._materials.concrete);
        silo.position.set(cx - 17, iy + 6.0, cz + 12 + szOff);
        this.scene.add(silo);
      }
      this._addBox(cx - 17, iy + 12.2, cz + 10, 1.6, 0.5, 10.5, this._materials.metal, false);
      addFloodlight(cx - 13, cz - 4, 0, 10.5, 0xffd89c);
      this.pois.push({ name: 'S. VOSTOK IND.', x: cx, z: cz, color: '#ff9800', threat: 'medium' });
    }

    // 9. VOSTOK QUARRY (C2: -400, -395) — 3-Tier Sunken Open-Pit Excavation (Rim 10.5m -> Bench 6.6m -> Dry Floor 2.8m)!
    {
      const cx = -400, cz = -395;
      // Pit Floor Structures (r <= 17, groundY ~ 2.8m): Crusher Conveyor Base, Quarried Granite Monoliths & Floodlight
      this._addBox(cx + 4, this.getTerrainHeight(cx + 4, cz + 2) + 1.5, cz + 2, 4.8, 3.0, 4.2, this._materials.darkConcrete, true);
      this._addBox(cx - 5, this.getTerrainHeight(cx - 5, cz - 4) + 1.4, cz - 4, 4.2, 2.8, 3.6, this._materials.concrete, true);
      addWreckedVehicle(cx + 4, cz + 10, -0.4, true, false);
      this._addLootContainer(cx - 5, 0.05, cz + 4, 'supply', 'Quarry Pit Excavation Crate');

      // Mid Bench Structures (r ~ 24, groundY ~ 6.6m): Tall Ore Crusher Tower + Inclined Steel Conveyor into Pit!
      const crX = cx - 22, crZ = cz - 10;
      const crBaseY = this.getTerrainHeight(crX, crZ);
      this._addBox(crX, crBaseY + 4.8, crZ, 8.8, 9.6, 8.8, this._materials.rustRed, true);
      this._addBox(crX, crBaseY + 10.2, crZ, 9.8, 1.4, 9.8, this._materials.bossDark, true);
      const conv = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 22.0), this._materials.metal);
      conv.position.set(crX + 7.5, crBaseY + 3.2, crZ + 5.5);
      conv.rotation.set(0.26, -0.58, 0);
      this.scene.add(conv);

      // Upper Rim Bench Buildings (r = 38.8, flat 10.5m outer plateau): Quarry Assay & Blasting Control Complex
      const qBx = cx + 38, qBz = cz - 8;
      const qRimY = this.getTerrainHeight(qBx, qBz);
      this._addBuilding(qBx, qBz, 14, 11, 4.4, 'south', this._materials.bossDark, (by) => {
        addDeskProp(qBx + 3.2, by + 0.16, qBz - 2.5);
      });
      this._addSignBoard(qBx, qRimY + 4.2, qBz + 5.8, 7.6, 2.2, 0, {
        title: 'VOSTOK QUARRY',
        sub: 'EXCAVATION & BLASTING // SECTOR C2',
        bg: '#241e1a',
        accent: '#ef5350'
      });
      this._addLootContainer(qBx + 3.2, 0.16, qBz + 2.2, 'valuables', 'Quarry Assay Bullion Safe');
      this._addLootContainer(qBx - 3.6, 0.16, qBz - 2.5, 'military', 'Blasting Magazine Case');
      this._addMetalShelf(qBx - 3.2, qBz + 2.4, 0, [
        { id: 'heavy_gunpowder', qty: 2 }, { id: 'reactive_metals', qty: 1 }, { id: 'pure_silver', qty: 1 }
      ]);
      addFloodlight(cx - 28, cz + 22, 0.5, 11.5, 0xffe4aa);
      addFloodlight(cx + 28, cz + 18, -0.5, 11.5, 0xffe4aa);
      this.pois.push({ name: 'QUARRY', x: cx, z: cz, color: '#ef5350', threat: 'medium' });
    }

    // 10-15. COMPOUNDS ALPHA - FOXTROT
    buildGuardedCompound('ALPHA',   'G1.5',  242, -485);
    buildGuardedCompound('BRAVO',   'D2',   -232, -395);
    buildGuardedCompound('CHARLIE', 'H5',    402,   80);
    buildGuardedCompound('DELTA',   'B3',   -520, -240);
    buildGuardedCompound('ECHO',    'C5',   -392,   80);
    buildGuardedCompound('FOXTROT', 'E7',    -82,  380);

    // === 4 ROADSIDE STRIP-TOWNS (Houses + % Chance of Small Clinic, Police Station, or Fire Station!) ===
    buildRoadsideStripTown(-390, -80, true);   // West Highway Strip-Town (C4)
    buildRoadsideStripTown(-235, 225, true);   // SW Coastal Road Strip-Town (D6)
    buildRoadsideStripTown( 248, -75, true);   // East Arterial Strip-Town (G4)
    buildRoadsideStripTown( 155, 245, false);  // SE Oceanfront Strip-Town (F6)

    // === BATTLE-SCARRED VOSTOK LANDSCAPE: Downed Helicopters, Burned-Out Convoys, Casualties & Fallen Trees ===
    addDownedHelicopter(-125, -185, -0.75, 'Downed NATO Blackhawk');
    addDownedHelicopter( 335,  -85,  1.15, 'Downed Vostok Mi-8');
    addDownedHelicopter( -15,  255,  0.35, 'Coastal Evac Chopper');

    const battleVehicles = [
      [-115,  -80,  0.12, true,  true],
      [  25,   82, -0.25, false, false],
      [-310,  305,  0.85, false, false],
      [  85,  392,  0.18, true,  true],
      [ 325,  245, -0.65, false, false],
      [-315, -395,  0.05, true,  false],
      [ 168, -352,  0.08, false, false]
    ];
    for (const [vx, vz, vrot, isApc, smk] of battleVehicles) {
      addWreckedVehicle(vx, vz, vrot, isApc, smk);
    }

    const evacSites = [
      [-132, -74, 0.4], [92, 386, -0.5], [-485, 82, 0.2],
      [228, 392, 0.9], [230, -355, -0.3], [-242, 212, 0.6]
    ];
    for (const [ex, ez, erot] of evacSites) {
      addFallenCasualtyAndEvac(ex, ez, erot);
    }

    const fallenLogs = [
      [-310, -210, 0.4], [-175, -245, 1.2], [-165, 65, -0.5], [175, -135, 0.8],
      [335, -215, -0.3], [325, 185, 1.0], [-315, 165, 0.2], [45, -215, -0.9],
      [-455, -145, 0.7], [175, 145, -0.4], [-145, 295, 1.1], [385, -335, 0.5]
    ];
    for (const [lx, lz, lrot] of fallenLogs) {
      addFallenPineLog(lx, lz, lrot);
    }

    this._spawnLogicalLooseLoot();

    // === ZAVOD-9 MOUNTAIN FORTRESS (NW alpine corner, built into the mountainside) ===
    // Stepped brutalist block + enclosed service elevator: Koschei-style transfer into the separate ZAVOD-9 match.
    this._addSovietBrutalistBlock(-545, -470, 46, 18, 6);
    this._addServiceElevator(-540, -455);
    this.pois.push({ name: 'ZAVOD-9 COMPLEX', x: -540, z: -468, color: '#ff5252', threat: 'extreme' });
    this._addLootContainer(-528, 0.16, -456, 'military', 'Zavod-9 Perimeter Arms Crate');
    this._addLootContainer(-551, 0.16, -455, 'hospital', 'Zavod-9 Gate Medical Cabinet');

    // === 4 VOSTOK EXTRACTION ZONES ===
    this._addExtractZone('NW MOUNTAIN HELIPAD', -485, -445, 6.5);
    this._addExtractZone('EAST TAIGA CHECKPOINT', 465, -185, 6.5);
    this._addExtractZone('SW COASTAL CONVOY', -455, 285, 6.5);
    this._addExtractZone('SOUTH BEACH EVAC BOAT', 365, 435, 6.5);

    // === RANDOMIZED OUTER PERIMETER SPAWNS (16) + 5 INNER POI SPAWNS ===
    this.operatorSpawns = [];
    this.perimeterSpawns = [];
    this.innerPoiSpawns = [];
    const ensureDrySpawn = (sx, sz) => {
      let cx = sx;
      let cz = sz;
      for (let step = 0; step < 26; step++) {
        const outD = this.getOutOfBoundsDist(cx, cz);
        const wD = this.getWaterDepth(cx, cz);
        const oD = this._oceanDist(cx, cz);
        const inDam = this.DAM_BOUNDS && cx >= this.DAM_BOUNDS.minX - 12 && cx <= this.DAM_BOUNDS.maxX + 12 && cz >= this.DAM_BOUNDS.minZ - 12 && cz <= this.DAM_BOUNDS.maxZ + 12;
        if (outD < -24 && wD <= 0.03 && oD < -12 && !inDam) break;
        const targetX = cx < -40 ? -310 : 240;
        const targetZ = cz < -180 ? -280 : (cz > 280 ? 290 : 40);
        const dx = targetX - cx;
        const dz = targetZ - cz;
        const dLen = Math.hypot(dx, dz) || 1;
        cx += (dx / dLen) * 20;
        cz += (dz / dLen) * 20;
      }
      return new THREE.Vector3(Math.round(cx), this.getTerrainHeight(cx, cz), Math.round(cz));
    };

    const outerPerimCandidates = [
      [-515, -485], [-345, -505], [-195, -475], [185, -510],
      [335, -475],  [475, -365],  [485, -125],  [475,  145],
      [445,  325],  [335,  425],  [ 25,  425],  [-195, 425],
      [-425, 395],  [-485, 225],  [-555,  -25], [-555, -335]
    ];
    for (const [sx, sz] of outerPerimCandidates) {
      const sp = ensureDrySpawn(sx, sz);
      this.perimeterSpawns.push(sp);
      this.operatorSpawns.push(sp);
    }

    const fiveInnerPoiSpawns = [
      [-195,  -65], // 1. Inner Spawn: East of TV Broadcast Station (D4)
      [ 145,   95], // 2. Inner Spawn: East of Vostok Superstore (F5)
      [ 208, -218], // 3. Inner Spawn: West approach to S. Vostok Industrial (G3)
      [-345,   85], // 4. Inner Spawn: East approach to Compound Echo (C5)
      [-195,  225]  // 5. Inner Spawn: Central-SW Strip-Town Crossroads (D6)
    ];
    for (const [ix, iz] of fiveInnerPoiSpawns) {
      const isp = ensureDrySpawn(ix, iz);
      this.innerPoiSpawns.push(isp);
      this.operatorSpawns.push(isp);
    }

    this.spawnPoints = this.pois.map((p) => {
      const sp = ensureDrySpawn(p.x + 16, p.z + 16);
      return new THREE.Vector3(sp.x, this.getTerrainHeight(sp.x, sp.z), sp.z);
    });
  }
  getSurfaceHeightAt(x, z, referenceY = null) {
    // Sample a small 4-corner footprint so items on sloped hills never clip one end into the terrain!
    const t0 = this.getTerrainHeight(x, z);
    const t1 = this.getTerrainHeight(x + 0.20, z);
    const t2 = this.getTerrainHeight(x - 0.20, z);
    const t3 = this.getTerrainHeight(x, z + 0.20);
    const t4 = this.getTerrainHeight(x, z - 0.20);
    const terrainY = Math.max(t0, t1, t2, t3, t4);
    let bestY = terrainY;
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
        if (c.maxY > bestY) {
          if (referenceY !== null) {
            if (c.maxY <= referenceY + 0.55) bestY = c.maxY;
          } else if (c.maxY - terrainY <= 1.2) {
            bestY = c.maxY;
          }
        }
      }
    }
    return bestY;
  }

  spawnGroundItem(id, qty = 1, pos = new THREE.Vector3(0, 0.02, 0), opts = {}) {
    const def = GAME_DATA.ITEMS[id];
    if (!def) return null;

    let finalMods = opts.mods;
    let finalRarity = opts.rarityOverride || null;
    if (def.type === 'weapon') {
      if (finalMods === undefined || finalMods === null) {
        if (GAME_DATA.rollRandomAttachmentsForRarity) {
          const rolled = GAME_DATA.rollRandomAttachmentsForRarity(id, finalRarity || def.rarity);
          finalMods = rolled.mods;
          finalRarity = rolled.rarity;
        } else {
          finalMods = {};
        }
      } else if (GAME_DATA.getWeaponRarityAndValue) {
        finalRarity = GAME_DATA.getWeaponRarityAndValue(id, finalMods).rarity;
      }
    }
    const rarKey = finalRarity || def.rarity || 'common';
    const rarInfo = (GAME_DATA.RARITIES && GAME_DATA.RARITIES[rarKey]) || { color: '#4caf50' };
    const rarColor = new THREE.Color(rarInfo.color);

    const g = new THREE.Group();
    const terrainY = this.getTerrainHeight(pos.x, pos.z);
    const yBase = opts.onSurface
      ? Math.max(pos.y !== undefined ? pos.y : terrainY, terrainY + 0.02)
      : (this.getSurfaceHeightAt(pos.x, pos.z, (pos.y !== undefined && pos.y > terrainY + 0.25) ? pos.y : null) + 0.02);
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
    ring.userData.keepOnGLTF = true;
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
        built = wb.buildThirdPersonWeapon(def, finalMods || {});
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

    // Upgrade eligible loose ground items with real 1K GLTF props asynchronously (keeping fallback visible if load fails)
    if (window.ModelSystem && window.ModelSystem.attachRealProp && def.type !== 'weapon') {
      const propKey =
        id === 'medkit' ? 'medical_box' :
        (id === 'bandage' || id === 'sterile_bandage') ? 'medical_tape' :
        def.type === 'ammo' ? 'ammo_box' :
        (id === 'fuel_can' || id === 'cleaning_supplies' || id === 'basic_chemicals') ? 'plastic_jerrycan' :
        (id === 'gunpowder' || id === 'heavy_gunpowder' || id === 'reactive_compounds') ? 'oil_tin' :
        (id === 'exp_radio_transmitter' || id === 'black_box') ? 'vintage_radio_transceiver' :
        id === 'gas_mask' ? 'old_gas_mask' :
        (id === 'antique_watch' || id === 'gold_watch') ? 'vintage_pocket_watch' :
        null;
      if (propKey) {
        const hMap = {
          plastic_jerrycan: 0.36,
          vintage_radio_transceiver: 0.28,
          old_gas_mask: 0.24,
          medical_box: 0.22,
          oil_tin: 0.22,
          ammo_box: 0.19,
          medical_tape: 0.14,
          vintage_pocket_watch: 0.12
        };
        window.ModelSystem.attachRealProp(g, propKey, hMap[propKey] || 0.22, 0, 0.01, true);
      }
    }

    this.scene.add(g);
    const entry = {
      uid: opts.uid || ('gi_' + Math.random().toString(36).slice(2, 9)),
      id,
      qty,
      mods: finalMods || null,
      mag: opts.mag !== undefined ? opts.mag : undefined,
      rarityOverride: finalRarity || null,
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
    const terrainY = this.getTerrainHeight(pos.x, pos.z);
    const yBase = this.getSurfaceHeightAt(pos.x, pos.z, (pos.y !== undefined && pos.y > terrainY + 0.25) ? pos.y : null) + 0.02;
    g.position.set(pos.x, yBase, pos.z);
    g.rotation.y = Math.random() * Math.PI * 2;

    const packMat = new THREE.MeshLambertMaterial({ color: 0x3a2f24 });
    const strapMat = new THREE.MeshLambertMaterial({ color: 0x1c1e1d });
    const trimMat = new THREE.MeshBasicMaterial({ color: 0xffc107 });
    const recessMat = new THREE.MeshLambertMaterial({ color: 0x121412 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.34), packMat);
    body.position.y = 0.11;
    const recess = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.02, 0.28), recessMat);
    recess.position.set(0, 0.225, 0);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), strapMat);
    pocket.position.set(0, 0.10, 0.20);

    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.22, -0.17);
    const topFlap = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.045, 0.35), packMat);
    topFlap.position.set(0, 0.022, 0.17);
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.02), trimMat);
    tag.position.set(0, 0.05, 0.17);
    lidPivot.add(topFlap, tag);

    g.add(body, recess, pocket, lidPivot);
    this.scene.add(g);

    const legWpns = (GAME_DATA.LOOT_TABLES && GAME_DATA.LOOT_TABLES.boss_legendary_weapons) || ['ak74m', 'm24', 'm870'];
    const legPick = legWpns[Math.floor(Math.random() * legWpns.length)];
    const legId = typeof legPick === 'string' ? legPick : legPick.id;
    const rolledLeg = GAME_DATA.rollRandomAttachmentsForRarity
      ? GAME_DATA.rollRandomAttachmentsForRarity(legId, 'legendary')
      : { mods: {}, rarity: 'legendary' };
    const valuables = ['gold_watch', 'intel_drive', 'water_filter', 'fuel_can'].sort(() => Math.random() - 0.5);

    const items = [
      { id: 'boss_key', qty: 1, revealed: false },
      { id: legId, qty: 1, mods: rolledLeg.mods, rarityOverride: rolledLeg.rarity, revealed: false },
      { id: valuables[0], qty: 1, revealed: false },
      { id: valuables[1], qty: 1, revealed: false }
    ];

    const container = {
      id: 'boss_pack_' + this.lootContainers.length,
      name: `${bossName} Small Pack`,
      kind: 'boss',
      mesh: g,
      lid: { pivot: lidPivot, axis: 'x', angle: 0, target: 0, openAngle: -0.52, opened: false },
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
    const baseY = this.getTerrainHeight(x, z);
    const g = new THREE.Group();
    g.position.set(x, baseY + 0.16, z);
    g.rotation.y = rotY;

    const bodyMat = kind === 'police_fire'
      ? new THREE.MeshLambertMaterial({ color: 0x2f4352 })
      : new THREE.MeshLambertMaterial({ color: 0x354231 });
    const trimMat = new THREE.MeshLambertMaterial({ color: 0x1a1e1d });
    const recessMat = new THREE.MeshLambertMaterial({ color: 0x111412 });
    const handleMat = new THREE.MeshLambertMaterial({ color: 0xb0b8b4 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.05, 0.58), bodyMat);
    body.position.set(0, 1.025, -0.02);
    const recessL = new THREE.Mesh(new THREE.BoxGeometry(0.50, 1.88, 0.02), recessMat);
    recessL.position.set(-0.28, 1.025, 0.275);
    const doorR = new THREE.Mesh(new THREE.BoxGeometry(0.56, 2.02, 0.04), bodyMat);
    doorR.position.set(0.28, 1.025, 0.29);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.95, 0.04), trimMat);
    seam.position.set(0, 1.025, 0.30);
    const ventR = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.03), trimMat);
    ventR.position.set(0.28, 1.78, 0.312);
    const handleR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.06), handleMat);
    handleR.position.set(0.08, 1.05, 0.33);

    const doorPivotL = new THREE.Group();
    doorPivotL.position.set(-0.56, 1.025, 0.29);
    const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.56, 2.02, 0.04), bodyMat);
    doorL.position.set(0.28, 0, 0);
    const ventL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.03), trimMat);
    ventL.position.set(0.28, 0.755, 0.022);
    const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.06), handleMat);
    handleL.position.set(0.48, 0.025, 0.04);
    doorPivotL.add(doorL, ventL, handleL);

    g.add(body, recessL, doorR, seam, ventR, handleR, doorPivotL);
    this.scene.add(g);

    const w = Math.abs(Math.sin(rotY)) > 0.5 ? 0.65 : 1.15;
    const d = Math.abs(Math.sin(rotY)) > 0.5 ? 1.15 : 0.65;
    this.colliders.push({
      minX: x - w / 2, maxX: x + w / 2,
      minY: baseY + 0.16, maxY: baseY + 2.21,
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
      lid: { pivot: doorPivotL, axis: 'y', angle: 0, target: 0, openAngle: -0.60, opened: false },
      position: new THREE.Vector3(x, baseY + 1.15, z),
      items,
      requiresKey: null,
      unlocked: true,
      searched: false
    });
  }

  _addWallFirstAidKit(x, z, wallSide = 'north', customName = 'Wall First Aid Kit') {
    const baseY = this.getTerrainHeight(x, z);
    const g = new THREE.Group();
    const rotMap = { north: 0, south: Math.PI, west: Math.PI / 2, east: -Math.PI / 2 };
    g.position.set(x, baseY + 1.48, z);
    g.rotation.y = rotMap[wallSide] || 0;

    const kitMat = new THREE.MeshLambertMaterial({ color: 0xe2e8e4 });
    const recessMat = new THREE.MeshLambertMaterial({ color: 0x5c1a1a });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.15), kitMat);
    box.position.z = -0.015;
    const recess = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.36, 0.02), recessMat);
    recess.position.z = 0.062;

    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.21, 0.075);
    const frontLid = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.03), kitMat);
    frontLid.position.set(0, -0.21, 0);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xd93030 });
    const cH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.02), crossMat);
    const cV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.02), crossMat);
    cH.position.set(0, -0.21, 0.02);
    cV.position.set(0, -0.21, 0.02);
    lidPivot.add(frontLid, cH, cV);
    g.add(box, recess, lidPivot);
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
      lid: { pivot: lidPivot, axis: 'x', angle: 0, target: 0, openAngle: -0.65, opened: false },
      position: new THREE.Vector3(x, baseY + 1.48, z),
      items,
      requiresKey: null,
      unlocked: true,
      searched: false
    });
  }

  _addMedicineCabinet(x, z, wallSide = 'south', customName = 'Bathroom Medicine Cabinet') {
    const baseY = this.getTerrainHeight(x, z);
    const g = new THREE.Group();
    const rotMap = { north: 0, south: Math.PI, west: Math.PI / 2, east: -Math.PI / 2 };
    g.position.set(x, baseY + 1.52, z);
    g.rotation.y = rotMap[wallSide] || 0;

    // White cabinet frame + recessed dark interior + hinged mirror door
    const frameMat = new THREE.MeshLambertMaterial({ color: 0xd8deda });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.78, 0.15), frameMat);
    frame.position.z = -0.015;
    const recess = new THREE.Mesh(
      new THREE.BoxGeometry(0.60, 0.66, 0.02),
      new THREE.MeshLambertMaterial({ color: 0x1b2226 })
    );
    recess.position.z = 0.062;

    const lidPivot = new THREE.Group();
    lidPivot.position.set(-0.31, 0, 0.08);
    const doorBacking = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.70, 0.025), frameMat);
    doorBacking.position.set(0.31, 0, 0);
    const mirror = new THREE.Mesh(
      new THREE.BoxGeometry(0.60, 0.66, 0.02),
      new THREE.MeshLambertMaterial({ color: 0x8fb0bf })
    );
    mirror.position.set(0.31, 0, 0.015);
    lidPivot.add(doorBacking, mirror);

    // Sink vanity below cabinet
    const sink = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.16, 0.44),
      new THREE.MeshLambertMaterial({ color: 0xcfd4d0 })
    );
    sink.position.set(0, -0.68, 0.16);
    g.add(frame, recess, lidPivot, sink);
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
      lid: { pivot: lidPivot, axis: 'y', angle: 0, target: 0, openAngle: -0.68, opened: false },
      position: new THREE.Vector3(x, baseY + 1.52, z),
      items,
      requiresKey: null,
      unlocked: true,
      searched: false
    });
  }

  _addMetalShelf(x, z, rotY = 0, lootItems = []) {
    const g = new THREE.Group();
    const floorY = this.getTerrainHeight(x, z) + 0.16;
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

  _addWorkbenchTable(x, z, rotY = 0, lootItems = [], floorYOffset = 0.16) {
    const floorY = this.getTerrainHeight(x, z) + floorYOffset;
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
    this._addWorkbenchTable(-125.0, -76.0, 0, [
      { id: 'sterile_bandage', qty: 1 }, { id: 'brass_casings', qty: 2 }
    ], 0);
    this._addWorkbenchTable(92.0, 384.0, Math.PI / 2, [
      { id: 'syringe', qty: 1 }, { id: 'gunpowder', qty: 2 }
    ], 0);
    this._addWorkbenchTable(162.0, -348.0, 0, [
      { id: 'classified_documents', qty: 1 }, { id: 'ammo_545', qty: 24 }
    ], 0);
    this._addWorkbenchTable(-315.0, -388.0, Math.PI / 2, [
      { id: 'armor_plate', qty: 2 }, { id: 'kevlar_padding', qty: 1 }
    ], 0);
    this._addWorkbenchTable(330.0, 240.0, 0, [
      { id: 'medkit', qty: 1 }, { id: 'tools', qty: 1 }
    ], 0);
  }

  setGraphicsOptions(gfx = {}) {
    const lod = gfx.lod ?? 3; // 1..4
    const lighting = gfx.lighting ?? 3; // 1..4
    const lodFrac = lod === 1 ? 0.35 : (lod === 2 ? 0.62 : (lod === 3 ? 0.85 : 1.0));
    if (this._pineMeshes && this._maxPines) {
      this._pineMeshes.forEach((m) => {
        const maxC = (m.userData && m.userData.maxCount) || this._maxPines;
        m.count = Math.max(20, Math.round(maxC * lodFrac));
      });
    }
    if (this._bushInst && this._maxBushes) {
      this._bushInst.count = Math.max(80, Math.round(this._maxBushes * lodFrac));
    }
    if (this._fernInst && this._maxFerns) {
      this._fernInst.count = Math.max(40, Math.round(this._maxFerns * lodFrac));
    }
    if (this.fogLayers) {
      const showMist = lighting >= 2;
      this.fogLayers.forEach(fl => { fl.mesh.visible = showMist; });
    }
  }

  openContainer(cOrId) {
    const c = (typeof cOrId === 'string')
      ? this.lootContainers.find(x => x.id === cOrId)
      : cOrId;
    if (!c || !c.lid) return false;
    c.opened = true;
    const lid = c.lid;
    if (lid.opened) return false;
    lid.opened = true;
    lid.target = lid.openAngle;
    if (!this._animLids.includes(lid)) {
      this._animLids.push(lid);
    }
    return true;
  }

  update(dt, time, playerPos = null) {
    // Poll overhead roof/ceiling every 0.25s to drive indoor room reverb & wind attenuation
    if (playerPos) {
      this._indoorTimer += dt;
      if (this._indoorTimer >= 0.25) {
        this._indoorTimer = 0;
        this._indoorOrigin.set(playerPos.x, Number.isFinite(playerPos.y) ? playerPos.y : 1.7, playerPos.z);
        const nextIndoor = !!this.raycastWorld(this._indoorOrigin, this._indoorUp, 0.05, 25, { wallsOnly: true });
        if (nextIndoor !== this.isIndoors) {
          this.isIndoors = nextIndoor;
          if (window.soundEngine && window.soundEngine.setIndoor) {
            try { window.soundEngine.setIndoor(nextIndoor); } catch (e) {}
          }
        }
      }
    }
    // Animate container lids / doors swinging slightly ajar when looted
    if (this._animLids && this._animLids.length > 0) {
      for (let i = this._animLids.length - 1; i >= 0; i--) {
        const lid = this._animLids[i];
        const diff = lid.target - lid.angle;
        if (Math.abs(diff) < 0.005) {
          lid.angle = lid.target;
          lid.pivot.rotation[lid.axis] = lid.angle;
          this._animLids.splice(i, 1);
        } else {
          lid.angle += diff * Math.min(1, dt * 7.5);
          lid.pivot.rotation[lid.axis] = lid.angle;
        }
      }
    }
    // Keep procedural skybox dome centered on player & animate drifting clouds
    if (this.skyDome) {
      if (playerPos) {
        this.skyDome.position.set(playerPos.x, 0, playerPos.z);
      }
      if (this.skyDome.material && this.skyDome.material.uniforms && this.skyDome.material.uniforms.uTime) {
        this.skyDome.material.uniforms.uTime.value = time;
      }
    }
    // Animate rising Vostok battlefield smoke plumes trailing into the sky!
    if (this.smokePlumes && this.smokePlumes.length > 0) {
      for (let i = 0; i < this.smokePlumes.length; i++) {
        const pl = this.smokePlumes[i];
        const maxRise = 44 * pl.scale;
        for (let j = 0; j < pl.puffs.length; j++) {
          const pf = pl.puffs[j];
          const cyc = (time * 0.085 + pf.phase + i * 0.13) % 1.0;
          pf.sprite.position.y = pl.y + 1.8 + cyc * maxRise;
          pf.sprite.position.x = pl.x + Math.sin(time * 0.4 + j + i) * (1.5 + cyc * 6.5) + cyc * 8.0;
          pf.sprite.position.z = pl.z + Math.cos(time * 0.35 + j) * (1.2 + cyc * 4.5) - cyc * 4.0;
          const sc = pf.baseScale * (0.65 + cyc * 1.15);
          pf.sprite.scale.set(sc, sc, 1);
          pf.sprite.material.opacity = Math.sin(cyc * Math.PI) * 0.42;
        }
      }
    }
    // Gently drift volumetric valley mist layers
    if (this.fogLayers && this.fogLayers.length > 0) {
      for (let i = 0; i < this.fogLayers.length; i++) {
        const fl = this.fogLayers[i];
        fl.mesh.position.x = fl.baseX + Math.sin(time * 0.08 + fl.phase) * 18;
        fl.mesh.position.z = fl.baseZ + Math.cos(time * 0.06 + fl.phase) * 14;
      }
    }
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
    // Update deployed Munition Boxes (gentle toss settle + pulsing green resupply ring + TTL despawn)
    if (this.munitionBoxes && this.munitionBoxes.length > 0) {
      for (let i = this.munitionBoxes.length - 1; i >= 0; i--) {
        const mb = this.munitionBoxes[i];
        mb.ttl -= dt;
        if (mb.throwT < 1) {
          mb.throwT = Math.min(1, mb.throwT + dt * 3.2);
          const p = mb.throwT;
          mb.mesh.position.x = THREE.MathUtils.lerp(mb.startPos.x, mb.position.x, p);
          mb.mesh.position.z = THREE.MathUtils.lerp(mb.startPos.z, mb.position.z, p);
          mb.mesh.position.y = THREE.MathUtils.lerp(mb.startPos.y, mb.position.y, p) + Math.sin(p * Math.PI) * 0.65;
        }
        if (mb.ringMesh && mb.ringMesh.material) {
          mb.ringMesh.material.opacity = 0.42 + Math.sin(time * 3.6 + i) * 0.22;
        }
        if (mb.ttl <= 0) {
          if (this.scene && mb.mesh) this.scene.remove(mb.mesh);
          this.munitionBoxes.splice(i, 1);
        }
      }
    }
  }

  deployMunitionBox(originPos, forwardDir, ownerName = 'Operator') {
    const dir = (forwardDir && forwardDir.lengthSq() > 0.001) ? forwardDir.clone().normalize() : new THREE.Vector3(0, 0, -1);
    let tx = originPos.x + dir.x * 2.1;
    let tz = originPos.z + dir.z * 2.1;
    const baseY = Number.isFinite(originPos.y) ? originPos.y : this.getTerrainHeight(originPos.x, originPos.z);
    if (this.isWalkableForAI && !this.isWalkableForAI(tx, tz, baseY, 0.35)) {
      tx = originPos.x + dir.x * 0.95;
      tz = originPos.z + dir.z * 0.95;
    }
    const gy = this.getWalkHeightAt ? this.getWalkHeightAt(tx, tz, baseY) : this.getTerrainHeight(tx, tz);
    const landPos = new THREE.Vector3(tx, gy, tz);
    const startPos = new THREE.Vector3(originPos.x, baseY + 1.05, originPos.z);

    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3b4932 });
    const lidMat = new THREE.MeshLambertMaterial({ color: 0x2c3626 });
    const latchMat = new THREE.MeshLambertMaterial({ color: 0x1b1e1c });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xd9a838 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.34, 0.42), bodyMat);
    body.position.y = 0.17;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.71, 0.06, 0.45), lidMat);
    lid.position.y = 0.35;
    const latchL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.04), latchMat);
    latchL.position.set(-0.20, 0.28, 0.22);
    const latchR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.04), latchMat);
    latchR.position.set(0.20, 0.28, 0.22);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.055, 0.43), stripeMat);
    stripe.position.y = 0.20;
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.44, 0.56, 20),
      new THREE.MeshBasicMaterial({ color: 0x69f0ae, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.03;

    group.add(body, lid, latchL, latchR, stripe, ringMesh);
    group.position.copy(startPos);
    group.rotation.y = Math.atan2(dir.x, dir.z);
    if (this.scene) this.scene.add(group);

    const boxObj = {
      mesh: group,
      ringMesh,
      startPos,
      position: landPos,
      throwT: 0,
      ownerName,
      usedBy: new Set(),
      ttl: 90.0
    };
    this.munitionBoxes.push(boxObj);
    return boxObj;
  }

  // ============================================================================
  // 2.5D MULTI-FLOOR AI NAVIGATION & A* PATHFINDING (Buildings, Doors, Stairs!)
  // ============================================================================
  getWalkHeightAt(x, z, feetY = 0) {
    let support = this.getTerrainHeight(x, z);
    const list = this.getNearbyColliders ? this.getNearbyColliders(x, z, 0.75) : this.colliders;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.doorRef) continue;
      if (x + 0.16 >= c.minX && x - 0.16 <= c.maxX && z + 0.16 >= c.minZ && z - 0.16 <= c.maxZ) {
        // Walkable floor slab or stair step within step-up (+0.52m) of current feet
        if (c.maxY <= feetY + 0.52 && c.maxY > support) {
          support = c.maxY;
        }
      }
    }
    return support;
  }

  isWalkableForAI(x, z, feetY = 0, r = 0.40) {
    if (Math.abs(x) > this.mapHalfSize - 4 || Math.abs(z) > this.mapHalfSize - 4) return false;
    if (this.getOutOfBoundsDist && this.getOutOfBoundsDist(x, z) > -5) return false;
    if (this.isInDeepWater && this.isInDeepWater(x, z, feetY)) return false;
    const list = this.getNearbyColliders ? this.getNearbyColliders(x, z, r + 0.45) : this.colliders;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      // Unlocked doors are ALWAYS walkable for A* (AI automatically opens them on approach!)
      if (c.doorRef) {
        if (!c.doorRef.locked) continue;
      }
      // Allow smooth step-up onto stair steps & curbs (<= 0.48m above feet) and walking under 2nd-floor ceilings (>= 1.65m above feet)
      if (c.maxY <= feetY + 0.48) continue;
      if (c.minY >= feetY + 1.65) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        return false;
      }
    }
    return true;
  }

  _isSegmentWalkableForAI(ax, az, bx, bz, startY, r = 0.38) {
    const dist = Math.hypot(bx - ax, bz - az);
    if (dist < 0.2) return true;
    const steps = Math.max(2, Math.ceil(dist / 0.85));
    let curY = startY;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const sx = ax + (bx - ax) * t;
      const sz = az + (bz - az) * t;
      if (!this.isWalkableForAI(sx, sz, curY, r)) return false;
      curY = this.getWalkHeightAt(sx, sz, curY);
    }
    return true;
  }

  _findAStarSegment(startX, startY, startZ, goalX, goalY, goalZ, maxIter = 340) {
    // Cap long-distance segments (> 26m) to a 24m local horizon so A* ALWAYS completes cleanly around nearby buildings/trees!
    const rawDist = Math.hypot(goalX - startX, goalZ - startZ);
    if (rawDist > 26.0) {
      const f = 24.0 / rawDist;
      goalX = startX + (goalX - startX) * f;
      goalZ = startZ + (goalZ - startZ) * f;
      goalY = this.getWalkHeightAt(goalX, goalZ, startY);
      // If intermediate horizon point landed inside a solid wall/rock, nudge to nearest walkable point
      if (!this.isWalkableForAI(goalX, goalZ, goalY, 0.36)) {
        for (let rad = 2.0; rad <= 8.0; rad += 2.0) {
          let found = false;
          for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            const tx = goalX + Math.cos(ang) * rad;
            const tz = goalZ + Math.sin(ang) * rad;
            const ty = this.getWalkHeightAt(tx, tz, startY);
            if (this.isWalkableForAI(tx, tz, ty, 0.36)) {
              goalX = tx; goalY = ty; goalZ = tz;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
    }

    // Fast-path: if straight line is already completely clear, return goal immediately!
    if (this._isSegmentWalkableForAI(startX, startZ, goalX, goalZ, startY, 0.38)) {
      return [{ x: goalX, y: goalY, z: goalZ }];
    }

    const cell = 1.5;
    const sx = Math.round(startX / cell);
    const sz = Math.round(startZ / cell);
    const gx = Math.round(goalX / cell);
    const gz = Math.round(goalZ / cell);

    // Bounded 8-directional A* over spatial-hash walkability (navigates around walls, through doorways & inside rooms!)
    const keyOf = (x, z) => (x + 2048) * 4096 + (z + 2048);
    const startKey = keyOf(sx, sz);
    const open = [{ x: sx, z: sz, y: startY, g: 0, f: Math.hypot(gx - sx, gz - sz), key: startKey }];
    const gScore = new Map();
    const cameFrom = new Map();
    const closed = new Set();
    gScore.set(startKey, 0);

    let bestNode = open[0];
    let bestH = open[0].f;
    let reached = null;

    const dirs = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]
    ];

    let iter = 0;
    while (open.length > 0 && iter < maxIter) {
      iter++;
      // Pop lowest f-score node
      let bestIdx = 0;
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[bestIdx].f) bestIdx = i;
      }
      const cur = open[bestIdx];
      open[bestIdx] = open[open.length - 1];
      open.pop();

      if (closed.has(cur.key)) continue;
      closed.add(cur.key);

      const wx = cur.x * cell;
      const wz = cur.z * cell;
      const dGoal = Math.hypot(wx - goalX, wz - goalZ);
      if (dGoal <= 1.95) {
        reached = cur;
        break;
      }
      if (dGoal < bestH) {
        bestH = dGoal;
        bestNode = cur;
      }

      for (let d = 0; d < 8; d++) {
        const nx = cur.x + dirs[d][0];
        const nz = cur.z + dirs[d][1];
        const nKey = keyOf(nx, nz);
        if (closed.has(nKey)) continue;

        const nwx = nx * cell;
        const nwz = nz * cell;
        if (!this.isWalkableForAI(nwx, nwz, cur.y, 0.36)) continue;

        // Prevent diagonal corner-cutting through wall corners
        if (d >= 4) {
          if (!this.isWalkableForAI((cur.x + dirs[d][0]) * cell, wz, cur.y, 0.34)) continue;
          if (!this.isWalkableForAI(wx, (cur.z + dirs[d][1]) * cell, cur.y, 0.34)) continue;
        }

        const nextY = this.getWalkHeightAt(nwx, nwz, cur.y);
        if (Math.abs(nextY - cur.y) > 0.72) continue;

        const tentG = cur.g + dirs[d][2];
        const prevG = gScore.get(nKey);
        if (prevG === undefined || tentG < prevG) {
          gScore.set(nKey, tentG);
          cameFrom.set(nKey, cur);
          const h = Math.hypot(gx - nx, gz - nz) * 1.15;
          open.push({ x: nx, z: nz, y: nextY, g: tentG, f: tentG + h, key: nKey });
        }
      }
    }

    const endNode = reached || bestNode;
    if (!endNode || endNode.key === startKey) {
      return [{ x: goalX, y: goalY, z: goalZ }];
    }

    // Reconstruct raw grid path
    const raw = [];
    let p = endNode;
    while (p && p.key !== startKey) {
      raw.push({ x: p.x * cell, y: p.y, z: p.z * cell });
      p = cameFrom.get(p.key);
    }
    raw.reverse();
    if (reached && Math.hypot(raw[raw.length - 1].x - goalX, raw[raw.length - 1].z - goalZ) > 0.4) {
      raw.push({ x: goalX, y: goalY, z: goalZ });
    }

    // String-pulling path smoothing so AI walk in crisp straight lines through doorways & corridors
    if (raw.length <= 2) return raw;
    const smooth = [];
    let anchorX = startX, anchorY = startY, anchorZ = startZ;
    let idx = 0;
    while (idx < raw.length) {
      let furthest = idx;
      for (let j = Math.min(raw.length - 1, idx + 8); j > idx; j--) {
        if (this._isSegmentWalkableForAI(anchorX, anchorZ, raw[j].x, raw[j].z, anchorY, 0.40)) {
          furthest = j;
          break;
        }
      }
      const wp = raw[furthest];
      smooth.push(wp);
      anchorX = wp.x; anchorY = wp.y; anchorZ = wp.z;
      idx = furthest + 1;
    }
    return smooth;
  }

  findPath(startPos, goalPos, maxIter = 340) {
    if (!startPos || !goalPos) return [];
    const sy = Number.isFinite(startPos.y) ? startPos.y : this.getTerrainHeight(startPos.x, startPos.z);
    const gy = Number.isFinite(goalPos.y) ? goalPos.y : this.getTerrainHeight(goalPos.x, goalPos.z);

    // Multi-Floor Staircase Routing: if goal is on a different floor (deltaY > 1.8m), route via nearest connecting staircase!
    if (Math.abs(gy - sy) > 1.8 && this.staircases && this.staircases.length > 0) {
      const goingUp = gy > sy;
      let bestStair = null;
      let bestScore = Infinity;
      for (let i = 0; i < this.staircases.length; i++) {
        const st = this.staircases[i];
        const entry = goingUp ? st.bottomEntry : st.topExit;
        const exit = goingUp ? st.topExit : st.bottomEntry;
        // Must start near our current floor level
        if (Math.abs(entry.y - sy) > 2.2) continue;
        const dEntry = Math.hypot(entry.x - startPos.x, entry.z - startPos.z);
        const dExit = Math.hypot(exit.x - goalPos.x, exit.z - goalPos.z);
        if (dEntry < 38 && (dEntry + dExit) < bestScore) {
          bestScore = dEntry + dExit;
          bestStair = { entry, exit };
        }
      }
      if (bestStair) {
        const leg1 = this._findAStarSegment(startPos.x, sy, startPos.z, bestStair.entry.x, bestStair.entry.y, bestStair.entry.z, 220);
        const midX = (bestStair.entry.x + bestStair.exit.x) * 0.5;
        const midY = (bestStair.entry.y + bestStair.exit.y) * 0.5;
        const midZ = (bestStair.entry.z + bestStair.exit.z) * 0.5;
        leg1.push({ x: bestStair.entry.x, y: bestStair.entry.y, z: bestStair.entry.z });
        leg1.push({ x: midX, y: midY, z: midZ });
        leg1.push({ x: bestStair.exit.x, y: bestStair.exit.y, z: bestStair.exit.z });
        const leg2 = this._findAStarSegment(bestStair.exit.x, bestStair.exit.y, bestStair.exit.z, goalPos.x, gy, goalPos.z, 180);
        return leg1.concat(leg2);
      }
    }

    return this._findAStarSegment(startPos.x, sy, startPos.z, goalPos.x, gy, goalPos.z, maxIter);
  }
}
