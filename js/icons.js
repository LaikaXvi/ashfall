// Offscreen 3D Studio Icon Renderer for All Game Items (Cached WebGL Data URLs)
const ITEM_MODEL_MAP = {
  medkit:       { model: 'medical_box' },
  bandage:      { model: 'medical_tape' },
  fuel_can:     { model: 'plastic_jerrycan' },
  gold_watch:   { model: 'vintage_pocket_watch' },
  gas_mask:     { model: 'old_gas_mask' },
  ammo_9x18:    { model: 'ammo_box', tint: 0xc9b27a },
  ammo_9x19:    { model: 'ammo_box', tint: 0xb0b6a0 },
  ammo_739:     { model: 'ammo_box', tint: 0x8f9a6a },
  ammo_12g:     { model: 'ammo_box', tint: 0xb04a3a },
  ammo_762:     { model: 'ammo_box', tint: 0x7a8a5a },
  fu_ammo_box:  { model: 'ammo_box', tint: 0xffffff },
  ammo_rocket:  { model: 'wooden_military_crate' },
  gunpowder:    { model: 'oil_tin' },
  ks_uav:       { model: 'vintage_radio_transceiver' },
  ks_airstrike: { model: 'vintage_radio_transceiver' }
};

class ItemIconRenderer {
  constructor() {
    this.cache = {};
    this._itemModels = {};
    this._itemModelsPromise = null;
    this._portraitCache = null;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 144;
    this.canvas.height = 144;
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
    this.canvas2d = document.createElement('canvas');
  }

  _ensureWeaponBuilder() {
    if (!this.wpnBuilder && typeof WeaponSystem !== 'undefined') {
      const dummyCam = new THREE.Object3D();
      this.wpnBuilder = new WeaponSystem(this.scene, dummyCam);
    }
    return this.wpnBuilder;
  }

  getIcon(itemId, opts = {}) {
    const def = (window.GAME_DATA && GAME_DATA.ITEMS && GAME_DATA.ITEMS[itemId]) || null;
    const wide = !!opts.wide;
    const rawMods = opts.mods || {};
    const mods = (window.GAME_DATA && GAME_DATA.normalizeWeaponMods)
      ? GAME_DATA.normalizeWeaponMods(rawMods)
      : (() => {
          const clean = {};
          ['optic', 'muzzle', 'underbarrel', 'magazine', 'stock'].forEach((k) => {
            if (rawMods[k] && rawMods[k] !== 'none') clean[k] = rawMods[k];
          });
          return clean;
        })();
    const modsKey = Object.keys(mods).length ? JSON.stringify(mods) : '';
    const cacheKey = `${itemId}|${wide ? 'W' : 'S'}|${modsKey}`;
    if (this.cache[cacheKey]) return this.cache[cacheKey];

    // Primary path for weapons: crisp 2D side-profile vector icon with highlighted equipped attachments
    if (def && def.type === 'weapon') {
      const url2d = this._render2DWeaponIcon(itemId, mods, wide);
      if (url2d) {
        this.cache[cacheKey] = url2d;
        return url2d;
      }
    }

    if (!this.renderer) return '';

    const w = wide ? 304 : 144;
    const h = 144;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    while (this.stage.children.length > 0) {
      this.stage.remove(this.stage.children[0]);
    }

    const mesh = this._buildItemMesh(itemId, mods);
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
    const padMult = (def && def.type === 'armor') ? 1.18 : 1.04;
    const dist = Math.max(distV, distH) * padMult + size.z * (wide ? 0.38 : 0.55);
    const camYOff = (def && def.type === 'armor') ? -size.y * 0.09 : 0;

    this.camera.position.set(0, camYOff, Math.max(0.32, dist));
    this.camera.lookAt(0, camYOff * 0.6, 0);

    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.canvas.toDataURL('image/png');
    this.cache[cacheKey] = dataUrl;
    while (this.stage.children.length > 0) this.stage.remove(this.stage.children[0]);
    if (window.AshfallRenderer && window.AshfallRenderer.disposeSceneGraph) {
      window.AshfallRenderer.disposeSceneGraph(mesh);
    }
    return dataUrl;
  }

  _mat(color, emissive = 0x000000, shininess = 42, specular = 0x5a6570) {
    if (!this._matPool) this._matPool = new Map();
    const k = `${color}|${emissive}|${shininess}|${specular}`;
    if (this._matPool.has(k)) return this._matPool.get(k);
    const m = new THREE.MeshPhongMaterial({ color, emissive, shininess, specular });
    m.userData._ashShared = true;
    this._matPool.set(k, m);
    return m;
  }

