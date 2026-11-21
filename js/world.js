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
    this.operatorSpawns = []; // Ring perimeter (250m apart) + intermittent low-threat POI infil points
    this.mapHalfSize = 620;   // Expanded 1240m x 1240m tactical sector (>=250m between POIs)
    this.skyDome = null;
    this.fogLayers = [];

    // Pre-registered flat terrain pads for every POI & extraction zone (smoothly leveled into the hills!)
    this._poiPads = [
      { x: 0, z: 0, r: 28, h: 1.5 },          // WAREHOUSE (Central Hub)
      { x: -320, z: -240, r: 30, h: 6.5 },    // COMPOUND (NW Military Base)
      { x: 340, z: 20, r: 26, h: 3.0 },       // CLINIC (East Meadow)
      { x: -260, z: 310, r: 26, h: 2.0 },     // POLICE/FIRE (SW Low-Threat Outpost)
      { x: 310, z: -270, r: 32, h: 9.5 },     // BOSS CAMP (NE Highland Fortress)
      { x: 270, z: 290, r: 26, h: 5.5 },      // RADIO OUTPOST (SE Low-Threat Hilltop)
      { x: -370, z: 50, r: 32, h: 0.5 },      // RAIL YARD (West Valley Depot)
      { x: -60, z: -340, r: 26, h: 10.0 },    // NORTH BUNKER (Northern Ridge)
      // Extraction pads
      { x: 0, z: -560, r: 16, h: 7.5 },
      { x: 560, z: -40, r: 16, h: 3.5 },
      { x: -560, z: 120, r: 16, h: 1.5 },
      { x: 40, z: 560, r: 16, h: 2.0 },
      // South Highway Checkpoint pad
      { x: 0, z: 320, r: 22, h: 2.0 }
    ];

    this._materials = this._createMaterials();
    this._buildSkybox();
    this._buildEnvironment();
    this._buildVolumetricFogLayers();
    this._buildMapLayout();
    this._buildForestAndFoliage();

    const spawnY = this.getTerrainHeight(0, 485);
    this.playerSpawn = new THREE.Vector3(0, spawnY + 1.7, 485);
  }

  // Deterministic rolling terrain heightfield with hills, ridges, creek valley & smooth POI plateaus
  getTerrainHeight(x, z) {
    // Broad rolling wasteland hills & elevated northern ridge
    const ridgeN = Math.max(0, (-z - 140) / 480) * 9.5;
    const h1 = Math.sin(x * 0.0068 + 0.4) * Math.cos(z * 0.0062 - 0.3) * 7.8;
    const h2 = Math.sin((x + z) * 0.0115) * 3.4 + Math.cos((x - z * 1.1) * 0.014) * 2.2;
    const h3 = Math.sin(x * 0.029) * Math.sin(z * 0.027) * 0.85;
    // Winding dry riverbed / ravine running SW -> E
    const creekCenterZ = 140 + Math.sin(x * 0.0075) * 95;
    const creekDist = Math.abs(z - creekCenterZ);
    const creekCarve = creekDist < 42 ? -Math.cos((creekDist / 42) * Math.PI * 0.5) * 3.8 : 0;

    let h = 2.4 + ridgeN + h1 + h2 + h3 + creekCarve;

    // Smoothly blend toward flat pads around POIs & Extraction Zones
    if (this._poiPads) {
      for (let i = 0; i < this._poiPads.length; i++) {
        const pad = this._poiPads[i];
        const dx = x - pad.x;
        const dz = z - pad.z;
        const dist = Math.hypot(dx, dz);
        const outer = pad.r + 28;
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
    const skyGeo = new THREE.SphereGeometry(1450, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0.55, 0.52, 0.42).normalize() },
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

          // Soft high-altitude drifting clouds
          if (dir.y > 0.03) {
            vec2 uv = dir.xz / (dir.y + 0.16) * 1.85 + vec2(uTime * 0.006, uTime * 0.002);
            float c = noise(uv) * 0.55 + noise(uv * 2.3 + 4.1) * 0.30 + noise(uv * 5.1) * 0.15;
            float cloudMask = smoothstep(0.50, 0.78, c) * smoothstep(0.03, 0.22, dir.y) * 0.48;
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
      [-180, 140, 220], [160, 150, 240], [-340, 60, 200],
      [280, -140, 210], [-220, -160, 190], [60, 280, 230],
      [-60, -210, 200], [420, 180, 210], [-420, -260, 210]
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
      ground: new THREE.MeshLambertMaterial({ map: this._createGroundTexture(), vertexColors: true }),
      road: new THREE.MeshLambertMaterial({ color: 0x30312e, polygonOffset: true, polygonOffsetFactor: -2 }),
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
    // Subdivided Varying Wasteland Terrain Mesh (2100x2100m stretching into the Red Zone horizon)
    const terrainSize = 2100;
    const segs = 148;
    const groundGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segs, segs);
    groundGeo.rotateX(-Math.PI / 2);

    const posAttr = groundGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    const colLow = new THREE.Color(0x6e624d);     // Dry creek gravel / ochre earth
    const colMid = new THREE.Color(0x6f7356);     // Dry wasteland scrub grass
    const colHigh = new THREE.Color(0x7c786c);    // Highland rocky ridge
    const colSlope = new THREE.Color(0x655c4e);   // Exposed dirt hillside
    const tmpCol = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = this.getTerrainHeight(vx, vz);
      posAttr.setY(i, vy);

      // Compute approximate slope for natural dirt/rock blending
      const hx = this.getTerrainHeight(vx + 3, vz) - vy;
      const hz = this.getTerrainHeight(vx, vz + 3) - vy;
      const slope = Math.hypot(hx, hz) / 3;

      if (vy < 0.8) {
        tmpCol.copy(colLow).lerp(colMid, THREE.MathUtils.clamp((vy + 2.5) / 3.3, 0, 1));
      } else if (vy < 7.5) {
        tmpCol.copy(colMid).lerp(colHigh, THREE.MathUtils.clamp((vy - 0.8) / 6.7, 0, 1));
      } else {
        tmpCol.copy(colHigh);
      }
      if (slope > 0.16) {
        tmpCol.lerp(colSlope, THREE.MathUtils.clamp((slope - 0.16) * 2.6, 0, 0.78));
      }
      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();

    const ground = new THREE.Mesh(groundGeo, this._materials.ground);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.shootableMeshes.push(ground);

    // Terrain-conforming segmented asphalt/dirt highways connecting POIs across the 1240m sector
    const addTerrainRoad = (x1, z1, x2, z2, width = 10) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const steps = Math.max(12, Math.round(len / 14));
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
        const wy = this.getTerrainHeight(wx, wz) + 0.08;
        pa.setXYZ(i, wx, wy, wz);
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, this._materials.road);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };

    // Main N-S and E-W cross-sector highways + perimeter connector roads between POIs
    addTerrainRoad(0, -560, 0, 560, 11);
    addTerrainRoad(-560, 20, 560, 20, 11);
    addTerrainRoad(-320, -240, -60, -340, 8);
    addTerrainRoad(-60, -340, 310, -270, 8);
    addTerrainRoad(310, -270, 340, 20, 8);
    addTerrainRoad(340, 20, 270, 290, 8);
    addTerrainRoad(270, 290, -260, 310, 8);
    addTerrainRoad(-260, 310, -370, 50, 8);
    addTerrainRoad(-370, 50, -320, -240, 8);
  }

  _buildForestAndFoliage() {
    // Deterministic PRNG so forests, foliage & boulders are consistent across multiplayer clients!
    let seed = 133742;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const isClearForNature = (x, z, padMargin = 8) => {
      if (Math.abs(x) > this.mapHalfSize + 140 || Math.abs(z) > this.mapHalfSize + 140) return false;
      // Keep clear of main N-S & E-W highways
      if (Math.abs(x) < 12 || Math.abs(z - 20) < 12) return false;
      // Keep clear of POI & Extraction pads
      for (let i = 0; i < this._poiPads.length; i++) {
        const p = this._poiPads[i];
        if (Math.hypot(x - p.x, z - p.z) < p.r + padMargin) return false;
      }
      // Keep clear of operator spawn ring points
      for (let i = 0; i < this.operatorSpawns.length; i++) {
        const sp = this.operatorSpawns[i];
        if (Math.hypot(x - sp.x, z - sp.z) < 14) return false;
      }
      if (Math.hypot(x - 0, z - 485) < 18) return false;
      return true;
    };

    const dummy = new THREE.Object3D();

    // 1. Instanced Pine / Spruce Forest Trees (480 trees -> only 3 draw calls!)
    const pineCount = 480;
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.36, 4.2, 6);
    trunkGeo.translate(0, 2.1, 0);
    const foliageLowGeo = new THREE.ConeGeometry(2.4, 5.4, 7);
    foliageLowGeo.translate(0, 5.6, 0);
    const foliageTopGeo = new THREE.ConeGeometry(1.65, 4.4, 7);
    foliageTopGeo.translate(0, 8.6, 0);

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4b3827 });
    const pineMatA = new THREE.MeshLambertMaterial({ color: 0x2d4329 });
    const pineMatB = new THREE.MeshLambertMaterial({ color: 0x375231 });

    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, pineCount);
    const coneLowInst = new THREE.InstancedMesh(foliageLowGeo, pineMatA, pineCount);
    const coneTopInst = new THREE.InstancedMesh(foliageTopGeo, pineMatB, pineCount);
    trunkInst.castShadow = true;
    coneLowInst.castShadow = true;
    coneTopInst.castShadow = true;
    coneLowInst.receiveShadow = true;

    let placedPines = 0;
    for (let tries = 0; tries < 2400 && placedPines < pineCount; tries++) {
      // Cluster trees into natural groves across the 1240m map
      const x = (rand() * 2 - 1) * (this.mapHalfSize + 70);
      const z = (rand() * 2 - 1) * (this.mapHalfSize + 70);
      if (!isClearForNature(x, z, 6)) continue;
      // Favor natural forest density bands using low-frequency noise
      const grove = Math.sin(x * 0.009) * Math.cos(z * 0.009) + Math.sin((x - z) * 0.006) * 0.5;
      if (grove < -0.25 && rand() < 0.72) continue;

      const y = this.getTerrainHeight(x, z);
      const s = 0.78 + rand() * 0.68;
      dummy.position.set(x, y - 0.15, z);
      dummy.rotation.set((rand() - 0.5) * 0.06, rand() * Math.PI * 2, (rand() - 0.5) * 0.06);
      dummy.scale.set(s, s * (0.9 + rand() * 0.25), s);
      dummy.updateMatrix();

      trunkInst.setMatrixAt(placedPines, dummy.matrix);
      coneLowInst.setMatrixAt(placedPines, dummy.matrix);
      coneTopInst.setMatrixAt(placedPines, dummy.matrix);

      // Add trunk collider for playable interior trees
      if (Math.abs(x) <= this.mapHalfSize && Math.abs(z) <= this.mapHalfSize) {
        const cr = 0.38 * s;
        this.colliders.push({
          minX: x - cr, maxX: x + cr,
          minY: y - 0.5, maxY: y + 4.5 * s,
          minZ: z - cr, maxZ: z + cr
        });
      }
      placedPines++;
    }
    trunkInst.count = placedPines;
    coneLowInst.count = placedPines;
    coneTopInst.count = placedPines;
    trunkInst.instanceMatrix.needsUpdate = true;
    coneLowInst.instanceMatrix.needsUpdate = true;
    coneTopInst.instanceMatrix.needsUpdate = true;
    this.scene.add(trunkInst, coneLowInst, coneTopInst);

    // 2. Instanced Tactical Bushes & Foliage Shrubs (750 clusters -> 1 draw call!)
    const bushCount = 750;
    const bushGeo = new THREE.DodecahedronGeometry(1.15, 0);
    bushGeo.scale(1.15, 0.72, 1.15);
    bushGeo.translate(0, 0.55, 0);
    const bushMat = new THREE.MeshLambertMaterial({ color: 0x3d5131 });
    const bushInst = new THREE.InstancedMesh(bushGeo, bushMat, bushCount);
    bushInst.receiveShadow = true;

    let placedBushes = 0;
    for (let tries = 0; tries < 2200 && placedBushes < bushCount; tries++) {
      const x = (rand() * 2 - 1) * this.mapHalfSize;
      const z = (rand() * 2 - 1) * this.mapHalfSize;
      if (!isClearForNature(x, z, 2)) continue;
      const y = this.getTerrainHeight(x, z);
      const s = 0.65 + rand() * 0.95;
      dummy.position.set(x, y - 0.1, z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.set(s, s * (0.75 + rand() * 0.45), s);
      dummy.updateMatrix();
      bushInst.setMatrixAt(placedBushes, dummy.matrix);
      placedBushes++;
    }
    bushInst.count = placedBushes;
    bushInst.instanceMatrix.needsUpdate = true;
    this.scene.add(bushInst);

    // 3. Natural Rock Outcrops & Tactical Cover Boulders (110 formations with colliders -> 1 draw call!)
    const rockCount = 110;
    const rockGeo = new THREE.DodecahedronGeometry(2.1, 0);
    rockGeo.scale(1.25, 0.78, 1.05);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x67645e });
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rockInst.castShadow = true;
    rockInst.receiveShadow = true;

    let placedRocks = 0;
    for (let tries = 0; tries < 900 && placedRocks < rockCount; tries++) {
      const x = (rand() * 2 - 1) * (this.mapHalfSize - 25);
      const z = (rand() * 2 - 1) * (this.mapHalfSize - 25);
      if (!isClearForNature(x, z, 8)) continue;
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
      placedRocks++;
    }
    rockInst.count = placedRocks;
    rockInst.instanceMatrix.needsUpdate = true;
    this.scene.add(rockInst);
    this.shootableMeshes.push(rockInst);
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
    const baseY = this.getTerrainHeight(cx, cz);

    // Foundation skirt + Floor slab seated cleanly into terrain plateau
    this._addBox(cx, baseY - 0.5, cz, w + 0.6, 1.0, d + 0.6, this._materials.darkConcrete, false);
    this._addBox(cx, baseY + 0.08, cz, w, 0.16, d, this._materials.darkConcrete, false);
    // Roof
    this._addBox(cx, baseY + h + 0.15, cz, w + 0.4, 0.3, d + 0.4, this._materials.darkConcrete, true);

    const buildWallWithDoor = (wx, wz, length, isHorizontal) => {
      const sideLen = (length - doorW) / 2;
      if (isHorizontal) {
        this._addBox(wx - (doorW / 2 + sideLen / 2), baseY + h / 2, wz, sideLen, h, t, this._materials.concrete);
        this._addBox(wx + (doorW / 2 + sideLen / 2), baseY + h / 2, wz, sideLen, h, t, this._materials.concrete);
        this._addBox(wx, baseY + h - 0.6, wz, doorW, 1.2, t, this._materials.concrete);
      } else {
        this._addBox(wx, baseY + h / 2, wz - (doorW / 2 + sideLen / 2), t, h, sideLen, this._materials.concrete);
        this._addBox(wx, baseY + h / 2, wz + (doorW / 2 + sideLen / 2), t, h, sideLen, this._materials.concrete);
        this._addBox(wx, baseY + h - 0.6, wz, t, 1.2, doorW, this._materials.concrete);
      }
    };

    if (doorSide === 'north') buildWallWithDoor(cx, cz - d / 2, w, true);
    else this._addBox(cx, baseY + h / 2, cz - d / 2, w, h, t, this._materials.concrete);

    if (doorSide === 'south') buildWallWithDoor(cx, cz + d / 2, w, true);
    else this._addBox(cx, baseY + h / 2, cz + d / 2, w, h, t, this._materials.concrete);

    if (doorSide === 'west') buildWallWithDoor(cx - w / 2, cz, d, false);
    else this._addBox(cx - w / 2, baseY + h / 2, cz, t, h, d, this._materials.concrete);

    if (doorSide === 'east') buildWallWithDoor(cx + w / 2, cz, d, false);
    else this._addBox(cx + w / 2, baseY + h / 2, cz, t, h, d, this._materials.concrete);
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

    const baseY = this.getTerrainHeight(x, z) + y;
    const mesh = this._addBox(x, baseY + h / 2, z, w, h, d, mat, true);
    this.lootContainers.push({
      id: 'crate_' + this.lootContainers.length,
      name,
      kind,
      mesh,
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
  }

  _buildMapLayout() {
    // Open Sector Perimeter — Visual 3D Red Zone hazard warning beacons at ±620m (1240m x 1240m!)
    const B = this.mapHalfSize || 620;
    const postMat = new THREE.MeshLambertMaterial({ color: 0x2a2c2e });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xff3d3d });
    for (let p = -B; p <= B; p += 88) {
      const pts = [[p, -B], [p, B], [-B, p], [B, p]];
      for (const [px, pz] of pts) {
        const py = this.getTerrainHeight(px, pz);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), postMat);
        post.position.set(px, py + 1.6, pz);
        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), bulbMat);
        bulb.position.set(px, py + 3.4, pz);
        this.scene.add(post, bulb);
      }
    }

    // === 8 DRAMATICALLY EXPANDED TACTICAL POIs (>= 278m BETWEEN EVERY PAIR OF POIs!) ===

    // 1. Military Compound (NW Sector: -320, -240)
    {
      const cx = -320, cz = -240;
      this._addBuilding(cx, cz, 18, 16, 5.0, 'east');
      this.pois.push({ name: 'COMPOUND', x: cx, z: cz, color: '#ab47bc', threat: 'high' });
      this._addGunLocker(cx - 8.1, cz - 3.0, Math.PI / 2, 'military', 'Compound Rifle Locker');
      this._addGunLocker(cx - 8.1, cz + 2.5, Math.PI / 2, 'military', 'Compound Armory Locker');
      this._addLootContainer(cx - 5.2, 0.16, cz + 6.2, 'supply', 'Compound Materials Crate');
      this._addWallFirstAidKit(cx + 4.0, cz + 7.45, 'south', 'Compound Wall First Aid Kit');
      this._addMetalShelf(cx - 2.0, cz - 6.9, 0, [
        { id: 'ammo_545', qty: 30 }, { id: 'armor_plate', qty: 2 }, { id: 'frag_grenade', qty: 1 }
      ]);
      this._addMetalShelf(cx + 3.0, cz - 6.9, 0, [
        { id: 'ammo_762', qty: 20 }, { id: 'gunpowder', qty: 2 }, { id: 'polymer_parts', qty: 2 }
      ]);
      this._addWorkbenchTable(cx + 0.5, cz, 0, [
        { id: 'armor_plate', qty: 2 }, { id: 'scrap_metal', qty: 3 }
      ]);
      this._addContainer(cx + 18, cz - 10, 0, this._materials.rustOlive);
      this._addBarrier(cx + 15, cz + 9, true);
    }

    // 2. Field Hospital & Clinic (East Meadow: 340, 20)
    {
      const cx = 340, cz = 20;
      const by = this.getTerrainHeight(cx, cz);
      this._addBuilding(cx, cz, 14, 12, 4.4, 'west');
      this.pois.push({ name: 'CLINIC', x: cx, z: cz, color: '#69f0ae', threat: 'medium' });
      this._addWallFirstAidKit(cx - 2.5, cz - 5.55, 'north', 'Clinic Wall First Aid Kit');
      this._addWallFirstAidKit(cx + 6.55, cz - 1.5, 'east', 'Trauma Room First Aid Kit');
      this._addBox(cx + 2.8, by + 1.7, cz + 3.8, 0.22, 3.2, 3.2, this._materials.concrete);
      this._addMedicineCabinet(cx + 4.6, cz + 5.55, 'south', 'Clinic Bathroom Medicine Cabinet');
      this._addLootContainer(cx + 5.2, 0.16, cz - 4.2, 'hospital', 'Hospital Trauma Crate');
      this._addMetalShelf(cx + 1.2, cz - 5.1, 0, [
        { id: 'bandage', qty: 2 }, { id: 'painkillers', qty: 1 }, { id: 'cloth_roll', qty: 2 }
      ]);
      this._addWorkbenchTable(cx - 0.5, cz + 0.5, 0, [
        { id: 'medkit', qty: 1 }, { id: 'water_filter', qty: 1 }
      ]);
      this._addBarrier(cx - 14, cz - 6, false);
    }

    // 3. Police & Fire Station (SW Low-Threat Outpost: -260, 310)
    {
      const cx = -260, cz = 310;
      const by = this.getTerrainHeight(cx, cz);
      this._addBuilding(cx, cz, 16, 12, 4.4, 'east');
      this.pois.push({ name: 'POLICE/FIRE', x: cx, z: cz, color: '#42a5f5', threat: 'low' });
      this._addGunLocker(cx - 7.1, cz - 2.2, Math.PI / 2, 'police_fire', 'Police Gun Locker');
      this._addGunLocker(cx - 7.1, cz + 1.8, Math.PI / 2, 'police_fire', 'Fire & Rescue Gear Locker');
      this._addWallFirstAidKit(cx + 4.0, cz - 5.55, 'north', 'Station Wall First Aid Kit');
      this._addBox(cx + 1.8, by + 1.7, cz + 3.6, 0.22, 3.2, 3.0, this._materials.concrete);
      this._addMedicineCabinet(cx + 4.0, cz + 5.55, 'south', 'Station Bathroom Medicine Cabinet');
      this._addMetalShelf(cx - 1.5, cz - 5.1, 0, [
        { id: 'armor_plate', qty: 2 }, { id: 'ammo_9x19', qty: 24 }, { id: 'ammo_12g', qty: 12 }
      ]);
      this._addWorkbenchTable(cx, cz, 0, [
        { id: 'smoke_grenade', qty: 1 }, { id: 'armor_plate', qty: 1 }
      ]);
    }

    // 4. Boss Encampment & Armory Key Room (NE Highland Fortress: 310, -270)
    {
      const cx = 310, cz = -270;
      this._addBuilding(cx, cz, 14, 14, 4.8, 'south');
      this.pois.push({ name: 'BOSS CAMP', x: cx, z: cz, color: '#ffc107', threat: 'boss' });
      this._addLootContainer(cx, 0.16, cz - 4.8, 'boss_key_room', 'Boss Encampment Key Room', 'boss_key');
      this._addGunLocker(cx + 6.1, cz - 0.5, -Math.PI / 2, 'military', 'Boss Guard Gun Locker');
      this._addWallFirstAidKit(cx - 6.55, cz + 1.8, 'west', 'Encampment Wall First Aid Kit');
      this._addWorkbenchTable(cx, cz + 0.8, 0, [
        { id: 'ammo_762', qty: 20 }, { id: 'gold_watch', qty: 1 }
      ]);
      this._addBarrier(cx - 11, cz + 12, true);
      this._addBarrier(cx + 10, cz + 12, true);
      this._addContainer(cx - 15, cz - 4, 0, this._materials.rustOlive);
    }

    // 5. Central Logistics Warehouse (Crossroads Hub: 0, 0)
    {
      const cx = 0, cz = 0;
      this._addBuilding(cx, cz, 20, 14, 5.2, 'south');
      this.pois.push({ name: 'WAREHOUSE', x: cx, z: cz, color: '#ff9800', threat: 'low' });
      this._addLootContainer(cx - 7.8, 0.16, cz - 4.8, 'military', 'Warehouse Armory Case');
      this._addLootContainer(cx + 7.8, 0.16, cz - 4.8, 'supply', 'Logistics Cargo Crate');
      this._addMetalShelf(cx - 3.0, cz - 6.0, 0, [
        { id: 'scrap_metal', qty: 3 }, { id: 'polymer_parts', qty: 2 }, { id: 'ammo_545', qty: 24 }
      ]);
      this._addMetalShelf(cx + 3.0, cz - 6.0, 0, [
        { id: 'cloth_roll', qty: 2 }, { id: 'gunpowder', qty: 2 }, { id: 'fuel_can', qty: 1 }
      ]);
      this._addWorkbenchTable(cx, cz + 0.5, 0, [
        { id: 'medkit', qty: 1 }, { id: 'armor_plate', qty: 2 }
      ]);
    }

    // 6. Fuel & Radio Outpost (SE Low-Threat Hilltop: 270, 290)
    {
      const cx = 270, cz = 290;
      this._addBuilding(cx, cz, 14, 12, 4.4, 'west');
      this.pois.push({ name: 'RADIO OUTPOST', x: cx, z: cz, color: '#26c6da', threat: 'low' });
      this._addGunLocker(cx + 6.1, cz - 1.8, -Math.PI / 2, 'military', 'Outpost Comms Locker');
      this._addLootContainer(cx + 5.2, 0.16, cz + 3.8, 'supply', 'Fuel & Parts Supply Crate');
      this._addWallFirstAidKit(cx - 2.5, cz - 5.55, 'north', 'Outpost First Aid Kit');
      this._addWorkbenchTable(cx, cz, 0, [
        { id: 'intel_drive', qty: 1 }, { id: 'fuel_can', qty: 1 }
      ]);
      this._addContainer(cx - 14, cz + 12, 1, this._materials.rustRed);
    }

    // 7. Rail Yard / Container Depot (West Valley: -370, 50)
    {
      const cx = -370, cz = 50;
      this.pois.push({ name: 'RAIL YARD', x: cx, z: cz, color: '#ef5350', threat: 'medium' });
      this._addContainer(cx, cz - 10, 1, this._materials.rustRed);
      this._addContainer(cx, cz + 2, 1, this._materials.rustBlue);
      this._addContainer(cx - 10, cz + 12, 0, this._materials.rustOlive);
      this._addContainer(cx + 10, cz + 14, 0, this._materials.rustRed);
      this._addLootContainer(cx, 0, cz - 4, 'military', 'Rail Yard Weapon Case');
      this._addLootContainer(cx + 4, 0, cz + 14, 'supply', 'Freight Cargo Crate');
      this._addWorkbenchTable(cx - 5, cz + 8, 0, [
        { id: 'armor_plate', qty: 2 }, { id: 'ammo_762', qty: 20 }
      ], 0);
    }

    // 8. Northern Watchtower Bunker (North Highland Ridge: -60, -340)
    {
      const cx = -60, cz = -340;
      this._addBuilding(cx, cz, 12, 10, 4.5, 'south');
      this.pois.push({ name: 'NORTH BUNKER', x: cx, z: cz, color: '#ec407a', threat: 'high' });
      this._addGunLocker(cx - 5.1, cz - 0.5, Math.PI / 2, 'military', 'Bunker Marksman Locker');
      this._addLootContainer(cx + 4.2, 0.16, cz - 3.2, 'military', 'Bunker Munitions Case');
      this._addWallFirstAidKit(cx, cz - 4.55, 'north', 'Bunker First Aid Kit');
      this._addBarrier(cx - 8, cz + 10, true);
      this._addBarrier(cx + 8, cz + 10, true);
    }

    // === MID-FIELD CHECKPOINTS, HIGHWAY COVER & SHIPPING CONTAINERS ===
    // South Highway Checkpoint (first tactical stop north of south ring spawn)
    this._addBarrier(-8, 326, true);
    this._addBarrier(8, 314, true);
    this._addContainer(-16, 318, 0, this._materials.rustOlive);
    this._addLootContainer(-12, 0, 322, 'supply', 'Highway Checkpoint Crate');

    const midContainers = [
      [18, 120, 0, this._materials.rustRed],
      [-22, -140, 1, this._materials.rustBlue],
      [165, 24, 0, this._materials.rustOlive],
      [-175, 16, 1, this._materials.rustRed],
      [160, -145, 0, this._materials.rustBlue],
      [-165, -135, 1, this._materials.rustOlive],
      [140, 160, 1, this._materials.rustRed],
      [-140, 175, 0, this._materials.rustBlue]
    ];
    for (const [cx, cz, rot, mat] of midContainers) {
      this._addContainer(cx, cz, rot, mat);
      this._addLootContainer(cx + 3.2, 0, cz + 2.5, 'supply');
    }

    const barriers = [
      [-8, 180, true], [8, 160, true], [-8, -180, true], [8, -220, true],
      [180, 14, false], [-180, 26, false], [120, 295, true], [-120, 300, true]
    ];
    for (const [bx, bz, horiz] of barriers) {
      this._addBarrier(bx, bz, horiz);
    }

    this._spawnLogicalLooseLoot();

    // === 4 SPREAD-OUT EXTRACTION ZONES (OUTER RIM) ===
    this._addExtractZone('NORTH HELIPAD', 0, -560, 6.5);
    this._addExtractZone('EAST BUNKER GATE', 560, -40, 6.5);
    this._addExtractZone('WEST CONVOY EXIT', -560, 120, 6.5);
    this._addExtractZone('SOUTH BRIDGE', 40, 560, 6.5);

    // === OPERATOR SQUAD SPAWN RING (250m APART!) + INTERMITTENT LOW-THREAT INTERIOR POI SPAWNS ===
    // 12 ring points at R = 485m -> chord distance = 2 * 485 * sin(PI/12) = 251.0m apart!
    // Index 0 (angle = PI/2 -> (0, 485)) is the player squad spawn; indices 1..11 are enemy operator squad ring spawns.
    this.operatorSpawns = [];
    const ringR = 485;
    const ringCount = 12;
    for (let i = 1; i < ringCount; i++) {
      const ang = Math.PI / 2 + (i * Math.PI * 2) / ringCount;
      const sx = Math.round(Math.cos(ang) * ringR);
      const sz = Math.round(Math.sin(ang) * ringR);
      this.operatorSpawns.push(new THREE.Vector3(sx, this.getTerrainHeight(sx, sz), sz));
    }
    // Intermittent interior spawns at low-threat POIs (Police/Fire outskirts, Radio Outpost outskirts, Warehouse south ridge)
    const lowThreatInteriorSpawns = [
      [-225, 295],  // Near Police/Fire (low threat)
      [235, 275],   // Near Radio Outpost (low threat)
      [32, 34]      // Near Central Warehouse outskirts (low threat)
    ];
    for (const [ix, iz] of lowThreatInteriorSpawns) {
      this.operatorSpawns.push(new THREE.Vector3(ix, this.getTerrainHeight(ix, iz), iz));
    }

    // === GENERAL PATROL / SPAWN POINTS ACROSS ALL SECTORS ===
    this.spawnPoints = this.pois.map(p => new THREE.Vector3(p.x + 12, this.getTerrainHeight(p.x + 12, p.z + 10), p.z + 10));
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
    // Outdoor field tables near highway checkpoints & mid-field cover
    this._addWorkbenchTable(-12.5, 326.5, 0, [
      { id: 'scrap_metal', qty: 2 }, { id: 'bandage', qty: 1 }
    ], 0);
    this._addWorkbenchTable(22.5, 122.0, Math.PI / 2, [
      { id: 'gunpowder', qty: 2 }, { id: 'ammo_9x18', qty: 20 }
    ], 0);
    this._addWorkbenchTable(168.0, 27.5, 0, [
      { id: 'ammo_545', qty: 24 }, { id: 'polymer_parts', qty: 2 }
    ], 0);
    this._addWorkbenchTable(-172.0, 19.5, Math.PI / 2, [
      { id: 'armor_plate', qty: 1 }, { id: 'frag_grenade', qty: 1 }
    ], 0);
    this._addWorkbenchTable(144.0, 163.0, 0, [
      { id: 'medkit', qty: 1 }, { id: 'ammo_9x19', qty: 24 }
    ], 0);
  }

  update(dt, time, playerPos = null) {
    // Keep procedural skybox dome centered on player & animate drifting clouds
    if (this.skyDome) {
      if (playerPos) {
        this.skyDome.position.set(playerPos.x, 0, playerPos.z);
      }
      if (this.skyDome.material && this.skyDome.material.uniforms && this.skyDome.material.uniforms.uTime) {
        this.skyDome.material.uniforms.uTime.value = time;
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
  }
}
