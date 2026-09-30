// ---------- the venues' rooms: the shared part (rooms/*.wgsl hold each place's walls and things) ----------
// Built as its own module: common.wgsl + scene.wgsl + this file + every rooms/*.wgsl + the dispatch main.js writes
// (roomDispatch). One pipeline per place: ROOM_K is set when the pipeline is made, so the compiler keeps only that
// place's branches. The city's pipeline has none of this; rooms-off.wgsl stands in for the few calls it makes.
// Why: the drift-city skill, "Rooms have their own pipelines".
override ROOM_K: i32 = 1;
fn roomK() -> i32 { return ROOM_K; }
// a row of n things spaced `stp` apart from `start` along one axis: the offset from the nearest
fn rmRep(x: f32, start: f32, stp: f32, n: f32) -> f32 { return x - start - stp * clamp(round((x - start) / stp), 0.0, n - 1.0); }
fn rmIdx(x: f32, start: f32, stp: f32, n: f32) -> f32 { return clamp(round((x - start) / stp), 0.0, n - 1.0); }
fn rmU(a: vec2f, b: vec2f) -> vec2f { return select(a, b, b.x < a.x); }
fn rmTorusX(p: vec3f, R: f32, r: f32) -> f32 { return length(vec2f(length(p.yz) - R, p.x)) - r; }
fn rmTorusY(p: vec3f, R: f32, r: f32) -> f32 { return length(vec2f(length(p.xz) - R, p.y)) - r; }
fn rmCapX(p: vec3f, x0: f32, x1: f32, r: f32) -> f32 { return length(vec3f(max(max(x0 - p.x, p.x - x1), 0.0), p.y, p.z)) - r; }
// bottles on three shelves along a wall, each slot its own shape: u runs along the wall, v is out from it
fn rmBottles(u: f32, y: f32, v: f32, u0: f32, n: f32, y0: f32) -> f32 {
  let si = floor((y - y0 - 0.14) / 0.4 + 0.5);
  let sy = y - y0 - 0.4 * clamp(si, 0.0, 2.0);
  let bi = rmIdx(u, u0, 0.17, n);
  let bu = u - u0 - 0.17 * bi;
  let hk = hsh(i32(bi), i32(clamp(si, 0.0, 2.0)), 931);
  let bh = 0.16 + 0.12 * hk;
  let br = 0.032 + 0.018 * fract(hk * 7.3);
  let p = vec3f(bu, sy, v);
  let body = sdCyl(p, br, 0.02, 0.02 + bh) - 0.004;
  let shoulder = sdEll(p - vec3f(0.0, 0.02 + bh, 0.0), vec3f(br, br * 0.9, br));
  let neck = sdCyl(p, 0.012 + 0.004 * fract(hk * 3.1), 0.02 + bh, 0.1 + bh + 0.04 * fract(hk * 5.7));
  return min(smin(body, shoulder, 0.01), neck);
}
// a pendant lamp: a cord from the ceiling, a conical enamel shade open below, a bulb in it
fn rmPendant(q: vec3f, at: vec3f, top: f32) -> vec2f {
  let p = q - at;
  var r = vec2f(sdCyl(p, 0.006, 0.12, top - at.y), 17.0);
  let h = clamp(p.y / 0.26, 0.0, 1.0);
  let cone = abs(length(p.xz) - mix(0.2, 0.035, h)) - 0.006;
  r = rmU(r, vec2f(max(cone * 0.8, max(-p.y, p.y - 0.26)), 21.0));
  r = rmU(r, vec2f(length(p - vec3f(0.0, 0.035, 0.0)) - 0.045, 8.0));
  return r;
}
// a paper lantern: ribbed, capped top and bottom, a tassel; it sways a little on its cord
fn rmLantern(q: vec3f, at: vec3f, rad: f32, seed: f32) -> vec2f {
  let sw = vec3f(0.03 * sin(u.time * 0.7 + seed * 6.0), 0.0, 0.02 * sin(u.time * 0.53 + seed * 4.0));
  let p = q - at - sw;
  let a = atan2(p.z, p.x);
  var body = sdEll(p, vec3f(rad, rad * 1.25, rad)) + 0.006 * abs(sin(a * 8.0));
  body = max(body, abs(p.y) - rad * 1.1);
  var r = vec2f(body, 22.0);
  r = rmU(r, vec2f(max(sdCyl(p, rad * 0.45, -rad * 1.2, rad * 1.2), abs(abs(p.y) - rad * 1.12) - 0.02), 14.0));
  r = rmU(r, vec2f(sdCyl(p - vec3f(0.0, -rad * 1.2, 0.0), 0.01, -0.22, 0.0) - 0.004, 22.0));
  r = rmU(r, vec2f(sdCyl(p, 0.004, rad * 1.1, 3.2 - at.y), 17.0));
  return r;
}
// a drum kit (the bass drum's centre on the floor at k): shells, rims, cymbals on chrome stands
fn rmDrums(q: vec3f, k: vec3f) -> vec2f {
  let p = q - k;
  var r = vec2f(max(length(p.xy - vec2f(0.0, 0.28)) - 0.28, abs(p.z) - 0.17), 14.0);
  r = rmU(r, vec2f(length(vec2f(length(p.xy - vec2f(0.0, 0.28)) - 0.285, abs(p.z) - 0.17)) - 0.012, 17.0));
  let sn = p - vec3f(-0.55, 0.0, -0.35);
  r = rmU(r, vec2f(sdCyl(sn, 0.17, 0.5, 0.62), 14.0));
  r = rmU(r, vec2f(length(vec2f(length(sn.xz) - 0.17, sn.y - 0.62)) - 0.01, 17.0));
  r = rmU(r, vec2f(sdCyl(p - vec3f(-0.3, 0.0, 0.45), 0.2, 0.42, 0.62), 14.0));
  let c1 = p - vec3f(-0.5, 1.05, 0.55);
  r = rmU(r, vec2f(max(length(c1.xz) - 0.25, abs(c1.y + 0.02 * length(c1.xz)) - 0.006), 29.0));
  let c2 = p - vec3f(-0.75, 0.88, -0.6);
  r = rmU(r, vec2f(max(length(c2.xz) - 0.19, abs(c2.y + 0.02 * length(c2.xz)) - 0.006), 29.0));
  r = rmU(r, vec2f(min(sdSeg(p, vec3f(-0.5, 0.0, 0.55), vec3f(-0.5, 1.05, 0.55)), sdSeg(p, vec3f(-0.75, 0.0, -0.6), vec3f(-0.75, 0.88, -0.6))) - 0.011, 17.0));
  return r;
}
// an upright bass on its stand, scroll up
fn rmBass(q: vec3f, k: vec3f) -> vec2f {
  let p = q - k;
  var body = smin(sdEll(p - vec3f(0.0, 0.45, 0.0), vec3f(0.12, 0.34, 0.33)), sdEll(p - vec3f(0.0, 0.95, 0.0), vec3f(0.1, 0.26, 0.25)), 0.08);
  body = max(body, -max(sdEll(p - vec3f(0.12, 0.72, 0.0), vec3f(0.05, 0.08, 0.02)), 0.0));
  var r = vec2f(body, 33.0);
  r = rmU(r, vec2f(sdRC(p, vec3f(0.0, 1.15, 0.0), vec3f(0.0, 1.85, 0.0), 0.025, 0.02), 14.0));
  r = rmU(r, vec2f(length(vec2f(length(p.xy - vec2f(0.0, 1.9)) - 0.04, p.z)) - 0.014, 14.0));
  return r;
}
// a round table on one leg, a cloth on some, something lit on it
fn rmTable(q: vec3f, k: vec2f, cloth: bool) -> vec2f {
  let p = q - vec3f(k.x, 0.0, k.y);
  var r = vec2f(min(sdCyl(p, 0.42, 0.72, 0.755), sdCyl(p, 0.045, 0.0, 0.72)), 4.0);
  r = rmU(r, vec2f(sdCyl(p, 0.24, 0.0, 0.025), 17.0));
  if (cloth) {
    let a = atan2(p.z, p.x);
    let hem = 0.5 + 0.03 * sin(a * 9.0);
    let dr = max(abs(length(p.xz) - mix(0.43, 0.5, clamp((0.76 - p.y) / 0.3, 0.0, 1.0)) - 0.01 * sin(a * 9.0)) - 0.006, max(p.y - 0.765, hem - p.y + 0.0));
    r = rmU(r, vec2f(min(dr, sdCyl(p, 0.44, 0.755, 0.765)), 25.0));
  }
  return r;
}
fn rmStool(q: vec3f, k: vec2f) -> vec2f {
  let p = q - vec3f(k.x, 0.0, k.y);
  var r = vec2f(sdCyl(p, 0.2, 0.0, 0.02), 17.0);
  r = rmU(r, vec2f(sdCyl(p, 0.024, 0.0, 0.72), 17.0));
  r = rmU(r, vec2f(rmTorusY(p - vec3f(0.0, 0.3, 0.0), 0.16, 0.012), 17.0));
  r = rmU(r, vec2f(sdCyl(p, 0.18, 0.72, 0.8) - 0.025, 10.0));
  return r;
}


