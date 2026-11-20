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
  constructor(scene, world, spawnPos, tier = 'scav', opMeta = null, weaponSystem = null) {
    this.scene = scene;
    this.world = world;
    this.weaponSystem = weaponSystem;
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
      const opPrimaries = this.playstyle === 'marksman' ? ['m24', 'ak74m']
        : (this.playstyle === 'rusher' ? ['mp5k', 'm870'] : ['ak74m', 'mp5k', 'm870']);
      this.weaponId = opPrimaries[Math.floor(Math.random() * opPrimaries.length)];
      const vests = ['vest_1plate', 'vest_2plate', 'vest_2plate_gel', 'vest_2plate_helmet', 'vest_3plate'];
      const bags = ['bag_small', 'bag_medium', 'bag_large'];
      const melees = ['melee_knife', 'melee_karambit', 'melee_axe'];
      const fus = ['fu_ammo_box', 'fu_dead_silence', 'fu_trophy'];
      this.operatorEquipment = {
        primary: this.weaponId,
        secondary: Math.random() < 0.55 ? 'g17' : 'pm9',
        melee: melees[Math.floor(Math.random() * melees.length)],
        armor: vests[Math.min(vests.length - 1, Math.floor(Math.random() * (vests.length - (Math.random() < 0.65 ? 1 : 0))))],
        dogtag: 'dogtag',
        dogtagOwner: this.name,
        cash: 400 + Math.floor(Math.random() * 46) * 100,
        plates: 1 + Math.floor(Math.random() * 4),
        headgear: Math.random() < 0.35 ? 'gas_mask' : (Math.random() < 0.16 ? 'nvg_goggles' : null),
        backpack: bags[Math.floor(Math.random() * bags.length)],
        tactical: Math.random() < 0.6 ? 'smoke_grenade' : 'concussion_grenade',
        lethal: Math.random() < 0.65 ? 'frag_grenade' : 'throwing_knife',
        fieldUpgrade: fus[Math.floor(Math.random() * fus.length)],
        killstreak: Math.random() < 0.38 ? (Math.random() < 0.7 ? 'ks_uav' : 'ks_airstrike') : null,
        selfRevive: Math.random() < 0.35 ? 'self_revive' : null,
        revealedSlots: {}
      };
    } else if (tier === 'boss') {
      this.name = 'COMMANDER VULTURE';
      this.maxHp = 260;
      this.damage = 18;
      this.fireInterval = 0.20;
      this.accuracy = 0.06;
      this.speed = 3.0;
      this.armorColor = 0x3b1e22;
      this.headColor = 0x1d1e22;
      const bossWpns = ['ak74m', 'm24', 'm870'];
      this.weaponId = bossWpns[Math.floor(Math.random() * bossWpns.length)];
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
      const raiderWpns = ['ak74m', 'mp5k', 'm870'];
      this.weaponId = raiderWpns[Math.floor(Math.random() * raiderWpns.length)];
    } else {
      this.name = 'Scavenger';
      this.maxHp = 75;
      this.damage = 9;
      this.fireInterval = 0.42;
      this.accuracy = 0.11;
      this.speed = 3.2;
      this.armorColor = 0x5c4738;
      this.headColor = 0x8f735c;
      this.weaponId = Math.random() < 0.5 ? 'pm9' : 'g17';
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
    this.leftArm = new THREE.Mesh(armGeo, limbMat);
    this.leftArm.position.set(-0.38, 1.16, 0.12);
    this.leftArm.rotation.x = -0.8;

    this.rightArm = new THREE.Mesh(armGeo, limbMat);
    this.rightArm.position.set(0.38, 1.16, 0.15);
    this.rightArm.rotation.x = -1.1;

    // Actual 3D game weapon in hands (built from WeaponSystem)
    const wDef = GAME_DATA.ITEMS[this.weaponId];
    let weaponObj = null;
    if (this.weaponSystem && wDef && this.weaponSystem.buildThirdPersonWeapon) {
      const built = this.weaponSystem.buildThirdPersonWeapon(wDef, {});
      if (built && built.group) {
        weaponObj = built.group;
        weaponObj.scale.setScalar(1.22);
        weaponObj.position.set(0.24, 1.24, 0.36);
        weaponObj.rotation.set(0, Math.PI, 0); // barrel points along +Z (enemy forward)
      }
    }
    if (!weaponObj) {
      weaponObj = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.65), gunMat);
      weaponObj.position.set(0.25, 1.24, 0.42);
    }
    this.weaponMeshGroup = weaponObj;

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
      this.leftArm, this.rightArm, weaponObj, this.muzzleMesh, this.muzzleLight
    );
  }

  _generateCorpseLoot() {
    if (this.isOperator) {
      const wDef = GAME_DATA.ITEMS[this.weaponId];
      const ammoId = (wDef && wDef.ammoType) || 'ammo_545';
      const maxAmmo = ammoId === 'ammo_12g' ? 18 : (ammoId === 'ammo_762' ? 25 : 60);
      const items = [
        { id: ammoId, qty: Math.min(maxAmmo, 20 + Math.floor(Math.random() * 40)), revealed: false },
        { id: 'medkit', qty: 1 + (Math.random() < 0.35 ? 1 : 0), revealed: false },
        { id: 'armor_plate', qty: 1 + Math.floor(Math.random() * 3), revealed: false }
      ];
      if (Math.random() < 0.5) items.push({ id: 'bandage', qty: 1 + Math.floor(Math.random() * 2), revealed: false });
      if (Math.random() < 0.45) items.push({ id: Math.random() < 0.5 ? 'gold_watch' : 'water_filter', qty: 1, revealed: false });
      if (Math.random() < 0.3) items.push({ id: 'intel_drive', qty: 1, revealed: false });
      return items;
    }
    // Scavengers, Raiders, and Bosses drop their gun, plates, ammo (and boss pack) physically on death!
    return [];
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
    // Enemy Operators never show alert iconography (? / !)
    if (this.dead || this.isOperator || !this.alertSprite) return;
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
        // Seated downed posture: hide weapon, plant supporting arm to scoot, legs extended in front
        if (this.weaponMeshGroup) this.weaponMeshGroup.visible = false;
        this.group.position.y = -0.52;
        this.group.rotation.x = -0.24;
        if (this.leftHip) this.leftHip.rotation.x = -1.38;
        if (this.rightHip) this.rightHip.rotation.x = -1.38;
        if (this.leftArm) { this.leftArm.rotation.x = 0.65; this.leftArm.rotation.z = 0.25; }
        if (this.rightArm) { this.rightArm.rotation.x = -0.45; this.rightArm.rotation.z = -0.35; }
        if (this.alertSprite) this.alertSprite.visible = false;
        // Never show enemy revive symbols or bleedout status to the player
        if (this.bleedSprite) this.bleedSprite.visible = false;
        return false;
      }
      this.die();
      return true;
    }
    return false;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.isDowned = false;
    this.state = 'DEAD';
    if (this.alertSprite) this.alertSprite.visible = false;
    if (this.bleedSprite) this.bleedSprite.visible = false;
    this.group.rotation.x = -Math.PI / 2;
    this.group.position.y = 0.25;

    // Scavengers, Raiders, and Bosses physically drop their gun in-hand + occasional plates/ammo (up to 60) + Boss Small Pack!
    if (!this.isOperator && this.world && this.world.spawnGroundItem) {
      if (this.weaponMeshGroup) this.weaponMeshGroup.visible = false;
      const dropNear = (ox, oz) => new THREE.Vector3(this.position.x + ox, 0.02, this.position.z + oz);

      // 1. Always drop the gun they were holding
      if (this.weaponId && GAME_DATA.ITEMS[this.weaponId]) {
        this.world.spawnGroundItem(this.weaponId, 1, dropNear(0.45, 0.25));
      }
      // 2. Occasionally drop 1-2 armor plates
      const plateChance = this.tier === 'boss' ? 0.90 : (this.tier === 'raider' ? 0.55 : 0.35);
      if (Math.random() < plateChance) {
        const plateQty = 1 + (Math.random() < 0.45 ? 1 : 0);
        this.world.spawnGroundItem('armor_plate', plateQty, dropNear(-0.45, 0.35));
      }
      // 3. Occasionally drop ammo stack matching their gun (up to 60 rounds)
      const wDef = GAME_DATA.ITEMS[this.weaponId];
      const ammoChance = this.tier === 'boss' ? 0.95 : 0.65;
      if (wDef && wDef.ammoType && Math.random() < ammoChance) {
        const cap = wDef.ammoType === 'ammo_12g' ? 20 : (wDef.ammoType === 'ammo_762' ? 30 : 60);
        const qty = Math.min(cap, 15 + Math.floor(Math.random() * 46)); // up to 60 rounds
        this.world.spawnGroundItem(wDef.ammoType, qty, dropNear(0.15, -0.50));
      }
      // 4. Boss drops a lootable Small Pack containing rare valuables, a legendary weapon & Boss Key!
      if (this.tier === 'boss' && this.world.spawnBossPack) {
        this.world.spawnBossPack(dropNear(-0.65, -0.35), this.name);
      }
    }
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
    if (this.weaponMeshGroup) this.weaponMeshGroup.visible = true;
    if (this.leftHip) this.leftHip.rotation.x = 0;
    if (this.rightHip) this.rightHip.rotation.x = 0;
    if (this.leftArm) { this.leftArm.rotation.x = -0.8; this.leftArm.rotation.z = 0; }
    if (this.rightArm) { this.rightArm.rotation.x = -1.1; this.rightArm.rotation.z = 0; }
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

  _findBestHostileTarget(player, allEnemies) {
    let best = null;
    let bestDist = 32;

    // 1. Check Player (only if alive and standing — ignore downed players!)
    if (player && !player.dead && !player.isDowned) {
      const dist = this.position.distanceTo(player.position);
      const detectRange = player.isProne ? 13 : (player.isCrouching ? 20 : 30);
      if (dist < Math.min(bestDist, detectRange)) {
        let inVision = true;
        if (this.state === 'PATROL' && dist > 7.5) {
          const forwardX = Math.sin(this.group.rotation.y);
          const forwardZ = Math.cos(this.group.rotation.y);
          const dot = forwardX * ((player.position.x - this.position.x) / (dist || 1)) +
                      forwardZ * ((player.position.z - this.position.z) / (dist || 1));
          inVision = dot > 0.25;
        }
        if (inVision && this._hasLineOfSight(player.position, detectRange + 4)) {
          bestDist = dist;
          best = { type: 'player', ref: player, pos: player.position, dist };
        }
      }
    }

    // 2. PvPvE Hostility:
    //    - Operators are hostile to local AI (Scavs/Raiders/Bosses) AND rival Operator squads!
    //    - Local AI (Scavs/Raiders/Bosses) are hostile to Operators!
    for (const other of allEnemies) {
      if (!other || other === this || other.dead || other.isDowned || other.extracted) continue;
      const hostile = this.isOperator
        ? (!other.isOperator || other.squadName !== this.squadName)
        : (other.isOperator);
      if (!hostile) continue;

      const dist = this.position.distanceTo(other.position);
      if (dist >= bestDist || dist > 28) continue;
      const tgtEye = new THREE.Vector3(other.position.x, 1.4, other.position.z);
      if (this._hasLineOfSight(tgtEye, 30)) {
        bestDist = dist;
        best = { type: 'ai', ref: other, pos: other.position, dist };
      }
    }
    return best;
  }

  update(dt, player, onEnemyFire, onEnemyBleedout, allEnemies = [], squadGoal = null, onAiVsAiEvent = null) {
    if (this.extracted) return;
    if (this.dead) {
      // Non-operator bodies despawn after 60s to save resources
      if (!this.isOperator && !this.removed) {
        this.deathTimer = (this.deathTimer || 0) + dt;
        if (this.deathTimer >= 60.0) {
          this.removed = true;
          if (this.group && this.scene) this.scene.remove(this.group);
          this.hitboxes = [];
        }
      }
      return;
    }

    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.muzzleMesh.material.opacity = 0;
        this.muzzleLight.intensity = 0;
      }
    }

    // Update floating alert indicator (?, !) — strictly non-operator AI only
    if (this.indicatorTimer > 0) {
      this.indicatorTimer -= dt;
      const s = THREE.MathUtils.lerp(this.alertSprite.scale.x, 0.58, dt * 10);
      this.alertSprite.scale.set(s, s, 1);
      if (this.indicatorTimer <= 0 || this.isOperator) {
        this.alertSprite.visible = false;
      }
    }

    // Downed operator: pauses bleedout while being revived/dragged by a squadmate; never shows revive icons to player
    if (this.isDowned) {
      if (this.bleedSprite) this.bleedSprite.visible = false;
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
          // Supporting arm push-off scoot animation (heaving body along ground instead of kicking feet)
          this._scootCycle = (this._scootCycle || 0) + dt * 4.5;
          const phase = Math.sin(this._scootCycle);
          const heave = Math.max(0, phase);
          this.group.position.y = -0.52 + heave * 0.04;
          if (this.leftArm) this.leftArm.rotation.x = 0.65 + phase * 0.35;
          if (this.leftHip) this.leftHip.rotation.x = -1.32 - heave * 0.14;
          if (this.rightHip) this.rightHip.rotation.x = -1.36 - heave * 0.10;
        }
      } else {
        this.group.position.y = -0.52;
        if (this.leftHip) this.leftHip.rotation.x = -1.44;
        if (this.rightHip) this.rightHip.rotation.x = -1.44;
      }
      if (!this.beingRevivedBy && this.downedBleedTimer <= 0) {
        this.die();
        if (onEnemyBleedout) onEnemyBleedout(this);
      }
      return;
    }

    // Concussion stun state
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.group.rotation.y += Math.sin(performance.now() * 0.012) * dt * 2.5;
      return;
    }

    // Priority 0 for AI Operators: Revive & Drag-to-Cover downed squadmates (silently, no player-visible icons)
    if (this.isOperator && this.squadName && allEnemies.length > 0) {
      let downedMate = null;
      let bestMateDist = 28;
      for (const mate of allEnemies) {
        if (!mate || mate === this || mate.dead || !mate.isDowned || mate.extracted) continue;
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
        downedMate.beingRevivedBy = this.name;
        downedMate.reviveProgress = Math.min(1, (downedMate.reviveProgress || 0) + dt / 4.0);

        const threatPos = this.lastKnownPlayerPos || (player && !player.dead && !player.isDowned ? player.position : null);
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

    // Scan for nearest visible standing hostile (Player OR hostile AI faction!)
    const target = this._findBestHostileTarget(player, allEnemies);

    if (target) {
      if (this.state !== 'COMBAT') {
        this.state = 'COMBAT';
        this.fireTimer = 0.55;
        this.coverSpot = this._findBestCoverSpot(target.pos, 18);
        this.coverSearchTimer = 2.4;
        this.isPeeking = false;
        this.coverPeekTimer = 0.85;
        this._showAlertIndicator('!', 2.0);
        if (!this.isOperator && target.type === 'player') window.soundEngine.playAlert(true);
      }
      this.lastKnownPlayerPos = target.pos.clone();
      this.loseSightTimer = 4.0;
      this.alertTimer = 4.0;
    } else if (this.state === 'COMBAT') {
      this.loseSightTimer -= dt;
      if (this.loseSightTimer <= 0) {
        this.state = 'ALERT';
        this.alertTimer = 3.5;
        this.coverSpot = null;
        this._showAlertIndicator('?', 2.0);
      }
    } else if (this.state === 'ALERT') {
      this.alertTimer -= dt;
      if (this.alertTimer <= 0) {
        this.state = 'PATROL';
        this.lastKnownPlayerPos = null;
        this.coverSpot = null;
      }
    }

    // === COMBAT (Cover-First Peek-Fire-Tuck against Player OR Hostile AI!) ===
    if (this.state === 'COMBAT' && target) {
      const tPos = target.pos;
      const dx = tPos.x - this.position.x;
      const dz = tPos.z - this.position.z;
      this.group.rotation.y = Math.atan2(dx, dz);

      this.coverSearchTimer -= dt;
      if (!this.coverSpot || this.coverSearchTimer <= 0) {
        const refreshed = this._findBestCoverSpot(tPos, 18);
        if (refreshed) this.coverSpot = refreshed;
        this.coverSearchTimer = 2.8;
      }

      if (this.coverSpot) {
        this.coverPeekTimer -= dt;
        if (this.coverPeekTimer <= 0) {
          this.isPeeking = !this.isPeeking;
          this.coverPeekTimer = this.isPeeking ? (1.35 + Math.random() * 0.8) : (1.0 + Math.random() * 0.7);
        }
        const goal = this.isPeeking ? this.coverSpot.peekPos : this.coverSpot.coverPos;
        if (Math.hypot(goal.x - this.position.x, goal.z - this.position.z) > 0.45) {
          this._moveToward(goal, this.speed * (this.isPeeking ? 0.80 : 1.05), dt, tPos);
        }
      } else if (target.dist > 22) {
        this._moveToward(tPos, this.speed * 0.85, dt, tPos);
      }

      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = this.fireInterval + Math.random() * 0.22;
        const distToPlayer = player ? this.position.distanceTo(player.position) : 40;
        if (distToPlayer < 75) {
          window.soundEngine.playGunshot(this.weaponId, distToPlayer);
        }
        this.muzzleMesh.material.opacity = 0.95;
        this.muzzleLight.intensity = 3.0;
        this.muzzleTimer = 0.055;

        const muzzleWorld = new THREE.Vector3();
        this.muzzleMesh.getWorldPosition(muzzleWorld);

        const hitChance = Math.max(0.15, (1 - target.dist / 75) * (1 - this.accuracy * 2.5));
        const hit = Math.random() < hitChance;

        if (target.type === 'player') {
          onEnemyFire(this, hit, this.damage, muzzleWorld);
        } else {
          // AI vs AI Firefight (Operators vs Scavengers/Raiders/Bosses/Rival Operators!)
          const tgtEnemy = target.ref;
          const aimPos = new THREE.Vector3(tgtEnemy.position.x, 1.3, tgtEnemy.position.z);
          if (onAiVsAiEvent) onAiVsAiEvent('shot', this, tgtEnemy, muzzleWorld, aimPos);
          if (hit) {
            const wDef = GAME_DATA.ITEMS[this.weaponId];
            const info = {
              name: this.name,
              isPlayer: false,
              isOperator: this.isOperator,
              weaponId: this.weaponId,
              weaponName: wDef ? wDef.name : 'AK-74M'
            };
            const killed = tgtEnemy.takeDamage(this.damage, this.position, info);
            if (tgtEnemy.justDowned) {
              tgtEnemy.justDowned = false;
              if (onAiVsAiEvent) onAiVsAiEvent('downed', this, tgtEnemy, muzzleWorld, aimPos, info);
            }
            if (killed && onAiVsAiEvent) {
              onAiVsAiEvent('eliminated', this, tgtEnemy, muzzleWorld, aimPos, info);
            }
          }
        }
      }
      return;
    }

    // === NON-COMBAT: OPERATOR SQUAD OBJECTIVES (POI -> EXTRACT) & FORMATION COHESION ===
    if (this.isOperator && squadGoal) {
      const distGoal = Math.hypot(squadGoal.x - this.position.x, squadGoal.z - this.position.z);
      if (distGoal > 2.2) {
        this._moveToward(squadGoal, this.speed * 0.85, dt);
      }
      return;
    }

    if (this.state === 'ALERT' && this.lastKnownPlayerPos) {
      this._moveToward(this.lastKnownPlayerPos, this.speed * 0.85, dt);
    } else {
      const moved = this._moveToward(this.patrolTarget, this.speed * 0.55, dt);
      if (!moved || Math.random() < 0.005) {
        this.patrolTarget = this._pickPatrolPoint();
      }
    }
  }
}

