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

    // Tier & Operator Playstyle stats (boosted speeds + player-like tactical mechanics)
    if (this.isOperator) {
      this.name = opMeta.callsign;
      const styles = {
        rusher:   { hp: 105, dmg: 11, fire: 0.20, acc: 0.11, spd: 5.9, wpn: 'mp5k',  col: 0x3b4852 },
        flanker:  { hp: 115, dmg: 13, fire: 0.24, acc: 0.08, spd: 5.3, wpn: 'ak74m', col: 0x424d3b },
        tactical: { hp: 130, dmg: 14, fire: 0.26, acc: 0.06, spd: 4.6, wpn: 'ak74m', col: 0x383d42 },
        marksman: { hp: 120, dmg: 22, fire: 0.72, acc: 0.03, spd: 3.6, wpn: 'm24',   col: 0x4a4536 }
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
      const bags = ['bag_small', 'bag_medium', 'bag_large', 'bag_weapon'];
      const melees = ['melee_knife', 'melee_karambit', 'melee_axe'];
      const fus = ['fu_ammo_box', 'fu_dead_silence', 'fu_trophy'];
      const secId = Math.random() < 0.55 ? 'g17' : 'pm9';
      const pDef = GAME_DATA.ITEMS[this.weaponId];
      const sDef = GAME_DATA.ITEMS[secId];
      const pRoll = GAME_DATA.rollRandomAttachmentsForRarity
        ? GAME_DATA.rollRandomAttachmentsForRarity(this.weaponId, (pDef && pDef.rarity) || 'rare')
        : { mods: {}, rarity: (pDef && pDef.rarity) || 'rare' };
      const sRoll = GAME_DATA.rollRandomAttachmentsForRarity
        ? GAME_DATA.rollRandomAttachmentsForRarity(secId, (sDef && sDef.rarity) || 'common')
        : { mods: {}, rarity: (sDef && sDef.rarity) || 'common' };
      this.operatorEquipment = {
        primary: this.weaponId,
        primaryMods: pRoll.mods,
        primaryRarity: pRoll.rarity,
        secondary: secId,
        secondaryMods: sRoll.mods,
        secondaryRarity: sRoll.rarity,
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
      // Real vest armor + player-like tactical combat state
      const vestDef = GAME_DATA.ITEMS[this.operatorEquipment.armor];
      this.maxArmor = vestDef ? (vestDef.maxArmor || ((vestDef.plateSlots || 2) * 50)) : 100;
      this.armor = this.maxArmor;
      this.platingTimer = 0;
      this.tacStamina = 100;
      this.isTacSprinting = false;
      this.slideTimer = 0;
      this.slideCooldown = 0;
      this.slideDir = new THREE.Vector3();
      this.leanAngle = 0;
      this.leanDir = Math.random() < 0.5 ? -1 : 1;
      this.grenadeCooldown = 4.5 + Math.random() * 5.0;
      this.grenadesLeft = 2;
      this.smokeLeft = 1;
      this.focusedTarget = null;
      this.targetLockTimer = 0;
      this.activeGrenades = [];
    } else if (tier === 'boss') {
      this.name = 'COMMANDER VULTURE';
      this.maxHp = 260;
      this.maxArmor = 150;
      this.armor = 150;
      this.damage = 18;
      this.fireInterval = 0.20;
      this.accuracy = 0.06;
      this.speed = 3.0;
      this.armorColor = 0x3b1e22;
      this.headColor = 0x1d1e22;
      const bossWpns = ['ak74m', 'm24', 'awm338', 'm870'];
      this.weaponId = bossWpns[Math.floor(Math.random() * bossWpns.length)];
    } else if (tier === 'boss_guard') {
      this.name = 'Armored Command Guard';
      this.maxHp = 145;
      this.maxArmor = 125;
      this.armor = 125;
      this.damage = 15;
      this.fireInterval = 0.23;
      this.accuracy = 0.068;
      this.speed = 3.4;
      this.armorColor = 0x222830;
      this.headColor = 0x1a1e24;
      // Armored Boss Guards carry higher-tier weapons than standard raiders!
      const guardWpns = ['ak74m', 'm24', 'awm338', 'mp5k', 'm870'];
      this.weaponId = guardWpns[Math.floor(Math.random() * guardWpns.length)];
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
    const initGy = (this.world && this.world.getTerrainHeight) ? this.world.getTerrainHeight(spawnPos.x, spawnPos.z) : 0;
    // Preserve elevated floor spawn height (e.g. Boss on 2nd floor of Command Center)
    const spawnY = (spawnPos.y > initGy + 1.2) ? spawnPos.y : initGy;
    this._elevatedFloorY = (spawnPos.y > initGy + 1.2) ? spawnPos.y : null;
    this.homePos = new THREE.Vector3(spawnPos.x, spawnY, spawnPos.z);
    this.position = new THREE.Vector3(spawnPos.x, spawnY, spawnPos.z);
    // Ensure spawn position is never trapped inside a solid building wall
    if (this.world && this.world.colliders && !this._elevatedFloorY && this._collides(this.position.x, this.position.z, 0.5)) {
      for (let rad = 1.5; rad <= 9.0; rad += 1.5) {
        let freed = false;
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const tx = spawnPos.x + Math.cos(ang) * rad;
          const tz = spawnPos.z + Math.sin(ang) * rad;
          if (!this._collides(tx, tz, 0.5)) {
            const gy = (this.world && this.world.getTerrainHeight) ? this.world.getTerrainHeight(tx, tz) : 0;
            this.position.set(tx, gy, tz);
            this.homePos.set(tx, gy, tz);
            freed = true;
            break;
          }
        }
        if (freed) break;
      }
    }
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
    this.group.rotation.order = 'YXZ';
    this.group.position.copy(this.position);
    this.hitboxes = [];
    this._buildModel();
    this._buildAlertSprite();
    this.scene.add(this.group);

    this.lootItems = this._generateCorpseLoot();
  }

  _getGroundY(x = this.position.x, z = this.position.z) {
    const ty = (this.world && this.world.getTerrainHeight) ? this.world.getTerrainHeight(x, z) : 0;
    if (this._elevatedFloorY != null && Math.hypot(x - this.homePos.x, z - this.homePos.z) < 9.5) {
      return Math.max(ty, this._elevatedFloorY);
    }
    return ty;
  }

  _buildModel() {
    // Use the global articulated low-poly tactical operator model for all Enemy Operators (with equipped vest, backpack & 3D weapon!)
    if (this.isOperator && typeof window.buildTacticalOperatorModel === 'function') {
      const built = window.buildTacticalOperatorModel({
        uniformColor: this.armorColor || 0x3b4437,
        vestId: (this.operatorEquipment && this.operatorEquipment.armor) || 'vest_2',
        bagId: (this.operatorEquipment && this.operatorEquipment.backpack) || 'bag_medium',
        faceForwardZ: true
      });
      this.group.add(built.root);
      this.leftHip = built.leftLeg.hip;
      this.rightHip = built.rightLeg.hip;
      this.leftKnee = built.leftLeg.knee || null;
      this.rightKnee = built.rightLeg.knee || null;
      this.leftArm = built.leftArm.shoulder;
      this.rightArm = built.rightArm.shoulder;
      this.leftElbow = built.leftArm.elbow || null;
      this.rightElbow = built.rightArm.elbow || null;
      this.torsoGroup = built.torso || null;
      this.headGroup = built.head || null;
      this.opModel = built;

      built.chest.userData = { enemy: this, part: 'torso' };
      built.skull.userData = { enemy: this, part: 'head' };
      this.hitboxes.push(built.chest, built.skull);

      const wDef = GAME_DATA.ITEMS[this.weaponId];
      let weaponObj = null;
      let muzzleLocalPos = new THREE.Vector3(0, 0.03, -0.44);
      if (this.weaponSystem && wDef && this.weaponSystem.buildThirdPersonWeapon) {
        const builtWpn = this.weaponSystem.buildThirdPersonWeapon(wDef, {});
        if (builtWpn && builtWpn.group) {
          weaponObj = builtWpn.group;
          weaponObj.scale.setScalar(builtWpn.isPistol ? 1.25 : 1.38);
          weaponObj.position.set(0, 0.04, builtWpn.isPistol ? -0.06 : -0.18);
          if (builtWpn.muzzlePos) {
            muzzleLocalPos.copy(builtWpn.muzzlePos);
          } else {
            muzzleLocalPos.set(0, 0.04, builtWpn.isPistol ? -0.24 : -0.52);
          }
        }
      }
      if (!weaponObj) {
        weaponObj = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.62), new THREE.MeshLambertMaterial({ color: 0x1a1c1e }));
        weaponObj.position.set(0, 0.04, -0.22);
        muzzleLocalPos.set(0, 0, -0.34);
      }
      if (built.weaponMount) built.weaponMount.add(weaponObj);
      this.weaponMeshGroup = weaponObj;

      // Visible 3D ceramic armor plate prop in operator's left hand during plating animation
      this.plateProp = new THREE.Group();
      const plateBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.22, 0.024),
        new THREE.MeshLambertMaterial({ color: 0x22384c })
      );
      const plateTrim = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.03, 0.028),
        new THREE.MeshLambertMaterial({ color: 0x4ea8de })
      );
      plateTrim.position.y = 0.07;
      this.plateProp.add(plateBody, plateTrim);
      this.plateProp.position.set(0, -0.11, -0.04);
      this.plateProp.rotation.set(0.35, 0, 0.15);
      this.plateProp.visible = false;
      if (built.leftArm && built.leftArm.wrist) {
        built.leftArm.wrist.add(this.plateProp);
      }

      // Attach muzzle flash directly to the physical gun barrel tip so bullets & tracers spawn from the muzzle!
      this.muzzleMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffcc55, transparent: true, opacity: 0 })
      );
      this.muzzleMesh.position.copy(muzzleLocalPos);
      this.muzzleLight = null;
      this.muzzleTimer = 0;
      weaponObj.add(this.muzzleMesh);
      return;
    }

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
    let npcMuzzleLocal = new THREE.Vector3(0, 0.02, 0.34);
    if (this.weaponSystem && wDef && this.weaponSystem.buildThirdPersonWeapon) {
      const built = this.weaponSystem.buildThirdPersonWeapon(wDef, {});
      if (built && built.group) {
        weaponObj = built.group;
        weaponObj.scale.setScalar(1.22);
        weaponObj.position.set(0.24, 1.24, 0.36);
        weaponObj.rotation.set(0, Math.PI, 0); // barrel points along +Z (enemy forward)
        if (built.muzzlePos) {
          npcMuzzleLocal.copy(built.muzzlePos);
        } else {
          npcMuzzleLocal.set(0, 0.04, built.isPistol ? -0.24 : -0.52);
        }
      }
    }
    if (!weaponObj) {
      weaponObj = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.65), gunMat);
      weaponObj.position.set(0.25, 1.24, 0.42);
    }
    this.weaponMeshGroup = weaponObj;

    // Rifle muzzle flash attached directly to barrel tip
    this.muzzleMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffcc55, transparent: true, opacity: 0 })
    );
    this.muzzleMesh.position.copy(npcMuzzleLocal);
    this.muzzleLight = null;
    this.muzzleTimer = 0;
    weaponObj.add(this.muzzleMesh);

    this.group.add(
      this.leftHip, this.rightHip, torso, head,
      this.leftArm, this.rightArm, weaponObj
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
    this.lastHitArmor = false;
    this.justBrokeArmor = false;

    if (this.isDowned) {
      if (attackerInfo) this.downedBy = attackerInfo;
      this.downedHp -= amount;
      if (this.downedHp <= 0) {
        this.die();
        return true;
      }
      return false;
    }

    // Operators & Armored Boss Guards absorb incoming fire with their vest armor just like players!
    this.timeSinceDamaged = 0;
    if ((this.isOperator || this.tier === 'boss_guard' || this.tier === 'boss') && this.armor > 0) {
      this.lastHitArmor = true;
      const absorbed = Math.min(this.armor, Math.round(amount * 0.78));
      this.armor = Math.max(0, this.armor - absorbed);
      if (this.armor <= 0) {
        this.justBrokeArmor = true;
      }
      amount -= absorbed;
    }
    this.hp -= amount;
    if (this.isOperator && attackerInfo && attackerInfo.isPlayer) {
      this.targetLockTimer = 5.5;
    }
    if (attackerPos) {
      this.lastKnownPlayerPos = attackerPos.clone();
      this.loseSightTimer = 5.5;
      this.alertTimer = 5.0;
      if (this.state !== 'COMBAT') {
        this.state = 'COMBAT';
        this.fireTimer = 0.32;
        this._showAlertIndicator('!', 2.2);
      }
      // Immediately turn toward the attacker damaging them & seek cover (or drop prone if no cover exists!)
      const dxA = attackerPos.x - this.position.x;
      const dzA = attackerPos.z - this.position.z;
      if (this.group && (dxA * dxA + dzA * dzA) > 0.01) {
        this.group.rotation.y = Math.atan2(dxA, dzA);
      }
      if (this.isOperator && this.hp > 0) {
        const cov = this._findBestCoverSpot(attackerPos, 18);
        if (cov) {
          this.coverSpot = cov;
          this.isPeeking = false;
          this.isProne = false;
        } else {
          // No nearby cover: drop prone immediately and fight back!
          this.isProne = true;
          this.proneTimer = 4.5;
        }
      }
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
        // Seated downed posture: hide weapon, plant supporting arm to scoot, legs extended in front above ground
        if (this.weaponMeshGroup) this.weaponMeshGroup.visible = false;
        const gyDown = this._getGroundY();
        this.position.y = gyDown;
        this.group.position.y = gyDown - 0.50;
        this.group.rotation.x = -0.22;
        this.group.rotation.z = 0;
        if (this.leftHip) this.leftHip.rotation.x = -1.38;
        if (this.rightHip) this.rightHip.rotation.x = -1.38;
        if (this.leftArm) { this.leftArm.rotation.x = 0.55; this.leftArm.rotation.z = 0.24; }
        if (this.rightArm) { this.rightArm.rotation.x = -0.75; this.rightArm.rotation.z = -0.45; }
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
    const gyDead = this._getGroundY();
    this.position.y = gyDead;
    this.group.position.y = gyDead + 0.16;
    // Reset limbs flat so corpses never have legs sticking up in the air from a downed pose!
    if (this.leftHip) this.leftHip.rotation.set(0, 0, -0.06);
    if (this.rightHip) this.rightHip.rotation.set(0, 0, 0.06);
    if (this.leftArm) this.leftArm.rotation.set(0, 0, 0.28);
    if (this.rightArm) this.rightArm.rotation.set(0, 0, -0.28);

    // Scavengers, Raiders, and Bosses physically drop their gun in-hand + occasional plates/ammo (up to 60) + Boss Small Pack!
    if (!this.isOperator && this.world && this.world.spawnGroundItem) {
      if (this.weaponMeshGroup) this.weaponMeshGroup.visible = false;
      const dropNear = (ox, oz) => new THREE.Vector3(this.position.x + ox, 0.02, this.position.z + oz);

      // 1. Always drop the gun they were holding (with randomized attachments matching its tier rarity)
      if (this.weaponId && GAME_DATA.ITEMS[this.weaponId]) {
        const dropRar = this.tier === 'boss' ? 'legendary' : (this.tier === 'boss_guard' ? 'epic' : (this.tier === 'raider' ? 'rare' : 'common'));
        const rolled = GAME_DATA.rollRandomAttachmentsForRarity
          ? GAME_DATA.rollRandomAttachmentsForRarity(this.weaponId, dropRar)
          : { mods: {}, rarity: dropRar };
        this.world.spawnGroundItem(this.weaponId, 1, dropNear(0.45, 0.25), {
          mods: rolled.mods,
          rarityOverride: rolled.rarity
        });
      }
      // 2. Occasionally drop 1-2 armor plates
      const plateChance = this.tier === 'boss' ? 0.90 : (this.tier === 'boss_guard' ? 0.85 : (this.tier === 'raider' ? 0.55 : 0.35));
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
    const eye = new THREE.Vector3(this.position.x, this.position.y + 1.55, this.position.z);
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
    const hits = ray.intersectObjects((this.world.wallMeshes && this.world.wallMeshes.length > 0) ? this.world.wallMeshes : this.world.shootableMeshes, false);
    return hits.length === 0;
  }

  _moveToward(target, speed, dt, faceTarget = null) {
    if (!target || typeof target.x !== 'number' || typeof target.z !== 'number' || !Number.isFinite(target.x) || !Number.isFinite(target.z)) {
      return false;
    }
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

    const gy = (this.world && this.world.getTerrainHeight) ? this.world.getTerrainHeight(this.position.x, this.position.z) : 0;
    this.position.y = gy;
    this.group.position.x = this.position.x;
    this.group.position.y = gy;
    this.group.position.z = this.position.z;

    if (faceTarget) {
      this.group.rotation.y = Math.atan2(faceTarget.x - this.position.x, faceTarget.z - this.position.z);
    } else {
      this.group.rotation.y = Math.atan2(dx, dz);
    }

    // Leg walk animation around hip pivots + articulated knee/arm/torso motion
    this._animMoving = true;
    this._animSpeed = speed;
    this.updateVisualAnim(dt, true, speed);
    return true;
  }

  // Articulated motion-capture-adjacent 3rd-person animation (also runs smoothly at long sniper scope distances!)
  updateVisualAnim(dt, movingOverride = null, speedOverride = null) {
    if (this.dead || this.isDowned) return;
    const isMoving = movingOverride !== null ? movingOverride : !!this._animMoving;
    const spd = speedOverride !== null ? speedOverride : (this._animSpeed || this.speed || 3.4);
    const isSprinting = isMoving && (this.isTacSprinting || spd >= 4.6);
    const isCrouching = !isMoving && (this.state === 'COMBAT' && this.coverTarget != null);
    const isFocusing = this.state === 'COMBAT' && !isSprinting;
    const isPlating = (this.platingTimer || 0) > 0;
    const isReloading = (this.reloadTimer || 0) > 0;

    if (isMoving) {
      this._walkPhase = (this._walkPhase || 0) + dt * (isSprinting ? 10.5 : 7.2);
    }
    const ph = this._walkPhase || 0;
    const strideAmp = isMoving ? (isSprinting ? 0.72 : 0.46) : 0;
    const lSwing = Math.sin(ph) * strideAmp;
    const rSwing = -Math.sin(ph) * strideAmp;

    // Articulated Hip & Knee kinematics
    if (this.leftHip && this.rightHip) {
      const targetLHip = isCrouching ? -0.78 : lSwing;
      const targetRHip = isCrouching ? -0.58 : rSwing;
      this.leftHip.rotation.x = THREE.MathUtils.lerp(this.leftHip.rotation.x, targetLHip, Math.min(1, dt * 12));
      this.rightHip.rotation.x = THREE.MathUtils.lerp(this.rightHip.rotation.x, targetRHip, Math.min(1, dt * 12));
    }
    if (this.leftKnee && this.rightKnee) {
      const targetLKnee = isCrouching ? 1.38 : (isMoving ? Math.max(0.08, -lSwing * 0.95 + 0.22) : 0.08);
      const targetRKnee = isCrouching ? 1.15 : (isMoving ? Math.max(0.08, -rSwing * 0.95 + 0.22) : 0.08);
      this.leftKnee.rotation.x = THREE.MathUtils.lerp(this.leftKnee.rotation.x, targetLKnee, Math.min(1, dt * 12));
      this.rightKnee.rotation.x = THREE.MathUtils.lerp(this.rightKnee.rotation.x, targetRKnee, Math.min(1, dt * 12));
    }

    // Articulated Torso lean, crouch drop & PRONE combat fighting posture when no cover is available!
    if (this.group) {
      this.group.visible = !this.extracted && !this.removed;
      this.group.position.x = this.position.x;
      this.group.position.z = this.position.z;
      const baseGy = this._getGroundY();
      const targetRotX = this.isProne ? 1.28 : 0;
      const targetY = this.isProne ? (baseGy + 0.26) : baseGy;
      this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, targetRotX, Math.min(1, dt * 9));
      this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, targetY, Math.min(1, dt * 9));
    }
    if (this.torsoGroup) {
      const targetTorsoX = this.isProne ? -0.35 : (isCrouching ? 0.24 : (isSprinting ? 0.16 : (isFocusing ? 0.08 : 0.02)));
      this.torsoGroup.rotation.x = THREE.MathUtils.lerp(this.torsoGroup.rotation.x, targetTorsoX, Math.min(1, dt * 10));
    }

    // Articulated Arms & Elbows (Focusing ADS, Reloading, Plating, Sprinting)
    const nowS = (this._animTime = (this._animTime || 0) + dt);
    if (this.plateProp) this.plateProp.visible = isPlating;
    if (this.leftArm && this.rightArm) {
      if (this.opModel) {
        // Articulated Tactical Operator rig (positive shoulder.x & elbow.x swing forward/up across chest)
        let lX = 0.84, rX = 0.88, lZ = 0.44, rZ = -0.14;
        let lElb = 0.92, rElb = 0.76;
        if (isPlating) {
          // 3-phase armor plate insertion: 1) reach hip pouch -> 2) lift plate to vest -> 3) slide into carrier
          const pProg = THREE.MathUtils.clamp(1 - ((this.platingTimer || 0) / 1.9), 0, 1);
          if (pProg < 0.28) {
            const k = pProg / 0.28;
            lX = THREE.MathUtils.lerp(0.65, 0.22, k);
            lZ = THREE.MathUtils.lerp(0.35, -0.22, k);
            lElb = THREE.MathUtils.lerp(0.75, 0.35, k);
          } else if (pProg < 0.65) {
            const k = (pProg - 0.28) / 0.37;
            lX = THREE.MathUtils.lerp(0.22, 1.48, k);
            lZ = THREE.MathUtils.lerp(-0.22, 0.68, k);
            lElb = THREE.MathUtils.lerp(0.35, 1.55, k);
          } else {
            const k = (pProg - 0.65) / 0.35;
            lX = THREE.MathUtils.lerp(1.48, 0.92, k);
            lZ = THREE.MathUtils.lerp(0.68, 0.52, k);
            lElb = THREE.MathUtils.lerp(1.55, 1.15, k);
          }
          // Right hand dips weapon down/out to clear the front plate carrier
          rX = 0.36;
          rZ = -0.26;
          rElb = 0.55;
        } else if (isReloading) {
          const cyc = (nowS * 2.6) % 1;
          lX = 0.62 + Math.sin(cyc * Math.PI) * 0.55;
          lZ = 0.42;
          rX = 0.82;
          rZ = -0.12;
          lElb = 1.25;
        } else if (isFocusing) {
          lX = 0.90;
          rX = 0.94;
          lZ = 0.46;
          rZ = -0.14;
          lElb = 0.94;
          rElb = 0.80;
        } else if (isSprinting) {
          lX = 0.52 + Math.sin(ph) * 0.26;
          rX = 1.05 - Math.sin(ph) * 0.18;
          lZ = 0.24;
          rZ = -0.20;
          lElb = 0.85;
          rElb = 0.90;
        }
        this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, lX, Math.min(1, dt * 12));
        this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, rX, Math.min(1, dt * 12));
        this.leftArm.rotation.z = THREE.MathUtils.lerp(this.leftArm.rotation.z, lZ, Math.min(1, dt * 12));
        this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, rZ, Math.min(1, dt * 12));
        if (this.leftElbow) this.leftElbow.rotation.x = THREE.MathUtils.lerp(this.leftElbow.rotation.x, lElb, Math.min(1, dt * 12));
        if (this.rightElbow) this.rightElbow.rotation.x = THREE.MathUtils.lerp(this.rightElbow.rotation.x, rElb, Math.min(1, dt * 12));
      } else {
        let lX = -0.82, rX = -1.02, lZ = 0.14, rZ = -0.10;
        let lElb = -0.75, rElb = -0.85;
        if (isPlating) {
          const cyc = (nowS * 2.2) % 1;
          lX = -1.15 - Math.sin(cyc * Math.PI) * 0.45;
          lZ = 0.48;
          rX = -0.45;
          lElb = -1.25;
        } else if (isReloading) {
          const cyc = (nowS * 2.6) % 1;
          lX = -0.65 - Math.sin(cyc * Math.PI) * 0.65;
          lZ = 0.35;
          rX = -0.95;
          rZ = 0.18;
          lElb = -1.3;
        } else if (isFocusing) {
          lX = -1.28;
          rX = -1.36;
          lZ = 0.22;
          rZ = -0.06;
          lElb = -0.92;
          rElb = -1.05;
        } else if (isSprinting) {
          lX = -1.15 + Math.sin(ph) * 0.22;
          rX = -1.25 - Math.sin(ph) * 0.22;
          lZ = 0.28;
          rZ = -0.22;
        }
        this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, lX, Math.min(1, dt * 11));
        this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, rX, Math.min(1, dt * 11));
        this.leftArm.rotation.z = THREE.MathUtils.lerp(this.leftArm.rotation.z, lZ, Math.min(1, dt * 11));
        this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, rZ, Math.min(1, dt * 11));
        if (this.leftElbow) this.leftElbow.rotation.x = THREE.MathUtils.lerp(this.leftElbow.rotation.x, lElb, Math.min(1, dt * 11));
        if (this.rightElbow) this.rightElbow.rotation.x = THREE.MathUtils.lerp(this.rightElbow.rotation.x, rElb, Math.min(1, dt * 11));
      }
    }

    // Cheek-weld head tilt when focusing weapon
    if (this.headGroup) {
      const targetHeadZ = isFocusing ? -0.10 : 0;
      this.headGroup.rotation.z = THREE.MathUtils.lerp(this.headGroup.rotation.z, targetHeadZ, Math.min(1, dt * 10));
    }
  }

  _collides(x, z, r) {
    const list = this.world.getNearbyColliders ? this.world.getNearbyColliders(x, z, r + 0.5) : this.world.colliders;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.doorRef && c.doorRef.passable) continue;
      if (c.maxY < 0.2) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        // AI operator walking up to a closed door automatically pushes it open instead of phasing through!
        if (c.doorRef && !c.doorRef.passable && this.world && this.world.interactDoor && c.doorRef.state === 'closed') {
          this.world.interactDoor(c.doorRef, this.position, false);
        }
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
    const gy = (this.world && this.world.getTerrainHeight) ? this.world.getTerrainHeight(this.position.x, this.position.z) : 0;
    this.position.y = gy;
    this.group.position.y = gy;
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
    const hits = ray.intersectObjects((this.world.wallMeshes && this.world.wallMeshes.length > 0) ? this.world.wallMeshes : this.world.shootableMeshes, false);
    return hits.length === 0;
  }

  _findBestCoverSpot(threatPos, maxRadius = 18) {
    if (!threatPos || !this.world || !this.world.colliders) return null;
    let best = null;
    let bestScore = Infinity;

    const list = this.world.getNearbyColliders
      ? this.world.getNearbyColliders(this.position.x, this.position.z, maxRadius)
      : this.world.colliders;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
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

    // 1. Check Player (only if alive, standing, and not invisible — ignore downed or /invis players!)
    if (player && !player.dead && !player.isDowned && !player.invisible) {
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

    // 0. Operator Target Focus: Stay locked on current target until eliminated/survived before switching!
    if (this.isOperator && this.focusedTarget && this.targetLockTimer > 0) {
      const ft = this.focusedTarget;
      const alive = ft.type === 'player'
        ? (player && !player.dead && !player.isDowned && !player.invisible)
        : (ft.ref && !ft.ref.dead && !ft.ref.isDowned && !ft.ref.extracted);
      if (alive) {
        const fPos = ft.type === 'player' ? player.position : ft.ref.position;
        const fDist = this.position.distanceTo(fPos);
        if (fDist < 58) {
          const eyeCheck = ft.type === 'player' ? fPos : new THREE.Vector3(fPos.x, 1.4, fPos.z);
          if (this._hasLineOfSight(eyeCheck, 62)) {
            best = { type: ft.type, ref: ft.ref, pos: fPos, dist: fDist };
            bestDist = Math.min(fDist, 5.5); // only interrupt focus for a point-blank threat < 5.5m!
          }
        }
      } else {
        this.focusedTarget = null;
        this.targetLockTimer = 0;
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

  _startOperatorSlide(dirVec) {
    if (!this.isOperator || this.slideTimer > 0 || this.slideCooldown > 0) return;
    const len = Math.hypot(dirVec.x, dirVec.z);
    if (len < 0.1) return;
    this.slideDir.set(dirVec.x / len, 0, dirVec.z / len);
    this.slideTimer = 0.55;
    this.slideCooldown = 2.6 + Math.random() * 1.4;
    this.isTacSprinting = false;
  }

  _throwOperatorGrenade(targetPos, kind = 'frag') {
    if (!this.scene || !this.activeGrenades) return;
    const isSmoke = kind === 'smoke';
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 8, 8),
      new THREE.MeshLambertMaterial({
        color: isSmoke ? 0x6b7a70 : 0x3b4d35,
        emissive: isSmoke ? 0x223328 : 0xaa2211,
        emissiveIntensity: isSmoke ? 0.25 : 0.7
      })
    );
    const startPos = new THREE.Vector3(this.position.x, 1.55, this.position.z);
    mesh.position.copy(startPos);
    this.scene.add(mesh);

    const dx = targetPos.x - startPos.x;
    const dz = targetPos.z - startPos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const flightT = THREE.MathUtils.clamp(dist / 15.5, 0.55, 1.55);
    const vel = new THREE.Vector3(
      dx / flightT,
      (0.2 - startPos.y + 0.5 * 16.0 * flightT * flightT) / flightT,
      dz / flightT
    );

    this.activeGrenades.push({
      kind,
      mesh,
      pos: startPos,
      vel,
      fuse: isSmoke ? flightT + 0.35 : Math.max(1.8, flightT + 0.85),
      detonated: false
    });
    if (window.soundEngine && window.soundEngine.playThrowWhoosh) {
      try { window.soundEngine.playThrowWhoosh(false); } catch (e) {}
    }
  }

  _updateOperatorGrenades(dt, player, allEnemies) {
    if (!this.activeGrenades || this.activeGrenades.length === 0) return;
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.fuse -= dt;
      g.vel.y -= 16.0 * dt;
      g.pos.addScaledVector(g.vel, dt);
      if (g.pos.y <= 0.12) {
        g.pos.y = 0.12;
        g.vel.y = Math.abs(g.vel.y) * 0.35;
        g.vel.x *= 0.62;
        g.vel.z *= 0.62;
      }
      g.mesh.position.copy(g.pos);

      if (g.fuse <= 0) {
        this.scene.remove(g.mesh);
        if (g.kind === 'smoke') {
          const puff = new THREE.Mesh(
            new THREE.SphereGeometry(2.8, 10, 8),
            new THREE.MeshLambertMaterial({ color: 0xaab2ac, transparent: true, opacity: 0.65 })
          );
          puff.position.set(g.pos.x, 1.5, g.pos.z);
          this.scene.add(puff);
          if (window.soundEngine && window.soundEngine.playSmokeHiss) {
            try { window.soundEngine.playSmokeHiss(); } catch (e) {}
          }
          setTimeout(() => { if (this.scene) this.scene.remove(puff); }, 8500);
        } else {
          const flash = new THREE.Mesh(
            new THREE.SphereGeometry(2.6, 10, 8),
            new THREE.MeshBasicMaterial({ color: 0xff8822, transparent: true, opacity: 0.85 })
          );
          flash.position.copy(g.pos);
          this.scene.add(flash);
          setTimeout(() => { if (this.scene) this.scene.remove(flash); }, 220);

          const distToPlayer = player ? g.pos.distanceTo(player.position) : 60;
          if (window.soundEngine && window.soundEngine.playExplosion) {
            try { window.soundEngine.playExplosion(distToPlayer); } catch (e) {}
          }
          if (player && !player.dead && distToPlayer < 8.5) {
            const falloff = 1 - (distToPlayer / 8.5) * 0.75;
            const dmg = Math.round(78 * falloff);
            player.takeDamage(dmg, { name: this.name, weaponId: 'frag_grenade', weaponName: 'M67 Frag' });
          }
        }
        this.activeGrenades.splice(i, 1);
      }
    }
  }

  update(dt, player, onEnemyFire, onEnemyBleedout, allEnemies = [], squadGoal = null, onAiVsAiEvent = null) {
    if (this.isOperator) {
      this._updateOperatorGrenades(dt, player, allEnemies);
      if (this.slideCooldown > 0) this.slideCooldown = Math.max(0, this.slideCooldown - dt);
      if (this.grenadeCooldown > 0) this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt);
      if (this.targetLockTimer > 0) this.targetLockTimer = Math.max(0, this.targetLockTimer - dt);
      if (this.proneTimer > 0) {
        this.proneTimer -= dt;
        if (this.proneTimer <= 0 || this.state !== 'COMBAT') this.isProne = false;
      }
      if (!this.dead && !this.isDowned) {
        this.timeSinceDamaged = (this.timeSinceDamaged || 10) + dt;
        // 1. Automatic Health Regeneration after 2.5s without taking damage!
        if (this.timeSinceDamaged >= 2.5 && this.hp < this.maxHp) {
          this.hp = Math.min(this.maxHp, this.hp + 24 * dt);
        }
        // 2. Smart Armor Plating after 1.5s without taking damage (or behind cover)
        if (this.platingTimer > 0) {
          this.platingTimer -= dt;
          this.updateVisualAnim(dt, false, 0);
          if (this.platingTimer <= 0 && this.operatorEquipment && this.operatorEquipment.plates > 0) {
            this.operatorEquipment.plates -= 1;
            this.armor = Math.min(this.maxArmor || 100, (this.armor || 0) + 50);
            if (this.plateProp) this.plateProp.visible = false;
          }
        } else if (this.armor < (this.maxArmor || 100) && this.operatorEquipment && this.operatorEquipment.plates > 0 && this.timeSinceDamaged >= 1.5) {
          this.platingTimer = 1.9;
        }
        // 3. In-Depth POI Looting: approach & pick up loose ground items or loot nearby POI containers when not in combat!
        if (this.state === 'PATROL' && this.world) {
          this._lootScanCd = (this._lootScanCd || 0) - dt;
          if (this._lootScanCd <= 0) {
            this._lootScanCd = 2.0;
            // Pick up nearby loose ground items (plates, medkits, ammo, valuables)
            if (Array.isArray(this.world.groundItems)) {
              for (let giIdx = this.world.groundItems.length - 1; giIdx >= 0; giIdx--) {
                const gi = this.world.groundItems[giIdx];
                if (!gi || !gi.position) continue;
                const gd = Math.hypot(this.position.x - gi.position.x, this.position.z - gi.position.z);
                if (gd < 2.8) {
                  if (gi.id === 'armor_plate' && this.operatorEquipment) {
                    this.operatorEquipment.plates = Math.min(6, (this.operatorEquipment.plates || 0) + (gi.qty || 1));
                  } else if (this.lootItems && this.lootItems.length < 10) {
                    this.lootItems.push({ id: gi.id, qty: gi.qty || 1, revealed: false });
                  }
                  if (this.world.removeGroundItem) this.world.removeGroundItem(gi);
                  break;
                } else if (gd < 11.0 && !this._activeLootGoal) {
                  this._activeLootGoal = gi.position.clone();
                  break;
                }
              }
            }
            // Loot nearby unsearched POI containers
            if (!this._activeLootGoal && Array.isArray(this.world.lootContainers)) {
              for (let cIdx = 0; cIdx < this.world.lootContainers.length; cIdx++) {
                const ct = this.world.lootContainers[cIdx];
                if (!ct || ct.requiresKey || !Array.isArray(ct.items) || ct.items.length === 0) continue;
                const cd = Math.hypot(this.position.x - ct.position.x, this.position.z - ct.position.z);
                if (cd < 3.0) {
                  const taken = ct.items.shift();
                  if (taken) {
                    if (taken.id === 'armor_plate' && this.operatorEquipment) {
                      this.operatorEquipment.plates = Math.min(6, (this.operatorEquipment.plates || 0) + (taken.qty || 1));
                    } else if (this.lootItems && this.lootItems.length < 10) {
                      this.lootItems.push({ id: taken.id, qty: taken.qty || 1, revealed: false });
                    }
                  }
                  break;
                } else if (cd < 14.0) {
                  this._activeLootGoal = ct.position.clone();
                  break;
                }
              }
            }
          }
          if (this._activeLootGoal) {
            const ld = Math.hypot(this.position.x - this._activeLootGoal.x, this.position.z - this._activeLootGoal.z);
            if (ld < 2.2) {
              this._activeLootGoal = null;
            } else {
              this._moveToward(this._activeLootGoal, this.speed * 0.85, dt);
            }
          }
        } else {
          this._activeLootGoal = null;
        }
      }
    }
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
        if (this.muzzleLight) this.muzzleLight.intensity = 0;
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
          // Face toward threat with legs in front while scooting backward on supporting arm (natural seated scoot!)
          this.group.rotation.y = Math.atan2(-awayX, -awayZ);
          this._scootCycle = (this._scootCycle || 0) + dt * 4.4;
          const phase = Math.sin(this._scootCycle);
          const heave = Math.max(0, phase);
          // With rotation.order = 'YXZ', group.rotation.x (-0.22) + hip.rotation.x (-1.38..-1.52) = -1.60..-1.74 rad
          // keeping feet at Y >= +0.28m (bottom of foot >= +0.16m above ground in ALL 360° directions!)
          const gyScoot = this._getGroundY();
          this.position.y = gyScoot;
          this.group.position.y = gyScoot - 0.50 + heave * 0.035;
          this.group.rotation.x = -0.22 - heave * 0.04;
          this.group.rotation.z = phase * 0.045;
          if (this.leftArm) { this.leftArm.rotation.x = 0.55 + phase * 0.28; this.leftArm.rotation.z = 0.24; }
          if (this.rightArm) { this.rightArm.rotation.x = -0.75; this.rightArm.rotation.z = -0.45; }
          if (this.leftHip) this.leftHip.rotation.x = -1.38 - heave * 0.14;
          if (this.rightHip) this.rightHip.rotation.x = -1.38 - Math.max(0, -phase) * 0.10;
        }
      } else {
        const gyIdleDown = this._getGroundY();
        this.position.y = gyIdleDown;
        this.group.position.y = gyIdleDown - 0.50;
        this.group.rotation.x = -0.26;
        this.group.rotation.z = 0;
        if (this.leftHip) this.leftHip.rotation.x = -1.34;
        if (this.rightHip) this.rightHip.rotation.x = -1.34;
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

        const threatPos = this.lastKnownPlayerPos || (player && !player.dead && !player.isDowned && !player.invisible ? player.position : null);
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

    // If player turned on /invis, immediately drop aggro & clear memory of player
    if (player && player.invisible) {
      if (this.focusedTarget && this.focusedTarget.type === 'player') {
        this.focusedTarget = null;
        this.targetLockTimer = 0;
      }
      if (this.lastKnownPlayerPos && this.state !== 'PATROL') {
        this.lastKnownPlayerPos = null;
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

    // === COMBAT (Player-Like Operators: Focus Target, Tactical Sprint, Slide, Lean, Plates & Grenades!) ===
    if (this.state === 'COMBAT' && target) {
      if (this.isOperator) {
        this.focusedTarget = { type: target.type, ref: target.ref };
        this.targetLockTimer = 5.5;
      }

      const tPos = target.pos;
      const dx = tPos.x - this.position.x;
      const dz = tPos.z - this.position.z;
      this.group.rotation.y = Math.atan2(dx, dz);

      // 1. Active Tactical Slide update (Operator slides into cover or around corners!)
      if (this.isOperator && this.slideTimer > 0) {
        this.slideTimer = Math.max(0, this.slideTimer - dt);
        const sp = 1 - (this.slideTimer / 0.55);
        const slideSpd = THREE.MathUtils.lerp(this.speed * 1.95, this.speed * 0.72, sp * sp);
        const vx = this.slideDir.x * slideSpd * dt;
        const vz = this.slideDir.z * slideSpd * dt;
        if (!this._collides(this.position.x + vx, this.position.z, 0.42)) {
          this.position.x += vx;
          this.group.position.x = this.position.x;
        }
        if (!this._collides(this.position.x, this.position.z + vz, 0.42)) {
          this.position.z += vz;
          this.group.position.z = this.position.z;
        }
        const gySlide = this._getGroundY();
        this.position.y = gySlide;
        this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, gySlide - 0.36, dt * 16);
        this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, -0.26, dt * 14);
        if (this.opModel) {
          // Baseball-slide pose: lead leg kicked straight out in front, trailing knee tucked!
          this.opModel.leftLeg.hip.rotation.x = 1.52;
          this.opModel.leftLeg.knee.rotation.x = -0.05;
          this.opModel.rightLeg.hip.rotation.x = 1.15;
          this.opModel.rightLeg.knee.rotation.x = -2.25;
        } else {
          if (this.leftHip) this.leftHip.rotation.x = -0.95;
          if (this.rightHip) this.rightHip.rotation.x = -0.35;
        }
        if (this.slideTimer <= 0) {
          this.group.position.y = gySlide;
          this.group.rotation.x = 0;
          if (this.opModel) {
            this.opModel.leftLeg.knee.rotation.x = -0.12;
            this.opModel.rightLeg.knee.rotation.x = -0.12;
          }
        }
        return;
      }

      // 2. Survival Priority: Operator uses Armor Plates behind cover before re-engaging!
      const needsPlate = this.isOperator && this.operatorEquipment && (this.operatorEquipment.plates || 0) > 0 &&
        (this.armor < Math.max(25, this.maxArmor - 38) || this.hp < this.maxHp * 0.65) && target.dist > 6.0;

      if (this.isOperator && this.platingTimer > 0) {
        const gyPlate = this._getGroundY();
        this.position.y = gyPlate;
        this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, gyPlate - 0.18, dt * 10);
        this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, 0, dt * 10);
        // Plating arm & 3D ceramic plate animation is driven by updateVisualAnim(dt) above!
        return;
      }

      this.coverSearchTimer -= dt;
      if (!this.coverSpot || this.coverSearchTimer <= 0) {
        const refreshed = this._findBestCoverSpot(tPos, 20);
        if (refreshed) this.coverSpot = refreshed;
        this.coverSearchTimer = 2.6;
      }

      // If hurt and needs to plate: pop smoke if exposed, tactical sprint / slide into cover, then plate up!
      if (needsPlate) {
        if (this.smokeLeft > 0 && this.grenadeCooldown <= 0 && target.dist < 28) {
          this.smokeLeft -= 1;
          this.grenadeCooldown = 8.0;
          const mid = this.position.clone().lerp(tPos, 0.35);
          this._throwOperatorGrenade(mid, 'smoke');
        }
        if (this.coverSpot) {
          const distCov = Math.hypot(this.coverSpot.coverPos.x - this.position.x, this.coverSpot.coverPos.z - this.position.z);
          if (distCov > 1.0) {
            this.isTacSprinting = this.tacStamina > 12;
            const moveSpd = this.isTacSprinting ? this.speed * 1.62 : this.speed * 1.2;
            if (this.isTacSprinting) this.tacStamina = Math.max(0, this.tacStamina - 28 * dt);
            this._moveToward(this.coverSpot.coverPos, moveSpd, dt);
            if (this.isTacSprinting && distCov < 4.2 && this.slideCooldown <= 0) {
              this._startOperatorSlide(this.coverSpot.coverPos.clone().sub(this.position));
            }
            return;
          }
        }
        this.isTacSprinting = false;
        this.platingTimer = 2.0;
        return;
      }

      // 3. Occasional Frag Grenade throw during firefight (medium range 9..30m)
      if (this.isOperator && this.grenadesLeft > 0 && this.grenadeCooldown <= 0 && target.dist > 9 && target.dist < 30 && Math.random() < 0.014) {
        this.grenadesLeft -= 1;
        this.grenadeCooldown = 9.0 + Math.random() * 6.0;
        this._throwOperatorGrenade(tPos, 'frag');
      }

      // 4. Movement, Tactical Sprint, Slide-Peek & Corner Leaning
      let targetLean = 0;
      if (this.coverSpot) {
        this.coverPeekTimer -= dt;
        if (this.coverPeekTimer <= 0) {
          this.isPeeking = !this.isPeeking;
          if (this.isPeeking) this.leanDir = Math.random() < 0.5 ? -1 : 1;
          this.coverPeekTimer = this.isPeeking ? (1.25 + Math.random() * 0.8) : (0.85 + Math.random() * 0.65);
        }
        const goal = this.isPeeking ? this.coverSpot.peekPos : this.coverSpot.coverPos;
        const distGoal = Math.hypot(goal.x - this.position.x, goal.z - this.position.z);
        if (distGoal > 0.45) {
          const useTac = this.isOperator && !this.isPeeking && distGoal > 3.5 && this.tacStamina > 18;
          this.isTacSprinting = useTac;
          if (useTac) this.tacStamina = Math.max(0, this.tacStamina - 24 * dt);
          else this.tacStamina = Math.min(100, (this.tacStamina || 0) + 18 * dt);
          this._moveToward(goal, this.speed * (useTac ? 1.58 : (this.isPeeking ? 0.90 : 1.15)), dt, tPos);
          if (this.isOperator && this.isPeeking && distGoal < 3.0 && this.slideCooldown <= 0 && Math.random() < 0.08) {
            this._startOperatorSlide(goal.clone().sub(this.position));
          }
        } else {
          this.isTacSprinting = false;
          if (this.isOperator && this.isPeeking) targetLean = this.leanDir * 0.24;
        }
      } else if (target.dist > 18) {
        this.isTacSprinting = this.isOperator && this.tacStamina > 15;
        if (this.isTacSprinting) this.tacStamina = Math.max(0, this.tacStamina - 24 * dt);
        else this.tacStamina = Math.min(100, (this.tacStamina || 0) + 18 * dt);
        this._moveToward(tPos, this.speed * (this.isTacSprinting ? 1.60 : 1.05), dt, tPos);
        if (this.isTacSprinting && target.dist < 22 && this.slideCooldown <= 0 && Math.random() < 0.04) {
          this._startOperatorSlide(tPos.clone().sub(this.position));
        }
      } else if (this.isOperator) {
        this.isTacSprinting = false;
        this.tacStamina = Math.min(100, (this.tacStamina || 0) + 20 * dt);
        targetLean = this.leanDir * 0.18;
      }

      if (this.isOperator) {
        const gyStand = this._getGroundY();
        this.position.y = gyStand;
        this.leanAngle = THREE.MathUtils.lerp(this.leanAngle || 0, targetLean, Math.min(1, dt * 10));
        this.group.rotation.z = this.leanAngle;
        this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, gyStand, Math.min(1, dt * 12));
        this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, 0, Math.min(1, dt * 12));
        // Aim head, torso, both arms & weaponMount directly at target elevation (or tactical sprint pose)
        if (this.opModel && tPos) {
          const m = this.opModel;
          const hDist = Math.max(1, Math.hypot(tPos.x - this.position.x, tPos.z - this.position.z));
          const aimTargetY = (target.type === 'player') ? (tPos.y - 0.15) : (tPos.y + 1.25);
          const aimPitch = THREE.MathUtils.clamp(Math.atan2((aimTargetY - (this.position.y + 1.38)), hDist), -0.75, 0.75);
          m.head.rotation.x = THREE.MathUtils.lerp(m.head.rotation.x, aimPitch * 0.72, Math.min(1, dt * 14));
          if (this.isTacSprinting && this.fireTimer > 0.18) {
            m.torso.rotation.x = THREE.MathUtils.lerp(m.torso.rotation.x, -0.26, Math.min(1, dt * 12));
            m.rightArm.shoulder.rotation.set(1.12, 0, -0.18);
            m.leftArm.shoulder.rotation.set(0.36, 0, 0.18);
          } else {
            // Aim rifle squarely downrange at the target
            m.torso.rotation.x = THREE.MathUtils.lerp(m.torso.rotation.x, -0.06 + aimPitch * 0.25, Math.min(1, dt * 15));
            const armP = 0.86 + aimPitch * 0.75;
            m.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(m.leftArm.shoulder.rotation.x, armP, Math.min(1, dt * 15));
            m.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(m.leftArm.shoulder.rotation.z, 0.44, Math.min(1, dt * 15));
            m.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(m.rightArm.shoulder.rotation.x, armP + 0.02, Math.min(1, dt * 15));
            m.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(m.rightArm.shoulder.rotation.z, -0.14, Math.min(1, dt * 15));
            if (m.rightArm.elbow) m.rightArm.elbow.rotation.x = THREE.MathUtils.lerp(m.rightArm.elbow.rotation.x, 0.76, Math.min(1, dt * 15));
            if (m.leftArm.elbow) m.leftArm.elbow.rotation.x = THREE.MathUtils.lerp(m.leftArm.elbow.rotation.x, 0.92, Math.min(1, dt * 15));
            if (m.weaponMount) {
              // Counter-rotate minor wrist yaw so barrel aligns dead-straight with target
              m.weaponMount.rotation.set(-Math.PI / 2, 0.04, -0.03);
            }
          }
        }
      } else if (this.weaponMeshGroup && tPos) {
        // Non-operator AI also pitch their weapon barrel directly at target elevation
        const hDist = Math.max(1, Math.hypot(tPos.x - this.position.x, tPos.z - this.position.z));
        const aimTargetY = (target.type === 'player') ? (tPos.y - 0.15) : (tPos.y + 1.25);
        const aimPitch = THREE.MathUtils.clamp(Math.atan2((aimTargetY - (this.position.y + 1.24)), hDist), -0.7, 0.7);
        this.weaponMeshGroup.rotation.x = aimPitch;
      }

      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = this.fireInterval + Math.random() * 0.22;
        const distToPlayer = player ? this.position.distanceTo(player.position) : 40;
        if (distToPlayer < 75) {
          window.soundEngine.playGunshot(this.weaponId, distToPlayer);
        }
        // Snap weapon straight onto target & flush world matrices so bullets & tracers spawn directly from the gun muzzle!
        if (this.opModel && tPos) {
          const m = this.opModel;
          const hDist = Math.max(1, Math.hypot(tPos.x - this.position.x, tPos.z - this.position.z));
          const aimTargetY = (target.type === 'player') ? (tPos.y - 0.15) : (tPos.y + 1.25);
          const aimPitch = THREE.MathUtils.clamp(Math.atan2((aimTargetY - (this.position.y + 1.38)), hDist), -0.75, 0.75);
          m.torso.rotation.x = -0.06 + aimPitch * 0.25;
          const armP = 0.86 + aimPitch * 0.75;
          m.rightArm.shoulder.rotation.set(armP + 0.02, 0, -0.14);
          m.leftArm.shoulder.rotation.set(armP, 0, 0.44);
          if (m.rightArm.elbow) m.rightArm.elbow.rotation.x = 0.76;
          if (m.leftArm.elbow) m.leftArm.elbow.rotation.x = 0.92;
          if (m.weaponMount) m.weaponMount.rotation.set(-Math.PI / 2, 0.04, -0.03);
        }
        this.group.updateMatrixWorld(true);
        this.muzzleMesh.material.opacity = 0.95;
        if (this.muzzleLight) this.muzzleLight.intensity = 3.0;
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
          const aimPos = new THREE.Vector3(tgtEnemy.position.x, tgtEnemy.position.y + 1.3, tgtEnemy.position.z);
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

  triggerRemoteMuzzleFlash() {
    this.muzzleTimer = 0.07;
    if (this.muzzleMesh) this.muzzleMesh.material.opacity = 1;
    if (this.muzzleLight) this.muzzleLight.intensity = 2.6;
  }

  updateReplicated(dt) {
    if (this.extracted) {
      if (this.group) this.group.visible = false;
      return;
    }
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        if (this.muzzleMesh) this.muzzleMesh.material.opacity = 0;
        if (this.muzzleLight) this.muzzleLight.intensity = 0;
      }
    }
    if (this.dead) return;

    const lerpRate = Math.min(1, dt * 12);
    const prevX = this.position.x;
    const prevZ = this.position.z;
    if (this._netTargetX !== undefined) {
      this.position.x = THREE.MathUtils.lerp(this.position.x, this._netTargetX, lerpRate);
      this.position.z = THREE.MathUtils.lerp(this.position.z, this._netTargetZ, lerpRate);
      this.group.position.x = this.position.x;
      this.group.position.z = this.position.z;
    }
    if (this._netTargetRotY !== undefined) {
      let dY = this._netTargetRotY - this.group.rotation.y;
      while (dY > Math.PI) dY -= Math.PI * 2;
      while (dY < -Math.PI) dY += Math.PI * 2;
      this.group.rotation.y += dY * lerpRate;
    }

    const moveSpeed = Math.hypot(this.position.x - prevX, this.position.z - prevZ) / Math.max(0.001, dt);
    const moving = moveSpeed > 0.25;

    if (this.isDowned) {
      if (this.bleedSprite) {
        this.bleedSprite.visible = true;
        this._bleedDrawAccum = (this._bleedDrawAccum || 0) + dt;
        if (this._bleedDrawAccum >= 0.15) {
          this._bleedDrawAccum = 0;
          if (window.drawDownedBleedoutCanvas && this.bleedCanvas) {
            window.drawDownedBleedoutCanvas(this.bleedCanvas, this.downedBleedTimer / (this.downedBleedMax || 25));
            if (this.bleedTex) this.bleedTex.needsUpdate = true;
          }
        }
      }
      this._scootCycle = (this._scootCycle || 0) + dt * (moving ? 4.4 : 0);
      const phase = moving ? Math.sin(this._scootCycle) : 0;
      const heave = Math.max(0, phase);
      const gyRepDown = this._getGroundY();
      this.position.y = gyRepDown;
      this.group.position.y = gyRepDown - 0.50 + heave * 0.035;
      this.group.rotation.x = -0.22 - heave * 0.04;
      if (this.leftHip) this.leftHip.rotation.x = -1.38 - heave * 0.14;
      if (this.rightHip) this.rightHip.rotation.x = -1.38 - Math.max(0, -phase) * 0.10;
      return;
    }

    if (this.bleedSprite) this.bleedSprite.visible = false;
    const gyRep = this._getGroundY();
    this.position.y = gyRep;
    this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, gyRep, lerpRate);
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, 0, lerpRate);
    if (moving) {
      this._walkCycle = (this._walkCycle || 0) + dt * Math.min(11, moveSpeed * 2.1);
      if (this.leftHip) this.leftHip.rotation.x = Math.sin(this._walkCycle) * 0.45;
      if (this.rightHip) this.rightHip.rotation.x = -Math.sin(this._walkCycle) * 0.45;
    } else {
      if (this.leftHip) this.leftHip.rotation.x = THREE.MathUtils.lerp(this.leftHip.rotation.x, 0, dt * 10);
      if (this.rightHip) this.rightHip.rotation.x = THREE.MathUtils.lerp(this.rightHip.rotation.x, 0, dt * 10);
    }
  }
}

