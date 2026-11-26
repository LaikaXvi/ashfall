// ============================================================================
// ASHFALL // 720p Procedural PBR Material Bank, Seam-Stitched Metric UV Unwrapper
// & Dual HDR Equirectangular PMREM Probe Engine
// ============================================================================
window.AshfallPBR = (() => {
  const _texSetCache = new Map();
  const _matCache = new Map();
  const _envCache = new Map();
  const _baseH = new Map();
  let _perm = null;
  let _scratchH = null;
  let _scratchW = 0;
  let _scratchHpx = 0;

  function _markShared(obj) {
    if (!obj) return obj;
    if (!obj.userData) obj.userData = {};
    obj.userData._ashShared = true;
    return obj;
  }

  function _getTexDims(isSquare = false) {
    const q = (window.GFX_SETTINGS && typeof window.GFX_SETTINGS.textures === 'number')
      ? window.GFX_SETTINGS.textures : 3;
    // Strictly power-of-two dimensions for fast hardware trilinear mipmaps & GLSL distance mip-bias LOD scaling
    if (isSquare) {
      return q <= 1 ? [256, 256] : (q === 2 ? [512, 512] : [512, 512]);
    }
    return q <= 1 ? [512, 256] : (q === 2 ? [512, 512] : [1024, 512]);
  }

  function _getMaxAniso() {
    const r = window.mainWebGLRenderer;
    if (r && r.capabilities && typeof r.capabilities.getMaxAnisotropy === 'function') {
      const q = (window.GFX_SETTINGS && typeof window.GFX_SETTINGS.textures === 'number')
        ? window.GFX_SETTINGS.textures : 3;
      const cap = r.capabilities.getMaxAnisotropy() || 4;
      return q <= 1 ? Math.min(2, cap) : (q === 2 ? Math.min(8, cap) : Math.min(16, cap));
    }
    return 8;
  }

  // Deterministic 256-entry permutation table for fast tileable noise
  function _ensurePerm() {
    if (_perm) return _perm;
    _perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = 0x9e3779b9;
    for (let i = 255; i > 0; i--) {
      s = (Math.imul(s ^ (s >>> 15), 0x85ebca6b) + 0xc2b2ae35) >>> 0;
      const j = s % (i + 1);
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) _perm[i] = p[i & 255];
    return _perm;
  }

  // Tileable periodic gradient noise on integer period [px, py]
  function _tileNoise(x, y, px, py, perm) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);

    const x0 = ((xi % px) + px) % px;
    const y0 = ((yi % py) + py) % py;
    const x1 = (x0 + 1) % px;
    const y1 = (y0 + 1) % py;

    const aa = perm[(perm[x0 & 255] + (y0 & 255)) & 255];
    const ab = perm[(perm[x0 & 255] + (y1 & 255)) & 255];
    const ba = perm[(perm[x1 & 255] + (y0 & 255)) & 255];
    const bb = perm[(perm[x1 & 255] + (y1 & 255)) & 255];

    const grad = (h, gx, gy) => {
      switch (h & 7) {
        case 0: return gx + gy;
        case 1: return -gx + gy;
        case 2: return gx - gy;
        case 3: return -gx - gy;
        case 4: return gx * 1.414;
        case 5: return -gx * 1.414;
        case 6: return gy * 1.414;
        default: return -gy * 1.414;
      }
    };

    const g00 = grad(aa, xf, yf);
    const g10 = grad(ba, xf - 1, yf);
    const g01 = grad(ab, xf, yf - 1);
    const g11 = grad(bb, xf - 1, yf - 1);

    const ix0 = g00 + u * (g10 - g00);
    const ix1 = g01 + u * (g11 - g01);
    return (ix0 + v * (ix1 - ix0)) * 0.5 + 0.5; // [0..1]
  }

  // Fast precomputed 256x256 tileable FBM noise LUTs (interpolated smoothly to 720p!)
  function _getNoiseLUT(seedIdx, octaves = 4, freq = 8, anisoX = 1, anisoY = 1) {
    const key = `${seedIdx}_${octaves}_${freq}_${anisoX}_${anisoY}`;
    if (_baseH.has(key)) return _baseH.get(key);
    const S = 256;
    const buf = new Float32Array(S * S);
    const perm = _ensurePerm();
    const off = (seedIdx * 37) % 256;
    for (let y = 0; y < S; y++) {
      const ny = y / S;
      for (let x = 0; x < S; x++) {
        const nx = x / S;
        let val = 0, amp = 0.5, norm = 0;
        let fx = freq * anisoX;
        let fy = freq * anisoY;
        for (let o = 0; o < octaves; o++) {
          const px = Math.max(2, Math.round(fx));
          const py = Math.max(2, Math.round(fy));
          val += amp * _tileNoise(nx * px + off + o * 13, ny * py + off + o * 7, px, py, perm);
          norm += amp;
          amp *= 0.5;
          fx *= 2;
          fy *= 2;
        }
        buf[y * S + x] = val / norm;
      }
    }
    _baseH.set(key, buf);
    return buf;
  }

  function _sampleLUT(lut, u, v) {
    const x = ((u % 1) + 1) % 1 * 256;
    const y = ((v % 1) + 1) % 1 * 256;
    const x0 = Math.floor(x) & 255;
    const y0 = Math.floor(y) & 255;
    const x1 = (x0 + 1) & 255;
    const y1 = (y0 + 1) & 255;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const r0 = y0 << 8, r1 = y1 << 8;
    const a = lut[r0 + x0], b = lut[r0 + x1];
    const c = lut[r1 + x0], d = lut[r1 + x1];
    return (a + fx * (b - a)) + fy * ((c + fx * (d - c)) - (a + fx * (b - a)));
  }

  function _allocHeight(w, h) {
    if (!_scratchH || _scratchW !== w || _scratchHpx !== h) {
      _scratchH = new Float32Array(w * h);
      _scratchW = w;
      _scratchHpx = h;
    }
    return _scratchH;
  }

  function _makeCanvasTex(w, h, dataRGBA, isSRGB, anisotropy) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    img.data.set(dataRGBA);
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = anisotropy;
    tex.encoding = isSRGB ? THREE.sRGBEncoding : THREE.LinearEncoding;
    tex.needsUpdate = true;
    return _markShared(tex);
  }

  function _clampByte(v) { return v < 0 ? 0 : (v > 255 ? 255 : (v | 0)); }

  // Synthesize matched 720p (map, normalMap, roughnessMap) from procedural height + material recipe
  function _synthesizeMaps(id, spec) {
    const isSquare = !!spec.square;
    const [W, H] = _getTexDims(isSquare);
    const cacheKey = `${id}_${W}x${H}`;
    if (_texSetCache.has(cacheKey)) return _texSetCache.get(cacheKey);

    const aniso = _getMaxAniso();
    const hf = _allocHeight(W, H);
    const nBase = _getNoiseLUT(spec.seed || 1, 5, spec.freq || 8, spec.ax || 1, spec.ay || 1);
    const nFine = _getNoiseLUT((spec.seed || 1) + 7, 4, (spec.freq || 8) * 3, spec.ax || 1, spec.ay || 1);
    const nMacro = _getNoiseLUT((spec.seed || 1) + 19, 3, 4, 1, 1);

    const albData = new Uint8ClampedArray(W * H * 4);
    const rghData = new Uint8ClampedArray(W * H * 4);
    const nrmData = new Uint8ClampedArray(W * H * 4);

    const [r0, g0, b0] = spec.c0;
    const [r1, g1, b1] = spec.c1;
    const baseRough = (spec.rough !== undefined) ? spec.rough : 0.5;
    const roughVar = (spec.roughVar !== undefined) ? spec.roughVar : 0.18;
    const kind = spec.pattern || 'noise';

    const invW = 1 / W;
    const invH = 1 / H;
    const hash2 = (ix, iy) => {
      let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(spec.seed || 1, 1442695041)) | 0;
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };

    for (let y = 0; y < H; y++) {
      const v = y * invH;
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const u = x * invW;
        const idx = row + x;
        const p4 = idx << 2;

        const fbm = _sampleLUT(nBase, u, v);
        const fine = _sampleLUT(nFine, u * 1.5, v * 1.5);
        const macro = _sampleLUT(nMacro, u, v);
        const micro = hash2(x, y);

        let hVal = fbm * 0.55 + fine * 0.30 + micro * 0.15;
        let mixT = fbm * 0.65 + macro * 0.35;
        let ao = 0.86 + 0.14 * hVal;
        let rgh = baseRough + (0.5 - hVal) * roughVar;
        let extraR = 0, extraG = 0, extraB = 0;

        if (kind === 'brushed_metal') {
          const streak = _sampleLUT(nFine, u * 0.35, v * 12.0);
          const scratch = hash2((x >> 5), y) > 0.992 ? (0.4 + 0.5 * macro) : 0;
          hVal = 0.42 + streak * 0.36 + micro * 0.10 + scratch * 0.28;
          mixT = streak * 0.6 + macro * 0.4;
          rgh = baseRough + (0.5 - streak) * roughVar - scratch * 0.14;
          ao = 0.92 + 0.08 * hVal;
        } else if (kind === 'stipple') {
          const gx = ((u * 96) % 1) - 0.5;
          const gy = ((v * 54) % 1) - 0.5;
          const hexOff = (Math.floor(v * 54) & 1) ? 0.5 : 0.0;
          const gxx = (((u * 96) + hexOff) % 1) - 0.5;
          const dist = Math.hypot(gxx, gy);
          const dimple = Math.max(0, 1 - dist * 2.35);
          hVal = 0.32 + dimple * 0.52 + micro * 0.16;
          mixT = dimple * 0.55 + macro * 0.45;
          rgh = baseRough - dimple * roughVar * 0.7;
          ao = 0.72 + 0.28 * hVal;
        } else if (kind === 'wood_grain') {
          const warp = macro * 0.18 + fine * 0.04;
          const ring = Math.sin((v * 14.0 + u * 1.2 + warp * 9.0) * Math.PI * 2) * 0.5 + 0.5;
          const pore = _sampleLUT(nFine, u * 0.4, v * 16.0);
          const lam = Math.floor(v * 7.0) % 2 ? 0.08 : -0.06;
          hVal = 0.35 + ring * 0.35 + pore * 0.25 + micro * 0.05;
          mixT = Math.max(0, Math.min(1, ring * 0.72 + pore * 0.28 + lam));
          rgh = baseRough + (0.5 - ring) * roughVar;
          ao = 0.85 + 0.15 * hVal;
        } else if (kind === 'bakelite') {
          const swirl = Math.sin((u * 3.0 + v * 5.0 + fbm * 2.8) * Math.PI * 2) * 0.5 + 0.5;
          const fiber = fine * 0.5 + macro * 0.5;
          hVal = 0.48 + fiber * 0.30 + micro * 0.08;
          mixT = swirl * 0.65 + fiber * 0.35;
          rgh = baseRough + (0.5 - swirl) * 0.10;
        } else if (kind === 'cordura') {
          const wx = Math.sin(u * 260 * Math.PI * 2) * 0.5 + 0.5;
          const wy = Math.sin(v * 150 * Math.PI * 2) * 0.5 + 0.5;
          const weave = (((Math.floor(u * 260) + Math.floor(v * 150)) & 1) ? wx : wy) * 0.7 + 0.3 * (wx * wy);
          const ripX = ((u * 24) % 1) < 0.09 ? 0.22 : 0;
          const ripY = ((v * 14) % 1) < 0.09 ? 0.22 : 0;
          const rip = Math.max(ripX, ripY);
          hVal = 0.25 + weave * 0.50 + rip * 0.22 + micro * 0.08;
          mixT = macro * 0.55 + weave * 0.30 + rip * 0.15;
          rgh = baseRough + (1.0 - weave) * roughVar;
          ao = 0.78 + 0.22 * weave;
        } else if (kind === 'concrete_formwork') {
          const pu = (u * 4) % 1;
          const pv = (v * 3) % 1;
          const seam = (pu < 0.014 || pu > 0.986 || pv < 0.018 || pv > 0.982) ? 1.0 : 0.0;
          const tie = Math.max(0, 1 - Math.hypot((pu - 0.5) * 4, (pv - 0.5) * 3) * 6.5);
          const pit = fine < 0.22 ? (0.22 - fine) * 2.2 : 0;
          const streak = _sampleLUT(nMacro, u * 3.0, v * 0.5);
          hVal = 0.58 + fbm * 0.22 - seam * 0.38 - tie * 0.35 - pit * 0.28;
          mixT = fbm * 0.55 + streak * 0.45 - seam * 0.25;
          ao = (1 - seam * 0.38) * (1 - tie * 0.35) * (0.85 + 0.15 * (1 - pit));
          rgh = baseRough + pit * 0.18 - seam * 0.05;
        } else if (kind === 'epoxy_wet') {
          const puddle = Math.max(0, Math.min(1, (macro - 0.46) * 3.8));
          const slab = (((u * 4) % 1) < 0.012 || ((v * 3) % 1) < 0.016) ? 1.0 : 0.0;
          hVal = (0.55 + fine * 0.25) * (1 - puddle * 0.7) - slab * 0.32;
          mixT = fbm * 0.6 + macro * 0.4;
          ao = (1 - slab * 0.32) * (1 - puddle * 0.22);
          rgh = (baseRough + (0.5 - fbm) * roughVar) * (1 - puddle * 0.78) + puddle * 0.09;
        } else if (kind === 'brick') {
          const rowI = Math.floor(v * 12);
          const uOff = (rowI & 1) ? 0.5 : 0;
          const cu = (u * 6 + uOff) % 1;
          const cv = (v * 12) % 1;
          const mU = cu < 0.045 || cu > 0.955;
          const mV = cv < 0.085 || cv > 0.915;
          const isMortar = mU || mV;
          const bRand = hash2(Math.floor(u * 6 + uOff), rowI);
          if (isMortar) {
            hVal = 0.20 + micro * 0.12;
            extraR = 138; extraG = 132; extraB = 122;
            mixT = -1;
            ao = 0.68;
            rgh = 0.94;
          } else {
            const chip = (cu < 0.09 || cu > 0.91 || cv < 0.14 || cv > 0.86) ? fine * 0.15 : 0;
            hVal = 0.68 + fbm * 0.18 + fine * 0.10 - chip;
            mixT = bRand * 0.55 + fbm * 0.45;
            ao = 0.88 + 0.12 * hVal;
            rgh = baseRough + (0.5 - fine) * 0.12;
          }
        } else if (kind === 'tile_grid') {
          const tilesU = spec.tilesU || 6;
          const tilesV = spec.tilesV || 6;
          const tu = (u * tilesU) % 1;
          const tv = (v * tilesV) % 1;
          const grout = (tu < 0.04 || tu > 0.96 || tv < 0.04 || tv > 0.96);
          const tRand = hash2(Math.floor(u * tilesU), Math.floor(v * tilesV));
          if (grout) {
            hVal = 0.22 + micro * 0.1;
            ao = 0.62;
            rgh = 0.92;
            extraR = 64; extraG = 66; extraB = 62;
            mixT = -1;
          } else {
            const stain = macro < 0.34 ? (0.34 - macro) * 1.4 : 0;
            hVal = 0.72 + fine * 0.08;
            mixT = tRand * 0.35 + stain * 0.65;
            ao = 0.94 - stain * 0.22;
            rgh = baseRough + stain * 0.36;
          }
        } else if (kind === 'diamond_plate') {
          const gx = (u * 24) % 1 - 0.5;
          const gy = (v * 24) % 1 - 0.5;
          const alt = ((Math.floor(u * 24) + Math.floor(v * 24)) & 1);
          const rx = alt ? (gx * 0.707 + gy * 0.707) : (gx * 0.707 - gy * 0.707);
          const ry = alt ? (-gx * 0.707 + gy * 0.707) : (gx * 0.707 + gy * 0.707);
          const lug = (Math.abs(rx) < 0.11 && Math.abs(ry) < 0.30) ? 1.0 : 0.0;
          hVal = 0.34 + lug * 0.54 + micro * 0.06;
          mixT = lug * 0.55 + macro * 0.45;
          rgh = baseRough - lug * 0.22 + (1 - macro) * 0.10;
          ao = lug ? 1.0 : 0.78 + 0.14 * fbm;
        } else if (kind === 'corrugated_rust') {
          const wave = Math.sin(u * 18 * Math.PI * 2) * 0.5 + 0.5;
          const rustPatch = Math.max(0, Math.min(1, (macro - 0.42) * 2.6 + (fine - 0.5) * 0.5));
          hVal = 0.25 + wave * 0.55 + fine * 0.15;
          mixT = rustPatch * 0.8 + fbm * 0.2;
          if (rustPatch > 0.45) {
            extraR = 132; extraG = 66; extraB = 34;
            mixT = -1;
            rgh = 0.92;
          } else {
            rgh = baseRough + rustPatch * 0.28;
          }
          ao = 0.76 + 0.24 * wave;
        } else if (kind === 'galvanized_spangle') {
          const cx = Math.floor(u * 26 + macro * 1.6);
          const cy = Math.floor(v * 26 + fbm * 1.6);
          const cellShade = hash2(cx, cy);
          const grain = _sampleLUT(nFine, u * 0.6 + cellShade, v * 14.0 + cellShade);
          hVal = 0.44 + cellShade * 0.34 + grain * 0.14 + micro * 0.08;
          mixT = Math.max(0, Math.min(1, cellShade * 0.62 + macro * 0.24 + grain * 0.14));
          rgh = baseRough + (0.5 - cellShade) * roughVar + (0.5 - grain) * 0.08;
          ao = 0.88 + 0.12 * cellShade;
        } else if (kind === 'corrugated_industrial') {
          const wave = Math.max(0, Math.min(1, Math.sin(u * 16 * Math.PI * 2) * 0.95 + 0.5));
          const lapSeam = ((u * 2) % 1) < 0.016 ? 1.0 : 0.0;
          const fastRow = Math.abs(((v * 4) % 1) - 0.5) < 0.035;
          const fastCol = Math.abs(((u * 16) % 1) - 0.25) < 0.075;
          const bolt = (fastRow && fastCol) ? 1.0 : 0.0;
          hVal = bolt ? 0.92 : (0.28 + wave * 0.56 - lapSeam * 0.24 + fine * 0.08);
          mixT = bolt ? 0.95 : Math.max(0, Math.min(1, macro * 0.48 + fbm * 0.32 + wave * 0.20));
          rgh = bolt ? 0.24 : (baseRough + (1.0 - wave) * roughVar - lapSeam * 0.06);
          ao = bolt ? 0.98 : ((1.0 - lapSeam * 0.34) * (0.76 + 0.24 * wave));
        } else if (kind === 'hazard_chevron') {
          const stripe = ((u * 6 + v * 4) % 1) < 0.5;
          hVal = 0.46 + fine * 0.30 + (stripe ? 0.06 : 0.0);
          const wear = macro < 0.24 ? (0.24 - macro) * 2.5 : 0;
          if (stripe) {
            extraR = Math.round(224 - wear * 75);
            extraG = Math.round(166 - wear * 55);
            extraB = Math.round(32 + wear * 20);
          } else {
            extraR = Math.round(28 + wear * 35);
            extraG = Math.round(30 + wear * 35);
            extraB = Math.round(33 + wear * 35);
          }
          mixT = -1;
          rgh = baseRough + wear * 0.32 + (0.5 - fbm) * 0.12;
          ao = 0.88 + 0.12 * hVal;
        } else if (kind === 'asphalt') {
          const agg = hash2(x >> 1, y >> 1);
          const crack = Math.abs(fbm - 0.5) < 0.012 && macro < 0.46 ? 1.0 : 0.0;
          hVal = 0.42 + agg * 0.32 + fine * 0.16 - crack * 0.35;
          mixT = agg * 0.5 + macro * 0.5;
          rgh = baseRough + (0.5 - agg) * 0.14;
          ao = (1 - crack * 0.55) * (0.86 + 0.14 * agg);
        } else if (kind === 'bark') {
          const furrow = Math.sin((u * 14 + macro * 2.2) * Math.PI * 2) * 0.5 + 0.5;
          const plate = _sampleLUT(nFine, u * 4.0, v * 0.5);
          hVal = 0.20 + furrow * 0.55 + plate * 0.25;
          mixT = furrow * 0.65 + macro * 0.35;
          rgh = baseRough + (1 - furrow) * 0.12;
          ao = 0.65 + 0.35 * furrow;
        } else if (kind === 'birch_bark') {
          const lens = ((v * 24) % 1) < 0.22 ? _sampleLUT(nFine, u * 0.3, v * 12) : 0;
          const darkMark = (lens > 0.64 || macro < 0.20) ? 1.0 : 0.0;
          hVal = 0.55 + fine * 0.22 - darkMark * 0.25;
          mixT = darkMark ? 0.92 : fbm * 0.35;
          rgh = darkMark ? 0.90 : 0.72;
          ao = darkMark ? 0.65 : 0.95;
        } else if (kind === 'tire_tread') {
          const chevron = Math.abs(((u * 8) % 1) - 0.5);
          const groove = ((v * 14 + chevron * 2.4) % 1) < 0.34 ? 1.0 : 0.0;
          const rib = Math.abs(u - 0.5) < 0.05;
          hVal = (groove || rib) ? 0.22 + micro * 0.08 : 0.76 + fine * 0.14;
          mixT = fbm * 0.5 + macro * 0.5;
          rgh = groove ? 0.94 : baseRough;
          ao = groove ? 0.62 : 0.96;
        } else if (kind === 'water_wave') {
          const w1 = Math.sin((u * 6 + v * 3 + macro * 0.6) * Math.PI * 2);
          const w2 = Math.sin((u * 10 - v * 8 + fine * 0.5) * Math.PI * 2);
          const w3 = _sampleLUT(nBase, u * 2.0, v * 2.0) * 2 - 1;
          hVal = 0.5 + 0.18 * w1 + 0.12 * w2 + 0.20 * w3;
          mixT = 0.5;
          rgh = 0.08;
          ao = 1.0;
        } else if (kind === 'granite') {
          const strata = Math.sin((v * 5 + u * 1.2 + macro * 3.0) * Math.PI * 2) * 0.5 + 0.5;
          const crack = Math.abs(fbm - 0.5) < 0.02 ? 0.35 : 0;
          hVal = 0.40 + fbm * 0.35 + strata * 0.20 - crack;
          mixT = fbm * 0.55 + strata * 0.35 + (micro > 0.9 ? 0.1 : 0);
          rgh = baseRough + (0.5 - fine) * roughVar;
          ao = (1 - crack * 0.6) * (0.82 + 0.18 * hVal);
        } else if (kind === 'tactical_camo') {
          // Multi-tone NATO/Russian digital-organic tactical ripstop camo
          const patchA = fbm > 0.56 ? 1 : 0;
          const patchB = macro < 0.38 ? 1 : 0;
          const weave = (((x >> 1) + (y >> 1)) & 1) ? 0.05 : -0.05;
          hVal = 0.50 + fine * 0.28 + weave;
          mixT = patchA ? 0.85 : (patchB ? 0.15 : 0.48);
          rgh = baseRough + weave * 0.4;
          ao = 0.92 + 0.08 * hVal;
        } else if (kind === 'anodized_forged') {
          // Mil-Spec Type III bead-blasted hard-coat 7075-T6 anodizing / phosphate steel with faint CNC passes & CLP oil sheen
          const cncPass = Math.sin(v * 110 * Math.PI * 2) * 0.04;
          const bead = fine * 0.34 + micro * 0.18;
          const oilSheen = macro > 0.58 ? (macro - 0.58) * 0.28 : 0;
          const edgeWear = fbm > 0.72 ? (fbm - 0.72) * 0.65 : 0;
          hVal = 0.42 + bead + cncPass + edgeWear * 0.20;
          mixT = Math.max(0, Math.min(1, macro * 0.45 + fbm * 0.35 + edgeWear * 0.55));
          rgh = baseRough + (0.48 - bead) * roughVar - oilSheen - edgeWear * 0.18;
          ao = 0.88 + 0.12 * (1 - oilSheen * 0.4);
        } else if (kind === 'glass_polymer') {
          // German HK glass-fiber-reinforced polyamide-66: fine pebble mold grain, sparse glass micro-flecks & subtle grip oil sheen
          const pebble = fine * 0.42 + micro * 0.24;
          const fiberFleck = micro > 0.78 ? (micro - 0.78) * 0.55 : 0;
          const handSheen = macro > 0.60 ? (macro - 0.60) * 0.22 : 0;
          hVal = 0.44 + pebble + fiberFleck * 0.25;
          mixT = Math.max(0, Math.min(1, macro * 0.38 + fbm * 0.36 + fiberFleck * 0.50));
          rgh = baseRough + (0.46 - pebble) * roughVar - handSheen;
          ao = 0.89 + 0.11 * (1 - pebble * 0.30);
        } else if (kind === 'ashlar_stone') {
          // Cut Middle-Eastern travertine / sandstone ashlar cladding with staggered courses & mineral veining
          const courses = spec.courses || 8;
          const cols = spec.cols || 4;
          const rowI = Math.floor(v * courses);
          const uOff = (rowI & 1) ? 0.5 : 0.0;
          const cu = (u * cols + uOff) % 1;
          const cv = (v * courses) % 1;
          const isMortar = (cu < 0.022 || cu > 0.978 || cv < 0.038 || cv > 0.962);
          const vein = _sampleLUT(nFine, u * 0.6, v * 9.0);
          const bRand = hash2(Math.floor(u * cols + uOff), rowI);
          if (isMortar) {
            hVal = 0.20 + micro * 0.10;
            extraR = 128; extraG = 118; extraB = 102;
            mixT = -1;
            ao = 0.68;
            rgh = 0.94;
          } else {
            const bev = (cu < 0.045 || cu > 0.955 || cv < 0.07 || cv > 0.93) ? 0.10 : 0.0;
            hVal = 0.68 + fbm * 0.16 + vein * 0.12 - bev;
            mixT = Math.max(0, Math.min(1, bRand * 0.42 + vein * 0.38 + fbm * 0.20));
            ao = 0.88 + 0.12 * (1 - bev);
            rgh = baseRough + (0.5 - vein) * roughVar;
          }
        } else if (kind === 'curtain_mullion') {
          // Skyscraper anodized mullion frame & dark reflective spandrel glazing
          const baysU = spec.baysU || 4;
          const baysV = spec.baysV || 3;
          const mu = (u * baysU) % 1;
          const mv = (v * baysV) % 1;
          const isMullion = (mu < 0.048 || mu > 0.952 || mv < 0.085 || mv > 0.915);
          const isSpandrel = !isMullion && mv < 0.30;
          if (isMullion) {
            hVal = 0.82 + fine * 0.08;
            extraR = 46; extraG = 52; extraB = 58;
            mixT = -1;
            ao = 0.94;
            rgh = 0.34;
          } else if (isSpandrel) {
            hVal = 0.48 + macro * 0.10;
            mixT = macro * 0.45 + 0.15;
            ao = 0.78;
            rgh = 0.28 + fine * 0.08;
          } else {
            hVal = 0.36 + micro * 0.04;
            mixT = 0.55 + macro * 0.35;
            ao = 0.74;
            rgh = 0.16 + macro * 0.08;
          }
        } else if (kind === 'ribbed_precast') {
          // Architectural fluted precast concrete with vertical shadow flutes & panel seams
          const ribs = spec.ribs || 18;
          const flute = Math.max(-1, Math.min(1, Math.sin(u * ribs * Math.PI * 2) * 1.35)) * 0.5 + 0.5;
          const hSeam = ((v * 3) % 1) < 0.024;
          const streak = _sampleLUT(nMacro, u * 4.0, v * 0.4);
          hVal = hSeam ? 0.22 : (0.34 + flute * 0.48 + fine * 0.12);
          mixT = Math.max(0, Math.min(1, fbm * 0.5 + streak * 0.35 + flute * 0.15 - (hSeam ? 0.25 : 0)));
          ao = (hSeam ? 0.66 : (0.76 + 0.24 * flute));
          rgh = baseRough + (1 - flute) * 0.10;
        } else if (kind === 'polished_marble') {
          // Veined marble / limestone lobby floor tiles with fine beveled joints
          const tilesU = spec.tilesU || 3;
          const tu = (u * tilesU) % 1;
          const tv = (v * tilesU) % 1;
          const joint = (tu < 0.016 || tu > 0.984 || tv < 0.016 || tv > 0.984);
          const vein = Math.pow(Math.abs(Math.sin((u * 2.5 + v * 2.0 + fbm * 2.4) * Math.PI)), 6);
          if (joint) {
            hVal = 0.24;
            extraR = 96; extraG = 92; extraB = 84;
            mixT = -1;
            ao = 0.72;
            rgh = 0.68;
          } else {
            hVal = 0.74 + fine * 0.05;
            mixT = Math.max(0, Math.min(1, fbm * 0.45 + (1 - vein) * 0.45 + macro * 0.10));
            ao = 0.95;
            rgh = 0.14 + vein * 0.10;
          }
        }

        hf[idx] = hVal;

        let rr, gg, bb;
        if (mixT < 0) {
          rr = extraR; gg = extraG; bb = extraB;
        } else {
          const t = Math.max(0, Math.min(1, mixT));
          rr = r0 + (r1 - r0) * t;
          gg = g0 + (g1 - g0) * t;
          bb = b0 + (b1 - b0) * t;
        }
        albData[p4] = _clampByte(rr * ao);
        albData[p4 + 1] = _clampByte(gg * ao);
        albData[p4 + 2] = _clampByte(bb * ao);
        albData[p4 + 3] = 255;

        const rv = _clampByte(Math.max(0.04, Math.min(1.0, rgh)) * 255);
        rghData[p4] = rv;
        rghData[p4 + 1] = rv;
        rghData[p4 + 2] = rv;
        rghData[p4 + 3] = 255;
      }
    }

    // Wrapped Sobel gradient -> RGB Tangent-Space Normal Map (seamlessly tileable!)
    const bumpStrength = (spec.bump !== undefined) ? spec.bump : 2.4;
    for (let y = 0; y < H; y++) {
      const ym = ((y - 1 + H) % H) * W;
      const y0 = y * W;
      const yp = ((y + 1) % H) * W;
      for (let x = 0; x < W; x++) {
        const xm = (x - 1 + W) % W;
        const xp = (x + 1) % W;
        const idx = y0 + x;
        const p4 = idx << 2;

        const tl = hf[ym + xm], tc = hf[ym + x], tr = hf[ym + xp];
        const ml = hf[y0 + xm],                 mr = hf[y0 + xp];
        const bl = hf[yp + xm], bc = hf[yp + x], br = hf[yp + xp];

        const dx = ((tr + 2 * mr + br) - (tl + 2 * ml + bl)) * bumpStrength;
        const dy = ((bl + 2 * bc + br) - (tl + 2 * tc + tr)) * bumpStrength;
        let nx = -dx;
        let ny = -dy;
        let nz = 1.0;
        const invL = 1.0 / Math.hypot(nx, ny, nz);
        nx *= invL; ny *= invL; nz *= invL;

        nrmData[p4] = _clampByte((nx * 0.5 + 0.5) * 255);
        nrmData[p4 + 1] = _clampByte((ny * 0.5 + 0.5) * 255);
        nrmData[p4 + 2] = _clampByte((nz * 0.5 + 0.5) * 255);
        nrmData[p4 + 3] = 255;
      }
    }

    const res = {
      map: kind === 'water_wave' ? null : _makeCanvasTex(W, H, albData, true, aniso),
      normalMap: _makeCanvasTex(W, H, nrmData, false, aniso),
      roughnessMap: kind === 'water_wave' ? null : _makeCanvasTex(W, H, rghData, false, aniso),
      width: W,
      height: H
    };
    _texSetCache.set(cacheKey, res);
    return res;
  }

  // PBR surface recipe catalog
  const PRESETS = {
    // --- Firearms, Attachments, Melee & Throwables ---
    gunmetal_parkerized: { seed: 101, pattern: 'brushed_metal', c0: [58, 63, 68], c1: [86, 92, 99], rough: 0.42, roughVar: 0.20, metal: 0.88, bump: 2.2 },
    gunmetal_blued:      { seed: 102, pattern: 'brushed_metal', c0: [24, 30, 39], c1: [48, 59, 74], rough: 0.24, roughVar: 0.14, metal: 0.94, bump: 1.6 },
    gunmetal_nitride:    { seed: 103, pattern: 'brushed_metal', c0: [28, 30, 34], c1: [44, 48, 54], rough: 0.32, roughVar: 0.14, metal: 0.90, bump: 1.8 },
    steel_brushed:       { seed: 104, pattern: 'brushed_metal', c0: [152, 159, 168], c1: [198, 206, 214], rough: 0.26, roughVar: 0.14, metal: 0.96, bump: 1.8 },
    steel_chrome:        { seed: 105, pattern: 'brushed_metal', c0: [210, 216, 222], c1: [242, 246, 250], rough: 0.12, roughVar: 0.08, metal: 0.98, bump: 0.9 },
    aluminum_anodized:   { seed: 106, pattern: 'brushed_metal', c0: [34, 37, 41], c1: [52, 56, 62], rough: 0.36, roughVar: 0.14, metal: 0.86, bump: 1.4 },
    aluminum_fde:        { seed: 107, pattern: 'brushed_metal', c0: [122, 86, 56], c1: [156, 114, 78], rough: 0.34, roughVar: 0.14, metal: 0.85, bump: 1.4 },
    polymer_stippled:    { seed: 108, pattern: 'stipple', c0: [24, 26, 29], c1: [40, 43, 47], rough: 0.68, roughVar: 0.18, metal: 0.04, bump: 3.4 },
    polymer_od:          { seed: 109, pattern: 'stipple', c0: [64, 78, 54], c1: [88, 104, 74], rough: 0.64, roughVar: 0.18, metal: 0.04, bump: 2.8 },
    polymer_fde:         { seed: 110, pattern: 'stipple', c0: [156, 134, 102], c1: [184, 162, 126], rough: 0.62, roughVar: 0.16, metal: 0.04, bump: 2.6 },
    wood_laminated_birch:{ seed: 111, pattern: 'wood_grain', c0: [118, 62, 26], c1: [176, 104, 46], rough: 0.38, roughVar: 0.16, metal: 0.0, bump: 2.4 },
    wood_walnut:         { seed: 112, pattern: 'wood_grain', c0: [72, 42, 22], c1: [118, 72, 38], rough: 0.44, roughVar: 0.18, metal: 0.0, bump: 2.6 },
    bakelite_russian:    { seed: 113, pattern: 'bakelite', c0: [132, 48, 22], c1: [192, 82, 32], rough: 0.30, roughVar: 0.12, metal: 0.02, bump: 1.5 },
    brass_casing:        { seed: 114, pattern: 'brushed_metal', c0: [186, 148, 62], c1: [228, 192, 98], rough: 0.24, roughVar: 0.12, metal: 0.96, bump: 1.1 },
    rubber_buttpad:      { seed: 115, pattern: 'stipple', c0: [20, 21, 23], c1: [30, 32, 34], rough: 0.86, roughVar: 0.10, metal: 0.0, bump: 2.2 },
    m4_anodized_receiver:{ seed: 116, pattern: 'anodized_forged', c0: [30, 33, 38], c1: [46, 51, 58], rough: 0.43, roughVar: 0.16, metal: 0.84, bump: 1.55 },
    m4_phosphate_steel:  { seed: 117, pattern: 'anodized_forged', c0: [38, 41, 44], c1: [58, 63, 66], rough: 0.48, roughVar: 0.18, metal: 0.86, bump: 1.95 },
    stanag_gray_teflon:  { seed: 118, pattern: 'brushed_metal', c0: [68, 73, 77], c1: [98, 104, 108], rough: 0.39, roughVar: 0.15, metal: 0.85, bump: 1.60 },
    hk_polymer_chassis:  { seed: 119, pattern: 'glass_polymer', c0: [26, 28, 31], c1: [42, 45, 50], rough: 0.58, roughVar: 0.16, metal: 0.05, bump: 2.35 },
    hk_tenifer_steel:    { seed: 120, pattern: 'anodized_forged', c0: [32, 36, 41], c1: [54, 60, 68], rough: 0.34, roughVar: 0.14, metal: 0.91, bump: 1.45 },

    // --- Soldier Uniforms, Armor, Gear & Skin ---
    cordura_olive:       { seed: 201, pattern: 'cordura', c0: [58, 68, 48], c1: [78, 90, 64], rough: 0.82, roughVar: 0.14, metal: 0.02, bump: 3.0 },
    cordura_tan:         { seed: 202, pattern: 'cordura', c0: [122, 108, 84], c1: [150, 134, 104], rough: 0.80, roughVar: 0.14, metal: 0.02, bump: 3.0 },
    cordura_black:       { seed: 203, pattern: 'cordura', c0: [26, 28, 31], c1: [42, 45, 50], rough: 0.78, roughVar: 0.14, metal: 0.02, bump: 3.0 },
    tactical_camo_wood:  { seed: 204, pattern: 'tactical_camo', c0: [48, 58, 40], c1: [96, 98, 68], rough: 0.80, roughVar: 0.12, metal: 0.02, bump: 2.6 },
    kevlar_helmet:       { seed: 205, pattern: 'stipple', c0: [48, 52, 46], c1: [66, 70, 62], rough: 0.56, roughVar: 0.16, metal: 0.05, bump: 2.2 },
    leather_glove:       { seed: 206, pattern: 'stipple', c0: [38, 36, 33], c1: [58, 54, 49], rough: 0.62, roughVar: 0.16, metal: 0.02, bump: 2.5 },
    skin_tactical:       { seed: 207, pattern: 'noise', c0: [168, 128, 102], c1: [198, 156, 128], rough: 0.68, roughVar: 0.12, metal: 0.0, bump: 1.1 },

    // --- ZAVOD-9 & Vostok World Architecture ---
    bunker_concrete_formwork: { seed: 301, pattern: 'concrete_formwork', square: true, c0: [112, 114, 108], c1: [148, 150, 142], rough: 0.84, roughVar: 0.16, metal: 0.04, bump: 2.8 },
    concrete_weathered:  { seed: 302, pattern: 'concrete_formwork', square: true, c0: [128, 128, 122], c1: [166, 166, 158], rough: 0.86, roughVar: 0.14, metal: 0.02, bump: 2.6 },
    concrete_wet_epoxy:  { seed: 303, pattern: 'epoxy_wet', square: true, c0: [72, 82, 76], c1: [104, 114, 106], rough: 0.56, roughVar: 0.28, metal: 0.12, bump: 2.2 },
    plaster_aged_white:  { seed: 304, pattern: 'concrete_formwork', square: true, c0: [182, 180, 174], c1: [216, 214, 206], rough: 0.84, roughVar: 0.16, metal: 0.0, bump: 1.8 },
    plaster_soviet_green:{ seed: 305, pattern: 'concrete_formwork', square: true, c0: [92, 120, 98], c1: [124, 152, 128], rough: 0.78, roughVar: 0.18, metal: 0.02, bump: 2.0 },
    plaster_soviet_blue: { seed: 306, pattern: 'concrete_formwork', square: true, c0: [90, 112, 134], c1: [124, 146, 168], rough: 0.78, roughVar: 0.18, metal: 0.02, bump: 2.0 },
    plaster_soviet_ochre:{ seed: 307, pattern: 'concrete_formwork', square: true, c0: [144, 122, 80], c1: [178, 154, 104], rough: 0.80, roughVar: 0.16, metal: 0.02, bump: 2.0 },
    plaster_soviet_red:  { seed: 308, pattern: 'concrete_formwork', square: true, c0: [128, 82, 72], c1: [158, 106, 94], rough: 0.78, roughVar: 0.18, metal: 0.02, bump: 2.0 },
    tile_lab_ceramic:    { seed: 309, pattern: 'tile_grid', square: true, tilesU: 6, tilesV: 6, c0: [190, 206, 198], c1: [222, 232, 226], rough: 0.28, roughVar: 0.22, metal: 0.05, bump: 2.8 },
    tile_subway_dirty:   { seed: 310, pattern: 'tile_grid', square: true, tilesU: 4, tilesV: 4, c0: [164, 160, 150], c1: [196, 192, 182], rough: 0.36, roughVar: 0.24, metal: 0.04, bump: 2.6 },
    linoleum_industrial: { seed: 311, pattern: 'concrete_formwork', square: true, c0: [108, 92, 74], c1: [132, 114, 92], rough: 0.48, roughVar: 0.22, metal: 0.04, bump: 1.5 },
    steel_diamond_grate: { seed: 312, pattern: 'diamond_plate', square: true, c0: [68, 72, 76], c1: [112, 118, 124], rough: 0.44, roughVar: 0.20, metal: 0.86, bump: 3.4 },
    steel_dark_structural:{ seed: 313, pattern: 'brushed_metal', c0: [52, 57, 62], c1: [80, 86, 92], rough: 0.48, roughVar: 0.20, metal: 0.82, bump: 2.2 },
    steel_rusted_corrugated:{ seed: 314, pattern: 'corrugated_rust', square: true, c0: [136, 142, 144], c1: [168, 174, 176], rough: 0.56, roughVar: 0.24, metal: 0.72, bump: 3.4 },
    hazard_chevron_pbr:  { seed: 315, pattern: 'hazard_chevron', c0: [224, 166, 32], c1: [28, 30, 33], rough: 0.52, roughVar: 0.18, metal: 0.32, bump: 1.8 },
    brick_soviet_weathered:{ seed: 316, pattern: 'brick', square: true, c0: [122, 56, 42], c1: [162, 82, 58], rough: 0.86, roughVar: 0.12, metal: 0.0, bump: 3.6 },
    asphalt_cracked:     { seed: 317, pattern: 'asphalt', square: true, c0: [68, 70, 72], c1: [104, 106, 108], rough: 0.82, roughVar: 0.18, metal: 0.02, bump: 3.0 },
    wood_planks_weathered:{ seed: 318, pattern: 'wood_grain', c0: [94, 72, 50], c1: [138, 108, 76], rough: 0.78, roughVar: 0.14, metal: 0.0, bump: 2.8 },
    roof_bitumen_tar:    { seed: 319, pattern: 'asphalt', square: true, c0: [48, 50, 52], c1: [74, 76, 78], rough: 0.84, roughVar: 0.14, metal: 0.04, bump: 2.6 },
    travertine_limestone:{ seed: 320, pattern: 'ashlar_stone', square: true, courses: 8, cols: 4, c0: [196, 186, 166], c1: [226, 218, 198], rough: 0.68, roughVar: 0.14, metal: 0.02, bump: 2.6 },
    sandstone_ochre_ashlar:{ seed: 321, pattern: 'ashlar_stone', square: true, courses: 9, cols: 5, c0: [176, 152, 116], c1: [212, 188, 148], rough: 0.76, roughVar: 0.15, metal: 0.02, bump: 2.9 },
    curtain_spandrel_dark:{ seed: 322, pattern: 'curtain_mullion', square: true, baysU: 4, baysV: 3, c0: [30, 44, 56], c1: [58, 78, 96], rough: 0.24, roughVar: 0.14, metal: 0.78, bump: 2.4 },
    precast_ribbed_concrete:{ seed: 323, pattern: 'ribbed_precast', square: true, ribs: 18, c0: [132, 134, 128], c1: [170, 172, 164], rough: 0.78, roughVar: 0.14, metal: 0.04, bump: 3.1 },
    marble_lobby_veined: { seed: 324, pattern: 'polished_marble', square: true, tilesU: 3, c0: [208, 202, 188], c1: [238, 232, 218], rough: 0.18, roughVar: 0.10, metal: 0.06, bump: 1.4 },
    terracotta_plaza_paver:{ seed: 325, pattern: 'tile_grid', square: true, tilesU: 8, tilesV: 8, c0: [152, 124, 104], c1: [182, 152, 128], rough: 0.72, roughVar: 0.16, metal: 0.02, bump: 2.5 },
    painted_bridge_white:{ seed: 326, pattern: 'brushed_metal', c0: [214, 220, 224], c1: [240, 244, 246], rough: 0.34, roughVar: 0.14, metal: 0.62, bump: 1.6 },
    galvanized_spangle:  { seed: 327, pattern: 'galvanized_spangle', square: true, c0: [132, 138, 142], c1: [172, 178, 182], rough: 0.36, roughVar: 0.22, metal: 0.86, bump: 2.2 },
    corrugated_industrial:{ seed: 328, pattern: 'corrugated_industrial', square: true, c0: [108, 118, 124], c1: [148, 158, 164], rough: 0.44, roughVar: 0.20, metal: 0.78, bump: 3.2 },
    interior_painted_plaster:{ seed: 329, pattern: 'concrete_formwork', square: true, c0: [192, 190, 182], c1: [222, 220, 212], rough: 0.82, roughVar: 0.14, metal: 0.0, bump: 1.5 },
    taiga_moss_turf:     { seed: 411, pattern: 'granite', square: true, c0: [76, 92, 62], c1: [116, 132, 92], rough: 0.92, roughVar: 0.10, metal: 0.0, bump: 2.6 },

    // --- Nature, Foliage, Vehicles & Water ---
    pine_bark:           { seed: 401, pattern: 'bark', c0: [54, 38, 28], c1: [92, 64, 46], rough: 0.90, roughVar: 0.10, metal: 0.0, bump: 3.8 },
    birch_bark:          { seed: 402, pattern: 'birch_bark', c0: [214, 210, 200], c1: [56, 52, 48], rough: 0.78, roughVar: 0.16, metal: 0.0, bump: 2.6 },
    rock_alpine_granite: { seed: 403, pattern: 'granite', square: true, c0: [88, 92, 90], c1: [134, 138, 132], rough: 0.86, roughVar: 0.16, metal: 0.04, bump: 3.4 },
    terrain_detail:      { seed: 404, pattern: 'granite', square: true, c0: [164, 168, 146], c1: [224, 222, 198], rough: 0.90, roughVar: 0.12, metal: 0.0, bump: 2.8 },
    vehicle_armor_apc:   { seed: 405, pattern: 'brushed_metal', c0: [56, 68, 48], c1: [82, 96, 68], rough: 0.54, roughVar: 0.18, metal: 0.55, bump: 2.0 },
    vehicle_paint_sedan: { seed: 406, pattern: 'brushed_metal', c0: [158, 164, 166], c1: [194, 200, 202], rough: 0.34, roughVar: 0.16, metal: 0.45, bump: 1.2 },
    rubber_tire_tread:   { seed: 407, pattern: 'tire_tread', c0: [24, 25, 27], c1: [38, 40, 42], rough: 0.82, roughVar: 0.14, metal: 0.02, bump: 3.8 },
    crate_military:      { seed: 408, pattern: 'wood_grain', c0: [64, 78, 48], c1: [88, 106, 64], rough: 0.74, roughVar: 0.16, metal: 0.04, bump: 2.6 },
    crate_supply:        { seed: 409, pattern: 'wood_grain', c0: [118, 88, 52], c1: [158, 120, 74], rough: 0.74, roughVar: 0.16, metal: 0.02, bump: 2.6 },
    water_normal:        { seed: 410, pattern: 'water_wave', square: true, c0: [30, 60, 72], c1: [40, 76, 90], rough: 0.08, roughVar: 0.04, metal: 0.1, bump: 2.2 }
  };

  const PRESET_ALIASES = {
    painted_olive: 'polymer_od',
    concrete_paint_white: 'plaster_aged_white',
    polymer_rubber: 'rubber_buttpad'
  };

  function _resolvePreset(presetId) {
    const mapped = PRESET_ALIASES[presetId] || presetId;
    return PRESETS[mapped] ? mapped : 'gunmetal_parkerized';
  }

  function getMaps(presetId) {
    const id = _resolvePreset(presetId);
    const spec = PRESETS[id];
    return _synthesizeMaps(id, spec);
  }

  // Create or retrieve cached shared MeshStandardMaterial / MeshPhysicalMaterial
  function getMaterial(presetId, overrides = null) {
    const id = _resolvePreset(presetId);
    const spec = PRESETS[id];
    const key = overrides ? `${id}_${JSON.stringify(overrides)}` : id;
    if (_matCache.has(key)) return _matCache.get(key);

    const maps = _synthesizeMaps(id, spec);
    const matOpts = {
      color: (overrides && overrides.color !== undefined) ? overrides.color : 0xffffff,
      map: maps.map,
      normalMap: maps.normalMap,
      normalScale: new THREE.Vector2(
        (overrides && overrides.normalScale !== undefined) ? overrides.normalScale : 0.9,
        (overrides && overrides.normalScale !== undefined) ? overrides.normalScale : 0.9
      ),
      roughnessMap: maps.roughnessMap,
      roughness: (overrides && overrides.roughness !== undefined) ? overrides.roughness : 1.0,
      metalness: (overrides && overrides.metalness !== undefined) ? overrides.metalness : ((spec.metal !== undefined) ? spec.metal : 0.5),
      envMapIntensity: (overrides && overrides.envMapIntensity !== undefined) ? overrides.envMapIntensity : 1.15
    };
    if (overrides) {
      if (overrides.vertexColors !== undefined) matOpts.vertexColors = overrides.vertexColors;
      if (overrides.transparent !== undefined) matOpts.transparent = overrides.transparent;
      if (overrides.opacity !== undefined) matOpts.opacity = overrides.opacity;
      if (overrides.side !== undefined) matOpts.side = overrides.side;
      if (overrides.emissive !== undefined) matOpts.emissive = overrides.emissive;
      if (overrides.emissiveIntensity !== undefined) matOpts.emissiveIntensity = overrides.emissiveIntensity;
      if (overrides.polygonOffset !== undefined) matOpts.polygonOffset = overrides.polygonOffset;
      if (overrides.polygonOffsetFactor !== undefined) matOpts.polygonOffsetFactor = overrides.polygonOffsetFactor;
      if (overrides.depthWrite !== undefined) matOpts.depthWrite = overrides.depthWrite;
    }

    const mat = new THREE.MeshStandardMaterial(matOpts);
    mat.userData.tile = (overrides && overrides.tile) || (spec.square ? 2.6 : 0.45);
    if (spec.seed >= 101 && spec.seed <= 120 && !(overrides && overrides.noWeaponPatch)) {
      patchWeaponMaterial(mat, { isMetal: matOpts.metalness >= 0.45 });
    } else if (spec.square && !(overrides && overrides.noWorldPatch)) {
      patchWorldMaterial(mat, { wet: (overrides && overrides.wet !== undefined) ? overrides.wet : (spec.metal > 0.5 ? 0.28 : 0.38) });
    }
    _markShared(mat);
    _matCache.set(key, mat);
    return mat;
  }

  // --------------------------------------------------------------------------
  // Saltline World Shader Patch: World-Space Macro Weathering, Ground Splash,
  // Vertical Rain/Grime Streaks & Screen-Space Normal-Curvature Specular AA
  // --------------------------------------------------------------------------
  function patchWorldMaterial(mat, opts = {}) {
    if (!mat || mat.userData._slWorldPatched) return mat;
    mat.userData._slWorldPatched = true;
    mat.extensions = Object.assign({}, mat.extensions || {}, { derivatives: true });
    const wetVal = opts.wet !== undefined ? opts.wet : 0.36;
    const macroFreq = opts.macroFreq !== undefined ? opts.macroFreq : 0.085;
    const macroRough = opts.macroRough !== undefined ? opts.macroRough : 0.14;
    const groundY = opts.groundY !== undefined ? opts.groundY : 0.0;

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSlMacro = { value: new THREE.Vector2(macroFreq, macroRough) };
      shader.uniforms.uSlWet = { value: wetVal };
      shader.uniforms.uSlGroundY = { value: groundY };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vSlWorldPos;
varying vec3 vSlWorldNorm;`
        )
        .replace(
          '#include <project_vertex>',
          `vec4 slWp = vec4(transformed, 1.0);
vec3 slWn = objectNormal;
#ifdef USE_INSTANCING
  slWp = instanceMatrix * slWp;
  slWn = mat3(instanceMatrix) * slWn;
#endif
vSlWorldPos = (modelMatrix * slWp).xyz;
vSlWorldNorm = normalize(mat3(modelMatrix) * slWn);
#include <project_vertex>`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform vec2 uSlMacro;
uniform float uSlWet;
uniform float uSlGroundY;
varying vec3 vSlWorldPos;
varying vec3 vSlWorldNorm;
float slHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float slN3(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(slHash(i), slHash(i + vec3(1.0,0.0,0.0)), f.x), mix(slHash(i + vec3(0.0,1.0,0.0)), slHash(i + vec3(1.0,1.0,0.0)), f.x), f.y),
    mix(mix(slHash(i + vec3(0.0,0.0,1.0)), slHash(i + vec3(1.0,0.0,1.0)), f.x), mix(slHash(i + vec3(0.0,1.0,1.0)), slHash(i + vec3(1.0,1.0,1.0)), f.x), f.y),
    f.z
  );
}
float slMac = 0.5;
float slMac2 = 0.5;
float slWetK = 0.0;`
        )
        .replace(
          '#include <map_fragment>',
          `float slDist = length(vSlWorldPos - cameraPosition);
