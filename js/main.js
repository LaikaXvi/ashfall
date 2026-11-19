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
  let extractProgress = 0;
  const EXTRACT_REQUIRED = 5.0;

  let nearbyInteractable = null; // { type: 'crate'|'corpse', label, items }
  let lastFrameTime = performance.now();

  const ui = new GameUI((zoneId) => startRaid(zoneId));
  const gunsmith = new GunsmithController(ui);
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
    enemyManager = new EnemyManager(scene, world, zone);
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
    extractProgress = 0;
    inRaid = true;
    isModalOpen = false;

    document.getElementById('hud-feed').innerHTML = '';
    ui.clearCombatHUD();
    document.getElementById('extract-banner').classList.add('hidden');
    document.getElementById('pointer-lock-overlay').classList.add('hidden');
    document.getElementById('loot-modal').classList.add('hidden');

    ui.showScreen('hud');
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
      // Keep equipped loadout & remaining ammo/meds/plates
      ui.profile.loadout.medkits = player.medkits;
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
        medkits: 0,
        ammo: {}
      };
    }

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
      if (!player.addToBackpack(item.id, item.qty)) {
        remaining.push(item);
      }
    }
    ui.activeLootSource.items.length = 0;
    ui.activeLootSource.items.push(...remaining);
    if (remaining.length > 0) {
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
    } else if (e.code === 'KeyE' && nearbyInteractable) {
      isModalOpen = true;
      document.exitPointerLock();
      ui.openLootModal(player, nearbyInteractable.label, nearbyInteractable.items);
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

  function onThrowableHit(isHead, killed, enemy, meta = {}) {
    window.soundEngine.playHitmarker(isHead, killed);
    ui.triggerHitmarker(isHead, killed);
    if (killed) {
      raidKills += 1;
      ui.addKillFeedEntry(enemy.name, meta.weaponName || 'LETHAL', isHead);
      ui.triggerKillFeedback(enemy, isHead, meta);
    }
  }

  function firePlayerWeapon() {
    const slotObj = player.getActiveWeaponSlot();
    if (!slotObj) return;
    const fired = weaponSystem.tryFire(player, slotObj, world, enemyManager, (isHead, killed, enemy, meta = {}) => {
      window.soundEngine.playHitmarker(isHead, killed);
      ui.triggerHitmarker(isHead, killed);
      if (killed) {
        raidKills += 1;
        ui.addKillFeedEntry(enemy.name, meta.weaponName || '', isHead);
        ui.triggerKillFeedback(enemy, isHead, meta);
      }
    });
    if (fired && gamepad && gamepad.connected) {
      gamepad.rumbleFire(slotObj.id);
    }
    if (fired) {
      const wDef = player.getActiveWeaponDef();
      enemyManager.alertNearby(player.position, (wDef && wDef.suppressed) ? 12 : 26);
    }
  }

  function checkInteractions() {
    nearbyInteractable = null;
    const promptEl = document.getElementById('interact-prompt');
    const textEl = document.getElementById('interact-text');

    let bestDist = 3.2;
    for (const c of world.lootContainers) {
      const d = player.position.distanceTo(c.position);
      if (d < bestDist) {
        bestDist = d;
        nearbyInteractable = { type: 'crate', label: c.name, items: c.items };
      }
    }

    for (const e of enemyManager.enemies) {
      if (!e.dead) continue;
      const d = Math.hypot(player.position.x - e.position.x, player.position.z - e.position.z);
      if (d < bestDist) {
        bestDist = d;
        nearbyInteractable = { type: 'corpse', label: `${e.name} Corpse`, items: e.lootItems };
      }
    }

    if (nearbyInteractable) {
      textEl.textContent = `Search ${nearbyInteractable.label}`;
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
          interact: () => {
            if (!nearbyInteractable) return false;
            isModalOpen = true;
            if (document.pointerLockElement === canvas) document.exitPointerLock();
            ui.openLootModal(player, nearbyInteractable.label, nearbyInteractable.items);
            return true;
          }
        }
      });

      if (isPaused || isModalOpen) {
        gamepad.updateMenu(dt, {
          ui,
          gunsmith,
          onResume: () => {
            if (isModalOpen) closeLootAndResume();
            else {
              padPaused = false;
              document.getElementById('pointer-lock-overlay').classList.add('hidden');
              gamepad.clearMenuFocus();
            }
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
          if (hit) {
            ui.triggerDamageFlash();
            ui.triggerDirectionalDamage(player, enemy.position);
            const died = player.takeDamage(dmg);
            if (died) {
              endRaid(false);
            }
          }
        });

        if (squadManager) {
          squadManager.update(
            dt,
            player,
            enemyManager,
            weaponSystem,
            raidTimeLeft,
            (msg, color) => ui.addFeedMessage(msg, color),
            (allyName, enemyName) => {
              // AI squadmate kills are intentionally omitted from the player kill feed
            }
          );
        }

        checkInteractions();
        checkExtraction(dt);
        ui.updateHUD(player, world, raidTimeLeft, weaponSystem, throwableSystem);
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
      // Enable full controller navigation in Main Menu, Stash, Operator, Settings, Gunsmith & Summary screens!
      gamepad.updateMenu(dt, { ui, gunsmith });
    }
  }

  requestAnimationFrame(animate);
})();
