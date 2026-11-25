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
    if (isSquare) {
      return q <= 1 ? [512, 512] : (q === 2 ? [768, 768] : [1024, 1024]);
    }
    // Native 720p (1280x720) at High texture setting
    return q <= 1 ? [640, 360] : (q === 2 ? [960, 540] : [1280, 720]);
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
    _markShared(mat);
    _matCache.set(key, mat);
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
    getMaps,
    getMaterial,
    getGlassMaterial,
    getEnvMap,
    clearCachesForQualityChange,
    markShared: _markShared
  };
})();
