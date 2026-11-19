// 3D AI Enemies: Scavengers, Raiders, Armored Heavies
function getAlertSpriteTexture(symbol) {
  if (!window._alertTextures) window._alertTextures = {};
  if (window._alertTextures[symbol]) return window._alertTextures[symbol];

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Crisp MGS-style badge
  ctx.clearRect(0, 0, 128, 128);
  ctx.font = 'bold 96px Consolas, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Dark outline for readability against wasteland sky
  ctx.lineWidth = 14;
  ctx.strokeStyle = 'rgba(10, 10, 10, 0.9)';
  ctx.strokeText(symbol, 64, 68);

  ctx.fillStyle = symbol === '!' ? '#ff3333' : '#f5c542';
  ctx.fillText(symbol, 64, 68);

  const tex = new THREE.CanvasTexture(canvas);
  window._alertTextures[symbol] = tex;
  return tex;
}

class Enemy {
  constructor(scene, world, spawnPos, tier = 'scav') {
    this.scene = scene;
    this.world = world;
    this.tier = tier;
    this.dead = false;
    this.looted = false;
    this.stunTimer = 0;

    // Tier stats
    if (tier === 'heavy') {
      this.name = 'Armored Juggernaut';
      this.maxHp = 190;
      this.damage = 16;
      this.fireInterval = 0.22;
      this.accuracy = 0.085;
      this.speed = 2.6;
      this.armorColor = 0x2a2f33;
      this.headColor = 0x3b4045;
      this.weaponId = 'ak74m';
    } else if (tier === 'raider') {
      this.name = 'Wasteland Raider';
      this.maxHp = 110;
      this.damage = 13;
      this.fireInterval = 0.28;
      this.accuracy = 0.075;
      this.speed = 3.5;
      this.armorColor = 0x4b4232;
      this.headColor = 0x6b5a48;
      this.weaponId = 'ak74m';
    } else {
      this.name = 'Scavenger';
      this.maxHp = 75;
      this.damage = 9;
      this.fireInterval = 0.42;
      this.accuracy = 0.11;
      this.speed = 3.2;
      this.armorColor = 0x5c4738;
      this.headColor = 0x8f735c;
      this.weaponId = 'pm9';
    }

    this.hp = this.maxHp;
    this.homePos = spawnPos.clone();
    this.position = spawnPos.clone();
    this.state = 'PATROL';
    this.patrolTarget = this._pickPatrolPoint();
    this.lastKnownPlayerPos = null;
    this.alertTimer = 0;
    this.loseSightTimer = 0;
    this.indicatorTimer = 0;
    this.fireTimer = 0.75;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = 1.5;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.hitboxes = [];
    this._buildModel();
    this._buildAlertSprite();
    this.scene.add(this.group);

    this.lootItems = this._generateCorpseLoot();
  }