class EnemyManager {
  constructor(scene, world, zoneConfig, weaponSystem = null, isRemoteClient = false) {
    this.scene = scene;
    this.world = world;
    this.weaponSystem = weaponSystem;
    this.isRemoteClient = !!isRemoteClient;
    this.enemies = [];
    this.squadPlans = {};

    // Remote non-host party clients receive authoritative enemy spawns & transforms from the Host!
    if (this.isRemoteClient) return;
    const squadPrefixes = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT'];
    const callsigns = [
      'VIPER', 'PHANTOM', 'REAPER', 'COBALT', 'STRYKER', 'WRAITH',
      'JACKAL', 'HAWK', 'SPECTRE', 'BANDIT', 'NOMAD', 'SABLE',
      'KODIAK', 'TALON', 'ZERO', 'ORION', 'BISHOP', 'BLITZ'
    ];
    const styles = ['rusher', 'flanker', 'tactical', 'marksman'];
    const anchorSource = (world.operatorSpawns && world.operatorSpawns.length > 0)
      ? world.operatorSpawns
      : world.spawnPoints;
    const anchorPts = [...anchorSource].sort(() => Math.random() - 0.5);
    const worldPois = (world.pois && world.pois.length > 0)
      ? world.pois.map(p => new THREE.Vector3(p.x, 0, p.z))
      : [new THREE.Vector3(-88, 0, -86), new THREE.Vector3(94, 0, -56), new THREE.Vector3(-96, 0, 74)];
    const extracts = (world.extractZones && world.extractZones.length > 0)
      ? world.extractZones
      : [{ position: new THREE.Vector3(-14, 0, -172), radius: 6.0 }];

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

    // 2. Spawn Scavengers & Raiders guarding every non-boss POI across the expanded 1240m sector
    const aiSpawns = (world.pois || [])
      .filter(p => !(p.name || '').toLowerCase().includes('boss'))
      .map(p => {
        const sx = p.x + 12;
        const sz = p.z + 10;
        const sy = world.getTerrainHeight ? world.getTerrainHeight(sx, sz) : 0;
        return {
          pos: new THREE.Vector3(sx, sy, sz),
          tier: (p.threat === 'high') ? 'raider' : 'scav'
        };
      });
    for (const sp of aiSpawns) {
      this.enemies.push(new Enemy(scene, world, sp.pos, sp.tier, null, weaponSystem));
    }

    // 3. Spawn Sector Boss INSIDE the Boss Encampment's Multi-Floor Central Command Center
    const bossPoi = (world.pois || []).find(p => (p.name || '').toLowerCase().includes('boss'));
    const bx = bossPoi ? bossPoi.x + 2.5 : 312.5;
    const bz = bossPoi ? bossPoi.z + 3.5 : -266.5;
    const bossPos = (world.bossSpawnPos && world.bossSpawnPos.clone)
      ? world.bossSpawnPos.clone()
      : new THREE.Vector3(bx, world.getTerrainHeight ? world.getTerrainHeight(bx, bz) : 0, bz);
    this.enemies.push(new Enemy(scene, world, bossPos, 'boss', null, weaponSystem));

    // 4. Spawn Armored Boss Guards inside/around the Command Center & Compound (drop higher-tier weapons!)
    const guardSpawns = (world.bossGuardSpawns && world.bossGuardSpawns.length > 0)
      ? world.bossGuardSpawns
      : [new THREE.Vector3(bx - 5, bossPos.y, bz + 5), new THREE.Vector3(bx + 5, bossPos.y, bz + 5)];
    for (const gp of guardSpawns) {
      this.enemies.push(new Enemy(scene, world, gp.clone(), 'boss_guard', null, weaponSystem));
    }

    this.enemies.forEach((e, idx) => { e.netIdx = idx; });
  }

