// Declarative Prototype-Cached 3D Model System, Real 1K GLTF Prop Instancer & Optical Lens Flare System
// Shared across Viewmodel Weapons, 3P Weapons, World Vehicles, Loot Props & Atmospheric Lighting

window.ModelSystem = (() => {
  const _texCache = {};
  const _matCache = {};
  const _geoCache = {};
  const _gltfCache = {};
  const _gltfPromises = {};
  let _loader = null;

  const GLTF_PROP_PATHS = {
    wooden_military_crate: 'assets/models/items/wooden_military_crate/wooden_military_crate_1k.gltf',
    ammo_box: 'assets/models/items/ammo_box/ammo_box_1k.gltf',
    medical_box: 'assets/models/items/medical_box/medical_box_1k.gltf',
    plastic_jerrycan: 'assets/models/items/plastic_jerrycan/plastic_jerrycan_1k.gltf',
    vintage_radio_transceiver: 'assets/models/items/vintage_radio_transceiver/vintage_radio_transceiver_1k.gltf',
    old_gas_mask: 'assets/models/items/old_gas_mask/old_gas_mask_1k.gltf',
    vintage_pocket_watch: 'assets/models/items/vintage_pocket_watch/vintage_pocket_watch_1k.gltf',
    medical_tape: 'assets/models/items/medical_tape/medical_tape_1k.gltf',
    oil_tin: 'assets/models/items/oil_tin/oil_tin_1k.gltf'
  };

  function _mkCanvasTex(key, size, drawFn) {
    if (_texCache[key]) return _texCache[key];
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    drawFn(ctx, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 4;
    tex.userData = { _ashShared: true };
    _texCache[key] = tex;
    return tex;
  }

  function _fineGrain(ctx, SZ, baseR, baseG, baseB, variance, streakH = false, count = 2400) {
    const grad = ctx.createLinearGradient(0, 0, 0, SZ);
    grad.addColorStop(0, `rgb(${Math.min(255, baseR + 12)},${Math.min(255, baseG + 12)},${Math.min(255, baseB + 14)})`);
    grad.addColorStop(0.5, `rgb(${baseR},${baseG},${baseB})`);
    grad.addColorStop(1, `rgb(${Math.max(0, baseR - 12)},${Math.max(0, baseG - 12)},${Math.max(0, baseB - 10)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SZ, SZ);
    // Deterministic seeded PRNG for reproducible surface micro-grain
    let s = (baseR * 73 + baseG * 137 + baseB * 251) | 1;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      const x = (rnd() * SZ) | 0;
      const y = (rnd() * SZ) | 0;
      const d = ((rnd() - 0.5) * variance) | 0;
      const r = Math.max(0, Math.min(255, baseR + d));
      const g = Math.max(0, Math.min(255, baseG + d));
      const b = Math.max(0, Math.min(255, baseB + d));
      ctx.fillStyle = `rgba(${r},${g},${b},0.65)`;
      ctx.fillRect(x, y, streakH ? (6 + ((rnd() * 20) | 0)) : 2, streakH ? 1 : 2);
    }
  }

  function getWeaponTextures() {
    if (window._wpnTex && window._wpnTex._v === 2) return window._wpnTex;
    const SZ = 256;
    const bumpNoise = _mkCanvasTex('bump_micro', SZ, (ctx) => {
      _fineGrain(ctx, SZ, 128, 128, 128, 48, false, 3600);
    });
    const bumpStipple = _mkCanvasTex('bump_stipple', SZ, (ctx) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, SZ, SZ);
      for (let y = 0; y < SZ; y += 4) {
        for (let x = ((y % 8) === 0 ? 0 : 2); x < SZ; x += 4) {
          ctx.fillStyle = '#383838';
          ctx.fillRect(x, y, 2, 2);
          ctx.fillStyle = '#c8c8c8';
          ctx.fillRect(x + 1, y + 1, 1, 1);
        }
      }
    });
    const bumpBrush = _mkCanvasTex('bump_brush', SZ, (ctx) => {
      _fineGrain(ctx, SZ, 128, 128, 128, 52, true, 4200);
    });

    window._wpnTex = {
      _v: 2,
      bumpNoise,
      bumpStipple,
      bumpBrush,
      parkerized: _mkCanvasTex('wpn_parkerized', SZ, (ctx) => {
        _fineGrain(ctx, SZ, 52, 57, 63, 20, true, 3200);
        ctx.fillStyle = 'rgba(175, 192, 208, 0.18)';
        ctx.fillRect(0, 0, SZ, 3);
        ctx.fillRect(0, 125, SZ, 2);
        ctx.fillStyle = 'rgba(12, 15, 18, 0.34)';
        ctx.fillRect(0, 127, SZ, 2);
        for (let rx = 24; rx < SZ; rx += 64) {
          ctx.fillStyle = 'rgba(18, 22, 26, 0.5)';
          ctx.beginPath(); ctx.arc(rx, 18, 3.2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(160, 175, 190, 0.28)';
          ctx.beginPath(); ctx.arc(rx - 0.8, 17.2, 1.5, 0, Math.PI * 2); ctx.fill();
        }
      }),
      blued: _mkCanvasTex('wpn_blued', SZ, (ctx) => {
        _fineGrain(ctx, SZ, 30, 37, 47, 16, true, 3000);
        ctx.fillStyle = 'rgba(105, 136, 178, 0.14)';
        for (let y = 14; y < SZ; y += 42) ctx.fillRect(0, y, SZ, 4);
        ctx.fillStyle = 'rgba(195, 212, 232, 0.12)';
        ctx.fillRect(0, 2, SZ, 2);
      }),
      brushedSteel: _mkCanvasTex('wpn_brushed', SZ, (ctx) => {
        _fineGrain(ctx, SZ, 118, 125, 134, 28, true, 3600);
        ctx.fillStyle = 'rgba(235, 244, 255, 0.22)';
        for (let y = 8; y < SZ; y += 24) ctx.fillRect(0, y, SZ, 2);
      }),
      polymer: _mkCanvasTex('wpn_polymer', SZ, (ctx) => {
        _fineGrain(ctx, SZ, 26, 29, 34, 10, false, 2000);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
        for (let y = 0; y < SZ; y += 4) {
          for (let x = ((y % 8) === 0 ? 0 : 2); x < SZ; x += 4) {
            ctx.fillRect(x, y, 2, 2);
          }
        }
        ctx.fillStyle = 'rgba(92, 100, 112, 0.09)';
        for (let y = 2; y < SZ; y += 8) ctx.fillRect(0, y, SZ, 1);
      }),
      bakelite: _mkCanvasTex('wpn_bakelite', SZ, (ctx) => {
        _fineGrain(ctx, SZ, 126, 56, 32, 20, false, 2200);
        for (let i = 0; i < 68; i++) {
          ctx.strokeStyle = (i % 2 === 0) ? 'rgba(78, 28, 12, 0.36)' : 'rgba(176, 88, 48, 0.28)';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          const y0 = (i * 37) % SZ;
          for (let x = 0; x <= SZ; x += 8) {
            const dy = Math.sin(x * 0.045 + i * 0.7) * 9;
            if (x === 0) ctx.moveTo(x, (y0 + dy + SZ) % SZ);
            else ctx.lineTo(x, (y0 + dy + SZ) % SZ);
          }
          ctx.stroke();
        }
      }),
      wood: _mkCanvasTex('wpn_wood', SZ, (ctx) => {
        _fineGrain(ctx, SZ, 112, 68, 36, 18, true, 2600);
        for (let y = 0; y < SZ; y += 7) {
          ctx.strokeStyle = (y % 14 === 0) ? 'rgba(62, 32, 12, 0.42)' : 'rgba(154, 98, 54, 0.26)';
          ctx.lineWidth = 2.3;
          ctx.beginPath();
          for (let x = 0; x <= SZ; x += 8) {
            const oy = Math.sin(x * 0.036 + y * 0.09) * 5;
            if (x === 0) ctx.moveTo(x, y + oy);
            else ctx.lineTo(x, y + oy);
          }
          ctx.stroke();
        }
      }),
      composite: _mkCanvasTex('wpn_composite', SZ, (ctx) => {
        _fineGrain(ctx, SZ, 60, 72, 54, 16, false, 2400);
        ctx.fillStyle = 'rgba(26, 32, 22, 0.24)';
        for (let i = 0; i < 420; i++) {
          ctx.fillRect((i * 53) % SZ, (i * 97) % SZ, 3, 2);
        }
      }),
      brass: _mkCanvasTex('wpn_brass', SZ, (ctx) => {
        const g = ctx.createLinearGradient(0, 0, SZ, 0);
        g.addColorStop(0, '#be9236');
        g.addColorStop(0.35, '#f0cc6e');
        g.addColorStop(0.65, '#cfa040');
        g.addColorStop(1, '#ae8028');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, SZ, SZ);
        ctx.fillStyle = 'rgba(255, 250, 214, 0.28)';
        ctx.fillRect(50, 0, 22, SZ);
      }),
      copper: _mkCanvasTex('wpn_copper', SZ, (ctx) => {
        const g = ctx.createLinearGradient(0, 0, SZ, 0);
        g.addColorStop(0, '#96502c');
        g.addColorStop(0.4, '#cf7a4c');
        g.addColorStop(1, '#844222');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, SZ, SZ);
      }),
      shellRed: _mkCanvasTex('wpn_shellred', SZ, (ctx) => {
        _fineGrain(ctx, SZ, 176, 36, 36, 12, false, 1400);
        for (let x = 0; x < SZ; x += 12) {
          ctx.fillStyle = 'rgba(84, 12, 12, 0.38)';
          ctx.fillRect(x, 0, 3, SZ);
          ctx.fillStyle = 'rgba(232, 102, 102, 0.18)';
          ctx.fillRect(x + 3, 0, 2, SZ);
        }
      })
    };
    return window._wpnTex;
  }

  function getWeaponMaterialSet(gunMat = null) {
    const tex = getWeaponTextures();
    const envMap = (window.AshfallRenderer && window.AshfallRenderer.getEnvMap) ? window.AshfallRenderer.getEnvMap() : null;
    const key = gunMat ? `camo_${gunMat.uuid}` : `stock_${envMap ? envMap.uuid : '0'}`;
    if (_matCache[key]) return _matCache[key];
    const hasCamo = !!gunMat;
    const set = {
      steelMat: hasCamo ? gunMat : new THREE.MeshPhongMaterial({
        color: 0xffffff, map: tex.parkerized, bumpMap: tex.bumpBrush, bumpScale: 0.0014,
        specular: 0x5c6876, shininess: 48, envMap, reflectivity: 0.22
      }),
      bluedMat: hasCamo ? gunMat : new THREE.MeshPhongMaterial({
        color: 0xffffff, map: tex.blued, bumpMap: tex.bumpBrush, bumpScale: 0.0011,
        specular: 0x50627a, shininess: 58, envMap, reflectivity: 0.26
      }),
      darkMat: new THREE.MeshPhongMaterial({
        color: 0xffffff, map: tex.polymer, bumpMap: tex.bumpStipple, bumpScale: 0.0022,
        specular: 0x22262c, shininess: 22
      }),
      magMat: new THREE.MeshPhongMaterial({
        color: 0xffffff, map: tex.brushedSteel, bumpMap: tex.bumpBrush, bumpScale: 0.0012,
        specular: 0x8694a4, shininess: 68, envMap, reflectivity: 0.30
      }),
      bakeliteMat: new THREE.MeshPhongMaterial({
        color: 0xffffff, map: tex.bakelite, bumpMap: tex.bumpNoise, bumpScale: 0.0010,
        specular: 0x3b261b, shininess: 28
      }),
      brassMat: new THREE.MeshPhongMaterial({
        color: 0xffffff, map: tex.brass, specular: 0xfff0b0, shininess: 92, envMap, reflectivity: 0.38
      }),
      copperMat: new THREE.MeshPhongMaterial({
        color: 0xffffff, map: tex.copper, specular: 0xffb88c, shininess: 82, envMap, reflectivity: 0.34
      }),
      woodMat: new THREE.MeshPhongMaterial({
        color: 0xffffff, map: tex.wood, bumpMap: tex.bumpNoise, bumpScale: 0.0015,
        specular: 0x281a10, shininess: 18
      }),
      chassisMat: hasCamo ? gunMat : new THREE.MeshPhongMaterial({
        color: 0xffffff, map: tex.composite, bumpMap: tex.bumpStipple, bumpScale: 0.0016,
        specular: 0x262c22, shininess: 24
      }),
      shellRedMat: new THREE.MeshPhongMaterial({
        color: 0xffffff, map: tex.shellRed, bumpMap: tex.bumpStipple, bumpScale: 0.0016,
        specular: 0x482222, shininess: 28
      }),
      boreMat: new THREE.MeshBasicMaterial({ color: 0x050607 }),
      chromeMat: new THREE.MeshPhongMaterial({
        color: 0xcfd6de, specular: 0xffffff, shininess: 110, envMap, reflectivity: 0.45
      })
    };
    Object.values(set).forEach((m) => { if (m) { if (!m.userData) m.userData = {}; m.userData._ashShared = true; } });
    _matCache[key] = set;
    return set;
  }

  function _cachedGeo(key, fn) {
    if (!_geoCache[key]) {
      const g = fn();
      if (g) { if (!g.userData) g.userData = {}; g.userData._ashShared = true; }
      _geoCache[key] = g;
    }
    return _geoCache[key];
  }

  // Merge array of BufferGeometries safely in Three r128 without external BufferGeometryUtils
  function _mergeGeos(geos) {
    if (!geos || geos.length === 0) return new THREE.BoxGeometry(0.01, 0.01, 0.01);
    const nonIdx = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    let totalVerts = 0;
    for (let i = 0; i < nonIdx.length; i++) {
      const p = nonIdx[i].getAttribute('position');
      if (p) totalVerts += p.count;
    }
    const pos = new Float32Array(totalVerts * 3);
    const norm = new Float32Array(totalVerts * 3);
    const uv = new Float32Array(totalVerts * 2);
    let vOff = 0;
    for (let i = 0; i < nonIdx.length; i++) {
      const g = nonIdx[i];
      const p = g.getAttribute('position');
      if (!p) continue;
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      const n = g.getAttribute('normal');
      const u = g.getAttribute('uv');
      pos.set(p.array, vOff * 3);
      if (n) norm.set(n.array, vOff * 3);
      if (u) uv.set(u.array, vOff * 2);
      vOff += p.count;
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return merged;
  }

  // Contoured Lathe profile oriented along -Z (zFwd = +distance toward muzzle)
  function geoLatheZ(cacheKey, profileZR, segs = 16) {
    return _cachedGeo(`lathe:${cacheKey}:${segs}`, () => {
      const pts = profileZR.map(([zFwd, r]) => new THREE.Vector2(Math.max(0.0001, r), zFwd));
      const geo = new THREE.LatheGeometry(pts, segs);
      geo.rotateX(-Math.PI / 2); // +Y_lathe -> -Z_weapon
      geo.computeVertexNormals();
      return geo;
    });
  }

  function geoRoundedBox(w, h, d, r = 0.004, bevel = 0.0018) {
    const key = `rb:${w.toFixed(4)}:${h.toFixed(4)}:${d.toFixed(4)}:${r.toFixed(4)}:${bevel.toFixed(4)}`;
    return _cachedGeo(key, () => {
      const rr = Math.min(r, w * 0.42, h * 0.42);
      const hw = w * 0.5;
      const hh = h * 0.5;
      const sh = new THREE.Shape();
      sh.moveTo(-hw + rr, -hh);
      sh.lineTo(hw - rr, -hh);
      sh.quadraticCurveTo(hw, -hh, hw, -hh + rr);
      sh.lineTo(hw, hh - rr);
      sh.quadraticCurveTo(hw, hh, hw - rr, hh);
      sh.lineTo(-hw + rr, hh);
      sh.quadraticCurveTo(-hw, hh, -hw, hh - rr);
      sh.lineTo(-hw, -hh + rr);
      sh.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
      const b = Math.min(bevel, d * 0.15, rr * 0.6);
      const geo = new THREE.ExtrudeGeometry(sh, {
        depth: Math.max(0.002, d - b * 2),
        bevelEnabled: b > 0.0002,
        bevelThickness: b,
        bevelSize: b * 0.85,
        bevelSegments: 2,
        curveSegments: 5
      });
      geo.translate(0, 0, -(d - b * 2) * 0.5);
      geo.computeVertexNormals();
      return geo;
    });
  }

  function geoExtrudeSide(cacheKey, pts, width, holes = null, bevel = false) {
    return _cachedGeo(`ext:${cacheKey}`, () => {
      const sh = new THREE.Shape();
      sh.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
      sh.closePath();
      if (holes) {
        for (const hPts of holes) {
          const hp = new THREE.Path();
          hp.moveTo(hPts[0][0], hPts[0][1]);
          for (let i = 1; i < hPts.length; i++) hp.lineTo(hPts[i][0], hPts[i][1]);
          hp.closePath();
          sh.holes.push(hp);
        }
      }
      const geo = new THREE.ExtrudeGeometry(sh, {
        depth: width,
        bevelEnabled: bevel,
        bevelThickness: bevel ? 0.0024 : 0,
        bevelSize: bevel ? 0.0020 : 0,
        bevelSegments: 2,
        curveSegments: 10
      });
      geo.translate(0, 0, -width * 0.5);
      geo.rotateY(Math.PI / 2);
      geo.computeVertexNormals();
      return geo;
    });
  }

  function geoCurvedGrip(w, h, d) {
    return _cachedGeo(`grip:${w.toFixed(4)}:${h.toFixed(4)}:${d.toFixed(4)}`, () => {
      const sh = new THREE.Shape();
      const hw = d * 0.5;
      const hh = h * 0.5;
      sh.moveTo(-hw * 0.90, hh);
      sh.lineTo(hw * 0.85, hh);
      sh.bezierCurveTo(hw * 0.72, hh * 0.35, hw * 1.05, -hh * 0.25, hw * 0.88, -hh);
      sh.lineTo(-hw * 0.92, -hh);
      sh.bezierCurveTo(-hw * 1.08, -hh * 0.30, -hw * 0.78, hh * 0.32, -hw * 0.90, hh);
      const geo = new THREE.ExtrudeGeometry(sh, {
        depth: w,
        bevelEnabled: true,
        bevelThickness: 0.0025,
        bevelSize: 0.0022,
        bevelSegments: 2,
        curveSegments: 8
      });
      geo.translate(0, 0, -w * 0.5);
      geo.rotateY(Math.PI / 2);
      geo.computeVertexNormals();
      return geo;
    });
  }

  function geoPicatinnyRail(yPos, zStart, zEnd, width = 0.021, step = 0.013) {
    const key = `pic:${yPos.toFixed(4)}:${zStart.toFixed(4)}:${zEnd.toFixed(4)}:${width.toFixed(4)}:${step.toFixed(4)}`;
    return _cachedGeo(key, () => {
      const zMin = Math.min(zStart, zEnd);
      const zMax = Math.max(zStart, zEnd);
      const parts = [];
      for (let z = zMin + step * 0.4; z <= zMax - step * 0.4; z += step) {
        const g = new THREE.BoxGeometry(width, 0.0036, step * 0.56);
        g.translate(0, yPos, z);
        parts.push(g);
      }
      return _mergeGeos(parts);
    });
  }

  function createCartridgeMesh(caliber = 'rifle', mats = null) {
    const m = mats || getWeaponMaterialSet(null);
    const grp = new THREE.Group();
    const isPistol = caliber === 'pistol';
    const isShotgun = caliber === '12g';
    if (isShotgun) {
      const hull = new THREE.Mesh(
        _cachedGeo('round_12g_hull', () => new THREE.CylinderGeometry(0.0085, 0.0085, 0.048, 12)),
        m.shellRedMat
      );
      hull.rotation.x = Math.PI / 2;
      const brass = new THREE.Mesh(
        _cachedGeo('round_12g_brass', () => new THREE.CylinderGeometry(0.0090, 0.0090, 0.014, 12)),
        m.brassMat
      );
      brass.rotation.x = Math.PI / 2;
      brass.position.z = 0.025;
      grp.add(hull, brass);
      return grp;
    }
    const r = isPistol ? 0.0046 : (caliber === 'x39' ? 0.0057 : 0.0056);
    const len = isPistol ? 0.019 : (caliber === 'x39' ? 0.0386 : 0.042);
    const caseGeo = _cachedGeo(`round_case_${caliber}`, () => {
      const g = new THREE.CylinderGeometry(r * 0.88, r, len, 10);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const tipGeo = _cachedGeo(`round_tip_${caliber}`, () => {
      const g = new THREE.ConeGeometry(r * 0.84, len * 0.52, 10);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    const cMesh = new THREE.Mesh(caseGeo, m.brassMat);
    const tMesh = new THREE.Mesh(tipGeo, m.copperMat);
    tMesh.position.z = -len * 0.72;
    grp.add(cMesh, tMesh);
    return grp;
  }

  function _addTriggerAndPins(g, m, zTrigger, yTrigger, pinXHalf, pinCoords) {
    const guardGeo = geoExtrudeSide(`tguard_${zTrigger.toFixed(2)}`, [
      [0.022, 0.004], [0.024, -0.020], [0.014, -0.025], [-0.018, -0.025],
      [-0.024, -0.018], [-0.024, 0.002], [-0.018, 0.002], [-0.018, -0.018],
      [0.014, -0.019], [0.018, -0.014], [0.017, 0.004]
    ], 0.011, null, true);
    const guard = new THREE.Mesh(guardGeo, m.darkMat);
    guard.position.set(0, yTrigger, zTrigger);

    const trigGeo = geoExtrudeSide('trig_shoe', [
      [-0.002, 0.002], [0.003, 0.002], [-0.001, -0.010], [-0.006, -0.017],
      [-0.010, -0.015], [-0.006, -0.008]
    ], 0.005, null, false);
    const trig = new THREE.Mesh(trigGeo, m.magMat);
    trig.position.set(0, yTrigger - 0.001, zTrigger + 0.002);
    g.add(guard, trig);

    if (pinCoords && pinCoords.length > 0) {
      const pinGeo = _cachedGeo(`pin_${pinXHalf.toFixed(4)}`, () => {
        const p = new THREE.CylinderGeometry(0.0030, 0.0030, pinXHalf * 2 + 0.004, 8);
        p.rotateZ(Math.PI / 2);
        return p;
      });
      for (const [py, pz] of pinCoords) {
        const pin = new THREE.Mesh(pinGeo, m.magMat);
        pin.position.set(0, py, pz);
        g.add(pin);
      }
    }
    return trig;
  }

  // Declarative Articulated Weapon Rig Builder for all 8 Firearms
  function buildWeaponRig(weaponDef, mods = {}, gunMat = null) {
    const id = weaponDef.id;
    const m = getWeaponMaterialSet(gunMat);
    const g = new THREE.Group();
    const out = {
      group: g,
      boltMesh: null,
      boltCarrierMesh: null,
      magMesh: null,
      spareMagMesh: null,
      chamberRoundMesh: null,
      triggerMesh: null,
      sightHeight: 0.04,
      adsZ: -0.25,
      muzzlePos: new THREE.Vector3(0, 0.01, -0.5),
      flashPos: new THREE.Vector3(0, 0.01, -0.54),
      rightHandPos: new THREE.Vector3(0, -0.06, 0.14),
      rightHandRot: new THREE.Euler(0, 0, 0),
      rightHandStyle: 'grip',
      leftHandPos: new THREE.Vector3(0, -0.03, -0.20),
      leftHandRot: new THREE.Euler(0, 0, 0),
      leftHandStyle: 'supportRifle',
      ironSightTarget: g,
      ironSightOpts: null
    };

    if (weaponDef.slot === 'secondary') {
      const isG17 = id === 'g17';
      const slideLen = isG17 ? 0.24 : 0.21;
      const slideGroup = new THREE.Group();

      if (isG17) {
        const frameGeo = geoExtrudeSide('g17_frame', [
          [0.095, -0.008], [0.095, -0.024], [0.045, -0.024], [0.030, -0.020],
          [-0.038, -0.020], [-0.042, -0.036], [-0.056, -0.116], [-0.100, -0.112],
          [-0.082, -0.024], [-0.102, -0.010], [-0.075, -0.008]
        ], 0.030, null, true);
        const frame = new THREE.Mesh(frameGeo, m.darkMat);

        const slideMain = new THREE.Mesh(geoRoundedBox(0.034, 0.025, slideLen, 0.0045, 0.0018), m.steelMat);
        const slideTop = new THREE.Mesh(geoRoundedBox(0.028, 0.009, slideLen - 0.004, 0.0038, 0.0012), m.steelMat);
        slideTop.position.set(0, 0.014, 0);
        const ejPort = new THREE.Mesh(geoRoundedBox(0.006, 0.012, 0.044, 0.002, 0.0005), m.bluedMat);
        ejPort.position.set(0.016, 0.005, -0.012);
        const hood = new THREE.Mesh(geoRoundedBox(0.024, 0.009, 0.036, 0.003, 0.0008), m.magMat);
        hood.position.set(0, 0.014, -0.015);
        slideGroup.add(slideMain, slideTop, ejPort, hood);

        const serGeo = _cachedGeo('g17_ser', () => new THREE.BoxGeometry(0.0358, 0.017, 0.0024));
        for (let s = 0; s < 5; s++) {
          const rib = new THREE.Mesh(serGeo, m.darkMat);
          rib.position.set(0, 0, 0.072 + s * 0.008);
          slideGroup.add(rib);
        }
        for (let s = 0; s < 3; s++) {
          const fRib = new THREE.Mesh(serGeo, m.darkMat);
          fRib.scale.set(0.99, 0.88, 0.92);
          fRib.position.set(0, 0, -0.095 + s * 0.008);
          slideGroup.add(fRib);
        }

        const slideStop = new THREE.Mesh(geoRoundedBox(0.004, 0.006, 0.022, 0.001, 0.0004), m.magMat);
        slideStop.position.set(-0.0165, -0.009, 0.036);
        slideGroup.position.set(0, 0.006, 0);

        // Lathe-contoured 9x19mm pistol barrel + dark bore
        const barrelMesh = new THREE.Mesh(
          geoLatheZ('g17_bbl', [[-0.02, 0.0075], [0.10, 0.0075], [0.12, 0.0082], [0.126, 0.0082], [0.126, 0.0045]]),
          m.magMat
        );
        barrelMesh.position.set(0, 0.008, -0.005);
        const bore = new THREE.Mesh(_cachedGeo('g17_bore', () => {
          const c = new THREE.CylinderGeometry(0.0045, 0.0045, 0.014, 10);
          c.rotateX(Math.PI / 2);
          return c;
        }), m.boreMat);
        bore.position.set(0, 0.008, -0.128);

        const railSlot = new THREE.Mesh(geoPicatinnyRail(-0.024, -0.09, -0.055, 0.028, 0.010), m.bluedMat);

        const chamberRd = createCartridgeMesh('pistol', m);
        chamberRd.position.set(0.003, 0.008, -0.012);
        out.chamberRoundMesh = chamberRd;

        out.triggerMesh = _addTriggerAndPins(g, m, 0.018, -0.024, 0.0155, [[-0.013, 0.012], [-0.014, 0.068]]);

        const pistolMag = new THREE.Group();
        const magBody = new THREE.Mesh(geoRoundedBox(0.023, 0.105, 0.033, 0.003, 0.001), m.darkMat);
        const magPlate = new THREE.Mesh(geoRoundedBox(0.031, 0.013, 0.045, 0.0035, 0.0012), m.steelMat);
        magPlate.position.set(0, -0.056, 0);
        const topRd = createCartridgeMesh('pistol', m);
        topRd.position.set(0, 0.055, 0.002);
        pistolMag.add(magBody, magPlate, topRd);
        pistolMag.position.set(0, -0.082, 0.075);
        pistolMag.rotation.x = 0.24;

        out.magMesh = pistolMag;
        out.spareMagMesh = pistolMag.clone();
        out.spareMagMesh.visible = false;
        out.boltMesh = slideGroup;
        out.ironSightTarget = slideGroup;
        out.ironSightOpts = { rearZ: slideLen / 2 - 0.016, frontZ: -slideLen / 2 + 0.014, baseY: 0.019 };
        out.rightHandPos.set(0.0, -0.056, 0.072);
        out.leftHandPos.set(-0.004, -0.064, 0.068);
        out.leftHandStyle = 'supportPistol';
        out.sightHeight = 0.030;
        out.adsZ = -0.32;
        out.muzzlePos.set(0, 0.01, -slideLen / 2 - 0.03);
        out.flashPos.set(0, 0.02, -slideLen / 2 - 0.06);

        g.add(frame, slideStop, railSlot, barrelMesh, bore, chamberRd, slideGroup, pistolMag, out.spareMagMesh);
      } else {
        // PM-9 Makarov
        const frame = new THREE.Mesh(geoRoundedBox(0.026, 0.018, 0.175, 0.004, 0.0015), m.bluedMat);
        frame.position.set(0, -0.015, 0.008);
        const grip = new THREE.Mesh(geoCurvedGrip(0.029, 0.108, 0.044), m.bakeliteMat);
        grip.position.set(0, -0.066, 0.072);
        grip.rotation.x = 0.24;
        const backstrap = new THREE.Mesh(geoRoundedBox(0.020, 0.100, 0.012, 0.004, 0.001), m.bluedMat);
        backstrap.position.set(0, -0.062, 0.092);
        backstrap.rotation.x = 0.24;

        const slideLower = new THREE.Mesh(geoRoundedBox(0.030, 0.020, slideLen, 0.004, 0.0015), m.bluedMat);
        const slideCrown = new THREE.Mesh(_cachedGeo('pm9_crown', () => {
          const c = new THREE.CylinderGeometry(0.0148, 0.0148, slideLen - 0.004, 14);
          c.rotateX(Math.PI / 2);
          return c;
        }), m.bluedMat);
        slideCrown.position.set(0, 0.008, 0);
        const ejPort = new THREE.Mesh(geoRoundedBox(0.004, 0.011, 0.038, 0.002, 0.0005), m.steelMat);
        ejPort.position.set(0.014, 0.005, -0.008);
        const safetyLever = new THREE.Mesh(geoRoundedBox(0.006, 0.010, 0.024, 0.002, 0.0006), m.steelMat);
        safetyLever.position.set(-0.017, 0.004, 0.075);
        const hammer = new THREE.Mesh(geoRoundedBox(0.008, 0.014, 0.016, 0.003, 0.0008), m.magMat);
        hammer.position.set(0, 0.002, slideLen / 2 + 0.004);
        hammer.rotation.x = 0.35;
        slideGroup.add(slideLower, slideCrown, ejPort, safetyLever, hammer);

        const pmSerGeo = _cachedGeo('pm9_ser', () => new THREE.BoxGeometry(0.0316, 0.015, 0.0022));
        for (let s = 0; s < 5; s++) {
          const pmRib = new THREE.Mesh(pmSerGeo, m.darkMat);
          pmRib.position.set(0, 0, 0.056 + s * 0.007);
          slideGroup.add(pmRib);
        }
        slideGroup.position.set(0, 0.006, 0);

        const barrelMesh = new THREE.Mesh(
          geoLatheZ('pm9_bbl', [[-0.01, 0.0070], [0.09, 0.0070], [0.108, 0.0072], [0.108, 0.004]]),
          m.magMat
        );
        barrelMesh.position.set(0, 0.008, -0.005);

        const chamberRd = createCartridgeMesh('pistol', m);
        chamberRd.position.set(0.003, 0.008, -0.010);
        out.chamberRoundMesh = chamberRd;

        out.triggerMesh = _addTriggerAndPins(g, m, 0.016, -0.022, 0.014, null);

        const pistolMag = new THREE.Group();
        const magBody = new THREE.Mesh(geoRoundedBox(0.020, 0.102, 0.030, 0.003, 0.0008), m.magMat);
        const magPlate = new THREE.Mesh(geoRoundedBox(0.026, 0.010, 0.040, 0.003, 0.001), m.bluedMat);
        magPlate.position.set(0, -0.054, 0);
        const topRd = createCartridgeMesh('pistol', m);
        topRd.position.set(0, 0.054, 0.001);
        pistolMag.add(magBody, magPlate, topRd);
        pistolMag.position.set(0, -0.082, 0.075);
        pistolMag.rotation.x = 0.24;

        out.magMesh = pistolMag;
        out.spareMagMesh = pistolMag.clone();
        out.spareMagMesh.visible = false;
        out.boltMesh = slideGroup;
        out.ironSightTarget = slideGroup;
        out.ironSightOpts = { rearZ: slideLen / 2 - 0.016, frontZ: -slideLen / 2 + 0.014, baseY: 0.019 };
        out.rightHandPos.set(0.0, -0.056, 0.072);
        out.leftHandPos.set(-0.004, -0.064, 0.068);
        out.leftHandStyle = 'supportPistol';
        out.sightHeight = 0.030;
        out.adsZ = -0.32;
        out.muzzlePos.set(0, 0.01, -slideLen / 2 - 0.03);
        out.flashPos.set(0, 0.02, -slideLen / 2 - 0.06);

        g.add(frame, grip, backstrap, barrelMesh, chamberRd, slideGroup, pistolMag, out.spareMagMesh);
      }
      return out;
    }

    if (id === 'mp5k') {
      const upper = new THREE.Mesh(geoRoundedBox(0.038, 0.034, 0.31, 0.0055, 0.0018), m.steelMat);
      upper.position.set(0, 0.007, 0.025);
      const upperTop = new THREE.Mesh(_cachedGeo('mp5_top', () => {
        const c = new THREE.CylinderGeometry(0.0168, 0.0168, 0.31, 14);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.steelMat);
      upperTop.position.set(0, 0.020, 0.025);
      const fluteL = new THREE.Mesh(geoRoundedBox(0.005, 0.008, 0.29, 0.002, 0.0006), m.bluedMat);
      fluteL.position.set(-0.020, 0.002, 0.03);
      const fluteR = fluteL.clone();
      fluteR.position.x = 0.020;

      // Ejection port recess + sliding chrome bolt carrier behind it
      const ejPort = new THREE.Mesh(geoRoundedBox(0.004, 0.015, 0.056, 0.002, 0.0005), m.boreMat);
      ejPort.position.set(0.0182, 0.010, -0.01);
      const boltCarrier = new THREE.Mesh(geoRoundedBox(0.010, 0.013, 0.054, 0.002, 0.0005), m.chromeMat);
      boltCarrier.position.set(0.014, 0.010, -0.01);
      out.boltCarrierMesh = boltCarrier;

      const cockingTube = new THREE.Mesh(_cachedGeo('mp5_cock', () => {
        const c = new THREE.CylinderGeometry(0.0138, 0.0138, 0.25, 14);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.steelMat);
      cockingTube.position.set(0, 0.022, -0.175);
      const tripleFrame = new THREE.Mesh(geoRoundedBox(0.032, 0.044, 0.020, 0.004, 0.0012), m.bluedMat);
      tripleFrame.position.set(0, 0.012, -0.295);

      // Lathe-turned cold-hammer-forged MP5 barrel + tri-lug adapter
      const barrel = new THREE.Mesh(
        geoLatheZ('mp5_bbl', [
          [0.06, 0.0105], [0.31, 0.0095], [0.335, 0.0126], [0.352, 0.0126],
          [0.355, 0.0092], [0.365, 0.0092], [0.365, 0.0045]
        ]),
        m.bluedMat
      );
      barrel.position.set(0, 0.001, 0.0);
      barrel.renderOrder = -20;

      const hgGeo = geoExtrudeSide('mp5_hg', [
        [0.09, -0.002], [0.275, -0.002], [0.265, -0.024], [0.165, -0.040], [0.09, -0.036]
      ], 0.044, null, true);
      const handguard = new THREE.Mesh(hgGeo, m.darkMat);
      const hgPin = new THREE.Mesh(_cachedGeo('mp5_pin', () => {
        const c = new THREE.CylinderGeometry(0.004, 0.004, 0.048, 10);
        c.rotateZ(Math.PI / 2);
        return c;
      }), m.magMat);
      hgPin.position.set(0, 0.004, -0.255);

      const lower = new THREE.Mesh(geoRoundedBox(0.035, 0.026, 0.175, 0.005, 0.0015), m.darkMat);
      lower.position.set(0, -0.019, 0.085);
      const magWell = new THREE.Mesh(geoRoundedBox(0.038, 0.044, 0.056, 0.0045, 0.0015), m.steelMat);
      magWell.position.set(0, -0.026, -0.045);
      const paddleRel = new THREE.Mesh(geoRoundedBox(0.014, 0.022, 0.010, 0.0025, 0.0008), m.bluedMat);
      paddleRel.position.set(0, -0.048, -0.012);
      const selector = new THREE.Mesh(geoRoundedBox(0.006, 0.012, 0.026, 0.002, 0.0006), m.magMat);
      selector.position.set(-0.020, -0.020, 0.115);
      selector.rotation.x = 0.25;

      const grip = new THREE.Mesh(geoCurvedGrip(0.029, 0.098, 0.042), m.darkMat);
      grip.position.set(0, -0.072, 0.132);
      grip.rotation.x = 0.28;
      const endCap = new THREE.Mesh(geoRoundedBox(0.042, 0.050, 0.028, 0.006, 0.0018), m.darkMat);
      endCap.position.set(0, 0.002, 0.182);

      if (!mods.stock || mods.stock === 'none') {
        const stRailL = new THREE.Mesh(geoRoundedBox(0.006, 0.009, 0.22, 0.002, 0.0006), m.magMat);
        stRailL.position.set(-0.019, 0.002, 0.285);
        const stRailR = stRailL.clone();
        stRailR.position.x = 0.019;
        const stPad = new THREE.Mesh(geoRoundedBox(0.038, 0.105, 0.026, 0.007, 0.0022), m.darkMat);
        stPad.position.set(0, -0.022, 0.395);
        g.add(stRailL, stRailR, stPad);
      }

      const topRail = new THREE.Mesh(geoPicatinnyRail(0.036, -0.075, 0.085, 0.018, 0.014), m.bluedMat);
      out.triggerMesh = _addTriggerAndPins(g, m, 0.072, -0.038, 0.0195, [[-0.016, 0.168], [-0.016, 0.012], [-0.021, -0.042]]);

      const mag = new THREE.Group();
      const mp5MagGeo = _cachedGeo('mp5_mag', () => {
        const magShape = new THREE.Shape();
        magShape.moveTo(-0.018, 0.062);
        magShape.lineTo(0.018, 0.062);
        magShape.bezierCurveTo(0.024, 0.00, 0.040, -0.062, 0.058, -0.125);
        magShape.lineTo(0.022, -0.134);
        magShape.bezierCurveTo(0.004, -0.070, -0.012, -0.008, -0.018, 0.062);
        const geo = new THREE.ExtrudeGeometry(magShape, { depth: 0.023, bevelEnabled: true, bevelThickness: 0.0018, bevelSize: 0.0016, bevelSegments: 2, curveSegments: 12 });
        geo.translate(0, 0, -0.0115);
        geo.rotateY(Math.PI / 2);
        return geo;
      });
      const mp5MagBody = new THREE.Mesh(mp5MagGeo, m.magMat);
      const magFloor = new THREE.Mesh(geoRoundedBox(0.028, 0.009, 0.042, 0.003, 0.001), m.bluedMat);
      magFloor.position.set(0, -0.130, -0.040);
      magFloor.rotation.x = -0.26;
      const topRd = createCartridgeMesh('pistol', m);
      topRd.position.set(0, 0.065, 0);
      mag.add(mp5MagBody, magFloor, topRd);
      mag.position.set(0, -0.096, -0.045);
      mag.rotation.x = -0.06;

      const boltHandle = new THREE.Group();
      const chStem = new THREE.Mesh(geoRoundedBox(0.026, 0.010, 0.012, 0.003, 0.0008), m.magMat);
      const chKnob = new THREE.Mesh(_cachedGeo('mp5_knob', () => {
        const c = new THREE.CylinderGeometry(0.008, 0.009, 0.026, 12);
        c.rotateZ(Math.PI / 2);
        return c;
      }), m.darkMat);
      chKnob.position.set(-0.016, 0.006, 0);
      boltHandle.add(chStem, chKnob);
      boltHandle.position.set(-0.022, 0.024, -0.21);

      const chamberRd = createCartridgeMesh('pistol', m);
      chamberRd.position.set(0.004, 0.009, -0.012);
      out.chamberRoundMesh = chamberRd;

      out.magMesh = mag;
      out.spareMagMesh = mag.clone();
      out.spareMagMesh.visible = false;
      out.boltMesh = boltHandle;
      out.rightHandPos.set(0.0, -0.064, 0.132);
      out.leftHandPos.set(0.0, -0.026, -0.185);
      out.sightHeight = 0.044;
      out.adsZ = -0.25;
      out.muzzlePos.set(0, 0.001, -0.365);
      out.flashPos.set(0, 0.01, -0.40);

      g.add(
        upper, upperTop, fluteL, fluteR, ejPort, boltCarrier, chamberRd,
        cockingTube, tripleFrame, barrel,
        handguard, hgPin,
        lower, magWell, paddleRel, selector, grip, endCap, topRail,
        mag, out.spareMagMesh, boltHandle
      );
      return out;
    }

    if (id === 'ak47') {
      // AK-47 Type 3 (milled, 880mm OAL): slant muzzle brake, 45-degree gas block,
      // slab-side steel 30rd mag, laminated wood furniture, smooth top cover, tangent leaf.
      const receiver = new THREE.Mesh(geoRoundedBox(0.044, 0.050, 0.35, 0.005, 0.0018), m.steelMat);
      receiver.position.set(0, -0.003, 0.04);
      // Milled Type 3 lightening cuts (replace stamped-receiver dimples)
      const cutL = new THREE.Mesh(geoRoundedBox(0.002, 0.016, 0.110, 0.001, 0.0004), m.darkMat);
      cutL.position.set(-0.0225, -0.004, 0.030);
      const cutR = cutL.clone();
      cutR.position.x = 0.0225;
      const safety = new THREE.Mesh(geoRoundedBox(0.004, 0.016, 0.145, 0.002, 0.0006), m.bluedMat);
      safety.position.set(0.0235, -0.003, 0.065);
      safety.rotation.x = 0.06;

      // Smooth Type 3 top cover (no ribs)
      const dustCover = new THREE.Mesh(geoRoundedBox(0.036, 0.019, 0.29, 0.008, 0.0018), m.bluedMat);
      dustCover.position.set(0, 0.027, 0.075);
      const rsBlock = new THREE.Mesh(geoRoundedBox(0.040, 0.024, 0.055, 0.004, 0.0014), m.steelMat);
      rsBlock.position.set(0, 0.024, -0.085);

      // Lathe-turned AK-47 stepped barrel, 415mm: chamber swell, gas journal, muzzle threads + brake body
      const barrel = new THREE.Mesh(
        geoLatheZ('ak47_bbl', [
          [0.10, 0.0112], [0.28, 0.0098], [0.30, 0.0128], [0.33, 0.0128],
          [0.33, 0.0094], [0.375, 0.0090], [0.375, 0.0108], [0.415, 0.0108], [0.415, 0.0035]
        ]),
        m.bluedMat
      );
      barrel.position.set(0, 0.002, 0);
      // Slant-cut compensator face + top vent (signature AK-47 muzzle)
      const slantFace = new THREE.Mesh(_cachedGeo('ak47_slant', () => {
        const c = new THREE.CylinderGeometry(0.0108, 0.0108, 0.004, 16);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.bluedMat);
      slantFace.position.set(0, 0.0045, -0.415);
      slantFace.rotation.x = 0.42;
      const slantPort = new THREE.Mesh(geoRoundedBox(0.008, 0.004, 0.020, 0.001, 0.0004), m.boreMat);
      slantPort.position.set(0, 0.0135, -0.408);
      slantPort.rotation.x = 0.42;
      const cleaningRod = new THREE.Mesh(_cachedGeo('ak47_rod', () => {
        const c = new THREE.CylinderGeometry(0.003, 0.003, 0.24, 8);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.magMat);
      cleaningRod.position.set(0, -0.011, -0.29);

      const gasTube = new THREE.Mesh(_cachedGeo('ak_gastube', () => {
        const c = new THREE.CylinderGeometry(0.0105, 0.0105, 0.22, 12);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.steelMat);
      gasTube.position.set(0, 0.023, -0.22);
      // 45-degree AK-47 gas block (vs 90-degree AK-74 block)
      const gasBlock = new THREE.Mesh(geoRoundedBox(0.022, 0.036, 0.036, 0.004, 0.0012), m.bluedMat);
      gasBlock.position.set(0, 0.014, -0.315);
      gasBlock.rotation.x = -0.55;
      const fsbBase = new THREE.Mesh(geoRoundedBox(0.020, 0.040, 0.032, 0.0035, 0.0012), m.bluedMat);
      fsbBase.position.set(0, 0.018, -0.355);
      // Bayonet lug under the front sight block
      const bayoLug = new THREE.Mesh(geoRoundedBox(0.008, 0.010, 0.030, 0.002, 0.0006), m.bluedMat);
      bayoLug.position.set(0, -0.006, -0.365);

      const hgLower = new THREE.Mesh(geoRoundedBox(0.044, 0.034, 0.195, 0.010, 0.0022), m.woodMat);
      hgLower.position.set(0, -0.009, -0.215);
      const hgUpper = new THREE.Mesh(_cachedGeo('ak_hgup', () => {
        const c = new THREE.CylinderGeometry(0.0165, 0.0165, 0.185, 14);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.woodMat);
      hgUpper.position.set(0, 0.023, -0.215);
      const hgFerrule = new THREE.Mesh(geoRoundedBox(0.046, 0.044, 0.014, 0.005, 0.0012), m.bluedMat);
      hgFerrule.position.set(0, 0.004, -0.310);

      const grip = new THREE.Mesh(geoCurvedGrip(0.029, 0.10, 0.043), m.woodMat);
      grip.position.set(0, -0.075, 0.14);
      grip.rotation.x = 0.26;
      const magPaddle = new THREE.Mesh(geoRoundedBox(0.014, 0.020, 0.012, 0.0025, 0.0008), m.bluedMat);
      magPaddle.position.set(0, -0.034, 0.008);

      out.triggerMesh = _addTriggerAndPins(g, m, 0.08, -0.032, 0.0225, [[-0.014, 0.045], [-0.014, 0.088], [0.006, -0.085], [-0.010, -0.095]]);

      if (!mods.stock || mods.stock === 'none') {
        const woodButt = new THREE.Mesh(geoExtrudeSide('ak47_stock', [
          [-0.0, 0.022], [-0.245, -0.012], [-0.245, -0.108], [-0.055, -0.052], [-0.0, -0.024]
        ], 0.034, null, true), m.woodMat);
        woodButt.position.set(0, -0.002, 0.215);
        const buttPlate = new THREE.Mesh(geoRoundedBox(0.038, 0.100, 0.012, 0.005, 0.0015), m.bluedMat);
        buttPlate.position.set(0, -0.062, 0.465);
        const tang = new THREE.Mesh(geoRoundedBox(0.034, 0.010, 0.044, 0.003, 0.001), m.steelMat);
        tang.position.set(0, 0.020, 0.233);
        g.add(woodButt, buttPlate, tang);
      }

      const isExt = mods.magazine === 'ext_mag';
      const magGrp = new THREE.Group();
      const magDepth = 0.027;
      const magH = isExt ? 0.245 : 0.182;
      const curveFwd = isExt ? 0.135 : 0.095;
      const magThick = 0.052;
      const tipAngle = isExt ? 0.48 : 0.42;
      const rearEndX = magThick * 0.42 + curveFwd - Math.cos(tipAngle) * magThick;
      const rearEndY = 0.048 - magH - Math.sin(tipAngle) * magThick;
      const magGeo = _cachedGeo(`ak47_mag_${isExt ? 'ext' : 'std'}`, () => {
        const shape = new THREE.Shape();
        shape.moveTo(-magThick * 0.5, 0.048);
        shape.lineTo(magThick * 0.5, 0.048);
        shape.bezierCurveTo(
          magThick * 0.5 + curveFwd * 0.14, 0.048 - magH * 0.34,
          magThick * 0.5 + curveFwd * 0.56, 0.048 - magH * 0.72,
          magThick * 0.42 + curveFwd, 0.048 - magH
        );
        shape.lineTo(rearEndX, rearEndY);
        shape.bezierCurveTo(
          -magThick * 0.5 + curveFwd * 0.44, 0.048 - magH * 0.68,
          -magThick * 0.5 + curveFwd * 0.08, 0.048 - magH * 0.32,
          -magThick * 0.5, 0.048
        );
        const geo = new THREE.ExtrudeGeometry(shape, { depth: magDepth, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0018, bevelSegments: 1, curveSegments: 10 });
        geo.translate(0, 0, -magDepth * 0.5);
        geo.rotateY(Math.PI / 2);
        return geo;
      });
      const magBody = new THREE.Mesh(magGeo, m.bluedMat);
      // Slab-side stiffening rib on the steel magazine
      const magRib = new THREE.Mesh(geoRoundedBox(0.006, magH * 0.55, 0.010, 0.002, 0.0006), m.magMat);
      magRib.position.set(0, 0.048 - magH * 0.52, -(magThick * 0.30 + curveFwd * 0.55));
      magRib.rotation.x = -tipAngle * 0.55;
      const basePlate = new THREE.Mesh(geoRoundedBox(magDepth + 0.006, 0.009, magThick + 0.006, 0.002, 0.0006), m.bluedMat);
      basePlate.position.set(0, (0.048 - magH + rearEndY) * 0.5 - 0.003, -((magThick * 0.42 + curveFwd + rearEndX) * 0.5));
      basePlate.rotation.x = -tipAngle;
      const topRd = createCartridgeMesh('x39', m);
      topRd.position.set(0, 0.052, 0);
      magGrp.add(magBody, magRib, basePlate, topRd);
      magGrp.position.set(0, -0.048, -0.042);

      const boltHandle = new THREE.Group();
      const carrier = new THREE.Mesh(geoRoundedBox(0.006, 0.014, 0.052, 0.002, 0.0005), m.magMat);
      const hookKnob = new THREE.Mesh(geoRoundedBox(0.026, 0.010, 0.012, 0.0025, 0.0006), m.chromeMat);
      hookKnob.position.set(0.012, 0.0, 0.012);
      boltHandle.add(carrier, hookKnob);
      boltHandle.position.set(0.022, 0.014, -0.02);

      const ejSlot = new THREE.Mesh(geoRoundedBox(0.004, 0.013, 0.068, 0.002, 0.0004), m.boreMat);
      ejSlot.position.set(0.0212, 0.013, -0.018);

      const chamberRd = createCartridgeMesh('x39', m);
      chamberRd.position.set(0.010, 0.013, -0.026);
      out.chamberRoundMesh = chamberRd;

      out.magMesh = magGrp;
      out.spareMagMesh = magGrp.clone();
      out.spareMagMesh.visible = false;
      out.boltMesh = boltHandle;
      out.rightHandPos.set(0.0, -0.068, 0.142);
      out.rightHandRot.set(0.24, 0, 0);
      out.leftHandPos.set(0.0, -0.022, -0.22);
      out.sightHeight = 0.044;
      out.adsZ = -0.26;
      out.muzzlePos.set(0, 0.004, -0.415);
      out.flashPos.set(0, 0.01, -0.455);

      [barrel, slantFace, gasBlock, fsbBase, bayoLug].forEach((mm) => { mm.renderOrder = -20; });
      g.add(
        receiver, cutL, cutR, safety, dustCover, rsBlock, ejSlot, chamberRd,
        barrel, slantFace, slantPort, cleaningRod, gasTube, gasBlock, fsbBase, bayoLug,
        hgLower, hgUpper, hgFerrule, grip, magPaddle,
        magGrp, out.spareMagMesh, boltHandle
      );
      return out;
    }
    if (id === 'm870') {
      const receiver = new THREE.Mesh(geoRoundedBox(0.046, 0.056, 0.28, 0.011, 0.0022), m.steelMat);
      receiver.position.set(0, 0.0, 0.04);
      const ejectionRecess = new THREE.Mesh(geoRoundedBox(0.005, 0.020, 0.072, 0.003, 0.0005), m.boreMat);
      ejectionRecess.position.set(0.0222, 0.009, -0.01);
      const breechBolt = new THREE.Mesh(geoRoundedBox(0.008, 0.018, 0.068, 0.0025, 0.0006), m.chromeMat);
      breechBolt.position.set(0.0185, 0.009, -0.01);
      out.boltCarrierMesh = breechBolt;

      const barrel = new THREE.Mesh(
        geoLatheZ('m870_bbl', [[0.08, 0.0155], [0.22, 0.0145], [0.59, 0.0138], [0.60, 0.0144], [0.60, 0.0088]]),
        m.bluedMat
      );
      barrel.position.set(0, 0.014, 0);
      const magTube = new THREE.Mesh(_cachedGeo('m870_tube', () => {
        const c = new THREE.CylinderGeometry(0.0128, 0.0128, 0.46, 14);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.steelMat);
      magTube.position.set(0, -0.016, -0.31);
      const bblClamp = new THREE.Mesh(geoRoundedBox(0.026, 0.048, 0.022, 0.005, 0.0014), m.bluedMat);
      bblClamp.position.set(0, -0.001, -0.49);

      const pump = new THREE.Group();
      const pumpCore = new THREE.Mesh(_cachedGeo('m870_pump', () => {
        const c = new THREE.CylinderGeometry(0.022, 0.023, 0.18, 14);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.woodMat);
      pump.add(pumpCore);
      const ringGeo = _cachedGeo('m870_pring', () => {
        const c = new THREE.CylinderGeometry(0.0245, 0.0245, 0.012, 14);
        c.rotateX(Math.PI / 2);
        return c;
      });
      for (let r = -2; r <= 2; r++) {
        const ring = new THREE.Mesh(ringGeo, m.bluedMat);
        ring.position.set(0, 0, r * 0.032);
        pump.add(ring);
      }
      const actionBarL = new THREE.Mesh(geoRoundedBox(0.004, 0.007, 0.16, 0.0015, 0.0004), m.magMat);
      actionBarL.position.set(-0.021, 0.002, 0.14);
      const actionBarR = actionBarL.clone();
      actionBarR.position.x = 0.021;
      pump.add(actionBarL, actionBarR);
      pump.position.set(0, -0.016, -0.24);

      const stockBody = new THREE.Mesh(geoExtrudeSide('m870_stock', [
        [-0.14, -0.002], [-0.14, -0.032], [-0.175, -0.060], [-0.215, -0.062],
        [-0.465, -0.098], [-0.465, 0.004], [-0.24, -0.006]
      ], 0.038, null, true), m.woodMat);
      const stockPad = new THREE.Mesh(geoRoundedBox(0.040, 0.104, 0.020, 0.007, 0.0022), m.darkMat);
      stockPad.position.set(0, -0.047, 0.475);

      const topRail = new THREE.Mesh(geoPicatinnyRail(0.030, -0.055, 0.095, 0.018, 0.014), m.bluedMat);
      out.triggerMesh = _addTriggerAndPins(g, m, 0.08, -0.028, 0.0235, [[-0.012, 0.042], [-0.012, 0.095]]);

      const shell = new THREE.Group();
      const shellHull = new THREE.Mesh(_cachedGeo('m870_sh', () => new THREE.CylinderGeometry(0.0095, 0.0095, 0.058, 12)), m.shellRedMat);
      const shellBrass = new THREE.Mesh(_cachedGeo('m870_sb', () => new THREE.CylinderGeometry(0.010, 0.010, 0.016, 12)), m.brassMat);
      shellBrass.position.set(0, -0.028, 0);
      shell.add(shellHull, shellBrass);
      shell.rotation.x = -Math.PI / 2;
      shell.position.set(0, -0.020, -0.02);

      const chamberRd = createCartridgeMesh('12g', m);
      chamberRd.position.set(0.008, 0.009, -0.012);
      out.chamberRoundMesh = chamberRd;

      out.magMesh = shell;
      out.boltMesh = pump;
      out.rightHandPos.set(0.004, -0.048, 0.168);
      out.rightHandRot.set(0.22, -0.04, 0.06);
      out.rightHandStyle = 'shotgunGrip';
      out.leftHandPos.set(0.0, -0.032, -0.24);
      out.sightHeight = 0.042;
      out.adsZ = -0.26;
      out.muzzlePos.set(0, 0.014, -0.61);
      out.flashPos.set(0, 0.02, -0.65);

      [barrel, magTube, bblClamp].forEach((mm) => { mm.renderOrder = -20; });
      g.add(receiver, ejectionRecess, breechBolt, chamberRd, barrel, magTube, bblClamp, pump, stockBody, stockPad, topRail, shell);
      return out;
    }

    if (id === 'mosin9130') {
      const stockBody = new THREE.Mesh(geoExtrudeSide('mosin_stock', [
        [0.42, -0.002], [0.42, -0.024], [0.08, -0.034], [-0.08, -0.034],
        [-0.18, -0.056], [-0.415, -0.092], [-0.415, -0.002], [-0.21, -0.010],
        [-0.08, 0.004], [0.06, 0.006]
      ], 0.039, null, true), m.woodMat);
      const upperHandguard = new THREE.Mesh(geoRoundedBox(0.034, 0.018, 0.36, 0.007, 0.0018), m.woodMat);
      upperHandguard.position.set(0, 0.016, -0.22);
      const buttPlate = new THREE.Mesh(geoRoundedBox(0.040, 0.092, 0.010, 0.005, 0.0014), m.bluedMat);
      buttPlate.position.set(0, -0.047, 0.420);

      const bandRear = new THREE.Mesh(geoRoundedBox(0.044, 0.046, 0.016, 0.008, 0.0014), m.bluedMat);
      bandRear.position.set(0, 0.002, -0.18);
      const bandFront = new THREE.Mesh(geoRoundedBox(0.043, 0.044, 0.016, 0.008, 0.0014), m.bluedMat);
      bandFront.position.set(0, 0.002, -0.37);
      const cleaningRod = new THREE.Mesh(_cachedGeo('mosin_rod', () => {
        const c = new THREE.CylinderGeometry(0.003, 0.003, 0.44, 8);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.magMat);
      cleaningRod.position.set(0, -0.002, -0.44);

      const receiver = new THREE.Mesh(_cachedGeo('mosin_rec', () => {
        const c = new THREE.CylinderGeometry(0.020, 0.020, 0.22, 8);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.bluedMat);
      receiver.position.set(0, 0.016, 0.02);
      const barrel = new THREE.Mesh(
        geoLatheZ('mosin_bbl', [[0.06, 0.013], [0.65, 0.0095], [0.66, 0.0095], [0.66, 0.004]]),
        m.bluedMat
      );
      barrel.position.set(0, 0.016, 0);
      const internalMag = new THREE.Mesh(geoRoundedBox(0.026, 0.034, 0.095, 0.004, 0.0014), m.bluedMat);
      internalMag.position.set(0, -0.044, -0.01);
      out.triggerMesh = _addTriggerAndPins(g, m, 0.08, -0.034, 0.020, null);

      const boltGroup = new THREE.Group();
      const boltBody = new THREE.Mesh(_cachedGeo('mosin_bb', () => {
        const c = new THREE.CylinderGeometry(0.010, 0.010, 0.10, 12);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.chromeMat);
      boltBody.position.set(-0.022, 0, 0);
      const boltStem = new THREE.Mesh(geoRoundedBox(0.034, 0.008, 0.009, 0.0025, 0.0006), m.chromeMat);
      const boltKnob = new THREE.Mesh(_cachedGeo('mosin_bk', () => new THREE.SphereGeometry(0.011, 10, 8)), m.chromeMat);
      boltKnob.position.set(0.022, 0, 0);
      boltGroup.add(boltBody, boltStem, boltKnob);
      boltGroup.position.set(0.022, 0.018, 0.03);

      const clipGroup = new THREE.Group();
      const clipRail = new THREE.Mesh(geoRoundedBox(0.018, 0.010, 0.068, 0.002, 0.0006), m.steelMat);
      clipRail.position.set(0, 0.028, 0);
      clipGroup.add(clipRail);
      for (let c = 0; c < 5; c++) {
        const rd = createCartridgeMesh('rifle', m);
        rd.position.set(0, 0.020 - c * 0.009, 0.008);
        clipGroup.add(rd);
      }
      clipGroup.position.set(0, 0.032, 0);
      clipGroup.visible = false;
      clipGroup.userData.isStripperClip = true;

      const chamberRd = createCartridgeMesh('rifle', m);
      chamberRd.position.set(0, 0.018, -0.015);
      out.chamberRoundMesh = chamberRd;

      out.magMesh = clipGroup;
      out.boltMesh = boltGroup;
      out.rightHandPos.set(0.0, -0.048, 0.148);
      out.leftHandPos.set(0.0, -0.026, -0.22);
      out.sightHeight = 0.040;
      out.adsZ = -0.24;
      out.muzzlePos.set(0, 0.016, -0.66);
      out.flashPos.set(0, 0.02, -0.70);

      [barrel, cleaningRod, bandFront].forEach((mm) => { mm.renderOrder = -20; });
      g.add(
        stockBody, upperHandguard, buttPlate,
        bandRear, bandFront, cleaningRod, receiver, barrel, internalMag,
        chamberRd, boltGroup, clipGroup
      );
      return out;
    }

    if (id === 'awm338') {
      const hasStockMod = !!(mods.stock && mods.stock !== 'none');
      const chassisPts = hasStockMod
        ? [[0.30, 0.016], [0.30, -0.038], [-0.14, -0.038], [-0.15, -0.105], [-0.19, -0.102], [-0.18, 0.008]]
        : [
            [0.30, 0.016], [0.30, -0.036], [-0.12, -0.036], [-0.14, -0.106],
            [-0.185, -0.104], [-0.365, -0.102], [-0.365, 0.012], [-0.18, 0.010]
          ];
      const thumbHole = hasStockMod ? null : [[[-0.20, -0.018], [-0.29, -0.018], [-0.29, -0.072], [-0.20, -0.072]]];
      const chassis = new THREE.Mesh(geoExtrudeSide(`awm_ch_${hasStockMod ? 1 : 0}`, chassisPts, 0.044, thumbHole, true), m.chassisMat);

      const receiver = new THREE.Mesh(geoRoundedBox(0.042, 0.042, 0.26, 0.007, 0.002), m.bluedMat);
      receiver.position.set(0, 0.018, 0.04);
      const topRail = new THREE.Mesh(geoRoundedBox(0.024, 0.008, 0.24, 0.002, 0.0008), m.steelMat);
      topRail.position.set(0, 0.041, 0.02);
      const railTeeth = new THREE.Mesh(geoPicatinnyRail(0.0465, -0.092, 0.132, 0.023, 0.013), m.darkMat);

      if (!hasStockMod) {
        const cheekRest = new THREE.Mesh(geoRoundedBox(0.042, 0.024, 0.12, 0.008, 0.002), m.darkMat);
        cheekRest.position.set(0, 0.022, 0.27);
        const buttPad = new THREE.Mesh(geoRoundedBox(0.044, 0.114, 0.022, 0.007, 0.0022), m.darkMat);
        buttPad.position.set(0, -0.044, 0.372);
        g.add(cheekRest, buttPad);
      }

      const barrel = new THREE.Mesh(
        geoLatheZ('awm_bbl', [[0.08, 0.0165], [0.22, 0.0155], [0.68, 0.013], [0.68, 0.005]]),
        m.bluedMat
      );
      barrel.position.set(0, 0.018, 0);
      const muzzleBrake = new THREE.Mesh(geoRoundedBox(0.032, 0.026, 0.068, 0.0045, 0.0014), m.steelMat);
      muzzleBrake.position.set(0, 0.018, -0.71);
      const portGeo = _cachedGeo('awm_port', () => new THREE.BoxGeometry(0.035, 0.014, 0.010));
      for (let b = -1; b <= 1; b++) {
        const port = new THREE.Mesh(portGeo, m.boreMat);
        port.position.set(0, 0.018, -0.71 + b * 0.019);
        g.add(port);
      }

      const bipodMount = new THREE.Mesh(geoRoundedBox(0.044, 0.022, 0.036, 0.004, 0.0012), m.darkMat);
      bipodMount.position.set(0, -0.046, -0.26);
      const bipodL = new THREE.Mesh(_cachedGeo('awm_bip', () => {
        const c = new THREE.CylinderGeometry(0.006, 0.006, 0.20, 10);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.bluedMat);
      bipodL.position.set(-0.026, -0.046, -0.36);
      const bipodR = bipodL.clone();
      bipodR.position.x = 0.026;

      const mag = new THREE.Group();
      const magBody = new THREE.Mesh(geoRoundedBox(0.032, 0.098, 0.084, 0.004, 0.0012), m.magMat);
      const magFloor = new THREE.Mesh(geoRoundedBox(0.035, 0.010, 0.088, 0.003, 0.001), m.darkMat);
      magFloor.position.set(0, -0.050, 0);
      const topRd = createCartridgeMesh('rifle', m);
      topRd.position.set(0, 0.052, 0.012);
      mag.add(magBody, magFloor, topRd);
      mag.position.set(0, -0.074, -0.02);

      out.triggerMesh = _addTriggerAndPins(g, m, 0.095, -0.038, 0.0225, [[-0.014, -0.06], [-0.014, 0.08], [-0.014, -0.20]]);

      const boltGroup = new THREE.Group();
      const boltCyl = new THREE.Mesh(_cachedGeo('awm_bcyl', () => {
        const c = new THREE.CylinderGeometry(0.0095, 0.0095, 0.09, 12);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.chromeMat);
      boltCyl.position.set(-0.020, 0.0, 0);
      const boltStem = new THREE.Mesh(geoRoundedBox(0.036, 0.010, 0.011, 0.0025, 0.0006), m.chromeMat);
      const boltKnob = new THREE.Mesh(_cachedGeo('awm_bk', () => {
        const c = new THREE.CylinderGeometry(0.011, 0.013, 0.024, 12);
        c.rotateZ(Math.PI / 2);
        return c;
      }), m.darkMat);
      boltKnob.position.set(0.024, -0.004, 0);
      boltGroup.add(boltCyl, boltStem, boltKnob);
      boltGroup.position.set(0.024, 0.020, 0.045);

      const chamberRd = createCartridgeMesh('rifle', m);
      chamberRd.position.set(0.008, 0.019, -0.020);
      out.chamberRoundMesh = chamberRd;

      out.magMesh = mag;
      out.spareMagMesh = mag.clone();
      out.spareMagMesh.visible = false;
      out.boltMesh = boltGroup;
      out.rightHandPos.set(0.0, -0.058, 0.156);
      out.leftHandPos.set(0.0, -0.032, -0.18);
      out.sightHeight = 0.078;
      out.adsZ = -0.20;
      out.muzzlePos.set(0, 0.018, -0.75);
      out.flashPos.set(0, 0.02, -0.79);

      [barrel, muzzleBrake].forEach((mm) => { mm.renderOrder = -20; });
      g.add(chassis, receiver, topRail, railTeeth, barrel, muzzleBrake, bipodMount, bipodL, bipodR, chamberRd, mag, out.spareMagMesh, boltGroup);
      return out;
    }

    // Default: M24 SWS Bolt-Action
    {
      const hasStockMod = !!(mods.stock && mods.stock !== 'none');
      const m24Pts = hasStockMod
        ? [[0.24, 0.012], [0.24, -0.028], [-0.14, -0.038], [-0.15, -0.106], [-0.19, -0.102], [-0.18, 0.002]]
        : [
            [0.24, 0.012], [0.24, -0.028], [-0.12, -0.038], [-0.14, -0.106],
            [-0.185, -0.102], [-0.21, -0.052], [-0.465, -0.092], [-0.465, 0.010],
            [-0.22, 0.002]
          ];
      const chassis = new THREE.Mesh(geoExtrudeSide(`m24_ch_${hasStockMod ? 1 : 0}`, m24Pts, 0.044, null, true), m.chassisMat);

      const receiver = new THREE.Mesh(_cachedGeo('m24_rec', () => {
        const c = new THREE.CylinderGeometry(0.021, 0.021, 0.24, 14);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.bluedMat);
      receiver.position.set(0, 0.016, 0.04);
      const topRail = new THREE.Mesh(geoRoundedBox(0.022, 0.007, 0.20, 0.002, 0.0008), m.steelMat);
      topRail.position.set(0, 0.038, 0.03);
      const railTeeth = new THREE.Mesh(geoPicatinnyRail(0.043, -0.062, 0.122, 0.021, 0.013), m.darkMat);

      const barrel = new THREE.Mesh(
        geoLatheZ('m24_bbl', [[0.08, 0.0145], [0.22, 0.0132], [0.61, 0.011], [0.61, 0.0045]]),
        m.bluedMat
      );
      barrel.position.set(0, 0.016, 0);
      barrel.renderOrder = -20;

      if (!hasStockMod) {
        const m24Cheek = new THREE.Mesh(geoRoundedBox(0.042, 0.020, 0.13, 0.006, 0.002), m.darkMat);
        m24Cheek.position.set(0, 0.016, 0.34);
        const m24Pad = new THREE.Mesh(geoRoundedBox(0.042, 0.106, 0.020, 0.006, 0.002), m.darkMat);
        m24Pad.position.set(0, -0.041, 0.475);
        g.add(m24Cheek, m24Pad);
      }

      const mag = new THREE.Group();
      const magBody = new THREE.Mesh(geoRoundedBox(0.028, 0.085, 0.072, 0.003, 0.001), m.magMat);
      const topRd = createCartridgeMesh('rifle', m);
      topRd.position.set(0, 0.046, 0.010);
      mag.add(magBody, topRd);
      mag.position.set(0, -0.068, -0.02);

      out.triggerMesh = _addTriggerAndPins(g, m, 0.09, -0.034, 0.0225, [[-0.014, -0.04], [-0.014, 0.09]]);

      const boltGroup = new THREE.Group();
      const boltCyl = new THREE.Mesh(_cachedGeo('m24_bcyl', () => {
        const c = new THREE.CylinderGeometry(0.009, 0.009, 0.085, 12);
        c.rotateX(Math.PI / 2);
        return c;
      }), m.chromeMat);
      boltCyl.position.set(-0.020, 0, 0);
      const boltStem = new THREE.Mesh(geoRoundedBox(0.032, 0.009, 0.010, 0.0025, 0.0005), m.chromeMat);
      const boltKnob = new THREE.Mesh(_cachedGeo('m24_bk', () => new THREE.SphereGeometry(0.011, 10, 8)), m.darkMat);
      boltKnob.position.set(0.020, -0.004, 0);
      boltGroup.add(boltCyl, boltStem, boltKnob);
      boltGroup.position.set(0.024, 0.018, 0.04);

      const chamberRd = createCartridgeMesh('rifle', m);
      chamberRd.position.set(0.008, 0.017, -0.018);
      out.chamberRoundMesh = chamberRd;

      out.magMesh = mag;
      out.spareMagMesh = mag.clone();
      out.spareMagMesh.visible = false;
      out.boltMesh = boltGroup;
      out.rightHandPos.set(0.0, -0.058, 0.152);
      out.leftHandPos.set(0.0, -0.030, -0.18);
      out.sightHeight = 0.074;
      out.adsZ = -0.22;
      out.muzzlePos.set(0, 0.016, -0.62);
      out.flashPos.set(0, 0.02, -0.66);

      g.add(chassis, receiver, topRail, railTeeth, barrel, chamberRd, mag, out.spareMagMesh, boltGroup);
      return out;
    }
  }

  // Real 1K GLTF Prop Loader & Seamless Upgrade Helper (Gracefully falls back if HTTP offline/CORS)
  function _getLoader() {
    if (!_loader && typeof THREE !== 'undefined' && typeof THREE.GLTFLoader === 'function') {
      _loader = new THREE.GLTFLoader();
    }
    return _loader;
  }

  function loadGLTFProp(key) {
    const path = GLTF_PROP_PATHS[key];
    if (!path) return Promise.resolve(null);
    if (_gltfCache[key]) return Promise.resolve(_gltfCache[key]);
    if (_gltfPromises[key]) return _gltfPromises[key];
    const ldr = _getLoader();
    if (!ldr) return Promise.resolve(null);
    _gltfPromises[key] = new Promise((resolve) => {
      try {
        ldr.load(path, (gltf) => {
          const root = (gltf && gltf.scene) || null;
          if (root) {
            root.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(root);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            const wrapper = new THREE.Group();
            root.position.set(-center.x, -box.min.y, -center.z);
            wrapper.add(root);
            wrapper.userData._rawSize = size.clone();
            _gltfCache[key] = wrapper;
            resolve(wrapper);
          } else {
            resolve(null);
          }
        }, undefined, () => resolve(null));
      } catch (e) {
        resolve(null);
      }
    });
    return _gltfPromises[key];
  }

  function attachRealProp(parentGroup, key, targetHeight = 0.5, rotY = 0, yOffset = 0, hideFallbackChildren = true) {
    if (!parentGroup || !GLTF_PROP_PATHS[key]) return;
    loadGLTFProp(key).then((proto) => {
      if (!proto || !parentGroup) return;
      const clone = proto.clone(true);
      const rawH = Math.max(0.05, (proto.userData._rawSize && proto.userData._rawSize.y) || 0.5);
      const sc = targetHeight / rawH;
      clone.scale.setScalar(sc);
      clone.rotation.y = rotY;
      clone.position.y = yOffset;
      if (hideFallbackChildren) {
        for (let i = 0; i < parentGroup.children.length; i++) {
          const ch = parentGroup.children[i];
          if (!ch.userData || !ch.userData.keepOnGLTF) ch.visible = false;
        }
      }
      parentGroup.add(clone);
    });
  }

  // Contoured World Vehicles & Infrastructure (replaces boxy cubes with sculpted silhouettes)
  function createVehicleWreck(isAPC = false, mats = {}) {
    const g = new THREE.Group();
    const darkMat = mats.bossDark || new THREE.MeshLambertMaterial({ color: 0x26292b });
    const oliveMat = mats.rustOlive || new THREE.MeshLambertMaterial({ color: 0x3b4432 });
    const tireMat = mats.windowFrame || new THREE.MeshLambertMaterial({ color: 0x181a1c });
    const hubMat = mats.metal || new THREE.MeshLambertMaterial({ color: 0x5b6268 });
    const rimMat = mats.darkConcrete || new THREE.MeshLambertMaterial({ color: 0x34383c });

    if (isAPC) {
      // Soviet BTR-80 8x8 Sloped-Armor Hull via ExtrudeGeometry
      const hullGeo = geoExtrudeSide('btr80_hull', [
        [3.35, 0.92], [3.65, 1.32], [2.45, 1.78], [-2.95, 1.74], [-3.35, 1.48],
        [-3.30, 0.62], [-2.50, 0.52], [2.65, 0.56]
      ], 2.55, null, true);
      const hull = new THREE.Mesh(hullGeo, oliveMat);
      const trimVane = new THREE.Mesh(geoRoundedBox(2.2, 0.45, 0.14, 0.04, 0.02), darkMat);
      trimVane.position.set(0, 1.18, -3.55);
      trimVane.rotation.x = 0.52;

      const turret = new THREE.Mesh(
        _cachedGeo('btr_turret', () => new THREE.CylinderGeometry(0.68, 0.96, 0.58, 8)),
        darkMat
      );
      turret.position.set(0, 2.04, -0.75);
      const mantlet = new THREE.Mesh(geoRoundedBox(0.55, 0.34, 0.48, 0.05, 0.02), darkMat);
      mantlet.position.set(0, 2.05, -1.48);
      const barrel = new THREE.Mesh(
        geoLatheZ('btr_kpvt', [[0, 0.065], [1.9, 0.042], [2.25, 0.042], [2.32, 0.055], [2.32, 0.022]], 10),
        tireMat
      );
      barrel.position.set(0, 2.08, -1.52);
      g.add(hull, trimVane, turret, mantlet, barrel);

      const tireGeo = _cachedGeo('btr_tire', () => {
        const c = new THREE.CylinderGeometry(0.49, 0.49, 0.36, 12);
        c.rotateZ(Math.PI / 2);
        return c;
      });
      const hubGeo = _cachedGeo('btr_hub', () => {
        const c = new THREE.CylinderGeometry(0.24, 0.24, 0.39, 10);
        c.rotateZ(Math.PI / 2);
        return c;
      });
      for (const wz of [-2.25, -0.78, 0.78, 2.25]) {
        for (const wx of [-1.32, 1.32]) {
          const wh = new THREE.Mesh(tireGeo, tireMat);
          wh.position.set(wx, 0.49, wz);
          const hb = new THREE.Mesh(hubGeo, oliveMat);
          hb.position.set(wx, 0.49, wz);
          g.add(wh, hb);
        }
      }
      return g;
    }

    // Sloped Russian Lada/UAZ Sedan silhouette
    const paintMat = Math.random() < 0.5 ? (mats.rustRed || oliveMat) : (mats.rustBlue || oliveMat);
    const carGeo = geoExtrudeSide('car_body', [
      [2.15, 0.32], [2.15, 0.78], [1.05, 0.94], [0.52, 1.48],
      [-0.85, 1.48], [-1.35, 0.96], [-2.12, 0.90], [-2.12, 0.32]
    ], 1.84, null, true);
    const body = new THREE.Mesh(carGeo, paintMat);
    const windshield = new THREE.Mesh(geoRoundedBox(1.52, 0.46, 0.75, 0.04, 0.02), rimMat);
    windshield.position.set(0, 1.18, -0.78);
    windshield.rotation.x = 0.68;
    const bumperF = new THREE.Mesh(geoRoundedBox(1.88, 0.18, 0.16, 0.03, 0.01), tireMat);
    bumperF.position.set(0, 0.38, -2.16);
    const bumperR = bumperF.clone();
    bumperR.position.z = 2.14;
    g.add(body, windshield, bumperF, bumperR);

    const cTireGeo = _cachedGeo('car_tire', () => {
      const c = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10);
      c.rotateZ(Math.PI / 2);
      return c;
    });
    const cHubGeo = _cachedGeo('car_hub', () => {
      const c = new THREE.CylinderGeometry(0.18, 0.18, 0.26, 8);
      c.rotateZ(Math.PI / 2);
      return c;
    });
    for (const wz of [-1.32, 1.32]) {
      for (const wx of [-0.96, 0.96]) {
        const t = new THREE.Mesh(cTireGeo, tireMat);
        t.position.set(wx, 0.34, wz);
        const h = new THREE.Mesh(cHubGeo, hubMat);
        h.position.set(wx, 0.34, wz);
        g.add(t, h);
      }
    }
    return g;
  }

  function createHelicopterWreck(mats = {}) {
    const g = new THREE.Group();
    const oliveMat = mats.rustOlive || new THREE.MeshLambertMaterial({ color: 0x3b4432 });
    const darkMat = mats.bossDark || new THREE.MeshLambertMaterial({ color: 0x222628 });
    const glassMat = mats.windowFrame || new THREE.MeshLambertMaterial({ color: 0x1c262c });
    const metalMat = mats.metal || new THREE.MeshLambertMaterial({ color: 0x5c646c });

    const fuseGeo = geoExtrudeSide('helo_fuse', [
      [4.2, 0.25], [5.4, 0.65], [4.5, 1.55], [2.4, 2.35],
      [-2.8, 2.35], [-4.2, 1.45], [-4.2, 0.35], [-2.5, 0.22]
    ], 2.7, null, true);
    const fuse = new THREE.Mesh(fuseGeo, oliveMat);
    const glass = new THREE.Mesh(geoRoundedBox(2.2, 0.85, 1.7, 0.12, 0.04), glassMat);
    glass.position.set(0, 1.48, -4.35);
    glass.rotation.x = 0.55;
    const podL = new THREE.Mesh(geoRoundedBox(0.58, 0.65, 2.4, 0.12, 0.03), darkMat);
    podL.position.set(-1.55, 0.95, -0.5);
    const podR = podL.clone();
    podR.position.x = 1.55;
    const engineDeck = new THREE.Mesh(geoRoundedBox(1.5, 0.68, 3.2, 0.14, 0.04), darkMat);
    engineDeck.position.set(0, 2.55, -0.2);

    const boom = new THREE.Mesh(geoExtrudeSide('helo_boom', [
      [0.0, 2.15], [-6.2, 1.95], [-7.4, 3.35], [-8.0, 3.35], [-7.3, 1.55], [0.0, 1.35]
    ], 0.72, null, true), oliveMat);
    boom.position.set(0.35, 0, 3.6);
    boom.rotation.y = 0.22;

    const mast = new THREE.Mesh(_cachedGeo('helo_mast', () => new THREE.CylinderGeometry(0.24, 0.30, 1.0, 10)), metalMat);
    mast.position.set(0, 3.15, -0.2);
    const blade1 = new THREE.Mesh(geoRoundedBox(10.6, 0.07, 0.40, 0.02, 0.01), darkMat);
    blade1.position.set(0, 3.55, -0.2);
    blade1.rotation.z = 0.12;
    const blade2 = new THREE.Mesh(geoRoundedBox(0.40, 0.07, 9.6, 0.02, 0.01), darkMat);
    blade2.position.set(0, 3.52, -0.2);
    blade2.rotation.x = -0.09;

    g.add(fuse, glass, podL, podR, engineDeck, boom, mast, blade1, blade2);
    return g;
  }

  function createFloodlightTower(height = 10.5, bulbColor = 0xfff0cc, doubleHead = true) {
    const g = new THREE.Group();
    const metalMat = _matCache.ft_metal || (_matCache.ft_metal = new THREE.MeshLambertMaterial({ color: 0x383e44 }));
    const housingMat = _matCache.ft_house || (_matCache.ft_house = new THREE.MeshLambertMaterial({ color: 0x202428 }));
    const lKey = `ft_lens_${bulbColor}`;
    const lensMat = _matCache[lKey] || (_matCache[lKey] = new THREE.MeshBasicMaterial({ color: bulbColor }));

    const pole = new THREE.Mesh(_cachedGeo(`ft_pole_${height.toFixed(1)}`, () => new THREE.CylinderGeometry(0.14, 0.26, height, 8)), metalMat);
    pole.position.y = height * 0.5;
    const bar = new THREE.Mesh(geoRoundedBox(doubleHead ? 1.8 : 0.8, 0.16, 0.16, 0.02, 0.01), metalMat);
    bar.position.y = height;
    g.add(pole, bar);

    const offsets = doubleHead ? [-0.62, 0.62] : [0];
    for (const ox of offsets) {
      const hood = new THREE.Mesh(geoRoundedBox(0.56, 0.36, 0.32, 0.03, 0.01), housingMat);
      hood.position.set(ox, height + 0.16, 0.12);
      hood.rotation.x = 0.22;
      const lens = new THREE.Mesh(_cachedGeo('ft_lens', () => new THREE.PlaneGeometry(0.46, 0.26)), lensMat);
      lens.position.set(ox, height + 0.12, 0.29);
      lens.rotation.x = 0.22;
      g.add(hood, lens);
    }
    return g;
  }

  // Smooth & Snap Keyframe Track Evaluator for MW2019+ Animations
  // tracks: [{ t: 0..1, v: [x, y, z] | number, ease: 'smooth'|'snap'|'overshoot'|'linear' }, ...]
  function evalKeyframes(keys, p) {
    if (!keys || keys.length === 0) return [0, 0, 0];
    if (p <= keys[0].t) return Array.isArray(keys[0].v) ? keys[0].v.slice() : [keys[0].v];
    const last = keys[keys.length - 1];
    if (p >= last.t) return Array.isArray(last.v) ? last.v.slice() : [last.v];
    let idx = 0;
    for (let i = 0; i < keys.length - 1; i++) {
      if (p >= keys[i].t && p <= keys[i + 1].t) { idx = i; break; }
    }
    const a = keys[idx];
    const b = keys[idx + 1];
    const span = Math.max(0.0001, b.t - a.t);
    let u = Math.max(0, Math.min(1, (p - a.t) / span));
    const ease = b.ease || 'smooth';
    if (ease === 'smooth') {
      u = u * u * (3 - 2 * u);
    } else if (ease === 'snap') {
      const inv = 1 - u;
      u = 1 - inv * inv * inv;
    } else if (ease === 'overshoot') {
      const c1 = 1.65;
      const c3 = c1 + 1;
      const um = u - 1;
      u = 1 + c3 * um * um * um + c1 * um * um;
    }
    if (!Array.isArray(a.v)) return [a.v + (b.v - a.v) * u];
    const out = new Array(a.v.length);
    for (let k = 0; k < a.v.length; k++) {
      out[k] = a.v[k] + (b.v[k] - a.v[k]) * u;
    }
    return out;
  }

  return {
    getWeaponTextures,
    getWeaponMaterialSet,
    mergeGeos: _mergeGeos,
    geoLatheZ,
    geoRoundedBox,
    geoExtrudeSide,
    geoCurvedGrip,
    geoPicatinnyRail,
    createCartridgeMesh,
    buildWeaponRig,
    loadGLTFProp,
    attachRealProp,
    createVehicleWreck,
    createHelicopterWreck,
    createFloodlightTower,
    evalKeyframes
  };
})();

// Optical Screen-Space Anamorphic & Chromatic Lens Flare Engine
window.LensFlareSystem = (() => {
  let canvas = null;
  let ctx = null;
  let spritesReady = false;
  let starburstSprite = null;
  let streakSprite = null;
  let ringSprite = null;
  let hexSprite = null;
  const _visMap = new Map();
  let _ray = null;
  const _tmpV = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _toSrc = new THREE.Vector3();
  const _sampleP = new THREE.Vector3();
  let _lastMs = performance.now();

  function _ensureCanvas() {
    if (!canvas) {
      canvas = document.getElementById('lens-flare-canvas');
      if (!canvas && document.body) {
        canvas = document.createElement('canvas');
        canvas.id = 'lens-flare-canvas';
        canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2;mix-blend-mode:screen;';
        const gameCanvas = document.getElementById('game-canvas');
        if (gameCanvas && gameCanvas.parentNode) {
          gameCanvas.parentNode.insertBefore(canvas, gameCanvas.nextSibling);
        } else {
          document.body.appendChild(canvas);
        }
      }
      if (canvas) ctx = canvas.getContext('2d');
    }
    if (canvas && (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight)) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    if (!spritesReady) _buildSprites();
  }

  function _mkOffscreen(w, h, drawFn) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    drawFn(c.getContext('2d'), w, h);
    return c;
  }

  function _buildSprites() {
    spritesReady = true;
    starburstSprite = _mkOffscreen(256, 256, (c, w, h) => {
      const cx = w * 0.5, cy = h * 0.5;
      const g = c.createRadialGradient(cx, cy, 2, cx, cy, 124);
      g.addColorStop(0.0, 'rgba(255, 252, 240, 0.98)');
      g.addColorStop(0.14, 'rgba(255, 232, 184, 0.72)');
      g.addColorStop(0.42, 'rgba(255, 198, 130, 0.22)');
      g.addColorStop(1.0, 'rgba(255, 180, 100, 0.0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);

      // 12 crisp optical diffraction rays
      c.save();
      c.translate(cx, cy);
      for (let i = 0; i < 12; i++) {
        c.rotate(Math.PI / 6);
        const rayLen = (i % 2 === 0) ? 120 : 82;
        const rg = c.createLinearGradient(0, 0, rayLen, 0);
        rg.addColorStop(0, 'rgba(255, 248, 224, 0.65)');
        rg.addColorStop(1, 'rgba(255, 220, 160, 0.0)');
        c.fillStyle = rg;
        c.beginPath();
        c.moveTo(0, -1.6);
        c.lineTo(rayLen, 0);
        c.lineTo(0, 1.6);
        c.closePath();
        c.fill();
      }
      c.restore();
    });

    streakSprite = _mkOffscreen(512, 64, (c, w, h) => {
      const cy = h * 0.5;
      const gx = c.createLinearGradient(0, 0, w, 0);
      gx.addColorStop(0.0, 'rgba(110, 185, 255, 0.0)');
      gx.addColorStop(0.28, 'rgba(130, 200, 255, 0.28)');
      gx.addColorStop(0.5, 'rgba(230, 245, 255, 0.85)');
      gx.addColorStop(0.72, 'rgba(130, 200, 255, 0.28)');
      gx.addColorStop(1.0, 'rgba(110, 185, 255, 0.0)');
      c.fillStyle = gx;
      c.fillRect(0, cy - 10, w, 20);
      const gy = c.createRadialGradient(w * 0.5, cy, 1, w * 0.5, cy, h * 0.48);
      gy.addColorStop(0, 'rgba(255, 250, 235, 0.72)');
      gy.addColorStop(1, 'rgba(140, 205, 255, 0.0)');
      c.fillStyle = gy;
      c.fillRect(0, 0, w, h);
    });

    ringSprite = _mkOffscreen(128, 128, (c, w, h) => {
      const cx = w * 0.5, cy = h * 0.5;
      const g = c.createRadialGradient(cx, cy, 34, cx, cy, 60);
      g.addColorStop(0.0, 'rgba(90, 210, 255, 0.0)');
      g.addColorStop(0.55, 'rgba(120, 225, 255, 0.16)');
      g.addColorStop(0.82, 'rgba(255, 175, 110, 0.28)');
      g.addColorStop(0.95, 'rgba(140, 245, 190, 0.12)');
      g.addColorStop(1.0, 'rgba(140, 245, 190, 0.0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });

    hexSprite = _mkOffscreen(128, 128, (c, w, h) => {
      const cx = w * 0.5, cy = h * 0.5, r = 52;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.15;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      const g = c.createRadialGradient(cx, cy, 4, cx, cy, r);
      g.addColorStop(0, 'rgba(255, 215, 155, 0.16)');
      g.addColorStop(0.78, 'rgba(155, 220, 255, 0.24)');
      g.addColorStop(1, 'rgba(135, 195, 255, 0.0)');
      c.fillStyle = g;
      c.fill();
    });
  }

  function clear() {
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function _isOccluded(camPos, world, dirUnit, maxRayDist, checkTerrain = false) {
    if (!world) return false;
    // Fast analytical terrain horizon occlusion (mountains, dam walls, cliffs)
    if (checkTerrain && typeof world.getTerrainHeight === 'function') {
      const steps = maxRayDist > 300 ? 7 : 4;
      for (let s = 1; s <= steps; s++) {
        const d = (maxRayDist * s) / (steps + 1);
        _sampleP.copy(camPos).addScaledVector(dirUnit, d);
        const th = world.getTerrainHeight(_sampleP.x, _sampleP.z);
        if (th > _sampleP.y + 0.6) return true;
      }
    }
    if (world.raycastWorld) {
      if (world.raycastWorld(camPos, dirUnit, 0.6, Math.max(0.7, maxRayDist - 0.8), { wallsOnly: true })) return true;
    }
    return false;
  }

  function updateAndRender(camera, world, weaponSystem = null, isModalOpen = false) {
    _ensureCanvas();
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const nowMs = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (nowMs - _lastMs) / 1000));
    _lastMs = nowMs;

    if (!camera || !world || !Array.isArray(world.lightSources) || world.lightSources.length === 0) return;
    if (isModalOpen) return;

    const gfxLight = (window.GFX_SETTINGS && typeof window.GFX_SETTINGS.lighting === 'number') ? window.GFX_SETTINGS.lighting : 3;
    if (gfxLight <= 0) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W * 0.5;
    const cy = H * 0.5;

    camera.getWorldDirection(_fwd);
    const camPos = camera.position;
    const smoothRate = Math.min(1, dt * 13);

    const ghostMults = [-0.32, 0.24, 0.54, 0.88, 1.32];
    const ghostScales = [0.42, 0.65, 1.10, 0.78, 1.45];

    for (let i = 0; i < world.lightSources.length; i++) {
      const src = world.lightSources[i];
      if (!src) continue;

      let targetVis = 0;
      let sx = 0, sy = 0;
      let distFactor = 1.0;

      if (src.isDirectional && src.dir) {
        _toSrc.copy(src.dir).normalize();
        const dot = _fwd.dot(_toSrc);
        if (dot > 0.28) {
          _tmpV.copy(camPos).addScaledVector(_toSrc, 350);
          _tmpV.project(camera);
          if (_tmpV.z > 0 && _tmpV.z < 1) {
            sx = (_tmpV.x * 0.5 + 0.5) * W;
            sy = (-_tmpV.y * 0.5 + 0.5) * H;
            const edgeFade = Math.max(0, Math.min(1, 1.35 - Math.hypot((sx - cx) / W, (sy - cy) / H) * 1.45));
            if (edgeFade > 0.02 && !_isOccluded(camPos, world, _toSrc, 320, true)) {
              targetVis = edgeFade * Math.pow((dot - 0.28) / 0.72, 0.6);
            }
          }
        }
      } else if (src.pos) {
        _toSrc.subVectors(src.pos, camPos);
        const dist = _toSrc.length();
        const maxD = src.maxDist || 190;
        if (dist > 1.2 && dist < maxD) {
          _toSrc.multiplyScalar(1 / dist);
          const dot = _fwd.dot(_toSrc);
          if (dot > 0.42) {
            _tmpV.copy(src.pos).project(camera);
            if (_tmpV.z > 0 && _tmpV.z < 1) {
              sx = (_tmpV.x * 0.5 + 0.5) * W;
              sy = (-_tmpV.y * 0.5 + 0.5) * H;
              distFactor = Math.max(0.12, 1.0 - dist / maxD);
              const edgeFade = Math.max(0, Math.min(1, 1.25 - Math.hypot((sx - cx) / W, (sy - cy) / H) * 1.35));
              if (edgeFade > 0.02 && !_isOccluded(camPos, world, _toSrc, dist, dist > 55)) {
                targetVis = edgeFade * distFactor;
              }
            }
          }
        }
      }

      const prevVis = _visMap.get(i) || 0;
      const curVis = prevVis + (targetVis - prevVis) * smoothRate;
      _visMap.set(i, curVis);
      if (curVis < 0.015) continue;

      const intensity = (src.intensity || 1.0) * curVis * (gfxLight >= 3 ? 1.0 : 0.72);
      const basePx = Math.min(W, H) * 0.22 * (src.flareScale || 1.0) * (0.45 + 0.55 * distFactor);

      // 1. Primary Optical Starburst Core
      ctx.globalAlpha = Math.min(0.92, intensity * 0.85);
      const sbSize = basePx * 1.45;
      ctx.drawImage(starburstSprite, sx - sbSize * 0.5, sy - sbSize * 0.5, sbSize, sbSize);

      // 2. Anamorphic Horizontal Streak (Cinema blue/warm sweep across sun & floodlights)
      if (src.anamorphic !== false) {
        const stW = basePx * 3.8;
        const stH = basePx * 0.36;
        ctx.globalAlpha = Math.min(0.75, intensity * 0.62);
        ctx.drawImage(streakSprite, sx - stW * 0.5, sy - stH * 0.5, stW, stH);
      }

      // 3. Multi-Ghost Chromatic Aperture Reflections along optical center axis
      if (src.ghosts !== false && curVis > 0.08) {
        const dx = cx - sx;
        const dy = cy - sy;
        for (let gi = 0; gi < ghostMults.length; gi++) {
          const gx = cx + dx * ghostMults[gi];
          const gy = cy + dy * ghostMults[gi];
          const gs = basePx * 0.34 * ghostScales[gi];
          ctx.globalAlpha = Math.min(0.45, intensity * 0.32 * (1 - gi * 0.12));
          ctx.drawImage((gi % 2 === 0) ? hexSprite : ringSprite, gx - gs * 0.5, gy - gs * 0.5, gs, gs);
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }

  return { updateAndRender, clear };
})();
