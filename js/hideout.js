// ASHFALL // 3D Walkable Hideout Base & Physical Utility Stations (v1.93)
class HideoutBunker {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0f13);
    this.scene.fog = new THREE.FogExp2(0x0b0f13, 0.032);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 90);
    this.activeRoam = false;
    this.keys = {};
    this.pos = new THREE.Vector3(0, 1.68, 2.2);
    this.velY = 0;
    this.onGround = true;
    this.yaw = 0;
    this.pitch = -0.04;
    this.bobPhase = 0;
    this.idleOrbitTime = 0;
    this.colliders = [];
    this.stations = [];
    this.hoveredStation = null;
    this.stepAccum = 0;

    this._buildLighting();
    this._buildArchitecture();
    this._buildStations();
    this._buildAmbientProps();
  }

  _buildLighting() {
    const hemi = new THREE.HemisphereLight(0x9ab8cc, 0x1a1e22, 0.72);
    this.scene.add(hemi);

    const keyDir = new THREE.DirectionalLight(0xffdfb8, 0.85);
    keyDir.position.set(5, 11, 4);
    this.scene.add(keyDir);

    const fillDir = new THREE.DirectionalLight(0x5da9d9, 0.42);
    fillDir.position.set(-8, 7, -6);
    this.scene.add(fillDir);

    // Subtle warm central overhead bunker light + cool ops-table bounce (static only!)
    const warmHub = new THREE.PointLight(0xffb86c, 0.95, 22, 1.6);
    warmHub.position.set(0, 4.4, 0.5);
    this.scene.add(warmHub);

    const opsGlow = new THREE.PointLight(0x4fc3f7, 0.7, 14, 1.6);
    opsGlow.position.set(0, 2.6, -6.5);
    this.scene.add(opsGlow);
  }

  _addBox(w, h, d, x, y, z, mat, solid = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    if (solid) {
      this.colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2
      });
    }
    return mesh;
  }

  _buildArchitecture() {
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1b2024, roughness: 0.9, metalness: 0.1 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x262c31, roughness: 0.92, metalness: 0.08 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.75, metalness: 0.35 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x353d44, roughness: 0.55, metalness: 0.6 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x14181b, roughness: 0.95, metalness: 0.15 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe4b8 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xd9822b, transparent: true, opacity: 0.55 });

    const W = 24;
    const D = 20;
    const H = 5.4;

    // Floor & ceiling
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = H;
    this.scene.add(ceil);

    // Subtle tactical grid markings on bunker floor
    const grid = new THREE.GridHelper(22, 22, 0x3a4854, 0x222a30);
    grid.position.y = 0.01;
    this.scene.add(grid);

    // Perimeter safety stripes leading toward the central Ops Table
    const laneL = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 11.5), stripeMat);
    laneL.rotation.x = -Math.PI / 2;
    laneL.position.set(-2.4, 0.015, -1.0);
    this.scene.add(laneL);
    const laneR = laneL.clone();
    laneR.position.x = 2.4;
    this.scene.add(laneR);

    // Perimeter concrete bunker walls
    this._addBox(W, H, 0.6, 0, H / 2, -D / 2, concreteMat, true);
    this._addBox(W, H, 0.6, 0, H / 2, D / 2, concreteMat, true);
    this._addBox(0.6, H, D, -W / 2, H / 2, 0, concreteMat, true);
    this._addBox(0.6, H, D, W / 2, H / 2, 0, concreteMat, true);

    // Wall dado wainscot trim
    this._addBox(W - 0.8, 0.16, 0.12, 0, 1.15, -D / 2 + 0.36, trimMat, false);
    this._addBox(W - 0.8, 0.16, 0.12, 0, 1.15, D / 2 - 0.36, trimMat, false);
    this._addBox(0.12, 0.16, D - 0.8, -W / 2 + 0.36, 1.15, 0, trimMat, false);
    this._addBox(0.12, 0.16, D - 0.8, W / 2 - 0.36, 1.15, 0, trimMat, false);

    // Structural steel ceiling beams & overhead fluorescent/tungsten light strips
    for (let z = -7; z <= 7; z += 4.6) {
      this._addBox(W - 0.8, 0.32, 0.34, 0, H - 0.16, z, steelMat, false);
      for (const lx of [-5.5, 0, 5.5]) {
        this._addBox(2.2, 0.08, 0.24, lx, H - 0.34, z, trimMat, false);
        this._addBox(2.0, 0.04, 0.14, lx, H - 0.39, z, lampMat, false);
      }
    }

    // 4 Corner Structural Pillars
    const pillarCoords = [[-11.2, -9.2], [11.2, -9.2], [-11.2, 9.2], [11.2, 9.2]];
    for (const [px, pz] of pillarCoords) {
      this._addBox(1.1, H, 1.1, px, H / 2, pz, trimMat, true);
    }
  }

  _registerStation(id, tab, title, subtitle, x, y, z, accentHex, radius = 3.6) {
    // Subtle glowing floor interaction ring
    const ringGeo = new THREE.RingGeometry(0.95, 1.08, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: accentHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.42
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.025, z);
    this.scene.add(ring);

    this.stations.push({
      id,
      tab,
      title,
      subtitle,
      pos: new THREE.Vector3(x, y, z),
      labelPos: new THREE.Vector3(x, y + 1.55, z),
      accentHex,
      accentCss: `#${accentHex.toString(16).padStart(6, '0')}`,
      radius,
      ring,
      ringMat
    });
  }

  _buildStations() {
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x20262c, roughness: 0.5, metalness: 0.65 });
    const gunmetal = new THREE.MeshStandardMaterial({ color: 0x323b44, roughness: 0.42, metalness: 0.72 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c422c, roughness: 0.82, metalness: 0.08 });
    const oliveMat = new THREE.MeshStandardMaterial({ color: 0x3b4836, roughness: 0.78, metalness: 0.18 });
    const amberGlow = new THREE.MeshBasicMaterial({ color: 0xf5a623 });
    const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x4fc3f7 });
    const greenGlow = new THREE.MeshBasicMaterial({ color: 0x69f0ae });
    const redGlow = new THREE.MeshBasicMaterial({ color: 0xff6b6b });

    // 1. DEPLOY // SECTOR 7 OPS TABLE (North Center: 0, 0, -6.4)
    {
      const sx = 0, sz = -6.4;
      this._addBox(3.6, 0.92, 2.0, sx, 0.46, sz, darkSteel, true);
      this._addBox(3.75, 0.1, 2.15, sx, 0.95, sz, gunmetal, false);
      // Glowing holographic tactical map surface
      const mapMat = new THREE.MeshBasicMaterial({ color: 0x1e5c78, transparent: true, opacity: 0.85 });
      this._addBox(3.1, 0.04, 1.6, sx, 1.02, sz, mapMat, false);
      // Miniature 3D terrain hills & compound blocks on map
      const holoMat = new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.75 });
      this._addBox(0.42, 0.24, 0.36, sx - 0.7, 1.14, sz - 0.2, holoMat, false);
      this._addBox(0.56, 0.18, 0.48, sx + 0.55, 1.11, sz + 0.15, holoMat, false);
      this._addBox(0.28, 0.34, 0.28, sx + 0.05, 1.19, sz - 0.35, amberGlow, false);
      // Back wall mission display board
      this._addBox(4.2, 2.1, 0.14, sx, 2.65, -9.55, darkSteel, false);
      this._addBox(3.9, 1.8, 0.06, sx, 2.65, -9.45, new THREE.MeshBasicMaterial({ color: 0x112530 }), false);
      this._addBox(3.6, 0.08, 0.08, sx, 3.35, -9.4, amberGlow, false);
      this._registerStation('deploy', 'deploy', 'OPS TABLE // DEPLOY', 'Configure loadout & launch raid', sx, 1.0, sz + 1.45, 0xf5a623, 3.9);
    }

    // 2. GUNSMITH // ARMORY BENCH (North-West: -7.4, 0, -5.0)
    {
      const sx = -7.4, sz = -5.0;
      this._addBox(3.2, 0.92, 1.1, sx, 0.46, sz, darkSteel, true);
      this._addBox(3.3, 0.08, 1.2, sx, 0.96, sz, woodMat, false);
      // Pegboard rifle wall behind bench
      this._addBox(3.4, 2.2, 0.14, sx, 2.2, sz - 0.72, gunmetal, false);
      // 3D stylized rifles mounted on pegboard & resting on vise
      for (const ry of [1.75, 2.35, 2.85]) {
        this._addBox(1.55, 0.12, 0.09, sx - 0.2, ry, sz - 0.6, darkSteel, false);
        this._addBox(0.14, 0.26, 0.08, sx - 0.35, ry - 0.14, sz - 0.6, gunmetal, false);
      }
      // Rifle on bench vise + amber work strip
      this._addBox(1.15, 0.14, 0.12, sx, 1.12, sz, darkSteel, false);
      this._addBox(2.6, 0.05, 0.08, sx, 3.22, sz - 0.62, amberGlow, false);
      this._registerStation('gunsmith', 'gunsmith', 'GUNSMITH BENCH', '3D weapon mods & camos', sx, 1.0, sz + 1.15, 0xf5a623, 3.6);
    }

    // 3. WORKBENCH // CRAFTING STATION (West: -9.6, 0, 1.2)
    {
      const sx = -9.6, sz = 1.2;
      this._addBox(1.25, 0.92, 3.2, sx, 0.46, sz, darkSteel, true);
      this._addBox(1.35, 0.08, 3.3, sx, 0.96, sz, gunmetal, false);
      // Red mechanics tool chest + parts bins
      this._addBox(0.85, 0.72, 0.95, sx - 0.1, 1.36, sz - 0.85, new THREE.MeshStandardMaterial({ color: 0x7c2525, roughness: 0.55, metalness: 0.4 }), false);
      this._addBox(0.55, 0.38, 0.55, sx + 0.05, 1.19, sz + 0.65, oliveMat, false);
      this._addBox(0.08, 0.06, 2.4, sx - 0.5, 2.55, sz, greenGlow, false);
      this._registerStation('workbench', 'workbench', 'CRAFTING WORKBENCH', 'Craft gear & recycle salvage', sx + 1.25, 1.0, sz, 0x69f0ae, 3.6);
    }

    // 4. ACTIVE DUTY // OPERATOR LOCKER (South-West: -7.2, 0, 7.6)
    {
      const sx = -7.2, sz = 7.6;
      // 3 Vertical Active Duty Operator Locker Bays
      for (let i = -1; i <= 1; i++) {
        const lx = sx + i * 1.15;
        this._addBox(1.02, 2.45, 0.85, lx, 1.225, sz, oliveMat, true);
        this._addBox(0.84, 1.85, 0.12, lx, 1.25, sz - 0.4, darkSteel, false);
        // Hanging plate carrier silhouette inside each bay
        this._addBox(0.46, 0.56, 0.16, lx, 1.35, sz - 0.45, gunmetal, false);
        // Helmet on top shelf
        this._addBox(0.32, 0.24, 0.32, lx, 2.02, sz - 0.42, darkSteel, false);
      }
      this._addBox(3.3, 0.06, 0.08, sx, 2.58, sz - 0.42, cyanGlow, false);
      this._registerStation('operator', 'operator', 'ACTIVE DUTY LOCKER', 'Operators, dogtags & equipped gear', sx, 1.0, sz - 1.2, 0x4fc3f7, 3.8);
    }

    // 5. TRADER // BLACK MARKET COMMS TERMINAL (East-North: 9.2, 0, -3.4)
    {
      const sx = 9.2, sz = -3.4;
      this._addBox(1.3, 0.92, 2.8, sx, 0.46, sz, darkSteel, true);
      this._addBox(1.38, 0.08, 2.9, sx, 0.96, sz, gunmetal, false);
      // Dual encrypted monitors + radio tower box
      this._addBox(0.14, 0.62, 0.92, sx + 0.22, 1.44, sz - 0.52, darkSteel, false);
      this._addBox(0.06, 0.52, 0.82, sx + 0.14, 1.44, sz - 0.52, new THREE.MeshBasicMaterial({ color: 0x1d4a3a }), false);
      this._addBox(0.14, 0.62, 0.92, sx + 0.22, 1.44, sz + 0.52, darkSteel, false);
      this._addBox(0.06, 0.52, 0.82, sx + 0.14, 1.44, sz + 0.52, new THREE.MeshBasicMaterial({ color: 0x4a3318 }), false);
      this._addBox(0.08, 0.06, 2.1, sx + 0.38, 2.15, sz, amberGlow, false);
      this._registerStation('traders', 'traders', 'TRADER // "RUSTY"', 'Black Market arms & supplies', sx - 1.25, 1.0, sz, 0xf5a623, 3.6);
    }

    // 6. STASH // VAULT STORAGE CRATES (East-South: 8.8, 0, 3.6)
    {
      const sx = 8.8, sz = 3.6;
      this._addBox(1.4, 2.2, 2.6, sx, 1.1, sz, oliveMat, true);
      // Heavy stacked pelican weapon cases in front
      this._addBox(1.0, 0.44, 1.35, sx - 0.95, 0.22, sz - 0.45, darkSteel, true);
      this._addBox(0.92, 0.38, 1.15, sx - 0.95, 0.62, sz - 0.45, gunmetal, false);
      this._addBox(0.08, 0.06, 2.2, sx - 0.72, 2.28, sz, greenGlow, false);
      this._registerStation('stash', 'stash', 'HIDEOUT STASH', 'Vault inventory & valuables', sx - 1.65, 1.0, sz + 0.4, 0x69f0ae, 3.8);
    }

    // 7. SETTINGS // DIAGNOSTIC SERVER CONSOLE (South Center: 0, 0, 7.8)
    {
      const sx = 0, sz = 7.8;
      this._addBox(2.2, 1.9, 0.95, sx, 0.95, sz, darkSteel, true);
      this._addBox(1.8, 0.65, 0.08, sx, 1.42, sz - 0.49, new THREE.MeshBasicMaterial({ color: 0x172b3a }), false);
      this._addBox(1.6, 0.06, 0.08, sx, 1.88, sz - 0.49, cyanGlow, false);
      // Blinking status LEDs
      this._addBox(0.12, 0.08, 0.08, sx - 0.6, 0.78, sz - 0.49, greenGlow, false);
      this._addBox(0.12, 0.08, 0.08, sx - 0.35, 0.78, sz - 0.49, amberGlow, false);
      this._addBox(0.12, 0.08, 0.08, sx - 0.1, 0.78, sz - 0.49, redGlow, false);
      this._registerStation('settings', 'settings', 'SYSTEM CONSOLE', 'Controls, audio, FOV & settings', sx, 1.0, sz - 1.15, 0x90caf9, 3.6);
    }
  }

  _buildAmbientProps() {
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x3b4435, roughness: 0.85, metalness: 0.15 });
    const darkCrate = new THREE.MeshStandardMaterial({ color: 0x252b30, roughness: 0.78, metalness: 0.32 });

    // Corner supply crates & sandbag stacks for atmosphere
    this._addBox(1.1, 0.72, 1.1, -9.8, 0.36, -8.0, crateMat, true);
    this._addBox(0.82, 0.55, 0.82, -9.8, 1.0, -8.0, darkCrate, false);
    this._addBox(1.2, 0.8, 1.0, 9.6, 0.4, -7.8, crateMat, true);
    this._addBox(1.0, 0.68, 1.2, 9.6, 0.34, 7.6, darkCrate, true);
  }

  onResize() {
    if (!this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  enterRoam(canvas) {
    this.activeRoam = true;
    this.keys = {};
    if (canvas && canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch (e) {}
    }
  }

  exitRoam() {
    this.activeRoam = false;
    this.keys = {};
    if (document.pointerLockElement && document.exitPointerLock) {
      try { document.exitPointerLock(); } catch (e) {}
    }
  }

  handleMouseMove(dx, dy) {
    if (!this.activeRoam) return;
    const sens = 0.0022 * (window.MOUSE_SENS || 1.0);
    this.yaw -= dx * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sens, -Math.PI / 2 + 0.14, Math.PI / 2 - 0.14);
  }

  _resolveCollisions(nextPos) {
    const r = 0.42;
    nextPos.x = THREE.MathUtils.clamp(nextPos.x, -11.1, 11.1);
    nextPos.z = THREE.MathUtils.clamp(nextPos.z, -9.1, 9.1);
    for (const c of this.colliders) {
      const cx = THREE.MathUtils.clamp(nextPos.x, c.minX, c.maxX);
      const cz = THREE.MathUtils.clamp(nextPos.z, c.minZ, c.maxZ);
      const dx = nextPos.x - cx;
      const dz = nextPos.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < r * r) {
        const dist = Math.sqrt(distSq) || 0.0001;
        const push = r - dist;
        nextPos.x += (dx / dist) * push;
        nextPos.z += (dz / dist) * push;
      }
    }
  }

  update(dt, renderer) {
    if (!renderer) return;
    this.idleOrbitTime += dt;

    // Pulse station floor rings gently
    for (const st of this.stations) {
      const isHov = this.hoveredStation === st;
      st.ringMat.opacity = isHov ? 0.88 : (0.30 + 0.14 * Math.sin(this.idleOrbitTime * 2.6 + st.pos.x));
      st.ring.scale.setScalar(isHov ? 1.12 : 1.0);
    }

    if (this.activeRoam) {
      // First-person walkable movement inside Hideout
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const move = new THREE.Vector3();
      if (this.keys['KeyW'] || this.keys['ArrowUp']) move.add(fwd);
      if (this.keys['KeyS'] || this.keys['ArrowDown']) move.sub(fwd);
      if (this.keys['KeyD'] || this.keys['ArrowRight']) move.add(right);
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) move.sub(right);
      if (this.padMoveY) move.addScaledVector(fwd, this.padMoveY);
      if (this.padMoveX) move.addScaledVector(right, this.padMoveX);

      const isMoving = move.lengthSq() > 0.001;
      const isSprinting = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.padSprint);
      const speed = this.isCrouching ? 2.4 : (isSprinting ? 6.2 : 3.9);
      if (isMoving) {
        if (move.lengthSq() > 1) move.normalize();
        move.multiplyScalar(speed * dt);
        const nextPos = this.pos.clone().add(move);
        this._resolveCollisions(nextPos);
        this.pos.x = nextPos.x;
        this.pos.z = nextPos.z;
        this.bobPhase += dt * (speed > 5 ? 12.5 : 8.5);
        this.stepAccum += speed * dt;
        if (this.stepAccum >= 2.15 && this.onGround) {
          this.stepAccum = 0;
          if (window.soundEngine && window.soundEngine.playFootstep) {
            try { window.soundEngine.playFootstep(speed > 5); } catch (e) {}
          }
        }
      }

      if ((this.keys['Space'] || this.padJump) && this.onGround) {
        this.isCrouching = false;
        this.velY = 4.6;
        this.onGround = false;
      }
      this.padJump = false;
      this.velY -= 14.0 * dt;
      const targetEyeY = this.isCrouching ? 1.12 : 1.68;
      this.pos.y += this.velY * dt;
      if (this.pos.y <= targetEyeY) {
        this.pos.y = targetEyeY;
        this.velY = 0;
        this.onGround = true;
      }

      const bobY = (isMoving && this.onGround) ? Math.sin(this.bobPhase) * 0.045 : 0;
      this.camera.position.set(this.pos.x, this.pos.y + bobY, this.pos.z);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.camera.rotation.z = 0;

      // Find nearest station in front of the player within interaction radius
      const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
      let best = null;
      let bestScore = Infinity;
      for (const st of this.stations) {
        const d = Math.hypot(this.pos.x - st.pos.x, this.pos.z - st.pos.z);
        if (d <= st.radius) {
          const toSt = st.labelPos.clone().sub(this.camera.position).normalize();
          const dot = toSt.dot(lookDir);
          if (dot > 0.35 || d < 1.8) {
            const score = d - dot * 1.4;
            if (score < bestScore) {
              bestScore = score;
              best = st;
            }
          }
        }
      }
      this.hoveredStation = best;
    } else {
      // Gentle cinematic overview camera behind player position when Menu Overlay is open
      const swayX = Math.sin(this.idleOrbitTime * 0.22) * 1.1;
      const swayZ = Math.cos(this.idleOrbitTime * 0.17) * 0.6;
      this.camera.position.set(this.pos.x + swayX, 2.35, Math.min(8.2, this.pos.z + 2.4 + swayZ));
      this.camera.lookAt(0, 1.35, -3.5);
      this.hoveredStation = null;
    }

    renderer.autoClear = true;
    renderer.render(this.scene, this.camera);
    this._updateStationOverlay();
  }

  _updateStationOverlay() {
    const layer = document.getElementById('hideout-station-markers');
    const promptEl = document.getElementById('hideout-interact-prompt');
    if (!layer) return;

    if (!this.activeRoam) {
      layer.classList.add('hidden');
      if (promptEl) promptEl.classList.add('hidden');
      return;
    }

    layer.classList.remove('hidden');
    const W = window.innerWidth;
    const H = window.innerHeight;

    // Ensure marker DOM nodes exist once
    if (layer.childElementCount !== this.stations.length) {
      layer.innerHTML = '';
      for (const st of this.stations) {
        const tag = document.createElement('div');
        tag.className = 'hideout-station-tag';
        tag.dataset.stationId = st.id;
        tag.innerHTML = `<span class="hst-dot" style="background:${st.accentCss};box-shadow:0 0 8px ${st.accentCss};"></span><span class="hst-name">${st.title}</span><span class="hst-dist"></span>`;
        layer.appendChild(tag);
      }
    }

    const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.stations.forEach((st, idx) => {
      const el = layer.children[idx];
      if (!el) return;
      const toPt = st.labelPos.clone().sub(this.camera.position);
      if (toPt.dot(camFwd) <= 0.1) {
        el.style.display = 'none';
        return;
      }
      const p = st.labelPos.clone().project(this.camera);
      if (p.z > 1) {
        el.style.display = 'none';
        return;
      }
      const sx = (p.x * 0.5 + 0.5) * W;
      const sy = (-p.y * 0.5 + 0.5) * H;
      const dist = Math.hypot(this.pos.x - st.pos.x, this.pos.z - st.pos.z);
      el.style.display = 'inline-flex';
      el.style.left = `${Math.round(sx)}px`;
      el.style.top = `${Math.round(sy)}px`;
      el.classList.toggle('active', this.hoveredStation === st);
      const distEl = el.querySelector('.hst-dist');
      if (distEl) distEl.textContent = `${Math.round(dist)}m`;
    });

    if (promptEl) {
      if (this.hoveredStation) {
        promptEl.classList.remove('hidden');
        const keyName = (window.KEYBINDS && window.KEYBINDS.interact)
          ? window.KEYBINDS.interact.replace('Key', '')
          : 'E';
        promptEl.innerHTML = `
          <span class="hip-key">${keyName}</span>
          <div class="hip-copy">
            <span class="hip-title">${this.hoveredStation.title}</span>
            <span class="hip-sub">${this.hoveredStation.subtitle}</span>
          </div>
        `;
      } else {
        promptEl.classList.add('hidden');
      }
    }
  }
}

window.HideoutBunker = HideoutBunker;
