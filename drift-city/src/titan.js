// ---------- Titan: global map, sky geometry, space flight and navigation ----------
// Titan-fixed frame, kilometres: +Y is the north pole, +X points at the sub-Saturn point (latitude 0, longitude 0).
// Titan is tidally locked and orbits in Saturn's equatorial (ring) plane, so Saturn sits still in the sky of any
// given place and the rings lie in this frame's XZ plane. Longitudes are west, as on Titan maps.
const TR = 2575;
const SAT_D = 1221870;
const SAT_R = 60268;
const DEG = Math.PI / 180;

function llDir(lat, lonW) { const f = lat * DEG, l = -lonW * DEG; return [Math.cos(f) * Math.cos(l), Math.sin(f), Math.cos(f) * Math.sin(l)]; }
function frameAt(u) {
  const lam = Math.atan2(u[2], u[0]);
  const E = [-Math.sin(lam), 0, Math.cos(lam)];
  return { E, U: u, N: cross3(E, u) };
}
// local drone frame: x east, y up, z south
function toTitan(f, v) { return [v[0] * f.E[0] + v[1] * f.U[0] - v[2] * f.N[0], v[0] * f.E[1] + v[1] * f.U[1] - v[2] * f.N[1], v[0] * f.E[2] + v[1] * f.U[2] - v[2] * f.N[2]]; }
function toLocal(f, v) { return [dot3(v, f.E), dot3(v, f.U), -dot3(v, f.N)]; }
function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function mul3(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
function len3(a) { return Math.hypot(a[0], a[1], a[2]); }
function slerp3(a, b, t) {
  const d = clampv(dot3(a, b), -1, 1), w = Math.acos(d);
  if (w < 1e-7) return a.slice();
  const s = Math.sin(w), ka = Math.sin((1 - t) * w) / s, kb = Math.sin(t * w) / s;
  return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
}

// Saturn and the moons. Positions are Saturn-centred, on circular orbits in the ring plane (Iapetus inclined);
// the angle is measured from the Saturn-Titan line. Over the minutes of a flight they barely move, so they are fixed.
const SAT_POS = [SAT_D, 0, 0];
const MOONS = [
  { name: "Mimas", a: 185539, th: 40, inc: 0, r: 198, col: [0.64, 0.63, 0.61], glow: 0 },
  { name: "Enceladus", a: 237948, th: 205, inc: 0, r: 252, col: [0.98, 0.99, 1.0], glow: 0 },
  { name: "Tethys", a: 294619, th: 110, inc: 0, r: 531, col: [0.94, 0.92, 0.87], glow: 0 },
  { name: "Dione", a: 377396, th: 300, inc: 0, r: 561, col: [0.8, 0.79, 0.77], glow: 0 },
  { name: "Rhea", a: 527108, th: 64, inc: 0, r: 764, col: [0.3, 1.0, 0.88], glow: 1 },
  { name: "Hyperion", a: 1481010, th: 60, inc: 0, r: 135, col: [1.0, 0.42, 0.62], glow: 1 },
  { name: "Iapetus", a: 3560820, th: 150, inc: 15.5, r: 734, col: [0.7, 0.66, 0.6], glow: 0 },
];
for (const m of MOONS) {
  const t = m.th * DEG;
  m.pos = add3(SAT_POS, [-m.a * Math.cos(t), m.a * Math.sin(m.inc * DEG) * Math.sin(t), m.a * Math.sin(t) * Math.cos(m.inc * DEG)]);
}

// Real Titan regions, with approximate centres and sizes (km). The local terrain around a landing site takes the
// character of its region; craters and the cryovolcano are scaled down to fit the 20 km local area.
const FEATURES = [
  { name: "Kraken Mare", lat: 68, lon: 310, r: 380, type: 1 },
  { name: "Ligeia Mare", lat: 79, lon: 248, r: 200, type: 1 },
  { name: "Punga Mare", lat: 85.1, lon: 339.7, r: 115, type: 1 },
  { name: "Ontario Lacus", lat: -72, lon: 183, r: 70, type: 1 },
  { name: "Xanadu", lat: -12, lon: 100, r: 1700, type: 4 },
  { name: "Shangri-La", lat: -8, lon: 165, r: 1250, type: 3 },
  { name: "Belet", lat: -5, lon: 255, r: 1100, type: 3 },
  { name: "Fensal", lat: 12, lon: 30, r: 850, type: 3 },
  { name: "Aztlan", lat: -12, lon: 35, r: 750, type: 3 },
  { name: "Adiri", lat: -10, lon: 210, r: 420, type: 5 },
  { name: "Tui Regio", lat: -24, lon: 125, r: 330, type: 5 },
  { name: "Hotei Regio", lat: -26, lon: 78, r: 300, type: 5 },
  { name: "Menrva", lat: 19, lon: 87, r: 200, type: 6 },
  { name: "Selk", lat: 7, lon: 199, r: 45, type: 6 },
  { name: "Sinlap", lat: 11, lon: 16, r: 40, type: 6 },
  { name: "Sotra Patera", lat: -14.5, lon: 40, r: 15, type: 7 },
  { name: "Doom Mons", lat: -14.7, lon: 40.4, r: 25, type: 8 },
];
for (const f of FEATURES) f.dir = llDir(f.lat, f.lon);
GEO.feats = FEATURES.map((f) => [f.dir[0], f.dir[1], f.dir[2], f.r * 1000, f.type]);
// a point at a fraction of a feature's radius from its centre, toward a bearing (0 north, 90 east)
function pointNear(lat, lon, km, bearingDeg) {
  const f = frameAt(llDir(lat, lon)), b = bearingDeg * DEG, a = km / TR;
  const dir = norm3(add3(mul3(f.U, Math.cos(a)), mul3(add3(mul3(f.N, Math.cos(b)), mul3(f.E, Math.sin(b))), Math.sin(a))));
  return [Math.asin(dir[1]) / DEG, ((-Math.atan2(dir[2], dir[0]) / DEG) % 360 + 360) % 360];
}
// dryness and elevation offsets that push the local biome mix toward each kind of region
const RTYPE = [
  { dd: 0, de: 0, feat: 0, city: 1 },
  { dd: -0.04, de: -0.15, feat: 0, city: 0 },
  { dd: -0.14, de: -0.05, feat: 0, city: 0 },
  { dd: 0.25, de: 0.03, feat: 0, city: 0 },
  { dd: 0.02, de: 0.2, feat: 0, city: 0 },
  { dd: 0.06, de: 0.08, feat: 0, city: 0 },
  { dd: 0.12, de: 0.05, feat: 1, city: 0 },
  { dd: 0.03, de: 0.06, feat: 2, city: 0 },
  { dd: -0.02, de: 0.04, feat: 0, city: 0 },
];
function regionAt(d) {
  let best = null, bk = 1;
  for (const f of FEATURES) { const k = Math.acos(clampv(dot3(d, f.dir), -1, 1)) * TR / f.r; if (k < bk) { bk = k; best = f; } }
  if (best) return { type: best.type, name: best.name };
  const lat = Math.asin(d[1]) / DEG;
  if (Math.abs(lat) > 62) return { type: 2, name: lat > 0 ? "Northern lake district" : "Southern lake district" };
  return { type: 8, name: "Mid-latitude plains" };
}

const DESTS = [
  { id: "home", name: "Drift city", lat: 58, lon: 318, type: 0, note: "Drift city, about 90 km south of Kraken Mare's shore. Saturn hangs low in the south-west and never moves: Titan always keeps the same face towards it." },
  { id: "kraken", name: "Kraken Mare", at: ["Kraken Mare", 0.9, 200], type: 1, note: "The shore of Kraken Mare, Titan's largest sea of liquid methane and ethane: about 400,000 square km, larger than the Caspian Sea." },
  { id: "ligeia", name: "Ligeia Mare", at: ["Ligeia Mare", 0.9, 180], type: 1, note: "Ligeia Mare: the second largest sea, mostly methane, measured by Cassini's radar at up to about 160 m deep." },
  { id: "punga", name: "Punga Mare", at: ["Punga Mare", 0.9, 180], type: 1, note: "Punga Mare, near the north pole." },
  { id: "lakes", name: "Northern lakes", lat: 74, lon: 120, type: 2, note: "The northern lake district: many methane lakes, a few km to tens of km across, in steep-sided basins." },
  { id: "ontario", name: "Ontario Lacus", at: ["Ontario Lacus", 0.97, 0], type: 1, note: "The north shore of Ontario Lacus, the largest lake in the south. From this far side of Titan, Saturn is never visible." },
  { id: "xanadu", name: "Xanadu", lat: -12, lon: 100, type: 4, note: "Xanadu: a bright, rugged region about 4,000 km across, full of eroded water-ice mountains." },
  { id: "shangrila", name: "Shangri-La", lat: -8, lon: 165, type: 3, note: "Shangri-La: a dark equatorial sea of dunes about 100 m high, a few km apart and hundreds of km long, made of organic grains." },
  { id: "belet", name: "Belet dunes", lat: -5, lon: 255, type: 3, note: "Belet: another great dune sea; the dunes run east to west, shaped by the winds." },
  { id: "huygens", name: "Huygens site", lat: -10.3, lon: 192.3, type: 5, note: "Where the Huygens probe landed on 14 January 2005: a damp plain strewn with rounded pebbles of water ice, where the bright Adiri highlands meet the dunes." },
  { id: "selk", name: "Selk crater", at: ["Selk", 1.0, 0], type: 6, note: "The northern rim of Selk crater, about 90 km across, so the far rim is beyond the horizon. NASA's Dragonfly rotorcraft is due to fly here in the 2030s." },
  { id: "menrva", name: "Menrva crater", at: ["Menrva", 1.0, 0], type: 6, note: "The rim of Menrva, Titan's largest known impact crater, about 400 km across." },
  { id: "sotra", name: "Sotra Patera", at: ["Sotra Patera", 1.0, 300], type: 7, note: "The edge of Sotra Patera, a pit about 1.7 km deep beside the 1.45 km peak Doom Mons: a proposed cryovolcano that erupted water and ammonia." },
  { id: "orbit", name: "Titan orbit", space: 1, note: "1,500 km up. Titan's hazy atmosphere reaches about 600 km; look for the thin blue detached haze layer along the limb." },
  { id: "saturn", name: "Saturn system", space: 2, note: "The Saturn system from above the ring plane. Titan orbits 1.22 million km out, in the plane of the rings, which is why they look edge-on from Titan's surface." },
  { id: "rings", name: "Inside the rings", space: 4, note: "20 m above the B ring, 105,000 km from Saturn's centre. The main rings are about 280,000 km across but mostly only tens of metres thick: countless particles of water ice, from grains to boulders, each on its own orbit. Saturn fills a third of the sky." },
  { id: "clouds", name: "Saturn's cloud tops", space: 5, note: "800 km above Saturn's clouds at 45 degrees north. Winds here reach hundreds of metres per second, stretching the clouds into bands; the rings arch across the southern sky and their shadow falls across the planet." },
  { id: "mimas", name: "Mimas", space: 3, moon: 0, note: "Mimas, 396 km across. The crater Herschel is 130 km wide, a third of the moon's diameter." },
  { id: "enceladus", name: "Enceladus", space: 3, moon: 1, note: "Enceladus, 504 km across and the most reflective body in the Solar System. Jets of water vapour and ice rise from the 'tiger stripe' fractures near its south pole, from an ocean under the ice, and feed Saturn's E ring." },
  { id: "tethys", name: "Tethys", space: 3, moon: 2, note: "Tethys, 1,062 km across: the crater Odysseus is 450 km wide, and the canyon Ithaca Chasma runs about 2,000 km around the moon." },
  { id: "dione", name: "Dione", space: 3, moon: 3, note: "Dione, 1,123 km across. The bright wisps on its trailing side are ice cliffs along fractures, hundreds of metres high." },
  { id: "rhea", name: "Rhea", space: 3, moon: 4, note: "Rhea, 1,527 km across, Saturn's second largest moon: old, heavily cratered ice. In this story it has been made to glow." },
  { id: "hyperion", name: "Hyperion", space: 3, moon: 5, note: "Hyperion, about 360 by 266 by 205 km: so porous that it looks like a sponge, and it tumbles chaotically. It glows here too." },
  { id: "iapetus", name: "Iapetus", space: 3, moon: 6, note: "Iapetus, 1,469 km across: its leading side is as dark as coal and its trailing side bright as snow, and a ridge up to 13 km high runs along its equator." },
];
for (const d of DESTS) if (d.at) { const f = FEATURES.find((x) => x.name === d.at[0]); [d.lat, d.lon] = pointNear(f.lat, f.lon, f.r * d.at[1], d.at[2]); }
const HOME_DEST = DESTS[0];
function destById(id) { return DESTS.find((d) => d.id === id); }

// ---------- navigation state ----------
const NAV = {
  mode: "surface", site: HOME_DEST, siteF: frameAt(llDir(HOME_DEST.lat, HOME_DEST.lon)), siteName: HOME_DEST.name,
  trip: null, space: null, tour: null, sunT: null, sunFrozen: false, sunOverride: null, spaceMix: 0,
  cam: null, heading: null, arrivedAt: -1e9,
};

// Put the local frame's origin at a point on Titan. Nothing about the planet changes: the same function is sampled
// from a new anchor. The city exists in one place only, so it is drawn when the anchor is the city.
function setAnchor(lat, lon, isHome) {
  const f = frameAt(llDir(lat, lon));
  GEO.E = f.E; GEO.U = f.U; GEO.N = f.N;
  REG.ox = 0; REG.oz = 0; REG.cx = 0; REG.cz = 0; REG.city = isHome ? 1 : 0;
  resetWorldCaches();
}

// sun direction in the Titan frame, from the local time-of-day preset at the current site; its declination is kept
// within Saturn's 26.7 degree axial tilt
function sunTitanFromLocal(loc) {
  const s = toTitan(NAV.siteF, loc);
  s[1] = clampv(s[1], -0.44, 0.44);
  return norm3(s);
}

// Camera in the Titan frame from the drone state near the current site
function flatCamTitan() {
  const f = NAV.siteF, cv = cameraVectors();
  const P = add3(mul3(f.U, TR + st.y / 1000), toTitan(f, [st.x / 1000, 0, st.z / 1000]));
  return { P, F: toTitan(f, cv.f), R: toTitan(f, cv.r), Up: toTitan(f, cv.up) };
}
function camBasis(P, F, upHint) {
  const R = norm3(cross3(upHint, F));
  return { P, F, R, Up: cross3(F, R) };
}

function startTrip(dest, opts) {
  if (FB_ACTIVE) { fallbackJump(dest); return; }
  if (!NAV.cam) NAV.cam = flatCamTitan();
  const P0 = NAV.cam.P, a0 = Math.max(len3(P0) - TR, 0.05), d0 = norm3(P0);
  let d1, a1, look = null, end = null;
  if (dest.space === 1) {
    // go to where the sun is about 40 degrees up, so the view from orbit is of the day side
    const sT = NAV.sunT || d0;
    const ang = Math.acos(clampv(dot3(sT, d0), -1, 1));
    if (ang > 50 * DEG) d1 = norm3(slerp3(sT, d0, 50 * DEG / ang));
    else d1 = rotAbout(d0, sT, 0.5);
    a1 = 1500;
  } else if (dest.space === 2) {
    end = satViewPos(35, 14, 620000);
    d1 = norm3(end); a1 = len3(end) - TR; look = SAT_POS;
  } else if (dest.space === 4) {
    end = ringPoint(RING_VIEW.r, RING_VIEW.a, RING_VIEW.h);
    d1 = norm3(end); a1 = len3(end) - TR;
    const tg = [-Math.sin(RING_VIEW.a), 0, Math.cos(RING_VIEW.a)];
    look = add3(end, add3(mul3(tg, 1.0), [0, -0.06 * Math.sign(end[1]), 0]));
  } else if (dest.space === 5) {
    const cv = cloudView(45, 800, 0, 0.12);
    end = cv.P; d1 = norm3(end); a1 = len3(end) - TR; look = add3(cv.P, mul3(cv.F, 1000));
  } else if (dest.space === 3) {
    const m = MOONS[dest.moon];
    end = moonViewPos(m);
    d1 = norm3(end); a1 = len3(end) - TR; look = m.pos;
  } else { d1 = llDir(dest.lat, dest.lon); a1 = 0.25; }
  const arc = Math.acos(clampv(dot3(d0, d1), -1, 1)) * TR;
  const aTop = dest.space ? Math.max(a0, a1) : clampv(arc * 0.35, 90, 2500);
  const T = opts && opts.T ? opts.T : 12 + 8 * Math.log10(1 + arc / 20) + 4 * Math.log10(1 + Math.max(a0, a1, aTop) / 100);
  NAV.trip = { dest, d0, d1, a0, a1, aTop, T, t: 0, look, end, switched: dest.space ? true : false, H: NAV.cam.F, F0: NAV.cam.F.slice(), Up0: NAV.cam.Up.slice() };
  NAV.mode = "trip";
  NAV.space = null;
  NAV.sunFrozen = true;
  NAV.trip.quiet = !!(opts && opts.quiet);
  audioDepart();
  if (!NAV.trip.quiet) showHint((dest.space ? "Climbing out to " : "Flying to ") + dest.name + "\u2026", 4000);
}
// a view of a moon from about three of its radii, lit from the Sun's side, with Saturn beyond it where possible
function moonViewPos(m) {
  // the Sun about 65 degrees to one side, so the terminator crosses the disc and craters cast shadows
  const s = NAV.sunT || [0.6, 0.3, 0.7];
  const away = norm3(sub3(m.pos, SAT_POS));
  let side = sub3(away, mul3(s, dot3(away, s)));
  if (len3(side) < 1e-3) side = cross3([0, 1, 0], s);
  if (m.name === "Iapetus") {
    // look square to its orbital motion, so the dark leading and bright trailing halves share the disc
    const rel = sub3(m.pos, SAT_POS), vel = norm3([rel[2], 0, -rel[0]]);
    const d = norm3(sub3(s, mul3(vel, dot3(s, vel))));
    return add3(m.pos, mul3(norm3(add3(mul3(d, 0.9), mul3(norm3(cross3(d, vel)), 0.45))), m.r * 3.4));
  }
  // small moons are seen from relatively farther away, so their size reads; the composition varies per moon
  const k = MOONS.indexOf(m), far = clampv(Math.pow(600 / m.r, 0.35), 0.8, 1.7);
  const up = [0, 0.25 * Math.sin(k * 1.9), 0], sw = 0.3 + 0.25 * Math.cos(k * 2.3);
  return add3(m.pos, mul3(norm3(add3(add3(mul3(s, sw), mul3(norm3(side), 0.9)), add3(up, mul3(away, 0.25)))), m.r * 3.4 * far));
}
// a point in the ring plane's frame: distance from Saturn (km), angle around it, height above the plane (km,
// on the sunlit side)
const RING_VIEW = { r: 105000, a: 3.4, h: 0.02 };
function ringPoint(r, a, h) {
  const side = NAV.sunT && NAV.sunT[1] < 0 ? -1 : 1;
  return [SAT_POS[0] + r * Math.cos(a), h * side, SAT_POS[2] + r * Math.sin(a)];
}
// a viewpoint above Saturn's clouds: latitude (degrees), altitude (km), heading from south (radians), pitch;
// its longitude is chosen so that the Sun is well up
const SAT_RP = 54364;
function satSurfaceR(lat) { const c = Math.cos(lat), s = Math.sin(lat); return 1 / Math.sqrt(c * c / (SAT_R * SAT_R) + s * s / (SAT_RP * SAT_RP)); }
function cloudView(latDeg, alt, yaw, pitch, lon) {
  const lat = latDeg * DEG, s = NAV.sunT || [0.6, 0.3, 0.7];
  const L = lon === undefined ? Math.atan2(s[2], s[0]) + 0.5 : lon;
  const d = [Math.cos(lat) * Math.cos(L), Math.sin(lat), Math.cos(lat) * Math.sin(L)];
  const P = add3(SAT_POS, mul3(d, satSurfaceR(lat) + alt));
  const E = norm3([-Math.sin(L), 0, Math.cos(L)]), N = cross3(E, d), S = mul3(N, -1);
  const H = norm3(add3(mul3(S, Math.cos(yaw)), mul3(E, Math.sin(yaw))));
  const F = norm3(add3(mul3(H, Math.cos(pitch)), mul3(d, Math.sin(pitch))));
  return { P, F, d, lon: L };
}
function satViewPos(azDeg, elDeg, dist) {
  const az = azDeg * DEG, el = elDeg * DEG;
  return add3(SAT_POS, [dist * Math.cos(el) * Math.cos(az), dist * Math.sin(el), dist * Math.cos(el) * Math.sin(az)]);
}

function tripPose(tr) {
  const s = clampv(tr.t / tr.T, 0, 1);
  const la0 = Math.log(tr.a0), la1 = Math.log(tr.a1), lt = Math.log(tr.aTop);
  const hump = Math.max(0, lt - Math.max(la0, la1));
  // the ground at the destination may stand well above the datum: that allowance is added gently near the end
  const alt = Math.exp(la0 + (la1 - la0) * sstep(0, 1, s) + hump * sstep(0, 0.42, s) * sstep(1, 0.58, s)) + (tr.aEnd || 0) * sstep(0.7, 1.0, s);
  const d = norm3(slerp3(tr.d0, tr.d1, sstep(0.1, 0.9, s)));
  let P = mul3(d, TR + alt);
  // far destinations are reached exactly: the last part of the trip closes on the end point
  if (tr.end) { const k = sstep(0.55, 1.0, s); P = add3(mul3(P, 1 - k), mul3(tr.end, k)); }
  let H = sub3(tr.d1, mul3(d, dot3(d, tr.d1)));
  if (len3(H) < 1e-5) H = sub3(tr.H, mul3(d, dot3(d, tr.H)));
  H = norm3(H);
  tr.H = H;
  const dip = Math.acos(TR / (TR + alt));
  const w = sstep(0.8, 3.2, Math.log10(alt + 1e-3));
  const pitch = -(0.1 + (dip + 0.25) * w);
  let F = norm3(add3(mul3(H, Math.cos(pitch)), mul3(d, Math.sin(pitch))));
  // heading out into space, look where we are going (turning early, while the angle is small), then settle on
  // the destination; this never swings the view through a half-turn
  if (tr.end && tr.dest.space >= 2) {
    const toEnd = sub3(tr.end, P);
    if (len3(toEnd) > 1e-3) F = norm3(slerp3(F, norm3(toEnd), sstep(0.02, 0.3, s)));
  }
  if (tr.look) F = norm3(slerp3(F, norm3(sub3(tr.look, P)), sstep(0.5, 0.95, s)));
  if (tr.dest.space === 1) F = norm3(slerp3(F, orbitCam(P).F, sstep(0.5, 1, s)));
  // on the way to the Saturn system, 'up' turns from Titan's local vertical to the ring plane's north
  let upH = tr.dest.space >= 2 ? norm3(slerp3(d, [0, 1, 0], sstep(0.2, 0.8, s))) : d;
  // arriving over Saturn's clouds, 'up' becomes Saturn's local vertical
  if (tr.dest.space === 5) upH = norm3(slerp3(upH, norm3(sub3(tr.end, SAT_POS)), sstep(0.6, 1.0, s)));
  // for the first few seconds, turn gently from wherever we were looking toward the way we are going
  const kT = sstep(0, Math.min(3.5, tr.T * 0.22), tr.t);
  if (kT < 1) { F = norm3(slerp3(tr.F0, F, kT)); upH = norm3(slerp3(tr.Up0, upH, kT)); }
  return { s, alt, camb: camBasis(P, F, upH), d, H };
}
function rotAbout(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), kv = cross3(k, v), kd = dot3(k, v);
  return [v[0] * c + kv[0] * s + k[0] * kd * (1 - c), v[1] * c + kv[1] * s + k[1] * kd * (1 - c), v[2] * c + kv[2] * s + k[2] * kd * (1 - c)];
}
// in orbit, look down and across the sun's direction, so the ground is side-lit and the limb haze catches the light
function orbitHeading(d) {
  const sT = NAV.sunT || [1, 0, 0];
  let h = cross3(d, sub3(sT, mul3(d, dot3(d, sT))));
  if (len3(h) < 1e-4) h = cross3([0, 1, 0], d);
  return norm3(h);
}
function orbitCam(P) {
  const d = norm3(P), H = orbitHeading(d), dist = len3(P);
  const lookDown = clampv(Math.acos(TR / dist) + 0.55, 0.3, 1.5);
  return camBasis(P, norm3(add3(mul3(H, Math.cos(lookDown)), mul3(d, -Math.sin(lookDown)))), d);
}

