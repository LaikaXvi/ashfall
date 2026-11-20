// Main Game Loop, Three.js Scene Setup & Raid Lifecycle
(function () {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  let scene = null;
  let camera = null;
  let viewmodelScene = null;
  let viewmodelCamera = null;
  let world = null;
  let weaponSystem = null;
  let throwableSystem = null;
  let player = null;
  let enemyManager = null;
  let squadManager = null;

  let inRaid = false;
  let isModalOpen = false;
  let raidTimeLeft = 0;
  let raidElapsed = 0;
  let raidKills = 0;
  let raidXp = 0;
  let extractProgress = 0;
  const EXTRACT_REQUIRED = 5.0;

  let nearbyInteractable = null; // { type: 'crate'|'corpse', label, items, container }
  let lastFrameTime = performance.now();

  const ui = new GameUI((zoneId) => startRaid(zoneId));
  const gunsmith = new GunsmithController(ui);
  const matchmaking = new MatchmakingStage(ui, (zoneId) => startRaid(zoneId));
  ui.matchmakingStage = matchmaking;
  const gamepad = new GamepadController();
  let padPaused = false;
  gamepad.onStatusChange = (connected) => {
    if (inRaid) {
      ui.addFeedMessage(connected ? 'CONTROLLER CONNECTED' : 'CONTROLLER DISCONNECTED', connected ? '#69f0ae' : '#f5a623');
    }
  };

  document.getElementById('btn-open-gunsmith').addEventListener('click', () => {
    gunsmith.open();
  });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (camera) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    if (viewmodelCamera) {
      viewmodelCamera.aspect = window.innerWidth / window.innerHeight;
      viewmodelCamera.updateProjectionMatrix();
    }
    if (gunsmith.isOpen) gunsmith._resize();
    if (matchmaking && matchmaking.active) matchmaking._resize();
  });

  function startRaid(zoneId) {
    window.soundEngine.init();
    const zone = GAME_DATA.ZONES[zoneId] || GAME_DATA.ZONES.outpost;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(zone.skyColor);
    scene.fog = new THREE.FogExp2(zone.fogColor, 0.015);

    camera = new THREE.PerspectiveCamera(window.BASE_FOV || 75, window.innerWidth / window.innerHeight, 0.05, 300);
    scene.add(camera);

    // Lighting
    const hemi = new THREE.HemisphereLight(0xd8cbb8, 0x3b352c, 0.75);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe6c2, 0.95);
    sun.position.set(45, 70, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 180;
    const d = 85;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    scene.add(sun);

    // Dedicated Viewmodel Layer (separate scene & depth pass so gun/hands NEVER clip through walls!)
    viewmodelScene = new THREE.Scene();
    viewmodelCamera = new THREE.PerspectiveCamera(window.BASE_FOV || 75, window.innerWidth / window.innerHeight, 0.01, 20);
    viewmodelScene.add(viewmodelCamera);
    viewmodelScene.add(new THREE.HemisphereLight(0xd8cbb8, 0x3b352c, 0.85));
    const vmSun = new THREE.DirectionalLight(0xffe6c2, 0.95);
    vmSun.position.set(45, 70, 30);
    viewmodelScene.add(vmSun);

    world = new WastelandWorld(scene, zone);
    weaponSystem = new WeaponSystem(scene, camera, viewmodelCamera);
    throwableSystem = new ThrowableSystem(scene, camera, viewmodelCamera, world, weaponSystem);
    player = new Player(camera, world, weaponSystem, {
      ...ui.profile.loadout,
      weaponMods: ui.profile.weaponMods || {}
    });
    // Pack any pre-match backpack items into the operator's raid backpack
    if (Array.isArray(ui.profile.loadout.backpackItems) && ui.profile.loadout.backpackItems.length > 0) {
      for (const it of ui.profile.loadout.backpackItems) {
        player.addToBackpack(it.id, it.qty);
      }
      ui.profile.loadout.backpackItems = [];
    }
    enemyManager = new EnemyManager(scene, world, zone, weaponSystem);
    squadManager = new SquadManager(scene, world, ui.partyMembers || []);

    // Notify any local browser tab in our party to infil into the same raid zone
    if (ui._socialChannel && ui.partyMembers && ui.partyMembers.length > 1) {
      try {
        ui._socialChannel.postMessage({ type: 'deploy_raid', from: ui.profile.social.callsign, zoneId });
      } catch (e) {}
    }

    ui.profile.raids += 1;
    ui.saveProfile();

    raidTimeLeft = zone.raidDuration;
    raidElapsed = 0;
    raidKills = 0;
    raidXp = 0;
    extractProgress = 0;
    inRaid = true;
    isModalOpen = false;

    document.getElementById('hud-feed').innerHTML = '';
    const kfEl = document.getElementById('hud-kill-feed');
    if (kfEl) kfEl.innerHTML = '';
    const revEl = document.getElementById('revive-banner');
    if (revEl) revEl.classList.add('hidden');
    document.getElementById('extract-banner').classList.add('hidden');
    document.getElementById('pointer-lock-overlay').classList.add('hidden');
    document.getElementById('loot-modal').classList.add('hidden');

    ui.showScreen('hud');
    ui.onDropItem = (droppedItem) => {
      if (!world || !player || !droppedItem) return;
      const sinY = Math.sin(player.yaw);
      const cosY = Math.cos(player.yaw);
      const jitter = (Math.random() - 0.5) * 0.35;
      const dropX = player.position.x - sinY * 1.05 + cosY * jitter;
      const dropZ = player.position.z - cosY * 1.05 - sinY * jitter;
      world.spawnGroundItem(droppedItem.id, droppedItem.qty, new THREE.Vector3(dropX, 0.02, dropZ));
      const def = GAME_DATA.ITEMS[droppedItem.id];
      if (def) ui.addFeedMessage(`Dropped ${def.name}${droppedItem.qty > 1 ? ' x' + droppedItem.qty : ''}`, '#a0a8a3');
    };
    ui.addFeedMessage(`Deployed to ${zone.name}`, '#69f0ae');
    canvas.requestPointerLock();
  }

  function endRaid(extracted) {
    inRaid = false;
    isModalOpen = false;
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }

    const recovered = [];
    let totalVal = 0;

    if (extracted) {
      ui.profile.extracts += 1;
      // Persist all swapped/looted operator equipment & cash back to hideout profile
      ui.profile.credits = (ui.profile.credits || 0) + (player.cash || 0);
      totalVal += (player.cash || 0);
      ui.profile.loadout.primary = player.slots.primary ? player.slots.primary.id : null;
      ui.profile.loadout.secondary = player.slots.secondary ? player.slots.secondary.id : null;
      ui.profile.loadout.melee = player.melee || null;
      ui.profile.loadout.armor = player.armorId || null;
      ui.profile.loadout.backpack = player.backpackId || 'bag_small';
      ui.profile.loadout.fieldUpgrade = player.fieldUpgrade || null;
      ui.profile.loadout.killstreak = player.killstreak || null;
      ui.profile.loadout.selfRevive = player.selfRevive || null;
      ui.profile.loadout.headgear = player.headgear || null;
      ui.profile.loadout.plates = player.plates;
      ui.profile.loadout.ammo = {};

      for (const item of player.backpack) {
        const def = GAME_DATA.ITEMS[item.id];
        if (!def) continue;
        totalVal += def.value * item.qty;
        if (def.type === 'ammo') {
          ui.profile.loadout.ammo[item.id] = (ui.profile.loadout.ammo[item.id] || 0) + item.qty;
        } else {
          ui.addToStash(item.id, item.qty);
        }
        recovered.push(item);
      }
    } else if (!window.DEV_MODE) {
      // KIA / MIA: lose raid gear and backpack (skipped in Dev Mode)
      ui.profile.loadout = {
        primary: null,
        secondary: null,
        armor: null,
        backpackItems: [],
        ammo: {}
      };
    }

    ui.profile.xp = (ui.profile.xp || 0) + raidXp;
    ui.saveProfile();
    ui.showSummary(extracted, raidElapsed, raidKills, recovered, totalVal);
  }

  // ==================== INPUT & POINTER LOCK ====================
  document.addEventListener('pointerlockchange', () => {
    if (!inRaid) return;
    const locked = document.pointerLockElement === canvas;
    if (!locked) {
      player.keys = {};
      player.isFiring = false;
      player.isADS = false;
    }
    if (!locked && !isModalOpen) {
      document.getElementById('pointer-lock-overlay').classList.remove('hidden');
    } else if (locked) {
      document.getElementById('pointer-lock-overlay').classList.add('hidden');
    }
  });

  document.getElementById('btn-resume-raid').addEventListener('click', () => {
    padPaused = false;
    document.getElementById('pointer-lock-overlay').classList.add('hidden');
    canvas.requestPointerLock();
  });

  document.getElementById('btn-abort-raid').addEventListener('click', () => {
    endRaid(false);
  });

  document.getElementById('btn-return-hideout').addEventListener('click', () => {
    ui.openMenuTab('home');
    ui.renderHideout();
    ui.showScreen('hideout');
  });

  document.getElementById('btn-close-loot').addEventListener('click', () => {
    closeLootAndResume();
  });

  document.getElementById('btn-take-all').addEventListener('click', () => {
    if (!ui.activeLootSource || !player) return;
    const remaining = [];
    for (const item of ui.activeLootSource.items) {
      if (item.revealed === false) {
        remaining.push(item);
        continue;
      }
      if (!player.addToBackpack(item.id, item.qty)) {
        remaining.push(item);
      }
    }
    ui.activeLootSource.items.length = 0;
    ui.activeLootSource.items.push(...remaining);
    if (remaining.some(i => i.revealed !== false)) {
      ui.addFeedMessage('Some items too heavy!', '#d94141');
    }
    ui.renderLootModal(player);
  });

  function closeLootAndResume() {
    isModalOpen = false;
    ui.closeLootModal();
    if (inRaid) canvas.requestPointerLock();
  }

  window.addEventListener('mousemove', (e) => {
    if (!inRaid || isModalOpen || document.pointerLockElement !== canvas) return;
    const sens = (player.isADS ? 0.0012 : 0.0022) * (window.MOUSE_SENS || 1.0);
    player.yaw -= e.movementX * sens;
    player.pitch -= e.movementY * sens;
    player.pitch = THREE.MathUtils.clamp(player.pitch, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08);
  });

  window.addEventListener('mousedown', (e) => {
    if (!inRaid || isModalOpen) return;
    if (document.pointerLockElement !== canvas) {
      if (e.target === canvas) canvas.requestPointerLock();
      return;
    }
    if (e.button === 0) {
      if (throwableSystem && throwableSystem.isBusy()) return;
      player.isFiring = true;
      firePlayerWeapon();
    } else if (e.button === 2) {
      if (throwableSystem && throwableSystem.state === 'prep') {
        throwableSystem.cancelPrep();
        if (weaponSystem && !player.isThirdPerson) weaponSystem.viewmodelGroup.visible = true;
        return;
      }
      player.isADS = true;
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!inRaid) return;
    if (e.button === 0) player.isFiring = false;
    if (e.button === 2) player.isADS = false;
  });

  window.addEventListener('contextmenu', (e) => {
    if (inRaid) e.preventDefault();
  });

  window.addEventListener('keydown', (e) => {
    if (!inRaid) {
      if (e.code === 'Escape' && !gunsmith.isOpen && ui.activeMenuTab !== 'home') {
        ui.openMenuTab('home');
      }
      return;
    }
    player.keys[e.code] = true;

    if (e.code === 'Tab') {
      e.preventDefault();
      if (isModalOpen) {
        closeLootAndResume();
      } else {
        isModalOpen = true;
        document.exitPointerLock();
        ui.openLootModal(player, 'BACKPACK', null);
      }
      return;
    }

    if (isModalOpen) {
      if (e.code === 'Escape') closeLootAndResume();
      return;
    }

    if (e.code === 'F9') {
      window.DEV_MODE = !window.DEV_MODE;
      ui.addFeedMessage(`DEV MODE: ${window.DEV_MODE ? 'ON' : 'OFF'}`, '#69f0ae');
      return;
    }

    if (e.code === 'KeyV') {
      const tp = player.toggleThirdPerson();
      ui.addFeedMessage(`CAMERA: ${tp ? '3RD PERSON' : '1ST PERSON'} [V]`, '#f5a623');
      return;
    }

    if (e.code === 'ShiftLeft') {
      if (!e.repeat) player.onSprintKeyDown();
      return;
    }
    if (e.code === 'KeyC' || e.code === 'ControlLeft') {
      if (!e.repeat) player.onCrouchKeyDown();
      return;
    }
    if (e.code === 'Space') {
      if (!e.repeat) player.onJumpKeyDown();
      return;
    }

    if (e.code === 'KeyF' || e.code === 'Digit5') {
      if (!e.repeat && throwableSystem) throwableSystem.startPrep('lethal', player, weaponSystem);
      return;
    }
    if (e.code === 'KeyQ' || e.code === 'Digit3') {
      if (!e.repeat && throwableSystem) throwableSystem.startPrep('tactical', player, weaponSystem);
      return;
    }

    if (e.code === 'Digit1') player.switchSlot('primary');
    else if (e.code === 'Digit2') player.switchSlot('secondary');
    else if (e.code === 'KeyR') player.startReload();
    else if (e.code === 'KeyI') player.startInspect();
    else if (e.code === 'KeyH') {
      if (player.startMedkit()) ui.addFeedMessage('Applying Field Medkit...', '#69f0ae');
    } else if (e.code === 'KeyG' || e.code === 'Digit4') {
      player.startPlating();
    } else if (e.code === 'KeyZ') {
      const fuMsg = player.activateFieldUpgrade ? player.activateFieldUpgrade() : null;
      if (fuMsg) ui.addFeedMessage(fuMsg, '#69f0ae');
    } else if (e.code === 'KeyE' && nearbyInteractable) {
      openNearbyInteractable();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (!inRaid || !player) return;
    player.keys[e.code] = false;
    if (e.code === 'KeyC' || e.code === 'ControlLeft') {
      player.onCrouchKeyUp();
    } else if ((e.code === 'KeyF' || e.code === 'Digit5') && throwableSystem) {
      throwableSystem.releaseThrow('lethal', player, enemyManager, onThrowableHit);
    } else if ((e.code === 'KeyQ' || e.code === 'Digit3') && throwableSystem) {
      throwableSystem.releaseThrow('tactical', player, enemyManager, onThrowableHit);
    }
  });

  function openNearbyInteractable() {
    if (!nearbyInteractable) return false;
    if (nearbyInteractable.type === 'ground') {
      const gi = nearbyInteractable.groundItem;
      if (!gi) return false;
      if (player.addToBackpack(gi.id, gi.qty)) {
        world.removeGroundItem(gi);
        const def = GAME_DATA.ITEMS[gi.id];
        if (window.soundEngine && window.soundEngine.playClick) {
          try { window.soundEngine.playClick(); } catch (e) {}
        }
        if (def) ui.addFeedMessage(`Picked up ${def.name}${gi.qty > 1 ? ' x' + gi.qty : ''}`, '#69f0ae');
        nearbyInteractable = null;
        return true;
      } else {
        ui.addFeedMessage('Backpack full / too heavy!', '#d94141');
        return false;
      }
    }
    const c = nearbyInteractable.container;
    if (c && c.requiresKey && !c.unlocked) {
      const keyIdx = player.backpack.findIndex(it => it.id === c.requiresKey);
      if (keyIdx !== -1 || window.DEV_MODE) {
        if (keyIdx !== -1 && !window.DEV_MODE) {
          player.backpack[keyIdx].qty -= 1;
          if (player.backpack[keyIdx].qty <= 0) player.backpack.splice(keyIdx, 1);
        }
        c.unlocked = true;
        ui.addFeedMessage(`Unlocked ${c.name}!`, '#ffca28');
      } else {
        ui.addFeedMessage(`LOCKED — Requires Boss Armory Key`, '#ff5252');
        return false;
      }
    }
    isModalOpen = true;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    ui.openLootModal(player, nearbyInteractable.label, nearbyInteractable.items, nearbyInteractable.operatorEquipment || null);
    return true;
  }

  function getPlayerCallsign() {
    return (ui && ui.profile && ui.profile.social && ui.profile.social.callsign) || 'YOU';
  }

  let activeReviveAlly = null;

  function handleOperatorHitResult(isHead, killed, enemy, attackerInfo = null) {
    if (!enemy) return;
    const wId = (attackerInfo && attackerInfo.weaponId) || (player.getActiveWeaponSlot() && player.getActiveWeaponSlot().id) || '';
    const wName = (attackerInfo && attackerInfo.weaponName) || '';
    const killerName = getPlayerCallsign();

    if (enemy.justDowned) {
      enemy.justDowned = false;
      raidXp += 50;
      if (enemy.isOperator) {
        ui.addKillFeedEntry({
          killerName,
          killerIsEnemy: false,
          weaponId: wId,
          weaponName: wName,
          victimName: enemy.name,
          victimIsEnemy: true,
          action: 'downed',
          isHead
        });
      }
      ui.showXpFeedback({ label: 'DOWNED', xp: 50, isDowned: true });
    }
    if (killed) {
      raidKills += 1;
      const xp = isHead ? 150 : 100;
      raidXp += xp;
      if (enemy.isOperator) {
        ui.addKillFeedEntry({
          killerName,
          killerIsEnemy: false,
          weaponId: wId,
          weaponName: wName,
          victimName: enemy.name,
          victimIsEnemy: true,
          action: 'eliminated',
          isHead
        });
      }
      ui.showXpFeedback({ label: isHead ? 'HEADSHOT' : 'KILL', xp });
    }
  }

  function onThrowableHit(isHead, killed, enemy, attackerInfo = null) {
    window.soundEngine.playHitmarker(isHead);
    ui.triggerHitmarker(isHead);
    handleOperatorHitResult(isHead, killed, enemy, attackerInfo);
  }

  function firePlayerWeapon() {
    if (player.isDowned || player.dead || player.isRevivingAlly) return;
    const slotObj = player.getActiveWeaponSlot();
    if (!slotObj) return;
    const fired = weaponSystem.tryFire(player, slotObj, world, enemyManager, (isHead, killed, enemy, attackerInfo) => {
      window.soundEngine.playHitmarker(isHead);
      ui.triggerHitmarker(isHead);
      handleOperatorHitResult(isHead, killed, enemy, attackerInfo);
    });
    if (fired && gamepad && gamepad.connected) {
      gamepad.rumbleFire(slotObj.id);
    }
    if (fired) {
      const wDef = player.getActiveWeaponDef();
      enemyManager.alertNearby(player.position, (wDef && wDef.suppressed) ? 12 : 26);
    }
  }

  function findRevivableAlly() {
    if (!squadManager || !squadManager.allies || player.isDowned || player.dead) return null;
    let best = null;
    let bestD = 2.9;
    for (const a of squadManager.allies) {
      if (!a || a.extracted || (!a.isDowned && !a.dead)) continue;
      const d = Math.hypot(player.position.x - a.position.x, player.position.z - a.position.z);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  function updatePlayerRevive(dt) {
    // Self-Revive Kit: if player is downed and has a Self-Revive Kit equipped, hold [E] to revive yourself!
    if (player && player.isDowned && !player.dead) {
      if (player.selfRevive && !isModalOpen && player.keys['KeyE'] && !player.beingRevivedBy) {
        player.beingRevivedBy = 'SELF-REVIVE';
        player.reviveProgress = Math.min(1, (player.reviveProgress || 0) + dt / 4.5);
        if (player.reviveProgress >= 1) {
          player.selfRevive = null;
          player.revive(45);
          ui.showCenterToast('SELF-REVIVE COMPLETE', '#69f0ae');
          ui.addFeedMessage('Used Self-Revive Kit', '#69f0ae');
        }
      } else if (player.beingRevivedBy === 'SELF-REVIVE') {
        player.beingRevivedBy = null;
      }
      ui.updateReviveBanner(player, null, false);
      return;
    }

    const holdingRevive = !!(player && !player.isDowned && !player.dead && !isModalOpen && player.keys['KeyE']);
    const candidate = activeReviveAlly || findRevivableAlly();

    if (holdingRevive && candidate && (candidate.isDowned || candidate.dead)) {
      const d = Math.hypot(player.position.x - candidate.position.x, player.position.z - candidate.position.z);
      if (d <= 3.6) {
        activeReviveAlly = candidate;
        player.isRevivingAlly = true;
        player.isDraggingAlly = !!candidate.isDowned;
        candidate.beingRevivedBy = getPlayerCallsign();

        // Downed revive = 3.5s, Eliminated (dead) revive = 7.5s (slower)
        const dur = candidate.dead ? 7.5 : 3.5;
        candidate.reviveProgress = Math.min(1, (candidate.reviveProgress || 0) + dt / dur);

        // Moving while reviving a DOWNED ally drags them smoothly into cover!
        const moving = Math.hypot(player.velocity.x, player.velocity.z) > 0.25;
        if (candidate.isDowned && moving) {
          const sinY = Math.sin(player.yaw);
          const cosY = Math.cos(player.yaw);
          const dragX = player.position.x - sinY * 1.15;
          const dragZ = player.position.z - cosY * 1.15;
          candidate.dragToward(dragX, dragZ, 2.4, dt);
        }

        if (candidate.reviveProgress >= 1) {
          candidate.revive(45);
          raidXp += 75;
          ui.showXpFeedback({ label: 'REVIVE', xp: 75, isRevive: true });
          ui.addFeedMessage(`Revived ${candidate.name} (+75 XP)`, '#69f0ae');
          activeReviveAlly = null;
          player.isRevivingAlly = false;
          player.isDraggingAlly = false;
        }
        ui.updateReviveBanner(player, activeReviveAlly, !!(activeReviveAlly && activeReviveAlly.isDowned && moving));
        return;
      }
    }

    if (activeReviveAlly) {
      if (activeReviveAlly.beingRevivedBy === getPlayerCallsign()) {
        activeReviveAlly.beingRevivedBy = null;
      }
      activeReviveAlly = null;
    }
    if (player) {
      player.isRevivingAlly = false;
      player.isDraggingAlly = false;
    }
    ui.updateReviveBanner(player, null, false);
  }

  function hasInteractLineOfSight(targetPos, ignoreMeshRoot = null) {
    const eye = player.position;
    const toTarget = targetPos.clone().sub(eye);
    const dist = toTarget.length();
    if (dist < 0.35) return true;
    const dir = toTarget.divideScalar(dist);
    const ray = new THREE.Raycaster(eye, dir, 0.15, Math.max(0.16, dist - 0.32));
    const hits = ray.intersectObjects(world.shootableMeshes, false);
    for (const h of hits) {
      // Ignore hits on the container's own mesh (e.g. gun locker body)
      if (ignoreMeshRoot) {
        let cur = h.object;
        let isSelf = false;
        while (cur) {
          if (cur === ignoreMeshRoot) { isSelf = true; break; }
          cur = cur.parent;
        }
        if (isSelf) continue;
      }
      return false; // blocked by a wall or obstacle!
    }
    return true;
  }

  function checkInteractions() {
    nearbyInteractable = null;
    const promptEl = document.getElementById('interact-prompt');
    const textEl = document.getElementById('interact-text');

    if (player.isDowned || player.dead) {
      promptEl.classList.add('hidden');
      return;
    }

    // Priority: Revive downed or fallen ally
    const revAlly = findRevivableAlly();
    if (revAlly) {
      textEl.textContent = revAlly.dead
        ? `Hold [E] Revive Fallen ${revAlly.name} (Slow)`
        : `Hold [E] Revive ${revAlly.name} (Move to Drag)`;
      promptEl.classList.remove('hidden');
      return;
    }

    let bestDist = 3.2;
    for (const c of world.lootContainers) {
      const d = player.position.distanceTo(c.position);
      if (d < bestDist && hasInteractLineOfSight(c.position, c.mesh)) {
        bestDist = d;
        nearbyInteractable = { type: 'crate', label: c.name, items: c.items, container: c };
      }
    }

    // Only Operator corpses are lootable (non-operators drop their gear physically & despawn after 60s)
    for (const e of enemyManager.enemies) {
      if (!e.dead || !e.isOperator) continue;
      const d = Math.hypot(player.position.x - e.position.x, player.position.z - e.position.z);
      const corpsePos = new THREE.Vector3(e.position.x, 0.45, e.position.z);
      if (d < bestDist && hasInteractLineOfSight(corpsePos)) {
        bestDist = d;
        nearbyInteractable = {
          type: 'corpse',
          label: `${e.name} (Operator)`,
          items: e.lootItems,
          operatorEquipment: e.operatorEquipment || null
        };
      }
    }

    // Physical loose loot & dropped items on the ground
    for (const gi of (world.groundItems || [])) {
      const d = Math.hypot(player.position.x - gi.position.x, player.position.z - gi.position.z);
      const giPos = new THREE.Vector3(gi.position.x, Math.max(0.25, gi.position.y + 0.15), gi.position.z);
      if (d < bestDist && d < 2.9 && hasInteractLineOfSight(giPos)) {
        bestDist = d;
        const def = GAME_DATA.ITEMS[gi.id];
        const qtyTag = gi.qty > 1 ? ` x${gi.qty}` : '';
        nearbyInteractable = { type: 'ground', label: `${def ? def.name : gi.id}${qtyTag}`, groundItem: gi };
      }
    }

    if (nearbyInteractable) {
      if (nearbyInteractable.type === 'ground') {
        textEl.textContent = `Pick up ${nearbyInteractable.label}`;
      } else {
        const locked = nearbyInteractable.container && nearbyInteractable.container.requiresKey && !nearbyInteractable.container.unlocked;
        textEl.textContent = locked ? `Unlock ${nearbyInteractable.label} [BOSS KEY]` : `Search ${nearbyInteractable.label}`;
      }
      promptEl.classList.remove('hidden');
    } else {
      promptEl.classList.add('hidden');
    }
  }

  function checkExtraction(dt) {
    let activeZone = null;
    for (const ez of world.extractZones) {
      const d = Math.hypot(player.position.x - ez.position.x, player.position.z - ez.position.z);
      if (d <= ez.radius) {
        activeZone = ez;
        break;
      }
    }

    const banner = document.getElementById('extract-banner');
    if (activeZone) {
      extractProgress += dt;
      banner.classList.remove('hidden');
      document.getElementById('extract-zone-name').textContent = activeZone.name;
      document.getElementById('extract-bar-fill').style.width = `${Math.min(100, (extractProgress / EXTRACT_REQUIRED) * 100)}%`;
      document.getElementById('extract-countdown').textContent = `${Math.max(0, EXTRACT_REQUIRED - extractProgress).toFixed(1)}s`;
      if (extractProgress >= EXTRACT_REQUIRED) {
        endRaid(true);
      }
    } else {
      extractProgress = 0;
      banner.classList.add('hidden');
    }
  }

  // ==================== MAIN LOOP ====================
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    if (inRaid && player && world) {
      const isPaused = gamepad.active
        ? (padPaused && !isModalOpen)
        : (document.pointerLockElement !== canvas && !isModalOpen);

      gamepad.update(dt, {
        player,
        weaponSystem,
        throwableSystem,
        enemyManager,
        ui,
        isPaused,
        isModalOpen,
        actions: {
          onControllerActivate: () => {
            padPaused = false;
            document.getElementById('pointer-lock-overlay').classList.add('hidden');
            ui.addFeedMessage('CONTROLLER ACTIVE', '#69f0ae');
          },
          togglePause: () => {
            padPaused = !padPaused;
            document.getElementById('pointer-lock-overlay').classList.toggle('hidden', !padPaused);
          },
          resume: () => {
            padPaused = false;
            document.getElementById('pointer-lock-overlay').classList.add('hidden');
          },
          toggleBackpack: () => {
            if (isModalOpen) {
              closeLootAndResume();
            } else {
              isModalOpen = true;
              if (document.pointerLockElement === canvas) document.exitPointerLock();
              ui.openLootModal(player, 'BACKPACK', null);
            }
          },
          closeModal: () => closeLootAndResume(),
          takeAll: () => document.getElementById('btn-take-all')?.click(),
          fire: () => firePlayerWeapon(),
          onThrowableHit,
          interact: () => openNearbyInteractable(),
          activateFieldUpgrade: () => {
            const fuMsg = player.activateFieldUpgrade ? player.activateFieldUpgrade() : null;
            if (fuMsg) ui.addFeedMessage(fuMsg, '#69f0ae');
          }
        }
      });

      if (isPaused) {
        gamepad.updateMenu(dt, {
          ui,
          gunsmith,
          onResume: () => {
            padPaused = false;
            document.getElementById('pointer-lock-overlay').classList.add('hidden');
            gamepad.clearMenuFocus();
          }
        });
      } else {
        gamepad.clearMenuFocus();
      }

      if (!isPaused) {
        raidElapsed += dt;
        raidTimeLeft -= dt;
        if (raidTimeLeft <= 0) {
          endRaid(false);
          return;
        }

        // Auto-fire if holding LMB with automatic weapon
        const wDef = player.getActiveWeaponDef();
        if (player.isFiring && wDef && wDef.auto && !isModalOpen) {
          firePlayerWeapon();
        }

        player.update(dt);
        weaponSystem.update(dt, player, wDef);
        if (throwableSystem) {
          throwableSystem.update(dt, player, weaponSystem, enemyManager, onThrowableHit, (itemName) => {
            ui.addFeedMessage(`Retrieved ${itemName}`, '#69f0ae');
          });
        }
        world.update(dt, now / 1000);

        enemyManager.update(dt, player, (enemy, hit, dmg, muzzleWorld) => {
          if (muzzleWorld) {
            weaponSystem.spawnEnemyShot(muzzleWorld, player.position, hit, world);
          }
          if (hit && !player.dead) {
            ui.triggerDamageFlash();
            ui.triggerDirectionalDamage(player, enemy.position);
            const ewDef = GAME_DATA.ITEMS[enemy.weaponId];
            const attackerInfo = {
              name: enemy.name,
              weaponId: enemy.weaponId || 'ak74m',
              weaponName: ewDef ? ewDef.name : 'AK-74M'
            };
            const res = player.takeDamage(dmg, attackerInfo);
            if (res === 'downed') {
              ui.addKillFeedEntry({
                killerName: attackerInfo.name,
                killerIsEnemy: true,
                weaponId: attackerInfo.weaponId,
                weaponName: attackerInfo.weaponName,
                victimName: getPlayerCallsign(),
                victimIsEnemy: false,
                action: 'downed'
              });
            } else if (res === 'eliminated') {
              ui.addKillFeedEntry({
                killerName: attackerInfo.name,
                killerIsEnemy: true,
                weaponId: attackerInfo.weaponId,
                weaponName: attackerInfo.weaponName,
                victimName: getPlayerCallsign(),
                victimIsEnemy: false,
                action: 'eliminated'
              });
              if (!squadManager || !squadManager.hasLivingAlly()) {
                endRaid(false);
                return;
              }
            }
          }
        }, (bledEnemy) => {
          // Downed enemy operator bled out -> credit elimination + XP feedback + kill feed to the killer!
          const db = bledEnemy && bledEnemy.downedBy;
          if (db && db.isPlayer) {
            raidKills += 1;
            raidXp += 100;
            ui.addKillFeedEntry({
              killerName: getPlayerCallsign(),
              killerIsEnemy: false,
              weaponId: db.weaponId || '',
              weaponName: db.weaponName || '',
              victimName: bledEnemy.name,
              victimIsEnemy: true,
              action: 'eliminated'
            });
            ui.showXpFeedback({ label: 'KILL', xp: 100 });
          } else if (db) {
            raidKills += 1;
            ui.addKillFeedEntry({
              killerName: db.name,
              killerIsEnemy: false,
              weaponId: db.weaponId || '',
              weaponName: db.weaponName || '',
              victimName: bledEnemy.name,
              victimIsEnemy: true,
              action: 'eliminated'
            });
          }
        });

        // Handle player bleedout expiration
        if (player._justBledOut) {
          player._justBledOut = false;
          const db = player.downedBy || { name: 'HOSTILE', weaponId: 'ak74m', weaponName: 'AK-74M' };
          ui.addKillFeedEntry({
            killerName: db.name,
            killerIsEnemy: true,
            weaponId: db.weaponId,
            weaponName: db.weaponName,
            victimName: getPlayerCallsign(),
            victimIsEnemy: false,
            action: 'eliminated'
          });
          if (!squadManager || !squadManager.hasLivingAlly()) {
            endRaid(false);
            return;
          }
        }

        if (squadManager) {
          squadManager.update(
            dt,
            player,
            enemyManager,
            weaponSystem,
            raidTimeLeft,
            (msg, color) => ui.addFeedMessage(msg, color),
            (ally, enemy, action) => {
              if (action === 'eliminated') raidKills += 1;
              if (enemy && enemy.isOperator) {
                const wDef = GAME_DATA.ITEMS[ally.weaponId];
                ui.addKillFeedEntry({
                  killerName: ally.name,
                  killerIsEnemy: false,
                  weaponId: ally.weaponId || 'ak74m',
                  weaponName: wDef ? wDef.name : 'AK-74M',
                  victimName: enemy.name,
                  victimIsEnemy: true,
                  action: action || 'eliminated'
                });
              }
            },
            (evtType, target, info) => {
              if (evtType === 'downed' || evtType === 'eliminated') {
                ui.addKillFeedEntry({
                  killerName: (info && info.name) || 'HOSTILE',
                  killerIsEnemy: true,
                  weaponId: (info && info.weaponId) || 'ak74m',
                  weaponName: (info && info.weaponName) || 'AK-74M',
                  victimName: target.name || getPlayerCallsign(),
                  victimIsEnemy: false,
                  action: evtType
                });
                if (player.dead && !squadManager.hasLivingAlly()) {
                  endRaid(false);
                }
              }
            }
          );
        }

        updatePlayerRevive(dt);
        checkInteractions();
        checkExtraction(dt);
        ui.updateSearchReveal(dt);
        ui.updateHUD(player, world, raidTimeLeft, weaponSystem, throwableSystem, enemyManager, squadManager, raidXp);
      }
      // Sync viewmodel camera to world camera & render in two passes (clearDepth prevents all wall clipping!)
      if (viewmodelCamera) {
        viewmodelCamera.position.copy(camera.position);
        viewmodelCamera.quaternion.copy(camera.quaternion);
        if (Math.abs(viewmodelCamera.fov - camera.fov) > 0.01) {
          viewmodelCamera.fov = camera.fov;
          viewmodelCamera.updateProjectionMatrix();
        }
        viewmodelCamera.updateMatrixWorld();
      }

      renderer.autoClear = false;
      renderer.clear();
      renderer.render(scene, camera);
      if (viewmodelScene && viewmodelCamera && !player.isThirdPerson) {
        renderer.clearDepth();
        renderer.render(viewmodelScene, viewmodelCamera);
      }
    } else {
      // Update 3D Matchmaking Operator Stage + countdown if active
      if (matchmaking && matchmaking.active) {
        matchmaking.update(dt);
      }
      // Enable full controller navigation in Main Menu, Stash, Operator, Settings, Gunsmith & Summary screens!
      gamepad.updateMenu(dt, { ui, gunsmith });
    }
  }

  requestAnimationFrame(animate);
})();
