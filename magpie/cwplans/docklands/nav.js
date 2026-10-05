// Docklands 3D page: navigation helpers. Momentum after a drag, pinch or twist; the ground limit (a soft wall 1 m from
// the ground or water at the eye, a haptic click and a pass into Below ground when the push goes on).
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
const W = 1, PMIN_UNDER = -1.35, PUSH_MS = 600, PUSH_PX = 480;   // wall (m from the surface), pitch limit below ground, push to pass
const followMode = () => { const L = globalThis.DocklandsLocate; return !!(L && L.state && /^(centred|heading|eye)$/.test(L.state.mode)); };
const get = () => ({ tx: cam.tx, tz: cam.tz, ty: cam.ty || 0, yaw: cam.yaw, pitch: cam.pitch, ld: Math.log(cam.dist) });
const put = s => { cam.tx = s.tx; cam.tz = s.tz; cam.ty = s.ty; cam.yaw = s.yaw; cam.pitch = s.pitch; cam.dist = Math.exp(s.ld); };
const isUnder = () => { const g = $('gauge'), c = $('cut'); return !!(g && !g.hidden) || !!(c && +c.value < 250); };
const pitchMin = () => D.PIX.on ? .2 : isUnder() ? PMIN_UNDER : -.6;

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

// ---------- the ground limit: the eye stays 1 m above the ground or water under it (LiDAR DTM, groundAt). Towards
// the surface every move slows down (a soft wall over max(6 m, 2% of the distance)) and stops 1 m from it. A push that
// goes on (0.6 s, or 480 px of finger travel) clicks (vibrate 15 ms where the browser has it, and a visual snap) and
// passes into Below ground: the depth gauge opens and the model is cut at street level. Below ground the same wall
// and click bring the eye back up; there the view may look up from below (pitch to -1.35).
const vz = () => +(($('vz') || {}).value) || 1;
const eyeOf = s => { const d = Math.exp(s.ld), cp = Math.cos(s.pitch); return [s.tx + d * Math.sin(s.yaw) * cp, s.ty + d * Math.sin(s.pitch) / vz(), s.tz + d * Math.cos(s.yaw) * cp]; };
const surf = (x, z) => D.groundAt(x, z);
const clr = s => { const e = eyeOf(s); return e[1] - surf(e[0], e[2]); };
function guard(s0, user, dpx = 0, t = performance.now()) {
  const res = { blocked: false, r: 1 };
  if (off() || D.PIX.on) return res;
  const s1 = get(), under = isUnder(), c0 = clr(s0);
  let sg; if (!under) sg = 1; else if (c0 < 0) sg = -1; else return res;   // Below ground with the eye above the surface: free
  const a0 = sg * c0, a1 = sg * clr(s1), Z = Math.max(6, Math.exp(s0.ld) * .02);
  if (a1 >= a0 - 1e-9 || (a0 >= W + Z && a1 >= W)) { if (user) S.push = null; return res; }   // not towards the surface, or still far from it
  const r = Math.max(.06, Math.min(1, (a0 - W) / Z));
  let s = { ...s1, pitch: s0.pitch, ld: s0.ld };   // the sideways part of the move (pan, turn) keeps going unless it alone runs into rising ground
  if (sg * clr(s) < Math.min(W, a0)) s = { ...s, tx: s0.tx, tz: s0.tz, yaw: s0.yaw, ty: s0.ty };
  const at = k => ({ ...s, pitch: s0.pitch + (s1.pitch - s0.pitch) * k, ld: s0.ld + (s1.ld - s0.ld) * k });
  let k = r;
  if (sg * clr(at(k)) < W) { if (sg * clr(at(0)) < W) k = 0; else { let lo = 0, hi = k; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (sg * clr(at(m)) >= W) lo = m; else hi = m; } k = lo; } }
  put(at(k)); res.r = k; res.blocked = a1 < W; res.sg = sg;
  if (user && res.blocked) push(sg, dpx, t);
  return res;
}
function push(sg, dpx, t) {
  if (t < S.cool) return;
  const P = S.push; if (!P || t - P.last > 350 || P.sg !== sg) S.push = { t0: t, last: t, px: 0, n: 0, sg }; else P.last = t;
  S.push.px += dpx; S.push.n++; S.pushes++;
  cue(sg, Math.min(1, Math.max((t - S.push.t0) / PUSH_MS, S.push.px / PUSH_PX)));
  if ((t - S.push.t0 >= PUSH_MS && S.push.n >= 3) || S.push.px >= PUSH_PX) pass(sg, t);
}
// put the eye at clearance c by turning the pitch towards lim; if the pitch cannot reach it, move the target up or down
function place(c, lim) {
  const s = get(), f = p => clr({ ...s, pitch: p }) - c, f0 = f(s.pitch), fl = f(lim);
  if (Math.sign(f0) === Math.sign(fl)) { s.pitch = lim; s.ty -= fl; } else { let lo = s.pitch, hi = lim; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (Math.sign(f(m)) === Math.sign(f0)) lo = m; else hi = m; } s.pitch = hi; }
  put(s);
}
function pass(sg, t) {
  S.push = null; S.cool = t + 900; S.hold = true; stop(); const cut = $('cut');   // hold: the rest of this gesture does not tilt or zoom on
  if (sg > 0) {   // down: Below ground on, the model cut at street level unless the gauge already has a level
    const e = eyeOf(get()), g = surf(e[0], e[2]);
    if (cut && +cut.value >= 250) { cut.value = String(clamp(Math.round(g) - 1, -40, 60)); cut.dispatchEvent(new Event('input')); }
    if ($('gauge').hidden) $('digBtn').click();
    place(-1.5, PMIN_UNDER);
  } else {   // up: Below ground off (the gauge's cross also takes the cut away)
    if (!$('gauge').hidden) $('gaugeX').click(); else if (cut && +cut.value < 250) { cut.value = '250'; cut.dispatchEvent(new Event('input')); }
    place(1.5, PMAX);
  }
  S.passes++; S.lastPass = sg > 0 ? 'under' : 'above';
  let buzz = false; try { buzz = !!(navigator.vibrate && navigator.vibrate(15)); } catch { /* not allowed */ }
  S.vibrated = buzz; cue(sg, 1, true);
  dispatchEvent(new CustomEvent('docklands-nav-pass', { detail: { to: S.lastPass, vibrated: buzz } }));
  D.draw();
}
// the visual click: a ring that fills while the push lasts and snaps when the eye passes (iOS Safari has no vibrate)
const css = document.createElement('style');
css.textContent = `#navCue{position:absolute;z-index:3;left:50%;top:50%;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;pointer-events:none;opacity:0;display:grid;place-items:center;
font:600 11px/1.2 system-ui,sans-serif;color:#e8eaec;text-align:center;text-shadow:0 1px 2px #000;background:conic-gradient(#4da3ffcc calc(var(--p,0)*1turn),#4da3ff22 0);-webkit-mask:radial-gradient(circle,transparent 33px,#000 34px);mask:radial-gradient(circle,transparent 33px,#000 34px)}
#navCue.on{opacity:1}#navCue.snap{animation:navSnap .45s ease-out forwards}@keyframes navSnap{0%{opacity:1;transform:scale(1)}40%{transform:scale(1.25)}100%{opacity:0;transform:scale(1.6)}}
#navCueT{position:absolute;z-index:3;left:50%;top:calc(50% + 50px);transform:translateX(-50%);pointer-events:none;font:600 13px/1.2 system-ui,sans-serif;color:#e8eaec;background:#1b2128e6;border-radius:8px;padding:4px 8px;opacity:0;transition:opacity .3s}
#navCueT.on{opacity:1}@media (prefers-reduced-motion: reduce){#navCue.snap{animation:none;opacity:0}}body.capture #navCue,body.capture #navCueT{display:none!important}`;
document.head.appendChild(css);
const cueEl = document.createElement('div'), cueT = document.createElement('div'); cueEl.id = 'navCue'; cueT.id = 'navCueT'; cueT.setAttribute('role', 'status'); cueT.setAttribute('aria-live', 'polite');
($('wrap') || document.body).append(cueEl, cueT);
let cueTimer = 0, cueTT = 0;
function cue(sg, p, snap) {
  clearTimeout(cueTimer); cueEl.style.setProperty('--p', p.toFixed(3)); cueEl.classList.remove('snap');
  if (snap) { void cueEl.offsetWidth; cueEl.classList.add('snap'); cueEl.classList.remove('on'); clearTimeout(cueTT);
    cueT.textContent = sg > 0 ? 'Below ground. Push up to come back.' : 'Above ground'; cueT.classList.add('on'); cueTT = setTimeout(() => cueT.classList.remove('on'), 2200); return; }
  cueEl.classList.add('on'); cueTimer = setTimeout(() => cueEl.classList.remove('on'), 400);
}
Object.assign(S, { hold: false, holdW: 0, push: null, cool: 0, passes: 0, pushes: 0, lastPass: null, vibrated: null, wsnap: null, xy: new Map() });
addEventListener('pointerdown', e => { if (S.ptrs.has(e.pointerId)) S.xy.set(e.pointerId, [e.clientX, e.clientY]); }, true);
addEventListener('pointerup', e => S.xy.delete(e.pointerId), true); addEventListener('pointercancel', e => S.xy.delete(e.pointerId), true);
addEventListener('wheel', () => { S.wsnap = get(); }, { capture: true, passive: true });
cv.addEventListener('wheel', e => { if (!S.wsnap) return; const s0 = S.wsnap; S.wsnap = null;
  if (S.hold && !S.ptrs.size) { if (e.timeStamp - S.holdW < 400) { S.holdW = e.timeStamp; put({ ...get(), ld: s0.ld }); return; } S.hold = false; }
  guard(s0, true, Math.min(120, Math.abs(e.deltaY)) * .6, e.timeStamp); if (S.hold) S.holdW = e.timeStamp; }, { passive: true });
for (const ty of ['pointerup', 'pointercancel']) addEventListener(ty, () => { if (!S.ptrs.size) S.hold = false; });   // bubble phase: after the release above

const NAV = globalThis.DocklandsNav = {
  state: S, fling, stop, tick, pitchMin, guard, clearance: () => clr(get()), isUnder,
  afterMove(s0, e) { const p = S.xy.get(e.pointerId), dpx = p ? Math.hypot(e.clientX - p[0], e.clientY - p[1]) : 0; S.xy.set(e.pointerId, [e.clientX, e.clientY]); if (S.hold) { put({ ...get(), pitch: s0.pitch, ld: s0.ld, ty: s0.ty }); return; } guard(s0, true, dpx, e.timeStamp); },
  afterStep(s0, v) { const g = guard(s0, false); if (g.r < 1) { v.pitch *= g.r; v.ld *= g.r; } if (g.blocked) { v.pitch = 0; v.ld = 0; } },
};
})();
