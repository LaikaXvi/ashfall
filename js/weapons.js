// 3D Weapon Viewmodel, Functional Iron Sights, Ballistics, Tracers, Smoke & Impacts
class WeaponSystem {
  constructor(scene, camera, viewmodelCamera = null) {
    this.scene = scene;
    this.camera = camera;
    this.vmCamera = viewmodelCamera || camera;

    this.viewmodelGroup = new THREE.Group();
    this.vmCamera.add(this.viewmodelGroup);

    this.muzzleFlash = new THREE.PointLight(0xffaa44, 0, 8);
    this.viewmodelGroup.add(this.muzzleFlash);

    this.muzzleMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffdd77, transparent: true, opacity: 0 })
    );
    this.viewmodelGroup.add(this.muzzleMesh);

    this.currentMesh = null;
    this.sightHeight = 0.05; // Local Y of iron sights for exact ADS alignment
    this.adsZ = -0.30;

    this.fireTimer = 0;
    this.recoilOffset = 0;
    this.boltKick = 0;
    this.currentSpread = 0.022;
    this.fireBloom = 0;
    this.wallPush = 0;
    this.wallBlocked = false;
    this._wallRay = new THREE.Raycaster();
    this.pumpDelayTimer = 0;
    this.pumpTimer = 0;
    this.pumpDuration = 0.40;
    this.bobTimer = 0;
    this.muzzleTimer = 0;

    this.isReloading = false;
    this.reloadTimer = 0;
    this.reloadDuration = 1.8;
    this.wasEmptyReload = false;
    this.reloadWeaponId = 'pm9';
    this.reloadShellCount = 1;
    this.lastShellSoundIdx = -1;
    this.lastShellLoadedIdx = -1;
    this.reloadSfxFlags = { magOut: false, magIn: false, rack: false, boltLock: false };

    this.isInspecting = false;
    this.inspectTimer = 0;
    this.inspectDuration = 5.2;
    this.inspectWeaponId = 'pm9';

    this.isPlating = false;
    this.plateTimer = 0;
    this.plateDuration = 1.9;
    this.platesToInsert = 1;
    this.lastPlateSoundIdx = -1;
    this.lastPlateInsertedIdx = -1;
    this.plateZipFlags = { open: false, close: false };
    this.plateRig = null;
    this.plateMesh = null;
    this.plateHand = null;
    this.plateArm = null;

    this.isHealing = false;
    this.healTimer = 0;
    this.healDuration = 6.4;
    this.healSequence = ['stim', 'bandage'];
    this.healFlags = { open: false, item1: false, item2: false, applied: false, close: false };
    this.medRig = null;
    this.medBoxGroup = null;
    this.medLidPivot = null;
    this.medItems = null;
    this.medLeftHand = null;
    this.medLeftArm = null;
    this.medRightHand = null;
    this.medRightArm = null;
    this.tacFistRig = null;
    this.tacFist = null;
    this.tacFistArm = null;
    this.isThirdPerson = false;
    this.isMeleeMode = false;
    this.meleeMesh = null;
    this.drawTimer = 0;
    this.drawDuration = 0.42;
    this.drawStyle = 'shoulder_down'; // 'shoulder_down' | 'undersling_up'
    this.downedLegsGroup = null;
    this.downedScootCycle = 0;

    this.magMesh = null;
    this.magRestPos = new THREE.Vector3();
    this.magRestRot = new THREE.Euler();
    this.boltMesh = null;
    this.boltRestPos = new THREE.Vector3();
    this.boltRestRot = new THREE.Euler();
    this.leftHand = null;
    this.leftHandRestPos = new THREE.Vector3();
    this.leftHandRestRot = new THREE.Euler();
    this.rightHand = null;
    this.rightHandRestPos = new THREE.Vector3();
    this.rightHandRestRot = new THREE.Euler();
    this.leftArm = null;
    this.rightArm = null;
    this.charmPivot = null;

    this.particles = []; // { mesh, vel, life, maxLife, isSmoke }
    this.tracers = [];   // { line, life }
  }

  _addIronSights(group, rearZ, frontZ, sightY, dotColor = 0x55ff66) {
    const sightMat = new THREE.MeshLambertMaterial({ color: 0x111214 });
    const dotMat = new THREE.MeshBasicMaterial({ color: dotColor });

    // Compact rear U-notch (left ear, right ear, base)
    const earGeo = new THREE.BoxGeometry(0.0032, 0.008, 0.008);
    const leftEar = new THREE.Mesh(earGeo, sightMat);
    leftEar.position.set(-0.0055, sightY, rearZ);
    const rightEar = new THREE.Mesh(earGeo, sightMat);
    rightEar.position.set(0.0055, sightY, rearZ);
    const rearBase = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.003, 0.008), sightMat);
    rearBase.position.set(0, sightY - 0.004, rearZ);

    // Compact front post + tritium/fiber-optic dot
    const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.008, 0.005), sightMat);
    frontPost.position.set(0, sightY - 0.0015, frontZ);
    const frontDot = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.0024, 0.0055), dotMat);
    frontDot.position.set(0, sightY + 0.0012, frontZ);

    group.add(leftEar, rightEar, rearBase, frontPost, frontDot);
  }

  _addScope(group, scopeY, style = 'lpvo') {
    const scopeMat = new THREE.MeshLambertMaterial({ color: 0x16191c, side: THREE.DoubleSide });
    const ringMat = new THREE.MeshLambertMaterial({ color: 0x2a2e33 });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x88bbee, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
    const reticleMat = new THREE.MeshBasicMaterial({ color: 0x101010 });
    const illumMat = new THREE.MeshBasicMaterial({ color: 0xff2b2b });

    const isSniper = style === 'sniper';
    const isAcog = style === 'acog';
    const r = isSniper ? 0.024 : (isAcog ? 0.019 : 0.021);
    const len = isSniper ? 0.28 : (isAcog ? 0.135 : 0.21);
    const zCenter = isSniper ? -0.02 : (isAcog ? 0.02 : 0.0);

    // Clean hollow cylindrical tube (open-ended so player looks cleanly through the optic!)
    const tubeGeo = new THREE.CylinderGeometry(r, r, len, 18, 1, true);
    tubeGeo.rotateX(Math.PI / 2);
    const tube = new THREE.Mesh(tubeGeo, scopeMat);
    tube.position.set(0, scopeY, zCenter);

    // Flared front objective bell & rear eyepiece collar
    const frontBellGeo = new THREE.CylinderGeometry(r * 1.18, r, len * 0.24, 18, 1, true);
    frontBellGeo.rotateX(Math.PI / 2);
    const frontBell = new THREE.Mesh(frontBellGeo, scopeMat);
    frontBell.position.set(0, scopeY, zCenter - len * 0.56);

    const rearBellGeo = new THREE.CylinderGeometry(r, r * 1.12, len * 0.18, 18, 1, true);
    rearBellGeo.rotateX(Math.PI / 2);
    const rearBell = new THREE.Mesh(rearBellGeo, scopeMat);
    rearBell.position.set(0, scopeY, zCenter + len * 0.54);

    // Dual Picatinny rail mount rings & base
    const railBase = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.010, len * 0.55), ringMat);
    railBase.position.set(0, scopeY - r - 0.012, zCenter);
    const ringGeo = new THREE.TorusGeometry(r + 0.0025, 0.0032, 8, 18);
    const ringF = new THREE.Mesh(ringGeo, ringMat);
    ringF.position.set(0, scopeY, zCenter - len * 0.20);
    const ringR = new THREE.Mesh(ringGeo, ringMat);
    ringR.position.set(0, scopeY, zCenter + len * 0.20);

    // Elevation & windage tactical turrets
    const elevTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.007, 0.012, 10), ringMat);
    elevTurret.position.set(0, scopeY + r + 0.005, zCenter);
    const windTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0065, 0.011, 10), ringMat);
    windTurret.rotation.z = Math.PI / 2;
    windTurret.position.set(r + 0.005, scopeY, zCenter);

    // Subtle anti-reflective lens tint disc
    const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.94, 16), glassMat);
    lens.position.set(0, scopeY, zCenter - len * 0.45);

    // Ultra-fine crisp reticle inside tube
    const retZ = zCenter - len * 0.12;
    const hLine = new THREE.Mesh(new THREE.BoxGeometry(r * 1.85, 0.0008, 0.0008), reticleMat);
    hLine.position.set(0, scopeY, retZ);
    const vLine = new THREE.Mesh(new THREE.BoxGeometry(0.0008, r * 1.85, 0.0008), reticleMat);
    vLine.position.set(0, scopeY, retZ);
    const centerDot = new THREE.Mesh(new THREE.CircleGeometry(0.0014, 8), illumMat);
    centerDot.position.set(0, scopeY, retZ + 0.0006);

    group.add(tube, frontBell, rearBell, railBase, ringF, ringR, elevTurret, windTurret, lens, hLine, vLine, centerDot);

    if (isAcog) {
      // Glowing fiber-optic light pipe on top of TA-31 prism
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.055, 8), illumMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(0, scopeY + r + 0.004, zCenter - 0.02);
      group.add(pipe);
    } else if (isSniper) {
      // Mil-dot stadia hash ticks on horizontal & vertical crosshairs
      [-0.008, -0.004, 0.004, 0.008].forEach((off) => {
        const tickV = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.0007, 0.0007), reticleMat);
        tickV.position.set(0, scopeY + off, retZ);
        const tickH = new THREE.Mesh(new THREE.BoxGeometry(0.0007, 0.0032, 0.0007), reticleMat);
        tickH.position.set(off, scopeY, retZ);
        group.add(tickV, tickH);
      });
    }
  }

  _addRedDot(group, opticY, opticZ = 0.02) {
    const housingMat = new THREE.MeshLambertMaterial({ color: 0x16181a });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.09, side: THREE.DoubleSide });
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff2b2b });

    const r = 0.015;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.007, 0.038), housingMat);
    base.position.set(0, opticY - r - 0.002, opticZ);
    // Slim rounded reflex ring frame
    const frame = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0024, 8, 20), housingMat);
    frame.position.set(0, opticY, opticZ);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 16), glassMat);
    lens.position.set(0, opticY, opticZ);
    const redDot = new THREE.Mesh(new THREE.CircleGeometry(0.0014, 8), dotMat);
    redDot.position.set(0, opticY, opticZ + 0.0006);

    group.add(base, frame, lens, redDot);
  }

  _addHolo(group, opticY, opticZ = 0.02) {
    const hoodMat = new THREE.MeshLambertMaterial({ color: 0x1a1d20 });
    const tanMat = new THREE.MeshLambertMaterial({ color: 0x4b4639 });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
    const retMat = new THREE.MeshBasicMaterial({ color: 0xff3322 });

    const w = 0.018, h = 0.015, len = 0.056;
    const base = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 0.008, 0.012, len), hoodMat);
    base.position.set(0, opticY - h - 0.005, opticZ);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.0038, h * 2, len * 0.65), tanMat);
    left.position.set(-w, opticY, opticZ);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.0038, h * 2, len * 0.65), tanMat);
    right.position.set(w, opticY, opticZ);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 0.004, 0.0038, len * 0.65), tanMat);
    top.position.set(0, opticY + h, opticZ);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.85, h * 1.85), glassMat);
    lens.position.set(0, opticY, opticZ);

    // Classic EOTech circle-dot holographic reticle
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.0055, 0.0066, 20), retMat);
    ring.position.set(0, opticY, opticZ + 0.0005);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0012, 8), retMat);
    dot.position.set(0, opticY, opticZ + 0.0006);

    group.add(base, left, right, top, lens, ring, dot);
  }

  _attachMods(g, weaponDef, mods = {}, withHands = true) {
    const matDark = new THREE.MeshLambertMaterial({ color: 0x181a1c });
    const matSteel = new THREE.MeshLambertMaterial({ color: 0x35393e });
    const matTan = new THREE.MeshLambertMaterial({ color: 0x6b5c43 });

    // 1. Optic
    if (mods.optic === 'red_dot') {
      if (weaponDef.slot === 'secondary' && this.boltMesh) {
        const y = 0.036;
        this._addRedDot(this.boltMesh, y, 0.04);
        this.sightHeight = y + this.boltMesh.position.y;
      } else {
        const y = weaponDef.id === 'm24' ? 0.064 : 0.056;
        this._addRedDot(g, y, 0.02);
        this.sightHeight = y;
      }
    } else if (mods.optic === 'holo' && weaponDef.slot !== 'secondary') {
      const y = weaponDef.id === 'm24' ? 0.068 : 0.060;
      this._addHolo(g, y, 0.02);
      this.sightHeight = y;
    } else if (mods.optic === 'acog_2x' && weaponDef.slot !== 'secondary') {
      const y = weaponDef.id === 'm24' ? 0.072 : 0.066;
      this._addScope(g, y, 'acog');
      this.sightHeight = y;
    } else if (mods.optic === 'lpvo_4x' && weaponDef.slot !== 'secondary') {
      const y = weaponDef.id === 'm24' ? 0.074 : 0.068;
      this._addScope(g, y, 'lpvo');
      this.sightHeight = y;
    } else if (mods.optic === 'sniper_8x' && weaponDef.slot !== 'secondary') {
      const y = weaponDef.id === 'm24' ? 0.078 : 0.072;
      this._addScope(g, y, 'sniper');
      this.sightHeight = y;
    }

    // 2. Muzzle
    const mz = this.muzzleMesh.position;
    if (mods.muzzle === 'suppressor') {
      const supLen = weaponDef.slot === 'secondary' ? 0.12 : 0.16;
      const supRad = weaponDef.slot === 'secondary' ? 0.014 : 0.017;
      const sup = new THREE.Mesh(new THREE.CylinderGeometry(supRad, supRad, supLen, 12), matDark);
      sup.rotation.x = Math.PI / 2;
      sup.position.set(mz.x, mz.y, mz.z - supLen / 2 + 0.02);
      g.add(sup);
      this.muzzleMesh.position.z -= supLen - 0.01;
      this.muzzleFlash.position.z -= supLen - 0.01;
    } else if (mods.muzzle === 'compensator') {
      const comp = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.048), matSteel);
      comp.position.set(mz.x, mz.y, mz.z - 0.012);
      g.add(comp);
      this.muzzleMesh.position.z -= 0.03;
      this.muzzleFlash.position.z -= 0.03;
    }

    // 3. Underbarrel
    if (mods.underbarrel === 'vert_grip' && weaponDef.slot !== 'secondary') {
      const gripZ = weaponDef.id === 'mp5k' ? -0.15 : -0.21;
      const vGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.085, 8), matDark);
      vGrip.position.set(0, -0.058, gripZ);
      g.add(vGrip);
    } else if (mods.underbarrel === 'laser') {
      const lx = weaponDef.slot === 'secondary' ? 0.0 : 0.028;
      const ly = weaponDef.slot === 'secondary' ? -0.026 : 0.005;
      const lz = weaponDef.slot === 'secondary' ? -0.065 : -0.24;
      const peq = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.018, 0.055), matTan);
      peq.position.set(lx, ly, lz);
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.004, 0.006, 8),
        new THREE.MeshBasicMaterial({ color: 0xff2222 })
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(lx, ly, lz - 0.028);
      g.add(peq, lens);

      if (withHands) {
        const beamGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(lx, ly, lz - 0.03),
          new THREE.Vector3(0, 0, -18)
        ]);
        const beamMat = new THREE.LineBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.35 });
        g.add(new THREE.Line(beamGeo, beamMat));
      }
    }

    // 4. Extended Magazine
    if (mods.magazine === 'ext_mag' && this.magMesh) {
      this.magMesh.scale.y = 1.28;
      this.magMesh.position.y -= 0.018;
      this.magRestPos.copy(this.magMesh.position);
      if (this.spareMagMesh) {
        this.spareMagMesh.scale.y = 1.28;
        this.spareMagMesh.position.y -= 0.018;
      }
    }

    // 5. Stock Attachment (SMGs, ARs, Marksman / Sniper Rifles)
    if (mods.stock && mods.stock !== 'none' && weaponDef.slot !== 'secondary' && weaponDef.id !== 'm870') {
      const stockZ = weaponDef.id === 'mp5k' ? 0.14 : (weaponDef.id === 'm24' ? 0.18 : 0.16);
      const stockGroup = new THREE.Group();
      stockGroup.position.set(0, -0.008, stockZ);

      if (mods.stock === 'collapsed') {
        // PDW telescoping twin steel wire rails + compact buttpad
        const railL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.008, 0.19), matSteel);
        railL.position.set(-0.017, 0.006, 0.095);
        const railR = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.008, 0.19), matSteel);
        railR.position.set(0.017, 0.006, 0.095);
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.078, 0.018), matDark);
        pad.position.set(0, -0.014, 0.19);
        stockGroup.add(railL, railR, pad);
      } else if (mods.stock === 'tactical') {
        // CTR adjustable carbine stock on buffer tube
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.18, 10), matSteel);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(0, 0.010, 0.09);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.068, 0.13), matDark);
        body.position.set(0, -0.012, 0.155);
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.11), matDark);
        strut.position.set(0, -0.050, 0.145);
        strut.rotation.x = -0.22;
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.096, 0.016), matTan);
        pad.position.set(0, -0.022, 0.222);
        stockGroup.add(tube, body, strut, pad);
      } else if (mods.stock === 'heavy_marksman') {
        // PRS precision reinforced marksman stock with elevated cheek riser & monopod rail
        const main = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.076, 0.22), matDark);
        main.position.set(0, -0.014, 0.115);
        const riser = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.022, 0.12), matTan);
        riser.position.set(0, 0.030, 0.11);
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.112, 0.022), matSteel);
        pad.position.set(0, -0.024, 0.23);
        const mono = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.020, 0.09), matSteel);
        mono.position.set(0, -0.060, 0.17);
        stockGroup.add(main, riser, pad, mono);
      }
      g.add(stockGroup);
    }
  }

  _getCamoMaterial(weaponDef, camoId) {
    const camo = GAME_DATA.COSMETICS?.camo[camoId || 'none'];
    if (!camo || camo.id === 'none') {
      return new THREE.MeshLambertMaterial({ color: weaponDef.color });
    }
    if (camo.color !== undefined) {
      return new THREE.MeshLambertMaterial({ color: camo.color });
    }

    if (!window._camoTextures) window._camoTextures = {};
    if (!window._camoTextures[camo.id]) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d');
      if (camo.pattern === 'digital') {
        ctx.fillStyle = '#4f5459';
        ctx.fillRect(0, 0, 128, 128);
        const cols = ['#2b2e33', '#757b82', '#3a3e42', '#9aa0a6'];
        for (let i = 0; i < 160; i++) {
          ctx.fillStyle = cols[i % cols.length];
          ctx.fillRect(Math.floor(Math.random() * 16) * 8, Math.floor(Math.random() * 16) * 8, 8, 8);
        }
      } else {
        // Crimson tiger stripes
        ctx.fillStyle = '#1c1d1f';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#8c1d1d';
        for (let i = -32; i < 160; i += 22) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + 12, 0);
          ctx.lineTo(i - 20, 128);
          ctx.lineTo(i - 32, 128);
          ctx.closePath();
          ctx.fill();
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      window._camoTextures[camo.id] = tex;
    }
    return new THREE.MeshLambertMaterial({ map: window._camoTextures[camo.id] });
  }

  _getStickerTexture(stickerDef) {
    if (!window._stickerTextures) window._stickerTextures = {};
    if (window._stickerTextures[stickerDef.id]) return window._stickerTextures[stickerDef.id];
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = stickerDef.bg;
    ctx.fillRect(8, 8, 112, 112);
    ctx.strokeStyle = stickerDef.fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 112, 112);
    ctx.fillStyle = stickerDef.fg;
    ctx.font = 'bold 72px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stickerDef.glyph, 64, 68);
    const tex = new THREE.CanvasTexture(c);
    window._stickerTextures[stickerDef.id] = tex;
    return tex;
  }

  _attachCosmetics(g, weaponDef, mods = {}) {
    this.charmPivot = null;
    const isPistol = weaponDef.slot === 'secondary';

    // Sticker decal on left side of receiver / slide
    const stickerId = mods.sticker || 'none';
    const stickerDef = GAME_DATA.COSMETICS?.sticker[stickerId];
    if (stickerDef && stickerId !== 'none') {
      const decalMat = new THREE.MeshBasicMaterial({ map: this._getStickerTexture(stickerDef) });
      const decal = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.022, 0.022), decalMat);
      if (isPistol && this.boltMesh) {
        decal.position.set(-0.019, 0.0, 0.02);
        this.boltMesh.add(decal);
      } else {
        decal.position.set(-0.025, 0.002, 0.04);
        g.add(decal);
      }
    }

    // 3D Weapon Charm hanging from left side of receiver/frame
    const charmId = mods.charm || 'none';
    if (charmId !== 'none') {
      const mountPos = isPistol
        ? new THREE.Vector3(-0.018, -0.012, 0.02)
        : new THREE.Vector3(-0.026, -0.005, -0.04);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.004, 0.0012, 6, 10),
        new THREE.MeshLambertMaterial({ color: 0x9aa0a6 })
      );
      ring.position.copy(mountPos);
      g.add(ring);

      const pivot = new THREE.Group();
      pivot.position.copy(mountPos);

      let charmMesh;
      if (charmId === 'dogtag') {
        charmMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.003, 0.022, 0.014),
          new THREE.MeshLambertMaterial({ color: 0xb0b8c0 })
        );
      } else if (charmId === 'bullet') {
        charmMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.004, 0.0045, 0.024, 8),
          new THREE.MeshLambertMaterial({ color: 0xd4a442 })
        );
      } else if (charmId === 'cube') {
        charmMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.014, 0.014, 0.014),
          new THREE.MeshLambertMaterial({ color: 0xe6e4dd })
        );
      } else {
        // Mini frag grenade
        charmMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.009, 8, 8),
          new THREE.MeshLambertMaterial({ color: 0x4b5c3e })
        );
      }
      charmMesh.position.set(-0.003, -0.016, 0);
      pivot.add(charmMesh);
      g.add(pivot);
      this.charmPivot = pivot;
    }
  }

  _createHand(isRight = true, style = 'grip') {
    const handGroup = new THREE.Group();
    const gloveMat = new THREE.MeshLambertMaterial({ color: 0x454b3e });
    const knuckleMat = new THREE.MeshLambertMaterial({ color: 0x22251f });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd1a483 });
    const cuffMat = new THREE.MeshLambertMaterial({ color: 0x1a1c19 });

    if (style === 'grip') {
      // Right hand wrapped around pistol grip
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.058, 0.050), gloveMat);
      palm.position.set(0.008, 0, 0.004);
      const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.014, 0.020), knuckleMat);
      knuckle.position.set(0.008, 0.020, -0.016);
      handGroup.add(palm, knuckle);

      // 4 fingers curling around front of grip
      for (let i = 0; i < 4; i++) {
        const fy = 0.018 - i * 0.013;
        const fBase = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.010, 0.018), gloveMat);
        fBase.position.set(-0.004, fy, -0.024);
        const fTip = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.009, 0.016), skinMat);
        fTip.position.set(-0.018, fy, -0.014);
        handGroup.add(fBase, fTip);
      }

      // Thumb on left side of grip/frame
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.038), gloveMat);
      thumb.position.set(-0.020, 0.024, -0.006);
      const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.016), skinMat);
      thumbTip.position.set(-0.020, 0.024, -0.030);
      handGroup.add(thumb, thumbTip);
    } else if (style === 'supportPistol') {
      // Left hand cupping the right hand & grip (thumbs-forward)
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.056, 0.048), gloveMat);
      palm.position.set(-0.016, -0.004, 0.004);
      const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.048, 0.022), knuckleMat);
      knuckle.position.set(-0.026, -0.002, -0.014);
      handGroup.add(palm, knuckle);

      for (let i = 0; i < 4; i++) {
        const fy = 0.014 - i * 0.012;
        const fBase = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.010, 0.018), gloveMat);
        fBase.position.set(0.0, fy, -0.028);
        const fTip = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.009, 0.014), skinMat);
        fTip.position.set(0.018, fy, -0.020);
        handGroup.add(fBase, fTip);
      }

      // Left thumb pointing forward along frame
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.042), gloveMat);
      thumb.position.set(-0.022, 0.024, -0.014);
      const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.016), skinMat);
      thumbTip.position.set(-0.022, 0.024, -0.040);
      handGroup.add(thumb, thumbTip);
    } else if (style === 'supportRifle') {
      // supportRifle: cupping underneath handguard/forend
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.024, 0.062), gloveMat);
      palm.position.set(0, -0.014, 0);
      const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.026, 0.056), knuckleMat);
      knuckle.position.set(-0.026, -0.004, 0);
      handGroup.add(palm, knuckle);

      // 4 fingers curling up the right side of handguard
      for (let i = 0; i < 4; i++) {
        const fz = -0.020 + i * 0.013;
        const fBase = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.028, 0.010), gloveMat);
        fBase.position.set(0.026, 0.0, fz);
        const fTip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, 0.009), skinMat);
        fTip.position.set(0.022, 0.018, fz);
        handGroup.add(fBase, fTip);
      }

      // Thumb resting along left side of handguard
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.042), gloveMat);
      thumb.position.set(-0.026, 0.012, -0.006);
      const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.016), skinMat);
      thumbTip.position.set(-0.026, 0.014, -0.032);
      handGroup.add(thumb, thumbTip);
    } else if (style === 'leftFist') {
      // Clenched left-handed tactical fist (knuckles outward-left/front, fingers curled tight, thumb tucked across)
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.058, 0.050), gloveMat);
      palm.position.set(-0.004, 0, 0.004);
      const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.054, 0.020), knuckleMat);
      knuckle.position.set(-0.020, 0, -0.016);
      handGroup.add(palm, knuckle);

      // 4 fingers tightly balled against inner palm
      for (let i = 0; i < 4; i++) {
        const fy = 0.018 - i * 0.012;
        const fCurl = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.010, 0.022), gloveMat);
        fCurl.position.set(0.002, fy, -0.024);
        const fTuck = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.009, 0.016), skinMat);
        fTuck.position.set(0.018, fy, -0.012);
        handGroup.add(fCurl, fTuck);
      }

      // Thumb folded tightly across the top/front of the curled index finger
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.015, 0.016), gloveMat);
      thumb.position.set(0.004, 0.024, -0.022);
      thumb.rotation.y = 0.25;
      const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.013, 0.014), skinMat);
      thumbTip.position.set(0.022, 0.020, -0.024);
      handGroup.add(thumb, thumbTip);
    }

    // Wrist anchor point
    const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.044, 0.022), cuffMat);
    wrist.position.set(isRight ? 0.008 : -0.010, -0.010, 0.034);
    handGroup.add(wrist);

    return handGroup;
  }

  _createForearm() {
    const armGroup = new THREE.Group();
    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x2f332c });
    const cuffMat = new THREE.MeshLambertMaterial({ color: 0x1a1c19 });

    // Unit-length cylinder along +Z (0..1) so scaling Z stretches from shoulder to wrist
    const sleeveGeo = new THREE.CylinderGeometry(0.030, 0.042, 1.0, 10);
    sleeveGeo.rotateX(Math.PI / 2);
    sleeveGeo.translate(0, 0, 0.5);
    const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);

    const cuffGeo = new THREE.CylinderGeometry(0.031, 0.032, 0.03, 10);
    cuffGeo.rotateX(Math.PI / 2);
    const cuff = new THREE.Mesh(cuffGeo, cuffMat);
    cuff.position.set(0, 0, 0.985);

    armGroup.add(sleeve, cuff);
    return armGroup;
  }

  _aimArm(armGroup, shoulderPos, wristPos) {
    if (!armGroup) return;
    armGroup.position.copy(shoulderPos);
    const dir = wristPos.clone().sub(shoulderPos);
    const len = Math.max(0.05, dir.length());
    armGroup.scale.set(1, 1, len);
    dir.normalize();
    armGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  }

  startDraw(style = 'shoulder_down') {
    this.drawStyle = style;
    this.drawDuration = style === 'shoulder_down' ? 0.44 : 0.38;
    this.drawTimer = this.drawDuration;
  }

  _ensureDownedLegs() {
    if (this.downedLegsGroup || !this.viewmodelCamera) return;
    const root = new THREE.Group();
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2f342d });
    const kneePadMat = new THREE.MeshLambertMaterial({ color: 0x1a1d1f });
    const bootMat = new THREE.MeshLambertMaterial({ color: 0x191a1c });
    const soleMat = new THREE.MeshLambertMaterial({ color: 0x2b2824 });

    const makeLeg = (xOff) => {
      const hip = new THREE.Group();
      hip.position.set(xOff, -0.36, -0.06);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.14, 0.42), pantsMat);
      thigh.position.set(0, -0.02, -0.21);
      const knee = new THREE.Group();
      knee.position.set(0, -0.02, -0.41);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.06, 0.11), kneePadMat);
      pad.position.set(0, 0.065, -0.02);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.125, 0.38), pantsMat);
      shin.position.set(0, -0.04, -0.19);
      shin.rotation.x = -0.16;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.19, 0.14), bootMat);
      boot.position.set(0, -0.02, -0.41);
      boot.rotation.x = 0.25;
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.19, 0.03), soleMat);
      sole.position.set(0, -0.02, -0.485);
      sole.rotation.x = 0.25;
      knee.add(pad, shin, boot, sole);
      hip.add(thigh, knee);
      root.add(hip);
      return { hip, knee };
    };

    const leftLeg = makeLeg(-0.15);
    const rightLeg = makeLeg(0.15);

    // Supporting left arm & gloved hand visible bracing on the ground to push/scoot the body
    const supportArm = new THREE.Group();
    supportArm.position.set(-0.32, -0.22, -0.18);
    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x2f332c });
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.042, 0.34, 8), sleeveMat);
    forearm.rotation.x = Math.PI / 2 - 0.55;
    forearm.position.set(0, -0.08, -0.10);
    const palm = this._createHand(false, 'grip');
    palm.position.set(-0.02, -0.18, -0.22);
    palm.rotation.set(0.55, 0.25, -0.25);
    supportArm.add(forearm, palm);
    root.add(supportArm);

    root.visible = false;
    this.viewmodelCamera.add(root);
    this.downedLegsGroup = root;
    this.downedLegsParts = { leftLeg, rightLeg, supportArm };
  }

  buildViewmodel(weaponDef, mods = {}, withHands = true) {
    this.isMeleeMode = false;
    if (this.meleeMesh) {
      this.viewmodelGroup.remove(this.meleeMesh);
      this.meleeMesh = null;
    }
    if (this.currentMesh) {
      this.viewmodelGroup.remove(this.currentMesh);
      this.currentMesh = null;
    }
    this.spareMagMesh = null;

    const g = new THREE.Group();
    const hasCamo = mods.camo && mods.camo !== 'none';
    const gunMat = this._getCamoMaterial(weaponDef, mods.camo);
    const steelMat = hasCamo ? gunMat : new THREE.MeshLambertMaterial({ color: 0x2a2d30 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x16181a });
    const magMat = new THREE.MeshLambertMaterial({ color: 0x4c5259 });
    const bakeliteMat = new THREE.MeshLambertMaterial({ color: 0x6e3524 });
    const brassMat = new THREE.MeshLambertMaterial({ color: 0xd4a442 });
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x634025 });

    const addTriggerGuard = (zPos, yPos) => {
      const bot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.005, 0.045), darkMat);
      bot.position.set(0, yPos - 0.022, zPos);
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.024, 0.006), darkMat);
      front.position.set(0, yPos - 0.010, zPos - 0.020);
      const trig = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.016, 0.006), steelMat);
      trig.position.set(0, yPos - 0.008, zPos + 0.004);
      trig.rotation.x = 0.3;
      g.add(bot, front, trig);
    };

    if (weaponDef.slot === 'secondary') {
      const isG17 = weaponDef.id === 'g17';
      const slideLen = isG17 ? 0.24 : 0.21;

      // Lower polymer/steel frame + dustcover rail
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.018, slideLen - 0.01), darkMat);
      frame.position.set(0, -0.016, 0.005);

      // Sleek slide with top bevel
      const slideGroup = new THREE.Group();
      const slideMain = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.028, slideLen), isG17 ? darkMat : steelMat);
      const slideTop = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.006, slideLen - 0.01), isG17 ? darkMat : steelMat);
      slideTop.position.set(0, 0.016, 0);
      const barrelCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.022, 10), steelMat);
      barrelCrown.rotation.x = Math.PI / 2;
      barrelCrown.position.set(0, 0.008, -slideLen / 2 - 0.002);
      slideGroup.add(slideMain, slideTop);
      slideGroup.position.set(0, 0.006, 0);
      this.boltMesh = slideGroup;
      this.boltRestPos.copy(slideGroup.position);

      // Angled grip
      const grip = new THREE.Mesh(
        new THREE.BoxGeometry(0.034, 0.112, 0.048),
        isG17 ? darkMat : bakeliteMat
      );
      grip.position.set(0, -0.068, 0.072);
      grip.rotation.x = 0.24;

      addTriggerGuard(0.018, -0.024);

      // Magazine with floorplate & brass top round
      const pistolMag = new THREE.Group();
      const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.105, 0.034), magMat);
      const magPlate = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.012, 0.044), darkMat);
      magPlate.position.set(0, -0.055, 0);
      const magTip = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.012, 0.028), brassMat);
      magTip.position.set(0, 0.056, 0);
      pistolMag.add(magBody, magPlate, magTip);
      pistolMag.position.set(0, -0.082, 0.075);
      pistolMag.rotation.x = 0.24;
      this.magMesh = pistolMag;
      this.magRestPos.copy(pistolMag.position);

      this.rightHand = this._createHand(true, 'grip');
      this.rightHand.position.set(0.0, -0.056, 0.072);

      this.leftHand = this._createHand(false, 'supportPistol');
      this.leftHand.position.set(-0.004, -0.064, 0.068);
      this.leftHandRestPos.copy(this.leftHand.position);
      this.leftHandRestRot.copy(this.leftHand.rotation);

      g.add(frame, barrelCrown, slideGroup, grip, pistolMag, this.rightHand, this.leftHand);

      this.sightHeight = 0.029;
      this.adsZ = -0.32;
      this._addIronSights(
        slideGroup,
        slideLen / 2 - 0.018,
        -slideLen / 2 + 0.016,
        this.sightHeight - slideGroup.position.y,
        0x55ff66
      );

      this.muzzleMesh.position.set(0, 0.01, -slideLen / 2 - 0.03);
      this.muzzleFlash.position.set(0, 0.02, -slideLen / 2 - 0.06);
    } else if (weaponDef.id === 'mp5k') {
      // MP5-K Submachine Gun
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.042, 0.34), steelMat);
      upper.position.set(0, 0.008, 0.02);
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.030, 0.24), darkMat);
      lower.position.set(0, -0.024, 0.06);

      // Iconic MP5 cylindrical cocking tube above barrel
      const cockingTube = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.24, 10), steelMat);
      cockingTube.rotation.x = Math.PI / 2;
      cockingTube.position.set(0, 0.022, -0.14);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.24, 10), darkMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.002, -0.18);

      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.042, 0.14), darkMat);
      handguard.position.set(0, -0.004, -0.14);
      const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.075, 0.034), darkMat);
      foregrip.position.set(0, -0.056, -0.15);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.098, 0.044), darkMat);
      grip.position.set(0, -0.075, 0.13);
      grip.rotation.x = 0.24;
      addTriggerGuard(0.07, -0.038);

      // Curved 9mm stick magazine (2-segment curve)
      const mag = new THREE.Group();
      const magTop = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.085, 0.038), magMat);
      magTop.position.set(0, 0.02, 0);
      const magBot = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.085, 0.038), magMat);
      magBot.position.set(0, -0.055, -0.014);
      magBot.rotation.x = -0.18;
      const magTip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, 0.032), brassMat);
      magTip.position.set(0, 0.068, 0);
      mag.add(magTop, magBot, magTip);
      mag.position.set(0, -0.092, -0.025);
      mag.rotation.x = -0.10;
      this.magMesh = mag;
      this.magRestPos.copy(mag.position);

      const boltHandle = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.016, 0.032),
        new THREE.MeshLambertMaterial({ color: 0x6d747d })
      );
      boltHandle.position.set(-0.026, 0.024, -0.12);
      this.boltMesh = boltHandle;
      this.boltRestPos.copy(boltHandle.position);

      this.rightHand = this._createHand(true, 'grip');
      this.rightHand.position.set(0.0, -0.064, 0.132);
      this.leftHand = this._createHand(false, 'supportPistol');
      this.leftHand.position.set(-0.004, -0.056, -0.15);
      this.leftHandRestPos.copy(this.leftHand.position);
      this.leftHandRestRot.copy(this.leftHand.rotation);

      g.add(upper, lower, cockingTube, barrel, handguard, foregrip, grip, mag, boltHandle, this.rightHand, this.leftHand);

      this.sightHeight = 0.043;
      this.adsZ = -0.26;
      this._addIronSights(g, 0.12, -0.24, this.sightHeight, 0xff8833);
      this.muzzleMesh.position.set(0, 0.005, -0.32);
      this.muzzleFlash.position.set(0, 0.01, -0.36);
    } else if (weaponDef.id === 'ak74m') {
      // AK-74M Assault Rifle
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.054, 0.36), steelMat);
      receiver.position.set(0, -0.002, 0.04);
      const dustCover = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.016, 0.32), darkMat);
      dustCover.position.set(0, 0.028, 0.05);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.44, 10), darkMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.002, -0.34);
      const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.013, 0.06, 10), steelMat);
      muzzleBrake.rotation.x = Math.PI / 2;
      muzzleBrake.position.set(0, 0.002, -0.57);

      const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.24, 8), steelMat);
      gasTube.rotation.x = Math.PI / 2;
      gasTube.position.set(0, 0.024, -0.24);

      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.044, 0.22), woodMat);
      handguard.position.set(0, -0.002, -0.23);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.10, 0.044), bakeliteMat);
      grip.position.set(0, -0.075, 0.14);
      grip.rotation.x = 0.26;
      addTriggerGuard(0.08, -0.032);

      // Curved 5.45 AK magazine
      const mag = new THREE.Group();
      const magTop = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.09, 0.056), bakeliteMat);
      magTop.position.set(0, 0.025, 0);
      const magBot = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.09, 0.054), bakeliteMat);
      magBot.position.set(0, -0.055, -0.018);
      magBot.rotation.x = -0.22;
      const magTip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.014, 0.046), brassMat);
      magTip.position.set(0, 0.074, 0);
      mag.add(magTop, magBot, magTip);
      mag.position.set(0, -0.092, -0.04);
      mag.rotation.x = -0.18;
      this.magMesh = mag;
      this.magRestPos.copy(mag.position);

      const boltHandle = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.014, 0.046), steelMat);
      boltHandle.position.set(0.030, 0.014, -0.02);
      this.boltMesh = boltHandle;
      this.boltRestPos.copy(boltHandle.position);

      this.rightHand = this._createHand(true, 'grip');
      this.rightHand.position.set(0.0, -0.064, 0.142);
      this.leftHand = this._createHand(false, 'supportRifle');
      this.leftHand.position.set(0.0, -0.022, -0.22);
      this.leftHandRestPos.copy(this.leftHand.position);
      this.leftHandRestRot.copy(this.leftHand.rotation);

      this.spareMagMesh = mag.clone();
      this.spareMagMesh.visible = false;

      g.add(receiver, dustCover, barrel, muzzleBrake, gasTube, handguard, grip, mag, this.spareMagMesh, boltHandle, this.rightHand, this.leftHand);

      this.sightHeight = 0.043;
      this.adsZ = -0.26;
      this._addIronSights(g, 0.10, -0.46, this.sightHeight, 0xff8833);
      this.muzzleMesh.position.set(0, 0.004, -0.60);
      this.muzzleFlash.position.set(0, 0.01, -0.64);
    } else if (weaponDef.id === 'm870') {
      // M870 Trench Shotgun
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.056, 0.28), steelMat);
      receiver.position.set(0, 0.0, 0.04);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.52, 10), darkMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.014, -0.34);

      const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.46, 10), steelMat);
      magTube.rotation.x = Math.PI / 2;
      magTube.position.set(0, -0.016, -0.31);

      // Sliding pump forend (acts as boltMesh for pumping)
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.046, 0.18), woodMat);
      pump.position.set(0, -0.016, -0.24);
      this.boltMesh = pump;
      this.boltRestPos.copy(pump.position);

      // Stock grip
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.068, 0.22), woodMat);
      stock.position.set(0, -0.034, 0.24);
      stock.rotation.x = 0.24;
      addTriggerGuard(0.08, -0.028);

      // Visible 12ga shell for reload animation
      const shell = new THREE.Group();
      const shellHull = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.065, 8), new THREE.MeshLambertMaterial({ color: 0xb52b2b }));
      const shellBrass = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0115, 0.018, 8), brassMat);
      shellBrass.position.set(0, -0.032, 0);
      shell.add(shellHull, shellBrass);
      shell.rotation.x = Math.PI / 2;
      shell.position.set(0, -0.032, -0.02);
      this.magMesh = shell;
      this.magRestPos.copy(shell.position);

      this.rightHand = this._createHand(true, 'grip');
      this.rightHand.position.set(0.0, -0.044, 0.145);
      this.leftHand = this._createHand(false, 'supportRifle');
      this.leftHand.position.set(0.0, -0.036, -0.24);
      this.leftHandRestPos.copy(this.leftHand.position);
      this.leftHandRestRot.copy(this.leftHand.rotation);

      g.add(receiver, barrel, magTube, pump, stock, shell, this.rightHand, this.leftHand);

      this.sightHeight = 0.043;
      this.adsZ = -0.26;
      this._addIronSights(g, 0.12, -0.56, this.sightHeight, 0xff8833);
      this.muzzleMesh.position.set(0, 0.014, -0.61);
      this.muzzleFlash.position.set(0, 0.02, -0.65);
    } else {
      // M24 Marksman Bolt-Action Rifle
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.054, 0.44), gunMat);
      chassis.position.set(0, -0.012, -0.02);
      const receiver = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 10), steelMat);
      receiver.rotation.x = Math.PI / 2;
      receiver.position.set(0, 0.016, 0.04);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.50, 10), darkMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.016, -0.36);

      const mag = new THREE.Group();
      const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.085, 0.072), magMat);
      const magTip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, 0.062), brassMat);
      magTip.position.set(0, 0.046, 0);
      mag.add(magBody, magTip);
      mag.position.set(0, -0.068, -0.02);
      this.magMesh = mag;
      this.magRestPos.copy(mag.position);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.095, 0.046), gunMat);
      grip.position.set(0, -0.068, 0.15);
      grip.rotation.x = 0.28;
      addTriggerGuard(0.09, -0.034);

      // Bolt handle with spherical knob
      const boltGroup = new THREE.Group();
      const boltStem = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.009, 0.010), steelMat);
      const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), darkMat);
      boltKnob.position.set(0.020, -0.004, 0);
      boltGroup.add(boltStem, boltKnob);
      boltGroup.position.set(0.024, 0.018, 0.04);
      this.boltMesh = boltGroup;
      this.boltRestPos.copy(boltGroup.position);

      this.rightHand = this._createHand(true, 'grip');
      this.rightHand.position.set(0.0, -0.058, 0.152);
      this.leftHand = this._createHand(false, 'supportRifle');
      this.leftHand.position.set(0.0, -0.030, -0.18);
      this.leftHandRestPos.copy(this.leftHand.position);
      this.leftHandRestRot.copy(this.leftHand.rotation);

      g.add(chassis, receiver, barrel, mag, grip, boltGroup, this.rightHand, this.leftHand);

      this.sightHeight = 0.074;
      this.adsZ = -0.22;
      if (!mods.optic || mods.optic === 'none') {
        this._addScope(g, this.sightHeight, 'lpvo');
      }
      this.muzzleMesh.position.set(0, 0.016, -0.62);
      this.muzzleFlash.position.set(0, 0.02, -0.66);
    }

    if (this.magMesh) this.magRestRot.copy(this.magMesh.rotation);
    if (this.boltMesh) this.boltRestRot.copy(this.boltMesh.rotation);
    if (this.rightHand) {
      this.rightHandRestPos.copy(this.rightHand.position);
      this.rightHandRestRot.copy(this.rightHand.rotation);
    }

    this._attachMods(g, weaponDef, mods, withHands);
    this._attachCosmetics(g, weaponDef, mods);

    this.rightArm = this._createForearm();
    this.leftArm = this._createForearm();
    this.leftFist = this._createHand(false, 'leftFist');
    this.leftFist.visible = false;
    g.add(this.rightArm, this.leftArm, this.leftFist);

    if (withHands && !this.plateRig) {
      // Camera-space Warzone/DMZ Plating Rig (hand + ceramic plate only; vest is worn off-bottom of screen)
      const rig = new THREE.Group();
      rig.visible = false;

      const plateGroup = new THREE.Group();
      const plateBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.135, 0.165, 0.016),
        new THREE.MeshLambertMaterial({ color: 0x222c36 })
      );
      const plateTop = new THREE.Mesh(
        new THREE.BoxGeometry(0.085, 0.026, 0.017),
        new THREE.MeshLambertMaterial({ color: 0x364859 })
      );
      plateTop.position.set(0, 0.092, 0);
      const plateStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.115, 0.015, 0.018),
        new THREE.MeshBasicMaterial({ color: 0x4a90e2 })
      );
      plateStripe.position.set(0, 0.032, 0);
      plateGroup.add(plateBody, plateTop, plateStripe);
      plateGroup.scale.setScalar(1.22);
      plateGroup.visible = false;
      rig.add(plateGroup);
      this.plateMesh = plateGroup;

      const plateHand = this._createHand(false, 'supportPistol');
      plateHand.scale.setScalar(1.25);
      const plateArm = this._createForearm();
      plateArm.scale.set(1.22, 1.22, 1.0);
      rig.add(plateHand, plateArm);

      this.vmCamera.add(rig);
      this.plateRig = rig;
      this.plateHand = plateHand;
      this.plateArm = plateArm;
    }

    if (withHands && !this.medRig) {
      // Camera-space Tactical Field Medkit Rig (matches close-up plating rig)
      const mRig = new THREE.Group();
      mRig.visible = false;

      const boxGroup = new THREE.Group();
      const caseRed = new THREE.MeshLambertMaterial({ color: 0x8f2222 });
      const caseDark = new THREE.MeshLambertMaterial({ color: 0x202428 });
      const foamMat = new THREE.MeshLambertMaterial({ color: 0x16191c });
      const whiteMat = new THREE.MeshLambertMaterial({ color: 0xeceae4 });
      const metalMat = new THREE.MeshLambertMaterial({ color: 0xb0b8c0 });

      // Bottom tray & interior foam insert
      const baseTray = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.024, 0.100), caseRed);
      const foam = new THREE.Mesh(new THREE.BoxGeometry(0.122, 0.008, 0.088), foamMat);
      foam.position.set(0, 0.011, 0);
      // Decorative interior compartments
      const slot1 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.009, 0.068), caseDark);
      slot1.position.set(-0.036, 0.012, 0);
      const slot2 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.009, 0.068), caseDark);
      slot2.position.set(0.002, 0.012, 0);
      const slot3 = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.009, 0.068), caseDark);
      slot3.position.set(0.038, 0.012, 0);
      boxGroup.add(baseTray, foam, slot1, slot2, slot3);

      // Hinged clamshell lid pivoted at back edge (-Z)
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, 0.012, -0.050);
      const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.016, 0.100), caseRed);
      lidMesh.position.set(0, 0.008, 0.050);
      // White medical cross on top of lid
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.003, 0.014), whiteMat);
      crossH.position.set(0, 0.017, 0.050);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.003, 0.044), whiteMat);
      crossV.position.set(0, 0.017, 0.050);
      // Front metal clasp latch
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.016, 0.008), metalMat);
      latch.position.set(0, 0.002, 0.102);
      lidPivot.add(lidMesh, crossH, crossV, latch);
      boxGroup.add(lidPivot);
      boxGroup.scale.setScalar(1.16);
      mRig.add(boxGroup);

      // Item 1: Auto-Injector Stim Syringe
      const stimGroup = new THREE.Group();
      const stimBody = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.088, 10), metalMat);
      const stimFluid = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.044, 10), new THREE.MeshBasicMaterial({ color: 0x3ee885 }));
      stimFluid.position.set(0, -0.005, 0);
      const stimCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.016, 10), new THREE.MeshLambertMaterial({ color: 0xd93838 }));
      stimCap.position.set(0, 0.048, 0);
      const stimNeedle = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.001, 0.024, 6), metalMat);
      stimNeedle.position.set(0, -0.054, 0);
      stimGroup.add(stimBody, stimFluid, stimCap, stimNeedle);
      stimGroup.scale.setScalar(1.22);
      stimGroup.visible = false;
      mRig.add(stimGroup);

      // Item 2: Sterile Field Bandage Roll
      const bandGroup = new THREE.Group();
      const bandRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.054, 12), whiteMat);
      const bandStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.0228, 0.0228, 0.012, 12), new THREE.MeshLambertMaterial({ color: 0xc83232 }));
      bandGroup.add(bandRoll, bandStripe);
      bandGroup.scale.setScalar(1.18);
      bandGroup.visible = false;
      mRig.add(bandGroup);

      // Item 3: Orange Painkiller Pill Bottle
      const pillGroup = new THREE.Group();
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.056, 10), new THREE.MeshLambertMaterial({ color: 0xe67e22 }));
      const pillCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0185, 0.0185, 0.014, 10), whiteMat);
      pillCap.position.set(0, 0.034, 0);
      const pillLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.0176, 0.0176, 0.028, 10), whiteMat);
      pillLabel.position.set(0, -0.002, 0);
      pillGroup.add(bottle, pillCap, pillLabel);
      pillGroup.scale.setScalar(1.22);
      pillGroup.visible = false;
      mRig.add(pillGroup);

      // Dedicated close-up hands & forearms for medkit
      const mLeftHand = this._createHand(false, 'supportRifle');
      mLeftHand.scale.setScalar(1.22);
      const mLeftArm = this._createForearm();
      mLeftArm.scale.set(1.20, 1.20, 1.0);

      const mRightHand = this._createHand(true, 'grip');
      mRightHand.scale.setScalar(1.22);
      const mRightArm = this._createForearm();
      mRightArm.scale.set(1.20, 1.20, 1.0);

      mRig.add(mLeftHand, mLeftArm, mRightHand, mRightArm);
      this.vmCamera.add(mRig);

      this.medRig = mRig;
      this.medBoxGroup = boxGroup;
      this.medLidPivot = lidPivot;
      this.medItems = { stim: stimGroup, bandage: bandGroup, pills: pillGroup };
      this.medLeftHand = mLeftHand;
      this.medLeftArm = mLeftArm;
      this.medRightHand = mRightHand;
      this.medRightArm = mRightArm;
    }

    if (!withHands) {
      if (this.rightHand) this.rightHand.visible = false;
      if (this.leftHand) this.leftHand.visible = false;
      this.rightArm.visible = false;
      this.leftArm.visible = false;
    }

    this.currentMesh = g;
    this.viewmodelGroup.add(g);
    return g;
  }

  buildThirdPersonWeapon(weaponDef, mods = {}) {
    // Snapshot 1st-person viewmodel references so building the 3rd-person prop never mutates them
    const saved = {
      currentMesh: this.currentMesh,
      magMesh: this.magMesh,
      magRestPos: this.magRestPos.clone(),
      magRestRot: this.magRestRot.clone(),
      spareMagMesh: this.spareMagMesh,
      boltMesh: this.boltMesh,
      boltRestPos: this.boltRestPos.clone(),
      boltRestRot: this.boltRestRot.clone(),
      rightHand: this.rightHand,
      leftHand: this.leftHand,
      rightHandRestPos: this.rightHandRestPos.clone(),
      rightHandRestRot: this.rightHandRestRot.clone(),
      leftHandRestPos: this.leftHandRestPos.clone(),
      leftHandRestRot: this.leftHandRestRot.clone(),
      rightArm: this.rightArm,
      leftArm: this.leftArm,
      leftFist: this.leftFist,
      charmPivot: this.charmPivot,
      sightHeight: this.sightHeight,
      adsZ: this.adsZ,
      muzzlePos: this.muzzleMesh.position.clone(),
      flashPos: this.muzzleFlash.position.clone()
    };

    this.currentMesh = null;
    const g = this.buildViewmodel(weaponDef, mods, false);
    this.viewmodelGroup.remove(g);

    const tpData = {
      group: g,
      weaponId: weaponDef.id,
      isPistol: weaponDef.slot === 'secondary',
      magMesh: this.magMesh,
      spareMagMesh: this.spareMagMesh,
      boltMesh: this.boltMesh,
      magRestPos: this.magRestPos.clone(),
      magRestRot: this.magRestRot.clone(),
      boltRestPos: this.boltRestPos.clone(),
      boltRestRot: this.boltRestRot.clone()
    };

    // Restore all 1st-person viewmodel references untouched
    this.currentMesh = saved.currentMesh;
    this.magMesh = saved.magMesh;
    this.magRestPos.copy(saved.magRestPos);
    this.magRestRot.copy(saved.magRestRot);
    this.spareMagMesh = saved.spareMagMesh;
    this.boltMesh = saved.boltMesh;
    this.boltRestPos.copy(saved.boltRestPos);
    this.boltRestRot.copy(saved.boltRestRot);
    this.rightHand = saved.rightHand;
    this.leftHand = saved.leftHand;
    this.rightHandRestPos.copy(saved.rightHandRestPos);
    this.rightHandRestRot.copy(saved.rightHandRestRot);
    this.leftHandRestPos.copy(saved.leftHandRestPos);
    this.leftHandRestRot.copy(saved.leftHandRestRot);
    this.rightArm = saved.rightArm;
    this.leftArm = saved.leftArm;
    this.leftFist = saved.leftFist;
    this.charmPivot = saved.charmPivot;
    this.sightHeight = saved.sightHeight;
    this.adsZ = saved.adsZ;
    this.muzzleMesh.position.copy(saved.muzzlePos);
    this.muzzleFlash.position.copy(saved.flashPos);

    return tpData;
  }

  update(dt, player, weaponDef) {
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.muzzleFlash.intensity = 0;
        this.muzzleMesh.material.opacity = 0;
      }
    }

    // Reload progress & per-weapon unique reload animations
    let reloadPosOffset = { x: 0, y: 0, z: 0 };
    let reloadRotOffset = { x: 0, y: 0, z: 0 };

    if (this.isReloading) {
      this.reloadTimer -= dt;
      const p = THREE.MathUtils.clamp(1 - (this.reloadTimer / this.reloadDuration), 0, 1);
      this._computeReloadPose(p, dt, reloadPosOffset, reloadRotOffset, player);

      // Unique, steady ADS-reload posture: keeps sights/optic shouldered & aimed downrange per weapon!
      if (player && player.isADS && !this.wallBlocked) {
        const env = p < 0.10 ? (p / 0.10) : (p > 0.90 ? (1 - p) / 0.10 : 1);
        const wId = this.reloadWeaponId;
        if (wId === 'm24') {
          // Scope-locked marksman ADS reload: minimal movement so eye stays on the glass
          reloadPosOffset.x = reloadPosOffset.x * 0.12;
          reloadPosOffset.y = reloadPosOffset.y * 0.12 - 0.010 * env;
          reloadPosOffset.z = reloadPosOffset.z * 0.25 + 0.018 * env;
          reloadRotOffset.x *= 0.20;
          reloadRotOffset.y *= 0.14;
          reloadRotOffset.z *= 0.30;
        } else if (wId === 'm870') {
          // Tactical ADS shotgun feed: barrel stays aimed forward, subtle roll to feed bottom port
          reloadPosOffset.x = reloadPosOffset.x * 0.16;
          reloadPosOffset.y = reloadPosOffset.y * 0.16 - 0.022 * env;
          reloadPosOffset.z = reloadPosOffset.z * 0.25 + 0.020 * env;
          reloadRotOffset.x *= 0.22;
          reloadRotOffset.y *= 0.18;
          reloadRotOffset.z *= 0.56;
        } else if (wId === 'pm9' || wId === 'g17') {
          // Eye-level pistol ADS reload: compact 18-deg cant right in sightline
          reloadPosOffset.x = reloadPosOffset.x * 0.22 + 0.015 * env;
          reloadPosOffset.y = reloadPosOffset.y * 0.18 - 0.018 * env;
          reloadPosOffset.z = reloadPosOffset.z * 0.30 + 0.025 * env;
          reloadRotOffset.x *= 0.34;
          reloadRotOffset.y *= 0.26;
          reloadRotOffset.z *= 0.44;
        } else {
          // Compact shouldered ADS reload for MP5-K (H&K slap) & AK-74M (mag-flick)
          reloadPosOffset.x = reloadPosOffset.x * 0.18;
          reloadPosOffset.y = reloadPosOffset.y * 0.15 - 0.020 * env;
          reloadPosOffset.z = reloadPosOffset.z * 0.25 + 0.022 * env;
          reloadRotOffset.x *= 0.30;
          reloadRotOffset.y *= 0.22;
          reloadRotOffset.z *= 0.44;
        }
      }

      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this._resetReloadParts();
        player.finishReload();
      }
    }

    // Downed / Dead State: ALWAYS hide all weapons, plates, medkits & fists! Show 1st-person seated legs + supporting arm when downed!
    this._ensureDownedLegs();
    if (player.isDowned || player.dead) {
      this.viewmodelGroup.visible = false;
      if (this.plateRig) this.plateRig.visible = false;
      if (this.medRig) this.medRig.visible = false;
      if (this.tacFistRig) this.tacFistRig.visible = false;

      if (this.downedLegsGroup) {
        const showDownedLegs = !!(player.isDowned && !player.isThirdPerson);
        this.downedLegsGroup.visible = showDownedLegs;
        if (showDownedLegs) {
          const scootSpd = Math.hypot(player.velocity.x, player.velocity.z);
          const isScooting = scootSpd > 0.15 && !player.beingDragged;
          if (isScooting) {
            this.downedScootCycle += dt * 4.2; // weighty scoot-push cadence
          }
          const sinC = isScooting ? Math.sin(this.downedScootCycle) : 0;
          const cosC = isScooting ? Math.cos(this.downedScootCycle) : 0;
          const heave = isScooting ? Math.pow(Math.max(0, sinC), 1.35) : 0;
          const breathe = Math.sin(performance.now() * 0.0028) * 0.008;
          const p = this.downedLegsParts;

          this.downedLegsGroup.position.y = heave * 0.048 + breathe;
          this.downedLegsGroup.position.z = -heave * 0.035;
          this.downedLegsGroup.rotation.x = -player.pitch * 0.72 - heave * 0.06;
          this.downedLegsGroup.rotation.z = sinC * 0.055;

          if (player.beingDragged) {
            // Relaxed straight legs trailing smoothly as teammate drags you from behind
            p.leftLeg.hip.rotation.x = 0.01;
            p.leftLeg.knee.rotation.x = -0.05;
            p.rightLeg.hip.rotation.x = 0.01;
            p.rightLeg.knee.rotation.x = -0.05;
            if (p.supportArm) {
              p.supportArm.position.set(-0.36, -0.26, -0.14);
              p.supportArm.rotation.x = 0.12;
            }
          } else {
            // Bent left knee plants heel & pulls/pushes while supporting left arm reaches out, plants palm & heaves torso!
            p.leftLeg.hip.rotation.x = 0.24 + heave * 0.18;
            p.leftLeg.knee.rotation.x = -0.44 - heave * 0.26;
            p.rightLeg.hip.rotation.x = 0.12 + heave * 0.10;
            p.rightLeg.knee.rotation.x = -0.24 - heave * 0.14;
            if (p.supportArm) {
              p.supportArm.position.x = -0.32;
              p.supportArm.position.z = -0.20 - cosC * 0.14;
              p.supportArm.position.y = -0.21 - heave * 0.05;
              p.supportArm.rotation.x = -0.10 + sinC * 0.34;
            }
          }
        }
      }
      return;
    } else {
      if (this.downedLegsGroup) this.downedLegsGroup.visible = false;
      if (!this.isThirdPerson && !this.isHealing) {
        this.viewmodelGroup.visible = true;
      }
    }

    // Weapon Draw Animation (shoulder_down from top OR undersling_up from bottom)
    let drawPos = { x: 0, y: 0, z: 0 };
    let drawRot = { x: 0, y: 0, z: 0 };
    if (this.drawTimer > 0) {
      this.drawTimer = Math.max(0, this.drawTimer - dt);
      const t = 1 - (this.drawTimer / (this.drawDuration || 0.42));
      const ease = 1 - Math.pow(1 - t, 3); // smooth cubic ease-out
      const inv = 1 - ease;
      if (this.drawStyle === 'shoulder_down') {
        // Pulled down from over-the-shoulder sling
        drawPos.x = 0.10 * inv;
        drawPos.y = 0.28 * inv;
        drawPos.z = 0.06 * inv;
        drawRot.x = -0.62 * inv;
        drawRot.y = -0.22 * inv;
        drawRot.z = -0.38 * inv;
      } else {
        // Pulled up from underneath / back-under sling
        drawPos.x = 0.06 * inv;
        drawPos.y = -0.32 * inv;
        drawPos.z = 0.08 * inv;
        drawRot.x = 0.65 * inv;
        drawRot.y = 0.20 * inv;
        drawRot.z = 0.30 * inv;
      }
    }

    // Weapon Inspect progress
    let inspectPosOffset = { x: 0, y: 0, z: 0 };
    let inspectRotOffset = { x: 0, y: 0, z: 0 };
    if (this.meleeSwingTimer > 0) {
      this.meleeSwingTimer = Math.max(0, this.meleeSwingTimer - dt);
      const mp = 1 - (this.meleeSwingTimer / (this.meleeSwingDuration || 0.32));
      const arc = Math.sin(mp * Math.PI);
      inspectPosOffset.x = -0.26 * arc;
      inspectPosOffset.y = -0.06 * arc;
      inspectPosOffset.z = -0.18 * arc;
      inspectRotOffset.x = -0.55 * arc;
      inspectRotOffset.y = 0.95 * arc;
      inspectRotOffset.z = 0.72 * arc;
    }
    if (this.isInspecting) {
      if (this.isReloading || player.isADS || player.isSprinting) {
        this.cancelInspect();
      } else {
        this.inspectTimer -= dt;
        const ip = THREE.MathUtils.clamp(1 - (this.inspectTimer / this.inspectDuration), 0, 1);
        this._computeInspectPose(ip, dt, inspectPosOffset, inspectRotOffset);
        if (this.inspectTimer <= 0) {
          this.isInspecting = false;
          this._resetReloadParts();
        }
      }
    }

    // Armor Plate Insertion progress (DMZ style)
    let platePosOffset = { x: 0, y: 0, z: 0 };
    let plateRotOffset = { x: 0, y: 0, z: 0 };
    if (this.isPlating) {
      if (this.isReloading || player.isADS) {
        this.cancelPlating();
      } else {
        this.plateTimer -= dt;
        const pp = THREE.MathUtils.clamp(1 - (this.plateTimer / this.plateDuration), 0, 1);
        this._computePlatePose(pp, dt, platePosOffset, plateRotOffset, player);
        if (this.plateTimer <= 0) {
          this.isPlating = false;
          this._endPlatingVisuals();
          this._resetReloadParts();
        }
      }
    }

    // Field Medkit Use progress (open kit -> 2 random med items -> close & stow)
    let healPosOffset = { x: 0, y: 0, z: 0 };
    let healRotOffset = { x: 0, y: 0, z: 0 };
    if (this.isHealing) {
      if (this.isReloading || player.isADS) {
        this.cancelMedkit();
      } else {
        this.healTimer -= dt;
        const hp = THREE.MathUtils.clamp(1 - (this.healTimer / this.healDuration), 0, 1);
        this._computeHealPose(hp, dt, healPosOffset, healRotOffset, player);
        if (this.healTimer <= 0) {
          this.isHealing = false;
          this._endHealVisuals();
          this._resetReloadParts();
        }
      }
    }

    // Recoil & blowback / pump-action recovery + live dynamic spread (drives both crosshair & hipfire accuracy)
    this.recoilOffset = THREE.MathUtils.lerp(this.recoilOffset, 0, Math.min(1, dt * 14));
    this.boltKick = THREE.MathUtils.lerp(this.boltKick, 0, Math.min(1, dt * 28));
    this.fireBloom = THREE.MathUtils.lerp(this.fireBloom, 0, Math.min(1, dt * 7.5));

    if (weaponDef) {
      const horizSpeed = Math.hypot(player.velocity.x, player.velocity.z);
      const isMoving = horizSpeed > 0.35;
      const moveRatio = Math.min(1.5, horizSpeed / 5.4);
      const stanceMult = player.isProne ? 0.52 : (player.isCrouching ? 0.72 : 1.0);
      const airPenalty = !player.onGround ? 0.032 : 0;
      const slidePenalty = player.isSliding ? 0.018 : 0;

      // Moving expands crosshair & spread; standing still contracts it tightly
      let targetSpread;
      if (weaponDef.hasLaser) {
        // PEQ-15 Laser keeps hipfire tightly stabilized even while moving
        const laserMove = isMoving ? moveRatio * 0.0045 : 0;
        targetSpread = (weaponDef.spread * 0.55 + laserMove + this.fireBloom * 0.45) * stanceMult + airPenalty * 0.35;
      } else {
        const stillFactor = isMoving ? (1.0 + moveRatio * 0.85) : 0.68;
        const moveAdd = isMoving ? moveRatio * 0.020 : 0;
        targetSpread = (weaponDef.spread * stillFactor + moveAdd + slidePenalty + this.fireBloom) * stanceMult + airPenalty;
      }
      this.currentSpread = THREE.MathUtils.lerp(this.currentSpread, targetSpread, Math.min(1, dt * 13));
    }

    let pumpOffset = 0;
    if (!this.isReloading && !this.isInspecting && !this.isPlating && !this.isHealing && weaponDef && weaponDef.id === 'm870') {
      if (this.pumpDelayTimer > 0) {
        this.pumpDelayTimer -= dt;
        if (this.pumpDelayTimer <= 0) {
          this.pumpTimer = this.pumpDuration;
          window.soundEngine.playRechamber();
        }
      } else if (this.pumpTimer > 0) {
        this.pumpTimer = Math.max(0, this.pumpTimer - dt);
        const pt = 1 - (this.pumpTimer / this.pumpDuration);
        const smooth = (t) => t * t * (3 - 2 * t);
        const pull = pt < 0.48 ? smooth(pt / 0.48) : 1 - smooth((pt - 0.48) / 0.52);
        pumpOffset = pull * 0.088;
        if (this.leftHand) {
          this.leftHand.position.set(this.leftHandRestPos.x, this.leftHandRestPos.y, this.leftHandRestPos.z + pumpOffset);
        }
      } else if (this.leftHand) {
        this.leftHand.position.lerp(this.leftHandRestPos, Math.min(1, dt * 24));
      }
    }

    if (!this.isReloading && !this.isInspecting && this.boltMesh) {
      const slotObj = player.getActiveWeaponSlot();
      const lockOpen = weaponDef && weaponDef.slot === 'secondary' && slotObj && slotObj.mag === 0;
      const offset = lockOpen ? 0.052 : (weaponDef && weaponDef.id === 'm870' ? pumpOffset : this.boltKick);
      this.boltMesh.position.z = this.boltRestPos.z + offset;
    }

    // === IMMERSIVE WALL-COLLISION & CORNER-LEAN GUN HANDLING ===
    let targetWallPush = 0;
    if (weaponDef && player.world && player.world.shootableMeshes && !this.isThirdPerson) {
      const baseLen = weaponDef.slot === 'secondary' ? 0.78 : (weaponDef.id === 'mp5k' ? 0.94 : 1.16);
      const barrelLen = baseLen + (weaponDef.suppressed ? 0.14 : 0);

      const camPosW = new THREE.Vector3();
      const camDirW = new THREE.Vector3();
      this.camera.getWorldPosition(camPosW);
      this.camera.getWorldDirection(camDirW);
      const camRightW = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

      const checkRay = (origin) => {
        this._wallRay.set(origin, camDirW);
        this._wallRay.near = 0.05;
        this._wallRay.far = barrelLen;
        const hits = this._wallRay.intersectObjects(player.world.shootableMeshes, false);
        for (const h of hits) {
          // Ignore flat ground hits when looking down
          if (h.face && h.face.normal && h.face.normal.y > 0.85) continue;
          return h.distance;
        }
        return barrelLen;
      };

      // Cast from leaned camera center; if leaning with open space, weapon aligns cleanly with camera!
      const centerDist = checkRay(camPosW);
      const shoulderOff = (player.isADS || Math.abs(player.lean) > 0.35) ? 0.04 : 0.13;
      const sideDist = checkRay(camPosW.clone().addScaledVector(camRightW, shoulderOff));
      const minDist = Math.min(centerDist, sideDist);

      if (minDist < barrelLen) {
        targetWallPush = THREE.MathUtils.clamp((barrelLen - minDist) / (barrelLen * 0.65), 0, 1);
      }
    }
    const wallRate = targetWallPush > this.wallPush ? 16 : 10;
    this.wallPush = THREE.MathUtils.lerp(this.wallPush, targetWallPush, Math.min(1, dt * wallRate));
    this.wallBlocked = this.wallPush > 0.76;

    // Viewmodel positioning (Hipfire vs ADS + Wall Pullback/Tuck + Corner-Lean Alignment + Tactical Sprint)
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    const moving = speed > 0.6 && player.onGround;
    if (moving) {
      const cadence = player.isTacSprinting ? 10.6 : (player.isSprinting ? 8.4 : (player.isCrouching ? 4.2 : 5.6));
      this.bobTimer += dt * cadence;
    } else {
      this.bobTimer += dt * 1.1; // Gentle idle breathing
    }

    const moveFactor = moving ? Math.min(1, speed / 4.5) : 0.15;
    // Allow maintaining ADS while sliding AND while reloading!
    const isAdsActive = player.isADS && !this.wallBlocked && !this.isInspecting && !this.isPlating && !this.isHealing;
    const tacSprintingHip = player.isTacSprinting && !isAdsActive && !this.isReloading && !this.isPlating && !this.isHealing;
    const sprintingHip = player.isSprinting && !tacSprintingHip && !isAdsActive && !this.isReloading && !this.isPlating && !this.isHealing;

    const ampX = isAdsActive ? 0.0012 : (tacSprintingHip ? 0.032 : (sprintingHip ? 0.022 : 0.011));
    const ampY = isAdsActive ? 0.0014 : (tacSprintingHip ? 0.034 : (sprintingHip ? 0.026 : 0.013));
    const bobX = Math.sin(this.bobTimer) * ampX * moveFactor;
    const bobY = Math.pow(Math.abs(Math.sin(this.bobTimer)), 1.6) * ampY * moveFactor;

    const swayRotZ = (moving && !isAdsActive && !this.isReloading && !this.isInspecting && !this.isPlating && !this.isHealing)
      ? Math.cos(this.bobTimer) * (tacSprintingHip ? 0.11 : (sprintingHip ? 0.065 : 0.024)) * moveFactor
      : 0;
    const swayRotX = (moving && !isAdsActive && !this.isReloading && !this.isInspecting && !this.isPlating && !this.isHealing)
      ? -Math.sin(this.bobTimer * 2) * (tacSprintingHip ? 0.065 : (sprintingHip ? 0.045 : 0.016)) * moveFactor
      : 0;

    const activePosOff = this.isReloading ? reloadPosOffset : (this.isPlating ? platePosOffset : (this.isHealing ? healPosOffset : inspectPosOffset));
    const activeRotOff = this.isReloading ? reloadRotOffset : (this.isPlating ? plateRotOffset : (this.isHealing ? healRotOffset : inspectRotOffset));
    const customRot = this.isReloading || this.isInspecting || this.isPlating || this.isHealing || (this.meleeSwingTimer > 0);

    // 2-stage wall handling: Stage 1 pulls weapon smoothly backwards (+Z), Stage 2 tucks barrel up into CQB high-port
    // While actively ADS (not wall-blocked), only pull back along Z so the red dot / iron sights stay 100% zeroed to bullet impact!
    const wp = customRot ? 0 : this.wallPush;
    const tuck = Math.max(0, (wp - 0.42) / 0.58);
    const smoothTuck = tuck * tuck * (3 - 2 * tuck);
    const wallPosX = isAdsActive ? 0 : (-wp * 0.055);
    const wallPosY = isAdsActive ? 0 : (-wp * 0.028 + smoothTuck * 0.022);
    const wallPosZ = isAdsActive ? (wp * 0.08) : (wp * 0.24);
    const wallRotX = isAdsActive ? 0 : (smoothTuck * 0.56);
    const wallRotY = isAdsActive ? 0 : (wp * 0.14 + smoothTuck * 0.26);
    const wallRotZ = isAdsActive ? 0 : (-wp * 0.10 - smoothTuck * 0.16);

    // When leaning around a corner with clearance, progressively cant & align gun around the edge (hipfire only; ADS stays dead-center on camera roll!)
    const leanClear = 1 - Math.min(1, wp * 1.8);
    const leanAlignX = (!customRot && !isAdsActive) ? (-player.lean * 0.095 * leanClear) : 0;
    const leanCantY = (!customRot && !isAdsActive) ? (-player.lean * 0.09 * leanClear) : 0;

    // Sprint tilt, DMZ Tactical Sprint high-port skyward carry, tactical slide cant (subtle when ADS), wall tuck & progressive corner-lean cant
    const slideCantZ = (!customRot && player.isSliding) ? (isAdsActive ? -0.10 : -0.32) : 0;
    const slideCantY = (!customRot && player.isSliding) ? (isAdsActive ? 0.0 : 0.18) : 0;
    const sprintRotX = tacSprintingHip ? 0.86 : (sprintingHip ? -0.14 : 0);
    const sprintRotY = tacSprintingHip ? 0.16 : (sprintingHip ? 0.22 : 0);
    const sprintRotZ = tacSprintingHip ? -0.14 : (sprintingHip ? 0.08 : 0);
    const leanRotZ = isAdsActive ? 0 : (-player.lean * 0.21);
    const targetRotX = (customRot ? activeRotOff.x : (sprintRotX + swayRotX + this.recoilOffset * 1.8 + wallRotX)) + drawRot.x;
    const targetRotY = (customRot ? activeRotOff.y : (sprintRotY + slideCantY + wallRotY + leanCantY)) + drawRot.y;
    const targetRotZ = (customRot ? activeRotOff.z : (sprintRotZ + swayRotZ + slideCantZ + wallRotZ + leanRotZ)) + drawRot.z;

    // MW2/DMZ One-Handed High-Port Tactical Sprint: weapon held UP in right hand, left fist pumping apart!
    // When ADS with any Z-roll (e.g., slide cant), pivot around sightHeight so the red dot stays locked to exact screen center!
    const adsPivotX = (isAdsActive && !customRot) ? (Math.sin(targetRotZ) * this.sightHeight) : 0;
    const adsPivotY = (isAdsActive && !customRot) ? ((1 - Math.cos(targetRotZ)) * this.sightHeight) : 0;
    const basePosX = isAdsActive ? adsPivotX : (tacSprintingHip ? 0.24 : (sprintingHip ? 0.19 : 0.22));
    const basePosY = isAdsActive ? (-this.sightHeight + adsPivotY) : (tacSprintingHip ? -0.14 : (sprintingHip ? -0.235 : -0.20));
    const basePosZ = isAdsActive ? this.adsZ : (tacSprintingHip ? -0.34 : (sprintingHip ? -0.40 : -0.42));

    const targetX = basePosX + activePosOff.x + wallPosX + leanAlignX + drawPos.x;
    const targetY = basePosY + activePosOff.y + wallPosY + drawPos.y;
    const targetZ = basePosZ + this.recoilOffset + activePosOff.z + wallPosZ + drawPos.z;

    const lerpRate = this.isReloading ? 28 : ((this.isPlating || this.isHealing) ? 16 : (this.isInspecting ? 9 : (this.drawTimer > 0 ? 22 : 13)));
    this.viewmodelGroup.position.x = THREE.MathUtils.lerp(this.viewmodelGroup.position.x, targetX + bobX, Math.min(1, dt * lerpRate));
    this.viewmodelGroup.position.y = THREE.MathUtils.lerp(this.viewmodelGroup.position.y, targetY - bobY, Math.min(1, dt * lerpRate));
    this.viewmodelGroup.position.z = THREE.MathUtils.lerp(this.viewmodelGroup.position.z, targetZ, Math.min(1, dt * (lerpRate + 2)));

    const rotRate = this.isReloading ? 26 : ((this.isPlating || this.isHealing) ? 14 : (this.isInspecting ? 8 : 11));
    this.viewmodelGroup.rotation.x = THREE.MathUtils.lerp(this.viewmodelGroup.rotation.x, targetRotX, Math.min(1, dt * rotRate));
    this.viewmodelGroup.rotation.y = THREE.MathUtils.lerp(this.viewmodelGroup.rotation.y, targetRotY, Math.min(1, dt * rotRate));
    this.viewmodelGroup.rotation.z = THREE.MathUtils.lerp(this.viewmodelGroup.rotation.z, targetRotZ, Math.min(1, dt * rotRate));

    // Left-handed clenched fist pumping on the left during Tactical Sprint (positioned cleanly inside FOV)
    if (this.leftHand && !customRot && !(weaponDef && weaponDef.id === 'm870' && this.pumpTimer > 0)) {
      if (tacSprintingHip) {
        const pump = Math.sin(this.bobTimer + Math.PI);
        const pumpCos = Math.cos(this.bobTimer + Math.PI);
        const fistPos = new THREE.Vector3(
          -0.42 + pumpCos * 0.025,
          -0.02 + pump * 0.055,
          -0.12 + pump * 0.075
        );
        this.leftHand.visible = false;
        if (this.leftFist) {
          this.leftFist.visible = true;
          this.leftFist.position.lerp(fistPos, Math.min(1, dt * 16));
          this.leftFist.rotation.x = THREE.MathUtils.lerp(this.leftFist.rotation.x, -0.55 + pump * 0.20, Math.min(1, dt * 16));
          this.leftFist.rotation.y = THREE.MathUtils.lerp(this.leftFist.rotation.y, 0.22, Math.min(1, dt * 16));
          this.leftFist.rotation.z = THREE.MathUtils.lerp(this.leftFist.rotation.z, -0.22, Math.min(1, dt * 16));
        }
        this.leftHand.position.copy(this.leftFist ? this.leftFist.position : fistPos);
      } else {
        this.leftHand.visible = true;
        if (this.leftFist) {
          this.leftFist.visible = false;
          this.leftFist.position.copy(this.leftHand.position);
        }
        this.leftHand.position.lerp(this.leftHandRestPos, Math.min(1, dt * 18));
        this.leftHand.rotation.x = THREE.MathUtils.lerp(this.leftHand.rotation.x, this.leftHandRestRot.x, Math.min(1, dt * 18));
        this.leftHand.rotation.y = THREE.MathUtils.lerp(this.leftHand.rotation.y, this.leftHandRestRot.y, Math.min(1, dt * 18));
        this.leftHand.rotation.z = THREE.MathUtils.lerp(this.leftHand.rotation.z, this.leftHandRestRot.z, Math.min(1, dt * 18));
      }
    } else if (this.leftFist) {
      this.leftFist.visible = false;
    }

    // Sway weapon charm with stride & recoil
    if (this.charmPivot) {
      const targetCharmZ = Math.sin(this.bobTimer) * (moving ? 0.28 : 0.04) + player.lean * 0.15;
      const targetCharmX = Math.cos(this.bobTimer * 2) * (moving ? 0.16 : 0.02) + this.recoilOffset * 2.5;
      this.charmPivot.rotation.z = THREE.MathUtils.lerp(this.charmPivot.rotation.z, targetCharmZ, Math.min(1, dt * 10));
      this.charmPivot.rotation.x = THREE.MathUtils.lerp(this.charmPivot.rotation.x, targetCharmX, Math.min(1, dt * 10));
    }

    // Aim forearms from shoulder anchors to each hand's wrist cuff
    if (this.rightArm && this.rightHand) {
      const rShoulder = new THREE.Vector3(0.16, -0.20, 0.36);
      const rWrist = this.rightHand.position.clone().add(new THREE.Vector3(0.008, -0.010, 0.034));
      this._aimArm(this.rightArm, rShoulder, rWrist);
    }
    if (this.leftArm && this.leftHand) {
      const lShoulder = tacSprintingHip
        ? new THREE.Vector3(-0.62, -0.28, 0.26)
        : new THREE.Vector3(-0.22, -0.20, 0.30);
      const lWrist = this.leftHand.position.clone().add(new THREE.Vector3(-0.010, -0.010, 0.034));
      this._aimArm(this.leftArm, lShoulder, lWrist);
    }

    // FOV ADS zoom & subtle Tactical Sprint FOV burst (respects Settings FOV slider)
    const baseFov = window.BASE_FOV || 75;
    const tacBoost = tacSprintingHip ? 5 : 0;
    const targetFov = (isAdsActive && weaponDef) ? Math.min(baseFov, weaponDef.adsFov) : (baseFov + tacBoost);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 14);
      this.camera.updateProjectionMatrix();
    }

    // Keep 1st-person viewmodels & rigs hidden while in 3rd-person debug camera
    if (this.isThirdPerson) {
      this.viewmodelGroup.visible = false;
      if (this.plateRig) this.plateRig.visible = false;
      if (this.medRig) this.medRig.visible = false;
      if (this.tacFistRig) this.tacFistRig.visible = false;
    }

    // Update particles (impacts & muzzle smoke) & tracers
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.isSmoke) {
        p.mesh.position.addScaledVector(p.vel, dt);
        const s = p.mesh.scale.x + dt * 1.4;
        p.mesh.scale.set(s, s, s);
        p.mesh.material.opacity = Math.max(0, (p.life / p.maxLife) * 0.32);
      } else {
        p.vel.y -= 9.8 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
      }
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.08);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        this.tracers.splice(i, 1);
      }
    }
  }

  _computeReloadPose(p, dt, pos, rot, player = null) {
    const smooth = (t) => t * t * (3 - 2 * t);
    const id = this.reloadWeaponId;
    const handRate = Math.min(1, dt * 22);

    // Exact grip/magwell extraction axis (prevents magazine clipping through angled grips)
    const alongMag = new THREE.Vector3(0, -1, 0).applyEuler(this.magRestRot).normalize();
    const setMagAlong = (distOut, lateralX = 0) => {
      if (!this.magMesh) return;
      this.magMesh.position.copy(this.magRestPos).addScaledVector(alongMag, distOut);
      this.magMesh.position.x += lateralX;
    };
    const handOnMag = (extraDist = 0.03) => {
      if (!this.magMesh || !this.leftHand) return;
      const target = this.magMesh.position.clone().addScaledVector(alongMag, extraDist);
      target.x -= 0.012;
      this.leftHand.position.lerp(target, handRate);
    };

    const moveLeftHand = (x, y, z) => {
      if (this.leftHand) this.leftHand.position.lerp(new THREE.Vector3(x, y, z), handRate);
    };
    const moveRightHand = (x, y, z) => {
      if (this.rightHand) this.rightHand.position.lerp(new THREE.Vector3(x, y, z), handRate);
    };
    const restLeftHand = () => {
      if (this.leftHand) this.leftHand.position.lerp(this.leftHandRestPos, handRate);
    };
    const restRightHand = () => {
      if (this.rightHand) this.rightHand.position.lerp(this.rightHandRestPos, handRate);
    };

    if (id === 'mp5k') {
      // MP5-K: Lock charging handle up -> pull mag straight out -> line up fresh mag -> insert -> H&K slap!
      if (p > 0.06 && !this.reloadSfxFlags.boltLock) {
        this.reloadSfxFlags.boltLock = true;
        window.soundEngine.playRechamber();
      }
      if (p > 0.25 && !this.reloadSfxFlags.magOut) {
        this.reloadSfxFlags.magOut = true;
        window.soundEngine.playMagOut();
      }
      if (p > 0.68 && !this.reloadSfxFlags.magIn) {
        this.reloadSfxFlags.magIn = true;
        window.soundEngine.playMagIn();
      }
      if (p > 0.80 && !this.reloadSfxFlags.rack) {
        this.reloadSfxFlags.rack = true;
        window.soundEngine.playRechamber();
      }

      restRightHand();

      if (p < 0.20) {
        const t = smooth(p / 0.20);
        pos.x = -0.10 * t; pos.y = 0.10 * t;
        rot.x = 0.14 * t; rot.y = -0.24 * t; rot.z = 0.26 * t;
        if (this.boltMesh) {
          this.boltMesh.position.z = this.boltRestPos.z + t * 0.068;
          this.boltMesh.position.y = this.boltRestPos.y + Math.max(0, (t - 0.5) * 2) * 0.016;
          this.boltMesh.rotation.z = Math.max(0, (t - 0.5) * 2) * 0.55;
          moveLeftHand(this.boltMesh.position.x - 0.02, this.boltMesh.position.y, this.boltMesh.position.z + 0.02);
        }
      } else if (p < 0.42) {
        const t = smooth((p - 0.20) / 0.22);
        pos.x = THREE.MathUtils.lerp(-0.10, -0.13, t);
        pos.y = THREE.MathUtils.lerp(0.10, 0.13, t);
        rot.x = THREE.MathUtils.lerp(0.14, 0.34, t);
        rot.y = THREE.MathUtils.lerp(-0.24, 0.36, t);
        rot.z = THREE.MathUtils.lerp(0.26, -0.45, t);
        if (this.boltMesh) {
          this.boltMesh.position.z = this.boltRestPos.z + 0.068;
          this.boltMesh.position.y = this.boltRestPos.y + 0.016;
          this.boltMesh.rotation.z = 0.55;
        }
        if (this.magMesh) {
          setMagAlong(t * 0.22, -Math.max(0, t - 0.65) * 0.06);
          this.magMesh.visible = t < 0.88;
          handOnMag(0.03);
        }
      } else if (p < 0.72) {
        // Methodical line-up (0.42..0.56) -> straight insertion along magwell (0.56..0.72)
        const rawT = (p - 0.42) / 0.30;
        const jolt = rawT > 0.86 ? Math.sin(((rawT - 0.86) / 0.14) * Math.PI) : 0;
        pos.x = -0.13; pos.y = 0.13 + jolt * 0.022;
        rot.x = 0.34 + jolt * 0.08; rot.y = 0.36; rot.z = -0.45;
        if (this.magMesh) {
          this.magMesh.visible = rawT > 0.06;
          if (rawT < 0.45) {
            const alignT = smooth(THREE.MathUtils.clamp((rawT - 0.06) / 0.39, 0, 1));
            setMagAlong(THREE.MathUtils.lerp(0.18, 0.14, alignT), THREE.MathUtils.lerp(-0.055, 0, alignT));
          } else {
            const insT = smooth(THREE.MathUtils.clamp((rawT - 0.45) / 0.45, 0, 1));
            setMagAlong(THREE.MathUtils.lerp(0.14, 0, insT), 0);
          }
          handOnMag(0.03);
        }
      } else if (p < 0.90) {
        const rawT = (p - 0.72) / 0.18;
        const t = smooth(rawT);
        if (this.magMesh) { this.magMesh.visible = true; this.magMesh.position.copy(this.magRestPos); }
        const slapJolt = rawT > 0.45 ? Math.sin(Math.min(1, (rawT - 0.45) / 0.35) * Math.PI) : 0;
        pos.x = THREE.MathUtils.lerp(-0.13, -0.09, t);
        pos.y = THREE.MathUtils.lerp(0.13, 0.08, t) - slapJolt * 0.025;
        rot.x = THREE.MathUtils.lerp(0.34, 0.10, t) - slapJolt * 0.10;
        rot.y = THREE.MathUtils.lerp(0.36, -0.22, t);
        rot.z = THREE.MathUtils.lerp(-0.45, 0.26, t);
        if (this.boltMesh) {
          const snap = rawT < 0.45 ? 0 : smooth((rawT - 0.45) / 0.30);
          this.boltMesh.position.z = THREE.MathUtils.lerp(this.boltRestPos.z + 0.068, this.boltRestPos.z, snap);
          this.boltMesh.position.y = THREE.MathUtils.lerp(this.boltRestPos.y + 0.016, this.boltRestPos.y, snap);
          this.boltMesh.rotation.z = THREE.MathUtils.lerp(0.55, 0, snap);
          moveLeftHand(this.boltMesh.position.x - 0.025, this.boltMesh.position.y + (1 - snap) * 0.04, this.boltMesh.position.z + 0.01);
        }
      } else {
        const t = smooth((p - 0.90) / 0.10);
        if (this.boltMesh) { this.boltMesh.position.copy(this.boltRestPos); this.boltMesh.rotation.copy(this.boltRestRot); }
        restLeftHand();
        pos.x = THREE.MathUtils.lerp(-0.09, 0, t);
        pos.y = THREE.MathUtils.lerp(0.08, 0, t);
        rot.x = THREE.MathUtils.lerp(0.10, 0, t);
        rot.y = THREE.MathUtils.lerp(-0.22, 0, t);
        rot.z = THREE.MathUtils.lerp(0.26, 0, t);
      }
      return;
    }

    if (id === 'ak74m') {
      // AK-74M: New mag (spareMagMesh) strikes paddle release & flicks old mag (magMesh) forward out of seat, then rocks into lock!
      if (p > 0.22 && !this.reloadSfxFlags.magOut) {
        this.reloadSfxFlags.magOut = true;
        window.soundEngine.playMagOut();
      }
      if (p > 0.56 && !this.reloadSfxFlags.magIn) {
        this.reloadSfxFlags.magIn = true;
        window.soundEngine.playMagIn();
      }
      if (this.wasEmptyReload && p > 0.68 && !this.reloadSfxFlags.rack) {
        this.reloadSfxFlags.rack = true;
        window.soundEngine.playRechamber();
      }

      if (p < 0.22) {
        // 1. Bring fresh mag up behind old mag's paddle release
        const t = smooth(p / 0.22);
        restRightHand();
        pos.x = -0.12 * t; pos.y = 0.13 * t; pos.z = -0.02 * t;
        rot.x = 0.28 * t; rot.y = 0.34 * t; rot.z = -0.40 * t;

        if (this.magMesh) {
          this.magMesh.visible = true;
          this.magMesh.position.copy(this.magRestPos);
          this.magMesh.rotation.copy(this.magRestRot);
        }
        if (this.spareMagMesh) {
          this.spareMagMesh.visible = p > 0.04;
          this.spareMagMesh.position.set(
            THREE.MathUtils.lerp(-0.06, -0.01, t),
            THREE.MathUtils.lerp(this.magRestPos.y - 0.16, this.magRestPos.y - 0.05, t),
            THREE.MathUtils.lerp(this.magRestPos.z + 0.12, this.magRestPos.z + 0.08, t)
          );
          this.spareMagMesh.rotation.x = THREE.MathUtils.lerp(-0.35, -0.45, t);
          moveLeftHand(this.spareMagMesh.position.x - 0.01, this.spareMagMesh.position.y - 0.04, this.spareMagMesh.position.z + 0.02);
        }
      } else if (p < 0.38) {
        // 2. Strike paddle & flick old mag forward and out of its seat!
        const t = smooth((p - 0.22) / 0.16);
        restRightHand();
        const flickJolt = Math.sin(t * Math.PI) * 0.018;
        pos.x = -0.12; pos.y = 0.13 + flickJolt; pos.z = -0.02;
        rot.x = 0.28 + flickJolt * 2; rot.y = 0.34; rot.z = -0.40;

        if (this.spareMagMesh) {
          this.spareMagMesh.visible = true;
          // Strike forward slightly, then pause below magwell
          const strike = Math.sin(Math.min(1, t * 1.4) * Math.PI);
          this.spareMagMesh.position.set(
            -0.01,
            this.magRestPos.y - 0.05 - t * 0.04,
            this.magRestPos.z + 0.08 - strike * 0.055
          );
          this.spareMagMesh.rotation.x = THREE.MathUtils.lerp(-0.45, -0.78, t);
          moveLeftHand(this.spareMagMesh.position.x - 0.01, this.spareMagMesh.position.y - 0.04, this.spareMagMesh.position.z + 0.02);
        }
        if (this.magMesh) {
          // Old mag rotates forward (-1.25 rad) and tumbles forward/down out of frame
          this.magMesh.visible = t < 0.88;
          this.magMesh.rotation.x = THREE.MathUtils.lerp(this.magRestRot.x, -1.35, t);
          this.magMesh.position.set(
            this.magRestPos.x,
            this.magRestPos.y - t * t * 0.22,
            this.magRestPos.z - t * 0.16
          );
        }
      } else if (p < 0.60) {
        // 3. Hook front lug of new mag (spareMagMesh) and rock backward into lock!
        const rawT = (p - 0.38) / 0.22;
        const jolt = rawT > 0.82 ? Math.sin(((rawT - 0.82) / 0.18) * Math.PI) : 0;
        restRightHand();
        pos.x = -0.12; pos.y = 0.13 + jolt * 0.025; pos.z = -0.02;
        rot.x = 0.28 + jolt * 0.10; rot.y = 0.34; rot.z = -0.40;
        if (this.magMesh) this.magMesh.visible = false;

        if (this.spareMagMesh) {
          this.spareMagMesh.visible = true;
          const upT = smooth(THREE.MathUtils.clamp(rawT / 0.45, 0, 1));
          const rockInT = smooth(THREE.MathUtils.clamp((rawT - 0.40) / 0.50, 0, 1));
          this.spareMagMesh.position.set(
            THREE.MathUtils.lerp(-0.01, this.magRestPos.x, upT),
            THREE.MathUtils.lerp(this.magRestPos.y - 0.09, this.magRestPos.y, upT),
            THREE.MathUtils.lerp(this.magRestPos.z + 0.02, this.magRestPos.z, rockInT)
          );
          this.spareMagMesh.rotation.x = THREE.MathUtils.lerp(-0.78, this.magRestRot.x, rockInT);
          moveLeftHand(this.spareMagMesh.position.x - 0.01, this.spareMagMesh.position.y - 0.04, this.spareMagMesh.position.z + 0.02);
        }
      } else if (this.wasEmptyReload && p < 0.90) {
        const rawT = (p - 0.60) / 0.30;
        const t = smooth(rawT);
        if (this.spareMagMesh) this.spareMagMesh.visible = false;
        if (this.magMesh) { this.magMesh.visible = true; this.magMesh.position.copy(this.magRestPos); this.magMesh.rotation.copy(this.magRestRot); }
        restLeftHand();

        const pose = Math.sin(Math.min(1, rawT * 1.2) * Math.PI * 0.5);
        const pull = rawT > 0.18 && rawT < 0.60 ? smooth((rawT - 0.18) / 0.42) : (rawT >= 0.60 && rawT < 0.86 ? 1 - smooth((rawT - 0.60) / 0.26) : 0);
        pos.x = THREE.MathUtils.lerp(-0.12, -0.06, t);
        pos.y = THREE.MathUtils.lerp(0.13, 0.06, t) - pull * 0.015;
        pos.z = -0.02 + pull * 0.02;
        rot.x = THREE.MathUtils.lerp(0.28, 0.10, t) + pull * 0.08;
        rot.y = THREE.MathUtils.lerp(0.34, 0.32, pose);
        rot.z = THREE.MathUtils.lerp(-0.40, 0.36, pose);
        if (this.boltMesh) {
          this.boltMesh.position.z = this.boltRestPos.z + pull * 0.085;
          moveRightHand(this.boltMesh.position.x + 0.02, this.boltMesh.position.y - 0.01, this.boltMesh.position.z + 0.02);
        }
      } else {
        const startP = this.wasEmptyReload ? 0.90 : 0.60;
        const t = smooth((p - startP) / (1 - startP));
        if (this.spareMagMesh) this.spareMagMesh.visible = false;
        if (this.magMesh) { this.magMesh.visible = true; this.magMesh.position.copy(this.magRestPos); this.magMesh.rotation.copy(this.magRestRot); }
        if (this.boltMesh) { this.boltMesh.position.copy(this.boltRestPos); }
        restLeftHand();
        restRightHand();
        pos.x = THREE.MathUtils.lerp(this.wasEmptyReload ? -0.06 : -0.12, 0, t);
        pos.y = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.06 : 0.13, 0, t);
        rot.x = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.10 : 0.28, 0, t);
        rot.y = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.32 : 0.34, 0, t);
        rot.z = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.36 : -0.40, 0, t);
      }
      return;
    }

    if (id === 'm870') {
      // M870 Shotgun: Roll to expose bottom port, feed all missing shells (up to 6), then pump if empty
      const loadStart = 0.12;
      const loadEnd = this.wasEmptyReload ? 0.68 : 0.88;
      const count = Math.max(1, this.reloadShellCount);

      if (this.wasEmptyReload && p > 0.72 && !this.reloadSfxFlags.rack) {
        this.reloadSfxFlags.rack = true;
        window.soundEngine.playRechamber();
      }

      restRightHand();

      if (p < loadEnd) {
        const enterT = smooth(Math.min(1, p / loadStart));
        pos.x = -0.11 * enterT; pos.y = 0.13 * enterT;
        rot.x = 0.28 * enterT; rot.y = 0.30 * enterT; rot.z = -0.78 * enterT;

        if (p >= loadStart && this.magMesh) {
          const loadProgress = (p - loadStart) / (loadEnd - loadStart);
          const shellFloat = loadProgress * count;
          const shellIdx = Math.min(count - 1, Math.floor(shellFloat));
          const shellT = shellFloat - shellIdx;

          if (shellT > 0.45 && shellIdx > this.lastShellSoundIdx) {
            this.lastShellSoundIdx = shellIdx;
            window.soundEngine.playMagIn();
          }
          if (shellT > 0.72 && shellIdx > this.lastShellLoadedIdx) {
            this.lastShellLoadedIdx = shellIdx;
            if (player) player.loadSingleShell();
          }

          this.magMesh.visible = shellT < 0.88;
          if (shellT < 0.35) {
            // 1. Bring shell up to loading port, angled upward toward the underbarrel tube
            const alignT = smooth(shellT / 0.35);
            this.magMesh.position.x = THREE.MathUtils.lerp(-0.035, 0.0, alignT);
            this.magMesh.position.y = THREE.MathUtils.lerp(-0.125, -0.052, alignT);
            this.magMesh.position.z = THREE.MathUtils.lerp(0.065, 0.045, alignT);
            this.magMesh.rotation.x = this.magRestRot.x + 0.44;
          } else {
            // 2. Level out horizontally and slide forward (-Z) into the magazine tube under the barrel
            const slideT = smooth(THREE.MathUtils.clamp((shellT - 0.35) / 0.50, 0, 1));
            const levelT = Math.min(1, slideT * 1.8);
            this.magMesh.position.x = 0.0;
            this.magMesh.position.y = THREE.MathUtils.lerp(-0.052, -0.018, levelT);
            this.magMesh.position.z = THREE.MathUtils.lerp(0.045, -0.105, slideT);
            this.magMesh.rotation.x = THREE.MathUtils.lerp(this.magRestRot.x + 0.44, this.magRestRot.x, levelT);
          }
          moveLeftHand(this.magMesh.position.x - 0.01, this.magMesh.position.y - 0.03, this.magMesh.position.z + 0.035);
        } else {
          if (this.magMesh) this.magMesh.visible = false;
          restLeftHand();
        }
      } else if (this.wasEmptyReload && p < 0.90) {
        const rawT = (p - loadEnd) / (0.90 - loadEnd);
        const t = smooth(rawT);
        if (this.magMesh) this.magMesh.visible = false;
        const pull = rawT > 0.20 && rawT < 0.58 ? smooth((rawT - 0.20) / 0.38) : (rawT >= 0.58 && rawT < 0.88 ? 1 - smooth((rawT - 0.58) / 0.30) : 0);
        pos.x = THREE.MathUtils.lerp(-0.11, -0.04, t);
        pos.y = THREE.MathUtils.lerp(0.13, 0.03, t) - pull * 0.012;
        pos.z = pull * 0.025;
        rot.x = THREE.MathUtils.lerp(0.28, 0.05, t);
        rot.y = THREE.MathUtils.lerp(0.30, 0, t);
        rot.z = THREE.MathUtils.lerp(-0.78, 0, t);
        if (this.boltMesh) {
          this.boltMesh.position.z = this.boltRestPos.z + pull * 0.09;
          moveLeftHand(this.leftHandRestPos.x, this.leftHandRestPos.y, this.leftHandRestPos.z + pull * 0.09);
        }
      } else {
        const startP = this.wasEmptyReload ? 0.90 : loadEnd;
        const t = smooth((p - startP) / (1 - startP));
        if (this.magMesh) this.magMesh.visible = false;
        if (this.boltMesh) this.boltMesh.position.copy(this.boltRestPos);
        restLeftHand();
        pos.x = THREE.MathUtils.lerp(this.wasEmptyReload ? -0.04 : -0.11, 0, t);
        pos.y = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.03 : 0.13, 0, t);
        rot.x = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.05 : 0.28, 0, t);
        rot.y = THREE.MathUtils.lerp(0, 0, t);
        rot.z = THREE.MathUtils.lerp(this.wasEmptyReload ? 0 : -0.78, 0, t);
      }
      return;
    }

    if (id === 'm24') {
      // M24 Marksman: Straight-axis box mag (Left Hand) + Right-Handed Bolt Lift, Pull, Push & Lock (Right Hand)
      if (p > 0.08 && !this.reloadSfxFlags.magOut) {
        this.reloadSfxFlags.magOut = true;
        window.soundEngine.playMagOut();
      }
      if (p > 0.52 && !this.reloadSfxFlags.magIn) {
        this.reloadSfxFlags.magIn = true;
        window.soundEngine.playMagIn();
      }
      if (this.wasEmptyReload && p > 0.64 && !this.reloadSfxFlags.rack) {
        this.reloadSfxFlags.rack = true;
        window.soundEngine.playRechamber();
      }

      if (p < 0.26) {
        const t = smooth(p / 0.26);
        restRightHand();
        pos.x = -0.10 * t; pos.y = 0.11 * t;
        rot.x = 0.28 * t; rot.y = 0.28 * t; rot.z = -0.36 * t;
        if (this.magMesh) {
          setMagAlong(t * 0.18, -Math.max(0, t - 0.65) * 0.05);
          this.magMesh.visible = t < 0.88;
          handOnMag(0.03);
        }
      } else if (p < 0.58) {
        // Line up box mag below chassis -> push straight in
        const rawT = (p - 0.26) / 0.32;
        const jolt = rawT > 0.84 ? Math.sin(((rawT - 0.84) / 0.16) * Math.PI) : 0;
        restRightHand();
        pos.x = -0.10; pos.y = 0.11 + jolt * 0.02;
        rot.x = 0.28 + jolt * 0.06; rot.y = 0.28; rot.z = -0.36;
        if (this.magMesh) {
          this.magMesh.visible = rawT > 0.06;
          if (rawT < 0.42) {
            const alignT = smooth(THREE.MathUtils.clamp((rawT - 0.06) / 0.36, 0, 1));
            setMagAlong(THREE.MathUtils.lerp(0.16, 0.11, alignT), THREE.MathUtils.lerp(-0.045, 0, alignT));
          } else {
            const insT = smooth(THREE.MathUtils.clamp((rawT - 0.42) / 0.45, 0, 1));
            setMagAlong(THREE.MathUtils.lerp(0.11, 0, insT), 0);
          }
          handOnMag(0.03);
        }
      } else if (this.wasEmptyReload && p < 0.90) {
        const rawT = (p - 0.58) / 0.32;
        const t = smooth(rawT);
        if (this.magMesh) { this.magMesh.visible = true; this.magMesh.position.copy(this.magRestPos); }
        restLeftHand();

        let lift = 0, pull = 0;
        if (rawT < 0.22) lift = smooth(rawT / 0.22);
        else if (rawT < 0.82) lift = 1;
        else lift = 1 - smooth((rawT - 0.82) / 0.18);

        if (rawT >= 0.22 && rawT < 0.55) pull = smooth((rawT - 0.22) / 0.33);
        else if (rawT >= 0.55 && rawT < 0.82) pull = 1 - smooth((rawT - 0.55) / 0.27);

        pos.x = THREE.MathUtils.lerp(-0.10, -0.05, t);
        pos.y = THREE.MathUtils.lerp(0.11, 0.04, t);
        rot.x = THREE.MathUtils.lerp(0.28, 0.06, t);
        rot.y = THREE.MathUtils.lerp(0.28, 0.26, t);
        rot.z = THREE.MathUtils.lerp(-0.36, 0.28, t);
        if (this.boltMesh) {
          this.boltMesh.rotation.z = lift * 0.72;
          this.boltMesh.position.z = this.boltRestPos.z + pull * 0.085;
          moveRightHand(this.boltMesh.position.x + 0.02, this.boltMesh.position.y + lift * 0.025, this.boltMesh.position.z + 0.02);
        }
      } else {
        const startP = this.wasEmptyReload ? 0.90 : 0.58;
        const t = smooth((p - startP) / (1 - startP));
        if (this.magMesh) { this.magMesh.visible = true; this.magMesh.position.copy(this.magRestPos); }
        if (this.boltMesh) { this.boltMesh.position.copy(this.boltRestPos); this.boltMesh.rotation.copy(this.boltRestRot); }
        restLeftHand();
        restRightHand();
        pos.x = THREE.MathUtils.lerp(this.wasEmptyReload ? -0.05 : -0.10, 0, t);
        pos.y = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.04 : 0.11, 0, t);
        rot.x = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.06 : 0.28, 0, t);
        rot.y = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.26 : 0.28, 0, t);
        rot.z = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.28 : -0.36, 0, t);
      }
      return;
    }

    // Sidearms ('g17' & 'pm9'): Pull mag straight along angled grip axis -> line up fresh mag below grip -> push straight up!
    const isG17 = id === 'g17';
    if (p > 0.08 && !this.reloadSfxFlags.magOut) {
      this.reloadSfxFlags.magOut = true;
      window.soundEngine.playMagOut();
    }
    if (p > 0.54 && !this.reloadSfxFlags.magIn) {
      this.reloadSfxFlags.magIn = true;
      window.soundEngine.playMagIn();
    }
    if (this.wasEmptyReload && p > 0.64 && !this.reloadSfxFlags.rack) {
      this.reloadSfxFlags.rack = true;
      window.soundEngine.playRechamber();
    }

    restRightHand();

    // Keep pistol slide visibly locked back during mag swap if empty
    if (this.wasEmptyReload && this.boltMesh && p < 0.58) {
      this.boltMesh.position.z = this.boltRestPos.z + 0.052;
    }

    if (p < 0.26) {
      const t = smooth(p / 0.26);
      pos.x = -0.14 * t; pos.y = 0.13 * t; pos.z = -0.04 * t;
      rot.x = (isG17 ? 0.42 : 0.34) * t;
      rot.y = (isG17 ? 0.48 : 0.38) * t;
      rot.z = (isG17 ? -0.62 : -0.48) * t;

      if (this.magMesh) {
        const dropT = Math.max(0, (p / 0.26 - (isG17 ? 0.05 : 0.12)) / (isG17 ? 0.75 : 0.88));
        setMagAlong(Math.min(1, dropT) * 0.22, -Math.max(0, dropT - 0.65) * 0.05);
        this.magMesh.visible = dropT < 0.88;
        handOnMag(0.03);
      }
    } else if (p < 0.58) {
      // Methodical 2-step insertion: (0..0.44) line up mag tip right below grip mouth, (0.44..0.88) push straight up into grip!
      const rawT = (p - 0.26) / 0.32;
      const jolt = rawT > 0.86 ? Math.sin(((rawT - 0.86) / 0.14) * Math.PI) : 0;
      pos.x = -0.14; pos.y = 0.13 + jolt * 0.026; pos.z = -0.04 - jolt * 0.012;
      rot.x = (isG17 ? 0.42 : 0.34) + jolt * 0.10;
      rot.y = isG17 ? 0.48 : 0.38;
      rot.z = isG17 ? -0.62 : -0.48;

      if (this.magMesh) {
        this.magMesh.visible = rawT > 0.06;
        if (rawT < 0.44) {
          const alignT = smooth(THREE.MathUtils.clamp((rawT - 0.06) / 0.38, 0, 1));
          setMagAlong(THREE.MathUtils.lerp(0.18, 0.13, alignT), THREE.MathUtils.lerp(-0.05, 0, alignT));
        } else {
          const insT = smooth(THREE.MathUtils.clamp((rawT - 0.44) / 0.44, 0, 1));
          setMagAlong(THREE.MathUtils.lerp(0.13, 0, insT), 0);
        }
        handOnMag(0.03);
      }
    } else if (this.wasEmptyReload && p < 0.90) {
      const rawT = (p - 0.58) / 0.32;
      const t = smooth(rawT);
      if (this.magMesh) { this.magMesh.visible = true; this.magMesh.position.copy(this.magRestPos); }

      const rackPose = Math.sin(Math.min(1, rawT * 1.15) * Math.PI * 0.5);
      // Slide is already locked back (0.052): slight slingshot pull (0.052 -> 0.064), then snap forward (0.064 -> 0.0)
      let slideOffset = 0.052;
      let nudge = 0;
      if (rawT < 0.25) {
        slideOffset = 0.052;
      } else if (rawT < 0.50) {
        nudge = smooth((rawT - 0.25) / 0.25);
        slideOffset = 0.052 + nudge * 0.012;
      } else if (rawT < 0.72) {
        const snap = smooth((rawT - 0.50) / 0.22);
        slideOffset = THREE.MathUtils.lerp(0.064, 0.0, snap);
      } else {
        slideOffset = 0.0;
      }

      pos.x = THREE.MathUtils.lerp(-0.14, -0.10, t);
      pos.y = THREE.MathUtils.lerp(0.13, 0.08, t) - nudge * 0.008;
      pos.z = THREE.MathUtils.lerp(-0.04, -0.02, t) + nudge * 0.012;
      rot.x = THREE.MathUtils.lerp(isG17 ? 0.42 : 0.34, 0.14, t) + nudge * 0.04;
      rot.y = THREE.MathUtils.lerp(isG17 ? 0.48 : 0.38, -0.34, rackPose);
      rot.z = THREE.MathUtils.lerp(isG17 ? -0.62 : -0.48, 0.36, rackPose);

      if (this.boltMesh) {
        this.boltMesh.position.z = this.boltRestPos.z + slideOffset;
        moveLeftHand(this.boltMesh.position.x - 0.028, this.boltMesh.position.y - 0.01, this.boltMesh.position.z + 0.02);
      }
    } else {
      const startP = this.wasEmptyReload ? 0.90 : 0.58;
      const t = smooth(THREE.MathUtils.clamp((p - startP) / (1 - startP), 0, 1));
      if (this.magMesh) { this.magMesh.visible = true; this.magMesh.position.copy(this.magRestPos); }
      if (this.boltMesh) { this.boltMesh.position.copy(this.boltRestPos); }
      restLeftHand();
      pos.x = THREE.MathUtils.lerp(this.wasEmptyReload ? -0.10 : -0.14, 0, t);
      pos.y = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.08 : 0.13, 0, t);
      pos.z = THREE.MathUtils.lerp(this.wasEmptyReload ? -0.02 : -0.04, 0, t);
      rot.x = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.14 : (isG17 ? 0.42 : 0.34), 0, t);
      rot.y = THREE.MathUtils.lerp(this.wasEmptyReload ? -0.34 : (isG17 ? 0.48 : 0.38), 0, t);
      rot.z = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.36 : (isG17 ? -0.62 : -0.48), 0, t);
    }
  }

  _resetReloadParts() {
    if (this.magMesh) {
      this.magMesh.visible = true;
      this.magMesh.position.copy(this.magRestPos);
      this.magMesh.rotation.copy(this.magRestRot);
    }
    if (this.spareMagMesh) {
      this.spareMagMesh.visible = false;
    }
    if (this.boltMesh) {
      this.boltMesh.position.copy(this.boltRestPos);
      this.boltMesh.rotation.copy(this.boltRestRot);
    }
    if (this.leftHand) {
      this.leftHand.position.copy(this.leftHandRestPos);
      this.leftHand.rotation.copy(this.leftHandRestRot);
    }
    if (this.rightHand) {
      this.rightHand.position.copy(this.rightHandRestPos);
      this.rightHand.rotation.copy(this.rightHandRestRot);
    }
  }

  _computeInspectPose(p, dt, pos, rot) {
    const smoother = (t) => {
      const c = THREE.MathUtils.clamp(t, 0, 1);
      return c * c * c * (c * (c * 6 - 15) + 10);
    };
    const id = this.inspectWeaponId;
    const handRate = Math.min(1, dt * 11);

    const moveLeftHand = (x, y, z) => {
      if (this.leftHand) this.leftHand.position.lerp(new THREE.Vector3(x, y, z), handRate);
    };
    const moveRightHand = (x, y, z) => {
      if (this.rightHand) this.rightHand.position.lerp(new THREE.Vector3(x, y, z), handRate);
    };
    const restHands = () => {
      if (this.leftHand) this.leftHand.position.lerp(this.leftHandRestPos, handRate);
      if (this.rightHand) this.rightHand.position.lerp(this.rightHandRestPos, handRate);
    };

    // Fluid 5.2s envelope: slow lift (0..0.20), admire left (0.20..0.46), smooth roll (0.46..0.64), admire right (0.64..0.85), settle (0.85..1.0)
    const enter = p < 0.20 ? smoother(p / 0.20) : (p > 0.85 ? 1 - smoother((p - 0.85) / 0.15) : 1);
    const flip = p < 0.44 ? 0 : (p < 0.64 ? smoother((p - 0.44) / 0.20) : (p > 0.85 ? 1 - smoother((p - 0.85) / 0.15) : 1));
    const drift = Math.sin(p * Math.PI * 2.0) * 0.012 * enter;
    const tiltDrift = Math.sin(p * Math.PI * 3.0) * 0.045 * enter;

    if (id === 'pm9') {
      pos.x = (-0.14 + drift) * enter;
      pos.y = (0.10 + drift * 0.5) * enter;
      pos.z = -0.02 * enter;
      rot.x = (THREE.MathUtils.lerp(0.18, 0.24, flip) + tiltDrift) * enter;
      rot.y = THREE.MathUtils.lerp(-0.55, 0.52, flip) * enter;
      rot.z = THREE.MathUtils.lerp(0.60, -0.56, flip) * enter;

      if (this.boltMesh) {
        const check = (p > 0.24 && p < 0.42) ? Math.pow(Math.sin(((p - 0.24) / 0.18) * Math.PI), 1.4) : 0;
        this.boltMesh.position.z = this.boltRestPos.z + check * 0.026;
        if (p > 0.20 && p < 0.44) {
          moveLeftHand(this.boltMesh.position.x - 0.025, this.boltMesh.position.y, this.boltMesh.position.z + 0.01);
        } else {
          restHands();
        }
      }
      return;
    }

    if (id === 'g17') {
      pos.x = (-0.15 + drift) * enter;
      pos.y = (0.11 + drift * 0.5) * enter;
      pos.z = -0.03 * enter;
      rot.x = (THREE.MathUtils.lerp(0.24, 0.16, flip) + tiltDrift) * enter;
      rot.y = THREE.MathUtils.lerp(-0.60, 0.54, flip) * enter;
      rot.z = THREE.MathUtils.lerp(0.68, -0.58, flip) * enter;

      if (this.magMesh) {
        const magCheck = (p > 0.22 && p < 0.44) ? Math.pow(Math.sin(((p - 0.22) / 0.22) * Math.PI), 1.3) : 0;
        const alongMag = new THREE.Vector3(0, -1, 0).applyEuler(this.magRestRot).normalize();
        this.magMesh.position.copy(this.magRestPos).addScaledVector(alongMag, magCheck * 0.055);
        if (p > 0.18 && p < 0.46) {
          const t = this.magMesh.position.clone().addScaledVector(alongMag, 0.03);
          moveLeftHand(t.x - 0.01, t.y, t.z);
        } else {
          restHands();
        }
      }
      return;
    }

    if (id === 'mp5k') {
      pos.x = (-0.12 + drift) * enter;
      pos.y = (0.09 + drift * 0.5) * enter;
      pos.z = -0.02 * enter;
      rot.x = (THREE.MathUtils.lerp(0.16, 0.22, flip) + tiltDrift) * enter;
      rot.y = THREE.MathUtils.lerp(-0.60, 0.46, flip) * enter;
      rot.z = THREE.MathUtils.lerp(0.48, -0.40, flip) * enter;
      restHands();
      return;
    }

    if (id === 'ak74m') {
      pos.x = (-0.12 + drift) * enter;
      pos.y = (0.09 + drift * 0.5) * enter;
      pos.z = 0.02 * enter;
      rot.x = (THREE.MathUtils.lerp(0.18, 0.14, flip) + tiltDrift) * enter;
      rot.y = THREE.MathUtils.lerp(-0.62, 0.44, flip) * enter;
      rot.z = THREE.MathUtils.lerp(0.48, -0.44, flip) * enter;

      const check = (p > 0.62 && p < 0.82) ? Math.pow(Math.sin(((p - 0.62) / 0.20) * Math.PI), 1.4) : 0;
      if (this.boltMesh) {
        this.boltMesh.position.z = this.boltRestPos.z + check * 0.045;
        if (p > 0.58 && p < 0.84) {
          moveRightHand(this.boltMesh.position.x + 0.02, this.boltMesh.position.y - 0.01, this.boltMesh.position.z + 0.02);
        } else {
          restHands();
        }
      }
      return;
    }

    if (id === 'm870') {
      pos.x = (-0.12 + drift) * enter;
      pos.y = (0.09 + drift * 0.5) * enter;
      pos.z = 0.02 * enter;
      rot.x = (THREE.MathUtils.lerp(0.14, 0.22, flip) + tiltDrift) * enter;
      rot.y = THREE.MathUtils.lerp(-0.60, 0.36, flip) * enter;
      rot.z = THREE.MathUtils.lerp(0.44, -0.68, flip) * enter;

      const check = (p > 0.62 && p < 0.82) ? Math.pow(Math.sin(((p - 0.62) / 0.20) * Math.PI), 1.4) : 0;
      if (this.boltMesh) {
        this.boltMesh.position.z = this.boltRestPos.z + check * 0.05;
        if (p > 0.58 && p < 0.84) {
          moveLeftHand(this.leftHandRestPos.x, this.leftHandRestPos.y, this.leftHandRestPos.z + check * 0.05);
        } else {
          restHands();
        }
      }
      return;
    }

    // M24 Marksman
    pos.x = (-0.11 + drift) * enter;
    pos.y = (0.08 + drift * 0.5) * enter;
    pos.z = 0.02 * enter;
    rot.x = (THREE.MathUtils.lerp(0.14, 0.10, flip) + tiltDrift) * enter;
    rot.y = THREE.MathUtils.lerp(-0.56, 0.38, flip) * enter;
    rot.z = THREE.MathUtils.lerp(0.42, -0.32, flip) * enter;

    const check = (p > 0.62 && p < 0.82) ? Math.pow(Math.sin(((p - 0.62) / 0.20) * Math.PI), 1.4) : 0;
    if (this.boltMesh) {
      this.boltMesh.rotation.z = check * 0.62;
      this.boltMesh.position.z = this.boltRestPos.z + check * 0.032;
      if (p > 0.58 && p < 0.84) {
        moveRightHand(this.boltMesh.position.x + 0.02, this.boltMesh.position.y + check * 0.02, this.boltMesh.position.z + 0.02);
      } else {
        restHands();
      }
    }
  }

  _computePlatePose(p, dt, pos, rot, player = null) {
    const smooth = (t) => t * t * (3 - 2 * t);
    const handRate = Math.min(1, dt * 14);

    const count = Math.max(1, this.platesToInsert);
    const grabOpenEnd = 0.08;
    const unzipEnd = 0.27;
    const zipStart = 0.77;
    const grabCloseEnd = 0.81;
    const zipEnd = 0.94;

    // Lower & cant weapon down-right out of the way
    const env = p < 0.09 ? smooth(p / 0.09) : (p > 0.91 ? 1 - smooth((p - 0.91) / 0.09) : 1);
    pos.x = 0.18 * env;
    pos.y = -0.18 * env;
    pos.z = 0.06 * env;
    rot.x = -0.36 * env;
    rot.y = -0.36 * env;
    rot.z = -0.26 * env;

    if (this.leftHand) this.leftHand.visible = false;
    if (this.leftArm) this.leftArm.visible = false;
    if (this.plateRig) this.plateRig.visible = true;

    let handTarget = new THREE.Vector3(0.13, -0.14, -0.24);
    let handRotTarget = new THREE.Euler(-0.35, -0.15, -1.45);

    if (p < grabOpenEnd) {
      // === STEP 1: REACH TO LOWER-RIGHT COLLAR TO GRAB ZIPPER FROM ABOVE ===
      const t = smooth(p / grabOpenEnd);
      if (this.plateMesh) this.plateMesh.visible = false;
      handTarget.set(
        THREE.MathUtils.lerp(-0.08, 0.13, t),
        THREE.MathUtils.lerp(-0.24, -0.135, t),
        -0.24
      );
      handRotTarget.set(-0.35, -0.25, -1.45);
    } else if (p < unzipEnd) {
      // === STEP 2: UNZIP RIGHT-TO-LEFT ACROSS BOTTOM OF SCREEN (PALM DOWN) ===
      const rawT = (p - grabOpenEnd) / (unzipEnd - grabOpenEnd);
      const pullT = smooth(Math.min(1, rawT / 0.82)); // 0.82..1.00 is a brief hold/beat after unzip
      if (rawT > 0.04 && !this.plateZipFlags.open) {
        this.plateZipFlags.open = true;
        window.soundEngine.playZipper(false);
      }
      if (this.plateMesh) this.plateMesh.visible = false;
      handTarget.set(
        THREE.MathUtils.lerp(0.13, -0.14, pullT),
        -0.135 + Math.sin(pullT * Math.PI) * 0.012,
        -0.24
      );
      handRotTarget.set(-0.35, -0.25 + pullT * 0.45, -1.45);
    } else if (p < zipStart) {
      // === STEP 3: DISTINCT PER-PLATE REACH → PRESENT → HOLD → SHOVE IN ===
      const loadProg = (p - unzipEnd) / (zipStart - unzipEnd);
      const plateFloat = loadProg * count;
      const plateIdx = Math.min(count - 1, Math.floor(plateFloat));
      const pt = plateFloat - plateIdx;

      if (pt > 0.56 && plateIdx > this.lastPlateSoundIdx) {
        this.lastPlateSoundIdx = plateIdx;
        window.soundEngine.playPlateInsert();
      }
      if (pt > 0.82 && plateIdx > this.lastPlateInsertedIdx) {
        this.lastPlateInsertedIdx = plateIdx;
        if (player) player.insertSinglePlate();
      }

      // Tactile body thud as plate bottoms out into vest
      const thud = (pt > 0.76 && pt < 0.90) ? Math.sin(((pt - 0.76) / 0.14) * Math.PI) : 0;
      pos.y -= thud * 0.018;
      rot.x -= thud * 0.045;

      if (this.plateMesh) {
        if (pt < 0.14) {
          // Beat A: Dip hand down-left to grab fresh ceramic plate from top edge
          this.plateMesh.visible = false;
          handTarget.set(-0.20, -0.22, -0.25);
          handRotTarget.set(-0.25, 0.25, -1.52);
        } else if (pt < 0.44) {
          // Beat B: Lift & align plate upright right over the chest carrier slot
          const t = smooth((pt - 0.14) / 0.30);
          this.plateMesh.visible = true;
          this.plateMesh.position.set(
            THREE.MathUtils.lerp(-0.20, 0.0, t),
            THREE.MathUtils.lerp(-0.26, -0.075, t),
            THREE.MathUtils.lerp(-0.27, -0.26, t)
          );
          this.plateMesh.rotation.set(
            THREE.MathUtils.lerp(0.20, -0.18, t),
            THREE.MathUtils.lerp(0.45, 0.04, t),
            THREE.MathUtils.lerp(-0.25, 0.0, t)
          );
          handTarget.set(
            this.plateMesh.position.x,
            this.plateMesh.position.y + 0.112,
            this.plateMesh.position.z + 0.015
          );
          handRotTarget.set(-0.18, 0.04, -Math.PI / 2);
        } else if (pt < 0.54) {
          // Beat C: Brief alignment beat right at the lip of the pouch
          this.plateMesh.visible = true;
          this.plateMesh.position.set(0.0, -0.075, -0.26);
          this.plateMesh.rotation.set(-0.18, 0.04, 0.0);
          handTarget.set(0.0, 0.037, -0.245);
          handRotTarget.set(-0.18, 0.04, -Math.PI / 2);
        } else if (pt < 0.86) {
          // Beat D: Two-stage vertical slide straight down into the tight carrier slot
          const raw = (pt - 0.54) / 0.32;
          // Slight snug resistance catch halfway down, then firm final push to seat
          let slideT;
          if (raw < 0.45) {
            slideT = smooth(raw / 0.45) * 0.44;
          } else if (raw < 0.60) {
            slideT = 0.44 + ((raw - 0.45) / 0.15) * 0.04;
          } else {
            slideT = 0.48 + smooth((raw - 0.60) / 0.40) * 0.52;
          }
          this.plateMesh.visible = slideT < 0.96;
          this.plateMesh.position.set(
            0.0,
            THREE.MathUtils.lerp(-0.075, -0.30, slideT),
            THREE.MathUtils.lerp(-0.26, -0.295, slideT)
          );
          this.plateMesh.rotation.set(-0.18, 0.04, 0.0);
          handTarget.set(
            0.0,
            this.plateMesh.position.y + 0.112,
            this.plateMesh.position.z + 0.015
          );
          handRotTarget.set(-0.22 - slideT * 0.15, 0.04, -Math.PI / 2);
        } else {
          // Beat E: Brief settle pause before next plate or zipping up
          this.plateMesh.visible = false;
          handTarget.set(-0.04, -0.20, -0.24);
          handRotTarget.set(-0.35, 0.08, -1.48);
        }
      }
    } else if (p < grabCloseEnd) {
      // === STEP 4A: REPOSITION HAND TO LOWER-LEFT ZIPPER PULL (PALM DOWN) ===
      const t = smooth((p - zipStart) / (grabCloseEnd - zipStart));
      if (this.plateMesh) this.plateMesh.visible = false;
      handTarget.set(
        THREE.MathUtils.lerp(-0.04, -0.14, t),
        THREE.MathUtils.lerp(-0.20, -0.135, t),
        -0.24
      );
      handRotTarget.set(-0.35, 0.20, -1.45);
    } else if (p < zipEnd) {
      // === STEP 4B: ZIP LEFT-TO-RIGHT ACROSS BOTTOM OF SCREEN (PALM DOWN) ===
      const zipT = smooth((p - grabCloseEnd) / (zipEnd - grabCloseEnd));
      if (zipT > 0.04 && !this.plateZipFlags.close) {
        this.plateZipFlags.close = true;
        window.soundEngine.playZipper(true);
      }
      if (this.plateMesh) this.plateMesh.visible = false;
      handTarget.set(
        THREE.MathUtils.lerp(-0.14, 0.13, zipT),
        -0.135 + Math.sin(zipT * Math.PI) * 0.012,
        -0.24
      );
      handRotTarget.set(-0.35, 0.20 - zipT * 0.45, -1.45);
    } else {
      // === STEP 5: DROP HAND & RETURN TO WEAPON ===
      const exitT = smooth((p - zipEnd) / (1 - zipEnd));
      if (this.plateMesh) this.plateMesh.visible = false;
      handTarget.set(
        THREE.MathUtils.lerp(0.13, 0.02, exitT),
        THREE.MathUtils.lerp(-0.135, -0.28, exitT),
        -0.24
      );
      handRotTarget.set(-0.35, -0.25, -1.45);
    }

    if (this.plateHand && this.plateArm) {
      this.plateHand.position.lerp(handTarget, handRate);
      this.plateHand.rotation.x = THREE.MathUtils.lerp(this.plateHand.rotation.x, handRotTarget.x, handRate);
      this.plateHand.rotation.y = THREE.MathUtils.lerp(this.plateHand.rotation.y, handRotTarget.y, handRate);
      this.plateHand.rotation.z = THREE.MathUtils.lerp(this.plateHand.rotation.z, handRotTarget.z, handRate);
      const lShoulder = new THREE.Vector3(-0.28, -0.28, -0.02);
      const lWrist = this.plateHand.position.clone().add(new THREE.Vector3(-0.01, 0.005, 0.042));
      this._aimArm(this.plateArm, lShoulder, lWrist);
    }
  }

  _endPlatingVisuals() {
    if (this.plateRig) this.plateRig.visible = false;
    if (this.plateMesh) this.plateMesh.visible = false;
    if (this.leftHand) this.leftHand.visible = true;
    if (this.leftArm) this.leftArm.visible = true;
  }

  startPlating(platesToInsert = 1) {
    if (this.isReloading || this.isPlating || this.isHealing) return false;
    this.cancelInspect();
    this.isPlating = true;
    this.platesToInsert = Math.max(1, platesToInsert);
    this.plateDuration = 1.65 + this.platesToInsert * 1.45;
    this.plateTimer = this.plateDuration;
    this.lastPlateSoundIdx = -1;
    this.lastPlateInsertedIdx = -1;
    this.plateZipFlags = { open: false, close: false };
    if (this.plateHand) {
      this.plateHand.position.set(-0.08, -0.24, -0.24);
      this.plateHand.rotation.set(-0.35, -0.25, -1.45);
    }
    return true;
  }

  cancelPlating() {
    if (!this.isPlating) return;
    this.isPlating = false;
    this.plateTimer = 0;
    this._endPlatingVisuals();
    this._resetReloadParts();
  }

  _computeHealPose(p, dt, pos, rot, player = null) {
    const smooth = (t) => t * t * (3 - 2 * t);
    const handRate = Math.min(1, dt * 11);

    // Strict sequential handoff: weapon drops completely out BEFORE medkit appears,
    // and medkit leaves completely BEFORE weapon returns (never 4 hands!)
    const weaponHideEnd = 0.06;
    const medShowStart = 0.06;
    const medHideStart = 0.89;
    const medHideEnd = 0.94;

    if (p < weaponHideEnd) {
      // Weapon holstering down out of frame; medkit not yet visible
      const wt = smooth(p / weaponHideEnd);
      this.viewmodelGroup.visible = true;
      pos.x = 0.22 * wt;
      pos.y = -0.42 * wt;
      pos.z = 0.10 * wt;
      rot.x = -0.85 * wt;
      rot.y = -0.35 * wt;
      rot.z = -0.25 * wt;
      if (this.medRig) this.medRig.visible = false;
      return;
    }

    if (p >= medHideEnd) {
      // Medkit is completely gone; raise weapon cleanly back to ready
      const wt = 1 - smooth((p - medHideEnd) / (1 - medHideEnd));
      if (this.medRig) this.medRig.visible = false;
      this.viewmodelGroup.visible = true;
      if (this.leftHand) this.leftHand.visible = true;
      if (this.leftArm) this.leftArm.visible = true;
      if (this.rightHand) this.rightHand.visible = true;
      if (this.rightArm) this.rightArm.visible = true;
      pos.x = 0.22 * wt;
      pos.y = -0.42 * wt;
      pos.z = 0.10 * wt;
      rot.x = -0.85 * wt;
      rot.y = -0.35 * wt;
      rot.z = -0.25 * wt;
      return;
    }

    // Weapon completely hidden while both hands are occupied with medkit
    this.viewmodelGroup.visible = false;
    if (this.plateRig) this.plateRig.visible = false;
    if (this.medRig) this.medRig.visible = true;

    const medEnv = p < 0.12
      ? smooth((p - medShowStart) / (0.12 - medShowStart))
      : (p > medHideStart ? 1 - smooth((p - medHideStart) / (medHideEnd - medHideStart)) : 1);

    // Hide all med items by default each frame; active phase shows its item
    if (this.medItems) {
      this.medItems.stim.visible = false;
      this.medItems.bandage.visible = false;
      this.medItems.pills.visible = false;
    }

    // Medkit centered cleanly in lower-center foreground (close-up camera space)
    const boxPos = new THREE.Vector3(0.0, THREE.MathUtils.lerp(-0.34, -0.095, medEnv), -0.255);
    const boxRot = new THREE.Euler(0.50, 0.0, 0.0);

    // Symmetrical left/right cradle positions (left hand cradling cleanly underneath left edge with zero box clipping)
    let lHandTarget = new THREE.Vector3(boxPos.x - 0.102, boxPos.y - 0.038, boxPos.z + 0.012);
    let lHandRot = new THREE.Euler(0.46, 0.08, 0.18);
    let rHandTarget = new THREE.Vector3(boxPos.x + 0.098, boxPos.y - 0.018, boxPos.z + 0.015);
    let rHandRot = new THREE.Euler(0.15, -0.15, 0.15);

    // Helper to animate a single random medical item methodically over local progress u (0..1)
    const animateItem = (itemType, u, flagKey) => {
      const mesh = this.medItems ? this.medItems[itemType] : null;
      if (!mesh) return;

      if (u < 0.20) {
        // Sub-beat A: Reach into centered tray & lift item cleanly into view
        const t = smooth(u / 0.20);
        mesh.visible = u > 0.06;
        mesh.position.set(
          THREE.MathUtils.lerp(0.0, 0.015, t),
          THREE.MathUtils.lerp(boxPos.y + 0.015, -0.025, t),
          THREE.MathUtils.lerp(boxPos.z, -0.23, t)
        );
        mesh.rotation.set(0.12, 0.05, 0.15);
        rHandTarget.set(mesh.position.x + 0.022, mesh.position.y - 0.005, mesh.position.z + 0.018);
        rHandRot.set(0.10, -0.25, 0.35);
      } else if (u < 0.32) {
        // Sub-beat B: Deliberate present/ready hold right in center view
        mesh.visible = true;
        mesh.position.set(0.015, -0.025, -0.23);
        mesh.rotation.set(0.12, 0.05, 0.15);
        rHandTarget.set(0.037, -0.030, -0.212);
        rHandRot.set(0.10, -0.25, 0.35);
      } else if (u < 0.82) {
        // Sub-beat C: Methodical item-specific application
        const au = (u - 0.32) / 0.50;
        mesh.visible = true;

        if (itemType === 'stim') {
          // Lower medkit slightly, raise left forearm to center, align syringe, jab firmly, hold, withdraw
          const prep = au < 0.25 ? smooth(au / 0.25) : (au > 0.82 ? 1 - smooth((au - 0.82) / 0.18) : 1);
          const jab = au < 0.28 ? 0 : (au < 0.44 ? smooth((au - 0.28) / 0.16) : (au < 0.78 ? 1 : 1 - smooth((au - 0.78) / 0.22)));
          if (au > 0.32 && !this.healFlags[flagKey]) {
            this.healFlags[flagKey] = true;
            window.soundEngine.playMedItem('stim');
          }
          const jolt = (au > 0.40 && au < 0.52) ? Math.sin(((au - 0.40) / 0.12) * Math.PI) : 0;

          boxPos.y -= 0.085 * prep;
          lHandTarget.set(
            THREE.MathUtils.lerp(boxPos.x - 0.102, -0.035, prep),
            THREE.MathUtils.lerp(boxPos.y - 0.038, -0.085 - jolt * 0.010, prep),
            THREE.MathUtils.lerp(boxPos.z + 0.012, -0.225, prep)
          );
          lHandRot.set(0.15, 0.35, -0.25);

          mesh.position.set(
            THREE.MathUtils.lerp(0.015, -0.015, prep),
            THREE.MathUtils.lerp(-0.010, -0.052 - jolt * 0.010, jab),
            -0.225
          );
          mesh.rotation.set(0.10, 0.05, THREE.MathUtils.lerp(0.18, 0.32, prep));
          rHandTarget.set(mesh.position.x + 0.022, mesh.position.y + 0.022, mesh.position.z + 0.016);
          rHandRot.set(0.05, -0.25, 0.55);
        } else if (itemType === 'bandage') {
          // Lower medkit slightly, bring left forearm to center, wrap gauze in 2 slow deliberate loops
          const prep = au < 0.16 ? smooth(au / 0.16) : (au > 0.88 ? 1 - smooth((au - 0.88) / 0.12) : 1);
          if (au > 0.18 && !this.healFlags[flagKey]) {
            this.healFlags[flagKey] = true;
            window.soundEngine.playMedItem('bandage');
          }
          const wrapT = THREE.MathUtils.clamp((au - 0.14) / 0.74, 0, 1);
          const angle = wrapT * Math.PI * 4.0; // 2 clean full loops
          const radius = 0.044;

          boxPos.y -= 0.085 * prep;
          lHandTarget.set(
            THREE.MathUtils.lerp(boxPos.x - 0.102, -0.025, prep),
            THREE.MathUtils.lerp(boxPos.y - 0.038, -0.085, prep),
            THREE.MathUtils.lerp(boxPos.z + 0.012, -0.23, prep)
          );
          lHandRot.set(0.10, 0.30, -0.20);

          mesh.position.set(
            -0.015 + Math.cos(angle) * radius,
            -0.070 + Math.sin(angle) * radius * 0.76,
            -0.225 + Math.sin(angle) * 0.018
          );
          mesh.rotation.set(Math.PI / 2, 0.15, angle);
          rHandTarget.set(mesh.position.x + 0.026, mesh.position.y + 0.008, mesh.position.z + 0.020);
          rHandRot.set(0.05, -0.20, 0.75);
        } else {
          // Painkiller pills: 2 distinct shakes in center, brief pause, tip smoothly up to take dose, return upright
          if (au > 0.08 && !this.healFlags[flagKey]) {
            this.healFlags[flagKey] = true;
            window.soundEngine.playMedItem('pills');
          }
          if (au < 0.42) {
            const shake = Math.sin((au / 0.42) * Math.PI * 4) * 0.020;
            mesh.position.set(0.010, -0.025 + shake, -0.225);
            mesh.rotation.set(0.12 + shake * 4.5, 0.08, 0.12);
          } else if (au < 0.50) {
            // Brief hold beat between shaking and tipping
            mesh.position.set(0.010, -0.025, -0.225);
            mesh.rotation.set(0.12, 0.08, 0.12);
          } else {
            const tu = (au - 0.50) / 0.50;
            const tip = tu < 0.35 ? smooth(tu / 0.35) : (tu < 0.72 ? 1 : 1 - smooth((tu - 0.72) / 0.28));
            mesh.position.set(
              THREE.MathUtils.lerp(0.010, 0.0, tip),
              THREE.MathUtils.lerp(-0.025, -0.005, tip),
              THREE.MathUtils.lerp(-0.225, -0.165, tip)
            );
            mesh.rotation.set(THREE.MathUtils.lerp(0.12, 1.38, tip), 0.05, 0.10);
          }
          rHandTarget.set(mesh.position.x + 0.024, mesh.position.y - 0.008, mesh.position.z + 0.018);
          rHandRot.set(0.05, -0.30, 0.40);
        }
      } else {
        // Sub-beat D: Place used item neatly back down into tray & brief settle beat
        const raw = (u - 0.82) / 0.18;
        const t = smooth(Math.min(1, raw / 0.78));
        mesh.visible = raw < 0.72;
        mesh.position.set(
          THREE.MathUtils.lerp(0.015, 0.0, t),
          THREE.MathUtils.lerp(-0.035, boxPos.y + 0.012, t),
          THREE.MathUtils.lerp(-0.23, boxPos.z, t)
        );
        rHandTarget.set(mesh.position.x + 0.026, mesh.position.y + 0.008, mesh.position.z + 0.020);
        rHandRot.set(0.10, -0.20, 0.65);
      }
    };

    if (p < 0.11) {
      // === STEP 1: BRING OUT & PRESENT CLOSED MEDKIT DEAD-CENTER ===
      if (this.medLidPivot) this.medLidPivot.rotation.x = 0;
    } else if (p < 0.15) {
      // === STEP 2A: MOVE RIGHT HAND TO FRONT SILVER CLASP & POP LATCH ===
      const t = smooth((p - 0.11) / 0.04);
      if (this.medLidPivot) this.medLidPivot.rotation.x = 0;
      if (t > 0.70 && !this.healFlags.open) {
        this.healFlags.open = true;
        window.soundEngine.playMedLatch(false);
      }
      rHandTarget.set(
        THREE.MathUtils.lerp(boxPos.x + 0.082, boxPos.x + 0.01, t),
        THREE.MathUtils.lerp(boxPos.y - 0.010, boxPos.y + 0.025, t),
        THREE.MathUtils.lerp(boxPos.z + 0.015, boxPos.z + 0.062, t)
      );
      rHandRot.set(-0.25, -0.15, 1.35);
    } else if (p < 0.23) {
      // === STEP 2B: FLIP HINGED LID WIDE OPEN & BRIEF PAUSE ===
      const raw = (p - 0.15) / 0.08;
      const t = smooth(Math.min(1, raw / 0.78));
      if (this.medLidPivot) this.medLidPivot.rotation.x = -1.95 * t;
      rHandTarget.set(
        boxPos.x + 0.01 + t * 0.03,
        boxPos.y + THREE.MathUtils.lerp(0.025, 0.115, t),
        boxPos.z + THREE.MathUtils.lerp(0.062, -0.025, t)
      );
      rHandRot.set(-0.25 - t * 0.35, -0.15, 1.35);
    } else if (p < 0.52) {
      // === STEP 3: METHODICAL APPLICATION OF RANDOM ITEM #1 ===
      if (this.medLidPivot) this.medLidPivot.rotation.x = -1.95;
      animateItem(this.healSequence[0], (p - 0.23) / 0.29, 'item1');
    } else if (p < 0.81) {
      // === STEP 4: METHODICAL APPLICATION OF RANDOM ITEM #2 ===
      if (this.medLidPivot) this.medLidPivot.rotation.x = -1.95;
      const u2 = (p - 0.52) / 0.29;
      animateItem(this.healSequence[1], u2, 'item2');
      if (u2 > 0.74 && !this.healFlags.applied) {
        this.healFlags.applied = true;
        if (player) player.finishMedkit();
      }
    } else if (p < 0.89) {
      // === STEP 5: FOLD LID SHUT & PRESS CLASP TO LATCH ===
      const raw = (p - 0.81) / 0.08;
      const closeT = smooth(Math.min(1, raw / 0.72));
      const press = raw > 0.72 ? Math.sin(((raw - 0.72) / 0.28) * Math.PI) : 0;
      if (this.medLidPivot) this.medLidPivot.rotation.x = THREE.MathUtils.lerp(-1.95, 0, closeT);
      if (raw > 0.72 && !this.healFlags.close) {
        this.healFlags.close = true;
        window.soundEngine.playMedLatch(true);
      }
      boxPos.y -= press * 0.010;
      rHandTarget.set(
        boxPos.x + 0.015,
        boxPos.y + THREE.MathUtils.lerp(0.115, 0.028, closeT) - press * 0.008,
        boxPos.z + THREE.MathUtils.lerp(-0.025, 0.058, closeT)
      );
      rHandRot.set(-0.55 + closeT * 0.35, -0.15, 1.40);
    } else {
      // === STEP 6: STOW CLOSED MEDKIT OFF BOTTOM OF SCREEN ===
      if (this.medLidPivot) this.medLidPivot.rotation.x = 0;
    }

    if (this.medBoxGroup) {
      this.medBoxGroup.position.copy(boxPos);
      this.medBoxGroup.rotation.copy(boxRot);
    }

    if (this.medLeftHand && this.medLeftArm) {
      this.medLeftHand.position.lerp(lHandTarget, handRate);
      this.medLeftHand.rotation.x = THREE.MathUtils.lerp(this.medLeftHand.rotation.x, lHandRot.x, handRate);
      this.medLeftHand.rotation.y = THREE.MathUtils.lerp(this.medLeftHand.rotation.y, lHandRot.y, handRate);
      this.medLeftHand.rotation.z = THREE.MathUtils.lerp(this.medLeftHand.rotation.z, lHandRot.z, handRate);
      const lShoulder = new THREE.Vector3(-0.28, -0.28, -0.02);
      const lWrist = this.medLeftHand.position.clone().add(new THREE.Vector3(-0.015, -0.01, 0.04));
      this._aimArm(this.medLeftArm, lShoulder, lWrist);
    }

    if (this.medRightHand && this.medRightArm) {
      this.medRightHand.position.lerp(rHandTarget, handRate);
      this.medRightHand.rotation.x = THREE.MathUtils.lerp(this.medRightHand.rotation.x, rHandRot.x, handRate);
      this.medRightHand.rotation.y = THREE.MathUtils.lerp(this.medRightHand.rotation.y, rHandRot.y, handRate);
      this.medRightHand.rotation.z = THREE.MathUtils.lerp(this.medRightHand.rotation.z, rHandRot.z, handRate);
      const rShoulder = new THREE.Vector3(0.28, -0.28, -0.02);
      const rWrist = this.medRightHand.position.clone().add(new THREE.Vector3(0.015, -0.01, 0.04));
      this._aimArm(this.medRightArm, rShoulder, rWrist);
    }
  }

  _endHealVisuals() {
    if (this.medRig) this.medRig.visible = false;
    if (this.medItems) {
      this.medItems.stim.visible = false;
      this.medItems.bandage.visible = false;
      this.medItems.pills.visible = false;
    }
    this.viewmodelGroup.visible = true;
    if (this.leftHand) this.leftHand.visible = true;
    if (this.leftArm) this.leftArm.visible = true;
    if (this.rightHand) this.rightHand.visible = true;
    if (this.rightArm) this.rightArm.visible = true;
  }

  startMedkit() {
    if (this.isReloading || this.isPlating || this.isHealing) return false;
    this.cancelInspect();
    this.isHealing = true;
    this.healDuration = 6.4;
    this.healTimer = this.healDuration;
    // Shuffle the 3 medical items and pick 2 distinct random items for this use
    const pool = ['stim', 'bandage', 'pills'];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.healSequence = [pool[0], pool[1]];
    this.healFlags = { open: false, item1: false, item2: false, applied: false, close: false };
    if (this.medLeftHand) this.medLeftHand.position.set(-0.10, -0.32, -0.26);
    if (this.medRightHand) this.medRightHand.position.set(0.10, -0.32, -0.26);
    return true;
  }

  cancelMedkit() {
    if (!this.isHealing) return;
    this.isHealing = false;
    this.healTimer = 0;
    this._endHealVisuals();
    this._resetReloadParts();
  }

  setThirdPerson(enabled) {
    this.isThirdPerson = !!enabled;
    if (this.isThirdPerson) {
      this.viewmodelGroup.visible = false;
      if (this.plateRig) this.plateRig.visible = false;
      if (this.medRig) this.medRig.visible = false;
    } else {
      this.viewmodelGroup.visible = !this.isHealing;
      if (this.plateRig) this.plateRig.visible = this.isPlating;
      if (this.medRig) this.medRig.visible = this.isHealing;
    }
  }

  startInspect(weaponDef) {
    if (this.isReloading || this.isPlating || this.isHealing || !weaponDef) return;
    this.isInspecting = true;
    this.inspectWeaponId = weaponDef.id;
    this.inspectDuration = 5.2;
    this.inspectTimer = this.inspectDuration;
  }

  cancelInspect() {
    if (!this.isInspecting) return;
    this.isInspecting = false;
    this.inspectTimer = 0;
    this._resetReloadParts();
  }

  startReload(weaponDef, isEmpty = false, shellsToLoad = 1) {
    if (this.isReloading || !weaponDef) return;
    this.cancelInspect();
    this.cancelPlating();
    this.cancelMedkit();
    this.isReloading = true;
    this.wasEmptyReload = isEmpty;
    this.reloadWeaponId = weaponDef.id;
    this.reloadShellCount = Math.max(1, shellsToLoad);
    this.lastShellSoundIdx = -1;
    this.lastShellLoadedIdx = -1;
    this.pumpDelayTimer = 0;
    this.pumpTimer = 0;
    if (weaponDef.id === 'm870') {
      this.reloadDuration = 0.55 + this.reloadShellCount * 0.52 + (isEmpty ? 0.50 : 0);
    } else {
      this.reloadDuration = weaponDef.reloadTime + (isEmpty ? 0.45 : 0);
    }
    this.reloadTimer = this.reloadDuration;
    this.reloadSfxFlags = { magOut: false, magIn: false, rack: false, boltLock: false };
  }

  cancelReload() {
    this.isReloading = false;
    this.reloadTimer = 0;
    this.pumpDelayTimer = 0;
    this.pumpTimer = 0;
    this._resetReloadParts();
  }

  tryFire(player, weaponSlotState, world, enemyManager, onHitCallback) {
    const def = player.getActiveWeaponDef ? player.getActiveWeaponDef() : GAME_DATA.ITEMS[weaponSlotState.id];
    if (!def) return false;
    this.cancelInspect();
    this.cancelPlating();
    this.cancelMedkit();

    // Allow emergency fire-to-cancel during M870 shell-by-shell reload if at least 1 shell is loaded
    if (this.isReloading) {
      if (def.id === 'm870' && weaponSlotState.mag > 0) {
        this.cancelReload();
      } else {
        return false;
      }
    }
    if (this.fireTimer > 0 || this.wallBlocked) return false;

    if (weaponSlotState.mag <= 0) {
      this.fireTimer = 0.25;
      window.soundEngine.playEmptyClick();
      return false;
    }

    weaponSlotState.mag -= 1;
    this.fireTimer = def.fireRate;
    this.recoilOffset = Math.min(0.10, this.recoilOffset + 0.045);
    if (def.slot === 'secondary' || def.id === 'mp5k' || def.id === 'ak74m') {
      this.boltKick = def.slot === 'secondary' ? 0.052 : 0.058;
    } else if (def.id === 'm870' && weaponSlotState.mag > 0) {
      this.pumpDelayTimer = 0.16;
    }
    this.muzzleFlash.intensity = 3.5;
    this.muzzleMesh.material.opacity = 0.92;
    this.muzzleTimer = 0.045;

    window.soundEngine.playGunshot(def.id, 0, !!def.suppressed);

    // Camera recoil kick & firing bloom
    const recoilScale = player.isADS ? 0.65 : 1.0;
    player.applyRecoil(def.recoil * recoilScale, (Math.random() - 0.5) * def.recoil * 0.45);
    this.fireBloom = Math.min(0.055, this.fireBloom + def.recoil * 0.45);

    // Raycast pellets — hipfire accuracy directly matches live crosshair size unless using a laser
    let totalSpread;
    if (player.isADS) {
      const stanceMult = player.isProne ? 0.55 : (player.isCrouching ? 0.75 : 1.0);
      const moveAdd = Math.hypot(player.velocity.x, player.velocity.z) > 0.8 ? 0.005 : 0;
      totalSpread = (def.adsSpread + moveAdd) * stanceMult;
    } else if (def.hasLaser) {
      // Tactical laser overrides wide hipfire cone with tight laser-guided accuracy
      const stanceMult = player.isProne ? 0.60 : (player.isCrouching ? 0.78 : 1.0);
      totalSpread = Math.min(this.currentSpread, def.adsSpread * 1.65) * stanceMult;
    } else {
      totalSpread = this.currentSpread;
    }

    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);

    const muzzleWorld = new THREE.Vector3();
    this.muzzleMesh.getWorldPosition(muzzleWorld);
    this._spawnSmoke(muzzleWorld, 2);

    const enemyMeshes = enemyManager.getHitboxMeshes();

    for (let p = 0; p < def.pellets; p++) {
      const dir = new THREE.Vector3(0, 0, -1);
      dir.x += (Math.random() - 0.5) * 2 * totalSpread;
      dir.y += (Math.random() - 0.5) * 2 * totalSpread;
      dir.normalize();
      dir.applyQuaternion(this.camera.quaternion);

      const raycaster = new THREE.Raycaster(origin, dir, 0.1, def.range);

      const worldHits = raycaster.intersectObjects(world.shootableMeshes, false);
      const worldDist = worldHits.length > 0 ? worldHits[0].distance : def.range;

      const enemyHits = raycaster.intersectObjects(enemyMeshes, false);
      let hitPoint = origin.clone().addScaledVector(dir, worldDist);

      if (enemyHits.length > 0 && enemyHits[0].distance < worldDist) {
        const hit = enemyHits[0];
        hitPoint = hit.point;
        const { enemy, part } = hit.object.userData;
        const isHead = part === 'head';
        const dmg = Math.round(def.damage * (isHead ? 2.0 : 1.0));
        const attackerInfo = { name: 'YOU', isPlayer: true, weaponId: weaponSlotState.id, weaponName: def.name };
        const killed = enemy.takeDamage(dmg, origin, attackerInfo);
        this._spawnImpact(hitPoint, 0x991111, 5);
        onHitCallback(isHead, killed, enemy, attackerInfo);
      } else if (worldHits.length > 0) {
        this._spawnImpact(hitPoint, 0xc8b898, 4);
      }

      this._spawnTracer(muzzleWorld, hitPoint, 0xffdd88);
    }

    return true;
  }

  buildMeleeViewmodel(meleeDef) {
    this.isMeleeMode = true;
    if (this.currentMesh) {
      this.viewmodelGroup.remove(this.currentMesh);
      this.currentMesh = null;
    }
    if (this.meleeMesh) {
      this.viewmodelGroup.remove(this.meleeMesh);
      this.meleeMesh = null;
    }
    this.magMesh = null;
    this.spareMagMesh = null;
    this.boltMesh = null;
    this.charmPivot = null;
    this.leftHand = null;
    this.leftArm = null;
    this.leftFist = null;

    const id = (meleeDef && meleeDef.id) || 'melee_knife';
    const gripMat = new THREE.MeshLambertMaterial({ color: 0x1b1e20 });
    const wrapMat = new THREE.MeshLambertMaterial({ color: 0x2d322c });
    const darkSteel = new THREE.MeshLambertMaterial({ color: 0x262a2e });
    const brightEdge = new THREE.MeshLambertMaterial({ color: 0xd6dfe6 });
    const brassMat = new THREE.MeshLambertMaterial({ color: 0x8a7248 });

    const g = new THREE.Group();
    const bladeRoot = new THREE.Group();

    if (id === 'melee_axe') {
      // Tactical Breaching Hatchet (Bearded Blade + Rear Spike)
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.34, 0.032), gripMat);
      handle.position.set(0, -0.02, 0);
      for (let i = 0; i < 4; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.018, 0.035), wrapMat);
        rib.position.set(0, -0.14 + i * 0.032, 0);
        bladeRoot.add(rib);
      }
      const axeShape = new THREE.Shape();
      axeShape.moveTo(0, -0.02);
      axeShape.lineTo(0.095, -0.065);
      axeShape.quadraticCurveTo(0.115, 0.01, 0.092, 0.068);
      axeShape.lineTo(-0.02, 0.042);
      axeShape.lineTo(-0.088, 0.018); // rear breaching spike
      axeShape.lineTo(-0.02, -0.012);
      axeShape.closePath();
      const axeGeo = new THREE.ExtrudeGeometry(axeShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
      axeGeo.center();
      const axeHead = new THREE.Mesh(axeGeo, darkSteel);
      axeHead.rotation.y = Math.PI / 2;
      axeHead.position.set(0, 0.14, -0.015);
      const edgeStrip = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.12, 0.014), brightEdge);
      edgeStrip.position.set(0, 0.14, -0.105);
      bladeRoot.add(handle, axeHead, edgeStrip);
    } else if (id === 'melee_karambit') {
      // Sculpted Curved Tactical Karambit (Finger Ring + Curved Ergonomic Handle + Hawkbill Talon Blade)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0045, 8, 16), darkSteel);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(0, -0.095, 0.014);

      const handleShape = new THREE.Shape();
      handleShape.moveTo(-0.012, -0.082);
      handleShape.quadraticCurveTo(0.012, -0.04, 0.004, 0.018);
      handleShape.lineTo(-0.018, 0.022);
      handleShape.quadraticCurveTo(-0.012, -0.04, -0.026, -0.078);
      handleShape.closePath();
      const handleGeo = new THREE.ExtrudeGeometry(handleShape, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
      handleGeo.translate(0, 0, -0.008);
      const handle = new THREE.Mesh(handleGeo, gripMat);
      handle.rotation.y = Math.PI / 2;

      const talonShape = new THREE.Shape();
      talonShape.moveTo(-0.014, 0.018);
      talonShape.quadraticCurveTo(0.015, 0.095, 0.105, 0.145); // outer curved spine to needle tip
      talonShape.quadraticCurveTo(0.055, 0.085, 0.016, 0.016); // sharp inner curved edge
      talonShape.closePath();
      const talonGeo = new THREE.ExtrudeGeometry(talonShape, { depth: 0.0045, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 });
      talonGeo.translate(0, 0, -0.00225);
      const blade = new THREE.Mesh(talonGeo, brightEdge);
      blade.rotation.y = Math.PI / 2;

      bladeRoot.add(ring, handle, blade);
    } else {
      // Sculpted Tactical Combat Knife (Clip-Point Bowie Blade, Fuller Groove, Crossguard & Ribbed Grip)
      const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.016, 10), darkSteel);
      pommel.position.set(0, -0.105, 0);

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.013, 0.11, 10), gripMat);
      handle.scale.set(0.75, 1, 1.2);
      handle.position.set(0, -0.045, 0);

      for (let i = 0; i < 4; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.032), wrapMat);
        rib.position.set(0, -0.08 + i * 0.022, 0);
        bladeRoot.add(rib);
      }

      // Crossguard with quillons
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.010, 0.068), darkSteel);
      guard.position.set(0, 0.014, 0);
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 0.038), brassMat);
      collar.position.set(0, 0.021, 0);

      // Clip-point Bowie blade profile (extruded thin steel)
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(-0.014, 0.022);      // spine base
      bladeShape.lineTo(-0.014, 0.145);      // straight spine
      bladeShape.lineTo(-0.002, 0.228);      // clip-point razor tip
      bladeShape.quadraticCurveTo(0.020, 0.175, 0.018, 0.115); // curved cutting belly
      bladeShape.lineTo(0.016, 0.022);       // heel of edge
      bladeShape.closePath();
      const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.001, bevelSegments: 1 });
      bladeGeo.translate(0, 0, -0.002);
      const blade = new THREE.Mesh(bladeGeo, darkSteel);
      blade.rotation.y = Math.PI / 2;

      // Bright honed cutting edge bevel along the front edge
      const edgeShape = new THREE.Shape();
      edgeShape.moveTo(0.011, 0.024);
      edgeShape.lineTo(0.014, 0.118);
      edgeShape.quadraticCurveTo(0.016, 0.172, -0.001, 0.227);
      edgeShape.quadraticCurveTo(0.022, 0.174, 0.019, 0.115);
      edgeShape.lineTo(0.017, 0.024);
      edgeShape.closePath();
      const edgeGeo = new THREE.ExtrudeGeometry(edgeShape, { depth: 0.0024, bevelEnabled: false });
      edgeGeo.translate(0, 0, -0.0012);
      const edgeMesh = new THREE.Mesh(edgeGeo, brightEdge);
      edgeMesh.rotation.y = Math.PI / 2;

      bladeRoot.add(pommel, handle, guard, collar, blade, edgeMesh);
    }

    // Angle blade naturally forward-left like a real FPS combat knife ready stance
    bladeRoot.scale.setScalar(1.18);
    bladeRoot.position.set(0.0, 0.02, -0.02);
    bladeRoot.rotation.set(-0.68, 0.32, 0.25);
    g.add(bladeRoot);

    // Attach proper gloved right hand & forearm!
    this.rightHand = this._createHand(true, 'grip');
    this.rightHand.position.set(0.012, -0.045, 0.02);
    this.rightHand.rotation.set(-0.42, 0.22, 0.18);
    this.rightHandRestPos.copy(this.rightHand.position);
    this.rightHandRestRot.copy(this.rightHand.rotation);
    this.rightArm = this._createForearm();
    g.add(this.rightHand, this.rightArm);

    this.meleeMesh = g;
    this.currentMesh = g;
    this.viewmodelGroup.add(g);
    this.sightHeight = 0.12;
    this.adsZ = -0.34;
    this.viewmodelGroup.visible = !this.isThirdPerson;
  }

  tryMeleeSlash(player, world, enemyManager, onHitCallback, isQuick = false) {
    if (this.meleeSwingTimer > 0) return false;
    this.cancelReload();
    this.cancelInspect();
    this.cancelPlating();
    this.cancelMedkit();
    this.meleeSwingDuration = isQuick ? 0.28 : 0.34;
    this.meleeSwingTimer = this.meleeSwingDuration;
    this.fireTimer = this.meleeSwingDuration;

    if (window.soundEngine && window.soundEngine.playClick) {
      try { window.soundEngine.playClick(); } catch (e) {}
    }

    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const reach = 2.5;
    const raycaster = new THREE.Raycaster(origin, dir, 0.1, reach);
    const worldHits = raycaster.intersectObjects(world.shootableMeshes, false);
    const worldDist = worldHits.length > 0 ? worldHits[0].distance : reach;
    const enemyHits = raycaster.intersectObjects(enemyManager.getHitboxMeshes(), false);

    if (enemyHits.length > 0 && enemyHits[0].distance < worldDist) {
      const hit = enemyHits[0];
      const { enemy, part } = hit.object.userData;
      const isHead = part === 'head';
      const dmg = isHead ? 105 : 68;
      const mDef = GAME_DATA.ITEMS[player.melee || 'melee_knife'];
      const attackerInfo = { name: 'YOU', isPlayer: true, weaponId: player.melee || 'melee_knife', weaponName: mDef ? mDef.name : 'Combat Knife' };
      const killed = enemy.takeDamage(dmg, origin, attackerInfo);
      this._spawnImpact(hit.point, 0x991111, 6);
      if (onHitCallback) onHitCallback(isHead, killed, enemy, attackerInfo);
    } else if (worldHits.length > 0) {
      this._spawnImpact(worldHits[0].point, 0xc8b898, 4);
    }
    return true;
  }

  spawnEnemyShot(muzzleWorld, targetPos, hitPlayer, world) {
    this._spawnSmoke(muzzleWorld, 2);

    const dir = targetPos.clone().sub(muzzleWorld).normalize();
    if (!hitPlayer) {
      dir.x += (Math.random() - 0.5) * 0.14;
      dir.y += (Math.random() - 0.5) * 0.10;
      dir.z += (Math.random() - 0.5) * 0.14;
      dir.normalize();
    }

    let endPoint = muzzleWorld.clone().addScaledVector(dir, 55);
    if (!hitPlayer) {
      const ray = new THREE.Raycaster(muzzleWorld, dir, 0.2, 55);
      const hits = ray.intersectObjects(world.shootableMeshes, false);
      if (hits.length > 0) {
        endPoint = hits[0].point;
        this._spawnImpact(endPoint, 0xc8b898, 4);
      }
    } else {
      endPoint = targetPos.clone();
    }

    this._spawnTracer(muzzleWorld, endPoint, 0xff7744);
  }

  _spawnTracer(start, end, color = 0xffdd88) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  _spawnImpact(pos, color, count) {
    const geo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 4.5,
          Math.random() * 3.8 + 0.5,
          (Math.random() - 0.5) * 4.5
        ),
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45,
        isSmoke: false
      });
    }
  }

  _spawnSmoke(pos, count = 2) {
    const geo = new THREE.SphereGeometry(0.08, 6, 6);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xbab6ae,
        transparent: true,
        opacity: 0.32,
        depthWrite: false
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos);
      this.scene.add(m);
      const life = 0.45 + Math.random() * 0.25;
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          0.6 + Math.random() * 0.5,
          (Math.random() - 0.5) * 0.6
        ),
        life,
        maxLife: life,
        isSmoke: true
      });
    }
  }
}
