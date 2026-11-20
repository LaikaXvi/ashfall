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

// Shared Overhead Circular Bleedout / Revive Timer with Medical Cross in Center
window.drawDownedBleedoutCanvas = function drawDownedBleedoutCanvas(canvas, pct, opts = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = w * 0.38;

  ctx.clearRect(0, 0, w, h);

  // Dark circular backdrop
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 12, 12, 0.82)';
  ctx.fill();

  // Outer track ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 10;
  ctx.stroke();

  if (opts.isReviving) {
    // Cyan/Green revive fill ring
    const revPct = Math.max(0, Math.min(1, opts.revivePct || 0));
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * revPct);
    ctx.strokeStyle = '#69f0ae';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();
  } else if (opts.isDead) {
    // Dashed red ring for eliminated-but-revivable ally
    ctx.save();
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff5252';
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.restore();
  } else {
    // Bleedout countdown ring draining clockwise
    const clamped = Math.max(0, Math.min(1, pct));
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamped);
    ctx.strokeStyle = clamped < 0.35 ? '#ff4444' : (opts.isAlly ? '#64b5f6' : '#ffca28');
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Medical cross in the middle
  const armLen = w * 0.28;
  const armThick = w * 0.105;
  ctx.fillStyle = opts.isReviving ? '#69f0ae' : (opts.isDead ? '#ff6b6b' : '#ffffff');
  ctx.fillRect(cx - armLen / 2, cy - armThick / 2, armLen, armThick);
  ctx.fillRect(cx - armThick / 2, cy - armLen / 2, armThick, armLen);
};

