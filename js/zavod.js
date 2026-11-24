// =====================================================================================
// ZAVOD-9 runtime controller
//  - Vostok side: ZAVOD-9 service elevator = Koschei-style airlock transfer. Starts a countdown
//    (5 s when the whole squad is inside, 30 s otherwise); everyone in the lift is extracted from
//    the current Vostok match and deployed into a brand-new, separate ZAVOD-9 match (same wing).
//  - ZAVOD-9 side: sector puzzles (channelled interactions), blast-door animation, radiation,
//    flood drain, laser gates, dark-zone lighting / NVG / flashlight, final-exfil lifts, MP sync.
// =====================================================================================
(function () {
  const TRANSFER_RADIUS = 6.5;

  const el = (id, css, parent = document.body) => {
    let n = document.getElementById(id);
    if (!n) {
      n = document.createElement('div');
      n.id = id;
      n.style.cssText = css;
      parent.appendChild(n);
    }
    return n;
  };

  const Z = {
    transfer: null,      // { endsAt, wingId, matchId, elevator }
    channel: null,       // { station, t }
    _toastAt: 0,
    _radAcc: 0,
    _radWarnAt: 0,
    _laserCd: 0,
    _light: null,
    _nvgOn: false,
    _breath: 1.0,
    _drownAcc: 0,
    _lastCtx: null,

    reset() {
      this.transfer = null;
      this.channel = null;
      this._radAcc = 0;
      this._laserCd = 0;
      this._light = null;
      this._cull = null;
      this._setNvg(false);
      const b = document.getElementById('zavod-banner');
      if (b) b.style.display = 'none';
      this._breath = 1.0;
      this._drownAcc = 0;
      const rad = document.getElementById('zavod-rad');
      if (rad) rad.style.display = 'none';
      const uw = document.getElementById('zavod-underwater');
      if (uw) uw.style.display = 'none';
      const br = document.getElementById('zavod-breath');
      if (br) br.style.display = 'none';
    },

    // -------------------------------------------------------------------------------
    // Interactables (called from main.checkInteractions)
    // -------------------------------------------------------------------------------
    findInteractable(world, player, bestDist) {
      if (!world || !player) return null;
      let best = null;
      let bd = bestDist;
      if (world.bunkerElevators) {
        for (const elv of world.bunkerElevators) {
          const d = Math.hypot(player.position.x - elv.position.x, player.position.z - elv.position.z);
          if (d < 3.6 && d < bd && Math.abs(player.position.y - elv.position.y) < 3.5) {
            bd = d;
            const lbl = this.transfer
              ? `ZAVOD-9 TRANSFER IN ${Math.max(0, Math.ceil((this.transfer.endsAt - Date.now()) / 1000))}s — STAY IN THE LIFT`
              : `INFIL ZAVOD-9 [${elv.shortTag || 'Z-9'}] — ${elv.name || 'SERVICE ELEVATOR'}`;
            best = { dist: d, ia: { type: 'zavod', sub: 'elevator', elevator: elv, label: lbl } };
          }
        }
      }
      const zv = world.zavod;
      if (zv) {
        const feetY = player.position.y - (player.currentEyeHeight || 1.7);
        for (const st of zv.stations) {
          const d = Math.hypot(player.position.x - st.x, player.position.z - st.z);
          if (d > 2.7 || d >= bd || Math.abs(feetY - (st.y || 0)) > 1.6) continue;
          bd = d;
          best = { dist: d, ia: { type: 'zavod', sub: 'station', station: st, label: this._stationLabel(world, st) } };
        }
        for (const bar of zv.barricades || []) {
          if (bar.broken) continue;
          const d = Math.hypot(player.position.x - bar.x, player.position.z - bar.z);
          if (d > 3.2 || d >= bd || Math.abs(feetY - (bar.baseY || 0)) > 2.2) continue;
          bd = d;
          best = { dist: d, ia: { type: 'zavod', sub: 'barricade', barricade: bar, label: `${bar.label} — BREACH WITH EXPLOSIVE [F]` } };
        }
      }
      return best;
    },

    _stationLabel(world, st) {
      if (st.kind === 'shop_note') return `READ ${st.label}`;
      if (st.solved) {
        if (st.kind === 'clue') return `${st.label} — ${st.clueSymbol || ('#' + (st.clueIdx + 1))} = ${st.clueDigit}`;
        return `${st.label} — DONE`;
      }
      if (this.channel && this.channel.station === st) {
        const pct = Math.min(100, Math.round((this.channel.t / (st.hold || 1)) * 100));
        return `${st.label} — ${pct}%`;
      }
      const verb = st.kind === 'valve' ? 'TURN' : (st.kind === 'clue' ? 'STUDY' : (st.kind === 'socket' || st.kind === 'pad' ? 'INSTALL' : 'ACTIVATE'));
      return `${verb} ${st.label}`;
    },

    // Returns true if handled
    interact(ia, ctx) {
      if (!ia || ia.type !== 'zavod') return false;
      if (ia.sub === 'elevator') return this._startTransfer(ia.elevator, ctx, true);
      if (ia.sub === 'station') return this._beginChannel(ia.station, ctx);
      if (ia.sub === 'barricade') {
        if (ctx.ui) ctx.ui.showCenterToast('USE AN EXPLOSIVE (FRAG GRENADE [F]) TO BREACH THE PLANKS', '#ffca28');
        return true;
      }
      return false;
    },

    // -------------------------------------------------------------------------------
    // Vostok -> ZAVOD-9 transfer (new, separate match)
    // -------------------------------------------------------------------------------
    _startTransfer(elevator, ctx, local, remote = null) {
      if (this.transfer) {
        if (local) ctx.ui.showCenterToast('LIFT ALREADY DESCENDING — STAY INSIDE', '#f5a623');
        return true;
      }
      const wings = ['A1', 'A2', 'B1', 'B2'];
      let secs = 5;
      if (!remote && ctx.squadManager && ctx.squadManager.allies) {
        const humans = ctx.squadManager.allies.filter(a => a && a.isRemoteHuman && !a.dead);
        const allInside = humans.every(a => Math.hypot(a.position.x - elevator.position.x, a.position.z - elevator.position.z) < (elevator.cabRadius || TRANSFER_RADIUS) + 0.6);
        if (!allInside) secs = 30;
      }
      const wingId = remote ? remote.wingId : (elevator.wingId || wings[Math.floor(Math.random() * wings.length)]);
      const matchId = remote ? remote.matchId : `${(ctx.ui && ctx.ui.partyId) || 'solo'}_zavod9_${Date.now().toString(36)}`;
      const endsAt = remote ? Date.now() + Math.max(1, remote.secs || 5) * 1000 : Date.now() + secs * 1000;
      this.transfer = { endsAt, wingId, matchId, elevator };
      if (local && ctx.sendEvent) ctx.sendEvent({ type: 'zavod_transfer', secs, wingId, matchId, elevId: elevator.id });
      if (window.soundEngine && window.soundEngine.playAlert) { try { window.soundEngine.playAlert(true); } catch (e) {} }
      ctx.ui.addFeedMessage(`ZAVOD-9 service elevator engaged — transfer in ${Math.round((endsAt - Date.now()) / 1000)}s. Everyone inside the lift goes to the new match.`, '#ffca28');
      return true;
    },

    _updateTransfer(ctx) {
      const t = this.transfer;
      const banner = el('zavod-banner', 'position:fixed;top:118px;left:50%;transform:translateX(-50%);z-index:60;padding:10px 22px;background:rgba(12,14,16,0.88);border:1px solid #ffca28;color:#ffca28;font:bold 14px Consolas,monospace;letter-spacing:1px;text-align:center;pointer-events:none;display:none;');
      if (!t) { banner.style.display = 'none'; return; }
      const left = (t.endsAt - Date.now()) / 1000;
      const p = ctx.player;
      const inside = p && !p.dead && Math.hypot(p.position.x - t.elevator.position.x, p.position.z - t.elevator.position.z) < (t.elevator.cabRadius || TRANSFER_RADIUS);
      banner.style.display = 'block';
      banner.innerHTML = `ZAVOD-9 TRANSFER — ${Math.max(0, left).toFixed(1)}s<br><span style="font-size:11px;color:${inside ? '#69f0ae' : '#ff5252'}">${inside ? 'IN LIFT — YOU WILL DEPLOY TO A NEW ZAVOD-9 MATCH' : 'OUTSIDE THE LIFT — STEP IN TO TRANSFER'}</span>`;
      if (left <= 0) {
        this.transfer = null;
        banner.style.display = 'none';
        if (inside && ctx.transferToZavod) {
          this.showLoading(t.wingId);
          ctx.transferToZavod(t.wingId, t.matchId);
        } else {
          ctx.ui.addFeedMessage('ZAVOD-9 lift departed without you', '#ff5252');
        }
      }
    },

    showLoading(wingId) {
      const wingNames = { A1: 'A/1 INFORMATION EXTRACTION', A2: 'A/2 DEFENSE RESEARCH DIVISION', B1: 'B/1 BARRACKS', B2: 'B/2 EXTERNAL OPERATIONS' };
      const ov = el('zavod-loading', 'position:fixed;inset:0;z-index:9999;background:#050607;color:#e6e14a;display:flex;flex-direction:column;align-items:center;justify-content:center;font:bold 22px Consolas,monospace;letter-spacing:3px;');
      ov.innerHTML = `<div style="font-size:42px;color:#f1f1ea">ЗАВОД-9</div><div style="margin-top:6px">ZAVOD-9 UNDERGROUND COMPLEX</div>` +
        `<div style="margin-top:22px;font-size:14px;color:#9fb4bd">DESCENDING… EXTRACTED FROM VOSTOK — DEPLOYING TO NEW MATCH</div>` +
        `<div style="margin-top:10px;font-size:14px;color:#ffca28">SECTOR ASSIGNMENT: ${wingNames[wingId] || wingId}</div>`;
      ov.style.display = 'flex';
    },
    hideLoading() {
      const ov = document.getElementById('zavod-loading');
      if (ov) ov.style.display = 'none';
    },

    // Called once a ZAVOD-9 match has started
    onRaidStart(world, ctx) {
      this.reset();
      this.hideLoading();
      if (!world || !world.zavod) return;
      const w = world.zavod.activeWing;
      if (w && ctx.ui) {
        ctx.ui.showCenterToast(`ZAVOD-9 // ${w.name}`, w.color || '#ffca28');
        ctx.ui.addFeedMessage(`Sector objective: ${w.puzzle}`, w.color || '#ffca28');
        ctx.ui.addFeedMessage('Reach the dark Chemical Plant, then the Factory (Factory Key) or Alpha Cluster (battery + cables). Exfil: Factory freight lift; sector lifts reopen for Final Exfil.', '#9fb4bd');
      }
    },

    // -------------------------------------------------------------------------------
    // Puzzle stations
    // -------------------------------------------------------------------------------
    _hasItems(player, needs) {
      if (!needs || !needs.length) return true;
      return needs.every(n => {
        const total = (player.backpack || []).filter(it => it && it.id === n.id).reduce((s, it) => s + (it.qty || 1), 0);
        return total >= (n.qty || 1);
      });
    },
    _takeItems(player, needs) {
      for (const n of needs || []) {
        let left = n.qty || 1;
        for (let i = player.backpack.length - 1; i >= 0 && left > 0; i--) {
          const it = player.backpack[i];
          if (!it || it.id !== n.id) continue;
          const take = Math.min(left, it.qty || 1);
          it.qty = (it.qty || 1) - take;
          left -= take;
          if (it.qty <= 0) player.backpack.splice(i, 1);
        }
      }
    },
    _requirementsMet(zv, st) {
      return (st.requires || []).every(id => { const s = zv.stations.find(x => x.id === id); return s && s.solved; });
    },
    _beginChannel(st, ctx) {
      const zv = ctx.world.zavod;
      if (st.kind === 'shop_note') {
        const txt = `SHOPKEEPER BARTER: ${(zv.shopBarter && zv.shopBarter.label) || 'Deposit server tapes in dead-drop slot'}`;
        ctx.ui.showCenterToast(txt, '#ffca28');
        ctx.ui.addFeedMessage(txt, '#ffca28');
        return true;
      }
      if (st.solved) {
        if (st.kind === 'clue') ctx.ui.showCenterToast(`BOARD ${st.clueIdx + 1} (${st.clueSymbol || '#' + (st.clueIdx + 1)}): DIGIT = ${st.clueDigit}`, '#b388ff');
        return true;
      }
      if (!this._requirementsMet(zv, st)) {
        ctx.ui.showCenterToast(st.hint || 'LOCKED', '#ff5252');
        return true;
      }
      if (!this._hasItems(ctx.player, st.mustCarry)) {
        ctx.ui.showCenterToast(st.hint || 'SCANNER REQUIRED', '#ff5252');
        const names = (st.mustCarry || []).map(n => (GAME_DATA.ITEMS[n.id] || { name: n.id }).name).join(' + ');
        ctx.ui.addFeedMessage(`${st.label} requires holding: ${names}`, '#ff5252');
        return true;
      }
      if (!this._hasItems(ctx.player, st.needs)) {
        ctx.ui.showCenterToast(st.hint || 'MISSING ITEMS', '#ff5252');
        const names = (st.needs || []).map(n => `${(GAME_DATA.ITEMS[n.id] || { name: n.id }).name}${(n.qty || 1) > 1 ? ' x' + n.qty : ''}`).join(' + ');
        ctx.ui.addFeedMessage(`${st.label} requires: ${names}`, '#ff5252');
        return true;
      }
      this.channel = { station: st, t: 0, startPos: ctx.player.position.clone() };
      if (window.soundEngine && window.soundEngine.playClick) { try { window.soundEngine.playClick(); } catch (e) {} }
      return true;
    },
    _updateChannel(dt, ctx) {
      const c = this.channel;
      if (!c) return;
      const p = ctx.player;
      const st = c.station;
      if (!p || p.dead || p.isDowned || Math.hypot(p.position.x - st.x, p.position.z - st.z) > 3.0) {
        this.channel = null;
        ctx.ui.showCenterToast('INTERRUPTED', '#ff5252');
        return;
      }
      c.t += dt;
      if (st.spinMesh) st.spinMesh.rotation.z += dt * 3.2;
      if (c.t >= (st.hold || 1)) {
        this.channel = null;
        if (!this._hasItems(p, st.needs) || !this._hasItems(p, st.mustCarry) || !this._requirementsMet(ctx.world.zavod, st)) return;
        this._takeItems(p, st.needs);
        this.solveStation(st.id, ctx, false);
        if (ctx.sendEvent) ctx.sendEvent({ type: 'zavod_station', id: st.id });
        if (ctx.refreshHud) ctx.refreshHud();
      }
    },

    solveStation(id, ctx, fromRemote) {
      const world = ctx.world;
      const zv = world && world.zavod;
      if (!zv) return;
      const st = zv.stations.find(s => s.id === id);
      if (!st || st.solved) return;
      st.solved = true;
      if (st.lampMesh) st.lampMesh.material = new THREE.MeshBasicMaterial({ color: 0x5dff9a });
      if (st.ringMesh) st.ringMesh.material = new THREE.MeshBasicMaterial({ color: 0x5dff9a });
      this._runActions(st.actions || [], ctx, fromRemote, st);
      if (fromRemote) ctx.ui.addFeedMessage(`SQUAD: ${st.label} complete`, '#69f0ae');
      // Group completion (e.g. both drain valves, 3 laptop uplinks)
      for (const [gid, grp] of Object.entries(zv.groups || {})) {
        if (grp.done || !grp.members.includes(id)) continue;
        if (grp.members.every(mid => { const s = zv.stations.find(x => x.id === mid); return s && s.solved; })) {
          grp.done = true;
          this._runActions(grp.actions || [], ctx, fromRemote, st);
        }
      }
    },

    _runActions(actions, ctx, fromRemote, st) {
      const world = ctx.world;
      const zv = world.zavod;
      for (const a of actions) {
        if (a.open) for (const did of a.open) this.openDoor(world, did);
        if (a.clearRad) { if (zv.rads[a.clearRad]) zv.rads[a.clearRad].active = false; }
        if (a.drain && zv.floods[a.drain]) zv.floods[a.drain].target = -0.5;
        if (a.lasersOff) for (const l of zv.lasers) if (l.group === a.lasersOff) { l.enabled = false; l.mesh.visible = false; }
        if (a.disarmTrap) {
          const tr = (zv.traps || []).find(t => t.id === a.disarmTrap);
          if (tr && tr.armed) {
            tr.armed = false;
            if (tr.beamMesh) tr.beamMesh.visible = false;
            if (tr.c4Vis) tr.c4Vis.visible = false;
          }
        }
        if (a.unlockExtract) {
          const ez = world.extractZones.find(e => e.name === a.unlockExtract);
          if (ez) { ez.locked = false; ez.ringMesh.visible = true; ez.beaconMesh.visible = true; }
        }
        if (a.clue !== undefined) {
          zv.clues[a.clue] = zv.vaultCode[a.clue];
          const sym = (zv.vaultSymbols && zv.vaultSymbols[a.clue]) || ('#' + (a.clue + 1));
          const known = zv.vaultCode.map((d, k) => (zv.clues[k] !== undefined ? d : '_')).join(' ');
          ctx.ui.showCenterToast(`R4D CIPHER ${sym} = ${zv.vaultCode[a.clue]} // CODE: ${known}`, '#b388ff');
          ctx.ui.addFeedMessage(`R4D UV cipher decoded — ${sym} (${a.clue + 1}/3) = ${zv.vaultCode[a.clue]} (code: ${known})`, '#b388ff');
        }
        if (a.alarm) {
          const d = zv.doors.find(x => x.id === a.alarm);
          if (window.soundEngine && window.soundEngine.playAlert) { try { window.soundEngine.playAlert(true); } catch (e) {} }
          ctx.ui.addFeedMessage(`⚠ SIREN — ${d ? d.label : a.alarm} OPENED`, '#ff5252');
          if (d && ctx.enemyManager && ctx.enemyManager.alertNearby) ctx.enemyManager.alertNearby(new THREE.Vector3(d.x, 0, d.z), 55);
        }
        if (a.alarmLocal && st && ctx.enemyManager && ctx.enemyManager.alertNearby) ctx.enemyManager.alertNearby(new THREE.Vector3(st.x, 0, st.z), 40);
        if (a.msg && !fromRemote) ctx.ui.addFeedMessage(a.msg, '#69f0ae');
        else if (a.msg && a.global) ctx.ui.addFeedMessage(a.msg, '#ffca28');
      }
    },

    openDoor(world, id) {
      const d = world.zavod && world.zavod.doors.find(x => x.id === id);
      if (!d || d.open) return;
      d.open = true;
      if (d.lampMat) d.lampMat.color.setHex(0x5dff9a);
      if (window.soundEngine && window.soundEngine.playDoorOpen) { try { window.soundEngine.playDoorOpen(false); } catch (e) {} }
    },

    // -------------------------------------------------------------------------------
    // Remote sync
    // -------------------------------------------------------------------------------
    onRemoteEvent(pkt, ctx) {
      if (!pkt) return;
      if (pkt.type === 'zavod_station' && ctx.world && ctx.world.zavod) {
        this.solveStation(pkt.id, ctx, true);
      } else if (pkt.type === 'zavod_barricade' && ctx.world && ctx.world.zavod) {
        this.breakBarricade(pkt.id, ctx, true);
      } else if (pkt.type === 'zavod_transfer' && ctx.world && ctx.world.bunkerElevators && ctx.world.bunkerElevators.length) {
        const elv = ctx.world.bunkerElevators.find(e => e.id === pkt.elevId) || ctx.world.bunkerElevators[0];
        this._startTransfer(elv, ctx, false, pkt);
      }
    },

    detonateTrap(tr, ctx, fromRange = false) {
      if (!tr || !tr.armed) return;
      tr.armed = false;
      if (tr.beamMesh) tr.beamMesh.visible = false;
      if (tr.c4Vis) tr.c4Vis.visible = false;
      const zv = ctx && ctx.world && ctx.world.zavod;
      if (zv && tr.stationId) {
        const st = zv.stations.find(s => s.id === tr.stationId);
        if (st) st.solved = true;
      }
      if (window.soundEngine && window.soundEngine.playExplosion) { try { window.soundEngine.playExplosion(); } catch (e) {} }
      if (ctx && ctx.enemyManager && ctx.enemyManager.alertNearby) ctx.enemyManager.alertNearby(tr.c4Pos, 45);
      const p = ctx && ctx.player;
      if (p && !p.dead && p.position.distanceTo(tr.c4Pos) < 3.4 && p.takeDamage) {
        const res = p.takeDamage(52, { name: 'SNIPER C4 TRAP', weaponId: 'c4', weaponName: 'C4 TRIPWIRE' });
        if (ctx.ui && ctx.ui.triggerDamageFlash) ctx.ui.triggerDamageFlash();
        if (res === 'eliminated' && ctx.onPlayerEliminated) ctx.onPlayerEliminated();
      }
      if (ctx && ctx.ui) ctx.ui.showCenterToast('SNIPER C4 DETONATED', fromRange ? '#ffca28' : '#ff5252');
    },

    onBulletHit(pt) {
      const ctx = this._lastCtx;
      const zv = ctx && ctx.world && ctx.world.zavod;
      if (!zv || !zv.traps || !pt) return;
      for (const tr of zv.traps) {
        if (tr.armed && tr.c4Pos && tr.c4Pos.distanceTo(pt) < 1.25) {
          this.detonateTrap(tr, ctx, true);
        }
      }
    },

    onExplosion(pos, radius = 6.5) {
      const ctx = this._lastCtx;
      const zv = ctx && ctx.world && ctx.world.zavod;
      if (!zv || !pos) return;
      for (const tr of zv.traps || []) {
        if (tr.armed && tr.c4Pos && tr.c4Pos.distanceTo(pos) <= Math.max(radius, 4.5)) {
          this.detonateTrap(tr, ctx, true);
        }
      }
      if (!zv.barricades) return;
      for (const b of zv.barricades) {
        if (b.broken) continue;
        const d = Math.hypot(b.x - pos.x, b.z - pos.z);
        if (d <= Math.max(radius, 5.5) && Math.abs((pos.y || 0) - (b.baseY || 0)) < 4.0) {
          this.breakBarricade(b.id, ctx, false);
        }
      }
    },

    breakBarricade(id, ctx, fromRemote = false) {
      const zv = ctx && ctx.world && ctx.world.zavod;
      const b = zv && (zv.barricades || []).find(x => x.id === id);
      if (!b || b.broken) return;
      b.broken = true;
      b.collider.minY = 9000; b.collider.maxY = 9001;
      if (b.proxy) b.proxy.layers.set(9);
      if (b.group) b.group.visible = false;
      if (window.soundEngine && window.soundEngine.playDoorOpen) { try { window.soundEngine.playDoorOpen(false); } catch (e) {} }
      if (ctx.ui) {
        ctx.ui.showCenterToast('BARRICADE BREACHED — SUBMERGED TUNNEL OPEN', '#4fc3f7');
        ctx.ui.addFeedMessage('Breach wall destroyed — submerged B/1 secret tunnel accessible (Rebreather advised)', '#4fc3f7');
      }
      if (!fromRemote && ctx.sendEvent) ctx.sendEvent({ type: 'zavod_barricade', id });
    },

    // -------------------------------------------------------------------------------
    // Per-frame update
    // -------------------------------------------------------------------------------
    update(dt, ctx) {
      this._lastCtx = ctx;
      const world = ctx.world;
      if (!world) return;
      if (world.bunkerElevators) this._updateTransfer(ctx);
      const zv = world.zavod;
      if (!zv) return;
      this._updateChannel(dt, ctx);
      this._updateCulling(dt, ctx);
      const now = performance.now() / 1000;
      // Blast doors slide up into the lintel
      for (const d of zv.doors) {
        if (!d.open || d.t >= 1) continue;
        d.t = Math.min(1, d.t + dt / 1.9);
        d.group.position.y = d.baseY + d.t * (d.height - 0.25);
        if (d.t > 0.5 && !d.cleared) {
          d.cleared = true;
          d.collider.minY = 9000; d.collider.maxY = 9001;
          if (d.proxy) d.proxy.layers.set(9);
        }
        if (d.t >= 1) d.group.visible = false;
      }
      // Flood drain
      for (const f of Object.values(zv.floods)) {
        if (Math.abs(f.level - f.target) < 0.002) continue;
        f.level += Math.sign(f.target - f.level) * Math.min(Math.abs(f.target - f.level), dt * 0.09);
        for (const m of f.meshes) { m.position.y = f.level; m.visible = f.level > 0.02; }
      }
      // Station lamp state (amber = ready, red = locked)
      for (const st of zv.stations) {
        if (st.solved || !st.lampMesh) continue;
        const ready = this._requirementsMet(zv, st);
        const want = ready ? 0xffb53a : 0xff3326;
        if (st._lampHex !== want) { st._lampHex = want; st.lampMesh.material = new THREE.MeshBasicMaterial({ color: want }); }
      }
      const p = ctx.player;
      if (!p) return;
      const feetY = p.position.y - (p.currentEyeHeight || 1.7);
      // Laser gates (pulsing): tripping one shocks & triggers the al-Qatala alarm
      this._laserCd = Math.max(0, this._laserCd - dt);
      for (const l of zv.lasers) {
        if (!l.enabled) continue;
        const ph = ((now + l.phase) % l.period) / l.period;
        l.on = ph < l.duty;
        l.mesh.visible = l.on;
        if (!l.on || this._laserCd > 0 || p.dead) continue;
        if (Math.abs(p.position.x - l.x) < 0.38 && p.position.z > l.z0 && p.position.z < l.z1 && l.y > feetY + 0.05 && l.y < p.position.y + 0.15) {
          this._laserCd = 1.2;
          const res = p.takeDamage ? p.takeDamage(18, { name: 'LASER GRID', weaponId: 'laser', weaponName: 'SECURITY LASER' }) : null;
          if (ctx.ui.triggerDamageFlash) ctx.ui.triggerDamageFlash();
          ctx.ui.showCenterToast('LASER TRIPPED — ALARM!', '#ff5252');
          if (window.soundEngine && window.soundEngine.playAlert) { try { window.soundEngine.playAlert(true); } catch (e) {} }
          if (ctx.enemyManager && ctx.enemyManager.alertNearby) ctx.enemyManager.alertNearby(p.position, 70);
          if (res === 'eliminated' && ctx.onPlayerEliminated) ctx.onPlayerEliminated();
        }
      }
      // Region effects
      const reg = world.zavodRegionAt(p.position.x, p.position.z, feetY);
      const radActive = !!(reg && reg.rad && zv.rads[reg.rad] && zv.rads[reg.rad].active);
      const radEl = el('zavod-rad', 'position:fixed;top:160px;left:50%;transform:translateX(-50%);z-index:59;padding:6px 16px;background:rgba(40,46,10,0.85);border:1px solid #e6e14a;color:#e6e14a;font:bold 13px Consolas,monospace;pointer-events:none;display:none;');
      if (radActive && !p.dead) {
        const masked = p.headgear === 'gas_mask';
        radEl.style.display = 'block';
        radEl.textContent = masked ? '☢ RADIOACTIVE DUST — GAS MASK FILTERING' : `☢ RADIOACTIVE DUST — SEAL SUB-SECTOR ${reg.rad} (−4 HP/s)`;
        if (!masked) {
          this._radAcc += dt * 4;
          if (this._radAcc >= 2 && p.takeDamage) {
            const res = p.takeDamage(Math.floor(this._radAcc), { name: 'RADIATION', weaponId: 'radiation', weaponName: 'RADIATION' });
            this._radAcc -= Math.floor(this._radAcc);
            if (res === 'eliminated' && ctx.onPlayerEliminated) ctx.onPlayerEliminated();
          }
        }
      } else {
        radEl.style.display = 'none';
        this._radAcc = 0;
      }
      // Underwater / Rebreather breath mechanic (B/1 submerged secret chamber)
      const waterY = world.getWaterSurfaceY ? world.getWaterSurfaceY(p.position.x, p.position.z) : null;
      const submerged = !!(waterY !== null && !p.dead && waterY > p.position.y - 0.12);
      const uwEl = el('zavod-underwater', 'position:fixed;inset:0;z-index:55;pointer-events:none;background:radial-gradient(circle at center,rgba(12,68,90,0.34),rgba(5,26,38,0.68));display:none;');
      const brEl = el('zavod-breath', 'position:fixed;bottom:148px;left:50%;transform:translateX(-50%);z-index:59;padding:6px 16px;background:rgba(8,22,30,0.88);border:1px solid #4fc3f7;color:#4fc3f7;font:bold 13px Consolas,monospace;pointer-events:none;display:none;');
      if (submerged) {
        const hasRebreather = p.headgear === 'zavod_rebreather' || (p.backpack || []).some(it => it && it.id === 'zavod_rebreather');
        uwEl.style.display = window.renderPipeline ? 'none' : 'block';
        brEl.style.display = 'block';
        if (hasRebreather) {
          this._breath = Math.min(1.0, this._breath + dt * 0.5);
          this._drownAcc = 0;
          brEl.style.borderColor = '#4fc3f7';
          brEl.style.color = '#4fc3f7';
          brEl.textContent = 'REBREATHER ACTIVE — O2 FILTERING';
        } else {
          this._breath = Math.max(0, this._breath - dt / 12.0);
          const secs = Math.ceil(this._breath * 12);
          if (this._breath > 0) {
            brEl.style.borderColor = secs <= 4 ? '#ff5252' : '#ffca28';
            brEl.style.color = secs <= 4 ? '#ff5252' : '#ffca28';
            brEl.textContent = `HOLDING BREATH: ${secs}s (REBREATHER ADVISED)`;
          } else {
            brEl.style.borderColor = '#ff5252';
            brEl.style.color = '#ff5252';
            brEl.textContent = 'DROWNING! SURFACE OR EQUIP REBREATHER (−12 HP/s)';
            this._drownAcc += dt * 12;
            if (this._drownAcc >= 3 && p.takeDamage) {
              const dmg = Math.floor(this._drownAcc);
              this._drownAcc -= dmg;
              const res = p.takeDamage(dmg, { name: 'DROWNING', weaponId: 'water', weaponName: 'SUBMERGED WATER' });
              if (res === 'eliminated' && ctx.onPlayerEliminated) ctx.onPlayerEliminated();
            }
          }
        }
      } else {
        uwEl.style.display = 'none';
        brEl.style.display = 'none';
        this._breath = Math.min(1.0, this._breath + dt * 0.35);
        this._drownAcc = 0;
      }
      // Sniper Mezzanine C4 Laser Tripwires
      for (const tr of zv.traps || []) {
        if (!tr.armed || p.dead) continue;
        if (Math.abs(p.position.z - tr.z) < 0.55 && p.position.x > tr.x0 && p.position.x < tr.x1 && Math.abs(feetY - tr.baseY) < 1.5) {
          this.detonateTrap(tr, ctx, false);
        }
      }
      // Dual Boss Defeat (The Rhinoceros + The Sniper) -> open Weapons Case Vault
      if (!zv.caseVaultOpened && ctx.enemyManager && ctx.enemyManager.enemies) {
        const bosses = ctx.enemyManager.enemies.filter(e => e && (e.tier === 'boss_rhino' || e.tier === 'boss_sniper'));
        if (bosses.length > 0 && bosses.every(b => b.dead)) {
          zv.caseVaultOpened = true;
          this.openDoor(world, 'CASE_CAGE');
          if (ctx.ui) {
            ctx.ui.showCenterToast('RHINO & SNIPER ELIMINATED — WEAPONS CASE VAULT UNLOCKED', '#ffca28');
            ctx.ui.addFeedMessage('Weapons Case Vault unsealed — claim the Koschei Weapons Case in Factory Hall!', '#ffca28');
          }
        }
      }
      // Dark-zone lighting, NVG, GPU Post-FX & weapon-light
      const dark = !!(reg && reg.dark);
      const nvg = p.headgear === 'nvg_goggles';
      this._setNvg(nvg && dark);
      if (window.renderPipeline && window.renderPipeline.setEffects) {
        window.renderPipeline.setEffects({
          nvg: (nvg && dark) ? 1 : 0,
          rad: (radActive && !p.dead) ? (p.headgear === 'gas_mask' ? 0.22 : 0.82) : 0,
          underwater: submerged ? 1 : 0,
          time: now
        });
      }
      const L = this._light || (this._light = { hemi: 1.0, fog: 0.011, spot: 1.4 });
      const tHemi = dark ? (nvg ? 1.35 : 0.13) : 1.02;
      const tFog = dark ? (nvg ? 0.012 : 0.030) : 0.011;
      const tSpot = dark ? (nvg ? 0.4 : 3.2) : 1.4;
      const k = Math.min(1, dt * 2.5);
      L.hemi += (tHemi - L.hemi) * k;
      L.fog += (tFog - L.fog) * k;
      L.spot += (tSpot - L.spot) * k;
      if (ctx.hemiLight) ctx.hemiLight.intensity = L.hemi;
      if (ctx.scene && ctx.scene.fog) {
        ctx.scene.fog.density = L.fog;
        const fc = radActive ? 0x1a2008 : 0x0b0d0f;
        if (ctx.scene.fog.color.getHex() !== fc) ctx.scene.fog.color.setHex(fc);
      }
      if (ctx.flashlight && ctx.camera) {
        const fl = ctx.flashlight;
        fl.intensity = L.spot;
        fl.position.copy(ctx.camera.position);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(ctx.camera.quaternion);
        fl.target.position.copy(ctx.camera.position).addScaledVector(dir, 12);
        fl.target.updateMatrixWorld();
      }
      // Final exfil: sector lifts reopen in the last 4 minutes (Building 21)
      if (!zv.finalExfil && typeof ctx.raidTimeLeft === 'number' && ctx.raidTimeLeft <= 240) {
        zv.finalExfil = true;
        for (const ez of world.extractZones) if (ez.kind === 'final') { ez.locked = false; ez.ringMesh.visible = true; ez.beaconMesh.visible = true; }
        ctx.ui.showCenterToast('FINAL EXFIL — SECTOR ELEVATORS RE-OPENED', '#69f0ae');
        ctx.ui.addFeedMessage('FINAL EXFIL: all four sector infil elevators are now active exfils', '#69f0ae');
      }
    },

    // ---------------------------------------------------------------------------------
    // Interior culling (render layers only — never touches gameplay .visible flags or hitboxes)
    //  * small dynamic props (hinged doors, loot lids, panels, signs, GLTF crates): distance cull
    //  * AI operators/NPCs: line-of-sight cull through walls (keeps 40+ rigs from drawing behind walls)
    // ---------------------------------------------------------------------------------
    _cullSetLayer(meshes, on) {
      for (const m of meshes) m.layers.set(on ? 0 : 3);
    },
    _updateCulling(dt, ctx) {
      const world = ctx.world, scene = ctx.scene, cam = ctx.camera, p = ctx.player;
      if (!world || !scene || !cam || !p) return;
      const C = this._cull || (this._cull = { t: 0, scanT: 0, props: [], known: new Set(), enemyVis: new Map() });
      if (C.world !== world) {
        C.world = world; C.props = []; C.known = new Set(); C.enemyVis = new Map(); C.scanT = 0;
        C.batched = new Set(world._batchedMeshes || []);
      }
      C.scanT -= dt;
      if (C.scanT <= 0) {
        C.scanT = 2.0;
        const staticSet = world._staticSceneSet || new Set();
        for (const o of scene.children) {
          if (C.known.has(o)) continue;
          if (!staticSet.has(o) && !(o.userData && o.userData.staticProp)) continue;
          C.known.add(o);
          if (C.batched.has(o) || o.isLight || o.isCamera) continue;
          const meshes = [];
          o.traverse(m => { if (m.isMesh || m.isSprite) meshes.push(m); });
          if (!meshes.length) continue;
          const box = new THREE.Box3().setFromObject(o);
          if (box.isEmpty()) continue;
          const sph = box.getBoundingSphere(new THREE.Sphere());
          if (sph.radius > 30) continue; // large planes (water, floors) stay
          C.props.push({ o, meshes, c: sph.center, r: sph.radius, on: true });
        }
      }
      C.t -= dt;
      if (C.t > 0) return;
      C.t = 0.25;
      const px = cam.position.x, py = cam.position.y, pz = cam.position.z;
      for (const it of C.props) {
        const d = Math.hypot(it.c.x - px, it.c.z - pz, (it.c.y - py) * 0.6) - it.r;
        const want = d < 72;
        if (want !== it.on) { it.on = want; this._cullSetLayer(it.meshes, want); }
      }
      // AI LOS culling
      const em = ctx.enemyManager;
      if (!em || !em.enemies) return;
      const o = new THREE.Vector3(px, py, pz);
      const dir = new THREE.Vector3();
      const tgt = new THREE.Vector3();
      for (const e of em.enemies) {
        if (!e || !e.group) continue;
        let rec = C.enemyVis.get(e);
        if (!rec) {
          rec = { meshes: [], on: true, hold: 0 };
          C.enemyVis.set(e, rec);
        }
        const dist = Math.hypot(e.position.x - px, e.position.z - pz);
        let vis = false;
        if (dist < 9) vis = true;
        else if (dist < 150) {
          for (const hy of [1.55, 0.9]) {
            tgt.set(e.position.x, e.position.y + hy, e.position.z);
            dir.subVectors(tgt, o);
            const len = dir.length();
            dir.multiplyScalar(1 / len);
            const hit = world.raycastWorld(o, dir, 0.3, len - 0.4, { wallsOnly: true });
            if (!hit) { vis = true; break; }
          }
        }
        if (vis) rec.hold = 0.75;
        else rec.hold -= 0.25;
        const want = vis || rec.hold > 0;
        if (want !== rec.on) {
          rec.on = want;
          // Re-collect each toggle (weapon swaps / ragdolls); hitboxes & overhead alert sprites are never culled
          const hb = new Set(e.hitboxes || []);
          if (want) this._cullSetLayer(rec.meshes, true);
          rec.meshes = [];
          e.group.traverse(m => { if (m.isMesh && !hb.has(m)) rec.meshes.push(m); });
          this._cullSetLayer(rec.meshes, want);
        }
      }
    },

    _setNvg(on) {
      if (this._nvgOn === on) return;
      this._nvgOn = on;
      if (window.renderPipeline) return;
      const c = document.getElementById('game-canvas');
      if (c) c.style.filter = on ? 'grayscale(1) sepia(1) hue-rotate(68deg) saturate(2.6) brightness(1.15) contrast(1.15)' : '';
    }
  };

  window.ZavodBunker = Z;
})();
