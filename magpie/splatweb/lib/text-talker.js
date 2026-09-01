// text-talker.js — lipsync for GENERATED speech: feed it a stream of text
// (e.g. tokens arriving from an AI), it speaks the text aloud via the
// browser's speechSynthesis and derives mouth visemes from the characters
// currently being spoken (word-boundary events + per-char timing). The
// visemes ride the normal blendshape channels, so the avatar lipsyncs
// through the unchanged 32-byte packet.
//
// If TTS is unavailable (no voices, headless), it degrades to SILENT
// lipsync on an estimated clock — the mouth still moves.
function visemeFor(ch) {
  if ('a'.includes(ch)) return { jaw: 0.7, pucker: 0.0, smile: 0.1 };
  if ('eiy'.includes(ch)) return { jaw: 0.35, pucker: 0.0, smile: 0.5 };
  if ('o'.includes(ch)) return { jaw: 0.5, pucker: 0.6, smile: 0.0 };
  if ('uw'.includes(ch)) return { jaw: 0.3, pucker: 0.75, smile: 0.0 };
  if ('mbp'.includes(ch)) return { jaw: 0.02, pucker: 0.15, smile: 0.0 };
  if ('fv'.includes(ch)) return { jaw: 0.12, pucker: 0.1, smile: 0.25 };
  if ('szcxjdgtnlr'.includes(ch)) return { jaw: 0.22, pucker: 0.0, smile: 0.15 };
  if ('hkq'.includes(ch)) return { jaw: 0.3, pucker: 0.0, smile: 0.0 };
  if (' \t\n,.;:!?-'.includes(ch)) return { jaw: 0.04, pucker: 0.0, smile: 0.0 };
  return { jaw: 0.25, pucker: 0.0, smile: 0.1 };
}

const CHAR_MS = 62;          // spoken-character pace estimate

export class TextTalker {
  constructor() {
    this.speaking = false;
    this.mode = 'idle';      // 'tts' | 'silent' | 'idle'
    this.viseme = { jaw: 0, pucker: 0, smile: 0 };
    this._queue = [];
    this._buf = '';
    this._cur = null;        // { text, at (ms), charIndex, boundaryAt }
  }

  // stream text in as it arrives; complete clauses are spoken as they form
  feed(text) {
    this._buf += text;
    let m;
    while ((m = this._buf.match(/^[\s\S]*?[.!?;:\n]+/))) {
      this._enqueue(m[0]);
      this._buf = this._buf.slice(m[0].length);
    }
  }
  flush() { if (this._buf.trim()) this._enqueue(this._buf); this._buf = ''; }

  stop() {
    try { speechSynthesis?.cancel(); } catch { /* no TTS */ }
    this._queue = []; this._cur = null; this._buf = '';
    this.speaking = false; this.mode = 'idle';
  }

  _enqueue(text) {
    text = text.trim();
    if (!text) return;
    this._queue.push(text);
    this._pump();
  }

  _pump() {
    if (this._cur || !this._queue.length) return;
    const text = this._queue.shift();
    const cur = this._cur = { text, at: 0, charIndex: 0, boundaryAt: 0, done: false };
    this.speaking = true;
    const finish = () => {
      if (this._cur === cur) { this._cur = null; this._pump(); }
      if (!this._cur && !this._queue.length) this.speaking = false;
    };
    let ttsStarted = false;
    if (typeof speechSynthesis !== 'undefined') {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.0;
      u.onstart = () => { ttsStarted = true; this.mode = 'tts'; cur.at = performance.now(); cur.boundaryAt = cur.at; };
      u.onboundary = (e) => {
        if (e.charIndex != null) { cur.charIndex = e.charIndex; cur.boundaryAt = performance.now(); }
      };
      u.onend = finish;
      u.onerror = finish;
      try { speechSynthesis.speak(u); } catch { /* fall through to silent */ }
    }
    // watchdog: if TTS never starts (no voices / headless), lipsync silently
    setTimeout(() => {
      if (!ttsStarted && this._cur === cur) {
        this.mode = 'silent';
        cur.at = performance.now(); cur.boundaryAt = cur.at;
        setTimeout(finish, text.length * CHAR_MS + 300);
      }
    }, 450);
  }

  // per-frame; returns the smoothed viseme while speaking, else null
  tick(dt) {
    let target = { jaw: 0, pucker: 0, smile: 0 };
    const c = this._cur;
    if (c && c.at) {
      const now = performance.now();
      const idx = this.mode === 'tts'
        ? c.charIndex + Math.floor((now - c.boundaryAt) / CHAR_MS)
        : Math.floor((now - c.at) / CHAR_MS);
      const ch = (c.text[Math.min(idx, c.text.length - 1)] || ' ').toLowerCase();
      target = visemeFor(ch);
    }
    const v = this.viseme;
    for (const k of ['jaw', 'pucker', 'smile']) {
      const kk = target[k] > v[k] ? 1 - Math.exp(-dt * 22) : 1 - Math.exp(-dt * 12);
      v[k] += (target[k] - v[k]) * kk;
    }
    return this.speaking ? v : null;
  }
}