class Enemy {
  constructor(scene, world, spawnPos, tier = 'scav', opMeta = null) {
    this.scene = scene;
    this.world = world;
    this.tier = tier;
    this.isOperator = !!(opMeta && opMeta.isOperator);
    this.squadName = opMeta ? opMeta.squadName : null;
    this.playstyle = opMeta ? opMeta.playstyle : 'tactical'; // 'rusher' | 'tactical' | 'marksman' | 'flanker'
    this.dead = false;
    this.isDowned = false;
    this.justDowned = false;
    this.downedHp = 55;
    this.downedBleedMax = 25.0;
    this.downedBleedTimer = 25.0;
    this.downedBy = null;
    this._bleedDrawAccum = 0;
    this.looted = false;
    this.stunTimer = 0;

    // Tier & Operator Playstyle stats
    if (this.isOperator) {
      this.name = opMeta.callsign;
      const styles = {
        rusher:   { hp: 105, dmg: 11, fire: 0.20, acc: 0.11, spd: 4.6, wpn: 'mp5k',  col: 0x3b4852 },
        flanker:  { hp: 115, dmg: 13, fire: 0.24, acc: 0.08, spd: 4.1, wpn: 'ak74m', col: 0x424d3b },
        tactical: { hp: 130, dmg: 14, fire: 0.26, acc: 0.06, spd: 3.4, wpn: 'ak74m', col: 0x383d42 },
        marksman: { hp: 120, dmg: 22, fire: 0.72, acc: 0.03, spd: 2.5, wpn: 'm24',   col: 0x4a4536 }
      };
      const st = styles[this.playstyle] || styles.tactical;
      this.maxHp = st.hp;
      this.damage = st.dmg;
      this.fireInterval = st.fire;
      this.accuracy = st.acc;
      this.speed = st.spd;
      this.armorColor = st.col;
      this.headColor = 0x26292d;
      this.weaponId = st.wpn;
    } else if (tier === 'heavy') {
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
    this.beingRevivedBy = null;
    this.reviveProgress = 0;
    this.coverSpot = null; // { coverPos: Vector3, peekPos: Vector3 }
    this.coverSearchTimer = 0;
    this.coverPeekTimer = 1.4;
    this.isPeeking = true;

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

    // Overhead circular bleedout timer with medical cross in middle (for downed operators)
    this.bleedCanvas = document.createElement('canvas');
    this.bleedCanvas.width = 128;
    this.bleedCanvas.height = 128;
    this.bleedTex = new THREE.CanvasTexture(this.bleedCanvas);
    const bleedMat = new THREE.SpriteMaterial({
      map: this.bleedTex,
      transparent: true,
      depthTest: false
    });
    this.bleedSprite = new THREE.Sprite(bleedMat);
    this.bleedSprite.position.set(0, 1.85, 0);
    this.bleedSprite.scale.set(0.75, 0.75, 1);
    this.bleedSprite.visible = false;
    this.group.add(this.bleedSprite);
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

  takeDamage(amount, attackerPos, attackerInfo = null) {
    if (this.dead) return false;
    this.justDowned = false;

    if (this.isDowned) {
      if (attackerInfo) this.downedBy = attackerInfo;
      this.downedHp -= amount;
      if (this.downedHp <= 0) {
        this.die();
        return true;
      }
      return false;
    }

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
      if (this.isOperator) {
        // Operators enter Downed state first (+50 XP); finishing or bleedout awards +100 XP!
        this.isDowned = true;
        this.justDowned = true;
        this.downedHp = 55;
        this.downedBleedTimer = this.downedBleedMax;
        this.downedBy = attackerInfo || { name: 'YOU', isPlayer: true, weaponId: '', weaponName: '' };
        this.state = 'DOWNED';
        this.group.position.y = -0.45;
        this.group.rotation.x = -0.55;
        if (this.alertSprite) this.alertSprite.visible = false;
        if (this.bleedSprite) {
          window.drawDownedBleedoutCanvas(this.bleedCanvas, 1, { isAlly: false });
          this.bleedTex.needsUpdate = true;
          this.bleedSprite.visible = true;
        }
        return false;
      }
      this.die();
      return true;
    }
    return false;
  }

  die() {
    this.dead = true;
    this.isDowned = false;
    this.state = 'DEAD';
    if (this.alertSprite) this.alertSprite.visible = false;
    if (this.bleedSprite) this.bleedSprite.visible = false;
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

  dragToward(tx, tz, speed, dt) {
    if (this.dead) return;
    const dx = tx - this.position.x;
    const dz = tz - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.12) return;
    const step = Math.min(dist, speed * dt);
    const vx = (dx / dist) * step;
    const vz = (dz / dist) * step;
    if (!this._collides(this.position.x + vx, this.position.z, 0.42)) {
      this.position.x += vx;
      this.group.position.x = this.position.x;
    }
    if (!this._collides(this.position.x, this.position.z + vz, 0.42)) {
      this.position.z += vz;
      this.group.position.z = this.position.z;
    }
  }

  revive(hpRestore = 65) {
    if (this.dead) return;
    this.isDowned = false;
    this.hp = Math.min(this.maxHp, hpRestore);
    this.downedHp = 55;
    this.downedBleedTimer = this.downedBleedMax;
    this.beingRevivedBy = null;
    this.reviveProgress = 0;
    this.group.position.y = 0;
    this.group.rotation.x = 0;
    if (this.bleedSprite) this.bleedSprite.visible = false;
    this.state = 'ALERT';
    this.alertTimer = 4.0;
    this._showAlertIndicator('!', 1.5);
  }

  _hasLineOfSightFrom(fromPos, targetPos) {
    const eye = new THREE.Vector3(fromPos.x, 1.45, fromPos.z);
    const tgt = new THREE.Vector3(targetPos.x, 1.35, targetPos.z);
    const dir = tgt.clone().sub(eye);
    const dist = dir.length();
    if (dist < 0.3 || dist > 48) return false;
    dir.normalize();
    const ray = new THREE.Raycaster(eye, dir, 0.2, dist - 0.3);
    const hits = ray.intersectObjects(this.world.shootableMeshes, false);
    return hits.length === 0;
  }

  _findBestCoverSpot(threatPos, maxRadius = 18) {
    if (!threatPos || !this.world || !this.world.colliders) return null;
    let best = null;
    let bestScore = Infinity;

    for (const c of this.world.colliders) {
      if (c.maxY < 1.0) continue; // need waist/chest-high or taller cover
      const cx = (c.minX + c.maxX) * 0.5;
      const cz = (c.minZ + c.maxZ) * 0.5;
      const halfX = (c.maxX - c.minX) * 0.5;
      const halfZ = (c.maxZ - c.minZ) * 0.5;
      if (halfX > 14 || halfZ > 14) continue; // skip huge outer perimeter walls

      const dSelf = Math.hypot(cx - this.position.x, cz - this.position.z);
      if (dSelf > maxRadius) continue;

      // Direction from threat through obstacle center => opposite side of cover!
      const awayX = cx - threatPos.x;
      const awayZ = cz - threatPos.z;
      const awayLen = Math.hypot(awayX, awayZ) || 1;
      const nx = awayX / awayLen;
      const nz = awayZ / awayLen;

      const pad = 0.85;
      const coverX = cx + nx * (halfX + pad);
      const coverZ = cz + nz * (halfZ + pad);
      if (this._collides(coverX, coverZ, 0.45)) continue;

      const coverPos = new THREE.Vector3(coverX, 0, coverZ);
      // Verify cover actually blocks LOS to threat
      if (this._hasLineOfSightFrom(coverPos, threatPos)) continue;

      // Compute a lateral peek point just past the edge of the cover
      const perpX = -nz;
      const perpZ = nx;
      const side = Math.max(halfX, halfZ) + 1.15;
      const peekA = new THREE.Vector3(coverX + perpX * side, 0, coverZ + perpZ * side);
      const peekB = new THREE.Vector3(coverX - perpX * side, 0, coverZ - perpZ * side);
      let peekPos = coverPos;
      if (!this._collides(peekA.x, peekA.z, 0.45) && this._hasLineOfSightFrom(peekA, threatPos)) {
        peekPos = peekA;
      } else if (!this._collides(peekB.x, peekB.z, 0.45) && this._hasLineOfSightFrom(peekB, threatPos)) {
        peekPos = peekB;
      }

      const dThreat = Math.hypot(coverX - threatPos.x, coverZ - threatPos.z);
      const idealDist = this.playstyle === 'marksman' ? 24 : (this.playstyle === 'rusher' ? 11 : 16);
      const score = dSelf * 1.1 + Math.abs(dThreat - idealDist) * 0.45;
      if (score < bestScore) {
        bestScore = score;
        best = { coverPos, peekPos };
      }
    }
    return best;
  }

  update(dt, player, onEnemyFire, onEnemyBleedout, allEnemies = []) {
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
      const s = THREE.MathUtils.lerp(this.alertSprite.scale.x, 0.58, dt * 10);
      this.alertSprite.scale.set(s, s, 1);
      if (this.indicatorTimer <= 0) {
        this.alertSprite.visible = false;
      }
    }

    // Downed operator: pauses bleedout while being revived/dragged by a squadmate; otherwise crawls toward safety
    if (this.isDowned) {
      if (!this.beingRevivedBy) {
        this.downedBleedTimer -= dt;
        const threat = this.lastKnownPlayerPos || (player && player.position);
        if (threat) {
          const awayX = this.position.x - threat.x;
          const awayZ = this.position.z - threat.z;
          const dist = Math.hypot(awayX, awayZ) || 1;
          const crawlSpd = 0.95;
          const vx = (awayX / dist) * crawlSpd * dt;
          const vz = (awayZ / dist) * crawlSpd * dt;
          if (!this._collides(this.position.x + vx, this.position.z, 0.42)) {
            this.position.x += vx;
            this.group.position.x = this.position.x;
          }
          if (!this._collides(this.position.x, this.position.z + vz, 0.42)) {
            this.position.z += vz;
            this.group.position.z = this.position.z;
          }
          this.group.rotation.y = Math.atan2(awayX, awayZ);
        }
      }
      this._bleedDrawAccum += dt;
      if (this.bleedSprite && this._bleedDrawAccum >= 0.06) {
        this._bleedDrawAccum = 0;
        const ratio = this.beingRevivedBy ? (this.reviveProgress || 0) : (this.downedBleedTimer / this.downedBleedMax);
        window.drawDownedBleedoutCanvas(this.bleedCanvas, ratio, { isAlly: !!this.beingRevivedBy });
        this.bleedTex.needsUpdate = true;
      }
      if (!this.beingRevivedBy && this.downedBleedTimer <= 0) {
        this.die();
        if (onEnemyBleedout) onEnemyBleedout(this);
      }
      return;
    }

    // Concussion stun state: staggered & unable to shoot or chase
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.group.rotation.y += Math.sin(performance.now() * 0.012) * dt * 2.5;
      return;
    }

