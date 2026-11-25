// ============================================================================
// ASHFALL // Extruded Architectural Building Geometry Engine
// Real ExtrudeGeometry punched walls, arched portals, recessed window frames,
// stone sills & lintels, pilasters, stepped cornices, balconies, rooftop HVAC
// and interactive motorized rooftop ascenders — 100% batched & collider-exact!
// ============================================================================
window.AshfallArchitecture = (() => {
  const _geoCache = new Map();
  const _tmpMat4 = new THREE.Matrix4();
  const _tmpPos = new THREE.Vector3();
  const _tmpQuat = new THREE.Quaternion();
  const _tmpEuler = new THREE.Euler();
  const _tmpScale = new THREE.Vector3(1, 1, 1);

  function _cachedGeo(key, factoryFn) {
    if (_geoCache.has(key)) return _geoCache.get(key);
    const geo = factoryFn();
    if (geo) {
      if (!geo.userData) geo.userData = {};
      geo.userData._ashShared = true;
    }
    _geoCache.set(key, geo);
    return geo;
  }

  function pushBatchedGeo(world, geo, mat, matrix, castShadow = true) {
    if (!world || !geo || !mat) return null;
    if (world._batchingOpen && world._batchEntries) {
      world._batchEntries.push({
        geometry: geo,
        matrix: matrix.clone(),
        material: mat,
        castShadow: !!castShadow,
        source: null,
        disposeAfterBatch: false
      });
      return null;
    }
    const m = new THREE.Mesh(geo, mat);
    m.matrix.copy(matrix);
    m.matrix.decompose(m.position, m.quaternion, m.scale);
    m.castShadow = !!castShadow;
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    world.scene.add(m);
    return m;
  }

  function _registerAABB(world, x, y, z, w, h, d, material) {
    world.colliders.push({
      minX: x - w * 0.5,
      maxX: x + w * 0.5,
      minY: y - h * 0.5,
      maxY: y + h * 0.5,
      minZ: z - d * 0.5,
      maxZ: z + d * 0.5
    });
    const aabb = {
      isAABB: true,
      material,
      position: new THREE.Vector3(x, y, z),
      _bbMinX: x - w * 0.5, _bbMaxX: x + w * 0.5,
      _bbMinY: y - h * 0.5, _bbMaxY: y + h * 0.5,
      _bbMinZ: z - d * 0.5, _bbMaxZ: z + d * 0.5
    };
    world.shootableMeshes.push(aabb);
    world.wallMeshes.push(aabb);
  }

  function _buildPunchedWallGeo(len, h, thick, openings, tile = 2.6, bevel = true) {
    const oKey = openings.map(o =>
      `${o.u0.toFixed(2)}:${o.u1.toFixed(2)}:${o.v0.toFixed(2)}:${o.v1.toFixed(2)}:${o.arched ? 1 : 0}`
    ).join('|');
    const key = `pw:${len.toFixed(2)}:${h.toFixed(2)}:${thick.toFixed(2)}:${tile.toFixed(2)}:${bevel ? 1 : 0}:${oKey}`;
    return _cachedGeo(key, () => {
      const sh = new THREE.Shape();
      const hl = len * 0.5;
      sh.moveTo(-hl, 0);
      sh.lineTo(hl, 0);
      sh.lineTo(hl, h);
      sh.lineTo(-hl, h);
      sh.closePath();

      for (let i = 0; i < openings.length; i++) {
        const o = openings[i];
        const x0 = Math.max(-hl + 0.12, o.u0 - hl);
        const x1 = Math.min(hl - 0.12, o.u1 - hl);
        const y0 = Math.max(0.0, o.v0);
        const y1 = Math.min(h - 0.10, o.v1);
        if (x1 - x0 < 0.25 || y1 - y0 < 0.25) continue;

        const hole = new THREE.Path();
        if (o.arched) {
          const rx = (x1 - x0) * 0.5;
          const archR = Math.min(rx, (y1 - y0) * 0.46);
          const springY = y1 - archR;
          const cx = (x0 + x1) * 0.5;
          hole.moveTo(x0, y0);
          hole.lineTo(x1, y0);
          hole.lineTo(x1, springY);
          if (Math.abs(rx - archR) < 0.08) {
            hole.absarc(cx, springY, rx, 0, Math.PI, false);
          } else {
            hole.quadraticCurveTo(x1, y1, cx, y1);
            hole.quadraticCurveTo(x0, y1, x0, springY);
          }
          hole.lineTo(x0, y0);
        } else {
          hole.moveTo(x0, y0);
          hole.lineTo(x1, y0);
          hole.lineTo(x1, y1);
          hole.lineTo(x0, y1);
          hole.closePath();
        }
        sh.holes.push(hole);
      }

      const bevT = bevel ? Math.min(0.024, thick * 0.10) : 0;
      let geo = new THREE.ExtrudeGeometry(sh, {
        depth: Math.max(0.06, thick - bevT * 2),
        bevelEnabled: bevT > 0.004,
        bevelThickness: bevT,
        bevelSize: bevT * 0.85,
        bevelSegments: 2,
        curveSegments: 8
      });
      geo.translate(0, 0, -(thick - bevT * 2) * 0.5);
      if (window.AshfallPBR && window.AshfallPBR.UVUnwrap) {
        geo = window.AshfallPBR.UVUnwrap.unwrapExtrude(geo, tile);
      } else if (geo.attributes && geo.attributes.uv && !geo.attributes.uv2) {
        geo.setAttribute('uv2', geo.attributes.uv);
      }
      geo.computeVertexNormals();
      return geo;
    });
  }

  /**
   * Build an extruded axis-aligned masonry/precast wall with punched openings,
   * exact physics/bullet AABBs around every hole, sills, lintels & mullions.
   */
  function addPunchedWall(world, x1, z1, x2, z2, yBot, height, thick, wallMat, trimMat, openings = [], opts = {}) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.25) return;
    const horiz = Math.abs(dx) >= Math.abs(dz);
    const angle = Math.atan2(-dz, dx);
    const cx = (x1 + x2) * 0.5;
    const cz = (z1 + z2) * 0.5;
    const tile = (wallMat && wallMat.userData && wallMat.userData.tile) || 2.8;
    const sorted = [...openings].sort((a, b) => a.u0 - b.u0);

    // 1. Visual ExtrudeGeometry with real punched openings + beveled reveals
    const wallGeo = _buildPunchedWallGeo(len, height, thick, sorted, tile, opts.bevel !== false);
    _tmpPos.set(cx, yBot, cz);
    _tmpEuler.set(0, angle, 0);
    _tmpQuat.setFromEuler(_tmpEuler);
    _tmpScale.set(1, 1, 1);
    _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
    pushBatchedGeo(world, wallGeo, wallMat, _tmpMat4, true);

    // 2. Exact segmented colliders & bullet AABBs around every window/door opening (axis-aligned fast path)
    const dirX = dx / len;
    const dirZ = dz / len;
    const outX = -dirZ;
    const outZ = dirX;
    let curU = 0;

    const addSegAABB = (uStart, uEnd, y0, y1) => {
      const segL = uEnd - uStart;
      const segH = y1 - y0;
      if (segL < 0.08 || segH < 0.08) return;
      const uMid = (uStart + uEnd) * 0.5;
      const wx = x1 + dirX * uMid;
      const wz = z1 + dirZ * uMid;
      const wy = yBot + (y0 + y1) * 0.5;
      const bw = horiz ? segL : thick;
      const bd = horiz ? thick : segL;
      _registerAABB(world, wx, wy, wz, bw, segH, bd, wallMat);
    };

    const mats = world._materials || {};
    const sillMat = trimMat || mats.darkConcrete || wallMat;
    const frameMat = mats.windowFrame || sillMat;
    const glassMat = world._winGlassDouble || (world._winGlassDouble = (() => {
      if (!mats.windowGlass) return null;
      const g = mats.windowGlass.clone();
      g.side = THREE.DoubleSide;
      return g;
    })());

    for (let i = 0; i < sorted.length; i++) {
      const o = sorted[i];
      if (o.u0 > curU + 0.06) {
        addSegAABB(curU, o.u0, 0, height);
      }
      // Solid sill pier below & lintel header above the opening
      if (o.v0 > 0.06) addSegAABB(o.u0, o.u1, 0, o.v0);
      if (height - o.v1 > 0.06) addSegAABB(o.u0, o.u1, o.v1, height);

      const ow = o.u1 - o.u0;
      const oh = o.v1 - o.v0;
      const uMid = (o.u0 + o.u1) * 0.5;
      const wx = x1 + dirX * uMid;
      const wz = z1 + dirZ * uMid;
      const rotWall = horiz ? 0 : Math.PI / 2;

      if (o.kind === 'door') {
        const doorH = Math.min(2.62, oh);
        const doorSideSign = opts.outwardSign || 1;
        if (o.doorStyle) {
          world._addDoor(wx, yBot + Math.max(0.08, o.v0), wz, ow, doorH, rotWall, o.label || 'Entrance Door', o.doorStyle);
        }
        // Projected stone surround & entry lintel hood
        const hoodW = ow + 0.44;
        world._addDecor(wx, yBot + o.v1 + 0.09, wz, horiz ? hoodW : thick + 0.24, 0.18, horiz ? thick + 0.24 : hoodW, sillMat);
        if (o.canopy) {
          const cxC = wx + outX * doorSideSign * 0.85;
          const czC = wz + outZ * doorSideSign * 0.85;
          world._addDecor(cxC, yBot + o.v1 + 0.22, czC, horiz ? ow + 1.2 : 1.5, 0.14, horiz ? 1.5 : ow + 1.2, mats.metal || frameMat);
        }
      } else if (o.kind === 'window') {
        const wy = yBot + (o.v0 + o.v1) * 0.5;
        // Projected window sill & lintel
        world._addDecor(wx, yBot + o.v0 - 0.06, wz, horiz ? ow + 0.32 : thick + 0.24, 0.12, horiz ? thick + 0.24 : ow + 0.32, sillMat);
        world._addDecor(wx, yBot + o.v1 + 0.07, wz, horiz ? ow + 0.28 : thick + 0.20, 0.14, horiz ? thick + 0.20 : ow + 0.28, sillMat);
        // Perimeter anodized aluminum jamb & mullions
        const off = ow * 0.5 - 0.05;
        world._addDecor(wx - dirX * off, wy, wz - dirZ * off, horiz ? 0.10 : thick + 0.06, oh, horiz ? thick + 0.06 : 0.10, frameMat);
        world._addDecor(wx + dirX * off, wy, wz + dirZ * off, horiz ? 0.10 : thick + 0.06, oh, horiz ? thick + 0.06 : 0.10, frameMat);
        world._addDecor(wx, wy, wz, horiz ? 0.07 : thick + 0.04, oh, horiz ? thick + 0.04 : 0.07, frameMat);
        world._addDecor(wx, wy + oh * 0.15, wz, horiz ? ow : thick + 0.04, 0.07, horiz ? thick + 0.04 : ow, frameMat);
        if (glassMat && !o.open) {
          world._addDecor(wx, wy, wz, horiz ? ow * 0.92 : 0.06, oh * 0.92, horiz ? 0.06 : ow * 0.92, glassMat);
        }
      }
      curU = Math.max(curU, o.u1);
    }
    if (curU < len - 0.06) {
      addSegAABB(curU, len, 0, height);
    }
  }

  function addCorniceAndParapet(world, cx, cz, w, d, yTop, parapetH = 0.95, corniceMat = null, wallMat = null, opts = {}) {
    const mats = world._materials || {};
    const cMat = corniceMat || mats.travertine || mats.concrete;
    const pMat = wallMat || mats.concrete;
    // Two-stepped architectural cornice
    world._addDecor(cx, yTop - 0.18, cz, w + 0.65, 0.22, d + 0.65, cMat);
    world._addDecor(cx, yTop + 0.02, cz, w + 0.88, 0.18, d + 0.88, cMat);

    if (parapetH <= 0.05) return;
    const pT = 0.34;
    const skipNorth = !!opts.skipNorth;
    const skipSouth = !!opts.skipSouth;
    const skipWest = !!opts.skipWest;
    const skipEast = !!opts.skipEast;

    if (!skipNorth) {
      world._addBox(cx, yTop + parapetH * 0.5, cz - d * 0.5, w + 0.25, parapetH, pT, pMat, true);
      world._addDecor(cx, yTop + parapetH + 0.04, cz - d * 0.5, w + 0.42, 0.09, pT + 0.12, cMat);
    }
    if (!skipSouth) {
      world._addBox(cx, yTop + parapetH * 0.5, cz + d * 0.5, w + 0.25, parapetH, pT, pMat, true);
      world._addDecor(cx, yTop + parapetH + 0.04, cz + d * 0.5, w + 0.42, 0.09, pT + 0.12, cMat);
    }
    if (!skipWest) {
      world._addBox(cx - w * 0.5, yTop + parapetH * 0.5, cz, pT, parapetH, Math.max(0.5, d - 0.2), pMat, true);
      world._addDecor(cx - w * 0.5, yTop + parapetH + 0.04, cz, pT + 0.12, 0.09, d + 0.2, cMat);
    }
    if (!skipEast) {
      world._addBox(cx + w * 0.5, yTop + parapetH * 0.5, cz, pT, parapetH, Math.max(0.5, d - 0.2), pMat, true);
      world._addDecor(cx + w * 0.5, yTop + parapetH + 0.04, cz, pT + 0.12, 0.09, d + 0.2, cMat);
    }
  }

  function addPilasterGrid(world, cx, cz, w, d, yBot, h, spacing = 5.5, pilMat = null) {
    const mats = world._materials || {};
    const m = pilMat || mats.darkConcrete || mats.concrete;
    // Corner quoins / structural piers
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        world._addDecor(cx + sx * (w * 0.5), yBot + h * 0.5, cz + sz * (d * 0.5), 0.72, h, 0.72, m);
      }
    }
    const nx = Math.max(0, Math.floor(w / spacing) - 1);
    for (let i = 1; i <= nx; i++) {
      const px = cx - w * 0.5 + (w * i) / (nx + 1);
      world._addDecor(px, yBot + h * 0.5, cz - d * 0.5 - 0.14, 0.44, h, 0.24, m);
      world._addDecor(px, yBot + h * 0.5, cz + d * 0.5 + 0.14, 0.44, h, 0.24, m);
    }
    const nz = Math.max(0, Math.floor(d / spacing) - 1);
    for (let i = 1; i <= nz; i++) {
      const pz = cz - d * 0.5 + (d * i) / (nz + 1);
      world._addDecor(cx - w * 0.5 - 0.14, yBot + h * 0.5, pz, 0.24, h, 0.44, m);
      world._addDecor(cx + w * 0.5 + 0.14, yBot + h * 0.5, pz, 0.24, h, 0.44, m);
    }
  }

  function addCantileverBalcony(world, cx, yFloor, cz, span, depth, facing = 'south', slabMat = null, railMat = null) {
    const mats = world._materials || {};
    const sMat = slabMat || mats.travertine || mats.concrete;
    const rMat = railMat || mats.metal || mats.windowFrame;
    const horiz = (facing === 'south' || facing === 'north');
    const bw = horiz ? span : depth;
    const bd = horiz ? depth : span;
    // Walkable balcony deck slab
    world._addBox(cx, yFloor - 0.12, cz, bw, 0.24, bd, sMat, true);
    // Underside corbel support ribs
    for (const f of [-0.36, 0, 0.36]) {
      const rx = horiz ? cx + span * f : cx;
      const rz = horiz ? cz : cz + span * f;
      world._addDecor(rx, yFloor - 0.34, rz, horiz ? 0.22 : depth * 0.85, 0.22, horiz ? depth * 0.85 : 0.22, sMat);
    }
    // 3-sided tubular steel safety railing
    const rH = 1.0;
    if (facing === 'south' || facing === 'north') {
      const outerZ = cz + (facing === 'south' ? depth * 0.5 - 0.08 : -depth * 0.5 + 0.08);
      world._addBox(cx, yFloor + rH - 0.06, outerZ, span, 0.09, 0.09, rMat, true);
      world._addBox(cx, yFloor + rH * 0.46, outerZ, span, 0.72, 0.06, rMat, false);
      world._addBox(cx - span * 0.5 + 0.08, yFloor + rH * 0.5, cz, 0.09, rH, depth, rMat, true);
      world._addBox(cx + span * 0.5 - 0.08, yFloor + rH * 0.5, cz, 0.09, rH, depth, rMat, true);
    } else {
      const outerX = cx + (facing === 'east' ? depth * 0.5 - 0.08 : -depth * 0.5 + 0.08);
      world._addBox(outerX, yFloor + rH - 0.06, cz, 0.09, 0.09, span, rMat, true);
      world._addBox(outerX, yFloor + rH * 0.46, cz, 0.06, 0.72, span, rMat, false);
      world._addBox(cx, yFloor + rH * 0.5, cz - span * 0.5 + 0.08, depth, rH, 0.09, rMat, true);
      world._addBox(cx, yFloor + rH * 0.5, cz + span * 0.5 - 0.08, depth, rH, 0.09, rMat, true);
    }
  }

  function addRooftopMechanical(world, cx, yRoof, cz, w, d, seed = 1) {
    const mats = world._materials || {};
    const mMat = mats.metal || mats.windowFrame;
    const fMat = mats.windowFrame || mMat;
    const dMat = mats.darkConcrete || mats.concrete;
    const rng = world._rng ? world._rng(seed) : Math.random;

    const spanX = Math.max(0.8, w * 0.5 - 2.4);
    const spanZ = Math.max(0.8, d * 0.5 - 2.4);
    if (!world._acFanGeo) world._acFanGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.09, 14);
    const units = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < units; i++) {
      const ux = cx + (rng() * 2 - 1) * spanX * 0.85;
      const uz = cz + (rng() * 2 - 1) * spanZ * 0.85;
      world._addBox(ux, yRoof + 0.52, uz, 1.85, 1.04, 1.15, mMat, true);
      // Duct elbow
      world._addDecor(ux + 1.15, yRoof + 0.36, uz, 0.65, 0.42, 0.42, mMat);
      for (const fx of [-0.46, 0.46]) {
        _tmpPos.set(ux + fx, yRoof + 1.08, uz);
        _tmpQuat.identity();
        _tmpScale.set(1, 1, 1);
        _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
        pushBatchedGeo(world, world._acFanGeo, fMat, _tmpMat4, false);
      }
    }
    // Roof bulkhead hatch + exhaust pipe
    const bx = cx - spanX * 0.55;
    const bz = cz - spanZ * 0.55;
    world._addBox(bx, yRoof + 0.28, bz, 1.25, 0.56, 1.25, dMat, true);
    world._addDecor(bx + 1.4, yRoof + 0.72, bz, 0.22, 1.44, 0.22, mMat);
    world._addDecor(bx + 1.4, yRoof + 1.46, bz, 0.42, 0.12, 0.42, fMat);
  }

  function addAscenderRig(world, opts = {}) {
    const mats = world._materials || {};
    const frameMat = mats.hazardAmber || mats.metal;
    const steelMat = mats.metal || mats.darkConcrete;
    const bx = opts.bx;
    const bz = opts.bz;
    const bY = opts.bottomY !== undefined ? opts.bottomY : world.getTerrainHeight(bx, bz);
    const tY = opts.topY;
    const cableH = Math.max(2.0, tY - bY + 1.4);
    const outX = opts.outX || 0;
    const outZ = opts.outZ || 1;
    const lenO = Math.hypot(outX, outZ) || 1;
    const ux = outX / lenO;
    const uz = outZ / lenO;

    // Ground anchor bollard & yellow carabiner pad
    world._addBox(bx, bY + 0.55, bz, 0.42, 1.10, 0.42, frameMat, true);
    world._addDecor(bx, bY + 1.16, bz, 0.56, 0.14, 0.56, steelMat);

    // Rooftop steel davit arm & motorized winch drum anchored inside roof edge
    world._addDecor(bx - ux * 0.9, tY + 1.25, bz - uz * 0.9, 0.26, 2.5, 0.26, frameMat);
    world._addDecor(bx - ux * 0.45, tY + 2.38, bz - uz * 0.45, Math.abs(ux) > 0.5 ? 1.4 : 0.28, 0.24, Math.abs(uz) > 0.5 ? 1.4 : 0.28, frameMat);
    world._addDecor(bx - ux * 0.6, tY + 0.55, bz - uz * 0.6, 0.58, 0.58, 0.58, steelMat);

    // Taut vertical high-tensile steel rappel cable + glowing yellow marker tags at top & bottom
    const cableGeo = _cachedGeo(`asc_cable_${Math.round(cableH * 10)}`, () => {
      const g = new THREE.CylinderGeometry(0.024, 0.024, cableH, 8);
      if (!g.attributes.uv2 && g.attributes.uv) g.setAttribute('uv2', g.attributes.uv);
      return g;
    });
    _tmpPos.set(bx, bY + cableH * 0.5 + 0.5, bz);
    _tmpQuat.identity();
    _tmpScale.set(1, 1, 1);
    _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
    pushBatchedGeo(world, cableGeo, steelMat, _tmpMat4, false);

    if (!world._ascGlowMat) world._ascGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });
    const botTag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), world._ascGlowMat);
    botTag.position.set(bx, bY + 1.42, bz);
    const topTag = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.24, 0.20), world._ascGlowMat);
    topTag.position.set(bx, tY + 1.25, bz);
    world.scene.add(botTag, topTag);

    const entry = {
      id: opts.id || `asc_${(world.ascenders || []).length}`,
      name: opts.name || 'Rooftop Ascender',
      bottomPos: new THREE.Vector3(bx, bY, bz),
      topPos: new THREE.Vector3(bx, tY, bz),
      landBottom: new THREE.Vector3(bx + ux * 1.1, bY, bz + uz * 1.1),
      landTop: new THREE.Vector3(
        opts.landTopX !== undefined ? opts.landTopX : (bx - ux * 1.65),
        tY,
        opts.landTopZ !== undefined ? opts.landTopZ : (bz - uz * 1.65)
      ),
      outX: ux,
      outZ: uz
    };
    world.ascenders = world.ascenders || [];
    world.ascenders.push(entry);
    return entry;
  }

  /**
   * High-detail replacement for old box buildings across Vostok:
   * builds extruded punched walls with arched/mullioned windows, entrance canopy,
   * corner pilasters, interior ceiling panels, stepped cornice, roof parapet & HVAC!
   */
  function buildExtrudedBuilding(world, cx, cz, w, d, h = 4.5, doorSide = 'south', wallMatOverride = null, layout = null) {
    const mats = world._materials || {};
    const t = 0.45;
    const doorW = 2.05;
    const baseY = world.getTerrainHeight(cx, cz);
    const wMat = wallMatOverride || mats.concrete;
    const trimMat = (wMat === mats.whiteWall || wMat === mats.travertine || wMat === mats.sandstone)
      ? (mats.travertine || mats.darkConcrete)
      : mats.darkConcrete;

    // Stone foundation plinth & tiled floor plate
    world._addBox(cx, baseY - 0.48, cz, w + 0.7, 0.96, d + 0.7, mats.darkConcrete, false);
    world._addBox(cx, baseY + 0.08, cz, w, 0.16, d, mats.floorTile, false);

    // Multi-tier punched window layout based on wall length & building height
    const stories = h >= 6.8 ? 2 : 1;
    const makeFaceOpenings = (span, hasDoor, doorLbl) => {
      const list = [];
      if (hasDoor) {
        list.push({
          kind: 'door',
          u0: span * 0.5 - doorW * 0.5,
          u1: span * 0.5 + doorW * 0.5,
          v0: 0.12,
          v1: 2.74,
          doorStyle: (wMat === mats.bossDark || wMat === mats.policeNavy) ? 'steel' : 'wood',
          label: doorLbl || 'Entrance Door',
          canopy: true,
          arched: (wMat === mats.travertine || wMat === mats.sandstone)
        });
        if (stories === 2 && span >= 9.0) {
          list.push({ kind: 'window', u0: span * 0.22 - 0.9, u1: span * 0.22 + 0.9, v0: h * 0.56, v1: h * 0.56 + 1.55 });
          list.push({ kind: 'window', u0: span * 0.78 - 0.9, u1: span * 0.78 + 0.9, v0: h * 0.56, v1: h * 0.56 + 1.55 });
        }
      } else {
        const bayCount = span >= 17 ? 3 : 2;
        for (let b = 0; b < bayCount; b++) {
          const uc = (span * (b + 0.5)) / bayCount;
          const halfWin = Math.min(1.05, span / (bayCount * 3.1));
          const win1Top = stories === 2 ? Math.min(2.65, h * 0.36) : Math.min(2.75, h * 0.72);
          list.push({ kind: 'window', u0: uc - halfWin, u1: uc + halfWin, v0: 1.08, v1: win1Top });
          if (stories === 2) {
            const win2Bot = h * 0.54;
            list.push({ kind: 'window', u0: uc - halfWin, u1: uc + halfWin, v0: win2Bot, v1: Math.min(h - 0.45, win2Bot + 1.55) });
          }
        }
      }
      return list;
    };

    const hx = w * 0.5;
    const hz = d * 0.5;
    addPunchedWall(world, cx - hx, cz - hz, cx + hx, cz - hz, baseY, h, t, wMat, trimMat, makeFaceOpenings(w, doorSide === 'north'), { outwardSign: -1 });
    addPunchedWall(world, cx - hx, cz + hz, cx + hx, cz + hz, baseY, h, t, wMat, trimMat, makeFaceOpenings(w, doorSide === 'south'), { outwardSign: 1 });
    addPunchedWall(world, cx - hx, cz - hz, cx - hx, cz + hz, baseY, h, t, wMat, trimMat, makeFaceOpenings(d, doorSide === 'west'), { outwardSign: 1 });
    addPunchedWall(world, cx + hx, cz - hz, cx + hx, cz + hz, baseY, h, t, wMat, trimMat, makeFaceOpenings(d, doorSide === 'east'), { outwardSign: -1 });

    // Ground plinth molding strip & rhythmic pilasters
    world._addDecor(cx, baseY + 0.45, cz, w + 0.56, 0.90, d + 0.56, mats.darkConcrete);
    addPilasterGrid(world, cx, cz, w, d, baseY, h, 6.2, trimMat);

    // Build interior partitions / second-floor slabs BEFORE roof slab
    if (typeof layout === 'function') {
      layout(baseY, h);
    }

    // Roof slab, stepped cornice, parapet & HVAC clutter
    world._addBox(cx, baseY + h + 0.15, cz, w + 0.45, 0.30, d + 0.45, mats.roofTar, true);
    const roofTopY = baseY + h + 0.30;
    addCorniceAndParapet(world, cx, cz, w, d, roofTopY, 0.90, trimMat, wMat);
    const seed = (((cx * 73856093) ^ (cz * 19349663)) >>> 0);
    addRooftopMechanical(world, cx, roofTopY, cz, w, d, seed);
  }

  return {
    pushBatchedGeo,
    addPunchedWall,
    addCorniceAndParapet,
    addPilasterGrid,
    addCantileverBalcony,
    addRooftopMechanical,
    addAscenderRig,
    buildExtrudedBuilding
  };
})();
