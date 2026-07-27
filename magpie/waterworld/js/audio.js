// Waterworld audio — everything synthesized in WebAudio, nothing fetched.
// Lo-fi on purpose: detuned oscillators, tape-wobble LFOs, a pentatonic
// music box that plays itself. One master gain, wired to the shell's
// volume service via sdk.onAudio (a mute that can't reach you is a lie).

export class WaterAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.level = 1;
    this._musicTimer = null;
    this._fizzNode = null;
  }

  // Call from a user gesture (or a key press) — AudioContext rules.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5 * this.level;
    this.master.connect(this.ctx.destination);
    // one shared lo-fi echo for everything melodic
    this.echo = this.ctx.createDelay(1);
    this.echo.delayTime.value = 0.28;
    this.echoGain = this.ctx.createGain();
    this.echoGain.gain.value = 0.3;
    this.echo.connect(this.echoGain).connect(this.master);
    this._startAmbient();
    this._startMusic();
    return true;
  }

  // Shell volume service: level = muted ? 0 : volume.
  setLevel(level) {
    this.level = level;
    if (this.master) {
      this.master.gain.setTargetAtTime(0.5 * level, this.ctx.currentTime, 0.05);
    }
  }

  _now() { return this.ctx.currentTime; }

  _env(gainNode, t, peak, attack, decay) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  _osc(type, freq, dest) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    o.connect(g).connect(dest);
    return { o, g };
  }

  _noise(dur) {
    const n = this.ctx.createBufferSource();
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = buf;
    return n;
  }

  // -------------------------------------------------- beds
  _startAmbient() {
    // deep water: filtered noise rumble + two detuned triangles breathing
    const noise = this._noise(2); noise.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 120;
    const ng = this.ctx.createGain(); ng.gain.value = 0.12;
    noise.connect(lp).connect(ng).connect(this.master);
    noise.start();
    const drone = this.ctx.createGain(); drone.gain.value = 0.05;
    const lp2 = this.ctx.createBiquadFilter();
    lp2.type = 'lowpass'; lp2.frequency.value = 300;
    drone.connect(lp2).connect(this.master);
    for (const f of [55, 55.7]) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = f;
      o.connect(drone); o.start();
    }
    // slow LFO opens and closes the drone filter — the "breathing" dock
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 140;
    lfo.connect(lfoG).connect(lp2.frequency); lfo.start();
  }

  _startMusic() {
    // a sunny pentatonic music box: major penta on C, tape-wobbled
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
    const step = () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      if (Math.random() < 0.75) {
        const f = scale[Math.floor(Math.random() * scale.length)];
        const t = this._now();
        const { o, g } = this._osc('triangle', f, this.echo);
        g.connect(this.master);
        // tape wobble
        const wob = this.ctx.createOscillator(); wob.frequency.value = 5.2;
        const wg = this.ctx.createGain(); wg.gain.value = f * 0.006;
        wob.connect(wg).connect(o.frequency); wob.start(t);
        this._env(g, t, 0.10, 0.02, 1.6);
        o.start(t); o.stop(t + 2); wob.stop(t + 2);
      }
    };
    this._musicTimer = setInterval(step, 700);
  }

  stopMusic() { if (this._musicTimer) clearInterval(this._musicTimer); this._musicTimer = null; }

  // -------------------------------------------------- one-shots
  ping() {
    if (!this.ctx) return;
    const t = this._now();
    const { o, g } = this._osc('sine', 1400, this.echo);
    g.connect(this.master);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.5);
    this._env(g, t, 0.22, 0.01, 0.55);
    o.start(t); o.stop(t + 0.7);
  }

  pickup(value = 10) {
    if (!this.ctx) return;
    const t = this._now();
    const base = 440 + Math.min(value, 60) * 8;
    for (let i = 0; i < 2; i++) {
      const { o, g } = this._osc('square', base * (i ? 1.5 : 1), this.echo);
      g.connect(this.master);
      this._env(g, t + i * 0.07, 0.09, 0.01, 0.25);
      o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.3);
    }
  }

  bank(mult = 1) {
    if (!this.ctx) return;
    const t = this._now();
    const notes = [261.63, 329.63, 392.0, 523.25].slice(0, 2 + Math.min(mult, 2));
    notes.forEach((f, i) => {
      const { o, g } = this._osc('triangle', f, this.echo);
      g.connect(this.master);
      this._env(g, t + i * 0.09, 0.13, 0.01, 0.5);
      o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.6);
    });
  }

  craft() {
    if (!this.ctx) return;
    const t = this._now();
    [392, 523.25, 659.25, 783.99].forEach((f, i) => {
      const { o, g } = this._osc('square', f, this.echo);
      g.connect(this.master);
      this._env(g, t + i * 0.11, 0.08, 0.01, 0.4);
      o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.5);
    });
  }

  hurt() {
    if (!this.ctx) return;
    const t = this._now();
    const n = this._noise(0.3);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'lowpass'; bp.frequency.value = 700;
    const g = this.ctx.createGain();
    n.connect(bp).connect(g).connect(this.master);
    this._env(g, t, 0.3, 0.005, 0.28);
    n.start(t);
    const { o, g: g2 } = this._osc('sine', 90, this.master);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    this._env(g2, t, 0.35, 0.005, 0.3);
    o.start(t); o.stop(t + 0.35);
  }

  boom() {
    if (!this.ctx) return;
    const t = this._now();
    const n = this._noise(1.2);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(60, t + 1.0);
    const g = this.ctx.createGain();
    n.connect(lp).connect(g).connect(this.master);
    this._env(g, t, 0.5, 0.01, 1.1);
    n.start(t);
    const { o, g: g2 } = this._osc('sine', 70, this.master);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.9);
    this._env(g2, t, 0.5, 0.01, 0.9);
    o.start(t); o.stop(t + 1);
  }

  alarm() {
    if (!this.ctx) return;
    const t = this._now();
    for (let i = 0; i < 2; i++) {
      const { o, g } = this._osc('square', 880, this.master);
      this._env(g, t + i * 0.18, 0.06, 0.01, 0.1);
      o.start(t + i * 0.18); o.stop(t + i * 0.18 + 0.15);
    }
  }

  whaleSong() {
    if (!this.ctx) return;
    const t = this._now();
    const { o, g } = this._osc('sine', 180, this.echo);
    g.connect(this.master);
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 1.4);
    o.frequency.exponentialRampToValueAtTime(240, t + 2.8);
    const vib = this.ctx.createOscillator(); vib.frequency.value = 4;
    const vg = this.ctx.createGain(); vg.gain.value = 6;
    vib.connect(vg).connect(o.frequency); vib.start(t);
    this._env(g, t, 0.12, 0.4, 2.6);
    o.start(t); o.stop(t + 3.2); vib.stop(t + 3.2);
  }

  fizz(on) {
    if (!this.ctx) return;
    if (on && !this._fizzNode) {
      const n = this._noise(1); n.loop = true;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 2500;
      const g = this.ctx.createGain(); g.gain.value = 0.12;
      n.connect(hp).connect(g).connect(this.master);
      n.start();
      this._fizzNode = { n, g };
    } else if (!on && this._fizzNode) {
      this._fizzNode.g.gain.setTargetAtTime(0.0001, this._now(), 0.1);
      const node = this._fizzNode;
      setTimeout(() => { try { node.n.stop(); } catch (e) { /* already */ } }, 400);
      this._fizzNode = null;
    }
  }

  bubble() {
    if (!this.ctx) return;
    const t = this._now();
    const { o, g } = this._osc('sine', 500 + Math.random() * 700, this.master);
    o.frequency.exponentialRampToValueAtTime(1500 + Math.random() * 800, t + 0.08);
    this._env(g, t, 0.04, 0.005, 0.08);
    o.start(t); o.stop(t + 0.1);
  }

  growl() {
    if (!this.ctx) return;
    const t = this._now();
    const { o, g } = this._osc('sawtooth', 65, this.master);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 250;
    g.disconnect(); g.connect(lp).connect(this.master);
    const vib = this.ctx.createOscillator(); vib.frequency.value = 9;
    const vg = this.ctx.createGain(); vg.gain.value = 14;
    vib.connect(vg).connect(o.frequency); vib.start(t);
    this._env(g, t, 0.16, 0.05, 0.7);
    o.start(t); o.stop(t + 0.8); vib.stop(t + 0.8);
  }

  clicks() {
    // dolphin: a falling train of bright little ticks
    if (!this.ctx) return;
    const t = this._now();
    for (let i = 0; i < 7; i++) {
      const { o, g } = this._osc('sine', 2400 - i * 180, this.master);
      this._env(g, t + i * 0.06, 0.05, 0.004, 0.05);
      o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.08);
    }
  }

  zap() {
    // electric eel: a crackle of filtered noise over a snapping drop
    if (!this.ctx) return;
    const t = this._now();
    const n = this._noise(0.25);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1800;
    const g = this.ctx.createGain();
    n.connect(hp).connect(g).connect(this.master);
    this._env(g, t, 0.22, 0.004, 0.22);
    n.start(t);
    const { o, g: g2 } = this._osc('square', 320, this.master);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.16);
    this._env(g2, t, 0.14, 0.004, 0.16);
    o.start(t); o.stop(t + 0.2);
  }

  sealBark() {
    if (!this.ctx) return;
    const t = this._now();
    for (let i = 0; i < 2; i++) {
      const { o, g } = this._osc('sawtooth', 420, this.master);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 2;
      g.disconnect(); g.connect(bp).connect(this.master);
      o.frequency.exponentialRampToValueAtTime(240, t + i * 0.22 + 0.15);
      this._env(g, t + i * 0.22, 0.18, 0.02, 0.16);
      o.start(t + i * 0.22); o.stop(t + i * 0.22 + 0.2);
    }
  }

  honk() {
    if (!this.ctx) return;
    const t = this._now();
    for (let i = 0; i < 2; i++) {
      for (const f of [285, 355]) {
        const { o, g } = this._osc('square', f, this.echo);
        g.connect(this.master);
        this._env(g, t + i * 0.28, 0.1, 0.02, 0.2);
        o.start(t + i * 0.28); o.stop(t + i * 0.28 + 0.25);
      }
    }
  }

  swish() {
    if (!this.ctx) return;
    const t = this._now();
    const n = this._noise(0.25);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
    const g = this.ctx.createGain();
    n.connect(bp).connect(g).connect(this.master);
    this._env(g, t, 0.08, 0.04, 0.2);
    n.start(t);
  }

  victory() {
    if (!this.ctx) return;
    const t = this._now();
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => {
      const { o, g } = this._osc('triangle', f, this.echo);
      g.connect(this.master);
      this._env(g, t + i * 0.14, 0.14, 0.01, 0.5);
      o.start(t + i * 0.14); o.stop(t + i * 0.14 + 0.6);
    });
  }
}
