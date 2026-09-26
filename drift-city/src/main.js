const canvas = document.getElementById("c");
const ui = document.getElementById("ui");
const hint = document.getElementById("hint");
const statusEl = document.getElementById("status");
const vTime = document.getElementById("vTime");
const vRoute = document.getElementById("vRoute");
const statsEl = document.getElementById("stats");
let statsOn = false;
const touchUI = matchMedia("(pointer: coarse)").matches;

function fail(msg, detail) {
  const box = document.getElementById("err");
  box.style.display = "flex";
  document.getElementById("errMsg").textContent = msg;
  if (detail) { const pre = document.createElement("pre"); pre.textContent = detail; document.getElementById("errMsg").appendChild(pre); }
  ui.style.display = "none"; hint.style.display = "none";
}

const presets = [
  { name: "Amber day", sun: [0.62, 0.3, 0.42], sunCol: [2.7, 1.65, 0.7], skyTop: [0.22, 0.11, 0.045], skyHor: [0.82, 0.47, 0.18], fog: [0.5, 0.29, 0.11], den: 0.0019, win: 0.35, stars: 0.0 },
  { name: "Saturnshine", sun: [0.55, 0.08, -0.6], sunCol: [1.05, 0.58, 0.27], skyTop: [0.1, 0.05, 0.05], skyHor: [0.42, 0.22, 0.13], fog: [0.28, 0.16, 0.1], den: 0.003, win: 0.95, stars: 0.25 },
  { name: "Moonglow night", sun: [-0.3, 0.55, 0.45], sunCol: [0.2, 0.42, 0.45], skyTop: [0.008, 0.02, 0.035], skyHor: [0.05, 0.065, 0.08], fog: [0.045, 0.06, 0.07], den: 0.0034, win: 1.35, stars: 0.8 },
  { name: "Methane snow", sun: [-0.5, 0.35, 0.6], sunCol: [1.5, 1.15, 0.72], skyTop: [0.46, 0.33, 0.2], skyHor: [0.68, 0.53, 0.37], fog: [0.58, 0.45, 0.3], den: 0.0042, win: 0.4, stars: 0.0 },
];
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerp3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
let todIdx = 0, todFrom = presets[0], todT = 1, todAuto = 0;
function nextTod() { NAV.sunOverride = null; NAV.sunFrozen = false; todFrom = currentTod(); todIdx = (todIdx + 1) % presets.length; todT = 0; todAuto = 0; syncLabels(); }
function currentTod() {
  const b = presets[todIdx], a = todFrom, t = sstep(0, 1, todT);
  let sunL = NAV.sunOverride && todIdx !== 2 ? NAV.sunOverride : norm3(lerp3(a.sun, b.sun, t));
  // at night the light comes from glowing Rhea, wherever it stands in this place's sky
  if (todIdx === 2 && EX.sky) { const m = EX.sky.moonA.dir; if (m[1] > 0.1) sunL = norm3(lerp3(sunL, m, t)); }
  return { name: b.name, sun: sunL, sunCol: lerp3(a.sunCol, b.sunCol, t), skyTop: lerp3(a.skyTop, b.skyTop, t), skyHor: lerp3(a.skyHor, b.skyHor, t), fog: lerp3(a.fog, b.fog, t), den: lerp(a.den, b.den, t), win: lerp(a.win, b.win, t), stars: lerp(a.stars, b.stars, t) };
}

const st = { x: -250, y: 60, z: -120, vx: 18.6, vy: 0, vz: 11.8, yaw: 0.564, yawVel: 0, pitch: -0.1, roll: 0, pv: 0, rv: 0, aF: 0, aL: 0, vyS: 0, altBias: 0, speedMul: 1, mode: "high", modeT: 32, forced: null, axisYaw: 0, planKey: "", turnDir: 0, realign: true, dbgObst: 0 };
const wind = { x: 0, z: 0, cx: 0, cz: 0, gust: 1 };
st.y = Math.max(st.y, heightAt(st.x, st.z, 1e9) + 15);
const keys = new Set();
let lastInput = -100;
const pointer = { down: false, x: 0, y: 0, sx: 0, sy: 0, hoverX: 0, hoverY: 0, hoverT: -100, type: "mouse" };
let clock = 0;
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function giantAheadOnLine(fx, fz) {
  const bx0 = Math.floor(st.x / BIG), bz0 = Math.floor(st.z / BIG);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const bx = bx0 + i, bz = bz0 + j;
    if (!giantHas(bx, bz)) continue;
    const gx = (bx + 0.5) * BIG - st.x, gz = (bz + 0.5) * BIG - st.z;
    const ahead = gx * fx + gz * fz, lat = -gx * fz + gz * fx;
    if (ahead > -5 && ahead < 170 && Math.abs(lat) < 45) return true;
  }
  return false;
}
function perlin1(x, k) {
  const i = Math.floor(x), f = x - i;
  const w = f * f * f * (f * (f * 6 - 15) + 10);
  const a = (hsh(i, 0, k) * 2 - 1) * f, b = (hsh(i + 1, 0, k) * 2 - 1) * (f - 1);
  return (a + (b - a) * w) * 2;
}
function fbm1(x, k) { return perlin1(x, k) * 0.6 + perlin1(x * 2.13 + 17.1, k + 1) * 0.28 + perlin1(x * 4.7 + 3.3, k + 2) * 0.12; }
function clampv(v, a, b) { return v < a ? a : v > b ? b : v; }

