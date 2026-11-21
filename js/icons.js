// Offscreen 3D Studio Icon Renderer for All Game Items (Cached WebGL Data URLs)
class ItemIconRenderer {
  constructor() {
    this.cache = {};
    this.canvas = document.createElement('canvas');
    this.canvas.width = 160;
    this.canvas.height = 160;
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
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);

    // High-contrast tactical studio 3-point specular lighting matching reference icon language
    const hemi = new THREE.HemisphereLight(0xf6faff, 0x262c32, 1.15);
    const key = new THREE.DirectionalLight(0xffffff, 1.45);
    key.position.set(2.4, 3.6, 4.6);
    const rim = new THREE.DirectionalLight(0xaad8ff, 0.95);
    rim.position.set(-3.4, 2.2, -2.6);
    const fill = new THREE.DirectionalLight(0xdce6f0, 0.50);
    fill.position.set(0, -2.2, 2.5);
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

    const w = wide ? 384 : 192;
    const h = 192;
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
    const padMult = wide ? 1.10 : 1.28;
    const dist = Math.max(distV, distH) * padMult + size.z * (wide ? 0.38 : 0.55);

    this.camera.position.set(0, 0, Math.max(0.32, dist));
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.canvas.toDataURL('image/png');
    this.cache[cacheKey] = dataUrl;
    return dataUrl;
  }

  _mat(color, emissive = 0x000000, shininess = 42, specular = 0x5a6570) {
    return new THREE.MeshPhongMaterial({ color, emissive, shininess, specular });
  }

  _buildItemMesh(id, mods = {}) {
    const def = (window.GAME_DATA && GAME_DATA.ITEMS && GAME_DATA.ITEMS[id]) || null;
    const g = new THREE.Group();

    // 1. REAL 3D WEAPONS (crisp horizontal side-profile studio render matching reference!)
    if (def && def.type === 'weapon') {
      const wb = this._ensureWeaponBuilder();
      if (wb && wb.buildThirdPersonWeapon) {
        const built = wb.buildThirdPersonWeapon(def, mods);
        if (built && built.group) {
          built.group.rotation.set(0.02, Math.PI / 2 - 0.04, 0.0);
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
      g.rotation.set(0.04, -0.06, 0.0);
      return g;
    }

    // 3. ARMOR VESTS (Front-facing studio plate-carrier silhouette matching reference!)
    if (def && def.type === 'armor') {
      const colMap = {
        vest_1plate: 0xd8c39e,       // tactical desert tan
        vest_2plate: 0x7a8376,       // ranger olive-grey
        vest_2plate_gel: 0x526d88,   // tactical slate-blue
        vest_2plate_helmet: 0x625a70,// heavy tactical charcoal-violet
        vest_3plate: 0x8f3636        // crimson heavy plate carrier
      };
      const baseMat = this._mat(colMap[id] || 0x7a8376, 0x000000, 22, 0x3a4044);
      const pouchMat = this._mat(0x3a403c, 0x000000, 18, 0x2c3034);
      const trimMat = this._mat(id === 'vest_3plate' ? 0xff5c5c : (id === 'vest_2plate_gel' ? 0x64c8ff : 0xb8c2ba));
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.18), baseMat);
      const cumbL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.14), baseMat);
      cumbL.position.set(-0.27, -0.10, 0);
      const cumbR = cumbL.clone(); cumbR.position.x = 0.27;
      const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.17, 0.18), baseMat);
      strapL.position.set(-0.15, 0.32, 0);
      const strapR = strapL.clone(); strapR.position.x = 0.15;
      for (let i = -1; i <= 1; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.17, 0.06), pouchMat);
        p.position.set(i * 0.135, -0.11, 0.11);
        g.add(p);
      }
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.03), trimMat);
      badge.position.set(0, 0.14, 0.10);
      g.add(torso, cumbL, cumbR, strapL, strapR, badge);
      if (id === 'vest_2plate_helmet') {
        const helm = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), this._mat(0x383d44, 0x000000, 55));
        helm.position.set(0, 0.44, 0);
        g.add(helm);
      }
      g.rotation.set(0.06, -0.10, 0);
      return g;
    }

    // 4. ARMOR PLATE (Front-facing charcoal SAPI ceramic plate with white upper stencil!)
    if (id === 'armor_plate') {
      const shape = new THREE.Shape();
      shape.moveTo(-0.23, -0.30);
      shape.lineTo(0.23, -0.30);
      shape.lineTo(0.23, 0.16);
      shape.lineTo(0.11, 0.30);
      shape.lineTo(-0.11, 0.30);
      shape.lineTo(-0.23, 0.16);
      shape.closePath();
      const plate = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }),
        this._mat(0x3d444d, 0x000000, 38, 0x7b8896)
      );
      plate.position.z = -0.025;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.032, 0.068), this._mat(0xdce6f0, 0x1a2633, 60));
      stripe.position.set(0, 0.10, 0.005);
      g.add(plate, stripe);
      g.rotation.set(0.06, -0.08, 0.0);
      return g;
    }

    // 5. BACKPACKS (Front-facing upright tactical rucksack matching reference!)
    if (def && def.type === 'backpack') {
      const isWpnBag = id === 'bag_weapon';
      const s = (id === 'bag_large' || isWpnBag) ? 1.14 : (id === 'bag_medium' ? 1.0 : 0.88);
      const col = isWpnBag ? 0x4c5866 : (id === 'bag_large' ? 0x8e7c5a : (id === 'bag_medium' ? 0x879282 : 0x626b5c));
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42 * s, 0.56 * s, 0.22 * s), this._mat(col, 0x000000, 20));
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.24 * s, 0.09 * s), this._mat(0x343b38, 0x000000, 22));
      pocket.position.set(0, -0.10 * s, 0.14 * s);
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.40 * s, 0.12 * s, 0.24 * s), this._mat(0x2d3330, 0x000000, 25));
      flap.position.set(0, 0.23 * s, 0.01);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07 * s, 0.018, 6, 12, Math.PI), this._mat(0x222624));
      handle.position.set(0, 0.29 * s, 0);
      g.add(body, pocket, flap, handle);
      if (isWpnBag) {
        const badge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.04), this._mat(0xf5a623, 0x3b2200, 50));
        badge.position.set(0, 0.10, 0.14);
        const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.54, 0.25), this._mat(0x262c32));
        strapL.position.set(-0.12, 0, 0);
        const strapR = strapL.clone(); strapR.position.x = 0.12;
        g.add(badge, strapL, strapR);
      }
      g.rotation.set(0.06, -0.12, 0);
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

    // 7. MEDICAL & SELF-REVIVE (matching reference photo's sterile gauze, IFAK pouch, brown bottle & sleek injector!)
    if (id === 'medkit') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.22), this._mat(0x8a9278, 0x000000, 20));
      const zip = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.03, 0.23), this._mat(0x222624));
      zip.position.y = 0.14;
      const patch = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.20, 0.03), this._mat(0x282d2a));
      patch.position.set(0, -0.02, 0.115);
      const cH = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.02), this._mat(0xe53935, 0x450808));
      const cV = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.02), this._mat(0xe53935, 0x450808));
      cH.position.set(0, -0.02, 0.13); cV.position.set(0, -0.02, 0.13);
      g.add(box, zip, patch, cH, cV);
      g.rotation.set(0.18, -0.42, 0.05);
      return g;
    }
    if (id === 'bandage') {
      // Crisp sterile ice-white gauze pack angled diagonally (row 1 of reference)
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.24, 0.10), this._mat(0xdce8f0, 0x101c24, 28));
      const seamL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.03), this._mat(0x9ab4c6));
      seamL.position.x = -0.25;
      const seamR = seamL.clone(); seamR.position.x = 0.25;
      g.add(pack, seamL, seamR);
      g.rotation.set(0.32, -0.22, 0.42);
      return g;
    }
    if (id === 'painkillers') {
      // Realistic amber-brown glass medicine bottle with crisp white label & white cap
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.36, 14), this._mat(0x6e3226, 0x1a0804, 65, 0x997060));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.125, 0.08, 12), this._mat(0x6e3226, 0x1a0804, 65));
      neck.position.y = 0.20;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.075, 12), this._mat(0xf2f5f7, 0x000000, 40));
      cap.position.y = 0.27;
      const lbl = new THREE.Mesh(new THREE.CylinderGeometry(0.139, 0.139, 0.18, 14), this._mat(0xeef2f4, 0x000000, 18));
      lbl.position.y = -0.02;
      g.add(bottle, neck, cap, lbl);
      g.rotation.set(0.12, -0.20, 0.0);
      return g;
    }
    if (id === 'self_revive') {
      // Sleek white-chrome medical auto-injector pen angled diagonally (row 1 of reference)
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.56, 12), this._mat(0xedf2f6, 0x101820, 65));
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.18, 0.07), this._mat(0x283238));
      clip.position.set(0.04, 0.14, 0);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.054, 0.09, 10), this._mat(0x69f0ae, 0x124028, 45));
      cap.position.y = 0.30;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.09, 10), this._mat(0x4fc3f7));
      tip.rotation.x = Math.PI;
      tip.position.y = -0.32;
      g.add(body, clip, cap, tip);
      g.rotation.set(0.15, -0.18, -0.95);
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

    // 11. KEYS, DOGTAGS, CASH & VALUABLES (styled to match reference photo's gleaming brass key+blue fob, engraved gold dogtag, mint jug & glowing canister!)
    if (id === 'boss_key') {
      const goldMat = this._mat(0xe6be78, 0x3b2a08, 85, 0xfff0c8);
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.028, 8, 16), goldMat);
      bow.position.set(0.02, 0.20, 0);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 8), goldMat);
      shaft.position.set(0.02, -0.08, 0);
      const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.036, 0.024), goldMat);
      tooth1.position.set(-0.04, -0.20, 0);
      const tooth2 = tooth1.clone(); tooth2.position.y = -0.27;
      // Iconic bright cyan-blue circular key-tag fob (exact match to row 2 of reference!)
      const fob = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.024, 16), this._mat(0x3ba4f5, 0x0b345c, 55));
      fob.rotation.x = Math.PI / 2;
      fob.position.set(0.22, 0.24, 0.02);
      g.add(bow, shaft, tooth1, tooth2, fob);
      g.rotation.set(0.10, -0.15, -0.52);
      return g;
    }
    if (id === 'dogtag') {
      // Iconic golden-bronze engraved trapezoidal dogtag shield with Roman numeral II
      const shape = new THREE.Shape();
      shape.moveTo(-0.20, -0.24);
      shape.lineTo(0.20, -0.24);
      shape.lineTo(0.13, 0.24);
      shape.lineTo(-0.13, 0.24);
      shape.closePath();
      const plate = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 }),
        this._mat(0xd4ad5a, 0x382808, 90, 0xfff0c2)
      );
      plate.position.z = -0.018;
      const num1 = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.22, 0.052), this._mat(0x6b4b1a, 0x000000, 60));
      num1.position.set(-0.05, -0.02, 0.005);
      const num2 = num1.clone(); num2.position.x = 0.05;
      const barTop = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.032, 0.052), this._mat(0x6b4b1a));
      barTop.position.set(0, 0.09, 0.005);
      const barBot = barTop.clone(); barBot.position.y = -0.13;
      g.add(plate, num1, num2, barTop, barBot);
      g.rotation.set(0.10, -0.18, 0.06);
      return g;
    }
    if (id === 'cash') {
      const stack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.26), this._mat(0x4caf50, 0x08240a, 24));
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.15, 0.27), this._mat(0xf5c842, 0x362400, 50));
      g.add(stack, band);
      g.rotation.set(0.38, -0.35, 0.12);
      return g;
    }
    if (id === 'gold_watch') {
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 18), this._mat(0xffca28, 0x3b2a00, 95, 0xfff2c2));
      face.rotation.x = Math.PI / 2;
      const dial = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), this._mat(0x1b1e22, 0x000000, 80));
      dial.position.z = 0.035;
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.03), this._mat(0xd4a017, 0x2a1c00, 80));
      g.add(face, dial, strap);
      g.rotation.set(0.18, -0.30, 0.22);
      return g;
    }
    if (id === 'gpu_unit') {
      // Metallic brushed square tech/processor safe module (exact match to row 4 of reference!)
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.14), this._mat(0x8894a0, 0x000000, 80, 0xdce8f2));
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.16), this._mat(0x283038, 0x000000, 60));
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 14), this._mat(0xd4af37, 0x2e2000, 90));
      hub.rotation.x = Math.PI / 2;
      g.add(frame, inner, hub);
      g.rotation.set(0.12, -0.22, 0);
      return g;
    }
    if (id === 'intel_drive') {
      const drive = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 0.09), this._mat(0x9ca4aa, 0x000000, 60));
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.10), this._mat(0x3a4046));
      stripe.position.y = 0.04;
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.10), this._mat(0x69f0ae, 0x1b6636));
      led.position.set(0.14, -0.08, 0);
      g.add(drive, stripe, led);
      g.rotation.set(0.28, -0.32, 0.14);
      return g;
    }
    if (id === 'fuel_can') {
      // Mint-green plastic jerrycan with top handle & crisp white label (exact match to row 2 of reference!)
      const can = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.20), this._mat(0x8ee6b4, 0x0d2b1a, 45, 0xd8ffea));
      const lbl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.21), this._mat(0xeef4f2, 0x000000, 15));
      lbl.position.set(0, -0.02, 0);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 10), this._mat(0x283430));
      cap.position.set(-0.10, 0.25, 0);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.07), this._mat(0x78d4a0));
      handle.position.set(0.08, 0.24, 0);
      g.add(can, lbl, cap, handle);
      g.rotation.set(0.14, -0.30, 0);
      return g;
    }
    if (id === 'water_filter') {
      // Armored dark canister with glowing ice-blue core (exact match to Secure Slot 1 of reference!)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 12), this._mat(0x262d34, 0x000000, 65));
      base.position.y = -0.18;
      const top = base.clone(); top.position.y = 0.18;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.28, 14), this._mat(0x3ba4f5, 0x0e4c8a, 80, 0xaae0ff));
      g.add(base, top, core);
      g.rotation.set(0.12, -0.22, 0);
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
