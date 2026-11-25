// ============================================================================
// ASHFALL // Extruded Architectural Building Geometry Engine
// Real ExtrudeGeometry punched walls, arched portals, recessed window frames,
// hollow perimeter mouldings (never crossing doorways or stairwells), pilasters,
// open-lattice steel towers & cranes, shopfront awnings, HVAC & rooftop tanks
// ============================================================================
window.AshfallArchitecture = (() => {
  const _geoCache = new Map();
  const _tmpMat4 = new THREE.Matrix4();
  const _tmpPos = new THREE.Vector3();
  const _tmpQuat = new THREE.Quaternion();
  const _tmpEuler = new THREE.Euler();
  const _tmpScale = new THREE.Vector3(1, 1, 1);
  const _upVec = new THREE.Vector3(0, 1, 0);
  const _dirVec = new THREE.Vector3();

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

  function addOrientedBox(world, x, y, z, w, h, d, mat, rx = 0, ry = 0, rz = 0, castShadow = false) {
    if (!world || !mat || w <= 0.01 || h <= 0.01 || d <= 0.01) return null;
    const key = `ob:${w.toFixed(2)}:${h.toFixed(2)}:${d.toFixed(2)}`;
    const tile = (mat && mat.userData && mat.userData.tile) || 2.0;
    const geo = _cachedGeo(`${key}:${tile.toFixed(1)}`, () => {
      const g = new THREE.BoxGeometry(w, h, d);
      if (world._applyWorldUVs) world._applyWorldUVs(g, w, h, d, tile);
      else if (g.attributes.uv && !g.attributes.uv2) g.setAttribute('uv2', g.attributes.uv);
      return g;
    });
    _tmpPos.set(x, y, z);
    _tmpEuler.set(rx, ry, rz);
    _tmpQuat.setFromEuler(_tmpEuler);
    _tmpScale.set(1, 1, 1);
    _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
    return pushBatchedGeo(world, geo, mat, _tmpMat4, castShadow);
  }

  function pushRotatedBeam(world, x1, y1, z1, x2, y2, z2, thick, depth, mat, castShadow = false) {
    _dirVec.set(x2 - x1, y2 - y1, z2 - z1);
    const len = _dirVec.length();
    if (len < 0.05 || !mat) return null;
    _dirVec.normalize();
    _tmpQuat.setFromUnitVectors(_upVec, _dirVec);
    _tmpPos.set((x1 + x2) * 0.5, (y1 + y2) * 0.5, (z1 + z2) * 0.5);
    _tmpScale.set(1, 1, 1);
    _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);

    const tile = (mat && mat.userData && mat.userData.tile) || 2.0;
    const geo = _cachedGeo(`bm:${thick.toFixed(2)}:${len.toFixed(2)}:${depth.toFixed(2)}:${tile.toFixed(1)}`, () => {
      const g = new THREE.BoxGeometry(thick, len, depth);
      if (world._applyWorldUVs) world._applyWorldUVs(g, thick, len, depth, tile);
      else if (g.attributes.uv && !g.attributes.uv2) g.setAttribute('uv2', g.attributes.uv);
      return g;
    });
    return pushBatchedGeo(world, geo, mat, _tmpMat4, castShadow);
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
          const archR = Math.min(rx, (y1 - y0) * 0.44);
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

      const bevT = bevel ? Math.min(0.022, thick * 0.09) : 0;
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

    // 2. Exact segmented colliders & bullet AABBs around every window/door opening
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
      if (o.v0 > 0.06) addSegAABB(o.u0, o.u1, 0, o.v0);
      if (height - o.v1 > 0.06) addSegAABB(o.u0, o.u1, o.v1, height);

      const ow = o.u1 - o.u0;
      const oh = o.v1 - o.v0;
      const uMid = (o.u0 + o.u1) * 0.5;
      const wx = x1 + dirX * uMid;
      const wz = z1 + dirZ * uMid;
      const rotWall = horiz ? 0 : Math.PI / 2;

      if (o.kind === 'door') {
        const doorH = Math.min(2.60, oh);
        const doorSideSign = opts.outwardSign || 1;
        if (o.doorStyle) {
          world._addDoor(wx, yBot + Math.max(0.08, o.v0), wz, ow, doorH, rotWall, o.label || 'Entrance Door', o.doorStyle);
        }
        // Optional rolled-up sectional bay shutter drum
        if (o.rollup) {
          world._addDecor(wx, yBot + o.v1 - 0.30, wz, horiz ? ow : thick + 0.08, 0.56, horiz ? thick + 0.08 : ow, mats.metal || frameMat);
        }
        // Projected stone surround header
        const hoodW = ow + 0.36;
        world._addDecor(wx, yBot + o.v1 + 0.08, wz, horiz ? hoodW : thick + 0.18, 0.16, horiz ? thick + 0.18 : hoodW, sillMat);
        if (o.canopy) {
          const cxC = wx + outX * doorSideSign * 0.78;
          const czC = wz + outZ * doorSideSign * 0.78;
          world._addDecor(cxC, yBot + o.v1 + 0.20, czC, horiz ? ow + 1.0 : 1.4, 0.12, horiz ? 1.4 : ow + 1.0, mats.metal || frameMat);
        }
      } else if (o.kind === 'window') {
        const wy = yBot + (o.v0 + o.v1) * 0.5;
        world._addDecor(wx, yBot + o.v0 - 0.05, wz, horiz ? ow + 0.24 : thick + 0.18, 0.10, horiz ? thick + 0.18 : ow + 0.24, sillMat);
        world._addDecor(wx, yBot + o.v1 + 0.06, wz, horiz ? ow + 0.22 : thick + 0.16, 0.12, horiz ? thick + 0.16 : ow + 0.22, sillMat);
        const off = ow * 0.5 - 0.045;
        world._addDecor(wx - dirX * off, wy, wz - dirZ * off, horiz ? 0.09 : thick + 0.04, oh, horiz ? thick + 0.04 : 0.09, frameMat);
        world._addDecor(wx + dirX * off, wy, wz + dirZ * off, horiz ? 0.09 : thick + 0.04, oh, horiz ? thick + 0.04 : 0.09, frameMat);
        world._addDecor(wx, wy, wz, horiz ? 0.06 : thick + 0.03, oh, horiz ? thick + 0.03 : 0.06, frameMat);
        world._addDecor(wx, wy + oh * 0.16, wz, horiz ? ow : thick + 0.03, 0.06, horiz ? thick + 0.03 : ow, frameMat);
        if (glassMat && !o.open) {
          world._addDecor(wx, wy, wz, horiz ? ow * 0.94 : 0.05, oh * 0.94, horiz ? 0.05 : ow * 0.94, glassMat);
        }
      }
      curU = Math.max(curU, o.u1);
    }
    if (curU < len - 0.06) {
      addSegAABB(curU, len, 0, height);
    }
  }

  /**
   * Emits 4 hollow perimeter facade strips (never solid across interior slabs,
   * stairwells, or doorways). Optionally splits any face around gaps ([{ u0, u1 }]).
   */
  function addPerimeterBand(world, cx, cz, w, d, yCenter, bandH, proud, mat, gaps = null) {
    if (!world || !mat || bandH <= 0.01 || proud <= 0.01) return;
    const thickHalf = 0.22; // nominal exterior wall half-thickness
    const stripT = proud;
    const nZ = cz - d * 0.5 - thickHalf - stripT * 0.5 + 0.18;
    const sZ = cz + d * 0.5 + thickHalf + stripT * 0.5 - 0.18;
    const wX = cx - w * 0.5 - thickHalf - stripT * 0.5 + 0.18;
    const eX = cx + w * 0.5 + thickHalf + stripT * 0.5 - 0.18;
    const outW = w + 0.44 + stripT * 2;
    const outD = d + 0.44;

    const emitFace = (side, isHoriz, fixedCoord, baseStart, faceSpan) => {
      const sideGaps = gaps && gaps[side] ? [...gaps[side]].sort((a, b) => a.u0 - b.u0) : null;
      if (!sideGaps || sideGaps.length === 0) {
        if (isHoriz) {
          world._addDecor(cx, yCenter, fixedCoord, faceSpan, bandH, stripT, mat);
        } else {
          world._addDecor(fixedCoord, yCenter, cz, stripT, bandH, faceSpan, mat);
        }
        return;
      }
      const pad = (faceSpan - (isHoriz ? w : d)) * 0.5;
      let cur = 0;
      for (const g of sideGaps) {
        const g0 = Math.max(0, g.u0 + pad - 0.08);
        const g1 = Math.min(faceSpan, g.u1 + pad + 0.08);
        if (g0 - cur > 0.12) {
          const segL = g0 - cur;
          const mid = baseStart + cur + segL * 0.5;
          if (isHoriz) world._addDecor(mid, yCenter, fixedCoord, segL, bandH, stripT, mat);
          else world._addDecor(fixedCoord, yCenter, mid, stripT, bandH, segL, mat);
        }
        cur = Math.max(cur, g1);
      }
      if (faceSpan - cur > 0.12) {
        const segL = faceSpan - cur;
        const mid = baseStart + cur + segL * 0.5;
        if (isHoriz) world._addDecor(mid, yCenter, fixedCoord, segL, bandH, stripT, mat);
        else world._addDecor(fixedCoord, yCenter, mid, stripT, bandH, segL, mat);
      }
    };

    emitFace('north', true, nZ, cx - outW * 0.5, outW);
    emitFace('south', true, sZ, cx - outW * 0.5, outW);
    emitFace('west', false, wX, cz - outD * 0.5, outD);
    emitFace('east', false, eX, cz - outD * 0.5, outD);
  }

  function addCorniceAndParapet(world, cx, cz, w, d, yTop, parapetH = 0.85, corniceMat = null, wallMat = null, opts = {}) {
    const mats = world._materials || {};
    const cMat = corniceMat || mats.travertine || mats.concrete;
    const pMat = wallMat || mats.concrete;
    // Two-stepped hollow architectural cornice strips (never crosses interiors!)
    addPerimeterBand(world, cx, cz, w, d, yTop - 0.16, 0.20, 0.24, cMat);
    addPerimeterBand(world, cx, cz, w, d, yTop + 0.02, 0.16, 0.34, cMat);

    if (parapetH <= 0.05) return;
    const pT = 0.32;
    const skipNorth = !!opts.skipNorth;
    const skipSouth = !!opts.skipSouth;
    const skipWest = !!opts.skipWest;
    const skipEast = !!opts.skipEast;

    if (!skipNorth) {
      world._addBox(cx, yTop + parapetH * 0.5, cz - d * 0.5, w + 0.25, parapetH, pT, pMat, true);
      world._addDecor(cx, yTop + parapetH + 0.04, cz - d * 0.5, w + 0.40, 0.09, pT + 0.12, cMat);
    }
    if (!skipSouth) {
      world._addBox(cx, yTop + parapetH * 0.5, cz + d * 0.5, w + 0.25, parapetH, pT, pMat, true);
      world._addDecor(cx, yTop + parapetH + 0.04, cz + d * 0.5, w + 0.40, 0.09, pT + 0.12, cMat);
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
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        world._addDecor(cx + sx * (w * 0.5), yBot + h * 0.5, cz + sz * (d * 0.5), 0.62, h, 0.62, m);
      }
    }
    const nx = Math.max(0, Math.floor(w / spacing) - 1);
    for (let i = 1; i <= nx; i++) {
      const px = cx - w * 0.5 + (w * i) / (nx + 1);
      world._addDecor(px, yBot + h * 0.5, cz - d * 0.5 - 0.14, 0.38, h, 0.20, m);
      world._addDecor(px, yBot + h * 0.5, cz + d * 0.5 + 0.14, 0.38, h, 0.20, m);
    }
    const nz = Math.max(0, Math.floor(d / spacing) - 1);
    for (let i = 1; i <= nz; i++) {
      const pz = cz - d * 0.5 + (d * i) / (nz + 1);
      world._addDecor(cx - w * 0.5 - 0.14, yBot + h * 0.5, pz, 0.20, h, 0.38, m);
      world._addDecor(cx + w * 0.5 + 0.14, yBot + h * 0.5, pz, 0.20, h, 0.38, m);
    }
  }

  function addCantileverBalcony(world, cx, yFloor, cz, span, depth, facing = 'south', slabMat = null, railMat = null) {
    const mats = world._materials || {};
    const sMat = slabMat || mats.travertine || mats.concrete;
    const rMat = railMat || mats.metal || mats.windowFrame;
    const horiz = (facing === 'south' || facing === 'north');
    const bw = horiz ? span : depth;
    const bd = horiz ? depth : span;
    world._addBox(cx, yFloor - 0.12, cz, bw, 0.22, bd, sMat, true);
    for (const f of [-0.36, 0, 0.36]) {
      const rx = horiz ? cx + span * f : cx;
      const rz = horiz ? cz : cz + span * f;
      world._addDecor(rx, yFloor - 0.32, rz, horiz ? 0.20 : depth * 0.85, 0.20, horiz ? depth * 0.85 : 0.20, sMat);
    }
    const rH = 1.0;
    if (facing === 'south' || facing === 'north') {
      const outerZ = cz + (facing === 'south' ? depth * 0.5 - 0.08 : -depth * 0.5 + 0.08);
      world._addBox(cx, yFloor + rH - 0.06, outerZ, span, 0.08, 0.08, rMat, true);
      world._addBox(cx, yFloor + rH * 0.46, outerZ, span, 0.72, 0.05, rMat, false);
      world._addBox(cx - span * 0.5 + 0.08, yFloor + rH * 0.5, cz, 0.08, rH, depth, rMat, true);
      world._addBox(cx + span * 0.5 - 0.08, yFloor + rH * 0.5, cz, 0.08, rH, depth, rMat, true);
    } else {
      const outerX = cx + (facing === 'east' ? depth * 0.5 - 0.08 : -depth * 0.5 + 0.08);
      world._addBox(outerX, yFloor + rH - 0.06, cz, 0.08, 0.08, span, rMat, true);
      world._addBox(outerX, yFloor + rH * 0.46, cz, 0.05, 0.72, span, rMat, false);
      world._addBox(cx, yFloor + rH * 0.5, cz - span * 0.5 + 0.08, depth, rH, 0.08, rMat, true);
      world._addBox(cx, yFloor + rH * 0.5, cz + span * 0.5 - 0.08, depth, rH, 0.08, rMat, true);
    }
  }

  function addShopfrontAwning(world, cx, yTop, cz, span, proj, facing = 'south', mat = null, bracketMat = null) {
    const mats = world._materials || {};
    const cMat = mat || mats.rustRed || mats.fireRed;
    const bMat = bracketMat || mats.windowFrame || mats.metal;
    const horiz = (facing === 'south' || facing === 'north');
    const sign = (facing === 'south' || facing === 'east') ? 1 : -1;
    const w = horiz ? span : proj;
    const d = horiz ? proj : span;
    const ocx = horiz ? cx : (cx + sign * proj * 0.5);
    const ocz = horiz ? (cz + sign * proj * 0.5) : cz;
    const tilt = horiz ? (sign * 0.24) : 0;
    const tiltZ = horiz ? 0 : (-sign * 0.24);
    addOrientedBox(world, ocx, yTop - 0.16, ocz, w, 0.10, d, cMat, tilt, 0, tiltZ, true);
    // Front awning valence skirt
    const fz = horiz ? (cz + sign * (proj - 0.04)) : cz;
    const fx = horiz ? cx : (cx + sign * (proj - 0.04));
    world._addDecor(fx, yTop - 0.36, fz, horiz ? span : 0.06, 0.24, horiz ? 0.06 : span, cMat);
    for (const f of [-0.44, 0.44]) {
      const bx = horiz ? cx + span * f : cx + sign * proj * 0.48;
      const bz = horiz ? cz + sign * proj * 0.48 : cz + span * f;
      world._addDecor(bx, yTop - 0.22, bz, horiz ? 0.07 : proj * 0.9, 0.07, horiz ? proj * 0.9 : 0.07, bMat);
    }
  }

  function addWallACUnits(world, cx, cz, w, d, yBase, floors, fH, groundH = null, seed = 1) {
    const mats = world._materials || {};
    const mMat = mats.metal || mats.concrete;
    const gMat = mats.windowFrame || mats.darkConcrete;
    const rng = world._rng ? world._rng(seed) : Math.random;
    const gH = groundH !== null ? groundH : fH;
    const startFl = floors > 1 ? 1 : 0;
    for (let fl = startFl; fl < floors; fl++) {
      const yU = yBase + (fl === 0 ? 0 : gH + (fl - 1) * fH) + 0.82;
      if (rng() > 0.25) {
        const px = cx - w * 0.5 + 1.6 + rng() * Math.max(1.0, w - 3.2);
        const side = rng() < 0.5 ? -1 : 1;
        const pz = cz + side * (d * 0.5 + 0.36);
        world._addDecor(px, yU, pz, 0.78, 0.52, 0.34, mMat);
        world._addDecor(px + 0.14, yU, pz + side * 0.18, 0.34, 0.34, 0.04, gMat);
      }
      if (rng() > 0.35) {
        const pz = cz - d * 0.5 + 1.6 + rng() * Math.max(1.0, d - 3.2);
        const side = rng() < 0.5 ? -1 : 1;
        const px = cx + side * (w * 0.5 + 0.36);
        world._addDecor(px, yU, pz, 0.34, 0.52, 0.78, mMat);
        world._addDecor(px + side * 0.18, yU, pz + 0.14, 0.04, 0.34, 0.34, gMat);
      }
    }
  }

  function addRooftopWaterTanks(world, cx, yRoof, cz, w, d, count = 2, seed = 1) {
    const mats = world._materials || {};
    const tankMat = mats.metal || mats.concrete;
    const legMat = mats.windowFrame || mats.darkConcrete;
    const rng = world._rng ? world._rng(seed) : Math.random;
    const tankGeo = _cachedGeo('roof_water_tank', () => {
      const g = new THREE.CylinderGeometry(0.62, 0.62, 1.48, 12);
      if (g.attributes.uv && !g.attributes.uv2) g.setAttribute('uv2', g.attributes.uv);
      return g;
    });
    const spanX = Math.max(0.6, w * 0.5 - 2.6);
    const spanZ = Math.max(0.6, d * 0.5 - 2.6);
    for (let i = 0; i < count; i++) {
      const tx = cx + (i === 0 ? 0.65 : -0.65) * spanX * 0.65;
      const tz = cz + (rng() * 2 - 1) * spanZ * 0.55;
      world._addDecor(tx, yRoof + 0.42, tz, 1.15, 0.84, 1.15, legMat);
      _tmpPos.set(tx, yRoof + 1.56, tz);
      _tmpQuat.identity();
      _tmpScale.set(1, 1, 1);
      _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
      pushBatchedGeo(world, tankGeo, tankMat, _tmpMat4, true);
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
      const ux = cx + (rng() * 2 - 1) * spanX * 0.82;
      const uz = cz + (rng() * 2 - 1) * spanZ * 0.82;
      world._addBox(ux, yRoof + 0.52, uz, 1.85, 1.04, 1.15, mMat, true);
      world._addDecor(ux + 1.15, yRoof + 0.36, uz, 0.65, 0.42, 0.42, mMat);
      for (const fx of [-0.46, 0.46]) {
        _tmpPos.set(ux + fx, yRoof + 1.08, uz);
        _tmpQuat.identity();
        _tmpScale.set(1, 1, 1);
        _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
        pushBatchedGeo(world, world._acFanGeo, fMat, _tmpMat4, false);
      }
    }
    const bx = cx - spanX * 0.55;
    const bz = cz - spanZ * 0.55;
    world._addBox(bx, yRoof + 0.28, bz, 1.25, 0.56, 1.25, dMat, true);
    world._addDecor(bx + 1.4, yRoof + 0.72, bz, 0.22, 1.44, 0.22, mMat);
    world._addDecor(bx + 1.4, yRoof + 1.46, bz, 0.42, 0.12, 0.42, fMat);
    addRooftopWaterTanks(world, cx, yRoof, cz, w, d, w >= 16 ? 2 : 1, seed + 17);
  }

  /**
   * 4-Chord Tapered Open Structural Steel Lattice Mast (for Channel 7 TV Tower & Highrise Spire)
   */
  function addLatticeTower(world, cx, yBase, cz, baseW, topW, totalH, tiers, matA, matB, opts = {}) {
    const mats = world._materials || {};
    const mA = matA || mats.whiteSteel || mats.metal;
    const mB = matB || mats.fireRed || mats.whiteSteel;
    const stepH = totalH / Math.max(2, tiers);
    const chordT = opts.chordThick || 0.20;
    const braceT = opts.braceThick || 0.11;

    for (let i = 0; i < tiers; i++) {
      const f0 = i / tiers;
      const f1 = (i + 1) / tiers;
      const hw0 = (baseW + (topW - baseW) * f0) * 0.5;
      const hw1 = (baseW + (topW - baseW) * f1) * 0.5;
      const y0 = yBase + f0 * totalH;
      const y1 = yBase + f1 * totalH;
      const tMat = (opts.alternateColors !== false && i % 2 === 1) ? mB : mA;

      const c0 = [
        [cx - hw0, y0, cz - hw0],
        [cx + hw0, y0, cz - hw0],
        [cx + hw0, y0, cz + hw0],
        [cx - hw0, y0, cz + hw0]
      ];
      const c1 = [
        [cx - hw1, y1, cz - hw1],
        [cx + hw1, y1, cz - hw1],
        [cx + hw1, y1, cz + hw1],
        [cx - hw1, y1, cz + hw1]
      ];
      for (let k = 0; k < 4; k++) {
        const nk = (k + 1) % 4;
        // Corner vertical/tapered chord
        pushRotatedBeam(world, c0[k][0], c0[k][1], c0[k][2], c1[k][0], c1[k][1], c1[k][2], chordT, chordT, tMat, false);
        // Top horizontal ring girt
        pushRotatedBeam(world, c1[k][0], c1[k][1], c1[k][2], c1[nk][0], c1[nk][1], c1[nk][2], braceT, braceT, tMat, false);
        // X-brace diagonals on face k -> nk
        pushRotatedBeam(world, c0[k][0], c0[k][1], c0[k][2], c1[nk][0], c1[nk][1], c1[nk][2], braceT * 0.85, braceT * 0.85, tMat, false);
        pushRotatedBeam(world, c0[nk][0], c0[nk][1], c0[nk][2], c1[k][0], c1[k][1], c1[k][2], braceT * 0.85, braceT * 0.85, tMat, false);
      }

      if (opts.platforms && (i === Math.floor(tiers * 0.45) || i === Math.floor(tiers * 0.8))) {
        world._addBox(cx, y1, cz, hw1 * 2.5, 0.24, hw1 * 2.5, mats.grate || mats.metal, true);
        if (opts.dishes) {
          world._addDecor(cx + hw1 + 0.45, y1 + 0.65, cz, 0.35, 0.9, 0.9, mats.whiteWall || mA);
          world._addDecor(cx - hw1 - 0.45, y1 + 0.65, cz, 0.35, 0.9, 0.9, mats.whiteWall || mA);
        }
      }
    }

    // Top whip spire + aviation strobe
    const spireH = opts.spireH !== undefined ? opts.spireH : 5.5;
    if (spireH > 0.2) {
      pushRotatedBeam(world, cx, yBase + totalH, cz, cx, yBase + totalH + spireH, cz, 0.14, 0.14, mA, false);
    }
    const beaconY = yBase + totalH + spireH + 0.32;
    if (opts.beacon !== false) {
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.46, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff2a2a })
      );
      beacon.position.set(cx, beaconY, cz);
      world.scene.add(beacon);
      world.registerLightSource(beacon.position, {
        intensity: 1.15,
        maxDist: 340,
        flareScale: 1.0,
        anamorphic: true,
        ghosts: true
      });
    }
    // Base collision core so players cannot walk straight through the tower base
    world._addBox(cx, yBase + Math.min(3.5, stepH) * 0.5, cz, Math.max(0.8, baseW * 0.72), Math.min(3.5, stepH), Math.max(0.8, baseW * 0.72), mats.bossDark || mA, true);
    return beaconY;
  }

  /**
   * Open-Lattice Steel Construction Tower Crane with Slewing Cab, Walkable Jib,
   * Trolley, Pendant Tie-Rods, Counterweights & Strobe!
   */
  function addLatticeTowerCrane(world, cx, yBase, cz, mastH, jibLen = 30, counterLen = 11, jibDirX = -1, opts = {}) {
    const mats = world._materials || {};
    const yMat = mats.hazardAmber || mats.concrete;
    const sMat = mats.metal || mats.darkConcrete;
    const wMat = mats.whiteSteel || mats.whiteWall || yMat;

    // Concrete foundation ballast block
    world._addBox(cx, yBase + 1.0, cz, 5.0, 2.0, 5.0, mats.darkConcrete || sMat, true);
    const mastBaseY = yBase + 2.0;
    const netMastH = Math.max(8, mastH - 2.0);
    const tiers = Math.max(3, Math.round(netMastH / 3.8));
    addLatticeTower(world, cx, mastBaseY, cz, 2.2, 2.2, netMastH, tiers, yMat, yMat, {
      alternateColors: false,
      chordThick: 0.22,
      braceThick: 0.11,
      spireH: 0,
      beacon: false
    });

    const cabY = yBase + mastH;
    // Slewing deck + Operator Glass Cab + Turntable
    world._addBox(cx, cabY, cz, 4.4, 0.36, 4.4, mats.grate || sMat, true);
    world._addBox(cx + jibDirX * 0.8, cabY + 1.25, cz + 1.55, 2.1, 2.1, 1.5, wMat, true);
    world._addDecor(cx + jibDirX * 1.45, cabY + 1.35, cz + 1.55, 0.85, 1.3, 1.2, mats.windowGlass || sMat);

    // Open-Truss Main Jib (walkable catwalk top + triangular chord truss!)
    const jMidX = cx + jibDirX * (jibLen * 0.5);
    const jibEndX = cx + jibDirX * jibLen;
    world._addBox(jMidX, cabY + 0.18, cz, jibLen, 0.32, 1.65, mats.grate || yMat, true); // walkable catwalk
    // Top apex jib spine + diagonal truss webbing
    const jibPeakY = cabY + 1.85;
    pushRotatedBeam(world, cx, jibPeakY, cz, jibEndX, jibPeakY - 0.35, cz, 0.18, 0.18, yMat, false);
    const jBays = Math.max(5, Math.round(jibLen / 3.5));
    for (let i = 0; i < jBays; i++) {
      const f0 = i / jBays;
      const f1 = (i + 1) / jBays;
      const x0 = cx + jibDirX * f0 * jibLen;
      const x1 = cx + jibDirX * f1 * jibLen;
      const yTop0 = jibPeakY - f0 * 0.35;
      const yTop1 = jibPeakY - f1 * 0.35;
      for (const zOff of [-0.72, 0.72]) {
        pushRotatedBeam(world, x0, cabY + 0.25, cz + zOff, x0, yTop0, cz, 0.11, 0.11, yMat, false);
        pushRotatedBeam(world, x0, cabY + 0.25, cz + zOff, x1, yTop1, cz, 0.10, 0.10, yMat, false);
      }
    }

    // Counter-jib & Concrete Counterweights
    const cjMidX = cx - jibDirX * (counterLen * 0.5);
    const cjEndX = cx - jibDirX * counterLen;
    world._addBox(cjMidX, cabY + 0.18, cz, counterLen, 0.32, 1.9, yMat, true);
    world._addBox(cx - jibDirX * (counterLen - 2.2), cabY + 1.15, cz, 3.4, 1.8, 2.2, mats.darkConcrete || sMat, true);

    // A-Frame Cathead Apex + Pendant Tie-Rods
    const apexY = cabY + 5.6;
    for (const zOff of [-0.95, 0.95]) {
      pushRotatedBeam(world, cx - jibDirX * 1.1, cabY + 0.3, cz + zOff, cx, apexY, cz, 0.18, 0.18, yMat, false);
      pushRotatedBeam(world, cx + jibDirX * 1.1, cabY + 0.3, cz + zOff, cx, apexY, cz, 0.18, 0.18, yMat, false);
    }
    pushRotatedBeam(world, cx, apexY, cz, jibEndX - jibDirX * 2.5, jibPeakY - 0.3, cz, 0.08, 0.08, sMat, false);
    pushRotatedBeam(world, cx, apexY, cz, cx + jibDirX * (jibLen * 0.52), jibPeakY - 0.15, cz, 0.08, 0.08, sMat, false);
    pushRotatedBeam(world, cx, apexY, cz, cjEndX + jibDirX * 1.0, cabY + 0.35, cz, 0.08, 0.08, sMat, false);

    // Trolley & Hanging Hook Cables
    const hookX = cx + jibDirX * (jibLen * 0.68);
    world._addDecor(hookX, cabY - 0.08, cz, 1.2, 0.35, 1.4, mats.bossDark || sMat);
    const dropLen = Math.min(18.0, netMastH * 0.48);
    pushRotatedBeam(world, hookX - 0.18, cabY - 0.25, cz, hookX - 0.18, cabY - dropLen, cz, 0.05, 0.05, sMat, false);
    pushRotatedBeam(world, hookX + 0.18, cabY - 0.25, cz, hookX + 0.18, cabY - dropLen, cz, 0.05, 0.05, sMat, false);
    world._addDecor(hookX, cabY - dropLen - 0.35, cz, 0.65, 0.65, 0.45, yMat);

    // Aviation warning beacons
    const apexBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    apexBeacon.position.set(cx, apexY + 0.38, cz);
    world.scene.add(apexBeacon);
    world.registerLightSource(apexBeacon.position, { intensity: 0.95, maxDist: 290, flareScale: 0.85, anamorphic: true });
    world.registerLightSource(new THREE.Vector3(jibEndX, jibPeakY + 0.2, cz), { intensity: 0.80, maxDist: 250, flareScale: 0.72 });

    return cabY + 0.34;
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

    world._addBox(bx, bY + 0.55, bz, 0.42, 1.10, 0.42, frameMat, true);
    world._addDecor(bx, bY + 1.16, bz, 0.56, 0.14, 0.56, steelMat);

    world._addDecor(bx - ux * 0.9, tY + 1.25, bz - uz * 0.9, 0.26, 2.5, 0.26, frameMat);
    world._addDecor(bx - ux * 0.45, tY + 2.38, bz - uz * 0.45, Math.abs(ux) > 0.5 ? 1.4 : 0.28, 0.24, Math.abs(uz) > 0.5 ? 1.4 : 0.28, frameMat);
    world._addDecor(bx - ux * 0.6, tY + 0.55, bz - uz * 0.6, 0.58, 0.58, 0.58, steelMat);

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
      landBottom: new THREE.Vector3(
        opts.landBottomX !== undefined ? opts.landBottomX : (bx + ux * 1.15),
        bY,
        opts.landBottomZ !== undefined ? opts.landBottomZ : (bz + uz * 1.15)
      ),
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
   * High-detail human-scale replacement for global 1-2 story buildings across Vostok:
   * - 1.44m x 2.28m realistic human entrance doors (1.88m double doors on >=16m halls)
   * - Clean split perimeter plinths & hollow cornices (ZERO solid doorway/interior blocks!)
   * - 3.3m residential/commercial floor heights & proportional rooftop parapets
   */
  function buildExtrudedBuilding(world, cx, cz, w, d, h = 4.2, doorSide = 'south', wallMatOverride = null, layout = null) {
    const mats = world._materials || {};
    const t = 0.42;
    const isLargeHall = w >= 16.0 || d >= 16.0;
    const doorW = isLargeHall ? 1.88 : 1.44;
    const doorTop = isLargeHall ? 2.42 : 2.34;
    const baseY = world.getTerrainHeight(cx, cz);
    const wMat = wallMatOverride || mats.concrete;
    const trimMat = (wMat === mats.whiteWall || wMat === mats.travertine || wMat === mats.sandstone)
      ? (mats.travertine || mats.darkConcrete)
      : mats.darkConcrete;

    // Foundation plinth & interior floor slab
    world._addBox(cx, baseY - 0.48, cz, w + 0.65, 0.96, d + 0.65, mats.darkConcrete, false);
    world._addBox(cx, baseY + 0.08, cz, w, 0.16, d, mats.floorTile, false);

    const stories = h >= 6.2 ? 2 : 1;
    const plinthGaps = {};
    const makeFaceOpenings = (side, span, hasDoor, doorLbl) => {
      const list = [];
      if (hasDoor) {
        const u0 = span * 0.5 - doorW * 0.5;
        const u1 = span * 0.5 + doorW * 0.5;
        plinthGaps[side] = [{ u0, u1 }];
        list.push({
          kind: 'door',
          u0,
          u1,
          v0: 0.08,
          v1: doorTop,
          doorStyle: (wMat === mats.bossDark || wMat === mats.policeNavy) ? 'steel' : 'wood',
          label: doorLbl || 'Entrance Door',
          canopy: true,
          arched: (wMat === mats.travertine || wMat === mats.sandstone)
        });
        if (stories === 2 && span >= 9.0) {
          const y2Bot = h * 0.54;
          list.push({ kind: 'window', u0: span * 0.22 - 0.72, u1: span * 0.22 + 0.72, v0: y2Bot, v1: Math.min(h - 0.42, y2Bot + 1.38) });
          list.push({ kind: 'window', u0: span * 0.78 - 0.72, u1: span * 0.78 + 0.72, v0: y2Bot, v1: Math.min(h - 0.42, y2Bot + 1.38) });
        }
      } else {
        const bayCount = span >= 16 ? 3 : 2;
        for (let b = 0; b < bayCount; b++) {
          const uc = (span * (b + 0.5)) / bayCount;
          const halfWin = Math.min(0.82, span / (bayCount * 3.4));
          const win1Bot = 0.92;
          const win1Top = stories === 2 ? Math.min(2.38, h * 0.34) : Math.min(2.42, h - 0.52);
          list.push({ kind: 'window', u0: uc - halfWin, u1: uc + halfWin, v0: win1Bot, v1: win1Top });
          if (stories === 2) {
            const win2Bot = h * 0.54;
            list.push({ kind: 'window', u0: uc - halfWin, u1: uc + halfWin, v0: win2Bot, v1: Math.min(h - 0.42, win2Bot + 1.38) });
          }
        }
      }
      return list;
    };

    const hx = w * 0.5;
    const hz = d * 0.5;
    addPunchedWall(world, cx - hx, cz - hz, cx + hx, cz - hz, baseY, h, t, wMat, trimMat, makeFaceOpenings('north', w, doorSide === 'north'), { outwardSign: -1 });
    addPunchedWall(world, cx - hx, cz + hz, cx + hx, cz + hz, baseY, h, t, wMat, trimMat, makeFaceOpenings('south', w, doorSide === 'south'), { outwardSign: 1 });
    addPunchedWall(world, cx - hx, cz - hz, cx - hx, cz + hz, baseY, h, t, wMat, trimMat, makeFaceOpenings('west', d, doorSide === 'west'), { outwardSign: 1 });
    addPunchedWall(world, cx + hx, cz - hz, cx + hx, cz + hz, baseY, h, t, wMat, trimMat, makeFaceOpenings('east', d, doorSide === 'east'), { outwardSign: -1 });

    // Hollow exterior plinth molding split cleanly around door + pilasters
    addPerimeterBand(world, cx, cz, w, d, baseY + 0.38, 0.76, 0.10, mats.darkConcrete, plinthGaps);
    if (stories === 2) {
      addPerimeterBand(world, cx, cz, w, d, baseY + h * 0.47, 0.22, 0.14, trimMat);
    }
    addPilasterGrid(world, cx, cz, w, d, baseY, h, 5.8, trimMat);

    const seed = (((cx * 73856093) ^ (cz * 19349663)) >>> 0);
    if (stories === 2) {
      addWallACUnits(world, cx, cz, w, d, baseY, 2, h * 0.5, h * 0.5, seed);
    }

    if (typeof layout === 'function') {
      layout(baseY, h);
    }

    // Roof slab, hollow cornice, proportional parapet & mechanical clutter
    world._addBox(cx, baseY + h + 0.14, cz, w + 0.42, 0.28, d + 0.42, mats.roofTar, true);
    const roofTopY = baseY + h + 0.28;
    const paraH = h <= 4.8 ? 0.58 : 0.82;
    addCorniceAndParapet(world, cx, cz, w, d, roofTopY, paraH, trimMat, wMat);
    addRooftopMechanical(world, cx, roofTopY, cz, w, d, seed);
  }

  return {
    pushBatchedGeo,
    addOrientedBox,
    pushRotatedBeam,
    addPunchedWall,
    addPerimeterBand,
    addCorniceAndParapet,
    addPilasterGrid,
    addCantileverBalcony,
    addShopfrontAwning,
    addWallACUnits,
    addRooftopWaterTanks,
    addRooftopMechanical,
    addLatticeTower,
    addLatticeTowerCrane,
    addAscenderRig,
    buildExtrudedBuilding
  };
})();