  _buildModel() {
    const bodyMat = new THREE.MeshLambertMaterial({ color: this.armorColor });
    const headMat = new THREE.MeshLambertMaterial({ color: this.headColor });
    const limbMat = new THREE.MeshLambertMaterial({ color: 0x2c2b29 });
    const gunMat = new THREE.MeshLambertMaterial({ color: 0x1a1c1e });

    // Legs anchored at hip joints (y = 0.8)
    const legGeo = new THREE.BoxGeometry(0.22, 0.8, 0.24);
    this.leftHip = new THREE.Group();
    this.leftHip.position.set(-0.15, 0.8, 0);
    const leftLegMesh = new THREE.Mesh(legGeo, limbMat);
    leftLegMesh.position.set(0, -0.4, 0);
    this.leftHip.add(leftLegMesh);

    this.rightHip = new THREE.Group();
    this.rightHip.position.set(0.15, 0.8, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, limbMat);
    rightLegMesh.position.set(0, -0.4, 0);
    this.rightHip.add(rightLegMesh);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.32), bodyMat);
    torso.position.set(0, 1.16, 0);
    torso.userData = { enemy: this, part: 'torso' };
    this.hitboxes.push(torso);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), headMat);
    head.position.set(0, 1.72, 0);
    head.userData = { enemy: this, part: 'head' };
    this.hitboxes.push(head);

    // Arms + Rifle
    const armGeo = new THREE.BoxGeometry(0.18, 0.56, 0.18);
    const leftArm = new THREE.Mesh(armGeo, limbMat);
    leftArm.position.set(-0.38, 1.16, 0.12);
    leftArm.rotation.x = -0.8;

    const rightArm = new THREE.Mesh(armGeo, limbMat);
    rightArm.position.set(0.38, 1.16, 0.15);
    rightArm.rotation.x = -1.1;

    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.65), gunMat);
    rifle.position.set(0.25, 1.24, 0.42);

    // Rifle muzzle flash
    this.muzzleMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffcc55, transparent: true, opacity: 0 })
    );
    this.muzzleMesh.position.set(0.25, 1.25, 0.78);
    this.muzzleLight = new THREE.PointLight(0xffaa33, 0, 6);
    this.muzzleLight.position.set(0.25, 1.25, 0.82);
    this.muzzleTimer = 0;

    this.group.add(
      this.leftHip, this.rightHip, torso, head,
      leftArm, rightArm, rifle, this.muzzleMesh, this.muzzleLight
    );
  }

  _generateCorpseLoot() {
    const items = [{ id: 'dogtag', qty: 1 }];
    if (this.tier === 'heavy') {
      items.push({ id: 'ammo_545', qty: 20 + Math.floor(Math.random() * 15) });
      items.push({ id: 'medkit', qty: 1 });
      if (Math.random() < 0.6) items.push({ id: 'intel_drive', qty: 1 });
      if (Math.random() < 0.35) items.push({ id: 'vest_tactical', qty: 1 });
    } else if (this.tier === 'raider') {
      items.push({ id: 'ammo_545', qty: 12 + Math.floor(Math.random() * 15) });
      if (Math.random() < 0.5) items.push({ id: 'medkit', qty: 1 });
      if (Math.random() < 0.4) items.push({ id: 'gold_watch', qty: 1 });
    } else {
      items.push({ id: 'ammo_9x18', qty: 8 + Math.floor(Math.random() * 10) });
      if (Math.random() < 0.45) items.push({ id: 'scrap_metal', qty: 1 });
    }
    return items;
  }

  _pickPatrolPoint() {
    const base = this.homePos || this.position;
    const angle = Math.random() * Math.PI * 2;
    const dist = 4 + Math.random() * 10;
    return new THREE.Vector3(
      THREE.MathUtils.clamp(base.x + Math.cos(angle) * dist, -74, 74),
      0,
      THREE.MathUtils.clamp(base.z + Math.sin(angle) * dist, -74, 74)
    );
  }

  _buildAlertSprite() {
    const mat = new THREE.SpriteMaterial({
      map: getAlertSpriteTexture('?'),
      transparent: true,
      depthTest: false
    });
    this.alertSprite = new THREE.Sprite(mat);
    this.alertSprite.position.set(0, 2.38, 0);
    this.alertSprite.scale.set(0.65, 0.65, 1);
    this.alertSprite.visible = false;
    this.group.add(this.alertSprite);
  }

  _showAlertIndicator(symbol, duration = 2.0) {
    if (this.dead || !this.alertSprite) return;
    this.alertSprite.material.map = getAlertSpriteTexture(symbol);
    this.alertSprite.material.needsUpdate = true;
    this.alertSprite.visible = true;
    this.alertSprite.scale.set(0.85, 0.85, 1); // pop-in scale
    this.indicatorTimer = duration;
  }

  alertToPosition(pos) {
    if (this.dead) return;
    this.lastKnownPlayerPos = pos.clone();
    if (this.state === 'PATROL') {
      this.state = 'ALERT';
      this.alertTimer = 7.0;
      this._showAlertIndicator('?', 3.0);
      window.soundEngine.playAlert(false);
    }
  }

  takeDamage(amount, attackerPos) {
    if (this.dead) return false;
    this.hp -= amount;
    if (attackerPos && this.state !== 'COMBAT') {
      this.lastKnownPlayerPos = attackerPos.clone();
      this.state = 'COMBAT';
      this.loseSightTimer = 5.0;
      this.alertTimer = 4.5;
      this.fireTimer = 0.55;
      this._showAlertIndicator('!', 2.2);
    } else if (attackerPos) {
      this.lastKnownPlayerPos = attackerPos.clone();
      this.loseSightTimer = 5.0;
      this.alertTimer = 4.5;
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return true;
    }
    return false;
  }

  die() {
    this.dead = true;
    this.state = 'DEAD';
    if (this.alertSprite) this.alertSprite.visible = false;
    // Tip over corpse
    this.group.rotation.x = -Math.PI / 2;
    this.group.position.y = 0.25;
  }

  stun(duration = 5.0) {
    if (this.dead) return;
    this.stunTimer = Math.max(this.stunTimer, duration);
    this._showAlertIndicator('?', duration);
  }

  _hasLineOfSight(playerPos, maxDist = 32) {
    const eye = new THREE.Vector3(this.position.x, 1.6, this.position.z);
    const target = playerPos.clone();
    const dir = target.sub(eye);
    const dist = dir.length();
    if (dist > maxDist) return false;
    dir.normalize();

    // Check if an active smoke cloud blocks line-of-sight
    if (this.world && this.world.activeSmokes && this.world.activeSmokes.length > 0) {
      for (const sm of this.world.activeSmokes) {
        if (!sm.active) continue;
        const toSmoke = sm.pos.clone().sub(eye);
        const proj = toSmoke.dot(dir);
        if (proj > 0 && proj < dist) {
          const closest = eye.clone().addScaledVector(dir, proj);
          if (closest.distanceTo(sm.pos) < sm.radius * 0.85) return false;
        }
      }
    }

    const ray = new THREE.Raycaster(eye, dir, 0.2, dist);
    const hits = ray.intersectObjects(this.world.shootableMeshes, false);
    return hits.length === 0;
  }

  _moveToward(target, speed, dt, faceTarget = null) {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.4) {
      this.leftHip.rotation.x = THREE.MathUtils.lerp(this.leftHip.rotation.x, 0, dt * 10);
      this.rightHip.rotation.x = THREE.MathUtils.lerp(this.rightHip.rotation.x, 0, dt * 10);
      return false;
    }

    const vx = (dx / dist) * speed * dt;
    const vz = (dz / dist) * speed * dt;

    // Simple X/Z slide against world colliders
    const r = 0.45;
    if (!this._collides(this.position.x + vx, this.position.z, r)) {
      this.position.x += vx;
    }
    if (!this._collides(this.position.x, this.position.z + vz, r)) {
      this.position.z += vz;
    }

    this.group.position.x = this.position.x;
    this.group.position.z = this.position.z;

    if (faceTarget) {
      this.group.rotation.y = Math.atan2(faceTarget.x - this.position.x, faceTarget.z - this.position.z);
    } else {
      this.group.rotation.y = Math.atan2(dx, dz);
    }

    // Leg walk animation around hip pivots
    const t = performance.now() * 0.0045;
    this.leftHip.rotation.x = Math.sin(t) * 0.38;
    this.rightHip.rotation.x = -Math.sin(t) * 0.38;
    return true;
  }

  _collides(x, z, r) {
    for (const c of this.world.colliders) {
      if (c.maxY < 0.2) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        return true;
      }
    }
    return false;
  }

  update(dt, player, onEnemyFire) {
    if (this.dead) return;

    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.muzzleMesh.material.opacity = 0;
        this.muzzleLight.intensity = 0;
      }
    }

    // Update floating alert indicator (?, !)
    if (this.indicatorTimer > 0) {
      this.indicatorTimer -= dt;
      // Settle pop-in scale back to normal
      const s = THREE.MathUtils.lerp(this.alertSprite.scale.x, 0.58, dt * 10);
      this.alertSprite.scale.set(s, s, 1);
      if (this.indicatorTimer <= 0) {
        this.alertSprite.visible = false;
      }
    }

    // Concussion stun state: staggered & unable to shoot or chase
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.group.rotation.y += Math.sin(performance.now() * 0.012) * dt * 2.5;
      return;
    }

    const playerPos = player.position;
    const distToPlayer = this.position.distanceTo(playerPos);
    const detectRange = player.isProne ? 12 : (player.isCrouching ? 18 : 28);

    // Vision cone check (enemy faces group.rotation.y)
    let inVision = true;
    if (this.state === 'PATROL' && distToPlayer > 6.5) {
      const forwardX = Math.sin(this.group.rotation.y);
      const forwardZ = Math.cos(this.group.rotation.y);
      const toPlayerX = (playerPos.x - this.position.x) / (distToPlayer || 1);
      const toPlayerZ = (playerPos.z - this.position.z) / (distToPlayer || 1);
      const dot = forwardX * toPlayerX + forwardZ * toPlayerZ;
      inVision = dot > 0.35; // ~140 deg forward cone
    }

    const canSee = distToPlayer < detectRange && inVision && this._hasLineOfSight(playerPos, detectRange + 4);

    if (canSee) {
      if (this.state !== 'COMBAT') {
        this.state = 'COMBAT';
        this.fireTimer = 0.75; // Reaction window before first shot
        this._showAlertIndicator('!', 2.2);
        window.soundEngine.playAlert(true);
      }
      this.lastKnownPlayerPos = playerPos.clone();
      this.loseSightTimer = 4.5; // Time before losing track in combat
      this.alertTimer = 4.5;     // Cooldown in ALERT before returning to patrol
    } else if (this.state === 'COMBAT') {
      this.loseSightTimer -= dt;
      if (this.loseSightTimer <= 0) {
        // Lost track of player: drop to ALERT/search with '?' indicator
        this.state = 'ALERT';
        this.alertTimer = 4.5;
        this._showAlertIndicator('?', 2.5);
        window.soundEngine.playAlert(false);
      }
    } else if (this.state === 'ALERT') {
      this.alertTimer -= dt;
      if (this.alertTimer <= 0) {
        // Cooldown complete: disengage and return to original patrol area
        this.state = 'PATROL';
        this.lastKnownPlayerPos = null;
        this.patrolTarget = this._pickPatrolPoint();
      }
    }

    if (this.state === 'PATROL') {
      const moved = this._moveToward(this.patrolTarget, this.speed * 0.55, dt);
      if (!moved || Math.random() < 0.005) {
        this.patrolTarget = this._pickPatrolPoint();
      }
    } else if (this.state === 'ALERT' && this.lastKnownPlayerPos) {
      this._moveToward(this.lastKnownPlayerPos, this.speed * 0.85, dt);
    } else if (this.state === 'COMBAT') {
      // Face player
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      this.group.rotation.y = Math.atan2(dx, dz);

      if (canSee) {
        // Strafe or close distance while keeping eyes on the player
        if (distToPlayer > 22) {
          this._moveToward(playerPos, this.speed, dt, playerPos);
        } else {
          this.strafeTimer -= dt;
          if (this.strafeTimer <= 0) {
            this.strafeDir *= -1;
            this.strafeTimer = 1.2 + Math.random() * 1.4;
          }
          const perp = new THREE.Vector3(-dz, 0, dx).normalize().multiplyScalar(this.strafeDir * 3);
          this._moveToward(this.position.clone().add(perp), this.speed * 0.65, dt, playerPos);
        }

        // Fire at player
        this.fireTimer -= dt;
        if (this.fireTimer <= 0) {
          this.fireTimer = this.fireInterval + Math.random() * 0.2;
          window.soundEngine.playGunshot(this.weaponId, distToPlayer);

          this.muzzleMesh.material.opacity = 0.95;
          this.muzzleLight.intensity = 3.0;
          this.muzzleTimer = 0.055;

          const muzzleWorld = new THREE.Vector3();
          this.muzzleMesh.getWorldPosition(muzzleWorld);

          // Accuracy check (crouching makes player slightly harder to hit)
          const hitChance = Math.max(0.15, (1 - distToPlayer / 75) * (1 - this.accuracy * 2.5));
          const hit = Math.random() < hitChance;
          onEnemyFire(this, hit, this.damage, muzzleWorld);
        }
      } else if (this.lastKnownPlayerPos) {
        this._moveToward(this.lastKnownPlayerPos, this.speed, dt);
      }
    }
  }
}

class EnemyManager {
  constructor(scene, world, zoneConfig) {
    this.scene = scene;
    this.world = world;
    this.enemies = [];

    const count = Math.min(zoneConfig.enemyCount, world.spawnPoints.length);
    // Shuffle spawn points
    const pts = [...world.spawnPoints].sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      const r = Math.random();
      let tier = 'scav';
      if (r < zoneConfig.heavyChance) tier = 'heavy';
      else if (r < zoneConfig.heavyChance + zoneConfig.raiderChance) tier = 'raider';

      this.enemies.push(new Enemy(scene, world, pts[i], tier));
    }
  }

  getHitboxMeshes() {
    const list = [];
    for (const e of this.enemies) {
      if (!e.dead) list.push(...e.hitboxes);
    }
    return list;
  }

  alertNearby(pos, radius = 38) {
    for (const e of this.enemies) {
      if (!e.dead && e.position.distanceTo(pos) < radius) {
        e.alertToPosition(pos);
      }
    }
  }

  update(dt, player, onEnemyFire) {
    for (const e of this.enemies) {
      e.update(dt, player, onEnemyFire);
    }
  }
}
