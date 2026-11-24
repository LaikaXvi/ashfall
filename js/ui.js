// Hideout Persistence, Trader, Stash, Loadout, In-Raid HUD & Loot Modals
const _savedUserSettings = (() => {
  try {
    const raw = localStorage.getItem('ashfall_user_settings');
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
})();

window.DEV_MODE = _savedUserSettings.devMode !== undefined ? !!_savedUserSettings.devMode : true;
window.SQUAD_PVP = _savedUserSettings.squadPvp !== undefined ? !!_savedUserSettings.squadPvp : false;
if (window.SQUAD_PVP) window.DEV_MODE = false;
window.MOUSE_SENS = (typeof _savedUserSettings.mouseSens === 'number' && Number.isFinite(_savedUserSettings.mouseSens)) ? _savedUserSettings.mouseSens : 1.0;
window.CONTROLLER_SENS = (() => {
  if (typeof _savedUserSettings.ctrlSens === 'number' && Number.isFinite(_savedUserSettings.ctrlSens)) return _savedUserSettings.ctrlSens;
  try {
    const v = parseFloat(localStorage.getItem('ashfall_ctrl_sens'));
    return Number.isFinite(v) ? v : 1.0;
  } catch (e) { return 1.0; }
})();
window.CONTROLLER_LS_DEADZONE = (typeof _savedUserSettings.ctrlLsDz === 'number' && Number.isFinite(_savedUserSettings.ctrlLsDz)) ? _savedUserSettings.ctrlLsDz : 0.12;
window.CONTROLLER_RS_DEADZONE = (typeof _savedUserSettings.ctrlRsDz === 'number' && Number.isFinite(_savedUserSettings.ctrlRsDz)) ? _savedUserSettings.ctrlRsDz : 0.10;
window.CONTROLLER_AA_STRENGTH = (typeof _savedUserSettings.ctrlAa === 'number' && Number.isFinite(_savedUserSettings.ctrlAa)) ? _savedUserSettings.ctrlAa : 0.85;
window.GFX_SETTINGS = (() => {
  try {
    const parsed = _savedUserSettings.gfx || JSON.parse(localStorage.getItem('ashfall_gfx_settings') || 'null');
    if (parsed) {
      return {
        lod: parsed.lod ?? 3,
        lighting: parsed.lighting ?? 3,
        shadows: parsed.shadows ?? 3,
        textures: parsed.textures ?? 3,
        pixel: parsed.pixel ?? 2
      };
    }
  } catch (e) {}
  return { lod: 3, lighting: 3, shadows: 3, textures: 3, pixel: 2 };
})();
window.BASE_FOV = (typeof _savedUserSettings.baseFov === 'number' && Number.isFinite(_savedUserSettings.baseFov)) ? _savedUserSettings.baseFov : 75;
window.ADS_FOV_MODE = (_savedUserSettings.adsFovMode === 'independent') ? 'independent' : 'affected';
window.WEAPON_FOV_SCALE = (['narrow', 'default', 'wide'].includes(_savedUserSettings.weaponFovScale)) ? _savedUserSettings.weaponFovScale : 'default';
window.WEAPON_FOV_MODE = (_savedUserSettings.weaponFovMode === 'independent') ? 'independent' : 'effected';
window.VIEWMODEL_FOV = (typeof _savedUserSettings.viewmodelFov === 'number' && Number.isFinite(_savedUserSettings.viewmodelFov)) ? _savedUserSettings.viewmodelFov : 75;
window._SAVED_AUDIO_SETTINGS = _savedUserSettings.audio || null;

window.saveAllUserSettings = function saveAllUserSettings() {
  try {
    const audio = window.soundEngine ? {
      muted: !!window.soundEngine.muted,
      levels: window.soundEngine.levels ? { ...window.soundEngine.levels } : null
    } : window._SAVED_AUDIO_SETTINGS;
    const payload = {
      baseFov: window.BASE_FOV || 75,
      adsFovMode: window.ADS_FOV_MODE === 'independent' ? 'independent' : 'affected',
      weaponFovScale: (['narrow', 'default', 'wide'].includes(window.WEAPON_FOV_SCALE)) ? window.WEAPON_FOV_SCALE : 'default',
      weaponFovMode: window.WEAPON_FOV_MODE === 'independent' ? 'independent' : 'effected',
      viewmodelFov: window.VIEWMODEL_FOV || 75,
      mouseSens: window.MOUSE_SENS || 1.0,
      ctrlSens: window.CONTROLLER_SENS || 1.0,
      ctrlLsDz: window.CONTROLLER_LS_DEADZONE ?? 0.12,
      ctrlRsDz: window.CONTROLLER_RS_DEADZONE ?? 0.10,
      ctrlAa: window.CONTROLLER_AA_STRENGTH ?? 0.85,
      gfx: window.GFX_SETTINGS || { lod: 3, lighting: 3, shadows: 3, textures: 3, pixel: 2 },
      devMode: !!window.DEV_MODE,
      squadPvp: !!window.SQUAD_PVP,
      audio
    };
    localStorage.setItem('ashfall_user_settings', JSON.stringify(payload));
    localStorage.setItem('ashfall_ctrl_sens', String(payload.ctrlSens));
    localStorage.setItem('ashfall_gfx_settings', JSON.stringify(payload.gfx));
  } catch (e) {}
};

// Apply persisted audio mute & channel volume levels as soon as soundEngine is available
if (window._SAVED_AUDIO_SETTINGS && window.soundEngine) {
  const aud = window._SAVED_AUDIO_SETTINGS;
  if (aud.levels && typeof window.soundEngine.setLevel === 'function') {
    Object.keys(aud.levels).forEach((k) => window.soundEngine.setLevel(k, aud.levels[k]));
  }
  if (typeof aud.muted === 'boolean') {
    if (typeof window.soundEngine.setMuted === 'function') window.soundEngine.setMuted(aud.muted);
    else window.soundEngine.muted = aud.muted;
  }
}
window.DEFAULT_KEYBINDS = {
  moveForward: 'KeyW',
  moveBack: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  sprint: 'ShiftLeft',
  crouch: 'KeyC',
  jump: 'Space',
  reload: 'KeyR',
  inspect: 'KeyI',
  tacStance: 'KeyB',
  plates: 'KeyG',
  medkit: 'KeyH',
  lethal: 'KeyF',
  tactical: 'KeyQ',
  fieldUpgrade: 'KeyZ',
  killstreak: 'KeyK',
  slotPrimary: 'Digit1',
  slotSecondary: 'Digit2',
  slotMelee: 'Digit3',
  quickMelee: 'KeyX',
  interact: 'KeyE',
  backpack: 'Tab',
  map: 'KeyM',
  thirdPerson: 'KeyV'
};
window.KEYBINDS = { ...window.DEFAULT_KEYBINDS };
window.DEFAULT_GAMEPAD_BINDS = {
  fire: 7,
  ads: 6,
  sprint: 10,
  jump: 0,
  crouch: 1,
  interactReload: 2,
  revive: 2,
  swapPlates: 3,
  tactical: 4,
  lethal: 5,
  melee: 11,
  medkit: 12,
  backpack: 13,
  inspect: 14,
  killstreak: 15,
  map: 8,
  pause: 9
};
window.GAMEPAD_BINDS = { ...window.DEFAULT_GAMEPAD_BINDS };

class GameUI {
  constructor(onDeployCallback) {
    this.onDeploy = onDeployCallback;
    this.storageKey = 'ashfall_extraction_save_v1';
    this.traderCategory = 'weapons';
    this.devTraderCategory = 'all';
    this.activeMenuTab = 'home';
    this.socialTab = 'friends';
    this.activeLootSource = null; // { title, items } or null for backpack-only
    this.matchmakingStage = null;
    this._lootPlayer = null;
    this._hoveredSlot = null; // { context, idx, item, el }
    this._searchRevealProgress = 0;
    this._partyReady = false;
    this.tacMapZoom = 1.0;
    this.tacMapPan = { x: 0, z: 0 };
    this.tacMapCursor = { nx: 0.5, ny: 0.5, active: false };
    this.tacMapRadial = { open: false, nx: 0.5, ny: 0.5, wx: 0, wz: 0, choice: 'cancel', source: 'mouse' };
    this._chatScope = 'fob';
    this._chatRoomId = null;
    this._seenChatMsgIds = new Set();

    this.profile = this._loadProfile();
    this._normalizeStash();
    window.KEYBINDS = { ...window.DEFAULT_KEYBINDS, ...(this.profile.keybinds || {}) };
    window.GAMEPAD_BINDS = { ...window.DEFAULT_GAMEPAD_BINDS, ...(this.profile.gamepadBinds || {}) };
    this.keybindsTab = 'kbm';
    this._initSocial();
    this._initLobbyChat();
    this._initInventoryItemPingMouse();
    this._initLiveUpdateTracker();
    this._bindHideoutEvents();
    this._bindWeaponStagingModal();
    this._bindSpatialKeyboardNav();
    this._bindDragAndDrop();
    this._updateDynamicUiScale();
    window.addEventListener('resize', () => {
      this._updateDynamicUiScale();
      this._updateDeployResponsiveScale();
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        this._updateDynamicUiScale();
        this._updateDeployResponsiveScale();
      });
    }
    window.addEventListener('beforeunload', () => this.saveProfile());
    this.renderKeybindSettings();
    window.showCenterToast = (msg, color) => this.showCenterToast(msg, color);
    this.openMenuTab('home');
    this.renderHideout();
    requestAnimationFrame(() => this.ensureInitialSelection());
  }

  // ==================== UNIFIED AMBER SPATIAL SELECTOR (WASD / ARROWS / CONTROLLER D-PAD) ====================
  _getNavScope() {
    const wpnModal = document.getElementById('weapon-staging-modal');
    if (wpnModal && !wpnModal.classList.contains('hidden')) return wpnModal;
    const inGameSettings = document.getElementById('ingame-settings-overlay');
    if (inGameSettings && !inGameSettings.classList.contains('hidden')) return inGameSettings;
    const pauseOv = document.getElementById('pointer-lock-overlay');
    if (pauseOv && !pauseOv.classList.contains('hidden')) return pauseOv;
    const lootMod = document.getElementById('loot-modal');
    if (lootMod && !lootMod.classList.contains('hidden')) return lootMod;
    const gs = document.getElementById('gunsmith-screen');
    if (gs && gs.classList.contains('active')) return gs;
    const sum = document.getElementById('summary-screen');
    if (sum && sum.classList.contains('active')) return sum;
    const hideout = document.getElementById('hideout-screen');
    if (hideout && hideout.classList.contains('active')) return hideout;
    return null;
  }

  _getSpatialFocusables(scope) {
    if (!scope) return [];
    if (this._raidWeaponPick && scope.id === 'loot-modal') {
      return Array.from(scope.querySelectorAll('.wpn-pick-target, #btn-cancel-wpn-pick')).filter(el => el.offsetParent !== null);
    }
    if (this._deployWeaponPick && this.activeMenuTab === 'deploy') {
      return Array.from(document.querySelectorAll('#menu-view-deploy .wpn-pick-target, #btn-cancel-deploy-wpn-pick')).filter(el => el.offsetParent !== null);
    }
    const slotSel = this._dragState
      ? '.inv-slot:not(.searching)'
      : '.inv-slot:not(.empty-slot):not(.searching)';
    const selector = [
      'button:not(:disabled)',
      'summary',
      'select:not(:disabled)',
      'input[type="range"]',
      'input[type="checkbox"]',
      slotSel,
      '.op-slot-card',
      '.map-node',
      '.zone-card'
    ].join(', ');
    const all = Array.from(scope.querySelectorAll(selector));
    return all.filter((el) => {
      if (el.offsetParent === null) return false;
      if (el.closest('.hidden')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }

  setSelectedElement(el, opts = {}) {
    const changed = this._selectedEl !== el;
    if (this._selectedEl && this._selectedEl !== el) {
      this._selectedEl.classList.remove('ui-selected', 'gp-focus');
    }
    this._selectedEl = el || null;
    if (this._selectedEl) {
      this._selectedEl.classList.add('ui-selected', 'gp-focus');
      if (changed && window.soundEngine && window.soundEngine.playSelectorMove) {
        const now = performance.now();
        if (!this._lastSelSfx || now - this._lastSelSfx > 42) {
          this._lastSelSfx = now;
          try { window.soundEngine.playSelectorMove(); } catch (e) {}
        }
      }
      try {
        this._selectedEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } catch (e) {}

      // If currently dragging with controller RT, update drag ghost & drop highlight to the selected slot
      if (this._dragState && this._dragState.mode === 'gamepad') {
        this._updateDragVisualTarget(this._selectedEl);
      }

      // If inside in-raid loot/inventory modal and selecting an item slot, sync hoveredSlot
      const lootMod = document.getElementById('loot-modal');
      if (lootMod && !lootMod.classList.contains('hidden') && this._selectedEl.classList.contains('inv-slot')) {
        const ctxName = this._selectedEl.dataset.context;
        const idx = parseInt(this._selectedEl.dataset.idx, 10);
        const item = ctxName === 'container'
          ? (this.activeLootSource && this.activeLootSource.items[idx])
          : (this._lootPlayer && this._lootPlayer.backpack && this._lootPlayer.backpack[idx]);
        if (item) {
          this._hoveredSlot = { context: ctxName, item, idx, el: this._selectedEl, inputMode: opts.inputMode || 'keyboard', mode: 'all' };
          if (opts.inputMode === 'gamepad' && this._isControllerConnected()) {
            this.showItemPopout(this._selectedEl, ctxName, item, idx, { inputMode: 'gamepad', mode: 'all' });
          }
        }
      } else if (opts.inputMode === 'gamepad' && lootMod && !lootMod.classList.contains('hidden')) {
        this.hideItemPopout();
      }
    }
  }

  _isControllerConnected() {
    if (window.gamepadController && window.gamepadController.connected) return true;
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      try {
        const pads = navigator.getGamepads();
        for (const p of pads) {
          if (p && p.connected) return true;
        }
      } catch (e) {}
    }
    return false;
  }

  clearSelection() {
    this.setSelectedElement(null);
  }

  ensureInitialSelection(opts = {}) {
    const scope = this._getNavScope();
    if (!scope) return null;
    const items = this._getSpatialFocusables(scope);
    if (items.length === 0) return null;
    if (this._selectedEl && items.includes(this._selectedEl)) return this._selectedEl;
    // On the Main Menu Home tab, default initial focus to the primary DEPLOY TO OPERATION hero button
    let first = items[0];
    if (scope.id === 'hideout-screen' && this.activeMenuTab === 'home') {
      const deployHero = scope.querySelector('.home-deploy-hero');
      if (deployHero && items.includes(deployHero)) first = deployHero;
    }
    this.setSelectedElement(first, opts);
    return first;
  }

  moveSpatialSelection(dir, opts = {}) {
    const scope = this._getNavScope();
    if (!scope) return false;
    const items = this._getSpatialFocusables(scope);
    if (items.length === 0) return false;
    // If previous selection was detached by a live re-render (e.g. during container loot reveal), re-anchor cleanly!
    if (this._selectedEl && !document.body.contains(this._selectedEl)) {
      this._selectedEl = null;
    }
    if (items.length === 0) return false;

    if (!this._selectedEl || !items.includes(this._selectedEl)) {
      this.setSelectedElement(items[0], opts);
      return true;
    }

    // Range slider adjustment with Left / Right
    if (this._selectedEl.tagName === 'INPUT' && this._selectedEl.type === 'range' && (dir === 'left' || dir === 'right')) {
      const step = parseFloat(this._selectedEl.step) || 1;
      const min = parseFloat(this._selectedEl.min);
      const max = parseFloat(this._selectedEl.max);
      const cur = parseFloat(this._selectedEl.value);
      const next = Math.max(min, Math.min(max, cur + (dir === 'right' ? step : -step)));
      this._selectedEl.value = next;
      this._selectedEl.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    const curRect = this._selectedEl.getBoundingClientRect();
    const cx = curRect.left + curRect.width / 2;
    const cy = curRect.top + curRect.height / 2;

    let bestEl = null;
    let bestScore = Infinity;

    for (const cand of items) {
      if (cand === this._selectedEl) continue;
      const r = cand.getBoundingClientRect();
      const tx = r.left + r.width / 2;
      const ty = r.top + r.height / 2;
      const dx = tx - cx;
      const dy = ty - cy;

      // Bounding-box edge-distance + span-overlap spatial scoring so wide/tall hero buttons (e.g. DEPLOY TO OPERATION) are never skipped!
      let primary = 0;
      let perp = 0;
      let centerTie = 0;
      if (dir === 'right') {
        if (dx <= 6 && r.left < curRect.right - 2) continue;
        if (r.right <= curRect.left + 2) continue;
        primary = r.left >= curRect.right - 4 ? Math.max(0, r.left - curRect.right) : Math.max(4, dx);
        const overlapY = Math.min(curRect.bottom, r.bottom) - Math.max(curRect.top, r.top);
        perp = overlapY > 0 ? 0 : (r.top > curRect.bottom ? r.top - curRect.bottom : curRect.top - r.bottom);
        centerTie = Math.abs(dy) * 0.08;
      } else if (dir === 'left') {
        if (dx >= -6 && r.right > curRect.left + 2) continue;
        if (r.left >= curRect.right - 2) continue;
        primary = r.right <= curRect.left + 4 ? Math.max(0, curRect.left - r.right) : Math.max(4, -dx);
        const overlapY = Math.min(curRect.bottom, r.bottom) - Math.max(curRect.top, r.top);
        perp = overlapY > 0 ? 0 : (r.top > curRect.bottom ? r.top - curRect.bottom : curRect.top - r.bottom);
        centerTie = Math.abs(dy) * 0.08;
      } else if (dir === 'down') {
        if (dy <= 6 && r.top < curRect.bottom - 2) continue;
        if (r.bottom <= curRect.top + 2) continue;
        primary = r.top >= curRect.bottom - 4 ? Math.max(0, r.top - curRect.bottom) : Math.max(4, dy);
        const overlapX = Math.min(curRect.right, r.right) - Math.max(curRect.left, r.left);
        perp = overlapX > 0 ? 0 : (r.left > curRect.right ? r.left - curRect.right : curRect.left - r.right);
        centerTie = Math.abs(dx) * 0.08;
      } else if (dir === 'up') {
        if (dy >= -6 && r.bottom > curRect.top + 2) continue;
        if (r.top >= curRect.bottom - 2) continue;
        primary = r.bottom <= curRect.top + 4 ? Math.max(0, curRect.top - r.bottom) : Math.max(4, -dy);
        const overlapX = Math.min(curRect.right, r.right) - Math.max(curRect.left, r.left);
        perp = overlapX > 0 ? 0 : (r.left > curRect.right ? r.left - curRect.right : curRect.left - r.right);
        centerTie = Math.abs(dx) * 0.08;
      }

      const score = primary + perp * 2.4 + centerTie;
      if (score < bestScore) {
        bestScore = score;
        bestEl = cand;
      }
    }

    // Fallback wrap-around if at edge of a linear list
    if (!bestEl && items.length > 1) {
      const idx = items.indexOf(this._selectedEl);
      const delta = (dir === 'down' || dir === 'right') ? 1 : -1;
      bestEl = items[(idx + delta + items.length) % items.length];
    }

    if (bestEl) {
      this.setSelectedElement(bestEl, opts);
      return true;
    }
    return false;
  }

  activateSelectedElement(opts = {}) {
    const scope = this._getNavScope();
    if (!scope) return false;
    const items = this._getSpatialFocusables(scope);
    if (!this._selectedEl || !items.includes(this._selectedEl)) {
      if (items.length > 0) this.setSelectedElement(items[0], opts);
      return false;
    }
    const el = this._selectedEl;
    const lootMod = document.getElementById('loot-modal');
    if (lootMod && !lootMod.classList.contains('hidden') && el.classList.contains('inv-slot')) {
      if (opts.inputMode === 'gamepad' && this._hoveredSlot) {
        this.handleSlotAction('quick');
        return true;
      }
    }
    el.click();
    return true;
  }

  _bindSpatialKeyboardNav() {
    window.addEventListener('keydown', (e) => {
      if (this._rebindCleanup) return;
      if (window.devConsole && window.devConsole.isOpen) return;
      if (window.hideoutBunker && window.hideoutBunker.activeRoam) return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' && document.activeElement.type !== 'range') return;
      if (tag === 'TEXTAREA' || tag === 'SELECT') return;

      const scope = this._getNavScope();
      if (!scope) return;

      // On the Main Menu Lobby, let WASD immediately enter Walkable 3D Hideout mode (Arrows still navigate menu tiles)
      if (this.activeMenuTab === 'home' && (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD')) {
        return;
      }

      const dirMap = {
        KeyW: 'up', ArrowUp: 'up',
        KeyS: 'down', ArrowDown: 'down',
        KeyA: 'left', ArrowLeft: 'left',
        KeyD: 'right', ArrowRight: 'right'
      };
      const dir = dirMap[e.code];
      if (dir) {
        e.preventDefault();
        e.stopPropagation();
        this.moveSpatialSelection(dir, { inputMode: 'keyboard' });
        return;
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        if (this._selectedEl && scope.contains(this._selectedEl)) {
          e.preventDefault();
          e.stopPropagation();
          this.activateSelectedElement({ inputMode: 'keyboard' });
        }
      }
    }, true);

    // Sync amber selector cleanly on mouse hover over buttons & inventory slots
    document.addEventListener('mouseover', (e) => {
      if (this._dragState) return;
      const scope = this._getNavScope();
      if (!scope) return;
      const target = e.target && e.target.closest
        ? e.target.closest('button:not(:disabled), .inv-slot:not(.empty-slot):not(.searching), .op-slot-card, .map-node, .zone-card')
        : null;
      if (target && scope.contains(target) && target !== this._selectedEl) {
        this.setSelectedElement(target, { inputMode: 'mouse' });
      }
    });
  }

  // ==================== UNIVERSAL DRAG-AND-DROP (LMB HOLD & CONTROLLER RT HOLD) ====================
  _describeSlotElement(el) {
    if (!el) return null;
    const slotEl = el.closest ? el.closest('.inv-slot, .op-slot-card[data-op-key]') : null;
    if (!slotEl) return null;
    if (slotEl.dataset.unrevealed === '1' || slotEl.classList.contains('searching')) return null;

    if (slotEl.classList.contains('op-slot-card') && slotEl.dataset.opKey) {
      const opKey = slotEl.dataset.opKey;
      if (slotEl.closest('#prematch-op-slots')) return { zone: 'pm_op', opKey, el: slotEl };
      if (slotEl.closest('#inv-op-slots')) return { zone: 'raid_op', opKey, el: slotEl };
      if (slotEl.closest('#loot-enemy-op-slots')) return { zone: 'raid_enemy_op', opKey, el: slotEl };
      return null;
    }

    if (slotEl.classList.contains('backpack-weapon-slot')) {
      if (slotEl.closest('#prematch-bag-grid')) return { zone: 'pm_op', opKey: 'backpackWeapon', el: slotEl };
      if (slotEl.closest('#loot-backpack-items')) return { zone: 'raid_op', opKey: 'backpackWeapon', el: slotEl };
    }

    if (slotEl.closest('#prematch-weapon-stash-grid')) {
      const idx = Array.from(slotEl.parentElement.children).indexOf(slotEl);
      return { zone: 'pm_wpn_stash', idx, el: slotEl };
    }
    if (slotEl.closest('#prematch-stash-grid')) {
      const idx = Array.from(slotEl.parentElement.children).indexOf(slotEl);
      return { zone: 'pm_stash', idx, el: slotEl };
    }
    if (slotEl.closest('#prematch-bag-grid')) {
      const nonWpn = Array.from(slotEl.parentElement.querySelectorAll('.inv-slot:not(.backpack-weapon-slot)'));
      const idx = nonWpn.indexOf(slotEl);
      return idx >= 0 ? { zone: 'pm_bag', idx, el: slotEl } : null;
    }
    if (slotEl.closest('#loot-container-items')) {
      const idx = parseInt(slotEl.dataset.idx, 10);
      return Number.isFinite(idx) ? { zone: 'raid_container', idx, el: slotEl } : null;
    }
    if (slotEl.closest('#loot-backpack-items')) {
      const idx = parseInt(slotEl.dataset.idx, 10);
      return Number.isFinite(idx) ? { zone: 'raid_bag', idx, el: slotEl } : null;
    }
    return null;
  }

  _readSlotItem(desc) {
    if (!desc) return null;
    const L = this.profile && this.profile.loadout;
    const p = this._lootPlayer;

    switch (desc.zone) {
      case 'pm_wpn_stash': {
        const it = (this.profile.weaponStash || [])[desc.idx];
        return it ? { ...it, qty: it.qty || 1 } : null;
      }
      case 'pm_stash': {
        const it = (this.profile.stash || [])[desc.idx];
        return it ? { ...it } : null;
      }
      case 'pm_bag': {
        const it = (L && L.backpackItems || [])[desc.idx];
        return it ? { ...it } : null;
      }
      case 'pm_op': {
        if (!L) return null;
        const k = desc.opKey;
        if (k === 'primary' || k === 'secondary') {
          if (!L[k]) return null;
          const m = L[k + 'Mods'] || (this.profile.weaponMods && this.profile.weaponMods[L[k]]) || {};
          const cleanM = (window.GAME_DATA && GAME_DATA.normalizeWeaponMods) ? GAME_DATA.normalizeWeaponMods(m) : { ...m };
          const rar = (window.GAME_DATA && GAME_DATA.resolveWeaponRarity)
            ? GAME_DATA.resolveWeaponRarity(L[k], cleanM, L[k + 'Rarity'])
            : (L[k + 'Rarity'] || null);
          return { id: L[k], qty: 1, mods: cleanM, rarityOverride: rar };
        }
        if (k === 'plates') return (L.plates || 0) > 0 ? { id: 'armor_plate', qty: L.plates } : null;
        if (k === 'lethal') return (L.lethal && (L.lethalQty || 0) > 0) ? { id: L.lethal, qty: L.lethalQty } : null;
        if (k === 'tactical') return (L.tactical && (L.tacticalQty || 0) > 0) ? { id: L.tactical, qty: L.tacticalQty } : null;
        if (k === 'cash' || k === 'dogtag') return null;
        return L[k] ? { id: L[k], qty: 1 } : null;
      }
      case 'raid_container': {
        const it = this.activeLootSource && this.activeLootSource.items[desc.idx];
        return (it && it.revealed !== false) ? { ...it } : null;
      }
      case 'raid_bag': {
        const it = p && p.backpack && p.backpack[desc.idx];
        return it ? { ...it } : null;
      }
      case 'raid_op': {
        if (!p) return null;
        const k = desc.opKey;
        if (k === 'primary' || k === 'secondary') {
          const sl = p.slots && p.slots[k];
          return sl ? { id: sl.id, qty: 1, mods: sl.mods || null, mag: sl.mag, rarityOverride: sl.rarityOverride || null } : null;
        }
        if (k === 'backpackWeapon') {
          const bw = p.backpackWeapon;
          return bw ? { id: bw.id, qty: 1, mods: bw.mods || null, mag: bw.mag, rarityOverride: bw.rarityOverride || null } : null;
        }
        if (k === 'plates') return (p.plates || 0) > 0 ? { id: 'armor_plate', qty: p.plates } : null;
        if (k === 'lethal') return (p.lethal && (p.lethalQty || 0) > 0) ? { id: p.lethal, qty: p.lethalQty } : null;
        if (k === 'tactical') return (p.tactical && (p.tacticalQty || 0) > 0) ? { id: p.tactical, qty: p.tacticalQty } : null;
        if (k === 'armor') return p.armorId ? { id: p.armorId, qty: 1 } : null;
        if (k === 'backpack') return p.backpackId ? { id: p.backpackId, qty: 1 } : null;
        if (k === 'cash' || k === 'dogtag') return null;
        return p[k] ? { id: p[k], qty: 1 } : null;
      }
      case 'raid_enemy_op': {
        const eq = this.activeLootSource && this.activeLootSource.operatorEquipment;
        if (!eq) return null;
        const k = desc.opKey;
        if (eq.revealedSlots && !eq.revealedSlots[k]) return null;
        if (k === 'plates') return (eq.plates || 0) > 0 ? { id: 'armor_plate', qty: eq.plates } : null;
        if (k === 'cash' || k === 'dogtag') return null;
        if (k === 'primary' || k === 'secondary') {
          return eq[k]
            ? { id: eq[k], qty: 1, mods: eq[k + 'Mods'] || {}, rarityOverride: eq[k + 'Rarity'] || null }
            : null;
        }
        return eq[k] ? { id: eq[k], qty: 1 } : null;
      }
    }
    return null;
  }

  _canAcceptItem(desc, item) {
    if (!desc) return false;
    if (!item) return true; // clearing a slot is always valid
    const def = GAME_DATA.ITEMS[item.id];
    if (!def) return false;

    if (desc.zone === 'pm_wpn_stash') return def.type === 'weapon';
    if (desc.zone === 'pm_stash' || desc.zone === 'pm_bag' || desc.zone === 'raid_bag' || desc.zone === 'raid_container') {
      return true;
    }
    if (desc.zone === 'pm_op' || desc.zone === 'raid_op' || desc.zone === 'raid_enemy_op') {
      const k = desc.opKey;
      if (k === 'primary' || k === 'secondary' || k === 'backpackWeapon') return def.type === 'weapon';
      if (k === 'melee') return def.type === 'melee';
      if (k === 'armor') return def.type === 'armor';
      if (k === 'backpack') return def.type === 'backpack';
      if (k === 'headgear') return def.type === 'headgear';
      if (k === 'selfRevive') return def.type === 'self_revive';
      if (k === 'fieldUpgrade') return def.type === 'field_upgrade';
      if (k === 'killstreak') return def.type === 'killstreak';
      if (k === 'lethal') return def.type === 'lethal';
      if (k === 'tactical') return def.type === 'tactical';
      if (k === 'plates') return def.type === 'plate' || item.id === 'armor_plate';
      return false;
    }
    return false;
  }

  _writeSlotItem(desc, item) {
    if (!desc) return;
    const L = this.profile && this.profile.loadout;
    const p = this._lootPlayer;

    switch (desc.zone) {
      case 'pm_wpn_stash': {
        if (!Array.isArray(this.profile.weaponStash)) this.profile.weaponStash = [];
        this.profile.weaponStash[desc.idx] = item ? { id: item.id, qty: 1, mods: item.mods || undefined, rarityOverride: item.rarityOverride || undefined } : null;
        return;
      }
      case 'pm_stash': {
        if (!Array.isArray(this.profile.stash)) this.profile.stash = [];
        this.profile.stash[desc.idx] = item ? { ...item } : null;
        return;
      }
      case 'pm_bag': {
        if (!Array.isArray(L.backpackItems)) L.backpackItems = [];
        L.backpackItems[desc.idx] = item ? { ...item } : null;
        return;
      }
      case 'pm_op': {
        const k = desc.opKey;
        if (k === 'primary' || k === 'secondary') {
          L[k] = item ? item.id : null;
          const m = (item && item.mods) || (item && this.profile.weaponMods && this.profile.weaponMods[item.id]) || {};
          const cleanM = (window.GAME_DATA && GAME_DATA.normalizeWeaponMods) ? GAME_DATA.normalizeWeaponMods(m) : { ...m };
          L[k + 'Mods'] = item ? cleanM : null;
          L[k + 'Rarity'] = item
            ? ((window.GAME_DATA && GAME_DATA.resolveWeaponRarity)
                ? GAME_DATA.resolveWeaponRarity(item.id, cleanM, item.rarityOverride)
                : (item.rarityOverride || null))
            : null;
          return;
        }
        if (k === 'plates') { L.plates = item ? Math.min(6, item.qty || 1) : 0; return; }
        if (k === 'lethal') { L.lethal = item ? item.id : null; L.lethalQty = item ? (item.qty || 1) : 0; return; }
        if (k === 'tactical') { L.tactical = item ? item.id : null; L.tacticalQty = item ? (item.qty || 1) : 0; return; }
        L[k] = item ? item.id : null;
        return;
      }
      case 'raid_container': {
        if (!this.activeLootSource) return;
        this.activeLootSource.items[desc.idx] = item ? { ...item, revealed: true } : null;
        return;
      }
      case 'raid_bag': {
        if (!p) return;
        p.backpack[desc.idx] = item ? { ...item } : null;
        return;
      }
      case 'raid_op': {
        if (!p) return;
        const k = desc.opKey;
        if (k === 'primary' || k === 'secondary') {
          if (item) {
            const def = GAME_DATA.ITEMS[item.id];
            const mods = item.mods || (this.profile.weaponMods && this.profile.weaponMods[item.id]) || {};
            const eff = GAME_DATA.getEffectiveWeaponStats(item.id, mods);
            p.slots[k] = {
              id: item.id,
              mods,
              mag: item.mag !== undefined ? item.mag : (eff ? eff.magSize : (def ? def.magSize : 30)),
              rarityOverride: item.rarityOverride || null
            };
          } else {
            p.slots[k] = null;
          }
          if (p.activeSlot === k && p.weaponSystem && p.switchSlot) {
            p.switchSlot(k);
          }
          return;
        }
        if (k === 'backpackWeapon') {
          if (item) {
            const def = GAME_DATA.ITEMS[item.id];
            const mods = item.mods || (this.profile.weaponMods && this.profile.weaponMods[item.id]) || {};
            const eff = GAME_DATA.getEffectiveWeaponStats(item.id, mods);
            p.backpackWeapon = {
              id: item.id,
              mods,
              mag: item.mag !== undefined ? item.mag : (eff ? eff.magSize : (def ? def.magSize : 30)),
              rarityOverride: item.rarityOverride || null
            };
          } else {
            p.backpackWeapon = null;
          }
          return;
        }
        if (k === 'plates') { p.plates = item ? Math.min(6, item.qty || 1) : 0; return; }
        if (k === 'lethal') { p.lethal = item ? item.id : null; p.lethalQty = item ? (item.qty || 1) : 0; return; }
        if (k === 'tactical') { p.tactical = item ? item.id : null; p.tacticalQty = item ? (item.qty || 1) : 0; return; }
        if (k === 'armor') {
          p.armorId = item ? item.id : null;
          const def = item ? GAME_DATA.ITEMS[item.id] : null;
          p.plateSlots = def ? (def.plateSlots || Math.ceil((def.maxArmor || 100) / 50)) : 0;
          p.maxArmor = p.plateSlots * 50;
          p.armor = Math.min(p.armor, p.maxArmor);
          return;
        }
        if (k === 'backpack') {
          p.backpackId = item ? item.id : null;
          const def = item ? GAME_DATA.ITEMS[item.id] : null;
          p.backpackMaxSlots = def ? (def.bagSlots || def.slots || 8) : 6;
          return;
        }
        p[k] = item ? item.id : null;
        return;
      }
      case 'raid_enemy_op': {
        const eq = this.activeLootSource && this.activeLootSource.operatorEquipment;
        if (!eq) return;
        const k = desc.opKey;
        if (k === 'plates') { eq.plates = item ? Math.min(6, item.qty || 1) : 0; return; }
        if (k === 'primary' || k === 'secondary') {
          eq[k] = item ? item.id : null;
          eq[k + 'Mods'] = item && item.mods ? { ...item.mods } : {};
          eq[k + 'Rarity'] = item ? (item.rarityOverride || null) : null;
          return;
        }
        eq[k] = item ? item.id : null;
        return;
      }
    }
  }

  _cleanSparseArray(arr) {
    if (!Array.isArray(arr)) return;
    while (arr.length > 0 && !arr[arr.length - 1]) arr.pop();
    for (let i = arr.length - 1; i >= 0; i--) {
      if (!arr[i]) arr.splice(i, 1);
    }
  }

  performSlotDrop(srcDesc, dstDesc) {
    if (!srcDesc || !dstDesc) return false;
    if (srcDesc.zone === dstDesc.zone && srcDesc.idx === dstDesc.idx && srcDesc.opKey === dstDesc.opKey) return false;

    const srcItem = this._readSlotItem(srcDesc);
    if (!srcItem) return false;
    const dstItem = this._readSlotItem(dstDesc);

    if (!this._canAcceptItem(dstDesc, srcItem)) {
      if (window.showCenterToast) window.showCenterToast('INCOMPATIBLE SLOT', '#ff5252');
      return false;
    }
    if (dstItem && !this._canAcceptItem(srcDesc, dstItem)) {
      if (window.showCenterToast) window.showCenterToast('CANNOT SWAP INTO SOURCE SLOT', '#ff5252');
      return false;
    }

    // Merge if same stackable item with room under maxStack
    const def = GAME_DATA.ITEMS[srcItem.id];
    if (dstItem && dstItem.id === srcItem.id && def && def.stackable) {
      const maxS = (dstDesc.opKey === 'plates') ? 6 : (def.maxStack || Infinity);
      const room = maxS === Infinity ? srcItem.qty : Math.max(0, maxS - dstItem.qty);
      if (room > 0) {
        const move = Math.min(room, srcItem.qty);
        dstItem.qty += move;
        srcItem.qty -= move;
        this._writeSlotItem(dstDesc, dstItem);
        this._writeSlotItem(srcDesc, srcItem.qty > 0 ? srcItem : null);
      } else {
        // Stack full -> swap!
        this._writeSlotItem(dstDesc, srcItem);
        this._writeSlotItem(srcDesc, dstItem);
      }
    } else {
      // Direct move or swap places!
      this._writeSlotItem(dstDesc, srcItem);
      this._writeSlotItem(srcDesc, dstItem);
    }

    // Clean up nulls in dynamic lists (only if we didn't swap into a sparse stash grid)
    if (srcDesc.zone === 'pm_bag' || dstDesc.zone === 'pm_bag') this._cleanSparseArray(this.profile.loadout.backpackItems);
    if (srcDesc.zone === 'pm_stash' || dstDesc.zone === 'pm_stash') this._cleanSparseArray(this.profile.stash);
    if (srcDesc.zone === 'pm_wpn_stash' || dstDesc.zone === 'pm_wpn_stash') this._cleanSparseArray(this.profile.weaponStash);
    if (this._lootPlayer && (srcDesc.zone === 'raid_bag' || dstDesc.zone === 'raid_bag')) this._cleanSparseArray(this._lootPlayer.backpack);
    if (this.activeLootSource && (srcDesc.zone === 'raid_container' || dstDesc.zone === 'raid_container')) this._cleanSparseArray(this.activeLootSource.items);

    if (window.soundEngine) {
      try {
        if (window.soundEngine.playInvDrop) window.soundEngine.playInvDrop();
        else if (window.soundEngine.playClick) window.soundEngine.playClick();
      } catch (e) {}
    }

    this.hideItemPopout();
    if (srcDesc.zone.startsWith('pm_') || dstDesc.zone.startsWith('pm_')) {
      this.saveProfile();
      this.renderHideout();
    } else if (this._lootPlayer) {
      if (srcDesc.zone === 'raid_container' || dstDesc.zone === 'raid_container' || srcDesc.zone === 'raid_enemy_op' || dstDesc.zone === 'raid_enemy_op') {
        this._syncActiveContainerToNet();
      }
      this.renderLootModal(this._lootPlayer);
    }
    return true;
  }

  _showDragGhost(item, x, y) {
    let ghost = document.getElementById('inv-drag-ghost');
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.id = 'inv-drag-ghost';
      ghost.className = 'inv-drag-ghost';
      document.body.appendChild(ghost);
    }
    const def = GAME_DATA.ITEMS[item.id];
    const name = def ? def.name : item.id;
    const qtyTxt = item.qty > 1 ? ` x${item.qty}` : '';
    ghost.innerHTML = `${name}${qtyTxt}<span class="dg-sub">DROP ON SLOT TO MOVE / SWAP</span>`;
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    ghost.classList.remove('hidden');
  }

  _hideDragGhost() {
    const ghost = document.getElementById('inv-drag-ghost');
    if (ghost) ghost.classList.add('hidden');
  }

  _clearDragHighlights() {
    document.querySelectorAll('.drag-source, .drag-target, .drag-target-invalid').forEach((el) => {
      el.classList.remove('drag-source', 'drag-target', 'drag-target-invalid');
    });
  }

  _updateDragVisualTarget(targetEl) {
    if (!this._dragState) return;
    document.querySelectorAll('.drag-target, .drag-target-invalid').forEach((el) => {
      el.classList.remove('drag-target', 'drag-target-invalid');
    });
    const dstDesc = this._describeSlotElement(targetEl);
    this._dragState.dstDesc = dstDesc;
    if (dstDesc && dstDesc.el) {
      const dstItem = this._readSlotItem(dstDesc);
      const ok = this._canAcceptItem(dstDesc, this._dragState.srcItem) &&
        (!dstItem || this._canAcceptItem(this._dragState.srcDesc, dstItem));
      dstDesc.el.classList.add(ok ? 'drag-target' : 'drag-target-invalid');
      if (this._dragState.mode === 'gamepad') {
        const r = dstDesc.el.getBoundingClientRect();
        this._showDragGhost(this._dragState.srcItem, r.left + r.width / 2, r.top - 16);
      }
    }
  }

  startDragFromSelected() {
    if (this._dragState) return true;
    const el = this._selectedEl;
    const srcDesc = this._describeSlotElement(el);
    const srcItem = this._readSlotItem(srcDesc);
    if (!srcDesc || !srcItem) return false;

    this._dragState = { mode: 'gamepad', srcDesc, srcItem, dstDesc: srcDesc };
    if (window.soundEngine && window.soundEngine.playInvPickup) {
      try { window.soundEngine.playInvPickup(); } catch (e) {}
    }
    if (srcDesc.el) srcDesc.el.classList.add('drag-source');
    const r = srcDesc.el.getBoundingClientRect();
    this._showDragGhost(srcItem, r.left + r.width / 2, r.top - 16);
    return true;
  }

  finishDragToSelected() {
    if (!this._dragState) return false;
    const { srcDesc, dstDesc } = this._dragState;
    const finalDst = dstDesc || this._describeSlotElement(this._selectedEl);
    this.cancelDrag();
    if (srcDesc && finalDst) {
      return this.performSlotDrop(srcDesc, finalDst);
    }
    return false;
  }

  cancelDrag() {
    this._dragState = null;
    this._pendingMouseDrag = null;
    this._hideDragGhost();
    this._clearDragHighlights();
  }

  _bindDragAndDrop() {
    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const srcDesc = this._describeSlotElement(e.target);
      if (!srcDesc) return;
      const srcItem = this._readSlotItem(srcDesc);
      if (!srcItem) return;
      this._pendingMouseDrag = {
        startX: e.clientX,
        startY: e.clientY,
        srcDesc,
        srcItem
      };
    });

    document.addEventListener('mousemove', (e) => {
      if (this._pendingMouseDrag && !this._dragState) {
        const dist = Math.hypot(e.clientX - this._pendingMouseDrag.startX, e.clientY - this._pendingMouseDrag.startY);
        if (dist >= 6) {
          this._dragState = {
            mode: 'mouse',
            srcDesc: this._pendingMouseDrag.srcDesc,
            srcItem: this._pendingMouseDrag.srcItem,
            dstDesc: null
          };
          if (window.soundEngine && window.soundEngine.playInvPickup) {
            try { window.soundEngine.playInvPickup(); } catch (e) {}
          }
          if (this._dragState.srcDesc.el) this._dragState.srcDesc.el.classList.add('drag-source');
          this.hideItemPopout();
        }
      }
      if (this._dragState && this._dragState.mode === 'mouse') {
        this._showDragGhost(this._dragState.srcItem, e.clientX, e.clientY);
        const under = document.elementFromPoint(e.clientX, e.clientY);
        this._updateDragVisualTarget(under);
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      if (this._dragState && this._dragState.mode === 'mouse') {
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const dstDesc = this._describeSlotElement(under);
        const srcDesc = this._dragState.srcDesc;
        this._suppressNextClickUntil = performance.now() + 140;
        this.cancelDrag();
        if (srcDesc && dstDesc) {
          this.performSlotDrop(srcDesc, dstDesc);
        }
      } else {
        this._pendingMouseDrag = null;
      }
    });

    // Suppress synthetic click right after completing a drag-and-drop so popups don't flash open
    document.addEventListener('click', (e) => {
      if (this._suppressNextClickUntil && performance.now() < this._suppressNextClickUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  _defaultProfile() {
    return {
      credits: 12500,
      xp: 0,
      raids: 0,
      extracts: 0,
      missions: {
        active: ['m_scav_hunt', 'm_clean_exfil'],
        progress: {},
        completed: []
      },
      loadout: {
        primary: 'mp5k',
        secondary: 'pm9',
        backpackWeapon: null,
        melee: 'melee_knife',
        armor: 'vest_2plate',
        backpack: 'bag_small',
        fieldUpgrade: 'fu_ammo_box',
        killstreak: 'ks_uav',
        selfRevive: 'self_revive',
        headgear: null,
        plates: 3,
        lethal: 'frag_grenade',
        lethalQty: 2,
        tactical: 'smoke_grenade',
        tacticalQty: 2,
        backpackItems: [
          { id: 'medkit', qty: 2 }
        ],
        ammo: {
          ammo_9x19: 90,
          ammo_9x18: 24
        }
      },
      weaponStash: [
        { id: 'ak74m', qty: 1 },
        { id: 'm870', qty: 1 },
        { id: 'm24', qty: 1 },
        { id: 'g17', qty: 1 }
      ],
      stash: [
        { id: 'bag_weapon', qty: 1 },
        { id: 'ammo_545', qty: 60 },
        { id: 'medkit', qty: 2 },
        { id: 'armor_plate', qty: 3 },
        { id: 'throwing_knife', qty: 2 },
        { id: 'concussion_grenade', qty: 2 },
        { id: 'water_filter', qty: 1 },
        { id: 'scrap_metal', qty: 6 },
        { id: 'cloth_roll', qty: 5 },
        { id: 'gunpowder', qty: 4 },
        { id: 'polymer_parts', qty: 4 }
      ],
      social: {
        username: 'NOMAD',
        tagId: String(1000 + Math.floor(Math.random() * 9000)),
        callsign: null,
        friends: [],
        incomingFriendRequests: [],
        outgoingFriendRequests: []
      }
    };
  }

  _normalizeStash() {
    if (!this.profile) return;
    if (!Array.isArray(this.profile.weaponStash)) this.profile.weaponStash = [];
    if (!Array.isArray(this.profile.stash)) this.profile.stash = [];
    const L = this.profile.loadout || (this.profile.loadout = {});
    if (!Array.isArray(L.backpackItems)) L.backpackItems = [];

    // Move any weapons currently in regular stash into the 15 dedicated double-wide weapon stash slots!
    const nonWeapons = [];
    for (const item of this.profile.stash) {
      if (!item || !GAME_DATA.ITEMS[item.id]) continue;
      const def = GAME_DATA.ITEMS[item.id];
      if (def.type === 'weapon') {
        const count = Math.max(1, item.qty || 1);
        for (let c = 0; c < count; c++) {
          if (this.profile.weaponStash.length < 16) {
            this.profile.weaponStash.push({
              id: item.id,
              qty: 1,
              ...(item.mods ? { mods: item.mods } : {}),
              ...(item.rarityOverride ? { rarityOverride: item.rarityOverride } : {})
            });
          }
        }
      } else {
        nonWeapons.push(item);
      }
    }
    this.profile.stash = nonWeapons;

    // Ensure regular 1x1 backpackItems never contain weapons
    const bagDef = GAME_DATA.ITEMS[L.backpack || 'bag_small'];
    const hasWpnSlot = !!(bagDef && bagDef.weaponSlot);
    if (!hasWpnSlot && L.backpackWeapon) {
      if (this.profile.weaponStash.length < 16) {
        this.profile.weaponStash.push({
          id: L.backpackWeapon,
          qty: 1,
          ...(L.backpackWeaponMods ? { mods: L.backpackWeaponMods } : {}),
          ...(L.backpackWeaponRarity ? { rarityOverride: L.backpackWeaponRarity } : {})
        });
      }
      L.backpackWeapon = null;
      L.backpackWeaponMods = null;
      L.backpackWeaponRarity = null;
    }
    L.backpackItems = L.backpackItems.filter((item) => {
      if (!item || !GAME_DATA.ITEMS[item.id]) return false;
      const def = GAME_DATA.ITEMS[item.id];
      if (def.type === 'weapon') {
        if (hasWpnSlot && !L.backpackWeapon) {
          L.backpackWeapon = item.id;
          if (item.mods) L.backpackWeaponMods = item.mods;
          if (item.rarityOverride) L.backpackWeaponRarity = item.rarityOverride;
        } else if (this.profile.weaponStash.length < 16) {
          this.profile.weaponStash.push({
            id: item.id,
            qty: 1,
            ...(item.mods ? { mods: item.mods } : {}),
            ...(item.rarityOverride ? { rarityOverride: item.rarityOverride } : {})
          });
        }
        return false;
      }
      return true;
    });
  }

  _updateDynamicUiScale() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const vv = window.visualViewport;
    const w = Math.max(320, (vv && vv.width) || window.innerWidth || 1560);
    const h = Math.max(240, (vv && vv.height) || window.innerHeight || 880);

    // Smooth responsive UI scale relative to 1560x880 design canvas (scales down cleanly on compact/laptop windows so zero UI gets cut off)
    const rawScale = Math.min(w / 1560, h / 880);
    const uiScale = Math.min(1.10, Math.max(0.50, rawScale));
    this._currentUiScale = uiScale;

    // Dedicated Inventory/Loot panel scale accounting for actual rendered panel height & dual-panel width
    const opPanel = document.getElementById('inv-operator-panel');
    const cPanel = document.getElementById('inv-container-panel');
    const lootMod = document.getElementById('loot-modal');
    const lootOpen = !!(lootMod && !lootMod.classList.contains('hidden'));
    const opH = (lootOpen && opPanel && opPanel.offsetHeight > 40) ? opPanel.offsetHeight : 735;
    const hasCont = !!(lootOpen && cPanel && !cPanel.classList.contains('hidden') && cPanel.offsetHeight > 40);
    const cH = hasCont ? cPanel.offsetHeight : 0;
    const reqH = Math.max(735, opH, cH);
    const reqW = hasCont ? 860 : 445;
    const invScale = Math.min(uiScale, Math.max(0.45, Math.min((w - 32) / reqW, (h - 28) / reqH)));
    this._currentInvScale = invScale;

    document.documentElement.style.setProperty('--ui-scale', uiScale.toFixed(4));
    document.documentElement.style.setProperty('--inv-scale', invScale.toFixed(4));

    if (hasCont && this._lastLootCamera) {
      this.positionContainerPanel(this._lastLootCamera);
    }
  }

  _updateDeployResponsiveScale() {
    const deployEl = document.getElementById('menu-view-deploy');
    if (!deployEl || deployEl.classList.contains('hidden')) return;
    const uiScale = this._currentUiScale || 1;
    const virtH = Math.round(window.innerHeight / uiScale);
    const virtW = Math.round(window.innerWidth / uiScale);
    const topbar = document.getElementById('menu-topbar');
    const topH = (topbar && !topbar.classList.contains('hidden')) ? topbar.offsetHeight : 54;
    const availH = Math.max(360, virtH - topH - 36);
    const availW = Math.max(640, virtW - 48);

    // Left panel: 3 rows of 5 double-wide weapon slots (10 single cols wide) + 8 rows of 8 item slots = 11 slot rows + headers
    const maxSlotHLeft = Math.floor((availH - 116) / 11);
    // Right panel: up to 4 rows of backpack + 4 rows of operator equipment = 8 slot rows + headers + summary + button
    const maxSlotHRight = Math.floor((availH - 188) / 8);
    // Horizontal: 10 single-slot columns on left + 5 single-slot columns on right = 15 columns + gaps & paddings
    const maxSlotW = Math.floor((availW - 135) / 15);

    const slotPx = Math.max(34, Math.min(62, maxSlotHLeft, maxSlotHRight, maxSlotW));
    deployEl.style.setProperty('--deploy-slot', `${slotPx}px`);
  }

  _generateUniqueTagId(baseName) {
    const taken = new Set();
    const upper = (baseName || 'NOMAD').toUpperCase();
    for (const p of (this.onlinePlayers || [])) {
      if (p.name && p.name.startsWith(upper + '#')) taken.add(p.name.split('#')[1]);
    }
    for (const f of ((this.profile && this.profile.social && this.profile.social.friends) || [])) {
      if (f.name && f.name.startsWith(upper + '#')) taken.add(f.name.split('#')[1]);
    }
    let id = '';
    for (let tries = 0; tries < 50; tries++) {
      id = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      if (!taken.has(id)) break;
    }
    return id;
  }

  _ensureIdentity() {
    if (!this.profile.social) {
      this.profile.social = { username: 'NOMAD', tagId: '', callsign: '', friends: [] };
    }
    const s = this.profile.social;
    // Strip legacy hardcoded fake friends if migrating from an older save
    if (Array.isArray(s.friends)) {
      s.friends = s.friends.filter(f => f && f.name !== 'GHOST_ACTUAL' && f.name !== 'KESTREL');
    } else {
      s.friends = [];
    }
    if (!s.username || !s.tagId || !s.callsign || !/#\d{4}$/.test(s.callsign)) {
      const base = (s.username || (s.callsign ? s.callsign.split('#')[0] : 'NOMAD'))
        .toUpperCase().replace(/[^A-Z0-9_\-]/g, '').slice(0, 14) || 'NOMAD';
      s.username = base;
      s.tagId = /^\d{4}$/.test(s.tagId || '') ? s.tagId : this._generateUniqueTagId(base);
      s.callsign = `${s.username}#${s.tagId}`;
      this.saveProfile();
    }
  }

  updateUsername(rawName) {
    const clean = (rawName || '').trim().toUpperCase().replace(/[^A-Z0-9_\-]/g, '').slice(0, 14);
    if (!clean) {
      this._showSocialToast('Enter a valid username (letters, numbers, _, -).');
      return;
    }
    const oldCallsign = this.profile.social.callsign;
    const newTag = this._generateUniqueTagId(clean);
    const newCallsign = `${clean}#${newTag}`;
    this.profile.social.username = clean;
    this.profile.social.tagId = newTag;
    this.profile.social.callsign = newCallsign;

    if (this.partyHost === oldCallsign) this.partyHost = newCallsign;
    for (const m of (this.partyMembers || [])) {
      if (m.isSelf) m.name = newCallsign;
    }
    this.saveProfile();
    if (this._sendSocialPacket) {
      this._sendSocialPacket({
        type: 'rename',
        clientId: this._clientId,
        oldName: oldCallsign,
        from: newCallsign,
        status: 'ONLINE',
        ts: Date.now()
      });
    }
    this._broadcastPresence();
    this._syncUsernameSettingsUI();
    this.renderSocial();
    this.renderHideout();
    this._showSocialToast(`Username updated to ${newCallsign}`);
  }

  _syncUsernameSettingsUI() {
    const curEl = document.getElementById('setting-current-id');
    const inpEl = document.getElementById('setting-username');
    if (curEl && this.profile && this.profile.social) {
      curEl.textContent = this.profile.social.callsign;
    }
    if (inpEl && this.profile && this.profile.social && document.activeElement !== inpEl) {
      inpEl.value = this.profile.social.username || '';
    }
  }

  assignSquadColors() {
    const palette = (GAME_DATA && GAME_DATA.SQUAD_COLORS) || ['#69f0ae', '#42a5f5', '#ffeb3b', '#ff69b4'];
    const multi = (this.partyMembers || []).length > 1;
    (this.partyMembers || []).forEach((m, idx) => {
      m.squadColor = multi ? palette[idx % palette.length] : '#69f0ae';
    });
  }

  _initLiveUpdateTracker() {
    let badge = document.getElementById('menu-update-badge');
    const verBadge = document.getElementById('menu-version-badge');
    if (!badge && verBadge && verBadge.parentElement) {
      badge = document.createElement('button');
      badge.id = 'menu-update-badge';
      badge.className = 'menu-update-badge hidden';
      badge.title = 'Click to reload into the latest version';
      badge.textContent = 'NEW VERSION AVAILABLE';
      verBadge.parentElement.insertBefore(badge, verBadge);
    }
    if (!badge) return;

    let latestAvailable = null;
    const raidBadge = document.getElementById('raid-update-badge');
    const parseVer = (v) => {
      if (window.GAME_DATA && window.GAME_DATA.parseVersion) {
        const p = window.GAME_DATA.parseVersion(v);
        return p ? [p.major, p.minor, p.patch] : null;
      }
      const s = String(v || '').trim();
      const m3 = s.match(/\b(\d+)\.(\d+)\.(\d+)\b/);
      if (m3) return [parseInt(m3[1], 10) || 0, parseInt(m3[2], 10) || 0, parseInt(m3[3], 10) || 0];
      // Legacy pre-0.2.65 "v2.64" strings map below 0.2.65 so old clients never trigger false update alerts
      const mLegacy = s.match(/^v(\d+)\.(\d+)$/i);
      if (mLegacy) return [0, parseInt(mLegacy[1], 10) || 0, parseInt(mLegacy[2], 10) || 0];
      return null;
    };
    const isNewer = (remote, local) => {
      if (!remote || !local) return false;
      if (window.GAME_DATA && window.GAME_DATA.isNewerVersion) {
        return window.GAME_DATA.isNewerVersion(remote, local);
      }
      const r = parseVer(remote);
      const l = parseVer(local);
      if (!r || !l) return false;
      for (let i = 0; i < 3; i++) {
        const rv = r[i] || 0;
        const lv = l[i] || 0;
        if (rv > lv) return true;
        if (rv < lv) return false;
      }
      return false;
    };

    const syncUpdateBadges = () => {
      const localVer = (window.GAME_DATA && GAME_DATA.VERSION) || (verBadge && verBadge.textContent.trim()) || '';
      if (!latestAvailable || !isNewer(latestAvailable, localVer)) {
        latestAvailable = null;
        badge.classList.add('hidden');
        if (raidBadge) raidBadge.classList.add('hidden');
        return;
      }
      const inRaidNow = typeof window.isInRaid === 'function' && window.isInRaid();
      badge.textContent = `NEW VERSION AVAILABLE (${latestAvailable})`;
      badge.style.opacity = '1';
      badge.classList.remove('hidden');
      if (raidBadge) {
        if (inRaidNow) {
          raidBadge.textContent = `NEW VERSION (${latestAvailable}) — EXFIL & UPDATE`;
          raidBadge.style.opacity = '1';
          raidBadge.classList.remove('hidden');
        } else {
          raidBadge.classList.add('hidden');
        }
      }
    };
    this.syncUpdateBadges = syncUpdateBadges;

    const reportRemoteVersion = (remoteVer) => {
      const cleanRemote = String(remoteVer || '').trim();
      const localVer = (window.GAME_DATA && GAME_DATA.VERSION) || (verBadge && verBadge.textContent.trim()) || '';
      if (!cleanRemote || !localVer) return false;
      if (isNewer(cleanRemote, localVer)) {
        const isFirstNotice = !latestAvailable;
        if (!latestAvailable || isNewer(cleanRemote, latestAvailable)) {
          latestAvailable = cleanRemote;
        }
        syncUpdateBadges();
        if (isFirstNotice && typeof window.isInRaid === 'function' && window.isInRaid() && this.addFeedMessage) {
          this.addFeedMessage(`Update ${latestAvailable} available — press ESC & click EXFIL & UPDATE to keep loot`, '#69f0ae');
        }
        return true;
      }
      return false;
    };
    this._reportRemoteVersion = reportRemoteVersion;

    const triggerUpdateReload = () => {
      const inRaidNow = typeof window.isInRaid === 'function' && window.isInRaid();
      if (inRaidNow && typeof window.devExfilRaid === 'function') {
        if (raidBadge) raidBadge.textContent = 'EXFIL SAVED — RELOADING...';
        window.devExfilRaid({ skipSummary: true });
      }
      const bust = encodeURIComponent(latestAvailable || Date.now());
      const base = window.location.origin + window.location.pathname;
      window.location.replace(`${base}?v=${bust}&t=${Date.now()}`);
    };

    badge.addEventListener('click', triggerUpdateReload);
    if (raidBadge) raidBadge.addEventListener('click', triggerUpdateReload);

    const extractVer = (txt) => {
      if (!txt) return null;
      const m1 = txt.match(/VERSION\s*:\s*['"]([^'"]+)['"]/);
      if (m1 && m1[1]) return m1[1].trim();
      const m2 = txt.match(/id=["']menu-version-badge["'][^>]*>\s*([^<]+?)\s*</i);
      if (m2 && m2[1] && /\d+\.\d+\.\d+/.test(m2[1])) return m2[1].trim();
      return null;
    };

    let lastGhApiCheck = 0;
    const checkGitHubApi = () => {
      const now = Date.now();
      if (now - lastGhApiCheck < 20000) return;
      lastGhApiCheck = now;
      // GitHub REST API commits/main has ZERO 5-minute Fastly cache — updates in <1s of a push!
      fetch(`https://api.github.com/repos/LaikaXvi/ashfall/commits/main?t=${now}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then((data) => {
          const msg = data && data.commit && data.commit.message;
          if (!msg) return;
          const firstLine = String(msg).split(/\r?\n/)[0] || '';
          const m = firstLine.match(/\b(?:(?:Alpha|Beta)(?:\s+RC)?\s+)?0\.\d+\.\d+\b/i);
          if (m && m[0]) {
            const found = m[0].trim();
            const parsed = window.GAME_DATA && window.GAME_DATA.parseVersion ? window.GAME_DATA.parseVersion(found) : null;
            const normalized = (parsed && !parsed.tag && window.GAME_DATA && GAME_DATA.VERSION_INFO)
              ? `${GAME_DATA.VERSION_INFO.channel} ${GAME_DATA.VERSION_INFO.stage} ${parsed.major}.${parsed.minor}.${parsed.patch}`.replace(/\s+/g, ' ').trim()
              : found;
            reportRemoteVersion(normalized);
          }
        })
        .catch(() => {});
    };

    const checkPagesLive = () => {
      if (window.location.protocol === 'file:') return;
      const ts = Date.now();
      fetch(`./js/data.js?nocache=${ts}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.text() : ''))
        .then((txt) => {
          const v = extractVer(txt);
          if (v) reportRemoteVersion(v);
        })
        .catch(() => {});
      fetch(`./index.html?nocache=${ts}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.text() : ''))
        .then((txt) => {
          const v = extractVer(txt);
          if (v) reportRemoteVersion(v);
        })
        .catch(() => {});
    };

    setTimeout(() => { checkGitHubApi(); checkPagesLive(); }, 1000);
    this._updateCheckInterval = setInterval(checkPagesLive, 20000);
    this._updateApiInterval = setInterval(checkGitHubApi, 65000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkGitHubApi();
        checkPagesLive();
      }
    });
    window.addEventListener('focus', () => {
      checkGitHubApi();
      checkPagesLive();
    });
  }

  _initSocial() {
    this._ensureIdentity();
    this._clientId = 'cli_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
    this.partyId = 'p_' + this._clientId;
    this.partyHost = this.profile.social.callsign;
    this.partyMembers = [{
      clientId: this._clientId,
      name: this.profile.social.callsign,
      isSelf: true,
      isLeader: true,
      isRemoteHuman: false,
      ready: false,
      squadColor: '#69f0ae'
    }];
    this.pendingPartyInvite = null; // { partyId, from, fromClientId, leaderWeapon }

    // REAL online clients only (cross-device live WebSocket lobby + local same-browser fallback, zero fake players!)
    this.onlinePlayers = [];
    this._peers = new Map(); // clientId -> { clientId, name, status, ts }
    this._knownRealUsers = new Set(); // verified real operator callsigns seen from live clients
    this._presenceKey = 'ashfall_online_clients_v2';
    this._lobbyTopic = 'ashfall_s7_lobby_presence_v3';
    this._wsConnected = false;
    this._wsRetryMs = 3000;
    this._ws = null;
    this._seenPktIds = new Set();

    const PEER_TTL_MS = 35000;

    this._rebuildOnlineList = () => {
      const now = Date.now();
      const myName = (this.profile && this.profile.social && this.profile.social.callsign) || '';

      // Merge any same-browser localStorage tabs too
      try {
        const localMap = JSON.parse(localStorage.getItem(this._presenceKey) || '{}') || {};
        for (const [cid, entry] of Object.entries(localMap)) {
          if (!entry || now - (entry.ts || 0) > 15000) continue;
          if (cid !== this._clientId && entry.name) {
            const cur = this._peers.get(cid);
            if (!cur || (entry.ts || 0) >= (cur.ts || 0)) {
              this._peers.set(cid, { clientId: cid, name: entry.name, status: entry.status || 'ONLINE', ts: entry.ts || now });
            }
            this._knownRealUsers.add(entry.name.toUpperCase());
          }
        }
      } catch (e) {}

      // Prune stale peers & deduplicate by callsign (keeping freshest entry)
      const byName = new Map();
      for (const [cid, peer] of this._peers.entries()) {
        if (!peer || !peer.name || now - (peer.ts || 0) > PEER_TTL_MS) {
          this._peers.delete(cid);
          continue;
        }
        if (cid === this._clientId) continue;
        if (peer.name.toUpperCase() === myName.toUpperCase()) continue;
        this._knownRealUsers.add(peer.name.toUpperCase());
        const existing = byName.get(peer.name.toUpperCase());
        if (!existing || peer.ts > existing.ts) {
          byName.set(peer.name.toUpperCase(), {
            clientId: cid,
            name: peer.name,
            status: peer.status || 'ONLINE',
            ts: peer.ts
          });
        }
      }

      this.onlinePlayers = Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
      this.renderSocial();
    };

    this._handleSocialPacket = (msg, serverTimeSec = null) => {
      if (!msg || !msg.clientId || msg.clientId === this._clientId) return;
      if (msg.pid && this._seenPktIds.has(msg.pid)) return;
      if (msg.pid) this._seenPktIds.add(msg.pid);
      const now = Date.now();
      const myName = (this.profile && this.profile.social && this.profile.social.callsign || '').toUpperCase();

      // Use server receipt time (or local Date.now() for live WS) — NEVER sender's PC clock, which can have clock skew!
      const effectiveTs = (typeof serverTimeSec === 'number' && serverTimeSec > 0)
        ? Math.min(now, serverTimeSec * 1000)
        : now;

      if (msg.type === 'version_announce' && msg.version) {
        if (this._reportRemoteVersion) this._reportRemoteVersion(msg.version);
        return;
      }

      if (msg.type === 'fob_pos') {
        const partyList = Array.isArray(this.partyMembers) ? this.partyMembers : [];
        const member = partyList.find(m => m.clientId === msg.clientId);
        const sameParty = (msg.partyId && this.partyId && msg.partyId === this.partyId) || !!member;
        if (sameParty && window.hideoutBunker && window.hideoutBunker.upsertRemoteAvatar) {
          window.hideoutBunker.upsertRemoteAvatar(
            msg.clientId,
            (member && member.name) || msg.from || 'SQUAD',
            Number(msg.x) || 0,
            Number(msg.y) || 0,
            Number(msg.z) || 0,
            Number(msg.yaw) || 0,
            {
              squadColor: (member && member.squadColor) || msg.squadColor || '#69f0ae',
              isLeader: member ? !!member.isLeader : !!msg.isLeader,
              status: (member && member.ready) ? 'READY' : (msg.status || ''),
              inParty: true
            }
          );
        }
        return;
      }

      if (msg.type === 'party_full' && msg.toClientId === this._clientId) {
        this.partyId = 'p_' + this._clientId;
        this.partyHost = this.profile.social.callsign;
        this.partyMembers = [{
          clientId: this._clientId,
          name: this.profile.social.callsign,
          isSelf: true,
          isLeader: true,
          isRemoteHuman: false,
          ready: false,
          squadColor: '#69f0ae'
        }];
        this._partyReady = false;
        this.syncFobParty(false);
        this.renderSocial();
        this.renderHideout();
        this._showSocialToast(`${msg.hostName || 'Host'}'s party is full (3/3).`);
        return;
      }

      if (msg.type === 'presence_req') {
        // Newly connected player asked who is online — reply immediately!
        if (this._broadcastPresence) this._broadcastPresence();
        return;
      }

      if (msg.type === 'presence' || msg.type === 'rename') {
        if (msg.ver && this._reportRemoteVersion) this._reportRemoteVersion(msg.ver);
        const name = (msg.from || msg.name || '').trim().toUpperCase();
        if (!name) return;
        if (now - effectiveTs > PEER_TTL_MS) return;
        this._peers.set(msg.clientId, {
          clientId: msg.clientId,
          name,
          status: msg.status || 'ONLINE',
          ts: effectiveTs
        });
        this._knownRealUsers.add(name);
        // Re-deliver any pending outgoing friend request addressed to this newly-seen online player!
        const outReqs = (this.profile && this.profile.social && this.profile.social.outgoingFriendRequests) || [];
        const pendingOut = outReqs.find(r => r && r.to && r.to.toUpperCase() === name);
        if (pendingOut && (!pendingOut._lastRedeliver || now - pendingOut._lastRedeliver > 8000)) {
          pendingOut._lastRedeliver = now;
          this._sendSocialPacket({
            type: 'friend_request',
            clientId: this._clientId,
            from: this.profile.social.callsign,
            to: name,
            toClientId: msg.clientId,
            ts: now
          });
        }
        if (msg.type === 'rename' && msg.oldName) {
          const oldUp = msg.oldName.toUpperCase();
          const f = (this.profile.social.friends || []).find(it => it.name.toUpperCase() === oldUp);
          if (f) {
            f.name = name;
            this.saveProfile();
          }
        }
        this._rebuildOnlineList();
        return;
      }

      if (msg.type === 'leave') {
        this._peers.delete(msg.clientId);
        // Remove disconnected player from party if they were in our party
        const idx = this.partyMembers.findIndex(m => !m.isSelf && m.clientId === msg.clientId);
        if (idx !== -1) {
          const left = this.partyMembers.splice(idx, 1)[0];
          this.assignSquadColors();
          this._showSocialToast(`${left.name} disconnected from party.`);
          if (this.matchmakingStage && this.matchmakingStage.active) this.matchmakingStage.refreshSquadUI(true);
        }
        this._rebuildOnlineList();
        return;
      }

      // === REAL CROSS-DEVICE FRIEND REQUESTS (ACCEPT / DECLINE SYNCED ON BOTH ENDS) ===
      const isAddressedToMe = (msg.toClientId && msg.toClientId === this._clientId) ||
        (msg.to && msg.to.toUpperCase() === myName);

      if (msg.type === 'friend_request' && isAddressedToMe) {
        const fromName = (msg.from || 'OPERATOR').trim().toUpperCase();
        if (!fromName || fromName === myName) return;
        const social = this.profile.social;
        if (!Array.isArray(social.friends)) social.friends = [];
        if (!Array.isArray(social.incomingFriendRequests)) social.incomingFriendRequests = [];
        if (!Array.isArray(social.outgoingFriendRequests)) social.outgoingFriendRequests = [];
        if (social.friends.some(f => f.name.toUpperCase() === fromName)) return;
        if (!social.incomingFriendRequests.some(r => r.from.toUpperCase() === fromName)) {
          social.incomingFriendRequests.push({
            from: fromName,
            fromClientId: msg.clientId,
            ts: now
          });
          this.saveProfile();
          this.renderSocial();
          this._showSocialToast(`Friend request from ${fromName}! Accept or Decline in COMMS.`);
        }
        return;
      }

      if (msg.type === 'friend_accept' && isAddressedToMe) {
        const fromName = (msg.from || 'OPERATOR').trim().toUpperCase();
        if (!fromName || fromName === myName) return;
        const social = this.profile.social;
        if (!Array.isArray(social.friends)) social.friends = [];
        social.outgoingFriendRequests = (social.outgoingFriendRequests || []).filter(r => r.to.toUpperCase() !== fromName);
        social.incomingFriendRequests = (social.incomingFriendRequests || []).filter(r => r.from.toUpperCase() !== fromName);
        if (!social.friends.some(f => f.name.toUpperCase() === fromName)) {
          social.friends.push({ name: fromName, favorite: false });
        }
        this.saveProfile();
        this.renderSocial();
        this._showSocialToast(`${fromName} accepted your friend request! You are now friends.`);
        return;
      }

      if (msg.type === 'friend_decline' && isAddressedToMe) {
        const fromName = (msg.from || 'OPERATOR').trim().toUpperCase();
        if (!fromName) return;
        const social = this.profile.social;
        const hadOut = (social.outgoingFriendRequests || []).some(r => r.to.toUpperCase() === fromName);
        const hadIn = (social.incomingFriendRequests || []).some(r => r.from.toUpperCase() === fromName);
        social.outgoingFriendRequests = (social.outgoingFriendRequests || []).filter(r => r.to.toUpperCase() !== fromName);
        social.incomingFriendRequests = (social.incomingFriendRequests || []).filter(r => r.from.toUpperCase() !== fromName);
        if (hadOut || hadIn) {
          this.saveProfile();
          this.renderSocial();
          if (hadOut) this._showSocialToast(`${fromName} declined your friend request.`);
        }
        return;
      }

      // === REAL CROSS-DEVICE PARTY INVITES, JOINS, READY-UP & SYNCHRONIZED DEPLOY ===

      if (msg.type === 'party_invite' && isAddressedToMe) {
        if (now - effectiveTs > 45000) return;
        this.pendingPartyInvite = {
          partyId: msg.partyId,
          from: (msg.from || 'OPERATOR').toUpperCase(),
          fromClientId: msg.clientId,
          leaderWeapon: msg.leaderWeapon || 'ak74m'
        };
        this._showSocialToast(`Party invite from ${this.pendingPartyInvite.from}! Click ACCEPT in COMMS.`);
        this.renderSocial();
        return;
      }

      if ((msg.type === 'party_accept' || msg.type === 'party_join_req') && isAddressedToMe) {
        if (!this.isPartyLeader()) {
          // If someone clicked Join on a non-leader member, ignore (only party host manages roster & FOB)
          return;
        }
        const joinName = (msg.from || 'OPERATOR').toUpperCase();
        const alreadyIn = this.partyMembers.some(m => m.clientId === msg.clientId || m.name.toUpperCase() === joinName);
        if (!alreadyIn && this.partyMembers.length >= 3) {
          this._sendSocialPacket({
            type: 'party_full',
            clientId: this._clientId,
            toClientId: msg.clientId,
            hostName: this.partyHost
          });
          return;
        }
        if (!alreadyIn) {
          this.partyMembers.push({
            clientId: msg.clientId,
            name: joinName,
            isSelf: false,
            isLeader: false,
            isRemoteHuman: true,
            weaponId: msg.weaponId || 'ak74m',
            gearLabel: msg.gearLabel || 'OPERATOR',
            ready: false
          });
        }
        this.assignSquadColors();
        this._broadcastPartySync();
        setTimeout(() => { if (this.isPartyLeader()) this._broadcastPartySync(); }, 1100);
        this.syncFobParty(false);
        this.renderSocial();
        this.renderHideout();
        if (this.matchmakingStage && this.matchmakingStage.active) this.matchmakingStage.refreshSquadUI(true);
        if (!alreadyIn) this._showSocialToast(`${joinName} joined your FOB (${this.partyMembers.length}/3)!`);
        return;
      }

      if (msg.type === 'party_sync' && msg.partyId && Array.isArray(msg.members)) {
        const includesMe = msg.members.some(m => m.clientId === this._clientId || (m.name && m.name.toUpperCase() === myName));
        if (msg.partyId !== this.partyId && !includesMe) return;
        const prevPartyId = this.partyId;
        this.partyId = msg.partyId;
        this._partySynced = true;
        const myPrev = this.partyMembers.find(m => m.isSelf);
        this.partyHost = msg.hostName || this.partyHost;
        this.partyMembers = msg.members.slice(0, 3).map((m) => ({
          clientId: m.clientId,
          name: m.name,
          isSelf: m.clientId === this._clientId,
          isLeader: !!m.isLeader,
          isRemoteHuman: m.clientId !== this._clientId,
          weaponId: m.weaponId || 'ak74m',
          gearLabel: m.gearLabel || 'OPERATOR',
          ready: m.clientId === this._clientId ? (myPrev ? !!myPrev.ready : !!m.ready) : !!m.ready
        }));
        if (typeof msg.pvp === 'boolean') {
          window.SQUAD_PVP = msg.pvp;
          if (window.SQUAD_PVP) window.DEV_MODE = false;
          if (this.syncSettingsUI) this.syncSettingsUI();
        }
        this.assignSquadColors();
        this.syncFobParty(prevPartyId !== this.partyId);
        this.renderSocial();
        this.renderHideout();
        if (this.matchmakingStage && this.matchmakingStage.active) this.matchmakingStage.refreshSquadUI(true);
        return;
      }

      if (msg.type === 'party_ready' && msg.partyId && msg.partyId === this.partyId) {
        const m = this.partyMembers.find(it => it.clientId === msg.clientId || it.name.toUpperCase() === (msg.from || '').toUpperCase());
        if (m) {
          m.ready = !!msg.ready;
          this.syncFobParty(false);
          this.renderSocial();
          this.renderPreMatchLoadout();
          if (this.matchmakingStage && this.matchmakingStage.active) {
            this.matchmakingStage.refreshSquadUI(false);
          }
        }
        return;
      }

      if (msg.type === 'party_leave' && msg.partyId && msg.partyId === this.partyId) {
        const idx = this.partyMembers.findIndex(it => it.clientId === msg.clientId);
        if (idx !== -1) {
          const left = this.partyMembers.splice(idx, 1)[0];
          if (left.isLeader) {
            // Leader disbanded -> return everyone to their own solo party
            this.partyId = 'p_' + this._clientId;
            this.partyHost = this.profile.social.callsign;
            this.partyMembers = [{
              clientId: this._clientId,
              name: this.profile.social.callsign,
              isSelf: true,
              isLeader: true,
              isRemoteHuman: false,
              ready: false,
              squadColor: '#69f0ae'
            }];
            this._showSocialToast(`${left.name} disbanded the party.`);
          } else {
            this._showSocialToast(`${left.name} left the party.`);
          }
          this.assignSquadColors();
          this.syncFobParty(false);
          this.renderSocial();
          this.renderHideout();
          if (this.matchmakingStage && this.matchmakingStage.active) this.matchmakingStage.refreshSquadUI(true);
        }
        return;
      }

      if (msg.type === 'party_stage' && msg.partyId && msg.partyId === this.partyId) {
        if (now - effectiveTs > 30000) return;
        const zoneId = msg.zoneId || 'outpost';
        const matchId = msg.matchId;
        const sel = document.getElementById('raid-zone-select');
        if (sel) sel.value = zoneId;
        this.openMenuTab('matchmaking');
        if (this.matchmakingStage) {
          this.matchmakingStage.start(zoneId, matchId);
        }
        this._showSocialToast(`Leader selected ${(GAME_DATA.ZONES[zoneId] || { name: zoneId }).name} — Click READY UP to start countdown!`);
        return;
      }

      if (msg.type === 'party_pvp' && msg.partyId && msg.partyId === this.partyId) {
        if (now - effectiveTs > 30000) return;
        window.SQUAD_PVP = !!msg.enabled;
        if (window.SQUAD_PVP) {
          window.DEV_MODE = false;
          if (typeof window.onSquadPvpForceFair === 'function') window.onSquadPvpForceFair();
        }
        this.renderHideout();
        if (this.syncSettingsUI) this.syncSettingsUI();
        this._showSocialToast(window.SQUAD_PVP ? 'Squad PvP: ON — Dev Mode disabled for squad' : 'Squad PvP (Friendly Fire): OFF');
        return;
      }

      if (msg.type === 'lobby_chat' && msg.msgId && msg.scope && msg.roomId) {
        if (this.receiveLobbyChatPacket) this.receiveLobbyChatPacket(msg);
        return;
      }

      if (msg.type === 'deploy_raid' && msg.partyId && msg.partyId === this.partyId) {
        if (now - effectiveTs > 25000) return;
        if (this.matchmakingStage) this.matchmakingStage.stop();
        if (this.onDeploy) {
          this.onDeploy(msg.zoneId || 'outpost', msg.matchId || null);
        }
      }
    };

    this._lobbyMqttTopic = 'ashfall/lobby/v4';
    this._sendSocialPacket = (payload, useBeacon = false) => {
      const fullPayload = {
        ...payload,
        pid: payload.pid || (this._clientId.slice(-6) + '_' + Math.random().toString(36).slice(2, 8))
      };
      // 1. Local same-browser tabs via BroadcastChannel
      try {
        if (this._socialChannel) this._socialChannel.postMessage(fullPayload);
      } catch (e) {}
      // 2. Global cross-device live lobby over persistent WSS MQTT (zero HTTP 429 rate limits!)
      try {
        if (this._netBus) {
          this._netBus.publish(this._lobbyMqttTopic, fullPayload);
        }
      } catch (e) {}
    };

    this._pollRemoteLobby = () => {};

    this._connectLobbyWS = () => {
      if (typeof AshfallNetBus === 'undefined') return;
      if (!this._netBus) {
        this._netBus = new AshfallNetBus({
          onOpen: () => {
            this._wsConnected = true;
            this._netBus.subscribe(this._lobbyMqttTopic);
            this._broadcastPresence();
            // Ask everyone currently online to announce themselves immediately!
            this._sendSocialPacket({
              type: 'presence_req',
              clientId: this._clientId,
              from: this.profile.social.callsign
            });
            this.renderSocial();
          },
          onClose: () => {
            this._wsConnected = false;
            this.renderSocial();
          },
          onMessage: (topic, pkt) => {
            if (topic === this._lobbyMqttTopic) {
              this._handleSocialPacket(pkt, null);
            } else if (this._netBusExtraHandler) {
              this._netBusExtraHandler(topic, pkt);
            }
          }
        });
        window.ashfallNetBus = this._netBus;
        window.ashfallSetExtraNetHandler = (fn) => { this._netBusExtraHandler = fn; };
      }
      this._netBus.subscribe(this._lobbyMqttTopic);
      this._netBus.connect();
    };

    this._broadcastPresence = () => {
      const now = Date.now();
      const myName = this.profile.social.callsign;
      // Update localStorage for same-browser tabs
      try {
        const map = JSON.parse(localStorage.getItem(this._presenceKey) || '{}') || {};
        map[this._clientId] = { name: myName, status: 'ONLINE', ts: now };
        for (const [cid, entry] of Object.entries(map)) {
          if (!entry || now - (entry.ts || 0) > 15000) delete map[cid];
        }
        localStorage.setItem(this._presenceKey, JSON.stringify(map));
      } catch (e) {}

      this._sendSocialPacket({
        type: 'presence',
        clientId: this._clientId,
        from: myName,
        status: 'ONLINE',
        ver: (window.GAME_DATA && GAME_DATA.VERSION) || '',
        ts: now
      });
      this._rebuildOnlineList();
    };

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this._socialChannel = new BroadcastChannel('ashfall_social_v2');
        this._socialChannel.onmessage = (ev) => this._handleSocialPacket(ev.data);
      }
    } catch (e) {}

    window.addEventListener('storage', (ev) => {
      if (ev.key === this._presenceKey) this._rebuildOnlineList();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this._broadcastPresence();
        if (!this._wsConnected) this._connectLobbyWS();
      }
    });

    const announceLeave = () => {
      try {
        const map = JSON.parse(localStorage.getItem(this._presenceKey) || '{}') || {};
        delete map[this._clientId];
        localStorage.setItem(this._presenceKey, JSON.stringify(map));
      } catch (e) {}
      this._sendSocialPacket({
        type: 'leave',
        clientId: this._clientId,
        from: this.profile.social.callsign,
        ts: Date.now()
      }, true);
    };
    window.addEventListener('beforeunload', announceLeave);
    window.addEventListener('pagehide', announceLeave);

    // Connect live WebSocket immediately, heartbeat every 18s, and prune stale peers every 5s
    this._connectLobbyWS();
    this._broadcastPresence();
    this._presenceInterval = setInterval(() => {
      this._broadcastPresence();
    }, 8000);
    this._pruneInterval = setInterval(() => this._rebuildOnlineList(), 5000);
  }

  _showSocialToast(msg) {
    const el = document.getElementById('social-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this._socialToastTimer);
    this._socialToastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
  }

  addFriendByName(rawQuery) {
    const cleaned = (rawQuery || '').trim().toUpperCase().replace(/[^A-Z0-9_\-#]/g, '').slice(0, 22);
    if (!cleaned) return;

    const myCallsign = (this.profile && this.profile.social && this.profile.social.callsign || '').toUpperCase();
    if (cleaned === myCallsign || cleaned === (this.profile.social.username || '').toUpperCase()) {
      this._showSocialToast('You cannot add yourself.');
      return;
    }

    // Strictly verify against REAL connected / recently seen clients — never allow adding fake/non-existent usernames!
    const onlineList = this.onlinePlayers || [];
    let verifiedTag = null;

    // 1. Exact full ID match against live online clients
    const exactOnline = onlineList.find(p => p.name.toUpperCase() === cleaned);
    if (exactOnline) {
      verifiedTag = exactOnline.name.toUpperCase();
    } else if (!/#\d{4}$/.test(cleaned)) {
      // 2. Prefix username match (without #1234) against live online clients
      const prefixMatches = onlineList.filter(p => p.name.toUpperCase().startsWith(cleaned + '#'));
      if (prefixMatches.length === 1) {
        verifiedTag = prefixMatches[0].name.toUpperCase();
      } else if (prefixMatches.length > 1) {
        this._showSocialToast(`Multiple online operators match "${cleaned}". Enter full USERNAME#1234.`);
        return;
      }
    } else if (this._knownRealUsers && this._knownRealUsers.has(cleaned)) {
      // 3. Exact full ID match against a real client verified on the live lobby during this session
      verifiedTag = cleaned;
    }

    if (!verifiedTag) {
      this._showSocialToast(`Operator "${cleaned}" not found online. Only real connected players can be added.`);
      return;
    }

    if (verifiedTag === myCallsign) {
      this._showSocialToast('You cannot add yourself.');
      return;
    }
    const friends = this.profile.social.friends || (this.profile.social.friends = []);
    const incoming = this.profile.social.incomingFriendRequests || (this.profile.social.incomingFriendRequests = []);
    const outgoing = this.profile.social.outgoingFriendRequests || (this.profile.social.outgoingFriendRequests = []);

    if (friends.some(f => f.name.toUpperCase() === verifiedTag)) {
      this._showSocialToast(`${verifiedTag} is already on your friends list.`);
      return;
    }

    if (incoming.some(r => r.from.toUpperCase() === verifiedTag)) {
      this.acceptFriendRequest(verifiedTag);
      return;
    }

    if (outgoing.some(r => r.to.toUpperCase() === verifiedTag)) {
      this._showSocialToast(`Friend request to ${verifiedTag} is already pending.`);
      return;
    }

    const peerObj = onlineList.find(p => p.name.toUpperCase() === verifiedTag);
    const toClientId = peerObj ? peerObj.clientId : null;

    outgoing.push({
      to: verifiedTag,
      toClientId,
      ts: Date.now()
    });
    this.saveProfile();
    this._sendSocialPacket({
      type: 'friend_request',
      clientId: this._clientId,
      from: this.profile.social.callsign,
      to: verifiedTag,
      toClientId,
      ts: Date.now()
    });
    this.renderSocial();
    this._showSocialToast(`Friend request sent to ${verifiedTag}!`);
  }

  acceptFriendRequest(fromName) {
    const keyUp = (fromName || '').trim().toUpperCase();
    if (!keyUp) return;
    const social = this.profile.social;
    if (!Array.isArray(social.friends)) social.friends = [];
    const req = (social.incomingFriendRequests || []).find(r => r.from.toUpperCase() === keyUp);
    const peerObj = (this.onlinePlayers || []).find(p => p.name.toUpperCase() === keyUp);
    const toClientId = (req && req.fromClientId) || (peerObj && peerObj.clientId) || null;

    social.incomingFriendRequests = (social.incomingFriendRequests || []).filter(r => r.from.toUpperCase() !== keyUp);
    social.outgoingFriendRequests = (social.outgoingFriendRequests || []).filter(r => r.to.toUpperCase() !== keyUp);
    if (!social.friends.some(f => f.name.toUpperCase() === keyUp)) {
      social.friends.push({ name: keyUp, favorite: false });
    }
    this.saveProfile();
    this._sendSocialPacket({
      type: 'friend_accept',
      clientId: this._clientId,
      from: social.callsign,
      to: keyUp,
      toClientId,
      ts: Date.now()
    });
    this.renderSocial();
    this._showSocialToast(`Accepted ${keyUp}'s friend request! You are now friends.`);
  }

  declineFriendRequest(fromName) {
    const keyUp = (fromName || '').trim().toUpperCase();
    if (!keyUp) return;
    const social = this.profile.social;
    const req = (social.incomingFriendRequests || []).find(r => r.from.toUpperCase() === keyUp);
    const peerObj = (this.onlinePlayers || []).find(p => p.name.toUpperCase() === keyUp);
    const toClientId = (req && req.fromClientId) || (peerObj && peerObj.clientId) || null;

    social.incomingFriendRequests = (social.incomingFriendRequests || []).filter(r => r.from.toUpperCase() !== keyUp);
    social.outgoingFriendRequests = (social.outgoingFriendRequests || []).filter(r => r.to.toUpperCase() !== keyUp);
    this.saveProfile();
    this._sendSocialPacket({
      type: 'friend_decline',
      clientId: this._clientId,
      from: social.callsign,
      to: keyUp,
      toClientId,
      ts: Date.now()
    });
    this.renderSocial();
    this._showSocialToast(`Declined friend request from ${keyUp}.`);
  }

  cancelOutgoingFriendRequest(toName) {
    const keyUp = (toName || '').trim().toUpperCase();
    if (!keyUp) return;
    const social = this.profile.social;
    const req = (social.outgoingFriendRequests || []).find(r => r.to.toUpperCase() === keyUp);
    const peerObj = (this.onlinePlayers || []).find(p => p.name.toUpperCase() === keyUp);
    const toClientId = (req && req.toClientId) || (peerObj && peerObj.clientId) || null;

    social.outgoingFriendRequests = (social.outgoingFriendRequests || []).filter(r => r.to.toUpperCase() !== keyUp);
    this.saveProfile();
    this._sendSocialPacket({
      type: 'friend_decline',
      clientId: this._clientId,
      from: social.callsign,
      to: keyUp,
      toClientId,
      ts: Date.now()
    });
    this.renderSocial();
    this._showSocialToast(`Canceled friend request to ${keyUp}.`);
  }

  toggleFavoriteFriend(friendName) {
    const friends = this.profile.social.friends || [];
    const f = friends.find(it => it.name === friendName);
    if (!f) return;
    f.favorite = !f.favorite;
    this.saveProfile();
    this.renderSocial();
  }

  syncFobParty(joinedNewHost = false) {
    if (this._chatScope === 'fob' && this.setChatRoomScope && this.partyId) {
      const fobTitle = (this.partyMembers && this.partyMembers.length > 1)
        ? `${this.partyHost || 'HOST'}'S FOB`
        : 'FOB LOBBY';
      this.setChatRoomScope('fob', this.partyId, fobTitle);
    }
    if (!window.hideoutBunker || !window.hideoutBunker.syncPartyRoster) return;
    const isHost = this.isPartyLeader();
    const members = (this.partyMembers || []).slice(0, 3);
    if (joinedNewHost && !isHost && window.hideoutBunker.joinHostFob) {
      const selfIdx = Math.max(1, members.findIndex(m => m.isSelf || m.clientId === this._clientId));
      window.hideoutBunker.joinHostFob(this.partyHost, selfIdx);
    }
    window.hideoutBunker.syncPartyRoster(members, this.partyHost, isHost, this._clientId);
    // Broadcast our FOB position immediately so teammates see us at our new slot right away
    if (members.length > 1 && this._sendSocialPacket) {
      const selfM = members.find(m => m.isSelf || m.clientId === this._clientId);
      const pos = window.hideoutBunker.pos;
      this._sendSocialPacket({
        type: 'fob_pos',
        clientId: this._clientId,
        from: (this.profile && this.profile.social && this.profile.social.callsign) || 'OPERATOR',
        partyId: this.partyId || null,
        squadColor: (selfM && selfM.squadColor) || '#69f0ae',
        isLeader: isHost,
        status: window.hideoutBunker.activeRoam ? '' : ((this.activeMenuTab || 'FOB').toUpperCase()),
        x: Math.round((pos ? pos.x : 0) * 100) / 100,
        y: Math.round((pos ? pos.y : 1.68) * 100) / 100,
        z: Math.round((pos ? pos.z : 3.2) * 100) / 100,
        yaw: Math.round((window.hideoutBunker.yaw || 0) * 1000) / 1000
      });
    }
  }

  _broadcastPartySync() {
    if (!this.isPartyLeader()) return;
    this._sendSocialPacket({
      type: 'party_sync',
      clientId: this._clientId,
      partyId: this.partyId,
      hostName: this.partyHost,
      pvp: !!window.SQUAD_PVP,
      members: this.partyMembers.map(m => ({
        clientId: m.clientId,
        name: m.name,
        isLeader: !!m.isLeader,
        weaponId: m.weaponId || 'ak74m',
        gearLabel: m.gearLabel || 'OPERATOR',
        ready: !!m.ready
      }))
    });
  }

  setSelfPartyReady(readyState) {
    const self = (this.partyMembers || []).find(m => m.isSelf);
    if (self) self.ready = !!readyState;
    this._partyReady = !!readyState;
    if ((this.partyMembers || []).length > 1) {
      this._sendSocialPacket({
        type: 'party_ready',
        clientId: this._clientId,
        partyId: this.partyId,
        from: this.profile.social.callsign,
        ready: !!readyState
      });
    }
    this.renderSocial();
    this.renderPreMatchLoadout();
    if (this.matchmakingStage && this.matchmakingStage.active) {
      this.matchmakingStage.refreshSquadUI(false);
    }
  }

  broadcastPartyStage(zoneId, matchId) {
    if ((this.partyMembers || []).length <= 1) return;
    this._sendSocialPacket({
      type: 'party_stage',
      clientId: this._clientId,
      partyId: this.partyId,
      from: this.profile.social.callsign,
      zoneId,
      matchId
    });
  }

  broadcastPartyDeploy(zoneId, matchId) {
    if ((this.partyMembers || []).length <= 1) return;
    this._sendSocialPacket({
      type: 'deploy_raid',
      clientId: this._clientId,
      partyId: this.partyId,
      from: this.profile.social.callsign,
      zoneId,
      matchId
    });
  }

  acceptPendingPartyInvite() {
    const inv = this.pendingPartyInvite;
    if (!inv) return;
    this.pendingPartyInvite = null;
    this.partyId = inv.partyId;
    this.partyHost = inv.from;
    const L = this.profile.loadout || {};
    const myWpn = L.primary || L.secondary || 'mp5k';
    this.partyMembers = [
      {
        clientId: inv.fromClientId,
        name: inv.from,
        isSelf: false,
        isLeader: true,
        isRemoteHuman: true,
        weaponId: inv.leaderWeapon || 'ak74m',
        gearLabel: 'LEADER',
        ready: false
      },
      {
        clientId: this._clientId,
        name: this.profile.social.callsign,
        isSelf: true,
        isLeader: false,
        isRemoteHuman: false,
        weaponId: myWpn,
        gearLabel: myWpn.toUpperCase(),
        ready: false
      }
    ];
    this._partyReady = false;
    this.assignSquadColors();
    this._partySynced = false;
    const acceptPkt = {
      type: 'party_accept',
      clientId: this._clientId,
      partyId: this.partyId,
      from: this.profile.social.callsign,
      to: inv.from,
      toClientId: inv.fromClientId,
      weaponId: myWpn,
      gearLabel: myWpn.toUpperCase()
    };
    this._sendSocialPacket(acceptPkt);
    const targetPid = this.partyId;
    setTimeout(() => { if (!this._partySynced && this.partyId === targetPid) this._sendSocialPacket({ ...acceptPkt }); }, 1400);
    setTimeout(() => { if (!this._partySynced && this.partyId === targetPid) this._sendSocialPacket({ ...acceptPkt }); }, 3000);
    this.syncFobParty(true);
    this.renderSocial();
    this.renderHideout();
    this._showSocialToast(`Joined ${inv.from}'s FOB!`);
  }

  declinePendingPartyInvite() {
    this.pendingPartyInvite = null;
    this.renderSocial();
  }

  inviteFriendToParty(friendName) {
    if (this.partyMembers.length >= 3) {
      this._showSocialToast('Party is full (3/3).');
      return;
    }
    if (this.partyMembers.some(m => m.name.toUpperCase() === friendName.toUpperCase())) {
      this._showSocialToast(`${friendName} is already in your party.`);
      return;
    }
    const peer = (this.onlinePlayers || []).find(p => p.name.toUpperCase() === friendName.toUpperCase());
    if (!peer) {
      this._showSocialToast(`${friendName} is not currently online.`);
      return;
    }
    const L = this.profile.loadout || {};
    this._sendSocialPacket({
      type: 'party_invite',
      clientId: this._clientId,
      partyId: this.partyId,
      from: this.profile.social.callsign,
      to: peer.name,
      toClientId: peer.clientId,
      leaderWeapon: L.primary || L.secondary || 'ak74m'
    });
    this._showSocialToast(`Party invite sent to ${peer.name} — waiting for acceptance...`);
  }

  joinFriendParty(friendName) {
    const peer = (this.onlinePlayers || []).find(p => p.name.toUpperCase() === friendName.toUpperCase());
    if (!peer) {
      this._showSocialToast(`${friendName} is not currently online.`);
      return;
    }
    const L = this.profile.loadout || {};
    const myWpn = L.primary || L.secondary || 'mp5k';
    this.partyId = 'p_' + peer.clientId;
    this.partyHost = peer.name;
    this.partyMembers = [
      { clientId: peer.clientId, name: peer.name, isSelf: false, isLeader: true, isRemoteHuman: true, weaponId: 'ak74m', gearLabel: 'LEADER', ready: false },
      { clientId: this._clientId, name: this.profile.social.callsign, isSelf: true, isLeader: false, isRemoteHuman: false, weaponId: myWpn, gearLabel: myWpn.toUpperCase(), ready: false }
    ];
    this._partyReady = false;
    this.assignSquadColors();
    this._partySynced = false;
    const joinPkt = {
      type: 'party_join_req',
      clientId: this._clientId,
      partyId: this.partyId,
      from: this.profile.social.callsign,
      to: peer.name,
      toClientId: peer.clientId,
      weaponId: myWpn,
      gearLabel: myWpn.toUpperCase()
    };
    this._sendSocialPacket(joinPkt);
    const targetPid = this.partyId;
    setTimeout(() => { if (!this._partySynced && this.partyId === targetPid) this._sendSocialPacket({ ...joinPkt }); }, 1400);
    setTimeout(() => { if (!this._partySynced && this.partyId === targetPid) this._sendSocialPacket({ ...joinPkt }); }, 3000);
    this.syncFobParty(true);
    this.renderSocial();
    this.renderHideout();
    this._showSocialToast(`Joining ${peer.name}'s FOB...`);
  }

  leaveParty() {
    if ((this.partyMembers || []).length > 1) {
      this._sendSocialPacket({
        type: 'party_leave',
        clientId: this._clientId,
        partyId: this.partyId,
        from: this.profile.social.callsign
      });
    }
    this.partyId = 'p_' + this._clientId;
    this.partyHost = this.profile.social.callsign;
    this.partyMembers = [{
      clientId: this._clientId,
      name: this.profile.social.callsign,
      isSelf: true,
      isLeader: true,
      isRemoteHuman: false,
      ready: false,
      squadColor: '#69f0ae'
    }];
    this._partyReady = false;
    this.syncFobParty(false);
    this.assignSquadColors();
    this.renderSocial();
    this.renderHideout();
    this._showSocialToast('Returned to your own party.');
  }

  renderSocial() {
    this.assignSquadColors();
    const friends = this.profile.social.friends || [];
    const onlineSet = new Map((this.onlinePlayers || []).map(p => [p.name.toUpperCase(), p]));

    const onlineCountEl = document.getElementById('social-online-count');
    if (onlineCountEl) {
      onlineCountEl.textContent = this._wsConnected
        ? `● LIVE · ${this.onlinePlayers.length} ONLINE`
        : `${this.onlinePlayers.length} ONLINE`;
      onlineCountEl.style.color = this._wsConnected ? '#69f0ae' : '#f5a623';
    }
    const incomingReqs = this.profile.social.incomingFriendRequests || [];
    const outgoingReqs = this.profile.social.outgoingFriendRequests || [];
    const fCountEl = document.getElementById('friends-count');
    if (fCountEl) {
      fCountEl.textContent = incomingReqs.length > 0 ? `${friends.length} (+${incomingReqs.length})` : `${friends.length}`;
      fCountEl.style.color = incomingReqs.length > 0 ? '#ffca28' : '';
    }
    const oTabCountEl = document.getElementById('online-tab-count');
    if (oTabCountEl) oTabCountEl.textContent = this.onlinePlayers.length;

    // Render current party with squad colors (Green, Blue, Yellow, Pink when >1 teammate)
    const partyTitle = document.getElementById('party-title');
    const leaveBtn = document.getElementById('btn-leave-party');
    const partyEl = document.getElementById('party-members');
    const isOwnParty = this.partyHost === this.profile.social.callsign;
    const multiSquad = this.partyMembers.length > 1;
    if (partyTitle) {
      partyTitle.textContent = isOwnParty
        ? `YOUR PARTY (${this.partyMembers.length}/3)`
        : `${this.partyHost}'S PARTY (${this.partyMembers.length}/3)`;
    }
    if (leaveBtn) {
      leaveBtn.classList.toggle('hidden', isOwnParty && this.partyMembers.length <= 1);
      leaveBtn.textContent = isOwnParty ? 'DISBAND' : 'LEAVE';
    }
    if (partyEl) {
      partyEl.innerHTML = '';
      if (this.pendingPartyInvite) {
        const inv = this.pendingPartyInvite;
        const invRow = document.createElement('div');
        invRow.className = 'party-member';
        invRow.style.cssText = 'border-left-color:#ffca28;background:rgba(255,202,40,0.14);flex-wrap:wrap;gap:6px;';
        invRow.innerHTML = `<span style="color:#ffca28;font-weight:800;">INVITE: ${inv.from}</span><span style="display:flex;gap:4px;"><button class="btn-small" id="btn-accept-inv" style="border-color:#69f0ae;color:#69f0ae;">ACCEPT</button><button class="btn-small" id="btn-decline-inv">✕</button></span>`;
        partyEl.appendChild(invRow);
        invRow.querySelector('#btn-accept-inv').addEventListener('click', () => this.acceptPendingPartyInvite());
        invRow.querySelector('#btn-decline-inv').addEventListener('click', () => this.declinePendingPartyInvite());
      }
      for (const req of incomingReqs) {
        const reqRow = document.createElement('div');
        reqRow.className = 'party-member';
        reqRow.style.cssText = 'border-left-color:#42a5f5;background:rgba(66,165,245,0.14);flex-wrap:wrap;gap:6px;';
        reqRow.innerHTML = `<span style="color:#90caf9;font-weight:800;">FRIEND REQ: ${req.from}</span><span style="display:flex;gap:4px;"><button class="btn-small btn-fr-acc" style="border-color:#69f0ae;color:#69f0ae;">ACCEPT</button><button class="btn-small btn-fr-dec" style="border-color:#ff6b6b;color:#ff6b6b;">DECLINE</button></span>`;
        partyEl.appendChild(reqRow);
        reqRow.querySelector('.btn-fr-acc').addEventListener('click', () => this.acceptFriendRequest(req.from));
        reqRow.querySelector('.btn-fr-dec').addEventListener('click', () => this.declineFriendRequest(req.from));
      }
      for (const m of this.partyMembers) {
        const row = document.createElement('div');
        row.className = 'party-member';
        const dotHtml = multiSquad
          ? `<span class="squad-color-dot" style="background:${m.squadColor || '#69f0ae'};"></span>`
          : '';
        const statusTxt = multiSquad
          ? (m.ready ? '<span style="color:#69f0ae;">✓ READY</span>' : '<span style="color:#ffca28;">NOT READY</span>')
          : 'LEADER';
        row.innerHTML = `<span style="color:${multiSquad ? (m.squadColor || '#69f0ae') : ''};">${dotHtml}${m.name}${m.isSelf ? ' (YOU)' : ''}${m.isLeader && multiSquad ? ' ★' : ''}</span><span class="role-tag">${statusTxt}</span>`;
        partyEl.appendChild(row);
      }
    }

    // Show/hide add-friend search input bar on Friends tab
    const addBar = document.getElementById('add-friend-bar');
    if (addBar) addBar.classList.toggle('hidden', this.socialTab !== 'friends');

    const listEl = document.getElementById('social-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.socialTab === 'friends') {
      for (const req of outgoingReqs) {
        const row = document.createElement('div');
        row.className = 'social-row';
        row.style.borderLeft = '2px solid #ffca28';
        row.innerHTML = `
          <div class="social-info">
            <span class="social-name" style="color:#ffca28;">${req.to}</span>
            <span class="social-sub">FRIEND REQUEST SENT (PENDING)</span>
          </div>
          <div class="social-actions"></div>
        `;
        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn-small';
        btnCancel.title = 'Cancel Friend Request';
        btnCancel.textContent = 'CANCEL';
        btnCancel.addEventListener('click', () => this.cancelOutgoingFriendRequest(req.to));
        row.querySelector('.social-actions').appendChild(btnCancel);
        listEl.appendChild(row);
      }

      if (friends.length === 0 && outgoingReqs.length === 0) {
        listEl.innerHTML = '<div style="color:#8f968e;font-size:11px;padding:10px;">No friends yet. Search by Username#1234 above or add from Online.</div>';
        return;
      }
      // Sort: Favorites pinned to top, then online, then alphabetical
      const sorted = [...friends].sort((a, b) => {
        if (!!b.favorite !== !!a.favorite) return b.favorite ? 1 : -1;
        const aOn = onlineSet.has(a.name.toUpperCase()) ? 1 : 0;
        const bOn = onlineSet.has(b.name.toUpperCase()) ? 1 : 0;
        if (bOn !== aOn) return bOn - aOn;
        return a.name.localeCompare(b.name);
      });

      sorted.forEach((f) => {
        const keyUp = f.name.toUpperCase();
        const isOnline = onlineSet.has(keyUp);
        const onlineInfo = onlineSet.get(keyUp);
        const inParty = this.partyMembers.some(m => m.name.toUpperCase() === keyUp);
        const row = document.createElement('div');
        row.className = 'social-row';
        row.innerHTML = `
          <div class="social-info">
            <span class="social-name friend-green"><span class="status-dot ${inParty ? 'party' : (isOnline ? 'online' : 'offline')}"></span>${f.favorite ? '★ ' : ''}${f.name}</span>
            <span class="social-sub">${inParty ? 'IN YOUR PARTY' : (isOnline ? (onlineInfo.status || 'ONLINE') : 'OFFLINE')}</span>
          </div>
          <div class="social-actions"></div>
        `;
        const actions = row.querySelector('.social-actions');

        // Favorite star pin button
        const btnFav = document.createElement('button');
        btnFav.className = `btn-small btn-fav${f.favorite ? ' active' : ''}`;
        btnFav.title = f.favorite ? 'Unpin Favorite' : 'Pin as Favorite';
        btnFav.textContent = f.favorite ? '★' : '☆';
        btnFav.addEventListener('click', () => this.toggleFavoriteFriend(f.name));
        actions.appendChild(btnFav);

        if (isOnline && !inParty) {
          const btnInv = document.createElement('button');
          btnInv.className = 'btn-small';
          btnInv.textContent = 'INVITE';
          btnInv.addEventListener('click', () => this.inviteFriendToParty(f.name));

          const btnJoin = document.createElement('button');
          btnJoin.className = 'btn-small';
          btnJoin.style.borderColor = '#64b5f6';
          btnJoin.style.color = '#64b5f6';
          btnJoin.textContent = 'JOIN';
          btnJoin.addEventListener('click', () => this.joinFriendParty(f.name));

          actions.append(btnInv, btnJoin);
        }

        const btnRem = document.createElement('button');
        btnRem.className = 'btn-small';
        btnRem.title = 'Remove Friend';
        btnRem.textContent = '✕';
        btnRem.addEventListener('click', () => {
          const idx = friends.findIndex(it => it.name === f.name);
          if (idx !== -1) friends.splice(idx, 1);
          this.saveProfile();
          this.renderSocial();
        });
        actions.appendChild(btnRem);
        listEl.appendChild(row);
      });
    } else {
      // Real Online Clients tab (separate from Friends)
      if (this.onlinePlayers.length === 0) {
        listEl.innerHTML = '<div style="color:#8f968e;font-size:11px;padding:10px;">No other online clients right now.</div>';
        return;
      }
      for (const p of this.onlinePlayers) {
        const isFriend = friends.some(f => f.name.toUpperCase() === p.name.toUpperCase());
        const isOutgoing = outgoingReqs.some(r => r.to.toUpperCase() === p.name.toUpperCase());
        const isIncoming = incomingReqs.some(r => r.from.toUpperCase() === p.name.toUpperCase());
        const row = document.createElement('div');
        row.className = 'social-row';
        row.innerHTML = `
          <div class="social-info">
            <span class="social-name${isFriend ? ' friend-green' : ''}"><span class="status-dot online"></span>${p.name}</span>
            <span class="social-sub">${p.status}</span>
          </div>
          <div class="social-actions"></div>
        `;
        const actions = row.querySelector('.social-actions');
        if (isFriend) {
          const tag = document.createElement('span');
          tag.style.cssText = 'font-family:var(--font-mono);font-size:10px;color:#69f0ae;padding:4px 6px;';
          tag.textContent = 'FRIEND';
          actions.appendChild(tag);
        } else if (isIncoming) {
          const btnAcc = document.createElement('button');
          btnAcc.className = 'btn-small';
          btnAcc.style.cssText = 'border-color:#69f0ae;color:#69f0ae;';
          btnAcc.textContent = 'ACCEPT';
          btnAcc.addEventListener('click', () => this.acceptFriendRequest(p.name));
          const btnDec = document.createElement('button');
          btnDec.className = 'btn-small';
          btnDec.style.cssText = 'border-color:#ff6b6b;color:#ff6b6b;';
          btnDec.textContent = 'DECLINE';
          btnDec.addEventListener('click', () => this.declineFriendRequest(p.name));
          actions.append(btnAcc, btnDec);
        } else if (isOutgoing) {
          const tag = document.createElement('span');
          tag.style.cssText = 'font-family:var(--font-mono);font-size:10px;color:#ffca28;padding:4px 6px;';
          tag.textContent = 'PENDING';
          actions.appendChild(tag);
        } else {
          const btnAdd = document.createElement('button');
          btnAdd.className = 'btn-small';
          btnAdd.textContent = '+ ADD FRIEND';
          btnAdd.addEventListener('click', () => this.addFriendByName(p.name));
          actions.appendChild(btnAdd);
        }
        listEl.appendChild(row);
      }
    }
  }

  _loadProfile() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (p) {
          if (typeof p.xp !== 'number') p.xp = 0;
          if (p.loadout) {
            if (!p.loadout.lethal) { p.loadout.lethal = 'frag_grenade'; p.loadout.lethalQty = 2; }
            if (!p.loadout.tactical) { p.loadout.tactical = 'smoke_grenade'; p.loadout.tacticalQty = 2; }
            if (!p.loadout.backpack) p.loadout.backpack = 'bag_small';
            if (!p.loadout.fieldUpgrade) p.loadout.fieldUpgrade = 'fu_ammo_box';
            if (!p.loadout.melee) p.loadout.melee = 'melee_knife';
            if (!Array.isArray(p.loadout.backpackItems)) p.loadout.backpackItems = [];
            if (p.loadout.medkits > 0) {
              const existingMed = p.loadout.backpackItems.find(it => it && it.id === 'medkit');
              if (existingMed) existingMed.qty += p.loadout.medkits;
              else p.loadout.backpackItems.push({ id: 'medkit', qty: p.loadout.medkits });
              delete p.loadout.medkits;
            }
          }
          if (!p.social) p.social = {};
          if (!Array.isArray(p.social.friends)) p.social.friends = [];
          if (!Array.isArray(p.social.incomingFriendRequests)) p.social.incomingFriendRequests = [];
          if (!Array.isArray(p.social.outgoingFriendRequests)) p.social.outgoingFriendRequests = [];
        }
        return p;
      }
    } catch (e) {}
    const fresh = this._defaultProfile();
    try { localStorage.setItem(this.storageKey, JSON.stringify(fresh)); } catch (e) {}
    return fresh;
  }

  saveProfile() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
    } catch (e) {}
  }

  isPartyLeader() {
    const self = (this.partyMembers || []).find(m => m.isSelf);
    return !self || !!self.isLeader || (this.partyMembers || []).length <= 1;
  }

  openMenuTab(tabName) {
    if (tabName === 'gunsmith') {
      const gsBtn = document.getElementById('btn-open-gunsmith');
      if (gsBtn) gsBtn.click();
      return;
    }
    if (this.activeMenuTab === 'matchmaking' && tabName !== 'matchmaking' && this.matchmakingStage) {
      this.matchmakingStage.stop();
    }
    if (this.activeMenuTab && this.activeMenuTab !== tabName && tabName !== 'home') {
      if (window.soundEngine && window.soundEngine.playTabSwitch) {
        try { window.soundEngine.playTabSwitch(); } catch (e) {}
      }
    }
    this.activeMenuTab = tabName;
    const isHome = tabName === 'home';
    const topbar = document.getElementById('menu-topbar');
    const homeView = document.getElementById('menu-view-home');
    if (topbar) topbar.classList.toggle('hidden', isHome);
    if (homeView) homeView.classList.toggle('hidden', !isHome);

    ['deploy', 'traders', 'map', 'matchmaking', 'workbench', 'stash', 'operator', 'missions', 'settings', 'keybinds'].forEach((t) => {
      const el = document.getElementById(`menu-view-${t}`);
      if (el) el.classList.toggle('hidden', tabName !== t);
    });
    document.querySelectorAll('.subnav-btn').forEach((btn) => {
      const activeMatch = btn.dataset.tab === tabName ||
        (btn.dataset.tab === 'deploy' && (tabName === 'map' || tabName === 'matchmaking')) ||
        (btn.dataset.tab === 'settings' && tabName === 'keybinds');
      btn.classList.toggle('active', activeMatch);
    });
    if (tabName === 'traders') {
      this.renderTrader();
    }
    if (tabName === 'keybinds') {
      this.renderKeybindSettings();
    }
    requestAnimationFrame(() => this.ensureInitialSelection());
    if (tabName === 'deploy') {
      this._updateDeployResponsiveScale();
      this.renderPreMatchLoadout();
    }
    if (tabName === 'workbench') this.renderWorkbench();
    if (tabName === 'missions') this.renderMissions();
  }

  _bindWeaponStagingModal() {
    const modal = document.getElementById('weapon-staging-modal');
    const cancelBtn = document.getElementById('btn-ws-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.closeWeaponStagingModal());
    }
    if (modal) {
      modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) this.closeWeaponStagingModal();
      });
    }
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && modal && !modal.classList.contains('hidden')) {
        e.stopPropagation();
        this.closeWeaponStagingModal();
      }
    }, true);
  }

  closeWeaponStagingModal() {
    const modal = document.getElementById('weapon-staging-modal');
    if (modal) modal.classList.add('hidden');
    if (this._weaponStagingOnCancel) {
      const fn = this._weaponStagingOnCancel;
      this._weaponStagingOnCancel = null;
      fn();
    }
  }

  openWeaponStagingModal({ weaponId, mods = null, mag = undefined, rarityOverride = null, sourceLabel = 'WEAPON', slots = [], onSelectSlot = null, onCancel = null } = {}) {
    const modal = document.getElementById('weapon-staging-modal');
    const titleEl = document.getElementById('ws-modal-title');
    const previewEl = document.getElementById('ws-incoming-preview');
    const choicesEl = document.getElementById('ws-slot-choices');
    const def = weaponId && GAME_DATA.ITEMS[weaponId];
    if (!modal || !previewEl || !choicesEl || !def) return;

    this.hideItemPopout();
    this._weaponStagingOnCancel = onCancel || null;

    if (titleEl) {
      titleEl.textContent = `STAGE WEAPON // ${sourceLabel.toUpperCase()}`;
    }

    const rarKey = rarityOverride || def.rarity || 'common';
    const rarInfo = (GAME_DATA.RARITIES && GAME_DATA.RARITIES[rarKey]) || { label: rarKey.toUpperCase(), color: '#69f0ae' };
    const ammoDef = def.ammoType && GAME_DATA.ITEMS[def.ammoType];
    const eff = GAME_DATA.getEffectiveWeaponStats ? GAME_DATA.getEffectiveWeaponStats(weaponId, mods || {}) : def;
    const magStr = mag !== undefined ? `${mag} / ${eff.magSize} RDS` : `${eff.magSize} RDS MAG`;
    const iconHtml = this._renderItemIconHTML(weaponId, def, { wide: true, mods });

    previewEl.innerHTML = `
      <div class="ws-incoming-icon rarity-${rarKey}">${iconHtml}</div>
      <div class="ws-incoming-info">
        <span class="ws-incoming-tag">INCOMING FROM ${sourceLabel.toUpperCase()}</span>
        <span class="ws-incoming-name" style="color:${rarInfo.color}">${def.name}</span>
        <span class="ws-incoming-meta">${rarInfo.label} · ₽${(def.value || 0).toLocaleString()} · ${ammoDef ? ammoDef.name : ''} · ${magStr}</span>
      </div>
    `;

    choicesEl.innerHTML = '';
    for (const s of slots) {
      const curDef = s.currentId ? GAME_DATA.ITEMS[s.currentId] : null;
      const curRar = s.currentRarity || (curDef ? (curDef.rarity || 'common') : 'common');
      const locked = s.available === false;
      const card = document.createElement('div');
      card.className = `ws-slot-card${locked ? ' locked' : ''}`;
      card.dataset.targetSlot = s.key;

      const thumbHtml = curDef
        ? this._renderItemIconHTML(s.currentId, curDef, { wide: true, mods: s.currentMods || null })
        : `<span>${locked ? 'LOCKED' : 'EMPTY SLOT'}</span>`;

      const curName = locked
        ? (s.lockReason || 'REQUIRES WEAPON BACKPACK')
        : (curDef ? `${curDef.name} (${this._formatShortValue(curDef.value)})` : 'EMPTY — EQUIP DIRECTLY');

      const subText = locked
        ? 'Equip a Weapon Backpack (16 Slots + 1 Weapon Slot) to unlock backpack weapon storage'
        : (curDef ? `Replaces ${curDef.name}` : (s.key === 'backpackWeapon' ? 'Stow inside top-left double-wide backpack weapon slot' : `Equip into ${s.title}`));

      const actLabel = locked ? 'LOCKED' : (curDef ? 'SWAP →' : (s.key === 'backpackWeapon' ? 'STOW →' : 'EQUIP →'));

      card.innerHTML = `
        <div class="ws-slot-left">
          <div class="ws-slot-thumb ${curDef ? 'rarity-' + curRar : ''}">${thumbHtml}</div>
          <div class="ws-slot-details">
            <span class="ws-slot-title">${s.title}</span>
            <span class="ws-slot-cur">${curName}</span>
            <span class="ws-slot-sub">${subText}</span>
          </div>
        </div>
        <span class="ws-slot-action">${actLabel}</span>
      `;

      if (!locked && onSelectSlot) {
        card.addEventListener('click', () => {
          this._weaponStagingOnCancel = null;
          modal.classList.add('hidden');
          onSelectSlot(s.key);
        });
      }
      choicesEl.appendChild(card);
    }

    modal.classList.remove('hidden');
  }

  _bindHideoutEvents() {
    // Main menu option list buttons + lobby quick-action buttons
    document.querySelectorAll('.menu-option[data-menu-action], .home-quick-btn[data-menu-action]').forEach((btn) => {
      const action = btn.dataset.menuAction;
      if (action === 'gunsmith' && btn.id === 'btn-open-gunsmith') return; // handled directly by GunsmithController via #btn-open-gunsmith
      btn.addEventListener('click', () => this.openMenuTab(action));
    });

    // Top bar back button closes utility menu and returns to first-person walkable Hideout
    const backBtn = document.getElementById('btn-menu-home');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (window.soundEngine && window.soundEngine.playUiBack) {
          try { window.soundEngine.playUiBack(); } catch (e) {}
        }
        this.openMenuTab('home');
        if (typeof window.enterHideoutRoam === 'function') {
          window.enterHideoutRoam();
        }
      });
    }
    document.querySelectorAll('.subnav-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.openMenuTab(btn.dataset.tab));
    });

    // Operator tab quick shortcuts
    const opGs = document.getElementById('btn-op-gunsmith');
    if (opGs) opGs.addEventListener('click', () => this.openMenuTab('gunsmith'));
    const opSt = document.getElementById('btn-op-stash');
    if (opSt) opSt.addEventListener('click', () => this.openMenuTab('stash'));

    // Dedicated Keybinds entry inside Settings + KB/M & Controller tabs
    const openKbBtn = document.getElementById('btn-open-keybinds');
    if (openKbBtn) openKbBtn.addEventListener('click', () => this.openMenuTab('keybinds'));
    const backKbBtn = document.getElementById('btn-keybinds-back');
    if (backKbBtn) backKbBtn.addEventListener('click', () => this.openMenuTab('settings'));
    document.querySelectorAll('#keybinds-tabs .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this._rebindCleanup) this._rebindCleanup();
        this.keybindsTab = btn.dataset.kbTab || 'kbm';
        document.querySelectorAll('#keybinds-tabs .tab-btn').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        const kbmPane = document.getElementById('keybinds-kbm-pane');
        const ctrlPane = document.getElementById('keybinds-controller-pane');
        if (kbmPane) kbmPane.classList.toggle('hidden', this.keybindsTab !== 'kbm');
        if (ctrlPane) ctrlPane.classList.toggle('hidden', this.keybindsTab !== 'controller');
        this.renderKeybindSettings();
      });
    });

    // Pre-Match Step 1 -> Step 2 (Map for Solo / Party Leader, or Ready Up for Party Member)
    const btnNext = document.getElementById('btn-prematch-next');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (window.soundEngine && window.soundEngine.playUiConfirm) {
          try { window.soundEngine.playUiConfirm(); } catch (e) {}
        }
        const L = this.profile.loadout;
        if (!L.primary && !L.secondary) {
          L.secondary = 'pm9';
          L.ammo.ammo_9x18 = (L.ammo.ammo_9x18 || 0) + 16;
        }
        if (this.isPartyLeader()) {
          this.openMenuTab('map');
        } else {
          this.setSelfPartyReady(!this._partyReady);
          this._showSocialToast(this._partyReady
            ? 'READY ✓ — Waiting for Party Leader to select sector...'
            : 'Unready — Adjust your loadout.');
        }
      });
    }

    // Pre-Match Step 2: Interactive Map floating nodes
    const zoneDescs = {
      outpost: 'Selected: Dustline Outpost — Balanced wasteland sector with Field Hospital, Police/Fire Station & Boss Encampment.',
      industrial: 'Selected: Rustyard Compound — High-threat industrial sector with Military Compound, Boss Key Room & Ultra gear.'
    };
    document.querySelectorAll('.map-node').forEach((node) => {
      node.addEventListener('click', () => {
        document.querySelectorAll('.map-node').forEach((n) => n.classList.remove('active'));
        node.classList.add('active');
        const sel = document.getElementById('raid-zone-select');
        if (sel) sel.value = node.dataset.zone;
        const descEl = document.getElementById('map-selected-desc');
        if (descEl) descEl.textContent = zoneDescs[node.dataset.zone] || '';
      });
    });

    const btnMapBack = document.getElementById('btn-map-back');
    if (btnMapBack) btnMapBack.addEventListener('click', () => this.openMenuTab('deploy'));

    const btnMapConfirm = document.getElementById('btn-map-confirm');
    if (btnMapConfirm) {
      btnMapConfirm.addEventListener('click', () => {
        const zoneId = (document.getElementById('raid-zone-select') || {}).value || 'outpost';
        const matchId = 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        // Mark leader ready when entering matchmaking; non-leader party members keep their actual ready status until they click READY!
        if ((this.partyMembers || []).length > 1) {
          this.setSelfPartyReady(true);
          this.broadcastPartyStage(zoneId, matchId);
        }
        this.openMenuTab('matchmaking');
        if (this.matchmakingStage) this.matchmakingStage.start(zoneId, matchId);
      });
    }

    const btnMmCancel = document.getElementById('btn-mm-cancel');
    if (btnMmCancel) {
      btnMmCancel.addEventListener('click', () => {
        if (this.matchmakingStage) this.matchmakingStage.stop();
        this.setSelfPartyReady(false);
        this.openMenuTab(this.isPartyLeader() ? 'map' : 'deploy');
      });
    }

    // Workbench Bulk Sell Common Materials
    const btnSellMats = document.getElementById('btn-sell-materials');
    if (btnSellMats) {
      btnSellMats.addEventListener('click', () => {
        let earned = 0;
        this.profile.stash = this.profile.stash.filter(item => {
          const def = GAME_DATA.ITEMS[item.id];
          if (def && def.type === 'material') {
            earned += def.value * item.qty;
            return false;
          }
          return true;
        });
        if (earned > 0) {
          this.profile.credits += earned;
          this.saveProfile();
          this.renderHideout();
          this.renderWorkbench();
        }
      });
    }

    // Settings controls (Main Menu + In-Raid ESC Menu bidirectionally synced)
    const syncSettingsUI = () => {
      const fov = window.BASE_FOV || 75;
      const sens = window.MOUSE_SENS || 1.0;
      const muted = !!(window.soundEngine && window.soundEngine.muted);
      const levels = (window.soundEngine && window.soundEngine.getLevels) ? window.soundEngine.getLevels() : { master: 1, gun: 1, foot: 1, ambient: 1, sfx: 1 };
      ['setting-fov', 'pause-setting-fov'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = fov;
      });
      ['setting-fov-val', 'pause-setting-fov-val'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = `${fov}°`;
      });
      const adsFovMode = window.ADS_FOV_MODE === 'independent' ? 'independent' : 'affected';
      const btnAdsAff = document.getElementById('btn-adsfov-affected');
      const btnAdsInd = document.getElementById('btn-adsfov-independent');
      if (btnAdsAff) {
        btnAdsAff.style.borderColor = adsFovMode === 'affected' ? '#69f0ae' : '';
        btnAdsAff.style.color = adsFovMode === 'affected' ? '#69f0ae' : '';
      }
      if (btnAdsInd) {
        btnAdsInd.style.borderColor = adsFovMode === 'independent' ? '#69f0ae' : '';
        btnAdsInd.style.color = adsFovMode === 'independent' ? '#69f0ae' : '';
      }
      const wScale = (['narrow', 'default', 'wide'].includes(window.WEAPON_FOV_SCALE)) ? window.WEAPON_FOV_SCALE : 'default';
      [['narrow', 'btn-wscale-narrow'], ['default', 'btn-wscale-default'], ['wide', 'btn-wscale-wide']].forEach(([k, id]) => {
        const b = document.getElementById(id);
        if (b) {
          b.style.borderColor = wScale === k ? '#69f0ae' : '';
          b.style.color = wScale === k ? '#69f0ae' : '';
        }
      });
      const wfovMode = window.WEAPON_FOV_MODE === 'independent' ? 'independent' : 'effected';
      const vmFov = window.VIEWMODEL_FOV || 75;
      const btnEff = document.getElementById('btn-wfov-effected');
      const btnInd = document.getElementById('btn-wfov-independent');
      if (btnEff) {
        btnEff.style.borderColor = wfovMode === 'effected' ? '#69f0ae' : '';
        btnEff.style.color = wfovMode === 'effected' ? '#69f0ae' : '';
      }
      if (btnInd) {
        btnInd.style.borderColor = wfovMode === 'independent' ? '#69f0ae' : '';
        btnInd.style.color = wfovMode === 'independent' ? '#69f0ae' : '';
      }
      const vmFovRow = document.getElementById('setting-vm-fov-row');
      if (vmFovRow) vmFovRow.style.display = wfovMode === 'independent' ? 'flex' : 'none';
      const vmFovEl = document.getElementById('setting-vm-fov');
      const vmFovVal = document.getElementById('setting-vm-fov-val');
      if (vmFovEl) vmFovEl.value = vmFov;
      if (vmFovVal) vmFovVal.textContent = `${vmFov}°`;
      ['setting-sens', 'pause-setting-sens'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = sens;
      });
      ['setting-sens-val', 'pause-setting-sens-val'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = `${sens.toFixed(1)}x`;
      });
      ['btn-setting-mute', 'btn-pause-mute'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = muted ? 'AUDIO: MUTED' : 'AUDIO: ON';
          el.style.borderColor = muted ? '#d94141' : '';
          el.style.color = muted ? '#ff6b6b' : '';
        }
      });
      const volDefs = [
        ['master', 'setting-vol-master', 'pause-vol-master', 'setting-vol-master-val', 'pause-vol-master-val'],
        ['gun', 'setting-vol-gun', 'pause-vol-gun', 'setting-vol-gun-val', 'pause-vol-gun-val'],
        ['foot', 'setting-vol-foot', 'pause-vol-foot', 'setting-vol-foot-val', 'pause-vol-foot-val'],
        ['ambient', 'setting-vol-ambient', 'pause-vol-ambient', 'setting-vol-ambient-val', 'pause-vol-ambient-val'],
        ['sfx', 'setting-vol-sfx', 'pause-vol-sfx', 'setting-vol-sfx-val', 'pause-vol-sfx-val'],
      ];
      volDefs.forEach(([key, mainId, pauseId, mainVal, pauseVal]) => {
        const pct = Math.round(((levels[key] != null ? levels[key] : 1)) * 100);
        [mainId, pauseId].forEach((id) => {
          const el = document.getElementById(id);
          if (el && document.activeElement !== el) el.value = String(pct);
        });
        [mainVal, pauseVal].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.textContent = `${pct}%`;
        });
      });
      const pDev = document.getElementById('btn-pause-dev');
      if (pDev) {
        pDev.textContent = window.DEV_MODE ? 'DEV MODE: ON' : 'DEV MODE: OFF';
        pDev.style.borderColor = window.DEV_MODE ? '#69f0ae' : '';
        pDev.style.color = window.DEV_MODE ? '#69f0ae' : '';
      }
      const ctrlSens = window.CONTROLLER_SENS || 1.0;
      const ctrlSensEl = document.getElementById('setting-ctrl-sens');
      const ctrlSensVal = document.getElementById('setting-ctrl-sens-val');
      if (ctrlSensEl) ctrlSensEl.value = ctrlSens;
      if (ctrlSensVal) ctrlSensVal.textContent = `${ctrlSens.toFixed(1)}x`;

      const lsDz = Number.isFinite(window.CONTROLLER_LS_DEADZONE) ? window.CONTROLLER_LS_DEADZONE : 0.14;
      const lsDzEl = document.getElementById('setting-ctrl-ls-dz');
      const lsDzVal = document.getElementById('setting-ctrl-ls-dz-val');
      if (lsDzEl) lsDzEl.value = lsDz;
      if (lsDzVal) lsDzVal.textContent = `${Math.round(lsDz * 100)}%`;

      const rsDz = Number.isFinite(window.CONTROLLER_RS_DEADZONE) ? window.CONTROLLER_RS_DEADZONE : 0.14;
      const rsDzEl = document.getElementById('setting-ctrl-rs-dz');
      const rsDzVal = document.getElementById('setting-ctrl-rs-dz-val');
      if (rsDzEl) rsDzEl.value = rsDz;
      if (rsDzVal) rsDzVal.textContent = `${Math.round(rsDz * 100)}%`;

      const aaStr = Number.isFinite(window.CONTROLLER_AA_STRENGTH) ? window.CONTROLLER_AA_STRENGTH : 1.0;
      const aaEl = document.getElementById('setting-ctrl-aa');
      const aaVal = document.getElementById('setting-ctrl-aa-val');
      if (aaEl) aaEl.value = aaStr;
      if (aaVal) aaVal.textContent = `${Math.round(aaStr * 100)}%`;

      const gfx = window.GFX_SETTINGS || { lod: 3, lighting: 3, shadows: 3, textures: 3, pixel: 2 };
      const lvl4 = ['', 'LOW', 'MEDIUM', 'HIGH', 'ULTRA'];
      const lvlShadow = ['OFF', 'LOW', 'MEDIUM', 'HIGH'];
      const lvlTex = ['', 'LOW', 'MEDIUM', 'HIGH'];
      const lvlPixel = ['', 'OFF', 'CLASSIC', 'CHUNKY'];
      const bindVal = (id, valId, v, labels) => {
        const inp = document.getElementById(id);
        const lbl = document.getElementById(valId);
        if (inp) inp.value = String(v);
        if (lbl) lbl.textContent = labels[v] || String(v);
      };
      bindVal('setting-gfx-lod', 'setting-gfx-lod-val', gfx.lod, lvl4);
      bindVal('setting-gfx-lighting', 'setting-gfx-lighting-val', gfx.lighting, lvl4);
      bindVal('setting-gfx-shadows', 'setting-gfx-shadows-val', gfx.shadows, lvlShadow);
      bindVal('setting-gfx-textures', 'setting-gfx-textures-val', gfx.textures, lvlTex);
      bindVal('setting-gfx-pixel', 'setting-gfx-pixel-val', gfx.pixel ?? 2, lvlPixel);

      ['btn-pvp-mode', 'btn-pause-pvp'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = window.SQUAD_PVP ? 'SQUAD PVP: ON' : 'SQUAD PVP: OFF';
          el.style.borderColor = window.SQUAD_PVP ? '#ff5252' : '';
          el.style.color = window.SQUAD_PVP ? '#ff6b6b' : '';
        }
      });
    };
    this.syncSettingsUI = syncSettingsUI;

    ['setting-fov', 'pause-setting-fov'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          window.BASE_FOV = parseInt(el.value, 10) || 75;
          if (window.saveAllUserSettings) window.saveAllUserSettings();
          syncSettingsUI();
        });
      }
    });
    const btnAdsFovAff = document.getElementById('btn-adsfov-affected');
    if (btnAdsFovAff) {
      btnAdsFovAff.addEventListener('click', () => {
        window.ADS_FOV_MODE = 'affected';
        if (window.saveAllUserSettings) window.saveAllUserSettings();
        if (window.gunsmith && window.gunsmith.isOpen) window.gunsmith.renderStats();
        syncSettingsUI();
      });
    }
    const btnAdsFovInd = document.getElementById('btn-adsfov-independent');
    if (btnAdsFovInd) {
      btnAdsFovInd.addEventListener('click', () => {
        window.ADS_FOV_MODE = 'independent';
        if (window.saveAllUserSettings) window.saveAllUserSettings();
        if (window.gunsmith && window.gunsmith.isOpen) window.gunsmith.renderStats();
        syncSettingsUI();
      });
    }
    [['narrow', 'btn-wscale-narrow'], ['default', 'btn-wscale-default'], ['wide', 'btn-wscale-wide']].forEach(([k, id]) => {
      const btnWs = document.getElementById(id);
      if (btnWs) {
        btnWs.addEventListener('click', () => {
          window.WEAPON_FOV_SCALE = k;
          if (window.saveAllUserSettings) window.saveAllUserSettings();
          syncSettingsUI();
        });
      }
    });
    const btnWfovEff = document.getElementById('btn-wfov-effected');
    if (btnWfovEff) {
      btnWfovEff.addEventListener('click', () => {
        window.WEAPON_FOV_MODE = 'effected';
        if (window.saveAllUserSettings) window.saveAllUserSettings();
        syncSettingsUI();
      });
    }
    const btnWfovInd = document.getElementById('btn-wfov-independent');
    if (btnWfovInd) {
      btnWfovInd.addEventListener('click', () => {
        window.WEAPON_FOV_MODE = 'independent';
        if (window.saveAllUserSettings) window.saveAllUserSettings();
        syncSettingsUI();
      });
    }
    const vmFovSlider = document.getElementById('setting-vm-fov');
    if (vmFovSlider) {
      vmFovSlider.addEventListener('input', () => {
        window.VIEWMODEL_FOV = parseInt(vmFovSlider.value, 10) || 75;
        if (window.saveAllUserSettings) window.saveAllUserSettings();
        syncSettingsUI();
      });
    }
    ['setting-sens', 'pause-setting-sens'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          window.MOUSE_SENS = parseFloat(el.value) || 1.0;
          if (window.saveAllUserSettings) window.saveAllUserSettings();
          syncSettingsUI();
        });
      }
    });
    const ctrlSensInp = document.getElementById('setting-ctrl-sens');
    if (ctrlSensInp) {
      ctrlSensInp.addEventListener('input', () => {
        window.CONTROLLER_SENS = parseFloat(ctrlSensInp.value) || 1.0;
        if (window.saveAllUserSettings) window.saveAllUserSettings();
        syncSettingsUI();
      });
    }
    const lsDzInp = document.getElementById('setting-ctrl-ls-dz');
    if (lsDzInp) {
      lsDzInp.addEventListener('input', () => {
        window.CONTROLLER_LS_DEADZONE = Math.min(0.40, Math.max(0.02, parseFloat(lsDzInp.value) || 0.12));
        if (window.saveAllUserSettings) window.saveAllUserSettings();
        syncSettingsUI();
      });
    }
    const rsDzInp = document.getElementById('setting-ctrl-rs-dz');
    if (rsDzInp) {
      rsDzInp.addEventListener('input', () => {
        window.CONTROLLER_RS_DEADZONE = Math.min(0.40, Math.max(0.02, parseFloat(rsDzInp.value) || 0.10));
        if (window.saveAllUserSettings) window.saveAllUserSettings();
        syncSettingsUI();
      });
    }
    const aaInp = document.getElementById('setting-ctrl-aa');
    if (aaInp) {
      aaInp.addEventListener('input', () => {
        window.CONTROLLER_AA_STRENGTH = Math.min(1.0, Math.max(0.0, (parseFloat(aaInp.value) || 0) / 100));
        if (window.saveAllUserSettings) window.saveAllUserSettings();
        syncSettingsUI();
      });
    }
    [
      ['setting-gfx-lod', 'lod'],
      ['setting-gfx-lighting', 'lighting'],
      ['setting-gfx-shadows', 'shadows'],
      ['setting-gfx-textures', 'textures'],
      ['setting-gfx-pixel', 'pixel']
    ].forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          if (!window.GFX_SETTINGS) window.GFX_SETTINGS = { lod: 3, lighting: 3, shadows: 3, textures: 3, pixel: 2 };
          window.GFX_SETTINGS[key] = parseInt(el.value, 10);
          if (window.saveAllUserSettings) window.saveAllUserSettings();
          if (typeof window.applyGraphicsSettings === 'function') {
            window.applyGraphicsSettings(window.GFX_SETTINGS);
          }
          syncSettingsUI();
        });
      }
    });
    ['btn-setting-mute', 'btn-pause-mute'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', () => {
          if (window.soundEngine) {
            if (typeof window.soundEngine.setMuted === 'function') window.soundEngine.setMuted(!window.soundEngine.muted);
            else { window.soundEngine.muted = !window.soundEngine.muted; if (typeof window.soundEngine._applyLevels === 'function') window.soundEngine._applyLevels(); }
            if (window.saveAllUserSettings) window.saveAllUserSettings();
            syncSettingsUI();
          }
        });
      }
    });
    const volWiring = [
      ['master', 'setting-vol-master', 'pause-vol-master'],
      ['gun', 'setting-vol-gun', 'pause-vol-gun'],
      ['foot', 'setting-vol-foot', 'pause-vol-foot'],
      ['ambient', 'setting-vol-ambient', 'pause-vol-ambient'],
      ['sfx', 'setting-vol-sfx', 'pause-vol-sfx']
    ];
    volWiring.forEach(([cat, mainId, pauseId]) => {
      [mainId, pauseId].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', () => {
            const f = Math.min(1, Math.max(0, (parseFloat(el.value) || 0) / 100));
            if (window.soundEngine && typeof window.soundEngine.setLevel === 'function') window.soundEngine.setLevel(cat, f);
            if (window.saveAllUserSettings) window.saveAllUserSettings();
            syncSettingsUI();
          });
        }
      });
    });
    const pauseDevBtn = document.getElementById('btn-pause-dev');
    if (pauseDevBtn) {
      pauseDevBtn.addEventListener('click', () => {
        window.DEV_MODE = !window.DEV_MODE;
        if (window.DEV_MODE && window.SQUAD_PVP) {
          window.SQUAD_PVP = false;
          if (this._sendSocialPacket) {
            this._sendSocialPacket({
              type: 'party_pvp',
              clientId: this._clientId,
              partyId: this.partyId,
              enabled: false,
              ts: Date.now()
            });
          }
          if (typeof window.onSquadPvpToggle === 'function') {
            window.onSquadPvpToggle(false);
          }
          this._showSocialToast('Dev Mode: ON — Squad PvP disabled for squad');
        }
        if (window.saveAllUserSettings) window.saveAllUserSettings();
        this.renderHideout();
        syncSettingsUI();
      });
    }
    ['btn-pvp-mode', 'btn-pause-pvp'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', () => {
          window.SQUAD_PVP = !window.SQUAD_PVP;
          if (window.SQUAD_PVP) {
            window.DEV_MODE = false;
            if (typeof window.onSquadPvpForceFair === 'function') window.onSquadPvpForceFair();
          }
          if (window.saveAllUserSettings) window.saveAllUserSettings();
          this.renderHideout();
          syncSettingsUI();
          if (this._sendSocialPacket) {
            this._sendSocialPacket({
              type: 'party_pvp',
              clientId: this._clientId,
              partyId: this.partyId,
              enabled: window.SQUAD_PVP,
              ts: Date.now()
            });
          }
          if (typeof window.onSquadPvpToggle === 'function') {
            window.onSquadPvpToggle(window.SQUAD_PVP);
          }
          this._showSocialToast(window.SQUAD_PVP ? 'Squad PvP: ON — Dev Mode disabled for squad' : 'Squad PvP (Friendly Fire): OFF');
        });
      }
    });
    const pauseSettingsBtn = document.getElementById('btn-pause-settings');
    const closeInGameSettingsBtn = document.getElementById('btn-close-ingame-settings');
    this._settingsHomeParent = null;
    this._settingsHomeNextSibling = null;
    this.isInGameSettingsOpen = false;

    this.openInGameSettings = () => {
      const overlay = document.getElementById('ingame-settings-overlay');
      const mount = document.getElementById('ingame-settings-mount');
      const settingsView = document.getElementById('menu-view-settings');
      const pauseOv = document.getElementById('pointer-lock-overlay');
      if (!overlay || !mount || !settingsView) return;
      if (!this._settingsHomeParent) {
        this._settingsHomeParent = settingsView.parentNode;
        this._settingsHomeNextSibling = settingsView.nextSibling;
      }
      syncSettingsUI();
      this._syncUsernameSettingsUI();
      mount.appendChild(settingsView);
      settingsView.classList.remove('hidden');
      overlay.classList.remove('hidden');
      if (pauseOv) pauseOv.classList.add('hidden');
      this.isInGameSettingsOpen = true;
      this.clearSelection();
      requestAnimationFrame(() => this.ensureInitialSelection({ inputMode: this._isControllerConnected() ? 'gamepad' : 'auto' }));
    };

    this.closeInGameSettings = (returnToPause = true) => {
      const overlay = document.getElementById('ingame-settings-overlay');
      const settingsView = document.getElementById('menu-view-settings');
      const pauseOv = document.getElementById('pointer-lock-overlay');
      if (overlay) overlay.classList.add('hidden');
      if (settingsView && this._settingsHomeParent) {
        if (this._settingsHomeNextSibling && this._settingsHomeNextSibling.parentNode === this._settingsHomeParent) {
          this._settingsHomeParent.insertBefore(settingsView, this._settingsHomeNextSibling);
        } else {
          this._settingsHomeParent.appendChild(settingsView);
        }
        settingsView.classList.toggle('hidden', this.activeMenuTab !== 'settings');
      }
      this.isInGameSettingsOpen = false;
      if (returnToPause && pauseOv) {
        pauseOv.classList.remove('hidden');
      }
    };

    if (pauseSettingsBtn) {
      pauseSettingsBtn.addEventListener('click', () => this.openInGameSettings());
    }
    if (closeInGameSettingsBtn) {
      closeInGameSettingsBtn.addEventListener('click', () => this.closeInGameSettings(true));
    }
    syncSettingsUI();
    this._syncUsernameSettingsUI();

    const userInp = document.getElementById('setting-username');
    const userSaveBtn = document.getElementById('btn-save-username');
    if (userInp && userSaveBtn) {
      const saveUser = () => {
        if (!userInp.value.trim()) return;
        this.updateUsername(userInp.value);
      };
      userSaveBtn.addEventListener('click', saveUser);
      userInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveUser(); });
    }

    document.querySelectorAll('#social-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#social-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.socialTab = btn.dataset.social;
        this.renderSocial();
      });
    });

    const addInput = document.getElementById('input-add-friend');
    const addBtn = document.getElementById('btn-add-friend');
    if (addBtn && addInput) {
      const submitFriend = () => {
        if (!addInput.value.trim()) return;
        this.addFriendByName(addInput.value);
        addInput.value = '';
      };
      addBtn.addEventListener('click', submitFriend);
      addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitFriend(); });
    }
    const leavePartyBtn = document.getElementById('btn-leave-party');
    if (leavePartyBtn) leavePartyBtn.addEventListener('click', () => this.leaveParty());

    document.querySelectorAll('#trader-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#trader-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.traderCategory = btn.dataset.cat;
        this.renderTrader();
      });
    });

    document.querySelectorAll('#dev-trader-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#dev-trader-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.devTraderCategory = btn.dataset.devCat || 'all';
        this.renderTrader();
      });
    });

    document.getElementById('btn-sell-valuables').addEventListener('click', () => {
      let earned = 0;
      this.profile.stash = this.profile.stash.filter(item => {
        const def = GAME_DATA.ITEMS[item.id];
        if (def && def.type === 'valuable') {
          earned += def.value * item.qty;
          return false;
        }
        return true;
      });
      if (earned > 0) {
        this.profile.credits += earned;
        this.saveProfile();
        this.renderHideout();
      }
    });

    document.getElementById('btn-reset-save').addEventListener('click', () => {
      if (confirm('Reset all stash, credits, and stats?')) {
        this.profile = this._defaultProfile();
        this.saveProfile();
        this.renderHideout();
      }
    });

    document.getElementById('btn-dev-mode').addEventListener('click', () => {
      window.DEV_MODE = !window.DEV_MODE;
      if (window.DEV_MODE && window.SQUAD_PVP) {
        window.SQUAD_PVP = false;
        if (this._sendSocialPacket) {
          this._sendSocialPacket({
            type: 'party_pvp',
            clientId: this._clientId,
            partyId: this.partyId,
            enabled: false,
            ts: Date.now()
          });
        }
        if (typeof window.onSquadPvpToggle === 'function') {
          window.onSquadPvpToggle(false);
        }
        this._showSocialToast('Dev Mode: ON — Squad PvP disabled for squad');
      }
      this.renderHideout();
      syncSettingsUI();
    });

    document.getElementById('btn-dev-grant').addEventListener('click', () => {
      this.profile.credits += 50000;
      ['pm9', 'g17', 'mp5k', 'ak74m', 'm870', 'mosin9130', 'm24', 'awm338', 'vest_1plate', 'vest_2plate_gel', 'vest_2plate_helmet', 'vest_3plate', 'bag_large', 'bag_weapon', 'boss_key', 'melee_karambit', 'fu_dead_silence', 'ks_uav', 'ks_airstrike'].forEach(id => this.addToStash(id, 1));
      this.addToStash('medkit', 5);
      this.addToStash('armor_plate', 6);
      this.addToStash('scrap_metal', 10);
      this.addToStash('cloth_roll', 10);
      this.addToStash('gunpowder', 10);
      this.addToStash('polymer_parts', 10);
      this.saveProfile();
      this.renderHideout();
    });

    document.getElementById('btn-deploy').addEventListener('click', () => {
      const party = this.partyMembers || [];
      const multiSquad = party.length > 1;
      const self = party.find(m => m.isSelf);
      const allReady = !multiSquad || party.every(m => !!m.ready);

      // In a multi-player party, require ALL members to ready up before deploying!
      if (multiSquad) {
        if (!self || !self.ready) {
          this.setSelfPartyReady(true);
          return;
        }
        if (!allReady) {
          this.setSelfPartyReady(false);
          return;
        }
        if (!this.isPartyLeader()) return;
      }

      const matchId = (this.matchmakingStage && this.matchmakingStage.matchId) || ('m_' + Date.now().toString(36));
      if (this.matchmakingStage) this.matchmakingStage.stop();
      if (window.soundEngine && window.soundEngine.playUiConfirm) {
        try { window.soundEngine.playUiConfirm(); } catch (e) {}
      }
      // Ensure player at least has a fallback pistol if completely naked
      const L = this.profile.loadout;
      if (!L.primary && !L.secondary) {
        L.secondary = 'pm9';
        L.ammo.ammo_9x18 = (L.ammo.ammo_9x18 || 0) + 16;
      }
      const zoneId = document.getElementById('raid-zone-select').value;
      if (multiSquad && this.isPartyLeader()) {
        this.broadcastPartyDeploy(zoneId, matchId);
      }
      this.onDeploy(zoneId, matchId);
    });
  }

  addToStash(id, qty = 1, mods = null, rarityOverride = null) {
    this._normalizeStash();
    const def = GAME_DATA.ITEMS[id];
    if (!def) return false;
    // Weapons always go into the 16 dedicated double-wide weapon stash slots!
    if (def.type === 'weapon') {
      const cleanMods = (window.GAME_DATA && GAME_DATA.normalizeWeaponMods)
        ? GAME_DATA.normalizeWeaponMods(mods)
        : (mods ? { ...mods } : {});
      const effRar = (window.GAME_DATA && GAME_DATA.resolveWeaponRarity)
        ? GAME_DATA.resolveWeaponRarity(id, cleanMods, rarityOverride)
        : (rarityOverride || def.rarity || 'common');
      let added = 0;
      for (let i = 0; i < qty && this.profile.weaponStash.length < 16; i++) {
        this.profile.weaponStash.push({
          id,
          qty: 1,
          ...(Object.keys(cleanMods).length ? { mods: { ...cleanMods } } : {}),
          ...(effRar ? { rarityOverride: effRar } : {})
        });
        added++;
      }
      return added > 0;
    }
    if (def.stackable) {
      const maxStack = def.maxStack || 999;
      let rem = qty;
      for (const existing of this.profile.stash) {
        if (existing.id === id && existing.qty < maxStack) {
          const add = Math.min(rem, maxStack - existing.qty);
          existing.qty += add;
          rem -= add;
          if (rem <= 0) return true;
        }
      }
      while (rem > 0 && this.profile.stash.length < 64) {
        const chunk = Math.min(rem, maxStack);
        this.profile.stash.push({ id, qty: chunk });
        rem -= chunk;
      }
      return true;
    }
    for (let i = 0; i < qty && this.profile.stash.length < 64; i++) {
      this.profile.stash.push({ id, qty: 1 });
    }
    return true;
  }

  renderHideout() {
    const credStr = `₽ ${this.profile.credits.toLocaleString()}`;
    document.getElementById('ui-credits').textContent = credStr;
    document.getElementById('ui-raids').textContent = this.profile.raids;
    document.getElementById('ui-extracts').textContent = this.profile.extracts;
    const hCred = document.getElementById('home-credits');
    const hRaids = document.getElementById('home-raids');
    const hExt = document.getElementById('home-extracts');
    if (hCred) hCred.textContent = credStr;
    if (hRaids) hRaids.textContent = this.profile.raids;
    if (hExt) hExt.textContent = this.profile.extracts;
    const verBadge = document.getElementById('menu-version-badge');
    if (verBadge && window.GAME_DATA && window.GAME_DATA.VERSION) {
      verBadge.textContent = window.GAME_DATA.VERSION;
    }

    // Update Overhauled Main Menu Active Operator Hero Card & Deploy Readiness
    const ops = this._ensureActiveDutyOperators ? this._ensureActiveDutyOperators() : null;
    if (ops && ops.length > 0) {
      let rawOp = ops[this.profile.activeOperatorIdx || 0];
      if (!rawOp || rawOp.empty) {
        rawOp = ops.find((o) => o && !o.empty) || null;
      }
      const op = rawOp ? this._resolveOperatorSkin(rawOp) : null;
      const dt = op ? this._getDogtagInfo(op.exfilStreak || 0) : null;
      const L = this.profile.loadout || {};
      const callsignEl = document.getElementById('home-op-callsign');
      const nameEl = document.getElementById('home-op-name');
      const dogtagEl = document.getElementById('home-op-dogtag');
      const subEl = document.getElementById('home-op-sub');
      const portraitEl = document.getElementById('home-op-portrait');
      const chipsEl = document.getElementById('home-op-gear-chips');
      if (callsignEl) {
        callsignEl.textContent = op ? op.callsign : 'UNASSIGNED';
        callsignEl.style.color = op ? (op.accent || '#69f0ae') : '#90a4ae';
      }
      if (nameEl) {
        nameEl.textContent = op ? op.callsign : 'NO OPERATOR';
        nameEl.style.color = op ? (op.accent || '#f2f6f9') : '#90a4ae';
      }
      if (dogtagEl) {
        dogtagEl.textContent = dt ? `${dt.tier} · ${dt.level}` : 'EMPTY SLOT';
        dogtagEl.style.borderColor = dt ? dt.color : 'rgba(255,255,255,0.25)';
        dogtagEl.style.color = dt ? dt.color : '#90a4ae';
      }
      if (subEl) {
        subEl.textContent = op ? `${op.skinName} · EXFIL STREAK ${dt.streak}` : 'RECRUIT AN OPERATOR IN THE OPERATOR TAB';
      }
      if (portraitEl) {
        portraitEl.innerHTML = op
          ? this._buildOperatorPortraitSVG(op)
          : this._buildEmptyOperatorSilhouetteSVG();
      }
      if (chipsEl) {
        const pDef = L.primary && GAME_DATA.ITEMS[L.primary];
        const sDef = L.secondary && GAME_DATA.ITEMS[L.secondary];
        const aDef = L.armor && GAME_DATA.ITEMS[L.armor];
        const bDef = L.backpack && GAME_DATA.ITEMS[L.backpack];
        chipsEl.innerHTML = `
          <span class="home-gear-chip"><b>PRI</b> ${pDef ? pDef.name : 'NONE'}</span>
          <span class="home-gear-chip"><b>SEC</b> ${sDef ? sDef.name : 'NONE'}</span>
          <span class="home-gear-chip"><b>VEST</b> ${aDef ? aDef.name.split(' ')[0] : 'NONE'}</span>
          <span class="home-gear-chip"><b>BAG</b> ${bDef ? bDef.name.split(' ')[0] : 'SMALL'}</span>
        `;
      }
    }
    const readinessEl = document.getElementById('home-deploy-readiness');
    if (readinessEl) {
      const partyCount = (this.partyMembers && this.partyMembers.length) ? this.partyMembers.length : 1;
      readinessEl.textContent = partyCount > 1
        ? `SQUAD OF ${partyCount} READY · CONFIGURE LOADOUT & SELECT ZONE`
        : 'SOLO READY · CONFIGURE LOADOUT & SELECT ZONE';
    }

    const devBtn = document.getElementById('btn-dev-mode');
    const grantBtn = document.getElementById('btn-dev-grant');
    if (devBtn) {
      devBtn.textContent = window.DEV_MODE ? 'DEV MODE: ON' : 'DEV MODE: OFF';
      devBtn.style.borderColor = window.DEV_MODE ? '#69f0ae' : '';
      devBtn.style.color = window.DEV_MODE ? '#69f0ae' : '';
    }
    if (grantBtn) {
      grantBtn.classList.toggle('hidden', !window.DEV_MODE);
    }

    const deploySum = document.getElementById('deploy-loadout-summary');
    if (deploySum) {
      const L = this.profile.loadout;
      const pName = (L.primary && GAME_DATA.ITEMS[L.primary]) ? GAME_DATA.ITEMS[L.primary].name : 'None';
      const sName = (L.secondary && GAME_DATA.ITEMS[L.secondary]) ? GAME_DATA.ITEMS[L.secondary].name : 'None';
      const aName = (L.armor && GAME_DATA.ITEMS[L.armor]) ? GAME_DATA.ITEMS[L.armor].name : 'No Armor';
      const allies = (this.partyMembers || []).filter(m => !m.isSelf);
      const squadHtml = allies.length > 0
        ? `<div style="width:100%;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;margin-top:4px;display:flex;flex-wrap:wrap;gap:10px;">` +
          `<span style="color:#69f0ae;font-weight:700;">SQUAD INFIL (${this.partyMembers.length}/3):</span>` +
          allies.map(a => `<span><b>${a.name}</b> (${a.gearLabel || 'AK-74M · 2-Plate'} · <span style="color:#69f0ae;">READY</span>)</span>`).join('') +
          `</div>`
        : '';
      const bagCount = Array.isArray(L.backpackItems) ? L.backpackItems.length : 0;
      deploySum.innerHTML =
        `<span>PRIMARY <b>${pName}</b></span>` +
        `<span>SIDEARM <b>${sName}</b></span>` +
        `<span>ARMOR <b>${aName}</b></span>` +
        `<span>PACK <b>${bagCount} SLOTS</b></span>` +
        squadHtml;
    }

    this.renderLoadout();
    this.renderStash();
    this.renderTrader();
    this.renderSocial();
    this.renderPreMatchLoadout();
    this.renderWorkbench();
  }

  _getItemTypeLabel(def) {
    if (!def || !def.type) return '';
    const map = {
      weapon: 'WPN',
      melee: 'MELEE',
      armor: 'VEST',
      plate: 'PLATE',
      backpack: 'PACK',
      headgear: 'HEAD',
      med: 'MED',
      self_revive: 'REV',
      ammo: 'AMMO',
      lethal: 'LETH',
      tactical: 'TAC',
      field_upgrade: 'UPG',
      killstreak: 'STRK',
      valuable: 'VAL',
      material: 'MAT',
      key: 'KEY',
      dogtag: 'TAG'
    };
    return map[def.type] || def.type.slice(0, 4).toUpperCase();
  }

  _formatShortValue(val) {
    const n = Math.round(Number(val) || 0);
    if (n <= 0) return '';
    if (n >= 1000000) return `₽${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 10000) return `₽${Math.round(n / 1000)}k`;
    if (n >= 1000) return `₽${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return `₽${n}`;
  }

  _getCategoryGlyphSVG(def) {
    const t = (def && def.type) || '';
    const id = (def && def.id) || '';
    if (t === 'med' || id === 'self_revive') {
      return '<svg class="slot-cat-svg cat-med" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="#4caf50"/><path d="M8 4.2v7.6M4.2 8h7.6" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round"/></svg>';
    }
    if (t === 'armor' || t === 'plate') {
      return '<svg class="slot-cat-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.5L6.5 2h3l2 .5 1.5 2.5-1.2 1.2v7.3H4.2V6.2L3 5z" fill="currentColor"/></svg>';
    }
    if (t === 'backpack') {
      return '<svg class="slot-cat-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3a2.5 2.5 0 0 1 5 0v1H12a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 12 14H4a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 4 4h1.5V3zm1.5 1h2V3a1 1 0 0 0-2 0v1z" fill="currentColor"/></svg>';
    }
    if (t === 'weapon') {
      return '<svg class="slot-cat-svg" viewBox="0 0 18 14" aria-hidden="true"><path d="M1 6h10l1.5-1.5h4.5v2h-4l-1 1.5h-2l.8 4H8.5L7.6 8H5L3.8 11H2l.8-3.5H1V6z" fill="currentColor"/></svg>';
    }
    if (t === 'melee') {
      return '<svg class="slot-cat-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12.5l3.5-3.5L4.5 8l1-1 1 1 6.5-5.5-2 5.5-3.5 3.5 1 1-1 1-1-1-3 2z" fill="currentColor"/></svg>';
    }
    if (t === 'ammo') {
      return '<svg class="slot-cat-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 13V6.5L6.5 3 8 6.5V13H5zm4 0V6.5L10.5 3 12 6.5V13H9z" fill="currentColor"/></svg>';
    }
    if (t === 'lethal' || t === 'tactical') {
      return '<svg class="slot-cat-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 2h3v1.5h1.2l.8 1.5-.8.6-.5-1H9.5v.8a4 4 0 1 1-3 0v-.8H5.5V2h1z" fill="currentColor"/></svg>';
    }
    if (t === 'key') {
      return '<svg class="slot-cat-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 9.5a3.5 3.5 0 1 1 2.7-1.3L14 14l-1.3 1.3-1.4-1.4-1.1 1.1-1.3-1.3 1.1-1.1-2.2-2.2a3.5 3.5 0 0 1-2.3.1zM5.5 4.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z" fill="currentColor"/></svg>';
    }
    if (t === 'valuable' || t === 'dogtag') {
      return '<svg class="slot-cat-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2L14 7.5 8 14 2 7.5 8 2z" fill="currentColor"/></svg>';
    }
    if (t === 'killstreak' || t === 'field_upgrade') {
      return '<svg class="slot-cat-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6 4.2 13.6l.7-4.3-3.1-3 4.3-.6L8 1.8z" fill="currentColor"/></svg>';
    }
    // Material / gear / default cube silhouette
    return '<svg class="slot-cat-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8L13.5 5v6L8 14.2 2.5 11V5L8 1.8zm0 1.6L4.2 5.6 8 7.8l3.8-2.2L8 3.4z" fill="currentColor"/></svg>';
  }

  _getWeaponModCount(item, def = null) {
    const wId = (item && item.id) || (def && def.id);
    if (!wId) return 0;
    const mods = (item && item.mods)
      || (this.profile && this.profile.weaponMods && this.profile.weaponMods[wId])
      || {};
    const slotKeys = ['optic', 'muzzle', 'underbarrel', 'magazine', 'stock'];
    let count = 0;
    for (let i = 0; i < slotKeys.length; i++) {
      const v = mods[slotKeys[i]];
      if (v && v !== 'none') count++;
    }
    return count;
  }

  _resolveItemRarity(item, def = null) {
    if (!def && item && item.id && window.GAME_DATA && GAME_DATA.ITEMS) {
      def = GAME_DATA.ITEMS[item.id];
    }
    if (def && def.type === 'weapon' && window.GAME_DATA && GAME_DATA.resolveWeaponRarity) {
      const mods = (item && item.mods)
        || (this.profile && this.profile.weaponMods && this.profile.weaponMods[def.id])
        || {};
      return GAME_DATA.resolveWeaponRarity(def.id, mods, item && item.rarityOverride);
    }
    if (item && item.rarityOverride) return item.rarityOverride;
    return (def && def.rarity) || 'common';
  }

  _getEmptySlotGlyphSVG(kind) {
    const svgs = {
      cash: '<svg class="empty-slot-svg" viewBox="0 0 28 28" aria-hidden="true"><path d="M5 10l3.5-3.5 5 5 5-5L22 10M5 18l3.5-3.5 5 5 5-5L22 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 4v20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
      selfRevive: '<svg class="empty-slot-svg" viewBox="0 0 28 28" aria-hidden="true"><path d="M10 4h8M14 4v20M9 8c-2 1.2-2 3.8 1 4.8l8 2.4c3 1 3 3.6 1 4.8M19 8c2 1.2 2 3.8-1 4.8l-8 2.4c-3 1-3 3.6-1 4.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      plates: '<svg class="empty-slot-svg" viewBox="0 0 28 28" aria-hidden="true"><path d="M9.5 4h9L22 8.5V24H6V8.5L9.5 4zM10 10h8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
      headgear: '<svg class="empty-slot-svg" viewBox="0 0 28 28" aria-hidden="true"><path d="M7 11a7 7 0 0 1 14 0v5l-3.5 4.5h-7L7 16v-5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="10.8" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="17.2" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="14" cy="21" r="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
      medical: '<svg class="empty-slot-svg" viewBox="0 0 28 28" aria-hidden="true"><path d="M3 14h4.5l2.2-5.5 3.6 11 2.7-7.5 1.8 2H25" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      lethal: '<svg class="empty-slot-svg" viewBox="0 0 28 28" aria-hidden="true"><path d="M12 4h4v3h-4zM16 5.5l3 1.5-1 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="14" cy="15.5" rx="6" ry="7.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 13h10M9 18h10M14 8.5v14" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>',
      tactical: '<svg class="empty-slot-svg" viewBox="0 0 28 28" aria-hidden="true"><rect x="10" y="7" width="8" height="16" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M11.5 7V4.5h5V7M10 12h8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
      backpack: '<svg class="empty-slot-svg" viewBox="0 0 28 28" aria-hidden="true"><path d="M10.5 6.5a3.5 3.5 0 0 1 7 0M8 8.5h12a2 2 0 0 1 2 2V22a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10.5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="9.5" y="14" width="9" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
      helmet: '<svg class="empty-slot-svg" viewBox="0 0 28 28" aria-hidden="true"><path d="M6 16a8 8 0 0 1 16 0v3H6v-3zM10 19v3M18 19v3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
      killstreak: '<svg class="empty-slot-svg" viewBox="0 0 28 28" aria-hidden="true"><path d="M14 4l3 6.2 6.8 1-4.9 4.8 1.2 6.8L14 19.6l-6.1 3.2 1.2-6.8-4.9-4.8 6.8-1L14 4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
      fieldUpgrade: '<svg class="empty-slot-svg" viewBox="0 0 28 28" aria-hidden="true"><path d="M5 13a9 9 0 0 1 18 0c-2-1.5-4-1.5-6 0-2-1.5-4-1.5-6 0-2-1.5-4-1.5-6 0zM5.5 13l8.5 10.5L22.5 13M11 13l3 10.5L17 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
      melee: '<svg class="empty-slot-svg" viewBox="0 0 28 28" aria-hidden="true"><path d="M4 22l5.5-5.5-1.4-1.4 1.6-1.6 1.4 1.4 9.5-9.5c1.8 1.8.8 5.2-1.8 7.8l-5.8 5.8 1.4 1.4-1.5 1.5-1.4-1.4L6 24 4 22z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
      armor: '<svg class="empty-slot-svg" viewBox="0 0 28 28" aria-hidden="true"><path d="M9 5h3l2 2.5L16 5h3l3 4-2 2v12H8V11L6 9l3-4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'
    };
    return svgs[kind] || '';
  }

  _renderInvSlotInner(item, def, opts = {}) {
    const wide = !!(opts.wide);
    const isWpn = !!(def && def.type === 'weapon');
    const catGlyph = this._getCategoryGlyphSVG(def);
    const totalVal = (def.value || 0) * (item.qty || 1);
    const valLbl = this._formatShortValue(totalVal);
    const iconCls = wide ? 'slot-icon-img wide-weapon-icon' : 'slot-icon-img';
    const wpnTag = (wide && isWpn)
      ? `<span class="slot-wpn-tag">${def.name}</span>`
      : '';
    let pipsHtml = '';
    let ammoHtml = '';
    let catBottomHtml = '';
    let plateBarsHtml = '';
    if (wide && isWpn) {
      const attCount = this._getWeaponModCount(item, def);
      if (attCount > 0) {
        pipsHtml = `<span class="slot-pips">${'<span class="slot-pip"></span>'.repeat(Math.min(5, attCount))}</span>`;
      }
      const magVal = (item && item.mag !== undefined) ? item.mag : ((def && def.magSize) || 0);
      ammoHtml = `<span class="slot-ammo"><span class="slot-ammo-bars" aria-hidden="true">≡</span>${magVal}</span>`;
    } else if (!isWpn) {
      catBottomHtml = `<span class="slot-cat-glyph">${catGlyph}</span>`;
      if (def && def.type === 'armor') {
        const plateSlots = def.plateSlots || Math.max(1, Math.min(3, Math.ceil((def.maxArmor || 50) / 50)));
        plateBarsHtml = `<span class="slot-plate-bars" aria-label="${plateSlots} Plates">${'<span class="slot-plate-bar"></span>'.repeat(plateSlots)}</span>`;
      }
    }
    const showQty = (item.qty > 1 || opts.forceQty) && item.qty > 0;
    return `
      <div class="slot-top-bar">
        <span class="slot-type-icon">${catGlyph}</span>
        ${valLbl ? `<span class="slot-price">${valLbl}</span>` : ''}
      </div>
      ${this._renderItemIconHTML(item.id, def, { wide, cls: iconCls, mods: item.mods })}
      ${pipsHtml}
      ${ammoHtml}
      ${catBottomHtml}
      ${plateBarsHtml}
      ${wpnTag}
      ${showQty ? `<span class="slot-qty">${item.qty}</span>` : ''}
    `;
  }

  _renderItemIconHTML(id, def = null, opts = {}) {
    const cls = opts.cls || 'slot-icon-img';
    const wide = !!opts.wide;
    let mods = opts.mods || null;
    if (!mods && def && def.type === 'weapon' && this.profile && this.profile.weaponMods && this.profile.weaponMods[id]) {
      mods = this.profile.weaponMods[id];
    }
    if (window.itemIcons && typeof window.itemIcons.getIcon === 'function' && id) {
      const url = window.itemIcons.getIcon(id, { wide, mods });
      if (url) {
        const alt = (def && def.name) ? def.name.replace(/"/g, '&quot;') : id;
        return `<img class="${cls}" data-icon-id="${id}" data-icon-wide="${wide ? '1' : '0'}" src="${url}" alt="${alt}" draggable="false" />`;
      }
    }
    return `<span class="slot-name">${this._getItemShortTag(id, def)}</span>`;
  }

  _getItemShortTag(id, def) {
    const map = {
      pm9: 'PM9', g17: 'G17', mp5k: 'MP5', ak74m: 'AK', m870: '870', m24: 'M24', mosin9130: 'M91', awm338: 'AWM',
      ammo_9x18: '918', ammo_9x19: '9MM', ammo_12g: '12G', ammo_545: '545', ammo_762: '762', ammo_rocket: 'RKT',
      medkit: 'MED', bandage: 'BND', painkillers: 'PK', self_revive: 'SR',
      armor_plate: 'PLT', vest_1plate: 'V1', vest_2plate: 'V2', vest_2plate_gel: 'V2G', vest_2plate_helmet: 'V2H', vest_3plate: 'V3',
      bag_small: 'BG1', bag_medium: 'BG2', bag_large: 'BG3', bag_weapon: 'BGW',
      gas_mask: 'MSK', nvg_goggles: 'NVG',
      fu_ammo_box: 'AMB', fu_dead_silence: 'DS', fu_trophy: 'TRP',
      ks_uav: 'UAV', ks_airstrike: 'AIR',
      melee_knife: 'KNF', melee_karambit: 'KRM', melee_axe: 'AXE',
      frag_grenade: 'FRG', throwing_knife: 'TKN', smoke_grenade: 'SMK', concussion_grenade: 'STN',
      scrap_metal: 'STL', cloth_roll: 'CLT', gunpowder: 'PWD', polymer_parts: 'PLY',
      boss_key: 'KEY', dogtag: 'TAG', water_filter: 'FLT', fuel_can: 'FUL', intel_drive: 'INT', gold_watch: 'WTC'
    };
    if (map[id]) return map[id];
    const name = (def && def.name) || id || '?';
    return name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  }

  _getLoadoutWeaponMeta(slotKey) {
    const L = (this.profile && this.profile.loadout) || {};
    const id = L[slotKey];
    if (!id) return { id: null, mods: {}, rarity: null };
    const fallbackMods = (this.profile && this.profile.weaponMods && this.profile.weaponMods[id]) || {};
    const rawMods = L[slotKey + 'Mods'] || fallbackMods;
    const mods = (window.GAME_DATA && GAME_DATA.normalizeWeaponMods)
      ? GAME_DATA.normalizeWeaponMods(rawMods)
      : { ...rawMods };
    const rar = L[slotKey + 'Rarity']
      || ((window.GAME_DATA && GAME_DATA.resolveWeaponRarity)
        ? GAME_DATA.resolveWeaponRarity(id, mods, null)
        : this._resolveItemRarity({ id, mods }));
    return { id, mods, rarity: rar };
  }

  // ==================== PRE-MATCH LOADOUT SETUP (15 DOUBLE-WIDE WEAPON SLOTS + 64-SLOT STASH + OPERATOR + BACKPACK) ====================
  renderPreMatchLoadout() {
    this._normalizeStash();
    this._updateDeployResponsiveScale();
    const weaponStashGrid = document.getElementById('prematch-weapon-stash-grid');
    const stashGrid = document.getElementById('prematch-stash-grid');
    const opSlotsEl = document.getElementById('prematch-op-slots');
    const bagGrid = document.getElementById('prematch-bag-grid');
    if (!stashGrid || !opSlotsEl || !bagGrid) return;

    const L = this.profile.loadout;
    if (!Array.isArray(L.backpackItems)) L.backpackItems = [];
    const bagDef = GAME_DATA.ITEMS[L.backpack || 'bag_small'];
    const maxBagSlots = (bagDef && (bagDef.slots || bagDef.bagSlots)) ? (bagDef.slots || bagDef.bagSlots) : 8;
    const hasWeaponBag = !!(bagDef && bagDef.weaponSlot);

    // Party role banner & Next / Ready button
    const roleEl = document.getElementById('prematch-party-role');
    const nextBtn = document.getElementById('btn-prematch-next');
    const isLeader = this.isPartyLeader();
    const partyLen = (this.partyMembers || []).length;
    if (roleEl) {
      roleEl.textContent = partyLen <= 1
        ? 'SOLO // PARTY LEADER'
        : (isLeader ? `PARTY LEADER (${partyLen}/3)` : `PARTY MEMBER (${partyLen}/3)`);
    }
    if (nextBtn) {
      if (isLeader) {
        nextBtn.textContent = 'SELECT DEPLOYMENT ZONE →';
        nextBtn.style.background = '';
      } else {
        nextBtn.textContent = this._partyReady ? 'READY ✓ (WAITING FOR LEADER)' : 'READY UP ✓';
        nextBtn.style.background = this._partyReady ? '#2e7d32' : '';
      }
    }

    // 1A. 16 Uniform Double-Wide Weapon Slots (4x4, aligned 8-col flush with 64-slot Stash below)
    if (weaponStashGrid) {
      weaponStashGrid.innerHTML = '';
      for (let i = 0; i < 16; i++) {
        const wItem = this.profile.weaponStash[i];
        const cell = document.createElement('div');
        cell.className = 'inv-slot weapon-slot-wide';
        if (wItem && GAME_DATA.ITEMS[wItem.id]) {
          const def = GAME_DATA.ITEMS[wItem.id];
          const rar = this._resolveItemRarity(wItem, def);
          cell.classList.add(`rarity-${rar}`);
          cell.innerHTML = this._renderInvSlotInner(wItem, def, { wide: true, typeLabel: 'WPN' });
          cell.title = `${def.name} (₽${(def.value || 0).toLocaleString()}) — Click to Stage & Select Weapon Slot`;
          cell.addEventListener('click', () => {
            this._openDeployStashWeaponStaging(i);
          });
        } else {
          cell.classList.add('empty-slot');
          cell.innerHTML = `<div class="slot-top-bar"><span class="slot-type">WPN</span></div><span class="empty-wpn-hint">WEAPON SLOT</span>`;
        }
        weaponStashGrid.appendChild(cell);
      }
    }

    // 1B. 64-Slot Gear & Item Stash Grid (Left Bottom)
    stashGrid.innerHTML = '';
    for (let i = 0; i < 64; i++) {
      const item = this.profile.stash[i];
      const cell = document.createElement('div');
      cell.className = 'inv-slot';
      if (item && GAME_DATA.ITEMS[item.id]) {
        const def = GAME_DATA.ITEMS[item.id];
        const rar = this._resolveItemRarity(item, def);
        cell.classList.add(`rarity-${rar}`);
        cell.innerHTML = this._renderInvSlotInner(item, def);
        cell.title = `${def.name}${item.qty > 1 ? ' x' + item.qty : ''} (₽${(def.value * item.qty).toLocaleString()}) — Click to Equip or Pack`;
        cell.addEventListener('click', () => {
          this._equipOrPackFromStash(i, maxBagSlots);
        });
      } else {
        cell.classList.add('empty-slot');
      }
      stashGrid.appendChild(cell);
    }

    // 2. Operator Equipment Slots — 5-Column DMZ Loadout Grid
    const myCallsign = (this.profile && this.profile.social && this.profile.social.callsign) || 'OPERATOR';
    const pmMods = (this.profile && this.profile.weaponMods) || {};
    const pmPDef = L.primary ? GAME_DATA.ITEMS[L.primary] : null;
    const pmSDef = L.secondary ? GAME_DATA.ITEMS[L.secondary] : null;
    const pMeta = this._getLoadoutWeaponMeta('primary');
    const sMeta = this._getLoadoutWeaponMeta('secondary');
    this._renderOperatorTacticalGrid(opSlotsEl, {
      cash: this.profile.credits || 0,
      cashLabel: 'CREDITS',
      plates: L.plates || 0,
      dogtag: 'dogtag',
      dogtagText: myCallsign,
      headgear: L.headgear,
      selfRevive: L.selfRevive,
      primary: L.primary,
      primaryMods: pMeta.mods,
      primaryMag: pmPDef ? (pmPDef.magSize || 0) : undefined,
      primaryRarity: pMeta.rarity || undefined,
      armor: L.armor,
      secondary: L.secondary,
      secondaryMods: sMeta.mods,
      secondaryMag: pmSDef ? (pmSDef.magSize || 0) : undefined,
      secondaryRarity: sMeta.rarity || undefined,
      tactical: L.tactical,
      tacticalQty: L.tacticalQty || 0,
      lethal: L.lethal,
      lethalQty: L.lethalQty || 0,
      backpack: L.backpack,
      fieldUpgrade: L.fieldUpgrade,
      killstreak: L.killstreak,
      melee: L.melee
    }, (key) => {
      if (this._deployWeaponPick) {
        if ((key === 'primary' || key === 'secondary') && this._deployWeaponPick.validTargets.includes(key)) {
          this._confirmDeployWeaponPickSlot(key);
        }
        return;
      }
      if (key === 'cash' || key === 'dogtag') return;
      if (key === 'plates') {
        if ((L.plates || 0) > 0) { L.plates -= 1; this.addToStash('armor_plate', 1); }
      } else if (key === 'tactical') {
        if (L.tactical && (L.tacticalQty || 0) > 0) {
          this.addToStash(L.tactical, L.tacticalQty);
          L.tactical = null; L.tacticalQty = 0;
        }
      } else if (key === 'lethal') {
        if (L.lethal && (L.lethalQty || 0) > 0) {
          this.addToStash(L.lethal, L.lethalQty);
          L.lethal = null; L.lethalQty = 0;
        }
      } else if (L[key]) {
        if (key === 'primary' || key === 'secondary') {
          this.addToStash(L[key], 1, L[key + 'Mods'] || pmMods[L[key]] || null, L[key + 'Rarity'] || null);
          L[key] = null;
          L[key + 'Mods'] = null;
          L[key + 'Rarity'] = null;
        } else {
          this.addToStash(L[key], 1);
          L[key] = null;
          if (key === 'backpack' && L.backpackWeapon) {
            this.addToStash(L.backpackWeapon, 1, L.backpackWeaponMods || pmMods[L.backpackWeapon] || null, L.backpackWeaponRarity || null);
            L.backpackWeapon = null;
            L.backpackWeaponMods = null;
            L.backpackWeaponRarity = null;
          }
        }
      }
      this.saveProfile();
      this.renderHideout();
    }, 'Click to unequip back to Stash');

    // 3. Pre-Match Backpack Grid (Right Top — with Dedicated Top-Left Double-Wide Weapon Slot if Weapon Backpack is equipped!)
    const bagCountEl = document.getElementById('prematch-bag-count');
    if (bagCountEl) {
      bagCountEl.textContent = hasWeaponBag
        ? `${L.backpackItems.length}/${maxBagSlots} + ${L.backpackWeapon ? 1 : 0}/1 WPN`
        : `${L.backpackItems.length}/${maxBagSlots}`;
    }
    bagGrid.innerHTML = '';

    if (hasWeaponBag) {
      const wSlot = document.createElement('div');
      wSlot.className = 'inv-slot weapon-slot-wide backpack-weapon-slot';
      if (L.backpackWeapon && GAME_DATA.ITEMS[L.backpackWeapon]) {
        const wDef = GAME_DATA.ITEMS[L.backpackWeapon];
        const bwMeta = this._getLoadoutWeaponMeta('backpackWeapon');
        const wItem = { id: L.backpackWeapon, qty: 1, mods: bwMeta.mods, rarityOverride: bwMeta.rarity };
        wSlot.classList.add(`rarity-${this._resolveItemRarity(wItem, wDef)}`);
        wSlot.innerHTML = this._renderInvSlotInner(wItem, wDef, { wide: true, typeLabel: 'WPN SLOT' });
        wSlot.title = `${wDef.name} (Backpack Weapon Slot) — Click to return to Weapon Stash`;
        wSlot.addEventListener('click', () => {
          if (this._deployWeaponPick && this._deployWeaponPick.validTargets.includes('backpackWeapon')) {
            this._confirmDeployWeaponPickSlot('backpackWeapon');
            return;
          }
          this.addToStash(L.backpackWeapon, 1, bwMeta.mods, bwMeta.rarity);
          L.backpackWeapon = null;
          L.backpackWeaponMods = null;
          L.backpackWeaponRarity = null;
          this.saveProfile();
          this.renderHideout();
        });
      } else {
        wSlot.classList.add('empty-slot');
        wSlot.innerHTML = `<div class="slot-top-bar"><span class="slot-type">WPN SLOT</span></div><span class="empty-wpn-hint">WEAPON SLOT</span>`;
        wSlot.addEventListener('click', () => {
          if (this._deployWeaponPick && this._deployWeaponPick.validTargets.includes('backpackWeapon')) {
            this._confirmDeployWeaponPickSlot('backpackWeapon');
          }
        });
      }
      bagGrid.appendChild(wSlot);
    }

    for (let i = 0; i < maxBagSlots; i++) {
      const item = L.backpackItems[i];
      const cell = document.createElement('div');
      cell.className = 'inv-slot';
      if (item && GAME_DATA.ITEMS[item.id]) {
        const def = GAME_DATA.ITEMS[item.id];
        const isWpn = def.type === 'weapon';
        if (isWpn) cell.classList.add('weapon-slot-wide');
        cell.classList.add(`rarity-${this._resolveItemRarity(item, def)}`);
        cell.innerHTML = this._renderInvSlotInner(item, def, { wide: isWpn });
        cell.title = `${def.name}${item.qty > 1 ? ' x' + item.qty : ''} — Click to return to Stash`;
        cell.addEventListener('click', () => {
          this.addToStash(item.id, item.qty, item.mods || null, item.rarityOverride || null);
          L.backpackItems.splice(i, 1);
          this.saveProfile();
          this.renderHideout();
        });
      } else {
        cell.classList.add('empty-slot');
      }
      bagGrid.appendChild(cell);
    }
  }

  closeDeployWeaponPickMode() {
    this._deployWeaponPick = null;
    const view = document.getElementById('menu-view-deploy');
    if (view) view.classList.remove('weapon-pick-active');
    const banner = document.getElementById('deploy-wpn-pick-banner');
    if (banner) banner.remove();
    document.querySelectorAll('#menu-view-deploy .wpn-pick-target').forEach(el => el.classList.remove('wpn-pick-target'));
    document.querySelectorAll('#menu-view-deploy .wpn-pick-slot-badge').forEach(el => el.remove());
  }

  _confirmDeployWeaponPickSlot(targetKey) {
    const ctx = this._deployWeaponPick;
    if (!ctx) return false;
    const { weaponStashIdx, wItem } = ctx;
    const L = this.profile.loadout;
    const prevId = L[targetKey];
    const prevMods = prevId ? (L[targetKey + 'Mods'] || (this.profile.weaponMods && this.profile.weaponMods[prevId]) || null) : null;
    const prevRarity = prevId ? (L[targetKey + 'Rarity'] || null) : null;
    this.profile.weaponStash.splice(weaponStashIdx, 1);
    if (prevId) this.addToStash(prevId, 1, prevMods, prevRarity);
    L[targetKey] = wItem.id;
    const cleanMods = (window.GAME_DATA && GAME_DATA.normalizeWeaponMods)
      ? GAME_DATA.normalizeWeaponMods(wItem.mods || {})
      : { ...(wItem.mods || {}) };
    L[targetKey + 'Mods'] = cleanMods;
    L[targetKey + 'Rarity'] = wItem.rarityOverride
      || ((window.GAME_DATA && GAME_DATA.resolveWeaponRarity)
        ? GAME_DATA.resolveWeaponRarity(wItem.id, cleanMods, null)
        : null);
    this.closeDeployWeaponPickMode();
    if (window.soundEngine && window.soundEngine.playMagIn) {
      try { window.soundEngine.playMagIn(); } catch (e) {}
    }
    this.saveProfile();
    this.renderHideout();
    return true;
  }

  _openDeployStashWeaponStaging(weaponStashIdx) {
    const wItem = this.profile.weaponStash[weaponStashIdx];
    if (!wItem || !GAME_DATA.ITEMS[wItem.id]) return;
    const view = document.getElementById('menu-view-deploy');
    const rightPanel = view ? view.querySelector('.edge-panel-right') : null;
    if (!view || !rightPanel) return;

    this.closeDeployWeaponPickMode();

    const L = this.profile.loadout;
    const wDef = GAME_DATA.ITEMS[wItem.id];
    const bagDef = GAME_DATA.ITEMS[L.backpack || 'bag_small'];
    const hasWeaponBag = !!(bagDef && bagDef.weaponSlot);
    const allMods = this.profile.weaponMods || {};
    const validTargets = ['primary', 'secondary'];
    if (hasWeaponBag) validTargets.push('backpackWeapon');

    this._deployWeaponPick = { weaponStashIdx, wItem, validTargets };
    view.classList.add('weapon-pick-active');

    // Floating selected-weapon card at top of the right-side backpack/loadout panel (matches in-raid UI!)
    const banner = document.createElement('div');
    banner.id = 'deploy-wpn-pick-banner';
    banner.className = 'wpn-pick-banner';
    const iconUrl = (window.itemIcons && window.itemIcons.getIcon)
      ? window.itemIcons.getIcon(wItem.id, { wide: true, mods: wItem.mods || allMods[wItem.id] || {} })
      : '';
    banner.innerHTML = `
      <div class="wpn-pick-banner-left">
        ${iconUrl ? `<img class="wpn-pick-banner-icon" src="${iconUrl}" alt="${wDef.name}" />` : ''}
        <div class="wpn-pick-banner-info">
          <div class="wpn-pick-banner-title">${wDef.name.toUpperCase()}</div>
          <div class="wpn-pick-banner-sub">WEAPON STASH · SELECT HIGHLIGHTED WEAPON SLOT</div>
        </div>
      </div>
      <button id="btn-cancel-deploy-wpn-pick" class="btn-small" style="padding:4px 8px;flex-shrink:0;">CANCEL</button>
    `;
    rightPanel.insertBefore(banner, rightPanel.firstChild);
    const cancelBtn = banner.querySelector('#btn-cancel-deploy-wpn-pick');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeDeployWeaponPickMode();
      });
    }

    let firstTargetEl = null;
    const highlightTarget = (el, slotKey, labelText) => {
      if (!el) return;
      el.classList.add('wpn-pick-target');
      el.dataset.wpnPickKey = slotKey;
      const badge = document.createElement('span');
      badge.className = 'wpn-pick-slot-badge';
      badge.textContent = labelText;
      el.appendChild(badge);
      if (!firstTargetEl) firstTargetEl = el;
    };

    highlightTarget(
      document.querySelector('#prematch-op-slots .op-slot-card[data-op-key="primary"]'),
      'primary',
      L.primary ? 'SWAP [1]' : 'EQUIP [1]'
    );
    highlightTarget(
      document.querySelector('#prematch-op-slots .op-slot-card[data-op-key="secondary"]'),
      'secondary',
      L.secondary ? 'SWAP [2]' : 'EQUIP [2]'
    );
    if (hasWeaponBag) {
      highlightTarget(
        document.querySelector('#prematch-bag-grid .backpack-weapon-slot'),
        'backpackWeapon',
        L.backpackWeapon ? 'SWAP BAG' : 'STOW BAG'
      );
    }

    if (firstTargetEl && this.setSelectedElement) {
      this.setSelectedElement(firstTargetEl, { inputMode: 'gamepad' });
    }
  }

  _formatKeyCode(code) {
    if (!code) return '---';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    const map = {
      ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT',
      ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL',
      Space: 'SPACE', Tab: 'TAB', AltLeft: 'L-ALT', AltRight: 'R-ALT'
    };
    return map[code] || code.toUpperCase();
  }

  _formatGamepadButton(idx) {
    const names = {
      0: 'A / Cross',
      1: 'B / Circle',
      2: 'X / Square',
      3: 'Y / Triangle',
      4: 'LB / L1',
      5: 'RB / R1',
      6: 'LT / L2',
      7: 'RT / R2',
      8: 'Back / Select',
      9: 'Start / Menu',
      10: 'L3 (Left Stick)',
      11: 'R3 (Right Stick)',
      12: 'D-Pad Up',
      13: 'D-Pad Down',
      14: 'D-Pad Left',
      15: 'D-Pad Right'
    };
    return names[idx] !== undefined ? names[idx] : `BTN ${idx}`;
  }

  renderKeybindSettings() {
    const kbmPane = document.getElementById('keybinds-kbm-pane');
    const ctrlPane = document.getElementById('keybinds-controller-pane');
    if (!kbmPane || !ctrlPane) return;

    // 1. Keyboard & Mouse Controls Tab
    const kbmLabels = [
      ['moveForward', 'Move Forward'],
      ['moveBack', 'Move Backward'],
      ['moveLeft', 'Move Left'],
      ['moveRight', 'Move Right'],
      ['sprint', 'Sprint / 2x Tac-Sprint'],
      ['crouch', 'Crouch / Slide / Hold Prone'],
      ['jump', 'Jump / Stand / Slide-Cancel'],
      ['reload', 'Reload Weapon'],
      ['inspect', 'Inspect Weapon'],
      ['tacStance', 'Toggle Tactical Stance (45° Canted ADS)'],
      ['plates', 'Insert Armor Plates'],
      ['medkit', 'Use Field Medkit'],
      ['lethal', 'Lethal Throwable'],
      ['tactical', 'Tactical Throwable'],
      ['fieldUpgrade', 'Activate Field Upgrade'],
      ['killstreak', 'Activate Killstreak'],
      ['slotPrimary', 'Primary Weapon'],
      ['slotSecondary', 'Secondary Weapon'],
      ['slotMelee', 'Dedicated Melee Weapon'],
      ['quickMelee', 'Quick Melee Strike'],
      ['interact', 'Loot / Interact / Revive'],
      ['backpack', 'Open Backpack (Hold: Stow Ground Weapon)'],
      ['map', 'Toggle Full-Size Tactical Map'],
      ['thirdPerson', 'Toggle 3rd-Person Camera']
    ];
    kbmPane.innerHTML = '';

    // Mouse Controls (reference rows)
    const mouseRows = [
      ['LMB / RMB', 'Fire / Aim Down Sights'],
      ['MMB (Tap / 2x / Hold)', 'Ping Location / Enemy Ping / Ping Wheel'],
      ['SCROLL', 'Switch Weapon Slot']
    ];
    for (const [keyTxt, desc] of mouseRows) {
      const row = document.createElement('div');
      row.className = 'ctrl-row';
      row.innerHTML = `<b style="min-width:110px;">${keyTxt}</b><span>${desc}</span>`;
      kbmPane.appendChild(row);
    }

    for (const [action, label] of kbmLabels) {
      const row = document.createElement('div');
      row.className = 'ctrl-row';
      const btn = document.createElement('button');
      btn.className = 'btn-small';
      btn.style.minWidth = '88px';
      btn.textContent = this._formatKeyCode(window.KEYBINDS[action]);
      btn.addEventListener('click', () => {
        if (this._rebindCleanup) this._rebindCleanup();
        btn.textContent = 'PRESS KEY...';
        btn.style.borderColor = '#f5a623';
        btn.style.color = '#f5a623';
        const onKey = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.code !== 'Escape') {
            window.KEYBINDS[action] = ev.code;
            this.profile.keybinds = { ...window.KEYBINDS };
            this.saveProfile();
          }
          cleanup();
          this.renderKeybindSettings();
        };
        const cleanup = () => {
          window.removeEventListener('keydown', onKey, true);
          this._rebindCleanup = null;
        };
        this._rebindCleanup = cleanup;
        window.addEventListener('keydown', onKey, true);
      });
      const lbl = document.createElement('span');
      lbl.textContent = label;
      row.append(btn, lbl);
      kbmPane.appendChild(row);
    }

    const kbmResetRow = document.createElement('div');
    kbmResetRow.className = 'ctrl-row';
    kbmResetRow.style.marginTop = '6px';
    const kbmResetBtn = document.createElement('button');
    kbmResetBtn.className = 'btn-small btn-danger';
    kbmResetBtn.textContent = 'RESET KB/M DEFAULTS';
    kbmResetBtn.addEventListener('click', () => {
      window.KEYBINDS = { ...window.DEFAULT_KEYBINDS };
      this.profile.keybinds = { ...window.KEYBINDS };
      this.saveProfile();
      this.renderKeybindSettings();
    });
    kbmResetRow.appendChild(kbmResetBtn);
    kbmPane.appendChild(kbmResetRow);

    // 2. Controller Button Bindings Tab
    const gpLabels = [
      ['fire', 'Fire Weapon'],
      ['ads', 'Aim Down Sights / Cancel Throw'],
      ['sprint', 'Sprint / 2x Tac-Sprint (ADS Hold: Focus)'],
      ['jump', 'Jump / Stand / Slide-Cancel'],
      ['crouch', 'Crouch / Slide / Hold Prone'],
      ['interactReload', 'Loot / Interact / Reload'],
      ['revive', 'Hold: Revive / Self-Revive / Tourniquet'],
      ['swapPlates', 'Tap: Swap Weapon · Hold: Armor Plates'],
      ['lethal', 'Lethal Throwable (LB+RB: Field Upgrade)'],
      ['tactical', 'Tactical Throwable (LB+RB: Field Upgrade)'],
      ['melee', 'Tap: Quick Melee · Hold: Equip Melee'],
      ['medkit', 'Use Field Medkit'],
      ['backpack', 'Open Backpack (Hold: Stow Ground Weapon)'],
      ['inspect', 'Inspect Weapon (LT + Tap: Tac-Stance)'],
      ['killstreak', 'Activate Killstreak'],
      ['map', 'Toggle Full-Size Tactical Map'],
      ['pause', 'Pause Menu']
    ];
    const stickRows = [
      ['LEFT STICK', 'Move / Inventory Cursor'],
      ['RIGHT STICK', 'Aim / Look (Rotational Aim Assist)']
    ];
    const ctrlTargets = [ctrlPane, document.getElementById('settings-controller-binds')].filter(Boolean);
    ctrlTargets.forEach((targetPane) => {
      targetPane.innerHTML = '';
      for (const [keyTxt, desc] of stickRows) {
        const row = document.createElement('div');
        row.className = 'ctrl-row';
        row.innerHTML = `<b style="min-width:110px;">${keyTxt}</b><span>${desc}</span>`;
        targetPane.appendChild(row);
      }

      for (const [action, label] of gpLabels) {
        const row = document.createElement('div');
        row.className = 'ctrl-row';
        const btn = document.createElement('button');
        btn.className = 'btn-small';
        btn.style.minWidth = '112px';
        btn.textContent = this._formatGamepadButton(window.GAMEPAD_BINDS[action]);
        btn.addEventListener('click', () => {
          if (this._rebindCleanup) this._rebindCleanup();
          btn.textContent = 'PRESS BUTTON...';
          btn.style.borderColor = '#69f0ae';
          btn.style.color = '#69f0ae';
          let rafId = null;
          let armed = false;
          const pollPad = () => {
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            let activePad = null;
            for (const p of pads) { if (p && p.connected) { activePad = p; break; } }
            if (activePad) {
              const anyDown = activePad.buttons.some(b => b && (b.pressed || b.value > 0.55));
              if (!armed) {
                if (!anyDown) armed = true;
              } else {
                for (let i = 0; i < activePad.buttons.length; i++) {
                  const b = activePad.buttons[i];
                  if (b && (b.pressed || b.value > 0.55)) {
                    window.GAMEPAD_BINDS[action] = i;
                    this.profile.gamepadBinds = { ...window.GAMEPAD_BINDS };
                    this.saveProfile();
                    cleanup();
                    this.renderKeybindSettings();
                    return;
                  }
                }
              }
            }
            rafId = requestAnimationFrame(pollPad);
          };
          const onEsc = (ev) => {
            if (ev.code === 'Escape') {
              ev.preventDefault();
              cleanup();
              this.renderKeybindSettings();
            }
          };
          const cleanup = () => {
            if (rafId) cancelAnimationFrame(rafId);
            window.removeEventListener('keydown', onEsc, true);
            this._rebindCleanup = null;
          };
          this._rebindCleanup = cleanup;
          window.addEventListener('keydown', onEsc, true);
          rafId = requestAnimationFrame(pollPad);
        });
        const lbl = document.createElement('span');
        lbl.textContent = label;
        row.append(btn, lbl);
        targetPane.appendChild(row);
      }

      const gpResetRow = document.createElement('div');
      gpResetRow.className = 'ctrl-row';
      gpResetRow.style.marginTop = '6px';
      const gpResetBtn = document.createElement('button');
      gpResetBtn.className = 'btn-small btn-danger';
      gpResetBtn.textContent = 'RESET CONTROLLER DEFAULTS';
      gpResetBtn.addEventListener('click', () => {
        window.GAMEPAD_BINDS = { ...window.DEFAULT_GAMEPAD_BINDS };
        this.profile.gamepadBinds = { ...window.GAMEPAD_BINDS };
        this.saveProfile();
        this.renderKeybindSettings();
      });
      const gpTip = document.createElement('span');
      gpTip.style.color = '#69f0ae';
      gpTip.textContent = 'Click any button and press a controller input (ESC to cancel)';
      gpResetRow.append(gpResetBtn, gpTip);
      targetPane.appendChild(gpResetRow);
    });
  }

  _equipOrPackFromStash(stashIdx, maxBagSlots) {
    const item = this.profile.stash[stashIdx];
    if (!item) return;
    const def = GAME_DATA.ITEMS[item.id];
    if (!def) return;
    const L = this.profile.loadout;
    if (!Array.isArray(L.backpackItems)) L.backpackItems = [];

    if (def.type === 'weapon') {
      // Any gun can be equipped in either Primary or Secondary slot!
      const targetSlot = !L.primary ? 'primary' : (!L.secondary ? 'secondary' : 'primary');
      if (L[targetSlot]) {
        this.addToStash(L[targetSlot], 1, L[targetSlot + 'Mods'] || null, L[targetSlot + 'Rarity'] || null);
      }
      L[targetSlot] = item.id;
      L[targetSlot + 'Mods'] = item.mods || (this.profile.weaponMods && this.profile.weaponMods[item.id]) || {};
      L[targetSlot + 'Rarity'] = item.rarityOverride
        || ((window.GAME_DATA && GAME_DATA.resolveWeaponRarity)
          ? GAME_DATA.resolveWeaponRarity(item.id, L[targetSlot + 'Mods'], null)
          : null);
      this.profile.stash.splice(stashIdx, 1);
      this.saveProfile();
      this.renderHideout();
      return;
    }

    const slotMap = {
      armor: 'armor',
      backpack: 'backpack',
      field_upgrade: 'fieldUpgrade',
      killstreak: 'killstreak',
      self_revive: 'selfRevive',
      headgear: 'headgear',
      melee: 'melee'
    };
    const targetSlot = slotMap[def.type];
    if (targetSlot) {
      if (L[targetSlot]) this.addToStash(L[targetSlot], 1);
      L[targetSlot] = item.id;
      this.profile.stash.splice(stashIdx, 1);
      if (targetSlot === 'backpack') {
        const newBagDef = GAME_DATA.ITEMS[item.id];
        const newMax = (newBagDef && (newBagDef.slots || newBagDef.bagSlots)) || 8;
        if (!(newBagDef && newBagDef.weaponSlot) && L.backpackWeapon) {
          this.addToStash(L.backpackWeapon, 1, L.backpackWeaponMods || null, L.backpackWeaponRarity || null);
          L.backpackWeapon = null;
          L.backpackWeaponMods = null;
          L.backpackWeaponRarity = null;
        }
        while (L.backpackItems.length > newMax) {
          const extra = L.backpackItems.pop();
          if (extra) this.addToStash(extra.id, extra.qty, extra.mods || null, extra.rarityOverride || null);
        }
      }
    } else if (def.type === 'plate') {
      const space = Math.max(0, 6 - (L.plates || 0));
      if (space > 0) {
        const move = Math.min(space, item.qty);
        L.plates = (L.plates || 0) + move;
        item.qty -= move;
        if (item.qty <= 0) this.profile.stash.splice(stashIdx, 1);
      } else if (L.backpackItems.length < maxBagSlots) {
        L.backpackItems.push({ id: item.id, qty: item.qty });
        this.profile.stash.splice(stashIdx, 1);
      }
    } else if (def.type === 'ammo') {
      L.ammo[item.id] = (L.ammo[item.id] || 0) + item.qty;
      this.profile.stash.splice(stashIdx, 1);
    } else {
      const existing = def.stackable ? L.backpackItems.find(it => it && it.id === item.id) : null;
      if (existing) {
        existing.qty += item.qty;
        this.profile.stash.splice(stashIdx, 1);
      } else if (L.backpackItems.length < maxBagSlots) {
        L.backpackItems.push({
          id: item.id,
          qty: item.qty,
          ...(item.mods ? { mods: item.mods } : {}),
          ...(item.rarityOverride ? { rarityOverride: item.rarityOverride } : {})
        });
        this.profile.stash.splice(stashIdx, 1);
      } else {
        return;
      }
    }
    this.saveProfile();
    this.renderHideout();
  }

  // ==================== WORKBENCH (CRAFTING & BULK MATERIAL SALE) ====================
  renderWorkbench() {
    const recEl = document.getElementById('workbench-recipes');
    const matEl = document.getElementById('workbench-materials');
    if (!recEl || !matEl) return;

    const countMat = (id) => this.profile.stash
      .filter(i => i.id === id)
      .reduce((acc, i) => acc + i.qty, 0);

    const consumeMat = (id, needed) => {
      let rem = needed;
      for (let i = this.profile.stash.length - 1; i >= 0 && rem > 0; i--) {
        if (this.profile.stash[i].id === id) {
          const take = Math.min(rem, this.profile.stash[i].qty);
          this.profile.stash[i].qty -= take;
          rem -= take;
          if (this.profile.stash[i].qty <= 0) this.profile.stash.splice(i, 1);
        }
      }
    };

    recEl.innerHTML = '';
    for (const r of (GAME_DATA.WORKBENCH_RECIPES || [])) {
      const outDef = GAME_DATA.ITEMS[r.output];
      if (!outDef) continue;
      let canCraft = true;
      const reqParts = Object.entries(r.inputs).map(([mId, need]) => {
        const have = countMat(mId);
        if (have < need) canCraft = false;
        const mName = (GAME_DATA.ITEMS[mId] && GAME_DATA.ITEMS[mId].name) || mId;
        return `<span style="color:${have >= need ? '#69f0ae' : '#ff6b6b'}">${mName} ${have}/${need}</span>`;
      });

      const row = document.createElement('div');
      row.className = `item-row rarity-${outDef.rarity || 'common'}`;
      row.innerHTML = `
        <div class="item-info">
          <div class="item-name">${outDef.name}${r.qty > 1 ? ' x' + r.qty : ''}</div>
          <div class="item-meta">${reqParts.join(' · ')}</div>
        </div>
        <button class="btn-small" ${canCraft ? '' : 'disabled'}>CRAFT</button>
      `;
      row.querySelector('button').addEventListener('click', () => {
        if (!canCraft) {
          if (window.soundEngine && window.soundEngine.playUiError) {
            try { window.soundEngine.playUiError(); } catch (e) {}
          }
          return;
        }
        for (const [mId, need] of Object.entries(r.inputs)) consumeMat(mId, need);
        this.addToStash(r.output, r.qty || 1);
        if (window.soundEngine && window.soundEngine.playCraft) {
          try { window.soundEngine.playCraft(); } catch (e) {}
        }
        this.saveProfile();
        this.renderHideout();
      });
      recEl.appendChild(row);
    }

    matEl.innerHTML = '';
    const mats = this.profile.stash.filter(i => GAME_DATA.ITEMS[i.id] && GAME_DATA.ITEMS[i.id].type === 'material');
    if (mats.length === 0) {
      matEl.innerHTML = '<p class="hint" style="padding:12px;">No common materials in stash. Loot sectors to collect Scrap Metal, Cloth, Gunpowder & Polymer.</p>';
    } else {
      mats.forEach((m) => {
        const def = GAME_DATA.ITEMS[m.id];
        const row = document.createElement('div');
        row.className = `item-row rarity-${def.rarity || 'common'}`;
        row.innerHTML = `
          <div class="item-info">
            <div class="item-name">${def.name} x${m.qty} / 10</div>
            <div class="item-meta">₽ ${(def.value * m.qty).toLocaleString()} · ${def.desc}</div>
          </div>
        `;
        matEl.appendChild(row);
      });
    }
  }

  _ensureMissions() {
    if (!this.profile) return { active: [], progress: {}, completed: [] };
    if (!this.profile.missions || typeof this.profile.missions !== 'object') {
      this.profile.missions = { active: ['m_scav_hunt', 'm_clean_exfil'], progress: {}, completed: [] };
    }
    if (!Array.isArray(this.profile.missions.active)) this.profile.missions.active = [];
    if (!this.profile.missions.progress || typeof this.profile.missions.progress !== 'object') this.profile.missions.progress = {};
    if (!Array.isArray(this.profile.missions.completed)) this.profile.missions.completed = [];
    return this.profile.missions;
  }

  showMissionProgressTicker(def, prev, next) {
    if (!def || typeof document === 'undefined') return;
    let stack = document.getElementById('mission-ticker-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'mission-ticker-stack';
      stack.className = 'mission-ticker-stack';
      document.body.appendChild(stack);
    }
    if (!this._missionTickers) this._missionTickers = new Map();

    const target = Math.max(1, def.target || 1);
    const clampedNext = Math.min(target, next);
    const done = clampedNext >= target;
    const pct = Math.min(100, Math.round((clampedNext / target) * 100));
    const progText = def.type === 'value'
      ? `₽${clampedNext.toLocaleString()} / ₽${target.toLocaleString()}`
      : `${clampedNext.toLocaleString()} / ${target.toLocaleString()}`;

    let entry = this._missionTickers.get(def.id);
    if (entry && entry.el && entry.el.isConnected) {
      if (entry.timerId) clearTimeout(entry.timerId);
      if (entry.removeTimerId) clearTimeout(entry.removeTimerId);
      entry.el.classList.remove('closing');
    } else {
      const el = document.createElement('div');
      el.className = 'mission-ticker-card';
      stack.appendChild(el);
      entry = { el, timerId: null, removeTimerId: null };
      this._missionTickers.set(def.id, entry);
    }

    entry.el.classList.toggle('complete', done);
    entry.el.innerHTML = `
      <div class="mt-head">
        <span class="mt-eyebrow">${def.faction || 'SECTOR 7'} // ${done ? 'MISSION COMPLETE' : 'MISSION PROGRESS'}</span>
        <span class="mt-count">${progText}</span>
      </div>
      <div class="mt-title">${def.title}</div>
      <div class="mt-desc">${def.desc || ''}</div>
      <div class="mt-bar-bg"><div class="mt-bar-fill" style="width:${pct}%"></div></div>
      <div class="mt-timer-strip"><div class="mt-timer-fill"></div></div>
    `;

    // Restart 5.0-second display countdown cleanly
    const timerFill = entry.el.querySelector('.mt-timer-fill');
    if (timerFill) {
      timerFill.style.animation = 'none';
      void timerFill.offsetWidth;
      timerFill.style.animation = 'mtDrain5s 5s linear forwards';
    }

    entry.timerId = setTimeout(() => {
      if (!entry.el) return;
      entry.el.classList.add('closing');
      entry.removeTimerId = setTimeout(() => {
        if (entry.el && entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
        this._missionTickers.delete(def.id);
      }, 260);
    }, 5000);
  }

  recordMissionProgress(eventType, amount = 1) {
    if (!amount || amount <= 0) return;
    const ms = this._ensureMissions();
    const defs = GAME_DATA.MISSIONS || [];
    let changed = false;
    for (const id of ms.active) {
      const def = defs.find(m => m.id === id);
      if (!def || def.type !== eventType) continue;
      const prev = ms.progress[id] || 0;
      if (prev >= def.target) continue;
      const next = eventType === 'value'
        ? Math.max(prev, Math.floor(amount))
        : Math.min(def.target, prev + Math.floor(amount));
      if (next !== prev) {
        ms.progress[id] = next;
        changed = true;
        this.showMissionProgressTicker(def, prev, next);
        if (next >= def.target) {
          if (this.addFeedMessage) this.addFeedMessage(`CONTRACT COMPLETE: ${def.title} — Claim reward at FOB Missions Board!`, '#ffca28');
          if (this.showCenterToast) this.showCenterToast(`CONTRACT COMPLETE: ${def.title}`, '#ffca28');
        }
      }
    }
    if (changed) this.saveProfile();
  }

  renderMissions() {
    const activeEl = document.getElementById('missions-active-list');
    const availEl = document.getElementById('missions-available-list');
    const countEl = document.getElementById('missions-active-count');
    if (!activeEl || !availEl) return;

    const ms = this._ensureMissions();
    const defs = GAME_DATA.MISSIONS || [];
    if (countEl) countEl.textContent = `${ms.active.length} / 3 ACTIVE`;

    activeEl.innerHTML = '';
    if (ms.active.length === 0) {
      activeEl.innerHTML = '<p class="hint" style="padding:12px;">No active contracts. Accept up to 3 contracts from the Sector 7 Contract Board.</p>';
    } else {
      for (const id of ms.active) {
        const def = defs.find(m => m.id === id);
        if (!def) continue;
        const prog = Math.min(def.target, ms.progress[id] || 0);
        const pct = Math.min(100, Math.round((prog / Math.max(1, def.target)) * 100));
        const ready = prog >= def.target;
        const card = document.createElement('div');
        card.className = `mission-card${ready ? ' done' : ''}`;
        card.innerHTML = `
          <div class="mission-card-head">
            <span class="mission-faction">${def.faction} CONTRACT</span>
            <span class="mission-faction" style="color:${ready ? '#69f0ae' : '#9ec0d4'};">${prog.toLocaleString()} / ${def.target.toLocaleString()}</span>
          </div>
          <div class="mission-title">${def.title}</div>
          <div class="mission-desc">${def.desc}</div>
          <div class="mission-bar-wrap"><div class="mission-bar-fill" style="width:${pct}%"></div></div>
          <div class="mission-card-foot">
            <span>REWARD: ₽${def.rewardCredits.toLocaleString()} · ${def.rewardXp} XP</span>
            <button class="btn-small ${ready ? 'accent-btn' : ''}">${ready ? 'CLAIM REWARD' : 'ABANDON'}</button>
          </div>
        `;
        card.querySelector('button').addEventListener('click', () => {
          if (ready) {
            this.profile.credits = (this.profile.credits || 0) + def.rewardCredits;
            this.profile.xp = (this.profile.xp || 0) + def.rewardXp;
            ms.active = ms.active.filter(x => x !== id);
            if (!ms.completed.includes(id)) ms.completed.push(id);
            if (window.soundEngine && window.soundEngine.playPurchase) {
              try { window.soundEngine.playPurchase(); } catch (e) {}
            }
          } else {
            ms.active = ms.active.filter(x => x !== id);
            if (window.soundEngine && window.soundEngine.playUiBack) {
              try { window.soundEngine.playUiBack(); } catch (e) {}
            }
          }
          this.saveProfile();
          this.renderHideout();
          this.renderMissions();
        });
        activeEl.appendChild(card);
      }
    }

    availEl.innerHTML = '';
    for (const def of defs) {
      const isActive = ms.active.includes(def.id);
      const isDone = ms.completed.includes(def.id);
      const card = document.createElement('div');
      card.className = `mission-card${isDone ? ' done' : ''}`;
      card.innerHTML = `
        <div class="mission-card-head">
          <span class="mission-faction">${def.faction}</span>
          <span class="mission-faction" style="color:${isDone ? '#69f0ae' : (isActive ? '#f5a623' : '#9ec0d4')};">${isDone ? 'COMPLETED ✓' : (isActive ? 'ACTIVE' : 'AVAILABLE')}</span>
        </div>
        <div class="mission-title">${def.title}</div>
        <div class="mission-desc">${def.desc}</div>
        <div class="mission-card-foot">
          <span>REWARD: ₽${def.rewardCredits.toLocaleString()} · ${def.rewardXp} XP</span>
          ${(!isActive && !isDone) ? `<button class="btn-small" ${ms.active.length >= 3 ? 'disabled' : ''}>ACCEPT</button>` : ''}
        </div>
      `;
      const btn = card.querySelector('button');
      if (btn) {
        btn.addEventListener('click', () => {
          if (ms.active.length >= 3) {
            if (window.soundEngine && window.soundEngine.playUiError) {
              try { window.soundEngine.playUiError(); } catch (e) {}
            }
            return;
          }
          ms.active.push(def.id);
          if (window.soundEngine && window.soundEngine.playUiConfirm) {
            try { window.soundEngine.playUiConfirm(); } catch (e) {}
          }
          this.saveProfile();
          this.renderMissions();
        });
      }
      availEl.appendChild(card);
    }
  }

  _ensureActiveDutyOperators() {
    if (!this.profile) return [];
    const defaults = [
      {
        id: 'op_1',
        slotLabel: 'SLOT 01 // ACTIVE DUTY',
        callsign: 'GHOST-01',
        title: 'TACTICAL RANGER // TF-7',
        accent: '#69f0ae',
        helmet: '#2a332b',
        visor: '#69f0ae',
        rig: '#384437',
        uniform: '#222924',
        style: 'nvg',
        exfilStreak: 0,
        gear: null
      },
      {
        id: 'op_2',
        slotLabel: 'SLOT 02 // ACTIVE DUTY',
        callsign: 'VIPER-02',
        title: 'NIGHT RECON // SHADOW',
        accent: '#42a5f5',
        helmet: '#1f2836',
        visor: '#42a5f5',
        rig: '#283647',
        uniform: '#19202b',
        style: 'goggles',
        exfilStreak: 0,
        gear: null
      },
      {
        id: 'op_3',
        slotLabel: 'SLOT 03 // ACTIVE DUTY',
        callsign: 'KODIAK-03',
        title: 'HEAVY BREACHER // IRON',
        accent: '#f5a623',
        helmet: '#3d3528',
        visor: '#f5a623',
        rig: '#524634',
        uniform: '#2c261e',
        style: 'heavy',
        exfilStreak: 0,
        gear: null
      }
    ];
    if (!Array.isArray(this.profile.activeDutyOperators) || this.profile.activeDutyOperators.length !== 3) {
      this.profile.activeDutyOperators = defaults.map((d) => ({ ...d }));
    } else {
      this.profile.activeDutyOperators = defaults.map((d, i) => ({
        ...d,
        ...(this.profile.activeDutyOperators[i] || {})
      }));
    }
    if (typeof this.profile.activeOperatorIdx !== 'number' || this.profile.activeOperatorIdx < 0 || this.profile.activeOperatorIdx > 2) {
      this.profile.activeOperatorIdx = 0;
    }
    return this.profile.activeDutyOperators;
  }

  _getDogtagInfo(streak = 0) {
    const s = Math.max(0, Math.floor(Number(streak) || 0));
    if (s >= 10) return { tier: 'DAMASCUS DOGTAG', level: 'LVL 4', levelNum: 4, color: '#c48bff', stroke: '#8c52ff', value: 50000, streak: s };
    if (s >= 5) return { tier: 'GOLD DOGTAG', level: 'LVL 3', levelNum: 3, color: '#ffd54f', stroke: '#f5a623', value: 25000, streak: s };
    if (s >= 2) return { tier: 'SILVER DOGTAG', level: 'LVL 2', levelNum: 2, color: '#cfd8dc', stroke: '#90a4ae', value: 10000, streak: s };
    return { tier: 'BRONZE DOGTAG', level: 'LVL 1', levelNum: 1, color: '#cd8c52', stroke: '#9c6230', value: 2500, streak: s };
  }

  _buildOperatorPortraitSVG(op) {
    const gId = `opBg_${op.id}`;
    const visorDetails = op.style === 'nvg'
      ? `<rect x="78" y="45" width="14" height="10" rx="2" fill="#121614" stroke="${op.visor}" stroke-width="1.4"/>
         <rect x="108" y="45" width="14" height="10" rx="2" fill="#121614" stroke="${op.visor}" stroke-width="1.4"/>
         <circle cx="85" cy="50" r="2.6" fill="${op.visor}" opacity="0.9"/>
         <circle cx="115" cy="50" r="2.6" fill="${op.visor}" opacity="0.9"/>
         <rect x="92" y="42" width="16" height="8" rx="2" fill="#1d2220"/>`
      : (op.style === 'heavy'
        ? `<path d="M72 64 Q100 58 128 64 L126 84 Q100 90 74 84 Z" fill="#15181a" stroke="${op.visor}" stroke-width="1.6"/>
           <rect x="77" y="69" width="46" height="7" rx="3" fill="${op.visor}" opacity="0.82"/>`
        : `<path d="M76 66 Q100 62 124 66 L122 77 Q100 81 78 77 Z" fill="#11161d" stroke="${op.visor}" stroke-width="1.6"/>
           <line x1="81" y1="71" x2="119" y2="71" stroke="${op.visor}" stroke-width="2.2" opacity="0.85"/>`);

    return `
      <svg class="duty-portrait-svg" viewBox="0 0 200 220" aria-hidden="true">
        <defs>
          <radialGradient id="${gId}" cx="50%" cy="42%" r="54%">
            <stop offset="0%" stop-color="${op.accent}" stop-opacity="0.28"/>
            <stop offset="68%" stop-color="${op.accent}" stop-opacity="0.06"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="200" height="220" fill="url(#${gId})"/>
        <!-- Tactical rifle silhouette across shoulder -->
        <path d="M138 96 L174 36 L181 40 L146 102 Z" fill="#15181a" stroke="#2c3338" stroke-width="1.2"/>
        <!-- Shoulders & combat jacket -->
        <path d="M28 220 L38 144 Q46 118 76 112 L124 112 Q154 118 162 144 L172 220 Z" fill="${op.uniform}" stroke="rgba(255,255,255,0.12)" stroke-width="1.4"/>
        <!-- Plate carrier & MOLLE pouches -->
        <path d="M62 118 L138 118 L144 214 L56 214 Z" fill="${op.rig}" stroke="rgba(255,255,255,0.14)" stroke-width="1.4"/>
        <rect x="68" y="132" width="64" height="14" rx="2" fill="rgba(0,0,0,0.34)"/>
        <rect x="66" y="156" width="19" height="34" rx="2" fill="#1b201e" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
        <rect x="90" y="156" width="20" height="34" rx="2" fill="#1b201e" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
        <rect x="115" y="156" width="19" height="34" rx="2" fill="#1b201e" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
        <!-- Callsign chest patch -->
        <rect x="78" y="135" width="44" height="8" rx="1.5" fill="${op.accent}" opacity="0.85"/>
        <!-- Neck & balaclava -->
        <rect x="84" y="92" width="32" height="24" rx="6" fill="#191d1c"/>
        <ellipse cx="100" cy="76" rx="26" ry="30" fill="#1f2423" stroke="rgba(255,255,255,0.1)" stroke-width="1.2"/>
        <!-- Tactical Helmet -->
        <path d="M68 70 Q68 32 100 30 Q132 32 132 70 L127 74 Q100 66 73 74 Z" fill="${op.helmet}" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
        <!-- Headset comms ear-pro -->
        <rect x="63" y="68" width="9" height="20" rx="4" fill="#16191b" stroke="${op.accent}" stroke-width="1"/>
        <rect x="128" y="68" width="9" height="20" rx="4" fill="#16191b" stroke="${op.accent}" stroke-width="1"/>
        ${visorDetails}
      </svg>
    `;
  }

  _buildDogtagIconSVG(dt) {
    return `
      <svg class="duty-dogtag-icon" viewBox="0 0 36 44" aria-hidden="true">
        <path d="M18 2 L18 10" stroke="#9aa3a8" stroke-width="2" stroke-dasharray="2 2"/>
        <rect x="6" y="10" width="24" height="30" rx="6" fill="${dt.color}" fill-opacity="0.22" stroke="${dt.color}" stroke-width="2"/>
        <circle cx="18" cy="16" r="2.2" fill="${dt.color}"/>
        <line x1="11" y1="24" x2="25" y2="24" stroke="${dt.color}" stroke-width="1.8"/>
        <line x1="11" y1="29" x2="22" y2="29" stroke="${dt.color}" stroke-width="1.5" opacity="0.85"/>
        <line x1="11" y1="34" x2="19" y2="34" stroke="${dt.color}" stroke-width="1.5" opacity="0.7"/>
      </svg>
    `;
  }

  selectActiveDutyOperator(idx) {
    const ops = this._ensureActiveDutyOperators();
    if (idx < 0 || idx >= ops.length || idx === this.profile.activeOperatorIdx) return;
    if (ops[idx] && ops[idx].empty) return;
    const L = this.profile.loadout;
    const prevOp = ops[this.profile.activeOperatorIdx];
    if (prevOp && !prevOp.empty) {
      prevOp.gear = {
        armor: L.armor || null,
        backpack: L.backpack || null,
        headgear: L.headgear || null,
        selfRevive: L.selfRevive || null,
        killstreak: L.killstreak || null
      };
    }
    this.profile.activeOperatorIdx = idx;
    const nextOp = ops[idx];
    if (nextOp && nextOp.gear) {
      L.armor = nextOp.gear.armor || null;
      L.backpack = nextOp.gear.backpack || null;
      L.headgear = nextOp.gear.headgear || null;
      L.selfRevive = nextOp.gear.selfRevive || null;
      L.killstreak = nextOp.gear.killstreak || null;
    } else if (nextOp) {
      L.armor = null;
      L.backpack = null;
      L.headgear = null;
      L.selfRevive = null;
      L.killstreak = null;
    }
    this.saveProfile();
    this.renderHideout();
  }

  _getAvailableOperatorsCatalog() {
    return [
      { id: 'op_1', callsign: 'GHOST-01', title: 'RECON // PATHFINDER', defaultSkin: 'ghost_ranger' },
      { id: 'op_2', callsign: 'VIPER-02', title: 'NIGHT RECON // SHADOW', defaultSkin: 'viper_shadow' },
      { id: 'op_3', callsign: 'KODIAK-03', title: 'HEAVY BREACHER // IRON', defaultSkin: 'kodiak_iron' },
      { id: 'op_4', callsign: 'SPECTRE-04', title: 'INFILTRATOR // ZERO', defaultSkin: 'spectre_stealth' },
      { id: 'op_5', callsign: 'VALKYRIE-05', title: 'COMBAT MEDIC // AEGIS', defaultSkin: 'valkyrie_aegis' },
      { id: 'op_6', callsign: 'TITAN-06', title: 'ASSAULT // VANGUARD', defaultSkin: 'titan_obsidian' }
    ];
  }

  _buildEmptyOperatorSilhouetteSVG() {
    return `
      <svg class="duty-portrait-svg duty-empty-silhouette" viewBox="0 0 200 220" aria-hidden="true">
        <defs>
          <radialGradient id="emptyOpGrad" cx="50%" cy="46%" r="54%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.08"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="200" height="220" fill="url(#emptyOpGrad)"/>
        <!-- Dashed tactical operator outline silhouette -->
        <path d="M32 220 L42 146 Q50 120 78 114 L122 114 Q150 120 158 146 L168 220 Z"
              fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.22)" stroke-width="1.6" stroke-dasharray="5 4"/>
        <ellipse cx="100" cy="74" rx="27" ry="31"
                 fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.24)" stroke-width="1.6" stroke-dasharray="5 4"/>
        <path d="M68 68 Q68 32 100 30 Q132 32 132 68"
              fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.8" stroke-dasharray="4 3"/>
        <!-- Centered recruit plus reticle -->
        <circle cx="100" cy="146" r="18" fill="rgba(105,240,174,0.08)" stroke="rgba(105,240,174,0.55)" stroke-width="1.5"/>
        <line x1="100" y1="137" x2="100" y2="155" stroke="#69f0ae" stroke-width="2.2"/>
        <line x1="91" y1="146" x2="109" y2="146" stroke="#69f0ae" stroke-width="2.2"/>
      </svg>
    `;
  }

  _getOperatorSkinsForOp(opId) {
    const rosters = {
      op_1: [
        { id: 'ghost_ranger', name: 'RANGER OLIVE', accent: '#69f0ae', helmet: '#2a332b', visor: '#69f0ae', rig: '#384438', uniform: '#232b24', style: 'nvg' },
        { id: 'ghost_arctic', name: 'ARCTIC GHOST', accent: '#80deea', helmet: '#c7d3db', visor: '#4dd0e1', rig: '#8fa1ad', uniform: '#b4c2cc', style: 'nvg' },
        { id: 'ghost_woodland', name: 'WOODLAND PHANTOM', accent: '#aed581', helmet: '#34422a', visor: '#9ccc65', rig: '#455436', uniform: '#283320', style: 'nvg' },
        { id: 'ghost_night', name: 'NIGHTSTALKER', accent: '#b388ff', helmet: '#16161d', visor: '#b388ff', rig: '#22212e', uniform: '#121218', style: 'nvg' }
      ],
      op_2: [
        { id: 'viper_shadow', name: 'SHADOW RECON', accent: '#42a5f5', helmet: '#1f2836', visor: '#42a5f5', rig: '#283647', uniform: '#19202b', style: 'goggles' },
        { id: 'viper_cobalt', name: 'COBALT SPECTRE', accent: '#4fc3f7', helmet: '#1a2f42', visor: '#29b6f6', rig: '#23425c', uniform: '#142333', style: 'goggles' },
        { id: 'viper_urban', name: 'URBAN VIPER', accent: '#cfd8dc', helmet: '#3c434a', visor: '#90a4ae', rig: '#4d565e', uniform: '#2c3136', style: 'goggles' },
        { id: 'viper_cbrn', name: 'CBRN HAZARD', accent: '#ffd54f', helmet: '#383a26', visor: '#ffca28', rig: '#47492e', uniform: '#2d2f1e', style: 'goggles' }
      ],
      op_3: [
        { id: 'kodiak_iron', name: 'IRON BREACHER', accent: '#f5a623', helmet: '#3d3528', visor: '#f5a623', rig: '#524634', uniform: '#2c261e', style: 'heavy' },
        { id: 'kodiak_desert', name: 'DESERT JUGGERNAUT', accent: '#ffcc80', helmet: '#7a684e', visor: '#ffb74d', rig: '#8c7758', uniform: '#5c4e3a', style: 'heavy' },
        { id: 'kodiak_crimson', name: 'CRIMSON VANGUARD', accent: '#ff5252', helmet: '#1a1a1d', visor: '#ff5252', rig: '#361c20', uniform: '#161518', style: 'heavy' },
        { id: 'kodiak_titan', name: 'TITAN CARBON', accent: '#b0bec5', helmet: '#212529', visor: '#eceff1', rig: '#2f353b', uniform: '#181b1e', style: 'heavy' }
      ],
      op_4: [
        { id: 'spectre_stealth', name: 'ZERO STEALTH', accent: '#ce93d8', helmet: '#1b1824', visor: '#ba68c8', rig: '#282236', uniform: '#14111c', style: 'nvg' },
        { id: 'spectre_ash', name: 'ASHFALL DRIFTER', accent: '#90a4ae', helmet: '#373e42', visor: '#b0bec5', rig: '#454e54', uniform: '#282e32', style: 'nvg' },
        { id: 'spectre_emerald', name: 'VIPER OPTICS', accent: '#00e676', helmet: '#18241e', visor: '#00e676', rig: '#22362c', uniform: '#111a16', style: 'nvg' },
        { id: 'spectre_ember', name: 'SCORCHED RECON', accent: '#ff8a65', helmet: '#2c1e1a', visor: '#ff7043', rig: '#3e2923', uniform: '#1e1412', style: 'nvg' }
      ],
      op_5: [
        { id: 'valkyrie_aegis', name: 'AEGIS MEDIC', accent: '#4dd0e1', helmet: '#24343b', visor: '#26c6da', rig: '#324852', uniform: '#1c282e', style: 'goggles' },
        { id: 'valkyrie_snow', name: 'ALPINE RESCUE', accent: '#ff5252', helmet: '#cfd8dc', visor: '#ff5252', rig: '#b0bec5', uniform: '#90a4ae', style: 'goggles' },
        { id: 'valkyrie_olive', name: 'FIELD SURGEON', accent: '#a5d6a7', helmet: '#2e3b2e', visor: '#81c784', rig: '#3d4f3d', uniform: '#222c22', style: 'goggles' },
        { id: 'valkyrie_obsidian', name: 'NIGHT WARDEN', accent: '#ffd54f', helmet: '#1c1d21', visor: '#ffd54f', rig: '#2a2c33', uniform: '#15161a', style: 'goggles' }
      ],
      op_6: [
        { id: 'titan_obsidian', name: 'OBSIDIAN SHIELD', accent: '#ff7043', helmet: '#1d1f24', visor: '#ff7043', rig: '#2c3038', uniform: '#16181c', style: 'heavy' },
        { id: 'titan_olive', name: 'FORTRESS OD', accent: '#81c784', helmet: '#303b2c', visor: '#66bb6a', rig: '#414f3c', uniform: '#242c21', style: 'heavy' },
        { id: 'titan_sand', name: 'DUNE BASTION', accent: '#ffe082', helmet: '#6e5e46', visor: '#ffd54f', rig: '#826f53', uniform: '#524634', style: 'heavy' },
        { id: 'titan_cobalt', name: 'BLUE STEEL', accent: '#64b5f6', helmet: '#1e2c3d', visor: '#42a5f5', rig: '#2a3e54', uniform: '#16202e', style: 'heavy' }
      ]
    };
    return rosters[opId] || rosters.op_1;
  }

  _getTraitTracksDef() {
    return [
      {
        id: 'assault',
        name: 'ASSAULT TRACK',
        accent: '#ff6b6b',
        tiers: [
          { tier: 1, name: 'QUICK HANDS', desc: '+15% faster weapon reload speed', cost: 1 },
          { tier: 2, name: 'STEADY AIM', desc: '-15% vertical & horizontal recoil', cost: 1 },
          { tier: 3, name: 'DEADEYE', desc: '+12% precision headshot damage', cost: 1 }
        ]
      },
      {
        id: 'survival',
        name: 'SURVIVAL TRACK',
        accent: '#4fc3f7',
        tiers: [
          { tier: 1, name: 'FAST PLATING', desc: '+20% faster armor plate insertion', cost: 1 },
          { tier: 2, name: 'FIELD MEDIC', desc: '+20% faster medkits & squad revives', cost: 1 },
          { tier: 3, name: 'JUGGERNAUT', desc: '+15 maximum operator health', cost: 1 }
        ]
      },
      {
        id: 'recon',
        name: 'RECON TRACK',
        accent: '#69f0ae',
        tiers: [
          { tier: 1, name: 'LIGHTWEIGHT', desc: '+8% sprint & tactical sprint speed', cost: 1 },
          { tier: 2, name: 'MARATHON', desc: '+25% stamina capacity & recovery', cost: 1 },
          { tier: 3, name: 'SCAVENGER', desc: '+25% faster container search reveal', cost: 1 }
        ]
      }
    ];
  }

  _ensureOperatorTraits(op) {
    if (!op.traits || typeof op.traits !== 'object') {
      op.traits = { assault: 0, survival: 0, recon: 0 };
    }
    const dt = this._getDogtagInfo(op.exfilStreak || 0);
    const minFromDogtag = Math.max(0, (dt.levelNum - 1) * 2);
    const spent = (op.traits.assault || 0) + (op.traits.survival || 0) + (op.traits.recon || 0);
    if (typeof op.traitPoints !== 'number' || Number.isNaN(op.traitPoints)) {
      op.traitPoints = Math.max(0, minFromDogtag - spent);
    } else if (op.traitPoints + spent < minFromDogtag) {
      op.traitPoints = minFromDogtag - spent;
    }
    return op.traits;
  }

  _resolveOperatorSkin(op) {
    const skins = this._getOperatorSkinsForOp(op.id);
    const found = skins.find((s) => s.id === op.skinId) || skins[0];
    return {
      ...op,
      skinId: found.id,
      skinName: found.name,
      accent: found.accent,
      helmet: found.helmet,
      visor: found.visor,
      rig: found.rig,
      uniform: found.uniform,
      style: found.style
    };
  }

  _bindOperatorContextAndModals() {
    if (this._opCtxBound) return;
    this._opCtxBound = true;

    const ctx = document.getElementById('op-context-menu');
    const skinModal = document.getElementById('op-skin-modal');
    const traitsModal = document.getElementById('op-traits-modal');
    const recruitModal = document.getElementById('op-recruit-modal');

    document.addEventListener('mousedown', (e) => {
      if (ctx && !ctx.classList.contains('hidden') && !ctx.contains(e.target)) {
        this.closeOperatorContextMenu();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (ctx && !ctx.classList.contains('hidden')) this.closeOperatorContextMenu();
        if (skinModal && !skinModal.classList.contains('hidden')) {
          e.stopPropagation();
          this.closeOperatorSkinModal();
        }
        if (traitsModal && !traitsModal.classList.contains('hidden')) {
          e.stopPropagation();
          this.closeOperatorTraitsModal();
        }
        if (recruitModal && !recruitModal.classList.contains('hidden')) {
          e.stopPropagation();
          this.closeOperatorRecruitModal();
        }
      }
    }, true);

    const btnSkin = document.getElementById('op-ctx-skin');
    const btnTraits = document.getElementById('op-ctx-traits');
    const btnDismiss = document.getElementById('op-ctx-dismiss');
    if (btnSkin) btnSkin.addEventListener('click', () => {
      const idx = this._opContextIdx;
      this.closeOperatorContextMenu();
      this.openOperatorSkinModal(idx);
    });
    if (btnTraits) btnTraits.addEventListener('click', () => {
      const idx = this._opContextIdx;
      this.closeOperatorContextMenu();
      this.openOperatorTraitsModal(idx);
    });
    if (btnDismiss) btnDismiss.addEventListener('click', () => {
      const idx = this._opContextIdx;
      this.closeOperatorContextMenu();
      this.dismissActiveDutyOperator(idx);
    });

    const closeSkinBtn = document.getElementById('btn-op-skin-close');
    if (closeSkinBtn) closeSkinBtn.addEventListener('click', () => this.closeOperatorSkinModal());
    if (skinModal) skinModal.addEventListener('mousedown', (e) => {
      if (e.target === skinModal) this.closeOperatorSkinModal();
    });

    const closeTraitsBtn = document.getElementById('btn-op-traits-close');
    if (closeTraitsBtn) closeTraitsBtn.addEventListener('click', () => this.closeOperatorTraitsModal());
    if (traitsModal) traitsModal.addEventListener('mousedown', (e) => {
      if (e.target === traitsModal) this.closeOperatorTraitsModal();
    });

    const closeRecruitBtn = document.getElementById('btn-op-recruit-close');
    if (closeRecruitBtn) closeRecruitBtn.addEventListener('click', () => this.closeOperatorRecruitModal());
    if (recruitModal) recruitModal.addEventListener('mousedown', (e) => {
      if (e.target === recruitModal) this.closeOperatorRecruitModal();
    });

    const resetTraitsBtn = document.getElementById('btn-op-traits-reset');
    if (resetTraitsBtn) resetTraitsBtn.addEventListener('click', () => this.resetOperatorTraits(this._opTraitsIdx));

    const devPtBtn = document.getElementById('btn-op-traits-devpt');
    if (devPtBtn) devPtBtn.addEventListener('click', () => {
      const ops = this._ensureActiveDutyOperators();
      const op = ops[this._opTraitsIdx];
      if (!op) return;
      this._ensureOperatorTraits(op);
      op.traitPoints = (op.traitPoints || 0) + 1;
      this.saveProfile();
      this.renderOperatorTraitsModal(this._opTraitsIdx);
      this.renderActiveDutyRoster();
    });
  }

  openOperatorContextMenu(idx, clientX, clientY) {
    this._bindOperatorContextAndModals();
    const ops = this._ensureActiveDutyOperators();
    const rawOp = ops[idx];
    if (!rawOp) return;
    const op = this._resolveOperatorSkin(rawOp);
    this._opContextIdx = idx;

    const ctx = document.getElementById('op-context-menu');
    const hdr = document.getElementById('op-ctx-header');
    if (!ctx) return;
    if (hdr) hdr.textContent = `${op.callsign} // ${op.skinName}`;
    ctx.classList.remove('hidden');

    const w = ctx.offsetWidth || 195;
    const h = ctx.offsetHeight || 150;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8, clientX));
    const y = Math.max(8, Math.min(window.innerHeight - h - 8, clientY));
    ctx.style.left = `${x}px`;
    ctx.style.top = `${y}px`;
  }

  closeOperatorContextMenu() {
    const ctx = document.getElementById('op-context-menu');
    if (ctx) ctx.classList.add('hidden');
  }

  dismissActiveDutyOperator(idx) {
    const ops = this._ensureActiveDutyOperators();
    const op = ops[idx];
    if (!op) return;
    // Reset operator-specific inventory, traits, trait points & dogtag level and mark slot empty
    op.empty = true;
    op.exfilStreak = 0;
    op.traitPoints = 0;
    op.traits = { assault: 0, survival: 0, recon: 0 };
    op.gear = null;

    const wasActive = idx === (this.profile.activeOperatorIdx || 0);
    if (wasActive && this.profile.loadout) {
      this.profile.loadout.armor = null;
      this.profile.loadout.backpack = null;
      this.profile.loadout.headgear = null;
      this.profile.loadout.selfRevive = null;
      this.profile.loadout.killstreak = null;
      // Switch active slot to the next available non-empty operator if one exists
      const nextIdx = ops.findIndex((o) => o && !o.empty);
      if (nextIdx >= 0) {
        this.profile.activeOperatorIdx = nextIdx;
        const nextOp = ops[nextIdx];
        if (nextOp && nextOp.gear) {
          this.profile.loadout.armor = nextOp.gear.armor || null;
          this.profile.loadout.backpack = nextOp.gear.backpack || null;
          this.profile.loadout.headgear = nextOp.gear.headgear || null;
          this.profile.loadout.selfRevive = nextOp.gear.selfRevive || null;
          this.profile.loadout.killstreak = nextOp.gear.killstreak || null;
        }
      }
    }
    this.saveProfile();
    this.renderHideout();
  }

  openOperatorRecruitModal(slotIdx) {
    this._bindOperatorContextAndModals();
    const modal = document.getElementById('op-recruit-modal');
    const grid = document.getElementById('op-recruit-grid');
    const title = document.getElementById('op-recruit-modal-title');
    if (!modal || !grid) return;

    const ops = this._ensureActiveDutyOperators();
    const catalog = this._getAvailableOperatorsCatalog();
    if (title) title.textContent = `SLOT 0${slotIdx + 1} // SELECT ACTIVE DUTY OPERATOR`;
    grid.innerHTML = '';

    catalog.forEach((tpl) => {
      const alreadyAssigned = ops.some((o) => o && !o.empty && o.id === tpl.id);
      const skins = this._getOperatorSkinsForOp(tpl.id);
      const defSkin = skins.find((s) => s.id === tpl.defaultSkin) || skins[0];
      const previewOp = { ...tpl, ...defSkin, id: `rec_${tpl.id}` };

      const card = document.createElement('button');
      card.type = 'button';
      card.className = `op-skin-choice op-recruit-choice${alreadyAssigned ? ' assigned' : ''}`;
      card.disabled = alreadyAssigned;
      card.innerHTML = `
        <div class="op-skin-choice-name" style="color:${defSkin.accent};">${tpl.callsign}</div>
        <div class="op-recruit-role">${tpl.title}</div>
        <div class="op-skin-choice-portrait">${this._buildOperatorPortraitSVG(previewOp)}</div>
        <div class="op-skin-choice-status">${alreadyAssigned ? 'ALREADY ON DUTY' : `RECRUIT · ${defSkin.name}`}</div>
      `;
      if (!alreadyAssigned) {
        card.addEventListener('click', () => {
          this.recruitOperatorIntoSlot(slotIdx, tpl);
          this.closeOperatorRecruitModal();
        });
      }
      grid.appendChild(card);
    });
    modal.classList.remove('hidden');
  }

  closeOperatorRecruitModal() {
    const modal = document.getElementById('op-recruit-modal');
    if (modal) modal.classList.add('hidden');
  }

  recruitOperatorIntoSlot(slotIdx, tpl) {
    const ops = this._ensureActiveDutyOperators();
    if (slotIdx < 0 || slotIdx >= ops.length || !tpl) return;
    const skins = this._getOperatorSkinsForOp(tpl.id);
    const defSkin = skins.find((s) => s.id === tpl.defaultSkin) || skins[0];
    const noActiveYet = !ops[this.profile.activeOperatorIdx] || ops[this.profile.activeOperatorIdx].empty;

    ops[slotIdx] = {
      id: tpl.id,
      slotLabel: `SLOT 0${slotIdx + 1} // ACTIVE DUTY`,
      callsign: tpl.callsign,
      title: tpl.title,
      skinId: defSkin.id,
      skinName: defSkin.name,
      accent: defSkin.accent,
      helmet: defSkin.helmet,
      visor: defSkin.visor,
      rig: defSkin.rig,
      uniform: defSkin.uniform,
      style: defSkin.style,
      exfilStreak: 0,
      traitPoints: 0,
      traits: { assault: 0, survival: 0, recon: 0 },
      gear: null,
      empty: false
    };

    if (noActiveYet) {
      this.profile.activeOperatorIdx = slotIdx;
    }
    this.saveProfile();
    this.renderHideout();
  }

  openOperatorSkinModal(idx) {
    this._bindOperatorContextAndModals();
    const ops = this._ensureActiveDutyOperators();
    const rawOp = ops[idx];
    if (!rawOp) return;
    const op = this._resolveOperatorSkin(rawOp);
    const modal = document.getElementById('op-skin-modal');
    const title = document.getElementById('op-skin-modal-title');
    const grid = document.getElementById('op-skin-grid');
    if (!modal || !grid) return;

    if (title) title.textContent = `${op.callsign} // EXCLUSIVE SKINS`;
    const skins = this._getOperatorSkinsForOp(op.id);
    grid.innerHTML = '';
    skins.forEach((sk) => {
      const equipped = sk.id === op.skinId;
      const previewOp = { ...op, ...sk, id: `${op.id}_${sk.id}` };
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `op-skin-choice${equipped ? ' equipped' : ''}`;
      card.innerHTML = `
        <div class="op-skin-choice-name" style="color:${sk.accent};">${sk.name}</div>
        <div class="op-skin-choice-portrait">${this._buildOperatorPortraitSVG(previewOp)}</div>
        <div class="op-skin-choice-status">${equipped ? 'EQUIPPED' : 'SELECT SKIN'}</div>
      `;
      card.addEventListener('click', () => {
        rawOp.skinId = sk.id;
        rawOp.skinName = sk.name;
        rawOp.accent = sk.accent;
        rawOp.helmet = sk.helmet;
        rawOp.visor = sk.visor;
        rawOp.rig = sk.rig;
        rawOp.uniform = sk.uniform;
        rawOp.style = sk.style;
        this.saveProfile();
        this.renderHideout();
        this.openOperatorSkinModal(idx);
      });
      grid.appendChild(card);
    });
    modal.classList.remove('hidden');
  }

  closeOperatorSkinModal() {
    const modal = document.getElementById('op-skin-modal');
    if (modal) modal.classList.add('hidden');
  }

  openOperatorTraitsModal(idx) {
    this._bindOperatorContextAndModals();
    this._opTraitsIdx = idx;
    this.renderOperatorTraitsModal(idx);
    const modal = document.getElementById('op-traits-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeOperatorTraitsModal() {
    const modal = document.getElementById('op-traits-modal');
    if (modal) modal.classList.add('hidden');
  }

  resetOperatorTraits(idx) {
    const ops = this._ensureActiveDutyOperators();
    const op = ops[idx];
    if (!op) return;
    this._ensureOperatorTraits(op);
    const spent = (op.traits.assault || 0) + (op.traits.survival || 0) + (op.traits.recon || 0);
    if (spent <= 0) return;
    op.traitPoints = (op.traitPoints || 0) + spent;
    op.traits = { assault: 0, survival: 0, recon: 0 };
    this.saveProfile();
    this.renderOperatorTraitsModal(idx);
    this.renderActiveDutyRoster();
  }

  renderOperatorTraitsModal(idx) {
    const ops = this._ensureActiveDutyOperators();
    const op = ops[idx];
    if (!op) return;
    const traits = this._ensureOperatorTraits(op);
    const dt = this._getDogtagInfo(op.exfilStreak || 0);
    const title = document.getElementById('op-traits-modal-title');
    const sub = document.getElementById('op-traits-modal-sub');
    const ptsPill = document.getElementById('op-traits-points-pill');
    const devPtBtn = document.getElementById('btn-op-traits-devpt');
    const tracksEl = document.getElementById('op-traits-tracks');
    if (!tracksEl) return;

    if (title) title.textContent = `${op.callsign} // TRAIT TRACKS`;
    if (sub) sub.textContent = `${dt.tier} (${dt.level}) · EARN +2 TRAIT PTS EACH DOGTAG LEVEL-UP`;
    if (ptsPill) {
      ptsPill.textContent = `${op.traitPoints || 0} TRAIT PTS`;
      ptsPill.classList.toggle('has-pts', (op.traitPoints || 0) > 0);
    }
    if (devPtBtn) devPtBtn.classList.toggle('hidden', !window.DEV_MODE);

    const trackDefs = this._getTraitTracksDef();
    tracksEl.innerHTML = '';
    trackDefs.forEach((tr) => {
      const unlockedTier = traits[tr.id] || 0;
      const col = document.createElement('div');
      col.className = 'op-trait-track';
      col.innerHTML = `
        <div class="op-trait-track-hdr" style="border-top-color:${tr.accent};">
          <span style="color:${tr.accent};">${tr.name}</span>
          <span class="sub">${unlockedTier}/3</span>
        </div>
        <div class="op-trait-nodes"></div>
      `;
      const nodesWrap = col.querySelector('.op-trait-nodes');
      tr.tiers.forEach((node) => {
        const isUnlocked = unlockedTier >= node.tier;
        const isNext = unlockedTier === node.tier - 1;
        const canBuy = isNext && (op.traitPoints || 0) >= node.cost;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `op-trait-node${isUnlocked ? ' unlocked' : ''}${isNext ? ' next' : ''}${!isUnlocked && !isNext ? ' locked' : ''}`;
        btn.disabled = !canBuy;
        btn.innerHTML = `
          <div class="otn-top">
            <span class="otn-tier">TIER ${node.tier}</span>
            <span class="otn-state">${isUnlocked ? 'UNLOCKED' : (isNext ? `UNLOCK (${node.cost} PT)` : 'LOCKED')}</span>
          </div>
          <div class="otn-name">${node.name}</div>
          <div class="otn-desc">${node.desc}</div>
        `;
        if (canBuy) {
          btn.addEventListener('click', () => {
            op.traitPoints = Math.max(0, (op.traitPoints || 0) - node.cost);
            traits[tr.id] = node.tier;
            this.saveProfile();
            this.renderOperatorTraitsModal(idx);
            this.renderActiveDutyRoster();
          });
        }
        nodesWrap.appendChild(btn);
      });
      tracksEl.appendChild(col);
    });
  }

  renderActiveDutyRoster() {
    this._bindOperatorContextAndModals();
    const grid = document.getElementById('active-duty-grid');
    if (!grid) return;
    const ops = this._ensureActiveDutyOperators();
    const activeIdx = this.profile.activeOperatorIdx || 0;
    grid.innerHTML = '';

    ops.forEach((rawOp, idx) => {
      if (rawOp && rawOp.empty) {
        const card = document.createElement('div');
        card.className = 'duty-op-card duty-skin-card duty-empty-card';
        card.innerHTML = `
          <div class="duty-skin-header">
            <div class="duty-skin-top-row">
              <span class="duty-slot-tag">SLOT 0${idx + 1}</span>
              <span class="duty-slot-tag">VACANT</span>
            </div>
            <div class="duty-skin-name" style="color:rgba(190,208,220,0.62);">EMPTY SLOT</div>
          </div>

          <div class="duty-portrait-wrap duty-portrait-tall">
            ${this._buildEmptyOperatorSilhouetteSVG()}
          </div>

          <div class="duty-dogtag-centered">
            <div class="duty-dogtag-level-text" style="color:#69f0ae;">+ RECRUIT OPERATOR</div>
            <div class="duty-dogtag-sub">CLICK TO SELECT ACTIVE DUTY OPERATOR</div>
          </div>
        `;
        card.addEventListener('click', () => this.openOperatorRecruitModal(idx));
        grid.appendChild(card);
        return;
      }

      const op = this._resolveOperatorSkin(rawOp);
      this._ensureOperatorTraits(rawOp);
      const isActive = idx === activeIdx;
      const dt = this._getDogtagInfo(op.exfilStreak || 0);
      const availPts = rawOp.traitPoints || 0;

      const card = document.createElement('div');
      card.className = `duty-op-card duty-skin-card${isActive ? ' active' : ''}`;
      card.innerHTML = `
        <div class="duty-skin-header">
          <div class="duty-skin-top-row">
            <span class="duty-slot-tag">${op.callsign}</span>
            ${isActive ? '<span class="duty-active-pill">ACTIVE</span>' : '<span class="duty-slot-tag">STANDBY</span>'}
          </div>
          <div class="duty-skin-name" style="color:${isActive ? op.accent : '#f2f6fa'};">${op.skinName}</div>
        </div>

        <div class="duty-portrait-wrap duty-portrait-tall">
          ${this._buildOperatorPortraitSVG(op)}
        </div>

        <div class="duty-dogtag-centered">
          ${this._buildDogtagIconSVG(dt)}
          <div class="duty-dogtag-level-text" style="color:${dt.color};">${dt.tier} · ${dt.level}</div>
          <div class="duty-dogtag-sub">EXFIL STREAK: ${dt.streak}${availPts > 0 ? ` · <span style="color:#69f0ae;font-weight:800;">${availPts} TRAIT PT${availPts > 1 ? 'S' : ''}</span>` : ''}</div>
        </div>
      `;
      card.addEventListener('click', () => this.selectActiveDutyOperator(idx));
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openOperatorContextMenu(idx, e.clientX, e.clientY);
      });
      grid.appendChild(card);
    });
  }

  renderLoadout() {
    this.renderActiveDutyRoster();
    const L = this.profile.loadout;
    const renderSlot = (elId, itemId, slotKey, emptyText) => {
      const el = document.getElementById(elId);
      if (itemId && GAME_DATA.ITEMS[itemId]) {
        const def = GAME_DATA.ITEMS[itemId];
        el.classList.remove('empty');
        el.innerHTML = `<span>${def.name}</span><button class="btn-small" data-unequip="${slotKey}">UNEQUIP</button>`;
        el.querySelector('button').addEventListener('click', () => {
          this.addToStash(itemId, 1);
          L[slotKey] = null;
          this.saveProfile();
          this.renderHideout();
        });
      } else {
        el.classList.add('empty');
        el.textContent = emptyText;
      }
    };

    renderSlot('slot-primary', L.primary, 'primary', 'None Equipped');
    renderSlot('slot-secondary', L.secondary, 'secondary', 'None Equipped');
    renderSlot('slot-armor', L.armor, 'armor', 'No Armor');

    const lethalEl = document.getElementById('slot-lethal');
    if (lethalEl) {
      const lDef = L.lethal && GAME_DATA.ITEMS[L.lethal];
      if (lDef) {
        lethalEl.classList.remove('empty');
        lethalEl.innerHTML = `<span>${L.lethalQty || 0}x ${lDef.name}</span><button class="btn-small" id="btn-swap-lethal">SWAP</button>`;
        lethalEl.querySelector('#btn-swap-lethal').addEventListener('click', () => {
          L.lethal = L.lethal === 'frag_grenade' ? 'throwing_knife' : 'frag_grenade';
          L.lethalQty = Math.max(2, L.lethalQty || 2);
          this.saveProfile();
          this.renderHideout();
        });
      } else {
        lethalEl.classList.add('empty');
        lethalEl.textContent = 'None Equipped';
      }
    }

    const tacEl = document.getElementById('slot-tactical');
    if (tacEl) {
      const tDef = L.tactical && GAME_DATA.ITEMS[L.tactical];
      if (tDef) {
        tacEl.classList.remove('empty');
        tacEl.innerHTML = `<span>${L.tacticalQty || 0}x ${tDef.name}</span><button class="btn-small" id="btn-swap-tactical">SWAP</button>`;
        tacEl.querySelector('#btn-swap-tactical').addEventListener('click', () => {
          L.tactical = L.tactical === 'smoke_grenade' ? 'concussion_grenade' : 'smoke_grenade';
          L.tacticalQty = Math.max(2, L.tacticalQty || 2);
          this.saveProfile();
          this.renderHideout();
        });
      } else {
        tacEl.classList.add('empty');
        tacEl.textContent = 'None Equipped';
      }
    }

    const ammoList = document.getElementById('loadout-ammo-list');
    ammoList.innerHTML = '';
    const entries = Object.entries(L.ammo || {}).filter(([, q]) => q > 0);
    if (entries.length === 0) {
      ammoList.innerHTML = '<span class="ammo-chip">No ammo in rig</span>';
    } else {
      for (const [id, qty] of entries) {
        const def = GAME_DATA.ITEMS[id];
        const chip = document.createElement('span');
        chip.className = 'ammo-chip';
        chip.textContent = `${def.name}: ${qty}`;
        ammoList.appendChild(chip);
      }
    }
  }

  renderStash() {
    this._normalizeStash();
    const list = document.getElementById('stash-list');
    list.innerHTML = '';
    if (this.profile.weaponStash.length === 0 && this.profile.stash.length === 0) {
      list.innerHTML = '<p class="hint" style="padding:12px;">Stash is empty. Deploy to loot or buy gear from Rusty.</p>';
      return;
    }

    // 1. Weapons in dedicated 15-slot Weapon Stash
    this.profile.weaponStash.forEach((item, wIdx) => {
      const def = GAME_DATA.ITEMS[item.id];
      if (!def) return;
      const row = document.createElement('div');
      row.className = `item-row rarity-${def.rarity}`;
      const totalVal = def.value * (item.qty || 1);
      row.innerHTML = `
        <div class="item-info">
          <div class="item-name">${def.name}</div>
          <div class="item-meta">₽ ${totalVal.toLocaleString()} · WEAPON STASH (${wIdx + 1}/15)</div>
        </div>
        <div class="item-actions"></div>
      `;
      const actions = row.querySelector('.item-actions');
      const btnStage = document.createElement('button');
      btnStage.className = 'btn-small';
      btnStage.textContent = 'EQUIP';
      btnStage.addEventListener('click', () => this._openDeployStashWeaponStaging(wIdx));
      actions.appendChild(btnStage);

      const btnSell = document.createElement('button');
      btnSell.className = 'btn-small';
      btnSell.textContent = 'SELL';
      btnSell.addEventListener('click', () => {
        this.profile.credits += totalVal;
        this.profile.weaponStash.splice(wIdx, 1);
        this.saveProfile();
        this.renderHideout();
      });
      actions.appendChild(btnSell);
      list.appendChild(row);
    });

    // 2. Regular Stash Items
    this.profile.stash.forEach((item, idx) => {
      const def = GAME_DATA.ITEMS[item.id];
      if (!def) return;

      const row = document.createElement('div');
      row.className = `item-row rarity-${def.rarity}`;
      const qtyLabel = item.qty > 1 ? ` x${item.qty}` : '';
      const totalVal = def.value * item.qty;

      row.innerHTML = `
        <div class="item-info">
          <div class="item-name">${def.name}${qtyLabel}</div>
          <div class="item-meta">₽ ${totalVal.toLocaleString()} · ${def.type.toUpperCase()}</div>
        </div>
        <div class="item-actions"></div>
      `;

      const actions = row.querySelector('.item-actions');

      if (def.type === 'armor') {
        const btnEq = document.createElement('button');
        btnEq.className = 'btn-small';
        btnEq.textContent = 'EQUIP';
        btnEq.addEventListener('click', () => {
          const prev = this.profile.loadout.armor;
          if (prev) this.addToStash(prev, 1);
          this.profile.loadout.armor = item.id;
          this.profile.stash.splice(idx, 1);
          this.saveProfile();
          this.renderHideout();
        });
        actions.appendChild(btnEq);
      } else if (def.type === 'backpack') {
        const btnEq = document.createElement('button');
        btnEq.className = 'btn-small';
        btnEq.textContent = 'EQUIP';
        btnEq.addEventListener('click', () => {
          this._equipOrPackFromStash(idx, 16);
        });
        actions.appendChild(btnEq);
      } else if (def.type === 'med') {
        const btnEq = document.createElement('button');
        btnEq.className = 'btn-small';
        btnEq.textContent = '+PACK';
        btnEq.addEventListener('click', () => {
          const L = this.profile.loadout;
          if (!Array.isArray(L.backpackItems)) L.backpackItems = [];
          const bagDef = GAME_DATA.ITEMS[L.backpack || 'bag_small'];
          const maxBagSlots = (bagDef && (bagDef.slots || bagDef.bagSlots)) ? (bagDef.slots || bagDef.bagSlots) : 8;
          const existing = def.stackable ? L.backpackItems.find(it => it && it.id === item.id) : null;
          if (existing) {
            existing.qty += 1;
          } else if (L.backpackItems.length < maxBagSlots) {
            L.backpackItems.push({ id: item.id, qty: 1 });
          } else {
            return;
          }
          item.qty -= 1;
          if (item.qty <= 0) this.profile.stash.splice(idx, 1);
          this.saveProfile();
          this.renderHideout();
        });
        actions.appendChild(btnEq);
      } else if (def.type === 'plate') {
        const btnEq = document.createElement('button');
        btnEq.className = 'btn-small';
        btnEq.textContent = '+RIG';
        btnEq.addEventListener('click', () => {
          const cur = this.profile.loadout.plates || 0;
          if (cur >= 6) return;
          this.profile.loadout.plates = cur + 1;
          item.qty -= 1;
          if (item.qty <= 0) this.profile.stash.splice(idx, 1);
          this.saveProfile();
          this.renderHideout();
        });
        actions.appendChild(btnEq);
      } else if (def.type === 'lethal' || def.type === 'tactical') {
        const btnEq = document.createElement('button');
        btnEq.className = 'btn-small';
        btnEq.textContent = 'EQUIP';
        btnEq.addEventListener('click', () => {
          const L = this.profile.loadout;
          const idKey = def.type === 'lethal' ? 'lethal' : 'tactical';
          const qtyKey = def.type === 'lethal' ? 'lethalQty' : 'tacticalQty';
          if (L[idKey] && L[idKey] !== item.id && (L[qtyKey] || 0) > 0) {
            this.addToStash(L[idKey], L[qtyKey]);
            L[qtyKey] = 0;
          }
          L[idKey] = item.id;
          L[qtyKey] = Math.min(4, (L[qtyKey] || 0) + 1);
          item.qty -= 1;
          if (item.qty <= 0) this.profile.stash.splice(idx, 1);
          this.saveProfile();
          this.renderHideout();
        });
        actions.appendChild(btnEq);
      } else if (def.type === 'ammo') {
        const btnEq = document.createElement('button');
        btnEq.className = 'btn-small';
        btnEq.textContent = 'LOAD RIG';
        btnEq.addEventListener('click', () => {
          this.profile.loadout.ammo[item.id] = (this.profile.loadout.ammo[item.id] || 0) + item.qty;
          this.profile.stash.splice(idx, 1);
          this.saveProfile();
          this.renderHideout();
        });
        actions.appendChild(btnEq);
      }

      const btnSell = document.createElement('button');
      btnSell.className = 'btn-small';
      btnSell.textContent = 'SELL';
      btnSell.addEventListener('click', () => {
        this.profile.credits += totalVal;
        this.profile.stash.splice(idx, 1);
        this.saveProfile();
        this.renderHideout();
      });
      actions.appendChild(btnSell);

      list.appendChild(row);
    });
  }

  renderTrader() {
    const list = document.getElementById('trader-list');
    list.innerHTML = '';
    const ids = GAME_DATA.TRADER_STOCK[this.traderCategory] || [];

    for (const id of ids) {
      const def = GAME_DATA.ITEMS[id];
      const qty = def.buyQty || 1;
      const price = Math.round(def.value * qty * 1.15);

      const row = document.createElement('div');
      row.className = `item-row rarity-${def.rarity}`;
      row.innerHTML = `
        <div class="item-info">
          <div class="item-name">${def.name}${qty > 1 ? ' x' + qty : ''}</div>
          <div class="item-meta">${def.desc}</div>
        </div>
        <div class="item-actions">
          <button class="btn-small" ${this.profile.credits < price ? 'disabled' : ''}>BUY ₽${price.toLocaleString()}</button>
        </div>
      `;

      row.querySelector('button').addEventListener('click', () => {
        if (this.profile.credits < price) {
          if (window.soundEngine && window.soundEngine.playUiError) {
            try { window.soundEngine.playUiError(); } catch (e) {}
          }
          return;
        }
        this.profile.credits -= price;
        if (def.type === 'ammo') {
          this.profile.loadout.ammo[id] = (this.profile.loadout.ammo[id] || 0) + qty;
        } else {
          this.addToStash(id, qty);
        }
        if (window.soundEngine && window.soundEngine.playPurchase) {
          try { window.soundEngine.playPurchase(); } catch (e) {}
        }
        this.saveProfile();
        this.renderHideout();
      });

      list.appendChild(row);
    }

    // DEV TRADER — only visible when window.DEV_MODE is ON, sells EVERY item in the game for FREE!
    const devPanel = document.getElementById('dev-trader-panel');
    const devList = document.getElementById('dev-trader-list');
    if (devPanel) {
      devPanel.classList.toggle('hidden', !window.DEV_MODE);
    }
    if (devPanel && devList && window.DEV_MODE) {
      devList.innerHTML = '';
      const cat = this.devTraderCategory || 'all';
      const allDefs = Object.values(GAME_DATA.ITEMS || {});
      const filtered = allDefs.filter((def) => {
        if (!def || !def.id) return false;
        if (cat === 'all') return true;
        if (cat === 'weapons') return def.type === 'weapon' || def.type === 'melee';
        if (cat === 'gear') return ['armor', 'backpack', 'headgear', 'field_upgrade', 'killstreak', 'self_revive'].includes(def.type);
        if (cat === 'consumables') return ['med', 'ammo', 'plate', 'lethal', 'tactical'].includes(def.type);
        return !['weapon', 'melee', 'armor', 'backpack', 'headgear', 'field_upgrade', 'killstreak', 'self_revive', 'med', 'ammo', 'plate', 'lethal', 'tactical'].includes(def.type);
      });

      for (const def of filtered) {
        const qty = def.buyQty || (def.type === 'ammo' ? 30 : 1);
        const row = document.createElement('div');
        row.className = `item-row rarity-${def.rarity || 'common'}`;
        row.innerHTML = `
          <div class="item-info">
            <div class="item-name">${def.name}${qty > 1 ? ' x' + qty : ''}</div>
            <div class="item-meta">${(def.type || 'ITEM').toUpperCase()} · ${def.desc || ''}</div>
          </div>
          <div class="item-actions">
            <button class="btn-small" style="border-color:#69f0ae;color:#69f0ae;">FREE (₽0)</button>
          </div>
        `;
        row.querySelector('button').addEventListener('click', () => {
          if (def.type === 'ammo') {
            this.profile.loadout.ammo[def.id] = (this.profile.loadout.ammo[def.id] || 0) + qty;
          } else {
            this.addToStash(def.id, qty);
          }
          if (window.soundEngine && window.soundEngine.playInvDrop) {
            try { window.soundEngine.playInvDrop(); } catch (e) {}
          }
          this.saveProfile();
          this.renderHideout();
        });
        devList.appendChild(row);
      }
    }
  }

  // ==================== IN-RAID HUD ====================
  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(name + '-screen').classList.add('active');
  }

  addFeedMessage(text, color = '#f5a623') {
    const feed = document.getElementById('hud-feed');
    if (!feed) return;
    const div = document.createElement('div');
    div.className = 'feed-item';
    div.style.borderLeftColor = color;
    div.textContent = text;
    feed.prepend(div);
    setTimeout(() => div.remove(), 4200);
  }

  showCenterToast(text, color = '#ffca28') {
    const el = document.getElementById('hud-center-toast');
    if (!el) return;
    el.textContent = text;
    el.style.borderColor = color;
    el.style.color = color;
    el.classList.remove('hidden', 'pop');

    // Align toast Y centerpoint with the exact midpoint of the bottom health & ammo HUD widgets
    const leftHud = document.querySelector('.hud-bottom-left');
    const rightHud = document.querySelector('.hud-bottom-right-cluster');
    if (leftHud && rightHud) {
      const lRect = leftHud.getBoundingClientRect();
      const rRect = rightHud.getBoundingClientRect();
      if (lRect.height > 0 && rRect.height > 0) {
        const midY = ((lRect.top + lRect.height / 2) + (rRect.top + rRect.height / 2)) / 2;
        const toastH = el.offsetHeight || 30;
        el.style.bottom = 'auto';
        el.style.top = `${Math.round(midY - toastH / 2)}px`;
      }
    }

    void el.offsetWidth;
    el.classList.add('pop');
    clearTimeout(this._centerToastTimer);
    this._centerToastTimer = setTimeout(() => {
      el.classList.add('hidden');
      el.classList.remove('pop');
    }, 1900);
  }

  _getWeaponSilhouetteSVG(weaponId = '', weaponName = '') {
    const key = (weaponId || weaponName || '').toLowerCase();
    if (key.includes('pm9') || key.includes('g17') || key.includes('pistol')) {
      return '<svg viewBox="0 0 36 18" fill="currentColor" aria-hidden="true"><path d="M5 4h24v3.5h-2v1.5h-12l-1.5 2.5h2.2l-.7 1.5h-4.5l-2 4.5H4.2l2.3-7.5H5V4zm21-1h2.5v1H26V3z"/></svg>';
    }
    if (key.includes('mp5')) {
      return '<svg viewBox="0 0 46 18" fill="currentColor" aria-hidden="true"><path d="M4 5.5h28v1.5h6v2h-6v1.5h-3.5v4.5h-2.5v-4.5h-3.2l1.6 5.5-2.6.8-1.9-6.3h-4.2l-1.8 5h-3l1.6-5H6.5v1.5H4v-6.5zm22-2h3v2h-3v-2z"/></svg>';
    }
    if (key.includes('m870') || key.includes('shotgun')) {
      return '<svg viewBox="0 0 54 18" fill="currentColor" aria-hidden="true"><path d="M2 7.5l8.5-2h40.5v2h-11v1.2h5.5v1.8h-17v-.8h-6.5l-1.8 1.3h-3.5l-3.5 3.5H2.5l1.5-4.5H2v-2.5z"/></svg>';
    }
    if (key.includes('m24') || key.includes('awm') || key.includes('mosin') || key.includes('sniper')) {
      return '<svg viewBox="0 0 58 18" fill="currentColor" aria-hidden="true"><path d="M18 2h15v2.5h-3v1.5h26v1.8H35v1.4h-8.5l-2 1.8h-5.5l-3.5 3.5H2v-4l10-2.5h9V4.5h-3V2z"/></svg>';
    }
    if (key.includes('frag') || key.includes('grenade')) {
      return '<svg viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><path d="M7 2h4v2h1.8l1.2 2.2-1.2.7-.8-1.5H11v.8c2 .7 3.3 2.5 3.3 4.6 0 2.8-2.3 5-5.3 5s-5.3-2.2-5.3-5c0-2.1 1.4-3.9 3.3-4.6V4H6V2h1zm-2.3 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>';
    }
    if (key.includes('knife') || key.includes('melee')) {
      return '<svg viewBox="0 0 36 16" fill="currentColor" aria-hidden="true"><path d="M3 7h9v-1.8h2V7h19l-5.5 3.2H14v1.6h-2v-1.6H3V7z"/></svg>';
    }
    return '<svg viewBox="0 0 52 18" fill="currentColor" aria-hidden="true"><path d="M2 6.5l9-1.5h22v-1.2h4v1.2h9v-1.8h2v2.2h2v1.8h-12v1.3h-6.5l2.2 6.2-2.8.8-2.4-7h-5.8l-1.8 5h-2.8l1.5-5h-5.2L2.5 12H2V6.5z"/></svg>';
  }

  addKillFeedEntry({
    killerName = 'YOU',
    killerIsEnemy = false,
    weaponId = '',
    weaponName = '',
    victimName = '',
    victimIsEnemy = true,
    action = 'eliminated',
    isHead = false
  } = {}) {
    const kf = document.getElementById('hud-kill-feed');
    if (!kf || !victimName) return;

    const isDowned = action === 'downed';
    const row = document.createElement('div');
    row.className = 'kill-feed-item' + (isDowned ? ' downed' : '') + (!victimIsEnemy ? ' ally-victim' : '');

    // Killer name (blue for ally/player, red for enemy)
    const killerSpan = document.createElement('span');
    killerSpan.className = `kf-player ${killerIsEnemy ? 'enemy' : 'ally'}`;
    killerSpan.textContent = killerName;
    row.appendChild(killerSpan);

    // Weapon silhouette SVG
    const wpnSpan = document.createElement('span');
    wpnSpan.className = 'kf-weapon-icon';
    wpnSpan.title = weaponName || weaponId || '';
    wpnSpan.innerHTML = this._getWeaponSilhouetteSVG(weaponId, weaponName);
    row.appendChild(wpnSpan);

    // Optional headshot crosshair glyph
    if (isHead) {
      const hsSpan = document.createElement('span');
      hsSpan.className = 'kf-glyph headshot';
      hsSpan.title = 'Headshot';
      hsSpan.innerHTML = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="8" r="4.5"/><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3"/></svg>';
      row.appendChild(hsSpan);
    }

    // Downed glyph (medical cross inside circle) OR Elimination skull glyph
    const glyphSpan = document.createElement('span');
    glyphSpan.className = `kf-glyph ${isDowned ? 'downed' : 'eliminated'}`;
    glyphSpan.title = isDowned ? 'Operator Downed' : 'Operator Eliminated';
    if (isDowned) {
      glyphSpan.innerHTML = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.8v6.4M4.8 8h6.4" stroke-linecap="round"/></svg>';
    } else {
      glyphSpan.innerHTML = '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 1C4.7 1 2 3.4 2 6.5c0 1.9 1 3.5 2.5 4.5V13c0 .6.4 1 1 1h5c.6 0 1-.4 1-1v-2c1.5-1 2.5-2.6 2.5-4.5C14 3.4 11.3 1 8 1zM5.6 8.2a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4.8 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zM6.5 12v-1.2h1V12h-1zm2 0v-1.2h1V12h-1z"/></svg>';
    }
    row.appendChild(glyphSpan);

    // Victim name (red for enemy, blue for ally/player)
    const victimSpan = document.createElement('span');
    victimSpan.className = `kf-player ${victimIsEnemy ? 'enemy' : 'ally'}`;
    victimSpan.textContent = victimName;
    row.appendChild(victimSpan);

    kf.prepend(row);
    while (kf.children.length > 4) kf.lastElementChild.remove();
    setTimeout(() => row.remove(), 5500);
  }

  addPingFeedEntry({ caller = 'YOU', label = 'LOCATION', color = '#f5a623', symbol = '◈', dist = null } = {}) {
    const kf = document.getElementById('hud-kill-feed');
    if (!kf) return;

    const row = document.createElement('div');
    row.className = 'kill-feed-item';
    row.style.borderLeftColor = color;

    const callerSpan = document.createElement('span');
    callerSpan.className = 'kf-player ally';
    callerSpan.textContent = caller;

    const symSpan = document.createElement('span');
    symSpan.style.color = color;
    symSpan.textContent = symbol;

    const msgSpan = document.createElement('span');
    msgSpan.style.color = '#e6ece8';
    msgSpan.textContent = dist !== null ? `${label} (${dist}m)` : label;

    row.append(callerSpan, symSpan, msgSpan);
    kf.prepend(row);
    while (kf.children.length > 4) kf.lastElementChild.remove();
    setTimeout(() => row.remove(), 5200);
  }

  showXpFeedback({ label = 'KILL', xp = 100, isDowned = false, isRevive = false, isArmorBreak = false } = {}) {
    const totalEl = document.getElementById('hud-xp-total');
    const eventsEl = document.getElementById('hud-xp-events');
    if (!totalEl || !eventsEl) return;

    this._activeXpTotal = (this._activeXpTotal || 0) + xp;
    totalEl.textContent = `+${this._activeXpTotal} XP`;
    totalEl.classList.toggle('downed', isDowned);
    totalEl.classList.toggle('revive', isRevive);
    totalEl.classList.remove('bump');
    void totalEl.offsetWidth;
    totalEl.classList.add('visible', 'bump');

    const row = document.createElement('div');
    row.className = 'xp-event-row' + (isDowned ? ' downed' : '') + (isRevive ? ' revive' : '') + (isArmorBreak ? ' armor-break' : '');
    if (isArmorBreak) {
      // Special cracked/broken armor plate vest icon in the XP feed!
      row.innerHTML = `<svg class="xp-armor-break-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4L8 2h3l-1.5 6 3 2-2.5 5 1.5 7H5V4z" fill="#4fc3f7"/><path d="M19 4L16 2h-3l1.2 5.2 2.8 2.2-2.2 4.8L16.5 22H19V4z" fill="#4fc3f7" opacity="0.88"/><path d="M12.2 2.5L9.8 8.2l3.4 2.4-2.8 5.2 1.8 6" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/></svg><span>${label}</span>`;
    } else {
      row.textContent = label;
    }
    eventsEl.prepend(row);
    while (eventsEl.children.length > 4) eventsEl.lastElementChild.remove();

    clearTimeout(this._xpFadeTimer);
    this._xpFadeTimer = setTimeout(() => {
      totalEl.classList.remove('visible');
      eventsEl.innerHTML = '';
      this._activeXpTotal = 0;
    }, 2800);
  }

  updateReviveBanner(player, revivingAlly = null, isDragging = false) {
    const banner = document.getElementById('revive-banner');
    if (!banner) return;
    const titleEl = document.getElementById('revive-title');
    const timerEl = document.getElementById('revive-timer');
    const fillEl = document.getElementById('revive-bar-fill');
    const subEl = document.getElementById('revive-sub');

    const isGp = window._lastInputMode === 'gamepad';
    const revBind = (window.GAMEPAD_BINDS && window.GAMEPAD_BINDS.revive != null) ? window.GAMEPAD_BINDS.revive : 2;
    const revKeyLabel = isGp
      ? `[${this._formatGamepadButton(revBind)}]`
      : `[${this._formatKeyCode((window.KEYBINDS && window.KEYBINDS.interact) || 'KeyE')}]`;
    const moveLabel = isGp ? 'Left Stick' : 'WASD';

    if (revivingAlly) {
      banner.classList.remove('hidden');
      banner.classList.add('reviving');
      const pct = Math.round((revivingAlly.reviveProgress || 0) * 100);
      const isSlow = !!revivingAlly.dead;
      titleEl.textContent = isDragging
        ? `DRAGGING & REVIVING ${revivingAlly.name}`
        : (isSlow ? `REVIVING FALLEN ${revivingAlly.name} (SLOW)` : `REVIVING ${revivingAlly.name}`);
      timerEl.textContent = `${pct}%`;
      fillEl.style.width = `${pct}%`;
      subEl.textContent = isSlow
        ? `Hold ${revKeyLabel} — Reviving eliminated teammate takes longer`
        : `Hold ${revKeyLabel} — Move with ${moveLabel} to drag teammate into cover`;
      return;
    }

    if (player && player.isDowned) {
      banner.classList.remove('hidden');
      const beingRevived = !!player.beingRevivedBy;
      banner.classList.toggle('reviving', beingRevived);
      if (beingRevived) {
        const pct = Math.round((player.reviveProgress || 0) * 100);
        if (player.beingRevivedBy === 'TOURNIQUET') {
          titleEl.textContent = 'APPLYING TOURNIQUET (-25 MAX HP)';
          subEl.textContent = `Hold ${revKeyLabel} — Sacrifices 25 Max HP (use Medkit to restore permanently)`;
        } else {
          titleEl.textContent = player.beingDragged
            ? `DRAGGED TO COVER BY ${player.beingRevivedBy}`
            : `BEING REVIVED BY ${player.beingRevivedBy}`;
          subEl.textContent = 'Bleedout paused while being revived';
        }
        timerEl.textContent = `${pct}%`;
        fillEl.style.width = `${pct}%`;
      } else {
        const pct = Math.max(0, Math.min(100, (player.downedBleedTimer / player.downedBleedMax) * 100));
        titleEl.textContent = 'DOWNED — CRAWL TO COVER';
        timerEl.textContent = `${Math.max(0, player.downedBleedTimer).toFixed(1)}s`;
        fillEl.style.width = `${pct}%`;
        const canTourniquet = (player.disabledHp || 0) <= 0;
        subEl.textContent = player.selfRevive
          ? `Hold ${revKeyLabel} to Self-Revive · ${moveLabel} to crawl to cover`
          : (canTourniquet
            ? `Hold ${revKeyLabel} Apply Tourniquet (-25 Max HP) · ${moveLabel} to crawl to cover`
            : `Wounded from Tourniquet · Ally must revive (${moveLabel} to crawl to cover)`);
      }
      return;
    }

    if (player && player.dead) {
      banner.classList.remove('hidden');
      const beingRevived = !!player.beingRevivedBy;
      banner.classList.toggle('reviving', beingRevived);
      if (beingRevived) {
        const pct = Math.round((player.reviveProgress || 0) * 100);
        titleEl.textContent = `${player.beingRevivedBy} REVIVING YOU (SLOW)`;
        timerEl.textContent = `${pct}%`;
        fillEl.style.width = `${pct}%`;
        subEl.textContent = 'Full revival in progress...';
      } else {
        titleEl.textContent = 'ELIMINATED — AWAITING ALLY REVIVE';
        timerEl.textContent = 'DEAD';
        fillEl.style.width = '0%';
        subEl.textContent = 'Allies can still revive you at slower speed · Press ESC to Abandon';
      }
      return;
    }

    banner.classList.add('hidden');
  }

  triggerHitmarker(headshot = false, hitArmor = false) {
    const hm = document.getElementById('hitmarker');
    if (!hm) return;
    hm.classList.toggle('headshot', !!headshot);
    hm.classList.toggle('armor', !headshot && !!hitArmor);
    hm.classList.remove('pop');
    void hm.offsetWidth;
    hm.classList.add('pop');
    hm.style.opacity = '1';
    clearTimeout(this._hmTimer);
    this._hmTimer = setTimeout(() => {
      hm.style.opacity = '0';
      hm.classList.remove('pop');
    }, 150);
  }

  triggerDamageFlash() {
    const dv = document.getElementById('damage-vignette');
    dv.style.opacity = '1';
    clearTimeout(this._dvTimer);
    this._dvTimer = setTimeout(() => { dv.style.opacity = '0'; }, 240);
  }

  triggerDirectionalDamage(player, attackerPos) {
    if (!attackerPos) return;
    const container = document.getElementById('damage-indicator-container');
    if (!container) return;

    const dx = attackerPos.x - player.position.x;
    const dz = attackerPos.z - player.position.z;
    // Angle to attacker in world space (0 = -Z / North, +90 = +X / East)
    const worldAngle = Math.atan2(dx, -dz);
    // Player heading (-player.yaw because yaw > 0 turns left in Three.js)
    const relAngleRad = worldAngle + player.yaw;
    const deg = (relAngleRad * 180) / Math.PI;

    const arc = document.createElement('div');
    arc.className = 'damage-arc';
    arc.style.transform = `rotate(${deg}deg)`;
    arc.style.opacity = '1';
    container.appendChild(arc);

    setTimeout(() => { arc.style.opacity = '0'; }, 600);
    setTimeout(() => { arc.remove(); }, 850);
  }

  updateHUD(player, world, raidTimeLeft, weaponSystem, throwableSystem = null, enemyManager = null, squadManager = null, raidXp = 0) {
    // Cached DOM refs + dirty-value tracking to eliminate 60Hz layout/paint thrashing
    if (!this._hudCache) {
      this._hudCache = {
        timer: document.getElementById('hud-timer'),
        devBadge: document.getElementById('hud-dev-badge'),
        hpBar: document.getElementById('hud-hp-bar'),
        hpTempBar: document.getElementById('hud-hp-temp-bar'),
        hpDisabledBar: document.getElementById('hud-hp-disabled-bar'),
        hpVal: document.getElementById('hud-hp-val'),
        segContainer: document.getElementById('hud-plate-segments'),
        armorVal: document.getElementById('hud-armor-val'),
        stamBar: document.getElementById('hud-stam-bar'),
        stamVal: document.getElementById('hud-stam-val'),
        medkits: document.getElementById('hud-medkits'),
        plates: document.getElementById('hud-plates'),
        lethal: document.getElementById('hud-lethal'),
        tactical: document.getElementById('hud-tactical'),
        fuRing: document.getElementById('hud-fu-ring'),
        ksWrap: document.getElementById('hud-ks-wrap'),
        ksKey: document.getElementById('hud-ks-key'),
        ksStatus: document.getElementById('hud-ks-status')
      };
      this._hudPrev = {};
    }
    const hc = this._hudCache;
    const hpv = this._hudPrev;

    // Timer (dirty-checked per second)
    const mins = Math.floor(raidTimeLeft / 60);
    const secs = Math.floor(raidTimeLeft % 60);
    const timerStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (hc.timer && hpv.timer !== timerStr) {
      hpv.timer = timerStr;
      hc.timer.textContent = timerStr;
    }
    const devFlag = !!window.DEV_MODE;
    if (hc.devBadge && hpv.dev !== devFlag) {
      hpv.dev = devFlag;
      hc.devBadge.classList.toggle('hidden', !devFlag);
    }

    // Vitals (dirty-checked: Active HP + Yellow Temporary Restored HP + Red Disabled HP from Tourniquet!)
    const maxHp = Math.max(1, player.maxHp || 100);
    const disabledHp = Math.max(0, player.disabledHp || 0);
    const tempHp = Math.max(0, Math.min(disabledHp, player.tempHealthRestored || 0));
    const permDisabledHp = Math.max(0, disabledHp - tempHp);
    const permMaxHp = Math.max(0, maxHp - disabledHp);
    const normalHp = Math.min(player.hp, permMaxHp);
    const activeTempHp = Math.max(0, Math.min(player.hp - permMaxHp, tempHp));

    const hpStateKey = `${normalHp.toFixed(1)}|${activeTempHp.toFixed(1)}|${tempHp.toFixed(1)}|${permDisabledHp.toFixed(1)}`;
    if (hpv.hpStateKey !== hpStateKey) {
      hpv.hpStateKey = hpStateKey;
      if (hc.hpBar) hc.hpBar.style.width = `${((normalHp / maxHp) * 100).toFixed(1)}%`;
      if (hc.hpTempBar) {
        hc.hpTempBar.style.left = `${((permMaxHp / maxHp) * 100).toFixed(1)}%`;
        hc.hpTempBar.style.width = `${((activeTempHp / maxHp) * 100).toFixed(1)}%`;
      }
      if (hc.hpDisabledBar) {
        hc.hpDisabledBar.style.width = `${((permDisabledHp / maxHp) * 100).toFixed(1)}%`;
      }
    }
    const hpCeil = Math.ceil(player.hp);
    if (hc.hpVal && hpv.hpCeil !== hpCeil) {
      hpv.hpCeil = hpCeil;
      hc.hpVal.textContent = hpCeil;
    }

    const armorCeil = Math.ceil(player.armor);
    const plateKey = `${player.plateSlots}|${armorCeil}`;
    if (hc.segContainer && hpv.plateKey !== plateKey) {
      hpv.plateKey = plateKey;
      if (player.plateSlots === 0) {
        hc.segContainer.innerHTML = '<span style="font-size:10px;color:#8f968e;">NO VEST</span>';
      } else {
        const perPlate = (GAME_DATA.OPERATOR_STATS && GAME_DATA.OPERATOR_STATS.plateArmor) || 35;
        let html = '';
        for (let i = 0; i < player.plateSlots; i++) {
          const plateVal = THREE.MathUtils.clamp(player.armor - i * perPlate, 0, perPlate);
          const pct = (plateVal / perPlate) * 100;
          html += `<div class="plate-seg"><div class="plate-seg-fill" style="width:${pct}%"></div></div>`;
        }
        hc.segContainer.innerHTML = html;
      }
    }
    if (hc.armorVal && hpv.armorCeil !== armorCeil) {
      hpv.armorCeil = armorCeil;
      hc.armorVal.textContent = armorCeil;
    }

    const stamCeil = Math.ceil(player.stamina);
    const stamBg = player.isTacSprinting ? '#f5a623' : '';
    if (hc.stamBar && (hpv.stamCeil !== stamCeil || hpv.stamBg !== stamBg)) {
      hpv.stamCeil = stamCeil;
      hpv.stamBg = stamBg;
      hc.stamBar.style.width = `${stamCeil}%`;
      hc.stamBar.style.background = stamBg;
      if (hc.stamVal) hc.stamVal.textContent = stamCeil;
    }

    // Dynamic Operator Stance Silhouette SVG
    const stanceKey = player.isSliding
      ? 'slide'
      : (player.isProne ? 'prone' : (player.isCrouching ? 'crouch' : (player.isTacSprinting ? 'tac_sprint' : (player.isSprinting ? 'sprint' : 'stand'))));
    if (this._lastStanceKey !== stanceKey) {
      this._lastStanceKey = stanceKey;
      const iconEl = document.getElementById('hud-stance-icon');
      if (iconEl) {
        iconEl.classList.toggle('tac', stanceKey === 'tac_sprint');
        iconEl.innerHTML = this._getStanceSVG(stanceKey);
      }
    }

    const medStr = devFlag ? '∞' : String(player.getMedkitCount());
    if (hc.medkits && hpv.medStr !== medStr) { hpv.medStr = medStr; hc.medkits.textContent = medStr; }
    const platesStr = devFlag ? '∞' : String(player.plates);
    if (hc.plates && hpv.platesStr !== platesStr) { hpv.platesStr = platesStr; hc.plates.textContent = platesStr; }
    const lethStr = devFlag ? '∞' : String(player.lethalQty);
    if (hc.lethal && hpv.lethStr !== lethStr) { hpv.lethStr = lethStr; hc.lethal.textContent = lethStr; }
    const tacStr = devFlag ? '∞' : String(player.tacticalQty);
    if (hc.tactical && hpv.tacStr !== tacStr) { hpv.tacStr = tacStr; hc.tactical.textContent = tacStr; }

    const ordKey = `${player.tactical}|${player.lethal}|${player.melee}|${player.fieldUpgrade}`;
    if (this._lastOrdKey !== ordKey) {
      this._lastOrdKey = ordKey;
      const tacSvg = document.getElementById('hud-tac-svg');
      const lethSvg = document.getElementById('hud-leth-svg');
      const meleeSvg = document.getElementById('hud-melee-svg');
      const meleeName = document.getElementById('hud-melee-name');
      const fuIcon = document.getElementById('hud-fu-icon');
      if (tacSvg) tacSvg.innerHTML = this._getOrdnanceSVG(player.tactical || 'smoke_grenade');
      if (lethSvg) lethSvg.innerHTML = this._getOrdnanceSVG(player.lethal || 'frag_grenade');
      if (meleeSvg) meleeSvg.innerHTML = this._getOrdnanceSVG(player.melee || 'melee_knife');
      if (meleeName) {
        const mDef = GAME_DATA.ITEMS[player.melee || 'melee_knife'];
        meleeName.textContent = mDef ? mDef.name.split(' ')[0].toUpperCase() : 'KNIFE';
      }
      if (fuIcon) fuIcon.innerHTML = this._getFieldUpgradeSVG(player.fieldUpgrade || 'fu_ammo_box');
    }

    // Far-Right Field Upgrade Circular Usage Ring (circumference 2 * pi * 24 = 150.8)
    const fuRing = document.getElementById('hud-fu-ring');
    if (fuRing) {
      const charge = THREE.MathUtils.clamp(player.fieldUpgradeCharge != null ? player.fieldUpgradeCharge : 1.0, 0, 1);
      fuRing.style.strokeDashoffset = (150.8 * (1 - charge)).toFixed(1);
      fuRing.style.stroke = charge >= 0.99 ? '#69f0ae' : '#f5a623';
    }

    // Killstreak HUD Badge (3D Icon, Keybind & Live UAV Countdown)
    const ksWrap = document.getElementById('hud-ks-wrap');
    if (ksWrap) {
      const ksId = player.killstreak || null;
      const uavActive = (player.uavTimer || 0) > 0;
      ksWrap.classList.toggle('empty', !ksId && !uavActive);
      ksWrap.classList.toggle('uav-active', uavActive);
      const ksKeyEl = document.getElementById('hud-ks-key');
      if (ksKeyEl) {
        const kb = window.KEYBINDS || {};
        ksKeyEl.textContent = this._formatKeyCode(kb.killstreak || 'KeyK');
      }
      const ksStatusEl = document.getElementById('hud-ks-status');
      if (ksStatusEl) {
        if (uavActive) {
          ksStatusEl.textContent = `UAV ${Math.ceil(player.uavTimer)}s`;
          ksStatusEl.classList.remove('hidden');
        } else {
          ksStatusEl.classList.add('hidden');
        }
      }
      const ksRenderKey = `${ksId || 'none'}|${uavActive ? 1 : 0}`;
      if (this._lastKsRenderKey !== ksRenderKey) {
        this._lastKsRenderKey = ksRenderKey;
        const ksIconEl = document.getElementById('hud-ks-icon');
        if (ksIconEl) {
          const iconTarget = ksId || (uavActive ? 'ks_uav' : null);
          if (iconTarget && window.itemIcons && window.itemIcons.getIcon) {
            const url = window.itemIcons.getIcon(iconTarget);
            const ksDef = GAME_DATA.ITEMS[iconTarget];
            ksIconEl.innerHTML = url ? `<img src="${url}" alt="${ksDef ? ksDef.name : iconTarget}" />` : (iconTarget === 'ks_airstrike' ? 'AIR' : 'UAV');
            ksWrap.title = ksDef ? `${ksDef.name} [${this._formatKeyCode((window.KEYBINDS || {}).killstreak || 'KeyK')}]` : 'Killstreak';
          } else {
            ksIconEl.textContent = 'KS';
            ksWrap.title = 'No Killstreak Equipped';
          }
        }
      }
    }

    // Bottom-Left Callsign
    const csEl = document.getElementById('hud-op-callsign');
    if (csEl) {
      const nameTxt = (player && player.spectatingAlly && player.dead)
        ? player.spectatingAlly.name
        : ((this.profile && this.profile.social && this.profile.social.callsign) || 'NOMAD');
      if (csEl.textContent !== nameTxt) csEl.textContent = nameTxt;
    }

    // Weapon
    const wSlot = player.getActiveWeaponSlot();
    const wDef = player.getActiveWeaponDef();
    document.getElementById('hud-slot-1').classList.toggle('active', player.activeSlot === 'primary');
    document.getElementById('hud-slot-2').classList.toggle('active', player.activeSlot === 'secondary');

    // Render Primary & Secondary Weapon Silhouettes + Secondary Mag in DMZ Right HUD
    const pSlot = player.slots && player.slots.primary;
    const sSlot = player.slots && player.slots.secondary;
    const silKey = `${pSlot ? pSlot.id : 'none'}|${sSlot ? sSlot.id : 'none'}`;
    if (this._lastHudSilKey !== silKey) {
      this._lastHudSilKey = silKey;
      const priSil = document.getElementById('hud-pri-sil');
      const secSil = document.getElementById('hud-sec-sil');
      if (priSil) priSil.innerHTML = pSlot ? this._getWeaponSilhouetteSVG(pSlot.id, '') : '';
      if (secSil) secSil.innerHTML = sSlot ? this._getWeaponSilhouetteSVG(sSlot.id, '') : '';
    }
    const secMagEl = document.getElementById('hud-sec-mag');
    if (secMagEl) secMagEl.textContent = sSlot ? String(sSlot.mag ?? 0) : '';

    if (player.activeSlot === 'melee') {
      const mDef = player.melee && GAME_DATA.ITEMS[player.melee];
      document.getElementById('hud-weapon-name').textContent = (mDef ? mDef.name : 'BARE FISTS').toUpperCase();
      document.getElementById('hud-mag').textContent = '—';
      document.getElementById('hud-reserve').textContent = mDef ? 'MELEE' : 'UNARMED';
    } else if (wDef && wSlot) {
      const stg = wSlot.reloadStage || 0;
      const stgTag = (!weaponSystem || !weaponSystem.isReloading)
        ? (stg === 1 ? '  [MAG OUT]' : (stg >= 2 ? '  [RACK BOLT]' : ''))
        : '';
      document.getElementById('hud-weapon-name').textContent = wDef.name.toUpperCase() + stgTag;
      document.getElementById('hud-mag').textContent = (stg === 1 && !wSlot.reloadWasEmpty && wSlot.mag > 0) ? '1' : (stg === 1 ? '0' : wSlot.mag);
      document.getElementById('hud-reserve').textContent = player.getReserveAmmo(wDef.ammoType);
    } else {
      document.getElementById('hud-weapon-name').textContent = 'BARE FISTS';
      document.getElementById('hud-mag').textContent = '—';
      document.getElementById('hud-reserve').textContent = 'UNARMED';
    }

    document.getElementById('hud-bag-value').textContent = `₽ ${player.getBackpackValue().toLocaleString()}`;
    const xpEl = document.getElementById('hud-xp-val');
    if (xpEl) xpEl.textContent = `${raidXp || 0} XP`;

    // Dynamic Crosshair (size matches exact live bullet spread cone; 45° canted in Tactical Stance; pulses when cooking a frag grenade!) & ADS vignette
    const chEl = document.getElementById('crosshair');
    const tacCant = !!(player.isADS && weaponSystem && (weaponSystem._tacStanceBlend || 0) > 0.35);
    if (chEl) {
      const cookingFrag = !!(throwableSystem && throwableSystem.state === 'prep' && throwableSystem.activeItemId === 'frag_grenade');
      const cookPulse = throwableSystem ? (throwableSystem.cookPulse || 0) : 0;
      const isThrowingKnife = !!(throwableSystem && throwableSystem.state === 'prep' && throwableSystem.activeItemId === 'throwing_knife');
      chEl.style.opacity = (player.isADS && !tacCant && !cookingFrag && !isThrowingKnife) ? '0' : '1';
      chEl.style.transform = (tacCant && !cookingFrag && !isThrowingKnife)
        ? 'translate(-50%, -50%) rotate(45deg)'
        : 'translate(-50%, -50%)';
      const hasLaser = !!(wDef && wDef.hasLaser);
      chEl.classList.toggle('laser-active', (hasLaser || tacCant) && !cookingFrag);
      chEl.classList.toggle('cook-pulse', cookPulse > 0.15);
      const fovRad = ((weaponSystem.camera ? weaponSystem.camera.fov : 75) * Math.PI) / 180;
      let liveCone = weaponSystem.currentSpread || 0.02;
      if (tacCant && wDef) {
        const stMult = player.isProne ? 0.55 : (player.isCrouching ? 0.75 : 1.0);
        const baseCant = hasLaser
          ? ((wDef.adsSpread || 0.004) * 1.45)
          : THREE.MathUtils.lerp(wDef.adsSpread || 0.004, liveCone, 0.26);
        liveCone = baseCant * stMult;
      }
      const spreadPx = (Math.tan(liveCone) / Math.tan(fovRad / 2)) * (window.innerHeight * 0.5);
      const baseGap = isThrowingKnife ? 6 : THREE.MathUtils.clamp(spreadPx, 4, 92);
      const gapPx = baseGap + cookPulse * 18;
      chEl.style.setProperty('--ch-gap', `${gapPx.toFixed(1)}px`);
    }

    // MW4 DMZ ADS Focus / Hold-Breath Indicator + Breath Meter
    let focusPill = document.getElementById('hud-focus-pill');
    if (!focusPill && chEl && chEl.parentElement) {
      focusPill = document.createElement('div');
      focusPill.id = 'hud-focus-pill';
      focusPill.style.cssText = 'position:absolute;left:50%;top:68%;transform:translate(-50%,0);display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none;opacity:0;transition:opacity 0.14s ease;z-index:18;';
      focusPill.innerHTML =
        '<div id="hud-focus-label" style="font-size:10px;font-weight:700;letter-spacing:1.2px;padding:2px 8px;border-radius:3px;background:rgba(10,14,18,0.68);border:1px solid rgba(255,255,255,0.18);color:#d7e0e8;text-shadow:0 1px 2px rgba(0,0,0,0.85);">[SHIFT] FOCUS</div>' +
        '<div style="width:84px;height:3px;border-radius:2px;background:rgba(255,255,255,0.16);overflow:hidden;">' +
        '<div id="hud-focus-bar" style="width:100%;height:100%;background:#69f0ae;transition:width 0.06s linear;"></div>' +
        '</div>';
      chEl.parentElement.appendChild(focusPill);
    }
    if (focusPill) {
      const showFocus = !!(
        typeof player.focusBreath === 'number' &&
        player.isADS &&
        !tacCant &&
        !player.isDowned &&
        !player.dead &&
        wDef &&
        wDef.type === 'weapon' &&
        (!weaponSystem || !weaponSystem.isReloading)
      );
      focusPill.style.opacity = showFocus ? '1' : '0';
      if (showFocus) {
        const lbl = document.getElementById('hud-focus-label');
        const bar = document.getElementById('hud-focus-bar');
        const breathPct = THREE.MathUtils.clamp(player.focusBreath, 0, 100);
        const isGp = window._lastInputMode === 'gamepad';
        const keyHint = isGp
          ? this._formatGamepadButton((window.GAMEPAD_BINDS && window.GAMEPAD_BINDS.sprint) ?? 10)
          : this._formatKeyCode((window.KEYBINDS && window.KEYBINDS.sprint) || 'ShiftLeft');
        if (lbl) {
          if (player.focusExhausted) {
            lbl.textContent = 'RECOVERING BREATH';
            lbl.style.color = '#ff6b6b';
            lbl.style.borderColor = 'rgba(255,107,107,0.45)';
          } else if (player.isFocusing) {
            lbl.textContent = 'FOCUSING';
            lbl.style.color = '#69f0ae';
            lbl.style.borderColor = 'rgba(105,240,174,0.55)';
          } else {
            lbl.textContent = `[${keyHint}] HOLD FOCUS`;
            lbl.style.color = '#d7e0e8';
            lbl.style.borderColor = 'rgba(255,255,255,0.18)';
          }
        }
        if (bar) {
          bar.style.width = `${breathPct.toFixed(1)}%`;
          bar.style.background = player.focusExhausted ? '#ff6b6b' : (breathPct < 28 ? '#f5a623' : '#69f0ae');
        }
      }
    }

    const adsVig = document.getElementById('ads-vignette');
    if (adsVig) {
      adsVig.style.opacity = (player.isADS && !tacCant) ? '1' : '0';
      if (player.isADS && !tacCant) {
        const z = (wDef && wDef.adsZoom) ? wDef.adsZoom : 1.25;
        if (z >= 6.0) {
          adsVig.style.background = 'radial-gradient(circle, transparent 48%, rgba(0, 0, 0, 0.80) 94%)';
        } else if (z >= 3.0) {
          adsVig.style.background = 'radial-gradient(circle, transparent 50%, rgba(0, 0, 0, 0.68) 96%)';
        } else {
          adsVig.style.background = 'radial-gradient(circle, transparent 55%, rgba(0, 0, 0, 0.55) 100%)';
        }
      }
    }

    // Compass, Top-Left Live Minimap & Full-Size Tactical Map ([M] / Back-Select)
    this._updateCompass(player, world);
    this._renderMinimap(player, world, enemyManager, squadManager);
    if (this.isTacMapOpen) {
      this._renderFullMap(player, world, enemyManager, squadManager);
    }
  }

  toggleTacMap(forceState = null) {
    const ov = document.getElementById('tacmap-overlay');
    if (!ov) return false;
    this.isTacMapOpen = forceState !== null ? !!forceState : !this.isTacMapOpen;
    ov.classList.toggle('hidden', !this.isTacMapOpen);
    if (!this.isTacMapOpen && this.closeTacMapRadial) {
      this.closeTacMapRadial();
    }
    if (this.updateLobbyChatVisibility) {
      this.updateLobbyChatVisibility();
    }
    return this.isTacMapOpen;
  }

  _getOrdnanceSVG(id) {
    if (id === 'throwing_knife') {
      return `<svg viewBox="0 0 24 24"><path d="M19 3l-8 8-3-1-5 5 2 2 5-5-1-3 8-8z"/></svg>`;
    }
    if (id === 'smoke_grenade' || id === 'concussion_grenade') {
      return `<svg viewBox="0 0 24 24"><rect x="8" y="6" width="8" height="14" rx="2"/><rect x="10" y="3" width="4" height="3"/><path d="M14 4h3v4h-2V6h-1z"/></svg>`;
    }
    if (id && id.startsWith('melee_')) {
      return `<svg viewBox="0 0 24 24"><path d="M20 4L9 15l-2-2-4 4 2 2 4-4 2 2L22 6z"/></svg>`;
    }
    // Frag grenade silhouette
    return `<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="6"/><rect x="10" y="5" width="4" height="3"/><path d="M14 5h3v4h-2V7h-1z"/></svg>`;
  }

  _getFieldUpgradeSVG(id) {
    if (id === 'fu_dead_silence') {
      return `<svg viewBox="0 0 24 24"><path d="M12 3c-4 0-7 3-7 7v4l-2 3h18l-2-3v-4c0-4-3-7-7-7zm0 18a2.5 2.5 0 0 0 2.4-2H9.6A2.5 2.5 0 0 0 12 21z"/></svg>`;
    }
    if (id === 'fu_trophy') {
      return `<svg viewBox="0 0 24 24"><path d="M12 2L4 6v6c0 5 3.4 9.6 8 10 4.6-.4 8-5 8-10V6l-8-4zm0 4l4 2v4c0 2.8-1.7 5.4-4 6-2.3-.6-4-3.2-4-6V8l4-2z"/></svg>`;
    }
    // Munitions Box silhouette
    return `<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="11" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2h-2V6h-4v2H8zm3 3h2v2h2v2h-2v2h-2v-2H9v-2h2v-2z"/></svg>`;
  }

  _renderMinimap(player, world, enemyManager, squadManager) {
    this._minimapFrame = ((this._minimapFrame || 0) + 1) % 3;
    if (this._minimapFrame !== 1) return;
    const canvas = document.getElementById('hud-minimap');
    if (!canvas || !world) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cx = W * 0.5;
    const cy = H * 0.5;
    const scale = 0.42; // world meters -> px (covers ~340m across expanded 380x380m sector)

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10, 14, 16, 0.92)';
    ctx.fillRect(0, 0, W, H);

    // Subtle radar grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.arc(cx, cy, 62, 0, Math.PI * 2);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
    ctx.moveTo(0, cy); ctx.lineTo(W, cy);
    ctx.stroke();

    const toMap = (wx, wz) => ({
      x: cx + (wx - player.position.x) * scale,
      y: cy + (wz - player.position.z) * scale
    });

    // Red Zone (Out-of-Bounds area surrounding the ±190m playable sector)
    const halfSize = (world && world.mapHalfSize) || 190;
    const tl = toMap(-halfSize, -halfSize);
    const br = toMap(halfSize, halfSize);
    ctx.save();
    ctx.fillStyle = 'rgba(255, 38, 38, 0.28)';
    // Shade outside the playable square (4 surrounding bands clipped to canvas)
    ctx.fillRect(0, 0, W, Math.max(0, tl.y));
    ctx.fillRect(0, Math.min(H, br.y), W, Math.max(0, H - br.y));
    ctx.fillRect(0, Math.max(0, tl.y), Math.max(0, tl.x), Math.max(0, Math.min(H, br.y) - Math.max(0, tl.y)));
    ctx.fillRect(Math.min(W, br.x), Math.max(0, tl.y), Math.max(0, W - br.x), Math.max(0, Math.min(H, br.y) - Math.max(0, tl.y)));
    // Crisp Red Zone boundary outline
    ctx.strokeStyle = '#ff3d3d';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.restore();

    // Hydrography & Roads on Player-Centered Minimap (strictly clipped inside playable sector)
    if (world.RIVER_A && world.LAKE) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.clip();

      // Southern beach + SE ocean peninsula contour (leaves NE sector z < 165 completely dry!)
      const traceCoast = () => {
        ctx.beginPath();
        const firstZ = 562 - (-halfSize - 160) * 0.075 + Math.sin(-halfSize * 0.012) * 10;
        const p0 = toMap(-halfSize, firstZ);
        ctx.moveTo(p0.x, p0.y);
        for (let x = -halfSize + 25; x <= 468; x += 25) {
          const bz = 562 - (x - 160) * 0.075 + Math.sin(x * 0.012) * 10;
          const p = toMap(x, bz);
          ctx.lineTo(p.x, p.y);
        }
        for (let z = 538; z >= 165; z -= 24) {
          const pt = Math.max(0, Math.min(1, (z - 165) / 155));
          const ps = pt * pt * (3 - 2 * pt);
          const ex = 650 - ps * 182 + Math.sin(z * 0.016) * 8;
          const p = toMap(ex, z);
          ctx.lineTo(p.x, p.y);
        }
        const seTop = toMap(halfSize + 40, 165);
        const seBot = toMap(halfSize + 40, halfSize + 40);
        const swBot = toMap(-halfSize - 40, halfSize + 40);
        ctx.lineTo(seTop.x, seTop.y);
        ctx.lineTo(seBot.x, seBot.y);
        ctx.lineTo(swBot.x, swBot.y);
        ctx.closePath();
      };
      traceCoast();
      ctx.strokeStyle = 'rgba(194, 178, 128, 0.45)';
      ctx.lineWidth = Math.max(2, 18 * scale);
      ctx.stroke();
      ctx.fillStyle = 'rgba(43, 94, 114, 0.88)';
      ctx.fill();

      // Rivers
      ctx.strokeStyle = '#3f7f96';
      ctx.lineWidth = Math.max(2.5, 24 * scale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const line of [world.RIVER_A, world.RIVER_B]) {
        if (!line || !line.length) continue;
        ctx.beginPath();
        line.forEach(([wx, wz], i) => {
          const p = toMap(wx, wz);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }

      // Lake
      const lp = toMap(world.LAKE.x, world.LAKE.z);
      ctx.fillStyle = '#387287';
      ctx.beginPath();
      ctx.ellipse(lp.x, lp.y, world.LAKE.rx * scale, world.LAKE.rz * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Main highways & connector roads on minimap
      ctx.strokeStyle = 'rgba(148, 156, 150, 0.34)';
      const drawMiniRoad = (x1, z1, x2, z2, rw) => {
        const a = toMap(x1, z1);
        const b = toMap(x2, z2);
        ctx.lineWidth = Math.max(1.2, rw * scale);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      };
      drawMiniRoad(0, -560, 0, 560, 11);
      drawMiniRoad(-560, 20, 560, 20, 11);
      drawMiniRoad(-320, -240, -60, -340, 8);
      drawMiniRoad(-60, -340, 310, -270, 8);
      drawMiniRoad(310, -270, 340, 20, 8);
      drawMiniRoad(340, 20, 270, 290, 8);
      drawMiniRoad(270, 290, 0, 312, 8);
      drawMiniRoad(0, 312, -260, 310, 8);
      drawMiniRoad(-260, 310, -370, 50, 8);
      drawMiniRoad(-370, 50, -320, -240, 8);
      ctx.restore();
    }

    // POIs
    if (world.pois) {
      for (const poi of world.pois) {
        const p = toMap(poi.x, poi.z);
        ctx.fillStyle = poi.color || 'rgba(255,255,255,0.22)';
        ctx.fillRect(p.x - 10, p.y - 8, 20, 16);
      }
    }

    // Extract Zones (Green triangles)
    if (world.extractZones) {
      for (const ez of world.extractZones) {
        const p = toMap(ez.position.x, ez.position.z);
        ctx.fillStyle = '#69f0ae';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 5);
        ctx.lineTo(p.x - 4, p.y + 4);
        ctx.lineTo(p.x + 4, p.y + 4);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Allied Squadmates (Cyan dots)
    if (squadManager && squadManager.allies) {
      for (const ally of squadManager.allies) {
        if (ally.dead) continue;
        const p = toMap(ally.position.x, ally.position.z);
        ctx.fillStyle = '#4fc3f7';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Hostile Operators & NPCs (2D pulsing translucent UAV radar circle radiating outward up to 150m!)
    const uavActive = (player.uavTimer || 0) > 0;
    const UAV_RADIUS = 150;
    if (uavActive) {
      const pulsePhase = (performance.now() % 2400) / 2400; // 0..1 radiating outward & dissipating
      const maxMinimapR = Math.min(70, UAV_RADIUS * scale);
      const curR = Math.max(2, pulsePhase * maxMinimapR);
      const alpha = Math.max(0, 1 - pulsePhase);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = `rgba(105, 240, 174, ${(0.14 * alpha).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(0, 0, curR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(105, 240, 174, ${(0.68 * alpha).toFixed(3)})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, curR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (enemyManager && enemyManager.enemies) {
      for (const e of enemyManager.enemies) {
        if (e.dead || e.extracted) continue;
        const dist = e.position.distanceTo(player.position);
        const visible = (uavActive && dist <= UAV_RADIUS) || e.state === 'COMBAT' || dist < 24;
        if (!visible) continue;
        const p = toMap(e.position.x, e.position.z);
        let px = p.x, py = p.y;
        const dxM = px - cx, dyM = py - cy;
        const rM = Math.hypot(dxM, dyM);
        const maxR = 66;
        let clamped = false;
        if (rM > maxR) {
          if (!uavActive) continue;
          px = cx + (dxM / rM) * maxR;
          py = cy + (dyM / rM) * maxR;
          clamped = true;
        }
        ctx.fillStyle = e.isDowned ? '#ffca28' : (e.isOperator ? '#ff3d3d' : '#ff7043');
        ctx.beginPath();
        ctx.arc(px, py, clamped ? 2.4 : (e.isDowned ? 2.5 : (e.isOperator ? 3.5 : 2.8)), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Active Tactical Pings on Minimap
    const pings = window.activePings || [];
    for (const pg of pings) {
      const pp = toMap(pg.position.x, pg.position.z);
      let px = pp.x, py = pp.y;
      const dxM = px - cx, dyM = py - cy;
      const rM = Math.hypot(dxM, dyM);
      if (rM > 66) {
        px = cx + (dxM / rM) * 66;
        py = cy + (dyM / rM) * 66;
      }
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = pg.color || '#f5a623';
      ctx.fillRect(-3.2, -3.2, 6.4, 6.4);
      ctx.strokeStyle = '#0b0e0d';
      ctx.lineWidth = 1;
      ctx.strokeRect(-3.2, -3.2, 6.4, 6.4);
      ctx.restore();
    }

    // Player chevron in center
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-player.yaw);
    ctx.fillStyle = '#f5a623';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-4, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _renderFullMap(player, world, enemyManager, squadManager) {
    const canvas = document.getElementById('hud-tacmap-canvas');
    if (!canvas || !world) return;
    const zoneLbl = document.getElementById('tacmap-zone-name');
    if (zoneLbl && world.zone && world.zone.name) {
      zoneLbl.textContent = world.zone.name.toUpperCase();
    }

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const { halfSize, viewExtent, zoom } = this.getTacMapViewExtent(world);
    this._clampTacMapPan(world);
    const scale = W / (viewExtent * 2);
    const panX = (this.tacMapPan && this.tacMapPan.x) || 0;
    const panZ = (this.tacMapPan && this.tacMapPan.z) || 0;
    const toMap = (wx, wz) => ({
      x: W * 0.5 + (wx - panX) * scale,
      y: H * 0.5 + (wz - panZ) * scale
    });
    const zoomBadge = document.getElementById('tacmap-zoom-badge');
    if (zoomBadge) zoomBadge.textContent = `${zoom.toFixed(1)}x`;

    // 1. Base Red Zone fill across entire canvas
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#240b0b';
    ctx.fillRect(0, 0, W, H);

    // Diagonal hazard hatching in the Red Zone
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 55, 55, 0.22)';
    ctx.lineWidth = 2;
    for (let i = -H; i < W + H; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - H, H);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Playable Sector Interior (±190m)
    const tl = toMap(-halfSize, -halfSize);
    const br = toMap(halfSize, halfSize);
    ctx.fillStyle = '#121815';
    ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    // Clip all interior terrain, water, grid & road layers strictly inside the ±620m playable sector!
    ctx.save();
    ctx.beginPath();
    ctx.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.clip();

    // Tactical 100m coordinate grid across the full 1240m x 1240m playable sector
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
    ctx.lineWidth = 1;
    const gridStep = 100;
    for (let g = -Math.floor(halfSize / gridStep) * gridStep; g <= halfSize; g += gridStep) {
      const p1 = toMap(g, -halfSize);
      const p2 = toMap(g, halfSize);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      const q1 = toMap(-halfSize, g);
      const q2 = toMap(halfSize, g);
      ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
    }

    // 3a. Hydrography: NE river -> lake -> SE outlet river -> southern sandy beach -> SE ocean peninsula
    if (world.RIVER_A && world.LAKE) {
      const traceCoastFull = () => {
        ctx.beginPath();
        const firstZ = 562 - (-halfSize - 160) * 0.075 + Math.sin(-halfSize * 0.012) * 10;
        const p0 = toMap(-halfSize, firstZ);
        ctx.moveTo(p0.x, p0.y);
        for (let x = -halfSize + 18; x <= 468; x += 18) {
          const bz = 562 - (x - 160) * 0.075 + Math.sin(x * 0.012) * 10;
          const p = toMap(x, bz);
          ctx.lineTo(p.x, p.y);
        }
        for (let z = 538; z >= 165; z -= 18) {
          const pt = Math.max(0, Math.min(1, (z - 165) / 155));
          const ps = pt * pt * (3 - 2 * pt);
          const ex = 650 - ps * 182 + Math.sin(z * 0.016) * 8;
          const p = toMap(ex, z);
          ctx.lineTo(p.x, p.y);
        }
        const seTop = toMap(halfSize + 40, 165);
        const seBot = toMap(halfSize + 40, halfSize + 40);
        const swBot = toMap(-halfSize - 40, halfSize + 40);
        ctx.lineTo(seTop.x, seTop.y);
        ctx.lineTo(seBot.x, seBot.y);
        ctx.lineTo(swBot.x, swBot.y);
        ctx.closePath();
      };
      // Golden sandy shoreline band + deep coastal sea fill
      traceCoastFull();
      ctx.strokeStyle = 'rgba(194, 178, 128, 0.42)';
      ctx.lineWidth = Math.max(2.5, 22 * scale);
      ctx.stroke();
      ctx.fillStyle = '#1d4152';
      ctx.fill();

      // Rivers (with subtle wet bank trim)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const line of [world.RIVER_A, world.RIVER_B]) {
        if (!line || !line.length) continue;
        ctx.strokeStyle = 'rgba(145, 138, 98, 0.28)';
        ctx.lineWidth = Math.max(3.2, 34 * scale);
        ctx.beginPath();
        line.forEach(([wx, wz], i) => {
          const p = toMap(wx, wz);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        ctx.strokeStyle = '#2d667a';
        ctx.lineWidth = Math.max(2.2, 24 * scale);
        ctx.beginPath();
        line.forEach(([wx, wz], i) => {
          const p = toMap(wx, wz);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }

      // Lake basin + sandy rim
      const lp = toMap(world.LAKE.x, world.LAKE.z);
      ctx.strokeStyle = 'rgba(166, 155, 112, 0.32)';
      ctx.lineWidth = Math.max(2, 12 * scale);
      ctx.fillStyle = '#295b6e';
      ctx.beginPath();
      ctx.ellipse(lp.x, lp.y, world.LAKE.rx * scale, world.LAKE.rz * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }

    // 3b. Actual 1240m Highway & Connector Road Network (drawn ABOVE water so highway bridges show clearly!)
    ctx.strokeStyle = 'rgba(155, 164, 158, 0.42)';
    ctx.lineCap = 'round';
    const drawRoad = (x1, z1, x2, z2, rw) => {
      const a = toMap(x1, z1);
      const b = toMap(x2, z2);
      ctx.lineWidth = Math.max(1.5, rw * scale);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    };
    drawRoad(0, -560, 0, 560, 11);
    drawRoad(-560, 20, 560, 20, 11);
    drawRoad(-320, -240, -60, -340, 8);
    drawRoad(-60, -340, 310, -270, 8);
    drawRoad(310, -270, 340, 20, 8);
    drawRoad(340, 20, 270, 290, 8);
    drawRoad(270, 290, 0, 312, 8);
    drawRoad(0, 312, -260, 310, 8);
    drawRoad(-260, 310, -370, 50, 8);
    drawRoad(-370, 50, -320, -240, 8);
    ctx.restore();

    // 4. Crisp Crimson Red Zone Boundary Border & Labels
    ctx.save();
    ctx.strokeStyle = '#ff3d3d';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.font = 'bold 10px Consolas, monospace';
    ctx.fillStyle = '#ff6b6b';
    ctx.textAlign = 'center';
    if (tl.y > 14) ctx.fillText('RED ZONE // OUT OF BOUNDS', W * 0.5, tl.y * 0.58);
    if (br.y < H - 14) ctx.fillText('RED ZONE // OUT OF BOUNDS', W * 0.5, br.y + (H - br.y) * 0.62);
    ctx.restore();

    // 5. Labeled POIs
    if (world.pois) {
      ctx.save();
      ctx.font = 'bold 10px Consolas, monospace';
      ctx.textAlign = 'center';
      for (const poi of world.pois) {
        const p = toMap(poi.x, poi.z);
        ctx.fillStyle = poi.color || 'rgba(255,255,255,0.28)';
        ctx.globalAlpha = 0.28;
        ctx.fillRect(p.x - 16, p.y - 12, 32, 24);
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = poi.color || '#d8e0dc';
        ctx.lineWidth = 1.3;
        ctx.strokeRect(p.x - 16, p.y - 12, 32, 24);
        ctx.fillStyle = '#e8eee9';
        ctx.fillText(poi.name, p.x, p.y - 16);
      }
      ctx.restore();
    }

    // 6. Labeled Extraction Zones
    if (world.extractZones) {
      ctx.save();
      ctx.font = 'bold 9.5px Consolas, monospace';
      ctx.textAlign = 'center';
      for (const ez of world.extractZones) {
        const p = toMap(ez.position.x, ez.position.z);
        ctx.fillStyle = 'rgba(105, 240, 174, 0.22)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#69f0ae';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 6);
        ctx.lineTo(p.x - 5, p.y + 4);
        ctx.lineTo(p.x + 5, p.y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillText(ez.name, p.x, p.y + 18);
      }
      ctx.restore();
    }

    // 7. 2D Pulsing UAV Radar Ring (150m radius radiating outward & dissipating) & Hostiles
    const uavActive = (player.uavTimer || 0) > 0;
    const UAV_RADIUS = 150;
    const pPos = toMap(player.position.x, player.position.z);
    if (uavActive) {
      const pulsePhase = (performance.now() % 2400) / 2400;
      const maxMapR = UAV_RADIUS * scale;
      const curR = Math.max(3, pulsePhase * maxMapR);
      const alpha = Math.max(0, 1 - pulsePhase);
      ctx.save();
      ctx.translate(pPos.x, pPos.y);
      ctx.strokeStyle = 'rgba(105, 240, 174, 0.16)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, maxMapR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(105, 240, 174, ${(0.13 * alpha).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(0, 0, curR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(105, 240, 174, ${(0.72 * alpha).toFixed(3)})`;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(0, 0, curR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (enemyManager && enemyManager.enemies) {
      for (const e of enemyManager.enemies) {
        if (e.dead || e.extracted) continue;
        const dist = e.position.distanceTo(player.position);
        const visible = (uavActive && dist <= UAV_RADIUS) || e.state === 'COMBAT' || dist <= 30;
        if (!visible) continue;
        const ep = toMap(e.position.x, e.position.z);
        ctx.fillStyle = e.isDowned ? '#ffca28' : (e.isOperator ? '#ff3d3d' : '#ff7043');
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, e.isOperator ? 4.2 : 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 8. Allied Squadmates
    if (squadManager && squadManager.allies) {
      for (const ally of squadManager.allies) {
        if (ally.dead) continue;
        const ap = toMap(ally.position.x, ally.position.z);
        ctx.fillStyle = '#4fc3f7';
        ctx.beginPath();
        ctx.arc(ap.x, ap.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 8b. Active Tactical Pings on Full-Size Map (with hover highlight for click-to-remove!)
    const pings = window.activePings || [];
    const curPxX = this.tacMapCursor ? this.tacMapCursor.nx * W : -999;
    const curPxY = this.tacMapCursor ? this.tacMapCursor.ny * H : -999;
    const hoveredMapPing = this.findTacMapPingAt
      ? this.findTacMapPingAt(this.tacMapCursor ? this.tacMapCursor.nx : -1, this.tacMapCursor ? this.tacMapCursor.ny : -1, world)
      : null;
    for (const pg of pings) {
      const pp = toMap(pg.position.x, pg.position.z);
      const isHovered = hoveredMapPing === pg;
      if (isHovered) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(pp.x, pp.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = pg.color || '#f5a623';
      ctx.fillRect(-5.5, -5.5, 11, 11);
      ctx.strokeStyle = isHovered ? '#ffffff' : '#0a0d0c';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-5.5, -5.5, 11, 11);
      ctx.restore();
      ctx.save();
      ctx.font = 'bold 9.5px Consolas, monospace';
      ctx.fillStyle = isHovered ? '#ffffff' : (pg.color || '#f5a623');
      ctx.textAlign = 'center';
      ctx.fillText(isHovered ? `[REMOVE] ${pg.label || 'PING'}` : (pg.label || 'PING'), pp.x, pp.y - 11);
      ctx.restore();
    }

    // 9. Player Chevron + Field-of-View Cone
    ctx.save();
    ctx.translate(pPos.x, pPos.y);
    ctx.rotate(-player.yaw);
    ctx.fillStyle = 'rgba(245, 166, 35, 0.18)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-18, -36);
    ctx.lineTo(18, -36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5a623';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 10. Controller Tac-Map Reticle Cursor (when navigating map with Left Stick)
    if (this.tacMapCursor && this.tacMapCursor.active && !(this.tacMapRadial && this.tacMapRadial.open)) {
      ctx.save();
      ctx.translate(curPxX, curPxY);
      ctx.strokeStyle = hoveredMapPing ? '#ff6b6b' : '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-12, 0); ctx.lineTo(-5, 0);
      ctx.moveTo(5, 0); ctx.lineTo(12, 0);
      ctx.moveTo(0, -12); ctx.lineTo(0, -5);
      ctx.moveTo(0, 5); ctx.lineTo(0, 12);
      ctx.stroke();
      ctx.restore();
    }
  }

  _getStanceSVG(stance) {
    const svgs = {
      stand: `<svg viewBox="0 0 40 54"><circle cx="20" cy="8" r="4.5"/><path d="M14 14h12l2 14h-4l-1-8v14l2 16h-4l-1-13-1 13h-4l2-16V20l-1 8h-4z"/></svg>`,
      sprint: `<svg viewBox="0 0 40 54"><circle cx="25" cy="9" r="4.2"/><path d="M17 15l10 1 5 7-3 3-4-5-3 9 7 8-3 12-4-1 2-9-5-6-5 15-4-1 5-18 2-9-4 5-3-2z"/></svg>`,
      tac_sprint: `<svg viewBox="0 0 40 54"><circle cx="26" cy="9" r="4.2"/><path d="M29 5l3-1 2 12-4 1-2-7-4 12 8 7-3 14-4-1 2-10-6-5-6 15-4-1 6-18 2-9-6 6-3-3 8-9 9 1z"/></svg>`,
      crouch: `<svg viewBox="0 0 40 54"><circle cx="22" cy="19" r="4.2"/><path d="M15 25h11l4 8-3 2-3-5-2 7 7 5-2 8h-4l1-5-6-4-4 9h-4l4-13 1-12z"/></svg>`,
      slide: `<svg viewBox="0 0 44 54"><circle cx="12" cy="27" r="4"/><path d="M14 32l9 4 15-1 1 4-17 3-6 5h-6l4-7-5-4z"/></svg>`,
      prone: `<svg viewBox="0 0 46 54"><circle cx="37" cy="37" r="3.8"/><path d="M5 42l14-2 14-1 3 3-1 3-16-1-14 2z"/></svg>`
    };
    return svgs[stance] || svgs.stand;
  }

  _updateCompass(player, world) {
    const track = document.getElementById('compass-track');
    track.innerHTML = '';

    // Player heading in degrees (0 = North/-Z, 90 = East/+X)
    const headingDeg = ((-player.yaw * 180 / Math.PI) % 360 + 360) % 360;

    const addMarker = (angleDeg, label, cls) => {
      let diff = ((angleDeg - headingDeg + 540) % 360) - 180;
      if (Math.abs(diff) > 85) return;
      const pct = 50 + (diff / 85) * 50;
      const el = document.createElement('span');
      el.className = `compass-marker ${cls}`;
      el.style.left = `${pct}%`;
      el.textContent = label;
      track.appendChild(el);
    };

    addMarker(0, 'N', 'cardinal');
    addMarker(90, 'E', 'cardinal');
    addMarker(180, 'S', 'cardinal');
    addMarker(270, 'W', 'cardinal');

    for (const ez of world.extractZones) {
      const dx = ez.position.x - player.position.x;
      const dz = ez.position.z - player.position.z;
      const dist = Math.round(Math.hypot(dx, dz));
      const ang = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
      addMarker(ang, `▲ ${ez.name.split(' ')[0]} ${dist}m`, 'extract');
    }
  }

  // ==================== NON-BLOCKING LOOT & BACKPACK UI ====================
  openLootModal(player, title, containerItems, operatorEquipment = null, worldPos = null, camera = null, containerId = null) {
    this._lootPlayer = player;
    this.activeLootSource = containerItems
      ? { title, items: containerItems, operatorEquipment, worldPos: worldPos ? worldPos.clone() : null, containerId: containerId || null }
      : null;
    this._searchRevealProgress = 0;
    this.hideItemPopout();

    const modal = document.getElementById('loot-modal');
    const cPanel = document.getElementById('inv-container-panel');
    modal.classList.remove('hidden');
    if (cPanel) {
      cPanel.classList.toggle('hidden', !this.activeLootSource);
      cPanel.classList.toggle('enemy-corpse-panel', !!(this.activeLootSource && this.activeLootSource.operatorEquipment));
    }
    if (this.activeLootSource) {
      this.autoLootExistingStacks(player);
    }
    this.renderLootModal(player);
    if (this.activeLootSource && camera) {
      this.positionContainerPanel(camera);
    }
    requestAnimationFrame(() => {
      // Default selection: top-leftmost slot in the container being searched (or top-leftmost backpack slot if no container)
      const firstTarget = this.activeLootSource
        ? (document.querySelector('#loot-container-items .inv-slot') || document.querySelector('#loot-backpack-items .inv-slot'))
        : document.querySelector('#loot-backpack-items .inv-slot');
      if (firstTarget && this.setSelectedElement) {
        this.setSelectedElement(firstTarget, { inputMode: 'auto' });
      } else {
        this.ensureInitialSelection({ inputMode: 'auto' });
      }
    });
  }

  _syncActiveContainerToNet() {
    const src = this.activeLootSource;
    if (src && src.containerId && typeof this.onContainerChanged === 'function') {
      this.onContainerChanged(src.containerId, src.items || [], src.operatorEquipment || null);
    }
  }

  autoLootExistingStacks(player) {
    if (!this.activeLootSource || !player || !Array.isArray(player.backpack)) return false;
    const items = this.activeLootSource.items;
    const now = performance.now();
    let movedAny = false;

    // 1. Auto-stack revealed armor plates from enemy operator equipment plate slot into player's plate slot (max 6)
    const eq = this.activeLootSource.operatorEquipment;
    if (eq && eq.plates > 0 && eq.revealedSlots && eq.revealedSlots.plates && (!eq._platesAutoLootAt || now >= eq._platesAutoLootAt)) {
      const curPlates = player.plates || 0;
      const room = Math.max(0, 6 - curPlates);
      if (room > 0) {
        const move = Math.min(room, eq.plates);
        player.plates = curPlates + move;
        eq.plates -= move;
        movedAny = true;
      }
    }

    // 2. Auto-stack revealed container items after their 0.5s post-reveal delay
    if (Array.isArray(items) && items.length > 0) {
      for (let i = items.length - 1; i >= 0; i--) {
        const src = items[i];
        if (!src || src.revealed === false || src.qty <= 0) continue;
        if (src._autoLootAt && now < src._autoLootAt) continue;
        const def = GAME_DATA.ITEMS[src.id];
        if (!def) continue;

        // Armor plates fill the operator's plate slot first (up to 6)
        if (src.id === 'armor_plate' || def.type === 'plate') {
          const curPlates = player.plates || 0;
          const plateRoom = Math.max(0, 6 - curPlates);
          if (plateRoom > 0) {
            const move = Math.min(plateRoom, src.qty);
            player.plates = curPlates + move;
            src.qty -= move;
            movedAny = true;
          }
        }

        if (src.qty > 0 && def.stackable) {
          const maxStack = def.maxStack || Infinity;
          for (const bagItem of player.backpack) {
            if (!bagItem || bagItem.id !== src.id) continue;
            const room = maxStack === Infinity ? src.qty : Math.max(0, maxStack - bagItem.qty);
            if (room <= 0) continue;
            const move = Math.min(room, src.qty);
            bagItem.qty += move;
            src.qty -= move;
            movedAny = true;
            if (src.qty <= 0) break;
          }
        }

        if (src.qty <= 0) {
          items.splice(i, 1);
        }
      }
    }

    if (movedAny) {
      this._syncActiveContainerToNet();
      if (window.soundEngine && window.soundEngine.playClick) {
        try { window.soundEngine.playClick(); } catch (e) {}
      }
    }
    return movedAny;
  }

  positionContainerPanel(camera) {
    const cPanel = document.getElementById('inv-container-panel');
    if (!cPanel || cPanel.classList.contains('hidden') || !this.activeLootSource) return;
    if (camera) this._lastLootCamera = camera;

    const invScale = this._currentInvScale || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const pw = Math.round((cPanel.offsetWidth || 358) * invScale);
    const ph = Math.round((cPanel.offsetHeight || 220) * invScale);
    const margin = 12;

    // Unanchor enemy/player operator body inventory from the 3D corpse and hang it cleanly on the left side of the screen
    if (this.activeLootSource.operatorEquipment) {
      let leftX = 14;
      let topY = Math.round((H - ph) * 0.50);
      topY = Math.max(margin, Math.min(H - ph - margin, topY));

      const minimapEl = document.querySelector('.hud-top-left');
      if (minimapEl && !minimapEl.classList.contains('hidden')) {
        const mr = minimapEl.getBoundingClientRect();
        if (mr.width > 2 && mr.height > 2 && topY < mr.bottom + 8) {
          if (mr.bottom + 10 + ph <= H - margin) {
            topY = Math.round(mr.bottom + 10);
          } else {
            leftX = Math.round(mr.right + 12);
          }
        }
      }

      cPanel.style.left = `${leftX}px`;
      cPanel.style.top = `${topY}px`;
      cPanel.style.bottom = 'auto';
      cPanel.style.transformOrigin = 'top left';
      cPanel.style.transform = `scale(${invScale.toFixed(4)})`;
      return;
    }

    // 1. Project active container's 3D world position onto screen
    let targetCx = W * 0.36;
    let targetCy = H * 0.48;
    if (camera && this.activeLootSource.worldPos && typeof THREE !== 'undefined') {
      const p3 = this.activeLootSource.worldPos.clone();
      p3.y += 0.32;
      p3.project(camera);
      if (p3.z < 1) {
        targetCx = (p3.x * 0.5 + 0.5) * W;
        targetCy = (-p3.y * 0.5 + 0.5) * H;
      }
    }

    const clampX = (x) => Math.max(margin, Math.min(W - pw - margin, x));
    const clampY = (y) => Math.max(margin, Math.min(H - ph - margin, y));
    const idealX = clampX(targetCx - pw / 2);
    const idealY = clampY(targetCy - ph / 2);

    // 2. Gather bounding rects of all visible HUD / UI elements to avoid overlapping
    const pad = 10;
    const obstacleSelectors = [
      '#inv-operator-panel',
      '.hud-top-left',
      '.hud-top-center',
      '.hud-bottom-left',
      '.hud-bottom-right-cluster',
      '#hud-kill-feed',
      '#hud-feed',
      '#extract-banner',
      '#revive-banner',
      '#redzone-banner'
    ];
    const obstacles = [];
    for (const sel of obstacleSelectors) {
      const el = document.querySelector(sel);
      if (!el || el.classList.contains('hidden')) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 2 || r.height <= 2) continue;
      obstacles.push({
        left: r.left - pad,
        right: r.right + pad,
        top: r.top - pad,
        bottom: r.bottom + pad
      });
    }

    const overlapArea = (x, y) => {
      let area = 0;
      const r2 = x + pw;
      const b2 = y + ph;
      for (const o of obstacles) {
        const ox = Math.max(0, Math.min(r2, o.right) - Math.max(x, o.left));
        const oy = Math.max(0, Math.min(b2, o.bottom) - Math.max(y, o.top));
        area += ox * oy;
      }
      return area;
    };

    // 3. If ideal position is already clear, use it directly
    let bestX = idealX;
    let bestY = idealY;
    let bestOverlap = overlapArea(idealX, idealY);

    if (bestOverlap > 0) {
      // Build candidate positions pushed cleanly outside each obstacle + local grid around ideal point
      const candidates = [[idealX, idealY]];
      for (const o of obstacles) {
        candidates.push(
          [clampX(o.left - pw), idealY],
          [clampX(o.right), idealY],
          [idealX, clampY(o.top - ph)],
          [idealX, clampY(o.bottom)]
        );
      }
      for (let gx = 0; gx <= 6; gx++) {
        for (let gy = 0; gy <= 5; gy++) {
          const cx = margin + ((W - pw - margin * 2) * gx) / 6;
          const cy = margin + ((H - ph - margin * 2) * gy) / 5;
          candidates.push([clampX(cx), clampY(cy)]);
        }
      }

      let bestDistSq = Infinity;
      for (const [cx, cy] of candidates) {
        const ov = overlapArea(cx, cy);
        const dx = (cx + pw / 2) - targetCx;
        const dy = (cy + ph / 2) - targetCy;
        const dSq = dx * dx + dy * dy;
        if (ov < bestOverlap - 1 || (Math.abs(ov - bestOverlap) <= 1 && dSq < bestDistSq)) {
          bestOverlap = ov;
          bestDistSq = dSq;
          bestX = cx;
          bestY = cy;
        }
      }
    }

    cPanel.style.left = `${Math.round(bestX)}px`;
    cPanel.style.top = `${Math.round(bestY)}px`;
    cPanel.style.bottom = 'auto';
    cPanel.style.transformOrigin = 'top left';
    cPanel.style.transform = `scale(${invScale.toFixed(4)})`;
  }

  closeLootModal() {
    const modal = document.getElementById('loot-modal');
    const wasOpen = modal && !modal.classList.contains('hidden');
    if (modal) modal.classList.add('hidden');
    if (wasOpen && window.soundEngine && window.soundEngine.playUiBack) {
      try { window.soundEngine.playUiBack(); } catch (e) {}
    }
    this.hideItemPopout();
    this.closeRaidWeaponPickMode();
    this.closeWeaponStagingModal();
    this.activeLootSource = null;
    this._lootPlayer = null;
  }

  closeRaidWeaponPickMode() {
    this._raidWeaponPick = null;
    const modal = document.getElementById('loot-modal');
    if (modal) modal.classList.remove('weapon-pick-active');
    const banner = document.getElementById('raid-wpn-pick-banner');
    if (banner) banner.remove();
    document.querySelectorAll('.wpn-pick-target').forEach(el => el.classList.remove('wpn-pick-target'));
    document.querySelectorAll('.wpn-pick-slot-badge').forEach(el => el.remove());
  }

  _confirmRaidWeaponPickSlot(targetSlotKey) {
    const ctx = this._raidWeaponPick;
    if (!ctx) return false;
    const { player, weaponItem, onComplete } = ctx;
    if (targetSlotKey === 'backpackWeapon' && !(player && player.hasWeaponBackpack && player.hasWeaponBackpack())) {
      this._showSocialToast('Requires a Weapon Backpack to stow in Bag Weapon Slot.');
      return false;
    }
    const res = player.equipWeaponInRaid(weaponItem.id, targetSlotKey, {
      mods: weaponItem.mods || {},
      mag: weaponItem.mag,
      rarityOverride: weaponItem.rarityOverride || null
    });
    this.closeRaidWeaponPickMode();
    if (res && res.equipped) {
      if (onComplete) onComplete(res, targetSlotKey);
      if (window.soundEngine && window.soundEngine.playMagIn) {
        try { window.soundEngine.playMagIn(); } catch (e) {}
      }
      const modal = document.getElementById('loot-modal');
      if (modal && !modal.classList.contains('hidden')) {
        this.renderLootModal(player);
      }
      return true;
    }
    return false;
  }

  openRaidWeaponStaging(player, weaponItem, { sourceLabel = 'OPERATOR WEAPON', excludeSlotKey = null, onComplete = null, onCancel = null } = {}) {
    if (!player || !weaponItem || !GAME_DATA.ITEMS[weaponItem.id]) return;
    const modal = document.getElementById('loot-modal');
    const opPanel = document.getElementById('inv-operator-panel');
    if (!modal || modal.classList.contains('hidden') || !opPanel) return;

    this.closeRaidWeaponPickMode();
    this.hideItemPopout();

    const wDef = GAME_DATA.ITEMS[weaponItem.id];
    const hasWpnBag = !!(player.hasWeaponBackpack && player.hasWeaponBackpack());
    const validTargets = [];
    if (excludeSlotKey !== 'primary') validTargets.push('primary');
    if (excludeSlotKey !== 'secondary') validTargets.push('secondary');
    if (hasWpnBag && excludeSlotKey !== 'backpackWeapon') validTargets.push('backpackWeapon');

    if (validTargets.length === 0) return;

    this._raidWeaponPick = { player, weaponItem, sourceLabel, excludeSlotKey, validTargets, onComplete, onCancel };
    modal.classList.add('weapon-pick-active');

    // Floating selected-weapon card at top of the backpack/loadout panel (matches reference image!)
    const banner = document.createElement('div');
    banner.id = 'raid-wpn-pick-banner';
    banner.className = 'wpn-pick-banner';
    const iconUrl = (window.itemIcons && window.itemIcons.getIcon)
      ? window.itemIcons.getIcon(weaponItem.id, { wide: true, mods: weaponItem.mods || {} })
      : '';
    banner.innerHTML = `
      <div class="wpn-pick-banner-left">
        ${iconUrl ? `<img class="wpn-pick-banner-icon" src="${iconUrl}" alt="${wDef.name}" />` : ''}
        <div class="wpn-pick-banner-info">
          <div class="wpn-pick-banner-title">${wDef.name.toUpperCase()}</div>
          <div class="wpn-pick-banner-sub">${sourceLabel} · SELECT HIGHLIGHTED WEAPON SLOT</div>
        </div>
      </div>
      <button id="btn-cancel-wpn-pick" class="btn-small" style="padding:4px 8px;flex-shrink:0;">CANCEL</button>
    `;
    opPanel.insertBefore(banner, opPanel.firstChild);
    const cancelBtn = banner.querySelector('#btn-cancel-wpn-pick');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cb = this._raidWeaponPick && this._raidWeaponPick.onCancel;
        this.closeRaidWeaponPickMode();
        if (cb) cb();
      });
    }

    // Highlight ONLY the valid destination weapon slots & bind one-click confirmation
    let firstTargetEl = null;
    const highlightTarget = (el, slotKey, labelText) => {
      if (!el) return;
      el.classList.add('wpn-pick-target');
      el.dataset.wpnPickKey = slotKey;
      const badge = document.createElement('span');
      badge.className = 'wpn-pick-slot-badge';
      badge.textContent = labelText;
      el.appendChild(badge);
      if (!firstTargetEl) firstTargetEl = el;
    };

    if (validTargets.includes('primary')) {
      const el = document.querySelector('#inv-op-slots .op-slot-card[data-op-key="primary"]');
      highlightTarget(el, 'primary', player.slots && player.slots.primary ? 'SWAP [1]' : 'EQUIP [1]');
    }
    if (validTargets.includes('secondary')) {
      const el = document.querySelector('#inv-op-slots .op-slot-card[data-op-key="secondary"]');
      highlightTarget(el, 'secondary', player.slots && player.slots.secondary ? 'SWAP [2]' : 'EQUIP [2]');
    }
    if (validTargets.includes('backpackWeapon')) {
      const el = document.querySelector('#loot-backpack-items .backpack-weapon-slot');
      highlightTarget(el, 'backpackWeapon', player.backpackWeapon ? 'SWAP BAG' : 'STOW BAG');
    }

    if (firstTargetEl && this.setSelectedElement) {
      this.setSelectedElement(firstTargetEl, { inputMode: 'gamepad' });
    }
  }

  handleGamepadInventoryAction(actionType) {
    const modal = document.getElementById('loot-modal');
    if (!modal || modal.classList.contains('hidden') || !this._lootPlayer) return false;
    const player = this._lootPlayer;

    // Resolve currently focused / hovered slot element
    const sel = (this._selectedEl && modal.contains(this._selectedEl))
      ? this._selectedEl
      : (this._hoveredSlot && this._hoveredSlot.el && modal.contains(this._hoveredSlot.el) ? this._hoveredSlot.el : null);

    // 1. If weapon-switch picker is active: A/Cross confirms highlighted slot!
    if (this._raidWeaponPick) {
      if (actionType === 'a_cross') {
        const targetEl = (sel && sel.classList.contains('wpn-pick-target'))
          ? sel
          : modal.querySelector('.wpn-pick-target');
        if (targetEl && targetEl.dataset.wpnPickKey) {
          this._confirmRaidWeaponPickSlot(targetEl.dataset.wpnPickKey);
          return true;
        }
      }
      return false;
    }

    if (!sel) return false;

    // Y (Xbox) / Triangle (PlayStation): Ping hovered or selected item in Bag / Container / Body / Personal Inventory!
    if (actionType === 'y_ping_item') {
      return this.pingInventorySlot ? this.pingInventorySlot(sel) : false;
    }

    const isPlayerOpCard = !!sel.closest('#inv-op-slots');
    const isEnemyOpCard = !!sel.closest('#loot-enemy-op-slots');
    const isBagWpnSlot = sel.classList.contains('backpack-weapon-slot') && !!sel.closest('#loot-backpack-items');
    const isContainerSlot = !!sel.closest('#loot-container-items');
    const isBackpackSlot = sel.classList.contains('inv-slot') && !isBagWpnSlot && !!sel.closest('#loot-backpack-items');
    const opKey = sel.dataset ? (sel.dataset.opKey || sel.dataset.key) : null;
    const hasContainer = !!this.activeLootSource;

    const pickWeaponEquipSlot = () => {
      if (!player.slots.primary) return 'primary';
      if (!player.slots.secondary) return 'secondary';
      return (player.activeSlot === 'secondary') ? 'secondary' : 'primary';
    };

    const isGearType = (t) => (
      t === 'armor' || t === 'backpack' || t === 'field_upgrade' ||
      t === 'killstreak' || t === 'self_revive' || t === 'headgear' || t === 'melee'
    );

    // 2. X (Xbox) / Square (PlayStation): Quick-Equip / Swap into an available slot!
    if (actionType === 'x_square') {
      const targetWpnSlot = pickWeaponEquipSlot();

      // Player Primary or Secondary -> swap/stow into Backpack Weapon Slot if available
      if (isPlayerOpCard && (opKey === 'primary' || opKey === 'secondary')) {
        const wObj = player.slots && player.slots[opKey];
        if (!wObj) return true;
        if (!player.hasWeaponBackpack()) {
          this._showSocialToast('No Weapon Backpack slot available to stow weapon.');
          return true;
        }
        const prevBagWpn = player.backpackWeapon
          ? { id: player.backpackWeapon.id, mods: player.backpackWeapon.mods || {}, mag: player.backpackWeapon.mag, rarityOverride: player.backpackWeapon.rarityOverride || null }
          : null;
        player.backpackWeapon = { id: wObj.id, mods: wObj.mods || {}, mag: wObj.mag, rarityOverride: wObj.rarityOverride || null };
        player.slots[opKey] = prevBagWpn;
        if (player.activeSlot === opKey) player._equipCurrentWeapon();
        if (window.soundEngine && window.soundEngine.playMagIn) { try { window.soundEngine.playMagIn(); } catch (e) {} }
        this.renderLootModal(player);
        return true;
      }

      // Player Backpack Weapon Slot -> quick-equip into empty Primary/Secondary or swap with active slot!
      if (isBagWpnSlot && player.backpackWeapon) {
        const bw = player.backpackWeapon;
        const res = player.equipWeaponInRaid(bw.id, targetWpnSlot, { mods: bw.mods || {}, mag: bw.mag, rarityOverride: bw.rarityOverride || null });
        if (res && res.equipped) {
          player.backpackWeapon = res.prevId
            ? { id: res.prevId, mods: (res.prevSlotObj && res.prevSlotObj.mods) || {}, mag: res.prevSlotObj && res.prevSlotObj.mag, rarityOverride: (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null }
            : null;
          if (window.soundEngine && window.soundEngine.playMagIn) { try { window.soundEngine.playMagIn(); } catch (e) {} }
          this.renderLootModal(player);
        }
        return true;
      }

      // Container / Enemy Bag item -> Quick-Equip / Swap into available weapon, gear, throwable, or plate slot!
      if (isContainerSlot && this.activeLootSource) {
        const idx = parseInt(sel.dataset.idx, 10);
        const item = this.activeLootSource.items[idx];
        const def = item && GAME_DATA.ITEMS[item.id];
        if (!item || item.revealed === false || !def) return true;
        if (def.type === 'weapon') {
          const res = player.equipWeaponInRaid(item.id, targetWpnSlot, { mods: item.mods || {}, mag: item.mag, rarityOverride: item.rarityOverride || null });
          if (res && res.equipped) {
            this.activeLootSource.items.splice(idx, 1);
            if (res.prevId) {
              this.activeLootSource.items.splice(idx, 0, {
                id: res.prevId, qty: 1,
                mods: (res.prevSlotObj && res.prevSlotObj.mods) || {},
                mag: res.prevSlotObj && res.prevSlotObj.mag,
                rarityOverride: (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null,
                revealed: true
              });
            }
            if (window.soundEngine && window.soundEngine.playMagIn) { try { window.soundEngine.playMagIn(); } catch (e) {} }
            this._syncActiveContainerToNet();
            this.renderLootModal(player);
          }
          return true;
        }
        if (def.type === 'lethal' || def.type === 'tactical') {
          const res = this._swapThrowableWithPlayer(player, item);
          if (res.consumed) {
            this.activeLootSource.items.splice(idx, 1);
            if (res.returned) this.activeLootSource.items.splice(idx, 0, res.returned);
            if (res.extra) this.activeLootSource.items.push(res.extra);
            if (window.soundEngine && window.soundEngine.playClick) { try { window.soundEngine.playClick(); } catch (e) {} }
            this._syncActiveContainerToNet();
            this.renderLootModal(player);
          }
          return true;
        }
        if (isGearType(def.type)) {
          const prev = this._swapGearWithPlayer(player, item.id);
          this.activeLootSource.items.splice(idx, 1);
          if (prev) this.activeLootSource.items.splice(idx, 0, { id: prev, qty: 1, revealed: true });
          if (window.soundEngine && window.soundEngine.playClick) { try { window.soundEngine.playClick(); } catch (e) {} }
          this._syncActiveContainerToNet();
          this.renderLootModal(player);
          return true;
        }
        if (def.type === 'plate' && player.plates < 6) {
          const move = Math.min(6 - player.plates, item.qty);
          player.plates += move;
          item.qty -= move;
          if (item.qty <= 0) this.activeLootSource.items.splice(idx, 1);
          this._syncActiveContainerToNet();
          this.renderLootModal(player);
          return true;
        }
        return true;
      }

      // Backpack item -> Quick-Equip / Swap into available gear, throwable, plate, or med slot!
      if (isBackpackSlot) {
        const idx = parseInt(sel.dataset.idx, 10);
        const item = player.backpack[idx];
        const def = item && GAME_DATA.ITEMS[item.id];
        if (!item || !def) return true;
        if (def.type === 'lethal' || def.type === 'tactical') {
          const res = this._swapThrowableWithPlayer(player, item);
          if (res.consumed) {
            player.backpack.splice(idx, 1);
            if (res.returned) player.backpack.splice(idx, 0, res.returned);
            if (res.extra) player.backpack.push(res.extra);
            this.renderLootModal(player);
          }
          return true;
        }
        if (isGearType(def.type)) {
          const prev = this._swapGearWithPlayer(player, item.id);
          player.backpack.splice(idx, 1);
          if (prev) player.backpack.splice(idx, 0, { id: prev, qty: 1 });
          this.renderLootModal(player);
          return true;
        }
        if (def.type === 'plate' && player.plates < 6) {
          const move = Math.min(6 - player.plates, item.qty);
          player.plates += move;
          item.qty -= move;
          if (item.qty <= 0) player.backpack.splice(idx, 1);
          this.renderLootModal(player);
          return true;
        }
        if (def.type === 'med' && item.id === 'medkit') {
          if (player.startMedkit()) this.closeLootModal();
          return true;
        }
        if (def.type === 'med' && (item.id === 'bandage' || item.id === 'painkillers')) {
          if (player.useTemporaryMed && player.useTemporaryMed(item.id)) {
            this.showCenterToast(
              item.id === 'painkillers' ? 'PAINKILLERS ACTIVE (45s TEMP HP)' : 'BANDAGE APPLIED (25s TEMP HP)',
              '#ffd54f'
            );
            this.renderLootModal(player);
          }
          return true;
        }
        return true;
      }

      // Enemy Operator Equipment -> Quick-Equip / Swap into available player slot!
      if (isEnemyOpCard && opKey && this.activeLootSource && this.activeLootSource.operatorEquipment) {
        const eq = this.activeLootSource.operatorEquipment;
        if (eq.revealedSlots && !eq.revealedSlots[opKey]) return true;
        if (opKey === 'primary' || opKey === 'secondary') {
          const itemId = eq[opKey];
          if (itemId) {
            const res = player.equipWeaponInRaid(itemId, targetWpnSlot, { mods: eq[opKey + 'Mods'] || {}, rarityOverride: eq[opKey + 'Rarity'] || null });
            if (res && res.equipped) {
              eq[opKey] = res.prevId || null;
              eq[opKey + 'Mods'] = (res.prevSlotObj && res.prevSlotObj.mods) || {};
              eq[opKey + 'Rarity'] = (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null;
              if (window.soundEngine && window.soundEngine.playMagIn) { try { window.soundEngine.playMagIn(); } catch (e) {} }
              this._syncActiveContainerToNet();
              this.renderLootModal(player);
            }
          }
          return true;
        }
        // Trigger standard enemy slot click (equips/swaps gear, cash, plates, dogtag)
        sel.click();
        return true;
      }
      return false;
    }

    // 3. R3 (Right Stick Click): Drop entire stack (or equipped weapon/gear) to ground!
    if (actionType === 'r3_drop_stack') {
      if (isBackpackSlot) {
        const idx = parseInt(sel.dataset.idx, 10);
        const removed = player.backpack.splice(idx, 1)[0];
        if (removed && typeof this.onDropItem === 'function') {
          this.onDropItem(removed);
        }
        this.hideItemPopout();
        this.renderLootModal(player);
        return true;
      }
      if (isBagWpnSlot && player.backpackWeapon) {
        const removed = player.backpackWeapon;
        player.backpackWeapon = null;
        if (typeof this.onDropItem === 'function') {
          this.onDropItem({ id: removed.id, qty: 1, mods: removed.mods, mag: removed.mag, rarityOverride: removed.rarityOverride || null });
        }
        this.hideItemPopout();
        this.renderLootModal(player);
        return true;
      }
      if (isPlayerOpCard && opKey) {
        this._stowPlayerOperatorSlot(player, opKey, 'ground');
        this.hideItemPopout();
        this.renderLootModal(player);
        return true;
      }
      return false;
    }

    // 4. A (Xbox) / Cross (PlayStation):
    //    - When looting a container: Quick Stow (container -> backpack / weapon bag; backpack -> container; op slot -> backpack)
    //    - When inside JUST the backpack inventory (no container): Drop item, or drop 1 out of a stack if stackable!
    if (actionType === 'a_cross') {
      if (hasContainer) {
        // Container item -> Quick Stow into Backpack (or Backpack Weapon Slot for weapons)
        if (isContainerSlot) {
          const idx = parseInt(sel.dataset.idx, 10);
          const item = this.activeLootSource.items[idx];
          const def = item && GAME_DATA.ITEMS[item.id];
          if (!item || item.revealed === false || !def) return true;
          if (def.type === 'weapon') {
            if (player.hasWeaponBackpack && player.hasWeaponBackpack()) {
              const prevBagWpn = player.backpackWeapon
                ? { id: player.backpackWeapon.id, qty: 1, mods: player.backpackWeapon.mods || {}, mag: player.backpackWeapon.mag, rarityOverride: player.backpackWeapon.rarityOverride || null, revealed: true }
                : null;
              player.backpackWeapon = { id: item.id, mods: item.mods || {}, mag: item.mag, rarityOverride: item.rarityOverride || null };
              this.activeLootSource.items.splice(idx, 1);
              if (prevBagWpn) this.activeLootSource.items.splice(idx, 0, prevBagWpn);
              if (window.soundEngine && window.soundEngine.playMagIn) { try { window.soundEngine.playMagIn(); } catch (e) {} }
              this._syncActiveContainerToNet();
              this.renderLootModal(player);
            } else {
              this._showSocialToast('No Weapon Backpack slot — press [X/Square] to equip weapon.');
            }
            return true;
          }
          if (player.addToBackpack(item.id, item.qty, { mods: item.mods || null, mag: item.mag, rarityOverride: item.rarityOverride || null })) {
            this.activeLootSource.items.splice(idx, 1);
            if (window.soundEngine && window.soundEngine.playClick) { try { window.soundEngine.playClick(); } catch (e) {} }
            this._syncActiveContainerToNet();
            this.renderLootModal(player);
          } else {
            this._showSocialToast('Backpack full!');
          }
          return true;
        }

        // Enemy Operator slot -> Quick Stow into Backpack / Weapon Backpack / Cash / Plates
        if (isEnemyOpCard && opKey && this.activeLootSource.operatorEquipment) {
          const eq = this.activeLootSource.operatorEquipment;
          if (eq.revealedSlots && !eq.revealedSlots[opKey]) return true;
          if ((opKey === 'primary' || opKey === 'secondary') && eq[opKey]) {
            if (player.hasWeaponBackpack && player.hasWeaponBackpack()) {
              const prevBagWpn = player.backpackWeapon ? player.backpackWeapon.id : null;
              const prevBagMods = player.backpackWeapon ? (player.backpackWeapon.mods || {}) : {};
              const prevBagRar = player.backpackWeapon ? (player.backpackWeapon.rarityOverride || null) : null;
              player.backpackWeapon = { id: eq[opKey], mods: eq[opKey + 'Mods'] || {}, rarityOverride: eq[opKey + 'Rarity'] || null };
              eq[opKey] = prevBagWpn;
              eq[opKey + 'Mods'] = prevBagMods;
              eq[opKey + 'Rarity'] = prevBagRar;
              if (window.soundEngine && window.soundEngine.playMagIn) { try { window.soundEngine.playMagIn(); } catch (e) {} }
              this._syncActiveContainerToNet();
              this.renderLootModal(player);
            } else {
              this._showSocialToast('No Weapon Backpack slot — press [X/Square] to equip weapon.');
            }
            return true;
          }
          sel.click();
          return true;
        }

        // Player Backpack item -> Quick Stow / Transfer into Container
        if (isBackpackSlot) {
          const idx = parseInt(sel.dataset.idx, 10);
          const item = player.backpack[idx];
          if (item) {
            this.activeLootSource.items.push({
              id: item.id,
              qty: item.qty,
              mods: item.mods || null,
              mag: item.mag,
              rarityOverride: item.rarityOverride || null,
              revealed: true
            });
            player.backpack.splice(idx, 1);
            if (window.soundEngine && window.soundEngine.playClick) { try { window.soundEngine.playClick(); } catch (e) {} }
            this._syncActiveContainerToNet();
            this.renderLootModal(player);
          }
          return true;
        }

        // Player Backpack Weapon -> Transfer to Container
        if (isBagWpnSlot && player.backpackWeapon) {
          this.activeLootSource.items.push({
            id: player.backpackWeapon.id, qty: 1,
            mods: player.backpackWeapon.mods || {},
            mag: player.backpackWeapon.mag,
            rarityOverride: player.backpackWeapon.rarityOverride || null,
            revealed: true
          });
          player.backpackWeapon = null;
          this._syncActiveContainerToNet();
          this.renderLootModal(player);
          return true;
        }

        // Player Operator slot -> Quick Stow into Backpack (or Weapon Bag for Primary/Secondary)
        if (isPlayerOpCard && opKey) {
          this._stowPlayerOperatorSlot(player, opKey, 'backpack');
          this.renderLootModal(player);
          return true;
        }
      } else {
        // JUST the Backpack Inventory (no container open): A/Cross drops item, or 1 from stack if stackable!
        if (isBackpackSlot) {
          const idx = parseInt(sel.dataset.idx, 10);
          const item = player.backpack[idx];
          const def = item && GAME_DATA.ITEMS[item.id];
          if (item && def) {
            if (def.stackable && item.qty > 1) {
              item.qty -= 1;
              if (typeof this.onDropItem === 'function') {
                this.onDropItem({ id: item.id, qty: 1 });
              }
            } else {
              const removed = player.backpack.splice(idx, 1)[0];
              if (removed && typeof this.onDropItem === 'function') {
                this.onDropItem(removed);
              }
            }
            if (window.soundEngine && window.soundEngine.playClick) { try { window.soundEngine.playClick(); } catch (e) {} }
            this.renderLootModal(player);
          }
          return true;
        }

        if (isBagWpnSlot && player.backpackWeapon) {
          const removed = player.backpackWeapon;
          player.backpackWeapon = null;
          if (typeof this.onDropItem === 'function') {
            this.onDropItem({ id: removed.id, qty: 1, mods: removed.mods, mag: removed.mag, rarityOverride: removed.rarityOverride || null });
          }
          this.renderLootModal(player);
          return true;
        }

        if (isPlayerOpCard && opKey) {
          this._stowPlayerOperatorSlot(player, opKey, 'ground');
          this.renderLootModal(player);
          return true;
        }
      }
    }

    return false;
  }

  _getOperatorSlotOrder() {
    return ['cash', 'plates', 'dogtag', 'headgear', 'selfRevive', 'primary', 'armor', 'secondary', 'tactical', 'lethal', 'backpack', 'fieldUpgrade', 'killstreak', 'melee'];
  }

  _isOperatorSlotOccupied(eq, key) {
    if (!eq) return false;
    if (key === 'cash') return (eq.cash || 0) > 0;
    if (key === 'plates') return (eq.plates || 0) > 0;
    return !!eq[key];
  }

  _getOperatorSlotRarity(eq, key) {
    if (key === 'cash') return 'legendary';
    if (key === 'plates' || key === 'dogtag') return 'rare';
    const def = eq && eq[key] ? GAME_DATA.ITEMS[eq[key]] : null;
    return (def && def.rarity) || 'common';
  }

  _getNextUnrevealedOperatorSlot(eq) {
    if (!eq) return null;
    if (!eq.revealedSlots) eq.revealedSlots = {};
    for (const key of this._getOperatorSlotOrder()) {
      if (this._isOperatorSlotOccupied(eq, key) && !eq.revealedSlots[key]) {
        return key;
      }
    }
    return null;
  }

  updateSearchReveal(dt) {
    if (!this.activeLootSource || !this._lootPlayer) return;
    const modal = document.getElementById('loot-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    // 0. Process any revealed items whose 0.5s post-reveal delay has elapsed for auto-looting!
    const now = performance.now();
    const items = this.activeLootSource.items;
    const eq = this.activeLootSource.operatorEquipment;
    let readyForAutoLoot = false;
    if (Array.isArray(items)) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it && it.revealed !== false && it._autoLootAt && now >= it._autoLootAt) {
          delete it._autoLootAt;
          readyForAutoLoot = true;
        }
      }
    }
    if (eq && eq._platesAutoLootAt && now >= eq._platesAutoLootAt) {
      delete eq._platesAutoLootAt;
      readyForAutoLoot = true;
    }
    if (readyForAutoLoot && this.autoLootExistingStacks(this._lootPlayer)) {
      this.renderLootModal(this._lootPlayer);
    }

    // 1. Reveal container / backpack grid items one at a time
    const nextIdx = items.findIndex(it => it && it.revealed === false);
    if (nextIdx !== -1) {
      const item = items[nextIdx];
      const def = GAME_DATA.ITEMS[item.id];
      const rarKey = item.rarityOverride || (def && def.rarity) || 'common';
      const rarInfo = (GAME_DATA.RARITIES && GAME_DATA.RARITIES[rarKey]) || { revealTime: 0.45 };
      // Common & Rare weapons reveal noticeably faster!
      let duration = rarInfo.revealTime || 0.45;
      if (def && def.type === 'weapon') {
        if (rarKey === 'common') duration = 0.35;
        else if (rarKey === 'rare') duration = 0.52;
      }

      this._searchRevealProgress += dt / duration;

      const ring = document.querySelector(`#loot-container-items .inv-slot[data-idx="${nextIdx}"] .reveal-ring-fg`);
      if (ring) {
        const pct = Math.min(1, this._searchRevealProgress);
        ring.style.strokeDashoffset = (100.5 * (1 - pct)).toFixed(1);
      }

      if (this._searchRevealProgress >= 1) {
        item.revealed = true;
        item._autoLootAt = performance.now() + 500; // 0.5s delay before auto-looting newly revealed item
        this._searchRevealProgress = 0;
        if (window.soundEngine && window.soundEngine.playClick) {
          try { window.soundEngine.playClick(); } catch (e) {}
        }
        this.renderLootModal(this._lootPlayer);
      }
      return;
    }

    // 2. Reveal unsearched Enemy Operator Equipment slots one at a time!
    const nextKey = this._getNextUnrevealedOperatorSlot(eq);
    if (!nextKey) return;

    const rarKey = this._getOperatorSlotRarity(eq, nextKey);
    const rarInfo = (GAME_DATA.RARITIES && GAME_DATA.RARITIES[rarKey]) || { revealTime: 0.45 };
    // Operator Cash slot & common/rare equipped weapons reveal much faster!
    let duration = rarInfo.revealTime || 0.45;
    if (nextKey === 'cash') {
      duration = 0.25;
    } else if (nextKey === 'primary' || nextKey === 'secondary') {
      if (rarKey === 'common') duration = 0.35;
      else if (rarKey === 'rare') duration = 0.52;
    }

    this._searchRevealProgress += dt / duration;

    const ring = document.querySelector(`#loot-enemy-op-slots .op-slot-card[data-op-key="${nextKey}"] .reveal-ring-fg`);
    if (ring) {
      const pct = Math.min(1, this._searchRevealProgress);
      ring.style.strokeDashoffset = (100.5 * (1 - pct)).toFixed(1);
    }

    if (this._searchRevealProgress >= 1) {
      eq.revealedSlots[nextKey] = true;
      if (nextKey === 'plates') eq._platesAutoLootAt = performance.now() + 500;
      this._searchRevealProgress = 0;
      if (window.soundEngine && window.soundEngine.playClick) {
        try { window.soundEngine.playClick(); } catch (e) {}
      }
      this.renderLootModal(this._lootPlayer);
    }
  }

  hideItemPopout() {
    this._hoveredSlot = null;
    const pop = document.getElementById('item-action-popout');
    if (pop) pop.classList.add('hidden');
  }

  showItemPopout(slotEl, context, item, idx, opts = {}) {
    const pop = document.getElementById('item-action-popout');
    if (!pop || !item || !slotEl) return;
    const def = GAME_DATA.ITEMS[item.id];
    if (!def) return;

    const inputMode = opts.inputMode || 'mouse';
    const mode = opts.mode || (inputMode === 'gamepad' ? 'all' : 'details');
    const isGamepad = inputMode === 'gamepad';

    this._hoveredSlot = { context, item, idx, el: slotEl, inputMode, mode };
    const rarKey = item.rarityOverride || def.rarity || 'common';
    pop.dataset.rarity = rarKey;
    const rarInfo = (GAME_DATA.RARITIES && GAME_DATA.RARITIES[rarKey]) || { label: rarKey.toUpperCase(), color: '#69f0ae' };
    const hasContainer = !!this.activeLootSource;
    const canSplit = def.stackable && item.qty > 1;
    const badge = (btn) => (isGamepad ? `<span class="gp-btn-badge">${btn}</span> ` : '');

    let actionsHtml = '';
    const hasWpnBag = !!(this._lootPlayer && this._lootPlayer.hasWeaponBackpack && this._lootPlayer.hasWeaponBackpack());
    if (context === 'player_op') {
      actionsHtml += `<button class="pop-act" data-act="stow_op">Stow in Backpack</button>`;
      if (hasContainer) {
        actionsHtml += `<button class="pop-act" data-act="op_to_container">Transfer to Container</button>`;
      }
      actionsHtml += `<button class="pop-act danger" data-act="drop_op">Drop to Ground</button>`;
    } else if (def.type === 'weapon') {
      actionsHtml += `<button class="pop-act" data-act="stage_weapon">${badge('X')}Quick-Equip / Swap</button>`;
      actionsHtml += `<button class="pop-act" data-act="equip_primary">Equip Primary</button>`;
      actionsHtml += `<button class="pop-act" data-act="equip_secondary">Equip Secondary</button>`;
      if (context !== 'backpack_weapon' && hasWpnBag) {
        actionsHtml += `<button class="pop-act" data-act="equip_backpack_weapon">${badge('A')}Stow in Weapon Slot</button>`;
      }
      if ((context === 'backpack' || context === 'backpack_weapon') && hasContainer) {
        actionsHtml += `<button class="pop-act" data-act="quick">${badge('A')}Quick Stow to Container</button>`;
      }
      if (context === 'backpack' || context === 'backpack_weapon') {
        actionsHtml += `<button class="pop-act danger" data-act="drop">${badge(hasContainer ? 'R3' : 'A')}Drop to Ground</button>`;
      }
    } else {
      if (mode === 'all' || mode === 'details' || mode === 'context') {
        if (def.type === 'armor' || def.type === 'backpack' || def.type === 'field_upgrade' || def.type === 'killstreak' || def.type === 'self_revive' || def.type === 'headgear' || def.type === 'melee' || def.type === 'lethal' || def.type === 'tactical') {
          actionsHtml += `<button class="pop-act" data-act="equip_gear">${badge('X')}Quick-Equip / Swap</button>`;
        }

        if (context === 'container') {
          actionsHtml += `<button class="pop-act" data-act="quick">${badge('A')}Quick Stow to Pack</button>`;
        } else if (context === 'backpack') {
          if (hasContainer) {
            actionsHtml += `<button class="pop-act" data-act="quick">${badge('A')}Quick Stow to Container</button>`;
          }
          if (def.type === 'plate' || def.type === 'med') {
            actionsHtml += `<button class="pop-act" data-act="use_item">${badge('X')}Use / Apply</button>`;
          }
        }
      }
      if (canSplit) {
        actionsHtml += `<button class="pop-act" data-act="split">${badge('Y')}Split Stack</button>`;
      }
      if (context === 'backpack') {
        if (!hasContainer && canSplit) {
          actionsHtml += `<button class="pop-act danger" data-act="drop">${badge('A')}Drop 1 · ${badge('R3')}Drop Stack</button>`;
        } else {
          actionsHtml += `<button class="pop-act danger" data-act="drop">${badge(hasContainer ? 'R3' : 'A')}Drop${canSplit ? ' Stack' : ' to Ground'}</button>`;
        }
      }
    }

    const descHtml = (mode !== 'context' && def.desc)
      ? `<div class="pop-desc">${def.desc}</div>`
      : '';
    const emptyCtxHtml = (mode === 'context' && !actionsHtml)
      ? `<div class="pop-desc" style="margin-bottom:0;">No split or drop options for this item.</div>`
      : '';

    pop.innerHTML = `
      <div class="pop-title" style="color:${rarInfo.color}">${def.name}${item.qty > 1 ? ' x' + item.qty : ''}</div>
      <div class="pop-meta">${rarInfo.label} · ₽${(def.value * item.qty).toLocaleString()}</div>
      ${descHtml}
      ${actionsHtml ? `<div class="pop-actions">${actionsHtml}</div>` : emptyCtxHtml}
    `;
    pop.querySelectorAll('.pop-act').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleSlotAction(btn.dataset.act);
      });
    });

    // Position popout next to the slot (clamp inside viewport accounting for dynamic --inv-scale)
    pop.classList.remove('hidden');
    const invScale = this._currentInvScale || 1;
    const rect = slotEl.getBoundingClientRect();
    const popW = Math.round(215 * invScale);
    let left = rect.right + 8;
    if (left + popW > window.innerWidth - 10) {
      left = Math.max(10, rect.left - popW - 8);
    }
    const popH = Math.round((pop.offsetHeight || 140) * invScale);
    const top = Math.min(window.innerHeight - popH - 10, Math.max(12, rect.top));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;

    // Dismiss popup when clicking outside on mouse
    if (!this._popoutDismissBound) {
      this._popoutDismissBound = true;
      document.addEventListener('mousedown', (e) => {
        const popEl = document.getElementById('item-action-popout');
        if (!popEl || popEl.classList.contains('hidden')) return;
        if (popEl.contains(e.target) || (e.target.closest && (e.target.closest('.inv-slot') || e.target.closest('.op-slot-card')))) return;
        this.hideItemPopout();
      });
    }
  }

  _swapGearWithPlayer(player, itemId) {
    const def = GAME_DATA.ITEMS[itemId];
    if (!def) return null;
    if (def.type === 'armor') {
      const prev = player.armorId;
      const perPlate = (GAME_DATA.OPERATOR_STATS && GAME_DATA.OPERATOR_STATS.plateArmor) || 35;
      player.armorId = itemId;
      player.plateSlots = def.plateSlots || 2;
      player.maxArmor = player.plateSlots * perPlate;
      player.armor = Math.min(player.maxArmor, Math.max(player.armor, player.maxArmor));
      return prev;
    }
    if (def.type === 'backpack') {
      const prev = player.backpackId;
      player.backpackId = itemId;
      player.backpackMaxSlots = def.slots || def.bagSlots || 8;
      if (!def.weaponSlot && player.backpackWeapon) {
        if (typeof this.onDropItem === 'function') {
          this.onDropItem(player.backpackWeapon);
        }
        player.backpackWeapon = null;
      }
      while (player.backpack.length > player.backpackMaxSlots) {
        const extra = player.backpack.pop();
        if (extra && typeof this.onDropItem === 'function') {
          this.onDropItem(extra);
        }
      }
      return prev;
    }
    if (def.type === 'field_upgrade') {
      const prev = player.fieldUpgrade;
      player.fieldUpgrade = itemId;
      return prev;
    }
    if (def.type === 'killstreak') {
      const prev = player.killstreak;
      player.killstreak = itemId;
      return prev;
    }
    if (def.type === 'self_revive') {
      const prev = player.selfRevive;
      player.selfRevive = itemId;
      return prev;
    }
    if (def.type === 'headgear') {
      const prev = player.headgear;
      player.headgear = itemId;
      return prev;
    }
    if (def.type === 'melee') {
      const prev = player.melee;
      player.melee = itemId;
      return prev;
    }
    return null;
  }

  _swapThrowableWithPlayer(player, item) {
    const def = GAME_DATA.ITEMS[item.id];
    if (!def || (def.type !== 'lethal' && def.type !== 'tactical')) return { consumed: false, returned: null };
    const idKey = def.type === 'lethal' ? 'lethal' : 'tactical';
    const qtyKey = def.type === 'lethal' ? 'lethalQty' : 'tacticalQty';
    const curId = player[idKey];
    const curQty = player[qtyKey] || 0;

    if (curId === item.id) {
      // Same grenade type -> top up active slot up to 4
      const space = Math.max(0, 4 - curQty);
      if (space <= 0) return { consumed: false, returned: null };
      const move = Math.min(space, item.qty);
      player[qtyKey] = curQty + move;
      const leftover = item.qty - move;
      return {
        consumed: true,
        returned: leftover > 0 ? { id: item.id, qty: leftover, revealed: true } : null
      };
    }

    // Different grenade type -> swap active slot cleanly with backpack/container!
    const move = Math.min(4, item.qty);
    player[idKey] = item.id;
    player[qtyKey] = move;
    const prevItem = (curId && curQty > 0) ? { id: curId, qty: curQty, revealed: true } : null;
    const leftover = item.qty - move;
    return {
      consumed: true,
      returned: prevItem,
      extra: leftover > 0 ? { id: item.id, qty: leftover, revealed: true } : null
    };
  }

  _getPlayerOperatorSlotItem(player, k) {
    if (!player) return null;
    if (k === 'killstreak' && player.killstreak) return { id: player.killstreak, qty: 1 };
    if (k === 'armor' && player.armorId) return { id: player.armorId, qty: 1 };
    if (k === 'backpack' && player.backpackId) return { id: player.backpackId, qty: 1 };
    if (k === 'fieldUpgrade' && player.fieldUpgrade) return { id: player.fieldUpgrade, qty: 1 };
    if (k === 'selfRevive' && player.selfRevive) return { id: player.selfRevive, qty: 1 };
    if (k === 'headgear' && player.headgear) return { id: player.headgear, qty: 1 };
    if (k === 'melee' && player.melee) return { id: player.melee, qty: 1 };
    if (k === 'tactical' && player.tactical && (player.tacticalQty || 0) > 0) return { id: player.tactical, qty: player.tacticalQty };
    if (k === 'lethal' && player.lethal && (player.lethalQty || 0) > 0) return { id: player.lethal, qty: player.lethalQty };
    if (k === 'plates' && (player.plates || 0) > 0) return { id: 'armor_plate', qty: player.plates };
    return null;
  }

  _stowPlayerOperatorSlot(player, k, dest = 'backpack') {
    const slotItem = this._getPlayerOperatorSlotItem(player, k);
    if (!slotItem) return false;

    const placeItem = (itemObj) => {
      if (dest === 'container' && this.activeLootSource && Array.isArray(this.activeLootSource.items)) {
        this.activeLootSource.items.push({ id: itemObj.id, qty: itemObj.qty || 1, revealed: true });
        return true;
      }
      if (dest === 'ground') {
        if (typeof this.onDropItem === 'function') this.onDropItem({ id: itemObj.id, qty: itemObj.qty || 1 });
        return true;
      }
      // dest === 'backpack'
      return !!player.addToBackpack(itemObj.id, itemObj.qty || 1, { forceBag: true });
    };

    if (k === 'backpack') {
      // Unequipping your equipped backpack shrinks capacity to 4 pocket slots.
      // If stowing the bag itself into pockets, require at least 1 free pocket slot (< 4 items).
      if (dest === 'backpack' && player.backpack.length >= 4) {
        this._showSocialToast('Free a pocket slot (need < 4 items) before stowing your equipped backpack.');
        return false;
      }
      const oldBagId = player.backpackId;
      player.backpackId = null;
      player.backpackMaxSlots = 4;
      if (player.backpackWeapon) {
        if (typeof this.onDropItem === 'function') this.onDropItem(player.backpackWeapon);
        player.backpackWeapon = null;
      }
      while (player.backpack.length > 4) {
        const extra = player.backpack.pop();
        if (extra && typeof this.onDropItem === 'function') this.onDropItem(extra);
      }
      placeItem({ id: oldBagId, qty: 1 });
      return true;
    }

    if (!placeItem(slotItem)) return false;

    if (k === 'killstreak') {
      player.killstreak = null;
    } else if (k === 'armor') {
      player.armorId = null;
      player.plateSlots = 0;
      player.maxArmor = 0;
      player.armor = 0;
    } else if (k === 'fieldUpgrade') {
      player.fieldUpgrade = null;
    } else if (k === 'selfRevive') {
      player.selfRevive = null;
    } else if (k === 'headgear') {
      player.headgear = null;
    } else if (k === 'melee') {
      player.melee = null;
      if (player.activeSlot === 'melee') {
        player.activeSlot = player.slots.primary ? 'primary' : (player.slots.secondary ? 'secondary' : 'melee');
        if (player._equipCurrentWeapon) player._equipCurrentWeapon();
      }
    } else if (k === 'tactical') {
      player.tactical = null;
      player.tacticalQty = 0;
    } else if (k === 'lethal') {
      player.lethal = null;
      player.lethalQty = 0;
    } else if (k === 'plates') {
      player.plates = 0;
    }
    return true;
  }

  handleSlotAction(action) {
    if (!this._hoveredSlot || !this._lootPlayer) return;
    const { context, item, idx } = this._hoveredSlot;
    const player = this._lootPlayer;

    if (context === 'player_op') {
      if (action === 'stow_op') this._stowPlayerOperatorSlot(player, idx, 'backpack');
      else if (action === 'op_to_container') {
        this._stowPlayerOperatorSlot(player, idx, 'container');
        this._syncActiveContainerToNet();
      }
      else if (action === 'drop_op') this._stowPlayerOperatorSlot(player, idx, 'ground');
      this.hideItemPopout();
      this.renderLootModal(player);
      return;
    }

    const def = GAME_DATA.ITEMS[item.id];
    if (!def) return;

    const sourceList = (context === 'container' && this.activeLootSource) ? this.activeLootSource.items : player.backpack;

    if (action === 'stage_weapon' && def.type === 'weapon') {
      if (context === 'container' && item.revealed === false) return;
      this.hideItemPopout();
      this.openRaidWeaponStaging(player, item, {
        sourceLabel: context === 'backpack_weapon' ? 'BACKPACK WEAPON SLOT' : 'CONTAINER',
        onComplete: (res, targetSlotKey) => {
          if (context === 'backpack_weapon') {
            if (targetSlotKey !== 'backpackWeapon') {
              player.backpackWeapon = res.prevId
                ? { id: res.prevId, mods: (res.prevSlotObj && res.prevSlotObj.mods) || {}, mag: res.prevSlotObj && res.prevSlotObj.mag, rarityOverride: (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null }
                : null;
            }
          } else {
            sourceList.splice(idx, 1);
            if (res.prevId) {
              sourceList.splice(idx, 0, {
                id: res.prevId,
                qty: 1,
                mods: (res.prevSlotObj && res.prevSlotObj.mods) || {},
                mag: res.prevSlotObj && res.prevSlotObj.mag,
                rarityOverride: (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null,
                revealed: true
              });
            }
            if (context === 'container') this._syncActiveContainerToNet();
          }
        }
      });
      return;
    }

    if (action === 'equip_primary' || action === 'equip_secondary' || action === 'equip_backpack_weapon') {
      if (context === 'container' && item.revealed === false) return;
      const slotName = action === 'equip_primary' ? 'primary' : (action === 'equip_secondary' ? 'secondary' : 'backpackWeapon');
      const res = player.equipWeaponInRaid(item.id, slotName, { mods: item.mods, mag: item.mag, rarityOverride: item.rarityOverride || null });
      if (res.equipped) {
        if (context === 'backpack_weapon') {
          if (slotName !== 'backpackWeapon') {
            player.backpackWeapon = res.prevId
              ? { id: res.prevId, mods: (res.prevSlotObj && res.prevSlotObj.mods) || {}, mag: res.prevSlotObj && res.prevSlotObj.mag, rarityOverride: (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null }
              : null;
          }
        } else {
          sourceList.splice(idx, 1);
          if (res.prevId) {
            sourceList.splice(idx, 0, {
              id: res.prevId,
              qty: 1,
              mods: (res.prevSlotObj && res.prevSlotObj.mods) || {},
              mag: res.prevSlotObj && res.prevSlotObj.mag,
              rarityOverride: (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null,
              revealed: true
            });
          }
        }
      }
    } else if (action === 'equip_gear') {
      if (context === 'container' && item.revealed === false) return;
      if (def.type === 'lethal' || def.type === 'tactical') {
        const res = this._swapThrowableWithPlayer(player, item);
        if (res.consumed) {
          sourceList.splice(idx, 1);
          if (res.returned) sourceList.splice(idx, 0, res.returned);
          if (res.extra) sourceList.push(res.extra);
        }
      } else {
        const prev = this._swapGearWithPlayer(player, item.id);
        sourceList.splice(idx, 1);
        if (prev) {
          sourceList.splice(idx, 0, { id: prev, qty: 1, revealed: true });
        }
      }
    } else if (action === 'use_item' && context === 'backpack') {
      if (def.type === 'plate' && player.plates < 6) {
        const move = Math.min(6 - player.plates, item.qty);
        player.plates += move;
        item.qty -= move;
        if (item.qty <= 0) player.backpack.splice(idx, 1);
      } else if (def.type === 'med' && item.id === 'medkit') {
        if (player.startMedkit()) {
          this.closeLootModal();
          return;
        }
      } else if (def.type === 'med' && (item.id === 'bandage' || item.id === 'painkillers')) {
        if (player.useTemporaryMed && player.useTemporaryMed(item.id)) {
          this.showCenterToast(
            item.id === 'painkillers' ? 'PAINKILLERS ACTIVE (45s TEMP HP)' : 'BANDAGE APPLIED (25s TEMP HP)',
            '#ffd54f'
          );
          this.renderLootModal(player);
          return;
        }
      }
    } else if (action === 'quick') {
      if (context === 'container' && this.activeLootSource) {
        if (item.revealed === false) return;
        if (def.type === 'weapon') {
          this.hideItemPopout();
          this.openRaidWeaponStaging(player, item, {
            sourceLabel: this.activeLootSource.title || 'CONTAINER',
            onComplete: (res) => {
              this.activeLootSource.items.splice(idx, 1);
              if (res.prevId) {
                this.activeLootSource.items.splice(idx, 0, {
                  id: res.prevId,
                  qty: 1,
                  mods: (res.prevSlotObj && res.prevSlotObj.mods) || {},
                  mag: res.prevSlotObj && res.prevSlotObj.mag,
                  rarityOverride: (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null,
                  revealed: true
                });
              }
              this._syncActiveContainerToNet();
            }
          });
          return;
        }
        if (player.addToBackpack(item.id, item.qty, { mods: item.mods || null, mag: item.mag, rarityOverride: item.rarityOverride || null })) {
          this.activeLootSource.items.splice(idx, 1);
        }
      } else if (context === 'backpack_weapon') {
        if (this.activeLootSource && player.backpackWeapon) {
          this.activeLootSource.items.push({
            id: player.backpackWeapon.id,
            qty: 1,
            mods: player.backpackWeapon.mods || {},
            mag: player.backpackWeapon.mag,
            rarityOverride: player.backpackWeapon.rarityOverride || null,
            revealed: true
          });
          player.backpackWeapon = null;
        }
      } else if (context === 'backpack') {
        if (this.activeLootSource) {
          this.activeLootSource.items.push({
            id: item.id,
            qty: item.qty,
            mods: item.mods || null,
            mag: item.mag,
            rarityOverride: item.rarityOverride || null,
            revealed: true
          });
          player.backpack.splice(idx, 1);
        } else if (def.type === 'plate' && player.plates < 6) {
          const move = Math.min(6 - player.plates, item.qty);
          player.plates += move;
          item.qty -= move;
          if (item.qty <= 0) player.backpack.splice(idx, 1);
        } else if (def.type === 'med' && item.id === 'medkit') {
          if (player.startMedkit()) {
            this.closeLootModal();
            return;
          }
        } else if (def.type === 'med' && (item.id === 'bandage' || item.id === 'painkillers')) {
          if (player.useTemporaryMed && player.useTemporaryMed(item.id)) {
            this.showCenterToast(
              item.id === 'painkillers' ? 'PAINKILLERS ACTIVE (45s TEMP HP)' : 'BANDAGE APPLIED (25s TEMP HP)',
              '#ffd54f'
            );
            this.renderLootModal(player);
            return;
          }
        } else if (def.type === 'lethal' || def.type === 'tactical') {
          const res = this._swapThrowableWithPlayer(player, item);
          if (res.consumed) {
            player.backpack.splice(idx, 1);
            if (res.returned) player.backpack.splice(idx, 0, res.returned);
            if (res.extra) player.backpack.push(res.extra);
          }
        } else if (def.type === 'armor' || def.type === 'backpack' || def.type === 'field_upgrade' || def.type === 'killstreak' || def.type === 'self_revive' || def.type === 'headgear' || def.type === 'melee') {
          const prev = this._swapGearWithPlayer(player, item.id);
          player.backpack.splice(idx, 1);
          if (prev) player.backpack.splice(idx, 0, { id: prev, qty: 1 });
        }
      }
    } else if (action === 'split' && def.stackable && item.qty > 1) {
      const list = context === 'container' && this.activeLootSource ? this.activeLootSource.items : player.backpack;
      if (context === 'backpack' && list.length >= (player.backpackMaxSlots || 8)) {
        this.hideItemPopout();
        return;
      }
      const half = Math.floor(item.qty / 2);
      item.qty -= half;
      list.splice(idx + 1, 0, { id: item.id, qty: half, revealed: true });
    } else if (action === 'drop') {
      if (context === 'backpack_weapon' && player.backpackWeapon) {
        const removed = player.backpackWeapon;
        player.backpackWeapon = null;
        if (typeof this.onDropItem === 'function') {
          this.onDropItem({ id: removed.id, qty: 1, mods: removed.mods, mag: removed.mag, rarityOverride: removed.rarityOverride || null });
        }
      } else if (context === 'backpack') {
        const removed = player.backpack.splice(idx, 1)[0];
        if (removed && typeof this.onDropItem === 'function') {
          this.onDropItem(removed);
        }
      }
    }

    if (context === 'container' || (action === 'quick' && this.activeLootSource)) {
      this._syncActiveContainerToNet();
    }
    this.hideItemPopout();
    this.renderLootModal(player);
  }

  _renderOperatorTacticalGrid(containerEl, data, onSlotClick = null, tooltipText = '', revealConfig = null, onSlotContextMenu = null) {
    if (!containerEl) return;
    const itemDef = (id) => (id && GAME_DATA.ITEMS[id]) ? GAME_DATA.ITEMS[id] : null;
    const card = (opts) => {
      const def = opts.id ? itemDef(opts.id) : null;
      const hasVal = !!(def || opts.hasValue);
      const posAttr = opts.posStyle ? ` style="${opts.posStyle}"` : '';

      // If searching an unsearched enemy operator, hide unrevealed occupied slots behind circular search reveal!
      if (revealConfig && hasVal && !(revealConfig.revealedMap && revealConfig.revealedMap[opts.key])) {
        const isSearchingNow = revealConfig.activeKey === opts.key;
        const cls = [
          'op-slot-card',
          'searching',
          opts.span ? `span-${opts.span}` : '',
          opts.spine ? 'spine-slot' : ''
        ].filter(Boolean).join(' ');
        const inner = isSearchingNow
          ? `<div class="reveal-ring-wrap">
               <svg viewBox="0 0 36 36"><circle class="reveal-ring-bg" cx="18" cy="18" r="16"/><circle class="reveal-ring-fg" cx="18" cy="18" r="16" stroke-dasharray="100.5" stroke-dashoffset="100.5"/></svg>
               <span class="reveal-q">?</span>
             </div>`
          : `<span class="reveal-q queued">?</span>`;
        return `<div class="${cls}" data-op-key="${opts.key}" data-unrevealed="1"${posAttr}>${inner}</div>`;
      }

      const mods = opts.mods || (def && def.type === 'weapon' && this.profile && this.profile.weaponMods && this.profile.weaponMods[def.id]) || {};
      const rar = opts.rarity || this._resolveItemRarity({ id: opts.id, mods }, def);
      const val = opts.text !== undefined ? opts.text : (def ? def.name : 'EMPTY');
      const iconId = opts.iconId !== undefined ? opts.iconId : opts.id;
      const isCashCard = opts.key === 'cash';
      const showIcon = !isCashCard && !!(hasVal && iconId && window.itemIcons && typeof window.itemIcons.getIcon === 'function');
      const iconHtml = showIcon
        ? this._renderItemIconHTML(iconId, def, { wide: opts.span === 2, cls: 'op-slot-icon', mods })
        : '';
      const isWideWeapon = !!(hasVal && def && def.type === 'weapon' && opts.span === 2);
      let pipsHtml = '';
      let ammoHtml = '';
      let catGlyphHtml = '';
      let plateBarsHtml = '';
      if (isWideWeapon) {
        const attCount = this._getWeaponModCount({ id: opts.id, mods }, def);
        if (attCount > 0) {
          pipsHtml = `<span class="slot-pips">${'<span class="slot-pip"></span>'.repeat(Math.min(5, attCount))}</span>`;
        }
        const magCount = (opts.mag !== undefined) ? opts.mag : ((def && def.magSize) || 0);
        ammoHtml = `<span class="slot-ammo"><span class="slot-ammo-bars" aria-hidden="true">≡</span>${magCount}</span>`;
      } else if (!isCashCard && hasVal && def) {
        catGlyphHtml = `<span class="slot-cat-glyph">${this._getCategoryGlyphSVG(def)}</span>`;
        if (def.type === 'armor') {
          const plateCount = Math.max(1, Math.min(3, def.plateSlots || (def.maxArmor ? Math.round(def.maxArmor / 50) : 1)));
          plateBarsHtml = `<span class="slot-plate-bars">${'<span class="slot-plate-bar"></span>'.repeat(plateCount)}</span>`;
        }
      } else if (!isCashCard && hasVal && iconId === 'armor_plate') {
        const plDef = GAME_DATA.ITEMS.armor_plate || { type: 'plate', id: 'armor_plate' };
        catGlyphHtml = `<span class="slot-cat-glyph">${this._getCategoryGlyphSVG(plDef)}</span>`;
      }
      const cashHtml = (isCashCard && hasVal)
        ? `<span class="empty-slot-glyph" style="opacity:0.95;color:#f3f6f4;">${this._getEmptySlotGlyphSVG('cash')}</span><span class="slot-cash-amt">${opts.badge || this._formatShortValue(opts.value || 0)}</span>`
        : '';
      const qtyNum = opts.qty || 0;
      const qtyHtml = (!isCashCard && hasVal && (qtyNum > 1 || (opts.forceQty && qtyNum > 0)))
        ? `<span class="slot-qty">${qtyNum}</span>`
        : '';
      const emptyGlyphHtml = (!hasVal)
        ? `<span class="empty-slot-glyph">${this._getEmptySlotGlyphSVG(opts.emptyKey || opts.key)}</span>`
        : '';
      const badgeText = (!isCashCard) ? (opts.sub || (showIcon && opts.badge ? opts.badge : '')) : '';
      const sub = badgeText ? `<span class="op-slot-sub">${badgeText}</span>` : '';
      const valHtml = (showIcon || !hasVal || isCashCard) ? '' : `<span class="op-slot-val">${val}</span>`;
      const cls = [
        'op-slot-card',
        hasVal ? `rarity-${rar}` : 'empty-slot-card',
        showIcon ? 'has-icon' : '',
        opts.span ? `span-${opts.span}` : '',
        opts.spine ? 'spine-slot' : ''
      ].filter(Boolean).join(' ');
      const clickable = !!((onSlotClick || onSlotContextMenu) && hasVal && opts.clickable !== false);
      const tipName = (def ? def.name : val) || 'Empty';
      const tip = clickable ? `${tipName} — ${tooltipText}` : tipName;
      const itemVal = opts.value !== undefined ? opts.value : (def ? (def.value || 0) * (opts.qty || 1) : 0);
      const priceStr = (hasVal && itemVal > 0 && opts.key !== 'cash') ? this._formatShortValue(itemVal) : '';
      return `<div class="${cls}" data-op-key="${opts.key}" title="${tip.replace(/"/g, '&quot;')}" style="${opts.posStyle || ''}cursor:${clickable ? 'pointer' : 'default'};">
        <div class="op-slot-top">
          <span class="op-slot-label">${opts.label}</span>
          ${priceStr ? `<span class="op-slot-price">${priceStr}</span>` : ''}
        </div>
        ${emptyGlyphHtml}
        ${cashHtml}
        ${iconHtml}
        ${valHtml}
        ${pipsHtml}
        ${ammoHtml}
        ${catGlyphHtml}
        ${plateBarsHtml}
        ${qtyHtml}
        ${sub}
      </div>`;
    };

    const pDef = itemDef(data.primary);
    const sDef = itemDef(data.secondary);
    const portraitUrl = (!revealConfig && window.itemIcons && typeof window.itemIcons.getOperatorPortrait === 'function')
      ? window.itemIcons.getOperatorPortrait()
      : null;
    const portraitHtml = portraitUrl
      ? `<img class="op-portrait-bg" src="${portraitUrl}" alt="" draggable="false" />`
      : '';

    containerEl.innerHTML = `
      <div class="op-tactical-grid">
        ${portraitHtml}
        <!-- Row 1: Cash (Top-Left) | Plates | Dogtag | Headgear | Self-Revive -->
        ${card({ key: 'cash', label: data.cashLabel || 'CASH', value: data.cash || 0, badge: (data.cash || 0) > 0 ? this._formatShortValue(data.cash) : '', hasValue: (data.cash || 0) > 0, rarity: 'legendary', emptyKey: 'cash', posStyle: 'grid-column:1;grid-row:1;' })}
        ${card({ key: 'plates', label: 'PLATES', iconId: 'armor_plate', value: (data.plates || 0) * ((GAME_DATA.ITEMS.armor_plate && GAME_DATA.ITEMS.armor_plate.value) || 400), qty: data.plates || 0, forceQty: true, text: `${data.plates || 0} / 6`, badge: `${data.plates || 0}/6`, hasValue: (data.plates || 0) > 0, rarity: 'common', emptyKey: 'plates', posStyle: 'grid-column:2;grid-row:1;' })}
        ${card({ key: 'dogtag', label: 'DOGTAG', id: data.dogtag, text: data.dogtagText || 'Operator Tag', hasValue: !!data.dogtag, rarity: 'rare', spine: true, posStyle: 'grid-column:3;grid-row:1;' })}
        ${card({ key: 'headgear', label: 'HEAD', id: data.headgear, text: itemDef(data.headgear) ? itemDef(data.headgear).name : 'MASK / NVG', emptyKey: 'headgear', posStyle: 'grid-column:4;grid-row:1;' })}
        ${card({ key: 'selfRevive', label: 'REVIVE', id: data.selfRevive, emptyKey: 'selfRevive', posStyle: 'grid-column:5;grid-row:1;' })}

        <!-- Row 2: PRIMARY (Cols 1-2) | VEST (Col 3) | SECONDARY (Cols 4-5) -->
        ${card({ key: 'primary', label: 'PRIMARY', id: data.primary, mods: data.primaryMods, mag: data.primaryMag !== undefined ? data.primaryMag : (pDef ? pDef.magSize : undefined), rarity: data.primaryRarity || undefined, sub: pDef && data.primaryMag !== undefined ? `${data.primaryMag} RDS` : '', span: 2, posStyle: 'grid-column:1 / span 2;grid-row:2;' })}
        ${card({ key: 'armor', label: 'VEST', id: data.armor, spine: true, emptyKey: 'armor', posStyle: 'grid-column:3;grid-row:2;' })}
        ${card({ key: 'secondary', label: 'SECONDARY', id: data.secondary, mods: data.secondaryMods, mag: data.secondaryMag !== undefined ? data.secondaryMag : (sDef ? sDef.magSize : undefined), rarity: data.secondaryRarity || undefined, sub: sDef && data.secondaryMag !== undefined ? `${data.secondaryMag} RDS` : '', span: 2, posStyle: 'grid-column:4 / span 2;grid-row:2;' })}

        <!-- Row 3: Tactical | Lethal | BACKPACK (Col 3) | Field Upgrade | Killstreak -->
        ${card({ key: 'tactical', label: 'TAC', id: data.tactical, qty: data.tacticalQty || 1, text: 'TACTICAL', badge: data.tacticalQty ? `x${data.tacticalQty}` : '', emptyKey: 'tactical', posStyle: 'grid-column:1;grid-row:3;' })}
        ${card({ key: 'lethal', label: 'LETH', id: data.lethal, qty: data.lethalQty || 1, text: 'LETHAL', badge: data.lethalQty ? `x${data.lethalQty}` : '', emptyKey: 'lethal', posStyle: 'grid-column:2;grid-row:3;' })}
        ${card({ key: 'backpack', label: 'PACK', id: data.backpack, spine: true, emptyKey: 'backpack', posStyle: 'grid-column:3;grid-row:3;' })}
        ${card({ key: 'fieldUpgrade', label: 'UPG', id: data.fieldUpgrade, emptyKey: 'fieldUpgrade', posStyle: 'grid-column:4;grid-row:3;' })}
        ${card({ key: 'killstreak', label: 'STRK', id: data.killstreak, emptyKey: 'killstreak', posStyle: 'grid-column:5;grid-row:3;' })}

        <!-- Row 4: [Cols 1-3 Empty] | MELEE (Cols 4-5) -->
        ${card({ key: 'melee', label: 'MELEE', id: data.melee, span: 2, emptyKey: 'melee', posStyle: 'grid-column:4 / span 2;grid-row:4;' })}
      </div>
    `;

    if (onSlotClick || onSlotContextMenu) {
      containerEl.querySelectorAll('.op-slot-card[data-op-key]').forEach((el) => {
        if (el.dataset.unrevealed === '1') return;
        if (onSlotClick) {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            onSlotClick(el.dataset.opKey, el);
          });
        }
        if (onSlotContextMenu) {
          el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onSlotContextMenu(el.dataset.opKey, el);
          });
        }
      });
    }
  }

  renderLootModal(player) {
    const cList = document.getElementById('loot-container-items');
    const bList = document.getElementById('loot-backpack-items');
    const cTitle = document.getElementById('loot-container-title');
    const opSlotsEl = document.getElementById('inv-op-slots');

    // Snapshot currently selected slot identity BEFORE rebuilding DOM so D-Pad selector stays locked to the exact item during reveals!
    let prevSel = null;
    if (this._selectedEl) {
      const sel = this._selectedEl;
      if (sel.classList && sel.classList.contains('backpack-weapon-slot')) {
        prevSel = { kind: 'bag_wpn' };
      } else if (sel.classList && sel.classList.contains('inv-slot') && sel.dataset) {
        const ctxName = sel.dataset.context || '';
        const idxNum = parseInt(sel.dataset.idx, 10);
        let itemRef = null;
        if (ctxName === 'container' && this.activeLootSource && Array.isArray(this.activeLootSource.items)) {
          itemRef = this.activeLootSource.items[idxNum] || null;
        } else if (ctxName === 'backpack' && player && Array.isArray(player.backpack)) {
          itemRef = player.backpack[idxNum] || null;
        }
        prevSel = { kind: 'inv', context: ctxName, idx: idxNum, itemRef };
      } else if (sel.classList && sel.classList.contains('op-slot-card') && sel.dataset) {
        const parentBox = sel.closest('#inv-op-slots, #loot-enemy-op-slots');
        const parentId = parentBox ? parentBox.id : '';
        const opKey = sel.dataset.opKey || sel.dataset.key || sel.dataset.slotKey || '';
        prevSel = { kind: 'op', parentId, opKey };
      }
    }

    // 1. Player Operator Equipment — Exact 5-Column Tactical Grid
    if (opSlotsEl) {
      const pSlot = (player.slots && player.slots.primary) || (player.weapons && player.weapons.primary);
      const sSlot = (player.slots && player.slots.secondary) || (player.weapons && player.weapons.secondary);
      const myCallsign = (this.profile && this.profile.social && this.profile.social.callsign) || 'OPERATOR';
      this._renderOperatorTacticalGrid(opSlotsEl, {
        cash: player.cash || 0,
        plates: player.plates || 0,
        dogtag: 'dogtag',
        dogtagText: myCallsign,
        headgear: player.headgear,
        selfRevive: player.selfRevive,
        primary: pSlot ? pSlot.id : null,
        primaryMods: pSlot ? (pSlot.mods || {}) : {},
        primaryMag: pSlot ? pSlot.mag : undefined,
        primaryRarity: pSlot ? (pSlot.rarityOverride || this._resolveItemRarity(pSlot)) : null,
        armor: player.armorId,
        secondary: sSlot ? sSlot.id : null,
        secondaryMods: sSlot ? (sSlot.mods || {}) : {},
        secondaryMag: sSlot ? sSlot.mag : undefined,
        secondaryRarity: sSlot ? (sSlot.rarityOverride || this._resolveItemRarity(sSlot)) : null,
        tactical: player.tactical,
        tacticalQty: player.tacticalQty,
        lethal: player.lethal,
        lethalQty: player.lethalQty,
        backpack: player.backpackId,
        fieldUpgrade: player.fieldUpgrade,
        killstreak: player.killstreak,
        melee: player.melee
      }, (k, el) => {
        // If in-place weapon-switch picker is active, clicking a highlighted Primary/Secondary confirms that target slot!
        if (this._raidWeaponPick) {
          if ((k === 'primary' || k === 'secondary') && this._raidWeaponPick.validTargets.includes(k)) {
            this._confirmRaidWeaponPickSlot(k);
          }
          return;
        }
        // Left-clicking player's own Primary or Secondary weapon slot opens the dimmed-bag weapon-switch popup!
        if (k === 'primary' || k === 'secondary') {
          const wObj = player.slots && player.slots[k];
          if (!wObj) return;
          this.openRaidWeaponStaging(player, wObj, {
            sourceLabel: `EQUIPPED ${k.toUpperCase()}`,
            excludeSlotKey: k,
            onComplete: (res, targetSlotKey) => {
              if (targetSlotKey !== k) {
                player.slots[k] = res.prevId
                  ? { id: res.prevId, mods: (res.prevSlotObj && res.prevSlotObj.mods) || {}, mag: res.prevSlotObj && res.prevSlotObj.mag, rarityOverride: (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null }
                  : null;
                if (player.activeSlot === k) {
                  player._equipCurrentWeapon();
                }
              }
            }
          });
          return;
        }
        // Clicking any equipped gear/killstreak/vest/bag/throwable/plate opens stow/transfer/drop popout
        const opItem = this._getPlayerOperatorSlotItem(player, k);
        if (opItem && el) {
          this.showItemPopout(el, 'player_op', opItem, k, { inputMode: 'mouse', mode: 'all' });
        }
      }, 'Click for Options / Stage · Right-Click to Stow (Weapon: Drop)', null, (k) => {
        // Right-clicking player's own Primary or Secondary weapon drops the physical 3D weapon to the ground!
        if (k === 'primary' || k === 'secondary') {
          const wObj = player.slots && player.slots[k];
          if (!wObj) return;
          player.slots[k] = null;
          if (player.activeSlot === k) {
            player._equipCurrentWeapon();
          }
          if (typeof this.onDropItem === 'function') {
            this.onDropItem({ id: wObj.id, qty: 1, mods: wObj.mods, mag: wObj.mag, rarityOverride: wObj.rarityOverride || null });
          }
          this.renderLootModal(player);
          return;
        }
        // Right-clicking any equipped killstreak, plate carrier, backpack, upgrade, etc. stows it straight into backpack!
        if (this._stowPlayerOperatorSlot(player, k, 'backpack')) {
          this.hideItemPopout();
          this.renderLootModal(player);
        }
      });
    }

    // 2. Active Container Grid (TOP) + Enemy Operator Inventory (BOTTOM when looting an Operator!)
    const cPanel = document.getElementById('inv-container-panel');
    if (cPanel) {
      let enemyEqEl = document.getElementById('loot-enemy-op-slots');
      if (this.activeLootSource && this.activeLootSource.operatorEquipment) {
        if (!enemyEqEl) {
          enemyEqEl = document.createElement('div');
          enemyEqEl.id = 'loot-enemy-op-slots';
          enemyEqEl.className = 'op-equip-grid compact';
          enemyEqEl.style.marginTop = '10px';
          enemyEqEl.style.paddingTop = '8px';
          enemyEqEl.style.borderTop = '1px solid rgba(255,255,255,0.10)';
        }
        // Always place Enemy Operator Inventory BELOW their Backpack (flipped!)
        cPanel.appendChild(enemyEqEl);

        const eq = this.activeLootSource.operatorEquipment;
        if (!eq.revealedSlots) eq.revealedSlots = {};
        const hasUnrevealedBag = (this.activeLootSource.items || []).some(it => it && it.revealed === false);
        const activeOpRevealKey = hasUnrevealedBag ? null : this._getNextUnrevealedOperatorSlot(eq);

        const openEnemyWeaponStage = (k) => {
          const itemId = eq[k];
          if (!itemId) return;
          this.openRaidWeaponStaging(player, { id: itemId, mods: eq[k + 'Mods'] || {}, rarityOverride: eq[k + 'Rarity'] || null }, {
            sourceLabel: `OPERATOR ${k.toUpperCase()}`,
            onComplete: (res) => {
              eq[k] = res.prevId || null;
              eq[k + 'Mods'] = (res.prevSlotObj && res.prevSlotObj.mods) || {};
              eq[k + 'Rarity'] = (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null;
              this._syncActiveContainerToNet();
            }
          });
        };

        this._renderOperatorTacticalGrid(enemyEqEl, {
          cash: eq.cash || 0,
          plates: eq.plates || 0,
          dogtag: eq.dogtag,
          dogtagText: eq.dogtagOwner || 'Operator Tag',
          headgear: eq.headgear,
          selfRevive: eq.selfRevive,
          primary: eq.primary,
          primaryMods: eq.primaryMods || {},
          primaryRarity: eq.primaryRarity || (eq.primary ? this._resolveItemRarity({ id: eq.primary, mods: eq.primaryMods || {} }) : null),
          armor: eq.armor,
          secondary: eq.secondary,
          secondaryMods: eq.secondaryMods || {},
          secondaryRarity: eq.secondaryRarity || (eq.secondary ? this._resolveItemRarity({ id: eq.secondary, mods: eq.secondaryMods || {} }) : null),
          tactical: eq.tactical,
          lethal: eq.lethal,
          backpack: eq.backpack,
          fieldUpgrade: eq.fieldUpgrade,
          killstreak: eq.killstreak,
          melee: eq.melee
        }, (k) => {
          // Left-Click on Enemy Operator Inventory
          if (k === 'cash') {
            if ((eq.cash || 0) <= 0) return;
            const amt = eq.cash;
            player.cash = (player.cash || 0) + amt;
            eq.cash = 0;
            this._syncActiveContainerToNet();
            this.renderLootModal(player);
            return;
          }
          if (k === 'plates') {
            if ((eq.plates || 0) <= 0) return;
            const need = Math.max(0, 6 - player.plates);
            if (need > 0) {
              const take = Math.min(need, eq.plates);
              player.plates += take;
              eq.plates -= take;
            } else if (player.addToBackpack('armor_plate', eq.plates)) {
              eq.plates = 0;
            } else {
              return;
            }
            this._syncActiveContainerToNet();
            this.renderLootModal(player);
            return;
          }
          const itemId = eq[k];
          if (!itemId) return;
          if (k === 'primary' || k === 'secondary') {
            // Open Weapon Slot Staging UI to select Primary, Secondary, or Backpack Weapon Slot!
            openEnemyWeaponStage(k);
            return;
          }
          if (k === 'dogtag') {
            if (player.addToBackpack('dogtag', 1)) {
              eq.dogtag = null;
              this._syncActiveContainerToNet();
              this.renderLootModal(player);
            }
            return;
          }
          if (k === 'tactical' || k === 'lethal') {
            if (player.addToBackpack(itemId, 1)) {
              eq[k] = null;
              this._syncActiveContainerToNet();
              this.renderLootModal(player);
            }
            return;
          }
          if (k === 'armor' || k === 'backpack' || k === 'fieldUpgrade' || k === 'killstreak' || k === 'selfRevive' || k === 'headgear' || k === 'melee') {
            const curMap = {
              armor: player.armorId,
              backpack: player.backpackId,
              fieldUpgrade: player.fieldUpgrade,
              killstreak: player.killstreak,
              selfRevive: player.selfRevive,
              headgear: player.headgear,
              melee: player.melee
            };
            if (curMap[k] === itemId) {
              if (player.addToBackpack(itemId, 1)) {
                eq[k] = null;
                this._syncActiveContainerToNet();
                this.renderLootModal(player);
              }
              return;
            }
            const prev = this._swapGearWithPlayer(player, itemId);
            eq[k] = prev || null;
            this._syncActiveContainerToNet();
            this.renderLootModal(player);
          }
        }, 'Left-Click: Equip/Stage · Right-Click: Stow in Bag', { revealedMap: eq.revealedSlots, activeKey: activeOpRevealKey }, (k) => {
          // Right-Click on Enemy Operator Inventory: automatically stow items (killstreaks, vests, bags, etc.) into backpack!
          if (k === 'cash') {
            if ((eq.cash || 0) <= 0) return;
            player.cash = (player.cash || 0) + eq.cash;
            eq.cash = 0;
            this._syncActiveContainerToNet();
            this.renderLootModal(player);
            return;
          }
          if (k === 'plates') {
            if ((eq.plates || 0) <= 0) return;
            if (player.addToBackpack('armor_plate', eq.plates)) {
              eq.plates = 0;
              this._syncActiveContainerToNet();
              this.renderLootModal(player);
            }
            return;
          }
          const itemId = eq[k];
          if (!itemId) return;
          if (k === 'primary' || k === 'secondary') {
            // Weapons open Weapon Slot Staging UI (so player can pick Backpack Weapon Slot, Primary, or Secondary)
            openEnemyWeaponStage(k);
            return;
          }
          if (player.addToBackpack(itemId, 1)) {
            eq[k] = null;
            if (window.soundEngine && window.soundEngine.playClick) {
              try { window.soundEngine.playClick(); } catch (e) {}
            }
            this._syncActiveContainerToNet();
            this.renderLootModal(player);
          }
        });
      } else if (enemyEqEl) {
        enemyEqEl.remove();
      }
    }

    if (cList) {
      cList.innerHTML = '';
      if (this.activeLootSource) {
        if (cTitle) cTitle.textContent = this.activeLootSource.title.toUpperCase();
        const items = this.activeLootSource.items;
        const eq = this.activeLootSource.operatorEquipment;
        const firstUnrevealed = items.findIndex(it => it && it.revealed === false);

        // When looting an eliminated operator, accurately match the slot count & weapon-slot layout of their equipped backpack!
        let totalSlots = items.length;
        let enemyHasWeaponBag = false;
        if (eq) {
          const eBagDef = eq.backpack ? GAME_DATA.ITEMS[eq.backpack] : null;
          enemyHasWeaponBag = !!(eBagDef && eBagDef.weaponSlot);
          // Enforce weapon-pack rule: non-weapon-pack operators NEVER hold weapons in their backpack,
          // and weapon-pack operators ALWAYS hold stowed weapons in the top-leftmost dedicated weapon slot!
          for (let wi = items.length - 1; wi >= 0; wi--) {
            const it = items[wi];
            const d = it && GAME_DATA.ITEMS[it.id];
            if (d && d.type === 'weapon') {
              if (enemyHasWeaponBag && !eq.backpackWeapon) {
                eq.backpackWeapon = it.id;
                eq.backpackWeaponMods = it.mods || {};
                eq.backpackWeaponRarity = it.rarityOverride || null;
              }
              items.splice(wi, 1);
            }
          }
          if (!enemyHasWeaponBag && eq.backpackWeapon) {
            eq.backpackWeapon = null;
            eq.backpackWeaponMods = null;
            eq.backpackWeaponRarity = null;
          }
          const bagSlots = (eBagDef && (eBagDef.bagSlots || eBagDef.slots)) || 8;
          totalSlots = Math.max(bagSlots, items.length);
        }

        // Top-leftmost dedicated double-wide weapon slot for Weapon Pack operators (identical to player backpack!)
        if (eq && enemyHasWeaponBag) {
          const ewSlot = document.createElement('div');
          ewSlot.dataset.context = 'container_wpn';
          if (eq.backpackWeapon && GAME_DATA.ITEMS[eq.backpackWeapon]) {
            const bwDef = GAME_DATA.ITEMS[eq.backpackWeapon];
            const bwItem = { id: eq.backpackWeapon, qty: 1, mods: eq.backpackWeaponMods || {}, rarityOverride: eq.backpackWeaponRarity || null };
            const bwRar = this._resolveItemRarity(bwItem, bwDef);
            ewSlot.className = `inv-slot weapon-slot-wide backpack-weapon-slot rarity-${bwRar}`;
            ewSlot.innerHTML = this._renderInvSlotInner(bwItem, bwDef, { wide: true });
            ewSlot.title = `STOWED WEAPON: ${bwDef.name} — Click to Equip / Swap`;
            ewSlot.addEventListener('click', (e) => {
              e.stopPropagation();
              this.openRaidWeaponStaging(player, bwItem, {
                sourceLabel: 'OPERATOR PACK WEAPON',
                onComplete: (res) => {
                  eq.backpackWeapon = res.prevId || null;
                  eq.backpackWeaponMods = (res.prevSlotObj && res.prevSlotObj.mods) || {};
                  eq.backpackWeaponRarity = (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null;
                  this._syncActiveContainerToNet();
                }
              });
            });
          } else {
            ewSlot.className = 'inv-slot weapon-slot-wide backpack-weapon-slot empty-slot';
            ewSlot.innerHTML = `<span class="slot-qty" style="opacity:0.55;left:8px;right:auto;">WPN</span><span class="slot-val" style="opacity:0.45;">EMPTY WEAPON SLOT</span>`;
          }
          cList.appendChild(ewSlot);
        }

        if (totalSlots === 0 && !(eq && enemyHasWeaponBag)) {
          cList.innerHTML = '<p class="hint" style="padding:10px;grid-column:1/-1;">Backpack / Container is empty.</p>';
        } else {
          for (let idx = 0; idx < totalSlots; idx++) {
            const item = items[idx];
            const slot = document.createElement('div');
            slot.dataset.context = 'container';
            slot.dataset.idx = idx;

            if (!item || !GAME_DATA.ITEMS[item.id]) {
              slot.className = 'inv-slot empty-slot';
              cList.appendChild(slot);
              continue;
            }

            const def = GAME_DATA.ITEMS[item.id];
            const isWpn = def.type === 'weapon';
            slot.className = isWpn ? 'inv-slot weapon-slot-wide' : 'inv-slot';

            if (item.revealed === false) {
              slot.classList.add('searching');
              const isSearchingNow = idx === firstUnrevealed;
              slot.innerHTML = isSearchingNow
                ? `<div class="reveal-ring-wrap">
                     <svg viewBox="0 0 36 36"><circle class="reveal-ring-bg" cx="18" cy="18" r="16"/><circle class="reveal-ring-fg" cx="18" cy="18" r="16" stroke-dasharray="100.5" stroke-dashoffset="100.5"/></svg>
                     <span class="reveal-q">?</span>
                   </div>
                   <span class="slot-val">SEARCHING</span>`
                : `<span class="reveal-q queued">?</span><span class="slot-val">QUEUED</span>`;
            } else {
              const effRar = this._resolveItemRarity(item, def);
              slot.classList.add(`rarity-${effRar}`);
              slot.innerHTML = this._renderInvSlotInner(item, def, { wide: isWpn });
              slot.title = isWpn
                ? `${def.name} (₽${(def.value || 0).toLocaleString()}) — Click to Select Weapon Slot`
                : `${def.name}${item.qty > 1 ? ' x' + item.qty : ''} (₽${(def.value * item.qty).toLocaleString()}) — Left-Click: Quick-Move · Right-Click: Options`;
              slot.addEventListener('click', (e) => {
                e.stopPropagation();
                this._hoveredSlot = { context: 'container', item, idx, el: slot };
                this.handleSlotAction('quick');
              });
              slot.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showItemPopout(slot, 'container', item, idx, { inputMode: 'mouse', mode: 'all' });
              });
            }
            cList.appendChild(slot);
          }
        }
      }
    }

    // 3. Backpack Grid + DMZ Pack Header + Sort Category Counters + Loadout Credits
    const maxSlots = player.backpackMaxSlots || 8;
    const hasWeaponBag = player.hasWeaponBackpack();
    const packNameEl = document.getElementById('bag-pack-name');
    if (packNameEl) {
      const bDef = player.backpackId && GAME_DATA.ITEMS[player.backpackId];
      packNameEl.textContent = (bDef && bDef.name) ? bDef.name.toUpperCase() : 'BASIC PACK';
    }
    const loadoutCreditsEl = document.getElementById('dmz-loadout-credits');
    if (loadoutCreditsEl) {
      loadoutCreditsEl.textContent = `₽ ${(player.cash || 0).toLocaleString()}`;
    }
    const usedEl = document.getElementById('bag-slots-used');
    const maxEl = document.getElementById('bag-slots-max');
    if (usedEl) usedEl.textContent = Math.min(maxSlots, player.backpack.length);
    if (maxEl) {
      maxEl.textContent = hasWeaponBag
        ? `${maxSlots} + ${player.backpackWeapon ? 1 : 0}/1 WPN`
        : maxSlots;
    }
    const bagTotalEl = document.getElementById('bag-total-val');
    if (bagTotalEl) {
      bagTotalEl.textContent = `₽ ${player.getBackpackValue().toLocaleString()}`;
    }

    // Sort counts: Docs (keys/intel), Chips (electronics), Chem (meds/gunpowder/fuel), Gear (materials/misc)
    let cntDocs = 0, cntChips = 0, cntChem = 0, cntGear = 0;
    const bagItems = Array.isArray(player.backpack) ? player.backpack : [];
    for (let i = 0; i < bagItems.length; i++) {
      const it = bagItems[i];
      if (!it || !it.id) continue;
      const d = GAME_DATA.ITEMS[it.id];
      const q = Math.max(1, it.qty || 1);
      if (it.id === 'gpu_unit' || it.id === 'intel_drive' || it.id === 'black_box') {
        cntChips += q;
      } else if ((d && d.type === 'key') || it.id === 'boss_key' || it.id === 'dogtag') {
        cntDocs += q;
      } else if ((d && d.type === 'med') || it.id === 'self_revive' || it.id === 'gunpowder' || it.id === 'fuel_can') {
        cntChem += q;
      } else {
        cntGear += q;
      }
    }
    const pad3 = (n) => String(Math.min(999, Math.max(0, n))).padStart(3, '0');
    const sDocsEl = document.getElementById('sort-docs');
    const sChipsEl = document.getElementById('sort-chips');
    const sChemEl = document.getElementById('sort-chem');
    const sGearEl = document.getElementById('sort-gear');
    const sMaxEl = document.getElementById('sort-max');
    if (sDocsEl) sDocsEl.textContent = pad3(cntDocs);
    if (sChipsEl) sChipsEl.textContent = pad3(cntChips);
    if (sChemEl) sChemEl.textContent = pad3(cntChem);
    if (sGearEl) sGearEl.textContent = pad3(cntGear);
    if (sMaxEl) sMaxEl.textContent = `MAX ${maxSlots}`;

    if (bList) {
      bList.innerHTML = '';

      // Dedicated Double-Wide Weapon Slot in the Top-Left of the Weapon Backpack!
      if (hasWeaponBag) {
        const wSlot = document.createElement('div');
        wSlot.className = 'inv-slot weapon-slot-wide backpack-weapon-slot';
        wSlot.dataset.context = 'backpack_weapon';
        wSlot.dataset.idx = '-1';
        if (player.backpackWeapon && GAME_DATA.ITEMS[player.backpackWeapon.id]) {
          const bw = player.backpackWeapon;
          const wDef = GAME_DATA.ITEMS[bw.id];
          const wItem = { id: bw.id, qty: 1, mods: bw.mods, mag: bw.mag, rarityOverride: bw.rarityOverride || null };
          wSlot.classList.add(`rarity-${bw.rarityOverride || wDef.rarity || 'common'}`);
          wSlot.innerHTML = this._renderInvSlotInner(wItem, wDef, { wide: true, typeLabel: 'WPN SLOT' });
          wSlot.title = `${wDef.name} (Backpack Weapon Slot) — Left-Click: Switch Slot · [X/Square]: Equip Active · [A/Cross]: Drop`;
          wSlot.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._raidWeaponPick) {
              if (this._raidWeaponPick.validTargets.includes('backpackWeapon')) {
                this._confirmRaidWeaponPickSlot('backpackWeapon');
              }
              return;
            }
            this.openRaidWeaponStaging(player, wItem, {
              sourceLabel: 'BACKPACK WEAPON SLOT',
              excludeSlotKey: 'backpackWeapon',
              onComplete: (res, targetSlotKey) => {
                if (targetSlotKey !== 'backpackWeapon') {
                  player.backpackWeapon = res.prevId
                    ? { id: res.prevId, mods: (res.prevSlotObj && res.prevSlotObj.mods) || {}, mag: res.prevSlotObj && res.prevSlotObj.mag, rarityOverride: (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null }
                    : null;
                }
              }
            });
          });
          wSlot.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showItemPopout(wSlot, 'backpack_weapon', wItem, -1, { inputMode: 'mouse', mode: 'context' });
          });
        } else {
          wSlot.classList.add('empty-slot');
          wSlot.innerHTML = `<div class="slot-top-bar"><span class="slot-type">WPN SLOT</span></div><span class="empty-wpn-hint">WEAPON SLOT</span>`;
          wSlot.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._raidWeaponPick && this._raidWeaponPick.validTargets.includes('backpackWeapon')) {
              this._confirmRaidWeaponPickSlot('backpackWeapon');
            }
          });
        }
        bList.appendChild(wSlot);
      }

      for (let idx = 0; idx < maxSlots; idx++) {
        const item = player.backpack[idx];
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        slot.dataset.context = 'backpack';
        slot.dataset.idx = idx;

        if (item && GAME_DATA.ITEMS[item.id]) {
          const def = GAME_DATA.ITEMS[item.id];
          const isWpn = def.type === 'weapon';
          if (isWpn) slot.classList.add('weapon-slot-wide');
          slot.classList.add(`rarity-${this._resolveItemRarity(item, def)}`);
          slot.innerHTML = this._renderInvSlotInner(item, def, { wide: isWpn });
          slot.title = `${def.name}${item.qty > 1 ? ' x' + item.qty : ''} (₽${(def.value * item.qty).toLocaleString()}) — Left-Click: Details/Equip · Right-Click: Drop to Ground / Split`;
          slot.addEventListener('click', (e) => {
            e.stopPropagation();
            if (def.type === 'weapon') {
              this.openRaidWeaponStaging(player, item, {
                sourceLabel: 'BACKPACK',
                onComplete: (res) => {
                  player.backpack.splice(idx, 1);
                  if (res.prevId) {
                    player.backpack.splice(idx, 0, {
                      id: res.prevId,
                      qty: 1,
                      mods: (res.prevSlotObj && res.prevSlotObj.mods) || {},
                      mag: res.prevSlotObj && res.prevSlotObj.mag,
                      rarityOverride: (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null
                    });
                  }
                }
              });
              return;
            }
            if (this._hoveredSlot && this._hoveredSlot.el === slot && this._hoveredSlot.mode === 'details') {
              this.hideItemPopout();
            } else {
              this.showItemPopout(slot, 'backpack', item, idx, { inputMode: 'mouse', mode: 'details' });
            }
          });
          slot.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showItemPopout(slot, 'backpack', item, idx, { inputMode: 'mouse', mode: 'context' });
          });
        } else {
          slot.classList.add('empty-slot');
        }
        bList.appendChild(slot);
      }
    }

    // Recompute live window-responsive --inv-scale after rendering backpack & container rows so zero rows get clipped!
    this._updateDynamicUiScale();

    // Restore D-Pad / Spatial selection seamlessly across live reveal re-renders (keeping the exact selected item locked!)
    let restoredEl = null;
    if (prevSel) {
      if (prevSel.kind === 'bag_wpn') {
        restoredEl = document.querySelector('#loot-backpack-items .backpack-weapon-slot');
      } else if (prevSel.kind === 'inv') {
        let targetIdx = prevSel.idx;
        if (prevSel.itemRef) {
          const list = prevSel.context === 'container'
            ? (this.activeLootSource && this.activeLootSource.items)
            : (player && player.backpack);
          if (Array.isArray(list)) {
            const foundIdx = list.indexOf(prevSel.itemRef);
            if (foundIdx >= 0) targetIdx = foundIdx;
            else if (list.length > 0) targetIdx = Math.min(prevSel.idx, list.length - 1);
          }
        }
        restoredEl = document.querySelector(`#loot-modal .inv-slot[data-context="${prevSel.context}"][data-idx="${targetIdx}"]`);
      } else if (prevSel.kind === 'op' && prevSel.parentId && prevSel.opKey) {
        restoredEl = document.querySelector(`#${prevSel.parentId} .op-slot-card[data-op-key="${prevSel.opKey}"]`);
      }
    }
    if (!restoredEl) {
      restoredEl = this.activeLootSource
        ? (document.querySelector('#loot-container-items .inv-slot') || document.querySelector('#loot-backpack-items .inv-slot'))
        : document.querySelector('#loot-backpack-items .inv-slot');
    }
    if (restoredEl && this.setSelectedElement) {
      const ctrlConnected = this._isControllerConnected();
      this.setSelectedElement(restoredEl, { inputMode: ctrlConnected ? 'gamepad' : 'auto', silent: true });
    }
  }

  // ==================== SUMMARY SCREEN ====================
  showSummary(extracted, timeSurvived, kills, recoveredItems, totalValue) {
    this.showScreen('summary');
    const badge = document.getElementById('summary-status-badge');
    const title = document.getElementById('summary-title');

    // Update Active Duty Operator exfil streak, dogtag level & award Trait Points on dogtag level-up!
    const ops = this._ensureActiveDutyOperators();
    const curOp = ops[this.profile.activeOperatorIdx || 0];
    if (curOp) {
      if (extracted) {
        const prevDt = this._getDogtagInfo(curOp.exfilStreak || 0);
        curOp.exfilStreak = Math.min(10, (curOp.exfilStreak || 0) + 1);
        const nextDt = this._getDogtagInfo(curOp.exfilStreak);
        if (nextDt.levelNum > prevDt.levelNum) {
          curOp.traitPoints = (curOp.traitPoints || 0) + 2 * (nextDt.levelNum - prevDt.levelNum);
        }
      } else {
        curOp.exfilStreak = 0;
        curOp.traitPoints = 0;
        curOp.traits = { assault: 0, survival: 0, recon: 0 };
      }
      this.saveProfile();
    }

    if (extracted) {
      badge.textContent = 'EXTRACTION SUCCESSFUL';
      badge.className = 'status-badge extracted';
      title.textContent = 'SURVIVED THE WASTELAND';
    } else {
      badge.textContent = 'KILLED IN ACTION';
      badge.className = 'status-badge kia';
      title.textContent = 'LOST IN THE DEADZONE';
    }

    const mins = Math.floor(timeSurvived / 60);
    const secs = Math.floor(timeSurvived % 60);
    document.getElementById('sum-time').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('sum-kills').textContent = kills;
    document.getElementById('sum-value').textContent = `₽ ${totalValue.toLocaleString()}`;

    const list = document.getElementById('sum-items');
    list.innerHTML = '';
    if (!extracted || recoveredItems.length === 0) {
      list.innerHTML = `<p class="hint">${extracted ? 'No items in backpack.' : 'All raid gear and backpack loot were lost.'}</p>`;
    } else {
      for (const item of recoveredItems) {
        const def = GAME_DATA.ITEMS[item.id];
        if (!def) continue;
        const row = document.createElement('div');
        row.className = `item-row rarity-${def.rarity}`;
        row.innerHTML = `
          <div class="item-info">
            <div class="item-name">${def.name}${item.qty > 1 ? ' x' + item.qty : ''}</div>
            <div class="item-meta">₽ ${(def.value * item.qty).toLocaleString()}</div>
          </div>
        `;
        list.appendChild(row);
      }
    }
  }

  // ==================== v2.64 TAC-MAP ZOOM/PAN/RADIAL, INVENTORY ITEM PING & SCOPED BLURRED CHAT ====================
  getTacMapViewExtent(world = null) {
    const halfSize = (world && world.mapHalfSize) || 190;
    const baseExtent = halfSize + 48;
    const zoom = THREE.MathUtils.clamp(this.tacMapZoom || 1.0, 1.0, 4.5);
    return { halfSize, baseExtent, zoom, viewExtent: baseExtent / zoom };
  }

  _clampTacMapPan(world = null) {
    const { baseExtent, viewExtent } = this.getTacMapViewExtent(world);
    const maxPan = Math.max(0, baseExtent - viewExtent);
    if (!this.tacMapPan) this.tacMapPan = { x: 0, z: 0 };
    this.tacMapPan.x = THREE.MathUtils.clamp(this.tacMapPan.x || 0, -maxPan, maxPan);
    this.tacMapPan.z = THREE.MathUtils.clamp(this.tacMapPan.z || 0, -maxPan, maxPan);
  }

  tacMapWorldToCanvas(wx, wz, W, H, world = null) {
    const { viewExtent } = this.getTacMapViewExtent(world);
    this._clampTacMapPan(world);
    const scaleX = W / (viewExtent * 2);
    const scaleY = H / (viewExtent * 2);
    return {
      x: W * 0.5 + (wx - this.tacMapPan.x) * scaleX,
      y: H * 0.5 + (wz - this.tacMapPan.z) * scaleY,
      scale: scaleX
    };
  }

  tacMapCanvasToWorld(nx, ny, world = null) {
    const { viewExtent } = this.getTacMapViewExtent(world);
    this._clampTacMapPan(world);
    return {
      wx: this.tacMapPan.x + (nx - 0.5) * viewExtent * 2,
      wz: this.tacMapPan.z + (ny - 0.5) * viewExtent * 2
    };
  }

  zoomTacMap(factor, anchorNx = 0.5, anchorNy = 0.5, world = null) {
    const ax = THREE.MathUtils.clamp(anchorNx, 0, 1);
    const ay = THREE.MathUtils.clamp(anchorNy, 0, 1);
    const before = this.tacMapCanvasToWorld(ax, ay, world);
    this.tacMapZoom = THREE.MathUtils.clamp((this.tacMapZoom || 1.0) * factor, 1.0, 4.5);
    const { viewExtent } = this.getTacMapViewExtent(world);
    if (!this.tacMapPan) this.tacMapPan = { x: 0, z: 0 };
    this.tacMapPan.x = before.wx - (ax - 0.5) * viewExtent * 2;
    this.tacMapPan.z = before.wz - (ay - 0.5) * viewExtent * 2;
    this._clampTacMapPan(world);
    const badge = document.getElementById('tacmap-zoom-badge');
    if (badge) badge.textContent = `${this.tacMapZoom.toFixed(1)}x`;
  }

  panTacMap(dxWorld, dzWorld, world = null) {
    if (!this.tacMapPan) this.tacMapPan = { x: 0, z: 0 };
    this.tacMapPan.x += dxWorld;
    this.tacMapPan.z += dzWorld;
    this._clampTacMapPan(world);
  }

  resetTacMapZoom() {
    this.tacMapZoom = 1.0;
    this.tacMapPan = { x: 0, z: 0 };
    const badge = document.getElementById('tacmap-zoom-badge');
    if (badge) badge.textContent = '1.0x';
  }

  findTacMapPingAt(nx, ny, world = null) {
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
    const canvas = document.getElementById('hud-tacmap-canvas');
    if (!canvas) return null;
    const W = canvas.width || 560;
    const H = canvas.height || 560;
    const px = nx * W;
    const py = ny * H;
    const pings = window.activePings || [];
    let best = null;
    let bestDist = 17.5;
    for (const pg of pings) {
      if (!pg || !pg.position) continue;
      const pt = this.tacMapWorldToCanvas(pg.position.x, pg.position.z, W, H, world);
      const d = Math.hypot(pt.x - px, pt.y - py);
      if (d <= bestDist) {
        bestDist = d;
        best = pg;
      }
    }
    return best;
  }

  openTacMapRadial(nx, ny, world = null, source = 'mouse') {
    const radEl = document.getElementById('tacmap-ping-radial');
    if (!radEl) return;
    const cNx = THREE.MathUtils.clamp(nx, 0.01, 0.99);
    const cNy = THREE.MathUtils.clamp(ny, 0.01, 0.99);
    const { wx, wz } = this.tacMapCanvasToWorld(cNx, cNy, world);
    this.tacMapRadial = {
      open: true,
      nx: cNx,
      ny: cNy,
      wx,
      wz,
      choice: 'cancel',
      source,
      openedAt: performance.now()
    };
    radEl.style.left = `${(cNx * 100).toFixed(2)}%`;
    radEl.style.top = `${(cNy * 100).toFixed(2)}%`;
    radEl.classList.remove('hidden');
    this._applyTacMapRadialChoice('cancel');
  }

  _applyTacMapRadialChoice(choice) {
    if (!this.tacMapRadial) return;
    this.tacMapRadial.choice = choice || 'cancel';
    const centerEl = document.getElementById('tacmap-radial-center');
    if (centerEl) {
      centerEl.textContent = (!choice || choice === 'cancel') ? '✕' : choice.toUpperCase();
    }
    document.querySelectorAll('#tacmap-ping-radial .tm-rad-opt').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.ping === choice);
    });
  }

  updateTacMapRadialFromStick(dx, dy) {
    if (!this.tacMapRadial || !this.tacMapRadial.open) return;
    const mag = Math.hypot(dx, dy);
    if (mag < 0.26) {
      this._applyTacMapRadialChoice('cancel');
      return;
    }
    // Browser Gamepad API stick Y is negative when pushed UP (-Y = top of radial)
    const screenDeg = ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360;
    let choice = 'cancel';
    if (screenDeg >= 330 || screenDeg < 30) choice = 'enemy';
    else if (screenDeg < 90) choice = 'attack';
    else if (screenDeg < 150) choice = 'loot';
    else if (screenDeg < 210) choice = 'regroup';
    else if (screenDeg < 270) choice = 'defend';
    else choice = 'location';
    this._applyTacMapRadialChoice(choice);
  }

  updateTacMapRadialFromMouse(clientX, clientY) {
    if (!this.tacMapRadial || !this.tacMapRadial.open) return;
    const radEl = document.getElementById('tacmap-ping-radial');
    if (!radEl) return;
    const rect = radEl.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 20) {
      this._applyTacMapRadialChoice('cancel');
      return;
    }
    const deg = ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360;
    let choice = 'cancel';
    if (deg >= 330 || deg < 30) choice = 'enemy';
    else if (deg < 90) choice = 'attack';
    else if (deg < 150) choice = 'loot';
    else if (deg < 210) choice = 'regroup';
    else if (deg < 270) choice = 'defend';
    else choice = 'location';
    this._applyTacMapRadialChoice(choice);
  }

  closeTacMapRadial() {
    const radEl = document.getElementById('tacmap-ping-radial');
    if (radEl) radEl.classList.add('hidden');
    if (this.tacMapRadial) {
      this.tacMapRadial.open = false;
      this.tacMapRadial.choice = 'cancel';
    }
  }

  // ==================== DEVELOPER / ADMIN PRIVILEGE & SCOPED MATCH / FOB TEXT CHAT ====================
  isDeveloperOrAdmin() {
    if (window.DEV_MODE || window.IS_ADMIN || window.IS_DEVELOPER) return true;
    const p = this.profile || {};
    if (p.isDeveloper || p.isAdmin || p.dev || p.admin) return true;
    const role = String(p.role || (p.social && p.social.role) || '').toLowerCase();
    return role === 'dev' || role === 'developer' || role === 'admin' || role === 'administrator' || role === 'owner';
  }

  getDeveloperRoleLabel() {
    const p = this.profile || {};
    const role = String(p.role || (p.social && p.social.role) || '').toLowerCase();
    if (window.IS_ADMIN || p.isAdmin || p.admin || role === 'admin' || role === 'administrator' || role === 'owner') {
      return 'ADMIN';
    }
    if (window.DEV_MODE || window.IS_DEVELOPER || p.isDeveloper || p.dev || role === 'dev' || role === 'developer') {
      return 'DEV';
    }
    return '';
  }

  refreshLobbyChatRoleBadge() {
    const badge = document.getElementById('lobby-chat-role-badge');
    const input = document.getElementById('lobby-chat-input');
    const roleLbl = this.getDeveloperRoleLabel();
    if (badge) {
      if (roleLbl) {
        badge.textContent = roleLbl;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
    if (input) {
      input.placeholder = roleLbl
        ? 'Chat or /command (Dev/Admin)...'
        : 'Press [Enter] to chat in lobby...';
    }
  }

  updateLobbyChatVisibility() {
    const panel = document.getElementById('lobby-chat-panel');
    if (!panel) return;
    const inRaidNow = typeof window.isInRaid === 'function' ? !!window.isInRaid() : false;
    const lootMod = document.getElementById('loot-modal');
    const lootOpen = !!(lootMod && !lootMod.classList.contains('hidden'));
    const gs = document.getElementById('gunsmith-screen');
    const gsOpen = !!(gs && gs.classList.contains('active'));
    const sum = document.getElementById('summary-screen');
    const sumOpen = !!(sum && sum.classList.contains('active'));
    const igSet = document.getElementById('ingame-settings-overlay');
    const igSetOpen = !!(igSet && !igSet.classList.contains('hidden'));
    const fobEnter = document.getElementById('fob-enter-overlay');
    const fobEnterOpen = !!(fobEnter && !fobEnter.classList.contains('hidden'));
    const hideout = document.getElementById('hideout-screen');
    const hideoutRoam = !!(hideout && hideout.classList.contains('hideout-roam-mode'));
    const onSubMenu = !inRaidNow && !hideoutRoam && this.activeMenuTab !== 'home' && this.activeMenuTab !== 'matchmaking';

    const shouldSuppress = lootOpen || gsOpen || sumOpen || igSetOpen || fobEnterOpen || onSubMenu;
    panel.classList.toggle('suppressed', shouldSuppress);
    panel.classList.toggle('tacmap-open', !!(inRaidNow && this.isTacMapOpen));
    panel.classList.toggle('in-raid-idle', !!(inRaidNow && !this.isTacMapOpen && !this.isChatInputActive));
    this.refreshLobbyChatRoleBadge();
  }

  _initLobbyChat() {
    this.isChatInputActive = false;
    const panel = document.getElementById('lobby-chat-panel');
    const form = document.getElementById('lobby-chat-form');
    const input = document.getElementById('lobby-chat-input');
    const minBtn = document.getElementById('btn-lobby-chat-min');
    if (!panel || !form || !input) return;

    const initRoom = this.partyId || ('p_' + (this._clientId || 'local'));
    const initTitle = (this.partyMembers && this.partyMembers.length > 1)
      ? `${this.partyHost || 'HOST'}'S FOB`
      : 'FOB LOBBY';
    this.setChatRoomScope('fob', initRoom, initTitle);

    if (minBtn) {
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const min = panel.classList.toggle('minimized');
        minBtn.textContent = min ? '+' : '—';
      });
    }

    input.addEventListener('focus', () => {
      this.isChatInputActive = true;
      panel.classList.add('chat-active');
      panel.classList.remove('in-raid-idle');
    });

    input.addEventListener('blur', () => {
      this.isChatInputActive = false;
      panel.classList.remove('chat-active');
      this.updateLobbyChatVisibility();
    });

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Escape') {
        e.preventDefault();
        input.blur();
        this._relockGameplayPointerIfNeeded();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const raw = input.value;
      input.value = '';
      if (raw && raw.trim()) {
        this.submitLobbyChat(raw);
      }
      const inRaidNow = typeof window.isInRaid === 'function' ? !!window.isInRaid() : false;
      const hideout = document.getElementById('hideout-screen');
      const hideoutRoam = !!(hideout && hideout.classList.contains('hideout-roam-mode'));
      if ((inRaidNow && !this.isTacMapOpen) || hideoutRoam) {
        input.blur();
        this._relockGameplayPointerIfNeeded();
      }
    });

    // Global [Enter] shortcut to focus Lobby Chat when not already typing in another field
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.repeat) return;
      if (window.devConsole && window.devConsole.isOpen) return;
      const activeEl = document.activeElement;
      const tag = (activeEl && activeEl.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      this.updateLobbyChatVisibility();
      if (panel.classList.contains('suppressed')) return;
      e.preventDefault();
      e.stopPropagation();
      if (panel.classList.contains('minimized')) {
        panel.classList.remove('minimized');
        if (minBtn) minBtn.textContent = '—';
      }
      this.isChatInputActive = true;
      const gameCanvas = document.getElementById('game-canvas');
      if (document.pointerLockElement === gameCanvas) {
        try { document.exitPointerLock(); } catch (err) {}
      }
      input.focus();
    });

    // Keep visibility synced neatly across UI state transitions
    this._chatVisTimer = setInterval(() => this.updateLobbyChatVisibility(), 350);
    this.updateLobbyChatVisibility();
  }

  _relockGameplayPointerIfNeeded() {
    const gameCanvas = document.getElementById('game-canvas');
    if (!gameCanvas) return;
    const inRaidNow = typeof window.isInRaid === 'function' ? !!window.isInRaid() : false;
    const lootMod = document.getElementById('loot-modal');
    const lootOpen = !!(lootMod && !lootMod.classList.contains('hidden'));
    const pauseOv = document.getElementById('pointer-lock-overlay');
    const pauseOpen = !!(pauseOv && !pauseOv.classList.contains('hidden'));
    const hideout = document.getElementById('hideout-screen');
    const hideoutRoam = !!(hideout && hideout.classList.contains('hideout-roam-mode'));
    if (inRaidNow && !this.isTacMapOpen && !lootOpen && !pauseOpen && !this.isInGameSettingsOpen) {
      try { gameCanvas.requestPointerLock(); } catch (e) {}
    } else if (!inRaidNow && hideoutRoam) {
      try { gameCanvas.requestPointerLock(); } catch (e) {}
    }
  }

  setChatRoomScope(scope, roomId, roomTitle = '') {
    const nextScope = scope === 'match' ? 'match' : 'fob';
    const nextRoom = String(roomId || (this.partyId || ('p_' + (this._clientId || 'local'))));
    const titleStr = roomTitle || (nextScope === 'match' ? 'MATCH LOBBY' : 'FOB LOBBY');
    const scopeEl = document.getElementById('lobby-chat-scope');
    if (scopeEl) scopeEl.textContent = titleStr;

    if (this._chatScope !== nextScope || this._chatRoomId !== nextRoom) {
      this._chatScope = nextScope;
      this._chatRoomId = nextRoom;
      const msgBox = document.getElementById('lobby-chat-messages');
      if (msgBox) msgBox.innerHTML = '';
      const scopeDesc = nextScope === 'match' ? 'match' : 'FOB';
      const devHint = this.isDeveloperOrAdmin() ? ' · Slash commands (/help) enabled.' : '';
      this.appendLobbyChatMessage({
        system: true,
        cls: 'sys',
        text: `Connected to ${titleStr} (visible only to players in this ${scopeDesc})${devHint}`
      });
    }
    this.refreshLobbyChatRoleBadge();
    this.updateLobbyChatVisibility();
  }

  appendLobbyChatMessage(entry) {
    const msgBox = document.getElementById('lobby-chat-messages');
    if (!msgBox || !entry) return;
    const row = document.createElement('div');
    row.className = 'lc-msg' + (entry.cls ? ` ${entry.cls}` : '');

    if (entry.system) {
      row.textContent = entry.text || '';
    } else {
      if (entry.roleLabel) {
        const rTag = document.createElement('span');
        rTag.className = 'lc-tag';
        rTag.style.background = 'rgba(105, 240, 174, 0.16)';
        rTag.style.border = '1px solid rgba(105, 240, 174, 0.55)';
        rTag.style.color = '#69f0ae';
        rTag.textContent = entry.roleLabel;
        row.appendChild(rTag);
      }
      if (entry.isPartyPeer) {
        const pTag = document.createElement('span');
        pTag.className = 'lc-tag';
        pTag.style.background = 'rgba(79, 195, 247, 0.16)';
        pTag.style.border = '1px solid rgba(79, 195, 247, 0.55)';
        pTag.style.color = '#4fc3f7';
        pTag.textContent = 'PARTY';
        row.appendChild(pTag);
      }
      const senderSpan = document.createElement('span');
      senderSpan.className = 'lc-sender';
      senderSpan.style.color = entry.isSelf ? '#ffca28' : (entry.isPartyPeer ? '#4fc3f7' : '#e0e8ee');
      senderSpan.textContent = `${entry.from || 'OPERATOR'}:`;
      row.appendChild(senderSpan);

      const bodySpan = document.createElement('span');
      bodySpan.textContent = entry.text || '';
      row.appendChild(bodySpan);
    }

    msgBox.appendChild(row);
    while (msgBox.children.length > 80) {
      msgBox.removeChild(msgBox.firstChild);
    }
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  submitLobbyChat(rawText) {
    const trimmed = String(rawText || '').trim();
    if (!trimmed) return;

    // Developer / Admin Console Command Execution Directly Through In-Game Chat
    if (trimmed.startsWith('/')) {
      if (!this.isDeveloperOrAdmin()) {
        this.appendLobbyChatMessage({
          system: true,
          cls: 'con-err',
          text: '[SYSTEM] Developer or Admin privileges required to run console commands.'
        });
        return;
      }
      this.appendLobbyChatMessage({ system: true, cls: 'sys', text: `> ${trimmed}` });
      if (window.devConsole && typeof window.devConsole.executeFromChat === 'function') {
        const out = window.devConsole.executeFromChat(trimmed) || [];
        for (const line of out) {
          const mapCls = line.type === 'ok'
            ? 'con-ok'
            : (line.type === 'err' ? 'con-err' : (line.type === 'warn' ? 'con-warn' : 'con-info'));
          this.appendLobbyChatMessage({
            system: true,
            cls: mapCls,
            text: `[CONSOLE] ${line.text}`
          });
        }
        this.refreshLobbyChatRoleBadge();
      } else {
        this.appendLobbyChatMessage({
          system: true,
          cls: 'con-err',
          text: '[CONSOLE] DevConsole not initialized.'
        });
      }
      return;
    }

    if (!this._chatRoomId) {
      this._chatRoomId = this.partyId || ('p_' + (this._clientId || 'local'));
    }
    const myCallsign = (this.profile && this.profile.social && this.profile.social.callsign) || 'OPERATOR';
    const pkt = {
      type: 'lobby_chat',
      msgId: `${this._clientId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      scope: this._chatScope || 'fob',
      roomId: this._chatRoomId,
      fromId: this._clientId,
      from: myCallsign,
      partyId: this.partyId || null,
      roleLabel: this.getDeveloperRoleLabel(),
      text: trimmed.slice(0, 220),
      ts: Date.now()
    };

    this.receiveLobbyChatPacket(pkt);
    if (this._sendSocialPacket) {
      this._sendSocialPacket(pkt);
    }
    if (this._chatScope === 'match' && typeof this.onSendMatchChat === 'function') {
      this.onSendMatchChat(pkt);
    }
  }

  receiveLobbyChatPacket(msg) {
    if (!msg || !msg.msgId || !msg.scope || !msg.roomId || typeof msg.text !== 'string') return;
    if (!this._seenChatMsgIds) this._seenChatMsgIds = new Set();
    if (this._seenChatMsgIds.has(msg.msgId)) return;
    this._seenChatMsgIds.add(msg.msgId);
    if (this._seenChatMsgIds.size > 240) {
      const first = this._seenChatMsgIds.values().next().value;
      this._seenChatMsgIds.delete(first);
    }

    // Strict Match / FOB Room Isolation: ONLY display messages from the exact active Match or exact active FOB!
    const inRaidNow = typeof window.isInRaid === 'function' ? !!window.isInRaid() : (this._chatScope === 'match');
    if (msg.scope === 'match' && !inRaidNow) return;
    if (msg.scope === 'fob' && inRaidNow) return;
    if (msg.scope !== this._chatScope || String(msg.roomId) !== String(this._chatRoomId)) return;

    const isSelf = msg.fromId === this._clientId;
    const isPartyPeer = !isSelf && !!(msg.partyId && this.partyId && msg.partyId === this.partyId);
    this.appendLobbyChatMessage({
      system: false,
      isSelf,
      isPartyPeer,
      from: msg.from || 'OPERATOR',
      roleLabel: msg.roleLabel || '',
      text: msg.text
    });
  }

  // ==================== INVENTORY / BAG / CONTAINER / BODY ITEM PINGING (MMB & CONTROLLER Y/TRIANGLE) ====================
  _initInventoryItemPingMouse() {
    const modal = document.getElementById('loot-modal');
    if (!modal) return;
    // Prevent browser autoscroll circle on Middle Mouse inside inventory & ping hovered/selected item!
    modal.addEventListener('mousedown', (e) => {
      if (e.button !== 1) return;
      if (modal.classList.contains('hidden')) return;
      e.preventDefault();
      e.stopPropagation();
      const slotEl = (e.target && e.target.closest)
        ? e.target.closest('.inv-slot, .op-slot-card')
        : null;
      this.pingInventorySlot(slotEl);
    }, true);
    modal.addEventListener('auxclick', (e) => {
      if (e.button === 1 && !modal.classList.contains('hidden')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  pingInventorySlot(slotEl = null) {
    const modal = document.getElementById('loot-modal');
    if (!modal || modal.classList.contains('hidden') || !this._lootPlayer) return false;
    const player = this._lootPlayer;

    const el = (slotEl && modal.contains(slotEl))
      ? slotEl
      : ((this._hoveredSlot && this._hoveredSlot.el && modal.contains(this._hoveredSlot.el))
        ? this._hoveredSlot.el
        : ((this._selectedEl && modal.contains(this._selectedEl)) ? this._selectedEl : null));
    if (!el) return false;

    const myCallsign = (this.profile && this.profile.social && this.profile.social.callsign) || 'OPERATOR';
    const isCorpseSource = !!(
      this.activeLootSource && (
        String(this.activeLootSource.containerId || '').startsWith('corpse_') ||
        this.activeLootSource.operatorEquipment
      )
    );

    let itemId = null;
    let itemName = null;
    let qty = 1;
    let sourceKind = 'player';
    let worldPos = null;
    let sourceTitle = myCallsign;

    if (el.classList.contains('inv-slot')) {
      const ctx = el.dataset ? el.dataset.context : '';
      const idx = el.dataset ? parseInt(el.dataset.idx, 10) : -1;
      if (ctx === 'container') {
        if (!this.activeLootSource || !Array.isArray(this.activeLootSource.items)) return false;
        const it = this.activeLootSource.items[idx];
        if (!it || it.revealed === false || !GAME_DATA.ITEMS[it.id]) return false;
        itemId = it.id;
        itemName = GAME_DATA.ITEMS[it.id].name;
        qty = it.qty || 1;
        sourceKind = isCorpseSource ? 'body' : 'container';
        worldPos = this.activeLootSource.worldPos || null;
        sourceTitle = this.activeLootSource.title || (isCorpseSource ? 'BODY' : 'CONTAINER');
      } else if (ctx === 'container_wpn') {
        const eq = this.activeLootSource && this.activeLootSource.operatorEquipment;
        if (!eq || !eq.backpackWeapon || !GAME_DATA.ITEMS[eq.backpackWeapon]) return false;
        itemId = eq.backpackWeapon;
        itemName = GAME_DATA.ITEMS[itemId].name;
        qty = 1;
        sourceKind = 'body';
        worldPos = this.activeLootSource.worldPos || null;
        sourceTitle = this.activeLootSource.title || 'BODY';
      } else if (ctx === 'backpack_weapon') {
        if (!player.backpackWeapon || !GAME_DATA.ITEMS[player.backpackWeapon.id]) return false;
        itemId = player.backpackWeapon.id;
        itemName = GAME_DATA.ITEMS[itemId].name;
        qty = 1;
        sourceKind = 'player';
      } else if (ctx === 'backpack') {
        const it = Array.isArray(player.backpack) ? player.backpack[idx] : null;
        if (!it || !GAME_DATA.ITEMS[it.id]) return false;
        itemId = it.id;
        itemName = GAME_DATA.ITEMS[it.id].name;
        qty = it.qty || 1;
        sourceKind = 'player';
      } else {
        return false;
      }
    } else if (el.classList.contains('op-slot-card')) {
      if (el.dataset && el.dataset.unrevealed === '1') return false;
      const opKey = el.dataset ? (el.dataset.opKey || el.dataset.key) : '';
      if (!opKey) return false;
      const inEnemyOp = !!el.closest('#loot-enemy-op-slots');
      if (inEnemyOp) {
        const eq = this.activeLootSource && this.activeLootSource.operatorEquipment;
        if (!eq) return false;
        if (opKey === 'cash') {
          if ((eq.cash || 0) <= 0) return false;
          itemName = `CASH ₽${eq.cash.toLocaleString()}`;
        } else if (opKey === 'plates') {
          if ((eq.plates || 0) <= 0) return false;
          itemId = 'armor_plate';
          itemName = 'ARMOR PLATE';
          qty = eq.plates;
        } else if (opKey === 'dogtag') {
          if (!eq.dogtag) return false;
          itemId = 'dogtag';
          itemName = eq.dogtagOwner ? `${eq.dogtagOwner} DOGTAG` : 'OPERATOR DOGTAG';
        } else {
          const eqId = eq[opKey];
          if (!eqId || !GAME_DATA.ITEMS[eqId]) return false;
          itemId = eqId;
          itemName = GAME_DATA.ITEMS[eqId].name;
        }
        sourceKind = 'body';
        worldPos = this.activeLootSource.worldPos || null;
        sourceTitle = this.activeLootSource.title || 'BODY';
      } else {
        if (opKey === 'primary' || opKey === 'secondary') {
          const wObj = player.slots && player.slots[opKey];
          if (!wObj || !GAME_DATA.ITEMS[wObj.id]) return false;
          itemId = wObj.id;
          itemName = GAME_DATA.ITEMS[wObj.id].name;
        } else if (opKey === 'cash') {
          if ((player.cash || 0) <= 0) return false;
          itemName = `CASH ₽${player.cash.toLocaleString()}`;
        } else if (opKey === 'dogtag') {
          itemId = 'dogtag';
          itemName = `${myCallsign} DOGTAG`;
        } else {
          const slotIt = this._getPlayerOperatorSlotItem(player, opKey);
          if (!slotIt || !GAME_DATA.ITEMS[slotIt.id]) return false;
          itemId = slotIt.id;
          itemName = GAME_DATA.ITEMS[slotIt.id].name;
          qty = slotIt.qty || 1;
        }
        sourceKind = 'player';
      }
    } else {
      return false;
    }

    if (!itemName) return false;
    el.style.boxShadow = '0 0 0 2px #69f0ae, 0 0 14px rgba(105, 240, 174, 0.75)';
    setTimeout(() => {
      if (el && el.style) el.style.boxShadow = '';
    }, 420);

    if (typeof this.onInventoryPing === 'function') {
      this.onInventoryPing({
        itemId,
        itemName,
        qty,
        sourceKind,
        worldPos,
        sourceTitle
      });
    }
    return true;
  }
}