  _get2DWeaponSpecs() {
    if (this._weapon2DSpecs) return this._weapon2DSpecs;
    this._weapon2DSpecs = {
      pm9: {
        parts: [
          { pts: [[56, 22], [138, 22], [142, 26], [142, 33], [54, 33], [56, 26]], kind: 'body' },
          { pts: [[88, 33], [136, 33], [134, 39], [86, 39]], kind: 'body' },
          { pts: [[142, 27], [148, 27], [148, 31], [142, 31]], kind: 'body' },
          { pts: [[56, 33], [82, 33], [70, 66], [44, 64]], kind: 'wood' },
          { pts: [[82, 39], [107, 39], [104, 49], [80, 49]], kind: 'detail' }
        ],
        iron: [
          [[133, 19], [137, 19], [137, 22], [133, 22]],
          [[59, 19], [64, 19], [64, 22], [59, 22]]
        ],
        factoryStock: null,
        mag: [[51, 64], [69, 66], [67, 70], [49, 68]],
        lines: [[[66, 25], [126, 25]], [[56, 29], [66, 29]]],
        anchors: { optic: { x: 74, y: 22, len: 28 }, muzzle: { x: 148, y: 29 }, under: { x: 118, y: 39 }, stock: null }
      },
      g17: {
        parts: [
          { pts: [[48, 20], [146, 20], [146, 34], [48, 34]], kind: 'body' },
          { pts: [[54, 34], [144, 34], [144, 41], [80, 41], [54, 39]], kind: 'body' },
          { pts: [[56, 39], [82, 39], [72, 68], [46, 66]], kind: 'body' },
          { pts: [[82, 41], [106, 41], [106, 50], [82, 50]], kind: 'detail' }
        ],
        iron: [
          [[138, 17], [143, 17], [143, 20], [138, 20]],
          [[54, 17], [60, 17], [60, 20], [54, 20]]
        ],
        factoryStock: null,
        mag: [[50, 66], [71, 68], [70, 73], [48, 71]],
        lines: [[[52, 23], [65, 23]], [[52, 27], [65, 27]], [[114, 37], [140, 37]]],
        anchors: { optic: { x: 64, y: 20, len: 30 }, muzzle: { x: 146, y: 27 }, under: { x: 126, y: 41 }, stock: null }
      },
      mp5k: {
        parts: [
          { pts: [[52, 25], [60, 25], [60, 40], [52, 40]], kind: 'detail' },
          { pts: [[60, 24], [118, 24], [118, 40], [60, 40]], kind: 'body' },
          { pts: [[118, 24], [144, 24], [144, 30], [118, 30]], kind: 'body' },
          { pts: [[118, 30], [142, 30], [142, 41], [136, 41], [136, 48], [131, 48], [131, 41], [118, 41]], kind: 'body' },
          { pts: [[68, 40], [78, 40], [72, 62], [61, 60]], kind: 'body' },
          { pts: [[78, 40], [92, 40], [92, 47], [78, 47]], kind: 'detail' },
          { pts: [[142, 31], [156, 31], [156, 35], [142, 35]], kind: 'body' }
        ],
        iron: [
          [[140, 19], [145, 19], [145, 24], [140, 24]],
          [[64, 19], [72, 19], [72, 24], [64, 24]]
        ],
        factoryStock: null,
        mag: [[96, 40], [106, 40], [117, 65], [105, 67]],
        lines: [[[66, 28], [112, 28]], [[66, 35], [110, 35]]],
        anchors: { optic: { x: 68, y: 24, len: 42 }, muzzle: { x: 156, y: 33 }, under: { x: 125, y: 41 }, stock: { x: 52, y: 32 } }
      },
      ak47: {
        parts: [
          { pts: [[50, 26], [112, 26], [112, 40], [50, 40]], kind: 'body' },
          { pts: [[54, 22], [108, 22], [112, 26], [50, 26]], kind: 'body' },
          { pts: [[66, 40], [76, 40], [72, 60], [62, 60]], kind: 'body' },
          { pts: [[76, 40], [91, 40], [91, 47], [76, 47]], kind: 'detail' },
          { pts: [[112, 30], [146, 30], [146, 40], [112, 40]], kind: 'wood' },
          { pts: [[112, 24], [150, 24], [150, 29], [112, 29]], kind: 'body' },
          { pts: [[146, 32], [182, 32], [182, 36], [146, 36]], kind: 'body' }
        ],
        iron: [
          [[150, 24], [154, 24], [154, 32], [150, 32]],
          [[108, 19], [114, 19], [114, 22], [108, 22]]
        ],
        factoryStock: [[8, 30], [50, 28], [52, 38], [30, 44], [10, 52], [6, 48]],
        mag: [[92, 40], [106, 40], [120, 68], [104, 72]],
        lines: [[[56, 30], [106, 30]], [[56, 35], [104, 35]]],
        anchors: { optic: { x: 62, y: 22, len: 44 }, muzzle: { x: 182, y: 34 }, under: { x: 128, y: 40 }, stock: { x: 50, y: 33 } }
      },
      m870: {
        parts: [
          { pts: [[54, 27], [106, 27], [106, 41], [54, 41]], kind: 'body' },
          { pts: [[106, 27], [184, 27], [184, 32], [106, 32]], kind: 'body' },
          { pts: [[106, 34], [170, 34], [170, 39], [106, 39]], kind: 'body' },
          { pts: [[116, 33], [148, 33], [148, 43], [116, 43]], kind: 'wood' },
          { pts: [[50, 39], [74, 41], [74, 47], [63, 47], [56, 41]], kind: 'detail' }
        ],
        iron: [
          [[179, 24], [183, 24], [183, 27], [179, 27]]
        ],
        factoryStock: [[8, 35], [54, 29], [56, 41], [40, 46], [10, 55], [6, 51]],
        mag: [[148, 34], [176, 34], [176, 40], [148, 40]],
        lines: [[[64, 31], [98, 31]], [[122, 36], [142, 36]]],
        anchors: { optic: { x: 64, y: 27, len: 38 }, muzzle: { x: 184, y: 29.5 }, under: { x: 132, y: 43 }, stock: { x: 54, y: 34 } }
      },
      m24: {
        parts: [
          { pts: [[50, 33], [134, 33], [130, 41], [50, 43]], kind: 'body' },
          { pts: [[54, 25], [104, 25], [104, 33], [54, 33]], kind: 'body' },
          { pts: [[88, 28], [96, 28], [100, 36], [94, 37]], kind: 'detail' },
          { pts: [[104, 26], [186, 26], [186, 31], [104, 31]], kind: 'body' },
          { pts: [[64, 41], [78, 41], [78, 48], [64, 48]], kind: 'detail' }
        ],
        iron: [
          [[179, 23], [183, 23], [183, 26], [179, 26]],
          [[100, 22], [105, 22], [105, 25], [100, 25]]
        ],
        factoryStock: [[8, 33], [54, 30], [54, 43], [44, 44], [36, 52], [10, 54], [7, 49]],
        mag: [[82, 41], [98, 41], [97, 50], [82, 50]],
        lines: [[[60, 29], [96, 29]], [[58, 37], [122, 37]]],
        anchors: { optic: { x: 62, y: 25, len: 42 }, muzzle: { x: 186, y: 28.5 }, under: { x: 120, y: 41 }, stock: { x: 52, y: 35 } }
      },
      mosin9130: {
        parts: [
          { pts: [[52, 31], [162, 31], [160, 38], [52, 41]], kind: 'wood' },
          { pts: [[116, 30], [120, 30], [120, 38], [116, 38]], kind: 'detail' },
          { pts: [[152, 30], [156, 30], [156, 38], [152, 38]], kind: 'detail' },
          { pts: [[54, 26], [96, 26], [96, 32], [54, 32]], kind: 'body' },
          { pts: [[80, 27], [86, 27], [86, 35], [80, 35]], kind: 'detail' },
          { pts: [[96, 26], [190, 26], [190, 30], [96, 30]], kind: 'body' },
          { pts: [[66, 40], [80, 40], [80, 47], [66, 47]], kind: 'detail' }
        ],
        iron: [
          [[182, 22], [186, 22], [186, 26], [182, 26]],
          [[100, 23], [108, 23], [108, 26], [100, 26]]
        ],
        factoryStock: [[6, 35], [54, 30], [54, 41], [40, 44], [8, 52], [5, 48]],
        factoryStockKind: 'wood',
        mag: [[78, 39], [96, 39], [95, 46], [80, 46]],
        lines: [[[60, 35], [148, 34]]],
        anchors: { optic: { x: 60, y: 26, len: 38 }, muzzle: { x: 190, y: 28 }, under: { x: 132, y: 38 }, stock: { x: 54, y: 34 } }
      },
      awm338: {
        parts: [
          { pts: [[50, 31], [136, 31], [134, 42], [50, 42]], kind: 'body' },
          { pts: [[54, 24], [110, 24], [110, 31], [54, 31]], kind: 'body' },
          { pts: [[92, 26], [99, 26], [103, 33], [97, 34]], kind: 'detail' },
          { pts: [[110, 25], [180, 25], [180, 30], [110, 30]], kind: 'body' },
          { pts: [[180, 24], [189, 24], [189, 31], [180, 31]], kind: 'detail' },
          { pts: [[68, 42], [82, 42], [82, 49], [68, 49]], kind: 'detail' }
        ],
        iron: [
          [[104, 22], [108, 22], [108, 24], [104, 24]]
        ],
        factoryStock: [[6, 31], [52, 29], [52, 42], [44, 44], [38, 57], [28, 57], [31, 45], [16, 49], [8, 54], [5, 50]],
        mag: [[84, 42], [103, 42], [104, 58], [85, 58]],
        lines: [[[58, 28], [106, 28]], [[58, 36], [128, 36]]],
        anchors: { optic: { x: 60, y: 24, len: 46 }, muzzle: { x: 189, y: 27.5 }, under: { x: 122, y: 42 }, stock: { x: 52, y: 34 } }
      }
    };
    return this._weapon2DSpecs;
  }

