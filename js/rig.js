// ============================================================================
// ASHFALL // Rigged 3D Character Pipeline, World-Space 2-Bone IK & Tactical Packs
// Loads tactical_soldier.glb with Idle/Walk/Run/TPose clips, retargets onto
// MW2 proxy rigs for 3P entities, drives RiggedFPArms, and builds unified 3D packs.
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
    _readyCallbacks: [],

    onReady(cb) {
      if (typeof cb !== 'function') return;
      if (this.ready && this.soldier) {
        try { cb(); } catch (e) {}
      } else {
        this._readyCallbacks.push(cb);
      }
    },

    _flushReadyCallbacks() {
      const list = this._readyCallbacks.splice(0, this._readyCallbacks.length);
      for (let i = 0; i < list.length; i++) {
        try { list[i](); } catch (e) {}
      }
    },

    load(onProgress) {
      if (this.ready && this.soldier) return Promise.resolve({ ok: true });
      if (this._loadPromise) return this._loadPromise;
      this._loadPromise = new Promise((resolve) => {
        try {
          if (window.FORCE_LEGACY_RIG === true) {
            this.ready = false;
            this.failed = false;
            this._loadPromise = null;
            resolve({ ok: false, disabled: true });
            return;
          }
          // Clear any stale debug flag from older test sessions so the new tactical_soldier.glb model never gets suppressed!
          if (typeof localStorage !== 'undefined' && localStorage.getItem('ashfall_disable_rig') === '1') {
            try { localStorage.removeItem('ashfall_disable_rig'); } catch (e) {}
          }
          if (!THREE || !THREE.GLTFLoader) {
            console.warn('[RigAssets] THREE.GLTFLoader unavailable; using legacy rigs.');
            this.failed = true;
            this._loadPromise = null;
            resolve({ ok: false });
            return;
          }
        } catch (e) {
          this.failed = true;
          this._loadPromise = null;
          resolve({ ok: false });
          return;
        }

        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (!ok) this._loadPromise = null; // allow future retry if network recovers
          if (ok) this._flushReadyCallbacks();
          resolve({ ok });
        };

        const timer = setTimeout(() => {
          console.warn('[RigAssets] character glb load timed out after 25s.');
          this.failed = true;
          finish(false);
        }, 25000);

        const urls = [
          'assets/models/characters/tactical_soldier.glb?v=259',
          `assets/models/characters/tactical_soldier.glb?v=259&r=${Date.now()}`,
          `assets/models/characters/tactical_soldier.glb?r=${Date.now() + 1}`,
          'assets/models/characters/soldier.glb?v=259'
        ];
        const delays = [0, 450, 1000, 400];

        const tryLoadIdx = (idx) => {
          if (settled) return;
          if (idx >= urls.length) {
            console.warn('[RigAssets] All character glb load attempts failed.');
            this.failed = true;
            finish(false);
            return;
          }
          setTimeout(() => {
            if (settled) return;
            try {
              const loader = new THREE.GLTFLoader();
              loader.load(
                urls[idx],
                (gltf) => {
                  if (settled) return;
                  if (!gltf || !gltf.scene) {
                    tryLoadIdx(idx + 1);
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
                idx === 0 ? (onProgress || undefined) : undefined,
                (err) => {
                  console.warn(`[RigAssets] Attempt ${idx + 1} failed (${urls[idx]}):`, err);
                  tryLoadIdx(idx + 1);
                }
              );
            } catch (err) {
              console.warn(`[RigAssets] GLTFLoader exception on attempt ${idx + 1}:`, err);
              tryLoadIdx(idx + 1);
            }
          }, delays[idx] || 0);
        };

        tryLoadIdx(0);
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
        else if (n.includes('tacticalsoldiermesh') || n.includes('vanguardmesh') || obj.isSkinnedMesh) {
          if (!body || n.includes('tacticalsoldiermesh') || n.includes('vanguardmesh')) body = obj;
        }

        const makeLambert = (orig) => {
          if (!orig) return new THREE.MeshLambertMaterial({ color: 0xffffff, skinning: true });
          if (orig.map) {
            orig.map.magFilter = THREE.NearestFilter;
            orig.map.encoding = THREE.LinearEncoding;
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
        if (obj.geometry) {
          obj.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 95), 250);
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

    solveTwoBone(upper, lower, end, target, pole, bindUpperQ = null, bindLowerQ = null) {
      if (!upper || !lower || !end || !upper.parent) return;
      if (bindUpperQ) upper.quaternion.copy(bindUpperQ);
      if (bindLowerQ) lower.quaternion.copy(bindLowerQ);
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
      const maxD = (lab + lbc) * 0.998;
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

      const ex = _v1.x + dir.x * cosA * lab + pd.x * sinA * lab;
      const ey = _v1.y + dir.y * cosA * lab + pd.y * sinA * lab;
      const ez = _v1.z + dir.z * cosA * lab + pd.z * sinA * lab;

      const fromU = _v2.sub(_v1); // pb - pa
      const toU = _v3.set(ex - _v1.x, ey - _v1.y, ez - _v1.z);
      this.rotateBoneWorld(upper, fromU, toU);

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
        const fLocal = new THREE.Vector3(side === 'left' ? -1 : 1, 0, 0);
        const bLocal = new THREE.Vector3(0, 1, 0);
        const uLocal = new THREE.Vector3().crossVectors(bLocal, fLocal).normalize();
        return { fLocal, uLocal, bLocal };
      }
      handBone.updateMatrixWorld(true);
      const hp = handBone.getWorldPosition(new THREE.Vector3());
      const mp = mid.getWorldPosition(new THREE.Vector3());
      const ip = idx.getWorldPosition(new THREE.Vector3());
      const pp = pnk.getWorldPosition(new THREE.Vector3());
      const hqInv = handBone.getWorldQuaternion(new THREE.Quaternion()).invert();

      const fW = mp.sub(hp).normalize();
      const tRaw = ip.sub(pp);
      const tW = tRaw.addScaledVector(fW, -tRaw.dot(fW)).normalize();
      // Right-hand cross (f x thumbSide) = dorsal back; Left-hand cross (thumbSide x f) = dorsal back
      const bW = (side === 'right'
        ? new THREE.Vector3().crossVectors(fW, tW)
        : new THREE.Vector3().crossVectors(tW, fW)
      ).normalize();
      const fLocal = fW.clone().applyQuaternion(hqInv).normalize();
      const bLocal = bW.clone().applyQuaternion(hqInv).normalize();
      const uLocal = new THREE.Vector3().crossVectors(bLocal, fLocal).normalize();
      bLocal.crossVectors(fLocal, uLocal).normalize();
      return { fLocal, uLocal, bLocal };
    },

    handBasisQuat(hb, fWorld, backWorld, out) {
      const fw = _v1.copy(fWorld).normalize();
      const bw = _v2.copy(backWorld).addScaledVector(fw, -backWorld.dot(fw));
      if (bw.lengthSq() < 1e-6) bw.set(0, 1, 0).addScaledVector(fw, -fw.y);
      if (bw.lengthSq() < 1e-6) bw.set(1, 0, 0);
      bw.normalize();
      const uw = _v3.crossVectors(bw, fw).normalize();
      bw.crossVectors(fw, uw).normalize();

      _m1.makeBasis(fw, uw, bw);
      _m2.makeBasis(hb.fLocal, hb.uLocal, hb.bLocal).transpose();
      _m3.multiplyMatrices(_m1, _m2);
      return (out || new THREE.Quaternion()).setFromRotationMatrix(_m3);
    },

    // Dedicated anatomical twist distributor across Shoulder (humerus hinge) -> Elbow (forearm roll) -> Wrist:
    // Eliminates sideways elbow shear, ±180° atan2 branch-cut flips, and candy-wrapper skin/UV contortion!
    _atShW: new THREE.Vector3(),
    _atElW: new THREE.Vector3(),
    _atPreHdW: new THREE.Vector3(),
    _atHdW: new THREE.Vector3(),
    _atToL: new THREE.Vector3(),
    _atFromL: new THREE.Vector3(),
    _atUpDir: new THREE.Vector3(),
    _atForeDir: new THREE.Vector3(),
    _atOlecW: new THREE.Vector3(),
    _atOcP: new THREE.Vector3(),
    _atOtP: new THREE.Vector3(),
    _atFbW: new THREE.Vector3(),
    _atFbP: new THREE.Vector3(),
    _atHbP: new THREE.Vector3(),
    _atRfP: new THREE.Vector3(),
    _atBwP: new THREE.Vector3(),
    _atCross: new THREE.Vector3(),
    _atPerp: new THREE.Vector3(),
    _atQU: new THREE.Quaternion(),
    _atQL: new THREE.Quaternion(),
    _atQRot: new THREE.Quaternion(),

    alignArmChainTwist(bArm, bFore, bHand, pole, hb, fW, backW, side, isClimbArm = false) {
      if (!bArm || !bFore || !bHand) return;
      bFore.updateMatrixWorld(true);
      bFore.getWorldPosition(this._atElW);
      bHand.getWorldPosition(this._atPreHdW);
      this._atToL.subVectors(this._atPreHdW, this._atElW);

      // 1. Align humerus anatomical olecranon (Mixamo LeftArm +Z, RightArm -Z) toward outer elbow bend plane (pole)
      bArm.getWorldPosition(this._atShW);
      this._atUpDir.subVectors(this._atElW, this._atShW);
      if (this._atUpDir.lengthSq() > 1e-6 && this._atToL.lengthSq() > 1e-6) {
        this._atUpDir.normalize();
        bArm.getWorldQuaternion(this._atQU);
        this._atOlecW.set(0, 0, side === 'left' ? 1 : -1).applyQuaternion(this._atQU);
        this._atOcP.copy(this._atOlecW).addScaledVector(this._atUpDir, -this._atOlecW.dot(this._atUpDir));
        this._atOtP.subVectors(pole, this._atShW);
        this._atOtP.addScaledVector(this._atUpDir, -this._atOtP.dot(this._atUpDir));
        if (this._atOcP.lengthSq() > 1e-5 && this._atOtP.lengthSq() > 1e-5) {
          this._atOcP.normalize();
          this._atOtP.normalize();
          const hSin = this._atCross.crossVectors(this._atOcP, this._atOtP).dot(this._atUpDir);
          const hCos = THREE.MathUtils.clamp(this._atOcP.dot(this._atOtP), -1, 1);
          const hClamped = THREE.MathUtils.clamp(Math.atan2(hSin, hCos), -1.08, 1.08) * 0.82;
          this._atQRot.setFromAxisAngle(this._atUpDir, hClamped);
          this.setWorldQuat(bArm, this._atQRot.multiply(this._atQU));
          bArm.updateMatrixWorld(true);
          bFore.getWorldPosition(this._atElW);
          bHand.getWorldPosition(this._atHdW);
          this._atFromL.subVectors(this._atHdW, this._atElW);
          this.rotateBoneWorld(bFore, this._atFromL, this._atToL);
        }
      }

      // 2. Clamp wrist flexion/extension & distribute clamped pronation/supination across forearm + wrist
      bFore.updateMatrixWorld(true);
      bFore.getWorldPosition(this._atElW);
      bHand.getWorldPosition(this._atHdW);
      this._atForeDir.subVectors(this._atHdW, this._atElW);
      if (this._atForeDir.lengthSq() < 1e-6) return;
      this._atForeDir.normalize();

      if (!isClimbArm) {
        const maxBend = 0.73;
        const dotF = THREE.MathUtils.clamp(fW.dot(this._atForeDir), -1, 1);
        if (Math.acos(dotF) > maxBend) {
          this._atPerp.copy(fW).addScaledVector(this._atForeDir, -dotF);
          if (this._atPerp.lengthSq() > 1e-6) {
            this._atPerp.normalize();
            fW.copy(this._atForeDir).multiplyScalar(Math.cos(maxBend)).addScaledVector(this._atPerp, Math.sin(maxBend)).normalize();
          } else {
            fW.copy(this._atForeDir);
          }
        }
      }

      if (hb) {
        bFore.getWorldQuaternion(this._atQL);
        this._atFbW.copy(hb.bLocal).applyQuaternion(this._atQL);
        this._atFbP.copy(this._atFbW).addScaledVector(this._atForeDir, -this._atFbW.dot(this._atForeDir));
        this._atHbP.copy(backW).addScaledVector(this._atForeDir, -backW.dot(this._atForeDir));
        if (this._atFbP.lengthSq() > 1e-5 && this._atHbP.lengthSq() > 1e-5) {
          this._atFbP.normalize();
          this._atHbP.normalize();
          const rSin = this._atCross.crossVectors(this._atFbP, this._atHbP).dot(this._atForeDir);
          const rCos = THREE.MathUtils.clamp(this._atFbP.dot(this._atHbP), -1, 1);
          const maxRoll = isClimbArm ? 1.42 : 1.45;
          const rClamped = THREE.MathUtils.clamp(Math.atan2(rSin, rCos), -maxRoll, maxRoll) * 0.68;
          this._atQRot.setFromAxisAngle(this._atForeDir, rClamped);
          this.setWorldQuat(bFore, this._atQRot.multiply(this._atQL));
          bFore.updateMatrixWorld(true);
        }

        // 3. Guard residual wrist roll relative to rolled forearm dorsal axis (prevents candy-wrapper wrist; preserve world-locked ledge palm on climbs)
        if (!isClimbArm) {
          bFore.getWorldQuaternion(this._atQL);
          this._atFbW.copy(hb.bLocal).applyQuaternion(this._atQL);
          this._atRfP.copy(this._atFbW).addScaledVector(fW, -this._atFbW.dot(fW));
          this._atBwP.copy(backW).addScaledVector(fW, -backW.dot(fW));
          if (this._atRfP.lengthSq() > 1e-5 && this._atBwP.lengthSq() > 1e-5) {
            this._atRfP.normalize();
            this._atBwP.normalize();
            const wSin = this._atCross.crossVectors(this._atRfP, this._atBwP).dot(fW);
            const wCos = THREE.MathUtils.clamp(this._atRfP.dot(this._atBwP), -1, 1);
            const wAng = Math.atan2(wSin, wCos);
            const maxWristTwist = 1.38;
            if (Math.abs(wAng) > maxWristTwist) {
              this._atQRot.setFromAxisAngle(fW, THREE.MathUtils.clamp(wAng, -maxWristTwist, maxWristTwist));
              backW.copy(this._atRfP).applyQuaternion(this._atQRot).normalize();
            }
          }
        }
      }
    },

    buildFingerCurl(B, side) {
      const handBone = B[side + 'hand'];
      const mid = B[side + 'handmiddle1'];
      const idx = B[side + 'handindex1'];
      const pnk = B[side + 'handpinky1'];
      const entries = [];
      if (!handBone || !mid || !idx || !pnk) return entries;

      handBone.updateMatrixWorld(true);
      const hp = handBone.getWorldPosition(new THREE.Vector3());
      const mp = mid.getWorldPosition(new THREE.Vector3());
      const ip = idx.getWorldPosition(new THREE.Vector3());
      const pp = pnk.getWorldPosition(new THREE.Vector3());

      const fW = mp.sub(hp).normalize();
      const tRaw = ip.sub(pp);
      const iW = tRaw.addScaledVector(fW, -tRaw.dot(fW)).normalize();
      const palm = new THREE.Vector3().crossVectors(fW, iW).normalize();
      if (side === 'right') palm.multiplyScalar(-1);

      const fingers = ['index', 'middle', 'ring', 'pinky', 'thumb'];
      for (const fName of fingers) {
        let lastDir = null;
        for (let j = 1; j <= 3; j++) {
          const bone = B[side + 'hand' + fName + j];
          if (!bone) continue;
          const child = B[side + 'hand' + fName + (j + 1)];
          let boneDir = null;
          if (child) {
            const bp = bone.getWorldPosition(new THREE.Vector3());
            const cp = child.getWorldPosition(new THREE.Vector3());
            const d = cp.sub(bp);
            if (d.lengthSq() >= 1e-8) {
              boneDir = d.normalize();
              lastDir = boneDir;
            }
          } else if (lastDir) {
            boneDir = lastDir.clone();
          }
          if (!boneDir) continue;
          let targetFold = palm;
          if (fName === 'thumb') {
            // Verified anatomical opposable thumb curl:
            //  j=1 (CMC): swings thumb forward-palmar & inward in front of index knuckle
            //  j=2,3 (MCP/IP): clamps thumb tightly ACROSS the curled index/middle fingers (never drooping downward!)
            if (j === 1) {
              targetFold = fW.clone().multiplyScalar(0.32)
                .addScaledVector(palm, 0.58)
                .addScaledVector(iW, -0.74)
                .normalize();
            } else {
              targetFold = fW.clone().multiplyScalar(-0.15)
                .addScaledVector(palm, 0.22)
                .addScaledVector(iW, -0.96)
                .normalize();
            }
          }
          const axisWorld = new THREE.Vector3().crossVectors(boneDir, targetFold);
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
      const tAngles = [thumb * 0.85, thumb * 0.72, thumb * 0.45];
      const isFist = angles[0] >= 1.42;
      for (let i = 0; i < curlData.length; i++) {
        const e = curlData[i];
        const arr = e.finger === 'thumb' ? tAngles : angles;
        let ang = arr[e.joint - 1] || 0;
        // Subtle anatomical finger cascade on non-fist grips (ring/pinky wrap slightly snugger than index)
        if (!isFist && e.finger !== 'thumb') {
          if (e.finger === 'ring') ang *= 1.05;
          else if (e.finger === 'pinky') ang *= 1.10;
        }
        _q1.setFromAxisAngle(e.axisLocal, ang);
        e.bone.quaternion.copy(e.bindLocal).multiply(_q1);
      }
    }
  };

  // ============================================================================
  // UNIFIED SCULPTED 3D TACTICAL BACKPACK BUILDER (v2.44)
  // Shared between Worn Operator Rigs (3P), Legacy Rigs, and Inventory Icons!
  // Coordinate frame: +Y Up, +Z Outward back face, z = 0 flush against rear vest.
  // ============================================================================
  function buildTacticalBackpackMesh(bagId = 'bag_medium', opts = {}) {
    const id = String(bagId || 'bag_medium');
    const isWpn = id === 'bag_weapon' || id.includes('weapon');
    const isLarge = id === 'bag_large' || id.includes('large') || id.includes('scav');
    const isSmall = id === 'bag_small' || id.includes('small');
    const isMed = !isWpn && !isLarge && !isSmall;
    const forIcon = !!opts.forIcon;

    const g = new THREE.Group();
    g.userData.bagId = id;

    const mkMat = (color, spec = 0x000000, shine = 18) => (
      forIcon
        ? new THREE.MeshPhongMaterial({ color, specular: spec, shininess: shine })
        : new THREE.MeshLambertMaterial({ color })
    );

    const mkRoundedRectShape = (w, h, r) => {
      const hw = w * 0.5;
      const hh = h * 0.5;
      const rr = Math.min(r, hw * 0.45, hh * 0.45);
      const s = new THREE.Shape();
      s.moveTo(-hw + rr, -hh);
      s.lineTo(hw - rr, -hh);
      s.quadraticCurveTo(hw, -hh, hw, -hh + rr);
      s.lineTo(hw, hh - rr);
      s.quadraticCurveTo(hw, hh, hw - rr, hh);
      s.lineTo(-hw + rr, hh);
      s.quadraticCurveTo(-hw, hh, -hw, hh - rr);
      s.lineTo(-hw, -hh + rr);
      s.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
      return s;
    };

    const mkChamferedShell = (w, h, depth, r, bevel, mat) => {
      const bev = Math.min(bevel, depth * 0.32, w * 0.14, h * 0.14);
      const innerD = Math.max(0.008, depth - bev * 2);
      const geo = new THREE.ExtrudeGeometry(mkRoundedRectShape(w - bev * 2, h - bev * 2, r), {
        depth: innerD,
        bevelEnabled: bev > 0.001,
        bevelThickness: bev,
        bevelSize: bev,
        bevelSegments: 2
      });
      geo.translate(0, 0, bev); // z = 0..depth so back face sits flush at z = 0!
      return new THREE.Mesh(geo, mat);
    };

    // Palette synced to UI reference icons & tactical soldier Cordura
    const mainCol = isWpn ? 0x414b57 : (isLarge ? 0x8d7b59 : (isMed ? 0x87917e : 0x5d6653));
    const darkCol = isWpn ? 0x222830 : 0x2e342f;
    const strapCol = isWpn ? 0x1b2026 : 0x242825;
    const hardwareCol = 0x171a1c;
    const accentCol = 0xe89424;

    const mMain = mkMat(mainCol, 0x222628, 22);
    const mDark = mkMat(darkCol, 0x181c1e, 26);
    const mStrap = mkMat(strapCol, 0x16181a, 24);
    const mMetal = mkMat(0x525a62, 0x6c757d, 48);
    const mPad = mkMat(hardwareCol, 0x121416, 14);
    const mAccent = mkMat(accentCol, 0x5c3600, 40);

    const packW = isWpn ? 0.34 : (isLarge ? 0.36 : (isMed ? 0.32 : 0.27));
    const packH = isWpn ? 0.48 : (isLarge ? 0.48 : (isMed ? 0.43 : 0.37));
    const packD = isWpn ? 0.14 : (isLarge ? 0.16 : (isMed ? 0.135 : 0.11));

    // Breathable spine back-pad at z = 0
    const backPad = mkChamferedShell(packW * 0.94, packH * 0.94, 0.022, 0.03, 0.006, mPad);
    g.add(backPad);

    // Main sculpted contoured rucksack shell
    const body = mkChamferedShell(packW, packH, packD, 0.045, 0.016, mMain);
    body.position.z = 0.008;
    g.add(body);

    // Sculpted upper hood / rain-flap lid
    const hood = mkChamferedShell(packW * 0.96, packH * 0.24, packD * 0.94, 0.035, 0.014, isWpn ? mDark : mStrap);
    hood.position.set(0, packH * 0.36, 0.016);
    g.add(hood);

    // Top paracord grab handle
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(packW * 0.16, 0.013, 6, 12, Math.PI),
      mStrap
    );
    handle.position.set(0, packH * 0.48, packD * 0.52);
    g.add(handle);

    if (isWpn) {
      // Weapon Backpack: Armored Tech Carrier (matches DMZ screenshot dark armored shell + amber rail strip!)
      const armorShell = mkChamferedShell(packW * 0.78, packH * 0.58, 0.038, 0.03, 0.012, mDark);
      armorShell.position.set(0, -packH * 0.04, packD + 0.002);
      g.add(armorShell);

      // Center locking latch spine + metallic clasp
      const spineBar = mkChamferedShell(0.055, packH * 0.46, 0.018, 0.008, 0.004, mStrap);
      spineBar.position.set(0, -packH * 0.03, packD + 0.032);
      const clasp = mkChamferedShell(0.068, 0.052, 0.020, 0.006, 0.004, mMetal);
      clasp.position.set(0, packH * 0.10, packD + 0.036);
      g.add(spineBar, clasp);

      // Twin vertical reinforced frame rails + buckles
      for (const sx of [-packW * 0.30, packW * 0.30]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.032, packH * 0.86, 0.022), mPad);
        rail.position.set(sx, -0.01, packD + 0.006);
        const bkl = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.026, 0.026), mMetal);
        bkl.position.set(sx, packH * 0.14, packD + 0.014);
        g.add(rail, bkl);
      }

      // Weapon scabbard side tube & signature amber tactical ID tag
      const scabbard = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, packH * 0.78, 10), mPad);
      scabbard.position.set(packW * 0.50, -0.02, packD * 0.56);
      const clampU = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.026, 0.072), mMetal);
      clampU.position.set(packW * 0.48, packH * 0.18, packD * 0.56);
      const clampL = clampU.clone();
      clampL.position.y = -packH * 0.20;
      const badge = mkChamferedShell(0.14, 0.034, 0.014, 0.004, 0.003, mAccent);
      badge.position.set(0, packH * 0.29, packD + 0.022);
      g.add(scabbard, clampU, clampL, badge);
    } else {
      // Tactical Assault / Expedition Rucksack (Small / Medium / Large)
      // Lower contoured MOLLE kangaroo pocket
      const pocketH = isSmall ? packH * 0.38 : packH * 0.42;
      const pocketD = isSmall ? 0.040 : 0.056;
      const pocket = mkChamferedShell(packW * 0.76, pocketH, pocketD, 0.028, 0.010, isMed ? mMain : mDark);
      pocket.position.set(0, -packH * 0.18, packD + 0.002);
      g.add(pocket);

      // PALS horizontal MOLLE webbing strips across front pouch
      const rowCount = isSmall ? 2 : 3;
      for (let r = 0; r < rowCount; r++) {
        const ry = (-packH * 0.28) + r * 0.044;
        const slat = new THREE.Mesh(new THREE.BoxGeometry(packW * 0.66, 0.016, 0.010), mStrap);
        slat.position.set(0, ry, packD + pocketD + 0.001);
        g.add(slat);
      }

      // Twin vertical compression straps + quick-release buckles (matches DMZ screenshot!)
      const strapSpan = packW * 0.27;
      for (const sx of [-strapSpan, strapSpan]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.028, packH * 0.88, 0.016), mStrap);
        strap.position.set(sx, -0.01, packD + 0.012);
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.028, 0.022), mPad);
        buckle.position.set(sx, packH * 0.16, packD + 0.020);
        g.add(strap, buckle);
      }

      // Velcro ID strip on hood
      const velcro = new THREE.Mesh(new THREE.BoxGeometry(packW * 0.46, 0.036, 0.012), mPad);
      velcro.position.set(0, packH * 0.34, packD + 0.014);
      g.add(velcro);

      if (isMed || isLarge) {
        // Side compression & utility pouches
        const sideW = isLarge ? 0.072 : 0.044;
        const sideH = isLarge ? packH * 0.56 : packH * 0.44;
        for (const sign of [-1, 1]) {
          const sp = mkChamferedShell(sideW, sideH, packD * 0.72, 0.018, 0.007, mDark);
          sp.position.set(sign * (packW * 0.50 + sideW * 0.34), -packH * 0.08, packD * 0.16);
          g.add(sp);
        }
      }

      if (isLarge) {
        // Expedition bedroll cylinder lashed to top crown + reinforced hip belt fins
        const bedroll = new THREE.Mesh(
          new THREE.CylinderGeometry(0.048, 0.048, packW * 0.92, 12),
          mDark
        );
        bedroll.rotation.z = Math.PI / 2;
        bedroll.position.set(0, packH * 0.52, packD * 0.44);
        g.add(bedroll);
      }
    }

    // Worn shoulder-strap harness loops arching gently onto rear plate carrier (-Z)
    if (!forIcon) {
      for (const sx of [-packW * 0.28, packW * 0.28]) {
        const harness = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.09, 0.05), mStrap);
        harness.position.set(sx, packH * 0.38, -0.016);
        g.add(harness);
      }
    }

    return g;
  }

  const ARCHETYPE_TINTS = {
    operator: 0xffffff,
    scavenger: 0xd8c8a8,
    raider: 0xc8c0a6,
    heavy: 0x90969e,
    boss: 0x8a8f96,
    boss_guard: 0x969aa2
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

      // Calibrate bind-pose boot orientation (removing Mixamo's ~9.3° outward toe splay so FP slide-foot aligns dead-upright)
      const calcFootBootCorr = (footBone, toeBone) => {
        if (!footBone) return new THREE.Quaternion();
        const fPos = footBone.getWorldPosition(new THREE.Vector3());
        const tPos = toeBone
          ? toeBone.getWorldPosition(new THREE.Vector3())
          : fPos.clone().add(new THREE.Vector3(0, 0, -0.15));
        const rootQ0 = rig.root.getWorldQuaternion(new THREE.Quaternion());
        const uRest = new THREE.Vector3(0, 1, 0).applyQuaternion(rootQ0).normalize();
        const fwdRest = tPos.clone().sub(fPos);
        fwdRest.addScaledVector(uRest, -fwdRest.dot(uRest));
        if (fwdRest.lengthSq() < 1e-6) {
          fwdRest.set(0, 0, -1).applyQuaternion(rootQ0);
        }
        fwdRest.normalize();
        const bRest = fwdRest.clone().negate();
        const rRest = new THREE.Vector3().crossVectors(uRest, bRest).normalize();
        const uOrtho = new THREE.Vector3().crossVectors(bRest, rRest).normalize();
        const basisM = new THREE.Matrix4().makeBasis(rRest, uOrtho, bRest);
        const qBasis = new THREE.Quaternion().setFromRotationMatrix(basisM);
        return qBasis.invert().multiply(footBone.getWorldQuaternion(new THREE.Quaternion()));
      };
      this.footBootCorr = {
        left: calcFootBootCorr(B.leftfoot, B.lefttoebase),
        right: calcFootBootCorr(B.rightfoot, B.righttoebase)
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
      this.bindLocal = {
        leftarm: B.leftarm ? B.leftarm.quaternion.clone() : null,
        leftforearm: B.leftforearm ? B.leftforearm.quaternion.clone() : null,
        rightarm: B.rightarm ? B.rightarm.quaternion.clone() : null,
        rightforearm: B.rightforearm ? B.rightforearm.quaternion.clone() : null,
        leftupleg: B.leftupleg ? B.leftupleg.quaternion.clone() : null,
        leftleg: B.leftleg ? B.leftleg.quaternion.clone() : null,
        rightupleg: B.rightupleg ? B.rightupleg.quaternion.clone() : null,
        rightleg: B.rightleg ? B.rightleg.quaternion.clone() : null
      };
      this.bindBonePos = {
        leftforearm: B.leftforearm ? B.leftforearm.position.clone() : null,
        lefthand: B.lefthand ? B.lefthand.position.clone() : null,
        rightforearm: B.rightforearm ? B.rightforearm.position.clone() : null,
        righthand: B.righthand ? B.righthand.position.clone() : null
      };
      B.rightarm.updateMatrixWorld(true);
      const _pA3 = B.rightarm.getWorldPosition(new THREE.Vector3());
      const _pF3 = B.rightforearm.getWorldPosition(new THREE.Vector3());
      const _pH3 = B.righthand.getWorldPosition(new THREE.Vector3());
      this.armReach3P = Math.max(0.25, _pA3.distanceTo(_pF3) + _pF3.distanceTo(_pH3));

      // Mount sculpted 3D backpack flush on Spine2 rear SAPI plate
      this.backpackMount = null;
      this.backpackMesh = null;
      this._bagId = null;
      if (B.spine2) {
        B.spine2.updateMatrixWorld(true);
        const spQ = B.spine2.getWorldQuaternion(new THREE.Quaternion());
        const spS = B.spine2.getWorldScale(new THREE.Vector3());
        const rootQ = rig.root.getWorldQuaternion(new THREE.Quaternion());
        const mountW = rig.root.localToWorld(new THREE.Vector3(0, 1.32, 0.198));
        this.backpackMount = new THREE.Group();
        B.spine2.add(this.backpackMount);
        this.backpackMount.position.copy(B.spine2.worldToLocal(mountW));
        this.backpackMount.quaternion.copy(spQ.clone().invert().multiply(rootQ));
        this.backpackMount.scale.set(
          1 / Math.max(1e-4, spS.x),
          1 / Math.max(1e-4, spS.y),
          1 / Math.max(1e-4, spS.z)
        );
        this.setBackpack(opts.bagId !== undefined ? opts.bagId : 'bag_medium');
      }

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

      // Hide proxy geometry via hiddenMaterial while keeping hitboxes/weapon/props intact
      this._hiddenMeshes = [];
      const skipRoots = new Set([
        this.wrapper,
        rig.weaponPivot,
        rig.plateProp,
        rig.handMag,
        rig.handShell,
        rig.inventoryTablet,
        rig.syringeProp,
        rig.grenadeProp
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
      this.fpBodyMode = false;
      this._fpMaskReady = false;
      this._uFpBodyMode = { value: 0.0 };
      this._uFpBodyFovScale = { value: 0.76 };

      RigRegistry.add(this);
    }

    setFirstPersonBodyMode(enabled) {
      const want = !!enabled;
      if (want === this.fpBodyMode && (!want || this._fpMaskReady)) return;
      this.fpBodyMode = want;
      this._uFpBodyMode.value = want ? 1.0 : 0.0;
      if (this.visor) this.visor.visible = !want;
      if (this.backpackMount) this.backpackMount.visible = !want;

      if (want && !this._fpMaskReady && this.body && this.body.geometry && this.body.skeleton) {
        this._fpMaskReady = true;
        const geom = this.body.geometry.clone();
        geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 95), 250);
        this.body.geometry = geom;
        const skinIdx = geom.attributes.skinIndex;
        const skinWt = geom.attributes.skinWeight;
        const skBones = this.body.skeleton.bones || [];
        const isHiddenBone = skBones.map((b) => {
          const bn = normName(b.name);
          return bn.includes('head') || bn.includes('neck') || bn.includes('shoulder') ||
            bn.includes('arm') || bn.includes('forearm') || bn.includes('hand');
        });
        const vCount = skinIdx.count;
        const idxArr = skinIdx.array;
        const wtArr = skinWt.array;
        const idxStride = skinIdx.itemSize || 4;
        const wtStride = skinWt.itemSize || 4;
        const fpMaskArr = new Float32Array(vCount);
        for (let i = 0; i < vCount; i++) {
          let hSum = 0;
          const iBase = i * idxStride;
          const wBase = i * wtStride;
          for (let k = 0; k < 4; k++) {
            const bi = idxArr[iBase + k] | 0;
            if (isHiddenBone[bi]) hSum += wtArr[wBase + k];
          }
          // Hide head, neck, shoulders & arms (rendered on viewmodel layer), keeping full torso/vest & legs visible when looking down!
          fpMaskArr[i] = (hSum > 0.38) ? 1.0 : 0.0;
        }
        geom.setAttribute('fpMask', new THREE.BufferAttribute(fpMaskArr, 1));

        const origMat = Array.isArray(this.body.material) ? this.body.material[0] : this.body.material;
        const fpBodyMat = origMat ? origMat.clone() : new THREE.MeshLambertMaterial({ color: 0xffffff, skinning: true });
        fpBodyMat.onBeforeCompile = (shader) => {
          shader.uniforms.uFpBodyMode = this._uFpBodyMode;
          shader.vertexShader = 'attribute float fpMask;\nvarying float vFpMask;\nvarying float vFpEyeDist;\n' +
            shader.vertexShader
              .replace('#include <begin_vertex>', 'vFpMask = fpMask;\n#include <begin_vertex>')
              .replace(
                '#include <project_vertex>',
                '#include <project_vertex>\nvFpEyeDist = length(mvPosition.xyz);'
              );
          shader.fragmentShader = 'uniform float uFpBodyMode;\nvarying float vFpMask;\nvarying float vFpEyeDist;\n' +
            shader.fragmentShader.replace(
              '#include <clipping_planes_fragment>',
              'if (uFpBodyMode > 0.5 && (vFpMask > 0.5 || vFpEyeDist < 0.19)) discard;\n#include <clipping_planes_fragment>'
            );
        };
        fpBodyMat.customProgramCacheKey = () => 'ashfall_fp_body_mask_v4';
        fpBodyMat.needsUpdate = true;
        this.body.material = fpBodyMat;
      }
    }

    setBackpack(bagId) {
      if (!this.backpackMount) return;
      const normId = (bagId && bagId !== 'none') ? String(bagId) : '';
      if (normId === this._bagId) return;
      this._bagId = normId;
      if (this.backpackMesh) {
        this.backpackMount.remove(this.backpackMesh);
        this.backpackMesh = null;
      }
      if (normId) {
        const mesh = buildTacticalBackpackMesh(normId, { forIcon: false });
        this.backpackMount.add(mesh);
        this.backpackMesh = mesh;
      }
      this.backpackMount.visible = !this.fpBodyMode;
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

      // 1. Update Mixamo locomotion blend weights (freeze & disable mocap immediately when dead so ragdoll drives every bone)
      if (s.dead) {
        this.mocapW = 0;
        if (r._ragdollPose) {
          const rp = r._ragdollPose;
          r.root.updateMatrixWorld(true);
          this.wrapper.updateMatrixWorld(true);

          RigIK.setWorldQuat(B.hips, rp.pelvisQ.clone().multiply(this.corr.hips));
          if (B.hips.parent) {
            B.hips.parent.updateWorldMatrix(true, false);
            B.hips.position.copy(B.hips.parent.worldToLocal(rp.pelvis.clone()));
          }
          B.hips.updateMatrixWorld(true);

          const qSpW = rp.pelvisQ.clone().slerp(rp.chestQ, 0.45).multiply(this.corr.spine);
          const qTorW = rp.chestQ.clone().multiply(this.corr.spine2);
          if (B.spine) { RigIK.setWorldQuat(B.spine, qSpW); B.spine.updateMatrixWorld(true); }
          if (B.spine1) { RigIK.setWorldQuat(B.spine1, this._slerpQ.copy(qSpW).slerp(qTorW, 0.5)); B.spine1.updateMatrixWorld(true); }
          if (B.spine2) { RigIK.setWorldQuat(B.spine2, qTorW); B.spine2.updateMatrixWorld(true); }
          if (B.neck) { RigIK.setWorldQuat(B.neck, rp.chestQ.clone().slerp(rp.headQ, 0.4).multiply(this.corr.neck)); B.neck.updateMatrixWorld(true); }
          if (B.head) { RigIK.setWorldQuat(B.head, rp.headQ.clone().multiply(this.corr.head)); B.head.updateMatrixWorld(true); }

          const solveRagLeg = (side, kneeW, footW) => {
            const bUp = B[side + 'upleg'];
            const bLeg = B[side + 'leg'];
            const bFoot = B[side + 'foot'];
            if (!bUp || !bLeg || !bFoot || !kneeW || !footW) return;
            RigIK.solveTwoBone(
              bUp, bLeg, bFoot, footW, kneeW,
              this.bindLocal && this.bindLocal[side + 'upleg'],
              this.bindLocal && this.bindLocal[side + 'leg']
            );
          };
          solveRagLeg('left', rp.lKnee, rp.lFoot);
          solveRagLeg('right', rp.rKnee, rp.rFoot);

          const solveRagArm = (side, elbowW, handW) => {
            const bUp = B[side + 'arm'];
            const bLow = B[side + 'forearm'];
            const bHand = B[side + 'hand'];
            if (!bUp || !bLow || !bHand || !elbowW || !handW) return;
            RigIK.solveTwoBone(
              bUp, bLow, bHand, handW, elbowW,
              this.bindLocal && this.bindLocal[side + 'arm'],
              this.bindLocal && this.bindLocal[side + 'forearm']
            );
            RigIK.applyFingerCurl(this.fingerCurls[side], [0.35, 0.40, 0.28], 0.25);
          };
          solveRagArm('left', rp.lElbow, rp.lHand);
          solveRagArm('right', rp.rElbow, rp.rHand);

          this.model.updateMatrixWorld(true);
          return;
        }
      } else {
        // Pure procedural momentum-based locomotion driven 100% by MW2Animator (Start / Walk / Run / Tac-Sprint / Hard-Stop / Bank / Land)
        this.mocapW = 0;
      }
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

      // 5. Hips: proxy pelvis orientation blended with mocap, + coherent world-yaw FP slide torso & v2.58 lead-leg placement!
      const fpSlide = (this.fpBodyMode && r._fpSlideState && r._fpSlideState.eyePos && r._fpSlideState.blend > 0.005)
        ? r._fpSlideState
        : null;
      const fpSlideBlend = fpSlide ? THREE.MathUtils.clamp(fpSlide.blend, 0, 1) : 0;
      let fpGroundOrigin = null;
      let fpYawQ = null;
      if (fpSlide) {
        fpGroundOrigin = new THREE.Vector3(fpSlide.eyePos.x, fpSlide.feetY || 0, fpSlide.eyePos.z);
        fpYawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), fpSlide.yaw || 0);
      }
      const toSlideGroundW = (lx, ly, lz) => fpGroundOrigin.clone().add(new THREE.Vector3(lx, ly, lz).applyQuaternion(fpYawQ));

      const pelWQ = r.pelvis.getWorldQuaternion(new THREE.Quaternion());
      if (fpSlideBlend > 0.005 && fpYawQ) {
        // Recline pelvis backward (+0.58 rad around +X) facing exact player yaw (NO +Math.PI flip!) so hip sockets & spine stay 100% aligned!
        const slidePelProxyQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.58, fpSlide.yaw || 0, -0.04, 'YXZ'));
        pelWQ.slerp(slidePelProxyQ, fpSlideBlend);
      }
      RigIK.setWorldQuat(B.hips, pelWQ.clone().multiply(this.corr.hips));
      if (mw > 0.001) B.hips.quaternion.slerp(sv.hipsQuat, mw);

      const targetHipsW = r.pelvis.localToWorld(this.hipsOffsetLocal.clone());
      targetHipsW.addScaledVector(this._rootUp, (mocapHipsHeight - this.hipsBindHeight) * mw);
      if (fpSlideBlend > 0.005 && fpGroundOrigin && fpYawQ) {
        const slideHipsW = toSlideGroundW(0.04, 0.30, 0.02);
        targetHipsW.lerp(slideHipsW, fpSlideBlend);
      }
      if (B.hips.parent) {
        B.hips.parent.updateWorldMatrix(true, false);
        B.hips.position.copy(B.hips.parent.worldToLocal(targetHipsW));
      }
      B.hips.updateMatrixWorld(true);

      // 6. Spine -> Spine1 -> Spine2 -> Neck -> Head (reclined coherently behind camera eye during 1P slide!)
      let qSpW = null;
      let qTorW = null;
      if (B.spine && r.spine) {
        qSpW = r.spine.getWorldQuaternion(new THREE.Quaternion()).multiply(this.corr.spine);
        if (fpSlideBlend > 0.005 && fpYawQ) {
          const slideSpQ = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(0.64, fpSlide.yaw || 0, -0.03, 'YXZ'))
            .multiply(this.corr.spine);
          qSpW.slerp(slideSpQ, fpSlideBlend);
        }
        RigIK.setWorldQuat(B.spine, qSpW);
        B.spine.updateMatrixWorld(true);
      }
      if (r.torso) {
        qTorW = r.torso.getWorldQuaternion(new THREE.Quaternion()).multiply(this.corr.spine2);
        if (fpSlideBlend > 0.005 && fpYawQ) {
          const slideTorQ = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(0.72, fpSlide.yaw || 0, -0.02, 'YXZ'))
            .multiply(this.corr.spine2);
          qTorW.slerp(slideTorQ, fpSlideBlend);
        }
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

      // 7. Legs: 2-bone IK from proxy hip/knee/ankle, blended toward anatomical v2.58 FP slide pose when sliding in 1P!
      this._proxyFwd.set(0, 0, -1).applyQuaternion(pelWQ).normalize();
      const solveLeg = (side) => {
        const legProxy = side === 'left' ? r.leftLeg : r.rightLeg;
        const bUp = B[side + 'upleg'];
        const bLeg = B[side + 'leg'];
        const bFoot = B[side + 'foot'];
        if (!legProxy || !bUp || !bLeg || !bFoot) return;

        const ankleW = legProxy.ankle.getWorldPosition(new THREE.Vector3());
        const kneeW = legProxy.knee.getWorldPosition(new THREE.Vector3());
        const pole = kneeW.clone().addScaledVector(this._proxyFwd, 0.4);

        let slideBootQ = null;
        if (fpSlideBlend > 0.005 && fpGroundOrigin && fpYawQ) {
          const vib = Math.sin(performance.now() * 0.036) * 0.007 * fpSlideBlend;
          if (side === 'left') {
            // Lead left slide leg: extended straight forward in lower-center-left frame, knee pointing straight UP!
            const slideAnkleW = toSlideGroundW(-0.055, 0.34 + vib, -0.79);
            const slidePoleW = toSlideGroundW(-0.056, 0.88, -0.38);
            ankleW.lerp(slideAnkleW, fpSlideBlend);
            pole.lerp(slidePoleW, fpSlideBlend);

            // Upright combat boot matching v2.58 boot.rotation.x = 0.25 (toes pointing straight UP, zero outward splay!)
            const toeDirW = new THREE.Vector3(0.01, Math.cos(0.24), Math.sin(0.24)).normalize().applyQuaternion(fpYawQ);
            const rightDirW = new THREE.Vector3(1, -0.02, 0).normalize().applyQuaternion(fpYawQ);
            const bBoot = toeDirW.clone().negate().normalize();
            const uBoot = new THREE.Vector3().crossVectors(bBoot, rightDirW).normalize();
            const rOrtho = new THREE.Vector3().crossVectors(uBoot, bBoot).normalize();
            slideBootQ = new THREE.Quaternion()
              .setFromRotationMatrix(new THREE.Matrix4().makeBasis(rOrtho, uBoot, bBoot))
              .multiply((this.footBootCorr && this.footBootCorr.left) || this.corr.leftfoot);
          } else {
            // Anatomical hurdler/baseball slide trailing right leg: thigh angled forward-right, knee bent naturally with heel tucked under!
            const tuckAnkleW = toSlideGroundW(0.18, 0.16, 0.14);
            const tuckPoleW = toSlideGroundW(0.48, 0.17, -0.44);
            ankleW.lerp(tuckAnkleW, fpSlideBlend);
            pole.lerp(tuckPoleW, fpSlideBlend);

            const rToeDirW = new THREE.Vector3(0.76, -0.12, -0.64).normalize().applyQuaternion(fpYawQ);
            const rUpDirW = new THREE.Vector3(-0.35, 0.86, -0.36).normalize().applyQuaternion(fpYawQ);
            const bBootR = rToeDirW.clone().negate().normalize();
            const rOrthoR = new THREE.Vector3().crossVectors(rUpDirW, bBootR).normalize();
            const uBootR = new THREE.Vector3().crossVectors(bBootR, rOrthoR).normalize();
            slideBootQ = new THREE.Quaternion()
              .setFromRotationMatrix(new THREE.Matrix4().makeBasis(rOrthoR, uBootR, bBootR))
              .multiply((this.footBootCorr && this.footBootCorr.right) || this.corr.rightfoot);
          }
        }

        RigIK.solveTwoBone(
          bUp, bLeg, bFoot, ankleW, pole,
          this.bindLocal && this.bindLocal[side + 'upleg'],
          this.bindLocal && this.bindLocal[side + 'leg']
        );

        const ankQ = legProxy.ankle.getWorldQuaternion(new THREE.Quaternion()).multiply(this.corr[side + 'foot']);
        if (slideBootQ) {
          ankQ.slerp(slideBootQ, fpSlideBlend);
        }
        RigIK.setWorldQuat(bFoot, ankQ);

        if (mw > 0.001 && fpSlideBlend < 0.01) {
          bUp.quaternion.slerp(sv[side + 'upleg'], mw);
          bLeg.quaternion.slerp(sv[side + 'leg'], mw);
          bFoot.quaternion.slerp(sv[side + 'foot'], mw);
          bUp.updateMatrixWorld(true);
        }
      };
      solveLeg('left');
      solveLeg('right');

      // 8. Arms: stateless 2-bone IK from proxy shoulder/elbow/wrist + world-locked ledge override + twist-aligned chain
      const solveArm = (side) => {
        const armProxy = side === 'left' ? r.leftArm : r.rightArm;
        const bUp = B[side + 'arm'];
        const bLow = B[side + 'forearm'];
        const bHand = B[side + 'hand'];
        if (!armProxy || !bUp || !bLow || !bHand) return;

        if (this.bindBonePos) {
          if (this.bindBonePos[side + 'forearm']) bLow.position.copy(this.bindBonePos[side + 'forearm']);
          if (this.bindBonePos[side + 'hand']) bHand.position.copy(this.bindBonePos[side + 'hand']);
        }

        const shW = armProxy.shoulder.getWorldPosition(new THREE.Vector3());
        const elW = armProxy.elbow.getWorldPosition(new THREE.Vector3());
        const wrW = armProxy.wrist.getWorldPosition(new THREE.Vector3());
        const mid = shW.clone().add(wrW).multiplyScalar(0.5);
        const out = elW.clone().sub(mid);
        if (out.lengthSq() < 1e-6) {
          out.set(side === 'left' ? -0.4 : 0.4, -0.3, 0.4);
        }
        const pole = elW.clone().add(out);

        const wrQ = armProxy.wrist.getWorldQuaternion(new THREE.Quaternion());
        const fW = new THREE.Vector3(0, -1, 0).applyQuaternion(wrQ).normalize();
        const backLocal = side === 'right'
          ? new THREE.Vector3(0.75, 0, 0.65)
          : new THREE.Vector3(-0.35, 0, 0.94);
        const backW = backLocal.applyQuaternion(wrQ).normalize();

        const cw = r._climbWorldHands && r._climbWorldHands[side];
        const cb = cw ? THREE.MathUtils.clamp(cw.blend || 0, 0, 1) : 0;
        if (cb > 0.001) {
          fW.lerp(cw.fWorld, cb).normalize();
          backW.lerp(cw.backWorld, cb).normalize();
          const climbWristW = cw.palmWorld.clone().addScaledVector(cw.fWorld, -0.047);
          wrW.lerp(climbWristW, cb);
          bUp.parent.updateWorldMatrix(true, false);
          bUp.updateMatrixWorld(true);
          const sh3PW = bUp.getWorldPosition(new THREE.Vector3());
          const climbPoleW = sh3PW.clone().add(cw.poleOffsetWorld);
          pole.lerp(climbPoleW, cb);
          const live3PDist = wrW.distanceTo(sh3PW);
          const reach3P = (this.armReach3P || 0.56) * 0.95;
          if (live3PDist > reach3P) {
            const segScale3P = live3PDist / reach3P;
            bLow.position.multiplyScalar(segScale3P);
            bHand.position.multiplyScalar(segScale3P);
          }
        }

        RigIK.solveTwoBone(
          bUp, bLow, bHand, wrW, pole,
          this.bindLocal && this.bindLocal[side + 'arm'],
          this.bindLocal && this.bindLocal[side + 'forearm']
        );

        RigIK.alignArmChainTwist(bUp, bLow, bHand, pole, this.handBasis[side], fW, backW, side, cb > 0.25);

        const handQ = RigIK.handBasisQuat(this.handBasis[side], fW, backW, _q3);
        RigIK.setWorldQuat(bHand, handQ);

        if (s.dead || s.isDowned) {
          RigIK.applyFingerCurl(this.fingerCurls[side], [0.25, 0.25, 0.2], 0.2);
        } else if (cb > 0.25 && cw.curl) {
          RigIK.applyFingerCurl(this.fingerCurls[side], cw.curl, cw.thumb !== undefined ? cw.thumb : 0.45);
        } else if (s.isTacSprinting && side === 'left') {
          RigIK.applyFingerCurl(this.fingerCurls[side], [1.56, 1.78, 1.12], 1.0);
        } else {
          const adsTight = s.isADS ? 0.06 : 0;
          RigIK.applyFingerCurl(this.fingerCurls[side], [0.98 + adsTight, 1.08 + adsTight, 0.68 + adsTight], 0.60);
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

  // ==================== FIRST-PERSON RIGGED ARMS (v2.50 MW19/DMZ) ====================
  const FP_HAND_STYLES = {
    grip:            { f: new THREE.Vector3(-0.22, -0.08, -0.97), back: new THREE.Vector3( 0.97,  0.08, -0.22), palmOffset: new THREE.Vector3( 0.020, -0.002,  0.005), curl: [1.18, 1.28, 0.85], thumb: 0.72 },
    shotgunGrip:     { f: new THREE.Vector3(-0.24, -0.36, -0.90), back: new THREE.Vector3( 0.88, -0.38, -0.28), palmOffset: new THREE.Vector3( 0.031, -0.010,  0.008), curl: [1.14, 1.24, 0.84], thumb: 0.68 },
    rightFist:       { f: new THREE.Vector3(-0.22,  0.14, -0.96), back: new THREE.Vector3( 0.92,  0.34, -0.18), palmOffset: new THREE.Vector3( 0.005,  0.000,  0.002), curl: [1.56, 1.78, 1.12], thumb: 1.00 },
    leftFist:        { f: new THREE.Vector3( 0.22,  0.14, -0.96), back: new THREE.Vector3(-0.92,  0.34, -0.18), palmOffset: new THREE.Vector3(-0.005,  0.000,  0.002), curl: [1.56, 1.78, 1.12], thumb: 1.00 },
    supportPistol:   { f: new THREE.Vector3( 0.40,  0.05, -0.91), back: new THREE.Vector3(-0.88, -0.22, -0.42), palmOffset: new THREE.Vector3(-0.018, -0.012,  0.005), curl: [0.95, 1.05, 0.72], thumb: 0.50 },
    foregrip:        { f: new THREE.Vector3( 0.26,  0.02, -0.965), back: new THREE.Vector3(-0.965, 0.02, -0.26), palmOffset: new THREE.Vector3(-0.021,  0.002,  0.015), curl: [1.22, 1.32, 0.90], thumb: 0.78 },
    supportRifle:    { f: new THREE.Vector3( 0.36,  0.18, -0.92), back: new THREE.Vector3(-0.34, -0.92, -0.18), palmOffset: new THREE.Vector3(-0.008, -0.024,  0.005), curl: [0.80, 0.90, 0.62], thumb: 0.45 },
    plate:           { f: new THREE.Vector3( 0.42, -0.16, -0.89), back: new THREE.Vector3(-0.14,  0.96, -0.24), palmOffset: new THREE.Vector3(-0.004,  0.015,  0.004), curl: [1.06, 1.18, 0.78], thumb: 0.84 },
    // Dedicated reload & plating IK grip styles (calibrated to sculpted 8.9cm anatomical glove palm!)
    magGrip:         { f: new THREE.Vector3( 0.30, -0.12, -0.95), back: new THREE.Vector3(-0.95,  0.06, -0.30), palmOffset: new THREE.Vector3(-0.024,  0.002,  0.008), curl: [1.22, 1.32, 0.86], thumb: 0.72 },
    akMagGrip:       { f: new THREE.Vector3( 0.08, -0.02, -0.996), back: new THREE.Vector3(-0.996, 0.04, -0.08), palmOffset: new THREE.Vector3(-0.027,  0.004,  0.009), curl: [1.06, 1.12, 0.78], thumb: 0.70 },
    boltPinch:       { f: new THREE.Vector3(-0.30,  0.06, -0.95), back: new THREE.Vector3( 0.80,  0.54, -0.24), palmOffset: new THREE.Vector3( 0.014,  0.004,  0.004), curl: [1.36, 1.48, 0.92], thumb: 0.92 },
    leftBoltPinch:   { f: new THREE.Vector3( 0.32, -0.12, -0.94), back: new THREE.Vector3(-0.22,  0.96, -0.18), palmOffset: new THREE.Vector3(-0.012,  0.008,  0.004), curl: [1.24, 1.36, 0.86], thumb: 0.88 },
    slapOpen:        { f: new THREE.Vector3( 0.32, -0.15, -0.94), back: new THREE.Vector3(-0.25,  0.96, -0.12), palmOffset: new THREE.Vector3(-0.006,  0.014,  0.004), curl: [0.16, 0.18, 0.12], thumb: 0.28 },
    shellFeed:       { f: new THREE.Vector3( 0.28,  0.20, -0.94), back: new THREE.Vector3(-0.93,  0.14, -0.34), palmOffset: new THREE.Vector3(-0.018, -0.012,  0.006), curl: [0.94, 1.04, 0.72], thumb: 0.55 },
    shellThumbStage: { f: new THREE.Vector3( 0.28,  0.18, -0.94), back: new THREE.Vector3(-0.94,  0.14, -0.31), palmOffset: new THREE.Vector3(-0.020, -0.016,  0.008), curl: [0.92, 1.02, 0.70], thumb: 0.24 },
    shellThumbPush:  { f: new THREE.Vector3( 0.24,  0.30, -0.92), back: new THREE.Vector3(-0.91,  0.24, -0.34), palmOffset: new THREE.Vector3(-0.018, -0.014,  0.004), curl: [1.08, 1.18, 0.80], thumb: 1.00 },
    slideGrab:       { f: new THREE.Vector3( 0.45, -0.16, -0.88), back: new THREE.Vector3(-0.36,  0.90, -0.24), palmOffset: new THREE.Vector3(-0.010,  0.012,  0.004), curl: [1.18, 1.28, 0.85], thumb: 0.85 },
    // MW19 / Warzone / DMZ 2022 Throwable, Combat Syringe & Item-Grab Hand Styles
    grenadeHold:    { f: new THREE.Vector3(-0.35,  0.25, -0.90), back: new THREE.Vector3( 0.88, -0.22, -0.42), palmOffset: new THREE.Vector3( 0.018, -0.004, 0.006), curl: [1.14, 1.24, 0.84], thumb: 0.78 },
    pinPull:        { f: new THREE.Vector3( 0.58,  0.14, -0.80), back: new THREE.Vector3(-0.62,  0.68, -0.39), palmOffset: new THREE.Vector3(-0.012,  0.004, 0.004), curl: [1.26, 1.38, 0.88], thumb: 0.88 },
    knifeHold:      { f: new THREE.Vector3(-0.18,  0.32, -0.93), back: new THREE.Vector3( 0.95,  0.22, -0.22), palmOffset: new THREE.Vector3( 0.014, -0.004, 0.004), curl: [1.28, 1.38, 0.88], thumb: 0.86 },
    throwRelease:   { f: new THREE.Vector3(-0.12, -0.30, -0.95), back: new THREE.Vector3( 0.45,  0.86, -0.24), palmOffset: new THREE.Vector3( 0.006,  0.008, 0.004), curl: [0.14, 0.16, 0.10], thumb: 0.22 },
    syringeHold:       { f: new THREE.Vector3(-0.40,  0.20, -0.89), back: new THREE.Vector3( 0.90,  0.22, -0.37), palmOffset: new THREE.Vector3( 0.019,  0.002,  0.012), curl: [1.28, 1.38, 0.92], thumb: 0.38 },
    syringePlunge:     { f: new THREE.Vector3(-0.40,  0.20, -0.89), back: new THREE.Vector3( 0.90,  0.22, -0.37), palmOffset: new THREE.Vector3( 0.019,  0.002,  0.012), curl: [1.36, 1.48, 0.96], thumb: 1.00 },
    syringeCapPull:    { f: new THREE.Vector3( 0.48,  0.24, -0.84), back: new THREE.Vector3(-0.56,  0.76, -0.33), palmOffset: new THREE.Vector3(-0.016,  0.006,  0.012), curl: [1.22, 1.36, 0.88], thumb: 0.90 },
    medIfakCradleL:    { f: new THREE.Vector3( 0.40,  0.16, -0.90), back: new THREE.Vector3(-0.22, -0.96, -0.18), palmOffset: new THREE.Vector3(-0.012, -0.022,  0.010), curl: [0.28, 0.34, 0.22], thumb: 0.42 },
    medZipPinchR:      { f: new THREE.Vector3(-0.42,  0.28, -0.86), back: new THREE.Vector3( 0.44,  0.86, -0.25), palmOffset: new THREE.Vector3( 0.018,  0.008,  0.016), curl: [1.18, 1.32, 0.86], thumb: 0.90 },
    medForearmBraceL:  { f: new THREE.Vector3( 0.66,  0.18, -0.73), back: new THREE.Vector3(-0.48,  0.78, -0.40), palmOffset: new THREE.Vector3(-0.006,  0.000,  0.004), curl: [1.46, 1.66, 1.05], thumb: 0.94 },
    medGauzeGripR:     { f: new THREE.Vector3(-0.42,  0.24, -0.87), back: new THREE.Vector3( 0.76,  0.56, -0.33), palmOffset: new THREE.Vector3( 0.022,  0.008,  0.014), curl: [1.04, 1.16, 0.80], thumb: 0.76 },
    grabReach:      { f: new THREE.Vector3( 0.28, -0.26, -0.92), back: new THREE.Vector3(-0.36,  0.88, -0.30), palmOffset: new THREE.Vector3(-0.008,  0.010, 0.004), curl: [0.24, 0.28, 0.20], thumb: 0.30 },
    grabClose:      { f: new THREE.Vector3( 0.32, -0.18, -0.93), back: new THREE.Vector3(-0.46,  0.82, -0.34), palmOffset: new THREE.Vector3(-0.010,  0.006, 0.004), curl: [1.28, 1.40, 0.90], thumb: 0.88 },
    ledgeGrabL:     { f: new THREE.Vector3( 0.08,  0.01, -0.996), back: new THREE.Vector3(-0.15,  0.96,  0.20), palmOffset: new THREE.Vector3(-0.004,  0.010, 0.002), curl: [0.05, 0.11, 0.08], thumb: 0.18 },
    ledgeGrabR:     { f: new THREE.Vector3(-0.08,  0.01, -0.996), back: new THREE.Vector3( 0.15,  0.96,  0.20), palmOffset: new THREE.Vector3( 0.004,  0.010, 0.002), curl: [0.05, 0.11, 0.08], thumb: 0.18 },
    ledgePressL:    { f: new THREE.Vector3( 0.14, -0.10, -0.985), back: new THREE.Vector3(-0.18, 0.95,  0.22), palmOffset: new THREE.Vector3(-0.004,  0.010, 0.002), curl: [0.20, 0.24, 0.16], thumb: 0.28 },
    ledgePressR:    { f: new THREE.Vector3(-0.14, -0.10, -0.985), back: new THREE.Vector3( 0.18, 0.95,  0.22), palmOffset: new THREE.Vector3( 0.004,  0.010, 0.002), curl: [0.20, 0.24, 0.16], thumb: 0.28 }
  };

  function isEffectivelyVisible(obj, stopAt) {
    let cur = obj;
    while (cur && cur !== stopAt) {
      if (cur.visible === false) return false;
      cur = cur.parent;
    }
    return cur === stopAt;
  }

  class RiggedFPArms {
    constructor(weaponSystem) {
      this.weaponSystem = weaponSystem;
      this._poseByArm = new Map();
      this._poseSeq = 0;
      this._uShowL = { value: 0.0 };
      this._uShowR = { value: 0.0 };
      this.disabled = false;
      // Per-side smoothed finger/thumb curl & hand-basis vectors for fluid MW19/DMZ articulation
      this._wasVisible = { left: false, right: false };
      this._curCurl = { left: [0.80, 0.90, 0.62], right: [1.18, 1.28, 0.85] };
      this._curThumb = { left: 0.45, right: 0.72 };
      this._curStyleF = { left: FP_HAND_STYLES.supportRifle.f.clone(), right: FP_HAND_STYLES.grip.f.clone() };
      this._curStyleBack = { left: FP_HAND_STYLES.supportRifle.back.clone(), right: FP_HAND_STYLES.grip.back.clone() };
      this._curStylePalm = { left: FP_HAND_STYLES.supportRifle.palmOffset.clone(), right: FP_HAND_STYLES.grip.palmOffset.clone() };
      // MW4 DMZ Weapon-First Kinetic IK: 2nd-order damped clavicle/shoulder pocket compliance springs + grip tension
      this._shOff = { left: new THREE.Vector3(), right: new THREE.Vector3() };
      this._shVel = { left: new THREE.Vector3(), right: new THREE.Vector3() };
      this._gripTension = 0;

      const cloned = RigAssets.cloneSoldier();
      if (!cloned || !cloned.body || !cloned.bones.leftarm || !cloned.bones.rightarm) {
        throw new Error('Failed to clone Soldier for FP arms');
      }
      this.wrapper = cloned.wrapper;
      this.model = cloned.model;
      this.body = cloned.body;
      this.bones = cloned.bones;
      if (cloned.visor) cloned.visor.visible = false;

      // Clone geometry so per-vertex armSide attribute never mutates shared Soldier geometry
      const geom = this.body.geometry.clone();
      geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 95), 250);
      this.body.geometry = geom;
      const skinIdx = geom.attributes.skinIndex;
      const skinWt = geom.attributes.skinWeight;
      const skBones = (this.body.skeleton && this.body.skeleton.bones) || [];
      const boneSide = skBones.map((b) => {
        const bn = normName(b.name);
        if (bn.includes('shoulder')) return 0;
        const isArmPart = bn.includes('arm') || bn.includes('forearm') || bn.includes('hand');
        if (!isArmPart) return 0;
        if (bn.startsWith('mixamorigleft')) return 1;
        if (bn.startsWith('mixamorigright')) return 2;
        return 0;
      });

      const vCount = skinIdx.count;
      const idxArr = skinIdx.array;
      const wtArr = skinWt.array;
      const idxStride = skinIdx.itemSize || 4;
      const wtStride = skinWt.itemSize || 4;
      const armSideArr = new Float32Array(vCount);
      for (let i = 0; i < vCount; i++) {
        let lSum = 0;
        let rSum = 0;
        const iBase = i * idxStride;
        const wBase = i * wtStride;
        for (let k = 0; k < 4; k++) {
          const bi = idxArr[iBase + k] | 0;
          const wt = wtArr[wBase + k];
          const bs = boneSide[bi] || 0;
          if (bs === 1) lSum += wt;
          else if (bs === 2) rSum += wt;
        }
        armSideArr[i] = lSum > 0.5 ? 1.0 : (rSum > 0.5 ? 2.0 : 0.0);
      }
      geom.setAttribute('armSide', new THREE.BufferAttribute(armSideArr, 1));

      // Custom Lambert shader discarding torso/legs/head & toggled arms cleanly
      const origMat = Array.isArray(this.body.material) ? this.body.material[0] : this.body.material;
      const fpMat = new THREE.MeshLambertMaterial({
        map: (origMat && origMat.map) || null,
        color: 0xffffff,
        skinning: true,
        fog: false,
        depthTest: true,
        side: THREE.FrontSide
      });
      fpMat.onBeforeCompile = (shader) => {
        shader.uniforms.uShowL = this._uShowL;
        shader.uniforms.uShowR = this._uShowR;
        shader.vertexShader =
          'attribute float armSide;\nvarying float vArmSide;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvArmSide = armSide;'
          );
        shader.fragmentShader =
          'uniform float uShowL;\nuniform float uShowR;\nvarying float vArmSide;\n' +
          shader.fragmentShader.replace(
            /void\s+main\s*\(\s*\)\s*\{/,
            'void main() {\n  if (vArmSide < 0.5 || (vArmSide < 1.5 && uShowL < 0.5) || (vArmSide > 1.5 && uShowR < 0.5)) discard;\n'
          );
        fpMat.userData.shader = shader;
      };
      this.body.material = fpMat;
      this.body.castShadow = false;
      this.body.receiveShadow = false;
      this.body.frustumCulled = false;

      // Pose with TPose clip at t=0 before calibration
      const anims = RigAssets.soldier.animations || [];
      const tPoseClip = anims.find((c) => normName(c.name) === 'tpose');
      if (tPoseClip) {
        const tmpMixer = new THREE.AnimationMixer(this.model);
        const tAct = tmpMixer.clipAction(tPoseClip);
        tAct.play();
        tmpMixer.update(0);
        tAct.stop();
        tmpMixer.uncacheClip(tPoseClip);
        tmpMixer.uncacheRoot(this.model);
      }

      const B = this.bones;
      this.wrapper.updateMatrixWorld(true);

      // Scale so total arm length |arm->forearm| + |forearm->hand| = 0.38m (proportional FP glove scale)
      const pArm = B.rightarm.getWorldPosition(new THREE.Vector3());
      const pFore = B.rightforearm.getWorldPosition(new THREE.Vector3());
      const pHand = B.righthand.getWorldPosition(new THREE.Vector3());
      const rawReach = pArm.distanceTo(pFore) + pFore.distanceTo(pHand);
      const scaleF = 0.38 / Math.max(0.1, rawReach);
      this.wrapper.scale.setScalar(scaleF);
      this.wrapper.updateMatrixWorld(true);

      // Orient wrapper so character forward faces camera -Z
      const lfP = B.leftfoot ? B.leftfoot.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(-0.1, 0, 0);
      const ltbP = B.lefttoebase ? B.lefttoebase.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(-0.1, 0, 0.1);
      const rfP = B.rightfoot ? B.rightfoot.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0.1, 0, 0);
      const rtbP = B.righttoebase ? B.righttoebase.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0.1, 0, 0.1);
      const fwdXZ = new THREE.Vector3((ltbP.x - lfP.x) + (rtbP.x - rfP.x), 0, (ltbP.z - lfP.z) + (rtbP.z - rfP.z));
      if (fwdXZ.lengthSq() > 1e-6) {
        fwdXZ.normalize();
        this.wrapper.rotation.y = Math.atan2(-fwdXZ.x, -fwdXZ.z);
      }
      this.wrapper.updateMatrixWorld(true);

      this.handBasis = {
        left: RigIK.computeHandBasis(B.lefthand, B, 'left'),
        right: RigIK.computeHandBasis(B.righthand, B, 'right')
      };
      this.fingerCurls = {
        left: RigIK.buildFingerCurl(B, 'left'),
        right: RigIK.buildFingerCurl(B, 'right')
      };
      this.bindLocal = {
        leftarm: B.leftarm ? B.leftarm.quaternion.clone() : null,
        leftforearm: B.leftforearm ? B.leftforearm.quaternion.clone() : null,
        lefthand: B.lefthand ? B.lefthand.quaternion.clone() : null,
        rightarm: B.rightarm ? B.rightarm.quaternion.clone() : null,
        rightforearm: B.rightforearm ? B.rightforearm.quaternion.clone() : null,
        righthand: B.righthand ? B.righthand.quaternion.clone() : null
      };
      this.bindBonePos = {
        leftforearm: B.leftforearm ? B.leftforearm.position.clone() : null,
        lefthand: B.lefthand ? B.lefthand.position.clone() : null,
        rightforearm: B.rightforearm ? B.rightforearm.position.clone() : null,
        righthand: B.righthand ? B.righthand.position.clone() : null
      };

      const pArm2 = B.rightarm.getWorldPosition(new THREE.Vector3());
      const pFore2 = B.rightforearm.getWorldPosition(new THREE.Vector3());
      const pHand2 = B.righthand.getWorldPosition(new THREE.Vector3());
      this.reach = pArm2.distanceTo(pFore2) + pFore2.distanceTo(pHand2);
      this.palmCenterDist = (B.righthand && B.righthandmiddle1)
        ? pHand2.distanceTo(B.righthandmiddle1.getWorldPosition(new THREE.Vector3())) * 0.52
        : 0.055;

      // Mount inside vmCamera with head placed at camera-local (0, -0.05, 0.12)
      const cam = weaponSystem.vmCamera;
      cam.add(this.wrapper);
      cam.updateMatrixWorld(true);
      if (B.head) {
        const headCam = cam.worldToLocal(B.head.getWorldPosition(new THREE.Vector3()));
        this.wrapper.position.add(new THREE.Vector3(0, -0.05, 0.12).sub(headCam));
        this.wrapper.updateMatrixWorld(true);
      }
    }

    applyShoulderImpulse(side, x, y, z, gripBump = 0.25) {
      const s = side === 'left' ? 'left' : 'right';
      const v = this._shVel && this._shVel[s];
      if (!v) return;
      v.x = THREE.MathUtils.clamp(v.x + x * 14, -1.8, 1.8);
      v.y = THREE.MathUtils.clamp(v.y + y * 14, -1.8, 1.8);
      v.z = THREE.MathUtils.clamp(v.z + z * 14, -1.8, 1.8);
      this._gripTension = Math.min(1.0, (this._gripTension || 0) + gripBump);
    }

    recordArmPose(armGroup, shoulderLocal, wristLocal, handObj) {
      if (this.disabled || !armGroup || !armGroup.parent) return;
      const side = armGroup.userData && armGroup.userData.fpSide;
      if (!side) return;
      this._poseByArm.set(armGroup, {
        side,
        armGroup,
        shoulderLocal: shoulderLocal.clone(),
        wristLocal: wristLocal.clone(),
        handObj: handObj || null,
        seq: ++this._poseSeq
      });
    }

    update(dt) {
      if (this.disabled) return;
      try {
        const ws = this.weaponSystem;
        const cam = ws && ws.vmCamera;
        if (!cam) return;

        let poseL = null;
        let poseR = null;
        for (const [armGrp, p] of this._poseByArm.entries()) {
          if (!armGrp || !armGrp.parent) {
            this._poseByArm.delete(armGrp);
            continue;
          }
          if (!isEffectivelyVisible(armGrp, cam)) continue;
          if (p.side === 'left' && (!poseL || p.seq >= poseL.seq)) poseL = p;
          else if (p.side === 'right' && (!poseR || p.seq >= poseR.seq)) poseR = p;
        }

        cam.updateMatrixWorld(true);
        const camQ = cam.getWorldQuaternion(new THREE.Quaternion());
        const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camQ);
        const camDown = new THREE.Vector3(0, -1, 0).applyQuaternion(camQ);
        const camBack = new THREE.Vector3(0, 0, 1).applyQuaternion(camQ);

        const applySide = (side, pose) => {
          const B = this.bones;
          const bArm = B[side + 'arm'];
          const bFore = B[side + 'forearm'];
          const bHand = B[side + 'hand'];
          if (!pose || !bArm || !bFore || !bHand || !pose.armGroup.parent) {
            this._wasVisible[side] = false;
            return false;
          }

          if (this.bindBonePos) {
            if (this.bindBonePos[side + 'forearm']) bFore.position.copy(this.bindBonePos[side + 'forearm']);
            if (this.bindBonePos[side + 'hand']) bHand.position.copy(this.bindBonePos[side + 'hand']);
          }

          pose.armGroup.parent.updateWorldMatrix(true, false);
          const shoulderW = pose.armGroup.parent.localToWorld(pose.shoulderLocal.clone());
          const wristW = pose.armGroup.parent.localToWorld(pose.wristLocal.clone());

          const handObj = pose.handObj;
          const climbLock = (handObj && handObj.userData) ? handObj.userData.climbLock : null;
          const cb = climbLock ? THREE.MathUtils.clamp(climbLock.blend || 0, 0, 1) : 0;
          const styleKey = (handObj && handObj.userData && (handObj.userData.activeStyle || handObj.userData.handStyle)) || 'grip';
          const style = FP_HAND_STYLES[styleKey] || FP_HAND_STYLES.grip;

          // Smooth MW4 DMZ finger & wrist-basis interpolation (snap immediately when arm newly enters frame)
          const wasVis = this._wasVisible[side];
          const stepDt = Math.min(0.05, Math.max(0.001, dt || 0.016));
          const styleLerp = wasVis ? Math.min(1, stepDt * 22) : 1.0;
          const curlLerp = wasVis ? Math.min(1, stepDt * 26) : 1.0;

          const curF = this._curStyleF[side];
          const curBack = this._curStyleBack[side];
          const curPalm = this._curStylePalm[side];
          curF.lerp(style.f, styleLerp).normalize();
          curBack.lerp(style.back, styleLerp).normalize();
          curPalm.lerp(style.palmOffset, styleLerp);

          const curCurl = this._curCurl[side];
          curCurl[0] = THREE.MathUtils.lerp(curCurl[0], style.curl[0], curlLerp);
          curCurl[1] = THREE.MathUtils.lerp(curCurl[1], style.curl[1], curlLerp);
          curCurl[2] = THREE.MathUtils.lerp(curCurl[2], style.curl[2], curlLerp);
          this._curThumb[side] = THREE.MathUtils.lerp(this._curThumb[side], style.thumb, curlLerp);
          if (!this._wasClimbing) this._wasClimbing = { left: false, right: false };
          if (cb > 0.001 && climbLock && Array.isArray(climbLock.curl)) {
            const snapClimb = !this._wasClimbing[side] || cb >= 0.99;
            const cBlend = snapClimb ? 1.0 : cb;
            curCurl[0] = THREE.MathUtils.lerp(curCurl[0], climbLock.curl[0], cBlend);
            curCurl[1] = THREE.MathUtils.lerp(curCurl[1], climbLock.curl[1], cBlend);
            curCurl[2] = THREE.MathUtils.lerp(curCurl[2], climbLock.curl[2], cBlend);
            const tgtThumb = typeof climbLock.thumb === 'number' ? climbLock.thumb : 0.22;
            this._curThumb[side] = THREE.MathUtils.lerp(this._curThumb[side], tgtThumb, cBlend);
            this._wasClimbing[side] = true;
          } else {
            this._wasClimbing[side] = false;
          }
          this._wasVisible[side] = true;

          let handWQ = camQ;
          let handWPos = null;
          if (handObj) {
            handObj.updateWorldMatrix(true, false);
            handWQ = handObj.getWorldQuaternion(new THREE.Quaternion());
            handWPos = handObj.getWorldPosition(new THREE.Vector3());
          }
          const fW = curF.clone().applyQuaternion(handWQ).normalize();
          const backW = curBack.clone().applyQuaternion(handWQ).normalize();

          let wristTarget = wristW;
          if (handWPos) {
            const palmTargetW = handWPos.add(curPalm.clone().applyQuaternion(handWQ));
            wristTarget = palmTargetW.addScaledVector(fW, -this.palmCenterDist);
          }

          // MW4 DMZ Kinetic Clavicle / Shoulder Pocket Compliance Spring + ADS Cheek-Weld & CQB Tuck
          const sideSign = side === 'left' ? -1 : 1;
          const adsB = THREE.MathUtils.clamp((ws && ws._adsBlend) || 0, 0, 1);
          const wp = THREE.MathUtils.clamp((ws && ws.wallPush) || 0, 0, 1);
          const vmRoll = (ws && ws.viewmodelGroup && ws.viewmodelGroup.rotation) ? ws.viewmodelGroup.rotation.z : 0;

          const shOff = this._shOff[side];
          const shVel = this._shVel[side];
          const ks = 195.0, cs = 18.0;
          shVel.x += (-ks * shOff.x - cs * shVel.x) * stepDt;
          shVel.y += (-ks * shOff.y - cs * shVel.y) * stepDt;
          shVel.z += (-ks * shOff.z - cs * shVel.z) * stepDt;
          shOff.x = THREE.MathUtils.clamp(shOff.x + shVel.x * stepDt, -0.045, 0.045);
          shOff.y = THREE.MathUtils.clamp(shOff.y + shVel.y * stepDt, -0.045, 0.045);
          shOff.z = THREE.MathUtils.clamp(shOff.z + shVel.z * stepDt, -0.055, 0.055);

          // Right shoulder pockets inward/upward matching tucked shoulder-center viewmodel; left clavicle protracts slightly forward for support
          const isPlatingArm = !!(side === 'left' && ws && ws.isPlating);
          const isHealingArm = !!(ws && ws.isHealing);
          const isForearmBrace = isHealingArm && side === 'left' && styleKey === 'medForearmBraceL';
          const shBaseX = isHealingArm ? 0.215 : (side === 'right' ? 0.175 : (isPlatingArm ? 0.25 : 0.21));
          const shCamLocal = new THREE.Vector3(
            sideSign * (shBaseX - (isHealingArm ? 0 : (side === 'right' ? adsB * 0.032 : adsB * 0.015))) + shOff.x,
            (isPlatingArm ? -0.255 : (isHealingArm ? -0.275 : -0.29)) + (side === 'right' ? adsB * 0.024 : adsB * 0.014) - wp * 0.020 + shOff.y,
            (isPlatingArm ? -0.08 : (isHealingArm ? 0.06 : 0.14)) + (side === 'left' ? -adsB * 0.022 : adsB * 0.012) + wp * 0.035 + shOff.z
          );
          const camSh = cam.localToWorld(shCamLocal);
          const anchor = shoulderW.clone().lerp(camSh, 0.50);

          const maxReach = this.reach * 0.985;
          // Alternating projection in vmCamera space: slides shoulder anchor forward strictly underneath the bottom frustum edge
          // (>=8.5cm below screen bottom) so the severed arm stump is NEVER visible while wristTarget achieves 0.00cm offset on foregrips!
          const anchorCam = cam.worldToLocal(anchor.clone());
          const wristCam = cam.worldToLocal(wristTarget.clone());
          const halfTanY = Math.tan(THREE.MathUtils.degToRad((cam.fov || 75) * 0.5));
          for (let iter = 0; iter < 4; iter++) {
            const dx = wristCam.x - anchorCam.x;
            const dy = wristCam.y - anchorCam.y;
            const dz = wristCam.z - anchorCam.z;
            const d = Math.hypot(dx, dy, dz);
            if (d > maxReach && d > 1e-5) {
              const pull = (d - maxReach) / d;
              anchorCam.x += dx * pull;
              anchorCam.y += dy * pull;
              anchorCam.z += dz * pull;
            }
            if (anchorCam.z < 0.06) {
              const safeY = -Math.max(0, -anchorCam.z) * halfTanY - 0.085;
              if (anchorCam.y > safeY) anchorCam.y = safeY;
            }
          }
          anchor.copy(cam.localToWorld(anchorCam));

          const clampedToWrist = wristTarget.clone().sub(anchor);
          const clampedDist = clampedToWrist.length();
          if (clampedDist > maxReach && clampedDist > 1e-5) {
            wristTarget = anchor.clone().addScaledVector(clampedToWrist.multiplyScalar(1 / clampedDist), maxReach);
          }

          // MW4 Kinetic Dynamic Elbow Pole: tucks ribs cleanly on ADS, 45° Tactical Stance cant, Corner Lean & CQB Wall Push!
          const cantTuck = THREE.MathUtils.clamp(-vmRoll * sideSign * 0.22, -0.14, 0.16);
          const poleOut = isPlatingArm
            ? -0.52
            : (isForearmBrace ? -0.46 : (isHealingArm ? sideSign * 0.38 : (sideSign * (0.42 - adsB * 0.09 - wp * 0.08) - cantTuck)));
          const poleDown = isPlatingArm
            ? 0.22
            : (isForearmBrace ? 0.26 : (isHealingArm ? 0.36 : (0.48 + adsB * 0.06 + wp * 0.10 + Math.abs(vmRoll) * 0.08)));
          const poleBack = isPlatingArm
            ? 0.02
            : (isForearmBrace ? 0.02 : (isHealingArm ? 0.05 : (0.04 + wp * 0.14 + (side === 'right' ? adsB * 0.04 : -adsB * 0.02))));
          const pole = anchor.clone()
            .addScaledVector(camRight, poleOut)
            .addScaledVector(camDown, poleDown)
            .addScaledVector(camBack, poleBack);

          // World-Space Ledge Lock Override (Climb & Mantle):
          // Welds palm 100.0% onto the obstacle top edge (0.0mm slip under all FOV settings!) while keeping
          // the shoulder behind/below the frustum and extending segment bones to natural 1:1 human reach!
          if (cb > 0.001 && climbLock.palmWorld) {
            fW.lerp(climbLock.fWorld, cb).normalize();
            backW.lerp(climbLock.backWorld, cb).normalize();

            let climbPalmW = climbLock.palmWorld.clone();
            const worldCam = ws && ws.camera;
            if (worldCam && Math.abs((cam.fov || 75) - (worldCam.fov || 75)) > 0.05) {
              const pCam = cam.worldToLocal(climbPalmW);
              if (pCam.z < -0.04) {
                const fovRatio = halfTanY / Math.max(0.04, Math.tan(THREE.MathUtils.degToRad((worldCam.fov || 75) * 0.5)));
                pCam.x *= fovRatio;
                pCam.y *= fovRatio;
              }
              climbPalmW = cam.localToWorld(pCam);
            }
            const climbWrist = climbPalmW.addScaledVector(fW, -this.palmCenterDist);
            wristTarget.lerp(climbWrist, cb);

            const bYaw = typeof climbLock.bodyYaw === 'number' ? climbLock.bodyYaw : 0;
            const bodyRight = new THREE.Vector3(Math.cos(bYaw), 0, -Math.sin(bYaw));
            const bodyBack = new THREE.Vector3(Math.sin(bYaw), 0, Math.cos(bYaw));
            const camWorldPos = cam.getWorldPosition(new THREE.Vector3());
            const climbAnchor = camWorldPos
              .addScaledVector(bodyRight, sideSign * 0.21)
              .addScaledVector(bodyBack, 0.08);
            climbAnchor.y -= 0.25;

            const preSpan = climbAnchor.clone().sub(wristTarget);
            const preDist = preSpan.length();
            const naturalClimbReach = this.reach * 1.32;
            if (preDist > naturalClimbReach && preDist > 1e-5) {
              climbAnchor.copy(wristTarget).addScaledVector(preSpan, naturalClimbReach / preDist);
            }

            const cAnc = cam.worldToLocal(climbAnchor.clone());
            if (cAnc.z < 0.05) {
              const safeY = -Math.max(0, -cAnc.z) * halfTanY - 0.085;
              if (cAnc.y > safeY) cAnc.y = safeY;
            }
            climbAnchor.copy(cam.localToWorld(cAnc));
            anchor.lerp(climbAnchor, cb);

            const climbPole = anchor.clone().add(climbLock.poleOffsetWorld);
            pole.lerp(climbPole, cb);

            const liveDist = wristTarget.distanceTo(anchor);
            const baseLim = this.reach * 0.95;
            if (liveDist > baseLim) {
              const segScale = liveDist / baseLim;
              bFore.position.multiplyScalar(segScale);
              bHand.position.multiplyScalar(segScale);
            }
          }

          if (bArm.parent) {
            bArm.parent.updateWorldMatrix(true, false);
            bArm.position.copy(bArm.parent.worldToLocal(anchor.clone()));
            bArm.updateMatrixWorld(true);
          }

          RigIK.solveTwoBone(
            bArm, bFore, bHand, wristTarget, pole,
            this.bindLocal && this.bindLocal[side + 'arm'],
            this.bindLocal && this.bindLocal[side + 'forearm']
          );

          RigIK.alignArmChainTwist(bArm, bFore, bHand, pole, this.handBasis[side], fW, backW, side, cb > 0.25);

          const qHand = RigIK.handBasisQuat(this.handBasis[side], fW, backW, new THREE.Quaternion());
          RigIK.setWorldQuat(bHand, qHand);

          // Kinetic grip tension subtly tightens finger curl during active recoil kick & focused ADS!
          const tension = (this._gripTension || 0) * 0.08 + adsB * 0.03;
          const liveCurl = (curCurl[0] > 0.5 && curCurl[0] < 1.40)
            ? [curCurl[0] + tension, curCurl[1] + tension, curCurl[2] + tension * 0.7]
            : curCurl;
          RigIK.applyFingerCurl(this.fingerCurls[side], liveCurl, Math.min(1.0, this._curThumb[side] + tension * 0.5));
          return true;
        };

        this._gripTension = Math.max(0, (this._gripTension || 0) - Math.min(0.05, dt || 0.016) * 5.5);

        this._uShowL.value = applySide('left', poseL) ? 1.0 : 0.0;
        this._uShowR.value = applySide('right', poseR) ? 1.0 : 0.0;
        this.model.updateMatrixWorld(true);
      } catch (err) {
        console.warn('[RiggedFPArms] update error; restoring legacy FP hands:', err);
        this.disabled = true;
        if (this.wrapper && this.wrapper.parent) this.wrapper.parent.remove(this.wrapper);
        if (this.weaponSystem && this.weaponSystem._restoreLegacyHands) {
          this.weaponSystem._restoreLegacyHands();
        }
        if (this.weaponSystem) this.weaponSystem.fpArms = null;
      }
    }
  }

  // ============================================================================
  // UNIFIED SCULPTED SAPI ARMOR PLATE BUILDER (v2.46)
  // Shared between Inventory Icon (icons.js) and First-Person Plating Rig (weapons.js)!
  // ============================================================================
  function buildArmorPlateMesh(opts = {}) {
    const forIcon = !!opts.forIcon;
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    // Authentic shooter's-cut SAPI ballistic ceramic plate silhouette
    shape.moveTo(-0.23, -0.30);
    shape.lineTo( 0.23, -0.30);
    shape.lineTo( 0.23,  0.16);
    shape.lineTo( 0.11,  0.30);
    shape.lineTo(-0.11,  0.30);
    shape.lineTo(-0.23,  0.16);
    shape.closePath();

    const plateMat = forIcon
      ? new THREE.MeshPhongMaterial({ color: 0x3d444d, specular: 0x7b8896, shininess: 38 })
      : new THREE.MeshPhongMaterial({ color: 0x383f48, specular: 0x5c6876, shininess: 28 });
    const trimMat = forIcon
      ? new THREE.MeshPhongMaterial({ color: 0x262b31, specular: 0x454e58, shininess: 22 })
      : new THREE.MeshLambertMaterial({ color: 0x24292f });
    const stencilMat = forIcon
      ? new THREE.MeshPhongMaterial({ color: 0xdce6f0, emissive: 0x1a2633, shininess: 55 })
      : new THREE.MeshLambertMaterial({ color: 0xd8e2ec });

    const plateGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.048,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2
    });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.z = -0.024;
    g.add(plate);

    // Upper white ballistic NIJ-IV stencil stripe + secondary sub-markings matching icon
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.032, 0.068), stencilMat);
    stripe.position.set(0, 0.10, 0.004);
    const subMark = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.066), stencilMat);
    subMark.position.set(0, 0.056, 0.004);
    // Subtle dark Cordura edge-seal lip along bottom rim
    const bottomRim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.026, 0.070), trimMat);
    bottomRim.position.set(0, -0.285, 0.0);
    g.add(stripe, subMark, bottomRim);

    if (!forIcon) {
      // Scale from icon units (~0.46 x 0.60) down to realistic physical SAPI plate size (~0.24m x 0.30m)
      g.scale.setScalar(0.46);
    }
    return g;
  }

  window.RigAssets = RigAssets;
  window.RigIK = RigIK;
  window.RiggedCharacter = RiggedCharacter;
  window.RigRegistry = RigRegistry;
  window.RiggedFPArms = RiggedFPArms;
  window.buildTacticalBackpackMesh = buildTacticalBackpackMesh;
  window.buildArmorPlateMesh = buildArmorPlateMesh;
})();
