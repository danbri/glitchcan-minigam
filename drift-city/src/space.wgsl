// ---------- space view: Titan as a globe with its haze, Saturn and its rings, the moons ----------
// Titan-fixed frame in kilometres, Titan's centre at the origin, +Y north, Saturn along +X in the ring plane (y = 0).
struct SP {
  camPos: vec3f, alpha: f32,
  camFwd: vec3f, fov: f32,
  camRight: vec3f, exposure: f32,
  camUp: vec3f, haze: f32,
  sunDir: vec3f, night: f32,
  satPos: vec3f, cityOn: f32,
  homeDir: vec3f, time: f32,
  sunCol: vec3f, pad: f32,
  moonPos: array<vec4f, 7>,
  moonCol: array<vec4f, 7>,
  feat: array<vec4f, 17>,
  ringLoc: vec4f,
};
@group(0) @binding(1) var<uniform> sv: SP;

const TRK: f32 = 2575.0;
const ATM: f32 = 600.0;
const HS: f32 = 55.0;
const SATR: f32 = 60268.0;
const SATRP: f32 = 54364.0;

fn sst(a: f32, b: f32, x: f32) -> f32 { let t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
// ray-sphere intersection in a numerically stable form; returns (near, far), or (-1, -1) for a miss
fn sph(ro: vec3f, rd: vec3f, c: vec3f, r: f32) -> vec2f {
  let oc = ro - c;
  let b = dot(oc, rd);
  let h = oc - b * rd;
  let d2 = r * r - dot(h, h);
  if (d2 < 0.0) { return vec2f(-1.0, -1.0); }
  let q = sqrt(d2);
  return vec2f(-b - q, -b + q);
}
fn n3(p: vec3f, k: i32) -> f32 {
  let i = vec3i(floor(p));
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  let a = mix(hsh(i.x + i.z * 7919, i.y, k), hsh(i.x + 1 + i.z * 7919, i.y, k), w.x);
  let b = mix(hsh(i.x + i.z * 7919, i.y + 1, k), hsh(i.x + 1 + i.z * 7919, i.y + 1, k), w.x);
  let c = mix(hsh(i.x + (i.z + 1) * 7919, i.y, k), hsh(i.x + 1 + (i.z + 1) * 7919, i.y, k), w.x);
  let d = mix(hsh(i.x + (i.z + 1) * 7919, i.y + 1, k), hsh(i.x + 1 + (i.z + 1) * 7919, i.y + 1, k), w.x);
  return mix(mix(a, b, w.y), mix(c, d, w.y), w.z);
}
fn fbm(p: vec3f, k: i32) -> f32 {
  var s = 0.0;
  var a = 0.5;
  var q = p;
  for (var i = 0; i < 5; i++) { s += a * n3(q, k + i); q *= 2.03; a *= 0.5; }
  return s / 0.97;
}
fn phaseHG(c: f32, g: f32) -> f32 { let g2 = g * g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }

// Titan's surface as seen through the near-infrared windows of enhanced-vision goggles; w = 1 on liquid
fn titanAlb(n: vec3f) -> vec4f {
  let lat = asin(clamp(n.y, -1.0, 1.0));
  let big = fbm(n * 6.0, 300);
  let mid = fbm(n * 26.0, 310);
  var c = vec3f(0.3, 0.25, 0.19) * (0.8 + 0.45 * big) * (0.9 + 0.2 * mid);
  var liquid = 0.0;
  for (var i = 0; i < 17; i++) {
    let f = sv.feat[i];
    let r = f.w - floor(f.w / 10000.0) * 10000.0;
    let typ = i32(floor(f.w / 10000.0));
    let k = acos(clamp(dot(n, f.xyz), -1.0, 1.0)) * TRK / r;
    if (k > 1.5) { continue; }
    let wob = (big - 0.5) * 0.5 + (mid - 0.5) * 0.2;
    let w = sst(1.05, 0.8, k + wob);
    switch typ {
      case 1: { liquid = max(liquid, w); }
      case 3: {
        let streak = 0.5 + 0.5 * sin(n.y * 1400.0 + mid * 9.0 + big * 4.0);
        c = mix(c, vec3f(0.1, 0.075, 0.058) * (0.8 + 0.4 * streak), w);
      }
      case 4: { c = mix(c, vec3f(0.56, 0.5, 0.43) * (0.75 + 0.5 * fbm(n * 60.0, 320)), w); }
      case 5: { c = mix(c, vec3f(0.44, 0.38, 0.3) * (0.85 + 0.3 * mid), w); }
      case 6: {
        let rim = exp(-pow((k - 0.9) / 0.07, 2.0));
        c = mix(c, c * 0.7, w * (1.0 - rim));
        c += vec3f(0.25, 0.22, 0.18) * rim;
      }
      case 7: {
        let flow = sst(0.55, 0.62, fbm(n * 90.0, 330)) * w;
        c = mix(c, vec3f(0.08, 0.07, 0.07), flow);
        c += vec3f(0.3, 0.27, 0.22) * exp(-pow(k / 0.18, 2.0));
      }
      case 8: { c = mix(c, vec3f(0.5, 0.45, 0.4), exp(-k * k * 2.5) * 0.8); }
      default: {}
    }
  }
  // polar lake districts: many small lakes above about 62 degrees
  let polar = sst(1.05, 1.2, abs(lat));
  liquid = max(liquid, polar * step(0.63, fbm(n * 80.0, 340)));
  return vec4f(mix(c, vec3f(0.012, 0.01, 0.008), liquid), liquid);
}

// ---------- the same planet the ground renderer draws, for views from a few km to a few hundred km up ----------
// Mirrors geoField and terrainAt in world.js / scene.wgsl: identical features, noise and biome rules.
fn tnS(q: vec3f, S: f32, k: i32) -> f32 { return 0.5 + (n3(q / S + 20000.0, k) - 0.5) * 1.17; }
fn geoFieldS(n: vec3f) -> vec4f {
  var o = vec4f(0.0);
  let wob = (n3(n * 64.0 + 1000.0, 460) - 0.5) * 0.3;
  for (var i = 0; i < 17; i++) {
    let f = sv.feat[i];
    let typ = i32(floor(f.w / 10000.0));
    let rm = (f.w - f32(typ) * 10000.0) * 1000.0;
    let k = 2.0 * 2575000.0 * asin(min(length(n - f.xyz) * 0.5, 1.0)) / rm;
    if (k > 1.6) { continue; }
    if (typ == 1) { let q = sst(1.0, 0.8, k + wob); o.y -= 0.3 * q; o.x -= 0.05 * q; }
    else if (typ == 3) { let q = sst(1.1, 0.85, k + wob); o.x += 0.3 * q; o.y += 0.02 * q; o.w = max(o.w, q); }
    else if (typ == 4) { o.y += 0.2 * sst(1.1, 0.8, k + wob); }
    else if (typ == 5) { let q = sst(1.1, 0.8, k + wob); o.y += 0.07 * q; o.x += 0.05 * q; }
    else if (typ == 6) { let hr = clamp(0.012 * rm, 150.0, 700.0); let e = (k - 1.0) / 0.1; o.z += hr * exp(-e * e) - 0.7 * hr * sst(1.0, 0.8, k) + 0.3 * hr * exp(-max(k - 1.0, 0.0) / 0.35) * sst(0.95, 1.05, k); }
    else if (typ == 7) { o.z -= 1700.0 * sst(1.05, 0.7, k); }
    else if (typ == 8) { o.z += 1450.0 * exp(-k * k * 2.5); }
  }
  let pl = sst(0.87, 0.93, abs(n.y));
  if (pl > 0.0) { let lk = pl * sst(0.58, 0.64, n3(n * 171.0 + 1000.0, 470)); o.y -= 0.25 * lk; o.x -= 0.1 * pl; }
  return o;
}
struct BWs { sea: f32, mnt: f32, mid: f32, des: f32, bad: f32, swp: f32, fo: f32 };
var<private> bBlur: f32 = 0.0;
fn biomeS(dry: f32, elev: f32) -> BWs {
  var w: BWs;
  let b = bBlur;
  w.sea = sst(0.40 + b, 0.34 - b, elev); w.mnt = sst(0.60 - b, 0.70 + b, elev); w.mid = max(0.0, 1.0 - w.sea - w.mnt);
  w.des = sst(0.56 - b, 0.63 + b, dry); w.bad = sst(0.46 - b, 0.52 + b, dry) * (1.0 - w.des);
  w.swp = sst(0.40 + b, 0.34 - b, dry) * sst(0.52 + b, 0.45 - b, elev); w.fo = max(0.0, 1.0 - w.des - w.bad - w.swp);
  return w;
}
// surface at a point: rgb albedo, w = liquid; hOut receives an approximate height in km for relief shading
fn nearSurf(n: vec3f, hOut: ptr<function, f32>) -> vec4f {
  let q = n * 2575000.0;
  let g = geoFieldS(n);
  let dry = tnS(q, 4992.0, 203) * 0.65 + tnS(q, 2496.0, 204) * 0.35 + g.x;
  let elev = tnS(q, 4992.0, 205) * 0.6 + tnS(q, 2496.0, 206) * 0.3 + tnS(q, 1248.0, 207) * 0.1 + g.y;
  let w = biomeS(dry, elev);
  let nz = tnS(q, 700.0, 61);
  let northM = asin(clamp(n.y, -1.0, 1.0)) * 2575000.0;
  let streak = pow(0.5 + 0.5 * sin(northM * 0.002618 + 3.0 * tnS(q, 5000.0, 471)), 2.5);
  let grass = mix(vec3f(0.11, 0.065, 0.05), vec3f(0.19, 0.11, 0.07), nz);
  let forest = mix(grass, vec3f(0.045, 0.035, 0.04), 0.6);
  let sand = mix(vec3f(0.2, 0.12, 0.065), vec3f(0.36, 0.22, 0.11), nz) * (0.75 + 0.45 * streak * g.w);
  let strata = mix(vec3f(0.5, 0.42, 0.34), vec3f(0.62, 0.45, 0.25), nz);
  let swampC = mix(vec3f(0.07, 0.05, 0.035), vec3f(0.13, 0.09, 0.05), nz);
  let rock = mix(vec3f(0.36, 0.36, 0.37), vec3f(0.5, 0.49, 0.48), nz);
  var land = forest * w.fo + sand * w.des + strata * w.bad + swampC * w.swp;
  land = mix(land, rock, w.mnt);
  let liquid = sst(0.35, 0.65, w.sea);
  *hOut = (w.mnt * (0.04 + 0.5 * tnS(q, 1248.0, 210)) + w.des * 0.09 * g.w * streak + w.bad * 0.1 + g.z / 1000.0) * (1.0 - liquid);
  return vec4f(mix(land, vec3f(0.012, 0.01, 0.008), liquid), liquid);
}

// ---------- the moons, close up ----------
// A crater field on a unit sphere: for the cells around the point, one crater per cell at random. Returns the
// albedo factor in x and a tangent-plane slope (for relief shading) in yzw.
fn craters(n: vec3f, K: f32, k: i32) -> vec4f {
  let p = n * K;
  let c0 = floor(p);
  var alb = 1.0;
  var sl = vec3f(0.0);
  for (var dz = -1; dz <= 1; dz++) {
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        let c = c0 + vec3f(f32(dx), f32(dy), f32(dz));
        let ci = vec3i(c) + 5000;
        let h = hsh(ci.x + ci.z * 7919, ci.y, k);
        if (h > 0.55) { continue; }
        let cc = normalize(c + vec3f(hsh(ci.x, ci.y + ci.z * 31, k + 1), hsh(ci.y, ci.z + ci.x * 17, k + 2), hsh(ci.z, ci.x + ci.y * 13, k + 3)));
        let r = (0.25 + 0.6 * pow(hsh(ci.x * 3, ci.y * 5 + ci.z, k + 4), 2.0)) / K;
        let v = n - cc;
        let d = length(v) / r;
        if (d > 1.6) { continue; }
        // bowl inside, raised rim, slope pointing away from the centre on the rim and toward it in the bowl
        let prof = select(exp(-(d - 1.0) * (d - 1.0) * 30.0) * 0.8, d * d - 1.0 + exp(-(d - 1.0) * (d - 1.0) * 30.0) * 0.8, d < 1.0);
        let dpr = select(-(d - 1.0) * 48.0 * exp(-(d - 1.0) * (d - 1.0) * 30.0), 2.0 * d - (d - 1.0) * 48.0 * exp(-(d - 1.0) * (d - 1.0) * 30.0), d < 1.0);
        sl += normalize(v + vec3f(1e-6)) * dpr * 0.12;
        alb *= 1.0 - 0.12 * sst(1.0, 0.3, d) + 0.1 * exp(-(d - 1.0) * (d - 1.0) * 30.0);
        _ = prof;
      }
    }
  }
  return vec4f(alb, sl);
}
// each moon's surface: albedo and shading normal. Every moon has its own crater character and signature landforms.
fn rimProfile(n0: vec3f, c: vec3f, rad: f32, depth: f32) -> vec4f {
  // one large named crater: albedo factor and slope, with a raised rim and a central peak
  let v = n0 - c;
  let d = length(v) / rad;
  if (d > 1.7) { return vec4f(1.0, 0.0, 0.0, 0.0); }
  let dir = normalize(v + vec3f(1e-6));
  let rim = exp(-(d - 1.0) * (d - 1.0) * 22.0);
  let slope = select(-(d - 1.0) * 44.0 * rim, 2.0 * d * depth - (d - 1.0) * 44.0 * rim, d < 1.0) * 0.08 - exp(-d * d * 60.0) * 0.9 * depth * d;
  let alb = mix(1.0, 0.82, sst(1.0, 0.5, d) * depth) + 0.18 * rim;
  return vec4f(alb, dir * slope);
}
fn moonSurf(i: i32, n0: vec3f, base: vec3f, vel: vec3f, dist: f32, pixA: f32) -> array<vec3f, 2> {
  var a = base;
  let detail = sst(0.03, 0.004, pixA);
  let lead = normalize(vel);
  var K1 = 9.0;
  var K2 = 26.0;
  var st = 1.0;
  switch i {
    case 0: { K1 = 7.0; K2 = 22.0; st = 1.5; }
    case 1: { K1 = 11.0; K2 = 32.0; st = 0.45; }
    case 2: { K1 = 8.0; K2 = 24.0; st = 0.9; }
    case 3: { K1 = 9.0; K2 = 28.0; st = 0.9; }
    case 4: { K1 = 12.0; K2 = 34.0; st = 1.4; }
    case 5: { K1 = 10.0; K2 = 22.0; st = 2.2; }
    default: { K1 = 8.0; K2 = 24.0; st = 1.0; }
  }
  let c1 = craters(n0, K1, 600 + i * 10);
  let c2 = craters(n0, K2, 700 + i * 10);
  var alb = mix(1.0, c1.x * c2.x, detail);
  var sl = (c1.yzw + c2.yzw * 0.6) * detail * st;
  switch i {
    case 0: {
      // Mimas: saturated with craters, and Herschel, a third of the moon wide, with its central peak
      let h = rimProfile(n0, lead, 0.33, 1.3);
      alb *= h.x; sl += h.yzw * 1.3;
    }
    case 1: {
      // Enceladus: fresh snow-white ice, craters only in the north, grooved terrain, and four blue tiger stripes
      let north = sst(-0.25, 0.35, n0.y);
      alb = mix(1.0, alb, north); sl *= north;
      let g = pow(abs(sin(dot(n0, normalize(vec3f(0.8, 0.25, 0.55))) * 38.0)), 8.0) * (1.0 - north) * 0.5;
      sl += normalize(cross(n0, vec3f(0.8, 0.25, 0.55)) + vec3f(1e-6)) * g * 0.3;
      let lon = atan2(n0.z, n0.x);
      let band = fract((n0.x * 0.7 + n0.z * 0.7) * 5.5 + 0.15 * sin(lon * 3.0));
      let stripes = sst(-0.72, -0.9, n0.y) * sst(0.12, 0.02, abs(band - 0.5));
      a = mix(a, vec3f(0.45, 0.75, 1.0), stripes);
    }
    case 2: {
      // Tethys: the huge shallow Odysseus, the wide canyon Ithaca Chasma, a bluish band on the leading side
      let h = rimProfile(n0, normalize(lead + vec3f(0.0, 0.5, 0.0)), 0.45, 0.5);
      alb *= h.x; sl += h.yzw;
      let ax = normalize(cross(normalize(lead + vec3f(0.0, 0.5, 0.0)), vec3f(0.0, 1.0, 0.0)));
      let gc = abs(dot(n0, ax));
      alb *= 1.0 - 0.45 * sst(0.07, 0.025, gc);
      sl += ax * sign(dot(n0, ax)) * sst(0.08, 0.02, gc) * 0.8;
      a = mix(a, a * vec3f(0.82, 0.9, 1.05), sst(0.3, 0.0, abs(n0.y)) * sst(-0.1, 0.5, dot(n0, lead)));
    }
    case 3: {
      // Dione: a darker trailing hemisphere laced with bright cliffs of fractured ice; a brighter, cratered leading side
      let tr = sst(0.1, -0.5, dot(n0, lead));
      a *= mix(1.0, 0.7, tr);
      let w1 = pow(abs(sin((n0.y * 2.6 + n3(n0 * 3.0 + 50.0, 650) * 3.5) * 8.0)), 14.0);
      let w2 = pow(abs(sin((dot(n0, vec3f(0.6, 0.3, 0.74)) * 3.0 + n3(n0 * 5.0 + 90.0, 651) * 2.5) * 10.0)), 18.0);
      a = mix(a, vec3f(1.0, 1.0, 1.0), max(w1, w2 * 0.8) * tr);
      alb = mix(alb, 1.0, tr * 0.5);
    }
    case 4: {
      // Rhea: old ice saturated with craters, and the bright young rays of Inktomi
      let ic = normalize(lead + vec3f(0.3, -0.25, 0.2));
      let v = n0 - ic;
      let d = length(v);
      let ang = atan2(dot(v, cross(ic, vec3f(0.0, 1.0, 0.0))), dot(v, vec3f(0.0, 1.0, 0.0)));
      let rays = pow(abs(sin(ang * 11.0 + n3(n0 * 6.0, 652) * 2.0)), 6.0) * sst(0.7, 0.05, d);
      alb = mix(alb, 1.25, rays * 0.7 + sst(0.06, 0.02, d) * 0.5);
    }
    case 5: {
      // Hyperion: so porous it is like a sponge: deep pits with dark, reddish floors
      let c3 = craters(n0, 16.0, 760);
      alb = c1.x * c2.x * c3.x * c3.x;
      sl = (c1.yzw + c2.yzw + c3.yzw * 1.3) * 1.8;
      a = mix(vec3f(0.32, 0.2, 0.13), base, alb);
    }
    case 6: {
      // Iapetus: the leading side as dark as coal (the poles stay bright), the trailing side bright, and a ridge
      // up to 13 km high right along the equator of the dark side
      let ld = dot(n0, lead) + (n3(n0 * 5.0 + 50.0, 660) - 0.5) * 0.3;
      let dark = sst(-0.15, 0.1, ld) * sst(0.88, 0.62, abs(n0.y));
      a = mix(vec3f(0.8, 0.77, 0.7), vec3f(0.035, 0.024, 0.016), dark);
      let ridge = exp(-n0.y * n0.y * 1600.0) * sst(-0.3, 0.2, ld);
      sl += vec3f(0.0, -sign(n0.y), 0.0) * ridge * 2.5;
      a = mix(a, vec3f(0.5, 0.46, 0.4), ridge * 0.6);
    }
    default: {}
  }
  let n = normalize(n0 - sl);
  return array<vec3f, 2>(a * alb, n);
}
// Enceladus's jets: columns of fine ice above the south polar region, bright when the Sun is behind them
fn plumes(ro: vec3f, rd: vec3f, m: vec4f, sun: vec3f, tMax: f32) -> vec3f {
  let axis = vec3f(0.0, -1.0, 0.0);
  let base = m.xyz + axis * m.w * 0.97;
  let len = m.w * 1.6;
  let tc = clamp(dot(base + axis * len * 0.5 - ro, rd), 0.0, tMax);
  var acc = 0.0;
  for (var j = 0; j < 12; j++) {
    let t = tc + (f32(j) - 5.5) * m.w * 0.15;
    if (t < 0.0 || t > tMax) { continue; }
    let q = ro + rd * t - base;
    let along = dot(q, axis);
    if (along < 0.0 || along > len) { continue; }
    let rad = length(q - axis * along);
    let wdt = m.w * (0.08 + 0.5 * along / len);
    acc += exp(-rad * rad / (wdt * wdt)) * exp(-along / (len * 0.35)) * 0.15;
  }
  let fw = 1.0 + 6.0 * pow(max(dot(rd, sun), 0.0), 6.0);
  return vec3f(0.8, 0.9, 1.0) * acc * fw * 0.5;
}

