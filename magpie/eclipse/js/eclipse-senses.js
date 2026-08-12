/**
 * eclipse-senses.js — read aloud, chime, buzz, and keep the screen on.
 *
 * A five year old cannot read a safety rule. The read-aloud button is
 * not decoration on an app for young children; it is how the safety
 * page reaches the youngest user in the group.
 *
 * Every capability here is optional. Each one is feature-detected and
 * fails quietly, because a browser without speech must still show a
 * working eclipse guide.
 */

export class Speaker {
  constructor() {
    this.supported = 'speechSynthesis' in window;
    this.speaking = false;
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _announce() {
    for (const fn of this.listeners) fn(this.speaking);
  }

  /** Read a block of text. Slow and clear, for a young listener. */
  speak(text) {
    if (!this.supported || !text) return;
    this.stop();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.92;
    utter.pitch = 1.05;
    utter.lang = 'en-GB';
    utter.onend = () => { this.speaking = false; this._announce(); };
    utter.onerror = () => { this.speaking = false; this._announce(); };
    this.speaking = true;
    this._announce();
    speechSynthesis.speak(utter);
  }

  stop() {
    if (!this.supported) return;
    speechSynthesis.cancel();
    this.speaking = false;
    this._announce();
  }

  toggle(text) {
    if (this.speaking) this.stop();
    else this.speak(text);
  }
}

/**
 * A soft two-note chime for the moments that matter. Built from
 * oscillators, so there is no audio file to download and nothing to go
 * missing when the app runs offline in a field.
 */
export class Chime {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  /** Must first run inside a tap, or the browser will not allow sound. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
  }

  play(kind = 'soft') {
    if (!this.enabled) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = kind === 'big' ? [523.25, 659.25, 783.99] : [659.25, 987.77];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = now + i * 0.16;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.22, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 1.2);
    });
  }
}

/** A short buzz. Ignored by browsers that do not do haptics. */
export function buzz(pattern = [40, 60, 120]) {
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (err) { /* not important */ }
  }
}

/**
 * Keep the screen awake while a child is standing outside watching.
 * A screen that sleeps every thirty seconds during an eclipse is a
 * small disaster.
 */
export class ScreenAwake {
  constructor() {
    this.supported = 'wakeLock' in navigator;
    this.lock = null;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.wanted) this.request();
    });
    this.wanted = false;
  }

  async request() {
    this.wanted = true;
    if (!this.supported) return false;
    try {
      this.lock = await navigator.wakeLock.request('screen');
      return true;
    } catch (err) {
      return false;
    }
  }

  async release() {
    this.wanted = false;
    if (this.lock) {
      try { await this.lock.release(); } catch (err) { /* not important */ }
      this.lock = null;
    }
  }
}
