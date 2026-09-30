// the Cold Tap: a narrow old bar. Oxblood plaster over dark panelling, a pressed-tin ceiling browned by decades of
// heater fumes, a long bar with a brass rail and taps, a mirrored back bar full of odd bottles, green-shaded lamps,
// a jukebox glowing in the corner, and the airlock at the far end with a porthole onto the blue street.
// ---------- noir and disco: the Cold Tap's fan, the club's glitterball and lasers, smoke and dry ice ----------
// All cheap by construction: the fan's shadow is found by projecting a point onto the fan's disc from the lamp above
// it (no shadow march), the glitterball's spots are a pattern on the sphere of directions round the ball, a laser is
// the closest approach between the view ray and a line, smoke and dry ice are noise on the haze samples already taken.
const RM_FAN = vec3f(4.6, 2.6, -0.7);
const RM_FANL = vec3f(4.6, 3.34, -0.7);
fn rmFanRot() -> f32 { return u.time * 2.3; }
fn rmFan(q: vec3f) -> vec2f {
  let p = q - RM_FAN;
  let bb = sdBox(p - vec3f(0.0, 0.2, 0.0), vec3f(0.68, 0.24, 0.68));
  if (bb > 0.05) { return vec2f(bb, 9.0); }
  var r = vec2f(sdSeg(p, vec3f(0.0), vec3f(0.0, 0.42, 0.0)) - 0.013, 5.0);
  r = rmU(r, vec2f(sdEll(p, vec3f(0.1, 0.05, 0.1)), 5.0));
  let sec = 1.2566371;
  let a = atan2(p.z, p.x) - rmFanRot();
  let ai = a - sec * round(a / sec);
  let rr = length(p.xz);
  let bp = vec3f(rr * cos(ai), p.y + 0.02 * sin(ai * 8.0), rr * sin(ai));
  r = rmU(r, vec2f(sdBox(bp - vec3f(0.38, -0.01, 0.0), vec3f(0.25, 0.006, 0.055)) - 0.003, 9.0));
  return r;
}
// 1 where the fan's lamp reaches a point, less in the blades' and the hub's shadow; the penumbra widens further down
fn rmFanMask(p: vec3f) -> f32 {
  let L = RM_FANL;
  let dl = normalize(p - L);
  let cone = smoothstep(0.5, 0.62, -dl.y);
  if (p.y > RM_FAN.y - 0.01) { return cone; }
  let sc = (L.y - RM_FAN.y) / (L.y - p.y);
  let c = L.xz + (p.xz - L.xz) * sc - RM_FAN.xz;
  let r = length(c);
  let soft = 0.01 + 0.035 * (1.0 - sc);
  let sec = 1.2566371;
  let a = atan2(c.y, c.x) - rmFanRot();
  let ai = a - sec * round(a / sec);
  let across = abs(r * sin(ai));
  let along = r * cos(ai);
  let blade = (1.0 - smoothstep(0.055, 0.055 + soft, across)) * smoothstep(0.12, 0.12 + soft, along) * (1.0 - smoothstep(0.63, 0.63 + soft, along));
  let hub = 1.0 - smoothstep(0.1, 0.1 + soft, r);
  return cone * (1.0 - 0.93 * max(blade, hub));
}

