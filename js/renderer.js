// ============================================================================
// ASHFALL // Shared Rendering Engine, PBR Surface Bank, Instancer,
// Unified GPU Post-Pipeline & Deterministic Raid Memory Disposer
// ============================================================================
window.AshfallRenderer = (() => {
  const _texCache = new Map();
  const _geoCache = new Map();
  const _matCache = new Map();
  let _envMap = null;
  let _envAttempted = false;

  function _markShared(obj) {
    if (!obj) return obj;
    if (!obj.userData) obj.userData = {};
    obj.userData._ashShared = true;
    return obj;
  }

  function _seedRng(seed = 1337) {
    let s = seed | 1;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function _canvasTex(key, size, drawFn, opts = {}) {
    if (_texCache.has(key)) return _texCache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, size, _seedRng(opts.seed || key.split('').reduce((a, c) => ((a * 31 + c.charCodeAt(0)) | 0), 17)));
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = opts.wrapS || THREE.RepeatWrapping;
    tex.wrapT = opts.wrapT || THREE.RepeatWrapping;
    tex.magFilter = opts.magFilter || THREE.LinearFilter;
    tex.minFilter = opts.minFilter || THREE.LinearMipmapLinearFilter;
    tex.anisotropy = opts.anisotropy !== undefined ? opts.anisotropy : 4;
    if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
    _markShared(tex);
    _texCache.set(key, tex);
    return tex;
  }

  // --------------------------------------------------------------------------
  // 1. Canonical Shared Geometry Pool (zero redundant allocations)
  // --------------------------------------------------------------------------
  const GeoPool = {
    get(key, factoryFn) {
      if (_geoCache.has(key)) return _geoCache.get(key);
      const geo = factoryFn();
      _markShared(geo);
      _geoCache.set(key, geo);
      return geo;
    },
    unitBox() {
      return this.get('unitBox', () => new THREE.BoxGeometry(1, 1, 1));
    },
    unitCylinder(segs = 12) {
      return this.get(`unitCyl_${segs}`, () => new THREE.CylinderGeometry(1, 1, 1, segs));
    },
    unitPlane() {
      return this.get('unitPlane', () => new THREE.PlaneGeometry(1, 1));
    },
    sphere(wSeg = 10, hSeg = 8) {
      return this.get(`sphere_${wSeg}_${hSeg}`, () => new THREE.SphereGeometry(1, wSeg, hSeg));
    },
    ring(innerRatio = 0.72, segs = 20) {
      const k = `ring_${Number(innerRatio).toFixed(3)}_${segs}`;
      return this.get(k, () => new THREE.RingGeometry(innerRatio, 1.0, segs));
    }
  };

  // --------------------------------------------------------------------------
  // 2. Procedural PMREM Environment Map & Cached PBR Surface Texture Bank
  // --------------------------------------------------------------------------
  function getEnvMap(renderer) {
    if (_envMap) return _envMap;
    if (_envAttempted || !renderer || typeof THREE.PMREMGenerator !== 'function') return null;
    _envAttempted = true;
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      if (pmrem.compileEquirectangularShader) pmrem.compileEquirectangularShader();
      const envScene = new THREE.Scene();
      const domeGeo = new THREE.SphereGeometry(12, 16, 12);
      const c = document.createElement('canvas');
      c.width = 64; c.height = 32;
      const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 0, 32);
      grad.addColorStop(0.0, '#8ba6be');
      grad.addColorStop(0.42, '#50606b');
      grad.addColorStop(0.54, '#24292b');
      grad.addColorStop(1.0, '#121413');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 32);
      g.fillStyle = '#ffdfb2';
      g.fillRect(10, 6, 8, 5);
      const envTex = new THREE.CanvasTexture(c);
      const domeMat = new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide });
      const dome = new THREE.Mesh(domeGeo, domeMat);
      envScene.add(dome);
      const rt = pmrem.fromScene(envScene, 0.04);
      _envMap = rt.texture;
      _markShared(_envMap);
      domeGeo.dispose();
      domeMat.dispose();
      envTex.dispose();
      pmrem.dispose();
    } catch (e) {
      _envMap = null;
    }
    return _envMap;
  }

  function getSurfaceBank() {
    if (_texCache.has('concrete') && _texCache.has('concreteBump')) {
      return {
        ground: _texCache.get('ground'),
        concrete: _texCache.get('concrete'),
        concreteBump: _texCache.get('concreteBump'),
        plaster: _texCache.get('plaster'),
        brick: _texCache.get('brick'),
        brickBump: _texCache.get('brickBump'),
        siding: _texCache.get('siding'),
        sidingBump: _texCache.get('sidingBump'),
        floorTile: _texCache.get('floorTile'),
        floorTileBump: _texCache.get('floorTileBump'),
        wood: _texCache.get('wood'),
        roofTar: _texCache.get('roofTar'),
        asphalt: _texCache.get('asphalt'),
        metal: _texCache.get('metal'),
        metalBump: _texCache.get('metalBump'),
        grate: _texCache.get('grate'),
        grateBump: _texCache.get('grateBump'),
        crate: _texCache.get('crate')
      };
    }

    const ground = _canvasTex('ground', 256, (ctx, s, rnd) => {
      ctx.fillStyle = '#55573f';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = rnd() > 0.45 ? 'rgba(107,94,68,0.36)' : 'rgba(74,75,51,0.36)';
        ctx.beginPath(); ctx.arc(rnd() * s, rnd() * s, 8 + rnd() * 22, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 1100; i++) {
        ctx.fillStyle = rnd() > 0.5 ? 'rgba(42,40,30,0.36)' : 'rgba(128,120,92,0.24)';
        ctx.fillRect(rnd() * s, rnd() * s, 2, 2);
      }
      const cols = ['rgba(124,120,76,0.42)', 'rgba(94,96,62,0.46)', 'rgba(66,68,44,0.40)'];
      for (let i = 0; i < 1800; i++) {
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(rnd() * s, rnd() * s, 2, 2 + rnd() * 4);
      }
    }, { magFilter: THREE.NearestFilter, repeat: [110, 110] });

    const concrete = _canvasTex('concrete', 512, (ctx, s, rnd) => {
      ctx.fillStyle = '#babab6';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 6000; i++) {
        const v = 155 + Math.floor(rnd() * 55);
        ctx.fillStyle = `rgba(${v},${v},${v - 2},0.28)`;
        ctx.fillRect(rnd() * s, rnd() * s, 2 + rnd() * 3, 2 + rnd() * 3);
      }
      ctx.strokeStyle = 'rgba(80,80,76,0.38)';
      ctx.lineWidth = 2;
      for (let g = 128; g < s; g += 128) {
        ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(s, g); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, s); ctx.stroke();
      }
      for (let y = 64; y < s; y += 128) {
        for (let x = 64; x < s; x += 128) {
          ctx.fillStyle = 'rgba(65,65,62,0.58)';
          ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(218,218,212,0.42)';
          ctx.beginPath(); ctx.arc(x - 1, y - 1, 2.0, 0, Math.PI * 2); ctx.fill();
        }
      }
      for (let i = 0; i < 40; i++) {
        const x = rnd() * s, y = rnd() * (s * 0.6), h = 50 + rnd() * 140;
        const grad = ctx.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, 'rgba(60,60,57,0.18)');
        grad.addColorStop(1, 'rgba(60,60,57,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, 2 + rnd() * 4, h);
      }
    });

    const concreteBump = _canvasTex('concreteBump', 256, (ctx, s, rnd) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 3800; i++) {
        const v = 90 + Math.floor(rnd() * 80);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(rnd() * s, rnd() * s, 2, 2);
      }
      ctx.strokeStyle = '#383838';
      ctx.lineWidth = 2;
      for (let g = 64; g < s; g += 64) {
        ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(s, g); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, s); ctx.stroke();
      }
    });

    const plaster = _canvasTex('plaster', 512, (ctx, s, rnd) => {
      ctx.fillStyle = '#c4c2bc';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 7000; i++) {
        const v = 165 + Math.floor(rnd() * 55);
        ctx.fillStyle = `rgba(${v},${v},${v - 3},0.25)`;
        ctx.fillRect(rnd() * s, rnd() * s, 2, 2);
      }
      for (let i = 0; i < 24; i++) {
        const x = rnd() * s, y = rnd() * s, r = 18 + rnd() * 44;
        const g = ctx.createRadialGradient(x, y, 2, x, y, r);
        g.addColorStop(0, 'rgba(110,106,98,0.18)');
        g.addColorStop(1, 'rgba(110,106,98,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    });

    const brick = _canvasTex('brick', 512, (ctx, s, rnd) => {
      ctx.fillStyle = '#8d8478';
      ctx.fillRect(0, 0, s, s);
      const courses = 8, rowH = s / courses, cols = 4, colW = s / cols, mortar = 5;
      for (let r = 0; r < courses; r++) {
        const off = (r % 2) * (colW * 0.5);
        for (let c = -1; c <= cols; c++) {
          const bx = c * colW + off + mortar * 0.5, by = r * rowH + mortar * 0.5;
          const bw = colW - mortar, bh = rowH - mortar;
          ctx.fillStyle = `rgb(${132 + Math.floor(rnd() * 34)},${48 + Math.floor(rnd() * 22)},${38 + Math.floor(rnd() * 18)})`;
          ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = 'rgba(255,220,190,0.08)';
          ctx.fillRect(bx, by, bw, 4);
        }
      }
    });

    const brickBump = _canvasTex('brickBump', 256, (ctx, s) => {
      ctx.fillStyle = '#404040';
      ctx.fillRect(0, 0, s, s);
      const courses = 8, rowH = s / courses, cols = 4, colW = s / cols, mortar = 3;
      ctx.fillStyle = '#c8c8c8';
      for (let r = 0; r < courses; r++) {
        const off = (r % 2) * (colW * 0.5);
        for (let c = -1; c <= cols; c++) {
          ctx.fillRect(c * colW + off + mortar * 0.5, r * rowH + mortar * 0.5, colW - mortar, rowH - mortar);
        }
      }
    });

    const siding = _canvasTex('siding', 256, (ctx, s, rnd) => {
      ctx.fillStyle = '#b4b6b2';
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 16) {
        const g = ctx.createLinearGradient(x, 0, x + 16, 0);
        g.addColorStop(0.0, 'rgba(65,65,65,0.34)');
        g.addColorStop(0.28, 'rgba(235,235,235,0.26)');
        g.addColorStop(0.85, 'rgba(55,55,55,0.30)');
        g.addColorStop(1.0, 'rgba(65,65,65,0.34)');
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, 16, s);
      }
      for (let i = 0; i < 24; i++) {
        const x = Math.floor(rnd() * 16) * 16 + rnd() * 6, y = rnd() * 120, h = 35 + rnd() * 110;
        const rg = ctx.createLinearGradient(0, y, 0, y + h);
        rg.addColorStop(0, 'rgba(115,58,32,0.34)');
        rg.addColorStop(1, 'rgba(115,58,32,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(x, y, 2 + rnd() * 4, h);
      }
    });

    const sidingBump = _canvasTex('sidingBump', 256, (ctx, s) => {
      for (let x = 0; x < s; x += 16) {
        const g = ctx.createLinearGradient(x, 0, x + 16, 0);
        g.addColorStop(0.0, '#444'); g.addColorStop(0.5, '#d8d8d8'); g.addColorStop(1.0, '#444');
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, 16, s);
      }
    });

    const floorTile = _canvasTex('floorTile', 512, (ctx, s, rnd) => {
      ctx.fillStyle = '#bab6ae';
      ctx.fillRect(0, 0, s, s);
      const count = 4, step = s / count;
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          const v = 186 + Math.floor((rnd() - 0.5) * 14);
          ctx.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
          ctx.fillRect(c * step + 2, r * step + 2, step - 4, step - 4);
        }
      }
      ctx.strokeStyle = 'rgba(72,70,64,0.55)';
      ctx.lineWidth = 3;
      for (let g = 0; g <= s; g += step) {
        ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(s, g); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, s); ctx.stroke();
      }
    });

    const floorTileBump = _canvasTex('floorTileBump', 256, (ctx, s) => {
      ctx.fillStyle = '#c4c4c4';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#383838';
      ctx.lineWidth = 3;
      const step = s / 4;
      for (let g = 0; g <= s; g += step) {
        ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(s, g); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, s); ctx.stroke();
      }
    });

    const wood = _canvasTex('wood', 256, (ctx, s, rnd) => {
      ctx.fillStyle = '#b9a690';
      ctx.fillRect(0, 0, s, s);
      const planks = 6, ph = s / planks;
      for (let p = 0; p < planks; p++) {
        const y0 = p * ph, tone = 172 + Math.floor((rnd() - 0.5) * 26);
        ctx.fillStyle = `rgb(${tone + 10},${tone - 4},${tone - 22})`;
        ctx.fillRect(0, y0, s, ph - 2);
        ctx.fillStyle = 'rgba(55,40,26,0.45)';
        ctx.fillRect(0, y0 + ph - 2, s, 2);
        for (let g = 0; g < 16; g++) {
          ctx.fillStyle = rnd() > 0.5 ? 'rgba(85,62,42,0.18)' : 'rgba(235,220,198,0.12)';
          ctx.fillRect(0, y0 + rnd() * (ph - 3), s, 1);
        }
      }
    });

    const roofTar = _canvasTex('roofTar', 256, (ctx, s, rnd) => {
      ctx.fillStyle = '#9e9c98';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 4200; i++) {
        const v = 115 + Math.floor(rnd() * 80);
        ctx.fillStyle = `rgba(${v},${v},${v - 2},0.34)`;
        ctx.fillRect(rnd() * s, rnd() * s, 2.2, 2.2);
      }
    });

    const asphalt = _canvasTex('asphalt', 512, (ctx, s, rnd) => {
      ctx.fillStyle = '#a8a8a4';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 9000; i++) {
        const v = 110 + Math.floor(rnd() * 95);
        ctx.fillStyle = `rgba(${v},${v},${v - 2},0.32)`;
        ctx.fillRect(rnd() * s, rnd() * s, 2, 2);
      }
      ctx.strokeStyle = 'rgba(42,42,42,0.45)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 8; i++) {
        let cx = rnd() * s, cy = rnd() * s;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        for (let k = 0; k < 8; k++) { cx += (rnd() - 0.5) * 38; cy += (rnd() - 0.5) * 38; ctx.lineTo(cx, cy); }
        ctx.stroke();
      }
    });

    const metal = _canvasTex('metal', 256, (ctx, s, rnd) => {
      ctx.fillStyle = '#babec2';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 420; i++) {
        ctx.fillStyle = rnd() > 0.5 ? 'rgba(235,240,244,0.18)' : 'rgba(82,88,96,0.20)';
        ctx.fillRect(rnd() * s, rnd() * s, 18 + rnd() * 75, 1.2);
      }
    });

    const metalBump = _canvasTex('metalBump', 256, (ctx, s, rnd) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 500; i++) {
        const v = 105 + Math.floor(rnd() * 50);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(rnd() * s, rnd() * s, 20 + rnd() * 60, 1);
      }
    });

    const grate = _canvasTex('grate', 128, (ctx, s) => {
      ctx.fillStyle = '#3b4044';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#8b9298';
      for (let y = 0; y < s; y += 16) {
        for (let x = ((y >> 4) & 1) * 8; x < s; x += 16) {
          ctx.fillRect(x + 2, y + 5, 10, 4);
        }
      }
    });

    const grateBump = _canvasTex('grateBump', 128, (ctx, s) => {
      ctx.fillStyle = '#404040';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#e0e0e0';
      for (let y = 0; y < s; y += 16) {
        for (let x = ((y >> 4) & 1) * 8; x < s; x += 16) {
          ctx.fillRect(x + 2, y + 5, 10, 4);
        }
      }
    });

    const crate = _canvasTex('crate', 256, (ctx, s, rnd) => {
      ctx.fillStyle = '#c0beb4';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 1600; i++) {
        const v = 160 + Math.floor(rnd() * 55);
        ctx.fillStyle = `rgba(${v},${v - 2},${v - 6},0.22)`;
        ctx.fillRect(rnd() * s, rnd() * s, 6, 1.5);
      }
      ctx.strokeStyle = 'rgba(60,58,52,0.55)';
      ctx.lineWidth = 18;
      ctx.strokeRect(9, 9, s - 18, s - 18);
      ctx.fillStyle = 'rgba(42,42,38,0.55)';
      ctx.fillRect(42, 42, 54, 10);
      ctx.fillRect(42, 58, 34, 6);
    });

    return {
      ground, concrete, concreteBump, plaster, brick, brickBump,
      siding, sidingBump, floorTile, floorTileBump, wood, roofTar,
      asphalt, metal, metalBump, grate, grateBump, crate
    };
  }

  function getWorldMaterialSet(renderer = null) {
    if (_matCache.has('worldSet')) return _matCache.get('worldSet');
    const tx = getSurfaceBank();
    const envMap = getEnvMap(renderer || window.mainWebGLRenderer || null);
    const makeMat = (opts, tile, usePhong = true) => {
      const m = usePhong
        ? new THREE.MeshPhongMaterial({ specular: 0x22262a, shininess: 18, ...opts })
        : new THREE.MeshLambertMaterial(opts);
      m.userData.tile = tile;
      _markShared(m);
      return m;
    };

    const windowGlassMat = new THREE.MeshPhongMaterial({
      color: 0x1d2c36,
      specular: 0xb8d8f0,
      shininess: 110,
      envMap,
      reflectivity: 0.45,
      transparent: true,
      opacity: 0.72
    });
    windowGlassMat.userData.tile = 2.0;
    _markShared(windowGlassMat);

    const set = {
      ground: _markShared(new THREE.MeshLambertMaterial({ map: tx.ground, vertexColors: true })),
      road: makeMat({ map: tx.asphalt, bumpMap: tx.concreteBump, bumpScale: 0.025, color: 0x6a6a68, specular: 0x2a2e32, shininess: 22, polygonOffset: true, polygonOffsetFactor: -2 }, 6.0),
      concrete: makeMat({ map: tx.concrete, bumpMap: tx.concreteBump, bumpScale: 0.035, color: 0x9a9a94 }, 3.0),
      darkConcrete: makeMat({ map: tx.concrete, bumpMap: tx.concreteBump, bumpScale: 0.04, color: 0x66665f }, 3.0),
      whiteWall: makeMat({ map: tx.plaster, bumpMap: tx.concreteBump, bumpScale: 0.015, color: 0xf0efe8 }, 2.5),
      policeNavy: makeMat({ map: tx.plaster, color: 0x3a5680 }, 2.5, false),
      fireRed: makeMat({ map: tx.brick, bumpMap: tx.brickBump, bumpScale: 0.04, color: 0xffffff }, 2.0),
      bossDark: makeMat({ map: tx.concrete, bumpMap: tx.concreteBump, bumpScale: 0.04, color: 0x3c3e42 }, 3.0),
      interiorPlaster: makeMat({ map: tx.plaster, bumpMap: tx.concreteBump, bumpScale: 0.015, color: 0xd9d4c8 }, 2.5),
      floorTile: makeMat({ map: tx.floorTile, bumpMap: tx.floorTileBump, bumpScale: 0.025, specular: 0x485058, shininess: 42, color: 0xcfcac0 }, 2.4),
      roofTar: makeMat({ map: tx.roofTar, bumpMap: tx.concreteBump, bumpScale: 0.02, color: 0x5a5a58 }, 3.0),
      hazardAmber: makeMat({ color: 0xd99b26 }, 2.0, false),
      windowGlass: windowGlassMat,
      windowFrame: makeMat({ map: tx.metal, bumpMap: tx.metalBump, bumpScale: 0.02, color: 0x2a2e32, envMap, reflectivity: 0.25, specular: 0x606870, shininess: 48 }, 1.5),
      doorWood: makeMat({ map: tx.wood, color: 0x7a5a3c, specular: 0x241a10, shininess: 16 }, 1.5),
      doorSteel: makeMat({ map: tx.metal, bumpMap: tx.metalBump, bumpScale: 0.025, color: 0x56606a, envMap, reflectivity: 0.28, specular: 0x6a7682, shininess: 54 }, 1.5),
      rustRed: makeMat({ map: tx.siding, bumpMap: tx.sidingBump, bumpScale: 0.045, color: 0x8c4a36 }, 2.0),
      rustOlive: makeMat({ map: tx.siding, bumpMap: tx.sidingBump, bumpScale: 0.045, color: 0x6d7558 }, 2.0),
      rustBlue: makeMat({ map: tx.siding, bumpMap: tx.sidingBump, bumpScale: 0.045, color: 0x46627a }, 2.0),
      wood: makeMat({ map: tx.wood, color: 0x8a6a4a }, 1.5, false),
      metal: makeMat({ map: tx.metal, bumpMap: tx.metalBump, bumpScale: 0.02, color: 0x6a6e72, envMap, reflectivity: 0.30, specular: 0x7a8490, shininess: 58 }, 1.5),
      grate: makeMat({ map: tx.grate, bumpMap: tx.grateBump, bumpScale: 0.035, color: 0x6b7076, envMap, reflectivity: 0.22, specular: 0x707880, shininess: 46 }, 1.0),
      crateMil: makeMat({ map: tx.crate, color: 0x55683f }, 1.2, false),
      crateMed: makeMat({ map: tx.plaster, color: 0xe8ece8 }, 2.5, false),
      crateSup: makeMat({ map: tx.crate, color: 0x9a7444 }, 1.2, false)
    };
    _matCache.set('worldSet', set);
    return set;
  }

  // --------------------------------------------------------------------------
  // 3. Spatial Instanced Prop Batcher
  // --------------------------------------------------------------------------
  class InstancedPropBatcher {
    constructor(cellSize = 96) {
      this.cellSize = cellSize;
      this.buckets = new Map();
    }
    add(geo, mat, matrix, castShadow = false) {
      if (!geo || !mat || !matrix) return;
      const ex = matrix.elements[12];
      const ez = matrix.elements[14];
      const cx = Math.floor(ex / this.cellSize);
      const cz = Math.floor(ez / this.cellSize);
      const key = `${geo.uuid}|${mat.uuid}|${cx}|${cz}`;
      let b = this.buckets.get(key);
      if (!b) {
        b = { geo, mat, matrices: [], castShadow: false };
        this.buckets.set(key, b);
      }
      if (castShadow) b.castShadow = true;
      b.matrices.push(matrix.clone ? matrix.clone() : matrix);
    }
    flush(scene, outList = null) {
      for (const b of this.buckets.values()) {
        const n = b.matrices.length;
        if (n === 0) continue;
        const inst = new THREE.InstancedMesh(b.geo, b.mat, n);
        inst.castShadow = b.castShadow;
        inst.receiveShadow = true;
        inst.matrixAutoUpdate = false;
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (let i = 0; i < n; i++) {
          const m = b.matrices[i];
          inst.setMatrixAt(i, m);
          const x = m.elements[12], y = m.elements[13], z = m.elements[14];
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
        inst.instanceMatrix.needsUpdate = true;
        if (!b.geo.boundingSphere) b.geo.computeBoundingSphere();
        const pad = b.geo.boundingSphere ? b.geo.boundingSphere.radius : 2.0;
        const cx = (minX + maxX) * 0.5;
        const cy = (minY + maxY) * 0.5;
        const cz = (minZ + maxZ) * 0.5;
        inst.boundingSphere = new THREE.Sphere(
          new THREE.Vector3(cx, cy, cz),
          Math.hypot(maxX - cx, maxY - cy, maxZ - cz) + pad + 1.0
        );
        inst.frustumCulled = true;
        inst.updateMatrix();
        if (scene) scene.add(inst);
        if (outList) outList.push(inst);
      }
      this.buckets.clear();
    }
  }

  // --------------------------------------------------------------------------
  // 4. Deterministic GPU Memory Disposer (0-leak across Raid <-> Zavod cycles)
  // --------------------------------------------------------------------------
  function _disposeMat(mat, seen) {
    if (!mat || seen.has(mat)) return;
    if (mat.userData && mat.userData._ashShared) return;
    seen.add(mat);
    const mapKeys = ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap'];
    for (let i = 0; i < mapKeys.length; i++) {
      const tex = mat[mapKeys[i]];
      if (tex && !seen.has(tex) && !(tex.userData && tex.userData._ashShared)) {
        seen.add(tex);
        if (typeof tex.dispose === 'function') tex.dispose();
      }
    }
    if (typeof mat.dispose === 'function') mat.dispose();
  }

  function disposeSceneGraph(root) {
    if (!root || typeof root.traverse !== 'function') return;
    const seen = new Set();
    root.traverse((obj) => {
      if (obj.geometry && !seen.has(obj.geometry) && !(obj.geometry.userData && obj.geometry.userData._ashShared)) {
        seen.add(obj.geometry);
        if (typeof obj.geometry.dispose === 'function') obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          for (let i = 0; i < obj.material.length; i++) _disposeMat(obj.material[i], seen);
        } else {
          _disposeMat(obj.material, seen);
        }
      }
    });
    if (Array.isArray(root.children)) root.children.length = 0;
  }

  function disposeRaidResources(opts = {}) {
    const { scene, viewmodelScene, world } = opts;
    if (scene) disposeSceneGraph(scene);
    if (viewmodelScene) disposeSceneGraph(viewmodelScene);
    if (world) {
      if (Array.isArray(world._batchedMeshes)) world._batchedMeshes.length = 0;
      if (Array.isArray(world.shootableMeshes)) world.shootableMeshes.length = 0;
      if (Array.isArray(world.wallMeshes)) world.wallMeshes.length = 0;
      if (Array.isArray(world.colliders)) world.colliders.length = 0;
      if (Array.isArray(world.lootContainers)) world.lootContainers.length = 0;
      if (Array.isArray(world.groundItems)) world.groundItems.length = 0;
      if (Array.isArray(world.doors)) world.doors.length = 0;
      if (Array.isArray(world.waterMeshes)) world.waterMeshes.length = 0;
      if (Array.isArray(world.fogLayers)) world.fogLayers.length = 0;
      if (Array.isArray(world.smokePlumes)) world.smokePlumes.length = 0;
      if (world._colliderGrid && world._colliderGrid.clear) world._colliderGrid.clear();
      if (world._shootGrid && world._shootGrid.clear) world._shootGrid.clear();
      if (world._wallGrid && world._wallGrid.clear) world._wallGrid.clear();
      if (world.zavod) {
        world.zavod.doors = [];
        world.zavod.barricades = [];
        world.zavod.stations = [];
        world.zavod.lasers = [];
        world.zavod.floods = {};
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. Unified Single-Pass GPU Post-Processing Pipeline (PS2 + NVG + Rad + UW)
  // --------------------------------------------------------------------------
  function createRenderPipeline(renderer) {
    const getScale = () => {
      const p = (window.GFX_SETTINGS && typeof window.GFX_SETTINGS.pixel === 'number') ? window.GFX_SETTINGS.pixel : 2;
      return Math.max(1, Math.min(3, Math.round(p)));
    };
    let curScale = getScale();
    let rtW = Math.max(1, Math.ceil(window.innerWidth / curScale));
    let rtH = Math.max(1, Math.ceil(window.innerHeight / curScale));
    const rt = new THREE.WebGLRenderTarget(rtW, rtH, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false
    });
    rt.texture.generateMipmaps = false;

    const postScene = new THREE.Scene();
    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const postMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: rt.texture },
        uRes: { value: new THREE.Vector2(rtW, rtH) },
        uScale: { value: curScale },
        uLevels: { value: 48.0 },
        uDither: { value: 0.75 },
        uNvg: { value: 0.0 },
        uRad: { value: 0.0 },
        uUnderwater: { value: 0.0 },
        uTime: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uRes;
        uniform float uScale;
        uniform float uLevels;
        uniform float uDither;
        uniform float uNvg;
        uniform float uRad;
        uniform float uUnderwater;
        uniform float uTime;
        varying vec2 vUv;
        float b2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
        float b4(vec2 a) { return b2(0.5 * a) * 0.25 + b2(a); }
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        void main() {
          vec2 uv = vUv;
          if (uUnderwater > 0.01) {
            uv.x += sin(uv.y * 22.0 + uTime * 3.2) * 0.0045 * uUnderwater;
            uv.y += cos(uv.x * 18.0 + uTime * 2.5) * 0.0035 * uUnderwater;
          }
          vec3 c = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb * 1.08;
          if (uScale > 1.01) {
            float d = b4(gl_FragCoord.xy / max(1.0, uScale)) - 0.5;
            c = floor(clamp(c, 0.0, 1.0) * uLevels + d * uDither) / uLevels;
          }
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(c, vec3(lum), 0.18);
          c *= vec3(1.02, 1.0, 0.94);
          c = clamp((c - 0.5) * 1.08 + 0.5, 0.0, 1.0);
          if (uNvg > 0.01) {
            float nvgLum = pow(clamp(lum * 1.38 + 0.04, 0.0, 1.0), 0.85);
            float grain = (hash(uv * uRes + fract(uTime * 19.7)) - 0.5) * 0.09;
            float scan = 0.96 + 0.04 * sin(gl_FragCoord.y * 1.4);
            float distC = length(vUv - vec2(0.5, 0.5));
            float tube = smoothstep(0.76, 0.42, distC);
            vec3 phosphor = vec3(0.26, 1.08, 0.58) * (nvgLum + grain) * scan * mix(0.45, 1.05, tube);
            c = mix(c, clamp(phosphor, 0.0, 1.0), uNvg);
          }
          if (uRad > 0.01) {
            float geiger = step(0.986, hash(floor(uv * 160.0) + fract(uTime * 31.3)));
            c = mix(c, c * vec3(1.08, 1.04, 0.62) + vec3(0.35, 0.42, 0.05) * geiger, uRad * 0.72);
          }
          if (uUnderwater > 0.01) {
            float vig = smoothstep(0.25, 0.85, length(vUv - 0.5));
            c = mix(c, c * vec3(0.32, 0.72, 0.86) + vec3(0.02, 0.10, 0.16), uUnderwater * (0.46 + vig * 0.35));
          }
          gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

    const needsRT = () => (
      curScale > 1 ||
      postMat.uniforms.uNvg.value > 0.01 ||
      postMat.uniforms.uRad.value > 0.01 ||
      postMat.uniforms.uUnderwater.value > 0.01
    );

    const resize = () => {
      curScale = getScale();
      const s = curScale > 1 ? curScale : 1;
      rtW = Math.max(1, Math.ceil(window.innerWidth / s));
      rtH = Math.max(1, Math.ceil(window.innerHeight / s));
      if (rt.width !== rtW || rt.height !== rtH) {
        rt.setSize(rtW, rtH);
      }
      postMat.uniforms.uRes.value.set(rtW, rtH);
      postMat.uniforms.uScale.value = curScale;
    };

    return {
      get scale() { return curScale; },
      resize,
      setEffects(eff = {}) {
        const u = postMat.uniforms;
        if (eff.nvg !== undefined) u.uNvg.value = eff.nvg ? 1.0 : 0.0;
        if (eff.rad !== undefined) u.uRad.value = eff.rad ? 1.0 : 0.0;
        if (eff.underwater !== undefined) u.uUnderwater.value = eff.underwater ? 1.0 : 0.0;
        if (eff.time !== undefined) u.uTime.value = eff.time;
      },
      resetEffects() {
        const u = postMat.uniforms;
        u.uNvg.value = 0.0;
        u.uRad.value = 0.0;
        u.uUnderwater.value = 0.0;
      },
      begin() {
        curScale = getScale();
        postMat.uniforms.uScale.value = curScale;
        postMat.uniforms.uTime.value = performance.now() * 0.001;
        renderer.setRenderTarget(needsRT() ? rt : null);
        renderer.autoClear = false;
        renderer.clear();
      },
      render(sc, cam, clearDepthFirst = false) {
        if (!sc || !cam) return;
        if (clearDepthFirst) renderer.clearDepth();
        renderer.render(sc, cam);
      },
      end() {
        if (needsRT()) {
          renderer.setRenderTarget(null);
          renderer.clear();
          renderer.render(postScene, postCam);
        }
      }
    };
  }

  return {
    GeoPool,
    InstancedPropBatcher,
    getEnvMap,
    getSurfaceBank,
    getWorldMaterialSet,
    disposeSceneGraph,
    disposeRaidResources,
    createRenderPipeline,
    markShared: _markShared
  };
})();