class EnemyManager {
  constructor(scene, world, zoneConfig, weaponSystem = null) {
    this.scene = scene;
    this.world = world;
    this.weaponSystem = weaponSystem;
    this.enemies = [];

    // 1. Spawn 6 AI Operator Squads (1-3 operators each, shared POI objectives -> Extraction, tight cohesion!)
    this.squadPlans = {};
    const squadPrefixes = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT'];
    const callsigns = [
      'VIPER', 'PHANTOM', 'REAPER', 'COBALT', 'STRYKER', 'WRAITH',
      'JACKAL', 'HAWK', 'SPECTRE', 'BANDIT', 'NOMAD', 'SABLE',
      'KODIAK', 'TALON', 'ZERO', 'ORION', 'BISHOP', 'BLITZ'
    ];
    const styles = ['rusher', 'flanker', 'tactical', 'marksman'];
    const anchorPts = [...world.spawnPoints].sort(() => Math.random() - 0.5);
    const worldPois = (world.pois && world.pois.length > 0)
      ? world.pois.map(p => new THREE.Vector3(p.x, 0, p.z))
      : [new THREE.Vector3(-20, 0, -20), new THREE.Vector3(20, 0, -20), new THREE.Vector3(0, 0, 15)];
    const extracts = (world.extractZones && world.extractZones.length > 0)
      ? world.extractZones
      : [{ position: new THREE.Vector3(0, 0, -55), radius: 5.5 }];

    let nameIdx = 0;
    for (let s = 0; s < 6; s++) {
      const sqName = squadPrefixes[s];
      const anchor = anchorPts[s % anchorPts.length] || new THREE.Vector3((s - 3) * 18, 0, -20);
      const squadSize = 1 + Math.floor(Math.random() * 3); // 1 to 3 operators per squad

      // Build this squad's multi-stage raid objective plan: 2 shuffled POIs -> Extract Zone!
      const shuffledPois = [...worldPois].sort(() => Math.random() - 0.5);
      const exZone = extracts[s % extracts.length];
      this.squadPlans[sqName] = {
        phase: 'POI', // 'POI' | 'EXTRACT' | 'EXTRACTED'
        pois: shuffledPois.slice(0, Math.min(2, shuffledPois.length)),
        poiIdx: 0,
        dwellTimer: 9 + Math.random() * 5,
        extractZone: exZone,
        extractTimer: 0
      };

      for (let m = 0; m < squadSize; m++) {
        const off = new THREE.Vector3((m - 1) * 2.4, 0, (m % 2) * 2.0);
        const pos = anchor.clone().add(off);
        const style = styles[Math.floor(Math.random() * styles.length)];
        const callsign = `[${sqName}] ${callsigns[nameIdx % callsigns.length]}`;
        nameIdx++;
        const op = new Enemy(scene, world, pos, 'raider', {
          isOperator: true,
          squadName: sqName,
          callsign,
          playstyle: style
        }, weaponSystem);
        op.formationIndex = m;
        this.enemies.push(op);
      }
    }

    // 2. Spawn Scavengers & Raiders patrolling POIs (drop gun-in-hand + occasional plates/ammo up to 60)
    const aiSpawns = [
      { pos: new THREE.Vector3(-24, 0, -14), tier: 'scav' },
      { pos: new THREE.Vector3(-18, 0, -28), tier: 'scav' },
      { pos: new THREE.Vector3(20, 0, -12), tier: 'raider' },
      { pos: new THREE.Vector3(14, 0, 18), tier: 'scav' },
      { pos: new THREE.Vector3(-14, 0, 22), tier: 'raider' }
    ];
    for (const sp of aiSpawns) {
      this.enemies.push(new Enemy(scene, world, sp.pos, sp.tier, null, weaponSystem));
    }

    // 3. Spawn Sector Boss at the Boss Encampment POI (drops gun + plates/ammo + Boss Small Pack w/ Boss Key & Legendary Weapon!)
    const bossPoi = (world.pois || []).find(p => (p.name || '').toLowerCase().includes('boss'));
    const bossPos = bossPoi
      ? new THREE.Vector3(bossPoi.x + 2.5, 0, bossPoi.z + 3.5)
      : new THREE.Vector3(28, 0, -28);
    this.enemies.push(new Enemy(scene, world, bossPos, 'boss', null, weaponSystem));
  }

