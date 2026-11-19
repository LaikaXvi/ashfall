// 3D Operator Matchmaking Staging Viewport & 15-Second Countdown
class MatchmakingStage {
  constructor(ui, onLaunchRaid) {
    this.ui = ui;
    this.onLaunchRaid = onLaunchRaid;
    this.canvas = document.getElementById('matchmaking-canvas');
    this.active = false;
    this.countdown = 15.0;
    this.zoneId = 'outpost';
    this.animTime = 0;

    this._initScene();
  }

  _initScene() {
    if (!this.canvas) return;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d100f);
    this.scene.fog = new THREE.FogExp2(0x0d100f, 0.08);

    this.camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.1, 40);
    this.camera.position.set(0.35, 1.38, 2.85);
    this.camera.lookAt(0, 1.10, 0);

    this.scene.add(new THREE.HemisphereLight(0xd8e0e8, 0x1e201c, 0.8));
    const key = new THREE.DirectionalLight(0xffe6c2, 1.15);
    key.position.set(2.5, 4.0, 3.0);
    const rim = new THREE.DirectionalLight(0xf5a623, 0.75);
    rim.position.set(-2.5, 2.0, -2.5);
    this.scene.add(key, rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 32),
      new THREE.MeshLambertMaterial({ color: 0x181c1a })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(8, 16, 0x3b443e, 0x1e2420);
    grid.position.y = 0.01;
    this.scene.add(grid);

    this.operatorsGroup = new THREE.Group();
    this.scene.add(this.operatorsGroup);

    const dummyCam = new THREE.Object3D();
    this.wpnBuilder = new WeaponSystem(this.scene, dummyCam);
  }

  _buildOperatorMesh(loadout, weaponMods, isAlly = false) {
    const root = new THREE.Group();
    const uniformMat = new THREE.MeshLambertMaterial({ color: isAlly ? 0x2f434a : 0x3b4237 });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2a2e28 });
    const vestCol = loadout.armor === 'vest_3plate' ? 0x5c2626 : (loadout.armor === 'vest_2plate_helmet' ? 0x3f3352 : 0x4b5342);
    const vestMat = new THREE.MeshLambertMaterial({ color: vestCol });
    const gearMat = new THREE.MeshLambertMaterial({ color: 0x1b1e21 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd1a483 });

    // Legs
    [-0.12, 0.12].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.86, 0.16), pantsMat);
      leg.position.set(x, 0.44, 0);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.24), gearMat);
      boot.position.set(x, 0.055, 0.04);
      root.add(leg, boot);
    });

    // Upper body (animated breathing group)
    const upper = new THREE.Group();
    upper.position.set(0, 0.90, 0);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.25), uniformMat);
    chest.position.set(0, 0.26, 0);
    const carrier = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.38, 0.28), vestMat);
    carrier.position.set(0, 0.28, 0);
    const packSize = loadout.backpack === 'bag_large' ? 0.19 : (loadout.backpack === 'bag_medium' ? 0.15 : 0.11);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.38, packSize), gearMat);
    pack.position.set(0, 0.28, -0.18);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.23, 0.22), skinMat);
    head.position.set(0, 0.65, 0);
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.26), gearMat);
    helmet.position.set(0, 0.73, 0);

    // Arms holding weapon across chest
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.12), uniformMat);
    armL.position.set(-0.26, 0.26, 0.10);
    armL.rotation.set(-0.75, 0, 0.32);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.12), uniformMat);
    armR.position.set(0.26, 0.26, 0.10);
    armR.rotation.set(-0.80, 0, -0.25);

    // Actual equipped 3D weapon in hands!
    const wId = loadout.primary || loadout.secondary || 'mp5k';
    const wDef = GAME_DATA.ITEMS[wId];
    if (wDef && this.wpnBuilder) {
      const mods = (weaponMods && weaponMods[wId]) || {};
      const wpn = this.wpnBuilder.buildThirdPersonWeapon(wDef, mods);
      if (wpn && wpn.group) {
        wpn.group.scale.setScalar(1.28);
        wpn.group.position.set(0.06, 0.16, 0.28);
        wpn.group.rotation.set(0.08, -1.25, -0.14);
        upper.add(wpn.group);
      }
    }

    upper.add(chest, carrier, pack, head, helmet, armL, armR);
    root.add(upper);
    root.userData.upper = upper;
    return root;
  }

  start(zoneId) {
    this.zoneId = zoneId || 'outpost';
    this.countdown = 15.0;
    this.active = true;
    this.animTime = 0;

    // Clear & rebuild 3D operator + squadmates
    while (this.operatorsGroup.children.length > 0) {
      this.operatorsGroup.remove(this.operatorsGroup.children[0]);
    }
    const L = this.ui.profile.loadout;
    const mods = this.ui.profile.weaponMods || {};
    const mainOp = this._buildOperatorMesh(L, mods, false);
    this.operatorsGroup.add(mainOp);

    const allies = (this.ui.partyMembers || []).filter(m => !m.isSelf);
    allies.forEach((a, idx) => {
      const allyMesh = this._buildOperatorMesh({
        primary: a.weaponId || 'ak74m',
        armor: 'vest_2plate',
        backpack: 'bag_medium'
      }, {}, true);
      allyMesh.position.set(idx === 0 ? -0.95 : 0.95, 0, -0.45);
      allyMesh.rotation.y = idx === 0 ? 0.22 : -0.22;
      this.operatorsGroup.add(allyMesh);
    });

    const zDef = GAME_DATA.ZONES[this.zoneId] || GAME_DATA.ZONES.outpost;
    const titleEl = document.getElementById('mm-zone-title');
    if (titleEl) titleEl.textContent = zDef.name.toUpperCase();
    const sqEl = document.getElementById('mm-squad-list');
    if (sqEl) {
      sqEl.innerHTML = (this.ui.partyMembers || []).map(m =>
        `<div style="color:#69f0ae;">✓ ${m.name}${m.isSelf ? ' (YOU)' : ''} — READY</div>`
      ).join('');
    }
    this._resize();
  }

  stop() {
    this.active = false;
  }

  _resize() {
    if (!this.canvas || !this.renderer) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.renderer.setSize(rect.width, rect.height, false);
      this.camera.aspect = rect.width / rect.height;
      this.camera.updateProjectionMatrix();
    }
  }

  update(dt) {
    if (!this.active) return;
    this.animTime += dt;
    this.countdown = Math.max(0, this.countdown - dt);

    const valEl = document.getElementById('mm-countdown-val');
    if (valEl) valEl.textContent = Math.ceil(this.countdown);
    const statusEl = document.getElementById('mm-status-text');
    if (statusEl) {
      if (this.countdown > 10) statusEl.textContent = 'SEARCHING FOR 6-SQUAD SECTOR INSTANCE...';
      else if (this.countdown > 5) statusEl.textContent = 'MATCH FOUND (6/6 SQUADS) — SYNCING LOADOUTS...';
      else statusEl.textContent = 'DEPLOYING HELO INSERTION...';
    }

    // Idle breathing & subtle heroic sway
    this.operatorsGroup.children.forEach((op, i) => {
      const upper = op.userData.upper;
      if (upper) {
        upper.position.y = 0.90 + Math.sin(this.animTime * 2.0 + i) * 0.012;
        upper.rotation.y = Math.sin(this.animTime * 0.65 + i) * 0.08;
      }
    });

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.countdown <= 0) {
      this.active = false;
      if (this.onLaunchRaid) this.onLaunchRaid(this.zoneId);
    }
  }
}
