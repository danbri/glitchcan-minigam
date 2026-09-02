// clip-voice.js — plays pre-generated voice clips (tools/gen-critter-
// voices.mjs → media/critter-voices/) with lipsync: the viseme clock is
// scaled to each clip's real duration, so the mouth tracks the audio
// without any analysis. Falls back cleanly when no clips exist.
import { visemeFor } from './text-talker.js';

export async function loadClipManifest(baseUrl) {
  try {
    const r = await fetch(baseUrl + 'manifest.json');
    if (!r.ok) return null;
    const m = await r.json();
    if (!m.voices || !m.voices.length) return null;   // placeholder manifest
    m.base = baseUrl;
    return m;
  } catch { return null; }
}

export class ClipVoice {
  constructor(manifest, voiceIdx, volume = 0.5) {
    this.m = manifest;
    this.vi = voiceIdx % manifest.voices.length;
    this.volume = volume;
    this.jaw = 0;
    this._text = null;
  }

  // kind: 'l' (chatter line), 't' (thrown exclamation), 'd' (landing),
  // 'k' (toki pona chatter)
  say(lineIdx, kind = 'l') {
    if (this._audio && !this._audio.ended) {
      if (kind === 'l') return;                      // don't interrupt for chatter
      this._audio.pause();                           // effects DO interrupt
    }
    const pool = kind === 't' ? (this.m.throws || []) : kind === 'd' ? (this.m.lands || [])
      : kind === 'k' ? (this.m.toki || []) : this.m.lines;
    if (!pool.length) return;
    const li = lineIdx % pool.length;
    this._textPool = pool;
    const a = new Audio(this.m.base + `v${this.vi}-${kind}${li}.mp3`);
    a.volume = this.volume;
    this._text = pool[li];
    this._audio = a;
    this._start = 0;
    a.addEventListener('playing', () => { this._start = performance.now(); });
    a.play().catch(() => { this._audio = null; });   // autoplay blocked etc.
  }

  stop() {
    if (this._audio) { this._audio.pause(); this._audio = null; }
    this.jaw = 0;
  }

  // per-frame jaw; clip duration drives the per-character clock
  tick(dt) {
    let target = 0;
    const a = this._audio;
    if (a && this._start && !a.ended && a.duration > 0) {
      const idx = Math.floor(((performance.now() - this._start) / 1000)
        / a.duration * this._text.length);
      const ch = (this._text[Math.min(idx, this._text.length - 1)] || ' ').toLowerCase();
      target = visemeFor(ch).jaw;
    }
    const k = target > this.jaw ? 1 - Math.exp(-dt * 22) : 1 - Math.exp(-dt * 12);
    this.jaw += (target - this.jaw) * k;
    return this.jaw;
  }
}
