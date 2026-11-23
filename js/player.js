// Shared Global Articulated Low-Poly Tactical Operator Character Model Factory
// Used by Player 3rd-person, Pre-Match Deployment Countdown, Squadmates, and Enemy Operators!
window.buildTacticalOperatorModel = function buildTacticalOperatorModel(opts = {}) {
  if (window.MW2Rig && window.MW2Rig.buildCharacterRig) {
    return window.MW2Rig.buildCharacterRig(opts);
  }
  const root = new THREE.Group();
  const rigPivot = new THREE.Group();
  if (opts.faceForwardZ) {
    rigPivot.rotation.y = Math.PI; // native rig faces -Z; rotate PI to face +Z for squad/enemies/stage
  }
  root.add(rigPivot);

  const uniformCol = opts.uniformColor !== undefined ? opts.uniformColor : 0x3b4437;
  const uniformMat = new THREE.MeshLambertMaterial({ color: uniformCol });
  const uniformDarkMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(uniformCol).multiplyScalar(0.76) });
  const pantsMat = new THREE.MeshLambertMaterial({ color: opts.pantsColor !== undefined ? opts.pantsColor : 0x2f342d });
  const gearMat = new THREE.MeshLambertMaterial({ color: 0x1e2124 });
  const strapMat = new THREE.MeshLambertMaterial({ color: 0x272a25 });
  const padMat = new THREE.MeshLambertMaterial({ color: 0x181b1a });
  const helmetMat = new THREE.MeshLambertMaterial({ color: opts.helmetColor !== undefined ? opts.helmetColor : 0x2d332b });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd1a483 });
  const balaclavaMat = new THREE.MeshLambertMaterial({ color: 0x222522 });
  const visorMat = new THREE.MeshLambertMaterial({ color: 0x16222c });

  // 1. Pelvis + Tactical Belt
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.92, 0);
  const hipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.21), pantsMat);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.055, 0.23), gearMat);
  belt.position.set(0, 0.05, 0);
  const dumpPouch = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.06), strapMat);
  dumpPouch.position.set(-0.14, -0.02, 0.12);
  pelvis.add(hipMesh, belt, dumpPouch);
  rigPivot.add(pelvis);

  // 2. Spine -> Torso
  const spine = new THREE.Group();
  spine.position.set(0, 0.08, 0);
  pelvis.add(spine);

  const torso = new THREE.Group();
  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.20), uniformDarkMat);
  waist.position.set(0, 0.08, 0);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.34, 0.24), uniformMat);
  chest.position.set(0, 0.31, 0);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.10, 0.07, 8), balaclavaMat);
  collar.position.set(0, 0.49, 0);
  torso.add(waist, chest, collar);
  spine.add(torso);

  // Optional Squad Shoulder Patches
  if (opts.squadColor) {
    const patchMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(opts.squadColor) });
    const pL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.075, 0.075), patchMat);
    pL.position.set(-0.22, 0.38, 0);
    const pR = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.075, 0.075), patchMat);
    pR.position.set(0.22, 0.38, 0);
    torso.add(pL, pR);
  }

  // Dynamic Vest / Plate Carrier
  const vestGroup = new THREE.Group();
  const vestId = opts.vestId !== undefined ? opts.vestId : 'vest_2';
  const isHeavyVest = vestId && (vestId.includes('3') || vestId.includes('heavy') || vestId.includes('4'));
  const isMedVest = vestId && vestId.includes('2');
  const vestCol = opts.vestColor !== undefined ? opts.vestColor : (isHeavyVest ? 0x3b4036 : (isMedVest ? 0x4b5342 : 0x5c5847));
  const vestMat = new THREE.MeshLambertMaterial({ color: vestCol });
  const plateFront = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.055), vestMat);
  plateFront.position.set(0, 0.28, -0.13);
  const plateBack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.055), vestMat);
  plateBack.position.set(0, 0.28, 0.13);
  const cummerbund = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.17, 0.26), vestMat);
  cummerbund.position.set(0, 0.18, 0);
  const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.24), strapMat);
  strapL.position.set(-0.13, 0.47, 0);
  const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.24), strapMat);
  strapR.position.set(0.13, 0.47, 0);
  for (let i = -1; i <= 1; i++) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.14, 0.055), gearMat);
    pouch.position.set(i * 0.102, 0.20, -0.17);
    vestGroup.add(pouch);
  }
  const radio = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.04), gearMat);
  radio.position.set(-0.17, 0.35, -0.12);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.22, 6), gearMat);
  antenna.position.set(-0.18, 0.49, -0.12);
  const heavyExtras = new THREE.Group();
  const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.18), vestMat);
  pauldronL.position.set(-0.24, 0.39, 0);
  const pauldronR = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.18), vestMat);
  pauldronR.position.set(0.24, 0.39, 0);
  const groinFlap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.045), vestMat);
  groinFlap.position.set(0, 0.04, -0.145);
  heavyExtras.add(pauldronL, pauldronR, groinFlap);
  heavyExtras.visible = !!isHeavyVest;
  vestGroup.add(plateFront, plateBack, cummerbund, strapL, strapR, radio, antenna, heavyExtras);
  vestGroup.visible = !!vestId;
  torso.add(vestGroup);

  // Dynamic Backpack
  const packGroup = new THREE.Group();
  const bagId = opts.bagId !== undefined ? opts.bagId : 'bag_medium';
  const isLargeBag = bagId && (bagId.includes('large') || bagId.includes('weapon') || bagId.includes('scav'));
  const isMedBag = bagId && bagId.includes('med');
  const packMat = new THREE.MeshLambertMaterial({ color: isLargeBag ? 0x4b4232 : (isMedBag ? 0x3c4338 : 0x2f3430) });
  const packMain = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.38, 0.14), packMat);
  packMain.position.set(0, 0.28, 0.21);
  const packTopPouch = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.11, 0.08), strapMat);
  packTopPouch.position.set(0, 0.38, 0.29);
  const packBotPouch = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.13, 0.07), strapMat);
  packBotPouch.position.set(0, 0.18, 0.285);
  const packLargeExtras = new THREE.Group();
  const packRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.32, 8), gearMat);
  packRoll.rotation.z = Math.PI / 2;
  packRoll.position.set(0, 0.49, 0.22);
  const sidePouchL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.11), strapMat);
  sidePouchL.position.set(-0.18, 0.25, 0.21);
  const sidePouchR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.11), strapMat);
  sidePouchR.position.set(0.18, 0.25, 0.21);
  packLargeExtras.add(sidePouchL, sidePouchR, packRoll);
  packLargeExtras.visible = !!isLargeBag;
  packGroup.add(packMain, packTopPouch, packBotPouch, packLargeExtras);
  const bagScale = isLargeBag ? 1.16 : (isMedBag ? 1.0 : 0.78);
  packGroup.scale.setScalar(bagScale);
  packGroup.visible = !!bagId;
  torso.add(packGroup);

  // 3. Neck -> Head + FAST Helmet + Visor + Comms
  const neck = new THREE.Group();
  neck.position.set(0, 0.50, 0);
  torso.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 0.04, 0);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.22, 0.21), skinMat);
  skull.position.set(0, 0.11, 0);
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.206, 0.11, 0.216), balaclavaMat);
  mask.position.set(0, 0.055, 0);
  const helmetDome = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.25), helmetMat);
  helmetDome.position.set(0, 0.185, 0.005);
  const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.04), gearMat);
  nvgMount.position.set(0, 0.20, -0.13);
  const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.195, 0.058, 0.042), visorMat);
  goggles.position.set(0, 0.135, -0.105);
  const earCupL = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.085, 0.075), gearMat);
  earCupL.position.set(-0.125, 0.12, 0.01);
  const earCupR = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.085, 0.075), gearMat);
  earCupR.position.set(0.125, 0.12, 0.01);
  head.add(skull, mask, helmetDome, nvgMount, goggles, earCupL, earCupR);
  neck.add(head);

  // 4. Articulated Legs (Hip -> Thigh -> Knee + Pad -> Shin -> Ankle -> Boot)
  const makeLeg = (xOff, isRight) => {
    const hip = new THREE.Group();
    hip.position.set(xOff, -0.04, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.42, 0.155), pantsMat);
    thigh.position.set(0, -0.21, 0);
    const legRig = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.10), gearMat);
    legRig.position.set(isRight ? 0.085 : -0.085, -0.18, -0.01);
    hip.add(thigh, legRig);

    const knee = new THREE.Group();
    knee.position.set(0, -0.42, 0);
    const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.045), padMat);
    kneePad.position.set(0, -0.02, -0.075);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.122, 0.38, 0.132), pantsMat);
    shin.position.set(0, -0.19, 0);
    const ankle = new THREE.Group();
    ankle.position.set(0, -0.38, 0);
    const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.128, 0.09, 0.14), gearMat);
    bootUpper.position.set(0, -0.025, 0);
    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.134, 0.06, 0.24), padMat);
    bootSole.position.set(0, -0.055, -0.045);
    ankle.add(bootUpper, bootSole);
    knee.add(kneePad, shin, ankle);
    hip.add(knee);
    pelvis.add(hip);
    return { hip, knee, ankle };
  };
  const leftLeg = makeLeg(-0.112, false);
  const rightLeg = makeLeg(0.112, true);

  // 5. Articulated Arms (Shoulder -> Elbow + Pad -> Invisible Wrist Pivot -> Glove + WeaponMount)
  let weaponMount = null;
  const makeArm = (xOff, isRight) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(xOff, 0.43, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.29, 0.118), uniformMat);
    upper.position.set(0, -0.14, 0);
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28, 0);
    const elbowPad = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.035), padMat);
    elbowPad.position.set(0, -0.02, 0.062);
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.26, 0.098), uniformDarkMat);
    forearm.position.set(0, -0.13, 0);

    const wrist = new THREE.Group();
    wrist.position.set(0, -0.26, 0);
    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.095, 0.076), gearMat);
    glove.position.set(0, -0.042, -0.005);
    wrist.add(glove);

    if (isRight) {
      weaponMount = new THREE.Group();
      weaponMount.position.set(0, -0.04, -0.02);
      weaponMount.rotation.x = -Math.PI / 2;
      wrist.add(weaponMount);
    }
    elbow.add(elbowPad, forearm, wrist);
    shoulder.add(elbow);
    torso.add(shoulder);
    return { shoulder, elbow, wrist };
  };
  const leftArm = makeArm(-0.26, false);
  const rightArm = makeArm(0.26, true);

  // Default tactical shouldered two-handed pose: buttstock tucked into right shoulder, right hand on rear grip, left hand on foregrip!
  leftArm.shoulder.rotation.set(0.98, 0, 0.50);
  leftArm.elbow.rotation.set(1.16, 0, 0);
  rightArm.shoulder.rotation.set(0.94, 0, -0.12);
  rightArm.elbow.rotation.set(1.06, 0, 0);
  if (weaponMount) {
    weaponMount.rotation.set(-Math.PI / 2 - 0.14, 0.10, -0.04);
  }

  return {
    root, rigPivot, pelvis, spine, torso, chest, neck, head, skull,
    leftLeg, rightLeg, leftArm, rightArm, weaponMount,
    vestGroup, packGroup
  };
};

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
    this.noclip = false;
    this.godMode = false;
    this.mantleState = null;
    this.ledgeState = null;
    this.ledgeCooldown = 0;

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

    // Vitals (Unified Operator Health: 75 HP + 35 Armor per Plate + Tourniquet Disabled/Temporary Health & 2.5s Regen)
    const opStats = GAME_DATA.OPERATOR_STATS || { maxHp: 75, plateArmor: 35 };
    this.maxHp = opStats.maxHp;
    this.hp = opStats.maxHp;
    this.disabledHp = 0;           // Red disabled max HP segment from Tourniquet self-revives
    this.tempHealthRestored = 0;   // Yellow temporarily restored HP from Bandage / Painkillers
    this.tempHealthTimer = 0;      // Remaining duration of Bandage / Painkiller temp HP
    this.tempHealthDuration = 0;
    this.tempHealthSource = null;  // 'bandage' | 'painkillers' | null
    this.timeSinceDamaged = 10;    // Auto-regenerates HP after 2.5s without taking damage
    this.isDowned = false;
    this.invisible = false;
    this._prevStance = 'stand';
    this.stanceTrans = { from: 'stand', to: 'stand', timer: 0, duration: 0.35 };
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
    const perPlate = (GAME_DATA.OPERATOR_STATS && GAME_DATA.OPERATOR_STATS.plateArmor) || 35;
    this.plateSlots = armorDef ? (armorDef.plateSlots || Math.ceil(armorDef.maxArmor / 50)) : 0;
    this.maxArmor = this.plateSlots * perPlate;
    this.armor = this.maxArmor;
    this.armorId = loadoutState.armor || null;
    this.plates = Math.min(6, loadoutState.plates !== undefined ? loadoutState.plates : 3);
    this.stamina = 100;
    this.lethal = loadoutState.lethal !== undefined ? loadoutState.lethal : 'frag_grenade';
    this.lethalQty = loadoutState.lethalQty !== undefined ? loadoutState.lethalQty : (this.lethal ? 2 : 0);
    this.lastEquippedLethal = this.lethal || 'frag_grenade';
    this.tactical = loadoutState.tactical !== undefined ? loadoutState.tactical : 'smoke_grenade';
    this.tacticalQty = loadoutState.tacticalQty !== undefined ? loadoutState.tacticalQty : (this.tactical ? 2 : 0);
    this.lastEquippedTactical = this.tactical || 'smoke_grenade';
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

    // Weapons (with per-instance & Gunsmith attachment mods + rarity preservation)
    const allMods = loadoutState.weaponMods || {};
    const normMods = (m) => (GAME_DATA.normalizeWeaponMods ? GAME_DATA.normalizeWeaponMods(m) : { ...(m || {}) });
    const makeSlot = (wId, slotMods = null, slotRarity = null) => {
      if (!wId) return null;
      const hasSlotMods = slotMods && typeof slotMods === 'object';
      const mods = normMods(hasSlotMods ? slotMods : (allMods[wId] || {}));
      const eff = GAME_DATA.getEffectiveWeaponStats(wId, mods);
      const rarityOverride = GAME_DATA.resolveWeaponRarity
        ? GAME_DATA.resolveWeaponRarity(wId, mods, slotRarity)
        : (slotRarity || null);
      return { id: wId, mods, mag: eff.magSize, rarityOverride };
    };
    this.slots = {
      primary: makeSlot(loadoutState.primary, loadoutState.primaryMods, loadoutState.primaryRarity),
      secondary: makeSlot(loadoutState.secondary, loadoutState.secondaryMods, loadoutState.secondaryRarity)
    };
    this.activeSlot = this.slots.primary ? 'primary' : 'secondary';
    const bwRaw = loadoutState.backpackWeapon;
    const bwId = bwRaw ? (typeof bwRaw === 'string' ? bwRaw : bwRaw.id) : null;
    this.backpackWeapon = (bagDef && bagDef.weaponSlot && bwId)
      ? makeSlot(bwId, loadoutState.backpackWeaponMods || (bwRaw && bwRaw.mods), loadoutState.backpackWeaponRarity || (bwRaw && bwRaw.rarityOverride))
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
      // Align rear pistol grip to right-hand IK anchor & seat buttstock firmly in right shoulder pocket
      if (this.tpWeapon.isPistol) {
        this.tpWeapon.group.position.set(0.0, 0.01, -0.02);
      } else {
        this.tpWeapon.group.position.set(0.0, 0.01, -0.12);
      }
      this.avatarParts.weaponMount.add(this.tpWeapon.group);
    }
  }

  _buildThirdPersonModel() {
    if (window.MW2Rig && window.MW2Rig.buildCharacterRig) {
      const rig = window.MW2Rig.buildCharacterRig({
        archetype: 'operator',
        uniformColor: 0x3b4437,
        vestId: this.armorId || this.armorVest || 'vest_2',
        bagId: this.backpackId || 'bag_small',
        faceForwardZ: false
      });
      rig.root.visible = true;
      if (rig.skin && typeof rig.skin.setFirstPersonBodyMode === 'function') {
        rig.skin.setFirstPersonBodyMode(!this.isThirdPerson);
      }
      if (this.world && this.world.scene) {
        this.world.scene.add(rig.root);
      }
      this.avatarGroup = rig.root;
      this.avatarParts = rig;
      this.mw2Anim = new window.MW2Animator(rig);
      this._syncThirdPersonGear();
      return;
    }
    const root = new THREE.Group();
    const rigPivot = new THREE.Group();
    root.add(rigPivot);

    // Low-poly tactical material palette (resource-efficient MeshLambertMaterial)
    const uniformMat = new THREE.MeshLambertMaterial({ color: 0x3b4437 });
    const uniformDarkMat = new THREE.MeshLambertMaterial({ color: 0x2b3228 });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2f342d });
    const gearMat = new THREE.MeshLambertMaterial({ color: 0x1e2124 });
    const strapMat = new THREE.MeshLambertMaterial({ color: 0x272a25 });
    const padMat = new THREE.MeshLambertMaterial({ color: 0x181b1a });
    const helmetMat = new THREE.MeshLambertMaterial({ color: 0x2d332b });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd1a483 });
    const balaclavaMat = new THREE.MeshLambertMaterial({ color: 0x222522 });
    const visorMat = new THREE.MeshLambertMaterial({ color: 0x16222c });
    const tabletScreenMat = new THREE.MeshBasicMaterial({ color: 0x39e58c });

    // 1. PELVIS / HIPS + TACTICAL BELT
    const pelvis = new THREE.Group();
    pelvis.position.set(0, 0.92, 0);
    const hipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.21), pantsMat);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.055, 0.23), gearMat);
    belt.position.set(0, 0.05, 0);
    const dumpPouch = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.06), strapMat);
    dumpPouch.position.set(-0.14, -0.02, 0.12);
    pelvis.add(hipMesh, belt, dumpPouch);
    rigPivot.add(pelvis);

    // 2. SPINE -> TORSO (CHEST)
    const spine = new THREE.Group();
    spine.position.set(0, 0.08, 0);
    pelvis.add(spine);

    const torso = new THREE.Group();
    torso.position.set(0, 0.0, 0);
    const waist = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.20), uniformDarkMat);
    waist.position.set(0, 0.08, 0);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.34, 0.24), uniformMat);
    chest.position.set(0, 0.31, 0);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.10, 0.07, 8), balaclavaMat);
    collar.position.set(0, 0.49, 0);
    torso.add(waist, chest, collar);
    spine.add(torso);

    // === DYNAMIC EQUIPPED GEAR: VEST / PLATE CARRIER GROUP ===
    const vestGroup = new THREE.Group();
    const vestMat = new THREE.MeshLambertMaterial({ color: 0x4b5342 });
    const plateFront = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.055), vestMat);
    plateFront.position.set(0, 0.28, -0.13);
    const plateBack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.055), vestMat);
    plateBack.position.set(0, 0.28, 0.13);
    const cummerbund = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.17, 0.26), vestMat);
    cummerbund.position.set(0, 0.18, 0);
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.24), strapMat);
    strapL.position.set(-0.13, 0.47, 0);
    const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.24), strapMat);
    strapR.position.set(0.13, 0.47, 0);
    // 3 chest magazine pouches
    for (let i = -1; i <= 1; i++) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.14, 0.055), gearMat);
      pouch.position.set(i * 0.102, 0.20, -0.17);
      vestGroup.add(pouch);
    }
    // Tactical shoulder radio & heavy tier pauldrons/groin flap (toggled by vest tier)
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.04), gearMat);
    radio.position.set(-0.17, 0.35, -0.12);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.22, 6), gearMat);
    antenna.position.set(-0.18, 0.49, -0.12);
    const heavyExtras = new THREE.Group();
    const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.18), vestMat);
    pauldronL.position.set(-0.24, 0.39, 0);
    const pauldronR = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.18), vestMat);
    pauldronR.position.set(0.24, 0.39, 0);
    const groinFlap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.045), vestMat);
    groinFlap.position.set(0, 0.04, -0.145);
    heavyExtras.add(pauldronL, pauldronR, groinFlap);
    vestGroup.add(plateFront, plateBack, cummerbund, strapL, strapR, radio, antenna, heavyExtras);
    torso.add(vestGroup);

    // === DYNAMIC EQUIPPED GEAR: BACKPACK GROUP ===
    const packGroup = new THREE.Group();
    const packMat = new THREE.MeshLambertMaterial({ color: 0x3c4036 });
    const packMain = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.38, 0.14), packMat);
    packMain.position.set(0, 0.28, 0.21);
    const packTopPouch = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.11, 0.08), strapMat);
    packTopPouch.position.set(0, 0.38, 0.29);
    const packBotPouch = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.13, 0.07), strapMat);
    packBotPouch.position.set(0, 0.18, 0.285);
    const packRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.32, 8), gearMat);
    packRoll.rotation.z = Math.PI / 2;
    packRoll.position.set(0, 0.49, 0.22);
    const packLargeExtras = new THREE.Group();
    const sidePouchL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.11), strapMat);
    sidePouchL.position.set(-0.18, 0.25, 0.21);
    const sidePouchR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.11), strapMat);
    sidePouchR.position.set(0.18, 0.25, 0.21);
    packLargeExtras.add(sidePouchL, sidePouchR, packRoll);
    packGroup.add(packMain, packTopPouch, packBotPouch, packLargeExtras);
    torso.add(packGroup);

    // 3. NECK -> HEAD + TACTICAL HELMET / COMMS / VISOR
    const neck = new THREE.Group();
    neck.position.set(0, 0.50, 0);
    torso.add(neck);

    const head = new THREE.Group();
    head.position.set(0, 0.04, 0);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.22, 0.21), skinMat);
    skull.position.set(0, 0.11, 0);
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.206, 0.11, 0.216), balaclavaMat);
    mask.position.set(0, 0.055, 0);
    const helmetDome = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.25), helmetMat);
    helmetDome.position.set(0, 0.185, 0.005);
    const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.04), gearMat);
    nvgMount.position.set(0, 0.20, -0.13);
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.195, 0.058, 0.042), visorMat);
    goggles.position.set(0, 0.135, -0.105);
    const earCupL = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.085, 0.075), gearMat);
    earCupL.position.set(-0.125, 0.12, 0.01);
    const earCupR = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.085, 0.075), gearMat);
    earCupR.position.set(0.125, 0.12, 0.01);
    head.add(skull, mask, helmetDome, nvgMount, goggles, earCupL, earCupR);
    neck.add(head);

    // 4. ARTICULATED LEGS (Hip -> Thigh -> Knee + KneePad -> Shin -> Ankle -> Combat Boot)
    const makeLeg = (xOff, isRight) => {
      const hip = new THREE.Group();
      hip.position.set(xOff, -0.04, 0);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.42, 0.155), pantsMat);
      thigh.position.set(0, -0.21, 0);
      hip.add(thigh);
      // Drop-leg holster (right) / thigh utility pouch (left)
      const legRig = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.10), gearMat);
      legRig.position.set(isRight ? 0.085 : -0.085, -0.18, -0.01);
      hip.add(legRig);

      const knee = new THREE.Group();
      knee.position.set(0, -0.42, 0);
      const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.045), padMat);
      kneePad.position.set(0, -0.02, -0.075);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.122, 0.38, 0.132), pantsMat);
      shin.position.set(0, -0.19, 0);

      const ankle = new THREE.Group();
      ankle.position.set(0, -0.38, 0);
      const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.128, 0.09, 0.14), gearMat);
      bootUpper.position.set(0, -0.025, 0.0);
      const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.134, 0.06, 0.24), padMat);
      bootSole.position.set(0, -0.055, -0.045);
      ankle.add(bootUpper, bootSole);

      knee.add(kneePad, shin, ankle);
      hip.add(knee);
      pelvis.add(hip);
      return { hip, knee, ankle };
    };
    const leftLeg = makeLeg(-0.112, false);
    const rightLeg = makeLeg(0.112, true);

    // 5. ARTICULATED ARMS (Shoulder -> Upper Arm -> Elbow -> Forearm -> Invisible Wrist Pivot -> Tactical Glove)
    let weaponMount = null;
    let handMag = null;
    let handShell = null;
    let inventoryTablet = null;
    const makeArm = (xOff, isRight = false) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(xOff, 0.43, 0);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.29, 0.118), uniformMat);
      upper.position.set(0, -0.14, 0);
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.set(0, -0.28, 0);
      const elbowPad = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.035), padMat);
      elbowPad.position.set(0, -0.02, 0.062);
      const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.26, 0.098), uniformDarkMat);
      forearm.position.set(0, -0.13, 0);

      // Invisible wrist joint pivot (no visible ball joint!)
      const wrist = new THREE.Group();
      wrist.position.set(0, -0.26, 0);
      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.095, 0.076), gearMat);
      glove.position.set(0, -0.042, -0.005);
      wrist.add(glove);

      if (isRight) {
        weaponMount = new THREE.Group();
        weaponMount.position.set(0, -0.04, -0.02);
        weaponMount.rotation.x = -Math.PI / 2;
        wrist.add(weaponMount);
      } else {
        handMag = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.15, 0.065), new THREE.MeshLambertMaterial({ color: 0x4c5259 }));
        handMag.position.set(0.02, -0.06, -0.03);
        handMag.visible = false;
        handShell = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.075, 8), new THREE.MeshLambertMaterial({ color: 0xb52b2b }));
        handShell.rotation.z = Math.PI / 2;
        handShell.position.set(0.02, -0.05, -0.03);
        handShell.visible = false;

        // Tactical Tablet held in left hand when searching backpack / inventory
        inventoryTablet = new THREE.Group();
        const tabBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.020, 0.16), gearMat);
        const tabScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.185, 0.125), tabletScreenMat);
        tabScreen.rotation.x = -Math.PI / 2;
        tabScreen.position.y = 0.012;
        inventoryTablet.add(tabBody, tabScreen);
        inventoryTablet.position.set(0.09, -0.07, -0.08);
        inventoryTablet.rotation.set(0.45, 0.12, -0.12);
        inventoryTablet.visible = false;

        wrist.add(handMag, handShell, inventoryTablet);
      }

      elbow.add(elbowPad, forearm, wrist);
      shoulder.add(elbow);
      torso.add(shoulder);
      return { shoulder, elbow, wrist };
    };
    const leftArm = makeArm(-0.26, false);
    const rightArm = makeArm(0.26, true);

    root.visible = false;
    if (this.world && this.world.scene) {
      this.world.scene.add(root);
    }
    this.avatarGroup = root;
    this.avatarParts = {
      rigPivot, pelvis, spine, torso, neck, head,
      leftLeg, rightLeg, leftArm, rightArm,
      weaponMount, handMag, handShell, inventoryTablet,
      vestGroup, vestMat, heavyExtras,
      packGroup, packMat, packLargeExtras
    };
    this._syncThirdPersonGear();
  }

  _syncThirdPersonGear() {
    if (!this.avatarParts) return;
    const p = this.avatarParts;
    // Reflect equipped Armor Vest accurately on the player model
    const vestId = this.armorId || this.armorVest || null;
    if (p.vestGroup) {
      p.vestGroup.visible = !!vestId;
      if (vestId) {
        const isHeavy = vestId === 'vest_3' || vestId === 'vest_4' || vestId.includes('heavy') || vestId.includes('3');
        const isMed = vestId === 'vest_2' || vestId.includes('2');
        const col = isHeavy ? 0x3b4036 : (isMed ? 0x4b5342 : 0x5c5847);
        if (p.vestMat) p.vestMat.color.setHex(col);
        if (p.heavyExtras) p.heavyExtras.visible = isHeavy;
      }
    }
    // Reflect equipped Backpack accurately on the player model (RiggedCharacter skin + procedural fallback)
    const bagId = this.backpackId || null;
    if (p.skin && typeof p.skin.setBackpack === 'function') {
      p.skin.setBackpack(bagId);
    }
    if (p.packGroup) {
      p.packGroup.visible = !!bagId;
      if (bagId && typeof window.buildTacticalBackpackMesh === 'function') {
        if (p.packGroup.userData.bagId !== bagId) {
          while (p.packGroup.children.length) p.packGroup.remove(p.packGroup.children[0]);
          const sculpted = window.buildTacticalBackpackMesh(bagId, { forIcon: false });
          sculpted.position.set(0, p.isMW2Rig ? 0.22 : 0.28, 0.16);
          p.packGroup.add(sculpted);
          p.packGroup.userData.bagId = bagId;
          p.packGroup.scale.set(1, 1, 1);
        }
      } else if (bagId) {
        const isLarge = bagId === 'bag_large' || bagId === 'bag_scavenger' || bagId === 'bag_weapon' || bagId.includes('large') || bagId.includes('weapon');
        const isMed = bagId === 'bag_medium' || bagId.includes('med');
        const s = isLarge ? 1.18 : (isMed ? 1.0 : 0.78);
        p.packGroup.scale.set(s, s, s);
        if (p.packMat) {
          p.packMat.color.setHex(isLarge ? 0x4b4232 : (isMed ? 0x3c4338 : 0x2f3430));
        }
        if (p.packLargeExtras) p.packLargeExtras.visible = isLarge;
      }
    }
  }

  toggleThirdPerson() {
    this.isThirdPerson = !this.isThirdPerson;
    if (this.avatarGroup) this.avatarGroup.visible = !this.dead && !(this.isDowned && !this.isThirdPerson) && !(this.isProne && !this.isThirdPerson);
    if (this.avatarParts && this.avatarParts.skin && typeof this.avatarParts.skin.setFirstPersonBodyMode === 'function') {
      this.avatarParts.skin.setFirstPersonBodyMode(!this.isThirdPerson);
    }
    if (this.weaponSystem && this.weaponSystem.setThirdPerson) {
      this.weaponSystem.setThirdPerson(this.isThirdPerson);
    }
    return this.isThirdPerson;
  }

  _updateThirdPersonModel(dt) {
    if (!this.avatarGroup || !this.avatarParts) return;
    const isFP = !this.isThirdPerson;
    const showBody = !this.dead && !(this.isDowned && isFP) && !(this.isProne && isFP);
    this.avatarGroup.visible = showBody;
    if (!showBody) return;

    const p = this.avatarParts;
    if (p.skin && typeof p.skin.setFirstPersonBodyMode === 'function') {
      p.skin.setFirstPersonBodyMode(isFP);
    } else {
      // Procedural fallback FP masking: hide head/arms/backpack so camera never clips
      if (p.head) p.head.visible = !isFP;
      if (p.leftArm && p.leftArm.shoulder) p.leftArm.shoulder.visible = !isFP;
      if (p.rightArm && p.rightArm.shoulder) p.rightArm.shoulder.visible = !isFP;
    }

    const smooth = (t) => t * t * (3 - 2 * t);
    const rate = Math.min(1, dt * 13);
    this.idleTime += dt;

    this._syncThirdPersonGear();
    if (isFP && p.packGroup) p.packGroup.visible = false;

    // Place character at player's feet position and orient to player's yaw
    // In First Person, shift body slightly rearward so looking down shows torso/vest/legs cleanly,
    // and shift forward slightly during a slide so the real 3P extended lead leg & boot kick cleanly into view!
    const groundBase = (this.world && this.world.getTerrainHeight) ? this.world.getTerrainHeight(this.position.x, this.position.z) : 0;
    const feetY = Math.max(groundBase, this.position.y - this.currentEyeHeight);
    let bodyX = this.position.x;
    let bodyY = feetY;
    let bodyZ = this.position.z;
    if (isFP) {
      const backDist = this.isSliding ? 0.04 : (this.isProne ? 0.34 : (this.stance === 'crouch' ? 0.28 : 0.25));
      bodyX += Math.sin(this.yaw) * backDist;
      bodyZ += Math.cos(this.yaw) * backDist;
      if (this.isSliding) bodyY += 0.04;
    }
    this.avatarGroup.position.set(bodyX, bodyY, bodyZ);
    this.avatarGroup.rotation.y = this.yaw;

    // Unified MW2 Layered Rig & Analytical 2-Bone IK Driver
    if (this.mw2Anim) {
      const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      const strafeInput = this.isMenuBlocked ? 0 : ((this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0));
      const ws = this.weaponSystem;
      if (p.handMag) p.handMag.visible = false;
      if (p.handShell) p.handShell.visible = false;
      if (p.plateProp && isFP) p.plateProp.visible = false;
      if (p.inventoryTablet) p.inventoryTablet.visible = !isFP && !!this.isInventoryOpen && !this.isDowned && !this.dead;
      if (p.weaponMount) p.weaponMount.visible = !isFP && !this.isDowned && !this.dead && !this.mantleState && !this.ledgeState && !this.isInventoryOpen;

      // Sync 3rd-person weapon bolt blowback
      if (!isFP && ws && this.tpWeapon && this.tpWeapon.boltMesh && !ws.isReloading) {
        this.tpWeapon.boltMesh.position.z = this.tpWeapon.boltRestPos.z + (ws.boltKick || 0);
      }

      const plateProg = (!isFP && ws && ws.isPlating && ws.plateDuration > 0)
        ? THREE.MathUtils.clamp(1 - (ws.plateTimer / ws.plateDuration), 0, 1)
        : 0;
      const reloadProg = (!isFP && ws && ws.isReloading && ws.reloadDuration > 0)
        ? THREE.MathUtils.clamp(1 - (ws.reloadTimer / ws.reloadDuration), 0, 1)
        : 0;

      const isSelfReviving = !!(this.isDowned && (this.beingRevivedBy === 'SELF-REVIVE' || this.beingRevivedBy === 'TOURNIQUET') && (this.reviveProgress || 0) > 0.005);
      const isReviving3P = !isFP && !!(this.isRevivingAlly || isSelfReviving);
      const reviveProg3P = isSelfReviving ? (this.reviveProgress || 0) : (this.allyReviveProgress || 0);
      const isThrowing3P = !isFP && !!this._isThrowing;
      const throwProg3P = this._throwProgress || 0;

      // In First Person, suppress 3P upper-body actions (reload/plate/heal/revive/throw/ADS/aimPitch) so only clean torso & legs locomotion + slide render!
      this.mw2Anim.update(dt, {
        speed: this.onGround ? horizSpeed : 0,
        moveRight: strafeInput,
        stance: this.isProne ? 'prone' : (this.stance === 'crouch' ? 'crouch' : 'stand'),
        isSprinting: this.isSprinting,
        isTacSprinting: this.isTacSprinting,
        isSliding: this.isSliding,
        slideProgress: this.slideDuration > 0 ? (1 - this.slideTimer / this.slideDuration) : 0.5,
        isADS: isFP ? false : this.isADS,
        onGround: this.onGround,
        aimPitch: isFP ? 0 : (this.pitch || 0),
        lean: isFP ? (this.lean || 0) * 0.4 : (this.lean || 0),
        isDowned: this.isDowned,
        dead: this.dead,
        isPlating: isFP ? false : !!(ws && ws.isPlating),
        plateProgress: plateProg,
        isReloading: isFP ? false : !!(ws && ws.isReloading),
        reloadProgress: reloadProg,
        isHealing: isFP ? false : !!(ws && ws.isHealing),
        isReviving: isReviving3P,
        reviveProgress: reviveProg3P,
        isThrowing: isThrowing3P,
        throwProgress: throwProg3P,
        stanceTrans: this.stanceTrans,
        recoilKick: isFP ? 0 : (ws ? (ws.recoilZ || ws.recoilOffset || 0) : 0),
        isPistol: !!(this.tpWeapon && this.tpWeapon.isPistol),
        world: this.world,
        worldPos: this.position,
        worldYaw: this.yaw,
        feetY: feetY
      });
      if (isFP) {
        if (p.plateProp) p.plateProp.visible = false;
        if (p.handMag) p.handMag.visible = false;
        if (p.handShell) p.handShell.visible = false;
        if (p.syringeProp) p.syringeProp.visible = false;
        if (p.grenadeProp) p.grenadeProp.visible = false;
      }
      return;
    }

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const moving = this.onGround && horizSpeed > 0.35;
    if (moving) {
      const freq = this.isSprinting ? 11.4 : (this.isProne ? 4.4 : (this.stance === 'crouch' ? 6.4 : 8.2));
      this.animCycle += dt * freq;
    }
    const stride = moving ? Math.sin(this.animCycle) : 0;
    const strideCos = moving ? Math.cos(this.animCycle) : 0;
    const breathe = Math.sin(this.idleTime * 2.1);

    // Directional strafe factor for subtle banking
    const strafeInput = this.isMenuBlocked ? 0 : ((this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0));

    // Target pose variables (two-handed ready-to-fire tactical stance by default!)
    let rigPitch = 0, rigRoll = 0, rigYaw = 0, rigY = 0;
    let pelvisY = 0.90;
    let pelvisYaw = 0.16; // bladed tactical stance
    let torsoPitch = -0.05, torsoYaw = -0.14;
    let lHipX = 0.14, lHipZ = -0.06, lKneeX = -0.22, lAnkX = 0.08;
    let rHipX = -0.10, rHipZ = 0.06, rKneeX = -0.14, rAnkX = 0.12;
    let lShX = 0.94, lElbX = 0.78, lShZ = -0.34, lWrX = 0, lWrZ = 0;
    let rShX = 0.98, rElbX = 0.68, rShZ = 0.12, rWrX = 0, rWrZ = 0;
    let wpnRotX = -Math.PI / 2, wpnRotY = 0.04, wpnRotZ = 0;
    let autoClampFeet = true;
    let customHeadPitch = null;

    if (p.handMag) p.handMag.visible = false;
    if (p.handShell) p.handShell.visible = false;
    if (p.inventoryTablet) p.inventoryTablet.visible = false;
    if (p.weaponMount) p.weaponMount.visible = !this.isDowned && !this.dead && !this.mantleState && !this.ledgeState;

    if (this.mantleState || this.ledgeState) {
      // === MOCAP MANTLING / LEDGE CLIMBING ANIMATION ===
      autoClampFeet = false;
      const prog = this.mantleState ? this.mantleState.t : (this.ledgeState ? this.ledgeState.pullProgress : 0.5);
      const pullCurve = Math.sin(prog * Math.PI);
      pelvisY = 0.86 - pullCurve * 0.12;
      torsoPitch = -0.32 - pullCurve * 0.25;
      lShX = 2.45 - prog * 1.45; lElbX = 0.35 + pullCurve * 0.95; lShZ = -0.18;
      rShX = 2.45 - prog * 1.45; rElbX = 0.35 + pullCurve * 0.95; rShZ = 0.18;
      lHipX = 0.55 + pullCurve * 0.85; lKneeX = -1.15 - pullCurve * 0.45; lAnkX = 0.35;
      rHipX = -0.15 + prog * 0.65; rKneeX = -0.55 - pullCurve * 0.35; rAnkX = 0.25;
    } else if (this.isInventoryOpen && !this.isDowned && !this.dead) {
      // === INVENTORY SEARCHING ANIMATION: Gun lowered on sling, looking down at glowing tactical tablet! ===
      pelvisYaw = 0.08;
      torsoPitch = -0.12 + breathe * 0.012;
      torsoYaw = -0.05;
      lHipX = 0.08; lKneeX = -0.14; lAnkX = 0.06;
      rHipX = -0.06; rKneeX = -0.10; rAnkX = 0.08;
      // Left hand holds tactical tablet up in front of chest; right hand lowers gun & taps screen
      lShX = 0.72; lElbX = 1.28; lShZ = -0.30; lWrX = -0.18;
      rShX = 0.36; rElbX = 0.62; rShZ = 0.14; rWrX = 0.15;
      wpnRotX = -Math.PI / 2 - 0.65; // gun lowered cleanly downward on sling
      wpnRotY = 0.38;
      wpnRotZ = -0.22;
      if (p.inventoryTablet) p.inventoryTablet.visible = true;
      customHeadPitch = -0.52 + Math.sin(this.idleTime * 1.6) * 0.04; // looking down at tablet
    } else if (this.isDowned) {
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
    } else if (this.isRevivingAlly) {
      // === ARTICULATED KNEELING TACTICAL REVIVE: ONE KNEE PLANTED, LEANED FORWARD, RHYTHMIC CHEST/STIM MOTIONS ===
      const revCyc = this.idleTime * 5.2;
      const push = Math.sin(revCyc);
      pelvisY = 0.54;
      torsoPitch = -0.44 + push * 0.05;
      torsoYaw = Math.sin(revCyc * 0.5) * 0.06;
      // Left foot planted forward, right knee dropped down into tactical kneel
      lHipX = 1.08; lHipZ = -0.10; lKneeX = -1.48; lAnkX = 0.42;
      rHipX = 0.24; rHipZ = 0.12;  rKneeX = -1.68; rAnkX = 0.55;
      // Both arms reaching down & working rhythmically on teammate's chest/tourniquet
      lShX = 1.05 + push * 0.16; lElbX = 0.92 - push * 0.18; lShZ = -0.26;
      rShX = 1.12 - push * 0.14; rElbX = 0.88 + push * 0.20; rShZ = 0.26;
      wpnRotX = -Math.PI / 2 - 0.72; // weapon slung cleanly downward
      wpnRotY = 0.42;
      customHeadPitch = -0.58 + push * 0.04;
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

      // Trailing RIGHT leg & foot tucked compactly underneath hip/body (zero splay or clipping)
      rHipX = THREE.MathUtils.lerp(0.60, 1.05, entry);
      rHipZ = 0.36 * entry;
      rKneeX = THREE.MathUtils.lerp(-1.10, -2.55, entry);
      rAnkX = THREE.MathUtils.lerp(0.25, 0.72, entry);

      // Arms tucked LOW & INWARD stabilizing the weapon straight forward (never up in the air!)
      lShX = 0.24; lElbX = 0.88; lShZ = 0.32;
      rShX = 0.30; rElbX = 0.86; rShZ = -0.10;
      wpnRotX = -Math.PI / 2 + 0.12 * entry;
      wpnRotY = 0.10 * entry;
      wpnRotZ = -0.12 * entry;
    } else if (this.isProne) {
      // === ARTICULATED PRONE & CRAWL: CHEST PROPPED ON ELBOWS, HEAD UP LOOKING FORWARD, GUN SHOULDERED ABOVE GROUND ===
      autoClampFeet = false;
      rigPitch = -1.38;
      rigY = 0.22;
      pelvisY = 0.24;
      const crawlPhase = moving ? stride : 0;
      torsoPitch = 0.48 + breathe * 0.018 + (this.isADS ? 0.06 : 0);
      torsoYaw = moving ? crawlPhase * 0.08 : (this.isADS ? 0.08 : 0);
      lHipX = -0.06 - Math.max(0, crawlPhase) * 0.22;  lHipZ = -0.14 - Math.max(0, crawlPhase) * 0.10; lKneeX = -0.12 - Math.max(0, -crawlPhase) * 0.24; lAnkX = 0.65;
      rHipX = -0.06 - Math.max(0, -crawlPhase) * 0.22; rHipZ = 0.14 + Math.max(0, -crawlPhase) * 0.10; rKneeX = -0.12 - Math.max(0, crawlPhase) * 0.24;  rAnkX = 0.65;
      // Elbows planted on ground supporting forearms & shouldered rifle cleanly above terrain (zero clipping!)
      lShX = (this.isADS ? 1.56 : 1.48) + (moving ? crawlPhase * 0.18 : 0) + breathe * 0.015; lElbX = this.isADS ? 1.12 : 1.06; lShZ = 0.44;
      rShX = (this.isADS ? 1.58 : 1.50) - (moving ? crawlPhase * 0.18 : 0) + breathe * 0.015; rElbX = this.isADS ? 1.04 : 0.98; rShZ = -0.12;
      wpnRotX = -Math.PI / 2 - 0.18;
      wpnRotY = this.isADS ? 0.04 : 0.08;
      wpnRotZ = 0.0;
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
      // === ARTICULATED CROUCH & TACTICAL CROUCH-WALK (ASYMMETRIC STANCE + CHEEK-WELD ADS) ===
      const crouchStride = stride * 0.46;
      lHipX = 0.92 + crouchStride;
      lHipZ = -0.08;
      lKneeX = -1.36 - Math.max(0, -strideCos) * 0.26;
      lAnkX = -(lHipX + lKneeX) * 0.75;

      rHipX = 0.78 - crouchStride;
      rHipZ = 0.10;
      rKneeX = -1.28 - Math.max(0, strideCos) * 0.26;
      rAnkX = -(rHipX + rKneeX) * 0.75;

      pelvisY = 0.66;
      pelvisYaw = moving ? (stride * 0.12) : 0.22;
      torsoYaw = moving ? (-stride * 0.10) : (this.isADS ? -0.14 : -0.18);
      torsoPitch = (this.isADS ? -0.28 : -0.22) + breathe * 0.014;
      rigRoll = -strafeInput * 0.055;

      lShX = this.isADS ? 1.04 : 0.86; lElbX = this.isADS ? 1.02 : 0.90; lShZ = this.isADS ? 0.36 : 0.44;
      rShX = this.isADS ? 1.08 : 0.90; rElbX = this.isADS ? 0.92 : 0.74; rShZ = -0.14;
    } else {
      // === FORWARD KINETIC & PROGRESSIVE WALK / SPRINT STANCE WITH UNEVEN TERRAIN FOOT IK ===
      const speedRatio = THREE.MathUtils.clamp(horizSpeed / 5.2, 0, 1.38);
      const amp = moving ? (0.18 + speedRatio * 0.56) : 0;
      lHipX = moving ? (stride * amp) : 0.08;
      rHipX = moving ? (-stride * amp) : -0.06;
      const kneeLift = this.isSprinting ? 1.15 : (0.35 + speedRatio * 0.48);
      lKneeX = moving ? (-Math.max(0, -strideCos) * kneeLift - 0.08) : -0.14;
      rKneeX = moving ? (-Math.max(0, strideCos) * kneeLift - 0.08) : -0.10;
      // Progressive heel-strike -> flat plant -> toe-off ankle articulation
      lAnkX = moving ? (-(lHipX + lKneeX) * 0.65 + Math.max(0, stride) * 0.18) : 0.06;
      rAnkX = moving ? (-(rHipX + rKneeX) * 0.65 + Math.max(0, -stride) * 0.18) : 0.06;

      // Kinetic double-support vertical bounce + weight shift
      pelvisY = 0.88 - (moving ? Math.abs(stride) * 0.045 * Math.min(1, speedRatio) : 0);
      pelvisYaw = moving ? (stride * (0.06 + speedRatio * 0.09)) : 0.16;
      torsoYaw = -pelvisYaw * 0.85;
      torsoPitch = (this.isTacSprinting ? -0.30 : (this.isSprinting ? -0.22 : (-0.06 - speedRatio * 0.08))) + breathe * 0.012;
      rigRoll = -strafeInput * (this.isSprinting ? 0.08 : 0.04);

      // 2-Foot Uneven Terrain IK: sample terrain height directly under each boot & flex uphill knee/hip/ankle!
      if (this.world && this.world.getTerrainHeight) {
        const sinY = Math.sin(this.yaw);
        const cosY = Math.cos(this.yaw);
        const footSpread = 0.22;
        const stepFwd = moving ? stride * 0.28 : 0.08;
        const lx = this.position.x - cosY * footSpread - sinY * stepFwd;
        const lz = this.position.z + sinY * footSpread - cosY * stepFwd;
        const rx = this.position.x + cosY * footSpread + sinY * stepFwd;
        const rz = this.position.z - sinY * footSpread + cosY * stepFwd;
        const lGround = this.world.getTerrainHeight(lx, lz);
        const rGround = this.world.getTerrainHeight(rx, rz);
        const dL = THREE.MathUtils.clamp(lGround - feetY, -0.35, 0.35);
        const dR = THREE.MathUtils.clamp(rGround - feetY, -0.35, 0.35);
        const minFootDrop = Math.min(0, dL, dR);
        pelvisY += minFootDrop * 0.65;
        // Flex uphill leg's hip & knee so the boot plants cleanly onto the higher slope without sinking or floating
        const liftL = Math.max(0, dL - minFootDrop);
        const liftR = Math.max(0, dR - minFootDrop);
        lHipX += liftL * 1.45;
        lKneeX -= liftL * 2.15;
        lAnkX += liftL * 0.85;
        rHipX += liftR * 1.45;
        rKneeX -= liftR * 2.15;
        rAnkX += liftR * 0.85;
      }

      if (this.isTacSprinting) {
        // High-Port Tactical Sprint: athletic forward drive, weapon held high & ready across upper chest!
        lShX = 0.32 - stride * 0.72; lElbX = 1.24; lShZ = 0.18;
        rShX = 1.12 + stride * 0.14; rElbX = 1.18; rShZ = -0.18;
        wpnRotX = -Math.PI / 2 + 0.52;
        wpnRotY = 0.18;
        wpnRotZ = -0.14;
      } else if (this.isSprinting) {
        // Combat-ready two-handed sprint (both hands locked firmly on weapon across chest!)
        lShX = 0.76 - stride * 0.12; lElbX = 0.96; lShZ = 0.48;
        rShX = 0.72 + stride * 0.12; rElbX = 0.88; rShZ = -0.18;
        wpnRotY = 0.34;
        wpnRotZ = -0.12;
      } else {
        // Two-handed shouldered combat stance: buttstock tucked in right shoulder, rear grip + foregrip hold, rhythmic idle breathing
        if (this.isADS) {
          pelvisYaw = 0.22;
          torsoYaw = -0.20;
          torsoPitch = -0.10 + breathe * 0.016;
          lShX = 1.04 + breathe * 0.016; lElbX = 1.18; lShZ = 0.50;
          rShX = 1.02 + breathe * 0.016; rElbX = 1.10; rShZ = -0.12;
          wpnRotX = -Math.PI / 2 - 0.14;
          wpnRotY = 0.08;
        } else {
          pelvisYaw = moving ? stride * 0.08 : 0.18;
          torsoYaw = moving ? -stride * 0.07 : -0.16;
          torsoPitch += breathe * 0.018;
          lShX = 0.98 + breathe * 0.022; lElbX = 1.16; lShZ = 0.50;
          rShX = 0.94 + breathe * 0.022; rElbX = 1.06; rShZ = -0.12;
          wpnRotX = -Math.PI / 2 - 0.14;
          wpnRotY = 0.10;
        }
      }
    }

    // === CROSSHAIR AIM-PITCH TRACKING: Head, Torso & Both Arms Align Weapon Directly to Crosshair ===
    if (!this.isDowned && !this.dead && !this.isInventoryOpen && !this.mantleState && !this.ledgeState && !this.isTacSprinting) {
      const aimPitch = THREE.MathUtils.clamp(this.pitch || 0, -0.85, 0.85);
      torsoPitch += aimPitch * 0.26;
      lShX += aimPitch * 0.74;
      rShX += aimPitch * 0.74;
    }

    // Exact Foot-Contact Ground Clamping (prevents boots from ever clipping into the ground!)
    if (autoClampFeet) {
      const footDrop = (hX, kX) => 0.04 + 0.42 * Math.cos(hX) + 0.45 * Math.cos(hX + kX);
      const maxDrop = Math.max(footDrop(lHipX, lKneeX), footDrop(rHipX, rKneeX));
      pelvisY = Math.max(0.45, maxDrop + 0.008);
    }

    // === ACCURATELY REFLECT 1ST-PERSON WEAPON RELOADS, PLATING, MEDKIT & STEADY FIRING RECOIL ===
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
        // Mocap recoil absorption: shoulders & torso absorb rearward kick while hands hold weapon steady on target!
        const kickZ = ws.recoilZ || ws.recoilOffset || 0;
        const kickP = ws.recoilPitch || (ws.recoilOffset * 1.1) || 0;
        if (kickZ > 0.001 && !this.isInventoryOpen) {
          const adsHold = this.isADS ? 0.55 : 1.0;
          torsoPitch += kickZ * 1.45 * adsHold;
          rShX -= kickZ * 2.2 * adsHold;
          rElbX += kickZ * 2.6 * adsHold;
          lShX -= kickZ * 1.8 * adsHold;
          lElbX += kickZ * 2.1 * adsHold;
          rWrX += kickP * 0.55 * adsHold;
          wpnRotX += kickP * 0.72 * adsHold;
        }
      }

      if (ws.isPlating) {
        // 4-phase mocap Armor Plate Insertion matching 1st-person: 1) Unzip vest -> 2) Pull plate -> 3) Insert into carrier -> 4) Zip closed!
        const pp = ws.plateDuration > 0 ? THREE.MathUtils.clamp(1 - (ws.plateTimer / ws.plateDuration), 0, 1) : ((this.idleTime * 0.7) % 1);
        torsoPitch -= 0.12;
        torsoYaw += 0.16;
        rShX = 0.34; rElbX = 0.62; rShZ = -0.22;
        wpnRotX = -Math.PI / 2 - 0.55;
        if (pp < 0.22) {
          // Stage 1: Unzip front plate carrier flap across chest
          const t = smooth(pp / 0.22);
          lShX = THREE.MathUtils.lerp(0.92, 0.98, t);
          lElbX = THREE.MathUtils.lerp(1.30, 1.56, t);
          lShZ = THREE.MathUtils.lerp(0.32, 0.72, t);
          customHeadPitch = -0.28 * t;
        } else if (pp < 0.48) {
          // Stage 2: Reach pouch & lift ceramic armor plate up to open carrier
          const t = smooth((pp - 0.22) / 0.26);
          lShX = THREE.MathUtils.lerp(0.30, 1.44, t);
          lElbX = THREE.MathUtils.lerp(0.65, 1.52, t);
          lShZ = THREE.MathUtils.lerp(-0.18, 0.62, t);
          customHeadPitch = -0.32;
        } else if (pp < 0.78) {
          // Stage 3: Slide ceramic plate straight down into vest carrier slot
          const t = smooth((pp - 0.48) / 0.30);
          lShX = THREE.MathUtils.lerp(1.44, 0.86, t);
          lElbX = THREE.MathUtils.lerp(1.52, 1.24, t);
          lShZ = THREE.MathUtils.lerp(0.62, 0.54, t);
          torsoPitch -= Math.sin(t * Math.PI) * 0.08;
          customHeadPitch = -0.34;
        } else {
          // Stage 4: Zip/velcro plate carrier closed across chest
          const t = smooth((pp - 0.78) / 0.22);
          lShX = THREE.MathUtils.lerp(0.96, 0.92, t);
          lElbX = THREE.MathUtils.lerp(1.54, 1.22, t);
          lShZ = THREE.MathUtils.lerp(0.72, 0.38, t);
          customHeadPitch = -0.32 * (1 - t);
        }
      } else if (ws.isHealing) {
        // Articulated Field Medkit / Bandaging mocap cycle: active wrapping motion around forearm/chest!
        const hp = ws.healDuration > 0 ? THREE.MathUtils.clamp(1 - (ws.healTimer / ws.healDuration), 0, 1) : ((this.idleTime * 0.5) % 1);
        const wrap = Math.sin(hp * Math.PI * 6);
        const wrapCos = Math.cos(hp * Math.PI * 6);
        torsoPitch -= 0.18 + wrap * 0.03;
        customHeadPitch = -0.42;
        lShX = 0.92 + wrap * 0.08; lElbX = 1.34; lShZ = -0.36;
        rShX = 0.96 + wrapCos * 0.22; rElbX = 1.24 + wrap * 0.26; rShZ = 0.34 + wrap * 0.16;
        wpnRotX = -Math.PI / 2 - 0.68;
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

    // 3rd-Person Stance Transition Overlay (Kneeling bend & supporting-hand ground push-off for Prone <-> Crouch/Stand!)
    if (this.stanceTrans && this.stanceTrans.timer > 0 && !this.isDowned && !this.dead && !this.isSliding) {
      const tp = 1 - (this.stanceTrans.timer / Math.max(0.01, this.stanceTrans.duration));
      const arc = Math.sin(tp * Math.PI);
      const involvesProne = this.stanceTrans.to === 'prone' || this.stanceTrans.from === 'prone';
      if (involvesProne) {
        // Left supporting hand leaves rifle and plants down onto the ground to support body weight!
        lShX = THREE.MathUtils.lerp(lShX, 1.52, arc * 0.92);
        lElbX = THREE.MathUtils.lerp(lElbX, 0.24, arc * 0.92);
        lShZ = THREE.MathUtils.lerp(lShZ, -0.36, arc * 0.92);
        torsoPitch -= 0.22 * arc;
        lKneeX -= 0.45 * arc;
        rKneeX -= 0.35 * arc;
      } else {
        // Stand <-> Crouch knee bend & torso counterbalance dip
        lHipX += 0.24 * arc;
        rHipX += 0.20 * arc;
        lKneeX -= 0.42 * arc;
        rKneeX -= 0.36 * arc;
        torsoPitch -= 0.14 * arc;
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

    const headPitch = customHeadPitch !== null
      ? customHeadPitch
      : (this.isDowned
        ? THREE.MathUtils.clamp(-0.26 + this.pitch * 0.32, -0.48, 0.22)
        : (this.isProne
          ? (0.92 + this.pitch * 0.45)
          : (this.isSliding ? (-torsoPitch + this.pitch * 0.65) : (this.pitch * 0.65))));
    p.head.rotation.x = THREE.MathUtils.lerp(p.head.rotation.x, headPitch, rate);
    p.head.rotation.y = THREE.MathUtils.lerp(p.head.rotation.y, 0, rate);
    p.head.rotation.z = THREE.MathUtils.lerp(p.head.rotation.z, 0, rate);
    // Visible chest breathing expansion while holding weapon shouldered
    if (p.torso && !this.dead) {
      const chestBreath = Math.sin(this.idleTime * 2.1);
      p.torso.scale.set(1 + chestBreath * 0.012, 1 + chestBreath * 0.010, 1 + chestBreath * 0.026);
    }
    if (p.leftArm.wrist) {
      p.leftArm.wrist.rotation.x = THREE.MathUtils.lerp(p.leftArm.wrist.rotation.x, lWrX, rate);
      p.leftArm.wrist.rotation.z = THREE.MathUtils.lerp(p.leftArm.wrist.rotation.z, lWrZ, rate);
    }
    if (p.rightArm.wrist) {
      p.rightArm.wrist.rotation.x = THREE.MathUtils.lerp(p.rightArm.wrist.rotation.x, rWrX, rate);
      p.rightArm.wrist.rotation.z = THREE.MathUtils.lerp(p.rightArm.wrist.rotation.z, rWrZ, rate);
    }

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
      if (this.melee && GAME_DATA.ITEMS[this.melee]) {
        const mDef = GAME_DATA.ITEMS[this.melee];
        this.weaponSystem.buildMeleeViewmodel(mDef);
      } else if (this.weaponSystem.buildFistsViewmodel) {
        this.weaponSystem.buildFistsViewmodel();
      }
      if (this.tpWeapon && this.tpWeapon.group && this.avatarParts && this.avatarParts.weaponMount) {
        this.avatarParts.weaponMount.remove(this.tpWeapon.group);
        this.tpWeapon = null;
      }
      return;
    }
    const slotObj = this.getActiveWeaponSlot();
    if (slotObj) {
      this.weaponSystem.isMeleeMode = false;
      this.weaponSystem.isFistsMode = false;
      const def = GAME_DATA.ITEMS[slotObj.id];
      this.weaponSystem.buildViewmodel(def, slotObj.mods, true);
      this._rebuildThirdPersonWeapon(def, slotObj.mods);
    } else {
      // Empty weapon slot -> show operator's bare fists!
      if (this.weaponSystem.buildFistsViewmodel) {
        this.weaponSystem.buildFistsViewmodel();
      }
      if (this.tpWeapon && this.tpWeapon.group && this.avatarParts && this.avatarParts.weaponMount) {
        this.avatarParts.weaponMount.remove(this.tpWeapon.group);
        this.tpWeapon = null;
      }
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
    if (slotName === this.activeSlot) return;
    if (slotName !== 'primary' && slotName !== 'secondary') return;
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

    const mods = GAME_DATA.normalizeWeaponMods ? GAME_DATA.normalizeWeaponMods(extra.mods) : { ...(extra.mods || {}) };
    const eff = GAME_DATA.getEffectiveWeaponStats(weaponId, mods);
    const mag = extra.mag !== undefined ? extra.mag : (eff ? eff.magSize : (def.magSize || 30));
    const rarityOverride = GAME_DATA.resolveWeaponRarity
      ? GAME_DATA.resolveWeaponRarity(weaponId, mods, extra.rarityOverride)
      : (extra.rarityOverride || null);

    if (targetSlot === 'backpackWeapon') {
      if (!this.hasWeaponBackpack()) {
        return { equipped: false, prevId: null, prevSlotObj: null, slot: null };
      }
      const prevSlotObj = this.backpackWeapon;
      const prevId = prevSlotObj ? prevSlotObj.id : null;
      this.backpackWeapon = { id: weaponId, mods, mag, rarityOverride };
      return { equipped: true, prevId, prevSlotObj, slot: 'backpackWeapon' };
    }

    const prevSlotObj = this.slots[targetSlot];
    const prevId = prevSlotObj ? prevSlotObj.id : null;
    this.slots[targetSlot] = { id: weaponId, mods, mag, rarityOverride };

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
    const stage = slotObj.reloadStage || 0;
    const reserve = this.getReserveAmmo(def.ammoType);
    // Allow resuming an interrupted staged reload (Stage 1: insert mag; Stage 2: rack bolt even if mag is full / 0 reserve!)
    if (stage >= 2) {
      this.isTacSprinting = false;
      this.weaponSystem.startReload(def, true, 0, slotObj);
      return;
    }
    if (stage === 1) {
      if (reserve <= 0 && !window.DEV_MODE) return;
      this.isTacSprinting = false;
      const shellsToLoad = Math.min(Math.max(1, def.magSize - slotObj.mag), Math.max(1, reserve));
      this.weaponSystem.startReload(def, !!slotObj.reloadWasEmpty || slotObj.mag === 0, shellsToLoad, slotObj);
      return;
    }
    if (slotObj.mag >= def.magSize) return;
    if (reserve <= 0 && !window.DEV_MODE) return;
    this.isTacSprinting = false;
    const shellsToLoad = Math.min(def.magSize - slotObj.mag, window.DEV_MODE ? (def.magSize - slotObj.mag) : reserve);
    this.weaponSystem.startReload(def, slotObj.mag === 0, shellsToLoad, slotObj);
  }

  loadSingleShell() {
    const slotObj = this.getActiveWeaponSlot();
    const def = this.getActiveWeaponDef();
    if (!slotObj || !def) return;
    if (slotObj.mag >= def.magSize) return;
    const loaded = this.consumeReserveAmmo(def.ammoType, 1);
    slotObj.mag += loaded;
  }

  commitReloadMag(slotObj = null) {
    const s = slotObj || this.getActiveWeaponSlot();
    const def = s ? GAME_DATA.ITEMS[s.id] : this.getActiveWeaponDef();
    if (!s || !def) return;
    if (def.id === 'm870') return;
    if (s.reloadMagCommitted) return;
    const needed = Math.max(0, def.magSize - s.mag);
    if (needed > 0) {
      const loaded = window.DEV_MODE ? needed : this.consumeReserveAmmo(def.ammoType, needed);
      s.mag += loaded;
    }
    s.reloadMagCommitted = true;
  }

  finishReload() {
    const slotObj = this.getActiveWeaponSlot();
    const def = this.getActiveWeaponDef();
    if (!slotObj || !def) return;
    if (def.id !== 'm870' && !slotObj.reloadMagCommitted) {
      this.commitReloadMag(slotObj);
    }
    slotObj.reloadStage = 0;
    slotObj.reloadWasEmpty = false;
    slotObj.reloadMagCommitted = false;
  }

  startPlating() {
    if (this.isDowned || this.dead) return false;
    if (this.maxArmor <= 0) return false;
    if (!window.DEV_MODE && (this.armor >= this.maxArmor || this.plates <= 0)) return false;
    const perPlate = (GAME_DATA.OPERATOR_STATS && GAME_DATA.OPERATOR_STATS.plateArmor) || 35;
    const needed = Math.max(window.DEV_MODE ? 1 : 0, Math.ceil((this.maxArmor - this.armor) / perPlate));
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
    const perPlate = (GAME_DATA.OPERATOR_STATS && GAME_DATA.OPERATOR_STATS.plateArmor) || 35;
    this.armor = Math.min(this.maxArmor, this.armor + perPlate);
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

  getEffectiveMaxHp() {
    return Math.max(20, this.maxHp - Math.max(0, (this.disabledHp || 0) - (this.tempHealthRestored || 0)));
  }

  startMedkit() {
    if (this.isDowned || this.dead) return false;
    const needsMed = this.hp < this.maxHp || (this.disabledHp || 0) > 0 || (this.tempHealthTimer || 0) > 0;
    if (!window.DEV_MODE && (this.getMedkitCount() <= 0 || !needsMed)) return false;
    return this.weaponSystem.startMedkit();
  }

  finishMedkit() {
    if (!window.DEV_MODE) {
      if (!this.consumeMedkit()) return false;
    }
    // Medkit permanently restores disabled health & converts any temporary Bandage/Painkiller health into permanent HP!
    this.disabledHp = 0;
    this.tempHealthRestored = 0;
    this.tempHealthTimer = 0;
    this.tempHealthDuration = 0;
    this.tempHealthSource = null;
    this.hp = Math.min(this.maxHp, this.hp + GAME_DATA.ITEMS.medkit.healAmount);
    window.soundEngine.playHeal();
    return true;
  }

  useTemporaryMed(itemId) {
    if (this.isDowned || this.dead) return false;
    if (itemId !== 'bandage' && itemId !== 'painkillers') return false;
    const idx = this.backpack.findIndex(it => it && it.id === itemId && it.qty > 0);
    if (!window.DEV_MODE && idx === -1) return false;
    const restoreCap = itemId === 'painkillers' ? 50 : 25;
    const dur = itemId === 'painkillers' ? 45.0 : 25.0;
    const canRestore = Math.min(this.disabledHp || 0, restoreCap);
    const needsHeal = this.hp < this.getEffectiveMaxHp();
    if (canRestore <= 0 && !needsHeal && !window.DEV_MODE) return false;

    if (!window.DEV_MODE && idx !== -1) {
      this.backpack[idx].qty -= 1;
      if (this.backpack[idx].qty <= 0) this.backpack.splice(idx, 1);
    }
    if (canRestore > 0) {
      this.tempHealthRestored = Math.max(this.tempHealthRestored || 0, canRestore);
      this.tempHealthTimer = dur;
      this.tempHealthDuration = dur;
      this.tempHealthSource = itemId;
    }
    const healAmt = itemId === 'painkillers' ? 45 : 30;
    this.hp = Math.min(this.getEffectiveMaxHp(), this.hp + healAmt);
    if (window.soundEngine && window.soundEngine.playHeal) {
      try { window.soundEngine.playHeal(); } catch (e) {}
    }
    return true;
  }

  applyTourniquet() {
    if (!this.isDowned || this.dead) return false;
    // Once tourniqueted & wounded (disabledHp > 0), an operator may not tourniquet again until healed with a Medkit!
    if ((this.disabledHp || 0) > 0) return false;
    // Sacrifice 25 max HP (disabled red health bar section) to get back up immediately!
    this.disabledHp = Math.min(this.maxHp - 25, (this.disabledHp || 0) + 25);
    this.tempHealthRestored = Math.min(this.tempHealthRestored || 0, this.disabledHp);
    this.revive(Math.min(40, this.getEffectiveMaxHp()));
    this.timeSinceDamaged = 0;
    return true;
  }

  useMedkit() {
    return this.startMedkit();
  }

  takeDamage(amount, attackerInfo = null) {
    if (this.dead || this.godMode) return null;
    this.timeSinceDamaged = 0;
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
      const mods = GAME_DATA.normalizeWeaponMods ? GAME_DATA.normalizeWeaponMods(extra.mods) : { ...(extra.mods || {}) };
      const eff = GAME_DATA.getEffectiveWeaponStats(id, mods);
      const rarityOverride = GAME_DATA.resolveWeaponRarity
        ? GAME_DATA.resolveWeaponRarity(id, mods, extra.rarityOverride)
        : (extra.rarityOverride || null);
      this.backpackWeapon = {
        id,
        mods,
        mag: extra.mag !== undefined ? extra.mag : (eff ? eff.magSize : (def.magSize || 30)),
        rarityOverride
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

    // Auto-fill active Lethal / Tactical grenade slot when empty or matching type with space (< 2)
    if (!extra.forceBag && (def.type === 'lethal' || def.type === 'tactical')) {
      const slotKey = def.type;
      const qtyKey = def.type === 'lethal' ? 'lethalQty' : 'tacticalQty';
      const lastKey = def.type === 'lethal' ? 'lastEquippedLethal' : 'lastEquippedTactical';
      const curId = this[slotKey];
      const curQty = this[qtyKey] || 0;
      if (!curId || curQty <= 0) {
        const take = Math.min(qty, 2);
        this[slotKey] = id;
        this[lastKey] = id;
        this[qtyKey] = take;
        qty -= take;
        if (qty <= 0) return true;
      } else if (curId === id && curQty < 2) {
        const take = Math.min(qty, 2 - curQty);
        this[qtyKey] = curQty + take;
        qty -= take;
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
    const itemMods = extra.mods ? (GAME_DATA.normalizeWeaponMods ? GAME_DATA.normalizeWeaponMods(extra.mods) : { ...extra.mods }) : null;
    for (let i = 0; i < qty && this.backpack.length < maxSlots; i++) {
      this.backpack.push({
        id,
        qty: 1,
        ...(itemMods && Object.keys(itemMods).length ? { mods: itemMods } : {}),
        ...(extra.rarityOverride ? { rarityOverride: extra.rarityOverride } : {}),
        ...(extra.mag !== undefined ? { mag: extra.mag } : {})
      });
      added++;
    }
    return added > 0;
  }

  _collidesAt(x, eyeY, z, eyeHOverride = null) {
    const eh = eyeHOverride != null ? eyeHOverride : this.currentEyeHeight;
    const feetY = eyeY - eh;
    const headY = eyeY + 0.18;
    const r = this.radius;
    const list = this.world.getNearbyColliders ? this.world.getNearbyColliders(x, z, r + 0.6) : this.world.colliders;

    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.doorRef && c.doorRef.passable) continue;
      // Auto step-up: allow walking smoothly onto stair treads & curbs up to 0.42m above feetY!
      if (headY > c.minY + 0.02 && feetY < c.maxY - 0.42) {
        if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
          return true;
        }
      }
    }
    return false;
  }

  _hasTallWallAt(x, eyeY, z) {
    const r = this.radius;
    const list = this.world.getNearbyColliders ? this.world.getNearbyColliders(x, z, r + 0.6) : this.world.colliders;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.doorRef && c.doorRef.passable) continue;
      // Only full-height walls/pillars extending above eye level (ignores hip-height tables, boxes, crates, sandbags)
      if (c.maxY >= eyeY + 0.12 && c.minY < eyeY) {
        if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
          return true;
        }
      }
    }
    return false;
  }

  _getSupportHeightAt(x, z, feetY) {
    const r = this.radius * 0.92;
    let bestY = (this.world && this.world.getTerrainHeight) ? this.world.getTerrainHeight(x, z) : 0;
    const list = this.world.getNearbyColliders ? this.world.getNearbyColliders(x, z, r + 0.6) : this.world.colliders;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.doorRef && c.doorRef.passable) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        if (c.maxY <= feetY + 0.46 && c.maxY > bestY) {
          bestY = c.maxY;
        }
      }
    }
    return bestY;
  }

  _getCeilingHeightAt(x, z, feetY) {
    const r = this.radius * 0.85;
    let ceilY = Infinity;
    const list = this.world.getNearbyColliders ? this.world.getNearbyColliders(x, z, r + 0.6) : this.world.colliders;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        if (c.minY >= feetY + 0.45 && c.minY < ceilY) {
          ceilY = c.minY;
        }
      }
    }
    return ceilY;
  }

  _findClimbableObstacle(airborneOnlyLedge = false) {
    if (!this.world || !this.world.colliders) return null;
    const feetY = this.position.y - this.currentEyeHeight;
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const probeR = this.radius * 0.7;

    let best = null;
    for (const d of [0.48, 0.78, 1.12]) {
      const px = this.position.x + fwdX * d;
      const pz = this.position.z + fwdZ * d;
      const list = this.world.getNearbyColliders ? this.world.getNearbyColliders(px, pz, probeR + 0.8) : this.world.colliders;
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (px + probeR <= c.minX || px - probeR >= c.maxX || pz + probeR <= c.minZ || pz - probeR >= c.maxZ) {
          continue;
        }
        const relH = c.maxY - feetY;
        if (relH < 0.42 || relH > 2.95) continue;
        if (airborneOnlyLedge && relH <= 1.48) continue;

        // Determine nearest outer face of this collider relative to player
        const dxMin = Math.abs(this.position.x - c.minX);
        const dxMax = Math.abs(this.position.x - c.maxX);
        const dzMin = Math.abs(this.position.z - c.minZ);
        const dzMax = Math.abs(this.position.z - c.maxZ);
        const minD = Math.min(dxMin, dxMax, dzMin, dzMax);

        let inwardX = 0, inwardZ = 0;
        let edgeX = THREE.MathUtils.clamp(this.position.x, c.minX + 0.25, c.maxX - 0.25);
        let edgeZ = THREE.MathUtils.clamp(this.position.z, c.minZ + 0.25, c.maxZ - 0.25);
        if (c.maxX - c.minX < 0.5) edgeX = (c.minX + c.maxX) * 0.5;
        if (c.maxZ - c.minZ < 0.5) edgeZ = (c.minZ + c.maxZ) * 0.5;

        if (minD === dxMin) { inwardX = 1; edgeX = c.minX; }
        else if (minD === dxMax) { inwardX = -1; edgeX = c.maxX; }
        else if (minD === dzMin) { inwardZ = 1; edgeZ = c.minZ; }
        else { inwardZ = -1; edgeZ = c.maxZ; }

        // Ensure player is roughly facing the obstacle face
        if (fwdX * inwardX + fwdZ * inwardZ < 0.25) continue;

        const hangX = edgeX - inwardX * (this.radius + 0.08);
        const hangZ = edgeZ - inwardZ * (this.radius + 0.08);

        // Compute top landing point (step 0.56m inward onto the top surface)
        const boxDepth = inwardX !== 0 ? (c.maxX - c.minX) : (c.maxZ - c.minZ);
        const stepIn = Math.min(0.58, Math.max(0.28, boxDepth * 0.5));
        const landX = edgeX + inwardX * stepIn;
        const landZ = edgeZ + inwardZ * stepIn;
        const standEye = c.maxY + this.standEyeHeight;

        // Check headroom on top of the obstacle
        if (this._collidesAt(landX, standEye + 0.04, landZ, this.standEyeHeight)) continue;

        const kind = relH <= 1.48 ? 'mantle' : 'ledge';
        best = {
          kind,
          collider: c,
          relH,
          ledgeY: c.maxY,
          edgePos: new THREE.Vector3(edgeX, c.maxY, edgeZ),
          hangPos: new THREE.Vector3(hangX, c.maxY - 0.16, hangZ),
          endPos: new THREE.Vector3(landX, standEye, landZ),
          inwardX,
          inwardZ,
          ledgeYaw: Math.atan2(-inwardX, -inwardZ)
        };
        break;
      }
      if (best) break;
    }
    return best;
  }

  _startClimb(info) {
    if (!info) return false;
    this.isSliding = false;
    this.isADS = false;
    this.isFiring = false;
    this.isSprinting = false;
    this.isTacSprinting = false;
    this.stance = 'stand';
    this.velocity.set(0, 0, 0);

    if (info.kind === 'mantle') {
      const midPos = new THREE.Vector3(
        THREE.MathUtils.lerp(this.position.x, info.endPos.x, 0.45),
        info.ledgeY + this.standEyeHeight + 0.12,
        THREE.MathUtils.lerp(this.position.z, info.endPos.z, 0.45)
      );
      this.mantleState = {
        startPos: this.position.clone(),
        midPos,
        endPos: info.endPos.clone(),
        t: 0,
        duration: 0.34
      };
      if ((this.deadSilenceTimer || 0) <= 0 && window.soundEngine && window.soundEngine.playFootstep) {
        try { window.soundEngine.playFootstep(true); } catch (e) {}
      }
      return true;
    }

    // Head-height progressive ledge-grab!
    this.ledgeState = {
      phase: 'grabbing', // 'grabbing' | 'hanging' | 'pulling'
      grabT: 0,
      pullProgress: 0,
      startPos: this.position.clone(),
      edgePos: info.edgePos.clone(),
      hangPos: info.hangPos.clone(),
      endPos: info.endPos.clone(),
      ledgeY: info.ledgeY,
      inwardX: info.inwardX,
      inwardZ: info.inwardZ,
      ledgeYaw: info.ledgeYaw
    };
    if ((this.deadSilenceTimer || 0) <= 0 && window.soundEngine && window.soundEngine.playFootstep) {
      try { window.soundEngine.playFootstep(false); } catch (e) {}
    }
    return true;
  }

  resupplyFromMunitionBox(box) {
    if (!box) return null;
    if (box.usedBy && box.usedBy.has('player')) {
      return 'Already resupplied from this Munition Box';
    }
    if (box.usedBy) box.usedBy.add('player');

    // Remember last equipped throwables so empty slots always replenish the last equipped lethal & tactical!
    if (this.lethal) this.lastEquippedLethal = this.lethal;
    if (this.tactical) this.lastEquippedTactical = this.tactical;

    // 1. Replenish Lethals (restoring last equipped if empty)
    const refLethal = this.lethal || this.lastEquippedLethal || 'frag_grenade';
    this.lethal = refLethal;
    this.lethalQty = Math.min(4, Math.max(2, (this.lethalQty || 0) + 2));

    // 2. Replenish Tacticals (restoring last equipped if empty)
    const refTactical = this.tactical || this.lastEquippedTactical || 'smoke_grenade';
    this.tactical = refTactical;
    this.tacticalQty = Math.min(4, Math.max(2, (this.tacticalQty || 0) + 2));

    // 3. Replenish Ammo for both equipped weapons (Primary & Secondary)
    const ammoAdded = new Set();
    ['primary', 'secondary'].forEach((slKey) => {
      const sl = this.slots && this.slots[slKey];
      if (!sl || !sl.id) return;
      const wDef = GAME_DATA.ITEMS[sl.id];
      if (wDef && wDef.ammoType && !ammoAdded.has(wDef.ammoType)) {
        ammoAdded.add(wDef.ammoType);
        const cap = wDef.ammoType === 'ammo_12g' ? 24 : (wDef.ammoType === 'ammo_762' ? 40 : 60);
        this.addToBackpack(wDef.ammoType, cap);
      }
    });
    if (window.soundEngine && window.soundEngine.playMagIn) window.soundEngine.playMagIn();
    return 'Resupplied Ammo, Lethals & Tacticals!';
  }

  activateFieldUpgrade() {
    if (!this.fieldUpgrade || (!window.DEV_MODE && this.fieldUpgradeCharge < 100)) return null;
    this.fieldUpgradeCharge = 0;
    const def = GAME_DATA.ITEMS[this.fieldUpgrade];
    if (this.fieldUpgrade === 'fu_ammo_box') {
      const feetY = this.position.y - this.currentEyeHeight;
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const origin = new THREE.Vector3(this.position.x, feetY, this.position.z);
      if (this.world && this.world.deployMunitionBox) {
        this.world.deployMunitionBox(origin, fwd, 'YOU');
      }
      this._lastFieldUpgradeDeploy = {
        upgradeId: 'fu_ammo_box',
        x: Math.round(origin.x * 10) / 10,
        y: Math.round(origin.y * 10) / 10,
        z: Math.round(origin.z * 10) / 10,
        dx: Math.round(fwd.x * 100) / 100,
        dz: Math.round(fwd.z * 100) / 100
      };
      if (window.soundEngine && window.soundEngine.playThrowWhoosh) {
        try { window.soundEngine.playThrowWhoosh(false); } catch (e) {}
      }
      if (window.soundEngine && window.soundEngine.playMagIn) window.soundEngine.playMagIn();
      return 'Munition Box deployed — press [E] to resupply!';
    } else if (this.fieldUpgrade === 'fu_dead_silence') {
      this.deadSilenceTimer = 12.0;
      this.stamina = 100;
      this._lastFieldUpgradeDeploy = { upgradeId: 'fu_dead_silence', duration: 12.0 };
      window.soundEngine.playHeal();
      return 'Dead Silence active (12s silent footsteps · +3s per kill)';
    } else {
      this._lastFieldUpgradeDeploy = { upgradeId: this.fieldUpgrade };
      window.soundEngine.playMagIn();
      return `${def ? def.name : 'Field Upgrade'} deployed!`;
    }
  }

  onSprintKeyDown() {
    const now = performance.now();
    const isDoubleTap = (now - this.lastShiftPressTime) < 380;
    this.lastShiftPressTime = now;

    // Double-tap Shift (or tap Shift while already sprinting) triggers DMZ Tactical Sprint & interrupts reloads!
    if ((isDoubleTap || this.isSprinting) && !this.isADS && !this.isSliding && this.stamina >= 12) {
      this.stance = 'stand';
      this.isTacSprinting = true;
      if (this.weaponSystem && this.weaponSystem.isReloading) {
        this.weaponSystem.cancelReload();
      }
    }
  }

  onCrouchKeyDown() {
    if (this.crouchKeyHeld) return;
    this.crouchKeyHeld = true;
    this.crouchHoldTime = 0;
    this.crouchHoldTriggeredProne = false;

    // Pressing crouch while sprinting or tac-sprinting triggers a momentum-boosted tactical slide!
    if ((this.isSprinting || this.isTacSprinting) && this.onGround && !this.isSliding && this.slideCooldown <= 0) {
      const entryHoriz = Math.hypot(this.velocity.x, this.velocity.z);
      this._slideEntryWasSprinting = !!(this.isSprinting || this.isTacSprinting);
      this._slideEntryWasTacSprint = !!this.isTacSprinting;
      this._slideEntryStance = this.stance || 'stand';
      this._slideEntrySpeed = Math.max(6.8, entryHoriz);
      // Slight punchy momentum boost (+22%) on slide entry, capped cleanly
      this._slidePeakSpeed = THREE.MathUtils.clamp(this._slideEntrySpeed * 1.22, 10.8, 14.6);

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
    if (this.isDowned || this.dead || this.noclip) return;
    if (this.mantleState) return;
    if (this.ledgeState) {
      // Pressing Jump while hanging also initiates pulling up onto the ledge
      this.ledgeState.phase = 'pulling';
      return;
    }
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
    // Check for hip-height mantle or head-height ledge-grab right in front of the player
    if (this.ledgeCooldown <= 0) {
      const climb = this._findClimbableObstacle(false);
      if (climb && this._startClimb(climb)) {
        return;
      }
    }
    if (this.onGround) {
      this.velocity.y = 6.2;
      this.onGround = false;
    }
  }

  update(dt) {
    if (this.slideCooldown > 0) this.slideCooldown = Math.max(0, this.slideCooldown - dt);
    if (this.ledgeCooldown > 0) this.ledgeCooldown = Math.max(0, this.ledgeCooldown - dt);
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

    // Movement input (Rebindable Keyboard + Analog Gamepad Left Stick — suppressed when menu/inventory/map is open while physics & gravity keep running!)
    const kb = window.KEYBINDS || {};
    let moveForward = this.isMenuBlocked ? 0 : (this.padMoveY || 0);
    let moveRight = this.isMenuBlocked ? 0 : (this.padMoveX || 0);
    if (!this.isMenuBlocked) {
      if (this.keys[kb.moveForward || 'KeyW']) moveForward += 1;
      if (this.keys[kb.moveBack || 'KeyS']) moveForward -= 1;
      if (this.keys[kb.moveRight || 'KeyD']) moveRight += 1;
      if (this.keys[kb.moveLeft || 'KeyA']) moveRight -= 1;
    }
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

    // Developer Noclip free-flight mode (WASD flies in camera look direction, Space up, C/Ctrl down, Shift boost)
    if (this.noclip && !this.dead) {
      const flySpeed = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) ? 28.0 : 13.0;
      const lookDir = new THREE.Vector3(
        -Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      const flyVec = new THREE.Vector3();
      flyVec.addScaledVector(lookDir, moveForward);
      flyVec.addScaledVector(rightVec, moveRight);
      if (this.keys[kb.jump || 'Space']) flyVec.y += 1;
      if (this.keys['ControlLeft'] || this.keys[kb.crouch || 'KeyC']) flyVec.y -= 1;
      if (flyVec.lengthSq() > 0) flyVec.normalize();
      this.velocity.copy(flyVec).multiplyScalar(flySpeed);
      this.position.addScaledVector(this.velocity, dt);
      this.onGround = false;
      this.isSprinting = false;
      this.isTacSprinting = false;
      this.isSliding = false;
      this.headBobY = 0;
      this.headRoll = 0;
      this.camera.position.copy(this.position);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.camera.rotation.z = 0;
      return;
    }

    // Active Hip-Height Mantle (smooth quick vault/step-up onto hip-height obstacle)
    if (this.mantleState && !this.dead && !this.isDowned) {
      const ms = this.mantleState;
      ms.t = Math.min(1, ms.t + dt / ms.duration);
      const u = 1 - Math.pow(1 - ms.t, 2.2); // crisp ease-out
      const inv = 1 - u;
      // Quadratic Bezier arc from startPos -> midPos -> endPos
      this.position.set(
        inv * inv * ms.startPos.x + 2 * inv * u * ms.midPos.x + u * u * ms.endPos.x,
        inv * inv * ms.startPos.y + 2 * inv * u * ms.midPos.y + u * u * ms.endPos.y,
        inv * inv * ms.startPos.z + 2 * inv * u * ms.midPos.z + u * u * ms.endPos.z
      );
      this.currentEyeHeight = this.standEyeHeight;
      this.velocity.set(0, 0, 0);
      this.onGround = false;
      const vaultRoll = Math.sin(ms.t * Math.PI) * 0.048;
      const vaultPitch = -Math.sin(ms.t * Math.PI) * 0.055;
      if (ms.t >= 1) {
        this.position.copy(ms.endPos);
        this.mantleState = null;
        this.onGround = true;
        this.stance = 'stand';
      }
      this._updateThirdPersonModel(dt);
      if (!this.isThirdPerson) {
        this.camera.position.copy(this.position);
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.yaw;
        this.camera.rotation.x = THREE.MathUtils.clamp(this.pitch + vaultPitch, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08);
        this.camera.rotation.z = vaultRoll;
      }
      return;
    }

    // Active Head-Height Progressive Ledge-Grab (both hands on ledge; W pulls up progressively, other movement lets go!)
    if (this.ledgeState && !this.dead && !this.isDowned) {
      const ls = this.ledgeState;
      this.isFiring = false;
      this.isADS = false;
      this.isSprinting = false;
      this.isTacSprinting = false;
      this.velocity.set(0, 0, 0);
      this.onGround = false;
      this.currentEyeHeight = this.standEyeHeight;

      // Gently clamp head-look yaw within ±85° of the ledge normal while hands stay anchored to the ledge
      let yawDiff = this.yaw - ls.ledgeYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      if (Math.abs(yawDiff) > 1.48) {
        this.yaw = ls.ledgeYaw + Math.sign(yawDiff) * 1.48;
      }

      const pressingForward = moveForward > 0.25 || !!this.keys[kb.jump || 'Space'];
      const pressingCancel = (moveForward < -0.25) || (Math.abs(moveRight) > 0.25) || !!this.keys[kb.crouch || 'KeyC'] || !!this.keys['ControlLeft'];

      if (ls.phase === 'grabbing') {
        ls.grabT = Math.min(1, ls.grabT + dt / 0.16);
        const ease = 1 - Math.pow(1 - ls.grabT, 2);
        this.position.lerpVectors(ls.startPos, ls.hangPos, ease);
        if (ls.grabT >= 1) ls.phase = 'hanging';
      } else {
        if (pressingCancel) {
          // Let go of the ledge cleanly!
          this.position.x -= ls.inwardX * 0.20;
          this.position.z -= ls.inwardZ * 0.20;
          this.velocity.set(-ls.inwardX * 1.2, -0.8, -ls.inwardZ * 1.2);
          this.ledgeState = null;
          this.ledgeCooldown = 0.45;
          return;
        }
        if (pressingForward) {
          ls.phase = 'pulling';
          ls.pullProgress = Math.min(1, ls.pullProgress + dt / 0.62);
        } else {
          ls.phase = 'hanging';
          if (ls.pullProgress > 0 && ls.pullProgress < 0.65) {
            ls.pullProgress = Math.max(0, ls.pullProgress - dt * 0.75);
          }
        }

        // Progressive 2-stage pull curve: hoist vertically (0..0.68), then vault forward onto top (0.68..1.0)
        const p = ls.pullProgress;
        const riseT = THREE.MathUtils.clamp(p / 0.68, 0, 1);
        const riseEase = riseT * riseT * (3 - 2 * riseT);
        const vaultT = THREE.MathUtils.clamp((p - 0.62) / 0.38, 0, 1);
        const vaultEase = vaultT * vaultT * (3 - 2 * vaultT);

        const curX = THREE.MathUtils.lerp(ls.hangPos.x, ls.endPos.x, riseEase * 0.22 + vaultEase * 0.78);
        const curZ = THREE.MathUtils.lerp(ls.hangPos.z, ls.endPos.z, riseEase * 0.22 + vaultEase * 0.78);
        const peakY = ls.endPos.y + 0.08;
        const curY = p < 0.68
          ? THREE.MathUtils.lerp(ls.hangPos.y, peakY, riseEase)
          : THREE.MathUtils.lerp(peakY, ls.endPos.y, vaultEase);
        this.position.set(curX, curY, curZ);

        if (ls.pullProgress >= 1) {
          this.position.copy(ls.endPos);
          this.ledgeState = null;
          this.ledgeCooldown = 0.25;
          this.onGround = true;
          this.stance = 'stand';
          if (window.soundEngine && window.soundEngine.playFootstep) {
            try { window.soundEngine.playFootstep(true); } catch (e) {}
          }
        }
      }

      const heavePitch = ls.phase === 'pulling' ? -Math.sin(ls.pullProgress * Math.PI) * 0.075 : 0;
      const heaveRoll = ls.phase === 'pulling' ? Math.sin(ls.pullProgress * Math.PI * 2) * 0.028 : 0;
      this._updateThirdPersonModel(dt);
      if (!this.isThirdPerson) {
        this.camera.position.copy(this.position);
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.yaw;
        this.camera.rotation.x = THREE.MathUtils.clamp(this.pitch + heavePitch, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08);
        this.camera.rotation.z = heaveRoll;
      }
      return;
    }

    // Sprinting out of crouch/prone smoothly stands player up (Normal sprint is infinite like DMZ!)
    const wantsSprintInput = !!((this.keys['ShiftLeft'] || this.padSprint) && moveForward > 0.35 && !this.isADS);
    if (!this.isSliding && wantsSprintInput && this.stance !== 'stand') {
      this.stance = 'stand';
    }

    const busyHands = !!(this.weaponSystem && (this.weaponSystem.isPlating || this.weaponSystem.isHealing));

    // Dead (eliminated, awaiting slow ally revive): corpse frozen on terrain; camera spectates living ally in main.js!
    if (this.dead) {
      this.velocity.x = 0;
      this.velocity.z = 0;
      this.isFiring = false;
      this.isADS = false;
      const gyDead = (this.world && this.world.getTerrainHeight) ? this.world.getTerrainHeight(this.position.x, this.position.z) : 0;
      this.currentEyeHeight = THREE.MathUtils.lerp(this.currentEyeHeight, 0.38, Math.min(1, dt * 8));
      this.position.y = gyDead + this.currentEyeHeight;
      if (!this.spectatingAlly) {
        this.camera.position.copy(this.position);
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.yaw;
        this.camera.rotation.x = this.pitch;
      }
      return;
    }

    // Downed state: player can crawl slowly to safety (UNLESS being revived or dragged!), bleeds out if not being revived
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
      if (this.beingDragged || this.beingRevivedBy) {
        this.velocity.x = 0;
        this.velocity.z = 0;
      } else {
        const crawlSpeed = (GAME_DATA.OPERATOR_STATS && GAME_DATA.OPERATOR_STATS.downedSpeed) || 1.9;
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
        this.slideDir.lerp(wishDir, Math.min(1, dt * 2.4)).normalize();
      }
      // Momentum-boosted slide curve: initial surge to peak speed, then smooth friction decay toward previous stance speed!
      const entrySpd = this._slideEntrySpeed || 9.6;
      const peakSpd = this._slidePeakSpeed || 12.6;
      const wantsContinueSprint = !!(this._slideEntryWasSprinting && (wantsSprintInput || moveForward > 0.25) && !(this.crouchKeyHeld && this.crouchHoldTime >= 0.28));
      const exitTargetSpd = wantsContinueSprint ? 9.6 : ((this.crouchKeyHeld && this.crouchHoldTime >= 0.28) ? 2.2 : 4.2);
      let slideSpeed;
      if (sp < 0.18) {
        // Quick +22% momentum surge into the slide
        slideSpeed = THREE.MathUtils.lerp(entrySpd, peakSpd, sp / 0.18);
      } else {
        // Smooth gradual bleed back down to the target exit speed
        const decay = (sp - 0.18) / 0.82;
        slideSpeed = THREE.MathUtils.lerp(peakSpd, exitTargetSpd, decay * decay);
      }
      this.velocity.x = this.slideDir.x * slideSpeed;
      this.velocity.z = this.slideDir.z * slideSpeed;
      this.isSprinting = false;
      this.isTacSprinting = false;

      if (this.slideTimer <= 0) {
        this.isSliding = false;
        if (this.crouchKeyHeld && this.crouchHoldTime >= 0.28) {
          this.stance = 'prone';
        } else if (wantsContinueSprint) {
          // Dynamically pop straight back into sprinting out of the slide with preserved momentum!
          this.stance = 'stand';
          this.isSprinting = true;
          if (this._slideEntryWasTacSprint && wantsSprintInput && this.stamina >= 15) {
            this.isTacSprinting = true;
          }
        } else {
          this.stance = 'crouch';
        }
      }
    } else {
      const wantsSprint = !!(wantsSprintInput && this.stance === 'stand');
      if (wantsSprint) {
        this.isSprinting = true;
        // DMZ Tactical Sprint drains dedicated Tac-Sprint stamina & interrupts active reloads (preserving staged progress!)
        if (this.isTacSprinting && !busyHands && this.stamina > 0) {
          if (this.weaponSystem && this.weaponSystem.isReloading) {
            this.weaponSystem.cancelReload();
          }
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

      const opStats = GAME_DATA.OPERATOR_STATS || {};
      let speed = opStats.walkSpeed || 6.8;
      if (this.isTacSprinting) speed = opStats.tacSprintSpeed || 12.4;
      else if (this.isSprinting) speed = opStats.sprintSpeed || 9.6;
      else if (this.stance === 'prone') speed = opStats.proneSpeed || opStats.downedSpeed || 1.9;
      else if (this.stance === 'crouch') speed = opStats.crouchSpeed || 3.9;
      else if (this.isADS) speed = opStats.adsSpeed || 4.3;

      // Dedicated melee weapon gives a slight movement & sprint speed boost (+12%, not while prone)
      if (this.activeSlot === 'melee' && this.stance !== 'prone') {
        speed *= 1.12;
      }

      // === MOMENTUM-BASED HORIZONTAL ACCELERATION & GROUND FRICTION ===
      const targetVx = wishDir.x * speed * moveMag;
      const targetVz = wishDir.z * speed * moveMag;
      const hasInput = moveMag > 0.05;
      let accelRate;
      if (!this.onGround) {
        // Reduced air control so momentum carries naturally through jumps
        accelRate = hasInput ? 3.2 : 1.0;
      } else if (!hasInput) {
        // Crisp ground friction deceleration when releasing movement keys
        accelRate = 12.0;
      } else {
        // Gradual weighty buildup: walk ramps smoothly, sprint & tac-sprint build momentum progressively!
        const curSpd = Math.hypot(this.velocity.x, this.velocity.z);
        const dot = curSpd > 0.2 ? ((this.velocity.x * wishDir.x + this.velocity.z * wishDir.z) / curSpd) : 1;
        if (dot < 0.2) {
          // Responsive counter-strafe / direction-change traction
          accelRate = 11.0;
        } else if (this.isTacSprinting) {
          accelRate = 5.2;
        } else if (this.isSprinting) {
          accelRate = 6.5;
        } else {
          accelRate = 9.5;
        }
      }
      const blend = 1 - Math.exp(-accelRate * dt);
      this.velocity.x += (targetVx - this.velocity.x) * blend;
      this.velocity.z += (targetVz - this.velocity.z) * blend;
      if (!hasInput && Math.hypot(this.velocity.x, this.velocity.z) < 0.04) {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
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

    // Axis-separated AABB collision (with smooth auto-step-up for low curbs <= 0.36m)
    const curFeetY = this.position.y - this.currentEyeHeight;
    const nextX = this.position.x + this.velocity.x * dt;
    if (!this._collidesAt(nextX, this.position.y, this.position.z)) {
      this.position.x = nextX;
    } else if (this.onGround && !this._collidesAt(nextX, this.position.y + 0.36, this.position.z)) {
      const stepY = this._getSupportHeightAt(nextX, this.position.z, curFeetY);
      if (stepY > curFeetY && stepY <= curFeetY + 0.36) {
        this.position.x = nextX;
        this.position.y = stepY + this.currentEyeHeight;
      } else {
        this.velocity.x = 0;
      }
    } else {
      this.velocity.x = 0;
    }

    const nextZ = this.position.z + this.velocity.z * dt;
    if (!this._collidesAt(this.position.x, this.position.y, nextZ)) {
      this.position.z = nextZ;
    } else if (this.onGround && !this._collidesAt(this.position.x, this.position.y + 0.36, nextZ)) {
      const stepY = this._getSupportHeightAt(this.position.x, nextZ, this.position.y - this.currentEyeHeight);
      if (stepY > (this.position.y - this.currentEyeHeight) && stepY <= (this.position.y - this.currentEyeHeight) + 0.36) {
        this.position.z = nextZ;
        this.position.y = stepY + this.currentEyeHeight;
      } else {
        this.velocity.z = 0;
      }
    } else {
      this.velocity.z = 0;
    }

    // Vertical movement + standing on top of shipping containers, crates & objects + ceiling clamp
    const prevFeetY = this.position.y - this.currentEyeHeight;
    let nextEyeY = this.position.y + this.velocity.y * dt;
    if (this.velocity.y > 0) {
      const ceilY = this._getCeilingHeightAt(this.position.x, this.position.z, prevFeetY);
      if (nextEyeY + 0.18 > ceilY) {
        nextEyeY = ceilY - 0.18;
        this.velocity.y = 0;
      }
    }
    const nextFeetY = nextEyeY - this.currentEyeHeight;
    const supportY = this._getSupportHeightAt(this.position.x, this.position.z, Math.max(prevFeetY, nextFeetY));

    if (this.velocity.y <= 0 && nextFeetY <= supportY + 0.03) {
      this.position.y = supportY + this.currentEyeHeight;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.position.y = nextEyeY;
      this.onGround = false;
    }

    // Automatic mid-air head-height ledge catch when jumping toward a tall container/wall while holding forward or jump
    if (!this.onGround && !this.isDowned && !this.dead && this.ledgeCooldown <= 0 && this.velocity.y > -2.5 && (moveForward > 0.3 || this.keys[kb.jump || 'Space'])) {
      const airLedge = this._findClimbableObstacle(true);
      if (airLedge && airLedge.kind === 'ledge') {
        this._startClimb(airLedge);
      }
    }

    // Footsteps & weighty stride head-bob (suppressed while sliding)
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.onGround && !this.isSliding && horizSpeed > 0.9) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = this.isTacSprinting ? 0.30 : (this.isSprinting ? 0.38 : (this.isProne ? 0.95 : (this.isCrouching ? 0.72 : 0.56)));
        if ((this.deadSilenceTimer || 0) <= 0) {
          const feetY = this.position.y - (this.currentEyeHeight || 1.65);
          const surf = (this.world && this.world.getTerrainHeight && feetY > this.world.getTerrainHeight(this.position.x, this.position.z) + 0.12)
            ? 'concrete'
            : 'grass';
          window.soundEngine.playFootstep(this.isSprinting || this.isTacSprinting, surf);
        }
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

    // Automatic Progressive Corner-Peeking Lean: ONLY when ADS and slowly approaching a full-height wall corner!
    let targetLean = 0;
    if (this.isADS && horizSpeed <= 3.6 && !this.isSprinting && !this.isTacSprinting && !this.isSliding && !this.isDowned && !this.dead && !this.ledgeState && !this.mantleState) {
      const rayTallWallAt = (ox, oy, oz, dx, dz, maxDist) => {
        for (let d = 0.22; d <= maxDist; d += 0.14) {
          if (this._hasTallWallAt(ox + dx * d, oy, oz + dz * d)) return d;
        }
        return maxDist;
      };

      const eyeY = this.position.y;
      const fwdX = forwardVec.x, fwdZ = forwardVec.z;
      const rX = rightVec.x, rZ = rightVec.z;

      const detectRange = 1.60; // tight corner-approach distance
      const centerDist = rayTallWallAt(this.position.x, eyeY, this.position.z, fwdX, fwdZ, detectRange);

      // Probe lateral offsets (0.36m .. 1.05m) to find an open corner edge next to a full-height wall
      const offsets = [0.36, 0.58, 0.82, 1.05];
      let leftClearOffset = null;
      let rightClearOffset = null;
      for (const off of offsets) {
        if (leftClearOffset === null) {
          const lx = this.position.x - rX * off, lz = this.position.z - rZ * off;
          if (!this._hasTallWallAt(lx, eyeY, lz) && rayTallWallAt(lx, eyeY, lz, fwdX, fwdZ, detectRange + 0.45) > detectRange + 0.15) {
            leftClearOffset = off;
          }
        }
        if (rightClearOffset === null) {
          const rx = this.position.x + rX * off, rz = this.position.z + rZ * off;
          if (!this._hasTallWallAt(rx, eyeY, rz) && rayTallWallAt(rx, eyeY, rz, fwdX, fwdZ, detectRange + 0.45) > detectRange + 0.15) {
            rightClearOffset = off;
          }
        }
      }

      const frontBlocked = centerDist < 1.45;
      const leftOpen = leftClearOffset !== null;
      const rightOpen = rightClearOffset !== null;

      if (frontBlocked && (leftOpen !== rightOpen)) {
        // Closer to the tall wall corner AND closer laterally to the corner edge => progressively deeper lean!
        const forwardProx = THREE.MathUtils.clamp((1.45 - centerDist) / 0.95, 0.20, 1.0);
        const edgeOff = rightOpen ? rightClearOffset : leftClearOffset;
        const edgeFactor = THREE.MathUtils.clamp(1.22 - (edgeOff - 0.36) / 0.95, 0.40, 1.0);
        targetLean = (rightOpen ? 1 : -1) * Math.min(1.0, forwardProx * 0.55 + edgeFactor * 0.55);
      } else if (this.world && this.world.doors && this.world.doors.length > 0) {
        // Continuing to ADS close to the edge/jamb of an open or peeked door triggers tactical lean around it!
        const feetY = this.position.y - this.currentEyeHeight;
        for (let i = 0; i < this.world.doors.length; i++) {
          const d = this.world.doors[i];
          if (d.state === 'closed') continue;
          if (Math.abs(feetY - d.hingePos.y) > 2.2) continue;
          const distCenter = Math.hypot(this.position.x - d.center.x, this.position.z - d.center.z);
          if (distCenter > 2.35) continue;
          const dHinge = Math.hypot(this.position.x - d.hingePos.x, this.position.z - d.hingePos.z);
          const dJambR = Math.hypot(this.position.x - d.jambRightPos.x, this.position.z - d.jambRightPos.z);
          const nearestJamb = dHinge < dJambR ? d.hingePos : d.jambRightPos;
          const nearDist = Math.min(dHinge, dJambR);
          if (nearDist < 1.35) {
            // Lean TOWARD the open doorway center (away from the jamb edge!)
            const toCenterX = d.center.x - nearestJamb.x;
            const toCenterZ = d.center.z - nearestJamb.z;
            const lat = toCenterX * rX + toCenterZ * rZ;
            if (Math.abs(lat) > 0.15) {
              const strength = THREE.MathUtils.clamp((1.35 - nearDist) / 0.85, 0.45, 0.95);
              targetLean = (lat > 0 ? 1 : -1) * strength;
              break;
            }
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

    // Tick temporary Bandage/Painkiller health duration & 2.5s automatic health regeneration!
    if (!this.dead && !this.isDowned) {
      if (this.tempHealthTimer > 0) {
        this.tempHealthTimer -= dt;
        if (this.tempHealthTimer <= 0) {
          this.tempHealthTimer = 0;
          this.tempHealthRestored = 0;
          this.tempHealthSource = null;
          const effMax = this.getEffectiveMaxHp();
          if (this.hp > effMax) this.hp = effMax;
        }
      }
      this.timeSinceDamaged = (this.timeSinceDamaged || 0) + dt;
      if (this.timeSinceDamaged >= 2.5) {
        const effMax = this.getEffectiveMaxHp();
        if (this.hp < effMax) {
          this.hp = Math.min(effMax, this.hp + 28 * dt);
        }
      }
    }

    // Track Stance Transitions (Stand <-> Crouch <-> Prone) for 1P & 3P transition animations!
    if (this.stance !== this._prevStance && !this.isSliding && !this.isDowned) {
      const involvesProne = this.stance === 'prone' || this._prevStance === 'prone';
      this.stanceTrans = {
        from: this._prevStance,
        to: this.stance,
        duration: involvesProne ? 0.48 : 0.28,
        timer: involvesProne ? 0.48 : 0.28
      };
      this._prevStance = this.stance;
    } else if (this.stanceTrans && this.stanceTrans.timer > 0) {
      this.stanceTrans.timer = Math.max(0, this.stanceTrans.timer - dt);
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
