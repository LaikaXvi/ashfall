// Autonomous, Self-Aware Extraction AI Squadmates
// Each squadmate has personal gear needs, raid objectives, tactical combat AI, self-healing/plating, looting, and extraction goals.
class SquadMate {
  constructor(scene, world, spawnPos, memberInfo, weaponSystem = null) {
    this.scene = scene;
    this.world = world;
    this.weaponSystem = weaponSystem;
    this.name = memberInfo.name || 'ALLY';
    this.squadColor = memberInfo.squadColor || '#69f0ae';
    this.weaponId = memberInfo.weaponId || 'ak74m';
    this.isRemoteHuman = !!memberInfo.isRemoteHuman;
    this.clientId = memberInfo.clientId || null;
    this._remoteTargetPos = spawnPos.clone();
    this._remoteTargetYaw = 0;
    this._remoteStance = 'stand';
    this._hasRemoteSync = false;
    this.lastPlayerDist = 0;
    this.position = spawnPos.clone();

    // Live survival & gear state
    this.maxHp = 120;
    this.hp = 120;
    this.maxArmor = 100;
    this.armor = 100;
    this.medkits = 2;
    this.plates = 2;
    this.magSize = this.weaponId === 'm24' ? 5 : 30;
    this.mag = this.magSize;
    this.lootValue = 0;
    this.kills = 0;
    this.dead = false;
    this.isDowned = false;
    this.downedHp = 55;
    this.downedBleedMax = 25.0;
    this.downedBleedTimer = 25.0;
    this.downedBy = null;
    this.reviveProgress = 0;
    this.beingRevivedBy = null;
    this._bleedDrawAccum = 0;
    this.extracted = false;

    // Personal Raid Objective
    const objectives = [
      { type: 'loot', targetValue: 4200, label: 'Need ₽4,200 in loot' },
      { type: 'hunt', targetKills: 2, label: 'Hunting 2 hostiles' },
      { type: 'resupply', targetValue: 2600, label: 'Scavenging gear & meds' }
    ];
    this.objective = objectives[Math.floor(Math.random() * objectives.length)];
    this.objectiveComplete = false;
    this.wantsExtract = false;

    // AI State Machine: 'FOLLOW' | 'COMBAT' | 'LOOT' | 'HEAL' | 'PLATE' | 'RELOAD' | 'EXTRACT'
    this.state = 'FOLLOW';
    this.actionTimer = 0;
    this.fireTimer = 0.35;
    this.muzzleTimer = 0;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeTimer = 1.5;
    this.animCycle = Math.random() * 6;
    this.flankSide = memberInfo.flankSide || 1;
    this.targetContainer = null;
    this.extractProgress = 0;
    this.calloutCooldown = 0;
    this._lastTagState = '';

    this._buildMesh();
  }

