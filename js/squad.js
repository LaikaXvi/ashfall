// Autonomous, Self-Aware Extraction AI Squadmates
// Each squadmate has personal gear needs, raid objectives, tactical combat AI, self-healing/plating, looting, and extraction goals.
class SquadMate {
  constructor(scene, world, spawnPos, memberInfo) {
    this.scene = scene;
    this.world = world;
    this.name = memberInfo.name || 'ALLY';
    this.weaponId = memberInfo.weaponId || 'ak74m';
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
    const uniformMat = new THREE.MeshLambertMaterial({ color: 0x2f434a });
    const vestMat = new THREE.MeshLambertMaterial({ color: 0x3b4d3e });
    const gearMat = new THREE.MeshLambertMaterial({ color: 0x1a1d20 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd1a483 });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0x69f0ae });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.25), uniformMat);
    torso.position.set(0, 1.18, 0);
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.40, 0.29), vestMat);
    vest.position.set(0, 1.20, 0);
    const patchL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.08), accentMat);
    patchL.position.set(-0.24, 1.36, 0);
    const patchR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.08), accentMat);
    patchR.position.set(0.24, 1.36, 0);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.23, 0.22), skinMat);
    head.position.set(0, 1.58, 0);
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.26), gearMat);
    helmet.position.set(0, 1.66, 0);

    const makeLeg = (xOff) => {
      const hip = new THREE.Group();
      hip.position.set(xOff, 0.88, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.84, 0.16), uniformMat);
      leg.position.set(0, -0.42, 0);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.22), gearMat);
      boot.position.set(0, -0.83, 0.03);
      hip.add(leg, boot);
      g.add(hip);
      return hip;
    };
    this.leftHip = makeLeg(-0.12);
    this.rightHip = makeLeg(0.12);

    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.62), gearMat);
    rifle.position.set(0.24, 1.24, 0.30);
    this.muzzleMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffdd77, transparent: true, opacity: 0 })
    );
    this.muzzleMesh.position.set(0.24, 1.25, 0.64);
    this.muzzleLight = new THREE.PointLight(0xffaa44, 0, 7);
    this.muzzleLight.position.copy(this.muzzleMesh.position);

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

    g.add(torso, vest, patchL, patchR, head, helmet, rifle, this.muzzleMesh, this.muzzleLight, this.tagSprite);
    g.position.copy(this.position);
    this.scene.add(g);
    this.group = g;
  }

  _redrawTag(statusLabel, color = '#69f0ae') {
    const key = `${statusLabel}|${Math.ceil(this.hp)}|${Math.ceil(this.armor)}`;
    if (this._lastTagState === key) return;
    this._lastTagState = key;

    const ctx = this.tagCanvas.getContext('2d');
    ctx.clearRect(0, 0, 320, 72);
    ctx.fillStyle = 'rgba(10, 16, 13, 0.78)';
    ctx.fillRect(8, 6, 304, 58);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 6, 304, 58);
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(this.name, 160, 28);
    ctx.font = '15px monospace';
    ctx.fillStyle = '#dce2dc';
    ctx.fillText(`${statusLabel} · HP ${Math.ceil(this.hp)}`, 160, 50);
    this.tagTex.needsUpdate = true;
  }

  _say(onComms, msg, color = '#64b5f6') {
    if (this.calloutCooldown > 0 || !onComms) return;
    this.calloutCooldown = 5.0;
    onComms(`[${this.name}] ${msg}`, color);
  }

  _collides(x, z, r = 0.42) {
    for (const c of this.world.colliders) {
      if (c.maxY < 0.2) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
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
    this.group.position.x = this.position.x;
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
    const hits = ray.intersectObjects(this.world.shootableMeshes, false);
    return hits.length === 0;
  }

  _takeCombatChip(amount) {
    if (this.armor > 0) {
      const abs = Math.min(this.armor, Math.round(amount * 0.78));
      this.armor -= abs;
      amount -= abs;
    }
    this.hp = Math.max(12, this.hp - amount); // resilient ally, retreats to heal when hurt
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

  update(dt, player, enemyManager, weaponSystem, raidTimeLeft, onComms, onAllyKill) {
    if (this.dead || this.extracted) return;

    if (this.calloutCooldown > 0) this.calloutCooldown = Math.max(0, this.calloutCooldown - dt);
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.muzzleMesh.material.opacity = 0;
        this.muzzleLight.intensity = 0;
      }
    }

    this._evaluateObjective(raidTimeLeft, onComms);

    // 1. Scan for nearest visible hostile
    let targetEnemy = null;
    let bestEnemyDist = 35;
    if (enemyManager && enemyManager.enemies) {
      for (const e of enemyManager.enemies) {
        if (e.dead) continue;
        const d = this.position.distanceTo(e.position);
        if (d < bestEnemyDist && this._hasLineOfSight(new THREE.Vector3(e.position.x, 1.3, e.position.z))) {
          bestEnemyDist = d;
          targetEnemy = e;
        }
      }
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

    // 3. Priority A: Combat Engagement (strafe + accurate bursts + occasional chip damage)
    if (targetEnemy) {
      this.state = 'COMBAT';
      this._redrawTag('ENGAGING', '#ff6b6b');
      this.group.rotation.y = Math.atan2(targetEnemy.position.x - this.position.x, targetEnemy.position.z - this.position.z);

      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) {
        this.strafeDir *= -1;
        this.strafeTimer = 1.2 + Math.random() * 1.4;
      }
      const toE = targetEnemy.position.clone().sub(this.position).normalize();
      const perpX = -toE.z * this.strafeDir;
      const perpZ = toE.x * this.strafeDir;
      // Keep optimal engagement distance (10..20m)
      const push = bestEnemyDist > 20 ? 0.6 : (bestEnemyDist < 9 ? -0.6 : 0);
      moving = this._moveToward(this.position.x + perpX * 2 + toE.x * push * 2, this.position.z + perpZ * 2 + toE.z * push * 2, 3.6, dt);

      this.fireTimer -= dt;
      if (this.fireTimer <= 0 && this.mag > 0) {
        this.mag -= 1;
        this.fireTimer = this.weaponId === 'm24' ? 1.1 : (0.22 + Math.random() * 0.20);
        this.muzzleMesh.material.opacity = 0.92;
        this.muzzleLight.intensity = 3.2;
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
          const killed = targetEnemy.takeDamage(dmg, this.position);
          if (killed) {
            this.kills += 1;
            if (onAllyKill) onAllyKill(this.name, targetEnemy.name);
          }
        }
        // Enemy return-fire pressure so squadmate genuinely uses plates & medkits
        if (Math.random() < 0.16 && !targetEnemy.dead && (!targetEnemy.stunTimer || targetEnemy.stunTimer <= 0)) {
          this._takeCombatChip(12);
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
          const spd = (raidTimeLeft < 65 || dPlayer < 16) ? 6.8 : 4.2;
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
            moving = this._moveToward(this.targetContainer.pos.x, this.targetContainer.pos.z, 5.2, dt);
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
  constructor(scene, world, partyMembers = []) {
    this.scene = scene;
    this.world = world;
    this.allies = [];
    this.announced = false;

    const alliesOnly = (partyMembers || []).filter(m => !m.isSelf);
    alliesOnly.forEach((m, idx) => {
      const side = idx % 2 === 0 ? -1 : 1;
      const spawn = new THREE.Vector3(
        world.playerSpawn.x + side * (2.2 + idx * 0.6),
        0,
        world.playerSpawn.z + 1.8
      );
      this.allies.push(new SquadMate(scene, world, spawn, {
        name: m.name,
        weaponId: m.weaponId || (idx % 2 === 0 ? 'ak74m' : 'mp5k'),
        flankSide: side
      }));
    });
  }

  update(dt, player, enemyManager, weaponSystem, raidTimeLeft, onComms, onAllyKill) {
    if (!this.announced && this.allies.length > 0 && onComms) {
      this.announced = true;
      for (const a of this.allies) {
        onComms(`[${a.name}] On your six — ${a.objective.label}.`, '#64b5f6');
      }
    }
    for (const ally of this.allies) {
      ally.update(dt, player, enemyManager, weaponSystem, raidTimeLeft, onComms, onAllyKill);
    }
  }
}
