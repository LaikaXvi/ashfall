// ============================================================================
// ASHFALL // Al-Mazrah City Inspired Metropolitan Blockout -> Vostok City
// Dense river-bisected urban core (F2-G3) with 24 extruded multi-story
// buildings, 4 signature river bridges (White Twin-Arch Suspension, Grand
// Blvd, Covered Bazaar Footbridge, South Warren Truss), Box-Girder Ring
// Viaduct, 42m Crane, Golden Whale Highrise Lobby & 8 Interactive Ascenders!
// ============================================================================
window.VostokCityBuilder = (() => {
  function _sampleRiverBAtZ(world, z) {
    const pts = world._riverB.pts;
    const cum = world._riverB.cumLen;
    const tot = world._riverB.totalLen;
    for (let i = 0; i < pts.length - 1; i++) {
      const az = pts[i][1];
      const bz = pts[i + 1][1];
      if ((z >= az && z <= bz) || (z <= az && z >= bz)) {
        const dz = (bz - az) || 1;
        const t = Math.max(0, Math.min(1, (z - az) / dz));
        const rx = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t;
        const hw = (pts[i][2] || 18) + ((pts[i + 1][2] || 18) - (pts[i][2] || 18)) * t;
        const s = (cum[i] + t * (cum[i + 1] - cum[i])) / tot;
        return { x: rx, hw, waterY: world._riverWaterYB(s) };
      }
    }
    return { x: 166, hw: 18, waterY: 2.9 };
  }

  /**
   * Build a finely modelled extruded multi-story metropolitan building with
   * punched windows, balconies, optional X-brace girders, interior stacked stairs
   * with open headroom cutouts, parapet + HVAC, and rooftop ascender options!
   */
  function _buildMultiStoryBlock(world, helpers, spec) {
    const A = window.AshfallArchitecture;
    const mats = world._materials;
    const cx = spec.cx;
    const cz = spec.cz;
    const w = spec.w;
    const d = spec.d;
    const floors = spec.floors || 3;
    const fH = spec.floorH || 4.0;
    const baseY = world.getTerrainHeight(cx, cz);
    const wMat = spec.wallMat || mats.travertine || mats.concrete;
    const upperMat = spec.upperMat || wMat;
    const trimMat = spec.trimMat || mats.darkConcrete;
    const t = 0.45;
    const hx = w * 0.5;
    const hz = d * 0.5;

    // Foundation plinth & ground marble/tile slab
    world._addBox(cx, baseY - 0.48, cz, w + 0.8, 0.96, d + 0.8, mats.darkConcrete, false);
    world._addBox(cx, baseY + 0.08, cz, w - 0.2, 0.16, d - 0.2, spec.floorMat || mats.floorTile, false);

    // Stairwell bay in NE or NW corner (alternates stair flights cleanly so headroom >= 2 floors!)
    const swW = Math.min(4.6, w * 0.34);
    const swD = Math.min(10.5, d * 0.56);
    const swOnWest = !!spec.stairWest;
    const swX = swOnWest ? (cx - hx + swW * 0.5 + 0.3) : (cx + hx - swW * 0.5 - 0.3);
    const swZ = cz - hz + swD * 0.5 + 0.3;

    const addFloorSlabWithCutout = (yTop) => {
      if (!spec.noStairs) {
        const remW = Math.max(2.0, w - swW - 0.7);
        const remX = swOnWest ? (cx + swW * 0.5 + 0.15) : (cx - swW * 0.5 - 0.15);
        world._addBox(remX, yTop - 0.15, cz, remW, 0.30, d - 0.5, mats.darkConcrete, true);
        const remD = Math.max(1.8, d - swD - 0.7);
        const remZ = cz + swD * 0.5 + 0.15;
        world._addBox(swX, yTop - 0.15, remZ, swW + 0.1, 0.30, remD, mats.darkConcrete, true);
      } else {
        world._addBox(cx, yTop - 0.15, cz, w - 0.5, 0.30, d - 0.5, mats.darkConcrete, true);
      }
    };

    const makeOpenings = (span, doorCfg, storyIdx) => {
      const list = [];
      if (storyIdx === 0 && doorCfg) {
        const dw = doorCfg.w || 2.3;
        list.push({
          kind: 'door',
          u0: span * 0.5 - dw * 0.5,
          u1: span * 0.5 + dw * 0.5,
          v0: 0.12,
          v1: 2.80,
          doorStyle: doorCfg.style || 'steel',
          label: doorCfg.label || `${spec.name} Entrance`,
          canopy: doorCfg.canopy !== false,
          arched: !!spec.archedDoors
        });
        if (span >= 12) {
          list.push({ kind: 'window', u0: span * 0.2 - 1.1, u1: span * 0.2 + 1.1, v0: 0.95, v1: 2.85, arched: !!spec.archedWindows });
          list.push({ kind: 'window', u0: span * 0.8 - 1.1, u1: span * 0.8 + 1.1, v0: 0.95, v1: 2.85, arched: !!spec.archedWindows });
        }
      } else {
        const bays = Math.max(2, Math.floor(span / 5.2));
        for (let b = 0; b < bays; b++) {
          const uc = (span * (b + 0.5)) / bays;
          const hw = Math.min(1.35, (span / bays) * 0.34);
          const openSash = (storyIdx >= 1 && (b % 2 === 1)) || !!spec.openUpperWindows;
          list.push({
            kind: 'window',
            u0: uc - hw,
            u1: uc + hw,
            v0: 0.96,
            v1: Math.min(fH - 0.55, 2.90),
            arched: !!spec.archedWindows,
            open: openSash
          });
        }
      }
      return list;
    };

    for (let fl = 0; fl < floors; fl++) {
      const yB = baseY + fl * fH;
      const fm = fl === 0 ? wMat : upperMat;
      const dNorth = fl === 0 && spec.doors && spec.doors.north;
      const dSouth = fl === 0 && spec.doors && spec.doors.south;
      const dWest = fl === 0 && spec.doors && spec.doors.west;
      const dEast = fl === 0 && spec.doors && spec.doors.east;

      const sOpenNorth = spec.skybridgeNorthFloor === fl ? [{ kind: 'door', u0: w * 0.5 - 2.2, u1: w * 0.5 + 2.2, v0: 0.08, v1: 3.1 }] : null;
      const sOpenSouth = spec.skybridgeSouthFloor === fl ? [{ kind: 'door', u0: w * 0.5 - 2.2, u1: w * 0.5 + 2.2, v0: 0.08, v1: 3.1 }] : null;

      A.addPunchedWall(world, cx - hx, cz - hz, cx + hx, cz - hz, yB, fH, t, fm, trimMat, sOpenNorth || makeOpenings(w, dNorth, fl), { outwardSign: -1 });
      A.addPunchedWall(world, cx - hx, cz + hz, cx + hx, cz + hz, yB, fH, t, fm, trimMat, sOpenSouth || makeOpenings(w, dSouth, fl), { outwardSign: 1 });
      A.addPunchedWall(world, cx - hx, cz - hz, cx - hx, cz + hz, yB, fH, t, fm, trimMat, makeOpenings(d, dWest, fl), { outwardSign: 1 });
      A.addPunchedWall(world, cx + hx, cz - hz, cx + hx, cz + hz, yB, fH, t, fm, trimMat, makeOpenings(d, dEast, fl), { outwardSign: -1 });

      // Floor spandrel belt molding
      world._addDecor(cx, yB + fH - 0.14, cz, w + 0.52, 0.28, d + 0.52, trimMat);

      if (fl > 0) {
        addFloorSlabWithCutout(yB);
        if (spec.balconies) {
          for (const bf of spec.balconies) {
            if (bf === 'west') A.addCantileverBalcony(world, cx - hx - 1.15, yB, cz, Math.min(10.0, d * 0.58), 2.1, 'west', mats.travertine, mats.metal);
            if (bf === 'east') A.addCantileverBalcony(world, cx + hx + 1.15, yB, cz, Math.min(10.0, d * 0.58), 2.1, 'east', mats.travertine, mats.metal);
            if (bf === 'north') A.addCantileverBalcony(world, cx, yB, cz - hz - 1.15, Math.min(10.0, w * 0.58), 2.1, 'north', mats.travertine, mats.metal);
            if (bf === 'south') A.addCantileverBalcony(world, cx, yB, cz + hz + 1.15, Math.min(10.0, w * 0.58), 2.1, 'south', mats.travertine, mats.metal);
          }
        }
      }

      // Alternating interior staircase flight inside cutout bay with clear landing pads
      if (!spec.noStairs) {
        const yNext = baseY + (fl + 1) * fH;
        const landS = swZ + swD * 0.5;
        const landN = swZ - swD * 0.5;
        const runLen = Math.max(4.4, swD - 2.6);
        const dirEven = (fl % 2 === 0);
        const xLane = dirEven ? (swX - swW * 0.24) : (swX + swW * 0.24);
        const zStart = dirEven ? (landS - 1.1) : (landN + 1.1);
        const steps = Math.max(12, Math.ceil(fH / 0.28));
        if (fl === 0) {
          world._addBox(swX, baseY + 0.08, swZ, swW, 0.16, swD, mats.metal, true);
        }
        helpers.addStaircase(xLane, yB + (fl === 0 ? 0.14 : 0), zStart, steps, Math.max(1.5, swW * 0.44), fH - (fl === 0 ? 0.14 : 0), runLen, dirEven ? 'north' : 'south');
        const arriveZ = dirEven ? landN + 0.5 : landS - 0.5;
        world._addBox(swX, yNext - 0.15, arriveZ, swW, 0.30, 2.2, mats.metal, true);
        if (dirEven) {
          world._addBox(swX + swW * 0.24, yNext - 0.15, swZ, swW * 0.5, 0.30, swD - 1.8, mats.metal, true);
        } else {
          world._addBox(swX - swW * 0.24, yNext - 0.15, swZ, swW * 0.5, 0.30, swD - 1.8, mats.metal, true);
        }
      }
    }

    // Pilaster rhythm & Roof Cap
    A.addPilasterGrid(world, cx, cz, w, d, baseY, floors * fH, 6.0, trimMat);
    const roofY = baseY + floors * fH;
    addFloorSlabWithCutout(roofY);
    A.addCorniceAndParapet(world, cx, cz, w, d, roofY, spec.parapetH !== undefined ? spec.parapetH : 1.0, trimMat, upperMat, {});
    if (!spec.skipHVAC) {
      A.addRooftopMechanical(world, cx, roofY, cz, w, d, ((cx * 73856093) ^ (cz * 19349663)) >>> 0);
    }

    if (spec.footprintTag !== false) {
      world.cityFootprints.push({
        name: spec.shortLabel || spec.name,
        x: cx, z: cz, w, d,
        color: spec.mapColor || '#68737b',
        stroke: spec.mapStroke || 'rgba(218, 226, 232, 0.55)',
        landmark: !!spec.landmark
      });
    }

    return { baseY, roofY, floorH: fH };
  }

  function build(world, helpers) {
    const A = window.AshfallArchitecture;
    const mats = world._materials;
    world.ascenders = world.ascenders || [];
    world.cityFootprints = world.cityFootprints || [];
    const rng = world._matchRng || world._rng(133742);

    // =========================================================================
    // 1. DREDGED URBAN CANAL QUAYS, PROMENADES, 6 WATER STAIRS & MOORED SKIFFS
    // =========================================================================
    const buildCanalAndPromenades = () => {
      for (let zSeg = -428; zSeg < -246; zSeg += 12) {
        const zc = zSeg + 6;
        // Leave road bridge gaps at North Twin-Arch (-398), Central Blvd (-348), South Truss (-292)
        if (Math.abs(zc - (-399)) < 11.5 || Math.abs(zc - (-348)) < 11.0 || Math.abs(zc - (-292)) < 10.5) continue;
        const sR = _sampleRiverBAtZ(world, zc);
        const wBankX = sR.x - sR.hw - 0.6;
        const eBankX = sR.x + sR.hw + 0.6;
        const seaBot = sR.waterY - 1.75;

        // West Canal Ribbed Seawall + Terracotta Promenade (y = 6.6m)
        const wWallH = 6.6 - seaBot;
        world._addBox(wBankX, seaBot + wWallH * 0.5, zc, 1.3, wWallH, 12.2, mats.ribbedConcrete || mats.darkConcrete, true);
        world._addBox(wBankX - 5.2, 6.6 - 0.25, zc, 9.6, 0.50, 12.2, mats.plazaPaver || mats.concrete, true);

        // East Canal Ribbed Seawall + Terracotta Promenade (y = 6.8m)
        const eWallH = 6.8 - seaBot;
        world._addBox(eBankX, seaBot + eWallH * 0.5, zc, 1.3, eWallH, 12.2, mats.ribbedConcrete || mats.darkConcrete, true);
        world._addBox(eBankX + 5.2, 6.8 - 0.25, zc, 9.6, 0.50, 12.2, mats.plazaPaver || mats.concrete, true);

        const isGap = (Math.abs(zc - (-322)) < 7.5 || Math.abs(zc - (-372)) < 5.5 || Math.abs(zc - (-414)) < 5.5);
        if (!isGap) {
          // Segmented concrete coping & tubular canal rail
          world._addBox(wBankX + 0.12, 6.6 + 0.35, zc, 0.36, 0.70, 12.0, mats.travertine || mats.concrete, true);
          world._addDecor(wBankX + 0.12, 6.6 + 0.92, zc, 0.12, 0.10, 12.0, mats.metal);
          world._addBox(eBankX - 0.12, 6.8 + 0.35, zc, 0.36, 0.70, 12.0, mats.travertine || mats.concrete, true);
          world._addDecor(eBankX - 0.12, 6.8 + 0.92, zc, 0.12, 0.10, 12.0, mats.metal);
        }
        if ((zSeg - (-428)) % 24 === 0) {
          helpers.addFloodlight(wBankX - 2.0, zc, Math.PI / 2, 8.2, 0xfff0cc);
          helpers.addFloodlight(eBankX + 2.0, zc, -Math.PI / 2, 8.2, 0xfff0cc);
        }
      }

      // 6 Canal Water-Egress Stone Stairways (North, Mid, South on BOTH West and East banks)
      const buildCanalWaterStairs = (x, zStart, topY, waterY, landingX) => {
        const footBase = waterY - 0.35;
        world._addBox(x, footBase - 0.35, zStart + 1.2, 2.8, 0.70, 2.6, mats.darkConcrete, true);
        helpers.addStaircase(x, footBase, zStart, 17, 2.4, topY - footBase, 8.8, 'north');
        world._addBox((x + landingX) * 0.5, topY - 0.25, zStart - 10.1, Math.abs(landingX - x) + 2.8, 0.50, 3.0, mats.concrete, true);
      };
      for (const zW of [-410.0, -365.5, -310.0]) {
        const sr = _sampleRiverBAtZ(world, zW - 3);
        buildCanalWaterStairs(sr.x - sr.hw + 0.8, zW, 6.6, sr.waterY, sr.x - sr.hw - 2.4);
        buildCanalWaterStairs(sr.x + sr.hw - 0.8, zW, 6.8, sr.waterY, sr.x + sr.hw + 2.4);
      }

      // Moored Canal Tactical Skiffs for Aquatic Flanking Cover
      for (const sz of [-376, -334, -276]) {
        const sr = _sampleRiverBAtZ(world, sz);
        const bx = sr.x + (sz === -334 ? -6.5 : 5.5);
        world._addBox(bx, sr.waterY + 0.18, sz, 2.4, 0.62, 5.8, mats.rustOlive, true);
        world._addDecor(bx, sr.waterY + 0.62, sz + 1.6, 1.8, 0.32, 1.4, mats.bossDark);
      }
    };
    buildCanalAndPromenades();

    // =========================================================================
    // 2. FOUR ARCHITECTURAL CROSS-RIVER BRIDGES
    // =========================================================================
    const buildAllBridges = () => {
      // Bridge 1 (z = -398): Al-Mazrah Iconic White Twin-Arch Suspension Bridge!
      const nBr = _sampleRiverBAtZ(world, -398);
      const nDeckY = nBr.waterY + 1.08;
      const archSpan = 42.0;
      const archRise = 10.5;
      const segs = 12;
      const wSteel = mats.whiteSteel || mats.whiteWall;
      for (const sideZ of [-398 - 5.4, -398 + 5.4]) {
        for (let i = 0; i < segs; i++) {
          const u0 = -1 + (2 * i) / segs;
          const u1 = -1 + (2 * (i + 1)) / segs;
          const y0 = archRise * (1 - u0 * u0);
          const y1 = archRise * (1 - u1 * u1);
          const x0 = nBr.x + u0 * (archSpan * 0.5);
          const x1 = nBr.x + u1 * (archSpan * 0.5);
          const xm = (x0 + x1) * 0.5;
          const ym = nDeckY + (y0 + y1) * 0.5;
          const segL = Math.hypot(x1 - x0, y1 - y0);
          const angZ = Math.atan2(y1 - y0, x1 - x0);
          const archMesh = world._addDecor(xm, ym, sideZ, segL + 0.18, 0.68, 0.68, wSteel);
          if (archMesh) { archMesh.rotation.z = angZ; archMesh.updateMatrix(); }
          // Vertical suspender cables
          if (i > 0 && i % 2 === 0 && y0 > 1.2) {
            world._addDecor(x0, nDeckY + y0 * 0.5, sideZ, 0.12, y0, 0.12, mats.metal);
          }
        }
        // Bridge concrete jersey parapet
        world._addBox(nBr.x, nDeckY + 0.52, sideZ, archSpan, 1.02, 0.48, wSteel, true);
      }
      // Overhead White Transverse Portal Braces across crown
      for (const ux of [-0.36, 0, 0.36]) {
        const yBr = nDeckY + archRise * (1 - ux * ux);
        world._addDecor(nBr.x + ux * (archSpan * 0.5), yBr, -398, 0.55, 0.55, 11.4, wSteel);
      }

      // Bridge 2 (z = -348): Central 4-Lane Grand Boulevard Bridge + Walkable Under-Bridge Catwalk!
      const cBr = _sampleRiverBAtZ(world, -348);
      const cDeckY = cBr.waterY + 1.08;
      for (const px of [cBr.x - 19, cBr.x + 19]) {
        world._addBox(px, cDeckY + 3.2, -354.6, 1.0, 6.4, 1.0, mats.travertine, true);
        world._addBox(px, cDeckY + 3.2, -341.4, 1.0, 6.4, 1.0, mats.travertine, true);
        world._addBox(px, cDeckY + 6.5, -348.0, 1.1, 0.9, 14.0, mats.bossDark, false);
      }
      world._addBox(cBr.x, cDeckY + 0.50, -354.2, 40.0, 1.0, 0.52, mats.travertine, true);
      world._addBox(cBr.x, cDeckY + 0.50, -341.8, 40.0, 1.0, 0.52, mats.travertine, true);
      world._addBox(cBr.x - 5.0, cDeckY + 0.38, -348.0, 14.0, 0.72, 0.65, mats.darkConcrete, true);
      // Lower Steel Under-Bridge Maintenance Catwalk just above waterline!
      const catY = cBr.waterY + 0.45;
      world._addBox(cBr.x, catY, -353.8, 34.0, 0.28, 2.0, mats.grate || mats.metal, true);

      // Bridge 3 (z = -322): Covered Bazaar Pedestrian Footbridge
      const fBrY = 7.45;
      world._addBox(166.0, fBrY - 0.20, -322.0, 52.0, 0.40, 4.4, mats.grate || mats.metal, true);
      world._addBox(166.0, fBrY + 0.52, -324.05, 51.0, 1.04, 0.28, mats.metal, true);
      world._addBox(166.0, fBrY + 0.52, -319.95, 51.0, 1.04, 0.28, mats.metal, true);
      world._addDecor(166.0, fBrY + 3.10, -322.0, 46.0, 0.24, 4.8, mats.rustBlue);
      for (const fpX of [153.5, 178.5]) {
        const pb = _sampleRiverBAtZ(world, -322).waterY - 1.6;
        world._addBox(fpX, (pb + fBrY - 0.4) * 0.5, -322.0, 1.4, fBrY - 0.4 - pb, 4.0, mats.darkConcrete, true);
        world._addDecor(fpX, fBrY + 1.55, -324.0, 0.28, 3.0, 0.28, mats.metal);
        world._addDecor(fpX, fBrY + 1.55, -320.0, 0.28, 3.0, 0.28, mats.metal);
      }
      helpers.addStaircase(136.4, 6.6, -322.0, 4, 3.8, fBrY - 6.6, 3.6, 'east');
      helpers.addStaircase(195.6, 6.8, -322.0, 4, 3.8, fBrY - 6.8, 3.6, 'west');

      // Bridge 4 (z = -292): South Steel Warren-Truss Bridge!
      const sBr = _sampleRiverBAtZ(world, -292);
      const sDeckY = sBr.waterY + 1.08;
      const tSpan = 40.0;
      const tH = 5.4;
      for (const tz of [-292 - 5.2, -292 + 5.2]) {
        world._addBox(sBr.x, sDeckY + 0.52, tz, tSpan, 1.04, 0.45, mats.bossDark, true);
        world._addDecor(sBr.x, sDeckY + tH, tz, tSpan, 0.55, 0.55, mats.metal);
        for (let bx = sBr.x - 16; bx <= sBr.x + 16; bx += 8) {
          world._addBox(bx, sDeckY + tH * 0.5, tz, 0.55, tH, 0.55, mats.metal, true);
        }
      }
      for (let bx = sBr.x - 16; bx <= sBr.x + 16; bx += 8) {
        world._addDecor(bx, sDeckY + tH, -292, 0.45, 0.45, 10.8, mats.metal);
      }
      world.cityFootprints.push(
        { name: 'North Twin-Arch Bridge', x: nBr.x, z: -398, w: 46, d: 11, color: '#9aa7b0', stroke: '#e8eff4', landmark: true },
        { name: 'Central Grand Bridge', x: cBr.x, z: -348, w: 46, d: 13, color: '#78848c', stroke: '#d8e2e8', landmark: false },
        { name: 'Bazaar Footbridge', x: 166, z: -322, w: 52, d: 4.6, color: '#8c9aa4', stroke: '#ffd54f', landmark: false },
        { name: 'South Steel Truss Bridge', x: sBr.x, z: -292, w: 44, d: 11, color: '#616d75', stroke: '#cfd8dc', landmark: false }
      );
    };
    buildAllBridges();

    // =========================================================================
    // 3. EAST BANK METROPOLITAN DISTRICTS (6.8m TERRACE, 16 EXTRUDED BUILDINGS)
    // =========================================================================
    const eastY = 6.8;

    // Raised Sidewalk Curbs along Main City Blocks
    const addBlockCurb = (cx, cz, w, d) => {
      const y = world.getTerrainHeight(cx, cz);
      world._addBox(cx, y + 0.06, cz, w, 0.12, d, mats.plazaPaver || mats.concrete, true);
    };
    addBlockCurb(272, -372, 48, 36);   // Highrise Metro Superblock
    addBlockCurb(272, -320, 48, 40);   // Yum Yum & Civic Plaza Block
    addBlockCurb(323.5, -320, 27, 40); // Embassy Block
    addBlockCurb(119.5, -320, 23, 38); // Sarwana Grand Hotel Block
    addBlockCurb(81, -320, 26, 38);    // Channel 7 Broadcast Block

    // -------------------------------------------------------------------------
    // A. THE HIGHRISE 3-WING SKYSCRAPER COMPLEX (Col E2: x=248..296, z=-391..-356)
    // -------------------------------------------------------------------------
    {
      // 1) Main South Skyscraper (7 Walkable Floors -> MW2 Helipad at 32.0m, Spire to 47m)
      const ms = _buildMultiStoryBlock(world, helpers, {
        name: 'Vostok Highrise Main',
        shortLabel: 'HIGHRISE',
        cx: 266, cz: -366, w: 26, d: 16,
        floors: 6, floorH: 4.2,
        wallMat: mats.curtainSpandrel || mats.bossDark,
        upperMat: mats.curtainSpandrel || mats.concrete,
        trimMat: mats.ribbedConcrete || mats.darkConcrete,
        floorMat: mats.marbleLobby || mats.floorTile,
        doors: {
          west: { w: 2.5, style: 'steel', label: 'Highrise West Lobby' },
          south: { w: 2.6, style: 'steel', label: 'Highrise Entrance 3' },
          north: { w: 2.4, style: 'steel', label: 'Highrise Atrium Foyer' }
        },
        skybridgeNorthFloor: 2,
        parapetH: 1.05,
        landmark: true,
        mapColor: '#788490',
        mapStroke: '#ffca28'
      });

      // Signature Al-Mazrah White Structural X-Brace Girders across upper North & South Highrise Facades!
      const wSteel = mats.whiteSteel || mats.whiteWall;
      for (const fz of [-366 - 8.32, -366 + 8.32]) {
        for (const baseX of [257.5, 266.0, 274.5]) {
          for (const flX of [ms.baseY + 12.6, ms.baseY + 21.0]) {
            const xBeamA = world._addDecor(baseX, flX, fz, 0.42, 9.8, 0.32, wSteel);
            if (xBeamA) { xBeamA.rotation.z = 0.62; xBeamA.updateMatrix(); }
            const xBeamB = world._addDecor(baseX, flX, fz, 0.42, 9.8, 0.32, wSteel);
            if (xBeamB) { xBeamB.rotation.z = -0.62; xBeamB.updateMatrix(); }
          }
        }
      }

      // MW2 Highrise Rooftop Helipad ("H"), Fuel Depot Shed, 5F Exterior Window-Scaffolding & 16m Comms Spire!
      world._addBox(262, ms.roofY + 0.04, -366, 12.0, 0.08, 12.0, mats.darkConcrete, false);
      world._addBox(259.8, ms.roofY + 0.08, -366, 0.85, 0.04, 6.4, mats.hazardAmber, false);
      world._addBox(264.2, ms.roofY + 0.08, -366, 0.85, 0.04, 6.4, mats.hazardAmber, false);
      world._addBox(262.0, ms.roofY + 0.08, -366, 4.4, 0.04, 0.88, mats.hazardAmber, false);
      world._addBox(273.5, ms.roofY + 1.8, -363.5, 6.4, 3.6, 5.4, mats.bossDark, true);
      world._addDecor(273.5, ms.roofY + 9.8, -363.5, 0.72, 12.6, 0.72, mats.metal);
      const hrStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.56, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      hrStrobe.position.set(273.5, ms.roofY + 16.4, -363.5);
      world.scene.add(hrStrobe);
      world.registerLightSource(hrStrobe.position, { intensity: 1.18, maxDist: 340, flareScale: 1.05, anamorphic: true, ghosts: true });

      // 3D Sculpted Golden Whale Statue in Highrise Atrium Foyer (outside Lobby at 266, -376)!
      const wy = world.getTerrainHeight(266, -376);
      const gBrass = mats.goldBrass || mats.hazardAmber;
      world._addBox(266, wy + 0.45, -376.5, 4.6, 0.90, 2.8, mats.marbleLobby || mats.travertine, true);
      const whaleBody = world._addDecor(266, wy + 1.38, -376.5, 3.4, 0.85, 1.1, gBrass);
      if (whaleBody) { whaleBody.rotation.z = 0.14; whaleBody.updateMatrix(); }
      const whaleFluke = world._addDecor(267.9, wy + 1.85, -376.5, 0.45, 0.95, 1.65, gBrass);
      if (whaleFluke) { whaleFluke.rotation.z = -0.45; whaleFluke.updateMatrix(); }

      // Highrise 1F Armory Vault [KEY ROOM], 4F Coffeehouse Counter & Executive Penthouse Loot
      world._addPartition(260, -374, 260, -366, ms.baseY, ms.floorH, [
        { at: -370, w: 1.8, door: 'steel', label: 'Highrise Vault Door' }
      ]);
      world._addPartition(253, -366, 260, -366, ms.baseY, ms.floorH, []);
      world._addLootContainer(256.5, 0.16, -370.0, 'boss_key_room', 'Vostok Highrise Vault [KEY ROOM]', 'boss_key');
      world._addGunLocker(270.0, -359.5, 0, 'military', 'Highrise Lobby Security Locker');
      world._addLootContainer(260.0, 2 * ms.floorH + 0.04, -362.5, 'office', '3F Skybridge Corporate Files');
      world._addLootContainer(264.0, 5 * ms.floorH + 0.04, -364.0, 'valuables', '6F Executive Penthouse Safe');
      world._addLootContainer(261.0, (ms.roofY - ms.baseY) + 0.04, -363.0, 'military', '7F Helipad Sniper Case');

      // Giant North Billboard on Highrise North Wing & North Wing 5-Story Tower (266, -385, 22x10)
      const nw = _buildMultiStoryBlock(world, helpers, {
        name: 'Highrise North Wing',
        shortLabel: 'HR NORTH',
        cx: 266, cz: -385, w: 22, d: 10,
        floors: 5, floorH: 4.2,
        wallMat: mats.ribbedConcrete || mats.concrete,
        upperMat: mats.curtainSpandrel || mats.concrete,
        trimMat: mats.darkConcrete,
        doors: { south: { w: 2.3, style: 'steel', label: 'North Wing Atrium' } },
        skybridgeSouthFloor: 2,
        mapColor: '#6d7984'
      });
      // 3F Glazed Skybridge connecting Main Highrise & North Wing across the Atrium (z = -380..-374)
      const sbY = ms.baseY + 2 * ms.floorH;
      world._addBox(266, sbY - 0.14, -377.0, 4.4, 0.28, 6.4, mats.darkConcrete, true);
      world._addBox(263.95, sbY + 0.55, -377.0, 0.30, 1.1, 6.2, mats.bossDark, true);
      world._addBox(268.05, sbY + 0.55, -377.0, 0.30, 1.1, 6.2, mats.bossDark, true);
      world._addDecor(266, sbY + 3.05, -377.0, 4.6, 0.26, 6.4, mats.metal);
      world._addSignBoard(266, nw.baseY + 13.5, -390.4, 11.2, 3.6, Math.PI, {
        title: 'VOSTOK HIGHRISE',
        sub: 'AL-MAZRAH FINANCIAL CENTER // HELIPAD 01',
        bg: '#141a22',
        accent: '#ffc107'
      });

      // Two Exterior Highrise Ascenders (SW Corner + East Wall -> 7F Helipad Roof!)
      A.addAscenderRig(world, { id: 'asc_hr_west', name: 'Highrise West Zipline', bx: 252.1, bz: -366.0, bottomY: ms.baseY, topY: ms.roofY, outX: -1, outZ: 0 });
      A.addAscenderRig(world, { id: 'asc_hr_east', name: 'Highrise East Zipline', bx: 279.9, bz: -368.0, bottomY: ms.baseY, topY: ms.roofY, outX: 1, outZ: 0 });

      // 42m Highrise Construction Tower Crane (290, -378) + Crane Cab Ascender!
      const crX = 290, crZ = -378;
      const crY = world.getTerrainHeight(crX, crZ);
      world._addBox(crX, crY + 1.0, crZ, 5.2, 2.0, 5.2, mats.darkConcrete, true);
      world._addBox(crX, crY + 18.0, crZ, 2.2, 34.0, 2.2, mats.hazardAmber, true);
      world._addBox(crX - 8.0, crY + 35.2, crZ, 34.0, 1.5, 1.8, mats.hazardAmber, true); // Walkable Jib pointing West over Highrise!
      world._addBox(crX, crY + 35.8, crZ, 4.2, 2.4, 4.2, mats.whiteSteel || mats.concrete, true);
      world.registerLightSource(new THREE.Vector3(crX - 24.0, crY + 36.2, crZ), { intensity: 0.95, maxDist: 280, flareScale: 0.85 });
      A.addAscenderRig(world, { id: 'asc_hr_crane', name: 'Tower Crane Ascender', bx: crX - 2.6, bz: crZ, bottomY: crY, topY: crY + 35.95, outX: -1, outZ: 0, landTopX: crX, landTopZ: crZ });

      world.bossSpawnPos = new THREE.Vector3(264.0, ms.baseY + 5 * ms.floorH + 0.25, -365.0);
      world.bossGuardSpawns = [
        new THREE.Vector3(268.0, ms.baseY + 5 * ms.floorH + 0.25, -362.0),
        new THREE.Vector3(262.0, ms.baseY + 0.25, -361.0),
        new THREE.Vector3(280.0, eastY + 0.25, -320.0),
        new THREE.Vector3(314.0, eastY + 0.25, -320.0),
        new THREE.Vector3(128.0, 6.6 + 0.25, -320.0),
        new THREE.Vector3(82.0, 6.6 + 0.25, -335.0)
      ];
    }

    // -------------------------------------------------------------------------
    // B. EAST BANK CIVIC, YUM YUM BURGER, EMBASSY, POLICE, FIRE, BANK & APARTMENTS
    // -------------------------------------------------------------------------
    // Municipal 3-Deck Parking Garage (x=221, z=-418) + Unobstructed Z9 A/1 Forecourt (214,-374)
    {
      const pgX = 221, pgZ = -418, pW = 24, pD = 20;
      const py = world.getTerrainHeight(pgX, pgZ);
      world._addBox(pgX, py + 0.08, pgZ, pW, 0.16, pD, mats.darkConcrete, false);
      for (const fl of [1, 2]) {
        const yD = py + fl * 4.2;
        world._addBox(pgX - 2.2, yD, pgZ, pW - 5.2, 0.34, pD - 0.6, mats.ribbedConcrete || mats.concrete, true);
        world._addBox(pgX - 2.2, yD + 0.58, pgZ - pD * 0.5 + 0.3, pW - 5.2, 0.95, 0.35, mats.concrete, true);
        world._addBox(pgX - 2.2, yD + 0.58, pgZ + pD * 0.5 - 0.3, pW - 5.2, 0.95, 0.35, mats.concrete, true);
        helpers.addStaircase(pgX + pW * 0.5 - 2.4, py + (fl - 1) * 4.2 + 0.1, pgZ + (fl === 1 ? 6.2 : -6.2), 15, 2.8, 4.15, 11.0, fl === 1 ? 'north' : 'south');
        world._addBox(pgX + pW * 0.5 - 2.4, yD, pgZ + (fl === 1 ? -6.8 : 6.8), 3.6, 0.34, 4.0, mats.concrete, true);
      }
      for (const px of [pgX - 10.6, pgX - 2.0, pgX + 6.4]) {
        for (const pz of [pgZ - 8.6, pgZ + 8.6]) {
          world._addBox(px, py + 4.3, pz, 0.8, 8.6, 0.8, mats.bossDark, true);
        }
      }
      world._addSignBoard(pgX, py + 9.2, pgZ + 10.3, 8.2, 2.2, 0, {
        title: 'DOWNTOWN PARKING',
        sub: 'DECK P-01 // ZAVOD-9 A/1 ACCESS',
        bg: '#1c2428', accent: '#ffa726'
      });
      helpers.addWreckedVehicle(pgX - 4.0, pgZ + 2.0, 0.25, false, false);
      world._addLootContainer(pgX - 5.0, 4.4, pgZ - 4.0, 'supply', 'Parking 2F Supply Cache');
      world._addLootContainer(pgX - 5.0, 8.6, pgZ + 4.0, 'military', 'Parking Roof Overwatch Case');
      world.cityFootprints.push({ name: 'Parking Deck P-01', x: pgX, z: pgZ, w: pW, d: pD, color: '#586269' });

      // ZAVOD-9 A/1 South Forecourt Framing (strictly clear around 214, -374 & z: -370..-356!)
      const zy = world.getTerrainHeight(227, -374);
      world._addBox(228.5, zy + 1.4, -374.0, 3.0, 2.8, 3.0, mats.bossDark, true);
      world._addBox(206.8, zy + 0.5, -363.0, 0.45, 1.0, 0.45, mats.hazardAmber, true);
      world._addBox(221.2, zy + 0.5, -363.0, 0.45, 1.0, 0.45, mats.hazardAmber, true);
    }

    // Police Academy Precinct (260, -418) & Fire Station 07 (286, -418)
    _buildMultiStoryBlock(world, helpers, {
      name: 'Police Precinct', cx: 260, cz: -418, w: 20, d: 18, floors: 3, floorH: 3.9,
      wallMat: mats.policeNavy, upperMat: mats.travertine, doors: { south: { w: 2.3, style: 'steel', label: 'Police Main Desk' } },
      landmark: true, mapColor: '#3f5a75'
    });
    world._addSignBoard(260, eastY + 4.8, -408.6, 5.6, 1.8, 0, 'police');
    world._addGunLocker(256.5, -415.0, Math.PI / 2, 'police_fire', 'Police Academy Armory Locker');
    world._addLootContainer(262.0, 4.1, -420.0, 'office', '2F Detective Case Archive');

    _buildMultiStoryBlock(world, helpers, {
      name: 'Fire Station 07', cx: 286, cz: -418, w: 18, d: 18, floors: 2, floorH: 4.4,
      wallMat: mats.fireRed, doors: { south: { w: 3.2, style: 'steel', label: 'Firehouse Engine Bay' } },
      archedDoors: true, mapColor: '#7d443d'
    });
    world._addSignBoard(286, eastY + 5.2, -408.6, 5.6, 1.8, 0, 'fire');
    world._addGunLocker(282.0, -416.0, Math.PI / 2, 'police_fire', 'Firehouse Rescue Gear Locker');

    // Yum Yum Burger Rotunda (284, -330) + "X" Back Room & Corner Retail Strip (258, -330)
    {
      const yy = _buildMultiStoryBlock(world, helpers, {
        name: 'Yum Yum Burger', shortLabel: 'YUM YUM', cx: 284, cz: -330, w: 18, d: 16,
        floors: 2, floorH: 3.9, wallMat: mats.travertine, upperMat: mats.whiteWall,
        doors: { west: { w: 2.3, style: 'wood', label: 'Yum Yum Dining Entrance' } },
        landmark: true, mapColor: '#8d5b3e', mapStroke: '#ff9800'
      });
      world._addDecor(284, yy.baseY + 3.7, -330, 18.8, 0.42, 16.8, mats.fireRed);
      world._addPartition(286, -337.6, 286, -322.4, yy.baseY, yy.floorH, [
        { at: -330, w: 1.7, door: 'steel', label: 'Yum Yum Back Room [X]' }
      ]);
      world._addBox(282, yy.baseY + 0.55, -330, 1.2, 1.0, 8.6, mats.hazardAmber, true);
      world._addSignBoard(274.5, yy.baseY + 5.0, -330, 6.2, 1.9, -Math.PI / 2, {
        title: 'YUM YUM BURGER', sub: 'DOWNTOWN DINER // BACK ROOM [X]', bg: '#4a1814', accent: '#ffca28'
      });
      world._addLootContainer(289.5, 0.16, -333.5, 'valuables', 'Yum Yum Back Room Cache');
      world._addLootContainer(289.5, 0.16, -326.5, 'supply', 'Kitchen Cold Storage Crate');

      _buildMultiStoryBlock(world, helpers, {
        name: 'Downtown Retail Strip', cx: 258, cz: -330, w: 18, d: 16,
        floors: 3, floorH: 3.9, wallMat: mats.sandstone, doors: { south: { w: 2.2, style: 'wood' } },
        balconies: ['south'], mapColor: '#787262'
      });
      world._addLootContainer(255, 4.1, -330, 'office', 'Retail Upper Office Cabinet');
    }

    // Civic Obelisk & Fountain Plaza (x = 270, z = -309)
    {
      const plY = world.getTerrainHeight(270, -309);
      world._addBox(270, plY + 0.06, -309, 28, 0.12, 16, mats.marbleLobby || mats.floorTile, false);
      world._addBox(270, plY + 0.65, -309, 5.2, 1.3, 5.2, mats.travertine, true);
      world._addBox(270, plY + 4.8, -309, 1.5, 8.0, 1.5, mats.concrete, true);
      helpers.addFloodlight(258, -309, 0.7, 10.5, 0xffe4aa);
    }

    // Fortified Diplomatic Embassy Compound (x=323.5, z=-319.5, 25x36 perimeter + 3F Chancery!)
    {
      const ex = 323.5, ez = -319.5, ew = 25, ed = 36, wH = 3.2;
      const ey = world.getTerrainHeight(ex, ez);
      world._addBox(ex, ey + wH * 0.5, ez - ed * 0.5, ew, wH, 0.9, mats.darkConcrete, true);
      world._addBox(ex + ew * 0.5, ey + wH * 0.5, ez, 0.9, wH, ed, mats.darkConcrete, true);
      world._addBox(ex - ew * 0.5, ey + wH * 0.5, ez - 10.5, 0.9, wH, 15.0, mats.darkConcrete, true);
      world._addBox(ex - ew * 0.5, ey + wH * 0.5, ez + 10.5, 0.9, wH, 15.0, mats.darkConcrete, true);
      world._addBox(ex - 6.5, ey + wH * 0.5, ez + ed * 0.5, 12.0, wH, 0.9, mats.darkConcrete, true);
      world._addBox(ex + 7.5, ey + wH * 0.5, ez + ed * 0.5, 10.0, wH, 0.9, mats.darkConcrete, true);
      world._addBox(ex - 10.2, ey + 1.5, ez - 14.5, 2.8, 3.0, 2.8, mats.bossDark, true);
      const emb = _buildMultiStoryBlock(world, helpers, {
        name: 'U.S. / Diplomatic Embassy', shortLabel: 'EMBASSY', cx: ex + 1.0, cz: ez, w: 18, d: 22,
        floors: 3, floorH: 4.1, wallMat: mats.travertine, archedWindows: true, archedDoors: true,
        doors: { west: { w: 2.5, style: 'steel', label: 'Embassy Chancery Doors' } },
        landmark: true, mapColor: '#6f7b85', mapStroke: '#64b5f6'
      });
      world._addSignBoard(ex - ew * 0.5 - 0.6, ey + 4.4, ez - 8.5, 7.0, 2.0, -Math.PI / 2, {
        title: 'EMBASSY COMPOUND', sub: 'DIPLOMATIC ZONE // RESTRICTED', bg: '#1e242c', accent: '#64b5f6'
      });
      world._addLootContainer(ex + 4.5, 0.16, ez - 5.0, 'valuables', 'Embassy Diplomatic Code Safe');
      world._addLootContainer(ex + 4.5, 4.3, ez + 5.0, 'office', '2F Consular Archive');
      world._addGunLocker(ex - 5.2, ez + 7.5, Math.PI / 2, 'military', 'Embassy Security Locker');
      A.addAscenderRig(world, { id: 'asc_embassy', name: 'Embassy Roof Ascender', bx: emb.baseY ? ex + 10.4 : ex + 10.4, bz: ez + 6.0, bottomY: emb.baseY, topY: emb.roofY, outX: 1, outZ: 0 });
    }

    // Central Bank of Vostok (260, -269) & Bank Financial Tower (286, -269)
    {
      const bk = _buildMultiStoryBlock(world, helpers, {
        name: 'Bank of Vostok', shortLabel: 'CITY BANK', cx: 260, cz: -269, w: 20, d: 18,
        floors: 3, floorH: 4.0, wallMat: mats.travertine, archedWindows: true, archedDoors: true,
        doors: { north: { w: 2.6, style: 'steel', label: 'Bank Rotunda Doors' } },
        landmark: true, mapColor: '#7a7866', mapStroke: '#ffd54f'
      });
      world._addSignBoard(260, bk.baseY + 5.0, -259.6, 6.4, 1.9, 0, {
        title: 'BANK OF VOSTOK', sub: 'CENTRAL BULLION DEPOSITORY', bg: '#1c2420', accent: '#ffd54f'
      });
      world._addLootContainer(256, 0.16, -274, 'valuables', 'Central Bank Bullion Vault');
      world._addWorkbenchTable(264, -272, 0, [{ id: 'pure_silver', qty: 1 }, { id: 'financial_ledger', qty: 1 }]);

      const ft = _buildMultiStoryBlock(world, helpers, {
        name: 'Financial Annex', cx: 286, cz: -269, w: 16, d: 18,
        floors: 4, floorH: 4.0, wallMat: mats.curtainSpandrel, trimMat: mats.travertine,
        doors: { north: { w: 2.2, style: 'steel' } }, mapColor: '#586772'
      });
      A.addAscenderRig(world, { id: 'asc_bank_annex', name: 'Financial Tower Zipline', bx: 294.4, bz: -269, bottomY: ft.baseY, topY: ft.roofY, outX: 1, outZ: 0 });
    }

    // Canal View Residential Blocks & East Ring Mid-Rise Neighborhoods (Filling Every East Block!)
    _buildMultiStoryBlock(world, helpers, {
      name: 'Canal View North', cx: 221, cz: -330, w: 22, d: 14, floors: 4, floorH: 3.8,
      wallMat: mats.sandstone, doors: { east: { w: 2.1, style: 'wood' } }, balconies: ['west'], mapColor: '#7c6e59'
    });
    _buildMultiStoryBlock(world, helpers, {
      name: 'Canal View South', cx: 221, cz: -309, w: 22, d: 14, floors: 4, floorH: 3.8,
      wallMat: mats.interiorPlaster, upperMat: mats.sandstone, doors: { east: { w: 2.1, style: 'wood' } }, balconies: ['west'], mapColor: '#726a60'
    });
    world._addLootContainer(218, 0.16, -330, 'household', 'Canal View Flat Dresser');
    world._addLootContainer(218, 3.96, -309, 'valuables', '2F Canal Flat Safe');

    _buildMultiStoryBlock(world, helpers, {
      name: 'Waterfront South Hall', cx: 221, cz: -269, w: 22, d: 18, floors: 3, floorH: 3.9,
      wallMat: mats.brickMat || mats.fireRed, upperMat: mats.sandstone, doors: { north: { w: 2.1, style: 'wood' } }, mapColor: '#6b554c'
    });
    const enc = _buildMultiStoryBlock(world, helpers, {
      name: 'Embassy North Tower', cx: 323.5, cz: -373, w: 22, d: 22, floors: 5, floorH: 4.0,
      wallMat: mats.curtainSpandrel, trimMat: mats.ribbedConcrete, doors: { west: { w: 2.3, style: 'steel' } },
      landmark: true, mapColor: '#546470'
    });
    A.addAscenderRig(world, { id: 'asc_north_tower', name: 'Corporate North Ascender', bx: 312.1, bz: -373, bottomY: enc.baseY, topY: enc.roofY, outX: -1, outZ: 0 });
    world._addLootContainer(322, 8.2, -373, 'office', '3F Executive Office Safe');

    _buildMultiStoryBlock(world, helpers, {
      name: 'North Civic Hall', cx: 323.5, cz: -418, w: 22, d: 18, floors: 2, floorH: 4.1,
      wallMat: mats.travertine, doors: { south: { w: 2.2, style: 'wood' } }, mapColor: '#6d6b64'
    });
    _buildMultiStoryBlock(world, helpers, {
      name: 'SE Commerce Depot', cx: 323.5, cz: -269, w: 22, d: 20, floors: 3, floorH: 4.0,
      wallMat: mats.concrete, doors: { north: { w: 2.2, style: 'steel' } }, mapColor: '#61666a'
    });
    _buildMultiStoryBlock(world, helpers, {
      name: 'East Ring Warehouse', cx: 368.5, cz: -418, w: 24, d: 18, floors: 2, floorH: 4.4,
      wallMat: mats.rustBlue, upperMat: mats.concrete, doors: { west: { w: 2.6, style: 'steel' } }, mapColor: '#4e5f6e'
    });
    _buildMultiStoryBlock(world, helpers, {
      name: 'East Ring Apartments A', cx: 368.5, cz: -373, w: 24, d: 22, floors: 4, floorH: 3.9,
      wallMat: mats.sandstone, doors: { west: { w: 2.2, style: 'wood' } }, balconies: ['west', 'south'], mapColor: '#7a6c5a'
    });
    _buildMultiStoryBlock(world, helpers, {
      name: 'East Ring Apartments B', cx: 368.5, cz: -319.5, w: 24, d: 22, floors: 4, floorH: 3.9,
      wallMat: mats.fireRed, upperMat: mats.concrete, doors: { west: { w: 2.2, style: 'wood' } }, balconies: ['west'], mapColor: '#6e524c'
    });
    _buildMultiStoryBlock(world, helpers, {
      name: 'East Ring Market Depot', cx: 368.5, cz: -269, w: 24, d: 18, floors: 2, floorH: 4.2,
      wallMat: mats.travertine, doors: { west: { w: 2.4, style: 'steel' } }, mapColor: '#6e6c63'
    });

    // =========================================================================
    // 4. ELEVATED BOX-GIRDER RING EXPRESSWAY VIADUCT (x = 344, z = -422..-252, y = 13.6m)
    // =========================================================================
    {
      const vx = 344.0, vDeckY = 13.6, vW = 11.4, vLen = 170.0;
      const gnd = world.getTerrainHeight(vx, -337);
      // Deck slab + Lower tapered concrete box-girder spine + Side Jersey Parapets
      world._addBox(vx, vDeckY - 0.30, -337.0, vW, 0.60, vLen, mats.road || mats.concrete, true);
      world._addDecor(vx, vDeckY - 1.05, -337.0, 6.2, 0.90, vLen, mats.ribbedConcrete || mats.darkConcrete);
      world._addBox(vx - vW * 0.5 + 0.30, vDeckY + 0.52, -337.0, 0.55, 1.04, vLen, mats.concrete, true);
      world._addBox(vx + vW * 0.5 - 0.30, vDeckY + 0.52, -337.0, 0.55, 1.04, vLen, mats.concrete, true);
      for (let pz = -414; pz <= -260; pz += 22) {
        const pH = (vDeckY - 1.50) - gnd + 0.5;
        world._addBox(vx - 3.8, gnd + pH * 0.5 - 0.25, pz, 1.4, pH, 1.4, mats.bossDark, true);
        world._addBox(vx + 3.8, gnd + pH * 0.5 - 0.25, pz, 1.4, pH, 1.4, mats.bossDark, true);
        world._addBox(vx, vDeckY - 1.45, pz, vW - 0.8, 0.72, 1.35, mats.bossDark, true);
      }
      // North & South Viaduct Slip-Ramps + Mid-Span Stairway
      helpers.addStaircase(vx, gnd, -438.0, 24, 5.2, vDeckY - gnd, 16.0, 'south');
      helpers.addStaircase(vx, gnd, -236.0, 24, 5.2, vDeckY - gnd, 16.0, 'north');
      world._addBox(vx, vDeckY + 1.4, -350.0, 2.6, 2.8, 6.2, mats.rustOlive, true);
      world._addLootContainer(vx + 2.5, vDeckY - gnd + 0.02, -334.0, 'military', 'Ring Viaduct Convoy Ordnance Case');
      world._addSignBoard(vx - 6.0, vDeckY + 1.8, -340.0, 8.6, 2.2, -Math.PI / 2, {
        title: 'RING EXPRESSWAY', sub: 'ELEVATED VIADUCT // ROUTE M-07', bg: '#133022', accent: '#ffd54f'
      });
      world.cityFootprints.push({ name: 'Ring Highway Viaduct', x: vx, z: -337, w: vW, d: vLen, color: '#6b747a', landmark: false });
    }

    // =========================================================================
    // 5. WEST BANK METROPOLITAN DISTRICT (6.6m TERRACE, 8 EXTRUDED BUILDINGS)
    // =========================================================================
    // Sarwana Grand Riverfront Hotel (x=119.5, z=-319.5, 5F Travertine + Canal Balconies + Ascender)
    {
      const sh = _buildMultiStoryBlock(world, helpers, {
        name: 'Sarwana Grand Hotel', shortLabel: 'SARWANA HOTEL', cx: 119.5, cz: -319.5, w: 19, d: 26,
        floors: 4, floorH: 4.0, wallMat: mats.travertine, upperMat: mats.sandstone, trimMat: mats.travertine,
        floorMat: mats.marbleLobby, archedDoors: true, balconies: ['east'],
        doors: { west: { w: 2.5, style: 'steel', label: 'Sarwana Porte-Cochere' }, east: { w: 2.3, style: 'steel', label: 'Hotel Canal Terrace' } },
        landmark: true, mapColor: '#826b5c', mapStroke: '#ffca28'
      });
      world._addSignBoard(129.5, sh.baseY + 5.0, -319.5, 8.2, 2.2, Math.PI / 2, {
        title: 'SARWANA HOTEL', sub: 'GRAND RIVERFRONT // CANAL PROMENADE', bg: '#2b1918', accent: '#ffca28'
      });
      world._addLootContainer(122, 0.16, -326, 'valuables', 'Sarwana Concierge Safe');
      world._addMedicineCabinet(124, -314, 'east', 'Sarwana Suite Cabinet');
      world._addLootContainer(119, (sh.roofY - sh.baseY) + 0.04, -320, 'military', 'Hotel Roof Sniper Case');
      A.addAscenderRig(world, { id: 'asc_sarwana', name: 'Sarwana Hotel Ascender', bx: 129.4, bz: -314, bottomY: sh.baseY, topY: sh.roofY, outX: 1, outZ: 0 });
    }

    // Channel 7 Broadcast Headquarters + 48m Tapered Lattice TV Tower + Ascender! (x=81, z=-319.5)
    {
      const c7 = _buildMultiStoryBlock(world, helpers, {
        name: 'Channel 7 Studio', shortLabel: 'CHANNEL 7', cx: 81, cz: -319.5, w: 22, d: 22,
        floors: 4, floorH: 4.0, wallMat: mats.ribbedConcrete, upperMat: mats.curtainSpandrel, trimMat: mats.darkConcrete,
        doors: { east: { w: 2.5, style: 'steel', label: 'Channel 7 Lobby' } },
        landmark: true, mapColor: '#486073', mapStroke: '#29b6f6'
      });
      // 48m Red/White Broadcast Tower rising from NE Corner of Channel 7 Roof
      const tx = 86, tz = -325;
      for (let tier = 0; tier < 5; tier++) {
        const wT = 4.2 - tier * 0.62;
        world._addBox(tx, c7.roofY + tier * 6.4 + 3.2, tz, wT, 6.4, wT, (tier % 2 === 0) ? mats.fireRed : mats.whiteWall, tier === 0);
      }
      const c7Beacon = new THREE.Mesh(new THREE.SphereGeometry(0.54, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      c7Beacon.position.set(tx, c7.roofY + 34.5, tz);
      world.scene.add(c7Beacon);
      world.registerLightSource(c7Beacon.position, { intensity: 1.05, maxDist: 300, flareScale: 0.92, anamorphic: true });
      world._addSignBoard(92.4, c7.baseY + 5.2, -319.5, 8.2, 2.2, Math.PI / 2, {
        title: 'CHANNEL 07', sub: 'ADAL METRO BROADCAST // STUDIO', bg: '#14202b', accent: '#29b6f6'
      });
      world._addLootContainer(77, 0.16, -322, 'office', 'Broadcast Master Tape Rack');
      world._addLootContainer(83, 8.2, -316, 'valuables', '3F Executive Producer Safe');
      A.addAscenderRig(world, { id: 'asc_ch7', name: 'Channel 7 Roof Ascender', bx: 92.4, bz: -314, bottomY: c7.baseY, topY: c7.roofY, outX: 1, outZ: 0 });
    }

    // Vaulted Central Bazaar / Souk Hall (118.5, -373) + Orange Exterior Stairs & West Medical Clinic (81, -373)
    {
      const bz = _buildMultiStoryBlock(world, helpers, {
        name: 'Central Bazaar Souk', shortLabel: 'BAZAAR', cx: 118.5, cz: -373, w: 20, d: 22,
        floors: 2, floorH: 4.2, wallMat: mats.sandstone, archedDoors: true, archedWindows: true,
        doors: { west: { w: 2.6, style: 'wood' }, south: { w: 2.6, style: 'wood' } },
        mapColor: '#8c7253'
      });
      // Vaulted Clerestory Roof Monitor + Signature Orange Exterior Steel Stairwell!
      world._addBox(118.5, bz.roofY + 0.95, -373, 12.0, 1.9, 14.0, mats.rustRed, false);
      helpers.addStaircase(107.2, bz.baseY + 0.1, -365.0, 22, 1.8, (bz.roofY - bz.baseY), 13.0, 'north');
      world._addLootContainer(118.5, 0.16, -373, 'supply', 'Bazaar Central Merchant Crate');

      const cl = _buildMultiStoryBlock(world, helpers, {
        name: 'West Canal Clinic', shortLabel: 'CLINIC', cx: 81, cz: -373, w: 20, d: 18,
        floors: 2, floorH: 4.0, wallMat: mats.whiteWall, trimMat: mats.travertine,
        doors: { east: { w: 2.4, style: 'steel' } }, mapColor: '#8b9c96'
      });
      world._addSignBoard(91.4, cl.baseY + 4.8, -373, 4.8, 1.6, Math.PI / 2, 'clinic');
      world._addLootContainer(77, 0.16, -370, 'hospital', 'West Clinic Trauma Supply');
      world._addWallFirstAidKit(86, -366, 'south', 'Clinic Triage Kit');
    }

    // Downtown Post Office (81, -269) + South Riverfront Apartments (117.5, -269) + Gas Station Canopy (102, -242? Check road -246!)
    // Place Gas Station at (164, -264)? Wait -164 is in river! Place West Outer Apartments at (51, -319.5)? Keep within W1/W2!
    // Put Post Office at (81, -269), Riverfront Apartments at (117.5, -269), and Gas Station at (82, -234, south of z=-246 Ave cleanly inside west terrace!)
    {
      const po = _buildMultiStoryBlock(world, helpers, {
        name: 'Downtown Post Office', shortLabel: 'POST OFFICE', cx: 81, cz: -269, w: 22, d: 20,
        floors: 3, floorH: 4.0, wallMat: mats.travertine, archedWindows: true, archedDoors: true,
        doors: { north: { w: 2.5, style: 'steel', label: 'Post Office Public Hall' }, east: { w: 2.4, style: 'steel' } },
        landmark: true, mapColor: '#7c786d', mapStroke: '#69f0ae'
      });
      world._addPartition(84, -278, 84, -260, po.baseY, po.floorH, [
        { at: -269, w: 1.8, door: 'steel', label: 'Post Office Secure Room' }
      ]);
      world._addSignBoard(81, po.baseY + 5.0, -258.6, 7.2, 2.0, 0, {
        title: 'DOWNTOWN POST OFFICE', sub: 'MAIL & SECURE PARCEL VAULT', bg: '#1e2824', accent: '#69f0ae'
      });
      world._addLootContainer(88, 0.16, -269, 'valuables', 'Post Office Secure Room Safe');
      world._addLootContainer(76, 4.16, -269, 'office', '2F Sorting Bureau Records');
      A.addAscenderRig(world, { id: 'asc_post_office', name: 'Post Office Roof Ascender', bx: 92.4, bz: -269, bottomY: po.baseY, topY: po.roofY, outX: 1, outZ: 0 });

      _buildMultiStoryBlock(world, helpers, {
        name: 'South Waterfront Flats', cx: 117.5, cz: -269, w: 18, d: 18,
        floors: 4, floorH: 3.8, wallMat: mats.sandstone, doors: { north: { w: 2.1, style: 'wood' } },
        balconies: ['north', 'east'], mapColor: '#7a6955'
      });
      world._addLootContainer(115, 0.16, -269, 'household', 'Waterfront Flat Wardrobe');
      world._addMedicineCabinet(124, -265, 'east', 'Waterfront Flat Bath Cabinet');

      // Westside Fuel & Gas Station Forecourt (x=82, z=-234 — south of z=-246 South City Ave)
      const gy = world.getTerrainHeight(82, -234);
      world._addBox(82, gy + 4.4, -236, 16.0, 0.48, 8.0, mats.whiteSteel || mats.whiteWall, true);
      for (const fx of [75.5, 88.5]) {
        world._addBox(fx, gy + 2.2, -236, 0.55, 4.4, 0.55, mats.metal, true);
        world._addBox(fx, gy + 0.85, -234, 1.3, 1.7, 0.9, mats.fireRed, true);
      }
      _buildMultiStoryBlock(world, helpers, {
        name: 'Al-Mazrah Gas Mart', shortLabel: 'GAS MART', cx: 82, cz: -225, w: 14, d: 8,
        floors: 1, floorH: 3.9, wallMat: mats.concrete, doors: { north: { w: 2.1, style: 'wood' } },
        skipHVAC: true, mapColor: '#7d4b42'
      });
      world._addLootContainer(82, 0.16, -225, 'supply', 'Service Station Supply Crate');
    }

    // Metropolitan Street Furniture, Light Poles & Battle-Damaged Convoys
    helpers.addFloodlight(242, -365, 0, 11.0, 0xfff0cc);
    helpers.addFloodlight(100, -342, 0, 11.0, 0xfff0cc);
    helpers.addWreckedVehicle(242, -356, 0.14, true, true);
    helpers.addWreckedVehicle(100, -334, -0.09, false, false);
    if (rng() > -1) {
      helpers.addWreckedVehicle(304, -360, 0.06, false, false);
    }

    world.pois.push({ name: 'VOSTOK CITY', x: 242, z: -348, color: '#ffc107', threat: 'boss' });
  }

  return { build, _sampleRiverBAtZ };
})();
