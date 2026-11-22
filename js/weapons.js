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
      ironGroup.add(rearPivot, frontPivot);
    }

    group.add(ironGroup);
    return ironGroup;
  }

  _addScope(group, scopeY, style = 'lpvo', receiverTopY = 0.030) {
    // High-precision watertight LatheGeometry scope tube (outer matte body + beveled lips + matte-black inner bore — zero see-through gaps!)
    const scopeOuterMat = new THREE.MeshLambertMaterial({ color: 0x1a1e22 });
    const scopeInnerMat = new THREE.MeshLambertMaterial({ color: 0x090a0c, side: THREE.BackSide });
    const ringMat = new THREE.MeshLambertMaterial({ color: 0x262a2f });
    const accentMat = new THREE.MeshLambertMaterial({ color: 0x3a4047 });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x7cb8e8, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
    const reticleMat = new THREE.MeshBasicMaterial({ color: 0x0b0b0b });
    const illumMat = new THREE.MeshBasicMaterial({ color: 0xff2b2b });

    const isSniper = style === 'sniper';
    const isAcog = style === 'acog';
    const rTube = isSniper ? 0.0185 : (isAcog ? 0.0165 : 0.0170);
    const rFront = isSniper ? 0.0255 : (isAcog ? 0.0205 : 0.0200);
    const rRear = isSniper ? 0.0215 : (isAcog ? 0.0185 : 0.0205);
    const len = isSniper ? 0.275 : (isAcog ? 0.135 : 0.215);
    const zCenter = isSniper ? -0.025 : (isAcog ? 0.015 : -0.005);
    const wall = 0.0026;

    // Build continuous smooth Lathe profile along Y, then rotateX(+PI/2) so +Y becomes +Z (rear eyepiece) and -Y becomes -Z (front objective)!
    const half = len * 0.5;
    const outerPts = [
      new THREE.Vector2(rFront - wall, -half),
      new THREE.Vector2(rFront, -half),
      new THREE.Vector2(rFront, -half * 0.56),
      new THREE.Vector2(rTube, -half * 0.34),
      new THREE.Vector2(rTube, half * 0.42),
      new THREE.Vector2(rRear, half * 0.62),
      new THREE.Vector2(rRear, half),
      new THREE.Vector2(rRear - wall, half),
      new THREE.Vector2(rRear - wall, half * 0.62),
      new THREE.Vector2(rTube - wall, half * 0.42),
      new THREE.Vector2(rTube - wall, -half * 0.34),
      new THREE.Vector2(rFront - wall, -half * 0.56),
      new THREE.Vector2(rFront - wall, -half)
    ];
    const bodyGeo = new THREE.LatheGeometry(outerPts, 28);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMesh = new THREE.Mesh(bodyGeo, scopeOuterMat);
    bodyMesh.position.set(0, scopeY, zCenter);

    // Solid dark inner bore liner so interior never leaks sky/background light
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
    const magRing = new THREE.Mesh(new THREE.TorusGeometry(rRear * 0.96, 0.0018, 8, 24), accentMat);
    magRing.position.set(0, scopeY, zCenter + half * 0.68);

    // Subtle anti-reflective objective lens disc
    const lens = new THREE.Mesh(new THREE.CircleGeometry(rFront - wall - 0.0005, 24), glassMat);
    lens.position.set(0, scopeY, zCenter - half * 0.88);

    // Compact, concise, ultra-fine reticle centered cleanly inside the tube
    const retZ = zCenter - len * 0.08;
    const retR = (rTube - wall) * 0.90;
    const retGroup = new THREE.Group();
    retGroup.position.set(0, scopeY, retZ);

    if (isAcog) {
      // Concise TA-31 red chevron + subtle fine BDC vertical drop line
      const chevL = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.00045, 0.0004), illumMat);
      chevL.position.set(-0.0011, -0.0009, 0.0003);
      chevL.rotation.z = 0.72;
      const chevR = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.00045, 0.0004), illumMat);
      chevR.position.set(0.0011, -0.0009, 0.0003);
      chevR.rotation.z = -0.72;
      const bdcV = new THREE.Mesh(new THREE.BoxGeometry(0.00038, retR * 0.65, 0.0003), reticleMat);
      bdcV.position.set(0, -retR * 0.36, 0);
      retGroup.add(chevL, chevR, bdcV);
      [-0.0032, -0.0056, -0.0082].forEach((dy, idx) => {
        const w = 0.0028 - idx * 0.0005;
        const hash = new THREE.Mesh(new THREE.BoxGeometry(w, 0.00038, 0.0003), reticleMat);
        hash.position.set(0, dy, 0);
        retGroup.add(hash);
      });
      // Glowing fiber-optic light pipe on top of TA-31 prism
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.0020, 0.0020, 0.048, 12), illumMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(0, scopeY + rTube + 0.0038, zCenter - 0.018);
      group.add(pipe);
    } else if (isSniper) {
      // Concise ultra-fine mil-dot sniper crosshair (hairline 0.00038)
      const hLine = new THREE.Mesh(new THREE.BoxGeometry(retR * 1.92, 0.00038, 0.0003), reticleMat);
      const vLine = new THREE.Mesh(new THREE.BoxGeometry(0.00038, retR * 1.92, 0.0003), reticleMat);
      const centerDot = new THREE.Mesh(new THREE.CircleGeometry(0.00065, 10), illumMat);
      centerDot.position.z = 0.0004;
      retGroup.add(hLine, vLine, centerDot);
      [-0.0064, -0.0032, 0.0032, 0.0064].forEach((off) => {
        const tickV = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.00036, 0.0003), reticleMat);
        tickV.position.set(0, off, 0);
        const tickH = new THREE.Mesh(new THREE.BoxGeometry(0.00036, 0.0018, 0.0003), reticleMat);
        tickH.position.set(off, 0, 0);
        retGroup.add(tickV, tickH);
      });
    } else {
      // Concise LPVO 1-4x reticle: fine outer stadia + tiny illuminated ring & micro dot
      const stadiaGap = 0.0048;
      const stadiaLen = Math.max(0.002, retR - stadiaGap);
      const hL = new THREE.Mesh(new THREE.BoxGeometry(stadiaLen, 0.00042, 0.0003), reticleMat);
      hL.position.set(-(stadiaGap + stadiaLen * 0.5), 0, 0);
      const hR = new THREE.Mesh(new THREE.BoxGeometry(stadiaLen, 0.00042, 0.0003), reticleMat);
      hR.position.set(stadiaGap + stadiaLen * 0.5, 0, 0);
      const vB = new THREE.Mesh(new THREE.BoxGeometry(0.00042, stadiaLen, 0.0003), reticleMat);
      vB.position.set(0, -(stadiaGap + stadiaLen * 0.5), 0);
      const microRing = new THREE.Mesh(new THREE.RingGeometry(0.0034, 0.0040, 24), illumMat);
      microRing.position.z = 0.0003;
      const centerDot = new THREE.Mesh(new THREE.CircleGeometry(0.00065, 10), illumMat);
      centerDot.position.z = 0.0004;
      retGroup.add(hL, hR, vB, microRing, centerDot);
    }

    group.add(bodyMesh, boreMesh, railBase, ringF, ringR, stanF, stanR, elevTurret, windTurret, magRing, lens, retGroup);
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
      this._addScope(g, y, 'acog', recTopY);
      this.sightHeight = y;
    } else if (mods.optic === 'lpvo_4x' && weaponDef.slot !== 'secondary') {
      const y = isLongRifle ? 0.074 : 0.066;
      this._addScope(g, y, 'lpvo', recTopY);
      this.sightHeight = y;
    } else if (mods.optic === 'sniper_8x' && weaponDef.slot !== 'secondary') {
      const y = isLongRifle ? 0.078 : 0.070;
      this._addScope(g, y, 'sniper', recTopY);
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
      // Reposition & reshape operator's support hand to wrap around the vertical foregrip instead of the handguard!
      if (withHands && this.leftHand) {
        g.remove(this.leftHand);
        this.leftHand = this._createHand(false, 'foregrip');
        this.leftHand.position.set(0.0, -0.064, gripZ + 0.004);
        this.leftHandRestPos.copy(this.leftHand.position);
        this.leftHandRestRot.copy(this.leftHand.rotation);
        g.add(this.leftHand);
      }
    } else if (withHands && weaponDef.id === 'mp5k' && this.leftHand) {
      // MP5-K has an integrated vertical foregrip — wrap left hand cleanly around it!
      g.remove(this.leftHand);
      this.leftHand = this._createHand(false, 'foregrip');
      this.leftHand.position.set(0.0, -0.062, -0.146);
      this.leftHandRestPos.copy(this.leftHand.position);
      this.leftHandRestRot.copy(this.leftHand.rotation);
      g.add(this.leftHand);
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
    const palm = this._createHand(false, 'grip');
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
    if (this.ledgeHandsGroup || !this.scene) return;
    // Anchored in WORLD SPACE on the actual ledge lip so looking around only rotates the head!
    const root = new THREE.Group();

    const makeArm = (isRight) => {
      const side = isRight ? 1 : -1;
      const g = new THREE.Group();
      const hand = this._createHand(isRight, 'grip');
      hand.scale.setScalar(1.18);
      hand.position.set(0, 0.025, -0.04);
      hand.rotation.set(-0.22, side * -0.06, side * 0.04);
      g.add(hand);
      g.position.set(side * 0.24, 0, 0);

      // Reuse exact cylindrical tactical forearm from _createForearm(), aimed from shoulder -> wrist!
      const forearm = this._createForearm();
      forearm.scale.set(1.15, 1.15, 1.0);
      root.add(g, forearm);
      return { group: g, hand, forearm, side };
    };

    const leftArm = makeArm(false);
    const rightArm = makeArm(true);
    root.visible = false;
    this.scene.add(root);
    this.ledgeHandsGroup = root;
    this.ledgeHandsParts = { leftArm, rightArm };
  }

  _getWpnTex() {
    if (window._wpnTex) return window._wpnTex;
    const mk = (drawFn) => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d');
      drawFn(ctx, 128, 128);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      return tex;
    };
    const pxFill = (ctx, baseR, baseG, baseB, variance, streakH = false) => {
      ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 900; i++) {
        const x = (Math.random() * 64) | 0;
        const y = (Math.random() * 64) | 0;
        const d = ((Math.random() - 0.5) * variance) | 0;
        const r = Math.max(0, Math.min(255, baseR + d));
        const g = Math.max(0, Math.min(255, baseG + d));
        const b = Math.max(0, Math.min(255, baseB + d));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x * 2, y * 2, streakH ? (4 + ((Math.random() * 12) | 0)) : 2, 2);
      }
    };
    window._wpnTex = {
      parkerized: mk((ctx) => {
        pxFill(ctx, 48, 52, 57, 20, true);
        // Subtle rivet/panel edge highlight
        ctx.fillStyle = 'rgba(130, 145, 160, 0.14)';
        ctx.fillRect(0, 0, 128, 2);
        ctx.fillRect(0, 62, 128, 2);
      }),
      blued: mk((ctx) => {
        pxFill(ctx, 30, 36, 44, 16, true);
        ctx.fillStyle = 'rgba(85, 110, 145, 0.12)';
        for (let y = 8; y < 128; y += 24) ctx.fillRect(0, y, 128, 4);
      }),
      brushedSteel: mk((ctx) => {
        pxFill(ctx, 84, 90, 98, 24, true);
        ctx.fillStyle = 'rgba(200, 212, 224, 0.16)';
        for (let y = 4; y < 128; y += 16) ctx.fillRect(0, y, 128, 2);
      }),
      polymer: mk((ctx) => {
        pxFill(ctx, 25, 27, 31, 12, false);
        // Stippled PS2 tactical grip diamond grid
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        for (let y = 0; y < 128; y += 4) {
          for (let x = ((y % 8) === 0 ? 0 : 2); x < 128; x += 4) {
            ctx.fillRect(x, y, 2, 2);
          }
        }
      }),
      bakelite: mk((ctx) => {
        pxFill(ctx, 122, 58, 36, 18, false);
        // Swirled resin phenolic fibers
        for (let i = 0; i < 42; i++) {
          ctx.fillStyle = (i % 2 === 0) ? 'rgba(88, 36, 20, 0.35)' : 'rgba(156, 78, 46, 0.28)';
          const y0 = (Math.random() * 128) | 0;
          for (let x = 0; x < 128; x += 4) {
            const dy = Math.round(Math.sin(x * 0.08 + i) * 5);
            ctx.fillRect(x, (y0 + dy + 128) & 127, 4, 2);
          }
        }
      }),
      wood: mk((ctx) => {
        pxFill(ctx, 110, 68, 36, 16, true);
        for (let y = 0; y < 128; y += 6) {
          ctx.fillStyle = (y % 12 === 0) ? 'rgba(72, 40, 18, 0.38)' : 'rgba(138, 86, 46, 0.24)';
          for (let x = 0; x < 128; x += 4) {
            const oy = Math.round(Math.sin(x * 0.06 + y * 0.15) * 3);
            ctx.fillRect(x, (y + oy + 128) & 127, 4, 2);
          }
        }
      }),
      composite: mk((ctx) => {
        pxFill(ctx, 62, 74, 54, 18, false);
        ctx.fillStyle = 'rgba(30, 36, 26, 0.25)';
        for (let i = 0; i < 240; i++) {
          ctx.fillRect(((Math.random() * 64) | 0) * 2, ((Math.random() * 64) | 0) * 2, 2, 2);
        }
      }),
      brass: mk((ctx) => {
        pxFill(ctx, 212, 168, 68, 18, false);
        ctx.fillStyle = 'rgba(255, 240, 175, 0.22)';
        ctx.fillRect(24, 0, 12, 128);
      }),
      shellRed: mk((ctx) => {
        pxFill(ctx, 172, 42, 42, 14, false);
        ctx.fillStyle = 'rgba(95, 16, 16, 0.35)';
        for (let x = 0; x < 128; x += 8) ctx.fillRect(x, 0, 2, 128);
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

    const g = new THREE.Group();
    const hasCamo = mods.camo && mods.camo !== 'none';
    const gunMat = this._getCamoMaterial(weaponDef, mods.camo);
    const tex = this._getWpnTex();
    // Crunchy PS2-era MeshLambertMaterials mapped with 128px NearestFilter canvas textures
    const steelMat = hasCamo ? gunMat : new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex.parkerized });
    const bluedMat = hasCamo ? gunMat : new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex.blued });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex.polymer });
    const magMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex.brushedSteel });
    const bakeliteMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex.bakelite });
    const brassMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex.brass });
    const woodMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex.wood });
    const chassisMat = hasCamo ? gunMat : new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex.composite });
    const shellRedMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex.shellRed });

    // Helper: extrude a 2D side silhouette (x: +fwd/-rear, y: up/down) centered along weapon X width
    const extrudeSide = (pts, width, holes = null, bevel = false) => {
      const sh = new THREE.Shape();
      sh.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
      sh.closePath();
      if (holes) {
        for (const hPts of holes) {
          const hp = new THREE.Path();
          hp.moveTo(hPts[0][0], hPts[0][1]);
          for (let i = 1; i < hPts.length; i++) hp.lineTo(hPts[i][0], hPts[i][1]);
          hp.closePath();
          sh.holes.push(hp);
        }
      }
      const geo = new THREE.ExtrudeGeometry(sh, {
        depth: width,
        bevelEnabled: bevel,
        bevelThickness: bevel ? 0.002 : 0,
        bevelSize: bevel ? 0.0018 : 0,
        bevelSegments: 1,
        curveSegments: 6
      });
      geo.translate(0, 0, -width * 0.5);
      geo.rotateY(Math.PI / 2); // +px -> -Z (forward), -px -> +Z (rear)
      return geo;
    };

    const addTriggerGuard = (zPos, yPos) => {
      const bot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.005, 0.045), darkMat);
      bot.position.set(0, yPos - 0.022, zPos);
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.024, 0.006), darkMat);
      front.position.set(0, yPos - 0.010, zPos - 0.020);
      const trig = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.016, 0.006), magMat);
      trig.position.set(0, yPos - 0.008, zPos + 0.004);
      trig.rotation.x = 0.3;
      g.add(bot, front, trig);
    };

    if (weaponDef.slot === 'secondary') {
      const isG17 = weaponDef.id === 'g17';
      const slideLen = isG17 ? 0.24 : 0.21;
      let slideGroup;

      if (isG17) {
        // Authentic Glock 17 Gen4: Polymer dustcover frame with Picatinny slot + beavertail + contoured grip
        const frameGeo = extrudeSide([
          [0.095, -0.008], [0.095, -0.024], [0.045, -0.024], [0.030, -0.020],
          [-0.038, -0.020], [-0.042, -0.036], [-0.056, -0.116], [-0.100, -0.112],
          [-0.082, -0.024], [-0.102, -0.010], [-0.075, -0.008]
        ], 0.031);
        const frame = new THREE.Mesh(frameGeo, darkMat);

        // Squared Glock slide with chamfered upper bevels, ejection port recess & rear serrations
        slideGroup = new THREE.Group();
        const slideMain = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.024, slideLen), steelMat);
        const slideTop = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.007, slideLen - 0.006), steelMat);
        slideTop.position.set(0, 0.015, 0);
        const ejPort = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.044), bluedMat);
        ejPort.position.set(0.016, 0.005, -0.012);
        const hood = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.008, 0.036), magMat);
        hood.position.set(0, 0.014, -0.015);
        slideGroup.add(slideMain, slideTop, ejPort, hood);
        for (let s = 0; s < 5; s++) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.018, 0.0025), darkMat);
          rib.position.set(0, 0.0, 0.072 + s * 0.008);
          slideGroup.add(rib);
        }
        slideGroup.position.set(0, 0.006, 0);
        this.boltMesh = slideGroup;
        this.boltRestPos.copy(slideGroup.position);

        const barrelCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.0078, 0.0078, 0.024, 8), magMat);
        barrelCrown.rotation.x = Math.PI / 2;
        barrelCrown.position.set(0, 0.008, -slideLen / 2 - 0.002);
        const railSlot = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.004, 0.032), bluedMat);
        railSlot.position.set(0, -0.024, -0.075);

        addTriggerGuard(0.018, -0.024);

        const pistolMag = new THREE.Group();
        const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.023, 0.105, 0.033), darkMat);
        const magPlate = new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.013, 0.045), steelMat);
        magPlate.position.set(0, -0.056, 0);
        const magTip = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.012, 0.028), brassMat);
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

        g.add(frame, railSlot, barrelCrown, slideGroup, pistolMag, this.rightHand, this.leftHand);
      } else {
        // Authentic Makarov PM (9x18mm): Rounded blued slide, thumb safety, exposed hammer & checkered bakelite grip
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.018, 0.175), bluedMat);
        frame.position.set(0, -0.015, 0.008);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.108, 0.044), bakeliteMat);
        grip.position.set(0, -0.066, 0.072);
        grip.rotation.x = 0.24;
        const backstrap = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.100, 0.012), bluedMat);
        backstrap.position.set(0, -0.062, 0.092);
        backstrap.rotation.x = 0.24;

        slideGroup = new THREE.Group();
        const slideLower = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.020, slideLen), bluedMat);
        const slideCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, slideLen - 0.004, 8), bluedMat);
        slideCrown.rotation.x = Math.PI / 2;
        slideCrown.position.set(0, 0.008, 0);
        const ejPort = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.011, 0.038), steelMat);
        ejPort.position.set(0.014, 0.005, -0.008);
        const safetyLever = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.010, 0.024), steelMat);
        safetyLever.position.set(-0.017, 0.004, 0.075);
        const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.014, 0.016), magMat);
        hammer.position.set(0, 0.002, slideLen / 2 + 0.004);
        hammer.rotation.x = 0.35;
        slideGroup.add(slideLower, slideCrown, ejPort, safetyLever, hammer);
        slideGroup.position.set(0, 0.006, 0);
        this.boltMesh = slideGroup;
        this.boltRestPos.copy(slideGroup.position);

        const barrelCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 0.022, 8), magMat);
        barrelCrown.rotation.x = Math.PI / 2;
        barrelCrown.position.set(0, 0.008, -slideLen / 2 - 0.002);

        addTriggerGuard(0.016, -0.022);

        const pistolMag = new THREE.Group();
        const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.102, 0.030), magMat);
        const magPlate = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.010, 0.040), bluedMat);
        magPlate.position.set(0, -0.054, 0);
        const magTip = new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.011, 0.026), brassMat);
        magTip.position.set(0, 0.055, 0);
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

        g.add(frame, grip, backstrap, barrelCrown, slideGroup, pistolMag, this.rightHand, this.leftHand);
      }

      this.sightHeight = 0.030;
      this.adsZ = -0.32;
      const hasOptic = !!(mods.optic && mods.optic !== 'none');
      this._addWeaponIronSights(slideGroup, weaponDef.id, this.sightHeight - slideGroup.position.y, hasOptic, {
        rearZ: slideLen / 2 - 0.016,
        frontZ: -slideLen / 2 + 0.014,
        baseY: 0.019
      });

      this.muzzleMesh.position.set(0, 0.01, -slideLen / 2 - 0.03);
      this.muzzleFlash.position.set(0, 0.02, -slideLen / 2 - 0.06);
    } else if (weaponDef.id === 'mp5k') {
      // H&K MP5 (Stamped upper receiver + tubular cocking tube + Tropical sloped handguard + Navy lower + curved steel banana mag)
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.034, 0.31), steelMat);
      upper.position.set(0, 0.007, 0.025);
      const upperTop = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0165, 0.31, 8), steelMat);
      upperTop.rotation.x = Math.PI / 2;
      upperTop.position.set(0, 0.020, 0.025);
      const fluteL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.008, 0.29), bluedMat);
      fluteL.position.set(-0.020, 0.002, 0.03);
      const fluteR = fluteL.clone();
      fluteR.position.x = 0.020;
      const ejPort = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.015, 0.056), bluedMat);
      ejPort.position.set(0.019, 0.010, -0.01);

      const cockingTube = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.25, 8), steelMat);
      cockingTube.rotation.x = Math.PI / 2;
      cockingTube.position.set(0, 0.022, -0.175);
      const tripleFrame = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.044, 0.020), bluedMat);
      tripleFrame.position.set(0, 0.012, -0.295);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.010, 0.28, 8), bluedMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.001, -0.21);
      const triLug = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.022, 6), magMat);
      triLug.rotation.x = Math.PI / 2;
      triLug.position.set(0, 0.001, -0.345);

      // Sloped wide triangular Tropical handguard (ExtrudeGeometry silhouette)
      const hgGeo = extrudeSide([
        [0.09, -0.002], [0.275, -0.002], [0.265, -0.024], [0.165, -0.040], [0.09, -0.036]
      ], 0.044, null, true);
      const handguard = new THREE.Mesh(hgGeo, darkMat);
      const hgPin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.048, 6), magMat);
      hgPin.rotation.z = Math.PI / 2;
      hgPin.position.set(0, 0.004, -0.255);

      // Contoured Navy trigger housing + steel magwell + paddle release + selector
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.026, 0.175), darkMat);
      lower.position.set(0, -0.019, 0.085);
      const magWell = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.044, 0.056), steelMat);
      magWell.position.set(0, -0.026, -0.045);
      const paddleRel = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.022, 0.010), bluedMat);
      paddleRel.position.set(0, -0.048, -0.012);
      const selector = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.026), magMat);
      selector.position.set(-0.020, -0.020, 0.115);
      selector.rotation.x = 0.25;

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.098, 0.042), darkMat);
      grip.position.set(0, -0.072, 0.132);
      grip.rotation.x = 0.28;
      const endCap = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.050, 0.028), darkMat);
      endCap.position.set(0, 0.002, 0.182);

      if (!mods.stock || mods.stock === 'none') {
        const stRailL = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.009, 0.22), magMat);
        stRailL.position.set(-0.019, 0.002, 0.285);
        const stRailR = stRailL.clone();
        stRailR.position.x = 0.019;
        const stPad = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.105, 0.026), darkMat);
        stPad.position.set(0, -0.022, 0.395);
        g.add(stRailL, stRailR, stPad);
      }
      addTriggerGuard(0.072, -0.038);

      // Single-piece curved 30-round steel MP5 banana magazine (low-poly ExtrudeGeometry)
      const mag = new THREE.Group();
      const magShape = new THREE.Shape();
      magShape.moveTo(-0.018, 0.062);
      magShape.lineTo(0.018, 0.062);
      magShape.bezierCurveTo(0.024, 0.00, 0.040, -0.062, 0.058, -0.125);
      magShape.lineTo(0.022, -0.134);
      magShape.bezierCurveTo(0.004, -0.070, -0.012, -0.008, -0.018, 0.062);
      const mp5MagGeo = new THREE.ExtrudeGeometry(magShape, { depth: 0.024, bevelEnabled: false, curveSegments: 8 });
      mp5MagGeo.translate(0, 0, -0.012);
      mp5MagGeo.rotateY(Math.PI / 2);
      const mp5MagBody = new THREE.Mesh(mp5MagGeo, magMat);
      const magFloor = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.009, 0.042), bluedMat);
      magFloor.position.set(0, -0.130, -0.040);
      magFloor.rotation.x = -0.26;
      const magTip = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.011, 0.030), brassMat);
      magTip.position.set(0, 0.066, 0);
      mag.add(mp5MagBody, magFloor, magTip);
      mag.position.set(0, -0.096, -0.045);
      mag.rotation.x = -0.06;
      this.magMesh = mag;
      this.magRestPos.copy(mag.position);
      this.spareMagMesh = mag.clone();
      this.spareMagMesh.visible = false;

      const boltHandle = new THREE.Group();
      const chStem = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.010, 0.012), magMat);
      const chKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.026, 8), darkMat);
      chKnob.rotation.z = Math.PI / 2;
      chKnob.position.set(-0.016, 0.006, 0);
      boltHandle.add(chStem, chKnob);
      boltHandle.position.set(-0.022, 0.024, -0.21);
      this.boltMesh = boltHandle;
      this.boltRestPos.copy(boltHandle.position);

      this.rightHand = this._createHand(true, 'grip');
      this.rightHand.position.set(0.0, -0.064, 0.132);
      this.leftHand = this._createHand(false, 'supportRifle');
      this.leftHand.position.set(0.0, -0.026, -0.185);
      this.leftHandRestPos.copy(this.leftHand.position);
      this.leftHandRestRot.copy(this.leftHand.rotation);

      g.add(
        upper, upperTop, fluteL, fluteR, ejPort,
        cockingTube, tripleFrame, barrel, triLug,
        handguard, hgPin,
        lower, magWell, paddleRel, selector, grip, endCap,
        mag, this.spareMagMesh, boltHandle, this.rightHand, this.leftHand
      );

      this.sightHeight = 0.044;
      this.adsZ = -0.25;
      const hasOptic = !!(mods.optic && mods.optic !== 'none');
      this._addWeaponIronSights(g, 'mp5k', this.sightHeight, hasOptic);
      this.muzzleMesh.position.set(0, 0.001, -0.365);
      this.muzzleFlash.position.set(0, 0.01, -0.40);
    } else if (weaponDef.id === 'ak74m') {
      // AK-74M: Stamped dimpled receiver + ribbed dust cover + 45deg gas block + cleaning rod + twin-chamber muzzle brake + laminated wood/bakelite
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.050, 0.35), steelMat);
      receiver.position.set(0, -0.003, 0.04);
      const dimpleR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.016, 0.036), bluedMat);
      dimpleR.position.set(0.022, -0.012, -0.042);
      const dimpleL = dimpleR.clone();
      dimpleL.position.x = -0.022;
      const safety = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.016, 0.145), bluedMat);
      safety.position.set(0.023, -0.003, 0.065);
      safety.rotation.x = 0.06;

      // Stamped AK ribbed dust cover + rear sight leaf trunnion block
      const dustCover = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.017, 0.29), bluedMat);
      dustCover.position.set(0, 0.027, 0.075);
      const rsBlock = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.024, 0.055), steelMat);
      rsBlock.position.set(0, 0.024, -0.085);
      for (let r = 0; r < 3; r++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.004, 0.014), steelMat);
        rib.position.set(0, 0.036, 0.015 + r * 0.065);
        g.add(rib);
      }

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.0105, 0.44, 8), bluedMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.002, -0.34);
      const cleaningRod = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.36, 6), magMat);
      cleaningRod.rotation.x = Math.PI / 2;
      cleaningRod.position.set(0, -0.011, -0.37);

      // 45-degree gas block + hooded front sight block
      const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.22, 8), steelMat);
      gasTube.rotation.x = Math.PI / 2;
      gasTube.position.set(0, 0.023, -0.22);
      const gasBlock = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.036, 0.036), bluedMat);
      gasBlock.position.set(0, 0.014, -0.315);
      gasBlock.rotation.x = -0.35;
      const fsbBase = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.040, 0.032), bluedMat);
      fsbBase.position.set(0, 0.018, -0.49);

      // Two-chamber AK-74M compensator brake (collar + expansion drum)
      const brakeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0125, 0.036, 8), steelMat);
      brakeBase.rotation.x = Math.PI / 2;
      brakeBase.position.set(0, 0.002, -0.556);
      const brakeFront = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.032, 8), bluedMat);
      brakeFront.rotation.x = Math.PI / 2;
      brakeFront.position.set(0, 0.002, -0.586);

      // Ventilated upper & lower laminated wood AK handguards with steel retainer ferrule
      const hgLower = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.034, 0.195), woodMat);
      hgLower.position.set(0, -0.009, -0.215);
      const hgUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.185, 8), woodMat);
      hgUpper.rotation.x = Math.PI / 2;
      hgUpper.position.set(0, 0.023, -0.215);
      const hgFerrule = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.044, 0.014), bluedMat);
      hgFerrule.position.set(0, 0.004, -0.310);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.10, 0.043), bakeliteMat);
      grip.position.set(0, -0.075, 0.14);
      grip.rotation.x = 0.26;
      const magPaddle = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.020, 0.012), bluedMat);
      magPaddle.position.set(0, -0.034, 0.008);
      addTriggerGuard(0.08, -0.032);

      const hasStockMod = !!(mods.stock && mods.stock !== 'none');
      if (!hasStockMod) {
        const sShape = new THREE.Shape();
        sShape.moveTo(0.0, 0.022);
        sShape.lineTo(0.245, -0.012);
        sShape.lineTo(0.245, -0.108);
        sShape.lineTo(0.055, -0.052);
        sShape.lineTo(0.0, -0.024);
        sShape.closePath();
        const sGeo = new THREE.ExtrudeGeometry(sShape, { depth: 0.034, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
        sGeo.translate(0, 0, -0.017);
        sGeo.rotateY(-Math.PI / 2);
        const woodButt = new THREE.Mesh(sGeo, woodMat);
        woodButt.position.set(0, -0.002, 0.215);
        const buttPlate = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.100, 0.012), bluedMat);
        buttPlate.position.set(0, -0.062, 0.465);
        const tang = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.010, 0.044), steelMat);
        tang.position.set(0, 0.020, 0.233);
        g.add(woodButt, buttPlate, tang);
      }

      const buildCurvedAkMag = (isExtended = false) => {
        const magGrp = new THREE.Group();
        const magDepth = 0.027;
        const magH = isExtended ? 0.245 : 0.182;
        const curveFwd = isExtended ? 0.122 : 0.078;
        const magThick = 0.052;
        const shape = new THREE.Shape();
        shape.moveTo(-magThick * 0.5, 0.048);
        shape.lineTo(magThick * 0.5, 0.048);
        shape.bezierCurveTo(
          magThick * 0.5 + curveFwd * 0.14, 0.048 - magH * 0.34,
          magThick * 0.5 + curveFwd * 0.56, 0.048 - magH * 0.72,
          magThick * 0.42 + curveFwd, 0.048 - magH
        );
        const tipAngle = isExtended ? 0.46 : 0.36;
        const rearEndX = magThick * 0.42 + curveFwd - Math.cos(tipAngle) * magThick;
        const rearEndY = 0.048 - magH - Math.sin(tipAngle) * magThick;
        shape.lineTo(rearEndX, rearEndY);
        shape.bezierCurveTo(
          -magThick * 0.5 + curveFwd * 0.44, 0.048 - magH * 0.68,
          -magThick * 0.5 + curveFwd * 0.08, 0.048 - magH * 0.32,
          -magThick * 0.5, 0.048
        );
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: magDepth,
          bevelEnabled: true,
          bevelThickness: 0.002,
          bevelSize: 0.0018,
          bevelSegments: 1,
          curveSegments: 10
        });
        geo.translate(0, 0, -magDepth * 0.5);
        geo.rotateY(Math.PI / 2);
        const body = new THREE.Mesh(geo, bakeliteMat);
        const basePlate = new THREE.Mesh(new THREE.BoxGeometry(magDepth + 0.006, 0.009, magThick + 0.006), bluedMat);
        basePlate.position.set(0, (0.048 - magH + rearEndY) * 0.5 - 0.003, -((magThick * 0.42 + curveFwd + rearEndX) * 0.5));
        basePlate.rotation.x = -tipAngle;
        const magTip = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.010, 0.042), brassMat);
        magTip.position.set(0, 0.052, 0);
        magGrp.add(body, basePlate, magTip);
        return magGrp;
      };

      const mag = buildCurvedAkMag(mods.magazine === 'ext_mag');
      mag.position.set(0, -0.048, -0.042);
      this.magMesh = mag;
      this.magRestPos.copy(mag.position);

      const boltHandle = new THREE.Group();
      const carrier = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.014, 0.048), magMat);
      const hookKnob = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.010, 0.012), magMat);
      hookKnob.position.set(0.012, 0.0, 0.010);
      boltHandle.add(carrier, hookKnob);
      boltHandle.position.set(0.022, 0.014, -0.02);
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

      g.add(
        receiver, dimpleR, dimpleL, safety, dustCover, rsBlock,
        barrel, cleaningRod, gasTube, gasBlock, fsbBase, brakeBase, brakeFront,
        hgLower, hgUpper, hgFerrule, grip, magPaddle,
        mag, this.spareMagMesh, boltHandle, this.rightHand, this.leftHand
      );

      this.sightHeight = 0.044;
      this.adsZ = -0.26;
      const hasOptic = !!(mods.optic && mods.optic !== 'none');
      this._addWeaponIronSights(g, 'ak74m', this.sightHeight, hasOptic);
      this.muzzleMesh.position.set(0, 0.004, -0.60);
      this.muzzleFlash.position.set(0, 0.01, -0.64);
    } else if (weaponDef.id === 'm870') {
      // Remington 870 Trench Shotgun (Round billet steel receiver + heatshield/clamp + ribbed walnut pump + contoured buttstock)
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.056, 0.28), steelMat);
      receiver.position.set(0, 0.0, 0.04);
      const ejectionPort = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.020, 0.072), magMat);
      ejectionPort.position.set(0.023, 0.009, -0.01);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0138, 0.0145, 0.52, 8), bluedMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.014, -0.34);

      const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.0128, 0.0128, 0.46, 8), steelMat);
      magTube.rotation.x = Math.PI / 2;
      magTube.position.set(0, -0.016, -0.31);
      const bblClamp = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.048, 0.022), bluedMat);
      bblClamp.position.set(0, -0.001, -0.49);

      // Ribbed corn-cob Remington 870 walnut sliding pump + dual action bars
      const pump = new THREE.Group();
      const pumpCore = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.023, 0.18, 8), woodMat);
      pumpCore.rotation.x = Math.PI / 2;
      pump.add(pumpCore);
      for (let r = -2; r <= 2; r++) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0245, 0.0245, 0.012, 8), bluedMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 0, r * 0.032);
        pump.add(ring);
      }
      const actionBarL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.007, 0.16), magMat);
      actionBarL.position.set(-0.021, 0.002, 0.14);
      const actionBarR = actionBarL.clone();
      actionBarR.position.x = 0.021;
      pump.add(actionBarL, actionBarR);
      pump.position.set(0, -0.016, -0.24);
      this.boltMesh = pump;
      this.boltRestPos.copy(pump.position);

      // One-piece sculpted walnut buttstock + rubber recoil pad
      const stockGeo = extrudeSide([
        [-0.14, -0.002], [-0.14, -0.036], [-0.21, -0.056], [-0.465, -0.098],
        [-0.465, 0.004], [-0.24, -0.006]
      ], 0.038, null, true);
      const stockBody = new THREE.Mesh(stockGeo, woodMat);
      const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.104, 0.020), darkMat);
      stockPad.position.set(0, -0.047, 0.475);
      addTriggerGuard(0.08, -0.028);

      // 12ga red ribbed shell for loading port animation
      const shell = new THREE.Group();
      const shellHull = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.058, 8), shellRedMat);
      const shellBrass = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.016, 8), brassMat);
      shellBrass.position.set(0, -0.028, 0);
      shell.add(shellHull, shellBrass);
      shell.rotation.x = Math.PI / 2;
      shell.position.set(0, -0.020, -0.02);
      this.magMesh = shell;
      this.magRestPos.copy(shell.position);

      this.rightHand = this._createHand(true, 'grip');
      this.rightHand.position.set(0.0, -0.044, 0.145);
      this.leftHand = this._createHand(false, 'supportRifle');
      this.leftHand.position.set(0.0, -0.036, -0.24);
      this.leftHandRestPos.copy(this.leftHand.position);
      this.leftHandRestRot.copy(this.leftHand.rotation);

      g.add(receiver, ejectionPort, barrel, magTube, bblClamp, pump, stockBody, stockPad, shell, this.rightHand, this.leftHand);

      this.sightHeight = 0.042;
      this.adsZ = -0.26;
      const hasOptic = !!(mods.optic && mods.optic !== 'none');
      this._addWeaponIronSights(g, 'm870', this.sightHeight, hasOptic);
      this.muzzleMesh.position.set(0, 0.014, -0.61);
      this.muzzleFlash.position.set(0, 0.02, -0.65);
    } else if (weaponDef.id === 'mosin9130') {
      // Mosin-Nagant M91/30 (Full sculpted birch stock + octagonal receiver + dual barrel bands + cleaning rod + exposed internal mag)
      const stockGeo = extrudeSide([
        [0.42, -0.002], [0.42, -0.024], [0.08, -0.034], [-0.08, -0.034],
        [-0.18, -0.056], [-0.415, -0.092], [-0.415, -0.002], [-0.21, -0.010],
        [-0.08, 0.004], [0.06, 0.006]
      ], 0.039, null, true);
      const stockBody = new THREE.Mesh(stockGeo, woodMat);
      const upperHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.018, 0.36), woodMat);
      upperHandguard.position.set(0, 0.016, -0.22);
      const buttPlate = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.092, 0.010), bluedMat);
      buttPlate.position.set(0, -0.047, 0.420);

      const bandRear = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.046, 0.016), bluedMat);
      bandRear.position.set(0, 0.002, -0.18);
      const bandFront = new THREE.Mesh(new THREE.BoxGeometry(0.043, 0.044, 0.016), bluedMat);
      bandFront.position.set(0, 0.002, -0.37);
      const cleaningRod = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.44, 6), magMat);
      cleaningRod.rotation.x = Math.PI / 2;
      cleaningRod.position.set(0, -0.002, -0.44);

      // Classic Soviet hexagonal high-wall receiver + tapered barrel + internal magazine belly
      const receiver = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.22, 6), bluedMat);
      receiver.rotation.x = Math.PI / 2;
      receiver.position.set(0, 0.016, 0.02);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0125, 0.60, 8), bluedMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.016, -0.36);
      const internalMag = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.034, 0.095), bluedMat);
      internalMag.position.set(0, -0.044, -0.01);
      addTriggerGuard(0.08, -0.034);

      const boltGroup = new THREE.Group();
      const boltBody = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.10, 8), magMat);
      boltBody.rotation.x = Math.PI / 2;
      boltBody.position.set(-0.022, 0.0, 0.0);
      const boltStem = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.008, 0.009), magMat);
      const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), magMat);
      boltKnob.position.set(0.022, 0.0, 0);
      boltGroup.add(boltBody, boltStem, boltKnob);
      boltGroup.position.set(0.022, 0.018, 0.03);
      this.boltMesh = boltGroup;
      this.boltRestPos.copy(boltGroup.position);

      const clipGroup = new THREE.Group();
      const clipRail = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.010, 0.068), steelMat);
      clipRail.position.set(0, 0.028, 0);
      clipGroup.add(clipRail);
      for (let c = 0; c < 5; c++) {
        const round = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0048, 0.056, 6), brassMat);
        round.rotation.x = Math.PI / 2;
        round.position.set(0, 0.020 - c * 0.009, 0);
        clipGroup.add(round);
      }
      clipGroup.position.set(0, 0.032, 0.0);
      clipGroup.visible = false;
      clipGroup.userData.isStripperClip = true;
      this.magMesh = clipGroup;
      this.magRestPos.copy(clipGroup.position);

      this.rightHand = this._createHand(true, 'grip');
      this.rightHand.position.set(0.0, -0.048, 0.148);
      this.leftHand = this._createHand(false, 'supportRifle');
      this.leftHand.position.set(0.0, -0.026, -0.22);
      this.leftHandRestPos.copy(this.leftHand.position);
      this.leftHandRestRot.copy(this.leftHand.rotation);

      g.add(
        stockBody, upperHandguard, buttPlate,
        bandRear, bandFront, cleaningRod, receiver, barrel, internalMag,
        boltGroup, clipGroup, this.rightHand, this.leftHand
      );

      this.sightHeight = 0.040;
      this.adsZ = -0.24;
      const hasOptic = !!(mods.optic && mods.optic !== 'none');
      this._addWeaponIronSights(g, 'mosin9130', this.sightHeight, hasOptic);
      this.muzzleMesh.position.set(0, 0.016, -0.66);
      this.muzzleFlash.position.set(0, 0.02, -0.70);
    } else if (weaponDef.id === 'awm338') {
      // AWM .338 (Accuracy International L96A1 Thumbhole Chassis via Shape+holes ExtrudeGeometry)
      const hasStockMod = !!(mods.stock && mods.stock !== 'none');
      const chassisPts = hasStockMod
        ? [[0.30, 0.016], [0.30, -0.038], [-0.14, -0.038], [-0.15, -0.105], [-0.19, -0.102], [-0.18, 0.008]]
        : [
            [0.30, 0.016], [0.30, -0.036], [-0.12, -0.036], [-0.14, -0.106],
            [-0.185, -0.104], [-0.365, -0.102], [-0.365, 0.012], [-0.18, 0.010]
          ];
      const thumbHole = hasStockMod ? null : [
        [[-0.20, -0.018], [-0.29, -0.018], [-0.29, -0.072], [-0.20, -0.072]]
      ];
      const chassis = new THREE.Mesh(extrudeSide(chassisPts, 0.044, thumbHole, true), chassisMat);

      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.042, 0.26), bluedMat);
      receiver.position.set(0, 0.018, 0.04);
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.008, 0.24), steelMat);
      topRail.position.set(0, 0.041, 0.02);

      if (!hasStockMod) {
        const cheekRest = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.024, 0.12), darkMat);
        cheekRest.position.set(0, 0.022, 0.27);
        const buttPad = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.114, 0.022), darkMat);
        buttPad.position.set(0, -0.044, 0.372);
        g.add(cheekRest, buttPad);
      }

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.58, 8), bluedMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.018, -0.40);
      // Iconic AI multi-port 3-chamber rectangular muzzle brake
      const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.026, 0.068), steelMat);
      muzzleBrake.position.set(0, 0.018, -0.71);
      for (let b = -1; b <= 1; b++) {
        const port = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.014, 0.010), darkMat);
        port.position.set(0, 0.018, -0.71 + b * 0.019);
        g.add(port);
      }

      const bipodMount = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.022, 0.036), darkMat);
      bipodMount.position.set(0, -0.046, -0.26);
      const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.20, 6), bluedMat);
      bipodL.rotation.x = Math.PI / 2;
      bipodL.position.set(-0.026, -0.046, -0.36);
      const bipodR = bipodL.clone();
      bipodR.position.x = 0.026;

      const mag = new THREE.Group();
      const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.098, 0.084), magMat);
      const magFloor = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.010, 0.088), darkMat);
      magFloor.position.set(0, -0.050, 0);
      const magTip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.014, 0.072), brassMat);
      magTip.position.set(0, 0.052, 0);
      mag.add(magBody, magFloor, magTip);
      mag.position.set(0, -0.074, -0.02);
      this.magMesh = mag;
      this.magRestPos.copy(mag.position);
      this.spareMagMesh = mag.clone();
      this.spareMagMesh.visible = false;
      addTriggerGuard(0.095, -0.038);

      const boltGroup = new THREE.Group();
      const boltStem = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.010, 0.011), magMat);
      const boltKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.024, 8), darkMat);
      boltKnob.rotation.z = Math.PI / 2;
      boltKnob.position.set(0.024, -0.004, 0);
      boltGroup.add(boltStem, boltKnob);
      boltGroup.position.set(0.024, 0.020, 0.045);
      this.boltMesh = boltGroup;
      this.boltRestPos.copy(boltGroup.position);

      this.rightHand = this._createHand(true, 'grip');
      this.rightHand.position.set(0.0, -0.058, 0.156);
      this.leftHand = this._createHand(false, 'supportRifle');
      this.leftHand.position.set(0.0, -0.032, -0.18);
      this.leftHandRestPos.copy(this.leftHand.position);
      this.leftHandRestRot.copy(this.leftHand.rotation);

      g.add(
        chassis, receiver, topRail, barrel, muzzleBrake, bipodMount, bipodL, bipodR,
        mag, this.spareMagMesh, boltGroup, this.rightHand, this.leftHand
      );

      this.sightHeight = 0.078;
      this.adsZ = -0.20;
      this._addWeaponIronSights(g, 'awm338', this.sightHeight, true);
      if (!mods.optic || mods.optic === 'none') {
        this._addScope(g, this.sightHeight, 'lpvo', 0.042);
      }
      this.muzzleMesh.position.set(0, 0.018, -0.75);
      this.muzzleFlash.position.set(0, 0.02, -0.79);
    } else {
      // M24 SWS Bolt-Action Rifle (Contoured HS-Precision Kevlar composite stock + cylindrical R700 receiver + Picatinny scope base + tapered free-float barrel)
      const hasStockMod = !!(mods.stock && mods.stock !== 'none');
      const m24Pts = hasStockMod
        ? [[0.24, 0.012], [0.24, -0.028], [-0.14, -0.038], [-0.15, -0.106], [-0.19, -0.102], [-0.18, 0.002]]
        : [
            [0.24, 0.012], [0.24, -0.028], [-0.12, -0.038], [-0.14, -0.106],
            [-0.185, -0.102], [-0.21, -0.052], [-0.465, -0.092], [-0.465, 0.010],
            [-0.22, 0.002]
          ];
      const chassis = new THREE.Mesh(extrudeSide(m24Pts, 0.044, null, true), chassisMat);

      const receiver = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.24, 8), bluedMat);
      receiver.rotation.x = Math.PI / 2;
      receiver.position.set(0, 0.016, 0.04);
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.007, 0.20), steelMat);
      topRail.position.set(0, 0.038, 0.03);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.0135, 0.50, 8), bluedMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.016, -0.36);

      if (!hasStockMod) {
        const m24Cheek = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.020, 0.13), darkMat);
        m24Cheek.position.set(0, 0.016, 0.34);
        const m24Pad = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.106, 0.020), darkMat);
        m24Pad.position.set(0, -0.041, 0.475);
        g.add(m24Cheek, m24Pad);
      }

      const mag = new THREE.Group();
      const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.085, 0.072), magMat);
      const magTip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, 0.062), brassMat);
      magTip.position.set(0, 0.046, 0);
      mag.add(magBody, magTip);
      mag.position.set(0, -0.068, -0.02);
      this.magMesh = mag;
      this.magRestPos.copy(mag.position);
      this.spareMagMesh = mag.clone();
      this.spareMagMesh.visible = false;

      addTriggerGuard(0.09, -0.034);

      const boltGroup = new THREE.Group();
      const boltStem = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.009, 0.010), magMat);
      const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), darkMat);
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

      g.add(chassis, receiver, topRail, barrel, mag, this.spareMagMesh, boltGroup, this.rightHand, this.leftHand);

      this.sightHeight = 0.074;
      this.adsZ = -0.22;
      this._addWeaponIronSights(g, 'm24', this.sightHeight, true);
      if (!mods.optic || mods.optic === 'none') {
        this._addScope(g, this.sightHeight, 'lpvo', 0.036);
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
      // Camera-space Warzone/DMZ Plating Rig: ceramic plate is parented directly to the gloved hand (no fingers visible behind plate!)
      const rig = new THREE.Group();
      rig.visible = false;

      const plateHand = new THREE.Group();
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
      plateHand.scale.setScalar(1.22);

      // Ceramic armor plate parented directly to plateHand so it moves 100% locked to the hand!
      const plateGroup = new THREE.Group();
      const plateBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.138, 0.168, 0.022),
        new THREE.MeshLambertMaterial({ color: 0x222c36 })
      );
      const plateTop = new THREE.Mesh(
        new THREE.BoxGeometry(0.088, 0.028, 0.023),
        new THREE.MeshLambertMaterial({ color: 0x364859 })
      );
      plateTop.position.set(0, 0.094, 0);
      const plateStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.118, 0.016, 0.024),
        new THREE.MeshBasicMaterial({ color: 0x4a90e2 })
      );
      plateStripe.position.set(0, 0.032, 0);
      plateGroup.add(plateBody, plateTop, plateStripe);
      // Seated cleanly underneath the top-pinch grip with zero finger clipping behind the plate
      plateGroup.position.set(0.0, -0.098, -0.004);
      plateGroup.visible = false;
      plateHand.add(plateGroup);
      this.plateMesh = plateGroup;

      const plateArm = this._createForearm();
      plateArm.scale.set(1.22, 1.22, 1.0);
      rig.add(plateHand, plateArm);

      this.vmCamera.add(rig);
      this.plateRig = rig;
      this.plateHand = plateHand;
      this.plateArm = plateArm;
    }

    if (withHands && !this.slideLegRig && this.vmCamera) {
      // First-Person Baseball-Slide Lead Leg Rig (visible kicked out in front of player for duration of slide!)
      const sLeg = new THREE.Group();
      const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2f342d });
      const padMat = new THREE.MeshLambertMaterial({ color: 0x181b1a });
      const bootMat = new THREE.MeshLambertMaterial({ color: 0x1e2124 });
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.16, 0.44), pantsMat);
      thigh.position.set(0, 0, 0.18);
      const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.12), padMat);
      kneePad.position.set(0, 0.075, -0.04);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.135, 0.42), pantsMat);
      shin.position.set(0, -0.01, -0.24);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.13), bootMat);
      boot.position.set(0, 0.045, -0.47);
      boot.rotation.x = 0.25;
      const bootToe = new THREE.Mesh(new THREE.BoxGeometry(0.142, 0.08, 0.10), padMat);
      bootToe.position.set(0, 0.14, -0.45);
      sLeg.add(thigh, kneePad, shin, boot, bootToe);
      sLeg.visible = false;
      this.vmCamera.add(sLeg);
      this.slideLegRig = sLeg;
      this.slideLegBlend = 0;
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
      return;
    } else {
      if (this.downedLegsGroup) this.downedLegsGroup.visible = false;
      if (player.ledgeState) {
        // Two-handed progressive ledge-grab: stow weapon & show both gloved hands gripping & hoisting over the ledge!
        this.viewmodelGroup.visible = false;
        if (this.plateRig) this.plateRig.visible = false;
        if (this.medRig) this.medRig.visible = false;
        if (this.tacFistRig) this.tacFistRig.visible = false;
        if (this.ledgeHandsGroup && this.ledgeHandsParts) {
          this.ledgeHandsGroup.visible = !player.isThirdPerson;
          const ls = player.ledgeState;
          const edge = ls.edgePos || ls.hangPos;
          // Anchor directly to the world-space ledge lip & ledge orientation (independent of player's head look!)
          this.ledgeHandsGroup.rotation.set(0, ls.ledgeYaw || 0, 0);
          const grabOffset = ls.phase === 'grabbing' ? (1 - Math.pow(1 - ls.grabT, 2)) : 1;
          this.ledgeHandsGroup.position.set(
            edge.x - (ls.inwardX || 0) * THREE.MathUtils.lerp(0.18, 0.02, grabOffset),
            edge.y + THREE.MathUtils.lerp(-0.28, 0.0, grabOffset),
            edge.z - (ls.inwardZ || 0) * THREE.MathUtils.lerp(0.18, 0.02, grabOffset)
          );
          // Aim each circular forearm cleanly from the player's torso shoulders (in ledge-local space) straight to the anchored wrists!
          const p = ls.pullProgress || 0;
          const pEase = p * p * (3 - 2 * p);
          const shY = THREE.MathUtils.lerp(-0.36, 0.42, pEase);
          const shZ = THREE.MathUtils.lerp(0.46, 0.14, pEase);
          const strain = ls.phase === 'pulling' ? Math.sin(p * Math.PI * 3) * 0.015 : 0;
          for (const arm of [this.ledgeHandsParts.leftArm, this.ledgeHandsParts.rightArm]) {
            const shoulderLocal = new THREE.Vector3(arm.side * 0.27, shY + (arm.side * strain), shZ);
            const wristLocal = new THREE.Vector3(arm.side * 0.24, 0.01, 0.0);
            this._aimArm(arm.forearm, shoulderLocal, wristLocal);
            arm.forearm.scale.x = 1.15;
            arm.forearm.scale.y = 1.15;
          }
        }
        return;
      }
      if (this.ledgeHandsGroup) this.ledgeHandsGroup.visible = false;
      if (player.isUsingDesignator) {
        // Stow / hide weapon completely while Airstrike Binoculars / Laser Designator are equipped!
        this.viewmodelGroup.visible = false;
        if (this.plateRig) this.plateRig.visible = false;
        if (this.medRig) this.medRig.visible = false;
        if (this.tacFistRig) this.tacFistRig.visible = false;
        return;
      }
      if (!this.isThirdPerson && !this.isHealing) {
        this.viewmodelGroup.visible = true;
      }
    }

    // Hip-height mantle quick weapon dip & supporting hand obstacle grab
    let mantleGrabArc = 0;
    if (player.mantleState && this.viewmodelGroup) {
      mantleGrabArc = Math.sin(player.mantleState.t * Math.PI);
      this.viewmodelGroup.position.y = THREE.MathUtils.lerp(this.viewmodelGroup.position.y, -0.22 - mantleGrabArc * 0.14, Math.min(1, dt * 18));
      this.viewmodelGroup.rotation.x = THREE.MathUtils.lerp(this.viewmodelGroup.rotation.x, -0.24 * mantleGrabArc, Math.min(1, dt * 18));
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
        if (this.leftHand) {
          this.leftHand.position.set(this.leftHandRestPos.x, this.leftHandRestPos.y, this.leftHandRestPos.z + pumpOffset);
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

    if (!this.isReloading && !this.isInspecting && this.boltMesh && !(weaponDef && weaponDef.boltAction && this.boltActionTimer > 0)) {
      const slotObj = player.getActiveWeaponSlot();
      const lockOpen = weaponDef && weaponDef.slot === 'secondary' && slotObj && slotObj.mag === 0;
      const offset = lockOpen ? 0.052 : (weaponDef && weaponDef.id === 'm870' ? pumpOffset : this.boltKick);
      this.boltMesh.position.z = this.boltRestPos.z + offset;
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
        this._wallRay.set(origin, camDirW);
        this._wallRay.near = 0.05;
        this._wallRay.far = barrelLen;
        const hits = this._wallRay.intersectObjects(rayTargets, false);
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
      this._lastTargetWallPush = targetWallPush;
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

    // Smooth spring-damped physical weapon kick recovery (Z shoulder push, pitch, horizontal yaw/X & subtle roll)
    const recDecay = Math.min(1, dt * 15);
    this.recoilZ = THREE.MathUtils.lerp(this.recoilZ, 0, Math.min(1, dt * 18));
    this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, recDecay);
    this.recoilYaw = THREE.MathUtils.lerp(this.recoilYaw, 0, Math.min(1, dt * 14));
    this.recoilRoll = THREE.MathUtils.lerp(this.recoilRoll, 0, Math.min(1, dt * 14));
    this.recoilX = THREE.MathUtils.lerp(this.recoilX, 0, Math.min(1, dt * 16));

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
    const swayMult = (isAdsActive ? 0.28 : 1.0) * wWeight;
    const clampedDY = THREE.MathUtils.clamp(dYaw, -0.16, 0.16);
    const clampedDP = THREE.MathUtils.clamp(dPitch, -0.14, 0.14);
    const swayLerpIn = Math.min(1, dt * 10);
    this.lookSwayX = THREE.MathUtils.lerp(this.lookSwayX, THREE.MathUtils.clamp(clampedDY * 0.38 * swayMult, -0.045, 0.045), swayLerpIn);
    this.lookSwayY = THREE.MathUtils.lerp(this.lookSwayY, THREE.MathUtils.clamp(-clampedDP * 0.28 * swayMult, -0.032, 0.032), swayLerpIn);
    this.lookSwayRotY = THREE.MathUtils.lerp(this.lookSwayRotY, THREE.MathUtils.clamp(clampedDY * 1.35 * swayMult, -0.16, 0.16), swayLerpIn);
    this.lookSwayRotX = THREE.MathUtils.lerp(this.lookSwayRotX, THREE.MathUtils.clamp(clampedDP * 1.05 * swayMult, -0.12, 0.12), swayLerpIn);
    this.lookSwayRotZ = THREE.MathUtils.lerp(this.lookSwayRotZ, THREE.MathUtils.clamp(-clampedDY * 1.15 * swayMult, -0.14, 0.14), swayLerpIn);

    // Sprint tilt, DMZ Tactical Sprint high-port skyward carry, tactical slide cant, wall tuck, progressive corner-lean cant (even while ADS!), recoil kick & camera sway
    const slideCantZ = (!customRot && !this.isFistsMode && player.isSliding) ? (isAdsActive ? -0.10 : -0.32) : 0;
    const slideCantY = (!customRot && !this.isFistsMode && player.isSliding) ? (isAdsActive ? 0.0 : 0.18) : 0;
    const sprintRotX = this.isFistsMode ? 0 : (tacSprintingHip ? 0.86 : (sprintingHip ? -0.14 : 0));
    const sprintRotY = this.isFistsMode ? 0 : (tacSprintingHip ? 0.16 : (sprintingHip ? 0.22 : 0));
    const sprintRotZ = this.isFistsMode ? 0 : (tacSprintingHip ? -0.14 : (sprintingHip ? 0.08 : 0));
    const leanRotZ = isAdsActive ? (-player.lean * 0.13) : (-player.lean * 0.22);
    const targetRotX = (customRot && !this.isFistsMode ? activeRotOff.x : (sprintRotX + swayRotX + this.recoilPitch + this.lookSwayRotX + wallRotX)) + drawRot.x;
    const targetRotY = (customRot && !this.isFistsMode ? activeRotOff.y : (sprintRotY + slideCantY + this.recoilYaw + this.lookSwayRotY + wallRotY + leanCantY)) + drawRot.y;
    const targetRotZ = (customRot && !this.isFistsMode ? activeRotOff.z : (sprintRotZ + swayRotZ + slideCantZ + boltActionRoll + this.recoilRoll + this.lookSwayRotZ + wallRotZ + leanRotZ)) + drawRot.z;

    // MW2/DMZ One-Handed High-Port Tactical Sprint: weapon held UP in right hand, left fist pumping apart!
    // When in Fists mode, center the viewmodel horizontally so both hands come evenly from bottom-left & bottom-right!
    const adsPivotX = (isAdsActive && !customRot) ? (Math.sin(targetRotZ) * this.sightHeight) : 0;
    const adsPivotY = (isAdsActive && !customRot) ? ((1 - Math.cos(targetRotZ)) * this.sightHeight) : 0;
    const basePosX = this.isFistsMode ? 0.0 : (isAdsActive ? adsPivotX : (tacSprintingHip ? 0.24 : (sprintingHip ? 0.19 : 0.22)));
    const basePosY = this.isFistsMode ? -0.16 : (isAdsActive ? (-this.sightHeight + adsPivotY) : (tacSprintingHip ? -0.14 : (sprintingHip ? -0.235 : -0.20)));
    const basePosZ = this.isFistsMode ? -0.38 : (isAdsActive ? this.adsZ : (tacSprintingHip ? -0.34 : (sprintingHip ? -0.40 : -0.42)));

    const targetX = basePosX + this.recoilX + this.lookSwayX + activePosOff.x + wallPosX + leanAlignX + drawPos.x;
    const targetY = basePosY + this.lookSwayY + activePosOff.y + wallPosY + drawPos.y;
    const targetZ = basePosZ + this.recoilZ + activePosOff.z + wallPosZ + drawPos.z;

    const lerpRate = this.isReloading ? 28 : ((this.isPlating || this.isHealing) ? 16 : (this.isInspecting ? 9 : (this.drawTimer > 0 ? 22 : 13)));
    this.viewmodelGroup.position.x = THREE.MathUtils.lerp(this.viewmodelGroup.position.x, targetX + bobX, Math.min(1, dt * lerpRate));
    this.viewmodelGroup.position.y = THREE.MathUtils.lerp(this.viewmodelGroup.position.y, targetY - bobY, Math.min(1, dt * lerpRate));
    this.viewmodelGroup.position.z = THREE.MathUtils.lerp(this.viewmodelGroup.position.z, targetZ, Math.min(1, dt * (lerpRate + 2)));

    const rotRate = this.isReloading ? 26 : ((this.isPlating || this.isHealing) ? 14 : (this.isInspecting ? 8 : 11));
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

      let lRotX = this.leftHandRestRot.x + (moving ? (-0.20 + lSin * 0.28) * pumpAmp : 0);
      let lRotY = this.leftHandRestRot.y + (moving ? lSin * 0.14 * pumpAmp : 0);
      let lRotZ = this.leftHandRestRot.z - player.lean * 0.14 + this.lookSwayRotZ * 0.35;

      let rRotX = this.rightHandRestRot.x + (moving ? (-0.20 + rSin * 0.28) * pumpAmp : 0);
      let rRotY = this.rightHandRestRot.y - (moving ? rSin * 0.14 * pumpAmp : 0);
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
          rRotX = this.rightHandRestRot.x - 0.35 * thrust;
          rRotZ = this.rightHandRestRot.z + 0.55 * thrust;
          // Left guard tucks slightly back
          lTarget.z += 0.05 * thrust;
        } else {
          lTarget.set(
            THREE.MathUtils.lerp(this.leftHandRestPos.x, -0.03, thrust),
            THREE.MathUtils.lerp(this.leftHandRestPos.y, 0.04, thrust),
            THREE.MathUtils.lerp(this.leftHandRestPos.z, -0.34, thrust)
          );
          lRotX = this.leftHandRestRot.x - 0.35 * thrust;
          lRotZ = this.leftHandRestRot.z - 0.55 * thrust;
          // Right guard tucks slightly back
          rTarget.z += 0.05 * thrust;
        }
      }

      this.leftHand.visible = true;
      this.rightHand.visible = true;
      this.leftHand.position.lerp(lTarget, fRate);
      this.leftHand.rotation.x = THREE.MathUtils.lerp(this.leftHand.rotation.x, lRotX, fRate);
      this.leftHand.rotation.y = THREE.MathUtils.lerp(this.leftHand.rotation.y, lRotY, fRate);
      this.leftHand.rotation.z = THREE.MathUtils.lerp(this.leftHand.rotation.z, lRotZ, fRate);

      this.rightHand.position.lerp(rTarget, fRate);
      this.rightHand.rotation.x = THREE.MathUtils.lerp(this.rightHand.rotation.x, rRotX, fRate);
      this.rightHand.rotation.y = THREE.MathUtils.lerp(this.rightHand.rotation.y, rRotY, fRate);
      this.rightHand.rotation.z = THREE.MathUtils.lerp(this.rightHand.rotation.z, rRotZ, fRate);
    } else if (this.leftHand && !customRot && !(weaponDef && weaponDef.id === 'm870' && this.pumpTimer > 0)) {
      // Left-handed clenched fist pumping on the left during Tactical Sprint (positioned cleanly inside FOV)
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
        if (mantleGrabArc > 0.04) {
          // Supporting left hand leaves gun to grab & push off the top edge of the hip-height obstacle!
          const grabTarget = new THREE.Vector3(
            this.leftHandRestPos.x - 0.18 * mantleGrabArc,
            this.leftHandRestPos.y - 0.10 * mantleGrabArc,
            this.leftHandRestPos.z - 0.24 * mantleGrabArc
          );
          this.leftHand.position.lerp(grabTarget, Math.min(1, dt * 22));
          this.leftHand.rotation.x = THREE.MathUtils.lerp(this.leftHand.rotation.x, -0.85 * mantleGrabArc, Math.min(1, dt * 20));
          this.leftHand.rotation.y = THREE.MathUtils.lerp(this.leftHand.rotation.y, 0.35 * mantleGrabArc, Math.min(1, dt * 20));
          this.leftHand.rotation.z = THREE.MathUtils.lerp(this.leftHand.rotation.z, 0.45 * mantleGrabArc, Math.min(1, dt * 20));
        } else if (proneHandPushArc > 0.04) {
          // Supporting left hand leaves gun to plant on the ground / push off while entering or exiting prone!
          const pushTarget = new THREE.Vector3(
            this.leftHandRestPos.x - 0.24 * proneHandPushArc,
            this.leftHandRestPos.y - 0.26 * proneHandPushArc,
            this.leftHandRestPos.z - 0.16 * proneHandPushArc
          );
          this.leftHand.position.lerp(pushTarget, Math.min(1, dt * 20));
          this.leftHand.rotation.x = THREE.MathUtils.lerp(this.leftHand.rotation.x, -1.05 * proneHandPushArc, Math.min(1, dt * 18));
          this.leftHand.rotation.y = THREE.MathUtils.lerp(this.leftHand.rotation.y, 0.25 * proneHandPushArc, Math.min(1, dt * 18));
          this.leftHand.rotation.z = THREE.MathUtils.lerp(this.leftHand.rotation.z, 0.55 * proneHandPushArc, Math.min(1, dt * 18));
        } else {
          this.leftHand.position.lerp(this.leftHandRestPos, Math.min(1, dt * 18));
          this.leftHand.rotation.x = THREE.MathUtils.lerp(this.leftHand.rotation.x, this.leftHandRestRot.x, Math.min(1, dt * 18));
          this.leftHand.rotation.y = THREE.MathUtils.lerp(this.leftHand.rotation.y, this.leftHandRestRot.y, Math.min(1, dt * 18));
          this.leftHand.rotation.z = THREE.MathUtils.lerp(this.leftHand.rotation.z, this.leftHandRestRot.z, Math.min(1, dt * 18));
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
        ? new THREE.Vector3(0.34 + leanShX + swayShX, -0.34 - Math.abs(player.lean) * 0.02, 0.24)
        : new THREE.Vector3(0.16 + leanShX + swayShX, -0.20 - Math.abs(player.lean) * 0.02, 0.36);
      const rWrist = this.rightHand.position.clone().add(new THREE.Vector3(0.008, -0.010, 0.034));
      this._aimArm(this.rightArm, rShoulder, rWrist);
    }
    if (this.leftArm && this.leftHand) {
      if (!customRot && !tacSprintingHip && !this.isFistsMode) {
        this.leftHand.rotation.z = THREE.MathUtils.lerp(
          this.leftHand.rotation.z,
          this.leftHandRestRot.z - player.lean * 0.14 + this.lookSwayRotZ * 0.35 + this.recoilRoll * 0.5,
          Math.min(1, dt * 16)
        );
      }
      const lShoulder = this.isFistsMode
        ? new THREE.Vector3(-0.34 + leanShX + swayShX, -0.34 - Math.abs(player.lean) * 0.02, 0.24)
        : (tacSprintingHip
          ? new THREE.Vector3(-0.62, -0.28, 0.26)
          : new THREE.Vector3(-0.22 + leanShX + swayShX, -0.20 - Math.abs(player.lean) * 0.02, 0.30));
      const lWrist = this.leftHand.position.clone().add(new THREE.Vector3(-0.010, -0.010, 0.034));
      this._aimArm(this.leftArm, lShoulder, lWrist);
    }

    // First-Person Baseball-Slide Lead Leg Animation (kicks out in front of camera for duration of slide!)
    if (this.slideLegRig) {
      const showSlideLeg = !!(player && player.isSliding && !player.isThirdPerson && !player.isDowned && !player.dead);
      this.slideLegBlend = THREE.MathUtils.lerp(this.slideLegBlend || 0, showSlideLeg ? 1 : 0, Math.min(1, dt * 15));
      if (this.slideLegBlend > 0.02) {
        this.slideLegRig.visible = true;
        const vib = showSlideLeg ? Math.sin(performance.now() * 0.036) * 0.008 : 0;
        this.slideLegRig.position.set(
          THREE.MathUtils.lerp(-0.18, -0.04, this.slideLegBlend),
          THREE.MathUtils.lerp(-0.82, -0.46, this.slideLegBlend) + vib,
          THREE.MathUtils.lerp(-0.24, -0.56, this.slideLegBlend)
        );
        this.slideLegRig.rotation.set(
          THREE.MathUtils.lerp(-0.55, 0.10, this.slideLegBlend),
          THREE.MathUtils.lerp(0.18, 0.06, this.slideLegBlend),
          THREE.MathUtils.lerp(-0.16, -0.06, this.slideLegBlend)
        );
      } else {
        this.slideLegRig.visible = false;
      }
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
        if (p.isSmoke && p.mesh.material) p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.08);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        if (t.line.geometry) t.line.geometry.dispose();
        if (t.line.material) t.line.material.dispose();
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
      if (this.leftHand) {
        this.leftHand.position.lerp(this.leftHandRestPos, handRate);
        this.leftHand.rotation.x = THREE.MathUtils.lerp(this.leftHand.rotation.x, this.leftHandRestRot.x, handRate);
        this.leftHand.rotation.y = THREE.MathUtils.lerp(this.leftHand.rotation.y, this.leftHandRestRot.y, handRate);
        this.leftHand.rotation.z = THREE.MathUtils.lerp(this.leftHand.rotation.z, this.leftHandRestRot.z, handRate);
        if (this.leftHand.userData && this.leftHand.userData.thumbGroup) {
          this.leftHand.userData.thumbGroup.rotation.set(0, 0, 0);
        }
      }
    };
    const restRightHand = () => {
      if (this.rightHand) this.rightHand.position.lerp(this.rightHandRestPos, handRate);
    };

    if (id === 'mp5k') {
      // MP5-K: Lock charging handle up -> pull mag straight out -> line up fresh mag -> insert -> H&K slap!
      if (p > 0.06 && !this.reloadSfxFlags.boltLock) {
        this.reloadSfxFlags.boltLock = true;
        window.soundEngine.playRechamber(this.reloadWeaponId || (weaponDef && weaponDef.id) || 'ak74m');
      }
      if (p > 0.25 && !this.reloadSfxFlags.magOut) {
        this.reloadSfxFlags.magOut = true;
        window.soundEngine.playMagOut(this.reloadWeaponId);
      }
      if (p > 0.68 && !this.reloadSfxFlags.magIn) {
        this.reloadSfxFlags.magIn = true;
        window.soundEngine.playMagIn(this.reloadWeaponId);
      }
      if (p > 0.80 && !this.reloadSfxFlags.rack) {
        this.reloadSfxFlags.rack = true;
        window.soundEngine.playRechamber(this.reloadWeaponId || (weaponDef && weaponDef.id) || 'ak74m');
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
        window.soundEngine.playMagOut(this.reloadWeaponId);
      }
      if (p > 0.56 && !this.reloadSfxFlags.magIn) {
        this.reloadSfxFlags.magIn = true;
        window.soundEngine.playMagIn(this.reloadWeaponId);
      }
      if (this.wasEmptyReload && p > 0.68 && !this.reloadSfxFlags.rack) {
        this.reloadSfxFlags.rack = true;
        window.soundEngine.playRechamber(this.reloadWeaponId || (weaponDef && weaponDef.id) || 'ak74m');
      }

      // Helper: lock left palm OUTSIDE the left face of the AK banana mag (zero clipping!) with fingers wrapping cleanly around the far/front side & thumb tucked along rear spine!
      const gripSpareAkMag = (mag) => {
        if (!mag) return;
        const mr = mag.rotation.x;
        const localY = -0.056;
        const localZ = 0.016;
        // X clearance (-0.032) places palm flush against exterior left wall of mag so mag never clips through palm!
        const gx = mag.position.x - 0.032;
        const gy = mag.position.y + (localY * Math.cos(mr) - localZ * Math.sin(mr));
        const gz = mag.position.z + (localY * Math.sin(mr) + localZ * Math.cos(mr));
        moveLeftHand(gx, gy, gz);
        if (this.leftHand) {
          this.leftHand.rotation.set(mr * 0.90 + 0.06, 0.10, -1.42);
          if (this.leftHand.userData && this.leftHand.userData.thumbGroup) {
            this.leftHand.userData.thumbGroup.rotation.set(0.14, -0.35, 0.20);
          }
        }
      };
      const releaseAkThumb = () => {
        if (this.leftHand && this.leftHand.userData && this.leftHand.userData.thumbGroup) {
          this.leftHand.userData.thumbGroup.rotation.set(0, 0, 0);
        }
      };

      if (p < 0.22) {
        // 1. Bring fresh mag up behind old mag's paddle release (hand firmly gripping lower-mid mag body)
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
          gripSpareAkMag(this.spareMagMesh);
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
          const strike = Math.sin(Math.min(1, t * 1.4) * Math.PI);
          this.spareMagMesh.position.set(
            -0.01,
            this.magRestPos.y - 0.05 - t * 0.04,
            this.magRestPos.z + 0.08 - strike * 0.055
          );
          this.spareMagMesh.rotation.x = THREE.MathUtils.lerp(-0.45, -0.74, t);
          gripSpareAkMag(this.spareMagMesh);
        }
        if (this.magMesh) {
          this.magMesh.visible = t < 0.88;
          this.magMesh.rotation.x = THREE.MathUtils.lerp(this.magRestRot.x, -1.35, t);
          this.magMesh.position.set(
            this.magRestPos.x,
            this.magRestPos.y - t * t * 0.22,
            this.magRestPos.z - t * 0.16
          );
        }
      } else if (p < 0.62) {
        // 3. Hook front lug of new mag (spareMagMesh) & rock backward tightly into lock with left hand gripping mag body!
        const rawT = (p - 0.38) / 0.24;
        const jolt = rawT > 0.78 ? Math.sin(((rawT - 0.78) / 0.22) * Math.PI) : 0;
        restRightHand();
        pos.x = -0.12; pos.y = 0.13 + jolt * 0.024; pos.z = -0.02;
        rot.x = 0.28 + jolt * 0.09; rot.y = 0.34; rot.z = -0.40;
        if (this.magMesh) this.magMesh.visible = false;

        if (this.spareMagMesh) {
          this.spareMagMesh.visible = true;
          const upT = smooth(THREE.MathUtils.clamp(rawT / 0.42, 0, 1));
          const rockInT = smooth(THREE.MathUtils.clamp((rawT - 0.36) / 0.48, 0, 1));
          this.spareMagMesh.position.set(
            THREE.MathUtils.lerp(-0.01, this.magRestPos.x, upT),
            THREE.MathUtils.lerp(this.magRestPos.y - 0.09, this.magRestPos.y, upT),
            THREE.MathUtils.lerp(this.magRestPos.z + 0.02, this.magRestPos.z, rockInT)
          );
          this.spareMagMesh.rotation.x = THREE.MathUtils.lerp(-0.74, this.magRestRot.x, rockInT);
          gripSpareAkMag(this.spareMagMesh);
          // Brief firm seating press upward as the rear locking lug clicks into place
          if (rawT > 0.84 && this.leftHand) {
            const releaseT = smooth((rawT - 0.84) / 0.16);
            this.leftHand.position.lerp(this.leftHandRestPos, releaseT * 0.35);
          }
        }
      } else if (this.wasEmptyReload && p < 0.90) {
        const rawT = (p - 0.62) / 0.28;
        const t = smooth(rawT);
        if (this.spareMagMesh) this.spareMagMesh.visible = false;
        if (this.magMesh) { this.magMesh.visible = true; this.magMesh.position.copy(this.magRestPos); this.magMesh.rotation.copy(this.magRestRot); }
        releaseAkThumb();
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
        releaseAkThumb();
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
        window.soundEngine.playRechamber(this.reloadWeaponId || (weaponDef && weaponDef.id) || 'ak74m');
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
            window.soundEngine.playMagIn(this.reloadWeaponId);
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

    if (id === 'mosin9130') {
      // M91/30 Mosin-Nagant: Open Bolt -> Insert 5-Round Brass Stripper Clip From Top -> Press Rounds Down -> Flick Clip -> Close Bolt!
      if (p > 0.06 && !this.reloadSfxFlags.magOut) {
        this.reloadSfxFlags.magOut = true;
        window.soundEngine.playRechamber(this.reloadWeaponId || (weaponDef && weaponDef.id) || 'ak74m');
      }
      if (p > 0.44 && !this.reloadSfxFlags.magIn) {
        this.reloadSfxFlags.magIn = true;
        window.soundEngine.playMagIn(this.reloadWeaponId);
      }
      if (p > 0.72 && !this.reloadSfxFlags.rack) {
        this.reloadSfxFlags.rack = true;
        window.soundEngine.playRechamber(this.reloadWeaponId || (weaponDef && weaponDef.id) || 'ak74m');
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
          moveRightHand(this.boltMesh.position.x + 0.022, this.boltMesh.position.y + lift * 0.022, this.boltMesh.position.z + 0.024);
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
          moveRightHand(this.magMesh.position.x + 0.022, this.magMesh.position.y + 0.024, this.magMesh.position.z + 0.02);
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
          moveRightHand(0.018, THREE.MathUtils.lerp(0.082, 0.036, press), this.magRestPos.z + 0.02);
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
          moveRightHand(this.boltMesh.position.x + 0.022, this.boltMesh.position.y + (1 - lock) * 0.022, this.boltMesh.position.z + 0.024);
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
      window.soundEngine.playMagOut(this.reloadWeaponId);
    }
    if (p > 0.54 && !this.reloadSfxFlags.magIn) {
      this.reloadSfxFlags.magIn = true;
      window.soundEngine.playMagIn(this.reloadWeaponId);
    }
    if (this.wasEmptyReload && p > 0.64 && !this.reloadSfxFlags.rack) {
      this.reloadSfxFlags.rack = true;
      window.soundEngine.playRechamber(this.reloadWeaponId || (weaponDef && weaponDef.id) || 'ak74m');
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
    if (this.leftHand) {
      this.leftHand.position.copy(this.leftHandRestPos);
      this.leftHand.rotation.copy(this.leftHandRestRot);
      if (this.leftHand.userData && this.leftHand.userData.thumbGroup) {
        this.leftHand.userData.thumbGroup.rotation.set(0, 0, 0);
      }
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
          handRotTarget.set(-0.25, 0.25, -0.15);
        } else if (pt < 0.44) {
          // Beat B: Lift & align hand (with parented plate locked cleanly underneath!) over chest carrier slot
          const t = smooth((pt - 0.14) / 0.30);
          this.plateMesh.visible = true;
          handTarget.set(
            THREE.MathUtils.lerp(-0.20, 0.0, t),
            THREE.MathUtils.lerp(-0.14, 0.04, t),
            THREE.MathUtils.lerp(-0.26, -0.25, t)
          );
          handRotTarget.set(
            THREE.MathUtils.lerp(0.18, -0.18, t),
            THREE.MathUtils.lerp(0.42, 0.04, t),
            THREE.MathUtils.lerp(-0.22, 0.0, t)
          );
        } else if (pt < 0.54) {
          // Beat C: Brief alignment beat right at the lip of the pouch
          this.plateMesh.visible = true;
          handTarget.set(0.0, 0.04, -0.25);
          handRotTarget.set(-0.18, 0.04, 0.0);
        } else if (pt < 0.86) {
          // Beat D: Two-stage vertical slide straight down into the tight carrier slot
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
            THREE.MathUtils.lerp(0.04, -0.19, slideT),
            THREE.MathUtils.lerp(-0.25, -0.285, slideT)
          );
          handRotTarget.set(-0.18 - slideT * 0.14, 0.04, 0.0);
        } else {
          // Beat E: Brief settle pause before next plate or zipping up
          this.plateMesh.visible = false;
          handTarget.set(-0.04, -0.20, -0.24);
          handRotTarget.set(-0.35, 0.08, -0.12);
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
    this.boltActionDelayTimer = 0;
    this.boltActionTimer = 0;
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
    this.boltActionDelayTimer = 0;
    this.boltActionTimer = 0;
    this._resetReloadParts();
  }

  tryFire(player, weaponSlotState, world, enemyManager, onHitCallback, squadManager = null, onAllyHitCallback = null) {
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
      const reserve = player.getReserveAmmo ? player.getReserveAmmo(def.ammoType) : 0;
      if (reserve > 0 && player.startReload) {
        player.startReload();
        return false;
      }
      this.fireTimer = 0.25;
      window.soundEngine.playEmptyClick();
      return false;
    }

    weaponSlotState.mag -= 1;
    this.fireTimer = def.fireRate;
    const kickScale = player.isADS ? 0.58 : 1.0;
    const hRec = def.horizRecoil != null ? def.horizRecoil : (def.recoil * 0.48);
    const hSign = Math.random() < 0.56 ? 1 : -1;
    // Physical rearward shoulder kick + controlled muzzle flip + horizontal recoil bounce
    this.recoilOffset = Math.min(0.06, this.recoilOffset + 0.022 * kickScale);
    const baseZKick = def.id === 'm870' ? 0.036 : ((def.id === 'm24' || def.id === 'awm338' || def.id === 'mosin9130') ? 0.034 : (def.slot === 'secondary' ? 0.018 : 0.022));
    this.recoilZ = Math.min(0.056, this.recoilZ + baseZKick * kickScale);
    this.recoilPitch = Math.min(0.088, this.recoilPitch + def.recoil * 1.15 * kickScale);
    this.recoilYaw = THREE.MathUtils.clamp(this.recoilYaw + hSign * hRec * 1.35 * kickScale, -0.045, 0.045);
    this.recoilRoll = THREE.MathUtils.clamp(this.recoilRoll + (Math.random() - 0.5) * 0.062 * kickScale, -0.055, 0.055);
    this.recoilX = THREE.MathUtils.clamp(this.recoilX + hSign * hRec * 0.32 * kickScale, -0.012, 0.012);
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

    // Reduced visual camera recoil + authentic vertical & horizontal recoil kick
    const camRecScale = player.isADS ? 0.48 : 0.62;
    const vertKick = def.recoil * camRecScale;
    const horizKick = (Math.random() - 0.44) * hRec * 1.15 * camRecScale;
    player.applyRecoil(vertKick, horizKick);
    this.fireBloom = Math.min(0.055, this.fireBloom + def.recoil * 0.42);

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

    // Find crosshair aim convergence point so bullets physically spawn from muzzleWorld and converge cleanly onto sight zero!
    const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const aimRay = new THREE.Raycaster(origin, camFwd, 0.25, def.range);
    const enemyMeshes = enemyManager.getHitboxMeshes();
    const allyMeshes = (window.SQUAD_PVP && squadManager && squadManager.getHitboxMeshes) ? squadManager.getHitboxMeshes() : [];
    const aimHitsW = aimRay.intersectObjects(world.shootableMeshes, false);
    const aimHitsE = aimRay.intersectObjects(enemyMeshes, false);
    const aimHitsA = allyMeshes.length > 0 ? aimRay.intersectObjects(allyMeshes, false) : [];
    const aimDistW = aimHitsW.length > 0 ? aimHitsW[0].distance : def.range;
    const aimDistE = aimHitsE.length > 0 ? aimHitsE[0].distance : def.range;
    const aimDistA = aimHitsA.length > 0 ? aimHitsA[0].distance : def.range;
    const minTargetDist = Math.min(aimDistE, aimDistA);
    const convDist = minTargetDist < def.range
      ? Math.max(1.2, Math.min(aimDistW, minTargetDist, zeroDist))
      : Math.max(4.5, Math.min(aimDistW, zeroDist));
    const aimPoint = origin.clone().addScaledVector(camFwd, convDist);

    for (let p = 0; p < def.pellets; p++) {
      // Spawn bullet directly from the end of the barrel (muzzleWorld), aimed toward sight convergence + spread!
      const baseDir = aimPoint.clone().sub(muzzleWorld).normalize();
      const spreadQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        (Math.random() - 0.5) * 2 * totalSpread,
        (Math.random() - 0.5) * 2 * totalSpread,
        0,
        'YXZ'
      ));
      const launchDir = baseDir.applyQuaternion(spreadQuat).normalize();
      // Compensate slight upward zero angle so shots land dead-on at zeroDist and drop naturally beyond!
      const zeroTime = zeroDist / muzzleVel;
      const zeroCompY = (0.5 * gravity * zeroTime * zeroTime) / zeroDist;
      launchDir.y += zeroCompY;
      launchDir.normalize();

      // Step parabolic ballistic curve from barrel tip out to def.range
      const vel = launchDir.clone().multiplyScalar(muzzleVel);
      const curPos = muzzleWorld.clone();
      const tracePts = [curPos.clone()];
      const maxSteps = def.pellets > 1 ? 4 : 18;
      const stepDistTarget = Math.max(12, def.range / maxSteps);
      const stepDt = stepDistTarget / muzzleVel;
      let hitPoint = null;
      let totalDist = 0;

      for (let step = 0; step < maxSteps && totalDist < def.range; step++) {
        const nextPos = curPos.clone().addScaledVector(vel, stepDt);
        nextPos.y -= 0.5 * gravity * stepDt * stepDt;
        vel.y -= gravity * stepDt;

        const segVec = nextPos.clone().sub(curPos);
        const segLen = segVec.length();
        if (segLen < 0.001) break;
        const segDir = segVec.clone().divideScalar(segLen);
        const segRay = new THREE.Raycaster(curPos, segDir, 0.01, segLen);

        const worldHits = segRay.intersectObjects(world.shootableMeshes, false);
        const worldDist = worldHits.length > 0 ? worldHits[0].distance : Infinity;
        const enemyHits = segRay.intersectObjects(enemyMeshes, false);
        const allyHits = allyMeshes.length > 0 ? segRay.intersectObjects(allyMeshes, false) : [];
        const enemyDist = enemyHits.length > 0 ? enemyHits[0].distance : Infinity;
        const allyDist = allyHits.length > 0 ? allyHits[0].distance : Infinity;

        if (allyDist < worldDist && allyDist < enemyDist && allyDist <= segLen) {
          const hit = allyHits[0];
          hitPoint = hit.point.clone();
          tracePts.push(hitPoint.clone());
          const { ally, part } = hit.object.userData;
          const isHead = part === 'head';
          const dmg = Math.round(def.damage * (isHead ? 1.8 : 1.0));
          const attackerInfo = { name: 'YOU', isPlayer: true, weaponId: weaponSlotState.id, weaponName: def.name };
          this._spawnImpact(hitPoint, 0x991111, 5);
          if (onAllyHitCallback) onAllyHitCallback(isHead, dmg, ally, attackerInfo);
          break;
        } else if (enemyDist < worldDist && enemyDist <= segLen) {
          const hit = enemyHits[0];
          hitPoint = hit.point.clone();
          tracePts.push(hitPoint.clone());
          const { enemy, part } = hit.object.userData;
          const isHead = part === 'head';
          const dmg = Math.round(def.damage * (isHead ? 2.0 : 1.0));
          const attackerInfo = { name: 'YOU', isPlayer: true, weaponId: weaponSlotState.id, weaponName: def.name };
          const killed = enemy.takeDamage(dmg, muzzleWorld, attackerInfo);
          this._spawnImpact(hitPoint, enemy.lastHitArmor ? 0x4fc3f7 : 0x991111, 5);
          onHitCallback(isHead, killed, enemy, attackerInfo, dmg);
          break;
        } else if (worldHits.length > 0 && worldDist <= segLen) {
          hitPoint = worldHits[0].point.clone();
          tracePts.push(hitPoint.clone());
          this._spawnImpact(hitPoint, 0xc8b898, 4);
          break;
        }

        curPos.copy(nextPos);
        totalDist += segLen;
        tracePts.push(curPos.clone());
      }

      this._spawnCurvedTracer(tracePts, def.boltAction ? 0xffe49e : 0xffdd88);
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
    this.boltMesh = null;
    this.charmPivot = null;
    this.leftFist = null;

    const g = new THREE.Group();

    // Gloved tactical fists matching gun-holding hands, rising from bottom-left & bottom-right at an even angle
    // with the left lead fist positioned slightly above the right guard fist
    this.leftHand = this._createHand(false, 'leftFist');
    this.leftHand.position.set(-0.19, -0.015, -0.05);
    this.leftHand.rotation.set(-0.26, 0.28, -0.22);
    this.leftHandRestPos.copy(this.leftHand.position);
    this.leftHandRestRot.copy(this.leftHand.rotation);
    this.leftArm = this._createForearm();

    this.rightHand = this._createHand(true, 'rightFist');
    this.rightHand.position.set(0.19, -0.062, 0.0);
    this.rightHand.rotation.set(-0.26, -0.28, 0.22);
    this.rightHandRestPos.copy(this.rightHand.position);
    this.rightHandRestRot.copy(this.rightHand.rotation);
    this.rightArm = this._createForearm();

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
      const raycaster = new THREE.Raycaster(origin, rDir, 0.0, reach);
      const worldHits = (world && world.shootableMeshes) ? raycaster.intersectObjects(world.shootableMeshes, false) : [];
      const worldDist = worldHits.length > 0 ? worldHits[0].distance : reach;
      if (rIdx === 0 && worldHits.length > 0) firstWorldHit = worldHits[0];

      if (enemyMeshes.length > 0) {
        const eHits = raycaster.intersectObjects(enemyMeshes, false);
        if (eHits.length > 0 && eHits[0].distance < worldDist) {
          if (!bestEnemyHit || eHits[0].distance < bestEnemyHit.distance) {
            bestEnemyHit = eHits[0];
          }
        }
      }
      if (allyMeshes.length > 0) {
        const aHits = raycaster.intersectObjects(allyMeshes, false);
        if (aHits.length > 0 && aHits[0].distance < worldDist) {
          if (!bestAllyHit || aHits[0].distance < bestAllyHit.distance) {
            bestAllyHit = aHits[0];
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
        if (!world || !world.shootableMeshes || dist < 0.2) return true;
        const losDir = targetPt.clone().sub(origin).normalize();
        const losRay = new THREE.Raycaster(origin, losDir, 0.05, Math.max(0.1, dist - 0.15));
        return losRay.intersectObjects(world.shootableMeshes, false).length === 0;
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

  _spawnCurvedTracer(points, color = 0xffdd88) {
    if (!points || points.length < 2) return;
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.86 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.13 });
  }

  _spawnImpact(pos, color, count) {
    if (this.particles.length > 72) return;
    if (!this._sharedImpactGeo) this._sharedImpactGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    if (!this._impactMatCache) this._impactMatCache = {};
    let mat = this._impactMatCache[color];
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color });
      this._impactMatCache[color] = mat;
    }
    const geo = this._sharedImpactGeo;
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
    if (this.particles.length > 72) return;
    if (!this._sharedSmokeGeo) this._sharedSmokeGeo = new THREE.SphereGeometry(0.08, 5, 5);
    const geo = this._sharedSmokeGeo;
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