// Free camera in space: orbit around Titan, or view the Saturn system; drag to swing around, zoom to change distance
function enterSpace(kind, P) {
  if (kind === 5) {
    const rel = sub3(P, SAT_POS), rr = len3(rel);
    const lat = Math.asin(rel[1] / rr);
    NAV.space = { kind, lat, lon: Math.atan2(rel[2], rel[0]), alt: rr - satSurfaceR(lat), yaw: 0, pitch: 0.12 };
    NAV.mode = "space";
    return;
  }
  if (kind === 4) {
    const rel = sub3(P, SAT_POS);
    NAV.space = { kind, r: Math.hypot(rel[0], rel[2]), a: Math.atan2(rel[2], rel[0]), h: Math.abs(P[1]), side: Math.sign(P[1]) || 1, yaw: 0, pitch: -0.06 };
    NAV.mode = "space";
    return;
  }
  if (kind === 1) {
    const d = norm3(P);
    NAV.space = { kind, az: Math.atan2(d[2], d[0]), el: Math.asin(d[1]), dist: len3(P), drift: 0.012 };
  } else {
    const focus = kind === 3 ? MOONS[NAV.trip ? NAV.trip.dest.moon : NAV.spaceMoon].pos : SAT_POS;
    const rel = sub3(P, focus);
    NAV.space = { kind, focus, moon: kind === 3 ? (NAV.trip ? NAV.trip.dest.moon : NAV.spaceMoon) : -1, az: Math.atan2(rel[2], rel[0]), el: Math.asin(rel[1] / len3(rel)), dist: len3(rel), drift: kind === 3 ? 0.02 : 0.004 };
  }
  NAV.mode = "space";
}
function spaceStep(dt, input) {
  const S = NAV.space;
  if (S.kind === 5) {
    S.lon += 0.0015 * dt;
    S.yaw -= input.dx * 1.2 * dt;
    S.pitch = clampv(S.pitch - input.dy * 1.0 * dt, -1.4, 1.4);
    S.alt = clampv(S.alt * Math.exp(input.zoom * dt * 0.8), 150, 300000);
    const cv = cloudView(S.lat / DEG, S.alt, S.yaw, S.pitch, S.lon);
    NAV.cam = camBasis(cv.P, cv.F, cv.d);
    NAV.spaceAlt = len3(cv.P) - TR;
    return;
  }
  if (S.kind === 4) {
    // drift slowly along with the ring particles; drag to look around, zoom to rise or sink toward the ring plane
    S.a += 0.03 / S.r * dt;
    S.yaw -= input.dx * 1.2 * dt;
    S.pitch = clampv(S.pitch - input.dy * 1.0 * dt, -1.45, 1.45);
    S.h = clampv(S.h * Math.exp(input.zoom * dt * 0.8), 0.015, 200);
    const P = [SAT_POS[0] + S.r * Math.cos(S.a), S.h * S.side, SAT_POS[2] + S.r * Math.sin(S.a)];
    const tg = [-Math.sin(S.a), 0, Math.cos(S.a)], rad = [Math.cos(S.a), 0, Math.sin(S.a)];
    const cp = Math.cos(S.pitch);
    const F = norm3(add3(add3(mul3(tg, Math.cos(S.yaw) * cp), mul3(rad, Math.sin(S.yaw) * cp)), [0, Math.sin(S.pitch) * S.side, 0]));
    NAV.cam = camBasis(P, F, [0, S.side, 0]);
    NAV.spaceAlt = len3(P) - TR;
    return;
  }
  S.az += (S.drift + input.dx * 1.4) * dt;
  S.el = clampv(S.el + input.dy * 1.0 * dt, -1.35, 1.35);
  if (S.kind === 1) S.dist = clampv(S.dist * Math.exp(input.zoom * dt * 0.8), TR + 60, 60000);
  else if (S.kind === 3) { const r = MOONS[S.moon].r; S.dist = clampv(S.dist * Math.exp(input.zoom * dt * 0.8), r * 1.25, r * 80); }
  else S.dist = clampv(S.dist * Math.exp(input.zoom * dt * 0.8), 90000, 4.5e6);
  const dir = [Math.cos(S.el) * Math.cos(S.az), Math.sin(S.el), Math.cos(S.el) * Math.sin(S.az)];
  if (S.kind === 1) {
    const P = mul3(dir, S.dist);
    NAV.cam = orbitCam(P);
    NAV.spaceAlt = S.dist - TR;
  } else {
    const P = add3(S.focus, mul3(dir, S.dist));
    NAV.cam = camBasis(P, norm3(sub3(S.focus, P)), [0, 1, 0]);
    NAV.spaceAlt = len3(P) - TR;
  }
}

