// =====================================================================================
// ZAVOD-9 — population pass: blast doors & hinged doors, Koschei-style sector puzzles,
// Building-21-style dense furnishing, loot, quest items, AI garrisons, lift exfils & signage.
// =====================================================================================
(function () {
  if (typeof WastelandWorld === 'undefined') return;
  const P = WastelandWorld.prototype;

  // ---------------------------------------------------------------------------------
  // Blast doors (Koschei airlocks / hermetic seals): slide up when opened
  // ---------------------------------------------------------------------------------
  P._zvBlastDoor = function (op, MZ) {
    const alongZ = op.o === 'v';
    const w = op.width, h = op.h, t = 0.42;
    const by = op.baseY || 0;
    const g = new THREE.Group();
    const slabMat = MZ.darkSteel;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? t : w, h, alongZ ? w : t), slabMat);
    slab.position.y = h / 2;
    g.add(slab);
    // Hazard chevron bands (both faces)
    const bandN = Math.max(2, Math.round(w / 1.2));
    for (let k = 0; k < bandN; k++) {
      const off = -w / 2 + (k + 0.5) * (w / bandN);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? t + 0.04 : 0.42, 0.55, alongZ ? 0.42 : t + 0.04), k % 2 ? MZ.rubber : MZ.hazard);
      stripe.position.set(alongZ ? 0 : off, 0.45, alongZ ? off : 0);
      g.add(stripe);
    }
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 8, 18), MZ.pipe);
    wheel.position.y = h * 0.55;
    if (alongZ) wheel.rotation.y = Math.PI / 2;
    g.add(wheel);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xff3326 });
    const lamps = [];
    for (const s of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 0.12 : 0.5, 0.22, alongZ ? 0.5 : 0.12), lampMat);
      lamp.position.set(alongZ ? s * (t / 2 + 0.06) : 0, h - 0.35, alongZ ? 0 : s * (t / 2 + 0.06));
      g.add(lamp);
      lamps.push(lamp);
    }
    g.position.set(op.x, by, op.z);
    g.userData.noCull = true;
    g.userData.isDoor = true;
    this.scene.add(g);
    const half = alongZ ? { x: 0.3, z: w / 2 } : { x: w / 2, z: 0.3 };
    const collider = { minX: op.x - half.x, maxX: op.x + half.x, minY: by, maxY: by + h, minZ: op.z - half.z, maxZ: op.z + half.z };
    this.colliders.push(collider);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? t : w, h, alongZ ? w : t), slabMat);
    proxy.position.set(op.x, by + h / 2, op.z);
    proxy.updateMatrix();
    proxy.matrixWorld.copy(proxy.matrix);
    this.shootableMeshes.push(proxy);
    this.wallMeshes.push(proxy);
    const door = {
      id: op.id, label: op.label || op.id, o: op.o, x: op.x, z: op.z, baseY: by, width: w, height: h,
      open: false, t: 0, group: g, collider, proxy, lampMat, savedCollider: { ...collider }
    };
    this.zavod.doors.push(door);
    return door;
  };


  // ---------------------------------------------------------------------------------
  // Explosive-destructible plank barricade (Koschei B/1 breach wall with X mark)
  // ---------------------------------------------------------------------------------
  P._zvPlankBarricade = function (op, MZ) {
    const alongZ = op.o === 'v';
    const w = op.width, h = op.h, t = 0.24;
    const by = op.baseY || 0;
    const g = new THREE.Group();
    const plankN = 6;
    for (let k = 0; k < plankN; k++) {
      const py = 0.28 + (k / plankN) * (h - 0.35);
      const pw = w + (k % 2 ? -0.08 : 0.04);
      const plank = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? t : pw, 0.32, alongZ ? pw : t), MZ.wood);
      plank.position.y = py;
      g.add(plank);
    }
    // Circled-X explosive breach marker on both faces
    const markMat = new THREE.MeshBasicMaterial({ color: 0xff5252 });
    for (const sgn of [-1, 1]) {
      for (const ang of [0.7, -0.7]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 0.04 : 1.35, 0.14, alongZ ? 1.35 : 0.04), markMat);
        bar.position.set(alongZ ? sgn * (t / 2 + 0.03) : 0, h * 0.5, alongZ ? 0 : sgn * (t / 2 + 0.03));
        if (alongZ) bar.rotation.x = ang; else bar.rotation.z = ang;
        g.add(bar);
      }
    }
    g.position.set(op.x, by, op.z);
    g.userData.noCull = true;
    g.userData.isDoor = true;
    this.scene.add(g);
    const half = alongZ ? { x: 0.25, z: w / 2 } : { x: w / 2, z: 0.25 };
    const collider = { minX: op.x - half.x, maxX: op.x + half.x, minY: by, maxY: by + h, minZ: op.z - half.z, maxZ: op.z + half.z };
    this.colliders.push(collider);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? t : w, h, alongZ ? w : t), MZ.wood);
    proxy.position.set(op.x, by + h / 2, op.z);
    proxy.updateMatrix();
    proxy.matrixWorld.copy(proxy.matrix);
    this.shootableMeshes.push(proxy);
    this.wallMeshes.push(proxy);
    const bar = {
      id: op.id, label: op.label || op.id, o: op.o, x: op.x, z: op.z, baseY: by, width: w, height: h,
      broken: false, group: g, collider, proxy
    };
    this.zavod.barricades.push(bar);
    return bar;
  };

  // ---------------------------------------------------------------------------------
  // Prop helpers (all accept a floor base Y so upper floors can be furnished)
  // ---------------------------------------------------------------------------------
  P._zvDesk = function (x, z, by, alongX = true, MZ) {
    const w = alongX ? 1.8 : 0.85, d = alongX ? 0.85 : 1.8;
    this._addBox(x, by + 0.38, z, w, 0.76, d, MZ.wood, true);
    this._zvGeo(new THREE.BoxGeometry(0.55, 0.36, 0.05), MZ.rubber, x, by + 0.96, z + (alongX ? -0.2 : 0), alongX ? 0 : Math.PI / 2);
    this._zvGeo(new THREE.BoxGeometry(0.48, 0.28, 0.02), (x + z) % 3 > 1 ? MZ.screen : MZ.screenBlue, x + (alongX ? 0 : 0.03), by + 0.97, z + (alongX ? -0.17 : 0), alongX ? 0 : Math.PI / 2);
  };
  P._zvShelf = function (x, z, by, alongX = true, MZ) {
    const w = alongX ? 2.2 : 0.6, d = alongX ? 0.6 : 2.2;
    this._addBox(x, by + 1.05, z, w, 2.1, d, MZ.steel, true);
    for (let k = 0; k < 3; k++) {
      this._zvGeo(new THREE.BoxGeometry(alongX ? 0.5 : 0.45, 0.35, alongX ? 0.45 : 0.5), MZ.crate,
        x + (alongX ? -0.7 + k * 0.7 : 0.05), by + 0.55 + (k % 2) * 0.7, z + (alongX ? 0.05 : -0.7 + k * 0.7));
    }
  };
  P._zvBunk = function (x, z, by, alongX, MZ) {
    const w = alongX ? 2.0 : 0.95, d = alongX ? 0.95 : 2.0;
    this._addBox(x, by + 0.35, z, w, 0.7, d, MZ.bunk, true);
    this._zvGeo(new THREE.BoxGeometry(w - 0.1, 0.14, d - 0.1), MZ.mattress, x, by + 0.77, z);
    this._zvGeo(new THREE.BoxGeometry(w, 0.08, d), MZ.bunk, x, by + 1.6, z);
    this._zvGeo(new THREE.BoxGeometry(w - 0.1, 0.12, d - 0.1), MZ.mattress, x, by + 1.7, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      this._zvGeo(new THREE.BoxGeometry(0.06, 1.75, 0.06), MZ.bunk, x + sx * (w / 2 - 0.05), by + 0.875, z + sz * (d / 2 - 0.05));
    }
  };
  P._zvServerRack = function (x, z, by, len, alongX, MZ) {
    const w = alongX ? len : 0.9, d = alongX ? 0.9 : len;
    this._addBox(x, by + 1.1, z, w, 2.2, d, MZ.darkSteel, true);
    const n = Math.max(2, Math.floor(len / 1.2));
    for (let k = 0; k < n; k++) {
      const off = -len / 2 + (k + 0.5) * (len / n);
      for (const s of [-1, 1]) {
        this._zvGeo(new THREE.BoxGeometry(alongX ? 0.5 : 0.03, 0.05, alongX ? 0.03 : 0.5), k % 3 ? MZ.lightGreen : MZ.lightAmber,
          x + (alongX ? off : s * 0.46), by + 1.2 + (k % 4) * 0.22, z + (alongX ? s * 0.46 : off));
      }
    }
  };
  P._zvTable = function (x, z, by, w, d, MZ, mat = null) {
    this._addBox(x, by + 0.38, z, w, 0.76, d, mat || MZ.steel, true);
  };
  P._zvBarrel = function (x, z, by, MZ, toxic = false) {
    this._zvCyl(x, by + 0.45, z, 0.32, 0.9, toxic ? MZ.hazard : MZ.tankRust, 10, true);
  };
  P._zvCrateStack = function (x, z, by, MZ, n = 2) {
    for (let k = 0; k < n; k++) {
      this._addBox(x + (k % 2) * 0.15, by + 0.45 + k * 0.9, z, 1.2, 0.9, 1.2, MZ.crate, true);
    }
  };

  // ---------------------------------------------------------------------------------
  // Population
  // ---------------------------------------------------------------------------------
  P._zvPopulate = function (G, MZ, rnd) {
    const Z = this.zavod;
    const R = (id) => G.byId.get(id);
    const center = (id) => { const r = R(id); const [x0, z0, x1, z1] = r.rects[0]; return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, r }; };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];
    const opsOf = (id) => G.openings.filter(o => o.a === id || o.b === id);
    const nearOpening = (x, z, by = 0, rad = 2.6) => G.openings.some(o => Math.abs((o.baseY || 0) - by) < 1 && Math.abs(o.x - x) < rad + (o.o === 'h' ? o.width / 2 : 0.5) && Math.abs(o.z - z) < rad + (o.o === 'v' ? o.width / 2 : 0.5) && Math.hypot(o.x - x, o.z - z) < rad + o.width / 2);
    const reserved = [];
    const isReserved = (x, z, rad = 2.2) => reserved.some(p => Math.hypot(p.x - x, p.z - z) < rad + p.r);
    const reserve = (x, z, r = 2.0) => reserved.push({ x, z, r });

    // --- Doors from openings ---
    for (const op of G.openings) {
      if (op.door === 'hinge') {
        const rotY = op.o === 'v' ? Math.PI / 2 : 0;
        const doorObj = this._addDoor(op.x, op.baseY || 0, op.z, Math.min(op.width - 0.12, 1.88), 2.6, rotY, op.label || 'Door', 'steel');
        if (doorObj && doorObj.group) {
          doorObj.group.userData.noCull = true;
          doorObj.group.userData.isDoor = true;
        }
      } else if (op.door === 'blast') {
        this._zvBlastDoor(op, MZ);
      } else if (op.door === 'planks') {
        this._zvPlankBarricade(op, MZ);
      }
    }
    const doorById = (id) => Z.doors.find(d => d.id === id);

    // --- Stations (puzzles, panels, buttons) ---
    const Pbr = window.AshfallPBR;
    const stationMat = {
      panel: MZ.darkSteel,
      glow: MZ.lightRed,
      valveRed: Pbr ? Pbr.getMaterial('polymer_stippled', { color: 0xb33a2a }) : new THREE.MeshStandardMaterial({ color: 0xb33a2a, roughness: 0.45 }),
      boardGreen: Pbr ? Pbr.getMaterial('concrete_weathered', { color: 0x2c3a2e }) : new THREE.MeshStandardMaterial({ color: 0x2c3a2e, roughness: 0.85 }),
      boardDark: Pbr ? Pbr.getMaterial('concrete_weathered', { color: 0x1c2620 }) : new THREE.MeshStandardMaterial({ color: 0x1c2620, roughness: 0.88 })
    };
    const addStation = (def) => {
      const by = def.y || 0;
      const g = new THREE.Group();
      const kind = def.kind;
      let solidMesh = null;
      let colR = null;
      let colH = 2.1;
      if (kind === 'valve') {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 3.4, 18), MZ.pipe);
        pipe.position.set(0, 1.7, 0);
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 12, 28), stationMat.valveRed);
        wheel.position.set(0, 1.35, 0.42);
        g.add(pipe, wheel);
        def.spinMesh = wheel;
        solidMesh = pipe;
        colR = [0.32, 0.32];
        colH = 3.4;
      } else if (kind === 'clue') {
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.08), stationMat.boardGreen);
        board.position.set(0, 1.6, 0);
        g.add(board);
        solidMesh = board;
      } else if (kind === 'shop_note') {
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.05, 0.08), stationMat.boardDark);
        board.position.set(0, 1.6, 0);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.07, 0.11), MZ.wood);
        rail.position.set(0, 1.06, 0);
        g.add(board, rail);
        solidMesh = board;
      } else if (kind === 'pad') {
        const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.3, 24), MZ.darkSteel);
        plat.position.set(0, 0.15, 0);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.05, 10, 28), MZ.lightAmber);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 0.32, 0);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), MZ.steel);
        post.position.set(0, 0.75, 0);
        g.add(plat, ring, post);
        def.ringMesh = ring;
        solidMesh = post;
        colR = [0.28, 0.28];
        colH = 1.2;
      } else {
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.35), stationMat.panel);
        box.position.set(0, 1.35, 0);
        const scr = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.05), kind === 'socket' ? MZ.screenBlue : MZ.screen);
        scr.position.set(0, 1.6, 0.2);
        const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 16), MZ.lightRed);
        btn.rotation.x = Math.PI / 2;
        btn.position.set(0, 1.12, 0.2);
        g.add(box, scr, btn);
        def.btnMesh = btn;
        solidMesh = box;
        const rotY = def.rotY || 0;
        const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
        colR = [Math.max(0.18, c * 0.52 + s * 0.16), Math.max(0.18, s * 0.52 + c * 0.16)];
      }
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), MZ.lightRed.clone());
      lamp.position.set(0, kind === 'pad' ? 1.35 : 2.25, 0);
      g.add(lamp);
      def.lampMesh = lamp;
      g.position.set(def.x, by, def.z);
      g.rotation.y = def.rotY || 0;
      g.userData.noCull = true;
      g.userData.isStation = true;
      this.scene.add(g);
      g.updateMatrixWorld(true);
      if (solidMesh) {
        this.shootableMeshes.push(solidMesh);
        this.wallMeshes.push(solidMesh);
      }
      if (colR) {
        this.colliders.push({
          minX: def.x - colR[0], maxX: def.x + colR[0],
          minY: by, maxY: by + colH,
          minZ: def.z - colR[1], maxZ: def.z + colR[1]
        });
      }
      def.group = g;
      def.position = new THREE.Vector3(def.x, by + 1.2, def.z);
      def.solved = false;
      def.progress = 0;
      Z.stations.push(def);
      reserve(def.x, def.z, 1.6);
      return def;
    };
    // Station facing helper: put a panel 1.2 m inside a room next to a door, facing into the room
    const nearDoor = (doorId, side, along = 3.2, inset = 1.0) => {
      const d = doorById(doorId);
      if (!d) return null;
      // side: +1 / -1 along the door normal (x for 'v', z for 'h')
      if (d.o === 'v') return { x: d.x + side * inset, z: d.z - d.width / 2 - along * 0.5, rotY: side > 0 ? Math.PI / 2 : -Math.PI / 2 };
      return { x: d.x - d.width / 2 - along * 0.5, z: d.z + side * inset, rotY: side > 0 ? 0 : Math.PI };
    };

    // ===== A/1 INFO EXTRACTION: car battery + jumper cables -> breaker -> red button =====
    addStation({ id: 'a1_breaker', kind: 'socket', sector: 'A1', x: -126, z: 26, rotY: -0.6, label: 'A/1 BREAKER PANEL',
      needs: [{ id: 'bunker_battery', qty: 1 }, { id: 'jumper_cables', qty: 1 }], hold: 1.6,
      hint: 'Needs a Car Battery + Jumper Cables (search A/1 rooms)', actions: [{ msg: 'A/1 breaker energised — hit the red button' }] });
    addStation({ id: 'a1_button', kind: 'button', sector: 'A1', x: -126, z: 50, rotY: -2.4, label: 'A/1 AIRLOCK RED BUTTON',
      requires: ['a1_breaker'], hint: 'Breaker panel has no power', hold: 0.6,
      actions: [{ open: ['A1'] }, { alarm: 'A1' }] });
    // ===== A/2 DEFENSE RESEARCH: 3 hermetic seals (radiation) =====
    addStation({ id: 'a2_console1', kind: 'button', sector: 'A2', x: -276, z: -186, rotY: 0, label: 'HERMETIC SEAL 1 CONSOLE', hold: 2.4,
      actions: [{ open: ['A2S1'] }, { clearRad: 1 }, { msg: 'Seal 1 engaged — sub-sector 1 radiation contained' }] });
    addStation({ id: 'a2_console2', kind: 'button', sector: 'A2', x: -202, z: -194, rotY: Math.PI, label: 'HERMETIC SEAL 2 CONSOLE', hold: 3.0,
      actions: [{ open: ['A2S2'] }, { clearRad: 2 }, { msg: 'Seal 2 engaged — sub-sector 2 radiation contained' }, { alarmLocal: true }] });
    addStation({ id: 'a2_crank3', kind: 'valve', sector: 'A2', x: -186, z: -116, rotY: -Math.PI / 2, label: 'MANUAL SEAL 3 CRANK', hold: 6.0,
      actions: [{ open: ['A2S3'] }, { clearRad: 3 }, { msg: 'Seal 3 cranked shut — DRD radiation fully contained' }, { alarmLocal: true }] });
    addStation({ id: 'a2_lockbtn', kind: 'button', sector: 'A2', x: -108, z: -42, rotY: 0, label: 'A/2 AIRLOCK CONTROL', hold: 0.8,
      requires: ['a2_crank3'], hint: 'Seal all 3 DRD sub-sectors first', actions: [{ open: ['A2'] }, { alarm: 'A2' }] });
    addStation({ id: 'a2_yellow', kind: 'socket', sector: 'A2', x: -180.5, z: -186, rotY: -Math.PI / 2, label: 'YELLOW SEAL KEY PANEL',
      needs: [{ id: 'drd_key_a', qty: 1 }, { id: 'drd_key_b', qty: 1 }], hold: 1.2,
      hint: 'Needs DRD Exit Key A + B (locked labs 2-B & 3-B)', actions: [{ open: ['YELLOW'] }, { msg: 'Yellow passage open — direct route to the Factory' }] });
    // ===== B/1 BARRACKS: drain the flood (2 valves) =====
    addStation({ id: 'b1_valve1', kind: 'valve', sector: 'B1', x: 258, z: -156, rotY: -Math.PI / 2, label: 'BLOCK T DRAIN VALVE', hold: 3.2,
      group: 'b1_valves', actions: [{ msg: 'Block T drain valve opened' }] });
    addStation({ id: 'b1_valve2', kind: 'valve', sector: 'B1', x: 312, z: -95, rotY: Math.PI / 2, label: 'BLOCK R DRAIN VALVE', hold: 3.2,
      group: 'b1_valves', actions: [{ msg: 'Block R drain valve opened' }] });
    addStation({ id: 'b1_lockbtn', kind: 'button', sector: 'B1', x: 104, z: -32.5, rotY: 0, label: 'B/1 AIRLOCK CONTROL', hold: 0.8,
      requires: ['b1_valve1', 'b1_valve2'], hint: 'Pumps flooded — open both drain valves (Block T & R)',
      actions: [{ open: ['B1'] }, { alarm: 'B1' }] });
    addStation({ id: 'b1_secret_panel', kind: 'socket', sector: 'B1', x: 122, z: -150, rotY: Math.PI / 2, label: 'BARRACKS SECRET EXIT PANEL', hold: 1.2,
      needs: [{ id: 'b1_key_a', qty: 1 }, { id: 'b1_key_b', qty: 1 }],
      hint: 'Needs Barracks Exit Key A (flooded dorms) + Key B (submerged secret room)',
      actions: [{ open: ['B1_SECRET'] }, { alarm: 'B1_SECRET' }, { msg: 'Barracks secret passage open — direct route to the Factory!' }] });
    addStation({ id: 'b1_secret_fbtn', kind: 'button', sector: 'FACTORY', x: 88.6, z: -149, rotY: -Math.PI / 2, label: 'BARRACKS SECRET EXIT CONTROL', hold: 0.8,
      actions: [{ open: ['B1_SECRET'] }] });
    // ===== B/2 EXTERNAL OPS: 2 fuses -> fuse box kills laser gates & opens airlock =====
    addStation({ id: 'b2_fusebox', kind: 'socket', sector: 'B2', x: 116, z: 32, rotY: 0, label: 'B/2 SECURITY FUSE BOX',
      needs: [{ id: 'bunker_fuse', qty: 2 }], hold: 1.8, hint: 'Needs 2 Security Fuses (Ext-Ops HQ, both floors)',
      actions: [{ lasersOff: 'b2' }, { open: ['B2'] }, { alarm: 'B2' }] });
    // ===== Plant-side airlock buttons (open any sector from the dark zone) =====
    const plantBtns = [
      ['a1_plantbtn', 'A1', -96, 31, Math.PI / 2], ['a2_plantbtn', 'A2', -96, -32, Math.PI / 2],
      ['b1_plantbtn', 'B1', 96, -32, -Math.PI / 2], ['b2_plantbtn', 'B2', 96, 31, -Math.PI / 2]
    ];
    for (const [id, door, x, z, rotY] of plantBtns) {
      addStation({ id, kind: 'button', sector: 'PLANT', x, z, rotY, label: `OPEN AIRLOCK ${door[0]}/${door[1]} (PLANT SIDE)`, hold: 1.0,
        actions: [{ open: [door] }, { alarm: door }] });
    }
    // ===== Plant -> Factory (Factory Keys from the ventilation shafts) =====
    addStation({ id: 'd1_panel', kind: 'socket', sector: 'PLANT', x: -32, z: -73, rotY: 0, label: 'D/1 FACTORY KEY LOCK',
      needs: [{ id: 'zavod_factory_key', qty: 1 }], hold: 1.2, hint: 'Needs a Factory Key (plant ventilation shafts)',
      actions: [{ open: ['D1'] }, { alarm: 'D1' }] });
    addStation({ id: 'd2_panel', kind: 'socket', sector: 'PLANT', x: 32, z: -73, rotY: 0, label: 'D/2 FACTORY KEY LOCK',
      needs: [{ id: 'zavod_factory_key', qty: 1 }], hold: 1.2, hint: 'Needs a Factory Key (plant ventilation shafts)',
      actions: [{ open: ['D2'] }, { alarm: 'D2' }] });
    addStation({ id: 'd1_fbtn', kind: 'button', sector: 'FACTORY', x: -27.2, z: -96.0, rotY: Math.PI / 2, label: 'D/1 EXIT CONTROL', hold: 0.8, actions: [{ open: ['D1'] }] });
    addStation({ id: 'd2_fbtn', kind: 'button', sector: 'FACTORY', x: 27.2, z: -96.0, rotY: -Math.PI / 2, label: 'D/2 EXIT CONTROL', hold: 0.8, actions: [{ open: ['D2'] }] });
    // ===== Factory Admin: Shopkeeper Barter (dead-drop recipe + shutter) =====
    Z.shopBarter = pick([
      { needs: [{ id: 'server_tape_red', qty: 1 }, { id: 'aseptic_blocker', qty: 1 }], label: '1x Red Server Tape + 1x Aseptic Blocker' },
      { needs: [{ id: 'server_tape_black', qty: 2 }, { id: 'bunker_fuse', qty: 1 }], label: '2x Black Server Tape + 1x Security Fuse' },
      { needs: [{ id: 'server_tape_red', qty: 1 }, { id: 'server_tape_black', qty: 1 }], label: '1x Red Server Tape + 1x Black Server Tape' }
    ]);
    addStation({ id: 'shopkeeper_note', kind: 'shop_note', sector: 'FACTORY', x: 56.8, z: -108.5, rotY: -Math.PI / 2, label: 'SHOPKEEPER BARTER LIST' });
    addStation({ id: 'shopkeeper_slot', kind: 'socket', sector: 'FACTORY', x: 56.8, z: -117.5, rotY: -Math.PI / 2, label: 'SHOPKEEPER DEAD-DROP SLOT', hold: 1.5,
      needs: Z.shopBarter.needs, hint: 'Shopkeeper wants: ' + Z.shopBarter.label,
      actions: [{ open: ['SHOP'] }, { msg: 'Shopkeeper barter accepted — shutter unlocked!' }] });
    // ===== Plant -> Alpha Cluster (battery + cables in the C panel) =====
    addStation({ id: 'c1_panel', kind: 'socket', sector: 'PLANT', x: -32, z: 73, rotY: Math.PI, label: 'C/1 POWER PANEL',
      needs: [{ id: 'bunker_battery', qty: 1 }, { id: 'jumper_cables', qty: 1 }], hold: 1.6, hint: 'Needs a Car Battery + Jumper Cables',
      actions: [{ open: ['C1'] }, { alarm: 'C1' }] });
    addStation({ id: 'c2_panel', kind: 'socket', sector: 'PLANT', x: 32, z: 73, rotY: Math.PI, label: 'C/2 POWER PANEL',
      needs: [{ id: 'bunker_battery', qty: 1 }, { id: 'jumper_cables', qty: 1 }], hold: 1.6, hint: 'Needs a Car Battery + Jumper Cables',
      actions: [{ open: ['C2'] }, { alarm: 'C2' }] });
    addStation({ id: 'c1_abtn', kind: 'button', sector: 'ALPHA', x: -26.6, z: 90, rotY: Math.PI / 2, label: 'C/1 EXIT CONTROL', hold: 0.8, actions: [{ open: ['C1'] }] });
    addStation({ id: 'c2_abtn', kind: 'button', sector: 'ALPHA', x: 26.6, z: 90, rotY: -Math.PI / 2, label: 'C/2 EXIT CONTROL', hold: 0.8, actions: [{ open: ['C2'] }] });
    // ===== Alpha Cluster: code vault (R4D UV cipher boards), L2 lift, archive (3 laptops) =====
    const code = [1 + Math.floor(rnd() * 9), Math.floor(rnd() * 10), Math.floor(rnd() * 10)];
    const symbols = ['Δ', 'Ω', 'Ψ'];
    Z.vaultCode = code;
    Z.vaultSymbols = symbols;
    const clueSpots = [[12, 167, Math.PI], [-74, 186, Math.PI / 2], [74, 232, -Math.PI / 2]];
    clueSpots.forEach(([x, z, rotY], k) => {
      addStation({ id: `alpha_clue${k + 1}`, kind: 'clue', sector: 'ALPHA', x, z, rotY,
        label: `UV CHALK CIPHER BOARD ${k + 1} (${symbols[k]})`, hold: 1.4,
        clueIdx: k, clueDigit: code[k], clueSymbol: symbols[k],
        mustCarry: [{ id: 'r4d_detector', qty: 1 }],
        hint: 'Requires R4D UV Detector in backpack to reveal UV chalk cipher',
        actions: [{ clue: k }] });
    });
    addStation({ id: 'alpha_keypad', kind: 'button', sector: 'ALPHA', x: -6, z: 244, rotY: Math.PI, label: 'CODE VAULT KEYPAD', hold: 2.0,
      requires: ['alpha_clue1', 'alpha_clue2', 'alpha_clue3'],
      hint: 'Code unknown — scan the 3 UV chalk boards (Δ · Ω · Ψ) with an R4D Detector',
      actions: [{ open: ['VAULT'] }, { alarm: 'VAULT' }] });
    this._zvSign('Δ · Ω · Ψ', 'R4D UV CIPHER SEQUENCE', -6, 3.2, 245.6, Math.PI, 2.8, 0.75, '#b388ff');
    addStation({ id: 'alpha_l2reader', kind: 'socket', sector: 'ALPHA', x: 74, z: 200, rotY: -Math.PI / 2, label: 'L2 KEYCARD READER',
      needs: [{ id: 'zavod_l2_keycard', qty: 1 }], hold: 1.2, hint: 'Needs an L2 Keycard (Factory foreman / plant control rooms)',
      actions: [{ open: ['L2'] }, { unlockExtract: 'L2 EXFIL LIFT' }, { msg: 'L2 opened — new exfil visible to ALL teams', global: true }] });
    [[-40, 200], [0, 222], [40, 200]].forEach(([x, z], k) => {
      addStation({ id: `alpha_pad${k + 1}`, kind: 'pad', sector: 'ALPHA', x, z, label: `LAPTOP UPLINK PLATFORM ${k + 1}`,
        needs: [{ id: 'zavod_laptop', qty: 1 }], hold: 1.5, group: 'alpha_laptops', hint: 'Needs an al-Qatala Laptop (found in the sectors)',
        actions: [{ msg: `Laptop ${k + 1}/3 uplinked` }] });
    });
    Z.groups = {
      b1_valves: { members: ['b1_valve1', 'b1_valve2'], actions: [{ drain: 'b1' }, { msg: 'Pumps running — Barracks flood draining' }] },
      alpha_laptops: { members: ['alpha_pad1', 'alpha_pad2', 'alpha_pad3'], actions: [{ open: ['ARCHIVE'] }, { alarm: 'ARCHIVE' }, { msg: 'Archive siren — the sealed archive is open' }] }
    };

    // --- Radiation sub-sectors (A/2) ---
    Z.rads = { 1: { active: true }, 2: { active: true }, 3: { active: true } };
    // --- Flood (B/1) ---
    const floodLevel = 1.35;
    Z.floods.b1 = { level: floodLevel, target: floodLevel, meshes: [] };
    for (const [fKey, fLvl] of [['b1', floodLevel], ['b1_secret', 3.15]]) {
      if (!Z.floods[fKey]) Z.floods[fKey] = { level: fLvl, target: fLvl, meshes: [] };
      for (const rc of G.mergedRects(0, (i, j) => { const v = G.at(0, i, j); return (v >= 0 && G.regions[v].flood === fKey) ? v : null; })) {
        const x0 = G.wx(rc.i0), x1 = G.wx(rc.i1), z0 = G.wz(rc.j0), z1 = G.wz(rc.j1);
        const pw = x1 - x0, pd = z1 - z0;
        const fGeo = new THREE.PlaneGeometry(pw, pd, Math.max(2, Math.round(pw / 4)), Math.max(2, Math.round(pd / 4)));
        const fUv = fGeo.attributes.uv;
        if (fUv) {
          for (let ui = 0; ui < fUv.count; ui++) {
            fUv.setXY(ui, fUv.getX(ui) * (pw / 8), fUv.getY(ui) * (pd / 8));
          }
          fUv.needsUpdate = true;
          fGeo.setAttribute('uv2', fUv);
        }
        const m = new THREE.Mesh(fGeo, MZ.water);
        m.rotation.x = -Math.PI / 2;
        m.position.set((x0 + x1) / 2, fLvl, (z0 + z1) / 2);
        this.scene.add(m);
        Z.floods[fKey].meshes.push(m);
      }
    }
    // --- Laser gates (B/2 security corridor) ---
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff1a1a, transparent: true, opacity: 0.9 });
    [134, 148, 162, 176].forEach((gx, gi) => {
      const heights = gi % 2 ? [0.35, 1.05, 1.75] : [0.6, 1.35];
      for (const hy of heights) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 11.6), laserMat);
        beam.position.set(gx, hy, 36);
        this.scene.add(beam);
        Z.lasers.push({ group: 'b2', x: gx, y: hy, z0: 30.2, z1: 41.8, mesh: beam, period: 3.6 + gi * 0.4, phase: gi * 0.9, duty: 0.62, on: true, enabled: true });
      }
      for (const zz of [30.4, 41.6]) {
        this._zvGeo(new THREE.BoxGeometry(0.32, 2.2, 0.32), MZ.darkSteel, gx, 1.1, zz, 0, {
          shoot: true, wall: true, collider: [gx - 0.16, gx + 0.16, 0, 2.2, zz - 0.16, zz + 0.16]
        });
      }
    });
    // --- Sniper Mezzanine C4 Laser Tripwires (shoot C4 charge or disarm box at stair head) ---
    Z.traps = [];
    const trapMat = new THREE.MeshBasicMaterial({ color: 0xff3b1f, transparent: true, opacity: 0.9 });
    for (const td of [
      { id: 'sniper_trap_w', x0: -59.8, x1: -56.2, z: -188.5, y: 6.15, baseY: 5.6, c4X: -59.5, stationId: 'disarm_trap_w' },
      { id: 'sniper_trap_e', x0: 56.2, x1: 59.8, z: -188.5, y: 6.15, baseY: 5.6, c4X: 59.5, stationId: 'disarm_trap_e' }
    ]) {
      const postH = (td.y - td.baseY) + 0.35;
      const postY = td.baseY + postH * 0.5;
      for (const px of [td.x0, td.x1]) {
        this._zvGeo(new THREE.BoxGeometry(0.18, postH, 0.18), MZ.darkSteel, px, postY, td.z, 0, {
          shoot: true, wall: true, collider: [px - 0.1, px + 0.1, td.baseY, td.baseY + postH, td.z - 0.1, td.z + 0.1]
        });
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.035, 0.035), trapMat);
      beam.position.set((td.x0 + td.x1) / 2, td.y, td.z);
      this.scene.add(beam);
      this._addBox(td.c4X, td.y, td.z, 0.42, 0.32, 0.28, MZ.hazard, true);
      const c4Vis = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.14), trapMat);
      c4Vis.position.set(td.c4X, td.y + 0.2, td.z);
      this.scene.add(c4Vis);
      Z.traps.push({ ...td, c4Pos: new THREE.Vector3(td.c4X, td.y, td.z), beamMesh: beam, c4Vis, armed: true });
      addStation({
        id: td.stationId, kind: 'button', sector: 'FACTORY',
        x: td.c4X < 0 ? -56.4 : 56.4, y: 4.4, z: -185.5,
        rotY: td.c4X < 0 ? -Math.PI / 2 : Math.PI / 2,
        label: td.c4X < 0 ? 'DISARM SNIPER C4 (WEST)' : 'DISARM SNIPER C4 (EAST)',
        hold: 1.6, actions: [{ disarmTrap: td.id }, { msg: 'Sniper C4 tripwire disarmed' }]
      });
    }

    // --- Quest items (deterministic per match so every squad member sees the same spawns) ---
    const loose = (id, x, z, y = 0, tag = '') => {
      const uid = `zv_${id}_${tag || Z.loose.length}`;
      const gi = this.spawnGroundItem(id, 1, new THREE.Vector3(x, y + 0.02, z), { uid, onSurface: true, rotY: rnd() * Math.PI * 2 });
      Z.loose.push({ id, x, z, y, uid });
      reserve(x, z, 1.0);
      return gi;
    };
    // A/1: battery & cables placed separately "near the exit"
    const a1Bat = pick([[-178, 88], [-186, 52], [-222, 110]]);
    const a1Cab = pick([[-222, 74], [-182, 160], [-226, 50]]);
    loose('bunker_battery', a1Bat[0], a1Bat[1], 0, 'a1');
    loose('jumper_cables', a1Cab[0], a1Cab[1], 0, 'a1');
    loose('bunker_battery', -254, 160, 0, 'a1spare');
    loose('jumper_cables', -182, 128, 0, 'a1spare');
    // A/2: DRD exit keys in the locked labs
    loose('drd_key_a', -204, -216, 0, 'a');
    loose('drd_key_b', -171, -120, 0, 'b');
    // B/1: Rebreather + Exit Key A in main dorms, Exit Key B in submerged secret vault
    loose('zavod_rebreather', 316, -118, 0, 'b1r');
    loose('zavod_rebreather', 254, -80, 0, 'b1pump');
    loose('b1_key_a', 252, -196, 0, 'b1t');
    loose('b1_key_b', 182, -184, 0, 'b1sec');
    // B/2: security fuses (1F + 2F) and a battery set for Alpha
    {
      const f1 = pick([[252, 128], [262, 186]]);
      loose('bunker_fuse', f1[0], f1[1], 0, 'fuse1');
      const f2 = pick([[252, 128], [278 + 6, 210], [200, 128]]);
      loose('bunker_fuse', f2[0], f2[1], 4.2, 'fuse2');
      loose('bunker_battery', 246, 140, 0, 'b2');
      loose('jumper_cables', 196, 184, 4.2, 'b2');
    }
    // Plant: factory keys in the ventilation shafts, spare battery set in a lobe warehouse
    loose('zavod_factory_key', 56, -74, 0, 'vent_ne');
    loose('zavod_factory_key', -56, 74, 0, 'vent_sw');
    loose('bunker_battery', 90, 52, 0, 'plant');
    loose('jumper_cables', 64, 22, 0, 'plant');
    // L2 keycards (Factory foreman office + random plant control room)
    loose('zavod_l2_keycard', 84, -222, 0, 'foreman');
    // Laptops: one per sector + one in the plant
    loose('zavod_laptop', -218, 48, 0, 'a1');
    loose('zavod_laptop', -220, -158, 0, 'a2');
    loose('zavod_laptop', 248, -84, 0, 'b1');
    loose('zavod_laptop', 220, 160, 4.2, 'b2');
    loose('zavod_laptop', pick([[-72, -50], [72, 50], [-72, 50]])[0], pick([[-38, -18], [40, 22]])[1], 0, 'plant');
    // Weapons Case inside Factory Boss Vault (unlocked when both The Rhinoceros & The Sniper fall)
    loose('zavod_weapons_case', -24, -208.4, 0, 'weapons_case');
    // Shopkeeper Barter Booth rewards
    loose('zavod_l2_keycard', 66, -110, 0, 'shop_l2');
    loose('vest_3plate', 72, -108, 0, 'shop_vest');
    loose('nvg_goggles', 72, -116, 0, 'shop_nvg');
    loose('self_revive', 66, -116, 0, 'shop_rev');
    // R4D UV Detectors for Alpha Cluster cipher boards
    loose('r4d_detector', -12, 143, 0, 'alpha_sec');
    loose('r4d_detector', 0, 184, 0, 'alpha_entry');
    // Koschei Barter Tapes & Aseptic Blockers
    loose('server_tape_red', 12, 125, 0, 'tr1');
    loose('server_tape_red', -58, 210, 0, 'tr2');
    loose('server_tape_red', 58, 218, 0, 'tr3');
    loose('server_tape_black', 14, 128, 0, 'tb1');
    loose('server_tape_black', -36, 232, 0, 'tb2');
    loose('server_tape_black', 218, 180, 4.2, 'tb3');
    loose('aseptic_blocker', -276, -226, 0, 'ab1');
    loose('aseptic_blocker', -220, -210, 0, 'ab2');
    loose('aseptic_blocker', 252, 208, 0, 'ab3');
    // Night-vision goggles near all 4 sector entrances into the dark Chemical Plant
    loose('nvg_goggles', -128, 38, 0, 'nvg_a1');
    loose('nvg_goggles', -120, -37, 0, 'nvg_a2');
    loose('nvg_goggles', 105, -39, 0, 'nvg_b1');
    loose('nvg_goggles', 110, 36, 0, 'nvg_b2');

    // --- Signage (Building 21 colour-coded wayfinding + Soviet stencils) ---
    const signs = [
      ['СЕКТОР А/1', 'INFORMATION EXTRACTION', -332, 3.2, 175.6, Math.PI, '#ffa726'],
      ['СЕКТОР А/2', 'DEFENSE RESEARCH DIVISION', -332, 3.2, -190.4, Math.PI, '#e6e14a'],
      ['СЕКТОР Б/1', 'BARRACKS', 332, 3.2, -210.4, Math.PI, '#4fc3f7'],
      ['СЕКТОР Б/2', 'EXTERNAL OPERATIONS', 332, 3.2, 215.6, Math.PI, '#ff5252'],
      ['ХИМЦЕХ →', 'CHEMICAL PLANT', -261.6, 2.6, 150, Math.PI / 2, '#ffa726'],
      ['ХИМЦЕХ →', 'CHEMICAL PLANT', -150, 2.6, -105.6, 0, '#e6e14a'],
      ['ХИМЦЕХ ←', 'CHEMICAL PLANT', 222, 2.6, -99.6, 0, '#4fc3f7'],
      ['ПРОЛОМ', 'EXPLOSIVES — REBREATHER', 184, 2.6, -109.6, 0, '#4fc3f7'],
      ['ЗАВОД-9 →', 'FACTORY SECRET EXIT', 121.6, 3.0, -155, Math.PI / 2, '#4fc3f7'],
      ['ХИМЦЕХ ←', 'CHEMICAL PLANT', 170, 2.6, 41.6, Math.PI, '#ff5252'],
      ['ЗАВОД-9', 'WEAPONS MANUFACTURING', 0, 9.5, -199.6, 0, '#b0bec5'],
      ['АЛЬФА', 'ALPHA CLUSTER — DATA CORE', 0, 6.0, 176.3, 0, '#b388ff'],
      ['ОПАСНО', 'RADIATION — SEAL REQUIRED', -276, 3.6, -215.7, 0, '#e6e14a'],
      ['СЕВЕР — ЗАВОД D/1·D/2', 'NORTH -> FACTORY ADMIN', 0, 4.2, -75.5, 0, '#b0bec5'],
      ['ЮГ — АЛЬФА C/1·C/2', 'SOUTH -> ALPHA CLUSTER', 0, 4.2, 75.5, Math.PI, '#b388ff'],
      ['З-С — СЕКТОР А/2', 'NW -> DRD SECTOR A/2', -51.5, 4.2, -38, Math.PI / 2, '#e6e14a'],
      ['З-Ю — СЕКТОР А/1', 'SW -> INFO SECTOR A/1', -51.5, 4.2, 38, Math.PI / 2, '#ffa726'],
      ['В-С — СЕКТОР Б/1', 'NE -> BARRACKS B/1', 51.5, 4.2, -38, -Math.PI / 2, '#4fc3f7'],
      ['В-Ю — СЕКТОР Б/2', 'SE -> EXT-OPS B/2', 51.5, 4.2, 38, -Math.PI / 2, '#ff5252'],
      ['АДМИНИСТРАЦИЯ', 'FACTORY ADMIN — SHOPKEEPER EAST', 0, 3.8, -123.5, 0, '#ffca28'],
      ['ТОРГОВЕЦ', 'SHOPKEEPER — DEAD-DROP BARTER', 57.5, 3.3, -113, -Math.PI / 2, '#ffca28'],
      ['ОРУЖЕЙНЫЙ КЕЙС', 'WEAPONS CASE — DEFEAT RHINO & SNIPER', -24, 3.8, -199.5, 0, '#ffca28']
    ];
    for (const [t, s, x, y, z, rot, col] of signs) this._zvSign(t, s, x, y, z, rot, 4.4, 1.05, col);

    // --- Furnishing pass (seeded so every client builds identical geometry & container ids) ---
    for (const r of G.regions) this._zvFurnish(r, G, MZ, rnd, { nearOpening, isReserved, reserve });
    this._zvFurnishPlant(G, MZ, rnd, { nearOpening, isReserved, reserve });
    this._zvFurnishFactory(G, MZ, rnd, { nearOpening, isReserved, reserve });

    // --- Extraction lifts (Building 21 style) ---
    const addLift = (name, x, z, locked, kind) => {
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x55ff88, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.35, 32), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.04, z);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 3.4, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x44ff77, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
      beam.position.set(x, 1.7, z);
      ring.visible = beam.visible = !locked;
      this.scene.add(ring, beam);
      const ez = { name, position: new THREE.Vector3(x, 0, z), radius: 3.3, ringMesh: ring, beaconMesh: beam, locked, kind };
      this.extractZones.push(ez);
      return ez;
    };
    addLift('FACTORY FREIGHT ELEVATOR', 0, -212, false, 'factory');
    addLift('L2 EXFIL LIFT', 150, 208, true, 'l2');
    // Arrival lifts double as Final Exfil lifts (open in the last 4 minutes)
    const wings = [
      { id: 'A1', name: 'A/1 INFORMATION EXTRACTION', entry: 'a1_entry', color: '#ffa726', puzzle: 'Find the Car Battery + Jumper Cables, power the rotunda breaker, then hit the red button.' },
      { id: 'A2', name: 'A/2 DEFENSE RESEARCH DIVISION', entry: 'a2_entry', color: '#e6e14a', puzzle: 'Radiation leak — engage 3 hermetic seals (consoles, then the manual crank). Gas mask recommended.' },
      { id: 'B1', name: 'B/1 BARRACKS', entry: 'b1_entry', color: '#4fc3f7', puzzle: 'Flooded — open the Block T & Block R drain valves to run the pumps.' },
      { id: 'B2', name: 'B/2 EXTERNAL OPERATIONS', entry: 'b2_entry', color: '#ff5252', puzzle: 'Find 2 Security Fuses in the Ext-Ops HQ, time the laser gates, power the fuse box.' }
    ];
    for (const w of wings) {
      const c = center(w.entry);
      const backX = w.id[0] === 'A' ? c.x - 8 : c.x + 8;
      w.spawn = new THREE.Vector3(c.x + (w.id[0] === 'A' ? 4 : -4), 1.7, c.z);
      w.exfil = addLift(`${w.id[0]}/${w.id[1]} ELEVATOR (FINAL EXFIL)`, backX, c.z, true, 'final');
      // Elevator car doors on the back wall
      const wallX = w.id[0] === 'A' ? c.x - 12 + 0.3 : c.x + 12 - 0.3;
      this._zvGeo(new THREE.BoxGeometry(0.2, 3.4, 5.2), MZ.darkSteel, wallX, 1.7, c.z);
      this._zvGeo(new THREE.BoxGeometry(0.22, 0.12, 5.4), MZ.lightAmber, wallX, 3.5, c.z);
      this._zvGeo(new THREE.BoxGeometry(0.24, 3.3, 0.06), MZ.rubber, wallX, 1.7, c.z);
      reserve(c.x, c.z, 5);
      Z.wings.push(w);
    }

    // --- Player spawn: assigned wing (shared by the whole squad on transfer) ---
    const wantWing = (this.zone && this.zone.spawnWing) || null;
    let wing = Z.wings.find(w => w.id === wantWing);
    if (!wing) wing = Z.wings[Math.floor(Math.random() * Z.wings.length)];
    Z.activeWing = wing;
    this.playerSpawn = wing.spawn.clone();
    this.operatorSpawns = Z.wings.filter(w => w !== wing).map(w => new THREE.Vector3(w.spawn.x, 0, w.spawn.z));
    this.perimeterSpawns = this.operatorSpawns.slice();
    this.innerPoiSpawns = [];

    // --- AI garrisons (Koschei: cartel / al-Qatala T3 squads, dark-zone guards, Factory bosses) ---
    const S = (x, z, tier = 'raider', y = 0) => ({ pos: new THREE.Vector3(x, y, z), tier });
    const garrison = [
      // A/1 cartel
      S(-249, 150), S(-200, 99), S(-233, 120), S(-167, 80), S(-140, 30, 'heavy'), S(-150, 50),
      // A/2 al-Qatala (sub-sectors 2 & 3)
      S(-212, -170), S(-200, -182), S(-198, -110), S(-190, -100, 'heavy'), S(-138, -70),
      // B/1 dry truss & pump station
      S(247, -96), S(286, -66), S(230, -80), S(180, -78),
      // B/2 al-Qatala HQ (both floors) + security corridor
      S(240, 147), S(205, 170), S(275, 193), S(240, 193, 'raider', 4.2), S(205, 160, 'raider', 4.2), S(275, 147, 'heavy', 4.2), S(194, 70),
      // Chemical plant (dark zone)
      S(-27, -52), S(27, -52), S(-9, 0, 'heavy'), S(9, 18), S(-27, 33), S(27, 33), S(-80, 31), S(80, -45),
      // Alpha Cluster
      S(0, 150), S(-40, 186), S(40, 238), S(-60, 236, 'heavy'), S(60, 186)
    ];
    this.aiSpawnList = garrison;
    this.bossSpawnPos = null;
    this.bossSpawns = [
      { pos: new THREE.Vector3(0, 0, -166), tier: 'boss_rhino' },
      { pos: new THREE.Vector3(0, 5.6, -195), tier: 'boss_sniper' }
    ];
    this.bossGuardSpawns = [
      new THREE.Vector3(-28, 0, -156),
      new THREE.Vector3(28, 0, -156),
      new THREE.Vector3(-42, 5.6, -195),
      new THREE.Vector3(42, 5.6, -195)
    ];
    this.pois = [
      { name: 'CHEMICAL PLANT', x: 0, z: -10, color: '#7cff9c', threat: 'high', mapLabel: false },
      { name: 'FACTORY', x: 0, z: -160, color: '#b0bec5', threat: 'high', mapLabel: false },
      { name: 'SHOPKEEPER', x: 68, z: -113, color: '#ffca28', mapLabel: false },
      { name: 'ALPHA CLUSTER', x: 0, z: 200, color: '#b388ff', threat: 'high', mapLabel: false },
      { name: 'PLANT WEST', x: -76, z: 0, color: '#7cff9c', mapLabel: false },
      { name: 'PLANT EAST', x: 76, z: 0, color: '#7cff9c', mapLabel: false }
    ];
    Z.pois = this.pois;
  };

  // ---------------------------------------------------------------------------------
  // Room furnishing by kind
  // ---------------------------------------------------------------------------------
  P._zvFurnish = function (r, G, MZ, rnd, H) {
    if (!r.rects.length || r.kind === 'corridor' || r.kind === 'plant' || r.kind === 'factory' || r.kind === 'mezzanine') return;
    const [x0, z0, x1, z1] = r.rects[0];
    const by = r.layer === 1 ? r.baseY : 0;
    const w = x1 - x0, d = z1 - z0;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const ok = (x, z, rad = 1.3) => !H.nearOpening(x, z, by, 2.2) && !H.isReserved(x, z, rad);
    const loot = (x, z, kind, name) => { if (ok(x, z, 1.0)) { this._addLootContainer(x, by, z, kind, name); H.reserve(x, z, 1.0); return true; } return false; };
    const alongX = w >= d;
    const M = 1.2; // wall margin
    const sector = r.sector;
    switch (r.kind) {
      case 'office': case 'command': case 'security': case 'records': case 'guard': case 'comms': {
        const cols = Math.max(1, Math.floor((w - 4) / 4.2));
        const rows = Math.max(1, Math.floor((d - 4) / 4.2));
        for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
          const px = x0 + 2.4 + (a + 0.5) * ((w - 4.8) / cols);
          const pz = z0 + 2.4 + (b + 0.5) * ((d - 4.8) / rows);
          if (Math.hypot(px - cx, pz - cz) < 2.0 && r.kind !== 'records') continue;
          if (ok(px, pz)) this._zvDesk(px, pz, by, true, MZ);
        }
        const nCab = r.kind === 'records' ? 4 : 2;
        for (let k = 0; k < nCab; k++) {
          const px = x0 + M + (k + 0.5) * ((w - 2 * M) / nCab);
          loot(px, z0 + 0.6, 'office', r.kind === 'records' ? 'Records Cabinet' : 'Filing Cabinet');
        }
        if (r.kind === 'records') for (let k = 0; k < 3; k++) { const pz = z0 + 3 + k * ((d - 5) / 3); if (ok(x1 - 0.8, pz)) this._zvShelf(x1 - 0.7, pz, by, false, MZ); }
        if (r.kind === 'command') { loot(cx + 3, cz, 'valuables', 'Commander Safe'); this._zvTable(cx, cz, by, 5, 2.4, MZ, MZ.wood); }
        if (r.kind === 'security' && rnd() < 0.7) loot(x1 - 1.2, z1 - 0.8, 'police_fire', 'Security Locker');
        if (r.kind === 'guard') { loot(x1 - 1.2, z1 - 0.8, 'police_fire', 'Guard Locker'); loot(x1 - 1.2, z0 + 1.0, 'military', 'Guard Weapon Rack'); }
        if (r.kind === 'comms' && ok(x1 - 1.0, cz, 1.2)) this._zvServerRack(x1 - 0.8, cz, by, Math.min(6, d - 4), false, MZ);
        if (rnd() < 0.35 && by === 0) this._addWallFirstAidKit(x0 + 0.3, cz, 'east', `${r.name} First Aid`);
        break;
      }
      case 'lab': case 'labhub': {
        const benchN = r.kind === 'labhub' ? 2 : Math.max(1, Math.floor(d / 7));
        for (let k = 0; k < benchN; k++) {
          const pz = z0 + (k + 0.5) * (d / benchN);
          const bx = r.kind === 'labhub' ? cx + (k % 2 ? 6 : -6) : cx;
          if (ok(bx, pz, 2.2)) {
            this._zvTable(bx, pz, by, Math.min(5, w - 5), 1.1, MZ, MZ.steel);
            for (let g = 0; g < 3; g++) this._zvGeo(new THREE.CylinderGeometry(0.08, 0.1, 0.28, 8), g % 2 ? MZ.lightGreen : MZ.screenBlue, bx - 1.2 + g * 1.2, by + 0.9, pz);
          }
        }
        if (w > 10) { if (ok(x1 - 1.0, z0 + 1.2)) this._addBox(x1 - 0.8, by + 1.1, z0 + 1.2, 1.2, 2.2, 1.6, MZ.lab, true); }
        loot(x0 + 1.0, z1 - 0.7, 'hospital', 'Lab Supply Cabinet');
        if (r.kind === 'labhub') {
          for (let k = 0; k < 6; k++) { const px = x0 + 2 + rnd() * (w - 4), pz = z0 + 2 + rnd() * (d - 4); if (ok(px, pz, 1.2)) this._zvBarrel(px, pz, by, MZ, true); }
          loot(x1 - 1.0, z1 - 0.7, 'military', 'al-Qatala Weapon Case');
        } else if (rnd() < 0.5) loot(x1 - 1.0, z1 - 0.7, 'valuables', 'Research Safe');
        break;
      }
      case 'dorm': {
        const n = Math.max(2, Math.floor(((alongX ? w : d) - 3) / 2.6));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          const a = alongX ? x0 + 1.5 + t * (w - 3) : z0 + 1.5 + t * (d - 3);
          for (const side of [0, 1]) {
            const px = alongX ? a : (side ? x1 - 1.3 : x0 + 1.3);
            const pz = alongX ? (side ? z1 - 1.3 : z0 + 1.3) : a;
            if (ok(px, pz, 1.1)) this._zvBunk(px, pz, by, !alongX, MZ);
          }
        }
        loot(cx, alongX ? z0 + 3.0 : cz, 'household', 'Footlocker');
        if (rnd() < 0.45) loot(cx + 2, alongX ? z1 - 3.0 : cz + 2, 'supply', 'Kit Bag');
        break;
      }
      case 'wash': case 'locker': {
        const n = Math.max(2, Math.floor(((alongX ? w : d) - 3) / 1.6));
        for (let k = 0; k < n; k++) {
          const a = (alongX ? x0 : z0) + 1.5 + (k + 0.5) * (((alongX ? w : d) - 3) / n);
          const px = alongX ? a : x0 + 0.5;
          const pz = alongX ? z0 + 0.5 : a;
          if (ok(px, pz, 0.6)) this._addBox(px, by + (r.kind === 'wash' ? 0.45 : 1.0), pz, alongX ? 1.2 : 0.7, r.kind === 'wash' ? 0.9 : 2.0, alongX ? 0.7 : 1.2, r.kind === 'wash' ? MZ.tile : MZ.paintBlue, true);
        }
        if (r.kind === 'locker') loot(alongX ? cx : x1 - 1.0, alongX ? z1 - 0.8 : cz, 'police_fire', 'Duty Locker');
        break;
      }
      case 'storage': case 'armory': case 'warehouse': {
        const rows = Math.max(1, Math.floor(((alongX ? d : w) - 4) / 3.2));
        for (let k = 0; k < rows; k++) {
          const a = (alongX ? z0 : x0) + 2.2 + (k + 0.5) * (((alongX ? d : w) - 4.4) / rows);
          const segN = Math.max(1, Math.floor(((alongX ? w : d) - 6) / 2.6));
          for (let s2 = 0; s2 < segN; s2++) {
            const b = (alongX ? x0 : z0) + 3 + (s2 + 0.5) * (((alongX ? w : d) - 6) / segN);
            if (s2 === Math.floor(segN / 2)) continue; // walk-through gap
            const px = alongX ? b : a, pz = alongX ? a : b;
            if (ok(px, pz, 1.2)) this._zvShelf(px, pz, by, alongX, MZ);
          }
        }
        const kind = r.kind === 'armory' ? 'military' : 'supply';
        loot(x0 + 1.2, z0 + 1.0, kind, r.kind === 'armory' ? `${sector} Arms Crate` : 'Supply Crate');
        loot(x1 - 1.2, z1 - 1.0, kind, r.kind === 'armory' ? `${sector} Weapon Case` : 'Supply Crate');
        if (r.kind === 'armory') loot(x1 - 1.2, z0 + 1.0, 'military', 'Ammo Locker');
        break;
      }
      case 'cells': {
        const n = 3;
        for (let k = 0; k < n; k++) {
          const cx0 = x0 + k * (w / n);
          for (let b = 0; b < 8; b++) {
            const bx = cx0 + 0.6 + b * ((w / n - 1.2) / 7);
            if (b === 3 || b === 4) continue;
            this._addBox(bx, by + 1.3, z0 + 8, 0.08, 2.6, 0.08, MZ.darkSteel, true);
          }
          this._addBox(cx0 + 0.05, by + 1.3, z0 + 4, 0.15, 2.6, 8, MZ.paintGreen, true);
          if (rnd() < 0.5) loot(cx0 + 2.2, z0 + 1.0, 'household', 'Prisoner Stash');
        }
        break;
      }
      case 'interrogation': {
        this._zvTable(cx, cz, by, 1.8, 1.0, MZ, MZ.steel);
        this._addBox(cx, by + 0.45, cz + 1.6, 0.6, 0.9, 0.6, MZ.rubber, true);
        this._addBox(cx, by + 0.45, cz - 1.6, 0.6, 0.9, 0.6, MZ.rubber, true);
        this._zvGeo(new THREE.BoxGeometry(0.5, 0.12, 0.5), MZ.lightWarm, cx, (r.ceil || 3.6) - 0.6 + by, cz);
        loot(x0 + 1.0, z0 + 0.7, 'office', 'Evidence Drawer');
        if (rnd() < 0.5) loot(x1 - 1.0, z1 - 0.7, 'valuables', 'Confiscated Valuables');
        break;
      }
      case 'serverhall': {
        // Alpha Cluster: clustered server-rack rows with cross aisles (keeps uplink pads & panels clear)
        for (let pz = z0 + 6; pz <= z1 - 6; pz += 4.5) {
          for (let px = x0 + 10; px <= x1 - 10; px += 13) {
            if (Math.abs(px - cx) < 8) continue;
            if (H.isReserved(px, pz, 4.5) || H.nearOpening(px, pz, by, 5)) continue;
            this._zvServerRack(px, pz, by, 8, true, MZ);
          }
        }
        loot(x0 + 1.2, z0 + 1.0, 'office', 'Server Tape Container');
        loot(x1 - 1.2, z0 + 1.0, 'office', 'Server Tape Container');
        loot(x0 + 1.2, z1 - 1.0, 'valuables', 'Board Locker');
        loot(x1 - 1.2, z1 - 1.0, 'office', 'Server Tape Container');
        break;
      }
      case 'server': {
        const n = Math.max(2, Math.floor((d - 4) / 3));
        for (let k = 0; k < n; k++) {
          const pz = z0 + 2.2 + (k + 0.5) * ((d - 4.4) / n);
          const len = Math.max(3, w - 8);
          if (ok(cx, pz, 1.0)) this._zvServerRack(cx, pz, by, len, true, MZ);
        }
        loot(x0 + 1.0, z1 - 0.8, 'office', 'Tape Cabinet');
        break;
      }
      case 'generator': {
        this._addBox(cx - 4, by + 1.4, cz, 5.0, 2.8, 2.6, MZ.tankGreen, true);
        this._addBox(cx + 5, by + 1.1, cz, 3.0, 2.2, 2.2, MZ.darkSteel, true);
        this._zvPipe(cx - 4, by + 2.8, cz, cx - 4, (r.ceil || 4) + by, cz, 0.3, MZ.pipe);
        loot(x1 - 1.2, z0 + 1.0, 'supply', 'Generator Spares');
        break;
      }
      case 'mess': {
        const rows = Math.max(1, Math.floor((d - 4) / 4));
        for (let k = 0; k < rows; k++) {
          const pz = z0 + 2 + (k + 0.5) * ((d - 4) / rows);
          for (const sx of [-1, 1]) {
            const px = cx + sx * (w / 4);
            if (ok(px, pz, 1.5)) this._zvTable(px, pz, by, Math.min(6, w / 2 - 3), 1.2, MZ, MZ.wood);
          }
        }
        loot(x1 - 1.0, z0 + 0.8, 'household', 'Pantry Cupboard');
        break;
      }
      case 'medical': {
        for (let k = 0; k < 3; k++) { const px = x0 + 3 + k * ((w - 6) / 2); if (ok(px, z0 + 2.2)) this._addBox(px, by + 0.4, z0 + 2.2, 1.0, 0.8, 2.1, MZ.tile, true); }
        loot(x1 - 1.0, z1 - 0.7, 'hospital', 'Field Clinic Cabinet');
        loot(x0 + 1.0, z1 - 0.7, 'hospital', 'Trauma Kit');
        break;
      }
      case 'pump': {
        for (let k = 0; k < 4; k++) {
          const px = x0 + 8 + k * ((w - 16) / 3);
          if (ok(px, cz, 2.0)) {
            this._zvCyl(px, by + 1.2, cz, 1.2, 2.4, MZ.tankGreen, 14, true);
            this._zvPipe(px, by + 2.4, cz, px, by + (r.ceil || 4.5), cz, 0.25, MZ.pipe);
          }
        }
        this._zvPipe(x0 + 1, by + 3.6, z0 + 1.2, x1 - 1, by + 3.6, z0 + 1.2, 0.3, MZ.pipe);
        loot(x0 + 2, z1 - 1.0, 'supply', 'Pump Spares');
        break;
      }
      case 'atrium': {
        this._zvTable(cx, cz, by, 8, 4, MZ, MZ.darkSteel);
        this._zvGeo(new THREE.BoxGeometry(7.6, 0.05, 3.6), MZ.screenBlue, cx, by + 0.8, cz);
        this._zvSign('ОПЕРАЦИИ', 'EXTERNAL OPERATIONS COMMAND', cx, 6.4, z0 + 0.32, 0, 6, 1.4, '#ff5252');
        loot(cx + 6, cz + 8, 'military', 'Ops Weapon Case');
        loot(cx - 6, cz - 8, 'supply', 'Ops Supply Crate');
        break;
      }
      case 'round': {
        this._zvCyl(cx, 2.2, cz, 4.0, 4.4, MZ.darkSteel, 24, true);
        this._zvCyl(cx, 4.8, cz, 2.2, 0.8, MZ.lightAmber, 20, false);
        for (let k = 0; k < 6; k++) {
          const ang = (k / 6) * Math.PI * 2 + 0.3;
          const px = cx + Math.cos(ang) * 10, pz = cz + Math.sin(ang) * 10;
          if (ok(px, pz, 1.4)) this._addBox(px, 0.6, pz, 1.6, 1.2, 0.8, MZ.darkSteel, true);
        }
        loot(cx - 12, cz + 8, 'military', 'Cartel Weapon Case');
        loot(cx + 6, cz - 13, 'valuables', 'Extraction Strongbox');
        break;
      }
      case 'vault': {
        this._addLootContainer(cx - 6, 0, cz + 6, 'boss_key_room', 'ZAVOD-9 LEGENDARY CACHE');
        this._addLootContainer(cx + 6, 0, cz + 6, 'boss_key_room', 'ZAVOD-9 LEGENDARY CACHE');
        this._addLootContainer(cx, 0, cz + 8, 'valuables', 'Gold Reserve Safe');
        this._addLootContainer(cx - 10, 0, cz - 2, 'military', 'Prototype Weapon Case');
        break;
      }
      case 'airlock': {
        this._zvPipe(x0 + 0.6, by + 3.4, z0 + 0.6, x1 - 0.6, by + 3.4, z0 + 0.6, 0.22, MZ.pipe);
        this._zvPipe(x0 + 0.6, by + 3.0, z1 - 0.6, x1 - 0.6, by + 3.0, z1 - 0.6, 0.18, MZ.pipe);
        for (let k = 0; k < Math.floor(w / 2); k++) this._zvGeo(new THREE.BoxGeometry(0.9, 0.02, 0.35), k % 2 ? MZ.rubber : MZ.hazard, x0 + 1 + k * 2, 0.015, cz);
        break;
      }
      case 'lift': {
        if (r.id.endsWith('_entry')) {
          loot(cx + (cx < 0 ? 8 : -8), z0 + 1.0, 'supply', 'Infil Supply Drop');
        }
        break;
      }
      case 'factory_admin': {
        if (ok(-18, -112, 2)) this._zvDesk(-18, -112, by, true, MZ);
        if (ok(18, -112, 2)) this._zvDesk(18, -112, by, true, MZ);
        this._addLootContainer(-44, 0, -106, 'office', 'Admin Filing Safe');
        this._addLootContainer(44, 0, -106, 'military', 'Admin Security Locker');
        break;
      }
      case 'shopkeeper': {
        this._zvTable(63, -113, 0, 1.4, 6.0, MZ, MZ.steel);
        this._zvShelf(76.5, -113, 0, false, MZ);
        this._addLootContainer(74, 0, -113, 'boss_key_room', 'SHOPKEEPER PRIVATE STASH');
        break;
      }
      case 'case_vault': {
        this._addBox(-24, 0.45, -210, 2.2, 0.9, 1.4, MZ.darkSteel, true);
        this._addLootContainer(-30, 0, -215, 'boss_key_room', 'Weapons Case Annex A');
        this._addLootContainer(-18, 0, -215, 'boss_key_room', 'Weapons Case Annex B');
        break;
      }
      default: break;
    }
  };

  // Chemical plant: 5x6 process-cell grid of reactor tanks, vats, pipe racks & control rooms
  P._zvFurnishPlant = function (G, MZ, rnd, H) {
    const colsX = [-36, -18, 0, 18, 36];
    const rowsZ = [-60, -42, -24, 24, 42, 60];
    const types = ['tank', 'control', 'vat', 'rack', 'tank', 'tank', 'vat', 'control'];
    let ti = 0;
    for (const z of rowsZ) {
      for (const x of colsX) {
        const t = types[(ti + Math.floor(rnd() * 3)) % types.length];
        ti++;
        if (t === 'tank') {
          for (const [ox, oz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) {
            if (rnd() < 0.2) continue;
            this._zvCyl(x + ox, 4.5, z + oz, 2.1, 9, rnd() < 0.5 ? MZ.tankGreen : MZ.tankRust, 16, true);
            this._zvPipe(x + ox, 9, z + oz, x + ox, 14, z + oz, 0.35, MZ.pipe);
          }
          this._zvPipe(x - 6, 6.5, z, x + 6, 6.5, z, 0.3, MZ.pipe);
        } else if (t === 'vat') {
          this._addBox(x, 0.7, z, 10, 1.4, 10, MZ.darkSteel, true);
          this._zvGeo(new THREE.BoxGeometry(9.2, 0.05, 9.2), MZ.toxic, x, 1.42, z);
          this._zvPipe(x - 4, 1.6, z - 4, x - 4, 10, z - 4, 0.25, MZ.pipe);
        } else if (t === 'rack') {
          for (const ox of [-5, 5]) for (const oz of [-5, 5]) this._addBox(x + ox, 3.5, z + oz, 0.4, 7, 0.4, MZ.darkSteel, true);
          for (const py of [4.2, 5.4, 6.6]) {
            this._zvPipe(x - 5.5, py, z - 1.2, x + 5.5, py, z - 1.2, 0.32, MZ.pipe);
            this._zvPipe(x - 5.5, py, z + 1.2, x + 5.5, py, z + 1.2, 0.26, MZ.tankRust);
          }
          this._zvBarrel(x - 2, z + 3, 0, MZ, true);
          this._zvBarrel(x + 2.2, z - 3.4, 0, MZ, false);
        } else {
          // Walled control room (open roof) with doorway facing the nearest aisle
          const s = 5;
          const doorSide = x < 0 ? 1 : -1;
          this._addBox(x, 1.6, z - s, 2 * s, 3.2, 0.3, MZ.dark, true);
          this._addBox(x, 1.6, z + s, 2 * s, 3.2, 0.3, MZ.dark, true);
          this._addBox(x - doorSide * s, 1.6, z, 0.3, 3.2, 2 * s, MZ.dark, true);
          this._addBox(x + doorSide * s, 1.6, z - 3.25, 0.3, 3.2, 3.5, MZ.dark, true);
          this._addBox(x + doorSide * s, 1.6, z + 3.25, 0.3, 3.2, 3.5, MZ.dark, true);
          this._zvDesk(x - doorSide * 2.6, z - 2.5, 0, false, MZ);
          this._zvGeo(new THREE.BoxGeometry(0.4, 0.3, 0.4), MZ.lightRed, x, 3.0, z);
          this._addLootContainer(x - doorSide * 3.2, 0, z + 3.0, rnd() < 0.5 ? 'military' : 'office', 'Plant Control Locker');
        }
      }
    }
    // Central cross-hall: main reactor column + ring of feed tanks
    this._zvCyl(0, 7, 0, 6.5, 14, MZ.darkSteel, 28, true);
    this._zvCyl(0, 7.5, 0, 6.9, 0.5, MZ.lightRed, 28, false);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      this._zvPipe(Math.cos(a) * 6.6, 3 + (k % 2), Math.sin(a) * 6.6, Math.cos(a) * 16, 3 + (k % 2), Math.sin(a) * 6.6, 0.3, MZ.pipe);
    }
    for (const [x, z] of [[-26, -6], [26, 6], [-26, 8], [26, -8]]) this._zvCrateStack(x, z, 0, MZ, 2);
    this._addLootContainer(-14, 0, 9, 'military', 'Plant Weapons Line Crate');
    this._addLootContainer(14, 0, -9, 'hospital', 'Chemical Processing Cabinet');
    this._addLootContainer(0, 0, 11, 'valuables', 'Plant Director Safe');
    // Lobe warehouses: pallet racks + chemical drums
    for (const [x0, z0, x1, z1] of [[-100, -60, -52, -16], [-100, 16, -52, 60], [52, -60, 100, -16], [52, 16, 100, 60]]) {
      for (let k = 0; k < 3; k++) {
        const pz = z0 + 8 + k * 14;
        for (let s = 0; s < 3; s++) {
          const px = x0 + 14 + s * 10;
          if (!H.nearOpening(px, pz, 0, 3) && !H.isReserved(px, pz, 2)) {
            this._addBox(px, 1.6, pz, 6, 3.2, 1.2, MZ.steel, true);
            this._zvCrateStack(px - 1.5, pz, 3.2, MZ, 1);
          }
        }
      }
      this._addLootContainer(x0 + 4, 0, z0 + 3, 'supply', 'Plant Warehouse Crate');
      this._addLootContainer(x1 - 4, 0, z1 - 3, 'military', 'Plant Security Case');
    }
  };

  // Factory: assembly lines, CNC machining cells, weapon racks, crate stacks & boss arena
  P._zvFurnishFactory = function (G, MZ, rnd, H) {
    for (const z of [-176, -162, -148, -134]) {
      for (const seg of [[-66, -30], [-18, 18], [30, 66]]) {
        const x0 = seg[0], x1 = seg[1];
        const cx = (x0 + x1) / 2;
        this._addBox(cx, 0.5, z, x1 - x0, 1.0, 1.6, MZ.darkSteel, true);
        this._zvGeo(new THREE.BoxGeometry(x1 - x0 - 0.4, 0.06, 1.2), MZ.rubber, cx, 1.03, z);
        for (let k = 0; k < Math.floor((x1 - x0) / 6); k++) {
          const px = x0 + 3 + k * 6;
          this._zvGeo(new THREE.BoxGeometry(0.9, 0.12, 0.22), MZ.steel, px, 1.12, z);
          this._zvGeo(new THREE.BoxGeometry(0.2, 0.16, 0.12), MZ.rubber, px + 0.3, 1.18, z);
        }
        this._addBox(cx, 2.6, z - 1.6, 2.4, 5.2, 1.4, MZ.tankRust, true);
      }
    }
    // CNC machining cells along east & west walls
    for (const z of [-182, -166, -150, -136, -132]) {
      for (const x of [-74, 74]) {
        this._addBox(x, 1.3, z, 3.4, 2.6, 2.4, MZ.paintBlue, true);
        this._zvGeo(new THREE.BoxGeometry(1.2, 0.8, 0.05), MZ.screen, x + (x < 0 ? 1.73 : -1.73), 1.6, z, Math.PI / 2);
      }
    }
    // Weapon racks / crates for loot
    const lootSpots = [[-78, -130, 'military'], [78, -130, 'military'], [-40, -194, 'military'], [40, -194, 'military'], [0, -130, 'supply'], [-52, -154, 'supply'], [52, -154, 'military']];
    for (const [x, z, k] of lootSpots) this._addLootContainer(x, 0, z, k, k === 'military' ? 'Factory Weapon Crate' : 'Factory Parts Crate');
    this._addLootContainer(-84, 5.6, -196, 'military', 'Mezzanine Arms Cache');
    this._addLootContainer(84, 5.6, -196, 'valuables', 'Foreman Strongbox');
    for (const [x, z] of [[-12, -186], [12, -186], [-24, -130], [24, -130], [-46, -168], [46, -154]]) this._zvCrateStack(x, z, 0, MZ, 2);
  };
})();
