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
  let isMatchHost = true;
  let isModalOpen = false;
  let raidTimeLeft = 0;
  let raidElapsed = 0;
  let raidKills = 0;
  let raidXp = 0;
  let extractProgress = 0;
  const EXTRACT_REQUIRED = 5.0;

  let nearbyInteractable = null; // { type: 'crate'|'corpse', label, items, container }
  let lastFrameTime = performance.now();

  const ui = new GameUI((zoneId, matchId) => startRaid(zoneId, matchId));
  const gunsmith = new GunsmithController(ui);
  const matchmaking = new MatchmakingStage(ui, (zoneId, matchId) => startRaid(zoneId, matchId));
  ui.matchmakingStage = matchmaking;
  const mpSession = (typeof MultiplayerSession !== 'undefined') ? new MultiplayerSession() : null;
  const devConsole = (typeof DevConsole !== 'undefined') ? new DevConsole({
    getPlayer: () => player,
    getWorld: () => world,
    getScene: () => scene,
    getEnemyManager: () => enemyManager,
    getSquadManager: () => squadManager,
    getWeaponSystem: () => weaponSystem,
    getUI: () => ui,
    getMpSession: () => mpSession,
    isInRaid: () => inRaid,
    isMatchHost: () => isMatchHost,
    getCallsign: () => getPlayerCallsign(),
    onOpenChange: (opened) => {
      if (!inRaid) return;
      if (opened) {
        if (player) {
          player.keys = {};
          player.isFiring = false;
          player.isADS = false;
        }
        document.getElementById('pointer-lock-overlay').classList.add('hidden');
        if (document.pointerLockElement === canvas) document.exitPointerLock();
      } else if (!isModalOpen && !ui.isTacMapOpen && !gamepad.active) {
        canvas.requestPointerLock();
      }
    }
  }) : null;
  window.devConsole = devConsole;
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

  function startRaid(zoneId, matchId = null) {
    if (inRaid) return;
    window.soundEngine.init();
    const zone = GAME_DATA.ZONES[zoneId] || GAME_DATA.ZONES.outpost;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(zone.skyColor);
    scene.fog = new THREE.FogExp2(zone.fogColor, 0.0062);

    camera = new THREE.PerspectiveCamera(window.BASE_FOV || 75, window.innerWidth / window.innerHeight, 0.05, 550);
    scene.add(camera);

    // Lighting
    const hemi = new THREE.HemisphereLight(0xd8cbb8, 0x3b352c, 0.75);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe6c2, 0.95);
    sun.position.set(85, 130, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 380;
    const d = 200;
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
    // Start real-time co-op multiplayer sync when deploying with party members into the SAME match!
    const activeMatchId = matchId || (ui.partyId + '_' + zoneId);
    const hasRemoteParty = (ui.partyMembers || []).some(m => !m.isSelf && m.isRemoteHuman);
    isMatchHost = !hasRemoteParty || (typeof ui.isPartyLeader === 'function' ? ui.isPartyLeader() : true);
    enemyManager = new EnemyManager(scene, world, zone, weaponSystem, hasRemoteParty && !isMatchHost);
    squadManager = new SquadManager(scene, world, ui.partyMembers || []);

    window.onSquadPvpForceFair = () => {
      if (player) {
        player.godMode = false;
        player.noclip = false;
      }
    };

    window.onSquadPvpToggle = (enabled) => {
      if (enabled) {
        window.DEV_MODE = false;
        if (player) {
          player.godMode = false;
          player.noclip = false;
        }
        ui.renderHideout();
        if (ui.syncSettingsUI) ui.syncSettingsUI();
      }
      if (mpSession && mpSession.active) {
        mpSession.sendEvent({ type: 'pvp_toggle', enabled: !!enabled });
      }
    };

    if (mpSession && hasRemoteParty) {
      mpSession.start({
        matchId: activeMatchId,
        myClientId: ui._clientId,
        myCallsign: getPlayerCallsign(),
        partyMembers: ui.partyMembers || [],
        onRemoteEvent: (peerId, pkt) => {
          if (!inRaid || !pkt) return;
          if (pkt.type === 'shot') {
            const ally = squadManager && squadManager.getAllyByClientId(peerId);
            if (ally) {
              ally.triggerRemoteMuzzleFlash();
              if (weaponSystem && weaponSystem.spawnEnemyShot && pkt.tx !== undefined) {
                const startPos = ally.position.clone().add(new THREE.Vector3(0, 1.35, 0));
                const endPos = new THREE.Vector3(pkt.tx, pkt.ty, pkt.tz);
                weaponSystem.spawnEnemyShot(startPos, endPos, false, world);
              }
            }
          } else if (pkt.type === 'ping') {
            _placePing(pkt.pingType || 'location', new THREE.Vector3(pkt.x || 0, pkt.y || 0.1, pkt.z || 0), null, false, pkt.fromName || 'SQUAD');
          } else if (pkt.type === 'enemies_sync') {
            if (!isMatchHost && enemyManager && Array.isArray(pkt.list)) {
              enemyManager.applyHostSnapshot(pkt.list);
            }
          } else if (pkt.type === 'enemy_shot') {
            if (!isMatchHost && enemyManager && enemyManager.enemies && typeof pkt.enemyIdx === 'number') {
              const e = enemyManager.enemies[pkt.enemyIdx];
              if (e && !e.dead) {
                if (e.triggerRemoteMuzzleFlash) e.triggerRemoteMuzzleFlash();
                if (weaponSystem && weaponSystem.spawnEnemyShot && pkt.tx !== undefined) {
                  const startPos = e.position.clone().add(new THREE.Vector3(0, 1.35, 0));
                  const endPos = new THREE.Vector3(pkt.tx, pkt.ty, pkt.tz);
                  weaponSystem.spawnEnemyShot(startPos, endPos, false, world);
                }
              }
            }
          } else if (pkt.type === 'enemy_hit' && isMatchHost && enemyManager && enemyManager.enemies && typeof pkt.enemyIdx === 'number') {
            const target = enemyManager.enemies[pkt.enemyIdx];
            if (target && !target.dead) {
              const killed = target.takeDamage(pkt.dmg || 25, null, {
                name: pkt.fromName || 'SQUAD',
                isPlayer: false,
                isOperator: false,
                weaponId: pkt.weaponId || 'ak74m',
                weaponName: pkt.weaponName || 'AK-74M'
              });
              if (killed && target.isOperator) {
                ui.addKillFeedEntry({
                  killerName: pkt.fromName || 'SQUAD',
                  killerIsEnemy: false,
                  weaponId: pkt.weaponId || 'ak74m',
                  weaponName: pkt.weaponName || 'AK-74M',
                  victimName: target.name,
                  victimIsEnemy: true,
                  action: 'eliminated'
                });
              }
            }
          } else if (pkt.type === 'ground_drop' && world && pkt.id) {
            if (!pkt.uid || !world.groundItems.some(g => g.uid === pkt.uid)) {
              world.spawnGroundItem(
                pkt.id,
                pkt.qty || 1,
                new THREE.Vector3(pkt.x || 0, pkt.y != null ? pkt.y : 0.02, pkt.z || 0),
                { uid: pkt.uid, mods: pkt.mods || null, mag: pkt.mag }
              );
            }
          } else if (pkt.type === 'ground_pickup' && world && pkt.uid) {
            world.removeGroundItemByUid(pkt.uid);
          } else if (pkt.type === 'pvp_toggle') {
            window.SQUAD_PVP = !!pkt.enabled;
            if (window.SQUAD_PVP) {
              window.DEV_MODE = false;
              if (player) {
                player.godMode = false;
                player.noclip = false;
              }
            }
            ui.renderHideout();
            if (ui.syncSettingsUI) ui.syncSettingsUI();
            ui.addFeedMessage(window.SQUAD_PVP ? 'SQUAD PVP: ON (DEV MODE DISABLED)' : 'SQUAD PVP: OFF', window.SQUAD_PVP ? '#ff5252' : '#69f0ae');
          } else if (pkt.type === 'revive_progress') {
            if (pkt.targetClientId === ui._clientId && player && (player.isDowned || player.dead)) {
              player.beingRevivedBy = pkt.reviverName || 'SQUAD';
              if (typeof pkt.progress === 'number') player.reviveProgress = pkt.progress;
              player._remoteReviveExpire = performance.now() + 800;
            }
          } else if (pkt.type === 'revive_complete') {
            if (pkt.targetClientId === ui._clientId && player && (player.isDowned || player.dead)) {
              player.revive(pkt.hp || 45);
              if (mpSession && mpSession.active && mpSession.sendStateNow) {
                mpSession.sendStateNow(player);
              }
              ui.showCenterToast(`REVIVED BY ${pkt.reviverName || 'SQUAD'}`, '#69f0ae');
              ui.addFeedMessage(`Revived by ${pkt.reviverName || 'SQUAD'}`, '#69f0ae');
            }
          } else if (pkt.type === 'pvp_hit') {
            if (pkt.targetClientId === ui._clientId && window.SQUAD_PVP && player && !player.dead) {
              ui.triggerDamageFlash();
              if (pkt.ax !== undefined) {
                ui.triggerDirectionalDamage(player, new THREE.Vector3(pkt.ax, pkt.ay || 0, pkt.az));
              }
              const attackerInfo = {
                name: pkt.fromName || 'SQUAD',
                weaponId: pkt.weaponId || 'ak74m',
                weaponName: pkt.weaponName || 'AK-74M'
              };
              const res = player.takeDamage(pkt.dmg || 20, attackerInfo);
              if (res === 'downed') {
                ui.addKillFeedEntry({
                  killerName: attackerInfo.name,
                  killerIsEnemy: false,
                  weaponId: attackerInfo.weaponId,
                  weaponName: attackerInfo.weaponName,
                  victimName: getPlayerCallsign(),
                  victimIsEnemy: false,
                  action: 'downed'
                });
              } else if (res === 'eliminated') {
                ui.addKillFeedEntry({
                  killerName: attackerInfo.name,
                  killerIsEnemy: false,
                  weaponId: attackerInfo.weaponId,
                  weaponName: attackerInfo.weaponName,
                  victimName: getPlayerCallsign(),
                  victimIsEnemy: false,
                  action: 'eliminated'
                });
                if (!squadManager || !squadManager.hasLivingAlly()) {
                  endRaid(false);
                }
              }
            }
          }
        }
      });
    } else if (mpSession) {
      mpSession.stop();
    }

    ui.profile.raids += 1;
    ui.saveProfile();

    raidTimeLeft = zone.raidDuration;
    raidElapsed = 0;
    raidKills = 0;
    raidXp = 0;
    extractProgress = 0;
    redZoneTimer = 0;
    redZoneDmgAccum = 0;
    activePings = [];
    window.activePings = activePings;
    pingHoldActive = false;
    pingWheelOpen = false;
    const pingCont = document.getElementById('hud-ping-markers');
    if (pingCont) pingCont.innerHTML = '';
    const pwOv = document.getElementById('ping-wheel-overlay');
    if (pwOv) pwOv.classList.add('hidden');
    activeAirstrikes = [];
    ksExplosions = [];
    uavDroneMesh = null;
    ksCooldown = 0;
    inRaid = true;
    isModalOpen = false;
    ui.toggleTacMap(false);
    const rzEl = document.getElementById('redzone-banner');
    if (rzEl) rzEl.classList.add('hidden');

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
      const gi = world.spawnGroundItem(droppedItem.id, droppedItem.qty || 1, new THREE.Vector3(dropX, 0.02, dropZ), {
        mods: droppedItem.mods || null,
        mag: droppedItem.mag
      });
      if (mpSession && mpSession.active && gi) {
        mpSession.sendEvent({
          type: 'ground_drop',
          uid: gi.uid,
          id: gi.id,
          qty: gi.qty || 1,
          x: Math.round(gi.position.x * 100) / 100,
          y: Math.round(gi.position.y * 100) / 100,
          z: Math.round(gi.position.z * 100) / 100,
          mods: gi.mods || null,
          mag: gi.mag
        });
      }
    };
    ui.addFeedMessage(`Deployed to ${zone.name}`, '#69f0ae');
    canvas.requestPointerLock();
  }

  function endRaid(extracted) {
    if (mpSession) mpSession.stop();
    if (ui && ui.setSelfPartyReady) ui.setSelfPartyReady(false);
    if (inRaid) {
      ui.toggleTacMap(false);
      const rzEl = document.getElementById('redzone-banner');
      if (rzEl) rzEl.classList.add('hidden');
    }
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
      ui.profile.loadout.backpackWeapon = player.backpackWeapon ? player.backpackWeapon.id : null;
      ui.profile.loadout.melee = player.melee || null;
      ui.profile.loadout.armor = player.armorId || null;
      ui.profile.loadout.backpack = player.backpackId || 'bag_small';
      ui.profile.loadout.fieldUpgrade = player.fieldUpgrade || null;
      ui.profile.loadout.killstreak = player.killstreak || null;
      ui.profile.loadout.selfRevive = player.selfRevive || null;
      ui.profile.loadout.headgear = player.headgear || null;
      ui.profile.loadout.plates = player.plates;
      ui.profile.loadout.ammo = {};

      if (player.backpackWeapon && GAME_DATA.ITEMS[player.backpackWeapon.id]) {
        const bwDef = GAME_DATA.ITEMS[player.backpackWeapon.id];
        totalVal += bwDef.value || 0;
        recovered.push({ id: player.backpackWeapon.id, qty: 1 });
      }

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
        backpackWeapon: null,
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
    if (!locked && !isModalOpen && !ui.isTacMapOpen && !(devConsole && devConsole.isOpen)) {
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
    ui.renderLootModal(player);
  });

  function closeLootAndResume() {
    isModalOpen = false;
    ui.closeLootModal();
    if (inRaid) canvas.requestPointerLock();
  }

  window.addEventListener('mousemove', (e) => {
    if (!inRaid || isModalOpen || document.pointerLockElement !== canvas) return;
    if (pingWheelOpen) {
      pingWheelX = THREE.MathUtils.clamp(pingWheelX + e.movementX, -110, 110);
      pingWheelY = THREE.MathUtils.clamp(pingWheelY + e.movementY, -110, 110);
      _updatePingWheelSelection();
      return;
    }
    const sens = (player.isADS ? 0.0012 : 0.0022) * (window.MOUSE_SENS || 1.0);
    player.yaw -= e.movementX * sens;
    player.pitch -= e.movementY * sens;
    player.pitch = THREE.MathUtils.clamp(player.pitch, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08);
  });

  window.addEventListener('mousedown', (e) => {
    if (!inRaid || isModalOpen || (devConsole && devConsole.isOpen)) return;
    if (ui.isTacMapOpen) return; // map canvas handles clicks when full map is open
    if (document.pointerLockElement !== canvas) {
      if (e.target === canvas) canvas.requestPointerLock();
      return;
    }
    if (e.button === 1) {
      // Mouse3: Primary Ping button (tap = live ping / live enemy tag, double-tap = enemy ping, hold = radial ping wheel)
      e.preventDefault();
      pingHoldActive = true;
      pingHoldStart = performance.now();
      pingWheelOpen = false;
      pingWheelX = 0;
      pingWheelY = 0;
      pingWheelChoice = 'cancel';
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
    if (e.button === 1 && pingHoldActive) {
      e.preventDefault();
      pingHoldActive = false;
      if (pingWheelOpen) {
        pingWheelOpen = false;
        const pwOv = document.getElementById('ping-wheel-overlay');
        if (pwOv) pwOv.classList.add('hidden');
        if (pingWheelChoice && pingWheelChoice !== 'cancel') {
          const hit = _raycastPingTarget();
          _placePing(pingWheelChoice, hit.pos, hit.enemy);
        }
      } else {
        // If looking directly at one of our own ping markers, clicking Mouse3 removes it!
        if (hoveredOwnPing) {
          const idx = activePings.indexOf(hoveredOwnPing);
          if (idx !== -1) {
            if (hoveredOwnPing.beamMesh && scene) scene.remove(hoveredOwnPing.beamMesh);
            activePings.splice(idx, 1);
            window.activePings = activePings;
            hoveredOwnPing = null;
            if (window.soundEngine && window.soundEngine.playClick) {
              try { window.soundEngine.playClick(); } catch (err) {}
            }
          }
          return;
        }
        // Quick tap on Mouse3: live-mark enemy under crosshair, or double-tap for enemy ping, or single-tap location ping
        const nowMs = performance.now();
        const isDouble = (nowMs - lastPingTapTime) < 340;
        lastPingTapTime = nowMs;
        const hit = _raycastPingTarget();
        if (hit.enemy) {
          _placePing('enemy', hit.pos, hit.enemy);
        } else if (isDouble) {
          // Upgrade quick first tap into an Enemy Ping!
          if (activePings.length > 0 && activePings[activePings.length - 1].age < 0.45) {
            const prev = activePings.pop();
            if (prev && prev.beamMesh && scene) scene.remove(prev.beamMesh);
          }
          _placePing('enemy', hit.pos, null);
        } else {
          _placePing('location', hit.pos, null);
        }
      }
      return;
    }
    if (e.button === 0) player.isFiring = false;
    if (e.button === 2) player.isADS = false;
  });

  window.addEventListener('contextmenu', (e) => {
    if (inRaid) e.preventDefault();
  });

  window.addEventListener('keydown', (e) => {
    if (devConsole && devConsole.isOpen) return;
    if (!inRaid) {
      if (e.code === 'Escape' && !gunsmith.isOpen && ui.activeMenuTab !== 'home') {
        ui.openMenuTab('home');
      }
      return;
    }
    const kb = window.KEYBINDS || {};
    player.keys[e.code] = true;

    if (e.code === (kb.backpack || 'Tab')) {
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

    if (e.code === (kb.thirdPerson || 'KeyV')) {
      const tp = player.toggleThirdPerson();
      ui.addFeedMessage(`CAMERA: ${tp ? '3RD PERSON' : '1ST PERSON'}`, '#f5a623');
      return;
    }

    if (e.code === (kb.sprint || 'ShiftLeft')) {
      if (!e.repeat) player.onSprintKeyDown();
      return;
    }
    if (e.code === (kb.crouch || 'KeyC') || e.code === 'ControlLeft') {
      if (!e.repeat) player.onCrouchKeyDown();
      return;
    }
    if (e.code === (kb.jump || 'Space')) {
      if (!e.repeat) player.onJumpKeyDown();
      return;
    }

    if (e.code === (kb.lethal || 'KeyF') || e.code === 'Digit5') {
      if (!e.repeat && !player.isDowned && !player.dead && throwableSystem) throwableSystem.startPrep('lethal', player, weaponSystem);
      return;
    }
    if (e.code === (kb.tactical || 'KeyQ')) {
      if (!e.repeat && !player.isDowned && !player.dead && throwableSystem) throwableSystem.startPrep('tactical', player, weaponSystem);
      return;
    }

    if (e.code === (kb.slotPrimary || 'Digit1')) player.switchSlot('primary');
    else if (e.code === (kb.slotSecondary || 'Digit2')) player.switchSlot('secondary');
    else if (e.code === (kb.slotMelee || 'Digit3')) player.switchSlot('melee');
    else if (e.code === (kb.quickMelee || 'KeyX')) {
      if (!e.repeat) performMeleeStrike(true);
    }
    else if (e.code === (kb.reload || 'KeyR')) player.startReload();
    else if (e.code === (kb.inspect || 'KeyI')) player.startInspect();
    else if (e.code === (kb.medkit || 'KeyH')) {
      if (player.startMedkit()) ui.addFeedMessage('Applying Field Medkit...', '#69f0ae');
    } else if (e.code === (kb.plates || 'KeyG') || e.code === 'Digit4') {
      player.startPlating();
    } else if (e.code === (kb.fieldUpgrade || 'KeyZ')) {
      const fuMsg = player.activateFieldUpgrade ? player.activateFieldUpgrade() : null;
      if (fuMsg) ui.addFeedMessage(fuMsg, '#69f0ae');
    } else if (e.code === (kb.killstreak || 'KeyK')) {
      activateKillstreak();
    } else if (e.code === (kb.map || 'KeyM')) {
      e.preventDefault();
      toggleFullMapMode();
    } else if (e.code === 'Escape' && ui.isTacMapOpen) {
      e.preventDefault();
      toggleFullMapMode(false);
    } else if (e.code === (kb.interact || 'KeyE') && nearbyInteractable) {
      openNearbyInteractable();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (!inRaid || !player) return;
    const kb = window.KEYBINDS || {};
    player.keys[e.code] = false;
    if (e.code === (kb.crouch || 'KeyC') || e.code === 'ControlLeft') {
      player.onCrouchKeyUp();
    } else if ((e.code === (kb.lethal || 'KeyF') || e.code === 'Digit5') && throwableSystem) {
      throwableSystem.releaseThrow('lethal', player, enemyManager, onThrowableHit);
    } else if (e.code === (kb.tactical || 'KeyQ') && throwableSystem) {
      throwableSystem.releaseThrow('tactical', player, enemyManager, onThrowableHit);
    }
  });

  function openNearbyInteractable() {
    if (!nearbyInteractable) return false;
    if (nearbyInteractable.type === 'ground') {
      const gi = nearbyInteractable.groundItem;
      if (!gi) return false;
      const def = GAME_DATA.ITEMS[gi.id];
      if (def && def.type === 'weapon') {
        // Picking up a physical ground weapon opens the Weapon Slot Staging UI!
        isModalOpen = true;
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        const dropPos = gi.position.clone();
        ui.openRaidWeaponStaging(player, { id: gi.id, mods: gi.mods || {}, mag: gi.mag }, {
          sourceLabel: 'GROUND WEAPON',
          onComplete: (res) => {
            const pickedUid = gi.uid;
            world.removeGroundItem(gi);
            if (mpSession && mpSession.active && pickedUid) {
              mpSession.sendEvent({ type: 'ground_pickup', uid: pickedUid });
            }
            if (res.prevId) {
              const swapped = world.spawnGroundItem(res.prevId, 1, dropPos, {
                mods: (res.prevSlotObj && res.prevSlotObj.mods) || null,
                mag: res.prevSlotObj && res.prevSlotObj.mag
              });
              if (mpSession && mpSession.active && swapped) {
                mpSession.sendEvent({
                  type: 'ground_drop',
                  uid: swapped.uid,
                  id: swapped.id,
                  qty: 1,
                  x: Math.round(swapped.position.x * 100) / 100,
                  y: Math.round(swapped.position.y * 100) / 100,
                  z: Math.round(swapped.position.z * 100) / 100,
                  mods: swapped.mods || null,
                  mag: swapped.mag
                });
              }
            }
            nearbyInteractable = null;
            isModalOpen = false;
            if (inRaid) canvas.requestPointerLock();
          },
          onCancel: () => {
            isModalOpen = false;
            if (inRaid) canvas.requestPointerLock();
          }
        });
        return true;
      }
      if (player.addToBackpack(gi.id, gi.qty)) {
        const pickedUid = gi.uid;
        world.removeGroundItem(gi);
        if (mpSession && mpSession.active && pickedUid) {
          mpSession.sendEvent({ type: 'ground_pickup', uid: pickedUid });
        }
        if (window.soundEngine && window.soundEngine.playClick) {
          try { window.soundEngine.playClick(); } catch (e) {}
        }
        nearbyInteractable = null;
        return true;
      } else {
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
  let redZoneTimer = 0;
  let redZoneDmgAccum = 0;
  let activeAirstrikes = [];

  // ==================== TACTICAL PING SYSTEM (WORLD, ENEMY LIVE-TRACK, RADIAL WHEEL & MAP CLICK) ====================
  let activePings = [];
  window.activePings = activePings;
  let pingHoldActive = false;
  let pingHoldStart = 0;
  let pingWheelOpen = false;
  let pingWheelX = 0;
  let pingWheelY = 0;
  let pingWheelChoice = 'cancel';
  let lastPingTapTime = 0;
  let hoveredOwnPing = null;

  const PING_DEFS = {
    location: { label: 'LOCATION', color: '#f5a623', symbol: '◈', duration: 20.0 },
    enemy:    { label: 'HOSTILE',  color: '#ff3d3d', symbol: '⚠', duration: 14.0 },
    attack:   { label: 'ATTACK',   color: '#ff7043', symbol: '⚔', duration: 18.0 },
    loot:     { label: 'LOOT HERE',color: '#69f0ae', symbol: '◆', duration: 20.0 },
    defend:   { label: 'DEFEND',   color: '#42a5f5', symbol: '⛨', duration: 18.0 },
    regroup:  { label: 'REGROUP',  color: '#ce93d8', symbol: '◎', duration: 18.0 }
  };

  function toggleFullMapMode(forceState = null) {
    const nowOpen = ui.toggleTacMap(forceState);
    if (nowOpen) {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    } else if (inRaid && !isModalOpen && !gamepad.active) {
      canvas.requestPointerLock();
    }
    return nowOpen;
  }

  function _raycastPingTarget() {
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(dir);
    const ray = new THREE.Raycaster(origin, dir, 0.5, 280);

    // 1. Check if crosshair is directly on a living enemy -> temporary live enemy marker!
    if (enemyManager) {
      const eHits = ray.intersectObjects(enemyManager.getHitboxMeshes(), false);
      if (eHits.length > 0 && eHits[0].object && eHits[0].object.userData && eHits[0].object.userData.enemy) {
        const enemy = eHits[0].object.userData.enemy;
        if (!enemy.dead && !enemy.extracted) {
          // Verify no solid wall blocks LOS to the enemy
          const wHits = world && world.shootableMeshes ? ray.intersectObjects(world.shootableMeshes, false) : [];
          if (wHits.length === 0 || wHits[0].distance >= eHits[0].distance - 0.5) {
            return { pos: enemy.position.clone().add(new THREE.Vector3(0, 1.95, 0)), enemy };
          }
        }
      }
    }

    // 2. Otherwise hit world geometry / ground
    if (world && world.shootableMeshes) {
      const wHits = ray.intersectObjects(world.shootableMeshes, false);
      if (wHits.length > 0) {
        return { pos: wHits[0].point.clone(), enemy: null };
      }
    }
    if (dir.y < -0.02) {
      const t = Math.min(260, Math.max(4, -origin.y / dir.y));
      return { pos: new THREE.Vector3(origin.x + dir.x * t, 0.05, origin.z + dir.z * t), enemy: null };
    }
    return { pos: origin.clone().addScaledVector(dir, 80), enemy: null };
  }

  function _placePing(type = 'location', worldPos = new THREE.Vector3(), targetEnemy = null, fromMap = false, remoteCaller = null) {
    const cfg = PING_DEFS[type] || PING_DEFS.location;
    // Cap simultaneous pings to 4 (oldest fades out) and avoid duplicate live markers on same enemy
    if (targetEnemy) {
      for (let i = activePings.length - 1; i >= 0; i--) {
        if (activePings[i].targetEnemy === targetEnemy) {
          if (activePings[i].beamMesh && scene) scene.remove(activePings[i].beamMesh);
          activePings.splice(i, 1);
        }
      }
    }
    while (activePings.length >= 4) {
      const old = activePings.shift();
      if (old && old.beamMesh && scene) scene.remove(old.beamMesh);
    }

    let beamMesh = null;
    if (!targetEnemy && scene) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 22, 6),
        new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.42 })
      );
      beam.position.set(worldPos.x, Math.max(0, worldPos.y) + 11, worldPos.z);
      scene.add(beam);
      beamMesh = beam;
    }

    const label = targetEnemy
      ? (targetEnemy.isOperator ? `LIVE: ${targetEnemy.name}` : `LIVE: ${targetEnemy.name || 'HOSTILE'}`)
      : (fromMap && type === 'location' ? 'MAP MARKER' : cfg.label);

    const ping = {
      id: 'pg_' + Math.random().toString(36).slice(2, 8),
      type,
      label,
      color: cfg.color,
      symbol: cfg.symbol,
      position: worldPos.clone(),
      targetEnemy: targetEnemy || null,
      beamMesh,
      owner: remoteCaller || getPlayerCallsign(),
      isOwn: !remoteCaller,
      duration: targetEnemy ? 8.0 : cfg.duration,
      age: 0
    };
    activePings.push(ping);
    window.activePings = activePings;

    if (!remoteCaller && mpSession && mpSession.active) {
      mpSession.sendEvent({
        type: 'ping',
        pingType: type,
        x: Math.round(worldPos.x * 10) / 10,
        y: Math.round(worldPos.y * 10) / 10,
        z: Math.round(worldPos.z * 10) / 10
      });
    }

    if (window.soundEngine && window.soundEngine.playCookTick) {
      window.soundEngine.playCookTick(type === 'enemy');
    }

    const dist = player ? Math.round(player.position.distanceTo(ping.position)) : null;
    ui.addPingFeedEntry({
      caller: remoteCaller || getPlayerCallsign(),
      label: `PINGED ${label}`,
      color: cfg.color,
      symbol: cfg.symbol,
      dist
    });
  }

  function _updatePingWheelSelection() {
    const dist = Math.hypot(pingWheelX, pingWheelY);
    if (dist < 18) {
      pingWheelChoice = 'cancel';
    } else {
      // Angle in degrees where 0 = top (-Y), clockwise
      const deg = ((Math.atan2(pingWheelX, -pingWheelY) * 180 / Math.PI) + 360) % 360;
      if (deg >= 330 || deg < 30) pingWheelChoice = 'enemy';
      else if (deg < 90) pingWheelChoice = 'attack';
      else if (deg < 150) pingWheelChoice = 'loot';
      else if (deg < 210) pingWheelChoice = 'regroup';
      else if (deg < 270) pingWheelChoice = 'defend';
      else pingWheelChoice = 'cancel';
    }
    const centerEl = document.getElementById('ping-wheel-center');
    if (centerEl) centerEl.textContent = pingWheelChoice.toUpperCase();
    document.querySelectorAll('#ping-wheel-overlay .pw-opt').forEach((el) => {
      el.classList.toggle('active', el.dataset.ping === pingWheelChoice);
    });
  }

  // Click / Right-Click directly on Full-Size Tactical Map Canvas to place live markers!
  const tacMapCanvas = document.getElementById('hud-tacmap-canvas');
  if (tacMapCanvas) {
    const handleMapPingClick = (e, isEnemyPing) => {
      if (!inRaid || !world || !ui.isTacMapOpen) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = tacMapCanvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      const halfSize = world.mapHalfSize || 190;
      const viewExtent = halfSize + 48;
      const wx = (nx - 0.5) * viewExtent * 2;
      const wz = (ny - 0.5) * viewExtent * 2;
      _placePing(isEnemyPing ? 'enemy' : 'location', new THREE.Vector3(wx, 0.1, wz), null, true);
    };
    tacMapCanvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) handleMapPingClick(e, false);
      else if (e.button === 2) handleMapPingClick(e, true);
    });
    tacMapCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function updatePings(dt) {
    // Open radial ping wheel if Mouse3 is held >= 220ms
    if (pingHoldActive && !pingWheelOpen && (performance.now() - pingHoldStart) >= 220) {
      pingWheelOpen = true;
      const pwOv = document.getElementById('ping-wheel-overlay');
      if (pwOv) pwOv.classList.remove('hidden');
      _updatePingWheelSelection();
    }

    const container = document.getElementById('hud-ping-markers');
    if (!container || !camera || !player) return;

    for (let i = activePings.length - 1; i >= 0; i--) {
      const pg = activePings[i];
      pg.age += dt;
      if (pg.targetEnemy) {
        if (pg.targetEnemy.dead || pg.targetEnemy.extracted) {
          if (pg.beamMesh && scene) scene.remove(pg.beamMesh);
          activePings.splice(i, 1);
          continue;
        }
        pg.position.set(pg.targetEnemy.position.x, (pg.targetEnemy.isDowned ? 0.95 : 2.15), pg.targetEnemy.position.z);
      }
      if (pg.age >= pg.duration) {
        if (pg.beamMesh && scene) scene.remove(pg.beamMesh);
        activePings.splice(i, 1);
      }
    }

    // Project active pings into crisp 2D HUD markers & detect if crosshair is looking directly at our own ping
    const W = window.innerWidth;
    const H = window.innerHeight;
    const cx = W * 0.5;
    const cy = H * 0.5;
    let bestHover = null;
    let bestHoverDist = 52;
    const projected = [];

    for (const pg of activePings) {
      const worldPt = pg.position.clone();
      if (!pg.targetEnemy) worldPt.y += 1.4;
      const proj = worldPt.project(camera);
      if (proj.z > 1) continue; // behind camera
      const sx = (proj.x * 0.5 + 0.5) * W;
      const sy = (-proj.y * 0.5 + 0.5) * H;
      if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue;
      if (pg.isOwn) {
        const dCenter = Math.hypot(sx - cx, sy - cy);
        if (dCenter < bestHoverDist) {
          bestHoverDist = dCenter;
          bestHover = pg;
        }
      }
      projected.push({ pg, sx, sy });
    }
    hoveredOwnPing = bestHover;

    let html = '';
    for (const { pg, sx, sy } of projected) {
      const dist = Math.round(player.position.distanceTo(pg.position));
      const isLive = !!pg.targetEnemy;
      const showRemoveHint = (pg === hoveredOwnPing);
      html += `
        <div class="world-ping-marker${isLive ? ' live-enemy' : ''}" style="left:${sx.toFixed(1)}px;top:${sy.toFixed(1)}px;">
          ${showRemoveHint ? `<div class="wp-remove-hint">[MMB] REMOVE</div>` : ''}
          <div class="wp-tag" style="color:${pg.color};border:1px solid ${pg.color};">${pg.label} ${dist}m</div>
          <div class="wp-diamond" style="border-color:${pg.color};color:${pg.color};"><span>${pg.symbol}</span></div>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  function updateRedZone(dt) {
    const banner = document.getElementById('redzone-banner');
    const timerEl = document.getElementById('redzone-timer');
    const subEl = document.getElementById('redzone-sub');
    if (!player || !world) return;

    const B = world.mapHalfSize || 190;
    const hardLimit = B + 45;
    player.position.x = THREE.MathUtils.clamp(player.position.x, -hardLimit, hardLimit);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -hardLimit, hardLimit);

    const outDist = Math.max(Math.abs(player.position.x) - B, Math.abs(player.position.z) - B);
    if (outDist > 0 && !player.dead) {
      redZoneTimer += dt;
      const warnLimit = 6.0;
      const rem = Math.max(0, warnLimit - redZoneTimer);
      if (banner) banner.classList.remove('hidden');
      if (rem > 0 && outDist < 26) {
        if (timerEl) timerEl.textContent = `${rem.toFixed(1)}s`;
        if (subEl) subEl.innerHTML = `LETHAL RADIATION &amp; SNIPER FIRE IN <b id="redzone-timer">${rem.toFixed(1)}s</b>`;
      } else {
        if (subEl) subEl.innerHTML = `<b style="color:#ff5252;">TAKING LETHAL RED ZONE DAMAGE — TURN BACK!</b>`;
        redZoneDmgAccum += dt;
        if (redZoneDmgAccum >= 0.45) {
          redZoneDmgAccum = 0;
          ui.triggerDamageFlash();
          const res = player.takeDamage(16, { name: 'RED ZONE', weaponId: 'm24', weaponName: 'Perimeter Sniper' });
          if (res === 'eliminated' && (!squadManager || !squadManager.hasLivingAlly())) {
            endRaid(false);
          }
        }
      }
    } else {
      redZoneTimer = 0;
      redZoneDmgAccum = 0;
      if (banner) banner.classList.add('hidden');
    }
  }
  let ksExplosions = [];
  let uavDroneMesh = null;
  let ksCooldown = 0;

  function _createUavDroneMesh() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3a424a });
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x525d68 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 2.2), bodyMat);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 0.55), wingMat);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.35), wingMat);
    tail.position.set(0, 0.14, 0.95);
    const strobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x69f0ae })
    );
    strobe.position.set(0, -0.18, -0.6);
    g.userData.strobe = strobe;
    g.add(body, wing, tail, strobe);
    return g;
  }

  function _createFighterJetMesh() {
    const g = new THREE.Group();
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x2c333a });
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x45505c });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff9800 });
    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 6.2), darkMat);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.58, 2.2, 6), darkMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -4.2;
    const wings = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.14, 2.1), wingMat);
    wings.position.z = 0.2;
    const vTailL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, 1.3), wingMat);
    vTailL.position.set(-0.7, 0.72, 2.2);
    vTailL.rotation.z = 0.24;
    const vTailR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, 1.3), wingMat);
    vTailR.position.set(0.7, 0.72, 2.2);
    vTailR.rotation.z = -0.24;
    const burnerL = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.12, 1.6, 6), glowMat);
    burnerL.rotation.x = Math.PI / 2;
    burnerL.position.set(-0.34, -0.05, 3.8);
    const burnerR = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.12, 1.6, 6), glowMat);
    burnerR.rotation.x = Math.PI / 2;
    burnerR.position.set(0.34, -0.05, 3.8);
    g.add(fuselage, nose, wings, vTailL, vTailR, burnerL, burnerR);
    return g;
  }

  function _spawnAirstrikeExplosion(pos) {
    if (!scene) return;
    const dist = player ? player.position.distanceTo(pos) : 25;
    if (window.soundEngine && window.soundEngine.playExplosion) {
      window.soundEngine.playExplosion(dist);
    }
    // Subtle camera rumble kick if nearby
    if (player && dist < 38) {
      const shake = (1 - dist / 38) * 0.045;
      player.applyRecoil(shake * (0.6 + Math.random() * 0.6), (Math.random() - 0.5) * shake);
    }

    const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8c1a, transparent: true, opacity: 0.95 });
    const fireMesh = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), fireMat);
    fireMesh.position.set(pos.x, pos.y + 0.9, pos.z);
    scene.add(fireMesh);

    const smokeMat = new THREE.MeshLambertMaterial({ color: 0x262422, transparent: true, opacity: 0.75 });
    const smokeMesh = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), smokeMat);
    smokeMesh.position.set(pos.x, pos.y + 1.6, pos.z);
    scene.add(smokeMesh);

    const light = new THREE.PointLight(0xffaa33, 5.5, 24);
    light.position.set(pos.x, pos.y + 2.8, pos.z);
    scene.add(light);

    ksExplosions.push({ fireMesh, smokeMesh, light, age: 0, maxAge: 1.65 });

    // Heavy AoE damage to enemies & enemy operators
    const blastRadius = 11.5;
    if (enemyManager && enemyManager.enemies) {
      const attackerInfo = {
        name: getPlayerCallsign(),
        isPlayer: true,
        weaponId: 'ks_airstrike',
        weaponName: 'Precision Airstrike'
      };
      for (const e of enemyManager.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.position.x - pos.x, e.position.z - pos.z);
        if (d <= blastRadius) {
          const falloff = 1 - (d / blastRadius) * 0.65;
          const dmg = Math.round(185 * falloff);
          const killed = e.takeDamage(dmg, pos, attackerInfo);
          onThrowableHit(false, killed, e, attackerInfo);
        }
      }
    }

    // Mild self-damage if player stands directly inside their own airstrike zone
    if (player && !player.dead && !player.isDowned) {
      const pd = Math.hypot(player.position.x - pos.x, player.position.z - pos.z);
      if (pd < 8.5) {
        const selfDmg = Math.round(45 * (1 - pd / 8.5));
        if (selfDmg > 4) {
          ui.triggerDamageFlash();
          player.takeDamage(selfDmg, { name: 'AIRSTRIKE', weaponId: 'ks_airstrike', weaponName: 'Precision Airstrike' });
        }
      }
    }
  }

  function _getKillstreakTargetPoint() {
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(dir);

    const ray = new THREE.Raycaster(origin, dir, 1.0, 165);
    if (world && world.meshes && world.meshes.length > 0) {
      const hits = ray.intersectObjects(world.meshes, false);
      if (hits.length > 0) {
        return new THREE.Vector3(hits[0].point.x, 0.05, hits[0].point.z);
      }
    }
    if (dir.y < -0.02) {
      const t = Math.min(155, Math.max(8, -origin.y / dir.y));
      return new THREE.Vector3(origin.x + dir.x * t, 0.05, origin.z + dir.z * t);
    }
    return new THREE.Vector3(origin.x + dir.x * 48, 0.05, origin.z + dir.z * 48);
  }

  function activateKillstreak() {
    if (!inRaid || !player || player.isDowned || player.dead || isModalOpen) return false;
    if (ksCooldown > 0) return false;
    const ksId = player.killstreak;
    if (!ksId) {
      ui.showCenterToast('NO KILLSTREAK EQUIPPED', '#a0a8a3');
      return false;
    }

    if (ksId === 'ks_uav') {
      player.uavTimer = 25.0;
      if (!window.DEV_MODE) player.killstreak = null;
      ksCooldown = 1.5;
      if (!uavDroneMesh && scene) {
        uavDroneMesh = _createUavDroneMesh();
        scene.add(uavDroneMesh);
      }
      if (window.soundEngine) {
        if (window.soundEngine.playCookTick) window.soundEngine.playCookTick(true);
        if (window.soundEngine.playHeal) window.soundEngine.playHeal();
      }
      ui.showCenterToast('UAV RECON ONLINE — 25s', '#69f0ae');
      ui.addFeedMessage('UAV Recon Drone deployed — All hostiles revealed on radar (25s)', '#69f0ae');
      return true;
    }

    if (ksId === 'ks_airstrike') {
      const targetPos = _getKillstreakTargetPoint();
      if (!window.DEV_MODE) player.killstreak = null;
      ksCooldown = 2.0;

      // Strike axis perpendicular to player's view so jets fly dramatically across the sightline
      const strikeDir = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw)).normalize();

      // Red target laser pillar + pulsing ground warning ring
      const beaconGroup = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(10.6, 11.5, 32),
        new THREE.MeshBasicMaterial({ color: 0xff3d3d, side: THREE.DoubleSide, transparent: true, opacity: 0.72 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 38, 8),
        new THREE.MeshBasicMaterial({ color: 0xff3d3d, transparent: true, opacity: 0.55 })
      );
      beam.position.y = 19;
      beaconGroup.add(ring, beam);
      beaconGroup.position.copy(targetPos);
      scene.add(beaconGroup);

      // Schedule 2 staggered jet passes, each dropping 6 ordnance blasts along a 26m corridor
      const jets = [0, 1].map((passIdx) => {
        const mesh = _createFighterJetMesh();
        mesh.visible = false;
        scene.add(mesh);
        const startDelay = 1.9 + passIdx * 1.15;
        const bombs = [];
        for (let b = 0; b < 6; b++) {
          const along = -13 + b * 5.2 + (passIdx === 1 ? 1.8 : 0);
          const sideJitter = (Math.random() - 0.5) * 3.5;
          const perp = new THREE.Vector3(-strikeDir.z, 0, strikeDir.x);
          const bPos = targetPos.clone()
            .addScaledVector(strikeDir, along)
            .addScaledVector(perp, sideJitter);
          bPos.y = 0.05;
          bombs.push({ pos: bPos, triggerTime: startDelay + 0.52 + b * 0.11, detonated: false });
        }
        return { mesh, startDelay, duration: 2.3, bombs, passIdx };
      });

      activeAirstrikes.push({
        targetPos,
        strikeDir,
        beaconGroup,
        jets,
        elapsed: 0,
        maxDuration: 5.8
      });

      if (window.soundEngine && window.soundEngine.playCookTick) {
        window.soundEngine.playCookTick(true);
      }
      ui.showCenterToast('PRECISION AIRSTRIKE INBOUND — 2.0s', '#ff5252');
      ui.addFeedMessage('Precision Airstrike called on target coordinates!', '#ffca28');
      return true;
    }

    return false;
  }

  function updateKillstreaks(dt) {
    if (ksCooldown > 0) ksCooldown = Math.max(0, ksCooldown - dt);

    // 1. Orbiting 3D UAV Recon Drone
    if (uavDroneMesh) {
      if (player && (player.uavTimer || 0) > 0) {
        const ang = performance.now() * 0.00075;
        const rad = 34;
        const cx = player.position.x + Math.cos(ang) * rad;
        const cz = player.position.z + Math.sin(ang) * rad;
        uavDroneMesh.position.set(cx, 44, cz);
        uavDroneMesh.rotation.y = -ang;
        uavDroneMesh.rotation.z = 0.22;
        if (uavDroneMesh.userData.strobe) {
          uavDroneMesh.userData.strobe.visible = Math.floor(performance.now() / 320) % 2 === 0;
        }
      } else {
        scene.remove(uavDroneMesh);
        uavDroneMesh = null;
        ui.addFeedMessage('UAV Recon Drone offline', '#a0a8a3');
      }
    }

    // 2. Active Precision Airstrikes (Beacon + 2 Fighter Jets + Carpet Ordnance)
    for (let i = activeAirstrikes.length - 1; i >= 0; i--) {
      const st = activeAirstrikes[i];
      st.elapsed += dt;

      if (st.beaconGroup) {
        const pulse = 0.45 + 0.35 * Math.sin(st.elapsed * 12);
        st.beaconGroup.children.forEach((ch) => {
          if (ch.material) ch.material.opacity = st.elapsed < 3.8 ? pulse : Math.max(0, 1 - (st.elapsed - 3.8));
        });
        if (st.elapsed >= 4.6) {
          scene.remove(st.beaconGroup);
          st.beaconGroup = null;
        }
      }

      for (const jet of st.jets) {
        if (st.elapsed >= jet.startDelay && st.elapsed <= jet.startDelay + jet.duration) {
          jet.mesh.visible = true;
          const p = (st.elapsed - jet.startDelay) / jet.duration;
          const travel = THREE.MathUtils.lerp(-115, 115, p);
          const alt = 29 + jet.passIdx * 3.5;
          const perp = new THREE.Vector3(-st.strikeDir.z, 0, st.strikeDir.x);
          const jPos = st.targetPos.clone()
            .addScaledVector(st.strikeDir, travel)
            .addScaledVector(perp, jet.passIdx === 0 ? -3.2 : 3.2);
          jPos.y = alt;
          jet.mesh.position.copy(jPos);
          jet.mesh.lookAt(jPos.clone().add(st.strikeDir));
          jet.mesh.rotateY(Math.PI); // cone nose points -Z
        } else {
          jet.mesh.visible = false;
        }

        for (const bomb of jet.bombs) {
          if (!bomb.detonated && st.elapsed >= bomb.triggerTime) {
            bomb.detonated = true;
            _spawnAirstrikeExplosion(bomb.pos);
          }
        }
      }

      if (st.elapsed >= st.maxDuration) {
        if (st.beaconGroup) scene.remove(st.beaconGroup);
        for (const jet of st.jets) scene.remove(jet.mesh);
        activeAirstrikes.splice(i, 1);
      }
    }

    // 3. Expanding Explosion Fireballs & Smoke Clouds
    for (let i = ksExplosions.length - 1; i >= 0; i--) {
      const ex = ksExplosions[i];
      ex.age += dt;
      const t = Math.min(1, ex.age / ex.maxAge);
      const fireScale = 1 + t * 5.8;
      ex.fireMesh.scale.setScalar(fireScale);
      ex.fireMesh.position.y += dt * 2.2;
      ex.fireMesh.material.opacity = Math.max(0, 1 - t * 1.45);

      const smokeScale = 1.2 + t * 6.4;
      ex.smokeMesh.scale.setScalar(smokeScale);
      ex.smokeMesh.position.y += dt * 3.4;
      ex.smokeMesh.material.opacity = Math.max(0, 0.72 * (1 - t));

      ex.light.intensity = Math.max(0, 5.5 * (1 - t * 2.4));

      if (ex.age >= ex.maxAge) {
        scene.remove(ex.fireMesh);
        scene.remove(ex.smokeMesh);
        scene.remove(ex.light);
        ksExplosions.splice(i, 1);
      }
    }
  }

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

  function performMeleeStrike(isQuick = false) {
    if (!player || player.isDowned || player.dead || player.isRevivingAlly || isModalOpen) return;
    const hit = weaponSystem.tryMeleeSlash(player, world, enemyManager, (isHead, killed, enemy, attackerInfo) => {
      window.soundEngine.playHitmarker(isHead);
      ui.triggerHitmarker(isHead);
      handleOperatorHitResult(isHead, killed, enemy, attackerInfo);
    }, isQuick);
    if (hit && gamepad && gamepad.connected) {
      gamepad.rumble(75, 0.45, 0.55);
    }
  }

  function firePlayerWeapon() {
    if (player.isDowned || player.dead || player.isRevivingAlly || player.ledgeState || player.mantleState) return;
    if (player.activeSlot === 'melee') {
      performMeleeStrike(false);
      return;
    }
    const slotObj = player.getActiveWeaponSlot();
    if (!slotObj) return;
    const fired = weaponSystem.tryFire(player, slotObj, world, enemyManager, (isHead, killed, enemy, attackerInfo, dmg) => {
      window.soundEngine.playHitmarker(isHead);
      ui.triggerHitmarker(isHead);
      handleOperatorHitResult(isHead, killed, enemy, attackerInfo);
      if (enemy && enemy.isRemoteReplicated && mpSession && mpSession.active && typeof enemy.netIdx === 'number') {
        mpSession.sendEvent({
          type: 'enemy_hit',
          enemyIdx: enemy.netIdx,
          dmg: dmg || 25,
          isHead: !!isHead,
          weaponId: (attackerInfo && attackerInfo.weaponId) || slotObj.id,
          weaponName: (attackerInfo && attackerInfo.weaponName) || ''
        });
      }
    }, squadManager, (isHead, dmg, ally, attackerInfo) => {
      window.soundEngine.playHitmarker(isHead);
      ui.triggerHitmarker(isHead);
      if (ally && ally.isRemoteHuman && mpSession && mpSession.active && ally.clientId) {
        mpSession.sendEvent({
          type: 'pvp_hit',
          targetClientId: ally.clientId,
          dmg: dmg || 20,
          isHead: !!isHead,
          weaponId: (attackerInfo && attackerInfo.weaponId) || slotObj.id,
          weaponName: (attackerInfo && attackerInfo.weaponName) || '',
          ax: Math.round(player.position.x * 10) / 10,
          ay: Math.round(player.position.y * 10) / 10,
          az: Math.round(player.position.z * 10) / 10
        });
      } else if (ally && !ally.isRemoteHuman && typeof ally.takeDamage === 'function') {
        ally.takeDamage(dmg || 20, attackerInfo);
      }
    });
    if (fired && gamepad && gamepad.connected) {
      gamepad.rumbleFire(slotObj.id);
    }
    if (fired) {
      const wDef = player.getActiveWeaponDef();
      enemyManager.alertNearby(player.position, (wDef && wDef.suppressed) ? 12 : 26);
      if (mpSession && mpSession.active && camera) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const endPt = player.position.clone().addScaledVector(dir, 45);
        mpSession.sendEvent({
          type: 'shot',
          tx: Math.round(endPt.x * 10) / 10,
          ty: Math.round(endPt.y * 10) / 10,
          tz: Math.round(endPt.z * 10) / 10
        });
      }
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

  let _lastRemoteRevivePing = 0;

  function updatePlayerRevive(dt) {
    const kb = window.KEYBINDS || {};
    const interactKey = kb.interact || 'KeyE';
    // Clear expired remote revive lock if teammate let go of Interact
    if (player && player.beingRevivedBy && player.beingRevivedBy !== 'SELF-REVIVE' && player._remoteReviveExpire && performance.now() > player._remoteReviveExpire) {
      player.beingRevivedBy = null;
      player._remoteReviveExpire = 0;
    }
    // Self-Revive Kit: hold [Interact] while downed to channel Self-Revive AND pause the death/bleedout timer!
    if (player && player.isDowned && !player.dead) {
      const canSelfRevive = !player.beingRevivedBy || player.beingRevivedBy === 'SELF-REVIVE';
      if (player.selfRevive && !isModalOpen && !(devConsole && devConsole.isOpen) && player.keys[interactKey] && canSelfRevive) {
        player.beingRevivedBy = 'SELF-REVIVE';
        player.reviveProgress = Math.min(1, (player.reviveProgress || 0) + dt / 4.5);
        if (player.reviveProgress >= 1) {
          player.selfRevive = null;
          player.revive(45);
          if (mpSession && mpSession.active && mpSession.sendStateNow) mpSession.sendStateNow(player);
          ui.showCenterToast('SELF-REVIVE COMPLETE', '#69f0ae');
          ui.addFeedMessage('Used Self-Revive Kit', '#69f0ae');
        }
      } else if (player.beingRevivedBy === 'SELF-REVIVE') {
        player.beingRevivedBy = null;
      }
      ui.updateReviveBanner(player, null, false);
      return;
    }

    const holdingRevive = !!(player && !player.isDowned && !player.dead && !isModalOpen && !(devConsole && devConsole.isOpen) && player.keys[interactKey]);
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

        // Notify remote human teammate of active revive progress (pauses their bleedout + shows banner!)
        const nowMs = performance.now();
        if (candidate.isRemoteHuman && mpSession && mpSession.active && candidate.clientId && (nowMs - _lastRemoteRevivePing > 220)) {
          _lastRemoteRevivePing = nowMs;
          mpSession.sendEvent({
            type: 'revive_progress',
            targetClientId: candidate.clientId,
            progress: Math.round(candidate.reviveProgress * 100) / 100,
            reviverName: getPlayerCallsign()
          });
        }

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
          if (candidate.isRemoteHuman && mpSession && mpSession.active && candidate.clientId) {
            mpSession.sendEvent({
              type: 'revive_complete',
              targetClientId: candidate.clientId,
              hp: 45,
              reviverName: getPlayerCallsign()
            });
          }
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

    if (player.ledgeState) {
      const pct = Math.round((player.ledgeState.pullProgress || 0) * 100);
      textEl.textContent = pct > 2
        ? `PULLING UP (${pct}%)  ·  [S / A / D] LET GO`
        : `HOLD [W] TO PULL UP  ·  [S / A / D] LET GO`;
      promptEl.classList.remove('hidden');
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
              ui.toggleTacMap(false);
              isModalOpen = true;
              if (document.pointerLockElement === canvas) document.exitPointerLock();
              ui.openLootModal(player, 'BACKPACK', null);
            }
          },
          toggleTacMap: () => {
            if (!isModalOpen) toggleFullMapMode();
          },
          closeModal: () => closeLootAndResume(),
          takeAll: () => document.getElementById('btn-take-all')?.click(),
          fire: () => firePlayerWeapon(),
          onThrowableHit,
          interact: () => openNearbyInteractable(),
          activateFieldUpgrade: () => {
            const fuMsg = player.activateFieldUpgrade ? player.activateFieldUpgrade() : null;
            if (fuMsg) ui.addFeedMessage(fuMsg, '#69f0ae');
          },
          activateKillstreak: () => activateKillstreak(),
          quickMelee: () => performMeleeStrike(true)
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
        if (mpSession && mpSession.active) {
          mpSession.update(dt, player);
          if (squadManager) squadManager.syncRemotePlayers(mpSession);
          if (isMatchHost && enemyManager) {
            mpSession.sendEnemiesSync(dt, enemyManager, true);
          }
        }
        weaponSystem.update(dt, player, wDef);
        if (throwableSystem) {
          throwableSystem.update(dt, player, weaponSystem, enemyManager, onThrowableHit, null);
        }
        world.update(dt, now / 1000);

        enemyManager.update(dt, player, (enemy, hit, dmg, muzzleWorld) => {
          if (muzzleWorld) {
            weaponSystem.spawnEnemyShot(muzzleWorld, player.position, hit, world);
            if (mpSession && mpSession.active && isMatchHost && enemy && typeof enemy.netIdx === 'number') {
              mpSession.sendEvent({
                type: 'enemy_shot',
                enemyIdx: enemy.netIdx,
                tx: Math.round(player.position.x * 10) / 10,
                ty: Math.round(player.position.y * 10) / 10,
                tz: Math.round(player.position.z * 10) / 10
              });
            }
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
          } else if (db && bledEnemy && bledEnemy.isOperator) {
            raidKills += 1;
            ui.addKillFeedEntry({
              killerName: db.name,
              killerIsEnemy: !!db.isOperator && !db.isPlayer,
              weaponId: db.weaponId || '',
              weaponName: db.weaponName || '',
              victimName: bledEnemy.name,
              victimIsEnemy: true,
              action: 'eliminated'
            });
          }
        }, raidTimeLeft, (evtType, shooter, victim, muzzleWorld, aimPos, info) => {
          if (evtType === 'shot' && muzzleWorld && aimPos) {
            weaponSystem._spawnTracer(muzzleWorld, aimPos, 0xffaa55);
          } else if ((evtType === 'downed' || evtType === 'eliminated') && victim && victim.isOperator) {
            ui.addKillFeedEntry({
              killerName: shooter ? shooter.name : 'HOSTILE',
              killerIsEnemy: true,
              weaponId: (info && info.weaponId) || (shooter && shooter.weaponId) || 'ak74m',
              weaponName: (info && info.weaponName) || 'AK-74M',
              victimName: victim.name,
              victimIsEnemy: true,
              action: evtType
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
        updateKillstreaks(dt);
        updateRedZone(dt);
        updatePings(dt);
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