// switch the local world to a new landing site
let worldResetHook = null;
function arriveRegion(dest, quiet) {
  NAV.site = dest;
  NAV.siteF = frameAt(llDir(dest.lat, dest.lon));
  NAV.siteName = dest.name;
  setAnchor(dest.lat, dest.lon, dest.id === "home");
  // pick the lighting that matches where the sun now is in this place's sky
  if (NAV.sunT) {
    const ls = toLocal(NAV.siteF, NAV.sunT);
    const idx = ls[1] > 0.22 ? 0 : ls[1] > -0.05 ? 1 : 2;
    if (idx !== todIdx) { todFrom = currentTod(); todIdx = idx; todT = 0; todAuto = 0; }
    NAV.sunOverride = ls[1] > -0.05 ? norm3(ls) : null;
    syncLabels();
  }
  if (worldResetHook) worldResetHook();
  if (!quiet) syncGoLabel();
}

// ---------- flying by hand, anywhere, from the ground to orbit ----------
function startFree(cam) {
  const d = norm3(cam.P);
  let H = sub3(cam.F, mul3(d, dot3(cam.F, d)));
  if (len3(H) < 1e-4) H = cross3([0, 1, 0], d);
  NAV.free = { P: cam.P.slice(), H: norm3(H), look: 0 };
  NAV.mode = "free"; NAV.trip = null; NAV.space = null; NAV.tour = null; NAV.sunFrozen = true;
  showHint("Flying by hand: left stick up and down to climb, left and right to turn; right stick to look (E and Q on a keyboard).", 7000);
  syncGoLabel();
}
function freeStep(dt, inp) {
  const S = NAV.free;
  const d = norm3(S.P);
  let alt = len3(S.P) - TR;
  alt += inp.climb * Math.max(0.05, alt * 0.8) * dt;
  // near the ground, stay above the terrain of the local world
  if (alt < 5) {
    const loc = toLocal(NAV.siteF, sub3(S.P, mul3(NAV.siteF.U, TR)));
    const g = Math.max(terrSurfAt(loc[0] * 1000, loc[2] * 1000), 0) / 1000;
    alt = Math.max(alt, g + 0.04);
  }
  alt = Math.min(Math.max(alt, 0.03), 4.0e6);
  const H0 = rotAbout(S.H, d, -inp.dx * 1.1 * dt);
  S.look = clampv(S.look - inp.dy * 0.8 * dt, -0.9, 0.5);
  const speed = Math.max(0.04, alt * 0.12);
  const ang = speed * dt / (TR + alt);
  const d2 = norm3(add3(mul3(d, Math.cos(ang)), mul3(H0, Math.sin(ang))));
  S.H = norm3(sub3(mul3(H0, Math.cos(ang)), mul3(d, Math.sin(ang))));
  S.P = mul3(d2, TR + alt);
  const dip = Math.acos(TR / (TR + alt));
  const w = sstep(0.8, 3.2, Math.log10(alt + 1e-3));
  const pitch = clampv(-(0.1 + (dip + 0.25) * w) + S.look, -1.55, 1.2);
  NAV.cam = camBasis(S.P, norm3(add3(mul3(S.H, Math.cos(pitch)), mul3(d2, Math.sin(pitch)))), d2);
  return alt;
}
// anchor the local world at any point: the nearest named place, or the city when close to it
function anchorHere(d) {
  const home = llDir(HOME_DEST.lat, HOME_DEST.lon);
  if (Math.acos(clampv(dot3(d, home), -1, 1)) * TR < 30) { arriveRegion(HOME_DEST, true); return; }
  const lat = Math.asin(d[1]) / DEG, lon = ((-Math.atan2(d[2], d[0]) / DEG) % 360 + 360) % 360;
  arriveRegion({ id: "here", name: regionAt(d).name, lat, lon, type: 8 }, true);
}
function driveDrone(P, F) {
  const f = NAV.siteF;
  const loc = toLocal(f, sub3(P, mul3(f.U, TR)));
  st.x = loc[0] * 1000; st.z = loc[2] * 1000;
  st.y = Math.max((len3(P) - TR) * 1000, Math.max(terrSurfAt(st.x, st.z), 0) + 40);
  const fl = toLocal(f, F);
  st.yaw = Math.atan2(fl[2], fl[0]); st.pitch = Math.asin(clampv(fl[1], -1, 1)); st.roll = 0;
}

