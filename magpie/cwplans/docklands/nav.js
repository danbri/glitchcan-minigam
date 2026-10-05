// Docklands 3D page: navigation helpers. Momentum after a drag, pinch or twist.
// Loaded after locate.js; talks to the page only through window.__docklands. Why each choice was made and the
// tests: skill docklands-3d-page, "Navigation: momentum, ground limit, share".
(() => {
'use strict';
const D = window.__docklands;
if (!D || !D.cam) return;
const $ = id => document.getElementById(id), cv = $('c'), labelBox = $('labels'), cam = D.cam;
const TAU = .35, T_END = 3.2, PMAX = 1.5695, DMIN = 80, DMAX = 16000;   // decay time constant (s); a fling ends 3.2 s (about 9 TAU) after release
const S = { moving: false, v: null, t0: 0, t: 0, last: null, manual: false, samples: [], ptrs: new Set(), snap: null, flings: 0 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const off = () => !!cam.eye;
const followMode = () => { const L = globalThis.DocklandsLocate; return !!(L && L.state && /^(centred|heading|eye)$/.test(L.state.mode)); };
const get = () => ({ tx: cam.tx, tz: cam.tz, ty: cam.ty || 0, yaw: cam.yaw, pitch: cam.pitch, ld: Math.log(cam.dist) });
const put = s => { cam.tx = s.tx; cam.tz = s.tz; cam.ty = s.ty; cam.yaw = s.yaw; cam.pitch = s.pitch; cam.dist = Math.exp(s.ld); };
const pitchMin = () => D.PIX.on ? .2 : -.6;

// ---------- momentum: release velocity from the last 80 ms of camera motion, exponential decay by time (not by frame)
function stop() { S.moving = false; S.v = null; }
function fling(v, t) {
  if (reduced() || off() || followMode()) return false;
  S.v = { ...v }; S.lastV = { ...v }; S.t0 = S.t = t; S.last = get(); S.moving = true; S.flings++;
  if (!S.manual) requestAnimationFrame(loop);
  return true;
}
// the state at time t is s0 + v TAU (1 - e^(-t/TAU)) for each part, so 2 and 120 frames a second end in the same place
function tick(now) {
  if (!S.moving) return;
  const l = S.last, c = get();
  if (Math.abs(c.tx - l.tx) > 1e-6 || Math.abs(c.tz - l.tz) > 1e-6 || Math.abs(c.yaw - l.yaw) > 1e-9 || Math.abs(c.pitch - l.pitch) > 1e-9 || Math.abs(c.ld - l.ld) > 1e-9 || c.ty !== l.ty) return stop();   // something else moved the camera (a view, a search, a flight, the locate button)
  if (followMode() || off() || document.hidden) return stop();
  const te = Math.min(now, S.t0 + T_END * 1000), dt = Math.max(0, (te - S.t) / 1000); S.t = te;
  if (dt > 0) {
    const e = Math.exp(-dt / TAU), k = TAU * (1 - e), v = S.v;
    const s = { ...c, tx: c.tx + v.tx * k, tz: c.tz + v.tz * k, yaw: c.yaw + v.yaw * k, pitch: c.pitch + v.pitch * k, ld: c.ld + v.ld * k };
    const pm = pitchMin(); if (s.pitch < pm || s.pitch > PMAX) { s.pitch = clamp(s.pitch, pm, PMAX); v.pitch = 0; }
    if (s.ld < Math.log(DMIN) || s.ld > Math.log(DMAX)) { s.ld = clamp(s.ld, Math.log(DMIN), Math.log(DMAX)); v.ld = 0; }
    put(s); NAV.afterStep(c, v);
    for (const key of ['tx', 'tz', 'yaw', 'pitch', 'ld']) v[key] *= e;
    S.last = get(); D.draw();
  }
  if (te >= S.t0 + T_END * 1000) stop();
}
const loop = now => { tick(now); if (S.moving && !S.manual) requestAnimationFrame(loop); };

const sample = t => { S.samples.push({ t, ...get() }); if (S.samples.length > 40) S.samples.shift(); };
function release(tUp) {
  const sm = S.samples; S.samples = [];
  if (sm.length < 2 || off() || followMode()) return;
  const last = sm[sm.length - 1]; if (tUp - last.t > 60) return;   // the finger stopped before it lifted: no momentum
  let a = sm.find(s => s.t >= last.t - 80); if (a === last) a = sm[sm.length - 2];
  const dt = (last.t - a.t) / 1000; if (dt < .008 || dt > .25) return;
  const d = Math.exp(last.ld), v = { tx: (last.tx - a.tx) / dt, tz: (last.tz - a.tz) / dt, yaw: angDiff(last.yaw, a.yaw) / dt, pitch: (last.pitch - a.pitch) / dt, ld: (last.ld - a.ld) / dt };
  // slow parts get none (a careful placement stays put); fast ones are capped (one flick moves at most about one view)
  const ps = Math.hypot(v.tx, v.tz) / d;
  if (ps < .25) { v.tx = v.tz = 0; } else if (ps > 3) { v.tx *= 3 / ps; v.tz *= 3 / ps; }
  if (Math.abs(v.yaw) < .3) v.yaw = 0; else v.yaw = clamp(v.yaw, -5, 5);
  if (Math.abs(v.pitch) < .3) v.pitch = 0; else v.pitch = clamp(v.pitch, -2, 2);
  if (Math.abs(v.ld) < .4) v.ld = 0; else v.ld = clamp(v.ld, -3, 3);
  if (v.tx || v.tz || v.yaw || v.pitch || v.ld) fling(v, tUp);
}

// pointers that start on the model or on a label (the label layer feeds the same gestures)
const mine = e => e.target === cv || (labelBox && labelBox.contains(e.target));
addEventListener('pointerdown', e => { stop(); if (mine(e)) { S.ptrs.add(e.pointerId); S.samples = []; } }, true);   // any touch stops the momentum
addEventListener('pointermove', e => { if (S.ptrs.has(e.pointerId)) S.snap = get(); }, true);
const moved = e => { if (!S.ptrs.has(e.pointerId) || !S.snap) return; const s0 = S.snap; S.snap = null; NAV.afterMove(s0, e); sample(e.timeStamp); };
cv.addEventListener('pointermove', moved); if (labelBox) labelBox.addEventListener('pointermove', moved);   // after the page's own handlers
addEventListener('pointerup', e => { if (!S.ptrs.delete(e.pointerId)) return;
  if (S.ptrs.size) { S.lift = { sm: S.samples, t: e.timeStamp }; S.samples = []; return; }   // one finger of a pinch lifted: keep its motion for a moment
  if (S.samples.length < 2 && S.lift && e.timeStamp - S.lift.t < 80) { S.samples = S.lift.sm; S.lift = null; release(S.samples.length ? Math.min(e.timeStamp, S.samples[S.samples.length - 1].t + 16) : e.timeStamp); return; }   // both fingers lifted together
  S.lift = null; release(e.timeStamp); }, true);
addEventListener('pointercancel', e => { if (S.ptrs.delete(e.pointerId)) S.samples = []; }, true);
addEventListener('wheel', () => stop(), { capture: true, passive: true });
addEventListener('keydown', e => { if (e.key === 'Escape') stop(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

const NAV = globalThis.DocklandsNav = {
  state: S, fling, stop, tick, pitchMin,
  afterMove() {}, afterStep() {},   // the ground limit (next section) replaces these
};
})();
