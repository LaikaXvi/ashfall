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
    this.sfxGain = null;
    this._ambient = null;
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

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(this.levels ? this.levels.ambient : 1, this.ctx.currentTime);
    this.ambientGain.connect(compressor);

    // Procedural outdoor wasteland echo/tail impulse response (ConvolverNode)
    const sr = this.ctx.sampleRate;
    const irLen = Math.floor(sr * 0.85);
    const irBuf = this.ctx.createBuffer(2, irLen, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = irBuf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < irLen; i++) {
        const t = i / sr;
        // Early concrete slapback around 45-95ms + diffuse outdoor decay
        const slap = (t > 0.045 && t < 0.095) ? 1.55 : 1.0;
        const env = Math.exp(-t * 5.8) * slap;
        const white = Math.random() * 2 - 1;
        // Darken tail over time like real outdoor air absorption
        lp = lp * 0.72 + white * 0.28;
        d[i] = lp * env;
      }
    }
    const convolver = this.ctx.createConvolver();
    convolver.buffer = irBuf;

    const revFilter = this.ctx.createBiquadFilter();
    revFilter.type = 'lowpass';
    revFilter.frequency.setValueAtTime(2200, this.ctx.currentTime);

    const revGain = this.ctx.createGain();
    revGain.gain.setValueAtTime(0.38, this.ctx.currentTime);

    convolver.connect(revFilter);
    revFilter.connect(revGain);
    revGain.connect(compressor);
    this.reverbSend = convolver;
  }

  startAmbient(kind) {
    if (!this.ctx) return null;
    try { this.stopAmbient(true); } catch (e) {}
    const mode = String(kind || 'wind');
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05, now + 2.0);
    let lfo = null;
    let lfoGain = null;
    if (mode === 'rumble') {
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(120, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.09, now + 2.0);
    } else if (mode === 'rain') {
      filt.type = 'highpass';
      filt.frequency.setValueAtTime(2500, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.03, now + 2.0);
    } else {
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(400, now);
      filt.Q.setValueAtTime(0.6, now);
      lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.13, now);
      lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(180, now);
      lfo.connect(lfoGain);
      lfoGain.connect(filt.frequency);
      lfo.start(now);
    }
    src.connect(filt);
    filt.connect(g);
    g.connect(this._bus('ambient'));
    src.start(now);
    this._ambient = { src: src, filt: filt, gain: g, lfo: lfo, lfoGain: lfoGain, kind: mode };
    return this._ambient;
  }

  stopAmbient(silent) {
    const a = this._ambient;
    this._ambient = null;
    if (!a || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      if (silent) {
        try { a.src.stop(now); } catch (e) {}
        try { if (a.lfo) a.lfo.stop(now); } catch (e) {}
      } else {
        a.gain.gain.cancelScheduledValues(now);
        a.gain.gain.setTargetAtTime(0.0001, now, 0.4);
        const s = a.src;
        const l = a.lfo;
        setTimeout(() => { try { s.stop(); } catch (e) {} try { if (l) l.stop(); } catch (e) {} }, 1500);
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

  playGunshot(weaponId, distance = 0, suppressed = false) {
    if (this.muted || !this.ctx || !this.gunBus) return;
    const now = this.ctx.currentTime;
    const distAtten = Math.max(0.05, 1 / (1 + distance * 0.038));
    const vol = distAtten * (suppressed ? 0.50 : 1.0);

    // Distance air-absorption cutoff (distant shots lose high frequencies)
    const airCutoff = Math.max(950, 14000 / (1 + distance * 0.09));

    // Play real CC0 firearm recording if decoded
    const sampleBuf = this.gunBuffers[weaponId] || this.gunBuffers.ak74m;
    if (sampleBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = sampleBuf;
      // Slight organic pitch variation so rapid fire never sounds robotic
      src.playbackRate.setValueAtTime((suppressed ? 1.18 : 1.0) * (0.96 + Math.random() * 0.08), now);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(suppressed ? Math.min(airCutoff, 2400) : airCutoff, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol * 1.15, now);
      if (suppressed) {
        // Tight suppressed tail (cuts boom, leaves crisp gas/action snap)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      }

      src.connect(lp);
      lp.connect(gain);
      gain.connect(this.gunBus);

      // Subtle outdoor wasteland reflection tail
      if (!suppressed && this.reverbSend) {
        const revG = this.ctx.createGain();
        revG.gain.setValueAtTime(0.22 * distAtten, now);
        gain.connect(revG);
        revG.connect(this.reverbSend);
      }

      src.start(now);
      if (suppressed) src.stop(now + 0.18);
      return;
    }

    // Per-weapon ballistic profiles
    const profiles = {
      pm9:   { snapFreq: 2600, bodyFreq: 1150, bodyQ: 0.7, bodyDur: 0.095, subFreq: 115, subGain: 0.45, tail: 0.30, gain: 0.85 },
      g17:   { snapFreq: 2900, bodyFreq: 1300, bodyQ: 0.75, bodyDur: 0.09,  subFreq: 120, subGain: 0.48, tail: 0.32, gain: 0.90 },
      mp5k:  { snapFreq: 3100, bodyFreq: 1450, bodyQ: 0.8, bodyDur: 0.075, subFreq: 125, subGain: 0.42, tail: 0.28, gain: 0.82 },
      ak74m: { snapFreq: 2400, bodyFreq: 980,  bodyQ: 0.65, bodyDur: 0.145, subFreq: 95,  subGain: 0.72, tail: 0.65, gain: 1.05 },
      m870:  { snapFreq: 1700, bodyFreq: 540,  bodyQ: 0.55, bodyDur: 0.24,  subFreq: 72,  subGain: 1.05, tail: 0.85, gain: 1.20 },
      m24:   { snapFreq: 2800, bodyFreq: 860,  bodyQ: 0.6, bodyDur: 0.22,  subFreq: 80,  subGain: 0.92, tail: 1.05, gain: 1.18 }
    };
    const p = profiles[weaponId] || profiles.ak74m;

    // Slight organic pitch/filter jitter per shot so rapid fire sounds natural
    const jitter = 0.92 + Math.random() * 0.16;

    // Output node for this shot (with distance air-absorption filter)
    const shotOut = this.ctx.createBiquadFilter();
    shotOut.type = 'lowpass';
    shotOut.frequency.setValueAtTime(suppressed ? Math.min(airCutoff, 3600) : airCutoff, now);
    shotOut.connect(this.gunBus);

    // Send portion to outdoor wasteland echo tail
    const tailGain = this.ctx.createGain();
    tailGain.gain.setValueAtTime((suppressed ? p.tail * 0.14 : p.tail) * distAtten, now);
    shotOut.connect(tailGain);
    tailGain.connect(this.reverbSend);

    // === LAYER 1: Razor-sharp Muzzle / Supersonic Crack (0 - 22ms) ===
    const crackDur = suppressed ? 0.018 : 0.028;
    const crackNoise = this._makeNoise(now, crackDur + 0.01);
    const crackHP = this.ctx.createBiquadFilter();
    crackHP.type = 'highpass';
    crackHP.frequency.setValueAtTime((suppressed ? 2400 : p.snapFreq) * jitter, now);
    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime((suppressed ? 0.45 : 1.15) * p.gain * vol, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + crackDur);
    crackNoise.connect(crackHP);
    crackHP.connect(crackGain);
    crackGain.connect(shotOut);

    // === LAYER 2: Propellant Gas Blast Body (Bandpassed Noise Bark) ===
    const bodyDur = suppressed ? p.bodyDur * 0.45 : p.bodyDur;
    const bodyNoise = this._makeNoise(now, bodyDur + 0.02);
    const bodyBP = this.ctx.createBiquadFilter();
    bodyBP.type = 'bandpass';
    bodyBP.Q.setValueAtTime(p.bodyQ, now);
    bodyBP.frequency.setValueAtTime((suppressed ? 1600 : p.bodyFreq) * jitter, now);
    bodyBP.frequency.exponentialRampToValueAtTime((suppressed ? 420 : 210), now + bodyDur);

    const bodyGain = this.ctx.createGain();
    bodyGain.gain.setValueAtTime((suppressed ? 0.50 : 1.05) * p.gain * vol, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.015 * vol, now + bodyDur * 0.45);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + bodyDur);

    bodyNoise.connect(bodyBP);
    bodyBP.connect(bodyGain);
    bodyGain.connect(shotOut);

    // === LAYER 3: Low-End Concussion Rumble (Low-Passed Noise + Ultra-Short Damped Sub) ===
    const lowDur = suppressed ? 0.045 : p.bodyDur * 0.85;
    const lowNoise = this._makeNoise(now, lowDur + 0.01);
    const lowLP = this.ctx.createBiquadFilter();
    lowLP.type = 'lowpass';
    lowLP.frequency.setValueAtTime(suppressed ? 260 : 320, now);
    const lowGain = this.ctx.createGain();
    lowGain.gain.setValueAtTime((suppressed ? 0.25 : p.subGain * 1.1) * vol, now);
    lowGain.gain.exponentialRampToValueAtTime(0.001, now + lowDur);
    lowNoise.connect(lowLP);
    lowLP.connect(lowGain);
    lowGain.connect(shotOut);

    if (!suppressed) {
      // Very brief chest-punch sub impulse (32ms — felt, never heard as a cartoon tone)
      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(p.subFreq * jitter, now);
      subOsc.frequency.exponentialRampToValueAtTime(34, now + 0.032);
      const subG = this.ctx.createGain();
      subG.gain.setValueAtTime(p.subGain * 0.65 * vol, now);
      subG.gain.exponentialRampToValueAtTime(0.001, now + 0.036);
      subOsc.connect(subG);
      subG.connect(shotOut);
      subOsc.start(now);
      subOsc.stop(now + 0.04);
    }

    // === LAYER 4: Mechanical Bolt / Slide Clack (prominent on suppressed & close shots) ===
    if (distance < 12) {
      const mechStart = now + 0.014;
      const mechNoise = this._makeNoise(mechStart, 0.03);
      const mechBP = this.ctx.createBiquadFilter();
      mechBP.type = 'bandpass';
      mechBP.frequency.setValueAtTime(3400 * jitter, mechStart);
      mechBP.Q.setValueAtTime(3.2, mechStart);
      const mechGain = this.ctx.createGain();
      mechGain.gain.setValueAtTime((suppressed ? 0.42 : 0.22) * vol, mechStart);
      mechGain.gain.exponentialRampToValueAtTime(0.001, mechStart + 0.028);
      mechNoise.connect(mechBP);
      mechBP.connect(mechGain);
      mechGain.connect(shotOut);
    }
  }

  playHitmarker(headshot = false) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = headshot ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(headshot ? 1400 : 880, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 600 : 420, now + 0.055);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(headshot ? 0.25 : 0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.06);
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

  playMagOut() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.06);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playMagIn() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.055);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this._bus('sfx'));
    osc.start(now);
    osc.stop(now + 0.075);
  }

  playRechamber() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    [0, 0.14].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(idx === 0 ? 780 : 1040, now + offset);
      osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 480 : 620, now + offset + 0.06);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.11, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.07);
      osc.connect(gain);
      gain.connect(this._bus('sfx'));
      osc.start(now + offset);
      osc.stop(now + offset + 0.075);
    });
  }

  playFootstep(sprinting = false) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(sprinting ? 480 : 320, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(sprinting ? 0.09 : 0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this._bus('foot'));
    noise.start(now);
    noise.stop(now + 0.085);
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

  playExplosion(distance = 0) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const vol = Math.max(0.15, 1.0 - distance / 55);

    // Sub-bass shockwave boom
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(125, now);
    sub.frequency.exponentialRampToValueAtTime(24, now + 0.55);
    const subG = this.ctx.createGain();
    subG.gain.setValueAtTime(0.85 * vol, now);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    sub.connect(subG);
    subG.connect(this._bus('sfx'));
    sub.start(now);
    sub.stop(now + 0.68);

    // Blast crack & low debris rumble
    const noise = this._makeNoise(now, 0.95);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2800, now);
    lp.frequency.exponentialRampToValueAtTime(180, now + 0.85);
    const nG = this.ctx.createGain();
    nG.gain.setValueAtTime(0.75 * vol, now);
    nG.gain.exponentialRampToValueAtTime(0.001, now + 0.92);
    noise.connect(lp);
    lp.connect(nG);
    nG.connect(this._bus('sfx'));
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
    if (type === 'stim') {
      // Sharp auto-injector spring snap + pressurized hiss
      const click = this.ctx.createOscillator();
      click.type = 'square';
      click.frequency.setValueAtTime(1400, now);
      click.frequency.exponentialRampToValueAtTime(320, now + 0.03);
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.16, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      click.connect(cg);
      cg.connect(this._bus('sfx'));
      click.start(now);
      click.stop(now + 0.04);

      const hiss = this._makeNoise(now + 0.025, 0.24);
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(4200, now + 0.025);
      hp.Q.setValueAtTime(2.0, now + 0.025);
      const hg = this.ctx.createGain();
      hg.gain.setValueAtTime(0.09, now + 0.025);
      hg.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      hiss.connect(hp);
      hp.connect(hg);
      hg.connect(this._bus('sfx'));
    } else if (type === 'bandage') {
      // Two soft cloth-wrapping swishes
      [0, 0.28].forEach((offset) => {
        const swish = this._makeNoise(now + offset, 0.18);
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1100, now + offset);
        bp.frequency.linearRampToValueAtTime(1750, now + offset + 0.14);
        bp.Q.setValueAtTime(1.4, now + offset);
        const sg = this.ctx.createGain();
        sg.gain.setValueAtTime(0.001, now + offset);
        sg.gain.linearRampToValueAtTime(0.11, now + offset + 0.05);
        sg.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.17);
        swish.connect(bp);
        bp.connect(sg);
        sg.connect(this._bus('sfx'));
      });
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
    // Velcro/cloth slide
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.14, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this._bus('sfx'));
    noise.start(now);
    noise.stop(now + 0.19);

    // Solid ceramic plate thud at +0.28s
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now + 0.28);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.38);
    const oGain = this.ctx.createGain();
    oGain.gain.setValueAtTime(0.24, now + 0.28);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
    osc.connect(oGain);
    oGain.connect(this._bus('sfx'));
    osc.start(now + 0.28);
    osc.stop(now + 0.41);
  }

  playZipper(closing = false) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.22;
    const noise = this._makeNoise(now, dur + 0.02);

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(4.5, now);
    bp.frequency.setValueAtTime(closing ? 2400 : 3800, now);
    bp.frequency.exponentialRampToValueAtTime(closing ? 4400 : 2100, now + dur);

    // Rapid zipper teeth amplitude modulation (~48 Hz)
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.setValueAtTime(closing ? 52 : 44, now);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(0.08, now);

    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.11, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + dur);

    lfo.connect(lfoGain);
    lfoGain.connect(amp.gain);
    noise.connect(bp);
    bp.connect(amp);
    amp.connect(this._bus('sfx'));
    lfo.start(now);
    lfo.stop(now + dur);
  }
}

window.soundEngine = new SoundEngine();