    // Priority 0 for AI Operators: Revive & Drag-to-Cover downed squadmates!
    if (this.isOperator && this.squadName && allEnemies.length > 0) {
      let downedMate = null;
      let bestMateDist = 26;
      for (const mate of allEnemies) {
        if (!mate || mate === this || mate.dead || !mate.isDowned) continue;
        if (mate.squadName !== this.squadName) continue;
        if (mate.beingRevivedBy && mate.beingRevivedBy !== this.name) continue;
        const d = this.position.distanceTo(mate.position);
        if (d < bestMateDist) {
          bestMateDist = d;
          downedMate = mate;
        }
      }

      if (downedMate) {
        const dMate = Math.hypot(downedMate.position.x - this.position.x, downedMate.position.z - this.position.z);
        if (dMate > 2.0) {
          this._moveToward(downedMate.position, this.speed * 1.15, dt);
          return;
        }
        // Reached downed squadmate: channel revive AND drag them to nearest cover if exposed!
        downedMate.beingRevivedBy = this.name;
        downedMate.reviveProgress = Math.min(1, (downedMate.reviveProgress || 0) + dt / 4.0);

        const threatPos = (player && !player.dead && !player.isDowned) ? player.position : this.lastKnownPlayerPos;
        if (threatPos && this._hasLineOfSightFrom(this.position, threatPos)) {
          const cover = this._findBestCoverSpot(threatPos, 15);
          let dragDest = cover ? cover.coverPos : null;
          if (!dragDest) {
            const awayX = this.position.x - threatPos.x;
            const awayZ = this.position.z - threatPos.z;
            const len = Math.hypot(awayX, awayZ) || 1;
            dragDest = new THREE.Vector3(this.position.x + (awayX / len) * 3.5, 0, this.position.z + (awayZ / len) * 3.5);
          }
          const moved = this._moveToward(dragDest, 1.75, dt);
          if (moved) {
            const dx = dragDest.x - this.position.x;
            const dz = dragDest.z - this.position.z;
            const dLen = Math.hypot(dx, dz) || 1;
            downedMate.dragToward(this.position.x - (dx / dLen) * 0.95, this.position.z - (dz / dLen) * 0.95, 2.2, dt);
          }
        }

        if (downedMate.reviveProgress >= 1) {
          downedMate.revive(65);
        }
        return;
      }
    }

