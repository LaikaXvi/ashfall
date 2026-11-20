// First-Person Player Controller, Vitals, Weapons & Backpack
class Player {
  constructor(camera, world, weaponSystem, loadoutState) {
    this.camera = camera;
    this.world = world;
    this.weaponSystem = weaponSystem;

    this.position = world.playerSpawn.clone(); // eye position
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;

    this.standEyeHeight = 1.7;
    this.crouchEyeHeight = 1.05;
    this.slideEyeHeight = 0.76;
    this.proneEyeHeight = 0.46;
    this.currentEyeHeight = this.standEyeHeight;
    this.radius = 0.4;
    this.onGround = true;

    // Stance & tactical slide state
    this.stance = 'stand'; // 'stand' | 'crouch' | 'prone'
    this.isProne = false;
    this.isSliding = false;
    this.slideTimer = 0;
    this.slideDuration = 0.68;
    this.slideCooldown = 0;
    this.slideDir = new THREE.Vector3();
    this.slideRoll = 0;
    this.crouchKeyHeld = false;
    this.crouchHoldTime = 0;
    this.crouchHoldTriggeredProne = false;

    // Input flags
    this.keys = {};
    this.isADS = false;
    this.isSprinting = false;
    this.isTacSprinting = false;
    this.tacSprintRegenDelay = 0;
    this.lastShiftPressTime = 0;
    this.isCrouching = false;
    this.isFiring = false;
    this.lean = 0; // -1 left, +1 right
    this.padMoveX = 0;
    this.padMoveY = 0;
    this.padSprint = false;
    this.padLean = 0;

    // Vitals (DMZ 1-3 Plate Armor System)
    this.maxHp = 100;
    this.hp = 100;
    this.isDowned = false;
    this.dead = false;
    this.downedHp = 55;
    this.downedBleedMax = 25.0;
    this.downedBleedTimer = 25.0;
    this.downedBy = null;
    this._justBledOut = false;
    this.beingRevivedBy = null;
    this.beingDragged = false;
    this.reviveProgress = 0;
    this.isRevivingAlly = false;
    this.isDraggingAlly = false;
    const armorDef = loadoutState.armor ? GAME_DATA.ITEMS[loadoutState.armor] : null;
    this.plateSlots = armorDef ? (armorDef.plateSlots || Math.ceil(armorDef.maxArmor / 50)) : 0;
    this.maxArmor = this.plateSlots * 50;
    this.armor = this.maxArmor;
    this.armorId = loadoutState.armor || null;
    this.plates = Math.min(6, loadoutState.plates !== undefined ? loadoutState.plates : 3);
    this.stamina = 100;
    this.lethal = loadoutState.lethal !== undefined ? loadoutState.lethal : 'frag_grenade';
    this.lethalQty = loadoutState.lethalQty !== undefined ? loadoutState.lethalQty : (this.lethal ? 2 : 0);
    this.tactical = loadoutState.tactical !== undefined ? loadoutState.tactical : 'smoke_grenade';
    this.tacticalQty = loadoutState.tacticalQty !== undefined ? loadoutState.tacticalQty : (this.tactical ? 2 : 0);
    this.backpackId = loadoutState.backpack || 'bag_small';
    const bagDef = GAME_DATA.ITEMS[this.backpackId];
    this.backpackMaxSlots = (bagDef && bagDef.slots) || 8;
    this.fieldUpgrade = loadoutState.fieldUpgrade || 'fu_ammo_box';
    this.fieldUpgradeCharge = 100; // starts ready (0..100%)
    this.killstreak = loadoutState.killstreak || null;
    this.selfRevive = loadoutState.selfRevive || null;
    this.selfReviveProgress = 0;
    this.headgear = loadoutState.headgear || null;
    this.cash = loadoutState.cash || 0;
    this.melee = loadoutState.melee || 'melee_knife';
    this.uavTimer = 0;
    this.deadSilenceTimer = 0;

    // Weapons (with Gunsmith attachment mods)
    const allMods = loadoutState.weaponMods || {};
    const makeSlot = (wId) => {
      if (!wId) return null;
      const mods = allMods[wId] || {};
      const eff = GAME_DATA.getEffectiveWeaponStats(wId, mods);
      return { id: wId, mods, mag: eff.magSize };
    };
    this.slots = {
      primary: makeSlot(loadoutState.primary),
      secondary: makeSlot(loadoutState.secondary)
    };
    this.activeSlot = this.slots.primary ? 'primary' : 'secondary';
    this.backpackWeapon = (bagDef && bagDef.weaponSlot && loadoutState.backpackWeapon)
      ? makeSlot(typeof loadoutState.backpackWeapon === 'string' ? loadoutState.backpackWeapon : loadoutState.backpackWeapon.id)
      : null;

    // Backpack (stores ammo, meds, and looted items during raid)
    this.maxWeight = 25.0;
    this.backpack = [];
    // Seed rig ammo into backpack
    for (const [ammoId, qty] of Object.entries(loadoutState.ammo || {})) {
      if (qty > 0) this.addToBackpack(ammoId, qty);
    }

    this.footstepTimer = 0;
    this.headBobTimer = 0;
    this.headBobY = 0;
    this.headRoll = 0;

    // 3rd-person debug camera & articulated player character model
    this.isThirdPerson = false;
    this.animCycle = 0;
    this.idleTime = 0;
    this.avatarGroup = null;
    this.avatarParts = null;
    this.tpWeapon = null;
    this._buildThirdPersonModel();

    this._equipCurrentWeapon();
  }

  _rebuildThirdPersonWeapon(weaponDef, mods) {
    if (!this.avatarParts || !this.avatarParts.weaponMount) return;
    if (this.tpWeapon && this.tpWeapon.group) {
      this.avatarParts.weaponMount.remove(this.tpWeapon.group);
    }
    this.tpWeapon = this.weaponSystem.buildThirdPersonWeapon(weaponDef, mods);
    if (this.tpWeapon && this.tpWeapon.group) {
      const s = this.tpWeapon.isPistol ? 1.25 : 1.38;
      this.tpWeapon.group.scale.setScalar(s);
      // Align pistol grip / rifle grip cleanly to right hand glove
      if (this.tpWeapon.isPistol) {
        this.tpWeapon.group.position.set(0.0, 0.04, -0.06);
      } else {
        this.tpWeapon.group.position.set(0.0, 0.04, -0.18);
      }
      this.avatarParts.weaponMount.add(this.tpWeapon.group);
    }
  }