// one step of navigation; returns true when the drone's own flight model should run
function navStep(dt, input) {
  if (NAV.mode === "intro") { introStep(dt); NAV.spaceMix = 0; NAV.cam = null; return false; }
  if (NAV.mode === "visit") { visitStep(dt, input); NAV.spaceMix = 0; NAV.cam = null; return false; }
  if (NAV.mode === "surface") {
    NAV.cam = null;
    NAV.spaceMix = 0;
    if (!NAV.sunFrozen) NAV.sunT = sunTitanFromLocal(currentTod().sun);
    if (NAV.tour) {
      // taking the controls pauses the tour; it carries on a few seconds after you let go
      if (clock - lastInput < 5) NAV.arrivedAt += dt;
      if (clock - NAV.arrivedAt > NAV.tour.stay) tourNext();
    }
    if (input.climb > 0.5 && st.y > 270) startFree(flatCamTitan());
    return NAV.mode === "surface";
  }
  if (NAV.mode === "free") {
    const alt = freeStep(dt, input);
    const d = norm3(NAV.free.P);
    const off = Math.acos(clampv(dot3(d, NAV.siteF.U), -1, 1)) * TR;
    // move the local world's anchor under the camera; above about 4 km the space view covers the change
    if (off > 25 && (alt > 4.2 || off > 60)) anchorHere(d);
    if (alt < 5) driveDrone(NAV.free.P, NAV.cam.F);
    NAV.spaceMix = sstep(2.5, 4.0, alt);
    if (alt < 0.35 && input.climb <= 0) {
      NAV.mode = "surface"; NAV.sunFrozen = false; NAV.cam = null; NAV.spaceMix = 0;
      st.vx = Math.cos(st.yaw) * 20; st.vz = Math.sin(st.yaw) * 20; st.vy = 0; st.altBias = 0; st.mode = "high"; st.tour = null;
      lastInput = clock;
      syncGoLabel();
    }
    return false;
  }
  if (input.climb !== 0 && (NAV.mode === "trip" || (NAV.mode === "space" && NAV.space.kind === 1 && input.climb < 0))) { startFree(NAV.cam); return false; }
  if (NAV.mode === "trip") {
    const tr = NAV.trip;
    tr.t += dt;
    const pose = tripPose(tr);
    // a little inertia in the view (about a quarter of a second), as a real camera would have
    if (tr.Fs && dt > 0) {
      const Fs = norm3(slerp3(tr.Fs, pose.camb.F, 1 - Math.exp(-dt * 4)));
      pose.camb = camBasis(pose.camb.P, Fs, pose.camb.Up);
    }
    tr.Fs = pose.camb.F;
    NAV.cam = pose.camb;
    if (!tr.switched && pose.s > 0.5 && pose.alt < 600) {
      tr.switched = true; arriveRegion(tr.dest);
      // end the descent above the real ground here: crater rims and mountains stand well above the datum
      tr.aEnd = Math.max(0, Math.max(terrSurfAt(0, 0), 0) / 1000 + 0.25 - tr.a1);
    }
    // near the ground, drive the drone camera so the detailed local world can be drawn and cross-faded
    if (pose.alt < 5) driveDrone(pose.camb.P, pose.camb.F);
    NAV.spaceMix = sstep(2.5, 4.0, pose.alt);
    if (pose.s >= 1) {
      const dest = tr.dest;
      NAV.trip = null;
      if (tr.quiet && INTRO.on && !dest.space) { introPath(); return false; }
      if (dest.space) { NAV.spaceMoon = dest.moon; enterSpace(dest.space, pose.camb.P); NAV.arrivedAt = clock; showHint(dest.note, 9000); }
      else {
        NAV.mode = "surface"; NAV.spaceMix = 0; NAV.sunFrozen = false; NAV.arrivedAt = clock;
        const sp = 20;
        st.vx = Math.cos(st.yaw) * sp; st.vz = Math.sin(st.yaw) * sp; st.vy = 0; st.pitch = clampv(st.pitch, -0.5, 0.3);
        st.mode = "high"; st.tour = null;
        showHint(dest.note, 9000);
      }
    }
    return false;
  }
  spaceStep(dt, input);
  NAV.spaceMix = 1;
  if (NAV.tour && clock - NAV.arrivedAt > 25) tourNext();
  return false;
}
const TOUR = ["orbit", "kraken", "ligeia", "xanadu", "selk", "huygens", "shangrila", "sotra", "saturn", "rings", "clouds", "enceladus", "iapetus", "ontario", "menrva", "home"];
function tourNext() {
  const t = NAV.tour;
  t.i = (t.i + 1) % TOUR.length;
  startTrip(destById(TOUR[t.i]));
}
function goTo(id) {
  closeGoPanel();
  if (id === "tour") { NAV.tour = { i: -1, stay: 50 }; tourNext(); syncGoLabel(); return; }
  NAV.tour = null;
  const d = destById(id);
  if (!d) return;
  if (NAV.mode === "surface" && !d.space && d.id === NAV.site.id) { showHint(d.note, 7000); return; }
  startTrip(d);
  syncGoLabel();
}

