/**
 * debug-clock.js — the platform's slow-motion / freeze / step service for
 * guest widgets. Include it in any guest (SDK-based or one that speaks
 * the postMessage protocol natively, like robbin):
 *
 *     <script src="../debug-clock.js"></script>
 *
 * It self-installs, listens for the host's `{type:'debug', timeScale,
 * stepFrames}` message, honours `?timescale=0.02` when run standalone,
 * and exposes `window.__mgDebug` for headless drivers.
 *
 * WHY: WebGL under SwiftShader renders at ~2fps, so "look at the frame"
 * is useless for anything that moves. Running a game 50× slow is the
 * difference between an AI seeing a blur and reading the state. Rather
 * than ask every guest to implement a speed setting, virtualise the four
 * clocks a browser game can read — requestAnimationFrame, setTimeout,
 * setInterval, and now() — so an UNMODIFIED game slows correctly whether
 * it integrates dt or advances a fixed step per frame.
 *
 * HOW: decimate real frames (deliver every k-th, k = 1/scale) and hand
 * out a timestamp that advanced by the usual ~16.7ms. A fixed-step game
 * takes one step per delivered frame; a dt-based game sees a normal dt.
 * Both end up 1/scale as fast in wall time with identical per-frame
 * behaviour to full speed. Timers stretch by the same factor, so a 30
 * second round really is 30 *virtual* seconds.
 *
 * CAVEAT: this patches THIS document only. A guest that wraps another
 * game in a nested iframe (battleboids) must forward the message inward.
 *
 * Nothing is patched until something asks for a scale other than 1, so
 * normal play is untouched.
 */
(function () {
  if (window.__mgDebug) return;

  let clock = null;

  function install() {
    if (clock) return clock;
    const w = window;
    const real = {
      raf: w.requestAnimationFrame.bind(w),
      setTimeout: w.setTimeout.bind(w),
      setInterval: w.setInterval.bind(w),
      perfNow: () => performance.now(),
      dateNow: Date.now.bind(Date),
    };
    const t0 = real.perfNow();
    clock = {
      real, scale: 1, k: 1, frozen: false, steps: 0,
      virtual: t0, lastReal: t0, frame: 0, delivered: 0,
      epoch: real.dateNow(), virtualEpoch: t0,
    };

    // rAF: one real pump, a virtual queue in front of it
    const queue = new Map();
    let nextId = 1;
    w.requestAnimationFrame = (cb) => { const id = nextId++; queue.set(id, cb); return id; };
    w.cancelAnimationFrame = (id) => { queue.delete(id); };

    const pump = () => {
      real.raf(pump);
      const now = real.perfNow();
      clock.frame++;
      if (clock.scale < 1 && clock.frame % clock.k !== 0) return;
      clock.virtual += (now - clock.lastReal) * clock.scale;
      clock.lastReal = now;
      if (clock.frozen) {
        if (clock.steps <= 0) return;
        clock.steps--;
        clock.virtual += 1000 / 60;   // a stepped frame must advance time
      }
      clock.delivered++;
      const due = [...queue.values()];
      queue.clear();
      for (const cb of due) {
        try { cb(clock.virtual); } catch (e) { console.error('[debug-clock] rAF callback threw', e); }
      }
    };
    real.raf(pump);

    const stretch = (ms) => (clock.scale > 0 && clock.scale < 1) ? (ms || 0) / clock.scale : (ms || 0);
    w.setTimeout = (fn, ms, ...a) => real.setTimeout(fn, stretch(ms), ...a);
    w.setInterval = (fn, ms, ...a) => real.setInterval(fn, stretch(ms), ...a);
    try { performance.now = () => clock.virtual; } catch (e) { /* locked down */ }
    try { Date.now = () => clock.epoch + (clock.virtual - clock.virtualEpoch); } catch (e) { /* ditto */ }

    return clock;
  }

  /** @param {number} scale 1 = real time, 0.02 = 50× slow, 0 = frozen */
  function setTimeScale(scale) {
    const s = Math.max(0, Math.min(50, Number(scale) || 0));
    if (s === 1 && !clock) return 1;             // nothing patched, nothing to do
    const c = install();
    c.scale = s;
    c.k = (s > 0 && s < 1) ? Math.max(1, Math.round(1 / s)) : 1;
    c.frozen = s === 0;
    return s;
  }

  /** Advance exactly n frames while frozen — deterministic stepping. */
  function stepFrames(n) {
    install().steps += Math.max(0, (n === undefined ? 1 : n) | 0);
  }

  window.__mgDebug = {
    setTimeScale, stepFrames,
    get state() {
      return clock
        ? { scale: clock.scale, k: clock.k, frozen: clock.frozen, frame: clock.frame,
            delivered: clock.delivered, virtual: clock.virtual }
        : { scale: 1, k: 1, frozen: false, frame: 0, delivered: 0, installed: false };
    },
  };

  // Host-driven: works whether or not the guest uses minigame-sdk.js.
  window.addEventListener('message', (event) => {
    const d = event.data;
    if (!d || d.type !== 'debug') return;
    if (d.timeScale !== undefined) setTimeScale(d.timeScale);
    if (d.stepFrames !== undefined) stepFrames(d.stepFrames);
  });

  // Standalone: ?timescale=0.02 slows a guest with no host involved.
  try {
    const ts = new URLSearchParams(location.search).get('timescale');
    if (ts !== null) setTimeScale(parseFloat(ts));
  } catch (e) { /* opaque origin */ }
})();