fn airmass(mu: f32) -> f32 {
  let m = max(mu, 0.0);
  let ang = acos(clamp(m, 0.0, 1.0)) * 57.29578;
  return 1.0 / (m + 0.15 * pow(max(93.885 - ang, 0.5), -1.253));
}
// fraction of sunlight reaching a point at radius rr (km) with the sun at cosine mu from the local vertical
fn sunTrans(p: vec3f) -> f32 {
  let rr = length(p);
  let mu = dot(p / rr, sv.sunDir);
  let h = rr - TRK;
  let sig0 = sv.haze / HS;
  let shadowD = rr * sqrt(max(1.0 - mu * mu, 0.0)) - TRK;
  let lit = select(1.0, sst(-15.0, 25.0, shadowD), mu < 0.0);
  return exp(-sig0 * HS * exp(-h / HS) * airmass(mu)) * lit;
}

// ring optical depth by distance from Saturn's centre (km)
// size of a pixel on the rings (km), so ringlet structure finer than a couple of pixels fades out instead of aliasing
var<private> rFoot: f32 = 0.0;
fn rq(freq: f32) -> f32 { return sst(2.0, 4.0, 6.2832 * SATR / freq / max(rFoot, 1e-3)); }
fn ringTau(r: f32) -> f32 {
  let x = r / SATR;
  var t = 0.0;
  if (x > 1.11 && x < 1.236) { t = 0.02; }
  else if (x >= 1.239 && x < 1.527) { t = 0.08 + 0.06 * sin(x * 900.0) * rq(900.0); }
  else if (x >= 1.527 && x < 1.951) { t = 1.6 + 0.9 * sin(x * 260.0) * rq(260.0) * sin(x * 41.0); }
  else if (x >= 1.951 && x < 2.025) { t = 0.08 + 0.05 * sin(x * 1200.0) * rq(1200.0); }
  else if (x >= 2.025 && x < 2.27) { t = 0.55 + 0.15 * sin(x * 500.0) * rq(500.0); if (abs(x - 2.214) < 0.0045) { t = 0.02; } }
  else if (abs(x - 2.326) < 0.0015) { t = 0.5; }
  return max(t, 0.0);
}
fn ringCol(r: f32) -> vec3f {
  let x = r / SATR;
  if (x < 1.527) { return vec3f(0.6, 0.55, 0.5); }
  if (x < 1.951) { return vec3f(0.86, 0.77, 0.62); }
  return vec3f(0.78, 0.72, 0.62);
}
// Inside the rings: individual ice particles near the camera. ringLoc holds the camera's position in metres (x and
// z within a 100 km tile, y = height above the ring plane), so the field keeps metre precision 1.2 million km from Titan.
fn ringParticles(rd: vec3f, tau: f32, sun: vec3f) -> vec4f {
  let o = vec3f(sv.ringLoc.x, sv.ringLoc.z, sv.ringLoc.y);
  let HH = 14.0;
  let G = 3.0;
  var t0 = 0.0;
  var t1 = 1500.0;
  if (abs(rd.y) > 1e-6) {
    let ta = (HH - o.y) / rd.y;
    let tb = (-HH - o.y) / rd.y;
    t0 = max(min(ta, tb), 0.0);
    t1 = min(max(ta, tb), 1500.0);
  } else if (abs(o.y) > HH) { return vec4f(0.0, 0.0, 0.0, -1.0); }
  let dens = clamp(tau * 0.45, 0.0, 0.92);
  if (t1 <= t0 || dens < 0.01) { return vec4f(0.0, 0.0, 0.0, -1.0); }
  let p0 = o + rd * (t0 + 0.01);
  var cell = floor(p0 / G);
  let stp = sign(rd);
  let inv = 1.0 / max(abs(rd), vec3f(1e-6));
  var tMax = ((cell + max(stp, vec3f(0.0))) * G - o) / rd;
  tMax = select(tMax, vec3f(1e9), abs(rd) < vec3f(1e-6));
  let tDelta = G * inv;
  var best = 1e9;
  var bn = vec3f(0.0);
  var bc = 0.0;
  var by = 0.0;
  for (var i = 0; i < 110; i++) {
    let ci = vec3i(cell);
    let wx = ((ci.x % 40000) + 40000) % 40000;
    let wz = ((ci.z % 40000) + 40000) % 40000;
    let h = hsh(wx + wz * 7919, ci.y + 50, 800);
    if (h < dens) {
      let c = (cell + 0.2 + 0.6 * vec3f(hsh(wx, wz + ci.y * 13, 801), hsh(wz, wx + ci.y * 7, 802), hsh(wx + ci.y, wz, 803))) * G;
      let rad = G * (0.1 + 0.35 * pow(hsh(wz + ci.y, wx, 804), 3.0));
      if (abs(c.y) < HH) {
        let hit = sph(o, rd, c, rad);
        if (hit.x > 0.0 && hit.x < best) {
          best = hit.x;
          // lumpy aggregates of ice rather than perfect spheres
          let q = (o + rd * hit.x - c) / rad;
          let bump = vec3f(n3(q * 2.2 + 30.0, 820), n3(q * 2.4 + 60.0, 821), n3(q * 2.0 + 90.0, 822)) - 0.5;
          bn = normalize(normalize(q) + bump * 1.1);
          bc = hsh(wx * 3, wz * 5, 805); by = c.y;
        }
      }
    }
    if (best < 1e8) { break; }
    let tm = min(tMax.x, min(tMax.y, tMax.z));
    if (tm > t1) { break; }
    if (tMax.x <= tMax.y && tMax.x <= tMax.z) { cell.x += stp.x; tMax.x += tDelta.x; }
    else if (tMax.y <= tMax.z) { cell.y += stp.y; tMax.y += tDelta.y; }
    else { cell.z += stp.z; tMax.z += tDelta.z; }
  }
  if (best > 1e8) { return vec4f(0.0, 0.0, 0.0, -1.0); }
  // sunlight reaching into the layer, Saturnshine from the planet's lit face, and a little light scattered between particles
  let depth = select(HH + by, HH - by, sun.y > 0.0) / (2.0 * HH);
  let shade = exp(-tau * depth / max(abs(sun.y), 0.08));
  let sd = normalize(sv.satPos - sv.camPos);
  let alb = vec3f(0.9, 0.86, 0.8) * (0.75 + 0.35 * bc);
  let c = alb * (max(dot(bn, sun), 0.0) * shade * sv.sunCol + vec3f(1.0, 0.85, 0.6) * max(dot(bn, sd), 0.0) * 0.12 + vec3f(0.03));
  return vec4f(c, best);
}
fn satHit(ro: vec3f, rd: vec3f) -> f32 {
  let s = SATR / SATRP;
  let oq = (ro - sv.satPos) * vec3f(1.0, s, 1.0);
  let rq = rd * vec3f(1.0, s, 1.0);
  let a = dot(rq, rq);
  let tc = -dot(oq, rq) / a;
  let c = oq + rq * tc;
  let d2 = SATR * SATR - dot(c, c);
  if (d2 < 0.0) { return -1.0; }
  return tc - sqrt(d2 / a);
}
fn satShade(p: vec3f) -> vec3f {
  let s = SATR / SATRP;
  let q = (p - sv.satPos) * vec3f(1.0, s, 1.0);
  let n = normalize(q * vec3f(1.0, s, 1.0));
  let lat = asin(clamp(n.y, -1.0, 1.0));
  let tw = fbm(vec3f(n.x * 3.0, lat * 40.0, n.z * 3.0), 350);
  var c = mix(vec3f(0.93, 0.83, 0.62), vec3f(0.76, 0.58, 0.36), 0.5 + 0.5 * sin(lat * 22.0 + tw * 2.5));
  c = mix(c, vec3f(0.97, 0.9, 0.72), sst(0.25, 0.0, abs(lat)) * 0.5);
  // the hexagonal jet stream around the north pole
  let phi = atan2(n.z, n.x);
  let hx = cos(0.5236) / cos((phi - floor(phi / 1.0472) * 1.0472) - 0.5236);
  let pr = (1.5708 - lat) / 0.26;
  c = mix(c, vec3f(0.36, 0.45, 0.55), step(pr, hx) * step(0.0, lat));
  // close up, the bands break into turbulent streaks sheared east-west by the zonal winds
  let dcam = length(p - sv.camPos);
  let near = sst(60000.0, 2500.0, dcam);
  if (near > 0.0) {
    let q = vec3f(n.x * 90.0, lat * 900.0, n.z * 90.0);
    let tb = fbm(q + vec3f(fbm(q * 0.5 + 7.0, 361) * 3.0, 0.0, 0.0), 362);
    let fine = fbm(q * 6.0, 363);
    c = mix(c, c * (0.35 + 1.1 * tb + 0.3 * (fine - 0.5)) * mix(vec3f(0.95, 0.85, 0.7), vec3f(1.05, 0.97, 0.85), tb), near);
  }
  let ndl = dot(n, sv.sunDir);
  var lit = max(ndl, 0.0);
  // shadow of the rings on the globe
  let pr0 = p - sv.satPos;
  if (sv.sunDir.y * pr0.y < 0.0) {
    let t = -pr0.y / sv.sunDir.y;
    let h = pr0 + sv.sunDir * t;
    lit *= exp(-ringTau(length(h.xz)) * 1.2);
  }
  return c * lit * sv.sunCol * mix(1.4, 0.85, near);
}