  serializeSnapshot() {
    const out = [];
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e) continue;
      out.push({
        i,
        x: Math.round(e.position.x * 10) / 10,
        z: Math.round(e.position.z * 10) / 10,
        y: Math.round((e.group ? e.group.rotation.y : 0) * 100) / 100,
        hp: Math.ceil(e.hp || 0),
        mh: Math.ceil(e.maxHp || 100),
        dn: e.isDowned ? 1 : 0,
        dd: e.dead ? 1 : 0,
        ex: e.extracted ? 1 : 0,
        t: e.tier || 'scav',
        op: e.isOperator ? 1 : 0,
        n: e.name || 'HOSTILE',
        w: e.weaponId || 'ak74m',
        sq: e.squadName || ''
      });
    }
    return out;
  }

  applyHostSnapshot(list) {
    if (!Array.isArray(list)) return;
    for (const s of list) {
      if (!s || typeof s.i !== 'number') continue;
      let e = this.enemies[s.i];
      if (!e) {
        const spawnPos = new THREE.Vector3(s.x || 0, 0, s.z || 0);
        const opMeta = s.op ? { isOperator: true, squadName: s.sq || 'ALPHA', callsign: s.n || 'OPERATOR', playstyle: 'tactical' } : null;
        e = new Enemy(this.scene, this.world, spawnPos, s.t || 'scav', opMeta, this.weaponSystem);
        e.isRemoteReplicated = true;
        e.netIdx = s.i;
        e.name = s.n || e.name;
        e.weaponId = s.w || e.weaponId;
        this.enemies[s.i] = e;
      }
      e._netTargetX = s.x;
      e._netTargetZ = s.z;
      e._netTargetRotY = s.y;
      e.hp = s.hp;
      e.maxHp = s.mh;

      if (s.ex && !e.extracted) {
        e.extracted = true;
        if (e.group) e.group.visible = false;
      }
      if (s.dd && !e.dead) {
        e.die();
      } else if (s.dn && !e.isDowned && !e.dead) {
        e.isDowned = true;
        e.downedBleedTimer = e.downedBleedMax || 25;
        if (e.weaponMeshGroup) e.weaponMeshGroup.visible = false;
      } else if (!s.dn && e.isDowned && !s.dd) {
        e.isDowned = false;
        if (e.weaponMeshGroup) e.weaponMeshGroup.visible = true;
      }
    }
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
    if (this.isRemoteClient) {
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e) e.updateReplicated(dt);
      }
      return;
    }
    this._lodFrame = ((this._lodFrame || 0) + 1) | 0;
    this._updateSquadPlans(dt, raidTimeLeft);
    const px = player && player.position ? player.position.x : 0;
    const pz = player && player.position ? player.position.z : 0;
    const f = this._lodFrame;

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e) continue;
      if (e.dead) {
        // Dead bodies only need occasional fade/settle ticks
        if ((i + f) % 6 !== 0) continue;
        e.update(dt * 6, player, onEnemyFire, onEnemyBleedout, this.enemies, null, onAiVsAiEvent);
        continue;
      }
      // Distance-based staggered AI tick LOD (accumulates dt so movement & combat speed stay 100% identical!)
      const dx = e.position.x - px;
      const dz = e.position.z - pz;
      const distSq = dx * dx + dz * dz;
      const inCombat = e.state === 'COMBAT' || e.isDowned;
      let stride = 1;
      if (!inCombat) {
        if (distSq > 19600) stride = 6;       // > 140m: 10Hz
        else if (distSq > 4900) stride = 3;   // 70m–140m: 20Hz
      }
      if (stride > 1) {
        e._lodDtAcc = (e._lodDtAcc || 0) + dt;
        // Keep distant enemies smoothly animated every frame so sniper scope tracking is fluid!
        if (e.updateVisualAnim) e.updateVisualAnim(dt);
        if ((i + f) % stride !== 0) continue;
        const stepDt = Math.min(0.2, e._lodDtAcc);
        e._lodDtAcc = 0;
        const goal = e.isOperator ? this._getSquadGoalFor(e) : null;
        e.update(stepDt, player, onEnemyFire, onEnemyBleedout, this.enemies, goal, onAiVsAiEvent);
      } else {
        const stepDt = Math.min(0.15, (e._lodDtAcc || 0) + dt);
        e._lodDtAcc = 0;
        const goal = e.isOperator ? this._getSquadGoalFor(e) : null;
        e.update(stepDt, player, onEnemyFire, onEnemyBleedout, this.enemies, goal, onAiVsAiEvent);
      }
    }
  }
}