fn rmColdTap(q: vec3f) -> vec2f {
  // the room, and a round lightwell in the ceiling over the fan with a lamp at its top
  let well = max(length(q.xz - RM_FAN.xz) - 0.45, abs(q.y - 3.2) - 0.22);
  let s = -min(sdBox(q - vec3f(3.75, 1.5, 0.0), vec3f(5.55, 1.5, 3.5)), well);
  var m = 2.0;
  if (q.y < 0.02) { m = 1.0; } else if (q.y > 2.98) { m = 3.0; } else if (q.y < 1.05) { m = 15.0; }
  if (q.z > 3.45 && q.y > 1.2 && q.y < 2.45 && q.x > 1.0 && q.x < 8.2) { m = 16.0; }
  var r = vec2f(s, m);
  r = rmU(r, vec2f(max(length(q.xz - RM_FAN.xz) - 0.16, abs(q.y - 3.41) - 0.012), 26.0));
  r = rmU(r, rmFan(q));
  // dado rail and a crown moulding along every wall
  r = rmU(r, vec2f(max(s - 0.035, abs(q.y - 1.07) - 0.028), 4.0));
  r = rmU(r, vec2f(max(s - 0.07, abs(q.y - 2.92) - 0.06), 15.0));
  // the bar: slatted front, dark body, a thick top with a brass bullnose; a foot rail on posts
  if (q.z > 1.4 && q.x > 0.6 && q.x < 8.6) {
    r = rmU(r, vec2f(sdBox(q - vec3f(4.6, 0.52, 2.35), vec3f(3.6, 0.52, 0.4)), 34.0));
    r = rmU(r, vec2f(sdBox(q - vec3f(4.6, 1.09, 2.2), vec3f(3.72, 0.035, 0.5)) - 0.005, 4.0));
    r = rmU(r, vec2f(rmCapX(q - vec3f(0.0, 1.08, 1.72), 0.9, 8.3, 0.04), 5.0));
    r = rmU(r, vec2f(rmCapX(q - vec3f(0.0, 0.22, 1.66), 0.9, 8.3, 0.022), 5.0));
    let px = rmRep(q.x, 1.0, 1.2, 7.0);
    r = rmU(r, vec2f(sdSeg(vec3f(px, q.y, q.z), vec3f(0.0, 0.0, 1.66), vec3f(0.0, 0.22, 1.66)) - 0.014, 5.0));
    // beer taps: brass columns, black handles with a coloured top
    if (q.y > 1.1 && q.y < 1.75 && q.z > 2.1 && q.z < 2.45) {
      let tx = rmRep(q.x, 3.2, 0.36, 4.0);
      let tp = vec3f(tx, q.y, q.z - 2.3);
      r = rmU(r, vec2f(sdCyl(tp, 0.028, 1.12, 1.4), 5.0));
      r = rmU(r, vec2f(sdSeg(tp, vec3f(0.0, 1.38, 0.0), vec3f(0.0, 1.33, -0.09)) - 0.014, 5.0));
      r = rmU(r, vec2f(sdSeg(tp, vec3f(0.0, 1.42, 0.0), vec3f(0.0, 1.62, 0.02)) - 0.018, 32.0));
    }
    // a few glasses left on the bar
    let gx = rmRep(q.x, 1.8, 1.55, 4.0);
    r = rmU(r, vec2f(max(abs(length(vec2f(gx, q.z - 1.95)) - 0.038 - 0.004 * (q.y - 1.125)) - 0.003, max(1.125 - q.y, q.y - 1.28)), 6.0));
    r = rmU(r, vec2f(sdCyl(vec3f(gx, q.y, q.z - 1.95), 0.035, 1.13, 1.23 - 0.05 * rmIdx(q.x, 1.8, 1.55, 4.0) * 0.3), 36.0));
  }
  // the back bar: a cabinet, shelves in front of the mirror, a light strip under each, the bottles
  if (q.z > 2.7) {
    r = rmU(r, vec2f(sdBox(q - vec3f(4.6, 0.5, 3.25), vec3f(3.8, 0.5, 0.25)), 4.0));
    let si = clamp(round((q.y - 1.45) / 0.4), 0.0, 2.0);
    let sy = q.y - 1.45 - 0.4 * si;
    r = rmU(r, vec2f(sdBox(vec3f(q.x - 4.6, sy, q.z - 3.28), vec3f(3.6, 0.014, 0.2)), 6.0));
    r = rmU(r, vec2f(sdBox(vec3f(q.x - 4.6, sy + 0.022, q.z - 3.1), vec3f(3.6, 0.006, 0.01)), 8.0));
    r = rmU(r, vec2f(rmBottles(q.x, q.y, q.z - 3.3, 1.0, 42.0, 1.45), 6.0));
  }
  // stools along the bar
  if (q.z > 0.9 && q.z < 1.7) { r = rmU(r, rmStool(vec3f(rmRep(q.x, 1.7, 0.95, 7.0), q.y, q.z), vec2f(0.0, 1.3))); }
  // booths on the left: tables, leather benches against the panelling, framed photographs above
  if (q.z < -1.9) {
    let bx = rmRep(q.x, 2.2, 3.2, 2.0);
    r = rmU(r, rmTable(vec3f(bx, q.y, q.z), vec2f(0.0, -2.75), false));
    r = rmU(r, vec2f(sdBox(vec3f(bx, q.y - 0.24, q.z + 3.22), vec3f(1.1, 0.24, 0.26)) - 0.03, 10.0));
    r = rmU(r, vec2f(sdBox(vec3f(bx, q.y - 0.75, q.z + 3.42), vec3f(1.1, 0.34, 0.06)) - 0.03, 10.0));
    let fx = rmRep(q.x, 0.6, 0.72, 11.0);
    let fi = rmIdx(q.x, 0.6, 0.72, 11.0);
    let fh = 0.18 + 0.12 * hsh(i32(fi), 2, 932);
    r = rmU(r, vec2f(sdBox(vec3f(fx, q.y - 1.72 - 0.1 * hsh(i32(fi), 3, 933), q.z + 3.49), vec3f(0.2, fh, 0.02)), 23.0));
  }
  // the price board, the neon glass on the wall, the heater, the jukebox in the corner
  r = rmU(r, vec2f(sdBox(q - vec3f(4.0, 2.05, -3.47), vec3f(0.9, 0.34, 0.03)), 13.0));
  {
    let w = vec2f(q.x - 7.2, q.y - 1.95);
    let glass = abs(max(abs(w.x) - (0.16 + 0.05 * (w.y + 0.3) / 0.6), abs(w.y) - 0.3)) - 0.0;
    let foam = abs(length(w - vec2f(0.0, 0.34)) - 0.12);
    let tube = min(glass, max(foam, 0.3 - w.y));
    r = rmU(r, vec2f(length(vec2f(tube, q.z + 3.43)) - 0.012, 18.0));
  }
  r = rmU(r, vec2f(sdBox(q - vec3f(9.15, 0.8, -2.3), vec3f(0.12, 0.45, 0.5)) - 0.02, 12.0));
  {
    let j = q - vec3f(8.85, 0.0, 2.95);
    let jb = min(sdBox(j - vec3f(0.0, 0.62, 0.0), vec3f(0.3, 0.62, 0.33)), max(length(j.yz - vec2f(1.24, 0.0)) - 0.33, abs(j.x) - 0.3)) - 0.02;
    r = rmU(r, vec2f(jb, 19.0));
  }
  // the airlock: a riveted ring, the door, its wheel, a porthole of cold street light
  {
    let hq = q - vec3f(9.3, 1.12, 0.3);
    r = rmU(r, vec2f(rmTorusX(hq, 0.86, 0.075), 30.0));
    let ra = atan2(hq.z, hq.y);
    let ri = round(ra / 0.3927) * 0.3927;
    r = rmU(r, vec2f(length(hq - vec3f(-0.07, cos(ri) * 0.86, sin(ri) * 0.86)) - 0.022, 5.0));
    r = rmU(r, vec2f(max(length(hq.yz) - 0.8, abs(hq.x + 0.02) - 0.03), 30.0));
    r = rmU(r, vec2f(rmTorusX(hq + vec3f(0.07, 0.35, 0.0), 0.16, 0.014), 5.0));
    r = rmU(r, vec2f(max(length(hq.yz - vec2f(0.28, 0.0)) - 0.17, abs(hq.x + 0.05) - 0.01), 24.0));
  }
  // pipes along the ceiling on brackets, and three lamps
  let pipe = min(length(q.yz - vec2f(2.78, -3.1)), length(q.yz - vec2f(2.78, -2.84))) - 0.06;
  r = rmU(r, vec2f(pipe, 17.0));
  r = rmU(r, rmPendant(q, vec3f(3.0, 2.3, 1.55), 3.0));
  r = rmU(r, rmPendant(q, vec3f(6.2, 2.3, 1.55), 3.0));
  r = rmU(r, rmPendant(q, vec3f(3.8, 2.2, -2.7), 3.0));
  return r;
}
