// ---------- a light camera assist in free flight ----------
// While you fly over the city (NAV.mode "surface") a quiet cinematographer looks ahead for something worth framing (a
// landmark, a megatower, a Life tower), and turns the VIEW a little so it sits on a third of the frame, with its
// upper part in shot, the horizon settling level and the lens on it. It never steers the drone and never locks on:
// at most 0.15 rad of yaw and 0.12 of pitch, eased over seconds, and a third of that while you are steering. Menu >
// View > "Camera assist" switches it off. Why and how it was tuned: the drift-city skill, "Camera assist".
const ASSIST = { on: taleFetch("drift.assist") !== false, subj: null, score: 0, t: 0, ay: 0, ap: 0, level: 0, cands: null, focus: 0 };
// things worth framing, found once: the placed landmarks, the megatowers, the tallest Life tower
function assistCandidates() {
  if (ASSIST.cands) return ASSIST.cands;
  const c = pickLandmarks().map((L) => ({ name: L.name, x: L.x, z: L.z, y0: 0, h: L.h, r: L.r }));
  for (let bz = -12; bz <= 12; bz++) for (let bx = -12; bx <= 12; bx++) {
    if (!giantHas(bx, bz)) continue;
    const x = (bx + 0.5) * BIG, z = (bz + 0.5) * BIG;
    if (c.some((o) => Math.hypot(o.x - x, o.z - z) < 60)) continue;
    c.push({ name: "megatower", x, z, y0: 0, h: giantH(bx, bz), r: 40 });
  }
  if (typeof guideLifeTower === "function") { const L = guideLifeTower(); if (L) c.push({ ...L }); }
  for (const o of c) o.y0 = Math.max(terrSurfAt(o.x, o.z), 0);
  return (ASSIST.cands = c);
}
// the best subject ahead: big in the view, near the heading, in clear sight
function assistPick() {
  const hx = Math.cos(st.yaw), hz = Math.sin(st.yaw);
  let best = null, bs = 0;
  for (const o of assistCandidates()) {
    const dx = o.x - st.x, dz = o.z - st.z, d = Math.hypot(dx, dz);
    if (d < 70 || d > 1600) continue;
    const ahead = (dx * hx + dz * hz) / d;
    if (ahead < 0.8) continue;
    const size = Math.max(o.h, o.r * 2) / d;
    let s = size * (ahead - 0.8) * 5;
    if (o === ASSIST.subj) s *= 1.6;
    if (s > bs) { bs = s; best = o; }
  }
  if (best && typeof pickClear === "function") {
    const aim = [best.x, best.y0 + best.h * 0.55, best.z];
    if (!pickClear([st.x, st.y, st.z], aim, Math.max(best.r, 20))) { best = null; bs = 0; }
  }
  ASSIST.subj = bs > 0.02 ? best : null; ASSIST.score = bs;
}
// each frame: ease the view offsets toward the composition, or back to zero
function assistStep(dt, steering) {
  const flying = ASSIST.on && NAV.mode === "surface" && NAV.spaceMix < 0.01;
  ASSIST.t -= dt;
  if (flying && ASSIST.t <= 0) { ASSIST.t = 0.5; assistPick(); }
  let ty = 0, tp = 0, lv = 0, fd = 0;
  const S = flying ? ASSIST.subj : null;
  if (S) {
    const w = steering ? 0.35 : 1;
    const dx = S.x - st.x, dz = S.z - st.z, d = Math.hypot(dx, dz);
    let rel = Math.atan2(dz, dx) - st.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    // on the third of the frame on the side it is already on
    const third = Math.atan(0.72 * (innerWidth / innerHeight) / 3);
    ty = clampv((rel - Math.sign(rel || 1) * third) * 0.35, -0.15, 0.15) * w;
    const aimY = S.y0 + S.h * 0.55;
    tp = clampv((Math.atan2(aimY - st.y, d) - st.pitch) * 0.3, -0.12, 0.12) * w;
    lv = 0.6 * w;
    if (Math.abs(rel - ty) < 0.3) fd = Math.hypot(d, aimY - st.y);
  }
  const k = Math.min(1, dt * (flying ? 0.7 : 3));
  ASSIST.ay += (ty - ASSIST.ay) * k; ASSIST.ap += (tp - ASSIST.ap) * k; ASSIST.level += (lv - ASSIST.level) * Math.min(1, dt);
  ASSIST.focus = fd;
}
