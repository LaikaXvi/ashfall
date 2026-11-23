// Tactical & Lethal Throwables System (Frag, Throwing Knife, Smoke, Concussion)
// Supports Quick-Throw, Hold-to-Prep/Cook (5s Frag with Crosshair Pulse), and Live 3D Trajectory Arc
class ThrowableSystem {
  constructor(scene, camera, viewmodelCamera, world, weaponSystem = null) {
    this.scene = scene;
    this.camera = camera;
    this.vmCamera = viewmodelCamera || camera;
    this.world = world;
    this.weaponSystem = weaponSystem;
    if (this.world && !this.world.activeSmokes) this.world.activeSmokes = [];

    this.GRAVITY = 18.0;
    this.projectiles = [];
    this.effects = []; // explosion flashes, shockwaves, smoke clouds

    // Prep / Cook / Throw state
    this.state = 'idle'; // 'idle' | 'prep' | 'throwing'
    this.activeSlot = null; // 'lethal' | 'tactical'
    this.activeItemId = null;
    this.holdTime = 0;
    this.cookTime = 0;
    this.pinPullDuration = 0.42;
    this.pinPulled = false;
    this.pinSoundPlayed = false;
    this.lastTickStep = 0;
    this.cookPulse = 0; // 0..1 decays each frame, drives crosshair pulse!
    this.throwAnimTimer = 0;
    this.throwAnimDuration = 0.24;

    this._ray = new THREE.Raycaster();
    this._buildPrepRig();
    this._buildTrajectoryArc();
  }

