// 3D Post-Apocalyptic Wasteland World Builder
class WastelandWorld {
  constructor(scene, zoneConfig) {
    this.scene = scene;
    this.zone = zoneConfig;
    this.colliders = [];      // { minX, maxX, minY, maxY, minZ, maxZ }
    this.shootableMeshes = []; // Static geometry meshes for bullet/airstrike raycasts
    this.wallMeshes = [];      // Fast low-poly box/structure meshes ONLY (excludes high-poly terrain for 60+ FPS LOS & wall-push!)
    this.lootContainers = []; // { id, name, mesh, position, items, searched, requiresKey }
    this.groundItems = [];    // { id, qty, mesh, position, ringMesh } physical loose & dropped loot
    this.doors = [];          // Interactive bidirectional hinged doors (open / peek / sprint bash / close)
    this.staircases = [];     // Registered multi-floor staircases { bottomEntry, topExit, bottomY, topY } for AI pathfinding
    this.munitionBoxes = [];  // Deployable physical 3D Munition Boxes { mesh, position, ownerName, usedBy: Set, ttl }
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
      { x: 0, z: 0, r: 34, h: 1.5 },          // WAREHOUSE (Central Logistics Hub + Catwalk)
      { x: -320, z: -240, r: 32, h: 6.5 },    // COMPOUND (NW Military Base)
      { x: 340, z: 20, r: 38, h: 3.0 },       // CLINIC (East Meadow - Large Multi-Room Hospital + Canopy)
      { x: -295, z: 310, r: 34, h: 2.0 },     // POLICE STATION (Large 2-Story Precinct)
      { x: -195, z: 315, r: 36, h: 2.0 },     // FIRE STATION (Large 3-Bay Garage + 8m x 8m Watch Tower)
      { x: 310, z: -270, r: 52, h: 9.5 },     // BOSS CAMP (Large 70m x 64m Walled Compound & Command HQ)
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

    this._colliderCellSize = 18;
    this._colliderGrid = new Map();
    this._queryBuf = [];
    this._queryStamp = 0;

    this._materials = this._createMaterials();
    this._buildSkybox();
    this._buildEnvironment();
    this._buildVolumetricFogLayers();
    this._buildMapLayout();
    this._buildForestAndFoliage();
    this.buildColliderGrid();

    const spawnY = this.getTerrainHeight(0, 485);
    this.playerSpawn = new THREE.Vector3(0, spawnY + 1.7, 485);
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

  // Deterministic rolling terrain heightfield with hills, ridges, creek valley & smooth POI plateaus
  getTerrainHeight(x, z) {
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

  _evalAnalyticalTerrainHeight(x, z) {
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
    // Radius 420 + depthTest:false + renderOrder:-1000 guarantees ZERO far-plane clipping at every LOD!
    const skyGeo = new THREE.SphereGeometry(420, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
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

    // Muted Warzone Verdansk / Al Mazrah temperate-arid grass & steppe base
    ctx.fillStyle = '#626b46';
    ctx.fillRect(0, 0, 512, 512);

    // Broad organic steppe & compacted dirt patches
    for (let i = 0; i < 240; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 14 + Math.random() * 36;
      const roll = Math.random();
      ctx.fillStyle = roll < 0.38
        ? 'rgba(116, 108, 78, 0.28)'
        : (roll < 0.72 ? 'rgba(88, 102, 58, 0.24)' : 'rgba(66, 76, 46, 0.26)');
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine grit & scattered pebbles
    for (let i = 0; i < 1400; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const s = 1 + Math.random() * 2.2;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(135, 128, 106, 0.35)' : 'rgba(54, 52, 44, 0.30)';
      ctx.fillRect(x, y, s, s);
    }

    // Muted grass blade strokes & dry tufts
    const bladeCols = ['rgba(122,130,80,0.42)', 'rgba(92,102,60,0.48)', 'rgba(72,82,48,0.42)', 'rgba(138,132,96,0.32)'];
    for (let i = 0; i < 7500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const len = 2.5 + Math.random() * 5.0;
      ctx.fillStyle = bladeCols[i % bladeCols.length];
      ctx.fillRect(x, y, 1.3, len);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(110, 110);
    return tex;
  }

  _createBushFoliageTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    // Subtle dark inner twigs
    ctx.strokeStyle = '#3a2d1e';
    ctx.lineWidth = 4;
    for (let i = 0; i < 9; i++) {
      const ang = -Math.PI * 0.85 + (i / 8) * Math.PI * 0.7;
      ctx.beginPath();
      ctx.moveTo(128, 242);
      ctx.lineTo(128 + Math.cos(ang) * 95, 242 + Math.sin(ang) * 145);
      ctx.stroke();
    }

    // Layered see-through leaf clusters with natural air gaps around perimeter
    const leafCols = ['#24421d', '#315925', '#3f6e2e', '#528538', '#2a4d20'];
    for (let i = 0; i < 210; i++) {
      const t = Math.random() * Math.PI * 2;
      const rad = Math.pow(Math.random(), 0.65) * 98;
      const lx = 128 + Math.cos(t) * rad * 1.05;
      const ly = 136 + Math.sin(t) * rad * 0.88;
      if (ly > 246 || ly < 16 || lx < 12 || lx > 244) continue;
      // Leave small see-through perforations
      if (rad > 72 && Math.random() < 0.32) continue;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(Math.random() * Math.PI * 2);
      ctx.fillStyle = leafCols[i % leafCols.length];
      ctx.beginPath();
      ctx.ellipse(0, 0, 6 + Math.random() * 9, 3.2 + Math.random() * 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  _createTreeCanopyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    // Conifer pine bough silhouette with jagged needle fronds and see-through gaps between tiers
    const pineCols = ['#1e381d', '#284a25', '#345e2e', '#407036', '#182e18'];
    for (let tier = 0; tier < 7; tier++) {
      const ty = 32 + tier * 31;
      const spread = 24 + tier * 17;
      // Branch stems
      ctx.strokeStyle = '#3b2c1d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(128, ty - 6);
      ctx.lineTo(128 - spread * 0.9, ty + 14);
      ctx.moveTo(128, ty - 6);
      ctx.lineTo(128 + spread * 0.9, ty + 14);
      ctx.stroke();

      // Pine needle clusters along each bough
      const clusterCount = 18 + tier * 7;
      for (let c = 0; c < clusterCount; c++) {
        const frac = (Math.random() * 2 - 1);
        const nx = 128 + frac * spread;
        const ny = ty + Math.abs(frac) * 14 + (Math.random() - 0.5) * 16;
        ctx.save();
        ctx.translate(nx, ny);
        ctx.rotate(frac * 0.65 + (Math.random() - 0.5) * 0.5);
        ctx.fillStyle = pineCols[(tier + c) % pineCols.length];
        ctx.beginPath();
        ctx.ellipse(0, 0, 9 + Math.random() * 9, 3.2 + Math.random() * 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
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
    const segs = 84;
    const groundGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segs, segs);
    groundGeo.rotateX(-Math.PI / 2);

    const posAttr = groundGeo.attributes.position;
    const heights = new Float32Array(posAttr.count);
    const colors = new Float32Array(posAttr.count * 3);
    const colLow = new THREE.Color(0x5a7c3c);     // Lush valley meadow grass
    const colMid = new THREE.Color(0x6b9246);     // Sunlit green pasture grass
    const colHigh = new THREE.Color(0x7c9658);    // Highland alpine grass
    const colSlope = new THREE.Color(0x5e6e48);   // Mossy hillside grass
    const tmpCol = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = this._evalAnalyticalTerrainHeight(vx, vz);
      posAttr.setY(i, vy);
      heights[i] = vy;

      // Compute approximate slope for natural dirt/rock blending
      const hx = this._evalAnalyticalTerrainHeight(vx + 3, vz) - vy;
      const hz = this._evalAnalyticalTerrainHeight(vx, vz + 3) - vy;
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
    this._terrainSize = terrainSize;
    this._terrainSegs = segs;
    this._terrainHeights = heights;

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

    // 1. Instanced Alpha-Tested See-Through Conifer / Pine Forest Trees (760 trees -> only 2 draw calls!)
    const pineCount = 760;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 5.0, 6);
    trunkGeo.translate(0, 2.5, 0);
    const treeCanopyGeo = buildCrossedPlanesGeo(6.4, 9.6, 2.0, 3);

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4b3827 });
    const treeCanopyMat = new THREE.MeshLambertMaterial({
      map: this._createTreeCanopyTexture(),
      alphaTest: 0.38,
      side: THREE.DoubleSide
    });

    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, pineCount);
    const canopyInst = new THREE.InstancedMesh(treeCanopyGeo, treeCanopyMat, pineCount);
    trunkInst.castShadow = false;
    canopyInst.castShadow = false;
    canopyInst.receiveShadow = false;

    let placedPines = 0;
    for (let tries = 0; tries < 3600 && placedPines < pineCount; tries++) {
      // Cluster trees into lush natural groves across the 1240m map
      const x = (rand() * 2 - 1) * (this.mapHalfSize + 70);
      const z = (rand() * 2 - 1) * (this.mapHalfSize + 70);
      if (!isClearForNature(x, z, 6)) continue;
      const grove = Math.sin(x * 0.009) * Math.cos(z * 0.009) + Math.sin((x - z) * 0.006) * 0.5;
      if (grove < -0.35 && rand() < 0.62) continue;

      const y = this.getTerrainHeight(x, z);
      const s = 0.78 + rand() * 0.72;
      dummy.position.set(x, y - 0.15, z);
      dummy.rotation.set((rand() - 0.5) * 0.05, rand() * Math.PI * 2, (rand() - 0.5) * 0.05);
      dummy.scale.set(s, s * (0.9 + rand() * 0.28), s);
      dummy.updateMatrix();

      trunkInst.setMatrixAt(placedPines, dummy.matrix);
      canopyInst.setMatrixAt(placedPines, dummy.matrix);

      // Add trunk collider for playable interior trees
      if (Math.abs(x) <= this.mapHalfSize && Math.abs(z) <= this.mapHalfSize) {
        const cr = 0.36 * s;
        this.colliders.push({
          minX: x - cr, maxX: x + cr,
          minY: y - 0.5, maxY: y + 4.8 * s,
          minZ: z - cr, maxZ: z + cr
        });
      }
      placedPines++;
    }
    trunkInst.count = placedPines;
    canopyInst.count = placedPines;
    trunkInst.instanceMatrix.needsUpdate = true;
    canopyInst.instanceMatrix.needsUpdate = true;
    trunkInst.matrixAutoUpdate = false;
    canopyInst.matrixAutoUpdate = false;
    this._pineMeshes = [trunkInst, canopyInst];
    this._maxPines = placedPines;
    this.scene.add(trunkInst, canopyInst);

    // 2. Instanced See-Through Leaf-Textured Tactical Bushes (1,600 dense bushes -> 1 draw call!)
    const bushCount = 1600;
    const bushGeo = buildCrossedPlanesGeo(2.5, 1.85, -0.08, 3);
    const bushMat = new THREE.MeshLambertMaterial({
      map: this._createBushFoliageTexture(),
      alphaTest: 0.42,
      side: THREE.DoubleSide
    });
    const bushInst = new THREE.InstancedMesh(bushGeo, bushMat, bushCount);
    bushInst.receiveShadow = false;
    bushInst.castShadow = false;

    let placedBushes = 0;
    for (let tries = 0; tries < 4800 && placedBushes < bushCount; tries++) {
      const x = (rand() * 2 - 1) * this.mapHalfSize;
      const z = (rand() * 2 - 1) * this.mapHalfSize;
      if (!isClearForNature(x, z, 2)) continue;
      const y = this.getTerrainHeight(x, z);
      const s = 0.65 + rand() * 0.95;
      dummy.position.set(x, y - 0.05, z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.set(s, s * (0.78 + rand() * 0.42), s);
      dummy.updateMatrix();
      bushInst.setMatrixAt(placedBushes, dummy.matrix);
      placedBushes++;
    }
    bushInst.count = placedBushes;
    bushInst.instanceMatrix.needsUpdate = true;
    bushInst.matrixAutoUpdate = false;
    this._bushInst = bushInst;
    this._maxBushes = placedBushes;
    this.scene.add(bushInst);

    // 3. Natural Rock Outcrops & Tactical Cover Boulders (110 formations with colliders -> 1 draw call!)
    const rockCount = 110;
    const rockGeo = new THREE.DodecahedronGeometry(2.1, 0);
    rockGeo.scale(1.25, 0.78, 1.05);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x67645e });
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rockInst.castShadow = false;
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
    return mesh;
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
    this.scene.add(mesh);
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
      this.scene.add(fan);
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
    grp.updateMatrix();
    grp.matrixAutoUpdate = false;
    this.scene.add(grp);
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
      angle: 0,
      targetAngle: 0,
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
      doorRef: doorObj
    };
    doorObj.collider = collider;
    this.colliders.push(collider);
    this.doors.push(doorObj);
    return doorObj;
  }

  interactDoor(door, playerPos, isPeek = false) {
    if (!door || !playerPos) return;
    if (door.state === 'open' || door.state === 'peek') {
      door.targetAngle = 0;
      door.state = 'closed';
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
    if (isPeek) {
      door.targetAngle = swingDir * 0.42;
      door.state = 'peek';
      door.bashSpeed = 5.5;
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

  updateDoors(dt, player, weaponSystem) {
    if (!this.doors || this.doors.length === 0) return;
    const px = player && player.position ? player.position.x : 0;
    const py = player && player.position ? (player.position.y - (player.currentEyeHeight || 1.65)) : 0;
    const pz = player && player.position ? player.position.z : 0;
    const isSprinting = !!(player && (player.isSprinting || player.isTacSprinting));

    for (let i = 0; i < this.doors.length; i++) {
      const d = this.doors[i];
      if (d.bashCooldown > 0) d.bashCooldown = Math.max(0, d.bashCooldown - dt);

      if (player && !player.dead) {
        const dy = Math.abs(py - d.hingePos.y);
        if (dy < 2.2) {
          const dx = px - d.center.x;
          const dz = pz - d.center.z;
          const dist = Math.hypot(dx, dz);

          if (isSprinting && d.state !== 'open' && d.bashCooldown <= 0 && dist < 1.58) {
            const dot = dx * d.normal.x + dz * d.normal.z;
            const swingDir = dot >= 0 ? 1 : -1;
            d.targetAngle = swingDir * 1.68;
            d.state = 'open';
            d.passable = true;
            d.bashSpeed = 16.5;
            d.bashCooldown = 0.65;
            if (window.soundEngine && window.soundEngine.playDoorBash) {
              try { window.soundEngine.playDoorBash(); } catch (e) {}
            }
            if (weaponSystem && weaponSystem.triggerDoorBash) {
              weaponSystem.triggerDoorBash();
            }
          } else if (d.state === 'peek' && dist < 1.32) {
            const swingDir = d.targetAngle >= 0 ? 1 : -1;
            d.targetAngle = swingDir * 1.52;
            d.state = 'open';
            d.bashSpeed = 6.8;
          }
        }
      }

      if (Math.abs(d.angle - d.targetAngle) > 0.004) {
        d.angle = THREE.MathUtils.lerp(d.angle, d.targetAngle, Math.min(1, dt * d.bashSpeed));
        d.pivot.rotation.y = d.baseRotY + d.angle;
      }
      d.passable = Math.abs(d.angle) > 0.72;
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
      if (isHorizontal) {
        this._addBox(wx - (doorW / 2 + sideLen / 2), baseY + h / 2, wz, sideLen, h, t, wMat);
        this._addBox(wx + (doorW / 2 + sideLen / 2), baseY + h / 2, wz, sideLen, h, t, wMat);
        this._addBox(wx, baseY + h - (h - 2.65) / 2, wz, doorW, Math.max(0.6, h - 2.65), t, wMat);
      } else {
        this._addBox(wx, baseY + h / 2, wz - (doorW / 2 + sideLen / 2), t, h, sideLen, wMat);
        this._addBox(wx, baseY + h / 2, wz + (doorW / 2 + sideLen / 2), t, h, sideLen, wMat);
        this._addBox(wx, baseY + h - (h - 2.65) / 2, wz, t, Math.max(0.6, h - 2.65), doorW, wMat);
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

    // === 8 DRAMATICALLY EXPANDED TACTICAL POIs (>= 278m BETWEEN EVERY PAIR OF POIs!) ===

    // 1. Military Compound (NW Sector: -320, -240)
    {
      const cx = -320, cz = -240;
      this._addBuilding(cx, cz, 18, 16, 5.0, 'east', null, (by, bh) => {
        // West Armory Wing
        this._addPartition(cx - 4.0, cz - 8.0, cx - 4.0, cz + 8.0, by, bh, [
          { at: cz, w: 1.8, door: 'steel', label: 'Armory Door' }
        ]);
        // NE Security Office
        this._addPartition(cx + 4.6, cz - 3.2, cx + 9.0, cz - 3.2, by, bh, []);
        this._addPartition(cx + 4.6, cz - 8.0, cx + 4.6, cz - 3.2, by, bh, [
          { at: cz - 4.4, w: 1.7, door: 'wood', label: 'Office Door' }
        ]);
        addDeskProp(cx + 7.0, by + 0.16, cz - 6.6);
        this._addLootContainer(cx + 7.4, 0.16, cz - 4.4, 'supply', 'Compound Office Safe');
      });
      this.pois.push({ name: 'COMPOUND', x: cx, z: cz, color: '#ab47bc', threat: 'high' });
      this._addGunLocker(cx - 8.1, cz - 3.0, Math.PI / 2, 'military', 'Compound Rifle Locker');
      this._addGunLocker(cx - 8.1, cz + 2.5, Math.PI / 2, 'military', 'Compound Armory Locker');
      this._addLootContainer(cx - 6.0, 0.16, cz + 6.2, 'supply', 'Compound Materials Crate');
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

    // 2. Large Multi-Room Field Hospital & Clinic (East Meadow: 340, 20) — 28m x 20m White Hospital + Ambulance Canopy + 6 Patient Rooms!
    {
      const cx = 340, cz = 20;
      const by = this.getTerrainHeight(cx, cz);
      this._addBuilding(cx, cz, 28, 20, 4.8, 'west', this._materials.whiteWall);
      this.pois.push({ name: 'CLINIC', x: cx, z: cz, color: '#69f0ae', threat: 'medium' });

      // Covered Ambulance Drop-Off Canopy on West Front Entrance (instantly recognizable hospital silhouette!)
      this._addBox(cx - 17.2, by + 3.8, cz, 6.4, 0.36, 7.6, this._materials.whiteWall, false);
      this._addBox(cx - 20.1, by + 1.9, cz - 3.4, 0.45, 3.8, 0.45, this._materials.metal, true);
      this._addBox(cx - 20.1, by + 1.9, cz + 3.4, 0.45, 3.8, 0.45, this._materials.metal, true);
      // Giant Green Medical Plus-in-Circle Sign on Ambulance Canopy & Roofline!
      this._addSignBoard(cx - 20.5, by + 5.1, cz, 8.2, 3.1, -Math.PI / 2, 'clinic');
      this._addSignBoard(cx, by + 6.2, cz - 10.3, 8.6, 3.2, Math.PI, 'clinic');
      this._addSignBoard(cx, by + 6.2, cz + 10.3, 8.6, 3.2, 0, 'clinic');
      // Extra panoramic hospital windows along West front facade
      this._addWindow(cx - 14.24, by + 2.5, cz - 6.0, 3.2, 1.55, -Math.PI / 2);
      this._addWindow(cx - 14.24, by + 2.5, cz + 6.0, 3.2, 1.55, -Math.PI / 2);

      // Front Triage & Reception Desk
      this._addBox(cx - 9.8, by + 0.55, cz - 3.0, 1.3, 1.1, 4.6, this._materials.crateMed, true);
      this._addWallFirstAidKit(cx - 7.5, cz - 9.55, 'north', 'Clinic Lobby First Aid Kit');

      // Central Corridor + 6 Partitioned Patient / ICU / Pharmacy Rooms (3 North, 3 South) ALL WITH INTERACTIVE DOORS!
      for (const side of [-1, 1]) {
        const wallZ = cz + side * 2.2;
        const roomZ = cz + side * 6.0;
        const bedZ = cz + side * 7.2;
        // Longitudinal corridor wall segments leaving 3 wide doorways
        for (const rx of [cx - 4.5, cx + 2.5, cx + 9.5]) {
          this._addBox(rx - 3.5, by + 2.25, roomZ, 0.24, 4.5, 7.6, this._materials.whiteWall, true);
          this._addBox(rx + 1.0, by + 2.25, wallZ, 4.4, 4.5, 0.24, this._materials.whiteWall, true);
          const roomNum = side === -1 ? (rx < 340 ? 'Exam 1' : (rx < 345 ? 'ICU 1' : 'Trauma')) : (rx < 340 ? 'Exam 2' : (rx < 345 ? 'Ward B' : 'Pharmacy'));
          this._addDoor(rx - 2.3, by + 0.16, wallZ, 1.75, 2.6, 0, `${roomNum} Door`, 'wood');
          addHospitalBed(rx + 0.6, by, bedZ, 0);
        }
      }

      // Medical loot across the hospital wings
      this._addWallFirstAidKit(cx + 13.55, cz - 5.2, 'east', 'Trauma Room First Aid Kit');
      this._addMedicineCabinet(cx + 9.4, cz + 9.55, 'south', 'Clinic Pharmacy Cabinet');
      this._addLootContainer(cx + 11.2, 0.16, cz - 4.2, 'hospital', 'Hospital Trauma Crate');
      this._addLootContainer(cx - 7.5, 0.16, cz - 7.8, 'hospital', 'Triage Supply Case');
      this._addLootContainer(cx + 4.0, 0.16, cz + 8.0, 'hospital', 'ICU Medical Cart');
      this._addMetalShelf(cx + 2.2, cz - 9.1, 0, [
        { id: 'bandage', qty: 3 }, { id: 'painkillers', qty: 2 }, { id: 'cloth_roll', qty: 2 }
      ]);
      this._addWorkbenchTable(cx - 6.8, cz + 1.8, 0, [
        { id: 'medkit', qty: 1 }, { id: 'painkillers', qty: 1 }, { id: 'water_filter', qty: 1 }
      ]);
      this._addBarrier(cx - 22, cz - 7, false);
    }

    // 3A. Large 2-Story Police Precinct Headquarters (SW West Pad: -295, 310 — 24m x 18m w/ Front Portico & Wide Central Stairs!)
    {
      const pcx = -295, pcz = 310;
      const pby = this.getTerrainHeight(pcx, pcz);
      this.pois.push({ name: 'POLICE STATION', x: pcx, z: pcz, color: '#42a5f5', threat: 'low' });

      const pw = 24, pd = 18, ph = 4.4;
      this._addBox(pcx, pby - 0.5, pcz, pw + 0.8, 1.0, pd + 0.8, this._materials.darkConcrete, false);
      this._addBox(pcx, pby + 0.08, pcz, pw, 0.16, pd, this._materials.floorTile, false);
      // Limestone lower base + Navy-Blue 2-story precinct walls
      this._addBox(pcx, pby + ph, pcz - pd / 2, pw, ph * 2, 0.52, this._materials.policeNavy, true);
      this._addBox(pcx, pby + ph, pcz + pd / 2, pw, ph * 2, 0.52, this._materials.policeNavy, true);
      this._addBox(pcx - pw / 2, pby + ph, pcz, 0.52, ph * 2, pd, this._materials.policeNavy, true);
      // East Front Entrance Wall with Interactive Double-Width Door + Covered Precinct Portico Canopy
      this._addBox(pcx + pw / 2, pby + ph / 2, pcz - 5.0, 0.52, ph, 8.0, this._materials.policeNavy, true);
      this._addBox(pcx + pw / 2, pby + ph / 2, pcz + 5.0, 0.52, ph, 8.0, this._materials.policeNavy, true);
      this._addBox(pcx + pw / 2, pby + ph - 0.85, pcz, 0.52, 1.7, 2.0, this._materials.policeNavy, true);
      this._addDoor(pcx + pw / 2, pby + 0.16, pcz, 2.0, 2.65, Math.PI / 2, 'Police Precinct Entrance', 'steel');
      this._addBox(pcx + pw / 2, pby + ph * 1.5, pcz, 0.52, ph, pd, this._materials.policeNavy, true);
      // Front Portico Overhang & Columns
      this._addBox(pcx + pw / 2 + 2.4, pby + 3.7, pcz, 4.4, 0.34, 6.2, this._materials.whiteWall, false);
      this._addBox(pcx + pw / 2 + 4.2, pby + 1.85, pcz - 2.6, 0.42, 3.7, 0.42, this._materials.whiteWall, true);
      this._addBox(pcx + pw / 2 + 4.2, pby + 1.85, pcz + 2.6, 0.42, 3.7, 0.42, this._materials.whiteWall, true);
      // 1st & 2nd Floor Exterior Windows
      for (const wy of [pby + 2.4, pby + ph + 2.4]) {
        this._addWindow(pcx - 6.0, wy, pcz - pd / 2 - 0.25, 2.8, 1.45, Math.PI);
        this._addWindow(pcx + 0.0, wy, pcz - pd / 2 - 0.25, 2.8, 1.45, Math.PI);
        this._addWindow(pcx + 6.0, wy, pcz - pd / 2 - 0.25, 2.8, 1.45, Math.PI);
        this._addWindow(pcx - 6.0, wy, pcz + pd / 2 + 0.25, 2.8, 1.45, 0);
        this._addWindow(pcx + 6.0, wy, pcz + pd / 2 + 0.25, 2.8, 1.45, 0);
        this._addWindow(pcx + pw / 2 + 0.25, wy, pcz - 5.2, 2.6, 1.45, Math.PI / 2);
        this._addWindow(pcx + pw / 2 + 0.25, wy, pcz + 5.2, 2.6, 1.45, Math.PI / 2);
      }
      // Giant POLICE rooftop signage + glowing blue/red rooftop precinct beacons
      this._addSignBoard(pcx + pw / 2 + 0.4, pby + ph * 2 + 1.65, pcz, 9.2, 3.2, Math.PI / 2, 'police');
      this._addSignBoard(pcx, pby + ph * 2 + 1.65, pcz - pd / 2 - 0.4, 9.2, 3.2, Math.PI, 'police');
      this._addBox(pcx + 3, pby + ph * 2 + 0.6, pcz - 2.4, 2.6, 0.5, 0.65, new THREE.MeshBasicMaterial({ color: 0x2979ff }), false);
      this._addBox(pcx + 3, pby + ph * 2 + 0.6, pcz + 2.4, 2.6, 0.5, 0.65, new THREE.MeshBasicMaterial({ color: 0xff3d3d }), false);

      // 2nd Floor Slab with wide open central-east stairwell cutout (around pcx + 5.2, generous 3.2m clearance from east wall!)
      this._addBox(pcx - 4.2, pby + ph, pcz, 15.6, 0.28, pd - 0.4, this._materials.darkConcrete, true);
      this._addBox(pcx + 9.4, pby + ph, pcz, 5.0, 0.28, pd - 0.4, this._materials.darkConcrete, true);
      this._addBox(pcx + 5.2, pby + ph, pcz - 5.5, 3.4, 0.28, 6.6, this._materials.darkConcrete, true);
      this._addBox(pcx, pby + ph * 2 + 0.15, pcz, pw + 0.6, 0.32, pd + 0.6, this._materials.roofTar, true);

      // Ground Floor: Grand Booking Desk & Holding Area
      this._addBox(pcx + 1.2, pby + 0.55, pcz - 3.6, 1.2, 1.1, 5.2, this._materials.wood, true);
      // Ground Floor: 4-Cell Cell Block along West Wall
      for (let cell = 0; cell < 4; cell++) {
        const czCell = pcz - 6.3 + cell * 4.2;
        if (cell > 0) {
          this._addBox(pcx - 9.2, pby + 2.1, czCell - 2.1, 5.0, 4.2, 0.22, this._materials.interiorPlaster, true);
        }
        for (let b = 0; b < 5; b++) {
          this._addBox(pcx - 6.7, pby + 2.1, czCell - 1.5 + b * 0.48, 0.09, 4.2, 0.09, this._materials.metal, true);
        }
        this._addBox(pcx - 10.9, pby + 0.42, czCell, 0.9, 0.42, 2.2, this._materials.metal, true);
      }
      this._addGunLocker(pcx - 1.2, pcz - 8.1, 0, 'police_fire', 'Booking Armory Locker');
      this._addWallFirstAidKit(pcx + 5.6, pcz - 8.55, 'north', 'Precinct First Aid Kit');

      // Wide, Gentle Walkable Interior Staircase (18 steps @ 0.24m rise, 2.8m wide, well away from walls!)
      addStaircase(pcx + 5.2, pby + 0.16, pcz + 6.4, 18, 2.8, ph, 7.6, 'north');

      // 2nd Floor: Detective Bullpen Desks (6 desks)
      const f2y = pby + ph + 0.16;
      addDeskProp(pcx + 1.8, f2y, pcz - 5.0);
      addDeskProp(pcx + 1.8, f2y, pcz - 0.8);
      addDeskProp(pcx + 1.8, f2y, pcz + 3.6);
      addDeskProp(pcx - 1.8, f2y, pcz - 5.0);
      addDeskProp(pcx - 1.8, f2y, pcz - 0.8);
      addDeskProp(pcx - 1.8, f2y, pcz + 3.6);

      // 2nd Floor: Evidence Processing Room & Vault WITH INTERACTIVE STEEL DOOR!
      this._addBox(pcx - 5.2, f2y + 2.1, pcz - 2.8, 0.24, 4.2, 11.4, this._materials.interiorPlaster, true);
      this._addBox(pcx - 9.4, f2y + 2.1, pcz + 2.8, 4.6, 4.2, 0.24, this._materials.interiorPlaster, true);
      this._addDoor(pcx - 6.1, f2y, pcz + 2.8, 1.8, 2.6, 0, 'Evidence Room Door', 'steel');
      this._addLootContainer(pcx - 10.2, ph + 0.16, pcz - 6.4, 'military', 'Evidence Locker Vault');
      this._addLootContainer(pcx - 10.2, ph + 0.16, pcz - 1.6, 'police_fire', 'Evidence Processing Case');
      this._addWorkbenchTable(pcx - 8.2, pcz - 3.8, 0, [
        { id: 'intel_drive', qty: 1 }, { id: 'armor_plate', qty: 2 }, { id: 'medkit', qty: 1 }
      ]);
      this._decorateFacade(pcx, pcz, pw, pd, ph * 2, pby, {
        doorSide: 'east',
        wallMat: this._materials.policeNavy,
        roofOffset: 0.31,
        lightH: ph - 0.14,
        stairwellAvoidX: pcx + 3.0
      });
    }

    // 3B. Large 3-Bay Fire Station + Living Wing + Spacious 8m x 8m Climbable Watch Tower (SW East Pad: -195, 315)
    {
      const fcx = -195, fcz = 315;
      const fby = this.getTerrainHeight(fcx, fcz);
      this.pois.push({ name: 'FIRE STATION', x: fcx, z: fcz, color: '#ef5350', threat: 'low' });

      const fw = 22, fd = 16, fh = 5.6;
      this._addBox(fcx, fby - 0.5, fcz, fw + 0.8, 1.0, fd + 0.8, this._materials.darkConcrete, false);
      this._addBox(fcx, fby + 0.08, fcz, fw, 0.16, fd, this._materials.floorTile, false);
      // Clean watertight Fire Red brick-style outer walls
      this._addBox(fcx, fby + fh / 2, fcz - fd / 2, fw, fh, 0.52, this._materials.fireRed, true);
      this._addBox(fcx - fw / 2, fby + fh / 2, fcz, 0.52, fh, fd, this._materials.fireRed, true);
      this._addBox(fcx + fw / 2, fby + fh / 2, fcz, 0.52, fh, fd, this._materials.fireRed, true);
      // Crisp white architectural cornice trim & rear/side windows
      this._addBox(fcx, fby + fh - 0.2, fcz + fd / 2 + 0.28, fw, 0.4, 0.18, this._materials.whiteWall, false);
      this._addWindow(fcx - 6.5, fby + 3.0, fcz - fd / 2 - 0.25, 2.8, 1.5, Math.PI);
      this._addWindow(fcx + 0.0, fby + 3.0, fcz - fd / 2 - 0.25, 2.8, 1.5, Math.PI);
      this._addWindow(fcx + 6.5, fby + 3.0, fcz - fd / 2 - 0.25, 2.8, 1.5, Math.PI);
      this._addWindow(fcx - fw / 2 - 0.25, fby + 3.0, fcz - 3.0, 2.8, 1.5, -Math.PI / 2);
      this._addWindow(fcx - fw / 2 - 0.25, fby + 3.0, fcz + 3.0, 2.8, 1.5, -Math.PI / 2);
      // Giant FIRE DEPT sign over 3 wide garage bays!
      this._addSignBoard(fcx, fby + fh + 1.75, fcz + fd / 2 + 0.3, 9.6, 3.3, 0, 'fire');
      this._addSignBoard(fcx, fby + fh + 1.75, fcz - fd / 2 - 0.3, 9.6, 3.3, Math.PI, 'fire');
      // South Garage Face: 3 Wide Open Fire-Truck Engine Bays (5.4m wide each)
      this._addBox(fcx - fw / 2 + 0.9, fby + fh / 2, fcz + fd / 2, 1.8, fh, 0.52, this._materials.fireRed, true);
      this._addBox(fcx - 3.6, fby + fh / 2, fcz + fd / 2, 1.3, fh, 0.52, this._materials.fireRed, true);
      this._addBox(fcx + 3.6, fby + fh / 2, fcz + fd / 2, 1.3, fh, 0.52, this._materials.fireRed, true);
      this._addBox(fcx + fw / 2 - 0.9, fby + fh / 2, fcz + fd / 2, 1.8, fh, 0.52, this._materials.fireRed, true);
      this._addBox(fcx, fby + fh - 0.7, fcz + fd / 2, fw, 1.4, 0.56, this._materials.whiteWall, true);
      this._addBox(fcx, fby + fh + 0.16, fcz, fw + 0.5, 0.32, fd + 0.5, this._materials.roofTar, true);
      this._decorateFacade(fcx, fcz, fw, fd, fh, fby, {
        doorSide: 'south',
        wallMat: this._materials.fireRed,
        roofOffset: 0.32,
        skipDoorFrame: true
      });

      // Garage Equipment Lockers, Bunks & Workbench
      this._addGunLocker(fcx - 9.8, fcz - 3.0, Math.PI / 2, 'police_fire', 'Fire & Rescue Gear Locker');
      this._addGunLocker(fcx - 9.8, fcz + 2.0, Math.PI / 2, 'police_fire', 'Emergency Hazmat Locker');
      this._addLootContainer(fcx + 8.6, 0.16, fcz - 6.0, 'supply', 'Firehouse Tool & Medical Crate');
      this._addWorkbenchTable(fcx, fcz - 5.8, 0, [
        { id: 'smoke_grenade', qty: 1 }, { id: 'medkit', qty: 1 }, { id: 'armor_plate', qty: 2 }
      ]);

      // Spacious 8m x 8m Climbable Hose / Watch Tower (13.2m tall, wide 2.6m gentle stairs, zero wall-snags!)
      const tcx = fcx + fw / 2 + 4.3, tcz = fcz - 3.6;
      const tw = 8.0, td = 8.0, th = 13.2;
      this._addBox(tcx, fby + 0.08, tcz, tw, 0.16, td, this._materials.darkConcrete, false);
      this._addBox(tcx, fby + th / 2, tcz - td / 2, tw, th, 0.44, this._materials.fireRed, true);
      this._addBox(tcx + tw / 2, fby + th / 2, tcz, 0.44, th, td, this._materials.fireRed, true);
      this._addBox(tcx - tw / 2, fby + (th + fh) / 2, tcz, 0.44, th - fh, td, this._materials.fireRed, true);
      // South Tower Wall with clean ground entrance doorway
      this._addBox(tcx + 1.9, fby + 1.4, tcz + td / 2, 4.2, 2.8, 0.44, this._materials.fireRed, true);
      this._addBox(tcx - 3.2, fby + 1.4, tcz + td / 2, 1.6, 2.8, 0.44, this._materials.fireRed, true);
      this._addBox(tcx, fby + 2.8 + (th - 2.8) / 2, tcz + td / 2, tw, th - 2.8, 0.44, this._materials.fireRed, true);
      this._addDoor(tcx - 1.3, fby + 0.16, tcz + td / 2, 2.0, 2.65, 0, 'Watch Tower Door', 'steel');
      this._addWindow(tcx + tw / 2 + 0.22, fby + 6.4, tcz, 2.4, 1.6, Math.PI / 2);
      this._addWindow(tcx + tw / 2 + 0.22, fby + 10.6, tcz, 2.4, 1.6, Math.PI / 2);

      // 3 Wide, Gentle Walkable Stair Flights (18 steps @ 0.24m rise, 2.6m wide!) + Spacious 2.4m Landings
      addStaircase(tcx - 1.9, fby + 0.16, tcz + 2.6, 18, 2.6, 4.4, 4.8, 'north');
      this._addBox(tcx, fby + 4.4, tcz - 2.7, 7.2, 0.24, 2.2, this._materials.darkConcrete, true);
      addStaircase(tcx + 1.9, fby + 4.4, tcz - 1.6, 18, 2.6, 4.4, 4.8, 'south');
      this._addBox(tcx, fby + 8.8, tcz + 2.7, 7.2, 0.24, 2.2, this._materials.darkConcrete, true);
      addStaircase(tcx - 1.9, fby + 8.8, tcz + 1.6, 18, 2.6, 4.4, 4.8, 'north');
      const topY = fby + 13.2;
      this._addBox(tcx + 1.6, topY, tcz, 4.4, 0.26, td, this._materials.darkConcrete, true);
      this._addBox(tcx - 2.0, topY, tcz - 2.7, 3.2, 0.26, 2.4, this._materials.darkConcrete, true);
      this._addBox(tcx, topY + 0.55, tcz - td / 2 + 0.2, tw, 1.1, 0.2, this._materials.whiteWall, true);
      this._addBox(tcx, topY + 0.55, tcz + td / 2 - 0.2, tw, 1.1, 0.2, this._materials.whiteWall, true);
      this._addBox(tcx - tw / 2 + 0.2, topY + 0.55, tcz, 0.2, 1.1, td, this._materials.whiteWall, true);
      this._addBox(tcx + tw / 2 - 0.2, topY + 0.55, tcz, 0.2, 1.1, td, this._materials.whiteWall, true);
      this._addBox(tcx + 3.2, topY + 1.9, tcz - 3.2, 0.24, 1.8, 0.24, this._materials.metal, false);
      this._addBox(tcx + 3.2, topY + 2.9, tcz - 3.2, 0.65, 0.65, 0.65, new THREE.MeshBasicMaterial({ color: 0xff3b3b }), false);
      this._addLootContainer(tcx + 1.8, 13.35, tcz - 1.8, 'military', 'Fire Tower Overwatch Case');
    }

    // 4. Massive Boss Encampment Compound (NE: 310, -270 — 70m x 64m Walls, 4 Corner Guard Towers, Barracks, 3 Tents & 24m x 20m 2-Story Command HQ!)
    {
      const cx = 310, cz = -270;
      const by = this.getTerrainHeight(cx, cz);
      this.pois.push({ name: 'BOSS CAMP', x: cx, z: cz, color: '#ffc107', threat: 'boss' });

      // A. High Fortified Concrete Perimeter Compound Walls (70m x 64m) + 4 Corner Guard Watch Platforms!
      const cw = 70, cd = 64, wallH = 4.6;
      this._addBox(cx, by + wallH / 2, cz - cd / 2, cw, wallH, 0.85, this._materials.bossDark, true);
      this._addBox(cx + cw / 2, by + wallH / 2, cz, 0.85, wallH, cd, this._materials.bossDark, true);
      this._addBox(cx - 19.5, by + wallH / 2, cz + cd / 2, 31, wallH, 0.85, this._materials.bossDark, true);
      this._addBox(cx + 19.5, by + wallH / 2, cz + cd / 2, 31, wallH, 0.85, this._materials.bossDark, true);
      this._addBox(cx - cw / 2, by + wallH / 2, cz - 18, 0.85, wallH, 28, this._materials.bossDark, true);
      this._addBox(cx - cw / 2, by + wallH / 2, cz + 18, 0.85, wallH, 28, this._materials.bossDark, true);
      // Amber hazard gate pillars & 4 elevated corner watch towers
      this._addBox(cx - 4.4, by + 3.6, cz + cd / 2, 1.0, 0.65, 1.0, this._materials.hazardAmber, false);
      this._addBox(cx + 4.4, by + 3.6, cz + cd / 2, 1.0, 0.65, 1.0, this._materials.hazardAmber, false);
      for (const [gx, gz] of [[-cw / 2 + 2.2, -cd / 2 + 2.2], [cw / 2 - 2.2, -cd / 2 + 2.2], [-cw / 2 + 2.2, cd / 2 - 2.2], [cw / 2 - 2.2, cd / 2 - 2.2]]) {
        this._addBox(cx + gx, by + 5.2, cz + gz, 4.4, 0.3, 4.4, this._materials.darkConcrete, true);
        this._addBox(cx + gx, by + 7.8, cz + gz, 4.6, 0.25, 4.6, this._materials.bossDark, false);
        this._addBox(cx + gx, by + 5.7, cz + gz, 4.4, 0.22, 4.4, this._materials.hazardAmber, false);
      }

      // B. Massive 24m x 20m 2-Story Central Command Center + Rooftop Radar Tower & Helipad!
      const ccw = 24, ccd = 20, cch = 4.6;
      this._addBox(cx, by - 0.5, cz - 2, ccw + 0.8, 1.0, ccd + 0.8, this._materials.darkConcrete, false);
      this._addBox(cx, by + 0.08, cz - 2, ccw, 0.16, ccd, this._materials.floorTile, false);
      this._addBox(cx - ccw / 2, by + cch, cz - 2, 0.55, cch * 2, ccd, this._materials.bossDark, true);
      this._addBox(cx + ccw / 2, by + cch, cz - 2, 0.55, cch * 2, ccd, this._materials.bossDark, true);
      this._addBox(cx - 6.6, by + cch / 2, cz - 2 + ccd / 2, 10.8, cch, 0.55, this._materials.bossDark, true);
      this._addBox(cx + 6.6, by + cch / 2, cz - 2 + ccd / 2, 10.8, cch, 0.55, this._materials.bossDark, true);
      this._addBox(cx, by + cch - 0.9, cz - 2 + ccd / 2, 2.4, 1.8, 0.55, this._materials.bossDark, true);
      this._addDoor(cx, by + 0.16, cz - 2 + ccd / 2, 2.2, 2.7, 0, 'Command HQ Entrance', 'steel');
      this._addBox(cx, by + cch * 1.5, cz - 2 + ccd / 2, ccw, cch, 0.55, this._materials.bossDark, true);
      this._addBox(cx, by + cch, cz - 2 - ccd / 2, ccw, cch * 2, 0.55, this._materials.bossDark, true);
      // 1st & 2nd Floor Command Center Windows
      for (const wy of [by + 2.5, by + cch + 2.5]) {
        this._addWindow(cx - 6.8, wy, cz - 2 + ccd / 2 + 0.28, 3.0, 1.35, 0);
        this._addWindow(cx + 6.8, wy, cz - 2 + ccd / 2 + 0.28, 3.0, 1.35, 0);
        this._addWindow(cx - ccw / 2 - 0.28, wy, cz - 6, 3.2, 1.35, -Math.PI / 2);
        this._addWindow(cx - ccw / 2 - 0.28, wy, cz + 2, 3.2, 1.35, -Math.PI / 2);
        this._addWindow(cx + ccw / 2 + 0.28, wy, cz - 6, 3.2, 1.35, Math.PI / 2);
        this._addWindow(cx + ccw / 2 + 0.28, wy, cz + 2, 3.2, 1.35, Math.PI / 2);
      }
      // Roof + Giant COMMAND HQ Signs + Tall Rooftop Radar Mast
      const roofY = by + cch * 2 + 0.15;
      this._addBox(cx, roofY, cz - 2, ccw + 0.6, 0.34, ccd + 0.6, this._materials.roofTar, true);
      this._addBox(cx, roofY + 0.38, cz - 2 + ccd / 2 + 0.15, ccw + 0.6, 0.4, 0.25, this._materials.hazardAmber, false);
      this._addSignBoard(cx, roofY + 2.0, cz - 2 + ccd / 2 + 0.35, 10.6, 3.6, 0, 'boss');
      this._addSignBoard(cx - ccw / 2 - 0.35, roofY + 2.0, cz - 2, 9.6, 3.4, -Math.PI / 2, 'boss');
      this._addBox(cx + 7.5, roofY + 5.0, cz - 7.5, 0.42, 10.0, 0.42, this._materials.metal, false);
      this._addBox(cx + 7.5, roofY + 8.4, cz - 7.5, 3.8, 1.6, 0.26, this._materials.hazardAmber, false);
      this._addBox(cx + 7.5, roofY + 10.2, cz - 7.5, 0.65, 0.65, 0.65, new THREE.MeshBasicMaterial({ color: 0xffb300 }), false);

      // 2nd Floor Slab with wide inset stairwell (cx + 6.6, generous clearance from east wall!)
      this._addBox(cx - 3.6, by + cch, cz - 2, 16.8, 0.3, ccd - 0.4, this._materials.darkConcrete, true);
      this._addBox(cx + 10.1, by + cch, cz - 2, 3.6, 0.3, ccd - 0.4, this._materials.darkConcrete, true);
      this._addBox(cx + 6.6, by + cch, cz - 7.4, 3.6, 0.3, 8.8, this._materials.darkConcrete, true);
      // Wide, Gentle Walkable Staircase (19 steps @ 0.24m rise, 2.8m wide!)
      addStaircase(cx + 6.6, by + 0.16, cz + 5.8, 19, 2.8, cch, 8.4, 'north');

      // Ground Floor War-Room Table & 2nd Floor Boss Key Vault Room (with sub-room steel door!)
      this._addWorkbenchTable(cx - 1.8, cz - 1.5, 0, [
        { id: 'ammo_762', qty: 30 }, { id: 'gold_watch', qty: 1 }, { id: 'intel_drive', qty: 1 }
      ]);
      this._addGunLocker(cx - 10.8, cz - 2.5, Math.PI / 2, 'military', 'Command Center Armory Locker');
      this._addWallFirstAidKit(cx - 11.45, cz + 2.4, 'west', 'Command Center First Aid Kit');
      addDeskProp(cx - 2.0, by + cch + 0.16, cz - 6.5);
      this._addBox(cx - 4.6, by + cch + 2.2, cz - 7.2, 0.24, 4.2, 8.8, this._materials.interiorPlaster, true);
      this._addDoor(cx - 4.6, by + cch + 0.16, cz - 1.8, 1.8, 2.6, Math.PI / 2, 'Command Vault Door', 'steel');
      this._addLootContainer(cx - 8.4, cch + 0.18, cz - 9.2, 'boss_key_room', 'Boss Command Vault [KEY ROOM]', 'boss_key');
      this._addLootContainer(cx + 3.2, cch + 0.18, cz - 9.2, 'military', 'Command Center Weapons Case');
      this._decorateFacade(cx, cz - 2, ccw, ccd, cch * 2, by, {
        doorSide: 'south',
        wallMat: this._materials.bossDark,
        roofOffset: 0.32,
        lightH: cch - 0.15,
        stairwellAvoidX: cx + 4.2
      });

      // Boss Spawn inside 2nd Floor Command Center + 5 Armored Boss Guard Spawns
      this.bossSpawnPos = new THREE.Vector3(cx - 1.5, by + cch + 0.2, cz - 2.5);
      this.bossGuardSpawns = [
        new THREE.Vector3(cx - 2.0, by, cz + 2.8),
        new THREE.Vector3(cx + 3.5, by, cz - 3.5),
        new THREE.Vector3(cx - 14.0, by, cz + 20.0),
        new THREE.Vector3(cx + 14.0, by, cz + 18.0),
        new THREE.Vector3(cx - 20.0, by, cz - 12.0)
      ];

      // C. Compound Barracks Building (16m x 12m, West-South)
      const bx = cx - 22, bz = cz + 16;
      this._addBuilding(bx, bz, 16, 12, 4.4, 'east', this._materials.rustOlive, (bBaseY, bH) => {
        this._addPartition(bx - 1.8, bz - 6.0, bx - 1.8, bz + 6.0, bBaseY, bH, [
          { at: bz, w: 1.8, door: null }
        ]);
        this._addBox(bx - 2.8, bBaseY + 0.41, bz - 1.7, 0.9, 0.5, 0.5, this._materials.crateMil, true);
        this._addBox(bx - 2.8, bBaseY + 0.41, bz + 1.7, 0.9, 0.5, 0.5, this._materials.crateMil, true);
      });
      addHospitalBed(bx - 4.6, by, bz - 3.4, Math.PI / 2);
      addHospitalBed(bx - 4.6, by, bz + 0.0, Math.PI / 2);
      addHospitalBed(bx - 4.6, by, bz + 3.4, Math.PI / 2);
      this._addGunLocker(bx + 2.6, bz - 5.1, 0, 'military', 'Barracks Rifle Rack');
      this._addLootContainer(bx + 2.6, 0.16, bz + 4.4, 'supply', 'Barracks Footlocker');

      // D. 3 Large Military Canvas Tents with Weapons Lockers & Equipment Containers
      const tentSpots = [
        { x: cx + 23, z: cz + 15, label: 'East Armory Tent' },
        { x: cx + 23, z: cz - 7, label: 'Ordnance Supply Tent' },
        { x: cx - 22, z: cz - 17, label: 'Recon Gear Tent' }
      ];
      for (const ts of tentSpots) {
        addMilitaryTent(ts.x, by, ts.z, 9.6, 7.0);
        this._addGunLocker(ts.x - 3.6, ts.z - 1.4, Math.PI / 2, 'military', `${ts.label} Weapons Locker`);
        this._addLootContainer(ts.x + 3.0, 0.16, ts.z + 1.4, 'military', `${ts.label} Equipment Container`);
      }

      this._addBarrier(cx - 8, cz + 22, true);
      this._addBarrier(cx + 8, cz + 22, true);
      this._addContainer(cx + 20, cz - 24, 0, this._materials.rustOlive);
    }

    // 5. Enlarged Central Logistics Warehouse (Crossroads Hub: 0, 0 — 28m x 18m w/ Walkable Catwalk Mezzanine!)
    {
      const cx = 0, cz = 0;
      const by = this.getTerrainHeight(cx, cz);
      this._addBuilding(cx, cz, 28, 18, 6.2, 'south', null, (wBy, wH) => {
        // SW Foreman Office
        this._addPartition(-8.5, 2.5, -8.5, 9.0, wBy, wH, [
          { at: 5.5, w: 1.7, door: 'wood', label: 'Foreman Office' }
        ]);
        this._addPartition(-14.0, 2.5, -8.5, 2.5, wBy, wH, []);
        addDeskProp(-11.6, wBy + 0.16, 5.2);
        this._addLootContainer(-12.2, 0.16, 7.4, 'supply', "Foreman's Office Safe");

        // Supply Pallet Stacks for Interior Cover
        this._addBox(-5.5, wBy + 0.7, 5.0, 2.4, 1.4, 1.2, this._materials.crateSup, true);
        this._addBox(5.5, wBy + 0.7, 5.0, 2.4, 1.4, 1.2, this._materials.crateSup, true);

        // Catwalk Railing (x: -12.5..8.0 and 10.4..12.5, leaving 2.4m arrival gap at stairs!)
        this._addBox(-2.25, wBy + 3.85, -5.05, 20.5, 1.0, 0.08, this._materials.metal, true);
        this._addBox(11.45, wBy + 3.85, -5.05, 2.1, 1.0, 0.08, this._materials.metal, true);
      });
      this.pois.push({ name: 'WAREHOUSE', x: cx, z: cz, color: '#ff9800', threat: 'low' });
      // Interior Walkable Steel Catwalk Mezzanine along North Wall + Gentle Stairs
      this._addBox(cx, by + 3.2, cz - 6.8, 25.0, 0.24, 3.6, this._materials.metal, true);
      addStaircase(cx + 9.2, by + 0.16, cz - 0.4, 14, 2.2, 3.2, 4.8, 'north');
      this._addLootContainer(cx - 10.5, 3.35, cz - 6.8, 'military', 'Catwalk Armory Case');
      this._addLootContainer(cx - 10.8, 0.16, cz - 6.2, 'military', 'Warehouse Armory Case');
      this._addLootContainer(cx + 10.8, 0.16, cz - 6.2, 'supply', 'Logistics Cargo Crate');
      this._addMetalShelf(cx - 4.0, cz - 7.4, 0, [
        { id: 'scrap_metal', qty: 3 }, { id: 'polymer_parts', qty: 2 }, { id: 'ammo_545', qty: 24 }
      ]);
      this._addMetalShelf(cx + 4.0, cz - 7.4, 0, [
        { id: 'cloth_roll', qty: 2 }, { id: 'gunpowder', qty: 2 }, { id: 'fuel_can', qty: 1 }
      ]);
      this._addWorkbenchTable(cx, cz + 1.2, 0, [
        { id: 'medkit', qty: 1 }, { id: 'armor_plate', qty: 2 }
      ]);
    }

    // 6. Fuel & Radio Outpost (SE Low-Threat Hilltop: 270, 290)
    {
      const cx = 270, cz = 290;
      this._addBuilding(cx, cz, 14, 12, 4.4, 'west', null, (rBy, rH) => {
        this._addPartition(cx + 3.4, cz - 6.0, cx + 3.4, cz + 6.0, rBy, rH, [
          { at: cz + 1.0, w: 1.7, door: 'wood', label: 'Comms Room Door' }
        ]);
      });
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
      this._addBuilding(cx, cz, 12, 10, 4.5, 'south', null, (bBy, bH) => {
        // Interior blast wall forcing flank routes left/right on entry
        this._addBox(cx, bBy + bH * 0.5, cz + 2.2, 4.0, bH, 0.35, this._materials.concrete, true);
        // Sandbag firing cover
        this._addBox(cx - 3.4, bBy + 0.55, cz - 1.2, 2.2, 1.1, 0.6, this._materials.crateSup, true);
      });
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
    const terrainY = this.getTerrainHeight(pos.x, pos.z);
    const yBase = this.getSurfaceHeightAt(pos.x, pos.z, (pos.y !== undefined && pos.y > terrainY + 0.25) ? pos.y : null) + 0.02;
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

  setGraphicsOptions(gfx = {}) {
    const lod = gfx.lod ?? 3; // 1..4
    const lighting = gfx.lighting ?? 3; // 1..4
    const lodFrac = lod === 1 ? 0.35 : (lod === 2 ? 0.62 : (lod === 3 ? 0.85 : 1.0));
    if (this._pineMeshes && this._maxPines) {
      const c = Math.max(40, Math.round(this._maxPines * lodFrac));
      this._pineMeshes.forEach(m => { m.count = c; });
    }
    if (this._bushInst && this._maxBushes) {
      this._bushInst.count = Math.max(60, Math.round(this._maxBushes * lodFrac));
    }
    if (this.fogLayers) {
      const showMist = lighting >= 2;
      this.fogLayers.forEach(fl => { fl.mesh.visible = showMist; });
    }
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
