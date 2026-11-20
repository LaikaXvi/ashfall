// Hideout Persistence, Trader, Stash, Loadout, In-Raid HUD & Loot Modals
window.DEV_MODE = true;
window.SQUAD_PVP = false;
window.MOUSE_SENS = 1.0;
window.BASE_FOV = 75;
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

    this.profile = this._loadProfile();
    this._normalizeStash();
    window.KEYBINDS = { ...window.DEFAULT_KEYBINDS, ...(this.profile.keybinds || {}) };
    window.GAMEPAD_BINDS = { ...window.DEFAULT_GAMEPAD_BINDS, ...(this.profile.gamepadBinds || {}) };
    this.keybindsTab = 'kbm';
    this._initSocial();
    this._bindHideoutEvents();
    this._bindWeaponStagingModal();
    this._bindSpatialKeyboardNav();
    this._bindDragAndDrop();
    window.addEventListener('resize', () => this._updateDeployResponsiveScale());
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
    const slotSel = this._dragState
      ? '.inv-slot:not(.searching)'
      : '.inv-slot:not(.empty-slot):not(.searching)';
    const selector = [
      'button:not(:disabled)',
      'input[type="range"]',
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
          if (opts.inputMode === 'gamepad') {
            this.showItemPopout(this._selectedEl, ctxName, item, idx, { inputMode: 'gamepad', mode: 'all' });
          }
        }
      } else if (opts.inputMode === 'gamepad' && lootMod && !lootMod.classList.contains('hidden')) {
        this.hideItemPopout();
      }
    }
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
    const first = items[0];
    this.setSelectedElement(first, opts);
    return first;
  }

  moveSpatialSelection(dir, opts = {}) {
    const scope = this._getNavScope();
    if (!scope) return false;
    const items = this._getSpatialFocusables(scope);
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

      let primary = 0;
      let perp = 0;
      if (dir === 'right') { if (dx <= 6) continue; primary = dx; perp = Math.abs(dy); }
      else if (dir === 'left') { if (dx >= -6) continue; primary = -dx; perp = Math.abs(dy); }
      else if (dir === 'down') { if (dy <= 6) continue; primary = dy; perp = Math.abs(dx); }
      else if (dir === 'up') { if (dy >= -6) continue; primary = -dy; perp = Math.abs(dx); }

      const score = primary + perp * 2.4;
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
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' && document.activeElement.type !== 'range') return;
      if (tag === 'TEXTAREA' || tag === 'SELECT') return;

      const scope = this._getNavScope();
      if (!scope) return;

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
        return eq[k] ? { id: eq[k], qty: 1, rarityOverride: (k === 'primary' ? eq.primaryRarity : (k === 'secondary' ? eq.secondaryRarity : null)) } : null;
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
        friends: []
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
            this.profile.weaponStash.push({ id: item.id, qty: 1, ...(item.mods ? { mods: item.mods } : {}) });
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
        this.profile.weaponStash.push({ id: L.backpackWeapon, qty: 1 });
      }
      L.backpackWeapon = null;
    }
    L.backpackItems = L.backpackItems.filter((item) => {
      if (!item || !GAME_DATA.ITEMS[item.id]) return false;
      const def = GAME_DATA.ITEMS[item.id];
      if (def.type === 'weapon') {
        if (hasWpnSlot && !L.backpackWeapon) {
          L.backpackWeapon = item.id;
        } else if (this.profile.weaponStash.length < 16) {
          this.profile.weaponStash.push({ id: item.id, qty: 1 });
        }
        return false;
      }
      return true;
    });
  }

  _updateDeployResponsiveScale() {
    const deployEl = document.getElementById('menu-view-deploy');
    if (!deployEl || deployEl.classList.contains('hidden')) return;
    const topbar = document.getElementById('menu-topbar');
    const topH = (topbar && !topbar.classList.contains('hidden')) ? topbar.offsetHeight : 54;
    const availH = Math.max(360, window.innerHeight - topH - 36);
    const availW = Math.max(640, window.innerWidth - 48);

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

      if (msg.type === 'presence_req') {
        // Newly connected player asked who is online — reply immediately!
        if (this._broadcastPresence) this._broadcastPresence();
        return;
      }

      if (msg.type === 'presence' || msg.type === 'rename') {
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

      // === REAL CROSS-DEVICE PARTY INVITES, JOINS, READY-UP & SYNCHRONIZED DEPLOY ===
      const isAddressedToMe = (msg.toClientId && msg.toClientId === this._clientId) ||
        (msg.to && msg.to.toUpperCase() === myName);

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
          // If someone clicked Join on a non-leader member, forward them the current party sync so they join our party!
          return;
        }
        if (this.partyMembers.length >= 4) return;
        const joinName = (msg.from || 'OPERATOR').toUpperCase();
        const alreadyIn = this.partyMembers.some(m => m.clientId === msg.clientId || m.name.toUpperCase() === joinName);
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
        this.renderSocial();
        this.renderHideout();
        if (this.matchmakingStage && this.matchmakingStage.active) this.matchmakingStage.refreshSquadUI(true);
        if (!alreadyIn) this._showSocialToast(`${joinName} joined your party!`);
        return;
      }

      if (msg.type === 'party_sync' && msg.partyId && Array.isArray(msg.members)) {
        const includesMe = msg.members.some(m => m.clientId === this._clientId || (m.name && m.name.toUpperCase() === myName));
        if (msg.partyId !== this.partyId && !includesMe) return;
        this.partyId = msg.partyId;
        this._partySynced = true;
        const myPrev = this.partyMembers.find(m => m.isSelf);
        this.partyHost = msg.hostName || this.partyHost;
        this.partyMembers = msg.members.map((m) => ({
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
        this.renderSocial();
        this.renderHideout();
        if (this.matchmakingStage && this.matchmakingStage.active) this.matchmakingStage.refreshSquadUI(true);
        return;
      }

      if (msg.type === 'party_ready' && msg.partyId && msg.partyId === this.partyId) {
        const m = this.partyMembers.find(it => it.clientId === msg.clientId || it.name.toUpperCase() === (msg.from || '').toUpperCase());
        if (m) {
          m.ready = !!msg.ready;
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
    const friends = this.profile.social.friends;
    if (friends.some(f => f.name.toUpperCase() === verifiedTag)) {
      this._showSocialToast(`${verifiedTag} is already on your friends list.`);
      return;
    }
    friends.push({
      name: verifiedTag,
      favorite: false
    });
    this.saveProfile();
    this.renderSocial();
    this._showSocialToast(`Added ${verifiedTag} as a friend.`);
  }

  toggleFavoriteFriend(friendName) {
    const friends = this.profile.social.friends || [];
    const f = friends.find(it => it.name === friendName);
    if (!f) return;
    f.favorite = !f.favorite;
    this.saveProfile();
    this.renderSocial();
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
    this.renderSocial();
    this.renderHideout();
    this._showSocialToast(`Joined ${inv.from}'s party!`);
  }

  declinePendingPartyInvite() {
    this.pendingPartyInvite = null;
    this.renderSocial();
  }

  inviteFriendToParty(friendName) {
    if (this.partyMembers.length >= 4) {
      this._showSocialToast('Party is full (4/4).');
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
    this.renderSocial();
    this.renderHideout();
    this._showSocialToast(`Joining ${peer.name}'s party...`);
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
    const fCountEl = document.getElementById('friends-count');
    if (fCountEl) fCountEl.textContent = friends.length;
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
        ? `YOUR PARTY (${this.partyMembers.length}/4)`
        : `${this.partyHost}'S PARTY (${this.partyMembers.length}/4)`;
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
      if (friends.length === 0) {
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
        const isFriend = friends.some(f => f.name === p.name);
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
        }
        return p;
      }
    } catch (e) {}
    return this._defaultProfile();
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
    this.activeMenuTab = tabName;
    const isHome = tabName === 'home';
    const topbar = document.getElementById('menu-topbar');
    const homeView = document.getElementById('menu-view-home');
    if (topbar) topbar.classList.toggle('hidden', isHome);
    if (homeView) homeView.classList.toggle('hidden', !isHome);

    ['deploy', 'traders', 'map', 'matchmaking', 'workbench', 'stash', 'operator', 'settings', 'keybinds'].forEach((t) => {
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
    // Main menu option list buttons
    document.querySelectorAll('.menu-option[data-menu-action]').forEach((btn) => {
      const action = btn.dataset.menuAction;
      if (action === 'gunsmith') return; // handled directly by GunsmithController via #btn-open-gunsmith
      btn.addEventListener('click', () => this.openMenuTab(action));
    });

    // Top bar back & quick-switch sub-navigation
    const backBtn = document.getElementById('btn-menu-home');
    if (backBtn) backBtn.addEventListener('click', () => this.openMenuTab('home'));
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
          syncSettingsUI();
        });
      }
    });
    ['setting-sens', 'pause-setting-sens'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          window.MOUSE_SENS = parseFloat(el.value) || 1.0;
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
    const pauseSettingsPanel = document.getElementById('pause-settings-panel');
    if (pauseSettingsBtn && pauseSettingsPanel) {
      pauseSettingsBtn.addEventListener('click', () => {
        syncSettingsUI();
        const isOpen = !pauseSettingsPanel.classList.toggle('hidden');
        pauseSettingsBtn.style.borderColor = isOpen ? '#f5a623' : '';
        pauseSettingsBtn.style.color = isOpen ? '#f5a623' : '';
      });
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
      ['pm9', 'g17', 'mp5k', 'ak74m', 'm870', 'm24', 'vest_1plate', 'vest_2plate_gel', 'vest_2plate_helmet', 'vest_3plate', 'bag_large', 'bag_weapon', 'boss_key', 'melee_karambit', 'fu_dead_silence', 'ks_uav', 'ks_airstrike'].forEach(id => this.addToStash(id, 1));
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

  addToStash(id, qty = 1, mods = null) {
    this._normalizeStash();
    const def = GAME_DATA.ITEMS[id];
    if (!def) return false;
    // Weapons always go into the 15 dedicated double-wide weapon stash slots!
    if (def.type === 'weapon') {
      let added = 0;
      for (let i = 0; i < qty && this.profile.weaponStash.length < 16; i++) {
        this.profile.weaponStash.push({ id, qty: 1, ...(mods ? { mods } : {}) });
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

  _renderInvSlotInner(item, def, opts = {}) {
    const wide = !!(opts.wide);
    const typeLbl = opts.typeLabel || this._getItemTypeLabel(def);
    const totalVal = (def.value || 0) * (item.qty || 1);
    const valLbl = this._formatShortValue(totalVal);
    const iconCls = wide ? 'slot-icon-img wide-weapon-icon' : 'slot-icon-img';
    const wpnTag = (wide && def && def.type === 'weapon')
      ? `<span class="slot-wpn-tag">${def.name}</span>`
      : '';
    return `
      <div class="slot-top-bar">
        <span class="slot-type">${typeLbl}</span>
        ${valLbl ? `<span class="slot-price">${valLbl}</span>` : ''}
      </div>
      ${this._renderItemIconHTML(item.id, def, { wide, cls: iconCls, mods: item.mods })}
      ${wpnTag}
      ${item.qty > 1 ? `<span class="slot-qty">${item.qty}</span>` : ''}
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
        return `<img class="${cls}" src="${url}" alt="${alt}" draggable="false" />`;
      }
    }
    return `<span class="slot-name">${this._getItemShortTag(id, def)}</span>`;
  }

  _getItemShortTag(id, def) {
    const map = {
      pm9: 'PM9', g17: 'G17', mp5k: 'MP5', ak74m: 'AK', m870: '870', m24: 'M24',
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
          const rar = def.rarity || 'common';
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
        const rar = def.rarity || 'common';
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

    // 2. Operator Equipment Slots — 5-Column Tactical Grid (Cash/Plates/Dogtag/Headgear/Self-Revive | Primary/Vest/Secondary | Tactical/Lethal/Backpack/FieldUpgrade/Killstreak | Melee)
    const myCallsign = (this.profile && this.profile.social && this.profile.social.callsign) || 'OPERATOR';
    this._renderOperatorTacticalGrid(opSlotsEl, {
      cash: this.profile.credits || 0,
      cashLabel: 'CREDITS',
      plates: L.plates || 0,
      dogtag: 'dogtag',
      dogtagText: myCallsign,
      headgear: L.headgear,
      selfRevive: L.selfRevive,
      primary: L.primary,
      armor: L.armor,
      secondary: L.secondary,
      tactical: L.tactical,
      tacticalQty: L.tacticalQty || 0,
      lethal: L.lethal,
      lethalQty: L.lethalQty || 0,
      backpack: L.backpack,
      fieldUpgrade: L.fieldUpgrade,
      killstreak: L.killstreak,
      melee: L.melee
    }, (key) => {
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
        this.addToStash(L[key], 1);
        L[key] = null;
        if (key === 'backpack' && L.backpackWeapon) {
          this.addToStash(L.backpackWeapon, 1);
          L.backpackWeapon = null;
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
        wSlot.classList.add(`rarity-${wDef.rarity || 'common'}`);
        wSlot.innerHTML = this._renderInvSlotInner({ id: L.backpackWeapon, qty: 1 }, wDef, { wide: true, typeLabel: 'WPN SLOT' });
        wSlot.title = `${wDef.name} (Backpack Weapon Slot) — Click to return to Weapon Stash`;
        wSlot.addEventListener('click', () => {
          this.addToStash(L.backpackWeapon, 1);
          L.backpackWeapon = null;
          this.saveProfile();
          this.renderHideout();
        });
      } else {
        wSlot.classList.add('empty-slot');
        wSlot.innerHTML = `<div class="slot-top-bar"><span class="slot-type">WPN SLOT</span></div><span class="empty-wpn-hint">WEAPON SLOT</span>`;
      }
      bagGrid.appendChild(wSlot);
    }

    for (let i = 0; i < maxBagSlots; i++) {
      const item = L.backpackItems[i];
      const cell = document.createElement('div');
      cell.className = 'inv-slot';
      if (item && GAME_DATA.ITEMS[item.id]) {
        const def = GAME_DATA.ITEMS[item.id];
        cell.classList.add(`rarity-${def.rarity || 'common'}`);
        cell.innerHTML = this._renderInvSlotInner(item, def);
        cell.title = `${def.name}${item.qty > 1 ? ' x' + item.qty : ''} — Click to return to Stash`;
        cell.addEventListener('click', () => {
          this.addToStash(item.id, item.qty);
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

  _openDeployStashWeaponStaging(weaponStashIdx) {
    const wItem = this.profile.weaponStash[weaponStashIdx];
    if (!wItem || !GAME_DATA.ITEMS[wItem.id]) return;
    const L = this.profile.loadout;
    const bagDef = GAME_DATA.ITEMS[L.backpack || 'bag_small'];
    const hasWeaponBag = !!(bagDef && bagDef.weaponSlot);
    const allMods = this.profile.weaponMods || {};

    this.openWeaponStagingModal({
      weaponId: wItem.id,
      mods: wItem.mods || allMods[wItem.id] || null,
      sourceLabel: 'WEAPON STASH',
      slots: [
        { key: 'primary', title: '[1] PRIMARY WEAPON', currentId: L.primary, currentMods: L.primary ? allMods[L.primary] : null, available: true },
        { key: 'secondary', title: '[2] SECONDARY WEAPON', currentId: L.secondary, currentMods: L.secondary ? allMods[L.secondary] : null, available: true },
        { key: 'backpackWeapon', title: '[PACK] BACKPACK WEAPON SLOT', currentId: L.backpackWeapon, currentMods: L.backpackWeapon ? allMods[L.backpackWeapon] : null, available: hasWeaponBag, lockReason: 'REQUIRES WEAPON BACKPACK (16 + WPN)' }
      ],
      onSelectSlot: (targetKey) => {
        const prevId = L[targetKey];
        this.profile.weaponStash.splice(weaponStashIdx, 1);
        if (prevId) this.addToStash(prevId, 1);
        L[targetKey] = wItem.id;
        this.saveProfile();
        this.renderHideout();
      }
    });
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
      ['sprint', 'Sprint / 2x Tactical Sprint'],
      ['jump', 'Jump / Stand / Slide-Cancel'],
      ['crouch', 'Crouch / Slide / Hold Prone'],
      ['interactReload', 'Loot / Interact / Reload'],
      ['swapPlates', 'Tap: Swap Weapon · Hold: Armor Plates'],
      ['lethal', 'Lethal Throwable (LB+RB: Field Upgrade)'],
      ['tactical', 'Tactical Throwable (LB+RB: Field Upgrade)'],
      ['melee', 'Tap: Quick Melee · Hold: Equip Melee'],
      ['medkit', 'Use Field Medkit'],
      ['backpack', 'Open Backpack (Hold: Stow Ground Weapon)'],
      ['inspect', 'Inspect Weapon'],
      ['killstreak', 'Activate Killstreak'],
      ['map', 'Toggle Full-Size Tactical Map'],
      ['pause', 'Pause Menu']
    ];
    ctrlPane.innerHTML = '';

    const stickRows = [
      ['LEFT STICK', 'Move / Inventory Cursor'],
      ['RIGHT STICK', 'Aim / Look (Rotational Aim Assist)']
    ];
    for (const [keyTxt, desc] of stickRows) {
      const row = document.createElement('div');
      row.className = 'ctrl-row';
      row.innerHTML = `<b style="min-width:110px;">${keyTxt}</b><span>${desc}</span>`;
      ctrlPane.appendChild(row);
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
      ctrlPane.appendChild(row);
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
    ctrlPane.appendChild(gpResetRow);
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
      if (L[targetSlot]) this.addToStash(L[targetSlot], 1);
      L[targetSlot] = item.id;
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
          this.addToStash(L.backpackWeapon, 1);
          L.backpackWeapon = null;
        }
        while (L.backpackItems.length > newMax) {
          const extra = L.backpackItems.pop();
          if (extra) this.addToStash(extra.id, extra.qty);
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
        L.backpackItems.push({ id: item.id, qty: item.qty });
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
        if (!canCraft) return;
        for (const [mId, need] of Object.entries(r.inputs)) consumeMat(mId, need);
        this.addToStash(r.output, r.qty || 1);
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

  renderLoadout() {
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
        if (this.profile.credits < price) return;
        this.profile.credits -= price;
        if (def.type === 'ammo') {
          this.profile.loadout.ammo[id] = (this.profile.loadout.ammo[id] || 0) + qty;
        } else {
          this.addToStash(id, qty);
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
    if (key.includes('m24') || key.includes('sniper')) {
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

  showXpFeedback({ label = 'KILL', xp = 100, isDowned = false, isRevive = false } = {}) {
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
    row.className = 'xp-event-row' + (isDowned ? ' downed' : '') + (isRevive ? ' revive' : '');
    row.textContent = label;
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
        ? 'Hold [E] — Reviving eliminated teammate takes longer'
        : 'Hold [E] — Move with WASD to drag teammate into cover';
      return;
    }

    if (player && player.isDowned) {
      banner.classList.remove('hidden');
      const beingRevived = !!player.beingRevivedBy;
      banner.classList.toggle('reviving', beingRevived);
      if (beingRevived) {
        const pct = Math.round((player.reviveProgress || 0) * 100);
        titleEl.textContent = player.beingDragged
          ? `DRAGGED TO COVER BY ${player.beingRevivedBy}`
          : `BEING REVIVED BY ${player.beingRevivedBy}`;
        timerEl.textContent = `${pct}%`;
        fillEl.style.width = `${pct}%`;
        subEl.textContent = 'Bleedout paused while being revived';
      } else {
        const pct = Math.max(0, Math.min(100, (player.downedBleedTimer / player.downedBleedMax) * 100));
        titleEl.textContent = 'DOWNED — CRAWL TO COVER';
        timerEl.textContent = `${Math.max(0, player.downedBleedTimer).toFixed(1)}s`;
        fillEl.style.width = `${pct}%`;
        subEl.textContent = player.selfRevive
          ? 'Hold [E] to Self-Revive · WASD to crawl to cover'
          : 'Use WASD to crawl · Ally must revive before bleedout expires';
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

  triggerHitmarker(headshot = false) {
    const hm = document.getElementById('hitmarker');
    hm.classList.toggle('headshot', headshot);
    hm.style.opacity = '1';
    clearTimeout(this._hmTimer);
    this._hmTimer = setTimeout(() => { hm.style.opacity = '0'; }, 120);
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
    // Timer
    const mins = Math.floor(raidTimeLeft / 60);
    const secs = Math.floor(raidTimeLeft % 60);
    document.getElementById('hud-timer').textContent =
      `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const devBadge = document.getElementById('hud-dev-badge');
    if (devBadge) devBadge.classList.toggle('hidden', !window.DEV_MODE);

    // Vitals (with DMZ 1-3 segmented armor plates)
    document.getElementById('hud-hp-bar').style.width = `${(player.hp / player.maxHp) * 100}%`;
    document.getElementById('hud-hp-val').textContent = Math.ceil(player.hp);

    const segContainer = document.getElementById('hud-plate-segments');
    if (segContainer) {
      if (player.plateSlots === 0) {
        segContainer.innerHTML = '<span style="font-size:10px;color:#8f968e;">NO VEST</span>';
      } else {
        let html = '';
        for (let i = 0; i < player.plateSlots; i++) {
          const plateVal = THREE.MathUtils.clamp(player.armor - i * 50, 0, 50);
          const pct = (plateVal / 50) * 100;
          html += `<div class="plate-seg"><div class="plate-seg-fill" style="width:${pct}%"></div></div>`;
        }
        segContainer.innerHTML = html;
      }
    }
    document.getElementById('hud-armor-val').textContent = Math.ceil(player.armor);
    const stamBar = document.getElementById('hud-stam-bar');
    if (stamBar) {
      stamBar.style.width = `${player.stamina}%`;
      stamBar.style.background = player.isTacSprinting ? '#f5a623' : '';
    }
    const stamVal = document.getElementById('hud-stam-val');
    if (stamVal) stamVal.textContent = Math.ceil(player.stamina);

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
    document.getElementById('hud-medkits').textContent = window.DEV_MODE ? '∞' : player.getMedkitCount();
    const platesEl = document.getElementById('hud-plates');
    if (platesEl) platesEl.textContent = window.DEV_MODE ? '∞' : player.plates;

    // Bottom-Right Ordnance, Melee & Field Upgrade Silhouettes
    const lethalHud = document.getElementById('hud-lethal');
    if (lethalHud) lethalHud.textContent = window.DEV_MODE ? '∞' : player.lethalQty;
    const tacHud = document.getElementById('hud-tactical');
    if (tacHud) tacHud.textContent = window.DEV_MODE ? '∞' : player.tacticalQty;

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

    // Weapon
    const wSlot = player.getActiveWeaponSlot();
    const wDef = player.getActiveWeaponDef();
    document.getElementById('hud-slot-1').classList.toggle('active', player.activeSlot === 'primary');
    document.getElementById('hud-slot-2').classList.toggle('active', player.activeSlot === 'secondary');

    if (player.activeSlot === 'melee') {
      const mDef = player.melee && GAME_DATA.ITEMS[player.melee];
      document.getElementById('hud-weapon-name').textContent = (mDef ? mDef.name : 'BARE FISTS').toUpperCase();
      document.getElementById('hud-mag').textContent = '—';
      document.getElementById('hud-reserve').textContent = mDef ? 'MELEE' : 'UNARMED';
    } else if (wDef && wSlot) {
      document.getElementById('hud-weapon-name').textContent = wDef.name.toUpperCase();
      document.getElementById('hud-mag').textContent = wSlot.mag;
      document.getElementById('hud-reserve').textContent = player.getReserveAmmo(wDef.ammoType);
    } else {
      document.getElementById('hud-weapon-name').textContent = 'BARE FISTS';
      document.getElementById('hud-mag').textContent = '—';
      document.getElementById('hud-reserve').textContent = 'UNARMED';
    }

    document.getElementById('hud-bag-value').textContent = `₽ ${player.getBackpackValue().toLocaleString()}`;
    const xpEl = document.getElementById('hud-xp-val');
    if (xpEl) xpEl.textContent = `${raidXp || 0} XP`;

    // Dynamic Crosshair (size matches exact live bullet spread cone; pulses when cooking a frag grenade!) & ADS vignette
    const chEl = document.getElementById('crosshair');
    if (chEl) {
      const cookingFrag = !!(throwableSystem && throwableSystem.state === 'prep' && throwableSystem.activeItemId === 'frag_grenade');
      const cookPulse = throwableSystem ? (throwableSystem.cookPulse || 0) : 0;
      const isThrowingKnife = !!(throwableSystem && throwableSystem.state === 'prep' && throwableSystem.activeItemId === 'throwing_knife');
      chEl.style.opacity = (player.isADS && !cookingFrag && !isThrowingKnife) ? '0' : '1';
      const hasLaser = !!(wDef && wDef.hasLaser);
      chEl.classList.toggle('laser-active', hasLaser && !cookingFrag);
      chEl.classList.toggle('cook-pulse', cookPulse > 0.15);
      const fovRad = ((weaponSystem.camera ? weaponSystem.camera.fov : 75) * Math.PI) / 180;
      const spreadPx = (Math.tan(weaponSystem.currentSpread || 0.02) / Math.tan(fovRad / 2)) * (window.innerHeight * 0.5);
      const baseGap = isThrowingKnife ? 6 : THREE.MathUtils.clamp(spreadPx, 5, 92);
      const gapPx = baseGap + cookPulse * 18;
      chEl.style.setProperty('--ch-gap', `${gapPx.toFixed(1)}px`);
    }
    document.getElementById('ads-vignette').style.opacity = player.isADS ? '1' : '0';

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
    const halfSize = world.mapHalfSize || 190;
    const viewExtent = halfSize + 48; // show generous 48m Red Zone border on all 4 sides!
    const scale = W / (viewExtent * 2);
    const toMap = (wx, wz) => ({
      x: W * 0.5 + wx * scale,
      y: H * 0.5 + wz * scale
    });

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

    // Tactical coordinate grid inside playable sector
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let g = -160; g <= 160; g += 40) {
      const p1 = toMap(g, -halfSize);
      const p2 = toMap(g, halfSize);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      const q1 = toMap(-halfSize, g);
      const q2 = toMap(halfSize, g);
      ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
    }
    ctx.restore();

    // 3. Highway & Ring Road Network
    ctx.save();
    ctx.strokeStyle = 'rgba(130, 138, 132, 0.34)';
    const drawRoad = (x1, z1, x2, z2, lw) => {
      const a = toMap(x1, z1);
      const b = toMap(x2, z2);
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    };
    drawRoad(0, -halfSize, 0, halfSize, 11 * scale);
    drawRoad(-halfSize, -12, halfSize, -12, 11 * scale);
    drawRoad(-120, -108, 120, -108, 7 * scale);
    drawRoad(-120, 86, 120, 86, 7 * scale);
    drawRoad(-112, -112, -112, 88, 7 * scale);
    drawRoad(112, -112, 112, 88, 7 * scale);
    ctx.restore();

    // 4. Crisp Crimson Red Zone Boundary Border & Labels
    ctx.save();
    ctx.strokeStyle = '#ff3d3d';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.font = 'bold 10px Consolas, monospace';
    ctx.fillStyle = '#ff6b6b';
    ctx.textAlign = 'center';
    ctx.fillText('RED ZONE // OUT OF BOUNDS', W * 0.5, tl.y * 0.58);
    ctx.fillText('RED ZONE // OUT OF BOUNDS', W * 0.5, br.y + (H - br.y) * 0.62);
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
      // Faint 150m outer coverage boundary
      ctx.strokeStyle = 'rgba(105, 240, 174, 0.16)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, maxMapR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Pulsing translucent circle radiating outwards & dissipating
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

    // 8b. Active Tactical Pings on Full-Size Map
    const pings = window.activePings || [];
    for (const pg of pings) {
      const pp = toMap(pg.position.x, pg.position.z);
      ctx.save();
      ctx.translate(pp.x, pp.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = pg.color || '#f5a623';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.strokeStyle = '#0a0d0c';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-5, -5, 10, 10);
      ctx.restore();
      ctx.save();
      ctx.font = 'bold 9.5px Consolas, monospace';
      ctx.fillStyle = pg.color || '#f5a623';
      ctx.textAlign = 'center';
      ctx.fillText(pg.label || 'PING', pp.x, pp.y - 10);
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
  openLootModal(player, title, containerItems, operatorEquipment = null, worldPos = null, camera = null) {
    this._lootPlayer = player;
    this.activeLootSource = containerItems
      ? { title, items: containerItems, operatorEquipment, worldPos: worldPos ? worldPos.clone() : null }
      : null;
    this._searchRevealProgress = 0;
    this.hideItemPopout();

    const modal = document.getElementById('loot-modal');
    const cPanel = document.getElementById('inv-container-panel');
    modal.classList.remove('hidden');
    if (cPanel) {
      cPanel.classList.toggle('hidden', !this.activeLootSource);
    }
    if (this.activeLootSource) {
      this.autoLootExistingStacks(player);
    }
    this.renderLootModal(player);
    if (this.activeLootSource && camera) {
      this.positionContainerPanel(camera);
    }
    requestAnimationFrame(() => this.ensureInitialSelection());
  }

  autoLootExistingStacks(player) {
    if (!this.activeLootSource || !player || !Array.isArray(player.backpack)) return false;
    const items = this.activeLootSource.items;
    let movedAny = false;

    // 1. Auto-stack revealed armor plates from enemy operator equipment plate slot into player's plate slot (max 6)
    const eq = this.activeLootSource.operatorEquipment;
    if (eq && eq.plates > 0 && eq.revealedSlots && eq.revealedSlots.plates) {
      const curPlates = player.plates || 0;
      const room = Math.max(0, 6 - curPlates);
      if (room > 0) {
        const move = Math.min(room, eq.plates);
        player.plates = curPlates + move;
        eq.plates -= move;
        movedAny = true;
      }
    }

    // 2. Auto-stack revealed container items: plates into operator plate slot (max 6) + stackables into existing backpack stacks
    if (Array.isArray(items) && items.length > 0) {
      for (let i = items.length - 1; i >= 0; i--) {
        const src = items[i];
        if (!src || src.revealed === false || src.qty <= 0) continue;
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

    if (movedAny && window.soundEngine && window.soundEngine.playClick) {
      try { window.soundEngine.playClick(); } catch (e) {}
    }
    return movedAny;
  }

  positionContainerPanel(camera) {
    const cPanel = document.getElementById('inv-container-panel');
    if (!cPanel || cPanel.classList.contains('hidden') || !this.activeLootSource) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const pw = cPanel.offsetWidth || 358;
    const ph = cPanel.offsetHeight || 220;
    const margin = 10;

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
    cPanel.style.transform = 'none';
  }

  closeLootModal() {
    const modal = document.getElementById('loot-modal');
    if (modal) modal.classList.add('hidden');
    this.hideItemPopout();
    this.closeWeaponStagingModal();
    this.activeLootSource = null;
    this._lootPlayer = null;
  }

  openRaidWeaponStaging(player, weaponItem, { sourceLabel = 'OPERATOR WEAPON', onComplete = null, onCancel = null } = {}) {
    if (!player || !weaponItem || !GAME_DATA.ITEMS[weaponItem.id]) return;
    const pSlot = player.slots && player.slots.primary;
    const sSlot = player.slots && player.slots.secondary;
    const bwSlot = player.backpackWeapon;
    const hasWpnBag = player.hasWeaponBackpack();

    this.openWeaponStagingModal({
      weaponId: weaponItem.id,
      mods: weaponItem.mods || null,
      mag: weaponItem.mag,
      rarityOverride: weaponItem.rarityOverride || null,
      sourceLabel,
      onCancel,
      slots: [
        {
          key: 'primary',
          title: '[1] PRIMARY WEAPON',
          currentId: pSlot ? pSlot.id : null,
          currentMods: pSlot ? pSlot.mods : null,
          currentRarity: pSlot ? pSlot.rarityOverride : null,
          available: true
        },
        {
          key: 'secondary',
          title: '[2] SECONDARY WEAPON',
          currentId: sSlot ? sSlot.id : null,
          currentMods: sSlot ? sSlot.mods : null,
          currentRarity: sSlot ? sSlot.rarityOverride : null,
          available: true
        },
        {
          key: 'backpackWeapon',
          title: '[PACK] BACKPACK WEAPON SLOT',
          currentId: bwSlot ? bwSlot.id : null,
          currentMods: bwSlot ? bwSlot.mods : null,
          currentRarity: bwSlot ? bwSlot.rarityOverride : null,
          available: hasWpnBag,
          lockReason: 'REQUIRES WEAPON BACKPACK (16 SLOTS + 1 WPN)'
        }
      ],
      onSelectSlot: (targetSlotKey) => {
        const res = player.equipWeaponInRaid(weaponItem.id, targetSlotKey, {
          mods: weaponItem.mods || {},
          mag: weaponItem.mag,
          rarityOverride: weaponItem.rarityOverride || null
        });
        if (res.equipped) {
          if (onComplete) onComplete(res, targetSlotKey);
          if (window.soundEngine && window.soundEngine.playMagIn) {
            try { window.soundEngine.playMagIn(); } catch (e) {}
          }
          const modal = document.getElementById('loot-modal');
          if (modal && !modal.classList.contains('hidden')) {
            this.renderLootModal(player);
          }
        }
      }
    });
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

    // 1. Reveal container / backpack grid items one at a time
    const items = this.activeLootSource.items;
    const nextIdx = items.findIndex(it => it && it.revealed === false);
    if (nextIdx !== -1) {
      const item = items[nextIdx];
      const def = GAME_DATA.ITEMS[item.id];
      const rarKey = item.rarityOverride || (def && def.rarity) || 'common';
      const rarInfo = (GAME_DATA.RARITIES && GAME_DATA.RARITIES[rarKey]) || { revealTime: 0.45 };
      const duration = rarInfo.revealTime || 0.45;

      this._searchRevealProgress += dt / duration;

      const ring = document.querySelector(`#loot-container-items .inv-slot[data-idx="${nextIdx}"] .reveal-ring-fg`);
      if (ring) {
        const pct = Math.min(1, this._searchRevealProgress);
        ring.style.strokeDashoffset = (100.5 * (1 - pct)).toFixed(1);
      }

      if (this._searchRevealProgress >= 1) {
        item.revealed = true;
        this._searchRevealProgress = 0;
        this.autoLootExistingStacks(this._lootPlayer);
        if (window.soundEngine && window.soundEngine.playClick) {
          try { window.soundEngine.playClick(); } catch (e) {}
        }
        this.renderLootModal(this._lootPlayer);
      }
      return;
    }

    // 2. Reveal unsearched Enemy Operator Equipment slots one at a time!
    const eq = this.activeLootSource.operatorEquipment;
    const nextKey = this._getNextUnrevealedOperatorSlot(eq);
    if (!nextKey) return;

    const rarKey = this._getOperatorSlotRarity(eq, nextKey);
    const rarInfo = (GAME_DATA.RARITIES && GAME_DATA.RARITIES[rarKey]) || { revealTime: 0.45 };
    const duration = rarInfo.revealTime || 0.45;

    this._searchRevealProgress += dt / duration;

    const ring = document.querySelector(`#loot-enemy-op-slots .op-slot-card[data-op-key="${nextKey}"] .reveal-ring-fg`);
    if (ring) {
      const pct = Math.min(1, this._searchRevealProgress);
      ring.style.strokeDashoffset = (100.5 * (1 - pct)).toFixed(1);
    }

    if (this._searchRevealProgress >= 1) {
      eq.revealedSlots[nextKey] = true;
      this._searchRevealProgress = 0;
      this.autoLootExistingStacks(this._lootPlayer);
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
      actionsHtml += `<button class="pop-act" data-act="stage_weapon">${badge('A')}Select Weapon Slot...</button>`;
      actionsHtml += `<button class="pop-act" data-act="equip_primary">Equip Primary</button>`;
      actionsHtml += `<button class="pop-act" data-act="equip_secondary">Equip Secondary</button>`;
      if (context !== 'backpack_weapon' && hasWpnBag) {
        actionsHtml += `<button class="pop-act" data-act="equip_backpack_weapon">Stow in Weapon Slot</button>`;
      }
      if ((context === 'backpack' || context === 'backpack_weapon') && hasContainer) {
        actionsHtml += `<button class="pop-act" data-act="quick">Transfer to Container</button>`;
      }
      if (context === 'backpack' || context === 'backpack_weapon') {
        actionsHtml += `<button class="pop-act danger" data-act="drop">${badge('X')}Drop to Ground</button>`;
      }
    } else {
      if (mode === 'all' || mode === 'details' || mode === 'context') {
        if (def.type === 'armor' || def.type === 'backpack' || def.type === 'field_upgrade' || def.type === 'killstreak' || def.type === 'self_revive' || def.type === 'headgear' || def.type === 'melee' || def.type === 'lethal' || def.type === 'tactical') {
          actionsHtml += `<button class="pop-act" data-act="equip_gear">Equip / Swap</button>`;
        }

        if (context === 'container') {
          actionsHtml += `<button class="pop-act" data-act="quick">${badge('A')}Quick-Move to Pack</button>`;
        } else if (context === 'backpack') {
          if (hasContainer) {
            actionsHtml += `<button class="pop-act" data-act="quick">${badge('A')}Quick-Move to Container</button>`;
          }
          if (def.type === 'plate' || def.type === 'med') {
            actionsHtml += `<button class="pop-act" data-act="use_item">Use / Apply</button>`;
          }
        }
      }
      if (canSplit) {
        actionsHtml += `<button class="pop-act" data-act="split">${badge('Y')}Split Stack</button>`;
      }
      if (context === 'backpack') {
        actionsHtml += `<button class="pop-act danger" data-act="drop">${badge('X')}Drop to Ground</button>`;
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

    // Position popout next to the slot (clamp inside viewport)
    pop.classList.remove('hidden');
    const rect = slotEl.getBoundingClientRect();
    const popW = 215;
    let left = rect.right + 8;
    if (left + popW > window.innerWidth - 10) {
      left = Math.max(10, rect.left - popW - 8);
    }
    const popH = pop.offsetHeight || 140;
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
      player.armorId = itemId;
      player.plateSlots = def.plateSlots || 2;
      player.maxArmor = def.maxArmor || 100;
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
      else if (action === 'op_to_container') this._stowPlayerOperatorSlot(player, idx, 'container');
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
            }
          });
          return;
        }
        if (player.addToBackpack(item.id, item.qty)) {
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
          this.activeLootSource.items.push({ id: item.id, qty: item.qty, revealed: true });
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

    this.hideItemPopout();
    this.renderLootModal(player);
  }

  _renderOperatorTacticalGrid(containerEl, data, onSlotClick = null, tooltipText = '', revealConfig = null, onSlotContextMenu = null) {
    if (!containerEl) return;
    const itemDef = (id) => (id && GAME_DATA.ITEMS[id]) ? GAME_DATA.ITEMS[id] : null;
    const card = (opts) => {
      const def = opts.id ? itemDef(opts.id) : null;
      const hasVal = !!(def || opts.hasValue);

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
        return `<div class="${cls}" data-op-key="${opts.key}" data-unrevealed="1">${inner}</div>`;
      }

      const rar = opts.rarity || (def ? (def.rarity || 'common') : 'common');
      const val = opts.text !== undefined ? opts.text : (def ? def.name : 'EMPTY');
      const iconId = opts.iconId !== undefined ? opts.iconId : opts.id;
      const showIcon = !!(hasVal && iconId && window.itemIcons && typeof window.itemIcons.getIcon === 'function');
      const iconHtml = showIcon
        ? this._renderItemIconHTML(iconId, def, { wide: opts.span === 2, cls: 'op-slot-icon' })
        : '';
      const badgeText = opts.sub || (showIcon && opts.badge ? opts.badge : '');
      const sub = badgeText ? `<span class="op-slot-sub">${badgeText}</span>` : '';
      const valHtml = showIcon ? '' : `<span class="op-slot-val">${val}</span>`;
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
      return `<div class="${cls}" data-op-key="${opts.key}" title="${tip.replace(/"/g, '&quot;')}" style="cursor:${clickable ? 'pointer' : 'default'};">
        <div class="op-slot-top">
          <span class="op-slot-label">${opts.label}</span>
          ${priceStr ? `<span class="op-slot-price">${priceStr}</span>` : ''}
        </div>
        ${iconHtml}
        ${valHtml}
        ${sub}
      </div>`;
    };

    const pDef = itemDef(data.primary);
    const sDef = itemDef(data.secondary);
    const tacDef = itemDef(data.tactical);
    const lethDef = itemDef(data.lethal);

    containerEl.innerHTML = `
      <div class="op-tactical-grid">
        <!-- Row 1: Cash | Plates | DOGTAG (Center) | Headgear | Self-Revive -->
        ${card({ key: 'cash', label: data.cashLabel || 'CASH', iconId: 'cash', text: `₽${(data.cash || 0).toLocaleString()}`, badge: this._formatShortValue(data.cash || 0) || '₽0', hasValue: (data.cash || 0) > 0, rarity: 'legendary' })}
        ${card({ key: 'plates', label: 'PLATES', iconId: 'armor_plate', value: (data.plates || 0) * ((GAME_DATA.ITEMS.armor_plate && GAME_DATA.ITEMS.armor_plate.value) || 400), text: `${data.plates || 0} / 6`, badge: `${data.plates || 0}/6`, hasValue: (data.plates || 0) > 0, rarity: 'rare' })}
        ${card({ key: 'dogtag', label: 'DOGTAG', id: data.dogtag, text: data.dogtag ? (data.dogtagText || 'Operator Tag') : 'LOOTED', hasValue: !!data.dogtag, rarity: 'rare', spine: true })}
        ${card({ key: 'headgear', label: 'HEAD', id: data.headgear, text: itemDef(data.headgear) ? itemDef(data.headgear).name : 'MASK / NVG' })}
        ${card({ key: 'selfRevive', label: 'REVIVE', id: data.selfRevive })}

        <!-- Row 2: PRIMARY (2 cols) | VEST (Center) | SECONDARY (2 cols) -->
        ${card({ key: 'primary', label: 'PRIMARY', id: data.primary, rarity: data.primaryRarity || undefined, sub: pDef && data.primaryMag !== undefined ? `${data.primaryMag} RDS` : '', span: 2 })}
        ${card({ key: 'armor', label: 'VEST', id: data.armor, spine: true })}
        ${card({ key: 'secondary', label: 'SECONDARY', id: data.secondary, rarity: data.secondaryRarity || undefined, sub: sDef && data.secondaryMag !== undefined ? `${data.secondaryMag} RDS` : '', span: 2 })}

        <!-- Row 3: Tactical | Lethal | BACKPACK (Center) | Field Upgrade | Killstreak -->
        ${card({ key: 'tactical', label: 'TAC', id: data.tactical, qty: data.tacticalQty || 1, text: tacDef ? `${tacDef.name.split(' ')[0]}${data.tacticalQty ? ' x' + data.tacticalQty : ''}` : 'EMPTY', badge: tacDef && data.tacticalQty ? `x${data.tacticalQty}` : '' })}
        ${card({ key: 'lethal', label: 'LETH', id: data.lethal, qty: data.lethalQty || 1, text: lethDef ? `${lethDef.name.split(' ')[0]}${data.lethalQty ? ' x' + data.lethalQty : ''}` : 'EMPTY', badge: lethDef && data.lethalQty ? `x${data.lethalQty}` : '' })}
        ${card({ key: 'backpack', label: 'PACK', id: data.backpack, spine: true })}
        ${card({ key: 'fieldUpgrade', label: 'UPG', id: data.fieldUpgrade })}
        ${card({ key: 'killstreak', label: 'STRK', id: data.killstreak })}

        <!-- Row 4: Melee (bottom-right 2 cols, matching reference) -->
        <div class="span-3" style="grid-column:span 3;"></div>
        ${card({ key: 'melee', label: 'MELEE', id: data.melee, span: 2 })}
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
        primaryMag: pSlot ? pSlot.mag : undefined,
        primaryRarity: pSlot ? pSlot.rarityOverride : null,
        armor: player.armorId,
        secondary: sSlot ? sSlot.id : null,
        secondaryMag: sSlot ? sSlot.mag : undefined,
        secondaryRarity: sSlot ? sSlot.rarityOverride : null,
        tactical: player.tactical,
        tacticalQty: player.tacticalQty,
        lethal: player.lethal,
        lethalQty: player.lethalQty,
        backpack: player.backpackId,
        fieldUpgrade: player.fieldUpgrade,
        killstreak: player.killstreak,
        melee: player.melee
      }, (k, el) => {
        // Clicking player's own Primary or Secondary weapon slot opens Weapon Slot Staging UI (move to Backpack Weapon Slot or swap!)
        if (k === 'primary' || k === 'secondary') {
          const wObj = player.slots && player.slots[k];
          if (!wObj) return;
          this.openRaidWeaponStaging(player, wObj, {
            sourceLabel: `EQUIPPED ${k.toUpperCase()}`,
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
          this.openRaidWeaponStaging(player, { id: itemId, mods: {}, rarityOverride: eq[k + 'Rarity'] || null }, {
            sourceLabel: `OPERATOR ${k.toUpperCase()}`,
            onComplete: (res) => {
              eq[k] = res.prevId || null;
              eq[k + 'Rarity'] = (res.prevSlotObj && res.prevSlotObj.rarityOverride) || null;
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
          primaryRarity: eq.primaryRarity || null,
          armor: eq.armor,
          secondary: eq.secondary,
          secondaryRarity: eq.secondaryRarity || null,
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
              this.renderLootModal(player);
            }
            return;
          }
          if (k === 'tactical' || k === 'lethal') {
            if (player.addToBackpack(itemId, 1)) {
              eq[k] = null;
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
                this.renderLootModal(player);
              }
              return;
            }
            const prev = this._swapGearWithPlayer(player, itemId);
            eq[k] = prev || null;
            this.renderLootModal(player);
          }
        }, 'Left-Click: Equip/Stage · Right-Click: Stow in Bag', { revealedMap: eq.revealedSlots, activeKey: activeOpRevealKey }, (k) => {
          // Right-Click on Enemy Operator Inventory: automatically stow items (killstreaks, vests, bags, etc.) into backpack!
          if (k === 'cash') {
            if ((eq.cash || 0) <= 0) return;
            player.cash = (player.cash || 0) + eq.cash;
            eq.cash = 0;
            this.renderLootModal(player);
            return;
          }
          if (k === 'plates') {
            if ((eq.plates || 0) <= 0) return;
            if (player.addToBackpack('armor_plate', eq.plates)) {
              eq.plates = 0;
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

        // When looting an eliminated operator, accurately match the slot count of their equipped backpack!
        let totalSlots = items.length;
        if (eq) {
          const eBagDef = eq.backpack ? GAME_DATA.ITEMS[eq.backpack] : null;
          const bagSlots = (eBagDef && (eBagDef.bagSlots || eBagDef.slots)) || 8;
          totalSlots = Math.max(bagSlots, items.length);
        }

        if (totalSlots === 0) {
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
              const effRar = item.rarityOverride || def.rarity || 'common';
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

    // 3. Backpack Grid (Right / Lower Centered — strictly capped to backpackMaxSlots, zero weight!)
    const maxSlots = player.backpackMaxSlots || 8;
    const hasWeaponBag = player.hasWeaponBackpack();
    const usedEl = document.getElementById('bag-slots-used');
    const maxEl = document.getElementById('bag-slots-max');
    if (usedEl) usedEl.textContent = Math.min(maxSlots, player.backpack.length);
    if (maxEl) {
      maxEl.textContent = hasWeaponBag
        ? `${maxSlots} + ${player.backpackWeapon ? 1 : 0}/1 WPN`
        : maxSlots;
    }
    document.getElementById('bag-total-val').textContent = `₽ ${player.getBackpackValue().toLocaleString()}`;

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
          wSlot.title = `${wDef.name} (Backpack Weapon Slot) — Left-Click: Equip/Stage · Right-Click: Options / Drop to Ground`;
          wSlot.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._hoveredSlot && this._hoveredSlot.el === wSlot && this._hoveredSlot.mode === 'details') {
              this.hideItemPopout();
            } else {
              this.showItemPopout(wSlot, 'backpack_weapon', wItem, -1, { inputMode: 'mouse', mode: 'details' });
            }
          });
          wSlot.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showItemPopout(wSlot, 'backpack_weapon', wItem, -1, { inputMode: 'mouse', mode: 'context' });
          });
        } else {
          wSlot.classList.add('empty-slot');
          wSlot.innerHTML = `<div class="slot-top-bar"><span class="slot-type">WPN SLOT</span></div><span class="empty-wpn-hint">WEAPON SLOT</span>`;
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
          slot.classList.add(`rarity-${item.rarityOverride || def.rarity || 'common'}`);
          slot.innerHTML = this._renderInvSlotInner(item, def);
          slot.title = `${def.name}${item.qty > 1 ? ' x' + item.qty : ''} (₽${(def.value * item.qty).toLocaleString()}) — Left-Click: Details/Equip · Right-Click: Drop to Ground / Split`;
          slot.addEventListener('click', (e) => {
            e.stopPropagation();
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
  }

  // ==================== SUMMARY SCREEN ====================
  showSummary(extracted, timeSurvived, kills, recoveredItems, totalValue) {
    this.showScreen('summary');
    const badge = document.getElementById('summary-status-badge');
    const title = document.getElementById('summary-title');

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
}
