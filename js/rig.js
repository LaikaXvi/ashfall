// ============================================================================
// ASHFALL // Rigged 3D Character Pipeline & World-Space 2-Bone IK (v2.40)
// Loads Mixamo "Vanguard" soldier.glb with Idle/Walk/Run mocap clips,
// retargets onto the MW2 proxy rig for 3P entities, and provides RiggedFPArms.
// Set localStorage.ashfall_disable_rig = '1' to force legacy procedural rigs.
// ============================================================================
(function () {
  const MIXAMO_PREFIX = 'mixamorig';
  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _v3 = new THREE.Vector3();
  const _v4 = new THREE.Vector3();
  const _v5 = new THREE.Vector3();
  const _v6 = new THREE.Vector3();
  const _v7 = new THREE.Vector3();
  const _rbFrom = new THREE.Vector3();
  const _rbTo = new THREE.Vector3();
  const _q1 = new THREE.Quaternion();
  const _q2 = new THREE.Quaternion();
  const _q3 = new THREE.Quaternion();
  const _m1 = new THREE.Matrix4();
  const _m2 = new THREE.Matrix4();
  const _m3 = new THREE.Matrix4();

  function normName(name) {
    return String(name || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  }

  function smoothstepRange(edge0, edge1, x) {
    const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0 || 1), 0, 1);
    return t * t * (3 - 2 * t);
  }

  const RigAssets = {
    ready: false,
    failed: false,
    soldier: null,
    items: {},
    hiddenMaterial: new THREE.MeshBasicMaterial({ visible: false }),
    _loadPromise: null,

    load(onProgress) {
      if (this._loadPromise) return this._loadPromise;
      this._loadPromise = new Promise((resolve) => {
        try {
          if (typeof localStorage !== 'undefined' && localStorage.getItem('ashfall_disable_rig') === '1') {
            this.ready = false;
            this.failed = false;
            resolve({ ok: false, disabled: true });
            return;
          }
          if (!THREE || !THREE.GLTFLoader) {
            console.warn('[RigAssets] THREE.GLTFLoader unavailable; using legacy rigs.');
            this.failed = true;
            resolve({ ok: false });
            return;
          }
        } catch (e) {
          this.failed = true;
          resolve({ ok: false });
          return;
        }

        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ ok });
        };

        const timer = setTimeout(() => {
          console.warn('[RigAssets] soldier.glb load timed out after 20s; falling back to legacy rigs.');
          this.failed = true;
          finish(false);
        }, 20000);

        try {
          const loader = new THREE.GLTFLoader();
          loader.load(
            'assets/models/characters/soldier.glb',
            (gltf) => {
              if (settled) return;
              if (!gltf || !gltf.scene) {
                this.failed = true;
                finish(false);
                return;
              }
              this.soldier = {
                scene: gltf.scene,
                animations: Array.isArray(gltf.animations) ? gltf.animations : []
              };
              this.ready = true;
              this.failed = false;
              finish(true);
            },
            onProgress || undefined,
            (err) => {
              console.warn('[RigAssets] Failed to load soldier.glb, using legacy rigs:', err);
              this.failed = true;
              finish(false);
            }
          );
        } catch (err) {
          console.warn('[RigAssets] GLTFLoader exception, using legacy rigs:', err);
          this.failed = true;
          finish(false);
        }
      });
      return this._loadPromise;
    },

    boneMap(root) {
      const map = {};
      if (!root) return map;
      root.traverse((obj) => {
        const n = normName(obj.name);
        if (n.startsWith(MIXAMO_PREFIX)) {
          map[n.slice(MIXAMO_PREFIX.length)] = obj;
        }
      });
      return map;
    },

    cloneSoldier() {
      if (!this.ready || !this.soldier || !THREE.SkeletonUtils) return null;
      const clone = THREE.SkeletonUtils.clone(this.soldier.scene);
      let body = null;
      let visor = null;

      clone.traverse((obj) => {
        if (!obj.isMesh) return;
        const n = normName(obj.name);
        if (n.includes('visor')) visor = obj;
        else if (n.includes('vanguardmesh') || obj.isSkinnedMesh) {
          if (!body || n.includes('vanguardmesh')) body = obj;
        }

        const makeLambert = (orig) => {
          if (!orig) return new THREE.MeshLambertMaterial({ color: 0xffffff, skinning: true });
          if (orig.map) {
            orig.map.magFilter = THREE.NearestFilter;
            orig.map.needsUpdate = true;
          }
          const col = orig.map
            ? new THREE.Color(0xffffff)
            : (orig.color ? orig.color.clone() : new THREE.Color(0x162229));
          return new THREE.MeshLambertMaterial({
            map: orig.map || null,
            color: col,
            skinning: true
          });
        };

        if (Array.isArray(obj.material)) {
          obj.material = obj.material.map(makeLambert);
        } else {
          obj.material = makeLambert(obj.material);
        }
        obj.frustumCulled = false;
        obj.castShadow = true;
      });

      const wrapper = new THREE.Group();
      wrapper.add(clone);
      return {
        wrapper,
        model: clone,
        body,
        visor,
        bones: this.boneMap(clone)
      };
    }
  };

  const RigIK = {
    setWorldQuat(bone, targetWorldQ) {
      if (!bone || !bone.parent) return;
      bone.parent.getWorldQuaternion(_q1);
      bone.quaternion.copy(_q1.invert().multiply(targetWorldQ));
    },

    rotateBoneWorld(bone, fromDir, toDir) {
      if (!bone || !bone.parent) return;
      _rbFrom.copy(fromDir);
      _rbTo.copy(toDir);
      if (_rbFrom.lengthSq() < 1e-8 || _rbTo.lengthSq() < 1e-8) return;
      _rbFrom.normalize();
      _rbTo.normalize();
      _q2.setFromUnitVectors(_rbFrom, _rbTo);
      bone.getWorldQuaternion(_q3);
      this.setWorldQuat(bone, _q2.multiply(_q3));
      bone.updateMatrixWorld(true);
    },

    solveTwoBone(upper, lower, end, target, pole) {
      if (!upper || !lower || !end || !upper.parent) return;
      upper.parent.updateWorldMatrix(true, false);
      upper.updateMatrixWorld(true);

      upper.getWorldPosition(_v1); // pa
      lower.getWorldPosition(_v2); // pb
      end.getWorldPosition(_v3);   // pc

      const lab = _v2.distanceTo(_v1);
      const lbc = _v3.distanceTo(_v2);
      const rawDist = _v1.distanceTo(target);
      if (lab < 1e-4 || lbc < 1e-4 || rawDist < 1e-5) return;

      const minD = Math.abs(lab - lbc) + 1e-4;
      const maxD = (lab + lbc) * 0.9995;
      const d = THREE.MathUtils.clamp(rawDist, minD, maxD);

      const dir = _v4.subVectors(target, _v1).normalize();
      const pd = _v7.subVectors(pole, _v1);
      pd.addScaledVector(dir, -pd.dot(dir));
      if (pd.lengthSq() < 1e-5) {
        pd.subVectors(_v2, _v1);
        pd.addScaledVector(dir, -pd.dot(dir));
      }
      if (pd.lengthSq() < 1e-5) pd.set(0, 1, 0);
      else pd.normalize();

      const cosA = THREE.MathUtils.clamp((lab * lab + d * d - lbc * lbc) / (2 * lab * d), -1, 1);
      const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

      // Desired elbow position stored safely in _v7-free temp via clone or inline math on target
      const ex = _v1.x + dir.x * cosA * lab + pd.x * sinA * lab;
      const ey = _v1.y + dir.y * cosA * lab + pd.y * sinA * lab;
      const ez = _v1.z + dir.z * cosA * lab + pd.z * sinA * lab;

      const fromU = _v2.sub(_v1); // pb - pa
      const toU = _v3.set(ex - _v1.x, ey - _v1.y, ez - _v1.z);
      this.rotateBoneWorld(upper, fromU, toU);

      // Recompute pb' and pc' after rotating upper
      upper.getWorldPosition(_v1);
      lower.getWorldPosition(_v2);
      end.getWorldPosition(_v3);
      const tgtClampedX = _v1.x + dir.x * d;
      const tgtClampedY = _v1.y + dir.y * d;
      const tgtClampedZ = _v1.z + dir.z * d;
      const fromL = _v3.sub(_v2); // pc' - pb'
      const toL = _v5.set(tgtClampedX - _v2.x, tgtClampedY - _v2.y, tgtClampedZ - _v2.z);
      this.rotateBoneWorld(lower, fromL, toL);
    },

    basisQuat(fLocal, iLocal, fWorld, iWorld, out) {
      const fl = _v1.copy(fLocal).normalize();
      const il = _v2.copy(iLocal).addScaledVector(fl, -iLocal.dot(fl));
      if (il.lengthSq() < 1e-6) il.set(1, 0, 0);
      else il.normalize();
      const nl = _v3.crossVectors(fl, il).normalize();

      const fw = _v4.copy(fWorld).normalize();
      const iw = _v5.copy(iWorld).addScaledVector(fw, -iWorld.dot(fw));
      if (iw.lengthSq() < 1e-6) iw.set(1, 0, 0);
      else iw.normalize();
      const nw = _v6.crossVectors(fw, iw).normalize();

      _m1.makeBasis(fw, iw, nw);
      _m2.makeBasis(fl, il, nl).transpose();
      _m3.multiplyMatrices(_m1, _m2);
      return (out || new THREE.Quaternion()).setFromRotationMatrix(_m3);
    },

    computeHandBasis(handBone, B, side) {
      const mid = B[side + 'handmiddle1'];
      const idx = B[side + 'handindex1'];
      const pnk = B[side + 'handpinky1'];
      if (!handBone || !mid || !idx || !pnk) {
        return { fLocal: new THREE.Vector3(0, 1, 0), iLocal: new THREE.Vector3(1, 0, 0) };
      }
      const hp = handBone.getWorldPosition(new THREE.Vector3());
      const mp = mid.getWorldPosition(new THREE.Vector3());
      const ip = idx.getWorldPosition(new THREE.Vector3());
      const pp = pnk.getWorldPosition(new THREE.Vector3());
      const hqInv = handBone.getWorldQuaternion(new THREE.Quaternion()).invert();

      const fWorld = mp.sub(hp).normalize();
      const iWorld = ip.sub(pp).normalize();
      return {
        fLocal: fWorld.applyQuaternion(hqInv).normalize(),
        iLocal: iWorld.applyQuaternion(hqInv).normalize()
      };
    },

    buildFingerCurl(B, side) {
      const handBone = B[side + 'hand'];
      const mid = B[side + 'handmiddle1'];
      const idx = B[side + 'handindex1'];
      const pnk = B[side + 'handpinky1'];
      const entries = [];
      if (!handBone || !mid || !idx || !pnk) return entries;

      const hp = handBone.getWorldPosition(new THREE.Vector3());
      const mp = mid.getWorldPosition(new THREE.Vector3());
      const ip = idx.getWorldPosition(new THREE.Vector3());
      const pp = pnk.getWorldPosition(new THREE.Vector3());

      const fW = mp.sub(hp).normalize();
      const iW = ip.sub(pp).addScaledVector(fW, -ip.clone().sub(pp).dot(fW)).normalize();
      const palm = new THREE.Vector3().crossVectors(fW, iW).normalize();
      if (side === 'right') palm.multiplyScalar(-1);

      const fingers = ['index', 'middle', 'ring', 'pinky', 'thumb'];
      for (const fName of fingers) {
        for (let j = 1; j <= 3; j++) {
          const bone = B[side + 'hand' + fName + j];
          const child = B[side + 'hand' + fName + (j + 1)];
          if (!bone || !child) continue;
          const bp = bone.getWorldPosition(new THREE.Vector3());
          const cp = child.getWorldPosition(new THREE.Vector3());
          const boneDir = cp.sub(bp);
          if (boneDir.lengthSq() < 1e-8) continue;
          boneDir.normalize();
          const axisWorld = new THREE.Vector3().crossVectors(boneDir, palm);
          if (axisWorld.lengthSq() < 1e-6) continue;
          axisWorld.normalize();
          const bqInv = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
          const axisLocal = axisWorld.clone().applyQuaternion(bqInv).normalize();
          entries.push({
            bone,
            finger: fName,
            joint: j,
            bindLocal: bone.quaternion.clone(),
            axisLocal
          });
        }
      }
      return entries;
    },

    applyFingerCurl(curlData, angles = [0.9, 1.0, 0.6], thumb = 0.5) {
      if (!curlData || curlData.length === 0) return;
      const tAngles = [thumb * 0.6, thumb * 0.5, thumb * 0.4];
      for (let i = 0; i < curlData.length; i++) {
        const e = curlData[i];
        const arr = e.finger === 'thumb' ? tAngles : angles;
        const ang = arr[e.joint - 1] || 0;
        _q1.setFromAxisAngle(e.axisLocal, ang);
        e.bone.quaternion.copy(e.bindLocal).multiply(_q1);
      }
    }
  };

  const ARCHETYPE_TINTS = {
    operator: 0xffffff,
    scavenger: 0xc9b38f,
    raider: 0xbdb59b,
    heavy: 0x8c9096,
    boss: 0x8c9096,
    boss_guard: 0x8c9096
  };

  class RiggedCharacter {
    constructor(rig, opts = {}) {
      this.rig = rig;
      this.opts = opts;
      this.mocapW = 1.0;
      this._detached = 0;
      this._syncCounter = 0;
      this._syncAccumDt = 0;
      this._warned = false;
      this.disabled = false;

      const cloned = RigAssets.cloneSoldier();
      if (!cloned || !cloned.bones.hips) {
        throw new Error('Failed to clone Soldier skeleton');
      }
      this.wrapper = cloned.wrapper;
      this.model = cloned.model;
      this.body = cloned.body;
      this.visor = cloned.visor;
      this.bones = cloned.bones;
      const B = this.bones;

      // Pose with TPose clip at t=0 on temporary mixer for clean calibration
      const anims = RigAssets.soldier.animations || [];
      const findClip = (n) => anims.find((c) => normName(c.name) === normName(n));
      const tPoseClip = findClip('TPose');
      if (tPoseClip) {
        const tmpMixer = new THREE.AnimationMixer(this.model);
        const tAct = tmpMixer.clipAction(tPoseClip);
        tAct.play();
        tmpMixer.update(0);
        tAct.stop();
        tmpMixer.uncacheClip(tPoseClip);
        tmpMixer.uncacheRoot(this.model);
      }

      // Scale height headtopend -> lowest toeend = 1.78m and ground lowest toe at y=0
      this.wrapper.updateMatrixWorld(true);
      const measureFeetAndHead = () => {
        const hPos = B.headtopend ? B.headtopend.getWorldPosition(new THREE.Vector3()).y : 1.75;
        const lY = B.lefttoeend ? B.lefttoeend.getWorldPosition(new THREE.Vector3()).y : 0;
        const rY = B.righttoeend ? B.righttoeend.getWorldPosition(new THREE.Vector3()).y : 0;
        const lowToeY = Math.min(lY, rY);
        return { hPos, lowToeY, height: hPos - lowToeY };
      };
      const m0 = measureFeetAndHead();
      const sFactor = 1.78 / Math.max(0.25, m0.height);
      this.wrapper.scale.setScalar(sFactor);
      this.wrapper.updateMatrixWorld(true);

      const m1 = measureFeetAndHead();
      this.wrapper.position.y -= m1.lowToeY;

      // Rotate wrapper around Y so Soldier feet forward maps to proxy local -Z
      const lfP = B.leftfoot ? B.leftfoot.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(-0.1, 0, 0);
      const ltbP = B.lefttoebase ? B.lefttoebase.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(-0.1, 0, 0.1);
      const rfP = B.rightfoot ? B.rightfoot.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0.1, 0, 0);
      const rtbP = B.righttoebase ? B.righttoebase.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0.1, 0, 0.1);
      const fwdXZ = new THREE.Vector3(
        (ltbP.x - lfP.x) + (rtbP.x - rfP.x),
        0,
        (ltbP.z - lfP.z) + (rtbP.z - rfP.z)
      );
      if (fwdXZ.lengthSq() > 1e-6) {
        fwdXZ.normalize();
        // Rotate fwdXZ around Y so it aligns with (0, 0, -1)
        const angleToNegZ = Math.atan2(-fwdXZ.x, -fwdXZ.z);
        this.wrapper.rotation.y = angleToNegZ;
      }

      // Attach inside rig.root (sibling of rigPivot; receives opts.faceForwardZ naturally)
      rig.root.add(this.wrapper);
      rig.root.updateMatrixWorld(true);

      // Calibrate proxy -> bone quaternion offsets in rest pose
      const calcCorr = (proxyObj, boneObj) => {
        if (!proxyObj || !boneObj) return new THREE.Quaternion();
        const pqInv = proxyObj.getWorldQuaternion(new THREE.Quaternion()).invert();
        const bq = boneObj.getWorldQuaternion(new THREE.Quaternion());
        return pqInv.multiply(bq);
      };

      this.corr = {
        hips: calcCorr(rig.pelvis, B.hips),
        spine: calcCorr(rig.spine, B.spine),
        spine2: calcCorr(rig.torso, B.spine2),
        neck: calcCorr(rig.neck, B.neck),
        head: calcCorr(rig.head, B.head),
        leftfoot: calcCorr(rig.leftLeg && rig.leftLeg.ankle, B.leftfoot),
        rightfoot: calcCorr(rig.rightLeg && rig.rightLeg.ankle, B.rightfoot)
      };

      const hipsWPos = B.hips.getWorldPosition(new THREE.Vector3());
      const wrapWPos = this.wrapper.getWorldPosition(new THREE.Vector3());
      this.hipsOffsetLocal = rig.pelvis.worldToLocal(hipsWPos.clone());
      this.hipsBindHeight = hipsWPos.y - wrapWPos.y;

      this.handBasis = {
        left: RigIK.computeHandBasis(B.lefthand, B, 'left'),
        right: RigIK.computeHandBasis(B.righthand, B, 'right')
      };
      this.fingerCurls = {
        left: RigIK.buildFingerCurl(B, 'left'),
        right: RigIK.buildFingerCurl(B, 'right')
      };

      // Locomotion mixer (Idle / Walk / Run)
      this.mixer = new THREE.AnimationMixer(this.model);
      const idleClip = findClip('Idle');
      const walkClip = findClip('Walk');
      const runClip = findClip('Run');
      this.actions = {
        idle: idleClip ? this.mixer.clipAction(idleClip) : null,
        walk: walkClip ? this.mixer.clipAction(walkClip) : null,
        run: runClip ? this.mixer.clipAction(runClip) : null
      };
      if (this.actions.idle) { this.actions.idle.setEffectiveWeight(1); this.actions.idle.play(); }
      if (this.actions.walk) { this.actions.walk.setEffectiveWeight(0); this.actions.walk.play(); }
      if (this.actions.run) { this.actions.run.setEffectiveWeight(0); this.actions.run.play(); }

      // Hide proxy geometry via hiddenMaterial while keeping hitboxes/props intact
      this._hiddenMeshes = [];
      const skipRoots = new Set([
        this.wrapper,
        rig.weaponPivot,
        rig.plateProp,
        rig.handMag,
        rig.handShell,
        rig.inventoryTablet,
        rig.packGroup,
        rig.heavyExtras
      ].filter(Boolean));
      const hideTraverse = (node) => {
        if (!node || skipRoots.has(node)) return;
        if (node.isMesh && node.material && node.material !== RigAssets.hiddenMaterial) {
          node.userData._origMat = node.material;
          node.material = RigAssets.hiddenMaterial;
          this._hiddenMeshes.push(node);
        }
        const ch = node.children || [];
        for (let i = 0; i < ch.length; i++) hideTraverse(ch[i]);
      };
      hideTraverse(rig.root);

      // Tint body by archetype + subtle uniform tint; boss glowing red visor
      const archetype = opts.archetype || 'operator';
      const baseHex = ARCHETYPE_TINTS[archetype] != null ? ARCHETYPE_TINTS[archetype] : 0xffffff;
      const uniCol = new THREE.Color(opts.uniformColor != null ? opts.uniformColor : 0x3b4437);
      if (this.body && this.body.material && this.body.material.color) {
        this.body.material.color.setHex(baseHex).lerp(uniCol, 0.15);
      }
      if (archetype === 'boss' && this.visor && this.visor.material && this.visor.material.emissive) {
        this.visor.material.emissive.setHex(0x550a0a);
      }

      // Scratch objects per skin for clean sync without alloc churn
      this._savedMocap = {
        hipsPos: new THREE.Vector3(),
        hipsQuat: new THREE.Quaternion(),
        leftupleg: new THREE.Quaternion(),
        leftleg: new THREE.Quaternion(),
        leftfoot: new THREE.Quaternion(),
        rightupleg: new THREE.Quaternion(),
        rightleg: new THREE.Quaternion(),
        rightfoot: new THREE.Quaternion()
      };
      this._slerpQ = new THREE.Quaternion();
      this._rootUp = new THREE.Vector3();
      this._proxyFwd = new THREE.Vector3();

      RigRegistry.add(this);
    }

    disable() {
      if (this.disabled) return;
      this.disabled = true;
      for (let i = 0; i < this._hiddenMeshes.length; i++) {
        const m = this._hiddenMeshes[i];
        if (m && m.userData && m.userData._origMat) {
          m.material = m.userData._origMat;
          delete m.userData._origMat;
        }
      }
      this._hiddenMeshes.length = 0;
      if (this.wrapper && this.wrapper.parent) {
        this.wrapper.parent.remove(this.wrapper);
      }
      RigRegistry.delete(this);
      if (this.rig) this.rig.skin = null;
    }

    sync(dt) {
      if (this.disabled || !this.rig || !this.rig.root) return;
      const r = this.rig;
      const B = this.bones;
      const s = r._animState || {};
      const speed = s.speed || 0;
      const stance = s.stance || 'stand';
      const cDt = Math.min(Math.max(dt || 0.016, 0), 0.1);

      // 1. Update Mixamo locomotion blend weights & speed-matched timeScales
      const wRun = smoothstepRange(2.6, 4.0, speed);
      const wWalk = smoothstepRange(0.3, 1.0, speed) * (1 - wRun);
      const wIdle = Math.max(0, 1 - wWalk - wRun);
      if (this.actions.idle) this.actions.idle.setEffectiveWeight(wIdle);
      if (this.actions.walk) {
        this.actions.walk.setEffectiveWeight(wWalk);
        this.actions.walk.timeScale = THREE.MathUtils.clamp(speed / 1.5, 0.6, 1.6);
      }
      if (this.actions.run) {
        this.actions.run.setEffectiveWeight(wRun);
        this.actions.run.timeScale = THREE.MathUtils.clamp(speed / 4.0, 0.7, 1.5);
      }
      this.mixer.update(cDt);

      // 2. Smooth mocapWeight (1 when standing/walking/running; 0 for crouch/prone/slide/downed/dead/stanceTrans)
      const useMocap = !s.dead && !s.isDowned && !s.isSliding && stance === 'stand' && !s.stanceTrans;
      this.mocapW = THREE.MathUtils.lerp(this.mocapW, useMocap ? 1 : 0, Math.min(1, cDt * 6));
      const mw = this.mocapW;

      // 3. Measure mocap hips height & save mocap local transforms before proxy override
      this.wrapper.updateMatrixWorld(true);
      const hipsWPre = B.hips.getWorldPosition(_v1);
      const wrapWPos = this.wrapper.getWorldPosition(_v2);
      const rootQ = r.root.getWorldQuaternion(_q1);
      this._rootUp.set(0, 1, 0).applyQuaternion(rootQ).normalize();
      const mocapHipsHeight = _v3.subVectors(hipsWPre, wrapWPos).dot(this._rootUp);

      const sv = this._savedMocap;
      sv.hipsPos.copy(B.hips.position);
      sv.hipsQuat.copy(B.hips.quaternion);
      if (B.leftupleg) sv.leftupleg.copy(B.leftupleg.quaternion);
      if (B.leftleg) sv.leftleg.copy(B.leftleg.quaternion);
      if (B.leftfoot) sv.leftfoot.copy(B.leftfoot.quaternion);
      if (B.rightupleg) sv.rightupleg.copy(B.rightupleg.quaternion);
      if (B.rightleg) sv.rightleg.copy(B.rightleg.quaternion);
      if (B.rightfoot) sv.rightfoot.copy(B.rightfoot.quaternion);

      // 4. Refresh proxy transforms from MW2Animator / manual rotation overrides
      r.root.updateMatrixWorld(true);

      // 5. Hips: proxy pelvis orientation blended with mocap, + vertical bounce offset
      const pelWQ = r.pelvis.getWorldQuaternion(new THREE.Quaternion());
      RigIK.setWorldQuat(B.hips, pelWQ.clone().multiply(this.corr.hips));
      if (mw > 0.001) B.hips.quaternion.slerp(sv.hipsQuat, mw);

      const targetHipsW = r.pelvis.localToWorld(this.hipsOffsetLocal.clone());
      targetHipsW.addScaledVector(this._rootUp, (mocapHipsHeight - this.hipsBindHeight) * mw);
      if (B.hips.parent) {
        B.hips.parent.updateWorldMatrix(true, false);
        B.hips.position.copy(B.hips.parent.worldToLocal(targetHipsW));
      }
      B.hips.updateMatrixWorld(true);

      // 6. Spine -> Spine1 -> Spine2 -> Neck -> Head (always proxy-driven for aim pitch, recoil & flinch)
      let qSpW = null;
      let qTorW = null;
      if (B.spine && r.spine) {
        qSpW = r.spine.getWorldQuaternion(new THREE.Quaternion()).multiply(this.corr.spine);
        RigIK.setWorldQuat(B.spine, qSpW);
        B.spine.updateMatrixWorld(true);
      }
      if (r.torso) {
        qTorW = r.torso.getWorldQuaternion(new THREE.Quaternion()).multiply(this.corr.spine2);
      }
      if (B.spine1 && qSpW && qTorW) {
        const qMid = this._slerpQ.copy(qSpW).slerp(qTorW, 0.5);
        RigIK.setWorldQuat(B.spine1, qMid);
        B.spine1.updateMatrixWorld(true);
      }
      if (B.spine2 && qTorW) {
        RigIK.setWorldQuat(B.spine2, qTorW);
        B.spine2.updateMatrixWorld(true);
      }
      if (B.neck && r.neck) {
        const qN = r.neck.getWorldQuaternion(new THREE.Quaternion()).multiply(this.corr.neck);
        RigIK.setWorldQuat(B.neck, qN);
        B.neck.updateMatrixWorld(true);
      }
      if (B.head && r.head) {
        const qH = r.head.getWorldQuaternion(new THREE.Quaternion()).multiply(this.corr.head);
        RigIK.setWorldQuat(B.head, qH);
        B.head.updateMatrixWorld(true);
      }

      // 7. Legs: 2-bone IK from proxy hip/knee/ankle, blended toward Mixamo stride by mocapW
      this._proxyFwd.set(0, 0, -1).applyQuaternion(pelWQ).normalize();
      const solveLeg = (side) => {
        const legProxy = side === 'left' ? r.leftLeg : r.rightLeg;
        const bUp = B[side + 'upleg'];
        const bLeg = B[side + 'leg'];
        const bFoot = B[side + 'foot'];
        if (!legProxy || !bUp || !bLeg || !bFoot) return;

        const ankleW = legProxy.ankle.getWorldPosition(new THREE.Vector3());
        const kneeW = legProxy.knee.getWorldPosition(new THREE.Vector3());
        const pole = kneeW.addScaledVector(this._proxyFwd, 0.4);
        RigIK.solveTwoBone(bUp, bLeg, bFoot, ankleW, pole);

        const ankQ = legProxy.ankle.getWorldQuaternion(new THREE.Quaternion());
        RigIK.setWorldQuat(bFoot, ankQ.multiply(this.corr[side + 'foot']));

        if (mw > 0.001) {
          bUp.quaternion.slerp(sv[side + 'upleg'], mw);
          bLeg.quaternion.slerp(sv[side + 'leg'], mw);
          bFoot.quaternion.slerp(sv[side + 'foot'], mw);
          bUp.updateMatrixWorld(true);
        }
      };
      solveLeg('left');
      solveLeg('right');

      // 8. Arms: 2-bone IK from proxy shoulder/elbow/wrist + hand orientation & curled fingers
      const solveArm = (side) => {
        const armProxy = side === 'left' ? r.leftArm : r.rightArm;
        const bUp = B[side + 'arm'];
        const bLow = B[side + 'forearm'];
        const bHand = B[side + 'hand'];
        if (!armProxy || !bUp || !bLow || !bHand) return;

        const shW = armProxy.shoulder.getWorldPosition(new THREE.Vector3());
        const elW = armProxy.elbow.getWorldPosition(new THREE.Vector3());
        const wrW = armProxy.wrist.getWorldPosition(new THREE.Vector3());
        const mid = shW.add(wrW).multiplyScalar(0.5);
        const out = elW.clone().sub(mid);
        if (out.lengthSq() < 1e-6) {
          out.set(side === 'left' ? -0.4 : 0.4, -0.3, 0.4);
        }
        const pole = elW.add(out);
        RigIK.solveTwoBone(bUp, bLow, bHand, wrW, pole);

        const wrQ = armProxy.wrist.getWorldQuaternion(new THREE.Quaternion());
        const fW = new THREE.Vector3(0, -1, 0).applyQuaternion(wrQ);
        const iW = new THREE.Vector3(0, 0, -1).applyQuaternion(wrQ);
        const hb = this.handBasis[side];
        const handQ = RigIK.basisQuat(hb.fLocal, hb.iLocal, fW, iW, new THREE.Quaternion());
        RigIK.setWorldQuat(bHand, handQ);

        if (s.dead || s.isDowned) {
          RigIK.applyFingerCurl(this.fingerCurls[side], [0.25, 0.25, 0.2], 0.2);
        } else {
          RigIK.applyFingerCurl(this.fingerCurls[side], [0.9, 1.0, 0.6], 0.5);
        }
      };
      solveArm('left');
      solveArm('right');

      // 9. Propagate final bone matrices to SkinnedMesh
      this.model.updateMatrixWorld(true);
    }
  }

  const RigRegistry = {
    skins: new Set(),

    add(skin) {
      if (skin) this.skins.add(skin);
    },

    delete(skin) {
      this.skins.delete(skin);
    },

    syncAll(dt, camera) {
      const camPos = camera ? camera.getWorldPosition(_v7) : null;
      const list = Array.from(this.skins);
      for (let i = 0; i < list.length; i++) {
        const skin = list[i];
        if (!skin || skin.disabled || !skin.rig || !skin.rig.root) continue;

        // Check attachment to an active THREE.Scene and ancestor visibility
        let node = skin.rig.root;
        let hidden = false;
        let top = node;
        while (node) {
          if (node.visible === false) hidden = true;
          top = node;
          node = node.parent;
        }
        if (!top || !top.isScene) {
          skin._detached = (skin._detached || 0) + 1;
          if (skin._detached > 300) skin.disable();
          continue;
        }
        skin._detached = 0;
        if (hidden) continue;

        let syncDt = dt;
        if (camPos) {
          const wp = skin.rig.root.getWorldPosition(_v6);
          if (wp.distanceToSquared(camPos) > 3600) { // > 60m
            skin._syncAccumDt += dt;
            skin._syncCounter = (skin._syncCounter + 1) & 3;
            if (skin._syncCounter !== 0) continue;
            syncDt = skin._syncAccumDt;
            skin._syncAccumDt = 0;
          } else {
            skin._syncAccumDt = 0;
          }
        }

        try {
          skin.sync(syncDt);
        } catch (err) {
          if (!skin._warned) {
            skin._warned = true;
            console.warn('[RigRegistry] sync error; reverting character to legacy mesh:', err);
          }
          skin.disable();
        }
      }
    }
  };

  window.RigAssets = RigAssets;
  window.RigIK = RigIK;
  window.RiggedCharacter = RiggedCharacter;
  window.RigRegistry = RigRegistry;
})();