  _buildMesh() {
    const g = new THREE.Group();
    g.rotation.order = 'YXZ';
    this.hitboxes = [];

    if (typeof window.buildTacticalOperatorModel === 'function') {
      const built = window.buildTacticalOperatorModel({
        uniformColor: 0x2f434a,
        squadColor: this.squadColor || '#69f0ae',
        vestId: 'vest_2',
        bagId: 'bag_medium',
        faceForwardZ: true
      });
      g.add(built.root);
      this.leftHip = built.leftLeg.hip;
      this.rightHip = built.rightLeg.hip;
      this.leftArm = built.leftArm.shoulder;
      this.rightArm = built.rightArm.shoulder;
      this.opModel = built;

      built.chest.userData = { ally: this, part: 'torso' };
      built.skull.userData = { ally: this, part: 'head' };
      this.hitboxes.push(built.chest, built.skull);

      // Attach actual 3D equipped weapon model to right-hand weaponMount (held with both hands!)
      this._rebuildWeaponMesh(this.weaponId);

      this.muzzleMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffdd77, transparent: true, opacity: 0 })
      );
      this.muzzleMesh.position.set(0.14, 1.30, 0.74);
      this.muzzleLight = null;
    } else {
      const uniformMat = new THREE.MeshLambertMaterial({ color: 0x2f434a });
      const vestMat = new THREE.MeshLambertMaterial({ color: 0x3b4d3e });
      const gearMat = new THREE.MeshLambertMaterial({ color: 0x1a1d20 });
      const skinMat = new THREE.MeshLambertMaterial({ color: 0xd1a483 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.25), uniformMat);
      torso.position.set(0, 1.18, 0);
      torso.userData = { ally: this, part: 'torso' };
      this.hitboxes.push(torso);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.23, 0.22), skinMat);
      head.position.set(0, 1.58, 0);
      head.userData = { ally: this, part: 'head' };
      this.hitboxes.push(head);
      const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.62), gearMat);
      rifle.position.set(0.24, 1.24, 0.30);
      this.rifleMesh = rifle;
      this.muzzleMesh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffdd77, transparent: true, opacity: 0 }));
      this.muzzleMesh.position.set(0.24, 1.25, 0.64);
      this.muzzleLight = null;
      g.add(torso, head, rifle);
    }

    // Dynamic Overhead Callsign & Live AI Status Tag
    this.tagCanvas = document.createElement('canvas');
    this.tagCanvas.width = 320;
    this.tagCanvas.height = 72;
    this.tagTex = new THREE.CanvasTexture(this.tagCanvas);
    const tagMat = new THREE.SpriteMaterial({ map: this.tagTex, transparent: true, depthTest: false });
    this.tagSprite = new THREE.Sprite(tagMat);
    this.tagSprite.position.set(0, 2.12, 0);
    this.tagSprite.scale.set(1.65, 0.38, 1);
    this._redrawTag('READY');

    // Overhead circular bleedout / revive timer with medical cross in the middle
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
    this.bleedSprite.position.set(0, 1.95, 0);
    this.bleedSprite.scale.set(0.80, 0.80, 1);
    this.bleedSprite.visible = false;

    g.add(this.muzzleMesh, this.tagSprite, this.bleedSprite);
    g.position.copy(this.position);
    this.scene.add(g);
    this.group = g;
  }

  _rebuildWeaponMesh(weaponId) {
    if (!this.opModel || !this.opModel.weaponMount) return;
    if (this.rifleMesh) {
      this.opModel.weaponMount.remove(this.rifleMesh);
      this.rifleMesh = null;
    }
    const wDef = GAME_DATA.ITEMS[weaponId];
    let wObj = null;
    if (this.weaponSystem && wDef && this.weaponSystem.buildThirdPersonWeapon) {
      const builtWpn = this.weaponSystem.buildThirdPersonWeapon(wDef, {});
      if (builtWpn && builtWpn.group) {
        wObj = builtWpn.group;
        wObj.scale.setScalar(builtWpn.isPistol ? 1.25 : 1.38);
        wObj.position.set(0, 0.04, builtWpn.isPistol ? -0.06 : -0.18);
      }
    }
    if (!wObj) {
      wObj = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.62), new THREE.MeshLambertMaterial({ color: 0x1a1d20 }));
      wObj.position.set(0, 0.04, -0.22);
    }
    this.opModel.weaponMount.add(wObj);
    this.rifleMesh = wObj;
  }

  _redrawTag(statusLabel, statusColor = null) {
    const distM = Math.round(this.lastPlayerDist || 0);
    const dotColor = this.squadColor || '#69f0ae';
    const subColor = statusColor || '#dce2dc';
    const key = `${statusLabel}|${Math.ceil(this.hp)}|${distM}|${dotColor}|${subColor}`;
    if (this._lastTagState === key) return;
    this._lastTagState = key;

    const ctx = this.tagCanvas.getContext('2d');
    ctx.clearRect(0, 0, 320, 72);
    // Clean subtle dark pill backdrop (NO colored border box!)
    ctx.fillStyle = 'rgba(10, 14, 13, 0.72)';
    ctx.fillRect(8, 8, 304, 56);
    // Crisp colored squad dot on the left side of the nametag
    ctx.beginPath();
    ctx.arc(30, 36, 9, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#f2f7f4';
    ctx.textAlign = 'left';
    ctx.fillText(this.name, 50, 31);
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = subColor;
    ctx.fillText(`${distM}m · ${statusLabel} · ${Math.ceil(this.hp)} HP`, 50, 53);
    this.tagTex.needsUpdate = true;
  }

  _say(onComms, msg, color = '#64b5f6') {
    if (this.calloutCooldown > 0 || !onComms) return;
    this.calloutCooldown = 5.0;
    onComms(`[${this.name}] ${msg}`, color);
  }

  _collides(x, z, r = 0.42) {
    const list = this.world.getNearbyColliders ? this.world.getNearbyColliders(x, z, r + 0.5) : this.world.colliders;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.doorRef && c.doorRef.passable) continue;
      if (c.maxY < 0.2) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        if (c.doorRef && !c.doorRef.passable && this.world && this.world.interactDoor && c.doorRef.state === 'closed') {
          this.world.interactDoor(c.doorRef, this.position, false);
        }
        return true;
      }
    }
    return false;
  }

  _moveToward(tx, tz, speed, dt) {
    const dx = tx - this.position.x;
    const dz = tz - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.35) return false;
    const vx = (dx / dist) * speed * dt;
    const vz = (dz / dist) * speed * dt;
    let moved = false;
    if (!this._collides(this.position.x + vx, this.position.z)) {
      this.position.x += vx;
      moved = true;
    }
    if (!this._collides(this.position.x, this.position.z + vz)) {
      this.position.z += vz;
      moved = true;
    }
    const gy = (this.world && this.world.getTerrainHeight) ? this.world.getTerrainHeight(this.position.x, this.position.z) : 0;
    this.position.y = gy;
    this.group.position.x = this.position.x;
    this.group.position.y = gy;
    this.group.position.z = this.position.z;
    return moved;
  }

  _hasLineOfSight(targetPos) {
    const eye = new THREE.Vector3(this.position.x, 1.5, this.position.z);
    const dir = targetPos.clone().sub(eye);
    const dist = dir.length();
    if (dist > 36) return false;
    dir.normalize();
    const ray = new THREE.Raycaster(eye, dir, 0.2, dist - 0.3);
    const hits = ray.intersectObjects((this.world.wallMeshes && this.world.wallMeshes.length > 0) ? this.world.wallMeshes : this.world.shootableMeshes, false);
    return hits.length === 0;
  }

  _hasLineOfSightFrom(fromPos, targetPos) {
    const eye = new THREE.Vector3(fromPos.x, 1.45, fromPos.z);
    const tgt = new THREE.Vector3(targetPos.x, 1.35, targetPos.z);
    const dir = tgt.clone().sub(eye);
    const dist = dir.length();
    if (dist < 0.3 || dist > 42) return false;
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
      if (c.maxY < 1.0) continue;
      const cx = (c.minX + c.maxX) * 0.5;
      const cz = (c.minZ + c.maxZ) * 0.5;
      const halfX = (c.maxX - c.minX) * 0.5;
      const halfZ = (c.maxZ - c.minZ) * 0.5;
      if (halfX > 14 || halfZ > 14) continue;

      const dSelf = Math.hypot(cx - this.position.x, cz - this.position.z);
      if (dSelf > maxRadius) continue;

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
      if (this._hasLineOfSightFrom(coverPos, threatPos)) continue;

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
      const score = dSelf * 1.1 + Math.abs(dThreat - 16) * 0.4;
      if (score < bestScore) {
        bestScore = score;
        best = { coverPos, peekPos };
      }
    }
    return best;
  }

  takeDamage(amount, attackerInfo = null, onAllyEvent = null) {
    if (this.dead || this.extracted) return null;
    if (this.isDowned) {
      if (attackerInfo) this.downedBy = attackerInfo;
      this.downedHp -= amount;
      if (this.downedHp <= 0) {
        this.die();
        if (onAllyEvent) onAllyEvent('eliminated', this, this.downedBy);
        return 'eliminated';
      }
      return null;
    }

    if (this.armor > 0) {
      const abs = Math.min(this.armor, Math.round(amount * 0.78));
      this.armor -= abs;
      amount -= abs;
    }
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.isDowned = true;
      this.downedHp = 55;
      this.downedBleedTimer = this.downedBleedMax;
      this.downedBy = attackerInfo || { name: 'HOSTILE', weaponId: 'ak74m', weaponName: 'AK-74M' };
      this.reviveProgress = 0;
      this.state = 'DOWNED';
      // Grounded seated downed posture: hide weapon, reclined back with legs flat on top of ground (Y_foot >= +0.16m)
      if (this.rifleMesh) this.rifleMesh.visible = false;
      const gyD = (this.world && this.world.getTerrainHeight) ? this.world.getTerrainHeight(this.position.x, this.position.z) : 0;
      this.position.y = gyD;
      this.group.position.y = gyD - 0.56;
      this.group.rotation.x = -0.24;
      this.group.rotation.z = 0;
      if (this.leftHip) this.leftHip.rotation.x = 1.72;
      if (this.rightHip) this.rightHip.rotation.x = 1.62;
      if (this.opModel) {
        if (this.opModel.leftLeg && this.opModel.leftLeg.knee) this.opModel.leftLeg.knee.rotation.x = -0.22;
        if (this.opModel.rightLeg && this.opModel.rightLeg.knee) this.opModel.rightLeg.knee.rotation.x = -0.16;
      }
      if (this.leftArm) { this.leftArm.rotation.x = 0.55; this.leftArm.rotation.z = 0.24; }
      if (this.rightArm) { this.rightArm.rotation.x = -0.78; this.rightArm.rotation.z = -0.48; }
      this._redrawTag('DOWNED', '#ff5252');
      if (this.bleedSprite && window.drawDownedBleedoutCanvas) {
        window.drawDownedBleedoutCanvas(this.bleedCanvas, 1, { isAlly: true });
        this.bleedTex.needsUpdate = true;
        this.bleedSprite.visible = true;
      }
      if (onAllyEvent) onAllyEvent('downed', this, this.downedBy);
      return 'downed';
    }
    return null;
  }

  die() {
    this.dead = true;
    this.isDowned = false;
    this.state = 'DEAD';
    this.reviveProgress = 0;
    this.beingRevivedBy = null;
    this.group.rotation.x = -Math.PI / 2;
    const gyDead = (this.world && this.world.getTerrainHeight) ? this.world.getTerrainHeight(this.position.x, this.position.z) : 0;
    this.position.y = gyDead;
    this.group.position.y = gyDead + 0.16;
    if (this.leftHip) this.leftHip.rotation.set(0, 0, -0.06);
    if (this.rightHip) this.rightHip.rotation.set(0, 0, 0.06);
    if (this.leftArm) this.leftArm.rotation.set(0, 0, 0.28);
    if (this.rightArm) this.rightArm.rotation.set(0, 0, -0.28);
    this._redrawTag('ELIMINATED', '#ff5252');
    if (this.bleedSprite && window.drawDownedBleedoutCanvas) {
      window.drawDownedBleedoutCanvas(this.bleedCanvas, 0, { isAlly: true, isDead: true });
      this.bleedTex.needsUpdate = true;
      this.bleedSprite.visible = true;
    }
  }

  revive(hpAmount = 45) {
    this.dead = false;
    this.isDowned = false;
    this.hp = Math.min(this.maxHp, hpAmount);
    this.downedHp = 55;
    this.downedBleedTimer = this.downedBleedMax;
    this.reviveProgress = 0;
    this.beingRevivedBy = null;
    this._reviveGraceUntil = performance.now() + 2800;
    this.state = 'FOLLOW';
    this.group.rotation.x = 0;
    const gyRev = (this.world && this.world.getTerrainHeight) ? this.world.getTerrainHeight(this.position.x, this.position.z) : 0;
    this.position.y = gyRev;
    this.group.position.y = gyRev;
    if (this.rifleMesh) this.rifleMesh.visible = true;
    if (this.leftHip) this.leftHip.rotation.x = 0;
    if (this.rightHip) this.rightHip.rotation.x = 0;
    if (this.bleedSprite) this.bleedSprite.visible = false;
    this._redrawTag('REVIVED', '#69f0ae');
  }

  dragToward(tx, tz, speed, dt) {
    return this._moveToward(tx, tz, speed, dt);
  }

  _updateBleedSprite(dt) {
    if (!this.bleedSprite || !window.drawDownedBleedoutCanvas) return;
    if (!this.isDowned && !this.dead) {
      this.bleedSprite.visible = false;
      return;
    }
    this.bleedSprite.visible = true;
    this._bleedDrawAccum += dt;
    if (this._bleedDrawAccum >= 0.06) {
      this._bleedDrawAccum = 0;
      window.drawDownedBleedoutCanvas(this.bleedCanvas, this.downedBleedTimer / this.downedBleedMax, {
        isAlly: true,
        isDead: this.dead,
        isReviving: !!this.beingRevivedBy,
        revivePct: this.reviveProgress
      });
      this.bleedTex.needsUpdate = true;
    }
  }

  _findNearestExtract() {
    if (!this.world.extractZones || this.world.extractZones.length === 0) return null;
    let best = null, bestD = Infinity;
    for (const z of this.world.extractZones) {
      const d = this.position.distanceTo(z.position);
      if (d < bestD) { bestD = d; best = z; }
    }
    return best;
  }

  _findNearbyLootTarget(enemyManager) {
    let best = null;
    let bestDist = 17;
    // Check unsearched world loot crates
    for (const c of (this.world.lootContainers || [])) {
      if (!c.items || c.items.length === 0) continue;
      const d = this.position.distanceTo(c.position);
      if (d < bestDist) {
        bestDist = d;
        best = { type: 'crate', ref: c, pos: c.position, label: c.name };
      }
    }
    // Check unlooted enemy corpses
    if (enemyManager && enemyManager.enemies) {
      for (const e of enemyManager.enemies) {
        if (!e.dead || !e.loot || e.loot.length === 0) continue;
        const d = this.position.distanceTo(e.position);
        if (d < bestDist) {
          bestDist = d;
          best = { type: 'corpse', ref: e, pos: e.position, label: e.name };
        }
      }
    }
    return best;
  }

  _evaluateObjective(raidTimeLeft, onComms) {
    if (!this.objectiveComplete) {
      if (this.objective.type === 'hunt' && this.kills >= this.objective.targetKills) {
        this.objectiveComplete = true;
      } else if (this.objective.targetValue && this.lootValue >= this.objective.targetValue) {
        this.objectiveComplete = true;
      }
      if (this.objectiveComplete) {
        this.wantsExtract = true;
        this._say(onComms, `Objective done (₽${this.lootValue.toLocaleString()} secured) — ready to extract!`, '#69f0ae');
      }
    }
    if (!this.wantsExtract && (raidTimeLeft < 90 || (this.hp < 45 && this.medkits <= 0))) {
      this.wantsExtract = true;
      this._say(onComms, raidTimeLeft < 90 ? 'Clock is low — moving to extraction!' : 'Out of meds — heading for extract!', '#f5a623');
    }
  }

  applyRemoteState(st) {
    if (!st) return;
    this._hasRemoteSync = true;
    this._remoteTargetPos.set(st.x || 0, st.y || 0, st.z || 0);
    // Player camera looks down -Z; SquadMate mesh faces +Z -> add PI to yaw!
    this._remoteTargetYaw = (st.yaw || 0) + Math.PI;
    this._remotePitch = st.pitch || 0;
    this._remoteStance = st.stance || 'stand';
    this._remoteTacSprint = !!st.tacSprint;
    this._remoteAds = !!st.ads;
    this._remoteReload = !!st.rld;
    this._remotePlate = !!st.plt;
    this._remoteHeal = !!st.hl;
    if (typeof st.mag === 'number') this._remoteMag = st.mag;
    if (typeof st.hp === 'number') this.hp = st.hp;
    if (typeof st.armor === 'number') this.armor = st.armor;
    if (st.wpn && st.wpn !== this.weaponId) {
      this.weaponId = st.wpn;
      this._rebuildWeaponMesh(this.weaponId);
    }
    const inReviveGrace = performance.now() < (this._reviveGraceUntil || 0);
    if (!inReviveGrace || (!st.downed && !st.dead)) {
      this.isDowned = !!st.downed;
      this.dead = !!st.dead;
      if (!this.isDowned && !this.dead) {
        this.reviveProgress = 0;
        this.beingRevivedBy = null;
      }
    }
    if (typeof st.bleed === 'number') this.downedBleedTimer = st.bleed;
  }

  triggerRemoteMuzzleFlash() {
    this.muzzleTimer = 0.08;
    if (this.muzzleMesh) this.muzzleMesh.material.opacity = 1;
    if (this.muzzleLight) this.muzzleLight.intensity = 2.6;
  }

  update(dt, player, enemyManager, weaponSystem, raidTimeLeft, onComms, onAllyKill, allAllies = [], onAllyEvent = null) {
    if (this.extracted) return;

    if (player && player.position) {
      const refPos = (player.dead && player.spectatingAlly && player.spectatingAlly.position)
        ? player.spectatingAlly.position
        : player.position;
      this.lastPlayerDist = Math.hypot(this.position.x - refPos.x, this.position.z - refPos.z);
      // Scale overhead nametag + distance indicator with distance so squadmates stay readable far away!
      if (this.tagSprite) {
        const sc = THREE.MathUtils.clamp(1.0 + this.lastPlayerDist * 0.032, 1.0, 9.5);
        this.tagSprite.scale.set(1.85 * sc, 0.42 * sc, 1);
        this.tagSprite.position.y = 2.08 + Math.min(4.8, this.lastPlayerDist * 0.022);
      }
    }

    // Remote Human Party Member: smoothly interpolate live network transform, stance, and vitals!
    if (this.isRemoteHuman) {
      if (this.muzzleTimer > 0) {
        this.muzzleTimer -= dt;
        if (this.muzzleTimer <= 0) {
          if (this.muzzleMesh) this.muzzleMesh.material.opacity = 0;
          if (this.muzzleLight) this.muzzleLight.intensity = 0;
        }
      }
      if (this._hasRemoteSync) {
        const prevX = this.position.x;
        const prevZ = this.position.z;
        const lerpRate = Math.min(1, dt * 14);
        // When being revived/dragged locally by the player, let the reviver parent our position directly!
        if (!this.beingRevivedBy) {
          this.position.lerp(this._remoteTargetPos, lerpRate);
          this.group.position.x = this.position.x;
          this.group.position.z = this.position.z;

          // Shortest-angle yaw interpolation
          let dYaw = this._remoteTargetYaw - this.group.rotation.y;
          while (dYaw > Math.PI) dYaw -= Math.PI * 2;
          while (dYaw < -Math.PI) dYaw += Math.PI * 2;
          this.group.rotation.y += dYaw * lerpRate;
        }

        const moveDist = Math.hypot(this.position.x - prevX, this.position.z - prevZ) / Math.max(0.001, dt);
        const moving = moveDist > 0.35;

        if (this.dead) {
          this.group.position.y = this.position.y + 0.16;
          this.group.rotation.x = -Math.PI / 2;
          if (this.leftHip) this.leftHip.rotation.set(0, 0, -0.06);
          if (this.rightHip) this.rightHip.rotation.set(0, 0, 0.06);
          if (this.leftArm) this.leftArm.rotation.set(0, 0, 0.28);
          if (this.rightArm) this.rightArm.rotation.set(0, 0, -0.28);
          this._redrawTag('ELIMINATED', '#ff5252');
          this._updateBleedSprite(dt);
        } else if (this.isDowned) {
          const phase = (moving && !this.beingRevivedBy) ? Math.sin(performance.now() * 0.006) : 0;
          const heave = Math.max(0, phase);
          this.group.position.y = this.position.y - 0.56 + heave * 0.035;
          this.group.rotation.x = -0.24 - heave * 0.04;
          if (this.leftHip) this.leftHip.rotation.x = 1.72 + heave * 0.14;
          if (this.rightHip) this.rightHip.rotation.x = 1.62 + Math.max(0, -phase) * 0.10;
          if (this.opModel) {
            if (this.opModel.leftLeg && this.opModel.leftLeg.knee) this.opModel.leftLeg.knee.rotation.x = -0.22;
            if (this.opModel.rightLeg && this.opModel.rightLeg.knee) this.opModel.rightLeg.knee.rotation.x = -0.16;
          }
          this._redrawTag(this.beingRevivedBy ? `REVIVING ${Math.round(this.reviveProgress * 100)}%` : `DOWNED ${Math.ceil(Math.max(0, this.downedBleedTimer))}s`, this.beingRevivedBy ? '#69f0ae' : '#ff5252');
          this._updateBleedSprite(dt);
        } else {
          if (this.bleedSprite) this.bleedSprite.visible = false;
          // Prone rotates the standing rig (feet at y=0) forward ~86° onto belly -> pivot must sit at +0.20 ABOVE floor, never negative!
          const isProne = this._remoteStance === 'prone';
          const isSlide = this._remoteStance === 'slide';
          const isCrouch = this._remoteStance === 'crouch';
          const stanceY = isProne ? 0.20 : (isSlide ? -0.36 : (isCrouch ? -0.24 : 0));
          const stancePitch = isProne ? 1.48 : (isSlide ? -0.24 : 0);
          this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, this.position.y + stanceY, lerpRate);
          this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, stancePitch, lerpRate);

          const rPitch = THREE.MathUtils.clamp(this._remotePitch || 0, -0.85, 0.85);
          if (isSlide && this.opModel) {
            // Baseball-slide pose: lead leg kicked straight out in front, trailing knee tucked!
            this.leftHip.rotation.x = THREE.MathUtils.lerp(this.leftHip.rotation.x, 1.52, lerpRate);
            this.opModel.leftLeg.knee.rotation.x = THREE.MathUtils.lerp(this.opModel.leftLeg.knee.rotation.x, -0.05, lerpRate);
            this.rightHip.rotation.x = THREE.MathUtils.lerp(this.rightHip.rotation.x, 1.15, lerpRate);
            this.opModel.rightLeg.knee.rotation.x = THREE.MathUtils.lerp(this.opModel.rightLeg.knee.rotation.x, -2.25, lerpRate);
          } else if (moving) {
            this.animCycle += dt * Math.min(13, moveDist * (this._remoteTacSprint ? 1.7 : 1.4));
            const legAmp = isProne ? 0.14 : (this._remoteTacSprint ? 0.78 : 0.52);
            if (this.leftHip) this.leftHip.rotation.x = Math.sin(this.animCycle) * legAmp;
            if (this.rightHip) this.rightHip.rotation.x = -Math.sin(this.animCycle) * legAmp;
            if (this.opModel) {
              this.opModel.leftLeg.knee.rotation.x = -Math.max(0, -Math.cos(this.animCycle)) * 0.75 - 0.1;
              this.opModel.rightLeg.knee.rotation.x = -Math.max(0, Math.cos(this.animCycle)) * 0.75 - 0.1;
            }
          } else {
            if (this.leftHip) this.leftHip.rotation.x = THREE.MathUtils.lerp(this.leftHip.rotation.x, 0.10, dt * 10);
            if (this.rightHip) this.rightHip.rotation.x = THREE.MathUtils.lerp(this.rightHip.rotation.x, -0.08, dt * 10);
            if (this.opModel) {
              this.opModel.leftLeg.knee.rotation.x = THREE.MathUtils.lerp(this.opModel.leftLeg.knee.rotation.x, -0.14, dt * 10);
              this.opModel.rightLeg.knee.rotation.x = THREE.MathUtils.lerp(this.opModel.rightLeg.knee.rotation.x, -0.10, dt * 10);
            }
          }
          // Track player's live crosshair pitch with head, torso & both weapon-holding arms (+ prone aiming, reload, plating, healing & tac-sprint!)
          if (this.opModel) {
            const m = this.opModel;
            const tNow = performance.now() * 0.005;
            if (isProne) {
              // Prone: arms tucked underneath chest holding weapon upright, head aligned to sights!
              m.head.rotation.x = THREE.MathUtils.lerp(m.head.rotation.x, 0.92 + rPitch * 0.45, lerpRate);
              m.torso.rotation.x = THREE.MathUtils.lerp(m.torso.rotation.x, 0.22, lerpRate);
              m.leftArm.shoulder.rotation.set(1.14, 0, 0.36);
              m.leftArm.elbow.rotation.x = 1.36;
              m.rightArm.shoulder.rotation.set(1.18, 0, -0.18);
              m.rightArm.elbow.rotation.x = 1.32;
              if (m.weaponMount) m.weaponMount.rotation.x = -Math.PI / 2 + 0.44;
            } else if (this._remotePlate) {
              // Armor plating animation on 3rd-person operator
              const cyc = Math.sin(tNow * 1.4) * 0.5 + 0.5;
              m.head.rotation.x = THREE.MathUtils.lerp(m.head.rotation.x, -0.32, lerpRate);
              m.torso.rotation.x = THREE.MathUtils.lerp(m.torso.rotation.x, -0.12, lerpRate);
              m.rightArm.shoulder.rotation.set(0.42 + cyc * 0.45, 0, -0.35);
              m.rightArm.elbow.rotation.x = 1.35;
              m.leftArm.shoulder.rotation.set(0.55, 0, 0.38);
              m.leftArm.elbow.rotation.x = 1.25;
              if (m.handPlate) m.handPlate.visible = true;
            } else if (this._remoteHeal) {
              // Field Medkit healing animation on 3rd-person operator
              const cyc = Math.sin(tNow * 1.2) * 0.22;
              m.head.rotation.x = THREE.MathUtils.lerp(m.head.rotation.x, -0.42, lerpRate);
              m.torso.rotation.x = THREE.MathUtils.lerp(m.torso.rotation.x, -0.16, lerpRate);
              m.leftArm.shoulder.rotation.set(0.62, 0, 0.36);
              m.leftArm.elbow.rotation.x = 1.28;
              m.rightArm.shoulder.rotation.set(0.68 + cyc, 0, -0.34);
              m.rightArm.elbow.rotation.x = 1.34;
              if (m.handPlate) m.handPlate.visible = false;
            } else if (this._remoteReload) {
              // Live magazine reload animation on 3rd-person operator
              const cyc = Math.sin(tNow * 1.8) * 0.5 + 0.5;
              m.head.rotation.x = THREE.MathUtils.lerp(m.head.rotation.x, -0.20 + rPitch * 0.4, lerpRate);
              m.torso.rotation.x = THREE.MathUtils.lerp(m.torso.rotation.x, -0.10, lerpRate);
              m.rightArm.shoulder.rotation.set(0.92, 0, -0.18);
              m.rightArm.elbow.rotation.x = 0.88;
              m.leftArm.shoulder.rotation.set(0.45 + cyc * 0.52, 0, 0.28 + cyc * 0.20);
              m.leftArm.elbow.rotation.x = 1.15;
              if (m.handPlate) m.handPlate.visible = false;
            } else {
              if (m.handPlate) m.handPlate.visible = false;
              if (m.weaponMount) m.weaponMount.rotation.x = -Math.PI / 2;
              m.head.rotation.x = THREE.MathUtils.lerp(m.head.rotation.x, rPitch * 0.72, lerpRate);
              if (this._remoteTacSprint && moving) {
                m.torso.rotation.x = THREE.MathUtils.lerp(m.torso.rotation.x, -0.26, lerpRate);
                m.rightArm.shoulder.rotation.set(1.12, 0, -0.18);
                m.leftArm.shoulder.rotation.set(0.36 - Math.sin(this.animCycle) * 0.65, 0, 0.18);
              } else {
                m.torso.rotation.x = THREE.MathUtils.lerp(m.torso.rotation.x, -0.09 + rPitch * 0.26, lerpRate);
                const armPitch = (this._remoteAds ? 0.98 : 0.86) + rPitch * 0.74;
                m.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(m.leftArm.shoulder.rotation.x, armPitch, lerpRate);
                m.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(m.leftArm.shoulder.rotation.z, 0.45, lerpRate);
                m.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(m.rightArm.shoulder.rotation.x, armPitch + 0.04, lerpRate);
                m.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(m.rightArm.shoulder.rotation.z, -0.15, lerpRate);
              }
            }
          }
          const stLbl = this._remotePlate ? 'PLATING' : (this._remoteHeal ? 'HEALING' : (this._remoteReload ? 'RELOADING' : (isSlide ? 'SLIDE' : (isCrouch ? 'CROUCH' : (isProne ? 'PRONE' : 'SQUAD')))));
          this._redrawTag(stLbl, this.squadColor);
        }
      } else {
        this._redrawTag('SYNCING...', '#ffca28');
      }
      return;
    }

    // Dead ally: still update overhead revivable medical-cross sprite (can be slow-revived!)
    if (this.dead) {
      this._updateBleedSprite(dt);
      return;
    }

    // Downed ally: crawl slowly towards player/safety, bleed out unless being revived
    if (this.isDowned) {
      if (!this.beingRevivedBy) {
        this.downedBleedTimer -= dt;
        // Scoot slowly toward player for safety (legs in front, supporting arm heaving body)
        if (player && !player.dead && !player.isDowned) {
          this._moveToward(player.position.x, player.position.z, 1.1, dt);
          this.group.rotation.y = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
          this._scootCycle = (this._scootCycle || 0) + dt * 4.4;
          const phase = Math.sin(this._scootCycle);
          const heave = Math.max(0, phase);
          const gyS = (this.world && this.world.getTerrainHeight) ? this.world.getTerrainHeight(this.position.x, this.position.z) : 0;
          this.position.y = gyS;
          this.group.position.y = gyS - 0.56 + heave * 0.035;
          this.group.rotation.x = -0.24 - heave * 0.04;
          if (this.leftHip) this.leftHip.rotation.x = 1.72 + heave * 0.14;
          if (this.rightHip) this.rightHip.rotation.x = 1.62 + Math.max(0, -phase) * 0.10;
          if (this.opModel) {
            if (this.opModel.leftLeg && this.opModel.leftLeg.knee) this.opModel.leftLeg.knee.rotation.x = -0.22;
            if (this.opModel.rightLeg && this.opModel.rightLeg.knee) this.opModel.rightLeg.knee.rotation.x = -0.16;
          }
        }
        this._redrawTag(`DOWNED ${Math.ceil(Math.max(0, this.downedBleedTimer))}s`, '#ff5252');
        if (this.downedBleedTimer <= 0) {
          this.die();
          if (onAllyEvent) onAllyEvent('eliminated', this, this.downedBy);
          return;
        }
      } else {
        this._redrawTag(`REVIVING ${Math.round(this.reviveProgress * 100)}%`, '#69f0ae');
      }
      this._updateBleedSprite(dt);
      return;
    }

    if (this.calloutCooldown > 0) this.calloutCooldown = Math.max(0, this.calloutCooldown - dt);
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.muzzleMesh.material.opacity = 0;
        if (this.muzzleLight) this.muzzleLight.intensity = 0;
      }
    }

    this._evaluateObjective(raidTimeLeft, onComms);

    // 1. Scan for nearest visible standing hostile (ignore downed targets!)
    let targetEnemy = null;
    let bestEnemyDist = 35;
    if (enemyManager && enemyManager.enemies) {
      for (const e of enemyManager.enemies) {
        if (e.dead || e.isDowned) continue;
        const d = this.position.distanceTo(e.position);
        if (d < bestEnemyDist && this._hasLineOfSight(new THREE.Vector3(e.position.x, 1.3, e.position.z))) {
          bestEnemyDist = d;
          targetEnemy = e;
        }
      }
    }

    // 1b. Priority 0: Revive & Drag Downed or Eliminated Teammates (Player or other SquadMates)
    let reviveCandidate = null;
    if (player && (player.isDowned || player.dead) && (!player.beingRevivedBy || player.beingRevivedBy === this.name)) {
      reviveCandidate = { isPlayer: true, ref: player, pos: player.position, name: 'YOU' };
    } else {
      let bestScore = Infinity;
      for (const mate of allAllies) {
        if (!mate || mate === this || mate.extracted) continue;
        if (!(mate.isDowned || mate.dead)) continue;
        if (mate.beingRevivedBy && mate.beingRevivedBy !== this.name) continue;
        // Prioritize downed mates before dead mates
        const score = (mate.isDowned ? 0 : 100) + this.position.distanceTo(mate.position);
        if (score < bestScore) {
          bestScore = score;
          reviveCandidate = { isPlayer: false, ref: mate, pos: mate.position, name: mate.name };
        }
      }
    }

    if (reviveCandidate) {
      const tRef = reviveCandidate.ref;
      const distToMate = Math.hypot(tRef.position.x - this.position.x, tRef.position.z - this.position.z);
      this.state = 'REVIVING';
      if (distToMate > 2.0) {
        this._redrawTag('MOVING TO REVIVE', '#69f0ae');
        this.group.rotation.y = Math.atan2(tRef.position.x - this.position.x, tRef.position.z - this.position.z);
        const moved = this._moveToward(tRef.position.x, tRef.position.z, 6.6, dt);
        if (moved) {
          this.animCycle += dt * 9.5;
          this.leftHip.rotation.x = Math.sin(this.animCycle) * 0.52;
          this.rightHip.rotation.x = -Math.sin(this.animCycle) * 0.52;
        }
        return;
      }

      // Within revive reach! Downed = 3.5s, Dead = 7.5s (slower full revive)
      const reviveDur = tRef.dead ? 7.5 : 3.5;
      tRef.beingRevivedBy = this.name;
      tRef.reviveProgress = Math.min(1, (tRef.reviveProgress || 0) + dt / reviveDur);

      // If teammate is DOWNED and exposed to a visible enemy, drag them to the nearest cover obstacle while reviving!
      let dragging = false;
      if (tRef.isDowned && targetEnemy) {
        const cover = this._findBestCoverSpot(targetEnemy.position, 16);
        let dragTargetX, dragTargetZ;
        if (cover) {
          dragTargetX = cover.coverPos.x;
          dragTargetZ = cover.coverPos.z;
        } else {
          const awayX = this.position.x - targetEnemy.position.x;
          const awayZ = this.position.z - targetEnemy.position.z;
          const awayLen = Math.hypot(awayX, awayZ) || 1;
          dragTargetX = this.position.x + (awayX / awayLen) * 3.0;
          dragTargetZ = this.position.z + (awayZ / awayLen) * 3.0;
        }
        dragging = this._moveToward(dragTargetX, dragTargetZ, 1.75, dt);
        if (dragging) {
          const dx = dragTargetX - this.position.x;
          const dz = dragTargetZ - this.position.z;
          const len = Math.hypot(dx, dz) || 1;
          const pullX = this.position.x - (dx / len) * 0.95;
          const pullZ = this.position.z - (dz / len) * 0.95;
          if (reviveCandidate.isPlayer) {
            tRef.beingDragged = true;
            tRef.dragToward(pullX, pullZ, 2.2, dt);
          } else {
            tRef.dragToward(pullX, pullZ, 2.2, dt);
          }
          this.animCycle += dt * 4.5;
          this.leftHip.rotation.x = Math.sin(this.animCycle) * 0.25;
          this.rightHip.rotation.x = -Math.sin(this.animCycle) * 0.25;
        }
      } else if (reviveCandidate.isPlayer) {
        tRef.beingDragged = false;
      }

      this._redrawTag(dragging ? 'DRAGGING TO COVER' : (tRef.dead ? 'REVIVING (SLOW)' : 'REVIVING'), '#69f0ae');
      if (tRef.reviveProgress >= 1) {
        tRef.revive(45);
        this._say(onComms, `Got ${reviveCandidate.name} back up — stay sharp!`, '#69f0ae');
        if (onAllyEvent) onAllyEvent('revived', tRef, { name: this.name });
        this.state = 'FOLLOW';
      }
      return;
    }

    // 2. Self-preservation: Heal / Plate / Reload timers
    if (this.actionTimer > 0) {
      this.actionTimer -= dt;
      if (this.actionTimer <= 0) {
        if (this.state === 'HEAL') {
          this.medkits = Math.max(0, this.medkits - 1);
          this.hp = Math.min(this.maxHp, this.hp + 55);
          this.state = 'FOLLOW';
        } else if (this.state === 'PLATE') {
          this.plates = Math.max(0, this.plates - 1);
          this.armor = Math.min(this.maxArmor, this.armor + 50);
          this.state = 'FOLLOW';
        } else if (this.state === 'RELOAD') {
          this.mag = this.magSize;
          this.state = 'FOLLOW';
        }
      }
      this._redrawTag(this.state, '#f5a623');
      this.leftHip.rotation.x = THREE.MathUtils.lerp(this.leftHip.rotation.x, 0, dt * 10);
      this.rightHip.rotation.x = THREE.MathUtils.lerp(this.rightHip.rotation.x, 0, dt * 10);
      return;
    }

    // Trigger Heal / Plate / Reload when needed
    if (this.hp < 58 && this.medkits > 0) {
      this.state = 'HEAL';
      this.actionTimer = 2.6;
      this._say(onComms, 'Patching up — cover me!', '#f5a623');
      return;
    }
    if (this.mag <= 0) {
      this.state = 'RELOAD';
      this.actionTimer = 1.8;
      this._say(onComms, 'Reloading!', '#f5a623');
      return;
    }
    if (!targetEnemy && this.armor < 45 && this.plates > 0) {
      this.state = 'PLATE';
      this.actionTimer = 1.8;
      this._say(onComms, 'Slotting a fresh armor plate.', '#64b5f6');
      return;
    }

    let moving = false;

    // 3. Priority A: Combat Engagement (play cover -> peek to fire -> tuck back into cover!)
    if (targetEnemy) {
      this.state = 'COMBAT';
      this._redrawTag('HOLDING COVER', '#ff6b6b');
      this.group.rotation.y = Math.atan2(targetEnemy.position.x - this.position.x, targetEnemy.position.z - this.position.z);

      this.coverSearchTimer = (this.coverSearchTimer || 0) - dt;
      if (!this.coverSpot || this.coverSearchTimer <= 0) {
        const found = this._findBestCoverSpot(targetEnemy.position, 18);
        if (found) this.coverSpot = found;
        this.coverSearchTimer = 2.6;
      }
      if (this.coverSpot) {
        this.coverPeekTimer = (this.coverPeekTimer || 1.3) - dt;
        if (this.coverPeekTimer <= 0) {
          this.isPeeking = !this.isPeeking;
          this.coverPeekTimer = this.isPeeking ? (1.4 + Math.random() * 0.8) : (0.95 + Math.random() * 0.65);
        }
        const goal = this.isPeeking ? this.coverSpot.peekPos : this.coverSpot.coverPos;
        if (Math.hypot(goal.x - this.position.x, goal.z - this.position.z) > 0.45) {
          moving = this._moveToward(goal.x, goal.z, this.isPeeking ? 4.2 : 5.4, dt);
        }
      } else if (bestEnemyDist > 22) {
        moving = this._moveToward(targetEnemy.position.x, targetEnemy.position.z, 4.8, dt);
      }

      this.fireTimer -= dt;
      if (this.fireTimer <= 0 && this.mag > 0) {
        this.mag -= 1;
        this.fireTimer = this.weaponId === 'm24' ? 1.1 : (0.22 + Math.random() * 0.20);
        this.muzzleMesh.material.opacity = 0.92;
        if (this.muzzleLight) this.muzzleLight.intensity = 3.2;
        this.muzzleTimer = 0.05;

        const distToPlayer = this.position.distanceTo(player.position);
        window.soundEngine.playGunshot(this.weaponId, distToPlayer, false);

        const muzzleWorld = new THREE.Vector3();
        this.muzzleMesh.getWorldPosition(muzzleWorld);
        const hitPos = new THREE.Vector3(targetEnemy.position.x, 1.25, targetEnemy.position.z);
        if (weaponSystem && weaponSystem._spawnTracer) {
          weaponSystem._spawnTracer(muzzleWorld, hitPos);
        }
        const dmg = this.weaponId === 'm24' ? 62 : 24;
        if (Math.random() < 0.64) {
          const wDef = GAME_DATA.ITEMS[this.weaponId];
          const attackerInfo = {
            name: this.name,
            isPlayer: false,
            weaponId: this.weaponId,
            weaponName: wDef ? wDef.name : this.weaponId.toUpperCase()
          };
          const killed = targetEnemy.takeDamage(dmg, this.position, attackerInfo);
          if (targetEnemy.justDowned) {
            targetEnemy.justDowned = false;
            if (onAllyKill) onAllyKill(this, targetEnemy, 'downed');
          }
          if (killed) {
            this.kills += 1;
            if (onAllyKill) onAllyKill(this, targetEnemy, 'eliminated');
          }
        }
        // Enemy return-fire pressure (can down/eliminate allies just like players!)
        if (Math.random() < 0.16 && !targetEnemy.dead && !targetEnemy.isDowned && (!targetEnemy.stunTimer || targetEnemy.stunTimer <= 0)) {
          const ewDef = GAME_DATA.ITEMS[targetEnemy.weaponId];
          this.takeDamage(16, {
            name: targetEnemy.name,
            weaponId: targetEnemy.weaponId || 'ak74m',
            weaponName: ewDef ? ewDef.name : 'AK-74M'
          }, onAllyEvent);
        }
      }
    } else if (this.wantsExtract) {
      // 4. Priority B: Push to Nearest Extraction Beacon & Extract!
      this.state = 'EXTRACT';
      this._redrawTag('EXTRACTING', '#69f0ae');
      const zone = this._findNearestExtract();
      if (zone) {
        const dZone = Math.hypot(zone.position.x - this.position.x, zone.position.z - this.position.z);
        const dPlayer = this.position.distanceTo(player.position);
        // If player is nearby and not far behind, lead toward beacon; always push in if time < 65s or inside 18m of beacon
        if (dZone > zone.radius * 0.65) {
          const spd = (raidTimeLeft < 65 || dPlayer < 16) ? 8.6 : 5.4;
          moving = this._moveToward(zone.position.x, zone.position.z, spd, dt);
          this.group.rotation.y = Math.atan2(zone.position.x - this.position.x, zone.position.z - this.position.z);
        } else {
          this.extractProgress += dt;
          this._redrawTag(`EXFIL ${Math.max(0, 5 - this.extractProgress).toFixed(0)}s`, '#69f0ae');
          if (this.extractProgress >= 5.0) {
            this.extracted = true;
            this.group.visible = false;
            if (onComms) onComms(`[${this.name}] Extracted safely with ₽${this.lootValue.toLocaleString()}!`, '#69f0ae');
            return;
          }
        }
      }
    } else {
      // 5. Priority C: Autonomous Looting for Personal Gear/Value Objective vs Tactical Follow
      if (!this.targetContainer && !this.objectiveComplete) {
        const found = this._findNearbyLootTarget(enemyManager);
        if (found && this.position.distanceTo(player.position) < 22) {
          this.targetContainer = found;
          this._say(onComms, `Checking ${found.label} for gear...`, '#64b5f6');
        }
      }

      if (this.targetContainer) {
        const items = this.targetContainer.type === 'crate'
          ? this.targetContainer.ref.items
          : this.targetContainer.ref.loot;
        const tooFarFromPlayer = this.position.distanceTo(player.position) > 26;
        if (!items || items.length === 0 || tooFarFromPlayer) {
          this.targetContainer = null;
        } else {
          this.state = 'LOOT';
          this._redrawTag('LOOTING', '#64b5f6');
          const d = Math.hypot(this.targetContainer.pos.x - this.position.x, this.targetContainer.pos.z - this.position.z);
          if (d > 1.7) {
            moving = this._moveToward(this.targetContainer.pos.x, this.targetContainer.pos.z, 6.5, dt);
            this.group.rotation.y = Math.atan2(this.targetContainer.pos.x - this.position.x, this.targetContainer.pos.z - this.position.z);
          } else {
            // Take 1 needed item (medkit, plate, or highest-value item)
            let takeIdx = items.findIndex(i => (this.medkits < 2 && i.id === 'medkit') || (this.plates < 3 && i.id === 'armor_plate'));
            if (takeIdx < 0) takeIdx = 0;
            const taken = items.splice(takeIdx, 1)[0];
            if (taken) {
              const def = GAME_DATA.ITEMS[taken.id];
              if (taken.id === 'medkit') this.medkits += taken.qty;
              else if (taken.id === 'armor_plate') this.plates += taken.qty;
              if (def) {
                this.lootValue += def.value * taken.qty;
                this._say(onComms, `Grabbed ${def.name} (₽${(def.value * taken.qty).toLocaleString()}).`, '#69f0ae');
              }
            }
            this.targetContainer = null;
          }
        }
      }

      if (!this.targetContainer) {
        this.state = 'FOLLOW';
        this._redrawTag('ESCORT', '#69f0ae');
        const sinY = Math.sin(player.yaw);
        const cosY = Math.cos(player.yaw);
        const goalX = player.position.x + sinY * 2.8 + cosY * (this.flankSide * 2.4);
        const goalZ = player.position.z + cosY * 2.8 - sinY * (this.flankSide * 2.4);
        const distToGoal = Math.hypot(goalX - this.position.x, goalZ - this.position.z);
        if (distToGoal > 1.5) {
          const moveSpeed = distToGoal > 7.5 ? 8.4 : (distToGoal > 3.5 ? 5.6 : 3.8);
          moving = this._moveToward(goalX, goalZ, moveSpeed, dt);
          this.group.rotation.y = Math.atan2(goalX - this.position.x, goalZ - this.position.z);
        }
      }
    }

    if (moving) {
      this.animCycle += dt * 8.5;
      this.leftHip.rotation.x = Math.sin(this.animCycle) * 0.45;
      this.rightHip.rotation.x = -Math.sin(this.animCycle) * 0.45;
    } else {
      this.leftHip.rotation.x = THREE.MathUtils.lerp(this.leftHip.rotation.x, 0, dt * 10);
      this.rightHip.rotation.x = THREE.MathUtils.lerp(this.rightHip.rotation.x, 0, dt * 10);
    }
  }
}

