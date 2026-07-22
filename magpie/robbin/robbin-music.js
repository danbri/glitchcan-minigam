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
    // a warm master lowpass: closed = distant hum, open = full band
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 5200;
    this.filter.Q.value = 0.4;
    this.level.connect(this.filter).connect(this.bus).connect(ctx.destination);
    // instrument families for gradual buildups
    this.fam = {};
    for (const name of ['pad', 'bass', 'perc', 'arp', 'lead']) {
      this.fam[name] = ctx.createGain();
      this.fam[name].connect(this.level);
    }
    this.applyIntensity(this.intensity ?? 0.85, 0.05);
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
  /**
   * 0..1: how much of the band is playing. Low = warm washes and a
   * heartbeat; layers fade in gradually as it rises. Ramped, never abrupt.
   */
  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v));
    if (this.fam) this.applyIntensity(this.intensity, 1.8);
  }
  applyIntensity(v, ramp) {
    const t = this.ctx.currentTime;
    const seg = (from, span) => Math.max(0, Math.min(1, (v - from) / span));
    const set = (g, val) => {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(val, t + ramp);
    };
    set(this.fam.pad, 0.95);
    set(this.fam.bass, 0.55 + 0.35 * v);
    set(this.fam.perc, seg(0.12, 0.3));
    set(this.fam.arp, seg(0.32, 0.3) * 0.9);
    set(this.fam.lead, seg(0.52, 0.32));
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, t);
    this.filter.frequency.linearRampToValueAtTime(800 + 5200 * v, t + ramp);
  }
  /** a warm momentary bloom — rescues, reunions */
  swell() {
    if (!this.fam) return;
    const t = this.ctx.currentTime;
    this.level.gain.cancelScheduledValues(t);
    this.level.gain.setValueAtTime(this.level.gain.value, t);
    this.level.gain.linearRampToValueAtTime(0.62, t + 0.25);
    this.level.gain.linearRampToValueAtTime(0.5, t + 2.2);
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, t);
    this.filter.frequency.linearRampToValueAtTime(6400, t + 0.3);
    this.filter.frequency.linearRampToValueAtTime(800 + 5200 * (this.intensity ?? 0.85), t + 2.5);
  }
  sched() {
    while (this.next < this.ctx.currentTime + 0.15) {
      this.playStep(this.step % STEPS, this.next);
      this.next += S16;
      this.step++;
    }
  }
  tone({ freq, t, dur, gain, type = 'square', detune = 0, attack = 0.005, echo = 0, vibrato = 0, fam = 'lead' }) {
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
    o.connect(g).connect(this.fam[fam] || this.level);
    if (echo) {
      const s = this.ctx.createGain(); s.gain.value = echo;
      g.connect(s).connect(this.send);
    }
    o.start(t); o.stop(t + dur + 0.05);
  }
  // slow warm chord wash under everything — the lush floor of the mix
  pad(t, root, triad) {
    const dur = 16 * S16 * 1.04;
    for (const iv of triad) {
      for (const det of [-6, 6]) {
        this.tone({
          freq: f(root + 12 + iv), t, dur, gain: 0.017, type: 'sawtooth',
          detune: det, attack: dur * 0.35, echo: 0.15, fam: 'pad',
        });
      }
      this.tone({
        freq: f(root + iv), t, dur, gain: 0.02, type: 'triangle',
        attack: dur * 0.3, fam: 'pad',
      });
    }
  }
  hat(t, gain = 0.03) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(hp).connect(g).connect(this.fam.perc);
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
    o.connect(g).connect(this.fam.perc);
    o.start(t); o.stop(t + 0.12);
  }
  playStep(st, t) {
    const bar = st >> 4, pos = st & 15;
    const [root, triad] = CHORDS[bar % 4];
    if (pos === 0) { this.kick(t, 0.1); this.pad(t, root, triad); }
    if (pos === 8) this.kick(t, 0.05);
    if (pos % 4 === 2) this.hat(t);
    const bOff = BASS_AT.get(pos);
    if (bOff !== undefined) {
      this.tone({ freq: f(root - 12 + bOff), t, dur: S16 * 1.8, gain: 0.085, type: 'triangle', fam: 'bass' });
      this.tone({ freq: f(root - 24 + bOff), t, dur: S16 * 1.8, gain: 0.05, type: 'sine', fam: 'bass' });
    }
    // 16th-note arpeggio shimmer, up an octave
    const arpNote = triad[[0, 1, 2, 1][pos % 4]];
    this.tone({ freq: f(root + 12 + arpNote), t, dur: S16 * 0.9, gain: 0.028, echo: 0.25, fam: 'arp' });
    const hit = MELODY_AT.get(st);
    if (hit) {
      const [m, len] = hit;
      const dur = len * S16 * 0.95;
      this.tone({ freq: f(m), t, dur, gain: 0.065, echo: 0.5, vibrato: 7, fam: 'lead' });
      this.tone({ freq: f(m), t, dur, gain: 0.04, detune: 6, fam: 'lead' });   // lush double
    }
  }
}