// ---------- the travel drawer: collapsible sections, travel, story places, and developer tools ----------
let goPanel = null;
function drawerSection(parent, label, open) {
  const d = document.createElement("details");
  if (open) d.open = true;
  const s = document.createElement("summary");
  s.textContent = label;
  d.appendChild(s);
  const g = document.createElement("div");
  g.className = "gg";
  d.appendChild(g);
  parent.appendChild(d);
  return g;
}
function drawerButton(parent, label, fn, title) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = label;
  if (title) b.title = title;
  b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
  parent.appendChild(b);
  return b;
}
// an instant jump, for testing: no trip, no animation
function hop(dest) {
  closeGoPanel();
  NAV.tour = null; NAV.trip = null; NAV.free = null; NAV.visit = null; NAV.cam = null;
  if (dest.space) {
    let P;
    if (dest.space === 1) { const d0 = NAV.siteF.U, sT = NAV.sunT || d0, ang = Math.acos(clampv(dot3(sT, d0), -1, 1)); P = mul3(ang > 50 * DEG ? norm3(slerp3(sT, d0, 50 * DEG / ang)) : d0, TR + 1500); }
    else if (dest.space === 2) P = satViewPos(35, 14, 620000);
    else if (dest.space === 3) P = moonViewPos(MOONS[dest.moon]);
    else if (dest.space === 4) P = ringPoint(RING_VIEW.r, RING_VIEW.a, RING_VIEW.h);
    else P = cloudView(45, 800, 0, 0.12).P;
    NAV.spaceMoon = dest.moon;
    enterSpace(dest.space, P);
    NAV.spaceMix = 1;
  } else {
    arriveRegion(dest);
    NAV.mode = "surface"; NAV.spaceMix = 0; NAV.sunFrozen = false;
    st.x = 0; st.z = 0; st.y = Math.max(terrSurfAt(0, 0), 0) + 250; st.vx = Math.cos(st.yaw) * 20; st.vz = Math.sin(st.yaw) * 20; st.vy = 0; st.mode = "high"; st.tour = null;
  }
  NAV.arrivedAt = clock;
  showHint(dest.note || dest.name, 6000);
  syncGoLabel();
}
// drop into one of the story places and look around; "Fly on" carries on from there
function hopPlace(id) {
  closeGoPanel();
  const p = placeById(id);
  if (!p) return;
  NAV.tour = null; NAV.trip = null; NAV.free = null; NAV.space = null; NAV.cam = null; NAV.spaceMix = 0;
  if (NAV.site.id !== "home") arriveRegion(HOME_DEST, true);
  NAV.visit = { from: p, to: p, t: 1, T: 1, ly: 0, lp: 0 };
  NAV.mode = "visit";
  showHint(p.name + ". " + p.blurb, 6000);
  syncGoLabel();
}
function routeName() { return st.forced === "low" ? "street level" : st.forced === "high" ? "over the rooftops" : "automatic"; }
function flyOn() {
  if (NAV.mode !== "visit") return;
  NAV.mode = "surface"; NAV.visit = null;
  st.vx = Math.cos(st.yaw) * 10; st.vz = Math.sin(st.yaw) * 10; st.vy = 0; st.mode = "low"; st.tour = null;
  lastInput = clock;
}
// The menu is a drill-down: one short list at a time, with a back button, so nothing floods the screen.
const MENU = { stack: [], el: null, list: null, title: null, back: null };
const GROUPS_TITAN = [["Seas and lakes", ["kraken", "ligeia", "punga", "lakes", "ontario"]], ["Dunes and plains", ["shangrila", "belet", "huygens"]], ["Mountains and craters", ["xanadu", "selk", "menrva", "sotra"]]];
function destPages(act, verb) {
  const d = (id) => destById(id);
  const item = (id) => ({ label: d(id).name, act: () => act(d(id)) });
  return {
    title: verb,
    items: () => [
      { label: "Titan", sub: () => ({ title: "Titan", items: () => [item("home"), ...GROUPS_TITAN.map(([g, ids]) => ({ label: g, sub: () => ({ title: g, items: () => ids.map(item) }) })), item("orbit")] }) },
      { label: "The Saturn system", sub: () => ({ title: "The Saturn system", items: () => [
        { label: "Saturn from afar", act: () => act(d("saturn")) }, item("rings"), item("clouds"),
        { label: "Moons", sub: () => ({ title: "Saturn's moons", items: () => DESTS.filter((x) => x.space === 3).map((x) => item(x.id)) }) }] }) },
    ],
  };
}
function placeGroups() {
  if (!PLACES) buildPlaces();
  const groups = new Map();
  for (const p of PLACES) {
    const dn = DISTRICTS.find((x) => p.name.endsWith(x));
    const g = p.id.startsWith("hall") ? "The Assembly Hall" : dn ? dn[0].toUpperCase() + dn.slice(1) : "Beyond the city";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  return [...groups.entries()];
}
function placePages(act, title) {
  return { title, items: () => placeGroups().map(([g, ps]) => ({ label: g, detail: String(ps.length), sub: () => ({ title: g, items: () => ps.map((p) => ({ label: p.name.split(",")[0], act: () => act(p) })) }) })) };
}
function menuRoot() {
  const story = TALE.on ? "open" : (TALE.story || taleFetch(TALE_KEY)) ? "paused" : "";
  const times = [["Day", 0], ["Dusk", 1], ["Night", 2], ["Methane snow", 3]];
  return {
    title: "Menu",
    items: () => [
      { label: "Return to opening", act: () => { closeGoPanel(); if (TALE.on) taleClose(); introStart(); } },
      { label: "Story", detail: story, sub: () => ({ title: "Story: The Lamplighter's Last Round", items: () => [
        { label: TALE.on ? "Close the story" : TALE.story || taleFetch(TALE_KEY) ? "Resume the story" : "Play the story", act: () => { closeGoPanel(); taleToggle(); } },
        { label: "Start again", act: () => { closeGoPanel(); taleRestart(); } },
        { label: "Clues as choices (for reading without the view)", check: TALE.textClues, act: () => { TALE.textClues = !TALE.textClues; taleStore("drift.textClues", TALE.textClues); if (TALE.story && TALE.scene) { TALE.story.ChoosePathString(TALE.scene); taleAdvance(); } renderMenu(); } },
        { label: "Feel the choices: slide a thumb over them, lift to choose", check: FEEL.on, act: () => { FEEL.on = !FEEL.on; taleStore("drift.feel", FEEL.on); feelArm(); renderMenu(); } },
        { label: "Put the story panel back in its usual place", act: () => { taleResetGeom(); closeGoPanel(); } }] }) },
      { label: "Travel", detail: NAV.mode === "trip" ? "on the way" : "", sub: () => ({ ...destPages((d) => goTo(d.id), "Travel"), items: () => [...destPages((d) => goTo(d.id), "Travel").items(), { label: "Grand tour", check: !!NAV.tour, act: () => goTo("tour") }] }) },
      { label: "City map", act: () => { closeGoPanel(); mapOpen(); } },
      { label: "Places in the city", sub: () => placePages((p) => { closeGoPanel(); taleGo(p.id); if (!TALE.on) showHint(p.name + ". " + p.blurb, 6000); }, "Places in the city") },
      { label: "Time and weather", detail: presets[todIdx].name, sub: () => ({ title: "Time and weather", items: () => [
        ...times.map(([n, i]) => ({ label: n, check: todIdx === i, act: () => { NAV.sunOverride = null; NAV.sunFrozen = false; todFrom = currentTod(); todIdx = i; todT = 0; todAuto = 0; syncLabels(); renderMenu(); } })),
        { label: "Weather: its own cycle", check: WX.forced === null || WX.forced === undefined, act: () => { WX.forced = null; renderMenu(); } },
        { label: "Weather: snowing", check: WX.forced > 0, act: () => { WX.forced = 0.75; renderMenu(); } },
        { label: "Weather: clear", check: WX.forced === 0, act: () => { WX.forced = 0; renderMenu(); } }] }) },
      { label: "Sound", check: AU.on, act: () => { audioSetOn(!AU.on); renderMenu(); } },
      { label: "View", sub: () => ({ title: "View", items: () => [
        ...[["Route: automatic", null], ["Route: street level", "low"], ["Route: over the rooftops", "high"]].map(([n, v]) => ({ label: n, check: st.forced === v, act: () => { st.forced = v; if (v === null) st.modeT = 20; st.realign = true; syncLabels(); renderMenu(); } })),
        { label: "Opening sequence when the page loads", check: introEnabled(), act: () => { try { localStorage.setItem("drift.intro", introEnabled() ? "0" : "1"); } catch (e) {} renderMenu(); } },
        { label: "Focus on what matters (depth of field)", check: FOCUS.on, act: () => { FOCUS.on = !FOCUS.on; try { localStorage.setItem("drift.focus", FOCUS.on ? "1" : "0"); } catch (e) {} renderMenu(); } },
        { label: "Follow the drone (see yourself)", check: FOLLOW, act: () => { FOLLOW = !FOLLOW; try { localStorage.setItem("drift.follow", FOLLOW ? "1" : "0"); } catch (e) {} renderMenu(); } },
        { label: "On-screen gamepad", check: PAD.on, act: () => { padShow(!PAD.on); renderMenu(); } },
        { label: "Hide the controls (tap the scene to bring them back)", act: () => { closeGoPanel(); setUiHidden(true); } }] }) },
      { label: "Fly by hand", sub: () => ({ title: "Fly by hand", items: () => [
        { label: "Take the controls here", act: () => { closeGoPanel(); padShow(true); startFree(NAV.cam || flatCamTitan()); } },
        { label: "Carry on flying from a place", act: () => { closeGoPanel(); flyOn(); } }] }) },
      { label: "Developer", sub: () => ({ title: "Developer", items: () => [
        { label: "Quick hops", sub: () => destPages(hop, "Quick hops (instant)") },
        { label: "Quick hops to places", sub: () => placePages((p) => hopPlace(p.id), "Quick hops to places") },
        { label: "Frame stats", check: statsOn, act: () => { statsOn = !statsOn; statsEl.hidden = !statsOn; renderMenu(); } },
        { label: "Flocks", check: FLOCKS_ON, act: () => { FLOCKS_ON = !FLOCKS_ON; renderMenu(); } },
        { label: "Home, instantly", act: () => hop(HOME_DEST) },
        { label: "Forget the saved story", act: () => { taleForget(); showHint("Saved story cleared.", 2500); } }] }) },
    ],
  };
}
function renderMenu() {
  if (!MENU.el) return;
  const page = MENU.stack[MENU.stack.length - 1];
  MENU.title.textContent = page.title;
  MENU.back.hidden = MENU.stack.length < 2;
  MENU.list.innerHTML = "";
  for (const it of page.items()) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "row" + (it.sub ? " more" : "") + (it.check ? " on" : "");
    const l = document.createElement("span"); l.className = "rl"; l.textContent = it.label; b.appendChild(l);
    if (it.detail) { const d = document.createElement("span"); d.className = "rd"; d.textContent = it.detail; b.appendChild(d); }
    if (it.check !== undefined) b.setAttribute("aria-pressed", it.check ? "true" : "false");
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (it.sub) { MENU.stack.push(it.sub()); renderMenu(); MENU.list.scrollTop = 0; MENU.list.firstChild && MENU.list.firstChild.focus && MENU.list.firstChild.focus(); }
      else it.act();
    });
    MENU.list.appendChild(b);
  }
}
function menuBack() { if (MENU.stack.length > 1) { MENU.stack.pop(); renderMenu(); } else closeGoPanel(); }
function buildGoPanel() {
  goPanel = document.createElement("nav");
  goPanel.className = "drawer";
  goPanel.id = "goPanel";
  goPanel.setAttribute("aria-label", "Menu");
  const hd = document.createElement("div");
  hd.className = "drawerHead";
  const bk = document.createElement("button");
  bk.type = "button"; bk.className = "back"; bk.innerHTML = "&#8249;"; bk.setAttribute("aria-label", "Back");
  bk.addEventListener("click", (e) => { e.stopPropagation(); menuBack(); });
  const ti = document.createElement("span"); ti.className = "drawerTitle";
  const cb = document.createElement("button");
  cb.type = "button"; cb.innerHTML = "&times;"; cb.setAttribute("aria-label", "Close the menu");
  cb.addEventListener("click", (e) => { e.stopPropagation(); closeGoPanel(); });
  hd.appendChild(bk); hd.appendChild(ti); hd.appendChild(cb);
  const list = document.createElement("div"); list.className = "rows";
  goPanel.appendChild(hd); goPanel.appendChild(list);
  if (document.body) document.body.appendChild(goPanel);
  MENU.el = goPanel; MENU.list = list; MENU.title = ti; MENU.back = bk;
}
function toggleGoPanel() {
  if (!goPanel) buildGoPanel();
  if (goPanel.classList.contains("open")) { closeGoPanel(); return; }
  MENU.stack = [menuRoot()];
  renderMenu();
  goPanel.classList.add("open"); document.body?.classList?.add("drawerOn");
}
function closeGoPanel() { if (goPanel) { goPanel.classList.remove("open"); document.body?.classList?.remove("drawerOn"); } }
function spaceName() { const k = NAV.space.kind; return k === 1 ? "Titan orbit" : k === 3 ? MOONS[NAV.space.moon].name : k === 4 ? "Inside the rings" : k === 5 ? "Saturn's cloud tops" : "Saturn system"; }
function syncGoLabel() {
  const v = document.getElementById("vGo");
  if (!v) return;
  v.textContent = NAV.tour ? "Grand tour" : NAV.mode === "trip" ? NAV.trip.dest.name : NAV.mode === "space" ? spaceName() : NAV.mode === "free" ? "Flying by hand" : NAV.siteName;
}