class SquadManager {
  constructor(scene, world, partyMembers = [], weaponSystem = null) {
    this.scene = scene;
    this.world = world;
    this.weaponSystem = weaponSystem;
    this.allies = [];
    this.announced = false;

    const squadColors = (GAME_DATA && GAME_DATA.SQUAD_COLORS) || ['#69f0ae', '#42a5f5', '#ffeb3b', '#ff69b4'];
    const alliesOnly = (partyMembers || []).filter(m => !m.isSelf);
    alliesOnly.forEach((m, idx) => {
      const side = idx % 2 === 0 ? -1 : 1;
      const sx = world.playerSpawn.x + side * (2.2 + idx * 0.6);
      const sz = world.playerSpawn.z + 1.8;
      const sy = world.getTerrainHeight ? world.getTerrainHeight(sx, sz) : 0;
      const spawn = new THREE.Vector3(sx, sy, sz);
      this.allies.push(new SquadMate(scene, world, spawn, {
        name: m.name,
        clientId: m.clientId || null,
        isRemoteHuman: !!m.isRemoteHuman,
        squadColor: m.squadColor || squadColors[(idx + 1) % squadColors.length],
        weaponId: m.weaponId || (idx % 2 === 0 ? 'ak74m' : 'mp5k'),
        flankSide: side
      }, weaponSystem));
    });
  }

