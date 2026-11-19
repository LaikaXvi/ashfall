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

    this.profile = this._loadProfile();
    this._initSocial();
    this._bindHideoutEvents();
    this.openMenuTab('home');
    this.renderHideout();
  }

  _defaultProfile() {
    return {
      credits: 12500,
      raids: 0,
      extracts: 0,
      loadout: {
        primary: 'mp5k',
        secondary: 'pm9',
        armor: 'vest_2plate',
        medkits: 2,
        plates: 3,
        lethal: 'frag_grenade',
        lethalQty: 2,
        tactical: 'smoke_grenade',
        tacticalQty: 2,
        ammo: {
          ammo_9x19: 90,
          ammo_9x18: 24
        }
      },
      stash: [
        { id: 'ak74m', qty: 1 },
        { id: 'ammo_545', qty: 60 },
        { id: 'medkit', qty: 2 },
        { id: 'throwing_knife', qty: 2 },
        { id: 'concussion_grenade', qty: 2 },
        { id: 'water_filter', qty: 1 }
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
        if (p && p.loadout) {
          if (!p.loadout.lethal) { p.loadout.lethal = 'frag_grenade'; p.loadout.lethalQty = 2; }
          if (!p.loadout.tactical) { p.loadout.tactical = 'smoke_grenade'; p.loadout.tacticalQty = 2; }
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

  openMenuTab(tabName) {
    if (tabName === 'gunsmith') {
      const gsBtn = document.getElementById('btn-open-gunsmith');
      if (gsBtn) gsBtn.click();
      return;
    }
    this.activeMenuTab = tabName;
    const isHome = tabName === 'home';
    const topbar = document.getElementById('menu-topbar');
    const homeView = document.getElementById('menu-view-home');
    if (topbar) topbar.classList.toggle('hidden', isHome);
    if (homeView) homeView.classList.toggle('hidden', !isHome);

    ['deploy', 'stash', 'operator', 'settings'].forEach((t) => {
      const el = document.getElementById(`menu-view-${t}`);
      if (el) el.classList.toggle('hidden', tabName !== t);
    });
    document.querySelectorAll('.subnav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
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

    // Deploy zone cards synced with #raid-zone-select
    document.querySelectorAll('.zone-card').forEach((card) => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.zone-card').forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        const sel = document.getElementById('raid-zone-select');
        if (sel) sel.value = card.dataset.zone;
      });
    });

    // Settings controls (Main Menu + In-Raid ESC Menu bidirectionally synced)
    const syncSettingsUI = () => {
      const fov = window.BASE_FOV || 75;
      const sens = window.MOUSE_SENS || 1.0;
      const muted = !!(window.soundEngine && window.soundEngine.muted);
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
            window.soundEngine.muted = !window.soundEngine.muted;
            syncSettingsUI();
          }
        });
      }
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
      ['pm9', 'g17', 'mp5k', 'ak74m', 'm870', 'm24', 'vest_1plate', 'vest_2plate', 'vest_3plate'].forEach(id => this.addToStash(id, 1));
      this.addToStash('medkit', 5);
      this.addToStash('armor_plate', 6);
      this.saveProfile();
      this.renderHideout();
    });

    document.getElementById('btn-deploy').addEventListener('click', () => {
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
      const existing = this.profile.stash.find(i => i.id === id);
      if (existing) {
        existing.qty += qty;
        return;
      }
    }
    for (let i = 0; i < (def.stackable ? 1 : qty); i++) {
      this.profile.stash.push({ id, qty: def.stackable ? qty : 1 });
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
    div.style.borderRightColor = color;
    div.textContent = text;
    feed.prepend(div);
    setTimeout(() => div.remove(), 3500);
  }

  addKillFeedEntry(enemyName, weaponName = '', isHead = false) {
    const kf = document.getElementById('hud-kill-feed');
    if (!kf) return;

    const row = document.createElement('div');
    row.className = 'kill-feed-item' + (isHead ? ' headshot' : '');

    const playerSpan = document.createElement('span');
    playerSpan.className = 'kf-player';
    playerSpan.textContent = 'YOU';
    row.appendChild(playerSpan);

    if (weaponName) {
      const wpnSpan = document.createElement('span');
      wpnSpan.className = 'kf-weapon';
      wpnSpan.textContent = `[${weaponName.toUpperCase()}]`;
      row.appendChild(wpnSpan);
    }

    if (isHead) {
      const hsSpan = document.createElement('span');
      hsSpan.className = 'kf-hs';
      hsSpan.textContent = 'HS';
      row.appendChild(hsSpan);
    }

    const victimSpan = document.createElement('span');
    victimSpan.className = 'kf-victim';
    victimSpan.textContent = enemyName;
    row.appendChild(victimSpan);

    kf.appendChild(row);
    while (kf.children.length > 5) {
      kf.removeChild(kf.firstChild);
    }

    setTimeout(() => row.classList.add('fading'), 4000);
    setTimeout(() => row.remove(), 4400);
  }

  triggerHitmarker(headshot = false, killed = false) {
    const hm = document.getElementById('hitmarker');
    if (!hm) return;
    const now = performance.now();
    if (killed) {
      this._hmKillUntil = now + 260;
    }
    const isKillState = killed || (this._hmKillUntil && now < this._hmKillUntil);

    hm.classList.remove('active', 'headshot', 'kill');
    void hm.offsetWidth; // restart pop animation on rapid hits
    hm.classList.add('active');
    if (headshot) hm.classList.add('headshot');
    if (isKillState) hm.classList.add('kill');

    clearTimeout(this._hmTimer);
    this._hmTimer = setTimeout(() => {
      hm.classList.remove('active', 'headshot', 'kill');
    }, isKillState ? 260 : 150);
  }

  triggerKillFeedback(enemy, isHead = false, meta = {}) {
    const totalEl = document.getElementById('hud-xp-total');
    const eventsEl = document.getElementById('hud-xp-events');
    if (!totalEl || !eventsEl) return;

    const now = performance.now();
    if (!this._lastKillTime || now - this._lastKillTime > 4000) {
      this._killStreak = 1;
    } else {
      this._killStreak = (this._killStreak || 0) + 1;
    }
    this._lastKillTime = now;

    // Calculate MW-style XP breakdown
    const tier = enemy && enemy.tier ? enemy.tier : 'scav';
    const baseXp = tier === 'heavy' ? 250 : (tier === 'raider' ? 150 : 100);
    let earnedXp = baseXp;
    const bonuses = [];

    if (isHead) {
      earnedXp += 50;
      bonuses.push({ label: 'HEADSHOT', xp: 50 });
    }
    if (meta && meta.isLethal) {
      earnedXp += 50;
      bonuses.push({ label: meta.weaponName === 'THROWING KNIFE' ? 'KNIFE KILL' : 'LETHAL KILL', xp: 50 });
    }
    if (meta && typeof meta.distance === 'number' && meta.distance >= 35) {
      earnedXp += 25;
      bonuses.push({ label: 'LONGSHOT', xp: 25 });
    }
    if (this._killStreak === 2) {
      earnedXp += 50;
      bonuses.push({ label: 'DOUBLE KILL', xp: 50 });
    } else if (this._killStreak === 3) {
      earnedXp += 100;
      bonuses.push({ label: 'TRIPLE KILL', xp: 100 });
    } else if (this._killStreak >= 4) {
      earnedXp += 150;
      bonuses.push({ label: 'MULTI KILL', xp: 150 });
    }

    // Accumulate visible XP total on rapid kills (just like COD MW)
    this._activeXpTotal = (this._activeXpTotal || 0) + earnedXp;
    totalEl.textContent = `+${this._activeXpTotal} XP`;
    totalEl.classList.remove('bump');
    void totalEl.offsetWidth;
    totalEl.classList.add('visible', 'bump');

    // Primary elimination row with skull icon
    const skullSvg = '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 1C4.7 1 2 3.4 2 6.5c0 1.9 1 3.5 2.5 4.5V13c0 .6.4 1 1 1h5c.6 0 1-.4 1-1v-2c1.5-1 2.5-2.6 2.5-4.5C14 3.4 11.3 1 8 1zM5.6 8.2a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4.8 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zM6.5 12v-1.2h1V12h-1zm2 0v-1.2h1V12h-1z"/></svg>';
    const killLabel = tier === 'heavy' ? 'JUGGERNAUT ELIMINATED' : 'KILL';

    const mainRow = document.createElement('div');
    mainRow.className = 'xp-event-row kill-main';
    mainRow.innerHTML = `<span class="xp-skull">${skullSvg}</span><span>${killLabel}</span><span class="xp-event-val">+${baseXp}</span>`;
    eventsEl.prepend(mainRow);

    for (const b of bonuses) {
      const bRow = document.createElement('div');
      bRow.className = 'xp-event-row bonus';
      bRow.innerHTML = `<span>${b.label}</span><span class="xp-event-val">+${b.xp}</span>`;
      eventsEl.appendChild(bRow);
    }

    while (eventsEl.children.length > 4) {
      eventsEl.removeChild(eventsEl.lastChild);
    }

    clearTimeout(this._xpFadeTimer);
    clearTimeout(this._xpClearTimer);
    this._xpFadeTimer = setTimeout(() => {
      totalEl.classList.remove('visible', 'bump');
      Array.from(eventsEl.children).forEach(el => el.classList.add('fading'));
    }, 2000);
    this._xpClearTimer = setTimeout(() => {
      this._activeXpTotal = 0;
      eventsEl.innerHTML = '';
    }, 2350);
  }

  clearCombatHUD() {
    const kf = document.getElementById('hud-kill-feed');
    if (kf) kf.innerHTML = '';
    const totalEl = document.getElementById('hud-xp-total');
    if (totalEl) {
      totalEl.textContent = '';
      totalEl.classList.remove('visible', 'bump');
    }
    const eventsEl = document.getElementById('hud-xp-events');
    if (eventsEl) eventsEl.innerHTML = '';
    const hm = document.getElementById('hitmarker');
    if (hm) hm.classList.remove('active', 'headshot', 'kill');
    clearTimeout(this._hmTimer);
    clearTimeout(this._xpFadeTimer);
    clearTimeout(this._xpClearTimer);
    this._hmKillUntil = 0;
    this._activeXpTotal = 0;
    this._killStreak = 0;
    this._lastKillTime = 0;
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

  updateHUD(player, world, raidTimeLeft, weaponSystem, throwableSystem = null) {
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
    const lethalHud = document.getElementById('hud-lethal');
    if (lethalHud) {
      const lTag = player.lethal === 'throwing_knife' ? 'KNIFE' : 'FRAG';
      lethalHud.textContent = `${lTag} ${window.DEV_MODE ? '∞' : player.lethalQty}`;
    }
    const tacHud = document.getElementById('hud-tactical');
    if (tacHud) {
      const tTag = player.tactical === 'concussion_grenade' ? 'STUN' : 'SMOKE';
      tacHud.textContent = `${tTag} ${window.DEV_MODE ? '∞' : player.tacticalQty}`;
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

    // Compass
    this._updateCompass(player, world);
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

  // ==================== LOOT & BACKPACK MODAL ====================
  openLootModal(player, title, containerItems) {
    this.activeLootSource = containerItems ? { title, items: containerItems } : null;
    document.getElementById('loot-modal').classList.remove('hidden');
    this.renderLootModal(player);
  }

  closeLootModal() {
    document.getElementById('loot-modal').classList.add('hidden');
    this.activeLootSource = null;
  }

  renderLootModal(player) {
    const cList = document.getElementById('loot-container-items');
    const bList = document.getElementById('loot-backpack-items');
    const cTitle = document.getElementById('loot-container-title');
    const btnTakeAll = document.getElementById('btn-take-all');

    cList.innerHTML = '';
    if (this.activeLootSource) {
      cTitle.textContent = this.activeLootSource.title.toUpperCase();
      btnTakeAll.style.display = 'inline-block';
      if (this.activeLootSource.items.length === 0) {
        cList.innerHTML = '<p class="hint" style="padding:10px;">Empty.</p>';
      } else {
        this.activeLootSource.items.forEach((item, idx) => {
          const def = GAME_DATA.ITEMS[item.id];
          if (!def) return;
          const row = document.createElement('div');
          row.className = `item-row rarity-${def.rarity}`;
          row.innerHTML = `
            <div class="item-info">
              <div class="item-name">${def.name}${item.qty > 1 ? ' x' + item.qty : ''}</div>
              <div class="item-meta">₽ ${(def.value * item.qty).toLocaleString()} · ${(def.weight * item.qty).toFixed(1)}kg</div>
            </div>
            <button class="btn-small">TAKE</button>
          `;
          row.querySelector('button').addEventListener('click', () => {
            if (player.addToBackpack(item.id, item.qty)) {
              this.activeLootSource.items.splice(idx, 1);
              this.renderLootModal(player);
            } else {
              this.addFeedMessage('Backpack too heavy!', '#d94141');
            }
          });
          cList.appendChild(row);
        });
      }
    } else {
      cTitle.textContent = 'BACKPACK INSPECTION';
      btnTakeAll.style.display = 'none';
      cList.innerHTML = '<p class="hint" style="padding:10px;">Approach crates or fallen hostiles and press [F] to loot.</p>';
    }

    // Backpack items
    document.getElementById('bag-weight').textContent = player.getBackpackWeight();
    document.getElementById('bag-max-weight').textContent = player.maxWeight;
    document.getElementById('bag-total-val').textContent = `₽ ${player.getBackpackValue().toLocaleString()}`;

    bList.innerHTML = '';
    if (player.backpack.length === 0) {
      bList.innerHTML = '<p class="hint" style="padding:10px;">Backpack is empty.</p>';
    } else {
      player.backpack.forEach((item, idx) => {
        const def = GAME_DATA.ITEMS[item.id];
        if (!def) return;
        const row = document.createElement('div');
        row.className = `item-row rarity-${def.rarity}`;
        row.innerHTML = `
          <div class="item-info">
            <div class="item-name">${def.name}${item.qty > 1 ? ' x' + item.qty : ''}</div>
            <div class="item-meta">₽ ${(def.value * item.qty).toLocaleString()} · ${(def.weight * item.qty).toFixed(1)}kg</div>
          </div>
          <button class="btn-small btn-danger">DROP</button>
        `;
        row.querySelector('button').addEventListener('click', () => {
          player.backpack.splice(idx, 1);
          this.renderLootModal(player);
        });
        bList.appendChild(row);
      });
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
