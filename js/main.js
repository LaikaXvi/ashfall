// Main Game Loop, Three.js Scene Setup & Raid Lifecycle
(function () {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  if (THREE.ACESFilmicToneMapping !== undefined) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
  }

  // PS2 Low-Res Post Pipeline (Bayer 4x4 ordered dither + color quantization + gritty grade)
  window.renderPipeline = (() => {
    const getScale = () => {
      const p = (window.GFX_SETTINGS && typeof window.GFX_SETTINGS.pixel === 'number') ? window.GFX_SETTINGS.pixel : 2;
      return Math.max(1, Math.min(3, Math.round(p)));
    };
    let curScale = getScale();
    let rtW = Math.max(1, Math.ceil(window.innerWidth / curScale));
    let rtH = Math.max(1, Math.ceil(window.innerHeight / curScale));
    const rt = new THREE.WebGLRenderTarget(rtW, rtH, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false
    });
    rt.texture.generateMipmaps = false;

    const postScene = new THREE.Scene();
    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const postMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: rt.texture },
        uRes: { value: new THREE.Vector2(rtW, rtH) },
        uScale: { value: curScale },
        uLevels: { value: 32.0 },
        uDither: { value: 1.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uRes;
        uniform float uScale;
        uniform float uLevels;
        uniform float uDither;
        varying vec2 vUv;
        float b2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
        float b4(vec2 a) { return b2(0.5 * a) * 0.25 + b2(a); }
        void main() {
          vec3 c = texture2D(tDiffuse, vUv).rgb * 1.08;
          float d = b4(gl_FragCoord.xy / max(1.0, uScale)) - 0.5;
          c = floor(clamp(c, 0.0, 1.0) * uLevels + d * uDither) / uLevels;
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(c, vec3(lum), 0.18);
          c *= vec3(1.02, 1.0, 0.94);
          c = clamp((c - 0.5) * 1.08 + 0.5, 0.0, 1.0);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
    postScene.add(quad);

    const resize = () => {
      curScale = getScale();
      const s = curScale > 1 ? curScale : 1;
      rtW = Math.max(1, Math.ceil(window.innerWidth / s));
      rtH = Math.max(1, Math.ceil(window.innerHeight / s));
      if (rt.width !== rtW || rt.height !== rtH) {
        rt.setSize(rtW, rtH);
      }
      postMat.uniforms.uRes.value.set(rtW, rtH);
      postMat.uniforms.uScale.value = curScale;
    };

    return {
      get scale() { return curScale; },
      resize,
      begin() {
        curScale = getScale();
        postMat.uniforms.uScale.value = curScale;
        renderer.setRenderTarget(curScale > 1 ? rt : null);
        renderer.autoClear = false;
        renderer.clear();
      },
      render(sc, cam, clearDepthFirst = false) {
        if (!sc || !cam) return;
        if (clearDepthFirst) renderer.clearDepth();
        renderer.render(sc, cam);
      },
      end() {
        if (curScale > 1) {
          renderer.setRenderTarget(null);
          renderer.clear();
          renderer.render(postScene, postCam);
        }
      }
    };
  })();

  let scene = null;
  let camera = null;
  let sunLight = null;
  let hemiLight = null;
  let rimFillLight = null;

  window.applyGraphicsSettings = (gfx = window.GFX_SETTINGS || {}) => {
    const lod = gfx.lod ?? 3;
    const lighting = gfx.lighting ?? 3;
    const shadows = gfx.shadows ?? 3;

    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (window.renderPipeline && window.renderPipeline.resize) {
      window.renderPipeline.resize();
    }

    // 2. Realtime Shadows (default 1024, throttled update every 3rd frame)
    renderer.shadowMap.enabled = shadows > 0;
    if (sunLight) {
      sunLight.castShadow = shadows > 0;
      const res = shadows === 1 ? 512 : (shadows === 2 ? 768 : 1024);
      if (sunLight.shadow && sunLight.shadow.mapSize && sunLight.shadow.mapSize.width !== res) {
        sunLight.shadow.mapSize.width = res;
        sunLight.shadow.mapSize.height = res;
        if (sunLight.shadow.map) {
          sunLight.shadow.map.dispose();
          sunLight.shadow.map = null;
        }
      }
      renderer.shadowMap.needsUpdate = true;
    }

    // 3. Lighting Quality
    if (renderer.toneMappingExposure !== undefined) {
      renderer.toneMappingExposure = lighting === 1 ? 0.96 : (lighting === 2 ? 1.02 : (lighting === 3 ? 1.08 : 1.14));
    }
    if (hemiLight) hemiLight.intensity = lighting === 1 ? 0.72 : (lighting === 2 ? 0.84 : (lighting === 3 ? 0.92 : 1.0));
    if (rimFillLight) rimFillLight.intensity = lighting === 1 ? 0.0 : (lighting === 2 ? 0.25 : (lighting === 3 ? 0.42 : 0.58));

    // 4. LOD / View Distance
    if (camera) {
      camera.far = lod === 1 ? 580 : (lod === 2 ? 980 : (lod === 3 ? 1420 : 1750));
      camera.updateProjectionMatrix();
    }
    if (scene && scene.fog) {
      scene.fog.density = lod === 1 ? 0.0038 : (lod === 2 ? 0.0028 : (lod === 3 ? 0.0021 : 0.0016));
    }
    if (world && world.setGraphicsOptions) {
      world.setGraphicsOptions(gfx);
    }
  };
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
  let raidStartTimestamp = 0;
  let raidEndTimestamp = 0;
  let raidElapsed = 0;
  let raidKills = 0;
  let raidXp = 0;
  let extractProgress = 0;
  const EXTRACT_REQUIRED = 5.0;

  let nearbyInteractable = null; // { type: 'crate'|'corpse'|'ground', label, items, container }
  let tabStowHoldStart = 0;
  let tabStowTriggered = false;
  let lastFrameTime = performance.now();

  const ui = new GameUI((zoneId, matchId) => startRaid(zoneId, matchId));
  const gunsmith = new GunsmithController(ui);
  const matchmaking = new MatchmakingStage(ui, (zoneId, matchId) => startRaid(zoneId, matchId));
  ui.matchmakingStage = matchmaking;
  const hideoutBunker = (typeof HideoutBunker !== 'undefined') ? new HideoutBunker() : null;
  window.hideoutBunker = hideoutBunker;
  let hideoutHadPointerLock = false;
  let _lastFobPosBroadcast = 0;

  function dismissFobOverlay(enterRoam = true) {
    const ov = document.getElementById('fob-enter-overlay');
    if (ov) ov.classList.add('hidden');
    if (window.soundEngine) {
      try {
        window.soundEngine.init();
        if (window.soundEngine.playUiConfirm) window.soundEngine.playUiConfirm();
      } catch (e) {}
    }
    if (enterRoam) {
      enterHideoutRoam();
    } else {
      exitHideoutRoam(true);
    }
  }

  function openFobStation(station) {
    if (!station) return;
    let targetTab = station.tab;
    if (targetTab === 'map' && ui && ui.isPartyLeader && !ui.isPartyLeader()) {
      if (ui._showSocialToast) ui._showSocialToast('Only Party Leader can choose operation zone — Ready up at Armory!');
      if (window.soundEngine && window.soundEngine.playUiError) {
        try { window.soundEngine.playUiError(); } catch (err) {}
      }
      targetTab = 'deploy';
    }
    exitHideoutRoam(targetTab === 'home');
    if (window.soundEngine && window.soundEngine.playClick) {
      try { window.soundEngine.playClick(); } catch (err) {}
    }
    if (targetTab !== 'home') {
      ui.openMenuTab(targetTab);
    } else if (ui) {
      ui.openMenuTab('home');
    }
  }

  // Boot directly into DMZ-style FOB Entry Overlay over live 3D Hangar & Helipad
  window.addEventListener('keydown', () => { window._lastInputMode = 'kbm'; });
  window.addEventListener('mousedown', () => { window._lastInputMode = 'kbm'; });
  const _fobOvInit = document.getElementById('fob-enter-overlay');
  if (_fobOvInit && hideoutBunker) {
    const hs = document.getElementById('hideout-screen');
    if (hs) hs.classList.add('hideout-roam-mode');
    const btnEnterFob = document.getElementById('btn-enter-fob');
    const btnFobMenu = document.getElementById('btn-fob-menu');
    if (btnEnterFob) btnEnterFob.addEventListener('click', () => dismissFobOverlay(true));
    if (btnFobMenu) btnFobMenu.addEventListener('click', () => dismissFobOverlay(false));
    if (window.RigAssets && typeof window.RigAssets.load === 'function') {
      if (btnEnterFob) {
        btnEnterFob.disabled = true;
        btnEnterFob.textContent = 'LOADING OPERATOR ASSETS…';
      }
      if (btnFobMenu) btnFobMenu.disabled = true;
      window.RigAssets.load().then(() => {
        if (btnEnterFob) {
          btnEnterFob.disabled = false;
          btnEnterFob.textContent = 'ENTER FOB [CLICK / SPACE]';
        }
        if (btnFobMenu) {
          btnFobMenu.disabled = false;
          btnFobMenu.textContent = 'OPEN TAC-MENU [M]';
        }
        if (hideoutBunker && hideoutBunker.rebuildAvatars) {
          hideoutBunker.rebuildAvatars();
        }
        if (window.itemIcons && window.itemIcons.loadItemModels) {
          window.itemIcons.loadItemModels();
        }
      });
    }
  }

  function enterHideoutRoam() {
    if (!hideoutBunker || inRaid || (gunsmith && gunsmith.isOpen)) return;
    if (ui && ui.activeMenuTab !== 'home') ui.openMenuTab('home');
    hideoutHadPointerLock = false;
    const hideoutScreen = document.getElementById('hideout-screen');
    const roamHud = document.getElementById('hideout-roam-hud');
    if (hideoutScreen) hideoutScreen.classList.add('hideout-roam-mode');
    if (roamHud) roamHud.classList.remove('hidden');
    hideoutBunker.enterRoam(canvas);
    if (window.soundEngine && window.soundEngine.startFobAmbience) {
      try { window.soundEngine.startFobAmbience(); } catch (e) {}
    }
  }
  window.enterHideoutRoam = enterHideoutRoam;
  window.onCloseHideoutOverlayTo3D = () => {
    if (!inRaid && hideoutBunker && !hideoutBunker.activeRoam && !(gunsmith && gunsmith.isOpen)) {
      if (ui && ui.activeMenuTab !== 'home') ui.openMenuTab('home');
      enterHideoutRoam();
      return true;
    }
    return false;
  };

  function exitHideoutRoam(openMenu = true) {
    if (!hideoutBunker) return;
    hideoutHadPointerLock = false;
    hideoutBunker.exitRoam();
    if (window.soundEngine && window.soundEngine.stopFobAmbience) {
      try { window.soundEngine.stopFobAmbience(); } catch (e) {}
    }
    const hideoutScreen = document.getElementById('hideout-screen');
    const roamHud = document.getElementById('hideout-roam-hud');
    if (hideoutScreen) hideoutScreen.classList.remove('hideout-roam-mode');
    if (roamHud) roamHud.classList.add('hidden');
    if (openMenu && !inRaid && ui && ui.activeMenuTab === 'home') {
      requestAnimationFrame(() => ui.ensureInitialSelection());
    }
  }

  const walkBtn = document.getElementById('btn-walk-hideout');
  if (walkBtn) walkBtn.addEventListener('click', () => enterHideoutRoam());
  const exitRoamBtn = document.getElementById('btn-exit-hideout-roam');
  if (exitRoamBtn) exitRoamBtn.addEventListener('click', () => exitHideoutRoam(true));

  window.addEventListener('resize', () => {
    if (hideoutBunker) hideoutBunker.onResize();
  });

  document.addEventListener('pointerlockchange', () => {
    if (!inRaid && hideoutBunker && hideoutBunker.activeRoam) {
      if (document.pointerLockElement === canvas) {
        hideoutHadPointerLock = true;
      } else if (hideoutHadPointerLock) {
        exitHideoutRoam(true);
      }
    }
  });
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
    devExfil: (opts) => devExfil(opts),
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
  window.gamepadController = gamepad;
  window.isInRaid = () => inRaid;
  window.devExfilRaid = (opts) => devExfil(opts);
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
    if (window.renderPipeline && window.renderPipeline.resize) {
      window.renderPipeline.resize();
    }
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
    scene.background = new THREE.Color(zone.skyColor || 0x8ea0ab);
    // Volumetric-style distance-based atmospheric fog tuned for 1240m expanded sector
    scene.fog = new THREE.FogExp2(zone.fogColor || 0xa7b0a8, 0.0021);

    camera = new THREE.PerspectiveCamera(window.BASE_FOV || 75, window.innerWidth / window.innerHeight, 0.05, 1650);
    scene.add(camera);

    // Redux Atmospheric Lighting (Sky/Ground bounce + Golden-Hour Sun + Cool Rim Fill)
    hemiLight = new THREE.HemisphereLight(0xcbe0f5, 0x453e32, 0.92);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(0xffe4b8, 1.35);
    sunLight.position.set(160, 210, 120);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.camera.near = 15;
    sunLight.shadow.camera.far = 360;
    const d = 85;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);
    scene.add(sunLight.target);

    rimFillLight = new THREE.DirectionalLight(0x88b4d8, 0.42);
    rimFillLight.position.set(-140, 85, -130);
    scene.add(rimFillLight);

    // Dedicated Viewmodel Layer (separate scene & depth pass so gun/hands NEVER clip through walls!)
    viewmodelScene = new THREE.Scene();
    viewmodelCamera = new THREE.PerspectiveCamera(window.BASE_FOV || 75, window.innerWidth / window.innerHeight, 0.01, 20);
    viewmodelScene.add(viewmodelCamera);
    viewmodelScene.add(new THREE.HemisphereLight(0xd8cbb8, 0x3b352c, 0.85));
    const vmSun = new THREE.DirectionalLight(0xffe6c2, 0.95);
    vmSun.position.set(45, 70, 30);
    viewmodelScene.add(vmSun);

    world = new WastelandWorld(scene, zone);
    if (window.applyGraphicsSettings) window.applyGraphicsSettings(window.GFX_SETTINGS);
    weaponSystem = new WeaponSystem(scene, camera, viewmodelCamera);
    if (weaponSystem.ensureFPArms) weaponSystem.ensureFPArms();
    throwableSystem = new ThrowableSystem(scene, camera, viewmodelCamera, world, weaponSystem);
    player = new Player(camera, world, weaponSystem, {
      ...ui.profile.loadout,
      weaponMods: ui.profile.weaponMods || {}
    });
    // Pack any pre-match backpack items into the operator's raid backpack
    if (Array.isArray(ui.profile.loadout.backpackItems) && ui.profile.loadout.backpackItems.length > 0) {
      for (const it of ui.profile.loadout.backpackItems) {
        player.addToBackpack(it.id, it.qty, { mods: it.mods || null, rarityOverride: it.rarityOverride || null });
      }
      ui.profile.loadout.backpackItems = [];
    }
    // Start real-time co-op multiplayer sync when deploying with party members into the SAME match!
    const activeMatchId = matchId || (ui.partyId + '_' + zoneId);
    const hasRemoteParty = (ui.partyMembers || []).some(m => !m.isSelf && m.isRemoteHuman);
    isMatchHost = !hasRemoteParty || (typeof ui.isPartyLeader === 'function' ? ui.isPartyLeader() : true);
    enemyManager = new EnemyManager(scene, world, zone, weaponSystem, hasRemoteParty && !isMatchHost);
    squadManager = new SquadManager(scene, world, ui.partyMembers || [], weaponSystem);

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

    const applyContainerItems = (cid, remoteItems, remoteEq = null) => {
      if (!cid || !Array.isArray(remoteItems)) return;
      if (cid.startsWith('corpse_')) {
        const eIdx = parseInt(cid.slice(7), 10);
        const e = (enemyManager && enemyManager.enemies && Number.isFinite(eIdx)) ? enemyManager.enemies[eIdx] : null;
        if (!e) return;
        if (!Array.isArray(e.lootItems)) e.lootItems = [];
        e.lootItems.length = 0;
        for (const it of remoteItems) {
          if (it && it.id) {
            e.lootItems.push({
              id: it.id,
              qty: it.qty || 1,
              mods: it.mods || null,
              mag: it.mag,
              rarityOverride: it.rarityOverride || null,
              revealed: it.revealed !== false
            });
          }
        }
        if (remoteEq && typeof remoteEq === 'object') {
          if (!e.operatorEquipment) e.operatorEquipment = {};
          const prevRev = e.operatorEquipment.revealedSlots || {};
          Object.assign(e.operatorEquipment, remoteEq);
          e.operatorEquipment.revealedSlots = { ...prevRev, ...(remoteEq.revealedSlots || {}) };
        }
        if (ui && ui.activeLootSource && ui.activeLootSource.containerId === cid && player) {
          ui.renderLootModal(player);
        }
        return;
      }
      if (!world || !Array.isArray(world.lootContainers)) return;
      const c = world.lootContainers.find(ct => ct.id === cid);
      if (!c || !Array.isArray(c.items)) return;
      if (world.openContainer) world.openContainer(c);
      c.opened = true;
      c.items.length = 0;
      for (const it of remoteItems) {
        if (it && it.id) {
          c.items.push({
            id: it.id,
            qty: it.qty || 1,
            mods: it.mods || null,
            mag: it.mag,
            rarityOverride: it.rarityOverride || null,
            revealed: it.revealed !== false
          });
        }
      }
      if (ui && ui.activeLootSource && ui.activeLootSource.containerId === cid && player) {
        ui.renderLootModal(player);
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
              if (window.soundEngine && window.soundEngine.playGunshot && player) {
                const shotDist = player.position.distanceTo(ally.position);
                if (shotDist < 340) {
                  const dx = ally.position.x - player.position.x;
                  const dz = ally.position.z - player.position.z;
                  const len = Math.hypot(dx, dz) || 1;
                  const pan = (dx / len) * Math.cos(player.yaw) - (dz / len) * Math.sin(player.yaw);
                  window.soundEngine.playGunshot(pkt.weaponId || ally.weaponId || 'ak74m', shotDist, !!pkt.suppressed, { pan });
                }
              }
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
            if (!isMatchHost && typeof pkt.rt === 'number') {
              const localRem = Math.max(0, (raidEndTimestamp - Date.now()) / 1000);
              if (Math.abs(localRem - pkt.rt) > 0.35) {
                raidEndTimestamp = Date.now() + pkt.rt * 1000;
                raidTimeLeft = pkt.rt;
              }
            }
          } else if (pkt.type === 'raid_timer') {
            if (!isMatchHost && typeof pkt.rt === 'number') {
              raidEndTimestamp = Date.now() + pkt.rt * 1000;
              raidTimeLeft = pkt.rt;
            }
          } else if (pkt.type === 'field_upgrade') {
            if (pkt.evId) {
              if (!window._seenMpEvents) window._seenMpEvents = new Set();
              if (window._seenMpEvents.has(pkt.evId)) return;
              window._seenMpEvents.add(pkt.evId);
              if (window._seenMpEvents.size > 160) window._seenMpEvents.clear();
            }
            if (pkt.upgradeId === 'fu_ammo_box' && world && world.deployMunitionBox) {
              const origin = new THREE.Vector3(pkt.x || 0, pkt.y || 0, pkt.z || 0);
              const fwd = new THREE.Vector3(pkt.dx || 0, 0, pkt.dz || -1);
              world.deployMunitionBox(origin, fwd, pkt.fromName || 'SQUAD');
              if (window.soundEngine && window.soundEngine.playMagIn) window.soundEngine.playMagIn();
              ui.addFeedMessage(`${pkt.fromName || 'SQUAD'} deployed a Munition Box — press [E] to resupply!`, '#69f0ae');
            } else if (pkt.upgradeId === 'fu_dead_silence') {
              ui.addFeedMessage(`${pkt.fromName || 'SQUAD'} activated Dead Silence`, '#69f0ae');
            } else if (pkt.upgradeId) {
              const fuDef = GAME_DATA.ITEMS[pkt.upgradeId];
              ui.addFeedMessage(`${pkt.fromName || 'SQUAD'} deployed ${(fuDef && fuDef.name) || 'Field Upgrade'}`, '#69f0ae');
            }
          } else if (pkt.type === 'killstreak') {
            if (pkt.evId) {
              if (!window._seenMpEvents) window._seenMpEvents = new Set();
              if (window._seenMpEvents.has(pkt.evId)) return;
              window._seenMpEvents.add(pkt.evId);
              if (window._seenMpEvents.size > 160) window._seenMpEvents.clear();
            }
            if (pkt.kind === 'airstrike') {
              const tPos = new THREE.Vector3(pkt.tx || 0, pkt.ty || 0, pkt.tz || 0);
              const sDir = new THREE.Vector3(pkt.dx || 1, 0, pkt.dz || 0);
              if (sDir.lengthSq() < 0.001) sDir.set(1, 0, 0);
              else sDir.normalize();
              _deployPrecisionAirstrike(tPos, {
                isRemote: true,
                callerName: pkt.fromName || 'SQUAD',
                strikeDirOverride: sDir,
                applyDamage: isMatchHost
              });
            } else if (pkt.kind === 'uav' && player) {
              const dur = pkt.duration || 30.0;
              player.uavTimer = Math.max(player.uavTimer || 0, dur);
              if (window.soundEngine && window.soundEngine.playUavPhoneTap) {
                window.soundEngine.playUavPhoneTap();
              }
              ui.showCenterToast(`${pkt.fromName || 'SQUAD'} ACTIVATED SQUAD UAV — ${Math.round(dur)}s`, '#69f0ae');
              ui.addFeedMessage(`${pkt.fromName || 'SQUAD'} activated UAV Recon — 150m pulsing radar active!`, '#69f0ae');
            }
          } else if (pkt.type === 'enemy_shot') {
            if (!isMatchHost && enemyManager && enemyManager.enemies && typeof pkt.enemyIdx === 'number') {
              const e = enemyManager.enemies[pkt.enemyIdx];
              if (e && !e.dead) {
                if (e.triggerRemoteMuzzleFlash) e.triggerRemoteMuzzleFlash();
                if (window.soundEngine && window.soundEngine.playGunshot && player) {
                  const eDist = player.position.distanceTo(e.position);
                  if (eDist < 300) {
                    const dx = e.position.x - player.position.x;
                    const dz = e.position.z - player.position.z;
                    const len = Math.hypot(dx, dz) || 1;
                    const pan = (dx / len) * Math.cos(player.yaw) - (dz / len) * Math.sin(player.yaw);
                    window.soundEngine.playGunshot(e.weaponId || 'ak74m', eDist, false, { pan });
                  }
                }
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
                { uid: pkt.uid, mods: pkt.mods || null, mag: pkt.mag, rarityOverride: pkt.rarityOverride || null }
              );
            }
          } else if (pkt.type === 'ground_pickup' && world && pkt.uid) {
            world.removeGroundItemByUid(pkt.uid);
          } else if (pkt.type === 'container_open' && world && world.openContainer && pkt.id) {
            world.openContainer(pkt.id);
            if (Array.isArray(pkt.items)) {
              applyContainerItems(pkt.id, pkt.items);
            }
          } else if (pkt.type === 'container_sync' && pkt.cid && Array.isArray(pkt.items)) {
            applyContainerItems(pkt.cid, pkt.items, pkt.eq || null);
          } else if (pkt.type === 'corpse_sync' && pkt.cid && Array.isArray(pkt.items)) {
            applyContainerItems(pkt.cid, pkt.items, pkt.eq || null);
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
              player.beingDragged = !!player.isDowned;
              if (typeof pkt.progress === 'number') player.reviveProgress = pkt.progress;
              if (player.isDowned && typeof pkt.dx === 'number' && typeof pkt.dz === 'number') {
                const gyDrag = (world && world.getTerrainHeight) ? world.getTerrainHeight(pkt.dx, pkt.dz) : 0;
                player.position.x = pkt.dx;
                player.position.z = pkt.dz;
                player.position.y = gyDrag + player.currentEyeHeight;
                if (typeof pkt.dyaw === 'number') {
                  player.yaw = pkt.dyaw;
                }
              }
              player._remoteReviveExpire = performance.now() + 800;
            }
          } else if (pkt.type === 'revive_complete') {
            if (pkt.targetClientId === ui._clientId && player && (player.isDowned || player.dead)) {
              player.beingDragged = false;
              player.revive(pkt.hp || 45);
              if (window.soundEngine && window.soundEngine.playReviveComplete) {
                try { window.soundEngine.playReviveComplete(); } catch (e) {}
              }
              if (mpSession && mpSession.active && mpSession.sendStateNow) {
                mpSession.sendStateNow(player);
              }
              ui.showCenterToast(`REVIVED BY ${pkt.reviverName || 'SQUAD'}`, '#69f0ae');
              ui.addFeedMessage(`Revived by ${pkt.reviverName || 'SQUAD'}`, '#69f0ae');
            }
          } else if (pkt.type === 'pvp_hit') {
            if (pkt.targetClientId === ui._clientId && (window.SQUAD_PVP || pkt.forcePvp) && player && !player.dead) {
              // Deduplicate hits in case both WebRTC and MQTT deliver the same hitId
              if (pkt.hitId) {
                if (!window._seenPvpHits) window._seenPvpHits = new Set();
                if (window._seenPvpHits.has(pkt.hitId)) return;
                window._seenPvpHits.add(pkt.hitId);
                if (window._seenPvpHits.size > 120) window._seenPvpHits.clear();
              }
              if (pkt.forcePvp && !window.SQUAD_PVP) {
                window.SQUAD_PVP = true;
                window.DEV_MODE = false;
                if (ui.syncSettingsUI) ui.syncSettingsUI();
              }
              player.godMode = false;
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
              ui.updateHUD(player, raidTimeLeft, getActiveExtractProgress());
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

    raidStartTimestamp = Date.now();
    raidEndTimestamp = raidStartTimestamp + zone.raidDuration * 1000;
    raidTimeLeft = zone.raidDuration;
    raidElapsed = 0;
    if (mpSession && mpSession.active && isMatchHost) {
      setTimeout(() => {
        if (inRaid && mpSession && mpSession.active && isMatchHost) {
          mpSession.sendEvent({ type: 'raid_timer', rt: Math.round(raidTimeLeft * 10) / 10 });
        }
      }, 1200);
    }
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
    exitHideoutRoam(false);
    if (window.soundEngine) {
      try {
        window.soundEngine.init();
        if (window.soundEngine.setIndoor) window.soundEngine.setIndoor(false);
        if (window.soundEngine.startAmbient) window.soundEngine.startAmbient('wind');
      } catch (e) {}
    }
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
      const dropY = Math.max(0.02, (player.position.y - player.currentEyeHeight));
      const gi = world.spawnGroundItem(droppedItem.id, droppedItem.qty || 1, new THREE.Vector3(dropX, dropY, dropZ), {
        mods: droppedItem.mods || null,
        mag: droppedItem.mag,
        rarityOverride: droppedItem.rarityOverride || null
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
          mag: gi.mag,
          rarityOverride: gi.rarityOverride || null
        });
      }
    };
    window.onHostSpawnGroundItem = (gi) => {
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
          mag: gi.mag,
          rarityOverride: gi.rarityOverride || null
        });
      }
    };
    const serializeSyncItems = (items) => (items || []).map(it => it ? {
      id: it.id,
      qty: it.qty || 1,
      mods: it.mods || null,
      mag: it.mag,
      rarityOverride: it.rarityOverride || null,
      revealed: it.revealed !== false
    } : null).filter(Boolean);

    ui.onContainerChanged = (cid, items, eq = null) => {
      if (mpSession && mpSession.active && cid) {
        const isCorpse = String(cid).startsWith('corpse_');
        mpSession.sendEvent({
          type: isCorpse ? 'corpse_sync' : 'container_sync',
          cid,
          items: serializeSyncItems(items),
          ...(eq ? { eq: { ...eq } } : {})
        });
      }
    };
    window.onHostContainerChanged = (cid, items) => {
      if (mpSession && mpSession.active && isMatchHost && cid) {
        mpSession.sendEvent({
          type: 'container_sync',
          cid,
          items: serializeSyncItems(items)
        });
      }
    };
    window.onHostCorpseSync = (enemy) => {
      if (!enemy || !enemyManager || !Array.isArray(enemyManager.enemies)) return;
      const eIdx = enemyManager.enemies.indexOf(enemy);
      if (eIdx < 0) return;
      if (mpSession && mpSession.active && isMatchHost) {
        mpSession.sendEvent({
          type: 'corpse_sync',
          cid: 'corpse_' + eIdx,
          items: serializeSyncItems(enemy.lootItems || []),
          eq: enemy.operatorEquipment ? { ...enemy.operatorEquipment } : null
        });
      }
    };
    ui.addFeedMessage(`Deployed to ${zone.name}`, '#69f0ae');
    if (ui && ui.syncUpdateBadges) ui.syncUpdateBadges();
    canvas.requestPointerLock();
  }

  function devExfil(opts = {}) {
    if (!inRaid || !player) return false;
    endRaid(true, opts);
    return true;
  }

  function endRaid(extracted, opts = {}) {
    window.onHostSpawnGroundItem = null;
    window.onHostContainerChanged = null;
    window.onHostCorpseSync = null;
    if (ui) ui.onContainerChanged = null;
    if (mpSession) mpSession.stop();
    if (window.soundEngine && window.soundEngine.stopAmbient) {
      try { window.soundEngine.stopAmbient(false); } catch (e) {}
    }
    if (ui && ui.setSelfPartyReady) ui.setSelfPartyReady(false);
    if (inRaid) {
      if (ui && ui.closeInGameSettings) ui.closeInGameSettings(false);
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
      const saveWpnMeta = (slotObj) => {
        if (!slotObj || !slotObj.id) return { mods: null, rarity: null };
        const cleanMods = (window.GAME_DATA && GAME_DATA.normalizeWeaponMods)
          ? GAME_DATA.normalizeWeaponMods(slotObj.mods || {})
          : { ...(slotObj.mods || {}) };
        const rar = (window.GAME_DATA && GAME_DATA.resolveWeaponRarity)
          ? GAME_DATA.resolveWeaponRarity(slotObj.id, cleanMods, slotObj.rarityOverride || null)
          : (slotObj.rarityOverride || null);
        return { mods: cleanMods, rarity: rar };
      };
      const pMeta = saveWpnMeta(player.slots.primary);
      const sMeta = saveWpnMeta(player.slots.secondary);
      const bwMeta = saveWpnMeta(player.backpackWeapon);
      ui.profile.loadout.primary = player.slots.primary ? player.slots.primary.id : null;
      ui.profile.loadout.primaryMods = pMeta.mods;
      ui.profile.loadout.primaryRarity = pMeta.rarity;
      ui.profile.loadout.secondary = player.slots.secondary ? player.slots.secondary.id : null;
      ui.profile.loadout.secondaryMods = sMeta.mods;
      ui.profile.loadout.secondaryRarity = sMeta.rarity;
      ui.profile.loadout.backpackWeapon = player.backpackWeapon ? player.backpackWeapon.id : null;
      ui.profile.loadout.backpackWeaponMods = bwMeta.mods;
      ui.profile.loadout.backpackWeaponRarity = bwMeta.rarity;
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
        recovered.push({ id: player.backpackWeapon.id, qty: 1, mods: bwMeta.mods, rarityOverride: bwMeta.rarity });
      }

      for (const item of player.backpack) {
        const def = GAME_DATA.ITEMS[item.id];
        if (!def) continue;
        totalVal += def.value * item.qty;
        if (def.type === 'ammo') {
          ui.profile.loadout.ammo[item.id] = (ui.profile.loadout.ammo[item.id] || 0) + item.qty;
        } else {
          ui.addToStash(item.id, item.qty, item.mods || null, item.rarityOverride || null);
        }
        recovered.push(item);
      }
    } else if (!window.DEV_MODE) {
      // KIA / MIA: lose raid gear and backpack (skipped in Dev Mode)
      ui.profile.loadout = {
        primary: null,
        primaryMods: null,
        primaryRarity: null,
        secondary: null,
        secondaryMods: null,
        secondaryRarity: null,
        backpackWeapon: null,
        backpackWeaponMods: null,
        backpackWeaponRarity: null,
        armor: null,
        backpackItems: [],
        ammo: {}
      };
    }

    ui.profile.xp = (ui.profile.xp || 0) + raidXp;
    if (ui.recordMissionProgress) {
      if (extracted) {
        ui.recordMissionProgress('extracts', 1);
        if (totalVal > 0) ui.recordMissionProgress('value', totalVal);
      }
    }
    if (opts && opts.skipSummary) {
      // Still credit Active Duty Operator exfil streak & trait points before saving to localStorage
      if (ui._ensureActiveDutyOperators) {
        const ops = ui._ensureActiveDutyOperators();
        const curOp = ops[ui.profile.activeOperatorIdx || 0];
        if (curOp && extracted) {
          const prevDt = ui._getDogtagInfo(curOp.exfilStreak || 0);
          curOp.exfilStreak = Math.min(10, (curOp.exfilStreak || 0) + 1);
          const nextDt = ui._getDogtagInfo(curOp.exfilStreak);
          if (nextDt.levelNum > prevDt.levelNum) {
            curOp.traitPoints = (curOp.traitPoints || 0) + 2 * (nextDt.levelNum - prevDt.levelNum);
          }
        }
      }
      ui.saveProfile();
      if (ui && ui.syncUpdateBadges) ui.syncUpdateBadges();
      return;
    }
    ui.saveProfile();
    if (ui && ui.syncUpdateBadges) ui.syncUpdateBadges();
    ui.showSummary(extracted, raidElapsed, raidKills, recovered, totalVal);
  }

  // ==================== INPUT & POINTER LOCK ====================
  let escClosedUiUntil = 0;
  document.addEventListener('pointerlockchange', () => {
    if (!inRaid) return;
    const locked = document.pointerLockElement === canvas;
    if (!locked) {
      player.keys = {};
      player.isFiring = false;
      player.isADS = false;
    }
    const suppressPause = performance.now() < escClosedUiUntil;
    if (!locked && !suppressPause && !isModalOpen && !ui.isTacMapOpen && !(ui && ui.isInGameSettingsOpen) && !(devConsole && devConsole.isOpen)) {
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

  const btnCloseLoot = document.getElementById('btn-close-loot');
  if (btnCloseLoot) {
    btnCloseLoot.addEventListener('click', () => {
      closeLootAndResume();
    });
  }
  const btnCloseContainer = document.getElementById('btn-close-container');
  if (btnCloseContainer) {
    btnCloseContainer.addEventListener('click', () => closeLootAndResume());
  }

  function closeLootAndResume(fromEscape = false) {
    isModalOpen = false;
    ui.closeLootModal();
    const pauseOv = document.getElementById('pointer-lock-overlay');
    if (pauseOv) pauseOv.classList.add('hidden');
    if (fromEscape) {
      escClosedUiUntil = performance.now() + 350;
    }
    if (inRaid) {
      try { canvas.requestPointerLock(); } catch (e) {}
    }
  }

  window.addEventListener('mousemove', (e) => {
    if (!inRaid) {
      if (hideoutBunker && hideoutBunker.activeRoam && document.pointerLockElement === canvas) {
        hideoutBunker.handleMouseMove(e.movementX, e.movementY);
      }
      return;
    }
    if (isModalOpen || document.pointerLockElement !== canvas) return;
    if (player && player.dead) return; // Corpse frozen when dead (spectating living ally)
    if (pingWheelOpen) {
      pingWheelX = THREE.MathUtils.clamp(pingWheelX + e.movementX, -110, 110);
      pingWheelY = THREE.MathUtils.clamp(pingWheelY + e.movementY, -110, 110);
      _updatePingWheelSelection();
      return;
    }
    const baseFov = window.BASE_FOV || 75;
    const curFov = camera ? camera.fov : baseFov;
    const zoomMult = (window.GAME_DATA && window.GAME_DATA.getZoomSensitivityMultiplier)
      ? window.GAME_DATA.getZoomSensitivityMultiplier(curFov, baseFov, !!player.isADS)
      : (player.isADS ? 0.55 : 1.0);
    const sens = 0.0022 * zoomMult * (window.MOUSE_SENS || 1.0);
    player.yaw -= e.movementX * sens;
    player.pitch -= e.movementY * sens;
    player.pitch = THREE.MathUtils.clamp(player.pitch, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08);
  });

  window.addEventListener('mousedown', (e) => {
    if (!inRaid) {
      if (hideoutBunker && hideoutBunker.activeRoam) {
        if (document.pointerLockElement !== canvas && e.target === canvas) {
          canvas.requestPointerLock();
          return;
        }
        if (e.button === 0 && hideoutBunker.hoveredStation) {
          openFobStation(hideoutBunker.hoveredStation);
        }
      }
      return;
    }
    if (isModalOpen || (ui && ui.isInGameSettingsOpen) || (devConsole && devConsole.isOpen)) return;
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
      if (player && player.dead) {
        spectateAllyIdx += 1;
        return;
      }
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
      const tag = document.activeElement && document.activeElement.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const fobOv = document.getElementById('fob-enter-overlay');
      if (fobOv && !fobOv.classList.contains('hidden')) {
        const btnEnter = document.getElementById('btn-enter-fob');
        if (btnEnter && btnEnter.disabled) return;
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          dismissFobOverlay(true);
        } else if (e.code === 'KeyM' || e.code === 'Escape') {
          e.preventDefault();
          dismissFobOverlay(false);
        }
        return;
      }
      if (hideoutBunker && hideoutBunker.activeRoam) {
        hideoutBunker.keys[e.code] = true;
        const kb = window.KEYBINDS || {};
        if (e.code === 'Escape' || e.code === 'KeyM') {
          e.preventDefault();
          exitHideoutRoam(true);
          return;
        }
        if ((e.code === (kb.interact || 'KeyE') || e.code === 'KeyE') && hideoutBunker.hoveredStation) {
          e.preventDefault();
          openFobStation(hideoutBunker.hoveredStation);
          return;
        }
        return;
      }
      if (!typing && hideoutBunker && ui && ui.activeMenuTab === 'home' && !(gunsmith && gunsmith.isOpen) &&
          (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD')) {
        enterHideoutRoam();
        hideoutBunker.keys[e.code] = true;
        return;
      }
      if (e.code === 'Escape' && ui && ui._deployWeaponPick && ui.closeDeployWeaponPickMode) {
        ui.closeDeployWeaponPickMode();
        return;
      }
      if (e.code === 'Escape' && !gunsmith.isOpen && ui.activeMenuTab !== 'home') {
        ui.openMenuTab('home');
        enterHideoutRoam();
      }
      return;
    }
    const kb = window.KEYBINDS || {};
    player.keys[e.code] = true;

    if (e.code === (kb.backpack || 'Tab')) {
      e.preventDefault();
      if (e.repeat) return;
      if (isModalOpen) {
        closeLootAndResume();
      } else if (_getLookedAtGroundWeapon() && player && player.hasWeaponBackpack && player.hasWeaponBackpack()) {
        // Hold Tab while looking at a ground weapon -> stow into Weapon Backpack; quick tap opens backpack!
        tabStowHoldStart = performance.now();
        tabStowTriggered = false;
      } else {
        isModalOpen = true;
        document.exitPointerLock();
        ui.openLootModal(player, 'BACKPACK', null);
      }
      return;
    }

    if (ui && ui.isInGameSettingsOpen) {
      if (e.code === 'Escape') {
        e.preventDefault();
        escClosedUiUntil = performance.now() + 350;
        ui.closeInGameSettings(true);
      }
      return;
    }

    if (isModalOpen) {
      if (e.code === 'Escape') {
        e.preventDefault();
        escClosedUiUntil = performance.now() + 350;
        if (ui && ui._raidWeaponPick && ui.closeRaidWeaponPickMode) {
          ui.closeRaidWeaponPickMode();
        } else {
          closeLootAndResume(true);
        }
      }
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
      if (!e.repeat && player && player.dead) {
        spectateAllyIdx += 1;
        return;
      }
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

    if (e.code === (kb.slotPrimary || 'Digit1')) { if (designatorActive) setDesignatorActive(false); player.switchSlot('primary'); }
    else if (e.code === (kb.slotSecondary || 'Digit2')) { if (designatorActive) setDesignatorActive(false); player.switchSlot('secondary'); }
    else if (e.code === (kb.slotMelee || 'Digit3')) { if (designatorActive) setDesignatorActive(false); player.switchSlot('melee'); }
    else if (e.code === (kb.quickMelee || 'KeyX')) {
      if (!e.repeat) performMeleeStrike(true);
    }
    else if (e.code === (kb.reload || 'KeyR')) player.startReload();
    else if (e.code === (kb.inspect || 'KeyI')) player.startInspect();
    else if (e.code === (kb.tacStance || 'KeyB')) {
      if (!e.repeat && player && !player.isDowned && !player.dead && player.toggleTacStance) {
        const on = player.toggleTacStance();
        if (ui && ui.addFeedMessage) {
          ui.addFeedMessage(on ? 'Tactical Stance: ON (45° Canted ADS)' : 'Tactical Stance: OFF', on ? '#69f0ae' : '#b0bec5');
        }
      }
    }
    else if (e.code === (kb.medkit || 'KeyH')) {
      if (player.startMedkit()) ui.addFeedMessage('Applying Field Medkit...', '#69f0ae');
    } else if (e.code === (kb.plates || 'KeyG') || e.code === 'Digit4') {
      player.startPlating();
    } else if (e.code === (kb.fieldUpgrade || 'KeyZ')) {
      const fuMsg = player.activateFieldUpgrade ? player.activateFieldUpgrade() : null;
      if (fuMsg) {
        ui.addFeedMessage(fuMsg, '#69f0ae');
        if (mpSession && mpSession.active && player._lastFieldUpgradeDeploy) {
          mpSession.sendEvent({
            type: 'field_upgrade',
            evId: `${ui._clientId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ...player._lastFieldUpgradeDeploy
          });
        }
      }
    } else if (e.code === (kb.killstreak || 'KeyK')) {
      activateKillstreak();
    } else if (e.code === (kb.map || 'KeyM')) {
      e.preventDefault();
      if (!e.repeat) toggleFullMapMode();
    } else if (e.code === 'Escape' && designatorActive) {
      e.preventDefault();
      escClosedUiUntil = performance.now() + 350;
      setDesignatorActive(false);
    } else if (e.code === 'Escape' && ui.isTacMapOpen) {
      e.preventDefault();
      escClosedUiUntil = performance.now() + 350;
      toggleFullMapMode(false);
      const pauseOv = document.getElementById('pointer-lock-overlay');
      if (pauseOv) pauseOv.classList.add('hidden');
    } else if (e.code === 'Escape') {
      const pauseOv = document.getElementById('pointer-lock-overlay');
      if (pauseOv) {
        if (pauseOv.classList.contains('hidden')) {
          pauseOv.classList.remove('hidden');
        } else {
          pauseOv.classList.add('hidden');
          try { canvas.requestPointerLock(); } catch (err) {}
        }
      }
    } else if (e.code === (kb.interact || 'KeyE') && nearbyInteractable) {
      openNearbyInteractable();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (!inRaid) {
      if (hideoutBunker) hideoutBunker.keys[e.code] = false;
      return;
    }
    if (!player) return;
    const kb = window.KEYBINDS || {};
    player.keys[e.code] = false;
    if (e.code === (kb.backpack || 'Tab')) {
      if (tabStowHoldStart > 0 && !tabStowTriggered && !isModalOpen) {
        isModalOpen = true;
        document.exitPointerLock();
        ui.openLootModal(player, 'BACKPACK', null);
      }
      tabStowHoldStart = 0;
      tabStowTriggered = false;
      return;
    }
    if (e.code === (kb.crouch || 'KeyC') || e.code === 'ControlLeft') {
      player.onCrouchKeyUp();
    } else if ((e.code === (kb.lethal || 'KeyF') || e.code === 'Digit5') && throwableSystem) {
      throwableSystem.releaseThrow('lethal', player, enemyManager, onThrowableHit);
    } else if (e.code === (kb.tactical || 'KeyQ') && throwableSystem) {
      throwableSystem.releaseThrow('tactical', player, enemyManager, onThrowableHit);
    }
  });

  function _getLookedAtGroundWeapon() {
    if (!nearbyInteractable || nearbyInteractable.type !== 'ground' || !nearbyInteractable.groundItem) return null;
    const gi = nearbyInteractable.groundItem;
    const def = GAME_DATA.ITEMS[gi.id];
    return (def && def.type === 'weapon') ? gi : null;
  }

  function _pickupGroundWeapon(gi, targetSlotKey) {
    if (!gi || !player || !world) return false;
    const def = GAME_DATA.ITEMS[gi.id];
    if (!def || def.type !== 'weapon') return false;
    const dropPos = gi.position.clone();
    const res = player.equipWeaponInRaid(gi.id, targetSlotKey, {
      mods: gi.mods || {},
      mag: gi.mag,
      rarityOverride: gi.rarityOverride || null
    });
    if (!res.equipped) return false;

    const pickedUid = gi.uid;
    world.removeGroundItem(gi);
    if (mpSession && mpSession.active && pickedUid) {
      mpSession.sendEvent({ type: 'ground_pickup', uid: pickedUid });
    }
    if (res.prevId) {
      const sinY = Math.sin(player.yaw);
      const cosY = Math.cos(player.yaw);
      const ejectPos = new THREE.Vector3(
        dropPos.x + (Math.random() - 0.5) * 0.18 - sinY * 0.12,
        Math.max(0.02, dropPos.y),
        dropPos.z + (Math.random() - 0.5) * 0.18 - cosY * 0.12
      );
      const swapped = world.spawnGroundItem(res.prevId, 1, ejectPos, {
        mods: (res.prevSlotObj && res.prevSlotObj.mods) || null,
        mag: res.prevSlotObj && res.prevSlotObj.mag,
        rarityOverride: (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null
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
          mag: swapped.mag,
          rarityOverride: swapped.rarityOverride || null
        });
      }
    }
    if (window.soundEngine && window.soundEngine.playMagIn) {
      try { window.soundEngine.playMagIn(); } catch (e) {}
    }
    if (weaponSystem && weaponSystem.triggerGrabAnim) {
      weaponSystem.triggerGrabAnim('weapon');
    }
    nearbyInteractable = null;
    if (targetSlotKey === 'backpackWeapon') {
      ui.addFeedMessage(`Stowed ${def.name} in Weapon Backpack`, '#69f0ae');
    }
    return true;
  }

  function openNearbyInteractable() {
    if (!nearbyInteractable) return false;
    if (nearbyInteractable.type === 'munition_box' && nearbyInteractable.box && player && player.resupplyFromMunitionBox) {
      const msg = player.resupplyFromMunitionBox(nearbyInteractable.box);
      if (msg) ui.showNotice(msg, '#69f0ae');
      if (weaponSystem && weaponSystem.triggerGrabAnim) weaponSystem.triggerGrabAnim('item');
      ui.updateHUD(player, raidTimeLeft, getActiveExtractProgress());
      window._lastInteractCheckMs = 0;
      checkInteractions();
      return true;
    }
    if (nearbyInteractable.type === 'door' && nearbyInteractable.door && world && world.interactDoor) {
      world.interactDoor(nearbyInteractable.door, player.position, !!player.isADS);
      if (weaponSystem && weaponSystem.triggerGrabAnim) weaponSystem.triggerGrabAnim('container');
      window._lastInteractCheckMs = 0;
      checkInteractions();
      return true;
    }
    if (nearbyInteractable.type === 'ground') {
      const gi = nearbyInteractable.groundItem;
      if (!gi) return false;
      const def = GAME_DATA.ITEMS[gi.id];
      if (def && def.type === 'weapon') {
        // Picking up a ground weapon immediately replaces the weapon in hand and ejects the previous one onto the ground!
        let handSlot = (player.activeSlot === 'primary' || player.activeSlot === 'secondary')
          ? player.activeSlot
          : (!player.slots.primary ? 'primary' : (!player.slots.secondary ? 'secondary' : 'primary'));
        // If active hand slot is full but the other weapon slot is empty, fill the empty slot only when holding melee
        if (player.activeSlot === 'melee') {
          handSlot = !player.slots.primary ? 'primary' : (!player.slots.secondary ? 'secondary' : 'primary');
        }
        return _pickupGroundWeapon(gi, handSlot);
      }
      if (player.addToBackpack(gi.id, gi.qty, { mods: gi.mods || null, mag: gi.mag, rarityOverride: gi.rarityOverride || null })) {
        const pickedUid = gi.uid;
        world.removeGroundItem(gi);
        if (mpSession && mpSession.active && pickedUid) {
          mpSession.sendEvent({ type: 'ground_pickup', uid: pickedUid });
        }
        if (window.soundEngine && window.soundEngine.playClick) {
          try { window.soundEngine.playClick(); } catch (e) {}
        }
        if (weaponSystem && weaponSystem.triggerGrabAnim) weaponSystem.triggerGrabAnim('item');
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
    if (c && world && world.openContainer) {
      if (weaponSystem && weaponSystem.triggerGrabAnim) weaponSystem.triggerGrabAnim('container');
      const newlyOpened = world.openContainer(c);
      if (newlyOpened) {
        if (ui && ui.recordMissionProgress) ui.recordMissionProgress('loot', 1);
        if (window.soundEngine) {
          try {
            if (window.soundEngine.playContainerOpen) window.soundEngine.playContainerOpen(c.kind);
            else if (window.soundEngine.playClick) window.soundEngine.playClick();
          } catch (e) {}
        }
        if (mpSession && mpSession.active) {
          mpSession.sendEvent({
            type: 'container_open',
            id: c.id,
            items: (c.items || []).map(it => it ? {
              id: it.id,
              qty: it.qty || 1,
              mods: it.mods || null,
              mag: it.mag,
              rarityOverride: it.rarityOverride || null,
              revealed: it.revealed !== false
            } : null).filter(Boolean)
          });
        }
      }
    }
    isModalOpen = true;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    const worldPos = (nearbyInteractable.container && nearbyInteractable.container.position)
      || nearbyInteractable.worldPos
      || null;
    const lootId = c ? c.id : (nearbyInteractable.corpseId || null);
    ui.openLootModal(player, nearbyInteractable.label, nearbyInteractable.items, nearbyInteractable.operatorEquipment || null, worldPos, camera, lootId);
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
      if (player) {
        player.isFiring = false;
        player.isADS = false;
      }
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      if (inRaid && player && world && ui._renderFullMap) {
        ui._renderFullMap(player, world, enemyManager, squadManager);
      }
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
          const wHits = world && world.shootableMeshes ? ray.intersectObjects(world.shootableMeshes, true) : [];
          if (wHits.length === 0 || wHits[0].distance >= eHits[0].distance - 0.8) {
            const ey = (world && world.getTerrainHeight) ? Math.max(enemy.position.y, world.getTerrainHeight(enemy.position.x, enemy.position.z)) : enemy.position.y;
            return { pos: new THREE.Vector3(enemy.position.x, ey + 2.25, enemy.position.z), enemy };
          }
        }
      }

      // Generous angular + lateral proximity cone lock so live-pinging moving or distant enemies is super reliable!
      let bestConeEnemy = null;
      let bestConeScore = Infinity;
      const maxPingDist = 420;
      const enemies = enemyManager.enemies || [];
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e || e.dead || e.extracted) continue;
        const ey = (world && world.getTerrainHeight) ? Math.max(e.position.y, world.getTerrainHeight(e.position.x, e.position.z)) : e.position.y;
        const center = new THREE.Vector3(e.position.x, ey + (e.isDowned ? 0.55 : 1.15), e.position.z);
        const toE = center.clone().sub(origin);
        const along = toE.dot(dir);
        if (along < 1.5 || along > maxPingDist) continue;
        const perpDist = toE.clone().addScaledVector(dir, -along).length();
        // Generous ping cylinder/cone: >= 2.2m radius up close, widening to ~5.2° cone at range!
        const allowedRadius = Math.max(2.2, along * 0.092);
        if (perpDist > allowedRadius) continue;
        // Verify line-of-sight isn't blocked by a solid wall/hill
        const losDir = toE.clone().normalize();
        const losRay = new THREE.Raycaster(origin, losDir, 0.5, along - 0.9);
        const wHits = (world && world.shootableMeshes) ? losRay.intersectObjects(world.shootableMeshes, true) : [];
        if (wHits.length > 0) continue;
        const score = perpDist / allowedRadius;
        if (score < bestConeScore) {
          bestConeScore = score;
          bestConeEnemy = e;
        }
      }
      if (bestConeEnemy) {
        const ey = (world && world.getTerrainHeight) ? Math.max(bestConeEnemy.position.y, world.getTerrainHeight(bestConeEnemy.position.x, bestConeEnemy.position.z)) : bestConeEnemy.position.y;
        return { pos: new THREE.Vector3(bestConeEnemy.position.x, ey + (bestConeEnemy.isDowned ? 1.15 : 2.25), bestConeEnemy.position.z), enemy: bestConeEnemy };
      }
    }

    // 2. Otherwise hit world geometry / ground
    if (world && world.shootableMeshes) {
      const wHits = ray.intersectObjects(world.shootableMeshes, true);
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
        const ey = (world && world.getTerrainHeight)
          ? Math.max(pg.targetEnemy.position.y, world.getTerrainHeight(pg.targetEnemy.position.x, pg.targetEnemy.position.z))
          : pg.targetEnemy.position.y;
        pg.position.set(pg.targetEnemy.position.x, ey + (pg.targetEnemy.isDowned ? 1.15 : 2.25), pg.targetEnemy.position.z);
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
    // Iconic A-10 Thunderbolt II ("Warthog") Close Air Support Gunship!
    const g = new THREE.Group();
    const hullMat = new THREE.MeshLambertMaterial({ color: 0x525a62 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x2e343a });
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x1b2b36 });
    const cannonMat = new THREE.MeshLambertMaterial({ color: 0x181a1c });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });

    // Rugged elongated fuselage + tapered nose + bubble canopy
    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.92, 9.6), hullMat);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.68, 2.4, 8), hullMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.06, -5.8);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.56, 2.4), canopyMat);
    canopy.position.set(0, 0.62, -2.5);

    // Iconic GAU-8 Avenger 30mm 7-barrel rotary cannon protruding from nose + dynamic muzzle flash cone
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.5, 6), cannonMat);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0, -0.26, -7.2);
    const muzzleCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.65, 3.6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.92 })
    );
    muzzleCone.rotation.x = -Math.PI / 2;
    muzzleCone.position.set(0, -0.26, -9.4);
    muzzleCone.visible = false;
    g.userData.muzzleFlash = muzzleCone;

    // Signature straight, wide, low-mounted Warthog cantilever wings + underwing ordnance pods
    const wings = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.18, 2.2), hullMat);
    wings.position.set(0, -0.18, -0.5);
    const tipL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 1.8), darkMat);
    tipL.position.set(-7.2, -0.04, -0.4);
    tipL.rotation.z = -0.22;
    const tipR = tipL.clone();
    tipR.position.x = 7.2;
    tipR.rotation.z = 0.22;
    const gearPodL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 2.4), darkMat);
    gearPodL.position.set(-2.4, -0.42, -0.8);
    const gearPodR = gearPodL.clone();
    gearPodR.position.x = 2.4;

    // Twin high-mounted rear TF34 turbofan engine nacelles behind the wings
    const engL = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.50, 3.0, 10), darkMat);
    engL.rotation.x = Math.PI / 2;
    engL.position.set(-1.35, 0.65, 2.1);
    const engR = engL.clone();
    engR.position.x = 1.35;
    const burnL = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.18, 1.4, 6), glowMat);
    burnL.rotation.x = Math.PI / 2;
    burnL.position.set(-1.35, 0.65, 4.1);
    const burnR = burnL.clone();
    burnR.position.x = 1.35;

    // Iconic A-10 H-tail (wide horizontal stabilizer + twin vertical tailfins at the tips)
    const hTail = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.14, 1.35), hullMat);
    hTail.position.set(0, 0.18, 4.4);
    const vTailL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 1.55), hullMat);
    vTailL.position.set(-2.55, 0.85, 4.45);
    const vTailR = vTailL.clone();
    vTailR.position.x = 2.55;

    g.add(
      fuselage, nose, canopy, cannon, muzzleCone,
      wings, tipL, tipR, gearPodL, gearPodR,
      engL, engR, burnL, burnR, hTail, vTailL, vTailR
    );
    return g;
  }

  const _ksFireGeo = new THREE.ConeGeometry(0.65, 2.8, 6);
  const _ksSmokeGeo = new THREE.SphereGeometry(1.15, 7, 5);
  const _ksFlashGeo = new THREE.RingGeometry(0.45, 1.05, 14);
  _ksFlashGeo.rotateX(-Math.PI / 2);

  function _spawnAirstrikeExplosion(pos, applyDamage = true, callerName = null, fromJetPos = null, passIdx = 0, passHitSet = null) {
    if (!scene) return;
    const dist = player ? player.position.distanceTo(pos) : 25;
    if (window.soundEngine && window.soundEngine.playCannonImpact) {
      window.soundEngine.playCannonImpact(dist);
    }
    // Crisp high-frequency ground concussion rumble when nearby
    if (player && dist < 42) {
      const shake = (1 - dist / 42) * 0.026;
      player.applyRecoil(shake * (0.5 + Math.random() * 0.7), (Math.random() - 0.5) * shake);
    }

    // Blazing 30mm HEI tracer streak pouring straight down from the A-10's GAU-8 nose cannon!
    if (fromJetPos && weaponSystem && weaponSystem._spawnTracer) {
      weaponSystem._spawnTracer(fromJetPos, pos, 0xffb732);
    }

    // Vertical 30mm HEI dirt/spark geyser column (distinct from spherical grenade explosions!)
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xffb338, transparent: true, opacity: 0.94 });
    const fireMesh = new THREE.Mesh(_ksFireGeo, fireMat);
    fireMesh.position.set(pos.x, pos.y + 1.1, pos.z);
    fireMesh.rotation.set((Math.random() - 0.5) * 0.22, Math.random() * Math.PI, (Math.random() - 0.5) * 0.22);
    scene.add(fireMesh);

    // Expanding ground shockwave dust ring
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xd8c39e, transparent: true, opacity: 0.80, side: THREE.DoubleSide });
    const flashMesh = new THREE.Mesh(_ksFlashGeo, flashMat);
    flashMesh.position.set(pos.x, pos.y + 0.14, pos.z);
    scene.add(flashMesh);

    // Rising dark earth/smoke plume
    const smokeMat = new THREE.MeshLambertMaterial({ color: 0x3b352c, transparent: true, opacity: 0.74 });
    const smokeMesh = new THREE.Mesh(_ksSmokeGeo, smokeMat);
    smokeMesh.position.set(pos.x, pos.y + 1.2, pos.z);
    scene.add(smokeMesh);

    // No dynamic PointLight -> ZERO WebGL shader recompilations & butter-smooth FPS!
    ksExplosions.push({ fireMesh, flashMesh, smokeMesh, light: null, age: 0, maxAge: 1.35 });

    // Dense 30mm HEI strafing corridor AoE damage (Unified Operator Lethality: Pass 1 = Break Armor + Half HP, Pass 2 = Lethal Kill!)
    const blastRadius = 9.0;
    const hitSet = passHitSet || new Set();
    if (applyDamage && enemyManager && enemyManager.enemies) {
      const attackerInfo = {
        name: callerName || getPlayerCallsign(),
        isPlayer: !callerName,
        weaponId: 'ks_airstrike',
        weaponName: 'A-10 Warthog 30mm'
      };
      for (const e of enemyManager.enemies) {
        if (e.dead || hitSet.has(e)) continue;
        const d = Math.hypot(e.position.x - pos.x, e.position.z - pos.z);
        if (d <= blastRadius) {
          hitSet.add(e);
          if (e.isOperator) {
            if (passIdx === 0) {
              // Pass 1: Break all armor & drop to half health!
              if (e.armor > 0) { e.armor = 0; e.justBrokeArmor = true; e.lastHitArmor = true; }
              const halfHp = Math.max(1, Math.round(e.maxHp * 0.5));
              if (e.hp > halfHp) e.hp = halfHp;
              e.timeSinceDamaged = 0;
              if (e.mw2Anim) e.mw2Anim.triggerHitFlinch(1);
              if (!callerName) onThrowableHit(false, false, e, attackerInfo);
            } else {
              // Pass 2: Lethal kill!
              e.armor = 0;
              e.isDowned = false;
              e.die();
              if (!callerName) onThrowableHit(false, true, e, attackerInfo);
            }
          } else {
            const falloff = 1 - (d / blastRadius) * 0.45;
            const dmg = Math.round(125 * falloff);
            const killed = e.takeDamage(dmg, pos, attackerInfo);
            if (!callerName) onThrowableHit(false, killed, e, attackerInfo);
          }
        }
      }
    }

    // Unified Airstrike Lethality on Player (Pass 1 = Break Armor + Half HP, Pass 2 = Lethal Kill!)
    if (player && !player.dead && !hitSet.has('player')) {
      const pd = Math.hypot(player.position.x - pos.x, player.position.z - pos.z);
      if (pd <= blastRadius) {
        hitSet.add('player');
        ui.triggerDamageFlash();
        if (passIdx === 0) {
          // Pass 1: Break all armor & drop to half health!
          player.armor = 0;
          const halfHp = Math.max(1, Math.round(player.maxHp * 0.5));
          if (player.hp > halfHp) player.hp = halfHp;
          player.timeSinceDamaged = 0;
          ui.showCenterToast('A-10 PASS 1 — ARMOR SHATTERED!', '#ff6b6b');
        } else {
          // Pass 2: Lethal kill!
          player.armor = 0;
          player.isDowned = false;
          player.takeDamage(999, { name: 'A-10 CAS', weaponId: 'ks_airstrike', weaponName: 'A-10 Warthog 30mm' });
          if (player.isDowned) {
            player.takeDamage(999, { name: 'A-10 CAS', weaponId: 'ks_airstrike', weaponName: 'A-10 Warthog 30mm' });
          }
        }
        ui.updateHUD(player, raidTimeLeft, getActiveExtractProgress());
      }
    }
  }

  function _getKillstreakTargetPoint() {
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(dir);

    // 1. High-accuracy raycast up to 1400m across all world structures & terrain meshes
    const ray = new THREE.Raycaster(origin, dir, 1.0, 1400);
    if (world && world.shootableMeshes && world.shootableMeshes.length > 0) {
      const hits = ray.intersectObjects(world.shootableMeshes, true);
      if (hits.length > 0) {
        const pt = hits[0].point;
        return new THREE.Vector3(pt.x, pt.y + 0.06, pt.z);
      }
    }
    // 2. Exact analytical terrain raymarch along crosshair vector up to 1300m (never stops short!)
    if (world && world.getTerrainHeight) {
      let prevT = 4;
      for (let t = 8; t <= 1300; t += (t < 150 ? 3 : 8)) {
        const px = origin.x + dir.x * t;
        const py = origin.y + dir.y * t;
        const pz = origin.z + dir.z * t;
        const ty = world.getTerrainHeight(px, pz);
        if (py <= ty) {
          // Binary refine between prevT and t for pinpoint crosshair alignment
          let lo = prevT, hi = t;
          for (let k = 0; k < 6; k++) {
            const mid = (lo + hi) * 0.5;
            const mx = origin.x + dir.x * mid;
            const my = origin.y + dir.y * mid;
            const mz = origin.z + dir.z * mid;
            if (my <= world.getTerrainHeight(mx, mz)) hi = mid;
            else lo = mid;
          }
          const fx = origin.x + dir.x * hi;
          const fz = origin.z + dir.z * hi;
          const fy = world.getTerrainHeight(fx, fz);
          return new THREE.Vector3(fx, fy + 0.06, fz);
        }
        prevT = t;
      }
    }
    const fx = origin.x + dir.x * 650;
    const fz = origin.z + dir.z * 650;
    const fy = (world && world.getTerrainHeight) ? world.getTerrainHeight(fx, fz) : 0;
    return new THREE.Vector3(fx, fy + 0.06, fz);
  }

  let designatorActive = false;
  let designatorFireHeld = false;
  let designatorRig = null;
  let designatorAimBlend = 0;
  let designatorLaserLine = null;
  let designatorTargetRing = null;
  let designatorDeployAnim = { active: false, t: 0, dur: 0.38 };
  let uavPhoneAnim = { active: false, t: 0, dur: 1.15, triggered: false, mesh: null };

  function _createDesignatorRig() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2d352c });
    const rubberMat = new THREE.MeshLambertMaterial({ color: 0x161918 });
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x224455 });
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff3030 });
    const gloveMat = new THREE.MeshLambertMaterial({ color: 0x252925 });
    const knuckleMat = new THREE.MeshLambertMaterial({ color: 0x191c1a });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xc99c7a });
    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x343a31 });
    const cuffMat = new THREE.MeshLambertMaterial({ color: 0x1a1c19 });

    // Dual binocular barrels + central bridge + laser emitter housing + top lock button
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.21, 12), bodyMat);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.048, 0, 0);
    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.21, 12), bodyMat);
    barrelR.rotation.x = Math.PI / 2;
    barrelR.position.set(0.048, 0, 0);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.048, 0.13), rubberMat);
    const laserPod = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.032, 0.12), rubberMat);
    laserPod.position.set(0, 0.042, -0.02);
    const lockBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.012, 8), laserMat);
    lockBtn.position.set(0.034, 0.045, 0.01);
    const laserLens = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 8), laserMat);
    laserLens.rotation.x = Math.PI / 2;
    laserLens.position.set(0, 0.042, -0.084);
    const cupL = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.028, 12), rubberMat);
    cupL.rotation.x = Math.PI / 2;
    cupL.position.set(-0.048, 0, 0.11);
    const cupR = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.028, 12), rubberMat);
    cupR.rotation.x = Math.PI / 2;
    cupR.position.set(0.048, 0, 0.11);
    const glassL = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), lensMat);
    glassL.position.set(-0.048, 0, 0.125);
    const glassR = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), lensMat);
    glassR.position.set(0.048, 0, 0.125);

    // Build detailed tactical gloved hands + forearms gripping both sides of the binocular housing
    const buildSideHand = (side) => {
      const hg = new THREE.Group();
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.068, 0.078), gloveMat);
      palm.position.set(side * 0.098, -0.012, 0.018);
      const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.020, 0.072), knuckleMat);
      knuckle.position.set(side * 0.102, 0.016, 0.012);
      // Wrapped fingers around the binocular barrel
      for (let f = 0; f < 3; f++) {
        const finger = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.014, 0.016), gloveMat);
        finger.position.set(side * 0.072, 0.028 - f * 0.018, -0.022 + f * 0.016);
        finger.rotation.z = side * 0.35;
        hg.add(finger);
      }
      // Thumb resting along bottom/rear edge
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.044), skinMat);
      thumb.position.set(side * 0.074, -0.038, 0.038);
      thumb.rotation.y = -side * 0.25;
      // Cuff + cylindrical tactical forearm extending back toward shoulders
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.038, 0.046, 10), cuffMat);
      cuff.rotation.set(Math.PI / 2 - 0.35, 0, side * 0.28);
      cuff.position.set(side * 0.126, -0.042, 0.088);
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.048, 0.34, 10), sleeveMat);
      forearm.rotation.set(Math.PI / 2 - 0.38, 0, side * 0.32);
      forearm.position.set(side * 0.188, -0.120, 0.238);
      hg.add(palm, knuckle, thumb, cuff, forearm);
      return hg;
    };

    const leftHandGrp = buildSideHand(-1);
    const rightHandGrp = buildSideHand(1);

    // Articulated right index finger poised over the top laser-lock button
    const triggerFingerPivot = new THREE.Group();
    triggerFingerPivot.position.set(0.082, 0.032, 0.012);
    const trigSeg = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.015, 0.015), gloveMat);
    trigSeg.position.set(-0.022, 0.012, -0.002);
    trigSeg.rotation.z = -0.25;
    const trigTip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.014, 0.014), skinMat);
    trigTip.position.set(-0.046, 0.016, -0.002);
    triggerFingerPivot.add(trigSeg, trigTip);
    rightHandGrp.add(triggerFingerPivot);

    g.add(barrelL, barrelR, bridge, laserPod, lockBtn, laserLens, cupL, cupR, glassL, glassR, leftHandGrp, rightHandGrp);
    g.userData.triggerFingerPivot = triggerFingerPivot;
    g.userData.lockBtn = lockBtn;
    g.visible = false;
    return g;
  }

  function _createUavPhoneRig() {
    const g = new THREE.Group();
    const caseMat = new THREE.MeshLambertMaterial({ color: 0x262d26 });
    const bumperMat = new THREE.MeshLambertMaterial({ color: 0x151815 });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x2fd678 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xc99c7a });
    const gloveMat = new THREE.MeshLambertMaterial({ color: 0x2c302b });
    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x3b4237 });

    // Rugged military phone held exclusively in the right hand
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.188, 0.022), caseMat);
    const bumperTop = new THREE.Mesh(new THREE.BoxGeometry(0.116, 0.018, 0.026), bumperMat);
    bumperTop.position.y = 0.094;
    const bumperBot = new THREE.Mesh(new THREE.BoxGeometry(0.116, 0.018, 0.026), bumperMat);
    bumperBot.position.y = -0.094;
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.072, 6), bumperMat);
    antenna.position.set(0.036, 0.130, 0);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.090, 0.144), screenMat);
    screen.position.z = 0.012;

    // Right forearm + gloved palm gripping the right/back edge of the phone
    const rForearm = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.28, 0.078), sleeveMat);
    rForearm.position.set(0.055, -0.21, -0.045);
    rForearm.rotation.set(0.32, 0, -0.18);

    const rPalm = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.105, 0.046), gloveMat);
    rPalm.position.set(0.052, -0.045, -0.018);

    // Curled fingers wrapping behind left edge
    const fingersBack = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.088, 0.032), gloveMat);
    fingersBack.position.set(-0.052, -0.030, -0.012);

    // Articulated Right Thumb pivoting from the right edge to tap the screen
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(0.056, -0.035, 0.014);
    const thumbSeg = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.024, 0.022), gloveMat);
    thumbSeg.position.set(-0.024, 0.012, 0.008);
    thumbSeg.rotation.z = -0.35;
    const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.021, 0.020), skinMat);
    thumbTip.position.set(-0.052, 0.022, 0.006);
    thumbPivot.add(thumbSeg, thumbTip);

    g.add(body, bumperTop, bumperBot, antenna, screen, rForearm, rPalm, fingersBack, thumbPivot);
    g.userData.thumbPivot = thumbPivot;
    g.userData.screenMat = screenMat;
    g.visible = false;
    return g;
  }

  function startUavPhoneAnim() {
    if (!viewmodelCamera) return;
    if (designatorActive) setDesignatorActive(false);
    if (!uavPhoneAnim.mesh) {
      uavPhoneAnim.mesh = _createUavPhoneRig();
      viewmodelCamera.add(uavPhoneAnim.mesh);
    }
    uavPhoneAnim.active = true;
    uavPhoneAnim.t = 0;
    uavPhoneAnim.triggered = false;
    uavPhoneAnim.mesh.visible = true;
    // Keep weapon visible — lowered & supported by left hand in forward grip while right hand uses phone!
    ksCooldown = 1.4;
  }

  function setDesignatorActive(active) {
    designatorActive = !!active;
    designatorFireHeld = false;
    designatorAimBlend = 0;
    if (designatorActive && viewmodelCamera && !designatorRig) {
      designatorRig = _createDesignatorRig();
      viewmodelCamera.add(designatorRig);
    }
    if (designatorRig) designatorRig.visible = designatorActive && !player.isThirdPerson;
    const ov = document.getElementById('designator-overlay');
    if (ov) ov.classList.add('hidden');
    const ch = document.getElementById('crosshair');
    if (ch) ch.classList.remove('hidden');
    if (player) {
      player.isUsingDesignator = !!designatorActive;
    }
    if (weaponSystem && weaponSystem.viewmodelGroup) {
      weaponSystem.viewmodelGroup.visible = !designatorActive && !player.isThirdPerson;
    }
    if (!designatorActive && designatorLaserLine && scene) {
      scene.remove(designatorLaserLine);
      designatorLaserLine = null;
    }
    if (!designatorActive && designatorTargetRing && scene) {
      scene.remove(designatorTargetRing);
      designatorTargetRing = null;
    }
    if (designatorActive) {
      player.isFiring = false;
      player.isADS = false;
      ui.showCenterToast('DESIGNATOR EQUIPPED — HOLD [RMB / LT] TO ZOOM 4X', '#ff5252');
    }
  }

  function _deployPrecisionAirstrike(targetPos, opts = {}) {
    const isRemote = !!opts.isRemote;
    const callerName = opts.callerName || null;
    const applyDamage = opts.applyDamage !== undefined ? !!opts.applyDamage : (!isRemote || isMatchHost);
    if (!isRemote) {
      if (!window.DEV_MODE) player.killstreak = null;
      ksCooldown = 2.0;
    }

    const strikeDir = opts.strikeDirOverride
      ? opts.strikeDirOverride.clone().normalize()
      : new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw)).normalize();

    if (!isRemote && mpSession && mpSession.active) {
      mpSession.sendEvent({
        type: 'killstreak',
        evId: `${ui._clientId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: 'airstrike',
        tx: Math.round(targetPos.x * 10) / 10,
        ty: Math.round(targetPos.y * 10) / 10,
        tz: Math.round(targetPos.z * 10) / 10,
        dx: Math.round(strikeDir.x * 1000) / 1000,
        dz: Math.round(strikeDir.z * 1000) / 1000
      });
    }

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

    const jets = [0, 1].map((passIdx) => {
      const mesh = _createFighterJetMesh();
      mesh.visible = false;
      scene.add(mesh);
      const startDelay = 1.4 + passIdx * 1.2;
      const duration = 3.0;
      const bombs = [];
      // 16 rapid-fire 30mm GAU-8 HEI strafing impacts per A-10 Warthog pass!
      const roundCount = 16;
      const perp = new THREE.Vector3(-strikeDir.z, 0, strikeDir.x);
      for (let b = 0; b < roundCount; b++) {
        const frac = b / (roundCount - 1);
        const along = -20 + frac * 42 + (passIdx === 1 ? 2.5 : 0);
        const sideJitter = (Math.random() - 0.5) * 4.2 + (passIdx === 0 ? -1.4 : 1.4);
        const bPos = targetPos.clone()
          .addScaledVector(strikeDir, along)
          .addScaledVector(perp, sideJitter);
        bPos.y = (world && world.getTerrainHeight) ? world.getTerrainHeight(bPos.x, bPos.z) + 0.05 : targetPos.y;
        bombs.push({ pos: bPos, triggerTime: startDelay + 0.65 + b * 0.055, detonated: false });
      }
      return { mesh, startDelay, duration, bombs, passIdx, brrtPlayed: false };
    });

    activeAirstrikes.push({
      targetPos,
      strikeDir,
      beaconGroup,
      jets,
      applyDamage,
      callerName,
      elapsed: 0,
      maxDuration: 6.0
    });

    if (window.soundEngine) {
      if (window.soundEngine.playDesignatorLock) window.soundEngine.playDesignatorLock();
      else if (window.soundEngine.playCookTick) window.soundEngine.playCookTick(true);
    }
    if (isRemote) {
      ui.showCenterToast(`${callerName || 'SQUAD'} PRECISION AIRSTRIKE INBOUND`, '#ff5252');
      ui.addFeedMessage(`${callerName || 'SQUAD'} called in a Precision Airstrike!`, '#ffca28');
    } else {
      ui.showCenterToast('PRECISION AIRSTRIKE INBOUND — 6.0s', '#ff5252');
      ui.addFeedMessage('Precision Airstrike locked on laser designator coordinates!', '#ffca28');
    }
  }

  function activateKillstreak() {
    if (!inRaid || !player || player.isDowned || player.dead || isModalOpen) return false;
    if (ksCooldown > 0) return false;

    if (designatorActive) {
      setDesignatorActive(false);
      return true;
    }

    const ksId = player.killstreak;
    if (!ksId) {
      ui.showCenterToast('NO KILLSTREAK EQUIPPED', '#a0a8a3');
      return false;
    }

    if (ksId === 'ks_uav') {
      if (uavPhoneAnim && uavPhoneAnim.active) return false;
      startUavPhoneAnim();
      return true;
    }

    if (ksId === 'ks_airstrike') {
      setDesignatorActive(true);
      return true;
    }

    return false;
  }

  function updateKillstreaks(dt) {
    if (ksCooldown > 0) ksCooldown = Math.max(0, ksCooldown - dt);

    // 1. One-Handed Right-Hand Rugged Army Phone Raise & Thumb-Tap Animation
    //    Weapon stays visible, lowered and supported by the left hand in a forward grip!
    if (uavPhoneAnim && uavPhoneAnim.active && uavPhoneAnim.mesh) {
      uavPhoneAnim.t += dt;
      const p = Math.min(1, uavPhoneAnim.t / uavPhoneAnim.dur);
      const rig = uavPhoneAnim.mesh;
      const lift = p < 0.28 ? (p / 0.28) : (p > 0.78 ? Math.max(0, (1 - p) / 0.22) : 1);
      // Raised exclusively with the right hand from bottom-right toward eye level
      rig.position.set(0.16 - lift * 0.08, -0.36 + lift * 0.28, -0.37);
      rig.rotation.set(-0.16 * lift, -0.22 * lift, 0.08 * lift);

      // Lower & cant held weapon cleanly on the left-hand forward grip while right hand uses phone
      if (weaponSystem && weaponSystem.viewmodelGroup && !player.isThirdPerson) {
        weaponSystem.viewmodelGroup.visible = true;
        weaponSystem.viewmodelGroup.position.x -= 0.11 * lift;
        weaponSystem.viewmodelGroup.position.y -= 0.19 * lift;
        weaponSystem.viewmodelGroup.position.z += 0.05 * lift;
        weaponSystem.viewmodelGroup.rotation.x -= 0.34 * lift;
        weaponSystem.viewmodelGroup.rotation.y += 0.18 * lift;
        weaponSystem.viewmodelGroup.rotation.z += 0.24 * lift;
      }

      const thumbPivot = rig.userData.thumbPivot;
      if (thumbPivot) {
        const tapP = Math.max(0, Math.min(1, 1 - Math.abs(p - 0.50) / 0.16));
        thumbPivot.rotation.set(tapP * 0.34, -tapP * 0.42, -tapP * 0.22);
        thumbPivot.position.set(0.056 - tapP * 0.012, -0.035 + tapP * 0.014, 0.014 - tapP * 0.008);
      }
      if (!uavPhoneAnim.triggered && p >= 0.48) {
        uavPhoneAnim.triggered = true;
        player.uavTimer = 30.0;
        if (!window.DEV_MODE) player.killstreak = null;
        if (rig.userData.screenMat) rig.userData.screenMat.color.setHex(0x69f0ae);
        if (window.soundEngine && window.soundEngine.playUavPhoneTap) {
          window.soundEngine.playUavPhoneTap();
        }
        if (mpSession && mpSession.active) {
          mpSession.sendEvent({
            type: 'killstreak',
            evId: `${ui._clientId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            kind: 'uav',
            duration: 30.0
          });
        }
        ui.showCenterToast('UAV RECON ONLINE — 30s (150m RADAR)', '#69f0ae');
        ui.addFeedMessage('UAV Recon activated — 150m pulsing radar active on map & minimap (30s)', '#69f0ae');
      }
      if (p >= 1) {
        uavPhoneAnim.active = false;
        rig.visible = false;
      }
    }

    // 1b. Brief designator deploy button-press & lower animation after locking airstrike
    if (designatorDeployAnim.active && designatorRig) {
      designatorDeployAnim.t += dt;
      const dp = Math.min(1, designatorDeployAnim.t / designatorDeployAnim.dur);
      designatorRig.visible = !player.isThirdPerson;
      const press = Math.sin(Math.min(1, dp * 2.4) * Math.PI);
      const lower = dp > 0.35 ? (dp - 0.35) / 0.65 : 0;
      designatorRig.position.set(
        THREE.MathUtils.lerp(0.02, 0.18, lower),
        THREE.MathUtils.lerp(-0.08, -0.44, lower),
        THREE.MathUtils.lerp(-0.28, -0.34, lower)
      );
      designatorRig.rotation.set(
        THREE.MathUtils.lerp(-0.06, -0.45, lower),
        THREE.MathUtils.lerp(-0.06, -0.22, lower),
        0
      );
      if (designatorRig.userData.triggerFingerPivot) {
        designatorRig.userData.triggerFingerPivot.rotation.z = press * 0.32;
      }
      if (dp >= 1) {
        designatorDeployAnim.active = false;
        designatorRig.visible = false;
        if (player) player.isUsingDesignator = false;
      }
    }

    // 2. Binocular Laser Designator (Hip-held with both hands -> Hold RMB/LT or LMB/RT to aim 4x; release LMB/RT to lock & deploy strike!)
    if (designatorActive && player && camera) {
      if (player.isDowned || player.dead || isModalOpen) {
        setDesignatorActive(false);
      } else {
        // Release of Fire (LMB / RT) after holding sets the airstrike target at the exact laser endpoint!
        if (designatorFireHeld && !player.isFiring) {
          const targetPos = _getKillstreakTargetPoint();
          setDesignatorActive(false);
          designatorDeployAnim.active = true;
          designatorDeployAnim.t = 0;
          if (player) player.isUsingDesignator = true;
          _deployPrecisionAirstrike(targetPos);
        } else {
          const aiming = !!(player.isADS || player.isFiring || designatorFireHeld);
          designatorAimBlend = THREE.MathUtils.lerp(designatorAimBlend, aiming ? 1 : 0, Math.min(1, dt * 14));

          // Only zoom when aiming the designator!
          const baseFov = window.BASE_FOV || 75;
          const targetFov = THREE.MathUtils.lerp(baseFov, baseFov / 4, designatorAimBlend);
          camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, dt * 16));
          camera.updateProjectionMatrix();

          // Position 3D binocular rig with both tactical hands & forearms clearly visible
          // When sprinting without aiming: drop designator down to the right side & pump left fist like tactical sprint!
          const fullyAimed = designatorAimBlend > 0.72;
          const desigSprinting = !aiming && (player.isSprinting || player.isTacSprinting);
          if (designatorRig) {
            designatorRig.visible = !player.isThirdPerson && !fullyAimed;
            const tNow = performance.now() * 0.001;
            const stride = desigSprinting ? Math.sin(tNow * 11.5) : 0;
            const strideCos = desigSprinting ? Math.cos(tNow * 11.5) : 0;
            const bob = Math.sin(tNow * 2.8) * 0.005 * (1 - designatorAimBlend);
            const targetX = desigSprinting ? (0.28 + strideCos * 0.018) : THREE.MathUtils.lerp(0.06, 0.0, designatorAimBlend);
            const targetY = desigSprinting ? (-0.27 + Math.abs(stride) * 0.032) : THREE.MathUtils.lerp(-0.15 + bob, -0.02, designatorAimBlend);
            const targetZ = desigSprinting ? (-0.29 + stride * 0.035) : THREE.MathUtils.lerp(-0.34, -0.15, designatorAimBlend);
            const targetRX = desigSprinting ? (-0.52 + stride * 0.14) : THREE.MathUtils.lerp(-0.08, 0, designatorAimBlend);
            const targetRY = desigSprinting ? (-0.34) : THREE.MathUtils.lerp(-0.10, 0, designatorAimBlend);
            const targetRZ = desigSprinting ? (-0.26 + strideCos * 0.08) : 0;
            const lerpD = Math.min(1, dt * 14);
            designatorRig.position.x = THREE.MathUtils.lerp(designatorRig.position.x, targetX, lerpD);
            designatorRig.position.y = THREE.MathUtils.lerp(designatorRig.position.y, targetY, lerpD);
            designatorRig.position.z = THREE.MathUtils.lerp(designatorRig.position.z, targetZ, lerpD);
            designatorRig.rotation.x = THREE.MathUtils.lerp(designatorRig.rotation.x, targetRX, lerpD);
            designatorRig.rotation.y = THREE.MathUtils.lerp(designatorRig.rotation.y, targetRY, lerpD);
            designatorRig.rotation.z = THREE.MathUtils.lerp(designatorRig.rotation.z, targetRZ, lerpD);

            // Pump left fist in tactical sprint rhythm when sprinting with designator!
            if (weaponSystem && weaponSystem.tacFistRig) {
              weaponSystem.tacFistRig.visible = desigSprinting && !player.isThirdPerson;
              if (desigSprinting) {
                weaponSystem.tacFistRig.position.set(-0.28 + strideCos * 0.025, -0.22 + stride * 0.065, -0.34 - stride * 0.085);
                weaponSystem.tacFistRig.rotation.set(-0.35 + stride * 0.25, 0.22, -0.18);
              }
            }
            if (designatorRig.userData.triggerFingerPivot) {
              designatorRig.userData.triggerFingerPivot.rotation.z = designatorFireHeld ? 0.24 : 0;
            }
          }

          const ov = document.getElementById('designator-overlay');
          if (ov) ov.classList.toggle('hidden', !fullyAimed);
          const ch = document.getElementById('crosshair');
          if (ch) ch.classList.toggle('hidden', fullyAimed);

          if (aiming) {
            const targetPt = _getKillstreakTargetPoint();
            const origin = new THREE.Vector3();
            camera.getWorldPosition(origin);
            const startPt = origin.clone().add(new THREE.Vector3(0, -0.08, 0));
            const rangeM = Math.round(origin.distanceTo(targetPt));
            const rangeEl = document.getElementById('desig-range');
            if (rangeEl) rangeEl.textContent = `RANGE: ${rangeM}m`;

            if (!designatorLaserLine && scene) {
              const geo = new THREE.BufferGeometry().setFromPoints([startPt, targetPt]);
              const mat = new THREE.LineBasicMaterial({ color: 0xff3d3d, transparent: true, opacity: 0.78 });
              designatorLaserLine = new THREE.Line(geo, mat);
              scene.add(designatorLaserLine);
            } else if (designatorLaserLine) {
              const posArr = designatorLaserLine.geometry.attributes.position.array;
              posArr[0] = startPt.x; posArr[1] = startPt.y; posArr[2] = startPt.z;
              posArr[3] = targetPt.x; posArr[4] = targetPt.y; posArr[5] = targetPt.z;
              designatorLaserLine.geometry.attributes.position.needsUpdate = true;
            }

            // Live 3D ground/surface target ring at the exact raycast hit point
            if (!designatorTargetRing && scene) {
              const rg = new THREE.Group();
              const outerR = new THREE.Mesh(
                new THREE.RingGeometry(1.4, 1.85, 24),
                new THREE.MeshBasicMaterial({ color: 0xff3d3d, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
              );
              outerR.rotation.x = -Math.PI / 2;
              const centerDot = new THREE.Mesh(
                new THREE.CircleGeometry(0.28, 12),
                new THREE.MeshBasicMaterial({ color: 0xff8a65, side: THREE.DoubleSide })
              );
              centerDot.rotation.x = -Math.PI / 2;
              rg.add(outerR, centerDot);
              designatorTargetRing = rg;
              scene.add(designatorTargetRing);
            }
            if (designatorTargetRing) {
              designatorTargetRing.position.set(targetPt.x, targetPt.y + 0.06, targetPt.z);
              const pulse = 0.92 + Math.sin(performance.now() * 0.012) * 0.10;
              designatorTargetRing.scale.set(pulse, 1, pulse);
            }
          } else {
            if (designatorLaserLine && scene) {
              scene.remove(designatorLaserLine);
              designatorLaserLine = null;
            }
            if (designatorTargetRing && scene) {
              scene.remove(designatorTargetRing);
              designatorTargetRing = null;
            }
          }
        }
      }
    }

    // 2. Active Precision Airstrikes (Beacon + 2 Fighter Jets + Carpet Ordnance)
    for (let i = activeAirstrikes.length - 1; i >= 0; i--) {
      const st = activeAirstrikes[i];
      st.elapsed += dt;

      if (st.beaconGroup) {
        const pulse = 0.45 + 0.35 * Math.sin(st.elapsed * 12);
        st.beaconGroup.children.forEach((ch) => {
          if (ch.material) ch.material.opacity = st.elapsed < 3.6 ? pulse : Math.max(0, 1 - (st.elapsed - 3.6) / 0.8);
        });
        if (st.elapsed >= 4.4) {
          scene.remove(st.beaconGroup);
          st.beaconGroup = null;
        }
      }

      for (const jet of st.jets) {
        const perp = new THREE.Vector3(-st.strikeDir.z, 0, st.strikeDir.x);
        const lateralOff = jet.passIdx === 0 ? -4.2 : 4.2;
        const baseY = st.targetPos.y || 0;
        const evalWarthogPos = (prog) => {
          // Authentic A-10 Warthog diving gun-run arc: dives steep from ~115m -> low pass ~20m -> pulls up into sky ~128m!
          const travel = THREE.MathUtils.lerp(-205, 205, prog);
          const u = (prog - 0.46) / 0.54; // nadir slightly past center as pilot pulls up off target
          const arcAlt = baseY + 20 + jet.passIdx * 4.0 + Math.min(135, u * u * 112);
          const climbDrift = prog > 0.52 ? Math.pow((prog - 0.52) / 0.48, 2) * (jet.passIdx === 0 ? -24 : 24) : 0;
          const pos = st.targetPos.clone()
            .addScaledVector(st.strikeDir, travel)
            .addScaledVector(perp, lateralOff + climbDrift);
          pos.y = arcAlt;
          return pos;
        };

        let jetNoseWorld = null;
        if (st.elapsed >= jet.startDelay && st.elapsed <= jet.startDelay + jet.duration) {
          jet.mesh.visible = true;
          const p = (st.elapsed - jet.startDelay) / jet.duration;
          const jPos = evalWarthogPos(p);
          const nextPos = evalWarthogPos(Math.min(1, p + 0.02));
          jet.mesh.position.copy(jPos);
          jet.mesh.lookAt(nextPos);
          jet.mesh.rotateY(Math.PI); // A-10 nose cannon points along -Z

          // Dramatic bank roll during pull-out climb
          if (p > 0.50) {
            const bank = Math.min(1, (p - 0.50) / 0.35);
            jet.mesh.rotateZ((jet.passIdx === 0 ? -0.58 : 0.58) * bank);
          }

          // Trigger authentic A-10 BRRRT + Doppler flyby sound as the firing dive begins!
          if (!jet.brrtPlayed && p >= 0.16) {
            jet.brrtPlayed = true;
            const d = player ? player.position.distanceTo(st.targetPos) : 35;
            if (window.soundEngine && window.soundEngine.playA10Strafe) {
              window.soundEngine.playA10Strafe(d);
            }
          }

          // Flicker GAU-8 nose muzzle flash cone during active firing window!
          const isFiring = p >= 0.21 && p <= 0.54;
          if (jet.mesh.userData && jet.mesh.userData.muzzleFlash) {
            jet.mesh.userData.muzzleFlash.visible = isFiring && (Math.random() > 0.22);
            if (jet.mesh.userData.muzzleFlash.visible) {
              jet.mesh.userData.muzzleFlash.scale.setScalar(0.85 + Math.random() * 0.45);
            }
          }
          jetNoseWorld = jPos.clone().addScaledVector(st.strikeDir, 6.5);
          jetNoseWorld.y -= 0.8;
        } else {
          jet.mesh.visible = false;
        }

        for (const bomb of jet.bombs) {
          if (!bomb.detonated && st.elapsed >= bomb.triggerTime) {
            bomb.detonated = true;
            if (!jet.passHitSet) jet.passHitSet = new Set();
            _spawnAirstrikeExplosion(bomb.pos, st.applyDamage !== false, st.callerName || null, jetNoseWorld, jet.passIdx, jet.passHitSet);
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
      // 30mm HEI vertical dirt/spark geyser shoots up & dissipates rapidly
      const geyserScaleX = 0.8 + t * 2.2;
      const geyserScaleY = 0.7 + Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5) * 3.4;
      ex.fireMesh.scale.set(geyserScaleX, geyserScaleY, geyserScaleX);
      ex.fireMesh.position.y += dt * 3.2 * (1 - t);
      ex.fireMesh.material.opacity = Math.max(0, 1 - t * 2.2);

      // Rising dark earth/smoke plume
      const smokeScale = 0.9 + t * 4.2;
      ex.smokeMesh.scale.setScalar(smokeScale);
      ex.smokeMesh.position.y += dt * 4.4 * (1 - t * 0.5);
      ex.smokeMesh.material.opacity = Math.max(0, 0.72 * (1 - t));

      // Expanding ground dust shockwave ring
      if (ex.flashMesh) {
        const ringScale = 0.8 + t * 6.8;
        ex.flashMesh.scale.setScalar(ringScale);
        ex.flashMesh.material.opacity = Math.max(0, 0.78 * (1 - t * 1.65));
      }
      if (ex.light) {
        ex.light.intensity = Math.max(0, 5.5 * (1 - t * 2.4));
      }

      if (ex.age >= ex.maxAge) {
        scene.remove(ex.fireMesh);
        scene.remove(ex.smokeMesh);
        if (ex.fireMesh.material) ex.fireMesh.material.dispose();
        if (ex.smokeMesh.material) ex.smokeMesh.material.dispose();
        if (ex.flashMesh) {
          scene.remove(ex.flashMesh);
          if (ex.flashMesh.material) ex.flashMesh.material.dispose();
        }
        if (ex.light) scene.remove(ex.light);
        ksExplosions.splice(i, 1);
      }
    }
  }

  function handleOperatorHitResult(isHead, killed, enemy, attackerInfo = null) {
    if (!enemy) return;
    const wId = (attackerInfo && attackerInfo.weaponId) || (player.getActiveWeaponSlot() && player.getActiveWeaponSlot().id) || '';
    const wName = (attackerInfo && attackerInfo.weaponName) || '';
    const killerName = getPlayerCallsign();

    if (enemy.justBrokeArmor) {
      if (window.soundEngine && window.soundEngine.playArmorBreak) window.soundEngine.playArmorBreak();
      enemy.justBrokeArmor = false;
      raidXp += 25;
      ui.showXpFeedback({ label: 'ARMOR BROKEN', xp: 25, isArmorBreak: true });
    }
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
      if (window.soundEngine && window.soundEngine.playKillConfirm) window.soundEngine.playKillConfirm();
      raidKills += 1;
      if (ui && ui.recordMissionProgress) ui.recordMissionProgress('kills', 1);
      const xp = isHead ? 150 : 100;
      raidXp += xp;
      if (player && player.deadSilenceTimer > 0) {
        player.deadSilenceTimer += 3.0;
        ui.addFeedMessage(`+3s DEAD SILENCE (${Math.ceil(player.deadSilenceTimer)}s)`, '#69f0ae');
      }
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
    ui.triggerHitmarker(isHead, !!(enemy && enemy.lastHitArmor));
    handleOperatorHitResult(isHead, killed, enemy, attackerInfo);
  }

  function performMeleeStrike(isQuick = false) {
    if (!player || player.isDowned || player.dead || player.isRevivingAlly || isModalOpen) return;
    const hit = weaponSystem.tryMeleeSlash(player, world, enemyManager, (isHead, killed, enemy, attackerInfo, dmg) => {
      window.soundEngine.playHitmarker(isHead);
      ui.triggerHitmarker(isHead, !!(enemy && enemy.lastHitArmor));
      handleOperatorHitResult(isHead, killed, enemy, attackerInfo);
      if (enemy && enemy.isRemoteReplicated && mpSession && mpSession.active && typeof enemy.netIdx === 'number') {
        mpSession.sendEvent({
          type: 'enemy_hit',
          enemyIdx: enemy.netIdx,
          dmg: dmg || 55,
          isHead: !!isHead,
          weaponId: (attackerInfo && attackerInfo.weaponId) || 'melee_knife',
          weaponName: (attackerInfo && attackerInfo.weaponName) || 'Melee'
        });
      }
    }, isQuick, squadManager, (isHead, dmg, ally, attackerInfo) => {
      window.soundEngine.playHitmarker(isHead);
      ui.triggerHitmarker(isHead);
      if (ally && ally.mw2Anim) ally.mw2Anim.triggerHitFlinch(Math.random() < 0.5 ? 1 : -1);
      if (ally && ally.isRemoteHuman && mpSession && mpSession.active && ally.clientId) {
        mpSession.sendEvent({
          type: 'pvp_hit',
          hitId: `${ui._clientId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          forcePvp: true,
          targetClientId: ally.clientId,
          dmg: dmg || 55,
          isHead: !!isHead,
          weaponId: (attackerInfo && attackerInfo.weaponId) || 'melee_knife',
          weaponName: (attackerInfo && attackerInfo.weaponName) || 'Melee',
          ax: Math.round(player.position.x * 10) / 10,
          ay: Math.round(player.position.y * 10) / 10,
          az: Math.round(player.position.z * 10) / 10
        });
      } else if (ally && !ally.isRemoteHuman && typeof ally.takeDamage === 'function') {
        ally.takeDamage(dmg || 55, attackerInfo);
      }
    });
    if (hit && gamepad && gamepad.connected) {
      gamepad.rumble(75, 0.45, 0.55);
    }
  }

  function firePlayerWeapon() {
    if (player.isDowned || player.dead || player.isRevivingAlly || player.ledgeState || player.mantleState) return;
    if (uavPhoneAnim && uavPhoneAnim.active) return;
    if (designatorActive) {
      // Holding Fire (LMB / RT) aims the designator; releasing Fire sets the airstrike location!
      designatorFireHeld = true;
      return;
    }
    if (player.activeSlot === 'melee') {
      performMeleeStrike(false);
      return;
    }
    const slotObj = player.getActiveWeaponSlot();
    if (!slotObj) {
      // Empty weapon slot -> bare fists punch!
      performMeleeStrike(false);
      return;
    }
    const fired = weaponSystem.tryFire(player, slotObj, world, enemyManager, (isHead, killed, enemy, attackerInfo, dmg) => {
      window.soundEngine.playHitmarker(isHead);
      ui.triggerHitmarker(isHead, !!(enemy && enemy.lastHitArmor));
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
      if (ally && ally.mw2Anim) ally.mw2Anim.triggerHitFlinch(Math.random() < 0.5 ? 1 : -1);
      if (ally && ally.isRemoteHuman && mpSession && mpSession.active && ally.clientId) {
        mpSession.sendEvent({
          type: 'pvp_hit',
          hitId: `${ui._clientId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          forcePvp: true,
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
      if (!player.invisible) {
        enemyManager.alertNearby(player.position, (wDef && wDef.suppressed) ? 12 : 26);
      }
      if (mpSession && mpSession.active && camera) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const endPt = player.position.clone().addScaledVector(dir, 45);
        mpSession.sendEvent({
          type: 'shot',
          weaponId: (wDef && wDef.id) || 'ak74m',
          suppressed: !!(wDef && wDef.suppressed),
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
      player.beingDragged = false;
      player._remoteReviveExpire = 0;
    }
    // Self-Revive Kit FIRST, then Tourniquet (only if NOT already wounded from a prior tourniquet!):
    if (player && player.isDowned && !player.dead) {
      const canSelfRevive = !player.beingRevivedBy || player.beingRevivedBy === 'SELF-REVIVE' || player.beingRevivedBy === 'TOURNIQUET';
      const holdingInteract = !isModalOpen && !(devConsole && devConsole.isOpen) && !!(player.keys[interactKey] || player.padReviveHeld);
      if (player.selfRevive && holdingInteract && canSelfRevive) {
        if (!player._selfReviveSfx) {
          player._selfReviveSfx = true;
          if (window.soundEngine && window.soundEngine.playReviveStart) {
            try { window.soundEngine.playReviveStart(); } catch (e) {}
          }
        }
        player.beingRevivedBy = 'SELF-REVIVE';
        player.reviveProgress = Math.min(1, (player.reviveProgress || 0) + dt / 4.5);
        if (player.reviveProgress >= 1) {
          player._selfReviveSfx = false;
          player.selfRevive = null;
          player.revive(45);
          if (window.soundEngine && window.soundEngine.playReviveComplete) {
            try { window.soundEngine.playReviveComplete(); } catch (e) {}
          }
          if (mpSession && mpSession.active && mpSession.sendStateNow) mpSession.sendStateNow(player);
          ui.showCenterToast('SELF-REVIVE COMPLETE', '#69f0ae');
          ui.addFeedMessage('Used Self-Revive Kit', '#69f0ae');
        }
      } else if (!player.selfRevive && holdingInteract && canSelfRevive && (player.disabledHp || 0) <= 0) {
        if (!player._selfReviveSfx) {
          player._selfReviveSfx = true;
          if (window.soundEngine && window.soundEngine.playReviveStart) {
            try { window.soundEngine.playReviveStart(); } catch (e) {}
          }
        }
        player.beingRevivedBy = 'TOURNIQUET';
        player.reviveProgress = Math.min(1, (player.reviveProgress || 0) + dt / 2.6);
        if (player.reviveProgress >= 1) {
          player._selfReviveSfx = false;
          player.applyTourniquet();
          if (window.soundEngine && window.soundEngine.playReviveComplete) {
            try { window.soundEngine.playReviveComplete(); } catch (e) {}
          }
          if (mpSession && mpSession.active && mpSession.sendStateNow) mpSession.sendStateNow(player);
          ui.showCenterToast('TOURNIQUET APPLIED — WOUNDED (-25 MAX HP)', '#ffca28');
          ui.addFeedMessage('Applied Tourniquet (-25 Max HP) — Cannot tourniquet again while wounded (Heal with Medkit)', '#ffca28');
        }
      } else if (player.beingRevivedBy === 'SELF-REVIVE' || player.beingRevivedBy === 'TOURNIQUET') {
        player.beingRevivedBy = null;
        player._selfReviveSfx = false;
      }
      ui.updateReviveBanner(player, null, false);
      return;
    }

    const holdingRevive = !!(player && !player.isDowned && !player.dead && !isModalOpen && !(devConsole && devConsole.isOpen) && (player.keys[interactKey] || player.padReviveHeld));
    const candidate = activeReviveAlly || findRevivableAlly();

    if (holdingRevive && candidate && (candidate.isDowned || candidate.dead)) {
      const d = Math.hypot(player.position.x - candidate.position.x, player.position.z - candidate.position.z);
      if (d <= 3.6) {
        activeReviveAlly = candidate;
        if (!candidate._reviveSfx) {
          candidate._reviveSfx = true;
          if (window.soundEngine && window.soundEngine.playReviveStart) {
            try { window.soundEngine.playReviveStart(); } catch (e) {}
          }
        }
        player.isRevivingAlly = true;
        player.isDraggingAlly = !!candidate.isDowned;
        candidate.beingRevivedBy = getPlayerCallsign();

        // Downed revive = 3.5s, Eliminated (dead) revive = 7.5s (slower)
        const dur = candidate.dead ? 7.5 : 3.5;
        candidate.reviveProgress = Math.min(1, (candidate.reviveProgress || 0) + dt / dur);
        player.allyReviveProgress = candidate.reviveProgress;

        // Parent/lock DOWNED ally directly to the reviver's local drag slot with their BACK towards the reviver!
        const moving = Math.hypot(player.velocity.x, player.velocity.z) > 0.20;
        let dragX = candidate.position.x;
        let dragZ = candidate.position.z;
        let dragYaw = player.yaw;
        if (candidate.isDowned) {
          const sinY = Math.sin(player.yaw);
          const cosY = Math.cos(player.yaw);
          dragX = player.position.x - sinY * 1.05;
          dragZ = player.position.z - cosY * 1.05;
          const gy = (world && world.getTerrainHeight) ? world.getTerrainHeight(dragX, dragZ) : 0;
          candidate.position.set(dragX, gy, dragZ);
          if (candidate.group) {
            candidate.group.position.set(dragX, gy - 0.56, dragZ);
            // Turn downed ally with their BACK toward the reviver (facing away from reviver!)
            candidate.group.rotation.y = Math.atan2(dragX - player.position.x, dragZ - player.position.z);
          }
          if (candidate._remoteTargetPos) {
            candidate._remoteTargetPos.set(dragX, gy, dragZ);
          }
          dragYaw = player.yaw;
        }

        // Notify remote human teammate of active revive progress & parented drag position (~12Hz)
        const nowMs = performance.now();
        if (candidate.isRemoteHuman && mpSession && mpSession.active && candidate.clientId && (nowMs - _lastRemoteRevivePing > 80)) {
          _lastRemoteRevivePing = nowMs;
          mpSession.sendEvent({
            type: 'revive_progress',
            targetClientId: candidate.clientId,
            progress: Math.round(candidate.reviveProgress * 100) / 100,
            reviverName: getPlayerCallsign(),
            dx: candidate.isDowned ? Math.round(dragX * 100) / 100 : undefined,
            dz: candidate.isDowned ? Math.round(dragZ * 100) / 100 : undefined,
            dyaw: candidate.isDowned ? Math.round(dragYaw * 1000) / 1000 : undefined
          });
        }

        if (candidate.reviveProgress >= 1) {
          candidate._reviveSfx = false;
          candidate.revive(45);
          if (window.soundEngine && window.soundEngine.playReviveComplete) {
            try { window.soundEngine.playReviveComplete(); } catch (e) {}
          }
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
          player.allyReviveProgress = 0;
        }
        ui.updateReviveBanner(player, activeReviveAlly, !!(activeReviveAlly && activeReviveAlly.isDowned && moving));
        return;
      }
    }

    if (activeReviveAlly) {
      activeReviveAlly._reviveSfx = false;
      if (activeReviveAlly.beingRevivedBy === getPlayerCallsign()) {
        activeReviveAlly.beingRevivedBy = null;
      }
      activeReviveAlly = null;
    }
    if (player) {
      player.isRevivingAlly = false;
      player.isDraggingAlly = false;
      player.allyReviveProgress = 0;
    }
    ui.updateReviveBanner(player, null, false);
  }

  let spectateAllyIdx = 0;
  let lastSpectatedAlly = null;
  let lastSpectatedWeaponId = null;

  function updateSpectatorCamera() {
    const specBanner = document.getElementById('spectate-banner');
    if (!inRaid || !player || !player.dead || !squadManager || !squadManager.allies) {
      if (lastSpectatedAlly && lastSpectatedAlly.group) {
        lastSpectatedAlly.group.visible = true;
      }
      if (lastSpectatedWeaponId !== null && player && player._syncActiveViewmodel) {
        lastSpectatedWeaponId = null;
        player._syncActiveViewmodel();
      }
      lastSpectatedAlly = null;
      if (player) player.spectatingAlly = null;
      if (specBanner) specBanner.classList.add('hidden');
      return;
    }

    // Prefer living human teammates first, then living AI squadmates
    const aliveAllies = squadManager.allies.filter(a => a && !a.dead && !a.extracted);
    if (aliveAllies.length === 0) {
      if (lastSpectatedAlly && lastSpectatedAlly.group) lastSpectatedAlly.group.visible = true;
      lastSpectatedAlly = null;
      player.spectatingAlly = null;
      if (specBanner) specBanner.classList.add('hidden');
      return;
    }

    const spec = aliveAllies[spectateAllyIdx % aliveAllies.length];
    if (lastSpectatedAlly && lastSpectatedAlly !== spec && lastSpectatedAlly.group) {
      lastSpectatedAlly.group.visible = true;
    }
    lastSpectatedAlly = spec;
    player.spectatingAlly = spec;
    // Hide the spectated ally's 3D body locally so our first-person eye camera never clips inside their head!
    if (spec.group) spec.group.visible = false;

    const st = spec._remoteStance || (spec.isDowned ? 'downed' : 'stand');
    const eyeH = st === 'prone' ? 0.55 : (st === 'downed' ? 0.72 : (st === 'slide' ? 0.78 : (st === 'crouch' ? 1.12 : 1.66)));
    const camYaw = (spec.group ? spec.group.rotation.y : 0) + Math.PI;
    const camPitch = THREE.MathUtils.clamp(spec._remotePitch || 0, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);

    camera.position.set(spec.position.x, spec.position.y + eyeH, spec.position.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(camPitch, camYaw, 0);

    // Show the spectated ally's equipped 1st-person weapon viewmodel!
    if (weaponSystem && weaponSystem.viewmodelGroup) {
      const specWpnId = spec.weaponId || 'ak74m';
      if (specWpnId !== lastSpectatedWeaponId) {
        lastSpectatedWeaponId = specWpnId;
        const wDef = GAME_DATA.ITEMS[specWpnId] || GAME_DATA.ITEMS.ak74m;
        if (wDef && weaponSystem.buildViewmodel) {
          weaponSystem.buildViewmodel(wDef, {}, true);
        }
      }
      weaponSystem.viewmodelGroup.visible = !spec.isDowned;
      const isAds = !!spec._remoteAds;
      const bob = Math.sin(performance.now() * 0.004) * 0.004;
      weaponSystem.viewmodelGroup.position.set(
        isAds ? 0.0 : 0.21,
        isAds ? -(weaponSystem.sightHeight || 0.05) : (-0.20 + bob),
        isAds ? (weaponSystem.adsZ || -0.24) : -0.42
      );
      weaponSystem.viewmodelGroup.rotation.set(0, 0, 0);
    }
    if (specBanner) {
      const switchHint = aliveAllies.length > 1 ? ' · [LMB / SPACE] SWITCH' : '';
      specBanner.textContent = `SPECTATING: ${spec.name} (${Math.ceil(spec.hp || 0)} HP)${switchHint}`;
      specBanner.classList.remove('hidden');
    }
  }

  function hasInteractLineOfSight(targetPos, ignoreMeshRoot = null) {
    const eye = player.position;
    const toTarget = targetPos.clone().sub(eye);
    const dist = toTarget.length();
    if (dist < 0.35) return true;
    const dir = toTarget.divideScalar(dist);
    const ray = new THREE.Raycaster(eye, dir, 0.15, Math.max(0.16, dist - 0.32));
    const hits = ray.intersectObjects((world.wallMeshes && world.wallMeshes.length > 0) ? world.wallMeshes : world.shootableMeshes, false);
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
      const isGp = window._lastInputMode === 'gamepad';
      const revBind = (window.GAMEPAD_BINDS && window.GAMEPAD_BINDS.revive != null) ? window.GAMEPAD_BINDS.revive : 2;
      const revBtn = isGp
        ? `[${ui && ui._formatGamepadButton ? ui._formatGamepadButton(revBind) : 'X / Square'}]`
        : `[${ui && ui._formatKeyCode ? ui._formatKeyCode((window.KEYBINDS && window.KEYBINDS.interact) || 'KeyE') : 'E'}]`;
      textEl.textContent = revAlly.dead
        ? `Hold ${revBtn} Revive Fallen ${revAlly.name} (Slow)`
        : `Hold ${revBtn} Revive ${revAlly.name} (Move to Drag)`;
      promptEl.classList.remove('hidden');
      return;
    }

    let bestDist = 3.2;
    if (world && world.munitionBoxes && world.munitionBoxes.length > 0) {
      const feetY = player.position.y - player.currentEyeHeight;
      for (let i = 0; i < world.munitionBoxes.length; i++) {
        const mb = world.munitionBoxes[i];
        if (!mb || (mb.usedBy && mb.usedBy.has('player'))) continue;
        if (Math.abs(feetY - mb.position.y) > 2.2) continue;
        const d = Math.hypot(player.position.x - mb.position.x, player.position.z - mb.position.z);
        if (d < 2.8 && d < bestDist) {
          bestDist = d;
          nearbyInteractable = { type: 'munition_box', box: mb, label: 'RESUPPLY — MUNITION BOX' };
        }
      }
    }
    if (world && world.doors) {
      const feetY = player.position.y - player.currentEyeHeight;
      for (let i = 0; i < world.doors.length; i++) {
        const door = world.doors[i];
        if (Math.abs(feetY - door.hingePos.y) > 2.2) continue;
        const d = Math.hypot(player.position.x - door.center.x, player.position.z - door.center.z);
        if (d < 2.85 && d < bestDist) {
          bestDist = d;
          const verb = (door.state === 'open' || door.state === 'peek')
            ? 'CLOSE'
            : (player.isADS ? 'PEEK' : 'OPEN');
          nearbyInteractable = { type: 'door', door, label: `${verb} ${door.label.toUpperCase()}` };
        }
      }
    }
    for (const c of world.lootContainers) {
      const d = player.position.distanceTo(c.position);
      if (d < bestDist && hasInteractLineOfSight(c.position, c.mesh)) {
        bestDist = d;
        nearbyInteractable = { type: 'crate', label: c.name, items: c.items, container: c };
      }
    }

    // Only Operator corpses are lootable (non-operators drop their gear physically & despawn after 60s)
    for (let eIdx = 0; eIdx < enemyManager.enemies.length; eIdx++) {
      const e = enemyManager.enemies[eIdx];
      if (!e || !e.dead || !e.isOperator) continue;
      const d = Math.hypot(player.position.x - e.position.x, player.position.z - e.position.z);
      const corpseY = (world && world.getTerrainHeight)
        ? Math.max(e.position.y, world.getTerrainHeight(e.position.x, e.position.z)) + 0.52
        : (e.position.y + 0.52);
      const corpsePos = new THREE.Vector3(e.position.x, corpseY, e.position.z);
      if (d < bestDist && hasInteractLineOfSight(corpsePos)) {
        bestDist = d;
        nearbyInteractable = {
          type: 'corpse',
          corpseId: 'corpse_' + eIdx,
          label: `${e.name} (Operator)`,
          items: e.lootItems,
          operatorEquipment: e.operatorEquipment || null,
          worldPos: corpsePos
        };
      }
    }

    // Physical loose loot & dropped items on the ground
    const gItems = world.groundItems || [];
    for (let i = gItems.length - 1; i >= 0; i--) {
      const gi = gItems[i];
      if (!gi) continue;
      const d = Math.hypot(player.position.x - gi.position.x, player.position.z - gi.position.z);
      const giPos = new THREE.Vector3(gi.position.x, Math.max(0.25, gi.position.y + 0.15), gi.position.z);
      const def = GAME_DATA.ITEMS[gi.id];

      // Auto-fill ground grenades (lethal / tactical) directly into active grenade slot when approaching with space!
      if (!player.dead && !player.isDowned && def && (def.type === 'lethal' || def.type === 'tactical') && d < 1.95 && hasInteractLineOfSight(giPos)) {
        const slotKey = def.type;
        const qtyKey = def.type === 'lethal' ? 'lethalQty' : 'tacticalQty';
        const lastKey = def.type === 'lethal' ? 'lastEquippedLethal' : 'lastEquippedTactical';
        const curId = player[slotKey];
        const curQty = player[qtyKey] || 0;
        const hasSpace = (!curId || curQty <= 0) || (curId === gi.id && curQty < 2);
        if (hasSpace) {
          const room = (!curId || curQty <= 0) ? 2 : (2 - curQty);
          const take = Math.min(gi.qty || 1, room);
          if (take > 0) {
            player[slotKey] = gi.id;
            player[lastKey] = gi.id;
            player[qtyKey] = (!curId || curQty <= 0) ? take : (curQty + take);
            gi.qty = (gi.qty || 1) - take;
            if (window.soundEngine && window.soundEngine.playClick) {
              try { window.soundEngine.playClick(); } catch (e) {}
            }
            ui.addFeedMessage(`+${take} ${def.name} (Active Slot)`, '#69f0ae');
            if (gi.qty <= 0) {
              const pickedUid = gi.uid;
              world.removeGroundItem(gi);
              if (mpSession && mpSession.active && pickedUid) {
                mpSession.sendEvent({ type: 'ground_pickup', uid: pickedUid });
              }
              continue;
            }
          }
        }
      }

      if (d < bestDist && d < 2.9 && hasInteractLineOfSight(giPos)) {
        bestDist = d;
        const qtyTag = gi.qty > 1 ? ` x${gi.qty}` : '';
        nearbyInteractable = { type: 'ground', label: `${def ? def.name : gi.id}${qtyTag}`, groundItem: gi };
      }
    }

    if (nearbyInteractable) {
      if (nearbyInteractable.type === 'munition_box') {
        textEl.textContent = `[E] ${nearbyInteractable.label}`;
      } else if (nearbyInteractable.type === 'door') {
        textEl.textContent = `[E] ${nearbyInteractable.label}`;
      } else if (nearbyInteractable.type === 'ground') {
        const gw = _getLookedAtGroundWeapon();
        if (gw) {
          const canStow = !!(player && player.hasWeaponBackpack && player.hasWeaponBackpack());
          if (tabStowHoldStart > 0 && canStow) {
            const pct = Math.min(100, Math.round(((performance.now() - tabStowHoldStart) / 320) * 100));
            textEl.textContent = `Stowing ${nearbyInteractable.label} in Pack (${pct}%)`;
          } else {
            textEl.textContent = canStow
              ? `[E] Swap ${nearbyInteractable.label}  ·  Hold [TAB / ↓] Stow in Pack`
              : `[E] Equip / Swap ${nearbyInteractable.label}`;
          }
        } else {
          textEl.textContent = `Pick up ${nearbyInteractable.label}`;
        }
      } else {
        const c = nearbyInteractable.container;
        const locked = c && c.requiresKey && !c.unlocked;
        const isOpened = !!(c && (c.opened || (c.lid && c.lid.opened)));
        const isEmpty = isOpened && (!nearbyInteractable.items || nearbyInteractable.items.length === 0);
        textEl.textContent = locked
          ? `Unlock ${nearbyInteractable.label} [BOSS KEY]`
          : (isEmpty
            ? `Open ${nearbyInteractable.label} [EMPTY]`
            : (isOpened ? `Open ${nearbyInteractable.label} [OPENED]` : `Search ${nearbyInteractable.label}`));
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
        ? (padPaused && !isModalOpen && !ui.isTacMapOpen)
        : (document.pointerLockElement !== canvas && !isModalOpen && !ui.isTacMapOpen);

      gamepad.update(dt, {
        player,
        weaponSystem,
        throwableSystem,
        enemyManager,
        squadManager,
        gunsmith,
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
          canStowGroundWeapon: () => !!(_getLookedAtGroundWeapon() && player && player.hasWeaponBackpack && player.hasWeaponBackpack()),
          stowGroundWeapon: () => {
            const gw = _getLookedAtGroundWeapon();
            if (gw) _pickupGroundWeapon(gw, 'backpackWeapon');
          },
          toggleTacMap: (forceState = null) => {
            if (!isModalOpen) toggleFullMapMode(forceState);
          },
          closeModal: () => closeLootAndResume(),
          fire: () => firePlayerWeapon(),
          onThrowableHit,
          hasRevivableAlly: () => !!findRevivableAlly(),
          interact: () => openNearbyInteractable(),
          activateFieldUpgrade: () => {
            const fuMsg = player.activateFieldUpgrade ? player.activateFieldUpgrade() : null;
            if (fuMsg) {
              ui.addFeedMessage(fuMsg, '#69f0ae');
              if (mpSession && mpSession.active && player._lastFieldUpgradeDeploy) {
                mpSession.sendEvent({
                  type: 'field_upgrade',
                  evId: `${ui._clientId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  ...player._lastFieldUpgradeDeploy
                });
              }
            }
          },
          activateKillstreak: () => activateKillstreak(),
          quickMelee: () => performMeleeStrike(true)
        }
      });

      if (!isPaused) {
        gamepad.clearMenuFocus();
      }

      // Keep client-side simulation, gravity, physics & animations running even while in-game menu is open!
      player.isMenuBlocked = !!(isPaused || isModalOpen || ui.isTacMapOpen);
      player.isInventoryOpen = !!isModalOpen;
      if (isPaused) {
        player.isFiring = false;
        player.isADS = false;
      }

      {
        // Real-time wall-clock raid timer (never slows on low FPS, pause, or open menus!)
        const nowWallMs = Date.now();
        raidElapsed = Math.max(0, (nowWallMs - raidStartTimestamp) / 1000);
        raidTimeLeft = Math.max(0, (raidEndTimestamp - nowWallMs) / 1000);
        if (raidTimeLeft <= 0) {
          endRaid(false);
          return;
        }

        // Auto-fire if holding LMB with automatic weapon
        const wDef = player.getActiveWeaponDef();
        if (player.isFiring && wDef && wDef.auto && !isPaused && !isModalOpen && !ui.isTacMapOpen) {
          firePlayerWeapon();
        }

        player.update(dt);
        if (mpSession && mpSession.active) {
          mpSession.update(dt, player);
          if (squadManager) squadManager.syncRemotePlayers(mpSession);
          if (isMatchHost && enemyManager) {
            mpSession.sendEnemiesSync(dt, enemyManager, true, raidTimeLeft);
          }
        }
        weaponSystem.update(dt, player, wDef);
        if (throwableSystem) {
          throwableSystem.update(dt, player, weaponSystem, enemyManager, onThrowableHit, null);
        }
        world.update(dt, now / 1000, player.position);
        // Keep directional sun shadow frustum centered on player (snapped every 2m to reduce shadow shimmer & matrix work)
        if (sunLight && sunLight.castShadow && player) {
          const sx = Math.round(player.position.x * 0.5) * 2;
          const sz = Math.round(player.position.z * 0.5) * 2;
          if (sunLight._lastSnapX !== sx || sunLight._lastSnapZ !== sz) {
            sunLight._lastSnapX = sx;
            sunLight._lastSnapZ = sz;
            sunLight.position.set(sx + 140, 210, sz + 105);
            sunLight.target.position.set(sx, 0, sz);
            sunLight.target.updateMatrixWorld();
          }
        }

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
            if (ui && ui.recordMissionProgress) ui.recordMissionProgress('kills', 1);
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
            if (ui && ui.recordMissionProgress) ui.recordMissionProgress('kills', 1);
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
              if (action === 'eliminated') {
                raidKills += 1;
                if (ui && ui.recordMissionProgress) ui.recordMissionProgress('kills', 1);
              }
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
        updateSpectatorCamera();
        updateKillstreaks(dt);
        updateRedZone(dt);
        updatePings(dt);
        if (tabStowHoldStart > 0 && !tabStowTriggered && !isModalOpen) {
          const gw = _getLookedAtGroundWeapon();
          if (!gw || !(player && player.hasWeaponBackpack && player.hasWeaponBackpack())) {
            tabStowHoldStart = 0;
          } else if (performance.now() - tabStowHoldStart >= 320) {
            tabStowTriggered = true;
            tabStowHoldStart = 0;
            _pickupGroundWeapon(gw, 'backpackWeapon');
          }
        }
        if (world && world.updateDoors) {
          world.updateDoors(dt, player, weaponSystem);
        }
        if (!window._lastInteractCheckMs || now - window._lastInteractCheckMs >= 55) {
          window._lastInteractCheckMs = now;
          checkInteractions();
        }
        if (!window._lastPlatePromptMs || now - window._lastPlatePromptMs >= 150) {
          window._lastPlatePromptMs = now;
          const ppEl = document.getElementById('plate-prompt');
          if (ppEl && player) {
            const hasBagPlate = Array.isArray(player.backpack) && player.backpack.some(it => it && it.id === 'armor_plate' && (it.qty || 0) > 0);
            const hasPlate = (player.plates || 0) > 0 || hasBagPlate;
            const needsPlate = (player.maxArmor || 0) > 0 && (player.armor || 0) < player.maxArmor;
            const busyPlating = !!(weaponSystem && weaponSystem.isPlating);
            const showPlate = hasPlate && needsPlate && !busyPlating && !player.dead && !player.isDowned && !player.isMenuBlocked;
            ppEl.classList.toggle('hidden', !showPlate);
            if (showPlate) {
              const keySpan = ppEl.querySelector('.pp-key');
              if (keySpan) {
                const isGp = window._lastInputMode === 'gamepad';
                const plateBind = (window.KEYBINDS && window.KEYBINDS.plates) || 'KeyG';
                keySpan.textContent = isGp ? 'Y' : (ui && ui._formatKeyCode ? ui._formatKeyCode(plateBind) : 'G');
              }
              const iconImg = ppEl.querySelector('.pp-icon');
              if (iconImg && window.itemIcons && window.itemIcons.getIcon) {
                const plateUrl = window.itemIcons.getIcon('armor_plate');
                if (plateUrl && iconImg.src !== plateUrl) iconImg.src = plateUrl;
              }
            }
          }
        }
        checkExtraction(dt);
        ui.updateSearchReveal(dt);
        if (isModalOpen && ui.activeLootSource && ui.positionContainerPanel) {
          ui.positionContainerPanel(camera);
        }
        // When spectating a living ally, mirror their HUD (HP, armor, weapon, compass, minimap) while keeping pings & revive symbols live!
        let hudSubject = player;
        if (player && player.dead && player.spectatingAlly) {
          const spec = player.spectatingAlly;
          const wDefSpec = GAME_DATA.ITEMS[spec.weaponId || 'ak74m'] || GAME_DATA.ITEMS.ak74m;
          const specSlot = { id: wDefSpec.id, mag: (typeof spec._remoteMag === 'number') ? spec._remoteMag : (wDefSpec.magSize || 30), mods: {} };
          hudSubject = Object.assign(Object.create(Object.getPrototypeOf(player)), player, {
            hp: spec.hp ?? 100,
            maxHp: spec.maxHp ?? 100,
            armor: spec.armor ?? 0,
            maxArmor: spec.maxArmor ?? 100,
            plateSlots: Math.max(1, Math.ceil((spec.maxArmor || 100) / 50)),
            position: spec.position,
            yaw: (spec.group ? spec.group.rotation.y : 0) + Math.PI,
            pitch: spec._remotePitch || 0,
            stance: spec._remoteStance || 'stand',
            isDowned: !!spec.isDowned,
            dead: false,
            isADS: !!spec._remoteAds,
            isTacSprinting: !!spec._remoteTacSprint,
            getActiveWeaponDef: () => wDefSpec,
            getActiveWeaponSlot: () => specSlot,
            getReserveAmmo: () => wDefSpec.magSize ? wDefSpec.magSize * 2 : 0
          });
        }
        ui.updateHUD(hudSubject, world, raidTimeLeft, weaponSystem, throwableSystem, enemyManager, squadManager, raidXp);
      }
      // Sync viewmodel camera to world camera & render in two passes (clearDepth prevents all wall clipping!)
      if (viewmodelCamera) {
        viewmodelCamera.position.copy(camera.position);
        viewmodelCamera.quaternion.copy(camera.quaternion);
        let targetVmFov = camera.fov;
        if (window.WEAPON_FOV_MODE === 'independent') {
          const vmBase = window.VIEWMODEL_FOV || 75;
          const activeDef = (player && player.getActiveWeaponDef) ? player.getActiveWeaponDef() : null;
          const hasMagScope = !!(activeDef && (activeDef.adsZoom || 1) >= 2.0);
          if (hasMagScope) {
            // Magnified scopes zoom proportionally with the optic in Independent mode too so the scope never shrinks tiny!
            const bf = window.BASE_FOV || 75;
            const liveZoom = Math.max(
              1.0,
              Math.tan(THREE.MathUtils.degToRad(bf * 0.5)) / Math.max(0.04, Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)))
            );
            targetVmFov = (window.GAME_DATA && window.GAME_DATA.computeAdsFov)
              ? window.GAME_DATA.computeAdsFov(vmBase, liveZoom)
              : (vmBase / liveZoom);
          } else {
            targetVmFov = vmBase;
          }
        }
        // MW4 Weapon Field of View Scale (Narrow / Default / Wide): widens or tightens hipfire weapon perspective without altering magnified scope zoom!
        const wfovDelta = window.WEAPON_FOV_SCALE === 'wide' ? 8 : (window.WEAPON_FOV_SCALE === 'narrow' ? -6 : 0);
        if (wfovDelta !== 0) {
          const hipWeight = 1 - (weaponSystem ? (weaponSystem._adsBlend || 0) : 0);
          targetVmFov = THREE.MathUtils.clamp(targetVmFov + wfovDelta * hipWeight, 12, 128);
        }
        if (Math.abs(viewmodelCamera.fov - targetVmFov) > 0.01) {
          viewmodelCamera.fov = targetVmFov;
          viewmodelCamera.updateProjectionMatrix();
        }
        viewmodelCamera.updateMatrixWorld();
      }
      if (window.RigRegistry && window.RigRegistry.syncAll) {
        window.RigRegistry.syncAll(dt, camera);
      }
      if (weaponSystem && weaponSystem.fpArms) weaponSystem.fpArms.update(dt);

      renderer.shadowMap.needsUpdate = ((window._shadowFrameCount = ((window._shadowFrameCount || 0) + 1) % 3) === 0);
      if (window.renderPipeline) {
        window.renderPipeline.begin();
        window.renderPipeline.render(scene, camera, false);
        if (viewmodelScene && viewmodelCamera && !player.isThirdPerson) {
          window.renderPipeline.render(viewmodelScene, viewmodelCamera, true);
        }
        window.renderPipeline.end();
      } else {
        renderer.autoClear = false;
        renderer.clear();
        renderer.render(scene, camera);
        if (viewmodelScene && viewmodelCamera && !player.isThirdPerson) {
          renderer.clearDepth();
          renderer.render(viewmodelScene, viewmodelCamera);
        }
      }
    } else {
      // Update 3D Matchmaking Operator Stage + countdown if active
      if (matchmaking && matchmaking.active) {
        matchmaking.update(dt);
      } else if (hideoutBunker && !(gunsmith && gunsmith.isOpen)) {
        hideoutBunker.update(dt, renderer);
      }
      // Broadcast live FOB position to party members (10Hz while roaming, 1Hz while in FOB menus)
      if (hideoutBunker && ui && ui._sendSocialPacket && ui.partyMembers && ui.partyMembers.length > 1) {
        const nowMs = performance.now();
        const intervalMs = hideoutBunker.activeRoam ? 100 : 1000;
        if (nowMs - _lastFobPosBroadcast >= intervalMs) {
          _lastFobPosBroadcast = nowMs;
          const selfM = ui.partyMembers.find(m => m.isSelf || m.clientId === ui._clientId);
          const tabStatus = hideoutBunker.activeRoam
            ? ''
            : ((selfM && selfM.ready) ? 'READY' : ((ui.activeMenuTab && ui.activeMenuTab !== 'home') ? ui.activeMenuTab.toUpperCase() : 'TAC-MENU'));
          ui._sendSocialPacket({
            type: 'fob_pos',
            clientId: ui._clientId,
            from: getPlayerCallsign(),
            partyId: ui.partyId || null,
            squadColor: (selfM && selfM.squadColor) || '#69f0ae',
            isLeader: !!(ui.isPartyLeader && ui.isPartyLeader()),
            status: tabStatus,
            x: Math.round(hideoutBunker.pos.x * 100) / 100,
            y: Math.round(hideoutBunker.pos.y * 100) / 100,
            z: Math.round(hideoutBunker.pos.z * 100) / 100,
            yaw: Math.round(hideoutBunker.yaw * 1000) / 1000
          });
        }
      }
      // Enable full controller navigation in Main Menu, Stash, Operator, Settings, Gunsmith & Summary screens!
      if (hideoutBunker && hideoutBunker.activeRoam) {
        gamepad.updateHideoutRoam(dt, hideoutBunker, {
          onOpenMenu: () => exitHideoutRoam(true),
          onInteractStation: (st) => openFobStation(st)
        });
      } else {
        gamepad.updateMenu(dt, { ui, gunsmith });
      }
    }
  }

  requestAnimationFrame(animate);
})();