// ------------------------------------------------------------ soundtrack
// Three recorded tracks, ported to WebAudio: fetched once, decoded into
// buffers, looped, and crossfaded by the game's mood — all through a
// mute-aware gain chain so the speaker button rules them too.
//   engines     — THE QUIET ENGINES         · the map: flying the city
//   gears       — GEARS AND BIRDCALLS       · station interiors
//   passacaglia — THE INEXORABLE PASSACAGLIA · the homecoming finale
// If fetch or decode fails (offline, odd codec), `failed` flips and the
// procedural Chiptune keeps the whole stage, exactly as before.
export class Soundtrack {
  constructor(getCtx, base = 'audio/') {
    this.getCtx = getCtx;
    this.urls = {
      engines: `${base}the-quiet-engines.mp3`,
      gears: `${base}gears-and-birdcalls.mp3`,
      passacaglia: `${base}the-inexorable-passacaglia.mp3`,
    };
    this.buffers = {};
    this.loading = {};
    this.playing = null;
    this.want = null;
    this.muted = false;
    this.failed = false;
  }
  ensureGraph() {
    const ctx = this.getCtx();
    if (!ctx) return false;
    this.ctx = ctx;
    if (this.bus) return true;
    this.bus = ctx.createGain();                 // the mute switch
    this.bus.gain.value = this.muted ? 0 : 1;
    this.level = ctx.createGain();               // soundtrack level / blooms
    this.level.gain.value = 0.75;
    this.level.connect(this.bus).connect(ctx.destination);
    return true;
  }
  load(name) {
    if (this.buffers[name] || this.failed) return Promise.resolve();
    if (this.loading[name]) return this.loading[name];
    this.loading[name] = (async () => {
      try {
        const res = await fetch(this.urls[name]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.arrayBuffer();
        this.buffers[name] = await this.ctx.decodeAudioData(raw);
      } catch {
        this.failed = true;                      // the band plays on instead
      } finally {
        delete this.loading[name];
      }
    })();
    return this.loading[name];
  }
  /** crossfade to a named mood (null = fade to silence) */
  async play(name, fade = 1.8) {
    this.want = name;
    if (!this.ensureGraph()) return;
    if (name) await this.load(name);
    if (this.failed || this.want !== name) return;   // superseded mid-decode
    if (this.playing?.name === name) return;
    const t = this.ctx.currentTime;
    if (this.playing) {
      const old = this.playing;
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + fade);
      try { old.src.stop(t + fade + 0.1); } catch { /* already stopped */ }
      this.playing = null;
    }
    if (!name || !this.buffers[name]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(1, t + fade);
    src.connect(gain).connect(this.level);
    src.start(t);
    this.playing = { name, src, gain };
  }
  stop(fade = 1.2) { this.play(null, fade); }
  get active() { return !this.failed && !!(this.playing || this.want); }
  setMuted(m) {
    this.muted = m;
    if (this.bus) this.bus.gain.value = m ? 0 : 1;
  }
  /** a warm momentary bloom — rescues, reunions (mirrors Chiptune.swell) */
  swell() {
    if (!this.level) return;
    const t = this.ctx.currentTime;
    this.level.gain.cancelScheduledValues(t);
    this.level.gain.setValueAtTime(this.level.gain.value, t);
    this.level.gain.linearRampToValueAtTime(0.98, t + 0.25);
    this.level.gain.linearRampToValueAtTime(0.75, t + 2.4);
  }
}

// ---------------------------------------------------- the score, LIVE
// The MIDI-like performance of the three tracks: robbin-score.js holds
// what the analysis heard (tempo, key, chord cycle, energy arc) and
// this player performs it through the Chiptune's own voices — loopable
// to the bar and parameterized: intensity layers with the flock,
// setPace() leans with rush hour, movements crossfade at bar edges,
// and the passacaglia stacks a new layer every time its ground repeats.
import { SCORE } from './robbin-score.js';

export class ScorePlayer extends Chiptune {
  constructor(getCtx) {
    super(getCtx);
    this.movement = null;
    this.pending = null;
    this.pace = 1;
  }
  s16() {
    const mv = SCORE[this.movement];
    return 60 / ((mv?.bpm || 100) * this.pace) / 4;
  }
  setPace(p) { this.pace = Math.max(0.6, Math.min(1.5, p)); }
  play(movement) {
    if (!SCORE[movement]) return;
    if (this.timer) {
      if (this.movement !== movement) this.pending = movement;   // swap at the bar line
      return;
    }
    const ctx = this.getCtx();
    if (!ctx) return;
    this.ctx = ctx;
    this.movement = movement;
    this.pending = null;
    this.ensureGraph();
    const t = ctx.currentTime;
    this.level.gain.cancelScheduledValues(t);
    this.level.gain.setValueAtTime(0.0001, t);
    this.level.gain.exponentialRampToValueAtTime(0.95, t + 1.2);
    this.step = 0;
    this.next = t + 0.06;
    this.timer = setInterval(() => this.schedScore(), 40);
  }
  swell() {
    if (!this.level) return;
    const t = this.ctx.currentTime;
    this.level.gain.cancelScheduledValues(t);
    this.level.gain.setValueAtTime(this.level.gain.value, t);
    this.level.gain.linearRampToValueAtTime(1.2, t + 0.25);
    this.level.gain.linearRampToValueAtTime(0.95, t + 2.2);
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, t);
    this.filter.frequency.linearRampToValueAtTime(6400, t + 0.3);
    this.filter.frequency.linearRampToValueAtTime(800 + 5200 * (this.intensity ?? 0.85), t + 2.5);
  }
  schedScore() {
    while (this.next < this.ctx.currentTime + 0.18) {
      if (this.pending && this.step % 16 === 0) {
        this.movement = this.pending;
        this.pending = null;
        this.step = 0;
      }
      this.playScoreStep(this.step, this.next);
      this.next += this.s16();
      this.step++;
    }
  }
  // a chuffing engine breath: lowpassed noise, quiet and regular
  chuff(t, gain) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(lp).connect(g).connect(this.fam.perc);
    src.start(t); src.stop(t + 0.1);
  }
  // two quick rising notes: a birdcall over the machinery
  birdcall(t, m) {
    for (const [dt, off, dur] of [[0, 0, 0.07], [0.09, 5, 0.11]]) {
      this.tone({ freq: f(m + off), t: t + dt, dur, gain: 0.045, type: 'sine', echo: 0.4, fam: 'lead' });
    }
  }
  padChord(t, rootM, triad, dur) {
    for (const iv of triad) {
      for (const det of [-6, 6]) {
        this.tone({ freq: f(rootM + 12 + iv), t, dur, gain: 0.026, type: 'sawtooth',
          detune: det, attack: dur * 0.35, echo: 0.15, fam: 'pad' });
      }
      this.tone({ freq: f(rootM + iv), t, dur, gain: 0.03, type: 'triangle',
        attack: dur * 0.3, fam: 'pad' });
    }
  }
  playScoreStep(st, t) {
    const mv = SCORE[this.movement];
    if (!mv) return;
    const bar = Math.floor(st / 16) % mv.loop;
    const pos = st & 15;
    const ch = mv.cycle[bar];
    const rootM = 48 + ch.root - (ch.root > 7 ? 12 : 0);
    const triad = ch.minor ? [0, 3, 7] : [0, 4, 7];
    const en = mv.energy[bar] ?? 0.8;                 // the record's own arc
    const barDur = 16 * this.s16();
    if (this.movement === 'engines') {
      // quiet engines: warm washes, a low heartbeat, breath of the rails
      if (pos === 0) this.padChord(t, rootM, triad, barDur);
      if (pos % 8 === 0) this.tone({ freq: f(rootM - 12), t, dur: this.s16() * 6,
        gain: 0.085 * en, type: 'sine', fam: 'bass' });
      if (pos % 4 === 2) this.chuff(t, 0.02 + 0.016 * en);
      if (pos === 8 && bar % 2 === 1) this.tone({ freq: f(rootM + 24 + triad[1]), t,
        dur: this.s16() * 5, gain: 0.055, vibrato: 5, echo: 0.4, fam: 'lead' });
    } else if (this.movement === 'gears') {
      // gears and birdcalls: clockwork arps, tick hats, chirps offbeat
      if (pos === 0) { this.padChord(t, rootM, triad, barDur); this.kick(t, 0.05 + 0.04 * en); }
      const arpNote = triad[[0, 2, 1, 2][pos % 4]] + (pos % 8 >= 4 ? 12 : 0);
      this.tone({ freq: f(rootM + 12 + arpNote), t, dur: this.s16() * 0.55,
        gain: 0.03 * (0.6 + 0.4 * en), fam: 'arp' });
      if (pos % 2 === 0) this.hat(t, 0.018 + 0.014 * en);
      if (pos === 14 && bar % 2 === 1) this.birdcall(t, rootM + 24);
    } else {
      // the inexorable passacaglia: the ground walks every beat, and a
      // new layer joins each time the cycle comes round again
      const rep = Math.floor(st / (16 * mv.loop));
      const layers = Math.min(4, 1 + (rep % 5) + Math.round((this.intensity ?? 0.5)));
      if (pos % 4 === 0) {
        const walk = [0, 0, 7, ch.minor ? 3 : 4][(pos / 4) & 3];
        this.tone({ freq: f(rootM - 12 + walk), t, dur: this.s16() * 3.4,
          gain: 0.09, type: 'triangle', fam: 'bass' });
      }
      if (layers >= 2 && pos === 0) this.padChord(t, rootM, triad, barDur);
      if (layers >= 3) {
        if (pos === 0) this.kick(t, 0.08);
        if (pos === 8) this.kick(t, 0.05);
        if (pos % 2 === 1) this.hat(t, 0.02 + 0.012 * en);
      }
      if (layers >= 4) {
        const a = triad[[0, 1, 2, 1][pos % 4]];
        this.tone({ freq: f(rootM + 12 + a), t, dur: this.s16() * 0.8,
          gain: 0.026, echo: 0.3, fam: 'arp' });
        if (pos % 8 === 4) this.tone({ freq: f(rootM + 24 + triad[bar % 3]), t,
          dur: this.s16() * 6, gain: 0.05, vibrato: 6, echo: 0.5, fam: 'lead' });
      }
    }
  }
}
