// Declarative Prototype-Cached High-Poly CAD Weapon System, Real 1K GLTF Prop Instancer & Optical Lens Flare System
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

  function _markShared(obj) {
    if (!obj) return obj;
    if (!obj.userData) obj.userData = {};
    obj.userData._ashShared = true;
    return obj;
  }

  function _uvWrapBox(geo, tile = 0.25) {
    if (window.AshfallPBR && window.AshfallPBR.UVUnwrap) {
      return window.AshfallPBR.UVUnwrap.unwrapBox(geo, tile);
    }
    if (geo && geo.attributes && geo.attributes.uv && !geo.attributes.uv2) {
      geo.setAttribute('uv2', geo.attributes.uv);
    }
    return geo;
  }

  function _uvWrapCyl(geo, radius = null, axis = 'z', tile = 0.22) {
    if (window.AshfallPBR && window.AshfallPBR.UVUnwrap) {
      return window.AshfallPBR.UVUnwrap.unwrapCylinder(geo, radius, axis, tile);
    }
    if (geo && geo.attributes && geo.attributes.uv && !geo.attributes.uv2) {
      geo.setAttribute('uv2', geo.attributes.uv);
    }
    return geo;
  }

  function _uvWrapExtrude(geo, tile = 0.24) {
    if (window.AshfallPBR && window.AshfallPBR.UVUnwrap) {
      return window.AshfallPBR.UVUnwrap.unwrapExtrude(geo, tile);
    }
    if (geo && geo.attributes && geo.attributes.uv && !geo.attributes.uv2) {
      geo.setAttribute('uv2', geo.attributes.uv);
    }
    return geo;
  }

  function getWeaponTextures() {
    if (window._wpnTex && window._wpnTex._v === 3) return window._wpnTex;
    if (window.AshfallPBR && window.AshfallPBR.getMaps) {
      const P = window.AshfallPBR;
      const pk = P.getMaps('gunmetal_parkerized');
      const bl = P.getMaps('gunmetal_blued');
      const br = P.getMaps('steel_brushed');
      const pl = P.getMaps('polymer_stippled');
      const bk = P.getMaps('bakelite_russian');
      const wd = P.getMaps('wood_laminated_birch');
      const cm = P.getMaps('polymer_od');
      const bs = P.getMaps('brass_casing');
      window._wpnTex = {
        _v: 3,
        bumpNoise: pl.normalMap,
        bumpStipple: pl.normalMap,
        bumpBrush: pk.normalMap,
        parkerized: pk.map,
        blued: bl.map,
        brushedSteel: br.map,
        polymer: pl.map,
        bakelite: bk.map,
        wood: wd.map,
        composite: cm.map,
        brass: bs.map,
        copper: bs.map,
        shellRed: pl.map
      };
      return window._wpnTex;
    }
    return {};
  }

  function getWeaponMaterialSet(gunMat = null) {
    const P = window.AshfallPBR;
    const key = gunMat ? `pbr_camo_${gunMat.uuid}` : 'pbr_stock_v3';
    if (_matCache[key]) return _matCache[key];
    const hasCamo = !!gunMat;
    let set;
    if (P && P.getMaterial) {
      set = {
        steelMat: hasCamo ? gunMat : P.getMaterial('gunmetal_parkerized'),
        bluedMat: hasCamo ? gunMat : P.getMaterial('gunmetal_blued'),
        nitrideMat: hasCamo ? gunMat : P.getMaterial('gunmetal_nitride'),
        darkMat: P.getMaterial('polymer_stippled'),
        magMat: P.getMaterial('steel_brushed'),
        bakeliteMat: P.getMaterial('bakelite_russian'),
        brassMat: P.getMaterial('brass_casing'),
        copperMat: P.getMaterial('brass_casing', { color: 0xc87448, roughness: 0.28 }),
        woodMat: P.getMaterial('wood_laminated_birch'),
        walnutMat: P.getMaterial('wood_walnut'),
        chassisMat: hasCamo ? gunMat : P.getMaterial('polymer_od'),
        fdeMat: P.getMaterial('polymer_fde'),
        rubberMat: P.getMaterial('rubber_buttpad'),
        anodizedMat: P.getMaterial('aluminum_anodized'),
        bronzeMat: P.getMaterial('aluminum_fde'),
        shellRedMat: P.getMaterial('polymer_stippled', { color: 0xb82424, roughness: 0.44 }),
        boreMat: _markShared(new THREE.MeshBasicMaterial({ color: 0x050607 })),
        chromeMat: P.getMaterial('steel_chrome')
      };
    } else {
      const mFallback = (hex) => _markShared(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, metalness: 0.4 }));
      set = {
        steelMat: hasCamo ? gunMat : mFallback(0x4a5058),
        bluedMat: hasCamo ? gunMat : mFallback(0x28323e),
        nitrideMat: hasCamo ? gunMat : mFallback(0x222529),
        darkMat: mFallback(0x1e2024),
        magMat: mFallback(0x88929b),
        bakeliteMat: mFallback(0x9b3e1f),
        brassMat: mFallback(0xd4a442),
        copperMat: mFallback(0xc87448),
        woodMat: mFallback(0x8c5024),
        walnutMat: mFallback(0x5c361a),
        chassisMat: hasCamo ? gunMat : mFallback(0x45543c),
        fdeMat: mFallback(0x9a8464),
        rubberMat: mFallback(0x16181a),
        anodizedMat: mFallback(0x2a2d32),
        bronzeMat: mFallback(0x88603c),
        shellRedMat: mFallback(0xb02828),
        boreMat: _markShared(new THREE.MeshBasicMaterial({ color: 0x050607 })),
        chromeMat: mFallback(0xd6dee6)
      };
    }
    Object.values(set).forEach((m) => _markShared(m));
    _matCache[key] = set;
    return set;
  }

  function _cachedGeo(key, fn) {
    if (!_geoCache[key]) {
      const g = fn();
      if (g) _markShared(g);
      _geoCache[key] = g;
    }
    return _geoCache[key];
  }

  // Merge array of BufferGeometries safely in Three r128 (preserves uv + uv2 for PBR aoMap)
  function _mergeGeos(geos) {
    if (!geos || geos.length === 0) return _uvWrapBox(new THREE.BoxGeometry(0.01, 0.01, 0.01));
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
    const uvAttr = new THREE.BufferAttribute(uv, 2);
    merged.setAttribute('uv', uvAttr);
    merged.setAttribute('uv2', uvAttr);
    return merged;
  }

  // High-poly Contoured Lathe profile oriented along -Z (zFwd = +distance toward muzzle)
  function geoLatheZ(cacheKey, profileZR, segs = 28) {
    return _cachedGeo(`lathe_hp:${cacheKey}:${segs}`, () => {
      const pts = profileZR.map(([zFwd, r]) => new THREE.Vector2(Math.max(0.0001, r), zFwd));
      const geo = new THREE.LatheGeometry(pts, segs);
      geo.rotateX(-Math.PI / 2); // +Y_lathe -> -Z_weapon
      geo.computeVertexNormals();
      return _uvWrapCyl(geo, null, 'z', 0.18);
    });
  }

  function geoRoundedBox(w, h, d, r = 0.004, bevel = 0.0018, tile = 0.25) {
    const key = `rb_hp:${w.toFixed(4)}:${h.toFixed(4)}:${d.toFixed(4)}:${r.toFixed(4)}:${bevel.toFixed(4)}:${tile}`;
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
      const b = Math.min(bevel, d * 0.16, rr * 0.65);
      let geo = new THREE.ExtrudeGeometry(sh, {
        depth: Math.max(0.002, d - b * 2),
        bevelEnabled: b > 0.0002,
        bevelThickness: b,
        bevelSize: b * 0.85,
        bevelSegments: 3,
        curveSegments: 8
      });
      geo.translate(0, 0, -(d - b * 2) * 0.5);
      geo = _uvWrapExtrude(geo, tile);
      geo.computeVertexNormals();
      return geo;
    });
  }

  function geoExtrudeSide(cacheKey, pts, width, holes = null, bevel = true, tile = 0.28) {
    return _cachedGeo(`ext_hp:${cacheKey}`, () => {
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
      let geo = new THREE.ExtrudeGeometry(sh, {
        depth: width,
        bevelEnabled: bevel,
        bevelThickness: bevel ? 0.0026 : 0,
        bevelSize: bevel ? 0.0022 : 0,
        bevelSegments: 3,
        curveSegments: 14
      });
      geo.translate(0, 0, -width * 0.5);
      geo = _uvWrapExtrude(geo, tile);
      geo.rotateY(Math.PI / 2);
      geo.computeVertexNormals();
      return geo;
    });
  }

  function geoCurvedGrip(w, h, d) {
    return _cachedGeo(`grip_hp:${w.toFixed(4)}:${h.toFixed(4)}:${d.toFixed(4)}`, () => {
      const sh = new THREE.Shape();
      const hw = d * 0.5;
      const hh = h * 0.5;
      sh.moveTo(-hw * 0.90, hh);
      sh.lineTo(hw * 0.85, hh);
      sh.bezierCurveTo(hw * 0.72, hh * 0.35, hw * 1.05, -hh * 0.25, hw * 0.88, -hh);
      sh.lineTo(-hw * 0.92, -hh);
      sh.bezierCurveTo(-hw * 1.08, -hh * 0.30, -hw * 0.78, hh * 0.32, -hw * 0.90, hh);
      let geo = new THREE.ExtrudeGeometry(sh, {
        depth: w,
        bevelEnabled: true,
        bevelThickness: 0.0028,
        bevelSize: 0.0024,
        bevelSegments: 3,
        curveSegments: 12
      });
      geo.translate(0, 0, -w * 0.5);
      geo = _uvWrapExtrude(geo, 0.16);
      geo.rotateY(Math.PI / 2);
      geo.computeVertexNormals();
      return geo;
    });
  }

  function geoPicatinnyRail(yPos, zStart, zEnd, width = 0.0212, step = 0.010) {
    const key = `pic_hp:${yPos.toFixed(4)}:${zStart.toFixed(4)}:${zEnd.toFixed(4)}:${width.toFixed(4)}:${step.toFixed(4)}`;
    return _cachedGeo(key, () => {
      const zMin = Math.min(zStart, zEnd);
      const zMax = Math.max(zStart, zEnd);
      const parts = [];
      const spine = new THREE.BoxGeometry(width * 0.68, 0.0024, zMax - zMin);
      spine.translate(0, yPos - 0.0018, (zMin + zMax) * 0.5);
      _uvWrapBox(spine, 0.18);
      parts.push(spine);
      for (let z = zMin + step * 0.45; z <= zMax - step * 0.45; z += step) {
        const g = new THREE.BoxGeometry(width, 0.0036, step * 0.54);
        g.translate(0, yPos, z);
        _uvWrapBox(g, 0.16);
        parts.push(g);
      }
      return _mergeGeos(parts);
    });
  }

  function createCartridgeMesh(caliber = 'rifle', mats = null) {
    const m = mats || getWeaponMaterialSet(null);
    const grp = new THREE.Group();
    if (caliber === '12g') {
      const hull = new THREE.Mesh(
        _cachedGeo('round_12g_hull_hp', () => {
          const g = new THREE.CylinderGeometry(0.0092, 0.0092, 0.052, 20);
          return _uvWrapCyl(g, 0.0092, 'y', 0.08);
        }),
        m.shellRedMat
      );
      hull.rotation.x = Math.PI / 2;
      const brass = new THREE.Mesh(
        _cachedGeo('round_12g_brass_hp', () => {
          const g = new THREE.CylinderGeometry(0.0096, 0.0098, 0.016, 20);
          return _uvWrapCyl(g, 0.0096, 'y', 0.08);
        }),
        m.brassMat
      );
      brass.rotation.x = Math.PI / 2;
      brass.position.z = 0.026;
      grp.add(hull, brass);
      return grp;
    }
    const isPistol = caliber === 'pistol';
    const r = isPistol ? 0.0049 : (caliber === 'x39' ? 0.0058 : 0.0060);
    const len = isPistol ? 0.0195 : (caliber === 'x39' ? 0.0387 : 0.045);
    const caseGeo = _cachedGeo(`round_case_hp_${caliber}`, () => {
      const g = new THREE.CylinderGeometry(r * 0.86, r, len, 18);
      g.rotateX(Math.PI / 2);
      return _uvWrapCyl(g, r, 'z', 0.08);
    });
    const tipGeo = _cachedGeo(`round_tip_hp_${caliber}`, () => {
      const g = new THREE.ConeGeometry(r * 0.82, len * 0.56, 18);
      g.rotateX(-Math.PI / 2);
      return _uvWrapCyl(g, r * 0.82, 'z', 0.08);
    });
    const cMesh = new THREE.Mesh(caseGeo, m.brassMat);
    const tMesh = new THREE.Mesh(tipGeo, m.copperMat);
    tMesh.position.z = -len * 0.72;
    grp.add(cMesh, tMesh);
    return grp;
  }

  function _addTriggerAndPins(g, m, zTrigger, yTrigger, pinXHalf, pinCoords) {
    const guardGeo = geoExtrudeSide(`tguard_hp_${zTrigger.toFixed(2)}`, [
      [0.023, 0.004], [0.025, -0.020], [0.014, -0.026], [-0.019, -0.026],
      [-0.025, -0.018], [-0.025, 0.002], [-0.018, 0.002], [-0.018, -0.019],
      [0.014, -0.020], [0.019, -0.014], [0.018, 0.004]
    ], 0.0115, null, true, 0.14);
    const guard = new THREE.Mesh(guardGeo, m.nitrideMat || m.darkMat);
    guard.position.set(0, yTrigger, zTrigger);

    const trigGeo = geoExtrudeSide('trig_shoe_hp', [
      [-0.002, 0.003], [0.0035, 0.003], [-0.001, -0.011], [-0.0065, -0.019],
      [-0.011, -0.016], [-0.0065, -0.009]
    ], 0.0055, null, true, 0.12);
    const trig = new THREE.Mesh(trigGeo, m.magMat);
    trig.position.set(0, yTrigger - 0.001, zTrigger + 0.002);
    g.add(guard, trig);

    if (pinCoords && pinCoords.length > 0) {
      const pinGeo = _cachedGeo(`pin_hp_${pinXHalf.toFixed(4)}`, () => {
        const p = new THREE.CylinderGeometry(0.0032, 0.0032, pinXHalf * 2 + 0.004, 14);
        p.rotateZ(Math.PI / 2);
        return _uvWrapCyl(p, 0.0032, 'x', 0.08);
      });
      for (const [py, pz] of pinCoords) {
        const pin = new THREE.Mesh(pinGeo, m.magMat);
        pin.position.set(0, py, pz);
        g.add(pin);
      }
    }
    return trig;
  }

  // ============================================================================
  // CAD-Accurate High-Poly Firearm Rig Builder (1.0 unit = 1.000 meter)
  // Exact real-world millimeter dimensions for all 8 firearms
  // ============================================================================
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
      const slideGroup = new THREE.Group();
      if (id === 'g17') {
        // Glock 17 Gen 4/5 (202mm OAL, 114mm barrel, 139mm H, 25.5mm slide, 30mm frame)
        const slideLen = 0.194;
        const frameGeo = geoExtrudeSide('g17_frame_hp', [
          [0.092, -0.007], [0.092, -0.024], [0.044, -0.024], [0.030, -0.020],
          [-0.034, -0.020], [-0.040, -0.036], [-0.056, -0.114], [-0.098, -0.110],
          [-0.078, -0.024], [-0.098, -0.010], [-0.074, -0.007]
        ], 0.030, null, true, 0.18);
        const frame = new THREE.Mesh(frameGeo, m.darkMat);

        // Beveled upper slide profile + chamfered dust shield
        const slideMain = new THREE.Mesh(geoRoundedBox(0.0255, 0.023, slideLen, 0.0035, 0.0022, 0.18), m.nitrideMat);
        const slideChamfer = new THREE.Mesh(geoRoundedBox(0.0215, 0.0075, slideLen - 0.004, 0.0032, 0.0014, 0.18), m.nitrideMat);
        slideChamfer.position.set(0, 0.0125, 0);
        const ejPort = new THREE.Mesh(geoRoundedBox(0.006, 0.011, 0.040, 0.002, 0.0005), m.bluedMat);
        ejPort.position.set(0.0115, 0.005, -0.010);
        const hood = new THREE.Mesh(geoRoundedBox(0.0195, 0.0085, 0.034, 0.0025, 0.0008), m.magMat);
        hood.position.set(0, 0.013, -0.012);
        const extractor = new THREE.Mesh(geoRoundedBox(0.0035, 0.0045, 0.018, 0.001, 0.0004), m.steelMat);
        extractor.position.set(0.0125, 0.003, 0.012);
        slideGroup.add(slideMain, slideChamfer, ejPort, hood, extractor);

        // Rear + front Glock Gen5 slide serrations (7 rear, 4 front)
        const serGeo = _cachedGeo('g17_ser_hp', () => _uvWrapBox(new THREE.BoxGeometry(0.0268, 0.016, 0.0022), 0.12));
        for (let s = 0; s < 7; s++) {
          const rib = new THREE.Mesh(serGeo, m.darkMat);
          rib.position.set(0, 0, 0.048 + s * 0.0058);
          slideGroup.add(rib);
        }
        for (let s = 0; s < 4; s++) {
          const fRib = new THREE.Mesh(serGeo, m.darkMat);
          fRib.scale.set(0.98, 0.86, 0.92);
          fRib.position.set(0, 0, -0.082 + s * 0.0058);
          slideGroup.add(fRib);
        }

        const slideStop = new THREE.Mesh(geoRoundedBox(0.004, 0.006, 0.022, 0.0012, 0.0004), m.nitrideMat);
        slideStop.position.set(-0.016, -0.009, 0.032);
        const magRel = new THREE.Mesh(geoRoundedBox(0.004, 0.010, 0.009, 0.0015, 0.0004), m.nitrideMat);
        magRel.position.set(-0.016, -0.030, 0.052);
        slideGroup.position.set(0, 0.006, -0.002);

        // 114mm cold-hammer-forged 9x19mm pistol barrel + crowned bore + guide rod
        const barrelMesh = new THREE.Mesh(
          geoLatheZ('g17_bbl_hp', [[-0.016, 0.0068], [0.098, 0.0068], [0.105, 0.0074], [0.107, 0.0074], [0.107, 0.0045]], 28),
          m.nitrideMat
        );
        barrelMesh.position.set(0, 0.008, -0.003);
        const guideRod = new THREE.Mesh(
          geoLatheZ('g17_rod_hp', [[0.01, 0.0044], [0.095, 0.0044], [0.098, 0.0048]], 16),
          m.magMat
        );
        guideRod.position.set(0, -0.006, -0.002);
        const bore = new THREE.Mesh(_cachedGeo('g17_bore_hp', () => {
          const c = new THREE.CylinderGeometry(0.0045, 0.0045, 0.014, 16);
          c.rotateX(Math.PI / 2);
          return c;
        }), m.boreMat);
        bore.position.set(0, 0.008, -0.106);

        const railSlot = new THREE.Mesh(geoPicatinnyRail(-0.024, -0.088, -0.055, 0.024, 0.009), m.bluedMat);
        const chamberRd = createCartridgeMesh('pistol', m);
        chamberRd.position.set(0.002, 0.008, -0.010);
        out.chamberRoundMesh = chamberRd;

        out.triggerMesh = _addTriggerAndPins(g, m, 0.018, -0.024, 0.0155, [[-0.013, 0.012], [-0.014, 0.064]]);

        // Standard 17rd mag OR OEM 33rd Extended Stick Mag (+0.078m taller stick)
        const isExt = mods.magazine === 'ext_mag';
        const magLen = isExt ? 0.172 : 0.102;
        const pistolMag = new THREE.Group();
        const magBody = new THREE.Mesh(geoRoundedBox(0.022, magLen, 0.032, 0.003, 0.001), m.darkMat);
        magBody.position.set(0, -(magLen - 0.102) * 0.5, 0);
        const magPlate = new THREE.Mesh(geoRoundedBox(0.028, 0.012, 0.038, 0.0035, 0.0012), m.nitrideMat);
        magPlate.position.set(0, -0.054 - (magLen - 0.102), 0);
        const topRd = createCartridgeMesh('pistol', m);
        topRd.position.set(0, 0.053, 0.002);
        pistolMag.add(magBody, magPlate, topRd);
        pistolMag.position.set(0, -0.080, 0.072);
        pistolMag.rotation.x = 0.24;

        out.magMesh = pistolMag;
        out.spareMagMesh = pistolMag.clone();
        out.spareMagMesh.visible = false;
        out.boltMesh = slideGroup;
        out.ironSightTarget = slideGroup;
        out.ironSightOpts = { rearZ: slideLen / 2 - 0.014, frontZ: -slideLen / 2 + 0.012, baseY: 0.017 };
        out.rightHandPos.set(0.0, -0.056, 0.070);
        out.leftHandPos.set(-0.004, -0.064, 0.066);
        out.leftHandStyle = 'supportPistol';
        out.sightHeight = 0.029;
        out.adsZ = -0.32;
        out.muzzlePos.set(0, 0.008, -slideLen / 2 - 0.014);
        out.flashPos.set(0, 0.016, -slideLen / 2 - 0.048);

        g.add(frame, slideStop, magRel, railSlot, barrelMesh, guideRod, bore, chamberRd, slideGroup, pistolMag, out.spareMagMesh);
      } else {
        // PM-9 Makarov (161.5mm OAL, 93.5mm fixed barrel, 126.8mm height, 29.4mm width, Russian bakelite star grip)
        const slideLen = 0.161;
        const frame = new THREE.Mesh(geoRoundedBox(0.024, 0.016, 0.148, 0.0035, 0.0014, 0.16), m.bluedMat);
        frame.position.set(0, -0.014, 0.006);
        const grip = new THREE.Mesh(geoCurvedGrip(0.0294, 0.098, 0.042), m.bakeliteMat);
        grip.position.set(0, -0.060, 0.058);
        grip.rotation.x = 0.24;
        const backstrap = new THREE.Mesh(geoRoundedBox(0.018, 0.092, 0.011, 0.0035, 0.001), m.bluedMat);
        backstrap.position.set(0, -0.056, 0.076);
        backstrap.rotation.x = 0.24;
        // Signature Makarov medallion + grip screw + lanyard loop
        const gripScrew = new THREE.Mesh(_cachedGeo('pm9_gscrew', () => {
          const c = new THREE.CylinderGeometry(0.0032, 0.0032, 0.031, 14);
          c.rotateZ(Math.PI / 2);
          return c;
        }), m.chromeMat);
        gripScrew.position.set(0, -0.056, 0.058);
        const starL = new THREE.Mesh(_cachedGeo('pm9_star', () => _uvWrapCyl(new THREE.CylinderGeometry(0.0095, 0.0095, 0.002, 5), 0.0095, 'y', 0.05)), m.bakeliteMat);
        starL.rotation.z = Math.PI / 2;
        starL.position.set(-0.0148, -0.056, 0.058);
        const starR = starL.clone();
        starR.position.x = 0.0148;
        const lanyardRing = new THREE.Mesh(_cachedGeo('pm9_lanyard', () => new THREE.TorusGeometry(0.005, 0.0014, 8, 16)), m.bluedMat);
        lanyardRing.rotation.y = Math.PI / 2;
        lanyardRing.position.set(0, -0.106, 0.070);

        const slideLower = new THREE.Mesh(geoRoundedBox(0.0245, 0.018, slideLen, 0.0038, 0.0014, 0.16), m.bluedMat);
        const slideCrown = new THREE.Mesh(_cachedGeo('pm9_crown_hp', () => {
          const c = new THREE.CylinderGeometry(0.0122, 0.0122, slideLen - 0.003, 24);
          c.rotateX(Math.PI / 2);
          return _uvWrapCyl(c, 0.0122, 'z', 0.14);
        }), m.bluedMat);
        slideCrown.position.set(0, 0.007, 0);
        const ejPort = new THREE.Mesh(geoRoundedBox(0.004, 0.010, 0.034, 0.002, 0.0005), m.steelMat);
        ejPort.position.set(0.0115, 0.004, -0.008);
        const safetyLever = new THREE.Mesh(geoRoundedBox(0.005, 0.009, 0.022, 0.002, 0.0006), m.bluedMat);
        safetyLever.position.set(-0.014, 0.004, 0.056);
        const hammer = new THREE.Mesh(geoRoundedBox(0.007, 0.013, 0.015, 0.003, 0.0008), m.steelMat);
        hammer.position.set(0, 0.001, slideLen / 2 + 0.003);
        hammer.rotation.x = 0.35;
        slideGroup.add(slideLower, slideCrown, ejPort, safetyLever, hammer);

        const pmSerGeo = _cachedGeo('pm9_ser_hp', () => _uvWrapBox(new THREE.BoxGeometry(0.0258, 0.013, 0.0018), 0.12));
        for (let s = 0; s < 10; s++) {
          const pmRib = new THREE.Mesh(pmSerGeo, m.darkMat);
          pmRib.position.set(0, -0.001, 0.034 + s * 0.0042);
          slideGroup.add(pmRib);
        }
        slideGroup.position.set(0, 0.006, -0.002);

        const barrelMesh = new THREE.Mesh(
          geoLatheZ('pm9_bbl_hp', [[-0.012, 0.0062], [0.075, 0.0062], [0.084, 0.0065], [0.084, 0.0040]], 24),
          m.magMat
        );
        barrelMesh.position.set(0, 0.007, -0.002);
        const bore = new THREE.Mesh(_cachedGeo('pm9_bore_hp', () => {
          const c = new THREE.CylinderGeometry(0.0044, 0.0044, 0.012, 16);
          c.rotateX(Math.PI / 2);
          return c;
        }), m.boreMat);
        bore.position.set(0, 0.007, -0.082);

        const chamberRd = createCartridgeMesh('pistol', m);
        chamberRd.position.set(0.002, 0.007, -0.008);
        out.chamberRoundMesh = chamberRd;

        out.triggerMesh = _addTriggerAndPins(g, m, 0.012, -0.020, 0.013, null);

        const isExt = mods.magazine === 'ext_mag';
        const pmMagLen = isExt ? 0.118 : 0.094;
        const pistolMag = new THREE.Group();
        const magBody = new THREE.Mesh(geoRoundedBox(0.018, pmMagLen, 0.027, 0.003, 0.0008), m.bluedMat);
        magBody.position.set(0, -(pmMagLen - 0.094) * 0.5, 0);
        const magPlate = new THREE.Mesh(geoRoundedBox(0.024, isExt ? 0.018 : 0.009, 0.036, 0.003, 0.001), isExt ? m.darkMat : m.bluedMat);
        magPlate.position.set(0, -0.050 - (pmMagLen - 0.094), 0);
        const topRd = createCartridgeMesh('pistol', m);
        topRd.position.set(0, 0.049, 0.001);
        pistolMag.add(magBody, magPlate, topRd);
        pistolMag.position.set(0, -0.072, 0.060);
        pistolMag.rotation.x = 0.24;

        out.magMesh = pistolMag;
        out.spareMagMesh = pistolMag.clone();
        out.spareMagMesh.visible = false;
        out.boltMesh = slideGroup;
        out.ironSightTarget = slideGroup;
        out.ironSightOpts = { rearZ: slideLen / 2 - 0.014, frontZ: -slideLen / 2 + 0.012, baseY: 0.017 };
        out.rightHandPos.set(0.0, -0.052, 0.058);
        out.leftHandPos.set(-0.004, -0.060, 0.054);
        out.leftHandStyle = 'supportPistol';
        out.sightHeight = 0.028;
        out.adsZ = -0.32;
        out.muzzlePos.set(0, 0.007, -slideLen / 2 - 0.012);
        out.flashPos.set(0, 0.015, -slideLen / 2 - 0.046);

        g.add(frame, grip, backstrap, gripScrew, starL, starR, lanyardRing, barrelMesh, bore, chamberRd, slideGroup, pistolMag, out.spareMagMesh);
      }
      return out;
    }

    if (id === 'mp5k') {
      // H&K MP5K-PDW / MP5 Compact (325mm OAL stockless / 603mm PDW stocked, 38mm receiver, 115mm barrel + tri-lug)
      const upper = new THREE.Mesh(geoRoundedBox(0.036, 0.032, 0.275, 0.0055, 0.0018, 0.22), m.nitrideMat);
      upper.position.set(0, 0.007, 0.032);
      const upperTop = new THREE.Mesh(_cachedGeo('mp5_top_hp', () => {
        const c = new THREE.CylinderGeometry(0.0158, 0.0158, 0.275, 24);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.0158, 'z', 0.20);
      }), m.nitrideMat);
      upperTop.position.set(0, 0.020, 0.032);
      const fluteL = new THREE.Mesh(geoRoundedBox(0.004, 0.007, 0.255, 0.002, 0.0006), m.bluedMat);
      fluteL.position.set(-0.0185, 0.002, 0.036);
      const fluteR = fluteL.clone();
      fluteR.position.x = 0.0185;

      const ejPort = new THREE.Mesh(geoRoundedBox(0.004, 0.015, 0.052, 0.002, 0.0005), m.boreMat);
      ejPort.position.set(0.0172, 0.010, -0.008);
      const boltCarrier = new THREE.Mesh(geoRoundedBox(0.009, 0.013, 0.050, 0.002, 0.0005), m.chromeMat);
      boltCarrier.position.set(0.0135, 0.010, -0.008);
      out.boltCarrierMesh = boltCarrier;

      const cockingTube = new THREE.Mesh(_cachedGeo('mp5_cock_hp', () => {
        const c = new THREE.CylinderGeometry(0.0132, 0.0132, 0.175, 22);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.0132, 'z', 0.18);
      }), m.nitrideMat);
      cockingTube.position.set(0, 0.021, -0.155);
      const tripleFrame = new THREE.Mesh(geoRoundedBox(0.030, 0.042, 0.018, 0.004, 0.0012), m.bluedMat);
      tripleFrame.position.set(0, 0.012, -0.242);

      // Stepped 115mm cold-hammer-forged barrel + tri-lug shroud (-0.275 muzzle)
      const barrel = new THREE.Mesh(
        geoLatheZ('mp5_bbl_hp', [
          [0.05, 0.0105], [0.22, 0.0096], [0.248, 0.0124], [0.262, 0.0124],
          [0.262, 0.0090], [0.274, 0.0090], [0.274, 0.0045]
        ], 26),
        m.bluedMat
      );
      barrel.position.set(0, 0.001, 0.0);
      barrel.renderOrder = -20;

      // Vented Navy / Tropical ribbed handguard (-0.090 to -0.232, bottom at y = -0.036)
      const hgGeo = geoExtrudeSide('mp5_hg_hp', [
        [0.088, -0.002], [0.232, -0.002], [0.224, -0.024], [0.160, -0.038], [0.088, -0.035]
      ], 0.042, null, true, 0.18);
      const handguard = new THREE.Mesh(hgGeo, m.darkMat);
      const hgPin = new THREE.Mesh(_cachedGeo('mp5_pin_hp', () => {
        const c = new THREE.CylinderGeometry(0.0038, 0.0038, 0.046, 12);
        c.rotateZ(Math.PI / 2);
        return _uvWrapCyl(c, 0.0038, 'x', 0.08);
      }), m.magMat);
      hgPin.position.set(0, 0.004, -0.215);

      const lower = new THREE.Mesh(geoRoundedBox(0.034, 0.026, 0.165, 0.005, 0.0015), m.darkMat);
      lower.position.set(0, -0.019, 0.082);
      const magWell = new THREE.Mesh(geoRoundedBox(0.036, 0.042, 0.054, 0.0045, 0.0015), m.nitrideMat);
      magWell.position.set(0, -0.025, -0.042);
      const paddleRel = new THREE.Mesh(geoRoundedBox(0.013, 0.020, 0.009, 0.0025, 0.0008), m.bluedMat);
      paddleRel.position.set(0, -0.046, -0.012);
      const selector = new THREE.Mesh(geoRoundedBox(0.006, 0.011, 0.024, 0.002, 0.0006), m.magMat);
      selector.position.set(-0.019, -0.020, 0.110);
      selector.rotation.x = 0.25;

      const grip = new THREE.Mesh(geoCurvedGrip(0.029, 0.098, 0.042), m.darkMat);
      grip.position.set(0, -0.072, 0.128);
      grip.rotation.x = 0.28;
      const endCap = new THREE.Mesh(geoRoundedBox(0.040, 0.048, 0.026, 0.006, 0.0018), m.darkMat);
      endCap.position.set(0, 0.002, 0.174);

      if (!mods.stock || mods.stock === 'none') {
        const stRailL = new THREE.Mesh(geoRoundedBox(0.006, 0.0085, 0.22, 0.002, 0.0006), m.magMat);
        stRailL.position.set(-0.018, 0.002, 0.278);
        const stRailR = stRailL.clone();
        stRailR.position.x = 0.018;
        const stPad = new THREE.Mesh(geoRoundedBox(0.036, 0.100, 0.024, 0.007, 0.0022), m.rubberMat);
        stPad.position.set(0, -0.020, 0.388);
        g.add(stRailL, stRailR, stPad);
      }

      const topRail = new THREE.Mesh(geoPicatinnyRail(0.036, -0.068, 0.088, 0.018, 0.012), m.anodizedMat);
      out.triggerMesh = _addTriggerAndPins(g, m, 0.068, -0.038, 0.0195, [[-0.016, 0.160], [-0.016, 0.012], [-0.021, -0.040]]);

      const isExt = mods.magazine === 'ext_mag';
      const mag = new THREE.Group();
      const mp5MagGeo = _cachedGeo(`mp5_mag_hp_${isExt ? 40 : 30}`, () => {
        const magShape = new THREE.Shape();
        const scaleH = isExt ? 1.32 : 1.0;
        magShape.moveTo(-0.018, 0.062);
        magShape.lineTo(0.018, 0.062);
        magShape.bezierCurveTo(0.024, 0.00, 0.040, -0.062 * scaleH, 0.058 * scaleH, -0.125 * scaleH);
        magShape.lineTo(0.022 * scaleH, -0.134 * scaleH);
        magShape.bezierCurveTo(0.004, -0.070 * scaleH, -0.012, -0.008, -0.018, 0.062);
        let geo = new THREE.ExtrudeGeometry(magShape, { depth: 0.023, bevelEnabled: true, bevelThickness: 0.0018, bevelSize: 0.0016, bevelSegments: 2, curveSegments: 14 });
        geo.translate(0, 0, -0.0115);
        geo = _uvWrapExtrude(geo, 0.16);
        geo.rotateY(Math.PI / 2);
        return geo;
      });
      const mp5MagBody = new THREE.Mesh(mp5MagGeo, m.bluedMat);
      const scaleH = isExt ? 1.32 : 1.0;
      const magFloor = new THREE.Mesh(geoRoundedBox(0.028, 0.009, 0.042, 0.003, 0.001), m.nitrideMat);
      magFloor.position.set(0, -0.130 * scaleH, -0.040 * scaleH);
      magFloor.rotation.x = -0.26;
      const topRd = createCartridgeMesh('pistol', m);
      topRd.position.set(0, 0.065, 0);
      mag.add(mp5MagBody, magFloor, topRd);
      mag.position.set(0, -0.095, -0.042);
      mag.rotation.x = -0.06;

      const boltHandle = new THREE.Group();
      const chStem = new THREE.Mesh(geoRoundedBox(0.024, 0.009, 0.011, 0.003, 0.0008), m.magMat);
      const chKnob = new THREE.Mesh(_cachedGeo('mp5_knob_hp', () => {
        const c = new THREE.CylinderGeometry(0.0075, 0.0085, 0.024, 16);
        c.rotateZ(Math.PI / 2);
        return _uvWrapCyl(c, 0.008, 'x', 0.08);
      }), m.darkMat);
      chKnob.position.set(-0.015, 0.006, 0);
      boltHandle.add(chStem, chKnob);
      boltHandle.position.set(-0.020, 0.024, -0.185);

      const chamberRd = createCartridgeMesh('pistol', m);
      chamberRd.position.set(0.004, 0.009, -0.010);
      out.chamberRoundMesh = chamberRd;

      out.magMesh = mag;
      out.spareMagMesh = mag.clone();
      out.spareMagMesh.visible = false;
      out.boltMesh = boltHandle;
      out.rightHandPos.set(0.0, -0.064, 0.128);
      out.leftHandPos.set(0.0, -0.026, -0.165);
      out.sightHeight = 0.044;
      out.adsZ = -0.25;
      out.muzzlePos.set(0, 0.001, -0.275);
      out.flashPos.set(0, 0.01, -0.315);

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
      // Izhmash AK-47 Type 3 / AKM (880mm OAL: +0.465 buttplate to -0.415 muzzle, 415mm barrel)
      const receiver = new THREE.Mesh(geoRoundedBox(0.036, 0.048, 0.34, 0.005, 0.0018, 0.24), m.bluedMat);
      receiver.position.set(0, -0.003, 0.042);
      // Signature milled Type 3 lightening pockets
      const cutL = new THREE.Mesh(geoRoundedBox(0.0025, 0.015, 0.112, 0.001, 0.0004), m.darkMat);
      cutL.position.set(-0.0185, -0.004, 0.032);
      const cutR = cutL.clone();
      cutR.position.x = 0.0185;
      const safety = new THREE.Mesh(geoRoundedBox(0.004, 0.015, 0.145, 0.002, 0.0006), m.steelMat);
      safety.position.set(0.020, -0.003, 0.065);
      safety.rotation.x = 0.06;

      // Top cover + trunnion sight block
      const dustCover = new THREE.Mesh(geoRoundedBox(0.033, 0.019, 0.285, 0.009, 0.0018), m.bluedMat);
      dustCover.position.set(0, 0.026, 0.075);
      const rsBlock = new THREE.Mesh(geoRoundedBox(0.036, 0.024, 0.056, 0.004, 0.0014), m.steelMat);
      rsBlock.position.set(0, 0.023, -0.086);

      // 415mm cold-hammer-forged lathe barrel + AKM slant compensator
      const barrel = new THREE.Mesh(
        geoLatheZ('ak47_bbl_hp', [
          [0.10, 0.0112], [0.28, 0.0096], [0.30, 0.0128], [0.33, 0.0128],
          [0.33, 0.0092], [0.376, 0.0088], [0.376, 0.0108], [0.415, 0.0108], [0.415, 0.0038]
        ], 26),
        m.bluedMat
      );
      barrel.position.set(0, 0.002, 0);
      const slantFace = new THREE.Mesh(_cachedGeo('ak47_slant_hp', () => {
        const c = new THREE.CylinderGeometry(0.0108, 0.0108, 0.004, 22);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.0108, 'z', 0.10);
      }), m.bluedMat);
      slantFace.position.set(0, 0.0045, -0.415);
      slantFace.rotation.x = 0.42;
      const slantPort = new THREE.Mesh(geoRoundedBox(0.008, 0.004, 0.020, 0.001, 0.0004), m.boreMat);
      slantPort.position.set(0, 0.0135, -0.408);
      slantPort.rotation.x = 0.42;
      const cleaningRod = new THREE.Mesh(_cachedGeo('ak47_rod_hp', () => {
        const c = new THREE.CylinderGeometry(0.003, 0.003, 0.25, 12);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.003, 'z', 0.10);
      }), m.magMat);
      cleaningRod.position.set(0, -0.011, -0.295);

      const gasTube = new THREE.Mesh(_cachedGeo('ak_gastube_hp', () => {
        const c = new THREE.CylinderGeometry(0.0105, 0.0105, 0.22, 18);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.0105, 'z', 0.16);
      }), m.bluedMat);
      gasTube.position.set(0, 0.023, -0.22);
      const gasBlock = new THREE.Mesh(geoRoundedBox(0.022, 0.036, 0.036, 0.004, 0.0012), m.bluedMat);
      gasBlock.position.set(0, 0.014, -0.315);
      gasBlock.rotation.x = -0.55;
      const fsbBase = new THREE.Mesh(geoRoundedBox(0.020, 0.040, 0.032, 0.0035, 0.0012), m.bluedMat);
      fsbBase.position.set(0, 0.018, -0.355);
      const bayoLug = new THREE.Mesh(geoRoundedBox(0.008, 0.010, 0.030, 0.002, 0.0006), m.bluedMat);
      bayoLug.position.set(0, -0.006, -0.365);

      // Laminated Russian birch lower handguard (y-min = -0.025) & ventilated upper wood guard
      const hgLower = new THREE.Mesh(geoRoundedBox(0.044, 0.034, 0.195, 0.010, 0.0022, 0.18), m.woodMat);
      hgLower.position.set(0, -0.009, -0.215);
      const hgUpper = new THREE.Mesh(_cachedGeo('ak_hgup_hp', () => {
        const c = new THREE.CylinderGeometry(0.0165, 0.0165, 0.185, 22);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.0165, 'z', 0.18);
      }), m.woodMat);
      hgUpper.position.set(0, 0.023, -0.215);
      const hgFerrule = new THREE.Mesh(geoRoundedBox(0.045, 0.043, 0.014, 0.005, 0.0012), m.bluedMat);
      hgFerrule.position.set(0, 0.004, -0.310);

      const grip = new THREE.Mesh(geoCurvedGrip(0.029, 0.10, 0.043), m.bakeliteMat);
      grip.position.set(0, -0.075, 0.14);
      grip.rotation.x = 0.26;
      const magPaddle = new THREE.Mesh(geoRoundedBox(0.014, 0.020, 0.012, 0.0025, 0.0008), m.bluedMat);
      magPaddle.position.set(0, -0.034, 0.008);

      out.triggerMesh = _addTriggerAndPins(g, m, 0.08, -0.032, 0.0185, [[-0.014, 0.045], [-0.014, 0.088], [0.006, -0.085], [-0.010, -0.095]]);

      if (!mods.stock || mods.stock === 'none') {
        const woodButt = new THREE.Mesh(geoExtrudeSide('ak47_stock_hp', [
          [-0.0, 0.022], [-0.242, -0.012], [-0.242, -0.108], [-0.055, -0.052], [-0.0, -0.024]
        ], 0.034, null, true, 0.24), m.woodMat);
        woodButt.position.set(0, -0.002, 0.215);
        const buttPlate = new THREE.Mesh(geoRoundedBox(0.036, 0.098, 0.012, 0.005, 0.0015), m.bluedMat);
        buttPlate.position.set(0, -0.062, 0.460);
        const tang = new THREE.Mesh(geoRoundedBox(0.032, 0.010, 0.042, 0.003, 0.001), m.steelMat);
        tang.position.set(0, 0.020, 0.232);
        g.add(woodButt, buttPlate, tang);
      }

      // 30rd Ribbed Steel Magazine OR 40rd Russian Bakelite RPK Magazine
      const isExt = mods.magazine === 'ext_mag';
      const magGrp = new THREE.Group();
      const magDepth = 0.0265;
      const magH = isExt ? 0.242 : 0.182;
      const curveFwd = isExt ? 0.132 : 0.095;
      const magThick = 0.052;
      const tipAngle = isExt ? 0.48 : 0.42;
      const rearEndX = magThick * 0.42 + curveFwd - Math.cos(tipAngle) * magThick;
      const rearEndY = 0.048 - magH - Math.sin(tipAngle) * magThick;
      const magGeo = _cachedGeo(`ak47_mag_hp_${isExt ? 'ext' : 'std'}`, () => {
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
        let geo = new THREE.ExtrudeGeometry(shape, { depth: magDepth, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0018, bevelSegments: 2, curveSegments: 14 });
        geo.translate(0, 0, -magDepth * 0.5);
        geo = _uvWrapExtrude(geo, 0.18);
        geo.rotateY(Math.PI / 2);
        return geo;
      });
      const magBody = new THREE.Mesh(magGeo, isExt ? m.bakeliteMat : m.bluedMat);
      const magRib = new THREE.Mesh(geoRoundedBox(0.006, magH * 0.55, 0.010, 0.002, 0.0006), isExt ? m.bakeliteMat : m.magMat);
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
      const carrier = new THREE.Mesh(geoRoundedBox(0.006, 0.014, 0.054, 0.002, 0.0005), m.chromeMat);
      const hookKnob = new THREE.Mesh(geoRoundedBox(0.028, 0.010, 0.012, 0.0025, 0.0006), m.chromeMat);
      hookKnob.position.set(0.013, 0.0, 0.012);
      boltHandle.add(carrier, hookKnob);
      boltHandle.position.set(0.019, 0.014, -0.02);

      const ejSlot = new THREE.Mesh(geoRoundedBox(0.004, 0.013, 0.068, 0.002, 0.0004), m.boreMat);
      ejSlot.position.set(0.0175, 0.013, -0.018);
      const chamberRd = createCartridgeMesh('x39', m);
      chamberRd.position.set(0.009, 0.013, -0.026);
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
      // Remington Model 870 Police Magnum / Trenchgun (978mm OAL, 470mm barrel, 44mm receiver)
      const receiver = new THREE.Mesh(geoRoundedBox(0.044, 0.056, 0.25, 0.011, 0.0022, 0.22), m.steelMat);
      receiver.position.set(0, 0.0, 0.04);
      const ejectionRecess = new THREE.Mesh(geoRoundedBox(0.005, 0.020, 0.072, 0.003, 0.0005), m.boreMat);
      ejectionRecess.position.set(0.0212, 0.009, -0.01);
      const breechBolt = new THREE.Mesh(geoRoundedBox(0.008, 0.018, 0.068, 0.0025, 0.0006), m.chromeMat);
      breechBolt.position.set(0.0175, 0.009, -0.01);
      out.boltCarrierMesh = breechBolt;

      const barrel = new THREE.Mesh(
        geoLatheZ('m870_bbl_hp', [[0.06, 0.0155], [0.20, 0.0142], [0.545, 0.0136], [0.555, 0.0142], [0.555, 0.0092]], 28),
        m.bluedMat
      );
      barrel.position.set(0, 0.014, 0);
      // Perforated steel trench heat shield over upper barrel
      const heatShield = new THREE.Mesh(_cachedGeo('m870_shield_hp', () => {
        const c = new THREE.CylinderGeometry(0.0172, 0.0172, 0.34, 22, 1, true, -Math.PI * 0.45, Math.PI * 0.9);
        c.rotateZ(Math.PI);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.0172, 'z', 0.16);
      }), m.anodizedMat);
      heatShield.position.set(0, 0.015, -0.32);

      const magTube = new THREE.Mesh(_cachedGeo('m870_tube_hp', () => {
        const c = new THREE.CylinderGeometry(0.0128, 0.0128, 0.43, 22);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.0128, 'z', 0.16);
      }), m.steelMat);
      magTube.position.set(0, -0.016, -0.295);
      const bblClamp = new THREE.Mesh(geoRoundedBox(0.026, 0.048, 0.022, 0.005, 0.0014), m.bluedMat);
      bblClamp.position.set(0, -0.001, -0.475);

      // Corncob ribbed American walnut pump forend (twin action bars -> slides cleanly during rechamber)
      const pump = new THREE.Group();
      const pumpCore = new THREE.Mesh(_cachedGeo('m870_pump_hp', () => {
        const c = new THREE.CylinderGeometry(0.022, 0.023, 0.18, 24);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.022, 'z', 0.18);
      }), m.walnutMat);
      pump.add(pumpCore);
      const ringGeo = _cachedGeo('m870_pring_hp', () => {
        const c = new THREE.CylinderGeometry(0.0242, 0.0242, 0.010, 24);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.0242, 'z', 0.12);
      });
      for (let r = -3; r <= 3; r++) {
        const ring = new THREE.Mesh(ringGeo, m.walnutMat);
        ring.position.set(0, 0, r * 0.023);
        pump.add(ring);
      }
      const actionBarL = new THREE.Mesh(geoRoundedBox(0.004, 0.007, 0.16, 0.0015, 0.0004), m.magMat);
      actionBarL.position.set(-0.020, 0.002, 0.14);
      const actionBarR = actionBarL.clone();
      actionBarR.position.x = 0.020;
      pump.add(actionBarL, actionBarR);
      pump.position.set(0, -0.016, -0.24);

      const stockBody = new THREE.Mesh(geoExtrudeSide('m870_stock_hp', [
        [-0.12, -0.002], [-0.12, -0.032], [-0.165, -0.060], [-0.205, -0.062],
        [-0.430, -0.096], [-0.430, 0.004], [-0.22, -0.006]
      ], 0.038, null, true, 0.22), m.walnutMat);
      const stockPad = new THREE.Mesh(geoRoundedBox(0.040, 0.102, 0.022, 0.007, 0.0022), m.rubberMat);
      stockPad.position.set(0, -0.046, 0.440);

      const topRail = new THREE.Mesh(geoPicatinnyRail(0.030, -0.048, 0.088, 0.018, 0.012), m.bluedMat);
      out.triggerMesh = _addTriggerAndPins(g, m, 0.078, -0.028, 0.0225, [[-0.012, 0.038], [-0.012, 0.092]]);

      const shell = new THREE.Group();
      const shellHull = new THREE.Mesh(_cachedGeo('m870_sh_hp', () => {
        const c = new THREE.CylinderGeometry(0.0095, 0.0095, 0.056, 18);
        return _uvWrapCyl(c, 0.0095, 'y', 0.08);
      }), m.shellRedMat);
      const shellBrass = new THREE.Mesh(_cachedGeo('m870_sb_hp', () => {
        const c = new THREE.CylinderGeometry(0.010, 0.010, 0.016, 18);
        return _uvWrapCyl(c, 0.010, 'y', 0.08);
      }), m.brassMat);
      shellBrass.position.set(0, -0.028, 0);
      shell.add(shellHull, shellBrass);
      shell.rotation.x = -Math.PI / 2;
      shell.position.set(0, -0.020, -0.02);

      const chamberRd = createCartridgeMesh('12g', m);
      chamberRd.position.set(0.008, 0.009, -0.012);
      out.chamberRoundMesh = chamberRd;

      out.magMesh = shell;
      out.boltMesh = pump;
      out.rightHandPos.set(0.004, -0.048, 0.160);
      out.rightHandRot.set(0.22, -0.04, 0.06);
      out.rightHandStyle = 'shotgunGrip';
      out.leftHandPos.set(0.0, -0.032, -0.24);
      out.sightHeight = 0.042;
      out.adsZ = -0.26;
      out.muzzlePos.set(0, 0.014, -0.560);
      out.flashPos.set(0, 0.02, -0.600);

      [barrel, heatShield, magTube, bblClamp].forEach((mm) => { mm.renderOrder = -20; });
      g.add(receiver, ejectionRecess, breechBolt, chamberRd, barrel, heatShield, magTube, bblClamp, pump, stockBody, stockPad, topRail, shell);
      return out;
    }

    if (id === 'mosin9130') {
      // Soviet Mosin-Nagant M91/30 (1,232mm OAL: +0.482 butt to -0.750 muzzle, 730mm barrel)
      const stockBody = new THREE.Mesh(geoExtrudeSide('mosin_stock_hp', [
        [0.44, -0.002], [0.44, -0.022], [0.08, -0.034], [-0.08, -0.034],
        [-0.20, -0.056], [-0.470, -0.092], [-0.470, -0.002], [-0.22, -0.010],
        [-0.08, 0.004], [0.06, 0.006]
      ], 0.042, null, true, 0.24), m.woodMat);
      const upperHandguard = new THREE.Mesh(geoRoundedBox(0.034, 0.018, 0.39, 0.007, 0.0018), m.woodMat);
      upperHandguard.position.set(0, 0.016, -0.24);
      const buttPlate = new THREE.Mesh(geoRoundedBox(0.042, 0.092, 0.010, 0.005, 0.0014), m.bluedMat);
      buttPlate.position.set(0, -0.047, 0.476);

      const bandRear = new THREE.Mesh(geoRoundedBox(0.045, 0.046, 0.016, 0.008, 0.0014), m.bluedMat);
      bandRear.position.set(0, 0.002, -0.20);
      const bandFront = new THREE.Mesh(geoRoundedBox(0.044, 0.044, 0.016, 0.008, 0.0014), m.bluedMat);
      bandFront.position.set(0, 0.002, -0.40);
      const cleaningRod = new THREE.Mesh(_cachedGeo('mosin_rod_hp', () => {
        const c = new THREE.CylinderGeometry(0.003, 0.003, 0.56, 12);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.003, 'z', 0.12);
      }), m.magMat);
      cleaningRod.position.set(0, -0.002, -0.485);

      const receiver = new THREE.Mesh(_cachedGeo('mosin_rec_hp', () => {
        const c = new THREE.CylinderGeometry(0.020, 0.020, 0.22, 22);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.020, 'z', 0.18);
      }), m.bluedMat);
      receiver.position.set(0, 0.016, 0.02);
      const barrel = new THREE.Mesh(
        geoLatheZ('mosin_bbl_hp', [[0.06, 0.0135], [0.735, 0.0095], [0.748, 0.0095], [0.748, 0.0040]], 26),
        m.bluedMat
      );
      barrel.position.set(0, 0.016, 0);

      // 5rd integral box OR 10rd WWI steel trench magazine extension
      const isExt = mods.magazine === 'ext_mag';
      const internalMag = new THREE.Mesh(geoRoundedBox(0.026, isExt ? 0.068 : 0.036, 0.096, 0.004, 0.0014), m.bluedMat);
      internalMag.position.set(0, isExt ? -0.058 : -0.044, -0.01);
      out.triggerMesh = _addTriggerAndPins(g, m, 0.08, -0.034, 0.021, null);

      const boltGroup = new THREE.Group();
      const boltBody = new THREE.Mesh(_cachedGeo('mosin_bb_hp', () => {
        const c = new THREE.CylinderGeometry(0.010, 0.010, 0.10, 18);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.010, 'z', 0.10);
      }), m.chromeMat);
      boltBody.position.set(-0.022, 0, 0);
      const boltStem = new THREE.Mesh(geoRoundedBox(0.034, 0.008, 0.009, 0.0025, 0.0006), m.chromeMat);
      const boltKnob = new THREE.Mesh(_cachedGeo('mosin_bk_hp', () => new THREE.SphereGeometry(0.011, 16, 12)), m.chromeMat);
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
      out.muzzlePos.set(0, 0.016, -0.75);
      out.flashPos.set(0, 0.02, -0.79);

      [barrel, cleaningRod, bandFront].forEach((mm) => { mm.renderOrder = -20; });
      g.add(
        stockBody, upperHandguard, buttPlate,
        bandRear, bandFront, cleaningRod, receiver, barrel, internalMag,
        chamberRd, boltGroup, clipGroup
      );
      return out;
    }

    if (id === 'awm338') {
      // Accuracy International AWM / L115A3 (.338 Lapua, 1,270mm OAL: +0.465 butt to -0.805 brake tip, 686mm barrel)
      const hasStockMod = !!(mods.stock && mods.stock !== 'none');
      const chassisPts = hasStockMod
        ? [[0.32, 0.016], [0.32, -0.038], [-0.14, -0.038], [-0.15, -0.105], [-0.19, -0.102], [-0.18, 0.008]]
        : [
            [0.32, 0.016], [0.32, -0.036], [-0.12, -0.036], [-0.14, -0.106],
            [-0.185, -0.104], [-0.455, -0.102], [-0.455, 0.012], [-0.18, 0.010]
          ];
      const thumbHole = hasStockMod ? null : [[[-0.20, -0.018], [-0.30, -0.018], [-0.30, -0.072], [-0.20, -0.072]]];
      const chassis = new THREE.Mesh(geoExtrudeSide(`awm_ch_hp_${hasStockMod ? 1 : 0}`, chassisPts, 0.052, thumbHole, true, 0.24), m.chassisMat);

      const receiver = new THREE.Mesh(geoRoundedBox(0.044, 0.044, 0.27, 0.007, 0.002), m.nitrideMat);
      receiver.position.set(0, 0.018, 0.04);
      const topRail = new THREE.Mesh(geoRoundedBox(0.024, 0.008, 0.25, 0.002, 0.0008), m.anodizedMat);
      topRail.position.set(0, 0.041, 0.02);
      const railTeeth = new THREE.Mesh(geoPicatinnyRail(0.0465, -0.10, 0.14, 0.023, 0.011), m.darkMat);

      if (!hasStockMod) {
        const cheekRest = new THREE.Mesh(geoRoundedBox(0.046, 0.026, 0.14, 0.008, 0.002), m.rubberMat);
        cheekRest.position.set(0, 0.022, 0.30);
        const buttPad = new THREE.Mesh(geoRoundedBox(0.048, 0.114, 0.024, 0.007, 0.0022), m.rubberMat);
        buttPad.position.set(0, -0.044, 0.460);
        g.add(cheekRest, buttPad);
      }

      // 686mm (27") heavy free-floated fluted barrel + AI double-chamber square muzzle brake
      const barrel = new THREE.Mesh(
        geoLatheZ('awm_bbl_hp', [[0.08, 0.0170], [0.22, 0.0155], [0.73, 0.0132], [0.73, 0.0052]], 28),
        m.nitrideMat
      );
      barrel.position.set(0, 0.018, 0);
      const muzzleBrake = new THREE.Mesh(geoRoundedBox(0.034, 0.028, 0.074, 0.0045, 0.0014), m.steelMat);
      muzzleBrake.position.set(0, 0.018, -0.768);
      const portGeo = _cachedGeo('awm_port_hp', () => _uvWrapBox(new THREE.BoxGeometry(0.036, 0.014, 0.011), 0.1));
      for (let b = -1; b <= 1; b++) {
        const port = new THREE.Mesh(portGeo, m.boreMat);
        port.position.set(0, 0.018, -0.768 + b * 0.020);
        g.add(port);
      }

      const bipodMount = new THREE.Mesh(geoRoundedBox(0.046, 0.022, 0.040, 0.004, 0.0012), m.anodizedMat);
      bipodMount.position.set(0, -0.046, -0.28);
      const bipodL = new THREE.Mesh(_cachedGeo('awm_bip_hp', () => {
        const c = new THREE.CylinderGeometry(0.0065, 0.0065, 0.22, 16);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.0065, 'z', 0.12);
      }), m.bluedMat);
      bipodL.position.set(-0.028, -0.046, -0.39);
      const bipodR = bipodL.clone();
      bipodR.position.x = 0.028;

      const isExt = mods.magazine === 'ext_mag';
      const mag = new THREE.Group();
      const magH = isExt ? 0.132 : 0.094;
      const magBody = new THREE.Mesh(geoRoundedBox(0.032, magH, 0.088, 0.004, 0.0012), m.magMat);
      magBody.position.set(0, -(magH - 0.094) * 0.5, 0);
      const magFloor = new THREE.Mesh(geoRoundedBox(0.036, 0.010, 0.092, 0.003, 0.001), m.darkMat);
      magFloor.position.set(0, -0.048 - (magH - 0.094), 0);
      const topRd = createCartridgeMesh('rifle', m);
      topRd.position.set(0, 0.050, 0.012);
      mag.add(magBody, magFloor, topRd);
      mag.position.set(0, -0.074, -0.02);

      out.triggerMesh = _addTriggerAndPins(g, m, 0.095, -0.038, 0.024, [[-0.014, -0.06], [-0.014, 0.08], [-0.014, -0.22]]);

      const boltGroup = new THREE.Group();
      const boltCyl = new THREE.Mesh(_cachedGeo('awm_bcyl_hp', () => {
        const c = new THREE.CylinderGeometry(0.010, 0.010, 0.092, 20);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.010, 'z', 0.10);
      }), m.chromeMat);
      boltCyl.position.set(-0.020, 0.0, 0);
      const boltStem = new THREE.Mesh(geoRoundedBox(0.038, 0.010, 0.011, 0.0025, 0.0006), m.chromeMat);
      const boltKnob = new THREE.Mesh(_cachedGeo('awm_bk_hp', () => new THREE.SphereGeometry(0.0125, 16, 12)), m.darkMat);
      boltKnob.position.set(0.025, -0.005, 0);
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
      out.muzzlePos.set(0, 0.018, -0.805);
      out.flashPos.set(0, 0.02, -0.845);

      [barrel, muzzleBrake].forEach((mm) => { mm.renderOrder = -20; });
      g.add(chassis, receiver, topRail, railTeeth, barrel, muzzleBrake, bipodMount, bipodL, bipodR, chamberRd, mag, out.spareMagMesh, boltGroup);
      return out;
    }

    // Default: Remington M24 SWS (1,092mm OAL: +0.462 buttpad to -0.630 muzzle, 610mm / 24" barrel)
    {
      const hasStockMod = !!(mods.stock && mods.stock !== 'none');
      const m24Pts = hasStockMod
        ? [[0.26, 0.012], [0.26, -0.028], [-0.14, -0.038], [-0.15, -0.106], [-0.19, -0.102], [-0.18, 0.002]]
        : [
            [0.26, 0.012], [0.26, -0.028], [-0.12, -0.038], [-0.14, -0.106],
            [-0.185, -0.102], [-0.21, -0.052], [-0.455, -0.092], [-0.455, 0.010],
            [-0.22, 0.002]
          ];
      const chassis = new THREE.Mesh(geoExtrudeSide(`m24_ch_hp_${hasStockMod ? 1 : 0}`, m24Pts, 0.048, null, true, 0.24), m.darkMat);

      const receiver = new THREE.Mesh(_cachedGeo('m24_rec_hp', () => {
        const c = new THREE.CylinderGeometry(0.021, 0.021, 0.24, 24);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.021, 'z', 0.18);
      }), m.nitrideMat);
      receiver.position.set(0, 0.016, 0.04);
      const topRail = new THREE.Mesh(geoRoundedBox(0.022, 0.007, 0.20, 0.002, 0.0008), m.anodizedMat);
      topRail.position.set(0, 0.038, 0.03);
      const railTeeth = new THREE.Mesh(geoPicatinnyRail(0.043, -0.064, 0.124, 0.021, 0.011), m.darkMat);

      // 610mm (24") 416R heavy free-floated barrel
      const barrel = new THREE.Mesh(
        geoLatheZ('m24_bbl_hp', [[0.08, 0.0148], [0.22, 0.0134], [0.625, 0.0112], [0.628, 0.0112], [0.628, 0.0045]], 26),
        m.nitrideMat
      );
      barrel.position.set(0, 0.016, 0);
      barrel.renderOrder = -20;

      // Harris S-BRM folded bipod under beavertail forend
      const bipBase = new THREE.Mesh(geoRoundedBox(0.036, 0.016, 0.032, 0.004, 0.001), m.anodizedMat);
      bipBase.position.set(0, -0.036, -0.23);
      const bipL = new THREE.Mesh(_cachedGeo('m24_bip_hp', () => {
        const c = new THREE.CylinderGeometry(0.0055, 0.0055, 0.175, 14);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.0055, 'z', 0.10);
      }), m.bluedMat);
      bipL.position.set(-0.022, -0.036, -0.325);
      const bipR = bipL.clone();
      bipR.position.x = 0.022;

      if (!hasStockMod) {
        const m24Cheek = new THREE.Mesh(geoRoundedBox(0.044, 0.020, 0.13, 0.006, 0.002), m.rubberMat);
        m24Cheek.position.set(0, 0.016, 0.34);
        const m24Pad = new THREE.Mesh(geoRoundedBox(0.044, 0.106, 0.020, 0.006, 0.002), m.rubberMat);
        m24Pad.position.set(0, -0.041, 0.462);
        g.add(m24Cheek, m24Pad);
      }

      const isExt = mods.magazine === 'ext_mag';
      const mag = new THREE.Group();
      const magH = isExt ? 0.118 : 0.082;
      const magBody = new THREE.Mesh(geoRoundedBox(0.028, magH, 0.072, 0.003, 0.001), m.magMat);
      magBody.position.set(0, -(magH - 0.082) * 0.5, 0);
      const topRd = createCartridgeMesh('rifle', m);
      topRd.position.set(0, 0.045, 0.010);
      mag.add(magBody, topRd);
      mag.position.set(0, -0.068, -0.02);

      out.triggerMesh = _addTriggerAndPins(g, m, 0.09, -0.034, 0.0225, [[-0.014, -0.04], [-0.014, 0.09]]);

      const boltGroup = new THREE.Group();
      const boltCyl = new THREE.Mesh(_cachedGeo('m24_bcyl_hp', () => {
        const c = new THREE.CylinderGeometry(0.009, 0.009, 0.085, 18);
        c.rotateX(Math.PI / 2);
        return _uvWrapCyl(c, 0.009, 'z', 0.10);
      }), m.chromeMat);
      boltCyl.position.set(-0.020, 0, 0);
      const boltStem = new THREE.Mesh(geoRoundedBox(0.034, 0.009, 0.010, 0.0025, 0.0005), m.chromeMat);
      const boltKnob = new THREE.Mesh(_cachedGeo('m24_bk_hp', () => new THREE.SphereGeometry(0.0115, 16, 12)), m.darkMat);
      boltKnob.position.set(0.022, -0.004, 0);
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
      out.muzzlePos.set(0, 0.016, -0.630);
      out.flashPos.set(0, 0.02, -0.670);

      g.add(chassis, receiver, topRail, railTeeth, barrel, bipBase, bipL, bipR, chamberRd, mag, out.spareMagMesh, boltGroup);
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

  // High-Poly PBR Vehicles & Infrastructure (BTR-80 APC, VAZ Sedan, Mi-8 Helicopter)
  function createVehicleWreck(isAPC = false, mats = {}) {
    const P = window.AshfallPBR;
    const g = new THREE.Group();
    const darkMat = (P && P.getMaterial('steel_dark_structural')) || mats.bossDark || new THREE.MeshStandardMaterial({ color: 0x26292b });
    const oliveMat = (P && P.getMaterial('vehicle_armor_apc')) || mats.rustOlive || new THREE.MeshStandardMaterial({ color: 0x3b4432 });
    const tireMat = (P && P.getMaterial('rubber_tire_tread')) || mats.windowFrame || new THREE.MeshStandardMaterial({ color: 0x181a1c });
    const hubMat = (P && P.getMaterial('steel_brushed')) || mats.metal || new THREE.MeshStandardMaterial({ color: 0x5b6268 });
    const glassMat = (P && P.getGlassMaterial(0x1b2b34, 0.72, 0.12, 0.35)) || mats.windowGlass || darkMat;

    if (isAPC) {
      // High-poly BTR-80 8x8 Sloped-Armor Hull + BPU-1 Turret + Smoke Dischargers + Engine Louvers
      const hullGeo = geoExtrudeSide('btr80_hull_hp', [
        [3.35, 0.92], [3.68, 1.32], [2.45, 1.80], [-2.95, 1.76], [-3.38, 1.48],
        [-3.32, 0.62], [-2.50, 0.52], [2.65, 0.56]
      ], 2.58, null, true, 1.2);
      const hull = new THREE.Mesh(hullGeo, oliveMat);
      const trimVane = new THREE.Mesh(geoRoundedBox(2.24, 0.46, 0.14, 0.04, 0.02, 0.8), darkMat);
      trimVane.position.set(0, 1.18, -3.55);
      trimVane.rotation.x = 0.52;
      const louver = new THREE.Mesh(geoRoundedBox(1.85, 0.08, 1.35, 0.02, 0.01, 0.8), darkMat);
      louver.position.set(0, 1.81, 1.85);
      const portGeo = geoRoundedBox(0.10, 0.32, 0.42, 0.02, 0.01, 0.4);
      for (const side of [-1.29, 1.29]) {
        for (const pz of [-0.6, 0.35]) {
          const hp = new THREE.Mesh(portGeo, darkMat);
          hp.position.set(side, 1.35, pz);
          g.add(hp);
        }
      }

      const turret = new THREE.Mesh(
        _cachedGeo('btr_turret_hp', () => {
          const c = new THREE.CylinderGeometry(0.68, 0.98, 0.60, 24);
          return _uvWrapCyl(c, 0.85, 'y', 0.8);
        }),
        oliveMat
      );
      turret.position.set(0, 2.05, -0.75);
      const cupola = new THREE.Mesh(
        _cachedGeo('btr_cupola_hp', () => _uvWrapCyl(new THREE.CylinderGeometry(0.28, 0.32, 0.16, 18), 0.3, 'y', 0.5)),
        darkMat
      );
      cupola.position.set(0, 2.38, -0.70);
      const mantlet = new THREE.Mesh(geoRoundedBox(0.56, 0.34, 0.50, 0.05, 0.02, 0.5), darkMat);
      mantlet.position.set(0, 2.06, -1.48);
      const barrel = new THREE.Mesh(
        geoLatheZ('btr_kpvt_hp', [[0, 0.068], [1.9, 0.044], [2.25, 0.044], [2.32, 0.056], [2.32, 0.022]], 20),
        darkMat
      );
      barrel.position.set(0, 2.08, -1.52);
      const coax = new THREE.Mesh(
        geoLatheZ('btr_coax_hp', [[0, 0.022], [1.15, 0.016], [1.15, 0.008]], 14),
        darkMat
      );
      coax.position.set(0.16, 2.04, -1.52);
      // 902V "Tucha" smoke grenade discharger tubes on turret cheeks
      const smkGeo = _cachedGeo('btr_smk_hp', () => {
        const c = new THREE.CylinderGeometry(0.042, 0.042, 0.24, 12);
        c.rotateX(Math.PI / 2.6);
        return _uvWrapCyl(c, 0.042, 'y', 0.2);
      });
      for (const sx of [-1, 1]) {
        for (let t = 0; t < 3; t++) {
          const tube = new THREE.Mesh(smkGeo, darkMat);
          tube.position.set(sx * (0.72 + t * 0.09), 1.98, -0.58 - t * 0.12);
          tube.rotation.y = sx * -0.45;
          g.add(tube);
        }
      }
      g.add(hull, trimVane, louver, turret, cupola, mantlet, barrel, coax);

      const tireGeo = _cachedGeo('btr_tire_hp', () => {
        const c = new THREE.CylinderGeometry(0.49, 0.49, 0.36, 24);
        c.rotateZ(Math.PI / 2);
        return _uvWrapCyl(c, 0.49, 'x', 0.45);
      });
      const rimGeo = _cachedGeo('btr_rim_hp', () => {
        const c = new THREE.CylinderGeometry(0.28, 0.28, 0.38, 18);
        c.rotateZ(Math.PI / 2);
        return _uvWrapCyl(c, 0.28, 'x', 0.3);
      });
      const hubGeo = _cachedGeo('btr_hub_hp', () => {
        const c = new THREE.CylinderGeometry(0.14, 0.14, 0.41, 14);
        c.rotateZ(Math.PI / 2);
        return _uvWrapCyl(c, 0.14, 'x', 0.2);
      });
      for (const wz of [-2.25, -0.78, 0.78, 2.25]) {
        for (const wx of [-1.32, 1.32]) {
          const wh = new THREE.Mesh(tireGeo, tireMat);
          wh.position.set(wx, 0.49, wz);
          const rm = new THREE.Mesh(rimGeo, oliveMat);
          rm.position.set(wx, 0.49, wz);
          const hb = new THREE.Mesh(hubGeo, hubMat);
          hb.position.set(wx, 0.49, wz);
          g.add(wh, rm, hb);
        }
      }
      return g;
    }

    // High-Poly VAZ-2105 / Russian Sedan
    const paintCol = Math.random() < 0.5 ? 0x8f4338 : 0x3b5872;
    const paintMat = (P && P.getMaterial('vehicle_paint_sedan', { color: paintCol })) || mats.rustRed || oliveMat;
    const carGeo = geoExtrudeSide('car_body_hp', [
      [2.16, 0.32], [2.16, 0.78], [1.06, 0.94], [0.54, 1.48],
      [-0.86, 1.48], [-1.36, 0.96], [-2.12, 0.90], [-2.12, 0.32]
    ], 1.84, null, true, 1.0);
    const body = new THREE.Mesh(carGeo, paintMat);
    const windshield = new THREE.Mesh(geoRoundedBox(1.52, 0.48, 0.76, 0.04, 0.02, 0.8), glassMat);
    windshield.position.set(0, 1.18, -0.78);
    windshield.rotation.x = 0.68;
    const rearGlass = new THREE.Mesh(geoRoundedBox(1.50, 0.46, 0.72, 0.04, 0.02, 0.8), glassMat);
    rearGlass.position.set(0, 1.19, 0.98);
    rearGlass.rotation.x = -0.74;
    const sideGlass = new THREE.Mesh(geoRoundedBox(1.88, 0.40, 1.24, 0.02, 0.01, 0.8), glassMat);
    sideGlass.position.set(0, 1.18, 0.12);
    const grille = new THREE.Mesh(geoRoundedBox(1.42, 0.24, 0.08, 0.02, 0.01), darkMat);
    grille.position.set(0, 0.64, -2.12);
    const headlightGeo = geoRoundedBox(0.24, 0.16, 0.06, 0.02, 0.01);
    const hlL = new THREE.Mesh(headlightGeo, hubMat); hlL.position.set(-0.68, 0.64, -2.14);
    const hlR = new THREE.Mesh(headlightGeo, hubMat); hlR.position.set(0.68, 0.64, -2.14);
    const bumperF = new THREE.Mesh(geoRoundedBox(1.88, 0.16, 0.16, 0.03, 0.01), tireMat);
    bumperF.position.set(0, 0.38, -2.16);
    const bumperR = bumperF.clone();
    bumperR.position.z = 2.14;
    g.add(body, windshield, rearGlass, sideGlass, grille, hlL, hlR, bumperF, bumperR);

    const cTireGeo = _cachedGeo('car_tire_hp', () => {
      const c = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 22);
      c.rotateZ(Math.PI / 2);
      return _uvWrapCyl(c, 0.34, 'x', 0.38);
    });
    const cHubGeo = _cachedGeo('car_hub_hp', () => {
      const c = new THREE.CylinderGeometry(0.20, 0.20, 0.26, 16);
      c.rotateZ(Math.PI / 2);
      return _uvWrapCyl(c, 0.20, 'x', 0.25);
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
    const P = window.AshfallPBR;
    const g = new THREE.Group();
    const oliveMat = (P && P.getMaterial('vehicle_armor_apc')) || mats.rustOlive || new THREE.MeshStandardMaterial({ color: 0x3b4432 });
    const darkMat = (P && P.getMaterial('steel_dark_structural')) || mats.bossDark || new THREE.MeshStandardMaterial({ color: 0x222628 });
    const glassMat = (P && P.getGlassMaterial(0x1a2d3a, 0.65, 0.08, 0.35)) || mats.windowGlass || darkMat;
    const metalMat = (P && P.getMaterial('steel_brushed')) || mats.metal || new THREE.MeshStandardMaterial({ color: 0x5c646c });
    const tireMat = (P && P.getMaterial('rubber_tire_tread')) || darkMat;

    const fuseGeo = geoExtrudeSide('helo_fuse_hp', [
      [4.2, 0.25], [5.45, 0.68], [4.55, 1.58], [2.45, 2.38],
      [-2.85, 2.38], [-4.25, 1.48], [-4.25, 0.35], [-2.55, 0.22]
    ], 2.75, null, true, 1.5);
    const fuse = new THREE.Mesh(fuseGeo, oliveMat);
    const noseDome = new THREE.Mesh(_cachedGeo('helo_nose_hp', () => {
      const s = new THREE.SphereGeometry(1.18, 22, 16);
      s.scale(1.05, 0.78, 1.15);
      return _uvWrapCyl(s, 1.18, 'z', 1.0);
    }), oliveMat);
    noseDome.position.set(0, 0.85, -4.35);
    const glass = new THREE.Mesh(geoRoundedBox(2.15, 0.86, 1.75, 0.14, 0.04, 1.0), glassMat);
    glass.position.set(0, 1.48, -4.32);
    glass.rotation.x = 0.55;
    const podL = new THREE.Mesh(geoRoundedBox(0.58, 0.66, 2.55, 0.14, 0.03, 0.9), darkMat);
    podL.position.set(-1.58, 0.95, -0.5);
    const podR = podL.clone();
    podR.position.x = 1.58;
    const engineDeck = new THREE.Mesh(geoRoundedBox(1.56, 0.70, 3.3, 0.16, 0.04, 1.0), darkMat);
    engineDeck.position.set(0, 2.58, -0.2);

    // Twin turbine exhaust nacelles
    const exhGeo = _cachedGeo('helo_exh_hp', () => {
      const c = new THREE.CylinderGeometry(0.24, 0.28, 0.65, 18);
      c.rotateX(Math.PI / 2);
      return _uvWrapCyl(c, 0.26, 'z', 0.4);
    });
    for (const sx of [-0.46, 0.46]) {
      const exh = new THREE.Mesh(exhGeo, metalMat);
      exh.position.set(sx, 2.68, 1.55);
      g.add(exh);
    }

    const boom = new THREE.Mesh(geoExtrudeSide('helo_boom_hp', [
      [0.0, 2.18], [-6.25, 1.98], [-7.45, 3.40], [-8.05, 3.40], [-7.35, 1.58], [0.0, 1.38]
    ], 0.72, null, true, 1.2), oliveMat);
    boom.position.set(0.35, 0, 3.6);
    boom.rotation.y = 0.22;

    const hStab = new THREE.Mesh(geoRoundedBox(3.1, 0.12, 0.72, 0.04, 0.02), oliveMat);
    hStab.position.set(-0.95, 1.85, 8.85);
    hStab.rotation.y = 0.22;

    const mast = new THREE.Mesh(_cachedGeo('helo_mast_hp', () => _uvWrapCyl(new THREE.CylinderGeometry(0.24, 0.30, 1.05, 20), 0.27, 'y', 0.4)), metalMat);
    mast.position.set(0, 3.16, -0.2);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(geoRoundedBox(5.6, 0.055, 0.36, 0.02, 0.01), darkMat);
      const ang = (b / 4) * Math.PI * 2 + 0.35;
      blade.position.set(Math.cos(ang) * 2.8, 3.54, -0.2 + Math.sin(ang) * 2.8);
      blade.rotation.y = -ang;
      blade.rotation.z = 0.06;
      g.add(blade);
    }
    const wheelGeo = _cachedGeo('helo_wheel_hp', () => {
      const c = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 18);
      c.rotateZ(Math.PI / 2);
      return _uvWrapCyl(c, 0.32, 'x', 0.3);
    });
    for (const [wx, wz] of [[-1.35, 0.9], [1.35, 0.9], [0, -3.55]]) {
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.position.set(wx, 0.32, wz);
      g.add(w);
    }

    g.add(fuse, noseDome, glass, podL, podR, engineDeck, boom, hStab, mast);
    return g;
  }

  function createFloodlightTower(height = 10.5, bulbColor = 0xfff0cc, doubleHead = true) {
    const P = window.AshfallPBR;
    const g = new THREE.Group();
    const metalMat = (P && P.getMaterial('steel_dark_structural')) || _matCache.ft_metal || (_matCache.ft_metal = new THREE.MeshStandardMaterial({ color: 0x383e44 }));
    const housingMat = (P && P.getMaterial('aluminum_anodized')) || _matCache.ft_house || (_matCache.ft_house = new THREE.MeshStandardMaterial({ color: 0x202428 }));
    const lKey = `ft_lens_${bulbColor}`;
    const lensMat = _matCache[lKey] || (_matCache[lKey] = _markShared(new THREE.MeshBasicMaterial({ color: bulbColor })));

    const pole = new THREE.Mesh(_cachedGeo(`ft_pole_hp_${height.toFixed(1)}`, () => _uvWrapCyl(new THREE.CylinderGeometry(0.14, 0.26, height, 14), 0.2, 'y', 0.8)), metalMat);
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

      ctx.globalAlpha = Math.min(0.92, intensity * 0.85);
      const sbSize = basePx * 1.45;
      ctx.drawImage(starburstSprite, sx - sbSize * 0.5, sy - sbSize * 0.5, sbSize, sbSize);

      if (src.anamorphic !== false) {
        const stW = basePx * 3.8;
        const stH = basePx * 0.36;
        ctx.globalAlpha = Math.min(0.75, intensity * 0.62);
        ctx.drawImage(streakSprite, sx - stW * 0.5, sy - stH * 0.5, stW, stH);
      }

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