// the place's walls and things: rmPlaceMap is written by main.js (roomDispatch) from tales.js ROOMS
fn rmMap(q: vec3f, k: i32) -> vec2f { return rmPlaceMap(q); }
fn rmNormal(q: vec3f, k: i32) -> vec3f {
  let e = vec2f(0.0012, -0.0012);
  return normalize(e.xyy * rmMap(q + e.xyy, k).x + e.yyx * rmMap(q + e.yyx, k).x + e.yxy * rmMap(q + e.yxy, k).x + e.xxx * rmMap(q + e.xxx, k).x);
}

// the lamps as the music moves them: the stage key changes colour with the tune and lifts on the beat, the
// footlights pulse, the house lights come up between tunes while the stage dims, candles and lanterns flicker,
// and the jukebox's light turns through its colours
fn rmLight(k: i32, i: i32) -> array<vec3f, 2> {
  var L = rmLight0(k, i);
  let B = rmBand();
  let gap = select(0.0, 1.0, ev.wx.w < -0.5);
  if ((k == 3 || k == 4) && i == 0) {
    let c = mix(vec3f(1.0), rmStageCol(floor(B.z / 2.0) + f32(k)) * 1.5, 0.5);
    L[1] = L[1] * mix(vec3f(0.5), c * (0.85 + 0.4 * B.y), B.x);
  }
  if (k == 4 && i == 1) { L[1] *= mix(0.35, 0.9 + 0.6 * B.y, B.x); }
  if ((k == 4 && i == 5) || (k == 3 && i == 3)) { L[1] *= 1.0 + 2.5 * gap; }
  if ((k == 4 && i >= 2 && i <= 4) || (k == 3 && (i == 1 || i == 2))) { L[1] *= 0.9 + 0.1 * sin(u.time * (11.0 + f32(i) * 3.7)) * sin(u.time * 7.3 + f32(i)); }
  if (k == 1 && i == 4) { L[1] = (hue3(fract(u.time * 0.04)) * 0.8 + 0.2) * 1.5 * (0.7 + 0.5 * B.y + 0.3 * B.x); }
  return L;
}
// the lights of each room: position (local) and colour times strength; the first one casts a soft shadow. Warm
// against cold in every room: tungsten and candle against a window, a porthole or a stair.
fn rmLight0(k: i32, i: i32) -> array<vec3f, 2> {
  let z = array<vec3f, 2>(vec3f(0.0, -50.0, 0.0), vec3f(0.0));
  switch k {
    case 1: {
      if (i == 0) { return array<vec3f, 2>(vec3f(3.0, 2.34, 1.55), vec3f(1.0, 0.72, 0.42) * 4.5); }
      if (i == 1) { return array<vec3f, 2>(vec3f(6.2, 2.34, 1.55), vec3f(1.0, 0.72, 0.42) * 4.0); }
      if (i == 2) { return array<vec3f, 2>(vec3f(3.8, 2.24, -2.7), vec3f(1.0, 0.7, 0.4) * 2.6); }
      if (i == 3) { return array<vec3f, 2>(vec3f(9.0, 1.4, 0.3), vec3f(0.3, 0.5, 1.0) * 2.2); }
      if (i == 4) { return array<vec3f, 2>(vec3f(7.2, 1.95, -3.1), vec3f(1.0, 0.2, 0.12) * 1.3); }
      if (i == 5) { return array<vec3f, 2>(vec3f(4.6, 1.5, 3.05), vec3f(1.0, 0.75, 0.4) * 1.4); }
      if (i == 6) { return array<vec3f, 2>(RM_FANL, vec3f(1.0, 0.84, 0.6) * 7.0); }
      return z;
    }
    case 2: {
      if (i == 0) { return array<vec3f, 2>(vec3f(15.0, 3.25, -0.6), vec3f(1.0, 0.8, 0.55) * 4.0); }
      if (i == 1) { return array<vec3f, 2>(vec3f(9.0, 2.2, -4.4), vec3f(0.35, 0.55, 1.0) * 4.5); }
      if (i == 2) { return array<vec3f, 2>(vec3f(7.0, 3.25, -0.6), vec3f(1.0, 0.8, 0.55) * 3.5); }
      if (i == 3) { return array<vec3f, 2>(vec3f(3.0, 3.25, -0.6), vec3f(1.0, 0.8, 0.55) * 3.0); }
      if (i == 4) { return array<vec3f, 2>(vec3f(19.7, 3.0, 0.9), vec3f(0.3, 1.0, 0.5) * 1.2); }
      if (i == 5) { return array<vec3f, 2>(vec3f(17.2, 2.4, 0.9), vec3f(1.0, 0.7, 0.4) * 2.0); }
      return z;
    }
    case 3: {
      if (i == 0) { return array<vec3f, 2>(vec3f(10.6, 2.8, 0.2), vec3f(1.0, 0.82, 0.6) * 6.0); }
      if (i == 1) { return array<vec3f, 2>(vec3f(3.8, 2.2, -2.1), vec3f(1.0, 0.3, 0.12) * 2.6); }
      if (i == 2) { return array<vec3f, 2>(vec3f(6.0, 2.2, 2.1), vec3f(1.0, 0.35, 0.12) * 2.6); }
      if (i == 3) { return array<vec3f, 2>(vec3f(-1.2, 2.4, 0.0), vec3f(0.35, 0.5, 0.9) * 0.7); }
      if (i == 4) { return array<vec3f, 2>(vec3f(4.7, 1.05, -3.0), vec3f(1.0, 0.6, 0.25) * 0.6); }
      if (i == 5) { return array<vec3f, 2>(vec3f(4.7, 1.05, 3.0), vec3f(1.0, 0.6, 0.25) * 0.6); }
      return z;
    }
    default: {
      if (i == 0) { return array<vec3f, 2>(vec3f(19.0, 6.5, 0.0), vec3f(1.0, 0.88, 0.7) * 24.0); }
      if (i == 1) { return array<vec3f, 2>(vec3f(18.5, 0.9, 0.0), vec3f(1.0, 0.7, 0.4) * 3.0); }
      if (i == 2) { return array<vec3f, 2>(vec3f(12.0, 1.1, -7.8), vec3f(1.0, 0.35, 0.2) * 2.4); }
      if (i == 3) { return array<vec3f, 2>(vec3f(12.0, 1.1, 7.8), vec3f(1.0, 0.35, 0.2) * 2.4); }
      if (i == 4) { return array<vec3f, 2>(vec3f(4.2, 1.1, 0.0), vec3f(1.0, 0.35, 0.2) * 2.4); }
      if (i == 5) { return array<vec3f, 2>(vec3f(12.0, 9.0, 0.0), vec3f(0.35, 0.4, 0.9) * 3.0); }
      return z;
    }
  }
}
// beams in the haze under the lamps: apex (w: its own distance falloff, 0 for the usual 0.35), axis, cosine of the
// half angle, colour
// the stage beams swing slowly and take the stage's colour while the band plays; in the club two follow-spots from
// the dome ribs sweep the stand, and go dark between tunes
fn rmBeam(k: i32, i: i32) -> array<vec4f, 3> {
  var b = rmBeam0(k, i);
  let B = rmBand();
  if ((k == 3 || k == 4) && i == 0) {
    let a = 0.28 * sin(u.time * 0.37) * B.x;
    let ax = b[1].xyz;
    b[1] = vec4f(ax.x * cos(a) - ax.z * sin(a), ax.y, ax.x * sin(a) + ax.z * cos(a), b[1].w);
    b[2] = vec4f(b[2].xyz * mix(vec3f(0.6), mix(vec3f(1.0), rmStageCol(floor(B.z / 2.0) + f32(k)), 0.6) * (0.9 + 0.4 * B.y), B.x), 0.0);
  }
  if (k == 4 && (i == 1 || i == 2)) {
    let sg = select(-1.0, 1.0, i == 2);
    let ap = vec3f(9.0, 9.2, 6.5 * sg);
    let aim = vec3f(18.6, 1.4, 1.8 * sin(u.time * 0.23 + sg * 1.7) + 0.6 * sg);
    b = array<vec4f, 3>(vec4f(ap, 0.012), vec4f(normalize(aim - ap), 0.965), vec4f(select(vec3f(1.0, 0.45, 0.7), vec3f(1.0, 0.8, 0.5), i == 2) * 2.5 * B.x, 0.0));
    if (B.x < 0.5) { b[1].w = 2.0; }
  }
  if (k == 3 && i == 1 && B.x > 0.5) {
    b = array<vec4f, 3>(vec4f(7.5, 2.85, 0.0, 0.0), vec4f(normalize(vec3f(3.0, -1.6, 0.4 * sin(u.time * 0.31))), 0.93), vec4f(rmStageCol(floor(B.z / 2.0) + 1.0) * 2.5 * (0.8 + 0.4 * B.y), 0.0));
  }
  return b;
}
fn rmBeam0(k: i32, i: i32) -> array<vec4f, 3> {
  let none = array<vec4f, 3>(vec4f(0.0), vec4f(0.0, -1.0, 0.0, 2.0), vec4f(0.0));
  if (k == 1) {
    if (i == 0) { return array<vec4f, 3>(vec4f(3.0, 2.36, 1.55, 0.0), vec4f(0.0, -1.0, 0.0, 0.72), vec4f(1.0, 0.72, 0.42, 0.0)); }
    if (i == 1) { return array<vec4f, 3>(vec4f(6.2, 2.36, 1.55, 0.0), vec4f(0.0, -1.0, 0.0, 0.72), vec4f(1.0, 0.72, 0.42, 0.0)); }
    // the fan's lamp: a wide cone down through the turning blades (their shadows cut it into rays, in roomRender)
    return array<vec4f, 3>(vec4f(RM_FANL, 0.5), vec4f(0.0, -1.0, 0.0, 0.62), vec4f(1.0, 0.84, 0.6, 0.0) * 1.1);
  }
  if (k == 2) {
    if (i == 0) { return array<vec4f, 3>(vec4f(9.0, 2.3, -4.8, 0.0), vec4f(0.25, -0.35, 0.9, 0.75), vec4f(0.2, 0.3, 0.55, 0.0)); }
    if (i == 1) { return array<vec4f, 3>(vec4f(15.0, 3.25, -0.6, 0.0), vec4f(0.0, -1.0, 0.0, 0.5), vec4f(1.0, 0.8, 0.55, 0.0)); }
    return array<vec4f, 3>(vec4f(7.0, 3.25, -0.6, 0.0), vec4f(0.0, -1.0, 0.0, 0.5), vec4f(1.0, 0.8, 0.55, 0.0));
  }
  if (k == 3) {
    if (i == 0) { return array<vec4f, 3>(vec4f(10.6, 2.9, 0.2, 0.0), normalize(vec4f(1.0, -1.2, 0.0, 0.0)) + vec4f(0.0, 0.0, 0.0, 0.82), vec4f(1.0, 0.82, 0.6, 0.0)); }
    return none;
  }
  if (i == 0) { return array<vec4f, 3>(vec4f(19.0, 7.5, 0.0, 0.0), normalize(vec4f(0.9, -1.0, 0.0, 0.0)) + vec4f(0.0, 0.0, 0.0, 0.93), vec4f(1.0, 0.88, 0.7, 0.0)); }
  return none;
}
var<private> gRmJ: f32 = 0.0;
fn rmShadow(q: vec3f, lp: vec3f, k: i32) -> f32 {
  let d = lp - q;
  let L = length(d);
  let dir = d / L;
  // a start jittered per pixel and frame: banding in the penumbra becomes noise the anti-aliasing averages away
  var t = 0.02 + 0.03 * gRmJ;
  var s = 1.0;
  for (var i = 0; i < 40; i++) {
    if (t > L - 0.15) { break; }
    let h = rmMap(q + dir * t, k).x;
    s = min(s, 12.0 * h / t);
    if (s < 0.02) { break; }
    t += clamp(h, 0.01, 0.35);
  }
  return clamp(s, 0.0, 1.0);
}
// light arriving at a point (local position and normal): the room's lamps and a dim ambient tinted by the room
fn rmLit(q: vec3f, n: vec3f, k: i32, occ: f32, shadowed: bool) -> vec3f {
  var c = vec3f(0.0);
  for (var i = 0; i < 7; i++) {
    let Ld = rmLight(k, i);
    if (Ld[0].y < -40.0) { continue; }
    let d = Ld[0] - q;
    let l2 = dot(d, d);
    var sh = 1.0;
    if (i == 0 && shadowed) { sh = rmShadow(q + n * 0.02, Ld[0], k); }
    if (i == 6) { sh = rmFanMask(q); }
    c += Ld[1] * max(dot(n, d * inverseSqrt(l2)), 0.0) * sh / (l2 * 0.45 + 0.6);
  }
  let amb = select(select(select(vec3f(0.035, 0.03, 0.04), vec3f(0.025, 0.035, 0.05), k == 2), vec3f(0.05, 0.022, 0.015), k == 3), vec3f(0.04, 0.028, 0.022), k == 1);
  if (k == 4) {
    // the glitterball's spots, and slow washes of colour round the dome, two stage colours turning against each other
    let B = rmBand();
    c += vec3f(1.0, 0.95, 0.88) * rmBallSpots(q) * (0.5 + 0.6 * B.x) * max(dot(n, normalize(RM_BALL - q)), 0.0);
    let az = atan2(q.z, q.x - 12.0);
    let wash = mix(rmStageCol(floor(B.z / 4.0) + 1.0), rmStageCol(floor(B.z / 4.0) + 2.0), 0.5 + 0.5 * sin(az * 2.0 + u.time * 0.25));
    c += wash * 0.07 * occ * (0.6 + 0.4 * B.x);
  }
  return c + amb * (0.5 + 0.5 * n.y) * occ;
}
fn rmAO(q: vec3f, n: vec3f, k: i32) -> f32 {
  var o = 0.0;
  for (var i = 1; i <= 5; i++) {
    let h = 0.03 * f32(i * i);
    o += (h - rmMap(q + n * h, k).x) / h * (1.0 / f32(i));
  }
  return clamp(1.0 - 0.45 * o, 0.15, 1.0);
}
// what the Low Orbit's window shows: the pads at night across the apron, a launch light, now and then a lift-off
fn rmWindowView(v: vec3f) -> vec3f {
  let hz = v.y;
  var c = mix(vec3f(0.09, 0.05, 0.03), vec3f(0.02, 0.025, 0.05), sstepJ(0.0, 0.5, hz));
  if (hz < 0.0) { c = vec3f(0.015, 0.014, 0.016) + vec3f(0.08, 0.05, 0.02) * exp(hz * 30.0); }
  let az = atan2(v.x, -v.z);
  let row = exp(-pow((hz + 0.012) * 180.0, 2.0));
  c += vec3f(1.0, 0.8, 0.5) * row * step(0.6, fract(az * 40.0)) * 0.8;
  let blink = step(0.55, fract(u.time * 0.7));
  c += vec3f(1.0, 0.1, 0.05) * exp(-(pow((az - 0.25) * 90.0, 2.0) + pow((hz - 0.01) * 120.0, 2.0))) * blink * 4.0;
  let lt = fract(u.time / 70.0) * 70.0;
  if (lt < 14.0) {
    let hy = lt * lt * 0.0016;
    let g = exp(-(pow((az + 0.3) * 60.0, 2.0) + pow((hz - hy) * 50.0, 2.0)));
    let trail = exp(-pow((az + 0.3) * 80.0, 2.0)) * step(0.0, hz) * step(hz, hy) * 0.4;
    c += vec3f(1.0, 0.85, 0.6) * (g * 6.0 + trail) * sstepJ(14.0, 9.0, lt);
  }
  return c;
}
struct RmS { alb: vec3f, emi: vec3f, spec: f32, refl: f32, bump: vec3f };
// the distance of the point being shaded: fine patterns (tiles, grain, mortar, gaps) fade out as they shrink below a
// few pixels, or they alias into rings and speckle (the first Cold Tap ceiling did)
var<private> gRmT: f32 = 1.0;
fn rmFine(size: f32) -> f32 { return 1.0 - smoothstep(size * 180.0, size * 420.0, gRmT); }
// grime: darker into corners and low down, stains in blotches
fn rmGrime(q: vec3f, occ: f32) -> f32 {
  let st = vn3(q * vec3f(1.3, 0.7, 1.3), 940).x;
  return (0.55 + 0.45 * occ) * (0.82 + 0.3 * smoothstep(0.35, 0.7, st));
}
fn rmSurface(q: vec3f, n: vec3f, m: i32, k: i32, ld: vec3f, occ: f32) -> RmS {
  var s: RmS;
  s.alb = vec3f(0.3);
  s.emi = vec3f(0.0);
  s.spec = 0.1;
  s.refl = 0.0;
  s.bump = vec3f(0.0);
  let g = rmGrime(q, occ);
  switch m {
    case 1: {
      if (k == 3) {
        // flagstones, irregular, worn smooth where people stand
        let cell = floor(q.xz * vec2f(1.3, 1.6) + vec2f(floor(q.z * 1.6) * 0.5, 0.0));
        let fq = fract(q.xz * vec2f(1.3, 1.6) + vec2f(floor(q.z * 1.6) * 0.5, 0.0));
        let edge = min(min(fq.x, 1.0 - fq.x), min(fq.y, 1.0 - fq.y));
        let hv = hsh(i32(cell.x), i32(cell.y), 941);
        s.alb = mix(vec3f(0.14, 0.12, 0.11), vec3f(0.24, 0.2, 0.17), hv) * mix(0.35, 1.0, smoothstep(0.0, 0.05, edge));
        s.alb *= 0.85 + 0.3 * vn3(q * 3.0, 942).x;
        s.bump = vn3(q * 9.0, 943).yzw * 0.04;
        s.spec = 0.25; s.refl = 0.04;
      } else if (k == 2) {
        // tread plate, 1.2 m sheets, worn bright down the walkway
        let d = fract(vec2f(q.x + q.z, q.x - q.z) * 7.0) - 0.5;
        let dia = step(abs(d.x) + abs(d.y) * 3.0, 0.35);
        let seam = min(abs(fract(q.x / 1.2) - 0.5), abs(fract(q.z / 1.2) - 0.5));
        let wear = 1.0 - smoothstep(0.5, 2.2, abs(q.z + 0.4));
        s.alb = vec3f(0.14, 0.15, 0.16) * (0.8 + 0.4 * vn3(q * 2.0, 944).x) * mix(0.4, 1.0, step(0.006, 0.5 - seam));
        s.alb += vec3f(0.08) * dia * (0.3 + 0.7 * wear);
        s.spec = 0.6; s.refl = 0.12 + 0.2 * wear;
        s.bump = vec3f(0.0, 0.0, 0.0);
      } else {
        // planks: narrow boards, each its own tone and grain, dark in the gaps, the varnish worn where feet go
        let bw = select(0.11, 0.075, k == 4);
        var u2 = q.z;
        var v2 = q.x;
        if (k == 4) {
          // herringbone parquet
          let hb = floor(q.x / bw + floor(q.z / (bw * 4.0)));
          u2 = select(q.z, q.x, (i32(hb) & 1) == 0);
          v2 = select(q.x, q.z, (i32(hb) & 1) == 0);
        }
        let pi = floor(u2 / bw);
        let pv = hsh(i32(pi), 7, 945);
        let off = pv * 3.7;
        let seg = floor((v2 + off) / 2.4);
        let tone = hsh(i32(pi), i32(seg), 946);
        let grain = 0.5 + 0.5 * sin((v2 + off) * 3.0 + vn3(vec3f(u2 * 30.0, v2 * 1.5, 0.0), 947).x * 6.0 + u2 * 40.0);
        let gap = smoothstep(0.0, 0.006, min(fract(u2 / bw), 1.0 - fract(u2 / bw)) * bw) * smoothstep(0.0, 0.004, min(fract((v2 + off) / 2.4), 1.0 - fract((v2 + off) / 2.4)) * 2.4);
        var base = mix(vec3f(0.11, 0.06, 0.035), vec3f(0.2, 0.11, 0.06), tone);
        if (k == 4) { base = mix(vec3f(0.2, 0.11, 0.05), vec3f(0.3, 0.17, 0.08), tone); }
        let fp = rmFine(0.02);
        s.alb = base * (0.8 + 0.28 * mix(0.5, grain, fp)) * mix(0.25, 1.0, mix(0.85, gap, fp));
        let path = select(1.0 - smoothstep(0.3, 1.2, abs(q.z - 0.9)), 1.0 - smoothstep(0.0, 3.0, abs(length(q.xz - vec2f(12.0, 0.0)) - 3.0)), k == 4);
        s.alb *= 1.0 + 0.18 * path;
        s.spec = 0.35; s.refl = select(0.08, 0.2, k == 4) * (1.0 - 0.6 * path) * gap;
        s.bump = vec3f(0.0, 0.0, 0.03 * (grain - 0.5));
      }
      s.alb *= g;
    }
    case 2: {
      if (k == 2) {
        // riveted steel panels: pale green-grey over a darker band, stencils and patches
        let pu = select(q.x, q.z, abs(n.z) < 0.5);
        let seam = min(abs(fract(pu / 1.5) - 0.5), abs(fract(q.y / 1.2) - 0.5));
        let rv = length(vec2f(fract(pu / 0.25) - 0.5, (fract(q.y / 1.2 + 0.5) - 0.5) * 4.8)) ;
        s.alb = mix(vec3f(0.12, 0.14, 0.13), vec3f(0.36, 0.4, 0.37), step(1.1, q.y)) * (0.75 + 0.35 * vn3(q * 1.5, 948).x);
        s.alb *= mix(0.45, 1.0, step(0.012, 0.5 - seam));
        s.alb *= mix(0.7, 1.0, step(0.09, rv));
        s.spec = 0.35;
        // an Aster patch pinned every few metres: the cracked star on black
        let px = fract(pu / 4.3 + 0.3) * 4.3 - 2.15;
        let sq = vec2f(px, q.y - 1.75);
        if (abs(sq.x) < 0.14 && abs(sq.y) < 0.14 && abs(n.z) > 0.5) {
          let a = atan2(sq.y, sq.x);
          let rr = length(sq) / (1.0 + 0.5 * pow(abs(cos(a * 2.5)), 5.0));
          s.alb = select(vec3f(0.02), vec3f(0.75, 0.72, 0.6), rr < 0.07 && abs(sq.y - 0.3 * sq.x) > 0.006);
        }
      } else if (k == 1) {
        // oxblood plaster, darkened by the heater, water stains, a patch where it has fallen away to the brick
        s.alb = vec3f(0.24, 0.07, 0.05) * (0.8 + 0.35 * vn3(q * vec3f(0.9, 0.5, 0.9), 949).x);
        let stain = smoothstep(0.55, 0.8, vn3(q * vec3f(0.6, 0.25, 0.6) + vec3f(0.0, q.y * 0.3, 0.0), 950).x);
        s.alb = mix(s.alb, vec3f(0.13, 0.07, 0.04), stain * 0.7);
        s.alb *= mix(1.0, 0.55, smoothstep(2.2, 2.95, q.y));
        let fall = smoothstep(0.66, 0.7, vn3(q * 0.9 + vec3f(3.0), 951).x);
        if (fall > 0.0) {
          let yy = q.y / 0.075;
          let u3 = select(q.z, q.x, abs(n.x) < 0.5) / 0.22 + 0.5 * floor(yy);
          let mortar = min(abs(fract(yy) - 0.5), abs(fract(u3) - 0.5) * 0.34);
          s.alb = mix(s.alb, mix(vec3f(0.18, 0.15, 0.12), vec3f(0.3, 0.12, 0.07), step(0.03, 0.5 - mortar)), fall);
        }
        s.spec = 0.08;
      } else {
        s.alb = vec3f(0.3, 0.2, 0.14);
      }
      s.alb *= g;
    }
    case 3: {
      if (k == 1) {
        // pressed tin, brown with old fumes: a grid of raised squares with a boss in each
        let t = fract(q.xz / 0.6) - 0.5;
        let sq = max(abs(t.x), abs(t.y));
        let boss = length(t);
        let fz = rmFine(0.05);
        s.alb = vec3f(0.17, 0.13, 0.09) * (0.8 + 0.3 * vn3(q * 2.0, 952).x);
        s.alb *= 1.0 + fz * (0.18 * smoothstep(0.4, 0.46, sq) + 0.14 * sstepJ(0.17, 0.11, boss) - 0.12);
        s.spec = 0.3;
      } else if (k == 2) {
        s.alb = vec3f(0.07, 0.075, 0.09);
        let st = q.xz - vec2f(10.0, 0.0);
        let a = atan2(st.y, st.x);
        let rr = length(st) / (1.0 + 0.55 * pow(abs(cos(a * 2.5)), 6.0));
        let crack = abs(st.y - 0.25 * st.x - 0.12 * sin(st.x * 5.0)) < 0.05;
        if (rr < 1.9 && !crack) { s.alb = vec3f(0.8, 0.74, 0.55) * (0.75 + 0.3 * vn3(q * 4.0, 953).x); s.emi = vec3f(0.06, 0.05, 0.03); }
      } else {
        // the club's dome: a night sky, painted, stars in gold leaf, strings of bulbs between the ribs
        let cq = q - vec3f(12.0, -5.0, 0.0);
        let el = asin(clamp(cq.y / 16.57, -1.0, 1.0));
        let az = atan2(cq.z, cq.x);
        s.alb = mix(vec3f(0.05, 0.05, 0.1), vec3f(0.02, 0.02, 0.05), smoothstep(0.3, 1.2, el)) * (0.8 + 0.3 * vn3(q * 0.8, 954).x);
        let sp = vec2f(az * 30.0, el * 30.0);
        let si = floor(sp);
        let sf = fract(sp) - 0.5;
        if (hsh(i32(si.x), i32(si.y), 955) < 0.12 && length(sf) < 0.08) { s.alb = vec3f(0.8, 0.6, 0.25); s.spec = 0.9; }
        let ring = abs(fract(el * 5.0) - 0.5);
        let bulb = abs(fract(az * 11.0 * cos(el) + floor(el * 5.0) * 0.5) - 0.5);
        if (ring < 0.02 && bulb < 0.04 && q.y > 4.0) { s.emi = vec3f(1.0, 0.72, 0.38) * 3.0; }
        if (q.x > 20.5 && q.y < 6.5) {
          // the curtain behind the stand: deep folds of velvet, a sheen on each crest
          let f = sin(az * 90.0);
          s.alb = vec3f(0.3, 0.02, 0.04) * (0.4 + 0.6 * (0.5 + 0.5 * f));
          s.spec = 0.4 * smoothstep(0.7, 1.0, f);
          s.bump = vec3f(0.0, 0.0, cos(az * 90.0) * 0.4);
        }
      }
      s.alb *= g;
    }
    case 4: {
      // dark wood, polished: long grain, a deep gloss that takes the lamps
      let gr = 0.5 + 0.5 * sin(q.x * 5.0 + vn3(q * vec3f(1.0, 20.0, 20.0), 956).x * 5.0);
      s.alb = mix(vec3f(0.06, 0.03, 0.018), vec3f(0.14, 0.07, 0.035), gr) * g;
      s.spec = 0.7; s.refl = 0.22;
    }
    case 5: { s.alb = vec3f(0.5, 0.36, 0.14) * (0.8 + 0.3 * vn3(q * 12.0, 957).x); s.spec = 1.0; s.refl = 0.45; }
    case 6: {
      // bottle glass, lit from behind by the strip under the shelf: the colour glows through, a paper label on most
      let h = hsh(i32(floor(q.x * 5.9 + q.z * 5.9)), i32(floor(q.y * 2.5)), 958);
      let tint = select(select(vec3f(0.15, 0.4, 0.12), vec3f(0.45, 0.22, 0.05), h > 0.35), vec3f(0.5, 0.5, 0.55), h > 0.75);
      s.alb = tint * 0.25;
      s.emi = tint * 0.22 * (0.5 + 0.5 * smoothstep(0.0, 0.3, fract(q.y * 2.5)));
      let ly = fract(q.y * 2.5 - 0.1);
      if (ly > 0.2 && ly < 0.45 && fract(h * 13.0) > 0.25) { s.alb = mix(vec3f(0.7, 0.62, 0.45), hue3(fract(h * 7.0)) * 0.5, 0.4); s.emi = vec3f(0.0); }
      s.spec = 1.0; s.refl = 0.3;
    }
    case 7: {
      // the window, frosted at its edges
      let fr = sstepJ(0.35, 0.0, min(min(q.x - 1.9, 17.1 - q.x), min(q.y - 0.9, 3.4 - q.y)) ) * (0.6 + 0.4 * vn3(q * 6.0, 959).x);
      s.alb = vec3f(0.02);
      s.emi = rmWindowView(ld) * 1.4 + vec3f(0.12, 0.16, 0.22) * fr;
      s.refl = 0.1; s.spec = 1.0;
    }
    case 8: {
      s.alb = vec3f(0.2);
      s.emi = select(vec3f(1.0, 0.78, 0.5), vec3f(1.0, 0.85, 0.65), k == 2) * select(4.0, 2.5, k == 4);
      if (k == 4 && q.y < 1.0) { s.emi = vec3f(1.0, 0.7, 0.4) * 3.0; }
    }
    case 9: { s.alb = vec3f(0.2, 0.11, 0.06) * mix(0.5, 1.0, step(0.04, fract(q.x * 6.0))) * (0.8 + 0.3 * vn3(q * 4.0, 960).x) * g; s.spec = 0.3; s.refl = 0.06; }
    case 10: {
      // leather: cracked, shiny on the crowns
      let cr = vn3(q * 28.0, 961);
      s.alb = select(select(vec3f(0.2, 0.04, 0.03), vec3f(0.08, 0.14, 0.16), k == 2), vec3f(0.12, 0.05, 0.03), k == 3) * (0.75 + 0.4 * cr.x) * g;
      s.spec = 0.6; s.refl = 0.06;
      s.bump = cr.yzw * 0.01;
    }
    case 11: {
      // brick: courses 7.5 cm high, each brick its own colour, the mortar set back; soot at the crown, damp below
      let yy = q.y / 0.075;
      let u2 = select(q.z, q.x, abs(n.x) < 0.5) / 0.22 + 0.5 * floor(yy);
      let mortar = min(abs(fract(yy) - 0.5), abs(fract(u2) - 0.5) * 0.34);
      let bh = hsh(i32(floor(u2)), i32(floor(yy)), 962);
      let brick = mix(vec3f(0.3, 0.1, 0.05), vec3f(0.42, 0.2, 0.1), bh) * (0.75 + 0.35 * vn3(q * 8.0, 963).x);
      s.alb = mix(mix(vec3f(0.16, 0.14, 0.12), brick, 0.8), brick, mix(0.8, step(0.03, 0.5 - mortar), rmFine(0.03)));
      s.alb *= mix(1.0, 0.35, smoothstep(2.3, 3.2, q.y));
      let damp = sstepJ(0.6, 0.0, q.y + 0.4 * vn3(q * 2.0, 964).x);
      s.alb *= 1.0 - 0.35 * damp;
      s.spec = 0.1 + 0.5 * damp; s.refl = 0.05 * damp;
      s.bump = vec3f(0.0, (0.5 - fract(yy)) * 0.3, 0.0) * step(0.5 - mortar, 0.03);
      s.alb *= g;
    }
    case 12: { s.alb = vec3f(0.12); s.emi = vec3f(1.0, 0.32, 0.06) * (1.3 + 0.3 * sin(u.time * 1.7)) * step(0.35, fract(q.y * 9.0)); }
    case 13: {
      // chalk on a slate: rows of prices, rubbed out and written over
      s.alb = vec3f(0.035, 0.04, 0.038);
      let row = fract(q.y * 7.0);
      let ch = hsh(i32(floor(q.x * 22.0)), i32(floor(q.y * 7.0)), 965);
      if (row > 0.3 && row < 0.72 && ch > 0.3) { s.alb = vec3f(0.62, 0.62, 0.58) * (0.6 + 0.4 * vn3(q * 60.0, 966).x); }
      s.alb += vec3f(0.04) * smoothstep(0.5, 0.9, vn3(q * 3.0, 967).x);
    }
    case 14: { s.alb = vec3f(0.02, 0.018, 0.02); s.spec = 1.0; s.refl = 0.3; }
    case 15: {
      // panelling: raised panels in dark stained wood with a moulded edge
      let pu = select(q.z, q.x, abs(n.x) < 0.5);
      let pf = abs(fract(pu / 0.6) - 0.5);
      let py = abs(q.y - 0.53) / 0.45;
      let edge = smoothstep(0.42, 0.45, max(pf, py * 0.5));
      s.alb = vec3f(0.08, 0.04, 0.022) * (0.8 + 0.35 * vn3(q * vec3f(4.0, 30.0, 4.0), 968).x) * (1.0 - 0.35 * edge) * g;
      s.bump = vec3f(0.0, 0.0, 0.0);
      s.spec = 0.5; s.refl = select(0.1, 0.0, q.y > 2.5);
      if (q.y > 2.8) { s.alb = vec3f(0.1, 0.06, 0.035) * g; s.spec = 0.1; }
    }
    case 16: { s.alb = vec3f(0.04, 0.045, 0.05) * (0.7 + 0.3 * vn3(q * 5.0, 969).x); s.spec = 1.0; s.refl = 0.75 - 0.4 * smoothstep(0.55, 0.8, vn3(q * 2.0, 970).x); }
    case 17: { s.alb = vec3f(0.3, 0.31, 0.32) * (0.75 + 0.3 * vn3(q * 6.0, 971).x) * g; s.spec = 0.8; s.refl = 0.25; }
    case 18: { s.alb = vec3f(0.3, 0.05, 0.03); s.emi = vec3f(1.0, 0.18, 0.1) * 2.2 * (0.92 + 0.08 * step(0.5, fract(u.time * 7.3 + q.x * 0.1))); }
    case 19: {
      // the jukebox: walnut with bubbling colour tubes in its face
      s.alb = vec3f(0.12, 0.05, 0.025);
      s.spec = 0.8; s.refl = 0.2;
      if (q.x < 8.6) {
        let band = fract(q.y * 3.0 + q.z * 0.5);
        s.emi = hue3(fract(q.y * 0.4 + u.time * 0.05)) * 1.6 * step(0.6, band) + vec3f(1.0, 0.7, 0.3) * 0.6 * step(band, 0.1);
      }
    }
    case 21: {
      // an enamel shade: green outside, white inside where the bulb lights it
      let inside = step(0.0, -n.y);
      s.alb = mix(select(vec3f(0.05, 0.18, 0.1), vec3f(0.35, 0.03, 0.03), k == 4), vec3f(0.85, 0.82, 0.75), inside);
      s.emi = vec3f(1.0, 0.8, 0.55) * 1.2 * inside;
      s.spec = 0.9; s.refl = 0.15;
    }
    case 22: {
      // lantern paper: lit through, brighter in the middle, the ribs darker, and a few of them another colour
      let hh = hsh(i32(floor(q.x / 2.2 + 0.5)), i32(floor(q.z / 2.1 + 0.5)), 972);
      let col = select(vec3f(0.9, 0.12, 0.04), select(vec3f(1.0, 0.38, 0.06), vec3f(0.95, 0.75, 0.45), hh > 0.9), hh > 0.65);
      let a = atan2(q.z, q.x);
      s.alb = col * 0.3;
      s.emi = col * 0.9 * (0.75 + 0.25 * abs(sin(a * 8.0 + 1.5)));
    }
    case 23: {
      // pictures and posters: a frame round a print of blocks and lines, faded
      let ph = hsh(i32(floor(q.x * 1.3)), i32(floor(q.y * 1.1)), 973);
      let pu = select(q.z, q.x, abs(n.x) < 0.5);
      let blocks = hue3(fract(ph + floor(pu * 3.0) * 0.21 + floor(q.y * 4.0) * 0.13)) * 0.35 + 0.1;
      s.alb = mix(blocks, vec3f(0.5, 0.42, 0.3) * (0.7 + 0.3 * sin(q.y * 60.0)), select(0.2, 0.8, k == 1)) * 0.7;
      s.spec = 0.4; s.refl = select(0.0, 0.2, k == 1);
    }
    case 24: { s.alb = vec3f(0.02, 0.03, 0.05); s.emi = vec3f(0.25, 0.45, 0.9) * 1.6; s.refl = 0.3; s.spec = 1.0; }
    case 25: {
      if (k == 3) {
        let ch = step(0.5, fract(q.x * 8.0)) + step(0.5, fract(q.z * 8.0));
        s.alb = mix(vec3f(0.55, 0.52, 0.46), vec3f(0.45, 0.05, 0.04), step(0.5, fract(ch * 0.5)) * 0.8);
      } else { s.alb = vec3f(0.7, 0.68, 0.62) * (0.9 + 0.1 * vn3(q * 20.0, 974).x); }
      s.alb *= g;
      s.spec = 0.05;
    }
    case 26: { s.alb = vec3f(0.5); s.emi = vec3f(1.0, 0.65, 0.25) * 8.0; }
    case 27: {
      // a worn rug: a border and a field of medallions, the pile rubbed through in the middle
      let ru = abs(q.xz - vec2f(12.3, 0.4)) / vec2f(1.1, 1.6);
      let border = step(0.85, max(ru.x, ru.y));
      let med = 0.5 + 0.5 * sin(q.x * 18.0) * sin(q.z * 14.0);
      s.alb = mix(mix(vec3f(0.28, 0.05, 0.04), vec3f(0.35, 0.22, 0.08), med * 0.6), vec3f(0.06, 0.08, 0.16), border) * (0.7 + 0.35 * vn3(q * 25.0, 975).x);
      s.alb *= mix(0.7, 1.0, smoothstep(0.0, 0.5, max(ru.x, ru.y)));
    }
    case 28: {
      // the departures screen: rows of green text, one blinking
      s.alb = vec3f(0.01);
      let row = floor(q.y * 9.0);
      let ch = hsh(i32(floor(q.z * 26.0)), i32(row), 976);
      let on = step(0.35, fract(q.y * 9.0)) * step(fract(q.y * 9.0), 0.75) * step(0.3, ch);
      s.emi = vec3f(0.25, 1.0, 0.45) * on * select(1.3, 1.3 * step(0.5, fract(u.time)), row == 27.0);
    }
    case 29: { s.alb = vec3f(0.55, 0.4, 0.12) * (0.8 + 0.2 * sin(length(q.xz) * 200.0)); s.spec = 1.0; s.refl = 0.35; }
    case 30: { s.alb = vec3f(0.18, 0.19, 0.2) * (0.7 + 0.35 * vn3(q * 3.0, 977).x) * g; s.spec = 0.6; s.refl = 0.12; }
    case 31: { s.alb = vec3f(0.75, 0.72, 0.65); s.spec = 0.7; s.refl = 0.1; }
    case 32: { let tq = hsh(i32(floor(q.x / 0.36 + 0.5)), 1, 978); s.alb = select(vec3f(0.02), hue3(tq) * 0.5, q.y > 1.55); s.spec = 0.9; s.refl = 0.2; }
    case 33: { s.alb = vec3f(0.26, 0.11, 0.04) * (0.75 + 0.25 * sin(q.y * 80.0 + vn3(q * 20.0, 979).x * 4.0)); s.spec = 0.9; s.refl = 0.2; }
    case 34: {
      // the bar front: vertical tongue-and-groove boards
      let sl = abs(fract(select(q.x, q.z, abs(n.z) < 0.5) / 0.09) - 0.5);
      s.alb = vec3f(0.1, 0.05, 0.03) * mix(0.45, 1.0, sstepJ(0.44, 0.4, sl)) * (0.8 + 0.3 * vn3(q * vec3f(4.0, 40.0, 4.0), 980).x) * g;
      s.spec = 0.5; s.refl = 0.08;
    }
    case 36: { s.alb = vec3f(0.35, 0.18, 0.03); s.emi = vec3f(0.2, 0.1, 0.02); s.spec = 1.0; s.refl = 0.2; }
    case 37: {
      // the glitterball: small mirror facets, a few catching the light and flashing
      let dv = normalize(q - RM_BALL);
      let rot = u.time * 0.35;
      let dr = vec3f(dv.x * cos(rot) - dv.z * sin(rot), dv.y, dv.x * sin(rot) + dv.z * cos(rot));
      let cl = i32(round(acos(clamp(dr.y, -1.0, 1.0)) / 0.1));
      let co = i32(round(atan2(dr.z, dr.x) / 0.1));
      let fh = hsh(cl, co, 956);
      let grout = step(0.42, abs(fract(acos(clamp(dr.y, -1.0, 1.0)) / 0.1) - 0.5)) + step(0.42, abs(fract(atan2(dr.z, dr.x) / 0.1) - 0.5));
      s.alb = mix(vec3f(0.18 + 0.12 * fh), vec3f(0.03), min(grout, 1.0));
      s.spec = 1.0;
      s.refl = 0.7 * (1.0 - min(grout, 1.0));
      s.emi = vec3f(1.0, 0.95, 0.9) * 4.0 * step(0.9, hsh(cl, co + i32(floor(u.time * 5.0)) * 131, 957)) * (1.0 - min(grout, 1.0));
    }
    default: {}
  }
  return s;
}
// the room's shading of one hit: the lamps, soft shadow, occlusion, a gloss sheen for each lamp
fn rmShade(q: vec3f, n0: vec3f, m: f32, k: i32, ld: vec3f, shadowed: bool) -> array<vec3f, 3> {
  let occ = rmAO(q, n0, k);
  let sf = rmSurface(q, n0, i32(m + 0.5), k, ld, occ);
  let n = normalize(n0 + sf.bump);
  var col = sf.alb * rmLit(q, n, k, occ, shadowed) + sf.emi;
  for (var i = 0; i < 3; i++) {
    let Ld = rmLight(k, i);
    let hv = normalize(normalize(Ld[0] - q) - ld);
    col += Ld[1] * sf.spec * 0.045 * pow(max(dot(n, hv), 0.0), 60.0) / (1.0 + 0.2 * dot(Ld[0] - q, Ld[0] - q));
  }
  return array<vec3f, 3>(col, n, vec3f(sf.refl, 0.0, 0.0));
}
// smoke: slow layered drifts, so the beams show swirls rather than an even glow
fn rmSmoke(sp: vec3f) -> f32 {
  return 0.3 + 1.4 * vn3(sp * vec3f(0.9, 1.7, 0.9) + vec3f(u.time * 0.12, u.time * 0.03, -u.time * 0.07), 951).x;
}
fn rmTrace(ro: vec3f, rd: vec3f, k: i32, steps: i32, tMax: f32) -> vec2f {
  var t = 0.015;
  for (var i = 0; i < steps; i++) {
    let r = rmMap(ro + rd * t, k);
    if (r.x < 0.0006 * t + 0.0008) { return vec2f(t, r.y); }
    t += r.x * 0.9;
    if (t > tMax) { break; }
  }
  return vec2f(t, -1.0);
}
fn roomRender(ro: vec3f, rd: vec3f, px: vec2f) -> vec4f {
  let k = ROOM_K;
  let lo = rmLocal(ro);
  let ld = rmLocalDir(rd);
  gRmJ = hsh(i32(px.x) * 3 + 1, i32(px.y), i32(u.frame) + 41);
  let h = rmTrace(lo, ld, k, 140, 60.0);
  let t = h.x;
  // the Cold Tap is thicker than it was (0.032): owner, September 2026, "maybe thicker fog?"
  let hazeK = select(select(select(select(0.032, 0.042, k == 1), 0.03, k == 2), 0.05, k == 3), 0.028, k == 4);
  let haze = select(select(select(vec3f(0.07, 0.035, 0.025), vec3f(0.03, 0.04, 0.06), k == 2), vec3f(0.12, 0.05, 0.03), k == 3), vec3f(0.07, 0.05, 0.06), k == 4);
  var col = haze;
  if (h.y >= 0.0) {
    let q = lo + ld * t;
    gRmT = t;
    let sh = rmShade(q, rmNormal(q, k), h.y, k, ld, true);
    col = sh[0];
    let n = sh[1];
    // one bounce off the glossy things (bar tops, mirror, brass, varnish, the tread plate), for the lamps in them
    let rf = sh[2].x;
    if (rf > 0.02) {
      let fres = rf + (1.0 - rf) * pow(1.0 - clamp(dot(-ld, n), 0.0, 1.0), 5.0) * 0.6;
      let jit = (vec3f(hsh(i32(px.x), i32(px.y), i32(u.frame)), hsh(i32(px.y), i32(px.x), i32(u.frame) + 7), hsh(i32(px.x) + 3, i32(px.y), i32(u.frame) + 9)) - 0.5) * (0.08 * (1.0 - rf));
      let r2 = normalize(reflect(ld, n) + jit);
      let h2 = rmTrace(q + n * 0.012, r2, k, 60, 16.0);
      var rc = haze;
      if (h2.y >= 0.0) {
        let q2 = q + n * 0.012 + r2 * h2.x;
        gRmT = t + h2.x * 2.0;
        let s2 = rmShade(q2, rmNormal(q2, k), h2.y, k, r2, false);
        rc = mix(haze, s2[0], exp(-h2.x * hazeK));
      }
      col = mix(col, rc, clamp(fres, 0.0, 0.85));
    }
  }
  // haze, and light beams in it: sample along the ray, adding what each beam's cone scatters toward the eye
  col = mix(haze, col, exp(-min(t, 60.0) * hazeK));
  var beams = vec3f(0.0);
  var ice = 0.0;
  let tb = min(t, 30.0);
  let j0 = hsh(i32(px.x), i32(px.y), i32(u.frame) + 31);
  // the Cold Tap's fan has its own samples in the smoke (rmFanFog), after this loop
  let ns = 10;
  let smoky = k == 1 || k == 3;
  for (var s = 0; s < ns; s++) {
    let sp = lo + ld * (tb * (f32(s) + j0) / f32(ns));
    var smoke = 1.0;
    if (smoky) { smoke = rmSmoke(sp); }
    for (var b = 0; b < 3; b++) {
      let B = rmBeam(k, b);
      if (B[1].w > 1.5 || (k == 1 && b == 2)) { continue; }
      let v = sp - B[0].xyz;
      let dl = length(v);
      let cs = dot(v / max(dl, 1e-3), B[1].xyz);
      var bl = B[2].xyz * smoothstep(B[1].w, B[1].w + 0.06, cs) / (1.0 + dl * dl * select(0.35, B[0].w, B[0].w > 0.0));
      beams += bl * smoke;
    }
    // dry ice: a low, rolling layer on the club's floor near the stand and across the cellar's stage end
    if (k >= 3) {
      let base = select(0.0, 0.7, (k == 4 && sp.x > 21.6) || (k == 3 && sp.x > 9.5));
      let near = select(smoothstep(4.0, 9.0, sp.x), smoothstep(15.0, 20.0, sp.x), k == 4);
      ice += exp(-max(sp.y - base, 0.0) / 0.4) * near * (0.3 + vn3(sp * 1.4 + vec3f(-u.time * 0.25, 0.0, u.time * 0.08), 952).x);
    }
  }
  col += beams * tb / f32(ns) * hazeK * select(3.0, 5.0, k == 3);
  if (k == 1) { col += rmFanFog(lo, ld, tb, j0) * hazeK * 3.0; }
  if (k >= 3) {
    let Bd = rmBand();
    let iceC = mix(vec3f(0.5, 0.45, 0.5), rmStageCol(floor(Bd.z / 2.0) + f32(k)), 0.55) * select(0.06, 0.09, k == 4);
    col = mix(col, iceC * 3.0, clamp(ice * tb / f32(ns) * select(0.3, 0.2, k == 4), 0.0, 0.55));
  }
  if (k == 4) { col += rmLasers(lo, ld, t); }
  col = propsFx(ro, rd, t, col);
  return vec4f(max(col, vec3f(0.0)), t);
}

@fragment fn roomScene(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let px = primaryPx(fc);
  return roomRender(u.camPos, primaryDir(px), px);
}
