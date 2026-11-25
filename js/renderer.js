// ============================================================================
// ASHFALL // High-Poly WebGL2 HDR PBR Rendering Engine, Shared Surface Bank,
// Instanced Batching, SSAO + HDR Bloom Post-Pipeline & 0-Leak Disposer
// ============================================================================
window.AshfallRenderer = (() => {
  const _geoCache = new Map();
  const _matCache = new Map();

  function _markShared(obj) {
    if (!obj) return obj;
    if (!obj.userData) obj.userData = {};
    obj.userData._ashShared = true;
    return obj;
  }

  // --------------------------------------------------------------------------
  // 1. Canonical Shared Geometry Pool (with uv2 for aoMap & zero allocations)
  // --------------------------------------------------------------------------
  const GeoPool = {
    get(key, factoryFn) {
      if (_geoCache.has(key)) return _geoCache.get(key);
      const geo = factoryFn();
      if (geo && geo.attributes && geo.attributes.uv && !geo.attributes.uv2) {
        geo.setAttribute('uv2', geo.attributes.uv);
      }
      _markShared(geo);
      _geoCache.set(key, geo);
      return geo;
    },
    unitBox() {
      return this.get('unitBox', () => new THREE.BoxGeometry(1, 1, 1));
    },
    unitCylinder(segs = 16) {
      return this.get(`unitCyl_${segs}`, () => new THREE.CylinderGeometry(1, 1, 1, segs));
    },
    unitPlane() {
      return this.get('unitPlane', () => new THREE.PlaneGeometry(1, 1));
    },
    sphere(wSeg = 14, hSeg = 10) {
      return this.get(`sphere_${wSeg}_${hSeg}`, () => new THREE.SphereGeometry(1, wSeg, hSeg));
    },
    ring(innerRatio = 0.72, segs = 28) {
      const k = `ring_${Number(innerRatio).toFixed(3)}_${segs}`;
      return this.get(k, () => new THREE.RingGeometry(innerRatio, 1.0, segs));
    }
  };

  function configureRenderer(renderer) {
    if (!renderer) return;
    if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    if (THREE.ACESFilmicToneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap !== undefined ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.physicallyCorrectLights = false;
  }

  // --------------------------------------------------------------------------
  // 2. Dual HDR PMREM Probes & 720p PBR Surface Bank / World Materials
  // --------------------------------------------------------------------------
  function getEnvMap(renderer, kind = 'outdoor') {
    if (window.AshfallPBR && window.AshfallPBR.getEnvMap) {
      return window.AshfallPBR.getEnvMap(renderer, kind);
    }
    return null;
  }

  function getSurfaceBank() {
    if (window.AshfallPBR && window.AshfallPBR.getMaps) {
      const P = window.AshfallPBR;
      const concrete = P.getMaps('bunker_concrete_formwork');
      const plaster = P.getMaps('plaster_aged_white');
      const brick = P.getMaps('brick_soviet_weathered');
      const siding = P.getMaps('steel_rusted_corrugated');
      const floorTile = P.getMaps('tile_subway_dirty');
      const wood = P.getMaps('wood_planks_weathered');
      const roofTar = P.getMaps('roof_bitumen_tar');
      const asphalt = P.getMaps('asphalt_cracked');
      const metal = P.getMaps('steel_dark_structural');
      const grate = P.getMaps('steel_diamond_grate');
      const crate = P.getMaps('crate_supply');
      const terrain = P.getMaps('terrain_detail');
      if (terrain && terrain.map) terrain.map.repeat.set(160, 160);
      if (terrain && terrain.normalMap) terrain.normalMap.repeat.set(160, 160);
      if (terrain && terrain.roughnessMap) terrain.roughnessMap.repeat.set(160, 160);
      return {
        ground: terrain.map,
        groundNormal: terrain.normalMap,
        groundRoughness: terrain.roughnessMap,
        concrete: concrete.map,
        concreteBump: concrete.normalMap,
        plaster: plaster.map,
        brick: brick.map,
        brickBump: brick.normalMap,
        siding: siding.map,
        sidingBump: siding.normalMap,
        floorTile: floorTile.map,
        floorTileBump: floorTile.normalMap,
        wood: wood.map,
        roofTar: roofTar.map,
        asphalt: asphalt.map,
        metal: metal.map,
        metalBump: metal.normalMap,
        grate: grate.map,
        grateBump: grate.normalMap,
        crate: crate.map
      };
    }
    return {};
  }

  function getWorldMaterialSet(renderer = null) {
    if (_matCache.has('worldSet')) return _matCache.get('worldSet');
    const P = window.AshfallPBR;
    const tx = getSurfaceBank();
    if (!P) return {};

    const groundMat = P.getMaterial('terrain_detail', {
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.0,
      normalScale: 0.95,
      envMapIntensity: 0.55,
      tile: 4.0
    });
    if (groundMat.map) { groundMat.map.repeat.set(160, 160); }
    if (groundMat.normalMap) { groundMat.normalMap.repeat.set(160, 160); }
    if (groundMat.roughnessMap) { groundMat.roughnessMap.repeat.set(160, 160); }

    const windowGlassMat = P.getGlassMaterial(0x1f3442, 0.52, 0.06, 0.35);
    windowGlassMat.userData.tile = 2.0;

    const set = {
      ground: groundMat,
      road: P.getMaterial('asphalt_cracked', {
        color: 0x909290, roughness: 0.86, metalness: 0.04, normalScale: 1.05,
        polygonOffset: true, polygonOffsetFactor: -2, tile: 6.0
      }),
      concrete: P.getMaterial('concrete_weathered', { color: 0xbcbcb4, tile: 3.2 }),
      darkConcrete: P.getMaterial('bunker_concrete_formwork', { color: 0x7c7e78, tile: 3.2 }),
      whiteWall: P.getMaterial('plaster_aged_white', { color: 0xf4f2eb, tile: 2.8 }),
      policeNavy: P.getMaterial('plaster_soviet_blue', { color: 0x4c6f9c, tile: 2.6 }),
      fireRed: P.getMaterial('brick_soviet_weathered', { color: 0xeadad4, normalScale: 1.15, tile: 2.2 }),
      bossDark: P.getMaterial('bunker_concrete_formwork', { color: 0x4a4d52, roughness: 0.78, tile: 3.0 }),
      interiorPlaster: P.getMaterial('plaster_aged_white', { color: 0xe6e0d4, tile: 2.6 }),
      floorTile: P.getMaterial('tile_subway_dirty', { color: 0xdad6cc, roughness: 0.48, tile: 2.2 }),
      roofTar: P.getMaterial('roof_bitumen_tar', { color: 0x626466, tile: 3.4 }),
      hazardAmber: P.getMaterial('hazard_chevron_pbr', { color: 0xffffff, roughness: 0.58, metalness: 0.28, tile: 1.8 }),
      windowGlass: windowGlassMat,
      windowFrame: P.getMaterial('aluminum_anodized', { color: 0x3a4046, roughness: 0.42, metalness: 0.82, tile: 1.4 }),
      doorWood: P.getMaterial('wood_walnut', { color: 0xa6825c, roughness: 0.58, metalness: 0.0, tile: 1.4 }),
      doorSteel: P.getMaterial('steel_dark_structural', { color: 0x7a8590, roughness: 0.44, metalness: 0.84, tile: 1.6 }),
      rustRed: P.getMaterial('steel_rusted_corrugated', { color: 0xb8664e, normalScale: 1.15, tile: 2.4 }),
      rustOlive: P.getMaterial('steel_rusted_corrugated', { color: 0x86906a, normalScale: 1.1, tile: 2.4 }),
      rustBlue: P.getMaterial('steel_rusted_corrugated', { color: 0x5c7e98, normalScale: 1.1, tile: 2.4 }),
      wood: P.getMaterial('wood_planks_weathered', { color: 0xc2a27c, roughness: 0.78, tile: 1.8 }),
      metal: P.getMaterial('steel_dark_structural', { color: 0x9aa2aa, roughness: 0.44, metalness: 0.86, tile: 1.8 }),
      grate: P.getMaterial('steel_diamond_grate', { color: 0x8b9298, roughness: 0.48, metalness: 0.84, normalScale: 1.2, tile: 1.2 }),
      crateMil: P.getMaterial('crate_military', { color: 0xb8c89a, roughness: 0.76, metalness: 0.08, tile: 1.1 }),
      crateMed: P.getMaterial('tile_lab_ceramic', { color: 0xeaf0ec, roughness: 0.36, metalness: 0.08, tile: 1.6 }),
      crateSup: P.getMaterial('crate_supply', { color: 0xd0b084, roughness: 0.74, metalness: 0.06, tile: 1.1 }),
      surfaceBank: tx
    };
    _matCache.set('worldSet', set);
    return set;
  }

  // --------------------------------------------------------------------------
  // 3. Spatial Instanced Prop Batcher
  // --------------------------------------------------------------------------
  class InstancedPropBatcher {
    constructor(cellSize = 96) {
      this.cellSize = cellSize;
      this.buckets = new Map();
    }
    add(geo, mat, matrix, castShadow = false) {
      if (!geo || !mat || !matrix) return;
      if (geo.attributes && geo.attributes.uv && !geo.attributes.uv2) {
        geo.setAttribute('uv2', geo.attributes.uv);
      }
      const ex = matrix.elements[12];
      const ez = matrix.elements[14];
      const cx = Math.floor(ex / this.cellSize);
      const cz = Math.floor(ez / this.cellSize);
      const key = `${geo.uuid}|${mat.uuid}|${cx}|${cz}`;
      let b = this.buckets.get(key);
      if (!b) {
        b = { geo, mat, matrices: [], castShadow: false };
        this.buckets.set(key, b);
      }
      if (castShadow) b.castShadow = true;
      b.matrices.push(matrix.clone ? matrix.clone() : matrix);
    }
    flush(scene, outList = null) {
      for (const b of this.buckets.values()) {
        const n = b.matrices.length;
        if (n === 0) continue;
        const inst = new THREE.InstancedMesh(b.geo, b.mat, n);
        inst.castShadow = b.castShadow;
        inst.receiveShadow = true;
        inst.matrixAutoUpdate = false;
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (let i = 0; i < n; i++) {
          const m = b.matrices[i];
          inst.setMatrixAt(i, m);
          const x = m.elements[12], y = m.elements[13], z = m.elements[14];
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
        inst.instanceMatrix.needsUpdate = true;
        if (!b.geo.boundingSphere) b.geo.computeBoundingSphere();
        const pad = b.geo.boundingSphere ? b.geo.boundingSphere.radius : 2.0;
        const cx = (minX + maxX) * 0.5;
        const cy = (minY + maxY) * 0.5;
        const cz = (minZ + maxZ) * 0.5;
        inst.boundingSphere = new THREE.Sphere(
          new THREE.Vector3(cx, cy, cz),
          Math.hypot(maxX - cx, maxY - cy, maxZ - cz) + pad + 1.0
        );
        inst.frustumCulled = true;
        inst.updateMatrix();
        if (scene) scene.add(inst);
        if (outList) outList.push(inst);
      }
      this.buckets.clear();
    }
  }

  // --------------------------------------------------------------------------
  // 4. Deterministic GPU Memory Disposer (0-leak across Raid <-> Zavod cycles)
  // --------------------------------------------------------------------------
  function _disposeMat(mat, seen) {
    if (!mat || seen.has(mat)) return;
    if (mat.userData && mat.userData._ashShared) return;
    seen.add(mat);
    const mapKeys = ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap'];
    for (let i = 0; i < mapKeys.length; i++) {
      const tex = mat[mapKeys[i]];
      if (tex && !seen.has(tex) && !(tex.userData && tex.userData._ashShared)) {
        seen.add(tex);
        if (typeof tex.dispose === 'function') tex.dispose();
      }
    }
    if (typeof mat.dispose === 'function') mat.dispose();
  }

  function disposeSceneGraph(root) {
    if (!root || typeof root.traverse !== 'function') return;
    const seen = new Set();
    root.traverse((obj) => {
      if (obj.geometry && !seen.has(obj.geometry) && !(obj.geometry.userData && obj.geometry.userData._ashShared)) {
        seen.add(obj.geometry);
        if (typeof obj.geometry.dispose === 'function') obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          for (let i = 0; i < obj.material.length; i++) _disposeMat(obj.material[i], seen);
        } else {
          _disposeMat(obj.material, seen);
        }
      }
    });
    if (Array.isArray(root.children)) root.children.length = 0;
  }

  function disposeRaidResources(opts = {}) {
    const { scene, viewmodelScene, world } = opts;
    if (scene) disposeSceneGraph(scene);
    if (viewmodelScene) disposeSceneGraph(viewmodelScene);
    if (world) {
      if (Array.isArray(world._batchedMeshes)) world._batchedMeshes.length = 0;
      if (Array.isArray(world.shootableMeshes)) world.shootableMeshes.length = 0;
      if (Array.isArray(world.wallMeshes)) world.wallMeshes.length = 0;
      if (Array.isArray(world.colliders)) world.colliders.length = 0;
      if (Array.isArray(world.lootContainers)) world.lootContainers.length = 0;
      if (Array.isArray(world.groundItems)) world.groundItems.length = 0;
      if (Array.isArray(world.doors)) world.doors.length = 0;
      if (Array.isArray(world.waterMeshes)) world.waterMeshes.length = 0;
      if (Array.isArray(world.fogLayers)) world.fogLayers.length = 0;
      if (Array.isArray(world.smokePlumes)) world.smokePlumes.length = 0;
      if (world._colliderGrid && world._colliderGrid.clear) world._colliderGrid.clear();
      if (world._shootGrid && world._shootGrid.clear) world._shootGrid.clear();
      if (world._wallGrid && world._wallGrid.clear) world._wallGrid.clear();
      if (world.zavod) {
        world.zavod.doors = [];
        world.zavod.barricades = [];
        world.zavod.stations = [];
        world.zavod.lasers = [];
        world.zavod.floods = {};
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. WebGL 2.0 HDR Post-Processing Pipeline (Depth SSAO + Bloom + ACES + CAS)
  // --------------------------------------------------------------------------
  function createRenderPipeline(renderer) {
    const gl = renderer && renderer.getContext ? renderer.getContext() : null;
    const isWebGL2 = !!(renderer && renderer.capabilities && renderer.capabilities.isWebGL2);
    const hasFloatRT = !!(gl && (isWebGL2
      ? (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))
      : gl.getExtension('EXT_color_buffer_half_float')));
    const hasDepthTex = !!(gl && (isWebGL2 || gl.getExtension('WEBGL_depth_texture')));
    const rtType = (hasFloatRT && THREE.HalfFloatType) ? THREE.HalfFloatType : THREE.UnsignedByteType;

    const getScale = () => {
      const p = (window.GFX_SETTINGS && typeof window.GFX_SETTINGS.pixel === 'number') ? window.GFX_SETTINGS.pixel : 1;
      return Math.max(1, Math.min(3, Math.round(p)));
    };
    const computeSize = (s) => {
      if (s > 1) {
        return [Math.max(1, Math.ceil(window.innerWidth / s)), Math.max(1, Math.ceil(window.innerHeight / s))];
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      return [Math.max(1, Math.round(window.innerWidth * dpr)), Math.max(1, Math.round(window.innerHeight * dpr))];
    };

    let curScale = getScale();
    let [rtW, rtH] = computeSize(curScale);

    const depthTex = hasDepthTex
      ? new THREE.DepthTexture(rtW, rtH, THREE.UnsignedIntType || THREE.UnsignedShortType)
      : null;
    if (depthTex) {
      depthTex.minFilter = THREE.NearestFilter;
      depthTex.magFilter = THREE.NearestFilter;
      depthTex.generateMipmaps = false;
    }

    const rtScene = new THREE.WebGLRenderTarget(rtW, rtH, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: rtType,
      depthBuffer: true,
      stencilBuffer: false,
      depthTexture: depthTex
    });
    rtScene.texture.generateMipmaps = false;

    const bW = Math.max(1, Math.floor(rtW * 0.5));
    const bH = Math.max(1, Math.floor(rtH * 0.5));
    const rtBloomA = new THREE.WebGLRenderTarget(bW, bH, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: rtType,
      depthBuffer: false
    });
    const rtBloomB = new THREE.WebGLRenderTarget(bW, bH, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: rtType,
      depthBuffer: false
    });

    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    // Bloom Extract
    const bloomExtractMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: rtScene.texture },
        uThresh: { value: rtType === THREE.HalfFloatType ? 1.05 : 0.84 }
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uThresh;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          float b = max(c.r, max(c.g, c.b));
          float soft = clamp((b - (uThresh - 0.18)) / 0.36, 0.0, 1.0);
          float w = max(smoothstep(uThresh, uThresh + 0.45, b), soft * soft * 0.55);
          gl_FragColor = vec4(c * w, 1.0);
        }
      `,
      toneMapped: false, depthTest: false, depthWrite: false
    });
    const bloomExtractScene = new THREE.Scene();
    bloomExtractScene.add(new THREE.Mesh(quadGeo, bloomExtractMat));

    // Separable Gaussian Blur for Bloom
    const bloomBlurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: rtBloomA.texture },
        uDir: { value: new THREE.Vector2(1 / bW, 0) }
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uDir;
        varying vec2 vUv;
        void main() {
          vec3 sum = texture2D(tDiffuse, vUv).rgb * 0.227027;
          sum += texture2D(tDiffuse, vUv + uDir * 1.384615).rgb * 0.316216;
          sum += texture2D(tDiffuse, vUv - uDir * 1.384615).rgb * 0.316216;
          sum += texture2D(tDiffuse, vUv + uDir * 3.230769).rgb * 0.070270;
          sum += texture2D(tDiffuse, vUv - uDir * 3.230769).rgb * 0.070270;
          gl_FragColor = vec4(sum, 1.0);
        }
      `,
      toneMapped: false, depthTest: false, depthWrite: false
    });
    const bloomBlurScene = new THREE.Scene();
    bloomBlurScene.add(new THREE.Mesh(quadGeo, bloomBlurMat));

    // Final Photorealistic Composite: Depth SSAO + HDR Bloom + CAS Sharpening + Tarkov/DMZ ACES Filmic Grade + NVG/Rad/UW
    const postMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: rtScene.texture },
        tDepth: { value: depthTex },
        tBloom: { value: rtBloomA.texture },
        uHasDepth: { value: depthTex ? 1.0 : 0.0 },
        uEnableAO: { value: 1.0 },
        uEnableBloom: { value: 1.0 },
        uRes: { value: new THREE.Vector2(rtW, rtH) },
        uScale: { value: curScale },
        uExposure: { value: 1.08 },
        uLevels: { value: 48.0 },
        uDither: { value: 0.75 },
        uNvg: { value: 0.0 },
        uRad: { value: 0.0 },
        uUnderwater: { value: 0.0 },
        uTime: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform sampler2D tBloom;
        uniform float uHasDepth;
        uniform float uEnableAO;
        uniform float uEnableBloom;
        uniform vec2 uRes;
        uniform float uScale;
        uniform float uExposure;
        uniform float uLevels;
        uniform float uDither;
        uniform float uNvg;
        uniform float uRad;
        uniform float uUnderwater;
        uniform float uTime;
        varying vec2 vUv;

        float b2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
        float b4(vec2 a) { return b2(0.5 * a) * 0.25 + b2(a); }
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

        vec3 acesFilmic(vec3 x) {
          float a = 2.51;
          float b = 0.03;
          float c = 2.43;
          float d = 0.59;
          float e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        float computeSSAO(vec2 uv) {
          float d0 = texture2D(tDepth, uv).r;
          if (d0 >= 0.9994 || d0 <= 0.0001) return 1.0;
          float radPx = mix(4.5, 11.0, 1.0 - smoothstep(0.92, 0.999, d0));
          vec2 px = radPx / uRes;
          float rot = hash(gl_FragCoord.xy) * 6.28318;
          float occ = 0.0;
          float maxRange = max(0.00035, (1.0 - d0) * 0.16);
          for (int i = 0; i < 6; i++) {
            float ang = rot + float(i) * 1.0471975;
            vec2 off = vec2(cos(ang), sin(ang)) * px * (0.45 + 0.55 * fract(float(i) * 0.618));
            float ds = texture2D(tDepth, clamp(uv + off, 0.002, 0.998)).r;
            float diff = d0 - ds;
            float rangeW = smoothstep(maxRange, 0.0, abs(diff));
            occ += step(0.00008, diff) * rangeW;
          }
          return clamp(1.0 - (occ / 6.0) * 0.42, 0.52, 1.0);
        }

        void main() {
          vec2 uv = vUv;
          if (uUnderwater > 0.01) {
            uv.x += sin(uv.y * 22.0 + uTime * 3.2) * 0.0045 * uUnderwater;
            uv.y += cos(uv.x * 18.0 + uTime * 2.5) * 0.0035 * uUnderwater;
          }
          uv = clamp(uv, 0.001, 0.999);

          vec3 hdr = texture2D(tDiffuse, uv).rgb;
          // Subtle Contrast-Adaptive Sharpening (CAS) in native HD mode
          if (uScale <= 1.01 && uUnderwater < 0.05) {
            vec2 tx = 1.0 / uRes;
            vec3 n = texture2D(tDiffuse, uv + vec2(0.0, tx.y)).rgb;
            vec3 s = texture2D(tDiffuse, uv - vec2(0.0, tx.y)).rgb;
            vec3 e = texture2D(tDiffuse, uv + vec2(tx.x, 0.0)).rgb;
            vec3 w = texture2D(tDiffuse, uv - vec2(tx.x, 0.0)).rgb;
            vec3 avg = (n + s + e + w) * 0.25;
            hdr = max(vec3(0.0), hdr + (hdr - avg) * 0.22);
          }

          if (uHasDepth > 0.5 && uEnableAO > 0.5 && uScale <= 1.01) {
            float ao = computeSSAO(uv);
            hdr *= mix(1.0, ao, 0.85);
          }

          if (uEnableBloom > 0.5) {
            hdr += texture2D(tBloom, uv).rgb * 0.38;
          }

          // ACES Filmic Tone Mapping + Linear-to-sRGB encoding
          vec3 c = acesFilmic(hdr * uExposure);
          c = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));

          // Optional Retro PS2 Pixelation (OFF by default on Alpha RC 0.2.94+)
          if (uScale > 1.01) {
            float d = b4(gl_FragCoord.xy / max(1.0, uScale)) - 0.5;
            c = floor(clamp(c, 0.0, 1.0) * uLevels + d * uDither) / uLevels;
          }

          // Tarkov / Call of Duty DMZ Cold Steel Atmospheric Grade + Vignette
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(c, vec3(lum), 0.12);
          c = c * vec3(1.00, 1.00, 0.98) + vec3(0.005, 0.008, 0.011) * (1.0 - lum);
          c = clamp((c - 0.5) * 1.05 + 0.5, 0.0, 1.0);
          float vig = smoothstep(0.95, 0.28, length(vUv - 0.5));
          c *= mix(0.84, 1.0, vig);

          if (uNvg > 0.01) {
            float nvgLum = pow(clamp(lum * 1.42 + 0.04, 0.0, 1.0), 0.85);
            float grain = (hash(uv * uRes + fract(uTime * 19.7)) - 0.5) * 0.08;
            float scan = 0.96 + 0.04 * sin(gl_FragCoord.y * 1.4);
            float distC = length(vUv - vec2(0.5, 0.5));
            float tube = smoothstep(0.76, 0.42, distC);
            vec3 phosphor = vec3(0.26, 1.08, 0.58) * (nvgLum + grain) * scan * mix(0.45, 1.05, tube);
            c = mix(c, clamp(phosphor, 0.0, 1.0), uNvg);
          }
          if (uRad > 0.01) {
            float geiger = step(0.986, hash(floor(uv * 160.0) + fract(uTime * 31.3)));
            c = mix(c, c * vec3(1.08, 1.04, 0.62) + vec3(0.35, 0.42, 0.05) * geiger, uRad * 0.72);
          }
          if (uUnderwater > 0.01) {
            float uwVig = smoothstep(0.25, 0.85, length(vUv - 0.5));
            c = mix(c, c * vec3(0.30, 0.72, 0.88) + vec3(0.02, 0.11, 0.18), uUnderwater * (0.48 + uwVig * 0.35));
          }

          gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }
      `,
      toneMapped: false, depthTest: false, depthWrite: false
    });
    const postScene = new THREE.Scene();
    postScene.add(new THREE.Mesh(quadGeo, postMat));

    const resize = () => {
      curScale = getScale();
      const [nw, nh] = computeSize(curScale);
      if (nw !== rtW || nh !== rtH) {
        rtW = nw; rtH = nh;
        rtScene.setSize(rtW, rtH);
        const nbW = Math.max(1, Math.floor(rtW * 0.5));
        const nbH = Math.max(1, Math.floor(rtH * 0.5));
        rtBloomA.setSize(nbW, nbH);
        rtBloomB.setSize(nbW, nbH);
      }
      postMat.uniforms.uRes.value.set(rtW, rtH);
      postMat.uniforms.uScale.value = curScale;
      if (renderer && renderer.toneMappingExposure !== undefined) {
        postMat.uniforms.uExposure.value = renderer.toneMappingExposure;
      }
    };

    return {
      get scale() { return curScale; },
      resize,
      setEffects(eff = {}) {
        const u = postMat.uniforms;
        if (eff.nvg !== undefined) u.uNvg.value = eff.nvg ? 1.0 : 0.0;
        if (eff.rad !== undefined) u.uRad.value = eff.rad ? 1.0 : 0.0;
        if (eff.underwater !== undefined) u.uUnderwater.value = eff.underwater ? 1.0 : 0.0;
        if (eff.time !== undefined) u.uTime.value = eff.time;
      },
      resetEffects() {
        const u = postMat.uniforms;
        u.uNvg.value = 0.0;
        u.uRad.value = 0.0;
        u.uUnderwater.value = 0.0;
      },
      begin() {
        curScale = getScale();
        const lightingQ = (window.GFX_SETTINGS && typeof window.GFX_SETTINGS.lighting === 'number')
          ? window.GFX_SETTINGS.lighting : 3;
        postMat.uniforms.uScale.value = curScale;
        postMat.uniforms.uTime.value = performance.now() * 0.001;
        postMat.uniforms.uEnableAO.value = lightingQ >= 2 ? 1.0 : 0.0;
        postMat.uniforms.uEnableBloom.value = lightingQ >= 2 ? 1.0 : 0.0;
        if (renderer && renderer.toneMappingExposure !== undefined) {
          postMat.uniforms.uExposure.value = renderer.toneMappingExposure;
        }
        renderer.setRenderTarget(rtScene);
        renderer.autoClear = false;
        renderer.clear();
      },
      render(sc, cam, clearDepthFirst = false) {
        if (!sc || !cam) return;
        if (clearDepthFirst) renderer.clearDepth();
        renderer.render(sc, cam);
      },
      end() {
        const lightingQ = (window.GFX_SETTINGS && typeof window.GFX_SETTINGS.lighting === 'number')
          ? window.GFX_SETTINGS.lighting : 3;
        if (lightingQ >= 2) {
          renderer.setRenderTarget(rtBloomA);
          renderer.clear();
          renderer.render(bloomExtractScene, postCam);

          const bTexW = Math.max(1, rtBloomA.width);
          const bTexH = Math.max(1, rtBloomA.height);
          bloomBlurMat.uniforms.tDiffuse.value = rtBloomA.texture;
          bloomBlurMat.uniforms.uDir.value.set(1.35 / bTexW, 0);
          renderer.setRenderTarget(rtBloomB);
          renderer.clear();
          renderer.render(bloomBlurScene, postCam);

          bloomBlurMat.uniforms.tDiffuse.value = rtBloomB.texture;
          bloomBlurMat.uniforms.uDir.value.set(0, 1.35 / bTexH);
          renderer.setRenderTarget(rtBloomA);
          renderer.clear();
          renderer.render(bloomBlurScene, postCam);
        }

        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(postScene, postCam);
      }
    };
  }

  return {
    GeoPool,
    InstancedPropBatcher,
    configureRenderer,
    getEnvMap,
    getSurfaceBank,
    getWorldMaterialSet,
    disposeSceneGraph,
    disposeRaidResources,
    createRenderPipeline,
    markShared: _markShared
  };
})();