@fragment fn space(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  // same half-width checkerboard layout as the scene pass; the anti-aliasing pass fills in the other columns
  let px = vec2f(floor(fc.x) * 2.0 + f32((i32(fc.y) + i32(u.frame)) & 1) + 0.5, fc.y);
  let fj = px + u.jitter;
  let uv = vec2f(fj.x * 2.0 - u.res.x, u.res.y - fj.y * 2.0) / u.res.y;
  let ro = sv.camPos;
  let rd = normalize(sv.camFwd + (uv.x * sv.camRight + uv.y * sv.camUp) * sv.fov);
  let pix = sv.fov * 2.0 / u.res.y;
  let sun = sv.sunDir;

  // background: stars and the distant, tiny Sun (Saturn is 9.5 times farther from it than Earth)
  var col = vec3f(0.0);
  var starC = vec3f(0.0);
  let sc = rd * 420.0;
  let sid = floor(sc);
  let sh = hsh(i32(sid.x) + i32(sid.z) * 7919, i32(sid.y), 360);
  if (sh > 0.9965) { starC = mix(vec3f(0.7, 0.8, 1.0), vec3f(1.0, 0.85, 0.7), hsh(i32(sid.x), i32(sid.z), 361)) * (sh - 0.9965) * 900.0 * sst(0.45, 0.1, length(fract(sc) - 0.5)); }
  let sa = acos(clamp(dot(rd, sun), -1.0, 1.0));
  col += sv.sunCol * (sst(0.0012, 0.0004, sa) * 30.0 + exp(-sa * 60.0) * 0.25);
  var tOpaque = 1e12;

  // Saturn
  let ts = satHit(ro, rd);
  if (ts > 0.0) { tOpaque = ts; col = satShade(ro + rd * ts); }
  // Saturn's upper atmosphere: a haze layer about 1,500 km deep over the clouds, pale gold, bluish at the top
  {
    let sc = SATR / SATRP;
    let oq = (ro - sv.satPos) * vec3f(1.0, sc, 1.0);
    let rq = rd * vec3f(1.0, sc, 1.0);
    let aa = dot(rq, rq);
    let RA = SATR + 1500.0;
    let tc = -dot(oq, rq) / aa;
    let cq = oq + rq * tc;
    let d2 = RA * RA - dot(cq, cq);
    if (d2 > 0.0) {
      let hw = sqrt(d2 / aa);
      let ta0 = max(tc - hw, 0.0);
      var ta1 = tc + hw;
      if (ts > 0.0) { ta1 = min(ta1, ts); }
      if (ta1 > ta0) {
        let L = (ta1 - ta0) * sqrt(aa);
        let pm = normalize(oq + rq * (0.5 * (ta0 + ta1)));
        let litA = max(dot(pm, sv.sunDir), 0.0) * 0.9 + 0.05;
        let hz = 1.0 - exp(-L / 2600.0);
        let hc = mix(vec3f(0.95, 0.82, 0.6), vec3f(0.55, 0.7, 1.0), sst(0.3, 1.0, 1.0 - min(L / 12000.0, 1.0)));
        col = col * exp(-L / 14000.0) + hc * sv.sunCol * hz * litA * 0.22;
      }
    }
  }

  // moons: small lit spheres, drawn at least one pixel wide; Rhea and Hyperion glow
  for (var i = 0; i < 7; i++) {
    let m = sv.moonPos[i];
    let mc = sv.moonCol[i];
    let tm = sph(ro, rd, m.xyz, m.w);
    let dm = length(m.xyz - ro);
    let ang = acos(clamp(dot(rd, normalize(m.xyz - ro)), -1.0, 1.0));
    if (mc.w > 0.5) { col += mc.rgb * (exp(-ang / 0.003) * 0.5 + exp(-ang / 0.02) * 0.05); }
    // Hyperion is not round: 360 x 266 x 205 km
    var tmh = tm;
    let hsc = select(vec3f(1.0), vec3f(135.0 / 180.0, 135.0 / 103.0, 135.0 / 133.0), i == 5);
    if (i == 5) {
      // an irregular, sponge-like body: march an ellipsoid (180 x 133 x 103 km) with a lumpy, displaced surface
      tmh = vec2f(-1.0);
      let bnd = sph(ro, rd, m.xyz, 200.0);
      if (bnd.y > 0.0) {
        var t = max(bnd.x, 0.0);
        for (var k = 0; k < 48; k++) {
          let q = ro + rd * t - m.xyz;
          let e = q / vec3f(180.0, 103.0, 133.0);
          let dE = (length(e) - 1.0) * 103.0;
          let dq = dE + (n3(q / 38.0 + 300.0, 770) - 0.5) * 34.0 + (n3(q / 15.0 + 500.0, 771) - 0.5) * 10.0;
          if (dq < 0.02 * t / 1000.0 + 0.2) { tmh = vec2f(t); break; }
          t += max(dq * 0.6, 0.3);
          if (t > bnd.y) { break; }
        }
      }
    }
    if (i == 1 && dm < m.w * 40.0) { col += plumes(ro, rd, m, sun, tOpaque); }
    if (tmh.x > 0.0 && tmh.x < tOpaque) {
      tOpaque = tmh.x;
      var n0 = normalize((ro + rd * tmh.x - m.xyz) * hsc * hsc);
      if (i == 5) {
        // the lumpy surface's own normal
        let q = ro + rd * tmh.x - m.xyz;
        let hf = vec3f(2.0, 0.0, 0.0);
        let f = (length(q / vec3f(180.0, 103.0, 133.0)) - 1.0) * 103.0 + (n3(q / 38.0 + 300.0, 770) - 0.5) * 34.0;
        let fx = (length((q + hf.xyy) / vec3f(180.0, 103.0, 133.0)) - 1.0) * 103.0 + (n3((q + hf.xyy) / 38.0 + 300.0, 770) - 0.5) * 34.0;
        let fy = (length((q + hf.yxy) / vec3f(180.0, 103.0, 133.0)) - 1.0) * 103.0 + (n3((q + hf.yxy) / 38.0 + 300.0, 770) - 0.5) * 34.0;
        let fz = (length((q + hf.yyx) / vec3f(180.0, 103.0, 133.0)) - 1.0) * 103.0 + (n3((q + hf.yyx) / 38.0 + 300.0, 770) - 0.5) * 34.0;
        n0 = normalize(vec3f(fx - f, fy - f, fz - f));
      }
      // the direction each moon travels along its orbit (Saturn is at the centre of the orbit)
      let rel = m.xyz - sv.satPos;
      let vel = normalize(vec3f(rel.z, 0.0, -rel.x));
      // the glowing moons are still ice and rock underneath: grey Rhea, tan Hyperion
      let baseC = select(mc.rgb, select(vec3f(0.8, 0.79, 0.76), vec3f(0.62, 0.5, 0.4), i == 5), mc.w > 0.5);
      let ms = moonSurf(i, n0, baseC, vel, tmh.x, pix * tmh.x / m.w);
      let a = ms[0];
      let n = ms[1];
      col = a * (max(dot(n, sun), 0.0) * sv.sunCol + select(vec3f(0.0), mc.rgb * 0.35 * (0.4 + 0.6 * max(dot(n, n0), 0.0)), mc.w > 0.5));
    } else if (ang < pix * 1.2 && dm < tOpaque) {
      col += mc.rgb * (0.4 + 1.6 * mc.w) * sst(pix * 1.2, 0.0, ang);
    }
  }

  // Titan's surface
  let tt = sph(ro, rd, vec3f(0.0), TRK);
  if (tt.x > 0.0 && tt.x < tOpaque) {
    tOpaque = tt.x;
    let p = ro + rd * tt.x;
    let n = normalize(p);
    var al = titanAlb(n);
    var ns = n;
    // close to the surface, draw the same terrain the ground renderer uses, with relief shading
    let near = sst(400.0, 60.0, tt.x);
    if (near > 0.0) {
      var h0 = 0.0;
      var h1 = 0.0;
      var h2 = 0.0;
      bBlur = clamp(tt.x / 900.0, 0.0, 0.12);
      let a0 = nearSurf(n, &h0);
      let e1 = normalize(cross(n, vec3f(0.0, 1.0, 0.0001)));
      let e2 = cross(n, e1);
      let ea = max(tt.x * pix * 1.5, 0.15) / TRK;
      _ = nearSurf(normalize(n + e1 * ea), &h1);
      _ = nearSurf(normalize(n + e2 * ea), &h2);
      let slope = (e1 * (h1 - h0) + e2 * (h2 - h0)) / (ea * TRK);
      ns = normalize(mix(n, normalize(n - slope), near));
      al = vec4f(mix(al.rgb, a0.rgb * 1.25, near), mix(al.w, a0.w, near));
    }
    let ndl = dot(ns, sun);
    let ts2 = sunTrans(p + n * 0.5);
    var c = al.rgb * sv.sunCol * max(ndl, 0.0) * ts2 * 1.3 * sst(-0.05, 0.1, dot(n, sun) + 0.08);
    c += al.rgb * vec3f(0.9, 0.55, 0.25) * 0.18 * sst(-0.2, 0.3, ndl) * sv.sunCol;
    // sunglint on the methane seas
    let rf = reflect(rd, n);
    c += sv.sunCol * pow(max(dot(rf, sun), 0.0), 350.0) * 9.0 * sst(0.8, 0.95, al.w) * ts2;
    // the city's lights on the night side
    let ca = acos(clamp(dot(n, sv.homeDir), -1.0, 1.0)) * TRK;
    c += vec3f(1.0, 0.7, 0.4) * sv.cityOn * (exp(-pow(ca / 5.0, 2.0)) * 3.0 + exp(-ca / 18.0) * 0.4) * sst(0.1, -0.1, ndl);
    col = c;
  }

  // Titan's atmosphere: thick orange haze with strong forward scattering, and the detached layer near 500 km
  let ta = sph(ro, rd, vec3f(0.0), TRK + ATM);
  var aCol = vec3f(0.0);
  var aT = 1.0;
  var aT0 = 1e12;
  if (ta.y > 0.0) {
    let t0 = max(ta.x, 0.0);
    let t1 = min(ta.y, tOpaque);
    aT0 = t0;
    if (t1 > t0) {
      let N = 18;
      let ds = (t1 - t0) / f32(N);
      let cth = dot(rd, sun);
      let ph = phaseHG(cth, 0.62) * 0.8 + phaseHG(cth, -0.2) * 0.2;
      let phD = phaseHG(cth, 0.25);
      let sig0 = sv.haze / HS;
      for (var i = 0; i < N; i++) {
        let p = ro + rd * (t0 + (f32(i) + 0.5) * ds);
        let h = length(p) - TRK;
        let sg = sig0 * exp(-h / HS) + 0.07 * exp(-max(h, 0.0) / 2.0);
        let sd = sig0 * 0.035 * exp(-pow((h - 500.0) / 14.0, 2.0));
        let ts3 = sunTrans(p);
        aCol += aT * (sg * vec3f(1.0, 0.56, 0.2) * ph + sd * vec3f(0.3, 0.55, 1.0) * phD * 2.0) * ts3 * ds * 6.0;
        aT *= exp(-(sg + sd) * ds);
      }
      aCol *= sv.sunCol;
    }
  }

  // Saturn's rings: semi-transparent, lit or backlit, with Saturn's shadow across them
  var rA = 0.0;
  var rC = vec3f(0.0);
  var tR = 1e13;
  if (abs(rd.y) > 1e-7) {
    let t = -ro.y / rd.y;
    if (t > 0.0 && t < tOpaque) {
      let h = ro + rd * t;
      let r = length(h.xz - sv.satPos.xz);
      rFoot = t * pix / max(abs(rd.y), 0.02);
      let tau = ringTau(r);
      if (tau > 0.0) {
        rA = 1.0 - exp(-tau / max(abs(rd.y), 0.03));
        tR = t;
        let same = sign(sun.y) == sign(ro.y);
        let dens = 1.0 - exp(-tau);
        var b = select(dens * exp(-tau) * 2.2, 0.35 + 0.65 * dens, same) * max(abs(sun.y), 0.05) * 3.0;
        let s2 = sph(h, sun, sv.satPos, SATR);
        if (s2.x > 0.0) { b *= 0.03; }
        // fine radial ringlets, visible from a few km up
        let rl = 0.78 + 0.3 * n3(vec3f(r / 2.3, 0.5, 0.5), 810) * sst(4.0, 1.0, rFoot) + 0.12 * n3(vec3f(r / 0.4, 0.5, 0.5), 811) * sst(0.8, 0.2, rFoot) + 0.21 * (1.0 - sst(4.0, 1.0, rFoot));
        rC = ringCol(r) * sv.sunCol * b * rl;
      }
    }
  }
  // seen almost edge-on (as from Titan), the rings shrink to a line thinner than a pixel: draw it anti-aliased
  if (rA < 0.02) {
    let tc = dot(sv.satPos - ro, rd);
    if (tc > 0.0 && tc < tOpaque) {
      let pc = ro + rd * tc;
      let wy = abs(pc.y) / max(tc * pix, 1.0);
      let r = length(pc.xz - sv.satPos.xz);
      let tau = ringTau(r);
      if (wy < 1.5 && tau > 0.0) {
        let a = (1.0 - exp(-tau * 3.0)) * sst(1.5, 0.0, wy) * 0.8;
        if (a > rA) { rA = a; tR = tc; rC = ringCol(r) * sv.sunCol * 0.9; }
      }
    }
  }

  // close to the ring plane, the nearest few hundred metres resolve into individual particles
  if (sv.ringLoc.w > 0.5) {
    let rc = length(ro.xz - sv.satPos.xz);
    let tauC = ringTau(rc);
    let rp = ringParticles(rd, tauC, sun);
    if (rp.w > 0.0) {
      col = mix(rp.rgb, rC, sst(300.0, 900.0, rp.w) * rA);
      rA = 0.0;
    } else if (abs(rd.y) > 1e-6 && tR < 1.5) {
      rA *= 0.35;
    }
  }
  // composite the two translucent layers back to front
  // stars are washed out by the glow of the sky around the camera
  if (tOpaque > 1e11) { col += starC * exp(-dot(aCol, vec3f(0.3, 0.5, 0.2)) * 12.0); }
  if (tR > aT0) {
    col = mix(col, rC, rA);
    col = col * aT + aCol;
  } else {
    col = col * aT + aCol;
    col = mix(col, rC, rA);
  }
  return vec4f(col * sv.exposure, sv.alpha);
}