  _buildThirdPersonModel() {
    const root = new THREE.Group();
    const rigPivot = new THREE.Group();
    root.add(rigPivot);

    const uniformMat = new THREE.MeshLambertMaterial({ color: 0x3b4237 });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2f332c });
    const vestMat = new THREE.MeshLambertMaterial({ color: 0x4b5342 });
    const gearMat = new THREE.MeshLambertMaterial({ color: 0x1e2124 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd1a483 });
    const visorMat = new THREE.MeshLambertMaterial({ color: 0x182026 });

    // Pelvis / Hips
    const pelvis = new THREE.Group();
    pelvis.position.set(0, 0.92, 0);
    const hipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.22), pantsMat);
    pelvis.add(hipMesh);
    rigPivot.add(pelvis);

    // Torso + Tactical Plate Carrier
    const torso = new THREE.Group();
    torso.position.set(0, 0.08, 0);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.48, 0.24), uniformMat);
    chest.position.set(0, 0.24, 0);
    const carrier = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.27), vestMat);
    carrier.position.set(0, 0.26, 0);
    // Front chest rig magazine pouches (3 pouches across lower chest)
    for (let i = -1; i <= 1; i++) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.14, 0.055), gearMat);
      pouch.position.set(i * 0.11, 0.18, -0.155);
      torso.add(pouch);
    }
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.12), gearMat);
    pack.position.set(0, 0.26, 0.18);
    torso.add(chest, carrier, pack);
    pelvis.add(torso);

    // Head + Helmet
    const head = new THREE.Group();
    head.position.set(0, 0.52, 0);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.22, 0.22), skinMat);
    skull.position.set(0, 0.11, 0);
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.25), gearMat);
    helmet.position.set(0, 0.18, 0);
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.06, 0.04), visorMat);
    goggles.position.set(0, 0.12, -0.11);
    head.add(skull, helmet, goggles);
    torso.add(head);

    // Articulated Legs (Hip -> Thigh -> Knee -> Shin -> Ankle + Boot)
    const makeLeg = (xOff) => {
      const hip = new THREE.Group();
      hip.position.set(xOff, -0.04, 0);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.15), pantsMat);
      thigh.position.set(0, -0.21, 0);
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.set(0, -0.42, 0);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.13), pantsMat);
      shin.position.set(0, -0.19, 0);

      const ankle = new THREE.Group();
      ankle.position.set(0, -0.38, 0);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.23), gearMat);
      boot.position.set(0, -0.035, -0.045);
      ankle.add(boot);

      knee.add(shin, ankle);
      hip.add(knee);
      pelvis.add(hip);
      return { hip, knee, ankle };
    };
    const leftLeg = makeLeg(-0.11);
    const rightLeg = makeLeg(0.11);

    // Articulated Arms (Shoulder -> Upper Arm -> Elbow -> Forearm + Glove)
    let weaponMount = null;
    let handMag = null;
    let handShell = null;
    const makeArm = (xOff, isRight = false) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(xOff, 0.43, 0);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.30, 0.12), uniformMat);
      upper.position.set(0, -0.14, 0);
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.set(0, -0.28, 0);
      const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.28, 0.10), uniformMat);
      forearm.position.set(0, -0.13, 0);
      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), gearMat);
      glove.position.set(0, -0.28, 0);
      elbow.add(forearm, glove);

      if (isRight) {
        weaponMount = new THREE.Group();
        weaponMount.position.set(0, -0.28, -0.02);
        // Forearm points along -Y; rotate -90deg around X so weapon -Z barrel points forward along forearm!
        weaponMount.rotation.x = -Math.PI / 2;
        elbow.add(weaponMount);
      } else {
        // Fresh magazine & 12ga shell props held in left glove when drawing from chest rig
        handMag = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.15, 0.065), new THREE.MeshLambertMaterial({ color: 0x4c5259 }));
        handMag.position.set(0.02, -0.32, -0.03);
        handMag.visible = false;
        handShell = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.075, 8), new THREE.MeshLambertMaterial({ color: 0xb52b2b }));
        handShell.rotation.z = Math.PI / 2;
        handShell.position.set(0.02, -0.31, -0.03);
        handShell.visible = false;
        elbow.add(handMag, handShell);
      }

      shoulder.add(elbow);
      torso.add(shoulder);
      return { shoulder, elbow };
    };
    const leftArm = makeArm(-0.26, false);
    const rightArm = makeArm(0.26, true);

    root.visible = false;
    if (this.world && this.world.scene) {
      this.world.scene.add(root);
    }
    this.avatarGroup = root;
    this.avatarParts = { rigPivot, pelvis, torso, head, leftLeg, rightLeg, leftArm, rightArm, weaponMount, handMag, handShell };
  }

  toggleThirdPerson() {
    this.isThirdPerson = !this.isThirdPerson;
    if (this.avatarGroup) this.avatarGroup.visible = this.isThirdPerson;
    if (this.weaponSystem && this.weaponSystem.setThirdPerson) {
      this.weaponSystem.setThirdPerson(this.isThirdPerson);
    }
    return this.isThirdPerson;
  }

  _updateThirdPersonModel(dt) {
    if (!this.avatarGroup || !this.avatarParts) return;
    const p = this.avatarParts;
    const smooth = (t) => t * t * (3 - 2 * t);
    const rate = Math.min(1, dt * 13);
    this.idleTime += dt;

    // Place character at player's feet position and orient to player's yaw
    const feetY = Math.max(0, this.position.y - this.currentEyeHeight);
    this.avatarGroup.position.set(this.position.x, feetY, this.position.z);
    this.avatarGroup.rotation.y = this.yaw;

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const moving = this.onGround && horizSpeed > 0.35;
    if (moving) {
      const freq = this.isSprinting ? 11.2 : (this.isProne ? 4.4 : (this.stance === 'crouch' ? 6.4 : 8.0));
      this.animCycle += dt * freq;
    }
    const stride = moving ? Math.sin(this.animCycle) : 0;
    const strideCos = moving ? Math.cos(this.animCycle) : 0;
    const breathe = Math.sin(this.idleTime * 2.1);

    // Directional strafe factor for subtle banking
    const strafeInput = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);

    // Target pose variables
    let rigPitch = 0, rigRoll = 0, rigYaw = 0, rigY = 0;
    let pelvisY = 0.90;
    let pelvisYaw = 0;
    let torsoPitch = 0, torsoYaw = 0;
    let lHipX = 0, lHipZ = 0, lKneeX = 0, lAnkX = 0;
    let rHipX = 0, rHipZ = 0, rKneeX = 0, rAnkX = 0;
    let lShX = 0.72, lElbX = 0.68, lShZ = -0.22;
    let rShX = 0.88, rElbX = 0.62, rShZ = 0.06;
    let wpnRotX = -Math.PI / 2, wpnRotY = 0, wpnRotZ = 0;
    let autoClampFeet = true;

    if (p.handMag) p.handMag.visible = false;
    if (p.handShell) p.handShell.visible = false;
    if (p.weaponMount) p.weaponMount.visible = !this.isDowned && !this.dead;

    if (this.isDowned) {
      // === DOWNED SEATED POSTURE: RECLINED BACK (+torsoPitch) ON SUPPORTING LEFT ARM, LEGS EXTENDED IN FRONT ABOVE GROUND ===
      autoClampFeet = false;
      const isScooting = !this.beingDragged && horizSpeed > 0.15;
      const cycle = isScooting ? (this.animCycle * 0.52) : 0;
      const phase = isScooting ? Math.sin(cycle) : 0;
      const heave = isScooting ? Math.pow(Math.max(0, phase), 1.35) : 0;

      if (this.beingDragged) {
        pelvisY = 0.25;
        torsoPitch = 0.58 + breathe * 0.02; // reclined back cleanly while dragged
        rigRoll = Math.sin(this.idleTime * 4.0) * 0.025;
        // Legs extended flat in front above ground (shin angle = 1.56 rad -> horizontal, zero ground clipping!)
        lHipX = 1.64; lHipZ = -0.07; lKneeX = -0.08; lAnkX = 0.20;
        rHipX = 1.64; rHipZ = 0.07;  rKneeX = -0.08; rAnkX = 0.20;
        lShX = -0.52; lElbX = 0.16; lShZ = -0.22;
        rShX = -0.52; rElbX = 0.16; rShZ = 0.22;
      } else {
        pelvisY = 0.26 + heave * 0.04;
        rigRoll = phase * 0.055;
        torsoPitch = 0.36 + heave * 0.07 + breathe * 0.025; // reclined back ~22 deg on supporting arm
        // Left knee bent slightly planting heel (lHipX + lKneeX = 1.54 rad -> horizontal shin, boots cleanly above y=0!)
        // Right leg extended out in front (rHipX + rKneeX = 1.56 rad -> horizontal shin, boots cleanly above y=0!)
        lHipX = 1.88 + heave * 0.14; lHipZ = -0.10; lKneeX = -0.34 - heave * 0.14; lAnkX = 0.22;
        rHipX = 1.70 + heave * 0.08; rHipZ = 0.10;  rKneeX = -0.14 - heave * 0.08; rAnkX = 0.18;
        // Supporting left arm planted behind/beside hip pushing torso along the ground
        lShX = -0.74 - phase * 0.26; lElbX = 0.14 + heave * 0.20; lShZ = -0.28;
        // Right arm bent cleanly across injured chest/abdomen (empty hand, weapon hidden)
        rShX = 0.50; rElbX = 1.42; rShZ = -0.45;
      }
    } else if (this.isSliding) {
      // === LOW, FOCUSED COMBAT SLIDE: SKIMMING GROUND, LEAD LEG FLAT OUT, TRAILING KNEE TUCKED HORIZONTALLY, ARMS LOW STABILIZING GUN ===
      autoClampFeet = false;
      const sp = THREE.MathUtils.clamp(1 - (this.slideTimer / this.slideDuration), 0, 1);
      const entry = sp < 0.16 ? smooth(sp / 0.16) : (sp > 0.78 ? 1 - smooth((sp - 0.78) / 0.22) : 1);
      const vib = (sp > 0.16 && sp < 0.78) ? Math.sin(sp * 36) * 0.006 : 0;

      // Low, grounded hips (~0.30m) so knee/boot stay cleanly above y=0 with zero clipping
      pelvisY = THREE.MathUtils.lerp(0.66, 0.30, entry) + vib;
      rigYaw = 0.20 * entry;
      rigRoll = -0.06 * entry;
      torsoPitch = 0.20 * entry;  // compact, aggressive low recline
      torsoYaw = -0.20 * entry;   // shoulders locked straight forward on target

      // Lead LEFT leg extended straight & low along the ground in front (ankleY ≈ 0.20m)
      lHipX = THREE.MathUtils.lerp(0.75, 1.52, entry);
      lHipZ = -0.10 * entry;
      lKneeX = THREE.MathUtils.lerp(-0.90, -0.04, entry);
      lAnkX = THREE.MathUtils.lerp(0.20, 0.15, entry);

      // Trailing RIGHT knee tucked flat under/beside body with horizontal shin (kneeY ≈ 0.18m, ankleY ≈ 0.18m -> ZERO clipping!)
      rHipX = THREE.MathUtils.lerp(0.65, 1.28, entry);
      rHipZ = 0.85 * entry;
      rKneeX = THREE.MathUtils.lerp(-1.10, -2.85, entry);
      rAnkX = THREE.MathUtils.lerp(0.30, 0.50, entry);

      // Arms tucked LOW & INWARD stabilizing the weapon straight forward (never up in the air!)
      lShX = 0.24; lElbX = 0.88; lShZ = 0.32;
      rShX = 0.30; rElbX = 0.86; rShZ = -0.10;
      wpnRotX = -Math.PI / 2 + 0.12 * entry;
      wpnRotY = 0.10 * entry;
      wpnRotZ = -0.12 * entry;
    } else if (this.isProne) {
      // === PRONE & CRAWL (Boots pointed back along ground -> zero toe clipping!) ===
      autoClampFeet = false;
      rigPitch = -1.44;
      rigY = 0.28;
      pelvisY = 0.90;
      torsoPitch = 0.16 + breathe * 0.015;
      lHipX = -0.06 - Math.max(0, stride) * 0.18;  lKneeX = -0.10 - Math.max(0, -stride) * 0.22; lAnkX = 0.65;
      rHipX = -0.06 - Math.max(0, -stride) * 0.18; rKneeX = -0.10 - Math.max(0, stride) * 0.22;  rAnkX = 0.65;
      lShX = 1.38 + stride * 0.28; lElbX = 0.75; lShZ = -0.24;
      rShX = 1.48 - stride * 0.28; rElbX = 0.62; rShZ = 0.12;
    } else if (!this.onGround) {
      // === AIRBORNE / JUMP ===
      autoClampFeet = false;
      pelvisY = 0.96;
      torsoPitch = -0.12;
      lHipX = 0.42; lKneeX = -0.78; lAnkX = 0.20;
      rHipX = 0.18; rKneeX = -0.45; rAnkX = 0.15;
      lShX = 0.78; lElbX = 0.72;
      rShX = 0.92; rElbX = 0.62;
    } else if (this.stance === 'crouch') {
      // === CROUCH & CROUCH-WALK (AUTO-CLAMPED FEET -> ZERO GROUND CLIPPING) ===
      const crouchStride = stride * 0.42;
      lHipX = 0.86 + crouchStride;
      lKneeX = -1.32 - Math.max(0, -strideCos) * 0.24;
      lAnkX = -(lHipX + lKneeX) * 0.75; // keep boots flat on ground!

      rHipX = 0.86 - crouchStride;
      rKneeX = -1.32 - Math.max(0, strideCos) * 0.24;
      rAnkX = -(rHipX + rKneeX) * 0.75;

      pelvisY = 0.68; // ground clamp below lifts smoothly to exact foot contact!
      pelvisYaw = stride * 0.10;
      torsoYaw = -stride * 0.08;
      torsoPitch = -0.22 + breathe * 0.015;
      rigRoll = -strafeInput * 0.05;

      lShX = 0.86; lElbX = 0.72; lShZ = -0.24;
      rShX = 0.96; rElbX = 0.62; rShZ = 0.06;
    } else {
      // === STANDING / WALKING / SPRINTING ===
      const amp = this.isSprinting ? 0.78 : 0.46;
      lHipX = stride * amp;
      rHipX = -stride * amp;
      lKneeX = -Math.max(0, -strideCos) * (this.isSprinting ? 1.15 : 0.62) - 0.06;
      rKneeX = -Math.max(0, strideCos) * (this.isSprinting ? 1.15 : 0.62) - 0.06;
      lAnkX = -(lHipX + lKneeX) * 0.55;
      rAnkX = -(rHipX + rKneeX) * 0.55;

      pelvisY = 0.90;
      pelvisYaw = stride * (this.isSprinting ? 0.16 : 0.08);
      torsoYaw = -pelvisYaw * 0.85;
      torsoPitch = (this.isSprinting ? -0.24 : -0.04) + breathe * 0.012;
      rigRoll = -strafeInput * (this.isSprinting ? 0.08 : 0.04);

      if (this.isTacSprinting) {
        // One-handed high-port Tactical Sprint: right hand holds gun UP in air, left fist pumps independently apart!
        lShX = 0.25 - stride * 0.78; lElbX = 1.28; lShZ = -0.14;
        rShX = 0.92 + stride * 0.16; rElbX = 1.18; rShZ = 0.10;
        wpnRotX = -Math.PI / 2 + 0.42;
        wpnRotY = 0.12;
        wpnRotZ = -0.12;
      } else if (this.isSprinting) {
        // Standard tactical sprint weapon carry
        lShX = 0.62 - stride * 0.18; lElbX = 0.92; lShZ = -0.32;
        rShX = 0.55 + stride * 0.18; rElbX = 0.95; rShZ = 0.15;
        wpnRotY = 0.42;
        wpnRotZ = -0.18;
      } else {
        lShX = 0.74 + breathe * 0.015; lElbX = 0.70; lShZ = -0.24;
        rShX = 0.88 + breathe * 0.015; rElbX = 0.60; rShZ = 0.06;
      }
    }

    // Exact Foot-Contact Ground Clamping (prevents boots from ever clipping into the ground!)
    if (autoClampFeet) {
      const footDrop = (hX, kX) => 0.04 + 0.42 * Math.cos(hX) + 0.45 * Math.cos(hX + kX);
      const maxDrop = Math.max(footDrop(lHipX, lKneeX), footDrop(rHipX, rKneeX));
      pelvisY = Math.max(0.45, maxDrop + 0.008);
    }

    // === ACCURATELY REFLECT 1ST-PERSON WEAPON RELOADS, PLATING, MEDKIT & RECOIL ===
    const ws = this.weaponSystem;
    if (ws) {
      // Reset 3rd-person weapon mag & bolt to rest before applying live animation offsets
      if (this.tpWeapon) {
        if (this.tpWeapon.magMesh) {
          this.tpWeapon.magMesh.visible = true;
          this.tpWeapon.magMesh.position.copy(this.tpWeapon.magRestPos);
          this.tpWeapon.magMesh.rotation.copy(this.tpWeapon.magRestRot);
        }
        if (this.tpWeapon.spareMagMesh) {
          this.tpWeapon.spareMagMesh.visible = false;
        }
        if (this.tpWeapon.boltMesh) {
          this.tpWeapon.boltMesh.position.copy(this.tpWeapon.boltRestPos);
          this.tpWeapon.boltMesh.rotation.copy(this.tpWeapon.boltRestRot);
          // Mirror live blowback recoil / M870 pump on 3rd-person weapon
          if (!ws.isReloading) {
            let pumpOff = 0;
            if (this.tpWeapon.weaponId === 'm870' && ws.pumpTimer > 0) {
              const pt = 1 - (ws.pumpTimer / ws.pumpDuration);
              pumpOff = (pt < 0.48 ? smooth(pt / 0.48) : 1 - smooth((pt - 0.48) / 0.52)) * 0.088;
              lShX -= pumpOff * 2.2;
            }
            this.tpWeapon.boltMesh.position.z = this.tpWeapon.boltRestPos.z + (this.tpWeapon.weaponId === 'm870' ? pumpOff : ws.boltKick);
          }
        }
        // Subtle recoil pitch on 3rd-person weapon
        wpnRotX += ws.recoilOffset * 2.4;
      }

      if (ws.isPlating) {
        // Left hand reaches to chest carrier; right hand lowers rifle
        lShX = 1.05; lElbX = 1.32; lShZ = -0.45;
        rShX = 0.35; rElbX = 0.52; rShZ = 0.14;
      } else if (ws.isHealing) {
        // Both hands in front of chest operating Field Medkit
        lShX = 0.95; lElbX = 1.22; lShZ = -0.35;
        rShX = 0.95; rElbX = 1.22; rShZ = 0.35;
      } else if (ws.isReloading && this.tpWeapon) {
        const rp = THREE.MathUtils.clamp(1 - (ws.reloadTimer / ws.reloadDuration), 0, 1);
        const wId = ws.reloadWeaponId;
        const tp = this.tpWeapon;

        // Reusable chest-rig pouch reach pose for left arm (reaches right onto the chest mag pouches!)
        const chestShX = 0.58, chestElbX = 1.58, chestShZ = -0.62;

        // Cant weapon slightly inward so reload is clearly visible in 3rd person
        rShX = 0.98; rElbX = 0.78;
        wpnRotY = 0.34;
        wpnRotZ = 0.28;

        if (wId === 'pm9' || wId === 'g17') {
          // Pistol reload: eject old mag -> reach to chest rig for fresh mag -> insert -> slingshot slide on empty
          const magEnd = ws.wasEmptyReload ? 0.74 : 1.0;
          if (rp < magEnd) {
            const mp = rp / magEnd;
            if (mp < 0.24) {
              // Eject old mag downward while left hand moves to chest rig
              const t = smooth(mp / 0.24);
              if (tp.magMesh) tp.magMesh.position.y = tp.magRestPos.y - t * 0.24;
              lShX = THREE.MathUtils.lerp(0.75, chestShX, t);
              lElbX = THREE.MathUtils.lerp(0.70, chestElbX, t);
              lShZ = THREE.MathUtils.lerp(-0.24, chestShZ, t);
            } else if (mp < 0.46) {
              // Grab fresh mag from chest rig pouch!
              if (tp.magMesh) tp.magMesh.visible = false;
              if (p.handMag) p.handMag.visible = mp > 0.32;
              lShX = chestShX; lElbX = chestElbX; lShZ = chestShZ;
            } else {
              // Bring fresh mag from chest rig up into pistol grip!
              const t = smooth(Math.min(1, (mp - 0.46) / 0.42));
              if (p.handMag) p.handMag.visible = t < 0.78;
              if (tp.magMesh) {
                tp.magMesh.visible = t >= 0.78;
                tp.magMesh.position.y = tp.magRestPos.y - Math.max(0, 1 - t) * 0.14;
              }
              lShX = THREE.MathUtils.lerp(chestShX, 0.96, t);
              lElbX = THREE.MathUtils.lerp(chestElbX, 0.92, t);
              lShZ = THREE.MathUtils.lerp(chestShZ, -0.32, t);
            }
          } else {
            // Slingshot slide rack
            const sp = (rp - magEnd) / (1 - magEnd);
            const pull = sp < 0.5 ? smooth(sp / 0.5) : 1 - smooth((sp - 0.5) / 0.5);
            if (tp.boltMesh) tp.boltMesh.position.z = tp.boltRestPos.z + pull * 0.055;
            lShX = 1.06 - pull * 0.18; lElbX = 1.04; lShZ = -0.36;
          }
        } else if (wId === 'ak74m') {
          // AK-74M: grab fresh mag from chest rig -> flick old mag out with new mag -> rock new mag in -> right-hand bolt rack!
          const magEnd = ws.wasEmptyReload ? 0.74 : 1.0;
          if (rp < magEnd) {
            const mp = rp / magEnd;
            if (mp < 0.24) {
              // Reach to chest rig & pull fresh AK mag
              const t = smooth(mp / 0.24);
              if (p.handMag) p.handMag.visible = mp > 0.14;
              lShX = THREE.MathUtils.lerp(0.75, chestShX, t);
              lElbX = THREE.MathUtils.lerp(0.70, chestElbX, t);
              lShZ = THREE.MathUtils.lerp(-0.24, chestShZ, t);
            } else if (mp < 0.42) {
              // Bring fresh mag from chest rig up behind the seated old mag
              const t = smooth((mp - 0.24) / 0.18);
              if (p.handMag) p.handMag.visible = true;
              lShX = THREE.MathUtils.lerp(chestShX, 0.94, t);
              lElbX = THREE.MathUtils.lerp(chestElbX, 0.98, t);
              lShZ = THREE.MathUtils.lerp(chestShZ, -0.34, t);
            } else if (mp < 0.60) {
              // FLICK the old mag forward & tumbling out using the fresh mag!
              const t = smooth((mp - 0.42) / 0.18);
              if (p.handMag) p.handMag.visible = true;
              if (tp.magMesh) {
                tp.magMesh.visible = t < 0.90;
                tp.magMesh.position.set(tp.magRestPos.x, tp.magRestPos.y - t * 0.28, tp.magRestPos.z - t * 0.28);
                tp.magMesh.rotation.x = tp.magRestRot.x - t * 1.6;
              }
              lShX = 0.94 + Math.sin(t * Math.PI) * 0.18;
              lElbX = 0.98 - Math.sin(t * Math.PI) * 0.14;
              lShZ = -0.34;
            } else {
              // Rock fresh mag up into the AK receiver
              const t = smooth(Math.min(1, (mp - 0.60) / 0.30));
              if (p.handMag) p.handMag.visible = t < 0.65;
              if (tp.magMesh) {
                tp.magMesh.visible = t >= 0.65;
                tp.magMesh.position.y = tp.magRestPos.y - (1 - t) * 0.10;
                tp.magMesh.rotation.x = tp.magRestRot.x + (1 - t) * 0.42;
              }
              lShX = 0.96; lElbX = 0.96; lShZ = -0.32;
            }
          } else {
            // Right hand racks AK right-side charging handle while left hand holds handguard
            const sp = (rp - magEnd) / (1 - magEnd);
            const pull = sp < 0.5 ? smooth(sp / 0.5) : 1 - smooth((sp - 0.5) / 0.5);
            if (tp.boltMesh) tp.boltMesh.position.z = tp.boltRestPos.z + pull * 0.075;
            rShX = 0.98 - pull * 0.18; rElbX = 0.85 + pull * 0.28;
            lShX = 0.85; lElbX = 0.78;
          }
        } else if (wId === 'm870') {
          // M870: pull red 12ga shell from chest rig loops -> feed into bottom port (per shell) -> pump on empty
          const pumpFrac = ws.wasEmptyReload ? 0.22 : 0;
          const loadEnd = 1 - pumpFrac;
          if (rp < loadEnd) {
            const sf = (rp / loadEnd) * Math.max(1, ws.reloadShellCount);
            const st = sf - Math.floor(sf);
            wpnRotZ = 0.58; // cant shotgun to expose bottom loading port
            if (st < 0.42) {
              // Reach to chest rig & pick shell
              const t = smooth(st / 0.42);
              if (p.handShell) p.handShell.visible = st > 0.20;
              lShX = THREE.MathUtils.lerp(0.92, chestShX, t);
              lElbX = THREE.MathUtils.lerp(0.98, chestElbX, t);
              lShZ = THREE.MathUtils.lerp(-0.32, chestShZ, t);
            } else {
              // Bring shell up from chest rig & shove into tube
              const t = smooth((st - 0.42) / 0.58);
              if (p.handShell) p.handShell.visible = t < 0.78;
              lShX = THREE.MathUtils.lerp(chestShX, 0.96, t);
              lElbX = THREE.MathUtils.lerp(chestElbX, 1.02, t);
              lShZ = THREE.MathUtils.lerp(chestShZ, -0.32, t);
            }
          } else {
            const sp = (rp - loadEnd) / pumpFrac;
            const pull = sp < 0.5 ? smooth(sp / 0.5) : 1 - smooth((sp - 0.5) / 0.5);
            if (tp.boltMesh) tp.boltMesh.position.z = tp.boltRestPos.z + pull * 0.088;
            lShX = 0.88 - pull * 0.24; lElbX = 0.78 + pull * 0.24;
          }
        } else if (wId === 'mp5k') {
          // MP5-K: lock bolt back (if empty) -> strip old mag -> grab fresh mag from chest rig -> seat -> H&K SLAP!
          const lockEnd = ws.wasEmptyReload ? 0.16 : 0.0;
          const magEnd = ws.wasEmptyReload ? 0.78 : 1.0;
          if (rp < lockEnd) {
            const t = smooth(rp / lockEnd);
            if (tp.boltMesh) tp.boltMesh.position.z = tp.boltRestPos.z + t * 0.065;
            lShX = 1.04 - t * 0.14; lElbX = 0.86; lShZ = -0.36;
          } else if (rp < magEnd) {
            if (ws.wasEmptyReload && tp.boltMesh) tp.boltMesh.position.z = tp.boltRestPos.z + 0.065;
            const mp = (rp - lockEnd) / (magEnd - lockEnd);
            if (mp < 0.28) {
              // Strip old mag out & drop
              const t = smooth(mp / 0.28);
              if (tp.magMesh) tp.magMesh.position.y = tp.magRestPos.y - t * 0.24;
              lShX = THREE.MathUtils.lerp(0.95, chestShX, t);
              lElbX = THREE.MathUtils.lerp(0.92, chestElbX, t);
              lShZ = THREE.MathUtils.lerp(-0.32, chestShZ, t);
            } else if (mp < 0.52) {
              // Grab fresh MP5 mag from chest rig!
              if (tp.magMesh) tp.magMesh.visible = false;
              if (p.handMag) p.handMag.visible = mp > 0.36;
              lShX = chestShX; lElbX = chestElbX; lShZ = chestShZ;
            } else {
              // Seat fresh mag from chest rig up into MP5 magwell
              const t = smooth(Math.min(1, (mp - 0.52) / 0.38));
              if (p.handMag) p.handMag.visible = t < 0.76;
              if (tp.magMesh) {
                tp.magMesh.visible = t >= 0.76;
                tp.magMesh.position.y = tp.magRestPos.y - Math.max(0, 1 - t) * 0.16;
              }
              lShX = THREE.MathUtils.lerp(chestShX, 0.96, t);
              lElbX = THREE.MathUtils.lerp(chestElbX, 0.96, t);
              lShZ = THREE.MathUtils.lerp(chestShZ, -0.32, t);
            }
          } else {
            // Iconic H&K Slap!
            const sp = (rp - magEnd) / (1 - magEnd);
            const slap = sp < 0.42 ? smooth(sp / 0.42) : 1 - smooth((sp - 0.42) / 0.58);
            if (tp.boltMesh) tp.boltMesh.position.z = tp.boltRestPos.z + (sp < 0.52 ? 0.065 : 0);
            lShX = 1.12; lElbX = 0.98 - slap * 0.42; lShZ = -0.40;
          }
        } else {
          // M24 Marksman: drop box mag -> grab fresh mag from chest rig -> seat -> right-hand bolt cycle!
          const magEnd = ws.wasEmptyReload ? 0.74 : 1.0;
          if (rp < magEnd) {
            const mp = rp / magEnd;
            if (mp < 0.28) {
              const t = smooth(mp / 0.28);
              if (tp.magMesh) tp.magMesh.position.y = tp.magRestPos.y - t * 0.24;
              lShX = THREE.MathUtils.lerp(0.95, chestShX, t);
              lElbX = THREE.MathUtils.lerp(0.90, chestElbX, t);
              lShZ = THREE.MathUtils.lerp(-0.30, chestShZ, t);
            } else if (mp < 0.52) {
              if (tp.magMesh) tp.magMesh.visible = false;
              if (p.handMag) p.handMag.visible = mp > 0.36;
              lShX = chestShX; lElbX = chestElbX; lShZ = chestShZ;
            } else {
              const t = smooth(Math.min(1, (mp - 0.52) / 0.38));
              if (p.handMag) p.handMag.visible = t < 0.76;
              if (tp.magMesh) {
                tp.magMesh.visible = t >= 0.76;
                tp.magMesh.position.y = tp.magRestPos.y - Math.max(0, 1 - t) * 0.16;
              }
              lShX = THREE.MathUtils.lerp(chestShX, 0.96, t);
              lElbX = THREE.MathUtils.lerp(chestElbX, 0.95, t);
              lShZ = THREE.MathUtils.lerp(chestShZ, -0.32, t);
            }
          } else {
            // Right hand lifts & cycles bolt handle
            const sp = (rp - magEnd) / (1 - magEnd);
            const pull = sp < 0.5 ? smooth(sp / 0.5) : 1 - smooth((sp - 0.5) / 0.5);
            if (tp.boltMesh) {
              tp.boltMesh.position.z = tp.boltRestPos.z + pull * 0.07;
              tp.boltMesh.rotation.z = tp.boltRestRot.z + pull * 0.9;
            }
            rShX = 0.98 - pull * 0.20; rElbX = 0.82 + pull * 0.28;
          }
        }
      }
    }

    // Smoothly interpolate all character joints
    p.rigPivot.rotation.x = THREE.MathUtils.lerp(p.rigPivot.rotation.x, rigPitch, rate);
    p.rigPivot.rotation.y = THREE.MathUtils.lerp(p.rigPivot.rotation.y, rigYaw, rate);
    p.rigPivot.rotation.z = THREE.MathUtils.lerp(p.rigPivot.rotation.z, rigRoll, rate);
    p.rigPivot.position.y = THREE.MathUtils.lerp(p.rigPivot.position.y, rigY, rate);

    p.pelvis.position.y = THREE.MathUtils.lerp(p.pelvis.position.y, pelvisY, rate);
    p.pelvis.rotation.y = THREE.MathUtils.lerp(p.pelvis.rotation.y, pelvisYaw, rate);
    p.torso.rotation.x = THREE.MathUtils.lerp(p.torso.rotation.x, torsoPitch, rate);
    p.torso.rotation.y = THREE.MathUtils.lerp(p.torso.rotation.y, torsoYaw, rate);
    p.torso.rotation.z = THREE.MathUtils.lerp(p.torso.rotation.z, -this.lean * 0.32, rate);

    const headPitch = this.isDowned
      ? (-torsoPitch + this.pitch * 0.65)
      : (this.isProne
        ? (1.15 + this.pitch * 0.4)
        : (this.isSliding ? (-torsoPitch + this.pitch * 0.65) : (this.pitch * 0.65)));
    p.head.rotation.x = THREE.MathUtils.lerp(p.head.rotation.x, headPitch, rate);

    p.leftLeg.hip.rotation.x = THREE.MathUtils.lerp(p.leftLeg.hip.rotation.x, lHipX, rate);
    p.leftLeg.hip.rotation.z = THREE.MathUtils.lerp(p.leftLeg.hip.rotation.z, lHipZ, rate);
    p.leftLeg.knee.rotation.x = THREE.MathUtils.lerp(p.leftLeg.knee.rotation.x, lKneeX, rate);
    p.leftLeg.ankle.rotation.x = THREE.MathUtils.lerp(p.leftLeg.ankle.rotation.x, lAnkX, rate);
    p.rightLeg.hip.rotation.x = THREE.MathUtils.lerp(p.rightLeg.hip.rotation.x, rHipX, rate);
    p.rightLeg.hip.rotation.z = THREE.MathUtils.lerp(p.rightLeg.hip.rotation.z, rHipZ, rate);
    p.rightLeg.knee.rotation.x = THREE.MathUtils.lerp(p.rightLeg.knee.rotation.x, rKneeX, rate);
    p.rightLeg.ankle.rotation.x = THREE.MathUtils.lerp(p.rightLeg.ankle.rotation.x, rAnkX, rate);

    p.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(p.leftArm.shoulder.rotation.x, lShX, rate);
    p.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(p.leftArm.shoulder.rotation.z, lShZ, rate);
    p.leftArm.elbow.rotation.x = THREE.MathUtils.lerp(p.leftArm.elbow.rotation.x, lElbX, rate);

    p.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(p.rightArm.shoulder.rotation.x, rShX, rate);
    p.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(p.rightArm.shoulder.rotation.z, rShZ, rate);
    p.rightArm.elbow.rotation.x = THREE.MathUtils.lerp(p.rightArm.elbow.rotation.x, rElbX, rate);

    if (p.weaponMount) {
      p.weaponMount.rotation.x = THREE.MathUtils.lerp(p.weaponMount.rotation.x, wpnRotX, rate);
      p.weaponMount.rotation.y = THREE.MathUtils.lerp(p.weaponMount.rotation.y, wpnRotY, rate);
      p.weaponMount.rotation.z = THREE.MathUtils.lerp(p.weaponMount.rotation.z, wpnRotZ, rate);
    }
  }

  _equipCurrentWeapon() {
    this.weaponSystem.cancelReload();
    this.weaponSystem.cancelInspect();
    this.weaponSystem.cancelPlating();
    this.weaponSystem.cancelMedkit();
    if (this.activeSlot === 'melee') {
      const mDef = GAME_DATA.ITEMS[this.melee || 'melee_knife'];
      this.weaponSystem.buildMeleeViewmodel(mDef);
      return;
    }
    const slotObj = this.getActiveWeaponSlot();
    if (slotObj) {
      this.weaponSystem.isMeleeMode = false;
      const def = GAME_DATA.ITEMS[slotObj.id];
      this.weaponSystem.buildViewmodel(def, slotObj.mods, true);
      this._rebuildThirdPersonWeapon(def, slotObj.mods);
    }
  }

  startInspect() {
    if (this.isDowned || this.dead) return;
    const def = this.getActiveWeaponDef();
    if (def) this.weaponSystem.startInspect(def);
  }

  getActiveWeaponSlot() {
    if (this.activeSlot === 'melee') return null;
    return this.slots[this.activeSlot];
  }

  getActiveWeaponDef() {
    const s = this.getActiveWeaponSlot();
    return s ? GAME_DATA.getEffectiveWeaponStats(s.id, s.mods) : null;
  }

  switchSlot(slotName) {
    if (this.isDowned || this.dead) return;
    if (slotName === 'melee') {
      if (this.activeSlot === 'melee') return;
      this.activeSlot = 'melee';
      this._equipCurrentWeapon();
      if (this.weaponSystem && this.weaponSystem.startDraw) {
        this.weaponSystem.startDraw('undersling_up');
      }
      return;
    }
    if (slotName === this.activeSlot || !this.slots[slotName]) return;
    this.activeSlot = slotName;
    this._equipCurrentWeapon();
    if (this.weaponSystem && this.weaponSystem.startDraw) {
      // Primary pulls down from over-the-shoulder sling; Secondary pulls up from underneath sling
      this.weaponSystem.startDraw(slotName === 'primary' ? 'shoulder_down' : 'undersling_up');
    }
  }

  hasWeaponBackpack() {
    const def = this.backpackId && GAME_DATA.ITEMS[this.backpackId];
    return !!(def && def.weaponSlot);
  }

  equipWeaponInRaid(weaponId, preferredSlot = null, extra = {}) {
    const def = GAME_DATA.ITEMS[weaponId];
    if (!def || def.type !== 'weapon') return { equipped: false, prevId: null, prevSlotObj: null, slot: null };

    let targetSlot = preferredSlot;
    if (!targetSlot) {
      if (def.slot && !this.slots[def.slot]) targetSlot = def.slot;
      else if (!this.slots.primary) targetSlot = 'primary';
      else if (!this.slots.secondary) targetSlot = 'secondary';
      else targetSlot = def.slot || this.activeSlot || 'primary';
    }

    const mods = extra.mods || {};
    const eff = GAME_DATA.getEffectiveWeaponStats(weaponId, mods);
    const mag = extra.mag !== undefined ? extra.mag : (eff ? eff.magSize : (def.magSize || 30));

    if (targetSlot === 'backpackWeapon') {
      if (!this.hasWeaponBackpack()) {
        return { equipped: false, prevId: null, prevSlotObj: null, slot: null };
      }
      const prevSlotObj = this.backpackWeapon;
      const prevId = prevSlotObj ? prevSlotObj.id : null;
      this.backpackWeapon = { id: weaponId, mods, mag };
      return { equipped: true, prevId, prevSlotObj, slot: 'backpackWeapon' };
    }

    const prevSlotObj = this.slots[targetSlot];
    const prevId = prevSlotObj ? prevSlotObj.id : null;
    this.slots[targetSlot] = { id: weaponId, mods, mag };

    if (!this.activeSlot || this.activeSlot === targetSlot || !this.slots[this.activeSlot]) {
      this.activeSlot = targetSlot;
      this._equipCurrentWeapon();
    }
    return { equipped: true, prevId, prevSlotObj, slot: targetSlot };
  }

  getReserveAmmo(ammoId) {
    if (window.DEV_MODE) return 999;
    let total = 0;
    for (const item of this.backpack) {
      if (item.id === ammoId) total += item.qty;
    }
    return total;
  }

  consumeReserveAmmo(ammoId, needed) {
    if (window.DEV_MODE) return needed;
    let taken = 0;
    for (let i = this.backpack.length - 1; i >= 0 && taken < needed; i--) {
      if (this.backpack[i].id === ammoId) {
        const take = Math.min(needed - taken, this.backpack[i].qty);
        this.backpack[i].qty -= take;
        taken += take;
        if (this.backpack[i].qty <= 0) {
          this.backpack.splice(i, 1);
        }
      }
    }
    return taken;
  }

  startReload() {
    if (this.isDowned || this.dead) return;
    const slotObj = this.getActiveWeaponSlot();
    const def = this.getActiveWeaponDef();
    if (!slotObj || !def) return;
    if (slotObj.mag >= def.magSize) return;
    const reserve = this.getReserveAmmo(def.ammoType);
    if (reserve <= 0) return;
    const shellsToLoad = Math.min(def.magSize - slotObj.mag, reserve);
    this.weaponSystem.startReload(def, slotObj.mag === 0, shellsToLoad);
  }

  loadSingleShell() {
    const slotObj = this.getActiveWeaponSlot();
    const def = this.getActiveWeaponDef();
    if (!slotObj || !def) return;
    if (slotObj.mag >= def.magSize) return;
    const loaded = this.consumeReserveAmmo(def.ammoType, 1);
    slotObj.mag += loaded;
  }

  finishReload() {
    const slotObj = this.getActiveWeaponSlot();
    const def = this.getActiveWeaponDef();
    if (!slotObj || !def) return;
    if (def.id === 'm870') return; // Shells are loaded live one-by-one during animation
    const needed = def.magSize - slotObj.mag;
    const loaded = this.consumeReserveAmmo(def.ammoType, needed);
    slotObj.mag += loaded;
  }

  startPlating() {
    if (this.isDowned || this.dead) return false;
    if (this.maxArmor <= 0) return false;
    if (!window.DEV_MODE && (this.armor >= this.maxArmor || this.plates <= 0)) return false;
    const needed = Math.max(window.DEV_MODE ? 1 : 0, Math.ceil((this.maxArmor - this.armor) / 50));
    const avail = window.DEV_MODE ? needed : Math.min(needed, this.plates);
    if (avail <= 0) return false;
    return this.weaponSystem.startPlating(avail);
  }

  insertSinglePlate() {
    if (this.armor >= this.maxArmor) return;
    if (!window.DEV_MODE) {
      if (this.plates <= 0) return;
      this.plates -= 1;
    }
    this.armor = Math.min(this.maxArmor, this.armor + 50);
  }

  getMedkitCount() {
    let total = 0;
    for (const item of this.backpack) {
      if (item && item.id === 'medkit') total += item.qty;
    }
    return total;
  }

  consumeMedkit() {
    const idx = this.backpack.findIndex(item => item && item.id === 'medkit' && item.qty > 0);
    if (idx === -1) return false;
    this.backpack[idx].qty -= 1;
    if (this.backpack[idx].qty <= 0) this.backpack.splice(idx, 1);
    return true;
  }

  startMedkit() {
    if (this.isDowned || this.dead) return false;
    if (!window.DEV_MODE && (this.getMedkitCount() <= 0 || this.hp >= this.maxHp)) return false;
    return this.weaponSystem.startMedkit();
  }

  finishMedkit() {
    if (!window.DEV_MODE) {
      if (!this.consumeMedkit()) return false;
    }
    this.hp = Math.min(this.maxHp, this.hp + GAME_DATA.ITEMS.medkit.healAmount);
    window.soundEngine.playHeal();
    return true;
  }

  useMedkit() {
    return this.startMedkit();
  }

  takeDamage(amount, attackerInfo = null) {
    if (this.dead) return null;
    if (this.isDowned) {
      if (attackerInfo) this.downedBy = attackerInfo;
      if (!window.DEV_MODE) {
        this.downedHp -= amount;
      }
      window.soundEngine.playDamage();
      if (!window.DEV_MODE && this.downedHp <= 0) {
        this.dead = true;
        this.isDowned = false;
        this.hp = 0;
        return 'eliminated';
      }
      return null;
    }

    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, Math.round(amount * 0.80));
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.hp = Math.max(window.DEV_MODE ? 1 : 0, this.hp - amount);
    window.soundEngine.playDamage();
    if (!window.DEV_MODE && this.hp <= 0) {
      this.isDowned = true;
      this.downedHp = 55;
      this.downedBleedTimer = this.downedBleedMax;
      this.downedBy = attackerInfo || { name: 'HOSTILE', weaponId: 'ak74m', weaponName: 'AK-74M' };
      this.reviveProgress = 0;
      this.stance = 'prone';
      this.isSliding = false;
      this.isFiring = false;
      this.isADS = false;
      if (this.weaponSystem) {
        this.weaponSystem.cancelReload();
        this.weaponSystem.cancelPlating();
        this.weaponSystem.cancelMedkit();
        this.weaponSystem.cancelInspect();
        this.weaponSystem.viewmodelGroup.visible = false;
      }
      return 'downed';
    }
    return null;
  }

  revive(hpAmount = 45) {
    this.isDowned = false;
    this.dead = false;
    this._justBledOut = false;
    this.hp = Math.min(this.maxHp, hpAmount);
    this.downedHp = 55;
    this.downedBleedTimer = this.downedBleedMax;
    this.reviveProgress = 0;
    this.beingRevivedBy = null;
    this.beingDragged = false;
    this.stance = 'crouch';
    if (window.soundEngine && window.soundEngine.playHeal) {
      try { window.soundEngine.playHeal(); } catch (e) {}
    }
  }

  dragToward(tx, tz, speed, dt) {
    const dx = tx - this.position.x;
    const dz = tz - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.25) return false;
    const step = Math.min(dist, speed * dt);
    const nx = this.position.x + (dx / dist) * step;
    const nz = this.position.z + (dz / dist) * step;
    if (!this._collidesAt(nx, this.position.y, this.position.z)) this.position.x = nx;
    if (!this._collidesAt(this.position.x, this.position.y, nz)) this.position.z = nz;
    return true;
  }

  applyRecoil(pitchKick, yawKick) {
    this.pitch = Math.min(Math.PI / 2 - 0.08, this.pitch + pitchKick);
    this.yaw += yawKick;
  }

  getBackpackWeight() {
    let w = 0;
    for (const item of this.backpack) {
      const def = GAME_DATA.ITEMS[item.id];
      if (def) w += def.weight * item.qty;
    }
    return Math.round(w * 10) / 10;
  }

  getBackpackValue() {
    let val = 0;
    if (this.backpackWeapon && GAME_DATA.ITEMS[this.backpackWeapon.id]) {
      val += GAME_DATA.ITEMS[this.backpackWeapon.id].value;
    }
    for (const item of this.backpack) {
      const def = GAME_DATA.ITEMS[item.id];
      if (def) val += def.value * item.qty;
    }
    return val;
  }

  addToBackpack(id, qty = 1, extra = {}) {
    const def = GAME_DATA.ITEMS[id];
    if (!def || qty <= 0) return false;

    // Weapons can ONLY be looted into a backpack if a Weapon Backpack is equipped and its dedicated double-wide weapon slot is available!
    if (def.type === 'weapon') {
      if (!this.hasWeaponBackpack() || this.backpackWeapon) return false;
      const mods = extra.mods || {};
      const eff = GAME_DATA.getEffectiveWeaponStats(id, mods);
      this.backpackWeapon = {
        id,
        mods,
        mag: extra.mag !== undefined ? extra.mag : (eff ? eff.magSize : (def.magSize || 30))
      };
      return true;
    }

    const maxSlots = this.backpackMaxSlots || 8;

    if (id === 'armor_plate' && !extra.forceBag) {
      if (this.plates < 6) {
        const room = Math.min(qty, 6 - this.plates);
        this.plates += room;
        qty -= room;
        if (qty <= 0) return true;
      }
    }

    if (def.stackable) {
      const maxStack = def.maxStack || 999;
      let rem = qty;
      // First check if existing stacks + available empty slots can fit at least some items
      let capacity = 0;
      for (const existing of this.backpack) {
        if (existing.id === id && existing.qty < maxStack) {
          capacity += (maxStack - existing.qty);
        }
      }
      const freeSlots = Math.max(0, maxSlots - this.backpack.length);
      capacity += freeSlots * maxStack;
      if (capacity <= 0) return false;

      // Fill existing stacks first
      for (const existing of this.backpack) {
        if (existing.id === id && existing.qty < maxStack && rem > 0) {
          const add = Math.min(rem, maxStack - existing.qty);
          existing.qty += add;
          rem -= add;
        }
      }
      // Allocate new slots strictly within maxSlots
      while (rem > 0 && this.backpack.length < maxSlots) {
        const chunk = Math.min(rem, maxStack);
        this.backpack.push({ id, qty: chunk });
        rem -= chunk;
      }
      return rem < qty;
    }

    // Non-stackable items require 1 free slot each — never exceed maxSlots!
    if (this.backpack.length >= maxSlots) return false;
    let added = 0;
    for (let i = 0; i < qty && this.backpack.length < maxSlots; i++) {
      this.backpack.push({ id, qty: 1 });
      added++;
    }
    return added > 0;
  }

  _collidesAt(x, eyeY, z) {
    const feetY = eyeY - this.currentEyeHeight;
    const headY = eyeY + 0.18;
    const r = this.radius;

    for (const c of this.world.colliders) {
      if (headY > c.minY && feetY < c.maxY) {
        if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
          return true;
        }
      }
    }
    return false;
  }

  activateFieldUpgrade() {
    if (!this.fieldUpgrade || (!window.DEV_MODE && this.fieldUpgradeCharge < 100)) return null;
    this.fieldUpgradeCharge = 0;
    const def = GAME_DATA.ITEMS[this.fieldUpgrade];
    if (this.fieldUpgrade === 'fu_ammo_box') {
      this.plates = Math.min(6, this.plates + 3);
      this.lethalQty = Math.min(4, this.lethalQty + 1);
      this.tacticalQty = Math.min(4, this.tacticalQty + 1);
      const pDef = this.getActiveWeaponDef();
      if (pDef && pDef.ammoType) this.addToBackpack(pDef.ammoType, 60);
      window.soundEngine.playMagIn();
      return 'Munitions Box deployed (+Ammo, +3 Plates, +Throwables)';
    } else if (this.fieldUpgrade === 'fu_dead_silence') {
      this.deadSilenceTimer = 12.0;
      this.stamina = 100;
      window.soundEngine.playHeal();
      return 'Dead Silence active (12s silent footsteps)';
    } else {
      window.soundEngine.playMagIn();
      return `${def ? def.name : 'Field Upgrade'} deployed!`;
    }
  }

  onSprintKeyDown() {
    const now = performance.now();
    const isDoubleTap = (now - this.lastShiftPressTime) < 380;
    this.lastShiftPressTime = now;

    // Double-tap Shift (or tap Shift while already sprinting) triggers DMZ Tactical Sprint!
    if ((isDoubleTap || this.isSprinting) && !this.isADS && !this.isSliding && this.stamina >= 12) {
      this.stance = 'stand';
      this.isTacSprinting = true;
    }
  }

  onCrouchKeyDown() {
    if (this.crouchKeyHeld) return;
    this.crouchKeyHeld = true;
    this.crouchHoldTime = 0;
    this.crouchHoldTriggeredProne = false;

    // Pressing crouch while sprinting or tac-sprinting triggers an immediate tactical slide!
    if ((this.isSprinting || this.isTacSprinting) && this.onGround && !this.isSliding && this.slideCooldown <= 0) {
      this.isSliding = true;
      this.isTacSprinting = false;
      this.slideTimer = this.slideDuration;
      this.slideCooldown = 0.35;
      this.crouchHoldTriggeredProne = true;
      const horiz = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
      if (horiz.lengthSq() > 0.1) {
        this.slideDir.copy(horiz).normalize();
      } else {
        this.slideDir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      }
      window.soundEngine.playSlide();
    }
  }

  onCrouchKeyUp() {
    if (!this.crouchKeyHeld) return;
    const wasQuickTap = !this.crouchHoldTriggeredProne && this.crouchHoldTime < 0.28;
    this.crouchKeyHeld = false;
    this.crouchHoldTime = 0;

    if (wasQuickTap && !this.isSliding) {
      if (this.stance === 'stand') {
        this.stance = 'crouch';
      } else if (this.stance === 'crouch') {
        this.stance = 'stand';
      } else if (this.stance === 'prone') {
        this.stance = 'crouch';
      }
    }
  }

  onJumpKeyDown() {
    if (this.isDowned || this.dead) return;
    if (this.isSliding) {
      // Smooth slide-cancel back to standing / sprinting
      if (this.slideTimer < this.slideDuration - 0.14) {
        this.isSliding = false;
        this.slideTimer = 0;
        this.stance = 'stand';
      }
      return;
    }
    if (this.stance === 'prone') {
      this.stance = 'stand';
      return;
    }
    if (this.stance === 'crouch') {
      this.stance = 'stand';
    }
    if (this.onGround) {
      this.velocity.y = 6.2;
      this.onGround = false;
    }
  }

  update(dt) {
    if (this.slideCooldown > 0) this.slideCooldown = Math.max(0, this.slideCooldown - dt);
    if (this.uavTimer > 0) this.uavTimer = Math.max(0, this.uavTimer - dt);
    if (this.deadSilenceTimer > 0) this.deadSilenceTimer = Math.max(0, this.deadSilenceTimer - dt);
    if (this.fieldUpgrade && this.fieldUpgradeCharge < 100) {
      const fuDef = GAME_DATA.ITEMS[this.fieldUpgrade];
      const chargeTime = (fuDef && fuDef.chargeTime) || 45;
      this.fieldUpgradeCharge = Math.min(100, this.fieldUpgradeCharge + (100 / chargeTime) * dt);
    }

    // Hold crouch (>= 0.28s) enters prone state
    if (this.crouchKeyHeld && !this.isSliding) {
      this.crouchHoldTime += dt;
      if (!this.crouchHoldTriggeredProne && this.crouchHoldTime >= 0.28) {
        this.crouchHoldTriggeredProne = true;
        this.stance = (this.stance === 'prone') ? 'stand' : 'prone';
      }
    }

    // Movement input (Rebindable Keyboard + Analog Gamepad Left Stick)
    const kb = window.KEYBINDS || {};
    let moveForward = this.padMoveY || 0;
    let moveRight = this.padMoveX || 0;
    if (this.keys[kb.moveForward || 'KeyW']) moveForward += 1;
    if (this.keys[kb.moveBack || 'KeyS']) moveForward -= 1;
    if (this.keys[kb.moveRight || 'KeyD']) moveRight += 1;
    if (this.keys[kb.moveLeft || 'KeyA']) moveRight -= 1;
    moveForward = THREE.MathUtils.clamp(moveForward, -1, 1);
    moveRight = THREE.MathUtils.clamp(moveRight, -1, 1);

    // Direction vectors from yaw
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const forwardVec = new THREE.Vector3(-sinY, 0, -cosY);
    const rightVec = new THREE.Vector3(cosY, 0, -sinY);

    const wishDir = new THREE.Vector3();
    wishDir.addScaledVector(forwardVec, moveForward);
    wishDir.addScaledVector(rightVec, moveRight);
    const moveMag = Math.min(1, wishDir.length());
    if (wishDir.lengthSq() > 0) wishDir.normalize();

    // Sprinting out of crouch/prone smoothly stands player up (Normal sprint is infinite like DMZ!)
    const wantsSprintInput = !!((this.keys['ShiftLeft'] || this.padSprint) && moveForward > 0.35 && !this.isADS);
    if (!this.isSliding && wantsSprintInput && this.stance !== 'stand') {
      this.stance = 'stand';
    }

    const busyHands = !!(this.weaponSystem && (this.weaponSystem.isReloading || this.weaponSystem.isPlating || this.weaponSystem.isHealing));

    // Dead (eliminated, awaiting slow ally revive): camera stays low, no movement
    if (this.dead) {
      this.velocity.x = 0;
      this.velocity.z = 0;
      this.isFiring = false;
      this.isADS = false;
      this.currentEyeHeight = THREE.MathUtils.lerp(this.currentEyeHeight, 0.38, Math.min(1, dt * 8));
      this.position.y = this.currentEyeHeight;
      this.camera.position.copy(this.position);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      return;
    }

    // Downed state: player can crawl slowly to safety (unless being dragged), bleeds out if not being revived
    if (this.isDowned) {
      this.isFiring = false;
      this.isADS = false;
      this.isSprinting = false;
      this.isTacSprinting = false;
      this.isSliding = false;
      this.stance = 'prone';
      if (!this.beingRevivedBy) {
        this.downedBleedTimer -= dt;
        if (this.downedBleedTimer <= 0) {
          this.downedBleedTimer = 0;
          this.dead = true;
          this.isDowned = false;
          this._justBledOut = true;
        }
      }
      if (this.beingDragged) {
        this.velocity.x = 0;
        this.velocity.z = 0;
      } else {
        const crawlSpeed = 1.45;
        this.velocity.x = wishDir.x * crawlSpeed * moveMag;
        this.velocity.z = wishDir.z * crawlSpeed * moveMag;
      }
    } else if (this.isRevivingAlly) {
      // Reviving an ally: moving while reviving drags a downed teammate into cover at slow speed
      this.isFiring = false;
      this.isADS = false;
      this.isSprinting = false;
      this.isTacSprinting = false;
      this.isSliding = false;
      const dragSpeed = this.isDraggingAlly ? 2.0 : 0.0;
      this.velocity.x = wishDir.x * dragSpeed * moveMag;
      this.velocity.z = wishDir.z * dragSpeed * moveMag;
    } else if (this.isSliding) {
      this.slideTimer -= dt;
      const sp = THREE.MathUtils.clamp(1 - (this.slideTimer / this.slideDuration), 0, 1);
      // Slight corner steering while sliding
      if (wishDir.lengthSq() > 0) {
        this.slideDir.lerp(wishDir, Math.min(1, dt * 2.2)).normalize();
      }
      const slideSpeed = THREE.MathUtils.lerp(11.0, 3.6, sp * sp);
      this.velocity.x = this.slideDir.x * slideSpeed;
      this.velocity.z = this.slideDir.z * slideSpeed;
      this.isSprinting = false;
      this.isTacSprinting = false;

      if (this.slideTimer <= 0) {
        this.isSliding = false;
        if (wantsSprintInput) {
          this.stance = 'stand';
          this.isSprinting = true;
        } else if (this.crouchKeyHeld && this.crouchHoldTime >= 0.28) {
          this.stance = 'prone';
        } else {
          this.stance = 'crouch';
        }
      }
    } else {
      const wantsSprint = !!(wantsSprintInput && this.stance === 'stand');
      if (wantsSprint) {
        this.isSprinting = true;
        // DMZ Tactical Sprint drains dedicated Tac-Sprint stamina; drops smoothly to infinite normal sprint at 0
        if (this.isTacSprinting && !busyHands && this.stamina > 0) {
          this.stamina = Math.max(0, this.stamina - 32 * dt);
          this.tacSprintRegenDelay = 0.85;
          if (this.stamina <= 0) {
            this.isTacSprinting = false;
          }
        } else {
          this.isTacSprinting = false;
          // Slowly regenerate Tac-Sprint stamina while normal sprinting (DMZ style)
          if (this.tacSprintRegenDelay > 0) {
            this.tacSprintRegenDelay = Math.max(0, this.tacSprintRegenDelay - dt);
          } else {
            this.stamina = Math.min(100, this.stamina + 10 * dt);
          }
        }
      } else {
        this.isSprinting = false;
        this.isTacSprinting = false;
        if (this.tacSprintRegenDelay > 0) {
          this.tacSprintRegenDelay = Math.max(0, this.tacSprintRegenDelay - dt);
        } else {
          // Fast Tac-Sprint stamina recovery when walking/standing/crouching
          this.stamina = Math.min(100, this.stamina + 30 * dt);
        }
      }

      let speed = 5.4;
      if (this.isTacSprinting) speed = 10.2;
      else if (this.isSprinting) speed = 7.8;
      else if (this.stance === 'prone') speed = 1.5;
      else if (this.stance === 'crouch') speed = 3.0;
      else if (this.isADS) speed = 3.4;

      // Dedicated melee weapon gives a slight movement & sprint speed boost (+12%)
      if (this.activeSlot === 'melee') {
        speed *= 1.12;
      }

      this.velocity.x = wishDir.x * speed * moveMag;
      this.velocity.z = wishDir.z * speed * moveMag;
    }

    this.isProne = (this.stance === 'prone' && !this.isSliding);
    this.isCrouching = (this.stance === 'crouch' || this.stance === 'prone' || this.isSliding);

    // Smooth eye-height interpolation across Stand / Crouch / Slide / Prone / Downed Seated
    let targetEye = this.standEyeHeight;
    if (this.isDowned) targetEye = 0.72;
    else if (this.isSliding) targetEye = this.slideEyeHeight;
    else if (this.stance === 'prone') targetEye = this.proneEyeHeight;
    else if (this.stance === 'crouch') targetEye = this.crouchEyeHeight;

    const prevEye = this.currentEyeHeight;
    const eyeRate = this.isSliding ? 14 : (this.stance === 'prone' ? 7.5 : 10.5);
    this.currentEyeHeight = THREE.MathUtils.lerp(this.currentEyeHeight, targetEye, Math.min(1, dt * eyeRate));
    this.position.y += (this.currentEyeHeight - prevEye);

    // Subtle tactical slide camera roll (steadier when maintaining ADS through a slide)
    const targetSlideRoll = this.isSliding ? (this.isADS ? -0.032 : -0.075) : 0;
    this.slideRoll = THREE.MathUtils.lerp(this.slideRoll, targetSlideRoll, Math.min(1, dt * 11));

    // Gravity
    this.velocity.y -= 18.0 * dt;

    // Axis-separated AABB collision
    const nextX = this.position.x + this.velocity.x * dt;
    if (!this._collidesAt(nextX, this.position.y, this.position.z)) {
      this.position.x = nextX;
    } else {
      this.velocity.x = 0;
    }

    const nextZ = this.position.z + this.velocity.z * dt;
    if (!this._collidesAt(this.position.x, this.position.y, nextZ)) {
      this.position.z = nextZ;
    } else {
      this.velocity.z = 0;
    }

    this.position.y += this.velocity.y * dt;
    if (this.position.y <= this.currentEyeHeight) {
      this.position.y = this.currentEyeHeight;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // Footsteps & weighty stride head-bob (suppressed while sliding)
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.onGround && !this.isSliding && horizSpeed > 0.9) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = this.isTacSprinting ? 0.30 : (this.isSprinting ? 0.38 : (this.isProne ? 0.95 : (this.isCrouching ? 0.72 : 0.56)));
        window.soundEngine.playFootstep(this.isSprinting || this.isTacSprinting);
      }
      const cadence = this.isTacSprinting ? 10.6 : (this.isSprinting ? 8.4 : (this.isProne ? 3.2 : (this.isCrouching ? 4.2 : 5.6)));
      this.headBobTimer += dt * cadence;
      const bobScale = this.isADS ? 0.15 : 1.0;
      const ampY = (this.isTacSprinting ? 0.052 : (this.isSprinting ? 0.040 : (this.isProne ? 0.008 : (this.isCrouching ? 0.014 : 0.024)))) * bobScale;
      const ampRoll = (this.isTacSprinting ? 0.020 : (this.isSprinting ? 0.014 : (this.isProne ? 0.004 : 0.006))) * bobScale;
      const targetBobY = -Math.pow(Math.abs(Math.sin(this.headBobTimer)), 1.6) * ampY;
      const targetRoll = Math.cos(this.headBobTimer) * ampRoll;
      this.headBobY = THREE.MathUtils.lerp(this.headBobY, targetBobY, Math.min(1, dt * 12));
      this.headRoll = THREE.MathUtils.lerp(this.headRoll, targetRoll, Math.min(1, dt * 10));
    } else {
      this.headBobY = THREE.MathUtils.lerp(this.headBobY, 0, Math.min(1, dt * 8));
      this.headRoll = THREE.MathUtils.lerp(this.headRoll, 0, Math.min(1, dt * 8));
    }

    // Automatic Progressive Corner-Peeking Lean (wider radius; leans & angles further as you reach the corner edge)
    let targetLean = 0;
    if (!this.isSprinting && !this.isTacSprinting && !this.isSliding && !this.isDowned && !this.dead) {
      const rayBlockedAt = (ox, oy, oz, dx, dz, maxDist) => {
        for (let d = 0.22; d <= maxDist; d += 0.14) {
          if (this._collidesAt(ox + dx * d, oy, oz + dz * d)) return d;
        }
        return maxDist;
      };

      const eyeY = this.position.y;
      const fwdX = forwardVec.x, fwdZ = forwardVec.z;
      const rX = rightVec.x, rZ = rightVec.z;

      const detectRange = 2.25; // wider approach radius around corners
      const centerDist = rayBlockedAt(this.position.x, eyeY, this.position.z, fwdX, fwdZ, detectRange);

      // Probe multiple lateral offsets (0.36m .. 1.18m) to find the exact distance to the corner edge
      const offsets = [0.36, 0.58, 0.84, 1.15];
      let leftClearOffset = null;
      let rightClearOffset = null;
      for (const off of offsets) {
        if (leftClearOffset === null) {
          const lx = this.position.x - rX * off, lz = this.position.z - rZ * off;
          if (!this._collidesAt(lx, eyeY, lz) && rayBlockedAt(lx, eyeY, lz, fwdX, fwdZ, detectRange + 0.45) > detectRange + 0.15) {
            leftClearOffset = off;
          }
        }
        if (rightClearOffset === null) {
          const rx = this.position.x + rX * off, rz = this.position.z + rZ * off;
          if (!this._collidesAt(rx, eyeY, rz) && rayBlockedAt(rx, eyeY, rz, fwdX, fwdZ, detectRange + 0.45) > detectRange + 0.15) {
            rightClearOffset = off;
          }
        }
      }

      const frontBlocked = centerDist < 2.05;
      const leftOpen = leftClearOffset !== null;
      const rightOpen = rightClearOffset !== null;

      if (frontBlocked && (leftOpen !== rightOpen)) {
        // Closer to the wall AND closer laterally to the corner edge => progressively deeper lean!
        const forwardProx = THREE.MathUtils.clamp((2.05 - centerDist) / 1.35, 0.18, 1.0);
        const edgeOff = rightOpen ? rightClearOffset : leftClearOffset;
        const edgeFactor = THREE.MathUtils.clamp(1.25 - (edgeOff - 0.36) / 1.05, 0.38, 1.0);
        const adsBoost = this.isADS ? 1.0 : 0.78;
        targetLean = (rightOpen ? 1 : -1) * Math.min(1.0, forwardProx * 0.55 + edgeFactor * 0.55) * adsBoost;
      } else if (!frontBlocked) {
        // Rounding a corner: ONLY lean when a nearby side wall actually ENDS just ahead (true corner edge — never along a flat wall!)
        const wallDistL = rayBlockedAt(this.position.x, eyeY, this.position.z, -rX, -rZ, 1.25);
        const wallDistR = rayBlockedAt(this.position.x, eyeY, this.position.z, rX, rZ, 1.25);
        const wallLeft = wallDistL < 1.15;
        const wallRight = wallDistR < 1.15;

        if (wallLeft && !wallRight) {
          const wallProbeX = this.position.x - rX * (wallDistL + 0.22);
          const wallProbeZ = this.position.z - rZ * (wallDistL + 0.22);
          const wallContinuesMid = this._collidesAt(wallProbeX + fwdX * 0.65, eyeY, wallProbeZ + fwdZ * 0.65);
          const wallContinuesFar = this._collidesAt(wallProbeX + fwdX * 1.20, eyeY, wallProbeZ + fwdZ * 1.20);
          if (!wallContinuesMid && !wallContinuesFar) {
            const proxL = THREE.MathUtils.clamp((1.15 - wallDistL) / 0.72, 0.25, 1.0);
            targetLean = proxL * (this.isADS ? 0.92 : 0.68);
          }
        } else if (wallRight && !wallLeft) {
          const wallProbeX = this.position.x + rX * (wallDistR + 0.22);
          const wallProbeZ = this.position.z + rZ * (wallDistR + 0.22);
          const wallContinuesMid = this._collidesAt(wallProbeX + fwdX * 0.65, eyeY, wallProbeZ + fwdZ * 0.65);
          const wallContinuesFar = this._collidesAt(wallProbeX + fwdX * 1.20, eyeY, wallProbeZ + fwdZ * 1.20);
          if (!wallContinuesMid && !wallContinuesFar) {
            const proxR = THREE.MathUtils.clamp((1.15 - wallDistR) / 0.72, 0.25, 1.0);
            targetLean = -proxR * (this.isADS ? 0.92 : 0.68);
          }
        }
      }
    }
    this.lean = THREE.MathUtils.lerp(this.lean, targetLean, Math.min(1, dt * 6.5));

    const leanLateral = this.lean * 0.42;
    const leanDip = Math.abs(this.lean) * 0.042;
    const camPos = this.position.clone();
    if (Math.abs(leanLateral) > 0.01) {
      const testX = camPos.x + rightVec.x * leanLateral;
      const testZ = camPos.z + rightVec.z * leanLateral;
      if (!this._collidesAt(testX, camPos.y - leanDip, testZ)) {
        camPos.x = testX;
        camPos.z = testZ;
      }
      camPos.y -= leanDip;
    }

    // Update 3rd-person articulated character model
    this._updateThirdPersonModel(dt);

    // Apply to camera (1st-person or 3rd-person over-the-shoulder debug camera)
    const euler = new THREE.Euler(this.pitch, this.yaw, -this.lean * 0.165 + this.headRoll + this.slideRoll, 'YXZ');
    if (this.isThirdPerson) {
      const lookBack = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(this.pitch * 0.65, this.yaw, 0, 'YXZ'));
      const shoulderOff = rightVec.clone().multiplyScalar(0.55);
      const pivot = this.position.clone().add(new THREE.Vector3(0, 0.25, 0)).add(shoulderOff);
      let dist = 3.2;
      // Pull camera forward if wall behind player
      for (let d = 0.6; d <= 3.2; d += 0.35) {
        const test = pivot.clone().addScaledVector(lookBack, d);
        if (test.y < 0.25 || this._collidesAt(test.x, Math.max(0.4, test.y), test.z)) {
          dist = Math.max(0.55, d - 0.35);
          break;
        }
      }
      const tpPos = pivot.clone().addScaledVector(lookBack, dist);
      tpPos.y = Math.max(0.30, tpPos.y);
      this.camera.position.copy(tpPos);
      this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    } else {
      camPos.y += this.headBobY;
      this.camera.position.copy(camPos);
      this.camera.quaternion.setFromEuler(euler);
    }
  }
}