// sky geometry for the current site, for the surface renderer: Saturn, the ring plane, the two glowing moons
function skyGeometry() {
  const f = NAV.siteF;
  const Ps = mul3(f.U, TR);
  const sv = sub3(SAT_POS, Ps), sd = len3(sv);
  const out = { sat: toLocal(f, mul3(sv, 1 / sd)), satR: SAT_R / sd, satD: sd, ringN: toLocal(f, [0, 1, 0]) };
  const m = (mo) => { const v = sub3(mo.pos, Ps), dd = len3(v); return { dir: toLocal(f, mul3(v, 1 / dd)), r: Math.max(mo.r / dd, 0.0022) }; };
  out.moonA = m(MOONS[4]); out.moonB = m(MOONS[5]);
  return out;
}

// Uniform block for the space renderer (160 floats; see struct SP in space.wgsl)
const SPACE_DATA = new Float32Array(160);
{
  for (let i = 0; i < 7; i++) {
    const m = MOONS[i];
    SPACE_DATA.set([m.pos[0], m.pos[1], m.pos[2], m.r], 32 + i * 4);
    SPACE_DATA.set([m.col[0], m.col[1], m.col[2], m.glow], 60 + i * 4);
  }
  FEATURES.forEach((f, i) => SPACE_DATA.set([f.dir[0], f.dir[1], f.dir[2], f.type * 10000 + f.r], 88 + i * 4));
  SPACE_DATA.set(SAT_POS, 20);
}
function fillSpaceData(cam, sunT, sunCol, alpha, fov, time) {
  const S = SPACE_DATA;
  S.set(cam.P, 0); S[3] = alpha;
  S.set(cam.F, 4); S[7] = fov;
  S.set(cam.R, 8); S[11] = 0.9;
  S.set(cam.Up, 12); S[15] = 0.5;
  S.set(sunT || [0.6, 0.3, 0.7], 16); S[19] = 0;
  S[23] = 1;
  S.set(llDir(HOME_DEST.lat, HOME_DEST.lon), 24); S[27] = time;
  S.set(sunCol, 28);
  // camera position for the ring-particle field: metres within a 100 km tile, height above the plane
  const rx = cam.P[0] - SAT_POS[0], rz = cam.P[2] - SAT_POS[2], rr = Math.hypot(rx, rz);
  const near = Math.abs(cam.P[1]) < 3 && rr > 66000 && rr < 141000;
  const md = (v) => ((v * 1000) % 100000 + 100000) % 100000;
  S.set([md(rx), md(rz), cam.P[1] * 1000, near ? 1 : 0], 156);
  return S;
}

