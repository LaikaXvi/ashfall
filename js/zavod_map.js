// =====================================================================================
// ZAVOD-9 UNDERGROUND COMPLEX — standalone DMZ-style map (separate match from Vostok)
// Blueprint: Koschei Complex (4 isolated airlock entrance sectors, each gated by its own
// puzzle -> dark central Chemical Plant -> Factory wing (north) & Alpha Cluster (south))
// fused with Building 21 (dense, colour-coded, multi-floor sectors with stairwells & lift exfils).
//
// Layout is authored on a 2 m cell grid (two floor layers). A small "layout compiler" paints
// rooms/corridors into the grid, then auto-generates merged wall runs, door openings, lintels,
// railings, floors, ceilings and light fixtures so the whole complex stays coherent & sealed.
// =====================================================================================
(function () {
  if (typeof WastelandWorld === 'undefined') return;
  const P = WastelandWorld.prototype;

  const CELL = 2;
  const GX0 = -364;
  const GZ0 = -244;
  const NX = 364;   // x in [-364, 364)
  const NZ = 264;   // z in [-244, 284)
  const LAYER1_DEFAULT_BASE = 4.2;

  // ---------------------------------------------------------------------------------
  // Layout grid
  // ---------------------------------------------------------------------------------
  class ZavodGrid {
    constructor() {
      this.layers = [new Int16Array(NX * NZ).fill(-1), new Int16Array(NX * NZ).fill(-1)];
      this.regions = [];
      this.byId = new Map();
      this.open = new Map();      // edgeKey -> { h, door, label }
      this.railSkip = new Set();  // edgeKeys where layer-1 railings are omitted (stair tops)
      this.openings = [];         // resolved openings (for doors / blast doors)
    }
    ci(x) { return Math.floor((x - GX0) / CELL); }
    cj(z) { return Math.floor((z - GZ0) / CELL); }
    wx(i) { return GX0 + i * CELL; }
    wz(j) { return GZ0 + j * CELL; }
    at(layer, i, j) {
      if (i < 0 || j < 0 || i >= NX || j >= NZ) return -1;
      return this.layers[layer][j * NX + i];
    }
    region(id, props = null) {
      let r = this.byId.get(id);
      if (!r) {
        r = {
          id, idx: this.regions.length, layer: 0, baseY: 0, ceil: 4.0, extH: null,
          wall: 'concrete', floor: 'concrete', sector: 'PLANT', kind: 'corridor',
          name: id, rects: [], dark: false, flood: null, rad: null, lights: true
        };
        this.regions.push(r);
        this.byId.set(id, r);
      }
      if (props) Object.assign(r, props);
      if (r.layer === 1 && (props && props.baseY === undefined) && r.baseY === 0) r.baseY = LAYER1_DEFAULT_BASE;
      return r;
    }
    rect(id, x0, z0, x1, z1, props = null) {
      const r = this.region(id, props);
      const g = this.layers[r.layer];
      const i0 = this.ci(x0), i1 = this.ci(x1), j0 = this.cj(z0), j1 = this.cj(z1);
      for (let j = j0; j < j1; j++) {
        for (let i = i0; i < i1; i++) {
          if (i >= 0 && j >= 0 && i < NX && j < NZ) g[j * NX + i] = r.idx;
        }
      }
      r.rects.push([x0, z0, x1, z1]);
      return r;
    }
    circle(id, cx, cz, rad, props = null) {
      const r = this.region(id, props);
      const g = this.layers[r.layer];
      const i0 = this.ci(cx - rad), i1 = this.ci(cx + rad), j0 = this.cj(cz - rad), j1 = this.cj(cz + rad);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const px = this.wx(i) + CELL * 0.5;
          const pz = this.wz(j) + CELL * 0.5;
          if (Math.hypot(px - cx, pz - cz) <= rad) g[j * NX + i] = r.idx;
        }
      }
      r.rects.push([cx - rad, cz - rad, cx + rad, cz + rad]);
      r.circle = { cx, cz, rad };
      return r;
    }
    edgeKey(layer, o, i, j) { return `${layer}|${o}|${i}|${j}`; }

    // Open a doorway of width w (meters) on the shared boundary between regions a & b.
    link(aId, bId, w = 2, opts = {}) {
      const ra = this.byId.get(aId);
      const rb = this.byId.get(bId);
      if (!ra || !rb) { console.warn('[ZAVOD] link: missing region', aId, bId); return null; }
      const L = ra.layer;
      const g = this.layers[L];
      const groups = new Map();
      for (const [x0, z0, x1, z1] of ra.rects) {
        const i0 = Math.max(0, this.ci(x0) - 1), i1 = Math.min(NX - 1, this.ci(x1) + 1);
        const j0 = Math.max(0, this.cj(z0) - 1), j1 = Math.min(NZ - 1, this.cj(z1) + 1);
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            if (g[j * NX + i] !== ra.idx) continue;
            const nb = [
              [i + 1, j, 'v', i, j], [i - 1, j, 'v', i - 1, j],
              [i, j + 1, 'h', i, j], [i, j - 1, 'h', i, j - 1]
            ];
            for (const [ni, nj, o, ei, ej] of nb) {
              if (this.at(L, ni, nj) !== rb.idx) continue;
              const line = o === 'v' ? ei : ej;
              const along = o === 'v' ? ej : ei;
              const gk = `${o}|${line}`;
              let grp = groups.get(gk);
              if (!grp) { grp = { o, line, list: new Map() }; groups.set(gk, grp); }
              grp.list.set(along, [ei, ej]);
            }
          }
        }
      }
      if (groups.size === 0) { console.warn('[ZAVOD] link: regions not adjacent', aId, bId); return null; }
      let best = null;
      const at = opts.at || null;
      for (const grp of groups.values()) {
        const alongs = [...grp.list.keys()].sort((p, q) => p - q);
        const runs = [];
        let cur = [alongs[0]];
        for (let k = 1; k < alongs.length; k++) {
          if (alongs[k] === alongs[k - 1] + 1) cur.push(alongs[k]);
          else { runs.push(cur); cur = [alongs[k]]; }
        }
        runs.push(cur);
        for (const run of runs) {
          let score;
          if (at) {
            const lineW = grp.o === 'v' ? this.wx(grp.line + 1) : this.wz(grp.line + 1);
            const perp = grp.o === 'v' ? Math.abs(lineW - at[0]) : Math.abs(lineW - at[1]);
            const aw0 = grp.o === 'v' ? this.wz(run[0]) : this.wx(run[0]);
            const aw1 = grp.o === 'v' ? this.wz(run[run.length - 1] + 1) : this.wx(run[run.length - 1] + 1);
            const ac = grp.o === 'v' ? at[1] : at[0];
            const alongD = ac < aw0 ? aw0 - ac : (ac > aw1 ? ac - aw1 : 0);
            score = perp * 4 + alongD;
          } else {
            score = -run.length;
          }
          if (!best || score < best.score) best = { score, grp, run };
        }
      }
      const { grp, run } = best;
      const n = Math.max(1, Math.min(run.length, Math.round(w / CELL)));
      let centerIdx;
      if (at) {
        const ac = grp.o === 'v' ? at[1] : at[0];
        const cellA = grp.o === 'v' ? this.cj(ac) : this.ci(ac);
        centerIdx = Math.max(run[0], Math.min(run[run.length - 1], cellA));
      } else {
        centerIdx = run[Math.floor((run.length - 1) / 2)];
      }
      let startA = centerIdx - Math.floor((n - 1) / 2);
      startA = Math.max(run[0], Math.min(run[run.length - 1] - n + 1, startA));
      const h = opts.h !== undefined ? opts.h : 2.7;
      const meta = { h, door: opts.door || null, label: opts.label || null, layer: L };
      for (let k = 0; k < n; k++) {
        const [ei, ej] = grp.list.get(startA + k);
        this.open.set(this.edgeKey(L, grp.o, ei, ej), meta);
      }
      const lineW = grp.o === 'v' ? this.wx(grp.line + 1) : this.wz(grp.line + 1);
      const a0 = grp.o === 'v' ? this.wz(startA) : this.wx(startA);
      const a1 = a0 + n * CELL;
      const op = {
        a: aId, b: bId, o: grp.o, layer: L, baseY: L === 1 ? ra.baseY : 0,
        width: n * CELL, h,
        x: grp.o === 'v' ? lineW : (a0 + a1) * 0.5,
        z: grp.o === 'v' ? (a0 + a1) * 0.5 : lineW,
        door: opts.door || null, label: opts.label || null, id: opts.id || null
      };
      this.openings.push(op);
      return op;
    }

    regionAtWorld(x, z, layer = 0) {
      const v = this.at(layer, this.ci(x), this.cj(z));
      return v < 0 ? null : this.regions[v];
    }

    // Greedy rectangle merge of cells per region (optionally filtered per cell)
    mergedRects(layer, keyFn) {
      const out = [];
      const active = new Map();
      for (let j = 0; j <= NZ; j++) {
        const rowRuns = new Map();
        if (j < NZ) {
          let i = 0;
          while (i < NX) {
            const k = keyFn(i, j);
            if (k === null || k === undefined) { i++; continue; }
            let i2 = i + 1;
            while (i2 < NX && keyFn(i2, j) === k) i2++;
            rowRuns.set(`${i}|${i2}|${k}`, { i0: i, i1: i2, k });
            i = i2;
          }
        }
        for (const [rk, a] of active) {
          if (!rowRuns.has(rk)) {
            out.push({ i0: a.i0, i1: a.i1, j0: a.j0, j1: j, k: a.k });
            active.delete(rk);
          } else {
            rowRuns.delete(rk);
          }
        }
        for (const [rk, r] of rowRuns) active.set(rk, { ...r, j0: j });
      }
      return out;
    }
  }

  // ---------------------------------------------------------------------------------
  // Materials
  // ---------------------------------------------------------------------------------
  P._zavodMaterials = function () {
    const M = this._materials;
    const tint = (base, color, tile = null) => {
      const m = base.clone();
      m.color = new THREE.Color(color);
      if (tile) m.userData.tile = tile;
      return m;
    };
    const basic = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, ...opts });
    return {
      concrete: M.concrete,
      dark: M.darkConcrete,
      brut: tint(M.concrete, 0x84837b, 4.0),
      plaster: M.interiorPlaster,
      tile: tint(M.whiteWall, 0xd7ddd6, 1.2),
      lab: tint(M.whiteWall, 0xc7d8cf, 1.2),
      paintGreen: tint(M.interiorPlaster, 0x6d8a72),
      paintBlue: tint(M.interiorPlaster, 0x6c8296),
      paintOchre: tint(M.interiorPlaster, 0xa68f5f),
      paintRed: tint(M.interiorPlaster, 0x8f5d52),
      steel: M.metal,
      darkSteel: tint(M.metal, 0x3c4146),
      floorConcrete: tint(M.concrete, 0x7a7972, 4.0),
      floorEpoxy: tint(M.darkConcrete, 0x4f5a52, 5.0),
      floorTile: M.floorTile,
      floorLino: tint(M.interiorPlaster, 0x7f6a52, 3.0),
      floorGrate: tint(M.metal, 0x55595d, 0.8),
      ceiling: tint(M.concrete, 0x5e5f5b, 5.0),
      ceilingTile: tint(M.whiteWall, 0xb9bbb2, 1.6),
      lightWarm: basic(0xfff1cf),
      lightCool: basic(0xdff4ff),
      lightRed: basic(0xff3326),
      lightGreen: basic(0x5dff9a),
      lightAmber: basic(0xffb53a),
      hazard: M.hazardAmber,
      tankGreen: tint(M.metal, 0x55705a),
      tankRust: tint(M.metal, 0x7d5440),
      pipe: tint(M.metal, 0x8a8f84),
      wood: M.wood,
      crate: M.crateSup,
      rubber: new THREE.MeshLambertMaterial({ color: 0x1d1f21 }),
      bunk: tint(M.metal, 0x58665a),
      mattress: new THREE.MeshLambertMaterial({ color: 0x6e705c }),
      screen: basic(0x2aa36a),
      screenBlue: basic(0x3a86c8),
      toxic: new THREE.MeshPhongMaterial({ color: 0x4fbf3a, emissive: 0x1f5512, shininess: 80, transparent: true, opacity: 0.86 }),
      water: new THREE.MeshPhongMaterial({ color: 0x23414a, specular: 0x8fb8c8, shininess: 90, transparent: true, opacity: 0.78, depthWrite: false }),
      stripe: {
        PLANT: basic(0x7cff9c), A1: basic(0xffa726), A2: basic(0xe6e14a),
        B1: basic(0x4fc3f7), B2: basic(0xff5252), FACTORY: basic(0xb0bec5), ALPHA: basic(0xb388ff)
      }
    };
  };

  // ---------------------------------------------------------------------------------
  // Low-level geometry helpers (batched static decor + optional AABB collider & ray mesh)
  // ---------------------------------------------------------------------------------
  P._zvGeo = function (geo, mat, x, y, z, rotY = 0, opts = {}) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (rotY) mesh.rotation.y = rotY;
    if (opts.rotX) mesh.rotation.x = opts.rotX;
    if (opts.rotZ) mesh.rotation.z = opts.rotZ;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    if (this._batchingOpen && this._batchEntries) {
      this._batchEntries.push({ geometry: geo, matrix: mesh.matrix.clone(), material: mat, castShadow: false, source: null });
    } else {
      this.scene.add(mesh);
    }
    if (opts.shoot) {
      mesh.matrixWorld.copy(mesh.matrix);
      this.shootableMeshes.push(mesh);
      if (opts.wall) this.wallMeshes.push(mesh);
    }
    if (opts.collider) {
      const c = opts.collider;
      this.colliders.push({ minX: c[0], maxX: c[1], minY: c[2], maxY: c[3], minZ: c[4], maxZ: c[5] });
    }
    return mesh;
  };

  // Solid prop box: batched + collider + bullet-blocking
  P._zvBox = function (x, y, z, w, h, d, mat, collider = true) {
    return this._addBox(x, y, z, w, h, d, mat, collider);
  };

  P._zvCyl = function (x, y, z, r, h, mat, seg = 14, collider = true) {
    const geo = new THREE.CylinderGeometry(r, r, h, seg);
    return this._zvGeo(geo, mat, x, y, z, 0, {
      shoot: true,
      collider: collider ? [x - r * 0.92, x + r * 0.92, y - h / 2, y + h / 2, z - r * 0.92, z + r * 0.92] : null
    });
  };

  P._zvPipe = function (x1, y1, z1, x2, y2, z2, r, mat) {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz) || 0.01;
    const geo = new THREE.CylinderGeometry(r, r, len, 8);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    const up = new THREE.Vector3(0, 1, 0);
    mesh.quaternion.setFromUnitVectors(up, new THREE.Vector3(dx / len, dy / len, dz / len));
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    if (this._batchingOpen && this._batchEntries) {
      this._batchEntries.push({ geometry: geo, matrix: mesh.matrix.clone(), material: mat, castShadow: false, source: null });
    } else {
      this.scene.add(mesh);
    }
    return mesh;
  };

  P._zvSign = function (text, sub, x, y, z, rotY, w = 4.2, h = 1.0, color = '#e6e14a') {
    const c = document.createElement('canvas');
    c.width = 512; c.height = Math.round(512 * (h / w));
    const g = c.getContext('2d');
    g.fillStyle = '#16191b';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = color;
    g.fillRect(0, 0, 18, c.height);
    g.fillRect(c.width - 18, 0, 18, c.height);
    g.fillStyle = '#f1f1ea';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const big = Math.floor(c.height * (sub ? 0.40 : 0.55));
    g.font = `bold ${big}px Consolas, "Courier New", monospace`;
    g.fillText(text, c.width / 2, c.height * (sub ? 0.36 : 0.5), c.width - 60);
    if (sub) {
      g.fillStyle = color;
      g.font = `bold ${Math.floor(c.height * 0.24)}px Consolas, "Courier New", monospace`;
      g.fillText(sub, c.width / 2, c.height * 0.76, c.width - 60);
    }
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    this.scene.add(mesh);
    return mesh;
  };

  // ---------------------------------------------------------------------------------
  // Layout compiler: walls, openings, lintels, railings, floors, ceilings, fixtures
  // ---------------------------------------------------------------------------------
  P._zvCompile = function (G, MZ) {
    const wallMat = (r) => MZ[r.wall] || MZ.concrete;
    const T = 0.5;            // wall thickness
    const RAIL_H = 1.05;
    const segs = new Map();   // key -> { o, line, y0, y1, mat, t, list: [] }
    const addSeg = (o, line, along, y0, y1, mat, t = T) => {
      if (y1 - y0 < 0.04) return;
      const k = `${o}|${line}|${y0.toFixed(2)}|${y1.toFixed(2)}|${mat.uuid}|${t}`;
      let s = segs.get(k);
      if (!s) { s = { o, line, y0, y1, mat, t, list: [] }; segs.set(k, s); }
      s.list.push(along);
    };
    const R = (v) => (v >= 0 ? G.regions[v] : null);
    // Layer-0 edge solidity, used to decide what layer-1 needs on top
    const l0EdgeInfo = (o, i, j) => {
      const a = o === 'v' ? G.at(0, i, j) : G.at(0, i, j);
      const b = o === 'v' ? G.at(0, i + 1, j) : G.at(0, i, j + 1);
      if (a === b) return { solidTop: 0, open: true };
      const ra = R(a), rb = R(b);
      let h;
      if (!ra) h = rb.extH || rb.ceil;
      else if (!rb) h = ra.extH || ra.ceil;
      else h = Math.max(ra.ceil, rb.ceil);
      const op = G.open.get(G.edgeKey(0, o, i, j));
      if (op) return { solidTop: h, openTo: op.h, open: true };
      return { solidTop: h, open: false };
    };

    for (let L = 0; L < 2; L++) {
      for (let o of ['v', 'h']) {
        for (let j = 0; j < NZ; j++) {
          for (let i = 0; i < NX; i++) {
            const a = G.at(L, i, j);
            const b = o === 'v' ? G.at(L, i + 1, j) : G.at(L, i, j + 1);
            if (o === 'v' && i >= NX - 1) continue;
            if (o === 'h' && j >= NZ - 1) continue;
            if (a === b) continue;
            const line = o === 'v' ? i : j;
            const along = o === 'v' ? j : i;
            const ra = R(a), rb = R(b);
            const op = G.open.get(G.edgeKey(L, o, i, j));
            if (L === 0) {
              let h;
              let mr;
              if (!ra) { h = rb.extH || rb.ceil; mr = rb; }
              else if (!rb) { h = ra.extH || ra.ceil; mr = ra; }
              else { h = Math.max(ra.ceil, rb.ceil); mr = (ra.wallPrio || 0) >= (rb.wallPrio || 0) ? ra : rb; }
              const mat = wallMat(mr);
              if (op) {
                if (h > op.h + 0.04) addSeg(o, line, along, op.h, h, mat);
              } else {
                addSeg(o, line, along, 0, h, mat);
              }
            } else {
              // Layer 1 (upper floor / mezzanine): only add what the layer-0 wall below doesn't already cover
              const rr = ra || rb;
              const other = ra ? rb : ra;
              const base = rr.baseY;
              const top = other ? Math.max(base + rr.ceil, other.baseY + other.ceil) : base + rr.ceil;
              const mat = wallMat(other && (other.wallPrio || 0) > (rr.wallPrio || 0) ? other : rr);
              const l0 = l0EdgeInfo(o, i, j);
              const cov = !l0.open ? [0, l0.solidTop]
                : ((l0.openTo !== undefined && l0.solidTop > l0.openTo + 0.04) ? [l0.openTo, l0.solidTop] : null);
              const emit = (y0, y1, m, t = T) => {
                if (cov) {
                  if (cov[0] <= y0 + 0.01) y0 = Math.max(y0, cov[1]);
                  else if (cov[0] < y1) { addSeg(o, line, along, y0, Math.min(y1, cov[0]), m, t); y0 = Math.max(y0, cov[1]); }
                }
                if (y1 - y0 > 0.05) addSeg(o, line, along, y0, y1, m, t);
              };
              if (other) {
                if (op) emit(base + op.h, top, mat);
                else emit(base - 0.3, top, mat);
                continue;
              }
              const ci = o === 'v' ? (ra ? i + 1 : i) : i;
              const cj = o === 'h' ? (ra ? j + 1 : j) : j;
              const ri = o === 'v' ? (ra ? i : i + 1) : i;
              const rj = o === 'h' ? (ra ? j : j + 1) : j;
              const below0Void = R(G.at(0, ci, cj));
              const below0Self = R(G.at(0, ri, rj));
              const railOk = !cov || cov[0] >= base + RAIL_H || cov[1] <= base + 0.05;
              const isRailing = below0Void && below0Void.ceil > base + 0.5 &&
                (below0Void.openAbove || below0Void === below0Self) && railOk;
              if (isRailing) {
                if (!G.railSkip.has(G.edgeKey(1, o, i, j))) addSeg(o, line, along, base, base + RAIL_H, MZ.darkSteel, 0.12);
                continue;
              }
              emit(base - 0.3, top, mat);
            }
          }
        }
      }
    }

    // Emit merged wall runs
    let wallCount = 0;
    for (const s of segs.values()) {
      s.list.sort((p, q) => p - q);
      let k0 = s.list[0];
      let prev = k0;
      const flush = (a0, a1) => {
        const len = (a1 - a0 + 1) * CELL;
        const mid = (o) => (o === 'v' ? G.wz(a0) : G.wx(a0)) + len * 0.5;
        const hgt = s.y1 - s.y0;
        const yc = s.y0 + hgt * 0.5;
        if (s.o === 'v') {
          const x = G.wx(s.line + 1);
          this._addBox(x, yc, mid('v'), s.t, hgt, len, s.mat, true);
        } else {
          const z = G.wz(s.line + 1);
          this._addBox(mid('h'), yc, z, len, hgt, s.t, s.mat, true);
        }
        wallCount++;
      };
      for (let n = 1; n < s.list.length; n++) {
        const a = s.list[n];
        if (a !== prev + 1) { flush(k0, prev); k0 = a; }
        prev = a;
      }
      flush(k0, prev);
    }

    // Floors / ceilings / fixtures
    const floorMat = (r) => ({
      concrete: MZ.floorConcrete, epoxy: MZ.floorEpoxy, tile: MZ.floorTile,
      lino: MZ.floorLino, grate: MZ.floorGrate
    }[r.floor] || MZ.floorConcrete);
    const ceilMat = (r) => (r.ceilTile ? MZ.ceilingTile : MZ.ceiling);

    // Layer 0 floors (visual; walk height comes from flat analytical floor at y = 0)
    for (const rc of G.mergedRects(0, (i, j) => { const v = G.at(0, i, j); return v >= 0 ? v : null; })) {
      const r = G.regions[rc.k];
      const x0 = G.wx(rc.i0), x1 = G.wx(rc.i1), z0 = G.wz(rc.j0), z1 = G.wz(rc.j1);
      const geo = new THREE.BoxGeometry(x1 - x0, 0.1, z1 - z0);
      this._applyWorldUVs(geo, x1 - x0, 0.1, z1 - z0, (floorMat(r).userData && floorMat(r).userData.tile) || 3);
      this._zvGeo(geo, floorMat(r), (x0 + x1) / 2, -0.05, (z0 + z1) / 2);
    }
    // Layer 0 ceilings (skipped where an upper-floor slab sits directly on top)
    const l0CeilKey = (i, j) => {
      const v = G.at(0, i, j);
      if (v < 0) return null;
      const r = G.regions[v];
      if (r.noCeil) return null;
      const u = G.at(1, i, j);
      if (u >= 0 && Math.abs(G.regions[u].baseY - r.ceil) < 0.35) return null;
      return v;
    };
    for (const rc of G.mergedRects(0, l0CeilKey)) {
      const r = G.regions[rc.k];
      const x0 = G.wx(rc.i0), x1 = G.wx(rc.i1), z0 = G.wz(rc.j0), z1 = G.wz(rc.j1);
      this._addBox((x0 + x1) / 2, r.ceil + 0.15, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0, ceilMat(r), false);
      this._zvFixtures(r, x0, z0, x1, z1, r.ceil, MZ);
    }
    // Layer 1 floor slabs (walkable colliders) + ceilings
    for (const rc of G.mergedRects(1, (i, j) => { const v = G.at(1, i, j); return v >= 0 ? v : null; })) {
      const r = G.regions[rc.k];
      const x0 = G.wx(rc.i0), x1 = G.wx(rc.i1), z0 = G.wz(rc.j0), z1 = G.wz(rc.j1);
      this._addBox((x0 + x1) / 2, r.baseY - 0.15, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0, floorMat(r), true);
    }
    const l1CeilKey = (i, j) => {
      const v = G.at(1, i, j);
      if (v < 0) return null;
      const r = G.regions[v];
      const below = G.at(0, i, j);
      if (below >= 0 && G.regions[below].ceil >= r.baseY + r.ceil - 0.01) return null;
      return v;
    };
    for (const rc of G.mergedRects(1, l1CeilKey)) {
      const r = G.regions[rc.k];
      const x0 = G.wx(rc.i0), x1 = G.wx(rc.i1), z0 = G.wz(rc.j0), z1 = G.wz(rc.j1);
      const top = r.baseY + r.ceil;
      this._addBox((x0 + x1) / 2, top + 0.15, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0, ceilMat(r), false);
      this._zvFixtures(r, x0, z0, x1, z1, top, MZ);
    }
    // Mezzanine support columns under layer-1 slabs that hover over double-height space
    for (const rc of G.mergedRects(1, (i, j) => {
      const v = G.at(1, i, j);
      if (v < 0) return null;
      const below = G.at(0, i, j);
      return (below >= 0 && G.regions[below].ceil > G.regions[v].baseY + 1) ? v : null;
    })) {
      const r = G.regions[rc.k];
      const x0 = G.wx(rc.i0), x1 = G.wx(rc.i1), z0 = G.wz(rc.j0), z1 = G.wz(rc.j1);
      const w = x1 - x0, d = z1 - z0;
      if (w < 3 || d < 3) continue;
      const along = w >= d;
      const n = Math.max(2, Math.round((along ? w : d) / 12));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const px = along ? x0 + 0.6 + t * (w - 1.2) : (x1 - 0.6);
        const pz = along ? (z1 - 0.6) : z0 + 0.6 + t * (d - 1.2);
        this._addBox(px, (r.baseY - 0.3) / 2, pz, 0.45, r.baseY - 0.3, 0.45, MZ.darkSteel, true);
      }
    }
    // Sector colour floor stripes along corridors (Building 21 style wayfinding)
    for (const rc of G.mergedRects(0, (i, j) => {
      const v = G.at(0, i, j);
      return (v >= 0 && G.regions[v].kind === 'corridor') ? v : null;
    })) {
      const r = G.regions[rc.k];
      const sm = MZ.stripe[r.sector];
      if (!sm) continue;
      const x0 = G.wx(rc.i0), x1 = G.wx(rc.i1), z0 = G.wz(rc.j0), z1 = G.wz(rc.j1);
      const w = x1 - x0, d = z1 - z0;
      if (Math.max(w, d) < 6) continue;
      if (w >= d) this._zvGeo(new THREE.BoxGeometry(w - 0.6, 0.02, 0.3), sm, (x0 + x1) / 2, 0.012, z0 + 0.7);
      else this._zvGeo(new THREE.BoxGeometry(0.3, 0.02, d - 0.6), sm, x0 + 0.7, 0.012, (z0 + z1) / 2);
    }
    return wallCount;
  };

  P._zvFixtures = function (r, x0, z0, x1, z1, y, MZ) {
    if (r.lights === false) return;
    const w = x1 - x0, d = z1 - z0;
    let spacing = r.dark ? 22 : (r.kind === 'corridor' ? 8 : 7);
    spacing = Math.max(spacing, Math.sqrt((w * d) / 70));
    const nx = Math.max(1, Math.round(w / spacing));
    const nz = Math.max(1, Math.round(d / spacing));
    const mat = r.dark ? MZ.lightRed : (r.lightMat ? MZ[r.lightMat] : (r.kind === 'lab' || r.kind === 'server' ? MZ.lightCool : MZ.lightWarm));
    for (let a = 0; a < nx; a++) {
      for (let b = 0; b < nz; b++) {
        const px = x0 + (a + 0.5) * (w / nx);
        const pz = z0 + (b + 0.5) * (d / nz);
        if (r.dark) {
          this._zvGeo(new THREE.BoxGeometry(0.28, 0.18, 0.28), mat, px, y - 0.12, pz);
        } else {
          const along = w >= d;
          this._zvGeo(new THREE.BoxGeometry(along ? 1.5 : 0.28, 0.07, along ? 0.28 : 1.5), mat, px, y - 0.04, pz);
        }
      }
    }
  };

  // Walkable staircase (registered for AI multi-floor pathing). dir: 'north'|'south'|'east'|'west'
  P._zvStairs = function (G, sx, sz, width, rise, dir, baseY = 0, mat = null) {
    const steps = Math.max(4, Math.round(rise / 0.3));
    const stepH = rise / steps;
    const run = steps * 0.6;
    const stepD = run / steps;
    const m = mat || this._materials.metal;
    for (let k = 0; k < steps; k++) {
      const curH = stepH * (k + 1);
      const off = stepD * (k + 0.5);
      let x = sx, z = sz, w = width, d = stepD + 0.06;
      if (dir === 'north') z = sz - off;
      else if (dir === 'south') z = sz + off;
      else if (dir === 'east') { x = sx + off; w = stepD + 0.06; d = width; }
      else { x = sx - off; w = stepD + 0.06; d = width; }
      this._addBox(x, baseY + curH / 2, z, w, curH, d, m, true);
    }
    const dxD = dir === 'east' ? 1 : (dir === 'west' ? -1 : 0);
    const dzD = dir === 'south' ? 1 : (dir === 'north' ? -1 : 0);
    this.staircases.push({
      bottomEntry: new THREE.Vector3(sx - dxD * 1.1, baseY, sz - dzD * 1.1),
      topExit: new THREE.Vector3(sx + dxD * (run + 1.1), baseY + rise, sz + dzD * (run + 1.1)),
      bottomY: baseY,
      topY: baseY + rise
    });
    return { run, topX: sx + dxD * run, topZ: sz + dzD * run };
  };

  // Mark railing gap at a stair top on the layer-1 edge line (world coords span)
  P._zvRailGap = function (G, o, lineWorld, a0, a1) {
    if (o === 'h') {
      const j = G.cj(lineWorld) - 1;
      for (let i = G.ci(a0); i < G.ci(a1); i++) G.railSkip.add(G.edgeKey(1, 'h', i, j));
    } else {
      const i = G.ci(lineWorld) - 1;
      for (let j = G.cj(a0); j < G.cj(a1); j++) G.railSkip.add(G.edgeKey(1, 'v', i, j));
    }
  };

  // ---------------------------------------------------------------------------------
  // Overrides for the standalone underground map
  // ---------------------------------------------------------------------------------
  P._zavodTerrainHeight = function () { return 0; };

  P._zavodRaycastFloor = function (origin, dir, near, far) {
    if (dir.y >= -1e-5) return null;
    const t = (0 - origin.y) / dir.y;
    if (t < near || t > far) return null;
    const px = origin.x + dir.x * t;
    const pz = origin.z + dir.z * t;
    if (!this.zavod || !this.zavod.grid.regionAtWorld(px, pz, 0)) return null;
    return {
      distance: t,
      point: new THREE.Vector3(px, 0, pz),
      face: { normal: new THREE.Vector3(0, 1, 0) },
      object: this.terrainMesh
    };
  };

  P._zavodWaterSurfaceY = function (x, z) {
    if (!this.zavod) return null;
    const r = this.zavod.grid.regionAtWorld(x, z, 0);
    if (!r || !r.flood) return null;
    const f = this.zavod.floods[r.flood];
    if (!f || f.level <= 0.02) return null;
    return f.level;
  };

  P.zavodRegionAt = function (x, z, y = 0) {
    if (!this.zavod) return null;
    const G = this.zavod.grid;
    if (y > 3.2) {
      const up = G.regionAtWorld(x, z, 1);
      if (up && y >= up.baseY - 0.6) return up;
    }
    return G.regionAtWorld(x, z, 0);
  };

  // ---------------------------------------------------------------------------------
  // Main entry: build the standalone ZAVOD-9 map
  // ---------------------------------------------------------------------------------
  P._initZavodMap = function () {
    this.isBunkerMap = true;
    this.mapHalfSize = 372;
    this.tacMapBaseExtent = 390;
    this.MAP_BOUNDARY = [[-352, -244], [356, -244], [356, 280], [-352, 280]];
    this.DAM_BOUNDS = null;
    this.UPPER_RESERVOIR = null;
    this.ROADS = [];
    this.RIVER_POLYGONS = [];
    this.OCEAN_POLY = null;
    this.RESERVOIR_POLY = null;
    this.lightSources = [];
    this.sunDir = new THREE.Vector3(0.2, 1, 0.1).normalize();
    this.operatorSquadCount = 3;
    this._batchCellSize = 56; // finer static batches so interior far-plane culling skips whole sectors
    this.terrainMesh = new THREE.Object3D();
    this.terrainMesh.name = 'zavod_floor';
    this.terrainMesh.userData.isFloor = true;
    const seed = (this.zone && this.zone.seed) || 9009;
    const rnd = this._rng(seed);
    const MZ = this._zavodMaterials();
    const G = new ZavodGrid();
    this.zavod = {
      grid: G, MZ, seed, rnd,
      doors: [], stations: [], lasers: [], floods: {}, rads: {}, wings: [], sectors: [],
      flags: {}, clues: {}, vaultCode: null, extracts: [], loose: [], signs: []
    };
    this._zvLayout(G, MZ);
    this._zvCompile(G, MZ);
    this._zvPopulate(G, MZ, rnd);
    this.pois = this.zavod.pois;
    this.spawnPoints = this.pois.map(p => new THREE.Vector3(p.x, 0, p.z));
  };

  // ---------------------------------------------------------------------------------
  // LAYOUT — all coordinates in meters, snapped to the 2 m grid (x = east, z = south)
  // ---------------------------------------------------------------------------------
  P._zvLayout = function (G, MZ) {
    const Z = this.zavod;
    const cor = (sector, extra = {}) => ({ sector, kind: 'corridor', ceil: 3.6, wall: 'brut', floor: 'concrete', ...extra });
    const room = (sector, kind, name, extra = {}) => ({ sector, kind, name, ceil: 3.6, wall: 'plaster', floor: 'lino', ...extra });

    // ===================== CENTRAL CHEMICAL PLANT (dark zone) =====================
    const plant = { sector: 'PLANT', kind: 'plant', wall: 'dark', floor: 'epoxy', dark: true, lights: true, wallPrio: 3 };
    G.rect('plant_core', -52, -76, 52, 76, { ...plant, name: 'CHEMICAL PLANT', ceil: 14 });
    G.rect('plant_wn', -100, -60, -52, -16, { ...plant, name: 'PLANT WEST LOBE (A/2)', ceil: 10, kind: 'warehouse' });
    G.rect('plant_ws', -100, 16, -52, 60, { ...plant, name: 'PLANT WEST LOBE (A/1)', ceil: 10, kind: 'warehouse' });
    G.rect('plant_en', 52, -60, 100, -16, { ...plant, name: 'PLANT EAST LOBE (B/1)', ceil: 10, kind: 'warehouse' });
    G.rect('plant_es', 52, 16, 100, 60, { ...plant, name: 'PLANT EAST LOBE (B/2)', ceil: 10, kind: 'warehouse' });
    for (const lobe of ['plant_wn', 'plant_ws', 'plant_en', 'plant_es']) G.link('plant_core', lobe, 28, { h: 9 });
    G.rect('vent_ne', 52, -76, 60, -64, { sector: 'PLANT', kind: 'vent', name: 'VENT SHAFT NE', ceil: 2.6, wall: 'darkSteel', floor: 'grate', dark: true });
    G.rect('vent_sw', -60, 64, -52, 76, { sector: 'PLANT', kind: 'vent', name: 'VENT SHAFT SW', ceil: 2.6, wall: 'darkSteel', floor: 'grate', dark: true });
    G.link('plant_core', 'vent_ne', 2, { h: 2.2 });
    G.link('plant_core', 'vent_sw', 2, { h: 2.2 });

    // Factory airlock corridors (D1 / D2 — Factory Key)
    G.rect('fac_cw', -28, -110, -20, -76, cor('FACTORY', { ceil: 5, name: 'FACTORY ACCESS D1' }));
    G.rect('fac_ce', 20, -110, 28, -76, cor('FACTORY', { ceil: 5, name: 'FACTORY ACCESS D2' }));
    G.link('plant_core', 'fac_cw', 6, { h: 4.6, door: 'blast', id: 'D1', label: 'AIRLOCK D/1 — FACTORY' });
    G.link('plant_core', 'fac_ce', 6, { h: 4.6, door: 'blast', id: 'D2', label: 'AIRLOCK D/2 — FACTORY' });

    // Alpha Cluster airlock corridors (C1 / C2 — battery + cables panel)
    G.rect('alpha_cw', -28, 76, -20, 100, cor('ALPHA', { ceil: 5, name: 'ALPHA ACCESS C1' }));
    G.rect('alpha_ce', 20, 76, 28, 100, cor('ALPHA', { ceil: 5, name: 'ALPHA ACCESS C2' }));
    G.link('plant_core', 'alpha_cw', 6, { h: 4.6, door: 'blast', id: 'C1', label: 'AIRLOCK C/1 — ALPHA CLUSTER' });
    G.link('plant_core', 'alpha_ce', 6, { h: 4.6, door: 'blast', id: 'C2', label: 'AIRLOCK C/2 — ALPHA CLUSTER' });

    // ===================== FACTORY — WEAPONS MANUFACTURING (north) =====================
    G.rect('factory_hall', -90, -200, 90, -110, { sector: 'FACTORY', kind: 'factory', name: 'WEAPONS MANUFACTURING HALL', ceil: 14, extH: 14, wall: 'brut', floor: 'epoxy', wallPrio: 2 });
    G.link('factory_hall', 'fac_cw', 8, { h: 5 });
    G.link('factory_hall', 'fac_ce', 8, { h: 5 });
    const mez = { layer: 1, baseY: 5.6, ceil: 8.4, sector: 'FACTORY', kind: 'mezzanine', name: 'FACTORY MEZZANINE', wall: 'brut', floor: 'grate', lights: false };
    G.rect('factory_mez', -90, -200, 90, -190, mez);
    G.rect('factory_mez', -90, -190, -80, -128, mez);
    G.rect('factory_mez', 80, -190, 90, -128, mez);
    G.rect('factory_freight', -10, -222, 10, -200, { sector: 'FACTORY', kind: 'lift', name: 'FACTORY FREIGHT ELEVATOR', ceil: 6, wall: 'darkSteel', floor: 'grate', lightMat: 'lightAmber' });
    G.link('factory_hall', 'factory_freight', 10, { h: 5 });
    G.rect('factory_office', 54, -226, 90, -200, room('FACTORY', 'office', 'FOREMAN OFFICE', { ceil: 4 }));
    G.link('factory_hall', 'factory_office', 2, { door: 'hinge', label: 'Foreman Office', at: [70, -200] });
    G.rect('factory_qc', -90, -226, -54, -200, room('FACTORY', 'lab', 'QC TEST RANGE', { ceil: 4.5, wall: 'tile', floor: 'tile' }));
    G.link('factory_hall', 'factory_qc', 2, { door: 'hinge', label: 'QC Range', at: [-70, -200] });
    G.rect('factory_store', -130, -196, -90, -146, room('FACTORY', 'armory', 'FACTORY ARMORY STORE', { ceil: 6, wall: 'brut', floor: 'concrete' }));
    G.link('factory_hall', 'factory_store', 6, { h: 4.5 });

    // ===================== ALPHA CLUSTER (south) =====================
    G.rect('alpha_junc', -28, 100, 28, 108, cor('ALPHA', { ceil: 5, name: 'ALPHA JUNCTION' }));
    G.link('alpha_cw', 'alpha_junc', 8, { h: 5 });
    G.link('alpha_ce', 'alpha_junc', 8, { h: 5 });
    G.rect('alpha_long', -4, 108, 4, 176, cor('ALPHA', { ceil: 4.5, name: 'ALPHA LONG CORRIDOR' }));
    G.link('alpha_junc', 'alpha_long', 8, { h: 4.5 });
    G.rect('alpha_s1', 4, 118, 20, 132, room('ALPHA', 'storage', 'TAPE STORAGE'));
    G.rect('alpha_s2', -20, 136, -4, 150, room('ALPHA', 'security', 'SECURITY POST'));
    G.rect('alpha_s3', 4, 154, 20, 168, room('ALPHA', 'records', 'RECORDS ROOM'));
    G.link('alpha_long', 'alpha_s1', 2, { door: 'hinge', label: 'Tape Storage' });
    G.link('alpha_long', 'alpha_s2', 2, { door: 'hinge', label: 'Security Post' });
    G.link('alpha_long', 'alpha_s3', 2, { door: 'hinge', label: 'Records' });
    G.rect('alpha_hall', -76, 176, 76, 246, { sector: 'ALPHA', kind: 'serverhall', name: 'ALPHA CLUSTER SERVER HALL', ceil: 8, wall: 'tile', floor: 'tile', wallPrio: 2 });
    G.link('alpha_long', 'alpha_hall', 8, { h: 4.5 });
    G.rect('alpha_vault', -16, 246, 16, 270, room('ALPHA', 'vault', 'CODE VAULT', { ceil: 5, wall: 'darkSteel', floor: 'concrete' }));
    G.link('alpha_hall', 'alpha_vault', 6, { h: 4.2, door: 'blast', id: 'VAULT', label: 'CODE VAULT' });
    G.rect('alpha_l2c', 76, 204, 140, 212, cor('ALPHA', { ceil: 4, name: 'L2 ACCESS CORRIDOR' }));
    G.link('alpha_hall', 'alpha_l2c', 6, { h: 3.8, door: 'blast', id: 'L2', label: 'L2 SECURE ACCESS' });
    G.rect('alpha_l2lift', 140, 196, 160, 220, { sector: 'ALPHA', kind: 'lift', name: 'L2 EXFIL LIFT', ceil: 5, wall: 'darkSteel', floor: 'grate', lightMat: 'lightAmber' });
    G.link('alpha_l2c', 'alpha_l2lift', 8, { h: 4 });
    G.rect('alpha_archive', -104, 196, -76, 226, room('ALPHA', 'records', 'SEALED ARCHIVE', { ceil: 4.5, wall: 'paintOchre' }));
    G.link('alpha_hall', 'alpha_archive', 6, { h: 4.2, door: 'blast', id: 'ARCHIVE', label: 'SEALED ARCHIVE' });

    // ===================== A/2 — DEFENSE RESEARCH DIVISION (NW, radioactive) =====================
    const a2 = (kind, name, rad, extra = {}) => room('A2', kind, name, { wall: 'lab', floor: 'tile', rad, ...extra });
    G.rect('a2_entry', -344, -216, -320, -190, { sector: 'A2', kind: 'lift', name: 'A/2 INFIL ELEVATOR LOBBY', ceil: 5, wall: 'brut', floor: 'concrete' });
    G.rect('a2_c0', -320, -206, -290, -198, cor('A2'));
    G.link('a2_entry', 'a2_c0', 8, { h: 3.6 });
    G.rect('a2_hub1', -290, -216, -262, -180, a2('labhub', 'DRD SUB-SECTOR 1', 1, { ceil: 5 }));
    G.rect('a2_r1a', -288, -236, -266, -216, a2('lab', 'ISOTOPE LAB 1-A', 1));
    G.rect('a2_r1b', -262, -212, -246, -194, a2('lab', 'HOT CELL 1-B', 1));
    G.rect('a2_r1c', -306, -188, -290, -170, a2('lab', 'DECON 1-C', 1));
    G.link('a2_c0', 'a2_hub1', 8, { h: 3.6 });
    G.link('a2_hub1', 'a2_r1a', 2, { door: 'hinge', label: 'Isotope Lab' });
    G.link('a2_hub1', 'a2_r1b', 2, { door: 'hinge', label: 'Hot Cell' });
    G.link('a2_hub1', 'a2_r1c', 2, { door: 'hinge', label: 'Decon' });
    G.rect('a2_c1', -262, -188, -228, -180, cor('A2'));
    G.link('a2_hub1', 'a2_c1', 6, { h: 3.6, door: 'blast', id: 'A2S1', label: 'HERMETIC SEAL 1' });
    G.rect('a2_hub2', -228, -200, -196, -164, a2('labhub', 'DRD SUB-SECTOR 2', 2, { ceil: 5 }));
    G.link('a2_c1', 'a2_hub2', 8, { h: 3.6 });
    G.rect('a2_r2a', -228, -222, -212, -200, a2('lab', 'REACTOR CONTROL 2-A', 2));
    G.rect('a2_r2b', -212, -222, -196, -200, a2('lab', 'DIRECTOR LAB 2-B', 2));
    G.rect('a2_r2c', -196, -190, -178, -170, a2('lab', 'SAMPLE VAULT 2-C', 2));
    G.rect('a2_r2d', -228, -164, -212, -148, a2('lab', 'CRYO STORE 2-D', 2));
    G.link('a2_hub2', 'a2_r2a', 2, { door: 'hinge', label: 'Reactor Control' });
    G.link('a2_hub2', 'a2_r2b', 2, { door: 'hinge', label: 'Director Lab' });
    G.link('a2_hub2', 'a2_r2c', 2, { door: 'hinge', label: 'Sample Vault' });
    G.link('a2_hub2', 'a2_r2d', 2, { door: 'hinge', label: 'Cryo Store' });
    G.rect('a2_c2', -208, -164, -200, -126, cor('A2'));
    G.link('a2_hub2', 'a2_c2', 6, { h: 3.6, door: 'blast', id: 'A2S2', label: 'HERMETIC SEAL 2' });
    G.rect('a2_hub3', -216, -126, -180, -94, a2('labhub', 'DRD SUB-SECTOR 3', 3, { ceil: 5 }));
    G.link('a2_c2', 'a2_hub3', 8, { h: 3.6 });
    G.rect('a2_r3a', -234, -122, -216, -102, a2('lab', 'CENTRIFUGE 3-A', 3));
    G.rect('a2_r3b', -180, -126, -162, -110, a2('lab', 'SECURE LAB 3-B', 3));
    G.rect('a2_r3c', -210, -94, -190, -78, a2('lab', 'WASTE 3-C', 3));
    G.link('a2_hub3', 'a2_r3a', 2, { door: 'hinge', label: 'Centrifuge' });
    G.link('a2_hub3', 'a2_r3b', 2, { door: 'hinge', label: 'Secure Lab' });
    G.link('a2_hub3', 'a2_r3c', 2, { door: 'hinge', label: 'Waste Store' });
    G.rect('a2_c3', -180, -106, -134, -98, cor('A2'));
    G.link('a2_hub3', 'a2_c3', 6, { h: 3.6, door: 'blast', id: 'A2S3', label: 'HERMETIC SEAL 3' });
    G.rect('a2_c4', -142, -98, -134, -44, cor('A2'));
    G.link('a2_c3', 'a2_c4', 8, { h: 3.6 });
    G.rect('a2_lock', -142, -44, -100, -30, { sector: 'A2', kind: 'airlock', name: 'A/2 PLANT AIRLOCK', ceil: 5, wall: 'darkSteel', floor: 'grate' });
    G.link('a2_c4', 'a2_lock', 8, { h: 3.6 });
    G.link('a2_lock', 'plant_wn', 6, { h: 4.6, door: 'blast', id: 'A2', label: 'AIRLOCK A/2' });
    // Yellow secret passage DRD -> Factory armory (needs both DRD Exit Keys)
    G.rect('drd_yellow', -178, -182, -130, -174, cor('A2', { name: 'YELLOW PASSAGE', wall: 'paintOchre', ceil: 3.4 }));
    G.link('a2_r2c', 'drd_yellow', 4, { h: 3.0, door: 'blast', id: 'YELLOW', label: 'YELLOW HERMETIC SEAL' });
    G.link('drd_yellow', 'factory_store', 6, { h: 3.2 });

    // ===================== A/1 — INFORMATION EXTRACTION (SW, cartel) =====================
    const a1 = (kind, name, extra = {}) => room('A1', kind, name, { wall: 'paintGreen', ...extra });
    G.rect('a1_entry', -344, 150, -320, 176, { sector: 'A1', kind: 'lift', name: 'A/1 INFIL ELEVATOR LOBBY', ceil: 5, wall: 'brut', floor: 'concrete' });
    G.rect('a1_c0', -320, 158, -262, 166, cor('A1'));
    G.link('a1_entry', 'a1_c0', 8, { h: 3.6 });
    G.rect('a1_lobby', -262, 128, -236, 172, a1('security', 'A/1 SECURITY LOBBY', { ceil: 4.5, floor: 'tile' }));
    G.link('a1_c0', 'a1_lobby', 8, { h: 3.6 });
    const hall = cor('A1', { name: 'A/1 HALLWAYS', wall: 'paintGreen', floor: 'lino' });
    G.rect('a1_hall', -236, 60, -230, 140, hall);
    G.rect('a1_hall', -170, 34, -164, 140, hall);
    G.rect('a1_hall', -236, 134, -164, 140, hall);
    G.rect('a1_hall', -236, 96, -164, 102, hall);
    G.rect('a1_hall', -236, 60, -164, 66, hall);
    G.link('a1_lobby', 'a1_hall', 4, { h: 2.8, at: [-236, 136] });
    const a1rooms = [
      ['a1_n1', -230, 66, -210, 96, 'interrogation', 'INTERROGATION 1'],
      ['a1_n2', -210, 66, -190, 96, 'cells', 'HOLDING CELLS'],
      ['a1_n3', -190, 66, -170, 96, 'records', 'RECORDS'],
      ['a1_s1', -230, 102, -210, 134, 'guard', 'GUARD ROOM'],
      ['a1_s2', -210, 102, -190, 134, 'interrogation', 'INTERROGATION 2'],
      ['a1_s3', -190, 102, -170, 134, 'armory', 'CARTEL ARMORY']
    ];
    for (const [id, x0, z0, x1, z1, kind, name] of a1rooms) {
      G.rect(id, x0, z0, x1, z1, a1(kind, name));
      G.link('a1_hall', id, 2, { door: 'hinge', label: name, at: [(x0 + x1) / 2, z0] });
      G.link('a1_hall', id, 2, { door: 'hinge', label: name, at: [(x0 + x1) / 2, z1] });
    }
    G.rect('a1_x1', -236, 40, -200, 60, a1('server', 'DATA EXTRACTION LAB', { wall: 'tile', floor: 'tile' }));
    G.rect('a1_x2', -200, 40, -170, 60, a1('generator', 'GENERATOR ROOM', { wall: 'brut', floor: 'concrete', ceil: 4.5 }));
    G.link('a1_hall', 'a1_x1', 2, { door: 'hinge', label: 'Data Lab', at: [-218, 60] });
    G.link('a1_hall', 'a1_x2', 2, { door: 'hinge', label: 'Generator', at: [-184, 60] });
    G.link('a1_x1', 'a1_x2', 2, { door: 'hinge', label: 'Generator' });
    G.rect('a1_y1', -236, 140, -200, 170, a1('dorm', 'CARTEL BARRACKS'));
    G.rect('a1_y2', -200, 140, -164, 170, a1('mess', 'MESS HALL', { floor: 'tile' }));
    G.link('a1_hall', 'a1_y1', 2, { door: 'hinge', label: 'Barracks', at: [-218, 140] });
    G.link('a1_hall', 'a1_y2', 4, { h: 2.8, at: [-182, 140] });
    G.rect('a1_c2', -164, 34, -156, 42, cor('A1'));
    G.rect('a1_c3', -122, 34, -100, 42, cor('A1'));
    G.circle('a1_round', -140, 38, 20, { sector: 'A1', kind: 'round', name: 'EXTRACTION ROTUNDA', ceil: 7, wall: 'brut', floor: 'concrete', wallPrio: 2 });
    G.link('a1_hall', 'a1_c2', 8, { h: 3.6 });
    G.link('a1_c2', 'a1_round', 4, { h: 3.6 });
    G.link('a1_round', 'a1_c3', 4, { h: 3.6 });
    G.link('a1_c3', 'plant_ws', 6, { h: 4.6, door: 'blast', id: 'A1', label: 'AIRLOCK A/1' });

    // ===================== B/1 — BARRACKS (NE, flooded) =====================
    const b1 = (kind, name, flood, extra = {}) => room('B1', kind, name, { wall: 'paintBlue', floor: 'lino', flood, ...extra });
    G.rect('b1_entry', 320, -236, 344, -210, { sector: 'B1', kind: 'lift', name: 'B/1 INFIL ELEVATOR LOBBY', ceil: 5, wall: 'brut', floor: 'concrete' });
    G.rect('b1_c0', 326, -210, 334, -150, cor('B1'));
    G.link('b1_entry', 'b1_c0', 8, { h: 3.6 });
    const dormBlock = (pfx, hx0, hx1, z0, z1, wx0, ex1, rowsZ, nameBase) => {
      G.rect(`${pfx}_hall`, hx0, z0, hx1, z1, cor('B1', { name: `${nameBase} HALL`, wall: 'paintBlue', floor: 'lino', flood: 'b1' }));
      rowsZ.forEach(([rz0, rz1], k) => {
        const kinds = ['dorm', 'dorm', 'wash', 'dorm', 'locker', 'dorm'];
        const kindW = kinds[(k * 2) % kinds.length];
        const kindE = kinds[(k * 2 + 1) % kinds.length];
        G.rect(`${pfx}_w${k}`, wx0, rz0, hx0, rz1, b1(kindW, `${nameBase} ${kindW.toUpperCase()} W${k + 1}`, 'b1'));
        G.rect(`${pfx}_e${k}`, hx1, rz0, ex1, rz1, b1(kindE, `${nameBase} ${kindE.toUpperCase()} E${k + 1}`, 'b1'));
        G.link(`${pfx}_hall`, `${pfx}_w${k}`, 2, { door: 'hinge', label: 'Bunk Room' });
        G.link(`${pfx}_hall`, `${pfx}_e${k}`, 2, { door: 'hinge', label: 'Bunk Room' });
      });
    };
    dormBlock('b1r', 326, 334, -150, -62, 308, 352, [[-150, -128], [-128, -106], [-106, -84], [-84, -62]], 'BLOCK R');
    G.link('b1_c0', 'b1r_hall', 8, { h: 3.6 });
    dormBlock('b1t', 234, 242, -206, -120, 214, 262, [[-206, -186], [-186, -166], [-166, -146], [-146, -120]], 'BLOCK T');
    dormBlock('b1l', 130, 138, -110, -20, 110, 160, [[-110, -88], [-88, -66], [-66, -44], [-44, -20]], 'BLOCK L');
    const truss = cor('B1', { name: 'TRUSS GALLERY', wall: 'brut', ceil: 4.5 });
    G.rect('b1_truss', 204, -100, 290, -92, truss);
    G.rect('b1_truss', 204, -70, 308, -62, truss);
    G.rect('b1_truss', 204, -92, 212, -70, truss);
    G.rect('b1_truss', 282, -92, 290, -70, truss);
    G.rect('b1_pump', 212, -92, 282, -70, room('B1', 'pump', 'PUMP STATION', { wall: 'brut', floor: 'concrete', ceil: 4.5 }));
    G.link('b1_truss', 'b1_pump', 4, { h: 3.2, at: [247, -92] });
    G.link('b1_truss', 'b1_pump', 4, { h: 3.2, at: [247, -70] });
    G.link('b1_truss', 'b1r_w3', 6, { h: 3.2 });
    G.rect('b1_c1', 234, -120, 242, -100, cor('B1'));
    G.link('b1t_hall', 'b1_c1', 8, { h: 3.6 });
    G.link('b1_c1', 'b1_truss', 8, { h: 3.6 });
    G.rect('b1_c2', 160, -82, 204, -74, cor('B1'));
    G.link('b1_c2', 'b1_truss', 8, { h: 3.6 });
    G.link('b1_c2', 'b1l_e1', 6, { h: 3.2 });
    G.rect('b1_lock', 100, -44, 110, -30, { sector: 'B1', kind: 'airlock', name: 'B/1 PLANT AIRLOCK', ceil: 5, wall: 'darkSteel', floor: 'grate' });
    G.link('b1_lock', 'b1l_w3', 6, { h: 3.2 });
    G.link('b1_lock', 'plant_en', 6, { h: 4.6, door: 'blast', id: 'B1', label: 'AIRLOCK B/1' });

    // ===================== B/2 — EXTERNAL OPS (SE, al-Qatala) — 2-floor HQ (Building 21) =====================
    const b2 = (kind, name, extra = {}) => room('B2', kind, name, { wall: 'paintRed', floor: 'lino', ceil: 4.2, extH: 8.4, ceilTile: true, ...extra });
    const b2u = (kind, name, extra = {}) => room('B2', kind, name, { layer: 1, baseY: 4.2, wall: 'paintRed', floor: 'lino', ceil: 4.2, ceilTile: true, ...extra });
    G.rect('b2_entry', 320, 190, 344, 216, { sector: 'B2', kind: 'lift', name: 'B/2 INFIL ELEVATOR LOBBY', ceil: 5, wall: 'brut', floor: 'concrete' });
    G.rect('b2_c0', 290, 198, 320, 206, cor('B2'));
    G.link('b2_entry', 'b2_c0', 8, { h: 3.6 });
    const gHall = cor('B2', { name: 'EXT-OPS GROUND HALL', ceil: 4.2, extH: 8.4, wall: 'paintRed', floor: 'lino' });
    G.rect('b2_g_hall', 202, 144, 278, 150, gHall);
    G.rect('b2_g_hall', 202, 190, 278, 196, gHall);
    G.rect('b2_g_hall', 202, 150, 208, 190, gHall);
    G.rect('b2_g_hall', 272, 150, 278, 190, gHall);
    G.rect('b2_atrium', 226, 150, 254, 190, { sector: 'B2', kind: 'atrium', name: 'OPERATIONS ATRIUM', ceil: 8.4, extH: 8.4, wall: 'brut', floor: 'tile', openAbove: true, wallPrio: 2 });
    G.link('b2_g_hall', 'b2_atrium', 28, { h: 8.4, at: [240, 150] });
    G.link('b2_g_hall', 'b2_atrium', 28, { h: 8.4, at: [240, 190] });
    const gRooms = [
      ['b2_iw1', 208, 150, 226, 170, 'office', 'OPS PLANNING'],
      ['b2_iw2', 208, 170, 226, 190, 'comms', 'COMMS ROOM'],
      ['b2_ie1', 254, 150, 272, 170, 'office', 'LOGISTICS'],
      ['b2_ie2', 254, 170, 272, 190, 'armory', 'EXT-OPS ARMORY'],
      ['b2_n1', 190, 120, 214, 144, 'security', 'NORTH CHECKPOINT'],
      ['b2_n2', 214, 120, 240, 144, 'office', 'BRIEFING ROOM'],
      ['b2_n3', 240, 120, 266, 144, 'storage', 'SUPPLY CAGE'],
      ['b2_n4', 266, 120, 290, 144, 'office', 'DISPATCH'],
      ['b2_s1', 190, 196, 214, 220, 'mess', 'CANTEEN'],
      ['b2_s2', 214, 196, 240, 220, 'office', 'ADMIN'],
      ['b2_s3', 240, 196, 266, 220, 'medical', 'FIELD CLINIC'],
      ['b2_recep', 266, 196, 290, 220, 'security', 'RECEPTION'],
      ['b2_w2', 190, 170, 202, 196, 'storage', 'JANITOR STORE'],
      ['b2_e2', 278, 170, 290, 196, 'storage', 'EVIDENCE LOCKER']
    ];
    for (const [id, x0, z0, x1, z1, kind, name] of gRooms) G.rect(id, x0, z0, x1, z1, b2(kind, name));
    G.rect('b2_stw', 190, 144, 202, 170, b2('stair', 'STAIRWELL WEST (RED)', { ceil: 8.4, wall: 'brut', floor: 'concrete', ceilTile: false }));
    G.rect('b2_ste', 278, 144, 290, 170, b2('stair', 'STAIRWELL EAST (RED)', { ceil: 8.4, wall: 'brut', floor: 'concrete', ceilTile: false }));
    for (const id of ['b2_iw1', 'b2_iw2', 'b2_ie1', 'b2_ie2', 'b2_n1', 'b2_n2', 'b2_n3', 'b2_n4', 'b2_s1', 'b2_s2', 'b2_s3', 'b2_w2', 'b2_e2']) {
      G.link('b2_g_hall', id, 2, { door: 'hinge', label: G.byId.get(id).name });
    }
    G.link('b2_g_hall', 'b2_recep', 4, { h: 2.8 });
    G.link('b2_g_hall', 'b2_stw', 4, { h: 2.8 });
    G.link('b2_g_hall', 'b2_ste', 4, { h: 2.8 });
    G.link('b2_c0', 'b2_recep', 8, { h: 3.6 });
    // Upper floor (2F)
    const uHall = cor('B2', { layer: 1, baseY: 4.2, name: 'EXT-OPS 2F GALLERY', ceil: 4.2, wall: 'paintRed', floor: 'lino' });
    G.rect('b2_u_hall', 202, 144, 278, 150, uHall);
    G.rect('b2_u_hall', 202, 190, 278, 196, uHall);
    G.rect('b2_u_hall', 202, 150, 208, 190, uHall);
    G.rect('b2_u_hall', 272, 150, 278, 190, uHall);
    const uRooms = [
      ['b2_u_iw1', 208, 150, 226, 170, 'office', 'INTEL ANALYSIS'],
      ['b2_u_iw2', 208, 170, 226, 190, 'server', 'SIGINT SERVERS'],
      ['b2_u_ie1', 254, 150, 272, 170, 'office', 'COMMANDER QUARTERS'],
      ['b2_u_ie2', 254, 170, 272, 190, 'office', 'MAP ROOM'],
      ['b2_u_n1', 190, 120, 214, 144, 'dorm', 'OFFICER BUNKS'],
      ['b2_u_n2', 214, 120, 240, 144, 'office', 'WAR ROOM'],
      ['b2_u_n3', 240, 120, 266, 144, 'records', 'ARCHIVE 2F'],
      ['b2_u_n4', 266, 120, 290, 144, 'office', 'PAYROLL'],
      ['b2_u_s1', 190, 196, 214, 220, 'dorm', 'GUARD BUNKS'],
      ['b2_u_s2', 214, 196, 240, 220, 'office', 'FINANCE'],
      ['b2_u_s3', 240, 196, 266, 220, 'lab', 'INTERROGATION LAB'],
      ['b2_u_cmd', 266, 196, 290, 220, 'command', 'COMMAND CENTER'],
      ['b2_u_w2', 190, 170, 202, 196, 'storage', 'SUPPLY 2F'],
      ['b2_u_e2', 278, 170, 290, 196, 'storage', 'ARMS 2F']
    ];
    for (const [id, x0, z0, x1, z1, kind, name] of uRooms) {
      G.rect(id, x0, z0, x1, z1, b2u(kind, name));
      G.link('b2_u_hall', id, 2, { door: 'hinge', label: name });
    }
    G.rect('b2_u_stw', 190, 144, 202, 152, b2u('landing', 'WEST LANDING'));
    G.rect('b2_u_ste', 278, 144, 290, 152, b2u('landing', 'EAST LANDING'));
    G.link('b2_u_hall', 'b2_u_stw', 4, { h: 2.8 });
    G.link('b2_u_hall', 'b2_u_ste', 4, { h: 2.8 });
    // Security corridor (laser gates) -> fuse box airlock -> plant
    G.rect('b2_c1', 190, 30, 198, 120, cor('B2', { name: 'EXT-OPS SERVICE CORRIDOR' }));
    G.link('b2_c1', 'b2_n1', 4, { h: 2.8 });
    G.rect('b2_sec', 120, 30, 190, 42, cor('B2', { name: 'LASER SECURITY CORRIDOR', ceil: 3.8, wall: 'darkSteel' }));
    G.link('b2_c1', 'b2_sec', 12, { h: 3.6 });
    G.rect('b2_lock', 100, 30, 120, 42, { sector: 'B2', kind: 'airlock', name: 'B/2 PLANT AIRLOCK', ceil: 4.5, wall: 'darkSteel', floor: 'grate' });
    G.link('b2_sec', 'b2_lock', 12, { h: 3.8 });
    G.link('b2_lock', 'plant_es', 6, { h: 4.4, door: 'blast', id: 'B2', label: 'AIRLOCK B/2' });

    // Stairwells (B2 HQ, red sector): west & east, rising north onto 2F landings
    this._zvStairs(G, 194, 160.4, 3.6, 4.2, 'north', 0, MZ.brut);
    this._zvRailGap(G, 'h', 152, 192, 196);
    this._zvStairs(G, 286, 160.4, 3.6, 4.2, 'north', 0, MZ.brut);
    this._zvRailGap(G, 'h', 152, 284, 288);
    // Factory mezzanine stairs (rise 5.6 m to the north catwalk)
    this._zvStairs(G, -58, -178.6, 3.6, 5.6, 'north', 0, MZ.darkSteel);
    this._zvRailGap(G, 'h', -190, -60, -56);
    this._zvStairs(G, 58, -178.6, 3.6, 5.6, 'north', 0, MZ.darkSteel);
    this._zvRailGap(G, 'h', -190, 56, 60);

    Z.sectors = [
      { id: 'PLANT', name: 'CHEMICAL PLANT', x: 0, z: 0, color: '#7cff9c' },
      { id: 'FACTORY', name: 'FACTORY // WEAPONS MFG', x: 0, z: -160, color: '#b0bec5' },
      { id: 'ALPHA', name: 'ALPHA CLUSTER', x: 0, z: 212, color: '#b388ff' },
      { id: 'A2', name: 'A/2 DEFENSE RESEARCH', x: -230, z: -150, color: '#e6e14a' },
      { id: 'A1', name: 'A/1 INFO EXTRACTION', x: -220, z: 100, color: '#ffa726' },
      { id: 'B1', name: 'B/1 BARRACKS', x: 240, z: -110, color: '#4fc3f7' },
      { id: 'B2', name: 'B/2 EXTERNAL OPS', x: 240, z: 170, color: '#ff5252' }
    ];
  };
})();