float slLodT = smoothstep(26.0, 155.0, slDist);
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vUv, slLodT * 2.2 );
  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
  #endif
  diffuseColor *= sampledDiffuseColor;
#endif
{
  vec3 slMp = vSlWorldPos * uSlMacro.x;
  slMac = slN3(slMp);
  float slDetailW = 1.0 - smoothstep(68.0, 112.0, slDist);
  if (slDetailW > 0.01) {
    slMac2 = slN3(slMp * 3.7 + 11.3);
    float slM = slMac * 0.65 + slMac2 * 0.35 - 0.5;
    diffuseColor.rgb *= (1.0 + slM * 0.24);
    float slAbsY = abs(vSlWorldNorm.y);
    float slVert = 1.0 - smoothstep(0.35, 0.72, slAbsY);
    float slSc = vSlWorldPos.x + vSlWorldPos.z;
    float slStreak = slN3(vec3(slSc * 1.9, vSlWorldPos.y * 0.26, 5.7)) * slN3(vec3(slSc * 5.2, vSlWorldPos.y * 0.55, 2.3));
    slStreak = smoothstep(0.14, 0.44, slStreak) * slVert * slDetailW;
    float slLow = smoothstep(0.80, 0.0, abs(vSlWorldPos.y - uSlGroundY)) * slVert * slDetailW;
    float slGrime = clamp(slStreak * 0.30 + slLow * 0.22 + smoothstep(0.55, 0.88, slMac * 0.6 + slMac2 * 0.4) * 0.14 * slDetailW, 0.0, 0.42);
    diffuseColor.rgb *= (1.0 - slGrime);
    slWetK = clamp(uSlWet * (slLow * 0.65 + slStreak * 0.45), 0.0, 0.75);
    diffuseColor.rgb *= (1.0 - 0.16 * slWetK);
  } else {
    slMac2 = 0.5;
    slWetK = 0.0;
    diffuseColor.rgb *= (1.0 + (slMac - 0.5) * 0.18);
  }
}`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
{
  roughnessFactor += uSlMacro.y * ((slMac2 - 0.5) * 1.3 + (slMac - 0.5) * 0.7);
  roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.62, slWetK);
  vec3 slDnX = dFdx(vSlWorldNorm);
  vec3 slDnY = dFdy(vSlWorldNorm);
  float slCurv = clamp(dot(slDnX, slDnX) + dot(slDnY, slDnY), 0.0, 0.45);
  roughnessFactor = clamp(sqrt(roughnessFactor * roughnessFactor + slCurv * 0.35 + slLodT * 0.12), 0.05, 1.0);
}`
        );
    };
    mat.customProgramCacheKey = () => 'ash_sl_world_v1';
    return mat;
  }

  // --------------------------------------------------------------------------
  // Saltline Weapon Micro-Surface Shader: 3D CNC Rings / Polymer Stipple,
  // Handling Scuffs, Screen-Space Micro-Bump & Anodized Edge-Wear Highlights
  // --------------------------------------------------------------------------
  function patchWeaponMaterial(mat, opts = {}) {
    if (!mat || mat.userData._slWpnPatched) return mat;
    mat.userData._slWpnPatched = true;
    mat.extensions = Object.assign({}, mat.extensions || {}, { derivatives: true });
    const kindVal = opts.isMetal !== false ? 0.0 : 1.0;

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWpnKind = { value: kindVal };
      shader.uniforms.uWpnWear = { value: opts.wear !== undefined ? opts.wear : 0.32 };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWpnObjP;
varying vec3 vWpnObjN;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vWpnObjP = position;
vWpnObjN = normalize(normal);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uWpnKind;
uniform float uWpnWear;
varying vec3 vWpnObjP;
varying vec3 vWpnObjN;
float wpnHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.41, 0.73, 0.19));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float wpnN3(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(wpnHash(i), wpnHash(i + vec3(1.0,0.0,0.0)), f.x), mix(wpnHash(i + vec3(0.0,1.0,0.0)), wpnHash(i + vec3(1.0,1.0,0.0)), f.x), f.y),
    mix(mix(wpnHash(i + vec3(0.0,0.0,1.0)), wpnHash(i + vec3(1.0,0.0,1.0)), f.x), mix(wpnHash(i + vec3(0.0,1.0,1.0)), wpnHash(i + vec3(1.0,1.0,1.0)), f.x), f.y),
    f.z
  );
}
vec3 wpnBump(vec3 N, float h) {
  vec3 dpdx = dFdx(-vViewPosition);
  vec3 dpdy = dFdy(-vViewPosition);
  float dhx = dFdx(h);
  float dhy = dFdy(h);
  vec3 r1 = cross(dpdy, N);
  vec3 r2 = cross(N, dpdx);
  float det = dot(dpdx, r1);
  if (abs(det) < 1e-8) return N;
  vec3 g = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * N - g);
}
float wpnHt = 0.0;
float wpnEdge = 0.0;`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
{
  vec3 dP = vWpnObjP;
  float dSm = wpnN3(dP * 38.0);
  float dSm2 = wpnN3(dP * 165.0 + 7.0);
  float dFine = wpnN3(dP * 1600.0);
  float dR = 0.0;
  if (uWpnKind < 0.5) {
    float scuff = smoothstep(0.68, 0.90, wpnN3(dP * vec3(280.0, 280.0, 28.0) + 3.0));
    float ring = sin(dP.z * 3400.0) * 0.5 + 0.5;
    dR = (dSm - 0.5) * 0.16 + (dSm2 - 0.5) * 0.09 + scuff * 0.14;
    wpnHt = (ring * 0.35 + dFine * 0.65 - scuff * 0.5) * 0.000018;
    float curv = clamp((length(dFdx(vWpnObjN)) + length(dFdy(vWpnObjN))) * 1.4, 0.0, 1.0);
    wpnEdge = smoothstep(0.18, 0.72, curv) * (0.45 + 0.55 * dSm2) * uWpnWear;
    diffuseColor.rgb = mix(diffuseColor.rgb, max(diffuseColor.rgb * 1.9, vec3(0.42, 0.44, 0.48)), wpnEdge * 0.55);
    roughnessFactor = mix(roughnessFactor, 0.22, wpnEdge * 0.7);
  } else {
    float stip = wpnN3(dP * 1150.0) * 0.6 + wpnN3(dP * 2400.0 + 5.0) * 0.4;
    dR = (dSm - 0.5) * 0.14 + (stip - 0.5) * 0.12 - smoothstep(0.62, 0.88, dSm2) * 0.08;
    wpnHt = stip * 0.000045;
  }
  roughnessFactor = clamp(roughnessFactor + dR, 0.10, 1.0);
}`
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
normal = wpnBump(normal, wpnHt);`
        );
    };
    mat.customProgramCacheKey = () => 'ash_sl_wpn_v1';
    return mat;
  }

  // --------------------------------------------------------------------------
  // Saltline Single-Draw-Call 4x4 Procedural Weathering & Stencil Decal Atlas
  // --------------------------------------------------------------------------
  const DECAL_CELLS = {
    rust_run:        [0, 0],
    grime_streak:    [1, 0],
    leak_stain:      [2, 0],
    oil_stain:       [3, 0],
    caution_stripes: [0, 1],
    hazard_voltage:  [1, 1],
    hazard_flammable:[2, 1],
    no_entry:        [3, 1],
    bay_01:          [0, 2],
    bay_02:          [1, 2],
    bay_03:          [2, 2],
    sec_a4:          [3, 2],
    fire_07:         [0, 3],
    exit_arrow:      [1, 3],
    roof_access:     [2, 3],
    vent_louvre_dark:[3, 3]
  };

  function getDecalMaterial() {
    if (_matCache.has('sl_decal_atlas')) return _matCache.get('sl_decal_atlas');
    const S = 1024;
    const C = 256;
    const cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, S, S);

    let rngS = 41923;
    const rnd = () => {
      rngS = (Math.imul(rngS, 1664525) + 1013904223) >>> 0;
      return rngS / 4294967296;
    };

    const cellOrigin = (name) => {
      const [col, row] = DECAL_CELLS[name] || [0, 0];
      return [col * C, row * C];
    };

    // Row 0: Weathering drips, grime, water leak, oil puddle
    {
      const [ox, oy] = cellOrigin('rust_run');
      for (let i = 0; i < 24; i++) {
        const rx = ox + 36 + rnd() * (C - 72);
        const rw = 4 + rnd() * 14;
        const rh = C * (0.45 + rnd() * 0.50);
        const g = ctx.createLinearGradient(0, oy + 6, 0, oy + rh);
        g.addColorStop(0.0, 'rgba(92,38,14,0.68)');
        g.addColorStop(0.3, 'rgba(116,52,18,0.42)');
        g.addColorStop(1.0, 'rgba(92,38,14,0.0)');
        ctx.fillStyle = g;
        ctx.fillRect(rx - rw * 0.5, oy + 6, rw, rh);
      }
    }
    {
      const [ox, oy] = cellOrigin('grime_streak');
      for (let i = 0; i < 32; i++) {
        const gx = ox + 16 + rnd() * (C - 32);
        const gw = 8 + rnd() * 24;
        const gh = C * (0.40 + rnd() * 0.56);
        const g = ctx.createLinearGradient(0, oy + 2, 0, oy + gh);
        g.addColorStop(0.0, 'rgba(22,24,22,0.52)');
        g.addColorStop(0.45, 'rgba(34,36,32,0.24)');
        g.addColorStop(1.0, 'rgba(22,24,22,0.0)');
        ctx.fillStyle = g;
        ctx.fillRect(gx - gw * 0.5, oy + 2, gw, gh);
      }
    }
    {
      const [ox, oy] = cellOrigin('leak_stain');
      const rg = ctx.createRadialGradient(ox + C * 0.5, oy + C * 0.5, 10, ox + C * 0.5, oy + C * 0.5, C * 0.46);
      rg.addColorStop(0.0, 'rgba(24,28,22,0.62)');
      rg.addColorStop(0.55, 'rgba(42,46,36,0.34)');
      rg.addColorStop(1.0, 'rgba(24,28,22,0.0)');
      ctx.fillStyle = rg;
      ctx.fillRect(ox, oy, C, C);
      for (let i = 0; i < 18; i++) {
        const a = rnd() * Math.PI * 2;
        const r = 20 + rnd() * 74;
        ctx.fillStyle = 'rgba(20,24,18,0.22)';
        ctx.beginPath();
        ctx.arc(ox + C * 0.5 + Math.cos(a) * r, oy + C * 0.5 + Math.sin(a) * r, 8 + rnd() * 18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    {
      const [ox, oy] = cellOrigin('oil_stain');
      for (let i = 0; i < 6; i++) {
        const cx = ox + C * (0.35 + rnd() * 0.30);
        const cy = oy + C * (0.35 + rnd() * 0.30);
        const rr = C * (0.18 + rnd() * 0.22);
        const rg = ctx.createRadialGradient(cx, cy, 4, cx, cy, rr);
        rg.addColorStop(0.0, 'rgba(10,11,13,0.78)');
        rg.addColorStop(0.65, 'rgba(16,18,22,0.48)');
        rg.addColorStop(1.0, 'rgba(10,11,13,0.0)');
        ctx.fillStyle = rg;
        ctx.fillRect(ox, oy, C, C);
      }
    }

    // Row 1: Industrial Hazard Signage
    {
      const [ox, oy] = cellOrigin('caution_stripes');
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox + 8, oy + 52, C - 16, C - 104);
      ctx.clip();
      ctx.fillStyle = '#d49a1a';
      ctx.fillRect(ox + 8, oy + 52, C - 16, C - 104);
      ctx.fillStyle = '#181a1c';
      for (let i = -C; i < C * 2; i += 38) {
        ctx.beginPath();
        ctx.moveTo(ox + i, oy + 52);
        ctx.lineTo(ox + i + 20, oy + 52);
        ctx.lineTo(ox + i - 44, oy + C - 52);
        ctx.lineTo(ox + i - 64, oy + C - 52);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    const drawPlacard = (name, bg, border, line1, line2, accent = '#111') => {
      const [ox, oy] = cellOrigin(name);
      ctx.fillStyle = bg;
      ctx.fillRect(ox + 18, oy + 28, C - 36, C - 56);
      ctx.lineWidth = 8;
      ctx.strokeStyle = border;
      ctx.strokeRect(ox + 22, oy + 32, C - 44, C - 64);
      ctx.fillStyle = border;
      ctx.fillRect(ox + 26, oy + 36, C - 52, 48);
      ctx.fillStyle = bg === '#f2c12e' ? '#141414' : '#ffffff';
      ctx.font = 'bold 26px "Arial Narrow", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(line1, ox + C * 0.5, oy + 61);
      ctx.fillStyle = accent;
      ctx.font = 'bold 34px "Arial Narrow", Arial, sans-serif';
      ctx.fillText(line2, ox + C * 0.5, oy + 148);
    };
    drawPlacard('hazard_voltage', '#f2c12e', '#1a1a1a', 'HIGH VOLTAGE', '400V // ⚡', '#161616');
    drawPlacard('hazard_flammable', '#e8ece8', '#c62828', 'FLAMMABLE', 'FUEL / JP-8', '#1c1c1c');
    drawPlacard('no_entry', '#ecece6', '#b71c1c', 'AUTHORIZED ONLY', 'NO ENTRY', '#b71c1c');

    // Row 2 & 3: Stencils & Facility Markers
    const drawStencil = (name, txt, col = 'rgba(218,214,200,0.88)', sz = 88) => {
      const [ox, oy] = cellOrigin(name);
      ctx.fillStyle = col;
      ctx.font = `900 ${sz}px Impact, "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, ox + C * 0.5, oy + C * 0.5);
    };
    drawStencil('bay_01', 'BAY 01');
    drawStencil('bay_02', 'BAY 02');
    drawStencil('bay_03', 'BAY 03');
    drawStencil('sec_a4', 'SEC-A4', 'rgba(222,172,54,0.92)', 72);
    drawStencil('fire_07', 'FD-07', 'rgba(220,218,212,0.90)', 88);
    drawStencil('exit_arrow', 'EXIT ➔', 'rgba(130,224,148,0.90)', 64);
    drawStencil('roof_access', 'ROOF', 'rgba(226,184,64,0.90)', 78);
    {
      const [ox, oy] = cellOrigin('vent_louvre_dark');
      ctx.fillStyle = 'rgba(18,20,22,0.84)';
      ctx.fillRect(ox + 10, oy + 10, C - 20, C - 20);
      for (let y = 18; y < C - 22; y += 22) {
        ctx.fillStyle = 'rgba(110,116,120,0.55)';
        ctx.fillRect(ox + 16, oy + y, C - 32, 6);
      }
    }

    // Add deterministic Saltline distress chips over paint & stencil decals
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 1600; i++) {
      const dx = rnd() * S;
      const dy = rnd() * S;
      const col = Math.floor(dx / C);
      const row = Math.floor(dy / C);
      if (row === 0 && col < 4) continue; // keep soft gradient drips intact
      ctx.fillStyle = `rgba(0,0,0,${0.18 + rnd() * 0.45})`;
      const s = 1 + rnd() * 4;
      ctx.fillRect(dx, dy, s, s * (0.5 + rnd()));
    }
    ctx.restore();

    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = _getMaxAniso();
    tex.needsUpdate = true;
    _markShared(tex);

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      roughness: 0.72,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    _markShared(mat);
    _matCache.set('sl_decal_atlas', mat);
    return mat;
  }

  function getGlassMaterial(tintHex = 0x203242, opacity = 0.45, roughness = 0.06, metalness = 0.25) {
    const k = `glass_${tintHex}_${opacity}_${roughness}`;
    if (_matCache.has(k)) return _matCache.get(k);
    const mat = new THREE.MeshStandardMaterial({
      color: tintHex,
      roughness,
      metalness,
      transparent: true,
      opacity,
      envMapIntensity: 1.85,
      depthWrite: false
    });
    _markShared(mat);
    _matCache.set(k, mat);
    return mat;
  }

  // Build Dual High-Resolution Equirectangular PMREM Probes ('outdoor' & 'indoor')
  function getEnvMap(renderer, kind = 'outdoor') {
    const r = renderer || window.mainWebGLRenderer;
    if (!r || typeof THREE.PMREMGenerator !== 'function') return null;
    const key = kind === 'indoor' ? 'indoor' : 'outdoor';
    if (_envCache.has(key)) return _envCache.get(key);
    try {
      const pmrem = new THREE.PMREMGenerator(r);
      if (pmrem.compileEquirectangularShader) pmrem.compileEquirectangularShader();
      const W = 512, H = 256;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');

      if (key === 'outdoor') {
        const sky = g.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0.0, '#44607a');
        sky.addColorStop(0.32, '#7b95ab');
        sky.addColorStop(0.49, '#c6d1d8');
        sky.addColorStop(0.51, '#3e483c');
        sky.addColorStop(0.65, '#262b22');
        sky.addColorStop(1.0, '#141714');
        g.fillStyle = sky;
        g.fillRect(0, 0, W, H);
        // Low northern sun halo + bright core
        const sunG = g.createRadialGradient(340, 82, 4, 340, 82, 68);
        sunG.addColorStop(0.0, 'rgba(255,244,218,1.0)');
        sunG.addColorStop(0.22, 'rgba(255,220,168,0.65)');
        sunG.addColorStop(1.0, 'rgba(255,210,160,0.0)');
        g.fillStyle = sunG;
        g.fillRect(260, 12, 160, 140);
        // Subtle cool cloud bands
        g.fillStyle = 'rgba(218,228,238,0.16)';
        for (let i = 0; i < 8; i++) {
          g.fillRect((i * 73) % W, 42 + (i % 3) * 14, 96, 8);
        }
      } else {
        // Bunker / FOB interior industrial reflection probe
        const bg = g.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0.0, '#1c2228');
        bg.addColorStop(0.45, '#2b3238');
        bg.addColorStop(0.52, '#3a342c');
        bg.addColorStop(1.0, '#141618');
        g.fillStyle = bg;
        g.fillRect(0, 0, W, H);
        // Overhead industrial fluorescent + warm amber luminaire reflection strips
        for (const sx of [64, 192, 320, 448]) {
          const lg = g.createRadialGradient(sx, 38, 2, sx, 38, 42);
          lg.addColorStop(0.0, 'rgba(225,245,255,0.95)');
          lg.addColorStop(0.35, 'rgba(180,210,230,0.45)');
          lg.addColorStop(1.0, 'rgba(120,150,170,0.0)');
          g.fillStyle = lg;
          g.fillRect(sx - 44, 0, 88, 84);
        }
        const warmStrip = g.createRadialGradient(256, 70, 4, 256, 70, 56);
        warmStrip.addColorStop(0.0, 'rgba(255,214,148,0.85)');
        warmStrip.addColorStop(1.0, 'rgba(255,180,100,0.0)');
        g.fillStyle = warmStrip;
        g.fillRect(190, 16, 132, 110);
      }

      const eqTex = new THREE.CanvasTexture(c);
      eqTex.mapping = THREE.EquirectangularReflectionMapping;
      eqTex.encoding = THREE.sRGBEncoding;
      const rt = pmrem.fromEquirectangular(eqTex);
      const env = rt.texture;
      _markShared(env);
      eqTex.dispose();
      pmrem.dispose();
      _envCache.set(key, env);
      return env;
    } catch (e) {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Metric Seam-Stitched UV Unwrappers & UV2 AO Support
  // --------------------------------------------------------------------------
  const UVUnwrap = {
    ensureUV2(geo) {
      if (!geo || !geo.attributes || !geo.attributes.uv) return geo;
      if (!geo.attributes.uv2) {
        geo.setAttribute('uv2', geo.attributes.uv);
      }
      return geo;
    },

    // Seamlessly unfolded box UVs with continuous corners around +/-Z and +/-X
    unwrapBox(geo, tileSize = 1.0) {
      if (!geo || !geo.attributes || !geo.attributes.position) return geo;
      geo.computeBoundingBox();
      if (!geo.attributes.normal) geo.computeVertexNormals();
      const bb = geo.boundingBox;
      const minX = bb.min.x, maxX = bb.max.x;
      const minY = bb.min.y, maxY = bb.max.y;
      const minZ = bb.min.z, maxZ = bb.max.z;
      const dx = maxX - minX, dz = maxZ - minZ;
      const invT = 1.0 / Math.max(1e-4, tileSize);

      const pos = geo.attributes.position;
      const norm = geo.attributes.normal;
      let uv = geo.attributes.uv;
      if (!uv || uv.count !== pos.count) {
        uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
        geo.setAttribute('uv', uv);
      }
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const nx = norm.getX(i), ny = norm.getY(i), nz = norm.getZ(i);
        const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
        let u = 0, v = 0;
        if (az >= ax && az >= ay) {
          v = (y - minY) * invT;
          u = nz >= 0 ? (x - minX) * invT : (dx + dz + (maxX - x)) * invT;
        } else if (ax >= ay && ax >= az) {
          v = (y - minY) * invT;
          u = nx >= 0 ? (dx + (maxZ - z)) * invT : (-(maxZ - z)) * invT;
        } else {
          u = (x - minX) * invT;
          v = ny >= 0 ? ((maxY - minY) + (maxZ - z)) * invT : (-(maxZ - z)) * invT;
        }
        uv.setXY(i, u, v);
      }
      uv.needsUpdate = true;
      return this.ensureUV2(geo);
    },

    // Preserves duplicate seam vertex column on CylinderGeometry / LatheGeometry so 360-deg wrap never zips
    unwrapCylinder(geo, radius = null, axis = 'y', tileSize = 0.35) {
      if (!geo || !geo.attributes || !geo.attributes.position) return geo;
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      let r = radius;
      if (!r || r <= 0) {
        const sx = bb.max.x - bb.min.x;
        const sy = bb.max.y - bb.min.y;
        const sz = bb.max.z - bb.min.z;
        r = axis === 'x' ? Math.max(sy, sz) * 0.5 : (axis === 'z' ? Math.max(sx, sy) * 0.5 : Math.max(sx, sz) * 0.5);
      }
      const circ = Math.max(1e-4, Math.PI * 2 * r);
      const invT = 1.0 / Math.max(1e-4, tileSize);
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      if (!uv) return this.unwrapBox(geo, tileSize);
      for (let i = 0; i < pos.count; i++) {
        const u0 = uv.getX(i);
        const axCoord = axis === 'x' ? pos.getX(i) : (axis === 'z' ? pos.getZ(i) : pos.getY(i));
        const axMin = axis === 'x' ? bb.min.x : (axis === 'z' ? bb.min.z : bb.min.y);
        uv.setXY(i, u0 * circ * invT, (axCoord - axMin) * invT);
      }
      uv.needsUpdate = true;
      return this.ensureUV2(geo);
    },

    // Continuous perimeter-stitched UVs for Three.js ExtrudeGeometry (non-indexed caps + continuous side walls)
    unwrapExtrude(geo, tileSize = 0.32) {
      if (!geo || !geo.attributes || !geo.attributes.position) return geo;
      let g = geo.index ? geo.toNonIndexed() : geo;
      g.computeBoundingBox();
      if (!g.attributes.normal) g.computeVertexNormals();
      const bb = g.boundingBox;
      const pos = g.attributes.position;
      const norm = g.attributes.normal;
      let uv = g.attributes.uv;
      if (!uv || uv.count !== pos.count) {
        uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
        g.setAttribute('uv', uv);
      }
      const invT = 1.0 / Math.max(1e-4, tileSize);
      let sAccum = 0;
      let prevEndX = NaN, prevEndY = NaN;

      for (let i = 0; i + 2 < pos.count; i += 3) {
        const nz = (norm.getZ(i) + norm.getZ(i + 1) + norm.getZ(i + 2)) / 3;
        if (Math.abs(nz) > 0.72) {
          for (let k = 0; k < 3; k++) {
            const vi = i + k;
            uv.setXY(vi, (pos.getX(vi) - bb.min.x) * invT, (pos.getY(vi) - bb.min.y) * invT);
          }
          continue;
        }
        // Side wall / bevel triangle: accumulate arc length in XY plane vs Z depth
        const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
        const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
        const x2 = pos.getX(i + 2), y2 = pos.getY(i + 2), z2 = pos.getZ(i + 2);
        // Find longest 2D step in XY among the 3 triangle edges
        const d01 = Math.hypot(x1 - x0, y1 - y0);
        const d12 = Math.hypot(x2 - x1, y2 - y1);
        const d20 = Math.hypot(x0 - x2, y0 - y2);
        let ax = x0, ay = y0, bx = x1, by = y1, seg = d01;
        if (d12 > seg) { seg = d12; ax = x1; ay = y1; bx = x2; by = y2; }
        if (d20 > seg) { seg = d20; ax = x2; ay = y2; bx = x0; by = y0; }

        if (seg > 1e-6) {
          if (Math.hypot(ax - prevEndX, ay - prevEndY) > 1e-4) {
            if (Math.hypot(bx - prevEndX, by - prevEndY) < 1e-4) {
              const tx = ax, ty = ay; ax = bx; ay = by; bx = tx; by = ty;
            } else {
              sAccum = 0;
            }
          }
          const invS = 1.0 / seg;
          const dirX = (bx - ax) * invS;
          const dirY = (by - ay) * invS;
          for (let k = 0; k < 3; k++) {
            const vi = i + k;
            const px = pos.getX(vi), py = pos.getY(vi), pz = pos.getZ(vi);
            const proj = (px - ax) * dirX + (py - ay) * dirY;
            uv.setXY(vi, (sAccum + proj) * invT, (pz - bb.min.z) * invT);
          }
          sAccum += seg;
          prevEndX = bx;
          prevEndY = by;
        } else {
          for (let k = 0; k < 3; k++) {
            const vi = i + k;
            uv.setXY(vi, (pos.getZ(vi) - bb.min.z) * invT, (pos.getY(vi) - bb.min.y) * invT);
          }
        }
      }
      uv.needsUpdate = true;
      return this.ensureUV2(g);
    }
  };

  function clearCachesForQualityChange() {
    for (const [k, texSet] of _texSetCache.entries()) {
      if (texSet.map && typeof texSet.map.dispose === 'function') texSet.map.dispose();
      if (texSet.normalMap && typeof texSet.normalMap.dispose === 'function') texSet.normalMap.dispose();
      if (texSet.roughnessMap && typeof texSet.roughnessMap.dispose === 'function') texSet.roughnessMap.dispose();
      _texSetCache.delete(k);
    }
  }

  return {
    PRESETS,
    UVUnwrap,
    DECAL_CELLS,
    getMaps,
    getMaterial,
    getGlassMaterial,
    getDecalMaterial,
    patchWorldMaterial,
    patchWeaponMaterial,
    getEnvMap,
    clearCachesForQualityChange,
    markShared: _markShared
  };
})();