  _rectPoly(x, y, w, h) {
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  }

  _render2DWeaponIcon(itemId, mods = {}, wide = false) {
    const specs = this._get2DWeaponSpecs();
    const spec = specs[itemId] || specs.ak47;
    const W = wide ? 384 : 192;
    const H = 192;
    this.canvas2d.width = W;
    this.canvas2d.height = H;
    const ctx = this.canvas2d.getContext('2d');
    if (!ctx) return '';
    ctx.clearRect(0, 0, W, H);

    // Build draw list: base parts, iron vs optic, stock vs stock mod, mag vs ext_mag, muzzle, underbarrel
    const drawList = [];
    for (const p of spec.parts) {
      drawList.push({ pts: p.pts, style: p.kind });
    }

    // 1. Stock (factory or attachment)
    const stkMod = mods.stock && mods.stock !== 'none' ? mods.stock : null;
    if (stkMod && spec.anchors.stock) {
      const { x: sx, y: sy } = spec.anchors.stock;
      if (stkMod === 'collapsed') {
        drawList.push({ pts: this._rectPoly(sx - 30, sy - 4, 30, 2.5), style: 'highlight' });
        drawList.push({ pts: this._rectPoly(sx - 30, sy + 4, 30, 2.5), style: 'highlight' });
        drawList.push({ pts: this._rectPoly(sx - 33, sy - 7, 4, 17), style: 'highlight' });
      } else if (stkMod === 'tactical') {
        drawList.push({
          pts: [[sx - 38, sy - 5], [sx, sy - 4], [sx, sy + 5], [sx - 20, sy + 7], [sx - 36, sy + 14], [sx - 40, sy + 11]],
          style: 'highlight'
        });
      } else if (stkMod === 'heavy_marksman') {
        drawList.push({
          pts: [[sx - 40, sy - 8], [sx - 12, sy - 8], [sx - 8, sy - 4], [sx, sy - 4], [sx, sy + 8], [sx - 22, sy + 10], [sx - 38, sy + 17], [sx - 42, sy + 13]],
          style: 'highlight'
        });
      }
    } else if (spec.factoryStock) {
      drawList.push({ pts: spec.factoryStock, style: spec.factoryStockKind || 'body' });
    }

    // 2. Magazine (factory or ext_mag scaled 1.35 from top edge in highlight)
    if (spec.mag) {
      const magMod = mods.magazine === 'ext_mag';
      if (magMod) {
        let minY = Infinity;
        for (const pt of spec.mag) if (pt[1] < minY) minY = pt[1];
        const extPts = spec.mag.map(([mx, my]) => [mx, minY + (my - minY) * 1.35]);
        drawList.push({ pts: extPts, style: 'highlight' });
      } else {
        drawList.push({ pts: spec.mag, style: 'body' });
      }
    }

    // 3. Optic (replaces iron sights when equipped)
    const optMod = mods.optic && mods.optic !== 'none' ? mods.optic : null;
    if (optMod && spec.anchors.optic) {
      const { x: ox, y: oy, len } = spec.anchors.optic;
      const mountW = Math.min(len, 22);
      const cx = ox + len * 0.45;
      drawList.push({ pts: this._rectPoly(cx - mountW * 0.45, oy - 3, mountW * 0.9, 3), style: 'highlight' });
      if (optMod === 'red_dot') {
        drawList.push({
          pts: [[cx - 9, oy - 11], [cx + 9, oy - 11], [cx + 7, oy - 3], [cx - 8, oy - 3]],
          style: 'highlight',
          cutout: this._rectPoly(cx - 5, oy - 9.5, 9, 4.5)
        });
      } else if (optMod === 'holo') {
        drawList.push({
          pts: this._rectPoly(cx - 10, oy - 14, 20, 11),
          style: 'highlight',
          cutout: this._rectPoly(cx - 6, oy - 12, 11, 6.5)
        });
      } else if (optMod === 'acog_2x') {
        const tw = Math.max(24, len * 0.72);
        drawList.push({
          pts: [[cx - tw * 0.48, oy - 12], [cx + tw * 0.34, oy - 13], [cx + tw * 0.52, oy - 11], [cx + tw * 0.52, oy - 4], [cx - tw * 0.48, oy - 4]],
          style: 'highlight'
        });
      } else if (optMod === 'lpvo_4x') {
        const tw = Math.max(30, len * 0.95);
        drawList.push({ pts: this._rectPoly(cx - tw * 0.48, oy - 12, 9, 8.5), style: 'highlight' });
        drawList.push({ pts: this._rectPoly(cx - tw * 0.48 + 9, oy - 10.5, tw - 20, 5.5), style: 'highlight' });
        drawList.push({ pts: this._rectPoly(cx + tw * 0.52 - 11, oy - 12.5, 11, 9.5), style: 'highlight' });
      } else if (optMod === 'sniper_8x') {
        const tw = Math.max(38, len * 1.24);
        const sx0 = cx - tw * 0.46;
        drawList.push({ pts: this._rectPoly(sx0, oy - 12.5, 10, 9), style: 'highlight' });
        drawList.push({ pts: this._rectPoly(sx0 + 10, oy - 10.5, tw - 25, 5.5), style: 'highlight' });
        drawList.push({ pts: this._rectPoly(sx0 + tw - 15, oy - 14, 15, 12), style: 'highlight' });
        drawList.push({ pts: this._rectPoly(sx0 + tw * 0.45, oy - 13.5, 6, 3), style: 'highlight' });
      }
    } else if (spec.iron) {
      for (const ip of spec.iron) {
        drawList.push({ pts: ip, style: 'detail' });
      }
    }

    // 4. Muzzle (compensator or suppressor)
    const muzMod = mods.muzzle && mods.muzzle !== 'none' ? mods.muzzle : null;
    if (muzMod && spec.anchors.muzzle) {
      const { x: mx, y: my } = spec.anchors.muzzle;
      if (muzMod === 'compensator') {
        drawList.push({
          pts: this._rectPoly(mx, my - 3.5, 12, 7),
          style: 'highlight',
          notches: [[mx + 3.5, my - 3.5, 2.2, 2.5], [mx + 7.5, my - 3.5, 2.2, 2.5]]
        });
      } else if (muzMod === 'suppressor') {
        drawList.push({
          pts: this._rectPoly(mx, my - 4, 34, 8),
          style: 'highlight',
          rounded: true
        });
      }
    }

    // 5. Underbarrel (vert_grip or laser)
    const undMod = mods.underbarrel && mods.underbarrel !== 'none' ? mods.underbarrel : null;
    if (undMod && spec.anchors.under) {
      const { x: ux, y: uy } = spec.anchors.under;
      if (undMod === 'vert_grip') {
        drawList.push({
          pts: this._rectPoly(ux - 3.5, uy, 7, 18),
          style: 'highlight',
          rounded: true
        });
      } else if (undMod === 'laser') {
        drawList.push({
          pts: this._rectPoly(ux - 8, uy, 16, 7),
          style: 'highlight',
          laserBeam: [ux + 8, uy + 3.5, ux + 18, uy + 3.5]
        });
      }
    }

    // Compute exact bounding box over every polygon (and laser beam endpoint)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const item of drawList) {
      for (const [x, y] of item.pts) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      if (item.laserBeam) {
        maxX = Math.max(maxX, item.laserBeam[2]);
      }
    }
    const bw = Math.max(10, maxX - minX);
    const bh = Math.max(10, maxY - minY);
    const scale = Math.min((W * 0.84) / bw, (H * 0.84) / bh);
    const ox = (W - bw * scale) * 0.5 - minX * scale;
    const oy = (H - bh * scale) * 0.5 - minY * scale;

