// the Lantern Cellar: a brick barrel vault forty steps down, sooted at the crown and damp at the foot, red paper
// lanterns at every height, small tables with checked cloths and candles in bottles, and the stand at the far end
// on a worn rug: Oskar's kit, a bass, an amp, a microphone.
fn rmCellar(q: vec3f) -> vec2f {
  let box = sdBox(q - vec3f(5.95, 1.6, 0.0), vec3f(7.75, 1.6, 5.2));
  let vault = length(vec2f(q.y + 8.67, q.z)) - 11.87;
  var r = vec2f(-max(box, vault), select(11.0, 1.0, q.y < 0.02));
  // the stand, a rug on it, the band's things
  r = rmU(r, vec2f(sdBox(q - vec3f(12.2, 0.15, 0.0), vec3f(1.6, 0.15, 4.6)), 9.0));
  r = rmU(r, vec2f(sdBox(q - vec3f(12.3, 0.305, 0.4), vec3f(1.1, 0.006, 1.6)), 27.0));
  if (q.x > 10.0) {
    r = rmU(r, rmDrums(q, vec3f(12.6, 0.3, 1.0)));
    r = rmU(r, rmBass(q, vec3f(12.4, 0.3, -1.3)));
    r = rmU(r, vec2f(sdBox(q - vec3f(13.2, 0.62, -2.3), vec3f(0.22, 0.32, 0.3)) - 0.02, 14.0));
    r = rmU(r, vec2f(min(sdSeg(q, vec3f(11.4, 0.3, -0.2), vec3f(11.4, 1.55, -0.2)) - 0.01, length(q - vec3f(11.36, 1.58, -0.2)) - 0.03), 17.0));
  }
  // tables with checked cloths, a candle in a bottle on each
  if (abs(q.z) > 1.4 && q.x < 9.6) {
    let tx = rmRep(q.x, 2.0, 2.8, 3.0);
    let tz = q.z - 3.0 * sign(q.z);
    r = rmU(r, rmTable(vec3f(tx, q.y, tz), vec2f(0.0, 0.0), true));
    let cb = vec3f(tx - 0.1, q.y, tz + 0.05);
    r = rmU(r, vec2f(min(sdCyl(cb, 0.035, 0.765, 0.93) - 0.005, sdCyl(cb, 0.013, 0.93, 1.0)), 6.0));
    r = rmU(r, vec2f(sdEll(cb - vec3f(0.0, 1.035 + 0.004 * sin(u.time * 13.0 + q.x), 0.0), vec3f(0.01, 0.024, 0.01)), 26.0));
  }
  // lanterns at every height through the vault
  let lxi = rmIdx(q.x, 1.6, 2.2, 5.0);
  let lzi = clamp(round(q.z / 2.1), -2.0, 2.0);
  if (!(abs(lxi) < 0.5 && abs(lzi) < 0.5)) {
    let lh = hsh(i32(lxi), i32(lzi), 934);
    let lr = 0.14 + 0.1 * lh;
    r = rmU(r, rmLantern(q, vec3f(1.6 + 2.2 * lxi, 2.0 + 0.5 * fract(lh * 7.0), lzi * 2.1), lr, lh));
  }
  // gig posters pasted on the brick either side of the stand
  let pz = abs(q.z) - 5.12;
  r = rmU(r, vec2f(sdBox(vec3f(rmRep(q.x, 3.0, 2.6, 3.0), q.y - 1.45, pz), vec3f(0.32, 0.45, 0.012)), 23.0));
  return r;
}
