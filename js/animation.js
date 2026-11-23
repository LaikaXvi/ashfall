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

    // Backpack (unified sculpted 3D mesh matching inventory icons!)
    const packGroup = new THREE.Group();
    const bagId = opts.bagId || (isScav ? 'none' : (isRaider ? 'bag_small' : 'bag_medium'));
    packGroup.userData.bagId = bagId;
    let packMat = null;
    let packLargeExtras = null;
    if (bagId !== 'none' && typeof window.buildTacticalBackpackMesh === 'function') {
      const sculpted = window.buildTacticalBackpackMesh(bagId, { forIcon: false });
      sculpted.position.set(0, 0.22, 0.16);
      packGroup.add(sculpted);
    } else {
      packMat = new THREE.MeshLambertMaterial({ color: bagId === 'bag_large' ? 0x353b31 : 0x3f433a });
      const packMain = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.13), packMat);
      packMain.position.set(0, 0.20, 0.20);
      const packTopPouch = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.10, 0.075), strapMat);
      packTopPouch.position.set(0, 0.30, 0.275);
      packLargeExtras = new THREE.Group();
      const sidePouchL = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.20, 0.10), strapMat);
      sidePouchL.position.set(-0.17, 0.17, 0.20);
      const sidePouchR = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.20, 0.10), strapMat);
      sidePouchR.position.set(0.17, 0.17, 0.20);
      packLargeExtras.add(sidePouchL, sidePouchR);
      packLargeExtras.visible = bagId === 'bag_large';
      packGroup.add(packMain, packTopPouch, packLargeExtras);
    }
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
    let syringeProp = null;
    let grenadeProp = null;

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
        // 3D Sculpted SAPI Ceramic Armor Plate prop for MW2 4-stage plating animation
        if (typeof window.buildArmorPlateMesh === 'function') {
          plateProp = window.buildArmorPlateMesh({ forIcon: false });
          plateProp.scale.multiplyScalar(0.80);
        } else {
          plateProp = new THREE.Group();
          const plateBody = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.17, 0.020), new THREE.MeshLambertMaterial({ color: 0x22384c }));
          const plateTrim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.024, 0.024), new THREE.MeshLambertMaterial({ color: 0x4ea8de }));
          plateTrim.position.y = 0.056;
          plateProp.add(plateBody, plateTrim);
        }
        plateProp.position.set(0.01, -0.08, -0.04);
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
      } else {
        // 3D Combat Revive Syringe prop (glowing emerald bio-stim auto-injector)
        syringeProp = new THREE.Group();
        const sBarrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 0.12, 10),
          new THREE.MeshPhongMaterial({ color: 0x26f0a8, emissive: 0x0c7a52, shininess: 68 })
        );
        const sCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.018, 0.032, 10), gearMat);
        sCollar.position.set(0, -0.055, 0);
        const sNeedle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0028, 0.0032, 0.058, 8),
          new THREE.MeshLambertMaterial({ color: 0xd0d8e0 })
        );
        sNeedle.position.set(0, -0.098, 0);
        const sPlunger = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.016, 0.024, 10),
          new THREE.MeshLambertMaterial({ color: 0xd94626 })
        );
        sPlunger.position.set(0, 0.076, 0);
        syringeProp.add(sBarrel, sCollar, sNeedle, sPlunger);
        syringeProp.position.set(-0.01, -0.075, -0.035);
        syringeProp.rotation.set(Math.PI * 0.42, 0, 0.12);
        syringeProp.visible = false;

        // 3D M67 Frag Grenade prop for 3P throw animations
        grenadeProp = new THREE.Group();
        const gBody = new THREE.Mesh(
          new THREE.SphereGeometry(0.044, 10, 8),
          new THREE.MeshLambertMaterial({ color: 0x45503b })
        );
        const gFuze = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014, 0.017, 0.024, 8),
          new THREE.MeshLambertMaterial({ color: 0x8b939c })
        );
        gFuze.position.set(0, 0.045, 0);
        grenadeProp.add(gBody, gFuze);
        grenadeProp.position.set(-0.01, -0.068, -0.025);
        grenadeProp.visible = false;

        wrist.add(syringeProp, grenadeProp);
      }

      elbow.add(elbowPad, forearm, wrist);
      shoulder.add(elbow);
      torso.add(shoulder);
      return { shoulder, elbow, wrist };
    };
    const leftArm = makeArm(isHeavy ? -0.28 : -0.25, false);
    const rightArm = makeArm(isHeavy ? 0.28 : 0.25, true);

    const rigObj = {
      root, rigPivot, pelvis, spine, torso, chest, neck, head, skull,
      leftLeg, rightLeg, leftArm, rightArm,
      weaponPivot, weaponMount, rearGripTarget, foregripTarget,
      vestGroup, vestMat, heavyExtras, packGroup, packMat, packLargeExtras,
      carrierFlap, plateProp, handMag, handShell, inventoryTablet, syringeProp, grenadeProp,
      isMW2Rig: true
    };
    const attachRiggedSkin = () => {
      if (rigObj.skin || !window.RigAssets || !window.RigAssets.ready || !window.RiggedCharacter) return;
      try {
        rigObj.skin = new window.RiggedCharacter(rigObj, opts);
        if (rigObj._fpBodyModeWanted != null && typeof rigObj.skin.setFirstPersonBodyMode === 'function') {
          rigObj.skin.setFirstPersonBodyMode(!!rigObj._fpBodyModeWanted);
        }
        if (rigObj._bagIdWanted !== undefined && typeof rigObj.skin.setBackpack === 'function') {
          rigObj.skin.setBackpack(rigObj._bagIdWanted);
        }
      } catch (e) {
        console.warn('[rig] Failed to attach RiggedCharacter, keeping procedural rig:', e);
      }
    };
    if (window.RigAssets) {
      if (window.RigAssets.ready) {
        attachRiggedSkin();
      } else {
        if (typeof window.RigAssets.load === 'function') window.RigAssets.load();
        if (typeof window.RigAssets.onReady === 'function') window.RigAssets.onReady(attachRiggedSkin);
      }
    }
    return rigObj;
  }

  // ==========================================================================
  // UNIFIED MW2 LAYERED ANIMATION CONTROLLER (Game-Wide: Player, AI Ops, NPCs)
  // ==========================================================================
  class MW2Animator {
    constructor(rig) {
      this.rig = rig;
      this.walkPhase = Math.random() * Math.PI * 2;
      this.idleTime = Math.random() * 10.0;
      this.crouchWalkBlend = 0;
      // AAA Procedural Momentum-Based Locomotion state
      this.velSpeed = 0;
      this.accelFwd = 0;
      this.prevSpeed = 0;
      this.prevWorldYaw = null;
      this.yawRate = 0;
      this.prevOnGround = true;
      this.airTime = 0;
      this.landImpact = 0;
      this.startTimer = 0;
      this.stopTimer = 0;
      this.stopLeadSide = 1;
      this.wWalk = 0;
      this.wRun = 0;
      this.wTac = 0;
      this.locoPhase = 'idle';
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
      const isReviving = !!st.isReviving;
      const isThrowing = !!st.isThrowing;
      const isPistol = !!st.isPistol;
      const aimPitch = THREE.MathUtils.clamp(st.aimPitch || 0, -0.82, 0.82);
      r._animState = {
        speed,
        stance,
        isSliding: isSlide,
        isDowned,
        dead: isDead,
        isProne,
        isReviving,
        isThrowing,
        stanceTrans: st.stanceTrans || null
      };

      // Update grip anchors for pistol vs rifle (including vertical foregrips & live Trench Gun slide pump!)
      if (r.rearGripTarget && r.foregripTarget) {
        const pumpOff = st.pumpOffset || 0;
        if (isPistol) {
          r.rearGripTarget.position.set(0.01, -0.05, 0.02);
          r.foregripTarget.position.set(-0.02, -0.055, -0.01); // Two-handed weaver/isosceles pistol grip
        } else if (st.hasVertGrip) {
          r.rearGripTarget.position.set(0.01, -0.055, 0.04);
          r.foregripTarget.position.set(-0.01, -0.088, -0.24 + pumpOff); // Left hand wrapped around vertical foregrip!
        } else {
          r.rearGripTarget.position.set(0.01, -0.055, 0.04);
          r.foregripTarget.position.set(-0.01, -0.035, -0.25 + pumpOff); // Left hand on rifle handguard / shotgun pump
        }
      }

      // Reset carrier flap & action prop visibility by default
      if (r.carrierFlap) r.carrierFlap.rotation.x = THREE.MathUtils.lerp(r.carrierFlap.rotation.x, 0, rate);
      if (r.plateProp) r.plateProp.visible = false;
      if (r.handMag) r.handMag.visible = false;
      if (r.syringeProp) r.syringeProp.visible = false;
      if (r.grenadeProp) r.grenadeProp.visible = false;

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

      // === LAYER 1: MOMENTUM, ACCELERATION, TURN-BANKING, LANDING & DISTINCT GAIT PHASES ===
      const breath = Math.sin(this.idleTime * 2.15);
      const breath2 = Math.cos(this.idleTime * 1.075);
      const onGround = st.onGround !== false;

      // Track airborne time & landing compression spring impulse
      if (!onGround && !isDowned && !isDead) {
        this.airTime = Math.min(2.0, this.airTime + cDt);
      } else {
        if (!this.prevOnGround && this.airTime > 0.10) {
          this.landImpact = THREE.MathUtils.clamp(this.airTime * 1.75, 0.30, 1.0);
        }
        this.airTime = 0;
      }
      this.prevOnGround = onGround;
      if (this.landImpact > 0.001) {
        this.landImpact = Math.max(0, this.landImpact - cDt * 3.4);
      }

      // Compute smoothed planar momentum & longitudinal acceleration
      const rawAccel = (speed - this.prevSpeed) / Math.max(0.008, cDt);
      this.accelFwd = THREE.MathUtils.lerp(this.accelFwd, THREE.MathUtils.clamp(rawAccel, -28, 28), Math.min(1, cDt * 12));
      this.prevSpeed = speed;

      // Detect explosive Start Launch & Hard-Stop Braking Plant transitions!
      const isStanding = !isProne && !isCrouch && !isSlide && !isDowned && !isDead;
      if (isStanding && onGround) {
        if (this.velSpeed < 1.15 && speed > 1.8 && this.accelFwd > 2.8 && this.startTimer <= 0) {
          this.startTimer = 0.30;
          this.stopTimer = 0;
        } else if (this.velSpeed > 3.2 && (speed < 0.75 || this.accelFwd < -6.8) && this.stopTimer <= 0) {
          this.stopTimer = 0.36;
          this.startTimer = 0;
          this.stopLeadSide = Math.sin(this.walkPhase) >= 0 ? -1 : 1; // plant whichever foot was forward!
        }
      } else {
        this.startTimer = 0;
        this.stopTimer = 0;
      }
      if (this.startTimer > 0) this.startTimer = Math.max(0, this.startTimer - cDt);
      if (this.stopTimer > 0) {
        this.stopTimer = Math.max(0, this.stopTimer - cDt);
        if (speed > 2.2) this.stopTimer = 0; // cancel stop plant immediately if accelerating again
      }

      this.velSpeed = THREE.MathUtils.lerp(this.velSpeed, speed, Math.min(1, cDt * (speed > this.velSpeed ? 11 : 9)));

      // Track angular turn velocity for realistic corner-banking roll
      if (typeof st.worldYaw === 'number') {
        if (this.prevWorldYaw === null) this.prevWorldYaw = st.worldYaw;
        let dYaw = st.worldYaw - this.prevWorldYaw;
        while (dYaw > Math.PI) dYaw -= Math.PI * 2;
        while (dYaw < -Math.PI) dYaw += Math.PI * 2;
        this.prevWorldYaw = st.worldYaw;
        this.yawRate = THREE.MathUtils.lerp(this.yawRate, THREE.MathUtils.clamp(dYaw / Math.max(0.008, cDt), -8, 8), Math.min(1, cDt * 10));
      } else {
        this.yawRate = THREE.MathUtils.lerp(this.yawRate, 0, Math.min(1, cDt * 8));
      }

      // Smoothly blend distinct locomotion phase weights: Walk -> Run -> High-Port Tactical Sprint
      const wantTac = isStanding && onGround && moving && (isTacSprint || this.velSpeed >= 10.6);
      const wantRun = isStanding && onGround && moving && !wantTac && (isSprint || this.velSpeed >= 5.2);
      const wantWalk = isStanding && onGround && moving && !wantTac && !wantRun;
      const pLerp = Math.min(1, cDt * 9.5);
      this.wTac  = THREE.MathUtils.lerp(this.wTac,  wantTac  ? 1 : 0, pLerp);
      this.wRun  = THREE.MathUtils.lerp(this.wRun,  wantRun  ? 1 : 0, pLerp);
      this.wWalk = THREE.MathUtils.lerp(this.wWalk, wantWalk ? 1 : 0, pLerp);
      this.locoPhase = !moving
        ? (this.stopTimer > 0 ? 'stop' : 'idle')
        : (this.startTimer > 0 ? 'start' : (wantTac ? 'tacSprint' : (wantRun ? 'run' : 'walk')));
      r._animState.locoPhase = this.locoPhase;

      // Advance procedural gait cycle smoothly coupled to momentum & distinct phase cadence
      if ((moving || this.velSpeed > 0.35) && !isSlide && !isDowned && onGround) {
        let freq;
        if (isProne) freq = 3.1;
        else if (isCrouch) freq = 5.6 + Math.min(speed, 4.0) * 0.45;
        else {
          const walkF = 5.2 + Math.min(this.velSpeed, 5.4) * 0.68;
          const runF  = 8.6 + Math.max(0, Math.min(this.velSpeed - 5.0, 5.5)) * 0.48;
          const tacF  = 11.8 + Math.max(0, this.velSpeed - 10.0) * 0.32;
          const wTot = Math.max(0.001, this.wWalk + this.wRun + this.wTac);
          freq = (walkF * this.wWalk + runF * this.wRun + tacF * this.wTac) / wTot;
        }
        this.walkPhase += cDt * freq;
      } else if (isDowned && moving) {
        this.walkPhase += cDt * 4.2;
      }
      r._animState.gaitPhase = this.walkPhase;
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
        // === MW2 TACTICAL KNEELING CROUCH & CROUCH-WALK ===
        // Stationary crouch: right knee tucked down under the operator (matching slide tuck knee) with left knee UP forward bracing (matching slide lead leg)!
        // Crouch-walking: smoothly lifts into a low stealth stalking stride, dropping back onto the tucked right knee when stopping.
        this.crouchWalkBlend = THREE.MathUtils.lerp(this.crouchWalkBlend || 0, moving ? 1 : 0, Math.min(1, cDt * 10));
        const cw = this.crouchWalkBlend;

        // Kneeling-brace stationary targets (left bracing knee up in front, right knee tucked under operator)
        const lHipIdle = 1.38, lHipZIdle = -0.10, lKneeIdle = -1.46, lAnkIdle = 0.08;
        const rHipIdle = 0.24, rHipZIdle = 0.14,  rKneeIdle = -1.94, rAnkIdle = 1.08;

        // Low asymmetric stealth crouch-walk gait
        const cAmp = 0.44;
        const lHipWalk = 1.04 + stride * cAmp;
        const lKneeWalk = -1.42 - Math.max(0, strideCos) * 0.34;
        const lAnkWalk = -(lHipWalk + lKneeWalk) * 0.72;
        const rHipWalk = 0.68 - stride * cAmp;
        const rKneeWalk = -1.36 - Math.max(0, -strideCos) * 0.34;
        const rAnkWalk = -(rHipWalk + rKneeWalk) * 0.72;

        lHipX = THREE.MathUtils.lerp(lHipIdle, lHipWalk, cw);
        lHipZ = THREE.MathUtils.lerp(lHipZIdle, -0.08, cw);
        lKneeX = THREE.MathUtils.lerp(lKneeIdle, lKneeWalk, cw);
        lAnkX = THREE.MathUtils.lerp(lAnkIdle, lAnkWalk, cw);

        rHipX = THREE.MathUtils.lerp(rHipIdle, rHipWalk, cw);
        rHipZ = THREE.MathUtils.lerp(rHipZIdle, 0.10, cw);
        rKneeX = THREE.MathUtils.lerp(rKneeIdle, rKneeWalk, cw);
        rAnkX = THREE.MathUtils.lerp(rAnkIdle, rAnkWalk, cw);

        pelvisY = THREE.MathUtils.lerp(0.54, 0.62 - Math.abs(stride) * 0.03, cw);
        pelvisYaw = THREE.MathUtils.lerp(0.24, stride * 0.10, cw);
        spineYaw = -pelvisYaw * 0.65;
        torsoYaw = -pelvisYaw * 0.35;
        spinePitch = THREE.MathUtils.lerp(-0.12, -0.10, cw);
        torsoPitch = (isADS ? -0.14 : -0.10) + breath * 0.015;
        this._rPole.set(0.75, -0.55, 0.35);
        this._lPole.set(-0.75, -0.55, 0.30);
      } else {
        // === AAA PROCEDURAL MOMENTUM-BASED LOCOMOTION (START -> WALK -> RUN -> TAC-SPRINT -> STOP + BANKING + AIR/LAND) ===
        const moveBlend = THREE.MathUtils.clamp(this.wWalk + this.wRun + this.wTac, 0, 1);
        const startArc = this.startTimer > 0 ? Math.sin((this.startTimer / 0.30) * Math.PI) : 0;
        const stopProg = this.stopTimer > 0 ? (1 - this.stopTimer / 0.36) : 0;
        const stopEnv = this.stopTimer > 0 ? Math.sin(stopProg * Math.PI) : 0;
        const landArc = this.landImpact > 0.001 ? Math.sin(Math.min(1, this.landImpact) * Math.PI * 0.5) : 0;

        if (!onGround) {
          // Airborne readiness tuck: front knee raised, trailing leg angled down-back, slight forward anticipation
          const airBlend = Math.min(1, this.airTime * 6.0);
          lHipX = THREE.MathUtils.lerp(0.06, 0.52, airBlend);
          lHipZ = -0.06;
          lKneeX = THREE.MathUtils.lerp(-0.12, -0.92, airBlend);
          lAnkX = 0.22;
          rHipX = THREE.MathUtils.lerp(-0.05, -0.18, airBlend);
          rHipZ = 0.06;
          rKneeX = THREE.MathUtils.lerp(-0.10, -0.68, airBlend);
          rAnkX = -0.25;
          pelvisY = 0.86;
          spinePitch = -0.06;
          torsoPitch = -0.06 + breath * 0.015;
          wpnPosY += 0.025 * airBlend;
          wpnRotX -= 0.06 * airBlend;
        } else {
          // Distinct biomechanical parameters blended cleanly across Walk / Run / High-Port Tac-Sprint phases
          const wSum = Math.max(0.001, this.wWalk + this.wRun + this.wTac);
          const nW = this.wWalk / wSum;
          const nR = this.wRun / wSum;
          const nT = this.wTac / wSum;

          // Stride hip swing amplitude: controlled walk (0.36) -> athletic run (0.66) -> full-drive sprint (0.86)
          const phaseAmp = (0.36 * nW + 0.66 * nR + 0.86 * nT) + startArc * 0.14;
          const amp = phaseAmp * moveBlend;
          // Knee lift during forward swing: crisp walk fold (0.62) -> high run heel-kick (1.16) -> explosive sprint drive (1.46)
          const kneeLift = (0.62 * nW + 1.16 * nR + 1.46 * nT) + startArc * 0.18;
          // Weight-acceptance stance cushion: grounded walk (0.18) -> springy run (0.28) -> power sprint (0.34)
          const cushionAmp = 0.18 * nW + 0.28 * nR + 0.34 * nT;

          // 4-subphase biomechanical cycle per leg: Swing Forward -> Heel-Strike -> Stance Cushion -> Toe-Off Push
          const lSwing = Math.pow(Math.max(0, strideCos), 0.85);
          const rSwing = Math.pow(Math.max(0, -strideCos), 0.85);
          const lCushion = Math.max(0, -strideCos) * cushionAmp;
          const rCushion = Math.max(0, strideCos) * cushionAmp;

          // Strafe leg abduction for realistic lateral stepping
          const strafe = THREE.MathUtils.clamp(st.moveRight || 0, -1, 1);
          const strafeStep = Math.abs(strafe) * moveBlend;

          let gLHipX = THREE.MathUtils.lerp(0.06, stride * amp + startArc * 0.08, moveBlend);
          let gRHipX = THREE.MathUtils.lerp(-0.05, -stride * amp + startArc * 0.08, moveBlend);
          let gLKneeX = THREE.MathUtils.lerp(-0.12, -lSwing * kneeLift - 0.08 - lCushion, moveBlend);
          let gRKneeX = THREE.MathUtils.lerp(-0.10, -rSwing * kneeLift - 0.08 - rCushion, moveBlend);
          // Heel-strike dorsiflexion (+) -> flat stance -> powerful toe-off plantarflexion (-)
          let gLAnkX = THREE.MathUtils.lerp(0.06, -(gLHipX + gLKneeX) * 0.52 + Math.max(0, stride) * 0.26 - Math.max(0, -stride) * (0.22 + nT * 0.14), moveBlend);
          let gRAnkX = THREE.MathUtils.lerp(0.05, -(gRHipX + gRKneeX) * 0.52 + Math.max(0, -stride) * 0.26 - Math.max(0, stride) * (0.22 + nT * 0.14), moveBlend);

          // Phase 5: Hard-Stop Braking Plant (lead foot plants heel-first out front, rear knee absorbs momentum!)
          if (stopEnv > 0.01) {
            const leadIsLeft = this.stopLeadSide < 0;
            const sLHip = leadIsLeft ? 0.44 : -0.22;
            const sRHip = leadIsLeft ? -0.22 : 0.44;
            const sLKnee = leadIsLeft ? -0.34 : -0.46;
            const sRKnee = leadIsLeft ? -0.46 : -0.34;
            const sLAnk = leadIsLeft ? 0.24 : -0.18;
            const sRAnk = leadIsLeft ? -0.18 : 0.24;
            gLHipX = THREE.MathUtils.lerp(gLHipX, sLHip, stopEnv);
            gRHipX = THREE.MathUtils.lerp(gRHipX, sRHip, stopEnv);
            gLKneeX = THREE.MathUtils.lerp(gLKneeX, sLKnee, stopEnv);
            gRKneeX = THREE.MathUtils.lerp(gRKneeX, sRKnee, stopEnv);
            gLAnkX = THREE.MathUtils.lerp(gLAnkX, sLAnk, stopEnv);
            gRAnkX = THREE.MathUtils.lerp(gRAnkX, sRAnk, stopEnv);
          }

          lHipX = gLHipX;
          rHipX = gRHipX;
          lKneeX = gLKneeX - landArc * 0.52;
          rKneeX = gRKneeX - landArc * 0.52;
          lAnkX = gLAnkX + landArc * 0.26;
          rAnkX = gRAnkX + landArc * 0.26;
          lHipZ = -0.03 - strafeStep * (0.08 + Math.max(0, -stride * Math.sign(strafe || 1)) * 0.12);
          rHipZ =  0.03 + strafeStep * (0.08 + Math.max(0,  stride * Math.sign(strafe || 1)) * 0.12);

          // Vertical pelvis trajectory: double-support dip on walk vs athletic flight-arc bounce on run/sprint!
          const walkBounce = -Math.abs(stride) * 0.030;
          const runBounce = (Math.abs(strideCos) - 0.48) * (0.068 * nR + 0.095 * nT);
          pelvisY = 0.89 + (walkBounce * nW + runBounce) * moveBlend - stopEnv * 0.055 - landArc * 0.15;

          // Pelvis counter-rotation vs stabilized upper ribcage (MW19 tactical weapon-leveling dissociation)
          const yawAmp = (0.08 * nW + 0.15 * nR + 0.20 * nT) * moveBlend;
          pelvisYaw = THREE.MathUtils.lerp(0.16, stride * yawAmp, moveBlend);
          spineYaw = -pelvisYaw * 0.62;
          torsoYaw = -pelvisYaw * 0.38;

          // Momentum-driven forward/backward pitch: Start launch lean, phase combat pitch, Braking counter-lean & landing shock!
          const accelLean = THREE.MathUtils.clamp(-this.accelFwd * 0.011, -0.14, 0.10);
          const stopWhip = stopEnv > 0.01 ? (Math.sin(stopProg * Math.PI * 1.6) * 0.09 * (1 - stopProg * 0.4)) : 0;
          const phaseSpine = (-0.04 * nW - 0.12 * nR - 0.18 * nT) * moveBlend;
          const phaseTorso = (-0.05 * nW - 0.14 * nR - 0.20 * nT) * moveBlend;
          spinePitch = phaseSpine + accelLean * 0.6 - startArc * 0.12 - stopWhip - landArc * 0.12;
          torsoPitch = phaseTorso + accelLean * 0.4 - startArc * 0.10 - stopWhip * 0.8 - landArc * 0.14 + breath * 0.016;

          // Athletic corner-banking roll into turns + strafe banking
          const bankRoll = THREE.MathUtils.clamp(this.yawRate * this.velSpeed * 0.018, -0.18, 0.18);
          rigRoll = -strafe * (0.035 + 0.055 * (this.wRun + this.wTac)) + bankRoll;

          // 2-Foot Uneven Terrain IK (if world & worldPos provided)
          if (st.world && st.world.getTerrainHeight && st.worldPos && !isProne && !isSlide) {
            const sinY = Math.sin(st.worldYaw || 0);
            const cosY = Math.cos(st.worldYaw || 0);
            const feetY = st.feetY !== undefined ? st.feetY : st.worldPos.y;
            const spread = 0.21;
            const stepF = moveBlend > 0.1 ? stride * 0.26 * moveBlend : 0.06;
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
          pelvisY = Math.max(0.45, Math.max(footDrop(lHipX, lKneeX), footDrop(rHipX, rKneeX)) + 0.008 - landArc * 0.06);
        }

        this._rPole.set(0.75, -0.55, 0.35);
        this._lPole.set(-0.75, -0.55, 0.30);

        // Smooth phase-blended weapon carry across Walk -> Combat Run -> High-Port Tactical Sprint!
        if (this.wTac > 0.02 || this.wRun > 0.02) {
          const rW = this.wRun;
          const tW = this.wTac;
          // Combat Run low-ready cross-chest swing
          if (rW > 0.01) {
            wpnPosX = THREE.MathUtils.lerp(wpnPosX, 0.07 + stride * 0.036, rW);
            wpnPosY = THREE.MathUtils.lerp(wpnPosY, 0.27 - Math.abs(stride) * 0.024, rW);
            wpnPosZ = THREE.MathUtils.lerp(wpnPosZ, -0.26, rW);
            wpnRotX = THREE.MathUtils.lerp(wpnRotX, -0.15 - Math.abs(stride) * 0.04, rW);
            wpnRotY = THREE.MathUtils.lerp(wpnRotY, 0.44 - stride * 0.06, rW);
            wpnRotZ = THREE.MathUtils.lerp(wpnRotZ, -0.16 + stride * 0.05, rW);
          }
          // High-Port Tactical Sprint one-handed skyward rifle carry + left arm full athletic pump!
          if (tW > 0.01) {
            wpnPosX = THREE.MathUtils.lerp(wpnPosX, 0.23, tW);
            wpnPosY = THREE.MathUtils.lerp(wpnPosY, 0.43 + stride * 0.032, tW);
            wpnPosZ = THREE.MathUtils.lerp(wpnPosZ, -0.15, tW);
            wpnRotX = THREE.MathUtils.lerp(wpnRotX, 0.72, tW);
            wpnRotY = THREE.MathUtils.lerp(wpnRotY, 0.32, tW);
            wpnRotZ = THREE.MathUtils.lerp(wpnRotZ, -0.24, tW);
            if (tW > 0.35) leftIKWeight = 0.0;
          }
        }
        // Subtle landing weapon drop impulse
        if (landArc > 0.01) {
          wpnPosY -= landArc * 0.04;
          wpnRotX -= landArc * 0.08;
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

      // === LAYER 4: ACTION OVERLAYS (4-STAGE MW2 PLATING, RELOAD, MEDKIT, REVIVE SYRINGE, GRENADE THROW, STANCE TRANSITION) ===
      let customLeftArm = null;
      let customRightArm = null;
      if (isReviving) {
        const rp = THREE.MathUtils.clamp(st.reviveProgress || 0, 0, 1);
        if (isDowned) {
          // 3P Warzone/DMZ Self-Revive Syringe plunged straight into own chest while downed!
          rightIKWeight = 0.0;
          if (r.syringeProp) r.syringeProp.visible = true;
          const stab = rp < 0.25 ? smoothstep(rp / 0.25) : 1.0;
          const pulse = (rp >= 0.30 && rp <= 0.88) ? Math.sin(this.idleTime * 14) * 0.04 : 0;
          headPitch = -0.36;
          customRightArm = {
            shX: THREE.MathUtils.lerp(0.42, 1.12, stab) + pulse,
            shZ: THREE.MathUtils.lerp(-0.22, -0.62, stab),
            elbX: THREE.MathUtils.lerp(0.75, 1.56, stab)
          };
        } else {
          // 3P Combat Med-Syringe Teammate Revive: kneel down over ally (right knee tucked under, left knee bracing), sling rifle & inject syringe!
          rightIKWeight = 0.0;
          leftIKWeight = 0.0;
          pelvisY = 0.54;
          lHipX = 1.38; lHipZ = -0.10; lKneeX = -1.46; lAnkX = 0.08;
          rHipX = 0.24; rHipZ = 0.14;  rKneeX = -1.94; rAnkX = 1.08;
          spinePitch = -0.18;
          torsoPitch = -0.34;
          headPitch = -0.36;
          // Sling rifle neatly down across front torso
          wpnPosX = 0.14; wpnPosY = 0.10; wpnPosZ = -0.18;
          wpnRotX = -0.96; wpnRotY = 0.52; wpnRotZ = -0.18;
          if (r.syringeProp) r.syringeProp.visible = true;
          // Left hand braces downed teammate's shoulder
          customLeftArm = { shX: 1.02, shZ: 0.24, elbX: 0.52 };
          if (rp < 0.22) {
            const k = smoothstep(rp / 0.22);
            customRightArm = {
              shX: THREE.MathUtils.lerp(0.65, 1.32, k),
              shZ: THREE.MathUtils.lerp(-0.18, -0.26, k),
              elbX: THREE.MathUtils.lerp(0.95, 1.42, k)
            };
          } else if (rp < 0.36) {
            // Crisp downward plunge into teammate!
            const k = smoothstep((rp - 0.22) / 0.14);
            customRightArm = {
              shX: THREE.MathUtils.lerp(1.32, 0.88, k),
              shZ: THREE.MathUtils.lerp(-0.26, -0.32, k),
              elbX: THREE.MathUtils.lerp(1.42, 0.62, k)
            };
          } else if (rp < 0.88) {
            // Hold seated & depress plunger
            const push = Math.sin(this.idleTime * 11) * 0.03;
            customRightArm = { shX: 0.86 + push, shZ: -0.32, elbX: 0.60 - push };
          } else {
            const k = smoothstep((rp - 0.88) / 0.12);
            customRightArm = {
              shX: THREE.MathUtils.lerp(0.86, 0.65, k),
              shZ: THREE.MathUtils.lerp(-0.32, -0.18, k),
              elbX: THREE.MathUtils.lerp(0.60, 0.95, k)
            };
          }
        }
      } else if (isThrowing && !isDowned) {
        // 3P Overhand Grenade / Knife Throw Overlay
        const tp = THREE.MathUtils.clamp(st.throwProgress || 0, 0, 1);
        rightIKWeight = 0.0;
        wpnPosX = -0.04; wpnPosY = 0.20; wpnPosZ = -0.24;
        wpnRotX = -0.34; wpnRotY = 0.28; wpnRotZ = 0.12;
        if (r.grenadeProp) r.grenadeProp.visible = tp < 0.60;
        if (tp < 0.45) {
          const k = smoothstep(tp / 0.45);
          torsoYaw -= 0.36 * k;
          customRightArm = {
            shX: THREE.MathUtils.lerp(0.85, 2.38, k),
            shZ: THREE.MathUtils.lerp(-0.18, -0.38, k),
            elbX: THREE.MathUtils.lerp(1.05, 1.38, k)
          };
        } else {
          const k = smoothstep((tp - 0.45) / 0.55);
          torsoYaw += THREE.MathUtils.lerp(-0.36, 0.32, k);
          customRightArm = {
            shX: THREE.MathUtils.lerp(2.38, 0.44, k),
            shZ: THREE.MathUtils.lerp(-0.38, -0.10, k),
            elbX: THREE.MathUtils.lerp(1.38, 0.24, k)
          };
        }
      } else if (isPlating && !isDowned) {
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
      if (rightIKWeight > 0.01 && !customRightArm && r.weaponPivot && r.rearGripTarget) {
        this._rTarget.copy(r.rearGripTarget.position).applyMatrix4(r.weaponPivot.matrix);
        solveArmIKInTorsoSpace(r.rightArm, this._rTarget, this._rPole, rightIKWeight);
      } else if (customRightArm) {
        r.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(r.rightArm.shoulder.rotation.x, customRightArm.shX, rate);
        r.rightArm.shoulder.rotation.y = THREE.MathUtils.lerp(r.rightArm.shoulder.rotation.y, 0, rate);
        r.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(r.rightArm.shoulder.rotation.z, customRightArm.shZ, rate);
        r.rightArm.elbow.rotation.x = THREE.MathUtils.lerp(r.rightArm.elbow.rotation.x, customRightArm.elbX, rate);
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
      } else if (this.wTac > 0.35 || isTacSprint) {
        // Athletic left-arm tactical sprint pump in counter-phase to legs
        const pumpW = Math.max(this.wTac, isTacSprint ? 1 : 0);
        r.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(r.leftArm.shoulder.rotation.x, (0.38 - stride * 0.88) * pumpW, rate);
        r.leftArm.shoulder.rotation.y = 0;
        r.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(r.leftArm.shoulder.rotation.z, 0.16, rate);
        r.leftArm.elbow.rotation.x = THREE.MathUtils.lerp(r.leftArm.elbow.rotation.x, 1.38 + Math.max(0, -stride) * 0.24, rate);
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
