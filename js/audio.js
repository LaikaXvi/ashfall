// Procedural Web Audio API Sound Effects (Multi-Layer Ballistic Synthesizer)
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.gunBuffers = {};
    this.gunBus = null;
    this.reverbSend = null;
    this.compressor = null;
    this.masterGain = null;
    this.gunGain = null;
    this.footGain = null;
    this.ambientGain = null;
    this.ambientDuck = null;
    this.sfxGain = null;
    this.tailBus = null;
    this.roomBus = null;
    this.indoor = false;
    this._ambient = null;
    this._birdTimer = null;
    this._fobTimer = null;
    this.muted = false;
    this.levels = this._loadLevels ? this._loadLevels() : { master: 1, gun: 1, foot: 1, ambient: 1, sfx: 1 };
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this._createNoiseBuffer();
      this._createGunBus();
      this._decodeGunSamples();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _decodeGunSamples() {
    if (!window.GUN_SAMPLES_B64 || !this.ctx) return;
    for (const [id, b64] of Object.entries(window.GUN_SAMPLES_B64)) {
      try {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        this.ctx.decodeAudioData(bytes.buffer, (decoded) => {
          this.gunBuffers[id] = decoded;
        });
      } catch (e) {}
    }
  }

  _createNoiseBuffer() {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2.0; // 2s buffer for randomized shot offsets
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  _loadLevels() {
    const d = { master: 1, gun: 1, foot: 1, ambient: 1, sfx: 1 };
    try {
      const raw = localStorage.getItem('ashfall_audio_levels_v1');
      if (raw) {
        const p = JSON.parse(raw);
        for (const k of Object.keys(d)) {
          const v = parseFloat(p[k]);
          if (isFinite(v)) d[k] = Math.min(1, Math.max(0, v));
        }
      }
    } catch (e) {}
    return d;
  }

  _saveLevels() {
    try { localStorage.setItem('ashfall_audio_levels_v1', JSON.stringify(this.levels)); } catch (e) {}
  }

  _applyLevels() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const L = this.levels || { master: 1, gun: 1, foot: 1, ambient: 1, sfx: 1 };
    const m = this.muted ? 0 : L.master;
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(m, t, 0.02);
    if (this.gunGain) this.gunGain.gain.setTargetAtTime(L.gun, t, 0.02);
    if (this.footGain) this.footGain.gain.setTargetAtTime(L.foot, t, 0.02);
    if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(L.ambient, t, 0.02);
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(L.sfx, t, 0.02);
  }

  setLevel(name, v) {
    const k = String(name || '').toLowerCase();
    const map = { master: 'master', gun: 'gun', gunshot: 'gun', gunshots: 'gun', foot: 'foot', footstep: 'foot', footsteps: 'foot', ambient: 'ambient', ambience: 'ambient', sfx: 'sfx', ui: 'sfx' };
    const key = map[k] || null;
    if (!key) return this.levels;
    let f = parseFloat(v);
    if (!isFinite(f)) f = 1;
    f = Math.min(1, Math.max(0, f));
    this.levels[key] = f;
    this._saveLevels();
    this._applyLevels();
    return this.levels;
  }

  getLevels() { return Object.assign({}, this.levels); }

  setMuted(m) { this.muted = !!m; this._applyLevels(); return this.muted; }

  _levelScale(cat) {
    const L = this.levels || { master: 1, gun: 1, foot: 1, ambient: 1, sfx: 1 };
    if (this.muted) return 0;
    const c = (cat === 'gun') ? L.gun : (cat === 'foot') ? L.foot : (cat === 'ambient') ? L.ambient : (cat === 'sfx') ? L.sfx : 1;
    return L.master * c;
  }

  _bus(cat) {
    if (cat === 'gun') return this.gunGain || this.gunBus;
    if (cat === 'foot') return this.footGain || this.masterGain;
    if (cat === 'ambient') return this.ambientGain || this.masterGain;
    if (cat === 'sfx') return this.sfxGain || this.masterGain;
    return this.masterGain || this.ctx.destination;
  }

  _createGunBus() {
    // Master limiter so punchy gunshots stay loud and clean without harsh digital clipping
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-10, this.ctx.currentTime);
    compressor.knee.setValueAtTime(6, this.ctx.currentTime);
    compressor.ratio.setValueAtTime(10, this.ctx.currentTime);
    compressor.attack.setValueAtTime(0.001, this.ctx.currentTime);
    compressor.release.setValueAtTime(0.08, this.ctx.currentTime);
    this.compressor = compressor;

    // Master gain: single mute/volume point after the limiter
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : (this.levels ? this.levels.master : 1), this.ctx.currentTime);
    compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Asymmetric analog-style soft saturator for ballistic crack
    const shaper = this.ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = Math.tanh(x * 2.8);
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    shaper.connect(compressor);

    // Per-category trim gains. Gunshots feed the saturator; everything else feeds the limiter clean.
    this.gunGain = this.ctx.createGain();
    this.gunGain.gain.setValueAtTime(this.levels ? this.levels.gun : 1, this.ctx.currentTime);
    this.gunGain.connect(shaper);
    this.gunBus = this.gunGain;
    this._gunShaper = shaper;

    this.footGain = this.ctx.createGain();
    this.footGain.gain.setValueAtTime(this.levels ? this.levels.foot : 1, this.ctx.currentTime);
    this.footGain.connect(compressor);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(this.levels ? this.levels.sfx : 1, this.ctx.currentTime);
    this.sfxGain.connect(compressor);

    this.ambientDuck = this.ctx.createGain();
    this.ambientDuck.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.ambientDuck.connect(compressor);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(this.levels ? this.levels.ambient : 1, this.ctx.currentTime);
    this.ambientGain.connect(this.ambientDuck);

    // Tight concrete / bunker indoor room reverb bus (0.45s decay -> 3500Hz LP -> 0.5 -> gunBus)
    const sr = this.ctx.sampleRate;
    const roomIrLen = Math.floor(sr * 0.45);
    const roomIrBuf = this.ctx.createBuffer(2, roomIrLen, sr);
    for (let ch = 0; ch < 2; ch++) {
      const rd = roomIrBuf.getChannelData(ch);
      for (let i = 0; i < roomIrLen; i++) {
        const t = i / sr;
        const att = Math.min(1, t / 0.004);
        rd[i] = (Math.random() * 2 - 1) * att * Math.exp(-t * 9.0);
      }
    }
    const roomConv = this.ctx.createConvolver();
    roomConv.buffer = roomIrBuf;
    const roomLP = this.ctx.createBiquadFilter();
    roomLP.type = 'lowpass';
    roomLP.frequency.setValueAtTime(3500, this.ctx.currentTime);
    const roomGain = this.ctx.createGain();
    roomGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    const roomBus = this.ctx.createGain();
    roomBus.gain.setValueAtTime(1.0, this.ctx.currentTime);
    roomBus.connect(roomConv);
    roomConv.connect(roomLP);
    roomLP.connect(roomGain);
    roomGain.connect(this.gunBus);
    this.roomBus = roomBus;

    // Warzone Outdoor Multi-Tap Canyon & Foliage Reflection Tail (3 delay taps -> 1.8s IR convolver -> gunBus)
    const irLen = Math.floor(sr * 1.8);
    const irBuf = this.ctx.createBuffer(2, irLen, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = irBuf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < irLen; i++) {
        const t = i / sr;
        const attack = Math.min(1, t / 0.014);
        const env = attack * Math.exp(-t * 3.2);
        const white = Math.random() * 2 - 1;
        lp = lp * 0.80 + white * 0.20;
        d[i] = lp * env;
      }
    }
    const convolver = this.ctx.createConvolver();
    convolver.buffer = irBuf;

    const tailBus = this.ctx.createGain();
    tailBus.gain.setValueAtTime(1.0, this.ctx.currentTime);
    const taps = [
      { time: 0.19, gain: 0.28 },
      { time: 0.43, gain: 0.18 },
      { time: 0.78, gain: 0.10 }
    ];
    for (const tap of taps) {
      const dl = this.ctx.createDelay(1.0);
      dl.delayTime.setValueAtTime(tap.time, this.ctx.currentTime);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1800, this.ctx.currentTime);
      const tg = this.ctx.createGain();
      tg.gain.setValueAtTime(tap.gain, this.ctx.currentTime);
      tailBus.connect(dl);
      dl.connect(lp);
      lp.connect(tg);
      tg.connect(convolver);
    }
    // Subtle early tail path into the 1.8s convolver as well
    const earlyRev = this.ctx.createGain();
    earlyRev.gain.setValueAtTime(0.35, this.ctx.currentTime);
    tailBus.connect(earlyRev);
    earlyRev.connect(convolver);

    const revFilter = this.ctx.createBiquadFilter();
    revFilter.type = 'lowpass';
    revFilter.frequency.setValueAtTime(1750, this.ctx.currentTime);

    const revGain = this.ctx.createGain();
    revGain.gain.setValueAtTime(0.42, this.ctx.currentTime);

    convolver.connect(revFilter);
    revFilter.connect(revGain);
    revGain.connect(this.gunBus);
    this.tailBus = tailBus;
    this.reverbSend = tailBus;
  }

  _playBirdChirpCluster() {
    if (!this._ambient || this._ambient.kind !== 'wind' || this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const chirps = [0, 0.11, 0.24];
    const basePitch = 3000 + Math.random() * 550;
    chirps.forEach((off, idx) => {
      const t = now + off;
      const dur = 0.055 + Math.random() * 0.025;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      const p0 = basePitch + idx * 140;
      const p1 = Math.min(4500, p0 + 680 + Math.random() * 420);
      osc.frequency.setValueAtTime(p0, t);
      osc.frequency.exponentialRampToValueAtTime(p1, t + dur * 0.65);
      osc.frequency.exponentialRampToValueAtTime(p0 * 0.96, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.022, t + dur * 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this._bus('ambient'));
      osc.start(t);
      osc.stop(t + dur + 0.01);
    });
  }

  _scheduleNextBird() {
    if (this._birdTimer) {
      clearTimeout(this._birdTimer);
      this._birdTimer = null;
    }
    if (!this._ambient || this._ambient.kind !== 'wind') return;
    const waitMs = 9000 + Math.random() * 11000;
    this._birdTimer = setTimeout(() => {
      this._birdTimer = null;
      if (!this._ambient || this._ambient.kind !== 'wind') return;
      this._playBirdChirpCluster();
      this._scheduleNextBird();
    }, waitMs);
  }

  _scheduleFobChatter() {
    if (!this._ambient || this._ambient.kind !== 'fob') return;
    const waitMs = 9000 + Math.random() * 11000;
    this._fobTimer = setTimeout(() => {
      if (!this._ambient || this._ambient.kind !== 'fob') return;
      if (!this.muted && this.ctx) {
        const now = this.ctx.currentTime;
        // Squelch click (1.8kHz BP noise 0.05s)
        const sq = this._makeNoise(now, 0.055);
        const sqBP = this.ctx.createBiquadFilter();
        sqBP.type = 'bandpass';
        sqBP.frequency.setValueAtTime(1800, now);
        sqBP.Q.setValueAtTime(2.6, now);
        const sqG = this.ctx.createGain();
        sqG.gain.setValueAtTime(0.055, now);
        sqG.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        sq.connect(sqBP);
        sqBP.connect(sqG);
        sqG.connect(this._bus('ambient'));

        // AM-modulated muffled tactical voice chatter (0.6-1.4s at 1.2kHz BP)
        const chatDur = 0.6 + Math.random() * 0.8;
        const chatT = now + 0.06;
        const ch = this._makeNoise(chatT, chatDur + 0.04);
        const chBP = this.ctx.createBiquadFilter();
        chBP.type = 'bandpass';
        chBP.frequency.setValueAtTime(1180 + Math.random() * 160, chatT);
        chBP.Q.setValueAtTime(3.2, chatT);
        const am = this.ctx.createGain();
        am.gain.setValueAtTime(0.032, chatT);
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(5.5 + Math.random() * 3.0, chatT);
        const lfoG = this.ctx.createGain();
        lfoG.gain.setValueAtTime(0.024, chatT);
        lfo.connect(lfoG);
        lfoG.connect(am.gain);
        const tailG = this.ctx.createGain();
        tailG.gain.setValueAtTime(0.001, chatT);
        tailG.gain.linearRampToValueAtTime(1.0, chatT + 0.03);
        tailG.gain.setValueAtTime(1.0, chatT + chatDur - 0.04);
        tailG.gain.exponentialRampToValueAtTime(0.001, chatT + chatDur);
        ch.connect(chBP);
        chBP.connect(am);
        am.connect(tailG);
        tailG.connect(this._bus('ambient'));
        lfo.start(chatT);
        lfo.stop(chatT + chatDur + 0.02);

        // End squelch
        const sqEndT = chatT + chatDur;
        const sq2 = this._makeNoise(sqEndT, 0.045);
        const sq2BP = this.ctx.createBiquadFilter();
        sq2BP.type = 'bandpass';
        sq2BP.frequency.setValueAtTime(1750, sqEndT);
        sq2BP.Q.setValueAtTime(2.6, sqEndT);
        const sq2G = this.ctx.createGain();
        sq2G.gain.setValueAtTime(0.0001, now);
        sq2G.gain.setValueAtTime(0.045, sqEndT);
        sq2G.gain.exponentialRampToValueAtTime(0.001, sqEndT + 0.04);
        sq2.connect(sq2BP);
        sq2BP.connect(sq2G);
        sq2G.connect(this._bus('ambient'));
      }
      this._scheduleFobChatter();
    }, waitMs);
  }

  setIndoor(flag) {
    const next = !!flag;
    if (next === this.indoor) return;
    this.indoor = next;
    if (this.ctx && this.ambientDuck) {
      try {
        this.ambientDuck.gain.setTargetAtTime(next ? 0.35 : 1.0, this.ctx.currentTime, 0.3);
      } catch (e) {}
    }
  }

  startFobAmbience() {
    this.init();
    return this.startAmbient('fob');
  }

  stopFobAmbience() {
    this.stopAmbient(false);
  }

  startAmbient(kind) {
    if (!this.ctx) return null;
    try { this.stopAmbient(true); } catch (e) {}
    const mode = String(kind || 'wind');
    const now = this.ctx.currentTime;
    const srcs = [];
    const lfos = [];
    const masterAmb = this.ctx.createGain();
    masterAmb.gain.setValueAtTime(0.0001, now);

    if (mode === 'fob') {
      // Concrete FOB hangar 55Hz power generator hum + sub-150Hz air handling rumble
      masterAmb.gain.exponentialRampToValueAtTime(0.072, now + 1.6);
      const hum = this.ctx.createOscillator();
      hum.type = 'sine';
      hum.frequency.setValueAtTime(55, now);
      const humG = this.ctx.createGain();
      humG.gain.setValueAtTime(0.22, now);
      hum.connect(humG);
      humG.connect(masterAmb);
      hum.start(now);
      lfos.push(hum);

      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(150, now);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.75, now);
      src.connect(lp);
      lp.connect(ng);
      ng.connect(masterAmb);
      src.start(now);
      srcs.push(src);
    } else if (mode === 'rumble') {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(120, now);
      masterAmb.gain.exponentialRampToValueAtTime(0.09, now + 2.0);
      src.connect(filt);
      filt.connect(masterAmb);
      src.start(now);
      srcs.push(src);
    } else if (mode === 'rain') {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'highpass';
      filt.frequency.setValueAtTime(2500, now);
      masterAmb.gain.exponentialRampToValueAtTime(0.032, now + 2.0);
      src.connect(filt);
      filt.connect(masterAmb);
      src.start(now);
      srcs.push(src);
    } else {
      // Warzone open-sector wind: 2 independent gust-modulated bands (300Hz low breeze + 1200Hz air sweep)
      masterAmb.gain.exponentialRampToValueAtTime(0.065, now + 2.0);
      const bands = [
        { freq: 300, q: 0.75, lfoRate: 0.085, lfoDepth: 110, gain: 0.75 },
        { freq: 1200, q: 0.90, lfoRate: 0.13, lfoDepth: 340, gain: 0.28 }
      ];
      for (const b of bands) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(b.freq, now);
        bp.Q.setValueAtTime(b.q, now);
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(b.lfoRate, now);
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(b.lfoDepth, now);
        const bg = this.ctx.createGain();
        bg.gain.setValueAtTime(b.gain, now);
        lfo.connect(lfoGain);
        lfoGain.connect(bp.frequency);
        src.connect(bp);
        bp.connect(bg);
        bg.connect(masterAmb);
        lfo.start(now);
        src.start(now);
        srcs.push(src);
        lfos.push(lfo);
      }
    }

    masterAmb.connect(this._bus('ambient'));
    this._ambient = { src: srcs[0] || null, srcs, lfos, gain: masterAmb, kind: mode };
    if (mode === 'wind') {
      this._scheduleNextBird();
    } else if (mode === 'fob') {
      this._scheduleFobChatter();
    }
    return this._ambient;
  }

  stopAmbient(silent) {
    if (this._birdTimer) {
      clearTimeout(this._birdTimer);
      this._birdTimer = null;
    }
    if (this._fobTimer) {
      clearTimeout(this._fobTimer);
      this._fobTimer = null;
    }
    const a = this._ambient;
    this._ambient = null;
    if (!a || !this.ctx) return;
    const allNodes = [...(a.srcs || []), ...(a.lfos || [])];
    try {
      const now = this.ctx.currentTime;
      if (silent) {
        for (const n of allNodes) { try { n.stop(now); } catch (e) {} }
      } else {
        a.gain.gain.cancelScheduledValues(now);
        a.gain.gain.setTargetAtTime(0.0001, now, 0.4);
        setTimeout(() => {
          for (const n of allNodes) { try { n.stop(); } catch (e) {} }
        }, 1500);
      }
    } catch (e) {}
  }
  _makeNoise(startTime, duration) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const maxOffset = Math.max(0.01, this.noiseBuffer.duration - duration - 0.05);
    src.start(startTime, Math.random() * maxOffset, duration);
    return src;
  }

  _weaponClass(weaponId) {
    if (weaponId === 'pm9' || weaponId === 'g17') return 'pistol';
    if (weaponId === 'm870') return 'shotgun';
    if (weaponId === 'm24' || weaponId === 'mosin9130' || weaponId === 'awm338') return 'sniper';
    if (weaponId === 'mp5k') return 'smg';
    return 'rifle';
  }

  _weaponCharacter(weaponId) {
    const map = {
      m4a1:     { bodyHz: 1380, bodyQ: 1.65, bodyDur: 0.068, thumpHz: 92, thumpDur: 0.078, thumpGain: 0.38 },
      ak47:     { bodyHz: 1100, bodyQ: 1.5, bodyDur: 0.075, thumpHz: 85, thumpDur: 0.090, thumpGain: 0.42 },
      mp5k:      { bodyHz: 1800, bodyQ: 2.0, bodyDur: 0.048, thumpHz: 95, thumpDur: 0.060, thumpGain: 0.30 },
      m870:      { bodyHz: 520,  bodyQ: 1.0, bodyDur: 0.145, thumpHz: 70, thumpDur: 0.140, thumpGain: 0.72 },
      m24:       { bodyHz: 820,  bodyQ: 1.3, bodyDur: 0.165, thumpHz: 55, thumpDur: 0.160, thumpGain: 0.65 },
      mosin9130: { bodyHz: 940,  bodyQ: 1.4, bodyDur: 0.155, thumpHz: 58, thumpDur: 0.150, thumpGain: 0.62 },
      awm338:    { bodyHz: 700,  bodyQ: 1.2, bodyDur: 0.195, thumpHz: 52, thumpDur: 0.180, thumpGain: 0.78 },
      g17:       { bodyHz: 2200, bodyQ: 2.2, bodyDur: 0.052, thumpHz: 110, thumpDur: 0.065, thumpGain: 0.34 },
      pm9:       { bodyHz: 2100, bodyQ: 2.4, bodyDur: 0.055, thumpHz: 118, thumpDur: 0.060, thumpGain: 0.32 }
    };
    return map[weaponId] || map.ak47;
  }

  playGunshot(weaponId, distance = 0, suppressed = false, opts = {}) {
    if (this.muted || !this.ctx || !this.gunBus) return;
    // Cap simultaneous remote AI/ally gunshots within 50ms window to prevent WebAudio Convolver spikes
    if (distance > 1.5) {
      const nowMs = performance.now();
      if (!this._recentRemoteShots) this._recentRemoteShots = [];
      const q = this._recentRemoteShots;
      while (q.length > 0 && nowMs - q[0] > 50) q.shift();
      if (q.length >= 5) return;
      q.push(nowMs);
    }
    const now = this.ctx.currentTime;
    const wCls = this._weaponClass(weaponId);
    const isDistant = distance >= 60;
    const speedDelay = isDistant ? Math.min(0.9, distance / 343) : 0;
    const t0 = now + speedDelay;
    const distAtten = Math.max(0.05, 1 / (1 + distance * 0.032));
    const vol = distAtten * (suppressed ? 0.52 : 1.0);
    const airCutoff = Math.max(850, 14000 / (1 + distance * 0.085));

    // Shared shot mix filter -> optional StereoPannerNode -> gunBus (+ outdoor tailBus)
    const shotOut = this.ctx.createBiquadFilter();
    shotOut.type = 'lowpass';
    shotOut.frequency.setValueAtTime(suppressed ? Math.min(airCutoff, 3000) : airCutoff, t0);

    let routeOut = shotOut;
    let panner = null;
    if (opts && typeof opts.pan === 'number' && isFinite(opts.pan) && this.ctx.createStereoPanner) {
      panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, opts.pan)), t0);
      shotOut.connect(panner);
      routeOut = panner;
    }
    routeOut.connect(this.gunBus);

    // Outdoor canyon / valley tail send (attenuated indoors) + close indoor concrete room reflection
    let tailG = null;
    if (this.tailBus) {
      let sendAmt = suppressed ? (0.04 * distAtten) : ((0.22 + Math.min(0.4, distance * 0.004)) * distAtten);
      if (this.indoor) sendAmt *= 0.3;
      if (sendAmt > 0.002) {
        tailG = this.ctx.createGain();
        tailG.gain.setValueAtTime(sendAmt, t0);
        routeOut.connect(tailG);
        tailG.connect(this.tailBus);
      }
    }
    let roomSendG = null;
    if (this.indoor && !isDistant && this.roomBus) {
      const roomSendAmt = (suppressed ? 0.12 : 0.38) * distAtten;
      if (roomSendAmt > 0.002) {
        roomSendG = this.ctx.createGain();
        roomSendG.gain.setValueAtTime(roomSendAmt, t0);
        routeOut.connect(roomSendG);
        roomSendG.connect(this.roomBus);
      }
    }
    // Release shot mix/send nodes after audio finishes so gunBus/tailBus/roomBus never accumulate live filter chains
    setTimeout(() => {
      try { shotOut.disconnect(); } catch (e) {}
      if (panner) { try { panner.disconnect(); } catch (e) {} }
      if (tailG) { try { tailG.disconnect(); } catch (e) {} }
      if (roomSendG) { try { roomSendG.disconnect(); } catch (e) {} }
    }, Math.ceil((speedDelay + 0.48) * 1000));

    // (e) Distant gunfire model (>= 60m): skip CC0 close sample; supersonic crack (rifles/snipers) + distant lowpassed boom delayed by distance/343
    if (isDistant) {
      if (!suppressed && (wCls === 'rifle' || wCls === 'smg' || wCls === 'sniper')) {
        const crackN = this._makeNoise(t0, 0.016);
        const crackHP = this.ctx.createBiquadFilter();
        crackHP.type = 'highpass';
        crackHP.frequency.setValueAtTime(3000, t0);
        const crackG = this.ctx.createGain();
        crackG.gain.setValueAtTime(0.65 * distAtten, t0);
        crackG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.012);
        crackN.connect(crackHP);
        crackHP.connect(crackG);
        crackG.connect(shotOut);
      }
      const boomN = this._makeNoise(t0, 0.36);
      const boomLP = this.ctx.createBiquadFilter();
      boomLP.type = 'lowpass';
      boomLP.frequency.setValueAtTime(300, t0);
      const boomG = this.ctx.createGain();
      boomG.gain.setValueAtTime((suppressed ? 0.35 : 0.95) * vol, t0);
      boomG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      boomN.connect(boomLP);
      boomLP.connect(boomG);
      boomG.connect(shotOut);
      return;
    }

    // (f) Suppressed sub-baffle thump + (c) close-range chest punch + (b) per-class mechanical bolt/slide layer
    if (suppressed) {
      const thumpN = this._makeNoise(t0, 0.055);
      const thumpBP = this.ctx.createBiquadFilter();
      thumpBP.type = 'bandpass';
      thumpBP.frequency.setValueAtTime(700, t0);
      thumpBP.Q.setValueAtTime(1.4, t0);
      const thumpG = this.ctx.createGain();
      thumpG.gain.setValueAtTime(0.45 * distAtten, t0);
      thumpG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
      thumpN.connect(thumpBP);
      thumpBP.connect(thumpG);
      thumpG.connect(shotOut);
    }

    if (distance < 25) {
      const pOsc = this.ctx.createOscillator();
      pOsc.type = 'sine';
      pOsc.frequency.setValueAtTime(85, t0);
      pOsc.frequency.exponentialRampToValueAtTime(35, t0 + 0.06);
      const pGain = this.ctx.createGain();
      pGain.gain.setValueAtTime((suppressed ? 0.24 : 0.62) * distAtten, t0);
      pGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.062);
      pOsc.connect(pGain);
      pGain.connect(shotOut);
      pOsc.start(t0);
      pOsc.stop(t0 + 0.068);
    }

    const mechMult = suppressed ? 1.6 : 1.0;
    const mechStart = t0 + 0.015;
    if (wCls === 'rifle' || wCls === 'smg') {
      // Bolt clack (2.8kHz) + sear/spring ching (5.5kHz)
      const clackN = this._makeNoise(mechStart, 0.026);
      const clackBP = this.ctx.createBiquadFilter();
      clackBP.type = 'bandpass';
      clackBP.frequency.setValueAtTime(2800 * (0.95 + Math.random() * 0.1), mechStart);
      clackBP.Q.setValueAtTime(3.2, mechStart);
      const clackG = this.ctx.createGain();
      clackG.gain.setValueAtTime(0.18 * mechMult * distAtten, mechStart);
      clackG.gain.exponentialRampToValueAtTime(0.001, mechStart + 0.024);
      clackN.connect(clackBP);
      clackBP.connect(clackG);
      clackG.connect(shotOut);

      const ching = this.ctx.createOscillator();
      ching.type = 'triangle';
      ching.frequency.setValueAtTime(5500, mechStart + 0.003);
      const chingG = this.ctx.createGain();
      chingG.gain.setValueAtTime(0.055 * mechMult * distAtten, mechStart + 0.003);
      chingG.gain.exponentialRampToValueAtTime(0.001, mechStart + 0.022);
      ching.connect(chingG);
      chingG.connect(shotOut);
      ching.start(mechStart + 0.003);
      ching.stop(mechStart + 0.025);
      if (weaponId === 'm4a1') {
        // Subtle AR-15 buffer-spring harmonic ring inside receiver extension tube
        const bufOsc = this.ctx.createOscillator();
        bufOsc.type = 'sine';
        bufOsc.frequency.setValueAtTime(1680, mechStart);
        bufOsc.frequency.exponentialRampToValueAtTime(1520, mechStart + 0.042);
        const bufG = this.ctx.createGain();
        bufG.gain.setValueAtTime(0.032 * mechMult * distAtten, mechStart);
        bufG.gain.exponentialRampToValueAtTime(0.001, mechStart + 0.042);
        bufOsc.connect(bufG);
        bufG.connect(shotOut);
        bufOsc.start(mechStart);
        bufOsc.stop(mechStart + 0.045);
      }
    } else if (wCls === 'pistol') {
      // Crisp pistol slide snap
      const slideN = this._makeNoise(mechStart, 0.02);
      const slideBP = this.ctx.createBiquadFilter();
      slideBP.type = 'bandpass';
      slideBP.frequency.setValueAtTime(3600 * (0.95 + Math.random() * 0.1), mechStart);
      slideBP.Q.setValueAtTime(3.0, mechStart);
      const slideG = this.ctx.createGain();
      slideG.gain.setValueAtTime(0.16 * mechMult * distAtten, mechStart);
      slideG.gain.exponentialRampToValueAtTime(0.001, mechStart + 0.018);
      slideN.connect(slideBP);
      slideBP.connect(slideG);
      slideG.connect(shotOut);
    }

    // Tarkov-style weapon-specific close-range body & chest thump character layer (< 60m)
    const ch = this._weaponCharacter(weaponId);
    const charScale = vol * (suppressed ? 0.45 : 1.0);
    const chJitter = 0.94 + Math.random() * 0.12;
    const chN = this._makeNoise(t0, ch.bodyDur + 0.015);
    const chBP = this.ctx.createBiquadFilter();
    chBP.type = 'bandpass';
    chBP.frequency.setValueAtTime(ch.bodyHz * chJitter, t0);
    chBP.Q.setValueAtTime(ch.bodyQ, t0);
    const chG = this.ctx.createGain();
    chG.gain.setValueAtTime(0.42 * charScale, t0);
    chG.gain.exponentialRampToValueAtTime(0.001, t0 + ch.bodyDur);
    chN.connect(chBP);
    chBP.connect(chG);
    chG.connect(shotOut);

    const thOsc = this.ctx.createOscillator();
    thOsc.type = 'sine';
    thOsc.frequency.setValueAtTime(ch.thumpHz * chJitter, t0);
    thOsc.frequency.exponentialRampToValueAtTime(32, t0 + ch.thumpDur);
    const thG = this.ctx.createGain();
    thG.gain.setValueAtTime(ch.thumpGain * charScale, t0);
    thG.gain.exponentialRampToValueAtTime(0.001, t0 + ch.thumpDur);
    thOsc.connect(thG);
    thG.connect(shotOut);
    thOsc.start(t0);
    thOsc.stop(t0 + ch.thumpDur + 0.015);

    // (a) Real CC0 close/mid firearm sample layer (< 60m)
    const sampleKey = (weaponId === 'awm338' || weaponId === 'mosin9130') ? 'm24' : (weaponId === 'm4a1' ? 'ak47' : weaponId);
    const sampleBuf = this.gunBuffers[sampleKey] || this.gunBuffers.ak47;
    if (sampleBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = sampleBuf;
      const baseRate = weaponId === 'm4a1' ? 1.16 : (weaponId === 'awm338' ? 0.80 : (weaponId === 'mosin9130' ? 1.08 : 1.0));
      src.playbackRate.setValueAtTime(baseRate * (suppressed ? 1.18 : 1.0) * (0.96 + Math.random() * 0.08), t0);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(suppressed ? Math.min(airCutoff, 2400) : airCutoff, t0);

      const gain = this.ctx.createGain();
      const shotTrim = {
        pm9:   { hold: 0.055, end: 0.135 },
        g17:   { hold: 0.060, end: 0.145 },
        mp5k:  { hold: 0.048, end: 0.092 },
        m4a1:  { hold: 0.048, end: 0.094 },
        ak47: { hold: 0.052, end: 0.098 },
        m870:  { hold: 0.085, end: 0.240 },
        m24:   { hold: 0.055, end: 0.115 },
        mosin9130: { hold: 0.068, end: 0.145 },
        awm338:    { hold: 0.075, end: 0.175 }
      };
      const trim = shotTrim[weaponId] || shotTrim.ak47;
      const endDur = suppressed ? Math.min(trim.end, 0.085) : trim.end;
      const holdDur = suppressed ? Math.min(trim.hold, 0.025) : trim.hold;

      gain.gain.setValueAtTime(vol * 1.12, t0);
      gain.gain.setValueAtTime(vol * 1.12, t0 + holdDur);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + endDur);

      src.connect(lp);
      lp.connect(gain);
      gain.connect(shotOut);
      src.start(t0);
      src.stop(t0 + endDur + 0.015);
      return;
    }

    // Procedural fallback before WAV samples decode
    const profiles = {
      pm9:   { snapFreq: 2600, bodyFreq: 1150, bodyQ: 0.7, bodyDur: 0.095, subFreq: 115, subGain: 0.45, gain: 0.85 },
      g17:   { snapFreq: 2900, bodyFreq: 1300, bodyQ: 0.75, bodyDur: 0.09,  subFreq: 120, subGain: 0.48, gain: 0.90 },
      mp5k:  { snapFreq: 3100, bodyFreq: 1450, bodyQ: 0.8, bodyDur: 0.075, subFreq: 125, subGain: 0.42, gain: 0.82 },
      m4a1:  { snapFreq: 2850, bodyFreq: 1240, bodyQ: 0.72, bodyDur: 0.125, subFreq: 105, subGain: 0.62, gain: 1.00 },
      ak47: { snapFreq: 2400, bodyFreq: 980,  bodyQ: 0.65, bodyDur: 0.145, subFreq: 95,  subGain: 0.72, gain: 1.05 },
      m870:  { snapFreq: 1700, bodyFreq: 540,  bodyQ: 0.55, bodyDur: 0.24,  subFreq: 72,  subGain: 1.05, gain: 1.20 },
      m24:       { snapFreq: 2800, bodyFreq: 860,  bodyQ: 0.6,  bodyDur: 0.22,  subFreq: 80,  subGain: 0.92, gain: 1.18 },
      mosin9130: { snapFreq: 3000, bodyFreq: 940,  bodyQ: 0.62, bodyDur: 0.20,  subFreq: 86,  subGain: 0.88, gain: 1.16 },
      awm338:    { snapFreq: 2500, bodyFreq: 720,  bodyQ: 0.55, bodyDur: 0.28,  subFreq: 66,  subGain: 1.15, gain: 1.28 }
    };
    const p = profiles[weaponId] || profiles.ak47;
    const jitter = 0.92 + Math.random() * 0.16;

    const crackDur = suppressed ? 0.018 : 0.028;
    const crackNoise = this._makeNoise(t0, crackDur + 0.01);
    const crackHP = this.ctx.createBiquadFilter();
    crackHP.type = 'highpass';
    crackHP.frequency.setValueAtTime((suppressed ? 2400 : p.snapFreq) * jitter, t0);
    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime((suppressed ? 0.45 : 1.15) * p.gain * vol, t0);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t0 + crackDur);
    crackNoise.connect(crackHP);
    crackHP.connect(crackGain);
    crackGain.connect(shotOut);

    const bodyDur = suppressed ? p.bodyDur * 0.45 : p.bodyDur;
    const bodyNoise = this._makeNoise(t0, bodyDur + 0.02);
    const bodyBP = this.ctx.createBiquadFilter();
    bodyBP.type = 'bandpass';
    bodyBP.Q.setValueAtTime(p.bodyQ, t0);
    bodyBP.frequency.setValueAtTime((suppressed ? 1600 : p.bodyFreq) * jitter, t0);
    bodyBP.frequency.exponentialRampToValueAtTime((suppressed ? 420 : 210), t0 + bodyDur);
    const bodyGain = this.ctx.createGain();
    bodyGain.gain.setValueAtTime((suppressed ? 0.50 : 1.05) * p.gain * vol, t0);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t0 + bodyDur);
    bodyNoise.connect(bodyBP);
    bodyBP.connect(bodyGain);
    bodyGain.connect(shotOut);
  }

  playHitmarker(headshot = false) {
    if (this.muted || !this.ctx) return;
    // Prevent shotgun multi-pellet hits on the same frame from stacking 8x oscillators
    const nowMs = performance.now();
    if (this._lastHmMs && (nowMs - this._lastHmMs) < 22 && (!headshot || this._lastHmHead)) return;
    this._lastHmMs = nowMs;
    this._lastHmHead = !!headshot;
    const now = this.ctx.currentTime;
    // Warzone tactile hit tick: 4.5kHz bandpass burst (22ms) + 1.9kHz crisp sine ping (40ms)
    const tickN = this._makeNoise(now, 0.026);
    const tickBP = this.ctx.createBiquadFilter();
    tickBP.type = 'bandpass';
    tickBP.frequency.setValueAtTime(4500, now);
    tickBP.Q.setValueAtTime(2.2, now);
    const tickG = this.ctx.createGain();
    tickG.gain.setValueAtTime(0.24, now);
    tickG.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
    tickN.connect(tickBP);
    tickBP.connect(tickG);
    tickG.connect(this._bus('sfx'));

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1900, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.045);

    if (headshot) {
      // Warzone headshot "dink" bell partials (2.6kHz + 3.9kHz over 180ms)
      [2600, 3900].forEach((freq, idx) => {
        const bell = this.ctx.createOscillator();
        bell.type = 'sine';
        bell.frequency.setValueAtTime(freq, now);
        const bg = this.ctx.createGain();
        bg.gain.setValueAtTime(idx === 0 ? 0.16 : 0.11, now);
        bg.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        bell.connect(bg);
        bg.connect(this._bus('sfx'));
        bell.start(now);
        bell.stop(now + 0.19);
      });
    }
  }

  playArmorBreak() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Ceramic plate crack crunch (3 bursts between 2-6kHz over 120ms)
    [
      { t: 0.00, freq: 2200, dur: 0.045, vol: 0.24 },
      { t: 0.032, freq: 4100, dur: 0.045, vol: 0.28 },
      { t: 0.068, freq: 5800, dur: 0.052, vol: 0.22 }
    ].forEach((b) => {
      const ts = now + b.t;
      const n = this._makeNoise(ts, b.dur);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(b.freq, ts);
      bp.Q.setValueAtTime(2.0, ts);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(b.vol, ts);
      g.gain.exponentialRampToValueAtTime(0.001, ts + b.dur);
      n.connect(bp);
      bp.connect(g);
      g.connect(this._bus('sfx'));
    });

    // Warzone plate-shatter falling metallic tone (900 -> 300Hz)
    const tone = this.ctx.createOscillator();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(900, now);
    tone.frequency.exponentialRampToValueAtTime(300, now + 0.14);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.18, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    tone.connect(tg);
    tg.connect(this._bus('sfx'));
    tone.start(now);
    tone.stop(now + 0.16);
  }

  playKillConfirm() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Warzone kill-confirm low punch + sharp tick
    const thud = this.ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(140, now);
    thud.frequency.exponentialRampToValueAtTime(52, now + 0.11);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.28, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    thud.connect(tg);
    tg.connect(this._bus('sfx'));
    thud.start(now);
    thud.stop(now + 0.13);

    const tickN = this._makeNoise(now + 0.01, 0.02);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3600, now + 0.01);
    bp.Q.setValueAtTime(2.6, now + 0.01);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.20, now + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
    tickN.connect(bp);
    bp.connect(ng);
    ng.connect(this._bus('sfx'));

    const ch = this.ctx.createOscillator();
    ch.type = 'sine';
    ch.frequency.setValueAtTime(2200, now + 0.01);
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.12, now + 0.01);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    ch.connect(cg);
    cg.connect(this._bus('sfx'));
    ch.start(now + 0.01);
    ch.stop(now + 0.06);
  }

  playEmptyClick() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1600, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    osc.connect(gain);
    gain.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.03);
  }

  _playMetallicClick(time, freq, q, dur, vol, hpFreq = 900) {
    const n = this._makeNoise(time, dur);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(freq, time);
    bp.Q.setValueAtTime(q, time);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(hpFreq, time);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    n.connect(bp);
    bp.connect(hp);
    hp.connect(g);
    g.connect(this._bus('sfx'));
  }

  playMagOut(weaponId = 'ak47') {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const wCls = this._weaponClass(weaponId);
    const pm = wCls === 'pistol' ? 1.28 : (wCls === 'smg' ? 1.12 : (wCls === 'sniper' ? 0.82 : (wCls === 'shotgun' ? 0.86 : 1.0)));
    const isSteel = weaponId === 'm4a1' || weaponId === 'ak47' || weaponId === 'mp5k' || weaponId === 'awm338' || weaponId === 'm24';

    // 1. Magazine catch release click
    this._playMetallicClick(now, 2150 * pm, 3.2, 0.026, 0.24, 950);
    // 2. Magwell slide-out scrape (1200 -> 600Hz scaled by weapon class pitch over 120ms)
    const slideDur = 0.12;
    const slide = this._makeNoise(now + 0.018, slideDur);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1200 * pm, now + 0.018);
    bp.frequency.exponentialRampToValueAtTime(600 * pm, now + 0.018 + slideDur);
    bp.Q.setValueAtTime(1.9, now + 0.018);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, now + 0.018);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.018 + slideDur);
    slide.connect(bp);
    bp.connect(g);
    g.connect(this._bus('sfx'));
    if (isSteel) {
      this._playMetallicClick(now + 0.075, 1150 * pm, 2.5, 0.042, 0.17, 500);
    }
  }

  playMagIn(weaponId = 'ak47') {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const wCls = this._weaponClass(weaponId);
    const pm = wCls === 'pistol' ? 1.28 : (wCls === 'smg' ? 1.12 : (wCls === 'sniper' ? 0.82 : (wCls === 'shotgun' ? 0.86 : 1.0)));
    const isMosin = weaponId === 'mosin9130';

    if (isMosin) {
      for (let i = 0; i < 5; i++) {
        this._playMetallicClick(now + i * 0.036, 2600 + i * 180, 4.0, 0.026, 0.17, 1200);
      }
      const ping = this.ctx.createOscillator();
      ping.type = 'sine';
      ping.frequency.setValueAtTime(3420, now + 0.18);
      const pg = this.ctx.createGain();
      pg.gain.setValueAtTime(0.06, now + 0.18);
      pg.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      ping.connect(pg);
      pg.connect(this._bus('sfx'));
      ping.start(now + 0.18);
      ping.stop(now + 0.35);
      return;
    }

    // 1. Mag slide-in guide scrape (0 -> 85ms)
    this._playMetallicClick(now, 1050 * pm, 1.8, 0.085, 0.15, 480);
    // 2. Hard metallic latch click & solid receiver thump at +90ms
    const lockT = now + 0.09;
    this._playMetallicClick(lockT, 2750 * pm, 3.8, 0.038, 0.30, 1100);
    const thump = this.ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(165 * pm, lockT);
    thump.frequency.exponentialRampToValueAtTime(55 * pm, lockT + 0.065);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.24, lockT);
    tg.gain.exponentialRampToValueAtTime(0.001, lockT + 0.07);
    thump.connect(tg);
    tg.connect(this._bus('sfx'));
    thump.start(lockT);
    thump.stop(lockT + 0.075);
  }

  playRechamber(weaponId = 'ak47') {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const wCls = this._weaponClass(weaponId);
    const pm = wCls === 'pistol' ? 1.28 : (wCls === 'smg' ? 1.12 : (wCls === 'sniper' ? 0.82 : (wCls === 'shotgun' ? 0.86 : 1.0)));

    // 1. Pull-back carrier rattle / unlock scrape
    this._playMetallicClick(now, 1850 * pm, 2.2, 0.085, 0.24, 650);
    this._playMetallicClick(now + 0.045, 2500 * pm, 3.2, 0.045, 0.20, 950);

    // 2. Spring-driven release slam forward at +140ms with solid receiver thump
    const slamT = now + 0.14;
    this._playMetallicClick(slamT, 2900 * pm, 3.8, 0.042, 0.32, 1100);
    const thump = this.ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(150 * pm, slamT);
    thump.frequency.exponentialRampToValueAtTime(52 * pm, slamT + 0.075);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.26, slamT);
    tg.gain.exponentialRampToValueAtTime(0.001, slamT + 0.08);
    thump.connect(tg);
    tg.connect(this._bus('sfx'));
    thump.start(slamT);
    thump.stop(slamT + 0.085);
  }

  playFootstep(sprinting = false, surface = 'grass') {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const surf = surface || 'grass';

    const triggerStep = (t, amp) => {
      const n = this._makeNoise(t, 0.09);
      const filt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      let vol = amp;

      if (surf === 'concrete') {
        filt.type = 'bandpass';
        filt.frequency.setValueAtTime(1800 * (0.94 + Math.random() * 0.12), t);
        filt.Q.setValueAtTime(1.4, t);
        vol *= 1.05;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      } else if (surf === 'dirt') {
        filt.type = 'bandpass';
        filt.frequency.setValueAtTime(600 * (0.94 + Math.random() * 0.12), t);
        filt.Q.setValueAtTime(1.1, t);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.068);
      } else if (surf === 'metal') {
        filt.type = 'bandpass';
        filt.frequency.setValueAtTime(2400 * (0.94 + Math.random() * 0.12), t);
        filt.Q.setValueAtTime(2.6, t);
        g.gain.setValueAtTime(vol * 1.05, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        const ring = this.ctx.createOscillator();
        ring.type = 'triangle';
        ring.frequency.setValueAtTime(1180, t);
        ring.frequency.exponentialRampToValueAtTime(920, t + 0.11);
        const rg = this.ctx.createGain();
        rg.gain.setValueAtTime(vol * 0.25, t);
        rg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        ring.connect(rg);
        rg.connect(this._bus('foot'));
        ring.start(t);
        ring.stop(t + 0.125);
      } else if (surf === 'wood') {
        filt.type = 'bandpass';
        filt.frequency.setValueAtTime(900 * (0.94 + Math.random() * 0.12), t);
        filt.Q.setValueAtTime(2.2, t);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
        const hollow = this.ctx.createOscillator();
        hollow.type = 'sine';
        hollow.frequency.setValueAtTime(190, t);
        hollow.frequency.exponentialRampToValueAtTime(95, t + 0.08);
        const hg = this.ctx.createGain();
        hg.gain.setValueAtTime(vol * 0.45, t);
        hg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        hollow.connect(hg);
        hg.connect(this._bus('foot'));
        hollow.start(t);
        hollow.stop(t + 0.085);
      } else {
        // Default grass: soft lowpass 900Hz brush
        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(900 * (0.94 + Math.random() * 0.12), t);
        vol *= 0.85;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      }

      n.connect(filt);
      filt.connect(g);
      g.connect(this._bus('foot'));
    };

    const baseAmp = sprinting ? 0.095 : 0.05;
    // Two transients: heel impact + toe roll at +45ms
    triggerStep(now, baseAmp);
    triggerStep(now + 0.045, baseAmp * 0.72);

    // Tactical chest rig / magazine pouch gear rattle when sprinting
    if (sprinting) {
      const gearN = this._makeNoise(now + 0.01, 0.06);
      const gearHP = this.ctx.createBiquadFilter();
      gearHP.type = 'highpass';
      gearHP.frequency.setValueAtTime(5000, now + 0.01);
      const gearG = this.ctx.createGain();
      gearG.gain.setValueAtTime(0.028, now + 0.01);
      gearG.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      gearN.connect(gearHP);
      gearHP.connect(gearG);
      gearG.connect(this._bus('foot'));
    }
  }

  playSlide() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Gravel & tactical gear slide whoosh
    const noise = this._makeNoise(now, 0.52);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(920, now);
    bp.frequency.exponentialRampToValueAtTime(340, now + 0.48);
    bp.Q.setValueAtTime(0.9, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.50);
    noise.connect(bp);
    bp.connect(gain);
    gain.connect(this._bus('foot'));
  }

  playPinPull() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1850, now);
    osc.frequency.exponentialRampToValueAtTime(2900, now + 0.06);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playCookTick(urgent = false) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(urgent ? 1280 : 880, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(urgent ? 0.12 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.045);
  }

  playThrowWhoosh(isKnife = false) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const noise = this._makeNoise(now, 0.16);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isKnife ? 1600 : 750, now);
    bp.frequency.exponentialRampToValueAtTime(isKnife ? 600 : 320, now + 0.14);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    noise.connect(bp);
    bp.connect(gain);
    gain.connect(this._bus('sfx'));
  }

  playGrenadeBounce() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.05);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain);
    gain.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playExplosion(distance = 0, opts = {}) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const delay = distance > 30 ? Math.min(0.9, distance / 343) : 0;
    const t0 = now + delay;
    const vol = Math.max(0.15, 1.0 - distance / 68);

    let outDest = this._bus('sfx');
    if (opts && typeof opts.pan === 'number' && isFinite(opts.pan) && this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, opts.pan)), t0);
      panner.connect(this._bus('sfx'));
      outDest = panner;
    }

    // 1. Sharp supersonic fragmentation crack
    const crack = this._makeNoise(t0, 0.04);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2200, t0);
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.75 * vol, t0);
    cg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.036);
    crack.connect(hp);
    hp.connect(cg);
    cg.connect(outDest);

    // 2. Sub-bass shockwave sweep (80 -> 28Hz over 0.6s)
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(80, t0);
    sub.frequency.exponentialRampToValueAtTime(28, t0 + 0.6);
    const subG = this.ctx.createGain();
    subG.gain.setValueAtTime(0.90 * vol, t0);
    subG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.62);
    sub.connect(subG);
    subG.connect(outDest);
    sub.start(t0);
    sub.stop(t0 + 0.65);

    // 3. Big lowpassed blast boom (0.9s) + send into outdoor echo tailBus
    const boomN = this._makeNoise(t0, 0.92);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1900, t0);
    lp.frequency.exponentialRampToValueAtTime(150, t0 + 0.88);
    const nG = this.ctx.createGain();
    nG.gain.setValueAtTime(0.82 * vol, t0);
    nG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.90);
    boomN.connect(lp);
    lp.connect(nG);
    nG.connect(outDest);
    if (this.tailBus) {
      const revG = this.ctx.createGain();
      revG.gain.setValueAtTime(0.35 * vol, t0);
      nG.connect(revG);
      revG.connect(this.tailBus);
    }

    // 4. Flying shrapnel & falling debris rattle (12 random bandpass clicks over 1.2s)
    for (let i = 0; i < 12; i++) {
      const dtClick = 0.08 + Math.random() * 1.12;
      const tc = t0 + dtClick;
      const dn = this._makeNoise(tc, 0.025);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(950 + Math.random() * 2800, tc);
      bp.Q.setValueAtTime(2.8, tc);
      const dg = this.ctx.createGain();
      dg.gain.setValueAtTime((0.12 + Math.random() * 0.14) * vol * (1 - dtClick / 1.3), tc);
      dg.gain.exponentialRampToValueAtTime(0.001, tc + 0.024);
      dn.connect(bp);
      bp.connect(dg);
      dg.connect(outDest);
    }
  }

  playSmokeHiss() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const noise = this._makeNoise(now, 1.8);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200, now);
    bp.frequency.linearRampToValueAtTime(1800, now + 1.6);
    bp.Q.setValueAtTime(1.2, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.75);
    noise.connect(bp);
    bp.connect(gain);
    gain.connect(this._bus('sfx'));
  }

  playConcussion(distance = 0) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const vol = Math.max(0.18, 1.0 - distance / 45);
    const noise = this._makeNoise(now, 0.32);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(900, now);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.65 * vol, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    noise.connect(hp);
    hp.connect(ng);
    ng.connect(this._bus('sfx'));

    // High-pitched stun crack ring
    const ring = this.ctx.createOscillator();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(2400, now);
    ring.frequency.exponentialRampToValueAtTime(1800, now + 0.45);
    const rg = this.ctx.createGain();
    rg.gain.setValueAtTime(0.12 * vol, now);
    rg.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    ring.connect(rg);
    rg.connect(this._bus('sfx'));
    ring.start(now);
    ring.stop(now + 0.48);
  }

  playHeal() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.3);
  }

  playMedLatch(closing = false) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Crisp tactical plastic case clasp click
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(closing ? 640 : 980, now);
    osc.frequency.exponentialRampToValueAtTime(closing ? 220 : 420, now + 0.045);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.055);
  }

  playMedItem(type = 'stim') {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (type === 'cap') {
      // Crisp polymer safety-cap thumb snap
      const pop = this.ctx.createOscillator();
      pop.type = 'triangle';
      pop.frequency.setValueAtTime(1650, now);
      pop.frequency.exponentialRampToValueAtTime(520, now + 0.032);
      const pg = this.ctx.createGain();
      pg.gain.setValueAtTime(0.15, now);
      pg.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
      pop.connect(pg);
      pg.connect(this._bus('sfx'));
      pop.start(now);
      pop.stop(now + 0.042);
    } else if (type === 'stim') {
      // Heavy spring-loaded auto-injector thud + metallic needle click + pressurized bio-fluid hiss
      const thud = this.ctx.createOscillator();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(195, now);
      thud.frequency.exponentialRampToValueAtTime(58, now + 0.065);
      const tg = this.ctx.createGain();
      tg.gain.setValueAtTime(0.22, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      thud.connect(tg);
      tg.connect(this._bus('sfx'));
      thud.start(now);
      thud.stop(now + 0.08);

      const click = this.ctx.createOscillator();
      click.type = 'square';
      click.frequency.setValueAtTime(1550, now + 0.008);
      click.frequency.exponentialRampToValueAtTime(340, now + 0.038);
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.15, now + 0.008);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.042);
      click.connect(cg);
      cg.connect(this._bus('sfx'));
      click.start(now + 0.008);
      click.stop(now + 0.045);

      const hiss = this._makeNoise(now + 0.025, 0.38);
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(4400, now + 0.025);
      hp.frequency.exponentialRampToValueAtTime(2600, now + 0.38);
      hp.Q.setValueAtTime(2.2, now + 0.025);
      const hg = this.ctx.createGain();
      hg.gain.setValueAtTime(0.11, now + 0.025);
      hg.gain.exponentialRampToValueAtTime(0.001, now + 0.39);
      hiss.connect(hp);
      hp.connect(hg);
      hg.connect(this._bus('sfx'));
    } else if (type === 'bandage') {
      // Taut sterile gauze wrap swish + crisp Velcro trauma-strap cinch rip
      [0, 0.30].forEach((offset) => {
        const swish = this._makeNoise(now + offset, 0.22);
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1050, now + offset);
        bp.frequency.linearRampToValueAtTime(1850, now + offset + 0.18);
        bp.Q.setValueAtTime(1.5, now + offset);
        const sg = this.ctx.createGain();
        sg.gain.setValueAtTime(0.001, now + offset);
        sg.gain.linearRampToValueAtTime(0.12, now + offset + 0.06);
        sg.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.21);
        swish.connect(bp);
        bp.connect(sg);
        sg.connect(this._bus('sfx'));
      });
      const cinch = this._makeNoise(now + 0.56, 0.11);
      const vbp = this.ctx.createBiquadFilter();
      vbp.type = 'bandpass';
      vbp.frequency.setValueAtTime(2900, now + 0.56);
      vbp.Q.setValueAtTime(2.6, now + 0.56);
      const vg = this.ctx.createGain();
      vg.gain.setValueAtTime(0.11, now + 0.56);
      vg.gain.exponentialRampToValueAtTime(0.001, now + 0.66);
      cinch.connect(vbp);
      vbp.connect(vg);
      vg.connect(this._bus('sfx'));
    } else {
      // Pills: dry plastic bottle double rattle
      [0, 0.055, 0.16, 0.215].forEach((offset, idx) => {
        const rattle = this._makeNoise(now + offset, 0.04);
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2600 + (idx % 2) * 700, now + offset);
        bp.Q.setValueAtTime(3.5, now + offset);
        const rg = this.ctx.createGain();
        rg.gain.setValueAtTime(0.13, now + offset);
        rg.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.038);
        rattle.connect(bp);
        bp.connect(rg);
        rg.connect(this._bus('sfx'));
      });
    }
  }

  playDamage() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.14);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playAlert(isCombat = true) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = isCombat ? 'square' : 'triangle';
    if (isCombat) {
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.setValueAtTime(1240, now + 0.06);
    } else {
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.12);
    }
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isCombat ? 0.14 : 0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playPlateInsert() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Highpassed nylon plate-carrier Velcro rip crackle (0.18s)
    const vNoise = this._makeNoise(now, 0.20);
    const vHP = this.ctx.createBiquadFilter();
    vHP.type = 'highpass';
    vHP.frequency.setValueAtTime(2400, now);
    const vBP = this.ctx.createBiquadFilter();
    vBP.type = 'bandpass';
    vBP.frequency.setValueAtTime(3400, now);
    vBP.Q.setValueAtTime(1.1, now);
    const vG = this.ctx.createGain();
    vG.gain.setValueAtTime(0.18, now);
    vG.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    vNoise.connect(vHP);
    vHP.connect(vBP);
    vBP.connect(vG);
    vG.connect(this._bus('sfx'));

    // Crackle bursts along the rip
    for (let i = 0; i < 6; i++) {
      const ct = now + i * 0.028;
      const cn = this._makeNoise(ct, 0.014);
      const cBP = this.ctx.createBiquadFilter();
      cBP.type = 'bandpass';
      cBP.frequency.setValueAtTime(2900 + Math.random() * 1400, ct);
      cBP.Q.setValueAtTime(2.8, ct);
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.14, ct);
      cg.gain.exponentialRampToValueAtTime(0.001, ct + 0.013);
      cn.connect(cBP);
      cBP.connect(cg);
      cg.connect(this._bus('sfx'));
    }

    // 2. Heavy SAPI ceramic armor plate seat thunk (+0.22s): 90Hz sine + 600Hz bandpass knock
    const thunkT = now + 0.22;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, thunkT);
    osc.frequency.exponentialRampToValueAtTime(40, thunkT + 0.11);
    const oGain = this.ctx.createGain();
    oGain.gain.setValueAtTime(0.38, thunkT);
    oGain.gain.exponentialRampToValueAtTime(0.001, thunkT + 0.12);
    osc.connect(oGain);
    oGain.connect(this._bus('sfx'));
    osc.start(thunkT);
    osc.stop(thunkT + 0.13);

    const kN = this._makeNoise(thunkT, 0.055);
    const kBP = this.ctx.createBiquadFilter();
    kBP.type = 'bandpass';
    kBP.frequency.setValueAtTime(600, thunkT);
    kBP.Q.setValueAtTime(2.0, thunkT);
    const kG = this.ctx.createGain();
    kG.gain.setValueAtTime(0.30, thunkT);
    kG.gain.exponentialRampToValueAtTime(0.001, thunkT + 0.05);
    kN.connect(kBP);
    kBP.connect(kG);
    kG.connect(this._bus('sfx'));
  }

  playZipper(closing = false) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Authentic tooth-by-tooth tactical carrier zipper pull (~0.45s, 23 individual 3-5kHz bandpassed teeth ticks)
    const count = 23;
    const totalDur = 0.45;
    let t = now;
    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1);
      // Accelerating when closing, decelerating when pulling open
      const stepFactor = closing ? (1.35 - frac * 0.70) : (0.65 + frac * 0.70);
      const step = (totalDur / count) * stepFactor;
      const tickDur = 0.012;
      const n = this._makeNoise(t, tickDur + 0.004);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      const baseHz = closing ? (3100 + frac * 1700) : (4800 - frac * 1700);
      bp.frequency.setValueAtTime(baseHz + (Math.random() - 0.5) * 280, t);
      bp.Q.setValueAtTime(5.5, t);
      const g = this.ctx.createGain();
      const env = Math.sin(frac * Math.PI) * 0.4 + 0.6;
      g.gain.setValueAtTime(0.11 * env, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + tickDur);
      n.connect(bp);
      bp.connect(g);
      g.connect(this._bus('sfx'));
      t += step;
    }
  }

  playSelectorMove() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Tight Warzone 6ms crisp 3.2kHz UI click
    const n = this._makeNoise(now, 0.008);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200, now);
    bp.Q.setValueAtTime(3.0, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.006);
    n.connect(bp);
    bp.connect(g);
    g.connect(this._bus('sfx'));
  }

  playInvPickup() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Tactical cloth rustle + crisp latch click
    const n = this._makeNoise(now, 0.055);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1850, now);
    bp.Q.setValueAtTime(1.5, now);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.09, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.052);
    n.connect(bp);
    bp.connect(ng);
    ng.connect(this._bus('sfx'));

    this._playMetallicClick(now + 0.012, 2600, 3.0, 0.014, 0.12, 1200);
  }

  playInvDrop() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Soft low thud onto ground/pack
    const thud = this.ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(180, now);
    thud.frequency.exponentialRampToValueAtTime(62, now + 0.065);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.12, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.068);
    thud.connect(tg);
    tg.connect(this._bus('sfx'));
    thud.start(now);
    thud.stop(now + 0.072);

    const n = this._makeNoise(now, 0.055);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, now);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.09, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.052);
    n.connect(lp);
    lp.connect(ng);
    ng.connect(this._bus('sfx'));
  }

  playUavPhoneTap() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    [1180, 1680].forEach((freq, i) => {
      const t = now + i * 0.07;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      osc.connect(g);
      g.connect(this._bus('sfx'));
      osc.start(t);
      osc.stop(t + 0.07);
    });
  }

  playDesignatorLock() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    [880, 1320, 1760].forEach((freq, i) => {
      const t = now + i * 0.055;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(g);
      g.connect(this._bus('sfx'));
      osc.start(t);
      osc.stop(t + 0.055);
    });
  }

  playA10Strafe(distance = 25) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const vol = Math.max(0.24, Math.min(1.0, 1.15 - distance / 190));

    // 1. Twin-Turbofan A-10 Doppler Jet Flyby Roar
    const jetNoise = this._makeNoise(now, 3.1);
    const jetBp = this.ctx.createBiquadFilter();
    jetBp.type = 'bandpass';
    jetBp.Q.setValueAtTime(1.1, now);
    jetBp.frequency.setValueAtTime(260, now);
    jetBp.frequency.exponentialRampToValueAtTime(880, now + 0.95);
    jetBp.frequency.exponentialRampToValueAtTime(190, now + 2.95);
    const jetG = this.ctx.createGain();
    jetG.gain.setValueAtTime(0.001, now);
    jetG.gain.linearRampToValueAtTime(0.38 * vol, now + 0.85);
    jetG.gain.exponentialRampToValueAtTime(0.001, now + 3.05);
    jetNoise.connect(jetBp);
    jetBp.connect(jetG);
    jetG.connect(this._bus('sfx'));

    // 2. Authentic GAU-8 Avenger 30mm Rotary Cannon Burst (65 rounds/sec real ballistic explosive impulses!)
    //    Synthesizes ~72 individual broadband explosive gun-blast transients spaced every 15.4ms
    const brtStart = now + 0.24;
    const brtDur = 1.18;
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * (brtDur + 0.15));
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    const periodSamples = Math.floor(sr / 65); // 3,900 RPM = 65 shots/sec!
    const totalShots = Math.floor((brtDur * sr) / periodSamples);
    for (let s = 0; s < totalShots; s++) {
      const startIdx = s * periodSamples;
      const jitter = Math.floor((Math.random() - 0.5) * 18);
      const base = Math.max(0, startIdx + jitter);
      const burstLen = Math.min(periodSamples * 1.45, len - base);
      const amp = 0.85 + Math.random() * 0.30;
      for (let i = 0; i < burstLen; i++) {
        const t = i / sr;
        // Sharp explosive crack + punchy 30mm cannon chamber bark
        const env = Math.exp(-t * 155);
        const punch = Math.sin(2 * Math.PI * (145 - t * 3200) * t) * Math.exp(-t * 190) * 0.65;
        const crack = (Math.random() * 2 - 1) * env;
        data[base + i] = Math.max(-1, Math.min(1, data[base + i] + (crack * 0.85 + punch) * amp));
      }
    }

    const brtSrc = this.ctx.createBufferSource();
    brtSrc.buffer = buf;

    // Shape with realistic distant atmospheric cannon air-absorption + low-mid cannon bark
    const airLp = this.ctx.createBiquadFilter();
    airLp.type = 'lowpass';
    airLp.frequency.setValueAtTime(Math.max(1600, 5200 / (1 + distance * 0.015)), brtStart);

    const barkEq = this.ctx.createBiquadFilter();
    barkEq.type = 'peaking';
    barkEq.frequency.setValueAtTime(240, brtStart);
    barkEq.Q.setValueAtTime(0.9, brtStart);
    barkEq.gain.setValueAtTime(8.5, brtStart);

    const brtG = this.ctx.createGain();
    brtG.gain.setValueAtTime(0.001, brtStart);
    brtG.gain.linearRampToValueAtTime(1.15 * vol, brtStart + 0.025);
    brtG.gain.setValueAtTime(1.10 * vol, brtStart + brtDur - 0.08);
    brtG.gain.exponentialRampToValueAtTime(0.001, brtStart + brtDur + 0.12);

    brtSrc.connect(barkEq);
    barkEq.connect(airLp);
    airLp.connect(brtG);
    brtG.connect(this.gunBus || this._bus('sfx'));
    if (this.reverbSend) {
      const revG = this.ctx.createGain();
      revG.gain.setValueAtTime(0.32 * vol, brtStart);
      brtG.connect(revG);
      revG.connect(this.reverbSend);
    }
    brtSrc.start(brtStart);
  }

  playCannonImpact(distance = 25) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const vol = Math.max(0.14, Math.min(0.85, 0.95 - distance / 110));
    const noise = this._makeNoise(now, 0.24);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, now);
    lp.frequency.exponentialRampToValueAtTime(260, now + 0.22);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55 * vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    noise.connect(lp);
    lp.connect(g);
    g.connect(this._bus('sfx'));
  }

  playDoorOpen(isPeek = false) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const vol = isPeek ? 0.22 : 0.42;
    // Metallic latch click
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isPeek ? 640 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.045);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.06);

    // Subtle hinge creak / wood whoosh
    const n = this._makeNoise(now + 0.02, isPeek ? 0.14 : 0.22);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isPeek ? 420 : 280, now + 0.02);
    bp.Q.value = 3.0;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.45, now + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.001, now + (isPeek ? 0.16 : 0.24));
    n.connect(bp);
    bp.connect(ng);
    ng.connect(this._bus('sfx'));

    // Rusty metal hinge squeak on full door swing
    if (!isPeek) {
      const sqT = now + 0.05;
      const sq = this.ctx.createOscillator();
      sq.type = 'sine';
      sq.frequency.setValueAtTime(920, sqT);
      sq.frequency.exponentialRampToValueAtTime(760, sqT + 0.16);
      const sqBP = this.ctx.createBiquadFilter();
      sqBP.type = 'bandpass';
      sqBP.frequency.setValueAtTime(840, sqT);
      sqBP.Q.setValueAtTime(7.0, sqT);
      const sqG = this.ctx.createGain();
      sqG.gain.setValueAtTime(0.045, sqT);
      sqG.gain.exponentialRampToValueAtTime(0.001, sqT + 0.17);
      sq.connect(sqBP);
      sqBP.connect(sqG);
      sqG.connect(this._bus('sfx'));
      sq.start(sqT);
      sq.stop(sqT + 0.18);
    }
  }

  playDoorClose() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Wood thump into frame + metallic latch settle
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(g);
    g.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.12);
    this._playMetallicClick(now + 0.02, 1650, 3.0, 0.018, 0.14, 900);
  }

  playDoorBash() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Heavy tactical shoulder-bash THUD (sub-bass punch + splintering frame crunch)
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(128, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.18);
    const subG = this.ctx.createGain();
    subG.gain.setValueAtTime(0.95, now);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    sub.connect(subG);
    subG.connect(this._bus('sfx'));
    sub.start(now);
    sub.stop(now + 0.23);

    const slap = this._makeNoise(now, 0.16);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, now);
    lp.frequency.exponentialRampToValueAtTime(180, now + 0.16);
    const slapG = this.ctx.createGain();
    slapG.gain.setValueAtTime(0.85, now);
    slapG.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    slap.connect(lp);
    lp.connect(slapG);
    slapG.connect(this._bus('sfx'));

    const crunch = this._makeNoise(now + 0.015, 0.12);
    const cHP = this.ctx.createBiquadFilter();
    cHP.type = 'bandpass';
    cHP.frequency.setValueAtTime(2100, now + 0.015);
    cHP.Q.setValueAtTime(1.4, now + 0.015);
    const cG = this.ctx.createGain();
    cG.gain.setValueAtTime(0.32, now + 0.015);
    cG.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    crunch.connect(cHP);
    cHP.connect(cG);
    cG.connect(this._bus('sfx'));
  }

  // ==================== GRITTY TARKOV UI & FOLEY ====================
  playClick() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const n = this._makeNoise(now, 0.014);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2200, now);
    bp.Q.setValueAtTime(3.2, now);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.14, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
    n.connect(bp);
    bp.connect(ng);
    ng.connect(this._bus('sfx'));

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.028);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.15, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.030);
    osc.connect(og);
    og.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.034);
  }

  playUiConfirm() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    this._playMetallicClick(now, 2400, 3.0, 0.020, 0.15, 1100);
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.055);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(g);
    g.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.065);
    this._playMetallicClick(now + 0.045, 3100, 3.4, 0.018, 0.12, 1400);
  }

  playUiBack() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(78, now + 0.06);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.17, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(g);
    g.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.07);
    this._playMetallicClick(now, 1150, 2.5, 0.015, 0.10, 600);
  }

  playUiError() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.095;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(480, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this._bus('sfx'));
      osc.start(t);
      osc.stop(t + 0.07);
    }
  }

  playTabSwitch() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const n = this._makeNoise(now, 0.020);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(2600, now);
    hp.Q.setValueAtTime(2.0, now);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.12, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    n.connect(hp);
    hp.connect(ng);
    ng.connect(this._bus('sfx'));

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(215, now);
    osc.frequency.exponentialRampToValueAtTime(125, now + 0.025);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.10, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
    osc.connect(og);
    og.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.032);
  }

  playPurchase() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    this._playMetallicClick(now, 2400, 3.2, 0.018, 0.16, 1100);
    this._playMetallicClick(now + 0.065, 3050, 3.6, 0.020, 0.15, 1300);
    const n = this._makeNoise(now + 0.02, 0.095);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2200, now + 0.02);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.11, now + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    n.connect(hp);
    hp.connect(ng);
    ng.connect(this._bus('sfx'));
  }

  playCraft() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      this._playMetallicClick(now + i * 0.06, 2000 + i * 160, 4.0, 0.014, 0.13, 1000);
    }
    const clankT = now + 0.25;
    this._playMetallicClick(clankT, 1350, 2.2, 0.045, 0.22, 650);
    const th = this.ctx.createOscillator();
    th.type = 'triangle';
    th.frequency.setValueAtTime(180, clankT);
    th.frequency.exponentialRampToValueAtTime(68, clankT + 0.075);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.24, clankT);
    tg.gain.exponentialRampToValueAtTime(0.001, clankT + 0.08);
    th.connect(tg);
    tg.connect(this._bus('sfx'));
    th.start(clankT);
    th.stop(clankT + 0.085);
  }

  playContainerOpen(kind = 'supply') {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (kind === 'boss') {
      this.playZipper(false);
      return;
    }
    if (kind === 'military' || kind === 'police_fire' || kind === 'boss_key_room' || kind === 'locker') {
      // Heavy steel latch clank + hinge creak
      this._playMetallicClick(now, 1550, 2.6, 0.032, 0.26, 700);
      const th = this.ctx.createOscillator();
      th.type = 'sine';
      th.frequency.setValueAtTime(140, now);
      th.frequency.exponentialRampToValueAtTime(52, now + 0.07);
      const tg = this.ctx.createGain();
      tg.gain.setValueAtTime(0.24, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      th.connect(tg);
      tg.connect(this._bus('sfx'));
      th.start(now);
      th.stop(now + 0.08);

      const crT = now + 0.05;
      const sq = this.ctx.createOscillator();
      sq.type = 'sine';
      sq.frequency.setValueAtTime(700, crT);
      sq.frequency.exponentialRampToValueAtTime(480, crT + 0.22);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(620, crT);
      bp.Q.setValueAtTime(6.0, crT);
      const sg = this.ctx.createGain();
      sg.gain.setValueAtTime(0.08, crT);
      sg.gain.exponentialRampToValueAtTime(0.001, crT + 0.23);
      sq.connect(bp);
      bp.connect(sg);
      sg.connect(this._bus('sfx'));
      sq.start(crT);
      sq.stop(crT + 0.24);
    } else if (kind === 'supply') {
      // Wood crate creak (sawtooth 140->90Hz LP) + lid thud
      const cr = this.ctx.createOscillator();
      cr.type = 'sawtooth';
      cr.frequency.setValueAtTime(140, now);
      cr.frequency.exponentialRampToValueAtTime(90, now + 0.19);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(520, now);
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.14, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
      cr.connect(lp);
      lp.connect(cg);
      cg.connect(this._bus('sfx'));
      cr.start(now);
      cr.stop(now + 0.21);

      const th = this.ctx.createOscillator();
      th.type = 'sine';
      th.frequency.setValueAtTime(110, now + 0.04);
      th.frequency.exponentialRampToValueAtTime(45, now + 0.12);
      const tg = this.ctx.createGain();
      tg.gain.setValueAtTime(0.22, now + 0.04);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      th.connect(tg);
      tg.connect(this._bus('sfx'));
      th.start(now + 0.04);
      th.stop(now + 0.14);
    } else if (kind === 'hospital' || kind === 'medical') {
      // Sharp ABS medical latch snap
      const n = this._makeNoise(now, 0.025);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1850, now);
      bp.Q.setValueAtTime(3.2, now);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.24, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
      n.connect(bp);
      bp.connect(ng);
      ng.connect(this._bus('sfx'));
      this._playMetallicClick(now + 0.025, 2300, 3.0, 0.016, 0.15, 1100);
    } else {
      this._playMetallicClick(now, 1450, 2.5, 0.025, 0.18, 700);
    }
  }

  playReviveStart() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Cloth/nylon rustle + quick med-pouch zipper burst
    const n = this._makeNoise(now, 0.20);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(980, now);
    bp.Q.setValueAtTime(1.1, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    n.connect(bp);
    bp.connect(g);
    g.connect(this._bus('sfx'));

    for (let i = 0; i < 8; i++) {
      const t = now + 0.06 + i * 0.018;
      const zn = this._makeNoise(t, 0.010);
      const zbp = this.ctx.createBiquadFilter();
      zbp.type = 'bandpass';
      zbp.frequency.setValueAtTime(3500 + i * 140, t);
      zbp.Q.setValueAtTime(5.0, t);
      const zg = this.ctx.createGain();
      zg.gain.setValueAtTime(0.09, t);
      zg.gain.exponentialRampToValueAtTime(0.001, t + 0.009);
      zn.connect(zbp);
      zbp.connect(zg);
      zg.connect(this._bus('sfx'));
    }
  }

  playReviveComplete() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // 0.4s epinephrine autoinjector hiss + relief exhale
    const hiss = this._makeNoise(now, 0.42);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2600, now);
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(0.20, now);
    hg.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
    hiss.connect(hp);
    hp.connect(hg);
    hg.connect(this._bus('sfx'));

    const exT = now + 0.08;
    const ex = this._makeNoise(exT, 0.34);
    const exLP = this.ctx.createBiquadFilter();
    exLP.type = 'lowpass';
    exLP.frequency.setValueAtTime(400, exT);
    const exG = this.ctx.createGain();
    exG.gain.setValueAtTime(0.24, exT);
    exG.gain.exponentialRampToValueAtTime(0.001, exT + 0.32);
    ex.connect(exLP);
    exLP.connect(exG);
    exG.connect(this._bus('sfx'));
  }
}

window.soundEngine = new SoundEngine();