function wrapPJ(v) { return v - LW * Math.round(v / LW); }
function fmtAlt(km) { return km < 10 ? (km * 1000).toFixed(0) + " m" : km < 10000 ? Math.round(km).toLocaleString("en-GB") + " km" : (km / 1000).toFixed(km < 1e5 ? 1 : 0).replace(/\.0$/, "") + " thousand km"; }
function statusHTML(autoOn) {
  if (NAV.mode === "trip") { const a = len3(NAV.cam.P) - TR; return "<b>" + (NAV.tour ? "Grand tour" : "Autopilot") + "</b><span>To " + NAV.trip.dest.name + "</span><span>" + fmtAlt(a) + "</span>"; }
  if (NAV.mode === "free") { const a = len3(NAV.free.P) - TR; return "<b>Flying by hand</b><span>" + regionAt(norm3(NAV.free.P)).name + "</span><span>" + fmtAlt(a) + "</span>"; }
  if (NAV.mode === "space") { const k = NAV.space.kind; return "<b>" + (clock - lastInput > 4.5 ? "Drifting" : "Steering by hand") + "</b><span>" + spaceName() + "</span><span>" + (k === 1 ? fmtAlt(NAV.spaceAlt) + " up" : k === 3 ? fmtAlt(len3(sub3(NAV.cam.P, MOONS[NAV.space.moon].pos)) - MOONS[NAV.space.moon].r) + " up" : k === 4 ? fmtAlt(NAV.space.h) + " above the ring plane" : k === 5 ? fmtAlt(NAV.space.alt) + " above the clouds" : fmtAlt(len3(sub3(NAV.cam.P, SAT_POS))) + " from Saturn") + "</span>"; }
  const lead = NAV.tour ? (autoOn ? "Grand tour" : "Tour paused") : autoOn ? "Autopilot" : "Steering by hand";
  // in the city, a place name you could give someone, not the drone's state
  if (!NAV.tour) return (autoOn ? "" : "<b>By hand</b>") + "<span>" + placeLabel() + "</span>";
  return "<b>" + lead + "</b><span>" + placeLabel() + "</span>";
}
// ---------- flocks of manta-like fliers (boids): cohesion, alignment, separation, a wandering goal near the camera ----------
const FLOCK_N = 96;
let FLOCKS_ON = true;
const FLOCK_DATA = new Float32Array(4 + 16 + FLOCK_N * 8);
const flock = [];
let flockT = 0;
function flockGoal(g) {
  const a = flockT * 0.045 + g * 1.57;
  return [st.x + Math.cos(a) * 170 + Math.cos(a * 2.3) * 60, 0, st.z + Math.sin(a) * 170 + Math.sin(a * 1.7) * 60];
}
function spawnBoid(b, g) {
  const goal = flockGoal(g);
  b.p = [goal[0] + (hsh(flock.length, g, 90) - 0.5) * 80 + (Math.random() - 0.5) * 60, 0, goal[2] + (Math.random() - 0.5) * 80];
  b.p[1] = flockFloor(b.p[0], b.p[2]) + 20 + Math.random() * 60;
  b.v = [Math.random() - 0.5, 0, Math.random() - 0.5];
}
function flockFloor(x, z) { return Math.max(heightAt(x, z), 0) + 22; }
function stepFlock(dt) {
  dt = Math.min(dt, 0.1);
  flockT += dt;
  if (!flock.length) for (let i = 0; i < FLOCK_N; i++) { const b = { g: Math.floor(i / (FLOCK_N / 4)), s: 2.5 + 4 * Math.pow(hsh(i, 3, 91), 2), ph: Math.random() * 6.28 }; flock.push(b); spawnBoid(b, b.g); }
  for (const b of flock) {
    let cx = 0, cy = 0, cz = 0, ax = 0, ay = 0, az = 0, sx = 0, sy = 0, sz = 0, nn = 0;
    for (const o of flock) {
      if (o === b || o.g !== b.g) continue;
      const dx = o.p[0] - b.p[0], dy = o.p[1] - b.p[1], dz = o.p[2] - b.p[2], d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 3600) continue;
      nn++; cx += dx; cy += dy; cz += dz; ax += o.v[0]; ay += o.v[1]; az += o.v[2];
      const sep = (b.s + o.s) * 1.6;
      if (d2 < sep * sep) { const k = 1 / (d2 + 1); sx -= dx * k; sy -= dy * k; sz -= dz * k; }
    }
    if (b.perch) {
      const pc = b.perch;
      if (clock > pc.until) { delete b.perch; b.scare = clock + 3; }
      else {
        const k = Math.min(1, dt * 0.6);
        b.p[0] += (pc.x - b.p[0]) * k; b.p[1] += (pc.y - b.p[1]) * k; b.p[2] += (pc.z - b.p[2]) * k;
        b.v = [(pc.x - b.p[0]) * 0.5 + 0.01, (pc.y - b.p[1]) * 0.5, (pc.z - b.p[2]) * 0.5 + 0.01];
        b.ph += dt * 0.7;
        continue;
      }
    }
    // they shy away from the drone, and scatter fast when startled
    const cdx = b.p[0] - st.x, cdy = b.p[1] - st.y, cdz = b.p[2] - st.z, cd = Math.hypot(cdx, cdy, cdz);
    const scared = (cd < 45 && !b.perch) || (b.scare || 0) > clock;
    const goal = flockGoal(b.g);
    const fy = flockFloor(b.p[0], b.p[2]);
    const gy = fy + 45 + 30 * Math.sin(flockT * 0.11 + b.g);
    let fx = (goal[0] - b.p[0]) * 0.004, fyy = (gy - b.p[1]) * 0.03, fz = (goal[2] - b.p[2]) * 0.004;
    if (nn) { fx += cx / nn * 0.012 + (ax / nn - b.v[0]) * 0.05; fyy += cy / nn * 0.012 + (ay / nn - b.v[1]) * 0.05; fz += cz / nn * 0.012 + (az / nn - b.v[2]) * 0.05; }
    fx += sx * 6; fyy += sy * 6; fz += sz * 6;
    if (cd < 45) { const k = (45 - cd) / 45 / Math.max(cd, 1) * 4; fx += cdx * k; fyy += cdy * k + 0.6; fz += cdz * k; }
    if ((b.scare || 0) > clock) fyy += 1.2;
    if (b.p[1] < fy) fyy += (fy - b.p[1]) * 0.2;
    b.v[0] += fx * dt * 8; b.v[1] += fyy * dt * 8; b.v[2] += fz * dt * 8;
    const sp = Math.hypot(b.v[0], b.v[1], b.v[2]), want = clampv(sp, 5, scared ? 24 : 13);
    if (sp > 1e-3) { b.v = b.v.map((v) => v / sp * want); b.v[1] = clampv(b.v[1], -3, scared ? 9 : 3); }
    b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt;
    // the slower the wingbeat the more gliding; stragglers far from the camera rejoin near it
    b.ph += dt * (1.1 + 0.08 * want) * (3.2 / b.s + 0.5);
    if (Math.hypot(b.p[0] - st.x, b.p[2] - st.z) > 650) spawnBoid(b, b.g);
  }
  FLOCK_DATA[0] = FLOCK_N;
  // one bounding sphere per flock (creatures are stored flock by flock)
  for (let g = 0; g < 4; g++) {
    const m = flock.filter((b) => b.g === g);
    const c = [0, 0, 0];
    for (const b of m) { c[0] += b.p[0] / m.length; c[1] += b.p[1] / m.length; c[2] += b.p[2] / m.length; }
    let r = 0;
    for (const b of m) r = Math.max(r, Math.hypot(b.p[0] - c[0], b.p[1] - c[1], b.p[2] - c[2]) + b.s * 1.3);
    FLOCK_DATA.set([c[0], c[1], c[2], r], 4 + g * 4);
  }
  flock.forEach((b, i) => {
    const sp = Math.hypot(b.v[0], b.v[1], b.v[2]) || 1;
    FLOCK_DATA.set([b.p[0], b.p[1], b.p[2], b.s, b.v[0] / sp, b.v[1] / sp, b.v[2] / sp, b.ph], 20 + i * 8);
  });
}
// what the sound engine hears about the world, refreshed twice a second: how busy it is, and where the sources are
const AUW = { mode: "surface", alt: 0, people: 0, tubes: 0, flierDist: 1e9, story: 0, tod: 0, snow: 0, speed: 0, places: {} };
let auT = 0;
// depth of field: what the lens is focused on. The story's scene when a person or clue of it is near the middle of
// the view, else 0, which tells the composite pass to focus on whatever is at the centre.
const FOCUS = { d: 0, s: 0, on: true };
try { FOCUS.on = localStorage.getItem("drift.focus") !== "0"; } catch (e) {}
function focusTarget(pos, f) {
  if (!TALE.on || !TALE.props || !TALE.props.length) return 0;
  let best = 0.8, bd = 0;
  for (const p of TALE.props) {
    const v = [p.x - pos[0], p.y + 1 - pos[1], p.z - pos[2]], l = Math.hypot(v[0], v[1], v[2]);
    if (l < 0.5 || l > 80) continue;
    const c = (v[0] * f[0] + v[1] * f[1] + v[2] * f[2]) / l;
    if (c > best) { best = c; bd = l; }
  }
  return bd;
}
function audioWorld(dt) {
  AUW.speed = NAV.mode === "surface" ? Math.hypot(st.vx, st.vz) * (st.speedMul || 1) : NAV.mode === "free" ? 60 : 0;
  auT -= dt;
  if (auT > 0) return AUW;
  auT = 0.5;
  AUW.mode = NAV.mode;
  if (NAV.cam && (NAV.mode === "space" || NAV.mode === "trip" || NAV.mode === "free") && NAV.spaceMix > 0.5) AUW.alt = (len3(NAV.cam.P) - TR) * 1000;
  else AUW.alt = st.y - Math.max(terrSurfAt(st.x, st.z), 0);
  const P = { sidewalks: [], busy: [], persons: [], tubeLines: [], flocks: [], lamps: [], radios: [] };
  let city = 0, busy = 0;
  const cx0 = Math.floor(st.x / C), cz0 = Math.floor(st.z / C);
  const nearest = (key, pos) => { const d = Math.hypot(pos[0] - st.x, pos[2] - st.z); if (!P[key] || d < P[key + "D"]) { P[key] = pos; P[key + "D"] = d; } };
  if (AUW.alt < 600 && NAV.spaceMix < 0.5) {
    for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) {
      const cx = cx0 + i, cz = cz0 + j, o = cellAt(cx, cz);
      if (o.wild) continue;
      const mx = (cx + 0.5) * C, mz = (cz + 0.5) * C;
      const near = Math.abs(i) <= 2 && Math.abs(j) <= 2;
      if (o.typ <= 3 || (o.typ >= 8 && o.typ <= 11) || o.typ === 13) {
        if (near) {
          city++;
          const side = hsh(cx, cz, 951) < 0.5 ? -1 : 1, sp = [mx + side * 10.3, 0.8, mz + (hsh(cx, cz, 952) - 0.5) * 18];
          P.sidewalks.push(sp);
          if (o.fl & 1024) { busy++; P.busy.push([sp[0], 1.6, sp[2]]); }
          if (hsh(cx, cz, 950) < 0.1 && P.radios.length < 2) P.radios.push([mx, 5 + hsh(cx, cz, 953) * 12, mz]);
          // the skaters' cables (the same test as pedPulley in the scene shader): the nearest point on each ring
          for (let ln = 0; ln < 2; ln++) if (hsh(cx * 11 + ln, cz * 5, 183) < 0.22) {
            const R = ln ? 10.45 : 9.95, lx = st.x - mx, lz = st.z - mz;
            const q = Math.abs(lx) >= Math.abs(lz) ? [Math.sign(lx) * R, clampv(lz, -R, R)] : [clampv(lx, -R, R), Math.sign(lz) * R];
            nearest("cable", [mx + q[0], 4.4, mz + q[1]]);
          }
        }
        if (o.zone === 6 && o.typ === 1) nearest("dorm", [mx, 14, mz]);
        if (o.fl & 8) nearest("wheel", [mx, 30, mz]);
        if (o.fl & 16) nearest("market", [mx, 3, mz]);
        if (o.typ === 11 && (o.fl & 3) === 1) nearest("pagoda", [mx, 16, mz]);
      }
      if (o.typ === 9) nearest("industry", [mx, 8, mz]);
      if (o.typ === 10) nearest("spaceport", [mx, 5, mz]);
    }
    // the tubes overhead: the nearest street line in each direction, if it borders the city
    if (city > 3) {
      const kx = Math.round(st.x / C), kz = Math.round(st.z / C);
      P.tubeLines.push([kx * C, 11, st.z, 0, 1], [st.x, 11, kz * C, 1, 0]);
    }
    // the nearest liquid: a methane shore, or a river running above the datum
    outer: for (const r of [12, 35, 80, 160]) for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, x = st.x + Math.cos(a) * r, z = st.z + Math.sin(a) * r, t = terrainAt(x, z);
      if (t[1] > t[0] + 0.3) { if (t[1] > 0.5) P.river = [x, t[1], z]; else P.water = [x, t[1], z]; break outer; }
    }
    if (cellAt(cx0, cz0).wild && todIdx >= 2) P.cold = [st.x + 70 * Math.cos(clock * 0.1), st.y - 5, st.z + 70 * Math.sin(clock * 0.1)];
  }
  AUW.people = Math.min(1, city / 25 * 0.5 + busy / 25 * 0.9 + (city ? DIR.rush * 0.5 : 0));
  AUW.tubes = Math.min(1, city / 18);
  // flocks, nearest first
  if (FLOCKS_ON && flock.length) {
    for (let g = 0; g < 4; g++) P.flocks.push([FLOCK_DATA[4 + g * 4], FLOCK_DATA[5 + g * 4], FLOCK_DATA[6 + g * 4]]);
    P.flocks.sort((a, b) => Math.hypot(a[0] - st.x, a[1] - st.y, a[2] - st.z) - Math.hypot(b[0] - st.x, b[1] - st.y, b[2] - st.z));
    let fd = 1e9;
    for (const b of flock) { const d = Math.hypot(b.p[0] - st.x, b.p[1] - st.y, b.p[2] - st.z); if (d < fd) fd = d; }
    AUW.flierDist = fd;
  } else AUW.flierDist = 1e9;
  // the story's scene: people talking, lit lamps, and the radios on the stall, in the pagoda and on the ferry
  let n = 0;
  if (TALE.on) for (const p of TALE.props || []) {
    if (p.kind === 0 && Math.hypot(p.x - st.x, p.z - st.z) < 30) { n++; P.persons.push([p.x, p.y + 1.55, p.z]); }
    if (p.kind === 4 && p.param > 0.5) P.lamps.push([p.x, p.y + 3.6, p.z]);
    if (p.kind === 1) { P.lamps.push([p.x, p.y + 1.3, p.z]); P.radios.unshift([p.x, p.y + 1.2, p.z, 0]); }
    if (p.kind === 3) P.radios.unshift([p.x, p.y + 1.2, p.z, 2]);
    if (p.kind === 5) P.radios.unshift([p.x, p.y + 2, p.z, 3]);
  }
  AUW.story = Math.min(1, n * 0.35);
  AUW.tod = todIdx;
  AUW.snow = todIdx === 3 || (WX.forced > 0) || DIR.squall > 0 ? Math.min(1, WX.rain * 1.3) : 0;
  if (DIR.radio) P.radios.unshift(DIR.radio);
  AUW.places = P;
  return AUW;
}
// props in the world: the story's scene, the events director's, and your own drone when the view follows it
let FOLLOW = false;
try { FOLLOW = localStorage.getItem("drift.follow") === "1"; } catch (e) {}
function worldProps() {
  const list = [];
  if (TALE.story && TALE.on) for (const p of TALE.props || []) list.push(p);
  for (const p of DIR.props) list.push(p);
  if (FOLLOW && NAV.spaceMix < 0.01) list.push({ kind: 9, x: st.x, y: st.y - 0.45 + 0.04 * Math.sin(clock * 2.3), z: st.z, rot: Math.PI / 2 - st.yaw, scale: 1, hue: 0, param: 0 });
  const n = Math.min(32, list.length);
  PROP_DATA[0] = n;
  for (let i = 0; i < n; i++) { const p = list[i]; PROP_DATA.set([p.x, p.y, p.z, p.kind, p.rot, p.scale, p.hue, p.param], 4 + i * 8); }
  return PROP_DATA;
}
// ---------- the events director: something happens near you now and then, at an uneven rhythm ----------
const DIR = { next: 18, kind: null, t0: 0, len: 0, pos: null, squall: 0, rush: 0, fog: 0, props: [], radio: null, lanterns: null };
function dirAhead(dmin, dmax) {
  const cv = cameraVectors(), d = dmin + Math.random() * (dmax - dmin), s = (Math.random() - 0.5) * 0.9;
  const fx = cv.f[0], fz = cv.f[2], l = Math.hypot(fx, fz) || 1;
  const x = st.x + (fx / l) * d - (fz / l) * s * d, z = st.z + (fz / l) * d + (fx / l) * s * d;
  return [x, Math.max(terrSurfAt(x, z), 0), z];
}
function directorStep(dt) {
  DIR.squall = Math.max(0, DIR.squall - dt / 25);
  DIR.fog = Math.max(0, DIR.fog - dt / 35);
  // sky lanterns drift up and away
  if (DIR.lanterns) {
    const a = clock - DIR.lanterns.t0;
    DIR.props = DIR.lanterns.list.map((l) => ({ kind: 8, x: l.x + Math.sin(a * 0.3 + l.ph) * 2 + a * 0.6, y: l.y + a * l.v, z: l.z + Math.cos(a * 0.25 + l.ph) * 2, rot: a * 0.4, scale: 1.8, hue: l.hue, param: 0 }));
    if (a > 45) { DIR.lanterns = null; DIR.props = []; }
  }
  DIR.rush = Math.max(0, DIR.rush - dt / 20);
  // a power cut in progress: failing with a flicker, dark, then flickering back
  if (DIR.kind === "blackout") {
    const a = clock - DIR.t0, L = DIR.len;
    const v = a < 2.5 ? (Math.random() < 0.45 ? 0.9 : 0.15) : a < L ? 0.9 : a < L + 2.5 ? (Math.random() < 0.5 ? 0.9 : 0.1) : 0;
    EVN.set([DIR.pos[0], DIR.pos[2], 120, v], 136);
    if (a > L + 2.5) { DIR.kind = null; EVN[139] = 0; }
  } else if (DIR.kind && clock - DIR.t0 > DIR.len) {
    if (DIR.kind === "busker") { DIR.props = []; DIR.radio = null; }
    DIR.kind = null;
  }
  const ok = !INTRO.on && (NAV.mode === "surface" || NAV.mode === "visit") && REG.city && AUW.alt < 300;
  if (!ok) return;
  DIR.next -= dt;
  if (DIR.next > 0 || DIR.kind) return;
  DIR.next = 20 + Math.random() * 55;
  const night = todIdx >= 1;
  const opts = [["steam", 3], ["siren", 2], ["rush", 1.6], ["startle", 2], ["squall", 1.1], ["blackout", night ? 2.2 : 0.3], ["busker", 2], ["lanterns", night ? 1.6 : 0.4], ["fog", 1.2], ["perch", 1.5]];
  let r = Math.random() * opts.reduce((a, o) => a + o[1], 0), kind = opts[0][0];
  for (const o of opts) { r -= o[1]; if (r <= 0) { kind = o[0]; break; } }
  DIR.kind = kind; DIR.t0 = clock;
  if (kind === "steam") { DIR.pos = dirAhead(25, 70); DIR.len = 30; EVN.set([DIR.pos[0], DIR.pos[1], DIR.pos[2], clock], 140); audioSteam(DIR.pos); }
  else if (kind === "siren") {
    DIR.len = 9;
    const kx = Math.round(st.x / C) * C, s = Math.random() < 0.5 ? -1 : 1;
    audioSiren([kx, 11, st.z - s * 180], [kx, 11, st.z + s * 180], 9);
  } else if (kind === "rush") { DIR.len = 20; DIR.rush = 1; audioRush(dirAhead(15, 40)); }
  else if (kind === "startle") {
    DIR.len = 6;
    let best = null, bd = 1e9;
    for (let g = 0; g < 4; g++) { const d = Math.hypot(FLOCK_DATA[4 + g * 4] - st.x, FLOCK_DATA[6 + g * 4] - st.z); if (d < bd) { bd = d; best = g; } }
    if (best !== null) { for (const b of flock) if (b.g === best) { b.scare = clock + 6; b.v = [b.v[0] + (Math.random() - 0.5) * 10, 6 + Math.random() * 5, b.v[2] + (Math.random() - 0.5) * 10]; } audioFlurry([FLOCK_DATA[4 + best * 4], FLOCK_DATA[5 + best * 4], FLOCK_DATA[6 + best * 4]]); }
  } else if (kind === "squall") { DIR.len = 25; DIR.squall = 1; }
  else if (kind === "fog") { DIR.len = 35; DIR.fog = 1; }
  else if (kind === "busker") {
    // a busker with a lamp, and a small crowd gathered round, all turned to face the music
    DIR.len = 50;
    const b = dirAhead(10, 22), face = (x, z) => Math.PI / 2 - Math.atan2(b[2] - z, b[0] - x);
    DIR.props = [{ kind: 0, x: b[0], y: b[1], z: b[2], rot: Math.PI / 2 - Math.atan2(st.z - b[2], st.x - b[0]), scale: 1, hue: Math.random(), param: 0.9 },
      { kind: 4, x: b[0] + 1.2, y: b[1], z: b[2] + 0.5, rot: 0, scale: 0.8, hue: 0, param: 1 }];
    const n = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 1.6 + Math.PI * 0.2 + Math.atan2(st.z - b[2], st.x - b[0]), rr2 = 3 + Math.random() * 1.5, x = b[0] + Math.cos(a) * rr2, z = b[2] + Math.sin(a) * rr2; DIR.props.push({ kind: 0, x, y: b[1], z, rot: face(x, z), scale: 0.95 + Math.random() * 0.1, hue: Math.random(), param: Math.random() }); }
    DIR.radio = [b[0], b[1] + 1.4, b[2], 3];
  } else if (kind === "lanterns") {
    // somebody releases sky lanterns: a dozen small lights drifting up into the snow
    DIR.len = 45;
    const b = dirAhead(20, 45);
    DIR.lanterns = { t0: clock, list: Array.from({ length: 12 }, () => ({ x: b[0] + (Math.random() - 0.5) * 12, y: b[1] + 1 + Math.random() * 2, z: b[2] + (Math.random() - 0.5) * 12, v: 1.2 + Math.random() * 1.2, ph: Math.random() * 6, hue: 0.05 + Math.random() * 0.06 })) };
    audioLanterns(b);
  } else if (kind === "perch") {
    // a flier comes down to settle near you for a while
    DIR.len = 22;
    let best = null, bd = 1e9;
    for (const b of flock) { const d = Math.hypot(b.p[0] - st.x, b.p[2] - st.z); if (d < bd) { bd = d; best = b; } }
    if (best) { const p = dirAhead(7, 12); best.perch = { x: p[0], y: Math.max(p[1] + 3.5, st.y - 1), z: p[2], until: clock + 18 }; }
  }
  else { DIR.pos = dirAhead(90, 220); DIR.len = 12 + Math.random() * 13; audioThunk(DIR.pos); }
}
let wheelAcc = 0;
const touches = new Map();
let pinchD = 0;
let climbBtn = 0;
// the on-screen gamepad, laid out like a drone's ("mode 2"): left stick up/down climbs and descends, left/right turns;
// right stick up/down speeds up or slows, left/right slides sideways. All axes: -1..1, up and right positive.
const PAD = { lx: 0, ly: 0, rx: 0, ry: 0, on: false };
function padShow(on) {
  PAD.on = on;
  const p = document.getElementById("pad");
  if (p) p.hidden = !on;
  try { localStorage.setItem("drift.pad", on ? "1" : "0"); } catch (e) {}
}
function padWire() {
  for (const [id, axis] of [["stickL", "L"], ["stickR", "R"]]) {
    const s = document.getElementById(id);
    if (!s || !s.addEventListener) continue;
    const knob = s.querySelector ? s.querySelector(".knob") : null;
    let pid = null;
    const set = (e) => {
      const r = s.getBoundingClientRect(), R = r.width * 0.42;
      let x = (e.clientX - (r.left + r.width / 2)) / R, y = (e.clientY - (r.top + r.height / 2)) / R;
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      if (knob) knob.style.transform = "translate(" + (x * R) + "px," + (y * R) + "px)";
      const dz = (v) => Math.sign(v) * Math.max(0, Math.abs(v) - 0.12) / 0.88;
      if (axis === "L") { PAD.lx = dz(x); PAD.ly = -dz(y); } else { PAD.rx = dz(x); PAD.ry = -dz(y); }
      lastInput = clock; lastUiTouch = clock;
    };
    const end = () => { pid = null; s.classList.remove("active"); if (knob) knob.style.transform = ""; if (axis === "L") { PAD.lx = 0; PAD.ly = 0; } else { PAD.rx = 0; PAD.ry = 0; } };
    s.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); pid = e.pointerId; s.setPointerCapture && s.setPointerCapture(pid); s.classList.add("active"); set(e); });
    s.addEventListener("pointermove", (e) => { if (e.pointerId === pid) set(e); });
    s.addEventListener("pointerup", end); s.addEventListener("pointercancel", end); s.addEventListener("lostpointercapture", end);
  }
  let saved = null;
  try { saved = localStorage.getItem("drift.pad"); } catch (e) {}
  padShow(saved === "1");
}
function climbInput() {
  let c = climbBtn + PAD.ly;
  if (keys.has("e") || keys.has(" ")) c += 1;
  if (keys.has("q") || keys.has("shift")) c -= 1;
  return clampv(c, -1, 1);
}
function spaceInput(dt) {
  const inp = { dx: PAD.lx + PAD.rx * 0.6, dy: -PAD.ry * 0.8, zoom: 0, climb: climbInput() };
  // in a story place both sticks just look around
  if (NAV.mode === "visit") { inp.dx = PAD.lx + PAD.rx; inp.dy = -(PAD.ly + PAD.ry) * 0.8; inp.climb = 0; }
  if (inp.climb !== 0) lastInput = clock;
  if (NAV.mode !== "space" && NAV.mode !== "free" && NAV.mode !== "visit") { wheelAcc = 0; return inp; }
  const md = Math.min(innerWidth, innerHeight);
  if (pointer.down && touches.size < 2) { inp.dx = clampv((pointer.x - pointer.sx) / (md * 0.3), -1, 1); inp.dy = clampv((pointer.y - pointer.sy) / (md * 0.3), -1, 1); }
  if (keys.has("arrowleft") || keys.has("a")) inp.dx -= 1;
  if (keys.has("arrowright") || keys.has("d")) inp.dx += 1;
  if (keys.has("arrowup")) inp.dy -= 1;
  if (keys.has("arrowdown")) inp.dy += 1;
  if (NAV.mode === "space") {
    if (keys.has("w")) inp.zoom -= 1;
    if (keys.has("s")) inp.zoom += 1;
    inp.zoom -= inp.climb;
  }
  inp.zoom += wheelAcc;
  wheelAcc *= Math.exp(-dt * 6);
  if (inp.dx || inp.dy || inp.zoom > 0.05 || inp.zoom < -0.05) lastInput = clock;
  return inp;
}
addEventListener("wheel", (e) => { if (NAV.mode === "space") { wheelAcc = clampv(wheelAcc + e.deltaY * 0.004, -3, 3); e.preventDefault(); } }, { passive: false });
// The world repeats every LW metres, so shifting the camera and everything tied to it by LW changes nothing
// on screen; it keeps coordinates small for the GPU's 32-bit floats on long flights.
let worldShift = null;
function recentre() {
  const dx = Math.abs(st.x) > LW * 0.75 ? -Math.sign(st.x) * LW : 0, dz = Math.abs(st.z) > LW * 0.75 ? -Math.sign(st.z) * LW : 0;
  if (!dx && !dz) return;
  st.x += dx; st.z += dz;
  REG.ox -= dx; REG.oz -= dz; REG.cx += dx; REG.cz += dz;
  for (const b of flock) { b.p[0] += dx; b.p[2] += dz; }
  koiAnchor[0] += dx; koiAnchor[1] += dz;
  if (st.tour) { st.tour.x += dx; st.tour.z += dz; }
  EX.fw = null; EX.launch = null; EX.sc = null; EX.pads = []; EX.lhs = [];
  worldShift = [dx, dz];
}
function update(dt) {
  let kx = 0, ky = 0;
  if (keys.has("a") || keys.has("arrowleft")) kx -= 1;
  if (keys.has("d") || keys.has("arrowright")) kx += 1;
  ky += climbBtn + PAD.ly;
  kx += PAD.lx;
  // right stick forward flies faster, back slower
  if (Math.abs(PAD.ry) > 0.05) st.speedMul = clampv(st.speedMul + PAD.ry * dt * 1.2, 0.2, 3);
  if (keys.has("e") || keys.has(" ")) ky += 1;
  if (keys.has("q") || keys.has("shift")) ky -= 1;
  if (keys.has("w") || keys.has("arrowup")) st.speedMul = Math.min(3, st.speedMul + dt * 0.8);
  if (keys.has("s") || keys.has("arrowdown")) st.speedMul = Math.max(0.25, st.speedMul - dt * 0.8);
  const minDim = Math.min(innerWidth, innerHeight);
  let sx = 0, sy = 0;
  if (pointer.down) {
    sx = clampv((pointer.x - pointer.sx) / (minDim * 0.3), -1, 1);
    sy = clampv((pointer.y - pointer.sy) / (minDim * 0.3), -1, 1);
  } else if (pointer.type === "mouse" && clock - pointer.hoverT < 2.5) {
    const hx0 = (pointer.hoverX / innerWidth) * 2 - 1, hy0 = (pointer.hoverY / innerHeight) * 2 - 1;
    const dz = (v) => Math.sign(v) * Math.max(0, Math.abs(v) - 0.2) / 0.8;
    const fade = 1 - sstep(1.5, 2.5, clock - pointer.hoverT);
    sx = dz(hx0) * 0.4 * fade; sy = dz(hy0) * 0.4 * fade;
  }
  const ux = clampv(kx + sx, -1, 1);
  const uy = clampv(ky - sy, -1, 1);
  if (kx !== 0 || ky !== 0 || pointer.down || PAD.ly !== 0 || PAD.rx !== 0 || PAD.ry !== 0) lastInput = clock;
  const auto = sstep(1.5, 4.5, clock - lastInput);
  if (auto < 0.3) st.realign = true;

  st.modeT -= dt;
  if (st.forced === null && st.modeT <= 0) {
    st.mode = st.mode === "high" ? "low" : "high";
    st.modeT = st.mode === "high" ? 30 + 15 * Math.random() : 26 + 12 * Math.random();
    st.realign = true;
  }
  if (st.forced) st.mode = st.forced;
  const hereCell = cellAt(Math.floor(st.x / C), Math.floor(st.z / C));
  const wildHere = hereCell.wild || cityDist(st.x, st.z) > cityR(st.x, st.z) - 150;
  if (wildHere || (st.tour && st.tour.out && st.forced === null)) st.mode = "high";
  let low = st.mode === "low";
  // tours: every few minutes head for a new destination, alternating between the city and the land around it
  if (!st.tour || clock > st.tour.until || Math.hypot(wrapPJ(st.tour.x - st.x), wrapPJ(st.tour.z - st.z)) < 350) {
    const out = !st.tour ? false : !st.tour.out;
    const a = Math.random() * 6.283;
    const r = out ? cityR(Math.cos(a) * 6000, Math.sin(a) * 6000) + 900 + Math.random() * 2600 : Math.random() * 3500;
    st.tour = { x: Math.cos(a) * r, z: Math.sin(a) * r, out, until: clock + (out ? 480 : 240) };
  }

  // Perlin wind: slow direction drift, gusts, and fine turbulence
  const wAng = 0.8 + 2.2 * fbm1(clock * 0.006, 91);
  const gust = 1 + 0.9 * Math.max(0, fbm1(clock * 0.11, 92)) + 0.25 * fbm1(clock * 0.45, 93);
  const wsp = Math.max(0.5, (3.5 + 2.5 * fbm1(clock * 0.017, 90)) * gust);
  wind.x = Math.cos(wAng) * wsp; wind.z = Math.sin(wAng) * wsp; wind.gust = gust;
  wind.cx += wind.x * dt * 3; wind.cz += wind.z * dt * 3;

  let hx = Math.cos(st.yaw), hz = Math.sin(st.yaw);
  let yawCmd = 0, tSpeed = 22, targetY = 52, aLatX = 0, aLatZ = 0, turning = 0;
  if (low) {
    if (st.realign && auto > 0.5) { st.axisYaw = Math.round(st.yaw / (Math.PI / 2)) * (Math.PI / 2); st.realign = false; st.turnDir = 0; st.planKey = ""; }
    const ax = Math.round(Math.cos(st.axisYaw)), az = Math.round(Math.sin(st.axisYaw));
    const rx = -az, rz = ax;
    const lineX = Math.round(st.x / C) * C, lineZ = Math.round(st.z / C) * C;
    const lat = ax !== 0 ? (st.z - lineZ) * rz : (st.x - lineX) * rx;
    const vLat = st.vx * rx + st.vz * rz;
    const along = st.x * ax + st.z * az;
    const dNext = (Math.floor(along / C) + 1) * C - along;
    const key = Math.round((st.x + ax * dNext) / C) + "," + Math.round((st.z + az * dNext) / C);
    if (dNext < 28 && key !== st.planKey && Math.abs(lat) < 2.5) {
      st.planKey = key;
      st.turnDir = (giantAheadOnLine(ax, az) || Math.random() < 0.3) ? (Math.random() < 0.5 ? 1 : -1) : 0;
    }
    tSpeed = 11;
    if (st.turnDir !== 0 && key === st.planKey) {
      tSpeed = Math.min(11, 1.6 + Math.max(0, dNext - 1) * 0.42);
      if (dNext < 1.2) { st.axisYaw += st.turnDir * Math.PI / 2; st.turnDir = 0; }
    }
    const desiredYaw = st.axisYaw - clampv(lat * 0.05, -0.25, 0.25);
    const dd = angDiff(desiredYaw, st.yaw);
    turning = Math.min(1, Math.abs(dd) / 0.9);
    yawCmd = clampv(dd * 1.5, -0.8, 0.8);
    tSpeed *= 1 - 0.8 * turning;
    const aL = clampv(-lat * 0.9 - vLat * 1.7, -3, 3) * auto;
    aLatX = rx * aL; aLatZ = rz * aL;
    targetY = 8.5;
    if (giantAheadOnLine(ax, az) && dNext > 6 && st.forced === null) {
      const bx = Math.floor(st.x / BIG), bz = Math.floor(st.z / BIG);
      if (Math.hypot((bx + 0.5) * BIG - st.x, (bz + 0.5) * BIG - st.z) < 75) { st.mode = "high"; st.modeT = 25; low = false; }
    }
  }
  if (!low) {
    yawCmd = 0.08 * Math.sin(clock * 0.037) + 0.05 * Math.sin(clock * 0.011 + 2);
    let tourYaw = st.tour ? clampv(angDiff(Math.atan2(wrapPJ(st.tour.z - st.z), wrapPJ(st.tour.x - st.x)), st.yaw) * 0.3, -0.18, 0.18) : 0;
    const bx0 = Math.floor(st.x / BIG), bz0 = Math.floor(st.z / BIG);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const bx = bx0 + i, bz = bz0 + j;
      if (!giantHas(bx, bz)) continue;
      const gx = (bx + 0.5) * BIG - st.x, gz = (bz + 0.5) * BIG - st.z;
      const dist = Math.hypot(gx, gz);
      if (dist > 260 || st.y > giantH(bx, bz) + 10) continue;
      const ahead = gx * hx + gz * hz, lat = -gx * hz + gz * hx;
      if (ahead > -30 && Math.abs(lat) < 110) { yawCmd += -(lat >= 0 ? 1 : -1) * (1 - dist / 260) * 0.6; tourYaw *= 0.2; }
    }
    const probe = (ang) => {
      const c = Math.cos(st.yaw + ang), sn = Math.sin(st.yaw + ang);
      let m = 0;
      for (let d = 20; d <= 110; d += 9) m = Math.max(m, heightAt(st.x + c * d, st.z + sn * d, st.y));
      return m;
    };
    const cruise = 52 + 22 * Math.sin(clock * 0.05) + st.altBias;
    const obC = probe(0);
    if (obC + 10 > cruise && obC + 10 > st.y) {
      const blocked = Math.min(1, (obC + 10 - Math.max(cruise, st.y)) / 30);
      yawCmd += (probe(-0.4) < probe(0.4) ? -1 : 1) * 0.45 * blocked;
      tourYaw *= 1 - blocked;
    }
    yawCmd += tourYaw;
    tSpeed = 22;
    targetY = 52 + 22 * Math.sin(clock * 0.05);
    if (st.tour && st.tour.out) tSpeed = 28;
    // keep off the walls of nearby buildings that rise above the drone, and climb over them when close
    const cxh = Math.floor(st.x / C), czh = Math.floor(st.z / C);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const c = cellAt(cxh + i, czh + j);
      if (c.wild || c.top < st.y - 3 || c.typ === 0 || c.typ === 5 || c.typ === 6) continue;
      const box = c.typ === 1 || c.typ === 2;
      const bx = (cxh + i + 0.5) * C + (box ? c.offx : 0), bz = (czh + j + 0.5) * C + (box ? c.offz : 0);
      const ex = box ? c.wx + 0.6 : 9.8, ez = box ? c.wz + 0.6 : 9.8;
      const dx = st.x - bx, dz = st.z - bz, qx = Math.abs(dx) - ex, qz = Math.abs(dz) - ez;
      const inside = qx < 0 && qz < 0;
      const out = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
      const dist = inside ? Math.max(qx, qz) : out;
      if (dist > 7) continue;
      let nx, nz;
      if (inside) { nx = qx > qz ? Math.sign(dx) : 0; nz = qx > qz ? 0 : Math.sign(dz); }
      else { nx = Math.max(qx, 0) * Math.sign(dx) / (out || 1); nz = Math.max(qz, 0) * Math.sign(dz) / (out || 1); }
      const k = (7 - dist) * 1.4;
      aLatX += nx * k; aLatZ += nz * k;
      if (dist < 3.5) targetY = Math.max(targetY, c.top + 8);
    }
    if (wildHere) {
      // over the wild land: faster, following the ground at 60 to 120 m
      let g = 0;
      for (let d = 0; d <= 240; d += 40) g = Math.max(g, terrSurfAt(st.x + hx * d, st.z + hz * d));
      targetY = Math.max(0, g) + 90 + 30 * Math.sin(clock * 0.04);
      tSpeed = 30;
    }
  }
  yawCmd = clampv(yawCmd * auto + ux * 0.8, -1, 1);
  tSpeed *= st.speedMul;

  const spd = Math.hypot(st.vx, st.vz);
  const look = low ? 36 : Math.max(60, spd * 6);
  const sdx = low ? Math.cos(st.axisYaw) : hx, sdz = low ? Math.sin(st.axisYaw) : hz;
  const lats = low ? [-1, 0, 1] : [-5, 0, 5];
  let obst = 0;
  for (let d = 0; d <= look; d += 4) for (const l of lats) obst = Math.max(obst, heightAt(st.x + sdx * d - sdz * l, st.z + sdz * d + sdx * l, st.y));
  if (spd > 1) for (let d = 2; d <= 12; d += 2) obst = Math.max(obst, heightAt(st.x + st.vx / spd * d, st.z + st.vz / spd * d, st.y));
  st.dbgObst = obst;
  const floorAlt = Math.max(3, obst + (low ? 3.5 : 10));
  if (auto > 0.5) st.altBias *= 1 - 0.12 * dt;
  st.altBias = clampv(st.altBias + uy * 22 * dt, -80, 260);
  targetY = Math.max(targetY + st.altBias, floorAlt);
  if (floorAlt - st.y > 15) tSpeed *= clampv(1 - (floorAlt - st.y) / 100, 0.3, 1);

  // yaw with angular inertia
  const yawAccMax = low ? 1.4 : 0.6;
  st.yawVel += clampv((yawCmd - st.yawVel) * 2.2, -yawAccMax, yawAccMax) * dt;
  st.yaw += (st.yawVel + fbm1(clock * 0.35, 97) * 0.03 * gust * (low ? 0.3 : 1)) * dt;
  hx = Math.cos(st.yaw); hz = Math.sin(st.yaw);

  // horizontal motion with mass: limited thrust, wind drag and gust turbulence
  let ax_ = (hx * tSpeed - st.vx) * 0.9, az_ = (hz * tSpeed - st.vz) * 0.9;
  const am = Math.hypot(ax_, az_);
  if (am > 4.5) { ax_ *= 4.5 / am; az_ *= 4.5 / am; }
  const turb = (low ? 0.35 : 1) * gust;
  ax_ += aLatX + (wind.x - st.vx) * 0.05 + fbm1(clock * 0.5, 94) * 0.9 * turb;
  az_ += aLatZ + (wind.z - st.vz) * 0.05 + fbm1(clock * 0.5, 104) * 0.9 * turb;
  st.vx += ax_ * dt; st.vz += az_ * dt;

  const vyDes = clampv((targetY - st.y) * 0.7, -7, 14);
  const urgent = floorAlt - st.y > 4;
  const ay = clampv((vyDes - st.vy) * 1.8, -4, urgent ? 12 : 6) + fbm1(clock * 0.6, 98) * 0.7 * turb;
  st.vy += ay * dt;
  st.x += st.vx * dt; st.y += st.vy * dt; st.z += st.vz * dt;
  // right stick left/right slides sideways
  if (PAD.rx) { st.x += -Math.sin(st.yaw) * PAD.rx * 14 * dt; st.z += Math.cos(st.yaw) * PAD.rx * 14 * dt; }
  const here = heightAt(st.x, st.z, st.y) + 2;
  if (st.y < here) { st.y += (here - st.y) * Math.min(1, dt * 8); st.vy = Math.max(st.vy, 0); }

  // camera attitude: nose dips when accelerating, banks into turns, small gust wobble
  const spd2 = Math.max(4, Math.hypot(st.vx, st.vz));
  const lp = Math.min(1, dt * 2.5);
  st.aF += (ax_ * hx + az_ * hz - st.aF) * lp;
  st.aL += (ax_ * -hz + az_ * hx - st.aL) * lp;
  st.vyS += (st.vy - st.vyS) * lp;
  const pitchT = Math.atan2(st.vyS, spd2) * 0.45 - st.aF / 9.81 * 0.25 + (low ? 0.03 : -0.13) + uy * 0.12 + fbm1(clock * 0.8, 96) * 0.008 * gust;
  const rollT = clampv(st.aL / 9.81 * 1.1, -0.35, 0.35) + fbm1(clock * 0.7, 99) * 0.012 * gust;
  // critically damped springs: the view eases in and out instead of snapping
  const wp = 2.0, wr = 2.4;
  st.pv += (wp * wp * (pitchT - st.pitch) - 2 * wp * st.pv) * dt; st.pitch += st.pv * dt;
  st.rv += (wr * wr * (rollT - st.roll) - 2 * wr * st.rv) * dt; st.roll += st.rv * dt;

  todT = Math.min(1, todT + dt / 5);
  todAuto += dt;
  if (todAuto > 110) nextTod();
}