    // Ignore downed or dead players!
    const playerTargetable = !!(player && !player.dead && !player.isDowned);
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

    const canSee = playerTargetable && distToPlayer < detectRange && inVision && this._hasLineOfSight(playerPos, detectRange + 4);

    if (!playerTargetable && this.state === 'COMBAT') {
      // Player is downed/eliminated: disengage immediately instead of shooting downed players!
      this.state = 'PATROL';
      this.lastKnownPlayerPos = null;
      this.coverSpot = null;
      this.patrolTarget = this._pickPatrolPoint();
    } else if (canSee) {
      if (this.state !== 'COMBAT') {
        this.state = 'COMBAT';
        this.fireTimer = 0.75; // Reaction window before first shot
        this.coverSpot = this._findBestCoverSpot(playerPos, 18);
        this.coverSearchTimer = 2.5;
        this.isPeeking = false;
        this.coverPeekTimer = 0.9;
        this._showAlertIndicator('!', 2.2);
        window.soundEngine.playAlert(true);
      }
      this.lastKnownPlayerPos = playerPos.clone();
      this.loseSightTimer = 4.5;
      this.alertTimer = 4.5;
    } else if (this.state === 'COMBAT') {
      this.loseSightTimer -= dt;
      if (this.loseSightTimer <= 0) {
        this.state = 'ALERT';
        this.alertTimer = 4.5;
        this.coverSpot = null;
        this._showAlertIndicator('?', 2.5);
        window.soundEngine.playAlert(false);
      }
    } else if (this.state === 'ALERT') {
      this.alertTimer -= dt;
      if (this.alertTimer <= 0) {
        this.state = 'PATROL';
        this.lastKnownPlayerPos = null;
        this.coverSpot = null;
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
    } else if (this.state === 'COMBAT' && playerTargetable) {
      // Face threat
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      this.group.rotation.y = Math.atan2(dx, dz);

      // Prioritize playing cover (find cover behind nearby colliders -> peek to fire -> tuck back into cover!)
      this.coverSearchTimer -= dt;
      if (!this.coverSpot || this.coverSearchTimer <= 0) {
        const refreshed = this._findBestCoverSpot(playerPos, 18);
        if (refreshed) this.coverSpot = refreshed;
        this.coverSearchTimer = 2.8;
      }

      if (this.coverSpot) {
        this.coverPeekTimer -= dt;
        if (this.coverPeekTimer <= 0) {
          this.isPeeking = !this.isPeeking;
          this.coverPeekTimer = this.isPeeking
            ? (1.35 + Math.random() * 0.85) // peek window to fire
            : (1.05 + Math.random() * 0.75); // tuck behind cover
        }
        const goal = this.isPeeking ? this.coverSpot.peekPos : this.coverSpot.coverPos;
        const dGoal = Math.hypot(goal.x - this.position.x, goal.z - this.position.z);
        if (dGoal > 0.45) {
          this._moveToward(goal, this.speed * (this.isPeeking ? 0.78 : 1.05), dt, playerPos);
        }
      } else if (distToPlayer > 22) {
        // Only close distance if no cover is available nearby
        this._moveToward(playerPos, this.speed * 0.85, dt, playerPos);
      }

      if (canSee) {
        // Fire bursts when peeking or holding line of sight
        this.fireTimer -= dt;
        if (this.fireTimer <= 0) {
          this.fireTimer = this.fireInterval + Math.random() * 0.22;
          window.soundEngine.playGunshot(this.weaponId, distToPlayer);

          this.muzzleMesh.material.opacity = 0.95;
          this.muzzleLight.intensity = 3.0;
          this.muzzleTimer = 0.055;

          const muzzleWorld = new THREE.Vector3();
          this.muzzleMesh.getWorldPosition(muzzleWorld);

          const hitChance = Math.max(0.15, (1 - distToPlayer / 75) * (1 - this.accuracy * 2.5));
          const hit = Math.random() < hitChance;
          onEnemyFire(this, hit, this.damage, muzzleWorld);
        }
      } else if (!this.coverSpot && this.lastKnownPlayerPos) {
        this._moveToward(this.lastKnownPlayerPos, this.speed * 0.85, dt);
      }
    }
  }
}

