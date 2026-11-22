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

  _makeOverheadNameSprite(name, color = '#69f0ae') {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 360, 64);
    ctx.fillStyle = 'rgba(10, 14, 13, 0.80)';
    ctx.fillRect(14, 10, 332, 44);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(14, 10, 332, 44);
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 180, 33);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const spr = new THREE.Sprite(mat);
    spr.position.set(0, 2.02, 0);
    spr.scale.set(1.55, 0.28, 1);
    return spr;
  }

  _buildOperatorMesh(loadout, weaponMods, isAlly = false, displayName = '', squadColor = '#69f0ae') {
    if (typeof window.buildTacticalOperatorModel === 'function') {
      const built = window.buildTacticalOperatorModel({
        uniformColor: isAlly ? 0x2f434a : 0x3b4437,
        squadColor,
        vestId: loadout.armor || null,
        bagId: loadout.backpack || null,
        faceForwardZ: true
      });
      // Slight bladed ready stance on the pre-match deployment stage
      built.pelvis.rotation.y = 0.18;
      built.torso.rotation.y = -0.14;
      built.leftLeg.hip.rotation.x = 0.12;
      built.leftLeg.knee.rotation.x = -0.18;
      built.rightLeg.hip.rotation.x = -0.08;
      built.rightLeg.knee.rotation.x = -0.12;
      // Hold equipped 3D weapon shouldered with both hands locked onto rear & forward grips via MW2 2-Bone IK!
      const wId = loadout.primary || loadout.secondary || 'mp5k';
      const wDef = GAME_DATA.ITEMS[wId];
      let isPistol = false;
      if (wDef && this.wpnBuilder) {
        const mods = (weaponMods && weaponMods[wId]) || {};
        const wpn = this.wpnBuilder.buildThirdPersonWeapon(wDef, mods);
        if (wpn && wpn.group && built.weaponMount) {
          isPistol = !!wpn.isPistol;
          wpn.group.scale.setScalar(isPistol ? 1.25 : 1.38);
          wpn.group.position.set(0.0, 0.01, isPistol ? -0.02 : -0.12);
          built.weaponMount.rotation.set(0, 0, 0);
          built.weaponMount.add(wpn.group);
        }
      }
      if (window.MW2Animator) {
        const anim = new window.MW2Animator(built);
        anim.update(0.016, { speed: 0, stance: 'stand', isPistol });
        built.root.userData.mw2Anim = anim;
        built.root.userData.isPistol = isPistol;
      }
      if (displayName) {
        built.root.add(this._makeOverheadNameSprite(displayName, squadColor));
      }
      built.root.userData.upper = built.torso;
      built.root.userData.upperBaseY = built.torso.position.y;
      built.root.userData.upperBaseRotY = built.torso.rotation.y;
      return built.root;
    }
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
    if (displayName) {
      root.add(this._makeOverheadNameSprite(displayName, squadColor));
    }
    root.userData.upper = upper;
    return root;
  }

  start(zoneId, matchId = null) {
    this.zoneId = zoneId || 'outpost';
    this.matchId = matchId || ('m_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6));
    this.countdown = 15.0;
    this.active = true;
    this.animTime = 0;
    this._launched = false;

    this.refreshSquadUI(true);
    this._resize();
  }

  refreshSquadUI(rebuildMeshes = false) {
    const squadColors = (GAME_DATA && GAME_DATA.SQUAD_COLORS) || ['#69f0ae', '#42a5f5', '#ffeb3b', '#ff69b4'];
    const party = this.ui.partyMembers || [];
    const multiSquad = party.length > 1;

    if (rebuildMeshes && this.operatorsGroup) {
      while (this.operatorsGroup.children.length > 0) {
        this.operatorsGroup.remove(this.operatorsGroup.children[0]);
      }
      const selfMember = party.find(m => m.isSelf) || { name: (this.ui.profile.social && this.ui.profile.social.callsign) || 'OPERATOR' };
      const selfColor = multiSquad ? (selfMember.squadColor || squadColors[0]) : '#69f0ae';

      const L = this.ui.profile.loadout;
      const mods = this.ui.profile.weaponMods || {};
      const mainOp = this._buildOperatorMesh(L, mods, false, selfMember.name, selfColor);
      this.operatorsGroup.add(mainOp);

      const allies = party.filter(m => !m.isSelf);
      const offsets = [
        { x: -0.95, z: -0.45, rotY: 0.22 },
        { x: 0.95,  z: -0.45, rotY: -0.22 },
        { x: -1.75, z: -0.85, rotY: 0.32 }
      ];
      allies.forEach((a, idx) => {
        const col = multiSquad ? (a.squadColor || squadColors[(idx + 1) % squadColors.length]) : '#69f0ae';
        const allyMesh = this._buildOperatorMesh({
          primary: a.weaponId || 'ak74m',
          armor: 'vest_2plate',
          backpack: 'bag_medium'
        }, {}, true, a.name, col);
        const pos = offsets[idx % offsets.length];
        allyMesh.position.set(pos.x, 0, pos.z);
        allyMesh.rotation.y = pos.rotY;
        this.operatorsGroup.add(allyMesh);
      });
    }

    const zDef = GAME_DATA.ZONES[this.zoneId] || GAME_DATA.ZONES.outpost;
    const titleEl = document.getElementById('mm-zone-title');
    if (titleEl) titleEl.textContent = zDef.name.toUpperCase();

    const sqEl = document.getElementById('mm-squad-list');
    if (sqEl) {
      sqEl.innerHTML = party.map((m, idx) => {
        const col = multiSquad ? (m.squadColor || squadColors[idx % squadColors.length]) : '#69f0ae';
        const isReady = !multiSquad || !!m.ready;
        const badge = isReady
          ? `<span style="color:#69f0ae;font-weight:800;">✓ READY</span>`
          : `<span style="color:#ffca28;font-weight:700;">○ NOT READY</span>`;
        return `<div style="color:${col};">● ${m.name}${m.isSelf ? ' (YOU)' : ''}${m.isLeader && multiSquad ? ' [LDR]' : ''} — ${badge}</div>`;
      }).join('');
    }

    const deployBtn = document.getElementById('btn-deploy');
    if (deployBtn) {
      const self = party.find(m => m.isSelf);
      const allReady = !multiSquad || party.every(m => !!m.ready);
      const isLeader = this.ui.isPartyLeader();
      if (!multiSquad) {
        deployBtn.textContent = 'DEPLOY NOW';
        deployBtn.style.background = '';
        deployBtn.disabled = false;
      } else if (!self || !self.ready) {
        deployBtn.textContent = 'READY UP ✓';
        deployBtn.style.background = '#2e7d32';
        deployBtn.disabled = false;
      } else if (!allReady) {
        deployBtn.textContent = 'UNREADY (WAITING...)';
        deployBtn.style.background = '#5a4618';
        deployBtn.disabled = false;
      } else if (isLeader) {
        deployBtn.textContent = 'DEPLOY SQUAD NOW →';
        deployBtn.style.background = '';
        deployBtn.disabled = false;
      } else {
        deployBtn.textContent = 'ALL READY — DEPLOYING...';
        deployBtn.style.background = '#2e7d32';
        deployBtn.disabled = true;
      }
    }
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

    const party = this.ui.partyMembers || [];
    const multiSquad = party.length > 1;
    const readyCount = party.filter(m => !!m.ready).length;
    const allReady = !multiSquad || (party.length > 0 && readyCount === party.length);

    if (allReady) {
      this.countdown = Math.max(0, this.countdown - dt);
    } else {
      // Wait at 15s until EVERY party member has clicked READY on all ends!
      this.countdown = 15.0;
    }

    const valEl = document.getElementById('mm-countdown-val');
    if (valEl) {
      valEl.textContent = allReady ? Math.ceil(this.countdown) : 'WAIT';
      valEl.style.color = allReady ? '' : '#ffca28';
    }
    const statusEl = document.getElementById('mm-status-text');
    if (statusEl) {
      if (!allReady) {
        statusEl.textContent = `WAITING FOR ALL PARTY MEMBERS TO READY UP (${readyCount}/${party.length})...`;
        statusEl.style.color = '#ffca28';
      } else if (this.countdown > 10) {
        statusEl.textContent = multiSquad
          ? `ALL OPERATORS READY (${party.length}/${party.length}) — LOCKING SECTOR INSTANCE...`
          : 'SEARCHING FOR 6-SQUAD SECTOR INSTANCE...';
        statusEl.style.color = '#69f0ae';
      } else if (this.countdown > 5) {
        statusEl.textContent = 'MATCH FOUND (6/6 SQUADS) — SYNCING SQUAD LOADOUTS...';
        statusEl.style.color = '#69f0ae';
      } else {
        statusEl.textContent = 'DEPLOYING HELO INSERTION...';
        statusEl.style.color = '#69f0ae';
      }
    }

    // Idle breathing & MW2 shouldered 2-bone IK hold on all party operators
    this.operatorsGroup.children.forEach((op, i) => {
      if (op.userData && op.userData.mw2Anim) {
        op.userData.mw2Anim.update(dt, { speed: 0, stance: 'stand', isPistol: !!op.userData.isPistol });
        return;
      }
      const upper = op.userData.upper;
      if (upper) {
        const baseY = op.userData.upperBaseY !== undefined ? op.userData.upperBaseY : 0.90;
        const baseRotY = op.userData.upperBaseRotY !== undefined ? op.userData.upperBaseRotY : 0;
        upper.position.y = baseY + Math.sin(this.animTime * 2.0 + i) * 0.010;
        upper.rotation.y = baseRotY + Math.sin(this.animTime * 0.65 + i) * 0.05;
      }
    });

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    if (allReady && this.countdown <= 0 && !this._launched) {
      this._launched = true;
      this.active = false;
      if (multiSquad && this.ui.isPartyLeader() && this.ui.broadcastPartyDeploy) {
        this.ui.broadcastPartyDeploy(this.zoneId, this.matchId);
      }
      if (this.onLaunchRaid) this.onLaunchRaid(this.zoneId, this.matchId);
    }
  }
}
