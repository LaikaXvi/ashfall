// Interactive 3D Gunsmith Workbench (Modern Warfare 2019+ Style)
class GunsmithController {
  constructor(ui) {
    this.ui = ui;
    this.canvas = document.getElementById('gunsmith-canvas');
    this.activeWeaponId = 'mp5k';
    this.mode = 'attachments'; // 'attachments' | 'customize'
    this.activeSlot = null;
    this.activeCosmeticSlot = 'camo';
    this.previewMode = false;
    this.isOpen = false;

    this.rotY = 1.25;
    this.rotX = 0.08;
    this.zoom = 1.12;
    this.dragging = false;
    this.lastMouse = { x: 0, y: 0 };

    this.nodeAnchors = []; // { slot, el, localPos }

    this._initScene();
    this._bindEvents();
  }

  _initScene() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0e0d);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 20);
    this.camera.position.set(0.08, 0.02, this.zoom);

    const hemi = new THREE.HemisphereLight(0xd8e0e8, 0x22201c, 0.85);
    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.15);
    keyLight.position.set(1.5, 2.0, 2.0);
    const rimLight = new THREE.DirectionalLight(0xd9822b, 0.75);
    rimLight.position.set(-2.0, 0.6, -1.5);
    const fillLight = new THREE.DirectionalLight(0x7ca6d8, 0.45);
    fillLight.position.set(-1.5, -1.0, 1.5);
    this.scene.add(hemi, keyLight, rimLight, fillLight);

    const grid = new THREE.GridHelper(2.4, 16, 0x3a423c, 0x1d221e);
    grid.position.y = -0.32;
    this.scene.add(grid);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    const dummyCam = new THREE.Object3D();
    this.weaponBuilder = new WeaponSystem(this.scene, dummyCam);
    this.pivot.add(this.weaponBuilder.viewmodelGroup);
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.isOpen) return;
      this.dragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isOpen || !this.dragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.rotY += dx * 0.01;
      this.rotX = THREE.MathUtils.clamp(this.rotX + dy * 0.008, -0.7, 0.85);
    });

    this.canvas.addEventListener('wheel', (e) => {
      if (!this.isOpen) return;
      e.preventDefault();
      this.zoom = THREE.MathUtils.clamp(this.zoom + e.deltaY * 0.0007, 0.52, 1.75);
    }, { passive: false });

    document.getElementById('btn-gs-close').addEventListener('click', () => this.close());
    document.getElementById('btn-gs-drawer-close').addEventListener('click', () => {
      if (this.mode === 'customize') this.setMode('attachments');
      else this.closeDrawer();
    });

    document.getElementById('btn-gs-reset-view').addEventListener('click', () => {
      this.rotY = 1.25;
      this.rotX = 0.08;
      this.zoom = GAME_DATA.ITEMS[this.activeWeaponId]?.slot === 'secondary' ? 0.78 : 1.15;
    });

    document.getElementById('btn-gs-preview').addEventListener('click', () => {
      this.setPreviewMode(!this.previewMode);
    });

    document.getElementById('btn-gs-tab-attach').addEventListener('click', () => {
      this.setPreviewMode(false);
      this.setMode('attachments');
    });

    document.getElementById('btn-gs-tab-custom').addEventListener('click', () => {
      this.setPreviewMode(false);
      this.setMode('customize');
    });

    document.querySelectorAll('.gs-cos-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.gs-cos-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeCosmeticSlot = btn.dataset.cos;
        this.renderCosmeticCards();
      });
    });
  }

  setPreviewMode(enabled) {
    this.previewMode = enabled;
    const btn = document.getElementById('btn-gs-preview');
    btn.textContent = enabled ? 'PREVIEW: ON' : 'PREVIEW: OFF';
    btn.style.borderColor = enabled ? '#69f0ae' : '';
    btn.style.color = enabled ? '#69f0ae' : '';

    document.getElementById('gs-nodes-layer').classList.toggle('hidden', enabled || this.mode === 'customize');
    document.getElementById('gs-stats-panel').classList.toggle('hidden', enabled);
    if (enabled) {
      document.getElementById('gs-drawer').classList.add('hidden');
    } else if (this.mode === 'customize') {
      this.openCustomizeDrawer();
    } else if (this.activeSlot) {
      document.getElementById('gs-drawer').classList.remove('hidden');
    }
  }

  setMode(mode) {
    this.mode = mode;
    document.getElementById('btn-gs-tab-attach').classList.toggle('active', mode === 'attachments');
    document.getElementById('btn-gs-tab-custom').classList.toggle('active', mode === 'customize');

    if (mode === 'customize') {
      document.getElementById('gs-nodes-layer').classList.add('hidden');
      this.openCustomizeDrawer();
    } else {
      document.getElementById('gs-nodes-layer').classList.remove('hidden');
      this.closeDrawer();
    }
  }

  open(weaponId) {
    const L = this.ui.profile.loadout;
    this.activeWeaponId = weaponId || L.primary || L.secondary || 'mp5k';
    this.zoom = GAME_DATA.ITEMS[this.activeWeaponId]?.slot === 'secondary' ? 0.78 : 1.15;
    this.isOpen = true;
    this.setPreviewMode(false);
    this.setMode('attachments');
    this.ui.showScreen('gunsmith');
    this._resize();
    this.rebuildModel();
    this.renderWeaponTabs();
    this.buildFloatingNodes();
    this.renderStats();
    this._loop();
  }

  close() {
    this.isOpen = false;
    this.previewMode = false;
    this.closeDrawer();
    this.ui.renderHideout();
    this.ui.showScreen('hideout');
  }

  openDrawer(slotKey) {
    this.activeSlot = slotKey;
    const labels = { optic: 'OPTIC', muzzle: 'MUZZLE', underbarrel: 'UNDERBARREL / RAIL', magazine: 'MAGAZINE' };
    document.getElementById('gs-drawer-title').textContent = labels[slotKey] || slotKey.toUpperCase();
    document.getElementById('gs-cosmetic-tabs').classList.add('hidden');
    document.getElementById('gs-drawer').classList.remove('hidden');
    this.buildFloatingNodes();
    this.renderAttachmentCards();
  }

  openCustomizeDrawer() {
    this.activeSlot = null;
    document.getElementById('gs-drawer-title').textContent = 'APPEARANCE';
    document.getElementById('gs-cosmetic-tabs').classList.remove('hidden');
    document.getElementById('gs-drawer').classList.remove('hidden');
    this.renderCosmeticCards();
  }

  closeDrawer() {
    this.activeSlot = null;
    document.getElementById('gs-drawer').classList.add('hidden');
    if (this.isOpen && this.mode === 'attachments') this.buildFloatingNodes();
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.renderer.setSize(rect.width, rect.height, false);
      this.camera.aspect = rect.width / rect.height;
      this.camera.updateProjectionMatrix();
    }
  }

  getModsFor(weaponId) {
    if (!this.ui.profile.weaponMods) this.ui.profile.weaponMods = {};
    if (!this.ui.profile.weaponMods[weaponId]) {
      this.ui.profile.weaponMods[weaponId] = {
        optic: 'none',
        muzzle: 'none',
        underbarrel: 'none',
        magazine: 'none',
        stock: 'none',
        camo: 'none',
        sticker: 'none',
        charm: 'none'
      };
    }
    return this.ui.profile.weaponMods[weaponId];
  }

  getUnlockedFor(weaponId) {
    if (!this.ui.profile.unlockedMods) this.ui.profile.unlockedMods = {};
    if (!this.ui.profile.unlockedMods[weaponId]) {
      this.ui.profile.unlockedMods[weaponId] = ['none'];
    }
    return this.ui.profile.unlockedMods[weaponId];
  }

  rebuildModel() {
    const def = GAME_DATA.ITEMS[this.activeWeaponId];
    if (!def) return;
    const mods = this.getModsFor(this.activeWeaponId);
    this.weaponBuilder.buildViewmodel(def, mods, false);
    this.weaponBuilder.viewmodelGroup.position.set(0, 0, def.slot === 'secondary' ? 0.0 : 0.14);
    document.getElementById('gs-weapon-title').textContent = def.name.toUpperCase();
    document.getElementById('gs-weapon-desc').textContent = def.desc;
  }

  renderWeaponTabs() {
    const container = document.getElementById('gs-weapon-tabs');
    container.innerHTML = '';
    const L = this.ui.profile.loadout;
    const candidates = [];
    if (L.primary) candidates.push({ id: L.primary, label: `PRIMARY: ${GAME_DATA.ITEMS[L.primary].name}` });
    if (L.secondary) candidates.push({ id: L.secondary, label: `SIDEARM: ${GAME_DATA.ITEMS[L.secondary].name}` });
    if (candidates.length === 0) candidates.push({ id: 'pm9', label: 'PM-9 Makarov' });

    for (const c of candidates) {
      const btn = document.createElement('button');
      btn.className = 'tab-btn' + (c.id === this.activeWeaponId ? ' active' : '');
      btn.textContent = c.label;
      btn.addEventListener('click', () => {
        this.activeWeaponId = c.id;
        this.zoom = GAME_DATA.ITEMS[c.id]?.slot === 'secondary' ? 0.78 : 1.15;
        this.rebuildModel();
        this.renderWeaponTabs();
        this.buildFloatingNodes();
        if (this.mode === 'customize') this.renderCosmeticCards();
        else if (this.activeSlot) this.renderAttachmentCards();
        this.renderStats();
      });
      container.appendChild(btn);
    }
  }

  buildFloatingNodes() {
    const layer = document.getElementById('gs-nodes-layer');
    layer.innerHTML = '';
    this.nodeAnchors = [];

    const def = GAME_DATA.ITEMS[this.activeWeaponId];
    if (!def) return;
    const isPistol = def.slot === 'secondary';
    const mods = this.getModsFor(this.activeWeaponId);

    const availOpts = GAME_DATA.getWeaponAttachmentOptions(this.activeWeaponId);
    const anchors = isPistol
      ? [
          { slot: 'optic', label: 'OPTIC', pos: new THREE.Vector3(0, 0.11, 0.04) },
          { slot: 'muzzle', label: 'MUZZLE', pos: new THREE.Vector3(0, 0.05, -0.22) },
          { slot: 'underbarrel', label: 'RAIL', pos: new THREE.Vector3(0, -0.09, -0.10) },
          { slot: 'magazine', label: 'MAG', pos: new THREE.Vector3(0, -0.15, 0.10) }
        ]
      : [
          { slot: 'optic', label: 'OPTIC', pos: new THREE.Vector3(0, 0.14, 0.14) },
          { slot: 'muzzle', label: 'MUZZLE', pos: new THREE.Vector3(0, 0.06, -0.44) },
          { slot: 'underbarrel', label: 'RAIL', pos: new THREE.Vector3(0, -0.12, -0.16) },
          { slot: 'magazine', label: 'MAG', pos: new THREE.Vector3(0, -0.17, 0.12) },
          ...(availOpts.stock ? [{ slot: 'stock', label: 'STOCK', pos: new THREE.Vector3(0, 0.02, 0.42) }] : [])
        ];

    for (const a of anchors) {
      const attId = mods[a.slot] || 'none';
      const att = GAME_DATA.ATTACHMENTS[a.slot][attId];
      const isEquipped = attId !== 'none';

      const btn = document.createElement('button');
      btn.className = `gs-node ${isEquipped ? 'equipped' : ''} ${this.activeSlot === a.slot ? 'active' : ''}`;
      btn.innerHTML = `
        <span class="gs-node-dot"></span>
        <span class="gs-node-text">
          <span class="gs-node-slot">${a.label}</span>
          <span class="gs-node-val">${att ? att.name : 'None'}</span>
        </span>
      `;
      btn.addEventListener('click', () => {
        if (this.activeSlot === a.slot) this.closeDrawer();
        else this.openDrawer(a.slot);
      });
      layer.appendChild(btn);
      this.nodeAnchors.push({ slot: a.slot, el: btn, localPos: a.pos });
    }
  }

  _updateNodePositions() {
    if (this.previewMode || this.mode !== 'attachments') return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.pivot.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);

    for (const n of this.nodeAnchors) {
      const worldPos = n.localPos.clone().applyMatrix4(this.pivot.matrixWorld);
      const proj = worldPos.project(this.camera);
      const x = (proj.x * 0.5 + 0.5) * rect.width;
      const y = (-proj.y * 0.5 + 0.5) * rect.height;
      n.el.style.left = `${x}px`;
      n.el.style.top = `${y}px`;
    }
  }

  renderAttachmentCards() {
    const list = document.getElementById('gs-attachment-list');
    list.innerHTML = '';
    if (!this.activeSlot) return;

    const options = GAME_DATA.getWeaponAttachmentOptions(this.activeWeaponId)[this.activeSlot] || [];
    const mods = this.getModsFor(this.activeWeaponId);
    const unlocked = this.getUnlockedFor(this.activeWeaponId);
    const equippedId = mods[this.activeSlot] || 'none';

    for (const attId of options) {
      const att = GAME_DATA.ATTACHMENTS[this.activeSlot][attId];
      if (!att) continue;
      this._appendModCard(list, this.activeSlot, att, equippedId === attId, unlocked, mods, () => {
        this.buildFloatingNodes();
        this.renderAttachmentCards();
        this.renderStats();
      });
    }
  }

  renderCosmeticCards() {
    const list = document.getElementById('gs-attachment-list');
    list.innerHTML = '';
    const slotKey = this.activeCosmeticSlot;
    const catalog = GAME_DATA.COSMETICS[slotKey] || {};
    const mods = this.getModsFor(this.activeWeaponId);
    const unlocked = this.getUnlockedFor(this.activeWeaponId);
    const equippedId = mods[slotKey] || 'none';

    for (const item of Object.values(catalog)) {
      this._appendModCard(list, slotKey, item, equippedId === item.id, unlocked, mods, () => {
        this.renderCosmeticCards();
      });
    }
  }

  _appendModCard(list, slotKey, item, isEquipped, unlocked, mods, onDone) {
    const isOwned = item.price === 0 || window.DEV_MODE || unlocked.includes(`${slotKey}:${item.id}`);
    const card = document.createElement('div');
    card.className = `gs-mod-card ${isEquipped ? 'equipped' : ''}`;
    card.innerHTML = `
      <div>
        <div class="item-name">${item.name}</div>
        <div class="item-meta" style="margin-top:4px;white-space:normal;">${item.desc}</div>
      </div>
    `;

    const btn = document.createElement('button');
    btn.className = 'btn-small';
    if (isEquipped) {
      btn.textContent = 'EQUIPPED';
      btn.disabled = true;
    } else if (isOwned) {
      btn.textContent = 'EQUIP';
      btn.addEventListener('click', () => {
        mods[slotKey] = item.id;
        this.ui.saveProfile();
        this.rebuildModel();
        onDone();
      });
    } else {
      btn.textContent = `BUY ₽${item.price.toLocaleString()}`;
      btn.disabled = this.ui.profile.credits < item.price;
      btn.addEventListener('click', () => {
        if (this.ui.profile.credits < item.price) return;
        this.ui.profile.credits -= item.price;
        unlocked.push(`${slotKey}:${item.id}`);
        mods[slotKey] = item.id;
        this.ui.saveProfile();
        this.rebuildModel();
        onDone();
      });
    }

    card.appendChild(btn);
    list.appendChild(card);
  }

  renderStats() {
    const base = GAME_DATA.ITEMS[this.activeWeaponId];
    const mods = this.getModsFor(this.activeWeaponId);
    const eff = GAME_DATA.getEffectiveWeaponStats(this.activeWeaponId, mods);
    if (!base || !eff) return;

    const container = document.getElementById('gs-stats-list');
    const totalDmg = base.damage * base.pellets;
    const baseRecoilCtrl = Math.round((1 - Math.min(0.08, base.recoil) / 0.09) * 100);
    const effRecoilCtrl = Math.round((1 - Math.min(0.08, eff.recoil) / 0.09) * 100);
    const baseAcc = Math.round((1 - Math.min(0.06, base.spread) / 0.07) * 100);
    const effAcc = Math.round((1 - Math.min(0.06, eff.spread) / 0.07) * 100);

    const makeBar = (label, valText, pct, delta = 0) => {
      const deltaHtml = delta !== 0
        ? `<span style="color:${delta > 0 ? '#69f0ae' : '#ff5555'}"> (${delta > 0 ? '+' : ''}${delta})</span>`
        : '';
      return `
        <div class="gs-stat-row">
          <div class="gs-stat-head"><span>${label}</span><b>${valText}${deltaHtml}</b></div>
          <div class="bar-bg"><div class="bar-fill" style="width:${THREE.MathUtils.clamp(pct, 5, 100)}%;background:#d9822b;"></div></div>
        </div>
      `;
    };

    container.innerHTML =
      makeBar('DAMAGE', `${totalDmg}`, (totalDmg / 180) * 100) +
      makeBar('RECOIL CONTROL', `${effRecoilCtrl}`, effRecoilCtrl, effRecoilCtrl - baseRecoilCtrl) +
      makeBar('HIPFIRE ACCURACY', `${effAcc}`, effAcc, effAcc - baseAcc) +
      makeBar('MAGAZINE CAPACITY', `${eff.magSize}`, (eff.magSize / 45) * 100, eff.magSize - base.magSize) +
      `<div class="gs-tags">
        <span class="ammo-chip">${eff.suppressed ? 'SUPPRESSED' : 'UNSUPPRESSED'}</span>
        <span class="ammo-chip">${eff.hasLaser ? 'PEQ-15 LASER' : 'NO LASER'}</span>
        <span class="ammo-chip">ADS FOV: ${eff.adsFov}°</span>
      </div>`;
  }

  _loop() {
    if (!this.isOpen) return;
    requestAnimationFrame(() => this._loop());
    if (this.previewMode && !this.dragging) {
      this.rotY += 0.004;
    }
    this.pivot.rotation.y = this.rotY;
    this.pivot.rotation.x = this.rotX;
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, this.zoom, 0.15);
    this.renderer.render(this.scene, this.camera);
    this._updateNodePositions();
  }
}
