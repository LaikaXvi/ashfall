// Hideout Persistence, Trader, Stash, Loadout, In-Raid HUD & Loot Modals
window.DEV_MODE = true;
window.MOUSE_SENS = 1.0;
window.BASE_FOV = 75;

class GameUI {
  constructor(onDeployCallback) {
    this.onDeploy = onDeployCallback;
    this.storageKey = 'ashfall_extraction_save_v1';
    this.traderCategory = 'weapons';
    this.activeMenuTab = 'home';
    this.socialTab = 'friends';
    this.activeLootSource = null; // { title, items } or null for backpack-only
    this.matchmakingStage = null;
    this._lootPlayer = null;
    this._hoveredSlot = null; // { context, idx, item, el }
    this._searchRevealProgress = 0;
    this._partyReady = false;

    this.profile = this._loadProfile();
    this._initSocial();
    this._bindHideoutEvents();
    this.openMenuTab('home');
    this.renderHideout();
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
        melee: 'melee_knife',
        armor: 'vest_2plate',
        backpack: 'bag_small',
        fieldUpgrade: 'fu_ammo_box',
        killstreak: 'ks_uav',
        medkits: 2,
        plates: 3,
        lethal: 'frag_grenade',
        lethalQty: 2,
        tactical: 'smoke_grenade',
        tacticalQty: 2,
        backpackItems: [],
        ammo: {
          ammo_9x19: 90,
          ammo_9x18: 24
        }
      },
      stash: [
        { id: 'ak74m', qty: 1 },
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
        callsign: 'NOMAD-7',
        friends: [
          { name: 'GHOST_ACTUAL', online: true, status: 'IN HIDEOUT', partyHost: 'GHOST_ACTUAL' },
          { name: 'KESTREL', online: true, status: 'IN LOBBY (1/3)', partyHost: 'KESTREL' }
        ]
      }
    };
  }

  _initSocial() {
    if (!this.profile.social) {
      this.profile.social = {
        callsign: 'NOMAD-7',
        friends: [
          { name: 'GHOST_ACTUAL', online: true, status: 'IN HIDEOUT', partyHost: 'GHOST_ACTUAL' },
          { name: 'KESTREL', online: true, status: 'IN LOBBY (1/3)', partyHost: 'KESTREL' }
        ]
      };
    }
    this.partyHost = this.profile.social.callsign;
    this.partyMembers = [{ name: this.profile.social.callsign, isSelf: true, isLeader: true }];

    // Simulated online players + live same-browser tab discovery via BroadcastChannel (zero backend!)
    this.onlinePlayers = [
      { name: 'GHOST_ACTUAL', status: 'IN HIDEOUT' },
      { name: 'KESTREL', status: 'IN LOBBY (1/3)' },
      { name: 'VEX_99', status: 'GUNSMITH' },
      { name: 'ROOK_74', status: 'DUSTLINE LOBBY' },
      { name: 'SABLE_04', status: 'IN HIDEOUT' },
      { name: 'IRONCLAD', status: 'RUSTYARD LOBBY' }
    ];

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this._socialChannel = new BroadcastChannel('ashfall_social_v1');
        this._socialChannel.onmessage = (ev) => {
          const msg = ev.data;
          if (!msg || msg.from === this.profile.social.callsign) return;
          if (msg.type === 'ping') {
            if (!this.onlinePlayers.some(p => p.name === msg.from)) {
              this.onlinePlayers.unshift({ name: msg.from, status: 'ONLINE (LOCAL TAB)' });
              this.renderSocial();
            }
            this._socialChannel.postMessage({ type: 'pong', from: this.profile.social.callsign });
          } else if (msg.type === 'pong') {
            if (!this.onlinePlayers.some(p => p.name === msg.from)) {
              this.onlinePlayers.unshift({ name: msg.from, status: 'ONLINE (LOCAL TAB)' });
              this.renderSocial();
            }
          } else if (msg.type === 'deploy_raid') {
            // If another local browser tab in our party deploys, infil together into the same zone!
            if (this.partyMembers.some(m => m.name === msg.from) && this.onDeploy) {
              this.onDeploy(msg.zoneId || 'outpost');
            }
          }
        };
        this._socialChannel.postMessage({ type: 'ping', from: this.profile.social.callsign });
      }
    } catch (e) {}
  }

  _showSocialToast(msg) {
    const el = document.getElementById('social-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this._socialToastTimer);
    this._socialToastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
  }

  addFriendByName(rawName) {
    const clean = (rawName || '').trim().toUpperCase().replace(/[^A-Z0-9_\-]/g, '').slice(0, 16);
    if (!clean || clean === this.profile.social.callsign) return;
    const friends = this.profile.social.friends;
    if (friends.some(f => f.name === clean)) {
      this._showSocialToast(`${clean} is already on your friends list.`);
      return;
    }
    const foundOnline = this.onlinePlayers.find(p => p.name === clean);
    friends.push({
      name: clean,
      online: true,
      status: foundOnline ? foundOnline.status : 'ONLINE // HIDEOUT',
      partyHost: clean
    });
    if (!foundOnline) {
      this.onlinePlayers.unshift({ name: clean, status: 'ONLINE // HIDEOUT' });
    }
    this.saveProfile();
    this.renderSocial();
    this._showSocialToast(`Added ${clean} as a friend.`);
  }

  inviteFriendToParty(friendName) {
    if (this.partyMembers.length >= 3) {
      this._showSocialToast('Party is full (3/3).');
      return;
    }
    if (this.partyMembers.some(m => m.name === friendName)) {
      this._showSocialToast(`${friendName} is already in your party.`);
      return;
    }
    const presets = [
      { weaponId: 'ak74m', gearLabel: 'AK-74M · 2-Plate' },
      { weaponId: 'mp5k', gearLabel: 'MP5-K · 2-Plate' },
      { weaponId: 'm24', gearLabel: 'M24 Marksman · 2-Plate' }
    ];
    const pick = presets[this.partyMembers.length % presets.length];
    this._showSocialToast(`Sent party invite to ${friendName}...`);
    setTimeout(() => {
      if (this.partyMembers.length >= 3 || this.partyMembers.some(m => m.name === friendName)) return;
      this.partyMembers.push({
        name: friendName,
        isSelf: false,
        isLeader: false,
        weaponId: pick.weaponId,
        gearLabel: pick.gearLabel,
        ready: true
      });
      this.renderSocial();
      this.renderHideout();
      this._showSocialToast(`${friendName} joined your party (${pick.gearLabel})!`);
    }, 550);
  }

  joinFriendParty(friendName) {
    this.partyHost = friendName;
    this.partyMembers = [
      { name: friendName, isSelf: false, isLeader: true, weaponId: 'ak74m', gearLabel: 'AK-74M · 2-Plate', ready: true },
      { name: this.profile.social.callsign, isSelf: true, isLeader: false, ready: true }
    ];
    this.renderSocial();
    this.renderHideout();
    this._showSocialToast(`Joined ${friendName}'s party.`);
  }

  leaveParty() {
    this.partyHost = this.profile.social.callsign;
    this.partyMembers = [{ name: this.profile.social.callsign, isSelf: true, isLeader: true, ready: true }];
    this.renderSocial();
    this.renderHideout();
    this._showSocialToast('Returned to your own party.');
  }

  renderSocial() {
    const friends = this.profile.social.friends || [];
    const onlineCountEl = document.getElementById('social-online-count');
    if (onlineCountEl) onlineCountEl.textContent = `${this.onlinePlayers.length} ONLINE`;
    const fCountEl = document.getElementById('friends-count');
    if (fCountEl) fCountEl.textContent = friends.length;

    // Render current party
    const partyTitle = document.getElementById('party-title');
    const leaveBtn = document.getElementById('btn-leave-party');
    const partyEl = document.getElementById('party-members');
    const isOwnParty = this.partyHost === this.profile.social.callsign;
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
      for (const m of this.partyMembers) {
        const row = document.createElement('div');
        row.className = 'party-member';
        row.innerHTML = `<span>${m.name}${m.isSelf ? ' (YOU)' : ''}</span><span class="role-tag">${m.isLeader ? 'LEADER' : 'READY'}</span>`;
        partyEl.appendChild(row);
      }
    }

    // Show/hide add-friend input bar on Friends tab
    const addBar = document.getElementById('add-friend-bar');
    if (addBar) addBar.classList.toggle('hidden', this.socialTab !== 'friends');

    const listEl = document.getElementById('social-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.socialTab === 'friends') {
      if (friends.length === 0) {
        listEl.innerHTML = '<div style="color:#8f968e;font-size:12px;padding:10px;">No friends yet. Add a callsign above or from Online Players.</div>';
        return;
      }
      friends.forEach((f, idx) => {
        const inParty = this.partyMembers.some(m => m.name === f.name);
        const row = document.createElement('div');
        row.className = 'social-row';
        row.innerHTML = `
          <div class="social-info">
            <span class="social-name"><span class="status-dot ${inParty ? 'party' : (f.online ? 'online' : 'offline')}"></span>${f.name}</span>
            <span class="social-sub">${inParty ? 'IN YOUR PARTY' : (f.online ? f.status : 'OFFLINE')}</span>
          </div>
          <div class="social-actions"></div>
        `;
        const actions = row.querySelector('.social-actions');
        if (f.online && !inParty) {
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
          friends.splice(idx, 1);
          this.saveProfile();
          this.renderSocial();
        });
        actions.appendChild(btnRem);
        listEl.appendChild(row);
      });
    } else {
      for (const p of this.onlinePlayers) {
        const isFriend = friends.some(f => f.name === p.name);
        const row = document.createElement('div');
        row.className = 'social-row';
        row.innerHTML = `
          <div class="social-info">
            <span class="social-name"><span class="status-dot online"></span>${p.name}</span>
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

    ['deploy', 'map', 'matchmaking', 'workbench', 'stash', 'operator', 'settings'].forEach((t) => {
      const el = document.getElementById(`menu-view-${t}`);
      if (el) el.classList.toggle('hidden', tabName !== t);
    });
    document.querySelectorAll('.subnav-btn').forEach((btn) => {
      const activeMatch = btn.dataset.tab === tabName ||
        (btn.dataset.tab === 'deploy' && (tabName === 'map' || tabName === 'matchmaking'));
      btn.classList.toggle('active', activeMatch);
    });
    if (tabName === 'deploy') this.renderPreMatchLoadout();
    if (tabName === 'workbench') this.renderWorkbench();
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
          this._partyReady = !this._partyReady;
          this.renderPreMatchLoadout();
          if (this._partyReady) {
            this._showSocialToast('READY! Waiting for Party Leader to select sector...');
            setTimeout(() => {
              if (this.activeMenuTab === 'deploy' && this._partyReady && !this.isPartyLeader()) {
                const zoneId = (document.getElementById('raid-zone-select') || {}).value || 'outpost';
                this.openMenuTab('matchmaking');
                if (this.matchmakingStage) this.matchmakingStage.start(zoneId);
              }
            }, 1300);
          }
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
        this.openMenuTab('matchmaking');
        if (this.matchmakingStage) this.matchmakingStage.start(zoneId);
      });
    }

    const btnMmCancel = document.getElementById('btn-mm-cancel');
    if (btnMmCancel) {
      btnMmCancel.addEventListener('click', () => {
        if (this.matchmakingStage) this.matchmakingStage.stop();
        this._partyReady = false;
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
        this.renderHideout();
        syncSettingsUI();
      });
    }
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
      this.renderHideout();
    });

    document.getElementById('btn-dev-grant').addEventListener('click', () => {
      this.profile.credits += 50000;
      ['pm9', 'g17', 'mp5k', 'ak74m', 'm870', 'm24', 'vest_1plate', 'vest_2plate_gel', 'vest_2plate_helmet', 'vest_3plate', 'bag_large', 'boss_key', 'melee_karambit', 'fu_dead_silence'].forEach(id => this.addToStash(id, 1));
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
      if (this.matchmakingStage) this.matchmakingStage.stop();
      // Ensure player at least has a fallback pistol if completely naked
      const L = this.profile.loadout;
      if (!L.primary && !L.secondary) {
        L.secondary = 'pm9';
        L.ammo.ammo_9x18 = (L.ammo.ammo_9x18 || 0) + 16;
      }
      const zoneId = document.getElementById('raid-zone-select').value;
      this.onDeploy(zoneId);
    });
  }

  addToStash(id, qty = 1) {
    const def = GAME_DATA.ITEMS[id];
    if (!def) return;
    if (def.stackable) {
      const maxStack = def.maxStack || 999;
      let rem = qty;
      for (const existing of this.profile.stash) {
        if (existing.id === id && existing.qty < maxStack) {
          const add = Math.min(rem, maxStack - existing.qty);
          existing.qty += add;
          rem -= add;
          if (rem <= 0) return;
        }
      }
      while (rem > 0) {
        const chunk = Math.min(rem, maxStack);
        this.profile.stash.push({ id, qty: chunk });
        rem -= chunk;
      }
      return;
    }
    for (let i = 0; i < qty; i++) {
      this.profile.stash.push({ id, qty: 1 });
    }
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
      deploySum.innerHTML =
        `<span>PRIMARY <b>${pName}</b></span>` +
        `<span>SIDEARM <b>${sName}</b></span>` +
        `<span>ARMOR <b>${aName}</b></span>` +
        `<span>MEDKITS <b>${L.medkits || 0}</b></span>` +
        squadHtml;
    }

    this.renderLoadout();
    this.renderStash();
    this.renderTrader();
    this.renderSocial();
    this.renderPreMatchLoadout();
    this.renderWorkbench();
  }

  // ==================== PRE-MATCH LOADOUT SETUP (64-SLOT STASH + OPERATOR + BACKPACK) ====================
  renderPreMatchLoadout() {
    const stashGrid = document.getElementById('prematch-stash-grid');
    const opSlotsEl = document.getElementById('prematch-op-slots');
    const bagGrid = document.getElementById('prematch-bag-grid');
    if (!stashGrid || !opSlotsEl || !bagGrid) return;

    const L = this.profile.loadout;
    if (!Array.isArray(L.backpackItems)) L.backpackItems = [];
    const bagDef = GAME_DATA.ITEMS[L.backpack || 'bag_small'];
    const maxBagSlots = (bagDef && bagDef.bagSlots) ? bagDef.bagSlots : 8;

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

    // 1. 64-Slot Stash Grid (Left)
    stashGrid.innerHTML = '';
    for (let i = 0; i < 64; i++) {
      const item = this.profile.stash[i];
      const cell = document.createElement('div');
      cell.className = 'inv-slot';
      if (item && GAME_DATA.ITEMS[item.id]) {
        const def = GAME_DATA.ITEMS[item.id];
        const rar = def.rarity || 'common';
        cell.classList.add(`rarity-${rar}`);
        cell.innerHTML = `
          <span class="slot-name">${def.name}</span>
          <span class="slot-val">₽${(def.value * item.qty).toLocaleString()}</span>
          ${item.qty > 1 ? `<span class="slot-qty">x${item.qty}</span>` : ''}
        `;
        cell.title = `${def.name} — Click to Equip or Pack into Backpack`;
        cell.addEventListener('click', () => {
          this._equipOrPackFromStash(i, maxBagSlots);
        });
      } else {
        cell.classList.add('empty-slot');
      }
      stashGrid.appendChild(cell);
    }

    // 2. Operator Equipment Slots (Right Top)
    const opDefs = [
      { key: 'plates', label: 'PLATE SLOT (MAX 6)', text: `${L.plates || 0} / 6 Plates`, rarity: 'rare', unequip: () => {
        if ((L.plates || 0) > 0) { L.plates -= 1; this.addToStash('armor_plate', 1); }
      }},
      { key: 'backpack', label: 'BACKPACK', id: L.backpack },
      { key: 'armor', label: 'VEST', id: L.armor },
      { key: 'fieldUpgrade', label: 'FIELD UPGRADE', id: L.fieldUpgrade },
      { key: 'killstreak', label: 'KILLSTREAK', id: L.killstreak },
      { key: 'primary', label: 'PRIMARY', id: L.primary },
      { key: 'secondary', label: 'SECONDARY', id: L.secondary },
      { key: 'melee', label: 'MELEE', id: L.melee }
    ];
    opSlotsEl.innerHTML = '';
    for (const s of opDefs) {
      const card = document.createElement('div');
      const def = s.id ? GAME_DATA.ITEMS[s.id] : null;
      const rar = def ? (def.rarity || 'common') : (s.rarity || 'common');
      card.className = `op-slot-card ${def || s.text ? `rarity-${rar}` : ''}`;
      card.innerHTML = `
        <span class="op-slot-label">${s.label}</span>
        <span class="op-slot-val">${def ? def.name : (s.text || 'EMPTY')}</span>
      `;
      card.title = 'Click to unequip back to Stash';
      card.addEventListener('click', () => {
        if (s.unequip) {
          s.unequip();
        } else if (s.id) {
          this.addToStash(s.id, 1);
          L[s.key] = null;
        }
        this.saveProfile();
        this.renderHideout();
      });
      opSlotsEl.appendChild(card);
    }

    // 3. Pre-Match Backpack Grid (Right Bottom)
    const bagCountEl = document.getElementById('prematch-bag-count');
    if (bagCountEl) bagCountEl.textContent = `${L.backpackItems.length}/${maxBagSlots}`;
    bagGrid.innerHTML = '';
    for (let i = 0; i < maxBagSlots; i++) {
      const item = L.backpackItems[i];
      const cell = document.createElement('div');
      cell.className = 'inv-slot';
      if (item && GAME_DATA.ITEMS[item.id]) {
        const def = GAME_DATA.ITEMS[item.id];
        cell.classList.add(`rarity-${def.rarity || 'common'}`);
        cell.innerHTML = `
          <span class="slot-name">${def.name}</span>
          ${item.qty > 1 ? `<span class="slot-qty">x${item.qty}</span>` : ''}
        `;
        cell.title = 'Click to return to Stash';
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

  _equipOrPackFromStash(stashIdx, maxBagSlots) {
    const item = this.profile.stash[stashIdx];
    if (!item) return;
    const def = GAME_DATA.ITEMS[item.id];
    if (!def) return;
    const L = this.profile.loadout;
    if (!Array.isArray(L.backpackItems)) L.backpackItems = [];

    const slotMap = {
      weapon: def.slot,
      armor: 'armor',
      backpack: 'backpack',
      field_upgrade: 'fieldUpgrade',
      killstreak: 'killstreak',
      melee: 'melee'
    };
    const targetSlot = slotMap[def.type];
    if (targetSlot) {
      if (L[targetSlot]) this.addToStash(L[targetSlot], 1);
      L[targetSlot] = item.id;
      this.profile.stash.splice(stashIdx, 1);
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
    } else if (def.type === 'med' && item.id === 'medkit' && (L.medkits || 0) < 4) {
      L.medkits = (L.medkits || 0) + 1;
      item.qty -= 1;
      if (item.qty <= 0) this.profile.stash.splice(stashIdx, 1);
    } else if (L.backpackItems.length < maxBagSlots) {
      L.backpackItems.push({ id: item.id, qty: item.qty });
      this.profile.stash.splice(stashIdx, 1);
    } else {
      this._showSocialToast('Backpack is full!');
      return;
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

    const medEl = document.getElementById('slot-meds');
    medEl.innerHTML = `<span>${L.medkits}x Field Medkit</span>` +
      (L.medkits > 0 ? `<button class="btn-small" id="btn-unequip-med">-1</button>` : '');
    const btnMed = document.getElementById('btn-unequip-med');
    if (btnMed) {
      btnMed.addEventListener('click', () => {
        L.medkits -= 1;
        this.addToStash('medkit', 1);
        this.saveProfile();
        this.renderHideout();
      });
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
    const list = document.getElementById('stash-list');
    list.innerHTML = '';
    if (this.profile.stash.length === 0) {
      list.innerHTML = '<p class="hint" style="padding:12px;">Stash is empty. Deploy to loot or buy gear from Rusty.</p>';
      return;
    }

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

      if (def.type === 'weapon' || def.type === 'armor') {
        const btnEq = document.createElement('button');
        btnEq.className = 'btn-small';
        btnEq.textContent = 'EQUIP';
        btnEq.addEventListener('click', () => {
          const slotKey = def.type === 'armor' ? 'armor' : def.slot;
          const prev = this.profile.loadout[slotKey];
          if (prev) this.addToStash(prev, 1);
          this.profile.loadout[slotKey] = item.id;
          this.profile.stash.splice(idx, 1);
          this.saveProfile();
          this.renderHideout();
        });
        actions.appendChild(btnEq);
      } else if (def.type === 'med') {
        const btnEq = document.createElement('button');
        btnEq.className = 'btn-small';
        btnEq.textContent = '+RIG';
        btnEq.addEventListener('click', () => {
          if (this.profile.loadout.medkits >= 4) return;
          this.profile.loadout.medkits += 1;
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
    document.getElementById('hud-medkits').textContent = window.DEV_MODE ? '∞' : player.medkits;
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

    // Weapon
    const wSlot = player.getActiveWeaponSlot();
    const wDef = player.getActiveWeaponDef();
    document.getElementById('hud-slot-1').classList.toggle('active', player.activeSlot === 'primary');
    document.getElementById('hud-slot-2').classList.toggle('active', player.activeSlot === 'secondary');

    if (wDef && wSlot) {
      document.getElementById('hud-weapon-name').textContent = wDef.name.toUpperCase();
      document.getElementById('hud-mag').textContent = wSlot.mag;
      document.getElementById('hud-reserve').textContent = player.getReserveAmmo(wDef.ammoType);
    }

    document.getElementById('hud-bag-value').textContent = `₽ ${player.getBackpackValue().toLocaleString()}`;
    const xpEl = document.getElementById('hud-xp-val');
    if (xpEl) xpEl.textContent = `${raidXp || 0} XP`;
    document.getElementById('reload-indicator').classList.toggle('hidden', !weaponSystem.isReloading);

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

    // Compass & Top-Left Live Minimap
    this._updateCompass(player, world);
    this._renderMinimap(player, world, enemyManager, squadManager);
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
    const scale = 0.85; // world meters -> px

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

    // Hostile Operators (shown when UAV active, or in combat / close)
    if (enemyManager && enemyManager.enemies) {
      const uavActive = (player.uavTimer || 0) > 0;
      for (const e of enemyManager.enemies) {
        if (e.dead) continue;
        const dist = e.position.distanceTo(player.position);
        const visible = uavActive || e.state === 'COMBAT' || dist < 24;
        if (!visible) continue;
        const p = toMap(e.position.x, e.position.z);
        ctx.fillStyle = e.isDowned ? '#ffca28' : '#ff5252';
        ctx.beginPath();
        ctx.arc(p.x, p.y, e.isDowned ? 2.5 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
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
  openLootModal(player, title, containerItems) {
    this._lootPlayer = player;
    this.activeLootSource = containerItems ? { title, items: containerItems } : null;
    this._searchRevealProgress = 0;
    this.hideItemPopout();

    const modal = document.getElementById('loot-modal');
    const cPanel = document.getElementById('inv-container-panel');
    modal.classList.remove('hidden');
    if (cPanel) {
      cPanel.classList.toggle('hidden', !this.activeLootSource);
    }
    this.renderLootModal(player);
  }

  closeLootModal() {
    const modal = document.getElementById('loot-modal');
    if (modal) modal.classList.add('hidden');
    this.hideItemPopout();
    this.activeLootSource = null;
    this._lootPlayer = null;
  }

  updateSearchReveal(dt) {
    if (!this.activeLootSource || !this._lootPlayer) return;
    const modal = document.getElementById('loot-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    const items = this.activeLootSource.items;
    const nextIdx = items.findIndex(it => it && it.revealed === false);
    if (nextIdx === -1) return;

    const item = items[nextIdx];
    const def = GAME_DATA.ITEMS[item.id];
    const rarKey = (def && def.rarity) || 'common';
    const rarInfo = (GAME_DATA.RARITIES && GAME_DATA.RARITIES[rarKey]) || { revealTime: 0.45 };
    const duration = rarInfo.revealTime || 0.45;

    this._searchRevealProgress += dt / duration;

    // Update live circular SVG ring on the currently searching slot
    const ring = document.querySelector(`#loot-container-items .inv-slot[data-idx="${nextIdx}"] .reveal-ring-fg`);
    if (ring) {
      const pct = Math.min(1, this._searchRevealProgress);
      ring.style.strokeDashoffset = (100.5 * (1 - pct)).toFixed(1);
    }

    if (this._searchRevealProgress >= 1) {
      item.revealed = true;
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

  showItemPopout(slotEl, context, item, idx) {
    const pop = document.getElementById('item-action-popout');
    if (!pop || !item || !slotEl) return;
    const def = GAME_DATA.ITEMS[item.id];
    if (!def) return;

    this._hoveredSlot = { context, item, idx, el: slotEl };
    const rarKey = def.rarity || 'common';
    const rarInfo = (GAME_DATA.RARITIES && GAME_DATA.RARITIES[rarKey]) || { label: rarKey.toUpperCase(), color: '#69f0ae' };
    const hasContainer = !!this.activeLootSource;
    const canSplit = def.stackable && item.qty > 1;

    let actionsHtml = '';
    if (context === 'container') {
      actionsHtml += `<button class="pop-act" data-act="quick"><span class="gp-btn-badge">A</span> Quick-Move to Pack</button>`;
    } else if (context === 'backpack') {
      if (hasContainer) {
        actionsHtml += `<button class="pop-act" data-act="quick"><span class="gp-btn-badge">A</span> Quick-Move to Container</button>`;
      } else if (def.type === 'weapon' || def.type === 'armor' || def.type === 'backpack' || def.type === 'field_upgrade' || def.type === 'killstreak' || def.type === 'melee' || def.type === 'plate' || def.type === 'med') {
        actionsHtml += `<button class="pop-act" data-act="quick"><span class="gp-btn-badge">A</span> Equip / Use</button>`;
      }
    }
    if (canSplit) {
      actionsHtml += `<button class="pop-act" data-act="split"><span class="gp-btn-badge">Y</span> Split Stack</button>`;
    }
    if (context === 'backpack') {
      actionsHtml += `<button class="pop-act danger" data-act="drop"><span class="gp-btn-badge">X</span> Drop Item</button>`;
    }

    pop.innerHTML = `
      <div class="pop-title" style="color:${rarInfo.color}">${def.name}${item.qty > 1 ? ' x' + item.qty : ''}</div>
      <div class="pop-meta">${rarInfo.label} · ₽${(def.value * item.qty).toLocaleString()} · ${(def.weight * item.qty).toFixed(1)}kg</div>
      <div class="pop-actions">${actionsHtml}</div>
    `;
    pop.querySelectorAll('.pop-act').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleSlotAction(btn.dataset.act);
      });
    });

    // Position popout to the RIGHT of the hovered slot (clamp inside viewport)
    pop.classList.remove('hidden');
    const rect = slotEl.getBoundingClientRect();
    const popW = 195;
    let left = rect.right + 8;
    if (left + popW > window.innerWidth - 10) {
      left = Math.max(10, rect.left - popW - 8);
    }
    const top = Math.min(window.innerHeight - 140, Math.max(12, rect.top));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  handleSlotAction(action) {
    if (!this._hoveredSlot || !this._lootPlayer) return;
    const { context, item, idx } = this._hoveredSlot;
    const player = this._lootPlayer;
    const def = GAME_DATA.ITEMS[item.id];
    if (!def) return;

    if (action === 'quick') {
      if (context === 'container' && this.activeLootSource) {
        if (item.revealed === false) return;
        if (player.addToBackpack(item.id, item.qty)) {
          this.activeLootSource.items.splice(idx, 1);
        } else {
          this.addFeedMessage('Backpack full / too heavy!', '#d94141');
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
          player.medkits += 1;
          item.qty -= 1;
          if (item.qty <= 0) player.backpack.splice(idx, 1);
        } else if (def.type === 'armor') {
          const prev = player.armorId;
          player.armorId = item.id;
          player.plateSlots = def.plateSlots || 2;
          player.maxArmor = def.maxArmor || 100;
          player.armor = Math.min(player.maxArmor, Math.max(player.armor, player.maxArmor));
          player.backpack.splice(idx, 1);
          if (prev) player.backpack.push({ id: prev, qty: 1 });
        } else if (def.type === 'backpack') {
          const prev = player.backpackId;
          player.backpackId = item.id;
          player.backpackMaxSlots = def.bagSlots || 12;
          player.maxWeight = def.maxWeight || 32;
          player.backpack.splice(idx, 1);
          if (prev) player.backpack.push({ id: prev, qty: 1 });
        } else if (def.type === 'field_upgrade') {
          const prev = player.fieldUpgrade;
          player.fieldUpgrade = item.id;
          player.backpack.splice(idx, 1);
          if (prev) player.backpack.push({ id: prev, qty: 1 });
        } else if (def.type === 'killstreak') {
          const prev = player.killstreak;
          player.killstreak = item.id;
          player.backpack.splice(idx, 1);
          if (prev) player.backpack.push({ id: prev, qty: 1 });
        } else if (def.type === 'melee') {
          const prev = player.melee;
          player.melee = item.id;
          player.backpack.splice(idx, 1);
          if (prev) player.backpack.push({ id: prev, qty: 1 });
        }
      }
    } else if (action === 'split' && def.stackable && item.qty > 1) {
      const half = Math.floor(item.qty / 2);
      item.qty -= half;
      const list = context === 'container' && this.activeLootSource ? this.activeLootSource.items : player.backpack;
      list.splice(idx + 1, 0, { id: item.id, qty: half, revealed: true });
    } else if (action === 'drop' && context === 'backpack') {
      player.backpack.splice(idx, 1);
    }

    this.hideItemPopout();
    this.renderLootModal(player);
  }

  renderLootModal(player) {
    const cList = document.getElementById('loot-container-items');
    const bList = document.getElementById('loot-backpack-items');
    const cTitle = document.getElementById('loot-container-title');
    const btnTakeAll = document.getElementById('btn-take-all');
    const opSlotsEl = document.getElementById('inv-op-slots');

    // 1. Separate Operator Equipment Section
    if (opSlotsEl) {
      const pDef = player.weapons && player.weapons.primary ? GAME_DATA.ITEMS[player.weapons.primary.id] : null;
      const sDef = player.weapons && player.weapons.secondary ? GAME_DATA.ITEMS[player.weapons.secondary.id] : null;
      const mDef = GAME_DATA.ITEMS[player.melee || 'melee_knife'];
      const vDef = player.armorId ? GAME_DATA.ITEMS[player.armorId] : null;
      const bDef = GAME_DATA.ITEMS[player.backpackId || 'bag_small'];
      const fDef = GAME_DATA.ITEMS[player.fieldUpgrade || 'fu_ammo_box'];
      const kDef = player.killstreak ? GAME_DATA.ITEMS[player.killstreak] : null;

      const opItems = [
        { label: 'PLATES (MAX 6)', name: `${player.plates} / 6`, rarity: 'rare' },
        { label: 'BACKPACK', name: bDef ? bDef.name : 'Small Pack', rarity: bDef ? bDef.rarity : 'common' },
        { label: 'VEST', name: vDef ? vDef.name : 'No Vest', rarity: vDef ? vDef.rarity : 'common' },
        { label: 'FIELD UPGRADE', name: fDef ? fDef.name : 'None', rarity: fDef ? fDef.rarity : 'rare' },
        { label: 'KILLSTREAK', name: kDef ? kDef.name : 'None', rarity: kDef ? kDef.rarity : 'common' },
        { label: 'PRIMARY', name: pDef ? pDef.name : 'None', rarity: pDef ? pDef.rarity : 'common' },
        { label: 'SECONDARY', name: sDef ? sDef.name : 'None', rarity: sDef ? sDef.rarity : 'common' },
        { label: 'MELEE', name: mDef ? mDef.name : 'Combat Knife', rarity: mDef ? mDef.rarity : 'common' }
      ];
      opSlotsEl.innerHTML = opItems.map(s => `
        <div class="op-slot-card rarity-${s.rarity || 'common'}">
          <span class="op-slot-label">${s.label}</span>
          <span class="op-slot-val">${s.name}</span>
        </div>
      `).join('');
    }

    // 2. Active Container Grid (Left) with Progressive Circular Reveal
    if (cList) {
      cList.innerHTML = '';
      if (this.activeLootSource) {
        if (cTitle) cTitle.textContent = this.activeLootSource.title.toUpperCase();
        if (btnTakeAll) btnTakeAll.style.display = 'inline-block';
        const items = this.activeLootSource.items;
        const firstUnrevealed = items.findIndex(it => it && it.revealed === false);

        if (items.length === 0) {
          cList.innerHTML = '<p class="hint" style="padding:10px;grid-column:1/-1;">Container is empty.</p>';
        } else {
          items.forEach((item, idx) => {
            const def = GAME_DATA.ITEMS[item.id];
            if (!def) return;
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            slot.dataset.context = 'container';
            slot.dataset.idx = idx;

            if (item.revealed === false) {
              slot.classList.add('searching');
              const isSearchingNow = idx === firstUnrevealed;
              slot.innerHTML = isSearchingNow
                ? `<div class="reveal-ring-wrap">
                     <svg viewBox="0 0 36 36"><circle class="reveal-ring-bg" cx="18" cy="18" r="16"/><circle class="reveal-ring-fg" cx="18" cy="18" r="16" stroke-dasharray="100.5" stroke-dashoffset="100.5"/></svg>
                     <span class="reveal-q">?</span>
                   </div>
                   <span class="slot-val">SEARCHING</span>`
                : `<span class="reveal-q" style="opacity:0.4;">?</span><span class="slot-val">QUEUED</span>`;
            } else {
              slot.classList.add(`rarity-${def.rarity || 'common'}`);
              slot.innerHTML = `
                <span class="slot-name">${def.name}</span>
                <span class="slot-val">₽${(def.value * item.qty).toLocaleString()}</span>
                ${item.qty > 1 ? `<span class="slot-qty">x${item.qty}</span>` : ''}
              `;
              slot.addEventListener('mouseenter', () => this.showItemPopout(slot, 'container', item, idx));
              slot.addEventListener('click', () => {
                this._hoveredSlot = { context: 'container', item, idx, el: slot };
                this.handleSlotAction('quick');
              });
            }
            cList.appendChild(slot);
          });
        }
      }
    }

    // 3. Backpack Grid (Right / Lower Centered)
    document.getElementById('bag-weight').textContent = player.getBackpackWeight();
    document.getElementById('bag-max-weight').textContent = player.maxWeight;
    document.getElementById('bag-total-val').textContent = `₽ ${player.getBackpackValue().toLocaleString()}`;

    if (bList) {
      bList.innerHTML = '';
      const maxSlots = player.backpackMaxSlots || 8;
      for (let idx = 0; idx < Math.max(maxSlots, player.backpack.length); idx++) {
        const item = player.backpack[idx];
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        slot.dataset.context = 'backpack';
        slot.dataset.idx = idx;

        if (item && GAME_DATA.ITEMS[item.id]) {
          const def = GAME_DATA.ITEMS[item.id];
          slot.classList.add(`rarity-${def.rarity || 'common'}`);
          slot.innerHTML = `
            <span class="slot-name">${def.name}</span>
            <span class="slot-val">₽${(def.value * item.qty).toLocaleString()}</span>
            ${item.qty > 1 ? `<span class="slot-qty">x${item.qty}</span>` : ''}
          `;
          slot.addEventListener('mouseenter', () => this.showItemPopout(slot, 'backpack', item, idx));
          slot.addEventListener('click', () => {
            this._hoveredSlot = { context: 'backpack', item, idx, el: slot };
            this.handleSlotAction('quick');
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