function cameraVectors() {
  const cp = Math.cos(st.pitch);
  const f = [Math.cos(st.yaw) * cp, Math.sin(st.pitch), Math.sin(st.yaw) * cp];
  const r = norm3([-f[2], 0, f[0]]);
  const up = norm3([r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]);
  const c = Math.cos(st.roll), s = Math.sin(st.roll);
  return { f, r: [r[0] * c - up[0] * s, r[1] * c - up[1] * s, r[2] * c - up[2] * s], up: [up[0] * c + r[0] * s, up[1] * c + r[1] * s, up[2] * c + r[2] * s] };
}

function halton(i, b) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }

const SN = 1024, STS = 0.8, AIR_Y = 96;
// Per-frame events for the shader: searchlight beams from the nearest air taxis, smoke plumes, the holographic koi.
const EVN = new Float32Array(144);
const CHASE_Y = 64;
const WX = { rain: 0, wet: 0 };
let boState = null;
const koiAnchor = [0, 0];
let koiInit = false;
function computeEvents(tod, dt) {
  EVN.fill(0);
  const night = Math.min(1, Math.max(0, (tod.win - 0.25) / 0.8));
  const cands = [];
  const L3 = C * 3;
  for (let ax = 0; ax < 2; ax++) {
    const across0 = ax === 0 ? st.x : st.z, along0 = ax === 0 ? st.z : st.x;
    const li0 = Math.round(across0 / L3);
    for (let dl = -5; dl <= 5; dl++) {
      const li = li0 + dl, lid = li * 2 + ax;
      if (hsh(lid, 0, 80) >= 0.55) continue;
      const dir = hsh(lid, 0, 81) < 0.5 ? 1 : -1;
      const ph = hsh(lid, 0, 82) * 300;
      const k0 = Math.floor((along0 * dir - clock * 22 + ph) / 90);
      for (let k = k0 - 4; k <= k0 + 4; k++) {
        if (hsh(lid, k, 83) >= 0.6 || hsh(lid, k, 84) >= 0.5) continue;
        const al = ((k + 0.5) * 90 + clock * 22 - ph) * dir;
        const x = ax === 0 ? li * L3 : al, z = ax === 0 ? al : li * L3;
        const hy = AIR_Y - 2 + 4 * ax, dc2 = (x - st.x) ** 2 + (hy - st.y) ** 2 + (z - st.z) ** 2;
        const y = hy + 6 * Math.exp(-dc2 / 400) + 0.25 * Math.sin(clock * 0.9 + k) - 0.7;
        const d = Math.hypot(x - st.x, z - st.z, y - st.y);
        if (d < 450) cands.push([d, x, y, z, k + lid * 17]);
      }
    }
  }
  cands.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < Math.min(4, cands.length); i++) {
    const [d, x, y, z, sd] = cands[i];
    EVN.set([x, y, z, night * (1 - d / 450)], i * 4);
    const dv = norm3([Math.sin(clock * 0.45 + sd) * 0.45, -1, Math.cos(clock * 0.37 + sd * 1.3) * 0.45]);
    EVN.set([dv[0], dv[1], dv[2], 0.09], 16 + i * 4);
  }
  const cx0 = Math.floor(st.x / C), cz0 = Math.floor(st.z / C), sm = [];
  for (let j = -12; j <= 12; j++) for (let i = -12; i <= 12; i++) {
    const c = cellAt(cx0 + i, cz0 + j);
    if (c.typ === 9 && c.v < 0.22) {
      for (const sx of [-4, 4]) { const x = (cx0 + i + 0.5) * C + sx, z = (cz0 + j + 0.5) * C; sm.push([Math.hypot(x - st.x, z - st.z) * 0.7, x, c.h, z]); }
      continue;
    }
    if (!(c.fl & 512)) continue;
    const side = Math.floor(hsh(wrapS(cx0 + i), wrapS(cz0 + j), 59) * 4);
    const bx = (cx0 + i + 0.5) * C + c.offx, bz = (cz0 + j + 0.5) * C + c.offz;
    const x = side === 0 ? bx + c.wx + 0.3 : side === 1 ? bx - c.wx - 0.3 : bx;
    const z = side === 2 ? bz + c.wz + 0.3 : side === 3 ? bz - c.wz - 0.3 : bz;
    sm.push([Math.hypot(x - st.x, z - st.z), x, Math.floor(c.h * 0.45 / 3.5) * 3.5 + 1.9, z]);
  }
  sm.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < Math.min(4, sm.length); i++) if (sm[i][0] < 500) EVN.set([sm[i][1], sm[i][2], sm[i][3], 1], 32 + i * 4);
  if (!koiInit) { koiAnchor[0] = st.x; koiAnchor[1] = st.z; koiInit = true; }
  koiAnchor[0] += (st.x - koiAnchor[0]) * Math.min(1, dt * 0.03);
  koiAnchor[1] += (st.z - koiAnchor[1]) * Math.min(1, dt * 0.03);
  const kv = Math.sin(clock * 0.013 + 1.0);
  if (kv > 0.2) {
    const a = clock * 0.035;
    EVN.set([koiAnchor[0] + Math.cos(a) * 150, 120 + 10 * Math.sin(clock * 0.1), koiAnchor[1] + Math.sin(a) * 150, 80], 48);
    EVN.set([-Math.sin(a), 0.04, Math.cos(a), Math.min(1, (kv - 0.2) * 4)], 52);
  }
  // advertising blimp on a wide circle around the same slowly following anchor, kept clear of the camera
  const ba = clock * 0.01 + 2.0;
  let bp = [koiAnchor[0] + Math.cos(ba) * 260, 165 + 8 * Math.sin(clock * 0.05), koiAnchor[1] + Math.sin(ba) * 260];
  const bd = Math.hypot(bp[0] - st.x, bp[1] - st.y, bp[2] - st.z);
  if (bd < 90) { const k = 90 / Math.max(bd, 1); bp = [st.x + (bp[0] - st.x) * k, st.y + (bp[1] - st.y) * k, st.z + (bp[2] - st.z) * k]; }
  EVN.set([bp[0], bp[1], bp[2], 32], 56);
  EVN.set([-Math.sin(ba), 0, Math.cos(ba), 1], 60);
  // district blackout every few minutes near the camera
  const bcy = 150, bk = Math.floor(clock / bcy), bt = clock - bk * bcy;
  if (bt >= 50 && bt <= 78 && hsh(bk, 3, 160) < 0.75) {
    if (!boState || boState.k !== bk) boState = { k: bk, x: st.x + (hsh(bk, 4, 161) - 0.5) * 300, z: st.z + (hsh(bk, 5, 162) - 0.5) * 300, r: 140 + 120 * hsh(bk, 6, 163) };
    let amt = 1;
    if (bt < 53) amt = hsh(bk, Math.floor(bt * 14), 164) < 0.55 ? 1 : 0;
    else if (bt > 74) amt = hsh(bk, Math.floor(bt * 10), 165) < 0.5 ? 1 : 0.3;
    EVN.set([boState.x, boState.z, boState.r, amt * 0.92], 64);
  } else boState = null;
  // a nearby aerial chase: the police spinner's searchlight holds the fugitive
  for (let ax = 0; ax < 2; ax++) {
    const across0 = ax === 0 ? st.x : st.z, along0 = ax === 0 ? st.z : st.x;
    const li0 = Math.round(across0 / BIG);
    for (let dl = -2; dl <= 2; dl++) {
      const li = li0 + dl, lid = li * 2 + ax;
      if (hsh(lid, 5, 101) >= 0.5) continue;
      const dir = hsh(lid, 5, 102) < 0.5 ? 1 : -1, ph = hsh(lid, 5, 103) * 2600;
      const k0 = Math.floor((along0 * dir - clock * 40 + ph) / 2600);
      for (let k = k0 - 1; k <= k0 + 1; k++) {
        if (hsh(lid, k, 104) >= 0.8) continue;
        const cen = ((k + 0.5) * 2600 + clock * 40 - ph) * dir;
        const pos = (lc) => {
          const wa = cen + lc * dir, lat = 1.8 * Math.sin(wa * 0.03 + lid), y = CHASE_Y + 5 * ax + 1.2 * Math.sin(wa * 0.017 + lid * 2);
          return ax === 0 ? [li * BIG + lat, y, wa] : [wa, y, li * BIG + lat];
        };
        const pol = pos(-8), fug = pos(8);
        if (Math.hypot(pol[0] - st.x, pol[2] - st.z) < 700) {
          const dv = norm3([fug[0] - pol[0], fug[1] - pol[1] - 1.5, fug[2] - pol[2]]);
          EVN.set([pol[0], pol[1] - 0.6, pol[2], Math.max(night, 0.3)], 0);
          EVN.set([dv[0], dv[1], dv[2], 0.035], 16);
          return;
        }
      }
    }
  }
}
// Sky and world events that give the place character: aurora nights, rainbows after showers, shooting stars,
// fireworks over the neon districts, launches from spaceport pads, balloons over the wild land, a lighthouse beam.
const EX = { rain0: 0, rainbow: 0, neon: 0.3, neonT: 0.3, neonScan: 0, meteor: null, meteorNext: 6, fw: null, fwNext: 25, launch: null, launchNext: 30, sc: null, pads: [], lhs: [] };
function hueRGB(h) { return [0, 2, 1].map((k) => Math.min(1, Math.max(0, Math.abs(((h * 6 + k * 2) % 6) - 3) - 1))); }
function dirFrom(a, e) { return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)]; }
function computeExtras(tod, dt) {
  const night = Math.min(1, Math.max(0, (tod.win - 0.25) / 0.8));
  const day = sstep(0.02, 0.2, tod.sun[1]) * (1 - night);
  for (const o of [75, 83, 87, 91, 107, 111, 115, 119]) EVN[o] = -1;
  EVN.fill(0, 68, 75);
  // aurora on about two nights in five
  const ak = Math.floor(clock / 330), at = clock - ak * 330;
  EVN[68] = night * (hsh(ak, 1, 170) < 0.4 ? 1 : 0) * sstep(0, 20, at) * (1 - sstep(300, 330, at));
  // a rainbow for about a minute after a daytime shower
  if (EX.rain0 > 0.3 && WX.rain <= 0.3) EX.rainbow = 1;
  EX.rain0 = WX.rain;
  EX.rainbow = Math.max(0, EX.rainbow - dt / 70);
  EVN[69] = EX.rainbow * day;
  // neon smog follows the share of neon and Chinatown blocks around the camera
  const cx0 = Math.floor(st.x / C), cz0 = Math.floor(st.z / C);
  if ((EX.neonScan -= dt) <= 0) {
    EX.neonScan = 1;
    let n = 0;
    for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const c = cellAt(cx0 + i * 3, cz0 + j * 3); const z = (c.fl >> 15) & 7; if (!c.wild && (z === 1 || z === 3)) n++; }
    EX.neonT = n / 81;
  }
  EX.neon += (EX.neonT - EX.neon) * Math.min(1, dt * 0.5);
  EVN[70] = 0.2 + 1.1 * EX.neon;
  EVN[71] = WX.frost || 0.3;
  if (!EX.skyFor || EX.skyFor !== NAV.site) { EX.sky = skyGeometry(); EX.skyFor = NAV.site; }
  const g = EX.sky;
  EVN.set([g.sat[0], g.sat[1], g.sat[2], g.satR], 120); EVN.set([g.ringN[0], g.ringN[1], g.ringN[2], g.satD], 124);
  EVN.set([g.moonA.dir[0], g.moonA.dir[1], g.moonA.dir[2], g.moonA.r], 128); EVN.set([g.moonB.dir[0], g.moonB.dir[1], g.moonB.dir[2], g.moonB.r], 132);
  // shooting stars
  if (night > 0.5) {
    if (!EX.meteor && clock > EX.meteorNext) {
      const a = Math.random() * 6.283, e = 0.35 + Math.random() * 0.45, s = Math.random() < 0.5 ? -1 : 1;
      EX.meteor = { A: dirFrom(a, e), B: dirFrom(a + s * (0.2 + Math.random() * 0.3), e - 0.08 - Math.random() * 0.15), t0: clock, dur: 0.7 + Math.random() * 0.9 };
    }
    if (EX.meteor) {
      const m = EX.meteor, age = clock - m.t0;
      if (age > m.dur) { EX.meteor = null; EX.meteorNext = clock + 5 + Math.random() * 18; }
      else { EVN.set([...m.A, age], 72); EVN.set([...m.B, m.dur], 76); }
    }
  }
  // fireworks: a show of about half a minute over a neon or Chinatown block ahead, every couple of minutes
  if (night > 0.6) {
    if (!EX.fw && clock > EX.fwNext) {
      const hx = Math.cos(st.yaw), hz = Math.sin(st.yaw);
      for (let k = 0; k < 16 && !EX.fw; k++) {
        const d = 250 + Math.random() * 350, a = (Math.random() - 0.5) * 1.3;
        const x = st.x + (hx * Math.cos(a) - hz * Math.sin(a)) * d, z = st.z + (hz * Math.cos(a) + hx * Math.sin(a)) * d;
        const c = cellAt(Math.floor(x / C), Math.floor(z / C)), zn = (c.fl >> 15) & 7;
        if (!c.wild && (zn === 1 || zn === 3)) EX.fw = { x, z, t0: clock, b: [], slot: 0, nextB: clock };
      }
      EX.fwNext = clock + (EX.fw ? 120 : 15);
    }
    if (EX.fw) {
      const f = EX.fw;
      if (clock - f.t0 > 32) EX.fw = null;
      else {
        if (clock > f.nextB) {
          f.slot = (f.slot + 1) % 3;
          f.b[f.slot] = { x: f.x + (Math.random() - 0.5) * 160, y: 170 + Math.random() * 90, z: f.z + (Math.random() - 0.5) * 160, t0: clock, col: hueRGB(Math.random()), r: 35 + Math.random() * 35 };
          audioBang([f.b[f.slot].x, f.b[f.slot].y, f.b[f.slot].z], false);
          f.nextB = clock + 0.8 + Math.random() * 0.8;
        }
        for (let i = 0; i < 3; i++) {
          const b = f.b[i];
          if (!b || clock - b.t0 > 3.2) continue;
          EVN.set([b.x, b.y, b.z, clock - b.t0], 80 + i * 4);
          EVN.set([b.col[0] * 1.2 + 0.2, b.col[1] * 1.2 + 0.2, b.col[2] * 1.2 + 0.2, b.r], 92 + i * 4);
        }
      }
    }
  }
  // scan the blocks within 1 km, a few hundred per frame, for launch pads and lighthouses
  if (!EX.sc || EX.sc.i >= 6561) {
    if (EX.sc) { EX.pads = EX.sc.pads; EX.lhs = EX.sc.lhs; }
    EX.sc = { cx: cx0, cz: cz0, i: 0, pads: [], lhs: [] };
  }
  for (let n = 0; n < 300 && EX.sc.i < 6561; n++, EX.sc.i++) {
    const cx = EX.sc.cx + (EX.sc.i % 81) - 40, cz = EX.sc.cz + Math.floor(EX.sc.i / 81) - 40;
    const w0 = wrapS(cx), z0 = wrapS(cz);
    const o = computeBase(w0, z0, true);
    if (o.typ === 10 && o.v >= 0.28 && o.v < 0.43) EX.sc.pads.push([(cx + 0.5) * C, (cz + 0.5) * C]);
    else if (o.wild && hsh(w0, z0, 400) <= 0.0025) {
      const f = baseAt(w0, z0);
      if (f.typ === 14 && f.egg === 1) EX.sc.lhs.push([(cx + 0.5) * C, f.h + 23.5, (cz + 0.5) * C]);
    }
  }
  // a rocket launch every few minutes from the nearest empty pad
  if (!EX.launch && clock > EX.launchNext && EX.pads.length) {
    let best = null, bd = 1e18;
    for (const p of EX.pads) { const d = (p[0] - st.x) ** 2 + (p[1] - st.z) ** 2; if (d < bd) { bd = d; best = p; } }
    EX.launch = { x: best[0], z: best[1], t0: clock };
    audioBang([best[0], 0, best[1]], true);
    EX.launchNext = clock + 170 + Math.random() * 120;
  }
  if (EX.launch) {
    const age = clock - EX.launch.t0;
    if (age > 95) EX.launch = null;
    else EVN.set([EX.launch.x, 0.5, EX.launch.z, age], 104);
  }
  // hot-air balloons drifting over the wild land by day
  if (day > 0.05) {
    const G = 1248, gx0 = Math.floor(st.x / G), gz0 = Math.floor(st.z / G), bl = [];
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gi = gx0 + i, gj = gz0 + j, hi = wrapN(gi, 16), hj = wrapN(gj, 16);
      if (hsh(hi, hj, 175) > 0.55) continue;
      const ax = (gi + 0.5) * G + Math.sin(clock / 210 + hi) * 300, az = (gj + 0.5) * G + Math.cos(clock / 170 + hj) * 300;
      if (cityDist(ax, az) < cityR(ax, az) + 200) continue;
      const y = Math.max(0, terrSurfAt(ax, az)) + 150 + 40 * Math.sin(clock / 60 + hi * 3);
      bl.push([Math.hypot(ax - st.x, az - st.z), ax, y, az, hsh(hi, hj, 176)]);
    }
    bl.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(3, bl.length); i++) if (bl[i][0] < 2500) EVN.set([bl[i][1], bl[i][2], bl[i][3], bl[i][4]], 108 + i * 4);
  }
  // the lighthouse beam sweeps at night
  if (night > 0.2 && EX.lhs.length) {
    let best = null, bd = 1e18;
    for (const p of EX.lhs) { const d = (p[0] - st.x) ** 2 + (p[2] - st.z) ** 2; if (d < bd) { bd = d; best = p; } }
    if (bd < 1500 * 1500) {
      const a = clock * 0.8;
      EVN.set([best[0], best[1], best[2], 1.5 + 0.5 * night], 12);
      EVN.set([Math.cos(a), -0.015, Math.sin(a), 0.012], 28);
    }
  }
}

