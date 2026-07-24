// FoafInput — directional input as an OS service.
//
// Guests should not each ship their own on-screen d-pad. One surface,
// owned by the shell, fed by three sources:
//
//   touch/pointer  the shell's own on-screen pad (rendered in the HOST
//                  page, so it gets real safe-area insets and the real
//                  visible viewport — an in-iframe pad cannot)
//   keyboard       arrows / WASD / space / escape
//   gamepad        the Gamepad API, polled on rAF, EDGE-DETECTED
//
// …and normalized to one small action vocabulary:
//
//   up down left right   a (primary) b (secondary) start
//
// Sinks receive {action, phase:'press'|'release', source}. The shell's
// sink forwards to the focused window (SDK `key` messages for guests,
// bus events for widgets). Autorepeat is the SERVICE's policy, not
// something every button reinvents: press → immediate, then repeat at
// `repeatMs` while held. Repeats are marked `repeat: true` so sinks that
// only want edges can ignore them.
//
// Availability is announced: when a physical gamepad appears, the shell
// can retire the on-screen pad (`input.gamepad` bus event).

export const ACTIONS = ['up', 'down', 'left', 'right', 'a', 'b', 'start'];

// Normalized action → the legacy key/code pair the minigame SDK speaks.
export const ACTION_KEYS = {
  up: { key: 'ArrowUp', code: 'ArrowUp' },
  down: { key: 'ArrowDown', code: 'ArrowDown' },
  left: { key: 'ArrowLeft', code: 'ArrowLeft' },
  right: { key: 'ArrowRight', code: 'ArrowRight' },
  a: { key: ' ', code: 'Space' },
  b: { key: 'Escape', code: 'Escape' },
  start: { key: 'Enter', code: 'Enter' },
};

const KEY_ACTIONS = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'a', Escape: 'b', Enter: 'start',
};

// Standard-gamepad button index → action (0=A/cross, 1=B/circle,
// 9=start, 12..15 = dpad up/down/left/right)
const PAD_BUTTONS = { 0: 'a', 1: 'b', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

export class FoafInput {
  constructor({ bus = null, repeatMs = 60, deadzone = 0.45 } = {}) {
    this.bus = bus;
    this.repeatMs = repeatMs;
    this.deadzone = deadzone;
    this.sinks = new Set();
    this.held = new Map();        // action → { timer, source }
    this.gamepadIndex = null;
    this._padState = new Map();   // action → bool (edge detection)
    this._raf = null;
    this._keyHandlers = null;
  }

  // sink(evt) — evt = { action, phase, source, repeat }
  addSink(sink) { this.sinks.add(sink); return () => this.sinks.delete(sink); }

  _emit(action, phase, source, repeat = false) {
    const evt = { action, phase, source, repeat };
    for (const s of [...this.sinks]) {
      try { s(evt); } catch (e) { console.error('[FoafInput] sink failed:', e); }
    }
  }

  // Public: begin/end an action from any source. Autorepeat lives here.
  press(action, source = 'touch') {
    if (!ACTIONS.includes(action) || this.held.has(action)) return;
    this._emit(action, 'press', source);
    const timer = setInterval(() => this._emit(action, 'press', source, true), this.repeatMs);
    this.held.set(action, { timer, source });
  }

  release(action, source = 'touch') {
    const h = this.held.get(action);
    if (!h) return;
    clearInterval(h.timer);
    this.held.delete(action);
    this._emit(action, 'release', source);
  }

  releaseAll() { for (const a of [...this.held.keys()]) this.release(a); }

  // ── keyboard ─────────────────────────────────────────────────────────
  attachKeyboard(target = window) {
    if (this._keyHandlers) return;
    const down = (e) => {
      const action = KEY_ACTIONS[e.code];
      if (!action || e.repeat) return;      // our own autorepeat, not the OS's
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      this.press(action, 'key');
    };
    const up = (e) => {
      const action = KEY_ACTIONS[e.code];
      if (action) this.release(action, 'key');
    };
    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    // never leave a key stuck when focus leaves the page
    const blur = () => this.releaseAll();
    target.addEventListener('blur', blur);
    this._keyHandlers = { target, down, up, blur };
    return this;
  }

  // ── on-screen pad: bind any element carrying data-action ─────────────
  bindSurface(root) {
    if (!root) return this;
    for (const el of root.querySelectorAll('[data-action]')) {
      const action = el.dataset.action;
      if (!ACTIONS.includes(action)) continue;
      el.style.touchAction = 'none';
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        el.classList.add('pressed');
        this.press(action, 'touch');
      });
      const end = (e) => {
        e.preventDefault();
        el.classList.remove('pressed');
        this.release(action, 'touch');
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('pointerleave', end);
      // a pad button is a control, never a text selection or a link drag
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      el.draggable = false;
    }
    return this;
  }

  // ── gamepad ──────────────────────────────────────────────────────────
  attachGamepads() {
    if (typeof window === 'undefined' || !navigator.getGamepads) return this;
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
      this.bus?.publish('input.gamepad',
        { connected: true, id: e.gamepad.id, summary: `gamepad connected: ${e.gamepad.id}` }, { retain: true });
      this._startPolling();
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadIndex = null;
      this._stopPolling();
      this.releaseAll();
      this.bus?.publish('input.gamepad', { connected: false, summary: 'gamepad disconnected' }, { retain: true });
    });
    return this;
  }

  _startPolling() {
    if (this._raf || typeof requestAnimationFrame === 'undefined') return;
    const poll = () => {
      this._pollOnce();
      this._raf = requestAnimationFrame(poll);
    };
    this._raf = requestAnimationFrame(poll);
  }
  _stopPolling() {
    if (this._raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  // Edge-detected: only state CHANGES produce events (a held gamepad
  // button relies on the service's autorepeat like every other source).
  _pollOnce() {
    const pads = navigator.getGamepads?.() || [];
    const pad = pads[this.gamepadIndex] || pads.find(p => p);
    if (!pad) return;
    const now = new Map();
    for (const [i, action] of Object.entries(PAD_BUTTONS)) {
      if (pad.buttons[i]?.pressed) now.set(action, true);
    }
    const [x, y] = [pad.axes[0] ?? 0, pad.axes[1] ?? 0];
    if (x < -this.deadzone) now.set('left', true);
    if (x > this.deadzone) now.set('right', true);
    if (y < -this.deadzone) now.set('up', true);
    if (y > this.deadzone) now.set('down', true);

    for (const action of ACTIONS) {
      const was = this._padState.get(action) || false;
      const is = now.get(action) || false;
      if (is && !was) this.press(action, 'gamepad');
      else if (!is && was) this.release(action, 'gamepad');
    }
    this._padState = now;
  }

  destroy() {
    this.releaseAll();
    this._stopPolling();
    if (this._keyHandlers) {
      const { target, down, up, blur } = this._keyHandlers;
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', blur);
      this._keyHandlers = null;
    }
    this.sinks.clear();
  }
}
