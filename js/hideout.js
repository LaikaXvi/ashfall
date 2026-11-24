// ASHFALL // 3D Walkable DMZ-Style FOB Social Hub, Exfil Helipad & Live Party Avatars (v2.38)
class HideoutBunker {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1014);
    this.scene.fog = new THREE.FogExp2(0x0c1014, 0.022);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 120);
    this.activeRoam = false;
    this.keys = {};
    this.pos = new THREE.Vector3(0, 1.68, 3.2);
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
    this.heloMainRotor = null;
    this.heloTailRotor = null;
    this.remoteAvatars = new Map();
    this.fobHostName = null;
    this.isHostFob = true;
    this._partyMemberIds = new Set();

    this._buildLighting();
    this._buildArchitecture();
    this._buildHelipadAndChopper();
    this._buildStations();
    this._buildAmbientProps();
  }

  _buildLighting() {
    const hemi = new THREE.HemisphereLight(0xa0b9cc, 0x1b1f22, 0.85);
    this.scene.add(hemi);

    const keyDir = new THREE.DirectionalLight(0xffdfb4, 0.90);
    keyDir.position.set(8, 15, 6);
    this.scene.add(keyDir);

    const fillDir = new THREE.DirectionalLight(0x5fa4d4, 0.45);
    fillDir.position.set(-10, 8, -14);
    this.scene.add(fillDir);

    const warmHub = new THREE.PointLight(0xffb86c, 1.0, 28, 1.5);
    warmHub.position.set(0, 5.6, 0.5);
    this.scene.add(warmHub);

    const heloGlow = new THREE.PointLight(0x69f0ae, 0.85, 20, 1.6);
    heloGlow.position.set(0, 4.2, -16.5);
    this.scene.add(heloGlow);
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
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x202529 });
    const concreteMat = new THREE.MeshLambertMaterial({ color: 0x2d3338 });
    const trimMat = new THREE.MeshLambertMaterial({ color: 0x171b1f });
    const steelMat = new THREE.MeshLambertMaterial({ color: 0x3b444c });
    const ceilMat = new THREE.MeshLambertMaterial({ color: 0x161a1d });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe4b8 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xd9822b, transparent: true, opacity: 0.62 });

    const W = 34;
    const D = 28;
    const H = 6.8;

    // Hangar concrete slab floor & roof
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = H;
    this.scene.add(ceil);

    // Tactical grid markings on hangar floor
    const grid = new THREE.GridHelper(32, 32, 0x3d4c58, 0x242c33);
    grid.position.y = 0.01;
    this.scene.add(grid);

    // Safety guide lanes leading from central Armory straight out to North Exfil Helipad
    const laneL = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 22), stripeMat);
    laneL.rotation.x = -Math.PI / 2;
    laneL.position.set(-3.2, 0.015, -3.5);
    this.scene.add(laneL);
    const laneR = laneL.clone();
    laneR.position.x = 3.2;
    this.scene.add(laneR);

    // South, West & East Hangar Walls
    this._addBox(W, H, 0.7, 0, H / 2, D / 2, concreteMat, true);
    this._addBox(0.7, H, D, -W / 2, H / 2, 0, concreteMat, true);
    this._addBox(0.7, H, D, W / 2, H / 2, 0, concreteMat, true);

    // North Wall with wide 12m open Hangar Bay Gate leading to the Exfil Helipad
    this._addBox(11.0, H, 0.7, -11.5, H / 2, -D / 2, concreteMat, true);
    this._addBox(11.0, H, 0.7, 11.5, H / 2, -D / 2, concreteMat, true);
    this._addBox(12.2, 1.8, 0.7, 0, H - 0.9, -D / 2, steelMat, false);
    // Hazard header bar above hangar bay opening
    this._addBox(12.2, 0.16, 0.82, 0, H - 1.82, -D / 2, stripeMat, false);

    // Dado wall trim
    this._addBox(W - 0.8, 0.18, 0.14, 0, 1.2, D / 2 - 0.42, trimMat, false);
    this._addBox(0.14, 0.18, D - 0.8, -W / 2 + 0.42, 1.2, 0, trimMat, false);
    this._addBox(0.14, 0.18, D - 0.8, W / 2 - 0.42, 1.2, 0, trimMat, false);

    // Structural steel ceiling trusses & warm hangar lamps
    for (let z = -10.5; z <= 10.5; z += 5.25) {
      this._addBox(W - 0.8, 0.38, 0.36, 0, H - 0.19, z, steelMat, false);
      for (const lx of [-9.5, 0, 9.5]) {
        this._addBox(2.6, 0.10, 0.28, lx, H - 0.42, z, trimMat, false);
        this._addBox(2.4, 0.05, 0.16, lx, H - 0.48, z, lampMat, false);
      }
    }

    // Structural hangar columns
    for (const [px, pz] of [[-15.8, -12.8], [15.8, -12.8], [-15.8, 12.8], [15.8, 12.8], [-15.8, 0], [15.8, 0]]) {
      this._addBox(1.1, H, 1.1, px, H / 2, pz, trimMat, true);
    }
  }

  _buildHelipadAndChopper() {
    const tarmacMat = new THREE.MeshLambertMaterial({ color: 0x1a1e22 });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xe8b236 });
    const greenLamp = new THREE.MeshBasicMaterial({ color: 0x69f0ae });
    const redLamp = new THREE.MeshBasicMaterial({ color: 0xff5252 });
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0x2c3238 });
    const heloOlive = new THREE.MeshLambertMaterial({ color: 0x384534 });
    const heloDark = new THREE.MeshLambertMaterial({ color: 0x1b1f22 });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x263f4d });

    // Outdoor concrete tarmac apron north of hangar (z = -14 to -28)
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(34, 15), tarmacMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(0, -0.01, -21.5);
    this.scene.add(apron);

    // Painted Helipad Ring + Yellow 'H' at (0, -19.5)
    const padRing = new THREE.Mesh(new THREE.RingGeometry(4.4, 4.75, 24), yellowMat);
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.set(0, 0.02, -19.5);
    this.scene.add(padRing);
    this._addBox(0.32, 0.02, 2.8, -1.0, 0.02, -19.5, yellowMat, false);
    this._addBox(0.32, 0.02, 2.8, 1.0, 0.02, -19.5, yellowMat, false);
    this._addBox(2.0, 0.02, 0.32, 0, 0.02, -19.5, yellowMat, false);

    // Perimeter landing lights & low blast barriers
    for (const [bx, bz] of [[-5.6, -15.2], [5.6, -15.2], [-5.6, -24.0], [5.6, -24.0]]) {
      this._addBox(0.35, 0.35, 0.35, bx, 0.18, bz, heloDark, false);
      this._addBox(0.22, 0.16, 0.22, bx, 0.42, bz, bz > -18 ? greenLamp : redLamp, false);
    }
    this._addBox(34, 1.3, 0.5, 0, 0.65, -26.5, fenceMat, true);

    // Low-poly PS2 Exfil Transport Helicopter parked on pad at (0, 0, -20.2)
    const helo = new THREE.Group();
    helo.position.set(0, 0, -20.2);
    helo.rotation.y = 0.28;

    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.85, 5.4), heloOlive);
    fuselage.position.set(0, 1.65, 0);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.35, 1.5), heloOlive);
    nose.position.set(0, 1.4, 3.2);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.85, 1.3), glassMat);
    canopy.position.set(0, 2.0, 2.65);
    const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.68, 4.8), heloOlive);
    tailBoom.position.set(0, 2.15, -4.8);
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.65, 0.9), heloOlive);
    tailFin.position.set(0, 2.75, -7.0);
    const rotorMast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.75, 8), heloDark);
    rotorMast.position.set(0, 2.85, 0.2);
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 4.8), heloDark);
    skidL.position.set(-1.35, 0.12, 0.2);
    const skidR = skidL.clone();
    skidR.position.x = 1.35;
    for (const sx of [-1.2, 1.2]) {
      for (const sz of [-1.1, 1.4]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), heloDark);
        strut.position.set(sx, 0.52, sz);
        helo.add(strut);
      }
    }

    const mainRotor = new THREE.Group();
    mainRotor.position.set(0, 3.22, 0.2);
    const bladeA = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.05, 0.34), heloDark);
    const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 9.2), heloDark);
    mainRotor.add(bladeA, bladeB);
    this.heloMainRotor = mainRotor;

    const tailRotor = new THREE.Group();
    tailRotor.position.set(0.22, 3.1, -7.1);
    const tBlade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.16), heloDark);
    tailRotor.add(tBlade);
    this.heloTailRotor = tailRotor;

    helo.add(fuselage, nose, canopy, tailBoom, tailFin, rotorMast, skidL, skidR, mainRotor, tailRotor);
    this.scene.add(helo);

    // Collider around chopper so player walks up to the boarding ramp without clipping through
    this.colliders.push({ minX: -2.4, maxX: 2.4, minZ: -23.5, maxZ: -16.8 });
  }

  _registerStation(id, tab, title, subtitle, x, y, z, accentHex, radius = 3.8) {
    const ringGeo = new THREE.RingGeometry(0.95, 1.12, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: accentHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.44
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
    const darkSteel = new THREE.MeshLambertMaterial({ color: 0x22282e });
    const gunmetal = new THREE.MeshLambertMaterial({ color: 0x353f48 });
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x5c422c });
    const oliveMat = new THREE.MeshLambertMaterial({ color: 0x3d4b37 });
    const amberGlow = new THREE.MeshBasicMaterial({ color: 0xf5a623 });
    const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x4fc3f7 });
    const greenGlow = new THREE.MeshBasicMaterial({ color: 0x69f0ae });
    const redGlow = new THREE.MeshBasicMaterial({ color: 0xff6b6b });

    // 1. ARMORY // LOADOUT (Center North: 0, -5.2)
    {
      const sx = 0, sz = -6.6;
      this._addBox(3.8, 0.92, 2.0, sx, 0.46, sz, darkSteel, true);
      this._addBox(3.95, 0.1, 2.15, sx, 0.95, sz, gunmetal, false);
      const mapMat = new THREE.MeshBasicMaterial({ color: 0x1e5c78, transparent: true, opacity: 0.85 });
      this._addBox(3.2, 0.04, 1.6, sx, 1.02, sz, mapMat, false);
      this._addBox(0.45, 0.25, 0.35, sx - 0.7, 1.14, sz - 0.2, cyanGlow, false);
      this._addBox(0.32, 0.32, 0.32, sx + 0.1, 1.18, sz - 0.3, amberGlow, false);
      this._registerStation('armory', 'deploy', 'ARMORY // LOADOUT', 'Equip weapons, armor & ready up', sx, 1.0, sz + 1.6, 0xf5a623, 4.1);
    }

    // 2. EXFIL HELIPAD // DEPLOY (North Helipad: 0, -14.8)
    {
      const sx = 0, sz = -14.8;
      this._addBox(0.55, 1.3, 0.55, sx - 2.6, 0.65, sz, darkSteel, true);
      this._addBox(0.38, 0.24, 0.12, sx - 2.6, 1.42, sz + 0.22, greenGlow, false);
      this._registerStation('exfil', 'map', 'EXFIL HELIPAD // DEPLOY', 'Select operation zone & infil', sx, 1.0, sz, 0x69f0ae, 4.6);
    }

    // 3. MISSIONS // CONTRACT BOARD (North-West Wall: -8.2, -12.6)
    {
      const sx = -8.2, sz = -12.8;
      this._addBox(4.0, 2.2, 0.18, sx, 2.0, sz, darkSteel, true);
      this._addBox(3.7, 1.9, 0.08, sx, 2.0, sz + 0.12, new THREE.MeshBasicMaterial({ color: 0x17242b }), false);
      this._addBox(3.4, 0.10, 0.10, sx, 2.75, sz + 0.18, amberGlow, false);
      this._addBox(0.85, 0.65, 0.06, sx - 1.0, 1.85, sz + 0.18, cyanGlow, false);
      this._addBox(0.85, 0.65, 0.06, sx + 0.0, 1.85, sz + 0.18, greenGlow, false);
      this._addBox(0.85, 0.65, 0.06, sx + 1.0, 1.85, sz + 0.18, redGlow, false);
      this._registerStation('missions', 'missions', 'MISSIONS // CONTRACTS', 'Accept faction contracts & claim rewards', sx, 1.0, sz + 1.6, 0xffca28, 4.0);
    }

    // 4. GUNSMITH BENCH (West North: -14.2, -5.2)
    {
      const sx = -14.4, sz = -5.2;
      this._addBox(1.2, 0.92, 3.4, sx, 0.46, sz, darkSteel, true);
      this._addBox(1.3, 0.08, 3.5, sx, 0.96, sz, woodMat, false);
      this._addBox(0.16, 2.2, 3.6, sx - 0.72, 2.2, sz, gunmetal, false);
      for (const ry of [1.75, 2.35, 2.85]) {
        this._addBox(0.09, 0.12, 1.55, sx - 0.58, ry, sz, darkSteel, false);
      }
      this._addBox(0.12, 0.08, 2.6, sx - 0.62, 3.15, sz, amberGlow, false);
      this._registerStation('gunsmith', 'gunsmith', 'GUNSMITH BENCH', '3D weapon mods, optics & camos', sx + 1.5, 1.0, sz, 0xf5a623, 3.8);
    }

    // 5. CRAFTING WORKBENCH (West South: -14.2, 2.8)
    {
      const sx = -14.4, sz = 2.8;
      this._addBox(1.2, 0.92, 3.4, sx, 0.46, sz, darkSteel, true);
      this._addBox(1.3, 0.08, 3.5, sx, 0.96, sz, woodMat, false);
      this._addBox(0.65, 0.62, 0.75, sx, 1.32, sz - 0.9, gunmetal, false);
      this._addBox(0.50, 0.45, 0.65, sx, 1.24, sz + 0.85, oliveMat, false);
      this._addBox(0.10, 0.08, 2.6, sx - 0.62, 2.6, sz, greenGlow, false);
      this._registerStation('workbench', 'workbench', 'CRAFTING WORKBENCH', 'Craft gear, meds & recycle salvage', sx + 1.5, 1.0, sz, 0x69f0ae, 3.8);
    }

    // 6. QUARTERMASTER // "RUSTY" (East North: 14.4, -5.2)
    {
      const sx = 14.4, sz = -5.2;
      this._addBox(1.3, 1.02, 3.6, sx, 0.51, sz, darkSteel, true);
      this._addBox(1.4, 0.08, 3.7, sx, 1.04, sz, woodMat, false);
      this._addBox(0.65, 0.55, 0.85, sx + 0.15, 1.35, sz - 0.8, oliveMat, false);
      this._addBox(0.55, 0.50, 0.68, sx + 0.15, 1.30, sz + 0.75, gunmetal, false);
      this._addBox(0.10, 0.10, 2.6, sx + 0.62, 2.7, sz, amberGlow, false);
      this._registerStation('traders', 'traders', 'QUARTERMASTER // "RUSTY"', 'Black Market arms, ammo & gear', sx - 1.5, 1.0, sz, 0xf5a623, 3.8);
    }

    // 7. HIDEOUT STASH VAULT (East South: 14.4, 2.8)
    {
      const sx = 14.4, sz = 2.8;
      this._addBox(1.4, 2.3, 3.6, sx, 1.15, sz, gunmetal, true);
      this._addBox(0.12, 1.9, 3.2, sx - 0.72, 1.15, sz, darkSteel, false);
      this._addBox(0.08, 0.12, 2.4, sx - 0.78, 2.05, sz, greenGlow, false);
      this._registerStation('stash', 'stash', 'VAULT // STASH', 'Secure stash inventory & valuables', sx - 1.6, 1.0, sz, 0x69f0ae, 3.8);
    }

    // 8. ACTIVE DUTY LOCKERS (South-West: -8.6, 12.2)
    {
      const sx = -8.6, sz = 12.2;
      this._addBox(3.4, 2.3, 1.0, sx, 1.15, sz, oliveMat, true);
      this._addBox(3.2, 0.08, 0.12, sx, 2.36, sz - 0.52, cyanGlow, false);
      this._registerStation('operator', 'operator', 'ACTIVE DUTY LOCKERS', 'Operators, dogtags & streaks', sx, 1.0, sz - 1.5, 0x4fc3f7, 3.8);
    }

    // 9. COMMS // SQUAD TERMINAL (South Center: 0, 12.2)
    {
      const sx = 0, sz = 12.2;
      this._addBox(3.0, 1.0, 1.1, sx, 0.5, sz, darkSteel, true);
      this._addBox(1.8, 0.9, 0.14, sx, 1.55, sz, gunmetal, false);
      this._addBox(1.6, 0.7, 0.06, sx, 1.55, sz - 0.08, new THREE.MeshBasicMaterial({ color: 0x102820 }), false);
      this._addBox(1.5, 0.08, 0.08, sx, 1.88, sz - 0.10, greenGlow, false);
      this._registerStation('comms', 'home', 'COMMS // SQUAD HUB', 'Party invites, friends & lobby menu', sx, 1.0, sz - 1.5, 0x69f0ae, 3.8);
    }

    // 10. SYSTEM CONSOLE // SETTINGS (South-East: 8.6, 12.2)
    {
      const sx = 8.6, sz = 12.2;
      this._addBox(2.4, 1.0, 1.1, sx, 0.5, sz, darkSteel, true);
      this._addBox(1.5, 0.85, 0.12, sx, 1.52, sz, gunmetal, false);
      this._addBox(1.3, 0.65, 0.06, sx, 1.52, sz - 0.08, new THREE.MeshBasicMaterial({ color: 0x122230 }), false);
      this._addBox(1.2, 0.07, 0.08, sx, 1.82, sz - 0.10, cyanGlow, false);
      this._registerStation('settings', 'settings', 'SYSTEM CONSOLE', 'PS2 graphics, audio & controls', sx, 1.0, sz - 1.5, 0x90caf9, 3.8);
    }
  }

  _buildAmbientProps() {
    const crateMat = new THREE.MeshLambertMaterial({ color: 0x3b4435 });
    const darkCrate = new THREE.MeshLambertMaterial({ color: 0x252b30 });
    this._addBox(1.2, 0.78, 1.2, -13.2, 0.39, -11.5, crateMat, true);
    this._addBox(0.88, 0.58, 0.88, -13.2, 1.06, -11.5, darkCrate, false);
    this._addBox(1.3, 0.82, 1.1, 13.2, 0.41, -11.4, crateMat, true);
    this._addBox(1.1, 0.72, 1.3, 13.4, 0.36, 9.6, darkCrate, true);
    this._addBox(1.1, 0.72, 1.1, -13.4, 0.36, 9.6, crateMat, true);
  }

  getPartySpawnSlot(slotIdx = 0) {
    const slots = [
      { x: 0.0, z: 3.2, yaw: 0.0 },
      { x: -2.2, z: 2.3, yaw: -0.25 },
      { x: 2.2, z: 2.3, yaw: 0.25 }
    ];
    return slots[Math.max(0, Math.min(slots.length - 1, slotIdx | 0))];
  }

  joinHostFob(hostName, slotIdx = 1) {
    this.fobHostName = hostName || null;
    this.isHostFob = false;
    const slot = this.getPartySpawnSlot(slotIdx);
    this.pos.set(slot.x, 1.68, slot.z);
    this.yaw = slot.yaw;
    this.pitch = -0.04;
    this.velY = 0;
    this.onGround = true;
  }

  syncPartyRoster(partyMembers = [], hostName = null, isHost = true, selfClientId = null) {
    this._lastPartySync = {
      partyMembers: Array.isArray(partyMembers) ? partyMembers.slice() : [],
      hostName,
      isHost,
      selfClientId
    };
    this.fobHostName = hostName || null;
    this.isHostFob = !!isHost;
    const members = Array.isArray(partyMembers) ? partyMembers.slice(0, 3) : [];
    const count = Math.max(1, members.length);

    const banner = document.getElementById('fob-host-banner');
    if (banner) {
      if (count <= 1) {
        banner.textContent = 'YOUR FOB (1/3)';
        banner.style.color = '#69f0ae';
        banner.style.borderColor = 'rgba(105,240,174,0.45)';
      } else if (isHost) {
        banner.textContent = `YOUR FOB // SQUAD (${count}/3)`;
        banner.style.color = '#69f0ae';
        banner.style.borderColor = 'rgba(105,240,174,0.65)';
      } else {
        banner.textContent = `${(hostName || 'HOST').toUpperCase()}'S FOB // SQUAD (${count}/3)`;
        banner.style.color = '#ffca28';
        banner.style.borderColor = 'rgba(255,202,40,0.65)';
      }
    }

    const activeIds = new Set();
    members.forEach((m, idx) => {
      if (!m || !m.clientId || m.isSelf || m.clientId === selfClientId) return;
      activeIds.add(m.clientId);
      const existing = this.remoteAvatars.get(m.clientId);
      const slot = this.getPartySpawnSlot(idx);
      const status = m.ready ? 'READY' : (existing && existing.status ? existing.status : '');
      if (!existing) {
        this.upsertRemoteAvatar(m.clientId, m.name || 'SQUAD', slot.x, 1.68, slot.z, slot.yaw, {
          squadColor: m.squadColor || '#69f0ae',
          isLeader: !!m.isLeader,
          status,
          inParty: true
        });
      } else {
        existing.inParty = true;
        existing.lastSeen = performance.now();
        const nextLabel = `${m.isLeader ? '★ ' : ''}${m.name || existing.callsign}${status ? ' · ' + status : ''}`;
        if (existing.labelText !== nextLabel || existing.squadColor !== (m.squadColor || '#69f0ae')) {
          existing.callsign = m.name || existing.callsign;
          existing.squadColor = m.squadColor || '#69f0ae';
          existing.isLeader = !!m.isLeader;
          existing.status = status;
          existing.labelText = nextLabel;
          this._updateNameTagSprite(existing.tagSprite, nextLabel, existing.squadColor);
        }
      }
    });

    this._partyMemberIds = activeIds;
    // Immediately remove avatars who left the party
    for (const [id, av] of this.remoteAvatars.entries()) {
      if (!activeIds.has(id)) {
        if (av.group) this.scene.remove(av.group);
        this.remoteAvatars.delete(id);
      }
    }
  }

  _drawNameTagCanvas(c, label, accentColor = '#69f0ae') {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(10, 14, 18, 0.86)';
    ctx.fillRect(4, 6, c.width - 8, c.height - 12);
    ctx.strokeStyle = accentColor || '#69f0ae';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(4, 6, c.width - 8, c.height - 12);
    ctx.fillStyle = '#f2f7f4';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label || 'SQUAD').slice(0, 24), c.width / 2, c.height / 2 + 1);
  }

  _makeNameTagSprite(label, accentColor = '#69f0ae') {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 48;
    this._drawNameTagCanvas(c, label, accentColor);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(1.85, 0.30, 1);
    sp.userData._canvas = c;
    sp.userData._tex = tex;
    return sp;
  }

  _updateNameTagSprite(sp, label, accentColor = '#69f0ae') {
    if (!sp || !sp.userData || !sp.userData._canvas || !sp.userData._tex) return;
    this._drawNameTagCanvas(sp.userData._canvas, label, accentColor);
    sp.userData._tex.needsUpdate = true;
  }

  upsertRemoteAvatar(clientId, callsign, x, y, z, yaw = 0, opts = {}) {
    if (!clientId) return;
    const squadColor = opts.squadColor || '#69f0ae';
    const isLeader = !!opts.isLeader;
    const status = opts.status || '';
    const labelText = `${isLeader ? '★ ' : ''}${callsign || 'SQUAD'}${status ? ' · ' + status : ''}`;
    let av = this.remoteAvatars.get(clientId);
    if (!av) {
      const grp = new THREE.Group();
      let rig = null;
      let anim = null;
      if (window.MW2Rig && window.MW2Rig.buildCharacterRig) {
        rig = window.MW2Rig.buildCharacterRig({ archetype: 'operator', faceForwardZ: false, bagId: 'bag_medium' });
        if (rig && rig.weaponMount) {
          const rifle = new THREE.Mesh(
            new THREE.BoxGeometry(0.07, 0.09, 0.62),
            new THREE.MeshLambertMaterial({ color: 0x1a1c1e })
          );
          rifle.position.set(0, 0.01, -0.16);
          rig.weaponMount.add(rifle);
        }
        grp.add(rig.root);
        if (window.MW2Animator) {
          anim = new window.MW2Animator(rig);
          anim.update(0.016, { speed: 0, stance: 'stand', aimPitch: 0 });
        }
      } else {
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3b4836 });
        const vestMat = new THREE.MeshLambertMaterial({ color: 0x222624 });
        const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2a2f2b });
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xc99c7a });
        const helmMat = new THREE.MeshLambertMaterial({ color: 0x2d332c });
        const visorMat = new THREE.MeshLambertMaterial({ color: 0x162229 });
        const patchMat = new THREE.MeshBasicMaterial({ color: squadColor });
        const gunMat = new THREE.MeshLambertMaterial({ color: 0x1b1e22 });

        const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.82, 0.22), pantsMat);
        legL.position.set(-0.12, 0.41, 0);
        const legR = legL.clone();
        legR.position.x = 0.12;
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.28), bodyMat);
        torso.position.y = 1.12;
        const vest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.46, 0.32), vestMat);
        vest.position.y = 1.14;
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.16), bodyMat);
        armL.position.set(-0.32, 1.08, 0.04);
        const armR = armL.clone();
        armR.position.x = 0.32;
        const patchL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.18), patchMat);
        patchL.position.set(-0.32, 1.32, 0.02);
        const patchR = patchL.clone();
        patchR.position.x = 0.32;
        const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.09, 0.06), gunMat);
        rifle.position.set(0.02, 1.05, -0.20);
        rifle.rotation.z = -0.35;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.25, 0.24), skinMat);
        head.position.y = 1.56;
        const helm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.15, 0.28), helmMat);
        helm.position.y = 1.66;
        const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.06), visorMat);
        goggles.position.set(0, 1.59, -0.12);
        grp.add(legL, legR, torso, vest, armL, armR, patchL, patchR, rifle, head, helm, goggles);
      }

      const tag = this._makeNameTagSprite(labelText, squadColor);
      tag.position.set(0, 2.12, 0);
      grp.add(tag);
      grp.position.set(x || 0, 0, z || 0);
      grp.rotation.y = yaw || 0;
      this.scene.add(grp);
      av = {
        group: grp,
        rig,
        anim,
        speed: 0,
        tagSprite: tag,
        callsign: callsign || 'SQUAD',
        squadColor,
        isLeader,
        status,
        labelText,
        inParty: opts.inParty !== false,
        targetPos: new THREE.Vector3(x || 0, 0, z || 0),
        targetYaw: yaw || 0,
        lastSeen: performance.now()
      };
      this.remoteAvatars.set(clientId, av);
    } else {
      av.targetPos.set(x || 0, 0, z || 0);
      av.targetYaw = yaw || 0;
      av.lastSeen = performance.now();
      if (opts.inParty !== undefined) av.inParty = !!opts.inParty;
      if (av.labelText !== labelText || av.squadColor !== squadColor) {
        av.callsign = callsign || av.callsign;
        av.squadColor = squadColor;
        av.isLeader = isLeader;
        av.status = status;
        av.labelText = labelText;
        this._updateNameTagSprite(av.tagSprite, labelText, squadColor);
      }
    }
  }

  pruneRemoteAvatars(maxAgeMs = 12000) {
    const now = performance.now();
    for (const [id, av] of this.remoteAvatars.entries()) {
      // Never prune active party members while they are in the party (e.g. browsing menus)
      if (this._partyMemberIds && this._partyMemberIds.has(id)) continue;
      if (now - av.lastSeen > maxAgeMs) {
        if (av.group) this.scene.remove(av.group);
        this.remoteAvatars.delete(id);
      }
    }
  }

  rebuildAvatars() {
    for (const av of this.remoteAvatars.values()) {
      if (av && av.rig && av.rig.skin && av.rig.skin.disable) {
        try { av.rig.skin.disable(); } catch (e) {}
      }
      if (av && av.group) this.scene.remove(av.group);
    }
    this.remoteAvatars.clear();
    if (this._lastPartySync) {
      const s = this._lastPartySync;
      this.syncPartyRoster(s.partyMembers, s.hostName, s.isHost, s.selfClientId);
    }
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
    nextPos.x = THREE.MathUtils.clamp(nextPos.x, -16.0, 16.0);
    nextPos.z = THREE.MathUtils.clamp(nextPos.z, -24.5, 13.0);
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

    // Spin Exfil Helicopter idle rotors
    if (this.heloMainRotor) this.heloMainRotor.rotation.y += dt * 4.2;
    if (this.heloTailRotor) this.heloTailRotor.rotation.x += dt * 11.0;

    // Interpolate live party avatars inside FOB & drive Soldier locomotion/IK
    const safeDt = Math.max(dt, 0.001);
    for (const av of this.remoteAvatars.values()) {
      const prevX = av.group.position.x;
      const prevZ = av.group.position.z;
      av.group.position.lerp(av.targetPos, Math.min(1, dt * 10));
      av.group.rotation.y = av.targetYaw;
      if (av.anim) {
        const instVx = (av.group.position.x - prevX) / safeDt;
        const instVz = (av.group.position.z - prevZ) / safeDt;
        const instSpd = Math.hypot(instVx, instVz);
        av.speed = THREE.MathUtils.lerp(av.speed || 0, instSpd, Math.min(1, dt * 10));
        const avYaw = av.targetYaw || 0;
        const avCos = Math.cos(avYaw);
        const avSin = Math.sin(avYaw);
        av.anim.update(dt, {
          speed: av.speed,
          velLocalX: instSpd > 0.18 ? (instVx * avCos - instVz * avSin) : 0,
          velLocalZ: instSpd > 0.18 ? (instVx * avSin + instVz * avCos) : 0,
          stance: 'stand',
          isSprinting: av.speed >= 5.4,
          isTacSprinting: av.speed >= 7.45,
          aimPitch: 0,
          worldPos: av.group.position,
          worldYaw: avYaw,
          feetY: av.group.position.y
        });
      }
    }
    this.pruneRemoteAvatars(4500);

    // Pulse station floor rings gently
    for (const st of this.stations) {
      const isHov = this.hoveredStation === st;
      st.ringMat.opacity = isHov ? 0.90 : (0.30 + 0.14 * Math.sin(this.idleOrbitTime * 2.6 + st.pos.x));
      st.ring.scale.setScalar(isHov ? 1.12 : 1.0);
    }

    if (this.activeRoam) {
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
      const speed = this.isCrouching ? 2.6 : (isSprinting ? 6.6 : 4.2);
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
            try { window.soundEngine.playFootstep(speed > 5, 'concrete'); } catch (e) {}
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

      const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
      let best = null;
      let bestScore = Infinity;
      for (const st of this.stations) {
        const d = Math.hypot(this.pos.x - st.pos.x, this.pos.z - st.pos.z);
        if (d <= st.radius) {
          const toSt = st.labelPos.clone().sub(this.camera.position).normalize();
          const dot = toSt.dot(lookDir);
          if (dot > 0.35 || d < 2.0) {
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
      // Wide cinematic FOB hangar overview looking toward Armory & North Exfil Helipad
      const swayX = Math.sin(this.idleOrbitTime * 0.20) * 1.4;
      const swayZ = Math.cos(this.idleOrbitTime * 0.15) * 0.7;
      this.camera.position.set(this.pos.x + swayX, 2.85, Math.min(10.5, this.pos.z + 3.4 + swayZ));
      this.camera.lookAt(0, 1.65, -10.5);
      this.hoveredStation = null;
    }

    if (window.RigRegistry && window.RigRegistry.syncAll) {
      window.RigRegistry.syncAll(dt, this.camera);
    }

    if (window.renderPipeline) {
      window.renderPipeline.begin();
      window.renderPipeline.render(this.scene, this.camera, false);
      window.renderPipeline.end();
    } else {
      renderer.autoClear = true;
      renderer.render(this.scene, this.camera);
    }
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
