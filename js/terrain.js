// ============================================================================
// ASHFALL // Deterministic Geomorphological DEM & Chunked 512x512 Terrain Geo
// Engine + 4-Biome Triplanar 720p PBR Shader & Engineered Urban Terracing
// ============================================================================
window.VostokTerrainEngine = (() => {
  const TERRAIN_SIZE = 2100;
  const TERRAIN_SEGS = 512;
  const CHUNK_GRID = 4; // 4x4 = 16 seamless frustum-culled 128x128 terrain geo chunks

  // Oriented-Box / Polygon SDF Urban Terraces (eliminates blobby circular terrain mounds!)
  const URBAN_TERRACES = [
    { id: 'vostok_city_east', cx: 296, cz: -338, hx: 106, hz: 98, rot: 0, h: 6.8, blend: 18 },
    { id: 'vostok_city_west', cx: 96,  cz: -318, hx: 50,  hz: 82, rot: 0, h: 6.6, blend: 16 }
  ];

  function createRNG(seed) {
    let a = (seed >>> 0) || 133742;
    return () => {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function _buildPerm(seed) {
    const p = new Uint8Array(512);
    const base = new Uint8Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;
    const rng = createRNG(seed || 133742);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = base[i];
      base[i] = base[j];
      base[j] = t;
    }
    for (let i = 0; i < 512; i++) p[i] = base[i & 255];
    return p;
  }

  function _noise2(x, z, perm) {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = zf * zf * zf * (zf * (zf * 6 - 15) + 10);
    const X = xi & 255;
    const Z = zi & 255;
    const grad = (h, dx, dz) => {
      switch (h & 7) {
        case 0: return dx + dz;
        case 1: return -dx + dz;
        case 2: return dx - dz;
        case 3: return -dx - dz;
        case 4: return dx * 1.414;
        case 5: return -dx * 1.414;
        case 6: return dz * 1.414;
        default: return -dz * 1.414;
      }
    };
    const aa = perm[(perm[X] + Z) & 255];
    const ba = perm[(perm[(X + 1) & 255] + Z) & 255];
    const ab = perm[(perm[X] + ((Z + 1) & 255)) & 255];
    const bb = perm[(perm[(X + 1) & 255] + ((Z + 1) & 255)) & 255];
    const ix0 = grad(aa, xf, zf) + u * (grad(ba, xf - 1, zf) - grad(aa, xf, zf));
    const ix1 = grad(ab, xf, zf - 1) + u * (grad(bb, xf - 1, zf - 1) - grad(ab, xf, zf - 1));
    return ix0 + v * (ix1 - ix0); // approx [-1..1]
  }

  function _fbm(x, z, octaves, perm) {
    let val = 0, amp = 0.5, freq = 1.0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      val += amp * _noise2(x * freq, z * freq, perm);
      norm += amp;
      freq *= 2.03;
      amp *= 0.5;
    }
    return val / (norm || 1);
  }

  function _ridgedFBM(x, z, octaves, perm) {
    let sum = 0, amp = 0.5, freq = 1.0, weight = 1.0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      let n = 1.0 - Math.abs(_noise2(x * freq, z * freq, perm));
      n = n * n * weight;
      weight = Math.max(0.15, Math.min(1.0, n * 1.65));
      sum += n * amp;
      norm += amp;
      freq *= 2.11;
      amp *= 0.5;
    }
    return sum / (norm || 1);
  }

  function _boxSDF(x, z, cx, cz, hx, hz, rot = 0) {
    let dx = x - cx;
    let dz = z - cz;
    if (rot) {
      const c = Math.cos(-rot);
      const s = Math.sin(-rot);
      const rx = dx * c - dz * s;
      const rz = dx * s + dz * c;
      dx = rx;
      dz = rz;
    }
    const qx = Math.abs(dx) - hx;
    const qz = Math.abs(dz) - hz;
    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
  }

  function _buildRoadGrid(roads, cellSize = 32) {
    const grid = new Map();
    if (!roads || roads.length === 0) return { grid, cellSize };
    for (let i = 0; i < roads.length; i++) {
      const r = roads[i];
      const hw = ((r[4] || 9) * 0.5) + 12.0;
      const minX = Math.min(r[0], r[2]) - hw;
      const maxX = Math.max(r[0], r[2]) + hw;
      const minZ = Math.min(r[1], r[3]) - hw;
      const maxZ = Math.max(r[1], r[3]) + hw;
      const cx0 = Math.floor(minX / cellSize);
      const cx1 = Math.floor(maxX / cellSize);
      const cz0 = Math.floor(minZ / cellSize);
      const cz1 = Math.floor(maxZ / cellSize);
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cz = cz0; cz <= cz1; cz++) {
          const k = (cx << 16) ^ cz;
          let arr = grid.get(k);
          if (!arr) {
            arr = [];
            grid.set(k, arr);
          }
          arr.push(r);
        }
      }
    }
    return { grid, cellSize };
  }

  function createContext(world, seed = 133742) {
    return {
      seed,
      perm: _buildPerm(seed),
      roadGrid: _buildRoadGrid(world.ROADS || [], 32)
    };
  }

  function _rawLandHeight(x, z, perm) {
    const northLift = Math.max(0, (-z + 260) / 820) * 11.4;
    const southTaper = z > 180 ? Math.min(1, (z - 180) / 270) : 0;
    const warpX = _fbm(x * 0.0022, z * 0.0022, 2, perm) * 38.0;
    const warpZ = _fbm(x * 0.0022 + 19.3, z * 0.0022 - 11.7, 2, perm) * 38.0;
    const macro = _fbm((x + warpX) * 0.0034, (z + warpZ) * 0.0034, 4, perm) * 7.8 * (1 - southTaper * 0.72);
    const valley = _ridgedFBM(x * 0.0052 + 7.1, z * 0.0052 - 4.3, 3, perm) * 3.1 * (1 - southTaper * 0.78);
    const micro = _fbm(x * 0.019, z * 0.019, 2, perm) * 0.75 * (1 - southTaper * 0.6);
    let baseH = Math.max(1.85, (2.6 + northLift + macro + valley + micro) * (1 - southTaper * 0.50) + southTaper * 1.42);

    // Sculpted Ridged-Multifractal Alpine Peaks (NW Massif, Quarry Crag, Dam Shoulders)
    const addMountainPeak = (px, pz, rx, rz, peakH) => {
      const u = Math.hypot((x - px) / rx, (z - pz) / rz);
      if (u >= 1.0) return 0;
      const k = 1 - u * u;
      const ridge = 0.58 + 0.42 * _ridgedFBM(x * 0.011 + px * 0.01, z * 0.011 + pz * 0.01, 4, perm);
      return peakH * k * k * ridge;
    };
    baseH += addMountainPeak(-525, -525, 240, 215, 45.0);
    baseH += addMountainPeak(-380, -535, 200, 160, 36.5);
    baseH += addMountainPeak(-225, -505, 160, 135, 29.5);
    baseH += addMountainPeak(  95, -455, 122, 104, 24.0);
    baseH += addMountainPeak(-595, -355, 150, 190, 31.5);
    return baseH;
  }

  function evalAnalyticalHeight(world, x, z, ctx = null) {
    if (!ctx) {
      if (!world._terrainCtx) world._terrainCtx = createContext(world, world._matchSeed || 133742);
      ctx = world._terrainCtx;
    }
    const perm = ctx.perm;
    const baseH = _rawLandHeight(x, z, perm);

    // 1. Hydrology carving (River A + dredged River B urban canal + Reservoir + Dam + Quarry + Ocean Shelf)
    const carveBranch = (proj, wY, urbanCanal = false) => {
      const bankW = urbanCanal ? 10.5 : 26.0;
      if (proj.margin >= bankW) return baseH;
      if (proj.margin <= 0) {
        const frac = proj.dist / Math.max(1, proj.halfW);
        const maxDepth = urbanCanal
          ? 1.72
          : (1.42 + Math.min(0.80, Math.max(0, proj.halfW - 26) * 0.016));
        return wY - (maxDepth - (maxDepth - 0.52) * frac * frac);
      }
      const u = Math.max(0, Math.min(1, proj.margin / bankW));
      const prof = u * u * (3 - 2 * u);
      const rimBase = Math.max(wY + 0.65, baseH);
      return (wY - 0.52) * (1 - prof) + rimBase * prof;
    };

    const rA = world._projectOntoRiver(x, z, world._riverA);
    const rB = world._projectOntoRiver(x, z, world._riverB);
    const inUrbanCanal = (z >= -445 && z <= -232 && x >= 115 && x <= 215);
    const hA = carveBranch(rA, world._riverWaterYA(rA.s), false);
    const hB = carveBranch(rB, world._riverWaterYB(rB.s), inUrbanCanal);
    let h = Math.min(hA, hB);

    const res = world.UPPER_RESERVOIR;
    if (res) {
      const ru = Math.hypot((x - res.cx) / res.rx, (z - res.cz) / res.rz);
      if (ru < 1.35 && z < -455) {
        const rk = Math.max(0, Math.min(1, (ru - 0.85) / 0.50));
        const rBlend = rk * rk * (3 - 2 * rk);
        const bedY = res.waterY - 2.2 * (1 - Math.min(1, ru) * 0.55);
        h = bedY * (1 - rBlend) + h * rBlend;
      }
    }

    const db = world.DAM_BOUNDS;
    if (db && x >= db.minX - 24 && x <= db.maxX + 24 && z >= db.minZ - 14 && z <= db.maxZ + 8) {
      let lx = 1.0;
      if (x < db.minX) lx = Math.max(0, (x - (db.minX - 24)) / 24);
      else if (x > db.maxX) lx = Math.max(0, ((db.maxX + 24) - x) / 24);
      let lz = 1.0;
      if (z < db.minZ) lz = Math.max(0, (z - (db.minZ - 14)) / 14);
      else if (z > db.maxZ - 2) lz = Math.max(0, ((db.maxZ + 6) - z) / 8);
      const wDam = (lx * lx * (3 - 2 * lx)) * (lz * lz * (3 - 2 * lz));
      if (wDam > 0.001) {
        let damTargetH;
        if (z <= -402) damTargetH = 17.8;
        else if (z <= -354) {
          const u = (z - (-402)) / 48;
          damTargetH = 17.8 + (3.2 - 17.8) * (u * u * (3 - 2 * u));
        } else damTargetH = 3.2;
        h = h * (1 - wDam) + damTargetH * wDam;
      }
    }

    const qr = Math.hypot(x + 400, z + 395);
    if (qr < 54) {
      const qa = Math.atan2(z + 395, x + 400);
      const qSmooth = (t) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };
      let angDiff = Math.abs(qa - 0.55);
      if (angDiff > Math.PI) angDiff = Math.PI * 2 - angDiff;
      let qTarget = 10.5;
      if (qr > 44) {
        const bOut = qSmooth((qr - 44) / 10);
        qTarget = 10.5 * (1 - bOut) + h * bOut;
      } else if (angDiff < 0.42 && qr >= 15 && qr <= 44) {
        const slopeT = (qr - 15) / (44 - 15);
        const rampH = 2.8 + (10.5 - 2.8) * slopeT;
        let benchH = 10.5;
        if (qr <= 17.5) benchH = 2.8;
        else if (qr <= 21) benchH = 2.8 + (6.6 - 2.8) * qSmooth((qr - 17.5) / 3.5);
        else if (qr <= 31) benchH = 6.6;
        else if (qr <= 34.5) benchH = 6.6 + (10.5 - 6.6) * qSmooth((qr - 31) / 3.5);
        const blendAng = 1 - qSmooth(Math.max(0, (angDiff - 0.22) / 0.20));
        qTarget = benchH * (1 - blendAng) + rampH * blendAng;
      } else if (qr <= 17.5) qTarget = 2.8;
      else if (qr <= 21) qTarget = 2.8 + (6.6 - 2.8) * qSmooth((qr - 17.5) / 3.5);
      else if (qr <= 31) qTarget = 6.6;
      else if (qr <= 34.5) qTarget = 6.6 + (10.5 - 6.6) * qSmooth((qr - 31) / 3.5);
      else qTarget = 10.5;
      h = qTarget;
    }

    const oDist = world._oceanDist(x, z);
    if (oDist > -72) {
      if (oDist <= 0) {
        const bt = (oDist + 72) / 72;
        const bSmooth = bt * bt * (3 - 2 * bt);
        const beachH = h * (1 - bSmooth) + (world.OCEAN_WATER_Y + 0.12) * bSmooth;
        h = Math.min(h, beachH);
      } else {
        const seaDepth = Math.min(3.6, 0.22 + oDist * 0.042);
        h = Math.min(h, world.OCEAN_WATER_Y - seaDepth);
      }
    }

    // 2. Oriented-Box SDF Urban District Earthworks (Al-Mazrah Vostok City East & West terraces)
    let urbanMask = 0;
    for (let i = 0; i < URBAN_TERRACES.length; i++) {
      const ut = URBAN_TERRACES[i];
      const sd = _boxSDF(x, z, ut.cx, ut.cz, ut.hx, ut.hz, ut.rot);
      if (sd < ut.blend) {
        if (sd <= 0) {
          h = ut.h;
          urbanMask = 1;
          break;
        }
        const t = sd / ut.blend;
        const k = 1 - (t * t * (3 - 2 * t));
        h = h * (1 - k) + ut.h * k;
        urbanMask = Math.max(urbanMask, k);
      }
    }

    // 3. Smooth POI pads (compounds, bunkers, dam abutments, outer POIs)
    if (world._poiPads && urbanMask < 0.999) {
      for (let i = 0; i < world._poiPads.length; i++) {
        const pad = world._poiPads[i];
        const dist = Math.hypot(x - pad.x, z - pad.z);
        const outer = pad.r + 22;
        if (dist < outer) {
          if (dist <= pad.r) {
            h = pad.h;
            break;
          }
          const t = (dist - pad.r) / (outer - pad.r);
          const blend = t * t * (3 - 2 * t);
          h = pad.h * (1 - blend) + h * blend;
        }
      }
    }

    // 4. Engineered Highway Roadbed Cut-and-Fill outside flat urban terraces & river bridges
    const rMargin = Math.min(rA.margin, rB.margin);
    if (urbanMask < 0.65 && rMargin >= 15.0 && ctx.roadGrid) {
      const rg = ctx.roadGrid;
      const rcx = Math.floor(x / rg.cellSize);
      const rcz = Math.floor(z / rg.cellSize);
      const list = rg.grid.get((rcx << 16) ^ rcz);
      if (list && list.length > 0) {
        let bestD = 999;
        let bestHalfW = 5;
        let bestTargetY = h;
        for (let i = 0; i < list.length; i++) {
          const r = list[i];
          const ax = r[0], az = r[1], bx = r[2], bz = r[3], rw = r[4] || 9;
          const dx = bx - ax, dz = bz - az;
          const lSq = dx * dx + dz * dz || 1;
          let t = ((x - ax) * dx + (z - az) * dz) / lSq;
          if (t < 0) t = 0;
          else if (t > 1) t = 1;
          const px = ax + dx * t, pz = az + dz * t;
          const d = Math.hypot(x - px, z - pz);
          const roadHW = rw * 0.5 + 1.8;
          if (d < roadHW + 8.5 && d < bestD) {
            bestD = d;
            bestHalfW = roadHW;
            const cH = _rawLandHeight(px, pz, perm);
            bestTargetY = Math.max(cH, 2.2);
          }
        }
        if (bestD < bestHalfW + 8.5) {
          const u = bestD <= bestHalfW ? 0 : (bestD - bestHalfW) / 8.5;
          const k = (1 - (u * u * (3 - 2 * u))) * 0.55;
          h = h * (1 - k) + bestTargetY * k;
        }
      }
    }

    // 5. Strict River-Channel Protection (never allow terraces/pads to fill in RIVER_A or RIVER_B)
    const riverCarvedH = Math.min(hA, hB);
    const guardSpan = inUrbanCanal ? 7.2 : 9.0;
    if (rMargin < guardSpan) {
      if (rMargin <= 0.4) {
        h = Math.min(h, riverCarvedH);
      } else {
        const rt = (rMargin - 0.4) / (guardSpan - 0.4);
        const rSmooth = rt * rt * (3 - 2 * rt);
        h = Math.min(h, riverCarvedH * (1 - rSmooth) + h * rSmooth);
      }
    }
    return h;
  }

  function createTerrainMaterial() {
    const P = window.AshfallPBR;
    if (!P) return null;
    const turfMat = P.getMaterial('taiga_moss_turf', {
      vertexColors: true,
      roughness: 0.90,
      metalness: 0.0,
      normalScale: 0.95,
      envMapIntensity: 0.52,
      tile: 4.0
    });
    const m = turfMat.clone();
    const rockMaps = P.getMaps('rock_alpine_granite');
    const sandMaps = P.getMaps('asphalt_cracked');
    const concreteMaps = P.getMaps('terracotta_plaza_paver');

    m.onBeforeCompile = (shader) => {
      shader.uniforms.uRockMap = { value: rockMaps ? rockMaps.map : null };
      shader.uniforms.uSandMap = { value: sandMaps ? sandMaps.map : null };
      shader.uniforms.uCityMap = { value: concreteMaps ? concreteMaps.map : null };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute vec4 aBiome;
          varying vec4 vBiome;
          varying vec3 vWorldPos;
          varying vec3 vWorldNorm;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vBiome = aBiome;
          vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWorldNorm = normalize(mat3(modelMatrix) * objectNormal);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D uRockMap;
          uniform sampler2D uSandMap;
          uniform sampler2D uCityMap;
          varying vec4 vBiome;
          varying vec3 vWorldPos;
          varying vec3 vWorldNorm;`
        )
        .replace(
          '#include <map_fragment>',
          `
          vec2 wUv = vWorldPos.xz * 0.095;
          vec3 triW = abs(normalize(vWorldNorm));
          triW = pow(triW, vec3(3.0));
          triW /= max(0.001, triW.x + triW.y + triW.z);

          vec3 turfSample = texture2D(map, wUv * 1.4).rgb;
          vec3 rockXZ = texture2D(uRockMap, vWorldPos.xz * 0.08).rgb;
          vec3 rockXY = texture2D(uRockMap, vWorldPos.xy * 0.08).rgb;
          vec3 rockZY = texture2D(uRockMap, vWorldPos.zy * 0.08).rgb;
          vec3 rockSample = rockXZ * triW.y + rockXY * triW.z + rockZY * triW.x;
          vec3 sandSample = texture2D(uSandMap, wUv * 1.1).rgb * vec3(1.12, 1.04, 0.86);
          vec3 citySample = texture2D(uCityMap, vWorldPos.xz * 0.14).rgb;

          vec4 bw = max(vec4(0.0), vBiome);
          float bSum = max(0.001, bw.r + bw.g + bw.b + bw.a);
          bw /= bSum;
          vec3 biomeAlbedo = turfSample * bw.r + rockSample * bw.g + sandSample * bw.b + citySample * bw.a;
          diffuseColor.rgb *= mix(vec3(1.0), biomeAlbedo * 1.28, 0.78);
          `
        );
    };
    m.customProgramCacheKey = () => 'vostok_triplanar_terrain_v1';
    return m;
  }

  function buildTerrainGeo(world, seed = 133742) {
    const ctx = createContext(world, seed);
    world._terrainCtx = ctx;
    const size = TERRAIN_SIZE;
    const segs = TERRAIN_SEGS;
    const rows = segs + 1;
    const count = rows * rows;
    const step = size / segs;
    const half = size * 0.5;

    const heights = new Float32Array(count);
    for (let iz = 0; iz < rows; iz++) {
      const vz = -half + iz * step;
      const rOff = iz * rows;
      for (let ix = 0; ix < rows; ix++) {
        const vx = -half + ix * step;
        heights[rOff + ix] = evalAnalyticalHeight(world, vx, vz, ctx);
      }
    }

    const colLow = new THREE.Color(0x525d46);
    const colMid = new THREE.Color(0x5f684c);
    const colHigh = new THREE.Color(0x6d705c);
    const colSlope = new THREE.Color(0x5d6266);
    const colSnow = new THREE.Color(0xdde6ec);
    const colSand = new THREE.Color(0xc4b588);
    const colWet = new THREE.Color(0x585440);
    const colShallow = new THREE.Color(0x3f585c);
    const colDeep = new THREE.Color(0x223844);
    const colUrban = new THREE.Color(0x6e716b);
    const tmpCol = new THREE.Color();

    const normals = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const biomes = new Float32Array(count * 4);

    for (let iz = 0; iz < rows; iz++) {
      const vz = -half + iz * step;
      const im = Math.max(0, iz - 1);
      const ip = Math.min(segs, iz + 1);
      const rOff = iz * rows;
      for (let ix = 0; ix < rows; ix++) {
        const vx = -half + ix * step;
        const idx = rOff + ix;
        const vy = heights[idx];
        const jm = Math.max(0, ix - 1);
        const jp = Math.min(segs, ix + 1);
        const hL = heights[rOff + jm];
        const hR = heights[rOff + jp];
        const hU = heights[im * rows + ix];
        const hD = heights[ip * rows + ix];

        const dX = (hL - hR) / (Math.max(1, jp - jm) * step);
        const dZ = (hU - hD) / (Math.max(1, ip - im) * step);
        let nx = dX, ny = 1.0, nz = dZ;
        const invL = 1.0 / Math.hypot(nx, ny, nz);
        nx *= invL; ny *= invL; nz *= invL;
        normals[idx * 3] = nx;
        normals[idx * 3 + 1] = ny;
        normals[idx * 3 + 2] = nz;

        const slope = Math.hypot(dX, dZ);
        // Quick horizon-cavity AO approximation from surrounding 8m ring height delta
        const avgNbr = (hL + hR + hU + hD) * 0.25;
        const cavityAO = Math.max(0.74, Math.min(1.06, 0.96 - (avgNbr - vy) * 0.08));

        if (vy < 1.5) tmpCol.copy(colLow).lerp(colMid, Math.max(0, Math.min(1, (vy + 2.0) / 3.5)));
        else if (vy < 9.5) tmpCol.copy(colMid).lerp(colHigh, Math.max(0, Math.min(1, (vy - 1.5) / 8.0)));
        else tmpCol.copy(colHigh).lerp(colSlope, Math.max(0, Math.min(0.75, ((vy - 9.5) / 9.0) * 0.75)));

        let bTurf = 1.0, bRock = 0.0, bSand = 0.0, bCity = 0.0;
        if (slope > 0.16) {
          const rockK = Math.max(0, Math.min(1, (slope - 0.16) * 2.6));
          tmpCol.lerp(colSlope, rockK * 0.85);
          bRock = Math.max(bRock, rockK);
          bTurf *= (1 - rockK * 0.85);
        }
        if (vy > 21.5) {
          const snowK = Math.max(0, Math.min(0.94, (vy - 21.5) / 11.5)) * (1 - Math.max(0, Math.min(0.52, (slope - 0.52) * 1.3)));
          tmpCol.lerp(colSnow, snowK);
        }

        const oDist = world._oceanDist(vx, vz);
        if (oDist > -58 && oDist <= 6) {
          const sandK = Math.max(0, Math.min(1, (oDist + 58) / 42));
          tmpCol.lerp(colSand, sandK * 0.86);
          bSand = Math.max(bSand, sandK);
          bTurf *= (1 - sandK * 0.75);
        }

        // Urban city terrace apron tinting (outside river water!)
        const wSurf = world.getWaterSurfaceY(vx, vz);
        if (wSurf === null) {
          for (let ui = 0; ui < URBAN_TERRACES.length; ui++) {
            const ut = URBAN_TERRACES[ui];
            const sd = _boxSDF(vx, vz, ut.cx, ut.cz, ut.hx, ut.hz, ut.rot);
            if (sd < 4.0) {
              const uk = sd <= 0 ? 1.0 : (1.0 - sd / 4.0);
              tmpCol.lerp(colUrban, uk * 0.65);
              bCity = Math.max(bCity, uk);
              bTurf *= (1 - uk);
            }
          }
        } else {
          const subDepth = wSurf - vy;
          if (subDepth > -0.65 && subDepth <= 0.08) {
            tmpCol.lerp(colSand, 0.45);
            tmpCol.lerp(colWet, 0.35);
            bSand = Math.max(bSand, 0.65);
          }
          if (subDepth > 0.02) {
            const dk = Math.max(0, Math.min(1, subDepth / 2.2));
            tmpCol.lerp(colShallow, Math.min(0.85, 0.35 + dk * 0.5));
            if (subDepth > 1.35) tmpCol.lerp(colDeep, Math.min(0.92, (subDepth - 1.35) / 2.4));
            bRock = Math.max(bRock, 0.55);
          }
        }

        colors[idx * 3] = tmpCol.r * cavityAO;
        colors[idx * 3 + 1] = tmpCol.g * cavityAO;
        colors[idx * 3 + 2] = tmpCol.b * cavityAO;
        biomes[idx * 4] = bTurf;
        biomes[idx * 4 + 1] = bRock;
        biomes[idx * 4 + 2] = bSand;
        biomes[idx * 4 + 3] = bCity;
      }
    }

    const mat = createTerrainMaterial() || world._materials.ground;
    const group = new THREE.Group();
    const chunks = [];
    const chunkSegs = segs / CHUNK_GRID; // 128
    const cRows = chunkSegs + 1;         // 129

    for (let cz = 0; cz < CHUNK_GRID; cz++) {
      for (let cx = 0; cx < CHUNK_GRID; cx++) {
        const startX = cx * chunkSegs;
        const startZ = cz * chunkSegs;
        const posArr = new Float32Array(cRows * cRows * 3);
        const normArr = new Float32Array(cRows * cRows * 3);
        const colArr = new Float32Array(cRows * cRows * 3);
        const bioArr = new Float32Array(cRows * cRows * 4);
        const uvArr = new Float32Array(cRows * cRows * 2);
        const idxArr = new Uint16Array(chunkSegs * chunkSegs * 6);

        let pOff = 0, uOff = 0, bOff = 0;
        for (let lz = 0; lz < cRows; lz++) {
          const gz = startZ + lz;
          const vz = -half + gz * step;
          for (let lx = 0; lx < cRows; lx++) {
            const gx = startX + lx;
            const vx = -half + gx * step;
            const gIdx = gz * rows + gx;
            posArr[pOff] = vx;
            posArr[pOff + 1] = heights[gIdx];
            posArr[pOff + 2] = vz;
            normArr[pOff] = normals[gIdx * 3];
            normArr[pOff + 1] = normals[gIdx * 3 + 1];
            normArr[pOff + 2] = normals[gIdx * 3 + 2];
            colArr[pOff] = colors[gIdx * 3];
            colArr[pOff + 1] = colors[gIdx * 3 + 1];
            colArr[pOff + 2] = colors[gIdx * 3 + 2];
            pOff += 3;

            bioArr[bOff] = biomes[gIdx * 4];
            bioArr[bOff + 1] = biomes[gIdx * 4 + 1];
            bioArr[bOff + 2] = biomes[gIdx * 4 + 2];
            bioArr[bOff + 3] = biomes[gIdx * 4 + 3];
            bOff += 4;

            uvArr[uOff] = (gx / segs) * 180;
            uvArr[uOff + 1] = (gz / segs) * 180;
            uOff += 2;
          }
        }

        let ii = 0;
        for (let lz = 0; lz < chunkSegs; lz++) {
          for (let lx = 0; lx < chunkSegs; lx++) {
            const a = lz * cRows + lx;
            const b = a + 1;
            const c = a + cRows;
            const d = c + 1;
            idxArr[ii++] = a; idxArr[ii++] = c; idxArr[ii++] = b;
            idxArr[ii++] = b; idxArr[ii++] = c; idxArr[ii++] = d;
          }
        }

        const cGeo = new THREE.BufferGeometry();
        cGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
        cGeo.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
        cGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
        cGeo.setAttribute('aBiome', new THREE.BufferAttribute(bioArr, 4));
        const uvBuf = new THREE.BufferAttribute(uvArr, 2);
        cGeo.setAttribute('uv', uvBuf);
        cGeo.setAttribute('uv2', uvBuf);
        cGeo.setIndex(new THREE.BufferAttribute(idxArr, 1));
        cGeo.computeBoundingBox();
        cGeo.computeBoundingSphere();

        const cMesh = new THREE.Mesh(cGeo, mat);
        cMesh.receiveShadow = true;
        cMesh.frustumCulled = true;
        cMesh.matrixAutoUpdate = false;
        cMesh.updateMatrix();
        group.add(cMesh);
        chunks.push(cMesh);
      }
    }

    return {
      terrainSize: size,
      terrainSegs: segs,
      heights,
      group,
      chunks,
      material: mat
    };
  }

  return {
    TERRAIN_SIZE,
    TERRAIN_SEGS,
    CHUNK_GRID,
    URBAN_TERRACES,
    createContext,
    evalAnalyticalHeight,
    buildTerrainGeo
  };
})();
