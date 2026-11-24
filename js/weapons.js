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
    this.fpArms = null;
    this._buildVisibleHands = false;
    this._currentAimHand = null;
    this.sightHeight = 0.05; // Local Y of iron sights for exact ADS alignment
    this.adsZ = -0.30;

    this.fireTimer = 0;
    this.recoilOffset = 0;
    this.recoilZ = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.recoilRoll = 0;
    this.recoilX = 0;
    this._prevYaw = null;
    this._prevPitch = null;
    this.lookSwayX = 0;
    this.lookSwayY = 0;
    this.lookSwayRotY = 0;
    this.lookSwayRotX = 0;
    this.lookSwayRotZ = 0;
    this.boltKick = 0;
    this.boltCycleTimer = 0;
    this.boltCycleDuration = 0.085;
    this.currentSpread = 0.022;
    this.fireBloom = 0;
    this.wallPush = 0;
    this.wallBlocked = false;
    this._wallRay = new THREE.Raycaster();
    this.pumpDelayTimer = 0;
    this.pumpTimer = 0;
    this.pumpDuration = 0.40;
    this.boltActionDelayTimer = 0;
    this.boltActionTimer = 0;
    this.boltActionDuration = 0.62;
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
    this.reloadSlotRef = null;
    this._reloadResumeBlend = 1.0;
    this._reloadImpulseFlags = { boltLock: false, magOut: false, magIn: false, rack: false };
    // AAA 6-DOF Second-Order Damped Spring (mechanical reload jolts, jump/land thud, sprint start/stop inertia, recoil punch)
    this._sprPos = new THREE.Vector3();
    this._sprPosVel = new THREE.Vector3();
    this._sprRot = new THREE.Vector3();
    this._sprRotVel = new THREE.Vector3();
    this._prevOnGround = true;
    this._airTime = 0;
    this._prevLocoSpeed = 0;
    this._fpPhaseWalk = 0;
    this._fpPhaseRun = 0;
    this._fpPhaseTac = 0;

    this.isInspecting = false;
    this.inspectTimer = 0;
    this.inspectDuration = 4.8;
    this.inspectWeaponId = 'pm9';
    this._inspectCheckSfxPlayed = false;

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
    // MW19 / Warzone / DMZ Combat Auto-Injector Revive Syringe Rig (teammate revive + self-revive)
    this.reviveRig = null;
    this.reviveHandR = null;
    this.reviveArmR = null;
    this.reviveHandL = null;
    this.reviveArmL = null;
    this.reviveSyringe = null;
    this.revivePlunger = null;
    this.reviveFluid = null;
    this.reviveCap = null;
    this._reviveSfxFlags = { uncap: false, plunge: false };
    // Dynamic left-hand item / weapon pickup & container grab interaction
    this.grabTimer = 0;
    this.grabDuration = 0.34;
    this.grabKind = 'item';
    this._adsBlend = 0;
    this._tacStanceBlend = 0;
    this.sprintOutTimer = 0;
    this._idleSwayPhase = Math.random() * Math.PI * 2;
    this.idleSwayYaw = 0;
    this.idleSwayPitch = 0;
    this._flinchPitch = 0;
    this._flinchYaw = 0;
    this._flinchRoll = 0;
    this._wasCheekWelded = false;
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
    this.boltCarrierMesh = null;
    this.boltCarrierRestPos = new THREE.Vector3();
    this.chamberRoundMesh = null;
    this.leftHand = null;
    this.leftHandRestPos = new THREE.Vector3();
    this.leftHandRestRot = new THREE.Euler();
    this.rightHand = null;
    this.rightHandRestPos = new THREE.Vector3();
    this.rightHandRestRot = new THREE.Euler();
    this.leftArm = null;
    this.rightArm = null;
    this.charmPivot = null;

    this.particles = []; // active pooled particle entries
    this.tracers = [];   // active pooled tracer entries
    this._aimRay = new THREE.Raycaster();
    this._segRay = new THREE.Raycaster();
    this._shotOrigin = new THREE.Vector3();
    this._shotMuzzle = new THREE.Vector3();
    this._shotCamFwd = new THREE.Vector3();
    this._shotAimPoint = new THREE.Vector3();
    this._shotBaseDir = new THREE.Vector3();
    this._shotLaunchDir = new THREE.Vector3();
    this._shotVel = new THREE.Vector3();
    this._shotCurPos = new THREE.Vector3();
    this._shotNextPos = new THREE.Vector3();
    this._shotSegVec = new THREE.Vector3();
    this._shotSegDir = new THREE.Vector3();
    this._shotToTarget = new THREE.Vector3();
    this._shotQuat = new THREE.Quaternion();
    this._shotEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._shotEnemyMeshes = [];
    this._shotAllyMeshes = [];
    this._tmpHitArr = [];
    this._tracePtsBuf = [];
    for (let i = 0; i < 16; i++) this._tracePtsBuf.push(new THREE.Vector3());
    this._poolScene = null;
    this._tracerPool = null;
    this._smokePool = null;
    this._impactPool = null;
    this._tracerCursor = 0;
    this._smokeCursor = 0;
    this._impactCursor = 0;
    this._autoBurstActive = false;
    this._fireTickedThisFrame = false;
  }

  triggerGrabAnim(kind = 'item') {
    if (this.isReloading || this.isPlating || this.isHealing || this.isInspecting) return;
    this.grabKind = kind || 'item';
    this.grabDuration = (kind === 'weapon' || kind === 'container') ? 0.38 : 0.32;
    this.grabTimer = this.grabDuration;
    this.addWeaponImpulse(-0.010, -0.012, -0.014, 0.04, 0.03, -0.05);
  }

  addWeaponImpulse(px, py, pz, rx = 0, ry = 0, rz = 0) {
    if (!this._sprPosVel || !this._sprRotVel) return;
    this._sprPosVel.x = THREE.MathUtils.clamp(this._sprPosVel.x + px * 14, -1.6, 1.6);
    this._sprPosVel.y = THREE.MathUtils.clamp(this._sprPosVel.y + py * 14, -1.6, 1.6);
    this._sprPosVel.z = THREE.MathUtils.clamp(this._sprPosVel.z + pz * 14, -1.6, 1.6);
    this._sprRotVel.x = THREE.MathUtils.clamp(this._sprRotVel.x + rx * 14, -5.5, 5.5);
    this._sprRotVel.y = THREE.MathUtils.clamp(this._sprRotVel.y + ry * 14, -5.5, 5.5);
    this._sprRotVel.z = THREE.MathUtils.clamp(this._sprRotVel.z + rz * 14, -5.5, 5.5);
  }

  triggerHitFlinch(damage = 25, weaponDef = null, isADS = false, isFocusing = false) {
    const res = (weaponDef && weaponDef.flinchRes) ? weaponDef.flinchRes : 1.0;
    const focusMit = isFocusing ? 0.62 : 1.0;
    const mag = THREE.MathUtils.clamp((damage / 42) / Math.max(0.5, res), 0.25, 1.35) * focusMit;
    const side = Math.random() < 0.5 ? 1 : -1;
    const adsScale = isADS ? 0.72 : 1.0;
    this._flinchPitch = THREE.MathUtils.clamp((this._flinchPitch || 0) + 0.026 * mag * adsScale, -0.075, 0.075);
    this._flinchYaw = THREE.MathUtils.clamp((this._flinchYaw || 0) + side * 0.014 * mag * adsScale, -0.05, 0.05);
    this._flinchRoll = THREE.MathUtils.clamp((this._flinchRoll || 0) - side * 0.038 * mag, -0.10, 0.10);
    this.addWeaponImpulse(side * 0.008 * mag, -0.012 * mag, 0.018 * mag, 0.065 * mag, side * 0.03 * mag, -side * 0.06 * mag);
    if (this.fpArms && this.fpArms.applyShoulderImpulse) {
      this.fpArms.applyShoulderImpulse('right', side * 0.008 * mag, -0.010 * mag, 0.022 * mag, 0.35);
      this.fpArms.applyShoulderImpulse('left', side * 0.006 * mag, -0.008 * mag, 0.014 * mag, 0.25);
    }
  }

  _stepWeaponSpring(dt) {
    const step = Math.min(0.033, Math.max(0.001, dt || 0.016));
    const k = 215.0; // crisp MW19 spring stiffness
    const c = 19.5;  // slightly underdamped for authentic tactile mechanical settle
    // Semi-implicit Euler integration for 3D position & rotation springs
    this._sprPosVel.x += (-k * this._sprPos.x - c * this._sprPosVel.x) * step;
    this._sprPosVel.y += (-k * this._sprPos.y - c * this._sprPosVel.y) * step;
    this._sprPosVel.z += (-k * this._sprPos.z - c * this._sprPosVel.z) * step;
    this._sprPos.x = THREE.MathUtils.clamp(this._sprPos.x + this._sprPosVel.x * step, -0.08, 0.08);
    this._sprPos.y = THREE.MathUtils.clamp(this._sprPos.y + this._sprPosVel.y * step, -0.09, 0.09);
    this._sprPos.z = THREE.MathUtils.clamp(this._sprPos.z + this._sprPosVel.z * step, -0.08, 0.08);

    this._sprRotVel.x += (-k * this._sprRot.x - c * this._sprRotVel.x) * step;
    this._sprRotVel.y += (-k * this._sprRot.y - c * this._sprRotVel.y) * step;
    this._sprRotVel.z += (-k * this._sprRot.z - c * this._sprRotVel.z) * step;
    this._sprRot.x = THREE.MathUtils.clamp(this._sprRot.x + this._sprRotVel.x * step, -0.30, 0.30);
    this._sprRot.y = THREE.MathUtils.clamp(this._sprRot.y + this._sprRotVel.y * step, -0.26, 0.26);
    this._sprRot.z = THREE.MathUtils.clamp(this._sprRot.z + this._sprRotVel.z * step, -0.32, 0.32);
  }

  _getReloadStages(weaponId, isEmpty) {
    if (weaponId === 'mp5k') {
      return { magOutP: isEmpty ? 0.42 : 0.24, magInP: isEmpty ? 0.70 : 0.66, needsChamber: !!isEmpty };
    }
    if (weaponId === 'ak74m') {
      return { magOutP: isEmpty ? 0.34 : 0.32, magInP: isEmpty ? 0.64 : 0.70, needsChamber: !!isEmpty };
    }
    if (weaponId === 'mosin9130') {
      return { magOutP: 0.22, magInP: 0.68, needsChamber: true };
    }
    if (weaponId === 'm870') {
      return { magOutP: 0.12, magInP: isEmpty ? 0.42 : 0.88, needsChamber: false };
    }
    // G17, PM-9, M24, AWM .338
    return { magOutP: isEmpty ? 0.26 : 0.24, magInP: isEmpty ? 0.58 : 0.64, needsChamber: !!isEmpty };
  }

  _ensureReviveRig() {
    if (this.reviveRig || !this.vmCamera) return;
    const rig = new THREE.Group();
    rig.visible = false;

    const handR = this._createHand(true, 'syringeHold');
    handR.userData.handStyle = 'syringeHold';
    const armR = this._createForearm();
    armR.userData.fpSide = 'right';

    const handL = this._createHand(false, 'syringeCapPull');
    handL.userData.handStyle = 'syringeCapPull';
    const armL = this._createForearm();
    armL.userData.fpSide = 'left';

    // High-detail DMZ / Warzone Combat Auto-Injector Syringe
    const syr = new THREE.Group();
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x3a4635, specular: 0x5c6b56, shininess: 32 });
    const darkMat = new THREE.MeshPhongMaterial({ color: 0x1b1f23, specular: 0x454d56, shininess: 40 });
    const steelMat = new THREE.MeshPhongMaterial({ color: 0xc2ccd6, specular: 0xffffff, shininess: 88 });
    const glassMat = new THREE.MeshPhongMaterial({
      color: 0xdaf6ff,
      specular: 0xffffff,
      shininess: 96,
      transparent: true,
      opacity: 0.44
    });
    const fluidMat = new THREE.MeshPhongMaterial({
      color: 0x26f0a8,
      emissive: 0x0c7a52,
      specular: 0x99ffe0,
      shininess: 72
    });
    const capMat = new THREE.MeshPhongMaterial({ color: 0xd94626, specular: 0xff9977, shininess: 46 });

    // Glass dosage barrel + glowing emerald-cyan combat bio-stim fluid inside
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0115, 0.096, 16), glassMat);
    syr.add(barrel);
    const fluid = new THREE.Mesh(new THREE.CylinderGeometry(0.0092, 0.0092, 0.082, 14), fluidMat);
    fluid.position.set(0, -0.004, 0);
    syr.add(fluid);
    // Graduated black dosage markings on barrel
    for (let i = -2; i <= 2; i++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.002, 0.004), darkMat);
      tick.position.set(0, i * 0.016, -0.010);
      syr.add(tick);
    }
    // Lower OD collar + steel luer-lock needle hub + fine surgical steel cannula
    const lowerCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.0125, 0.022, 14), bodyMat);
    lowerCollar.position.set(0, -0.052, 0);
    const needleHub = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0085, 0.016, 12), darkMat);
    needleHub.position.set(0, -0.068, 0);
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0018, 0.044, 10), steelMat);
    needle.position.set(0, -0.096, 0);
    // Upper ergonomic finger-flange collar
    const upperCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0135, 0.016, 14), bodyMat);
    upperCollar.position.set(0, 0.052, 0);
    const flange = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.007, 0.018), darkMat);
    flange.position.set(0, 0.058, 0);
    syr.add(lowerCollar, needleHub, needle, upperCollar, flange);

    // Animated thumb plunger assembly (slides down inside barrel as injection progresses!)
    const plunger = new THREE.Group();
    const stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.0096, 0.0096, 0.010, 14), darkMat);
    stopper.position.set(0, 0.036, 0);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.064, 10), steelMat);
    rod.position.set(0, 0.068, 0);
    const thumbPad = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0145, 0.009, 14), capMat);
    thumbPad.position.set(0, 0.100, 0);
    plunger.add(stopper, rod, thumbPad);
    syr.add(plunger);

    // Removable red needle safety cap (starts on needle, transfers to left hand on uncap!)
    const safetyCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0055, 0.052, 12), capMat);
    safetyCap.position.set(0, -0.092, 0);
    syr.add(safetyCap);

    // Seat syringe firmly in right gloved palm (needle pointing down-forward ready to plunge)
    syr.position.set(-0.016, 0.006, -0.034);
    syr.rotation.set(0.32, 0.0, -0.14);
    handR.add(syr);

    // Secondary cap held by left hand once popped off
    const pulledCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0055, 0.052, 12), capMat);
    pulledCap.position.set(0.018, -0.006, -0.028);
    pulledCap.rotation.set(0.25, 0, 0.45);
    pulledCap.visible = false;
    handL.add(pulledCap);

    rig.add(handR, armR, handL, armL);
    this.vmCamera.add(rig);

    this.reviveRig = rig;
    this.reviveHandR = handR;
    this.reviveArmR = armR;
    this.reviveHandL = handL;
    this.reviveArmL = armL;
    this.reviveSyringe = syr;
    this.revivePlunger = plunger;
    this.reviveFluid = fluid;
    this.reviveCap = safetyCap;
    this.revivePulledCap = pulledCap;
  }

  _updateReviveAnim(dt, player) {
    this._ensureReviveRig();
    const isAllyRev = !!(player && player.isRevivingAlly && !player.dead && !player.isDowned);
    const isSelfRev = !!(player && player.isDowned && !player.dead &&
      (player.beingRevivedBy === 'SELF-REVIVE' || player.beingRevivedBy === 'TOURNIQUET') &&
      (player.reviveProgress || 0) > 0.005);
    const active = isAllyRev || isSelfRev;

    if (!active || !this.reviveRig) {
      if (this.reviveRig) this.reviveRig.visible = false;
      this._reviveSfxFlags.uncap = false;
      this._reviveSfxFlags.plunge = false;
      return false;
    }

    if (player.isThirdPerson) {
      this.reviveRig.visible = false;
      return true;
    }

    // Hide weapon & other camera rigs while injecting syringe
    this.viewmodelGroup.visible = false;
    if (this.plateRig) this.plateRig.visible = false;
    if (this.medRig) this.medRig.visible = false;
    if (this.tacFistRig) this.tacFistRig.visible = false;
    this.reviveRig.visible = true;

    const p = THREE.MathUtils.clamp(isSelfRev ? (player.reviveProgress || 0) : (player.allyReviveProgress || 0), 0, 1);
    const smooth = (t) => t * t * (3 - 2 * t);
    const easeOutBack = (t) => {
      const c1 = 1.6;
      const c3 = c1 + 1;
      const x = THREE.MathUtils.clamp(t, 0, 1) - 1;
      return 1 + c3 * x * x * x + c1 * x * x;
    };

    // Audio cues for cap snap & needle plunge
    if (p > 0.14 && !this._reviveSfxFlags.uncap) {
      this._reviveSfxFlags.uncap = true;
      if (window.soundEngine && window.soundEngine.playPinPull) window.soundEngine.playPinPull();
    }
    if (p > 0.28 && !this._reviveSfxFlags.plunge) {
      this._reviveSfxFlags.plunge = true;
      if (window.soundEngine && window.soundEngine.playMagIn) window.soundEngine.playMagIn('g17');
    }

    const uncapped = p > 0.15;
    if (this.reviveCap) this.reviveCap.visible = !uncapped;
    if (this.revivePulledCap) this.revivePulledCap.visible = uncapped && p < 0.34;

    // Plunger depression & glowing fluid drain during the injection phase (0.34..0.88)
    const injectT = THREE.MathUtils.clamp((p - 0.34) / 0.54, 0, 1);
    const injectEase = smooth(injectT);
    if (this.revivePlunger) {
      this.revivePlunger.position.y = -injectEase * 0.068;
    }
    if (this.reviveFluid) {
      const remain = Math.max(0.06, 1 - injectEase * 0.94);
      this.reviveFluid.scale.y = remain;
      this.reviveFluid.position.y = -0.004 - (1 - remain) * 0.041;
    }

    const rTarget = new THREE.Vector3();
    const rRot = new THREE.Euler();
    const lTarget = new THREE.Vector3();
    const lRot = new THREE.Euler();
    let showLeft = true;
    let rStyle = 'syringeHold';
    let lStyle = 'syringeCapPull';

    if (isSelfRev) {
      // Warzone / DMZ Self-Revive: pull cap off -> snap-stab syringe down-inward into own chest -> depress plunger!
      if (p < 0.20) {
        const t = easeOutBack(p / 0.20);
        const pullT = p > 0.11 ? easeOutBack((p - 0.11) / 0.09) : 0;
        rTarget.set(THREE.MathUtils.lerp(0.24, 0.09, t), THREE.MathUtils.lerp(-0.26, -0.05, t), THREE.MathUtils.lerp(-0.34, -0.28, t));
        rRot.set(0.18, 0.22, 0.32);
        lTarget.set(THREE.MathUtils.lerp(-0.18, 0.02, t) - pullT * 0.22, THREE.MathUtils.lerp(-0.24, -0.10, t) - pullT * 0.10, -0.28);
        lRot.set(0.10, 0.30, -0.20 - pullT * 0.35);
      } else if (p < 0.34) {
        // Cock up briefly then plunge firmly into chest!
        const raw = (p - 0.20) / 0.14;
        const stabT = raw < 0.35 ? 0 : easeOutBack((raw - 0.35) / 0.65);
        const cock = raw < 0.35 ? smooth(raw / 0.35) : (1 - smooth((raw - 0.35) / 0.65));
        rTarget.set(
          THREE.MathUtils.lerp(0.09, 0.03, stabT) + cock * 0.03,
          THREE.MathUtils.lerp(-0.05, -0.145, stabT) + cock * 0.05,
          THREE.MathUtils.lerp(-0.28, -0.205, stabT) - cock * 0.02
        );
        rRot.set(THREE.MathUtils.lerp(0.18, -0.58, stabT), THREE.MathUtils.lerp(0.22, 0.34, stabT), THREE.MathUtils.lerp(0.32, 0.62, stabT));
        showLeft = false;
      } else if (p < 0.88) {
        // Plunging bio-stim fluid into chest with subtle physical tension
        rStyle = 'syringePlunge';
        const tremor = Math.sin(p * 78) * 0.0025;
        rTarget.set(0.03 + tremor, -0.148 - injectEase * 0.012, -0.205);
        rRot.set(-0.60 - injectEase * 0.06, 0.34, 0.62);
        showLeft = false;
      } else {
        // Crisp pull-out from chest!
        const outT = smooth((p - 0.88) / 0.12);
        rTarget.set(THREE.MathUtils.lerp(0.03, 0.24, outT), THREE.MathUtils.lerp(-0.16, -0.26, outT), THREE.MathUtils.lerp(-0.205, -0.32, outT));
        rRot.set(THREE.MathUtils.lerp(-0.66, 0.10, outT), 0.25, THREE.MathUtils.lerp(0.62, 0.15, outT));
        showLeft = false;
      }
    } else {
      // Teammate Combat Revive: uncap syringe -> snap-plunge forward-down into downed ally -> depress plunger while bracing!
      if (p < 0.20) {
        const t = easeOutBack(p / 0.20);
        const pullT = p > 0.12 ? easeOutBack((p - 0.12) / 0.08) : 0;
        rTarget.set(THREE.MathUtils.lerp(0.26, 0.11, t), THREE.MathUtils.lerp(-0.26, -0.05, t), THREE.MathUtils.lerp(-0.36, -0.30, t));
        rRot.set(0.20, -0.18, 0.18);
        lTarget.set(THREE.MathUtils.lerp(-0.20, 0.04, t) - pullT * 0.22, THREE.MathUtils.lerp(-0.26, -0.10, t) - pullT * 0.10, -0.30);
        lRot.set(0.14, 0.28 + pullT * 0.30, -0.20 - pullT * 0.35);
      } else if (p < 0.34) {
        // Cock syringe up & snap-plunge forward-down into teammate's shoulder/chest!
        const raw = (p - 0.20) / 0.14;
        const cock = raw < 0.36 ? smooth(raw / 0.36) : 0;
        const stabT = raw >= 0.36 ? easeOutBack((raw - 0.36) / 0.64) : 0;
        rTarget.set(
          THREE.MathUtils.lerp(0.11, 0.05, stabT) + cock * 0.03,
          THREE.MathUtils.lerp(-0.05, -0.14, stabT) + cock * 0.065,
          THREE.MathUtils.lerp(-0.30, -0.40, stabT) + cock * 0.04
        );
        rRot.set(THREE.MathUtils.lerp(0.20, -0.44, stabT) + cock * 0.18, -0.16, THREE.MathUtils.lerp(0.18, 0.06, stabT));
        // Left hand moves down-left to brace teammate's shoulder
        lStyle = 'slapOpen';
        const braceT = smooth(raw);
        lTarget.set(THREE.MathUtils.lerp(-0.20, -0.14, braceT), THREE.MathUtils.lerp(-0.20, -0.17, braceT), THREE.MathUtils.lerp(-0.30, -0.38, braceT));
        lRot.set(-0.36, 0.22, -0.10);
      } else if (p < 0.88) {
        // Hold syringe seated while thumb firmly depresses plunger & fluid drains
        rStyle = 'syringePlunge';
        lStyle = 'slapOpen';
        const tremor = Math.sin(p * 64) * 0.0022;
        rTarget.set(0.05 + tremor, -0.142 - injectEase * 0.014, -0.40 - injectEase * 0.008);
        rRot.set(-0.46 - injectEase * 0.08, -0.16, 0.06);
        lTarget.set(-0.14, -0.17, -0.38);
        lRot.set(-0.38, 0.22, -0.10);
      } else {
        // Crisp pull-out & stow as ally stands up!
        const outT = smooth((p - 0.88) / 0.12);
        rTarget.set(THREE.MathUtils.lerp(0.05, 0.24, outT), THREE.MathUtils.lerp(-0.155, -0.26, outT), THREE.MathUtils.lerp(-0.41, -0.30, outT));
        rRot.set(THREE.MathUtils.lerp(-0.54, 0.15, outT), -0.18, 0.16);
        lStyle = 'slapOpen';
        lTarget.set(THREE.MathUtils.lerp(-0.14, -0.26, outT), THREE.MathUtils.lerp(-0.17, -0.28, outT), THREE.MathUtils.lerp(-0.38, -0.26, outT));
        lRot.set(-0.25, 0.15, -0.10);
      }
    }

    const rate = Math.min(1, dt * 22);
    if (this.reviveHandR && this.reviveArmR) {
      if (this.reviveHandR.userData) this.reviveHandR.userData.activeStyle = rStyle;
      this.reviveHandR.position.lerp(rTarget, rate);
      this.reviveHandR.rotation.x = THREE.MathUtils.lerp(this.reviveHandR.rotation.x, rRot.x, rate);
      this.reviveHandR.rotation.y = THREE.MathUtils.lerp(this.reviveHandR.rotation.y, rRot.y, rate);
      this.reviveHandR.rotation.z = THREE.MathUtils.lerp(this.reviveHandR.rotation.z, rRot.z, rate);
      const rShoulder = new THREE.Vector3(0.29, -0.30, -0.02);
      const rWrist = this.reviveHandR.position.clone().add(new THREE.Vector3(0.012, -0.010, 0.038));
      this._currentAimHand = this.reviveHandR;
      this._aimArm(this.reviveArmR, rShoulder, rWrist);
      this._currentAimHand = null;
    }
    if (this.reviveHandL && this.reviveArmL) {
      this.reviveHandL.visible = showLeft;
      this.reviveArmL.visible = showLeft;
      if (showLeft) {
        if (this.reviveHandL.userData) this.reviveHandL.userData.activeStyle = lStyle;
        this.reviveHandL.position.lerp(lTarget, rate);
        this.reviveHandL.rotation.x = THREE.MathUtils.lerp(this.reviveHandL.rotation.x, lRot.x, rate);
        this.reviveHandL.rotation.y = THREE.MathUtils.lerp(this.reviveHandL.rotation.y, lRot.y, rate);
        this.reviveHandL.rotation.z = THREE.MathUtils.lerp(this.reviveHandL.rotation.z, lRot.z, rate);
        const lShoulder = new THREE.Vector3(-0.29, -0.30, -0.02);
        const lWrist = this.reviveHandL.position.clone().add(new THREE.Vector3(-0.012, -0.010, 0.038));
        this._currentAimHand = this.reviveHandL;
        this._aimArm(this.reviveArmL, lShoulder, lWrist);
        this._currentAimHand = null;
      }
    }

    return true;
  }

  _addWeaponIronSights(group, weaponId, sightY, hasOptic = false, extra = {}) {
    const sightMat = new THREE.MeshLambertMaterial({ color: 0x14171a });
    const steelSightMat = new THREE.MeshLambertMaterial({ color: 0x2a2e33 });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf4f7f5 });
    const tritGreen = new THREE.MeshBasicMaterial({ color: 0x55ff66 });
    const tritOrange = new THREE.MeshBasicMaterial({ color: 0xff6e2e });

    const ironGroup = new THREE.Group();

    if (weaponId === 'g17') {
      // Authentic Glock 17: white U-outline dovetail rear sight + white-dot front blade seated flush on slide
      const rearZ = extra.rearZ ?? 0.102;
      const frontZ = extra.frontZ ?? -0.104;
      const slideTopY = extra.baseY ?? 0.019;
      const rearBase = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0028, 0.009), sightMat);
      rearBase.position.set(0, slideTopY + 0.0012, rearZ);
      const earL = new THREE.Mesh(new THREE.BoxGeometry(0.0052, 0.0058, 0.0085), sightMat);
      earL.position.set(-0.0062, slideTopY + 0.0046, rearZ);
      const earR = new THREE.Mesh(new THREE.BoxGeometry(0.0052, 0.0058, 0.0085), sightMat);
      earR.position.set(0.0062, slideTopY + 0.0046, rearZ);
      // Iconic white Glock U-outline around notch
      const uBot = new THREE.Mesh(new THREE.BoxGeometry(0.0096, 0.0013, 0.0008), whiteMat);
      uBot.position.set(0, slideTopY + 0.0024, rearZ + 0.0045);
      const uL = new THREE.Mesh(new THREE.BoxGeometry(0.0013, 0.0045, 0.0008), whiteMat);
      uL.position.set(-0.0042, slideTopY + 0.0046, rearZ + 0.0045);
      const uR = new THREE.Mesh(new THREE.BoxGeometry(0.0013, 0.0045, 0.0008), whiteMat);
      uR.position.set(0.0042, slideTopY + 0.0046, rearZ + 0.0045);

      const fBlade = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.0062, 0.008), sightMat);
      fBlade.position.set(0, slideTopY + 0.0036, frontZ);
      const fDot = new THREE.Mesh(new THREE.CircleGeometry(0.0012, 10), whiteMat);
      fDot.position.set(0, slideTopY + 0.0050, frontZ + 0.0042);

      ironGroup.add(rearBase, earL, earR, uBot, uL, uR, fBlade, fDot);
    } else if (weaponId === 'pm9') {
      // Authentic PM-9 Makarov: compact rounded dovetail rear notch + integral sloped front blade flush on slide
      const rearZ = extra.rearZ ?? 0.088;
      const frontZ = extra.frontZ ?? -0.090;
      const slideTopY = extra.baseY ?? 0.019;
      const rearBlock = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.0024, 0.007), steelSightMat);
      rearBlock.position.set(0, slideTopY + 0.001, rearZ);
      const earL = new THREE.Mesh(new THREE.BoxGeometry(0.0046, 0.0048, 0.0068), steelSightMat);
      earL.position.set(-0.0048, slideTopY + 0.0038, rearZ);
      const earR = new THREE.Mesh(new THREE.BoxGeometry(0.0046, 0.0048, 0.0068), steelSightMat);
      earR.position.set(0.0048, slideTopY + 0.0038, rearZ);
      // Sloped Makarov front blade
      const fBlade = new THREE.Mesh(new THREE.BoxGeometry(0.0024, 0.0052, 0.010), steelSightMat);
      fBlade.position.set(0, slideTopY + 0.0030, frontZ);
      const fDot = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.0018, 0.0012), tritOrange);
      fDot.position.set(0, slideTopY + 0.0046, frontZ + 0.0052);

      ironGroup.add(rearBlock, earL, earR, fBlade, fDot);
    } else if (weaponId === 'mp5k') {
      // Authentic H&K MP5K: rotary diopter drum rear sight on receiver + circular hooded front sight on cocking tube
      const rearBaseY = 0.029;
      const frontBaseY = 0.022;
      const rearPivot = new THREE.Group();
      rearPivot.position.set(0, rearBaseY, 0.115);
      const baseClamp = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, 0.026), steelSightMat);
      baseClamp.position.set(0, 0.002, 0);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.009, 0.012, 16), sightMat);
      drum.position.set(0, 0.009, 0);
      const drumAperture = new THREE.Mesh(new THREE.TorusGeometry(0.0046, 0.0016, 8, 16), sightMat);
      drumAperture.position.set(0, 0.014, 0.004);
      rearPivot.add(baseClamp, drum, drumAperture);

      const frontPivot = new THREE.Group();
      frontPivot.position.set(0, frontBaseY, -0.252);
      const tripleBase = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.018), steelSightMat);
      tripleBase.position.set(0, 0.006, 0);
      const hood = new THREE.Mesh(new THREE.TorusGeometry(0.0092, 0.0018, 8, 20), sightMat);
      hood.position.set(0, 0.021, 0);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.010, 0.0024), sightMat);
      post.position.set(0, 0.016, 0);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.0020, 0.0020, 0.0028), tritOrange);
      tip.position.set(0, 0.021, 0);
      frontPivot.add(tripleBase, hood, post, tip);

      if (hasOptic) {
        // Fold sights cleanly down out of the optic sightline
        rearPivot.rotation.x = -Math.PI / 2.2;
        rearPivot.position.y = rearBaseY - 0.003;
        frontPivot.rotation.x = Math.PI / 2.2;
        frontPivot.position.y = frontBaseY + 0.002;
      }
      frontPivot.traverse((ch) => { if (ch.isMesh) ch.renderOrder = -20; });
      ironGroup.add(rearPivot, frontPivot);
    } else if (weaponId === 'ak74m') {
      // Authentic AK-74M: rear tangent leaf sight block on front trunnion + hooded front sight block on barrel
      const rearPivot = new THREE.Group();
      rearPivot.position.set(0, 0.032, -0.095);
      const trunnionBlock = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.010, 0.036), steelSightMat);
      trunnionBlock.position.set(0, 0.003, 0);
      const leafL = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.0065, 0.026), sightMat);
      leafL.position.set(-0.0042, 0.010, 0.002);
      const leafR = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.0065, 0.026), sightMat);
      leafR.position.set(0.0042, 0.010, 0.002);
      const slider = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.003, 0.007), steelSightMat);
      slider.position.set(0, 0.0085, -0.004);
      rearPivot.add(trunnionBlock, leafL, leafR, slider);

      const frontPivot = new THREE.Group();
      frontPivot.position.set(0, 0.010, -0.495);
      // Tapered AK front sight base connecting directly to barrel
      const fsbTower = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.026, 0.024), steelSightMat);
      fsbTower.position.set(0, 0.013, 0);
      const earL = new THREE.Mesh(new THREE.BoxGeometry(0.0024, 0.014, 0.012), sightMat);
      earL.position.set(-0.0065, 0.032, 0);
      earL.rotation.z = -0.18;
      const earR = new THREE.Mesh(new THREE.BoxGeometry(0.0024, 0.014, 0.012), sightMat);
      earR.position.set(0.0065, 0.032, 0);
      earR.rotation.z = 0.18;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.012, 0.0024), sightMat);
      post.position.set(0, 0.030, 0);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.0020, 0.0022, 0.0028), tritOrange);
      tip.position.set(0, 0.0355, 0);
      frontPivot.add(fsbTower, earL, earR, post, tip);

      if (hasOptic) {
        rearPivot.rotation.x = -Math.PI / 2.3;
        rearPivot.position.y = 0.027;
        frontPivot.rotation.x = Math.PI / 2.15;
        frontPivot.position.y = 0.014;
      }
      frontPivot.traverse((ch) => { if (ch.isMesh) ch.renderOrder = -20; });
      ironGroup.add(rearPivot, frontPivot);
    } else if (weaponId === 'm870') {
      // Authentic M870 Tactical: ghost-ring rear aperture with protective wings + ramped front tritium blade flush on barrel
      const rearPivot = new THREE.Group();
      rearPivot.position.set(0, 0.028, 0.105);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.005, 0.022), steelSightMat);
      base.position.set(0, 0.002, 0);
      const ghostRing = new THREE.Mesh(new THREE.TorusGeometry(0.0065, 0.0018, 8, 18), sightMat);
      ghostRing.position.set(0, 0.014, 0);
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.0024, 0.014, 0.012), sightMat);
      wingL.position.set(-0.0092, 0.012, 0);
      const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.0024, 0.014, 0.012), sightMat);
      wingR.position.set(0.0092, 0.012, 0);
      rearPivot.add(base, ghostRing, wingL, wingR);

      const frontPivot = new THREE.Group();
      frontPivot.position.set(0, 0.026, -0.565);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.010, 0.026), steelSightMat);
      ramp.position.set(0, 0.004, 0);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.0026, 0.011, 0.007), sightMat);
      blade.position.set(0, 0.012, -0.004);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0016, 10), tritGreen);
      dot.position.set(0, 0.0155, -0.0002);
      frontPivot.add(ramp, blade, dot);

      if (hasOptic) {
        rearPivot.rotation.x = -Math.PI / 2.2;
        rearPivot.position.y = 0.026;
        frontPivot.rotation.x = Math.PI / 2.2;
        frontPivot.position.y = 0.024;
      }
      frontPivot.traverse((ch) => { if (ch.isMesh) ch.renderOrder = -20; });
      ironGroup.add(rearPivot, frontPivot);
    } else if (weaponId === 'mosin9130') {
      // M91/30 Mosin-Nagant: classic tangent leaf rear notch + hooded front globe post
      const rearPivot = new THREE.Group();
      rearPivot.position.set(0, 0.032, -0.09);
      const rBase = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.005, 0.044), steelSightMat);
      const leafL = new THREE.Mesh(new THREE.BoxGeometry(0.0046, 0.011, 0.008), sightMat);
      leafL.position.set(-0.0042, 0.007, 0.014);
      const leafR = new THREE.Mesh(new THREE.BoxGeometry(0.0046, 0.011, 0.008), sightMat);
      leafR.position.set(0.0042, 0.007, 0.014);
      rearPivot.add(rBase, leafL, leafR);

      const frontPivot = new THREE.Group();
      frontPivot.position.set(0, 0.025, -0.61);
      const fBase = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.010, 0.018), steelSightMat);
      const fHood = new THREE.Mesh(new THREE.TorusGeometry(0.0085, 0.0014, 6, 14), sightMat);
      fHood.position.set(0, 0.013, 0);
      const fPost = new THREE.Mesh(new THREE.BoxGeometry(0.0016, 0.012, 0.0025), sightMat);
      fPost.position.set(0, 0.011, 0);
      frontPivot.add(fBase, fHood, fPost);
      frontPivot.traverse((ch) => { if (ch.isMesh) ch.renderOrder = -20; });
      ironGroup.add(rearPivot, frontPivot);
    } else {
      // M24 / AWM .338: folding backup micro-peep rear + hooded front blade (always folded flat when optic mounted)
      const rearPivot = new THREE.Group();
      rearPivot.position.set(0, 0.036, 0.11);
      const rBase = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.005, 0.018), steelSightMat);
      const rRing = new THREE.Mesh(new THREE.TorusGeometry(0.0052, 0.0015, 8, 16), sightMat);
      rRing.position.set(0, 0.011, 0);
      rearPivot.add(rBase, rRing);

      const frontPivot = new THREE.Group();
      frontPivot.position.set(0, 0.026, -0.57);
      const fBase = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.010, 0.020), steelSightMat);
      const fPost = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.012, 0.003), sightMat);
      fPost.position.set(0, 0.011, 0);
      frontPivot.add(fBase, fPost);

      if (hasOptic) {
        rearPivot.rotation.x = -Math.PI / 2.15;
        frontPivot.rotation.x = Math.PI / 2.15;
      }
      frontPivot.traverse((ch) => { if (ch.isMesh) ch.renderOrder = -20; });
      ironGroup.add(rearPivot, frontPivot);
    }

    group.add(ironGroup);
    return ironGroup;
  }

  _addScope(group, scopeY, style = 'lpvo', receiverTopY = 0.030, withHands = true) {
    // High-precision watertight LatheGeometry scope tube + wide-aperture ADS optical ocular assembly (v2.54)
    const scopeOuterMat = new THREE.MeshLambertMaterial({ color: 0x1a1e22 });
    const scopeInnerMat = new THREE.MeshLambertMaterial({ color: 0x090a0c, side: THREE.BackSide });
    const ringMat = new THREE.MeshLambertMaterial({ color: 0x262a2f });
    const accentMat = new THREE.MeshLambertMaterial({ color: 0x3a4047 });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x7cb8e8, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
    const reticleMat = new THREE.MeshBasicMaterial({ color: 0x0b0b0b });
    const illumMat = new THREE.MeshBasicMaterial({ color: 0xff2b2b });

    const isSniper = style === 'sniper';
    const isAcog = style === 'acog';
    const rTube = isSniper ? 0.0190 : (isAcog ? 0.0170 : 0.0175);
    const rFront = isSniper ? 0.0265 : (isAcog ? 0.0215 : 0.0215);
    const rRear = isSniper ? 0.0260 : (isAcog ? 0.0225 : 0.0242);
    const len = isSniper ? 0.275 : (isAcog ? 0.135 : 0.215);
    const zCenter = isSniper ? -0.025 : (isAcog ? 0.015 : -0.005);
    const wall = isSniper ? 0.0029 : (isAcog ? 0.0026 : 0.0028);
    const rEye = rRear - wall;

    // Build continuous smooth Lathe profile along Y, then rotateX(+PI/2) so +Y becomes +Z (rear eyepiece) and -Y becomes -Z (front objective)!
    const half = len * 0.5;
    const rearZ = zCenter + half;
    const outerPts = [
      new THREE.Vector2(rFront - wall, -half),
      new THREE.Vector2(rFront, -half),
      new THREE.Vector2(rFront, -half * 0.56),
      new THREE.Vector2(rTube, -half * 0.34),
      new THREE.Vector2(rTube, half * 0.42),
      new THREE.Vector2(rRear, half * 0.62),
      new THREE.Vector2(rRear, half),
      new THREE.Vector2(rEye, half),
      new THREE.Vector2(rEye, half * 0.62),
      new THREE.Vector2(rTube - wall, half * 0.42),
      new THREE.Vector2(rTube - wall, -half * 0.34),
      new THREE.Vector2(rFront - wall, -half * 0.56),
      new THREE.Vector2(rFront - wall, -half)
    ];
    const bodyGeo = new THREE.LatheGeometry(outerPts, 32);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMesh = new THREE.Mesh(bodyGeo, scopeOuterMat);
    bodyMesh.position.set(0, scopeY, zCenter);

    // Solid dark inner bore liner so interior never leaks sky/background light in hipfire/inspect/3P
    const boreGeo = new THREE.CylinderGeometry(rTube - wall + 0.0002, rTube - wall + 0.0002, len * 0.86, 24, 1, true);
    boreGeo.rotateX(Math.PI / 2);
    const boreMesh = new THREE.Mesh(boreGeo, scopeInnerMat);
    boreMesh.position.set(0, scopeY, zCenter);

    // Solid cantilever Picatinny rail mount + twin scope ring clamps seated flush onto receiverTopY
    const mountH = Math.max(0.010, (scopeY - rTube) - receiverTopY);
    const railBase = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.007, len * 0.54), ringMat);
    railBase.position.set(0, receiverTopY + 0.0035, zCenter);

    const ringGeo = new THREE.TorusGeometry(rTube + 0.0022, 0.0030, 10, 24);
    const stanchionGeo = new THREE.BoxGeometry(0.016, mountH + 0.006, 0.018);
    const ringOff = len * 0.19;
    const ringF = new THREE.Mesh(ringGeo, ringMat);
    ringF.position.set(0, scopeY, zCenter - ringOff);
    const ringR = new THREE.Mesh(ringGeo, ringMat);
    ringR.position.set(0, scopeY, zCenter + ringOff);
    const stanF = new THREE.Mesh(stanchionGeo, ringMat);
    stanF.position.set(0, receiverTopY + mountH * 0.5 + 0.003, zCenter - ringOff);
    const stanR = new THREE.Mesh(stanchionGeo, ringMat);
    stanR.position.set(0, receiverTopY + mountH * 0.5 + 0.003, zCenter + ringOff);

    // Crisp cylindrical elevation & windage tactical turrets + magnification throw ring
    const elevTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.0058, 0.0064, 0.011, 16), accentMat);
    elevTurret.position.set(0, scopeY + rTube + 0.0045, zCenter);
    const windTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.0054, 0.0060, 0.010, 16), accentMat);
    windTurret.rotation.z = Math.PI / 2;
    windTurret.position.set(rTube + 0.0045, scopeY, zCenter);
    const magRing = new THREE.Mesh(new THREE.TorusGeometry(rRear * 0.96, 0.0018, 8, 28), accentMat);
    magRing.position.set(0, scopeY, zCenter + half * 0.68);

    // Subtle anti-reflective objective lens disc
    const lens = new THREE.Mesh(new THREE.CircleGeometry(rFront - wall - 0.0005, 24), glassMat);
    lens.position.set(0, scopeY, zCenter - half * 0.88);

    // Wide-aperture ADS optical eye-box assembly at rear ocular plane (eliminates straw-tunnel pinch!)
    // Depth-only circular hole mask writes rear ocular depth FIRST (renderOrder=-10) without modifying zoomed world color,
    // cleanly clipping forward scope rings/tube/barrel out of the glass window while keeping the 3D outer bezel & world intact!
    const holeMaskMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
    const ocularHoleMask = new THREE.Mesh(new THREE.CircleGeometry(rEye + 0.0002, 64), holeMaskMat);
    ocularHoleMask.position.set(0, scopeY, rearZ - 0.0005);
    ocularHoleMask.renderOrder = -10;
    ocularHoleMask.visible = false;

    const rBezelIn = rEye - 0.0006;
    const rBezelOut = rRear + 0.0030;
    const rShadowOut = rEye + 0.0030;

    // Cached radial-gradient eye-box shadow texture extending underneath the inner rim of ocularBezel (zero rim gap!)
    if (!window._ashfallScopeShadowTex && typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx2d = c.getContext('2d');
      const grad = ctx2d.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0.00, 'rgba(4, 5, 7, 0.0)');
      grad.addColorStop(0.58, 'rgba(4, 5, 7, 0.0)');
      grad.addColorStop(0.70, 'rgba(4, 5, 7, 0.34)');
      grad.addColorStop(0.78, 'rgba(4, 5, 7, 0.86)');
      grad.addColorStop(0.83, 'rgba(4, 5, 7, 1.0)');
      grad.addColorStop(1.00, 'rgba(4, 5, 7, 1.0)');
      ctx2d.fillStyle = grad;
      ctx2d.fillRect(0, 0, 256, 256);
      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      window._ashfallScopeShadowTex = tex;
    }

    const shadowRingMat = new THREE.MeshBasicMaterial({
      map: window._ashfallScopeShadowTex || null,
      color: window._ashfallScopeShadowTex ? 0xffffff : 0x040507,
      transparent: true,
      opacity: 1.0,
      depthWrite: false
    });
    const shadowRing = new THREE.Mesh(new THREE.CircleGeometry(rShadowOut, 64), shadowRingMat);
    shadowRing.position.set(0, scopeY, rearZ + 0.0002);
    shadowRing.renderOrder = 4;
    shadowRing.visible = false;

    const bezelMat = new THREE.MeshBasicMaterial({ color: 0x040507 });
    const ocularBezel = new THREE.Mesh(new THREE.RingGeometry(rBezelIn, rBezelOut, 64), bezelMat);
    ocularBezel.position.set(0, scopeY, rearZ + 0.0006);
    ocularBezel.renderOrder = 6;
    ocularBezel.visible = false;

    // Razor-sharp optical reticle centered cleanly at the rear ocular focal plane (scales edge-to-edge with scope!)
    const retR = rEye * 0.97;
    const retGroup = new THREE.Group();
    retGroup.position.set(0, scopeY, rearZ + 0.0012);
    retGroup.visible = false;

    const addRetPart = (mesh) => {
      mesh.renderOrder = 10;
      retGroup.add(mesh);
      return mesh;
    };

    if (isAcog) {
      // TA-31 3x Prism: glowing red chevron + crisp BDC vertical drop line + outer horizontal stadia guides
      const chevL = new THREE.Mesh(new THREE.BoxGeometry(0.0026, 0.00032, 0.0002), illumMat);
      chevL.position.set(-0.00095, -0.00080, 0.0002);
      chevL.rotation.z = 0.72;
      const chevR = new THREE.Mesh(new THREE.BoxGeometry(0.0026, 0.00032, 0.0002), illumMat);
      chevR.position.set(0.00095, -0.00080, 0.0002);
      chevR.rotation.z = -0.72;
      const bdcV = new THREE.Mesh(new THREE.BoxGeometry(0.00022, retR * 0.76, 0.0002), reticleMat);
      bdcV.position.set(0, -retR * 0.46, 0);
      addRetPart(chevL); addRetPart(chevR); addRetPart(bdcV);
      // Outer horizontal target-lead posts
      const postLen = retR * 0.50;
      const hL = new THREE.Mesh(new THREE.BoxGeometry(postLen, 0.00032, 0.0002), reticleMat);
      hL.position.set(-(retR - postLen * 0.5), 0, 0);
      const hR = new THREE.Mesh(new THREE.BoxGeometry(postLen, 0.00032, 0.0002), reticleMat);
      hR.position.set(retR - postLen * 0.5, 0, 0);
      addRetPart(hL); addRetPart(hR);
      [-0.0038, -0.0068, -0.0098, -0.0128].forEach((dy, idx) => {
        const w = 0.0032 - idx * 0.00045;
        const hash = new THREE.Mesh(new THREE.BoxGeometry(w, 0.00024, 0.0002), reticleMat);
        hash.position.set(0, dy, 0);
        addRetPart(hash);
      });
      // Glowing fiber-optic light pipe on top of TA-31 prism
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.0020, 0.0020, 0.048, 12), illumMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(0, scopeY + rTube + 0.0038, zCenter - 0.018);
      group.add(pipe);
    } else if (isSniper) {
      // Precision 6x / 8x Sniper: ultra-clean full-diameter mil-dot crosshair + bold outer duplex posts + micro red center dot
      addRetPart(new THREE.Mesh(new THREE.BoxGeometry(retR * 1.98, 0.00022, 0.0002), reticleMat));
      addRetPart(new THREE.Mesh(new THREE.BoxGeometry(0.00022, retR * 1.98, 0.0002), reticleMat));
      // Thick outer duplex posts framing the periphery
      const dupLen = retR * 0.46;
      const dupOff = retR - dupLen * 0.5;
      const dL = new THREE.Mesh(new THREE.BoxGeometry(dupLen, 0.00054, 0.0002), reticleMat); dL.position.set(-dupOff, 0, 0);
      const dR = new THREE.Mesh(new THREE.BoxGeometry(dupLen, 0.00054, 0.0002), reticleMat); dR.position.set(dupOff, 0, 0);
      const dB = new THREE.Mesh(new THREE.BoxGeometry(0.00054, dupLen, 0.0002), reticleMat); dB.position.set(0, -dupOff, 0);
      const dT = new THREE.Mesh(new THREE.BoxGeometry(0.00054, dupLen, 0.0002), reticleMat); dT.position.set(0, dupOff, 0);
      addRetPart(dL); addRetPart(dR); addRetPart(dB); addRetPart(dT);
      const centerDot = new THREE.Mesh(new THREE.CircleGeometry(0.00042, 12), illumMat);
      centerDot.position.z = 0.0003;
      addRetPart(centerDot);
      // Graduated mil-dot elevation & windage ticks
      [-0.50, -0.36, -0.22, -0.10, 0.10, 0.22, 0.36, 0.50].forEach((frac) => {
        const off = retR * frac;
        const tLen = Math.abs(frac) === 0.22 || Math.abs(frac) === 0.50 ? 0.0014 : 0.0009;
        const tickV = new THREE.Mesh(new THREE.BoxGeometry(tLen, 0.00022, 0.0002), reticleMat);
        tickV.position.set(0, off, 0);
        const tickH = new THREE.Mesh(new THREE.BoxGeometry(0.00022, tLen, 0.0002), reticleMat);
        tickH.position.set(off, 0, 0);
        addRetPart(tickV); addRetPart(tickH);
      });
    } else {
      // Vortex 1-4x LPVO: bold outer duplex posts + fine inner hairline + glowing red tactical ring & micro center dot
      const ringR = 0.0028;
      const stadiaGap = 0.0042;
      const stadiaLen = Math.max(0.003, retR - stadiaGap);
      const hL = new THREE.Mesh(new THREE.BoxGeometry(stadiaLen, 0.00024, 0.0002), reticleMat);
      hL.position.set(-(stadiaGap + stadiaLen * 0.5), 0, 0);
      const hR = new THREE.Mesh(new THREE.BoxGeometry(stadiaLen, 0.00024, 0.0002), reticleMat);
      hR.position.set(stadiaGap + stadiaLen * 0.5, 0, 0);
      const vB = new THREE.Mesh(new THREE.BoxGeometry(0.00024, stadiaLen, 0.0002), reticleMat);
      vB.position.set(0, -(stadiaGap + stadiaLen * 0.5), 0);
      const vT = new THREE.Mesh(new THREE.BoxGeometry(0.00022, stadiaLen * 0.65, 0.0002), reticleMat);
      vT.position.set(0, retR - (stadiaLen * 0.65) * 0.5, 0);
      // Outer duplex reinforcement bars
      const dupLen = retR * 0.44;
      const dupOff = retR - dupLen * 0.5;
      const oL = new THREE.Mesh(new THREE.BoxGeometry(dupLen, 0.00048, 0.0002), reticleMat); oL.position.set(-dupOff, 0, 0);
      const oR = new THREE.Mesh(new THREE.BoxGeometry(dupLen, 0.00048, 0.0002), reticleMat); oR.position.set(dupOff, 0, 0);
      const oB = new THREE.Mesh(new THREE.BoxGeometry(0.00048, dupLen, 0.0002), reticleMat); oB.position.set(0, -dupOff, 0);
      const microRing = new THREE.Mesh(new THREE.RingGeometry(ringR - 0.00028, ringR, 32), illumMat);
      microRing.position.z = 0.0002;
      const centerDot = new THREE.Mesh(new THREE.CircleGeometry(0.00042, 12), illumMat);
      centerDot.position.z = 0.0003;
      addRetPart(hL); addRetPart(hR); addRetPart(vB); addRetPart(vT);
      addRetPart(oL); addRetPart(oR); addRetPart(oB);
      addRetPart(microRing); addRetPart(centerDot);
      [-0.26, -0.44, -0.62].forEach((frac, idx) => {
        const tick = new THREE.Mesh(new THREE.BoxGeometry(0.0018 - idx * 0.0003, 0.00022, 0.0002), reticleMat);
        tick.position.set(0, retR * frac, 0);
        addRetPart(tick);
      });
    }

    group.add(bodyMesh, boreMesh, railBase, ringF, ringR, stanF, stanR, elevTurret, windTurret, magRing, lens, ocularHoleMask, ocularBezel, shadowRing, retGroup);
    if (withHands) {
      this.scopeOptic = {
        style,
        scopeY,
        rearZ,
        rEye,
        holeMask: ocularHoleMask,
        bezel: ocularBezel,
        shadowRing,
        boreMesh,
        retGroup
      };
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

    // 1. Optic (pass exact receiver top height so scope stanchions bolt flush to the receiver!)
    const isLongRifle = weaponDef.id === 'm24' || weaponDef.id === 'awm338' || weaponDef.id === 'mosin9130';
    const recTopY = (weaponDef.id === 'm24' || weaponDef.id === 'awm338') ? 0.038 : (weaponDef.id === 'mosin9130' ? 0.032 : (weaponDef.id === 'ak74m' ? 0.034 : (weaponDef.id === 'm870' ? 0.028 : 0.029)));
    if (mods.optic === 'red_dot') {
      if (weaponDef.slot === 'secondary' && this.boltMesh) {
        const y = 0.036;
        this._addRedDot(this.boltMesh, y, 0.04);
        this.sightHeight = y + this.boltMesh.position.y;
      } else {
        const y = isLongRifle ? 0.064 : 0.056;
        this._addRedDot(g, y, 0.02);
        this.sightHeight = y;
      }
    } else if (mods.optic === 'holo' && weaponDef.slot !== 'secondary') {
      const y = isLongRifle ? 0.068 : 0.060;
      this._addHolo(g, y, 0.02);
      this.sightHeight = y;
    } else if (mods.optic === 'acog_2x' && weaponDef.slot !== 'secondary') {
      const y = isLongRifle ? 0.072 : 0.064;
      this._addScope(g, y, 'acog', recTopY, withHands);
      this.sightHeight = y;
    } else if (mods.optic === 'lpvo_4x' && weaponDef.slot !== 'secondary') {
      const y = isLongRifle ? 0.074 : 0.066;
      this._addScope(g, y, 'lpvo', recTopY, withHands);
      this.sightHeight = y;
    } else if (mods.optic === 'sniper_8x' && weaponDef.slot !== 'secondary') {
      const y = isLongRifle ? 0.078 : 0.070;
      this._addScope(g, y, 'sniper', recTopY, withHands);
      this.sightHeight = y;
    }

    // 2. Muzzle (renderOrder=-20 so barrel-mounted muzzle brakes/suppressors stay visible in bottom of magnified scopes!)
    const mz = this.muzzleMesh.position;
    if (mods.muzzle === 'suppressor') {
      const supLen = weaponDef.slot === 'secondary' ? 0.12 : 0.16;
      const supRad = weaponDef.slot === 'secondary' ? 0.014 : 0.017;
      const sup = new THREE.Mesh(new THREE.CylinderGeometry(supRad, supRad, supLen, 12), matDark);
      sup.rotation.x = Math.PI / 2;
      sup.position.set(mz.x, mz.y, mz.z - supLen / 2 + 0.02);
      sup.renderOrder = -20;
      g.add(sup);
      this.muzzleMesh.position.z -= supLen - 0.01;
      this.muzzleFlash.position.z -= supLen - 0.01;
    } else if (mods.muzzle === 'compensator') {
      const comp = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.048), matSteel);
      comp.position.set(mz.x, mz.y, mz.z - 0.012);
      comp.renderOrder = -20;
      g.add(comp);
      this.muzzleMesh.position.z -= 0.03;
      this.muzzleFlash.position.z -= 0.03;
    }

    // 3. Underbarrel
    this.hasVertGrip = false;
    this.foregripAnchor = null;
    if (mods.underbarrel === 'vert_grip' && weaponDef.slot !== 'secondary') {
      this.hasVertGrip = true;
      const isTrenchGun = weaponDef.id === 'm870';
      const gripZ = isTrenchGun
        ? -0.24
        : (weaponDef.id === 'mp5k' ? -0.175 : ((weaponDef.id === 'awm338' || weaponDef.id === 'm24') ? -0.185 : -0.215));
      const collarWorldY = isTrenchGun
        ? -0.039
        : (weaponDef.id === 'mp5k' ? -0.036 : (weaponDef.id === 'ak74m' ? -0.024 : -0.031));

      // Sculpted RK-1 Tactical Vertical Foregrip (Picatinny clamp collar + contoured ribbed post + flared endcap)
      const vGripGroup = new THREE.Group();
      const railClamp = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.014, 0.044), matDark);
      railClamp.position.set(0, -0.004, 0);
      const clampBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.034, 8), matSteel);
      clampBolt.rotation.z = Math.PI / 2;
      clampBolt.position.set(0, -0.004, 0);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0150, 0.082, 12), matDark);
      shaft.position.set(0, -0.046, 0);
      const baseCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0168, 0.0150, 0.010, 12), matSteel);
      baseCap.position.set(0, -0.088, 0);
      // Exact geometric center anchor on the vertical foregrip shaft (moves automatically with M870 pump slide!)
      const fgAnchor = new THREE.Object3D();
      fgAnchor.position.set(0, -0.046, 0);
      vGripGroup.add(railClamp, clampBolt, shaft, baseCap, fgAnchor);
      for (let r = 0; r < 3; r++) {
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.0156, 0.0156, 0.005, 12), matSteel);
        rib.position.set(0, -0.030 - r * 0.018, 0);
        vGripGroup.add(rib);
      }
      this.foregripAnchor = fgAnchor;

      if (isTrenchGun && this.boltMesh) {
        // Parent directly onto the M870 sliding pump so the vertical foregrip moves 1:1 when pumping the slide!
        vGripGroup.position.set(0, collarWorldY - this.boltRestPos.y, gripZ - this.boltRestPos.z);
        this.boltMesh.add(vGripGroup);
      } else {
        vGripGroup.position.set(0, collarWorldY, gripZ);
        g.add(vGripGroup);
      }

      // Reposition & reshape operator's support hand to wrap solidly around the exact center of the vertical foregrip shaft!
      if (withHands && this.leftHand) {
        g.remove(this.leftHand);
        this.leftHand = this._createHand(false, 'foregrip');
        this.leftHand.position.set(0.0, collarWorldY - 0.046, gripZ);
        this.leftHand.rotation.set(0, 0, 0);
        this.leftHandRestPos.copy(this.leftHand.position);
        this.leftHandRestRot.copy(this.leftHand.rotation);
        g.add(this.leftHand);
      }
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
    if (mods.magazine === 'ext_mag') {
      if (weaponDef.id === 'm870') {
        // Shotgun extended magazine: extend the lower under-barrel magazine tube + barrel clamp + knurled cap (NEVER enlarge the reload shell!)
        const extTube = new THREE.Mesh(new THREE.CylinderGeometry(0.0132, 0.0132, 0.145, 14), matSteel);
        extTube.rotation.x = Math.PI / 2;
        extTube.position.set(0, -0.016, -0.575);
        const coupling = new THREE.Mesh(new THREE.CylinderGeometry(0.0152, 0.0152, 0.022, 14), matDark);
        coupling.rotation.x = Math.PI / 2;
        coupling.position.set(0, -0.016, -0.515);
        const endCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0138, 0.0138, 0.016, 14), matDark);
        endCap.rotation.x = Math.PI / 2;
        endCap.position.set(0, -0.016, -0.648);
        const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.052, 0.018), matDark);
        clamp.position.set(0, -0.001, -0.555);
        g.add(extTube, coupling, endCap, clamp);
      } else if (weaponDef.id !== 'ak74m' && this.magMesh) {
        this.magMesh.scale.y = 1.28;
        this.magMesh.position.y -= 0.018;
        this.magRestPos.copy(this.magMesh.position);
        if (this.spareMagMesh) {
          this.spareMagMesh.scale.y = 1.28;
          this.spareMagMesh.position.y -= 0.018;
        }
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
      if (!window._weaponFinishTex) {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#e6e6e6';
        ctx.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 1800; i++) {
          const v = 212 + Math.floor(Math.random() * 32);
          ctx.fillStyle = `rgba(${v},${v},${v},0.32)`;
          ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 1.5);
        }
        // Edge-wear micro-scratches
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 18; i++) {
          const x = Math.random() * 128;
          const y = Math.random() * 128;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (Math.random() - 0.5) * 26, y + (Math.random() - 0.5) * 6);
          ctx.stroke();
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        window._weaponFinishTex = tex;
      }
      return new THREE.MeshLambertMaterial({ color: weaponDef.color, map: window._weaponFinishTex });
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

    if (style === 'grip' || style === 'shotgunGrip') {
      // Right hand wrapped around pistol grip (or swept shotgun grip wrist with extra lateral clearance)
      const latX = style === 'shotgunGrip' ? 0.020 : 0.008;
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.058, 0.050), gloveMat);
      palm.position.set(latX, 0, 0.004);
      const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.014, 0.020), knuckleMat);
      knuckle.position.set(latX, 0.020, -0.016);
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

      // Thumb resting along left side of handguard (grouped so reload animations can tuck it cleanly along magazine spine)
      const thumbGroup = new THREE.Group();
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.042), gloveMat);
      thumb.position.set(-0.026, 0.012, -0.006);
      const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.016), skinMat);
      thumbTip.position.set(-0.026, 0.014, -0.032);
      thumbGroup.add(thumb, thumbTip);
      handGroup.add(thumbGroup);
      handGroup.userData.thumbGroup = thumbGroup;
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
    } else if (style === 'rightFist') {
      // Clenched right-handed tactical fist (exact mirror of leftFist with matching tactical glove & knuckle armor)
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.058, 0.050), gloveMat);
      palm.position.set(0.004, 0, 0.004);
      const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.054, 0.020), knuckleMat);
      knuckle.position.set(0.020, 0, -0.016);
      handGroup.add(palm, knuckle);

      // 4 fingers tightly balled against inner palm
      for (let i = 0; i < 4; i++) {
        const fy = 0.018 - i * 0.012;
        const fCurl = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.010, 0.022), gloveMat);
        fCurl.position.set(-0.002, fy, -0.024);
        const fTuck = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.009, 0.016), skinMat);
        fTuck.position.set(-0.018, fy, -0.012);
        handGroup.add(fCurl, fTuck);
      }

      // Thumb folded tightly across the top/front of the curled index finger
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.015, 0.016), gloveMat);
      thumb.position.set(-0.004, 0.024, -0.022);
      thumb.rotation.y = -0.25;
      const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.013, 0.014), skinMat);
      thumbTip.position.set(-0.022, 0.020, -0.024);
      handGroup.add(thumb, thumbTip);
    } else if (style === 'foregrip') {
      // Left support hand wrapped firmly around a vertical foregrip shaft
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.062, 0.044), gloveMat);
      palm.position.set(-0.020, 0.0, 0.004);
      const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.056, 0.022), knuckleMat);
      knuckle.position.set(-0.026, 0.0, -0.012);
      handGroup.add(palm, knuckle);

      // 4 fingers curling around the front and right side of the vertical foregrip
      for (let i = 0; i < 4; i++) {
        const fy = 0.020 - i * 0.013;
        const fBase = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.010, 0.016), gloveMat);
        fBase.position.set(0.002, fy, -0.020);
        const fTip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.009, 0.018), skinMat);
        fTip.position.set(0.018, fy, -0.008);
        handGroup.add(fBase, fTip);
      }

      // Thumb wrapping high around the rear-left of the vertical grip
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.014, 0.016), gloveMat);
      thumb.position.set(-0.002, 0.028, 0.018);
      const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.012, 0.014), skinMat);
      thumbTip.position.set(0.016, 0.028, 0.014);
      handGroup.add(thumb, thumbTip);
    }

    // Invisible articulated wrist pivot anchor (connects forearm to hand without a visible ball joint)
    const wristJoint = new THREE.Object3D();
    wristJoint.position.set(isRight ? 0.008 : -0.010, -0.010, 0.034);
    wristJoint.visible = false;
    handGroup.add(wristJoint);

    handGroup.userData.handStyle = style;
    handGroup.userData.isRight = isRight;
    if (!this._buildVisibleHands) {
      const hideLegacy = !!(this.fpArms && !this.fpArms.disabled && window.RigAssets && window.RigAssets.ready);
      handGroup.traverse((m) => {
        if (m.isMesh) {
          m.userData._isLegacyFpPart = true;
          if (hideLegacy && m.material && m.material !== window.RigAssets.hiddenMaterial) {
            m.userData._origMat = m.material;
            m.material = window.RigAssets.hiddenMaterial;
          }
        }
      });
    }

    return handGroup;
  }

  _createForearm() {
    const armGroup = new THREE.Group();
    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x2f332c });
    const cuffMat = new THREE.MeshLambertMaterial({ color: 0x1a1c19 });

    // Unit-length cylinder along +Z (0..1) so scaling Z stretches from shoulder to wrist
    const sleeveGeo = new THREE.CylinderGeometry(0.030, 0.042, 1.0, 12);
    sleeveGeo.rotateX(Math.PI / 2);
    sleeveGeo.translate(0, 0, 0.5);
    const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);

    const cuffGeo = new THREE.CylinderGeometry(0.031, 0.033, 0.036, 12);
    cuffGeo.rotateX(Math.PI / 2);
    const cuff = new THREE.Mesh(cuffGeo, cuffMat);
    cuff.position.set(0, 0, 0.982);

    armGroup.add(sleeve, cuff);
    if (!this._buildVisibleHands) {
      const hideLegacy = !!(this.fpArms && !this.fpArms.disabled && window.RigAssets && window.RigAssets.ready);
      armGroup.traverse((m) => {
        if (m.isMesh) {
          m.userData._isLegacyFpPart = true;
          if (hideLegacy && m.material && m.material !== window.RigAssets.hiddenMaterial) {
            m.userData._origMat = m.material;
            m.material = window.RigAssets.hiddenMaterial;
          }
        }
      });
    }
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
    if (this.fpArms && armGroup.userData && armGroup.userData.fpSide) {
      this.fpArms.recordArmPose(armGroup, shoulderPos, wristPos, this._currentAimHand || null);
    }
  }

  ensureFPArms() {
    if (!this.fpArms && window.RigAssets && window.RigAssets.ready && window.RiggedFPArms) {
      try {
        this.fpArms = new window.RiggedFPArms(this);
        if (this.fpArms && !this.fpArms.disabled && this.vmCamera) {
          const skipRoot = this.fpArms.wrapper;
          const hideTraverse = (obj) => {
            if (!obj || obj === skipRoot) return;
            if (obj.isMesh && obj.userData && obj.userData._isLegacyFpPart && obj.material && obj.material !== window.RigAssets.hiddenMaterial) {
              obj.userData._origMat = obj.material;
              obj.material = window.RigAssets.hiddenMaterial;
            }
            if (obj.children) {
              for (let i = 0; i < obj.children.length; i++) hideTraverse(obj.children[i]);
            }
          };
          hideTraverse(this.vmCamera);
        }
      } catch (e) {
        console.warn('[WeaponSystem] Failed to init RiggedFPArms, keeping legacy hands:', e);
        this._restoreLegacyHands();
      }
    }
  }

  _restoreLegacyHands() {
    if (!this.vmCamera) return;
    this.vmCamera.traverse((m) => {
      if (m && m.isMesh && m.userData && m.userData._origMat) {
        m.material = m.userData._origMat;
        delete m.userData._origMat;
      }
    });
  }

  startDraw(style = 'shoulder_down') {
    this.drawStyle = style;
    this.drawDuration = style === 'shoulder_down' ? 0.44 : 0.38;
    this.drawTimer = this.drawDuration;
  }

  _ensureDownedLegs() {
    const cam = this.vmCamera || this.viewmodelCamera || this.camera;
    if (this.downedLegsGroup || !cam) return;
    const root = new THREE.Group();
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2f342d });
    const kneePadMat = new THREE.MeshLambertMaterial({ color: 0x1a1d1f });
    const bootMat = new THREE.MeshLambertMaterial({ color: 0x191a1c });
    const soleMat = new THREE.MeshLambertMaterial({ color: 0x2b2824 });

    const makeLeg = (xOff) => {
      const hip = new THREE.Group();
      hip.position.set(xOff, -0.28, -0.12);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.14, 0.42), pantsMat);
      thigh.position.set(0, -0.02, -0.21);
      const knee = new THREE.Group();
      knee.position.set(0, -0.02, -0.41);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.06, 0.11), kneePadMat);
      pad.position.set(0, 0.065, -0.02);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.125, 0.38), pantsMat);
      shin.position.set(0, -0.03, -0.19);
      shin.rotation.x = -0.10;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.19, 0.14), bootMat);
      boot.position.set(0, 0.0, -0.40);
      boot.rotation.x = 0.22;
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.19, 0.03), soleMat);
      sole.position.set(0, 0.0, -0.475);
      sole.rotation.x = 0.22;
      knee.add(pad, shin, boot, sole);
      hip.add(thigh, knee);
      root.add(hip);
      return { hip, knee };
    };

    const leftLeg = makeLeg(-0.14);
    const rightLeg = makeLeg(0.14);

    // Supporting left arm & gloved hand visible bracing on the ground to push/scoot the body
    const supportArm = new THREE.Group();
    supportArm.position.set(-0.30, -0.20, -0.18);
    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x2f332c });
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.042, 0.34, 8), sleeveMat);
    forearm.rotation.x = Math.PI / 2 - 0.55;
    forearm.position.set(0, -0.08, -0.10);
    this._buildVisibleHands = true;
    const palm = this._createHand(false, 'grip');
    this._buildVisibleHands = false;
    palm.position.set(-0.02, -0.18, -0.22);
    palm.rotation.set(0.55, 0.25, -0.25);
    supportArm.add(forearm, palm);
    root.add(supportArm);

    root.visible = false;
    cam.add(root);
    this.downedLegsGroup = root;
    this.downedLegsParts = { leftLeg, rightLeg, supportArm };
  }

  _ensureLedgeHands() {
    if (this.ledgeHandsGroup || !this.vmCamera) return;
    // Mounted in vmCamera so RiggedFPArms drives the actual sculpted character model arms & gloved hands,
    // while update() transforms the world-space ledge lip into vmCamera space so hands stay anchored on the ledge!
    const root = new THREE.Group();

    const makeArm = (isRight) => {
      const side = isRight ? 1 : -1;
      const styleName = isRight ? 'ledgeGrabR' : 'ledgeGrabL';
      const hand = this._createHand(isRight, styleName);
      hand.userData.handStyle = styleName;
      hand.position.set(side * 0.21, 0.020, -0.025);
      hand.rotation.set(-0.18, side * -0.06, side * 0.04);

      const forearm = this._createForearm();
      forearm.userData.fpSide = isRight ? 'right' : 'left';
      root.add(hand, forearm);
      return { hand, forearm, side, styleName };
    };

    const leftArm = makeArm(false);
    const rightArm = makeArm(true);
    root.visible = false;
    this.vmCamera.add(root);
    this.ledgeHandsGroup = root;
    this.ledgeHandsParts = { leftArm, rightArm };
  }

  _getWpnTex() {
    if (window.ModelSystem && window.ModelSystem.getWeaponTextures) {
      return window.ModelSystem.getWeaponTextures();
    }
    if (window._wpnTex) return window._wpnTex;
    const SZ = 256;
    const mk = (drawFn) => {
      const c = document.createElement('canvas');
      c.width = SZ;
      c.height = SZ;
      const ctx = c.getContext('2d');
      drawFn(ctx, SZ, SZ);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = 4;
      return tex;
    };
    const fineGrain = (ctx, baseR, baseG, baseB, variance, streakH = false, count = 2600) => {
      const grad = ctx.createLinearGradient(0, 0, 0, SZ);
      grad.addColorStop(0, `rgb(${Math.min(255, baseR + 10)},${Math.min(255, baseG + 11)},${Math.min(255, baseB + 12)})`);
      grad.addColorStop(0.5, `rgb(${baseR},${baseG},${baseB})`);
      grad.addColorStop(1, `rgb(${Math.max(0, baseR - 10)},${Math.max(0, baseG - 10)},${Math.max(0, baseB - 9)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SZ, SZ);
      for (let i = 0; i < count; i++) {
        const x = (Math.random() * SZ) | 0;
        const y = (Math.random() * SZ) | 0;
        const d = ((Math.random() - 0.5) * variance) | 0;
        const r = Math.max(0, Math.min(255, baseR + d));
        const g = Math.max(0, Math.min(255, baseG + d));
        const b = Math.max(0, Math.min(255, baseB + d));
        ctx.fillStyle = `rgba(${r},${g},${b},0.65)`;
        ctx.fillRect(x, y, streakH ? (6 + ((Math.random() * 22) | 0)) : 2, streakH ? 1 : 2);
      }
    };
    window._wpnTex = {
      parkerized: mk((ctx) => {
        fineGrain(ctx, 50, 55, 61, 18, true, 3000);
        // Machined gunmetal panel seams & subtle edge wear highlights
        ctx.fillStyle = 'rgba(150, 168, 184, 0.14)';
        ctx.fillRect(0, 0, SZ, 3);
        ctx.fillRect(0, 126, SZ, 2);
        ctx.fillStyle = 'rgba(14, 17, 20, 0.28)';
        ctx.fillRect(0, 128, SZ, 2);
        for (let rx = 24; rx < SZ; rx += 64) {
          ctx.fillStyle = 'rgba(20, 24, 28, 0.45)';
          ctx.beginPath(); ctx.arc(rx, 18, 3.2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(130, 145, 160, 0.25)';
          ctx.beginPath(); ctx.arc(rx - 0.8, 17.2, 1.4, 0, Math.PI * 2); ctx.fill();
        }
      }),
      blued: mk((ctx) => {
        fineGrain(ctx, 32, 39, 48, 15, true, 2800);
        ctx.fillStyle = 'rgba(95, 124, 162, 0.12)';
        for (let y = 14; y < SZ; y += 44) ctx.fillRect(0, y, SZ, 5);
        ctx.fillStyle = 'rgba(165, 185, 210, 0.08)';
        ctx.fillRect(0, 2, SZ, 2);
      }),
      brushedSteel: mk((ctx) => {
        fineGrain(ctx, 98, 105, 114, 24, true, 3400);
        ctx.fillStyle = 'rgba(225, 235, 246, 0.16)';
        for (let y = 8; y < SZ; y += 28) ctx.fillRect(0, y, SZ, 2);
      }),
      polymer: mk((ctx) => {
        fineGrain(ctx, 27, 30, 34, 10, false, 1800);
        // Micro-stippled tactical polymer grip texture
        ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
        for (let y = 0; y < SZ; y += 4) {
          for (let x = ((y % 8) === 0 ? 0 : 2); x < SZ; x += 4) {
            ctx.fillRect(x, y, 2, 2);
          }
        }
        ctx.fillStyle = 'rgba(85, 92, 102, 0.08)';
        for (let y = 2; y < SZ; y += 8) ctx.fillRect(0, y, SZ, 1);
      }),
      bakelite: mk((ctx) => {
        fineGrain(ctx, 128, 60, 36, 18, false, 2000);
        for (let i = 0; i < 64; i++) {
          ctx.strokeStyle = (i % 2 === 0) ? 'rgba(82, 32, 16, 0.32)' : 'rgba(168, 86, 50, 0.25)';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          const y0 = (Math.random() * SZ) | 0;
          for (let x = 0; x <= SZ; x += 8) {
            const dy = Math.sin(x * 0.045 + i * 0.7) * 9;
            if (x === 0) ctx.moveTo(x, (y0 + dy + SZ) % SZ);
            else ctx.lineTo(x, (y0 + dy + SZ) % SZ);
          }
          ctx.stroke();
        }
      }),
      wood: mk((ctx) => {
        fineGrain(ctx, 114, 70, 38, 16, true, 2400);
        for (let y = 0; y < SZ; y += 8) {
          ctx.strokeStyle = (y % 16 === 0) ? 'rgba(66, 36, 15, 0.38)' : 'rgba(148, 94, 52, 0.24)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let x = 0; x <= SZ; x += 8) {
            const oy = Math.sin(x * 0.035 + y * 0.09) * 5;
            if (x === 0) ctx.moveTo(x, y + oy);
            else ctx.lineTo(x, y + oy);
          }
          ctx.stroke();
        }
      }),
      composite: mk((ctx) => {
        // Matches tactical soldier OD/ranger-green plate carrier & uniform palette
        fineGrain(ctx, 64, 74, 56, 16, false, 2400);
        ctx.fillStyle = 'rgba(28, 34, 24, 0.24)';
        for (let i = 0; i < 520; i++) {
          ctx.fillRect((Math.random() * SZ) | 0, (Math.random() * SZ) | 0, 3, 2);
        }
        ctx.fillStyle = 'rgba(116, 128, 102, 0.10)';
        for (let y = 0; y < SZ; y += 16) ctx.fillRect(0, y, SZ, 1);
      }),
      brass: mk((ctx) => {
        const g = ctx.createLinearGradient(0, 0, SZ, 0);
        g.addColorStop(0, '#c69a3c');
        g.addColorStop(0.35, '#e8c468');
        g.addColorStop(0.65, '#cfa242');
        g.addColorStop(1, '#b4872e');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, SZ, SZ);
        ctx.fillStyle = 'rgba(255, 246, 200, 0.22)';
        ctx.fillRect(52, 0, 22, SZ);
      }),
      shellRed: mk((ctx) => {
        fineGrain(ctx, 174, 40, 40, 12, false, 1400);
        for (let x = 0; x < SZ; x += 12) {
          ctx.fillStyle = 'rgba(90, 14, 14, 0.36)';
          ctx.fillRect(x, 0, 3, SZ);
          ctx.fillStyle = 'rgba(225, 96, 96, 0.16)';
          ctx.fillRect(x + 3, 0, 2, SZ);
        }
      })
    };
    return window._wpnTex;
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
    this.boltCarrierMesh = null;
    this.chamberRoundMesh = null;
    if (withHands) this.scopeOptic = null;

    const hasCamo = mods.camo && mods.camo !== 'none';
    const gunMat = this._getCamoMaterial(weaponDef, mods.camo);
    const rig = window.ModelSystem.buildWeaponRig(weaponDef, mods, hasCamo ? gunMat : null);
    const g = rig.group;

    this.boltMesh = rig.boltMesh;
    if (this.boltMesh) {
      this.boltRestPos.copy(this.boltMesh.position);
      this.boltRestRot.copy(this.boltMesh.rotation);
    }
    this.boltCarrierMesh = rig.boltCarrierMesh || null;
    if (this.boltCarrierMesh) {
      this.boltCarrierRestPos.copy(this.boltCarrierMesh.position);
    }
    this.chamberRoundMesh = rig.chamberRoundMesh || null;
    this.magMesh = rig.magMesh;
    if (this.magMesh) {
      this.magRestPos.copy(this.magMesh.position);
      this.magRestRot.copy(this.magMesh.rotation);
    }
    this.spareMagMesh = rig.spareMagMesh || null;

    this.rightHand = this._createHand(true, rig.rightHandStyle || 'grip');
    this.rightHand.position.copy(rig.rightHandPos);
    this.rightHand.rotation.copy(rig.rightHandRot);
    this.rightHandRestPos.copy(this.rightHand.position);
    this.rightHandRestRot.copy(this.rightHand.rotation);

    this.leftHand = this._createHand(false, rig.leftHandStyle || 'supportRifle');
    this.leftHand.position.copy(rig.leftHandPos);
    this.leftHand.rotation.copy(rig.leftHandRot);
    this.leftHandRestPos.copy(this.leftHand.position);
    this.leftHandRestRot.copy(this.leftHand.rotation);

    g.add(this.rightHand, this.leftHand);

    this.sightHeight = rig.sightHeight;
    this.adsZ = rig.adsZ;
    this.muzzleMesh.position.copy(rig.muzzlePos);
    this.muzzleFlash.position.copy(rig.flashPos);

    const hasOptic = !!(mods.optic && mods.optic !== 'none');
    if (rig.ironSightOpts) {
      const target = rig.ironSightTarget || g;
      this._addWeaponIronSights(target, weaponDef.id, this.sightHeight - target.position.y, hasOptic, rig.ironSightOpts);
    } else if (weaponDef.id === 'awm338') {
      this._addWeaponIronSights(g, 'awm338', this.sightHeight, true);
      if (!hasOptic) this._addScope(g, this.sightHeight, 'sniper', 0.042, withHands);
    } else if (weaponDef.id === 'm24') {
      this._addWeaponIronSights(g, 'm24', this.sightHeight, true);
      if (!hasOptic) this._addScope(g, this.sightHeight, 'lpvo', 0.036, withHands);
    } else {
      this._addWeaponIronSights(g, weaponDef.id, this.sightHeight, hasOptic);
    }

    this._attachMods(g, weaponDef, mods, withHands);
    this._attachCosmetics(g, weaponDef, mods);

    this.rightArm = this._createForearm();
    this.rightArm.userData.fpSide = 'right';
    this.leftArm = this._createForearm();
    this.leftArm.userData.fpSide = 'left';
    this.leftFist = this._createHand(false, 'leftFist');
    this.leftFist.visible = false;
    g.add(this.rightArm, this.leftArm, this.leftFist);

    if (withHands && !this.plateRig) {
      // Camera-space Warzone/DMZ Plating Rig: ceramic plate is parented directly to the gloved hand (no fingers visible behind plate!)
      const rig = new THREE.Group();
      rig.visible = false;

      const plateHand = new THREE.Group();
      plateHand.userData.handStyle = 'plate';
      plateHand.userData.isRight = false;
      const gloveMat = new THREE.MeshLambertMaterial({ color: 0x454b3e });
      const knuckleMat = new THREE.MeshLambertMaterial({ color: 0x22251f });
      const skinMat = new THREE.MeshLambertMaterial({ color: 0xd1a483 });
      // Top-edge pinch grip: gloved palm + knuckle guard + thumb gripping top rim of plate (nothing protruding behind!)
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.042, 0.048), gloveMat);
      palm.position.set(0, 0.006, 0.004);
      const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.016, 0.022), knuckleMat);
      knuckle.position.set(0, 0.022, -0.008);
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.016, 0.018), gloveMat);
      thumb.position.set(0.022, -0.012, 0.018);
      const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.014, 0.016), skinMat);
      thumbTip.position.set(0.002, -0.014, 0.019);
      plateHand.add(palm, knuckle, thumb, thumbTip);
      if (!this._buildVisibleHands) {
        const hideLegacy = !!(this.fpArms && !this.fpArms.disabled && window.RigAssets && window.RigAssets.ready);
        [palm, knuckle, thumb, thumbTip].forEach((m) => {
          m.userData._isLegacyFpPart = true;
          if (hideLegacy && m.material && m.material !== window.RigAssets.hiddenMaterial) {
            m.userData._origMat = m.material;
            m.material = window.RigAssets.hiddenMaterial;
          }
        });
      }
      plateHand.scale.setScalar(1.22);

      // Sculpted SAPI ceramic armor plate (same model as Inventory Icon!) parented directly to plateHand
      // Scaled down so the ceramic plate has a realistic, compact screen footprint rather than filling the viewport!
      let plateGroup;
      if (typeof window.buildArmorPlateMesh === 'function') {
        plateGroup = window.buildArmorPlateMesh({ forIcon: false });
        plateGroup.scale.multiplyScalar(0.58);
      } else {
        plateGroup = new THREE.Group();
        const plateBody = new THREE.Mesh(
          new THREE.BoxGeometry(0.084, 0.102, 0.015),
          new THREE.MeshLambertMaterial({ color: 0x383f48 })
        );
        plateGroup.add(plateBody);
      }
      // Seated cleanly underneath the top-pinch grip so the gloved hand holds the plate squarely by its top rim (zero tilt!)
      plateGroup.position.set(0.0, -0.082, -0.006);
      plateGroup.visible = false;
      plateHand.add(plateGroup);
      this.plateMesh = plateGroup;

      const plateArm = this._createForearm();
      plateArm.userData.fpSide = 'left';
      plateArm.scale.set(1.22, 1.22, 1.0);
      rig.add(plateHand, plateArm);

      this.vmCamera.add(rig);
      this.plateRig = rig;
      this.plateHand = plateHand;
      this.plateArm = plateArm;
    }

    if (withHands && !this.medRig) {
      // AAA Camera-Space Tactical Trauma IFAK + Forearm Compression Wrap + Epinephrine Auto-Injector Rig (v2.63)
      const mRig = new THREE.Group();
      mRig.visible = false;

      const pouchCordura = new THREE.MeshLambertMaterial({ color: 0x7a2424 });
      const pouchTrim = new THREE.MeshLambertMaterial({ color: 0x1d2024 });
      const webbingMat = new THREE.MeshLambertMaterial({ color: 0x2b3028 });
      const foamMat = new THREE.MeshLambertMaterial({ color: 0x15181b });
      const sterileWhite = new THREE.MeshLambertMaterial({ color: 0xeae6dd });
      const sterileOlive = new THREE.MeshLambertMaterial({ color: 0xcfcbb8 });
      const medRedMat = new THREE.MeshLambertMaterial({ color: 0xc93030 });
      const gunmetalMat = new THREE.MeshPhongMaterial({ color: 0x363d45, specular: 0x7c8794, shininess: 42 });
      const metalBright = new THREE.MeshPhongMaterial({ color: 0xb6c0ca, specular: 0xffffff, shininess: 65 });
      const safetyOrange = new THREE.MeshLambertMaterial({ color: 0xe6671e });
      const capRedMat = new THREE.MeshLambertMaterial({ color: 0xd63232 });
      const bioFluidMat = new THREE.MeshBasicMaterial({ color: 0x39f08a });
      const glassChamberMat = new THREE.MeshLambertMaterial({ color: 0x10241b });

      // Helper to build a detailed Military Epinephrine Auto-Injector Pen (reused for stowed slot & live right-hand grip)
      const buildAutoInjector = (interactive = false) => {
        const gPen = new THREE.Group();
        const barrelLow = new THREE.Mesh(new THREE.CylinderGeometry(0.0102, 0.0100, 0.040, 14), gunmetalMat);
        barrelLow.position.set(0, -0.026, 0);
        const barrelHigh = new THREE.Mesh(new THREE.CylinderGeometry(0.0104, 0.0102, 0.032, 14), gunmetalMat);
        barrelHigh.position.set(0, 0.032, 0);
        // Recessed glass ampoule core between upper & lower aluminum sleeves
        const chamberCore = new THREE.Mesh(new THREE.CylinderGeometry(0.0076, 0.0076, 0.028, 12), glassChamberMat);
        chamberCore.position.set(0, 0.003, 0);
        const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.030, 0.005), gunmetalMat);
        sideRailL.position.set(-0.0086, 0.003, 0);
        const sideRailR = sideRailL.clone();
        sideRailR.position.x = 0.0086;
        gPen.add(barrelLow, barrelHigh, chamberCore, sideRailL, sideRailR);

        // Knurled tactical grip bands
        for (const gy of [-0.038, -0.016, 0.022, 0.042]) {
          const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0109, 0.0109, 0.004, 14), pouchTrim);
          ring.position.set(0, gy, 0);
          gPen.add(ring);
        }

        // Illuminated green bio-fluid column pivoted at bottom of window so scale.y drains cleanly downward!
        const fluidPivot = new THREE.Group();
        fluidPivot.position.set(0, -0.009, 0);
        const fluidCol = new THREE.Mesh(new THREE.CylinderGeometry(0.0066, 0.0066, 0.024, 12), bioFluidMat);
        fluidCol.position.set(0, 0.012, 0);
        fluidPivot.add(fluidCol);
        gPen.add(fluidPivot);

        // Internal stainless plunger piston driving down as fluid drains
        const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0068, 0.006, 12), metalBright);
        plunger.position.set(0, 0.016, 0);
        gPen.add(plunger);

        // Spring-loaded orange tactile needle shroud at bottom (-Y) + fine steel needle
        const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.0090, 0.0078, 0.016, 14), safetyOrange);
        shroud.position.set(0, -0.052, 0);
        const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0006, 0.016, 8), metalBright);
        needle.position.set(0, -0.062, 0);
        gPen.add(shroud, needle);

        // Top red safety pin cap (+Y) with flanged pull tab
        const capGroup = new THREE.Group();
        capGroup.position.set(0, 0.054, 0);
        const capCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.0114, 0.0110, 0.014, 14), capRedMat);
        const capRim = new THREE.Mesh(new THREE.CylinderGeometry(0.0132, 0.0126, 0.004, 14), capRedMat);
        capRim.position.set(0, 0.006, 0);
        capGroup.add(capCyl, capRim);
        gPen.add(capGroup);

        if (interactive) {
          const capSocket = new THREE.Object3D();
          capSocket.position.set(0, 0.056, 0);
          const tipSocket = new THREE.Object3D();
          tipSocket.position.set(0, -0.058, 0);
          gPen.add(capSocket, tipSocket);
          gPen.userData = { fluidPivot, plunger, shroud, capGroup, capSocket, tipSocket };
        }
        return gPen;
      };

      const buildGauzeRoll = () => {
        const gRoll = new THREE.Group();
        const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.052, 16), sterileOlive);
        const core = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.053, 12), pouchTrim);
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.0206, 0.0206, 0.010, 16), medRedMat);
        gRoll.add(outer, core, stripe);
        return gRoll;
      };

      // 1. Tactical Clamshell Cordura Trauma IFAK Pouch
      const boxGroup = new THREE.Group();
      const baseTray = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.022, 0.094), pouchCordura);
      const zipTrack = new THREE.Mesh(new THREE.BoxGeometry(0.136, 0.006, 0.098), pouchTrim);
      zipTrack.position.set(0, 0.010, 0);
      const foam = new THREE.Mesh(new THREE.BoxGeometry(0.120, 0.008, 0.082), foamMat);
      foam.position.set(0, 0.009, 0);
      boxGroup.add(baseTray, zipTrack, foam);

      // MOLLE / PALS webbing straps on underside & front
      for (const sx of [-0.040, 0.0, 0.040]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.004, 0.096), webbingMat);
        strap.position.set(sx, -0.012, 0);
        boxGroup.add(strap);
      }

      // Interior elastic loops + visible stowed Gauze Roll (left) & Epinephrine Auto-Injector (right)
      const loopL = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.005, 0.020), webbingMat);
      loopL.position.set(-0.030, 0.016, 0);
      const loopR = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.005, 0.022), webbingMat);
      loopR.position.set(0.034, 0.016, 0);
      const slotBandage = buildGauzeRoll();
      slotBandage.rotation.x = Math.PI / 2;
      slotBandage.scale.setScalar(0.82);
      slotBandage.position.set(-0.030, 0.020, 0);
      const slotStim = buildAutoInjector(false);
      slotStim.rotation.x = Math.PI / 2;
      slotStim.scale.setScalar(0.68);
      slotStim.position.set(0.034, 0.019, 0.002);
      boxGroup.add(loopL, loopR, slotBandage, slotStim);

      // Hinged Cordura lid pivoted at back edge (-Z) with Velcro medical cross patch
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, 0.012, -0.047);
      const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.015, 0.094), pouchCordura);
      lidMesh.position.set(0, 0.0075, 0.047);
      const patchPad = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.003, 0.046), pouchTrim);
      patchPad.position.set(0, 0.016, 0.047);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.004, 0.011), sterileWhite);
      crossH.position.set(0, 0.0175, 0.047);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.004, 0.036), sterileWhite);
      crossV.position.set(0, 0.0175, 0.047);
      lidPivot.add(lidMesh, patchPad, crossH, crossV);
      boxGroup.add(lidPivot);

      // Sliding front zipper slider + paracord pull tab along front rim (+Z = +0.050)
      const zipPull = new THREE.Group();
      const zipSlider = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.010), metalBright);
      const paracord = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.004, 0.020), capRedMat);
      paracord.position.set(0, -0.002, 0.013);
      zipPull.add(zipSlider, paracord);
      zipPull.position.set(-0.052, 0.011, 0.050);
      boxGroup.add(zipPull);
      mRig.add(boxGroup);

      // 2. Dedicated 1:1 Meter Hands & Forearms (true 1.0 scale so hand-parented props match Mixamo RiggedFPArms 1:1!)
      const mLeftHand = this._createHand(false, 'supportRifle');
      mLeftHand.scale.setScalar(1.0);
      const mLeftArm = this._createForearm();
      mLeftArm.userData.fpSide = 'left';

      const mRightHand = this._createHand(true, 'grip');
      mRightHand.scale.setScalar(1.0);
      const mRightArm = this._createForearm();
      mRightArm.userData.fpSide = 'right';

      // 3. Hand-Parented Props inside mRightHand (ZERO lerp lag & ZERO finger-prop drift at any FPS!)
      const bandageHeld = buildGauzeRoll();
      bandageHeld.rotation.set(0.18, 0.0, 0.32);
      bandageHeld.position.set(0.0, 0.002, -0.002);
      bandageHeld.visible = false;
      mRightHand.add(bandageHeld);

      const stimHeld = buildAutoInjector(true);
      // Aligned along Mixamo right-hand +uw axis ([-0.123, 0.955, 0.270]) so palm & curled fingers wrap radially with 0mm clipping!
      stimHeld.rotation.set(0.275, 0.0, 0.123);
      stimHeld.position.set(0.0, 0.0, 0.0);
      stimHeld.visible = false;
      mRightHand.add(stimHeld);

      // 4. Bone-Tracked Expanding Forearm Compression Bandage Cuff + Taut Gauze Tail + Flying Detached Safety Cap
      const forearmWrap = new THREE.Group();
      const wrapSleeve1 = new THREE.Mesh(new THREE.CylinderGeometry(0.0385, 0.0365, 0.068, 16), sterileOlive);
      const wrapSleeve2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0398, 0.0382, 0.034, 16), sterileWhite);
      wrapSleeve2.rotation.z = 0.08;
      const pressureBar = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.044, 0.008), medRedMat);
      pressureBar.position.set(0, 0.0, 0.038);
      forearmWrap.add(wrapSleeve1, wrapSleeve2, pressureBar);
      forearmWrap.visible = false;
      mRig.add(forearmWrap);

      const gauzeTail = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.0025, 1.0), sterileOlive);
      gauzeTail.visible = false;
      mRig.add(gauzeTail);

      const detachedCap = new THREE.Group();
      const dCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.0114, 0.0110, 0.014, 14), capRedMat);
      const dRim = new THREE.Mesh(new THREE.CylinderGeometry(0.0132, 0.0126, 0.004, 14), capRedMat);
      dRim.position.set(0, 0.006, 0);
      detachedCap.add(dCyl, dRim);
      detachedCap.visible = false;
      mRig.add(detachedCap);

      mRig.add(mLeftHand, mLeftArm, mRightHand, mRightArm);
      this.vmCamera.add(mRig);

      this.medRig = mRig;
      this.medBoxGroup = boxGroup;
      this.medLidPivot = lidPivot;
      this.medZipPull = zipPull;
      this.medSlotBandage = slotBandage;
      this.medSlotStim = slotStim;
      this.medForearmWrap = forearmWrap;
      this.medGauzeTail = gauzeTail;
      this.medDetachedCap = detachedCap;
      this.medItems = { stim: stimHeld, bandage: bandageHeld, pills: detachedCap };
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
      hasVertGrip: !!this.hasVertGrip,
      foregripAnchor: this.foregripAnchor,
      magMesh: this.magMesh,
      magRestPos: this.magRestPos.clone(),
      magRestRot: this.magRestRot.clone(),
      spareMagMesh: this.spareMagMesh,
      boltMesh: this.boltMesh,
      boltRestPos: this.boltRestPos.clone(),
      boltRestRot: this.boltRestRot.clone(),
      boltCarrierMesh: this.boltCarrierMesh,
      boltCarrierRestPos: this.boltCarrierRestPos.clone(),
      chamberRoundMesh: this.chamberRoundMesh,
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
      scopeOptic: this.scopeOptic,
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
      hasVertGrip: !!this.hasVertGrip,
      foregripAnchor: this.foregripAnchor,
      muzzlePos: this.muzzleMesh.position.clone(),
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
    this.hasVertGrip = saved.hasVertGrip;
    this.foregripAnchor = saved.foregripAnchor;
    this.magMesh = saved.magMesh;
    this.magRestPos.copy(saved.magRestPos);
    this.magRestRot.copy(saved.magRestRot);
    this.spareMagMesh = saved.spareMagMesh;
    this.boltMesh = saved.boltMesh;
    this.boltRestPos.copy(saved.boltRestPos);
    this.boltRestRot.copy(saved.boltRestRot);
    this.boltCarrierMesh = saved.boltCarrierMesh;
    this.boltCarrierRestPos.copy(saved.boltCarrierRestPos);
    this.chamberRoundMesh = saved.chamberRoundMesh;
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
    this.scopeOptic = saved.scopeOptic;
    this.muzzleMesh.position.copy(saved.muzzlePos);
    this.muzzleFlash.position.copy(saved.flashPos);

    return tpData;
  }

  tickFireTimer(dt) {
    if (this.fireTimer > 0) this.fireTimer -= dt;
    this._fireTickedThisFrame = true;
  }

  update(dt, player, weaponDef) {
    if (!this._fireTickedThisFrame && this.fireTimer > 0) this.fireTimer -= dt;
    this._fireTickedThisFrame = false;
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.muzzleFlash.intensity = 0;
        this.muzzleMesh.material.opacity = 0;
      }
    }

    // Step AAA 6-DOF second-order weapon spring every frame
    this._stepWeaponSpring(dt);

    // Reload progress & AAA staged procedural interruptible reload animations
    let reloadPosOffset = { x: 0, y: 0, z: 0 };
    let reloadRotOffset = { x: 0, y: 0, z: 0 };

    if (this.isReloading) {
      this.reloadTimer -= dt;
      this._reloadResumeBlend = Math.min(1.0, (this._reloadResumeBlend || 0) + dt * 9.5);
      const p = THREE.MathUtils.clamp(1 - (this.reloadTimer / this.reloadDuration), 0, 1);
      this._computeReloadPose(p, dt, reloadPosOffset, reloadRotOffset, player);

      // Persist staged reload checkpoints directly onto weapon slot so interruptions (plating, grenades, medkits, swaps) resume from exact stage!
      const stages = this._getReloadStages(this.reloadWeaponId, this.wasEmptyReload);
      const slotObj = (player && player.getActiveWeaponSlot) ? player.getActiveWeaponSlot() : this.reloadSlotRef;
      if (slotObj && slotObj.id === this.reloadWeaponId) {
        if (this.reloadWeaponId === 'm870') {
          if (this.wasEmptyReload && p >= stages.magInP && slotObj.mag > 0 && (slotObj.reloadStage || 0) < 2) {
            slotObj.reloadStage = 2;
            slotObj.reloadWasEmpty = true;
          }
        } else {
          // Stage 0 -> 1: Spent magazine removed (or Mosin bolt opened)
          if (p >= stages.magOutP && (slotObj.reloadStage || 0) < 1) {
            slotObj.reloadStage = 1;
            slotObj.reloadWasEmpty = !!this.wasEmptyReload;
            if (!this._reloadImpulseFlags.magOut) {
              this._reloadImpulseFlags.magOut = true;
              this.addWeaponImpulse(-0.008, -0.020, 0.012, -0.06, 0.02, -0.08);
            }
          }
          // Stage 1 -> 2: Fresh magazine seated & locked! Commit ammo immediately; advance to Stage 2 if bolt/slide rack remains!
          if (p >= stages.magInP && !slotObj.reloadMagCommitted) {
            if (player && player.commitReloadMag) player.commitReloadMag(slotObj);
            else slotObj.reloadMagCommitted = true;
            if (!this._reloadImpulseFlags.magIn) {
              this._reloadImpulseFlags.magIn = true;
              this.addWeaponImpulse(0.006, 0.032, -0.014, 0.11, -0.02, -0.06);
            }
            if (stages.needsChamber) {
              slotObj.reloadStage = 2;
              slotObj.reloadWasEmpty = !!this.wasEmptyReload;
            } else {
              // Tactical reload with chambered round is already live once mag clicks in!
              slotObj.reloadStage = 0;
              slotObj.reloadWasEmpty = false;
              slotObj.reloadMagCommitted = false;
            }
          }
        }
      }
      // Crisp mechanical spring punches on bolt lock & bolt rack / H&K slap!
      if (this.reloadSfxFlags.boltLock && !this._reloadImpulseFlags.boltLock) {
        this._reloadImpulseFlags.boltLock = true;
        this.addWeaponImpulse(-0.006, 0.010, 0.014, 0.04, -0.02, 0.07);
      }
      if (this.reloadSfxFlags.rack && !this._reloadImpulseFlags.rack) {
        this._reloadImpulseFlags.rack = true;
        this.addWeaponImpulse(0.010, -0.024, -0.020, -0.095, -0.03, 0.09);
      }

      // Procedural resume entry easing + subtle live breathing/stride momentum coupled into the reload pose!
      const resBlend = this._reloadResumeBlend * this._reloadResumeBlend * (3 - 2 * this._reloadResumeBlend);
      const rSpd = player ? Math.hypot(player.velocity.x, player.velocity.z) : 0;
      const rMove = Math.min(1, rSpd / 6.0);
      const rBreath = Math.sin(this.bobTimer * 1.15) * (0.003 + rMove * 0.006);
      reloadPosOffset.x = reloadPosOffset.x * resBlend + Math.cos(this.bobTimer) * rMove * 0.006;
      reloadPosOffset.y = reloadPosOffset.y * resBlend + rBreath;
      reloadPosOffset.z = reloadPosOffset.z * resBlend;
      reloadRotOffset.x = reloadRotOffset.x * resBlend + rBreath * 1.4;
      reloadRotOffset.y = reloadRotOffset.y * resBlend;
      reloadRotOffset.z = reloadRotOffset.z * resBlend + Math.sin(this.bobTimer) * rMove * 0.022;

      // Unique, steady ADS-reload posture: keeps sights/optic shouldered & aimed downrange per weapon!
      if (player && player.isADS && !this.wallBlocked) {
        const env = p < 0.10 ? (p / 0.10) : (p > 0.90 ? (1 - p) / 0.10 : 1);
        const wId = this.reloadWeaponId;
        const scZoom = (weaponDef && weaponDef.adsZoom) ? weaponDef.adsZoom : 1.25;
        if (this.scopeOptic && scZoom >= 2.0) {
          // Magnified-scope ADS reload (v2.55): eye-relief stays active while gently offsetting the optic during mag/bolt work!
          const scRatio = 1 / Math.max(1.0, Math.sqrt(scZoom));
          reloadPosOffset.x = THREE.MathUtils.clamp(reloadPosOffset.x * 0.08 * scRatio - 0.0045 * scRatio * env, -0.014, 0.014);
          reloadPosOffset.y = THREE.MathUtils.clamp(reloadPosOffset.y * 0.07 * scRatio - 0.0055 * scRatio * env, -0.015, 0.012);
          reloadPosOffset.z = THREE.MathUtils.clamp(reloadPosOffset.z * 0.14 + 0.016 * scRatio * env, -0.024, 0.032);
          reloadRotOffset.x = THREE.MathUtils.clamp(reloadRotOffset.x * 0.14 * scRatio, -0.09, 0.09);
          reloadRotOffset.y = THREE.MathUtils.clamp(reloadRotOffset.y * 0.10 * scRatio, -0.07, 0.07);
          reloadRotOffset.z = THREE.MathUtils.clamp(reloadRotOffset.z * 0.24 * scRatio, -0.14, 0.14);
        } else if (wId === 'm24') {
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
        this.reloadSlotRef = null;
        this._resetReloadParts();
        player.finishReload();
      }
    }

    // Downed / Dead State: ALWAYS hide all weapons, plates, medkits & fists! Show 1st-person seated legs + supporting arm when downed!
    this._ensureDownedLegs();
    this._ensureLedgeHands();
    if (player.isDowned || player.dead) {
      this.viewmodelGroup.visible = false;
      if (this.plateRig) this.plateRig.visible = false;
      if (this.medRig) this.medRig.visible = false;
      if (this.tacFistRig) this.tacFistRig.visible = false;
      if (this.ledgeHandsGroup) this.ledgeHandsGroup.visible = false;

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

          this.downedLegsGroup.position.y = -0.02 + heave * 0.032 + breathe;
          this.downedLegsGroup.position.z = -0.04 - heave * 0.028;
          this.downedLegsGroup.rotation.x = -player.pitch * 0.78 - heave * 0.04;
          this.downedLegsGroup.rotation.z = sinC * 0.04;

          if (player.beingDragged) {
            // Relaxed straight legs trailing smoothly as teammate drags you from behind
            p.leftLeg.hip.rotation.x = 0.02;
            p.leftLeg.knee.rotation.x = -0.04;
            p.rightLeg.hip.rotation.x = 0.02;
            p.rightLeg.knee.rotation.x = -0.04;
            if (p.supportArm) {
              p.supportArm.position.set(-0.34, -0.26, -0.14);
              p.supportArm.rotation.x = 0.10;
            }
          } else {
            // Grounded seated 1st-person legs: left knee raised slightly planting heel, right leg relaxed forward, supporting arm propping
            p.leftLeg.hip.rotation.x = 0.30 + heave * 0.12;
            p.leftLeg.knee.rotation.x = -0.42 - heave * 0.16;
            p.rightLeg.hip.rotation.x = 0.10 + heave * 0.06;
            p.rightLeg.knee.rotation.x = -0.14 - heave * 0.08;
            if (p.supportArm) {
              p.supportArm.position.x = -0.32;
              p.supportArm.position.z = -0.18 - cosC * 0.10;
              p.supportArm.position.y = -0.22 - heave * 0.035;
              p.supportArm.rotation.x = -0.08 + sinC * 0.24;
            }
          }
        }
      }
      // Drive Warzone/DMZ first-person Self-Revive Combat Syringe animation if player is self-reviving while downed!
      this._updateReviveAnim(dt, player);
      return;
    } else {
      if (this.downedLegsGroup) this.downedLegsGroup.visible = false;
      if (player.ledgeState) {
        // Two-handed progressive ledge-grab: stow weapon & weld sculpted character hands onto the world ledge!
        if (this.plateRig) this.plateRig.visible = false;
        if (this.medRig) this.medRig.visible = false;
        if (this.tacFistRig) this.tacFistRig.visible = false;
        if (this.reviveRig) this.reviveRig.visible = false;
        const ls = player.ledgeState;
        const p = ls.pullProgress || 0;
        // Hands stay 100% locked onto the world ledge through hang + hoist + mantle press (p <= 0.68),
        // then push off cleanly (0.68..0.90) as the operator stands up onto the obstacle top!
        const grabLock = ls.phase === 'grabbing'
          ? Math.min(1, ls.grabT / 0.52) * Math.min(1, ls.grabT / 0.52) * (3 - 2 * Math.min(1, ls.grabT / 0.52))
          : 1.0;
        const releaseRaw = THREE.MathUtils.clamp((p - 0.68) / 0.22, 0, 1);
        const releaseEase = releaseRaw * releaseRaw * (3 - 2 * releaseRaw);
        const lockBlend = grabLock * (1 - releaseEase);
        const showHands = !player.isThirdPerson && p < 0.88;
        const drawWeaponT = THREE.MathUtils.clamp((p - 0.80) / 0.20, 0, 1);

        if (this.ledgeHandsGroup && this.ledgeHandsParts && this.vmCamera && this.camera) {
          this.ledgeHandsGroup.visible = showHands;
          const edge = ls.edgePos || ls.hangPos;
          const inX = ls.inwardX || 0;
          const inZ = ls.inwardZ || 0;
          const ledgeInward = new THREE.Vector3(inX, 0, inZ);
          if (ledgeInward.lengthSq() < 1e-5) ledgeInward.set(-Math.sin(ls.ledgeYaw || 0), 0, -Math.cos(ls.ledgeYaw || 0));
          ledgeInward.normalize();
          const ledgeOutward = ledgeInward.clone().negate();
          const worldUp = new THREE.Vector3(0, 1, 0);
          const ledgeRight = new THREE.Vector3().crossVectors(ledgeInward, worldUp).normalize();
          const pressT = THREE.MathUtils.clamp(p / 0.58, 0, 1);
          const pressEase = pressT * pressT * (3 - 2 * pressT);
          const span = ls.edgeHalfWidth || 0.20;

          const ledgeWorldQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ls.ledgeYaw || 0, 0));

          // Sync vmCamera to live camera transform & place ledgeHandsGroup directly on the world ledge lip
          this.camera.updateMatrixWorld(true);
          this.vmCamera.position.copy(this.camera.position);
          this.vmCamera.quaternion.copy(this.camera.quaternion);
          this.vmCamera.updateMatrixWorld(true);
          const camQInv = this.vmCamera.quaternion.clone().invert();
          this.ledgeHandsGroup.position.copy(this.vmCamera.worldToLocal(edge.clone()));
          this.ledgeHandsGroup.quaternion.copy(camQInv).multiply(ledgeWorldQuat);

          const shY = THREE.MathUtils.lerp(-0.34, 0.34, pressEase);
          const shZ = THREE.MathUtils.lerp(0.36, 0.14, pressEase);
          for (const arm of [this.ledgeHandsParts.leftArm, this.ledgeHandsParts.rightArm]) {
            const sSign = arm.side;
            const inwardLip = THREE.MathUtils.lerp(0.014, 0.048, pressEase);
            const pushDownY = releaseEase * -0.18;
            const pushBackIn = releaseEase * -0.06;
            const palmWorld = edge.clone()
              .addScaledVector(ledgeRight, sSign * span)
              .addScaledVector(worldUp, 0.015 + pushDownY)
              .addScaledVector(ledgeInward, inwardLip + pushBackIn);
            // Dynamic world-ledge hand basis: fingers across top surface, dorsal back UP + slightly toward climber (never collinear with forearm!)
            const fWorld = new THREE.Vector3()
              .addScaledVector(ledgeInward, THREE.MathUtils.lerp(0.95, 0.92, pressEase))
              .addScaledVector(worldUp, THREE.MathUtils.lerp(-0.22, -0.10, pressEase))
              .addScaledVector(ledgeRight, -sSign * THREE.MathUtils.lerp(0.06, 0.14, pressEase))
              .normalize();
            const backWorld = new THREE.Vector3()
              .addScaledVector(worldUp, THREE.MathUtils.lerp(0.86, 0.95, pressEase))
              .addScaledVector(ledgeOutward, THREE.MathUtils.lerp(0.48, 0.22, pressEase))
              .addScaledVector(ledgeRight, sSign * 0.18)
              .normalize();
            // Singularity-free elbow pole in world ledge space (outward from wall + lateral + downward)
            const poleOffsetWorld = new THREE.Vector3()
              .addScaledVector(ledgeOutward, THREE.MathUtils.lerp(0.42, 0.46, pressEase))
              .addScaledVector(ledgeRight, sSign * THREE.MathUtils.lerp(0.36, 0.46, pressEase))
              .addScaledVector(worldUp, THREE.MathUtils.lerp(-0.36, -0.18, pressEase));

            arm.hand.position.set(sSign * span, 0.015 + pushDownY, -(inwardLip + pushBackIn));
            arm.hand.rotation.set(-0.14 - pressEase * 0.10, sSign * -0.06, sSign * 0.04);
            if (arm.hand.userData) {
              arm.hand.userData.activeStyle = pressEase > 0.52
                ? (sSign > 0 ? 'ledgePressR' : 'ledgePressL')
                : arm.styleName;
              arm.hand.userData.climbLock = {
                blend: lockBlend,
                pressT: pressEase,
                palmWorld,
                fWorld,
                backWorld,
                poleOffsetWorld,
                bodyYaw: ls.ledgeYaw ?? player.yaw,
                isMantle: false
              };
            }
            const shoulderLocal = new THREE.Vector3(sSign * 0.22, shY, shZ);
            const wristLocal = new THREE.Vector3(sSign * span, 0.012 + pushDownY, -(inwardLip + pushBackIn) + 0.035);
            this._currentAimHand = arm.hand;
            this._aimArm(arm.forearm, shoulderLocal, wristLocal);
          }
        }
        if (drawWeaponT <= 0.01 || player.isThirdPerson) {
          this.viewmodelGroup.visible = false;
          return;
        }
        // Smoothly raise weapon viewmodel from low-ready during final stand-up (p = 0.80..1.00)
        this.viewmodelGroup.visible = !this.isHealing;
        this.viewmodelGroup.position.y = THREE.MathUtils.lerp(-0.36, -0.20, drawWeaponT);
        this.viewmodelGroup.rotation.x = THREE.MathUtils.lerp(-0.32, 0, drawWeaponT);
      } else if (this.ledgeHandsGroup) {
        this.ledgeHandsGroup.visible = false;
        if (this.ledgeHandsParts) {
          if (this.ledgeHandsParts.leftArm.hand.userData) this.ledgeHandsParts.leftArm.hand.userData.climbLock = null;
          if (this.ledgeHandsParts.rightArm.hand.userData) this.ledgeHandsParts.rightArm.hand.userData.climbLock = null;
        }
      }
      if (!player.ledgeState) {
        if (player.isUsingDesignator) {
          // Stow / hide weapon completely while Airstrike Binoculars / Laser Designator are equipped!
          this.viewmodelGroup.visible = false;
          if (this.plateRig) this.plateRig.visible = false;
          if (this.medRig) this.medRig.visible = false;
          if (this.tacFistRig) this.tacFistRig.visible = false;
          if (this.reviveRig) this.reviveRig.visible = false;
          return;
        }
        // Teammate Combat Syringe Revive Animation (hides weapon & plays 2-handed MW19/DMZ syringe injection!)
        if (this._updateReviveAnim(dt, player)) {
          return;
        }
        if (!this.isThirdPerson && !this.isHealing) {
          this.viewmodelGroup.visible = true;
        }
      }
    }

    // Hip-height mantle weapon tuck & world-locked left-palm obstacle vault!
    let mantleGrabArc = 0;
    let mantleContactW = 0;
    if (player.mantleState && this.viewmodelGroup) {
      const ms = player.mantleState;
      const mt = ms.t || 0;
      mantleGrabArc = Math.sin(mt * Math.PI);
      if (mt < 0.12) {
        const k = mt / 0.12;
        mantleContactW = k * k * (3 - 2 * k);
      } else if (mt <= 0.62) {
        mantleContactW = 1.0;
      } else if (mt < 0.90) {
        const k = (mt - 0.62) / 0.28;
        mantleContactW = 1 - k * k * (3 - 2 * k);
      }
      // Anatomically release palm once shoulders rise past natural downward arm press height above the ledge (or skip palm plant on low knee-high step-ups)
      if (typeof ms.ledgeY === 'number') {
        const eyeAboveLedge = player.position.y - ms.ledgeY;
        const reachGate = THREE.MathUtils.clamp((0.96 - eyeAboveLedge) / 0.18, 0, 1);
        mantleContactW *= reachGate * reachGate * (3 - 2 * reachGate);
      }
      this.viewmodelGroup.position.x = THREE.MathUtils.lerp(this.viewmodelGroup.position.x, 0.045 * mantleGrabArc, Math.min(1, dt * 18));
      this.viewmodelGroup.position.y = THREE.MathUtils.lerp(this.viewmodelGroup.position.y, -0.22 - mantleGrabArc * 0.11, Math.min(1, dt * 18));
      this.viewmodelGroup.rotation.x = THREE.MathUtils.lerp(this.viewmodelGroup.rotation.x, -0.22 * mantleGrabArc, Math.min(1, dt * 18));
      this.viewmodelGroup.rotation.z = THREE.MathUtils.lerp(this.viewmodelGroup.rotation.z, -0.26 * mantleGrabArc, Math.min(1, dt * 18));
    }

    // Stance transition 1P prone ground push-off / lay-down hand brace
    let proneHandPushArc = 0;
    if (player.stanceTrans && player.stanceTrans.timer > 0 && (player.stanceTrans.to === 'prone' || player.stanceTrans.from === 'prone')) {
      const sp = 1 - (player.stanceTrans.timer / Math.max(0.01, player.stanceTrans.duration));
      proneHandPushArc = Math.sin(sp * Math.PI);
      if (this.viewmodelGroup) {
        this.viewmodelGroup.rotation.z = THREE.MathUtils.lerp(this.viewmodelGroup.rotation.z, -0.22 * proneHandPushArc, Math.min(1, dt * 16));
        this.viewmodelGroup.rotation.x = THREE.MathUtils.lerp(this.viewmodelGroup.rotation.x, 0.16 * proneHandPushArc, Math.min(1, dt * 16));
      }
    }

    // Weapon Draw Animation (MW19/DMZ snappy shoulder-settle with subtle spring overshoot)
    let drawPos = { x: 0, y: 0, z: 0 };
    let drawRot = { x: 0, y: 0, z: 0 };
    if (this.drawTimer > 0) {
      this.drawTimer = Math.max(0, this.drawTimer - dt);
      const t = 1 - (this.drawTimer / (this.drawDuration || 0.42));
      const x = THREE.MathUtils.clamp(t, 0, 1) - 1;
      const ease = 1 + 1.95 * x * x * x + 0.95 * x * x; // crisp MW19 easeOutBack shoulder snap
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

    // Dynamic Left-Hand Pickup / Item-Use Grab Arc (weapon stays ready in right hand while left hand grabs!)
    let grabArc = 0;
    let grabStyle = null;
    if (this.grabTimer > 0) {
      this.grabTimer = Math.max(0, this.grabTimer - dt);
      const gp = 1 - (this.grabTimer / Math.max(0.01, this.grabDuration));
      if (gp < 0.42) {
        const gt = gp / 0.42;
        grabArc = gt * gt * (3 - 2 * gt);
        grabStyle = 'grabReach';
      } else if (gp < 0.72) {
        grabArc = 1.0;
        grabStyle = 'grabClose';
      } else {
        const gt = (gp - 0.72) / 0.28;
        grabArc = 1 - gt * gt * (3 - 2 * gt);
        grabStyle = 'grabClose';
      }
    }

    // Weapon Inspect progress
    let inspectPosOffset = { x: 0, y: 0, z: 0 };
    let inspectRotOffset = { x: 0, y: 0, z: 0 };
    if (this.doorBashTimer > 0) {
      this.doorBashTimer = Math.max(0, this.doorBashTimer - dt);
      const bp = 1 - (this.doorBashTimer / (this.doorBashDuration || 0.36));
      // Fast impact brace then smooth recovery: operator braces arms against door with weapon raised slightly!
      const brace = bp < 0.28 ? (bp / 0.28) : Math.max(0, 1 - (bp - 0.28) / 0.72);
      const ease = brace * brace * (3 - 2 * brace);
      inspectPosOffset.x += -0.09 * ease;
      inspectPosOffset.y += 0.085 * ease;
      inspectPosOffset.z += -0.14 * ease;
      inspectRotOffset.x += 0.34 * ease;   // weapon raised slightly
      inspectRotOffset.y += 0.42 * ease;   // angled across body as forearm braces door
      inspectRotOffset.z += -0.32 * ease;
    }
    if (this.meleeSwingTimer > 0) {
      this.meleeSwingTimer = Math.max(0, this.meleeSwingTimer - dt);
      if (!this.isFistsMode) {
        const mp = 1 - (this.meleeSwingTimer / (this.meleeSwingDuration || 0.32));
        const arc = Math.sin(mp * Math.PI);
        inspectPosOffset.x = -0.26 * arc;
        inspectPosOffset.y = -0.06 * arc;
        inspectPosOffset.z = -0.18 * arc;
        inspectRotOffset.x = -0.55 * arc;
        inspectRotOffset.y = 0.95 * arc;
        inspectRotOffset.z = 0.72 * arc;
      }
    }
    if (this.isInspecting) {
      if (this.isReloading || player.isADS || player.isSprinting) {
        this.cancelInspect();
      } else {
        this.inspectTimer -= dt;
        const ip = THREE.MathUtils.clamp(1 - (this.inspectTimer / this.inspectDuration), 0, 1);
        this._computeInspectPose(ip, dt, inspectPosOffset, inspectRotOffset, player);
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
    // Deterministic cyclic bolt reciprocation (gives AK-74M & rifles crisp, consistent mechanical blowback every single shot!)
    if (this.boltCycleTimer > 0) {
      this.boltCycleTimer = Math.max(0, this.boltCycleTimer - dt);
      const cp = 1 - (this.boltCycleTimer / Math.max(0.01, this.boltCycleDuration));
      const stroke = (weaponDef && weaponDef.id === 'ak74m') ? 0.078 : (weaponDef && weaponDef.slot === 'secondary' ? 0.052 : 0.058);
      if (cp < 0.30) {
        // Fast rearward gas-piston / blowback stroke
        this.boltKick = (cp / 0.30) * stroke;
      } else {
        // Crisp spring-driven return to battery
        const ret = (cp - 0.30) / 0.70;
        this.boltKick = (1 - ret * ret) * stroke;
      }
    } else {
      this.boltKick = THREE.MathUtils.lerp(this.boltKick, 0, Math.min(1, dt * 32));
    }
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
    this._livePumpOffset = 0;
    if (!this.isReloading && !this.isInspecting && !this.isPlating && !this.isHealing && weaponDef && weaponDef.id === 'm870') {
      if (this.pumpDelayTimer > 0) {
        this.pumpDelayTimer -= dt;
        if (this.pumpDelayTimer <= 0) {
          this.pumpTimer = this.pumpDuration;
          window.soundEngine.playRechamber('m870');
        }
      } else if (this.pumpTimer > 0) {
        this.pumpTimer = Math.max(0, this.pumpTimer - dt);
        const pt = 1 - (this.pumpTimer / this.pumpDuration);
        const smooth = (t) => t * t * (3 - 2 * t);
        const pull = pt < 0.48 ? smooth(pt / 0.48) : 1 - smooth((pt - 0.48) / 0.52);
        pumpOffset = pull * 0.088;
        this._livePumpOffset = pumpOffset;
        if (this.leftHand) {
          this.leftHand.visible = true;
          if (this.leftFist) this.leftFist.visible = false;
          if (this.leftHand.userData) {
            this.leftHand.userData.activeStyle = this.hasVertGrip ? 'foregrip' : 'supportRifle';
          }
          this.leftHand.position.set(this.leftHandRestPos.x, this.leftHandRestPos.y, this.leftHandRestPos.z + pumpOffset);
          this.leftHand.rotation.copy(this.leftHandRestRot);
        }
      } else if (this.leftHand) {
        this.leftHand.position.lerp(this.leftHandRestPos, Math.min(1, dt * 24));
      }
    }

    let boltActionRoll = 0;
    if (!this.isReloading && !this.isInspecting && !this.isPlating && !this.isHealing && weaponDef && weaponDef.boltAction) {
      if (this.boltActionDelayTimer > 0) {
        this.boltActionDelayTimer -= dt;
        if (this.boltActionDelayTimer <= 0) {
          this.boltActionTimer = this.boltActionDuration;
          window.soundEngine.playRechamber(weaponDef.id);
        }
      } else if (this.boltActionTimer > 0) {
        this.boltActionTimer = Math.max(0, this.boltActionTimer - dt);
        const bt = 1 - (this.boltActionTimer / Math.max(0.01, this.boltActionDuration));
        const smooth = (t) => t * t * (3 - 2 * t);
        // 4-phase authentic bolt-action cycle: lift -> pull back -> push forward -> lock down
        let lift = 0, pull = 0;
        if (bt < 0.20) lift = smooth(bt / 0.20);
        else if (bt < 0.80) lift = 1;
        else lift = 1 - smooth((bt - 0.80) / 0.20);

        if (bt >= 0.20 && bt < 0.52) pull = smooth((bt - 0.20) / 0.32);
        else if (bt >= 0.52 && bt < 0.80) pull = 1 - smooth((bt - 0.52) / 0.28);

        boltActionRoll = lift * 0.085;
        if (this.boltMesh) {
          this.boltMesh.rotation.z = this.boltRestRot.z + lift * 0.78;
          this.boltMesh.position.z = this.boltRestPos.z + pull * 0.088;
          if (this.rightHand) {
            this.rightHand.position.set(
              this.boltMesh.position.x + 0.022,
              this.boltMesh.position.y + lift * 0.024 - 0.012,
              this.boltMesh.position.z + 0.024
            );
          }
        }
      } else {
        if (this.boltMesh) {
          this.boltMesh.rotation.z = THREE.MathUtils.lerp(this.boltMesh.rotation.z, this.boltRestRot.z, Math.min(1, dt * 22));
        }
        if (this.rightHand) {
          this.rightHand.position.lerp(this.rightHandRestPos, Math.min(1, dt * 20));
        }
      }
    }

    if (!this.isReloading && !this.isInspecting) {
      const slotObj = player.getActiveWeaponSlot ? player.getActiveWeaponSlot() : null;
      const stg = (slotObj && slotObj.reloadStage) || 0;
      // Keep physical weapon visuals 100% truthful during interrupted staged reloads!
      if (this.magMesh && weaponDef && weaponDef.id !== 'm870' && weaponDef.id !== 'mosin9130') {
        this.magMesh.visible = (stg !== 1);
      }
      if (this.boltMesh && !(weaponDef && weaponDef.boltAction && this.boltActionTimer > 0)) {
        if (weaponDef && weaponDef.id === 'mp5k' && stg >= 1) {
          this.boltMesh.position.z = this.boltRestPos.z + 0.068;
          this.boltMesh.position.y = this.boltRestPos.y + 0.016;
          this.boltMesh.rotation.z = 0.55;
          if (this.boltCarrierMesh) {
            this.boltCarrierMesh.position.z = this.boltCarrierRestPos.z + 0.055;
          }
        } else if (weaponDef && weaponDef.id === 'mosin9130' && stg >= 1) {
          this.boltMesh.position.z = this.boltRestPos.z + 0.095;
          this.boltMesh.rotation.z = 0.80;
          if (this.boltCarrierMesh) {
            this.boltCarrierMesh.position.z = this.boltCarrierRestPos.z;
          }
        } else {
          const lockOpen = weaponDef && weaponDef.slot === 'secondary' && slotObj && (slotObj.mag === 0 || (stg >= 1 && slotObj.reloadWasEmpty));
          const offset = lockOpen ? 0.052 : (weaponDef && weaponDef.id === 'm870' ? pumpOffset : this.boltKick);
          this.boltMesh.position.z = this.boltRestPos.z + offset;
          this.boltMesh.position.y = this.boltRestPos.y;
          this.boltMesh.rotation.z = this.boltRestRot.z;
          if (this.boltCarrierMesh) {
            const carrierOff = (weaponDef && weaponDef.id === 'm870') ? pumpOffset * 0.72 : (stg >= 1 ? 0.055 : this.boltKick);
            this.boltCarrierMesh.position.z = this.boltCarrierRestPos.z + carrierOff;
          }
        }
      } else if (this.boltCarrierMesh) {
        this.boltCarrierMesh.position.z = this.boltCarrierRestPos.z;
      }
      if (this.chamberRoundMesh) {
        this.chamberRoundMesh.visible = !!(slotObj && slotObj.mag > 0 && !(stg >= 1 && slotObj.reloadWasEmpty));
      }
    }

    // === IMMERSIVE WALL-COLLISION & CORNER-LEAN GUN HANDLING (Fast box-only wallMeshes @ ~30Hz for high FPS!) ===
    this._wallCheckFrame = ((this._wallCheckFrame || 0) + 1) % 2;
    let targetWallPush = this._lastTargetWallPush || 0;
    if (this._wallCheckFrame === 0 && weaponDef && player.world && (player.world.wallMeshes || player.world.shootableMeshes) && !this.isThirdPerson) {
      targetWallPush = 0;
      const baseLen = weaponDef.slot === 'secondary' ? 0.78 : (weaponDef.id === 'mp5k' ? 0.94 : 1.16);
      const barrelLen = baseLen + (weaponDef.suppressed ? 0.14 : 0);

      const camPosW = new THREE.Vector3();
      const camDirW = new THREE.Vector3();
      this.camera.getWorldPosition(camPosW);
      this.camera.getWorldDirection(camDirW);
      const camRightW = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const rayTargets = (player.world.wallMeshes && player.world.wallMeshes.length > 0) ? player.world.wallMeshes : player.world.shootableMeshes;

      const checkRay = (origin) => {
        if (player.world.raycastWorld) {
          const hit = player.world.raycastWorld(origin, camDirW, 0.05, barrelLen, { wallsOnly: true, ignoreFloorNormal: 0.85 });
          return hit ? hit.distance : barrelLen;
        }
        this._wallRay.set(origin, camDirW);
        this._wallRay.near = 0.05;
        this._wallRay.far = barrelLen;
        const hits = this._wallRay.intersectObjects(rayTargets, false);
        for (const h of hits) {
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
      this._lastTargetWallPush = targetWallPush;
    }
    const wallRate = targetWallPush > this.wallPush ? 16 : 10;
    this.wallPush = THREE.MathUtils.lerp(this.wallPush, targetWallPush, Math.min(1, dt * wallRate));
    this.wallBlocked = this.wallPush > 0.76;

    // AAA Momentum-Based First-Person Locomotion Phases, Jump/Land Spring & Start/Stop Inertia!
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    const moving = speed > 0.55 && player.onGround;

    // Jump takeoff & weighty landing impact thud via second-order spring
    if (!player.onGround) {
      if (this._prevOnGround && player.velocity.y > 1.5) {
        this.addWeaponImpulse(0, -0.022, 0.012, 0.075, 0, -0.03);
      }
      this._airTime = Math.min(2.0, (this._airTime || 0) + dt);
    } else {
      if (!this._prevOnGround && this._airTime > 0.10) {
        const imp = THREE.MathUtils.clamp(this._airTime * 1.65, 0.30, 1.0);
        this.addWeaponImpulse(0, -0.058 * imp, 0.016 * imp, -0.15 * imp, 0.02 * imp, -0.065 * imp);
      }
      this._airTime = 0;
    }
    this._prevOnGround = !!player.onGround;

    // Detect crisp sprint-start hoist & hard-stop braking settle impulses
    if (player.onGround) {
      if (this._prevLocoSpeed > 4.8 && speed < 0.9) {
        this.addWeaponImpulse(0.008, -0.014, -0.016, -0.048, 0.024, 0.036);
      } else if (this._prevLocoSpeed < 1.2 && speed > 5.0) {
        this.addWeaponImpulse(-0.006, 0.010, 0.012, 0.040, -0.020, -0.030);
      }
    }
    this._prevLocoSpeed = THREE.MathUtils.lerp(this._prevLocoSpeed || 0, speed, Math.min(1, dt * 10));

    // Allow maintaining ADS while sliding AND while reloading!
    const isAdsActive = player.isADS && !this.wallBlocked && !this.isInspecting && !this.isPlating && !this.isHealing;
    const tacSprintingHip = player.isTacSprinting && !isAdsActive && !this.isReloading && !this.isPlating && !this.isHealing;
    const sprintingHip = player.isSprinting && !tacSprintingHip && !isAdsActive && !this.isReloading && !this.isPlating && !this.isHealing;

    // MW4 DMZ Sprint-to-Fire & Tac-Sprint-to-Fire timer (gates firing out of sprint by per-weapon ms!)
    if (tacSprintingHip) {
      this.sprintOutTimer = Math.max(this.sprintOutTimer || 0, (weaponDef && weaponDef.tacSprintToFire) || 0.24);
    } else if (sprintingHip) {
      this.sprintOutTimer = Math.max(this.sprintOutTimer || 0, (weaponDef && weaponDef.sprintToFire) || 0.16);
    } else {
      this.sprintOutTimer = Math.max(0, (this.sprintOutTimer || 0) - dt);
    }

    // Smoothly blend distinct 1P locomotion phases (Walk / Run / Tac-Sprint)
    const fpPhaseLerp = Math.min(1, dt * 9.5);
    this._fpPhaseTac = THREE.MathUtils.lerp(this._fpPhaseTac || 0, (moving && tacSprintingHip) ? 1 : 0, fpPhaseLerp);
    this._fpPhaseRun = THREE.MathUtils.lerp(this._fpPhaseRun || 0, (moving && sprintingHip) ? 1 : 0, fpPhaseLerp);
    this._fpPhaseWalk = THREE.MathUtils.lerp(this._fpPhaseWalk || 0, (moving && !tacSprintingHip && !sprintingHip) ? 1 : 0, fpPhaseLerp);

    if (moving) {
      const walkCad = player.isCrouching ? 4.4 : (5.4 + Math.min(speed, 5.4) * 0.45);
      const runCad = 8.8;
      const tacCad = 11.4;
      const pTot = Math.max(0.001, this._fpPhaseWalk + this._fpPhaseRun + this._fpPhaseTac);
      const cadence = (walkCad * this._fpPhaseWalk + runCad * this._fpPhaseRun + tacCad * this._fpPhaseTac) / pTot;
      this.bobTimer += dt * cadence;
    } else {
      this.bobTimer += dt * 1.15; // Gentle organic idle breathing
    }

    const moveFactor = moving ? Math.min(1.15, speed / 4.8) : 0.16;
    const airDriftY = !player.onGround ? THREE.MathUtils.clamp(-player.velocity.y * 0.0045, -0.028, 0.028) : 0;

    const ampX = isAdsActive ? (moving ? 0.0022 : 0.0008) : (0.011 * this._fpPhaseWalk + 0.023 * this._fpPhaseRun + 0.034 * this._fpPhaseTac + (!moving ? 0.004 : 0));
    const ampY = isAdsActive ? (moving ? 0.0026 : 0.0010) : (0.013 * this._fpPhaseWalk + 0.027 * this._fpPhaseRun + 0.036 * this._fpPhaseTac + (!moving ? 0.006 : 0));
    const bobX = Math.sin(this.bobTimer) * ampX * moveFactor;
    const bobY = Math.pow(Math.abs(Math.sin(this.bobTimer)), 1.55) * ampY * moveFactor;

    const swayRotZ = (moving && !isAdsActive && !this.isReloading && !this.isInspecting && !this.isPlating && !this.isHealing)
      ? Math.cos(this.bobTimer) * (0.024 * this._fpPhaseWalk + 0.068 * this._fpPhaseRun + 0.115 * this._fpPhaseTac) * moveFactor
      : 0;
    const swayRotX = (moving && !isAdsActive && !this.isReloading && !this.isInspecting && !this.isPlating && !this.isHealing)
      ? -Math.sin(this.bobTimer * 2) * (0.016 * this._fpPhaseWalk + 0.048 * this._fpPhaseRun + 0.070 * this._fpPhaseTac) * moveFactor
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

    // Smooth spring-damped physical weapon kick & hit-flinch recovery
    const recDecay = Math.min(1, dt * 15);
    this.recoilZ = THREE.MathUtils.lerp(this.recoilZ, 0, Math.min(1, dt * 18));
    this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, recDecay);
    this.recoilYaw = THREE.MathUtils.lerp(this.recoilYaw, 0, Math.min(1, dt * 14));
    this.recoilRoll = THREE.MathUtils.lerp(this.recoilRoll, 0, Math.min(1, dt * 14));
    this.recoilX = THREE.MathUtils.lerp(this.recoilX, 0, Math.min(1, dt * 16));
    this._flinchPitch = THREE.MathUtils.lerp(this._flinchPitch || 0, 0, Math.min(1, dt * 13));
    this._flinchYaw = THREE.MathUtils.lerp(this._flinchYaw || 0, 0, Math.min(1, dt * 13));
    this._flinchRoll = THREE.MathUtils.lerp(this._flinchRoll || 0, 0, Math.min(1, dt * 12));

    // Weighty camera-turn rotational & positional weapon/arm inertia sway
    if (this._prevYaw === null) {
      this._prevYaw = player.yaw;
      this._prevPitch = player.pitch;
    }
    let dYaw = player.yaw - this._prevYaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    const dPitch = player.pitch - this._prevPitch;
    this._prevYaw = player.yaw;
    this._prevPitch = player.pitch;

    const wWeight = !weaponDef ? 0.75
      : (weaponDef.slot === 'secondary' ? 0.72
      : (weaponDef.id === 'mp5k' ? 0.86
      : (weaponDef.id === 'm24' || weaponDef.id === 'awm338' || weaponDef.id === 'mosin9130' || weaponDef.id === 'm870' ? 1.24 : 1.05)));
    const adsZoom = (weaponDef && weaponDef.adsZoom) ? weaponDef.adsZoom : 1.25;
    const zoomDamp = isAdsActive ? (1 / Math.max(1.0, adsZoom)) : 1.0;
    const swayMult = (isAdsActive ? (0.28 * zoomDamp) : 1.0) * wWeight;
    const clampedDY = THREE.MathUtils.clamp(dYaw, -0.16, 0.16);
    const clampedDP = THREE.MathUtils.clamp(dPitch, -0.14, 0.14);
    const swayLerpIn = Math.min(1, dt * 10);
    this.lookSwayX = THREE.MathUtils.lerp(this.lookSwayX, THREE.MathUtils.clamp(clampedDY * 0.38 * swayMult, -0.045, 0.045), swayLerpIn);
    this.lookSwayY = THREE.MathUtils.lerp(this.lookSwayY, THREE.MathUtils.clamp(-clampedDP * 0.28 * swayMult, -0.032, 0.032), swayLerpIn);
    this.lookSwayRotY = THREE.MathUtils.lerp(this.lookSwayRotY, THREE.MathUtils.clamp(clampedDY * 1.35 * swayMult, -0.16, 0.16), swayLerpIn);
    this.lookSwayRotX = THREE.MathUtils.lerp(this.lookSwayRotX, THREE.MathUtils.clamp(clampedDP * 1.05 * swayMult, -0.12, 0.12), swayLerpIn);
    this.lookSwayRotZ = THREE.MathUtils.lerp(this.lookSwayRotZ, THREE.MathUtils.clamp(-clampedDY * 1.15 * swayMult, -0.14, 0.14), swayLerpIn);

    // MW4 DMZ Millisecond-Accurate ADS Transition Curve + Cheek-Weld Kinetic Settle + 45° Tactical Stance!
    const adsTimeSec = Math.max(0.085, (weaponDef && weaponDef.adsTime) ? weaponDef.adsTime : 0.24);
    const prevAdsLin = this._adsLinear || 0;
    this._adsLinear = THREE.MathUtils.clamp(prevAdsLin + (isAdsActive ? dt / adsTimeSec : -dt / (adsTimeSec * 0.85)), 0, 1);
    this._adsBlend = this._adsLinear * this._adsLinear * (3 - 2 * this._adsLinear);
    if (isAdsActive && this._adsLinear >= 0.86 && !this._wasCheekWelded && !customRot && !this.isFistsMode) {
      this._wasCheekWelded = true;
      this.addWeaponImpulse(0.002, -0.003, 0.005, -0.014, 0, -0.022);
      if (this.fpArms && this.fpArms.applyShoulderImpulse) {
        this.fpArms.applyShoulderImpulse('right', -0.004, 0.005, 0.008, 0.18);
      }
    } else if (!isAdsActive && this._adsLinear < 0.45) {
      this._wasCheekWelded = false;
    }

    const wantTacStance = !!(isAdsActive && player.tacStance && !this.isFistsMode && !this.isMeleeMode);
    this._tacStanceBlend = THREE.MathUtils.lerp(this._tacStanceBlend || 0, wantTacStance ? 1 : 0, Math.min(1, dt * 16));
    const tsB = this._tacStanceBlend;

    // MW4 DMZ Instant ADS Idle Sway (zero-delay dual-harmonic Lissajous figure-8, stabilized by Stance & Focus!)
    if (this._adsBlend > 0.01 && !this.isFistsMode) {
      const focusing = !!(player && player.isFocusing);
      const exhausted = !!(player && player.focusExhausted);
      const swayFreq = focusing ? 0.82 : (exhausted ? 2.35 : 1.72);
      this._idleSwayPhase = (this._idleSwayPhase || 0) + dt * swayFreq;
      const ph = this._idleSwayPhase;
      const stanceSway = player.isProne ? 0.38 : (player.isCrouching ? 0.68 : 1.0);
      const moveSway = moving ? 1.32 : 1.0;
      const focusSway = focusing ? 0.15 : (exhausted ? 1.42 : 1.0);
      const tacStSway = 1.0 - tsB * 0.35;
      const swayStat = ((weaponDef && weaponDef.idleSway) || 1.0) * stanceSway * moveSway * focusSway * tacStSway * this._adsBlend;
      const targetSwayYaw = (Math.sin(ph) * 0.0036 + Math.sin(ph * 2.3 + 1.1) * 0.0014) * swayStat;
      const targetSwayPitch = (Math.sin(ph * 2.0 + 0.6) * 0.0028 + Math.cos(ph * 1.3) * 0.0011) * swayStat;
      this.idleSwayYaw = THREE.MathUtils.lerp(this.idleSwayYaw || 0, targetSwayYaw, Math.min(1, dt * 12));
      this.idleSwayPitch = THREE.MathUtils.lerp(this.idleSwayPitch || 0, targetSwayPitch, Math.min(1, dt * 12));
    } else {
      this.idleSwayYaw = THREE.MathUtils.lerp(this.idleSwayYaw || 0, 0, Math.min(1, dt * 14));
      this.idleSwayPitch = THREE.MathUtils.lerp(this.idleSwayPitch || 0, 0, Math.min(1, dt * 14));
    }

    const adsSnapArc = (!customRot && !this.isFistsMode) ? Math.sin(this._adsBlend * Math.PI) : 0;
    const adsSnapRotZ = -0.072 * adsSnapArc;
    const adsSnapY = -0.008 * adsSnapArc;
    const grabCantActive = (!customRot && !this.isFistsMode && !isAdsActive && grabArc > 0.01) ? grabArc : 0;
    const grabPosX = 0.032 * grabCantActive;
    const grabPosY = 0.010 * grabCantActive;
    const grabRotX = 0.065 * grabCantActive;
    const grabRotZ = -0.14 * grabCantActive;
    const sprScale = isAdsActive ? (0.38 * Math.max(0.22, zoomDamp)) : 1.0;

    // Wide-aperture magnified scope eye-box toggle & dynamic optical eye-relief (stays active & slightly offset during ADS reload; disabled in 45° Tac-Stance!)
    const isAdsReload = !!(isAdsActive && this.isReloading && !this.isInspecting && !this.isPlating && !this.isHealing && !(this.meleeSwingTimer > 0));
    const allowScopeEyeBox = !!(isAdsActive && tsB < 0.35 && (!customRot || isAdsReload) && !this.wallBlocked && !this.isThirdPerson);
    let effectiveAdsZ = this.adsZ;
    let scopeEyeBoxActive = false;
    if (this.scopeOptic) {
      const sc = this.scopeOptic;
      const eyeBoxActive = !!(allowScopeEyeBox && this._adsBlend > 0.48);
      scopeEyeBoxActive = eyeBoxActive;
      if (sc.holeMask) sc.holeMask.visible = eyeBoxActive;
      if (sc.bezel) sc.bezel.visible = eyeBoxActive;
      if (sc.shadowRing) {
        sc.shadowRing.visible = eyeBoxActive;
        if (eyeBoxActive) {
          let shOffX = isAdsReload
            ? THREE.MathUtils.clamp(-reloadPosOffset.x * 0.24, -0.0020, 0.0020)
            : THREE.MathUtils.clamp(-this.idleSwayYaw * 0.30, -0.0016, 0.0016);
          let shOffY = isAdsReload
            ? THREE.MathUtils.clamp(-reloadPosOffset.y * 0.24, -0.0020, 0.0020)
            : THREE.MathUtils.clamp(-this.idleSwayPitch * 0.30, -0.0016, 0.0016);
          const offMag = Math.hypot(shOffX, shOffY);
          if (offMag > 0.0020) {
            const k = 0.0020 / offMag;
            shOffX *= k;
            shOffY *= k;
          }
          // Seated at rearZ + 0.0002 behind ocularBezel (rearZ + 0.0006) with wide outer skirt so zero gap ever appears at the inner rim!
          sc.shadowRing.position.set(shOffX, (sc.scopeY || this.sightHeight) + shOffY, sc.rearZ + 0.0002);
          const targetShScale = isAdsReload ? 0.97 : 1.0;
          const nextShScale = THREE.MathUtils.lerp(sc.shadowRing.scale.x || 1.0, targetShScale, Math.min(1, dt * 14));
          sc.shadowRing.scale.setScalar(nextShScale);
          if (sc.shadowRing.material) {
            sc.shadowRing.material.opacity = 1.0;
          }
        }
      }
      if (sc.boreMesh) sc.boreMesh.visible = !eyeBoxActive;
      if (sc.retGroup) sc.retGroup.visible = eyeBoxActive || (allowScopeEyeBox && this._adsBlend > 0.25);

      if (allowScopeEyeBox && adsZoom >= 2.0) {
        // Generous MW4/DMZ ocular aperture scaling with zoom: ~53% at 3x, ~59% at 4x, ~68% at 6x, ~74% at 8x
        const targetScreenFrac = THREE.MathUtils.clamp(0.30 + Math.log2(Math.max(1.5, adsZoom)) * 0.145, 0.46, 0.76);
        const baseFovNow = window.BASE_FOV || 75;
        const vmBaseNow = (window.WEAPON_FOV_MODE === 'independent') ? (window.VIEWMODEL_FOV || 75) : baseFovNow;
        const targetVmAdsFov = (window.GAME_DATA && window.GAME_DATA.computeAdsFov)
          ? window.GAME_DATA.computeAdsFov(vmBaseNow, adsZoom)
          : (vmBaseNow / Math.max(1.0, adsZoom));
        const tanHalfVm = Math.max(0.04, Math.tan(THREE.MathUtils.degToRad(targetVmAdsFov * 0.5)));
        const dEye = THREE.MathUtils.clamp(sc.rEye / (targetScreenFrac * tanHalfVm), 0.042, 0.56);
        effectiveAdsZ = -(sc.rearZ + dEye);
      }
    }
    if (this.muzzleMesh && this.muzzleMesh.material) {
      // Allow muzzle flash to illuminate cleanly off the visible barrel/muzzle at the bottom of the magnified scope!
      this.muzzleMesh.material.depthTest = !scopeEyeBoxActive;
    }

    // Sprint-out weapon readiness dip when coming directly out of Sprint / Tac-Sprint into fire
    const stfFrac = (this.sprintOutTimer > 0 && !sprintingHip && !tacSprintingHip && !isAdsActive && !customRot)
      ? THREE.MathUtils.clamp(this.sprintOutTimer / 0.28, 0, 1)
      : 0;
    const stfRotX = stfFrac * 0.18;
    const stfRotY = stfFrac * 0.12;
    const stfCantZ = -0.66 * tsB;
    const stfCantY = 0.055 * tsB;

    const slideCantZ = (!customRot && !this.isFistsMode && player.isSliding) ? (isAdsActive ? -0.10 : -0.32) : 0;
    const slideCantY = (!customRot && !this.isFistsMode && player.isSliding) ? (isAdsActive ? 0.0 : 0.18) : 0;
    const sprintRotX = this.isFistsMode ? 0 : (tacSprintingHip ? 0.86 : (sprintingHip ? -0.14 : stfRotX));
    const sprintRotY = this.isFistsMode ? 0 : (tacSprintingHip ? 0.16 : (sprintingHip ? 0.22 : stfRotY));
    const sprintRotZ = this.isFistsMode ? 0 : (tacSprintingHip ? -0.14 : (sprintingHip ? 0.08 : 0));
    const leanRotZ = isAdsActive ? (-player.lean * 0.13) : (-player.lean * 0.22);
    const swayPitchVisual = this.idleSwayPitch / Math.max(1.0, Math.sqrt(adsZoom));
    const swayYawVisual = this.idleSwayYaw / Math.max(1.0, Math.sqrt(adsZoom));
    const targetRotX = (customRot && !this.isFistsMode ? activeRotOff.x : (sprintRotX + swayRotX + this.recoilPitch + this._flinchPitch + swayPitchVisual + this.lookSwayRotX + wallRotX + grabRotX)) + drawRot.x + this._sprRot.x * sprScale;
    const targetRotY = (customRot && !this.isFistsMode ? activeRotOff.y : (sprintRotY + slideCantY + stfCantY + this.recoilYaw + this._flinchYaw - swayYawVisual + this.lookSwayRotY + wallRotY + leanCantY)) + drawRot.y + this._sprRot.y * sprScale;
    const targetRotZ = (customRot && !this.isFistsMode ? activeRotOff.z : (sprintRotZ + swayRotZ + slideCantZ + stfCantZ + boltActionRoll + this.recoilRoll + this._flinchRoll + this.lookSwayRotZ + wallRotZ + leanRotZ + adsSnapRotZ + grabRotZ)) + drawRot.z + this._sprRot.z * sprScale;

    // MW4 Weapon Field of View Perspective Preset (Narrow / Default / Wide — scales hipfire framing without distorting scope eye-relief!)
    const wfovScale = window.WEAPON_FOV_SCALE || 'default';
    const hipScaleX = wfovScale === 'wide' ? 0.014 : (wfovScale === 'narrow' ? -0.012 : 0.0);
    const hipScaleZ = wfovScale === 'wide' ? -0.046 : (wfovScale === 'narrow' ? 0.030 : 0.0);

    if (!this.fpArms && window.RigAssets && window.RigAssets.ready && typeof this.ensureFPArms === 'function') {
      this.ensureFPArms();
    }

    // MW4/DMZ One-Handed High-Port Tactical Sprint + 45° Tactical Stance cant pivot!
    const adsPivotActive = isAdsActive && (!customRot || isAdsReload);
    const adsPivotX = adsPivotActive ? (Math.sin(targetRotZ) * this.sightHeight) : 0;
    const adsPivotY = adsPivotActive ? ((1 - Math.cos(targetRotZ)) * this.sightHeight) : 0;
    const hipPosX = (tacSprintingHip ? 0.145 : (sprintingHip ? 0.115 : 0.135)) + hipScaleX;
    const hipPosY = tacSprintingHip ? -0.14 : (sprintingHip ? -0.235 : -0.20);
    const hipPosZ = (tacSprintingHip ? -0.34 : (sprintingHip ? -0.40 : -0.42)) + hipScaleZ;
    const adsTargetX = adsPivotX + 0.056 * tsB;
    const adsTargetY = -this.sightHeight + adsPivotY - 0.022 * tsB;
    const adsTargetZ = THREE.MathUtils.lerp(effectiveAdsZ, this.adsZ - 0.045, tsB);

    const basePosX = this.isFistsMode ? 0.0 : THREE.MathUtils.lerp(hipPosX, adsTargetX, this._adsBlend);
    const basePosY = this.isFistsMode ? -0.16 : THREE.MathUtils.lerp(hipPosY, adsTargetY, this._adsBlend);
    const basePosZ = this.isFistsMode ? -0.38 : THREE.MathUtils.lerp(hipPosZ, adsTargetZ, this._adsBlend);

    const targetX = basePosX + this.recoilX + this.lookSwayX + activePosOff.x + wallPosX + leanAlignX + drawPos.x + grabPosX + this._sprPos.x * sprScale;
    const targetY = basePosY + this.lookSwayY + activePosOff.y + wallPosY + drawPos.y + adsSnapY + grabPosY + airDriftY + this._sprPos.y * sprScale;
    const targetZ = basePosZ + this.recoilZ + activePosOff.z + wallPosZ + drawPos.z + this._sprPos.z * sprScale;

    const adsSnapping = isAdsActive || this._adsLinear > 0.01;
    const adsTrackRate = Math.max(18, Math.min(36, 4.2 / adsTimeSec));
    const lerpRate = this.isReloading ? 28 : ((this.isPlating || this.isHealing) ? 16 : (this.isInspecting ? 9 : (this.drawTimer > 0 ? 24 : (adsSnapping ? adsTrackRate : 14))));
    this.viewmodelGroup.position.x = THREE.MathUtils.lerp(this.viewmodelGroup.position.x, targetX + bobX, Math.min(1, dt * lerpRate));
    this.viewmodelGroup.position.y = THREE.MathUtils.lerp(this.viewmodelGroup.position.y, targetY - bobY, Math.min(1, dt * lerpRate));
    this.viewmodelGroup.position.z = THREE.MathUtils.lerp(this.viewmodelGroup.position.z, targetZ, Math.min(1, dt * (lerpRate + 2)));

    const rotRate = this.isReloading ? 26 : ((this.isPlating || this.isHealing) ? 14 : (this.isInspecting ? 8 : (adsSnapping ? adsTrackRate : 12)));
    this.viewmodelGroup.rotation.x = THREE.MathUtils.lerp(this.viewmodelGroup.rotation.x, targetRotX, Math.min(1, dt * rotRate));
    this.viewmodelGroup.rotation.y = THREE.MathUtils.lerp(this.viewmodelGroup.rotation.y, targetRotY, Math.min(1, dt * rotRate));
    this.viewmodelGroup.rotation.z = THREE.MathUtils.lerp(this.viewmodelGroup.rotation.z, targetRotZ, Math.min(1, dt * rotRate));

    // Fists Mode: Proper alternating left/right pumping animations (walk/sprint/tac-sprint) + alternating jab/cross punches!
    if (this.isFistsMode && this.leftHand && this.rightHand) {
      const fRate = Math.min(1, dt * 18);
      const breath = Math.sin(this.bobTimer * 1.4) * 0.008;
      const pumpAmp = moving ? (tacSprintingHip ? 1.25 : (sprintingHip ? 0.90 : 0.36)) : 0;
      const lSin = Math.sin(this.bobTimer);
      const lCos = Math.cos(this.bobTimer);
      const rSin = Math.sin(this.bobTimer + Math.PI);
      const rCos = Math.cos(this.bobTimer + Math.PI);

      // Alternating pump offsets (180° opposite phase: one drives forward/up while the other pulls back/down)
      let lTarget = new THREE.Vector3(
        this.leftHandRestPos.x + (moving ? lSin * 0.026 * pumpAmp : 0),
        this.leftHandRestPos.y + (moving ? lSin * 0.056 * pumpAmp : breath),
        this.leftHandRestPos.z + (moving ? (-lSin * 0.095 - Math.abs(lCos) * 0.015) * pumpAmp : 0)
      );
      let rTarget = new THREE.Vector3(
        this.rightHandRestPos.x - (moving ? rSin * 0.026 * pumpAmp : 0),
        this.rightHandRestPos.y + (moving ? rSin * 0.056 * pumpAmp : -breath * 0.6),
        this.rightHandRestPos.z + (moving ? (-rSin * 0.095 - Math.abs(rCos) * 0.015) * pumpAmp : 0)
      );

      // Keep fists upright at the end of the forearm (especially during sprint / tac-sprint pumping)
      const uprightPitch = tacSprintingHip ? 0.86 : (sprintingHip ? 0.72 : 0.56);
      let lRotX = uprightPitch + (moving ? lSin * 0.16 * pumpAmp : 0);
      let lRotY = this.leftHandRestRot.y + (moving ? lSin * 0.12 * pumpAmp : 0);
      let lRotZ = this.leftHandRestRot.z - player.lean * 0.14 + this.lookSwayRotZ * 0.35;

      let rRotX = uprightPitch + (moving ? rSin * 0.16 * pumpAmp : 0);
      let rRotY = this.rightHandRestRot.y - (moving ? rSin * 0.12 * pumpAmp : 0);
      let rRotZ = this.rightHandRestRot.z - player.lean * 0.14 + this.lookSwayRotZ * 0.35;

      // Alternating left jab / right cross punch animation
      if (this.meleeSwingTimer > 0) {
        const p = 1 - (this.meleeSwingTimer / Math.max(0.01, this.meleeSwingDuration));
        const thrust = p < 0.32 ? Math.sin((p / 0.32) * Math.PI * 0.5) : Math.cos(((p - 0.32) / 0.68) * Math.PI * 0.5);
        if (this._fistPunchSide) {
          rTarget.set(
            THREE.MathUtils.lerp(this.rightHandRestPos.x, 0.03, thrust),
            THREE.MathUtils.lerp(this.rightHandRestPos.y, 0.03, thrust),
            THREE.MathUtils.lerp(this.rightHandRestPos.z, -0.34, thrust)
          );
          rRotX = THREE.MathUtils.lerp(uprightPitch, 0.05, thrust);
          rRotZ = this.rightHandRestRot.z + 0.55 * thrust;
          // Left guard tucks slightly back
          lTarget.z += 0.05 * thrust;
        } else {
          lTarget.set(
            THREE.MathUtils.lerp(this.leftHandRestPos.x, -0.03, thrust),
            THREE.MathUtils.lerp(this.leftHandRestPos.y, 0.04, thrust),
            THREE.MathUtils.lerp(this.leftHandRestPos.z, -0.34, thrust)
          );
          lRotX = THREE.MathUtils.lerp(uprightPitch, 0.05, thrust);
          lRotZ = this.leftHandRestRot.z - 0.55 * thrust;
          // Right guard tucks slightly back
          rTarget.z += 0.05 * thrust;
        }
      }

      this.leftHand.visible = true;
      this.rightHand.visible = true;
      if (this.leftHand.userData) this.leftHand.userData.climbLock = null;
      if (this.rightHand.userData) this.rightHand.userData.climbLock = null;
      this.leftHand.position.lerp(lTarget, fRate);
      this.leftHand.rotation.x = THREE.MathUtils.lerp(this.leftHand.rotation.x, lRotX, fRate);
      this.leftHand.rotation.y = THREE.MathUtils.lerp(this.leftHand.rotation.y, lRotY, fRate);
      this.leftHand.rotation.z = THREE.MathUtils.lerp(this.leftHand.rotation.z, lRotZ, fRate);
      if (mantleContactW > 0.01 && player.mantleState && player.mantleState.edgePos && this.leftHand.userData) {
        const ms = player.mantleState;
        const ledgeInward = new THREE.Vector3(ms.inwardX || 0, 0, ms.inwardZ || 0);
        if (ledgeInward.lengthSq() < 1e-5) ledgeInward.set(-Math.sin(ms.ledgeYaw || player.yaw), 0, -Math.cos(ms.ledgeYaw || player.yaw));
        ledgeInward.normalize();
        const ledgeOutward = ledgeInward.clone().negate();
        const worldUp = new THREE.Vector3(0, 1, 0);
        const ledgeRight = new THREE.Vector3().crossVectors(ledgeInward, worldUp).normalize();
        const latOff = Math.min(0.16, ms.edgeHalfWidth || 0.18);
        this.leftHand.userData.activeStyle = 'ledgePressL';
        this.leftHand.userData.climbLock = {
          blend: mantleContactW,
          pressT: 1.0,
          palmWorld: ms.edgePos.clone().addScaledVector(ledgeRight, -latOff).addScaledVector(worldUp, 0.016).addScaledVector(ledgeInward, 0.045),
          fWorld: new THREE.Vector3().addScaledVector(ledgeInward, 0.92).addScaledVector(worldUp, -0.10).addScaledVector(ledgeRight, 0.14).normalize(),
          backWorld: new THREE.Vector3().addScaledVector(worldUp, 0.95).addScaledVector(ledgeOutward, 0.22).addScaledVector(ledgeRight, -0.18).normalize(),
          poleOffsetWorld: new THREE.Vector3().addScaledVector(ledgeOutward, 0.44).addScaledVector(ledgeRight, -0.42).addScaledVector(worldUp, -0.22),
          bodyYaw: ms.ledgeYaw ?? player.yaw,
          isMantle: true
        };
      }

      this.rightHand.position.lerp(rTarget, fRate);
      this.rightHand.rotation.x = THREE.MathUtils.lerp(this.rightHand.rotation.x, rRotX, fRate);
      this.rightHand.rotation.y = THREE.MathUtils.lerp(this.rightHand.rotation.y, rRotY, fRate);
      this.rightHand.rotation.z = THREE.MathUtils.lerp(this.rightHand.rotation.z, rRotZ, fRate);
    } else if (this.leftHand && !customRot && !(weaponDef && weaponDef.id === 'm870' && this.pumpTimer > 0)) {
      // Left-handed clenched fist pumping upright at the end of the forearm during Tactical Sprint!
      if (tacSprintingHip) {
        const pump = Math.sin(this.bobTimer + Math.PI);
        const pumpCos = Math.cos(this.bobTimer + Math.PI);
        // Desired fist position in camera space (bottom-left, pumping forward/up & back/down cleanly)
        const camFistPos = new THREE.Vector3(
          -0.215 + pumpCos * 0.020,
          -0.155 + pump * 0.050,
          -0.34 + pump * 0.070
        );
        let fistLocalPos = new THREE.Vector3(-0.34 + pumpCos * 0.020, -0.03 + pump * 0.050, -0.14 + pump * 0.070);
        if (this.vmCamera && this.currentMesh) {
          this.vmCamera.updateMatrixWorld(true);
          this.currentMesh.updateMatrixWorld(true);
          fistLocalPos = this.currentMesh.worldToLocal(this.vmCamera.localToWorld(camFistPos.clone()));
        }
        this.leftHand.visible = false;
        if (this.leftHand.userData) this.leftHand.userData.activeStyle = 'leftFist';
        if (this.leftFist) {
          this.leftFist.visible = true;
          if (this.leftFist.userData) this.leftFist.userData.activeStyle = 'leftFist';
          this.leftFist.position.lerp(fistLocalPos, Math.min(1, dt * 18));
          // Cancel parent viewmodelGroup pitch/yaw/roll and pitch +0.86 rad upward so the fist stands upright collinearly at the end of the arm!
          const parentInvQ = this.viewmodelGroup.quaternion.clone().invert();
          const camFistQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.86 + pump * 0.14, 0.14, -0.08, 'YXZ'));
          const targetFistQ = parentInvQ.multiply(camFistQ);
          this.leftFist.quaternion.slerp(targetFistQ, Math.min(1, dt * 18));
        }
        this.leftHand.position.copy(this.leftFist ? this.leftFist.position : fistLocalPos);
      } else {
        this.leftHand.visible = true;
        if (this.leftHand.userData && this.leftHand.userData.activeStyle === 'leftFist') {
          this.leftHand.userData.activeStyle = null;
        }
        if (this.leftFist) {
          this.leftFist.visible = false;
          this.leftFist.position.copy(this.leftHand.position);
        }
        if (this.leftHand.userData) {
          this.leftHand.userData.climbLock = null;
        }
        if (mantleContactW > 0.01 && player.mantleState && player.mantleState.edgePos) {
          // Supporting left hand locks in WORLD SPACE onto the top edge of the obstacle while vaulting!
          const ms = player.mantleState;
          const ledgeInward = new THREE.Vector3(ms.inwardX || 0, 0, ms.inwardZ || 0);
          if (ledgeInward.lengthSq() < 1e-5) ledgeInward.set(-Math.sin(ms.ledgeYaw || player.yaw), 0, -Math.cos(ms.ledgeYaw || player.yaw));
          ledgeInward.normalize();
          const ledgeOutward = ledgeInward.clone().negate();
          const worldUp = new THREE.Vector3(0, 1, 0);
          const ledgeRight = new THREE.Vector3().crossVectors(ledgeInward, worldUp).normalize();
          const latOff = Math.min(0.16, ms.edgeHalfWidth || 0.18);
          const palmWorld = ms.edgePos.clone()
            .addScaledVector(ledgeRight, -latOff)
            .addScaledVector(worldUp, 0.016)
            .addScaledVector(ledgeInward, 0.045);
          const fWorld = new THREE.Vector3()
            .addScaledVector(ledgeInward, 0.92)
            .addScaledVector(worldUp, -0.10)
            .addScaledVector(ledgeRight, 0.14)
            .normalize();
          const backWorld = new THREE.Vector3()
            .addScaledVector(worldUp, 0.95)
            .addScaledVector(ledgeOutward, 0.22)
            .addScaledVector(ledgeRight, -0.18)
            .normalize();
          const poleOffsetWorld = new THREE.Vector3()
            .addScaledVector(ledgeOutward, 0.44)
            .addScaledVector(ledgeRight, -0.42)
            .addScaledVector(worldUp, -0.22);

          if (this.leftHand.userData) {
            this.leftHand.userData.activeStyle = 'ledgePressL';
            this.leftHand.userData.climbLock = {
              blend: mantleContactW,
              pressT: 1.0,
              palmWorld,
              fWorld,
              backWorld,
              poleOffsetWorld,
              bodyYaw: ms.ledgeYaw ?? player.yaw,
              isMantle: true
            };
          }
          if (this.camera && this.vmCamera && this.currentMesh) {
            this.camera.updateMatrixWorld(true);
            this.vmCamera.position.copy(this.camera.position);
            this.vmCamera.quaternion.copy(this.camera.quaternion);
            this.vmCamera.updateMatrixWorld(true);
            this.currentMesh.updateMatrixWorld(true);
            const localLedge = this.currentMesh.worldToLocal(palmWorld.clone());
            this.leftHand.position.lerpVectors(this.leftHandRestPos, localLedge, mantleContactW);
          }
          this.leftHand.rotation.x = THREE.MathUtils.lerp(this.leftHand.rotation.x, -0.55 * mantleContactW, Math.min(1, dt * 20));
          this.leftHand.rotation.y = THREE.MathUtils.lerp(this.leftHand.rotation.y, 0.22 * mantleContactW, Math.min(1, dt * 20));
          this.leftHand.rotation.z = THREE.MathUtils.lerp(this.leftHand.rotation.z, 0.30 * mantleContactW, Math.min(1, dt * 20));
        } else if (proneHandPushArc > 0.04) {
          // Supporting left hand leaves gun to plant on the ground / push off while entering or exiting prone!
          if (this.leftHand.userData) this.leftHand.userData.activeStyle = 'slapOpen';
          const pushTarget = new THREE.Vector3(
            this.leftHandRestPos.x - 0.24 * proneHandPushArc,
            this.leftHandRestPos.y - 0.26 * proneHandPushArc,
            this.leftHandRestPos.z - 0.16 * proneHandPushArc
          );
          this.leftHand.position.lerp(pushTarget, Math.min(1, dt * 20));
          this.leftHand.rotation.x = THREE.MathUtils.lerp(this.leftHand.rotation.x, -1.05 * proneHandPushArc, Math.min(1, dt * 18));
          this.leftHand.rotation.y = THREE.MathUtils.lerp(this.leftHand.rotation.y, 0.25 * proneHandPushArc, Math.min(1, dt * 18));
          this.leftHand.rotation.z = THREE.MathUtils.lerp(this.leftHand.rotation.z, 0.55 * proneHandPushArc, Math.min(1, dt * 18));
        } else if (grabArc > 0.02 && !isAdsActive) {
          // Supporting left hand dynamically reaches out to grab ground items, weapons, doors, or container latches within natural shoulder reach!
          if (this.leftHand.userData) this.leftHand.userData.activeStyle = grabStyle || 'grabReach';
          const reachZ = (this.grabKind === 'container') ? -0.14 : -0.13;
          const reachY = (this.grabKind === 'container') ? -0.05 : -0.12;
          const itemTarget = new THREE.Vector3(
            this.leftHandRestPos.x - 0.10 * grabArc,
            this.leftHandRestPos.y + reachY * grabArc,
            this.leftHandRestPos.z + reachZ * grabArc
          );
          this.leftHand.position.lerp(itemTarget, Math.min(1, dt * 24));
          this.leftHand.rotation.x = THREE.MathUtils.lerp(this.leftHand.rotation.x, -0.52 * grabArc, Math.min(1, dt * 22));
          this.leftHand.rotation.y = THREE.MathUtils.lerp(this.leftHand.rotation.y, 0.22 * grabArc, Math.min(1, dt * 22));
          this.leftHand.rotation.z = THREE.MathUtils.lerp(this.leftHand.rotation.z, 0.28 * grabArc, Math.min(1, dt * 22));
        } else {
          if (this.leftHand.userData) {
            if (this.hasVertGrip) {
              this.leftHand.userData.activeStyle = 'foregrip';
            } else if (
              this.leftHand.userData.activeStyle === 'grabReach' ||
              this.leftHand.userData.activeStyle === 'grabClose' ||
              this.leftHand.userData.activeStyle === 'slapOpen' ||
              this.leftHand.userData.activeStyle === 'ledgePressL' ||
              this.leftHand.userData.activeStyle === 'foregrip' ||
              this.leftHand.userData.activeStyle === 'supportRifle'
            ) {
              this.leftHand.userData.activeStyle = null;
            }
          }
          if (this.hasVertGrip) {
            // Lock support hand directly onto the live geometric center of the vertical foregrip shaft (0.00cm offset!)
            if (this.foregripAnchor && this.currentMesh) {
              this.currentMesh.updateWorldMatrix(true, true);
              const fgLocal = this.currentMesh.worldToLocal(this.foregripAnchor.getWorldPosition(new THREE.Vector3()));
              this.leftHand.position.copy(fgLocal);
            } else {
              this.leftHand.position.copy(this.leftHandRestPos);
            }
            this.leftHand.rotation.set(0, 0, 0);
          } else {
            // MW4 Kinetic Support-Hand Slide: conforms dynamically along handguard for 45° Tac-Stance C-clamp, CQB wall-tuck & Prone brace!
            const proneSlideZ = player.isProne ? -0.010 : 0.0;
            const dynLeftPos = new THREE.Vector3(
              this.leftHandRestPos.x - 0.008 * tsB,
              this.leftHandRestPos.y + 0.008 * tsB - 0.004 * wp,
              this.leftHandRestPos.z - 0.014 * tsB + 0.014 * wp + proneSlideZ
            );
            this.leftHand.position.lerp(dynLeftPos, Math.min(1, dt * 18));
            this.leftHand.rotation.x = THREE.MathUtils.lerp(this.leftHand.rotation.x, this.leftHandRestRot.x + 0.06 * tsB, Math.min(1, dt * 18));
            this.leftHand.rotation.y = THREE.MathUtils.lerp(this.leftHand.rotation.y, this.leftHandRestRot.y + 0.08 * tsB, Math.min(1, dt * 18));
            this.leftHand.rotation.z = THREE.MathUtils.lerp(this.leftHand.rotation.z, this.leftHandRestRot.z + 0.16 * tsB, Math.min(1, dt * 18));
          }
        }
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

    // Aim forearms from shoulder anchors to each hand's articulated wrist joint (shifting subtly with lean & camera turn inertia!)
    const leanShX = -player.lean * 0.055;
    const swayShX = -this.lookSwayX * 0.45;
    if (this.rightArm && this.rightHand) {
      if (!customRot && !this.isFistsMode) {
        this.rightHand.rotation.z = THREE.MathUtils.lerp(
          this.rightHand.rotation.z,
          this.rightHandRestRot.z - player.lean * 0.12 + this.lookSwayRotZ * 0.35 + this.recoilRoll * 0.5,
          Math.min(1, dt * 16)
        );
      }
      const rShoulder = this.isFistsMode
        ? new THREE.Vector3(0.30 + leanShX + swayShX, -0.34 - Math.abs(player.lean) * 0.02, 0.24)
        : new THREE.Vector3(0.14 + leanShX + swayShX, -0.20 - Math.abs(player.lean) * 0.02, 0.36);
      const rWrist = this.rightHand.position.clone().add(new THREE.Vector3(0.008, -0.010, 0.034));
      this._currentAimHand = this.rightHand;
      this._aimArm(this.rightArm, rShoulder, rWrist);
    }
    if (this.leftArm && this.leftHand) {
      if (!customRot && !tacSprintingHip && !this.isFistsMode) {
        this.leftHand.rotation.z = THREE.MathUtils.lerp(
          this.leftHand.rotation.z,
          this.leftHandRestRot.z - player.lean * 0.14 + this.lookSwayRotZ * 0.35 + this.recoilRoll * 0.5 + 0.16 * tsB,
          Math.min(1, dt * 16)
        );
      }
      let lShoulder;
      let lWrist;
      if (this.isFistsMode) {
        lShoulder = new THREE.Vector3(-0.30 + leanShX + swayShX, -0.34 - Math.abs(player.lean) * 0.02, 0.24);
        lWrist = this.leftHand.position.clone().add(new THREE.Vector3(-0.010, -0.026, 0.020));
      } else if (tacSprintingHip && this.vmCamera && this.currentMesh) {
        this.vmCamera.updateMatrixWorld(true);
        this.currentMesh.updateMatrixWorld(true);
        lShoulder = this.currentMesh.worldToLocal(this.vmCamera.localToWorld(new THREE.Vector3(-0.27, -0.34, 0.14)));
        const activeFistPos = this.leftFist ? this.leftFist.position : this.leftHand.position;
        const wCam = this.vmCamera.worldToLocal(this.currentMesh.localToWorld(activeFistPos.clone())).add(new THREE.Vector3(-0.008, -0.030, 0.022));
        lWrist = this.currentMesh.worldToLocal(this.vmCamera.localToWorld(wCam));
      } else {
        lShoulder = tacSprintingHip
          ? new THREE.Vector3(-0.48, -0.28, 0.26)
          : new THREE.Vector3(-0.20 + leanShX + swayShX, -0.20 - Math.abs(player.lean) * 0.02, 0.30);
        lWrist = this.leftHand.position.clone().add(new THREE.Vector3(-0.010, -0.010, 0.034));
      }
      this._currentAimHand = (tacSprintingHip && this.leftFist && this.leftFist.visible) ? this.leftFist : this.leftHand;
      this._aimArm(this.leftArm, lShoulder, lWrist);
    }

    // MW4 DMZ Optical Zoom-Scaled ADS FOV (Affected vs Independent 80° baseline, 45° Tac-Stance 1.18x, Focus +4.5% zoom & per-gun ADS speed!)
    const baseFov = window.BASE_FOV || 75;
    const tacBoost = tacSprintingHip ? 5 : 0;
    const slideBoost = (player.isSliding && !isAdsActive) ? 8.5 : 0;
    const focusZoomBoost = (isAdsActive && player.isFocusing) ? 1.045 : 1.0;
    const effZoom = THREE.MathUtils.lerp(adsZoom, 1.18, tsB) * focusZoomBoost;
    const computedAdsFov = (window.GAME_DATA && window.GAME_DATA.computeAdsFov)
      ? window.GAME_DATA.computeAdsFov(baseFov, effZoom)
      : (weaponDef ? Math.min(baseFov, weaponDef.adsFov || 55) : baseFov);
    const targetFov = (isAdsActive && weaponDef) ? computedAdsFov : (baseFov + Math.max(tacBoost, slideBoost));
    const fovRate = isAdsActive ? Math.max(11, Math.min(28, 3.6 / adsTimeSec)) : 16;
    if (Math.abs(this.camera.fov - targetFov) > 0.04) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * fovRate));
      this.camera.updateProjectionMatrix();
    }

    // Keep 1st-person viewmodels & rigs hidden while in 3rd-person debug camera
    if (this.isThirdPerson) {
      this.viewmodelGroup.visible = false;
      if (this.plateRig) this.plateRig.visible = false;
      if (this.medRig) this.medRig.visible = false;
      if (this.tacFistRig) this.tacFistRig.visible = false;
      if (this.reviveRig) this.reviveRig.visible = false;
    }

    // Update pooled particles (impacts & muzzle smoke) & tracers without runtime alloc/dispose
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
        p.mesh.visible = false;
        p.active = false;
        const lastIdx = this.particles.length - 1;
        if (i !== lastIdx) this.particles[i] = this.particles[lastIdx];
        this.particles.pop();
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, (t.life / (t.maxLife || 0.08)) * (t.baseOpacity || 0.82));
      if (t.life <= 0) {
        t.line.visible = false;
        t.active = false;
        const lastIdx = this.tracers.length - 1;
        if (i !== lastIdx) this.tracers[i] = this.tracers[lastIdx];
        this.tracers.pop();
      }
    }
  }

  _computeReloadPose(p, dt, pos, rot, player = null) {
    const smooth = (t) => t * t * (3 - 2 * t);
    const id = this.reloadWeaponId;
    const handRate = Math.min(1, dt * 22);

    const setLeftStyle = (st) => {
      if (this.leftHand && this.leftHand.userData) this.leftHand.userData.activeStyle = st || null;
    };
    const setRightStyle = (st) => {
      if (this.rightHand && this.rightHand.userData) this.rightHand.userData.activeStyle = st || null;
    };
    const lerpHandRot = (hand, rx, ry, rz) => {
      if (!hand) return;
      hand.rotation.x = THREE.MathUtils.lerp(hand.rotation.x, rx, handRate);
      hand.rotation.y = THREE.MathUtils.lerp(hand.rotation.y, ry, handRate);
      hand.rotation.z = THREE.MathUtils.lerp(hand.rotation.z, rz, handRate);
    };

    // Exact grip/magwell extraction axis (prevents magazine clipping through angled grips)
    const alongMag = new THREE.Vector3(0, -1, 0).applyEuler(this.magRestRot).normalize();
    const setMagAlong = (distOut, lateralX = 0) => {
      if (!this.magMesh) return;
      this.magMesh.position.copy(this.magRestPos).addScaledVector(alongMag, distOut);
      this.magMesh.position.x += lateralX;
    };
    const handOnMag = (extraDist = 0.03, styleName = 'magGrip') => {
      if (!this.magMesh || !this.leftHand) return;
      const target = this.magMesh.position.clone().addScaledVector(alongMag, extraDist);
      target.x -= 0.004;
      this.leftHand.position.lerp(target, handRate);
      lerpHandRot(this.leftHand, this.magMesh.rotation.x * 0.85, 0.14, 0.08);
      setLeftStyle(styleName);
    };

    const moveLeftHand = (x, y, z, rx = null, ry = null, rz = null, styleName = null) => {
      if (!this.leftHand) return;
      this.leftHand.position.lerp(new THREE.Vector3(x, y, z), handRate);
      if (rx !== null) lerpHandRot(this.leftHand, rx, ry !== null ? ry : 0, rz !== null ? rz : 0);
      if (styleName !== null) setLeftStyle(styleName);
    };
    const moveRightHand = (x, y, z, rx = null, ry = null, rz = null, styleName = null) => {
      if (!this.rightHand) return;
      this.rightHand.position.lerp(new THREE.Vector3(x, y, z), handRate);
      if (rx !== null) lerpHandRot(this.rightHand, rx, ry !== null ? ry : 0, rz !== null ? rz : 0);
      if (styleName !== null) setRightStyle(styleName);
    };
    const restLeftHand = () => {
      if (this.leftHand) {
        this.leftHand.position.lerp(this.leftHandRestPos, handRate);
        lerpHandRot(this.leftHand, this.leftHandRestRot.x, this.leftHandRestRot.y, this.leftHandRestRot.z);
        setLeftStyle(null);
        if (this.leftHand.userData && this.leftHand.userData.thumbGroup) {
          this.leftHand.userData.thumbGroup.rotation.set(0, 0, 0);
        }
      }
    };
    const restRightHand = () => {
      if (this.rightHand) {
        this.rightHand.position.lerp(this.rightHandRestPos, handRate);
        lerpHandRot(this.rightHand, this.rightHandRestRot.x, this.rightHandRestRot.y, this.rightHandRestRot.z);
        setRightStyle(null);
      }
    };

    if (id === 'mp5k') {
      restRightHand();

      if (!this.wasEmptyReload) {
        // MW2019+ MP5-K Tactical Reload (round stays chambered — skip cocking lock & HK slap!)
        if (p > 0.16 && !this.reloadSfxFlags.magOut) {
          this.reloadSfxFlags.magOut = true;
          window.soundEngine.playMagOut(this.reloadWeaponId);
        }
        if (p > 0.62 && !this.reloadSfxFlags.magIn) {
          this.reloadSfxFlags.magIn = true;
          window.soundEngine.playMagIn(this.reloadWeaponId);
        }
        if (this.chamberRoundMesh) this.chamberRoundMesh.visible = true;
        if (this.boltMesh) { this.boltMesh.position.copy(this.boltRestPos); this.boltMesh.rotation.copy(this.boltRestRot); }
        if (this.boltCarrierMesh) this.boltCarrierMesh.position.copy(this.boltCarrierRestPos);

        if (p < 0.28) {
          const t = smooth(p / 0.28);
          pos.x = -0.10 * t; pos.y = 0.10 * t; pos.z = -0.01 * t;
          rot.x = 0.26 * t; rot.y = 0.28 * t; rot.z = -0.38 * t;
          if (this.magMesh) {
            const dropT = Math.max(0, (p / 0.28 - 0.18) / 0.82);
            setMagAlong(dropT * 0.21, -Math.max(0, dropT - 0.65) * 0.05);
            this.magMesh.visible = dropT < 0.88;
            handOnMag(0.03, 'magGrip');
          }
        } else if (p < 0.72) {
          const rawT = (p - 0.28) / 0.44;
          const jolt = rawT > 0.82 ? Math.sin(Math.min(1, (rawT - 0.82) / 0.18) * Math.PI) : 0;
          pos.x = -0.10; pos.y = 0.10 + jolt * 0.022; pos.z = -0.01 - jolt * 0.008;
          rot.x = 0.26 + jolt * 0.085; rot.y = 0.28; rot.z = -0.38;
          if (this.magMesh) {
            this.magMesh.visible = rawT > 0.08;
            if (rawT < 0.46) {
              const alignT = smooth(THREE.MathUtils.clamp((rawT - 0.08) / 0.38, 0, 1));
              setMagAlong(THREE.MathUtils.lerp(0.18, 0.13, alignT), THREE.MathUtils.lerp(-0.055, 0, alignT));
            } else {
              const insT = smooth(THREE.MathUtils.clamp((rawT - 0.46) / 0.38, 0, 1));
              setMagAlong(THREE.MathUtils.lerp(0.13, 0, insT), 0);
            }
            handOnMag(0.03, 'magGrip');
          }
        } else {
          const t = smooth((p - 0.72) / 0.28);
          if (this.magMesh) { this.magMesh.visible = true; this.magMesh.position.copy(this.magRestPos); }
          restLeftHand();
          pos.x = THREE.MathUtils.lerp(-0.10, 0, t);
          pos.y = THREE.MathUtils.lerp(0.10, 0, t);
          pos.z = THREE.MathUtils.lerp(-0.01, 0, t);
          rot.x = THREE.MathUtils.lerp(0.26, 0, t);
          rot.y = THREE.MathUtils.lerp(0.28, 0, t);
          rot.z = THREE.MathUtils.lerp(-0.38, 0, t);
        }
        return;
      }

      // MP5-K Empty Reload: Lock charging handle into notch -> pull mag -> seat fresh mag -> open-palm H&K Slap!
      if (p > 0.06 && !this.reloadSfxFlags.boltLock) {
        this.reloadSfxFlags.boltLock = true;
        window.soundEngine.playRechamber(this.reloadWeaponId || 'mp5k');
      }
      if (p > 0.25 && !this.reloadSfxFlags.magOut) {
        this.reloadSfxFlags.magOut = true;
        window.soundEngine.playMagOut(this.reloadWeaponId);
      }
      if (p > 0.66 && !this.reloadSfxFlags.magIn) {
        this.reloadSfxFlags.magIn = true;
        window.soundEngine.playMagIn(this.reloadWeaponId);
      }
      if (p > 0.78 && !this.reloadSfxFlags.rack) {
        this.reloadSfxFlags.rack = true;
        window.soundEngine.playRechamber(this.reloadWeaponId || 'mp5k');
      }
      if (this.chamberRoundMesh) this.chamberRoundMesh.visible = p >= 0.78;

      if (p < 0.20) {
        const t = smooth(p / 0.20);
        pos.x = -0.10 * t; pos.y = 0.10 * t;
        rot.x = 0.14 * t; rot.y = -0.24 * t; rot.z = 0.26 * t;
        if (this.boltMesh) {
          this.boltMesh.position.z = this.boltRestPos.z + t * 0.068;
          this.boltMesh.position.y = this.boltRestPos.y + Math.max(0, (t - 0.5) * 2) * 0.016;
          this.boltMesh.rotation.z = Math.max(0, (t - 0.5) * 2) * 0.55;
          if (this.boltCarrierMesh) this.boltCarrierMesh.position.z = this.boltCarrierRestPos.z + t * 0.055;
          moveLeftHand(this.boltMesh.position.x - 0.018, this.boltMesh.position.y, this.boltMesh.position.z + 0.018, 0.12, 0.18, 0.15, 'leftBoltPinch');
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
        if (this.boltCarrierMesh) this.boltCarrierMesh.position.z = this.boltCarrierRestPos.z + 0.055;
        if (this.magMesh) {
          setMagAlong(t * 0.22, -Math.max(0, t - 0.65) * 0.06);
          this.magMesh.visible = t < 0.88;
          handOnMag(0.03, 'magGrip');
        }
      } else if (p < 0.70) {
        const rawT = (p - 0.42) / 0.28;
        const jolt = rawT > 0.86 ? Math.sin(((rawT - 0.86) / 0.14) * Math.PI) : 0;
        pos.x = -0.13; pos.y = 0.13 + jolt * 0.022;
        rot.x = 0.34 + jolt * 0.08; rot.y = 0.36; rot.z = -0.45;
        if (this.boltCarrierMesh) this.boltCarrierMesh.position.z = this.boltCarrierRestPos.z + 0.055;
        if (this.magMesh) {
          this.magMesh.visible = rawT > 0.06;
          if (rawT < 0.45) {
            const alignT = smooth(THREE.MathUtils.clamp((rawT - 0.06) / 0.39, 0, 1));
            setMagAlong(THREE.MathUtils.lerp(0.18, 0.14, alignT), THREE.MathUtils.lerp(-0.055, 0, alignT));
          } else {
            const insT = smooth(THREE.MathUtils.clamp((rawT - 0.45) / 0.45, 0, 1));
            setMagAlong(THREE.MathUtils.lerp(0.14, 0, insT), 0);
          }
          handOnMag(0.03, 'magGrip');
        }
      } else if (p < 0.90) {
        const rawT = (p - 0.70) / 0.20;
        const t = smooth(rawT);
        if (this.magMesh) { this.magMesh.visible = true; this.magMesh.position.copy(this.magRestPos); }
        const slapJolt = rawT > 0.42 ? Math.sin(Math.min(1, (rawT - 0.42) / 0.34) * Math.PI) : 0;
        pos.x = THREE.MathUtils.lerp(-0.13, -0.09, t);
        pos.y = THREE.MathUtils.lerp(0.13, 0.08, t) - slapJolt * 0.026;
        rot.x = THREE.MathUtils.lerp(0.34, 0.10, t) - slapJolt * 0.11;
        rot.y = THREE.MathUtils.lerp(0.36, -0.22, t);
        rot.z = THREE.MathUtils.lerp(-0.45, 0.26, t);
        if (this.boltMesh) {
          const snap = rawT < 0.42 ? 0 : smooth(Math.min(1, (rawT - 0.42) / 0.26));
          this.boltMesh.position.z = THREE.MathUtils.lerp(this.boltRestPos.z + 0.068, this.boltRestPos.z, snap);
          this.boltMesh.position.y = THREE.MathUtils.lerp(this.boltRestPos.y + 0.016, this.boltRestPos.y, snap);
          this.boltMesh.rotation.z = THREE.MathUtils.lerp(0.55, 0, snap);
          if (this.boltCarrierMesh) this.boltCarrierMesh.position.z = THREE.MathUtils.lerp(this.boltCarrierRestPos.z + 0.055, this.boltCarrierRestPos.z, snap);
          moveLeftHand(
            this.boltMesh.position.x - 0.022,
            this.boltMesh.position.y + (1 - snap) * 0.048,
            this.boltMesh.position.z + 0.010,
            -0.24 + snap * 0.36, 0.14, -0.18, 'slapOpen'
          );
        }
      } else {
        const t = smooth((p - 0.90) / 0.10);
        if (this.boltMesh) { this.boltMesh.position.copy(this.boltRestPos); this.boltMesh.rotation.copy(this.boltRestRot); }
        if (this.boltCarrierMesh) this.boltCarrierMesh.position.copy(this.boltCarrierRestPos);
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
      // AK-74M (v2.53 MW2019 Rock-Out -> Rock-In -> Right-Hand Charging Handle Rack):
      // Calibrated rigid hand-to-magazine lock on the curved 5.45mm bakelite mag + authentic forward (+X) rock-out/rock-in!
      if (p > 0.13 && !this.reloadSfxFlags.magOut) {
        this.reloadSfxFlags.magOut = true;
        window.soundEngine.playMagOut(this.reloadWeaponId);
      }
      if (p > 0.56 && !this.reloadSfxFlags.magIn) {
        this.reloadSfxFlags.magIn = true;
        window.soundEngine.playMagIn(this.reloadWeaponId);
      }
      if (this.wasEmptyReload && p > 0.70 && !this.reloadSfxFlags.rack) {
        this.reloadSfxFlags.rack = true;
        window.soundEngine.playRechamber(this.reloadWeaponId || 'ak74m');
      }

      if (this.spareMagMesh) this.spareMagMesh.visible = false;

      // Exact mid-lower centerline of the curved AK bakelite mag (rotated strictly by mag.rotation.x)
      const akMagHandTarget = (mag) => {
        const mr = mag.rotation.x;
        const localY = -0.068;
        const localZ = -0.0375;
        const cosM = Math.cos(mr);
        const sinM = Math.sin(mr);
        return {
          x: mag.position.x,
          y: mag.position.y + (localY * cosM - localZ * sinM),
          z: mag.position.z + (localY * sinM + localZ * cosM),
          rx: mr * 0.85 + 0.22,
          ry: 0.0,
          rz: 0.02
        };
      };
      const blendLeftWithAkMag = (mag, blendT, styleAt = 0.25) => {
        if (!mag || !this.leftHand) return;
        const tgt = akMagHandTarget(mag);
        const k = THREE.MathUtils.clamp(blendT, 0, 1);
        this.leftHand.position.set(
          THREE.MathUtils.lerp(this.leftHandRestPos.x, tgt.x, k),
          THREE.MathUtils.lerp(this.leftHandRestPos.y, tgt.y, k),
          THREE.MathUtils.lerp(this.leftHandRestPos.z, tgt.z, k)
        );
        this.leftHand.rotation.set(
          THREE.MathUtils.lerp(this.leftHandRestRot.x, tgt.rx, k),
          THREE.MathUtils.lerp(this.leftHandRestRot.y, tgt.ry, k),
          THREE.MathUtils.lerp(this.leftHandRestRot.z, tgt.rz, k)
        );
        setLeftStyle(k >= styleAt ? 'akMagGrip' : null);
      };
      const lockLeftOnAkMag = (mag) => {
        if (!mag || !this.leftHand) return;
        // If resuming straight into Stage 1 from an interrupted reload, blend smoothly onto the rising mag
        if (this._reloadResumeBlend < 0.99) {
          blendLeftWithAkMag(mag, smooth(Math.min(1, this._reloadResumeBlend * 1.45)), 0.15);
          return;
        }
        const tgt = akMagHandTarget(mag);
        this.leftHand.position.set(tgt.x, tgt.y, tgt.z);
        this.leftHand.rotation.set(tgt.rx, tgt.ry, tgt.rz);
        setLeftStyle('akMagGrip');
      };

      if (p < 0.11) {
        // 1. Cant AK into chest workspace & reach left hand smoothly from wood handguard onto seated bakelite mag
        const t = smooth(p / 0.11);
        restRightHand();
        pos.x = -0.09 * t; pos.y = 0.10 * t; pos.z = 0.03 * t;
        rot.x = 0.18 * t; rot.y = 0.12 * t; rot.z = -0.34 * t;

        if (this.magMesh) {
          this.magMesh.visible = true;
          this.magMesh.position.copy(this.magRestPos);
          this.magMesh.rotation.copy(this.magRestRot);
          blendLeftWithAkMag(this.magMesh, t, 0.25);
        }
      } else if (p < 0.34) {
        // 2. Depress paddle release, rock bottom of mag FORWARD (+X rotation, clearing trigger guard!) & pull down-left out!
        const rawT = (p - 0.11) / 0.23;
        const rockT = smooth(THREE.MathUtils.clamp(rawT / 0.42, 0, 1));
        const pullT = smooth(THREE.MathUtils.clamp((rawT - 0.34) / 0.66, 0, 1));
        const unseatJolt = Math.sin(Math.min(1, rawT * 2.2) * Math.PI) * 0.014;
        restRightHand();
        pos.x = -0.09; pos.y = 0.10 - unseatJolt * 0.6; pos.z = 0.03;
        rot.x = 0.18 - unseatJolt * 1.4; rot.y = 0.12; rot.z = -0.34;

        if (this.magMesh) {
          this.magMesh.visible = pullT < 0.88;
          this.magMesh.position.set(
            this.magRestPos.x - pullT * 0.055,
            this.magRestPos.y - rockT * 0.014 - pullT * 0.19,
            this.magRestPos.z - rockT * 0.015 + pullT * 0.035
          );
          this.magMesh.rotation.set(rockT * 0.52 + pullT * 0.06, 0, 0);
          lockLeftOnAkMag(this.magMesh);
        }
      } else if (p < 0.64) {
        // 3. Bring fresh bakelite mag up rigidly gripped, hook front lug (+0.48 rad) & rock backward tightly into lock!
        const rawT = (p - 0.34) / 0.30;
        const upT = smooth(THREE.MathUtils.clamp(rawT / 0.52, 0, 1));
        const rockInT = smooth(THREE.MathUtils.clamp((rawT - 0.48) / 0.36, 0, 1));
        const jolt = rawT > 0.74 ? Math.sin(Math.min(1, (rawT - 0.74) / 0.20) * Math.PI) : 0;
        restRightHand();
        pos.x = -0.09; pos.y = 0.10 + jolt * 0.022; pos.z = 0.03;
        rot.x = 0.18 + jolt * 0.075; rot.y = 0.12; rot.z = -0.34;

        if (this.magMesh) {
          this.magMesh.visible = rawT > 0.04;
          this.magMesh.position.set(
            THREE.MathUtils.lerp(this.magRestPos.x - 0.055, this.magRestPos.x, upT),
            THREE.MathUtils.lerp(this.magRestPos.y - 0.19, this.magRestPos.y - 0.014, upT) + rockInT * 0.014,
            THREE.MathUtils.lerp(this.magRestPos.z + 0.020, this.magRestPos.z - 0.016, upT) + rockInT * 0.016
          );
          this.magMesh.rotation.set(THREE.MathUtils.lerp(0.54, 0.48, upT) * (1 - rockInT), 0, 0);
          if (rawT < 0.85) {
            lockLeftOnAkMag(this.magMesh);
          } else {
            const relT = smooth((rawT - 0.85) / 0.15);
            blendLeftWithAkMag(this.magMesh, 1 - relT, 0.55);
          }
        }
      } else if (this.wasEmptyReload && p < 0.90) {
        // 4. Empty reload: left hand supports handguard, rifle rolls left & right hand hooks charging handle knob cleanly!
        const rawT = (p - 0.64) / 0.26;
        const rollPose = smooth(THREE.MathUtils.clamp(rawT / 0.28, 0, 1));
        if (this.magMesh) {
          this.magMesh.visible = true;
          this.magMesh.position.copy(this.magRestPos);
          this.magMesh.rotation.copy(this.magRestRot);
        }
        restLeftHand();

        const pull = rawT > 0.22 && rawT < 0.58
          ? smooth((rawT - 0.22) / 0.36)
          : (rawT >= 0.58 && rawT < 0.78 ? 1 - smooth((rawT - 0.58) / 0.20) : 0);
        pos.x = THREE.MathUtils.lerp(-0.09, -0.05, rollPose);
        pos.y = THREE.MathUtils.lerp(0.10, 0.06, rollPose) - pull * 0.014;
        pos.z = THREE.MathUtils.lerp(0.03, 0.02, rollPose) + pull * 0.022;
        rot.x = THREE.MathUtils.lerp(0.18, 0.10, rollPose) + pull * 0.075;
        rot.y = THREE.MathUtils.lerp(0.12, 0.26, rollPose);
        rot.z = THREE.MathUtils.lerp(-0.34, 0.32, rollPose);

        if (this.boltMesh) {
          this.boltMesh.position.z = this.boltRestPos.z + pull * 0.085;
          if (this.rightHand) {
            const bx = this.boltMesh.position.x + 0.028;
            const by = this.boltMesh.position.y + 0.002;
            const bz = this.boltMesh.position.z + 0.034;
            const brx = 0.08, bry = -0.12, brz = -0.06;
            if (rawT < 0.22) {
              const appT = smooth(rawT / 0.22);
              this.rightHand.position.set(
                THREE.MathUtils.lerp(this.rightHandRestPos.x, bx, appT),
                THREE.MathUtils.lerp(this.rightHandRestPos.y, by, appT),
                THREE.MathUtils.lerp(this.rightHandRestPos.z, bz, appT)
              );
              this.rightHand.rotation.set(
                THREE.MathUtils.lerp(this.rightHandRestRot.x, brx, appT),
                THREE.MathUtils.lerp(this.rightHandRestRot.y, bry, appT),
                THREE.MathUtils.lerp(this.rightHandRestRot.z, brz, appT)
              );
              setRightStyle(appT >= 0.25 ? 'boltPinch' : null);
            } else if (rawT < 0.78) {
              // Zero-lag rigid hook on AK right-side charging handle knob throughout stroke
              this.rightHand.position.set(bx, by, bz);
              this.rightHand.rotation.set(brx, bry, brz);
              setRightStyle('boltPinch');
            } else {
              const retT = smooth((rawT - 0.78) / 0.22);
              this.rightHand.position.set(
                THREE.MathUtils.lerp(bx, this.rightHandRestPos.x, retT),
                THREE.MathUtils.lerp(by, this.rightHandRestPos.y, retT),
                THREE.MathUtils.lerp(bz, this.rightHandRestPos.z, retT)
              );
              this.rightHand.rotation.set(
                THREE.MathUtils.lerp(brx, this.rightHandRestRot.x, retT),
                THREE.MathUtils.lerp(bry, this.rightHandRestRot.y, retT),
                THREE.MathUtils.lerp(brz, this.rightHandRestRot.z, retT)
              );
              setRightStyle(retT < 0.35 ? 'boltPinch' : null);
            }
          }
        }
      } else {
        const startP = this.wasEmptyReload ? 0.90 : 0.64;
        const t = smooth(THREE.MathUtils.clamp((p - startP) / (1 - startP), 0, 1));
        if (this.magMesh) { this.magMesh.visible = true; this.magMesh.position.copy(this.magRestPos); this.magMesh.rotation.copy(this.magRestRot); }
        if (this.boltMesh) { this.boltMesh.position.copy(this.boltRestPos); }
        restLeftHand();
        restRightHand();
        pos.x = THREE.MathUtils.lerp(this.wasEmptyReload ? -0.05 : -0.09, 0, t);
        pos.y = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.06 : 0.10, 0, t);
        pos.z = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.02 : 0.03, 0, t);
        rot.x = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.10 : 0.18, 0, t);
        rot.y = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.26 : 0.12, 0, t);
        rot.z = THREE.MathUtils.lerp(this.wasEmptyReload ? 0.32 : -0.34, 0, t);
      }
      return;
    }

    if (id === 'm870') {
      // M870 MW2019+: Empty starts with combat EJECTION PORT-LOAD + pump forward, then rolls to bottom gate for remaining shells!
      const count = Math.max(1, this.reloadShellCount);
      const portWindowEnd = this.wasEmptyReload ? (count === 1 ? 0.88 : 0.44) : 0.0;
      const loadStart = this.wasEmptyReload ? 0.44 : 0.12;
      const loadEnd = 0.88;
      const hasTubeShells = !this.wasEmptyReload || count > 1;

      restRightHand();

      if (this.wasEmptyReload && p < portWindowEnd) {
        // Phase A (Empty): Pump open -> roll right -> drop 12ga shell straight into ejection port -> slam pump forward!
        const rawT = p / portWindowEnd;
        const cantIn = smooth(Math.min(1, rawT / 0.25));
        const pumpBack = rawT < 0.22
          ? smooth(rawT / 0.22)
          : (rawT < 0.72 ? 1.0 : 1.0 - smooth((rawT - 0.72) / 0.24));

        pos.x = -0.07 * cantIn; pos.y = 0.08 * cantIn;
        rot.x = 0.16 * cantIn; rot.y = -0.26 * cantIn; rot.z = 0.44 * cantIn;

        if (rawT > 0.18 && !this.reloadSfxFlags.magOut) {
          this.reloadSfxFlags.magOut = true;
          window.soundEngine.playRechamber('m870');
        }
        if (rawT > 0.48 && !this.reloadSfxFlags.magIn) {
          this.reloadSfxFlags.magIn = true;
          window.soundEngine.playMagIn('m870');
        }
        if (rawT > 0.78 && !this.reloadSfxFlags.rack) {
          this.reloadSfxFlags.rack = true;
          window.soundEngine.playRechamber('m870');
        }
        if (rawT > 0.82 && !this._portShellLoaded) {
          this._portShellLoaded = true;
          this.lastShellLoadedIdx = 0;
          if (player) player.loadSingleShell();
        }

        this._livePumpOffset = pumpBack * 0.088;
        if (this.boltMesh) this.boltMesh.position.z = this.boltRestPos.z + this._livePumpOffset;
        if (this.boltCarrierMesh) this.boltCarrierMesh.position.z = this.boltCarrierRestPos.z + this._livePumpOffset * 0.72;
        if (this.chamberRoundMesh) this.chamberRoundMesh.visible = rawT > 0.56;

        if (rawT >= 0.22 && rawT < 0.68 && this.magMesh) {
          const st = (rawT - 0.22) / 0.46;
          this.magMesh.visible = st < 0.84;
          const drop = smooth(Math.min(1, st / 0.65));
          this.magMesh.position.set(
            THREE.MathUtils.lerp(0.085, 0.012, drop),
            THREE.MathUtils.lerp(0.082, 0.010, drop),
            -0.012
          );
          this.magMesh.rotation.set(-Math.PI / 2 + THREE.MathUtils.lerp(0.15, 0.0, drop), 0, THREE.MathUtils.lerp(-0.22, 0.0, drop));
          moveLeftHand(this.magMesh.position.x + 0.024, this.magMesh.position.y + 0.018, this.magMesh.position.z + 0.018, 0.08, 0.14, 0.18, 'shellThumbStage');
        } else {
          if (this.magMesh) this.magMesh.visible = false;
          const rackStyle = this.hasVertGrip ? 'foregrip' : 'supportRifle';
          moveLeftHand(this.leftHandRestPos.x, this.leftHandRestPos.y, this.leftHandRestPos.z + this._livePumpOffset, this.leftHandRestRot.x, this.leftHandRestRot.y, this.leftHandRestRot.z, rackStyle);
        }
      } else if (hasTubeShells && p < loadEnd) {
        // Phase B: Roll cleanly left to expose bottom loading gate & drive remaining shells in with left thumb
        const tubeCount = this.wasEmptyReload ? Math.max(1, count - 1) : count;
        const enterDenom = this.wasEmptyReload ? 0.10 : loadStart;
        const enterRaw = THREE.MathUtils.clamp((p - (this.wasEmptyReload ? portWindowEnd : 0)) / enterDenom, 0, 1);
        const enterT = smooth(enterRaw);
        const fromX = this.wasEmptyReload ? -0.07 : 0, fromY = this.wasEmptyReload ? 0.08 : 0;
        const fromRx = this.wasEmptyReload ? 0.16 : 0, fromRy = this.wasEmptyReload ? -0.26 : 0, fromRz = this.wasEmptyReload ? 0.44 : 0;
        pos.x = THREE.MathUtils.lerp(fromX, -0.09, enterT);
        pos.y = THREE.MathUtils.lerp(fromY, 0.11, enterT);
        rot.x = THREE.MathUtils.lerp(fromRx, 0.24, enterT);
        rot.y = THREE.MathUtils.lerp(fromRy, 0.26, enterT);
        rot.z = THREE.MathUtils.lerp(fromRz, -0.64, enterT);
        this._livePumpOffset = 0;
        if (this.boltMesh) this.boltMesh.position.copy(this.boltRestPos);
        if (this.boltCarrierMesh) this.boltCarrierMesh.position.copy(this.boltCarrierRestPos);

        if (p >= loadStart && this.magMesh) {
          const loadProgress = (p - loadStart) / (loadEnd - loadStart);
          const shellFloat = loadProgress * tubeCount;
          const localIdx = Math.min(tubeCount - 1, Math.floor(shellFloat));
          const globalIdx = this.wasEmptyReload ? (localIdx + 1) : localIdx;
          const shellT = shellFloat - localIdx;

          if (shellT > 0.46 && globalIdx > this.lastShellSoundIdx) {
            this.lastShellSoundIdx = globalIdx;
            window.soundEngine.playMagIn(this.reloadWeaponId);
          }
          if (shellT > 0.72 && globalIdx > this.lastShellLoadedIdx) {
            this.lastShellLoadedIdx = globalIdx;
            if (player) player.loadSingleShell();
          }

          const clickPulse = (shellT > 0.54 && shellT < 0.76) ? Math.sin(((shellT - 0.54) / 0.22) * Math.PI) : 0;
          pos.y += clickPulse * 0.006;
          pos.z -= clickPulse * 0.007;
          rot.x += clickPulse * 0.020;

          this.magMesh.visible = shellT < 0.78;
          if (shellT < 0.32) {
            const alignT = smooth(shellT / 0.32);
            this.magMesh.position.x = THREE.MathUtils.lerp(-0.032, 0.0, alignT);
            this.magMesh.position.y = THREE.MathUtils.lerp(-0.118, -0.042, alignT);
            this.magMesh.position.z = THREE.MathUtils.lerp(0.055, -0.008, alignT);
            this.magMesh.rotation.x = this.magRestRot.x + THREE.MathUtils.lerp(0.50, 0.34, alignT);
            moveLeftHand(this.magMesh.position.x - 0.014, this.magMesh.position.y - 0.018, this.magMesh.position.z + 0.040, 0.12, 0.08, -0.08, 'shellThumbStage');
          } else if (shellT < 0.78) {
            const pushT = smooth(THREE.MathUtils.clamp((shellT - 0.32) / 0.46, 0, 1));
            const levelT = Math.min(1, pushT * 1.6);
            this.magMesh.position.x = 0.0;
            this.magMesh.position.y = THREE.MathUtils.lerp(-0.042, -0.022, levelT);
            this.magMesh.position.z = THREE.MathUtils.lerp(-0.008, -0.068, pushT);
            this.magMesh.rotation.x = THREE.MathUtils.lerp(this.magRestRot.x + 0.34, this.magRestRot.x, levelT);
            moveLeftHand(
              THREE.MathUtils.lerp(-0.014, -0.010, pushT),
              THREE.MathUtils.lerp(-0.056, -0.040, pushT),
              THREE.MathUtils.lerp(0.036, -0.014, pushT),
              THREE.MathUtils.lerp(0.12, 0.38, pushT),
              THREE.MathUtils.lerp(0.08, 0.04, pushT),
              THREE.MathUtils.lerp(-0.08, 0.14, pushT),
              pushT > 0.18 ? 'shellThumbPush' : 'shellThumbStage'
            );
          } else {
            const exitS = smooth((shellT - 0.78) / 0.22);
            moveLeftHand(
              THREE.MathUtils.lerp(-0.010, -0.028, exitS),
              THREE.MathUtils.lerp(-0.040, -0.090, exitS),
              THREE.MathUtils.lerp(-0.014, 0.040, exitS),
              THREE.MathUtils.lerp(0.38, 0.14, exitS),
              0.08,
              THREE.MathUtils.lerp(0.14, -0.08, exitS),
              'shellThumbStage'
            );
          }
        } else {
          if (this.magMesh) this.magMesh.visible = false;
          restLeftHand();
        }
      } else {
        const startP = loadEnd;
        const t = smooth(THREE.MathUtils.clamp((p - startP) / (1 - startP), 0, 1));
        if (this.magMesh) this.magMesh.visible = false;
        if (this.boltMesh) this.boltMesh.position.copy(this.boltRestPos);
        if (this.boltCarrierMesh) this.boltCarrierMesh.position.copy(this.boltCarrierRestPos);
        this._livePumpOffset = 0;
        restLeftHand();
        const peakX = (this.wasEmptyReload && count === 1) ? -0.07 : -0.09;
        const peakY = (this.wasEmptyReload && count === 1) ? 0.08 : 0.11;
        const peakRx = (this.wasEmptyReload && count === 1) ? 0.16 : 0.24;
        const peakRy = (this.wasEmptyReload && count === 1) ? -0.26 : 0.26;
        const peakRz = (this.wasEmptyReload && count === 1) ? 0.44 : -0.64;
        pos.x = THREE.MathUtils.lerp(peakX, 0, t);
        pos.y = THREE.MathUtils.lerp(peakY, 0, t);
        rot.x = THREE.MathUtils.lerp(peakRx, 0, t);
        rot.y = THREE.MathUtils.lerp(peakRy, 0, t);
        rot.z = THREE.MathUtils.lerp(peakRz, 0, t);
      }
      return;
    }

    if (id === 'mosin9130') {
      // M91/30 Mosin-Nagant: Open Bolt -> Insert 5-Round Brass Stripper Clip From Top -> Press Rounds Down -> Flick Clip -> Close Bolt!
      if (p > 0.06 && !this.reloadSfxFlags.magOut) {
        this.reloadSfxFlags.magOut = true;
        window.soundEngine.playRechamber(this.reloadWeaponId || 'mosin9130');
      }
      if (p > 0.44 && !this.reloadSfxFlags.magIn) {
        this.reloadSfxFlags.magIn = true;
        window.soundEngine.playMagIn(this.reloadWeaponId);
      }
      if (p > 0.72 && !this.reloadSfxFlags.rack) {
        this.reloadSfxFlags.rack = true;
        window.soundEngine.playRechamber(this.reloadWeaponId || 'mosin9130');
      }

      if (p < 0.22) {
        // Phase 1: Lift & pull straight bolt all the way back to expose top receiver bridge
        const rawT = p / 0.22;
        const lift = smooth(Math.min(1, rawT / 0.45));
        const pull = rawT > 0.40 ? smooth((rawT - 0.40) / 0.60) : 0;
        restLeftHand();
        pos.x = -0.06 * lift; pos.y = 0.05 * lift;
        rot.x = 0.14 * lift; rot.y = 0.24 * lift; rot.z = 0.22 * lift;
        if (this.magMesh) this.magMesh.visible = false;
        if (this.boltMesh) {
          this.boltMesh.rotation.z = lift * 0.80;
          this.boltMesh.position.z = this.boltRestPos.z + pull * 0.095;
          moveRightHand(this.boltMesh.position.x + 0.020, this.boltMesh.position.y + lift * 0.020, this.boltMesh.position.z + 0.022, 0.14 + lift * 0.34, -0.20, -0.20, 'boltPinch');
        }
      } else if (p < 0.46) {
        // Phase 2: Bring 5-round brass stripper clip down from above into receiver guide slot
        const t = smooth((p - 0.22) / 0.24);
        restLeftHand();
        pos.x = -0.06; pos.y = 0.05;
        rot.x = 0.16; rot.y = 0.28; rot.z = 0.26;
        if (this.boltMesh) {
          this.boltMesh.rotation.z = 0.80;
          this.boltMesh.position.z = this.boltRestPos.z + 0.095;
        }
        if (this.magMesh) {
          this.magMesh.visible = true;
          this.magMesh.position.set(
            THREE.MathUtils.lerp(0.11, 0.0, t),
            THREE.MathUtils.lerp(0.16, 0.058, t),
            this.magRestPos.z
          );
          this.magMesh.rotation.set(0, 0, THREE.MathUtils.lerp(-0.25, 0, t));
          moveRightHand(this.magMesh.position.x + 0.020, this.magMesh.position.y + 0.022, this.magMesh.position.z + 0.018, -0.28, -0.16, -0.16, 'boltPinch');
        }
      } else if (p < 0.68) {
        // Phase 3: Thumb presses all 5 cartridges down into internal magazine, then clip flicks off
        const rawT = (p - 0.46) / 0.22;
        const press = smooth(Math.min(1, rawT / 0.72));
        const jolt = rawT > 0.65 && rawT < 0.85 ? Math.sin(((rawT - 0.65) / 0.20) * Math.PI) : 0;
        restLeftHand();
        pos.x = -0.06; pos.y = 0.05 - jolt * 0.014;
        rot.x = 0.16 - jolt * 0.04; rot.y = 0.28; rot.z = 0.26;
        if (this.boltMesh) {
          this.boltMesh.rotation.z = 0.80;
          this.boltMesh.position.z = this.boltRestPos.z + 0.095;
        }
        if (this.magMesh) {
          this.magMesh.visible = rawT < 0.82;
          this.magMesh.position.set(0, THREE.MathUtils.lerp(0.058, 0.012, press), this.magRestPos.z);
          moveRightHand(0.018, THREE.MathUtils.lerp(0.082, 0.036, press), this.magRestPos.z + 0.018, -0.34 - press * 0.24, -0.16, -0.18, 'boltPinch');
        }
      } else if (p < 0.88) {
        // Phase 4: Push bolt forward & lock handle down to chamber top round
        const rawT = (p - 0.68) / 0.20;
        const push = smooth(Math.min(1, rawT / 0.62));
        const lock = rawT > 0.62 ? smooth((rawT - 0.62) / 0.38) : 0;
        restLeftHand();
        pos.x = THREE.MathUtils.lerp(-0.06, -0.03, rawT);
        pos.y = THREE.MathUtils.lerp(0.05, 0.02, rawT);
        rot.x = THREE.MathUtils.lerp(0.16, 0.06, rawT);
        rot.y = THREE.MathUtils.lerp(0.28, 0.14, rawT);
        rot.z = THREE.MathUtils.lerp(0.26, 0.12, rawT);
        if (this.magMesh) this.magMesh.visible = false;
        if (this.boltMesh) {
          this.boltMesh.rotation.z = (1 - lock) * 0.80;
          this.boltMesh.position.z = this.boltRestPos.z + (1 - push) * 0.095;
          moveRightHand(this.boltMesh.position.x + 0.020, this.boltMesh.position.y + (1 - lock) * 0.020, this.boltMesh.position.z + 0.022, 0.14 + (1 - lock) * 0.34, -0.20, -0.20, 'boltPinch');
        }
      } else {
        const t = smooth((p - 0.88) / 0.12);
        if (this.magMesh) this.magMesh.visible = false;
        if (this.boltMesh) { this.boltMesh.position.copy(this.boltRestPos); this.boltMesh.rotation.copy(this.boltRestRot); }
        restLeftHand();
        restRightHand();
        pos.x = THREE.MathUtils.lerp(-0.03, 0, t);
        pos.y = THREE.MathUtils.lerp(0.02, 0, t);
        rot.x = THREE.MathUtils.lerp(0.06, 0, t);
        rot.y = THREE.MathUtils.lerp(0.14, 0, t);
        rot.z = THREE.MathUtils.lerp(0.12, 0, t);
      }
      return;
    }

    if (id === 'm24' || id === 'awm338') {
      // M24 Marksman: Straight-axis box mag (Left Hand) + Right-Handed Bolt Lift, Pull, Push & Lock (Right Hand)
      if (p > 0.08 && !this.reloadSfxFlags.magOut) {
        this.reloadSfxFlags.magOut = true;
        window.soundEngine.playMagOut(this.reloadWeaponId);
      }
      if (p > 0.52 && !this.reloadSfxFlags.magIn) {
        this.reloadSfxFlags.magIn = true;
        window.soundEngine.playMagIn(this.reloadWeaponId);
      }
      if (this.wasEmptyReload && p > 0.64 && !this.reloadSfxFlags.rack) {
        this.reloadSfxFlags.rack = true;
        window.soundEngine.playRechamber(this.reloadWeaponId || (weaponDef && weaponDef.id) || 'ak74m');
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
          moveRightHand(this.boltMesh.position.x + 0.018, this.boltMesh.position.y + lift * 0.022, this.boltMesh.position.z + 0.018, 0.16 + lift * 0.36, -0.24, -0.20, 'boltPinch');
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
      window.soundEngine.playMagOut(this.reloadWeaponId);
    }
    if (p > 0.54 && !this.reloadSfxFlags.magIn) {
      this.reloadSfxFlags.magIn = true;
      window.soundEngine.playMagIn(this.reloadWeaponId);
    }
    if (this.wasEmptyReload && p > 0.64 && !this.reloadSfxFlags.rack) {
      this.reloadSfxFlags.rack = true;
      window.soundEngine.playRechamber(this.reloadWeaponId || 'g17');
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
        handOnMag(0.03, 'magGrip');
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
        handOnMag(0.03, 'magGrip');
      }
    } else if (this.wasEmptyReload && p < 0.90) {
      const rawT = (p - 0.58) / 0.32;
      const t = smooth(rawT);
      if (this.magMesh) { this.magMesh.visible = true; this.magMesh.position.copy(this.magRestPos); }

      if (isG17) {
        // Glock 17 Gen4: Left-thumb slide-stop release!
        const reach = smooth(Math.min(1, rawT / 0.34));
        const snap = rawT < 0.42 ? 0 : smooth(Math.min(1, (rawT - 0.42) / 0.18));
        const dip = (rawT >= 0.42 && rawT < 0.72) ? Math.sin(((rawT - 0.42) / 0.30) * Math.PI) : 0;
        pos.x = THREE.MathUtils.lerp(-0.14, -0.07, t);
        pos.y = THREE.MathUtils.lerp(0.13, 0.05, t) - dip * 0.012;
        pos.z = THREE.MathUtils.lerp(-0.04, -0.01, t) - dip * 0.010;
        rot.x = THREE.MathUtils.lerp(0.42, 0.08, t) - dip * 0.085;
        rot.y = THREE.MathUtils.lerp(0.48, -0.14, reach);
        rot.z = THREE.MathUtils.lerp(-0.62, 0.16, reach);
        if (this.boltMesh) {
          this.boltMesh.position.z = this.boltRestPos.z + THREE.MathUtils.lerp(0.052, 0.0, snap);
        }
        if (rawT < 0.72) {
          moveLeftHand(-0.022, -0.008 - dip * 0.006, 0.036, 0.06, 0.18, 0.08, 'leftBoltPinch');
        } else {
          restLeftHand();
        }
      } else {
        // PM-9 Makarov: Overhand rear-serration slingshot rack
        const rackPose = Math.sin(Math.min(1, rawT * 1.15) * Math.PI * 0.5);
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
        rot.x = THREE.MathUtils.lerp(0.34, 0.14, t) + nudge * 0.04;
        rot.y = THREE.MathUtils.lerp(0.38, -0.34, rackPose);
        rot.z = THREE.MathUtils.lerp(-0.48, 0.36, rackPose);

        if (this.boltMesh) {
          this.boltMesh.position.z = this.boltRestPos.z + slideOffset;
          moveLeftHand(this.boltMesh.position.x - 0.020, this.boltMesh.position.y + 0.012, this.boltMesh.position.z + 0.018, -0.18, 0.22, 0.12, 'slideGrab');
        }
      }
    } else {
      const startP = this.wasEmptyReload ? 0.90 : 0.58;
      const t = smooth(THREE.MathUtils.clamp((p - startP) / (1 - startP), 0, 1));
      if (this.magMesh) { this.magMesh.visible = true; this.magMesh.position.copy(this.magRestPos); }
      if (this.boltMesh) { this.boltMesh.position.copy(this.boltRestPos); }
      restLeftHand();
      const fromX = this.wasEmptyReload ? (isG17 ? -0.07 : -0.10) : -0.14;
      const fromY = this.wasEmptyReload ? (isG17 ? 0.05 : 0.08) : 0.13;
      const fromZ = this.wasEmptyReload ? (isG17 ? -0.01 : -0.02) : -0.04;
      const fromRx = this.wasEmptyReload ? (isG17 ? 0.08 : 0.14) : (isG17 ? 0.42 : 0.34);
      const fromRy = this.wasEmptyReload ? (isG17 ? -0.14 : -0.34) : (isG17 ? 0.48 : 0.38);
      const fromRz = this.wasEmptyReload ? (isG17 ? 0.16 : 0.36) : (isG17 ? -0.62 : -0.48);
      pos.x = THREE.MathUtils.lerp(fromX, 0, t);
      pos.y = THREE.MathUtils.lerp(fromY, 0, t);
      pos.z = THREE.MathUtils.lerp(fromZ, 0, t);
      rot.x = THREE.MathUtils.lerp(fromRx, 0, t);
      rot.y = THREE.MathUtils.lerp(fromRy, 0, t);
      rot.z = THREE.MathUtils.lerp(fromRz, 0, t);
    }
  }

  _resetReloadParts() {
    if (this.magMesh) {
      this.magMesh.visible = !(this.magMesh.userData && this.magMesh.userData.isStripperClip);
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
    if (this.boltCarrierMesh) {
      this.boltCarrierMesh.position.copy(this.boltCarrierRestPos);
    }
    if (this.chamberRoundMesh) {
      this.chamberRoundMesh.visible = true;
    }
    if (this.leftHand) {
      this.leftHand.position.copy(this.leftHandRestPos);
      this.leftHand.rotation.copy(this.leftHandRestRot);
      if (this.leftHand.userData) {
        this.leftHand.userData.activeStyle = null;
        if (this.leftHand.userData.thumbGroup) {
          this.leftHand.userData.thumbGroup.rotation.set(0, 0, 0);
        }
      }
    }
    if (this.rightHand) {
      this.rightHand.position.copy(this.rightHandRestPos);
      this.rightHand.rotation.copy(this.rightHandRestRot);
      if (this.rightHand.userData) this.rightHand.userData.activeStyle = null;
    }
  }

  _computeInspectPose(p, dt, pos, rot, player = null) {
    const smoother = (t) => {
      const c = THREE.MathUtils.clamp(t, 0, 1);
      return c * c * c * (c * (c * 6 - 15) + 10);
    };
    const id = this.inspectWeaponId;
    const handRate = Math.min(1, dt * 13);
    const slotObj = (player && player.getActiveWeaponSlot) ? player.getActiveWeaponSlot() : null;
    const hasAmmo = !slotObj || (slotObj.mag || 0) > 0;
    if (this.chamberRoundMesh) this.chamberRoundMesh.visible = hasAmmo;

    const moveLeftHand = (x, y, z, rx = null, ry = null, rz = null, styleName = null) => {
      if (!this.leftHand) return;
      this.leftHand.position.lerp(new THREE.Vector3(x, y, z), handRate);
      if (rx !== null) {
        this.leftHand.rotation.x = THREE.MathUtils.lerp(this.leftHand.rotation.x, rx, handRate);
        this.leftHand.rotation.y = THREE.MathUtils.lerp(this.leftHand.rotation.y, ry || 0, handRate);
        this.leftHand.rotation.z = THREE.MathUtils.lerp(this.leftHand.rotation.z, rz || 0, handRate);
      }
      if (styleName && this.leftHand.userData) this.leftHand.userData.activeStyle = styleName;
    };
    const moveRightHand = (x, y, z, rx = null, ry = null, rz = null, styleName = null) => {
      if (!this.rightHand) return;
      this.rightHand.position.lerp(new THREE.Vector3(x, y, z), handRate);
      if (rx !== null) {
        this.rightHand.rotation.x = THREE.MathUtils.lerp(this.rightHand.rotation.x, rx, handRate);
        this.rightHand.rotation.y = THREE.MathUtils.lerp(this.rightHand.rotation.y, ry || 0, handRate);
        this.rightHand.rotation.z = THREE.MathUtils.lerp(this.rightHand.rotation.z, rz || 0, handRate);
      }
      if (styleName && this.rightHand.userData) this.rightHand.userData.activeStyle = styleName;
    };
    const restHands = () => {
      if (this.leftHand) {
        this.leftHand.position.lerp(this.leftHandRestPos, handRate);
        this.leftHand.rotation.x = THREE.MathUtils.lerp(this.leftHand.rotation.x, this.leftHandRestRot.x, handRate);
        this.leftHand.rotation.y = THREE.MathUtils.lerp(this.leftHand.rotation.y, this.leftHandRestRot.y, handRate);
        this.leftHand.rotation.z = THREE.MathUtils.lerp(this.leftHand.rotation.z, this.leftHandRestRot.z, handRate);
        if (this.leftHand.userData) this.leftHand.userData.activeStyle = null;
      }
      if (this.rightHand) {
        this.rightHand.position.lerp(this.rightHandRestPos, handRate);
        this.rightHand.rotation.x = THREE.MathUtils.lerp(this.rightHand.rotation.x, this.rightHandRestRot.x, handRate);
        this.rightHand.rotation.y = THREE.MathUtils.lerp(this.rightHand.rotation.y, this.rightHandRestRot.y, handRate);
        this.rightHand.rotation.z = THREE.MathUtils.lerp(this.rightHand.rotation.z, this.rightHandRestRot.z, handRate);
        if (this.rightHand.userData) this.rightHand.userData.activeStyle = null;
      }
    };

    // MW2019+ 4-Act Inspect Envelope (4.8s):
    // Act 1 (0.00..0.28): Raise & admire left profile
    // Act 2 (0.28..0.56): Live Press-Check (crack open breech to verify chambered brass round!)
    // Act 3 (0.56..0.84): Wrist roll to admire opposite side & optics
    // Act 4 (0.84..1.00): Damped return to combat ready
    const enter = p < 0.16 ? smoother(p / 0.16) : (p > 0.84 ? 1 - smoother((p - 0.84) / 0.16) : 1);
    const flip = p < 0.54 ? 0 : (p < 0.70 ? smoother((p - 0.54) / 0.16) : (p > 0.84 ? 1 - smoother((p - 0.84) / 0.16) : 1));
    const checkRaw = (p >= 0.28 && p <= 0.54) ? Math.pow(Math.sin(((p - 0.28) / 0.26) * Math.PI), 1.25) : 0;
    const drift = Math.sin(p * Math.PI * 2.0) * 0.010 * enter;
    const tiltDrift = Math.sin(p * Math.PI * 3.0) * 0.036 * enter;

    if (p > 0.30 && !this._inspectCheckSfxPlayed) {
      this._inspectCheckSfxPlayed = true;
      if (window.soundEngine && window.soundEngine.playClick) {
        try { window.soundEngine.playClick(); } catch (e) {}
      }
    }
    if (p > 0.50 && !this._inspectSnapSfxPlayed) {
      this._inspectSnapSfxPlayed = true;
      if (window.soundEngine && window.soundEngine.playRechamber) {
        try { window.soundEngine.playRechamber(id); } catch (e) {}
      }
      this.addWeaponImpulse(0.004, -0.008, -0.010, -0.032, 0, 0.028);
    }

    if (id === 'pm9' || id === 'g17') {
      const isG17 = id === 'g17';
      pos.x = ((isG17 ? -0.15 : -0.14) + drift) * enter;
      pos.y = ((isG17 ? 0.11 : 0.10) + drift * 0.5) * enter;
      pos.z = -0.025 * enter;
      rot.x = (THREE.MathUtils.lerp(0.20, 0.16, flip) + tiltDrift) * enter;
      rot.y = THREE.MathUtils.lerp(-0.56, 0.54, flip) * enter;
      rot.z = THREE.MathUtils.lerp(isG17 ? 0.64 : 0.58, -0.58, flip) * enter;

      if (this.boltMesh) {
        this.boltMesh.position.z = this.boltRestPos.z + checkRaw * 0.028;
      }
      if (isG17 && this.magMesh) {
        const magCheck = (p >= 0.60 && p <= 0.82) ? Math.pow(Math.sin(((p - 0.60) / 0.22) * Math.PI), 1.3) : 0;
        const alongMag = new THREE.Vector3(0, -1, 0).applyEuler(this.magRestRot).normalize();
        this.magMesh.position.copy(this.magRestPos).addScaledVector(alongMag, magCheck * 0.052);
        if (p >= 0.58 && p <= 0.83) {
          const t = this.magMesh.position.clone().addScaledVector(alongMag, 0.03);
          moveLeftHand(t.x - 0.01, t.y, t.z, 0.18, 0.14, 0.08, 'magGrip');
          return;
        }
      }
      if (p >= 0.25 && p <= 0.56 && this.boltMesh) {
        moveLeftHand(this.boltMesh.position.x - 0.022, this.boltMesh.position.y + 0.010, this.boltMesh.position.z + 0.010, -0.14, 0.20, 0.10, 'slideGrab');
      } else {
        restHands();
      }
      return;
    }

    if (id === 'mp5k') {
      pos.x = (-0.12 + drift) * enter;
      pos.y = (0.095 + drift * 0.5) * enter;
      pos.z = -0.015 * enter;
      rot.x = (THREE.MathUtils.lerp(0.16, 0.22, flip) + tiltDrift) * enter;
      rot.y = THREE.MathUtils.lerp(-0.58, 0.48, flip) * enter;
      rot.z = THREE.MathUtils.lerp(0.50, -0.44, flip) * enter;
      if (this.boltMesh) {
        this.boltMesh.position.z = this.boltRestPos.z + checkRaw * 0.042;
        if (this.boltCarrierMesh) this.boltCarrierMesh.position.z = this.boltCarrierRestPos.z + checkRaw * 0.038;
        if (p >= 0.25 && p <= 0.56) {
          moveLeftHand(this.boltMesh.position.x - 0.018, this.boltMesh.position.y, this.boltMesh.position.z + 0.016, 0.12, 0.18, 0.15, 'leftBoltPinch');
        } else {
          restHands();
        }
      } else {
        restHands();
      }
      return;
    }

    if (id === 'ak74m') {
      pos.x = (-0.12 + drift) * enter;
      pos.y = (0.095 + drift * 0.5) * enter;
      pos.z = 0.02 * enter;
      rot.x = (THREE.MathUtils.lerp(0.18, 0.14, flip) + tiltDrift) * enter;
      rot.y = THREE.MathUtils.lerp(0.46, -0.60, flip) * enter;
      rot.z = THREE.MathUtils.lerp(-0.48, 0.52, flip) * enter;
      if (this.boltMesh) {
        this.boltMesh.position.z = this.boltRestPos.z + checkRaw * 0.046;
        if (p >= 0.25 && p <= 0.56) {
          moveRightHand(this.boltMesh.position.x + 0.026, this.boltMesh.position.y - 0.004, this.boltMesh.position.z + 0.028, 0.08, -0.14, -0.06, 'boltPinch');
        } else {
          restHands();
        }
      } else {
        restHands();
      }
      return;
    }

    if (id === 'm870') {
      pos.x = (-0.12 + drift) * enter;
      pos.y = (0.09 + drift * 0.5) * enter;
      pos.z = 0.02 * enter;
      rot.x = (THREE.MathUtils.lerp(0.16, 0.20, flip) + tiltDrift) * enter;
      rot.y = THREE.MathUtils.lerp(0.38, -0.58, flip) * enter;
      rot.z = THREE.MathUtils.lerp(-0.56, 0.48, flip) * enter;
      if (this.boltMesh) {
        this.boltMesh.position.z = this.boltRestPos.z + checkRaw * 0.052;
        if (this.boltCarrierMesh) this.boltCarrierMesh.position.z = this.boltCarrierRestPos.z + checkRaw * 0.040;
        if (p >= 0.25 && p <= 0.56) {
          moveLeftHand(this.leftHandRestPos.x, this.leftHandRestPos.y, this.leftHandRestPos.z + checkRaw * 0.052);
        } else {
          restHands();
        }
      } else {
        restHands();
      }
      return;
    }

    // M24, Mosin 91/30 & AWM .338 Bolt-Action Rifles
    pos.x = (-0.11 + drift) * enter;
    pos.y = (0.085 + drift * 0.5) * enter;
    pos.z = 0.02 * enter;
    rot.x = (THREE.MathUtils.lerp(0.14, 0.11, flip) + tiltDrift) * enter;
    rot.y = THREE.MathUtils.lerp(0.38, -0.54, flip) * enter;
    rot.z = THREE.MathUtils.lerp(-0.34, 0.44, flip) * enter;
    if (this.boltMesh) {
      const lift = (p >= 0.26 && p <= 0.56) ? Math.sin(Math.min(1, (p - 0.26) / 0.30) * Math.PI) : 0;
      this.boltMesh.rotation.z = lift * 0.65;
      this.boltMesh.position.z = this.boltRestPos.z + checkRaw * 0.042;
      if (p >= 0.25 && p <= 0.56) {
        moveRightHand(this.boltMesh.position.x + 0.020, this.boltMesh.position.y + lift * 0.022, this.boltMesh.position.z + 0.020, 0.16 + lift * 0.32, -0.22, -0.18, 'boltPinch');
      } else {
        restHands();
      }
    } else {
      restHands();
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

    // Lower & cant weapon aside while keeping the plating hand & forearm anchored low across the bottom of the screen
    const env = p < 0.09 ? smooth(p / 0.09) : (p > 0.91 ? 1 - smooth((p - 0.91) / 0.09) : 1);
    pos.x = 0.18 * env;
    pos.y = -0.15 * env;
    pos.z = 0.05 * env;
    rot.x = -0.28 * env;
    rot.y = -0.34 * env;
    rot.z = -0.24 * env;

    if (this.leftHand) this.leftHand.visible = false;
    if (this.leftArm) this.leftArm.visible = false;
    if (this.plateRig) this.plateRig.visible = true;

    let handTarget = new THREE.Vector3(0.10, -0.168, -0.24);
    let handRotTarget = new THREE.Euler(-0.22, -0.18, -0.44);
    let plateStyle = 'plate';

    if (p < grabOpenEnd) {
      // === STEP 1: SWEEP LOW ACROSS BOTTOM OF SCREEN TO LOWER-RIGHT ZIPPER ===
      const t = smooth(p / grabOpenEnd);
      plateStyle = 'leftBoltPinch';
      if (this.plateMesh) this.plateMesh.visible = false;
      handTarget.set(
        THREE.MathUtils.lerp(-0.18, 0.10, t),
        THREE.MathUtils.lerp(-0.205, -0.168, t),
        -0.24
      );
      handRotTarget.set(-0.22, -0.18, -0.44);
    } else if (p < unzipEnd) {
      // === STEP 2: UNZIP RIGHT-TO-LEFT LOW ACROSS BOTTOM OF SCREEN ===
      const rawT = (p - grabOpenEnd) / (unzipEnd - grabOpenEnd);
      const pullT = smooth(Math.min(1, rawT / 0.82)); // 0.82..1.00 is a brief hold/beat after unzip
      plateStyle = 'leftBoltPinch';
      if (rawT > 0.04 && !this.plateZipFlags.open) {
        this.plateZipFlags.open = true;
        window.soundEngine.playZipper(false);
      }
      if (this.plateMesh) this.plateMesh.visible = false;
      handTarget.set(
        THREE.MathUtils.lerp(0.10, -0.15, pullT),
        -0.168 + Math.sin(pullT * Math.PI) * 0.008,
        -0.24
      );
      handRotTarget.set(-0.22, -0.18 + pullT * 0.34, -0.44 + pullT * 0.10);
    } else if (p < zipStart) {
      // === STEP 3: LOW BOTTOM-OF-SCREEN PLATE SWEEP -> POUCH LIP -> TUCK DOWN INTO CARRIER ===
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
        this.addWeaponImpulse(0, -0.032, 0.012, -0.085, 0, -0.045);
      }

      // Tactile Warzone/DMZ body thud as SAPI ceramic plate slams home into carrier
      const thud = (pt > 0.76 && pt < 0.90) ? Math.sin(((pt - 0.76) / 0.14) * Math.PI) : 0;
      pos.y -= thud * 0.024;
      rot.x -= thud * 0.062;

      if (this.plateMesh) {
        if (pt < 0.14) {
          // Beat A: Dip hand at bottom-left edge & square wrist upright to pinch fresh plate by its top rim
          this.plateMesh.visible = false;
          handTarget.set(-0.18, -0.175, -0.25);
          handRotTarget.set(-0.08, 0.0, 0.0);
        } else if (pt < 0.44) {
          // Beat B: Sweep hand + dead-upright plate (held squarely by the top rim!) low across bottom of screen to pouch lip
          const t = smooth((pt - 0.14) / 0.30);
          this.plateMesh.visible = true;
          handTarget.set(
            THREE.MathUtils.lerp(-0.18, 0.0, t),
            THREE.MathUtils.lerp(-0.145, -0.088, t),
            THREE.MathUtils.lerp(-0.255, -0.245, t)
          );
          handRotTarget.set(-0.08, 0.0, 0.0);
        } else if (pt < 0.54) {
          // Beat C: Brief upright alignment beat at the carrier pouch lip along bottom of screen
          this.plateMesh.visible = true;
          handTarget.set(0.0, -0.088, -0.245);
          handRotTarget.set(-0.08, 0.0, 0.0);
        } else if (pt < 0.86) {
          // Beat D: Two-stage vertical push straight down into the carrier (zero sideways angle!)
          const raw = (pt - 0.54) / 0.32;
          let slideT;
          if (raw < 0.45) {
            slideT = smooth(raw / 0.45) * 0.44;
          } else if (raw < 0.60) {
            slideT = 0.44 + ((raw - 0.45) / 0.15) * 0.04;
          } else {
            slideT = 0.48 + smooth((raw - 0.60) / 0.40) * 0.52;
          }
          this.plateMesh.visible = slideT < 0.96;
          handTarget.set(
            0.0,
            THREE.MathUtils.lerp(-0.088, -0.205, slideT),
            THREE.MathUtils.lerp(-0.245, -0.275, slideT)
          );
          handRotTarget.set(-0.08 - slideT * 0.08, 0.0, 0.0);
        } else {
          // Beat E: Brief low settle pause before next plate or zipping up
          this.plateMesh.visible = false;
          handTarget.set(-0.06, -0.195, -0.24);
          handRotTarget.set(-0.22, 0.08, -0.28);
        }
      }
    } else if (p < grabCloseEnd) {
      // === STEP 4A: CATCH LOWER-LEFT ZIPPER PULL ALONG BOTTOM EDGE ===
      const t = smooth((p - zipStart) / (grabCloseEnd - zipStart));
      plateStyle = 'leftBoltPinch';
      if (this.plateMesh) this.plateMesh.visible = false;
      handTarget.set(
        THREE.MathUtils.lerp(-0.06, -0.15, t),
        THREE.MathUtils.lerp(-0.195, -0.168, t),
        -0.24
      );
      handRotTarget.set(-0.22, 0.16, -0.34);
    } else if (p < zipEnd) {
      // === STEP 4B: ZIP LEFT-TO-RIGHT LOW ACROSS BOTTOM OF SCREEN ===
      const zipT = smooth((p - grabCloseEnd) / (zipEnd - grabCloseEnd));
      plateStyle = 'leftBoltPinch';
      if (zipT > 0.04 && !this.plateZipFlags.close) {
        this.plateZipFlags.close = true;
        window.soundEngine.playZipper(true);
      }
      if (this.plateMesh) this.plateMesh.visible = false;
      handTarget.set(
        THREE.MathUtils.lerp(-0.15, 0.10, zipT),
        -0.168 + Math.sin(zipT * Math.PI) * 0.008,
        -0.24
      );
      handRotTarget.set(-0.22, 0.16 - zipT * 0.34, -0.34 - zipT * 0.10);
    } else {
      // === STEP 5: DROP HAND BELOW SCREEN & RETURN TO WEAPON ===
      const exitT = smooth((p - zipEnd) / (1 - zipEnd));
      plateStyle = 'leftBoltPinch';
      if (this.plateMesh) this.plateMesh.visible = false;
      handTarget.set(
        THREE.MathUtils.lerp(0.10, -0.04, exitT),
        THREE.MathUtils.lerp(-0.168, -0.26, exitT),
        -0.24
      );
      handRotTarget.set(-0.24, -0.18, -0.40);
    }

    if (this.plateHand && this.plateArm) {
      if (this.plateHand.userData) this.plateHand.userData.activeStyle = plateStyle;
      this.plateHand.position.lerp(handTarget, handRate);
      this.plateHand.rotation.x = THREE.MathUtils.lerp(this.plateHand.rotation.x, handRotTarget.x, handRate);
      if (this.plateMesh && this.plateMesh.visible) {
        // Lock yaw & roll strictly to 0 while holding the ceramic plate so it is ALWAYS held upright by the top rim!
        this.plateHand.rotation.y = 0;
        this.plateHand.rotation.z = 0;
      } else {
        this.plateHand.rotation.y = THREE.MathUtils.lerp(this.plateHand.rotation.y, handRotTarget.y, handRate);
        this.plateHand.rotation.z = THREE.MathUtils.lerp(this.plateHand.rotation.z, handRotTarget.z, handRate);
      }
      const lShoulder = new THREE.Vector3(-0.30, -0.30, 0.08);
      const lWrist = this.plateHand.position.clone().add(new THREE.Vector3(-0.012, -0.004, 0.036));
      this._currentAimHand = this.plateHand;
      this._aimArm(this.plateArm, lShoulder, lWrist);
    }
  }

  _endPlatingVisuals() {
    if (this.plateRig) this.plateRig.visible = false;
    if (this.plateMesh) this.plateMesh.visible = false;
    if (this.plateHand && this.plateHand.userData) this.plateHand.userData.activeStyle = null;
    if (this.leftHand) this.leftHand.visible = true;
    if (this.leftArm) this.leftArm.visible = true;
  }

  startPlating(platesToInsert = 1) {
    if (this.isPlating || this.isHealing) return false;
    // Interrupt active reload while preserving its staged checkpoint (e.g. mag already removed!)
    if (this.isReloading) this.cancelReload();
    this.cancelInspect();
    this.isPlating = true;
    this.platesToInsert = Math.max(1, platesToInsert);
    this.plateDuration = 1.65 + this.platesToInsert * 1.45;
    this.plateTimer = this.plateDuration;
    this.lastPlateSoundIdx = -1;
    this.lastPlateInsertedIdx = -1;
    this.plateZipFlags = { open: false, close: false };
    if (this.plateHand) {
      this.plateHand.position.set(-0.18, -0.205, -0.24);
      this.plateHand.rotation.set(-0.22, -0.18, -0.44);
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
    const smooth = (t) => {
      const c = THREE.MathUtils.clamp(t, 0, 1);
      return c * c * (3 - 2 * c);
    };
    const posRate = Math.min(1, dt * 22);
    const rotRate = Math.min(1, dt * 20);

    // Strict sequential handoff: weapon tucks cleanly off-screen BEFORE IFAK rig enters,
    // and IFAK stows completely off-screen BEFORE weapon returns (zero duplicate hands!)
    const weaponHideEnd = 0.06;
    const medShowStart = 0.06;
    const medHideEnd = 0.92;

    if (p < weaponHideEnd) {
      const wt = smooth(p / weaponHideEnd);
      this.viewmodelGroup.visible = true;
      pos.x = 0.20 * wt;
      pos.y = -0.38 * wt;
      pos.z = 0.08 * wt;
      rot.x = -0.78 * wt;
      rot.y = -0.32 * wt;
      rot.z = -0.22 * wt;
      if (this.medRig) this.medRig.visible = false;
      return;
    }

    if (p >= medHideEnd) {
      const wt = 1 - smooth((p - medHideEnd) / (1 - medHideEnd));
      if (this.medRig) this.medRig.visible = false;
      this.viewmodelGroup.visible = true;
      if (this.leftHand) this.leftHand.visible = true;
      if (this.leftArm) this.leftArm.visible = true;
      if (this.rightHand) this.rightHand.visible = true;
      if (this.rightArm) this.rightArm.visible = true;
      pos.x = 0.20 * wt;
      pos.y = -0.38 * wt;
      pos.z = 0.08 * wt;
      rot.x = -0.78 * wt;
      rot.y = -0.32 * wt;
      rot.z = -0.22 * wt;
      return;
    }

    this.viewmodelGroup.visible = false;
    if (this.plateRig) this.plateRig.visible = false;
    if (this.medRig) this.medRig.visible = true;

    const stimHeld = this.medItems ? this.medItems.stim : null;
    const bandageHeld = this.medItems ? this.medItems.bandage : null;
    if (stimHeld) stimHeld.visible = false;
    if (bandageHeld) bandageHeld.visible = false;
    if (this.medGauzeTail) this.medGauzeTail.visible = false;

    // Live Mixamo left-forearm bone segment in vmCamera space (from previous/live IK frame) for 0.0mm-clipping wrap & injection!
    let foreStart = new THREE.Vector3(-0.14, -0.22, -0.15);
    let foreEnd = new THREE.Vector3(0.02, -0.13, -0.27);
    if (
      this.fpArms && !this.fpArms.disabled &&
      this.fpArms.bones && this.fpArms.bones.leftforearm && this.fpArms.bones.lefthand &&
      this.vmCamera
    ) {
      this.vmCamera.updateMatrixWorld(true);
      const bForeW = this.fpArms.bones.leftforearm.getWorldPosition(new THREE.Vector3());
      const bHandW = this.fpArms.bones.lefthand.getWorldPosition(new THREE.Vector3());
      const fS = this.vmCamera.worldToLocal(bForeW);
      const fE = this.vmCamera.worldToLocal(bHandW);
      if (fS.distanceToSquared(fE) > 0.002) {
        foreStart.copy(fS);
        foreEnd.copy(fE);
      }
    }
    const foreAxis = foreEnd.clone().sub(foreStart).normalize();
    const camUpFwd = new THREE.Vector3(0.0, 0.74, 0.67);
    const dorsalN = camUpFwd.clone().addScaledVector(foreAxis, -camUpFwd.dot(foreAxis));
    if (dorsalN.lengthSq() < 1e-5) dorsalN.set(0, 1, 0);
    dorsalN.normalize();
    const sideN = new THREE.Vector3().crossVectors(foreAxis, dorsalN).normalize();

    // Subtle procedural breathing sway so hands never look robotic
    const breatheY = Math.sin(p * Math.PI * 5.0) * 0.0025;

    let showBox = false;
    const boxPos = new THREE.Vector3(-0.015, -0.118 + breatheY, -0.285);
    const boxRot = new THREE.Euler(0.44, 0.06, -0.04);

    let lStyle = 'medIfakCradleL';
    let rStyle = 'medZipPinchR';
    const lHandTarget = new THREE.Vector3(-0.042, -0.144, -0.276);
    const lHandRot = new THREE.Euler(0.32, 0.10, 0.08);
    const rHandTarget = new THREE.Vector3(0.045, -0.120, -0.255);
    const rHandRot = new THREE.Euler(0.12, -0.14, 0.18);

    // =========================================================================
    // ACT 1 (p = 0.06 .. 0.25): RAISE TACTICAL IFAK -> RIP ZIPPER -> FLIP OPEN
    // =========================================================================
    if (p < 0.25) {
      showBox = true;
      const raiseT = smooth((p - medShowStart) / 0.07);
      boxPos.set(
        THREE.MathUtils.lerp(-0.04, -0.015, raiseT),
        THREE.MathUtils.lerp(-0.34, -0.118, raiseT) + breatheY,
        THREE.MathUtils.lerp(-0.26, -0.285, raiseT)
      );
      if (this.medSlotBandage) this.medSlotBandage.visible = true;
      if (this.medSlotStim) this.medSlotStim.visible = true;

      if (p < 0.13) {
        // Bring IFAK up with left palm cradling flat base & right fingers pinching front-left zipper cord
        if (this.medLidPivot) this.medLidPivot.rotation.x = 0;
        if (this.medZipPull) this.medZipPull.position.set(-0.052, 0.011, 0.050);
        rHandTarget.set(boxPos.x - 0.036, boxPos.y + 0.008, boxPos.z + 0.054);
        rHandRot.set(0.12, -0.02, 0.14);
      } else if (p < 0.19) {
        // Rip perimeter zipper cleanly left-to-right across front track
        const zipT = smooth((p - 0.13) / 0.06);
        if (zipT > 0.06 && !this.healFlags.zip) {
          this.healFlags.zip = true;
          if (window.soundEngine && window.soundEngine.playZipper) window.soundEngine.playZipper(false);
        }
        const zipX = THREE.MathUtils.lerp(-0.052, 0.052, zipT);
        if (this.medZipPull) this.medZipPull.position.set(zipX, 0.011, 0.050);
        if (this.medLidPivot) this.medLidPivot.rotation.x = -0.12 * zipT;
        boxPos.x += Math.sin(zipT * Math.PI) * 0.008;
        rHandTarget.set(boxPos.x + zipX + 0.012, boxPos.y + 0.010, boxPos.z + 0.056);
        rHandRot.set(0.14, 0.06 * zipT, 0.16);
      } else {
        // Flip Cordura clamshell lid open to expose stowed Gauze & Auto-Injector
        const openT = smooth((p - 0.19) / 0.06);
        if (openT > 0.18 && !this.healFlags.open) {
          this.healFlags.open = true;
          if (window.soundEngine && window.soundEngine.playMedLatch) window.soundEngine.playMedLatch(false);
        }
        if (this.medZipPull) this.medZipPull.position.set(0.052, 0.011, 0.050);
        if (this.medLidPivot) this.medLidPivot.rotation.x = THREE.MathUtils.lerp(-0.12, -1.72, openT);
        rHandTarget.set(
          boxPos.x + THREE.MathUtils.lerp(0.052, 0.025, openT),
          boxPos.y + THREE.MathUtils.lerp(0.014, 0.082, openT),
          boxPos.z + THREE.MathUtils.lerp(0.054, -0.020, openT)
        );
        rHandRot.set(0.16 - openT * 0.10, 0.04, 0.14);
      }
      lHandTarget.set(boxPos.x - 0.026, boxPos.y - 0.024, boxPos.z + 0.010);
      lHandRot.set(0.32, 0.10, 0.08);
    }
    // =========================================================================
    // ACT 2 (p = 0.25 .. 0.56): PULL COMBAT GAUZE -> STOW IFAK -> FOREARM WRAP
    // =========================================================================
    else if (p < 0.56) {
      if (this.medLidPivot) this.medLidPivot.rotation.x = -1.72;
      if (this.medSlotStim) this.medSlotStim.visible = true;

      if (p < 0.34) {
        // Pull Combat Gauze out of left elastic loop while left hand lowers IFAK pouch off-screen (zero floating box!)
        const pickT = smooth((p - 0.25) / 0.09);
        const picked = pickT >= 0.34;
        if (this.medSlotBandage) this.medSlotBandage.visible = !picked;
        if (bandageHeld) bandageHeld.visible = picked;
        rStyle = picked ? 'medGauzeGripR' : 'medZipPinchR';

        const stowT = smooth((pickT - 0.32) / 0.68);
        showBox = stowT < 0.96;
        boxPos.set(
          THREE.MathUtils.lerp(-0.015, -0.11, stowT),
          THREE.MathUtils.lerp(-0.118, -0.35, stowT),
          THREE.MathUtils.lerp(-0.285, -0.25, stowT)
        );
        lHandTarget.set(boxPos.x - 0.026, boxPos.y - 0.024, boxPos.z + 0.010);
        lHandRot.set(0.32, 0.10, 0.08);

        if (!picked) {
          const reachT = smooth(pickT / 0.34);
          rHandTarget.set(
            THREE.MathUtils.lerp(0.010, boxPos.x - 0.024, reachT),
            THREE.MathUtils.lerp(-0.036, boxPos.y + 0.024, reachT),
            THREE.MathUtils.lerp(-0.305, boxPos.z + 0.008, reachT)
          );
          rHandRot.set(0.14, -0.12, 0.22);
        } else {
          const liftT = smooth((pickT - 0.34) / 0.66);
          rHandTarget.set(
            THREE.MathUtils.lerp(boxPos.x - 0.024, 0.052, liftT),
            THREE.MathUtils.lerp(boxPos.y + 0.024, -0.095, liftT),
            THREE.MathUtils.lerp(boxPos.z + 0.008, -0.265, liftT)
          );
          rHandRot.set(0.12, -0.16, 0.24);
        }
      } else {
        // Present left forearm across lower-left foreground & wrap sterile combat gauze tangentially around live forearm bone!
        showBox = false;
        if (this.medSlotBandage) this.medSlotBandage.visible = false;
        if (bandageHeld) bandageHeld.visible = p < 0.545;
        lStyle = 'medForearmBraceL';
        rStyle = 'medGauzeGripR';

        const armInT = smooth((p - 0.34) / 0.04);
        const wrapT = smooth((p - 0.36) / 0.15);
        const cinchT = p >= 0.51 ? smooth((p - 0.51) / 0.05) : 0;
        const cinchPulse = p >= 0.51 ? Math.sin(cinchT * Math.PI) : 0;

        if (p > 0.365 && !this.healFlags.item1) {
          this.healFlags.item1 = true;
          if (window.soundEngine && window.soundEngine.playMedItem) window.soundEngine.playMedItem('bandage');
        }
        if (p > 0.518 && !this.healFlags.cinchImpulse && this.fpArms && this.fpArms.applyShoulderImpulse) {
          this.healFlags.cinchImpulse = true;
          this.fpArms.applyShoulderImpulse('left', 0.015, -0.022, 0.01, 0.45);
          this.fpArms.applyShoulderImpulse('right', 0.020, -0.025, 0.015, 0.55);
        }

        lHandTarget.set(
          THREE.MathUtils.lerp(-0.12, 0.040, armInT) + cinchPulse * 0.006,
          THREE.MathUtils.lerp(-0.28, -0.128, armInT) - cinchPulse * 0.008 + breatheY,
          THREE.MathUtils.lerp(-0.24, -0.275, armInT)
        );
        lHandRot.set(0.06, 0.12, -0.10);

        const wrapCenter = foreStart.clone().lerp(foreEnd, 0.54);
        if (this.medForearmWrap && wrapT > 0.04) {
          this.medForearmWrap.visible = true;
          this.medForearmWrap.position.copy(wrapCenter);
          this.medForearmWrap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), foreAxis);
          const wGrow = THREE.MathUtils.lerp(0.22, 1.0, wrapT);
          const radialTight = 1.0 - cinchPulse * 0.045;
          this.medForearmWrap.scale.set(radialTight, wGrow, radialTight);
        }

        if (p < 0.51) {
          // Orbital wrap at 6.1cm radius around forearm bone axis (clears 3.7cm sleeve + 2.0cm roll with 0.0mm clipping!)
          const theta = -0.30 * Math.PI + wrapT * Math.PI * 2.10;
          const radialVec = dorsalN.clone().multiplyScalar(Math.cos(theta))
            .addScaledVector(sideN, Math.sin(theta) * 0.92);
          const orbitPos = wrapCenter.clone()
            .addScaledVector(radialVec, 0.061)
            .addScaledVector(foreAxis, (wrapT - 0.5) * 0.022);
          rHandTarget.copy(orbitPos);
          rHandRot.set(
            0.14 + Math.sin(theta) * 0.14,
            -0.16 + Math.cos(theta) * 0.10,
            0.26 + Math.cos(theta) * 0.16
          );

          // Taut gauze strip connecting forearm cuff to the unrolling bandage in right hand
          if (this.medGauzeTail && wrapT > 0.08 && wrapT < 0.96) {
            const cuffAnchor = wrapCenter.clone().addScaledVector(radialVec, 0.038);
            const span = orbitPos.clone().sub(cuffAnchor);
            const spanLen = span.length();
            if (spanLen > 0.008) {
              this.medGauzeTail.visible = true;
              this.medGauzeTail.position.copy(cuffAnchor).addScaledVector(span, 0.5);
              this.medGauzeTail.scale.set(1, 1, spanLen);
              this.medGauzeTail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), span.normalize());
            }
          }
        } else {
          // Crisp Velcro cinch pull down-right & tuck tail away
          const startPos = wrapCenter.clone().addScaledVector(dorsalN, 0.056).addScaledVector(foreAxis, 0.012);
          rHandTarget.set(
            startPos.x + cinchT * 0.075,
            startPos.y - cinchT * 0.085,
            startPos.z + cinchT * 0.020
          );
          rHandRot.set(0.20, -0.20, 0.34);
        }
      }
    }
    // =========================================================================
    // ACT 3 (p = 0.56 .. 0.92): AUTO-INJECTOR CAP SNAP -> FOREARM PLUNGE & DRAIN
    // =========================================================================
    else {
      showBox = false;
      if (this.medForearmWrap) {
        const wrapCenter = foreStart.clone().lerp(foreEnd, 0.54);
        this.medForearmWrap.visible = p < 0.885;
        this.medForearmWrap.position.copy(wrapCenter);
        this.medForearmWrap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), foreAxis);
        this.medForearmWrap.scale.set(0.96, 1.0, 0.96);
      }

      if (stimHeld) {
        stimHeld.visible = p < 0.895;
        const ud = stimHeld.userData || {};
        const capOff = p >= 0.632;
        if (ud.capGroup) ud.capGroup.visible = !capOff;

        if (p < 0.67) {
          // Bring up Epinephrine Auto-Injector & snap off top red safety cap with left thumb/index!
          const drawT = smooth((p - 0.56) / 0.05);
          const snapT = p >= 0.632 ? smooth((p - 0.632) / 0.038) : 0;
          const snapRecoil = p >= 0.632 ? Math.sin(snapT * Math.PI) : 0;

          rStyle = 'syringeHold';
          lStyle = 'syringeCapPull';
          if (ud.fluidPivot) ud.fluidPivot.scale.y = 1.0;
          if (ud.plunger) ud.plunger.position.y = 0.016;
          if (ud.shroud) ud.shroud.position.y = -0.052;

          rHandTarget.set(
            THREE.MathUtils.lerp(0.10, 0.026, drawT),
            THREE.MathUtils.lerp(-0.24, -0.098, drawT) - snapRecoil * 0.006,
            THREE.MathUtils.lerp(-0.24, -0.265, drawT)
          );
          rHandRot.set(0.06, -0.08, 0.24);

          if (!capOff) {
            const reachCap = smooth((p - 0.57) / 0.055);
            // Top safety cap sits ~5.6cm above rHandTarget along tilted +uw axis
            const capPos = new THREE.Vector3(rHandTarget.x - 0.016, rHandTarget.y + 0.054, rHandTarget.z + 0.005);
            lHandTarget.set(
              THREE.MathUtils.lerp(0.035, capPos.x - 0.008, reachCap),
              THREE.MathUtils.lerp(-0.135, capPos.y - 0.004, reachCap),
              THREE.MathUtils.lerp(-0.275, capPos.z + 0.010, reachCap)
            );
            lHandRot.set(0.14, 0.18, -0.18);
          } else {
            if (!this.healFlags.capPop) {
              this.healFlags.capPop = true;
              if (window.soundEngine && window.soundEngine.playMedItem) window.soundEngine.playMedItem('cap');
              if (this.medDetachedCap) {
                this.medDetachedCap.visible = true;
                this._capStartPos = new THREE.Vector3(rHandTarget.x - 0.016, rHandTarget.y + 0.056, rHandTarget.z + 0.004);
              }
            }
            // Flick left hand up-left as cap pops free, then transition down toward forearm brace
            lHandTarget.set(
              THREE.MathUtils.lerp(0.002, -0.035, snapT),
              THREE.MathUtils.lerp(-0.044, -0.085, snapT),
              -0.265
            );
            lHandRot.set(0.10, 0.22, -0.24);
          }
        } else if (p < 0.855) {
          // Brace left forearm steady -> Poise auto-injector -> Firm perpendicular plunge -> Live bio-fluid drain!
          const braceT = smooth((p - 0.67) / 0.04);
          const jabT = p < 0.72 ? 0 : (p < 0.755 ? smooth((p - 0.72) / 0.035) : 1);
          const hitJolt = (p >= 0.745 && p < 0.795) ? Math.sin(((p - 0.745) / 0.050) * Math.PI) : 0;
          const drainT = p >= 0.750 ? smooth((p - 0.750) / 0.092) : 0;

          if (p > 0.742 && !this.healFlags.item2) {
            this.healFlags.item2 = true;
            if (window.soundEngine && window.soundEngine.playMedItem) window.soundEngine.playMedItem('stim');
            if (this.fpArms && this.fpArms.applyShoulderImpulse) {
              this.fpArms.applyShoulderImpulse('right', -0.015, -0.032, 0.018, 0.75);
              this.fpArms.applyShoulderImpulse('left', 0.010, -0.026, 0.014, 0.60);
            }
          }
          if (p >= 0.835 && !this.healFlags.applied) {
            this.healFlags.applied = true;
            if (player) player.finishMedkit();
          }

          lStyle = 'medForearmBraceL';
          rStyle = p >= 0.735 ? 'syringePlunge' : 'syringeHold';

          // Live glass ampoule fluid drain + internal piston travel + compressible orange safety shroud!
          if (ud.fluidPivot) ud.fluidPivot.scale.y = THREE.MathUtils.lerp(1.0, 0.06, drainT);
          if (ud.plunger) ud.plunger.position.y = THREE.MathUtils.lerp(0.016, -0.006, drainT);
          if (ud.shroud) ud.shroud.position.y = -0.052 + 0.006 * jabT;

          lHandTarget.set(
            THREE.MathUtils.lerp(-0.035, 0.038, braceT),
            THREE.MathUtils.lerp(-0.085, -0.132, braceT) - hitJolt * 0.009 + breatheY,
            THREE.MathUtils.lerp(-0.265, -0.275, braceT)
          );
          lHandRot.set(0.06, 0.12, -0.10);

          // Target proximal outer forearm (28% from elbow toward wrist, cleanly proximal to the gauze cuff at 54%!)
          const injSurface = foreStart.clone().lerp(foreEnd, 0.28).addScaledVector(dorsalN, 0.035);
          const hoverGap = THREE.MathUtils.lerp(0.058, 0.0, jabT);
          // Offset right hand by +0.054m along dorsalN so the orange needle shroud kisses injSurface at jabT=1 with 0mm barrel clipping!
          const handContactPos = injSurface.clone()
            .addScaledVector(dorsalN, 0.054 + hoverGap)
            .add(new THREE.Vector3(0.012, -hitJolt * 0.007, 0.0));
          rHandTarget.copy(handContactPos);
          rHandRot.set(0.08, -0.06, 0.22);
        } else {
          // Withdraw auto-injector straight out along dorsal normal (zero sideways scraping) & lower both arms off-screen
          const outT = smooth((p - 0.855) / (medHideEnd - 0.855));
          const pullAxial = smooth(Math.min(1, outT / 0.45));
          const dropDown = outT > 0.35 ? smooth((outT - 0.35) / 0.65) : 0;

          lStyle = 'medForearmBraceL';
          rStyle = 'syringeHold';
          if (ud.fluidPivot) ud.fluidPivot.scale.y = 0.06;
          if (ud.plunger) ud.plunger.position.y = -0.006;
          if (ud.shroud) ud.shroud.position.y = THREE.MathUtils.lerp(-0.046, -0.052, pullAxial);

          const injSurface = foreStart.clone().lerp(foreEnd, 0.28).addScaledVector(dorsalN, 0.035);
          const liftedPos = injSurface.clone().addScaledVector(dorsalN, 0.054 + pullAxial * 0.052).add(new THREE.Vector3(0.012, 0, 0));
          rHandTarget.set(
            THREE.MathUtils.lerp(liftedPos.x, 0.095, dropDown),
            THREE.MathUtils.lerp(liftedPos.y, -0.34, dropDown),
            THREE.MathUtils.lerp(liftedPos.z, -0.25, dropDown)
          );
          rHandRot.set(0.08 - dropDown * 0.20, -0.08, 0.22);

          lHandTarget.set(
            THREE.MathUtils.lerp(0.038, -0.095, dropDown),
            THREE.MathUtils.lerp(-0.132, -0.34, dropDown),
            THREE.MathUtils.lerp(-0.275, -0.25, dropDown)
          );
          lHandRot.set(0.06, 0.12, -0.10);
        }

        // Ballistic arc for the snapped-off red safety cap
        if (this.medDetachedCap && this.medDetachedCap.visible && this._capStartPos) {
          const capElapsed = Math.max(0, (p - 0.632) * (this.healDuration || 4.8));
          if (capElapsed < 0.45) {
            this.medDetachedCap.position.set(
              this._capStartPos.x - 0.38 * capElapsed,
              this._capStartPos.y + 0.26 * capElapsed - 2.4 * capElapsed * capElapsed,
              this._capStartPos.z - 0.08 * capElapsed
            );
            this.medDetachedCap.rotation.set(capElapsed * 14.0, capElapsed * 9.0, capElapsed * 18.0);
          } else {
            this.medDetachedCap.visible = false;
          }
        }
      }
    }

    if (this.medBoxGroup) {
      this.medBoxGroup.visible = showBox;
      if (showBox) {
        this.medBoxGroup.position.copy(boxPos);
        this.medBoxGroup.rotation.copy(boxRot);
      }
    }

    if (!this._medQTargetL) {
      this._medQTargetL = new THREE.Quaternion();
      this._medQTargetR = new THREE.Quaternion();
    }

    if (this.medLeftHand && this.medLeftArm) {
      if (this.medLeftHand.userData) this.medLeftHand.userData.activeStyle = lStyle;
      this.medLeftHand.position.lerp(lHandTarget, posRate);
      this._medQTargetL.setFromEuler(lHandRot);
      this.medLeftHand.quaternion.slerp(this._medQTargetL, rotRate);
      const lShoulder = new THREE.Vector3(-0.26, -0.30, 0.06);
      const lWrist = this.medLeftHand.position.clone().add(new THREE.Vector3(-0.015, -0.008, 0.036));
      this._currentAimHand = this.medLeftHand;
      this._aimArm(this.medLeftArm, lShoulder, lWrist);
    }

    if (this.medRightHand && this.medRightArm) {
      if (this.medRightHand.userData) this.medRightHand.userData.activeStyle = rStyle;
      this.medRightHand.position.lerp(rHandTarget, posRate);
      this._medQTargetR.setFromEuler(rHandRot);
      this.medRightHand.quaternion.slerp(this._medQTargetR, rotRate);
      const rShoulder = new THREE.Vector3(0.26, -0.30, 0.06);
      const rWrist = this.medRightHand.position.clone().add(new THREE.Vector3(0.015, -0.008, 0.036));
      this._currentAimHand = this.medRightHand;
      this._aimArm(this.medRightArm, rShoulder, rWrist);
    }
  }

  _endHealVisuals() {
    if (this.medRig) this.medRig.visible = false;
    if (this.medBoxGroup) this.medBoxGroup.visible = false;
    if (this.medForearmWrap) this.medForearmWrap.visible = false;
    if (this.medGauzeTail) this.medGauzeTail.visible = false;
    if (this.medDetachedCap) this.medDetachedCap.visible = false;
    if (this.medItems) {
      if (this.medItems.stim) this.medItems.stim.visible = false;
      if (this.medItems.bandage) this.medItems.bandage.visible = false;
    }
    if (this.medLeftHand && this.medLeftHand.userData) this.medLeftHand.userData.activeStyle = null;
    if (this.medRightHand && this.medRightHand.userData) this.medRightHand.userData.activeStyle = null;
    this.viewmodelGroup.visible = true;
    if (this.leftHand) this.leftHand.visible = true;
    if (this.leftArm) this.leftArm.visible = true;
    if (this.rightHand) this.rightHand.visible = true;
    if (this.rightArm) this.rightArm.visible = true;
  }

  startMedkit() {
    if (this.isPlating || this.isHealing) return false;
    // Interrupt active reload while preserving its staged checkpoint!
    if (this.isReloading) this.cancelReload();
    this.cancelInspect();
    this.isHealing = true;
    this.healDuration = 4.9;
    this.healTimer = this.healDuration;
    this.healSequence = ['bandage', 'stim'];
    this.healFlags = { zip: false, open: false, item1: false, cinchImpulse: false, capPop: false, item2: false, applied: false, close: false };
    this._capStartPos = null;
    if (this.medSlotBandage) this.medSlotBandage.visible = true;
    if (this.medSlotStim) this.medSlotStim.visible = true;
    if (this.medForearmWrap) this.medForearmWrap.visible = false;
    if (this.medGauzeTail) this.medGauzeTail.visible = false;
    if (this.medDetachedCap) this.medDetachedCap.visible = false;
    if (this.medLidPivot) this.medLidPivot.rotation.x = 0;
    if (this.medZipPull) this.medZipPull.position.set(-0.052, 0.011, 0.050);
    if (this.medItems && this.medItems.stim && this.medItems.stim.userData) {
      const ud = this.medItems.stim.userData;
      if (ud.capGroup) ud.capGroup.visible = true;
      if (ud.fluidPivot) ud.fluidPivot.scale.y = 1.0;
      if (ud.plunger) ud.plunger.position.y = 0.016;
      if (ud.shroud) ud.shroud.position.y = -0.052;
    }
    if (this.medLeftHand) {
      this.medLeftHand.position.set(-0.07, -0.34, -0.26);
      this.medLeftHand.quaternion.setFromEuler(new THREE.Euler(0.32, 0.10, 0.08));
    }
    if (this.medRightHand) {
      this.medRightHand.position.set(0.03, -0.32, -0.24);
      this.medRightHand.quaternion.setFromEuler(new THREE.Euler(0.16, -0.08, 0.22));
    }
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
    this.inspectDuration = 4.8;
    this.inspectTimer = this.inspectDuration;
    this._inspectCheckSfxPlayed = false;
    this._inspectSnapSfxPlayed = false;
  }

  cancelInspect() {
    if (!this.isInspecting) return;
    this.isInspecting = false;
    this.inspectTimer = 0;
    this._resetReloadParts();
  }

  startReload(weaponDef, isEmpty = false, shellsToLoad = 1, slotObj = null) {
    if (this.isReloading || !weaponDef) return;
    this.cancelInspect();
    this.cancelPlating();
    this.cancelMedkit();
    this.isReloading = true;
    this.reloadSlotRef = slotObj || null;
    const savedStage = (slotObj && slotObj.reloadStage) ? slotObj.reloadStage : 0;
    if (savedStage > 0 && slotObj && slotObj.reloadWasEmpty !== undefined) {
      isEmpty = !!slotObj.reloadWasEmpty;
    }
    this.wasEmptyReload = !!isEmpty;
    this.reloadWeaponId = weaponDef.id;
    this.reloadShellCount = Math.max(1, shellsToLoad || 1);
    this.lastShellSoundIdx = -1;
    this.lastShellLoadedIdx = -1;
    this._portShellLoaded = false;
    this.pumpDelayTimer = 0;
    this.pumpTimer = 0;
    this.boltActionDelayTimer = 0;
    this.boltActionTimer = 0;
    if (weaponDef.id === 'm870') {
      this.reloadDuration = 0.55 + this.reloadShellCount * 0.52 + (this.wasEmptyReload ? 0.50 : 0);
    } else {
      this.reloadDuration = weaponDef.reloadTime + (this.wasEmptyReload ? 0.45 : 0);
    }

    // Resume from persisted staged checkpoint (Stage 1 = insert fresh mag; Stage 2 = rack bolt/slide/H&K slap!)
    const stages = this._getReloadStages(weaponDef.id, this.wasEmptyReload);
    let startP = 0.0;
    if (weaponDef.id === 'm870') {
      if (savedStage >= 2 && this.wasEmptyReload) startP = stages.magInP;
    } else {
      if (savedStage === 1) startP = stages.magOutP;
      else if (savedStage >= 2) startP = stages.magInP;
    }

    this.reloadTimer = this.reloadDuration * Math.max(0.08, 1.0 - startP);
    this._reloadResumeBlend = startP > 0 ? 0.0 : 1.0;
    this.reloadSfxFlags = {
      boltLock: startP >= stages.magOutP,
      magOut: startP >= stages.magOutP,
      magIn: startP >= stages.magInP,
      rack: false
    };
    this._reloadImpulseFlags = {
      boltLock: startP >= stages.magOutP,
      magOut: startP >= stages.magOutP,
      magIn: startP >= stages.magInP,
      rack: false
    };
  }

  cancelReload() {
    this.isReloading = false;
    this.reloadTimer = 0;
    this.reloadSlotRef = null;
    this._reloadResumeBlend = 1.0;
    this.pumpDelayTimer = 0;
    this.pumpTimer = 0;
    this.boltActionDelayTimer = 0;
    this.boltActionTimer = 0;
    this._resetReloadParts();
  }

  tryFire(player, weaponSlotState, world, enemyManager, onHitCallback, squadManager = null, onAllyHitCallback = null, opts = null) {
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
    // MW4 DMZ Sprint-to-Fire Gate: weapon must clear sprint-out recovery before firing (unless already deeply into ADS)
    if ((this.sprintOutTimer || 0) > 0.015 && (this._adsBlend || 0) < 0.55) return false;

    // Staged Reload Check:
    //  - Stage 2 (fresh mag in, bolt/slide NOT racked yet): pulling trigger resumes straight at Stage 2 (bolt rack)!
    //  - Stage 1 (mag removed): if empty, resume at Stage 1 (insert mag); if tactical (+1 chambered round!), fire that 1 emergency round!
    const stg = weaponSlotState.reloadStage || 0;
    if (stg >= 2) {
      if (player.startReload) player.startReload();
      return false;
    }
    let firedChamberedEmergency = false;
    if (stg === 1) {
      if (weaponSlotState.reloadWasEmpty || weaponSlotState.mag <= 0) {
        const reserve = player.getReserveAmmo ? player.getReserveAmmo(def.ammoType) : 0;
        if ((reserve > 0 || window.DEV_MODE) && player.startReload) {
          player.startReload();
          return false;
        }
        this.fireTimer = 0.25;
        window.soundEngine.playEmptyClick();
        return false;
      }
      firedChamberedEmergency = true;
    }

    if (weaponSlotState.mag <= 0) {
      const reserve = player.getReserveAmmo ? player.getReserveAmmo(def.ammoType) : 0;
      if ((reserve > 0 || window.DEV_MODE) && player.startReload) {
        player.startReload();
        return false;
      }
      this.fireTimer = 0.25;
      window.soundEngine.playEmptyClick();
      return false;
    }

    if (firedChamberedEmergency) {
      // Emergency +1 chambered round fired with mag removed! Gun is now truly empty at Stage 1 (needs mag-in + bolt rack)!
      weaponSlotState.mag = 0;
      weaponSlotState.reloadWasEmpty = true;
    } else {
      weaponSlotState.mag -= 1;
    }
    // Preserve sub-frame cycle phase while auto-firing so RPM stays locked regardless of FPS fluctuations
    if (opts && opts.autoCarry && this.fireTimer <= 0 && this.fireTimer > -def.fireRate) {
      this.fireTimer += def.fireRate;
    } else {
      this.fireTimer = def.fireRate;
    }
    // MW4 DMZ Separated Gun Kick vs Camera Recoil:
    // Affected ADS FOV at wide camera FOV (> 80°) reduces perceived 3D visual bounce; Independent ADS FOV keeps full 80° baseline bounce.
    const gKick = (def.gunKick != null) ? def.gunKick : 1.0;
    const baseFovNow = window.BASE_FOV || 75;
    const visualFovDamp = (player.isADS && window.ADS_FOV_MODE !== 'independent' && baseFovNow > 80)
      ? Math.max(0.68, 80 / baseFovNow)
      : 1.0;
    const kickScale = (player.isADS ? 0.58 : 1.0) * gKick * visualFovDamp;
    const hRec = def.horizRecoil != null ? def.horizRecoil : (def.recoil * 0.48);
    const hSign = Math.random() < 0.56 ? 1 : -1;
    // Physical rearward shoulder kick + controlled muzzle flip + horizontal recoil bounce + 6-DOF spring punch
    this.recoilOffset = Math.min(0.06, this.recoilOffset + 0.022 * kickScale);
    const baseZKick = def.id === 'm870' ? 0.036 : ((def.id === 'm24' || def.id === 'awm338' || def.id === 'mosin9130') ? 0.034 : (def.slot === 'secondary' ? 0.018 : 0.022));
    this.recoilZ = Math.min(0.056, this.recoilZ + baseZKick * kickScale);
    this.recoilPitch = Math.min(0.088, this.recoilPitch + def.recoil * 1.15 * kickScale);
    this.recoilYaw = THREE.MathUtils.clamp(this.recoilYaw + hSign * hRec * 1.35 * kickScale, -0.045, 0.045);
    this.recoilRoll = THREE.MathUtils.clamp(this.recoilRoll + (Math.random() - 0.5) * 0.062 * kickScale, -0.055, 0.055);
    this.recoilX = THREE.MathUtils.clamp(this.recoilX + hSign * hRec * 0.32 * kickScale, -0.012, 0.012);
    this.addWeaponImpulse(
      hSign * hRec * 0.14 * kickScale,
      0.008 * kickScale,
      baseZKick * 0.52 * kickScale,
      def.recoil * 0.48 * kickScale,
      hSign * hRec * 0.34 * kickScale,
      (Math.random() - 0.5) * 0.065 * kickScale
    );
    // Kinetic IK Clavicle/Shoulder Compliance Impulse + Recoil-Reactive Finger Grip Tension
    if (this.fpArms && this.fpArms.applyShoulderImpulse) {
      this.fpArms.applyShoulderImpulse('right', hSign * hRec * 0.16 * gKick, 0.008 * gKick, baseZKick * 0.72 * gKick, 0.32);
      this.fpArms.applyShoulderImpulse('left', hSign * hRec * 0.08 * gKick, 0.004 * gKick, baseZKick * 0.36 * gKick, 0.20);
    }
    if (def.slot === 'secondary' || def.id === 'mp5k' || def.id === 'ak74m') {
      this.boltCycleDuration = def.id === 'ak74m' ? 0.085 : 0.075;
      this.boltCycleTimer = this.boltCycleDuration;
      this.boltKick = def.id === 'ak74m' ? 0.078 : (def.slot === 'secondary' ? 0.052 : 0.058);
    } else if (def.id === 'm870' && weaponSlotState.mag > 0) {
      this.pumpDelayTimer = 0.16;
    } else if (def.boltAction && weaponSlotState.mag > 0) {
      this.boltActionDuration = def.id === 'awm338' ? 0.72 : 0.60;
      this.boltActionDelayTimer = 0.16;
    }
    this.muzzleFlash.intensity = 3.5;
    this.muzzleMesh.material.opacity = 0.92;
    this.muzzleTimer = 0.045;

    window.soundEngine.playGunshot(def.id, 0, !!def.suppressed);

    // Sync live camera & viewmodel transforms BEFORE sampling aim ray / muzzle position; apply recoil kick AFTER bullets launch!
    if (player && player.syncCameraAimImmediate) player.syncCameraAimImmediate();
    if (this.vmCamera && this.vmCamera !== this.camera && !player.isThirdPerson) {
      this.vmCamera.position.copy(this.camera.position);
      this.vmCamera.quaternion.copy(this.camera.quaternion);
      this.vmCamera.updateMatrixWorld(true);
    }

    // Raycast pellets — hipfire accuracy directly matches live crosshair size unless using a laser or 45° Tactical Stance
    let totalSpread;
    if (player.isADS) {
      const stanceMult = player.isProne ? 0.55 : (player.isCrouching ? 0.75 : 1.0);
      const tacB = this._tacStanceBlend || 0;
      if (tacB > 0.35) {
        const baseCantSpread = def.hasLaser
          ? (def.adsSpread * 1.45)
          : THREE.MathUtils.lerp(def.adsSpread, this.currentSpread, 0.26);
        totalSpread = baseCantSpread * stanceMult;
      } else {
        const moveAdd = Math.hypot(player.velocity.x, player.velocity.z) > 0.8 ? 0.005 : 0;
        totalSpread = (def.adsSpread + moveAdd) * stanceMult;
      }
    } else if (def.hasLaser) {
      // Tactical laser overrides wide hipfire cone with tight laser-guided accuracy
      const stanceMult = player.isProne ? 0.60 : (player.isCrouching ? 0.78 : 1.0);
      totalSpread = Math.min(this.currentSpread, def.adsSpread * 1.65) * stanceMult;
    } else {
      totalSpread = this.currentSpread;
    }

    const origin = this._shotOrigin;
    this.camera.getWorldPosition(origin);

    const muzzleWorld = this._shotMuzzle;
    this.muzzleMesh.getWorldPosition(muzzleWorld);
    this._spawnSmoke(muzzleWorld, 2);

    // Calculate attachment-aware muzzle velocity & effective bullet drop distance
    const mods = (weaponSlotState && weaponSlotState.mods) || {};
    const baseVelMap = {
      awm338: 920,
      m24: 820,
      mosin9130: 780,
      ak74m: 680,
      mp5k: 390,
      m870: 340,
      g17: 355,
      pm9: 330
    };
    let muzzleVel = baseVelMap[def.id] || 560;
    if (mods.muzzle === 'suppressor' || def.suppressed) muzzleVel *= 0.90;
    else if (mods.muzzle === 'compensator' || mods.muzzle === 'brake') muzzleVel *= 1.05;
    if (mods.optic === 'sniper_8x' || mods.optic === 'lpvo_4x') muzzleVel *= 1.04;
    const gravity = 13.5; // Tuned tactical ballistic drop (m/s^2)
    // Effective flat-drop zero distance (meters before noticeable drop)
    const zeroDist = def.id === 'awm338' ? 140 : (def.id === 'm24' || def.id === 'mosin9130' ? 115 : (def.id === 'ak74m' ? 75 : 40));

    // MW4 DMZ Sight-Aligned Aiming: align aim convergence ray with live physical sight sway & hit flinch during ADS!
    const camFwd = this._shotCamFwd.set(0, 0, -1);
    if (player.isADS) {
      const zoomSqrt = Math.max(1.0, Math.sqrt(def.adsZoom || 1.25));
      const alignWeight = THREE.MathUtils.clamp(1.0 - (this._tacStanceBlend || 0) * 0.45, 0.45, 1.0);
      const swayPitch = (((this.idleSwayPitch || 0) / zoomSqrt) + (this._flinchPitch || 0) * 0.55) * alignWeight;
      const swayYaw = (-((this.idleSwayYaw || 0) / zoomSqrt) + (this._flinchYaw || 0) * 0.55) * alignWeight;
      if (Math.abs(swayPitch) > 0.00001 || Math.abs(swayYaw) > 0.00001) {
        this._shotEuler.set(swayPitch, swayYaw, 0, 'YXZ');
        camFwd.applyEuler(this._shotEuler);
      }
    }
    camFwd.applyQuaternion(this.camera.quaternion).normalize();

    // Frustum & range pre-filter for enemy/ally hitboxes (avoids raycasting off-screen/out-of-range AI)
    const maxRangeSq = (def.range + 4) * (def.range + 4);
    const enemyMeshes = this._shotEnemyMeshes;
    enemyMeshes.length = 0;
    if (enemyManager && enemyManager.enemies) {
      const list = enemyManager.enemies;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e || e.dead || e.extracted || !e.hitboxes || !e.position) continue;
        this._shotToTarget.set(e.position.x - origin.x, (e.position.y + 1.0) - origin.y, e.position.z - origin.z);
        const distSq = this._shotToTarget.lengthSq();
        if (distSq > maxRangeSq) continue;
        const fwdDot = this._shotToTarget.dot(camFwd);
        if (distSq < 36 || (fwdDot > 0 && fwdDot * fwdDot > 0.09 * distSq)) {
          for (let h = 0; h < e.hitboxes.length; h++) enemyMeshes.push(e.hitboxes[h]);
        }
      }
    }
    const allyMeshes = this._shotAllyMeshes;
    allyMeshes.length = 0;
    if (window.SQUAD_PVP && squadManager && squadManager.allies) {
      const aList = squadManager.allies;
      for (let i = 0; i < aList.length; i++) {
        const a = aList[i];
        if (!a || a.dead || a.extracted || !a.hitboxes || !a.position) continue;
        this._shotToTarget.set(a.position.x - origin.x, (a.position.y + 1.0) - origin.y, a.position.z - origin.z);
        const distSq = this._shotToTarget.lengthSq();
        if (distSq > maxRangeSq) continue;
        const fwdDot = this._shotToTarget.dot(camFwd);
        if (distSq < 36 || (fwdDot > 0 && fwdDot * fwdDot > 0.09 * distSq)) {
          for (let h = 0; h < a.hitboxes.length; h++) allyMeshes.push(a.hitboxes[h]);
        }
      }
    }

    const aimRay = this._aimRay;
    aimRay.set(origin, camFwd);
    aimRay.near = 0.25;
    aimRay.far = def.range;
    const aimHitW = world && world.raycastWorld ? world.raycastWorld(origin, camFwd, 0.25, def.range) : null;
    const aimDistW = aimHitW ? aimHitW.distance : def.range;
    let aimDistE = def.range;
    if (enemyMeshes.length > 0) {
      this._tmpHitArr.length = 0;
      aimRay.intersectObjects(enemyMeshes, false, this._tmpHitArr);
      if (this._tmpHitArr.length > 0) aimDistE = this._tmpHitArr[0].distance;
    }
    let aimDistA = def.range;
    if (allyMeshes.length > 0) {
      this._tmpHitArr.length = 0;
      aimRay.intersectObjects(allyMeshes, false, this._tmpHitArr);
      if (this._tmpHitArr.length > 0) aimDistA = this._tmpHitArr[0].distance;
    }
    const minTargetDist = Math.min(aimDistE, aimDistA);
    const convDist = minTargetDist < def.range
      ? Math.max(1.2, Math.min(aimDistW, minTargetDist, zeroDist))
      : Math.max(4.5, Math.min(aimDistW, zeroDist));
    const aimPoint = this._shotAimPoint.copy(origin).addScaledVector(camFwd, convDist);

    const zeroTime = zeroDist / muzzleVel;
    const zeroCompY = (0.5 * gravity * zeroTime * zeroTime) / zeroDist;
    const maxSteps = def.pellets > 1 ? 3 : 8;
    const stepDistTarget = Math.max(12, def.range / maxSteps);
    const stepDt = stepDistTarget / muzzleVel;
    const halfGravDtSq = 0.5 * gravity * stepDt * stepDt;
    const tracerColor = def.boltAction ? 0xffe49e : 0xffdd88;
    const segRay = this._segRay;
    segRay.near = 0.01;

    for (let p = 0; p < def.pellets; p++) {
      // Spawn bullet directly from the end of the barrel (muzzleWorld), aimed toward sight convergence + spread!
      const baseDir = this._shotBaseDir.copy(aimPoint).sub(muzzleWorld).normalize();
      this._shotEuler.set(
        (Math.random() - 0.5) * 2 * totalSpread,
        (Math.random() - 0.5) * 2 * totalSpread,
        0,
        'YXZ'
      );
      this._shotQuat.setFromEuler(this._shotEuler);
      const launchDir = this._shotLaunchDir.copy(baseDir).applyQuaternion(this._shotQuat).normalize();
      launchDir.y += zeroCompY;
      launchDir.normalize();

      // Step parabolic ballistic curve from barrel tip out to def.range
      const vel = this._shotVel.copy(launchDir).multiplyScalar(muzzleVel);
      const curPos = this._shotCurPos.copy(muzzleWorld);
      let traceCount = 0;
      this._tracePtsBuf[traceCount++].copy(curPos);
      let totalDist = 0;

      for (let step = 0; step < maxSteps && totalDist < def.range; step++) {
        const nextPos = this._shotNextPos.copy(curPos).addScaledVector(vel, stepDt);
        nextPos.y -= halfGravDtSq;
        vel.y -= gravity * stepDt;

        const segVec = this._shotSegVec.copy(nextPos).sub(curPos);
        const segLen = segVec.length();
        if (segLen < 0.001) break;
        const segDir = this._shotSegDir.copy(segVec).multiplyScalar(1 / segLen);

        const worldHit = (world && world.raycastWorld) ? world.raycastWorld(curPos, segDir, 0.01, segLen) : null;
        const worldDist = worldHit ? worldHit.distance : Infinity;
        const entityFar = Math.min(segLen, worldDist);

        let enemyHit = null;
        let enemyDist = Infinity;
        if (enemyMeshes.length > 0 && entityFar > 0.01) {
          segRay.set(curPos, segDir);
          segRay.far = entityFar;
          this._tmpHitArr.length = 0;
          segRay.intersectObjects(enemyMeshes, false, this._tmpHitArr);
          if (this._tmpHitArr.length > 0) {
            enemyHit = this._tmpHitArr[0];
            enemyDist = enemyHit.distance;
          }
        }

        let allyHit = null;
        let allyDist = Infinity;
        if (allyMeshes.length > 0 && entityFar > 0.01) {
          segRay.set(curPos, segDir);
          segRay.far = Math.min(entityFar, enemyDist);
          this._tmpHitArr.length = 0;
          segRay.intersectObjects(allyMeshes, false, this._tmpHitArr);
          if (this._tmpHitArr.length > 0) {
            allyHit = this._tmpHitArr[0];
            allyDist = allyHit.distance;
          }
        }

        if (allyHit && allyDist < worldDist && allyDist < enemyDist && allyDist <= segLen) {
          const hitPt = allyHit.point;
          if (traceCount < this._tracePtsBuf.length) this._tracePtsBuf[traceCount++].copy(hitPt);
          const { ally, part } = allyHit.object.userData;
          const isHead = part === 'head';
          const dmg = Math.round(def.damage * (isHead ? 1.8 : 1.0));
          const attackerInfo = { name: 'YOU', isPlayer: true, weaponId: weaponSlotState.id, weaponName: def.name };
          this._spawnImpact(hitPt, 0x991111, 5);
          if (onAllyHitCallback) onAllyHitCallback(isHead, dmg, ally, attackerInfo);
          break;
        } else if (enemyHit && enemyDist < worldDist && enemyDist <= segLen) {
          const hitPt = enemyHit.point;
          if (traceCount < this._tracePtsBuf.length) this._tracePtsBuf[traceCount++].copy(hitPt);
          const { enemy, part } = enemyHit.object.userData;
          const isHead = part === 'head';
          const dmg = Math.round(def.damage * (isHead ? 2.0 : 1.0));
          const attackerInfo = { name: 'YOU', isPlayer: true, weaponId: weaponSlotState.id, weaponName: def.name };
          const killed = enemy.takeDamage(dmg, muzzleWorld, attackerInfo);
          this._spawnImpact(hitPt, enemy.lastHitArmor ? 0x4fc3f7 : 0x991111, 5);
          onHitCallback(isHead, killed, enemy, attackerInfo, dmg);
          break;
        } else if (worldHit && worldDist <= segLen) {
          if (traceCount < this._tracePtsBuf.length) this._tracePtsBuf[traceCount++].copy(worldHit.point);
          this._spawnImpact(worldHit.point, 0xc8b898, 4);
          break;
        }

        curPos.copy(nextPos);
        totalDist += segLen;
        if (traceCount < this._tracePtsBuf.length) this._tracePtsBuf[traceCount++].copy(curPos);
      }

      this._spawnCurvedTracer(this._tracePtsBuf, tracerColor, traceCount);
    }

    // Apply camera recoil & bloom AFTER all bullets of this shot leave the barrel so shots match exact crosshair!
    const camRecScale = player.isADS ? 0.48 : 0.62;
    const vertKick = def.recoil * camRecScale;
    const horizKick = (Math.random() - 0.44) * hRec * 1.15 * camRecScale;
    player.applyRecoil(vertKick, horizKick);
    if (player.syncCameraAimImmediate) player.syncCameraAimImmediate();
    this.fireBloom = Math.min(0.055, this.fireBloom + def.recoil * 0.42);

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
    this.scopeOptic = null;
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
    this.rightArm.userData.fpSide = 'right';
    g.add(this.rightHand, this.rightArm);

    this.meleeMesh = g;
    this.currentMesh = g;
    this.isFistsMode = false;
    this.viewmodelGroup.add(g);
    this.sightHeight = 0.12;
    this.adsZ = -0.34;
    this.viewmodelGroup.visible = !this.isThirdPerson;
  }

  buildFistsViewmodel() {
    this.isMeleeMode = true;
    this.isFistsMode = true;
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
    this.scopeOptic = null;
    this.boltMesh = null;
    this.charmPivot = null;
    this.leftFist = null;

    const g = new THREE.Group();

    // Gloved tactical fists matching gun-holding hands, rising from bottom-left & bottom-right at an even angle
    // with the left lead fist positioned slightly above the right guard fist
    this.leftHand = this._createHand(false, 'leftFist');
    this.leftHand.position.set(-0.17, -0.015, -0.05);
    this.leftHand.rotation.set(0.56, 0.24, -0.18);
    this.leftHandRestPos.copy(this.leftHand.position);
    this.leftHandRestRot.copy(this.leftHand.rotation);
    this.leftArm = this._createForearm();
    this.leftArm.userData.fpSide = 'left';

    this.rightHand = this._createHand(true, 'rightFist');
    this.rightHand.position.set(0.17, -0.062, 0.0);
    this.rightHand.rotation.set(0.56, -0.24, 0.18);
    this.rightHandRestPos.copy(this.rightHand.position);
    this.rightHandRestRot.copy(this.rightHand.rotation);
    this.rightArm = this._createForearm();
    this.rightArm.userData.fpSide = 'right';

    g.add(this.leftHand, this.leftArm, this.rightHand, this.rightArm);
    this.meleeMesh = g;
    this.currentMesh = g;
    this.viewmodelGroup.add(g);
    this.sightHeight = 0.12;
    this.adsZ = -0.34;
    this.viewmodelGroup.visible = !this.isThirdPerson;
  }

  triggerDoorBash() {
    this.doorBashDuration = 0.36;
    this.doorBashTimer = this.doorBashDuration;
    this.recoilPitch = Math.max(this.recoilPitch || 0, 0.045);
  }

  tryMeleeSlash(player, world, enemyManager, onHitCallback, isQuick = false, squadManager = null, onAllyHitCallback = null) {
    if (this.meleeSwingTimer > 0) return false;
    this._fistPunchSide = !this._fistPunchSide;
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

    // Use true eye origin in 3P so third-person camera pullback never steals melee reach
    const origin = new THREE.Vector3();
    if (player && player.isThirdPerson && player.position) {
      origin.copy(player.position);
    } else {
      this.camera.getWorldPosition(origin);
    }
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion).normalize();

    const reach = 2.85;
    const isFists = !isQuick && player && player.activeSlot !== 'melee' && !player.getActiveWeaponSlot();
    const mDef = (!isFists && player) ? GAME_DATA.ITEMS[player.melee || 'melee_knife'] : null;
    const attackerInfo = isFists
      ? { name: 'YOU', isPlayer: true, weaponId: 'fists', weaponName: 'Fists' }
      : { name: 'YOU', isPlayer: true, weaponId: (player && player.melee) || 'melee_knife', weaponName: mDef ? mDef.name : 'Combat Knife' };
    const bodyDmg = isFists ? 55 : 68;
    const headDmg = isFists ? 85 : 105;

    const enemyMeshes = (enemyManager && enemyManager.getHitboxMeshes) ? enemyManager.getHitboxMeshes() : [];
    const allyMeshes = (window.SQUAD_PVP && squadManager && squadManager.getHitboxMeshes) ? squadManager.getHitboxMeshes() : [];

    // 1. Multi-ray melee sweep (center + slight left/right/down/up fan, near = 0 so point-blank hits always register)
    const rayDirs = [
      dir.clone(),
      dir.clone().addScaledVector(right, 0.14).normalize(),
      dir.clone().addScaledVector(right, -0.14).normalize(),
      dir.clone().addScaledVector(up, -0.14).normalize(),
      dir.clone().addScaledVector(up, 0.10).normalize()
    ];

    let bestEnemyHit = null;
    let bestAllyHit = null;
    let firstWorldHit = null;

    for (let rIdx = 0; rIdx < rayDirs.length; rIdx++) {
      const rDir = rayDirs[rIdx];
      const worldHit = (world && world.raycastWorld) ? world.raycastWorld(origin, rDir, 0.05, reach) : null;
      const worldDist = worldHit ? worldHit.distance : reach;
      if (rIdx === 0 && worldHit) firstWorldHit = worldHit;

      const raycaster = this._aimRay;
      raycaster.set(origin, rDir);
      raycaster.near = 0.0;
      raycaster.far = worldDist;

      if (enemyMeshes.length > 0) {
        this._tmpHitArr.length = 0;
        raycaster.intersectObjects(enemyMeshes, false, this._tmpHitArr);
        if (this._tmpHitArr.length > 0 && this._tmpHitArr[0].distance < worldDist) {
          if (!bestEnemyHit || this._tmpHitArr[0].distance < bestEnemyHit.distance) {
            bestEnemyHit = this._tmpHitArr[0];
          }
        }
      }
      if (allyMeshes.length > 0) {
        this._tmpHitArr.length = 0;
        raycaster.intersectObjects(allyMeshes, false, this._tmpHitArr);
        if (this._tmpHitArr.length > 0 && this._tmpHitArr[0].distance < worldDist) {
          if (!bestAllyHit || this._tmpHitArr[0].distance < bestAllyHit.distance) {
            bestAllyHit = this._tmpHitArr[0];
          }
        }
      }
    }

    // 2. Close-range melee cone fallback (catches point-blank punches/slashes slightly off exact ray center)
    let coneEnemy = null;
    let coneEnemyDist = Infinity;
    let coneEnemyPt = null;
    let coneAlly = null;
    let coneAllyDist = Infinity;
    let coneAllyPt = null;

    if (!bestEnemyHit && !bestAllyHit) {
      const coneReach = 2.65;
      const checkLOS = (targetPt, dist) => {
        if (!world || dist < 0.2) return true;
        const losDir = this._shotSegDir.copy(targetPt).sub(origin).normalize();
        if (world.raycastWorld) {
          return !world.raycastWorld(origin, losDir, 0.05, Math.max(0.1, dist - 0.15));
        }
        return true;
      };

      if (enemyManager && enemyManager.enemies) {
        for (const e of enemyManager.enemies) {
          if (!e || e.dead) continue;
          const chest = e.position.clone().add(new THREE.Vector3(0, 1.15, 0));
          const toTarget = chest.clone().sub(origin);
          const dist = toTarget.length();
          if (dist <= coneReach && dist < coneEnemyDist) {
            const dot = toTarget.clone().normalize().dot(dir);
            if ((dot >= 0.45 || dist < 1.15) && checkLOS(chest, dist)) {
              coneEnemy = e;
              coneEnemyDist = dist;
              coneEnemyPt = chest;
            }
          }
        }
      }

      if (window.SQUAD_PVP && squadManager && squadManager.allies) {
        for (const a of squadManager.allies) {
          if (!a || a.dead || a.extracted || !a.position) continue;
          const chest = a.position.clone().add(new THREE.Vector3(0, 1.15, 0));
          const toTarget = chest.clone().sub(origin);
          const dist = toTarget.length();
          if (dist <= coneReach && dist < coneAllyDist) {
            const dot = toTarget.clone().normalize().dot(dir);
            if ((dot >= 0.45 || dist < 1.15) && checkLOS(chest, dist)) {
              coneAlly = a;
              coneAllyDist = dist;
              coneAllyPt = chest;
            }
          }
        }
      }
    }

    const eDist = bestEnemyHit ? bestEnemyHit.distance : coneEnemyDist;
    const aDist = bestAllyHit ? bestAllyHit.distance : coneAllyDist;

    if (aDist < eDist && aDist < Infinity) {
      const ally = bestAllyHit ? bestAllyHit.object.userData.ally : coneAlly;
      const isHead = bestAllyHit ? (bestAllyHit.object.userData.part === 'head') : false;
      const hitPt = bestAllyHit ? bestAllyHit.point : coneAllyPt;
      const dmg = isHead ? headDmg : bodyDmg;
      if (hitPt) this._spawnImpact(hitPt, 0x991111, 6);
      if (onAllyHitCallback && ally) onAllyHitCallback(isHead, dmg, ally, attackerInfo);
    } else if (eDist < Infinity) {
      const enemy = bestEnemyHit ? bestEnemyHit.object.userData.enemy : coneEnemy;
      const isHead = bestEnemyHit ? (bestEnemyHit.object.userData.part === 'head') : false;
      const hitPt = bestEnemyHit ? bestEnemyHit.point : coneEnemyPt;
      const dmg = isHead ? headDmg : bodyDmg;
      if (enemy && !enemy.dead) {
        const killed = enemy.takeDamage(dmg, origin, attackerInfo);
        if (hitPt) this._spawnImpact(hitPt, 0x991111, 6);
        if (onHitCallback) onHitCallback(isHead, killed, enemy, attackerInfo, dmg);
      }
    } else if (firstWorldHit) {
      this._spawnImpact(firstWorldHit.point, 0xc8b898, 4);
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

    let endPoint = this._shotNextPos.copy(muzzleWorld).addScaledVector(dir, 55);
    if (!hitPlayer && world && world.raycastWorld) {
      const hit = world.raycastWorld(muzzleWorld, dir, 0.2, 55);
      if (hit) {
        endPoint = hit.point;
        this._spawnImpact(endPoint, 0xc8b898, 4);
      }
    } else {
      endPoint = targetPos;
    }

    this._spawnTracer(muzzleWorld, endPoint, 0xff7744);
  }

  _ensureFxPools() {
    if (!this.scene) return;
    if (this._poolScene === this.scene && this._tracerPool) return;
    this._poolScene = this.scene;
    this.particles.length = 0;
    this.tracers.length = 0;
    this._tracerCursor = 0;
    this._smokeCursor = 0;
    this._impactCursor = 0;

    this._tracerPool = [];
    for (let i = 0; i < 24; i++) {
      const arr = new Float32Array(16 * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      geo.setDrawRange(0, 0);
      const mat = new THREE.LineBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0 });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.visible = false;
      this.scene.add(line);
      this._tracerPool.push({ line, arr, life: 0, maxLife: 0.08, baseOpacity: 0.82, active: false });
    }

    if (!this._sharedImpactGeo) this._sharedImpactGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    this._impactPool = [];
    for (let i = 0; i < 56; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xc8b898 });
      const m = new THREE.Mesh(this._sharedImpactGeo, mat);
      m.visible = false;
      this.scene.add(m);
      this._impactPool.push({ mesh: m, vel: new THREE.Vector3(), life: 0, maxLife: 0.45, isSmoke: false, active: false });
    }

    if (!this._sharedSmokeGeo) this._sharedSmokeGeo = new THREE.SphereGeometry(0.08, 5, 5);
    this._smokePool = [];
    for (let i = 0; i < 32; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xbab6ae, transparent: true, opacity: 0.32, depthWrite: false });
      const m = new THREE.Mesh(this._sharedSmokeGeo, mat);
      m.visible = false;
      this.scene.add(m);
      this._smokePool.push({ mesh: m, vel: new THREE.Vector3(), life: 0, maxLife: 0.5, isSmoke: true, active: false });
    }
  }

  _spawnTracer(start, end, color = 0xffdd88) {
    this._ensureFxPools();
    if (!this._tracerPool) return;
    const slot = this._tracerPool[this._tracerCursor];
    this._tracerCursor = (this._tracerCursor + 1) % this._tracerPool.length;
    slot.arr[0] = start.x; slot.arr[1] = start.y; slot.arr[2] = start.z;
    slot.arr[3] = end.x;   slot.arr[4] = end.y;   slot.arr[5] = end.z;
    slot.line.geometry.attributes.position.needsUpdate = true;
    slot.line.geometry.setDrawRange(0, 2);
    slot.line.material.color.setHex(color);
    slot.line.material.opacity = 0.80;
    slot.baseOpacity = 0.80;
    slot.maxLife = 0.08;
    slot.life = 0.08;
    slot.line.visible = true;
    if (!slot.active) {
      slot.active = true;
      this.tracers.push(slot);
    }
  }

  _spawnCurvedTracer(points, color = 0xffdd88, count = null) {
    const n = count !== null ? count : (points ? points.length : 0);
    if (!points || n < 2) return;
    this._ensureFxPools();
    if (!this._tracerPool) return;
    const slot = this._tracerPool[this._tracerCursor];
    this._tracerCursor = (this._tracerCursor + 1) % this._tracerPool.length;
    const clampedN = Math.min(n, 16);
    for (let i = 0; i < clampedN; i++) {
      const pt = points[i];
      const off = i * 3;
      slot.arr[off] = pt.x;
      slot.arr[off + 1] = pt.y;
      slot.arr[off + 2] = pt.z;
    }
    slot.line.geometry.attributes.position.needsUpdate = true;
    slot.line.geometry.setDrawRange(0, clampedN);
    slot.line.material.color.setHex(color);
    slot.line.material.opacity = 0.86;
    slot.baseOpacity = 0.86;
    slot.maxLife = 0.13;
    slot.life = 0.13;
    slot.line.visible = true;
    if (!slot.active) {
      slot.active = true;
      this.tracers.push(slot);
    }
  }

  _spawnImpact(pos, color, count) {
    this._ensureFxPools();
    if (!this._impactPool) return;
    for (let i = 0; i < count; i++) {
      const slot = this._impactPool[this._impactCursor];
      this._impactCursor = (this._impactCursor + 1) % this._impactPool.length;
      slot.mesh.material.color.setHex(color);
      slot.mesh.position.copy(pos);
      slot.mesh.scale.set(1, 1, 1);
      slot.vel.set(
        (Math.random() - 0.5) * 4.5,
        Math.random() * 3.8 + 0.5,
        (Math.random() - 0.5) * 4.5
      );
      slot.life = 0.25 + Math.random() * 0.2;
      slot.maxLife = 0.45;
      slot.mesh.visible = true;
      if (!slot.active) {
        slot.active = true;
        this.particles.push(slot);
      }
    }
  }

  _spawnSmoke(pos, count = 2) {
    this._ensureFxPools();
    if (!this._smokePool) return;
    for (let i = 0; i < count; i++) {
      const slot = this._smokePool[this._smokeCursor];
      this._smokeCursor = (this._smokeCursor + 1) % this._smokePool.length;
      slot.mesh.position.copy(pos);
      const s = 0.8 + Math.random() * 0.6;
      slot.mesh.scale.set(s, s, s);
      slot.mesh.material.opacity = 0.32;
      slot.vel.set(
        (Math.random() - 0.5) * 0.6,
        0.6 + Math.random() * 0.5,
        (Math.random() - 0.5) * 0.6
      );
      const life = 0.45 + Math.random() * 0.25;
      slot.life = life;
      slot.maxLife = life;
      slot.mesh.visible = true;
      if (!slot.active) {
        slot.active = true;
        this.particles.push(slot);
      }
    }
  }
}