  syncRemotePlayers(mpSession) {
    if (!mpSession || !mpSession.active) return;
    for (const ally of this.allies) {
      if (!ally.isRemoteHuman || !ally.clientId) continue;
      const st = mpSession.remoteStates.get(ally.clientId);
      if (st) ally.applyRemoteState(st);
    }
  }

  getAllyByClientId(clientId) {
    return this.allies.find(a => a.clientId === clientId) || null;
  }

  getHitboxMeshes() {
    const list = [];
    for (const a of this.allies) {
      if (!a.dead && !a.extracted && a.hitboxes) {
        list.push(...a.hitboxes);
      }
    }
    return list;
  }

  update(dt, player, enemyManager, weaponSystem, raidTimeLeft, onComms, onAllyKill, onAllyEvent) {
    if (!this.announced && this.allies.length > 0 && onComms) {
      this.announced = true;
      for (const a of this.allies) {
        onComms(`[${a.name}] On your six — ${a.objective.label}.`, '#64b5f6');
      }
    }
    for (const ally of this.allies) {
      ally.update(dt, player, enemyManager, weaponSystem, raidTimeLeft, onComms, onAllyKill, this.allies, onAllyEvent);
    }
  }

  hasLivingAlly() {
    return this.allies.some(a => !a.dead && !a.extracted);
  }
}