class EnemyManager {
  constructor(scene, world, zoneConfig) {
    this.scene = scene;
    this.world = world;
    this.enemies = [];

    // Spawn 6 AI Operator Squads (1-3 operators each, randomized playstyles & callsigns!)
    const squadPrefixes = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT'];
    const callsigns = [
      'VIPER', 'PHANTOM', 'REAPER', 'COBALT', 'STRYKER', 'WRAITH',
      'JACKAL', 'HAWK', 'SPECTRE', 'BANDIT', 'NOMAD', 'SABLE',
      'KODIAK', 'TALON', 'ZERO', 'ORION', 'BISHOP', 'BLITZ'
    ];
    const styles = ['rusher', 'flanker', 'tactical', 'marksman'];
    const anchorPts = [...world.spawnPoints].sort(() => Math.random() - 0.5);

    let nameIdx = 0;
    for (let s = 0; s < 6; s++) {
      const anchor = anchorPts[s % anchorPts.length] || new THREE.Vector3((s - 3) * 18, 0, -20);
      const squadSize = 1 + Math.floor(Math.random() * 3); // 1 to 3 operators per squad
      for (let m = 0; m < squadSize; m++) {
        const off = new THREE.Vector3((m - 1) * 2.4, 0, (m % 2) * 2.0);
        const pos = anchor.clone().add(off);
        const style = styles[Math.floor(Math.random() * styles.length)];
        const callsign = `[${squadPrefixes[s]}] ${callsigns[nameIdx % callsigns.length]}`;
        nameIdx++;
        const op = new Enemy(scene, world, pos, 'raider', {
          isOperator: true,
          squadName: squadPrefixes[s],
          callsign,
          playstyle: style
        });
        // Mark corpse loot items unrevealed for progressive search reveal
        if (op.loot) {
          op.loot.forEach(it => { it.revealed = false; });
          op.loot.push({ id: 'dogtag', qty: 1, revealed: false });
        }
        this.enemies.push(op);
      }
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

  update(dt, player, onEnemyFire, onEnemyBleedout) {
    for (const e of this.enemies) {
      e.update(dt, player, onEnemyFire, onEnemyBleedout, this.enemies);
    }
  }
}