  _createThrowableMesh(id) {
    const g = new THREE.Group();
    const oliveMat = new THREE.MeshPhongMaterial({ color: 0x45503b, specular: 0x3a4236, shininess: 22 });
    const darkMat = new THREE.MeshPhongMaterial({ color: 0x1b1f23, specular: 0x4a525c, shininess: 38 });
    const steelMat = new THREE.MeshPhongMaterial({ color: 0x8f98a2, specular: 0xc2ccd6, shininess: 62 });
    const brassMat = new THREE.MeshPhongMaterial({ color: 0xd9a842, specular: 0xffe49c, shininess: 70 });

    if (id === 'frag_grenade') {
      // M67 Fragmentation Grenade — sculpted olive sphere, equatorial weld seam, steel fuze, curved lever & brass pull-ring
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), oliveMat);
      const weldBand = new THREE.Mesh(new THREE.TorusGeometry(0.0358, 0.0018, 6, 18), darkMat);
      weldBand.rotation.x = Math.PI / 2;
      const stencil = new THREE.Mesh(new THREE.CylinderGeometry(0.0345, 0.0355, 0.007, 16), new THREE.MeshBasicMaterial({ color: 0xd4b946 }));
      stencil.position.set(0, 0.011, 0);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0155, 0.019, 10), steelMat);
      collar.position.set(0, 0.039, 0);
      const fuzeTop = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.010, 0.014), steelMat);
      fuzeTop.position.set(0.004, 0.050, 0);
      const spoonTop = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 0.012), darkMat);
      spoonTop.position.set(0.017, 0.048, 0);
      spoonTop.rotation.z = -0.22;
      const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.050, 0.012), darkMat);
      spoon.position.set(0.028, 0.020, 0);
      spoon.rotation.z = -0.26;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0115, 0.0022, 6, 14), brassMat);
      ring.position.set(-0.019, 0.046, 0);
      g.add(body, weldBand, stencil, collar, fuzeTop, spoonTop, spoon, ring);
      g.userData.pinRing = ring;
    } else if (id === 'throwing_knife') {
      // DMZ Tactical Tanto Throwing Knife — beveled carbon steel blade, honed edge, fuller groove, cord-wrapped handle & pommel ring
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.132, 0.024), darkMat);
      blade.position.set(0, 0.066, 0);
      const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.0056, 0.085, 0.005), steelMat);
      fuller.position.set(0, 0.068, 0.002);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.128, 0.005), steelMat);
      edge.position.set(0, 0.066, -0.012);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.038, 4), darkMat);
      tip.position.set(0, 0.150, 0);
      tip.rotation.y = Math.PI / 4;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.009, 0.032), steelMat);
      guard.position.set(0, 0.002, 0);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.0095, 0.086, 0.018), oliveMat);
      handle.position.set(0, -0.044, 0);
      // Ribbed paracord wrap ridges
      for (let i = 0; i < 4; i++) {
        const cord = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.007, 0.020), darkMat);
        cord.position.set(0, -0.018 - i * 0.018, 0);
        g.add(cord);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0032, 6, 12), darkMat);
      ring.position.set(0, -0.095, 0);
      g.add(blade, fuller, edge, tip, guard, handle, ring);
    } else if (id === 'smoke_grenade') {
      // M18 Colored Smoke Canister
      const canMat = new THREE.MeshPhongMaterial({ color: 0x5c665a, specular: 0x454d44, shininess: 24 });
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.116, 16), canMat);
      const topRim = new THREE.Mesh(new THREE.CylinderGeometry(0.0272, 0.0272, 0.007, 16), darkMat);
      topRim.position.set(0, 0.056, 0);
      const botRim = new THREE.Mesh(new THREE.CylinderGeometry(0.0272, 0.0272, 0.007, 16), darkMat);
      botRim.position.set(0, -0.056, 0);
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.0268, 0.0268, 0.018, 16), new THREE.MeshBasicMaterial({ color: 0xe6c235 }));
      stripe.position.set(0, 0.024, 0);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.019, 10), steelMat);
      cap.position.set(0, 0.066, 0);
      const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.068, 0.010), darkMat);
      spoon.position.set(0.028, 0.026, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0022, 6, 14), brassMat);
      ring.position.set(-0.019, 0.065, 0);
      g.add(can, topRim, botRim, stripe, cap, spoon, ring);
      g.userData.pinRing = ring;
    } else {
      // M84 Concussion / Stun Grenade with hexagonal percussion collars & flash ports
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.106, 14), darkMat);
      const hexTop = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.014, 6), steelMat);
      hexTop.position.set(0, 0.044, 0);
      const hexBot = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.014, 6), steelMat);
      hexBot.position.set(0, -0.044, 0);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0248, 0.0248, 0.016, 14), new THREE.MeshBasicMaterial({ color: 0x3b82d6 }));
      band.position.set(0, 0.018, 0);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.019, 10), steelMat);
      cap.position.set(0, 0.061, 0);
      const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.060, 0.010), steelMat);
      spoon.position.set(0.026, 0.022, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0022, 6, 14), brassMat);
      ring.position.set(-0.019, 0.060, 0);
      g.add(can, hexTop, hexBot, band, cap, spoon, ring);
      g.userData.pinRing = ring;
    }
    return g;
  }

  _buildPrepRig() {
    const rig = new THREE.Group();
    rig.visible = false;

    const brassMat = new THREE.MeshPhongMaterial({ color: 0xd9a842, specular: 0xffe49c, shininess: 70 });

    // Rigged anatomical first-person arms & hands driven via WeaponSystem.fpArms!
    const hand = this.weaponSystem ? this.weaponSystem._createHand(true, 'grenadeHold') : new THREE.Group();
    hand.userData.handStyle = 'grenadeHold';
    const rArm = this.weaponSystem ? this.weaponSystem._createForearm() : new THREE.Group();
    rArm.userData.fpSide = 'right';
    rig.add(hand, rArm);

    const lHand = this.weaponSystem ? this.weaponSystem._createHand(false, 'pinPull') : new THREE.Group();
    lHand.userData.handStyle = 'pinPull';
    const lArm = this.weaponSystem ? this.weaponSystem._createForearm() : new THREE.Group();
    lArm.userData.fpSide = 'left';
    const pulledPin = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0026, 6, 14), brassMat);
    pulledPin.position.set(0.022, 0.012, -0.032);
    lHand.add(pulledPin);
    lHand.visible = false;
    lArm.visible = false;
    rig.add(lHand, lArm);

    this.prepMeshes = {
      frag_grenade: this._createThrowableMesh('frag_grenade'),
      throwing_knife: this._createThrowableMesh('throwing_knife'),
      smoke_grenade: this._createThrowableMesh('smoke_grenade'),
      concussion_grenade: this._createThrowableMesh('concussion_grenade')
    };
    Object.entries(this.prepMeshes).forEach(([id, m]) => {
      m.visible = false;
      m.scale.setScalar(1.36);
      // Seat grenade/knife cleanly inside the anatomical gloved right palm
      if (id === 'throwing_knife') {
        m.position.set(-0.006, 0.018, -0.028);
        m.rotation.set(-0.34, 0.0, 0.0);
      } else {
        m.position.set(-0.010, 0.020, -0.028);
      }
      hand.add(m);
    });

    this.vmCamera.add(rig);
    this.prepRig = rig;
    this.prepHand = hand;
    this.prepRightArm = rArm;
    this.prepLeftHand = lHand;
    this.prepLeftArm = lArm;
    this.prepPulledPin = pulledPin;
  }

  _buildTrajectoryArc() {
    const maxPts = 64;
    const positions = new Float32Array(maxPts * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineDashedMaterial({
      color: 0x69f0ae,
      dashSize: 0.28,
      gapSize: 0.16,
      transparent: true,
      opacity: 0.85
    });
    this.arcLine = new THREE.Line(geo, mat);
    this.arcLine.visible = false;
    this.arcLine.frustumCulled = false;
    this.scene.add(this.arcLine);

    const ringGeo = new THREE.RingGeometry(0.18, 0.28, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x69f0ae,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide
    });
    this.landingRing = new THREE.Mesh(ringGeo, ringMat);
    this.landingRing.visible = false;
    this.scene.add(this.landingRing);
  }

  isBusy() {
    return this.state !== 'idle';
  }

  startPrep(slot, player, weaponSystem) {
    if (this.state !== 'idle') return false;
    if (player && (player.isDowned || player.dead)) return false;
    const itemId = slot === 'lethal' ? player.lethal : player.tactical;
    const qty = slot === 'lethal' ? player.lethalQty : player.tacticalQty;
    const hasEquipped = !!(itemId && GAME_DATA.ITEMS[itemId] && qty > 0);
    if (!hasEquipped) {
      const msg = slot === 'lethal' ? 'NO LETHAL EQUIPPED' : 'NO TACTICAL EQUIPPED';
      if (window.showCenterToast) window.showCenterToast(msg, '#ffca28');
      return false;
    }

    if (weaponSystem) {
      weaponSystem.cancelInspect();
      weaponSystem.cancelPlating();
      weaponSystem.cancelMedkit();
      weaponSystem.cancelReload();
    }

    this.state = 'prep';
    this.activeSlot = slot;
    this.activeItemId = itemId;
    this.holdTime = 0;
    this.cookTime = 0;
    this.pinPullDuration = 0.42;
    this.pinPulled = (itemId === 'throwing_knife');
    this.pinSoundPlayed = false;
    this.lastTickStep = 0;
    this.cookPulse = 0;
    // Restore pin ring on the grenade mesh when starting a fresh prep
    const activeMesh = this.prepMeshes[itemId];
    if (activeMesh && activeMesh.userData.pinRing) {
      activeMesh.userData.pinRing.visible = true;
    }
    return true;
  }

  cancelPrep() {
    if (this.state !== 'prep') return;
    this.state = 'idle';
    this.activeSlot = null;
    this.activeItemId = null;
    this.holdTime = 0;
    this.cookTime = 0;
    this.prepRig.visible = false;
    if (this.prepLeftHand) this.prepLeftHand.visible = false;
    if (this.prepLeftArm) this.prepLeftArm.visible = false;
    this.arcLine.visible = false;
    this.landingRing.visible = false;
  }

  releaseThrow(slot, player, enemyManager, onHitCallback) {
    if (this.state !== 'prep' || this.activeSlot !== slot) return false;
    const itemId = this.activeItemId;
    const def = GAME_DATA.ITEMS[itemId];
    if (!def) {
      this.cancelPrep();
      return false;
    }

    // Consume 1 throwable unless in Dev Mode
    if (!window.DEV_MODE) {
      if (slot === 'lethal') player.lethalQty = Math.max(0, player.lethalQty - 1);
      else player.tacticalQty = Math.max(0, player.tacticalQty - 1);
    }

    const launch = this._getLaunchVectors(def);
    const isKnife = itemId === 'throwing_knife';
    window.soundEngine.playThrowWhoosh(isKnife);

    const mesh = this._createThrowableMesh(itemId);
    mesh.scale.setScalar(isKnife ? 1.45 : 1.35);
    mesh.position.copy(launch.origin);
    if (isKnife) {
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), launch.vel.clone().normalize());
    }
    this.scene.add(mesh);

    const remainingFuse = itemId === 'frag_grenade'
      ? Math.max(0.05, def.fuseTime - this.cookTime)
      : (def.fuseTime || 0);

    this.projectiles.push({
      id: itemId,
      def,
      mesh,
      pos: launch.origin.clone(),
      vel: launch.vel.clone(),
      fuse: remainingFuse,
      isKnife,
      stuck: false,
      stuckTime: 0,
      stuckLife: 240.0,
      bounces: 0,
      onHitCallback
    });

    this.state = 'throwing';
    this.throwAnimTimer = this.throwAnimDuration;
    this.arcLine.visible = false;
    this.landingRing.visible = false;
    return true;
  }

  _getLaunchVectors(def) {
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    this.camera.getWorldDirection(dir);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    origin.addScaledVector(dir, 0.35).addScaledVector(right, 0.14);

    const isKnife = def.id === 'throwing_knife';
    const launchDir = dir.clone();
    launchDir.y += isKnife ? 0.045 : 0.16;
    launchDir.normalize();

    return {
      origin,
      vel: launchDir.multiplyScalar(def.throwSpeed || 17.0)
    };
  }

  _updateTrajectoryPreview(def) {
    if (!def) return;
    const launch = this._getLaunchVectors(def);
    const pos = launch.origin.clone();
    const vel = launch.vel.clone();
    const stepDt = 0.045;
    const maxPts = 64;
    const arr = this.arcLine.geometry.attributes.position.array;

    let count = 0;
    let hitPoint = null;
    const isKnife = def.id === 'throwing_knife';

    for (let i = 0; i < maxPts; i++) {
      arr[i * 3] = pos.x;
      arr[i * 3 + 1] = pos.y;
      arr[i * 3 + 2] = pos.z;
      count = i + 1;

      const nextVel = vel.clone();
      nextVel.y -= this.GRAVITY * stepDt;
      const nextPos = pos.clone().addScaledVector(nextVel, stepDt);

      // Terrain-aware ground check across rolling 1240m elevation
      const groundY = (this.world && this.world.getTerrainHeight)
        ? this.world.getTerrainHeight(nextPos.x, nextPos.z)
        : 0;
      const floorY = groundY + 0.06;
      if (nextPos.y <= floorY) {
        const t = (pos.y - floorY) / Math.max(0.001, pos.y - nextPos.y);
        hitPoint = pos.clone().lerp(nextPos, THREE.MathUtils.clamp(t, 0, 1));
        hitPoint.y = groundY + 0.08;
        if (i + 1 < maxPts) {
          arr[(i + 1) * 3] = hitPoint.x;
          arr[(i + 1) * 3 + 1] = hitPoint.y;
          arr[(i + 1) * 3 + 2] = hitPoint.z;
          count = i + 2;
        }
        break;
      }

      // World collider hit check
      if (this._pointHitsCollider(nextPos, 0.08)) {
        hitPoint = pos.clone();
        break;
      }

      pos.copy(nextPos);
      vel.copy(nextVel);
    }

    this.arcLine.geometry.setDrawRange(0, count);
    this.arcLine.geometry.attributes.position.needsUpdate = true;
    this.arcLine.computeLineDistances();

    // Color-code arc: warm amber/red when cooking frag, crisp cyan for tactical, bright green for knife
    const colorHex = def.id === 'frag_grenade'
      ? (this.cookTime > 3.2 ? 0xff4444 : 0xf5a623)
      : (isKnife ? 0x69f0ae : 0x64b5f6);
    this.arcLine.material.color.setHex(colorHex);
    this.landingRing.material.color.setHex(colorHex);

    this.arcLine.visible = true;
    if (hitPoint) {
      this.landingRing.position.set(hitPoint.x, hitPoint.y, hitPoint.z);
      this.landingRing.visible = true;
    } else {
      this.landingRing.visible = false;
    }
  }

  _pointHitsCollider(p, r = 0.08) {
    if (!this.world || !this.world.colliders) return false;
    const list = this.world.getNearbyColliders ? this.world.getNearbyColliders(p.x, p.z, r + 0.5) : this.world.colliders;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (p.y + r > c.minY && p.y - r < c.maxY &&
          p.x + r > c.minX && p.x - r < c.maxX &&
          p.z + r > c.minZ && p.z - r < c.maxZ) {
        return c;
      }
    }
    return null;
  }

  _detonateFrag(pos, player, enemyManager, onHitCallback) {
    const distToPlayer = pos.distanceTo(player.position);
    const dx = pos.x - player.position.x;
    const dz = pos.z - player.position.z;
    const len = Math.hypot(dx, dz) || 1;
    const pan = (dx / len) * Math.cos(player.yaw) - (dz / len) * Math.sin(player.yaw);
    window.soundEngine.playExplosion(distToPlayer, { pan });

    // Visual explosion flash + blast sphere (no dynamic PointLight to avoid WebGL shader recompile stutter!)
    const light = null;

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xff9933, transparent: true, opacity: 0.92 })
    );
    sphere.position.copy(pos).add(new THREE.Vector3(0, 0.35, 0));
    this.scene.add(sphere);

    this.effects.push({ type: 'blast', light, mesh: sphere, life: 0.55, maxLife: 0.55, maxScale: 6.5 });

    // Damage enemies in blast radius
    const radius = 9.0;
    if (enemyManager && enemyManager.enemies) {
      for (const e of enemyManager.enemies) {
        if (e.dead) continue;
        const d = e.position.distanceTo(pos);
        if (d < radius) {
          const falloff = 1 - (d / radius) * 0.78;
          const dmg = Math.round(145 * falloff);
          const attackerInfo = { name: 'YOU', isPlayer: true, weaponId: 'frag_grenade', weaponName: 'M67 Frag' };
          const killed = e.takeDamage(dmg, pos, attackerInfo);
          if (onHitCallback) onHitCallback(false, killed, e, attackerInfo);
        } else if (d < 34) {
          e.alertToPosition(pos);
        }
      }
    }

    // Self-damage if too close
    if (distToPlayer < radius * 0.85) {
      const falloff = 1 - (distToPlayer / (radius * 0.85));
      player.takeDamage(Math.round(95 * falloff));
    }
  }

  _deploySmoke(pos) {
    window.soundEngine.playSmokeHiss();
    const smokeGroup = new THREE.Group();
    smokeGroup.position.copy(pos);

    const puffs = [];
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x9aa29c, transparent: true, opacity: 0.0 });
    for (let i = 0; i < 14; i++) {
      const mat = baseMat.clone();
      const rad = 1.6 + Math.random() * 1.4;
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(rad, 1), mat);
      const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.5;
      const dist = i < 3 ? Math.random() * 1.0 : 1.6 + Math.random() * 2.8;
      puff.position.set(Math.cos(ang) * dist, 1.0 + Math.random() * 2.4, Math.sin(ang) * dist);
      puff.scale.setScalar(0.15);
      smokeGroup.add(puff);
      puffs.push({ mesh: puff, targetScale: 1.0 + Math.random() * 0.35, rotSpeed: (Math.random() - 0.5) * 0.4 });
    }
    this.scene.add(smokeGroup);

    const smokeEntry = { pos: pos.clone(), radius: 6.5, active: true };
    if (this.world && this.world.activeSmokes) {
      this.world.activeSmokes.push(smokeEntry);
    }

    this.effects.push({
      type: 'smoke',
      group: smokeGroup,
      puffs,
      smokeEntry,
      life: 28.0,
      maxLife: 28.0
    });
  }

  _detonateConcussion(pos, player, enemyManager) {
    const distToPlayer = pos.distanceTo(player.position);
    window.soundEngine.playConcussion(distToPlayer);

    const light = null;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.7, 24),
      new THREE.MeshBasicMaterial({ color: 0xbbeeff, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(pos).add(new THREE.Vector3(0, 0.2, 0));
    this.scene.add(ring);

    this.effects.push({ type: 'concussion', light, mesh: ring, life: 0.42, maxLife: 0.42, maxScale: 12.0 });

    const radius = 9.5;
    if (enemyManager && enemyManager.enemies) {
      for (const e of enemyManager.enemies) {
        if (e.dead) continue;
        const d = e.position.distanceTo(pos);
        if (d < radius) {
          if (e.stun) e.stun(5.0);
        } else if (d < 28) {
          e.alertToPosition(pos);
        }
      }
    }
  }

  update(dt, player, weaponSystem, enemyManager, onHitCallback, onPickupCallback = null) {
    // Decay crosshair cook pulse
    if (this.cookPulse > 0) {
      this.cookPulse = Math.max(0, this.cookPulse - dt * 3.6);
    }

    // Track 3P/MP throwable animation state on player
    if (player) {
      player._isThrowing = (this.state === 'prep' || this.state === 'throwing');
      if (this.state === 'prep') {
        player._throwProgress = Math.min(0.45, this.holdTime * 0.65);
      } else if (this.state === 'throwing') {
        const tt = THREE.MathUtils.clamp(1 - (this.throwAnimTimer / this.throwAnimDuration), 0, 1);
        player._throwProgress = 0.45 + tt * 0.55;
      } else {
        player._throwProgress = 0;
      }
    }

    // MW19 snappy spring easing helpers
    const smooth = (t) => t * t * (3 - 2 * t);
    const easeOutBack = (t) => {
      const c1 = 1.65;
      const c3 = c1 + 1;
      const x = THREE.MathUtils.clamp(t, 0, 1) - 1;
      return 1 + c3 * x * x * x + c1 * x * x;
    };

    // === UPDATE FIRST-PERSON PREP / COOK / THROW ANIMATION ===
    if (this.state === 'prep') {
      this.holdTime += dt;
      const def = GAME_DATA.ITEMS[this.activeItemId];
      const isFrag = this.activeItemId === 'frag_grenade';
      const isKnife = this.activeItemId === 'throwing_knife';

      if (weaponSystem) weaponSystem.viewmodelGroup.visible = false;
      this.prepRig.visible = !player.isThirdPerson;

      // Show only the active throwable mesh
      Object.entries(this.prepMeshes).forEach(([k, m]) => {
        m.visible = (k === this.activeItemId);
      });

      const activeMesh = this.prepMeshes[this.activeItemId];
      if (isKnife) {
        if (this.prepHand && this.prepHand.userData) this.prepHand.userData.activeStyle = 'knifeHold';
        if (this.prepLeftHand) this.prepLeftHand.visible = false;
        if (this.prepLeftArm) this.prepLeftArm.visible = false;
        const readyT = easeOutBack(Math.min(1, this.holdTime / 0.16));
        const breathe = Math.sin(this.holdTime * 3.4) * 0.004;
        // Raise throwing knife high into a crisp MW19 cocked-back overhand ready-to-throw stance
        this.prepHand.position.set(
          THREE.MathUtils.lerp(0.29, 0.18, readyT),
          THREE.MathUtils.lerp(-0.26, 0.07, readyT) + breathe,
          THREE.MathUtils.lerp(-0.28, -0.33, readyT)
        );
        this.prepHand.rotation.set(THREE.MathUtils.lerp(-0.18, -0.44, readyT), -0.16, 0.20);
      } else {
        if (this.prepHand && this.prepHand.userData) this.prepHand.userData.activeStyle = 'grenadeHold';
        if (this.prepLeftHand && this.prepLeftHand.userData) this.prepLeftHand.userData.activeStyle = 'pinPull';
        // Phase A (0..pinPullDuration): Bring grenade center-right, hook pin, snap-yank pin off with left hand
        // Phase B (pinPullDuration+): Pin is removed -> crisp cock-back windup & 5s cook timer on frag
        if (this.holdTime < this.pinPullDuration) {
          const pp = this.holdTime / this.pinPullDuration;
          const raiseT = easeOutBack(Math.min(1, pp / 0.34));
          // Brief tactile hook beat (0.34..0.42) then explosive yank left-down (0.42..1.0)
          const yankRaw = pp > 0.40 ? Math.min(1, (pp - 0.40) / 0.52) : 0;
          const yankT = yankRaw > 0 ? easeOutBack(yankRaw) : 0;
          const detached = pp > 0.42;
          // Crisp recoil kick on the right hand the instant the pin pops free
          const popKick = (pp > 0.40 && pp < 0.62) ? Math.sin(((pp - 0.40) / 0.22) * Math.PI) : 0;

          if (pp > 0.41 && !this.pinSoundPlayed) {
            this.pinSoundPlayed = true;
            window.soundEngine.playPinPull();
          }

          // Remove actual pin ring from the grenade the moment the left hand pulls it!
          if (activeMesh && activeMesh.userData.pinRing) {
            activeMesh.userData.pinRing.visible = !detached;
          }

          this.prepHand.position.set(
            THREE.MathUtils.lerp(0.24, 0.09, raiseT) + yankT * 0.045 + popKick * 0.018,
            THREE.MathUtils.lerp(-0.26, -0.09, raiseT) + popKick * 0.010,
            THREE.MathUtils.lerp(-0.35, -0.31, raiseT)
          );
          this.prepHand.rotation.set(0.22 + popKick * 0.12, -0.22, 0.16 - yankT * 0.14 - popKick * 0.16);

          if (this.prepLeftHand) {
            this.prepLeftHand.visible = true;
            if (this.prepLeftArm) this.prepLeftArm.visible = true;
            if (this.prepPulledPin) this.prepPulledPin.visible = detached;
            this.prepLeftHand.position.set(
              THREE.MathUtils.lerp(-0.18, 0.02, raiseT) - yankT * 0.24,
              THREE.MathUtils.lerp(-0.26, -0.045, raiseT) - yankT * 0.13,
              -0.31 + yankT * 0.05
            );
            this.prepLeftHand.rotation.set(0.14, 0.28 + yankT * 0.38, -0.24 - yankT * 0.34);
          }
        } else {
          this.pinPulled = true;
          if (activeMesh && activeMesh.userData.pinRing) activeMesh.userData.pinRing.visible = false;
          if (this.prepLeftHand) this.prepLeftHand.visible = false;
          if (this.prepLeftArm) this.prepLeftArm.visible = false;
          const postT = easeOutBack(Math.min(1, (this.holdTime - this.pinPullDuration) / 0.18));
          const cookShake = isFrag ? Math.sin(this.cookTime * 28) * Math.min(0.008, this.cookTime * 0.0020) : 0;
          const cookRoll = isFrag ? Math.cos(this.cookTime * 22) * Math.min(0.04, this.cookTime * 0.01) : 0;
          this.prepHand.position.set(
            THREE.MathUtils.lerp(0.135, 0.20, postT) + cookShake,
            THREE.MathUtils.lerp(-0.09, -0.04, postT) + Math.abs(cookShake) * 0.5,
            THREE.MathUtils.lerp(-0.31, -0.27, postT)
          );
          this.prepHand.rotation.set(0.34, -0.26, 0.20 + cookRoll);
        }
      }

      // Aim rigged anatomical forearms (setting _currentAimHand so RiggedFPArms tracks exact wrist & grip style!)
      if (this.weaponSystem && this.prepRightArm) {
        const rShoulder = new THREE.Vector3(0.30, -0.32, -0.02);
        const rWrist = this.prepHand.position.clone().add(new THREE.Vector3(0.012, -0.012, 0.040));
        this.weaponSystem._currentAimHand = this.prepHand;
        this.weaponSystem._aimArm(this.prepRightArm, rShoulder, rWrist);
        this.weaponSystem._currentAimHand = null;
      }
      if (this.weaponSystem && this.prepLeftArm && this.prepLeftHand && this.prepLeftHand.visible) {
        const lShoulder = new THREE.Vector3(-0.30, -0.32, -0.02);
        const lWrist = this.prepLeftHand.position.clone().add(new THREE.Vector3(-0.012, -0.012, 0.040));
        this.weaponSystem._currentAimHand = this.prepLeftHand;
        this.weaponSystem._aimArm(this.prepLeftArm, lShoulder, lWrist);
        this.weaponSystem._currentAimHand = null;
      }

      // Show live 3D trajectory arc immediately when holding throwing knife (or past brief tap for grenades)
      if (isKnife || this.holdTime >= 0.08) {
        this._updateTrajectoryPreview(def);
      }

      // 5-second Frag Grenade cooking starts ONLY AFTER the pin is pulled!
      if (isFrag && this.pinPulled) {
        this.cookTime += dt;
        const tickStep = this.cookTime < 3.0
          ? Math.floor(this.cookTime)
          : 3 + Math.floor((this.cookTime - 3.0) / 0.5);
        if (tickStep > this.lastTickStep && this.cookTime < 5.0) {
          this.lastTickStep = tickStep;
          this.cookPulse = 1.0;
          window.soundEngine.playCookTick(this.cookTime >= 3.0);
        }
        if (this.cookTime >= 5.0) {
          // Overcooked! Detonates in hand!
          const handWorld = new THREE.Vector3();
          this.camera.getWorldPosition(handWorld);
          if (!window.DEV_MODE) player.lethalQty = Math.max(0, player.lethalQty - 1);
          this.cancelPrep();
          if (weaponSystem && !player.isThirdPerson) weaponSystem.viewmodelGroup.visible = true;
          this._detonateFrag(handWorld, player, enemyManager, onHitCallback);
        }
      }
    } else if (this.state === 'throwing') {
      this.throwAnimTimer -= dt;
      const t = THREE.MathUtils.clamp(1 - (this.throwAnimTimer / this.throwAnimDuration), 0, 1);
      if (weaponSystem) weaponSystem.viewmodelGroup.visible = false;
      this.prepRig.visible = !player.isThirdPerson;
      if (this.prepLeftHand) this.prepLeftHand.visible = false;
      if (this.prepLeftArm) this.prepLeftArm.visible = false;
      Object.values(this.prepMeshes).forEach((m) => { m.visible = false; });

      // MW19 explosive overhand whip + open-hand fingers-splayed follow-through!
      if (this.prepHand && this.prepHand.userData) {
        this.prepHand.userData.activeStyle = t > 0.16 ? 'throwRelease' : (this.activeItemId === 'throwing_knife' ? 'knifeHold' : 'grenadeHold');
      }
      const whip = smooth(Math.min(1, t / 0.72));
      const settle = t > 0.72 ? smooth((t - 0.72) / 0.28) : 0;
      const arcLift = Math.sin(whip * Math.PI) * 0.085;
      this.prepHand.position.set(
        THREE.MathUtils.lerp(0.20, -0.02, whip) + settle * 0.04,
        THREE.MathUtils.lerp(0.02, -0.27, whip) + arcLift - settle * 0.03,
        THREE.MathUtils.lerp(-0.27, -0.49, whip) + settle * 0.06
      );
      this.prepHand.rotation.set(
        THREE.MathUtils.lerp(0.30, -0.78, whip),
        THREE.MathUtils.lerp(-0.24, 0.16, whip),
        THREE.MathUtils.lerp(0.18, -0.22, whip)
      );
      if (this.weaponSystem && this.prepRightArm) {
        const rShoulder = new THREE.Vector3(0.30, -0.32, -0.02);
        const rWrist = this.prepHand.position.clone().add(new THREE.Vector3(0.012, -0.012, 0.040));
        this.weaponSystem._currentAimHand = this.prepHand;
        this.weaponSystem._aimArm(this.prepRightArm, rShoulder, rWrist);
        this.weaponSystem._currentAimHand = null;
      }

      if (this.throwAnimTimer <= 0) {
        this.state = 'idle';
        this.activeSlot = null;
        this.activeItemId = null;
        this.prepRig.visible = false;
        if (weaponSystem && !player.isThirdPerson) weaponSystem.viewmodelGroup.visible = true;
      }
    } else {
      this.prepRig.visible = false;
      this.arcLine.visible = false;
      this.landingRing.visible = false;
    }

    // === UPDATE LIVE THROWN PROJECTILES ===
    const enemyMeshes = enemyManager ? enemyManager.getHitboxMeshes() : [];
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];

      if (pr.stuck) {
        pr.stuckTime = (pr.stuckTime || 0) + dt;
        pr.stuckLife -= dt;
        // Auto-retrieve stuck throwing knife when player walks up to it!
        if (pr.isKnife && pr.stuckTime > 0.35 && player) {
          const dx = player.position.x - pr.pos.x;
          const dz = player.position.z - pr.pos.z;
          const distXZ = Math.hypot(dx, dz);
          const feetY = player.position.y - player.currentEyeHeight;
          if (distXZ < 1.75 && Math.abs(pr.pos.y - feetY) < 2.2) {
            if (player.lethal === 'throwing_knife') {
              player.lethalQty = Math.min(4, (player.lethalQty || 0) + 1);
            }
            window.soundEngine.playMagIn();
            if (onPickupCallback) onPickupCallback('Throwing Knife');
            this.scene.remove(pr.mesh);
            this.projectiles.splice(i, 1);
            continue;
          }
        }
        if (pr.stuckLife <= 0) {
          this.scene.remove(pr.mesh);
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      const prevPos = pr.pos.clone();
      pr.vel.y -= this.GRAVITY * dt;
      const nextPos = pr.pos.clone().addScaledVector(pr.vel, dt);

      // Throwing knife enemy hit check (continuous segment raycast!)
      if (pr.isKnife && enemyMeshes.length > 0) {
        const seg = nextPos.clone().sub(prevPos);
        const segLen = seg.length();
        if (segLen > 0.001) {
          this._ray.set(prevPos, seg.normalize());
          this._ray.near = 0;
          this._ray.far = segLen + 0.12;
          const hits = this._ray.intersectObjects(enemyMeshes, false);
          if (hits.length > 0) {
            const h = hits[0];
            const enemy = h.object.userData.enemy;
            const isHead = !!h.object.userData.isHead;
            if (enemy && !enemy.dead) {
              const dmg = isHead ? 220 : pr.def.damage;
              const attackerInfo = { name: 'YOU', isPlayer: true, weaponId: 'throwing_knife', weaponName: 'Throwing Knife' };
              const killed = enemy.takeDamage(dmg, prevPos, attackerInfo);
              if (pr.onHitCallback) pr.onHitCallback(isHead, killed, enemy, attackerInfo);
              // Drop knife at impact spot on the ground so player can walk up and retrieve it!
              pr.pos.set(h.point.x, 0.12, h.point.z);
              pr.mesh.position.copy(pr.pos);
              pr.mesh.rotation.set(Math.PI / 2, Math.random() * Math.PI, 0);
              pr.stuck = true;
              pr.stuckTime = 0;
              continue;
            }
          }
        }
      }

      // Proper 3-axis separated collision (floors, ceilings, walls, crates & ground) with throttled bounce sound
      const r = 0.08;
      const nowMs = performance.now();
      const tryBounceSound = (impactSpeed) => {
        if (impactSpeed < 1.35 || pr.bounces >= 6) return;
        if (nowMs - (pr.lastBounceSound || 0) < 130) return;
        pr.lastBounceSound = nowMs;
        pr.bounces += 1;
        window.soundEngine.playGrenadeBounce();
      };

      const terrainY = (this.world && this.world.getTerrainHeight)
        ? this.world.getTerrainHeight(nextPos.x, nextPos.z)
        : 0;
      const floorY = terrainY + 0.07;

      if (pr.isKnife) {
        if (nextPos.y <= floorY || this._pointHitsCollider(nextPos, r)) {
          pr.pos.copy(nextPos.y <= floorY ? new THREE.Vector3(nextPos.x, floorY, nextPos.z) : prevPos);
          pr.mesh.position.copy(pr.pos);
          pr.stuck = true;
          tryBounceSound(pr.vel.length());
          continue;
        }
      } else {
        const resolved = prevPos.clone();

        // 1. X axis
        resolved.x = nextPos.x;
        const hitX = this._pointHitsCollider(resolved, r);
        if (hitX) {
          const impX = Math.abs(pr.vel.x);
          resolved.x = prevPos.x;
          pr.vel.x = -pr.vel.x * 0.42;
          pr.vel.z *= 0.82;
          tryBounceSound(impX);
        }

        // 2. Z axis
        resolved.z = nextPos.z;
        const hitZ = this._pointHitsCollider(resolved, r);
        if (hitZ) {
          const impZ = Math.abs(pr.vel.z);
          resolved.z = prevPos.z;
          pr.vel.z = -pr.vel.z * 0.42;
          pr.vel.x *= 0.82;
          tryBounceSound(impZ);
        }

        // 3. Y axis (ground plane, building floors/crates, or ceilings!)
        resolved.y = nextPos.y;
        const hitY = this._pointHitsCollider(resolved, r);
        if (hitY) {
          const impY = Math.abs(pr.vel.y);
          if (pr.vel.y <= 0) {
            // Landed on top of a floor/crate/roof
            resolved.y = hitY.maxY + r + 0.005;
            pr.vel.y = impY > 0.85 ? -pr.vel.y * 0.36 : 0;
            pr.vel.x *= 0.72;
            pr.vel.z *= 0.72;
            if (Math.hypot(pr.vel.x, pr.vel.z) < 0.18 && pr.vel.y === 0) {
              pr.vel.x = 0;
              pr.vel.z = 0;
            }
          } else {
            // Hit ceiling from below
            resolved.y = hitY.minY - r - 0.005;
            pr.vel.y = -pr.vel.y * 0.35;
          }
          tryBounceSound(impY);
        } else if (resolved.y <= floorY) {
          const impY = Math.abs(pr.vel.y);
          resolved.y = floorY;
          pr.vel.y = impY > 0.85 ? -pr.vel.y * 0.36 : 0;
          pr.vel.x *= 0.72;
          pr.vel.z *= 0.72;
          if (Math.hypot(pr.vel.x, pr.vel.z) < 0.18 && pr.vel.y === 0) {
            pr.vel.x = 0;
            pr.vel.z = 0;
          }
          tryBounceSound(impY);
        }

        nextPos.copy(resolved);
      }

      pr.pos.copy(nextPos);
      pr.mesh.position.copy(pr.pos);

      if (pr.isKnife) {
        pr.mesh.rotation.x += dt * 16; // spinning throwing knife in flight!
      } else {
        pr.mesh.rotation.x += dt * 7;
        pr.mesh.rotation.z += dt * 5;
        pr.fuse -= dt;
        if (pr.fuse <= 0) {
          this.scene.remove(pr.mesh);
          this.projectiles.splice(i, 1);
          if (pr.id === 'frag_grenade') {
            this._detonateFrag(pr.pos, player, enemyManager, pr.onHitCallback);
          } else if (pr.id === 'smoke_grenade') {
            this._deploySmoke(pr.pos);
          } else if (pr.id === 'concussion_grenade') {
            this._detonateConcussion(pr.pos, player, enemyManager);
          }
        }
      }
    }

    // === UPDATE ACTIVE EFFECTS (BLASTS, CONCUSSIONS, SMOKE CLOUDS) ===
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.life -= dt;
      const p = THREE.MathUtils.clamp(1 - (fx.life / fx.maxLife), 0, 1);

      if (fx.type === 'blast' || fx.type === 'concussion') {
        const s = 1 + p * fx.maxScale;
        fx.mesh.scale.setScalar(s);
        fx.mesh.material.opacity = Math.max(0, (1 - p) * 0.85);
        if (fx.light) fx.light.intensity = Math.max(0, (1 - p) * 9);
        if (fx.life <= 0) {
          this.scene.remove(fx.mesh);
          if (fx.mesh.geometry) fx.mesh.geometry.dispose();
          if (fx.mesh.material) fx.mesh.material.dispose();
          if (fx.light) this.scene.remove(fx.light);
          this.effects.splice(i, 1);
        }
      } else if (fx.type === 'smoke') {
        const bloom = Math.min(1, p / 0.08);
        const fade = fx.life < 4.5 ? Math.max(0, fx.life / 4.5) : 1.0;
        for (const pf of fx.puffs) {
          pf.mesh.scale.setScalar(THREE.MathUtils.lerp(0.2, pf.targetScale, bloom));
          pf.mesh.rotation.y += pf.rotSpeed * dt;
          pf.mesh.material.opacity = 0.78 * bloom * fade;
        }
        if (fx.life <= 0) {
          if (fx.smokeEntry) fx.smokeEntry.active = false;
          if (this.world && this.world.activeSmokes) {
            const idx = this.world.activeSmokes.indexOf(fx.smokeEntry);
            if (idx >= 0) this.world.activeSmokes.splice(idx, 1);
          }
          this.scene.remove(fx.group);
          this.effects.splice(i, 1);
        }
      }
    }
  }
}
