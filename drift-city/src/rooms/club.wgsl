// the club's glitterball hangs at the top of the dome
const RM_BALL = vec3f(12.0, 7.4, 0.0);
// the glitterball's spots: the direction from the ball, turned with it, cut into facets; one facet in two or so
// catches the follow-spots and throws a small spot wherever that direction lands
fn rmBallSpots(q: vec3f) -> f32 {
  let dv = normalize(q - RM_BALL);
  let rot = u.time * 0.35;
  let dr = vec3f(dv.x * cos(rot) - dv.z * sin(rot), dv.y, dv.x * sin(rot) + dv.z * cos(rot));
  let lat = acos(clamp(dr.y, -1.0, 1.0));
  let gl = lat / 0.1;
  let go = atan2(dr.z, dr.x) / 0.1;
  let cl = round(gl);
  let co = round(go);
  let d = length(vec2f(gl - cl, (go - co) * max(sin(lat), 0.2)));
  let on = step(0.45, hsh(i32(cl), i32(co), 955));
  return on * (1.0 - smoothstep(0.1, 0.2, d));
}
// lasers from the lip of the stand, fanning and sweeping, green and red, in the second half of each eight bars
fn rmLasers(o: vec3f, d: vec3f, tHit: f32) -> vec3f {
  let B = rmBand();
  let on = B.x * step(4.0, B.z - 8.0 * floor(B.z / 8.0));
  if (on < 0.5) { return vec3f(0.0); }
  var c = vec3f(0.0);
  let src = vec3f(21.9, 2.2, 0.0);
  for (var i = 0; i < 6; i++) {
    let fi = f32(i);
    let yaw = 3.14159 + (fi - 2.5) * 0.2 + 0.35 * sin(u.time * 0.6 + fi * 0.3);
    let el = 0.04 + 0.16 * (0.5 + 0.5 * sin(u.time * 0.9 + fi * 1.3));
    let L = vec3f(cos(yaw) * cos(el), sin(el), sin(yaw) * cos(el));
    let w = o - src;
    let b = dot(d, L);
    let dd = dot(d, w);
    let e = dot(L, w);
    let den = max(1.0 - b * b, 1e-4);
    let t = (b * e - dd) / den;
    let sl = (e - b * dd) / den;
    if (t < 0.0 || t > tHit || sl < 0.0 || sl > 28.0) { continue; }
    let dist = length(w + d * t - L * sl);
    let wd = 0.004 + 0.0012 * t;
    let lc = select(vec3f(0.2, 1.0, 0.3), vec3f(1.0, 0.15, 0.2), (i & 1) == 1);
    c += lc * exp(-dist * dist / (wd * wd)) * (0.004 / wd) * 5.0 * (0.6 + 0.6 * B.y);
  }
  return c;
}

// the Warmhouse club: a round room under a ribbed dome painted as a night sky, strings of bulbs, a parquet floor
// polished by dancing, tables in white cloths with little red lamps, a velvet curtain and footlights at the stand.
fn rmClub(q: vec3f) -> vec2f {
  let cq = q - vec3f(12.0, -5.0, 0.0);
  let dome = length(cq) - 16.57;
  var r = vec2f(-dome, select(3.0, 1.0, q.y < 0.02));
  // gilt ribs up the dome
  let az = atan2(cq.z, cq.x);
  let ra = (fract(az / 0.3491 + 0.5) - 0.5) * 0.3491 * length(cq.xz);
  r = rmU(r, vec2f(max(abs(ra) - 0.07, -dome - 0.14), 5.0));
  // the glitterball on its cord from the top of the dome
  r = rmU(r, vec2f(length(q - RM_BALL) - 0.38, 37.0));
  r = rmU(r, vec2f(sdSeg(q, RM_BALL, vec3f(12.0, 11.6, 0.0)) - 0.008, 5.0));
  // the stand, footlights along its lip, the band's things
  let sq = q - vec3f(24.0, 0.0, 0.0);
  r = rmU(r, vec2f(max(sdCyl(sq, 6.2, 0.0, 0.7), -sq.x - 2.4), 9.0));
  if (q.x > 20.0) {
    let fa = atan2(sq.z, sq.x);
    let fl = vec3f(length(sq.xz) - 6.15, q.y - 0.72, (fract(fa / 0.12 + 0.5) - 0.5) * 0.12 * 6.15);
    r = rmU(r, vec2f(max(length(fl) - 0.035, -sq.x - 2.4), 8.0));
    r = rmU(r, vec2f(sdBox(q - vec3f(25.0, 1.25, -2.8), vec3f(0.35, 0.55, 0.8)) - 0.01, 14.0));
    r = rmU(r, vec2f(sdBox(q - vec3f(24.62, 1.18, -2.8), vec3f(0.06, 0.02, 0.7)), 31.0));
    r = rmU(r, rmDrums(q, vec3f(24.8, 0.7, 2.6)));
    r = rmU(r, rmBass(q, vec3f(23.4, 0.7, 0.9)));
    r = rmU(r, vec2f(min(sdSeg(q, vec3f(21.3, 0.7, -0.5), vec3f(21.3, 2.2, -0.5)) - 0.01, length(q - vec3f(21.26, 2.24, -0.5)) - 0.03), 17.0));
  }
  // tables in two rings, each in a white cloth with a small red-shaded lamp
  let cz = q.xz - vec2f(12.0, 0.0);
  let a = atan2(cz.y, cz.x);
  let ai = round(a / 6.2832 * 10.0);
  if (abs(ai) >= 1.5 && length(cz) < 9.5) {
    let aa = ai / 10.0 * 6.2832;
    let tq = vec2f(cos(aa), sin(aa)) * 7.8;
    let p = vec3f(cz.x, q.y, cz.y);
    r = rmU(r, rmTable(p, tq, true));
    r = rmU(r, rmPendant(p - vec3f(tq.x, 0.0, tq.y), vec3f(0.0, 0.9, 0.0), 0.9));
    r = rmU(r, vec2f(sdCyl(p - vec3f(tq.x, 0.0, tq.y), 0.012, 0.76, 0.95), 5.0));
  }
  let ai2 = round(a / 6.2832 * 14.0 + 0.5) - 0.5;
  if (abs(ai2) >= 2.0 && length(cz) > 9.5) {
    let aa = ai2 / 14.0 * 6.2832;
    let tq = vec2f(cos(aa), sin(aa)) * 12.0;
    let p = vec3f(cz.x, q.y, cz.y);
    r = rmU(r, rmTable(p, tq, true));
    r = rmU(r, rmPendant(p - vec3f(tq.x, 0.0, tq.y), vec3f(0.0, 0.9, 0.0), 0.9));
    r = rmU(r, vec2f(sdCyl(p - vec3f(tq.x, 0.0, tq.y), 0.012, 0.76, 0.95), 5.0));
  }
  return r;
}