    const tx = (x) => ox + x * scale;
    const ty = (y) => oy + y * scale;

    const fillPath = (pts, rounded = false) => {
      ctx.beginPath();
      if (rounded && pts.length === 4) {
        const x0 = tx(pts[0][0]);
        const y0 = ty(pts[0][1]);
        const rw = (pts[1][0] - pts[0][0]) * scale;
        const rh = (pts[2][1] - pts[0][1]) * scale;
        const r = Math.min(rw, rh) * 0.35;
        ctx.moveTo(x0 + r, y0);
        ctx.lineTo(x0 + rw - r, y0);
        ctx.quadraticCurveTo(x0 + rw, y0, x0 + rw, y0 + r);
        ctx.lineTo(x0 + rw, y0 + rh - r);
        ctx.quadraticCurveTo(x0 + rw, y0 + rh, x0 + rw - r, y0 + rh);
        ctx.lineTo(x0 + r, y0 + rh);
        ctx.quadraticCurveTo(x0, y0 + rh, x0, y0 + rh - r);
        ctx.lineTo(x0, y0 + r);
        ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
        ctx.closePath();
      } else {
        ctx.moveTo(tx(pts[0][0]), ty(pts[0][1]));
        for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i][0]), ty(pts[i][1]));
        ctx.closePath();
      }
    };

    const gMinY = ty(minY);
    const gMaxY = ty(maxY);
    const bodyGrad = ctx.createLinearGradient(0, gMinY, 0, gMaxY);
    bodyGrad.addColorStop(0, '#e3e7ea');
    bodyGrad.addColorStop(1, '#9ba4ac');

    const woodGrad = ctx.createLinearGradient(0, gMinY, 0, gMaxY);
    woodGrad.addColorStop(0, '#cdb79a');
    woodGrad.addColorStop(1, '#8f7a60');

    const detailGrad = ctx.createLinearGradient(0, gMinY, 0, gMaxY);
    detailGrad.addColorStop(0, '#b5bec6');
    detailGrad.addColorStop(1, '#7a848d');

    const hlGrad = ctx.createLinearGradient(0, gMinY, 0, gMaxY);
    hlGrad.addColorStop(0, '#ffd27a');
    hlGrad.addColorStop(1, '#f5a623');

    // First draw base parts, then highlighted attachments on top for crisp readability
    const ordered = [
      ...drawList.filter(it => it.style !== 'highlight'),
      ...drawList.filter(it => it.style === 'highlight')
    ];

    for (const item of ordered) {
      const isHL = item.style === 'highlight';
      ctx.save();
      if (isHL) {
        ctx.shadowColor = 'rgba(255, 181, 71, 0.75)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = hlGrad;
        ctx.strokeStyle = '#5a3a00';
      } else {
        ctx.fillStyle = item.style === 'wood' ? woodGrad : (item.style === 'detail' ? detailGrad : bodyGrad);
        ctx.strokeStyle = '#15191d';
      }
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      fillPath(item.pts, !!item.rounded);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.stroke();

      // Optic window cutout
      if (item.cutout) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        fillPath(item.cutout);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = '#5a3a00';
        ctx.lineWidth = 1.1;
        fillPath(item.cutout);
        ctx.stroke();
      }

      // Compensator port notches
      if (item.notches) {
        ctx.fillStyle = '#5a3a00';
        for (const [nx, ny, nw, nh] of item.notches) {
          ctx.fillRect(tx(nx), ty(ny), nw * scale, nh * scale);
        }
      }

      // Red tactical laser beam stub
      if (item.laserBeam) {
        const [lx1, ly1, lx2, ly2] = item.laserBeam;
        ctx.strokeStyle = '#ff4040';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(tx(lx1), ty(ly1));
        ctx.lineTo(tx(lx2), ty(ly2));
        ctx.stroke();
      }
      ctx.restore();
    }

    // Crisp darker receiver detail lines
    if (spec.lines && spec.lines.length) {
      ctx.save();
      ctx.strokeStyle = 'rgba(21, 25, 29, 0.42)';
      ctx.lineWidth = 1.25;
      for (const [[x1, y1], [x2, y2]] of spec.lines) {
        ctx.beginPath();
        ctx.moveTo(tx(x1), ty(y1));
        ctx.lineTo(tx(x2), ty(y2));
        ctx.stroke();
      }
      ctx.restore();
    }

    return this.canvas2d.toDataURL('image/png');
  }

  _buildItemMesh(id, mods = {}) {
    const def = (window.GAME_DATA && GAME_DATA.ITEMS && GAME_DATA.ITEMS[id]) || null;
    const g = new THREE.Group();

    // 1. REAL 3D WEAPONS (crisp horizontal side-profile studio render matching reference!)
    if (def && def.type === 'weapon') {
      const wb = this._ensureWeaponBuilder();
      if (wb && wb.buildThirdPersonWeapon) {
        try {
          const built = wb.buildThirdPersonWeapon(def, mods);
          if (built && built.group) {
            built.group.rotation.set(0.04, Math.PI / 2, 0.0);
            g.add(built.group);
            return g;
          }
        } catch (e) {
          console.warn('[ItemIconRenderer] 3D weapon icon build failed, using 2D fallback:', id, e);
        }
      }
      return null;
    }

    // 1B. LOADED CC0 POLY HAVEN 3D MODELS
    const modelSpec = ITEM_MODEL_MAP[id];
    if (modelSpec && this._itemModels[modelSpec.model]) {
      const src = this._itemModels[modelSpec.model];
      const clone = (typeof THREE.SkeletonUtils !== 'undefined' && THREE.SkeletonUtils.clone)
        ? THREE.SkeletonUtils.clone(src)
        : src.clone(true);
      if (modelSpec.tint !== undefined && modelSpec.tint !== 0xffffff) {
        const tintCol = new THREE.Color(modelSpec.tint);
        clone.traverse((child) => {
          if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
              child.material = child.material.map((m) => {
                const cm = m.clone();
                if (cm.color) cm.color.multiply(tintCol);
                return cm;
              });
            } else {
              const cm = child.material.clone();
              if (cm.color) cm.color.multiply(tintCol);
              child.material = cm;
            }
          }
        });
      }
      clone.rotation.set(0.35, -0.6, 0);
      g.add(clone);
      return g;
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

    // 3. ARMOR VESTS (Sculpted front-facing tactical Plate Carrier matching reference screenshot!)
    if (def && def.type === 'armor') {
      const colMap = {
        vest_1plate: 0xdcc8a2,        // tactical desert tan
        vest_2plate: 0x9fa89a,        // ranger olive-grey (reference carrier color)
        vest_2plate_gel: 0x5d7c98,    // tactical slate-blue
        vest_2plate_helmet: 0x6c657c, // heavy tactical charcoal-violet
        vest_3plate: 0x873b3b         // heavy crimson plate carrier
      };
      const baseCol = colMap[id] || 0x9fa89a;
      const darkCol = new THREE.Color(baseCol).multiplyScalar(0.64).getHex();
      const slitCol = 0x262928;
      const strapCol = 0x525750;
      const baseMat = this._mat(baseCol, 0x000000, 18, 0x353b38);
      const shadeMat = this._mat(darkCol, 0x000000, 16, 0x282d2b);
      const slitMat = this._mat(slitCol, 0x000000, 12, 0x202424);
      const strapMat = this._mat(strapCol, 0x000000, 20, 0x363a38);
      const trimMat = this._mat(id === 'vest_3plate' ? 0xd94b4b : (id === 'vest_2plate_gel' ? 0x5fb8f0 : darkCol), 0x000000, 22);

      // Chamfered front SAPI plate bag
      const frontShape = new THREE.Shape();
      frontShape.moveTo(-0.20, -0.22);
      frontShape.lineTo(0.20, -0.22);
      frontShape.lineTo(0.21, -0.02);
      frontShape.lineTo(0.145, 0.21);
      frontShape.lineTo(0.06, 0.23);
      frontShape.lineTo(-0.06, 0.23);
      frontShape.lineTo(-0.145, 0.21);
      frontShape.lineTo(-0.21, -0.02);
      frontShape.closePath();
      const frontBag = new THREE.Mesh(
        new THREE.ExtrudeGeometry(frontShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }),
        baseMat
      );
      frontBag.position.set(0, -0.02, 0.015);

      // Inner dark back panel & neck collar recess visible above front chest cut
      const backShape = new THREE.Shape();
      backShape.moveTo(-0.23, -0.23);
      backShape.lineTo(0.23, -0.23);
      backShape.lineTo(0.24, 0.02);
      backShape.lineTo(0.175, 0.30);
      backShape.lineTo(0.10, 0.33);
      backShape.lineTo(-0.10, 0.33);
      backShape.lineTo(-0.175, 0.30);
      backShape.lineTo(-0.24, 0.02);
      backShape.closePath();
      const backBag = new THREE.Mesh(
        new THREE.ExtrudeGeometry(backShape, { depth: 0.06, bevelEnabled: false }),
        shadeMat
      );
      backBag.position.set(0, -0.02, -0.055);

      // Wide padded shoulder straps rising from front collar up & back over traps
      [-1, 1].forEach((sgn) => {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.16, 0.13), strapMat);
        strap.position.set(sgn * 0.145, 0.27, 0.01);
        strap.rotation.z = -sgn * 0.14;
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.10, 0.145), shadeMat);
        pad.position.set(sgn * 0.15, 0.30, 0.005);
        pad.rotation.z = -sgn * 0.14;
        g.add(strap, pad);

        // Skeletonized side cummerbund wing + 3 horizontal MOLLE webbing ribs per side
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.22, 0.12), shadeMat);
        wing.position.set(sgn * 0.245, -0.11, 0.0);
        g.add(wing);
        for (let r = 0; r < 3; r++) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.022, 0.132), slitMat);
          rib.position.set(sgn * 0.248, -0.175 + r * 0.062, 0.005);
          g.add(rib);
        }
      });

      // Upper chest admin Velcro panel + 2 laser-cut MOLLE slits
      const admin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.095, 0.025), baseMat);
      admin.position.set(0, 0.12, 0.10);
      for (let s = 0; s < 2; s++) {
        const slit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.016, 0.028), slitMat);
        slit.position.set(0, 0.10 + s * 0.042, 0.103);
        g.add(slit);
      }

      // Lower front kangaroo placard pouch + 3 horizontal PALS webbing rows + divider seams
      const placard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.20, 0.045), baseMat);
      placard.position.set(0, -0.09, 0.105);
      for (let m = 0; m < 3; m++) {
        const web = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.022, 0.048), slitMat);
        web.position.set(0, -0.155 + m * 0.058, 0.108);
        g.add(web);
      }
      [-0.055, 0.055].forEach((vx) => {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.18, 0.049), shadeMat);
        seam.position.set(vx, -0.095, 0.107);
        g.add(seam);
      });

      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.02), trimMat);
      crest.position.set(0, 0.03, 0.108);

      g.add(frontBag, backBag, admin, placard, crest);
      if (id === 'vest_2plate_helmet') {
        const helm = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), this._mat(0x32363c, 0x000000, 40));
        helm.position.set(0, 0.44, 0);
        g.add(helm);
      }
      g.rotation.set(0.04, -0.05, 0);
      return g;
    }

    // 4. ARMOR PLATE (Unified sculpted SAPI ceramic plate matching first-person plating rig!)
    if (id === 'armor_plate') {
      if (typeof window.buildArmorPlateMesh === 'function') {
        const bp = window.buildArmorPlateMesh({ forIcon: true });
        bp.rotation.set(0.06, -0.08, 0.0);
        return bp;
      }
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

    // 5. BACKPACKS (Unified sculpted tactical backpack matching operator rig & UI icons!)
    if (def && def.type === 'backpack') {
      if (typeof window.buildTacticalBackpackMesh === 'function') {
        const bp = window.buildTacticalBackpackMesh(id, { forIcon: true });
        bp.rotation.set(0.06, -0.14, 0);
        return bp;
      }
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
      const isRifle = id === 'ammo_739' || id === 'ammo_762';
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

    // 13. VOSTOK MEDICAL, OFFICE, MILITARY, HOUSEHOLD & VALUABLES STUDIO ICONS
    if (id === 'sterile_bandage') {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.10), this._mat(0xdfe8e4, 0x000000, 35));
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.08, 0.11), this._mat(0x2e8b57));
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.03, 0.115), this._mat(0xffffff));
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.10, 0.115), this._mat(0xffffff));
      g.add(pack, band, c1, c2);
      g.rotation.set(0.22, -0.32, 0.08);
      return g;
    }
    if (id === 'sterile_cloth' || id === 'nylon_cloth_roll') {
      const col = id === 'nylon_cloth_roll' ? 0x3b4d5e : 0xe8eff0;
      const coreCol = id === 'nylon_cloth_roll' ? 0x222a30 : 0xaab8be;
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.48, 14), this._mat(col, 0x000000, 30));
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.50, 12), this._mat(coreCol));
      roll.rotation.z = Math.PI / 2;
      core.rotation.z = Math.PI / 2;
      g.add(roll, core);
      g.rotation.set(0.30, -0.42, 0.20);
      return g;
    }
    if (id === 'scrubs' || id === 'clothes') {
      const col = id === 'scrubs' ? 0x3ca09a : 0x5d6458;
      const col2 = id === 'scrubs' ? 0x2c7d78 : 0x42483e;
      const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.34), this._mat(col, 0x000000, 18));
      const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.28), this._mat(col2, 0x000000, 18));
      f2.position.set(0, 0.09, -0.02);
      g.add(f1, f2);
      g.rotation.set(0.36, -0.38, 0.06);
      return g;
    }
    if (id === 'basic_chemicals' || id === 'cleaning_supplies' || id === 'reactive_compounds') {
      const bodyCol = id === 'reactive_compounds' ? 0x2de084 : (id === 'cleaning_supplies' ? 0x3a89c9 : 0xc88a32);
      const emCol = id === 'reactive_compounds' ? 0x0d5c32 : 0x000000;
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.38, 14), this._mat(bodyCol, emCol, 70));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.10, 12), this._mat(0xdce4e8));
      neck.position.y = 0.22;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.06, 12), this._mat(id === 'cleaning_supplies' ? 0xe53935 : 0x22282c));
      cap.position.y = 0.28;
      const lbl = new THREE.Mesh(new THREE.CylinderGeometry(0.146, 0.154, 0.14, 14), this._mat(0xf2f4f0, 0x000000, 15));
      g.add(bottle, neck, cap, lbl);
      g.rotation.set(0.18, -0.35, 0.08);
      return g;
    }
    if (id === 'syringe') {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 12), this._mat(0xd8eef8, 0x102430, 85));
      const fluid = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.20, 10), this._mat(0xff5252, 0x4a0e0e, 60));
      fluid.position.y = -0.04;
      const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.20, 8), this._mat(0xb0bec5));
      plunger.position.y = 0.22;
      const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 10), this._mat(0xe53935));
      thumb.position.y = 0.32;
      const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.004, 0.16, 8), this._mat(0xe0e6ea, 0x000000, 95));
      needle.position.y = -0.24;
      g.add(barrel, fluid, plunger, thumb, needle);
      g.rotation.set(0.15, 0.15, -0.68);
      return g;
    }
    if (
      id === 'payroll_documents' || id === 'vacation_planner' || id === 'financial_ledger' ||
      id === 'documents' || id === 'classified_documents' || id === 'back_room_inventory_list' ||
      id === 'hourly_schedule' || id === 'classified_dossier'
    ) {
      const isClassified = id === 'classified_documents' || id === 'classified_dossier';
      const isLedger = id === 'financial_ledger';
      const baseCol = id === 'classified_dossier' ? 0x5c201e : (isClassified ? 0xc8a46e : (isLedger ? 0x264653 : 0xd8c89e));
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, isLedger ? 0.08 : 0.035), this._mat(baseCol, 0x000000, 22));
      const page = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.02), this._mat(0xf5f5ef));
      page.position.set(0.02, 0.01, 0.022);
      const stampCol = isClassified ? 0xd32f2f : (id === 'vacation_planner' ? 0x29b6f6 : 0x455a64);
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.025), this._mat(stampCol));
      band.position.set(0.02, 0.10, 0.03);
      g.add(sheet, page, band);
      g.rotation.set(-0.26, -0.28, 0.14);
      return g;
    }
    if (id === 'kids_drawing' || id === 'family_photo' || id === 'picture_of_man' || id === 'nature_photo') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.44, 0.025), this._mat(0xf6f6f2, 0x000000, 25));
      const artCol = id === 'kids_drawing' ? 0xffca28 : (id === 'nature_photo' ? 0x43a047 : (id === 'family_photo' ? 0x5c85d6 : 0x78909c));
      const art = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.30, 0.028), this._mat(artCol));
      art.position.set(0, 0.04, 0.004);
      g.add(frame, art);
      g.rotation.set(-0.18, -0.24, 0.10);
      return g;
    }
    if (id === 'kevlar_padding' || id === 'carbon_fibre_sample') {
      const col = id === 'carbon_fibre_sample' ? 0x1e2226 : 0xc5a86a;
      const spec = id === 'carbon_fibre_sample' ? 0x90a4ae : 0x55482c;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.42, 0.07), this._mat(col, 0x000000, 75, spec));
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.06, 0.075), this._mat(0x37474f));
      g.add(pad, rib);
      g.rotation.set(0.24, -0.36, 0.10);
      return g;
    }
    if (id === 'brass_casings' || id === 'heavy_casings' || id === 'casings_12g') {
      const hullCol = id === 'casings_12g' ? 0xc62828 : (id === 'heavy_casings' ? 0xc99e38 : 0xdcb44a);
      const h = id === 'heavy_casings' ? 0.34 : 0.26;
      const r = id === 'casings_12g' ? 0.055 : 0.042;
      for (let i = -1; i <= 1; i++) {
        const cMesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, h, 12), this._mat(hullCol, 0x000000, 88, 0xfff0b8));
        cMesh.position.set(i * 0.12, (i === 0 ? 0.03 : -0.02), (i === 0 ? 0.04 : -0.03));
        g.add(cMesh);
        if (id === 'casings_12g') {
          const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.07, 12), this._mat(0xdcb44a, 0x000000, 90));
          base.position.set(cMesh.position.x, cMesh.position.y - h * 0.5 + 0.035, cMesh.position.z);
          g.add(base);
        }
      }
      g.rotation.set(0.24, -0.32, 0.06);
      return g;
    }
    if (id === 'heavy_gunpowder') {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.42, 14), this._mat(0x26292c, 0x000000, 55));
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.174, 0.174, 0.12, 14), this._mat(0xe53935));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), this._mat(0xd4a428));
      cap.position.y = 0.23;
      g.add(can, stripe, cap);
      g.rotation.set(0.22, -0.35, 0);
      return g;
    }
    if (id === 'metallic_alloy' || id === 'reactive_metals' || id === 'pure_silver' || id === 'gold_bar') {
      const colMap = {
        metallic_alloy: [0x8ea0ab, 0x000000, 0xd8ecff],
        reactive_metals: [0x7e57c2, 0x28124d, 0xd1c4e9],
        pure_silver: [0xe2e9ee, 0x11161a, 0xffffff],
        gold_bar: [0xf2bc32, 0x3a2600, 0xfff4b8]
      };
      const [cMain, cEm, cSpec] = colMap[id];
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.13, 0.22), this._mat(cMain, cEm, 95, cSpec));
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.16), this._mat(cMain, cEm, 98, cSpec));
      top.position.y = 0.08;
      g.add(bar, top);
      g.rotation.set(0.36, -0.45, 0.10);
      return g;
    }
    if (id === 'tools') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.22), this._mat(0xc62828, 0x000000, 50));
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.05, 0.04), this._mat(0x212529));
      handle.position.y = 0.135;
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.23), this._mat(0xcfd8dc));
      latch.position.y = 0.03;
      g.add(box, handle, latch);
      g.rotation.set(0.26, -0.38, 0);
      return g;
    }
    if (id === 'decorative_bowl') {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.11, 0.18, 16), this._mat(0x1e5aa8, 0x061630, 85));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 8, 20), this._mat(0xf2bc32, 0x2b1c00, 95));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.09;
      g.add(bowl, rim);
      g.rotation.set(0.34, -0.30, 0);
      return g;
    }
    if (id === 'antique_watch') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 20), this._mat(0xd4a437, 0x261800, 92, 0xfff0b0));
      body.rotation.x = Math.PI / 2;
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.065, 20), this._mat(0xfaf6e8));
      dial.rotation.x = Math.PI / 2;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 10), this._mat(0xd4a437));
      crown.position.y = 0.22;
      g.add(body, dial, crown);
      g.rotation.set(-0.18, -0.28, 0.12);
      return g;
    }
    if (id === 'ancient_coin') {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.04, 20), this._mat(0xe6b432, 0x241800, 92, 0xfff2b2));
      coin.rotation.x = Math.PI / 2;
      const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.048), this._mat(0xc9941e, 0x000000, 80));
      emblem.rotation.z = Math.PI / 4;
      g.add(coin, emblem);
      g.rotation.set(-0.20, -0.30, 0.10);
      return g;
    }
    if (id === 'golden_skull') {
      const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 14), this._mat(0xf5c236, 0x3b2600, 98, 0xfff8c8));
      cranium.position.y = 0.05;
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), this._mat(0xe0ab24, 0x2c1b00, 92));
      jaw.position.set(0, -0.10, 0.05);
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), this._mat(0x18120a));
      eyeL.position.set(-0.065, 0.03, 0.155);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.065;
      g.add(cranium, jaw, eyeL, eyeR);
      g.rotation.set(0.14, -0.34, 0);
      return g;
    }
    if (id === 'heart_of_vostok') {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 1), this._mat(0xff1744, 0x6a0018, 100, 0xffd0da));
      gem.scale.set(1.0, 1.22, 0.85);
      g.add(gem);
      g.rotation.set(0.25, -0.42, 0.16);
      return g;
    }
    if (id === 'exp_radio_transmitter') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.16), this._mat(0x3c4a3e, 0x000000, 50));
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.17), this._mat(0x69f0ae, 0x165c38, 80));
      screen.position.set(-0.05, 0.05, 0);
      const ant1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.30, 8), this._mat(0x222628));
      ant1.position.set(0.12, 0.26, 0);
      const ant2 = ant1.clone();
      ant2.position.set(-0.13, 0.22, 0);
      ant2.scale.y = 0.75;
      g.add(body, screen, ant1, ant2);
      g.rotation.set(0.18, -0.32, 0);
      return g;
    }
    if (id === 'r4d_detector') {
      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.08), this._mat(0x283238, 0x000000, 62));
      const uvWin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.09), this._mat(0xb388ff, 0x4527a0, 90, 0xe0c8ff));
      uvWin.position.y = 0.06;
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 14), this._mat(0x7c4dff, 0x311b92, 95));
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, -0.09, 0.04);
      g.add(shell, uvWin, lens);
      g.rotation.set(0.18, -0.35, 0.06);
      return g;
    }
    if (id === 'zavod_weapons_case') {
      const caseBody = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.24, 0.32), this._mat(0x26292b, 0x000000, 48));
      const lidTrim = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 0.34), this._mat(0xffca28, 0x3a2a00, 70));
      lidTrim.position.y = 0.05;
      const latchL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.35), this._mat(0xd9822b));
      latchL.position.x = -0.17;
      const latchR = latchL.clone();
      latchR.position.x = 0.17;
      g.add(caseBody, lidTrim, latchL, latchR);
      g.rotation.set(0.32, -0.45, 0.08);
      return g;
    }
    if (id === 'server_tape_red' || id === 'server_tape_black') {
      const col = id === 'server_tape_red' ? 0xb71c1c : 0x202428;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.08), this._mat(col, 0x000000, 52));
      const reelL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.09, 12), this._mat(0xdce2e6));
      reelL.rotation.x = Math.PI / 2;
      reelL.position.x = -0.07;
      const reelR = reelL.clone();
      reelR.position.x = 0.07;
      g.add(body, reelL, reelR);
      g.rotation.set(0.22, -0.34, 0.08);
      return g;
    }
    if (id === 'aseptic_blocker') {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.32, 14), this._mat(0xe0e8e4, 0x000000, 55));
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.11, 14), this._mat(0x2e7d32, 0x09240b, 40));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 12), this._mat(0xffa726));
      cap.position.y = 0.19;
      g.add(bottle, band, cap);
      g.rotation.set(0.24, -0.32, 0.05);
      return g;
    }

    // Fallback tactical crate cube
    const fallback = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), this._mat(0x69f0ae));
    fallback.rotation.set(0.35, -0.45, 0);
    g.add(fallback);
    return g;
  }

  loadItemModels() {
    if (this._itemModelsPromise) return this._itemModelsPromise;
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader !== 'function') {
      this._itemModelsPromise = Promise.resolve(this._itemModels);
      return this._itemModelsPromise;
    }

    const byModel = {};
    Object.keys(ITEM_MODEL_MAP).forEach((itemId) => {
      const mName = ITEM_MODEL_MAP[itemId].model;
      if (!byModel[mName]) byModel[mName] = [];
      byModel[mName].push(itemId);
    });

    const loader = new THREE.GLTFLoader();
    const convertMat = (orig) => {
      if (!orig) return new THREE.MeshLambertMaterial({ color: 0xffffff });
      if (orig.map) {
        orig.map.encoding = THREE.LinearEncoding;
        orig.map.needsUpdate = true;
      }
      const col = orig.color ? orig.color.clone() : new THREE.Color(0xffffff);
      const lambert = new THREE.MeshLambertMaterial({
        map: orig.map || null,
        color: col
      });
      if (orig.transparent) {
        lambert.transparent = true;
        lambert.opacity = orig.opacity;
      }
      if (orig.side !== undefined) lambert.side = orig.side;
      if (typeof orig.dispose === 'function') {
        try { orig.dispose(); } catch (e) {}
      }
      return lambert;
    };

    const promises = Object.keys(byModel).map((modelName) => new Promise((resolve) => {
      const itemIds = byModel[modelName];
      const url = `assets/models/items/${modelName}/${modelName}_1k.gltf`;
      try {
        loader.load(
          url,
          (gltf) => {
            try {
              if (gltf && gltf.scene) {
                gltf.scene.traverse((obj) => {
                  if (!obj.isMesh || !obj.material) return;
                  if (Array.isArray(obj.material)) {
                    obj.material = obj.material.map(convertMat);
                  } else {
                    obj.material = convertMat(obj.material);
                  }
                });
                this._itemModels[modelName] = gltf.scene;
                this.invalidate(itemIds);
              }
            } catch (e) {
              console.warn('[ItemIconRenderer] Failed processing GLTF model', modelName, e);
            }
            resolve();
          },
          undefined,
          (err) => {
            console.warn('[ItemIconRenderer] Failed loading GLTF model', url, err);
            resolve();
          }
        );
      } catch (e) {
        console.warn('[ItemIconRenderer] GLTFLoader threw for', url, e);
        resolve();
      }
    }));

    this._itemModelsPromise = Promise.all(promises).then(() => this._itemModels);
    return this._itemModelsPromise;
  }

  invalidate(ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    const keys = Object.keys(this.cache);
    ids.forEach((id) => {
      const prefix = `${id}|`;
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (k === id || k.startsWith(prefix)) {
          delete this.cache[k];
        }
      }
      if (typeof document !== 'undefined') {
        document.querySelectorAll(`img[data-icon-id="${id}"]`).forEach((img) => {
          const url = this.getIcon(id, { wide: img.dataset.iconWide === '1' });
          if (url) img.src = url;
        });
      }
    });
  }

  getOperatorPortrait() {
    if (this._portraitCache) return this._portraitCache;
    if (!this.renderer || !window.RigAssets || !window.RigAssets.ready || !window.RigAssets.soldier) {
      return null;
    }

    let cloned = null;
    let mixer = null;
    let idleAction = null;
    let idleClip = null;
    try {
      cloned = window.RigAssets.cloneSoldier();
      if (!cloned || !cloned.bones || !cloned.bones.hips) return null;

      const anims = window.RigAssets.soldier.animations || [];
      idleClip = anims.find((c) => /idle/i.test(c.name || '')) || anims[0] || null;
      if (idleClip) {
        mixer = new THREE.AnimationMixer(cloned.model);
        idleAction = mixer.clipAction(idleClip);
        idleAction.play();
        mixer.update(0.4);
      }

      const B = cloned.bones;
      cloned.wrapper.updateMatrixWorld(true);
      const vTmp = new THREE.Vector3();
      const headY0 = B.headtopend ? B.headtopend.getWorldPosition(vTmp).y : 1.75;
      const lToeY0 = B.lefttoeend ? B.lefttoeend.getWorldPosition(vTmp).y : 0;
      const rToeY0 = B.righttoeend ? B.righttoeend.getWorldPosition(vTmp).y : 0;
      const lowToe0 = Math.min(lToeY0, rToeY0);
      const sFactor = 1.78 / Math.max(0.25, headY0 - lowToe0);
      cloned.wrapper.scale.setScalar(sFactor);
      cloned.wrapper.updateMatrixWorld(true);

      const lToe1 = B.lefttoeend ? B.lefttoeend.getWorldPosition(vTmp).y : 0;
      const rToe1 = B.righttoeend ? B.righttoeend.getWorldPosition(vTmp).y : 0;
      cloned.wrapper.position.y -= Math.min(lToe1, rToe1);

      const lfP = B.leftfoot ? B.leftfoot.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(-0.1, 0, 0);
      const ltbP = B.lefttoebase ? B.lefttoebase.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(-0.1, 0, 0.1);
      const rfP = B.rightfoot ? B.rightfoot.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0.1, 0, 0);
      const rtbP = B.righttoebase ? B.righttoebase.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0.1, 0, 0.1);
      const fwdXZ = new THREE.Vector3((ltbP.x - lfP.x) + (rtbP.x - rfP.x), 0, (ltbP.z - lfP.z) + (rtbP.z - rfP.z));
      if (fwdXZ.lengthSq() > 1e-6) {
        fwdXZ.normalize();
        cloned.wrapper.rotation.y = -Math.atan2(fwdXZ.x, fwdXZ.z) + 0.35;
      } else {
        cloned.wrapper.rotation.y = 0.35;
      }
      cloned.wrapper.updateMatrixWorld(true);

      const headY = B.headtopend ? B.headtopend.getWorldPosition(new THREE.Vector3()).y : 1.78;
      const hipsY = B.hips.getWorldPosition(new THREE.Vector3()).y;
      const midY = (hipsY + headY) * 0.52;
      const spanY = Math.max(0.55, headY - hipsY + 0.18);

      const pScene = new THREE.Scene();
      pScene.add(new THREE.HemisphereLight(0xf0f4f8, 0x1e2226, 0.95));
      const pKey = new THREE.DirectionalLight(0xffffff, 1.35);
      pKey.position.set(1.8, 2.8, 3.2);
      const pRim = new THREE.DirectionalLight(0x9ec8f0, 0.85);
      pRim.position.set(-2.6, 2.0, -2.0);
      pScene.add(pKey, pRim, cloned.wrapper);

      const pCam = new THREE.PerspectiveCamera(28, 240 / 300, 0.05, 20);
      const fovRad = (28 * Math.PI) / 180;
      const dist = ((spanY * 0.5) / Math.tan(fovRad * 0.5)) * 1.12;
      pCam.position.set(0, midY + 0.03, Math.max(0.8, dist));
      pCam.lookAt(0, midY, 0);

      this.renderer.setSize(240, 300, false);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.render(pScene, pCam);
      const dataUrl = this.canvas.toDataURL('image/png');
      this._portraitCache = dataUrl;
      return dataUrl;
    } catch (e) {
      console.warn('[ItemIconRenderer] getOperatorPortrait failed:', e);
      return null;
    } finally {
      if (idleAction) { try { idleAction.stop(); } catch (e) {} }
      if (mixer) {
        try {
          if (idleClip) mixer.uncacheClip(idleClip);
          if (cloned && cloned.model) mixer.uncacheRoot(cloned.model);
        } catch (e) {}
      }
      if (cloned && cloned.wrapper) {
        cloned.wrapper.traverse((obj) => {
          if (obj.isMesh && obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => { if (m && typeof m.dispose === 'function') m.dispose(); });
          }
        });
      }
    }
  }
}

window.itemIcons = new ItemIconRenderer();
