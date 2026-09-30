// the Low Orbit: a crew bar built like a ship's mess. Riveted steel panels between ribbed frames, ducts and cable
// trays overhead, tread-plate floor worn bright down the middle, a long window on the pads with frost at its edges,
// steel tables with mugs, caged lamps, a departures screen over the bar.
fn rmLowOrbit(q: vec3f) -> vec2f {
  let s = -sdBox(q - vec3f(9.15, 2.1, 0.0), vec3f(10.95, 2.1, 4.8));
  var m = 2.0;
  if (q.y < 0.02) { m = 1.0; } else if (q.y > 4.15) { m = 3.0; }
  if (q.z < -4.7 && q.x > 1.9 && q.x < 17.1 && q.y > 0.9 && q.y < 3.4) { m = 7.0; }
  var r = vec2f(s, m);
  // ribbed frames every three metres, round the walls and over the ceiling
  let fx = rmRep(q.x, 0.5, 3.0, 7.0);
  r = rmU(r, vec2f(max(abs(fx) - 0.1, s - 0.16), 30.0));
  // ducts and a cable tray
  r = rmU(r, vec2f(length(q.yz - vec2f(3.75, 3.2)) - 0.34, 17.0));
  r = rmU(r, vec2f(max(sdBox(vec3f(0.0, q.y - 3.95, q.z + 1.5), vec3f(1e3, 0.05, 0.25)), -sdBox(vec3f(0.0, q.y - 4.0, q.z + 1.5), vec3f(1e3, 0.05, 0.22))), 30.0));
  // tables along the window, bolted down, benches, mugs
  if (q.z < -1.8) {
    let tx = rmRep(q.x, 3.5, 3.0, 5.0);
    let tp = vec3f(tx, q.y, q.z + 3.5);
    r = rmU(r, vec2f(sdBox(tp - vec3f(0.0, 0.74, 0.0), vec3f(0.55, 0.025, 0.42)) - 0.01, 17.0));
    r = rmU(r, vec2f(sdBox(tp - vec3f(0.0, 0.37, 0.0), vec3f(0.05, 0.37, 0.05)), 17.0));
    r = rmU(r, vec2f(sdBox(vec3f(abs(tx) - 0.95, q.y - 0.45, q.z + 3.5), vec3f(0.2, 0.03, 0.45)) - 0.02, 10.0));
    let mq = tp - vec3f(0.15, 0.765, 0.1);
    r = rmU(r, vec2f(max(abs(length(mq.xz) - 0.042) - 0.005, max(-mq.y, mq.y - 0.1)), 31.0));
  }
  // the bar across the far end: steel front with a padded edge, a wooden top, bottles behind, the screen above
  if (q.x > 16.5) {
    r = rmU(r, vec2f(sdBox(q - vec3f(17.6, 0.55, 0.9), vec3f(0.35, 0.55, 3.2)), 17.0));
    r = rmU(r, vec2f(sdBox(q - vec3f(17.55, 1.12, 0.9), vec3f(0.45, 0.035, 3.3)) - 0.005, 4.0));
    r = rmU(r, vec2f(length(vec2f(q.x - 17.2, q.y - 1.02)) - 0.06, 10.0));
    let si = clamp(round((q.y - 1.45) / 0.4), 0.0, 2.0);
    r = rmU(r, vec2f(sdBox(vec3f(q.x - 19.9, q.y - 1.45 - 0.4 * si, q.z - 0.9), vec3f(0.18, 0.014, 3.0)), 30.0));
    r = rmU(r, vec2f(rmBottles(q.z, q.y, q.x - 19.9, -2.0, 30.0, 1.45), 6.0));
    r = rmU(r, vec2f(sdBox(q - vec3f(20.05, 3.0, 0.9), vec3f(0.04, 0.45, 1.5)), 28.0));
  }
  // the window's mullions
  let mx = rmRep(q.x, 2.0, 3.0, 6.0);
  r = rmU(r, vec2f(sdBox(vec3f(mx, q.y - 2.15, q.z + 4.72), vec3f(0.07, 1.3, 0.08)), 30.0));
  r = rmU(r, vec2f(sdBox(vec3f(q.x - 9.5, abs(q.y - 2.15) - 1.28, q.z + 4.72), vec3f(7.6, 0.06, 0.1)), 30.0));
  // caged lamps down the middle
  let lx = rmRep(q.x, 3.0, 4.0, 4.0);
  let lp = vec3f(lx, q.y - 3.25, q.z + 0.6);
  r = rmU(r, vec2f(length(lp) - 0.07, 8.0));
  let la = atan2(lp.z, lp.x);
  let cage = max(abs(length(lp) - 0.14) - 0.006, abs(fract(la / 0.785 + 0.5) - 0.5) * 0.785 * length(lp.xz) - 0.006);
  r = rmU(r, vec2f(max(cage, -lp.y - 0.12), 17.0));
  r = rmU(r, vec2f(sdCyl(lp, 0.006, 0.1, 1.0), 17.0));
  return r;
}