// Rain showers every few minutes; streets stay wet for a while afterwards and low districts flood.
function updateWeather(dt) {
  const cyc = 260, tau = (clock + 150) % cyc, k = Math.floor((clock + 150) / cyc);
  WX.rain = sstep(0, 12, tau) * (1 - sstep(85, 100, tau)) * (0.55 + 0.45 * hsh(k, 7, 150));
  if (todIdx === 3) WX.rain = Math.max(WX.rain, 0.85 * sstep(0, 1, todT));
  // weather set by a story or from the developer menu overrides the cycle
  if (WX.forced !== undefined && WX.forced !== null) WX.rain = WX.forced;
  // a passing snow squall
  if (DIR.squall > 0) WX.rain = Math.max(WX.rain, 0.9 * Math.min(1, DIR.squall * 3));
  WX.wet = Math.min(1, Math.max(0, WX.wet + dt * (WX.rain * 0.06 - (1 - WX.rain) * 0.012)));
  // frost builds during snowfall and fades slowly
  WX.frost = Math.min(WX.forced !== undefined && WX.forced !== null ? 0.5 : 1, Math.max(0.2, (WX.frost || 0.3) + dt * (WX.rain * 0.05 - (1 - WX.rain) * 0.006)));
}
const smaps = [0, 1].map(() => ({ gen: 0, key: "", valid: null, done: false, lx: [1, 0, 0], ly: [0, 1, 0], lz: [0, 1, 0] }));
let smActive = -1, smPending = -1, smGen = 0;
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function shadowDir() {
  let d = norm3(presets[todIdx].sun);
  if (d[1] < 0.25) { const h = Math.hypot(d[0], d[2]); const k = Math.sqrt(1 - 0.0625) / h; d = [d[0] * k, 0.25, d[2] * k]; }
  return d;
}
function smSetup(S, L, key) {
  smGen = smGen % 15 + 1;
  S.key = key; S.gen = smGen; S.valid = null; S.done = false;
  S.lz = L; S.lx = norm3([L[2], 0, -L[0]]); S.ly = cross3(L, S.lx);
}
// Texels of map S to (re)compute this frame: new strips as the drone moves, plus a budgeted fill.
function smRects(S, budgetRows) {
  const cam = [st.x, st.y, st.z];
  const cu = Math.floor(dot3(cam, S.lx) / STS), cv = Math.floor(dot3(cam, S.ly) / STS);
  const W = { u0: cu - SN / 2, u1: cu + SN / 2, v0: cv - SN / 2, v1: cv + SN / 2 };
  const rects = [];
  let V = S.valid;
  if (V) {
    V = { u0: Math.max(V.u0, W.u0), u1: Math.min(V.u1, W.u1), v0: Math.max(V.v0, W.v0), v1: Math.min(V.v1, W.v1) };
    if (V.u0 >= V.u1 || V.v0 > V.v1) V = null;
  }
  if (!V) V = { u0: W.u0, u1: W.u1, v0: cv, v1: cv };
  const h = V.v1 - V.v0;
  if (h > 0) {
    if (V.u0 > W.u0) rects.push([W.u0, V.v0, V.u0 - W.u0, h]);
    if (V.u1 < W.u1) rects.push([V.u1, V.v0, W.u1 - V.u1, h]);
  }
  V.u0 = W.u0; V.u1 = W.u1;
  let rows = Math.max(0, Math.floor((budgetRows * SN - rects.reduce((a, r) => a + r[2] * r[3], 0)) / SN));
  let up = true;
  while (rows > 0 && (V.v0 > W.v0 || V.v1 < W.v1) && rects.length < 6) {
    if ((up || V.v0 <= W.v0) && V.v1 < W.v1) { const k = Math.min(rows, W.v1 - V.v1, 32); rects.push([W.u0, V.v1, SN, k]); V.v1 += k; rows -= k; }
    else if (V.v0 > W.v0) { const k = Math.min(rows, V.v0 - W.v0, 32); rects.push([W.u0, V.v0 - k, SN, k]); V.v0 -= k; rows -= k; }
    up = !up;
  }
  S.valid = V;
  S.done = V.v0 <= W.v0 && V.v1 >= W.v1;
  return rects;
}
// Is the camera inside (or within a margin of) any proxy box? Then rays must start at the camera.
const ZONE_NAMES = ["Financial core", "Neon strip", "Old town", "Chinatown", "Industrial works", "Spaceport", "Dorms", "Crystal gardens"];
function placeLabel() {
  const n = placeName();
  if (NAV.site.id !== "home" || st.mode !== "low") return n;
  const cx = Math.floor(st.x / C), cz = Math.floor(st.z / C), c = cellAt(cx, cz);
  return c.wild ? n : streetName(cx * 131 + cz * 7) + ", " + n;
}
function placeName() {
  if (NAV.site.id !== "home") return NAV.siteName;
  const c = cellAt(Math.floor(st.x / C), Math.floor(st.z / C));
  if (!c.wild) return ZONE_NAMES[(c.fl >> 15) & 7];
  const t = terrainAt(st.x, st.z);
  if (t[1] > t[0]) return t[1] > 0.5 ? "Ligeia marsh" : "Kraken Mare";
  const w = biomeW(t[2], t[3]);
  if (w.mnt > 0.5) return "Xanadu ice highlands";
  if (w.des * w.mid > 0.4) return oasisAt(st.x, st.z)[0] < 150 ? "Warm spring" : "Shangri-La dunes";
  if (w.bad * w.mid > 0.4) return "Tholin badlands";
  if (w.swp * w.mid > 0.4) return "Ligeia marsh";
  return "Glowwoods";
}
function camInsideProxy() {
  const cx0 = Math.floor(st.x / C), cz0 = Math.floor(st.z / C), m = 1.5, FOOTJ = 9.6;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const c = cellAt(cx0 + i, cz0 + j);
    const top = Math.max(c.top, c.treeTop);
    if (top <= 0 || st.y > top + 0.5 + m) continue;
    const cx = (cx0 + i + 0.5) * C, cz = (cz0 + j + 0.5) * C;
    const ext = (c.treeTop > 0 || (c.fl & 30720) || ((c.fl >> 15) & 7) === 3 || c.typ === 14) ? HALF : FOOTJ;
    if (Math.abs(st.x - cx) < ext + m && Math.abs(st.z - cz) < ext + m) return true;
  }
  const bx = Math.floor(st.x / BIG), bz = Math.floor(st.z / BIG);
  const gw = hiveHas(bx, bz) ? 104 : 84;
  if (giantHas(bx, bz) && Math.abs(st.x - (bx + 0.5) * BIG) < gw && Math.abs(st.z - (bz + 0.5) * BIG) < gw && st.y < giantH(bx, bz) + 10) return true;
  return false;
}