// ---------- the opening sequence: from orbit, down through the haze, over the towers, along a street, to the stall ----------
const INTRO = { on: false, path: null };
function introEnabled() {
  if (globalThis.__noIntro) return false;
  try { return localStorage.getItem("drift.intro") !== "0"; } catch (e) { return true; }
}
// the opening page: backstory and a button, over Titan from orbit; its tap is the gesture that lets sound start
function gateShow() {
  const f = frameAt(llDir(HOME_DEST.lat, HOME_DEST.lon));
  NAV.tour = null; NAV.free = null; NAV.visit = null;
  enterSpace(1, mul3(norm3(add3(f.U, mul3(f.N, -0.35))), TR + 1200));
  spaceStep(0, { dx: 0, dy: 0, zoom: 0, climb: 0 });
  NAV.gate = true;
  document.body?.classList?.add("gateOn");
  const g = document.getElementById("gate");
  if (g) g.hidden = false;
}
function gateEnter(sound) {
  INTRO.started = true;
  NAV.gate = false;
  document.body?.classList?.remove("gateOn");
  const g = document.getElementById("gate");
  if (g) g.hidden = true;
  audioSetOn(sound);
  if (sound && AU.ctx && AU.ctx.state !== "running") AU.ctx.resume();
  if (introEnabled()) introStart();
  else hop(HOME_DEST);
}
// captions during the descent, then the title
const INTRO_CAPS = [[0.8, 5.0, "Titan. Year 212 of the settlement."], [5.6, 10.0, "The heat tariff has risen eleven quarters running."],
  [10.6, 15.0, "The Org still keeps the city breathing. Mostly."], [15.6, 20.5, "Tonight the Assembly votes to put out the last open flames."]];
