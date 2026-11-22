// Standard Gamepad API Controller Support (Xbox / PlayStation / Standard CoD DMZ Layout)
class GamepadController {
  constructor() {
    this.connected = false;
    this.active = false; // true once controller input is used in-raid (allows playing without mouse pointer lock!)
    this.padIndex = null;
    this.prevButtons = [];
    this.yHoldTime = 0;
    this.yHoldTriggered = false;
    this.r3HoldTime = 0;
    this.r3HoldTriggered = false;
    this.sprintToggled = false;
    this.adsLean = 0; // -1 left, 0 center, +1 right (toggled via L3/R3 while ADS)
    this.deadzone = 0.15;
    this._wasSliding = false;
    this._lockUntilRelease = new Set(); // Prevents UI A/B presses from leaking into gameplay Jump/Crouch!
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

  _applyStickCurve(x, y, deadzoneOverride = null) {
    const dz = deadzoneOverride !== null ? deadzoneOverride : this.deadzone;
    const mag = Math.hypot(x, y);
    if (mag < dz) return { x: 0, y: 0, mag: 0 };
    const norm = Math.min(1, (mag - dz) / Math.max(0.01, 1 - dz));
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

  _applyRotationalAimAssist(dt, player, enemyManager, ls, rs, squadManager = null) {
    const aaStrength = (typeof window.CONTROLLER_AA_STRENGTH === 'number') ? window.CONTROLLER_AA_STRENGTH : 0.85;
    if (aaStrength <= 0.01) return 1.0;
    const candidates = [];
    if (enemyManager && enemyManager.enemies) {
      for (const e of enemyManager.enemies) {
        if (e && !e.dead && !e.extracted) candidates.push(e);
      }
    }
    if (window.SQUAD_PVP && squadManager && squadManager.allies) {
      for (const a of squadManager.allies) {
        if (a && !a.dead && !a.extracted) candidates.push(a);
      }
    }
    if (candidates.length === 0) return 1.0;

    // Rotational Aim Assist activates when strafing/moving left stick OR tracking with right stick!
    const engaged = ls.mag > 0.08 || rs.mag > 0.05;

    const eyePos = player.position;
    const sinY = Math.sin(player.yaw);
    const cosY = Math.cos(player.yaw);
    const cosP = Math.cos(player.pitch);
    const lookDir = new THREE.Vector3(-sinY * cosP, Math.sin(player.pitch), -cosY * cosP).normalize();

    let bestTarget = null;
    let bestAngle = 0.22; // ~12.6 deg outer assist bubble

    for (let i = 0; i < candidates.length; i++) {
      const e = candidates[i];
      const chestOff = e.isProne ? 0.38 : (e.isDowned ? 0.55 : 1.25);
      const aimPt = new THREE.Vector3(e.position.x, e.position.y + chestOff, e.position.z);
      const toEnemy = aimPt.clone().sub(eyePos);
      const dist = toEnemy.length();
      if (dist > 48 || dist < 0.8) continue;
      const dir = toEnemy.divideScalar(dist);
      const dot = THREE.MathUtils.clamp(lookDir.dot(dir), -1, 1);
      const angle = Math.acos(dot);
      if (angle < bestAngle) {
        bestAngle = angle;
        bestTarget = { aimPt, dist, angle };
      }
    }

    if (!bestTarget) return 1.0;

    // Aim slowdown factor inside inner cone (~7.5 deg) for sticky precision tracking
    const minSlow = THREE.MathUtils.lerp(1.0, 0.50, aaStrength);
    const slowdown = bestTarget.angle < 0.135
      ? THREE.MathUtils.lerp(minSlow, 1.0, bestTarget.angle / 0.135)
      : 1.0;

    // Rotational Aim Assist (scales with user-configured strength slider)
    if (engaged) {
      const dx = bestTarget.aimPt.x - eyePos.x;
      const dy = bestTarget.aimPt.y - eyePos.y;
      const dz = bestTarget.aimPt.z - eyePos.z;
      const horiz = Math.hypot(dx, dz) || 0.001;

      const desiredYaw = Math.atan2(-dx, -dz);
      const desiredPitch = Math.atan2(dy, horiz);

      let dYaw = desiredYaw - player.yaw;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      const dPitch = desiredPitch - player.pitch;

      const falloff = Math.pow(1 - bestTarget.angle / 0.22, 1.15);
      const strength = (player.isADS ? 5.2 : 2.8) * aaStrength * falloff;
      const pull = Math.min(1, dt * strength);

      player.yaw += dYaw * pull;
      player.pitch = THREE.MathUtils.clamp(player.pitch + dPitch * pull * 0.78, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08);
    }

    return slowdown;
  }

  update(dt, ctx) {
    const pad = this._getPad();
    if (!pad) return;

    const { player, weaponSystem, throwableSystem, ui, actions } = ctx;
    const lsDz = (typeof window.CONTROLLER_LS_DEADZONE === 'number') ? window.CONTROLLER_LS_DEADZONE : this.deadzone;
    const rsDz = (typeof window.CONTROLLER_RS_DEADZONE === 'number') ? window.CONTROLLER_RS_DEADZONE : this.deadzone;
    const ls = this._applyStickCurve(pad.axes[0] || 0, pad.axes[1] || 0, lsDz);
    const rs = this._applyStickCurve(pad.axes[2] || 0, pad.axes[3] || 0, rsDz);

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

    const gb = window.GAMEPAD_BINDS || {};
    const bPause = gb.pause ?? 9;
    const bMap = gb.map ?? 8;
    const bBackpack = gb.backpack ?? 13;
    const bAds = gb.ads ?? 6;
    const bFire = gb.fire ?? 7;
    const bSprint = gb.sprint ?? 10;
    const bJump = gb.jump ?? 0;
    const bCrouch = gb.crouch ?? 1;
    const bInteract = gb.interactReload ?? 2;
    const bSwap = gb.swapPlates ?? 3;
    const bTactical = gb.tactical ?? 4;
    const bLethal = gb.lethal ?? 5;
    const bMelee = gb.melee ?? 11;
    const bMedkit = gb.medkit ?? 12;
    const bInspect = gb.inspect ?? 14;
    const bKillstreak = gb.killstreak ?? 15;

    // Clear any button release latches once the player physically releases the button
    if (this._lockUntilRelease && this._lockUntilRelease.size > 0) {
      for (const idx of Array.from(this._lockUntilRelease)) {
        if (!this._isDown(pad, idx)) {
          this._lockUntilRelease.delete(idx);
        }
      }
    }

    // Start (9): Toggle Pause
    if (this._justPressed(pad, bPause) && actions.togglePause) {
      actions.togglePause();
    }
    // Back / Select (8): Toggle Full-Size Tactical Map
    if (this._justPressed(pad, bMap) && actions.toggleTacMap) {
      actions.toggleTacMap();
      this._snapshot(pad);
      return;
    }
    // B (1): Close Full-Size Tactical Map if open
    if (ui && ui.isTacMapOpen && !ctx.isModalOpen && this._justPressed(pad, 1) && actions.toggleTacMap) {
      actions.toggleTacMap(false);
      this._snapshot(pad);
      return;
    }
    // D-Pad Down (13): Only opens Backpack (or stows ground weapon on hold) when NOT already inside the bag/container!
    // Once the bag/container is open, D-Pad Down is used exclusively for spatial inventory navigation.
    if (!ctx.isModalOpen) {
      const dpadDown = this._isDown(pad, bBackpack);
      const canStow = actions.canStowGroundWeapon && actions.canStowGroundWeapon();
      if (dpadDown) {
        if (canStow) {
          this._dpadDownHoldTime = (this._dpadDownHoldTime || 0) + dt;
          if (!this._dpadDownStowed && this._dpadDownHoldTime >= 0.32 && actions.stowGroundWeapon) {
            actions.stowGroundWeapon();
            this._dpadDownStowed = true;
          }
        } else if (this._justPressed(pad, bBackpack) && actions.toggleBackpack) {
          actions.toggleBackpack();
          this._dpadDownHoldTime = 0;
          this._dpadDownStowed = true;
          this._snapshot(pad);
          return;
        }
      } else if (this.prevButtons[bBackpack]) {
        if (!this._dpadDownStowed && (this._dpadDownHoldTime || 0) > 0 && actions.toggleBackpack) {
          actions.toggleBackpack();
          this._dpadDownHoldTime = 0;
          this._dpadDownStowed = false;
          this._snapshot(pad);
          return;
        }
        this._dpadDownHoldTime = 0;
        this._dpadDownStowed = false;
      }
    } else {
      this._dpadDownHoldTime = 0;
      this._dpadDownStowed = false;
    }

    const gpCursor = document.getElementById('gp-cursor');

    // If Inventory / Container modal is open: Prioritize D-Pad Amber Spatial Selector (Left Stick cursor fallback)
    if (ctx.isModalOpen) {
      if (this._menuNavCooldown > 0) this._menuNavCooldown = Math.max(0, this._menuNavCooldown - dt);

      const dUp = this._isDown(pad, 12);
      const dDown = this._isDown(pad, 13);
      const dLeft = this._isDown(pad, 14);
      const dRight = this._isDown(pad, 15);
      const anyDpad = dUp || dDown || dLeft || dRight;

      if (anyDpad) {
        this._modalNavMode = 'dpad';
        if (gpCursor) gpCursor.classList.add('hidden');
        if (this._menuNavCooldown <= 0 && ui && ui.moveSpatialSelection) {
          const dir = dUp ? 'up' : (dDown ? 'down' : (dLeft ? 'left' : 'right'));
          ui.moveSpatialSelection(dir, { inputMode: 'gamepad' });
          this._menuNavCooldown = 0.16;
        }
      } else if (ls.mag > 0.25) {
        this._modalNavMode = 'cursor';
      }

      if (this._modalNavMode === 'cursor' && gpCursor) {
        gpCursor.classList.remove('hidden');
        const speed = 640;
        this.cursorX = THREE.MathUtils.clamp(this.cursorX + ls.x * speed * dt, 10, window.innerWidth - 10);
        this.cursorY = THREE.MathUtils.clamp(this.cursorY + ls.y * speed * dt, 10, window.innerHeight - 10);
        gpCursor.style.left = `${this.cursorX}px`;
        gpCursor.style.top = `${this.cursorY}px`;

        const el = document.elementFromPoint(this.cursorX, this.cursorY);
        const slot = el ? el.closest('.inv-slot') : null;
        if (this._lastHoverSlot && this._lastHoverSlot !== slot) {
          this._lastHoverSlot.classList.remove('gp-hover');
        }
        this._lastHoverSlot = slot;
        if (slot) {
          slot.classList.add('gp-hover');
          if (ui && ui.setSelectedElement) ui.setSelectedElement(slot, { inputMode: 'gamepad' });
        } else if (el && el.closest('.op-slot-card, button') && ui && ui.setSelectedElement) {
          ui.setSelectedElement(el.closest('.op-slot-card, button'), { inputMode: 'gamepad' });
        } else if (ui && ui._hoveredSlot) {
          ui.hideItemPopout();
        }
      } else if (ui && (!ui._selectedEl || !document.body.contains(ui._selectedEl))) {
        const firstSlot = (ui.activeLootSource && document.querySelector('#loot-container-items .inv-slot')) ||
          document.querySelector('#loot-backpack-items .inv-slot');
        if (firstSlot && ui.setSelectedElement) {
          ui.setSelectedElement(firstSlot, { inputMode: 'gamepad' });
        } else {
          ui.ensureInitialSelection({ inputMode: 'gamepad' });
        }
      }

      // Right Trigger (RT / bFire): Hold to Drag & Drop selected item to any slot (swapping if occupied!)
      const rtDownModal = this._isDown(pad, bFire);
      if (ui && rtDownModal && !this._modalRtDragging) {
        if (ui.startDragFromSelected && ui.startDragFromSelected()) {
          this._modalRtDragging = true;
        }
      } else if (this._modalRtDragging && !rtDownModal) {
        this._modalRtDragging = false;
        if (ui && ui.finishDragToSelected) ui.finishDragToSelected();
      }

      // A (0) / Cross: Stow / Accept / Confirm in Inventory & Container UI
      if (this._justPressed(pad, 0) && ui && !this._modalRtDragging) {
        this._lockUntilRelease.add(0);
        const handledInv = ui.handleGamepadInventoryAction ? ui.handleGamepadInventoryAction('a_cross') : false;
        if (!handledInv) {
          ui.activateSelectedElement({ inputMode: 'gamepad' });
        }
      }
      // Y (3) / Triangle: Split Stack
      if (this._justPressed(pad, 3) && ui && ui._hoveredSlot && !this._modalRtDragging) {
        ui.handleSlotAction('split');
      }
      // X (2) / Square: Quick-equip / swap item or weapon into an available slot
      if (this._justPressed(pad, 2) && ui && !this._modalRtDragging) {
        this._lockUntilRelease.add(2);
        if (ui.handleGamepadInventoryAction) {
          ui.handleGamepadInventoryAction('x_square');
        }
      }
      // R3 (11 / Right Stick Click): Drop entire stack (or equipped item) to ground
      if (this._justPressed(pad, 11) && ui && !this._modalRtDragging) {
        this._lockUntilRelease.add(11);
        if (ui.handleGamepadInventoryAction) {
          ui.handleGamepadInventoryAction('r3_drop_stack');
        }
      }
      // B (1) / Circle: Close / Back (Cancel weapon-switch picker -> Cancel drag -> Close Backpack/Container menu)
      if (this._justPressed(pad, 1)) {
        this._lockUntilRelease.add(1);
        if (ui && ui._raidWeaponPick && ui.closeRaidWeaponPickMode) {
          ui.closeRaidWeaponPickMode();
        } else if (this._modalRtDragging) {
          this._modalRtDragging = false;
          if (ui && ui.cancelDrag) ui.cancelDrag();
        } else if (actions.closeModal) {
          if (gpCursor) gpCursor.classList.add('hidden');
          actions.closeModal();
        }
      }
      this._snapshot(pad);
      return;
    } else if (gpCursor && !gpCursor.classList.contains('hidden')) {
      gpCursor.classList.add('hidden');
    }

    if (ctx.isPaused || !player) {
      // Delegate Pause / In-Game Settings menu navigation to unified updateMenu (A/Cross = Confirm, B/Circle = Close/Resume)
      this.updateMenu(dt, { ui, gunsmith: ctx.gunsmith, onResume: actions.resume });
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
    const slowdown = this._applyRotationalAimAssist(dt, player, ctx.enemyManager, ls, rs, ctx.squadManager);

    // === RIGHT STICK: ANALOG LOOK (YAW & PITCH) ===
    if (rs.mag > 0 && !player.dead) {
      const lookSpeed = (player.isADS ? 1.55 : 2.95) * (window.CONTROLLER_SENS || 1.0) * slowdown;
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

    // === LT: AIM DOWN SIGHTS (OR CANCEL THROWABLE PREP) ===
    const ltDown = this._isDown(pad, bAds);
    if (this._justPressed(pad, bAds)) {
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

    // === RT: FIRE WEAPON ===
    const rtDown = this._isDown(pad, bFire);
    if (this._justPressed(pad, bFire)) {
      if (!throwableSystem || !throwableSystem.isBusy()) {
        player.isFiring = true;
        if (actions.fire) actions.fire();
      }
    } else if (this._justReleased(pad, bFire)) {
      player.isFiring = false;
    }
    if (!rtDown && this._lastRtDown) player.isFiring = false;
    this._lastRtDown = rtDown;

    // === L3: SPRINT / TAC SPRINT ===
    if (this._justPressed(pad, bSprint)) {
      if (player.padMoveY > 0.35) {
        this.sprintToggled = true;
        player.onSprintKeyDown();
      }
    }
    player.padSprint = this.sprintToggled && player.padMoveY > 0.35;

    // === A / CROSS: JUMP / STAND UP / SLIDE-CANCEL (Strictly ignored if latched from closing UI!) ===
    if (!this._lockUntilRelease.has(bJump) && this._justPressed(pad, bJump)) {
      player.onJumpKeyDown();
    }

    // === B / CIRCLE: TAP = CROUCH / SLIDE, HOLD = PRONE (Strictly ignored if latched from closing UI!) ===
    if (!this._lockUntilRelease.has(bCrouch)) {
      if (this._justPressed(pad, bCrouch)) {
        player.onCrouchKeyDown();
      } else if (this._justReleased(pad, bCrouch)) {
        player.onCrouchKeyUp();
      }
    }

    // === X / SQUARE: LOOT / INTERACT OR RELOAD ===
    if (this._justPressed(pad, bInteract)) {
      if (actions.interact && actions.interact()) {
        // interacted with nearby crate/corpse
      } else {
        player.startReload();
      }
    }

    // === Y / TRIANGLE: TAP = SWAP WEAPON, HOLD = ARMOR PLATES (WARZONE/DMZ STYLE!) ===
    if (this._isDown(pad, bSwap)) {
      this.yHoldTime += dt;
      if (!this.yHoldTriggered && this.yHoldTime >= 0.34) {
        this.yHoldTriggered = true;
        player.startPlating();
      }
    } else if (this._justReleased(pad, bSwap)) {
      if (!this.yHoldTriggered && this.yHoldTime < 0.34) {
        const nextSlot = player.activeSlot === 'primary' ? 'secondary' : 'primary';
        player.switchSlot(nextSlot);
      }
      this.yHoldTime = 0;
      this.yHoldTriggered = false;
    }

    // === LB + RB TOGETHER: ACTIVATE FIELD UPGRADE ===
    const lbDown = this._isDown(pad, bTactical);
    const rbDown = this._isDown(pad, bLethal);
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
      // === RB: LETHAL THROWABLE (TAP = QUICK THROW, HOLD = COOK / AIM) ===
      if (this._justPressed(pad, bLethal) && !player.isDowned && !player.dead && throwableSystem) {
        throwableSystem.startPrep('lethal', player, weaponSystem);
      } else if (this._justReleased(pad, bLethal) && throwableSystem) {
        throwableSystem.releaseThrow('lethal', player, ctx.enemyManager, actions.onThrowableHit);
      }

      // === LB: TACTICAL THROWABLE (TAP = QUICK THROW, HOLD = AIM) ===
      if (this._justPressed(pad, bTactical) && !player.isDowned && !player.dead && throwableSystem) {
        throwableSystem.startPrep('tactical', player, weaponSystem);
      } else if (this._justReleased(pad, bTactical) && throwableSystem) {
        throwableSystem.releaseThrow('tactical', player, ctx.enemyManager, actions.onThrowableHit);
      }
    }

    // === R3: TAP = QUICK MELEE, HOLD = EQUIP DEDICATED MELEE WEAPON ===
    if (!player.isDowned && !player.dead) {
      if (this._isDown(pad, bMelee)) {
        this.r3HoldTime += dt;
        if (!this.r3HoldTriggered && this.r3HoldTime >= 0.32) {
          this.r3HoldTriggered = true;
          player.switchSlot('melee');
          if (ui) ui.addFeedMessage('Equipped Melee Weapon', '#f5a623');
        }
      } else if (this._justReleased(pad, bMelee)) {
        if (!this.r3HoldTriggered && this.r3HoldTime < 0.32) {
          if (actions.quickMelee) actions.quickMelee();
        }
        this.r3HoldTime = 0;
        this.r3HoldTriggered = false;
      }
    }

    // === D-PAD: MEDKIT, INSPECT, KILLSTREAK ===
    if (this._justPressed(pad, bMedkit)) {
      if (player.startMedkit() && ui) ui.addFeedMessage('Applying Field Medkit...', '#69f0ae');
    }
    if (this._justPressed(pad, bInspect)) {
      player.startInspect();
    }
    if (this._justPressed(pad, bKillstreak)) {
      if (actions.activateKillstreak) actions.activateKillstreak();
    }

    this._snapshot(pad);
  }

  _getMenuScope() {
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

    const lsDz = Number.isFinite(window.CONTROLLER_LS_DEADZONE) ? window.CONTROLLER_LS_DEADZONE : this.deadzone;
    const rsDz = Number.isFinite(window.CONTROLLER_RS_DEADZONE) ? window.CONTROLLER_RS_DEADZONE : this.deadzone;
    const ls = this._applyStickCurve(pad.axes[0] || 0, pad.axes[1] || 0, lsDz);
    const rs = this._applyStickCurve(pad.axes[2] || 0, pad.axes[3] || 0, rsDz);

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

    // Prioritize D-Pad (Left Stick fallback) using the Unified Amber Spatial Selector!
    const dUp = this._isDown(pad, 12);
    const dDown = this._isDown(pad, 13);
    const dLeft = this._isDown(pad, 14);
    const dRight = this._isDown(pad, 15);
    const sUp = !dUp && !dDown && !dLeft && !dRight && ls.y < -0.58;
    const sDown = !dUp && !dDown && !dLeft && !dRight && ls.y > 0.58;
    const sLeft = !dUp && !dDown && !dLeft && !dRight && ls.x < -0.58;
    const sRight = !dUp && !dDown && !dLeft && !dRight && ls.x > 0.58;

    const dir = (dUp || sUp) ? 'up'
      : (dDown || sDown) ? 'down'
      : (dLeft || sLeft) ? 'left'
      : (dRight || sRight) ? 'right'
      : null;

    if (ui && ui.moveSpatialSelection) {
      // Right Trigger (RT): Hold to Drag & Drop items across Pre-Match Stash / Backpack / Operator slots
      const bFireMenu = (window.GAMEPAD_BINDS && window.GAMEPAD_BINDS.fire !== undefined) ? window.GAMEPAD_BINDS.fire : 7;
      const rtDownMenu = this._isDown(pad, bFireMenu);
      if (rtDownMenu && !this._menuRtDragging && !(gunsmith && gunsmith.isOpen)) {
        if (ui.startDragFromSelected && ui.startDragFromSelected()) {
          this._menuRtDragging = true;
        }
      } else if (this._menuRtDragging && !rtDownMenu) {
        this._menuRtDragging = false;
        if (ui.finishDragToSelected) ui.finishDragToSelected();
      }

      if (dir && this._menuNavCooldown <= 0) {
        ui.moveSpatialSelection(dir, { inputMode: 'gamepad' });
        this._menuNavCooldown = (dUp || dDown || dLeft || dRight) ? 0.16 : 0.20;
      } else if (!ui._selectedEl || !document.body.contains(ui._selectedEl)) {
        ui.ensureInitialSelection({ inputMode: 'gamepad' });
      }

      // X (2) / Square: Quick weapon equip to active slot (from bag/container/enemy) or stow to bag weapon slot (from Primary/Secondary)
      if (this._justPressed(pad, 2) && !this._menuRtDragging) {
        if (ui.handleGamepadInventoryAction) {
          ui.handleGamepadInventoryAction('x_square');
        }
      }

      // A (0) / Cross: Universal Accept / Confirm on the currently highlighted menu button, card, or inventory slot!
      if (this._justPressed(pad, 0) && !this._menuRtDragging) {
        this._lockUntilRelease.add(0);
        if (!ui._selectedEl || !document.body.contains(ui._selectedEl)) {
          ui.ensureInitialSelection({ inputMode: 'gamepad' });
        }
        const handledInv = ui.handleGamepadInventoryAction ? ui.handleGamepadInventoryAction('a_cross') : false;
        if (!handledInv) {
          ui.activateSelectedElement({ inputMode: 'gamepad' });
        }
      }
    } else {
      const scope = this._getMenuScope();
      const items = this._getVisibleFocusables(scope);
      if (items.length === 0) {
        this._snapshot(pad);
        return;
      }
      let idx = items.indexOf(this._focusedEl);
      if (idx < 0 && dir) {
        this._setMenuFocus(items[0]);
        idx = 0;
      }
      if (dir && this._menuNavCooldown <= 0) {
        const delta = (dir === 'down' || dir === 'right') ? 1 : -1;
        this._setMenuFocus(items[(idx + delta + items.length) % items.length]);
        this._menuNavCooldown = 0.18;
      }
      if (this._justPressed(pad, 0) && this._focusedEl) {
        this._focusedEl.click();
      }
    }

    // B (1) / Circle: Universal Escape-equivalent — pops the topmost open UI layer one step at a time!
    if (this._justPressed(pad, 1)) {
      this._lockUntilRelease.add(1);
      const opCtx = document.getElementById('op-context-menu');
      const opSkin = document.getElementById('op-skin-modal');
      const opTraits = document.getElementById('op-traits-modal');
      const opRecruit = document.getElementById('op-recruit-modal');
      const popout = document.getElementById('item-popout');
      const sumScreen = document.getElementById('summary-screen');

      if (opCtx && !opCtx.classList.contains('hidden')) {
        opCtx.classList.add('hidden');
      } else if (opSkin && !opSkin.classList.contains('hidden')) {
        opSkin.classList.add('hidden');
      } else if (opTraits && !opTraits.classList.contains('hidden')) {
        opTraits.classList.add('hidden');
      } else if (opRecruit && !opRecruit.classList.contains('hidden')) {
        opRecruit.classList.add('hidden');
      } else if (ui && ui._raidWeaponPick && ui.closeRaidWeaponPickMode) {
        ui.closeRaidWeaponPickMode();
      } else if (ui && ui._deployWeaponPick && ui.closeDeployWeaponPickMode) {
        ui.closeDeployWeaponPickMode();
      } else if (popout && !popout.classList.contains('hidden') && ui && ui.hideItemPopout) {
        ui.hideItemPopout();
      } else if (ui && ui.isInGameSettingsOpen && ui.closeInGameSettings) {
        ui.closeInGameSettings(true);
      } else if (gunsmith && gunsmith.isOpen) {
        const drawer = document.getElementById('gs-drawer');
        if (gunsmith.mode === 'customize') gunsmith.setMode('attachments');
        else if (drawer && !drawer.classList.contains('hidden')) gunsmith.closeDrawer();
        else gunsmith.close();
      } else if (sumScreen && sumScreen.classList.contains('active')) {
        const retBtn = document.getElementById('btn-return-hideout') || sumScreen.querySelector('button');
        if (retBtn) retBtn.click();
      } else if (onResume) {
        onResume();
      } else if (ui && ui.activeMenuTab && ui.activeMenuTab !== 'home') {
        if (typeof window.onCloseHideoutOverlayTo3D === 'function' && window.onCloseHideoutOverlayTo3D()) {
          // Returned cleanly to 1st-person 3D Hideout bunker!
        } else {
          ui.openMenuTab('home');
        }
      } else if (ui && ui.activeMenuTab === 'home' && typeof window.onCloseHideoutOverlayTo3D === 'function') {
        window.onCloseHideoutOverlayTo3D();
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

  // Full native gameplay controller support inside the walkable 3D Hideout bunker!
  updateHideoutRoam(dt, hideoutBunker, { onOpenMenu, onInteractStation } = {}) {
    const pad = this._getPad();
    if (!pad || !hideoutBunker) return;

    // Clear release latches once physically released
    if (this._lockUntilRelease && this._lockUntilRelease.size > 0) {
      for (const idx of Array.from(this._lockUntilRelease)) {
        if (!this._isDown(pad, idx)) {
          this._lockUntilRelease.delete(idx);
        }
      }
    }

    const lsDz = (typeof window.CONTROLLER_LS_DEADZONE === 'number') ? window.CONTROLLER_LS_DEADZONE : this.deadzone;
    const rsDz = (typeof window.CONTROLLER_RS_DEADZONE === 'number') ? window.CONTROLLER_RS_DEADZONE : this.deadzone;
    const ls = this._applyStickCurve(pad.axes[0] || 0, pad.axes[1] || 0, lsDz);
    const rs = this._applyStickCurve(pad.axes[2] || 0, pad.axes[3] || 0, rsDz);
    const gb = window.GAMEPAD_BINDS || {};
    const bPause = gb.pause ?? 9;
    const bSprint = gb.sprint ?? 10;
    const bJump = gb.jump ?? 0;
    const bCrouch = gb.crouch ?? 1;
    const bInteract = gb.interactReload ?? 2;

    // Start / Pause (9): Open the Hideout Menu!
    if (this._justPressed(pad, bPause)) {
      this._lockUntilRelease.add(bPause);
      hideoutBunker.padMoveX = 0;
      hideoutBunker.padMoveY = 0;
      hideoutBunker.padSprint = false;
      if (onOpenMenu) onOpenMenu();
      this._snapshot(pad);
      return;
    }

    // Left Stick: Analog movement
    hideoutBunker.padMoveX = ls.x;
    hideoutBunker.padMoveY = -ls.y;
    if (hideoutBunker.padMoveY < 0.40) this.sprintToggled = false;

    // Right Stick: Analog camera look
    if (rs.mag > 0) {
      const lookSpeed = 2.6 * (window.CONTROLLER_SENS || 1.0);
      hideoutBunker.yaw -= rs.x * lookSpeed * dt;
      hideoutBunker.pitch = THREE.MathUtils.clamp(hideoutBunker.pitch - rs.y * lookSpeed * dt, -1.15, 1.15);
    }

    // L3: Sprint toggle
    if (this._justPressed(pad, bSprint) && hideoutBunker.padMoveY > 0.35) {
      this.sprintToggled = !this.sprintToggled;
    }
    hideoutBunker.padSprint = this.sprintToggled && hideoutBunker.padMoveY > 0.35;

    // A / Cross: Jump
    if (!this._lockUntilRelease.has(bJump) && this._justPressed(pad, bJump)) {
      hideoutBunker.padJump = true;
    }

    // B / Circle: Toggle Crouch
    if (!this._lockUntilRelease.has(bCrouch) && this._justPressed(pad, bCrouch)) {
      hideoutBunker.isCrouching = !hideoutBunker.isCrouching;
    }

    // X / Square: Interact with hovered Hideout station
    if (!this._lockUntilRelease.has(bInteract) && this._justPressed(pad, bInteract)) {
      if (hideoutBunker.hoveredStation && onInteractStation) {
        this._lockUntilRelease.add(bInteract);
        hideoutBunker.padMoveX = 0;
        hideoutBunker.padMoveY = 0;
        hideoutBunker.padSprint = false;
        onInteractStation(hideoutBunker.hoveredStation);
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
