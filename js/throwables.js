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
    const oliveMat = new THREE.MeshLambertMaterial({ color: 0x45503b });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x1b1e21 });
    const steelMat = new THREE.MeshLambertMaterial({ color: 0x8b939c });
    const brassMat = new THREE.MeshLambertMaterial({ color: 0xd4a442 });

    if (id === 'frag_grenade') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), oliveMat);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.018, 8), steelMat);
      collar.position.set(0, 0.038, 0);
      const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.048, 0.012), darkMat);
      spoon.position.set(0.022, 0.018, 0);
      spoon.rotation.z = -0.35;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.010, 0.002, 6, 12), brassMat);
      ring.position.set(-0.018, 0.042, 0);
      g.add(body, collar, spoon, ring);
      g.userData.pinRing = ring;
    } else if (id === 'throwing_knife') {
      // Tactical tanto blade + paracord handle + pommel ring
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.13, 0.024), darkMat);
      blade.position.set(0, 0.065, 0);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.125, 0.005), steelMat);
      edge.position.set(0, 0.065, -0.012);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.036, 4), darkMat);
      tip.position.set(0, 0.148, 0);
      tip.rotation.y = Math.PI / 4;
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.085, 0.018), oliveMat);
      handle.position.set(0, -0.042, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.003, 6, 10), darkMat);
      ring.position.set(0, -0.092, 0);
      g.add(blade, edge, tip, handle, ring);
    } else if (id === 'smoke_grenade') {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.115, 12), new THREE.MeshLambertMaterial({ color: 0x5c645a }));
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.0268, 0.0268, 0.018, 12), new THREE.MeshBasicMaterial({ color: 0xe6c235 }));
      stripe.position.set(0, 0.024, 0);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.018, 8), steelMat);
      cap.position.set(0, 0.064, 0);
      const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.065, 0.010), darkMat);
      spoon.position.set(0.026, 0.025, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.010, 0.002, 6, 12), brassMat);
      ring.position.set(-0.018, 0.062, 0);
      g.add(can, stripe, cap, spoon, ring);
      g.userData.pinRing = ring;
    } else {
      // M84 Concussion / Stun Grenade
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.105, 12), darkMat);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0248, 0.0248, 0.016, 12), new THREE.MeshBasicMaterial({ color: 0x3b82d6 }));
      band.position.set(0, 0.02, 0);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.018, 8), steelMat);
      cap.position.set(0, 0.060, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.010, 0.002, 6, 12), brassMat);
      ring.position.set(-0.018, 0.058, 0);
      g.add(can, band, cap, ring);
      g.userData.pinRing = ring;
    }
    return g;
  }

  _buildPrepRig() {
    const rig = new THREE.Group();
    rig.visible = false;

    const brassMat = new THREE.MeshLambertMaterial({ color: 0xd4a442 });

    // Use the exact detailed tactical gloved hands & forearms from WeaponSystem!
    const hand = this.weaponSystem ? this.weaponSystem._createHand(true, 'grip') : new THREE.Group();
    hand.scale.setScalar(1.22);
    const rArm = this.weaponSystem ? this.weaponSystem._createForearm() : new THREE.Group();
    rArm.scale.set(1.18, 1.18, 1.0);
    rig.add(hand, rArm);

    const lHand = this.weaponSystem ? this.weaponSystem._createHand(false, 'supportPistol') : new THREE.Group();
    lHand.scale.setScalar(1.20);
    const lArm = this.weaponSystem ? this.weaponSystem._createForearm() : new THREE.Group();
    lArm.scale.set(1.18, 1.18, 1.0);
    const pulledPin = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0026, 6, 12), brassMat);
    pulledPin.position.set(0.024, 0.014, -0.028);
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
      m.scale.setScalar(1.25);
      // Seat grenade/knife cleanly inside the right gloved palm
      if (id === 'throwing_knife') {
        m.position.set(-0.006, 0.015, -0.022);
      } else {
        m.position.set(-0.012, 0.025, -0.024);
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
    const maxPts = 48;
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
    const itemId = slot === 'lethal' ? player.lethal : player.tactical;
    const qty = slot === 'lethal' ? player.lethalQty : player.tacticalQty;
    if (!itemId || (!window.DEV_MODE && qty <= 0)) return false;

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
    const maxPts = 48;
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

      // Ground check
      if (nextPos.y <= 0.06) {
        const t = (pos.y - 0.06) / Math.max(0.001, pos.y - nextPos.y);
        hitPoint = pos.clone().lerp(nextPos, THREE.MathUtils.clamp(t, 0, 1));
        hitPoint.y = 0.05;
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
      this.landingRing.position.set(hitPoint.x, Math.max(0.05, hitPoint.y), hitPoint.z);
      this.landingRing.visible = true;
    } else {
      this.landingRing.visible = false;
    }
  }

  _pointHitsCollider(p, r = 0.08) {
    if (!this.world || !this.world.colliders) return false;
    for (const c of this.world.colliders) {
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
    window.soundEngine.playExplosion(distToPlayer);

    // Visual explosion flash + blast sphere + sparks
    const light = new THREE.PointLight(0xff8822, 9, 22);
    light.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0));
    this.scene.add(light);

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
          const killed = e.takeDamage(dmg, pos);
          if (onHitCallback) {
            onHitCallback(false, killed, e, {
              damage: dmg,
              weaponName: 'FRAG',
              distance: player ? player.position.distanceTo(e.position) : d,
              isLethal: true
            });
          }
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

    const light = new THREE.PointLight(0x88ddff, 10, 20);
    light.position.copy(pos).add(new THREE.Vector3(0, 0.5, 0));
    this.scene.add(light);

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

      // Position hand: throwing knife raised up ready; grenades animate left-hand pin pull BEFORE becoming live!
      const smooth = (t) => t * t * (3 - 2 * t);
      const activeMesh = this.prepMeshes[this.activeItemId];
      if (isKnife) {
        if (this.prepLeftHand) this.prepLeftHand.visible = false;
        if (this.prepLeftArm) this.prepLeftArm.visible = false;
        const readyT = smooth(Math.min(1, this.holdTime / 0.16));
        this.prepHand.position.set(
          THREE.MathUtils.lerp(0.28, 0.20, readyT),
          THREE.MathUtils.lerp(-0.26, 0.02, readyT),
          THREE.MathUtils.lerp(-0.28, -0.34, readyT)
        );
        this.prepHand.rotation.set(THREE.MathUtils.lerp(-0.4, 0.22, readyT), -0.18, 0.12);
      } else {
        // Phase A (0..pinPullDuration): Bring grenade center-right & yank actual pin off with left hand (NOT live yet!)
        // Phase B (pinPullDuration+): Pin is removed -> pull back to throw & start 5s cook timer on frag!
        if (this.holdTime < this.pinPullDuration) {
          const pp = this.holdTime / this.pinPullDuration;
          const raiseT = smooth(Math.min(1, pp / 0.35));
          const yankT = pp > 0.35 ? smooth((pp - 0.35) / 0.65) : 0;
          const detached = pp > 0.36;

          if (pp > 0.38 && !this.pinSoundPlayed) {
            this.pinSoundPlayed = true;
            window.soundEngine.playPinPull();
          }

          // Remove actual pin ring from the grenade the moment the left hand pulls it!
          if (activeMesh && activeMesh.userData.pinRing) {
            activeMesh.userData.pinRing.visible = !detached;
          }

          this.prepHand.position.set(
            THREE.MathUtils.lerp(0.24, 0.09, raiseT) + yankT * 0.04,
            THREE.MathUtils.lerp(-0.26, -0.09, raiseT),
            THREE.MathUtils.lerp(-0.34, -0.30, raiseT)
          );
          this.prepHand.rotation.set(0.22, -0.20, 0.15 - yankT * 0.12);

          if (this.prepLeftHand) {
            this.prepLeftHand.visible = true;
            if (this.prepLeftArm) this.prepLeftArm.visible = true;
            if (this.prepPulledPin) this.prepPulledPin.visible = detached;
            this.prepLeftHand.position.set(
              THREE.MathUtils.lerp(-0.18, 0.03, raiseT) - yankT * 0.26,
              THREE.MathUtils.lerp(-0.26, -0.04, raiseT) - yankT * 0.12,
              -0.30 + yankT * 0.04
            );
            this.prepLeftHand.rotation.set(0.15, 0.30 + yankT * 0.35, -0.25 - yankT * 0.30);
          }
        } else {
          this.pinPulled = true;
          if (activeMesh && activeMesh.userData.pinRing) activeMesh.userData.pinRing.visible = false;
          if (this.prepLeftHand) this.prepLeftHand.visible = false;
          if (this.prepLeftArm) this.prepLeftArm.visible = false;
          const postT = smooth(Math.min(1, (this.holdTime - this.pinPullDuration) / 0.18));
          const cookShake = isFrag ? Math.sin(this.cookTime * 24) * Math.min(0.008, this.cookTime * 0.0018) : 0;
          this.prepHand.position.set(
            THREE.MathUtils.lerp(0.13, 0.19, postT) + cookShake,
            THREE.MathUtils.lerp(-0.09, -0.05, postT),
            THREE.MathUtils.lerp(-0.30, -0.27, postT)
          );
          this.prepHand.rotation.set(0.32, -0.25, 0.18);
        }
      }

      // Aim detailed forearms from shoulders to wrist cuffs
      if (this.weaponSystem && this.prepRightArm) {
        const rShoulder = new THREE.Vector3(0.30, -0.32, -0.02);
        const rWrist = this.prepHand.position.clone().add(new THREE.Vector3(0.012, -0.012, 0.040));
        this.weaponSystem._aimArm(this.prepRightArm, rShoulder, rWrist);
      }
      if (this.weaponSystem && this.prepLeftArm && this.prepLeftHand && this.prepLeftHand.visible) {
        const lShoulder = new THREE.Vector3(-0.30, -0.32, -0.02);
        const lWrist = this.prepLeftHand.position.clone().add(new THREE.Vector3(-0.012, -0.012, 0.040));
        this.weaponSystem._aimArm(this.prepLeftArm, lShoulder, lWrist);
      }

      // Show live 3D trajectory arc once held past a brief tap
      if (this.holdTime >= 0.10) {
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
      // Crisp forward throw follow-through
      this.prepHand.position.set(
        THREE.MathUtils.lerp(0.18, 0.04, t),
        THREE.MathUtils.lerp(-0.02, -0.28, t),
        THREE.MathUtils.lerp(-0.30, -0.48, t)
      );
      this.prepHand.rotation.set(-0.65 * t, -0.15, 0.1);
      if (this.weaponSystem && this.prepRightArm) {
        const rShoulder = new THREE.Vector3(0.30, -0.32, -0.02);
        const rWrist = this.prepHand.position.clone().add(new THREE.Vector3(0.012, -0.012, 0.040));
        this.weaponSystem._aimArm(this.prepRightArm, rShoulder, rWrist);
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
              const killed = enemy.takeDamage(dmg, prevPos);
              if (pr.onHitCallback) {
                pr.onHitCallback(isHead, killed, enemy, {
                  damage: dmg,
                  weaponName: 'THROWING KNIFE',
                  distance: player ? player.position.distanceTo(enemy.position) : h.distance,
                  isLethal: true
                });
              }
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

      // Ground collision
      if (nextPos.y <= 0.07) {
        nextPos.y = 0.07;
        if (pr.isKnife) {
          pr.pos.copy(nextPos);
          pr.mesh.position.copy(pr.pos);
          pr.stuck = true;
          window.soundEngine.playGrenadeBounce();
          continue;
        } else {
          pr.vel.y = -pr.vel.y * 0.38;
          pr.vel.x *= 0.68;
          pr.vel.z *= 0.68;
          if (Math.abs(pr.vel.y) > 1.2) window.soundEngine.playGrenadeBounce();
          pr.bounces += 1;
        }
      }

      // Wall AABB collision (axis-separated bounce or knife stick)
      const hitCol = this._pointHitsCollider(nextPos, 0.08);
      if (hitCol) {
        if (pr.isKnife) {
          pr.pos.copy(prevPos);
          pr.mesh.position.copy(pr.pos);
          pr.stuck = true;
          window.soundEngine.playGrenadeBounce();
          continue;
        } else {
          // Determine bounce normal axis
          const testX = new THREE.Vector3(nextPos.x, prevPos.y, prevPos.z);
          const testZ = new THREE.Vector3(prevPos.x, prevPos.y, nextPos.z);
          if (this._pointHitsCollider(testX, 0.08)) pr.vel.x = -pr.vel.x * 0.45;
          if (this._pointHitsCollider(testZ, 0.08)) pr.vel.z = -pr.vel.z * 0.45;
          pr.vel.y *= 0.65;
          nextPos.copy(prevPos).addScaledVector(pr.vel, dt * 0.5);
          window.soundEngine.playGrenadeBounce();
          pr.bounces += 1;
        }
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
        fx.light.intensity = Math.max(0, (1 - p) * 9);
        if (fx.life <= 0) {
          this.scene.remove(fx.mesh);
          this.scene.remove(fx.light);
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