  getHitboxMeshes() {
    const list = [];
    for (const e of this.enemies) {
      if (!e.dead && !e.extracted) list.push(...e.hitboxes);
    }
    return list;
  }

  alertNearby(pos, radius = 38) {
    for (const e of this.enemies) {
      if (!e.dead && !e.extracted && e.position.distanceTo(pos) < radius) {
        e.alertToPosition(pos);
      }
    }
  }

  _updateSquadPlans(dt, raidTimeLeft) {
    for (const [sqName, plan] of Object.entries(this.squadPlans || {})) {
      if (plan.phase === 'EXTRACTED') continue;
      const members = this.enemies.filter(e => e.isOperator && e.squadName === sqName && !e.dead && !e.extracted);
      if (members.length === 0) {
        plan.phase = 'EXTRACTED';
        continue;
      }
      const standing = members.filter(m => !m.isDowned);
      const leader = standing[0] || members[0];
      plan.leader = leader;

      // Switch to extraction when raid timer gets low
      if (raidTimeLeft < 110 && plan.phase === 'POI') {
        plan.phase = 'EXTRACT';
      }

      if (plan.phase === 'POI') {
        const curPoi = plan.pois[plan.poiIdx];
        if (!curPoi) {
          plan.phase = 'EXTRACT';
        } else {
          const dPoi = Math.hypot(leader.position.x - curPoi.x, leader.position.z - curPoi.z);
          if (dPoi < 8.5) {
            plan.dwellTimer -= dt;
            if (plan.dwellTimer <= 0) {
              plan.poiIdx += 1;
              if (plan.poiIdx >= plan.pois.length) {
                plan.phase = 'EXTRACT';
              } else {
                plan.dwellTimer = 9 + Math.random() * 5;
              }
            }
          }
        }
      } else if (plan.phase === 'EXTRACT' && plan.extractZone) {
        const ez = plan.extractZone;
        const dEx = Math.hypot(leader.position.x - ez.position.x, leader.position.z - ez.position.z);
        if (dEx <= (ez.radius || 5.5) + 2.5) {
          plan.extractTimer += dt;
          if (plan.extractTimer >= 5.0) {
            plan.phase = 'EXTRACTED';
            for (const m of members) {
              m.extracted = true;
              if (m.group) m.group.visible = false;
            }
          }
        } else {
          plan.extractTimer = Math.max(0, plan.extractTimer - dt * 0.5);
        }
      }
    }
  }

  _getSquadGoalFor(op) {
    if (!op.isOperator || !op.squadName) return null;
    const plan = this.squadPlans && this.squadPlans[op.squadName];
    if (!plan || plan.phase === 'EXTRACTED') return null;

    const leader = plan.leader;
    const isLeader = !leader || leader === op;
    if (!isLeader) {
      // Squadmates stick tightly in formation around their squad leader!
      const angle = (op.formationIndex || 1) * 2.1;
      const fx = leader.position.x + Math.cos(angle) * 3.4;
      const fz = leader.position.z + Math.sin(angle) * 3.4;
      return new THREE.Vector3(fx, 0, fz);
    }

    if (plan.phase === 'EXTRACT' && plan.extractZone) {
      return plan.extractZone.position;
    }
    return plan.pois[plan.poiIdx] || null;
  }

  update(dt, player, onEnemyFire, onEnemyBleedout, raidTimeLeft = 300, onAiVsAiEvent = null) {
    this._updateSquadPlans(dt, raidTimeLeft);
    for (const e of this.enemies) {
      const goal = e.isOperator ? this._getSquadGoalFor(e) : null;
      e.update(dt, player, onEnemyFire, onEnemyBleedout, this.enemies, goal, onAiVsAiEvent);
    }
  }
}
