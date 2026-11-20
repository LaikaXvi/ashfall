// Standard Gamepad API Controller Support (Xbox / PlayStation / Standard CoD DMZ Layout)
class GamepadController {
  constructor() {
    this.connected = false;
    this.active = false; // true once controller input is used in-raid (allows playing without mouse pointer lock!)
    this.padIndex = null;
    this.prevButtons = [];
    this.yHoldTime = 0;
    this.yHoldTriggered = false;
    this.sprintToggled = false;
    this.adsLean = 0; // -1 left, 0 center, +1 right (toggled via L3/R3 while ADS)
    this.deadzone = 0.15;
    this._wasSliding = false;
    this._slideRumbleTimer = 0;
    this._menuNavCooldown = 0;
    this._focusedEl = null;
    this.cursorX = window.innerWidth * 0.65;
    this.cursorY = window.innerHeight * 0.65;
    this._lastHoverSlot = null;

    window.addEventListener('gamepadconnected', (e) => {
      this.connected = true;
      this.padIndex = e.gamepad.index;
      if (this.onStatusChange) this.onStatusChange(true, e.gamepad.id);
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.padIndex === e.gamepad.index) {
        this.connected = false;
        this.active = false;
        this.padIndex = null;
        if (this.onStatusChange) this.onStatusChange(false, e.gamepad.id);
      }
    });
  }

  _getPad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (this.padIndex !== null && pads[this.padIndex]) return pads[this.padIndex];
    for (const p of pads) {
      if (p && p.connected) {
        this.connected = true;
        this.padIndex = p.index;
        return p;
      }
    }
    return null;
  }

  _btnVal(pad, idx) {
    const b = pad.buttons[idx];
    if (!b) return 0;
    return typeof b === 'object' ? (b.value || (b.pressed ? 1 : 0)) : b;
  }

  _isDown(pad, idx) {
    return this._btnVal(pad, idx) > 0.35;
  }

  _justPressed(pad, idx) {
    return this._isDown(pad, idx) && !this.prevButtons[idx];
  }

  _justReleased(pad, idx) {
    return !this._isDown(pad, idx) && !!this.prevButtons[idx];
  }

  _applyStickCurve(x, y) {
    const mag = Math.hypot(x, y);
    if (mag < this.deadzone) return { x: 0, y: 0, mag: 0 };
    const norm = Math.min(1, (mag - this.deadzone) / (1 - this.deadzone));
    const curved = Math.pow(norm, 1.45);
    return { x: (x / mag) * curved, y: (y / mag) * curved, mag: curved };
  }

  rumble(durationMs = 80, strong = 0.5, weak = 0.5) {
    const pad = this._getPad();
    if (!pad) return;
    const sMag = THREE.MathUtils.clamp(strong, 0, 1);
    const wMag = THREE.MathUtils.clamp(weak, 0, 1);

    // 1. Standard W3C vibrationActuator (Chrome / Edge / Safari / XInput)
    const act = pad.vibrationActuator;
    if (act && typeof act.playEffect === 'function') {
      try {
        const effectType = act.type === 'trigger-rumble' ? 'trigger-rumble' : 'dual-rumble';
        const params = {
          startDelay: 0,
          duration: durationMs,
          strongMagnitude: sMag,
          weakMagnitude: wMag
        };
        if (effectType === 'trigger-rumble') {
          params.leftTrigger = wMag * 0.4;
          params.rightTrigger = sMag * 0.6;
        }
        const res = act.playEffect(effectType, params);
        if (res && typeof res.catch === 'function') {
          res.catch(() => {
            try { act.playEffect('dual-rumble', { startDelay: 0, duration: durationMs, strongMagnitude: sMag, weakMagnitude: wMag }); } catch (e) {}
          });
        }
        return;
      } catch (e) {}
    }

    // 2. Legacy / Firefox hapticActuators fallback
    if (pad.hapticActuators && pad.hapticActuators.length > 0) {
      try {
        const h = pad.hapticActuators[0];
        if (h && typeof h.pulse === 'function') {
          h.pulse(Math.max(sMag, wMag), durationMs);
        }
      } catch (e) {}
    }
  }

  rumbleFire(weaponId) {
    const profiles = {
      pm9:   [65, 0.30, 0.45],
      g17:   [68, 0.34, 0.48],
      mp5k:  [55, 0.36, 0.54],
      ak74m: [85, 0.58, 0.66],
      m870:  [155, 0.96, 0.85],
      m24:   [135, 0.86, 0.72]
    };
    const [dur, strong, weak] = profiles[weaponId] || [80, 0.5, 0.55];
    this.rumble(dur, strong, weak);
  }

  _applyRotationalAimAssist(dt, player, enemyManager, ls, rs) {
    if (!enemyManager || !enemyManager.enemies) return 1.0;
    const engaged = ls.mag > 0.12 || rs.mag > 0.08;

    const eyePos = player.position;
    const sinY = Math.sin(player.yaw);
    const cosY = Math.cos(player.yaw);
    const cosP = Math.cos(player.pitch);
    const lookDir = new THREE.Vector3(-sinY * cosP, Math.sin(player.pitch), -cosY * cosP).normalize();

    let bestTarget = null;
    let bestAngle = 0.21; // ~12 deg outer assist cone

    for (const e of enemyManager.enemies) {
      if (e.dead) continue;
      const aimPt = new THREE.Vector3(e.position.x, e.position.y + 1.25, e.position.z);
      const toEnemy = aimPt.clone().sub(eyePos);
      const dist = toEnemy.length();
      if (dist > 38 || dist < 0.8) continue;
      const dir = toEnemy.divideScalar(dist);
      const dot = THREE.MathUtils.clamp(lookDir.dot(dir), -1, 1);
      const angle = Math.acos(dot);
      if (angle < bestAngle) {
        bestAngle = angle;
        bestTarget = { aimPt, dist, angle };
      }
    }

    if (!bestTarget) return 1.0;

    // Aim slowdown factor inside inner cone (~7.5 deg) for precise tracking
    const slowdown = bestTarget.angle < 0.13
      ? THREE.MathUtils.lerp(0.56, 1.0, bestTarget.angle / 0.13)
      : 1.0;

    // Rotational Aim Assist (active while strafing/moving left stick or tracking with right stick)
    if (engaged) {
      const dx = bestTarget.aimPt.x - eyePos.x;
      const dy = bestTarget.aimPt.y - eyePos.y;
      const dz = bestTarget.aimPt.z - eyePos.z;
      const horiz = Math.hypot(dx, dz) || 0.001;

      const desiredYaw = Math.atan2(-dx, -dz);
      const desiredPitch = Math.atan2(dy, horiz);

      // Shortest signed angle difference for yaw
      let dYaw = desiredYaw - player.yaw;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      const dPitch = desiredPitch - player.pitch;

      // Smooth falloff from center to cone edge
      const falloff = Math.pow(1 - bestTarget.angle / 0.21, 1.2);
      const strength = (player.isADS ? 4.4 : 2.3) * falloff;
      const pull = Math.min(1, dt * strength);

      player.yaw += dYaw * pull;
      player.pitch = THREE.MathUtils.clamp(player.pitch + dPitch * pull * 0.75, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08);
    }

    return slowdown;
  }

  update(dt, ctx) {
    const pad = this._getPad();
    if (!pad) return;

    const { player, weaponSystem, throwableSystem, ui, actions } = ctx;
    const ls = this._applyStickCurve(pad.axes[0] || 0, pad.axes[1] || 0);
    const rs = this._applyStickCurve(pad.axes[2] || 0, pad.axes[3] || 0);

    // Detect any active controller input to enable seamless controller play without pointer lock
    let anyInput = ls.mag > 0 || rs.mag > 0;
    if (!anyInput) {
      for (let i = 0; i < pad.buttons.length; i++) {
        if (this._isDown(pad, i)) { anyInput = true; break; }
      }
    }
    if (anyInput && !this.active) {
      this.active = true;
      if (actions.onControllerActivate) actions.onControllerActivate();
    }

    // Start (9): Toggle Pause
    if (this._justPressed(pad, 9) && actions.togglePause) {
      actions.togglePause();
    }
    // Back / Select (8) or D-Pad Down (13): Toggle Backpack Modal
    if ((this._justPressed(pad, 8) || this._justPressed(pad, 13)) && actions.toggleBackpack) {
      actions.toggleBackpack();
      this._snapshot(pad);
      return;
    }

    const gpCursor = document.getElementById('gp-cursor');

    // If Inventory / Container modal is open: Left-Stick Circular Cursor + Controller Item Actions
    if (ctx.isModalOpen) {
      if (gpCursor) {
        gpCursor.classList.remove('hidden');
        const speed = 640;
        this.cursorX = THREE.MathUtils.clamp(this.cursorX + ls.x * speed * dt, 10, window.innerWidth - 10);
        this.cursorY = THREE.MathUtils.clamp(this.cursorY + ls.y * speed * dt, 10, window.innerHeight - 10);
        gpCursor.style.left = `${this.cursorX}px`;
        gpCursor.style.top = `${this.cursorY}px`;

        // Hit-test slot or button under circular cursor
        const el = document.elementFromPoint(this.cursorX, this.cursorY);
        const slot = el ? el.closest('.inv-slot') : null;
        if (this._lastHoverSlot && this._lastHoverSlot !== slot) {
          this._lastHoverSlot.classList.remove('gp-hover');
        }
        this._lastHoverSlot = slot;
        if (slot) {
          slot.classList.add('gp-hover');
          if (ui && !slot.classList.contains('empty-slot') && !slot.classList.contains('searching')) {
            const ctxName = slot.dataset.context;
            const idx = parseInt(slot.dataset.idx, 10);
            const item = ctxName === 'container'
              ? (ui.activeLootSource && ui.activeLootSource.items[idx])
              : (player && player.backpack[idx]);
            if (item && (!ui._hoveredSlot || ui._hoveredSlot.el !== slot)) {
              ui.showItemPopout(slot, ctxName, item, idx, { inputMode: 'gamepad', mode: 'all' });
            }
          }
        } else if (ui && ui._hoveredSlot) {
          ui.hideItemPopout();
        }

        // A (0): Quick-Move hovered item, swap/loot enemy operator equipment slot, or click hovered button
        if (this._justPressed(pad, 0)) {
          if (slot && ui && ui._hoveredSlot) {
            ui.handleSlotAction('quick');
          } else if (el && el.closest('.op-slot-card[data-op-key]')) {
            el.closest('.op-slot-card[data-op-key]').click();
          } else if (el && el.closest('button')) {
            el.closest('button').click();
          }
        }
        // Y (3): Split Stack
        if (this._justPressed(pad, 3) && ui && ui._hoveredSlot) {
          ui.handleSlotAction('split');
        }
        // X (2): Drop hovered backpack item (or Take All if not over backpack)
        if (this._justPressed(pad, 2)) {
          if (ui && ui._hoveredSlot && ui._hoveredSlot.context === 'backpack') {
            ui.handleSlotAction('drop');
          } else if (actions.takeAll) {
            actions.takeAll();
          }
        }
      }
      if (this._justPressed(pad, 1) && actions.closeModal) {
        if (gpCursor) gpCursor.classList.add('hidden');
        actions.closeModal();
      }
      this._snapshot(pad);
      return;
    } else if (gpCursor && !gpCursor.classList.contains('hidden')) {
      gpCursor.classList.add('hidden');
    }

    if (ctx.isPaused || !player) {
      if (this._justPressed(pad, 0) && actions.resume) actions.resume();
      this._snapshot(pad);
      return;
    }

    // === LEFT STICK: ANALOG MOVEMENT ===
    player.padMoveX = ls.x;
    player.padMoveY = -ls.y; // stick up (-1) -> forward (+1)

    // Auto-clear toggle sprint when stick returns to neutral
    if (player.padMoveY < 0.45) {
      this.sprintToggled = false;
    }

    // === ROTATIONAL AIM ASSIST + ADS SLOWDOWN ===
    const slowdown = this._applyRotationalAimAssist(dt, player, ctx.enemyManager, ls, rs);

    // === RIGHT STICK: ANALOG LOOK (YAW & PITCH) ===
    if (rs.mag > 0) {
      const lookSpeed = (player.isADS ? 1.55 : 2.95) * (window.MOUSE_SENS || 1.0) * slowdown;
      player.yaw -= rs.x * lookSpeed * dt;
      player.pitch -= rs.y * lookSpeed * dt;
      player.pitch = THREE.MathUtils.clamp(player.pitch, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08);
    }

    // === SLIDE VIBRATION HAPTICS (KNEE-DROP THUMP + GRAVEL GLIDE RUMBLE) ===
    if (player.isSliding && !this._wasSliding) {
      this.rumble(110, 0.56, 0.48);
      this._slideRumbleTimer = 0.10;
    } else if (player.isSliding) {
      this._slideRumbleTimer -= dt;
      if (this._slideRumbleTimer <= 0) {
        this.rumble(110, 0.16, 0.36);
        this._slideRumbleTimer = 0.10;
      }
    }
    this._wasSliding = !!player.isSliding;

    // === LT (6): AIM DOWN SIGHTS (OR CANCEL THROWABLE PREP) ===
    const ltDown = this._isDown(pad, 6);
    if (this._justPressed(pad, 6)) {
      if (throwableSystem && throwableSystem.state === 'prep') {
        throwableSystem.cancelPrep();
        if (weaponSystem && !player.isThirdPerson) weaponSystem.viewmodelGroup.visible = true;
      }
    }
    if (ltDown !== this._lastLtDown) {
      player.isADS = ltDown;
      if (!ltDown) this.adsLean = 0; // reset Siege-style ADS lean on release
      this._lastLtDown = ltDown;
    }

    // === RT (7): FIRE WEAPON ===
    const rtDown = this._isDown(pad, 7);
    if (this._justPressed(pad, 7)) {
      if (!throwableSystem || !throwableSystem.isBusy()) {
        player.isFiring = true;
        if (actions.fire) actions.fire();
      }
    } else if (this._justReleased(pad, 7)) {
      player.isFiring = false;
    }
    if (!rtDown && this._lastRtDown) player.isFiring = false;
    this._lastRtDown = rtDown;

    // === L3 (10): SPRINT / TAC SPRINT ===
    if (this._justPressed(pad, 10)) {
      if (player.padMoveY > 0.35) {
        this.sprintToggled = true;
        player.onSprintKeyDown();
      }
    }
    player.padSprint = this.sprintToggled && player.padMoveY > 0.35;

    // === A / CROSS (0): JUMP / STAND UP / SLIDE-CANCEL ===
    if (this._justPressed(pad, 0)) {
      player.onJumpKeyDown();
    }

    // === B / CIRCLE (1): TAP = CROUCH / SLIDE, HOLD = PRONE ===
    if (this._justPressed(pad, 1)) {
      player.onCrouchKeyDown();
    } else if (this._justReleased(pad, 1)) {
      player.onCrouchKeyUp();
    }

    // === X / SQUARE (2): LOOT / INTERACT OR RELOAD ===
    if (this._justPressed(pad, 2)) {
      if (actions.interact && actions.interact()) {
        // interacted with nearby crate/corpse
      } else {
        player.startReload();
      }
    }

    // === Y / TRIANGLE (3): TAP = SWAP WEAPON, HOLD = ARMOR PLATES (WARZONE/DMZ STYLE!) ===
    if (this._isDown(pad, 3)) {
      this.yHoldTime += dt;
      if (!this.yHoldTriggered && this.yHoldTime >= 0.34) {
        this.yHoldTriggered = true;
        player.startPlating();
      }
    } else if (this._justReleased(pad, 3)) {
      if (!this.yHoldTriggered && this.yHoldTime < 0.34) {
        const nextSlot = player.activeSlot === 'primary' ? 'secondary' : 'primary';
        player.switchSlot(nextSlot);
      }
      this.yHoldTime = 0;
      this.yHoldTriggered = false;
    }

    // === LB (4) + RB (5) TOGETHER: ACTIVATE FIELD UPGRADE ===
    const lbDown = this._isDown(pad, 4);
    const rbDown = this._isDown(pad, 5);
    if (!lbDown && !rbDown) {
      this._fuChordConsumed = false;
    }
    if (lbDown && rbDown && !this._fuChordConsumed) {
      this._fuChordConsumed = true;
      if (throwableSystem && throwableSystem.state === 'prep') {
        throwableSystem.cancelPrep();
        if (weaponSystem && !player.isThirdPerson) weaponSystem.viewmodelGroup.visible = true;
      }
      if (actions.activateFieldUpgrade) {
        actions.activateFieldUpgrade();
      }
    } else if (!this._fuChordConsumed) {
      // === RB (5): LETHAL THROWABLE (TAP = QUICK THROW, HOLD = COOK / AIM) ===
      if (this._justPressed(pad, 5) && throwableSystem) {
        throwableSystem.startPrep('lethal', player, weaponSystem);
      } else if (this._justReleased(pad, 5) && throwableSystem) {
        throwableSystem.releaseThrow('lethal', player, ctx.enemyManager, actions.onThrowableHit);
      }

      // === LB (4): TACTICAL THROWABLE (TAP = QUICK THROW, HOLD = AIM) ===
      if (this._justPressed(pad, 4) && throwableSystem) {
        throwableSystem.startPrep('tactical', player, weaponSystem);
      } else if (this._justReleased(pad, 4) && throwableSystem) {
        throwableSystem.releaseThrow('tactical', player, ctx.enemyManager, actions.onThrowableHit);
      }
    }

    // === D-PAD: UP (12) = MEDKIT, LEFT (14) = INSPECT, RIGHT (15) = 3RD PERSON ===
    if (this._justPressed(pad, 12)) {
      if (player.startMedkit() && ui) ui.addFeedMessage('Applying Field Medkit...', '#69f0ae');
    }
    if (this._justPressed(pad, 14)) {
      player.startInspect();
    }
    if (this._justPressed(pad, 15)) {
      const tp = player.toggleThirdPerson();
      if (ui) ui.addFeedMessage(`CAMERA: ${tp ? '3RD PERSON' : '1ST PERSON'}`, '#f5a623');
    }

    this._snapshot(pad);
  }

  _getMenuScope() {
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

  _getVisibleFocusables(scope) {
    if (!scope) return [];
    const all = Array.from(scope.querySelectorAll('button:not(:disabled), input[type="range"], label.zone-card'));
    return all.filter((el) => {
      if (el.offsetParent === null) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }

  _setMenuFocus(el) {
    if (this._focusedEl && this._focusedEl !== el) {
      this._focusedEl.classList.remove('gp-focus');
    }
    this._focusedEl = el || null;
    if (this._focusedEl) {
      this._focusedEl.classList.add('gp-focus');
      this._focusedEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  clearMenuFocus() {
    this._setMenuFocus(null);
  }

  updateMenu(dt, { ui, gunsmith, onResume } = {}) {
    const pad = this._getPad();
    if (!pad) return;

    if (this._menuNavCooldown > 0) this._menuNavCooldown = Math.max(0, this._menuNavCooldown - dt);

    const ls = this._applyStickCurve(pad.axes[0] || 0, pad.axes[1] || 0);
    const rs = this._applyStickCurve(pad.axes[2] || 0, pad.axes[3] || 0);

    // Gunsmith 3D camera orbit & zoom with Right Stick + LT/RT
    if (gunsmith && gunsmith.isOpen) {
      if (rs.mag > 0) {
        gunsmith.rotY += rs.x * dt * 2.4;
        gunsmith.rotX = THREE.MathUtils.clamp(gunsmith.rotX + rs.y * dt * 1.6, -0.7, 0.85);
      }
      const lt = this._btnVal(pad, 6);
      const rt = this._btnVal(pad, 7);
      if (lt > 0.1 || rt > 0.1) {
        gunsmith.zoom = THREE.MathUtils.clamp(gunsmith.zoom + (lt - rt) * dt * 0.9, 0.52, 1.75);
      }
    }

    const scope = this._getMenuScope();
    const items = this._getVisibleFocusables(scope);
    if (items.length === 0) {
      this._snapshot(pad);
      return;
    }

    // Ensure valid focused element when controller is used in menus
    const dUp = this._isDown(pad, 12) || ls.y < -0.55;
    const dDown = this._isDown(pad, 13) || ls.y > 0.55;
    const dLeft = this._isDown(pad, 14) || ls.x < -0.55;
    const dRight = this._isDown(pad, 15) || ls.x > 0.55;
    const anyNav = dUp || dDown || dLeft || dRight || this._justPressed(pad, 0) || this._justPressed(pad, 1);

    let idx = items.indexOf(this._focusedEl);
    if (idx < 0 && anyNav) {
      this._setMenuFocus(items[0]);
      idx = 0;
    }

    // Range slider adjustment with Left / Right
    if (this._focusedEl && this._focusedEl.tagName === 'INPUT' && this._focusedEl.type === 'range') {
      if ((dLeft || dRight) && this._menuNavCooldown <= 0) {
        const step = parseFloat(this._focusedEl.step) || 1;
        const min = parseFloat(this._focusedEl.min);
        const max = parseFloat(this._focusedEl.max);
        const cur = parseFloat(this._focusedEl.value);
        const next = THREE.MathUtils.clamp(cur + (dRight ? step : -step), min, max);
        this._focusedEl.value = next;
        this._focusedEl.dispatchEvent(new Event('input', { bubbles: true }));
        this._menuNavCooldown = 0.12;
      }
    } else if ((dUp || dDown || dLeft || dRight) && this._menuNavCooldown <= 0) {
      const delta = (dDown || dRight) ? 1 : -1;
      const nextIdx = (idx + delta + items.length) % items.length;
      this._setMenuFocus(items[nextIdx]);
      this._menuNavCooldown = 0.18;
    }

    // A (0): Activate / Click focused button
    if (this._justPressed(pad, 0) && this._focusedEl) {
      this._focusedEl.click();
    }

    // B (1): Back / Close
    if (this._justPressed(pad, 1)) {
      if (gunsmith && gunsmith.isOpen) {
        const drawer = document.getElementById('gs-drawer');
        if (gunsmith.mode === 'customize') gunsmith.setMode('attachments');
        else if (drawer && !drawer.classList.contains('hidden')) gunsmith.closeDrawer();
        else gunsmith.close();
      } else if (onResume) {
        onResume();
      } else if (ui && ui.activeMenuTab && ui.activeMenuTab !== 'home') {
        ui.openMenuTab('home');
      }
    }

    // LB (4) / RB (5): Quick-switch tabs in Hideout or Gunsmith!
    if (this._justPressed(pad, 4) || this._justPressed(pad, 5)) {
      const dir = this._justPressed(pad, 5) ? 1 : -1;
      if (gunsmith && gunsmith.isOpen) {
        gunsmith.setMode(gunsmith.mode === 'attachments' ? 'customize' : 'attachments');
      } else if (ui && ui.activeMenuTab && ui.activeMenuTab !== 'home') {
        const tabs = ['deploy', 'stash', 'operator', 'settings'];
        const cur = tabs.indexOf(ui.activeMenuTab);
        if (cur >= 0) {
          ui.openMenuTab(tabs[(cur + dir + tabs.length) % tabs.length]);
          this._setMenuFocus(null);
        }
      }
    }

    this._snapshot(pad);
  }

  _snapshot(pad) {
    for (let i = 0; i < pad.buttons.length; i++) {
      this.prevButtons[i] = this._isDown(pad, i);
    }
  }
}
