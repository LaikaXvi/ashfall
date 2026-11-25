// ============================================================================
// ASHFALL // Al-Mazrah City Inspired Metropolitan Blockout -> Vostok City
// True human-relative scale & DMZ landmark accuracy across RIVER_B:
//  - 14-Story (52.4m / 68.6m Spire) Vostok Highrise + Skybridge + 58m Lattice Crane
//  - 1-Story Yum Yum Burger Commercial Diner w/ Painted Red [X] Back Room Door
//  - 6-Story Sarwana Grand Atrium Hotel & Colonade
//  - 8-Story Channel 7 Tower + Soundstage Wing + 62m Open-Lattice TV Mast
//  - Downtown Post Office w/ Loading Dock, Neoclassical Bank + 7F Tower, Embassy,
//    Parking Deck P-01, Fire Station 07 w/ Watchtower, Elongated Slabs & 12+ Ascenders
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
   * Build an extruded multi-story building with distinct groundFloorH vs upper floorH,
   * split hollow perimeter spandrels/plinths (zero interior/stairwell/door clipping),
   * realistic human doors (1.44m single / 2.2m double / 3.4m rollup bays),
   * shopfront plate glass & awnings, optional sealed mid-shaft skyscraper curtain-wall
   * floors with continuous interior express ascenders, balconies & AC units.
   */
  function _buildMultiStoryBlock(world, helpers, spec) {
    const A = window.AshfallArchitecture;
    const mats = world._materials;
    const cx = spec.cx;
    const cz = spec.cz;
    const w = spec.w;
    const d = spec.d;
    const floors = spec.floors || 3;
    const gH = spec.groundFloorH || spec.floorH || 3.6;
    const uH = spec.floorH || 3.4;
    const baseY = world.getTerrainHeight(cx, cz);
    const wMat = spec.wallMat || mats.travertine || mats.concrete;
    const upperMat = spec.upperMat || wMat;
    const trimMat = spec.trimMat || mats.darkConcrete;
    const t = 0.44;
    const hx = w * 0.5;
    const hz = d * 0.5;
    const seed = (((cx * 73856093) ^ (cz * 19349663)) >>> 0);

    const floorY = new Array(floors + 1);
    floorY[0] = baseY;
    for (let fl = 0; fl < floors; fl++) {
      floorY[fl + 1] = floorY[fl] + (fl === 0 ? gH : uH);
    }
    const roofY = floorY[floors];
    const totalH = roofY - baseY;

    // Ground foundation & floor plate
    world._addBox(cx, baseY - 0.48, cz, w + 0.72, 0.96, d + 0.72, mats.darkConcrete, false);
    world._addBox(cx, baseY + 0.08, cz, w - 0.16, 0.16, d - 0.16, spec.floorMat || mats.floorTile, false);

    // Optional architectural sealed mid-shaft range (for towering 8-14 story buildings)
    const shaftStart = spec.shaftStartFloor !== undefined ? spec.shaftStartFloor : -1;
    const shaftEnd = spec.shaftEndFloor !== undefined ? spec.shaftEndFloor : -1;
    const isShaftFloor = (fl) => shaftStart >= 0 && fl >= shaftStart && fl <= shaftEnd;

    // Stairwell bay in NE or NW corner
    const swW = Math.min(4.4, w * 0.34);
    const swD = Math.min(9.6, d * 0.56);
    const swOnWest = !!spec.stairWest;
    const swX = swOnWest ? (cx - hx + swW * 0.5 + 0.28) : (cx + hx - swW * 0.5 - 0.28);
    const swZ = cz - hz + swD * 0.5 + 0.28;

    // Optional interior elevator core cutout (x, z, w, d) so express ascender shafts run uninterrupted floor-to-top
    const elCore = spec.elevatorCutout || null;

    const addFloorSlabWithCutout = (yTop, solidOverride = false) => {
      if (elCore && !solidOverride) {
        // Leave E/W or N/S notch around elevator cutout
        const cLeft = elCore.cx - elCore.w * 0.5;
        const leftW = Math.max(2.0, cLeft - (cx - hx + 0.24));
        world._addBox(cx - hx + 0.24 + leftW * 0.5, yTop - 0.15, cz, leftW, 0.30, d - 0.5, mats.darkConcrete, true);
        const remN = (elCore.cz - elCore.d * 0.5) - (cz - hz + 0.24);
        const remS = (cz + hz - 0.24) - (elCore.cz + elCore.d * 0.5);
        const stripW = (cx + hx - 0.24) - cLeft;
        if (remN > 0.6) world._addBox(cLeft + stripW * 0.5, yTop - 0.15, cz - hz + 0.24 + remN * 0.5, stripW, 0.30, remN, mats.darkConcrete, true);
        if (remS > 0.6) world._addBox(cLeft + stripW * 0.5, yTop - 0.15, cz + hz - 0.24 - remS * 0.5, stripW, 0.30, remS, mats.darkConcrete, true);
        return;
      }
      if (!spec.noStairs && !solidOverride) {
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

    const plinthGaps = {};
    const makeOpenings = (side, span, doorCfg, storyIdx, curFH) => {
      const list = [];
      const extraSideDoors = spec.extraDoors && spec.extraDoors[side];
      if (storyIdx === 0 && (doorCfg || extraSideDoors)) {
        const dList = [];
        if (doorCfg) dList.push(doorCfg);
        if (extraSideDoors) dList.push(...extraSideDoors);
        for (const dc of dList) {
          const dw = dc.w || (dc.style === 'glass' || dc.double ? 2.18 : 1.44);
          const uCenter = dc.u !== undefined ? dc.u : span * 0.5;
          const v1 = dc.rollup ? Math.min(curFH - 0.35, dc.h || 3.45) : Math.min(curFH - 0.45, dc.h || (dw >= 1.95 ? 2.46 : 2.34));
          const u0 = uCenter - dw * 0.5;
          const u1 = uCenter + dw * 0.5;
          plinthGaps[side] = plinthGaps[side] || [];
          plinthGaps[side].push({ u0, u1 });
          list.push({
            kind: 'door',
            u0,
            u1,
            v0: dc.rollup ? 0.06 : 0.08,
            v1,
            doorStyle: dc.rollup ? null : (dc.style || 'steel'),
            rollup: !!dc.rollup,
            label: dc.label || `${spec.name} Entrance`,
            canopy: dc.canopy !== false && !dc.rollup,
            arched: !!spec.archedDoors && !dc.rollup
          });
        }
        // Flanking storefront or lobby ground windows if face is wide enough
        if ((spec.shopfront || span >= 12.5) && dList.length === 1 && !dList[0].noFlankWindows) {
          const dc = dList[0];
          const dw = dc.w || 2.18;
          const w0 = spec.shopfront ? 0.42 : 0.90;
          const w1 = spec.shopfront ? Math.min(curFH - 0.60, 2.95) : Math.min(curFH - 0.65, 2.45);
          const halfWin = spec.shopfront ? Math.min(2.1, Math.max(1.0, (span * 0.5 - dw * 0.5) * 0.38)) : 0.95;
          if (span * 0.20 - halfWin > 0.4 && span * 0.20 + halfWin < span * 0.5 - dw * 0.5 - 0.45) {
            list.push({ kind: 'window', u0: span * 0.20 - halfWin, u1: span * 0.20 + halfWin, v0: w0, v1: w1, arched: !!spec.archedWindows });
            list.push({ kind: 'window', u0: span * 0.80 - halfWin, u1: span * 0.80 + halfWin, v0: w0, v1: w1, arched: !!spec.archedWindows });
          }
        }
      } else if (storyIdx === 0 && spec.shopfront) {
        const bays = Math.max(2, Math.floor(span / 5.0));
        for (let b = 0; b < bays; b++) {
          const uc = (span * (b + 0.5)) / bays;
          const hw = Math.min(1.65, (span / bays) * 0.38);
          list.push({ kind: 'window', u0: uc - hw, u1: uc + hw, v0: 0.42, v1: Math.min(curFH - 0.58, 2.95) });
        }
      } else {
        const pitch = spec.windowPitch || 4.4;
        const bays = Math.max(2, Math.floor(span / pitch));
        const hw = Math.min(spec.curtainWall ? 1.45 : 0.86, (span / bays) * (spec.curtainWall ? 0.38 : 0.30));
        const v0 = spec.curtainWall ? 0.72 : 0.90;
        const v1 = Math.min(curFH - 0.45, spec.curtainWall ? (curFH - 0.48) : 2.28);
        for (let b = 0; b < bays; b++) {
          const uc = (span * (b + 0.5)) / bays;
          const openSash = (storyIdx >= 1 && !isShaftFloor(storyIdx) && !spec.curtainWall && (b % 2 === 1)) || !!spec.openUpperWindows;
          list.push({
            kind: 'window',
            u0: uc - hw,
            u1: uc + hw,
            v0,
            v1,
            arched: !!spec.archedWindows && !spec.curtainWall,
            open: openSash
          });
        }
      }
      return list;
    };

    for (let fl = 0; fl < floors; fl++) {
      const yB = floorY[fl];
      const curFH = fl === 0 ? gH : uH;
      const fm = fl === 0 ? wMat : upperMat;
      const dNorth = fl === 0 && spec.doors && spec.doors.north;
      const dSouth = fl === 0 && spec.doors && spec.doors.south;
      const dWest = fl === 0 && spec.doors && spec.doors.west;
      const dEast = fl === 0 && spec.doors && spec.doors.east;

      const sOpenNorth = spec.skybridgeNorthFloor === fl ? [{ kind: 'door', u0: w * 0.5 - 2.0, u1: w * 0.5 + 2.0, v0: 0.08, v1: Math.min(curFH - 0.3, 2.9) }] : null;
      const sOpenSouth = spec.skybridgeSouthFloor === fl ? [{ kind: 'door', u0: w * 0.5 - 2.0, u1: w * 0.5 + 2.0, v0: 0.08, v1: Math.min(curFH - 0.3, 2.9) }] : null;

      A.addPunchedWall(world, cx - hx, cz - hz, cx + hx, cz - hz, yB, curFH, t, fm, trimMat, sOpenNorth || makeOpenings('north', w, dNorth, fl, curFH), { outwardSign: -1 });
      A.addPunchedWall(world, cx - hx, cz + hz, cx + hx, cz + hz, yB, curFH, t, fm, trimMat, sOpenSouth || makeOpenings('south', w, dSouth, fl, curFH), { outwardSign: 1 });
      A.addPunchedWall(world, cx - hx, cz - hz, cx - hx, cz + hz, yB, curFH, t, fm, trimMat, makeOpenings('west', d, dWest, fl, curFH), { outwardSign: 1 });
      A.addPunchedWall(world, cx + hx, cz - hz, cx + hx, cz + hz, yB, curFH, t, fm, trimMat, makeOpenings('east', d, dEast, fl, curFH), { outwardSign: -1 });

      // Hollow perimeter spandrel belt strip between floors (never crosses interiors or stairwells!)
      if (fl < floors - 1) {
        A.addPerimeterBand(world, cx, cz, w, d, floorY[fl + 1], 0.24, 0.16, trimMat);
      }

      if (fl > 0) {
        // Skip interior floor slabs inside sealed visual shaft floors (keep slab at shaftEnd + 1 so penthouse is solid!)
        if (!isShaftFloor(fl)) {
          addFloorSlabWithCutout(yB, isShaftFloor(fl - 1));
        }
        if (spec.balconies && !isShaftFloor(fl) && (!spec.maxBalconyFloor || fl <= spec.maxBalconyFloor)) {
          for (const bf of spec.balconies) {
            if (bf === 'west') A.addCantileverBalcony(world, cx - hx - 0.95, yB, cz, Math.min(9.5, d * 0.54), 1.8, 'west', mats.travertine, mats.metal);
            if (bf === 'east') A.addCantileverBalcony(world, cx + hx + 0.95, yB, cz, Math.min(9.5, d * 0.54), 1.8, 'east', mats.travertine, mats.metal);
            if (bf === 'north') A.addCantileverBalcony(world, cx, yB, cz - hz - 0.95, Math.min(9.5, w * 0.54), 1.8, 'north', mats.travertine, mats.metal);
            if (bf === 'south') A.addCantileverBalcony(world, cx, yB, cz + hz + 0.95, Math.min(9.5, w * 0.54), 1.8, 'south', mats.travertine, mats.metal);
          }
        }
      }

      // Alternating interior stairs for playable floors (skip sealed architectural shaft & top penthouse unless roofStairs)
      const wantStairsHere = !spec.noStairs && !isShaftFloor(fl) && !(shaftStart >= 0 && fl === shaftStart - 1);
      if (wantStairsHere && (fl < floors - 1 || !spec.noRoofStairs)) {
        const yNext = floorY[fl + 1];
        const landS = swZ + swD * 0.5;
        const landN = swZ - swD * 0.5;
        const runLen = Math.max(4.4, swD - 2.6);
        const dirEven = (fl % 2 === 0);
        const xLane = dirEven ? (swX - swW * 0.24) : (swX + swW * 0.24);
        const zStart = dirEven ? (landS - 1.1) : (landN + 1.1);
        const steps = Math.max(12, Math.ceil(curFH / 0.26));
        if (fl === 0 || isShaftFloor(fl - 1)) {
          world._addBox(swX, yB + 0.08, swZ, swW, 0.16, swD, mats.metal, true);
        }
        helpers.addStaircase(xLane, yB + (fl === 0 ? 0.14 : 0), zStart, steps, Math.max(1.5, swW * 0.44), curFH - (fl === 0 ? 0.14 : 0), runLen, dirEven ? 'north' : 'south');
        const arriveZ = dirEven ? landN + 0.5 : landS - 0.5;
        world._addBox(swX, yNext - 0.15, arriveZ, swW, 0.30, 2.2, mats.metal, true);
        if (dirEven) {
          world._addBox(swX + swW * 0.24, yNext - 0.15, swZ, swW * 0.5, 0.30, swD - 1.8, mats.metal, true);
        } else {
          world._addBox(swX - swW * 0.24, yNext - 0.15, swZ, swW * 0.5, 0.30, swD - 1.8, mats.metal, true);
        }
      }
    }

    // Ground perimeter stone plinth split cleanly around doors
    A.addPerimeterBand(world, cx, cz, w, d, baseY + 0.38, 0.76, 0.11, mats.darkConcrete, plinthGaps);

    // Pilasters & AC units
    A.addPilasterGrid(world, cx, cz, w, d, baseY, totalH, spec.pilasterPitch || 6.0, trimMat);
    if (!spec.curtainWall && !spec.skipAC && floors >= 2) {
      A.addWallACUnits(world, cx, cz, w, d, baseY, Math.min(floors, 6), uH, gH, seed);
    }

    // Shopfront striped awning bands
    if (spec.awnings) {
      for (const aw of spec.awnings) {
        const awMat = aw.mat || mats.rustRed;
        if (aw.side === 'north') A.addShopfrontAwning(world, cx + (aw.offset || 0), baseY + 3.45, cz - hz - 0.22, aw.span || w * 0.65, aw.proj || 1.65, 'north', awMat);
        if (aw.side === 'south') A.addShopfrontAwning(world, cx + (aw.offset || 0), baseY + 3.45, cz + hz + 0.22, aw.span || w * 0.65, aw.proj || 1.65, 'south', awMat);
        if (aw.side === 'west') A.addShopfrontAwning(world, cx - hx - 0.22, baseY + 3.45, cz + (aw.offset || 0), aw.span || d * 0.65, aw.proj || 1.65, 'west', awMat);
        if (aw.side === 'east') A.addShopfrontAwning(world, cx + hx + 0.22, baseY + 3.45, cz + (aw.offset || 0), aw.span || d * 0.65, aw.proj || 1.65, 'east', awMat);
      }
    }

    // Roof cap & parapet
    addFloorSlabWithCutout(roofY, !!spec.noRoofStairs || !!spec.solidRoof);
    const defaultPara = floors === 1 ? 0.62 : 0.92;
    A.addCorniceAndParapet(world, cx, cz, w, d, roofY, spec.parapetH !== undefined ? spec.parapetH : defaultPara, spec.parapetTrim || trimMat, spec.parapetMat || upperMat, {});
    if (!spec.skipHVAC) {
      A.addRooftopMechanical(world, cx, roofY, cz, w, d, seed);
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

    return { baseY, roofY, floorY, groundFloorH: gH, floorH: uH };
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
        if (Math.abs(zc - (-399)) < 11.5 || Math.abs(zc - (-348)) < 11.0 || Math.abs(zc - (-292)) < 10.5) continue;
        const sR = _sampleRiverBAtZ(world, zc);
        const wBankX = sR.x - sR.hw - 0.6;
        const eBankX = sR.x + sR.hw + 0.6;
        const seaBot = sR.waterY - 1.75;

        const wWallH = 6.6 - seaBot;
        world._addBox(wBankX, seaBot + wWallH * 0.5, zc, 1.3, wWallH, 12.2, mats.ribbedConcrete || mats.darkConcrete, true);
        world._addBox(wBankX - 5.2, 6.6 - 0.25, zc, 9.6, 0.50, 12.2, mats.plazaPaver || mats.concrete, true);

        const eWallH = 6.8 - seaBot;
        world._addBox(eBankX, seaBot + eWallH * 0.5, zc, 1.3, eWallH, 12.2, mats.ribbedConcrete || mats.darkConcrete, true);
        world._addBox(eBankX + 5.2, 6.8 - 0.25, zc, 9.6, 0.50, 12.2, mats.plazaPaver || mats.concrete, true);

        const isGap = (Math.abs(zc - (-322)) < 7.5 || Math.abs(zc - (-372)) < 5.5 || Math.abs(zc - (-414)) < 5.5);
        if (!isGap) {
          world._addBox(wBankX + 0.12, 6.6 + 0.35, zc, 0.34, 0.70, 12.0, mats.travertine || mats.concrete, true);
          world._addDecor(wBankX + 0.12, 6.6 + 0.90, zc, 0.10, 0.08, 12.0, mats.metal);
          world._addBox(eBankX - 0.12, 6.8 + 0.35, zc, 0.34, 0.70, 12.0, mats.travertine || mats.concrete, true);
          world._addDecor(eBankX - 0.12, 6.8 + 0.90, zc, 0.10, 0.08, 12.0, mats.metal);
        }
        if ((zSeg - (-428)) % 24 === 0) {
          helpers.addFloodlight(wBankX - 2.0, zc, Math.PI / 2, 7.2, 0xfff0cc);
          helpers.addFloodlight(eBankX + 2.0, zc, -Math.PI / 2, 7.2, 0xfff0cc);
        }
      }

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

      for (const sz of [-376, -334, -276]) {
        const sr = _sampleRiverBAtZ(world, sz);
        const bx = sr.x + (sz === -334 ? -6.5 : 5.5);
        world._addBox(bx, sr.waterY + 0.18, sz, 2.3, 0.58, 5.6, mats.rustOlive, true);
        world._addDecor(bx, sr.waterY + 0.58, sz + 1.5, 1.7, 0.30, 1.3, mats.bossDark);
      }
    };
    buildCanalAndPromenades();

    // =========================================================================
    // 2. FOUR ARCHITECTURAL CROSS-RIVER BRIDGES (Proper Batched Parabolic Arches)
    // =========================================================================
    const buildAllBridges = () => {
      // Bridge 1 (z = -398): Al-Mazrah Iconic White Twin-Arch Suspension Bridge!
      const nBr = _sampleRiverBAtZ(world, -398);
      const nDeckY = nBr.waterY + 1.08;
      const archSpan = 42.0;
      const archRise = 10.8;
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
          A.pushRotatedBeam(world, x0, nDeckY + y0, sideZ, x1, nDeckY + y1, sideZ, 0.68, 0.68, wSteel, true);
          if (i > 0 && i % 2 === 0 && y0 > 1.2) {
            world._addDecor(x0, nDeckY + y0 * 0.5, sideZ, 0.12, y0, 0.12, mats.metal);
          }
        }
        world._addBox(nBr.x, nDeckY + 0.52, sideZ, archSpan, 1.02, 0.48, wSteel, true);
      }
      for (const ux of [-0.36, 0, 0.36]) {
        const yBr = nDeckY + archRise * (1 - ux * ux);
        world._addDecor(nBr.x + ux * (archSpan * 0.5), yBr, -398, 0.55, 0.55, 11.4, wSteel);
      }

      // Bridge 2 (z = -348): Central 4-Lane Grand Boulevard Bridge + Walkable Under-Bridge Catwalk!
      const cBr = _sampleRiverBAtZ(world, -348);
      const cDeckY = cBr.waterY + 1.08;
      for (const px of [cBr.x - 19, cBr.x + 19]) {
        world._addBox(px, cDeckY + 3.0, -354.6, 0.95, 6.0, 0.95, mats.travertine, true);
        world._addBox(px, cDeckY + 3.0, -341.4, 0.95, 6.0, 0.95, mats.travertine, true);
        world._addBox(px, cDeckY + 6.1, -348.0, 1.05, 0.85, 14.0, mats.bossDark, false);
      }
      world._addBox(cBr.x, cDeckY + 0.50, -354.2, 40.0, 1.0, 0.50, mats.travertine, true);
      world._addBox(cBr.x, cDeckY + 0.50, -341.8, 40.0, 1.0, 0.50, mats.travertine, true);
      world._addBox(cBr.x - 5.0, cDeckY + 0.36, -348.0, 14.0, 0.70, 0.60, mats.darkConcrete, true);
      const catY = cBr.waterY + 0.45;
      world._addBox(cBr.x, catY, -353.8, 34.0, 0.28, 2.0, mats.grate || mats.metal, true);

      // Bridge 3 (z = -322): Covered Bazaar Pedestrian Footbridge
      const fBrY = 7.45;
      world._addBox(166.0, fBrY - 0.20, -322.0, 52.0, 0.40, 4.4, mats.grate || mats.metal, true);
      world._addBox(166.0, fBrY + 0.52, -324.05, 51.0, 1.04, 0.26, mats.metal, true);
      world._addBox(166.0, fBrY + 0.52, -319.95, 51.0, 1.04, 0.26, mats.metal, true);
      world._addDecor(166.0, fBrY + 3.05, -322.0, 46.0, 0.22, 4.8, mats.rustBlue);
      for (const fpX of [153.5, 178.5]) {
        const pb = _sampleRiverBAtZ(world, -322).waterY - 1.6;
        world._addBox(fpX, (pb + fBrY - 0.4) * 0.5, -322.0, 1.4, fBrY - 0.4 - pb, 4.0, mats.darkConcrete, true);
        world._addDecor(fpX, fBrY + 1.50, -324.0, 0.26, 2.9, 0.26, mats.metal);
        world._addDecor(fpX, fBrY + 1.50, -320.0, 0.26, 2.9, 0.26, mats.metal);
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
        world._addDecor(sBr.x, sDeckY + tH, tz, tSpan, 0.52, 0.52, mats.metal);
        for (let bx = sBr.x - 16; bx < sBr.x + 16; bx += 8) {
          A.pushRotatedBeam(world, bx, sDeckY + 0.6, tz, bx + 4, sDeckY + tH, tz, 0.34, 0.34, mats.metal, true);
          A.pushRotatedBeam(world, bx + 4, sDeckY + tH, tz, bx + 8, sDeckY + 0.6, tz, 0.34, 0.34, mats.metal, true);
        }
        for (let bx = sBr.x - 16; bx <= sBr.x + 16; bx += 8) {
          world._addBox(bx, sDeckY + tH * 0.5, tz, 0.50, tH, 0.50, mats.metal, true);
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
    // 3. SIDEWALK CURBS & METROPOLITAN BLOCKS
    // =========================================================================
    const eastY = 6.8;
    const addBlockCurb = (cx, cz, w, d) => {
      const y = world.getTerrainHeight(cx, cz);
      world._addBox(cx, y + 0.05, cz, w, 0.10, d, mats.plazaPaver || mats.concrete, true);
    };
    addBlockCurb(272, -372.5, 48, 37);  // Highrise Metro Superblock
    addBlockCurb(272, -320, 48, 40);    // Yum Yum & Civic Plaza Block
    addBlockCurb(323.5, -320, 27, 40);  // Embassy Compound Block
    addBlockCurb(119.2, -319.5, 23, 38);// Sarwana Grand Hotel Block
    addBlockCurb(81.0, -320.5, 25, 38); // Channel 7 Broadcast Block

    // =========================================================================
    // 4. THE HIGHRISE 3-STRUCTURE SKYSCRAPER COMPLEX (Col E2: Tower to 52.4m / 68.6m Spire!)
    // =========================================================================
    {
      // 1) Main South Skyscraper: 14 Stories -> 5.8m Lobby + 3.8m 2F + 9-story Curtain-Wall Shaft + 3.8m 13F Boss Suite -> 52.4m MW2 Helipad Roof!
      const ms = _buildMultiStoryBlock(world, helpers, {
        name: 'Vostok Highrise Main',
        shortLabel: 'HIGHRISE 14F',
        cx: 266.0, cz: -366.0, w: 28, d: 16,
        floors: 12, // floors 0..11 => floorY[12] = 52.42m (14-story urban monument scale!)
        groundFloorH: 5.8,
        floorH: 3.60,
        curtainWall: true,
        windowPitch: 3.9,
        pilasterPitch: 5.6,
        shaftStartFloor: 2,
        shaftEndFloor: 10,
        noRoofStairs: false,
        stairWest: true,
        elevatorCutout: { cx: 275.5, cz: -366.0, w: 6.2, d: 9.0 },
        wallMat: mats.curtainSpandrel || mats.bossDark,
        upperMat: mats.curtainSpandrel || mats.concrete,
        trimMat: mats.ribbedConcrete || mats.darkConcrete,
        floorMat: mats.marbleLobby || mats.floorTile,
        doors: {
          west: { w: 2.25, style: 'glass', label: 'Highrise West Lobby' },
          south: { w: 2.30, style: 'glass', label: 'Highrise Main Entrance' },
          north: { w: 2.30, style: 'glass', label: 'Highrise Atrium Foyer' }
        },
        skybridgeNorthFloor: 1,
        parapetH: 1.02,
        solidRoof: true,
        landmark: true,
        mapColor: '#788490',
        mapStroke: '#ffca28'
      });

      const y2F = ms.floorY[1];
      const yPen = ms.floorY[11];
      const yHeli = ms.roofY; // ~52.42m world Y (45.6m above street!)

      // Signature Al-Mazrah White Structural X-Brace Exoskeleton Girders across all Highrise mid-shaft bays!
      const wSteel = mats.whiteSteel || mats.whiteWall;
      for (const fz of [-366.0 - 8.28, -366.0 + 8.28]) {
        for (const baseX of [256.5, 266.0, 275.5]) {
          for (let ti = 2; ti <= 8; ti += 3) {
            const ya = ms.floorY[ti];
            const yb = ms.floorY[ti + 3];
            A.pushRotatedBeam(world, baseX - 4.4, ya, fz, baseX + 4.4, yb, fz, 0.34, 0.28, wSteel, false);
            A.pushRotatedBeam(world, baseX + 4.4, ya, fz, baseX - 4.4, yb, fz, 0.34, 0.28, wSteel, false);
          }
        }
      }
      for (const fx of [266.0 - 14.28, 266.0 + 14.28]) {
        for (const baseZ of [-370.0, -362.0]) {
          for (let ti = 2; ti <= 8; ti += 3) {
            const ya = ms.floorY[ti];
            const yb = ms.floorY[ti + 3];
            A.pushRotatedBeam(world, fx, ya, baseZ - 3.6, fx, yb, baseZ + 3.6, 0.30, 0.26, wSteel, false);
            A.pushRotatedBeam(world, fx, ya, baseZ + 3.6, fx, yb, baseZ - 3.6, 0.30, 0.26, wSteel, false);
          }
        }
      }

      // Twin Interior Express Elevator Shafts (1F/2F -> 13F Penthouse Suite!) framed cleanly with open shafts
      world._addBox(272.2, (ms.baseY + yHeli) * 0.5, -366.0, 0.24, yHeli - ms.baseY, 8.8, mats.windowFrame, false);
      world._addDecor(275.5, ms.baseY + 26.0, -366.0, 5.2, 0.16, 0.22, mats.windowFrame);
      A.addAscenderRig(world, {
        id: 'asc_hr_elev_1f', name: 'Highrise Express Shaft A (1F -> 13F)',
        bx: 275.5, bz: -363.2, bottomY: ms.baseY, topY: yPen, outX: -1, outZ: 0,
        landBottomX: 273.6, landBottomZ: -363.2, landTopX: 273.6, landTopZ: -363.2
      });
      A.addAscenderRig(world, {
        id: 'asc_hr_elev_2f', name: 'Highrise Express Shaft B (2F -> 13F)',
        bx: 275.5, bz: -368.8, bottomY: y2F, topY: yPen, outX: -1, outZ: 0,
        landBottomX: 273.6, landBottomZ: -368.8, landTopX: 273.6, landTopZ: -368.8
      });

      // MW2 Highrise Rooftop (y = 52.4m): Central Helipad ("H"), Twin Roof Offices, Tilted Edge Scaffolding & 16.2m Open-Lattice Spire!
      world._addBox(263.0, yHeli + 0.05, -366.0, 12.2, 0.10, 12.2, mats.darkConcrete, false);
      world._addBox(260.8, yHeli + 0.09, -366.0, 0.85, 0.04, 6.4, mats.hazardAmber, false);
      world._addBox(265.2, yHeli + 0.09, -366.0, 0.85, 0.04, 6.4, mats.hazardAmber, false);
      world._addBox(263.0, yHeli + 0.09, -366.0, 4.4, 0.04, 0.88, mats.hazardAmber, false);
      // Twin MW2 Roof Houses + Tilted Sniper Scaffolding Catwalk on South Edge
      world._addBox(274.2, yHeli + 1.8, -363.5, 6.6, 3.6, 5.8, mats.bossDark, true);
      world._addBox(254.6, yHeli + 1.5, -362.5, 4.2, 3.0, 4.4, mats.concrete, true);
      world._addBox(262.0, yHeli + 0.4, -374.6, 9.6, 0.26, 2.2, mats.grate || mats.metal, true);
      A.pushRotatedBeam(world, 258.0, yHeli - 1.2, -373.8, 258.0, yHeli + 0.4, -375.4, 0.22, 0.22, mats.hazardAmber, false);
      A.pushRotatedBeam(world, 266.0, yHeli - 1.2, -373.8, 266.0, yHeli + 0.4, -375.4, 0.22, 0.22, mats.hazardAmber, false);
      // 16.2m Open-Lattice Spire rising from East Roofhouse (Total Altitude: ~68.6m!)
      A.addLatticeTower(world, 274.2, yHeli + 3.6, -363.5, 2.6, 0.9, 12.4, 4, mats.whiteSteel, mats.fireRed, {
        spireH: 3.8, platforms: true, dishes: true
      });

      // 3D Sculpted Golden Whale Statue over Marble Plaza Basin (266, -376.5)
      const wy = world.getTerrainHeight(266, -376.5);
      const gBrass = mats.goldBrass || mats.hazardAmber;
      world._addBox(266, wy + 0.40, -376.5, 4.8, 0.80, 3.0, mats.marbleLobby || mats.travertine, true);
      A.addOrientedBox(world, 265.7, wy + 1.32, -376.5, 3.4, 0.84, 1.05, gBrass, 0, 0, 0.14, true);
      A.addOrientedBox(world, 267.7, wy + 1.78, -376.5, 0.44, 0.96, 1.70, gBrass, 0, 0, -0.45, true);

      // Highrise 1F Armory Vault [KEY ROOM], Lobby Locker, 2F Skybridge Files, 13F Boss Penthouse Safe & Roof Sniper Case
      world._addPartition(260, -374, 260, -366, ms.baseY, ms.groundFloorH, [
        { at: -370, w: 1.48, door: 'steel', label: 'Highrise Vault Door' }
      ]);
      world._addPartition(252.2, -366, 260, -366, ms.baseY, ms.groundFloorH, []);
      world._addLootContainer(256.0, 0.16, -370.0, 'boss_key_room', 'Vostok Highrise Vault [KEY ROOM]', 'boss_key');
      world._addGunLocker(269.0, -359.5, 0, 'military', 'Highrise Lobby Security Locker');
      world._addLootContainer(260.0, (y2F - ms.baseY) + 0.04, -362.5, 'office', '2F Skybridge Corporate Files');
      world._addLootContainer(264.0, (yPen - ms.baseY) + 0.04, -364.0, 'valuables', '13F Executive Penthouse Safe');
      world._addLootContainer(262.0, (yHeli - ms.baseY) + 0.04, -363.0, 'military', '14F Helipad Sniper Case');

      // 2) Highrise North Wing: 9 Stories -> 37.7m world Y (30.9m above street) + Billboard + Exterior Ascender!
      const nw = _buildMultiStoryBlock(world, helpers, {
        name: 'Highrise North Wing',
        shortLabel: 'HR NORTH 9F',
        cx: 266.0, cz: -384.5, w: 24, d: 11,
        floors: 8, // floors 0..7 => floorY[8] = 37.75m
        groundFloorH: 5.8,
        floorH: 3.55,
        curtainWall: true,
        windowPitch: 4.0,
        shaftStartFloor: 2,
        shaftEndFloor: 6,
        wallMat: mats.ribbedConcrete || mats.concrete,
        upperMat: mats.curtainSpandrel || mats.concrete,
        trimMat: mats.darkConcrete,
        doors: { south: { w: 2.25, style: 'glass', label: 'North Wing Atrium' } },
        skybridgeSouthFloor: 1,
        mapColor: '#6d7984'
      });
      // Glazed 2F Skybridge connecting Main Highrise & North Wing across the Atrium (y = 12.6m, z = -379..-374)
      world._addBox(266.0, y2F - 0.14, -376.5, 4.4, 0.28, 5.4, mats.darkConcrete, true);
      world._addBox(263.95, y2F + 0.55, -376.5, 0.28, 1.1, 5.2, mats.bossDark, true);
      world._addBox(268.05, y2F + 0.55, -376.5, 0.28, 1.1, 5.2, mats.bossDark, true);
      world._addDecor(266.0, y2F + 2.95, -376.5, 4.6, 0.24, 5.4, mats.metal);
      world._addSignBoard(266.0, nw.baseY + 18.0, -390.4, 12.6, 3.8, Math.PI, {
        title: 'VOSTOK HIGHRISE',
        sub: 'AL-MAZRAH FINANCIAL CENTER // HELIPAD 01',
        bg: '#141a22',
        accent: '#ffc107'
      });

      // Two Exterior Highrise Main Ascenders (-> 52.4m Helipad) + North Wing Ascender (-> 37.75m)!
      A.addAscenderRig(world, { id: 'asc_hr_west', name: 'Highrise West Zipline', bx: 251.5, bz: -366.0, bottomY: ms.baseY, topY: yHeli, outX: -1, outZ: 0 });
      A.addAscenderRig(world, { id: 'asc_hr_east', name: 'Highrise East Zipline', bx: 280.5, bz: -368.0, bottomY: ms.baseY, topY: yHeli, outX: 1, outZ: 0 });
      A.addAscenderRig(world, { id: 'asc_hr_north', name: 'Highrise North Ascender', bx: 253.5, bz: -384.5, bottomY: nw.baseY, topY: nw.roofY, outX: -1, outZ: 0 });

      // 3) 58m Open-Lattice Highrise Construction Tower Crane (290.5, -378) overlooking 52.4m Helipad!
      const crX = 290.5, crZ = -378.0;
      const crY = world.getTerrainHeight(crX, crZ);
      const craneDeckY = A.addLatticeTowerCrane(world, crX, crY, crZ, 50.5, 30.0, 11.0, -1);
      A.addAscenderRig(world, {
        id: 'asc_hr_crane', name: 'Tower Crane Ascender (57m)',
        bx: crX - 2.9, bz: crZ, bottomY: crY, topY: craneDeckY, outX: -1, outZ: 0,
        landTopX: crX, landTopZ: crZ
      });

      // Boss & Guards in the 13F Penthouse Suite + Street Guards
      world.bossSpawnPos = new THREE.Vector3(264.0, yPen + 0.25, -365.0);
      world.bossGuardSpawns = [
        new THREE.Vector3(268.0, yPen + 0.25, -362.0),
        new THREE.Vector3(262.0, ms.baseY + 0.25, -361.0),
        new THREE.Vector3(280.0, eastY + 0.25, -320.0),
        new THREE.Vector3(314.0, eastY + 0.25, -320.0),
        new THREE.Vector3(128.0, 6.6 + 0.25, -320.0),
        new THREE.Vector3(82.0, 6.6 + 0.25, -335.0)
      ];
    }

    // =========================================================================
    // 5. NORTH CIVIC CORRIDOR (Parking Deck P-01, Police, Fire Station 07 + Watchtower)
    // =========================================================================
    {
      // Parking Deck P-01 (x=221, z=-419): realistic 3.30m vehicle clearances!
      const pgX = 221, pgZ = -419, pW = 25, pD = 20, deckH = 3.30;
      const py = world.getTerrainHeight(pgX, pgZ);
      world._addBox(pgX, py + 0.08, pgZ, pW, 0.16, pD, mats.darkConcrete, false);
      for (const fl of [1, 2, 3]) {
        const yD = py + fl * deckH;
        world._addBox(pgX - 2.2, yD, pgZ, pW - 5.2, 0.32, pD - 0.6, mats.ribbedConcrete || mats.concrete, true);
        world._addBox(pgX - 2.2, yD + 0.56, pgZ - pD * 0.5 + 0.3, pW - 5.2, 0.92, 0.32, mats.concrete, true);
        world._addBox(pgX - 2.2, yD + 0.56, pgZ + pD * 0.5 - 0.3, pW - 5.2, 0.92, 0.32, mats.concrete, true);
        helpers.addStaircase(pgX + pW * 0.5 - 2.4, py + (fl - 1) * deckH + 0.1, pgZ + (fl % 2 === 1 ? 6.2 : -6.2), 13, 2.6, deckH - 0.05, 10.6, fl % 2 === 1 ? 'north' : 'south');
        world._addBox(pgX + pW * 0.5 - 2.4, yD, pgZ + (fl % 2 === 1 ? -6.8 : 6.8), 3.6, 0.32, 4.0, mats.concrete, true);
      }
      for (const px of [pgX - 11.2, pgX - 2.0, pgX + 6.8]) {
        for (const pz of [pgZ - 8.6, pgZ + 8.6]) {
          world._addBox(px, py + deckH * 1.5, pz, 0.72, deckH * 3.0, 0.72, mats.bossDark, true);
        }
      }
      world._addSignBoard(pgX, py + deckH * 3 + 1.2, pgZ + 10.2, 7.6, 2.0, 0, {
        title: 'DOWNTOWN PARKING',
        sub: 'DECK P-01 // ZAVOD-9 A/1 ACCESS',
        bg: '#1c2428', accent: '#ffa726'
      });
      helpers.addWreckedVehicle(pgX - 4.0, pgZ + 2.0, 0.25, false, false);
      world._addLootContainer(pgX - 5.0, deckH + 0.18, pgZ - 4.0, 'supply', 'Parking 2F Supply Cache');
      world._addLootContainer(pgX - 5.0, deckH * 3 + 0.18, pgZ + 4.0, 'military', 'Parking Roof Overwatch Case');
      world.cityFootprints.push({ name: 'Parking Deck P-01', x: pgX, z: pgZ, w: pW, d: pD, color: '#586269' });

      // ZAVOD-9 A/1 South Forecourt Framing (strictly clear around 214, -374 & z: -370..-356!)
      const zy = world.getTerrainHeight(227, -374);
      world._addBox(228.5, zy + 1.4, -374.0, 2.8, 2.8, 2.8, mats.bossDark, true);
      world._addBox(206.8, zy + 0.5, -363.0, 0.45, 1.0, 0.45, mats.hazardAmber, true);
      world._addBox(221.2, zy + 0.5, -363.0, 0.45, 1.0, 0.45, mats.hazardAmber, true);
    }

    // Police Precinct (261, -419) & Fire Station 07 w/ Twin Rollup Apparatus Bays + Watchtower (287.5, -419)
    _buildMultiStoryBlock(world, helpers, {
      name: 'Police Precinct', cx: 261, cz: -419, w: 22, d: 17, floors: 3, groundFloorH: 4.3, floorH: 3.5,
      wallMat: mats.policeNavy, upperMat: mats.travertine,
      doors: { south: { w: 2.15, style: 'steel', label: 'Police Main Desk' } },
      landmark: true, mapColor: '#3f5a75'
    });
    world._addSignBoard(261, eastY + 4.4, -410.1, 5.4, 1.7, 0, 'police');
    world._addGunLocker(256.5, -415.0, Math.PI / 2, 'police_fire', 'Police Academy Armory Locker');
    world._addLootContainer(262.0, 4.46, -420.0, 'office', '2F Detective Case Archive');

    {
      const fs = _buildMultiStoryBlock(world, helpers, {
        name: 'Fire Station 07', cx: 287.5, cz: -419, w: 16, d: 17, floors: 2, groundFloorH: 4.6, floorH: 3.5,
        wallMat: mats.fireRed,
        doors: { south: { u: 4.5, w: 3.4, rollup: true, noFlankWindows: true } },
        extraDoors: { south: [{ u: 12.2, w: 1.48, style: 'steel', label: 'Firehouse Side Door' }] },
        archedDoors: false, mapColor: '#7d443d'
      });
      // Iconic Hose-Drying Watchtower on NE corner of Fire Station 07
      world._addBox(292.6, fs.roofY + 2.6, -424.6, 4.2, 5.2, 4.2, mats.fireRed, true);
      world._addBox(292.6, fs.roofY + 5.4, -424.6, 4.6, 0.4, 4.6, mats.travertine, true);
      world._addSignBoard(287.5, eastY + 4.8, -410.1, 5.2, 1.7, 0, 'fire');
      world._addGunLocker(282.0, -416.0, Math.PI / 2, 'police_fire', 'Firehouse Rescue Gear Locker');
    }

    // =========================================================================
    // 6. YUM YUM BURGER (1-STORY FAST FOOD DINER w/ RED [X] BACK ROOM), DOWNTOWN ARCADE, EMBASSY & BANK
    // =========================================================================
    {
      // Authentic 1-Story Yum Yum Burger (cx=285.5, cz=-331, w=17, d=13, h=4.35m + 1.10m Diner Fascia = 5.45m!)
      const yy = _buildMultiStoryBlock(world, helpers, {
        name: 'Yum Yum Burger', shortLabel: 'YUM YUM', cx: 285.5, cz: -331, w: 17, d: 13,
        floors: 1, groundFloorH: 4.35, shopfront: true, noStairs: true,
        wallMat: mats.travertine, trimMat: mats.fireRed, parapetMat: mats.fireRed, parapetTrim: mats.hazardAmber, parapetH: 1.10,
        doors: { west: { w: 1.65, style: 'glass', label: 'Yum Yum Dining Entrance' } },
        awnings: [
          { side: 'west', span: 12.0, proj: 1.7, mat: mats.fireRed },
          { side: 'south', span: 15.0, proj: 1.5, mat: mats.fireRed }
        ],
        landmark: true, mapColor: '#8d5b3e', mapStroke: '#ff9800'
      });
      // Diner yellow/red fascia accent stripe
      A.addPerimeterBand(world, 285.5, -331, 17, 13, yy.baseY + 3.85, 0.34, 0.16, mats.hazardAmber);
      // Partitioned Back Room + Bold Painted Red "X" Cross-Bars Over/Beside the Back Room Door!
      world._addPartition(288.0, -337.2, 288.0, -324.8, yy.baseY, 4.35, [
        { at: -331.0, w: 1.48, door: 'steel', label: 'Yum Yum Back Room [X]' }
      ]);
      A.addOrientedBox(world, 287.84, yy.baseY + 1.38, -331.0, 0.08, 1.35, 0.16, mats.fireRed, 0.72, 0, 0, false);
      A.addOrientedBox(world, 287.84, yy.baseY + 1.38, -331.0, 0.08, 1.35, 0.16, mats.fireRed, -0.72, 0, 0, false);
      // Order Counter, Cash Registers & 3 Diner Booths
      world._addBox(284.2, yy.baseY + 0.56, -331.0, 1.1, 0.96, 7.6, mats.hazardAmber, true);
      world._addDecor(284.2, yy.baseY + 1.24, -332.6, 0.55, 0.40, 0.65, mats.bossDark);
      world._addDecor(284.2, yy.baseY + 1.24, -329.4, 0.55, 0.40, 0.65, mats.bossDark);
      for (const bz of [-334.8, -327.2]) {
        world._addBox(280.4, yy.baseY + 0.44, bz, 1.8, 0.72, 1.0, mats.fireRed, true);
        world._addBox(280.4, yy.baseY + 0.46, bz + (bz < -331 ? 1.15 : -1.15), 1.6, 0.76, 0.75, mats.travertine, true);
      }
      // Rooftop "YUM YUM BURGER" Signboard + Iconic 3D Giant Stacked Burger Emblem!
      world._addSignBoard(285.5, yy.roofY + 2.2, -331.0, 7.0, 2.1, -Math.PI / 2, {
        title: 'YUM YUM BURGER', sub: 'DOWNTOWN DINER // BACK ROOM [X]', bg: '#4a1814', accent: '#ffca28'
      });
      world._addDecor(285.5, yy.roofY + 3.6, -331.0, 2.2, 0.55, 2.2, mats.crateSup);
      world._addDecor(285.5, yy.roofY + 4.05, -331.0, 2.3, 0.35, 2.3, mats.doorWood);
      world._addDecor(285.5, yy.roofY + 4.55, -331.0, 2.1, 0.65, 2.1, mats.crateSup);
      world._addLootContainer(291.2, 0.16, -334.0, 'valuables', 'Yum Yum Back Room Cache');
      world._addLootContainer(291.2, 0.16, -327.8, 'supply', 'Walk-In Cooler Supply Crate');

      // Adjacent Downtown Corner Arcade (258.5, -331): 4.3m Shopfront + 3 x 3.35m Residential!
      _buildMultiStoryBlock(world, helpers, {
        name: 'Downtown Corner Arcade', cx: 258.5, cz: -331, w: 19, d: 17,
        floors: 4, groundFloorH: 4.3, floorH: 3.35, shopfront: true,
        wallMat: mats.sandstone, doors: { south: { w: 1.56, style: 'glass' } },
        awnings: [{ side: 'south', span: 15.0, proj: 1.5, mat: mats.rustBlue }],
        balconies: ['south'], mapColor: '#787262'
      });
      world._addLootContainer(255, 4.46, -331, 'office', 'Retail Upper Office Cabinet');
    }

    // Civic Obelisk & Fountain Plaza (x = 271, z = -310)
    {
      const plY = world.getTerrainHeight(271, -310);
      world._addBox(271, plY + 0.06, -310, 28, 0.12, 16, mats.marbleLobby || mats.floorTile, false);
      world._addBox(271, plY + 0.65, -310, 5.2, 1.3, 5.2, mats.travertine, true);
      world._addBox(271, plY + 4.8, -310, 1.5, 8.0, 1.5, mats.concrete, true);
      helpers.addFloodlight(258, -310, 0.7, 9.5, 0xffe4aa);
    }

    // Fortified Diplomatic Embassy Compound (x=323.5, z=-319.5)
    {
      const ex = 323.5, ez = -319.5, ew = 24, ed = 36, wH = 3.0;
      const ey = world.getTerrainHeight(ex, ez);
      world._addBox(ex, ey + wH * 0.5, ez - ed * 0.5, ew, wH, 0.85, mats.darkConcrete, true);
      world._addBox(ex + ew * 0.5, ey + wH * 0.5, ez, 0.85, wH, ed, mats.darkConcrete, true);
      world._addBox(ex - ew * 0.5, ey + wH * 0.5, ez - 10.5, 0.85, wH, 15.0, mats.darkConcrete, true);
      world._addBox(ex - ew * 0.5, ey + wH * 0.5, ez + 10.5, 0.85, wH, 15.0, mats.darkConcrete, true);
      world._addBox(ex - 6.2, ey + wH * 0.5, ez + ed * 0.5, 11.6, wH, 0.85, mats.darkConcrete, true);
      world._addBox(ex + 7.2, ey + wH * 0.5, ez + ed * 0.5, 9.6, wH, 0.85, mats.darkConcrete, true);
      world._addBox(ex - 9.8, ey + 1.5, ez - 14.5, 2.8, 3.0, 2.8, mats.bossDark, true);
      // Entry security bollard chicane + dual courtyard flagpoles
      for (const bz of [ez - 1.6, ez, ez + 1.6]) {
        world._addBox(ex - ew * 0.5 - 1.2, ey + 0.55, bz, 0.42, 1.1, 0.42, mats.hazardAmber, true);
      }
      for (const fz of [ez - 13.0, ez + 13.0]) {
        world._addDecor(ex - 7.5, ey + 4.8, fz, 0.14, 9.6, 0.14, mats.metal);
      }
      const emb = _buildMultiStoryBlock(world, helpers, {
        name: 'U.S. / Diplomatic Embassy', shortLabel: 'EMBASSY', cx: ex + 1.0, cz: ez, w: 17, d: 22,
        floors: 3, groundFloorH: 4.6, floorH: 3.6, wallMat: mats.travertine, archedWindows: true, archedDoors: true,
        doors: { west: { w: 2.25, style: 'glass', label: 'Embassy Chancery Doors' } },
        landmark: true, mapColor: '#6f7b85', mapStroke: '#64b5f6'
      });
      world._addSignBoard(ex - ew * 0.5 - 0.6, ey + 4.2, ez - 8.5, 6.8, 1.9, -Math.PI / 2, {
        title: 'EMBASSY COMPOUND', sub: 'DIPLOMATIC ZONE // RESTRICTED', bg: '#1e242c', accent: '#64b5f6'
      });
      world._addLootContainer(ex + 4.5, 0.16, ez - 5.0, 'valuables', 'Embassy Diplomatic Code Safe');
      world._addLootContainer(ex + 4.5, 4.76, ez + 5.0, 'office', '2F Consular Archive');
      world._addGunLocker(ex - 4.8, ez + 7.5, Math.PI / 2, 'military', 'Embassy Security Locker');
      A.addAscenderRig(world, { id: 'asc_embassy', name: 'Embassy Roof Ascender', bx: ex + 9.9, bz: ez + 6.0, bottomY: emb.baseY, topY: emb.roofY, outX: 1, outZ: 0 });
    }

    // Central Bank of Vostok w/ Neoclassical Portico (260.5, -268.5) & 7F Financial Curtain-Wall Tower (288, -268.5)
    {
      const bk = _buildMultiStoryBlock(world, helpers, {
        name: 'Bank of Vostok', shortLabel: 'CITY BANK', cx: 260.5, cz: -268.5, w: 21, d: 18,
        floors: 3, groundFloorH: 5.2, floorH: 3.7, wallMat: mats.travertine, archedWindows: true, archedDoors: true,
        doors: { north: { w: 2.30, style: 'steel', label: 'Bank Rotunda Doors' } },
        landmark: true, mapColor: '#7a7866', mapStroke: '#ffd54f'
      });
      // Neoclassical 4-Column Portico Steps & Entablature along North Grand Blvd Entrance
      world._addBox(260.5, bk.baseY + 0.16, -258.5, 11.4, 0.32, 2.2, mats.travertine, true);
      for (const px of [255.8, 258.5, 262.5, 265.2]) {
        world._addBox(px, bk.baseY + 2.75, -258.0, 0.65, 5.1, 0.65, mats.travertine, true);
      }
      world._addBox(260.5, bk.baseY + 5.45, -258.2, 11.6, 0.55, 2.4, mats.travertine, true);
      world._addSignBoard(260.5, bk.baseY + 6.3, -257.1, 6.4, 1.8, 0, {
        title: 'BANK OF VOSTOK', sub: 'CENTRAL BULLION DEPOSITORY', bg: '#1c2420', accent: '#ffd54f'
      });
      world._addLootContainer(256, 0.16, -273.5, 'valuables', 'Central Bank Bullion Vault');
      world._addWorkbenchTable(264, -271.5, 0, [{ id: 'pure_silver', qty: 1 }, { id: 'financial_ledger', qty: 1 }]);

      const ft = _buildMultiStoryBlock(world, helpers, {
        name: 'Financial Curtain Tower', cx: 288.0, cz: -268.5, w: 15, d: 18,
        floors: 7, groundFloorH: 4.8, floorH: 3.5, curtainWall: true, windowPitch: 3.8,
        shaftStartFloor: 2, shaftEndFloor: 5,
        wallMat: mats.curtainSpandrel, trimMat: mats.travertine,
        doors: { north: { w: 2.15, style: 'glass' } }, mapColor: '#586772'
      });
      A.addAscenderRig(world, { id: 'asc_bank_annex', name: 'Financial Tower Zipline', bx: 295.9, bz: -268.5, bottomY: ft.baseY, topY: ft.roofY, outX: 1, outZ: 0 });
    }

    // Canal View Elongated Blocks, Corporate North 8F Tower & East Ring Neighborhoods!
    _buildMultiStoryBlock(world, helpers, {
      name: 'Canal View North', cx: 221, cz: -330, w: 16, d: 14, floors: 5, groundFloorH: 4.1, floorH: 3.3, shopfront: true,
      wallMat: mats.sandstone, doors: { east: { w: 1.48, style: 'wood' } },
      awnings: [{ side: 'east', span: 10.0, proj: 1.4, mat: mats.rustOlive }],
      balconies: ['west'], maxBalconyFloor: 4, mapColor: '#7c6e59'
    });
    _buildMultiStoryBlock(world, helpers, {
      name: 'Canal View South', cx: 221, cz: -310, w: 22, d: 14, floors: 4, groundFloorH: 4.1, floorH: 3.3, shopfront: true,
      wallMat: mats.interiorPlaster, upperMat: mats.sandstone, doors: { east: { w: 1.48, style: 'wood' } },
      balconies: ['west'], mapColor: '#726a60'
    });
    world._addLootContainer(218, 0.16, -330, 'household', 'Canal View Flat Dresser');
    world._addLootContainer(218, 4.26, -310, 'valuables', '2F Canal Flat Safe');

    _buildMultiStoryBlock(world, helpers, {
      name: 'Waterfront South Hall', cx: 221, cz: -268.5, w: 22, d: 19, floors: 3, groundFloorH: 4.2, floorH: 3.4,
      wallMat: mats.fireRed, upperMat: mats.sandstone, doors: { north: { w: 1.86, style: 'wood' } }, mapColor: '#6b554c'
    });

    const enc = _buildMultiStoryBlock(world, helpers, {
      name: 'Embassy Corporate Tower', cx: 323.5, cz: -373, w: 21, d: 22, floors: 8, groundFloorH: 4.8, floorH: 3.5,
      curtainWall: true, windowPitch: 4.0, shaftStartFloor: 2, shaftEndFloor: 6,
      wallMat: mats.curtainSpandrel, trimMat: mats.ribbedConcrete,
      doors: { west: { w: 2.20, style: 'glass' } },
      landmark: true, mapColor: '#546470'
    });
    A.addAscenderRig(world, { id: 'asc_north_tower', name: 'Corporate North Ascender', bx: 312.6, bz: -373, bottomY: enc.baseY, topY: enc.roofY, outX: -1, outZ: 0 });
    world._addLootContainer(322, 4.96, -373, 'office', '2F Executive Office Safe');
    world._addLootContainer(322, (enc.floorY[7] - enc.baseY) + 0.04, -373, 'valuables', '8F Penthouse Directorate Safe');

    _buildMultiStoryBlock(world, helpers, {
      name: 'North Civic Hall', cx: 323.5, cz: -419, w: 21, d: 17, floors: 3, groundFloorH: 4.2, floorH: 3.45,
      wallMat: mats.travertine, doors: { south: { w: 1.86, style: 'glass' } }, mapColor: '#6d6b64'
    });
    _buildMultiStoryBlock(world, helpers, {
      name: 'SE Commerce Depot', cx: 323.5, cz: -268.5, w: 21, d: 20, floors: 3, groundFloorH: 4.3, floorH: 3.5,
      wallMat: mats.concrete, doors: { north: { w: 2.15, style: 'steel' } }, mapColor: '#61666a'
    });
    _buildMultiStoryBlock(world, helpers, {
      name: 'East Ring Warehouse', cx: 368.5, cz: -419, w: 26, d: 16, floors: 1, groundFloorH: 6.2, noStairs: true,
      wallMat: mats.rustBlue, doors: { west: { w: 3.5, h: 4.0, rollup: true, noFlankWindows: true } },
      extraDoors: { west: [{ u: 13.0, w: 1.44, style: 'steel', label: 'Warehouse Office Door' }] },
      mapColor: '#4e5f6e'
    });
    _buildMultiStoryBlock(world, helpers, {
      name: 'East Ring Slab A', cx: 368.5, cz: -373, w: 16, d: 26, floors: 5, groundFloorH: 4.2, floorH: 3.3, shopfront: true,
      wallMat: mats.sandstone, doors: { west: { w: 1.54, style: 'wood' } },
      awnings: [{ side: 'west', span: 18.0, proj: 1.5, mat: mats.rustBlue }],
      balconies: ['west', 'south'], maxBalconyFloor: 4, mapColor: '#7a6c5a'
    });
    _buildMultiStoryBlock(world, helpers, {
      name: 'East Ring Slab B', cx: 368.5, cz: -319.5, w: 16, d: 26, floors: 6, groundFloorH: 4.2, floorH: 3.3, shopfront: true,
      wallMat: mats.fireRed, upperMat: mats.concrete, doors: { west: { w: 1.54, style: 'wood' } },
      balconies: ['west'], maxBalconyFloor: 5, mapColor: '#6e524c'
    });
    _buildMultiStoryBlock(world, helpers, {
      name: 'SE Auto & Trade Garage', cx: 368.5, cz: -268.5, w: 22, d: 18, floors: 1, groundFloorH: 5.4, noStairs: true,
      wallMat: mats.travertine, trimMat: mats.bossDark,
      doors: { west: { u: 5.2, w: 3.4, h: 3.8, rollup: true, noFlankWindows: true } },
      extraDoors: { west: [{ u: 13.2, w: 1.48, style: 'steel', label: 'Garage Office Door' }] },
      mapColor: '#6e6c63'
    });

    // =========================================================================
    // 7. ELEVATED BOX-GIRDER RING EXPRESSWAY VIADUCT (x = 344, z = -422..-252, y = 13.6m)
    // =========================================================================
    {
      const vx = 344.0, vDeckY = 13.6, vW = 11.4, vLen = 170.0;
      const gnd = world.getTerrainHeight(vx, -337);
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
      helpers.addStaircase(vx, gnd, -438.0, 24, 5.2, vDeckY - gnd, 16.0, 'south');
      helpers.addStaircase(vx, gnd, -236.0, 24, 5.2, vDeckY - gnd, 16.0, 'north');
      world._addBox(vx, vDeckY + 1.4, -350.0, 2.6, 2.8, 6.2, mats.rustOlive, true);
      world._addLootContainer(vx + 2.5, vDeckY - gnd + 0.02, -334.0, 'military', 'Ring Viaduct Convoy Ordnance Case');
      world._addSignBoard(vx - 6.0, vDeckY + 1.8, -340.0, 8.2, 2.0, -Math.PI / 2, {
        title: 'RING EXPRESSWAY', sub: 'ELEVATED VIADUCT // ROUTE M-07', bg: '#133022', accent: '#ffd54f'
      });
      world.cityFootprints.push({ name: 'Ring Highway Viaduct', x: vx, z: -337, w: vW, d: vLen, color: '#6b747a', landmark: false });
    }

    // =========================================================================
    // 8. WEST BANK METROPOLITAN DISTRICT (Sarwana Grand Hotel, Channel 7 + 62m TV Tower, Bazaar, Clinic, Post Office & Gas Mart)
    // =========================================================================
    // Sarwana Grand Riverfront Hotel (6F Palatial Limestone Hotel w/ Porte-Cochere, Crimson Lobby Carpet & Ascender!)
    {
      const sh = _buildMultiStoryBlock(world, helpers, {
        name: 'Sarwana Grand Hotel', shortLabel: 'SARWANA HOTEL', cx: 119.2, cz: -319.5, w: 20, d: 30,
        floors: 6, groundFloorH: 5.4, floorH: 3.55, wallMat: mats.travertine, upperMat: mats.sandstone, trimMat: mats.travertine,
        floorMat: mats.marbleLobby, archedDoors: true, archedWindows: true,
        balconies: ['east'], maxBalconyFloor: 5,
        doors: {
          west: { w: 2.25, style: 'glass', label: 'Sarwana Porte-Cochere' },
          east: { w: 2.15, style: 'glass', label: 'Hotel Canal Terrace' }
        },
        landmark: true, mapColor: '#826b5c', mapStroke: '#ffca28'
      });
      // West Porte-Cochere Stone Canopy + Crimson Lobby Carpet + Rooftop Pergola Ribs!
      world._addBox(107.7, sh.baseY + 3.85, -319.5, 3.2, 0.42, 7.6, mats.travertine, true);
      world._addBox(106.4, sh.baseY + 1.9, -322.5, 0.56, 3.8, 0.56, mats.travertine, true);
      world._addBox(106.4, sh.baseY + 1.9, -316.5, 0.56, 3.8, 0.56, mats.travertine, true);
      world._addDecor(119.2, sh.baseY + 0.17, -319.5, 16.0, 0.03, 2.8, mats.fireRed);
      for (let gz = -327.0; gz <= -312.0; gz += 3.0) {
        world._addDecor(119.2, sh.roofY + 2.5, gz, 10.0, 0.18, 0.24, mats.travertine);
      }
      world._addSignBoard(129.6, sh.baseY + 5.8, -319.5, 7.8, 2.0, Math.PI / 2, {
        title: 'SARWANA HOTEL', sub: 'GRAND RIVERFRONT // CANAL PROMENADE', bg: '#2b1918', accent: '#ffca28'
      });
      world._addLootContainer(122, 0.16, -327, 'valuables', 'Sarwana Concierge Safe');
      world._addMedicineCabinet(124, -314, 'east', 'Sarwana Suite Cabinet');
      world._addLootContainer(119, (sh.roofY - sh.baseY) + 0.04, -320, 'military', 'Hotel Roof Sniper Case');
      A.addAscenderRig(world, { id: 'asc_sarwana', name: 'Sarwana Hotel Ascender', bx: 129.6, bz: -314, bottomY: sh.baseY, topY: sh.roofY, outX: 1, outZ: 0 });
    }

    // Channel 7 Broadcast Complex: 8F Corporate Media Tower + 2F Soundstage Wing + 62m Open-Lattice TV Broadcast Mast!
    {
      const c7 = _buildMultiStoryBlock(world, helpers, {
        name: 'Channel 7 Studio', shortLabel: 'CHANNEL 7', cx: 80.5, cz: -311.5, w: 18, d: 16,
        floors: 8, groundFloorH: 4.8, floorH: 3.5, curtainWall: true, windowPitch: 4.0,
        shaftStartFloor: 2, shaftEndFloor: 6,
        wallMat: mats.ribbedConcrete, upperMat: mats.curtainSpandrel, trimMat: mats.darkConcrete,
        doors: { east: { w: 2.25, style: 'glass', label: 'Channel 7 Lobby' } },
        landmark: true, mapColor: '#486073', mapStroke: '#29b6f6'
      });
      // Attached 2-Story Broadcast Soundstage Wing (81.0, -329.5, 21x14, 8.0m tall) + Uplink Satellite Dishes!
      const sw = _buildMultiStoryBlock(world, helpers, {
        name: 'Channel 7 Soundstage', shortLabel: 'C7 SOUNDSTAGE', cx: 81.0, cz: -329.5, w: 21, d: 14,
        floors: 2, groundFloorH: 4.4, floorH: 3.6,
        wallMat: mats.ribbedConcrete, upperMat: mats.darkConcrete, trimMat: mats.metal,
        doors: { east: { w: 2.15, style: 'steel', label: 'Soundstage Control Door' } },
        mapColor: '#3f5363'
      });
      // Uplink parabolic dish assemblies on Soundstage roof
      for (const dz of [-332.5, -326.5]) {
        world._addBox(86.0, sw.roofY + 0.75, dz, 0.55, 1.5, 0.55, mats.metal, true);
        A.addOrientedBox(world, 86.0, sw.roofY + 1.85, dz, 2.2, 0.16, 2.2, mats.whiteSteel, 0, 0, 0.52, true);
      }
      // 62.0m Open-Lattice Tapered Red/White Broadcast Tower anchored at Soundstage NW Roof (Total Elevation ~68.6m!)
      A.addLatticeTower(world, 74.5, sw.baseY + 8.0, -331.5, 5.2, 1.2, 54.0, 9, mats.whiteSteel, mats.fireRed, {
        spireH: 8.0, platforms: true, dishes: true
      });
      world._addSignBoard(89.9, c7.baseY + 5.2, -311.5, 7.6, 2.0, Math.PI / 2, {
        title: 'CHANNEL 07', sub: 'ADAL METRO BROADCAST // STUDIO', bg: '#14202b', accent: '#29b6f6'
      });
      world._addLootContainer(77, 0.16, -314, 'office', 'Broadcast Master Tape Rack');
      world._addLootContainer(83, (c7.floorY[7] - c7.baseY) + 0.04, -309, 'valuables', '8F Executive Producer Safe');
      A.addAscenderRig(world, { id: 'asc_ch7', name: 'Channel 7 Roof Ascender', bx: 89.9, bz: -307.0, bottomY: c7.baseY, topY: c7.roofY, outX: 1, outZ: 0 });
    }

    // Vaulted Central Bazaar / Souk Hall (119.2, -373.5) + Signature Orange Exterior Stairs & West Canal Clinic (80.5, -373.5)
    {
      const bz = _buildMultiStoryBlock(world, helpers, {
        name: 'Central Bazaar Souk', shortLabel: 'BAZAAR', cx: 119.2, cz: -373.5, w: 21, d: 24,
        floors: 2, groundFloorH: 4.4, floorH: 3.6, shopfront: true, wallMat: mats.sandstone, archedDoors: true, archedWindows: true,
        doors: { west: { w: 2.25, style: 'wood' }, south: { w: 2.25, style: 'wood' } },
        awnings: [{ side: 'west', span: 16.0, proj: 1.5, mat: mats.rustOlive }],
        mapColor: '#8c7253'
      });
      world._addBox(119.2, bz.roofY + 0.90, -373.5, 12.6, 1.8, 14.8, mats.rustRed, false);
      helpers.addStaircase(107.4, bz.baseY + 0.1, -365.0, 22, 1.8, (bz.roofY - bz.baseY), 13.0, 'north');
      world._addLootContainer(119.2, 0.16, -373.5, 'supply', 'Bazaar Central Merchant Crate');

      const cl = _buildMultiStoryBlock(world, helpers, {
        name: 'West Canal Clinic', shortLabel: 'CLINIC', cx: 80.5, cz: -373.5, w: 20, d: 18,
        floors: 2, groundFloorH: 4.2, floorH: 3.4, wallMat: mats.whiteWall, trimMat: mats.travertine,
        doors: { east: { w: 2.15, style: 'glass' } }, mapColor: '#8b9c96'
      });
      world._addSignBoard(90.9, cl.baseY + 4.5, -373.5, 4.8, 1.6, Math.PI / 2, 'clinic');
      world._addLootContainer(77, 0.16, -370, 'hospital', 'West Clinic Trauma Supply');
      world._addWallFirstAidKit(86, -366, 'south', 'Clinic Triage Kit');
    }

    // Downtown Post Office w/ Loading Dock (80.5, -268.5), South Waterfront Apartments (119.2, -268.5) & Gas Mart (82, -225)
    {
      const po = _buildMultiStoryBlock(world, helpers, {
        name: 'Downtown Post Office', shortLabel: 'POST OFFICE', cx: 80.5, cz: -268.5, w: 22, d: 21,
        floors: 3, groundFloorH: 4.8, floorH: 3.6, wallMat: mats.travertine, archedWindows: true, archedDoors: true,
        doors: {
          north: { w: 2.25, style: 'glass', label: 'Post Office Public Hall' },
          east: { w: 2.15, style: 'steel' },
          south: { u: 6.2, w: 3.2, h: 3.4, rollup: true, noFlankWindows: true }
        },
        landmark: true, mapColor: '#7c786d', mapStroke: '#69f0ae'
      });
      // South mail-van loading dock platform + awning canopy + sorting counter partition
      world._addBox(75.7, po.baseY + 0.45, -256.8, 7.6, 0.90, 2.4, mats.darkConcrete, true);
      world._addDecor(75.7, po.baseY + 3.65, -256.4, 8.0, 0.18, 3.2, mats.metal);
      world._addPartition(84, -278, 84, -259, po.baseY, 4.8, [
        { at: -268.5, w: 1.48, door: 'steel', label: 'Post Office Secure Room' }
      ]);
      world._addSignBoard(80.5, po.baseY + 5.2, -257.6, 7.0, 1.9, 0, {
        title: 'DOWNTOWN POST OFFICE', sub: 'MAIL & SECURE PARCEL VAULT', bg: '#1e2824', accent: '#69f0ae'
      });
      world._addLootContainer(87.5, 0.16, -268.5, 'valuables', 'Post Office Secure Room Safe');
      world._addLootContainer(76, 4.96, -268.5, 'office', '2F Sorting Bureau Records');
      A.addAscenderRig(world, { id: 'asc_post_office', name: 'Post Office Roof Ascender', bx: 91.9, bz: -268.5, bottomY: po.baseY, topY: po.roofY, outX: 1, outZ: 0 });

      _buildMultiStoryBlock(world, helpers, {
        name: 'South Waterfront Flats', cx: 119.2, cz: -268.5, w: 17, d: 21,
        floors: 5, groundFloorH: 4.1, floorH: 3.35, shopfront: true, wallMat: mats.sandstone,
        doors: { north: { w: 1.48, style: 'wood' } },
        awnings: [{ side: 'north', span: 12.0, proj: 1.4, mat: mats.rustRed }],
        balconies: ['north', 'east'], maxBalconyFloor: 4, mapColor: '#7a6955'
      });
      world._addLootContainer(116, 0.16, -268.5, 'household', 'Waterfront Flat Wardrobe');
      world._addMedicineCabinet(125, -265, 'east', 'Waterfront Flat Bath Cabinet');

      // Westside Fuel & Gas Station Forecourt (x=82, z=-235.5) + Compact 1F Gas Mart (82, -225)
      const gy = world.getTerrainHeight(82, -235.5);
      world._addBox(82, gy + 4.1, -235.5, 15.0, 0.44, 7.5, mats.whiteSteel || mats.whiteWall, true);
      world._addDecor(82, gy + 4.25, -235.5, 15.1, 0.16, 7.6, mats.fireRed);
      for (const fx of [76.2, 87.8]) {
        world._addBox(fx, gy + 2.05, -235.5, 0.46, 4.1, 0.46, mats.metal, true);
        world._addBox(fx, gy + 0.85, -234.0, 1.25, 1.7, 0.85, mats.fireRed, true);
      }
      _buildMultiStoryBlock(world, helpers, {
        name: 'Al-Mazrah Gas Mart', shortLabel: 'GAS MART', cx: 82, cz: -225, w: 15, d: 8.5,
        floors: 1, groundFloorH: 3.65, shopfront: true, noStairs: true,
        wallMat: mats.concrete, doors: { north: { w: 1.48, style: 'glass' } },
        awnings: [{ side: 'north', span: 12.0, proj: 1.3, mat: mats.rustBlue }],
        skipHVAC: true, mapColor: '#7d4b42'
      });
      world._addLootContainer(82, 0.16, -225, 'supply', 'Service Station Supply Crate');
    }

    // Metropolitan Street Furniture, Light Poles & Battle-Damaged Convoys
    helpers.addFloodlight(242, -365, 0, 10.0, 0xfff0cc);
    helpers.addFloodlight(100, -342, 0, 10.0, 0xfff0cc);
    helpers.addWreckedVehicle(242, -356, 0.14, true, true);
    helpers.addWreckedVehicle(100, -334, -0.09, false, false);
    if (rng() > -1) {
      helpers.addWreckedVehicle(304, -360, 0.06, false, false);
    }

    world.pois.push({ name: 'VOSTOK CITY', x: 242, z: -348, color: '#ffc107', threat: 'boss' });
  }

  return { build, _sampleRiverBAtZ };
})();
