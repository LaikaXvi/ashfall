// Developer Console (` Backquote toggle) — Extensible Slash-Command Framework
class DevConsole {
  constructor(ctx = {}) {
    this.ctx = ctx;
    this.isOpen = false;
    this.commands = new Map();
    this.aliases = new Map();
    this.history = [];
    this.historyIdx = -1;

    this.rootEl = document.getElementById('dev-console');
    this.logEl = document.getElementById('dev-console-log');
    this.inputEl = document.getElementById('dev-console-input');
    this.hintEl = document.getElementById('dev-console-hint');

    this._bindEvents();
    this._registerBuiltinCommands();
    this.log('ASHFALL DEV CONSOLE ready. Type /help for commands.', 'info');
  }

  registerCommand(name, config) {
    const key = name.toLowerCase().replace(/^\//, '');
    const entry = {
      name: key,
      usage: config.usage || `/${key}`,
      desc: config.desc || '',
      aliases: (config.aliases || []).map(a => a.toLowerCase().replace(/^\//, '')),
      handler: config.handler
    };
    this.commands.set(key, entry);
    for (const al of entry.aliases) {
      this.aliases.set(al, key);
    }
  }

  log(text, type = 'info') {
    if (!this.logEl) return;
    const line = document.createElement('div');
    line.className = `dev-log-line dev-log-${type}`;
    line.textContent = text;
    this.logEl.appendChild(line);
    while (this.logEl.children.length > 200) {
      this.logEl.removeChild(this.logEl.firstChild);
    }
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  open() {
    if (this.isOpen || !this.rootEl) return;
    this.isOpen = true;
    this.rootEl.classList.remove('hidden');
    if (this.ctx.onOpenChange) this.ctx.onOpenChange(true);
    setTimeout(() => {
      if (this.inputEl) {
        this.inputEl.focus();
        this.inputEl.select();
      }
    }, 10);
  }

  close() {
    if (!this.isOpen || !this.rootEl) return;
    this.isOpen = false;
    this.rootEl.classList.add('hidden');
    if (this.inputEl) this.inputEl.blur();
    if (this.ctx.onOpenChange) this.ctx.onOpenChange(false);
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') {
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        const typingElsewhere = !this.isOpen && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
        if (typingElsewhere) return;
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
        return;
      }
      if (this.isOpen && e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    }, true);

    if (!this.inputEl) return;
    this.inputEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Backquote' || e.code === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const raw = this.inputEl.value.trim();
        this.inputEl.value = '';
        this.historyIdx = -1;
        if (raw) {
          this.history.unshift(raw);
          if (this.history.length > 50) this.history.pop();
          this.execute(raw);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.history.length === 0) return;
        this.historyIdx = Math.min(this.history.length - 1, this.historyIdx + 1);
        this.inputEl.value = this.history[this.historyIdx] || '';
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.historyIdx <= 0) {
          this.historyIdx = -1;
          this.inputEl.value = '';
        } else {
          this.historyIdx -= 1;
          this.inputEl.value = this.history[this.historyIdx] || '';
        }
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        this._autocomplete();
      }
    });
  }

  _autocomplete() {
    if (!this.inputEl) return;
    const val = this.inputEl.value;
    const parts = val.split(/\s+/);
    if (parts.length <= 1) {
      const prefix = (parts[0] || '').toLowerCase().replace(/^\//, '');
      const matches = Array.from(this.commands.keys()).filter(c => c.startsWith(prefix)).sort();
      if (matches.length === 1) {
        this.inputEl.value = '/' + matches[0] + ' ';
      } else if (matches.length > 1) {
        this.log('Commands: ' + matches.map(m => '/' + m).join('  '), 'info');
      }
      return;
    }
    const cmd = parts[0].toLowerCase().replace(/^\//, '');
    const arg = (parts[1] || '').toLowerCase();
    if (cmd === 'give' && window.GAME_DATA && GAME_DATA.ITEMS) {
      const ids = ['cash', 'ammo', ...Object.keys(GAME_DATA.ITEMS)];
      const matches = ids.filter(id => id.toLowerCase().startsWith(arg)).sort();
      if (matches.length === 1) {
        this.inputEl.value = `/${cmd} ${matches[0]} `;
      } else if (matches.length > 1) {
        this.log('Items: ' + matches.slice(0, 18).join('  ') + (matches.length > 18 ? ` (+${matches.length - 18} more)` : ''), 'info');
      }
    } else if (cmd === 'spawn') {
      const types = ['scav', 'raider', 'heavy', 'boss', 'operator'];
      const matches = types.filter(t => t.startsWith(arg));
      if (matches.length === 1) this.inputEl.value = `/spawn ${matches[0]} `;
      else if (matches.length > 1) this.log('Types: ' + matches.join('  '), 'info');
    } else if (cmd === 'tp' || cmd === 'revive') {
      const sq = this.ctx.getSquadManager && this.ctx.getSquadManager();
      const names = ['self', 'all', ...((sq && sq.allies) ? sq.allies.map(a => a.name) : [])];
      const matches = names.filter(n => n.toLowerCase().startsWith(arg));
      if (matches.length === 1) this.inputEl.value = `/${cmd} ${matches[0]}`;
      else if (matches.length > 1) this.log('Targets: ' + matches.join('  '), 'info');
    }
  }

  execute(rawLine) {
    this.log(`> ${rawLine}`, 'cmd');
    const tokens = rawLine.trim().split(/\s+/);
    if (tokens.length === 0) return;
    const rawCmd = tokens[0].toLowerCase().replace(/^\//, '');
    const resolvedKey = this.commands.has(rawCmd) ? rawCmd : this.aliases.get(rawCmd);
    if (!resolvedKey) {
      this.log(`Unknown command "${tokens[0]}". Type /help for available commands.`, 'err');
      return;
    }
    const entry = this.commands.get(resolvedKey);
    const args = tokens.slice(1);
    try {
      entry.handler(args, this);
    } catch (err) {
      this.log(`Command error: ${err && err.message ? err.message : err}`, 'err');
    }
  }

  _requireRaid() {
    if (!(this.ctx.isInRaid && this.ctx.isInRaid()) || !(this.ctx.getPlayer && this.ctx.getPlayer())) {
      this.log('You must be deployed in a raid to run this command.', 'warn');
      return false;
    }
    return true;
  }

  _registerBuiltinCommands() {
    this.registerCommand('help', {
      aliases: ['?'],
      usage: '/help [command]',
      desc: 'List all developer console commands or inspect one command.',
      handler: (args) => {
        if (args[0]) {
          const k = args[0].toLowerCase().replace(/^\//, '');
          const cmd = this.commands.get(this.aliases.get(k) || k);
          if (!cmd) return this.log(`No command named "${args[0]}".`, 'err');
          this.log(`${cmd.usage} — ${cmd.desc}`, 'ok');
          return;
        }
        this.log('=== DEVELOPER COMMANDS ===', 'ok');
        for (const cmd of this.commands.values()) {
          this.log(`  ${cmd.usage.padEnd(28)} ${cmd.desc}`, 'info');
        }
      }
    });

    this.registerCommand('clear', {
      aliases: ['cls'],
      usage: '/clear',
      desc: 'Clear the console log.',
      handler: () => {
        if (this.logEl) this.logEl.innerHTML = '';
      }
    });

    this.registerCommand('give', {
      aliases: ['g'],
      usage: '/give <item_id|cash|ammo> [qty]',
      desc: 'Give an item, weapon, cash, or full ammo. Use /items to list IDs.',
      handler: (args) => {
        if (!this._requireRaid()) return;
        const player = this.ctx.getPlayer();
        const world = this.ctx.getWorld();
        const mpSession = this.ctx.getMpSession && this.ctx.getMpSession();
        if (!args[0]) return this.log('Usage: /give <item_id|cash|ammo> [qty]', 'warn');

        const query = args[0].toLowerCase();
        const qty = Math.max(1, parseInt(args[1], 10) || 1);

        if (query === 'cash' || query === 'rubles' || query === 'money') {
          const amt = parseInt(args[1], 10) || 10000;
          player.cash = (player.cash || 0) + amt;
          this.log(`Added ₽${amt.toLocaleString()} (Total: ₽${player.cash.toLocaleString()}).`, 'ok');
          return;
        }
        if (query === 'ammo') {
          if (player.ammo) {
            for (const k of Object.keys(player.ammo)) {
              player.ammo[k] = Math.max(player.ammo[k] || 0, 240);
            }
          }
          this.log('Refilled all ammo pools to 240+ rounds.', 'ok');
          return;
        }

        const items = (window.GAME_DATA && GAME_DATA.ITEMS) || {};
        let itemId = items[query] ? query : null;
        if (!itemId) {
          // Exact case-insensitive key or partial match
          const keys = Object.keys(items);
          itemId = keys.find(k => k.toLowerCase() === query)
            || keys.find(k => k.toLowerCase().includes(query))
            || keys.find(k => (items[k].name || '').toLowerCase().includes(query));
        }
        if (!itemId) {
          return this.log(`Item "${args[0]}" not found. Use /items [filter] to search.`, 'err');
        }
        const def = items[itemId];
        if (def.type === 'weapon') {
          // Equip into an empty weapon slot or backpack weapon slot, otherwise drop right at player's feet!
          if (!player.slots.primary) {
            player.equipWeaponInRaid(itemId, 'primary');
            this.log(`Equipped ${def.name} into Primary slot.`, 'ok');
          } else if (!player.slots.secondary) {
            player.equipWeaponInRaid(itemId, 'secondary');
            this.log(`Equipped ${def.name} into Secondary slot.`, 'ok');
          } else if (player.hasWeaponBackpack && player.hasWeaponBackpack() && !player.backpackWeapon) {
            player.equipWeaponInRaid(itemId, 'backpackWeapon');
            this.log(`Stowed ${def.name} into Backpack Weapon slot.`, 'ok');
          } else if (world) {
            const dropPos = new THREE.Vector3(player.position.x, 0.02, player.position.z);
            const gi = world.spawnGroundItem(itemId, 1, dropPos, { mods: null });
            if (mpSession && mpSession.active && gi) {
              mpSession.sendEvent({
                type: 'ground_drop', uid: gi.uid, id: gi.id, qty: 1,
                x: Math.round(gi.position.x * 100) / 100, y: 0.02, z: Math.round(gi.position.z * 100) / 100
              });
            }
            this.log(`Weapon slots full — dropped ${def.name} on the ground at your feet.`, 'ok');
          }
          return;
        }
        const ok = player.addToBackpack(itemId, qty, { forceBag: false });
        if (ok) {
          this.log(`Gave ${def.name} x${qty}.`, 'ok');
        } else if (world) {
          const gi = world.spawnGroundItem(itemId, qty, new THREE.Vector3(player.position.x, 0.02, player.position.z));
          if (mpSession && mpSession.active && gi) {
            mpSession.sendEvent({
              type: 'ground_drop', uid: gi.uid, id: gi.id, qty,
              x: Math.round(gi.position.x * 100) / 100, y: 0.02, z: Math.round(gi.position.z * 100) / 100
            });
          }
          this.log(`Backpack full — spawned ${def.name} x${qty} on the ground.`, 'warn');
        }
      }
    });

    this.registerCommand('revive', {
      aliases: ['rev'],
      usage: '/revive [self|all|<name>]',
      desc: 'Instantly revive yourself, a named squadmate, or everyone.',
      handler: (args) => {
        if (!this._requireRaid()) return;
        const player = this.ctx.getPlayer();
        const squadManager = this.ctx.getSquadManager && this.ctx.getSquadManager();
        const mpSession = this.ctx.getMpSession && this.ctx.getMpSession();
        const targetArg = (args[0] || 'all').toLowerCase();
        let revivedCount = 0;

        if (targetArg === 'self' || targetArg === 'me' || targetArg === 'all') {
          if (player.isDowned || player.dead || player.hp < player.maxHp) {
            player.revive(player.maxHp);
            if (mpSession && mpSession.active && mpSession.sendStateNow) mpSession.sendStateNow(player);
            revivedCount++;
            this.log('Revived self to full HP.', 'ok');
          }
        }
        if (squadManager && Array.isArray(squadManager.allies) && targetArg !== 'self' && targetArg !== 'me') {
          for (const ally of squadManager.allies) {
            if (!ally) continue;
            const match = targetArg === 'all' || (ally.name || '').toLowerCase().includes(targetArg);
            if (!match) continue;
            ally.revive(ally.maxHp || 100);
            if (ally.isRemoteHuman && mpSession && mpSession.active && ally.clientId) {
              mpSession.sendEvent({
                type: 'revive_complete',
                targetClientId: ally.clientId,
                hp: 100,
                reviverName: (this.ctx.getCallsign && this.ctx.getCallsign()) || 'CONSOLE'
              });
            }
            revivedCount++;
            this.log(`Revived squadmate ${ally.name}.`, 'ok');
          }
        }
        if (revivedCount === 0) {
          this.log('No matching downed/dead targets found.', 'warn');
        }
      }
    });

    this.registerCommand('spawn', {
      usage: '/spawn <scav|raider|heavy|boss|operator> [count]',
      desc: 'Spawn enemies in front of your crosshair.',
      handler: (args) => {
        if (!this._requireRaid()) return;
        const player = this.ctx.getPlayer();
        const world = this.ctx.getWorld();
        const scene = this.ctx.getScene && this.ctx.getScene();
        const enemyManager = this.ctx.getEnemyManager && this.ctx.getEnemyManager();
        const weaponSystem = this.ctx.getWeaponSystem && this.ctx.getWeaponSystem();
        if (!enemyManager || !scene || !world) return this.log('EnemyManager not ready.', 'err');

        const kind = (args[0] || 'scav').toLowerCase();
        const count = Math.min(10, Math.max(1, parseInt(args[1], 10) || 1));
        const validTypes = ['scav', 'raider', 'heavy', 'boss', 'operator'];
        if (!validTypes.includes(kind)) {
          return this.log(`Invalid enemy type "${kind}". Valid: ${validTypes.join(', ')}`, 'err');
        }

        const sinY = Math.sin(player.yaw);
        const cosY = Math.cos(player.yaw);
        for (let i = 0; i < count; i++) {
          const spread = (i - (count - 1) / 2) * 2.4;
          const sx = player.position.x - sinY * 12 + cosY * spread;
          const sz = player.position.z - cosY * 12 - sinY * spread;
          const pos = new THREE.Vector3(sx, 0, sz);
          const opMeta = kind === 'operator'
            ? { isOperator: true, squadName: 'DEV', callsign: `DEV-${Math.floor(10 + Math.random() * 89)}`, playstyle: 'tactical' }
            : null;
          const e = new Enemy(scene, world, pos, kind === 'operator' ? 'raider' : kind, opMeta, weaponSystem);
          e.netIdx = enemyManager.enemies.length;
          enemyManager.enemies.push(e);
        }
        this.log(`Spawned ${count}x ${kind} ~12m ahead.`, 'ok');
      }
    });

    this.registerCommand('tp', {
      aliases: ['teleport'],
      usage: '/tp <x> <z> | /tp <x> <y> <z> | /tp <teammate>',
      desc: 'Teleport to coordinates or directly to a squadmate.',
      handler: (args) => {
        if (!this._requireRaid()) return;
        const player = this.ctx.getPlayer();
        const squadManager = this.ctx.getSquadManager && this.ctx.getSquadManager();
        if (args.length === 0) return this.log('Usage: /tp <x> <z> | /tp <x> <y> <z> | /tp <teammate>', 'warn');

        if (args.length === 1 && isNaN(parseFloat(args[0]))) {
          const q = args[0].toLowerCase();
          const ally = squadManager && squadManager.allies && squadManager.allies.find(a => (a.name || '').toLowerCase().includes(q));
          if (!ally) return this.log(`Squadmate "${args[0]}" not found.`, 'err');
          player.position.set(ally.position.x + 1.5, Math.max(player.currentEyeHeight || 1.65, ally.position.y + 1.65), ally.position.z + 1.5);
          player.velocity.set(0, 0, 0);
          this.log(`Teleported to ${ally.name} (${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}).`, 'ok');
          return;
        }

        const x = parseFloat(args[0]);
        let y = player.currentEyeHeight || 1.65;
        let z;
        if (args.length >= 3) {
          y = parseFloat(args[1]);
          z = parseFloat(args[2]);
        } else {
          z = parseFloat(args[1]);
        }
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
          return this.log('Invalid coordinates. Example: /tp 0 0 or /tp 25 10 -40', 'err');
        }
        player.position.set(x, y, z);
        player.velocity.set(0, 0, 0);
        this.log(`Teleported to (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}).`, 'ok');
      }
    });

    this.registerCommand('noclip', {
      aliases: ['fly', 'nc'],
      usage: '/noclip',
      desc: 'Toggle free-flight noclip mode (WASD + Space/Ctrl + Shift boost).',
      handler: () => {
        if (!this._requireRaid()) return;
        const player = this.ctx.getPlayer();
        player.noclip = !player.noclip;
        player.velocity.set(0, 0, 0);
        this.log(`Noclip: ${player.noclip ? 'ON (WASD fly, Space up, C/Ctrl down, Shift fast)' : 'OFF'}`, player.noclip ? 'ok' : 'warn');
      }
    });

    this.registerCommand('god', {
      usage: '/god',
      desc: 'Toggle god mode (invulnerability).',
      handler: () => {
        if (!this._requireRaid()) return;
        const player = this.ctx.getPlayer();
        player.godMode = !player.godMode;
        this.log(`God Mode: ${player.godMode ? 'ON' : 'OFF'}`, player.godMode ? 'ok' : 'warn');
      }
    });

    this.registerCommand('heal', {
      usage: '/heal',
      desc: 'Restore full HP, Armor, and Stamina.',
      handler: () => {
        if (!this._requireRaid()) return;
        const player = this.ctx.getPlayer();
        if (player.isDowned || player.dead) player.revive(player.maxHp);
        player.hp = player.maxHp;
        player.armor = player.maxArmor;
        player.stamina = 100;
        this.log(`Restored HP (${player.hp}/${player.maxHp}) & Armor (${player.armor}/${player.maxArmor}).`, 'ok');
      }
    });

    this.registerCommand('pvp', {
      usage: '/pvp [on|off]',
      desc: 'Toggle or set Squad PvP (Friendly Fire).',
      handler: (args) => {
        const ui = this.ctx.getUI && this.ctx.getUI();
        if (args[0]) {
          window.SQUAD_PVP = ['on', '1', 'true'].includes(args[0].toLowerCase());
        } else {
          window.SQUAD_PVP = !window.SQUAD_PVP;
        }
        if (ui && ui.syncSettingsUI) ui.syncSettingsUI();
        if (typeof window.onSquadPvpToggle === 'function') window.onSquadPvpToggle(window.SQUAD_PVP);
        this.log(`Squad PvP: ${window.SQUAD_PVP ? 'ON' : 'OFF'}`, window.SQUAD_PVP ? 'ok' : 'warn');
      }
    });

    this.registerCommand('killall', {
      usage: '/killall',
      desc: 'Eliminate all active enemies in the raid.',
      handler: () => {
        if (!this._requireRaid()) return;
        const enemyManager = this.ctx.getEnemyManager && this.ctx.getEnemyManager();
        if (!enemyManager || !enemyManager.enemies) return;
        let n = 0;
        for (const e of enemyManager.enemies) {
          if (e && !e.dead) {
            e.hp = 0;
            e.isDowned = false;
            e.die();
            n++;
          }
        }
        this.log(`Eliminated ${n} enemies.`, 'ok');
      }
    });

    this.registerCommand('pos', {
      usage: '/pos',
      desc: 'Print your current world coordinates.',
      handler: () => {
        if (!this._requireRaid()) return;
        const p = this.ctx.getPlayer().position;
        this.log(`Position: x=${p.x.toFixed(2)}, y=${p.y.toFixed(2)}, z=${p.z.toFixed(2)}`, 'info');
      }
    });

    this.registerCommand('items', {
      usage: '/items [filter]',
      desc: 'List item IDs usable with /give.',
      handler: (args) => {
        const items = (window.GAME_DATA && GAME_DATA.ITEMS) || {};
        const filter = (args[0] || '').toLowerCase();
        const list = Object.keys(items).filter(k => !filter || k.toLowerCase().includes(filter) || (items[k].name || '').toLowerCase().includes(filter));
        this.log(`Items (${list.length}): ${list.join(', ')}`, 'info');
      }
    });
  }
}

window.DevConsole = DevConsole;
