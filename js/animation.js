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
  const _qB = new THREE.Quaternion();
  const _qC = new THREE.Quaternion();
  const _eulA = new THREE.Euler(0, 0, 0, 'YXZ');
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

  // Analytical 2-Bone Leg IK in pelvis-local space (Law of Cosines + knee pole vector)
  // Thigh length L1 = 0.42, shin length L2 = 0.38, rest leg points along -Y,
  // knee flexion (-X rotation) swings shin toward local +Z so knee points forward (-Z).
  function solveLegIKInRigSpace(leg, targetInPelvis, poleDirInPelvis, footQuatInPelvis, toeBend = 0) {
    if (!leg || !leg.hip || !leg.knee || !leg.ankle) return;
    const L1 = 0.42;
    const L2 = 0.38;
    const hipPos = leg.hip.position;
    _vA.subVectors(targetInPelvis, hipPos);
    const rawDist = _vA.length();
    if (rawDist < 0.001) return;

    const maxReach = (L1 + L2) * 0.992;
    const minReach = Math.abs(L1 - L2) + 0.06;
    const d = THREE.MathUtils.clamp(rawDist, minReach, maxReach);
    _vA.multiplyScalar(1 / rawDist); // unit dir from hip to ankle target

    const cosAlpha = THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const alpha = Math.acos(cosAlpha);

    // Bend plane defined by forward/outward knee pole
    _vB.copy(poleDirInPelvis).addScaledVector(_vA, -poleDirInPelvis.dot(_vA));
    if (_vB.lengthSq() < 1e-5) _vB.set(0, 0, -1);
    _vB.normalize();

    // Desired thigh unit vector (hip -> knee)
    _vC.copy(_vA).multiplyScalar(Math.cos(alpha)).addScaledVector(_vB, Math.sin(alpha)).normalize();

    // Knee position & desired shin unit vector (knee -> target)
    _vD.copy(hipPos).addScaledVector(_vC, L1);
    _vE.subVectors(targetInPelvis, _vD);
    const shinLenSq = _vE.lengthSq();
    if (shinLenSq < 1e-6) _vE.copy(_vC);
    else _vE.multiplyScalar(1 / Math.sqrt(shinLenSq));

    // Align hip local +Y opposite thigh (-_vC) and local +Z toward rearward shin bend
    const yAxis = _vD.copy(_vC).multiplyScalar(-1).normalize();
    const bendBack = _vB.copy(_vE).addScaledVector(_vC, -_vE.dot(_vC));
    if (bendBack.lengthSq() < 1e-5) {
      bendBack.copy(poleDirInPelvis).multiplyScalar(-1).addScaledVector(_vC, poleDirInPelvis.dot(_vC));
      if (bendBack.lengthSq() < 1e-5) bendBack.set(0, 0, 1);
    }
    const zAxis = bendBack.normalize();
    const xAxis = _vA.crossVectors(yAxis, zAxis).normalize();
    zAxis.crossVectors(xAxis, yAxis).normalize();

    _mA.makeBasis(xAxis, yAxis, zAxis);
    _qA.setFromRotationMatrix(_mA);
    leg.hip.quaternion.copy(_qA);

    const cosKnee = THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1);
    const kneeBend = Math.PI - Math.acos(cosKnee);
    leg.knee.rotation.set(-kneeBend, 0, 0);

    if (footQuatInPelvis) {
      _eulA.set(-kneeBend, 0, 0, 'XYZ');
      _qB.setFromEuler(_eulA);
      _qA.multiply(_qB); // qKneeInPelvis
      _qA.invert().multiply(footQuatInPelvis); // local ankle orientation inside knee
      leg.ankle.quaternion.copy(_qA);
    }
    leg.toeBend = toeBend;
  }

  // Evaluate ground-locked biomechanical foot target & ankle/toe articulation for 0..1 gait phase u.
  // Phase u = 0 is heel touchdown out in front; [0..duty] sweeps linearly rearward across stance
  // pulling the operator forward; [duty..1] folds/drives the knee forward and extends out to touch down.
  function evalGaitFoot(u, cfg, out) {
    const p01 = ((u % 1) + 1) % 1;
    const duty = cfg.duty;
    let p, y, ankP, toeB;
    if (p01 < duty) {
      const s = p01 / duty;
      p = THREE.MathUtils.lerp(cfg.sFwd, -cfg.sBack, s);
      y = cfg.groundY;
      if (s < 0.16) {
        ankP = cfg.heelPitch * (1 - smoothstep(s / 0.16));
        toeB = 0;
      } else if (s <= 0.72) {
        ankP = 0;
        toeB = 0;
      } else {
        const kPush = smoothstep((s - 0.72) / 0.28);
        y += kPush * cfg.heelLiftY;
        ankP = -kPush * cfg.pushPitch;
        toeB = kPush * cfg.toePush;
      }
    } else {
      const w = (p01 - duty) / Math.max(0.05, 1 - duty);
      const wSm = smoothstep(w);
      const pawEnv = 9.481 * w * w * w * (1 - w);
      p = THREE.MathUtils.lerp(-cfg.sBack, cfg.sFwd, wSm) + pawEnv * cfg.sPaw;
      y = THREE.MathUtils.lerp(cfg.groundY + cfg.heelLiftY, cfg.groundY, wSm) +
        Math.pow(Math.sin(w * Math.PI), 0.85) * cfg.swingLift;
      if (w < 0.35) {
        ankP = THREE.MathUtils.lerp(-cfg.pushPitch, -cfg.pushPitch * 0.35, smoothstep(w / 0.35));
      } else {
        ankP = THREE.MathUtils.lerp(-cfg.pushPitch * 0.35, cfg.heelPitch, smoothstep(Math.min(1, (w - 0.35) / 0.55)));
      }
      toeB = w < 0.25 ? cfg.toePush * (1 - smoothstep(w / 0.25)) : 0;
    }
    const crossClear = Math.abs(cfg.dirX) * Math.max(0, 1 - Math.abs(p) / 0.20) * 0.045 * cfg.sideSign;
    out.x = cfg.baseX + p * cfg.dirX;
    out.y = y;
    out.z = p * cfg.dirZ + crossClear;
    out.anklePitch = ankP * cfg.fwdSign;
    out.ankleRoll = -cfg.dirX * (p / Math.max(0.15, cfg.sFwd)) * 0.10;
    out.toeBend = toeB * Math.max(0.25, Math.abs(cfg.fwdSign));
    return out;
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

    const P = window.AshfallPBR;
    const mkPBR = (preset, col, opts2 = {}) => {
      if (P) {
        const m = P.getMaterial(preset).clone();
        if (m.userData) delete m.userData._ashShared;
        if (col != null) m.color.set(col);
        Object.assign(m, opts2);
        return m;
      }
      return new THREE.MeshStandardMaterial({ color: col != null ? col : 0x3b4437, ...opts2 });
    };
    const uniformMat = mkPBR('cordura_olive', uniformCol, { roughness: 0.86 });
    const uniformDarkMat = mkPBR('cordura_olive', uniformDark, { roughness: 0.88 });
    const pantsMat = mkPBR('cordura_olive', pantsCol, { roughness: 0.88 });
    const gearMat = (P && P.getMaterial('cordura_black')) || new THREE.MeshStandardMaterial({ color: 0x1e2124, roughness: 0.82 });
    const strapMat = mkPBR('cordura_olive', 0x262925, { roughness: 0.84 });
    const padMat = (P && P.getMaterial('polymer_stippled')) || new THREE.MeshStandardMaterial({ color: 0x171a19, roughness: 0.62 });
    const helmetMat = mkPBR('painted_olive', opts.helmetColor != null ? opts.helmetColor : (isHeavy ? 0x1c1f24 : 0x2d332b), { roughness: 0.56, metalness: 0.15 });
    const skinMat = mkPBR('skin_tactical', opts.headColor != null ? opts.headColor : 0xd1a483, { roughness: 0.62 });
    const balaclavaMat = mkPBR('cordura_black', isScav ? 0x3d332a : 0x222522, { roughness: 0.90 });
    const visorMat = new THREE.MeshStandardMaterial({ color: isHeavy ? 0x4a1d1d : 0x101820, emissive: isHeavy ? 0x220808 : 0x061018, roughness: 0.12, metalness: 0.85 });

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
    const vestMat = mkPBR('cordura_olive', vestColor, { roughness: 0.84 });
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
      packMat = mkPBR('cordura_olive', bagId === 'bag_large' ? 0x353b31 : 0x3f433a, { roughness: 0.86 });
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
      const beanie = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.09, 0.225), mkPBR('cordura_black', 0x3a3228, { roughness: 0.92 }));
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
          const plateBody = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.17, 0.020), mkPBR('polymer_stippled', 0x22384c, { roughness: 0.55 }));
          const plateTrim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.024, 0.024), mkPBR('polymer_od', 0x4ea8de, { roughness: 0.45 }));
          plateTrim.position.y = 0.056;
          plateProp.add(plateBody, plateTrim);
        }
        plateProp.position.set(0.01, -0.08, -0.04);
        plateProp.rotation.set(0.35, 0, 0.12);
        plateProp.visible = false;

        handMag = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.15, 0.065), mkPBR('gunmetal_nitride', 0x4c5259, { roughness: 0.42, metalness: 0.85 }));
        handMag.position.set(0.02, -0.06, -0.03);
        handMag.visible = false;

        handShell = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.075, 14), mkPBR('polymer_stippled', 0xb52b2b, { roughness: 0.48 }));
        handShell.rotation.z = Math.PI / 2;
        handShell.position.set(0.02, -0.05, -0.03);
        handShell.visible = false;

        inventoryTablet = new THREE.Group();
        const tabBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.020, 0.16), gearMat);
        const tabScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.185, 0.125), new THREE.MeshStandardMaterial({ color: 0x164a3a, emissive: 0x0c3428, emissiveIntensity: 0.7, roughness: 0.18 }));
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
          new THREE.CylinderGeometry(0.015, 0.015, 0.12, 16),
          new THREE.MeshStandardMaterial({ color: 0x26f0a8, emissive: 0x0c7a52, emissiveIntensity: 0.8, roughness: 0.22, metalness: 0.1 })
        );
        const sCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.018, 0.032, 16), gearMat);
        sCollar.position.set(0, -0.055, 0);
        const sNeedle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0028, 0.0032, 0.058, 12),
          (P && P.getMaterial('steel_chrome')) || new THREE.MeshStandardMaterial({ color: 0xd0d8e0, roughness: 0.16, metalness: 0.96 })
        );
        sNeedle.position.set(0, -0.098, 0);
        const sPlunger = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.016, 0.024, 16),
          mkPBR('polymer_stippled', 0xd94626, { roughness: 0.48 })
        );
        sPlunger.position.set(0, 0.076, 0);
        syringeProp.add(sBarrel, sCollar, sNeedle, sPlunger);
        syringeProp.position.set(-0.01, -0.075, -0.035);
        syringeProp.rotation.set(Math.PI * 0.42, 0, 0.12);
        syringeProp.visible = false;

        // 3D M67 Frag Grenade prop for 3P throw animations
        grenadeProp = new THREE.Group();
        const gBody = new THREE.Mesh(
          new THREE.SphereGeometry(0.044, 16, 12),
          mkPBR('polymer_od', 0x45503b, { roughness: 0.62 })
        );
        const gFuze = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014, 0.017, 0.024, 14),
          (P && P.getMaterial('steel_brushed')) || new THREE.MeshStandardMaterial({ color: 0x8b939c, roughness: 0.32, metalness: 0.9 })
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
      this.gaitCycle = Math.random();
      this.walkPhase = this.gaitCycle * Math.PI * 2;
      this.idleTime = Math.random() * 10.0;
      this.crouchWalkBlend = 0;
      // AAA Procedural Momentum-Based Locomotion state
      this.velSpeed = 0;
      this.accelFwd = 0;
      this.prevSpeed = 0;
      this.prevWorldYaw = null;
      this.yawRate = 0;
      this.moveDirX = 0;
      this.moveDirZ = -1;
      this.prevOnGround = true;
      this.airTime = 0;
      this.landImpact = 0;
      this.startTimer = 0;
      this.stopTimer = 0;
      this.stopDur = 0.34;
      this.stopStrength = 0;
      this.stopLeadSide = -1;
      this.pivotTimer = 0;
      this.pivotSign = 0;
      this.wWalk = 0;
      this.wRun = 0;
      this.wTac = 0;
      this.gaitBlend = 0;
      this.locoPhase = 'idle';
      this.recoilImpulse = 0;
      this.flinchImpulse = 0;
      this.flinchDir = 1;
      this._rTarget = new THREE.Vector3();
      this._lTarget = new THREE.Vector3();
      this._rPole = new THREE.Vector3(0.75, -0.55, 0.35);
      this._lPole = new THREE.Vector3(-0.75, -0.55, 0.30);
      this._lFootState = { x: -0.115, y: 0.06, z: -0.04, anklePitch: 0, ankleRoll: 0, toeBend: 0 };
      this._rFootState = { x: 0.125, y: 0.06, z: 0.055, anklePitch: 0, ankleRoll: 0, toeBend: 0 };
      this._lFootRig = new THREE.Vector3(-0.115, 0.06, -0.04);
      this._rFootRig = new THREE.Vector3(0.125, 0.06, 0.055);
      this._legTargetP = new THREE.Vector3();
      this._legPoleP = new THREE.Vector3();
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
      const isTacSprint = (st.isTacSprinting !== undefined ? !!st.isTacSprinting : speed >= 7.45) && moving && !isProne && !isCrouch && !isADS;
      const isSprint = (st.isSprinting !== undefined ? !!st.isSprinting : speed > 4.9) && moving && !isProne && !isCrouch && !isADS && !isTacSprint;
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
        isSprinting: isSprint || this.wRun > 0.45,
        isTacSprinting: isTacSprint || this.wTac > 0.45,
        isSliding: isSlide,
        isDowned,
        dead: isDead,
        isProne,
        isReviving,
        isThrowing,
        stanceTrans: st.stanceTrans || null
      };

      // Update grip anchors for pistol vs rifle (using exact live 3P foregrip shaft anchor when equipped!)
      if (r.rearGripTarget && r.foregripTarget) {
        const pumpOff = st.pumpOffset || 0;
        if (isPistol) {
          r.rearGripTarget.position.set(0.01, -0.05, 0.02);
          r.foregripTarget.position.set(-0.02, -0.055, -0.01); // Two-handed weaver/isosceles pistol grip
        } else if (st.foregripPivotPos) {
          r.rearGripTarget.position.set(0.01, -0.055, 0.04);
          // Shift wrist slightly left (-2.4cm) & back (+4.6cm wrist->palmCenter) so 3P palm & fingers wrap dead-center around the foregrip shaft!
          r.foregripTarget.position.set(
            st.foregripPivotPos.x - 0.024,
            st.foregripPivotPos.y,
            st.foregripPivotPos.z + 0.046
          );
        } else if (st.hasVertGrip) {
          r.rearGripTarget.position.set(0.01, -0.055, 0.04);
          r.foregripTarget.position.set(-0.024, -0.098, -0.375 + pumpOff * 1.38);
        } else {
          r.rearGripTarget.position.set(0.01, -0.055, 0.04);
          r.foregripTarget.position.set(-0.01, -0.035, -0.25 + pumpOff * 1.38); // Left hand on rifle handguard / shotgun pump
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

      // 360-degree local travel direction for forward/backward/strafe foot trajectories + pivot detection
      let rawDirX = 0;
      let rawDirZ = -1;
      let hasDirInput = false;
      if (st.velLocalX !== undefined || st.velLocalZ !== undefined) {
        const vxL = st.velLocalX || 0;
        const vzL = st.velLocalZ || 0;
        const vMag = Math.hypot(vxL, vzL);
        if (vMag > 0.18) {
          rawDirX = vxL / vMag;
          rawDirZ = vzL / vMag;
          hasDirInput = true;
        }
      } else if (Math.abs(st.moveRight || 0) > 0.05 || st.moveForward !== undefined) {
        const mr = THREE.MathUtils.clamp(st.moveRight || 0, -1, 1);
        const mf = st.moveForward !== undefined ? st.moveForward : (1 - Math.abs(mr) * 0.35);
        const mMag = Math.hypot(mr, mf);
        if (mMag > 0.05) {
          rawDirX = mr / mMag;
          rawDirZ = -mf / mMag;
          hasDirInput = true;
        }
      }

      const isStanding = !isProne && !isCrouch && !isSlide && !isDowned && !isDead;
      if (hasDirInput) {
        const prevX = this.moveDirX;
        const prevZ = this.moveDirZ;
        const dirDot = prevX * rawDirX + prevZ * rawDirZ;
        if (isStanding && onGround && this.velSpeed > 2.2 && dirDot < 0.20 && this.pivotTimer <= 0) {
          this.pivotTimer = 0.28;
          this.pivotSign = (prevX * rawDirZ - prevZ * rawDirX) >= 0 ? 1 : -1;
        }
        const dLerp = Math.min(1, cDt * 12.5);
        this.moveDirX = THREE.MathUtils.lerp(this.moveDirX, rawDirX, dLerp);
        this.moveDirZ = THREE.MathUtils.lerp(this.moveDirZ, rawDirZ, dLerp);
        const mNorm = Math.hypot(this.moveDirX, this.moveDirZ);
        if (mNorm > 0.001) {
          this.moveDirX /= mNorm;
          this.moveDirZ /= mNorm;
        }
      }

      // Detect explosive Start Launch & speed-scaled Gather / Hard-Brake Stop transitions
      if (isStanding && onGround) {
        if (this.velSpeed < 1.25 && speed > 1.35 && this.accelFwd > 2.2 && this.startTimer <= 0) {
          this.startTimer = 0.34;
          this.stopTimer = 0;
        } else if (this.velSpeed > 1.15 && (speed < 0.55 || this.accelFwd < -5.8) && this.stopTimer <= 0) {
          this.stopStrength = THREE.MathUtils.clamp(this.velSpeed / 7.5, 0.28, 1.0);
          this.stopDur = THREE.MathUtils.lerp(0.24, 0.42, this.stopStrength);
          this.stopTimer = this.stopDur;
          this.startTimer = 0;
          this.stopLeadSide = this._lFootRig.z <= this._rFootRig.z ? -1 : 1; // plant whichever foot is out front
        }
      } else {
        this.startTimer = 0;
        this.stopTimer = 0;
        this.pivotTimer = 0;
      }
      if (this.startTimer > 0) this.startTimer = Math.max(0, this.startTimer - cDt);
      if (this.pivotTimer > 0) this.pivotTimer = Math.max(0, this.pivotTimer - cDt);
      if (this.stopTimer > 0) {
        this.stopTimer = Math.max(0, this.stopTimer - cDt);
        if (speed > 2.0) this.stopTimer = 0; // cancel stop plant immediately if accelerating again
      }

      this.velSpeed = THREE.MathUtils.lerp(this.velSpeed, speed, Math.min(1, cDt * (speed > this.velSpeed ? 12.0 : 8.5)));

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

      // Smoothly blend distinct locomotion phase weights: Walk -> Intense Sprint -> High-Port Tactical Sprint
      const wantTac = isStanding && onGround && moving && isTacSprint;
      const wantRun = isStanding && onGround && moving && !wantTac && (isSprint || (st.isSprinting === undefined && this.velSpeed >= 5.3));
      const wantWalk = isStanding && onGround && moving && !wantTac && !wantRun;
      const pLerp = Math.min(1, cDt * (moving ? 10.5 : 8.5));
      this.wTac  = THREE.MathUtils.lerp(this.wTac,  wantTac  ? 1 : 0, pLerp);
      this.wRun  = THREE.MathUtils.lerp(this.wRun,  wantRun  ? 1 : 0, pLerp);
      this.wWalk = THREE.MathUtils.lerp(this.wWalk, wantWalk ? 1 : 0, pLerp);
      this.gaitBlend = THREE.MathUtils.lerp(
        this.gaitBlend,
        (isStanding && onGround && moving) ? 1 : 0,
        Math.min(1, cDt * (moving ? 12.0 : 7.5))
      );
      this.locoPhase = !moving
        ? (this.stopTimer > 0 ? 'stop' : 'idle')
        : (this.startTimer > 0 ? 'start' : (this.pivotTimer > 0 ? 'cut' : (wantTac ? 'tacSprint' : (wantRun ? 'run' : 'walk'))));
      r._animState.locoPhase = this.locoPhase;

      // Advance procedural gait cycle cleanly coupled to momentum & distinct 3-tier cadence
      if ((moving || this.velSpeed > 0.35) && !isSlide && !isDowned && onGround) {
        let freqRad;
        if (isProne) freqRad = 3.1;
        else if (isCrouch) freqRad = 5.6 + Math.min(speed, 4.0) * 0.45;
        else {
          const walkHz = 1.05 + Math.min(this.velSpeed, 4.8) * 0.085;
          const runHz  = 1.62 + Math.max(0, Math.min(this.velSpeed - 4.8, 3.0)) * 0.11;
          const tacHz  = 1.98 + Math.max(0, Math.min(this.velSpeed - 7.0, 2.5)) * 0.08;
          const wTot = Math.max(0.001, this.wWalk + this.wRun + this.wTac);
          const cycleHz = (walkHz * this.wWalk + runHz * this.wRun + tacHz * this.wTac) / wTot;
          this.gaitCycle = (this.gaitCycle + cDt * cycleHz) % 1;
          freqRad = cycleHz * Math.PI * 2;
        }
        if (isProne || isCrouch) {
          this.gaitCycle = (this.gaitCycle + cDt * (freqRad / (Math.PI * 2))) % 1;
        }
        this.walkPhase = this.gaitCycle * Math.PI * 2;
      } else if (isDowned && moving) {
        this.gaitCycle = (this.gaitCycle + cDt * (4.2 / (Math.PI * 2))) % 1;
        this.walkPhase = this.gaitCycle * Math.PI * 2;
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
        // === AAA PROCEDURAL MOMENTUM-BASED LOCOMOTION (START -> WALK -> INTENSE SPRINT -> HIGH-PORT TAC-SPRINT -> STOP) ===
        const moveBlend = THREE.MathUtils.clamp(this.gaitBlend, 0, 1);
        const startArc = this.startTimer > 0 ? Math.sin((this.startTimer / 0.34) * Math.PI) : 0;
        const stopProg = this.stopTimer > 0 ? (1 - this.stopTimer / Math.max(0.01, this.stopDur)) : 0;
        const stopEnv = this.stopTimer > 0 ? Math.sin(stopProg * Math.PI) : 0;
        const pivotArc = this.pivotTimer > 0 ? Math.sin((this.pivotTimer / 0.28) * Math.PI) : 0;
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
          // Distinct biomechanical foot trajectories across Walk / Intense Sprint / High-Port Tac-Sprint
          const wSum = Math.max(0.001, this.wWalk + this.wRun + this.wTac);
          const nW = this.wWalk / wSum;
          const nR = this.wRun / wSum;
          const nT = this.wTac / wSum;

          const groundY = 0.060;
          const speedRatio = moveBlend > 0.01 ? THREE.MathUtils.clamp(this.velSpeed / 4.2, 0.55, 1.15) : 0.75;
          const strideScale = nW < 0.99 ? THREE.MathUtils.lerp(speedRatio, 1.0, nR + nT) : speedRatio;

          // At touchdown foot plants ahead at sFwd (during swing extends further out by +sPaw before active paw-back!),
          // sweeps linearly to -sBack across stance pulling operator forward, then hands off smoothly to opposing lead leg.
          const gaitCfg = {
            duty: 0.58 * nW + 0.45 * nR + 0.40 * nT,
            sFwd: (0.41 * nW + 0.45 * nR + 0.48 * nT) * strideScale + startArc * 0.04,
            sBack: (0.37 * nW + 0.46 * nR + 0.50 * nT) * strideScale + startArc * 0.06,
            sPaw: 0.035 * nW + 0.22 * nR + 0.31 * nT,
            swingLift: 0.115 * nW + 0.24 * nR + 0.30 * nT,
            heelLiftY: 0.036 * nW + 0.052 * nR + 0.060 * nT,
            heelPitch: 0.26 * nW + 0.16 * nR + 0.12 * nT,
            pushPitch: 0.38 * nW + 0.54 * nR + 0.62 * nT,
            toePush: 0.36 * nW + 0.48 * nR + 0.56 * nT,
            groundY,
            dirX: this.moveDirX,
            dirZ: this.moveDirZ,
            fwdSign: THREE.MathUtils.clamp(-this.moveDirZ, -1, 1),
            sideSign: -1,
            baseX: -0.114 - Math.abs(this.moveDirX) * 0.025 * moveBlend - pivotArc * 0.04
          };

          const lf = evalGaitFoot(this.gaitCycle, gaitCfg, this._lFootState);
          gaitCfg.sideSign = 1;
          gaitCfg.baseX = 0.114 + Math.abs(this.moveDirX) * 0.025 * moveBlend + pivotArc * 0.04;
          const rf = evalGaitFoot(this.gaitCycle + 0.5, gaitCfg, this._rFootState);

          // Tactical balanced ready stance at idle (left foot slightly leading, right staggered back)
          const idleLX = -0.115, idleLZ = -0.045;
          const idleRX =  0.125, idleRZ =  0.055;
          let lx = THREE.MathUtils.lerp(idleLX, lf.x, moveBlend);
          let ly = THREE.MathUtils.lerp(groundY, lf.y, moveBlend);
          let lz = THREE.MathUtils.lerp(idleLZ, lf.z, moveBlend);
          let rx = THREE.MathUtils.lerp(idleRX, rf.x, moveBlend);
          let ry = THREE.MathUtils.lerp(groundY, rf.y, moveBlend);
          let rz = THREE.MathUtils.lerp(idleRZ, rf.z, moveBlend);
          let lAnkP = THREE.MathUtils.lerp(0, lf.anklePitch, moveBlend);
          let rAnkP = THREE.MathUtils.lerp(0, rf.anklePitch, moveBlend);
          let lAnkR = THREE.MathUtils.lerp(0, lf.ankleRoll, moveBlend);
          let rAnkR = THREE.MathUtils.lerp(0, rf.ankleRoll, moveBlend);
          let lToe = THREE.MathUtils.lerp(0, lf.toeBend, moveBlend);
          let rToe = THREE.MathUtils.lerp(0, rf.toeBend, moveBlend);

          // Speed-scaled Gather / Hard-Brake Stop transition (lead foot brakes out front, trailing foot gathers smoothly)
          if (stopEnv > 0.01) {
            const leadLeft = this.stopLeadSide < 0;
            const sStr = this.stopStrength;
            const gatherK = smoothstep(Math.min(1, stopProg / 0.86));
            const leadZ = THREE.MathUtils.lerp(-0.34 * sStr, leadLeft ? idleLZ : idleRZ, smoothstep(Math.max(0, (stopProg - 0.30) / 0.70)));
            const trailZ = THREE.MathUtils.lerp(0.24 * sStr, leadLeft ? idleRZ : idleLZ, gatherK);
            const trailLift = Math.sin(gatherK * Math.PI) * 0.065 * sStr;
            const leadAnk = THREE.MathUtils.lerp(0.20 * sStr, 0, Math.min(1, stopProg / 0.45));
            const trailAnk = -0.14 * sStr * Math.sin(gatherK * Math.PI);
            if (leadLeft) {
              lz = THREE.MathUtils.lerp(lz, leadZ, stopEnv);
              ly = THREE.MathUtils.lerp(ly, groundY, stopEnv);
              lAnkP = THREE.MathUtils.lerp(lAnkP, leadAnk, stopEnv);
              rz = THREE.MathUtils.lerp(rz, trailZ, stopEnv);
              ry = THREE.MathUtils.lerp(ry, groundY + trailLift, stopEnv);
              rAnkP = THREE.MathUtils.lerp(rAnkP, trailAnk, stopEnv);
              lToe *= (1 - stopEnv);
            } else {
              rz = THREE.MathUtils.lerp(rz, leadZ, stopEnv);
              ry = THREE.MathUtils.lerp(ry, groundY, stopEnv);
              rAnkP = THREE.MathUtils.lerp(rAnkP, leadAnk, stopEnv);
              lz = THREE.MathUtils.lerp(lz, trailZ, stopEnv);
              ly = THREE.MathUtils.lerp(ly, groundY + trailLift, stopEnv);
              lAnkP = THREE.MathUtils.lerp(lAnkP, trailAnk, stopEnv);
              rToe *= (1 - stopEnv);
            }
          }

          // Two-foot terrain IK under each foot's live world footprint
          let minGroundDrop = 0;
          if (st.world && st.world.getTerrainHeight && st.worldPos && !isProne && !isSlide) {
            const yawW = st.worldYaw || 0;
            const sinY = Math.sin(yawW);
            const cosY = Math.cos(yawW);
            const feetY = st.feetY !== undefined ? st.feetY : st.worldPos.y;
            const lG = st.world.getTerrainHeight(st.worldPos.x + lx * cosY + lz * sinY, st.worldPos.z - lx * sinY + lz * cosY);
            const rG = st.world.getTerrainHeight(st.worldPos.x + rx * cosY + rz * sinY, st.worldPos.z - rx * sinY + rz * cosY);
            const dL = THREE.MathUtils.clamp(lG - feetY, -0.32, 0.32);
            const dR = THREE.MathUtils.clamp(rG - feetY, -0.32, 0.32);
            minGroundDrop = Math.min(0, dL, dR);
            ly += dL;
            ry += dR;
          }

          this._lFootRig.set(lx, ly, lz);
          this._rFootRig.set(rx, ry, rz);
          this._lFootState.anklePitch = lAnkP;
          this._rFootState.anklePitch = rAnkP;
          this._lFootState.ankleRoll = lAnkR;
          this._rFootState.ankleRoll = rAnkR;
          this._lFootState.toeBend = lToe;
          this._rFootState.toeBend = rToe;

          // Pelvis vertical trajectory: inverted pendulum double-support dip on walk vs explosive sprint bounce
          const stepPhaseSin2 = Math.abs(Math.sin(this.walkPhase));
          const walkBob = -stepPhaseSin2 * 0.036;
          const runBob = (Math.abs(strideCos) - 0.45) * (0.072 * nR + 0.095 * nT);
          const baseIdleY = 0.875 + breath * 0.005;
          const phaseComY = 0.855 * nW + 0.835 * nR + 0.822 * nT;
          pelvisY = THREE.MathUtils.lerp(baseIdleY, phaseComY + walkBob * nW + runBob, moveBlend)
            + minGroundDrop * 0.72
            - startArc * 0.045
            - stopEnv * 0.075 * this.stopStrength
            - pivotArc * 0.055
            - landArc * 0.14;

          // Pelvis counter-rotation locked in phase to actual foot Z separation (-rz+lz so left hip moves FORWARD with left foot!)
          const footSepZ = rz - lz;
          const yawAmp = (0.14 * nW + 0.24 * nR + 0.32 * nT) * moveBlend;
          pelvisYaw = THREE.MathUtils.lerp(0.14, THREE.MathUtils.clamp(-footSepZ * 0.48, -yawAmp, yawAmp), moveBlend);
          spineYaw = -pelvisYaw * 0.62;
          torsoYaw = -pelvisYaw * 0.38;

          // Reach-guard so planted stance/strike feet never hover or miss their IK ground contact
          const maxLegSpan = 0.786;
          const clampPelvisForFoot = (fX, fY, fZ, hX) => {
            const cosPY = Math.cos(pelvisYaw), sinPY = Math.sin(pelvisYaw);
            const hipX = hX * cosPY;
            const hipZ = -hX * sinPY;
            const horizSq = (fX - hipX) * (fX - hipX) + (fZ - hipZ) * (fZ - hipZ);
            const maxDy = Math.sqrt(Math.max(0.06, maxLegSpan * maxLegSpan - horizSq));
            return fY + 0.04 + maxDy;
          };
          pelvisY = Math.max(
            0.46,
            Math.min(
              pelvisY,
              clampPelvisForFoot(lx, ly, lz, -0.112),
              clampPelvisForFoot(rx, ry, rz, 0.112)
            )
          );

          // Momentum-driven forward/backward torso lean: sprint aggression, start launch, hard brake whip, & landing shock
          const accelLean = THREE.MathUtils.clamp(-this.accelFwd * 0.011, -0.14, 0.10);
          const stopWhip = stopEnv > 0.01 ? (Math.sin(stopProg * Math.PI * 1.6) * 0.095 * this.stopStrength * (1 - stopProg * 0.4)) : 0;
          const phaseSpine = (-0.05 * nW - 0.16 * nR - 0.21 * nT) * moveBlend;
          const phaseTorso = (-0.06 * nW - 0.19 * nR - 0.23 * nT) * moveBlend;
          spinePitch = phaseSpine + accelLean * 0.6 - startArc * 0.11 - stopWhip - landArc * 0.12;
          torsoPitch = phaseTorso + accelLean * 0.4 - startArc * 0.10 - stopWhip * 0.8 - landArc * 0.14 + breath * 0.016;

          // Athletic corner-banking roll into turns, lateral strafes, and rapid pivot cuts
          const bankRoll = THREE.MathUtils.clamp(this.yawRate * this.velSpeed * 0.018, -0.18, 0.18);
          rigRoll = -this.moveDirX * moveBlend * (0.045 + 0.065 * (this.wRun + this.wTac)) + bankRoll + pivotArc * 0.08 * this.pivotSign;
        }

        this._rPole.set(0.75, -0.55, 0.35);
        this._lPole.set(-0.75, -0.55, 0.30);

        // Smooth phase-blended weapon carry: Tactical Ready Walk -> Aggressive Cross-Chest Sprint -> Skyward High-Port Tac-Sprint!
        if (this.wTac > 0.02 || this.wRun > 0.02) {
          const rW = this.wRun;
          const tW = this.wTac;
          // Intense Combat Sprint cross-chest drive with energetic stride pump
          if (rW > 0.01) {
            const runPump = Math.sin(this.walkPhase * 2);
            wpnPosX = THREE.MathUtils.lerp(wpnPosX, 0.04 + strideCos * 0.048, rW);
            wpnPosY = THREE.MathUtils.lerp(wpnPosY, 0.25 + runPump * 0.028, rW);
            wpnPosZ = THREE.MathUtils.lerp(wpnPosZ, -0.25, rW);
            wpnRotX = THREE.MathUtils.lerp(wpnRotX, -0.18 + runPump * 0.05, rW);
            wpnRotY = THREE.MathUtils.lerp(wpnRotY, 0.50 - strideCos * 0.08, rW);
            wpnRotZ = THREE.MathUtils.lerp(wpnRotZ, -0.22 + strideCos * 0.06, rW);
          }
          // High-Port Tactical Sprint: barrel angled ~62° skyward beside helmet + seamless left-arm sprinter pump blend!
          if (tW > 0.01) {
            const pumpEase = smoothstep((tW - 0.05) / 0.55);
            const tacBounce = Math.sin(this.walkPhase * 2) * 0.026;
            wpnPosX = THREE.MathUtils.lerp(wpnPosX, 0.21, tW);
            wpnPosY = THREE.MathUtils.lerp(wpnPosY, 0.41 + tacBounce, tW);
            wpnPosZ = THREE.MathUtils.lerp(wpnPosZ, -0.17, tW);
            wpnRotX = THREE.MathUtils.lerp(wpnRotX, 1.58 + strideCos * 0.04, tW);
            wpnRotY = THREE.MathUtils.lerp(wpnRotY, 0.22, tW);
            wpnRotZ = THREE.MathUtils.lerp(wpnRotZ, -0.22, tW);
            this._rPole.set(0.55, -0.75, 0.20);
            leftIKWeight *= (1 - pumpEase);
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

      // === LAYER 4: ACTION OVERLAYS (CLIMB/MANTLE, 4-STAGE MW2 PLATING, RELOAD, MEDKIT, REVIVE SYRINGE, GRENADE THROW, STANCE TRANSITION) ===
      let customLeftArm = null;
      let customRightArm = null;
      r._climbWorldHands = null;
      if (st.ledgeState && !isDowned) {
        const ls = st.ledgeState;
        const p = THREE.MathUtils.clamp(ls.pullProgress || 0, 0, 1);
        const pullArc = Math.sin(p * Math.PI);
        pelvisYaw = 0;
        spineYaw = 0;
        torsoYaw = 0;
        if (st.isFP) {
          // 1P lower-body wall hang & step-up (arms driven by RiggedFPArms in vmCamera)
          torsoPitch = -0.06 - pullArc * 0.10;
          lHipX = 0.14 + pullArc * 0.46; lKneeX = -0.26 - pullArc * 0.46; lAnkX = 0.16;
          rHipX = 0.08 + p * 0.24;       rKneeX = -0.20 - pullArc * 0.30; rAnkX = 0.14;
        } else {
          leftIKWeight = 0.0;
          rightIKWeight = 0.0;
          spinePitch = -0.08 - pullArc * 0.14;
          torsoPitch = -0.14 - pullArc * 0.18;
          headPitch = 0.24 * (1 - p);
          lHipX = 0.32 + pullArc * 0.88; lKneeX = -0.58 - pullArc * 0.72; lAnkX = 0.28;
          rHipX = 0.12 + p * 0.42;       rKneeX = -0.34 - pullArc * 0.40; rAnkX = 0.22;
          const armLift = THREE.MathUtils.lerp(2.26, 0.88, smoothstep(Math.min(1, p / 0.85)));
          customLeftArm = { shX: armLift, shZ: 0.18, elbX: 0.42 + pullArc * 0.72 };
          customRightArm = { shX: armLift, shZ: -0.18, elbX: 0.42 + pullArc * 0.72 };

          if (ls.edgePos) {
            const relEase = smoothstep(THREE.MathUtils.clamp((p - 0.68) / 0.22, 0, 1));
            const lockW = 1 - relEase;
            const pressEase = smoothstep(THREE.MathUtils.clamp(p / 0.58, 0, 1));
            const ledgeInward = new THREE.Vector3(ls.inwardX || 0, 0, ls.inwardZ || 0);
            if (ledgeInward.lengthSq() < 1e-5) ledgeInward.set(-Math.sin(ls.ledgeYaw || 0), 0, -Math.cos(ls.ledgeYaw || 0));
            ledgeInward.normalize();
            const ledgeOutward = ledgeInward.clone().negate();
            const worldUp = new THREE.Vector3(0, 1, 0);
            const ledgeRight = new THREE.Vector3().crossVectors(ledgeInward, worldUp).normalize();
            const span = ls.edgeHalfWidth || 0.20;
            const inwardLip = THREE.MathUtils.lerp(0.045, 0.048, pressEase);
            const palmY = THREE.MathUtils.lerp(0.022, 0.015, pressEase);
            const mkSide = (sSign) => ({
              blend: lockW,
              palmWorld: ls.edgePos.clone()
                .addScaledVector(ledgeRight, sSign * span)
                .addScaledVector(worldUp, palmY)
                .addScaledVector(ledgeInward, inwardLip),
              fWorld: new THREE.Vector3()
                .addScaledVector(ledgeInward, THREE.MathUtils.lerp(0.985, 0.92, pressEase))
                .addScaledVector(worldUp, THREE.MathUtils.lerp(0.015, -0.10, pressEase))
                .addScaledVector(ledgeRight, -sSign * THREE.MathUtils.lerp(0.08, 0.14, pressEase))
                .normalize(),
              backWorld: new THREE.Vector3()
                .addScaledVector(worldUp, THREE.MathUtils.lerp(0.96, 0.95, pressEase))
                .addScaledVector(ledgeOutward, THREE.MathUtils.lerp(0.20, 0.22, pressEase))
                .addScaledVector(ledgeRight, sSign * THREE.MathUtils.lerp(0.15, 0.18, pressEase))
                .normalize(),
              poleOffsetWorld: new THREE.Vector3()
                .addScaledVector(ledgeOutward, THREE.MathUtils.lerp(0.42, 0.46, pressEase))
                .addScaledVector(ledgeRight, sSign * THREE.MathUtils.lerp(0.36, 0.46, pressEase))
                .addScaledVector(worldUp, THREE.MathUtils.lerp(-0.36, -0.18, pressEase)),
              curl: [
                THREE.MathUtils.lerp(0.05, 0.20, pressEase),
                THREE.MathUtils.lerp(0.11, 0.24, pressEase),
                THREE.MathUtils.lerp(0.08, 0.16, pressEase)
              ],
              thumb: THREE.MathUtils.lerp(0.18, 0.28, pressEase)
            });
            r._climbWorldHands = { left: mkSide(-1), right: mkSide(1) };
          }
        }
      } else if (st.mantleState && !isDowned) {
        const ms = st.mantleState;
        const mt = THREE.MathUtils.clamp(ms.t || 0, 0, 1);
        const mArc = Math.sin(mt * Math.PI);
        if (st.isFP) {
          lHipX = 0.16 + mArc * 0.48; lKneeX = -0.26 - mArc * 0.48; lAnkX = 0.16;
          rHipX = 0.06 + mt * 0.22;   rKneeX = -0.18 - mArc * 0.25; rAnkX = 0.12;
        } else {
          let contactW = 0;
          if (mt < 0.12) contactW = smoothstep(mt / 0.12);
          else if (mt <= 0.62) contactW = 1.0;
          else if (mt < 0.90) contactW = 1 - smoothstep((mt - 0.62) / 0.28);
          if (typeof ms.ledgeY === 'number' && st.worldPos) {
            contactW *= smoothstep(THREE.MathUtils.clamp((0.96 - (st.worldPos.y - ms.ledgeY)) / 0.18, 0, 1));
          }
          leftIKWeight = 1 - contactW;
          torsoPitch -= 0.16 * mArc;
          lHipX = 0.24 + mArc * 0.92; lKneeX = -0.38 - mArc * 0.82; lAnkX = 0.26;
          rHipX = 0.08 + mt * 0.35;   rKneeX = -0.28 - mArc * 0.35; rAnkX = 0.20;
          wpnPosX = 0.18; wpnPosY = 0.24; wpnPosZ = -0.20;
          wpnRotX = -0.34 * mArc; wpnRotZ = -0.24 * mArc;
          if (contactW > 0.04) {
            customLeftArm = { shX: 0.96 + contactW * 0.24, shZ: 0.20, elbX: 0.36 + contactW * 0.35 };
          }
          if (ms.edgePos && contactW > 0.01) {
            const ledgeInward = new THREE.Vector3(ms.inwardX || 0, 0, ms.inwardZ || 0);
            if (ledgeInward.lengthSq() < 1e-5) ledgeInward.set(-Math.sin(ms.ledgeYaw || 0), 0, -Math.cos(ms.ledgeYaw || 0));
            ledgeInward.normalize();
            const ledgeOutward = ledgeInward.clone().negate();
            const worldUp = new THREE.Vector3(0, 1, 0);
            const ledgeRight = new THREE.Vector3().crossVectors(ledgeInward, worldUp).normalize();
            const latOff = Math.min(0.16, ms.edgeHalfWidth || 0.18);
            r._climbWorldHands = {
              left: {
                blend: contactW,
                palmWorld: ms.edgePos.clone()
                  .addScaledVector(ledgeRight, -latOff)
                  .addScaledVector(worldUp, 0.016)
                  .addScaledVector(ledgeInward, 0.045),
                fWorld: new THREE.Vector3()
                  .addScaledVector(ledgeInward, 0.92)
                  .addScaledVector(worldUp, -0.10)
                  .addScaledVector(ledgeRight, 0.14)
                  .normalize(),
                backWorld: new THREE.Vector3()
                  .addScaledVector(worldUp, 0.95)
                  .addScaledVector(ledgeOutward, 0.22)
                  .addScaledVector(ledgeRight, -0.18)
                  .normalize(),
                poleOffsetWorld: new THREE.Vector3()
                  .addScaledVector(ledgeOutward, 0.44)
                  .addScaledVector(ledgeRight, -0.42)
                  .addScaledVector(worldUp, -0.22),
                curl: [0.20, 0.24, 0.16],
                thumb: 0.28
              },
              right: null
            };
          }
        }
      } else if (isReviving) {
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
        // Two-stage 3P Tactical Medkit Choreography: Forearm compression wrap (0..0.56) -> Auto-injector press (0.56..1.0)!
        const hp = st.healProgress !== undefined ? st.healProgress : ((this.idleTime * 0.22) % 1);
        leftIKWeight = 0.0;
        wpnPosX = 0.25; wpnPosY = 0.10; wpnPosZ = -0.14; wpnRotX = -0.88;
        headPitch = -0.34;
        if (hp < 0.56) {
          const wrapWave = Math.sin(hp * Math.PI * 6.0);
          customLeftArm = { shX: 0.94 + wrapWave * 0.06, shZ: 0.52, elbX: 1.38 + wrapWave * 0.08 };
        } else {
          const injT = THREE.MathUtils.clamp((hp - 0.56) / 0.44, 0, 1);
          const jab = injT < 0.35 ? smoothstep(injT / 0.35) : (injT < 0.80 ? 1 : 1 - smoothstep((injT - 0.80) / 0.20));
          if (r.syringeProp) r.syringeProp.visible = true;
          rightIKWeight = 0.0;
          customLeftArm = { shX: 0.88, shZ: 0.44, elbX: 1.44 };
          customRightArm = { shX: 0.96 + jab * 0.18, shZ: -0.46 - jab * 0.12, elbX: 1.32 + jab * 0.22 };
        }
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

      // Lower-body legs: ground-locked analytical IK for standing locomotion & idle, FK Euler for special states
      const useStandingFootIK = isStanding && onGround && !st.ledgeState && !st.mantleState && !isReviving
        && !(st.stanceTrans && st.stanceTrans.timer > 0);
      if (useStandingFootIK) {
        const curPY = r.pelvis.position.y;
        const curPYaw = r.pelvis.rotation.y;
        const cosNP = Math.cos(-curPYaw);
        const sinNP = Math.sin(-curPYaw);
        _qC.setFromAxisAngle(_upY, -curPYaw); // converts rigPivot orientation -> pelvis space

        const solveStandFoot = (leg, footPosR, footSt, sideSign, poleX) => {
          const dxR = footPosR.x;
          const dyR = footPosR.y - curPY;
          const dzR = footPosR.z;
          this._legTargetP.set(dxR * cosNP + dzR * sinNP, dyR, -dxR * sinNP + dzR * cosNP);

          const footYaw = -sideSign * 0.04;
          _eulA.set(footSt.anklePitch || 0, footYaw, footSt.ankleRoll || 0, 'YXZ');
          _qB.setFromEuler(_eulA).premultiply(_qC);

          // Knee pole points forward along foot travel slightly outward in pelvis space
          const pX = poleX + this.moveDirX * 0.15;
          const pZ = -0.85 + Math.min(0, this.moveDirZ) * 0.25;
          this._legPoleP.set(pX * cosNP + pZ * sinNP, -0.05, -pX * sinNP + pZ * cosNP);
          solveLegIKInRigSpace(leg, this._legTargetP, this._legPoleP, _qB, footSt.toeBend || 0);
        };

        solveStandFoot(r.leftLeg, this._lFootRig, this._lFootState, -1, -0.14);
        solveStandFoot(r.rightLeg, this._rFootRig, this._rFootState, 1, 0.14);
      } else {
        r.leftLeg.hip.rotation.x = THREE.MathUtils.lerp(r.leftLeg.hip.rotation.x, lHipX, rate);
        r.leftLeg.hip.rotation.y = THREE.MathUtils.lerp(r.leftLeg.hip.rotation.y, 0, rate);
        r.leftLeg.hip.rotation.z = THREE.MathUtils.lerp(r.leftLeg.hip.rotation.z, lHipZ, rate);
        r.leftLeg.knee.rotation.x = THREE.MathUtils.lerp(r.leftLeg.knee.rotation.x, lKneeX, rate);
        r.leftLeg.ankle.rotation.x = THREE.MathUtils.lerp(r.leftLeg.ankle.rotation.x, lAnkX, rate);
        r.leftLeg.ankle.rotation.y = THREE.MathUtils.lerp(r.leftLeg.ankle.rotation.y, 0, rate);
        r.leftLeg.ankle.rotation.z = THREE.MathUtils.lerp(r.leftLeg.ankle.rotation.z, 0, rate);
        r.leftLeg.toeBend = 0;

        r.rightLeg.hip.rotation.x = THREE.MathUtils.lerp(r.rightLeg.hip.rotation.x, rHipX, rate);
        r.rightLeg.hip.rotation.y = THREE.MathUtils.lerp(r.rightLeg.hip.rotation.y, 0, rate);
        r.rightLeg.hip.rotation.z = THREE.MathUtils.lerp(r.rightLeg.hip.rotation.z, rHipZ, rate);
        r.rightLeg.knee.rotation.x = THREE.MathUtils.lerp(r.rightLeg.knee.rotation.x, rKneeX, rate);
        r.rightLeg.ankle.rotation.x = THREE.MathUtils.lerp(r.rightLeg.ankle.rotation.x, rAnkX, rate);
        r.rightLeg.ankle.rotation.y = THREE.MathUtils.lerp(r.rightLeg.ankle.rotation.y, 0, rate);
        r.rightLeg.ankle.rotation.z = THREE.MathUtils.lerp(r.rightLeg.ankle.rotation.z, 0, rate);
        r.rightLeg.toeBend = 0;
      }

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

      const tacSuppress = isPlating || isReloading || isHealing || isReviving || isThrowing
        || !!st.ledgeState || !!st.mantleState || isDowned || isDead || isSlide || isProne || isCrouch;
      const tacPumpW = (this.wTac > 0.05 && !tacSuppress && !customLeftArm)
        ? smoothstep((this.wTac - 0.05) / 0.55)
        : 0;
      if (leftIKWeight > 0.01 && !customLeftArm && r.weaponPivot && r.foregripTarget) {
        this._lTarget.copy(r.foregripTarget.position).applyMatrix4(r.weaponPivot.matrix);
        solveArmIKInTorsoSpace(r.leftArm, this._lTarget, this._lPole, tacPumpW > 0.01 ? 1.0 : leftIKWeight);
      }
      if (customLeftArm) {
        r.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(r.leftArm.shoulder.rotation.x, customLeftArm.shX, rate);
        r.leftArm.shoulder.rotation.y = THREE.MathUtils.lerp(r.leftArm.shoulder.rotation.y, 0, rate);
        r.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(r.leftArm.shoulder.rotation.z, customLeftArm.shZ, rate);
        r.leftArm.elbow.rotation.x = THREE.MathUtils.lerp(r.leftArm.elbow.rotation.x, customLeftArm.elbX, rate);
      } else if (tacPumpW > 0.01) {
        // Athletic left-arm High-Port sprinter pump in counter-phase to legs, blended seamlessly off the foregrip
        const armPhase = Math.cos((this.gaitCycle - 0.04) * Math.PI * 2);
        const pumpShX = 0.48 - armPhase * 0.96;
        const pumpShZ = 0.16;
        const pumpElbX = 1.44 + Math.max(0, -armPhase) * 0.28;
        if (leftIKWeight > 0.01) {
          _eulA.set(pumpShX, 0, pumpShZ, 'XYZ');
          _qA.setFromEuler(_eulA);
          r.leftArm.shoulder.quaternion.slerp(_qA, tacPumpW);
          r.leftArm.elbow.rotation.x = THREE.MathUtils.lerp(r.leftArm.elbow.rotation.x, pumpElbX, tacPumpW);
        } else {
          r.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(r.leftArm.shoulder.rotation.x, pumpShX, rate);
          r.leftArm.shoulder.rotation.y = THREE.MathUtils.lerp(r.leftArm.shoulder.rotation.y, 0, rate);
          r.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(r.leftArm.shoulder.rotation.z, pumpShZ, rate);
          r.leftArm.elbow.rotation.x = THREE.MathUtils.lerp(r.leftArm.elbow.rotation.x, pumpElbX, rate);
        }
      } else if (isDowned) {
        r.leftArm.shoulder.rotation.set(0.45 + stride * 0.24, 0, 0.24);
        r.leftArm.elbow.rotation.set(0.55, 0, 0);
      }
    }
  }

  window.MW2Rig = {
    buildCharacterRig,
    solveArmIKInTorsoSpace,
    solveLegIKInRigSpace,
    evalGaitFoot
  };
  window.MW2Animator = MW2Animator;

  // Backwards-compatible alias so any legacy caller automatically gets the MW2 Rig!
  window.buildTacticalOperatorModel = function (opts = {}) {
    return buildCharacterRig(opts);
  };
})();