async function init() {
  if (!navigator.gpu) {
    startFallback("no WebGPU in this browser", "This page works best with WebGPU: a current version of Chrome or Edge, Safari 26 or later, or Firefox 141 or later on Windows.");
    return;
  }
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) { startFallback("no WebGPU adapter", "WebGPU is present but no GPU adapter is available on this device."); return; }
  const want = adapter.features.has("timestamp-query") ? ["timestamp-query"] : [];
  const device = await adapter.requestDevice({ requiredFeatures: want });
  const hasTS = device.features.has("timestamp-query");
  device.lost.then((info) => { if (info.reason !== "destroyed") fail("The GPU device was lost. Reload the page to restart.", info.message); });
  const ctx = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "opaque" });

  const src = (id) => document.getElementById(id).textContent;
  const common = src("wgsl-common");
  const F16 = "rgba16float";
  const VX = GPUShaderStage.VERTEX, FR = GPUShaderStage.FRAGMENT, CO = GPUShaderStage.COMPUTE;
  const uf = { sampleType: "unfilterable-float" };
  const bgl = (entries) => device.createBindGroupLayout({ entries });
  const pxBGL = bgl([{ binding: 0, visibility: VX | FR, buffer: { type: "uniform" } }, { binding: 1, visibility: VX, texture: uf }]);
  const scBGL = bgl([{ binding: 0, visibility: FR, buffer: { type: "uniform" } }, { binding: 1, visibility: FR, texture: uf },
    { binding: 2, visibility: FR, buffer: { type: "uniform" } }, { binding: 3, visibility: FR, texture: { sampleType: "uint" } },
    { binding: 6, visibility: FR, texture: uf }, { binding: 7, visibility: FR, texture: uf }, { binding: 8, visibility: FR, texture: uf },
    { binding: 11, visibility: FR, buffer: { type: "uniform" } }, { binding: 12, visibility: FR, buffer: { type: "uniform" } }, { binding: 21, visibility: FR, buffer: { type: "uniform" } }, { binding: 22, visibility: FR, buffer: { type: "uniform" } },
    { binding: 13, visibility: FR, texture: uf }, { binding: 14, visibility: FR, texture: uf }, { binding: 15, visibility: FR, texture: uf }]);
  const shBGL = bgl([{ binding: 0, visibility: CO, buffer: { type: "uniform" } }, { binding: 1, visibility: CO, texture: uf },
    { binding: 2, visibility: CO, buffer: { type: "uniform" } }, { binding: 4, visibility: CO, storageTexture: { access: "write-only", format: "rg32uint" } },
    { binding: 5, visibility: CO, buffer: { type: "uniform", hasDynamicOffset: true } }, { binding: 7, visibility: CO, texture: uf }, { binding: 8, visibility: CO, texture: uf },
    { binding: 12, visibility: CO, buffer: { type: "uniform" } }]);
  const trBGL = bgl([{ binding: 0, visibility: CO, buffer: { type: "uniform" } }, { binding: 1, visibility: CO, texture: uf }, { binding: 13, visibility: CO, texture: uf },
    { binding: 9, visibility: CO, storageTexture: { access: "write-only", format: "rgba32float" } },
    { binding: 10, visibility: CO, storageTexture: { access: "write-only", format: "rgba32float" } }]);
  const sto = (b) => ({ binding: b, visibility: CO, storageTexture: { access: "write-only", format: "rgba32float" } });
  const tbBGL = bgl([{ binding: 0, visibility: CO, buffer: { type: "uniform" } }, sto(16), { binding: 20, visibility: CO, buffer: { type: "uniform" } }]);
  const mbBGL = bgl([{ binding: 13, visibility: CO, texture: uf }, { binding: 14, visibility: CO, texture: uf }, sto(18)]);
  const mdBGL = bgl([{ binding: 17, visibility: CO, texture: uf }, sto(18)]);
  const pl = (b) => device.createPipelineLayout({ bindGroupLayouts: [b] });
  // ---------- shaders and pipelines, with a lighter scene for drivers that can't build the full one ----------
  // Some phone GPU drivers (seen on Android Vulkan: VK_ERROR_INITIALIZATION_FAILED) give up on the very large scene
  // shader. Then we retry with the optional effects stubbed out, and failing that fall back to WebGL, saying why.
  const gpuInfo = (() => { try { const i = adapter.info || {}; return [i.vendor, i.architecture, i.device, i.description].filter(Boolean).join(" / "); } catch (e) { return ""; } })();
  const forceLite = globalThis.__forceLite || (typeof location !== "undefined" && /[?&]lite\b/.test(location.search || ""));
  // replace a function's body with a stub, by matching its braces
  const stubFn = (code, name, body) => {
    const i = code.indexOf("\nfn " + name + "(");
    if (i < 0) return code;
    let j = code.indexOf("{", code.indexOf(")", i));
    let depth = 0, k = j;
    for (; k < code.length; k++) { if (code[k] === "{") depth++; else if (code[k] === "}") { depth--; if (depth === 0) break; } }
    return code.slice(0, j) + "{ " + body + " }" + code.slice(k + 1);
  };
  const liteScene = (code) => {
    for (const f of ["tubesFx", "flockFx", "propsFx", "holoFx"]) code = stubFn(code, f, "return colIn;");
    code = stubFn(code, "propSDF", "return vec2f(1e5, 0.0);");
    code = stubFn(code, "mantaSDF", "return 1e5;");
    code = stubFn(code, "eggSDF", "return 1e5;");
    code = stubFn(code, "adScreenUV", "return vec4f(1e5, 0.0, 0.0, 0.0);");
    // and the moving city and set pieces: sky events, the koi, walkers, traffic, the spaceport and the works
    code = stubFn(code, "skyExtras", "return colIn;");
    code = stubFn(code, "koiFx", "return vec3f(0.0);");
    code = stubFn(code, "pedQ", "return vec4f(1e5, 0.0, 0.0, 0.0);");
    code = stubFn(code, "laneQ", "var r: CarQ; r.d = 1e5; r.la = 0.0; r.lat = 0.0; r.seed = 0; r.ok = 0.0; r.kind = 0; r.yb = 0.0; return r;");
    code = stubFn(code, "spaceportSDF", "return vec2f(1e5, 0.0);");
    code = stubFn(code, "industrialSDF", "return vec2f(1e5, 0.0);");
    code = stubFn(code, "facadeFx", "");
    return code;
  };
  async function buildAll(lite) {
    const named = (name, pr) => pr.catch((e) => { const err = new Error((e && e.message) || String(e)); err.pipeline = name; throw err; });
    const sceneMod = device.createShaderModule({ label: lite ? "scene (lite)" : "scene", code: common + (lite ? liteScene(src("wgsl-scene")) : src("wgsl-scene")) });
    const postMod = device.createShaderModule({ label: "post", code: common + src("wgsl-post") });
    const spaceMod = device.createShaderModule({ label: "space", code: common + src("wgsl-space") });
    for (const [name, mod] of [["scene", sceneMod], ["post", postMod], ["space", spaceMod]]) {
      const info = await mod.getCompilationInfo();
      const errs = info.messages.filter((x) => x.type === "error");
      if (errs.length) { const err = new Error(errs.map((x) => x.lineNum + ":" + x.linePos + " " + x.message).join("\n")); err.pipeline = name + " shader"; err.compile = true; throw err; }
    }
    const mk = (label, module, entryPoint, fmt, layout = "auto") => named(label, device.createRenderPipelineAsync({
      label, layout, vertex: { module, entryPoint: "vs" }, fragment: { module, entryPoint, targets: [{ format: fmt }] }, primitive: { topology: "triangle-list" },
    }));
    const mkProxy = (vsName) => named("proxy " + vsName, device.createRenderPipelineAsync({
      label: "proxy " + vsName, layout: pl(pxBGL), vertex: { module: sceneMod, entryPoint: vsName }, fragment: { module: sceneMod, entryPoint: "fsProxy", targets: [{ format: "r32float" }] },
      primitive: { topology: "triangle-list", cullMode: "none" }, depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
    }));
    const mkC = (label, layout, module, entryPoint) => named(label, device.createComputePipelineAsync({ label, layout, compute: { module, entryPoint } }));
    if (globalThis.__failFull && !lite) { const err = new Error("CreateGraphicsPipelines failed with VK_ERROR_INITIALIZATION_FAILED (simulated)"); err.pipeline = "scene"; throw err; }
    const [pScene, pTaa, pDown, pBH, pBV, pComp, pProxyC, pProxyG, pShadow, pTree] = await Promise.all([
      mk("scene", sceneMod, "scene", F16, pl(scBGL)), mk("taa", postMod, "taa", F16), mk("bloom", postMod, "bloomDown", F16), mk("blur h", postMod, "blurH", F16), mk("blur v", postMod, "blurV", F16), mk("composite", postMod, "comp", format),
      mkProxy("vsCell"), mkProxy("vsGiant"),
      mkC("shadows", pl(shBGL), sceneMod, "shadowBuild"), mkC("trees", pl(trBGL), sceneMod, "treeBuild"),
    ]);
    const spBGL = bgl([{ binding: 0, visibility: VX | FR, buffer: { type: "uniform" } }, { binding: 1, visibility: FR, buffer: { type: "uniform" } }]);
    const pSpace = await named("space", device.createRenderPipelineAsync({
      label: "space", layout: pl(spBGL), vertex: { module: spaceMod, entryPoint: "vs" },
      fragment: { module: spaceMod, entryPoint: "space", targets: [{ format: F16, blend: { color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" }, alpha: { srcFactor: "zero", dstFactor: "one", operation: "add" } } }] },
      primitive: { topology: "triangle-list" },
    }));
    const [pTerr, pMipB, pMipD] = await Promise.all([
      mkC("terrain", pl(tbBGL), sceneMod, "terrBuild"), mkC("terrain mip base", pl(mbBGL), sceneMod, "mipBase"), mkC("terrain mip", pl(mdBGL), sceneMod, "mipDown"),
    ]);
    return { sceneMod, postMod, spaceMod, pScene, pTaa, pDown, pBH, pBV, pComp, pProxyC, pProxyG, pShadow, pTree, spBGL, pSpace, pTerr, pMipB, pMipD, lite };
  }
  let PL = null;
  const describe = (e) => "Pipeline: " + (e.pipeline || "unknown") + (gpuInfo ? "\nGPU: " + gpuInfo : "") + "\n" + ((e && e.message) || e);
  try { PL = await buildAll(forceLite); }
  catch (e1) {
    if (forceLite || e1.compile) { startFallback("This device's graphics driver could not build the city's shaders", describe(e1)); return; }
    try { PL = await buildAll(true); }
    catch (e2) { startFallback("This device's graphics driver could not build the city's shaders", describe(e2) + "\n(The full version failed first: " + describe(e1) + ")"); return; }
  }
  const { sceneMod, postMod, spaceMod, pScene, pTaa, pDown, pBH, pBV, pComp, pProxyC, pProxyG, pShadow, pTree, spBGL, pSpace, pTerr, pMipB, pMipD } = PL;
  if (PL.lite && !forceLite) setTimeout(() => showHint("Lighter graphics for this device.", 6000), 1500);
  globalThis.__driftGPU = { gpuInfo, lite: PL.lite };

  const TU = GPUTextureUsage;
  const cellTex = device.createTexture({ size: [NC * 3, NC], format: "rgba32float", usage: TU.TEXTURE_BINDING | TU.COPY_DST });
  const treeA = device.createTexture({ size: [384, 384], format: "rgba32float", usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING });
  const treeB = device.createTexture({ size: [384, 384], format: "rgba32float", usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING });
  const shadowTex = [0, 1].map(() => device.createTexture({ size: [SN, SN], format: "rg32uint", usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING }));
  const ubuf = device.createBuffer({ size: 272, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const spBuf = [0, 1].map(() => device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
  const rectBuf = device.createBuffer({ size: 256 * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const rectData = new Int32Array(64 * 12);
  const propBuf = device.createBuffer({ size: PROP_DATA.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const flockBuf = device.createBuffer({ size: FLOCK_DATA.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const evBuf = device.createBuffer({ size: 576, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  // the whole world: terrain per block corner, distant blocks per block, and a max-height pyramid over both
  const NWJ = 768;
  const terrTex = device.createTexture({ size: [NWJ, NWJ], format: "rgba32float", usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING });
  const ffBTex = device.createTexture({ size: [NWJ, NWJ], format: "rgba32float", usage: TU.TEXTURE_BINDING | TU.COPY_DST });
  const ffMaxTex = device.createTexture({ size: [NWJ, NWJ], format: "rgba32float", mipLevelCount: 9, usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING });
  const geoBuf = device.createBuffer({ size: 832, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const terrBG = device.createBindGroup({ layout: tbBGL, entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 16, resource: terrTex.createView() }, { binding: 20, resource: { buffer: geoBuf } }] });
  const mipBBG = device.createBindGroup({ layout: mbBGL, entries: [{ binding: 13, resource: terrTex.createView() }, { binding: 14, resource: ffBTex.createView() },
    { binding: 18, resource: ffMaxTex.createView({ baseMipLevel: 0, mipLevelCount: 1 }) }] });
  const mipDBG = [];
  for (let k = 1; k < 9; k++) mipDBG.push(device.createBindGroup({ layout: mdBGL, entries: [{ binding: 17, resource: ffMaxTex.createView({ baseMipLevel: k - 1, mipLevelCount: 1 }) },
    { binding: 18, resource: ffMaxTex.createView({ baseMipLevel: k, mipLevelCount: 1 }) }] }));
  function encodePyramid(enc) {
    const c = enc.beginComputePass();
    c.setPipeline(pMipB); c.setBindGroup(0, mipBBG); c.dispatchWorkgroups(NWJ / 8, NWJ / 8);
    c.setPipeline(pMipD);
    for (let k = 1; k < 9; k++) { const n = NWJ >> k; c.setBindGroup(0, mipDBG[k - 1]); c.dispatchWorkgroups(Math.ceil(n / 8), Math.ceil(n / 8)); }
    c.end();
  }
  const spaceBuf = device.createBuffer({ size: 640, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const spaceBG = device.createBindGroup({ layout: spBGL, entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: spaceBuf } }] });
  const regU = new Float32Array(8);
  const geoData = new Float32Array(208);
  function writeRegion() {
    regU.set([REG.ox, REG.oz, 0, REG.city, REG.cx, REG.cz, 0, 0]); device.queue.writeBuffer(ubuf, 240, regU);
    geoData.set(GEO.E, 0); geoData.set(GEO.U, 4); geoData.set(GEO.N, 8); geoData[12] = GEO.feats.length;
    GEO.feats.forEach((f, i) => { geoData.set([f[0], f[1], f[2], f[3]], 16 + i * 4); geoData[112 + i * 4] = f[4]; });
    device.queue.writeBuffer(geoBuf, 0, geoData);
  }
  function buildTerrain() {
    writeRegion();
    const enc = device.createCommandEncoder();
    const c = enc.beginComputePass();
    c.setPipeline(pTerr); c.setBindGroup(0, terrBG); c.dispatchWorkgroups(NWJ / 8, NWJ / 8);
    c.end();
    encodePyramid(enc);
    device.queue.submit([enc.finish()]);
  }
  buildTerrain();
  // Distant blocks are generated a few rows per frame, nearest rows first, so the page starts at once
  // and the skyline fills in over the first seconds.
  const ffRow = new Float32Array(NWJ * 4);
  let camRow = ((Math.floor(st.z / C) % NWJ) + NWJ) % NWJ;
  let ffOrder = Array.from({ length: NWJ }, (_, r) => r).sort((a, b) => Math.abs(wrapN(a - camRow, NWJ)) - Math.abs(wrapN(b - camRow, NWJ)));
  let ffNext = 0, ffSinceMip = 0;
  let ffZero = null;
  function ffRestart(keep) {
    if (!keep) {
      if (!ffZero) ffZero = new Float32Array(NWJ * NWJ * 4);
      device.queue.writeTexture({ texture: ffBTex }, ffZero, { bytesPerRow: NWJ * 16, rowsPerImage: NWJ }, [NWJ, NWJ]);
    }
    camRow = ((Math.floor(st.z / C) % NWJ) + NWJ) % NWJ;
    ffOrder = Array.from({ length: NWJ }, (_, r) => r).sort((a, b) => Math.abs(wrapN(a - camRow, NWJ)) - Math.abs(wrapN(b - camRow, NWJ)));
    ffNext = 0; ffSinceMip = 0;
  }
  function ffStep(budgetMs) {
    if (ffNext >= NWJ) return false;
    const t0 = performance.now();
    while (ffNext < NWJ && performance.now() - t0 < budgetMs) {
      const r = ffOrder[ffNext++];
      ffRow.fill(0);
      for (let i = 0; i < NWJ; i++) { const f = farInfo(wrapS(i), wrapS(r)); if (f) ffRow.set(f, i * 4); }
      device.queue.writeTexture({ texture: ffBTex, origin: [0, r] }, ffRow, { bytesPerRow: NWJ * 16 }, [NWJ, 1]);
      ffSinceMip++;
    }
    const rebuild = ffSinceMip >= 24 || (ffNext >= NWJ && ffSinceMip > 0);
    if (rebuild) ffSinceMip = 0;
    return rebuild;
  }
  const tbBuf = device.createBuffer({ size: GLYPH_TABLE.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(tbBuf, 0, GLYPH_TABLE);
  const spData = new Float32Array(12);
  const samp = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
  const ures = { buffer: ubuf };
  const pxBG = device.createBindGroup({ layout: pxBGL, entries: [{ binding: 0, resource: ures }, { binding: 1, resource: cellTex.createView() }] });
  const shBG = [0, 1].map((i) => device.createBindGroup({ layout: shBGL, entries: [{ binding: 0, resource: ures }, { binding: 1, resource: cellTex.createView() },
    { binding: 2, resource: { buffer: spBuf[i] } }, { binding: 4, resource: shadowTex[i].createView() }, { binding: 5, resource: { buffer: rectBuf, size: 16 } },
    { binding: 7, resource: treeA.createView() }, { binding: 8, resource: treeB.createView() }, { binding: 12, resource: { buffer: tbBuf } }] }));
  const trBG = device.createBindGroup({ layout: trBGL, entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: cellTex.createView() }, { binding: 13, resource: terrTex.createView() }, { binding: 9, resource: treeA.createView() }, { binding: 10, resource: treeB.createView() }] });
  const bgOf = (p, ents) => device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: ents.map(([binding, resource]) => ({ binding, resource })) });

  // GPU timing (where the browser exposes timestamp queries)
  const passNames = ["trees", "shadow map", "proxies", "scene", "taa", "bloom down", "blur h", "blur v", "composite"];
  let qs = null, qResolve = null, qRead = null, qBusy = false;
  const gpuMs = new Float64Array(passNames.length);
  if (hasTS) {
    qs = device.createQuerySet({ type: "timestamp", count: passNames.length * 2 });
    qResolve = device.createBuffer({ size: passNames.length * 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
    qRead = device.createBuffer({ size: passNames.length * 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  }

  let lastCx = null, lastCz = null, treesDirty = true;
  const colBuf = new Float32Array(NC * 12);
  worldResetHook = () => {
    buildTerrain();
    ffRestart();
    lastCx = null;
    treesDirty = true;
    smActive = -1; smPending = -1;
    EX.fw = null; EX.launch = null; EX.sc = null; EX.pads = []; EX.lhs = []; EX.skyFor = null;
    st.tour = null;
    flock.length = 0;
    histValid = false;
  };
  function syncCells() {
    const cx = Math.floor(st.x / C), cz = Math.floor(st.z / C);
    if (cx === lastCx && cz === lastCz) return;
    const first = lastCx === null;
    lastCx = cx; lastCz = cz;
    const ch = updateWindow(cx, cz);
    if (!ch.count) return;
    treesDirty = true;
    if (first || ch.count > NC * 6) {
      device.queue.writeTexture({ texture: cellTex }, cellData, { bytesPerRow: NC * 3 * 16, rowsPerImage: NC }, [NC * 3, NC]);
      return;
    }
    for (const sz of ch.rows) device.queue.writeTexture({ texture: cellTex, origin: [0, sz] }, cellData, { offset: sz * NC * 48, bytesPerRow: NC * 48 }, [NC * 3, 1]);
    for (const sx of ch.cols) {
      for (let r = 0; r < NC; r++) colBuf.set(cellData.subarray((r * NC + sx) * 12, (r * NC + sx) * 12 + 12), r * 12);
      device.queue.writeTexture({ texture: cellTex, origin: [sx * 3, 0] }, colBuf, { bytesPerRow: 48, rowsPerImage: NC }, [3, NC]);
    }
  }
  syncCells();

  const coarse = matchMedia("(pointer: coarse)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let scale = coarse ? 0.66 : 0.82, ceiling = 1.0;
  const minScale = 0.36;
  let T = null, histValid = false, cur = 0, carry = null, carryBG = null;
  function buildTargets() {
    // Keep the latest resolved frame: the anti-aliasing pass samples history by screen position,
    // so the new resolution can blend from it and the change stays invisible.
    let keep = null;
    if (T) {
      keep = T.hist[1 - cur];
      for (const k of ["scene", "bA", "bB", "px", "pxd"]) T[k].destroy();
      T.hist[cur].destroy();
      if (carry) carry.destroy();
    }
    const w = Math.max(64, Math.round(canvas.width * scale)), h = Math.max(64, Math.round(canvas.height * scale));
    const usage = TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING;
    const tex = (tw, th, f = F16) => device.createTexture({ size: [tw, th], format: f, usage });
    const bw = Math.max(1, Math.floor(w / 4)), bh = Math.max(1, Math.floor(h / 4));
    T = { w, h, scene: tex(Math.ceil(w / 2), h), h0: tex(w, h), h1: tex(w, h), bA: tex(bw, bh), bB: tex(bw, bh), px: tex(w, h, "r32float"),
      pxd: device.createTexture({ size: [w, h], format: "depth24plus", usage: TU.RENDER_ATTACHMENT }) };
    const hist = [T.h0, T.h1];
    T.hist = hist;
    T.sc = [0, 1].map((i) => device.createBindGroup({ layout: scBGL, entries: [{ binding: 0, resource: ures }, { binding: 1, resource: cellTex.createView() },
      { binding: 2, resource: { buffer: spBuf[i] } }, { binding: 3, resource: shadowTex[i].createView() }, { binding: 6, resource: T.px.createView() },
      { binding: 7, resource: treeA.createView() }, { binding: 8, resource: treeB.createView() },
      { binding: 11, resource: { buffer: evBuf } }, { binding: 12, resource: { buffer: tbBuf } }, { binding: 21, resource: { buffer: flockBuf } }, { binding: 22, resource: { buffer: propBuf } },
      { binding: 13, resource: terrTex.createView() }, { binding: 14, resource: ffBTex.createView() }, { binding: 15, resource: ffMaxTex.createView() }] }));
    T.taa = [0, 1].map((i) => bgOf(pTaa, [[0, ures], [2, T.scene.createView()], [3, hist[1 - i].createView()], [4, samp]]));
    T.down = [0, 1].map((i) => bgOf(pDown, [[4, samp], [5, hist[i].createView()]]));
    T.bh = bgOf(pBH, [[4, samp], [5, T.bA.createView()]]);
    T.bv = bgOf(pBV, [[4, samp], [5, T.bB.createView()]]);
    T.comp = [0, 1].map((i) => bgOf(pComp, [[0, ures], [4, samp], [5, hist[i].createView()], [6, T.bA.createView()]]));
    carry = keep;
    carryBG = keep ? bgOf(pTaa, [[0, ures], [2, T.scene.createView()], [3, keep.createView()], [4, samp]]) : null;
    if (!keep) histValid = false;
  }
  function resizeCanvas() {
    const w = Math.max(64, Math.round(innerWidth * dpr)), h = Math.max(64, Math.round(innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; buildTargets(); }
  }
  resizeCanvas();
  if (!T) buildTargets();
  addEventListener("resize", resizeCanvas);

  const U = new Float32Array(68);
  let prev = null, frameNo = 0;
  const ran = new Uint8Array(9);
  let last = performance.now(), ema = 16.7, lastChange = 0, lastIncrease = -1e9, goodTime = 0, hudTick = 0, dtS = 1 / 60;
  const dtHist = new Float32Array(120);
  let dtIdx = 0, refreshMs = 16.7, gpuFresh = 0, displayMs = 16.67, missE = 0;
  function tsw(i, on) { return on ? { querySet: qs, beginningOfPassWriteIndex: i * 2, endOfPassWriteIndex: i * 2 + 1 } : undefined; }
  function rpass(enc, pipeline, bg, target, ti, on) {
    const p = enc.beginRenderPass({ colorAttachments: [{ view: target, loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 1 } }], timestampWrites: tsw(ti, on) });
    p.setPipeline(pipeline); p.setBindGroup(0, bg); p.draw(3); p.end();
  }
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    ema = ema * 0.95 + dt * 1000 * 0.05;
    dtS = dtS * 0.75 + dt * 0.25;
    dtHist[dtIdx % 120] = dt * 1000; dtIdx++;
    if (dtIdx % 60 === 0) {
      const v = Array.from(dtHist).filter((x) => x > 0).sort((a, b) => a - b);
      if (v.length > 30) refreshMs = v[Math.floor(v.length * 0.2)];
    }
    // Resolution follows missed display frames, measured against the display's own interval
    // (33 ms under Low Power Mode, otherwise 16.7 ms). This works in every browser and does not
    // depend on per-pass GPU timers, which Apple GPUs report unreliably.
    if (dtIdx % 60 === 0) {
      let mn = 1e9;
      for (let i = 0; i < 120; i++) if (dtHist[i] > 0 && dtHist[i] < mn) mn = dtHist[i];
      let snapped = mn;
      for (const c of [8.33, 11.11, 16.67, 33.33, 50]) if (c <= mn * 1.08) snapped = c;
      displayMs = Math.max(snapped, 16.67);
    }
    missE = missE * 0.96 + (dt * 1000 > displayMs * 1.22 ? 0.04 : 0);
    if (now - lastChange > 2500) {
      if (missE > 0.15 && scale > minScale) {
        if (now - lastIncrease < 8000) ceiling = scale / 1.05;
        scale = Math.max(minScale, scale * 0.9); buildTargets(); lastChange = now; goodTime = 0; missE = 0.08;
      } else if (missE < 0.03 && scale < ceiling) {
        goodTime += dt;
        if (goodTime > 3) { scale = Math.min(ceiling, scale * 1.06); buildTargets(); lastChange = lastIncrease = now; goodTime = 0; }
      } else goodTime = 0;
    }
    // the world's clock runs in every mode: story scenes, trips, space and free flight included
    clock += dtS;
    if (!INTRO.started && frameNo > 4) { INTRO.started = true; if (!globalThis.__noIntro) gateShow(); }
    if (INTRO.on) introCaptions();
    const modeWas = NAV.mode;
    if (navStep(dtS, spaceInput(dt))) {
      update(dtS);
      recentre();
    }
    if (NAV.mode !== modeWas) histValid = false;
    if (worldShift && prev) { prev.pos[0] += worldShift[0]; prev.pos[2] += worldShift[1]; }
    worldShift = null;
    const inSpace = NAV.spaceMix >= 0.999;
    if (!inSpace && (Math.abs(st.x - REG.cx) > 1000 || Math.abs(st.z - REG.cz) > 1000)) {
      REG.cx = Math.round(st.x / C) * C; REG.cz = Math.round(st.z / C) * C;
      clearTerrainCache();
      buildTerrain();
      if (REG.city && Math.hypot(st.x + REG.ox, st.z + REG.oz) < 26000) ffRestart(true);
    }
    if (!inSpace) syncCells();
    const tod = currentTod();
    let cam = cameraVectors();
    if (inSpace) cam = { f: NAV.cam.F, r: NAV.cam.R, up: NAV.cam.Up };
    taleHotspots(dtS, cam, 0.72);
    taleSync(dtS);
    directorStep(dtS);
    audioListener([st.x, st.y, st.z], cam.f, cam.up);
    audioStep(dtS, audioWorld(dtS));
    audioCity(dtS, AUW);
    const fo = document.getElementById("bFlyOn");
    if (fo) fo.hidden = !(NAV.mode === "visit" && !TALE.on);
    // shadow basis follows the target time of day; a change starts a new map generation
    // Shadow maps are double-buffered: a new sun direction is built in the background while the old map stays in use.
    const L = shadowDir(), key = L.map((v) => v.toFixed(4)).join(",");
    const writeSP = (i) => {
      const S = smaps[i];
      spData.set(S.lx, 0); spData[3] = STS; spData.set(S.ly, 4); spData[7] = SN; spData.set(S.lz, 8); spData[11] = S.gen;
      device.queue.writeBuffer(spBuf[i], 0, spData);
    };
    if (smActive < 0) { smActive = 0; smSetup(smaps[0], L, key); writeSP(0); }
    else if (key !== smaps[smActive].key && (smPending < 0 || smaps[smPending].key !== key)) { smPending = 1 - smActive; smSetup(smaps[smPending], L, key); writeSP(smPending); }
    const jobs = [];
    const ra = smRects(smaps[smActive], smaps[smActive].done ? 8 : 48);
    if (ra.length) jobs.push([smActive, ra]);
    if (smPending >= 0) {
      const rp = smRects(smaps[smPending], 32);
      if (rp.length) jobs.push([smPending, rp]);
      if (smaps[smPending].done) { smActive = smPending; smPending = -1; }
    }
    const j = Math.floor(frameNo / 2) % 16 + 1;
    U[0] = T.w; U[1] = T.h; U[2] = clock; U[3] = scale > 0.42 ? 1 : 0;
    if (inSpace) { U[4] = 0; U[5] = 0; U[6] = 0; }
    else if (FOLLOW && NAV.spaceMix < 0.01) {
      // follow the drone: a little behind and above it, looking just past it
      const fx = Math.cos(st.yaw), fz = Math.sin(st.yaw);
      U[4] = st.x - fx * 3.5; U[5] = st.y + 1.1; U[6] = st.z - fz * 3.5;
      const tgt = [st.x + fx * 6, st.y + 0.1 + Math.sin(st.pitch) * 6, st.z + fz * 6];
      const f = norm3([tgt[0] - U[4], tgt[1] - U[5], tgt[2] - U[6]]), r = norm3([-f[2], 0, f[0]]);
      cam = { f, r, up: cross3(r, f) };
    } else { U[4] = st.x; U[5] = st.y; U[6] = st.z; }
    U[7] = 0.72;
    U.set(cam.f, 8); U[11] = frameNo % 1024;
    U.set(cam.r, 12); U[15] = histValid && prev ? 1 : 0;
    U.set(cam.up, 16); U[19] = wind.x;
    U.set(tod.sun, 20); U[23] = wind.z;
    U.set(tod.sunCol, 24); U[27] = tod.win;
    U.set(tod.skyTop, 28); U[31] = tod.stars; U.set(tod.skyHor, 32); U[35] = camInsideProxy() ? 1 : 0;
    U.set(tod.fog, 36); U[39] = tod.den * (1 + 2.4 * DIR.fog);
    U[40] = halton(j, 2) - 0.5; U[41] = halton(j, 3) - 0.5; U[42] = canvas.width; U[43] = canvas.height;
    const pv = prev || { pos: [U[4], U[5], U[6]], f: cam.f, r: cam.r, up: cam.up };
    U.set(pv.pos, 44); U.set(pv.f, 48); U.set(pv.r, 52); U.set(pv.up, 56);
    updateWeather(dt);
    U[47] = wind.cx; U[51] = wind.cz; U[55] = inSpace ? 0 : WX.rain; U[59] = WX.wet;
    U.set([REG.ox, REG.oz, 0, REG.city, REG.cx, REG.cz, 0, 0], 60);
    // the lens: on the story's scene when there is one in view, otherwise (0) on the centre of the view
    const ft = inSpace ? 0 : focusTarget([U[4], U[5], U[6]], cam.f);
    FOCUS.d = ft > 0 ? (FOCUS.d > 0 ? FOCUS.d + (ft - FOCUS.d) * Math.min(1, dt * 3) : ft) : 0;
    // shallow focus is for story moments; in flight the lens goes deep, so you can judge where you are going
    const fs = !FOCUS.on || inSpace ? 0 : NAV.mode === "visit" || FOCUS.d > 0 ? 1 : NAV.mode === "surface" ? 0.3 * clampv(1 - (AUW.speed || 0) / 25, 0, 1) : 0;
    FOCUS.s += (fs - FOCUS.s) * Math.min(1, dt * 2);
    U[66] = FOCUS.d; U[67] = FOCUS.s;
    device.queue.writeBuffer(ubuf, 0, U);
    if (!inSpace) device.queue.writeBuffer(propBuf, 0, worldProps());
    if (!inSpace) { stepFlock(dtS); if (!FLOCKS_ON) FLOCK_DATA[0] = 0; device.queue.writeBuffer(flockBuf, 0, FLOCK_DATA); }
    if (NAV.spaceMix > 0.001 && NAV.cam) {
      if (!NAV.sunT) NAV.sunT = sunTitanFromLocal(tod.sun);
      // near Titan the light keeps the goggles' warm grade; out among the moons it is plain sunlight
      const far = sstep(3000, 20000, len3(NAV.cam.P) - TR);
      const sc = tod.sunCol.map((v, i) => (Math.min(v, 3) * 0.5 + 0.8) * (1 - far) + [2.0, 1.95, 1.85][i] * far);
      device.queue.writeBuffer(spaceBuf, 0, fillSpaceData(NAV.cam, NAV.sunT, sc, NAV.spaceMix, 0.72, clock));
    }
    computeEvents(tod, dt);
    computeExtras(tod, dt);
    device.queue.writeBuffer(evBuf, 0, EVN);
    const pyr = !inSpace && ffStep(frameNo < 2 ? 1 : 3);
    const measure = hasTS && !qBusy && frameNo % 6 === 0;
    ran.fill(0);
    const enc = device.createCommandEncoder();
    if (pyr) encodePyramid(enc);
    if (treesDirty && !inSpace) {
      const c = enc.beginComputePass({ timestampWrites: tsw(0, measure) });
      c.setPipeline(pTree); c.setBindGroup(0, trBG); c.dispatchWorkgroups(48, 48); c.end();
      treesDirty = false; ran[0] = 1;
    }
    if (jobs.length && !inSpace) {
      let n = 0;
      for (const [, rs] of jobs) for (const r of rs) rectData.set(r, (n++) * 64);
      device.queue.writeBuffer(rectBuf, 0, rectData, 0, n * 64);
      const c = enc.beginComputePass({ timestampWrites: tsw(1, measure) });
      c.setPipeline(pShadow);
      n = 0;
      for (const [mi, rs] of jobs) for (const r of rs) {
        c.setBindGroup(0, shBG[mi], [(n++) * 256]);
        c.dispatchWorkgroups(Math.ceil(r[2] / 8), Math.ceil(r[3] / 8));
      }
      c.end(); ran[1] = 1;
    }
    if (!inSpace) {
      const p = enc.beginRenderPass({
        colorAttachments: [{ view: T.px.createView(), loadOp: "clear", storeOp: "store", clearValue: { r: 1e9, g: 0, b: 0, a: 0 } }],
        depthStencilAttachment: { view: T.pxd.createView(), depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "discard" },
        timestampWrites: tsw(2, measure),
      });
      p.setBindGroup(0, pxBG);
      p.setPipeline(pProxyC); p.draw(36, NC * NC);
      p.setPipeline(pProxyG); p.draw(36, 169);
      p.end(); ran[2] = 1;
    }
    if (!inSpace) rpass(enc, pScene, T.sc[smActive], T.scene.createView(), 3, measure);
    if (NAV.spaceMix > 0.001) {
      const p = enc.beginRenderPass({ colorAttachments: [{ view: T.scene.createView(), loadOp: inSpace ? "clear" : "load", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      p.setPipeline(pSpace); p.setBindGroup(0, spaceBG); p.draw(3); p.end();
    }
    rpass(enc, pTaa, carryBG || T.taa[cur], T.hist[cur].createView(), 4, measure);
    rpass(enc, pDown, T.down[cur], T.bA.createView(), 5, measure);
    rpass(enc, pBH, T.bh, T.bB.createView(), 6, measure);
    rpass(enc, pBV, T.bv, T.bA.createView(), 7, measure);
    rpass(enc, pComp, T.comp[cur], ctx.getCurrentTexture().createView(), 8, measure);
    for (let i = 3; i < 9; i++) ran[i] = 1;
    if (measure) {
      enc.resolveQuerySet(qs, 0, passNames.length * 2, qResolve, 0);
      enc.copyBufferToBuffer(qResolve, 0, qRead, 0, passNames.length * 16);
    }
    device.queue.submit([enc.finish()]);
    if (frameNo === 0) showControlsHint();
    if (carry) { carry.destroy(); carry = null; carryBG = null; }
    if (measure) {
      const ranSnap = ran.slice();
      qBusy = true;
      qRead.mapAsync(GPUMapMode.READ).then(() => {
        const v = new BigUint64Array(qRead.getMappedRange());
        for (let i = 0; i < passNames.length; i++) {
          const d = ranSnap[i] ? Number(v[i * 2 + 1] - v[i * 2]) / 1e6 : 0;
          gpuMs[i] = gpuMs[i] * 0.5 + (d > 0 && d < 1000 ? d : 0) * 0.5;
        }
        gpuFresh++;
        qRead.unmap(); qBusy = false;
      }).catch(() => { qBusy = false; });
    }
    prev = { pos: [U[4], U[5], U[6]], f: cam.f, r: cam.r, up: cam.up };
    histValid = true;
    cur = 1 - cur;
    frameNo++;
    hudTick += dt;
    if (hudTick > 0.25) {
      hudTick = 0;
      const autoOn = clock - lastInput > 4.5;
      statusEl.innerHTML = statusHTML(autoOn);
      syncGoLabel();
      // the Story button says what it will do
      const vt = document.getElementById("vTale");
      if (vt) vt.textContent = TALE.on ? "Close" : (TALE.story || taleFetch(TALE_KEY)) ? "Resume" : "Play";
      // climbing only where it means something; on touch screens the controls fade after a while untouched
      const cl = document.getElementById("climb");
      if (cl) cl.hidden = TALE.on || !(NAV.mode === "surface" || NAV.mode === "free" || (NAV.mode === "space" && NAV.space.kind === 1));
      if (touchUI && !uiHidden && clock - lastUiTouch > 12 && !(goPanel && goPanel.classList.contains("open")) && !PAD.lx && !PAD.ly && !PAD.rx && !PAD.ry) setUiHidden(true, true);
      if (statsOn) {
        const res = T.w + " × " + T.h + " (" + Math.round(scale * 100) + "%)";
        const hz = Math.round(1000 / displayMs);
        if (hasTS) {
          const work = gpuMs[0] + gpuMs[1] + gpuMs[2] + gpuMs[3] + gpuMs[4] + gpuMs[5] + gpuMs[6] + gpuMs[7];
          statsEl.textContent = "GPU work " + work.toFixed(1) + " ms: scene " + gpuMs[3].toFixed(1) + ", proxies " + gpuMs[2].toFixed(2) + ", shadow map " + gpuMs[1].toFixed(2) + ", trees " + gpuMs[0].toFixed(2) +
            ", anti-aliasing " + gpuMs[4].toFixed(2) + ", bloom " + (gpuMs[5] + gpuMs[6] + gpuMs[7]).toFixed(2) + ". Composite " + gpuMs[8].toFixed(1) + " ms, including the wait for the display. Frame " + ema.toFixed(1) + " ms, display about " + hz + " Hz" + (hz <= 31 ? " (capped, as Low Power Mode does on iPhone)" : "") + ", render " + res;
        } else {
          statsEl.textContent = "GPU timing is not exposed by this browser. Frame " + ema.toFixed(1) + " ms, render " + res;
        }
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const routeNames = { auto: "Automatic", low: "Streets", high: "Rooftops" };
function syncLabels() {
  vTime.textContent = presets[todIdx].name;
  document.getElementById("bTime").setAttribute("aria-label", "Time of day: " + presets[todIdx].name + ". Activate for the next time of day.");
  const r = st.forced || "auto";
  vRoute.textContent = routeNames[r];
  document.getElementById("bRoute").setAttribute("aria-label", "Route: " + routeNames[r] + ". Activate to switch between automatic, streets and rooftops.");
}
let uiHidden = false, hintTimer = 0;
function showHint(text, ms) {
  hint.textContent = text;
  hint.classList.remove("hidden");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hint.classList.add("hidden"), ms);
}
let hideHintShown = false, lastUiTouch = 0;
function setUiHidden(hide, quiet) {
  uiHidden = hide;
  ui.classList.toggle("hidden", hide);
  document.body.classList.toggle("uiHidden", hide);
  if (hide && (!quiet || !hideHintShown)) { hideHintShown = true; showHint(touchUI ? "Tap the screen to show the controls." : "Click the scene or press H to show the controls.", 2500); }
}
// any touch, click or key brings the controls back and keeps them up a while
for (const ev of ["pointerdown", "keydown", "wheel"]) addEventListener(ev, () => { lastUiTouch = clock; }, { passive: true });
hint.addEventListener("click", () => hint.classList.add("hidden"));
function cycleMode() {
  st.forced = st.forced === null ? "low" : (st.forced === "low" ? "high" : null);
  if (st.forced === null) st.modeT = 20;
  st.realign = true;
  syncLabels();
}
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "t") { nextTod(); return; }
  if (k === "m") { cycleMode(); return; }
  if (k === "h") { setUiHidden(!uiHidden); return; }
  if (k === "g") { toggleGoPanel(); return; }
  if (k === "t") { taleToggle(); return; }
  if (k === "escape") { closeGoPanel(); return; }
  keys.add(k);
  if (k.startsWith("arrow") || k === " ") e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => keys.clear());
let downAt = 0;
canvas.addEventListener("pointerdown", (e) => {
  touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (touches.size === 2) { const [a, b] = [...touches.values()]; pinchD = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  pointer.down = true; pointer.type = e.pointerType; pointer.sx = pointer.x = e.clientX; pointer.sy = pointer.y = e.clientY;
  downAt = performance.now();
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (touches.has(e.pointerId)) {
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (touches.size === 2 && NAV.mode === "space") {
      const [a, b] = [...touches.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinchD > 0) wheelAcc = clampv(wheelAcc - Math.log(d / pinchD) * 8, -3, 3);
      pinchD = d;
      pointer.sx = pointer.x; pointer.sy = pointer.y;
    }
  }
  pointer.type = e.pointerType;
  if (pointer.down) { pointer.x = e.clientX; pointer.y = e.clientY; }
  else { pointer.hoverX = e.clientX; pointer.hoverY = e.clientY; pointer.hoverT = clock; }
});
const release = (e) => {
  if (e && e.pointerId !== undefined) touches.delete(e.pointerId);
  if (touches.size > 0) return;
  if (pointer.down && e && e.type === "pointerup" && performance.now() - downAt < 300 && Math.hypot(pointer.x - pointer.sx, pointer.y - pointer.sy) < 10) setUiHidden(!uiHidden);
  pointer.down = false;
};
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
canvas.addEventListener("pointerleave", () => { pointer.hoverT = -100; });
document.getElementById("bTime").addEventListener("click", nextTod);
document.getElementById("bGo").addEventListener("click", (e) => { e.stopPropagation(); toggleGoPanel(); });
document.getElementById("bTale").addEventListener("click", (e) => { e.stopPropagation(); taleToggle(); });
document.getElementById("bMenu").addEventListener("click", (e) => { e.stopPropagation(); toggleGoPanel(); });
document.getElementById("introSkipBtn").addEventListener("click", (e) => { e.stopPropagation(); introSkip(); });
document.getElementById("gateGo").addEventListener("click", (e) => { e.stopPropagation(); gateEnter(true); });
document.getElementById("gateQuiet").addEventListener("click", (e) => { e.stopPropagation(); gateEnter(false); });
// tapping the scene closes the travel drawer
canvas.addEventListener("pointerdown", () => closeGoPanel());
document.getElementById("taleClose").addEventListener("click", (e) => { e.stopPropagation(); taleClose(); });
document.getElementById("taleMin").addEventListener("click", (e) => { e.stopPropagation(); taleMinToggle(); });
document.getElementById("taleRestart").addEventListener("click", (e) => { e.stopPropagation(); taleRestart(); });
document.getElementById("bFlyOn").addEventListener("click", (e) => { e.stopPropagation(); flyOn(); });
taleWirePanel();
padWire();
for (const [id, v] of [["bUp", 1], ["bDn", -1]]) {
  const b = document.getElementById(id);
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); climbBtn = v; b.setPointerCapture(e.pointerId); });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, () => { if (climbBtn === v) climbBtn = 0; });
}
document.getElementById("bRoute").addEventListener("click", cycleMode);
document.getElementById("bHide").addEventListener("click", () => setUiHidden(true));
statusEl.addEventListener("click", () => { statsOn = !statsOn; statsEl.hidden = !statsOn; statusEl.setAttribute("aria-pressed", statsOn ? "true" : "false"); });
syncLabels();
globalThis.__drift = { goTo, NAV, st, SPACE_DATA, startFree, flatCamTitan, REG, TALE, taleOpen, taleChoose, taleFound, taleAdvance, taleClose, hop, hopPlace, destById, toggleGoPanel, MENU, renderMenu, PAD, padShow, setFollow: (v) => { FOLLOW = v; }, INTRO, gateEnter, NAVG: () => NAV.gate };
function showControlsHint() { showHint(touchUI ? "Drag to steer the drone. Tap the screen to show or hide controls." : "Drag, or move the mouse off centre, to steer. W/S speed, A/D turn, E/Q height. T time of day, M route, H controls.", 9000); }
showHint("Landing on Titan\u2026", 600000);

init().catch((e) => startFallback("WebGPU failed to start", String((e && e.message) || e)));
