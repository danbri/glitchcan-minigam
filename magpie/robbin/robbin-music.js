// robbin-music.js — cheerful 8-bit-but-lush chiptune loop for ROBBIN.
// Pure WebAudio, no samples: square lead (detuned double + vibrato + echo),
// square arpeggio shimmer, triangle bass over a sine sub-octave, soft noise
// hats and a thumpy sine kick. 8 bars of C–Am–F–G at 112 BPM, looped.

const BPM = 112;
const STEPS = 128;                       // 8 bars × 16 sixteenths
const S16 = 60 / BPM / 4;
const f = m => 440 * Math.pow(2, (m - 69) / 12);

// bar → [root midi, triad intervals]; the 4-bar progression repeats
const CHORDS = [
  [48, [0, 4, 7]],   // C
  [45, [0, 3, 7]],   // Am
  [41, [0, 4, 7]],   // F
  [43, [0, 4, 7]],   // G
];
// [step, midi, length-in-16ths] — an A A' phrase pair over the 8 bars
const MELODY = [
  [0, 76, 3], [4, 79, 2], [8, 81, 3], [12, 79, 2],
  [16, 76, 2], [20, 74, 2], [24, 72, 4],
  [32, 69, 2], [36, 72, 2], [40, 74, 3], [44, 76, 2],
  [48, 79, 6], [56, 76, 4],
  [64, 76, 3], [68, 79, 2], [72, 81, 3], [76, 84, 2],
  [80, 84, 3], [84, 81, 2], [88, 79, 4],
  [96, 81, 2], [100, 79, 2], [104, 76, 3], [108, 74, 2],
  [112, 72, 6], [120, 67, 2], [124, 72, 2],
];
const MELODY_AT = new Map(MELODY.map(([s, m, l]) => [s, [m, l]]));
// within-bar bass hits: [pos, semitone offset from root]
const BASS = [[0, 0], [3, 0], [6, 7], [8, 0], [11, 0], [14, 7]];
const BASS_AT = new Map(BASS);

export class Chiptune {
  constructor(getCtx) {
    this.getCtx = getCtx;
    this.timer = null;
    this.muted = false;
  }
  ensureGraph() {
    const ctx = this.ctx;
    if (this.bus) return;
    this.bus = ctx.createGain();                    // mute switch
    this.bus.gain.value = this.muted ? 0 : 1;
    this.level = ctx.createGain();                  // duck/fade control
    this.level.gain.value = 0.5;
    this.level.connect(this.bus).connect(ctx.destination);
    // the "lush": a dotted-eighth feedback echo the lead sings into
    this.echo = ctx.createDelay(1.0);
    this.echo.delayTime.value = S16 * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.3;
    const wet = ctx.createGain(); wet.gain.value = 0.24;
    this.echo.connect(fb).connect(this.echo);
    this.echo.connect(wet).connect(this.level);
    this.send = ctx.createGain(); this.send.gain.value = 0.6;
    this.send.connect(this.echo);
    // shared noise buffer for hats
    const len = Math.floor(ctx.sampleRate * 0.1);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  start() {
    const ctx = this.getCtx();
    if (!ctx || this.timer) return;
    this.ctx = ctx;
    this.ensureGraph();
    this.level.gain.cancelScheduledValues(ctx.currentTime);
    this.level.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.level.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.8);
    this.step = 0;
    this.next = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.sched(), 25);
  }
  stop(fade = 0.5) {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    this.level.gain.cancelScheduledValues(t);
    this.level.gain.setValueAtTime(this.level.gain.value, t);
    this.level.gain.exponentialRampToValueAtTime(0.0001, t + fade);
  }
  duck(sec = 1.4) {
    if (!this.timer) return;
    const g = this.level.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.exponentialRampToValueAtTime(0.08, t + 0.1);
    g.exponentialRampToValueAtTime(0.5, t + sec);
  }
  setMuted(m) {
    this.muted = m;
    if (this.bus) this.bus.gain.value = m ? 0 : 1;
  }
  sched() {
    while (this.next < this.ctx.currentTime + 0.15) {
      this.playStep(this.step % STEPS, this.next);
      this.next += S16;
      this.step++;
    }
  }
  tone({ freq, t, dur, gain, type = 'square', detune = 0, attack = 0.005, echo = 0, vibrato = 0 }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    if (vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.6; lg.gain.value = vibrato;
      lfo.connect(lg).connect(o.detune);
      lfo.start(t + 0.08); lfo.stop(t + dur + 0.1);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, Math.max(t + attack, t + dur - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.level);
    if (echo) {
      const s = this.ctx.createGain(); s.gain.value = echo;
      g.connect(s).connect(this.send);
    }
    o.start(t); o.stop(t + dur + 0.05);
  }
  hat(t, gain = 0.03) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(hp).connect(g).connect(this.level);
    src.start(t); src.stop(t + 0.05);
  }
  kick(t, gain = 0.1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.09);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(this.level);
    o.start(t); o.stop(t + 0.12);
  }
  playStep(st, t) {
    const bar = st >> 4, pos = st & 15;
    const [root, triad] = CHORDS[bar % 4];
    if (pos === 0) this.kick(t, 0.1);
    if (pos === 8) this.kick(t, 0.05);
    if (pos % 4 === 2) this.hat(t);
    const bOff = BASS_AT.get(pos);
    if (bOff !== undefined) {
      this.tone({ freq: f(root - 12 + bOff), t, dur: S16 * 1.8, gain: 0.085, type: 'triangle' });
      this.tone({ freq: f(root - 24 + bOff), t, dur: S16 * 1.8, gain: 0.05, type: 'sine' });
    }
    // 16th-note arpeggio shimmer, up an octave
    const arpNote = triad[[0, 1, 2, 1][pos % 4]];
    this.tone({ freq: f(root + 12 + arpNote), t, dur: S16 * 0.9, gain: 0.028, echo: 0.25 });
    const hit = MELODY_AT.get(st);
    if (hit) {
      const [m, len] = hit;
      const dur = len * S16 * 0.95;
      this.tone({ freq: f(m), t, dur, gain: 0.065, echo: 0.5, vibrato: 7 });
      this.tone({ freq: f(m), t, dur, gain: 0.04, detune: 6 });   // lush double
    }
  }
}
