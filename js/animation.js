// ============================================================================
// ASHFALL // MW2 (IW9-Style) Unified Character Rigging & Layered Animation System
// Shared across Player (3P), AI Operators, Friendly Squadmates & All NPCs!
// Features:
//   - Full anatomical bone hierarchy (pelvis -> spineLower -> spineUpper ->
//     clavicles -> shoulders -> elbows -> wrists; hips -> knees -> ankles -> toes)
//   - Chest-anchored weaponPivot with real-time Analytical 2-Bone Arm IK
//     locking right hand to rear grip & left hand to foregrip/handguard
//   - Upper/Lower body split, stride warping, pelvis counter-rotation & 2-foot terrain IK
//   - Layered additive Idle Breathing, Aim-Pitch distribution, Recoil & Hit-Flinch
//   - MW2 High-Port Tactical Sprint, Tactical Slide, Propped-Up Prone (zero clipping)
//   - 4-Stage Unzip -> Pull Ceramic Plate -> Insert -> Zip Closed Armor Plating
// ============================================================================

(function () {
  const _vA = new THREE.Vector3();
  const _vB = new THREE.Vector3();
  const _vC = new THREE.Vector3();
  const _vD = new THREE.Vector3();
  const _vE = new THREE.Vector3();
  const _qA = new THREE.Quaternion();
  const _mA = new THREE.Matrix4();
  const _upY = new THREE.Vector3(0, 1, 0);
  const _negY = new THREE.Vector3(0, -1, 0);

  function smoothstep(t) {
    const x = THREE.MathUtils.clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  }

  // Analytical 2-Bone Arm IK in torso-local space (Law of Cosines + pole vector)
  // Upper arm length L1 = 0.28, forearm length L2 = 0.26, local rest bone points along -Y
  function solveArmIKInTorsoSpace(arm, targetInTorso, poleDirInTorso, weight = 1.0) {
    if (!arm || !arm.shoulder || !arm.elbow || weight <= 0.001) return;
    const L1 = 0.28;
    const L2 = 0.26;
    const shPos = arm.shoulder.position;
    _vA.subVectors(targetInTorso, shPos);
    const rawDist = _vA.length();
    if (rawDist < 0.001) return;

    const maxReach = (L1 + L2) * 0.985;
    const minReach = Math.abs(L1 - L2) + 0.05;
    const d = THREE.MathUtils.clamp(rawDist, minReach, maxReach);
    _vA.multiplyScalar(1 / rawDist); // unit dir from shoulder to target

    // Law of cosines for shoulder angle alpha (angle between target dir and upper arm)
    const cosAlpha = THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const alpha = Math.acos(cosAlpha);

    // Orthonormal bend plane using poleDirInTorso (points outward & down for human elbow)
    _vB.copy(poleDirInTorso).addScaledVector(_vA, -poleDirInTorso.dot(_vA));
    if (_vB.lengthSq() < 1e-5) _vB.set(0, -1, 0);
    _vB.normalize();

    // Desired upper-arm unit vector (points from shoulder to elbow)
    _vC.copy(_vA).multiplyScalar(Math.cos(alpha)).addScaledVector(_vB, Math.sin(alpha)).normalize();

    // Elbow position & desired forearm unit vector (elbow to target)
    _vD.copy(shPos).addScaledVector(_vC, L1);
    _vE.subVectors(targetInTorso, _vD);
    if (_vE.lengthSq() < 1e-6) _vE.copy(_vC);
    else _vE.normalize();

    // Build shoulder orientation: local -Y maps to _vC, local +Z (back of elbow) aligns away from forearm bend
    // In our rig, elbow flexion (+X rotation) swings forearm from -Y toward -Z (forward).
    // So local -Z of upper arm must lie in the bend plane toward _vE!
    const yAxis = _vD.copy(_vC).multiplyScalar(-1).normalize(); // local +Y points opposite upper arm
    // Project forearm dir onto plane perpendicular to upper arm to define local -Z (forward flex direction)
    const bendFwd = _vB.copy(_vE).addScaledVector(_vC, -_vE.dot(_vC));
    if (bendFwd.lengthSq() < 1e-5) bendFwd.set(0, 0, -1);
    bendFwd.normalize();
    const zAxis = bendFwd.multiplyScalar(-1); // local +Z is opposite flex direction
    const xAxis = _vA.crossVectors(yAxis, zAxis).normalize();
    zAxis.crossVectors(xAxis, yAxis).normalize();

    _mA.makeBasis(xAxis, yAxis, zAxis);
    _qA.setFromRotationMatrix(_mA);

    if (weight >= 0.999) {
      arm.shoulder.quaternion.copy(_qA);
    } else {
      arm.shoulder.quaternion.slerp(_qA, weight);
    }

    // Elbow bend angle (always positive X in our rig -> bends forearm toward local -Z)
    const cosElb = THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1);
    const elbowBend = Math.PI - Math.acos(cosElb);
    arm.elbow.rotation.set(
      THREE.MathUtils.lerp(arm.elbow.rotation.x, elbowBend, weight),
      0,
      0
    );
  }

  // ==========================================================================
  // UNIFIED MW2 CHARACTER RIG BUILDER
  // ==========================================================================
  function buildCharacterRig(opts = {}) {
    const archetype = opts.archetype || 'operator';
    const isScav = archetype === 'scavenger';
    const isRaider = archetype === 'raider';
    const isHeavy = archetype === 'heavy' || archetype === 'boss' || archetype === 'boss_guard';

    const uniformHex = opts.uniformColor != null ? opts.uniformColor : (isScav ? 0x5c4738 : (isRaider ? 0x4b4232 : 0x3b4437));
    const uniformCol = new THREE.Color(uniformHex);
    const uniformDark = uniformCol.clone().multiplyScalar(0.76);
    const pantsCol = opts.pantsColor != null ? new THREE.Color(opts.pantsColor) : uniformCol.clone().multiplyScalar(0.80);

    const uniformMat = new THREE.MeshLambertMaterial({ color: uniformCol });
    const uniformDarkMat = new THREE.MeshLambertMaterial({ color: uniformDark });
    const pantsMat = new THREE.MeshLambertMaterial({ color: pantsCol });
    const gearMat = new THREE.MeshLambertMaterial({ color: 0x1e2124 });
    const strapMat = new THREE.MeshLambertMaterial({ color: 0x262925 });
    const padMat = new THREE.MeshLambertMaterial({ color: 0x171a19 });
    const helmetMat = new THREE.MeshLambertMaterial({ color: opts.helmetColor != null ? opts.helmetColor : (isHeavy ? 0x1c1f24 : 0x2d332b) });
    const skinMat = new THREE.MeshLambertMaterial({ color: opts.headColor != null ? opts.headColor : 0xd1a483 });
    const balaclavaMat = new THREE.MeshLambertMaterial({ color: isScav ? 0x3d332a : 0x222522 });
    const visorMat = new THREE.MeshLambertMaterial({ color: isHeavy ? 0x4a1d1d : 0x101820, emissive: isHeavy ? 0x220808 : 0x061018 });

    const root = new THREE.Group();
    // Local character forward is -Z; rotate root (NOT rigPivot!) by PI so rigPivot's local X/Y/Z pitch/roll/lean
    // is 100% identical between Player 3P, Enemy Operators, NPCs & Squadmates (never inverted by XYZ Euler order!)
    if (opts.faceForwardZ) root.rotation.y = Math.PI;
    const rigPivot = new THREE.Group();
    rigPivot.rotation.order = 'YXZ';
    root.add(rigPivot);

    // 1. PELVIS (Center of Mass / Lower-Body Root)
    const pelvis = new THREE.Group();
    pelvis.position.set(0, 0.90, 0);
    rigPivot.add(pelvis);

    const hipBlock = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.22), pantsMat);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.055, 0.24), gearMat);
    belt.position.y = 0.07;
    const beltPouchL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.08), strapMat);
    beltPouchL.position.set(-0.20, 0.04, 0.02);
    const beltPouchR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.08), strapMat);
    beltPouchR.position.set(0.20, 0.04, 0.02);
    pelvis.add(hipBlock, belt, beltPouchL, beltPouchR);

    // 2. SPINE LOWER -> SPINE UPPER (TORSO / CHEST) -> NECK -> HEAD
    const spine = new THREE.Group();
    spine.position.set(0, 0.08, 0);
    pelvis.add(spine);

    const lowerAbdomen = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.21), uniformDarkMat);
    lowerAbdomen.position.set(0, 0.07, 0);
    spine.add(lowerAbdomen);

    const torso = new THREE.Group();
    torso.position.set(0, 0.11, 0);
    spine.add(torso);

    const chestW = isHeavy ? 0.44 : 0.39;
    const chestD = isHeavy ? 0.27 : 0.23;
    const chest = new THREE.Mesh(new THREE.BoxGeometry(chestW, 0.40, chestD), uniformMat);
    chest.position.set(0, 0.20, 0);
    torso.add(chest);

    // Plate Carrier / Tactical Vest
    const vestGroup = new THREE.Group();
    const vestId = opts.vestId || (isHeavy ? 'vest_3' : (isScav ? 'none' : 'vest_2'));
    const vestColor = opts.vestColor != null
      ? opts.vestColor
      : (vestId === 'vest_3' ? 0x26292d : (vestId === 'vest_2' ? 0x3b4238 : (vestId === 'vest_1' ? 0x4b4739 : 0x343832)));
    const vestMat = new THREE.MeshLambertMaterial({ color: vestColor });
    const plateFront = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.33, 0.065), vestMat);
    plateFront.position.set(0, 0.22, -0.13);
    const plateBack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.065), vestMat);
    plateBack.position.set(0, 0.22, 0.13);
    const cummerbund = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.15, 0.25), vestMat);
    cummerbund.position.set(0, 0.13, 0);
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.25), strapMat);
    strapL.position.set(-0.12, 0.39, 0);
    const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.25), strapMat);
    strapR.position.set(0.12, 0.39, 0);
    // Front mag pouches + plate carrier zipper flap detail
    const magPouchRow = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.11, 0.045), strapMat);
    magPouchRow.position.set(0, 0.12, -0.17);
    const carrierFlap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.02), gearMat);
    carrierFlap.position.set(0, 0.34, -0.165);

    const heavyExtras = new THREE.Group();
    const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.20), vestMat);
    pauldronL.position.set(-0.27, 0.33, 0);
    const pauldronR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.20), vestMat);
    pauldronR.position.set(0.27, 0.33, 0);
    const groinFlap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.045), vestMat);
    groinFlap.position.set(0, -0.04, -0.145);
    heavyExtras.add(pauldronL, pauldronR, groinFlap);
    heavyExtras.visible = isHeavy || vestId === 'vest_3';
    vestGroup.add(plateFront, plateBack, cummerbund, strapL, strapR, magPouchRow, carrierFlap, heavyExtras);
    vestGroup.visible = vestId !== 'none';
    torso.add(vestGroup);

    // Backpack
    const packGroup = new THREE.Group();
    const bagId = opts.bagId || (isScav ? 'none' : (isRaider ? 'bag_small' : 'bag_medium'));
    const packMat = new THREE.MeshLambertMaterial({ color: bagId === 'bag_large' ? 0x353b31 : 0x3f433a });
    const packMain = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.13), packMat);
    packMain.position.set(0, 0.20, 0.20);
    const packTopPouch = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.10, 0.075), strapMat);
    packTopPouch.position.set(0, 0.30, 0.275);
    const packLargeExtras = new THREE.Group();
    const sidePouchL = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.20, 0.10), strapMat);
    sidePouchL.position.set(-0.17, 0.17, 0.20);
    const sidePouchR = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.20, 0.10), strapMat);
    sidePouchR.position.set(0.17, 0.17, 0.20);
    packLargeExtras.add(sidePouchL, sidePouchR);
    packLargeExtras.visible = bagId === 'bag_large';
    packGroup.add(packMain, packTopPouch, packLargeExtras);
    packGroup.visible = bagId !== 'none';
    torso.add(packGroup);

    // 3. NECK & HEAD
    const neck = new THREE.Group();
    neck.position.set(0, 0.41, 0);
    torso.add(neck);

    const head = new THREE.Group();
    head.position.set(0, 0.04, 0);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.22, 0.21), skinMat);
    skull.position.set(0, 0.11, 0);
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.206, 0.11, 0.216), balaclavaMat);
    mask.position.set(0, 0.055, 0);
    head.add(skull, mask);

    if (!isScav) {
      const helmetDome = new THREE.Mesh(new THREE.BoxGeometry(isHeavy ? 0.26 : 0.24, 0.14, isHeavy ? 0.27 : 0.25), helmetMat);
      helmetDome.position.set(0, 0.185, 0.005);
      const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.04), gearMat);
      nvgMount.position.set(0, 0.20, -0.13);
      const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.195, 0.058, 0.042), visorMat);
      goggles.position.set(0, 0.135, -0.105);
      const earCupL = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.085, 0.075), gearMat);
      earCupL.position.set(-0.125, 0.12, 0.01);
      const earCupR = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.085, 0.075), gearMat);
      earCupR.position.set(0.125, 0.12, 0.01);
      head.add(helmetDome, nvgMount, goggles, earCupL, earCupR);
    } else {
      // Scavenger beanie/cap
      const beanie = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.09, 0.225), new THREE.MeshLambertMaterial({ color: 0x3a3228 }));
      beanie.position.set(0, 0.20, 0.0);
      head.add(beanie);
    }
    neck.add(head);

    // 4. ARTICULATED LEGS (Hip -> Thigh -> Knee + KneePad -> Shin -> Ankle -> Combat Boot)
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

    // 5. CHEST-ANCHORED WEAPON PIVOT (MW2 Shouldered Weapon Anchor + Dual-Hand IK Targets!)
    // Sitting in the right shoulder pocket in torso-local space so weapon stays dead-solid on shoulder
    const weaponPivot = new THREE.Group();
    weaponPivot.position.set(0.14, 0.32, -0.24);
    torso.add(weaponPivot);

    const weaponMount = new THREE.Group();
    weaponMount.position.set(0, 0, 0);
    weaponPivot.add(weaponMount);

    // Exact grip anchors on the weapon (in weaponPivot local space) for 2-Bone Analytical Hand IK!
    const rearGripTarget = new THREE.Object3D();
    rearGripTarget.position.set(0.01, -0.06, 0.04); // Right glove on pistol grip
    weaponPivot.add(rearGripTarget);

    const foregripTarget = new THREE.Object3D();
    foregripTarget.position.set(-0.01, -0.04, -0.24); // Left glove on handguard / foregrip
    weaponPivot.add(foregripTarget);

    // 6. ARTICULATED ARMS (Shoulder -> Upper Arm -> Elbow -> Forearm -> Wrist + Props)
    let plateProp = null;
    let handMag = null;
    let handShell = null;
    let inventoryTablet = null;

    const makeArm = (xOff, isRight) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(xOff, 0.34, 0);
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

      if (!isRight) {
        // 3D Ceramic Armor Plate prop for MW2 4-stage plating animation
        plateProp = new THREE.Group();
        const plateBody = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.21, 0.022), new THREE.MeshLambertMaterial({ color: 0x22384c }));
        const plateTrim = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.028, 0.026), new THREE.MeshLambertMaterial({ color: 0x4ea8de }));
        plateTrim.position.y = 0.068;
        plateProp.add(plateBody, plateTrim);
        plateProp.position.set(0.01, -0.10, -0.04);
        plateProp.rotation.set(0.35, 0, 0.12);
        plateProp.visible = false;

        handMag = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.15, 0.065), new THREE.MeshLambertMaterial({ color: 0x4c5259 }));
        handMag.position.set(0.02, -0.06, -0.03);
        handMag.visible = false;

        handShell = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.075, 8), new THREE.MeshLambertMaterial({ color: 0xb52b2b }));
        handShell.rotation.z = Math.PI / 2;
        handShell.position.set(0.02, -0.05, -0.03);
        handShell.visible = false;

        inventoryTablet = new THREE.Group();
        const tabBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.020, 0.16), gearMat);
        const tabScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.185, 0.125), new THREE.MeshBasicMaterial({ color: 0x164a3a }));
        tabScreen.rotation.x = -Math.PI / 2;
        tabScreen.position.y = 0.012;
        inventoryTablet.add(tabBody, tabScreen);
        inventoryTablet.position.set(0.09, -0.07, -0.08);
        inventoryTablet.rotation.set(0.45, 0.12, -0.12);
        inventoryTablet.visible = false;

        wrist.add(plateProp, handMag, handShell, inventoryTablet);
      }

      elbow.add(elbowPad, forearm, wrist);
      shoulder.add(elbow);
      torso.add(shoulder);
      return { shoulder, elbow, wrist };
    };
    const leftArm = makeArm(isHeavy ? -0.28 : -0.25, false);
    const rightArm = makeArm(isHeavy ? 0.28 : 0.25, true);

    return {
      root, rigPivot, pelvis, spine, torso, chest, neck, head, skull,
      leftLeg, rightLeg, leftArm, rightArm,
      weaponPivot, weaponMount, rearGripTarget, foregripTarget,
      vestGroup, vestMat, heavyExtras, packGroup, packMat, packLargeExtras,
      carrierFlap, plateProp, handMag, handShell, inventoryTablet,
      isMW2Rig: true
    };
  }

  // ==========================================================================
  // UNIFIED MW2 LAYERED ANIMATION CONTROLLER (Game-Wide: Player, AI Ops, NPCs)
  // ==========================================================================
  class MW2Animator {
    constructor(rig) {
      this.rig = rig;
      this.walkPhase = Math.random() * Math.PI * 2;
      this.idleTime = Math.random() * 10.0;
      this.recoilImpulse = 0;
      this.flinchImpulse = 0;
      this.flinchDir = 1;
      this._rTarget = new THREE.Vector3();
      this._lTarget = new THREE.Vector3();
      this._rPole = new THREE.Vector3(0.75, -0.55, 0.35);
      this._lPole = new THREE.Vector3(-0.75, -0.55, 0.30);
    }

    triggerRecoil(amount = 1.0) {
      this.recoilImpulse = Math.min(1.5, this.recoilImpulse + amount);
    }

    triggerHitFlinch(dir = 1) {
      this.flinchImpulse = 1.0;
      this.flinchDir = dir >= 0 ? 1 : -1;
    }

    update(dt, st = {}) {
      const r = this.rig;
      if (!r || !r.pelvis || !r.torso) return;
      const cDt = Math.min(dt, 0.05);
      this.idleTime += cDt;

      // Decay additive spring impulses (MW2 weapon kick & hit flinch)
      this.recoilImpulse = Math.max(0, this.recoilImpulse - cDt * 8.5);
      this.flinchImpulse = Math.max(0, this.flinchImpulse - cDt * 6.5);

      const rate = Math.min(1, cDt * 15);
      const speed = st.speed || 0;
      const moving = speed > 0.28;
      const stance = st.stance || 'stand';
      const isProne = stance === 'prone';
      const isCrouch = stance === 'crouch';
      const isADS = !!st.isADS;
      const isTacSprint = !!st.isTacSprinting && moving && !isProne && !isCrouch && !isADS;
      const isSprint = (!!st.isSprinting || speed > 4.6) && moving && !isProne && !isCrouch && !isADS;
      const isSlide = !!st.isSliding;
      const isDowned = !!st.isDowned;
      const isDead = !!st.dead;
      const isPlating = !!st.isPlating;
      const isReloading = !!st.isReloading;
      const isHealing = !!st.isHealing;
      const isPistol = !!st.isPistol;
      const aimPitch = THREE.MathUtils.clamp(st.aimPitch || 0, -0.82, 0.82);

      // Update grip anchors for pistol vs rifle so both hands always seat accurately
      if (r.rearGripTarget && r.foregripTarget) {
        if (isPistol) {
          r.rearGripTarget.position.set(0.01, -0.05, 0.02);
          r.foregripTarget.position.set(-0.02, -0.055, -0.01); // Two-handed weaver/isosceles pistol grip
        } else {
          r.rearGripTarget.position.set(0.01, -0.055, 0.04);
          r.foregripTarget.position.set(-0.01, -0.035, -0.25); // Left hand on rifle handguard/foregrip
        }
      }

      // Reset carrier flap & plate prop visibility by default
      if (r.carrierFlap) r.carrierFlap.rotation.x = THREE.MathUtils.lerp(r.carrierFlap.rotation.x, 0, rate);
      if (r.plateProp) r.plateProp.visible = false;

      // === DEAD RAGDOLL REST POSE ===
      if (isDead) {
        r.rigPivot.position.y = THREE.MathUtils.lerp(r.rigPivot.position.y, 0.14, rate);
        r.rigPivot.rotation.x = THREE.MathUtils.lerp(r.rigPivot.rotation.x, Math.PI / 2, rate);
        r.pelvis.position.y = THREE.MathUtils.lerp(r.pelvis.position.y, 0.20, rate);
        r.leftLeg.hip.rotation.set(0, 0, -0.08);
        r.rightLeg.hip.rotation.set(0, 0, 0.08);
        r.leftLeg.knee.rotation.x = -0.10;
        r.rightLeg.knee.rotation.x = -0.10;
        r.leftArm.shoulder.rotation.set(0.15, 0, 0.35);
        r.rightArm.shoulder.rotation.set(0.15, 0, -0.35);
        r.leftArm.elbow.rotation.x = 0.25;
        r.rightArm.elbow.rotation.x = 0.25;
        return;
      }

      // === LAYER 1: RHYTHMIC IDLE BREATHING ===
      const breath = Math.sin(this.idleTime * 2.15);
      const breath2 = Math.cos(this.idleTime * 1.075);

      // Advance gait cycle proportionally to speed
      if (moving && !isSlide && !isDowned) {
        const freq = isTacSprint ? 11.4 : (isSprint ? 9.6 : (isProne ? 4.4 : (isCrouch ? 5.8 : (4.8 + Math.min(speed, 5.5) * 0.85))));
        this.walkPhase += cDt * freq;
      } else if (isDowned && moving) {
        this.walkPhase += cDt * 4.2;
      }
      const stride = Math.sin(this.walkPhase);
      const strideCos = Math.cos(this.walkPhase);

      // Base pose targets
      let rigY = 0;
      let rigPitch = 0;
      let rigRoll = 0;
      let pelvisY = 0.90;
      let pelvisYaw = 0.14;
      let spinePitch = -0.03;
      let spineYaw = -0.12;
      let torsoPitch = -0.04 + breath * 0.016;
      let torsoYaw = -0.04;
      let headPitch = aimPitch * 0.42 + breath * 0.012;
      let headRoll = isADS ? -0.11 : 0;

      // Anatomical leg angles (hip.x > 0 forward, knee.x < 0 ALWAYS backward!)
      let lHipX = 0.06, lHipZ = -0.03, lKneeX = -0.12, lAnkX = 0.06;
      let rHipX = -0.05, rHipZ = 0.03, rKneeX = -0.10, rAnkX = 0.05;

      // Chest-space WeaponPivot target (shouldered in right shoulder pocket!)
      let wpnPosX = isADS ? 0.05 : 0.14;
      let wpnPosY = isADS ? 0.37 : 0.31;
      let wpnPosZ = isADS ? -0.22 : -0.25;
      let wpnRotX = aimPitch * 0.45 + breath * 0.014;
      let wpnRotY = isADS ? 0.02 : 0.08 + breath2 * 0.010;
      let wpnRotZ = 0;

      let rightIKWeight = 1.0;
      let leftIKWeight = 1.0;

      // === LAYER 2: STANCE & LOCOMOTION ===
      if (isDowned) {
        // Seated backward crawl / scoot: reclined comfortably back on supporting hand, thighs lifted & heels cleanly above ground!
        const heave = Math.max(0, stride);
        rigY = 0.0;
        rigPitch = 0.34 + heave * 0.03; // Reclined backward ~20 deg (NEVER pitched forward!)
        pelvisY = 0.22 + heave * 0.025; // Hips resting right on the ground
        pelvisYaw = 0;
        spinePitch = 0.06;
        torsoPitch = 0.04;
        torsoYaw = 0;
        headPitch = THREE.MathUtils.clamp(-0.24 + aimPitch * 0.25, -0.42, 0.18);
        // Thighs lifted forward & knees gently flexed so boots/heels stay cleanly ON TOP of terrain (y >= +0.10m!)
        lHipX = 1.62 + heave * 0.10;
        rHipX = 1.56 + Math.max(0, -stride) * 0.08;
        lKneeX = -0.44 - heave * 0.12;
        rKneeX = -0.40 - Math.max(0, -stride) * 0.10;
        lAnkX = 0.28;
        rAnkX = 0.28;
        rightIKWeight = 0;
        leftIKWeight = 0;
        wpnPosX = 0.18; wpnPosY = 0.10; wpnPosZ = -0.18; wpnRotX = -0.55;
      } else if (isSlide) {
        // MW2 Tactical Slide: lead leg extended low, trailing knee tucked under hip, rifle braced steady!
        const sp = smoothstep(st.slideProgress !== undefined ? st.slideProgress : 0.5);
        rigY = 0;
        rigPitch = 0.22;
        pelvisY = 0.32;
        pelvisYaw = 0.22;
        spineYaw = -0.14;
        torsoYaw = -0.10;
        torsoPitch = 0.12;
        lHipX = 1.50; lHipZ = -0.08; lKneeX = -0.08; lAnkX = 0.18;
        rHipX = 1.08; rHipZ = 0.32; rKneeX = -2.35; rAnkX = 0.65;
        wpnPosX = 0.10; wpnPosY = 0.30; wpnPosZ = -0.26;
        wpnRotX = aimPitch * 0.4 - 0.05;
        wpnRotZ = -0.12;
      } else if (isProne) {
        // === MW2 PROPPED-UP PRONE: Belly on ground, chest arched up, head looking straight downrange, weapon elevated cleanly above ground! ===
        rigY = 0.20;
        rigPitch = -1.42; // Lie flat on stomach along -Z
        pelvisY = 0.22;
        pelvisYaw = 0;
        spinePitch = 0.28; // Lower spine arches up
        torsoPitch = 0.34 + breath * 0.016; // Upper chest propped solidly on elbows!
        torsoYaw = moving ? stride * 0.08 : 0;
        headPitch = 0.82 + aimPitch * 0.45; // Head lifted UP looking straight forward down the sights!
        const crawl = moving ? stride : 0;
        lHipX = -0.06 - Math.max(0, crawl) * 0.20; lHipZ = -0.14; lKneeX = -0.14 - Math.max(0, -crawl) * 0.22; lAnkX = 0.65;
        rHipX = -0.06 - Math.max(0, -crawl) * 0.20; rHipZ = 0.14; rKneeX = -0.14 - Math.max(0, crawl) * 0.22; rAnkX = 0.65;
        // Weapon held cleanly above the ground in front of chest/eyes (zero clipping!)
        wpnPosX = isADS ? 0.04 : 0.10;
        wpnPosY = 0.42;
        wpnPosZ = -0.34;
        wpnRotX = 0.78 + aimPitch * 0.45; // Counter-rotates torso lean so barrel points dead-level straight forward!
        wpnRotY = isADS ? 0.02 : 0.06;
        this._rPole.set(0.85, -0.10, 0.55); // Elbows rest down/out on ground!
        this._lPole.set(-0.85, -0.10, 0.55);
      } else if (isCrouch) {
        // === MW2 TACTICAL CROUCH & CROUCH-WALK (Forward-swinging leg bends knee, stance leg pulls body forward!) ===
        const cAmp = moving ? 0.42 : 0;
        lHipX = 0.90 + stride * cAmp; lHipZ = -0.07; lKneeX = -1.36 - (moving ? Math.max(0, strideCos) * 0.32 : 0); lAnkX = -(lHipX + lKneeX) * 0.72;
        rHipX = 0.76 - stride * cAmp; rHipZ = 0.09; rKneeX = -1.24 - (moving ? Math.max(0, -strideCos) * 0.32 : 0); rAnkX = -(rHipX + rKneeX) * 0.72;
        pelvisY = 0.64;
        pelvisYaw = moving ? stride * 0.10 : 0.20;
        spineYaw = -pelvisYaw * 0.65;
        torsoYaw = -pelvisYaw * 0.35;
        spinePitch = -0.10;
        torsoPitch = (isADS ? -0.14 : -0.10) + breath * 0.015;
        this._rPole.set(0.75, -0.55, 0.35);
        this._lPole.set(-0.75, -0.55, 0.30);
      } else {
        // === MW2 STANDING: IDLE BREATHING / FORWARD KINETIC WALK / JOG / HIGH-PORT TACTICAL SPRINT ===
        // Forward biomechanics:
        //   stride = sin(ph) sweeps -1 -> +1 (SWING FORWARD) when strideCos = cos(ph) > 0: trailing knee bends high & swings forward!
        //   stride = sin(ph) sweeps +1 -> -1 (STANCE PULL) when strideCos = cos(ph) < 0: lead foot plants & pulls body forward!
        const spdNorm = THREE.MathUtils.clamp(speed / 5.2, 0, 1.35);
        const amp = moving ? (0.20 + spdNorm * 0.56) : 0;
        lHipX = moving ? (stride * amp) : 0.06;
        rHipX = moving ? (-stride * amp) : -0.05;
        const kneeLift = isTacSprint ? 1.28 : (isSprint ? 1.08 : (0.42 + spdNorm * 0.54));
        // Trailing leg bends cleanly backward at the knee while swinging FORWARD (strideCos > 0 for left, -strideCos > 0 for right)!
        // Stance leg stays planted with subtle weight-absorption bend (~-0.16) as it pulls the body forward!
        const lSwing = Math.max(0, strideCos);
        const rSwing = Math.max(0, -strideCos);
        const lStanceCushion = Math.max(0, -strideCos) * 0.14;
        const rStanceCushion = Math.max(0, strideCos) * 0.14;
        lKneeX = moving ? (-lSwing * kneeLift - 0.10 - lStanceCushion) : -0.12;
        rKneeX = moving ? (-rSwing * kneeLift - 0.10 - rStanceCushion) : -0.10;
        // Heel-strike dorsiflexion at front contact -> flat stance -> toe-off push behind
        lAnkX = moving ? (-(lHipX + lKneeX) * 0.55 + Math.max(0, stride) * 0.22 - Math.max(0, -stride) * 0.16) : 0.06;
        rAnkX = moving ? (-(rHipX + rKneeX) * 0.55 + Math.max(0, -stride) * 0.22 - Math.max(0, stride) * 0.16) : 0.05;

        pelvisY = 0.89 - (moving ? Math.abs(stride) * 0.042 * Math.min(1, spdNorm) : 0);
        pelvisYaw = moving ? (stride * (0.07 + spdNorm * 0.09)) : 0.16;
        spineYaw = -pelvisYaw * 0.60;
        torsoYaw = -pelvisYaw * 0.40;
        spinePitch = isTacSprint ? -0.15 : (isSprint ? -0.11 : -0.03);
        torsoPitch = (isTacSprint ? -0.15 : (isSprint ? -0.10 : -0.04)) + breath * 0.018;
        rigRoll = -(st.moveRight || 0) * (isSprint ? 0.07 : 0.035);

        // 2-Foot Uneven Terrain IK (if world & worldPos provided)
        if (st.world && st.world.getTerrainHeight && st.worldPos && !isProne && !isSlide) {
          const sinY = Math.sin(st.worldYaw || 0);
          const cosY = Math.cos(st.worldYaw || 0);
          const feetY = st.feetY !== undefined ? st.feetY : st.worldPos.y;
          const spread = 0.21;
          const stepF = moving ? stride * 0.26 : 0.06;
          const lG = st.world.getTerrainHeight(st.worldPos.x - cosY * spread - sinY * stepF, st.worldPos.z + sinY * spread - cosY * stepF);
          const rG = st.world.getTerrainHeight(st.worldPos.x + cosY * spread + sinY * stepF, st.worldPos.z - sinY * spread + cosY * stepF);
          const dL = THREE.MathUtils.clamp(lG - feetY, -0.34, 0.34);
          const dR = THREE.MathUtils.clamp(rG - feetY, -0.34, 0.34);
          const minDrop = Math.min(0, dL, dR);
          pelvisY += minDrop * 0.62;
          const liftL = Math.max(0, dL - minDrop);
          const liftR = Math.max(0, dR - minDrop);
          lHipX += liftL * 1.40; lKneeX -= liftL * 2.10; lAnkX += liftL * 0.80;
          rHipX += liftR * 1.40; rKneeX -= liftR * 2.10; rAnkX += liftR * 0.80;
        }

        // Exact Foot-Contact Ground Clamp so boots never sink below terrain
        const footDrop = (hX, kX) => 0.04 + 0.42 * Math.cos(hX) + 0.45 * Math.cos(hX + kX);
        pelvisY = Math.max(0.45, Math.max(footDrop(lHipX, lKneeX), footDrop(rHipX, rKneeX)) + 0.008);

        this._rPole.set(0.75, -0.55, 0.35);
        this._lPole.set(-0.75, -0.55, 0.30);

        if (isTacSprint) {
          // MW2 Signature High-Port Tactical Sprint: rifle held high in right hand, left arm pumping!
          wpnPosX = 0.22;
          wpnPosY = 0.42 + stride * 0.025;
          wpnPosZ = -0.16;
          wpnRotX = 0.68;
          wpnRotY = 0.32;
          wpnRotZ = -0.22;
          leftIKWeight = 0.0; // Left arm detaches to pump athletically!
        } else if (isSprint) {
          // Two-handed combat jog across lower chest
          wpnPosX = 0.08 + stride * 0.03;
          wpnPosY = 0.27 - Math.abs(stride) * 0.02;
          wpnPosZ = -0.26;
          wpnRotX = -0.14;
          wpnRotY = 0.42;
          wpnRotZ = -0.16;
        }
      }

      // === LAYER 3: AIM-OFFSET DISTRIBUTION + ADDITIVE RECOIL & HIT FLINCH ===
      if (!isDowned && !isTacSprint) {
        spinePitch += aimPitch * 0.16;
        torsoPitch += aimPitch * 0.24;
      }
      // Recoil kicks weapon & upper torso rearward
      const rec = this.recoilImpulse + (st.recoilKick || 0) * 6.0;
      if (rec > 0.001) {
        const adsMul = isADS ? 0.55 : 1.0;
        wpnPosZ += Math.min(0.06, rec * 0.032) * adsMul;
        wpnRotX += Math.min(0.18, rec * 0.095) * adsMul;
        torsoPitch += Math.min(0.08, rec * 0.04) * adsMul;
      }
      // Hit flinch jerks torso/head briefly on damage
      if (this.flinchImpulse > 0.01) {
        const fl = Math.sin(this.flinchImpulse * Math.PI);
        torsoPitch += fl * 0.14;
        torsoYaw += fl * 0.18 * this.flinchDir;
        headPitch -= fl * 0.12;
      }

      // === LAYER 4: ACTION OVERLAYS (4-STAGE MW2 PLATING, RELOAD, MEDKIT, STANCE TRANSITION) ===
      let customLeftArm = null;
      if (isPlating && !isDowned) {
        // 4-Stage MW2 Armor Plating matching 1st-person:
        // 1) Unzip plate carrier -> 2) Pull ceramic plate -> 3) Slide plate into vest -> 4) Zip carrier closed!
        const pp = THREE.MathUtils.clamp(st.plateProgress || 0, 0, 1);
        leftIKWeight = 0.0;
        // Right hand drops weapon cleanly to low-carry to clear chest
        wpnPosX = 0.22; wpnPosY = 0.16; wpnPosZ = -0.20;
        wpnRotX = -0.68; wpnRotY = 0.22; wpnRotZ = -0.12;
        torsoPitch -= 0.08;
        torsoYaw += 0.14;
        if (pp < 0.22) {
          // Stage 1: Unzip vest flap across chest
          const k = smoothstep(pp / 0.22);
          headPitch = -0.30 * k;
          if (r.carrierFlap) r.carrierFlap.rotation.x = -0.95 * k;
          customLeftArm = {
            shX: THREE.MathUtils.lerp(0.88, 1.02, k),
            shZ: THREE.MathUtils.lerp(0.28, 0.74, k),
            elbX: THREE.MathUtils.lerp(1.25, 1.56, k)
          };
        } else if (pp < 0.48) {
          // Stage 2: Grab 3D ceramic plate from pouch & lift to open carrier
          const k = smoothstep((pp - 0.22) / 0.26);
          headPitch = -0.34;
          if (r.carrierFlap) r.carrierFlap.rotation.x = -0.95;
          if (r.plateProp) r.plateProp.visible = k > 0.14;
          customLeftArm = {
            shX: THREE.MathUtils.lerp(0.26, 1.48, k),
            shZ: THREE.MathUtils.lerp(-0.18, 0.64, k),
            elbX: THREE.MathUtils.lerp(0.55, 1.52, k)
          };
        } else if (pp < 0.78) {
          // Stage 3: Slide ceramic plate straight down into front vest carrier slot!
          const k = smoothstep((pp - 0.48) / 0.30);
          headPitch = -0.36;
          if (r.carrierFlap) r.carrierFlap.rotation.x = -0.95;
          if (r.plateProp) r.plateProp.visible = k < 0.80;
          torsoPitch -= Math.sin(k * Math.PI) * 0.07;
          customLeftArm = {
            shX: THREE.MathUtils.lerp(1.48, 0.86, k),
            shZ: THREE.MathUtils.lerp(0.64, 0.54, k),
            elbX: THREE.MathUtils.lerp(1.52, 1.24, k)
          };
        } else {
          // Stage 4: Zip/velcro plate carrier closed across chest!
          const k = smoothstep((pp - 0.78) / 0.22);
          headPitch = -0.34 * (1 - k);
          if (r.carrierFlap) r.carrierFlap.rotation.x = -0.95 * (1 - k);
          customLeftArm = {
            shX: THREE.MathUtils.lerp(0.96, 0.90, k),
            shZ: THREE.MathUtils.lerp(0.74, 0.38, k),
            elbX: THREE.MathUtils.lerp(1.54, 1.18, k)
          };
        }
      } else if (isReloading && !isDowned) {
        const rp = THREE.MathUtils.clamp(st.reloadProgress || 0, 0, 1);
        leftIKWeight = 0.0;
        wpnRotY += 0.32;
        wpnRotZ += 0.28;
        if (rp < 0.32) {
          const k = smoothstep(rp / 0.32);
          customLeftArm = { shX: THREE.MathUtils.lerp(0.95, 0.52, k), shZ: THREE.MathUtils.lerp(0.45, 0.62, k), elbX: THREE.MathUtils.lerp(1.1, 1.55, k) };
        } else if (rp < 0.72) {
          const k = smoothstep((rp - 0.32) / 0.40);
          if (r.handMag) r.handMag.visible = k < 0.85;
          customLeftArm = { shX: THREE.MathUtils.lerp(0.52, 0.98, k), shZ: THREE.MathUtils.lerp(0.62, 0.48, k), elbX: THREE.MathUtils.lerp(1.55, 1.15, k) };
        } else {
          const k = smoothstep((rp - 0.72) / 0.28);
          const pull = Math.sin(k * Math.PI);
          customLeftArm = { shX: 0.96 - pull * 0.22, shZ: 0.46, elbX: 1.15 + pull * 0.28 };
        }
      } else if (isHealing && !isDowned) {
        leftIKWeight = 0.0;
        wpnPosX = 0.24; wpnPosY = 0.14; wpnPosZ = -0.18; wpnRotX = -0.75;
        const wrap = Math.sin(this.idleTime * 8.0);
        headPitch = -0.38;
        customLeftArm = { shX: 0.92 + wrap * 0.12, shZ: 0.58, elbX: 1.42 + wrap * 0.14 };
      } else if (st.stanceTrans && st.stanceTrans.timer > 0 && !isDowned) {
        // Stance transition supporting left-hand ground brace when entering/exiting prone
        const p = 1 - (st.stanceTrans.timer / Math.max(0.01, st.stanceTrans.duration));
        const arc = Math.sin(p * Math.PI);
        if (st.stanceTrans.from === 'prone' || st.stanceTrans.to === 'prone') {
          leftIKWeight = 1 - arc;
          customLeftArm = { shX: 1.05 + arc * 0.32, shZ: 0.08, elbX: 0.32 };
        } else {
          pelvisY -= arc * 0.07;
          lKneeX -= arc * 0.26;
          rKneeX -= arc * 0.22;
        }
      }

      // === APPLY SKELETAL TRANSFORMS ===
      r.rigPivot.position.y = THREE.MathUtils.lerp(r.rigPivot.position.y, rigY, rate);
      r.rigPivot.rotation.x = THREE.MathUtils.lerp(r.rigPivot.rotation.x, rigPitch, rate);
      r.rigPivot.rotation.z = THREE.MathUtils.lerp(r.rigPivot.rotation.z, rigRoll + (st.lean || 0) * 0.26, rate);

      r.pelvis.position.y = THREE.MathUtils.lerp(r.pelvis.position.y, pelvisY, rate);
      r.pelvis.rotation.y = THREE.MathUtils.lerp(r.pelvis.rotation.y, pelvisYaw, rate);
      r.spine.rotation.x = THREE.MathUtils.lerp(r.spine.rotation.x, spinePitch, rate);
      r.spine.rotation.y = THREE.MathUtils.lerp(r.spine.rotation.y, spineYaw, rate);
      r.torso.rotation.x = THREE.MathUtils.lerp(r.torso.rotation.x, torsoPitch, rate);
      r.torso.rotation.y = THREE.MathUtils.lerp(r.torso.rotation.y, torsoYaw, rate);
      // Visible MW2 chest-breathing expansion
      r.torso.scale.set(1 + breath * 0.012, 1 + breath * 0.010, 1 + breath * 0.026);

      r.head.rotation.x = THREE.MathUtils.lerp(r.head.rotation.x, headPitch, rate);
      r.head.rotation.y = THREE.MathUtils.lerp(r.head.rotation.y, 0, rate);
      r.head.rotation.z = THREE.MathUtils.lerp(r.head.rotation.z, headRoll, rate);

      // Lower-body legs
      r.leftLeg.hip.rotation.x = THREE.MathUtils.lerp(r.leftLeg.hip.rotation.x, lHipX, rate);
      r.leftLeg.hip.rotation.z = THREE.MathUtils.lerp(r.leftLeg.hip.rotation.z, lHipZ, rate);
      r.leftLeg.knee.rotation.x = THREE.MathUtils.lerp(r.leftLeg.knee.rotation.x, lKneeX, rate);
      r.leftLeg.ankle.rotation.x = THREE.MathUtils.lerp(r.leftLeg.ankle.rotation.x, lAnkX, rate);

      r.rightLeg.hip.rotation.x = THREE.MathUtils.lerp(r.rightLeg.hip.rotation.x, rHipX, rate);
      r.rightLeg.hip.rotation.z = THREE.MathUtils.lerp(r.rightLeg.hip.rotation.z, rHipZ, rate);
      r.rightLeg.knee.rotation.x = THREE.MathUtils.lerp(r.rightLeg.knee.rotation.x, rKneeX, rate);
      r.rightLeg.ankle.rotation.x = THREE.MathUtils.lerp(r.rightLeg.ankle.rotation.x, rAnkX, rate);

      // Chest-anchored WeaponPivot
      if (r.weaponPivot) {
        r.weaponPivot.position.x = THREE.MathUtils.lerp(r.weaponPivot.position.x, wpnPosX, rate);
        r.weaponPivot.position.y = THREE.MathUtils.lerp(r.weaponPivot.position.y, wpnPosY, rate);
        r.weaponPivot.position.z = THREE.MathUtils.lerp(r.weaponPivot.position.z, wpnPosZ, rate);
        r.weaponPivot.rotation.x = THREE.MathUtils.lerp(r.weaponPivot.rotation.x, wpnRotX, rate);
        r.weaponPivot.rotation.y = THREE.MathUtils.lerp(r.weaponPivot.rotation.y, wpnRotY, rate);
        r.weaponPivot.rotation.z = THREE.MathUtils.lerp(r.weaponPivot.rotation.z, wpnRotZ, rate);
        r.weaponPivot.updateMatrix();
      }

      // === LAYER 5: REAL-TIME 2-BONE ANALYTICAL ARM IK (LOCK HANDS TO REAR GRIP & FOREGRIP!) ===
      if (rightIKWeight > 0.01 && r.weaponPivot && r.rearGripTarget) {
        this._rTarget.copy(r.rearGripTarget.position).applyMatrix4(r.weaponPivot.matrix);
        solveArmIKInTorsoSpace(r.rightArm, this._rTarget, this._rPole, rightIKWeight);
      } else if (isDowned) {
        r.rightArm.shoulder.rotation.set(-0.55, 0, -0.35);
        r.rightArm.elbow.rotation.set(0.45, 0, 0);
      }

      if (leftIKWeight > 0.01 && !customLeftArm && r.weaponPivot && r.foregripTarget) {
        this._lTarget.copy(r.foregripTarget.position).applyMatrix4(r.weaponPivot.matrix);
        solveArmIKInTorsoSpace(r.leftArm, this._lTarget, this._lPole, leftIKWeight);
      } else if (customLeftArm) {
        r.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(r.leftArm.shoulder.rotation.x, customLeftArm.shX, rate);
        r.leftArm.shoulder.rotation.y = THREE.MathUtils.lerp(r.leftArm.shoulder.rotation.y, 0, rate);
        r.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(r.leftArm.shoulder.rotation.z, customLeftArm.shZ, rate);
        r.leftArm.elbow.rotation.x = THREE.MathUtils.lerp(r.leftArm.elbow.rotation.x, customLeftArm.elbX, rate);
      } else if (isTacSprint) {
        // Athletic left-arm tactical sprint pump
        r.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(r.leftArm.shoulder.rotation.x, 0.35 - stride * 0.72, rate);
        r.leftArm.shoulder.rotation.y = 0;
        r.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(r.leftArm.shoulder.rotation.z, 0.16, rate);
        r.leftArm.elbow.rotation.x = THREE.MathUtils.lerp(r.leftArm.elbow.rotation.x, 1.25, rate);
      } else if (isDowned) {
        r.leftArm.shoulder.rotation.set(0.45 + stride * 0.24, 0, 0.24);
        r.leftArm.elbow.rotation.set(0.55, 0, 0);
      }
    }
  }

  window.MW2Rig = {
    buildCharacterRig,
    solveArmIKInTorsoSpace
  };
  window.MW2Animator = MW2Animator;

  // Backwards-compatible alias so any legacy caller automatically gets the MW2 Rig!
  window.buildTacticalOperatorModel = function (opts = {}) {
    return buildCharacterRig(opts);
  };
})();