function introCaptions() {
  const a = clock - INTRO.t0, cap = document.getElementById("introCap"), card = document.getElementById("introCard");
  if (!cap || !cap.classList) return;
  const c = INTRO_CAPS.find((x) => a >= x[0] && a < x[1]);
  if (c && cap.textContent !== c[2]) cap.textContent = c[2];
  cap.classList.toggle("show", !!c);
  if (card) card.classList.toggle("show", a >= 21.5 && a < 31);
}
function introStart() {
  INTRO.on = true;
  INTRO.t0 = clock;
  document.body?.classList?.add("introOn");
  const el = document.getElementById("intro");
  if (el) { el.hidden = false; el.classList?.remove("done"); el.classList?.add("play"); }
  closeGoPanel();
  // dusk, with snow falling
  todFrom = currentTod(); todIdx = 1; todT = 0.9; todAuto = 0; NAV.sunOverride = null; syncLabels();
  WX.forced = 0.6;
  // from orbit, a little south of the city, down to above it
  const f = frameAt(llDir(HOME_DEST.lat, HOME_DEST.lon));
  NAV.tour = null; NAV.free = null; NAV.visit = null;
  enterSpace(1, mul3(norm3(add3(f.U, mul3(f.N, -0.35))), TR + 1200));
  spaceStep(0, { dx: 0, dy: 0, zoom: 0, climb: 0 });
  startTrip(HOME_DEST, { T: 20, quiet: true });
}
// the flight path over the city: a smooth curve through key points, ending at the story's first place
function introPath() {
  const p = placeById("market_3");
  if (!p) { introEnd(); return; }
  const toBlock = [Math.cos(p.yaw), Math.sin(p.yaw)];
  let s = [-toBlock[1], toBlock[0]];
  const start = [st.x, Math.max(st.y, 200), st.z];
  if (s[0] * (start[0] - p.x) + s[1] * (start[2] - p.z) < 0) s = [-s[0], -s[1]];
  const along = (d, y, lat) => [p.x + s[0] * d + toBlock[0] * lat, y, p.z + s[1] * d + toBlock[1] * lat];
  // over the towers, down into the street's canyon along its centre line (above the trees and the tubes, below the
  // rooftops), then down and across to the stall's view only at the very end
  const K = [start, along(620, 190, 3.6), along(260, 30, 3.6), along(40, 18, 3.6), [p.x, p.y, p.z]];
  let L = 0; const seg = [0];
  for (let i = 1; i < K.length; i++) { L += Math.hypot(K[i][0] - K[i - 1][0], K[i][1] - K[i - 1][1], K[i][2] - K[i - 1][2]); seg.push(L); }
  INTRO.path = { K, seg, L, t: 0, T: 26, place: p };
  NAV.mode = "intro"; NAV.spaceMix = 0; NAV.sunFrozen = false;
}
function introPos(u) {
  const I = INTRO.path, K = I.K, d = u * I.L;
  let i = 1; while (i < K.length - 1 && I.seg[i] < d) i++;
  const a = (d - I.seg[i - 1]) / Math.max(I.seg[i] - I.seg[i - 1], 1e-3);
  const P0 = K[Math.max(i - 2, 0)], P1 = K[i - 1], P2 = K[i], P3 = K[Math.min(i + 1, K.length - 1)];
  const cr = (k) => 0.5 * (2 * P1[k] + (-P0[k] + P2[k]) * a + (2 * P0[k] - 5 * P1[k] + 4 * P2[k] - P3[k]) * a * a + (-P0[k] + 3 * P1[k] - 3 * P2[k] + P3[k]) * a * a * a);
  return [cr(0), cr(1), cr(2)];
}
function introStep(dt) {
  const I = INTRO.path;
  I.t += dt;
  const u = Math.min(I.t / I.T, 1), e = u * u * (3 - 2 * u);
  const P = introPos(e), Q = introPos(Math.min(e + 0.01, 1));
  st.x = P[0]; st.y = P[1]; st.z = P[2];
  // look along the path, then settle onto the stall's view
  const dx = Q[0] - P[0], dy = Q[1] - P[1], dz = Q[2] - P[2], hz = Math.hypot(dx, dz);
  let yaw = hz > 1e-3 ? Math.atan2(dz, dx) : I.place.yaw, pitch = clampv(Math.atan2(dy, hz) * 0.7, -0.6, 0.3);
  const k = sstep(0.82, 1.0, u);
  let dyaw = I.place.yaw - yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
  st.yaw = yaw + dyaw * k; st.pitch = pitch + (I.place.pitch - pitch) * k; st.roll = 0;
  st.vx = 0; st.vy = 0; st.vz = 0;
  if (u >= 1) introEnd();
}
function introEnd() {
  if (!INTRO.on) return;
  INTRO.on = false;
  document.body?.classList?.remove("introOn");
  const el = document.getElementById("intro");
  if (el) { el.classList?.remove("play"); el.classList?.add("done"); setTimeout(() => { el.hidden = true; }, 900); }
  WX.forced = null;
  NAV.trip = null; NAV.tour = null;
  if (NAV.site.id !== "home") arriveRegion(HOME_DEST, true);
  const p = placeById("market_3");
  if (p) { NAV.visit = { from: p, to: p, t: 1, T: 1, ly: 0, lp: 0 }; NAV.mode = "visit"; NAV.spaceMix = 0; NAV.cam = null; st.x = p.x; st.y = p.y; st.z = p.z; st.yaw = p.yaw; st.pitch = p.pitch; }
  taleOpen();
}
function introSkip() { if (INTRO.on) { NAV.trip = null; NAV.space = null; introEnd(); } }
