// Offscreen 3D Studio Icon Renderer for All Game Items (Cached WebGL Data URLs)
class ItemIconRenderer {
  constructor() {
    this.cache = {};
    this.canvas = document.createElement('canvas');
    this.canvas.width = 128;
    this.canvas.height = 128;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true
      });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.setPixelRatio(1);
    } catch (e) {
      this.renderer = null;
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 50);

    // Crisp 3-point studio lighting for readable 3D silhouettes & speculars
    const hemi = new THREE.HemisphereLight(0xf0f6ff, 0x222624, 1.05);
    const key = new THREE.DirectionalLight(0xfff1dc, 1.35);
    key.position.set(2.8, 3.8, 4.2);
    const rim = new THREE.DirectionalLight(0x88c8ff, 0.85);
    rim.position.set(-3.2, 2.0, -2.5);
    const fill = new THREE.DirectionalLight(0xffb86b, 0.45);
    fill.position.set(0, -2.5, 2.0);
    this.scene.add(hemi, key, rim, fill);

    this.stage = new THREE.Group();
    this.scene.add(this.stage);
    this.wpnBuilder = null;
  }

  _ensureWeaponBuilder() {
    if (!this.wpnBuilder && typeof WeaponSystem !== 'undefined') {
      const dummyCam = new THREE.Object3D();
      this.wpnBuilder = new WeaponSystem(this.scene, dummyCam);
    }
    return this.wpnBuilder;
  }

  getIcon(itemId, opts = {}) {
    if (!this.renderer) return '';
    const wide = !!opts.wide;
    const modsKey = opts.mods ? JSON.stringify(opts.mods) : '';
    const cacheKey = `${itemId}|${wide ? 'W' : 'S'}|${modsKey}`;
    if (this.cache[cacheKey]) return this.cache[cacheKey];

    const w = wide ? 256 : 128;
    const h = 128;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    while (this.stage.children.length > 0) {
      this.stage.remove(this.stage.children[0]);
    }

    const mesh = this._buildItemMesh(itemId, opts.mods || {});
    if (!mesh) return '';
    this.stage.add(mesh);

    // Auto-frame bounding box cleanly inside icon viewport
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    mesh.position.sub(center);

    const maxDimY = Math.max(size.y, 0.05);
    const maxDimX = Math.max(size.x, 0.05);
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const distV = (maxDimY * 0.5) / Math.tan(fovRad * 0.5);
    const distH = (maxDimX * 0.5) / (Math.tan(fovRad * 0.5) * this.camera.aspect);
    const dist = Math.max(distV, distH) * 1.28 + size.z * 0.55;

    this.camera.position.set(0, 0, Math.max(0.35, dist));
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.canvas.toDataURL('image/png');
    this.cache[cacheKey] = dataUrl;
    return dataUrl;
  }

  _mat(color, emissive = 0x000000) {
    return new THREE.MeshLambertMaterial({ color, emissive });
  }

  _buildItemMesh(id, mods = {}) {
    const def = (window.GAME_DATA && GAME_DATA.ITEMS && GAME_DATA.ITEMS[id]) || null;
    const g = new THREE.Group();

    // 1. REAL 3D WEAPONS (using WeaponSystem.buildThirdPersonWeapon!)
    if (def && def.type === 'weapon') {
      const wb = this._ensureWeaponBuilder();
      if (wb && wb.buildThirdPersonWeapon) {
        const built = wb.buildThirdPersonWeapon(def, mods);
        if (built && built.group) {
          // Side-profile hero angle facing right
          built.group.rotation.set(0.08, Math.PI / 2 - 0.22, 0.14);
          g.add(built.group);
          return g;
        }
      }
    }

    // 2. MELEE WEAPONS
    if (id === 'melee_knife' || id === 'melee_karambit' || id === 'melee_axe') {
      const gripMat = this._mat(0x1f2326);
      const darkSteel = this._mat(0x3a4148);
      const brightEdge = this._mat(0xe0e9f0);
      if (id === 'melee_axe') {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.06), gripMat);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.28), darkSteel);
        head.position.set(0, 0.26, -0.05);
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.24, 0.06), brightEdge);
        edge.position.set(0, 0.26, -0.20);
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 4), darkSteel);
        spike.rotation.x = Math.PI / 2;
        spike.position.set(0, 0.28, 0.14);
        g.add(handle, head, edge, spike);
      } else if (id === 'melee_karambit') {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 8, 16), darkSteel);
        ring.position.set(-0.22, -0.18, 0);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.06), gripMat);
        handle.position.set(-0.07, -0.09, 0);
        handle.rotation.z = 0.55;
        const bladeShape = new THREE.Shape();
        bladeShape.moveTo(0, -0.03);
        bladeShape.quadraticCurveTo(0.20, 0.06, 0.34, -0.18);
        bladeShape.quadraticCurveTo(0.18, -0.02, 0.02, -0.08);
        bladeShape.closePath();
        const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: 0.02, bevelEnabled: false }), brightEdge);
        blade.position.set(0.02, 0.04, -0.01);
        g.add(ring, handle, blade);
      } else {
        // Combat Knife
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.28, 10), gripMat);
        handle.rotation.z = Math.PI / 2;
        handle.position.set(-0.22, 0, 0);
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.06), darkSteel);
        guard.position.set(-0.07, 0, 0);
        const bladeShape = new THREE.Shape();
        bladeShape.moveTo(0, -0.055);
        bladeShape.lineTo(0.32, -0.045);
        bladeShape.lineTo(0.46, 0.03);
        bladeShape.lineTo(0.30, 0.065);
        bladeShape.lineTo(0, 0.06);
        bladeShape.closePath();
        const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: 0.018, bevelEnabled: false }), brightEdge);
        blade.position.set(-0.05, 0, -0.009);
        g.add(handle, guard, blade);
      }
      g.rotation.set(0.22, -0.35, 0.38);
      return g;
    }

    // 3. ARMOR VESTS
    if (def && def.type === 'armor') {
      const colMap = {
        vest_1plate: 0x5d6452,
        vest_2plate: 0x455342,
        vest_2plate_gel: 0x2c4b6e,
        vest_2plate_helmet: 0x52376b,
        vest_3plate: 0x7a2626
      };
      const baseMat = this._mat(colMap[id] || 0x4b5342);
      const pouchMat = this._mat(0x232724);
      const trimMat = this._mat(id === 'vest_3plate' ? 0xff4d4d : (id === 'vest_2plate_gel' ? 0x58b8ff : 0x7a8474));
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.22), baseMat);
      const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.24), pouchMat);
      strapL.position.set(-0.15, 0.30, 0);
      const strapR = strapL.clone();
      strapR.position.x = 0.15;
      for (let i = -1; i <= 1; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.06), pouchMat);
        p.position.set(i * 0.14, -0.10, 0.13);
        g.add(p);
      }
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.03), trimMat);
      badge.position.set(0, 0.14, 0.12);
      g.add(torso, strapL, strapR, badge);
      if (id === 'vest_2plate_helmet') {
        const helm = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), this._mat(0x2c2e33));
        helm.position.set(0, 0.42, 0);
        g.add(helm);
      }
      g.rotation.set(0.22, -0.42, 0);
      return g;
    }

    // 4. ARMOR PLATE
    if (id === 'armor_plate') {
      const shape = new THREE.Shape();
      shape.moveTo(-0.22, -0.28);
      shape.lineTo(0.22, -0.28);
      shape.lineTo(0.22, 0.16);
      shape.lineTo(0.11, 0.28);
      shape.lineTo(-0.11, 0.28);
      shape.lineTo(-0.22, 0.16);
      shape.closePath();
      const plate = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 }),
        this._mat(0x2a4563)
      );
      plate.position.z = -0.025;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.07), this._mat(0x52b8ff, 0x0d2840));
      stripe.position.set(0, 0.04, 0.01);
      g.add(plate, stripe);
      g.rotation.set(0.20, -0.45, 0.08);
      return g;
    }

    // 5. BACKPACKS
    if (def && def.type === 'backpack') {
      const s = id === 'bag_large' ? 1.18 : (id === 'bag_medium' ? 1.0 : 0.84);
      const col = id === 'bag_large' ? 0x6b4f2a : (id === 'bag_medium' ? 0x344c63 : 0x4a5244);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42 * s, 0.54 * s, 0.24 * s), this._mat(col));
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.24 * s, 0.10 * s), this._mat(0x232724));
      pocket.position.set(0, -0.10 * s, 0.15 * s);
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.40 * s, 0.12 * s, 0.26 * s), this._mat(0x1f2220));
      flap.position.set(0, 0.23 * s, 0.01);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07 * s, 0.018, 6, 12, Math.PI), this._mat(0x181a18));
      handle.position.set(0, 0.29 * s, 0);
      g.add(body, pocket, flap, handle);
      g.rotation.set(0.22, -0.48, 0);
      return g;
    }

    // 6. HEADGEAR (Gas Mask & NVG Goggles)
    if (id === 'gas_mask') {
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.24), this._mat(0x232629));
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, 0.06), this._mat(0x3a7ca5, 0x0a2538));
      visor.position.set(0, 0.07, 0.12);
      const fL = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.12, 12), this._mat(0x383d40));
      fL.rotation.z = Math.PI / 2;
      fL.position.set(-0.20, -0.08, 0.06);
      const fR = fL.clone();
      fR.position.x = 0.20;
      g.add(mask, visor, fL, fR);
      g.rotation.set(0.18, -0.40, 0);
      return g;
    }
    if (id === 'nvg_goggles') {
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.10, 0.14), this._mat(0x2a2d28));
      bridge.position.set(0, 0.06, -0.04);
      const lensMat = this._mat(0x39ff6a, 0x166b2c);
      [-0.18, -0.06, 0.06, 0.18].forEach((x, idx) => {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.22, 10), this._mat(0x1f2220));
        tube.rotation.x = Math.PI / 2;
        tube.position.set(x, -0.02 + (idx === 1 || idx === 2 ? 0.02 : 0), 0.08);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.04, 10), lensMat);
        lens.position.set(x, tube.position.y, 0.192);
        g.add(tube, lens);
      });
      g.add(bridge);
      g.rotation.set(0.22, -0.45, 0);
      return g;
    }

    // 7. MEDICAL & SELF-REVIVE
    if (id === 'medkit') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.20), this._mat(0xdce3de));
      const cH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.02), this._mat(0xe03232, 0x450808));
      const cV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.02), this._mat(0xe03232, 0x450808));
      cH.position.z = 0.105; cV.position.z = 0.105;
      g.add(box, cH, cV);
      g.rotation.set(0.24, -0.42, 0);
      return g;
    }
    if (id === 'bandage') {
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.24, 14), this._mat(0xe8eae6));
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 10), this._mat(0x9a9e98));
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.02), this._mat(0xd6dad4));
      tail.position.set(0.18, 0, 0.14);
      g.add(roll, core, tail);
      g.rotation.set(0.42, -0.35, 0.22);
      return g;
    }
    if (id === 'painkillers') {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.34, 12), this._mat(0xd97324));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.09, 12), this._mat(0xf0f2f0));
      cap.position.y = 0.21;
      const lbl = new THREE.Mesh(new THREE.CylinderGeometry(0.134, 0.134, 0.16, 12), this._mat(0xf2f4f0));
      g.add(bottle, cap, lbl);
      g.rotation.set(0.24, -0.30, 0.28);
      return g;
    }
    if (id === 'self_revive') {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.42, 12), this._mat(0x2a2d32));
      const serum = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.18, 12), this._mat(0xc962ff, 0x451268));
      serum.position.y = 0.02;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.10, 10), this._mat(0x69f0ae));
      cap.position.y = 0.24;
      const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8), this._mat(0xdce6ee));
      needle.position.y = -0.26;
      g.add(barrel, serum, cap, needle);
      g.rotation.set(0.22, -0.25, -0.55);
      return g;
    }

    // 8. THROWABLES (Frag, Throwing Knife, Smoke, Concussion)
    if (id === 'frag_grenade') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), this._mat(0x455939));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.12, 10), this._mat(0x282c2a));
      neck.position.y = 0.20;
      const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.04), this._mat(0x8a9288));
      spoon.position.set(0.11, 0.12, 0);
      spoon.rotation.z = -0.35;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 12), this._mat(0xd0d6d2));
      ring.position.set(-0.08, 0.22, 0);
      g.add(body, neck, spoon, ring);
      g.rotation.set(0.22, -0.35, 0.18);
      return g;
    }
    if (id === 'throwing_knife') {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.56, 4), this._mat(0xd0dae2));
      blade.scale.set(0.35, 1, 1);
      const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.07), this._mat(0x8c2f2f));
      wrap.position.y = -0.20;
      g.add(blade, wrap);
      g.rotation.set(0.25, -0.25, -0.65);
      return g;
    }
    if (id === 'smoke_grenade' || id === 'concussion_grenade') {
      const isSmoke = id === 'smoke_grenade';
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 12), this._mat(isSmoke ? 0x52614c : 0x353b42));
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.114, 0.114, 0.09, 12), this._mat(isSmoke ? 0x69f0ae : 0x64b5f6));
      band.position.y = 0.06;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.09, 10), this._mat(0x222528));
      top.position.y = 0.25;
      g.add(body, band, top);
      g.rotation.set(0.24, -0.32, 0.25);
      return g;
    }

    // 9. AMMO TYPES
    if (def && def.type === 'ammo') {
      if (id === 'ammo_rocket') {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.52, 10), this._mat(0x4b563c));
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.24, 10), this._mat(0x556442));
        head.position.y = 0.26;
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.04, 10), this._mat(0xffca28));
        band.position.y = 0.15;
        g.add(tube, head, band);
        g.rotation.set(0.22, -0.30, -0.65);
        return g;
      }
      const isShotgun = id === 'ammo_12g';
      const isRifle = id === 'ammo_545' || id === 'ammo_762';
      const caseCol = isShotgun ? 0xb52b2b : 0xd4a946;
      const tipCol = isShotgun ? 0xd4a946 : 0xb87333;
      [-0.12, 0, 0.12].forEach((x) => {
        const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.048, isRifle ? 0.30 : 0.22, 10), this._mat(caseCol));
        casing.position.set(x, -0.04, 0);
        const tip = isShotgun
          ? new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.09, 10), this._mat(tipCol))
          : new THREE.Mesh(new THREE.ConeGeometry(0.044, isRifle ? 0.18 : 0.11, 10), this._mat(tipCol));
        tip.position.set(x, isShotgun ? -0.15 : (isRifle ? 0.20 : 0.12), 0);
        g.add(casing, tip);
      });
      g.rotation.set(0.26, -0.35, 0.22);
      return g;
    }

    // 10. FIELD UPGRADES & KILLSTREAKS
    if (def && def.type === 'field_upgrade') {
      if (id === 'fu_ammo_box') {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.30, 0.32), this._mat(0x415238));
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.07, 0.34), this._mat(0x2f3b28));
        lid.position.y = 0.17;
        const mark = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.10, 0.02), this._mat(0xffca28));
        mark.position.set(0, 0, 0.17);
        g.add(box, lid, mark);
      } else if (id === 'fu_trophy') {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.14, 10), this._mat(0x2e3438));
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), this._mat(0x42a5f5, 0x0d2842));
        dome.position.y = 0.16;
        g.add(base, dome);
      } else {
        // Dead Silence acoustic dampener module
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.14), this._mat(0x242a30));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 16), this._mat(0x69f0ae, 0x124024));
        ring.position.z = 0.08;
        g.add(pad, ring);
      }
      g.rotation.set(0.28, -0.45, 0);
      return g;
    }
    if (def && def.type === 'killstreak') {
      if (id === 'ks_uav') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.44), this._mat(0x3a424a));
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.03, 0.14), this._mat(0x525d66));
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.08), this._mat(0x42a5f5));
        tail.position.z = 0.20;
        g.add(body, wing, tail);
        g.rotation.set(0.45, -0.55, 0.15);
        return g;
      }
      // Precision Airstrike laser designator
      const bL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.32, 10), this._mat(0x2d322c));
      bL.rotation.x = Math.PI / 2; bL.position.x = -0.10;
      const bR = bL.clone(); bR.position.x = 0.10;
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.16), this._mat(0x1f2220));
      const laser = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10), this._mat(0xff3d3d, 0x770000));
      laser.position.set(0.10, 0, 0.165);
      g.add(bL, bR, bridge, laser);
      g.rotation.set(0.24, -0.45, 0);
      return g;
    }

    // 11. KEYS, DOGTAGS, CASH & VALUABLES
    if (id === 'boss_key') {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.032, 8, 16), this._mat(0xffc107, 0x453000));
      bow.position.x = -0.18;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.38, 8), this._mat(0xffc107, 0x453000));
      shaft.rotation.z = Math.PI / 2;
      shaft.position.x = 0.09;
      const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.03), this._mat(0xffd54f));
      tooth1.position.set(0.18, -0.05, 0);
      const tooth2 = tooth1.clone(); tooth2.position.x = 0.25;
      g.add(bow, shaft, tooth1, tooth2);
      g.rotation.set(0.22, -0.35, 0.42);
      return g;
    }
    if (id === 'dogtag') {
      const tag1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.022), this._mat(0xcfd8dc));
      const tag2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.022), this._mat(0x90a4ae));
      tag2.position.set(0.08, -0.04, -0.03);
      tag2.rotation.z = -0.18;
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.014, 6, 14, Math.PI), this._mat(0xb0bec5));
      chain.position.set(0, 0.19, 0);
      g.add(tag1, tag2, chain);
      g.rotation.set(0.18, -0.35, 0.10);
      return g;
    }
    if (id === 'cash') {
      const stack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.26), this._mat(0x4caf50));
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.15, 0.27), this._mat(0xffca28));
      g.add(stack, band);
      g.rotation.set(0.42, -0.45, 0.12);
      return g;
    }
    if (id === 'gold_watch') {
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16), this._mat(0xffca28, 0x3b2a00));
      face.rotation.x = Math.PI / 2;
      const dial = new THREE.Mesh(new THREE.CircleGeometry(0.105, 14), this._mat(0x1b1e22));
      dial.position.z = 0.035;
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.03), this._mat(0xd4a017));
      g.add(face, dial, strap);
      g.rotation.set(0.25, -0.40, 0.25);
      return g;
    }
    if (id === 'intel_drive') {
      const drive = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.09), this._mat(0x262c33));
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.10), this._mat(0xab47bc, 0x380e42));
      stripe.position.y = 0.12;
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.10), this._mat(0x69f0ae, 0x1b6636));
      led.position.set(0.10, -0.14, 0);
      g.add(drive, stripe, led);
      g.rotation.set(0.28, -0.42, 0.08);
      return g;
    }
    if (id === 'fuel_can') {
      const can = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.20), this._mat(0xb83228));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), this._mat(0x222222));
      cap.position.set(0.10, 0.26, 0);
      g.add(can, cap);
      g.rotation.set(0.24, -0.45, 0);
      return g;
    }
    if (id === 'water_filter') {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 14), this._mat(0x42a5f5));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 14), this._mat(0xe0e6e8));
      cap.position.y = 0.22;
      g.add(cyl, cap);
      g.rotation.set(0.26, -0.35, 0.18);
      return g;
    }

    // 12. COMMON CRAFTING MATERIALS (Salvaged Steel, Ballistic Cloth, Powder, Polymer)
    if (id === 'scrap_metal') {
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.10, 0.22), this._mat(0x78828a));
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.10, 0.18), this._mat(0x9aa4ac));
      b2.position.set(0, 0.10, 0); b2.rotation.y = 0.35;
      g.add(b1, b2);
      g.rotation.set(0.38, -0.45, 0.10);
      return g;
    }
    if (id === 'cloth_roll') {
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.46, 12), this._mat(0x6b7c59));
      roll.rotation.z = Math.PI / 2;
      g.add(roll);
      g.rotation.set(0.32, -0.45, 0.22);
      return g;
    }
    if (id === 'gunpowder') {
      const jar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.22), this._mat(0x282b2e));
      const lbl = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.12, 0.23), this._mat(0xd4a428));
      g.add(jar, lbl);
      g.rotation.set(0.26, -0.42, 0);
      return g;
    }
    if (id === 'polymer_parts') {
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.28), this._mat(0x3a4652));
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 10), this._mat(0x526575));
      p2.position.set(0.10, 0.12, 0);
      g.add(p1, p2);
      g.rotation.set(0.32, -0.45, 0.10);
      return g;
    }

    // Fallback tactical crate cube
    const fallback = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), this._mat(0x69f0ae));
    fallback.rotation.set(0.35, -0.45, 0);
    g.add(fallback);
    return g;
  }
}

window.itemIcons = new ItemIconRenderer();
