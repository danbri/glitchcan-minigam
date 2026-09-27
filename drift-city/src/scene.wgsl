const CS: f32 = 26.0;
const HALF: f32 = 13.0;
const FOOT: f32 = 9.6;
const NC: i32 = 96;
const BIG: f32 = 208.0;
const PI: f32 = 3.14159265;
const TMAX: f32 = 1200.0;
const TS: f32 = 6.5;
const AIR_Y: f32 = 96.0;
const LANE: f32 = 1.25;
const CAR_L: f32 = 26.0;
const CAR_V: f32 = 9.0;
const DRONE_Y: f32 = 44.0;
const CHASE_Y: f32 = 64.0;
const SIG_G: f32 = 5.0;
const SIG_A: f32 = 1.0;
const SIG_P: f32 = 12.0;
const SIG_PH: f32 = 18.9;

@group(0) @binding(1) var cellTex: texture_2d<f32>;

struct SP { lx: vec3f, ts: f32, ly: vec3f, n: f32, lz: vec3f, gen: f32 };
@group(0) @binding(2) var<uniform> sp: SP;
@group(0) @binding(3) var shadowTex: texture_2d<u32>;
@group(0) @binding(4) var shadowOut: texture_storage_2d<rg32uint, write>;
@group(0) @binding(5) var<uniform> rectU: vec4i;
@group(0) @binding(6) var proxyTex: texture_2d<f32>;
@group(0) @binding(7) var treeTexA: texture_2d<f32>;
@group(0) @binding(8) var treeTexB: texture_2d<f32>;
@group(0) @binding(9) var treeOutA: texture_storage_2d<rgba32float, write>;
@group(0) @binding(10) var treeOutB: texture_storage_2d<rgba32float, write>;
const TN: i32 = 384;
struct EV { beamPos: array<vec4f, 4>, beamDir: array<vec4f, 4>, smoke: array<vec4f, 4>, koi: vec4f, koiDir: vec4f, blimp: vec4f, blimpDir: vec4f, bo: vec4f,
  sky: vec4f, meteorA: vec4f, meteorB: vec4f, fw: array<vec4f, 3>, fwCol: array<vec4f, 3>, launch: vec4f, balloon: array<vec4f, 3>,
  sat: vec4f, ringN: vec4f, moonA: vec4f, moonB: vec4f,
  blk: vec4f, steam: vec4f, ship: array<vec4f, 8>, shipDir: array<vec4f, 8>, wx: vec4f, life: array<vec4f, 64> };
// Conway's Life (life.js): 64 columns by 40 rows from the top, 16 cells to a float
fn lifeAt(col: i32, row: i32) -> f32 {
  if (row < 0 || row >= 40) { return 0.0; }
  let i = u32(row * 64 + ((col % 64) + 64) % 64);
  let f = ev.life[i >> 6u][(i >> 4u) & 3u];
  return f32((u32(f) >> (i & 15u)) & 1u);
}
struct EscG { ok: bool, a: vec3f, b: vec3f };
@group(0) @binding(11) var<uniform> ev: EV;
// flocking creatures: count in n.x; per creature a[2i] = position (m) and size, a[2i+1] = heading and flap phase
struct Flock { n: vec4f, g: array<vec4f, 4>, a: array<vec4f, 192> };
@group(0) @binding(21) var<uniform> fl: Flock;
// story props: count in n.x; per prop a[2i] = position (m) and kind, a[2i+1] = yaw, scale, hue, parameter
struct Props { n: vec4f, a: array<vec4f, 64> };
@group(0) @binding(22) var<uniform> pr: Props;
struct TB { glyph: array<vec4u, 32>, word: array<vec4u, 107> };
@group(0) @binding(12) var<uniform> tb: TB;
@group(0) @binding(13) var terrTex: texture_2d<f32>;
@group(0) @binding(14) var ffBTex: texture_2d<f32>;
@group(0) @binding(15) var ffMax: texture_2d<f32>;
@group(0) @binding(16) var terrOut: texture_storage_2d<rgba32float, write>;
// anchor frame and Titan's large features, for the terrain builder (see geoField in world.js)
struct GeoU { e: vec4f, up: vec4f, n: vec4f, cnt: vec4f, f: array<vec4f, 24>, g: array<vec4f, 24> };
@group(0) @binding(20) var<uniform> geo: GeoU;
@group(0) @binding(17) var mipSrc: texture_2d<f32>;
@group(0) @binding(18) var mipOut: texture_storage_2d<rgba32float, write>;
const NWI: i32 = 768;
const LW: f32 = 19968.0;
const FARMAX: f32 = 9000.0;
const GMAX: f32 = 900.0;
struct FarHit { t: f32, kind: i32, c: vec2i, lvl: i32 };
struct BW { sea: f32, mnt: f32, mid: f32, des: f32, bad: f32, swp: f32, fo: f32 };
var<private> gFarKind: i32 = 0;

struct Cell { typ: i32, roof: i32, fl: i32, treeTop: f32, h: f32, top: f32, w: vec2f, off: vec2f, v: f32, s: f32, seed: i32, egg: i32 };
struct Hit { t: f32, m: f32, kind: i32, c: vec2i };
struct CarQ { d: f32, la: f32, lat: f32, seed: i32, ok: f32, kind: i32, yb: f32 };
struct Surf { alb: vec3f, emi: vec3f, spec: f32, refl: f32, rough: f32, trans: f32, tint: vec3f, wet: f32 };
struct SignG { ok: bool, ctr: vec3f, half: vec3f, axisX: bool, sgn: f32 };

var<private> tqId: vec2i = vec2i(2147483647, 0);
var<private> tq: array<vec4f, 4>;
var<private> tq2: array<vec4f, 4>;
var<private> gNoDyn: bool = false;
var<private> clKey: i32 = 2147483647;
var<private> clA: array<vec4f, 6>;
var<private> clB: array<vec4f, 6>;
var<private> gkKey: i32 = 2147483647;
var<private> gkA: array<vec4f, 6>;
var<private> gkB: array<vec4f, 6>;
var<private> lcKey: array<vec2i, 4> = array<vec2i, 4>(vec2i(2147483647), vec2i(2147483647), vec2i(2147483647), vec2i(2147483647));
var<private> lcTyp: array<i32, 4>;
var<private> pcKey: vec2i = vec2i(2147483647);
var<private> pcDens: f32 = 0.0;

fn vnoise(p: vec2f, k: i32) -> f32 {
  let i = floor(p);
  let f = p - i;
  let w = f * f * (3.0 - 2.0 * f);
  let ix = i32(i.x);
  let iy = i32(i.y);
  return mix(mix(hsh(ix, iy, k), hsh(ix + 1, iy, k), w.x), mix(hsh(ix, iy + 1, k), hsh(ix + 1, iy + 1, k), w.x), w.y);
}

fn forestF(xz: vec2f) -> f32 {
  let n = vnoise(xz / 260.0, 7) * 0.7 + vnoise(xz / 90.0, 8) * 0.3;
  return smoothstep(0.5, 0.66, n);
}

fn rot2(v: vec2f, a: f32) -> vec2f {
  let c = cos(a);
  let s = sin(a);
  return vec2f(c * v.x - s * v.y, s * v.x + c * v.y);
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

fn sdBox(p: vec3f, b: vec3f) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn sdRoundRect(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + r;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

fn sdCrystal(p: vec3f, r: f32, h: f32) -> f32 {
  let q = abs(p.xz);
  let hr = max(q.x * 0.866025 + q.y * 0.5, q.y);
  let k = 1.9;
  let tip = ((p.y - h) + k * hr) / sqrt(1.0 + k * k);
  return max(max(hr - r, tip), -p.y - 1.0);
}

// ---------- cell data ----------
fn slotOf(c: vec2i) -> vec2i {
  return vec2i(((c.x % NC) + NC) % NC, ((c.y % NC) + NC) % NC);
}

fn cellHead(c: vec2i) -> Cell {
  var o: Cell;
  let s = slotOf(c);
  let t0 = textureLoad(cellTex, vec2i(s.x * 3, s.y), 0);
  if (i32(round(t0.x)) != c.x || i32(round(t0.y)) != c.y) {
    o.typ = 7;
    return o;
  }
  let code = i32(round(t0.z));
  o.typ = code & 15;
  o.roof = (code >> 4) & 1;
  o.fl = code >> 5;
  o.treeTop = t0.w;
  let t1 = textureLoad(cellTex, vec2i(s.x * 3 + 1, s.y), 0);
  o.h = t1.x;
  o.top = t1.y;
  o.w = t1.zw;
  let cw = wrapC(c);
  o.seed = cw.x * 7919 + cw.y * 104729;
  return o;
}

fn cellFull(c: vec2i) -> Cell {
  var o = cellHead(c);
  if (o.typ == 7) { return o; }
  let s = slotOf(c);
  let t2 = textureLoad(cellTex, vec2i(s.x * 3 + 2, s.y), 0);
  o.off = t2.xy;
  o.v = t2.z;
  o.s = fract(t2.w);
  o.egg = i32(floor(t2.w));
  return o;
}

// ---------- the wraparound world ----------
fn wrapS(i: i32) -> i32 { return ((((i + 384) % NWI) + NWI) % NWI) - 384; }
fn wrapN(i: i32, n: i32) -> i32 { let h = n / 2; return ((((i + h) % n) + n) % n) - h; }
fn wrapC(c: vec2i) -> vec2i { return vec2i(wrapS(c.x), wrapS(c.y)); }
fn wrapP(x: vec2f) -> vec2f { return x - LW * round(x / LW); }
fn wrapT(v: vec2i) -> vec2i { return vec2i(((v.x % NWI) + NWI) % NWI, ((v.y % NWI) + NWI) % NWI); }
fn sstepJ(a: f32, b: f32, x: f32) -> f32 { let t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
fn isCityTyp(t: i32) -> bool { return t <= 3 || t == 8 || t == 9 || t == 10 || t == 11 || t == 13; }
fn pvn(p: vec2f, s: f32, k: i32) -> f32 {
  let n = i32(round(LW / s));
  let q = p / s;
  let i = vec2i(floor(q));
  let f = q - vec2f(i);
  let w = f * f * (3.0 - 2.0 * f);
  let x0 = ((i.x % n) + n) % n;
  let z0 = ((i.y % n) + n) % n;
  let x1 = (x0 + 1) % n;
  let z1 = (z0 + 1) % n;
  return mix(mix(hsh(x0, z0, k), hsh(x1, z0, k), w.x), mix(hsh(x0, z1, k), hsh(x1, z1, k), w.x), w.y);
}
fn cityDist(p: vec2f) -> f32 { return length(wrapP(p)); }
fn repP(p: vec2f) -> vec2f { return u.reg2.xy + wrapP(p - u.reg2.xy); }
// the city's shape: a core and the harbour arm to the shore (as citySdf in world.js); cityDist - cityR = citySdf
fn citySdf(p: vec2f) -> f32 {
  let q = wrapP(p);
  let a = vec2f(3300.0, -3300.0);
  let core = 1700.0 + 380.0 * (pvn(p, 1248.0, 201) - 0.5) + 200.0 * (pvn(p, 624.0, 202) - 0.5);
  let t = clamp(dot(q, a) / dot(a, a), 0.0, 1.0);
  return min(length(q) - core, length(q - a * t) - 380.0);
}
fn cityR(p: vec2f) -> f32 { if (u.reg.w < 0.5 || length(repP(p) + u.reg.xy) > 14000.0) { return -1e9; } return cityDist(p) - citySdf(p); }
fn oasisAt(p: vec2f) -> vec2f {
  let g = vec2i(floor(p / 1248.0));
  let h = vec2i(((g.x % 16) + 16) % 16, ((g.y % 16) + 16) % 16);
  if (hsh(h.x, h.y, 233) > 0.35) { return vec2f(1e9, 0.0); }
  let o = (vec2f(g) + 0.3 + 0.4 * vec2f(hsh(h.x, h.y, 234), hsh(h.x, h.y, 235))) * 1248.0;
  return vec2f(length(p - o), 8.0 + 26.0 * pvn(o, 2496.0, 231));
}
fn biomeW(dry: f32, elev: f32) -> BW {
  var w: BW;
  w.sea = sstepJ(0.40, 0.34, elev);
  w.mnt = sstepJ(0.60, 0.70, elev);
  w.mid = max(0.0, 1.0 - w.sea - w.mnt);
  w.des = sstepJ(0.56, 0.63, dry);
  w.bad = sstepJ(0.46, 0.52, dry) * (1.0 - w.des);
  w.swp = sstepJ(0.40, 0.34, dry) * sstepJ(0.52, 0.45, elev);
  w.fo = max(0.0, 1.0 - w.des - w.bad - w.swp);
  return w;
}
// ground height, water level (-100 = none), dryness and elevation
fn gn3(p: vec3f, k: i32) -> f32 {
  let i = vec3i(floor(p));
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  let a = mix(hsh(i.x + i.z * 7919, i.y, k), hsh(i.x + 1 + i.z * 7919, i.y, k), w.x);
  let b = mix(hsh(i.x + i.z * 7919, i.y + 1, k), hsh(i.x + 1 + i.z * 7919, i.y + 1, k), w.x);
  let c = mix(hsh(i.x + (i.z + 1) * 7919, i.y, k), hsh(i.x + 1 + (i.z + 1) * 7919, i.y, k), w.x);
  let d = mix(hsh(i.x + (i.z + 1) * 7919, i.y + 1, k), hsh(i.x + 1 + (i.z + 1) * 7919, i.y + 1, k), w.x);
  return mix(mix(a, b, w.y), mix(c, d, w.y), w.z);
}
// large-scale geography at an absolute point; mirrors geoField in world.js
fn geoN(a: vec2f) -> vec3f { return normalize(geo.up.xyz * 2575000.0 + geo.e.xyz * a.x - geo.n.xyz * a.y); }
fn geoField(n: vec3f) -> vec4f {
  var o = vec4f(0.0);
  let nc = i32(geo.cnt.x);
  if (nc == 0) { return o; }
  let wob = (gn3(n * 64.0 + 1000.0, 460) - 0.5) * 0.3;
  for (var i = 0; i < nc; i++) {
    let f = geo.f[i];
    let k = 2.0 * 2575000.0 * asin(min(length(n - f.xyz) * 0.5, 1.0)) / f.w;
    if (k > 1.6) { continue; }
    let t = i32(geo.g[i].x);
    if (t == 1) { let q = sstepJ(1.0, 0.8, k + wob); o.y -= 0.3 * q; o.x -= 0.05 * q; }
    else if (t == 3) { let q = sstepJ(1.1, 0.85, k + wob); o.x += 0.3 * q; o.y += 0.02 * q; o.w = max(o.w, q); }
    else if (t == 4) { o.y += 0.2 * sstepJ(1.1, 0.8, k + wob); }
    else if (t == 5) { let q = sstepJ(1.1, 0.8, k + wob); o.y += 0.07 * q; o.x += 0.05 * q; }
    else if (t == 6) { let hr = clamp(0.012 * f.w, 150.0, 700.0); let e = (k - 1.0) / 0.1; o.z += hr * exp(-e * e) - 0.7 * hr * sstepJ(1.0, 0.8, k) + 0.3 * hr * exp(-max(k - 1.0, 0.0) / 0.35) * sstepJ(0.95, 1.05, k); }
    else if (t == 7) { o.z -= 1700.0 * sstepJ(1.05, 0.7, k); }
    else if (t == 8) { o.z += 1450.0 * exp(-k * k * 2.5); }
  }
  let pl = sstepJ(0.87, 0.93, abs(n.y));
  if (pl > 0.0) { let lk = pl * sstepJ(0.58, 0.64, gn3(n * 171.0 + 1000.0, 470)); o.y -= 0.25 * lk; o.x -= 0.1 * pl; }
  return o;
}
var<private> tq3: vec3f;
fn tn(S: f32, k: i32) -> f32 { return 0.5 + (gn3(tq3 / S + 20000.0, k) - 0.5) * 1.17; }
// signed river field at the current terrain point plus an offset in metres (mirrors world.js)
fn rvAt(o: vec3f) -> f32 {
  let q = tq3 + o;
  return gn3(q / 6000.0 + 20000.0, 480) * 1.17 + (gn3(q / 1500.0 + 20000.0, 481) - 0.5) * 0.14 - 0.585 + 0.5 * 0.17;
}
fn terrainAt(pIn: vec2f) -> vec4f {
  let p0 = repP(pIn);
  let p = p0;
  let nv = geoN(p0 + u.reg.xy);
  let g = geoField(nv);
  tq3 = nv * 2575000.0;
  let northM = asin(nv.y) * 2575000.0;
  let dry = tn(4992.0, 203) * 0.65 + tn(2496.0, 204) * 0.35 + g.x;
  let elev = tn(4992.0, 205) * 0.6 + tn(2496.0, 206) * 0.3 + tn(1248.0, 207) * 0.1 + g.y;
  let edge = sstepJ(0.0, 1.0, (cityDist(p0) - cityR(p0)) / 1400.0);
  if (edge <= 0.0) { return vec4f(0.0, -100.0, dry, elev); }
  let w = biomeW(dry, elev);
  var H = 0.0;
  var W = -100.0;
  if (w.sea > 0.0) { H += w.sea * (-6.0 - 34.0 * tn(1248.0, 260)); if (w.sea > 0.02) { W = 0.0; } }
  if (w.mnt > 0.0) {
    var m = 0.0;
    var a = 1.0;
    var sc = 1248.0;
    for (var i = 0; i < 5; i++) { let n = 1.0 - abs(tn(sc, 210 + i) * 2.0 - 1.0); m += n * n * a; a *= 0.5; sc *= 0.5; }
    m /= 1.9375;
    H += w.mnt * (40.0 + 760.0 * m * m);
  }
  if (w.mid > 0.0) {
    var hm = 0.0;
    if (w.fo > 0.0) { let f = tn(1248.0, 240) * 0.6 + tn(624.0, 241) * 0.3 + tn(312.0, 242) * 0.1; hm += w.fo * (6.0 + 70.0 * f * f); }
    if (w.des > 0.0) {
      let d = sin(northM * 0.0242 + 6.0 * tn(1248.0, 230));
      var hd = 8.0 + 26.0 * tn(2496.0, 231) + 14.0 * (0.5 + 0.5 * d) * (0.5 + 0.5 * d) * tn(624.0, 232);
      if (w.des * w.mid > 0.5 && edge > 0.99) {
        let oa = oasisAt(p0);
        if (oa.x < 110.0) { hd = oa.y - 3.5 + (hd - oa.y + 3.5) * sstepJ(30.0, 100.0, oa.x); if (oa.x < 70.0) { W = max(W, oa.y - 1.2); } }
      }
      hm += w.des * hd;
    }
    if (w.bad > 0.0) {
      let b = tn(624.0, 220) * 0.57 + tn(312.0, 221) * 0.29 + tn(156.0, 222) * 0.14;
      let tb = b * 7.0;
      let fl = floor(tb);
      hm += w.bad * (15.0 + 190.0 * (fl + sstepJ(0.75, 0.95, tb - fl)) / 7.0);
    }
    if (w.swp > 0.0) { hm += w.swp * (0.6 + 2.2 * tn(156.0, 250) * tn(624.0, 251)); if (w.swp * w.mid > 0.35) { W = max(W, 1.4); } }
    H += w.mid * hm;
  }
  // methane rivers (mirrors world.js)
  let r0 = rvAt(vec3f(0.0));
  let rv0 = abs(r0);
  if (rv0 < 0.06 && edge > 0.99) {
    let gr = vec3f(rvAt(vec3f(40.0, 0.0, 0.0)), rvAt(vec3f(0.0, 40.0, 0.0)), rvAt(vec3f(0.0, 0.0, 40.0))) - r0;
    let dm = rv0 / max(length(gr) / 40.0, 1e-7);
    let ch = sstepJ(55.0, 18.0, dm) * (1.0 - sstepJ(0.2, 0.5, w.mnt)) * (1.0 - sstepJ(0.3, 0.6, w.sea));
    if (ch > 0.0) {
      if (w.des < 0.5 && ch > 0.4 && H < 40.0) { W = max(W, H - 1.8); }
      H -= 5.0 * ch;
    }
  }
  var Hd = H;
  if (g.w > 0.0 && w.des > 0.0) {
    Hd += 90.0 * g.w * w.des * w.mid * pow(0.5 + 0.5 * sin(northM * 0.002618 + 3.0 * tn(5000.0, 471)), 2.5);
  }
  return vec4f(edge * Hd + g.z, select(-100.0, W, edge > 0.01), dry, elev);
}
fn wildTreeDens(tv: vec4f, p: vec2f) -> f32 {
  if (tv.y > tv.x - 0.3) { return 0.0; }
  let w = biomeW(tv.z, tv.w);
  var d = w.mnt * 0.75 * sstepJ(440.0, 330.0, tv.x) + w.mid * (w.fo * 0.8 + w.swp * 0.45 + w.bad * 0.06 + w.des * 0.03) + w.sea * 0.1 * sstepJ(1.0, 4.0, tv.x);
  if (w.des > 0.3) { let oa = oasisAt(p); if (oa.x < 120.0) { d = max(d, 0.9 * sstepJ(120.0, 70.0, oa.x)); } }
  return d;
}
fn isHall(b: vec2i) -> bool {
  let bw = vec2i(wrapN(b.x, 96), wrapN(b.y, 96));
  return u.reg.w > 0.5 && bw.x == 3 && bw.y == -4 && length(repP((vec2f(b) + 0.5) * BIG) + u.reg.xy) < 14000.0;
}
fn isFab(b: vec2i) -> bool { return u.reg.w > 0.5 && wrapN(b.x, 96) == 5 && wrapN(b.y, 96) == 5; }
// the beam from the orbital power station, pointing up it (BEAM_DIR in world.js), and its receiver cup
const BEAM_B: vec3f = vec3f(-0.3215, 0.9186, 0.2297);
const FAB_W: vec2f = vec2f(1144.0, 1144.0);
fn giantHasW(b: vec2i) -> bool {
  if (isHall(b) || isHive(b) || isFab(b)) { return true; }
  let bw = vec2i(wrapN(b.x, 96), wrapN(b.y, 96));
  // placed, not scattered (GIANT_BLOCKS in world.js): the ringed spire in the core
  return u.reg.w > 0.5 && bw.x == 0 && bw.y == -1;
}
fn giantTop(b: vec2i) -> f32 { if (isHall(b)) { return 96.0; } if (isHive(b)) { return 272.0; } if (isFab(b)) { return 124.0; } return 150.0 + 110.0 * hsh(wrapN(b.x, 96), wrapN(b.y, 96), 21); }

// terrain samples: one texel per block corner, bilinear between them
fn terrV(v: vec2i) -> vec4f { return textureLoad(terrTex, wrapT(v), 0); }
fn terrAt(xz: vec2f) -> vec4f {
  let g = xz / CS;
  let i = vec2i(floor(g));
  let f = g - vec2f(i);
  return mix(mix(terrV(i), terrV(i + vec2i(1, 0)), f.x), mix(terrV(i + vec2i(0, 1)), terrV(i + vec2i(1, 1)), f.x), f.y);
}
fn surfH(t: vec4f) -> f32 { return max(t.x, t.y); }

@compute @workgroup_size(8, 8) fn terrBuild(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= u32(NWI) || gid.y >= u32(NWI)) { return; }
  textureStore(terrOut, vec2i(gid.xy), terrainAt(vec2f(gid.xy) * CS));
}
// max-height pyramid for the far-field traversal: (max surface, min surface, max with buildings)
@compute @workgroup_size(8, 8) fn mipBase(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= u32(NWI) || gid.y >= u32(NWI)) { return; }
  let c = vec2i(gid.xy);
  let a = surfH(terrV(c));
  let b = surfH(terrV(c + vec2i(1, 0)));
  let cc = surfH(terrV(c + vec2i(0, 1)));
  let d = surfH(terrV(c + vec2i(1, 1)));
  let mx = max(max(a, b), max(cc, d));
  textureStore(mipOut, c, vec4f(mx, min(min(a, b), min(cc, d)), max(mx, textureLoad(ffBTex, c, 0).x), 0.0));
}
@compute @workgroup_size(8, 8) fn mipDown(@builtin(global_invocation_id) gid: vec3u) {
  let n = vec2i(textureDimensions(mipSrc));
  let o = vec2i(gid.xy);
  if (o.x * 2 >= n.x || o.y * 2 >= n.y) { return; }
  let a = textureLoad(mipSrc, o * 2, 0);
  let b = textureLoad(mipSrc, o * 2 + vec2i(1, 0), 0);
  let c = textureLoad(mipSrc, o * 2 + vec2i(0, 1), 0);
  let d = textureLoad(mipSrc, o * 2 + vec2i(1, 1), 0);
  textureStore(mipOut, o, vec4f(max(max(a.x, b.x), max(c.x, d.x)), min(min(a.y, b.y), min(c.y, d.y)), max(max(a.z, b.z), max(c.z, d.z)), 0.0));
}

// ---------- shapes ----------
fn prepCluster(r: f32, n: i32, spread: f32, tilt: f32, satH: f32, seed: i32, giant: bool) {
  for (var i = 0; i < n; i++) {
    let az = (f32(i) + hsh(seed, i, 30) * 0.6) / f32(n) * 2.0 * PI;
    let od = spread * (0.6 + 0.4 * hsh(seed, i, 31));
    let tl = tilt * (0.6 + 0.4 * hsh(seed, i, 32));
    let a = vec4f(cos(az) * od, sin(az) * od, cos(az), sin(az));
    let b = vec4f(cos(tl), sin(tl), satH * (0.55 + 0.45 * hsh(seed, i, 33)), r * (0.35 + 0.25 * hsh(seed, i, 34)));
    if (giant) { gkA[i] = a; gkB[i] = b; } else { clA[i] = a; clB[i] = b; }
  }
}

fn cluster(p: vec3f, h: f32, r: f32, n: i32, spread: f32, tilt: f32, satH: f32, seed: i32, tw: f32, giant: bool) -> f32 {
  let key = seed * 8 + n;
  if (giant) {
    if (key != gkKey) { gkKey = key; prepCluster(r, n, spread, tilt, satH, seed, true); }
  } else if (key != clKey) {
    clKey = key;
    prepCluster(r, n, spread, tilt, satH, seed, false);
  }
  let cz = rot2(p.xz, p.y * tw);
  let rr = r * (1.0 + 0.03 * sin(p.y * 0.3 + f32(seed & 7)));
  var d = sdCrystal(vec3f(cz.x, p.y, cz.y), rr, h) * 0.85;
  for (var i = 0; i < n; i++) {
    let A = select(clA[i], gkA[i], giant);
    let B = select(clB[i], gkB[i], giant);
    let q0 = p - vec3f(A.x, 0.0, A.y);
    let qx = A.z * q0.x + A.w * q0.z;
    let qz = -A.w * q0.x + A.z * q0.z;
    let q = vec3f(B.x * qx - B.y * q0.y, B.y * qx + B.x * q0.y, qz);
    d = smin(d, sdCrystal(q, B.w, B.z), r * 0.5);
  }
  return d;
}

fn modern(p: vec3f, c: Cell) -> vec2f {
  let h = c.h;
  let w = c.w;
  var d = 0.0;
  var m = 1.0;
  if (c.v < 0.4) {
    let d1 = sdBox(p - vec3f(0.0, h * 0.3, 0.0), vec3f(w.x, h * 0.3, w.y));
    let d2 = sdBox(p - vec3f(0.0, h * 0.5, 0.0), vec3f(w.x * 0.74, h * 0.5, w.y * 0.74));
    let d3 = sdBox(p - vec3f(0.0, h * 0.53, 0.0), vec3f(w.x * 0.5, h * 0.53, w.y * 0.5));
    d = min(min(d1, d2), d3) - 0.2;
  } else if (c.v < 0.72) {
    let rr = min(w.x, w.y) * 0.85;
    d = max(sdRoundRect(p.xz, w, rr), abs(p.y - h * 0.5) - h * 0.5);
    let sy = p.y - 4.0 * round(p.y / 4.0);
    let slab = max(max(sdRoundRect(p.xz, w + 0.45, rr + 0.45), abs(sy) - 0.22), p.y - h);
    if (slab < d) { m = 10.0; }
    d = min(d, slab);
  } else {
    var ww = min(w, vec2f(6.2));
    ww *= min(1.0, (9.1 - length(c.off)) / length(ww));
    let a = p.y * 0.011 * select(-1.0, 1.0, c.s > 0.5);
    let qz = rot2(p.xz, a);
    d = (sdBox(vec3f(qz.x, p.y - h * 0.5, qz.y), vec3f(ww.x, h * 0.5, ww.y)) - 0.3) * 0.85;
  }
  if (h > 80.0) {
    let ant = max(length(p.xz) - 0.35, abs(p.y - (h + 7.0)) - 8.0);
    if (ant < d) { m = 10.0; }
    d = min(d, ant);
  }
  return vec2f(d, m);
}

fn historic(p: vec3f, c: Cell) -> vec2f {
  let h = c.h;
  let w = c.w;
  var d = 0.0;
  var m = 2.0;
  if (c.v < 0.45) {
    d = sdBox(p - vec3f(0.0, h * 0.5, 0.0), vec3f(w.x, h * 0.5, w.y));
    d = min(d, sdBox(p - vec3f(0.0, h - 0.4, 0.0), vec3f(w.x + 0.35, 0.4, w.y + 0.35)));
    let r = min(w.x, w.y) * 0.62;
    d = min(d, max(length(p.xz) - r, abs(p.y - (h + 2.0)) - 2.0));
    let dome = max(length(p - vec3f(0.0, h + 4.0, 0.0)) - r, h + 4.0 - p.y);
    let lan = max(length(p.xz) - r * 0.16, abs(p.y - (h + 4.0 + r + 1.0)) - 1.6);
    let dd = min(dome, lan);
    if (dd < d) { m = 7.0; }
    d = min(d, dd);
  } else if (c.v < 0.78) {
    // houses of worship, four ways (by the cell's second seed): a mosque, a twin-towered cathedral, an Orthodox
    // church with an apse and onion domes, and the plain nave-and-steeple church
    let kind = i32(floor(c.s * 4.0));
    if (kind == 0) {
      // a mosque: a low prayer hall, a drum and a great dome with a finial, two half domes, and two minarets at
      // opposite corners with a balcony and a pointed cap
      let hb = h * 0.55;
      let r = min(w.x, w.y) * 0.6;
      d = sdBox(p - vec3f(0.0, hb * 0.5, 0.0), vec3f(w.x * 0.9, hb * 0.5, w.y * 0.9));
      let drum = max(length(p.xz) - r, abs(p.y - (hb + 0.9)) - 0.9);
      d = min(d, drum);
      let dome = max(length(p - vec3f(0.0, hb + 1.8, 0.0)) - r, hb + 1.8 - p.y);
      let fin = sdSeg(p, vec3f(0.0, hb + 1.8 + r, 0.0), vec3f(0.0, hb + 1.8 + r + 2.2, 0.0)) - 0.12;
      let semi = max(length(vec3f(abs(p.x) - w.x * 0.55, p.y - hb, p.z)) - r * 0.55, hb - p.y);
      let dd = min(min(dome, fin), semi);
      if (dd < d) { m = 7.0; }
      d = min(d, dd);
      let mq = vec3f(abs(p.x + p.z) * 0.7071, p.y, (p.x - p.z) * 0.7071);
      let mc = vec3f(mq.x - length(w) * 0.9, p.y, mq.z);
      let hm = h * 1.95;
      var mn = max(length(mc.xz) - 0.75, max(-p.y, p.y - hm));
      mn = min(mn, max(length(mc.xz) - 1.25, abs(p.y - hm * 0.78) - 0.28));
      let cap = max((length(mc.xz) - 0.8 * (1.0 - (p.y - hm) / 3.2)) * 0.95, max(hm - p.y, p.y - hm - 3.2));
      if (min(mn, cap) < d) { m = select(2.0, 7.0, cap < mn); }
      d = min(d, min(mn, cap));
    } else if (kind == 1) {
      // a cathedral: a tall nave under a steep roof, and a west front of twin towers with pointed spires
      let hb = h * 0.8;
      d = sdBox(p - vec3f(0.0, hb * 0.5, 0.0), vec3f(w.x, hb * 0.5, w.y * 0.8));
      let rh = w.y * 1.1;
      let kk = rh / (w.y * 0.8);
      let pl = ((p.y - hb - rh) + kk * abs(p.z)) / sqrt(1.0 + kk * kk);
      let roofd = max(max(pl, hb - 0.05 - p.y), abs(p.x) - w.x);
      if (roofd < d) { m = 11.0; }
      d = min(d, roofd);
      let tw = min(w.x, w.y) * 0.3;
      let tp = vec3f(p.x - (w.x - tw), p.y, abs(p.z) - (w.y - tw));
      let th = h * 1.25;
      let tower = sdBox(tp - vec3f(0.0, th * 0.5, 0.0), vec3f(tw, th * 0.5, tw));
      if (tower < d) { m = 2.0; }
      d = min(d, tower);
      let sh = h * 0.9;
      let yy = tp.y - th;
      let sp = (max(abs(tp.x), abs(tp.z)) - tw * (1.0 - yy / sh)) * sh / sqrt(sh * sh + tw * tw);
      let spire = max(max(sp, -yy), yy - sh);
      if (spire < d) { m = 7.0; }
      d = min(d, spire);
    } else if (kind == 2) {
      // an Orthodox church: a nave with a round apse, a drum and an onion dome over the crossing, and four small
      // onions at the corners
      let hb = h * 0.65;
      d = sdBox(p - vec3f(0.0, hb * 0.5, 0.0), vec3f(w.x * 0.75, hb * 0.5, w.y * 0.7));
      d = min(d, max(length(vec2f(p.x + w.x * 0.75, p.z)) - w.y * 0.55, max(-p.y, p.y - hb * 0.85)));
      let r = min(w.x, w.y) * 0.4;
      d = min(d, max(length(p.xz) - r * 0.8, max(hb - 0.5 - p.y, p.y - (hb + 2.5))));
      let oc = vec3f(p.x, p.y - (hb + 2.5 + r * 0.9), p.z);
      let onion = smin(length(oc) - r, max(length(oc.xz) - r * 0.55 * (1.0 - (oc.y - r * 0.4) / (r * 1.6)), max(r * 0.4 - oc.y, oc.y - r * 2.0)), r * 0.35);
      var dd = onion;
      let sc = vec3f(abs(p.x) - w.x * 0.55, p.y - (hb + r * 0.45), abs(p.z) - w.y * 0.5);
      dd = min(dd, smin(length(sc) - r * 0.4, max(length(sc.xz) - r * 0.2 * (1.0 - sc.y / (r * 0.9)), max(-sc.y, sc.y - r * 0.9)), r * 0.15));
      if (dd < d) { m = 7.0; }
      d = min(d, dd);
    } else {
      let hb = h * 0.75;
      d = sdBox(p - vec3f(0.0, hb * 0.5, 0.0), vec3f(w.x, hb * 0.5, w.y));
      let rh = w.y * 0.7;
      let kk = rh / w.y;
      let pl = ((p.y - hb - rh) + kk * abs(p.z)) / sqrt(1.0 + kk * kk);
      let roofd = max(max(pl, hb - 0.05 - p.y), abs(p.x) - w.x);
      if (roofd < d) { m = 11.0; }
      d = min(d, roofd);
      let tw = min(w.x, w.y) * 0.42;
      let tp = p - vec3f(w.x - tw, 0.0, 0.0);
      let th = h * 1.4;
      let tower = sdBox(tp - vec3f(0.0, th * 0.5, 0.0), vec3f(tw, th * 0.5, tw));
      if (tower < d) { m = 2.0; }
      d = min(d, tower);
      let sh = h * 0.8;
      let yy = tp.y - th;
      let sp = (max(abs(tp.x), abs(tp.z)) - tw * (1.0 - yy / sh)) * sh / sqrt(sh * sh + tw * tw);
      let spire = max(max(sp, -yy), yy - sh);
      if (spire < d) { m = 7.0; }
      d = min(d, spire);
    }
  } else {
    d = sdBox(p - vec3f(0.0, h * 0.5, -1.2), vec3f(w.x, h * 0.5, w.y - 1.2));
    d = min(d, sdBox(p - vec3f(0.0, 0.3, 0.0), vec3f(w.x + 0.4, 0.3, w.y + 0.3)));
    let cx = p.x - 2.2 * round(p.x / 2.2);
    let col = max(length(vec2f(cx, p.z - (w.y - 1.0))) - 0.42, max(abs(p.x) - (w.x - 0.3), abs(p.y - h * 0.5) - h * 0.5));
    d = min(d, col);
    let ph = w.x * 0.32;
    let kk = ph / w.x;
    let pl = ((p.y - h - ph) + kk * abs(p.x)) / sqrt(1.0 + kk * kk);
    let ped = max(max(pl, h - p.y), abs(p.z) - w.y);
    d = min(d, ped);
  }
  return vec2f(d, m);
}

fn ruin(p: vec3f, c: Cell) -> vec2f {
  let w = c.w * 0.7;
  let h = c.h;
  let top = h + 3.0 * sin(p.x * 1.1 + c.s * 9.0) + 2.5 * sin(p.z * 1.4 + c.v * 5.0);
  var d = sdBox(p - vec3f(0.0, h * 0.5 + 2.0, 0.0), vec3f(w.x, h * 0.5 + 2.0, w.y));
  d = max(d, (p.y - top) * 0.3);
  d = max(d, -sdBox(p - vec3f(0.0, h * 0.5 + 4.0, 0.0), vec3f(w.x - 0.9, h * 0.5 + 4.0, w.y - 0.9)));
  let wy = p.y - 5.0 * round(p.y / 5.0);
  let slot = max(abs(wy) - 1.3, min(abs(p.x), abs(p.z)) - 0.9);
  d = max(d, -slot);
  return vec2f(d, 8.0);
}

fn organic(p: vec3f, c: Cell) -> vec2f {
  let h = c.h;
  let ph = c.s * 6.2831;
  let amp = (1.0 + 1.0 * c.v) * smoothstep(0.0, 30.0, p.y);
  let q = p.xz - vec2f(sin(p.y * 0.045 + ph), cos(p.y * 0.038 + ph * 1.3)) * amp;
  let r0 = 3.8 + 1.4 * c.v;
  let R = r0 * (1.0 - 0.3 * clamp(p.y / h, 0.0, 1.0)) * (1.0 + 0.07 * sin(p.y * 0.19 + ph));
  let rq = length(q);
  var d = max(rq - R, p.y - h) * 0.8;
  let cap = (length(vec3f(q.x, (p.y - h) * 1.5, q.y)) - r0 * 0.7) / 1.5;
  d = smin(d, cap, 1.5);
  var m = 15.0;
  let sy = p.y - 4.2 * round(p.y / 4.2);
  let slab = max(max((rq - R - 0.85) * 0.8, abs(sy) - 0.22), max(p.y - h + 0.5, 1.0 - p.y));
  if (slab < d) { m = 13.0; d = slab; }
  return vec2f(d, m);
}

fn sdSeg(p: vec3f, a: vec3f, b: vec3f) -> f32 {
  let pa = p - a;
  let ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

fn waterField(xz: vec2f) -> f32 { return vnoise(xz / 420.0, 14) * 0.75 + vnoise(xz / 150.0, 15) * 0.25; }

// Canal streets: some street lines run through water districts; the water follows whole block segments.
fn canalAt(li: i32, axisK: i32, alongPos: f32) -> bool {
  if (hsh(wrapS(li), axisK, 77) > 0.3) { return false; }
  let segMid = (floor(alongPos / CS) + 0.5) * CS;
  let lc = f32(li) * CS;
  return waterField(wrapP(select(vec2f(segMid, lc), vec2f(lc, segMid), axisK == 1))) > 0.6;
}

fn vehicleSDF(q: vec3f, kind: i32) -> f32 {
  switch kind {
    // streamlined, in the old style: rounded vans, teardrop coaches with a fin, cars with a canopy and a tail fin
    case 2: { return sdBox(q - vec3f(0.0, 1.05, 0.0), vec3f(0.6, 0.45, 1.95)) - 0.38; }
    case 3, 7: {
      return smin(sdEll(q - vec3f(0.0, 0.55, 0.0), vec3f(0.9, 0.36, 2.3)), sdEll(q - vec3f(0.0, 0.86, -0.35), vec3f(0.55, 0.26, 0.85)), 0.2);
    }
    case 5: {
      let body = smin(sdEll(q - vec3f(0.0, 1.15, 0.0), vec3f(0.95, 0.88, 2.75)), sdBox(q - vec3f(0.0, 0.5, 0.0), vec3f(0.85, 0.22, 2.2)) - 0.12, 0.35);
      let fin = sdBox(q - vec3f(0.0, 1.95, -1.5), vec3f(0.035, 0.28, 0.8)) - 0.02;
      return min(min(body, fin), sdBox(q - vec3f(0.0, 2.08, 1.0), vec3f(0.55, 0.06, 0.12)));
    }
    case 6: {
      let body = sdBox(q - vec3f(0.0, 1.1, 0.0), vec3f(0.95, 0.82, 3.0)) - 0.12;
      let ladder = sdBox(q - vec3f(0.0, 2.1, -0.4), vec3f(0.28, 0.07, 2.4));
      return min(body, min(ladder, sdBox(q - vec3f(0.0, 2.1, 2.5), vec3f(0.6, 0.06, 0.12))));
    }
    case 8: {
      return min(sdBox(q - vec3f(0.0, 0.18, 0.0), vec3f(0.8, 0.28, 2.3)) - 0.15, sdBox(q - vec3f(0.0, 0.75, -0.4), vec3f(0.55, 0.32, 0.8)) - 0.08);
    }
    default: {
      var d = smin(sdEll(q - vec3f(0.0, 0.75, 0.0), vec3f(0.9, 0.5, 2.3)), sdEll(q - vec3f(0.0, 1.15, -0.25), vec3f(0.66, 0.4, 1.25)), 0.25);
      d = min(d, sdBox(q - vec3f(0.0, 1.15, -1.75), vec3f(0.03, 0.22, 0.4)) - 0.02);
      if (kind == 1) { d = min(d, sdBox(q - vec3f(0.0, 1.66, -0.1), vec3f(0.32, 0.1, 0.14))); }
      if (kind == 4) { d = min(d, sdBox(q - vec3f(0.0, 1.68, -0.1), vec3f(0.58, 0.06, 0.13))); }
      return d;
    }
  }
}

fn vehicleKind(lineId: i32, key: i32) -> i32 {
  let h = hsh(lineId, key, 76);
  if (h < 0.03) { return 4; }
  if (h < 0.045) { return 5; }
  if (h < 0.057) { return 6; }
  if (h < 0.2) { return 1; }
  if (h < 0.33) { return 2; }
  if (h < 0.42) { return 3; }
  return 0;
}

// Distance travelled by every car on an axis: x-bound traffic moves during [0, G) of each signal
// cycle, z-bound traffic during [G + A, 2G + A), with all-red gaps between. Each green moves a car
// exactly one block, from one stop line to the next, easing in and out.
fn laneDisp(t: f32, alongIsZ: bool) -> f32 {
  let t0 = t - select(0.0, SIG_G + SIG_A, alongIsZ);
  let n = floor(t0 / SIG_P);
  let v = clamp((t0 - n * SIG_P) / SIG_G, 0.0, 1.0);
  return CS * (n + v * v * (3.0 - 2.0 * v));
}

fn laneQ(sAlong: f32, lat: f32, y: f32, lineId: i32, laneK: i32, dirSign: f32, fixedCoord: f32, alongIsZ: bool) -> CarQ {
  var r: CarQ;
  r.ok = 0.0;
  r.kind = 0;
  let axisK = select(2, 1, alongIsZ);
  let lk = lineId * 2 + laneK;
  let dens = 0.2 + 0.55 * hsh(lk, axisK, 71);
  // no signals any more: each lane has its own flow, surging and slowing over tens of seconds
  let lsp = 14.0 + 10.0 * hsh(lk, axisK, 176);
  let disp = lsp * u.time + 38.0 * (vnoise(vec2f(u.time * 0.045 + f32(lk % 97) * 3.1, f32(axisK)), 177) - 0.5) + 60.0 * hsh(lk, axisK, 178);
  let sp = sAlong * dirSign - disp + SIG_PH;
  let slot = floor(sp / CAR_L);
  let si = i32(slot);
  r.d = min(sp - slot * CAR_L, (slot + 1.0) * CAR_L - sp) + 8.0;
  let key = si * 4 + laneK * 2 + axisK;
  if (hsh(lineId, key, 74) < dens) {
    // each pod drifts forward and back within its gap, so they bunch up and spread out
    let jit = -0.8 * hsh(lineId, key, 75) + 7.0 * (vnoise(vec2f(u.time * 0.12, f32(key % 211) * 1.7 + f32(lineId % 53)), 179) - 0.5);
    let la = sp - (slot + 0.5) * CAR_L - jit;
    let li = laneK + select(2, 0, alongIsZ);
    if (lcKey[li].x != lineId || lcKey[li].y != key) {
      let cAlong = ((slot + 0.5) * CAR_L + jit + disp - SIG_PH) * dirSign;
      let cc = select(vec2i(i32(floor(cAlong / CS)), i32(floor(fixedCoord / CS))), vec2i(i32(floor(fixedCoord / CS)), i32(floor(cAlong / CS))), alongIsZ);
      lcKey[li] = vec2i(lineId, key);
      let typ = cellHead(cc).typ;
      var status = -1;
      if (isCityTyp(typ)) {
        status = select(0, 1, canalAt(select(lineId - 7777, lineId, alongIsZ), axisK, cAlong));
      }
      lcTyp[li] = status;
    }
    let status = lcTyp[li];
    if (status >= 0) {
      let kind = select(vehicleKind(lineId, key), 8, status == 1);
      r.d = min(r.d, vehicleSDF(vec3f(lat, y, la), kind));
      r.la = la;
      r.lat = lat;
      r.seed = key * 31 + lineId;
      r.ok = 1.0;
      r.kind = kind;
    }
  }
  return r;
}

// Traffic runs overhead, in sealed tubes about 11 m up. Each street's pair of tubes is straight, rises and dips
// gently, or twists around its partner; this gives the centre of a lane's tube (across the street, height).
const TUBE_Y: f32 = 11.0;
fn tubeOff(k: i32, ax: i32, lane: i32, along: f32) -> vec2f {
  let h = hsh(k, ax * 13 + 5, 870);
  let ph = hsh(k, ax * 13 + 6, 871) * 6.2832;
  let side = select(-1.6, 1.6, lane == 1);
  if (h < 0.4) { return vec2f(side, TUBE_Y); }
  if (h < 0.75) { return vec2f(side, TUBE_Y + 2.4 * sin(along / 52.0 + ph)); }
  let th = along / 41.0 + ph + select(0.0, 3.14159, lane == 1);
  return vec2f(1.7 * cos(th), TUBE_Y + 1.7 * sin(th));
}
fn carsQ(p: vec3f) -> CarQ {
  var best: CarQ;
  best.d = 1e5;
  best.ok = 0.0;
  best.kind = 0;
  best.yb = 0.0;
  let lx = round(p.x / CS);
  let dx = p.x - lx * CS;
  let lxi = i32(lx);
  if (abs(dx) < 4.6) {
    for (var ln = 0; ln < 2; ln++) {
      let o = tubeOff(lxi, 0, ln, p.z);
      let yb = o.y - 1.25;
      var a = laneQ(p.z, dx - o.x, p.y - yb, lxi, ln, select(1.0, -1.0, ln == 1), lx * CS + o.x, true);
      a.yb = yb;
      if (a.d < best.d) { best = a; }
    }
  } else {
    best.d = abs(dx) - 2.3;
  }
  let lz = round(p.z / CS);
  let dz = p.z - lz * CS;
  let lzi = i32(lz) + 7777;
  if (abs(dz) < 4.6) {
    for (var ln = 0; ln < 2; ln++) {
      let o = tubeOff(lzi, 1, ln, p.x);
      let yb = o.y - 1.25;
      var a = laneQ(p.x, dz - o.x, p.y - yb, lzi, ln, select(1.0, -1.0, ln == 1), lz * CS + o.x, false);
      a.yb = yb;
      if (a.d < best.d) { best = a; }
    }
  } else {
    best.d = min(best.d, abs(dz) - 2.3);
  }
  return best;
}

// ---------- what holds the tubes up ----------
// At every crossing of two street lines, a junction drum on a column: the tubes span the 26 m between them (a
// pylon at mid-block stood where the street views' cameras do). At some crossings (tubeStation) the junction is a
// station, a wider glazed drum with a glass lift shaft down to the street. Traced analytically (tubeStructTrace), like the tubes themselves; tubeStructSDF is the
// same shapes as a distance, for normals and occlusion.
fn tubeStation(i: i32, j: i32) -> bool { return hsh(i, j, 880) < 0.07; }
fn tubeStructSDF(p: vec3f) -> vec2f {
  var r = vec2f(1e5, 64.0);
  for (var ax = 0; ax < 2; ax++) {
    let a = select(p.x, p.z, ax == 1);
    let b = select(p.z, p.x, ax == 1);
    let li = round(a / CS);
    let da = a - li * CS;
    // the junction at the crossing, or a station
    let bj = round(b / CS);
    let jc = vec2f(da, b - bj * CS);
    let st = tubeStation(select(i32(li), i32(bj), ax == 1), select(i32(bj), i32(li), ax == 1));
    let dr = select(3.2, 6.2, st);
    let drum = max(length(jc) - dr, abs(p.y - TUBE_Y - select(0.0, 0.6, st)) - select(2.3, 3.4, st));
    let col = max(length(jc) - select(0.7, 1.5, st), p.y - TUBE_Y);
    if (drum < r.x) { r = vec2f(drum, select(64.0, 65.0, st)); }
    if (col < r.x) { r = vec2f(col, select(64.0, 66.0, st)); }
  }
  return r;
}
// a vertical cylinder (centre c in xz, radius rad, from y0 to y1, with its caps): entry distance or -1
fn cylV(ro: vec3f, rd: vec3f, c: vec2f, rad: f32, y0: f32, y1: f32) -> f32 {
  let o = ro.xz - c;
  let A = dot(rd.xz, rd.xz);
  var best = -1.0;
  if (A > 1e-8) {
    let B = dot(o, rd.xz);
    let C = dot(o, o) - rad * rad;
    let disc = B * B - A * C;
    if (disc >= 0.0) {
      let t = (-B - sqrt(disc)) / A;
      let y = ro.y + rd.y * t;
      if (t > 0.0 && y >= y0 && y <= y1) { best = t; }
    }
  }
  if (abs(rd.y) > 1e-6) {
    for (var k = 0; k < 2; k++) {
      let yc = select(y0, y1, k == 1);
      let t = (yc - ro.y) / rd.y;
      if (t > 0.0 && (best < 0.0 || t < best) && length(o + rd.xz * t) <= rad) { best = t; }
    }
  }
  return best;
}
fn boxHit(ro: vec3f, rd: vec3f, lo: vec3f, hi: vec3f) -> f32 {
  let inv = 1.0 / select(rd, vec3f(1e-6), abs(rd) < vec3f(1e-6));
  let t0 = (lo - ro) * inv;
  let t1 = (hi - ro) * inv;
  let tn = max(max(min(t0.x, t1.x), min(t0.y, t1.y)), min(t0.z, t1.z));
  let tf = min(min(max(t0.x, t1.x), max(t0.y, t1.y)), max(t0.z, t1.z));
  if (tf < max(tn, 0.0)) { return -1.0; }
  return select(tn, -1.0, tn <= 0.0);
}
// nearest tube structure along a ray (within 220 m): (t, material), t < 0 for none
fn tubeStructTrace(ro: vec3f, rd: vec3f, tEnd: f32) -> vec2f {
  var best = vec2f(-1.0, 0.0);
  var te = min(tEnd, 220.0);
  let yHi = TUBE_Y + 4.2;
  var t0 = 0.0;
  var t1 = te;
  if (abs(rd.y) < 1e-5) { if (ro.y > yHi) { return best; } }
  else { let ta = (0.0 - ro.y) / rd.y; let tb = (yHi - ro.y) / rd.y; t0 = max(t0, min(ta, tb)); t1 = min(t1, max(ta, tb)); }
  if (t1 <= t0) { return best; }
  // every crossing lies on an x street line, so walking those finds them all
  for (var ax = 0; ax < 1; ax++) {
    let a = select(ro.x, ro.z, ax == 1);
    let da = select(rd.x, rd.z, ax == 1);
    let b0 = select(ro.z, ro.x, ax == 1);
    let db = select(rd.z, rd.x, ax == 1);
    let aA = a + da * t0;
    let aB = a + da * t1;
    let k0 = i32(floor((min(aA, aB) - 7.0) / CS)) + 1;
    let k1 = i32(ceil((max(aA, aB) + 7.0) / CS)) - 1;
    var kk = k0;
    for (var it = 0; it < 10; it++) {
      if (kk > k1) { break; }
      let lc = f32(kk) * CS;
      // the stretch of the ray within 7 m of this line, and the street elements along it there
      var sa = t0;
      var sb = t1;
      if (abs(da) > 1e-4) { let ta = (lc - 7.0 - a) / da; let tb = (lc + 7.0 - a) / da; sa = max(sa, min(ta, tb)); sb = min(sb, max(ta, tb)); }
      if (sa < sb) {
        let bA = b0 + db * sa;
        let bB = b0 + db * sb;
        let m0 = i32(floor(min(bA, bB) / CS));
        let m1 = i32(ceil(max(bA, bB) / CS));
        var mm = m0;
        for (var j = 0; j < 8; j++) {
          if (mm > m1) { break; }
          // only where the street has the city on one side
          let ce = select(vec2i(kk, mm), vec2i(mm, kk), ax == 1);
          let cw = select(vec2i(kk - 1, mm), vec2i(mm, kk - 1), ax == 1);
          if (isCityTyp(cellHead(ce).typ) || isCityTyp(cellHead(cw).typ)) {
            // the crossing at the start of this block (each crossing is tested once, from the x lines)
            var t = -1.0;
            if (ax == 0) {
              let jc = vec2f(lc, f32(mm) * CS);
              let st = tubeStation(kk, mm);
              let dr = select(3.2, 6.2, st);
              let yc = TUBE_Y + select(0.0, 0.6, st);
              let hh = select(2.3, 3.4, st);
              t = cylV(ro, rd, jc, dr, yc - hh, yc + hh);
              if (t > 0.0 && (best.x < 0.0 || t < best.x) && t < te) { best = vec2f(t, select(64.0, 65.0, st)); }
              t = cylV(ro, rd, jc, select(0.7, 1.5, st), 0.0, yc - hh);
              if (t > 0.0 && (best.x < 0.0 || t < best.x) && t < te) { best = vec2f(t, select(64.0, 66.0, st)); }
            }
          }
          mm += 1;
        }
      }
      kk += 1;
    }
  }
  return best;
}

// The sealed, heated glass tubes the traffic runs in (outside, the air is at -179 C): a translucent layer over whatever
// the ray hit, with a Fresnel reflection of the sky and faint glowing ribs. Curved tubes are followed by treating each
// one as locally straight where the ray meets it, refined twice.
fn tubesFx(ro: vec3f, rd: vec3f, tEnd: f32, colIn: vec3f) -> vec3f {
  var col = colIn;
  let TRAD = 1.7;
  var t0 = 0.0;
  var t1 = min(tEnd, 260.0);
  let yLo = TUBE_Y - 5.0;
  let yHi = TUBE_Y + 5.5;
  if (abs(rd.y) < 1e-5) { if (ro.y < yLo || ro.y > yHi) { return col; } }
  else { let ta = (yLo - ro.y) / rd.y; let tb = (yHi - ro.y) / rd.y; t0 = max(t0, min(ta, tb)); t1 = min(t1, max(ta, tb)); }
  if (t1 <= t0) { return col; }
  for (var ax = 0; ax < 2; ax++) {
    let a = select(ro.x, ro.z, ax == 1);
    let da = select(rd.x, rd.z, ax == 1);
    let aA = a + da * t0;
    let aB = a + da * t1;
    let k0 = i32(floor((min(aA, aB) - 4.0) / CS));
    let k1 = i32(ceil((max(aA, aB) + 4.0) / CS));
    var kk = k0;
    for (var it = 0; it < 12; it++) {
      if (kk > k1) { break; }
      let kid = select(kk, kk + 7777, ax == 1);
      for (var ln = 0; ln < 2; ln++) {
        var tc = clamp(select((f32(kk) * CS - a) / da, 0.5 * (t0 + t1), abs(da) < 1e-4), t0, t1);
        var o = vec2f(0.0);
        var hitA = -1.0;
        var hitB = -1.0;
        for (var rf = 0; rf < 2; rf++) {
          let pc = ro + rd * tc;
          o = tubeOff(kid, ax, ln, select(pc.z, pc.x, ax == 1));
          let ox = a - (f32(kk) * CS + o.x);
          let oy = ro.y - o.y;
          let A = da * da + rd.y * rd.y;
          if (A < 1e-8) { break; }
          let B = ox * da + oy * rd.y;
          let C = ox * ox + oy * oy - TRAD * TRAD;
          let disc = B * B - A * C;
          if (disc < 0.0) { hitA = -1.0; break; }
          let sq = sqrt(disc);
          hitA = (-B - sq) / A;
          hitB = (-B + sq) / A;
          tc = clamp(0.5 * (hitA + hitB), t0, t1);
        }
        if (hitA < 0.0 && hitB < 0.0) { continue; }
        for (var e = 0; e < 2; e++) {
          let t = select(hitA, hitB, e == 1);
          if (t <= 0.0 || t >= min(tEnd, 260.0)) { continue; }
          let p = ro + rd * t;
          let b = select(p.z, p.x, ax == 1);
          let cb = i32(floor(b / CS));
          let cl = select(vec2i(kk - 1, cb), vec2i(cb, kk - 1), ax == 1);
          let cr = select(vec2i(kk, cb), vec2i(cb, kk), ax == 1);
          if (!isCityTyp(cellHead(cl).typ) && !isCityTyp(cellHead(cr).typ)) { continue; }
          let q = vec2f(select(p.x, p.z, ax == 1) - (f32(kk) * CS + o.x), p.y - o.y) / TRAD;
          let n = normalize(select(vec3f(q.x, q.y, 0.0), vec3f(0.0, q.y, q.x), ax == 1));
          let cosi = abs(dot(rd, n));
          let fr = 0.015 + 0.2 * pow(1.0 - cosi, 5.0);
          let refl = skyCol(reflect(rd, n)) * (0.45 - 0.2 * u.windows);
          let rib = sstepJ(0.12, 0.0, abs(fract(b / 8.0) - 0.5) - 0.44);
          let glow = vec3f(0.35, 0.85, 1.0) * rib * 0.07 * (0.15 + 0.85 * u.windows) * (0.35 + 0.65 * cosi);
          let fade = sstepJ(170.0, 90.0, t);
          col = mix(col, col * vec3f(0.95, 0.98, 1.0) * (1.0 - fr) + refl * fr + glow, fade);
        }
      }
      kk += 1;
    }
  }
  return col;
}

// Titan's fliers: pale, translucent manta-like creatures that row through the dense, low-gravity air with slow
// travelling waves along their wing margins, in flocks that glow faintly at their rims.
fn mantaSDF(q: vec3f, ph: f32) -> f32 {
  let ax = abs(q.x);
  // the wave travels from front to back along each wing, larger toward the tips
  let lift = 0.42 * ax * ax * sin(ph - q.z * 2.2) + 0.08 * sin(ph * 2.0 - q.z * 5.0) * ax;
  // swept-back wings tapering to points, a thicker body along the spine
  let sweep = 0.38 * ax * ax;
  let qq = vec3f(q.x, q.y - lift, q.z + sweep);
  let chord = 0.62 * (1.0 - 0.72 * pow(min(ax, 1.0), 1.6)) + 0.02;
  var d = sdEll(qq, vec3f(1.0, 0.03 + 0.12 * exp(-ax * ax * 9.0), chord));
  // a thin whip of a tail, swaying
  let tz = clamp(-q.z - 0.5, 0.0, 1.3);
  let tq = vec3f(q.x - 0.12 * sin(ph - tz * 3.0) * tz, q.y - lift * 0.3, q.z + 0.5 + tz);
  d = min(d, length(tq) - 0.025 * (1.4 - tz));
  return d;
}
fn flockFx(ro: vec3f, rd: vec3f, tEnd: f32, colIn: vec3f) -> vec3f {
  let n = i32(fl.n.x);
  let per = n / 4;
  var bestT = tEnd;
  var bi = -1;
  var bq = vec3f(0.0);
  for (var i = 0; i < n; i++) {
    // skip a whole flock when the ray misses its bounding sphere
    if (i % per == 0) {
      let G = fl.g[i / per];
      let ocg = ro - G.xyz;
      let bg = dot(ocg, rd);
      let hg = ocg - bg * rd;
      if (dot(hg, hg) > G.w * G.w || -bg + G.w < 0.0 || -bg - G.w > bestT) { i += per - 1; continue; }
    }
    let P = fl.a[i * 2];
    let rb = P.w * 1.25;
    let oc = ro - P.xyz;
    let b = dot(oc, rd);
    let h = oc - b * rd;
    let d2 = rb * rb - dot(h, h);
    if (d2 < 0.0) { continue; }
    let t0 = -b - sqrt(d2);
    if (t0 > bestT || -b + sqrt(d2) < 0.0) { continue; }
    // march the creature in its own frame (x right, y up, z forward), in units of its size
    let H = fl.a[i * 2 + 1];
    let fw = normalize(H.xyz);
    let rt = normalize(cross(fw, vec3f(0.0, 1.0, 0.0)) + vec3f(1e-4, 0.0, 0.0));
    let up = cross(rt, fw);
    var t = max(t0, 0.0);
    let t1 = min(-b + sqrt(d2), bestT);
    for (var k = 0; k < 28; k++) {
      let w = (ro + rd * t - P.xyz) / P.w;
      let q = vec3f(dot(w, rt), dot(w, up), dot(w, fw));
      let d = mantaSDF(q, H.w) * P.w;
      if (d < 0.004 * t + 0.02) { bestT = t; bi = i; bq = q; break; }
      t += max(d * 0.8, 0.02);
      if (t > t1) { break; }
    }
  }
  if (bi < 0) { return colIn; }
  let P = fl.a[bi * 2];
  let H = fl.a[bi * 2 + 1];
  let g = bi / max(per, 1);
  let fw = normalize(H.xyz);
  let rt = normalize(cross(fw, vec3f(0.0, 1.0, 0.0)) + vec3f(1e-4, 0.0, 0.0));
  let upv = cross(rt, fw);
  let e = 0.015;
  let nl = normalize(vec3f(mantaSDF(bq + vec3f(e, 0.0, 0.0), H.w) - mantaSDF(bq - vec3f(e, 0.0, 0.0), H.w),
                           mantaSDF(bq + vec3f(0.0, e, 0.0), H.w) - mantaSDF(bq - vec3f(0.0, e, 0.0), H.w),
                           mantaSDF(bq + vec3f(0.0, 0.0, e), H.w) - mantaSDF(bq - vec3f(0.0, 0.0, e), H.w)));
  let nw = normalize(rt * nl.x + upv * nl.y + fw * nl.z);
  let hue = select(select(select(vec3f(0.35, 0.95, 0.85), vec3f(0.7, 0.5, 1.0), g == 1), vec3f(1.0, 0.7, 0.35), g == 2), vec3f(1.0, 0.45, 0.65), g == 3);
  // translucent body: pale, darker along the spine, with a glowing margin and spots
  let ax = abs(bq.x);
  let edge = sstepJ(0.55, 0.95, ax + abs(bq.z) * 0.6);
  let veins = pow(abs(sin(atan2(bq.z, bq.x + 0.001) * 9.0)), 12.0) * sstepJ(0.15, 0.6, ax);
  let spine = exp(-bq.x * bq.x * 30.0);
  // wrapped diffuse, sky fill, and light shining through the thin wings when the Sun is behind them
  let dif = 0.5 + 0.5 * dot(nw, u.sunDir);
  let thru = pow(max(dot(rd, u.sunDir), 0.0), 3.0) * (1.0 - spine);
  var c = mix(vec3f(0.78, 0.74, 0.7), vec3f(0.32, 0.27, 0.3), spine * 0.75) * (u.sunCol * dif * 0.55 + u.skyTop * 0.35);
  c += u.sunCol * vec3f(1.0, 0.75, 0.55) * thru * 0.8;
  c += hue * (edge * 0.8 + veins * 0.25) * (0.15 + 1.2 * u.windows);
  let alpha = 0.62 + 0.3 * spine + 0.1 * edge;
  c = fogApply(c, ro, rd, bestT);
  return mix(colIn, c, alpha);
}

// ---------- story props and characters: people, a tea stall, a ladder, a radio, heat lamps, a ferry, crates, a nest
// of eggs, and small clue objects. Local frame: x right, y up, z toward the way the prop faces. Returns distance and
// a part id for shading.
fn propBound(kind: i32) -> f32 {
  switch kind { case 1: { return 2.8; } case 2: { return 3.2; } case 4: { return 3.9; } case 5: { return 4.6; } case 8: { return 0.35; } case 9: { return 0.9; } default: { return 1.9; } }
}
fn propSDF(q: vec3f, kind: i32, prm: f32) -> vec2f {
  var d = vec2f(1e5, 0.0);
  switch kind {
    case 0: {
      // a person in a long coat and scarf, breathing slowly; a hat when the parameter says so
      let br = 0.012 * sin(u.time * 1.3 + prm * 7.0);
      let coat = sdSeg(q, vec3f(0.0, 0.25, 0.0), vec3f(0.0, 1.32 + br, 0.0)) - mix(0.33, 0.21, clamp(q.y / 1.4, 0.0, 1.0));
      let arms = min(sdSeg(q, vec3f(-0.27, 1.25, 0.0), vec3f(-0.31, 0.78, 0.08)), sdSeg(q, vec3f(0.27, 1.25, 0.0), vec3f(0.31, 0.78, 0.08))) - 0.075;
      d = vec2f(min(coat, arms), 0.0);
      let head = length(q - vec3f(0.0, 1.58 + br, 0.0)) - 0.13;
      if (head < d.x) { d = vec2f(head, 1.0); }
      let scarf = length(vec2f(length(q.xz) - 0.15, q.y - 1.38 - br)) - 0.065;
      if (scarf < d.x) { d = vec2f(scarf, 2.0); }
      if (prm > 0.5) {
        let hat = min(max(length(q.xz) - 0.26, abs(q.y - 1.68 - br) - 0.018), max(length(q.xz) - 0.14, abs(q.y - 1.78 - br) - 0.1));
        if (hat < d.x) { d = vec2f(hat, 2.0); }
      }
    }
    case 1: {
      // a tea stall: a counter under a striped awning, a glowing kettle
      d = vec2f(sdBox(q - vec3f(0.0, 0.55, 0.0), vec3f(1.3, 0.55, 0.45)) - 0.02, 5.0);
      for (var i = 0; i < 4; i++) { let px = select(-1.35, 1.35, (i & 1) == 1); let pz = select(-0.5, 0.5, (i & 2) == 2); d.x = min(d.x, sdSeg(q, vec3f(px, 0.0, pz), vec3f(px, 2.35 - 0.25 * pz, pz)) - 0.04); }
      let aw = sdBox(vec3f(q.x, q.y - 2.35 + 0.25 * q.z, q.z), vec3f(1.55, 0.03, 0.85));
      if (aw < d.x) { d = vec2f(aw, 3.0); }
      let kt = max(length(q.xz - vec2f(0.6, 0.0)) - 0.15, abs(q.y - 1.25) - 0.14);
      if (kt < d.x) { d = vec2f(kt, 4.0); }
    }
    case 2: {
      // a wooden ladder leaning back against a wall
      let a = vec3f(0.0, 0.0, 0.0);
      let b = vec3f(0.0, 4.2, -1.3);
      let ax = normalize(b - a);
      let rails = min(sdSeg(q, a + vec3f(-0.24, 0.0, 0.0), b + vec3f(-0.24, 0.0, 0.0)), sdSeg(q, a + vec3f(0.24, 0.0, 0.0), b + vec3f(0.24, 0.0, 0.0))) - 0.035;
      let tt = clamp(dot(q - a, ax), 0.2, 4.2);
      let tr = round(tt / 0.36) * 0.36;
      let rung = sdSeg(q, a + ax * tr + vec3f(-0.24, 0.0, 0.0), a + ax * tr + vec3f(0.24, 0.0, 0.0)) - 0.022;
      d = vec2f(min(rails, rung), 5.0);
    }
    case 3: {
      // a wardrobe-sized old radio cabinet with a glowing dial
      d = vec2f(sdBox(q - vec3f(0.0, 0.85, 0.0), vec3f(0.55, 0.85, 0.32)) - 0.03, 5.0);
      let dial = max(length(q.xy - vec2f(0.0, 1.2)) - 0.14, abs(q.z - 0.34) - 0.02);
      if (dial < d.x) { d = vec2f(dial, 4.0); }
    }
    case 4: {
      // a heat lamp on a post: lit (parameter 1) or cold
      d = vec2f(sdSeg(q, vec3f(0.0), vec3f(0.0, 3.4, 0.0)) - 0.06, 6.0);
      let lan = sdBox(q - vec3f(0.0, 3.62, 0.0), vec3f(0.17, 0.24, 0.17)) - 0.02;
      if (lan < d.x) { d = vec2f(lan, select(7.0, 4.0, prm > 0.5)); }
    }
    case 5: {
      // a small ferry: a hull with a cabin and a lamp
      let hq = vec3f(q.x * (1.0 + 0.25 * max(q.z - 2.5, 0.0)), q.y, q.z);
      d = vec2f(sdBox(hq - vec3f(0.0, 0.35, 0.0), vec3f(1.25, 0.45, 3.9)) - 0.12, 8.0);
      let cab = sdBox(q - vec3f(0.0, 1.35, -0.7), vec3f(0.85, 0.55, 1.1)) - 0.05;
      if (cab < d.x) { d = vec2f(cab, 5.0); }
      let lm = length(q - vec3f(0.0, 2.1, -0.7)) - 0.14;
      if (lm < d.x) { d = vec2f(lm, 4.0); }
    }
    case 6: {
      d = vec2f(min(min(sdBox(q - vec3f(0.0, 0.4, 0.0), vec3f(0.45, 0.4, 0.45)), sdBox(q - vec3f(0.9, 0.35, 0.2), vec3f(0.38, 0.35, 0.38))), sdBox(q - vec3f(0.3, 1.15, 0.1), vec3f(0.35, 0.35, 0.35))) - 0.02, 5.0);
    }
    case 7: {
      // a nest of lamp-wick and knitting, with pale eggs glowing faintly
      d = vec2f(max(abs(length(q - vec3f(0.0, 0.55, 0.0)) - 0.62) - 0.09, q.y - 0.42), 2.0);
      for (var i = 0; i < 5; i++) {
        let a = f32(i) * 1.2566;
        let e = sdEll(q - vec3f(cos(a) * 0.26, 0.22, sin(a) * 0.26), vec3f(0.1, 0.14, 0.1));
        if (e < d.x) { d = vec2f(e, 9.0); }
      }
    }
    case 8: {
      // a small clue object, glinting
      d = vec2f(sdBox(q - vec3f(0.0, 0.035, 0.0), vec3f(0.12, 0.02, 0.08)) - 0.015, 4.0);
    }
    case 9: {
      // your telepresence drone: an ovoid body, four ducted rotors, a camera eye, red and green navigation lights
      let qb = q - vec3f(0.0, 0.45, 0.0);
      d = vec2f(sdEll(qb, vec3f(0.26, 0.14, 0.34)), 6.0);
      for (var i = 0; i < 4; i++) {
        let rq = qb - vec3f(select(-0.36, 0.36, (i & 1) == 1), 0.05, select(-0.3, 0.3, (i & 2) == 2));
        let duct = length(vec2f(length(rq.xz) - 0.15, rq.y)) - 0.024;
        if (duct < d.x) { d = vec2f(duct, 6.0); }
      }
      let eye = length(qb - vec3f(0.0, -0.02, 0.32)) - 0.065;
      if (eye < d.x) { d = vec2f(eye, 10.0); }
      let lr = length(qb - vec3f(-0.5, 0.05, 0.0)) - 0.035;
      if (lr < d.x) { d = vec2f(lr, 11.0); }
      let lgn = length(qb - vec3f(0.5, 0.05, 0.0)) - 0.035;
      if (lgn < d.x) { d = vec2f(lgn, 12.0); }
    }
    default: {}
  }
  return d;
}
fn propsFx(ro: vec3f, rd: vec3f, tEnd: f32, colIn: vec3f) -> vec3f {
  let n = i32(pr.n.x);
  if (n == 0) { return colIn; }
  var bestT = tEnd;
  var bi = -1;
  var bq = vec3f(0.0);
  var bp = 0.0;
  var glow = vec3f(0.0);
  for (var i = 0; i < n; i++) {
    let P = pr.a[i * 2];
    let Q = pr.a[i * 2 + 1];
    let kind = i32(P.w);
    let sc = Q.y;
    let rb = propBound(kind) * sc;
    let cen = P.xyz + vec3f(0.0, rb * 0.5, 0.0);
    let oc = ro - cen;
    let b = dot(oc, rd);
    let h = oc - b * rd;
    let d2 = rb * rb - dot(h, h);
    // clue objects and lit lamps glow a little in the haze around them
    if (kind == 8 || (kind == 4 && Q.w > 0.5)) {
      let gp = select(P.xyz + vec3f(0.0, 0.05, 0.0), P.xyz + vec3f(0.0, 3.62 * sc, 0.0), kind == 4);
      let tg = max(dot(gp - ro, rd), 0.0);
      if (tg < bestT) {
        let dd = length(ro + rd * tg - gp);
        let gc = select(vec3f(1.0, 0.72, 0.4), specCycle(0.0, 0.0) * 0.8 + 0.3, kind == 8);
        glow += gc * exp(-dd * dd / select(0.9, 0.09, kind == 8)) * select(0.35, 1.1 * (0.6 + 0.4 * step(0.5, fract(u.time * 3.5))), kind == 8);
      }
    }
    if (d2 < 0.0) { continue; }
    let t0 = -b - sqrt(d2);
    let t1 = min(-b + sqrt(d2), bestT);
    if (t0 > bestT || t1 < 0.0) { continue; }
    let cy = cos(Q.x);
    let sy = sin(Q.x);
    var t = max(t0, 0.0);
    for (var k = 0; k < 40; k++) {
      let w = (ro + rd * t - P.xyz) / sc;
      let q = vec3f(cy * w.x - sy * w.z, w.y, sy * w.x + cy * w.z);
      let dd = propSDF(q, kind, Q.w).x * sc;
      if (dd < 0.002 * t + 0.004) { bestT = t; bi = i; bq = q; bp = Q.w; break; }
      t += max(dd * 0.85, 0.005);
      if (t > t1) { break; }
    }
  }
  var col = colIn + glow;
  if (bi < 0) { return col; }
  let P = pr.a[bi * 2];
  let Q = pr.a[bi * 2 + 1];
  let kind = i32(P.w);
  let part = i32(propSDF(bq, kind, bp).y);
  let e = 0.01;
  let nl = normalize(vec3f(propSDF(bq + vec3f(e, 0.0, 0.0), kind, bp).x - propSDF(bq - vec3f(e, 0.0, 0.0), kind, bp).x,
                           propSDF(bq + vec3f(0.0, e, 0.0), kind, bp).x - propSDF(bq - vec3f(0.0, e, 0.0), kind, bp).x,
                           propSDF(bq + vec3f(0.0, 0.0, e), kind, bp).x - propSDF(bq - vec3f(0.0, 0.0, e), kind, bp).x));
  let cy = cos(Q.x);
  let sy = sin(Q.x);
  let nw = normalize(vec3f(cy * nl.x + sy * nl.z, nl.y, -sy * nl.x + cy * nl.z));
  var alb = vec3f(0.3);
  var emi = vec3f(0.0);
  var spec = 0.1;
  switch part {
    case 0: { alb = mix(vec3f(0.12), hue3(Q.z) * 0.5, 0.65); }
    case 1: { alb = vec3f(0.55, 0.4, 0.32); }
    case 2: { alb = hue3(fract(Q.z + 0.45)) * 0.55 + 0.05; }
    case 3: { alb = mix(vec3f(0.85, 0.8, 0.7), vec3f(0.7, 0.12, 0.1), step(0.5, fract(bq.x * 1.6))); }
    case 4: { alb = vec3f(0.2); emi = select(vec3f(1.0, 0.7, 0.35), hue3(Q.z) * 0.8 + 0.4, kind == 8) * (1.2 + 0.4 * sin(u.time * 2.0 + f32(bi))); }
    case 5: { alb = vec3f(0.28, 0.17, 0.09); }
    case 6: { alb = vec3f(0.22, 0.23, 0.25); spec = 0.7; }
    case 7: { alb = vec3f(0.05, 0.06, 0.07); spec = 0.6; }
    case 8: { alb = hue3(Q.z) * 0.45 + 0.05; spec = 0.4; }
    case 9: { alb = vec3f(0.8, 0.85, 0.8); emi = vec3f(0.45, 0.9, 0.85) * (0.5 + 0.3 * sin(u.time * 0.9 + f32(bi) * 2.0)); }
    case 10: { alb = vec3f(0.02); emi = vec3f(0.3, 0.9, 1.0) * 1.4; spec = 1.0; }
    case 11: { alb = vec3f(0.2); emi = vec3f(1.0, 0.1, 0.08) * 3.0 * step(0.5, fract(u.time * 0.8)); }
    case 12: { alb = vec3f(0.2); emi = vec3f(0.1, 1.0, 0.3) * 3.0 * step(0.5, fract(u.time * 0.8 + 0.5)); }
    default: {}
  }
  let dif = max(dot(nw, u.sunDir), 0.0) * 0.8 + 0.2;
  let hv = normalize(u.sunDir - rd);
  var c = alb * (u.sunCol * dif * 0.6 + u.skyTop * 0.5 + u.skyHor * 0.25) + u.sunCol * pow(max(dot(nw, hv), 0.0), 40.0) * spec * 0.3 + emi;
  // findable things shimmer like a collectable in an old home-computer platform game: the hue wheel turned in eight
  // hard steps, bands rolling up the object, bright whatever the light
  if (kind == 8) { c = mix(c, specCycle(bq.y * 2.5 + bq.x * 0.8, f32(bi)) * (0.75 + 0.25 * dif), 0.85); }
  c = fogApply(c, ro, rd, bestT);
  return c + glow * 0.5;
}
// the colour wheel stepped round: eight hues, a new one about seven times a second, offset by position along the thing
fn specCycle(along: f32, k: f32) -> vec3f {
  let step8 = floor(u.time * 7.0 + along * 8.0 + k * 3.0);
  return hue3(fract(step8 / 8.0)) * 1.3 + 0.08;
}

fn pedDensity(c: vec2i) -> f32 {
  if (c.x != pcKey.x || c.y != pcKey.y) {
    pcKey = c;
    let ce = cellHead(c);
    var d = 0.0;
    if (isCityTyp(ce.typ)) {
      d = 0.16 + 0.45 * f32((ce.fl >> 10) & 1) + select(0.0, 0.3, (ce.fl & 16) != 0);
    }
    pcDens = d;
  }
  return pcDens;
}

// Pedestrians walk around each block on two rings between the buildings and the traffic lanes,
// in opposite directions, so they never cross roads or each other. Titan: a seventh of Earth's gravity and air four
// times as dense, so people lope in weighted boots, the thin ones glide under wing-capes, and some streets have a
// cable overhead that skaters hang from. Robots are expensive and meant to be seen.
// Kinds: 0 exoskeleton with rider, 1 android, 2 loper in weighted boots, 3 cape glider, 4 skater on the cable.
fn pedPulley(c: vec2i, ln: i32) -> bool { return hsh(c.x * 11 + ln, c.y * 5, 183) < 0.22; }
fn pedPace(c: vec2i, ln: i32) -> f32 {
  return (0.5 + 1.1 * hsh(c.x * 5 + ln, c.y * 3, 180)) * select(1.0, 2.6, pedPulley(c, ln));
}
fn pedKind(c: vec2i, ln: i32, key: i32) -> i32 {
  if (pedPulley(c, ln)) { return 4; }
  let h = hsh(key, c.x * 7 + c.y, 98);
  if (h < 0.28) { return 0; }
  if (h < 0.46) { return 1; }
  if (h < 0.82) { return 2; }
  return 3;
}
// the gait's phase, and how high the body rides above its feet' ground contact
fn pedPhase(kind: i32, pace: f32, key: i32) -> f32 {
  var f = 4.2 * (0.6 + 0.5 * pace);
  if (kind == 1) { f = 3.1; }
  if (kind == 2) { f = 2.2; }
  if (kind == 3) { f = 1.3; }
  if (kind == 4) { f = 2.4; }
  return u.time * f + f32(key);
}
// Walking kinds (0 exoskeleton, 1 android, 2 loper) take their phase from the DISTANCE walked, not the clock: a
// full gait cycle is gaitLen metres, so the foot on the ground moves back exactly as fast as the body moves on and
// stays planted, whatever the walker's speed. The cycle: each foot is down for the first `sf` of its half of the
// cycle, sweeping back 2 * gaitS, then swings forward and lifts.
fn gaitS(kind: i32) -> f32 { return array<f32, 3>(0.3, 0.13, 0.28)[clamp(kind, 0, 2)]; }
fn gaitSf(kind: i32) -> f32 { return array<f32, 3>(0.56, 0.6, 0.4)[clamp(kind, 0, 2)]; }
fn gaitLen(kind: i32) -> f32 { return 2.0 * gaitS(kind) / gaitSf(kind); }
fn pedGait(kind: i32, dist: f32, key: i32) -> f32 { return dist / gaitLen(kind) * 6.2831853 + f32(key); }
// one foot: (forward offset from the hip line, height above the ground) at leg phase lp
fn gaitFoot(lp: f32, S: f32, sf: f32, lift: f32) -> vec2f {
  let u = fract(lp / 6.2831853);
  // on methane ice, under a seventh of Earth's weight, a landing foot skids on a few centimetres before it grips
  if (u < sf) { let k = clamp(u / (0.18 * sf), 0.0, 1.0); return vec2f(S - 2.0 * S * u / sf + 0.05 * S * sin(3.14159 * k), 0.0); }
  let w = (u - sf) / (1.0 - sf);
  return vec2f(-S + 2.0 * S * w * w * (3.0 - 2.0 * w), lift * sin(3.14159 * w));
}
// the body's rise between steps: highest when both feet are off the ground (lopers), lowest mid-stance
fn gaitBob(ph: f32, sf: f32, h: f32) -> f32 {
  let u = fract(ph / 6.2831853);
  return h * (0.5 - 0.5 * cos(12.566371 * (u - sf * 0.5)));
}

// ---------- the walkers' bodies ----------
// Parts, so the material can dress each piece: pedPart() returns the id of the nearest one when gPT is set.
// 0 skin, 1 suit, 2 boots and gloves, 3 visor glass, 4 pack and fittings, 5 cape, 6 suit light, 7 android shell,
// 8 android light, 9 cable and tether, 10 exoskeleton frame, 11 skate wheels
var<private> gPT: bool = false;
var<private> gPB: f32 = 1e5;
var<private> gPP: i32 = 0;
fn pp(d: f32, id: i32) -> f32 { if (gPT && d < gPB) { gPB = d; gPP = id; } return d; }
// a capsule whose radius tapers from r1 at a to r2 at b
fn sdRC(p: vec3f, a: vec3f, b: vec3f, r1: f32, r2: f32) -> f32 {
  let ba = b - a;
  let l2 = dot(ba, ba);
  let rr = r1 - r2;
  let a2 = l2 - rr * rr;
  let il2 = 1.0 / l2;
  let pa = p - a;
  let y = dot(pa, ba);
  let z = y - l2;
  let xv = pa * l2 - ba * y;
  let x2 = dot(xv, xv);
  let y2 = y * y * l2;
  let z2 = z * z * l2;
  let k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) { return sqrt(x2 + z2) * il2 - r2; }
  if (sign(y) * a2 * y2 < k) { return sqrt(x2 + y2) * il2 - r1; }
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
// two-bone reach: where the middle joint goes, bending toward `bend`
fn ik2(h: vec3f, f: vec3f, l1: f32, l2: f32, bend: vec3f) -> vec3f {
  let d = f - h;
  let dl = max(length(d), 1e-4);
  let L = clamp(dl, 0.05, l1 + l2 - 0.002);
  let dir = d / dl;
  let a = (l1 * l1 - l2 * l2 + L * L) / (2.0 * L);
  let r = sqrt(max(l1 * l1 - a * a, 0.0));
  let pr = normalize(bend - dir * dot(bend, dir) + vec3f(0.0, 1e-4, 0.0));
  return h + dir * a + pr * r;
}
struct HP { ph: f32, stride: f32, fl: f32, arm: f32, bulk: f32, lean: f32, spread: f32, trail: f32, armOut: f32, reach: f32, sf: f32, bob: f32, roll: f32, lag: f32 };
// where a foot is: planted-foot gait when hp.sf > 0, else the old sine sweep (gliders and skaters, who are not walking)
fn pedFoot(hp: HP, lg: i32) -> vec3f {
  let sg = select(-1.0, 1.0, lg == 1);
  let lp = hp.ph + select(3.14159, 0.0, lg == 1);
  if (hp.sf > 0.0) {
    let g = gaitFoot(lp, hp.stride, hp.sf, hp.fl);
    return vec3f(0.1 * sg + hp.spread * sg * step(hp.sf, fract(lp / 6.2831853)), 0.09 + g.y - hp.bob, g.x);
  }
  return vec3f(0.1 * sg + hp.spread * sg * max(0.0, sin(lp)), 0.09 + hp.fl * max(0.0, cos(lp)) + hp.trail * 0.5, hp.stride * sin(lp) - hp.trail);
}
// a person: legs placed by the gait and reached with a knee, the body above leaned about the hips, arms swinging
// against the legs (or held out, or one reaching up). q is already lifted: its y = 0 is under the feet in the air.
fn pedHuman(q: vec3f, hp: HP) -> f32 {
  var d = 1e5;
  let b = hp.bulk;
  for (var lg = 0; lg < 2; lg++) {
    let sg = select(-1.0, 1.0, lg == 1);
    let foot = pedFoot(hp, lg);
    let hip = vec3f(0.095 * sg, 0.93, 0.0);
    let knee = ik2(hip, foot, 0.45, 0.44, vec3f(0.0, 0.1, 1.0));
    // thigh and shin blended into one leg, with a knee pad and a calf that swells below the knee
    var leg = smin(sdRC(q, hip, knee, 0.078 * b, 0.056 * b), sdRC(q, knee, foot, 0.054 * b, 0.04 * b), 0.05);
    leg = smin(leg, sdEll(q - mix(knee, foot, 0.28) - vec3f(0.0, 0.0, -0.012), vec3f(0.052, 0.09, 0.056) * b), 0.04);
    leg = min(leg, sdEll(q - knee - vec3f(0.0, 0.0, 0.035), vec3f(0.05, 0.05, 0.03) * b));
    d = min(d, pp(leg, 1));
    // the foot rolls: heel first at touchdown, heel up at push-off, toes raised through the swing
    var fa = 0.0;
    if (hp.sf > 0.0) {
      let fu = fract((hp.ph + select(3.14159, 0.0, lg == 1)) / 6.2831853);
      fa = 0.22 * (1.0 - smoothstep(0.0, 0.12, fu)) - 0.55 * smoothstep(hp.sf - 0.14, hp.sf, fu) * (1.0 - smoothstep(hp.sf, hp.sf + 0.2, fu)) + 0.25 * smoothstep(hp.sf + 0.2, 0.9, fu) * (1.0 - smoothstep(0.9, 1.0, fu));
    }
    let fv = q - foot;
    let fyz = rot2(fv.yz, fa);
    let fq = vec3f(fv.x, fyz.x, fyz.y) - vec3f(0.0, -0.035, 0.065);
    d = min(d, pp(sdBox(fq, vec3f(0.04 * b, 0.028 * b, 0.1)) - 0.022 * b, 2));
  }
  // the upper body, leaned forward about the hips, and turned a little against the stride (shoulders counter the hips)
  let yz = rot2(vec2f(q.y - 0.93, q.z), -hp.lean);
  let tw = rot2(vec2f(q.x, yz.y), 0.12 * sin(hp.ph) * step(0.001, hp.stride - 0.09));
  // and rolled over whichever leg is carrying the weight
  let rl = rot2(vec2f(tw.x, yz.x), hp.roll * sin(hp.ph));
  let ub = vec3f(rl.x, rl.y + 0.93, tw.y);
  let pel = sdEll(ub - vec3f(0.0, 0.97, 0.0), vec3f(0.15, 0.1, 0.1) * b);
  let abd = sdRC(ub, vec3f(0.0, 1.0, 0.0), vec3f(0.0, 1.2, 0.01), 0.11 * b, 0.125 * b);
  let chest = sdEll(ub - vec3f(0.0, 1.3, 0.015), vec3f(0.165, 0.135, 0.105) * b);
  d = min(d, pp(smin(smin(pel, abd, 0.06), chest, 0.06), 1));
  d = min(d, pp(sdRC(ub, vec3f(0.0, 1.4, 0.0), vec3f(0.0, 1.52, 0.012), 0.05, 0.042), 0));
  for (var lg = 0; lg < 2; lg++) {
    let sg = select(-1.0, 1.0, lg == 1);
    // arms swing against the legs, lagging behind them in the thick air, and bend as they come forward
    let ap = hp.ph + select(0.0, 3.14159, lg == 1) - hp.lag;
    let sh = vec3f(0.175 * sg * b, 1.385, 0.0);
    var hand = sh + vec3f(0.045 * sg + 0.05 * hp.lag, -0.52 + 0.1 * max(0.0, -sin(ap)) * hp.arm / 0.22, -hp.arm * sin(ap) + 0.05);
    hand = mix(hand, vec3f(0.74 * sg, 1.34 + 0.06 * sin(hp.ph * 1.7), -0.06), hp.armOut);
    if (lg == 1) { hand = mix(hand, vec3f(0.04, 2.2, 0.2), hp.reach); }
    let elbow = ik2(sh, hand, 0.29, 0.27, normalize(vec3f(0.25 * sg, -0.2, -1.0)));
    d = min(d, pp(smin(sdRC(ub, sh, elbow, 0.052 * b, 0.042 * b), sdRC(ub, elbow, hand, 0.04 * b, 0.031 * b), 0.02), 1));
    d = min(d, pp(sdEll(ub - hand - vec3f(0.0, -0.045, 0.0), vec3f(0.032, 0.055, 0.026) * b), 2));
    d = min(d, pp(length(ub - sh) - 0.062 * b, 1));
  }
  return d;
}
// the head frame of a leaned body (for helmets and packs worn on it)
fn pedUpper(q: vec3f, lean: f32) -> vec3f {
  let yz = rot2(vec2f(q.y - 0.93, q.z), -lean);
  return vec3f(q.x, yz.x + 0.93, yz.y);
}
// and back: a point on the leaned body, in the figure's frame
fn pedUnlean(v: vec3f, lean: f32) -> vec3f {
  let yz = rot2(vec2f(v.y - 0.93, v.z), lean);
  return vec3f(v.x, yz.x + 0.93, yz.y);
}

// One figure in its own frame: x across the ring, y up from the pavement, z the way it is walking.
fn pedFigure(q: vec3f, kind: i32, ph: f32, key: i32) -> f32 {
  var dd = 1e5;
  let s = sin(ph);
  let co = cos(ph);
  if (kind == 0) {
    // an exoskeleton carrying its rider: long mechanical legs with pistons and two-toed feet, a hip frame, side
    // struts up to a helmet ring, a power pack; the rider sits in it from the waist up
    let sw = s * 0.3;
    for (var lg = 0; lg < 2; lg++) {
      let sx = select(-0.15, 0.15, lg == 1);
      let pg = select(sw, -sw, lg == 1);
      let hip = vec3f(sx, 1.08, 0.0);
      let gf = gaitFoot(ph + select(3.14159, 0.0, lg == 1), gaitS(0), gaitSf(0), 0.1);
      let foot = vec3f(sx, 0.07 + gf.y, gf.x);
      let knee = ik2(hip, foot, 0.52, 0.56, vec3f(0.0, 0.0, 1.0));
      dd = min(dd, pp(sdRC(q, hip, knee, 0.07, 0.05), 10));
      dd = min(dd, pp(sdRC(q, knee, foot, 0.05, 0.035), 10));
      dd = min(dd, pp(sdSeg(q, mix(hip, knee, 0.2) + vec3f(0.0, 0.0, -0.07), mix(knee, foot, 0.35) + vec3f(0.0, 0.0, -0.06)) - 0.02, 4));
      dd = min(dd, pp(length(q - knee) - 0.075, 6));
      for (var t = 0; t < 2; t++) {
        let tx = select(-0.035, 0.035, t == 1);
        dd = min(dd, pp(sdRC(q, foot, foot + vec3f(tx, -0.05, 0.17), 0.035, 0.022), 10));
      }
    }
    dd = min(dd, pp(sdBox(q - vec3f(0.0, 1.08, 0.0), vec3f(0.21, 0.045, 0.11)) - 0.025, 10));
    dd = min(dd, pp(min(sdRC(q, vec3f(-0.23, 1.1, -0.1), vec3f(-0.21, 1.74, -0.1), 0.03, 0.022), sdRC(q, vec3f(0.23, 1.1, -0.1), vec3f(0.21, 1.74, -0.1), 0.03, 0.022)), 10));
    dd = min(dd, pp(sdBox(q - vec3f(0.0, 1.42, -0.23), vec3f(0.15, 0.2, 0.07)) - 0.03, 4));
    dd = min(dd, pp(length(vec2f(length(q.xz) - 0.2, q.y - 1.9)) - 0.02, 6));
    // the rider, waist up, riding the machine's steps a moment late (loosely strapped, in thick air)
    let r = q - vec3f(0.0, 0.18 + 0.025 * sin(ph * 2.0 - 0.9), 0.0);
    dd = min(dd, pp(smin(sdRC(r, vec3f(0.0, 1.0, 0.0), vec3f(0.0, 1.2, 0.01), 0.12, 0.13), sdEll(r - vec3f(0.0, 1.3, 0.015), vec3f(0.17, 0.14, 0.11)), 0.06), 1));
    dd = min(dd, pp(sdRC(r, vec3f(0.0, 1.4, 0.0), vec3f(0.0, 1.52, 0.012), 0.05, 0.042), 0));
    dd = min(dd, pp(sdEll(r - vec3f(0.0, 1.62, 0.01), vec3f(0.085, 0.105, 0.095)), 0));
    dd = min(dd, pp(sdEll(r - vec3f(0.0, 1.66, -0.01), vec3f(0.092, 0.08, 0.1)), 2));
    for (var lg = 0; lg < 2; lg++) {
      let sg = select(-1.0, 1.0, lg == 1);
      let sh = vec3f(0.17 * sg, 1.385, 0.0);
      let hand = vec3f(0.2 * sg, 1.0, 0.18);
      let el = ik2(sh, hand, 0.29, 0.27, vec3f(0.3 * sg, -0.2, -1.0));
      dd = min(dd, pp(smin(sdRC(r, sh, el, 0.05, 0.04), sdRC(r, el, hand, 0.038, 0.03), 0.02), 1));
    }
    if (hsh(key, key * 7 + 3, 96) < 0.18) {
      dd = min(dd, pp(sdSeg(q, vec3f(0.0, 1.6, -0.22), vec3f(0.0, 2.25, -0.22)) - 0.018, 4));
      dd = min(dd, pp(max(length(q.xz - vec2f(0.0, -0.22)) - 0.6, abs(q.y - 2.26 + 0.25 * length(q.xz - vec2f(0.0, -0.22))) - 0.02), 5));
    }
  } else if (kind == 1) {
    // an android in the old style, a head taller than the people around it: polished shell cinched at the waist,
    // a keel down the chest, lit rings at neck and waist, a masked face with a lit visor slit and a crest. It is
    // over-built for the gravity, so it shuffles in short, exact steps and turns its head in small jerks.
    let q1r = rot2(vec2f(q.x, q.y - 0.95), 0.025 * sin(ph));
    let q1 = vec3f(q1r.x, q1r.y + 0.95, q.z) / 1.12;
    for (var lg = 0; lg < 2; lg++) {
      let sg = select(-1.0, 1.0, lg == 1);
      let lp = ph + select(3.14159, 0.0, lg == 1);
      let gf = gaitFoot(lp, gaitS(1), gaitSf(1), 0.035);
      let foot = vec3f(0.1 * sg, 0.08 + gf.y, gf.x);
      let hip = vec3f(0.1 * sg, 0.92, 0.0);
      let knee = ik2(hip, foot, 0.43, 0.43, vec3f(0.0, 0.0, 1.0));
      dd = min(dd, pp(sdRC(q1, hip, knee, 0.085, 0.058), 7));
      dd = min(dd, pp(length(q1 - knee) - 0.06, 8));
      dd = min(dd, pp(sdRC(q1, knee, foot, 0.06, 0.038), 7));
      dd = min(dd, pp(sdBox(q1 - foot - vec3f(0.0, -0.05, 0.05), vec3f(0.045, 0.02, 0.095)) - 0.02, 7));
      let sh = vec3f(0.2 * sg, 1.38, 0.0);
      let hand = vec3f(0.16 * sg, 1.05 + 0.005 * sin(u.time * 23.0 + f32(key)), 0.2);
      let el = ik2(sh, hand, 0.27, 0.26, vec3f(0.2 * sg, 0.0, -1.0));
      dd = min(dd, pp(length(q1 - sh) - 0.078, 7));
      dd = min(dd, pp(sdRC(q1, sh, el, 0.048, 0.04), 7));
      dd = min(dd, pp(sdRC(q1, el, hand, 0.038, 0.03), 7));
      dd = min(dd, pp(sdEll(q1 - hand - vec3f(0.0, -0.03, 0.03), vec3f(0.03, 0.05, 0.04)), 7));
    }
    let hips = sdEll(q1 - vec3f(0.0, 0.95, 0.0), vec3f(0.19, 0.12, 0.13));
    let waist = sdRC(q1, vec3f(0.0, 1.02, 0.0), vec3f(0.0, 1.16, 0.0), 0.1, 0.09);
    let chest = sdEll(q1 - vec3f(0.0, 1.3, 0.01), vec3f(0.195, 0.165, 0.125));
    dd = min(dd, pp(smin(smin(hips, waist, 0.05), chest, 0.05), 7));
    dd = min(dd, pp(sdBox(q1 - vec3f(0.0, 1.28, 0.125), vec3f(0.01, 0.12, 0.025)) - 0.008, 8));
    dd = min(dd, pp(length(vec2f(length(q1.xz * vec2f(1.0, 1.25)) - 0.11, q1.y - 1.1)) - 0.014, 8));
    dd = min(dd, pp(sdRC(q1, vec3f(0.0, 1.44, 0.0), vec3f(0.0, 1.57, 0.0), 0.045, 0.04), 7));
    dd = min(dd, pp(length(vec2f(length(q1.xz) - 0.052, q1.y - 1.5)) - 0.012, 8));
    let yaw = 0.35 * floor(sin(u.time * 0.31 + f32(key)) * 2.5 + 0.5);
    let hq = rotY(q1 - vec3f(0.0, 1.68, 0.0), yaw);
    let skull = smin(sdEll(hq, vec3f(0.095, 0.125, 0.105)), sdEll(hq - vec3f(0.0, -0.06, 0.03), vec3f(0.065, 0.07, 0.085)), 0.04);
    dd = min(dd, pp(skull, 7));
    dd = min(dd, pp(max(sdEll(hq - vec3f(0.0, 0.0, 0.004), vec3f(0.097, 0.127, 0.107)), abs(hq.y - 0.012) - 0.012), 8));
    dd = min(dd, pp(sdBox(hq - vec3f(0.0, 0.1, -0.02), vec3f(0.008, 0.05, 0.1)) - 0.01, 7));
    if (hsh(key, key * 5 + 1, 99) < 0.5) {
      dd = min(dd, pp(length(vec2f(length(q1.xy - vec2f(0.0, 1.68)) - 0.26, q1.z + 0.14)) - 0.012, 8));
    }
    dd *= 1.12;
  } else if (kind == 2) {
    // a loper: a pressure suit, a bubble helmet, a life-support pack and weighted boots, bounding along with a hang
    // in every stride; the well-off bring a drone
    // the body rises between steps (both feet off the ground: the low-gravity lope); the feet stay planted
    // a crouch at mid-stance (knees take the landing), a float between steps
    let h = gaitBob(ph, gaitSf(2), 0.12) - 0.05;
    let ql = q - vec3f(0.0, h, 0.0);
    var hp: HP;
    hp.ph = ph; hp.stride = gaitS(2); hp.fl = 0.12; hp.arm = 0.22; hp.bulk = 1.3; hp.lean = 0.1; hp.spread = 0.0; hp.trail = 0.0; hp.armOut = 0.15; hp.reach = 0.0;
    hp.sf = gaitSf(2); hp.bob = h; hp.roll = 0.05; hp.lag = 0.6;
    dd = min(dd, pedHuman(ql, hp));
    let ub = pedUpper(ql, 0.1);
    dd = min(dd, pp(length(ub - vec3f(0.0, 1.64, 0.02)) - 0.165, 3));
    dd = min(dd, pp(length(vec2f(length(ub.xz - vec2f(0.0, 0.0)) - 0.13, ub.y - 1.49)) - 0.035, 4));
    dd = min(dd, pp(sdBox(ub - vec3f(0.0, 1.27, -0.2), vec3f(0.13, 0.17, 0.06)) - 0.04, 4));
    dd = min(dd, pp(sdSeg(ub, vec3f(0.08, 1.4, -0.2), vec3f(0.1, 1.5, -0.07)) - 0.018, 2));
    dd = min(dd, pp(sdBox(ub - vec3f(0.0, 1.3, 0.14), vec3f(0.05, 0.02, 0.01)), 6));
    for (var lg = 0; lg < 2; lg++) {
      let foot = pedFoot(hp, lg);
      dd = min(dd, pp(sdBox(ql - foot - vec3f(0.0, -0.075, 0.07), vec3f(0.065, 0.02, 0.13)) - 0.012, 4));
    }
    if (hsh(key, key * 3 + 2, 99) < 0.3) {
      let dq = q - vec3f(0.55, 2.05 + 0.07 * sin(u.time * 2.1 + f32(key)), 0.15);
      dd = min(dd, pp(sdEll(dq, vec3f(0.1, 0.055, 0.1)), 7));
      dd = min(dd, pp(length(vec2f(length(dq.xz) - 0.14, dq.y - 0.04)) - 0.011, 8));
    }
  } else if (kind == 3) {
    // a cape glider: thin enough, in air this thick, to hang on a cape between long, low hops; pitched forward,
    // arms out, legs trailing, a sleek helmet
    // a real hop: a short touchdown (knees bent), then a long arc that rises fast and sinks slowly on the cape, the
    // drag of the thick air stretching the fall; legs trail and arms spread only in the air
    let hu = fract(ph / 12.566371);
    var lift = -0.06 * sin(3.14159 * hu / 0.18);
    if (hu >= 0.18) { let w = pow((hu - 0.18) / 0.82, 0.65); lift = 0.9 * 4.0 * w * (1.0 - w); }
    let fly = smoothstep(0.0, 0.2, lift);
    let ql = q - vec3f(0.0, lift, 0.0);
    let lean = 0.2 + 0.38 * fly;
    var hp: HP;
    hp.ph = ph; hp.stride = 0.08; hp.fl = 0.0; hp.arm = 0.0; hp.bulk = 0.85; hp.lean = lean; hp.spread = 0.0; hp.trail = 0.32 * fly; hp.armOut = 0.35 + 0.65 * fly; hp.reach = 0.0;
    dd = min(dd, pedHuman(ql, hp));
    let ub = pedUpper(ql, lean);
    dd = min(dd, pp(sdEll(ub - vec3f(0.0, 1.63, -0.02), vec3f(0.1, 0.115, 0.14)), 1));
    dd = min(dd, pp(sdEll(ub - vec3f(0.0, 1.62, 0.045), vec3f(0.085, 0.06, 0.07)), 3));
    // the cape: from the wrists down to the ankles, billowing behind, scalloped along its hem
    let fl = 0.08 * sin(ph * 1.7);
    let g = ub;
    let hem = 0.3 + 0.07 * abs(sin(g.x * 9.0));
    let span = 0.3 + 0.42 * clamp((g.y - 0.3) / 1.0, 0.0, 1.0);
    let bil = 0.1 + 0.18 * (1.0 - clamp((g.y - 0.3) / 1.0, 0.0, 1.0)) + 0.2 * g.x * g.x;
    dd = min(dd, pp(max(max(abs(g.z + bil) - 0.012, abs(g.x) - span), max(hem - g.y, g.y - 1.36 - fl * abs(g.x))), 5));
  } else {
    // a skater towed along by a tether from the cable overhead, leaning into it, pushing off side to side
    var hp: HP;
    hp.ph = ph; hp.stride = 0.1; hp.fl = 0.05; hp.arm = 0.3; hp.bulk = 1.15; hp.lean = 0.3; hp.spread = 0.16; hp.trail = 0.0; hp.armOut = 0.0; hp.reach = 1.0;
    hp.roll = 0.1; hp.lag = 0.3;
    dd = min(dd, pedHuman(q, hp));
    let ub = pedUpper(q, 0.3);
    dd = min(dd, pp(sdEll(ub - vec3f(0.0, 1.64, 0.0), vec3f(0.12, 0.12, 0.13)), 1));
    dd = min(dd, pp(sdEll(ub - vec3f(0.0, 1.62, 0.06), vec3f(0.1, 0.055, 0.08)), 3));
    for (var lg = 0; lg < 2; lg++) {
      let sg = select(-1.0, 1.0, lg == 1);
      let lp = ph + select(3.14159, 0.0, lg == 1);
      let foot = vec3f(0.1 * sg + 0.16 * sg * max(0.0, sin(lp)), 0.09 + 0.05 * max(0.0, cos(lp)), 0.1 * sin(lp));
      let wq = q - foot - vec3f(0.0, -0.1, 0.065);
      dd = min(dd, pp(max(length(vec2f(fract(wq.z / 0.075 + 0.5) - 0.5, wq.y / 0.075)) * 0.075 - 0.024, max(abs(wq.x) - 0.014, abs(wq.z) - 0.12)), 11));
    }
    // the handle, the tether and a pulley on the cable
    let hw = ub - vec3f(0.04, 2.2, 0.2);
    dd = min(dd, pp(sdBox(hw - vec3f(0.0, 0.03, 0.0), vec3f(0.09, 0.012, 0.012)) - 0.006, 9));
    let top = vec3f(0.0, 4.36, 0.22);
    dd = min(dd, pp(sdSeg(q, pedUnlean(vec3f(0.04, 2.23, 0.2), 0.3), top) - 0.008, 9));
    dd = min(dd, pp(length(vec2f(length(vec2f(q.y - top.y, q.z - top.z)) - 0.06, q.x)) - 0.014, 9));
  }
  return dd;
}

fn pedQ(p: vec3f) -> vec4f {
  let c = vec2i(floor(p.xz / CS));
  let lq = p.xz - (vec2f(c) + 0.5) * CS;
  let m = max(abs(lq.x), abs(lq.y));
  // blocks without pedestrians report the distance to the block's edge, so distant rays never register a false hit
  let dens = pedDensity(c);
  if (dens <= 0.0) { return vec4f(max(CS * 0.5 - m, 0.0) + 2.5, 0.0, 0.0, -1.0); }
  var best = vec4f(max(abs(m - 10.2) - 0.95, 0.0) + 0.3, 0.0, 0.0, -1.0);
  if (abs(m - 10.2) > 1.15 || p.y > 4.6) { return best; }
  for (var ln = 0; ln < 2; ln++) {
    let R = select(9.95, 10.45, ln == 1);
    let dir = select(1.0, -1.0, ln == 1);
    var sP = 0.0;
    if (abs(lq.x) >= abs(lq.y)) { sP = select(6.0 * R + (R - lq.y), 2.0 * R + (lq.y + R), lq.x > 0.0); }
    else { sP = select(lq.x + R, 4.0 * R + (R - lq.x), lq.y > 0.0); }
    let per = 8.0 * R;
    let n = floor(per / 4.4);
    let spacing = per / n;
    let pace = pedPace(c, ln);
    // the drift and the sway below scale with the pace, so no walker ever slides backwards (at most 0.77 of the pace)
    let sp = sP - dir * (u.time * pace + 3.0 * pace * (vnoise(vec2f(u.time * 0.07, f32(c.x * 13 + c.y * 7 + ln)), 181) - 0.5));
    let k = floor(sp / spacing);
    let ki = i32(((k % n) + n) % n);
    let key = ki * 2 + ln;
    let ds = sp - (k + 0.5) * spacing;
    // distance to the edge of this walker's slot (never negative); only the figure itself sways around its spot
    var d = spacing * 0.5 - abs(ds) + 0.2;
    // the cable the skaters hook onto, over this ring of the pavement
    if (pedPulley(c, ln)) { d = min(d, length(vec2f(m - R, p.y - 4.4)) - 0.015); }
    if (hsh(c.x * 31 + key, c.y, 95) < dens) {
      let kind = pedKind(c, ln, key);
      // the walker's own frame faces the way it moves: +z along the ring for one lane, -z for the other
      let sw = 0.3 + 0.4 * hsh(key, c.x + c.y * 7, 182);
      let sway = select(min(0.8, 0.45 * pace / sw) * sin(u.time * sw + f32(key)), 0.0, kind == 4);
      let q = vec3f(m - R, p.y, dir * (ds - sway));
      // a box round the figure: only rays that reach it pay for the body
      let hy = select(1.4, 2.3, kind == 4);
      let bnd = length(max(abs(q - vec3f(0.0, hy, 0.0)) - vec3f(0.95, hy + 0.1, 1.0), vec3f(0.0)));
      var dd = bnd + 0.05;
      if (bnd < 0.25) {
        // distance walked so far: the ring's drift plus this walker's own sway, in its walking direction
        let dist = u.time * pace + 3.0 * pace * (vnoise(vec2f(u.time * 0.07, f32(c.x * 13 + c.y * 7 + ln)), 181) - 0.5) + dir * sway;
        var ph = pedPhase(kind, pace, key);
        if (kind <= 2) { ph = pedGait(kind, dist, key); }
        dd = pedFigure(q, kind, ph, key);
      }
      d = min(d, dd * 0.9);
      if (d < best.x) { best = vec4f(d, ds, q.x, f32(key + 1)); }
    }
    best.x = min(best.x, d);
  }
  return best;
}

fn airQ(p: vec3f) -> vec4f {
  var best = vec4f(1e5, 0.0, 0.0, 0.0);
  for (var ax = 0; ax < 2; ax++) {
    let dy = p.y - (AIR_Y - 2.0 + 4.0 * f32(ax));
    let along = select(p.x, p.z, ax == 0);
    let across = select(p.z, p.x, ax == 0);
    let sp3 = CS * 3.0;
    let li = round(across / sp3);
    let off = across - li * sp3;
    let lid = i32(li) * 2 + ax;
    let isOn = hsh(lid, 0, 80) < 0.55;
    var d = max(select(sp3 - abs(off) - 3.0, abs(off) - 2.8, isOn), max(-dy, dy - 6.0) - 1.5);
    if (isOn && abs(off) < 6.0 && dy > -3.0 && dy < 9.0) {
      let dir = select(-1.0, 1.0, hsh(lid, 0, 81) < 0.5);
      let sp = along * dir - u.time * 22.0 + hsh(lid, 0, 82) * 300.0;
      let slot = floor(sp / 90.0);
      let key = i32(slot);
      d = min(sp - slot * 90.0, (slot + 1.0) * 90.0 - sp) + 30.0;
      if (hsh(lid, key, 83) < 0.6) {
        let la = sp - (slot + 0.5) * 90.0;
        let hy = AIR_Y - 2.0 + 4.0 * f32(ax);
        let ctr = select(vec3f(along - la * dir, hy, li * sp3), vec3f(li * sp3, hy, along - la * dir), ax == 0);
        let dc = ctr - u.camPos;
        let lift = 6.0 * exp(-dot(dc, dc) / 400.0);
        let q = vec3f(off, dy - lift - 0.25 * sin(u.time * 0.9 + f32(key)), la);
        let body = (length(q / vec3f(0.9, 0.5, 2.4)) - 1.0) * 0.5;
        let wing = sdBox(q - vec3f(0.0, 0.1, 0.4), vec3f(2.2, 0.05, 0.35));
        let dd = min(body, wing);
        if (dd < d) {
          d = dd;
          best = vec4f(d, la, off, f32(key + lid * 17));
        }
      }
    }
    if (d < best.x) { best.x = d; }
  }
  return best;
}

// Delivery drones: x-bound lanes at 44 m and z-bound lanes at 48 m, so they never cross at one height.
fn droneQ(p: vec3f) -> vec4f {
  var best = vec4f(1e5, 0.0, 0.0, 0.0);
  // delivery drones serve the city only
  if (cityDist(p.xz) > cityR(p.xz) + 600.0) { best.x = 40.0; return best; }
  for (var ax = 0; ax < 2; ax++) {
    let dy = p.y - (DRONE_Y + 4.0 * f32(ax));
    let along = select(p.x, p.z, ax == 0);
    let across = select(p.z, p.x, ax == 0);
    let sp2 = CS * 2.0;
    let li = round(across / sp2);
    let off = across - li * sp2;
    let lid = i32(li) * 2 + ax;
    let isOn = hsh(lid, 3, 85) < 0.6;
    var d = max(select(sp2 - abs(off) - 1.2, abs(off) - 1.0, isOn), max(-dy, dy - 3.0) - 0.8);
    if (isOn && abs(off) < 3.0 && dy > -2.0 && dy < 5.0) {
      let dir = select(-1.0, 1.0, hsh(lid, 3, 86) < 0.5);
      let sp = along * dir - u.time * 13.0 + hsh(lid, 3, 87) * 200.0;
      let slot = floor(sp / 34.0);
      let key = i32(slot);
      d = min(sp - slot * 34.0, (slot + 1.0) * 34.0 - sp) + 12.0;
      if (hsh(lid, key, 88) < 0.55) {
        let la = sp - (slot + 0.5) * 34.0;
        let hy = DRONE_Y + 4.0 * f32(ax);
        let ctr = select(vec3f(along - la * dir, hy, li * sp2), vec3f(li * sp2, hy, along - la * dir), ax == 0);
        let dc = ctr - u.camPos;
        let lift = 3.0 * exp(-dot(dc, dc) / 90.0);
        let q = vec3f(off, dy - lift - 0.15 * sin(u.time * 2.0 + f32(key)), la);
        let body = sdBox(q, vec3f(0.3, 0.1, 0.3)) - 0.04;
        let qa = vec3f(abs(q.x) - 0.42, q.y - 0.08, abs(q.z) - 0.42);
        let rotor = max(length(qa.xz) - 0.26, abs(qa.y) - 0.015);
        let parcel = sdBox(q - vec3f(0.0, -0.3, 0.0), vec3f(0.18, 0.15, 0.18));
        let dd = min(min(body, rotor), parcel);
        if (dd < d) {
          d = dd;
          best = vec4f(d, la, off, f32(key + lid * 13));
        }
      }
    }
    if (d < best.x) { best.x = d; }
  }
  return best;
}

// Aerial police chases: a fugitive and a police spinner racing along street corridors at 64 m and 69 m,
// on lines every 208 m (clear of the giants, which stand midway between them).
fn chaseQ(p: vec3f) -> vec4f {
  var best = vec4f(1e5, 0.0, 0.0, 0.0);
  for (var ax = 0; ax < 2; ax++) {
    let hy = CHASE_Y + 5.0 * f32(ax);
    let dy = p.y - hy;
    let along = select(p.x, p.z, ax == 0);
    let across = select(p.z, p.x, ax == 0);
    let li = round(across / 208.0);
    let off = across - li * 208.0;
    let lid = i32(li) * 2 + ax;
    let isOn = hsh(lid, 5, 101) < 0.5;
    var d = max(select(208.0 - abs(off) - 4.0, abs(off) - 3.6, isOn), max(-dy, dy - 7.0) - 3.0);
    if (isOn && abs(off) < 8.0 && dy > -5.0 && dy < 11.0) {
      let dir = select(-1.0, 1.0, hsh(lid, 5, 102) < 0.5);
      let sp = along * dir - u.time * 40.0 + hsh(lid, 5, 103) * 2600.0;
      let slot = floor(sp / 2600.0);
      let key = i32(slot);
      d = min(sp - slot * 2600.0, (slot + 1.0) * 2600.0 - sp) + 1280.0;
      if (hsh(lid, key, 104) < 0.8) {
        let la = sp - (slot + 0.5) * 2600.0;
        if (abs(la) >= 16.0) { d = min(d, abs(la) - 14.0); }
        else {
          for (var k2 = 0; k2 < 2; k2++) {
            let lc = select(-8.0, 8.0, k2 == 0);
            let wa = along - (la - lc) * dir;
            let lat = 1.8 * sin(wa * 0.03 + f32(lid));
            let vy = 1.2 * sin(wa * 0.017 + f32(lid) * 2.0);
            let ctr = select(vec3f(wa, hy + vy, li * 208.0 + lat), vec3f(li * 208.0 + lat, hy + vy, wa), ax == 0);
            let dc = ctr - u.camPos;
            let lift = 6.0 * exp(-dot(dc, dc) / 300.0);
            let q = vec3f(off - lat, dy - vy - lift, la - lc);
            let body = (length(q / vec3f(0.95, 0.45, 2.3)) - 1.0) * 0.45;
            let fin = sdBox(q - vec3f(0.0, 0.25, -1.6), vec3f(1.4, 0.05, 0.35));
            let dd = min(body, fin);
            if (dd < d) { d = dd; best = vec4f(dd, la - lc, off - lat, f32(k2)); }
          }
        }
      }
    }
    best.x = min(best.x, d);
  }
  return best;
}

// ---------- set pieces ----------
// Car-park recess: wall position, outward sign, axis flag and face centre for the garage face.
fn garageGeom(cell: Cell) -> vec4f {
  let side = (i32(hsh(cell.seed, 1, 40) * 4.0) + 1) % 4;
  let axisX = side < 2;
  let sgn = select(-1.0, 1.0, (side & 1) == 0);
  let wa = select(cell.w.y, cell.w.x, axisX);
  let oa = select(cell.off.y, cell.off.x, axisX);
  let ob = select(cell.off.x, cell.off.y, axisX);
  return vec4f(oa + sgn * wa, sgn, select(0.0, 1.0, axisX), ob);
}

// A car lift in the recess: a car sits, sinks out of sight, the platform returns, another car rises.
fn garageCar(q: vec3f, seed: i32) -> f32 {
  let tt = u.time + f32(seed & 1023);
  let cyc = floor(tt / 26.0);
  let ph = tt - cyc * 26.0;
  var sink = 0.0;
  if (ph >= 6.0 && ph < 10.0) { sink = (ph - 6.0) / 4.0; }
  else if (ph >= 10.0 && ph < 16.0) { return 1e5; }
  else if (ph >= 16.0 && ph < 20.0) { sink = 1.0 - (ph - 16.0) / 4.0; }
  sink = sink * sink * (3.0 - 2.0 * sink) * 2.4;
  let kh = hsh(i32(cyc), seed + select(0, 1, ph >= 13.0), 78);
  let kind = select(select(0, 2, kh < 0.3), 3, kh > 0.8);
  return vehicleSDF(vec3f(q.x, q.y + sink, 2.8 - q.z), kind);
}

fn escGeom(cell: Cell) -> EscG {
  var g: EscG;
  g.ok = false;
  let side = (i32(hsh(cell.seed, 1, 40) * 4.0) + 3) % 4;
  let axisX = side < 2;
  let sgn = select(-1.0, 1.0, (side & 1) == 0);
  let wa = select(cell.w.y, cell.w.x, axisX);
  let wb = select(cell.w.x, cell.w.y, axisX);
  let oa = select(cell.off.y, cell.off.x, axisX);
  let ob = select(cell.off.x, cell.off.y, axisX);
  let wall = oa + sgn * wa;
  if (abs(wall) > 7.45 || wb < 3.0) { return g; }
  let ca = wall + sgn * 1.05;
  let l0 = ob - (wb - 1.2);
  let rise = min(10.0, (2.0 * wb - 2.4) / 1.5);
  let l1 = l0 + rise * 1.5;
  g.a = select(vec3f(l0, 0.3, ca), vec3f(ca, 0.3, l0), axisX);
  g.b = select(vec3f(l1, 0.3 + rise, ca), vec3f(ca, 0.3 + rise, l1), axisX);
  g.ok = true;
  return g;
}

fn walkY(ax: i32, az: i32, axis: i32) -> f32 { return 14.0 + 20.0 * hsh(ax, az, 131 + axis); }

// Skywalks cross the street between facing towers; each cell draws its own and its neighbours' halves.
fn walkSDF(q: vec3f, c: vec2i, fl: i32) -> f32 {
  var d = 1e5;
  if ((fl & 2048) != 0) { d = min(d, sdBox(q - vec3f(13.0, walkY(c.x, c.y, 0), 0.0), vec3f(5.0, 1.6, 1.5)) - 0.1); }
  if ((fl & 8192) != 0) { d = min(d, sdBox(q - vec3f(-13.0, walkY(c.x - 1, c.y, 0), 0.0), vec3f(5.0, 1.6, 1.5)) - 0.1); }
  if ((fl & 4096) != 0) { d = min(d, sdBox(q - vec3f(0.0, walkY(c.x, c.y, 1), 13.0), vec3f(1.5, 1.6, 5.0)) - 0.1); }
  if ((fl & 16384) != 0) { d = min(d, sdBox(q - vec3f(0.0, walkY(c.x, c.y - 1, 1), -13.0), vec3f(1.5, 1.6, 5.0)) - 0.1); }
  return d;
}

// ---------- district set pieces and easter eggs ----------
fn sdEll(q: vec3f, r: vec3f) -> f32 { return (length(q / r) - 1.0) * min(min(r.x, r.y), r.z); }
fn sdCyl(q: vec3f, r: f32, y0: f32, y1: f32) -> f32 { return max(length(q.xz) - r, max(y0 - q.y, q.y - y1)); }
fn sdCone(q: vec3f, r0: f32, y0: f32, y1: f32) -> f32 {
  let t = clamp((q.y - y0) / (y1 - y0), 0.0, 1.0);
  return max((length(q.xz) - r0 * (1.0 - t)) * 0.8, max(y0 - q.y, q.y - y1));
}
fn rotY(q: vec3f, a: f32) -> vec3f { let c = cos(a); let s = sin(a); return vec3f(c * q.x + s * q.z, q.y, -s * q.x + c * q.z); }

fn industrialSDF(q: vec3f, cell: Cell) -> vec2f {
  let v = cell.v;
  let h = cell.h;
  var d = 1e5;
  var m = 36.0;
  if (v < 0.22) {
    // boiler house with twin banded smokestacks
    d = sdBox(q - vec3f(0.0, 4.0, 0.0), vec3f(8.5, 4.0, 5.5));
    for (var i = 0; i < 2; i++) {
      let sq = q - vec3f(select(-4.0, 4.0, i == 1), 0.0, 0.0);
      d = min(d, max(length(sq.xz) - mix(1.9, 1.25, clamp(q.y / h, 0.0, 1.0)), max(-q.y, q.y - h)) * 0.95);
    }
  } else if (v < 0.4) {
    // refinery: flare stack, tanks, a pipe run and a burning flare
    d = max(length(q.xz) - 0.9, max(-q.y, q.y - h));
    d = min(d, sdCyl(q - vec3f(5.5, 0.0, 4.0), 2.6, 0.0, 9.0));
    d = min(d, sdCyl(q - vec3f(-5.0, 0.0, -4.5), 3.0, 0.0, 12.0));
    d = min(d, max(length(vec2f(q.y - 3.0, q.z + 4.5)) - 0.5, abs(q.x) - 8.0));
    let fk = 0.85 + 0.15 * sin(u.time * 11.0 + q.y * 0.9);
    let flame = sdEll(q - vec3f(sin(u.time * 3.0) * 0.3, h + 0.6 + 2.6 * fk, 0.0), vec3f(0.8, 3.0 * fk, 0.8));
    if (flame < d) { d = flame; m = 37.0; }
  } else if (v < 0.55) {
    // cooling tower: a hyperboloid shell with steam rolling off the top
    let k = (q.y - 0.72 * h) / (0.4 * h);
    d = max(abs(length(q.xz) - 4.0 * sqrt(1.0 + k * k)) - 0.45, max(-q.y, q.y - h)) * 0.8;
    let st = q - vec3f(0.0, h + 3.0 + sin(u.time * 0.5) * 0.5, 0.0);
    let steam = sdEll(st, vec3f(5.5, 3.5, 5.5)) + 0.6 * sin(st.x * 0.9 + u.time) * sin(st.z * 0.8 - u.time * 0.7);
    if (steam < d) { d = steam; m = 38.0; }
  } else if (v < 0.75) {
    // domed storage tanks
    for (var i = 0; i < 3; i++) {
      let a = f32(i) * 2.094 + 0.5;
      let tq = q - vec3f(cos(a) * 5.0, 0.0, sin(a) * 5.0);
      d = min(d, min(sdCyl(tq, 3.6, 0.0, h - 1.8), sdEll(tq - vec3f(0.0, h - 1.8, 0.0), vec3f(3.6, 1.8, 3.6))));
    }
  } else {
    // factory shed with a sawtooth roof
    d = max(sdBox(q - vec3f(0.0, h * 0.5 + 1.0, 0.0), vec3f(9.0, h * 0.5 + 1.0, 8.5)), q.y - (h + 2.2 * fract(q.x / 4.5))) * 0.85;
  }
  return vec2f(d, m);
}

fn spaceportSDF(q: vec3f, cell: Cell) -> vec2f {
  let v = cell.v;
  let h = cell.h;
  var d = sdBox(q - vec3f(0.0, 0.25, 0.0), vec3f(9.4, 0.25, 9.4));
  var m = 40.0;
  if (v < 0.28) {
    // rocket on its pad beside a service tower
    let rq = q - vec3f(-1.5, 0.5, 0.0);
    let bt = h * 0.8;
    var rk = min(max(length(rq.xz) - 1.7, max(-rq.y, rq.y - bt)), sdCone(rq, 1.7, bt, h));
    for (var i = 0; i < 2; i++) {
      let bq = rq - vec3f(0.0, 0.0, select(-2.6, 2.6, i == 1));
      rk = min(rk, min(sdCyl(bq, 0.85, 0.0, h * 0.42), sdCone(bq, 0.85, h * 0.42, h * 0.5)));
    }
    for (var i = 0; i < 4; i++) {
      let fq = rotY(rq, f32(i) * 1.5708 + 0.7854);
      rk = min(rk, sdBox(fq - vec3f(2.3, 2.2, 0.0), vec3f(0.9, 2.0, 0.1)));
    }
    if (rk < d) { d = rk; m = 39.0; }
    let gq = q - vec3f(5.8, 0.0, 0.0);
    let tower = max(sdBox(gq - vec3f(0.0, h * 0.45, 0.0), vec3f(1.6, h * 0.45, 1.6)), 1.25 - max(abs(gq.x), abs(gq.z)));
    d = min(d, min(tower, sdBox(q - vec3f(2.9, h * 0.62, 0.0), vec3f(1.6, 0.3, 0.5))));
  } else if (v < 0.43) {
    // empty pad with a flame trench and two light masts (launches rise from here)
    d = max(d, -sdBox(q - vec3f(0.0, 0.5, 0.0), vec3f(2.2, 0.6, 7.0)));
    d = min(d, min(sdCyl(q - vec3f(7.5, 0.0, 7.5), 0.3, 0.0, 12.0), sdCyl(q - vec3f(-7.5, 0.0, -7.5), 0.3, 0.0, 12.0)));
  } else if (v < 0.63) {
    // landed freighter: slab hull, bridge block, cargo pods, engines and landing legs
    let sq = q - vec3f(0.0, 9.5, 0.0);
    var hull = sdBox(sq, vec3f(8.2, 3.0, 4.4)) - 0.6;
    hull = min(hull, sdBox(sq - vec3f(5.4, 2.4, 0.0), vec3f(2.6, 2.2, 3.0)) - 0.4);
    hull = min(hull, sdBox(sq - vec3f(-2.5, -2.6, 0.0), vec3f(4.6, 1.8, 5.4)) - 0.3);
    for (var i = 0; i < 3; i++) {
      let eq = sq - vec3f(-9.0, select(0.0, select(-1.6, 1.6, i == 2), i > 0), select(0.0, select(-2.4, 2.4, i == 2), i > 0));
      hull = min(hull, max(length(eq.yz) - 1.2, abs(eq.x) - 1.2));
    }
    for (var i = 0; i < 4; i++) {
      let lx = select(-5.5, 5.5, (i & 1) == 1);
      let lz = select(-3.8, 3.8, (i & 2) == 2);
      hull = min(hull, sdSeg(q, vec3f(lx, 7.0, lz), vec3f(lx * 1.15, 0.5, lz * 1.25)) - 0.35);
    }
    if (hull < d) { d = hull; m = 39.0; }
  } else if (v < 0.78) {
    // hangar vault
    let arch = max(max(length(q.yz) - 8.4, abs(q.x) - 9.0), -q.y);
    if (arch < d) { d = arch; m = 36.0; }
  } else if (v < 0.9) {
    // radar dish sweeping slowly
    d = min(d, sdCyl(q, 1.2, 0.0, 11.0));
    let dq = rotY(q - vec3f(0.0, 13.0, 0.0), u.time * 0.25);
    let tq = vec3f(dq.x * 0.82 - dq.y * 0.57, dq.x * 0.57 + dq.y * 0.82, dq.z);
    let dish = max(abs(length(tq - vec3f(0.0, 9.0, 0.0)) - 10.5) - 0.2, tq.y - 1.5);
    d = min(d, max(dish, length(tq.xz) - 7.5));
    m = 36.0;
  } else {
    // control tower
    d = min(d, sdCyl(q, 2.2, 0.0, 31.0));
    let cab = sdCyl(q, 4.4 - max(q.y - 33.0, 0.0) * 0.4, 30.0, 35.0);
    if (cab < d) { d = cab; m = 39.0; }
    d = min(d, sdCyl(q, 0.12, 35.0, 41.0));
  }
  return vec2f(d, m);
}

fn pyramidSDF(q: vec3f, h: f32) -> vec2f {
  let d = max((max(abs(q.x), abs(q.z)) - 9.3 * (1.0 - q.y / h)) * 0.7, max(-q.y, q.y - h));
  return vec2f(d, 41.0);
}

fn catSDF(q0: vec3f) -> f32 {
  let q = q0 / 1.45;
  var d = sdEll(q - vec3f(0.0, 0.42, 0.0), vec3f(0.3, 0.42, 0.24));
  d = smin(d, length(q - vec3f(0.1, 0.92, 0.0)) - 0.2, 0.07);
  let e = vec3f(q.x - 0.1, q.y, abs(q.z) - 0.1);
  d = min(d, sdCone(e, 0.08, 1.02, 1.22));
  d = min(d, sdSeg(q, vec3f(-0.24, 0.08, 0.0), vec3f(-0.3, 0.05, 0.38)) - 0.05);
  return d * 1.45;
}

// small easter eggs in the wild land and the city; q is local, with the ground at y = 0
fn eggSDF(egg: i32, q: vec3f, seed: i32) -> f32 {
  switch egg {
    case 1: {
      var d = max(length(q.xz) - mix(2.6, 1.8, clamp(q.y / 22.0, 0.0, 1.0)), max(-q.y, q.y - 22.0)) * 0.95;
      d = min(d, sdCyl(q, 2.5, 21.8, 22.2));
      d = min(d, sdCyl(q, 1.6, 22.2, 24.8));
      d = min(d, sdCone(q, 2.1, 24.8, 27.2));
      return min(d, sdBox(q - vec3f(5.0, 2.0, 0.0), vec3f(2.5, 2.0, 3.0)));
    }
    case 2: {
      var d = 1e5;
      for (var i = 0; i < 3; i++) {
        let mq = q - vec3f(f32(i - 1) * 4.0, 0.0, 0.0);
        d = min(d, sdBox(mq - vec3f(0.0, 1.6, 0.0), vec3f(1.0, 1.6, 0.8)) - 0.2);
        d = min(d, sdBox(mq - vec3f(0.0, 4.4, 0.1), vec3f(0.85, 1.4, 0.9)) - 0.2);
        d = min(d, sdBox(mq - vec3f(0.0, 5.1, 0.95), vec3f(0.8, 0.2, 0.2)));
        d = min(d, sdBox(mq - vec3f(0.0, 4.3, 1.0), vec3f(0.22, 0.65, 0.35)));
      }
      return d;
    }
    case 3: {
      let ang = round(atan2(q.z, q.x) / 0.5236) * 0.5236;
      let lq = rotY(q, ang) - vec3f(7.0, 0.0, 0.0);
      var d = sdBox(lq - vec3f(0.0, 1.8, 0.0), vec3f(0.5, 1.8, 0.95));
      let lin = rotY(q, ang + 0.2618) - vec3f(7.1, 3.85, 0.0);
      return min(d, sdBox(lin, vec3f(0.45, 0.25, 2.1)));
    }
    case 4: {
      var d = smin(length(q - vec3f(0.0, 1.2, 0.0)) - 1.3, length(q - vec3f(0.0, 3.0, 0.0)) - 0.9, 0.2);
      d = smin(d, length(q - vec3f(0.0, 4.25, 0.0)) - 0.62, 0.15);
      d = min(d, sdSeg(q, vec3f(0.5, 4.25, 0.0), vec3f(1.2, 4.2, 0.0)) - 0.08);
      d = min(d, min(sdCyl(q, 0.42, 4.7, 5.35), sdCyl(q, 0.7, 4.7, 4.78)));
      return min(d, sdSeg(q, vec3f(0.0, 3.2, 0.7), vec3f(0.3, 3.9, 1.6)) - 0.06);
    }
    case 5: {
      // a Huygens-style lander, its parachute collapsed beside it
      var d = sdEll(q - vec3f(0.0, 0.45, 0.0), vec3f(1.5, 0.45, 1.5));
      d = min(d, sdCyl(q, 0.95, 0.5, 1.35));
      d = min(d, sdCyl(q - vec3f(0.35, 0.0, 0.2), 0.1, 1.35, 2.0));
      let cq = q - vec3f(6.0, 0.0, 2.0);
      d = min(d, (max(abs(sdEll(cq, vec3f(4.2, 1.6, 3.6))) - 0.06, -cq.y) + 0.12 * sin(cq.x * 2.0) * sin(cq.z * 1.7)) * 0.8);
      return min(d, sdSeg(q, vec3f(0.6, 1.1, 0.3), vec3f(3.0, 0.3, 1.4)) - 0.03);
    }
    case 6: {
      let bob = sin(u.time * 0.8) * 0.5;
      let sq = q - vec3f(0.0, 16.0 + bob, 0.0);
      var d = min(sdEll(sq, vec3f(5.5, 1.1, 5.5)), max(length(sq - vec3f(0.0, 0.6, 0.0)) - 2.1, -sq.y));
      let r = 1.9 + (15.0 - q.y) * 0.12;
      d = min(d, max(abs(length(q.xz) - r) - 0.04, max(-q.y, q.y - 15.0)));
      let cq = rotY(q - vec3f(0.0, 6.5 + 0.6 * sin(u.time * 0.7), 0.0), u.time * 0.6);
      var cow = sdBox(cq, vec3f(0.95, 0.5, 0.42)) - 0.15;
      cow = min(cow, sdBox(cq - vec3f(1.2, 0.35, 0.0), vec3f(0.35, 0.3, 0.28)));
      for (var i = 0; i < 4; i++) { cow = min(cow, sdSeg(cq, vec3f(select(-0.7, 0.7, (i & 1) == 1), -0.4, select(-0.3, 0.3, (i & 2) == 2)), vec3f(select(-0.7, 0.7, (i & 1) == 1), -1.2, select(-0.3, 0.3, (i & 2) == 2))) - 0.1); }
      return min(d, cow);
    }
    case 7: {
      var d = sdSeg(q, vec3f(0.0), vec3f(0.0, 11.0, 0.0)) - 0.9;
      d = min(d, sdEll(q - vec3f(0.0, 14.0, 0.0), vec3f(6.5, 4.5, 6.5)) + 0.3 * sin(q.x * 1.3) * sin(q.z * 1.1));
      d = min(d, sdBox(q - vec3f(0.0, 8.0, 0.0), vec3f(3.2, 0.2, 3.2)));
      d = min(d, sdBox(q - vec3f(0.6, 9.4, 0.6), vec3f(1.6, 1.2, 1.4)));
      d = min(d, max(sdBox(q - vec3f(0.6, 11.2, 0.6), vec3f(2.0, 0.8, 1.8)), abs(q.x - 0.6) * 0.6 + (q.y - 11.9)));
      return min(d, sdBox(q - vec3f(3.3, 4.0, 0.0), vec3f(0.06, 4.0, 0.4)));
    }
    case 8: {
      var d = 1e5;
      for (var i = 0; i < 3; i++) {
        let cq = q - vec3f(f32(i - 1) * 4.5, 0.0, sin(f32(i) * 2.0));
        d = min(d, sdEll(cq - vec3f(0.0, 1.9, 0.0), vec3f(1.3, 0.6, 0.5)));
        d = min(d, sdEll(cq - vec3f(0.0, 2.5, 0.0), vec3f(0.6, 0.45, 0.4)));
        d = min(d, sdSeg(cq, vec3f(1.1, 2.0, 0.0), vec3f(1.6, 2.8, 0.0)) - 0.22);
        d = min(d, sdEll(cq - vec3f(1.85, 2.85, 0.0), vec3f(0.4, 0.2, 0.2)));
        for (var j = 0; j < 4; j++) { let lx = select(-0.8, 0.8, (j & 1) == 1); let lz = select(-0.28, 0.28, (j & 2) == 2); d = min(d, sdSeg(cq, vec3f(lx, 1.6, lz), vec3f(lx, 0.0, lz)) - 0.12); }
      }
      return d;
    }
    case 9: {
      var d = 1e5;
      for (var i = 0; i < 5; i++) {
        let a = f32(i) * 1.3 + f32(seed & 7);
        let fq = rotY(q - vec3f(cos(a) * (2.0 + f32(i)), 0.0, sin(a) * (2.0 + f32(i))), a);
        d = min(d, sdEll(fq - vec3f(0.0, 1.05, 0.0), vec3f(0.36, 0.24, 0.2)));
        d = min(d, sdSeg(fq, vec3f(0.25, 1.1, 0.0), vec3f(0.4, 1.5, 0.0)) - 0.05);
        d = min(d, sdSeg(fq, vec3f(0.4, 1.5, 0.0), vec3f(0.3, 1.8, 0.0)) - 0.05);
        d = min(d, sdEll(fq - vec3f(0.42, 1.85, 0.0), vec3f(0.12, 0.08, 0.07)));
        d = min(d, sdSeg(fq, vec3f(0.0, 0.9, 0.0), vec3f(0.0, 0.0, 0.0)) - 0.025);
      }
      return d;
    }
    case 10: {
      var d = 1e5;
      for (var i = 0; i < 3; i++) { d = min(d, sdEll(q - vec3f(f32(i) * 2.6 - 3.0, 0.0, 0.0), vec3f(1.1, 0.75, 0.55))); }
      d = min(d, sdSeg(q, vec3f(3.0, 0.0, 0.0), vec3f(4.1, 2.6, 0.0)) - 0.35);
      return min(d, sdEll(q - vec3f(4.5, 2.7, 0.0), vec3f(0.6, 0.35, 0.33)));
    }
    case 11: {
      let ph = fract(u.time / 26.0 + f32(seed & 63) * 0.0157);
      let rise = sstepJ(0.2, 0.3, ph) * (1.0 - sstepJ(0.45, 0.55, ph));
      var d = sdEll(q - vec3f(0.0, -1.2 + 1.1 * rise, 0.0), vec3f(6.5, 1.3, 2.2));
      let tq = q - vec3f(-7.5, -2.0 + 5.0 * rise, 0.0);
      return min(d, min(sdEll(tq, vec3f(0.8, 0.3, 2.8)), sdSeg(q, vec3f(-6.0, -1.0 + rise, 0.0), tq) - 0.45));
    }
    case 12: {
      // one cell's share of the hillside letters DRIFT CITY (5 x 7 glyphs of 1.8 m pixels)
      var txt = array<i32, 10>(3, 13, 7, 5, 15, -1, 2, 7, 15, 38);
      let face = select(-1.0, 1.0, fract(f32(seed) * 0.0) > 2.0);
      return 1e5 + face;
    }
    case 15: {
      var d = sdCyl(q, 1.4, 0.0, 9.0);
      let tq = vec3f(q.x * 0.7 - (q.y - 12.0) * 0.71, q.x * 0.71 + (q.y - 12.0) * 0.7, q.z);
      d = min(d, max(max(abs(length(tq - vec3f(0.0, 10.0, 0.0)) - 11.0) - 0.25, tq.y - 1.8), length(tq.xz) - 8.2));
      return min(d, sdSeg(tq, vec3f(0.0, -1.0, 0.0), vec3f(0.0, 4.5, 0.0)) - 0.12);
    }
    case 17: {
      var d = sdBox(q - vec3f(0.0, 1.6, 0.0), vec3f(3.2, 1.6, 2.4));
      d = min(d, max(sdBox(q - vec3f(0.0, 3.6, 0.0), vec3f(3.6, 1.4, 2.8)), abs(q.z) * 0.8 + (q.y - 4.6)));
      d = min(d, sdBox(q - vec3f(-2.2, 4.6, 1.0), vec3f(0.35, 1.3, 0.35)));
      let st = q - vec3f(-2.2, 6.8 + fract(u.time * 0.2) * 2.0, 1.0);
      return min(d, sdEll(st, vec3f(0.7, 0.9, 0.7)) + 0.2 * sin(st.y * 3.0 + u.time));
    }
    case 18: {
      let rq = q - vec3f(0.0, 0.6, 0.0);
      let tq = vec3f(rq.x, rq.y * 0.94 - rq.z * 0.34, rq.y * 0.34 + rq.z * 0.94);
      var d = max(sdEll(tq, vec3f(7.0, 2.4, 2.6)), -tq.y - 1.5);
      d = max(d, -sdEll(tq - vec3f(0.0, 1.0, 0.0), vec3f(6.4, 2.0, 2.1)));
      return min(d, sdSeg(tq, vec3f(0.5, 0.0, 0.0), vec3f(1.5, 6.5, 0.0)) - 0.18);
    }
    case 19: {
      var d = sdEll(q - vec3f(0.0, 2.6, 0.0), vec3f(6.0, 2.6, 3.0));
      d = smin(d, length(q - vec3f(5.5, 5.5, 0.0)) - 2.6, 0.8);
      let e = vec3f(q.x - 5.5, q.y, abs(q.z) - 1.3);
      d = min(d, sdCone(e, 0.9, 7.4, 9.4));
      d = min(d, min(sdSeg(q, vec3f(4.0, 0.7, 1.4), vec3f(8.2, 0.7, 1.4)) - 0.7, sdSeg(q, vec3f(4.0, 0.7, -1.4), vec3f(8.2, 0.7, -1.4)) - 0.7));
      return min(d, sdSeg(q, vec3f(-5.5, 0.6, 0.0), vec3f(-4.0, 0.6, 3.6)) - 0.5);
    }
    case 20: {
      let d = max(abs(length(q) - 3.2) - 0.35, -q.y);
      return min(max(d, -max(length(q.yz) - 1.0, abs(q.x - 3.4) - 1.2)), max(max(abs(length(q.yz) - 1.1) - 0.25, -q.y), abs(q.x - 3.6) - 1.0));
    }
    case 21: { return catSDF(q); }
    case 22: {
      var d = sdCyl(q, 0.25, 0.0, 3.5);
      let tq = q - vec3f(0.0, 5.2, 0.0);
      return min(d, length(vec2f(length(tq.xy) - 2.4, tq.z)) - 1.05);
    }
    case 23: {
      let sq = q - vec3f(0.0, 1.6, 0.0);
      var d = min(sdEll(sq, vec3f(4.2, 0.8, 4.2)), max(length(sq - vec3f(0.0, 0.5, 0.0)) - 1.7, -sq.y));
      for (var i = 0; i < 3; i++) { let a = f32(i) * 2.094; d = min(d, sdSeg(q, vec3f(cos(a) * 2.4, 1.2, sin(a) * 2.4), vec3f(cos(a) * 3.2, 0.0, sin(a) * 3.2)) - 0.12); }
      return d;
    }
    case 24: {
      var d = sdEll(q - vec3f(0.0, 3.2, 0.0), vec3f(4.0, 2.2, 1.9));
      d = smin(d, sdSeg(q, vec3f(3.0, 4.0, 0.0), vec3f(5.5, 8.5, 0.0)) - 0.7, 0.8);
      d = smin(d, sdEll(q - vec3f(6.0, 8.8, 0.0), vec3f(1.1, 0.7, 0.7)), 0.4);
      d = smin(d, sdSeg(q, vec3f(-3.0, 3.0, 0.0), vec3f(-7.5, 1.0, 1.5)) - 0.6 + 0.04 * (q.x + 3.0), 0.8);
      for (var i = 0; i < 4; i++) { d = min(d, sdSeg(q, vec3f(select(-2.0, 2.0, (i & 1) == 1), 2.0, select(-1.0, 1.0, (i & 2) == 2)), vec3f(select(-2.0, 2.0, (i & 1) == 1), 0.0, select(-1.0, 1.0, (i & 2) == 2))) - 0.55); }
      return d + 0.08 * sin(q.x * 5.0) * sin(q.y * 5.0) * sin(q.z * 5.0);
    }
    case 25: {
      var d = sdBox(q - vec3f(0.0, 1.0, 0.0), vec3f(3.2, 1.0, 3.2));
      for (var i = 0; i < 2; i++) { let sx = select(-1.0, 1.0, i == 1); d = min(d, sdBox(q - vec3f(0.0, 5.2, sx * 1.3), vec3f(0.9, 3.2, 0.7)) - 0.1); }
      d = min(d, sdBox(q - vec3f(0.0, 11.0, 0.0), vec3f(1.5, 2.8, 2.3)) - 0.2);
      d = min(d, sdBox(q - vec3f(0.0, 14.8, 0.0), vec3f(1.0, 1.0, 1.0)) - 0.15);
      d = min(d, sdCyl(q - vec3f(0.0, 0.0, 0.0), 0.08, 15.8, 17.8));
      for (var i = 0; i < 2; i++) { let sx = select(-1.0, 1.0, i == 1); d = min(d, sdSeg(q, vec3f(0.0, 13.0, sx * 2.8), vec3f(1.8, 9.5, sx * 3.2)) - 0.55); }
      return d;
    }
    case 26: {
      let a = u.time * 0.15 + f32(seed & 15);
      let dq = rotY(q - vec3f(cos(a) * 4.0, 0.0, sin(a) * 4.0), -a);
      let bob = 0.08 * sin(u.time * 1.3);
      var d = sdEll(dq - vec3f(0.0, 0.5 + bob, 0.0), vec3f(1.5, 0.9, 1.1));
      d = smin(d, length(dq - vec3f(0.0, 1.8 + bob, 0.95)) - 0.7, 0.3);
      return min(d, sdEll(dq - vec3f(0.0, 1.7 + bob, 1.75), vec3f(0.35, 0.12, 0.35)));
    }
    default: { return 1e5; }
  }
}

// hillside letters: the part of DRIFT CITY that falls in this block (k = block index along the sign)
fn signSDF(q: vec3f, k: i32, facePos: bool) -> f32 {
  var txt = array<i32, 10>(3, 13, 7, 5, 15, -1, 2, 7, 15, 38);
  let px = 1.8;
  let xs = q.x + 13.0 + f32(k) * CS;
  let u0 = select(10.0 * 6.0 * px - xs, xs, facePos) / px;
  let bnd = max(abs(q.z) - 0.6, q.y - 12.8);
  if (q.y < -30.0 || bnd > 3.0 || u0 < -3.0 || u0 > 63.0) { return max(max(bnd, -30.0 - q.y), 1.0); }
  var d = 1e5;
  let gy0 = floor(q.y / px);
  let gx0 = floor(u0);
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let gx = i32(gx0) + i;
      let gy = i32(gy0) + j;
      if (gx < 0 || gy < 0 || gy > 6) { continue; }
      let ch = gx / 6;
      let col = gx - ch * 6;
      if (ch > 9 || col > 4) { continue; }
      let g = txt[ch];
      if (g < 0) { continue; }
      if (glyphBit(u32(g), col, 6 - gy) < 0.5) { continue; }
      let c = vec2f(f32(gx) + 0.5, f32(gy) + 0.5) * px;
      d = min(d, sdBox(vec3f(u0 * px - c.x, q.y - c.y, q.z), vec3f(px * 0.5, px * 0.5, 0.5)));
    }
  }
  // a beam under the letters and posts every 5.4 m down into the hill
  d = min(d, sdBox(vec3f(0.0, q.y + 0.3, q.z), vec3f(1e4, 0.3, 0.3)) + max(0.0, max(-u0, u0 - 59.0)) * px);
  let pu = u0 * px - (round(u0 * px / 5.4) * 5.4);
  if (u0 > -0.5 && u0 < 59.5) { d = min(d, sdBox(vec3f(pu, q.y + 15.0, q.z), vec3f(0.18, 15.0, 0.18))); }
  return min(d, max(bnd, 1.2));
}

// strings of red lanterns across Chinatown streets, sagging between the buildings
fn lanternSDF(lq: vec2f, y: f32, bits: i32) -> vec2f {
  if (y > 7.3 || y < 4.9) { return vec2f(max(y - 7.2, 5.0 - y), 43.0); }
  var d = 1e5;
  var m = 36.0;
  for (var k = 0; k < 4; k++) {
    if ((bits & (1 << u32(k))) == 0) { continue; }
    let ax = k < 2;
    let sg = select(-1.0, 1.0, (k & 1) == 0);
    let a = select(lq.y, lq.x, ax) * sg - 13.0;
    if (a < -3.6 || a > 0.05) { continue; }
    let along = select(lq.x, lq.y, ax);
    let dz = along - round(along / 4.33) * 4.33;
    let t = a / 3.4;
    let ys = 7.1 - 0.9 * (1.0 - t * t);
    let wire = length(vec2f(y - ys, dz)) - 0.03;
    if (wire * 0.8 < d) { d = wire * 0.8; m = 36.0; }
    let ly = 7.1 - 0.9 * (1.0 - 0.25) - 0.6;
    let lan = sdEll(vec3f(a + 1.7, y - ly, dz), vec3f(0.42, 0.55, 0.42));
    if (lan < d) { d = lan; m = 43.0; }
  }
  return vec2f(d, m);
}

fn pagodaSDF(p: vec3f) -> vec2f {
  var d = sdBox(p - vec3f(0.0, 1.0, 0.0), vec3f(8.3, 1.0, 8.3));
  var m = 30.0;
  let rr = max(abs(p.x), abs(p.z));
  for (var i = 0; i < 5; i++) {
    let y0 = 2.0 + f32(i) * 7.6;
    let w = 5.6 - f32(i) * 0.75;
    let body = sdBox(p - vec3f(0.0, y0 + 2.7, 0.0), vec3f(w, 2.7, w));
    if (body < d) { d = body; m = 30.0; }
    let yr = y0 + 5.6 + 0.45 * (w - rr) + 0.1 * max(rr - w, 0.0) * max(rr - w, 0.0);
    let roof = max(abs(p.y - yr) - 0.3, rr - (w + 2.4)) * 0.7;
    if (roof < d) { d = roof; m = 31.0; }
  }
  let spire = max(length(p.xz) - 0.3, abs(p.y - 42.0) - 4.5);
  if (spire < d) { d = spire; m = 31.0; }
  return vec2f(d, m);
}

fn towerSDF(p: vec3f) -> vec2f {
  let y = max(p.y, 0.0);
  let hw = 8.0 * pow(max(1.0 - y / 128.0, 0.0), 1.6) + 0.9;
  let q = abs(p.xz);
  let fy = abs(fract(y / 9.0) * 2.0 - 1.0);
  var d = length(q - vec2f(hw)) - 0.36;
  d = min(d, length(vec2f(q.x - hw, (q.y - hw * fy) * 0.7)) - 0.13);
  d = min(d, length(vec2f(q.y - hw, (q.x - hw * fy) * 0.7)) - 0.13);
  d = min(d, max(abs(max(q.x, q.y) - hw) - 0.12, abs(y - round(y / 9.0) * 9.0) - 0.12));
  d = max(d * 0.6, p.y - 118.0);
  var m = 34.0;
  let dk = min(sdBox(p - vec3f(0.0, 76.0, 0.0), vec3f(4.3, 2.6, 4.3)) - 0.3, sdBox(p - vec3f(0.0, 100.0, 0.0), vec3f(2.3, 1.3, 2.3)) - 0.2);
  if (dk < d) { d = dk; m = 35.0; }
  let ant = max(length(p.xz) - 0.35, abs(p.y - 125.0) - 8.0);
  if (ant < d) { d = ant; m = 34.0; }
  return vec2f(d, m);
}

fn signGeom(cell: Cell) -> SignG {
  var g: SignG;
  g.ok = false;
  let side = i32(hsh(cell.seed, 1, 40) * 4.0);
  let axisX = side < 2;
  let sgn = select(-1.0, 1.0, (side & 1) == 0);
  let wa = select(cell.w.y, cell.w.x, axisX);
  let wb = select(cell.w.x, cell.w.y, axisX);
  let oa = select(cell.off.y, cell.off.x, axisX);
  let ob = select(cell.off.x, cell.off.y, axisX);
  let wall = oa + sgn * wa;
  let pw = min(1.9, 9.45 - abs(wall));
  var topY = cell.h;
  if (cell.typ == 1 && cell.v < 0.4) { topY = cell.h * 0.6; }
  if (cell.typ == 2 && cell.v >= 0.45 && cell.v < 0.78) { topY = cell.h * 0.75; }
  let y0 = 4.5 + 3.0 * hsh(cell.seed, 2, 41);
  let hs = min(3.5 + 11.0 * hsh(cell.seed, 3, 42), topY - y0 - 1.0);
  if (pw < 0.7 || hs < 2.5) { return g; }
  let tpos = ob + (hsh(cell.seed, 4, 43) - 0.5) * 2.0 * max(wb - 1.2, 0.0);
  let ca = wall + sgn * pw * 0.5;
  g.ok = true;
  g.axisX = axisX;
  g.sgn = sgn;
  g.ctr = select(vec3f(tpos, y0 + hs * 0.5, ca), vec3f(ca, y0 + hs * 0.5, tpos), axisX);
  g.half = select(vec3f(0.11, hs * 0.5, pw * 0.5), vec3f(pw * 0.5, hs * 0.5, 0.11), axisX);
  return g;
}

fn wheelSDF(p: vec3f, seed: i32) -> vec2f {
  let q = p - vec3f(0.0, 10.4, 0.0);
  let rxy = length(q.xy);
  let ang = u.time * 0.05 + f32(seed & 63);
  var d = length(vec2f(rxy - 8.3, abs(q.z) - 0.5)) - 0.14;
  let sec = 2.0 * PI / 16.0;
  let a = atan2(q.y, q.x) - ang;
  let ai = round(a / sec);
  let la = a - ai * sec;
  let spoke = max(abs(rxy * sin(la)) - 0.06, max(abs(abs(q.z) - 0.5) - 0.06, rxy - 8.3));
  d = min(d, spoke * 0.9);
  d = min(d, max(rxy - 0.8, abs(q.z) - 0.8));
  d = min(d, sdSeg(vec3f(abs(p.x), p.y, abs(p.z)), vec3f(5.2, 0.0, 1.5), vec3f(0.4, 10.4, 0.9)) - 0.22);
  var m = 19.0;
  let ca = ai * sec + ang;
  let cab = sdBox(q - vec3f(cos(ca) * 8.3, sin(ca) * 8.3 - 1.05, 0.0), vec3f(0.62, 0.72, 0.6)) - 0.1;
  if (cab < d) { m = 20.0; d = cab; }
  return vec2f(d, m);
}

fn marketSDF(p: vec3f) -> vec2f {
  let row = select(-3.6, 3.6, p.z > 0.0);
  let xi = clamp(round(p.x / 3.1), -2.0, 2.0);
  let q = vec3f(p.x - xi * 3.1, p.y, (p.z - row) * sign(row));
  var d = sdBox(q - vec3f(0.0, 0.5, 0.0), vec3f(1.25, 0.5, 0.55));
  d = min(d, max(length(vec2f(abs(q.x) - 1.3, abs(q.z) - 0.75)) - 0.05, q.y - 2.4));
  var m = 21.0;
  let aw = max(max(abs(q.y - (2.3 + 0.22 * q.z)) - 0.04, abs(q.x) - 1.45), abs(q.z) - 0.95) * 0.95;
  if (aw < d) { m = 22.0; d = aw; }
  let lan = length(vec3f(abs(q.x) - 0.7, q.y - 2.0, q.z + 0.95)) - 0.13;
  if (lan < d) { m = 23.0; d = lan; }
  return vec2f(d, m);
}

// ---------- trees ----------
fn treeParams(id: vec2i, ownTyp: i32, wild: bool) -> array<vec4f, 2> {
  let iw = vec2i(wrapN(id.x, NWI * 4), wrapN(id.y, NWI * 4));
  let mx = ((id.x % 4) + 4) % 4;
  let mz = ((id.y % 4) + 4) % 4;
  let inner = (mx == 1 || mx == 2) && (mz == 1 || mz == 2);
  let pos = (vec2f(id) + 0.5 + (vec2f(hsh(iw.x, iw.y, 56), hsh(iw.x, iw.y, 57)) - 0.5) * 0.35) * TS;
  var R = 0.0;
  var th = 0.0;
  var base = 0.0;
  var sp = 0;
  let h55 = hsh(iw.x, iw.y, 55);
  let h59 = hsh(iw.x, iw.y, 59);
  if (wild) {
    if (ownTyp == 5) {
      let tv = terrAt(pos);
      if (hsh(iw.x, iw.y, 58) < wildTreeDens(tv, pos)) {
        base = tv.x;
        let w = biomeW(tv.z, tv.w);
        let k = hsh(iw.x, iw.y, 62);
        var oasis = false;
        if (w.des > 0.3) { oasis = oasisAt(pos).x < 120.0; }
        if (oasis) { sp = 2; }
        else if (w.des * w.mid > 0.4) { sp = 3; }
        else if (w.mnt > 0.4 || (w.fo > 0.5 && tv.x > 160.0 && k < 0.7)) { sp = 1; }
        else if (w.swp * w.mid > 0.4 && k < 0.5) { sp = 4; }
        else if (w.bad * w.mid > 0.4) { sp = 5; }
        else { sp = select(0, 1, k < 0.25); }
        switch sp {
          case 1: { R = mix(1.8, 2.8, h59); th = 1.2 + h55; }
          case 2: { R = mix(2.6, 3.4, h59); th = 7.0 + 4.0 * h55; }
          case 3: { R = mix(0.35, 0.5, h59); th = 4.0 + 3.0 * h55; }
          case 4: { R = mix(1.5, 2.5, h59); th = 3.0 + 3.0 * h55; }
          case 5: { R = mix(0.9, 1.6, h59); th = 0.3; }
          default: { R = mix(2.3, 4.0, h59); th = 2.2 + 3.0 * h55; }
        }
      }
    }
  } else if (!inner || ownTyp == 5) {
    let dens = smoothstep(0.12, 0.55, forestF(wrapP(pos)));
    // the Assembly Hall avenue is kept open (world.js: the civic axis, cells x 27-28, z -24 to -6)
    let wp = wrapP(pos);
    let avenue = u.reg.w > 0.5 && abs(wp.x - 728.0) < 40.0 && wp.y > -640.0 && wp.y < -140.0;
    if (!avenue && hsh(iw.x, iw.y, 58) < dens * 1.1) {
      R = mix(2.3, 4.0, h59) * (0.72 + 0.28 * dens);
      th = 2.2 + 3.0 * h55 * (0.6 + 0.4 * dens);
    }
  }
  return array<vec4f, 2>(vec4f(pos, R, th), vec4f(mix(0.85, 1.3, hsh(iw.x, iw.y, 60)), base, hsh(iw.x, iw.y, 53), f32(sp) + 0.999 * hsh(iw.x, iw.y, 54)));
}

@compute @workgroup_size(8, 8) fn treeBuild(@builtin(global_invocation_id) gid: vec3u) {
  let slot = vec2i(gid.xy);
  if (slot.x >= TN || slot.y >= TN) { return; }
  let cs = slot / 4;
  let t0 = textureLoad(cellTex, vec2i(cs.x * 3, cs.y), 0);
  if (t0.x > 1.5e7) {
    textureStore(treeOutA, slot, vec4f(1e9, 1e9, 0.0, 0.0));
    return;
  }
  let c = vec2i(i32(round(t0.x)), i32(round(t0.y)));
  let id = c * 4 + (slot % 4);
  let code = i32(round(t0.z));
  let prm = treeParams(id, code & 15, ((code >> 5) & 262144) != 0);
  textureStore(treeOutA, slot, prm[0]);
  textureStore(treeOutB, slot, prm[1]);
}

fn treeQuad(g: vec2i, ownTyp: i32) {
  for (var k = 0; k < 4; k++) {
    let id = g + vec2i(k & 1, k >> 1);
    let slot = vec2i(((id.x % TN) + TN) % TN, ((id.y % TN) + TN) % TN);
    let A = textureLoad(treeTexA, slot, 0);
    if (i32(floor(A.x / TS)) == id.x && i32(floor(A.y / TS)) == id.y) {
      tq[k] = A;
      tq2[k] = textureLoad(treeTexB, slot, 0);
    } else {
      tq[k] = vec4f(0.0);
    }
  }
}

fn treesSDF(p: vec3f, ownTyp: i32) -> vec2f {
  let g = vec2i(floor(p.xz / TS - 0.5));
  if (g.x != tqId.x || g.y != tqId.y) {
    tqId = g;
    treeQuad(g, ownTyp);
  }
  var d = 1e5;
  var dt = 1e5;
  for (var k = 0; k < 4; k++) {
    let t = tq[k];
    if (t.z > 0.0) {
      let t2 = tq2[k];
      let sp = i32(floor(t2.w));
      let ph = t2.z * 6.2831;
      let rel = vec3f(p.x - t.x, p.y - t2.y, p.z - t.y);
      if (sp == 0) {
        let cy = t.w + t.z * 0.85 * t2.x;
        let bound = length(rel - vec3f(0.0, cy + 0.2 * t.z * t2.x, 0.0)) - t.z * (1.25 * max(t2.x, 1.0) + 0.1) - 0.6;
        if (bound > min(d, dt)) { continue; }
        let hf = clamp((rel.y - t.w) / (t.z * 2.0), 0.0, 1.0);
        let wv = vec2f(u.p3, u.p4) * (0.012 * t.z * hf * (0.75 + 0.25 * sin(u.time * 1.7 + ph)));
        let e = rel - vec3f(wv.x, cy, wv.y);
        let crown = (length(e / vec3f(t.z, t.z * 0.82 * t2.x, t.z)) - 1.0) * t.z * 0.82 * min(1.0, t2.x);
        let crown2 = length(e - vec3f(t.z * 0.25, t.z * 0.55 * t2.x, -t.z * 0.15)) - t.z * 0.62;
        let crown3 = length(e - vec3f(-t.z * 0.35, t.z * 0.2 * t2.x, t.z * 0.3)) - t.z * 0.55;
        let lump = sin(e.x * 1.6 + ph) * sin(e.y * 1.9) * sin(e.z * 1.7 - ph) * 0.22;
        var cd = (smin(smin(crown, crown2, t.z * 0.45), crown3, t.z * 0.4) + lump) * 0.8;
        // near the camera and near the crown's skin, break the outline into clumps of leaves
        if (cd < 1.6 && length(p - u.camPos) < 140.0) {
          let n1 = vn3(e * 0.8 + vec3f(ph), 311).x;
          let n2 = vn3(e * 2.4 + vec3f(ph), 312).x;
          cd = (cd + (n1 - 0.5) * 1.0 + (n2 - 0.5) * 0.45) * 0.72;
        }
        d = min(d, cd);
        dt = min(dt, max(length(rel.xz) - (0.22 + 0.06 * t.z), rel.y - t.w - 0.45 * t.z));
        continue;
      }
      // other species share a cylinder bound
      let topY = t.w + t.z * 3.6 + select(0.0, 1.5, sp == 2);
      let rr = length(rel.xz);
      let bnd = length(vec2f(max(rr - t.z - select(0.6, 3.8, sp == 2), 0.0), max(max(-rel.y, rel.y - topY), 0.0)));
      if (bnd > min(d, dt)) { continue; }
      switch sp {
        case 1: {
          // jellyfish tree: a curving stem under a scalloped umbrella, tendrils hanging from its rim and swaying
          let lean = vec2f(cos(ph), sin(ph)) * t.z * 0.45;
          let topC = vec3f(lean.x, t.w + t.z * 1.6, lean.y);
          let midC = vec3f(lean.x * 0.25, (t.w + t.z * 1.6) * 0.55, lean.y * 0.25);
          dt = min(dt, min(sdSeg(rel, vec3f(0.0), midC), sdSeg(rel, midC, topC)) - 0.2 - 0.06 * t.z);
          let q = rel - topC;
          let ang = atan2(q.z, q.x);
          let R0 = t.z * (1.05 + 0.1 * sin(ang * 8.0 + ph));
          let dome = max(abs(length(q) - R0) - 0.1, -(q.y + 0.3 * t.z));
          d = min(d, dome * 0.8);
          let sec = 6.2831853 / 9.0;
          let a2 = (floor(ang / sec) + 0.5) * sec;
          let rq = vec2f(cos(a2) * q.x + sin(a2) * q.z, -sin(a2) * q.x + cos(a2) * q.z);
          let yy = clamp(q.y + 0.3 * t.z, -1.7 * t.z, 0.0);
          let sway = 0.25 * sin(u.time * 0.8 + ph + yy * 1.3) * (-yy / t.z);
          let ten = length(vec3f(rq.x - R0 * 0.92 - sway, q.y + 0.3 * t.z - yy, rq.y)) - 0.05;
          d = min(d, ten);
        }
        case 2: {
          // palm-like: a trunk that bends in two stages, fronds that arch up and then droop
          let lean = vec2f(cos(ph), sin(ph)) * 1.6;
          let mid = vec3f(lean.x * 0.2, t.w * 0.5, lean.y * 0.2);
          let top = vec3f(lean.x, t.w, lean.y);
          dt = min(dt, min(sdSeg(rel, vec3f(0.0), mid) - 0.28, sdSeg(rel, mid, top) - 0.22));
          let q = rel - top;
          for (var j = 0; j < 7; j++) {
            let a = ph + f32(j) * 0.8976;
            let fo = vec3f(cos(a), 0.0, sin(a));
            let m1 = fo * 1.6 + vec3f(0.0, 0.7, 0.0);
            let m2 = fo * 3.1 - vec3f(0.0, 0.9, 0.0);
            d = min(d, min(sdSeg(q, vec3f(0.0, 0.2, 0.0), m1) - 0.26, sdSeg(q, m1, m2) - 0.16));
          }
        }
        case 3: {
          // glow stalks: a cluster of curving, tapering stalks, each ending in a luminous bulb
          for (var j = 0; j < 5; j++) {
            let a = ph + f32(j) * 1.2566;
            let fj = fract(f32(j) * 0.618 + t2.z);
            let L = vec3f(cos(a), 0.0, sin(a)) * (0.25 + 0.55 * fj);
            let h = t.w * (0.55 + 0.45 * fract(f32(j) * 0.37 + t2.z * 3.0));
            let m = L * 0.3 + vec3f(0.0, h * 0.55, 0.0);
            let tp = L + vec3f(0.0, h, 0.0);
            dt = min(dt, min(sdSeg(rel, vec3f(0.0), m) - t.z * 0.45, sdSeg(rel, m, tp) - t.z * 0.3));
            d = min(d, length(rel - tp - vec3f(0.0, t.z * 0.6, 0.0)) - t.z * (0.8 + 0.4 * fj));
          }
        }
        case 4: {
          // dead tree: bare trunk and branches
          let tt = vec3f(0.0, t.w, 0.0);
          var b = sdSeg(rel, vec3f(0.0), tt + vec3f(0.0, t.z, 0.0)) - 0.26;
          for (var j = 0; j < 3; j++) {
            let a = ph + f32(j) * 2.1;
            b = min(b, sdSeg(rel, tt * (0.6 + 0.15 * f32(j)), tt * (0.6 + 0.15 * f32(j)) + vec3f(cos(a), 0.9, sin(a)) * t.z) - 0.1);
          }
          dt = min(dt, b);
        }
        default: {
          // shrub
          d = min(d, (length((rel - vec3f(0.0, t.z * 0.55, 0.0)) / vec3f(1.0, 0.7, 1.0)) - t.z) * 0.7 + sin(rel.x * 3.0 + ph) * sin(rel.z * 3.0) * 0.08);
        }
      }
    }
  }
  if (dt < d) { return vec2f(dt, 5.0); }
  return vec2f(d, 4.0);
}

fn treeBk(p: vec3f) -> vec4f {
  var best = 1e9;
  var r = vec4f(1.0, 0.0, 0.5, 0.0);
  for (var k = 0; k < 4; k++) {
    let t = tq[k];
    if (t.z > 0.0) {
      let dd = length(vec3f(p.x - t.x, p.y - t.w - t.z * 0.85 * tq2[k].x, p.z - t.y)) - t.z;
      if (dd < best) { best = dd; r = tq2[k]; }
    }
  }
  return r;
}

// ---------- cell SDF ----------
fn cellSDF(p: vec3f, c: vec2i, cell: Cell) -> vec2f {
  let lq = p.xz - (vec2f(c) + 0.5) * CS;
  let lp = vec3f(lq.x - cell.off.x, p.y, lq.y - cell.off.y);
  var r = vec2f(1e5, -1.0);
  switch cell.typ {
    case 1: { r = modern(lp, cell); }
    case 2: { r = historic(lp, cell); }
    case 3: {
      var d = cluster(lp, cell.h, 3.4 + 2.0 * cell.s, 3 + i32(cell.v * 2.99), 2.0, 0.16, min(cell.h * 0.6, 18.0), cell.seed, (cell.v - 0.5) * 0.02, false);
      d = smin(d, (length(lp / vec3f(7.5, 4.0, 7.5)) - 1.0) * 4.0, 3.0);
      r = vec2f(d, 3.0);
    }
    case 4: { r = ruin(lp, cell); }
    case 8: { r = organic(lp, cell); }
    case 9: { r = industrialSDF(vec3f(lq.x, p.y, lq.y), cell); }
    case 10: { r = spaceportSDF(vec3f(lq.x, p.y, lq.y), cell); }
    case 11: { r = select(towerSDF(vec3f(lq.x, p.y, lq.y)), pagodaSDF(vec3f(lq.x, p.y, lq.y)), (cell.fl & 3) == 1); }
    case 13: { r = pyramidSDF(vec3f(lq.x, p.y, lq.y), cell.h); }
    case 14: {
      let eg = cell.egg & 63;
      if (eg == 12) {
        r = vec2f(signSDF(vec3f(lq.x, p.y - cell.h, lq.y), i32(floor(fract(cell.v * 2.0) * 8.0 + 0.01)), cell.v >= 0.5), 46.0);
      } else {
        r = vec2f(eggSDF(eg, vec3f(lq.x, p.y - cell.h, lq.y), cell.seed), 45.0);
      }
    }
    case 0: {
      let eg0 = cell.egg & 63;
      if ((cell.fl & 8) != 0) { r = wheelSDF(vec3f(lq.x, p.y, lq.y), cell.seed); }
      else if ((cell.fl & 16) != 0) { r = marketSDF(vec3f(lq.x, p.y, lq.y)); }
      else if (eg0 == 24 || eg0 == 25) { r = vec2f(eggSDF(eg0, vec3f(lq.x, p.y, lq.y), cell.seed), 45.0); }
      else if ((cell.fl & 32) == 0 && ((cell.fl >> 15) & 7) == 7) { r = vec2f(cluster(lp, cell.h, 1.3, 3, 1.0, 0.15, cell.h * 0.6, cell.seed, 0.0, false), 3.0); }
      if (eg0 == 26) { let dk = eggSDF(26, vec3f(lq.x, p.y, lq.y), cell.seed); if (dk < r.x) { r = vec2f(dk, 45.0); } }
    }
    default: {}
  }
  let eggC = cell.egg & 63;
  if (cell.typ == 1 && eggC >= 21 && eggC <= 23) {
    let roofY = cell.h * select(1.0, 1.06, cell.v < 0.4);
    var eq = vec3f(lp.x, p.y - roofY, lp.z);
    if (eggC == 21) { eq = vec3f(lp.x - (cell.w.x * select(1.0, 0.74, cell.v < 0.4) - 0.45), p.y - roofY, lp.z); }
    let de = eggSDF(eggC, eq, cell.seed);
    if (de < r.x) { r = vec2f(de, 45.0); }
  }
  if ((cell.egg >> 6) != 0) {
    let ln = lanternSDF(lq, p.y, cell.egg >> 6);
    if (ln.x < r.x) { r = ln; }
  }
  if ((cell.fl & 64) != 0 && cell.typ == 1) {
    let gg = garageGeom(cell);
    let k = (gg.x - select(lq.y, lq.x, gg.z > 0.5)) * gg.y;
    let l = select(lq.x, lq.y, gg.z > 0.5) - gg.w;
    let rb = sdBox(vec3f(l, p.y - 1.45, k - 2.55), vec3f(2.6, 1.95, 2.95));
    r.x = max(r.x, -rb);
    // the lift car stays inside the recess, so skip it when the recess is farther than what we have
    if (rb < r.x) {
      let gc = garageCar(vec3f(l, p.y, k), cell.seed);
      if (gc < r.x) { r = vec2f(gc, 26.0); }
    }
  }
  if ((cell.fl & 128) != 0) {
    let eg = escGeom(cell);
    if (eg.ok) {
      let et = sdSeg(vec3f(lq.x, p.y, lq.y), eg.a, eg.b) - 0.85;
      if (et < r.x) { r = vec2f(et, 25.0); }
    }
  }
  if ((cell.fl & 30720) != 0) {
    let wk = walkSDF(vec3f(lq.x, p.y, lq.y), c, cell.fl);
    if (wk < r.x) { r = vec2f(wk, 32.0); }
  }
  if (isCityTyp(cell.typ) && p.y < 5.8) {
    let cq2 = abs(lq) - vec2f(9.45);
    if (max(abs(cq2.x), abs(cq2.y)) - 0.2 < r.x) {
      let sg = min(max(length(cq2) - 0.09, p.y - 5.4), sdBox(vec3f(cq2.x, p.y - 4.55, cq2.y), vec3f(0.15, 0.5, 0.15)) - 0.03);
      if (sg < r.x) { r = vec2f(sg, 27.0); }
    }
  }
  if (cell.roof == 1) {
    var base = 0.0;
    var ch = cell.h * 1.1 + 6.0;
    if (cell.typ == 1) {
      base = cell.h * select(1.0, 1.06, cell.v < 0.4) - 2.0;
      ch = 5.0 + 0.12 * cell.h;
    }
    let cr = cluster(lp - vec3f(0.0, base, 0.0), ch, 1.7, 3, 1.2, 0.1, ch * 0.6, cell.seed + 5, 0.01, false);
    if (cr < r.x) { r = vec2f(cr, 3.0); }
  }
  if ((cell.fl & 1) != 0) {
    let g = signGeom(cell);
    if (g.ok) {
      let sd = sdBox(vec3f(lq.x, p.y, lq.y) - g.ctr, g.half) - 0.03;
      if (sd < r.x) { r = vec2f(sd, 16.0); }
    }
  }
  if ((cell.fl & 2) != 0) {
    let pp = lp - vec3f(0.0, cell.h * select(1.0, 1.06, cell.v < 0.4), 0.0);
    let pin = smin(smin(length(pp - vec3f(0.0, 2.3, 0.0)) - 2.0, max(length(pp.xz) - 0.8, abs(pp.y - 4.3) - 1.1), 0.9), length(pp - vec3f(0.0, 5.7, 0.0)) - 1.05, 0.7);
    if (pin < r.x) { r = vec2f(pin, 18.0); }
  }
  if (cell.treeTop > 0.0) {
    let t = treesSDF(p, cell.typ);
    if (t.x < r.x) { r = t; }
  }
  if (!gNoDyn) {
    if (p.y < 2.5) {
      let cq = carsQ(p);
      if (cq.d < r.x) { r = vec2f(cq.d, 12.0); }
    }
    if (p.y < 4.7) {
      let pq = pedQ(p);
      if (pq.x < r.x) { r = vec2f(pq.x, 24.0); }
    }
    if (p.y > AIR_Y - 4.8 && p.y < AIR_Y + 10.8) {
      let aq = airQ(p);
      if (aq.x < r.x) { r = vec2f(aq.x, 14.0); }
    }
    if (p.y > CHASE_Y - 5.5 && p.y < CHASE_Y + 16.5) {
      let hq = chaseQ(p);
      if (hq.x < r.x) { r = vec2f(hq.x, 28.0); }
    }
    if (p.y > DRONE_Y - 2.5 && p.y < DRONE_Y + 9.0) {
      let dq = droneQ(p);
      if (dq.x < r.x) { r = vec2f(dq.x, 17.0); }
    }
  }
  return r;
}

// ---------- giants ----------
// The Assembly Hall: a stone drum ringed with tall arches, a shallow ribbed glass dome 140 m across, a crown ring
// and a needle spire rising to 96 m
// ---------- the Hive ----------
// The cattle-class pod block (HIVE_C in world.js): a patched, hulking castle 620 x 420 m and 240 m tall on the dorms'
// outer edge. Plinth, body, upper storey, four crenellated corner towers, an off-centre keep, annexes bolted on
// wherever there was room, exhaust stacks, and the boards facing the nicer city (north and west). Local metres.
fn isHive(b: vec2i) -> bool {
  let bw = vec2i(wrapN(b.x, 96), wrapN(b.y, 96));
  return u.reg.w > 0.5 && bw.x >= 2 && bw.x <= 4 && bw.y >= 5 && bw.y <= 6;
}
// the boards: centre (u, y) and half size (w, h) in their wall's own axes
fn hiveBoardC(i: i32) -> vec4f {
  switch i {
    case 0: { return vec4f(-150.0, 125.0, 55.0, 42.0); }
    case 1: { return vec4f(20.0, 150.0, 65.0, 30.0); }
    case 2: { return vec4f(150.0, 115.0, 45.0, 50.0); }
    case 3: { return vec4f(-50.0, 120.0, 55.0, 45.0); }
    default: { return vec4f(65.0, 150.0, 40.0, 30.0); }
  }
}
// the nearest board as (distance, u, v in metres from its centre, index)
fn hiveBoard(q: vec3f) -> vec4f {
  var best = vec4f(1e5, 0.0, 0.0, 0.0);
  for (var i = 0; i < 5; i++) {
    let c = hiveBoardC(i);
    // 0-2 on the north face (z = -171), 3-4 on the west face (x = -271)
    var l = vec3f(q.x - c.x, q.y - c.y, q.z + 171.5);
    if (i >= 3) { l = vec3f(q.z - c.x, q.y - c.y, q.x + 271.5); }
    let d = sdBox(l, vec3f(c.z, c.w, 1.0));
    // u runs left to right for someone facing the board (the north face is seen looking south)
    if (d < best.x) { best = vec4f(d, select(1.0, -1.0, i < 3) * l.x, l.y, f32(i)); }
  }
  return best;
}
fn hiveSDF(q: vec3f) -> vec2f {
  var d = sdBox(q - vec3f(0.0, 30.0, 0.0), vec3f(300.0, 30.0, 196.0));
  d = min(d, sdBox(q - vec3f(0.0, 125.0, 0.0), vec3f(270.0, 65.0, 170.0)));
  d = min(d, sdBox(q - vec3f(-20.0, 200.0, -5.0), vec3f(200.0, 12.0, 130.0)));
  let tq = vec3f(abs(q.x) - 255.0, q.y, abs(q.z) - 150.0);
  var tw = sdBox(tq - vec3f(0.0, 120.0, 0.0), vec3f(38.0, 120.0, 38.0));
  tw = max(tw, -max(232.0 - q.y, 4.0 - abs(fract((q.x + q.z) / 16.0) - 0.5) * 16.0));
  d = min(d, tw);
  d = min(d, sdBox(q - vec3f(-40.0, 190.0, 10.0), vec3f(60.0, 50.0, 50.0)));
  for (var i = 0; i < 8; i++) {
    let h1 = hsh(i, 1, 500);
    let h2 = hsh(i, 2, 500);
    let h3 = hsh(i, 3, 500);
    // annexes on the board faces (north, west) stay below the boards
    let low = i % 2 == 0;
    let sz = vec3f(14.0 + 22.0 * h3, select(10.0 + 20.0 * h2, 8.0 + 12.0 * h2, low), 8.0 + 10.0 * h1);
    let y = select(70.0 + 100.0 * h2, 28.0 + 14.0 * h2, low);
    var pos = vec3f((h1 - 0.5) * 460.0, y, -170.0 - sz.z);
    if (i % 4 == 1) { pos = vec3f((h1 - 0.5) * 460.0, y, 170.0 + sz.z); }
    if (i % 4 == 2) { pos = vec3f(-270.0 - sz.z, y, (h1 - 0.5) * 280.0); }
    if (i % 4 == 3) { pos = vec3f(270.0 + sz.z, y, (h1 - 0.5) * 280.0); }
    var bq = q - pos;
    if (i % 4 >= 2) { bq = vec3f(bq.z, bq.y, bq.x); }
    d = min(d, sdBox(bq, sz));
  }
  for (var i = 0; i < 3; i++) {
    let sx = -150.0 + f32(i) * 120.0 + 20.0 * hsh(i, 5, 500);
    d = min(d, sdCyl(q - vec3f(sx, 0.0, 40.0 * (hsh(i, 6, 500) - 0.5)), 7.0, 190.0, 272.0));
  }
  let bd = hiveBoard(q).x;
  if (bd < d) { return vec2f(bd, 56.0); }
  return vec2f(d, 55.0);
}

// ---------- advertosplats ----------
// Projected advertising: camera-facing images hung in the air over the Hive and the neon strip, with scanlines,
// flicker and a faint beam down to the projector. 0 a spinning toke coin, 1 a grinning headset face, 2 slogans.
fn holoFx(ro: vec3f, rd: vec3f, tEnd: f32, colIn: vec3f) -> vec3f {
  var col = colIn;
  for (var i = 0; i < 6; i++) {
    var c = vec4f(728.0, 330.0, 1010.0, 90.0);
    var kind = 0;
    var hue = vec3f(1.0, 0.75, 0.2);
    if (i == 1) { c = vec4f(400.0, 170.0, 1250.0, 60.0); kind = 1; hue = vec3f(0.3, 0.95, 1.0); }
    if (i == 2) { c = vec4f(-520.0, 62.0, 40.0, 24.0); kind = 2; hue = vec3f(1.0, 0.3, 0.8); }
    if (i == 3) { c = vec4f(620.0, 58.0, 40.0, 20.0); kind = 0; hue = vec3f(1.0, 0.8, 0.3); }
    if (i == 4) { c = vec4f(420.0, 95.0, 620.0, 34.0); kind = 2; hue = vec3f(0.5, 0.8, 1.0); }
    // the government's Earth, turning over the financial core, GO HOME TO EARTH beneath it
    if (i == 5) { c = vec4f(40.0, 440.0, -60.0, 80.0); kind = 3; hue = vec3f(0.4, 0.7, 1.0); }
    let cen = c.xyz;
    let nh = vec3f(ro.x - cen.x, 0.0, ro.z - cen.z);
    let ln = length(nh);
    if (ln < 1.0) { continue; }
    let n = nh / ln;
    let dn = dot(rd, n);
    if (abs(dn) < 1e-4) { continue; }
    let t = dot(cen - ro, n) / dn;
    if (t <= 0.0 || t > tEnd) { continue; }
    let hp = ro + rd * t;
    let rt = vec3f(n.z, 0.0, -n.x);
    let uv = vec2f(dot(hp - cen, rt), hp.y - cen.y) / c.w;
    // the beam from the projector on the ground
    let bd = length((ro + rd * max(dot(vec3f(cen.x, 0.0, cen.z) - ro, rd), 0.0)).xz - cen.xz);
    col += hue * 0.012 * exp(-bd * bd / (c.w * 0.4)) * (0.4 + u.windows);
    if (abs(uv.x) > 1.2 || uv.y > 1.2 || uv.y < select(-1.2, -1.9, kind == 3)) { continue; }
    var a = 0.0;
    var hc = hue;
    if (kind == 0) {
      let w = cos(u.time * 1.3 + f32(i));
      let cu = vec2f(uv.x / max(abs(w), 0.06), uv.y);
      let r = length(cu);
      a = step(r, 1.0) * (0.35 + 0.65 * step(0.82, r));
      // the T of TOKE on its face
      let g = glyphBit(15u, i32(floor((cu.x * sign(w) + 0.5) * 5.0)), i32(floor((0.6 - cu.y) * 5.8)));
      a = max(a, g);
    } else if (kind == 1) {
      let r = length(uv);
      a = step(abs(r - 0.95), 0.05);
      a = max(a, step(abs(uv.y - 0.15), 0.16) * step(abs(uv.x), 0.8));
      let sm = length(uv - vec2f(0.0, 0.1));
      a = max(a, step(abs(sm - 0.55), 0.05) * step(uv.y, -0.2) * (0.6 + 0.4 * sin(u.time * 2.0)));
    } else if (kind == 2) {
      let slot = i32(floor(u.time / 5.0)) + i;
      // over the strip, the emigration campaign; over the dorms, the tokes trade and sign-off work
      var pk = 7 + ((slot % 3) + 3) % 3;
      if (i == 4) { pk = array<i32, 4>(4, 5, 10, 6)[((slot % 4) + 4) % 4]; }
      let l = ((slot / 3) % 3 + 3) % 3;
      let L = posterLine(pk, l);
      a = lineText(L, vec2f(uv.x * 22.0, (0.5 - uv.y) * 11.0));
    } else {
      // a globe: oceans and continents on a turning sphere, a lit limb, then two lines of text below
      let r = length(uv);
      if (r < 1.0) {
        let z = sqrt(1.0 - r * r);
        let lon = atan2(uv.x, z) + u.time * 0.12;
        let lat = asin(clamp(uv.y, -1.0, 1.0));
        let land = step(0.56, vnoise(vec2f(lon * 1.6, lat * 2.2), 572));
        hc = mix(vec3f(0.04, 0.2, 1.0), vec3f(0.25, 0.9, 0.3), land);
        a = 0.35 + 0.45 * z + 0.6 * step(r, 1.0) * step(0.93, r);
      } else if (uv.y < -1.05) {
        let l = select(0, 1, uv.y < -1.45);
        a = lineText(posterLine(9, l), vec2f(uv.x * 26.0, (-1.08 - uv.y - f32(l) * 0.4) * 22.0));
        hc = vec3f(1.0, 0.97, 0.9);
      }
    }
    let scan = 0.55 + 0.45 * step(0.45, fract(uv.y * 28.0 - u.time * 2.0));
    let flick = 0.8 + 0.2 * sin(u.time * 31.0 + f32(i) * 7.0);
    let fade = exp(-t * u.fogDen * 0.4);
    // the globe covers what is behind it, so its blue reads against the orange sky
    if (kind == 3 && length(uv) < 1.0) { col = mix(col, hc * (0.7 + 0.6 * u.windows) * scan, min(a, 1.0) * 0.8 * fade); continue; }
    col += hc * a * scan * flick * 0.9 * fade * (0.5 + u.windows);
  }
  return col;
}

// ---------- the pod fab ----------
// Where the Hive's capsule homes are made: two long sawtooth-roofed sheds, a yard of finished pods stacked three
// high, two cooling towers, and in the middle a tapering 100 m tower carrying the receiver cup that catches the beam
// from the orbital power station. Block-local metres. Parts: 57 metal, 58 receiver (glowing), 59 concrete, 63 pods.
fn fabSDF(q: vec3f) -> vec2f {
  // sheds at x = +-70, 30 m wide, 160 m long, 16 m walls under a sawtooth roof
  let sq = vec3f(abs(q.x) - 70.0, q.y, q.z);
  let saw = 16.0 + 5.0 * fract(q.z / 12.0);
  var r = vec2f(max(sdBox(sq - vec3f(0.0, 11.0, 0.0), vec3f(15.0, 11.0, 80.0)), q.y - saw) * 0.8, 57.0);
  // the pod yard: capsules 2.4 x 2.4 x 4.4 m in rows, three high
  let yb = sdBox(q - vec3f(0.0, 3.6, -75.0), vec3f(40.0, 3.6, 13.0));
  if (yb < r.x + 2.0) {
    let pc = vec3f(q.x - 3.0 * round(q.x / 3.0), q.y - 1.2 - 2.4 * clamp(round((q.y - 1.2) / 2.4), 0.0, 2.0), q.z + 75.0 - 5.2 * clamp(round((q.z + 75.0) / 5.2), -2.0, 2.0));
    let pod = max(sdBox(pc, vec3f(1.15, 1.12, 2.1)) - 0.25, yb);
    if (pod < r.x) { r = vec2f(pod, 63.0); }
  }
  // cooling towers: hyperbolic shells, open at the top
  let ct = vec3f(abs(q.x) - 36.0, q.y, q.z - 70.0);
  let cr = 11.0 + 0.0035 * (q.y - 38.0) * (q.y - 38.0);
  let cool = max(abs(length(ct.xz) - cr) - 0.9, max(-q.y, q.y - 56.0)) * 0.8;
  if (cool < r.x) { r = vec2f(cool, 59.0); }
  // the receiver tower: tapering, cross-braced faces, and the cup at the top turned to face the beam
  let w = 8.0 - 4.5 * clamp(q.y / 96.0, 0.0, 1.0);
  let tw = max(max(abs(q.x), abs(q.z)) - w, max(-q.y, q.y - 96.0)) * 0.7;
  if (tw < r.x) { r = vec2f(tw, 57.0); }
  let cq = q - vec3f(0.0, 104.0, 0.0);
  let al = dot(cq, BEAM_B);
  let rr = length(cq - BEAM_B * al);
  let cup = max(abs(al - rr * rr / 55.0 + 1.5) - 0.7, rr - 17.0) * 0.6;
  if (cup < r.x) { r = vec2f(cup, 57.0); }
  let core = length(cq - BEAM_B * 5.5) - 2.6;
  if (core < r.x) { r = vec2f(core, 58.0); }
  return r;
}

// The power beam: from the station in orbit down through the cloud deck to the receiver cup, day and night. A white
// core, a violet halo where the haze scatters it, pulses of energy running down it, a lit patch where it pierces the
// cloud deck (1.5 km up), and the station itself, a hard glint where the beam meets the sky.
fn beamFx(ro: vec3f, rd: vec3f, tEnd: f32, colIn: vec3f) -> vec3f {
  var col = colIn;
  if (u.reg.w < 0.5) { return col; }
  // the fab nearest the camera (the city repeats every 96 big blocks)
  let per = 96.0 * BIG;
  let R0 = vec3f(FAB_W.x + per * round((ro.x - FAB_W.x) / per), 104.0, FAB_W.y + per * round((ro.z - FAB_W.y) / per)) + BEAM_B * 5.5;
  let B = BEAM_B;
  let w0 = ro - R0;
  let b = dot(rd, B);
  let den = max(1.0 - b * b, 1e-5);
  var t = clamp((b * dot(B, w0) - dot(rd, w0)) / den, 0.0, tEnd);
  let sB = max(dot(ro + rd * t - R0, B), 0.0);
  t = clamp(dot(R0 + B * sB - ro, rd), 0.0, tEnd);
  let dist = length(ro + rd * t - (R0 + B * sB));
  let pulse = 0.75 + 0.25 * sin((sB + u.time * 700.0) / 45.0);
  let fade = exp(-t * u.fogDen * 0.25);
  let core = exp(-dist * dist / 3.0) * 3.0 + exp(-dist * dist / 40.0) * 0.8;
  let halo = exp(-dist / 30.0) * (0.12 + 3.0 * u.fogDen);
  col += (vec3f(1.0, 0.95, 1.0) * core * pulse + vec3f(0.62, 0.5, 1.0) * halo) * fade;
  // where it pierces the cloud deck: the underside of the cloud lit for a few hundred metres round
  let H = 1500.0;
  if (rd.y > 0.0 && ro.y < H) {
    let tc = (H - ro.y) / rd.y;
    if (tc < tEnd) {
      let pc = R0 + B * ((H - R0.y) / B.y);
      let dd = length((ro + rd * tc).xz - pc.xz);
      col += vec3f(0.75, 0.65, 1.0) * (exp(-dd / 180.0) * 0.5 + exp(-dd / 40.0) * 0.8) * exp(-tc * u.fogDen * 0.15);
    }
  }
  // the station: where the beam meets the sky
  if (tEnd >= FARMAX * 0.99) {
    let g = dot(rd, B);
    col += vec3f(1.0, 0.95, 0.9) * (smoothstep(0.99996, 0.99999, g) * 6.0 + pow(max(g, 0.0), 4000.0) * 1.5);
  }
  return col;
}

fn hallSDF(lp: vec3f) -> vec2f {
  let r = length(lp.xz);
  let ang = atan2(lp.z, lp.x);
  var base = max(max(abs(r - 66.0) - 3.0, lp.y - 14.0), -lp.y);
  let sec = 6.2831853 / 24.0;
  let a2 = (fract(ang / sec) - 0.5) * sec * r;
  let arch = max(abs(a2) - 4.5, lp.y - 8.0 - sqrt(max(20.25 - a2 * a2, 0.0)));
  base = max(base, -arch);
  // a broad plinth of steps
  // a ring of steps around the outside of the drum; inside, a level floor
  base = min(base, max(max(r - 76.0 + floor(lp.y / 0.9) * 2.5, 69.0 - r), max(lp.y - 2.7, -lp.y)));
  // inside: an amphitheatre of six tiers of seats split by aisles, and a rostrum with a lectern at the centre
  let tier = clamp(floor((r - 18.0) / 7.0), 0.0, 5.0);
  var seats = max(max(lp.y - 0.5 * (tier + 1.0), -lp.y), max(18.0 - r, r - 60.0));
  let aisle = abs(fract(ang / 0.7854) - 0.5) * 0.7854 * r;
  seats = max(seats, 1.4 - aisle);
  base = min(base, seats);
  let rostrum = max(length(lp.xz) - 4.0, max(lp.y - 1.1, -lp.y));
  let lectern = sdBox(lp - vec3f(-2.2, 1.7, 0.0), vec3f(0.35, 0.6, 0.5));
  var brass = min(rostrum, lectern);
  let e = lp - vec3f(0.0, 14.0, 0.0);
  let dome = max((length(e / vec3f(70.0, 44.0, 70.0)) - 1.0) * 44.0, -e.y);
  let shell = max(dome, -(dome + 1.2));
  let spire = sdSeg(lp, vec3f(0.0, 55.0, 0.0), vec3f(0.0, 96.0, 0.0)) - mix(1.8, 0.15, clamp((lp.y - 55.0) / 41.0, 0.0, 1.0));
  let crown = length(vec2f(length(e.xz) - 10.0, e.y - 43.0)) - 1.6;
  var d = vec2f(base, 8.0);
  if (shell < d.x) { d = vec2f(shell, 60.0); }
  let sc = min(min(spire, crown), brass);
  if (sc < d.x) { d = vec2f(sc, 61.0); }
  return d;
}
// where a megatower's advertising screens hang: returns distance, and the screen's own coordinates (-1..1)
fn adScreenUV(lp: vec3f, gh: f32, s1: f32, s2: f32) -> vec4f {
  var best = vec4f(1e5, 0.0, 0.0, 0.0);
  for (var i = 0; i < 2; i++) {
    if (i == 1 && s2 > 0.33) { break; }
    let ang = s1 * 6.2832 + f32(i) * 3.14159;
    let ca = cos(ang);
    let sa = sin(ang);
    let lx = ca * lp.x + sa * lp.z;
    let lz = -sa * lp.x + ca * lp.z;
    let yc = gh * (0.38 + 0.1 * f32(i));
    let q = vec3f(lx - 19.0, lp.y - yc, lz);
    let dd = sdBox(q, vec3f(0.6, 20.0, 14.0));
    if (dd < best.x) { best = vec4f(dd, lz / 14.0, q.y / 20.0, f32(i)); }
  }
  return best;
}
fn adScreen(lp: vec3f, gh: f32, s1: f32, s2: f32) -> vec2f { return vec2f(adScreenUV(lp, gh, s1, s2).x, 0.0); }
// world point to Hive-local metres (the Hive spans several blocks, so go through the wrapped block)
fn hiveQ(p: vec3f) -> vec3f {
  let b = vec2i(floor(p.xz / BIG));
  let bw = vec2i(wrapN(b.x, 96), wrapN(b.y, 96));
  let hq = p.xz - (vec2f(b) + 0.5) * BIG + (vec2f(bw) + 0.5) * BIG - vec2f(728.0, 1248.0);
  return vec3f(hq.x, p.y, hq.y);
}
fn giantSDF(p: vec3f, b: vec2i) -> vec2f {
  if (isHive(b)) { return hiveSDF(hiveQ(p)); }
  let gl = p.xz - (vec2f(b) + 0.5) * BIG;
  let lp = vec3f(gl.x, p.y, gl.y);
  if (isHall(b)) { return hallSDF(lp); }
  if (isFab(b)) { return fabSDF(lp); }
  let bw = vec2i(wrapN(b.x, 96), wrapN(b.y, 96));
  let gh = 150.0 + 110.0 * hsh(bw.x, bw.y, 21);
  let s1 = hsh(bw.x, bw.y, 22);
  let s2 = hsh(bw.x, bw.y, 23);
  let seed = bw.x * 1301 + bw.y * 7411;
  var d = cluster(lp, gh, 12.0 + 4.0 * s1, 6, 12.0, 0.2 + 0.14 * s2, gh * 0.5, seed, 0.002, true);
  d = smin(d, (length(lp / vec3f(30.0, 12.0, 30.0)) - 1.0) * 12.0, 12.0);
  var m = 6.0;
  // a giant advertising screen hung on the tower (a second on the far side of some)
  let sc = adScreen(lp, gh, s1, s2);
  if (sc.x < d) { d = sc.x; m = 62.0; }
  var q = lp - vec3f(0.0, gh * 0.62, 0.0);
  let rxz = rot2(q.xz, u.time * 0.04 + s1 * 6.0);
  q = vec3f(rxz.x, q.y, rxz.y);
  let rxy = rot2(q.xy, 0.25 + 0.2 * s2);
  q = vec3f(rxy.x, rxy.y, q.z);
  let ringW = 0.7 + 0.0025 * length(u.camPos.xz - (vec2f(b) + 0.5) * BIG);
  let ring = length(vec2f(length(q.xz) - 42.0, q.y)) - ringW;
  // only the spire in the core wears a ring: one landmark seen across the city
  if (!gNoDyn && ring < d && bw.x == 0 && bw.y == -1) { m = 9.0; d = ring; }
  return vec2f(d, m);
}

// ---------- tracing ----------
fn safeDir(v: f32) -> f32 {
  return select(v, select(-1e-6, 1e-6, v >= 0.0), abs(v) < 1e-6);
}

fn clipY(ro: vec3f, rd: vec3f, a0: f32, b0: f32, y0: f32, y1: f32) -> vec2f {
  var a = a0;
  var b = b0;
  if (abs(rd.y) < 1e-5) {
    if (ro.y < y0 || ro.y > y1) { b = -1.0; }
  } else {
    let t0 = (y0 - ro.y) / rd.y;
    let t1 = (y1 - ro.y) / rd.y;
    a = max(a, min(t0, t1));
    b = min(b, max(t0, t1));
  }
  return vec2f(a, b);
}

fn traceSeg(ro: vec3f, rd: vec3f, seg: vec2f, c: vec2i, cell: Cell, maxSteps: i32, sh: ptr<function, f32>, shadowMode: bool) -> vec2f {
  if (seg.x >= seg.y) { return vec2f(0.0, -1.0); }
  var t = seg.x;
  for (var k = 0; k < maxSteps; k++) {
    let h = cellSDF(ro + rd * t, c, cell);
    if (shadowMode) { *sh = min(*sh, 9.0 * h.x / max(t, 0.3)); }
    if (h.x < 0.0012 * t + 0.002) { return vec2f(t, h.y); }
    t += h.x * 0.88;
    if (t > seg.y) { break; }
  }
  return vec2f(0.0, -1.0);
}

fn traceCells(ro: vec3f, rd: vec3f, tStart: f32, tEnd: f32, maxCells: i32, maxSteps: i32, sh: ptr<function, f32>, shadowMode: bool, bands: bool) -> Hit {
  var hit: Hit;
  hit.t = tEnd;
  hit.m = -1.0;
  hit.kind = 0;
  let dx = safeDir(rd.x);
  let dz = safeDir(rd.z);
  let inv = vec2f(1.0 / dx, 1.0 / dz);
  let stp = vec2i(select(-1, 1, dx > 0.0), select(-1, 1, dz > 0.0));
  var c = vec2i(floor((ro.xz + rd.xz * tStart) / CS));
  var tMax = vec2f(
    ((f32(c.x) + select(0.0, 1.0, stp.x > 0)) * CS - ro.x) * inv.x,
    ((f32(c.y) + select(0.0, 1.0, stp.y > 0)) * CS - ro.z) * inv.y);
  let tDelta = abs(inv) * CS;
  var tPrev = tStart;
  for (var i = 0; i < maxCells; i++) {
    let tOut = min(tMax.x, tMax.y);
    let b0 = min(tOut, tEnd);
    let cell = cellHead(c);
    var iv = array<vec2f, 3>(vec2f(1e9, -1e9), vec2f(1e9, -1e9), vec2f(1e9, -1e9));
    let maxTop = max(cell.top, cell.treeTop);
    if (maxTop > 0.0) {
      var s0 = clipY(ro, rd, tPrev, b0, -1.0, maxTop);
      if (cell.treeTop <= 0.0 && s0.x < s0.y && (cell.fl & 30720) == 0 && ((cell.fl >> 15) & 7) != 3 && cell.typ != 14) {
        let cen = (vec2f(c) + 0.5) * CS;
        let t0 = (cen - FOOT - ro.xz) * inv;
        let t1 = (cen + FOOT - ro.xz) * inv;
        let tn = min(t0, t1);
        let tf = max(t0, t1);
        s0 = vec2f(max(s0.x, max(tn.x, tn.y)), min(s0.y, min(tf.x, tf.y)));
      }
      if (s0.x < s0.y) { iv[0] = s0; }
    }
    if (bands && cell.typ != 7) {
      let s1 = clipY(ro, rd, tPrev, b0, -1.0, 2.4);
      if (s1.x < s1.y) { iv[1] = s1; }
    }
    if (bands) {
      let s2 = clipY(ro, rd, tPrev, b0, AIR_Y - 4.5, AIR_Y + 10.5);
      if (s2.x < s2.y) { iv[2] = s2; }
    }
    if (iv[0].x < 1e8 || iv[1].x < 1e8 || iv[2].x < 1e8) {
      if (iv[1].x < iv[0].x) { let tmp = iv[0]; iv[0] = iv[1]; iv[1] = tmp; }
      if (iv[2].x < iv[1].x) { let tmp = iv[1]; iv[1] = iv[2]; iv[2] = tmp; }
      if (iv[1].x < iv[0].x) { let tmp = iv[0]; iv[0] = iv[1]; iv[1] = tmp; }
      let full = cellFull(c);
      var cur = iv[0];
      for (var k = 1; k < 3; k++) {
        if (iv[k].x <= cur.y) {
          cur.y = max(cur.y, iv[k].y);
        } else {
          let r = traceSeg(ro, rd, cur, c, full, maxSteps, sh, shadowMode);
          if (r.y >= 0.0) { hit.t = r.x; hit.m = r.y; hit.kind = 2; hit.c = c; return hit; }
          cur = iv[k];
        }
      }
      let r = traceSeg(ro, rd, cur, c, full, maxSteps, sh, shadowMode);
      if (r.y >= 0.0) { hit.t = r.x; hit.m = r.y; hit.kind = 2; hit.c = c; return hit; }
    }
    tPrev = tOut;
    if (tPrev >= tEnd) { break; }
    if (rd.y > 0.0 && ro.y + rd.y * tPrev > 205.0) { break; }
    if (tMax.x < tMax.y) { tMax.x += tDelta.x; c.x += stp.x; } else { tMax.y += tDelta.y; c.y += stp.y; }
  }
  return hit;
}

fn traceGiants(ro: vec3f, rd: vec3f, tStart: f32, tEnd: f32, maxSteps: i32, sh: ptr<function, f32>, shadowMode: bool) -> Hit {
  var hit: Hit;
  hit.t = tEnd;
  hit.m = -1.0;
  hit.kind = 0;
  let dx = safeDir(rd.x);
  let dz = safeDir(rd.z);
  let inv = vec2f(1.0 / dx, 1.0 / dz);
  let stp = vec2i(select(-1, 1, dx > 0.0), select(-1, 1, dz > 0.0));
  var c = vec2i(floor((ro.xz + rd.xz * tStart) / BIG));
  var tMax = vec2f(
    ((f32(c.x) + select(0.0, 1.0, stp.x > 0)) * BIG - ro.x) * inv.x,
    ((f32(c.y) + select(0.0, 1.0, stp.y > 0)) * BIG - ro.z) * inv.y);
  let tDelta = abs(inv) * BIG;
  let A = dot(rd.xz, rd.xz);
  var tIn = tStart;
  for (var i = 0; i < 12; i++) {
    if (giantHasW(c)) {
      let top = giantTop(c) + 6.0;
      let oc = ro.xz - (vec2f(c) + 0.5) * BIG;
      let B = dot(oc, rd.xz);
      let C0 = dot(oc, oc) - 80.0 * 80.0;
      var a = 0.0;
      var b = -1.0;
      if (A < 1e-8) {
        if (C0 < 0.0) { b = tEnd; }
      } else {
        let disc = B * B - A * C0;
        if (disc > 0.0) {
          let sq = sqrt(disc);
          a = (-B - sq) / A;
          b = (-B + sq) / A;
        }
      }
      if (isHive(c) || isFab(c)) { a = tIn; b = min(tMax.x, tMax.y); }
      a = max(a, tStart);
      b = min(b, tEnd);
      if (rd.y < -1e-5) { a = max(a, (top - ro.y) / rd.y); }
      else if (rd.y > 1e-5) { b = min(b, (top - ro.y) / rd.y); }
      else if (ro.y > top) { b = -1.0; }
      if (a < b) {
        var t = a;
        for (var k = 0; k < maxSteps; k++) {
          let h = giantSDF(ro + rd * t, c);
          if (shadowMode) { *sh = min(*sh, 9.0 * h.x / max(t, 0.5)); }
          if (h.x < 0.0012 * t + 0.003) {
            hit.t = t;
            hit.m = h.y;
            hit.kind = 3;
            hit.c = c;
            return hit;
          }
          t += h.x * 0.9;
          if (t > b) { break; }
        }
      }
    }
    let tp = min(tMax.x, tMax.y);
    tIn = tp;
    if (tp >= tEnd) { break; }
    if (rd.y > 0.0 && ro.y + rd.y * tp > 350.0) { break; }
    if (tMax.x < tMax.y) { tMax.x += tDelta.x; c.x += stp.x; } else { tMax.y += tDelta.y; c.y += stp.y; }
  }
  return hit;
}

fn traceScene(ro: vec3f, rd: vec3f, tmax: f32, cells: i32, steps: i32, gsteps: i32, sh: ptr<function, f32>, shadowMode: bool) -> Hit {
  var tg = 1e9;
  if (rd.y < -1e-5) { tg = -ro.y / rd.y; }
  var tEnd = min(tmax, tg);
  var best: Hit;
  best.t = tEnd;
  best.m = -1.0;
  best.kind = 0;
  let gh = traceGiants(ro, rd, 0.0, tEnd, gsteps, sh, shadowMode);
  if (gh.kind == 3) {
    best = gh;
    tEnd = gh.t;
    if (shadowMode) { return best; }
  }
  let ch = traceCells(ro, rd, 0.0, tEnd, cells, steps, sh, shadowMode, !gNoDyn);
  if (ch.kind == 2) {
    best = ch;
  } else if (best.kind == 0 && tg <= tmax) {
    best.t = tg;
    best.kind = 1;
    best.m = 0.0;
  }
  return best;
}

fn bandSDF(p: vec3f, which: i32) -> vec2f {
  if (which == 1) { return vec2f(airQ(p).x, 14.0); }
  if (which == 2) { return vec2f(droneQ(p).x, 17.0); }
  if (which == 3) { return vec2f(chaseQ(p).x, 28.0); }
  if (which == 4) { return vec2f(carsQ(p).d, 12.0); }
  return vec2f(pedQ(p).x, 24.0);
}

fn traceBand(ro: vec3f, rd: vec3f, seg: vec2f, which: i32) -> vec2f {
  if (seg.x >= seg.y) { return vec2f(0.0, -1.0); }
  var t = seg.x;
  for (var k = 0; k < 44; k++) {
    let h = bandSDF(ro + rd * t, which);
    if (h.x < select(0.0012, 0.0004, which == 0) * t + 0.002) { return vec2f(t, h.y); }
    t += max(h.x, 0.01) * 0.9;
    if (t > seg.y) { break; }
  }
  return vec2f(0.0, -1.0);
}

// Primary rays start at the rasterized proxy distance: no traversal through empty space.
fn ffLoad(c: vec2i, lvl: i32) -> vec4f {
  let n = NWI >> u32(lvl);
  return textureLoad(ffMax, vec2i(((c.x % n) + n) % n, ((c.y % n) + n) % n), lvl);
}

// smallest s in [0, ds] where a ray (height y0, slope dy) meets a bilinear patch h = (h00, h10, h01, h11)
fn patchRoot(y0: f32, dy: f32, u0: f32, w0: f32, du: f32, dw: f32, h: vec4f, ds: f32) -> f32 {
  let B = h.y - h.x;
  let Cc = h.z - h.x;
  let D = h.x - h.y - h.z + h.w;
  let k0 = h.x + B * u0 + Cc * w0 + D * u0 * w0;
  let k1 = B * du + Cc * dw + D * (u0 * dw + w0 * du);
  let a = -D * du * dw;
  let b = dy - k1;
  let c = y0 - k0;
  if (c <= 0.0) { return 0.0; }
  var root = 1e9;
  if (abs(a) < 1e-9) {
    if (b < 0.0) { root = -c / b; }
  } else {
    let disc = b * b - 4.0 * a * c;
    if (disc >= 0.0) {
      let q = -0.5 * (b + select(-sqrt(disc), sqrt(disc), b >= 0.0));
      let r1 = q / a;
      let r2 = select(1e9, c / q, abs(q) > 1e-12);
      let lo = min(r1, r2);
      let hi = max(r1, r2);
      if (lo > 0.0) { root = lo; } else if (hi > 0.0) { root = hi; }
    }
  }
  return select(1e9, root, root <= ds);
}

fn farCell(ro: vec3f, rd: vec3f, t0: f32, t1: f32, c: vec2i, withB: bool) -> f32 {
  let v00 = terrV(c);
  let v10 = terrV(c + vec2i(1, 0));
  let v01 = terrV(c + vec2i(0, 1));
  let v11 = terrV(c + vec2i(1, 1));
  let p0 = ro + rd * t0;
  let u0 = p0.x / CS - f32(c.x);
  let w0 = p0.z / CS - f32(c.y);
  let du = rd.x / CS;
  let dw = rd.z / CS;
  let ds = t1 - t0;
  var s = min(patchRoot(p0.y, rd.y, u0, w0, du, dw, vec4f(v00.x, v10.x, v01.x, v11.x), ds),
              patchRoot(p0.y, rd.y, u0, w0, du, dw, vec4f(v00.y, v10.y, v01.y, v11.y), ds));
  var kind = 1;
  if (withB) {
    let b = textureLoad(ffBTex, wrapT(c), 0);
    if (b.x > 0.5) {
      let cen = (vec2f(c) + 0.5) * CS;
      let inv = 1.0 / vec3f(safeDir(rd.x), safeDir(rd.y), safeDir(rd.z));
      let ta = (vec3f(cen.x - b.y, -2.0, cen.y - b.z) - ro) * inv;
      let tb = (vec3f(cen.x + b.y, b.x, cen.y + b.z) - ro) * inv;
      let tn = min(ta, tb);
      let tf = max(ta, tb);
      let e0 = max(max(tn.x, tn.y), tn.z);
      let e1 = min(min(tf.x, tf.y), tf.z);
      if (e0 <= e1 && e1 > t0 && e0 - t0 < s && e0 <= t1) { s = max(e0 - t0, 0.0); kind = 6; }
    }
  }
  if (s > ds) { return -1.0; }
  gFarKind = kind;
  return t0 + s;
}

// Hierarchical walk over the world's height pyramid. withB adds the distant city blocks.
fn traceFar(ro: vec3f, rd: vec3f, tA: f32, tB: f32, withB: bool) -> FarHit {
  var fh: FarHit;
  fh.t = tB;
  fh.kind = 0;
  fh.lvl = 0;
  if (tA >= tB) { return fh; }
  let dx = safeDir(rd.x);
  let dz = safeDir(rd.z);
  let inv = vec2f(1.0 / dx, 1.0 / dz);
  var t = tA;
  var lvl = 7;
  for (var i = 0; i < 120; i++) {
    if (t >= tB) { break; }
    let p = ro + rd * t;
    if (rd.y >= 0.0 && p.y > GMAX) { break; }
    let sz = CS * f32(1 << u32(lvl));
    let tc = vec2i(floor(p.xz / sz));
    let lo = vec2f(tc) * sz;
    let tx = (select(lo.x, lo.x + sz, dx > 0.0) - ro.x) * inv.x;
    let tz = (select(lo.y, lo.y + sz, dz > 0.0) - ro.z) * inv.y;
    let tExit = min(max(min(tx, tz), t), tB);
    let m = ffLoad(tc, lvl);
    let mh = select(m.x, m.z, withB);
    if (min(p.y, ro.y + rd.y * tExit) > mh + 0.02) {
      t = tExit + 0.01;
      lvl = min(lvl + 1, 7);
      continue;
    }
    if (m.x - m.y < 0.005 && (!withB || m.z <= m.x + 0.005)) {
      // a flat stretch of ground or water: hit its plane directly
      if (rd.y < 0.0) {
        let tp = (m.x - ro.y) / rd.y;
        if (tp <= tExit) {
          fh.t = max(tp, t);
          fh.kind = 1;
          fh.c = vec2i(floor((ro.xz + rd.xz * fh.t) / CS));
          return fh;
        }
      }
      t = tExit + 0.01;
      lvl = min(lvl + 1, 7);
      continue;
    }
    // distant skyline: stop at coarser tiles far away and treat each as a box as tall as its tallest building
    let minL = select(0, i32(clamp(floor(log2(max(t, 1.0) / 1600.0)) + 1.0, 0.0, 3.0)), withB);
    if (lvl > minL) { lvl -= 1; continue; }
    if (lvl > 0) {
      if (m.z > m.x + 0.5) {
        var th = t;
        if (p.y > m.z && rd.y < 0.0) { th = (m.z - ro.y) / rd.y; }
        if (th <= tExit) {
          fh.t = max(th, t);
          fh.kind = 6;
          fh.c = tc;
          fh.lvl = lvl;
          return fh;
        }
        t = tExit + 0.01;
        lvl = min(lvl + 1, 7);
        continue;
      }
      lvl -= 1;
      continue;
    }
    let th = farCell(ro, rd, t, tExit, tc, withB);
    if (th >= 0.0) {
      fh.t = th;
      fh.kind = gFarKind;
      fh.c = tc;
      return fh;
    }
    t = tExit + 0.01;
  }
  return fh;
}

fn tracePrimary(ro: vec3f, rd: vec3f, tProxy: f32) -> Hit {
  var best: Hit;
  best.t = FARMAX;
  best.m = -1.0;
  best.kind = 0;
  // the ground within the near field: flat city streets, or wild terrain and water
  let f1 = traceFar(ro, rd, 0.0, TMAX, false);
  var tEnd = TMAX;
  if (f1.kind > 0) { best.t = f1.t; best.kind = 1; best.m = 0.0; best.c = f1.c; tEnd = f1.t; }
  var dummy = 1.0;
  if (tProxy < tEnd) {
    let gh = traceGiants(ro, rd, tProxy, tEnd, 64, &dummy, false);
    if (gh.kind == 3) { best = gh; tEnd = gh.t; }
    let ch = traceCells(ro, rd, tProxy, tEnd, 110, 44, &dummy, false, false);
    if (ch.kind == 2) { best = ch; tEnd = ch.t; }
  }
  let hd = traceBand(ro, rd, clipY(ro, rd, 0.0, tEnd, DRONE_Y - 1.5, DRONE_Y + 8.5), 2);
  if (hd.y >= 0.0) {
    best.t = hd.x; best.m = hd.y; best.kind = 2; best.c = vec2i(floor((ro.xz + rd.xz * hd.x) / CS));
    tEnd = hd.x;
  }
  let hq = traceBand(ro, rd, clipY(ro, rd, 0.0, tEnd, CHASE_Y - 5.0, CHASE_Y + 16.0), 3);
  if (hq.y >= 0.0) {
    best.t = hq.x; best.m = hq.y; best.kind = 2; best.c = vec2i(floor((ro.xz + rd.xz * hq.x) / CS));
    tEnd = hq.x;
  }
  let ha = traceBand(ro, rd, clipY(ro, rd, 0.0, tEnd, AIR_Y - 4.5, AIR_Y + 10.5), 1);
  if (ha.y >= 0.0) {
    best.t = ha.x; best.m = ha.y; best.kind = 2; best.c = vec2i(floor((ro.xz + rd.xz * ha.x) / CS));
    tEnd = ha.x;
  }
  let tbl = traceBlimp(ro, rd, tEnd);
  if (tbl >= 0.0) { best.t = tbl; best.m = 29.0; best.kind = 4; best.c = vec2i(0); tEnd = tbl; }
  let tbw = traceBubble(ro, rd, tEnd);
  if (tbw.x >= 0.0) { best.t = tbw.x; best.m = tbw.y; best.kind = 8; best.c = vec2i(0); tEnd = tbw.x; }
  let tts = tubeStructTrace(ro, rd, tEnd);
  if (tts.x >= 0.0) { best.t = tts.x; best.m = tts.y; best.kind = 7; best.c = vec2i(floor((ro.xz + rd.xz * tts.x) / CS)); tEnd = tts.x; }
  let tsh = traceShips(ro, rd, tEnd);
  if (tsh.x >= 0.0) { best.t = tsh.x; best.m = 70.0; best.kind = 4; best.c = vec2i(i32(tsh.y) + 1, 0); tEnd = tsh.x; }
  let tbb = traceBalloons(ro, rd, tEnd);
  if (tbb >= 0.0) { best.t = tbb; best.m = 47.0; best.kind = 5; tEnd = tbb; }
  let hv = traceBand(ro, rd, clipY(ro, rd, 0.0, tEnd, TUBE_Y - 4.5, TUBE_Y + 5.0), 4);
  if (hv.y >= 0.0) {
    best.t = hv.x; best.m = hv.y; best.kind = 2; best.c = vec2i(floor((ro.xz + rd.xz * hv.x) / CS));
    tEnd = hv.x;
  }
  // walkers only near the camera: further out they are sub-pixel, and the loosened hit test would turn their
  // walking rings into coloured outlines around the blocks
  let hc = traceBand(ro, rd, clipY(ro, rd, 0.0, min(tEnd, 150.0), -1.0, 4.7), 0);
  if (hc.y >= 0.0) {
    best.t = hc.x; best.m = hc.y; best.kind = 2; best.c = vec2i(floor((ro.xz + rd.xz * hc.x) / CS));
  }
  // beyond the near field: the rest of the city as simple blocks, and the land and sea around it
  if (best.kind == 0) {
    let f2 = traceFar(ro, rd, TMAX, FARMAX, true);
    if (f2.kind > 0) { best.t = f2.t; best.kind = select(1, 6, f2.kind == 6); best.m = select(0.0, 50.0 + f32(f2.lvl), f2.kind == 6); best.c = f2.c; }
  }
  return best;
}

fn terrNormal(p: vec3f) -> vec3f {
  let m0 = ffLoad(vec2i(floor(p.xz / CS)), 0);
  if (m0.x - m0.y < 0.005) { return vec3f(0.0, 1.0, 0.0); }
  let e = 13.0;
  let hx0 = surfH(terrAt(p.xz - vec2f(e, 0.0)));
  let hx1 = surfH(terrAt(p.xz + vec2f(e, 0.0)));
  let hz0 = surfH(terrAt(p.xz - vec2f(0.0, e)));
  let hz1 = surfH(terrAt(p.xz + vec2f(0.0, e)));
  return normalize(vec3f(hx0 - hx1, 2.0 * e, hz0 - hz1));
}

fn sdfFor(p: vec3f, kind: i32, c: vec2i, cell: Cell) -> f32 {
  if (kind == 3) { return giantSDF(p, c).x; }
  if (kind == 4) { if (c.x > 0) { return shipSDF(p, c.x - 1).x; } return blimpSDF(p); }
  if (kind == 7) { return tubeStructSDF(p).x; }
  if (kind == 8) { return bubbleSDF(p).x; }
  return cellSDF(p, c, cell).x;
}

fn hitNormal(p: vec3f, hit: Hit) -> vec3f {
  if (hit.kind == 1) { return terrNormal(p); }
  if (hit.kind == 5) {
    var bi = 0;
    var bd = 1e9;
    for (var i = 0; i < 3; i++) { let dd = length(p - ev.balloon[i].xyz); if (ev.balloon[i].w >= 0.0 && dd < bd) { bd = dd; bi = i; } }
    let q = p - ev.balloon[bi].xyz;
    let e = 0.05;
    return normalize(vec3f(balloonSDF(q + vec3f(e, 0.0, 0.0)) - balloonSDF(q - vec3f(e, 0.0, 0.0)), balloonSDF(q + vec3f(0.0, e, 0.0)) - balloonSDF(q - vec3f(0.0, e, 0.0)), balloonSDF(q + vec3f(0.0, 0.0, e)) - balloonSDF(q - vec3f(0.0, 0.0, e))));
  }
  if (hit.kind == 6 && hit.m > 50.5) {
    let lv = i32(hit.m + 0.5) - 50;
    let sz = CS * f32(1 << u32(lv));
    if (p.y >= ffLoad(hit.c, lv).z - 0.3) { return vec3f(0.0, 1.0, 0.0); }
    let lo = vec2f(hit.c) * sz;
    let dd = vec4f(abs(p.x - lo.x), abs(p.x - lo.x - sz), abs(p.z - lo.y), abs(p.z - lo.y - sz));
    let mn = min(min(dd.x, dd.y), min(dd.z, dd.w));
    if (mn == dd.x) { return vec3f(-1.0, 0.0, 0.0); }
    if (mn == dd.y) { return vec3f(1.0, 0.0, 0.0); }
    if (mn == dd.z) { return vec3f(0.0, 0.0, -1.0); }
    return vec3f(0.0, 0.0, 1.0);
  }
  if (hit.kind == 6) {
    let b = textureLoad(ffBTex, wrapT(hit.c), 0);
    let cen = (vec2f(hit.c) + 0.5) * CS;
    let q = vec3f(p.x - cen.x, p.y - b.x * 0.5, p.z - cen.y) / vec3f(b.y, b.x * 0.5 + 1.0, b.z);
    let aq = abs(q);
    if (aq.y > aq.x && aq.y > aq.z) { return vec3f(0.0, sign(q.y), 0.0); }
    if (aq.x > aq.z) { return vec3f(sign(q.x), 0.0, 0.0); }
    return vec3f(0.0, 0.0, sign(q.z));
  }
  var cell: Cell;
  if (hit.kind == 2) { cell = cellFull(hit.c); }
  let e = max(0.0012 * hit.t, 0.002);
  // tetrahedral gradient in a loop with a runtime bound, so the distance function is compiled once
  var nn = vec3f(0.0);
  let nIt = select(4, 5, u.frame < -1.0);
  for (var i = 0; i < nIt; i++) {
    let k = vec3f(select(-1.0, 1.0, i == 0 || i == 3), select(-1.0, 1.0, i >= 2), select(-1.0, 1.0, i == 1 || i == 3));
    nn += k * sdfFor(p + k * e, hit.kind, hit.c, cell);
  }
  return normalize(nn);
}

fn calcAO(p: vec3f, n: vec3f, hit: Hit) -> f32 {
  var c = hit.c;
  var kind = hit.kind;
  if (kind == 1) {
    c = vec2i(floor(p.xz / CS));
    kind = 2;
  }
  var cell: Cell;
  if (kind == 2) { cell = cellFull(c); }
  var occ = 0.0;
  var w = 1.0;
  let nA = select(3, 4, u.frame < -1.0);
  for (var i = 1; i <= nA; i++) {
    let h = 0.25 + 0.55 * f32(i * i);
    let d = sdfFor(p + n * h, kind, c, cell);
    occ += max(h - d, 0.0) / h * w;
    w *= 0.65;
  }
  return clamp(1.0 - occ * 0.55, 0.0, 1.0);
}

// ---------- look ----------
fn glowColor(p: vec3f) -> vec3f {
  let k = vnoise(p.xz / 500.0, 11);
  return mix(vec3f(0.3, 0.85, 1.0), vec3f(0.72, 0.48, 1.0), smoothstep(0.35, 0.65, k));
}

fn skyCol(rd: vec3f) -> vec3f {
  let sh = max(rd.y, 0.0);
  var col = mix(u.skyHor, u.skyTop, pow(sh, 0.5));
  // Titan's detached haze layer: a bright band hanging just above the horizon
  col += u.skyHor * 0.3 * exp(-abs(rd.y - 0.07) * 28.0) + u.fogCol * 0.15 * exp(-abs(rd.y - 0.2) * 12.0);
  let sd = max(dot(rd, u.sunDir), 0.0);
  col += u.sunCol * (0.07 * pow(sd, 5.0) + 0.25 * pow(sd, 64.0));
  col += u.sunCol * smoothstep(0.99955, 0.99975, sd) * 10.0 * (1.0 - u.stars);
  if (rd.y > 0.0) {
    let cp = rd.xz / (rd.y + 0.12) * 0.8 + vec2f(u.p6, u.p7) * 0.0012;
    let n = vnoise(cp * 1.3, 41) * 0.6 + vnoise(cp * 3.1, 42) * 0.3 + vnoise(cp * 7.3, 43) * 0.1;
    let cov = smoothstep(0.55, 0.82, n) * smoothstep(0.02, 0.3, rd.y);
    let lit = u.skyHor * 0.75 + u.sunCol * 0.1 * (0.4 + pow(sd, 4.0));
    col = mix(col, lit, cov * 0.55);
    if (u.stars > 0.01) {
      let sp = rd.xz / (rd.y + 0.25) * 240.0;
      let id = floor(sp);
      let hs = hsh(i32(id.x), i32(id.y), 90);
      if (hs > 0.994) {
        let f = sp - id - 0.5;
        col += vec3f(0.9, 0.93, 1.0) * u.stars * (1.0 - cov) * smoothstep(0.3, 0.0, length(f)) * (hs - 0.994) * 300.0 * smoothstep(0.0, 0.3, rd.y);
      }
    }
  }
  return skyExtras(rd, col);
}

fn hue3(h: f32) -> vec3f { return clamp(abs(fract(vec3f(h) + vec3f(0.0, 0.667, 0.333)) * 6.0 - 3.0) - 1.0, vec3f(0.0), vec3f(1.0)); }

fn skyExtras(rd: vec3f, colIn: vec3f) -> vec3f {
  var c = colIn;
  let alpha = mix(0.72, 0.97, u.stars);
  // Saturn, where this landing site's position on Titan puts it. Titan orbits in the ring plane, so from here the
  // rings are seen almost exactly edge-on: a thin bright line through the disc, and a dark shadow band across it.
  let pd = ev.sat.xyz;
  let R = ev.sat.w;
  let cz = dot(rd, pd);
  if (R > 0.0 && cz > 0.9) {
    c += vec3f(1.0, 0.78, 0.45) * 0.06 * exp(-(1.0 - cz) * 60.0);
    let e1 = normalize(cross(pd, vec3f(0.0, 1.0, 0.0)));
    let e2 = cross(e1, pd);
    let q = vec2f(dot(rd, e1), dot(rd, e2)) / cz;
    let nR = ev.ringN.xyz;
    let Dk = ev.ringN.w;
    let Cs = pd * Dk;
    let satRkm = Dk * R;
    // Saturn's globe, flattened by 10 per cent along its axis (the ring normal)
    let axis = normalize(vec2f(dot(nR, e1), dot(nR, e2)));
    let qa = vec2f(dot(q, vec2f(axis.y, -axis.x)), dot(q, axis) / 0.902);
    let r2 = dot(qa, qa) / (R * R);
    var ringA = 0.0;
    var ringC = vec3f(0.0);
    // the ring line: where the ray passes closest to Saturn, how far is it from the ring plane
    let tc = dot(Cs, rd);
    let pc = rd * tc - Cs;
    let yoff = dot(pc, nR);
    let rr = length(pc - nR * yoff) / satRkm;
    let pixA = u.fov * 2.0 / u.res.y;
    let wy = abs(yoff) / max(tc * pixA, 1.0);
    var tau = 0.0;
    if (rr > 1.239 && rr < 2.27) { tau = select(select(0.55, 1.8, rr < 1.951), 0.08, rr < 1.527); if (rr > 1.951 && rr < 2.025) { tau = 0.08; } }
    ringA = (1.0 - exp(-tau * 3.0)) * sstepJ(1.5, 0.0, wy) * 0.8;
    ringC = vec3f(0.9, 0.82, 0.66) * (0.35 + 0.65 * sstepJ(-0.2, 0.3, u.sunDir.y + 0.3));
    let alpha2 = mix(0.72, 0.97, u.stars);
    if (r2 < 1.0) {
      let n = vec3f(qa / R, -sqrt(1.0 - r2));
      let sl = vec3f(dot(u.sunDir, e1), dot(u.sunDir, e2), dot(u.sunDir, pd));
      let lit = clamp(dot(n, -sl) * 0.9 + 0.35, 0.08, 1.0);
      let lat = qa.y / R + 0.12 * vnoise(vec2f(qa.x / R * 3.0, qa.y / R * 9.0), 98);
      var pc2 = mix(vec3f(0.95, 0.84, 0.64), vec3f(0.8, 0.5, 0.32), 0.5 + 0.5 * sin(lat * 13.0));
      pc2 = mix(pc2, vec3f(0.97, 0.9, 0.72), sstepJ(0.2, 0.0, abs(lat)) * 0.5);
      // the rings' shadow falls in a band on the side away from the sun
      let sb = qa.y / R + sign(dot(u.sunDir, nR)) * 0.28;
      pc2 *= 1.0 - 0.6 * sstepJ(0.09, 0.03, abs(sb));
      c = mix(c, pc2 * lit * (0.65 + 0.35 * sqrt(1.0 - r2)), alpha2);
    }
    // the near half of the ring line crosses in front of the disc
    if (r2 >= 1.0 || dot(pc, cross(e1, e2)) > 0.0) { c = mix(c, ringC, ringA * alpha2); }
  }
  // two terraformed moons, lit from within, glowing through the haze
  for (var mi = 0; mi < 2; mi++) {
    let md = select(ev.moonA.xyz, ev.moonB.xyz, mi == 1);
    let mc = select(vec3f(0.3, 1.0, 0.88), vec3f(1.0, 0.42, 0.62), mi == 1);
    let mr = select(ev.moonA.w, ev.moonB.w, mi == 1);
    let dm = dot(rd, md);
    if (dm > 0.85) {
      let ang = acos(min(dm, 1.0));
      c += mc * (0.06 * exp(-ang * 10.0) + 0.3 * exp(-ang * 55.0)) * (0.55 + 0.45 * u.stars);
      if (ang < mr) {
        let e1 = normalize(cross(md, vec3f(0.0, 1.0, 0.0)));
        let e2 = cross(e1, md);
        let q = vec2f(dot(rd, e1), dot(rd, e2)) / mr;
        let r2 = min(dot(q, q), 1.0);
        let pat = vnoise(q * 3.0, 99 + mi) * 0.6 + vnoise(q * 9.0, 101) * 0.4;
        c = mix(c, mc * (1.2 + 1.3 * pat) * (0.7 + 0.3 * sqrt(1.0 - r2)), 0.96);
      }
    }
  }
  if (rd.y > 0.0) {
    // aurora curtains to the north on some nights
    if (ev.sky.x > 0.01 && u.stars > 0.2) {
      let az = atan2(rd.x, -rd.z);
      var a = vec3f(0.0);
      for (var i = 0; i < 3; i++) {
        let fi = f32(i);
        let curtain = vnoise(vec2f(az * 3.0 + fi * 1.7 + u.time * 0.02, fi), 91 + i);
        let wave = rd.y - (0.1 + 0.07 * fi + 0.06 * vnoise(vec2f(az * 5.0 - u.time * 0.05, fi * 3.0), 94 + i));
        let band = sstepJ(-0.015, 0.0, wave) * exp(-max(wave, 0.0) * 8.0);
        let rays = 0.55 + 0.45 * vnoise(vec2f(az * 70.0, u.time * 0.3 + fi), 97);
        a += mix(vec3f(0.1, 1.0, 0.45), vec3f(0.75, 0.2, 1.0), clamp(max(wave, 0.0) * 5.0 + fi * 0.2, 0.0, 1.0)) * band * rays * curtain * curtain;
      }
      c += a * ev.sky.x * u.stars * sstepJ(-0.2, 0.6, -rd.z) * 0.6;
    }
    // shooting star
    if (ev.meteorA.w >= 0.0 && ev.meteorA.w < ev.meteorB.w) {
      let f = ev.meteorA.w / ev.meteorB.w;
      let a = normalize(mix(ev.meteorA.xyz, ev.meteorB.xyz, max(f - 0.3, 0.0)));
      let b = normalize(mix(ev.meteorA.xyz, ev.meteorB.xyz, f));
      let ab = b - a;
      let t = clamp(dot(rd - a, ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0);
      let d = length(rd - (a + ab * t));
      c += vec3f(0.85, 0.95, 1.0) * exp(-d * d / 3e-6) * t * t * sin(3.1416 * f) * 2.5 * max(u.stars, 0.15);
    }
  }
  // rainbow opposite the sun after rain
  if (ev.sky.y > 0.01 && u.sunDir.y > 0.02 && rd.y > -0.02) {
    let x = (acos(clamp(dot(rd, -u.sunDir), -1.0, 1.0)) - 0.855) / 0.04;
    if (abs(x) < 1.0) { c += hue3(0.75 * (1.0 - (x + 1.0) * 0.5)) * (1.0 - x * x) * ev.sky.y * 0.3; }
  }
  return c;
}

// fireworks over the neon districts: sparks on expanding, drooping shells
fn fireworksFx(ro: vec3f, rd: vec3f, tHit: f32) -> vec3f {
  var add = vec3f(0.0);
  for (var i = 0; i < 3; i++) {
    let f = ev.fw[i];
    if (f.w < 0.0 || f.w > 3.2) { continue; }
    let age = f.w;
    let fc = ev.fwCol[i];
    let c = f.xyz - vec3f(0.0, 2.2 * age * age, 0.0);
    let r = fc.w * (1.0 - exp(-age * 2.6));
    let fade = exp(-age * 1.2) * (1.0 - sstepJ(2.6, 3.2, age));
    let oc = ro - c;
    let b = dot(oc, rd);
    let disc = b * b - (dot(oc, oc) - r * r);
    if (disc > 0.0) {
      let sq = sqrt(disc);
      for (var j = 0; j < 2; j++) {
        let t = -b + select(-sq, sq, j == 1);
        if (t <= 0.0 || t >= tHit) { continue; }
        let dir = normalize(ro + rd * t - c);
        let th = acos(clamp(dir.y, -1.0, 1.0)) / 0.21;
        let ph = atan2(dir.z, dir.x) / 0.21;
        let cell = vec2f(floor(th), floor(ph));
        let hs = hsh(i32(cell.x) + i * 57, i32(cell.y), 110);
        if (hs < 0.5) { continue; }
        let fp = vec2f(th, ph) - cell - 0.5 - (vec2f(hsh(i32(cell.x), i32(cell.y), 111), hsh(i32(cell.x), i32(cell.y), 112)) - 0.5) * 0.5;
        let spark = exp(-dot(fp, fp) * 30.0) * (0.7 + 0.3 * sin(u.time * 30.0 + hs * 50.0));
        add += fc.rgb * spark * fade * 3.0 * (0.5 + 0.5 * f32(j));
      }
    }
    let tc = dot(c - ro, rd);
    if (tc > 0.0 && tc < tHit) {
      let dc = length(ro + rd * tc - c);
      add += fc.rgb * exp(-dc * dc / (r * r + 1.0) * 2.0) * fade * 0.12;
    }
  }
  return add;
}

// a rocket launch from a spaceport pad: engine glow climbing on a widening smoke column
fn launchFx(ro: vec3f, rd: vec3f, tHit: f32, colIn: vec3f) -> vec3f {
  var col = colIn;
  let age = ev.launch.w;
  if (age < 0.0 || age > 95.0) { return col; }
  let pad = ev.launch.xyz;
  let climb = max(age - 4.0, 0.0);
  let top = pad.y + 30.0 + 2.2 * climb * climb;
  let fade = 1.0 - sstepJ(70.0, 95.0, age);
  let dr = vec2f(0.8, 0.6);
  // the plume bends downrange as it climbs (gravity turn)
  var off = 0.0;
  var tl = 0.0;
  var y = 0.0;
  for (var it = 0; it < 2; it++) {
    let w = ro.xz - pad.xz - dr * off;
    tl = -dot(w, rd.xz) / max(dot(rd.xz, rd.xz), 1e-6);
    y = ro.y + rd.y * tl;
    off = 0.00018 * max(y - pad.y, 0.0) * max(y - pad.y, 0.0);
  }
  if (tl > 0.0 && tl < tHit && y > pad.y && y < top) {
    let dxz = length(ro.xz + rd.xz * tl - pad.xz - dr * off);
    let k = clamp((top - y) / (top - pad.y + 1.0), 0.0, 1.0);
    let wid = 6.0 + 34.0 * k * sstepJ(0.0, 40.0, age) + 20.0 * sstepJ(0.2, 0.0, (y - pad.y) / 200.0);
    let billow = 0.75 + 0.25 * vnoise(vec2f(y * 0.05, age * 0.2), 113);
    let a = exp(-(dxz * dxz) / (wid * wid)) * 0.55 * billow * fade * (1.0 - 0.5 * k * sstepJ(40.0, 90.0, age));
    let sunLit = sstepJ(-0.1, 0.3, u.sunDir.y);
    let lit = vec3f(0.8, 0.78, 0.76) * (0.12 + 0.6 * sunLit) + vec3f(1.0, 0.45, 0.15) * exp(-(top - y) / 50.0) * 0.9;
    col = mix(col, lit, clamp(a, 0.0, 0.85));
  }
  let fy = top - 6.0 - pad.y;
  let fp = pad + vec3f(dr.x * 0.00018 * fy * fy, fy, dr.y * 0.00018 * fy * fy);
  let tp = dot(fp - ro, rd);
  if (tp > 0.0 && tp < tHit) {
    let d = length(ro + rd * tp - fp) / max(tp, 1.0);
    col += vec3f(1.0, 0.72, 0.35) * (exp(-d * d / 2e-5) * 6.0 + exp(-d * d / 6e-4) * 0.35) * sstepJ(3.0, 5.0, age) * fade;
  }
  return col;
}

fn balloonSDF(q: vec3f) -> f32 {
  var d = sdEll(q, vec3f(8.0, 9.5, 8.0));
  d = min(d, sdCone(q - vec3f(0.0, -12.5, 0.0), 5.2, 3.0, 5.0 + 3.5));
  d = min(d, sdSeg(q, vec3f(3.0, -9.0, 0.0), vec3f(1.0, -13.0, 0.0)) - 0.05);
  d = min(d, sdSeg(q, vec3f(-3.0, -9.0, 0.0), vec3f(-1.0, -13.0, 0.0)) - 0.05);
  return min(d, sdBox(q - vec3f(0.0, -13.6, 0.0), vec3f(1.1, 0.8, 1.1)));
}

// hot-air balloons drifting over the wild land by day
fn traceBalloons(ro: vec3f, rd: vec3f, tEnd: f32) -> f32 {
  var best = -1.0;
  for (var i = 0; i < 3; i++) {
    let b = ev.balloon[i];
    if (b.w < 0.0) { continue; }
    let oc = (ro - b.xyz - vec3f(0.0, -3.0, 0.0)) / vec3f(9.0, 13.5, 9.0);
    let dr = rd / vec3f(9.0, 13.5, 9.0);
    let A = dot(dr, dr);
    let B = dot(oc, dr);
    let h = B * B - A * (dot(oc, oc) - 1.0);
    if (h < 0.0) { continue; }
    var t = max((-B - sqrt(h)) / A, 0.0);
    let t1 = min((-B + sqrt(h)) / A, tEnd);
    for (var k = 0; k < 40; k++) {
      if (t > t1) { break; }
      let d = balloonSDF(ro + rd * t - b.xyz);
      if (d < 0.02 * (1.0 + t * 0.01)) { if (best < 0.0 || t < best) { best = t; } break; }
      t += max(d * 0.85, 0.05);
    }
  }
  return best;
}

fn fogApply(col: vec3f, ro: vec3f, rd: vec3f, tIn: f32) -> vec3f {
  // the Warmhouse holds clear Earth air: the part of the ray inside it adds no haze
  let bq = ro - bubbleC();
  let bb = dot(bq, rd);
  let bh = bb * bb - (dot(bq, bq) - BUB_R * BUB_R);
  var t = tIn;
  if (bh > 0.0) { t = tIn - max(min(-bb + sqrt(bh), tIn) - max(-bb - sqrt(bh), 0.0), 0.0); }
  let b = 0.012;
  let k = rd.y * b;
  let tt = max(t - 35.0, 0.0) / (1.0 + max(t - 2000.0, 0.0) / 9000.0);
  // below 5 m under the datum (pits, deep valleys) the fog stops thickening: integrate it linearly from there
  let tA = select(tt, min(tt, (max(ro.y, 0.0) + 5.0) / max(-rd.y, 1e-5)), rd.y < 0.0);
  var fy = tt;
  if (abs(k) > 1e-5) { fy = (1.0 - exp(-tA * k)) / k + max(tt - tA, 0.0) * exp(-tA * k); }
  let amt = 1.0 - exp(-u.fogDen * exp(-max(ro.y, 0.0) * b) * fy);
  let sunAmt = pow(max(dot(rd, u.sunDir), 0.0), 8.0);
  let fc = mix(u.fogCol, u.fogCol * 0.6 + u.sunCol * 0.22, sunAmt);
  var outc = mix(col, fc, clamp(amt, 0.0, 1.0));
  // neon-lit smog hugging the streets at night, thickest in the neon districts
  let b2 = 0.045;
  let k2 = rd.y * b2;
  var fy2 = tt;
  if (abs(k2) > 1e-5) { fy2 = (1.0 - exp(-tA * k2)) / k2 + max(tt - tA, 0.0) * exp(-tA * k2); }
  let sp2 = ro.xz + rd.xz * min(t, 200.0);
  let neon = clamp(ev.sky.z * (0.7 + 0.6 * vnoise(sp2 / 350.0, 33)), 0.0, 1.0);
  let smogAmt = 1.0 - exp(-0.02 * u.windows * (0.3 + neon) * exp(-max(ro.y, 0.0) * b2) * fy2);
  let smogCol = mix(vec3f(0.22, 0.07, 0.25), vec3f(0.06, 0.2, 0.26), vnoise(sp2 / 140.0, 34)) * (0.4 + 0.6 * neon);
  return mix(outc, smogCol, clamp(smogAmt, 0.0, 0.7));
}

// ---------- neon text ----------
fn glyphBit(g: u32, x: i32, y: i32) -> f32 {
  if (x < 0 || x > 4 || y < 0 || y > 6) { return 0.0; }
  let v = tb.glyph[g >> 1u];
  let bit = u32(y * 5 + x);
  let odd = (g & 1u) == 1u;
  var w = select(v.x, v.z, odd);
  if (bit >= 32u) { w = select(v.y, v.w, odd); }
  return f32((w >> (bit & 31u)) & 1u);
}

// q is in glyph pixels: x to the right, y downward from the top of the first character.
// a centred line of up to four words (word ids, -1 for none); q.x from the line's centre, q.y down from its top,
// in glyph units (6 per character)
fn lineText(L: vec4i, q: vec2f) -> f32 {
  var total = 0.0;
  for (var i = 0; i < 4; i++) { if (L[i] < 0) { break; } total += f32(tb.word[L[i]].z) * 6.0 + select(0.0, 6.0, i > 0); }
  var x = q.x + total * 0.5;
  var r = 0.0;
  for (var i = 0; i < 4; i++) {
    if (L[i] < 0) { break; }
    if (i > 0) { x -= 6.0; }
    let wl = f32(tb.word[L[i]].z) * 6.0;
    if (x >= 0.0 && x < wl) { r = neonText(u32(L[i]), vec2f(x, q.y), false); }
    x -= wl;
  }
  return r;
}
// the posters on the megatower screens: the government's emigration campaign, the Org's notices, the cult's graffiti
fn posterLine(pk: i32, l: i32) -> vec4i {
  switch pk {
    case 0: { switch l { case 0: { return vec4i(20, 21, 22, -1); } case 1: { return vec4i(23, 24, 25, -1); } case 2: { return vec4i(26, 27, 28, -1); } default: { return vec4i(34, 35, 36, -1); } } }
    case 1: { switch l { case 0: { return vec4i(29, -1, -1, -1); } case 1: { return vec4i(26, 30, -1, -1); } case 2: { return vec4i(31, 32, -1, -1); } default: { return vec4i(33, -1, -1, -1); } } }
    case 2: { switch l { case 0: { return vec4i(24, 37, -1, -1); } case 1: { return vec4i(39, -1, -1, -1); } case 2: { return vec4i(43, -1, -1, -1); } default: { return vec4i(38, -1, -1, -1); } } }
    case 3: { switch l { case 0: { return vec4i(40, -1, -1, -1); } case 1: { return vec4i(41, -1, -1, -1); } default: { return vec4i(42, -1, -1, -1); } } }
    // the Hive's own boards and the tokes trade (words 44 on, see tables.js)
    case 4: { switch l { case 0: { return vec4i(52, 53, -1, -1); } case 1: { return vec4i(61, 67, -1, -1); } default: { return vec4i(59, 51, -1, -1); } } }
    case 5: { switch l { case 0: { return vec4i(47, 44, -1, -1); } case 1: { return vec4i(65, 56, -1, -1); } default: { return vec4i(64, 46, -1, -1); } } }
    case 6: { switch l { case 0: { return vec4i(62, 55, -1, -1); } case 1: { return vec4i(60, 54, -1, -1); } default: { return vec4i(63, 58, -1, -1); } } }
    // emigration, second wave: LEAVE TITAN / PASSAGE PAID / BOOK NOW; YOUR FUTURE / IS EARTH / SEATS LEFT;
    // GO HOME / TO EARTH / SHIPS DAILY
    case 7: { switch l { case 0: { return vec4i(68, 69, -1, -1); } case 1: { return vec4i(81, 82, -1, -1); } default: { return vec4i(77, 58, -1, -1); } } }
    case 8: { switch l { case 0: { return vec4i(78, 79, -1, -1); } case 1: { return vec4i(80, 34, -1, -1); } default: { return vec4i(75, 76, -1, -1); } } }
    case 9: { switch l { case 0: { return vec4i(70, 71, -1, -1); } case 1: { return vec4i(72, 34, -1, -1); } default: { return vec4i(73, 74, -1, -1); } } }
    // work: WORK FROM BED / SIGN OFF / ORG APPROVED; EXO HIRE / HEAVY LIFT / LEGAL JOBS
    case 10: { switch l { case 0: { return vec4i(83, 84, 66, -1); } case 1: { return vec4i(85, 86, -1, -1); } default: { return vec4i(37, 88, -1, -1); } } }
    // the Asters, in toki pona written in katakana: O TAWA MUN (go to the stars) / KON SELI (warm air) / TOKI PONA
    case 12: { switch l { case 0: { return vec4i(97, 98, 99, -1); } case 1: { return vec4i(100, 101, -1, -1); } default: { return vec4i(95, 96, -1, -1); } } }
    default: { switch l { case 0: { return vec4i(89, 90, -1, -1); } case 1: { return vec4i(91, 92, -1, -1); } default: { return vec4i(93, 87, -1, -1); } } }
  }
}
// which poster a screen shows, from a hash: emigration half the time (0, 1, 7, 8, 9), the tokes trade (4-6),
// work (10, 11), the Asters in toki pona (12), the cult's graffiti (2, 3)
fn posterPick(h: f32) -> i32 {
  if (h < 0.5) { return array<i32, 5>(0, 1, 7, 8, 9)[min(i32(h * 10.0), 4)]; }
  if (h < 0.7) { return 4 + min(i32((h - 0.5) / 0.2 * 3.0), 2); }
  if (h < 0.83) { return select(10, 11, h > 0.77); }
  if (h < 0.92) { return 12; }
  return select(2, 3, h > 0.96);
}
fn isEmig(pk: i32) -> bool { return pk <= 1 || (pk >= 7 && pk <= 9); }
// a poster's look: uv in -1..1 across the panel, txt the lettering (0..1)
fn posterLook(pk: i32, uv: vec2f, txt: f32) -> vec3f {
  if (isEmig(pk)) {
    // the government's campaign: deep blue, a red band, white letters, and a small Earth, blue and green
    let band = sstepJ(-0.68, -0.72, uv.y);
    var e = mix(mix(vec3f(0.03, 0.07, 0.24), vec3f(0.08, 0.16, 0.42), 0.5 + 0.5 * uv.y), vec3f(0.55, 0.05, 0.06), band);
    let ed = length(uv - vec2f(0.72, 0.78)) / 0.16;
    if (ed < 1.0) {
      let land = step(0.55, vnoise(vec2f(uv.x * 9.0 + u.time * 0.05, uv.y * 9.0), 571));
      e = mix(vec3f(0.1, 0.35, 0.9), vec3f(0.25, 0.6, 0.2), land) * (0.5 + 0.5 * sqrt(1.0 - ed * ed));
    }
    return e + vec3f(1.0, 0.97, 0.9) * txt;
  }
  if (pk >= 4 && pk <= 6) {
    // the tokes trade: loud, flashing, never subtle
    let fl2 = step(0.5, fract(u.time * 1.7));
    return mix(vec3f(0.5, 0.0, 0.35), vec3f(0.95, 0.75, 0.0), fl2 * step(0.0, uv.y)) + mix(vec3f(1.0, 0.95, 0.2), vec3f(1.0, 0.2, 0.8), fl2) * txt * 1.3;
  }
  if (pk == 10) {
    // the Org's sign-off jobs: a pale screen, black letters, the grey chequered border of an old home computer
    let edge = step(0.86, max(abs(uv.x), abs(uv.y)));
    let chk = step(0.5, fract((floor(uv.x * 40.0) + floor(uv.y * 40.0)) * 0.5));
    return mix(vec3f(0.62, 0.64, 0.6) * (1.0 - txt), vec3f(0.35) * chk, edge);
  }
  if (pk == 11) {
    // exo hire: black on yellow inside hazard stripes
    let edge = step(0.84, max(abs(uv.x), abs(uv.y)));
    let stripe = step(0.5, fract((uv.x + uv.y) * 6.0));
    return mix(vec3f(0.9, 0.7, 0.05) * (1.0 - txt), vec3f(0.9, 0.7, 0.05) * stripe, edge);
  }
  if (pk == 12) {
    // the Asters: silver lettering on black, under a cracked star
    let a = atan2(uv.x, uv.y - 0.72);
    let sr = length(uv - vec2f(0.0, 0.72)) / (0.13 + 0.07 * cos(a * 5.0));
    let crack = step(abs(uv.x + (uv.y - 0.72) * 0.35 - 0.01 * sin(uv.y * 60.0)), 0.012);
    let star = step(sr, 1.0) * (1.0 - crack);
    return vec3f(0.015) + vec3f(0.78, 0.8, 0.85) * (txt + star * 0.9);
  }
  if (pk == 2) {
    let ring = sstepJ(0.06, 0.0, abs(length(uv - vec2f(0.0, 0.72)) - 0.16));
    return vec3f(0.02) + vec3f(1.0, 0.62, 0.2) * (txt + ring * 0.8);
  }
  return vec3f(0.01, 0.02, 0.03) + vec3f(0.3, 1.0, 0.95) * txt * (0.7 + 0.3 * step(0.1, fract(u.time * 2.3 + uv.y)));
}
fn neonText(word: u32, q: vec2f, vertical: bool) -> f32 {
  if (q.x < 0.0 || q.y < 0.0) { return 0.0; }
  let wd = tb.word[word];
  var ci = 0;
  var lp = q;
  if (vertical) { ci = i32(floor(q.y / 8.0)); lp = vec2f(q.x, q.y - f32(ci) * 8.0); }
  else { ci = i32(floor(q.x / 6.0)); lp = vec2f(q.x - f32(ci) * 6.0, q.y); }
  if (ci >= i32(wd.z)) { return 0.0; }
  let g = (select(wd.x, wd.y, ci >= 4) >> (u32(ci & 3) * 8u)) & 255u;
  let f = fract(lp) - 0.5;
  // solid square pixels that join up, as on a ZX81 screen (the old look was a dot matrix)
  return glyphBit(g, i32(floor(lp.x)), i32(floor(lp.y))) * (1.0 - 0.15 * smoothstep(0.42, 0.5, max(abs(f.x), abs(f.y))));
}

// Signs that misbehave: now and then a sign stutters for a few seconds.
fn fritz(seed: i32) -> f32 {
  let bad = hsh(seed, i32(floor(u.time * 0.2)), 91) < 0.15;
  let b = hsh(seed, i32(floor(u.time * 11.0)), 92);
  return select(1.0, select(1.0, 0.06, b < 0.4), bad);
}

fn neonColor(k: f32) -> vec3f {
  var pal = array<vec3f, 6>(vec3f(1.0, 0.12, 0.5), vec3f(0.1, 0.85, 1.0), vec3f(1.0, 0.55, 0.08), vec3f(0.45, 1.0, 0.2), vec3f(0.65, 0.25, 1.0), vec3f(1.0, 0.1, 0.12));
  return pal[min(u32(k * 6.0), 5u)];
}

fn facadeFx(s: ptr<function, Surf>, p: vec3f, n: vec3f, ci: vec2i, lq: vec2f, detail: f32, fres: f32) {
  let cf = cellFull(ci);
  if (cf.typ != 1 && cf.typ != 2) { return; }
  let fl = cf.fl;
  let side = select(select(3, 2, n.z > 0.0), select(1, 0, n.x > 0.0), abs(n.x) > abs(n.z));
  let xFace = side < 2;
  let lsg = select(select(-1.0, 1.0, side == 2), select(1.0, -1.0, side == 0), xFace);
  let lu = select(lq.x - cf.off.x, lq.y - cf.off.y, xFace) * lsg;
  let hw = select(cf.w.x, cf.w.y, xFace);
  let s0 = i32(hsh(cf.seed, 1, 40) * 4.0);
  if ((fl & 64) != 0 && cf.typ == 1) {
    let gg = garageGeom(cf);
    let k = (gg.x - select(lq.y, lq.x, gg.z > 0.5)) * gg.y;
    let l = select(lq.x, lq.y, gg.z > 0.5) - gg.w;
    if (k > 0.02 && k < 5.7 && abs(l) < 2.7 && p.y < 3.5) {
      (*s).alb = select(vec3f(0.1, 0.1, 0.11), vec3f(0.01), k > 5.3);
      (*s).emi = vec3f(0.85, 0.92, 1.0) * 0.9 * step(3.0, p.y) * step(k, 5.3) * (0.3 + u.windows);
      (*s).refl = 0.02;
      (*s).spec = 0.1;
      (*s).trans = 0.0;
      return;
    }
  }
  // a waving lucky cat in one shop window
  if ((cf.egg & 63) == 27 && side == s0 && p.y < 3.0 && abs(lu) < 1.2) {
    let q = vec2f(lu, p.y - 0.45);
    let body = length((q - vec2f(0.0, 0.75)) / vec2f(0.36, 0.42)) - 1.0;
    let head = length(q - vec2f(0.0, 1.38)) - 0.3;
    let ear = max(abs(q.x) - 0.26 + (q.y - 1.62) * 0.9, max(0.0 - (q.y - 1.55), q.y - 1.85)) ;
    let wa = 0.6 * sin(u.time * 4.0);
    let pp = vec2f(0.32, 1.1) + vec2f(sin(wa), cos(wa)) * 0.32;
    let pa = q - vec2f(0.32, 1.1);
    let ba = pp - vec2f(0.32, 1.1);
    let paw = length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - 0.09;
    let catD = min(min(body, head), min(select(1.0, -1.0, ear < 0.0 && abs(q.x) > 0.08), paw));
    if (catD < 0.0) {
      let collar = step(abs(q.y - 1.08), 0.035) * step(abs(q.x), 0.3);
      let eye = step(length(vec2f(abs(q.x) - 0.1, q.y - 1.42)), 0.04);
      (*s).alb = mix(mix(vec3f(0.95, 0.93, 0.88), vec3f(0.85, 0.12, 0.08), collar), vec3f(0.02), eye);
      (*s).emi = (*s).alb * 0.35 * (0.3 + u.windows);
      (*s).refl = 0.0;
      return;
    }
  }
  // street-level shops: lit windows with goods on shelves and a neon name above
  if ((fl & 1024) != 0 && p.y < 4.2) {
    let segW = 5.2;
    let sidx = floor((lu + hw) / segW);
    let sl = lu + hw - sidx * segW;
    let sh = hsh(cf.seed + i32(sidx) * 17, side, 45);
    let win = step(0.35, sl) * step(sl, segW - 0.35) * step(0.35, p.y) * step(p.y, 3.2);
    let shelfY = fract(p.y / 0.36);
    let item = hsh(i32(floor(sl * 5.0)) + i32(sidx) * 131, i32(floor(p.y / 0.36)) + cf.seed, 31);
    let goods = step(0.35, item) * step(0.12, shelfY) * step(shelfY, 0.7) * step(0.12, fract(sl * 5.0));
    let gcol = mix(vec3f(0.5), 0.5 + 0.5 * cos(6.2831 * (vec3f(0.0, 0.33, 0.67) + item * 2.7 + sh)), 0.55);
    let shelf = step(0.92, shelfY) * 0.5;
    let interior = (mix(vec3f(1.0, 0.86, 0.66), gcol * 0.8, goods) * (1.0 - shelf)) * (0.3 + 0.7 * u.windows) * mix(0.5, 1.0, detail);
    (*s).alb = mix((*s).alb, vec3f(0.02), win);
    (*s).emi = mix((*s).emi, interior * 0.9, win);
    (*s).refl = mix((*s).refl, 0.12 + 0.5 * fres, win);
    (*s).trans = 0.0;
    if (p.y > 3.3 && p.y < 4.15) {
      var sw = array<u32, 16>(0u, 2u, 3u, 4u, 5u, 6u, 9u, 10u, 11u, 12u, 13u, 15u, 44u, 48u, 49u, 47u);
      let word = sw[min(u32(sh * 16.0), 15u)];
      let txt = neonText(word, vec2f((sl - 0.5) / 0.1, (4.1 - p.y) / 0.1), false);
      (*s).alb = vec3f(0.03);
      (*s).emi = neonColor(fract(sh * 7.3)) * mix(0.3, txt, detail) * 2.2 * fritz(cf.seed + i32(sidx)) * (0.25 + u.windows);
      (*s).refl = 0.02;
    }
  }
  // a burning window with soot above; its smoke plume is added near the camera
  if ((fl & 512) != 0 && side == i32(hsh(wrapS(ci.x), wrapS(ci.y), 59) * 4.0)) {
    let ys = floor(cf.h * 0.45 / 3.5) * 3.5 + 1.9;
    if (abs(lu) < 0.9 && abs(p.y - ys) < 1.1) {
      let fk = 0.6 + 0.4 * vnoise(vec2f(u.time * 6.0, f32(cf.seed & 63)), 112);
      let tongue = vnoise(vec2f(lu * 3.0, (p.y - ys) * 2.2 - u.time * 4.0), 113);
      let hgt = clamp((p.y - ys + 1.1) / 2.2, 0.0, 1.0);
      let flame = smoothstep(hgt - 0.15, hgt + 0.25, tongue * 1.2);
      (*s).alb = vec3f(0.02);
      (*s).emi = mix(vec3f(0.35, 0.03, 0.0), mix(vec3f(1.0, 0.25, 0.02), vec3f(1.0, 0.75, 0.3), flame), flame) * 3.2 * fk;
      (*s).refl = 0.0;
    } else if (abs(lu) < 1.8 && abs(p.y - ys) < 2.0) {
      let fk = 0.6 + 0.4 * vnoise(vec2f(u.time * 6.0, f32(cf.seed & 63)), 112);
      (*s).emi += vec3f(1.0, 0.3, 0.05) * 0.35 * fk * (1.0 - smoothstep(0.9, 1.8, max(abs(lu), abs(p.y - ys) * 0.9)));
    }
    if (abs(lu) < 0.9 && abs(p.y - ys) < 1.1) {
    } else if (abs(lu) < 1.4 && p.y > ys + 1.1 && p.y < ys + 6.0) {
      let soot = (1.0 - smoothstep(0.6, 1.4, abs(lu))) * (1.0 - smoothstep(ys + 1.1, ys + 6.0, p.y));
      (*s).alb *= 1.0 - 0.8 * soot;
      (*s).emi *= 1.0 - 0.9 * soot;
      (*s).refl *= 1.0 - 0.7 * soot;
    }
  }
  if (cf.typ != 1) { return; }
  // bowling alley: BOWLING in big letters below the roof pin, chasing lights
  if ((fl & 2) != 0 && (side == s0 || side == (s0 + 2) % 4)) {
    let px = min((2.0 * hw - 1.0) / 43.0, 0.42);
    let q = vec2f((lu + 21.5 * px) / px, (cf.h - 1.0 - p.y) / px);
    if (q.y > -0.5 && q.y < 7.5 && q.x > -0.5 && q.x < 42.5) {
      let chase = 0.55 + 0.45 * step(0.5, fract(u.time * 1.5 - floor(q.x / 6.0) * 0.14));
      (*s).alb = vec3f(0.03);
      (*s).emi = mix(vec3f(1.0, 0.1, 0.12), vec3f(1.0, 0.95, 0.9), step(0.5, fract(u.time * 0.25))) * mix(0.35, neonText(19u, q, false), detail) * 2.4 * chase * fritz(cf.seed + 3) * (0.3 + u.windows);
      (*s).refl = 0.02;
    }
  }
  // karaoke tower: カラオケ stacked vertically, lit one character after another
  if ((fl & 4) != 0 && side == s0) {
    let q = vec2f((lu + 0.5) / 0.2, (13.4 - p.y) / 0.2);
    if (q.x > -0.5 && q.x < 5.5 && q.y > -0.5 && q.y < 32.5) {
      let chase = step(fract(u.time * 0.7 - floor(q.y / 8.0) * 0.25), 0.75);
      (*s).alb = vec3f(0.03);
      (*s).emi = (neonColor(0.0) * mix(0.4, neonText(16u, q, true), detail) * 2.6 * chase + neonColor(0.2) * 0.12) * fritz(cf.seed + 5) * (0.35 + u.windows);
      (*s).refl = 0.02;
    }
  }
  // animated billboard with the occasional glitch
  if ((fl & 256) != 0 && side == ((s0 + 2) % 4)) {
    let bw = min(hw - 0.4, 5.5);
    let yb = cf.h * 0.45;
    if (abs(lu) < bw && p.y > yb && p.y < yb + 12.0) {
      var bq = vec2f((lu + bw) / (2.0 * bw), (p.y - yb) / 12.0);
      if (hsh(cf.seed, i32(floor(u.time * 7.0)), 93) < 0.05) { bq.x = fract(bq.x + 0.08 * step(0.5, fract(bq.y * 9.0))); }
      let bg = 0.5 + 0.5 * cos(6.2831 * (vec3f(0.0, 0.33, 0.67) + fract(u.time * 0.04 + f32(cf.seed & 255) * 0.01) + bq.y * 0.35 + bq.x * 0.15));
      var aw = array<u32, 9>(14u, 13u, 1u, 11u, 6u, 5u, 44u, 56u, 46u);
      let word = aw[min(u32(hsh(cf.seed, 7, 46) * 9.0), 8u)];
      let pxW = (2.0 * bw) / (f32(tb.word[word].z) * 6.0 + 2.0);
      let txt = neonText(word, vec2f(bq.x * 2.0 * bw / pxW - 1.0, (yb + 7.5 - p.y) / pxW), false);
      let scan = 0.8 + 0.2 * sin(p.y * 14.0 - u.time * 3.0);
      var e = bg * 0.5 + vec3f(1.0) * mix(0.2, txt, detail) * 1.6;
      if (hsh(cf.seed, 8, 47) < 0.6) {
        // a poster instead: three lines, changing every 15 s
        let pk = posterPick(hsh(cf.seed + i32(floor(u.time / 15.0)), 9, 48));
        let gu = min(2.0 * bw / 78.0, 12.0 / 44.0);
        let pu = vec2f(lu, p.y - yb - 6.0);
        var t3 = 0.0;
        for (var l = 0; l < 3; l++) {
          let qy = 19.0 - f32(l) * 13.0 - pu.y / gu;
          if (qy >= 0.0 && qy < 8.0) { t3 = max(t3, lineText(posterLine(pk, l), vec2f(pu.x / gu, qy))); }
        }
        e = posterLook(pk, vec2f(lu / bw, pu.y / 6.0), mix(0.2, t3, detail)) * 1.3;
      }
      (*s).alb = vec3f(0.02);
      (*s).emi = e * scan * fritz(cf.seed + 9) * (0.35 + 0.9 * u.windows);
      (*s).refl = 0.03;
    }
  }
  // scrolling LED code strip below the crown
  if ((fl & 260) != 0) {
    let y0 = cf.h - 2.6;
    if (p.y > y0 && p.y < y0 + 0.75) {
      let qx = (lu + hw) / 0.1 + u.time * 9.0;
      let chI = floor(qx / 6.0);
      let g = 20u + u32(hsh(cf.seed + i32(chI), side, 94) * 10.0);
      let bit = glyphBit(min(g, 29u), i32(floor(qx - chI * 6.0)), i32(floor((y0 + 0.72 - p.y) / 0.1)));
      (*s).alb = vec3f(0.02);
      (*s).emi = vec3f(0.2, 0.9, 1.0) * mix(0.25, bit, detail) * 1.8 * (0.3 + u.windows);
    }
  }
  // underground car park entrance with a P sign
  if ((fl & 64) != 0 && side == ((s0 + 1) % 4) && abs(lu) < 2.6) {
    if (p.y > 3.5 && p.y < 4.5 && abs(lu) < 0.5) {
      let txt = neonText(18u, vec2f((lu + 0.36) / 0.14, (4.45 - p.y) / 0.14), false);
      (*s).alb = vec3f(0.05, 0.15, 0.6);
      (*s).emi = mix(vec3f(0.05, 0.25, 1.0) * 0.5, vec3f(1.0), txt) * (0.3 + u.windows);
    }
  }
}


fn blimpSDF(p: vec3f) -> f32 {
  let K = ev.blimp;
  let fw = normalize(ev.blimpDir.xyz);
  let rt = normalize(cross(fw, vec3f(0.0, 1.0, 0.0)));
  let q0 = p - K.xyz;
  let q = vec3f(dot(q0, rt), q0.y, dot(q0, fw)) / K.w;
  let body = (length(q / vec3f(0.3, 0.3, 1.0)) - 1.0) * 0.3;
  let finV = max(max(abs(q.x) - 0.012, abs(q.y) - 0.45), max(-(q.z + 1.0), q.z + 0.7));
  let finH = max(max(abs(q.y) - 0.012, abs(q.x) - 0.45), max(-(q.z + 1.0), q.z + 0.7));
  let gond = sdBox(q - vec3f(0.0, -0.31, 0.08), vec3f(0.05, 0.035, 0.13)) - 0.01;
  return min(min(body, gond), min(finV, finH)) * K.w;
}

// ---------- the Warmhouse: a bubble of Earth air ----------
// A membrane 340 m across, full of warm air at Earth's density (1.8 kg/m^3 against Titan's 5.3, so each cubic
// metre lifts about 4.8 N), floating over the west edge of the city on four tethers. Inside, on a deck, a warm little
// town: stucco houses with open windows, a jazz club under a dome, Earth-green trees, strings of lights. It bobs and
// sways a little. BUB_C in world.js; bubbleC() here must match it.
const BUB_R: f32 = 170.0;
fn bubbleC() -> vec3f { return vec3f(-1650.0 + 9.0 * sin(u.time * 0.031), 300.0 + 5.0 * sin(u.time * 0.047), 520.0 + 7.0 * cos(u.time * 0.027)); }
// the contents (and the tethers): distance, and material 71 deck, 72 houses, 73 trees, 74 cables, 75 lights
fn bubbleSDF(p: vec3f) -> vec2f {
  let c = bubbleC();
  let q = p - c;
  let deckY = -95.0;
  var r = vec2f(max(length(q.xz) - 138.0, abs(q.y - deckY) - 2.5), 71.0);
  // houses: a ring of small blocks round a square, and a domed club in the middle
  let a = atan2(q.z, q.x);
  let sect = round(a / 0.3927) * 0.3927;
  let hq = vec3f(dot(q.xz, vec2f(cos(sect), sin(sect))) - 80.0, q.y - deckY - 2.5, dot(q.xz, vec2f(-sin(sect), cos(sect))));
  let hh = 9.0 + 7.0 * hsh(i32(round(a / 0.3927)), 3, 710);
  let house = sdBox(hq - vec3f(0.0, hh * 0.5, 0.0), vec3f(9.0, hh * 0.5, 11.0)) - 0.4;
  if (house < r.x) { r = vec2f(house, 72.0); }
  let club = max(length(q - vec3f(0.0, deckY + 2.5, 0.0)) - 26.0, deckY + 2.5 - q.y);
  if (club < r.x) { r = vec2f(club, 72.0); }
  // trees between the houses and the square
  // trees between the houses and the square: a trunk and a lumpy crown each
  let ta = round(a / 0.2618 + 0.5) - 0.5;
  let tq = q - vec3f(cos(ta * 0.2618) * 55.0, deckY + 2.5, sin(ta * 0.2618) * 55.0);
  let trunk = sdSeg(tq, vec3f(0.0), vec3f(0.0, 5.5, 0.0)) - 0.35;
  if (trunk < r.x) { r = vec2f(trunk, 74.0); }
  let cq = tq - vec3f(0.0, 8.0, 0.0);
  let crown = length(cq * vec3f(1.0, 1.25, 1.0)) - 3.6 + 0.5 * sin(cq.x * 1.7) * sin(cq.y * 1.9) * sin(cq.z * 1.3);
  if (crown < r.x) { r = vec2f(crown * 0.8, 73.0); }
  // lights strung round the square: bulbs on a sagging wire, 64 to the ring
  let la = a / 0.09817;
  let lf = fract(la) - 0.5;
  let sag = deckY + 14.0 - 1.2 * (1.0 - 4.0 * lf * lf);
  let lr = length(q.xz) - 40.0;
  let wire = length(vec2f(lr, q.y - sag)) - 0.04;
  if (wire < r.x) { r = vec2f(wire, 74.0); }
  let bulb = length(vec3f(lr, q.y - (sag - 0.25), lf * 0.09817 * 40.0)) - 0.16;
  if (bulb < r.x) { r = vec2f(bulb, 75.0); }
  // four tethers from the membrane's equator to anchors on the ground
  for (var k = 0; k < 4; k++) {
    let ang = 0.785 + f32(k) * 1.5708;
    let top = c + vec3f(cos(ang), 0.0, sin(ang)) * BUB_R * 0.98;
    let foot = vec3f(c.x + cos(ang) * BUB_R * 1.35, 0.0, c.z + sin(ang) * BUB_R * 1.35);
    let cab = sdSeg(p, top, foot) - 0.45;
    if (cab < r.x) { r = vec2f(cab, 74.0); }
  }
  return r;
}
// the contents and tethers along a ray, inside a bound round the bubble and its anchors
fn traceBubble(ro: vec3f, rd: vec3f, tEnd: f32) -> vec2f {
  let c = bubbleC() - vec3f(0.0, 90.0, 0.0);
  let R = BUB_R * 1.75;
  let oc = ro - c;
  let b = dot(oc, rd);
  let h = b * b - (dot(oc, oc) - R * R);
  if (h < 0.0) { return vec2f(-1.0, 0.0); }
  let sq = sqrt(h);
  var t = max(-b - sq, 0.0);
  let t1 = min(-b + sq, tEnd);
  for (var k = 0; k < 96; k++) {
    if (t > t1) { break; }
    let d = bubbleSDF(ro + rd * t);
    if (d.x < 0.002 * t + 0.02) { return vec2f(t, d.y); }
    t += max(d.x * 0.9, 0.05);
  }
  return vec2f(-1.0, 0.0);
}
// the membrane itself: thin and clear, a warm cast on what is seen through it, the sky caught at a glancing angle,
// and an oily rainbow sheen that drifts
fn bubbleFx(ro: vec3f, rd: vec3f, tEnd: f32, colIn: vec3f) -> vec3f {
  var col = colIn;
  let c = bubbleC();
  let oc = ro - c;
  let b = dot(oc, rd);
  let h = b * b - (dot(oc, oc) - BUB_R * BUB_R);
  if (h < 0.0) { return col; }
  let sq = sqrt(h);
  let inside = dot(oc, oc) < BUB_R * BUB_R;
  // the far wall first, then the near one
  for (var e = 1; e >= 0; e--) {
    let t = -b + select(-sq, sq, e == 1);
    if (t <= 0.0 || t >= tEnd) { continue; }
    let pn = normalize(ro + rd * t - c);
    let cosi = abs(dot(rd, pn));
    let fr = 0.02 + 0.5 * pow(1.0 - cosi, 5.0);
    let film = hue3(fract(dot(pn, vec3f(0.3, 0.8, 0.5)) * 2.0 + u.time * 0.02 + (1.0 - cosi) * 1.5));
    col = col * mix(vec3f(1.0), vec3f(1.05, 0.97, 0.9), select(0.5, 0.0, inside)) * (1.0 - fr) + skyCol(reflect(rd, pn)) * fr * 0.9 + film * 0.07 * (1.0 - cosi) * (0.4 + u.windows);
  }
  return col;
}

// ---------- skyboats ----------
// Craft on fixed routes over the city (main.js fills ev.ship: position and half-length s; ev.shipDir: heading and
// kind). Kinds: 0 cargo zeppelin, 1 skyboat (a boat hull hung under a flat gas envelope, with side sails), 2 balloon
// glider, 3 ad dirigible, 4 hover barge. Local frame: x right, y up, z forward, in units of s. Returns (distance in
// metres, part): 0 envelope, 1 hull and metal, 2 windows, 3 screen, 4 rotor, 5 cargo.
fn shipLocal(p: vec3f, i: i32) -> vec3f {
  let fw = normalize(ev.shipDir[i].xyz);
  let rt = normalize(cross(fw, vec3f(0.0, 1.0, 0.0)));
  let q0 = p - ev.ship[i].xyz;
  return vec3f(dot(q0, rt), q0.y, dot(q0, fw)) / ev.ship[i].w;
}
fn shipSDF(p: vec3f, i: i32) -> vec2f {
  let q = shipLocal(p, i);
  let kind = i32(ev.shipDir[i].w + 0.5);
  var r = vec2f(1e5, 0.0);
  if (kind == 0 || kind == 3) {
    // a long rigid envelope with shallow ribs, cross fins, a gondola; the zeppelin carries cargo pods, the ad
    // dirigible screens along both sides
    let rib = 0.004 * sin(q.z * 60.0) * step(abs(q.z), 0.9);
    r = vec2f((length(q / vec3f(0.22, 0.2, 1.0)) - 1.0) * 0.2 + rib, 0.0);
    let fin = min(max(max(abs(q.x) - 0.01, abs(q.y) - 0.34), max(-(q.z + 0.98), q.z + 0.72)), max(max(abs(q.y) - 0.01, abs(q.x) - 0.34), max(-(q.z + 0.98), q.z + 0.72)));
    if (fin < r.x) { r = vec2f(fin, 1.0); }
    let gond = sdBox(q - vec3f(0.0, -0.22, 0.45), vec3f(0.045, 0.03, 0.14)) - 0.01;
    if (gond < r.x) { r = vec2f(gond, 2.0); }
    if (kind == 0) {
      for (var k = 0; k < 3; k++) {
        let c = sdBox(q - vec3f(0.0, -0.27, -0.35 + f32(k) * 0.3), vec3f(0.08, 0.05, 0.12)) - 0.006;
        if (c < r.x) { r = vec2f(c, 5.0); }
      }
      let eng = length(vec2f(length(vec2f(abs(q.x) - 0.26, q.y + 0.05)) - 0.035, max(abs(q.z + 0.2) - 0.05, 0.0))) - 0.012;
      if (eng < r.x) { r = vec2f(eng, 4.0); }
    } else {
      let scr = sdBox(vec3f(abs(q.x) - 0.2, q.y, q.z), vec3f(0.012, 0.11, 0.55));
      if (scr < r.x) { r = vec2f(scr, 3.0); }
    }
  } else if (kind == 1) {
    // a skyboat: flat envelope above, a keeled hull below on struts, a deckhouse, and a wing-sail each side
    r = vec2f((length((q - vec3f(0.0, 0.34, 0.0)) / vec3f(0.3, 0.13, 0.85)) - 1.0) * 0.13, 0.0);
    var hull = sdEll(q - vec3f(0.0, -0.08, 0.02), vec3f(0.16, 0.13, 0.7));
    hull = max(hull, q.y + 0.02);
    hull = min(hull, sdBox(q - vec3f(0.0, -0.04, -0.1), vec3f(0.08, 0.05, 0.18)) - 0.01);
    if (hull < r.x) { r = vec2f(hull, 1.0); }
    let win = sdBox(q - vec3f(0.0, -0.035, -0.1), vec3f(0.082, 0.018, 0.16));
    if (win < r.x + 0.002 && win < 0.004) { r = vec2f(max(win, r.x), 2.0); }
    let strut = min(sdSeg(vec3f(abs(q.x), q.y, q.z), vec3f(0.1, 0.0, 0.4), vec3f(0.18, 0.26, 0.35)), sdSeg(vec3f(abs(q.x), q.y, q.z), vec3f(0.1, 0.0, -0.4), vec3f(0.18, 0.26, -0.35))) - 0.008;
    if (strut < r.x) { r = vec2f(strut, 1.0); }
    let sail = max(sdBox(vec3f(abs(q.x) - 0.36, q.y - 0.12 + 0.3 * (abs(q.x) - 0.2), q.z + 0.05), vec3f(0.18, 0.006, 0.28 - 0.5 * max(abs(q.x) - 0.25, 0.0))), 0.0);
    if (sail < r.x) { r = vec2f(sail, 0.0); }
  } else if (kind == 2) {
    // a personal balloon glider: a round envelope over a narrow wing and a one-seat pod
    r = vec2f(length(q - vec3f(0.0, 0.62, 0.0)) - 0.5, 0.0);
    let wing = sdBox(q - vec3f(0.0, -0.02, 0.05), vec3f(0.9, 0.012, 0.13 - 0.05 * abs(q.x))) - 0.004;
    if (wing < r.x) { r = vec2f(wing, 1.0); }
    let pod = sdEll(q - vec3f(0.0, -0.12, 0.05), vec3f(0.09, 0.1, 0.22));
    if (pod < r.x) { r = vec2f(pod, 2.0); }
    let line = sdSeg(vec3f(abs(q.x), q.y, q.z), vec3f(0.05, -0.05, 0.05), vec3f(0.3, 0.3, 0.0)) - 0.004;
    if (line < r.x) { r = vec2f(line, 1.0); }
  } else {
    // a hover barge: a flat hull with four ducted rotors at the corners and containers stacked on deck
    r = vec2f(sdBox(q, vec3f(0.42, 0.06, 0.95)) - 0.03, 1.0);
    let cq = vec3f(abs(q.x) - 0.5, q.y - 0.02, abs(q.z) - 0.75);
    let duct = length(vec2f(length(cq.xz) - 0.16, cq.y)) - 0.035;
    if (duct < r.x) { r = vec2f(duct, 4.0); }
    for (var k = 0; k < 3; k++) {
      let c = sdBox(q - vec3f(0.0, 0.16 + 0.05 * f32(k % 2), -0.55 + f32(k) * 0.55), vec3f(0.3, 0.1 + 0.05 * f32(k % 2), 0.22)) - 0.01;
      if (c < r.x) { r = vec2f(c, 5.0); }
    }
  }
  return vec2f(r.x * ev.ship[i].w, r.y);
}
// the nearest skyboat along a ray: (t, index), or t < 0
fn traceShips(ro: vec3f, rd: vec3f, tEnd: f32) -> vec2f {
  var best = vec2f(-1.0, 0.0);
  var te = tEnd;
  for (var i = 0; i < 8; i++) {
    let S = ev.ship[i];
    if (S.w <= 0.0) { continue; }
    let R = S.w * 1.25;
    let oc = ro - S.xyz;
    let b = dot(oc, rd);
    let h = b * b - (dot(oc, oc) - R * R);
    if (h < 0.0) { continue; }
    let sq = sqrt(h);
    var t = max(-b - sq, 0.0);
    let t1 = min(-b + sq, te);
    for (var k = 0; k < 72; k++) {
      if (t > t1) { break; }
      let d = shipSDF(ro + rd * t, i).x;
      if (d < 0.002 * t + 0.01) { best = vec2f(t, f32(i)); te = t; break; }
      t += d * 0.9;
    }
  }
  return best;
}

fn traceBlimp(ro: vec3f, rd: vec3f, tEnd: f32) -> f32 {
  if (ev.blimp.w <= 0.0) { return -1.0; }
  let R = ev.blimp.w * 1.05;
  let oc = ro - ev.blimp.xyz;
  let b = dot(oc, rd);
  let h = b * b - (dot(oc, oc) - R * R);
  if (h < 0.0) { return -1.0; }
  let sq = sqrt(h);
  var t = max(-b - sq, 0.0);
  let t1 = min(-b + sq, tEnd);
  for (var i = 0; i < 64; i++) {
    if (t > t1) { break; }
    let d = blimpSDF(ro + rd * t);
    if (d < 0.002 * t + 0.01) { return t; }
    t += d;
  }
  return -1.0;
}

// District blackouts: the lights go out across one area for a while, stuttering as they fail and return.
fn blackoutF(p: vec3f) -> f32 {
  if (ev.bo.w <= 0.0) { return 1.0; }
  return 1.0 - ev.bo.w * (1.0 - smoothstep(ev.bo.z * 0.75, ev.bo.z, length(p.xz - ev.bo.xy)));
}

fn zoneLamp(z: i32) -> vec3f {
  var c = array<vec3f, 8>(vec3f(0.85, 0.9, 1.0), vec3f(1.0, 0.55, 0.6), vec3f(1.0, 0.68, 0.38), vec3f(1.0, 0.36, 0.18),
                          vec3f(1.0, 0.5, 0.14), vec3f(0.8, 0.9, 1.0), vec3f(1.0, 0.72, 0.42), vec3f(0.72, 0.52, 1.0));
  return c[z & 7];
}

fn terrainSurf(p: vec3f, n: vec3f, t: f32, tv: vec4f, ndv: f32, fres: f32) -> Surf {
  var s: Surf;
  s.alb = vec3f(0.3);
  s.emi = vec3f(0.0);
  s.spec = 0.1;
  s.refl = 0.0;
  s.rough = 0.0;
  s.trans = 0.0;
  s.tint = vec3f(1.0);
  s.wet = 0.0;
  let w = biomeW(tv.z, tv.w);
  let H = tv.x;
  let nz = vnoise(p.xz / 37.0, 61) * 0.6 + vnoise(p.xz / 9.0, 62) * 0.4;
  if (tv.y > H + 0.01) {
    // water: crystal blue sea and oases, murky swamp pools, surf along the shore
    let depth = tv.y - H;
    let swampy = w.swp * w.mid;
    // liquid methane: near-black glass over dark sediment
    var deep = vec3f(0.006, 0.005, 0.004);
    var shallow = vec3f(0.09, 0.055, 0.025);
    if (w.des > 0.3) { deep = vec3f(0.01, 0.03, 0.03); shallow = vec3f(0.05, 0.25, 0.22); }
    if (swampy > 0.3) { deep = vec3f(0.03, 0.022, 0.012); shallow = vec3f(0.1, 0.07, 0.03); }
    s.alb = mix(shallow, deep, sstepJ(0.0, 14.0, depth));
    let foam = (1.0 - sstepJ(0.0, 0.7, depth)) * step(0.5, vnoise(p.xz * 0.4 + vec2f(u.time * 0.08, 0.0), 63)) * (1.0 - swampy);
    s.alb = mix(s.alb, vec3f(0.62, 0.52, 0.38), foam);
    if (w.des > 0.3) { s.emi = vec3f(0.1, 0.6, 0.5) * 0.25 * (1.0 - sstepJ(0.0, 6.0, depth)) * (0.3 + u.windows); }
    s.refl = (0.04 + 0.85 * fres) * (1.0 - foam);
    s.rough = 0.004;
    s.spec = 1.6;
    s.wet = 0.6;
    s.tint = vec3f(0.85, 0.95, 1.0);
    return s;
  }
  let slope = 1.0 - n.y;
  // tholin soils, dark organic dunes, water-ice bedrock
  let grass = mix(vec3f(0.11, 0.065, 0.05), vec3f(0.19, 0.11, 0.07), nz);
  let sand = mix(vec3f(0.2, 0.12, 0.065), vec3f(0.36, 0.22, 0.11), nz);
  let band = fract(H / 11.0 + vnoise(p.xz / 300.0, 64) * 0.6);
  let strata = mix(mix(vec3f(0.62, 0.6, 0.58), vec3f(0.42, 0.3, 0.2), step(0.33, band)), vec3f(0.72, 0.42, 0.18), step(0.7, band));
  let swampC = mix(vec3f(0.07, 0.05, 0.035), vec3f(0.13, 0.09, 0.05), nz);
  let rock = mix(vec3f(0.5, 0.54, 0.58), vec3f(0.66, 0.68, 0.7), nz);
  // faint glowing moss in the soil
  s.emi = hue3(0.45 + 0.15 * vnoise(p.xz / 40.0, 67)) * step(0.9, vnoise(p.xz * 0.9, 68)) * (1.0 - w.des) * w.mid * 0.3 * (0.2 + u.windows);
  var col = w.mid * (w.fo * grass + w.des * sand + w.bad * strata + w.swp * swampC) + w.mnt * mix(grass * 0.8, rock, sstepJ(120.0, 380.0, H)) + w.sea * sand;
  if (w.des > 0.3) { let oa = oasisAt(p.xz); if (oa.x < 130.0) { col = mix(col, vec3f(0.08, 0.2, 0.18), sstepJ(130.0, 80.0, oa.x)); s.emi += vec3f(0.2, 0.9, 0.75) * 0.12 * sstepJ(130.0, 70.0, oa.x) * (0.3 + u.windows); } }
  col = mix(col, sand * 1.05, (1.0 - sstepJ(0.5, 3.5, H)) * sstepJ(-50.0, -1.0, tv.y));
  col = mix(col, rock, sstepJ(0.35, 0.6, slope) * (1.0 - w.bad * 0.6));
  let snowLine = 220.0 + 80.0 * (vnoise(p.xz / 120.0, 65) - 0.5) - 150.0 * ev.sky.w;
  let snow = sstepJ(snowLine, snowLine + 50.0, H) * sstepJ(0.55, 0.3, slope);
  s.alb = mix(col, vec3f(0.9, 0.86, 0.78), snow);
  s.spec = 0.08 + 0.3 * snow;
  return s;
}

fn rippleN(p: vec3f) -> vec3f {
  let t = u.time;
  let gx = 0.05 * cos(p.x * 1.7 + t * 1.3) + 0.035 * cos((p.x + p.z) * 2.9 - t * 1.9) + 0.02 * cos(p.x * 5.3 - p.z * 2.1 + t * 2.7);
  let gz = 0.05 * cos(p.z * 1.9 - t * 1.1) + 0.035 * cos((p.x + p.z) * 2.9 - t * 1.9) + 0.02 * cos(p.z * 4.7 + p.x * 1.3 - t * 2.3);
  return vec3f(gx, 0.0, gz);
}

fn beamSpot(p: vec3f) -> vec3f {
  var acc = vec3f(0.0);
  for (var i = 0; i < 4; i++) {
    let bp = ev.beamPos[i];
    if (bp.w > 0.0) {
      let bd = ev.beamDir[i];
      let v = p - bp.xyz;
      let along = dot(v, bd.xyz);
      if (along > 0.0 && along < 150.0) {
        let rad = 0.4 + along * bd.w;
        let rr = length(v - bd.xyz * along);
        acc += vec3f(0.9, 0.95, 1.0) * exp(-rr * rr / (rad * rad)) * bp.w * 2.5 * (1.0 - along / 150.0);
      }
    }
  }
  return acc;
}

// Searchlight beams from air taxis, scattered by the haze.
fn beamGlow(ro: vec3f, rd: vec3f, tHit: f32) -> vec3f {
  var acc = vec3f(0.0);
  for (var i = 0; i < 4; i++) {
    let bp = ev.beamPos[i];
    if (bp.w > 0.0) {
      let bd = ev.beamDir[i];
      let w0 = ro - bp.xyz;
      let b = dot(rd, bd.xyz);
      let tr = clamp((b * dot(bd.xyz, w0) - dot(rd, w0)) / max(1.0 - b * b, 1e-4), 0.0, tHit);
      let pr = ro + rd * tr;
      let L = select(150.0, 900.0, bp.w > 1.5);
      let k = select(bp.w, (bp.w - 1.0) * 2.0, bp.w > 1.5);
      let sb = clamp(dot(pr - bp.xyz, bd.xyz), 0.0, L);
      let dist = length(pr - bp.xyz - bd.xyz * sb);
      let rad = 0.4 + sb * bd.w;
      acc += vec3f(0.8, 0.9, 1.0) * exp(-dist * dist / (rad * rad)) * (1.0 - sb / L) * k * 0.5 / (1.0 + rad * 0.2);
    }
  }
  return acc;
}

fn smokeFx(ro: vec3f, rd: vec3f, tHit: f32, col: vec3f) -> vec3f {
  var c = col;
  let ax = normalize(vec3f(u.p3 * 0.15, 1.0, u.p4 * 0.15));
  for (var i = 0; i < 4; i++) {
    let sm = ev.smoke[i];
    if (sm.w > 0.0) {
      let w0 = ro - sm.xyz;
      let b = dot(rd, ax);
      let tr = clamp((b * dot(ax, w0) - dot(rd, w0)) / max(1.0 - b * b, 1e-4), 0.0, tHit);
      let pr = ro + rd * tr;
      let sb = clamp(dot(pr - sm.xyz, ax), 0.0, 60.0);
      let dist = length(pr - sm.xyz - ax * sb);
      let rad = 0.5 + sb * 0.3;
      let nz = vnoise(vec2f(sb * 0.35 - u.time * 1.1, dist * 0.6 + f32(i) * 7.0), 98);
      let dens = exp(-dist * dist / (rad * rad)) * (1.0 - sb / 60.0) * (0.45 + 0.55 * nz) * sm.w;
      let lit = u.fogCol * 0.35 + vec3f(0.3, 0.29, 0.28) * (0.15 + 0.85 * max(u.sunDir.y, 0.0));
      c = mix(c, lit, clamp(dens * 0.75, 0.0, 0.8));
    }
  }
  return c;
}

// A giant holographic koi drifting over the rooftops now and then.
fn koiFx(ro: vec3f, rd: vec3f, tHit: f32) -> vec3f {
  let K = ev.koi;
  if (K.w <= 0.0 || ev.koiDir.w <= 0.0) { return vec3f(0.0); }
  let S = K.w;
  let oc = ro - K.xyz;
  let b = dot(oc, rd);
  let h = b * b - (dot(oc, oc) - S * S * 0.36);
  if (h < 0.0) { return vec3f(0.0); }
  let sq = sqrt(h);
  let t0 = max(-b - sq, 0.0);
  let t1 = min(-b + sq, tHit);
  if (t0 >= t1) { return vec3f(0.0); }
  let fw = normalize(ev.koiDir.xyz);
  let rt = normalize(cross(fw, vec3f(0.0, 1.0, 0.0)));
  let upv = cross(rt, fw);
  var acc = vec3f(0.0);
  let dt = (t1 - t0) / 28.0;
  for (var i = 0; i < 28; i++) {
    let pw = ro + rd * (t0 + dt * (f32(i) + 0.5));
    let q0 = (pw - K.xyz) / S;
    var q = vec3f(dot(q0, rt), dot(q0, upv), dot(q0, fw));
    q.x += 0.06 * sin(q.z * 7.0 - u.time * 1.8) * (0.35 - q.z);
    // body tapering to the tail, big fluttering tail fin, pectoral and dorsal fins
    let rz = 0.12 * sqrt(max(1.0 - pow((q.z - 0.05) / 0.42, 2.0), 0.0)) + 0.012;
    let body = (length(vec2f(q.x, q.y * 1.15)) - rz) * 3.0;
    let tq = q - vec3f(0.0, 0.0, -0.42);
    let tail = max(max(abs(tq.x + 0.03 * sin(u.time * 3.0)) - 0.01, length(vec2f(tq.y * 0.7, tq.z + 0.02)) - 0.13) * 8.0, (tq.z - 0.02) * 8.0);
    let pec = length((vec3f(abs(q.x), q.y, q.z) - vec3f(0.15, -0.05, 0.14)) / vec3f(0.09, 0.012, 0.06)) - 1.0;
    let dor = max(abs(q.x) * 30.0 - 0.3, length(vec2f((q.y - 0.12) * 1.6, q.z + 0.02) / 0.16) - 1.0);
    let f = min(min(body, tail), min(pec, dor));
    let edge = exp(-abs(f) * 7.0);
    let fill = select(0.0, 0.3, f < 0.0);
    let kpat = step(0.52, vnoise(q.zy * 7.0 + vec2f(3.0, 1.0), 99));
    let colr = mix(vec3f(1.0, 0.94, 0.88), vec3f(1.0, 0.35, 0.08), kpat);
    let scan = 0.6 + 0.4 * step(0.45, fract(pw.y * 0.35 - u.time * 1.2));
    acc += (colr * fill + vec3f(0.35, 0.85, 1.0) * edge * 0.6) * scan;
  }
  return acc * (dt / S) * 4.0 * ev.koiDir.w * (0.4 + 0.8 * u.windows);
}

fn surface(p: vec3f, n: vec3f, m: f32, rd: vec3f, t: f32) -> Surf {
  var s: Surf;
  s.alb = vec3f(0.5);
  s.emi = vec3f(0.0);
  s.spec = 0.2;
  s.refl = 0.0;
  s.rough = 0.0;
  s.trans = 0.0;
  s.tint = vec3f(1.0);
  s.wet = 0.0;
  let mi = i32(m + 0.5);
  let ci = vec2i(floor(p.xz / CS));
  let lq = p.xz - (vec2f(ci) + 0.5) * CS;
  let e = HALF - max(abs(lq.x), abs(lq.y));
  let ndv = clamp(dot(-rd, n), 0.0, 1.0);
  let fres = pow(1.0 - ndv, 5.0);
  let ciw = wrapC(ci);
  let cseed = ciw.x * 7919 + ciw.y * 104729;
  let detail = 1.0 - smoothstep(110.0, 360.0, t);
  let facU = select(p.x, p.z, abs(n.x) > abs(n.z));
  switch mi {
    case 0: {
      let cellG = cellHead(ci);
      var farGround = false;
      if (cellG.typ == 7 || (cellG.fl & 262144) != 0) {
        let tv = terrAt(p.xz);
        farGround = true;
        if (cellG.typ != 7 || tv.x > 0.25 || tv.y > tv.x || cityDist(p.xz) > cityR(p.xz) - 5.0) {
          s = terrainSurf(p, n, t, tv, ndv, fres);
        } else {
          // distant city streets beyond the block window
          s.alb = vec3f(0.05, 0.05, 0.055);
          s.spec = 0.4;
          s.refl = 0.05 + 0.4 * fres;
          s.emi = vec3f(1.0, 0.6, 0.3) * 0.05 * u.windows;
        }
      }
      if (!farGround) {
      let dens = smoothstep(0.12, 0.55, forestF(wrapP(p.xz)));
      let road = 1.0 - smoothstep(3.25, 3.45, e);
      var col = mix(vec3f(0.23, 0.22, 0.21), vec3f(0.032, 0.034, 0.04), road);
      let along = select(p.x, p.z, abs(lq.x) > abs(lq.y));
      let line = (1.0 - smoothstep(0.05, 0.09, e)) * step(0.5, fract(along / 5.0)) * detail;
      col = mix(col, vec3f(0.55, 0.5, 0.38), line * 0.65);
      let cell = cellHead(ci);
      if ((cell.typ == 0 || cell.typ == 6) && e > 3.4) {
        let g = abs(fract(p.xz / 3.0) - 0.5);
        col = vec3f(0.26, 0.245, 0.23) * (1.0 - 0.18 * smoothstep(0.46, 0.49, max(g.x, g.y)) * detail);
      }
      col = mix(col, vec3f(0.035, 0.05, 0.022) * (0.85 + 0.3 * vnoise(p.xz * 0.35, 12)), dens);
      s.alb = col;
      s.spec = 0.5 * road * (1.0 - dens);
      s.refl = (0.05 + 0.55 * fres) * road * (1.0 - dens);
      s.rough = 0.012;
      let lampA = 9.0 * round(along / 9.0);
      let ld = vec2f(along - lampA, e - 2.9);
      s.emi = zoneLamp((cell.fl >> 15) & 7) * exp(-dot(ld, ld) * 0.35) * u.windows * 0.16 * road * (1.0 - dens);
      if (road > 0.5 && t < 250.0) {
        let cq = carsQ(vec3f(p.x, 0.6, p.z));
        if (cq.ok > 0.5) {
          let under = (1.0 - smoothstep(1.7, 2.8, abs(cq.la))) * (1.0 - smoothstep(0.75, 1.35, abs(cq.lat)));
          s.alb *= 1.0 - 0.7 * under;
          s.refl *= 1.0 - 0.8 * under;
          if (cq.kind >= 4 && cq.kind <= 6) {
            let fl2 = step(0.5, fract(u.time * 2.6 + f32(cq.seed & 7) * 0.1));
            s.emi += select(vec3f(0.1, 0.25, 1.0), vec3f(1.0, 0.1, 0.08), fl2 > 0.5) * exp(-(cq.la * cq.la * 0.05 + cq.lat * cq.lat * 0.3)) * 0.5 * (0.3 + u.windows);
          }
        }
      }
      if (u.windows > 0.15 && road > 0.5) {
        let cq = carsQ(vec3f(p.x, 0.6, p.z));
        if (cq.ok > 0.5 && cq.la > 2.0) {
          s.emi += vec3f(1.0, 0.9, 0.75) * exp(-(cq.la - 7.0) * (cq.la - 7.0) / 22.0) * exp(-cq.lat * cq.lat * 0.5) * 0.22 * u.windows;
        }
        if (cq.ok > 0.5 && cq.la < -2.0) {
          s.emi += vec3f(1.0, 0.08, 0.04) * exp(-(cq.la + 3.0) * (cq.la + 3.0) / 3.0) * exp(-cq.lat * cq.lat) * 0.12 * u.windows;
        }
      }
      var wet = 0.0;
      let lxI = round(p.x / CS);
      let lzI = round(p.z / CS);
      let nearX = abs(p.x - lxI * CS) < 3.4;
      let nearZ = abs(p.z - lzI * CS) < 3.4;
      let cX = nearX && canalAt(i32(lxI), 1, p.z);
      let cZ = nearZ && canalAt(i32(lzI), 2, p.x);
      if ((cX && !(nearZ && !cZ)) || (cZ && !(nearX && !cX))) { wet = 1.0; }
      if ((cell.fl & 32) != 0 && e > 4.0) { wet = 1.0; }
      // rain wets the streets; puddles form and low districts flood, then drain as it dries
      let wetG = u.p9;
      let flood = max(smoothstep(0.92 - 0.28 * wetG, 0.96 - 0.28 * wetG, vnoise(p.xz / 650.0, 16)),
                      smoothstep(0.74 - 0.16 * wetG, 0.78 - 0.16 * wetG, vnoise(p.xz / 7.0, 17)) * wetG) * road;
      s.alb *= 1.0 - 0.3 * wetG * road;
      s.refl = mix(s.refl, 0.08 + 0.55 * fres, 0.6 * wetG * road);
      if (wet > 0.5) {
        s.alb = vec3f(0.008, 0.016, 0.02);
        s.refl = 0.2 + 0.75 * fres;
        s.spec = 1.4;
        s.rough = 0.004;
        s.emi *= 0.3;
        s.wet = 1.0;
      } else if (flood > 0.0) {
        s.refl = mix(s.refl, 0.15 + 0.7 * fres, flood);
        s.rough = mix(s.rough, 0.004, flood);
        s.wet = 0.5 * flood;
      }
      if ((cell.fl & 64) != 0 && cell.typ == 1) {
        let gg = garageGeom(cellFull(ci));
        let k = (gg.x - select(lq.y, lq.x, gg.z > 0.5)) * gg.y;
        let l = select(lq.x, lq.y, gg.z > 0.5) - gg.w;
        if (k > -0.05 && k < 5.6 && abs(l) < 2.65) {
          let edge = max(abs(l) - 2.2, max(0.4 - k, k - 5.1));
          let stripe = step(0.5, fract((l + k) * 1.5));
          s.alb = select(vec3f(0.12, 0.12, 0.13), mix(vec3f(0.05), vec3f(0.9, 0.7, 0.05), stripe), edge > 0.0);
          s.emi = vec3f(0.0);
          s.refl = 0.05;
          s.wet = 0.0;
        }
      }
      let bg = vec2i(floor(p.xz / BIG));
      if (giantHasW(bg) && !isHall(bg)) {
        let gd = length(p.xz - (vec2f(bg) + 0.5) * BIG);
        let vein = 1.0 - smoothstep(0.0, 0.025, abs(vnoise(p.xz * 0.1, 13) - 0.5));
        s.emi += glowColor(p) * vein * (1.0 - smoothstep(30.0, 85.0, gd)) * (0.25 + 0.8 * u.windows) * detail;
      }
      }
    }
    case 1: {
      let tsel = hsh(cseed, 0, 61);
      let warmGlass = step(0.62, tsel);
      if (abs(n.y) > 0.6) {
        s.alb = vec3f(0.09, 0.09, 0.1);
        s.spec = 0.2;
      } else {
        let cfz = cellFull(ci);
        let mega = ((cfz.fl >> 15) & 7) == 6;
        // Life: about two in five round towers run the shared board in their windows, one column per window
        let lifeT = cfz.v >= 0.4 && cfz.v < 0.72 && !mega && hsh(cseed, 5, 781) < 0.4;
        let lang = fract(atan2(lq.y - cfz.off.y, lq.x - cfz.off.x) / 6.2831853 + 1.0);
        let fx = select(facU / select(1.5, 1.1, mega), lang * 64.0, lifeT);
        let fy = p.y / select(3.6, 3.0, mega);
        let gx = fract(fx);
        let gy = fract(fy);
        let mull = (1.0 - smoothstep(0.02, select(0.045, 0.12, mega), min(gx, 1.0 - gx))) * detail;
        let span = smoothstep(select(0.84, 0.72, mega), select(0.86, 0.74, mega), gy) * detail;
        let opaque = max(mull, span);
        let glass = mix(vec3f(0.018, 0.03, 0.045), vec3f(0.045, 0.036, 0.028), warmGlass);
        s.alb = mix(glass, mix(vec3f(0.13, 0.135, 0.145), vec3f(0.17, 0.15, 0.12), warmGlass), opaque);
        s.tint = mix(vec3f(0.82, 0.9, 1.0), vec3f(1.0, 0.9, 0.78), warmGlass);
        s.spec = 1.0;
        s.rough = 0.012;
        let wid = i32(floor(fx)) + cseed;
        let fl = i32(floor(fy));
        let ep = i32(floor(u.time / 40.0 + hsh(wid, fl, 67) * 7.0));
        let hr = hsh(wid, fl * 131 + ep * 7, 62);
        let litP = 0.03 + 0.13 * u.windows;
        var lit = step(hr, litP) * (1.0 - opaque);
        if (hsh(cseed, 1, 69) < 0.14) { lit = step(0.72, 0.5 + 0.5 * sin(floor(fx) * 0.9 + floor(fy) * 0.45 - u.time * 1.6)) * (1.0 - opaque); }
        let wc = mix(vec3f(1.0, 0.66, 0.38), vec3f(0.7, 0.84, 1.0), step(0.78, fract(hr * 13.7)));
        let nearE = lit * (0.2 + 0.6 * fract(hr * 7.3));
        let farE = litP * 0.55;
        s.emi = wc * mix(farE, nearE, detail) * u.windows * 0.85;
        if (lifeT) {
          let alive = lifeAt(i32(floor(fx)) + (cseed & 63), i32(floor((cfz.h - p.y) / 3.6)));
          lit = alive * (1.0 - opaque);
          s.emi = vec3f(0.62, 1.0, 0.78) * mix(0.08, lit, detail) * (0.3 + 1.1 * u.windows);
        }
        s.refl = (0.05 + 0.85 * pow(1.0 - ndv, 4.0)) * (1.0 - opaque * 0.75) * (1.0 - lit * 0.8);
        if (mega) {
          // the dorms, where the people are: capsule homes two to a floor, one round window each, pastel bands of
          // panelling, and nearly everyone in, lit blue and violet by their headsets at any hour
          let fy2 = p.y / 1.5;
          let pr = length(vec2f((gx - 0.5) * 1.1, (fract(fy2) - 0.5) * 1.5));
          let port = (1.0 - smoothstep(0.38, 0.42, pr)) * detail + (1.0 - detail) * 0.35;
          let rim = smoothstep(0.4, 0.43, pr) * (1.0 - smoothstep(0.46, 0.5, pr)) * detail;
          let pal = hsh(i32(floor(fy2 / 6.0)), cseed, 72);
          let panel = 0.3 + 0.3 * cos(6.2831 * (vec3f(0.0, 0.33, 0.67) + pal));
          s.alb = mix(panel, vec3f(0.015, 0.02, 0.03), port);
          s.alb = mix(s.alb, vec3f(0.6, 0.62, 0.66), rim);
          s.spec = mix(0.4, 1.0, port + rim);
          s.rough = mix(0.5, 0.02, port);
          let pw = i32(floor(fx)) + cseed;
          let pf = i32(floor(fy2));
          let hp = hsh(pw, pf, 73);
          let home = step(hp, 0.9);
          let flick = 0.45 + 0.55 * hsh(pw, pf * 7 + i32(floor(u.time * (3.0 + 4.0 * hp) + hp * 9.0)), 74);
          var sc = mix(vec3f(0.3, 0.45, 1.0), vec3f(0.75, 0.35, 1.0), fract(hp * 5.3));
          if (fract(hp * 17.1) > 0.85) { sc = vec3f(1.0, 0.62, 0.35); }
          let nearD = sc * flick * home;
          let farD = mix(vec3f(0.3, 0.45, 1.0), vec3f(0.75, 0.35, 1.0), 0.4) * 0.6;
          s.emi = mix(farD, nearD, detail) * port * (0.35 + 0.9 * u.windows);
          s.refl = (0.05 + 0.6 * pow(1.0 - ndv, 4.0)) * (port + rim) * 0.5;
        }
        if ((cfz.egg & 63) == 28 && u.windows > 0.2) {
          // one tower shows a heart in its lit windows
          let lu2 = select(lq.y - cfz.off.y, lq.x - cfz.off.x, abs(n.x) < abs(n.z));
          let hx = (floor(lu2 / 1.5) + 0.5) / 4.5;
          let hy = (floor((p.y - cfz.h * 0.6) / 3.6) + 0.5) / 4.0;
          if (abs(hx) < 1.4 && abs(hy) < 1.4) {
            let k = hx * hx + hy * hy - 1.0;
            let inH = step(k * k * k - hx * hx * hy * hy * hy, 0.0);
            s.emi = vec3f(1.0, 0.25, 0.45) * inH * (1.0 - opaque) * u.windows * 1.6;
          }
        }
      }
    }
    case 10: {
      s.alb = vec3f(0.3, 0.3, 0.31);
      s.spec = 0.3;
      if (p.y > cellHead(ci).h + 13.0) {
        var blink = smoothstep(0.75, 0.8, fract(u.time * 0.6 + f32(cseed & 63) * 0.13));
        // two masts in five key the city's Morse (morse.js, ev.wx.y) instead of the steady beat
        if (hsh(cseed, 9, 790) < 0.4) { blink = ev.wx.y; }
        s.emi = vec3f(1.0, 0.08, 0.04) * (0.4 + 5.0 * blink);
      }
    }
    case 12: {
      let cq = carsQ(p);
      let py = p.y - cq.yb;
      let k = cq.kind;
      let pal = hsh(cq.seed, 0, 76);
      var paint = vec3f(0.5, 0.52, 0.55);
      if (pal < 0.22) { paint = vec3f(0.025, 0.027, 0.03); } else if (pal < 0.4) { paint = vec3f(0.78, 0.77, 0.74); }
      else if (pal < 0.5) { paint = vec3f(0.42, 0.04, 0.035); } else if (pal < 0.6) { paint = vec3f(0.04, 0.11, 0.28); }
      var hl = 2.0;
      var glassY = 1.22;
      var barY = 99.0;
      switch k {
        case 1: { paint = vec3f(0.85, 0.62, 0.05); }
        case 2: { hl = 2.2; glassY = 1.45; }
        case 3: { hl = 2.1; glassY = 0.95; }
        case 4: { paint = select(vec3f(0.02, 0.03, 0.06), vec3f(0.9), py > 0.9); barY = 1.63; }
        case 5: { paint = select(vec3f(0.92), vec3f(0.85, 0.08, 0.06), abs(py - 1.0) < 0.12); hl = 2.4; glassY = 1.7; barY = 2.03; }
        case 6: { paint = vec3f(0.7, 0.05, 0.03); hl = 3.0; glassY = 1.6; }
        case 7: { paint = vec3f(0.6, 0.02, 0.02); hl = 2.1; glassY = 0.95; }
        case 8: { paint = select(vec3f(0.3, 0.17, 0.08), vec3f(0.85, 0.83, 0.78), py > 0.46); hl = 99.0; glassY = 0.95; }
        default: {}
      }
      let glassy = step(glassY, py) * step(py, min(barY, 1.95) - 0.02) * select(1.0, 0.0, k == 8 || k == 6);
      s.alb = mix(paint, vec3f(0.015), glassy);
      s.spec = 1.4;
      // chrome speed stripes along the flanks
      if (k != 8 && k != 6 && (abs(py - 0.7) < 0.025 || abs(py - 0.6) < 0.018)) { s.alb = vec3f(0.85, 0.86, 0.88); s.spec = 2.0; }
      s.refl = 0.08 + 0.6 * pow(1.0 - ndv, 3.0);
      let lampY = 1.0 - smoothstep(0.08, 0.16, abs(py - select(0.78, 1.0, k == 2 || k == 5 || k == 6)));
      let side = smoothstep(0.3, 0.42, abs(cq.lat));
      let on = 0.3 + 1.2 * u.windows;
      if (cq.la > hl) { s.emi = vec3f(1.0, 0.95, 0.85) * lampY * side * on * 3.0; }
      if (cq.la < -hl) { s.emi = vec3f(1.0, 0.05, 0.03) * lampY * side * on * 2.2; }
      if (k == 1 && py > 1.54) { s.emi = vec3f(1.0, 0.75, 0.2) * on * 1.5; }
      let flash = step(0.5, fract(u.time * 2.6 + f32(cq.seed & 7) * 0.1));
      if (py > barY || (k == 6 && py > 2.03 && cq.la > 2.2)) {
        s.emi = select(vec3f(0.1, 0.3, 1.0), vec3f(1.0, 0.08, 0.06), (cq.lat < 0.0) != (flash > 0.5)) * 4.0;
      }
      if (k == 8 && cq.la < -1.9 && py > 0.9) { s.emi = vec3f(1.0, 0.6, 0.25) * on * 1.2; }
    }
    case 14: {
      let aq = airQ(p);
      s.alb = vec3f(0.78, 0.8, 0.83);
      s.spec = 1.2;
      s.refl = 0.3 * pow(1.0 - ndv, 3.0);
      let strobe = step(0.93, fract(u.time * 0.9 + aq.w * 0.37));
      if (abs(aq.z) > 1.7) {
        s.emi = select(vec3f(1.0, 0.1, 0.08), vec3f(0.1, 1.0, 0.35), aq.z > 0.0) * (0.8 + 1.5 * u.windows) + vec3f(6.0) * strobe;
      }
      if (n.y < -0.5) { s.emi += vec3f(0.45, 0.8, 1.0) * (0.25 + 1.2 * u.windows); }
    }
    case 13: {
      if (n.y > 0.5) {
        s.alb = mix(vec3f(0.04, 0.085, 0.028), vec3f(0.1, 0.14, 0.04), vnoise(p.xz * 1.1 + vec2f(p.y), 22));
        s.trans = 0.6;
        s.spec = 0.05;
      } else {
        s.alb = vec3f(0.74, 0.72, 0.66);
        s.spec = 0.3;
      }
    }
    case 15: {
      let lc = p.xz - (vec2f(ci) + 0.5) * CS;
      let fy = fract(p.y / 4.2);
      let rib = smoothstep(0.3, 0.34, fy) * (1.0 - smoothstep(0.84, 0.88, fy));
      s.alb = mix(vec3f(0.74, 0.72, 0.66), vec3f(0.018, 0.028, 0.034), rib * mix(0.6, 1.0, detail));
      s.spec = mix(0.3, 1.0, rib);
      s.refl = rib * (0.05 + 0.7 * pow(1.0 - ndv, 4.0));
      let sec = i32(floor((atan2(lc.y, lc.x) + PI) * 3.0));
      let fl = i32(floor(p.y / 4.2));
      let hr = hsh(sec + cseed, fl * 131 + i32(floor(u.time / 45.0 + hsh(sec, fl, 66) * 5.0)) * 7, 65);
      let litP = 0.05 + 0.2 * u.windows;
      s.emi = vec3f(1.0, 0.72, 0.45) * rib * mix(litP * 0.5, step(hr, litP) * 0.8, detail) * u.windows * 0.8;
      // Life (life.js) on half the round towers: the window band cut into 64 cells round the tower, one row a floor,
      // the board's top at the tower's top, each tower turned by its own number of columns
      if (hsh(cseed, 5, 781) < 0.5) {
        let cfo = cellFull(ci);
        let fxL = fract(atan2(lc.y - cfo.off.y, lc.x - cfo.off.x) / 6.2831853 + 1.0) * 64.0;
        let mullL = (1.0 - smoothstep(0.05, 0.12, min(fract(fxL), 1.0 - fract(fxL)))) * detail;
        let alive = lifeAt(i32(floor(fxL)) + (cseed & 63), i32(floor((cfo.h - p.y) / 4.2)));
        s.emi = vec3f(0.62, 1.0, 0.78) * rib * (1.0 - mullL) * mix(0.12, alive, detail) * (0.35 + 1.1 * u.windows);
      }
    }
    case 2: {
      let pick = hsh(cseed, 0, 63);
      var stone = vec3f(0.6, 0.54, 0.46);
      if (pick > 0.7) { stone = vec3f(0.64, 0.62, 0.58); } else if (pick < 0.25) { stone = vec3f(0.46, 0.29, 0.22); }
      let china = ((cellHead(ci).fl >> 15) & 7) == 3;
      if (china) { stone = select(vec3f(0.55, 0.08, 0.05), vec3f(0.62, 0.5, 0.2), pick > 0.8); }
      if (n.y > 0.35) {
        s.alb = select(stone * 0.9, vec3f(0.06, 0.28, 0.22), china);
      } else if (abs(n.y) < 0.3) {
        let fx = facU / 3.0;
        let fy = p.y / 4.8;
        let gx = fract(fx) - 0.5;
        let gy = fract(fy);
        let wx = abs(gx) - 0.16;
        let archd = select(max(wx, 0.22 - gy), length(vec2f(gx, gy - 0.62)) - 0.16, gy > 0.62);
        let win = (1.0 - smoothstep(-0.01, 0.01, archd)) * step(1.2, p.y) * detail;
        let course = smoothstep(0.44, 0.5, abs(fract(p.y / 0.9) - 0.5)) * 0.1 * detail;
        s.alb = mix(stone * (1.0 - course), vec3f(0.02, 0.02, 0.025), win);
        let wid = i32(floor(fx)) + cseed;
        let fl = i32(floor(fy));
        let hr = hsh(wid, fl * 131 + i32(floor(u.time / 50.0 + hsh(wid, fl, 68) * 7.0)) * 7, 64);
        let litP = 0.05 + 0.2 * u.windows;
        s.emi = vec3f(1.0, 0.58, 0.28) * mix(litP * 0.12, win * step(hr, litP), detail) * u.windows * 0.6;
        s.refl = win * 0.25 * pow(1.0 - ndv, 3.0);
      } else {
        s.alb = stone * 0.8;
      }
      s.alb *= 0.72 + 0.28 * smoothstep(0.0, 9.0, p.y);
      s.spec = 0.15;
    }
    case 11: {
      s.alb = vec3f(0.12, 0.13, 0.15);
      s.spec = 0.35;
      s.refl = 0.06 * pow(1.0 - ndv, 3.0);
    }
    case 7: {
      let streak = vnoise(vec2f(facU * 0.8, p.y * 0.15), 15);
      s.alb = mix(vec3f(0.2, 0.42, 0.37), vec3f(0.13, 0.28, 0.26), streak * detail);
      s.spec = 0.45;
      s.refl = 0.08 * pow(1.0 - ndv, 3.0);
    }
    case 8: {
      let stone = vec3f(0.42, 0.4, 0.35);
      let mossy = smoothstep(0.35, 0.75, n.y * 0.4 + 0.5 + (vnoise(vec2f(p.x + p.z, p.y * 0.35), 17) - 0.5) * 0.8 - p.y * 0.01);
      s.alb = mix(stone, vec3f(0.06, 0.1, 0.03), mossy);
      s.spec = 0.1;
    }
    case 4: {
      let tb = treeBk(p);
      let hc = tb.z;
      let ha = tb.w;
      let sp = i32(floor(ha));
      let hf = fract(ha);
      var leaf = mix(vec3f(0.032, 0.058, 0.024), vec3f(0.07, 0.098, 0.034), hc);
      switch sp {
        case 1: { leaf = mix(vec3f(0.018, 0.045, 0.03), vec3f(0.035, 0.07, 0.04), hc); }
        case 2: { leaf = mix(vec3f(0.09, 0.2, 0.04), vec3f(0.16, 0.26, 0.05), hc); }
        case 3: { leaf = vec3f(0.12, 0.24, 0.09) * (0.8 + 0.2 * step(0.5, fract(atan2(p.z - floor(p.z), p.x - floor(p.x)) * 2.0))); }
        case 5: { leaf = mix(vec3f(0.14, 0.15, 0.06), vec3f(0.2, 0.2, 0.08), hc); }
        default: { if (hf > 0.93) { leaf = vec3f(0.24, 0.085, 0.025); } else if (hf > 0.87) { leaf = vec3f(0.24, 0.18, 0.04); } }
      }
      let clump = vnoise(p.xz * 1.4 + vec2f(p.y * 0.9, 0.0), 18);
      leaf *= mix(1.0, 0.75 + 0.5 * clump, detail);
      // Titan flora: dark, waxy fronds in muted ochres, maroons and olive, varying from plant to plant, with
      // sparse bioluminescent points that only show after dark; the glow stalks' bulbs light up fully
      let tone = hue3(0.02 + 0.14 * hc + 0.06 * hf);
      leaf = mix(leaf, mix(vec3f(0.06, 0.035, 0.03), tone * 0.12, 0.6), 0.6) * (0.8 + 0.4 * clump);
      let glowHue = select(select(select(0.47, 0.55, sp == 1), 0.12, sp == 3), 0.9, sp == 5) + hc * 0.1;
      let tip = step(0.84, vnoise(p.xz * 2.6 + vec2f(p.y * 3.1, 0.0), 131)) * (0.65 + 0.35 * sin(u.time * 0.9 + hc * 25.0));
      let bulb = select(0.0, 1.0, sp == 3);
      s.emi = hue3(glowHue) * (tip * 0.7 + bulb * 0.6 + 0.01) * (0.02 + 1.2 * u.windows * u.windows) * select(select(1.0, 0.3, sp == 0), 0.6, sp == 1);
      s.alb = leaf;
      s.spec = 0.08;
      s.trans = 1.0;
    }
    case 5: {
      let tbk = treeBk(p);
      let spk = i32(floor(tbk.w));
      s.alb = select(select(vec3f(0.07, 0.058, 0.046), vec3f(0.3, 0.24, 0.16) * (0.8 + 0.2 * step(0.5, fract(p.y * 2.5))), spk == 2), vec3f(0.26, 0.24, 0.22), spk == 4);
      s.spec = 0.05;
    }
    case 16: {
      let cf = cellFull(ci);
      let g = signGeom(cf);
      let lc = vec3f(lq.x, p.y, lq.y) - g.ctr;
      let wdt = select(g.half.z, g.half.x, g.axisX) * 2.0;
      var uu = select(lc.z, lc.x, g.axisX) * g.sgn + wdt * 0.5;
      let fN = select(n.x, n.z, g.axisX) * g.sgn;
      if (select(fN > 0.0, fN < 0.0, g.axisX)) { uu = wdt - uu; }
      let vv = g.half.y - lc.y;
      let pxs = wdt / 7.0;
      var bw = array<u32, 10>(16u, 17u, 0u, 1u, 6u, 11u, 2u, 5u, 44u, 50u);
      let word = bw[min(u32(hsh(cf.seed, 6, 45) * 10.0), 9u)];
      let txt = mix(0.35, neonText(word, vec2f(uu / pxs - 1.0, vv / pxs - 0.6), true), detail);
      let border = 1.0 - smoothstep(0.0, pxs * 0.35, min(min(uu, wdt - uu), min(vv, 2.0 * g.half.y - vv)));
      let colr = neonColor(hsh(cf.seed, 5, 44));
      let on = fritz(cf.seed + 11) * (0.2 + 1.1 * u.windows);
      s.alb = vec3f(0.025, 0.025, 0.03);
      s.spec = 0.5;
      if (abs(select(n.z, n.x, g.axisX)) > 0.7 || abs(n.y) > 0.7) { s.emi = colr * 0.3 * on; }
      else { s.emi = (colr * txt * 2.6 + colr * border * 0.9) * on; }
    }
    case 17: {
      let dq = droneQ(p);
      s.alb = vec3f(0.07, 0.07, 0.08);
      s.spec = 0.8;
      if (abs(dq.y) > 0.3 && abs(dq.z) > 0.3) {
        let blink = step(0.8, fract(u.time * 1.5 + dq.w * 0.13));
        s.emi = select(vec3f(1.0, 0.1, 0.1), vec3f(0.1, 1.0, 0.3), dq.z > 0.0) * (0.5 + 3.0 * blink);
      }
    }
    case 18: {
      let cf = cellFull(ci);
      let ly = p.y - cf.h * select(1.0, 1.06, cf.v < 0.4);
      s.alb = select(vec3f(0.9, 0.9, 0.88), vec3f(0.8, 0.05, 0.05), abs(ly - 4.0) < 0.22 || abs(ly - 4.6) < 0.12);
      s.spec = 0.9;
      s.refl = 0.1 + 0.4 * pow(1.0 - ndv, 3.0);
      s.emi = vec3f(1.0, 0.3, 0.4) * 0.15 * u.windows;
    }
    case 19: {
      let q = vec3f(lq.x, p.y - 10.4, lq.y);
      let a = atan2(q.y, q.x);
      s.alb = vec3f(0.55, 0.56, 0.6);
      s.spec = 0.8;
      let bulbs = step(0.6, fract(a / (2.0 * PI) * 64.0)) * step(7.9, length(q.xy));
      s.emi = mix(vec3f(1.0, 0.8, 0.4), vec3f(1.0, 0.2, 0.6), 0.5 + 0.5 * sin(a * 8.0 - u.time * 3.0)) * bulbs * (0.1 + 1.2 * u.windows);
    }
    case 20: {
      let a = atan2(p.y - 10.4, lq.x) - (u.time * 0.05 + f32(cseed & 63));
      let hc = hsh(i32(round(a / (2.0 * PI / 16.0))), cseed, 70);
      s.alb = neonColor(hc) * 0.6;
      s.spec = 0.6;
      s.emi = vec3f(1.0, 0.8, 0.55) * step(0.5, fract(p.y * 1.3)) * 0.4 * u.windows;
    }
    case 21: {
      s.alb = vec3f(0.3, 0.18, 0.1);
      let top = step(0.95, p.y) * step(p.y, 1.05);
      s.emi = (0.5 + 0.5 * cos(6.2831 * (vec3f(0.0, 0.33, 0.67) + vnoise(p.xz * 3.0, 32) * 2.0))) * top * 0.25 * (0.3 + u.windows);
    }
    case 22: {
      let stall = round(lq.x / 3.1) + select(0.0, 10.0, lq.y > 0.0);
      let c1 = neonColor(hsh(i32(stall), cseed, 71));
      s.alb = mix(c1 * 0.7, vec3f(0.85), step(0.5, fract(lq.x * 2.0)));
      s.trans = 0.5;
    }
    case 23: {
      s.alb = vec3f(0.5, 0.1, 0.05);
      s.emi = vec3f(1.0, 0.3, 0.1) * (0.4 + 2.0 * u.windows);
    }
    case 24: {
      // the walkers, dressed part by part (see pedFigure for the ids)
      gPT = true;
      gPB = 1e5;
      let pq = pedQ(p);
      gPT = false;
      let key = i32(pq.w) - 1;
      let ln = key & 1;
      let kind = pedKind(ci, ln, key);
      let hs = hsh(key, ci.x * 7 + ci.y, 97);
      let lit = 0.35 + 1.4 * u.windows;
      let fr = pow(1.0 - ndv, 3.0);
      s.rough = 0.55;
      s.spec = 0.4;
      switch gPP {
        case 0: { s.alb = mix(vec3f(0.55, 0.38, 0.28), vec3f(0.28, 0.18, 0.13), fract(hs * 3.7)); s.rough = 0.6; }
        case 1: {
          // suits: dusty workwear for the lopers, dark for the gliders, bright for the fast lane, coats on the riders
          var suit = vec3f(0.62, 0.42, 0.2);
          if (hs < 0.25) { suit = vec3f(0.16, 0.36, 0.38); } else if (hs < 0.5) { suit = vec3f(0.7, 0.68, 0.62); } else if (hs < 0.7) { suit = vec3f(0.5, 0.12, 0.08); }
          if (kind == 3) { suit = vec3f(0.07, 0.07, 0.08); }
          if (kind == 4) { suit = neonColor(fract(hs * 3.1)) * 0.45 + vec3f(0.1); }
          if (kind == 0) { suit = mix(vec3f(0.05, 0.05, 0.06), vec3f(0.25, 0.22, 0.2), hs); if (hs > 0.8) { suit = neonColor(fract(hs * 9.1)) * 0.35; } }
          s.alb = suit;
          s.rough = 0.7;
          s.spec = 0.3;
        }
        case 2: { s.alb = vec3f(0.05, 0.05, 0.055); s.rough = 0.45; s.spec = 0.5; }
        case 3: {
          // visors: black glass with the sky in it, the face faintly lit inside; gold for the gliders and skaters
          s.alb = vec3f(0.012);
          s.refl = 0.3 + 0.6 * fr;
          s.spec = 1.6;
          s.rough = 0.02;
          if (kind >= 3) { s.tint = vec3f(1.0, 0.78, 0.4); }
          s.emi = vec3f(1.0, 0.7, 0.45) * (0.03 + 0.18 * u.windows);
        }
        case 4: { s.alb = vec3f(0.34, 0.35, 0.37); s.spec = 0.9; s.rough = 0.3; }
        case 5: {
          let cc = neonColor(fract(hs * 5.7));
          s.alb = cc * 0.6;
          s.trans = 0.45;
          s.emi = cc * (0.05 + 0.4 * u.windows);
        }
        case 6: { s.alb = vec3f(0.1); s.emi = select(vec3f(1.0, 0.55, 0.2), vec3f(0.35, 0.9, 1.0), p.y > 1.5 || kind == 2) * lit; }
        case 7: {
          // android shells: lacquer, chrome, brass or porcelain
          var shell = vec3f(0.75, 0.76, 0.78);
          if (hs < 0.25) { shell = vec3f(0.03, 0.03, 0.035); } else if (hs < 0.55) { shell = vec3f(0.72, 0.52, 0.25); } else if (hs < 0.75) { shell = vec3f(0.82, 0.8, 0.74); }
          s.alb = shell;
          s.spec = 1.3;
          s.rough = 0.12;
          s.refl = 0.2 + 0.6 * fr;
        }
        case 8: {
          let glow = mix(vec3f(1.0, 0.75, 0.35), vec3f(0.5, 0.9, 1.0), step(0.5, fract(hs * 7.3)));
          s.alb = vec3f(0.75, 0.6, 0.3);
          s.emi = glow * (0.6 + 1.4 * u.windows);
        }
        case 9: { s.alb = vec3f(0.08, 0.08, 0.09); s.spec = 0.9; s.rough = 0.3; }
        case 10: { s.alb = mix(vec3f(0.34, 0.36, 0.4), vec3f(0.55, 0.5, 0.42), step(0.6, hs)); s.spec = 0.85; s.rough = 0.25; }
        default: { s.alb = vec3f(0.05); s.emi = neonColor(fract(hs * 11.3)) * (0.5 + 1.5 * u.windows); }
      }
    }
    case 25: {
      let eg = escGeom(cellFull(ci));
      let P = vec3f(lq.x, p.y, lq.y);
      let ab = eg.b - eg.a;
      let hh = clamp(dot(P - eg.a, ab) / dot(ab, ab), 0.0, 1.0);
      let below = step(P.y, eg.a.y + ab.y * hh - 0.1);
      let stp = step(0.72, fract(hh * length(ab) / 0.42 - u.time * 0.9));
      s.alb = vec3f(0.05, 0.07, 0.09);
      s.refl = 0.25 + 0.6 * pow(1.0 - ndv, 4.0);
      s.spec = 1.4;
      s.emi = vec3f(0.6, 0.9, 1.0) * (0.12 + 0.7 * stp * below) * (0.3 + u.windows);
    }
    case 26: {
      let cf = cellFull(ci);
      let tt = u.time + f32(cf.seed & 1023);
      let cyc = floor(tt / 26.0);
      let pal = hsh(i32(cyc), cf.seed + select(0, 1, tt - cyc * 26.0 >= 13.0), 79);
      var paint = vec3f(0.5, 0.52, 0.55);
      if (pal < 0.3) { paint = vec3f(0.03); } else if (pal < 0.5) { paint = vec3f(0.8, 0.79, 0.76); } else if (pal < 0.65) { paint = vec3f(0.45, 0.05, 0.04); }
      s.alb = mix(paint, vec3f(0.015), step(1.22, p.y));
      s.spec = 1.4;
      s.refl = 0.08 + 0.6 * pow(1.0 - ndv, 3.0);
    }
    case 27: {
      s.alb = vec3f(0.06, 0.065, 0.07);
      s.spec = 0.4;
      if (p.y > 4.02 && abs(n.y) < 0.5) {
        let cq2 = abs(lq) - vec2f(9.45);
        let xFacing = abs(n.x) > 0.5;
        let fu = select(cq2.x, cq2.y, xFacing);
        let t0 = u.time - select(SIG_G + SIG_A, 0.0, xFacing);
        let mm = t0 - floor(t0 / SIG_P) * SIG_P;
        let state = select(select(0, 1, mm >= SIG_G * 0.75 && mm < SIG_G), 2, mm < SIG_G * 0.75);
        for (var li = 0; li < 3; li++) {
          let dl = length(vec2f(fu, p.y - (4.88 - f32(li) * 0.33)));
          let lc = select(select(vec3f(1.0, 0.08, 0.04), vec3f(1.0, 0.6, 0.05), li == 1), vec3f(0.1, 1.0, 0.4), li == 2);
          s.emi += lc * (1.0 - smoothstep(0.08, 0.11, dl)) * select(0.06, 3.5, li == state);
        }
      }
    }
    case 28: {
      let cq = chaseQ(p);
      let police = cq.w > 0.5;
      s.alb = select(vec3f(0.04, 0.04, 0.05), vec3f(0.85, 0.86, 0.9), police);
      s.spec = 1.3;
      s.refl = 0.1 + 0.5 * pow(1.0 - ndv, 3.0);
      if (cq.y > 1.9) { s.emi = vec3f(1.0, 0.95, 0.85) * 2.5; }
      if (cq.y < -2.0) { s.emi = vec3f(1.0, 0.05, 0.03) * 2.5; }
      if (police && abs(cq.y) < 1.2 && abs(cq.z) > 0.6) {
        s.emi = select(vec3f(0.1, 0.3, 1.0), vec3f(1.0, 0.08, 0.06), (cq.z < 0.0) != (fract(u.time * 3.2) > 0.5)) * 3.5;
      }
      if (!police && abs(cq.z) < 0.5) { s.emi += vec3f(0.1, 0.8, 1.0) * 0.6; }
    }
    case 71: {
      // the Warmhouse deck: a paved square round the club, a ring of lawn under the trees, timber boards outside that
      let rr = length(p.xz - bubbleC().xz);
      let board = mix(vec3f(0.55, 0.42, 0.28), vec3f(0.62, 0.48, 0.3), step(0.5, fract(p.x * 0.5)));
      let paving = vec3f(0.5, 0.47, 0.42) * (0.85 + 0.3 * hsh(i32(floor(p.x * 0.8)), i32(floor(p.z * 0.8)), 713));
      let lawn = vec3f(0.16, 0.36, 0.1) * (0.8 + 0.4 * vnoise(p.xz * 1.3, 714));
      s.alb = select(select(board, lawn, rr < 66.0), paving, rr < 44.0);
      s.spec = select(0.3, 0.1, rr < 66.0 && rr > 44.0);
    }
    case 72: {
      // warm stucco, open windows lit gold, balconies
      let fu = select(p.x, p.z, abs(n.x) > abs(n.z));
      let win = step(0.55, fract(fu / 3.0)) * step(0.4, fract(p.y / 3.2)) * step(abs(n.y), 0.5);
      s.alb = mix(vec3f(0.85, 0.66, 0.5), vec3f(0.95, 0.85, 0.7), hsh(i32(floor(fu / 20.0)), i32(floor(p.y / 30.0)), 711));
      s.emi = vec3f(1.0, 0.78, 0.45) * win * (0.3 + 1.4 * u.windows);
      s.spec = 0.2;
    }
    case 73: { s.alb = vec3f(0.12, 0.42, 0.1) * (0.8 + 0.4 * vnoise(p.xz * 0.8, 712)); s.trans = 0.4; }
    case 74: { s.alb = vec3f(0.3, 0.3, 0.32); s.spec = 0.8; }
    case 75: { s.alb = vec3f(0.2); s.emi = mix(vec3f(1.0, 0.72, 0.38), hue3(fract(floor(atan2(p.z - bubbleC().z, p.x - bubbleC().x) / 0.09817) * 0.37)), 0.35) * 3.0; }
    case 64: {
      // the tube structure: bronze-green paint in the old style, a brass band under each drum, rivets, rust at the base
      s.alb = mix(vec3f(0.16, 0.26, 0.22), vec3f(0.3, 0.2, 0.12), 0.5 * smoothstep(3.0, 0.0, p.y) * vnoise(p.xz * 3.0 + vec2f(p.y), 580));
      s.spec = 0.5;
      s.refl = 0.05;
      if (abs(p.y - (TUBE_Y - 2.35)) < 0.18) { s.alb = vec3f(0.62, 0.48, 0.22); s.spec = 0.9; s.refl = 0.2; }
      if (abs(p.y - (TUBE_Y + 2.1)) < 0.12) { s.emi = vec3f(0.35, 0.85, 1.0) * (0.15 + 1.2 * u.windows); }
    }
    case 65: {
      // a station: glazed drum, lit inside, a band of lettering (TUBE) round it
      let a = atan2(p.z - round(p.z / CS) * CS, p.x - round(p.x / CS) * CS);
      let lit = step(0.18, fract(a * 6.0));
      s.alb = vec3f(0.04, 0.06, 0.07);
      s.refl = 0.25;
      s.spec = 1.0;
      s.emi = vec3f(1.0, 0.82, 0.55) * lit * (0.2 + 1.3 * u.windows) * step(abs(p.y - TUBE_Y - 0.6), 2.4);
      if (abs(p.y - (TUBE_Y + 3.4)) < 0.9) {
        let txt = neonText(94u, vec2f(fract(a / 6.2831853 * 3.0) * 24.0 - 4.0, (TUBE_Y + 4.1 - p.y) / 0.2), false);
        s.emi = vec3f(0.3, 0.9, 1.0) * (0.15 + txt * 2.5) * (0.4 + u.windows);
      }
    }
    case 66: {
      // the lift shaft: glass round a lit car that rides up and down
      s.alb = vec3f(0.05, 0.07, 0.08);
      s.refl = 0.35;
      let car = abs(p.y - (TUBE_Y - 4.0) * (0.5 + 0.5 * sin(u.time * 0.3 + p.x * 0.01)));
      s.emi = vec3f(1.0, 0.85, 0.6) * (0.08 + 1.4 * step(car, 1.2)) * (0.3 + u.windows);
    }
    case 57: {
      // the fab's metal: corrugated sheds and the tower's braced faces, stained
      let fu = select(p.x, p.z, abs(n.x) > abs(n.z));
      let cor = 0.5 + 0.5 * sin(fu * 6.0);
      let brace = step(abs(abs(fract(fu / 8.0 + p.y / 8.0) - 0.5) - 0.25), 0.03) + step(abs(abs(fract(fu / 8.0 - p.y / 8.0) - 0.5) - 0.25), 0.03);
      s.alb = mix(vec3f(0.36, 0.38, 0.38), vec3f(0.3, 0.2, 0.12), 0.35 * vnoise(vec2f(fu, p.y) * 0.1, 570)) * (0.85 + 0.15 * cor) * (1.0 - 0.4 * min(brace, 1.0) * step(28.0, p.y));
      s.spec = 0.5;
      s.refl = 0.05;
      // lit roof glazing along the sawtooth, and hazard lights up the tower
      if (n.y > 0.3 && n.y < 0.95 && p.y < 30.0) { s.alb = vec3f(0.12, 0.14, 0.16); s.refl = 0.3; s.emi = vec3f(1.0, 0.85, 0.6) * 1.2 * u.windows; }
      if (p.y > 30.0 && fract(p.y / 20.0) < 0.03) { s.emi = vec3f(1.0, 0.1, 0.05) * 3.0 * step(0.5, fract(u.time * 0.8)); }
    }
    case 58: {
      s.alb = vec3f(0.9, 0.85, 1.0);
      s.emi = vec3f(1.0, 0.9, 1.0) * (6.0 + 2.0 * sin(u.time * 30.0));
    }
    case 59: {
      s.alb = vec3f(0.5, 0.48, 0.45) * (0.8 + 0.2 * vnoise(vec2f(atan2(p.z, p.x) * 20.0, p.y * 0.3), 571));
      s.spec = 0.1;
    }
    case 63: {
      // finished pods: white shells with one round window each, a shipping number, some still in wrap
      let id = hsh(i32(floor(p.x / 3.0)), i32(floor(p.z / 5.2)) * 7 + i32(floor(p.y / 2.4)), 572);
      s.alb = mix(vec3f(0.82, 0.8, 0.76), vec3f(0.35, 0.55, 0.6), step(0.8, id));
      let fz = fract(p.z / 5.2) - 0.5;
      let fy = fract((p.y - 1.2) / 2.4 + 0.5) - 0.5;
      if (abs(n.z) < 0.5 && length(vec2f(fz * 5.2, fy * 2.4)) < 0.5) { s.alb = vec3f(0.05, 0.08, 0.1); s.refl = 0.3; }
      s.spec = 0.6;
    }
    case 70: {
      // skyboats: envelope fabric by kind, painted hulls, lit windows, emigration screens, running lights
      var si = 0;
      var sd = 1e5;
      for (var k = 0; k < 8; k++) { if (ev.ship[k].w > 0.0) { let d = abs(shipSDF(p, k).x); if (d < sd) { sd = d; si = k; } } }
      let sp = shipSDF(p, si);
      let q = shipLocal(p, si);
      let kind = i32(ev.shipDir[si].w + 0.5);
      let part = i32(sp.y + 0.5);
      let hs = hsh(si, kind, 700);
      let nav = select(vec3f(0.1, 1.0, 0.2), vec3f(1.0, 0.08, 0.05), q.x < 0.0);
      s.spec = 0.4;
      s.rough = 0.1;
      switch part {
        case 0: {
          // envelopes: silvered for cargo, patched colour for skyboats and gliders, with panel seams
          var env = vec3f(0.62, 0.63, 0.66);
          if (kind == 1) { env = mix(vec3f(0.62, 0.22, 0.12), vec3f(0.85, 0.72, 0.45), step(0.5, fract(q.z * 4.0 + hs))); }
          if (kind == 2) { env = mix(neonColor(hs), vec3f(0.9, 0.88, 0.8), step(0.5, fract(atan2(q.x, q.z) * 1.91 + 0.25))); }
          if (kind == 3) { env = vec3f(0.12, 0.2, 0.42); }
          s.alb = env * (1.0 - 0.2 * step(0.94, fract(q.z * 14.0)));
          s.refl = 0.06 + 0.3 * pow(1.0 - ndv, 4.0);
          // a nav light each side at the widest point, and a white one at the tail
          if (abs(abs(q.x) - 0.22) < 0.03 && abs(q.y) < 0.03 && abs(q.z) < 0.04) { s.emi = nav * (1.0 + 3.0 * step(0.5, fract(u.time * 0.9 + hs))); }
        }
        case 1: { s.alb = mix(vec3f(0.18, 0.12, 0.08), vec3f(0.35, 0.36, 0.38), f32(kind != 1)); s.spec = 0.6; s.refl = 0.1; }
        case 2: {
          s.alb = vec3f(0.03);
          s.refl = 0.3;
          let wl = step(0.4, fract(q.z * 40.0)) * step(0.35, hsh(i32(floor(q.z * 40.0)), si, 701));
          s.emi = vec3f(1.0, 0.78, 0.45) * wl * (0.3 + 1.2 * u.windows);
        }
        case 3: {
          // the ad dirigible's screens: the emigration campaign, a line at a time
          let bslot = i32(floor(u.time / 5.0)) + si;
          let pk = 7 + ((bslot / 3) % 3 + 3) % 3;
          let L = posterLine(pk, ((bslot % 3) + 3) % 3);
          let uv = vec2f(q.z * sign(q.x) / 0.55, q.y / 0.11);
          let txt = lineText(L, vec2f(uv.x * 40.0, (0.5 - uv.y) * 8.0 + 0.5));
          s.alb = vec3f(0.02);
          s.refl = 0.04;
          s.emi = posterLook(pk, uv, txt) * (1.3 + 1.0 * u.windows);
        }
        case 4: { s.alb = vec3f(0.08); s.spec = 0.8; s.emi = vec3f(0.3, 0.7, 1.0) * 0.4 * (0.4 + u.windows) * step(0.6, fract(u.time * 7.0 + q.x * 3.0)); }
        default: { s.alb = mix(vec3f(0.7, 0.3, 0.1), vec3f(0.15, 0.35, 0.6), step(0.5, hsh(i32(floor(q.z * 6.0)), si, 702))); s.spec = 0.3; }
      }
    }
    case 29: {
      let K = ev.blimp;
      let fw = normalize(ev.blimpDir.xyz);
      let rt = normalize(cross(fw, vec3f(0.0, 1.0, 0.0)));
      let q0 = p - K.xyz;
      let q = vec3f(dot(q0, rt), q0.y, dot(q0, fw)) / K.w;
      s.alb = vec3f(0.6, 0.62, 0.66) * (1.0 - 0.25 * step(0.93, fract(q.z * 9.0)));
      s.spec = 1.0;
      s.refl = 0.08 + 0.4 * pow(1.0 - ndv, 4.0);
      if (abs(q.y) < 0.14 && abs(q.z + 0.05) < 0.52 && abs(q.x) > 0.12) {
        let sgnS = select(-1.0, 1.0, q.x > 0.0);
        let sw = 1.04 * K.w;
        let sh = 0.28 * K.w;
        let sx = ((q.z + 0.05) * sgnS + 0.52) * K.w;
        let sy = (0.14 - q.y) * K.w;
        // the emigration campaign, a line at a time
        let bslot = i32(floor(u.time / 4.0));
        let L = posterLine(7 + ((bslot / 3) % 3), bslot % 3);
        let pxm = min(sw / 78.0, sh / 10.0);
        let txt = lineText(L, vec2f((sx - sw * 0.5) / pxm, (sy - (sh - 7.0 * pxm) * 0.5) / pxm));
        let bg = 0.5 + 0.5 * cos(6.2831 * (vec3f(0.0, 0.33, 0.67) + u.time * 0.05 + sx / sw * 0.4));
        s.alb = vec3f(0.02);
        s.refl = 0.03;
        s.emi = (bg * 0.35 + vec3f(1.0) * txt * 1.5) * (0.8 + 0.2 * sin(sy * 9.0 - u.time * 4.0)) * (0.5 + u.windows);
      }
      if (q.y < -0.27) { s.emi += vec3f(1.0, 0.85, 0.6) * step(0.5, fract(q.z * 40.0)) * 0.8 * (0.2 + u.windows); }
    }
    case 30: {
      if (p.y < 2.05) { s.alb = vec3f(0.42, 0.4, 0.37); }
      else {
        let ly = fract((p.y - 2.0) / 7.6) * 7.6;
        let fu = fract(select(p.x, p.z, abs(n.x) > 0.5) / 1.4);
        let win = step(1.2, ly) * step(ly, 4.4) * step(0.2, fu) * step(fu, 0.8);
        s.alb = mix(vec3f(0.55, 0.06, 0.04), vec3f(0.9, 0.8, 0.6), win * 0.6);
        s.emi = vec3f(1.0, 0.72, 0.4) * win * (0.1 + 0.9 * u.windows) * 0.8;
      }
      s.spec = 0.5;
    }
    case 31: {
      s.alb = vec3f(0.08, 0.12, 0.1);
      s.spec = 0.6;
      s.refl = 0.05 + 0.3 * pow(1.0 - ndv, 4.0);
      let rr = max(abs(lq.x), abs(lq.y));
      let w = 5.6 - clamp(floor((p.y - 2.0) / 7.6), 0.0, 4.0) * 0.75;
      let lamps = step(0.7, fract((abs(lq.x) + abs(lq.y)) / 1.3));
      s.emi = vec3f(1.0, 0.18, 0.08) * step(w + 1.9, rr) * lamps * (0.2 + 1.4 * u.windows);
    }
    case 32: {
      let alongW = select(lq.y, lq.x, abs(lq.y) < 1.8);
      let rib = step(0.88, fract(alongW / 2.2));
      s.alb = mix(vec3f(0.06, 0.08, 0.1), vec3f(0.7, 0.72, 0.75), rib);
      s.refl = (0.2 + 0.7 * pow(1.0 - ndv, 4.0)) * (1.0 - rib * 0.8);
      s.spec = 1.5;
      s.emi = vec3f(0.55, 0.85, 1.0) * (1.0 - rib) * 0.25 * (0.2 + u.windows);
    }
    case 34: {
      let band = step(0.5, fract(p.y / 18.0));
      s.alb = mix(vec3f(0.75, 0.12, 0.06), vec3f(0.85, 0.85, 0.83), band);
      s.spec = 0.6;
      s.emi = vec3f(1.0, 0.55, 0.2) * 0.25 * u.windows * (0.5 + 0.5 * band);
      if (p.y > 128.0) { s.emi = vec3f(1.0, 0.1, 0.05) * step(0.5, fract(u.time * 0.8)) * 3.0; }
    }
    case 35: {
      s.alb = vec3f(0.08, 0.09, 0.1);
      s.refl = 0.2 + 0.6 * pow(1.0 - ndv, 4.0);
      s.spec = 1.0;
      s.emi = vec3f(1.0, 0.85, 0.65) * step(0.3, fract(p.y * 0.8)) * (0.1 + 0.8 * u.windows);
    }
    case 36: {
      let cfi = cellHead(ci);
      s.alb = mix(vec3f(0.3, 0.29, 0.28), vec3f(0.36, 0.24, 0.16), vnoise(p.xz * 0.3 + vec2f(p.y * 0.2), 71));
      s.spec = 0.4;
      if (cfi.typ == 9) {
        let band = step(cfi.h * 0.55, p.y) * step(abs(n.y), 0.5);
        s.alb = mix(s.alb, select(vec3f(0.62, 0.1, 0.07), vec3f(0.85, 0.85, 0.82), fract(p.y / 12.0) > 0.5), band);
        s.emi = vec3f(1.0, 0.08, 0.05) * step(cfi.h - 1.5, p.y) * step(0.5, fract(u.time * 0.7)) * 4.0 + vec3f(1.0, 0.5, 0.15) * 0.06 * u.windows;
      } else if (cfi.typ == 10) {
        s.alb = vec3f(0.55, 0.56, 0.58);
        s.emi = vec3f(0.9, 0.95, 1.0) * step(0.9, abs(n.x)) * step(p.y, 6.0) * 0.5 * u.windows;
      }
    }
    case 37: {
      let fk = 0.8 + 0.2 * sin(u.time * 17.0 + p.y * 2.0);
      s.alb = vec3f(0.0);
      s.emi = mix(vec3f(1.0, 0.22, 0.02), vec3f(1.0, 0.7, 0.25), clamp(ndv * 1.3, 0.0, 1.0)) * 2.2 * fk;
    }
    case 38: {
      s.alb = vec3f(0.82, 0.83, 0.86);
      s.trans = 0.6;
      s.spec = 0.0;
      s.emi = vec3f(1.0, 0.6, 0.35) * 0.06 * u.windows;
    }
    case 39: {
      // 1970s paperback spacecraft: cream hulls, bold bands, panel lines, glowing engines
      let cfs = cellFull(ci);
      let pal = hsh(cfs.seed, 3, 73);
      let bandA = 0.5 + 0.5 * cos(6.2831 * (vec3f(0.0, 0.33, 0.67) + pal));
      let panel = step(0.94, fract(p.y / 1.7)) + step(0.96, fract(facU / 2.3));
      var hull = vec3f(0.86, 0.83, 0.76);
      hull = mix(hull, bandA * 0.9, step(0.6, fract(p.y / 5.0 + pal)) * step(fract(p.y / 5.0 + pal), 0.8));
      hull = mix(hull, select(vec3f(0.95, 0.7, 0.05), vec3f(0.05), fract((facU + p.y) * 0.8) > 0.5), step(abs(p.y - 9.5 - 3.0), 0.35) * step(cfs.v, 0.63) * step(0.43, cfs.v));
      s.alb = hull * (1.0 - 0.25 * min(panel, 1.0));
      s.spec = 0.9;
      s.refl = 0.05 + 0.3 * fres;
      if (cfs.v > 0.43 && cfs.v < 0.63 && lq.x < -8.8) { s.emi = vec3f(0.4, 0.75, 1.0) * 3.0; }
      if (cfs.v >= 0.9) { s.alb = vec3f(0.05, 0.07, 0.09); s.refl = 0.3 + 0.6 * fres; s.emi = vec3f(0.6, 0.9, 1.0) * 0.4 * u.windows; }
    }
    case 40: {
      let cfp = cellHead(ci);
      s.alb = vec3f(0.55, 0.54, 0.5) * (0.85 + 0.15 * vnoise(p.xz * 0.5, 74));
      let ring = abs(length(lq) - 6.0);
      s.alb = mix(s.alb, vec3f(0.9, 0.7, 0.05), step(ring, 0.25));
      let edge = step(9.0, max(abs(lq.x), abs(lq.y))) * step(0.5, fract((lq.x + lq.y) * 0.25));
      s.emi = vec3f(0.3, 0.55, 1.0) * edge * 1.5 * u.windows + vec3f(1.0, 0.8, 0.5) * step(ring, 0.25) * 0.15 * u.windows;
      s.spec = 0.2;
      if (cfp.typ != 10) { s.emi = vec3f(0.0); }
    }
    case 41: {
      let cfq = cellHead(ci);
      let band = step(0.72, fract(p.y / 4.0));
      s.alb = mix(vec3f(0.12, 0.1, 0.07), vec3f(0.5, 0.38, 0.18), band * 0.4);
      s.spec = 0.9;
      s.refl = 0.1 + 0.5 * fres;
      s.emi = vec3f(1.0, 0.72, 0.38) * band * step(0.35, hsh(i32(floor(facU / 3.0)), i32(floor(p.y / 4.0)), 75)) * u.windows * 0.9;
      s.emi += vec3f(1.0, 0.3, 0.1) * step(cfq.h - 3.0, p.y) * 3.0 * (0.4 + 0.6 * u.windows);
    }
    case 43: {
      let fk = 0.85 + 0.15 * sin(u.time * 3.0 + p.x * 1.7);
      let cap = step(0.25, abs(fract(p.y * 2.78) - 0.5) * 2.0 - 0.6);
      s.alb = mix(vec3f(0.7, 0.1, 0.05), vec3f(0.8, 0.6, 0.15), cap);
      s.emi = vec3f(1.0, 0.25, 0.08) * (0.3 + 1.8 * u.windows) * fk * (1.0 - cap);
      s.trans = 0.5;
    }
    case 55: {
      // the Hive's shell: patched panels in odd tints, rust streaks, and a grid of round pod windows, each one lit
      // by whatever its sleeper's headset is showing
      let q = hiveQ(p);
      let fu = select(q.x, q.z, abs(n.x) > abs(n.z));
      let pc = floor(vec2f(fu / 9.0, q.y / 6.5));
      let ph = hsh(i32(pc.x), i32(pc.y), 560);
      var tint = mix(vec3f(0.2, 0.19, 0.17), vec3f(0.3, 0.24, 0.18), ph);
      if (ph > 0.82) { tint = vec3f(0.34, 0.16, 0.1); }
      if (ph < 0.1) { tint = vec3f(0.16, 0.2, 0.2); }
      let seam = sstepJ(0.12, 0.0, min(abs(fract(fu / 9.0) - 0.5), abs(fract(q.y / 6.5) - 0.5)) - 0.46);
      let rust = vnoise(vec2f(fu * 0.08, q.y * 0.02), 561) * sstepJ(0.0, 1.0, vnoise(vec2f(fu * 0.3, 1.0), 562));
      s.alb = mix(tint * (0.8 + 0.3 * vnoise(vec2f(fu, q.y) * 0.4, 563)), vec3f(0.08, 0.05, 0.03), seam * 0.8 + rust * 0.5 * detail);
      s.spec = 0.15;
      s.rough = 0.8;
      if (abs(n.y) < 0.5) {
        let wc = vec2f(fu / 4.0, q.y / 4.2);
        let wi = floor(wc);
        let r = length(fract(wc) - 0.5);
        let occ = step(0.62, hsh(i32(wi.x), i32(wi.y), 564));
        let hue = hsh(i32(wi.x), i32(wi.y) + i32(floor(u.time * 0.7 + hsh(i32(wi.y), i32(wi.x), 565) * 5.0)), 566);
        let glow = mix(vec3f(0.3, 0.5, 1.0), select(vec3f(1.0, 0.25, 0.7), vec3f(0.3, 1.0, 0.6), hue > 0.7), step(0.55, hue));
        let win = sstepJ(0.3, 0.24, r) * step(8.0, q.y);
        s.alb = mix(s.alb, vec3f(0.03), win * (1.0 - occ) * 0.6);
        s.emi = glow * win * occ * (0.15 + 0.7 * u.windows) * (0.8 + 0.2 * sin(u.time * 9.0 + hue * 40.0)) * mix(1.0, 0.4, 1.0 - detail);
      }
    }
    case 56: {
      // the Hive's boards: the tokes trade in flashing colours, three lines of it, cycling
      let hb = hiveBoard(hiveQ(p));
      let bc = hiveBoardC(i32(hb.w));
      let uv = hb.yz / bc.zw;
      // glyph size: three lines of up to eleven characters, as large as the board allows
      let gu = min(bc.z * 2.0 / 74.0, bc.w * 2.0 / 42.0);
      let slot = i32(floor(u.time / 7.0)) + i32(hb.w);
      let pk = array<i32, 4>(4, 5, 10, 6)[((slot % 4) + 4) % 4];
      let fl2 = step(0.5, fract(u.time * 1.3 + hb.w * 0.37));
      var txt = 0.0;
      for (var l = 0; l < 3; l++) {
        let qy = 17.0 - f32(l) * 13.0 - hb.z / gu;
        if (qy >= 0.0 && qy < 8.0) { txt = max(txt, lineText(posterLine(pk, l), vec2f(hb.y / gu, qy))); }
      }
      let bg = mix(vec3f(0.45, 0.0, 0.3), vec3f(0.9, 0.55, 0.0), fl2 * step(0.0, sin(uv.x * 3.0 + u.time * 2.0)));
      let edge = step(0.94, max(abs(uv.x), abs(uv.y)));
      let chase = step(0.5, fract((uv.x + uv.y) * 12.0 - u.time * 4.0)) * edge;
      s.alb = vec3f(0.02);
      s.spec = 0.5;
      s.refl = 0.05;
      s.emi = (bg * 0.6 * (1.0 - edge) + mix(vec3f(1.0, 0.95, 0.3), vec3f(0.2, 1.0, 1.0), fl2) * txt * 1.6 + vec3f(1.0, 0.9, 0.5) * chase)
        * (1.2 + 1.3 * u.windows) * mix(0.6, 1.0, detail);
      if (pk == 10) { s.emi = posterLook(pk, uv, txt) * (0.9 + 0.8 * u.windows) * mix(0.6, 1.0, detail); }
    }
    case 62: {
      // the megatower's screen: one of four kinds of ad, changing every dozen seconds or so
      let bb = vec2i(floor(p.xz / BIG));
      let bw = vec2i(wrapN(bb.x, 96), wrapN(bb.y, 96));
      let gl = p.xz - (vec2f(bb) + 0.5) * BIG;
      let gh = 150.0 + 110.0 * hsh(bw.x, bw.y, 21);
      let sd = adScreenUV(vec3f(gl.x, p.y, gl.y), gh, hsh(bw.x, bw.y, 22), hsh(bw.x, bw.y, 23));
      let uv = sd.yz;
      let slot = floor(u.time / 12.0 + hsh(bw.x, bw.y, 190) * 7.0 + sd.w * 3.0);
      let kind = i32(hsh(bw.x * 7 + i32(slot), bw.y, 191) * 7.0);
      let h1 = hsh(bw.x, i32(slot), 192);
      let ca = hue3(h1);
      let cb = hue3(fract(h1 + 0.35 + 0.3 * hsh(bw.y, i32(slot), 193)));
      var e = vec3f(0.0);
      if (kind >= 2) {
        // a poster: centred lines of words in glyph units, square glyphs across the 28 x 40 m screen
        let pk = posterPick(hsh(bw.y * 5 + i32(slot), bw.x, 198));
        let nl = select(3, 4, pk <= 1);
        let gx = uv.x * 50.0;
        let gy = uv.y * 50.0 * (20.0 / 14.0);
        let top = f32(nl) * 6.5;
        var txt = 0.0;
        for (var l = 0; l < 4; l++) {
          if (l >= nl) { break; }
          let qy = top - f32(l) * 13.0 - gy;
          if (qy >= 0.0 && qy < 8.0) { txt = max(txt, lineText(posterLine(pk, l), vec2f(gx, qy))); }
        }
        e = posterLook(pk, uv, txt);
      } else {
      switch kind {
        case 0: {
          e = mix(ca, cb, sstepJ(-0.6, 0.6, uv.x * 0.7 + uv.y * 0.5 + sin(u.time * 0.4) * 0.5));
          e += vec3f(1.0) * sstepJ(0.42, 0.38, length(uv - vec2f(0.3 * sin(u.time * 0.3), 0.1))) * (0.6 + 0.4 * sin(u.time * 2.0));
        }
        case 1: {
          let g = floor((uv + 1.0) * vec2f(4.0, 3.0));
          let on = step(0.45, hsh(i32(g.x) + i32(slot) * 7, i32(g.y) + i32(floor(u.time * 1.5)), 194));
          let inner = step(0.12, fract((uv.x + 1.0) * 4.0)) * step(0.12, fract((uv.y + 1.0) * 3.0));
          e = mix(ca * 0.15, cb, on * inner);
        }
        case 2: {
          let row = floor((uv.y + 1.0) * 6.0);
          let xs = (uv.x + 1.0) * 10.0 + u.time * (1.5 + hsh(i32(row), i32(slot), 195) * 2.0);
          let dash = step(0.3, fract(xs * 0.9)) * step(0.35, hsh(i32(floor(xs * 0.9)), i32(row) + i32(slot) * 13, 196));
          e = mix(ca * 0.1, mix(ca, vec3f(1.0), 0.4), dash * step(0.2, fract((uv.y + 1.0) * 6.0)));
        }
        default: {
          let r = length(uv * vec2f(1.4, 1.0));
          e = mix(ca, cb, 0.5 + 0.5 * sin(r * 14.0 - u.time * 3.0)) * sstepJ(1.3, 0.2, r);
        }
      }
      }
      // scanlines, and now and then a glitch
      let glitch = step(0.985, hsh(i32(floor(u.time * 8.0)), bw.x + bw.y * 17, 197));
      e *= (0.85 + 0.15 * sin((uv.y + 1.0) * 120.0)) * (1.0 - 0.6 * glitch * step(0.5, fract(uv.y * 3.0 + u.time)));
      s.alb = vec3f(0.02);
      s.spec = 0.6;
      s.refl = 0.08;
      s.emi = e * (1.6 + 1.2 * u.windows);
    }
    case 60: {
      // the hall's dome: dark glass panels between pale ribs, warm light from inside after dark
      let gl = p.xz - (floor(p.xz / BIG) + 0.5) * BIG;
      let e = vec3f(gl.x, p.y - 14.0, gl.y);
      let a = atan2(e.z, e.x) / 6.2831853 * 32.0;
      let el = asin(clamp(e.y / 44.0, 0.0, 1.0)) / 1.5708 * 9.0;
      let rib = max(sstepJ(0.08, 0.0, abs(fract(a) - 0.5) - 0.42), sstepJ(0.08, 0.0, abs(fract(el) - 0.5) - 0.42));
      s.alb = mix(vec3f(0.04, 0.05, 0.06), vec3f(0.62, 0.58, 0.52), rib);
      s.spec = 0.8;
      s.refl = 0.3 * (1.0 - rib);
      s.rough = 0.04;
      s.emi = vec3f(1.0, 0.72, 0.42) * (1.0 - rib) * (0.08 + 0.9 * u.windows) * (0.6 + 0.4 * vnoise(vec2f(a, el) * 1.3, 151));
    }
    case 61: {
      s.alb = vec3f(0.7, 0.62, 0.45);
      s.spec = 0.9;
      s.emi = vec3f(1.0, 0.8, 0.5) * 0.4 * u.windows;
    }
    case 45: {
      let cfe = cellFull(ci);
      let eg = cfe.egg & 63;
      var q = vec3f(lq.x, p.y - cfe.h, lq.y);
      if (cfe.typ == 1) { q = vec3f(lq.x - cfe.off.x, p.y - cfe.h * select(1.0, 1.06, cfe.v < 0.4), lq.y - cfe.off.y); }
      if (cfe.typ == 0) { q = vec3f(lq.x, p.y, lq.y); }
      let hv = hsh(cfe.seed, 9, 76);
      s.spec = 0.3;
      switch eg {
        case 1: {
          s.alb = select(vec3f(0.9, 0.9, 0.88), vec3f(0.75, 0.1, 0.08), fract(q.y / 5.0) > 0.5 && q.y < 21.8);
          if (q.y > 22.2 && q.y < 24.8) { s.alb = vec3f(0.2); s.emi = vec3f(1.0, 0.9, 0.6) * (0.5 + 3.0 * u.windows); }
          if (q.y >= 24.8) { s.alb = vec3f(0.6, 0.08, 0.05); }
          if (q.y < 4.2 && length(q.xz) > 2.7) { s.alb = vec3f(0.85, 0.83, 0.78); }
        }
        case 2, 3: { s.alb = mix(vec3f(0.38, 0.34, 0.3), vec3f(0.2, 0.28, 0.12), 0.35 * vnoise(p.xz * 2.0 + vec2f(p.y), 77) * step(0.5, n.y + 0.4)); }
        case 4, 20: {
          s.alb = vec3f(0.93, 0.94, 0.97);
          if (eg == 4) {
            if (q.x > 0.45 && abs(q.y - 4.23) < 0.12) { s.alb = vec3f(0.95, 0.45, 0.05); }
            if (q.y > 4.66) { s.alb = vec3f(0.03); }
            if (abs(q.y - 3.62) < 0.12) { s.alb = vec3f(0.8, 0.1, 0.1); }
            if (q.x > 0.3 && abs(q.y - 4.45) < 0.08 && abs(abs(q.z) - 0.22) < 0.08) { s.alb = vec3f(0.02); }
          } else {
            s.alb *= 1.0 - 0.15 * step(0.9, fract(q.y * 1.4)) - 0.15 * step(0.92, fract(atan2(q.z, q.x) * 3.0));
          }
          s.spec = 0.5;
        }
        case 5: {
          if (length(q.xz - vec2f(6.0, 2.0)) < 4.6) { s.alb = select(vec3f(0.92, 0.9, 0.85), vec3f(0.9, 0.38, 0.08), fract(atan2(q.z - 2.0, q.x - 6.0) / 6.2831 * 12.0) > 0.5); s.trans = 0.4; }
          else { s.alb = mix(vec3f(0.85, 0.62, 0.2), vec3f(0.2), step(1.3, q.y)); s.spec = 1.2; s.emi = vec3f(0.3, 1.0, 0.5) * step(1.9, q.y) * step(0.5, fract(u.time * 0.5)) * 3.0; }
        }
        case 6: {
          s.alb = vec3f(0.7, 0.72, 0.76);
          s.spec = 1.0;
          if (q.y < 15.1) {
            s.alb = vec3f(0.02);
            s.emi = vec3f(0.3, 1.0, 0.6) * 0.8;
            if (q.y > 4.5 && q.y < 8.5 && length(q.xz) < 1.6) { s.emi = vec3f(0.0); s.alb = select(vec3f(0.95), vec3f(0.03), vnoise(q.xz * 3.0 + vec2f(q.y * 2.0), 78) > 0.55); }
          }
          if (abs(q.y - 16.0) < 0.35 && length(q.xz) > 4.8) { s.emi = (0.5 + 0.5 * cos(6.2831 * (vec3f(0.0, 0.33, 0.67) + atan2(q.z, q.x) + u.time))) * 2.5; }
        }
        case 7: {
          s.alb = select(select(vec3f(0.12, 0.25, 0.08), vec3f(0.32, 0.22, 0.12), length(q.xz) < 1.05 && q.y < 11.0), vec3f(0.5, 0.36, 0.2), q.y > 7.8 && q.y < 12.2 && length(q.xz) < 3.3 && length(q.xz) > 1.05);
          if (abs(q.y - 9.5) < 0.4 && abs(q.x - 2.2) < 0.1 && abs(q.z - 0.6) < 0.5) { s.emi = vec3f(1.0, 0.7, 0.35) * (0.3 + 1.5 * u.windows); }
        }
        case 8: { s.alb = vec3f(0.62, 0.47, 0.3); }
        case 9: { s.alb = select(vec3f(0.95, 0.45, 0.55), vec3f(0.02), q.y > 1.8 && fract(q.x) > 0.95); }
        case 10: { s.alb = vec3f(0.1, 0.2, 0.12); s.spec = 0.6; }
        case 11: { s.alb = mix(vec3f(0.14, 0.17, 0.22), vec3f(0.7, 0.72, 0.74), step(n.y, -0.3)); s.spec = 0.8; }
        case 15: { s.alb = vec3f(0.86, 0.86, 0.85); }
        case 17: {
          s.alb = vec3f(0.4, 0.26, 0.14) * (0.85 + 0.15 * step(0.5, fract(q.y * 3.0)));
          if (q.y > 3.3 && abs(q.z) > 0.2) { s.alb = vec3f(0.12, 0.1, 0.1); }
          if (q.y > 6.0) { s.alb = vec3f(0.6, 0.6, 0.62); s.trans = 0.5; }
          if (abs(q.x - 3.2) < 0.1 && abs(q.y - 1.6) < 0.5 && abs(q.z) < 0.7) { s.emi = vec3f(1.0, 0.65, 0.3) * (0.3 + 1.6 * u.windows); }
        }
        case 18: { s.alb = vec3f(0.25, 0.17, 0.1); }
        case 19: { s.alb = vec3f(0.8, 0.65, 0.45) * (0.9 + 0.1 * vnoise(q.xz * 3.0, 79)); }
        case 21: {
          s.alb = select(select(vec3f(0.04), vec3f(0.85, 0.45, 0.12), hv > 0.4), vec3f(0.9, 0.88, 0.84), hv > 0.75);
          if (q.y > 1.2 && q.x > 0.3 && abs(abs(q.z) - 0.1) < 0.06) { s.emi = vec3f(0.5, 1.0, 0.3) * 2.0 * u.windows; }
        }
        case 22: {
          let icing = step(0.1, n.z * sign(q.z)) * step(0.0, abs(q.z) - 0.2);
          let sprinkle = step(0.93, hsh(i32(floor(q.x * 5.0)), i32(floor(q.y * 5.0)), 80));
          s.alb = select(vec3f(0.3, 0.3, 0.3), mix(vec3f(0.78, 0.5, 0.24), mix(vec3f(0.95, 0.45, 0.65), 0.5 + 0.5 * cos(6.2831 * (vec3f(0.0, 0.33, 0.67) + hv * 7.0 + q.x)), sprinkle), icing), q.y > 3.4);
          s.emi = s.alb * 0.25 * u.windows;
        }
        case 23: { s.alb = vec3f(0.72, 0.74, 0.78); s.spec = 1.0; if (abs(q.y - 1.6) < 0.2) { s.emi = vec3f(0.3, 1.0, 0.8) * step(0.5, fract(atan2(q.z, q.x) * 1.6 + u.time)) * 2.0; } }
        case 24: { s.alb = mix(vec3f(0.06, 0.2, 0.05), vec3f(0.14, 0.32, 0.08), vnoise(p.xz * 2.0 + vec2f(p.y * 2.0), 81)); }
        case 25: {
          s.alb = vec3f(0.88, 0.88, 0.86);
          if (q.y > 7.9 && q.y < 13.5 && abs(q.x) < 1.7) { s.alb = vec3f(0.75, 0.1, 0.08); }
          if (q.y > 2.0 && q.y < 8.2) { s.alb = vec3f(0.1, 0.2, 0.55); }
          if (q.y > 14.6 && q.y < 15.2 && q.x > 0.9) { s.alb = vec3f(0.95, 0.8, 0.1); s.emi = vec3f(1.0, 0.85, 0.2) * (0.3 + 2.0 * u.windows); }
          s.spec = 0.8;
        }
        case 26: { s.alb = select(vec3f(0.98, 0.82, 0.1), vec3f(0.95, 0.45, 0.05), length(q.xz - vec2f(0.0)) > 0.0 && p.y > 1.55 && p.y < 1.9 && hv > 2.0); s.spec = 0.8; }
        default: { s.alb = vec3f(0.6); }
      }
    }
    case 47: {
      var bi = 0;
      var bd = 1e9;
      for (var i = 0; i < 3; i++) { let dd = length(p - ev.balloon[i].xyz); if (ev.balloon[i].w >= 0.0 && dd < bd) { bd = dd; bi = i; } }
      let b = ev.balloon[bi];
      let q = p - b.xyz;
      let gore = step(0.5, fract(atan2(q.z, q.x) / 6.2831 * 12.0));
      s.alb = mix(hue3(b.w), select(vec3f(0.95, 0.92, 0.85), hue3(b.w + 0.5), fract(b.w * 7.0) > 0.5), gore);
      if (q.y < -9.0) { s.alb = vec3f(0.3, 0.25, 0.2); }
      if (q.y < -12.7) { s.alb = vec3f(0.4, 0.26, 0.12); }
      s.trans = 0.4;
      s.spec = 0.2;
    }
    case 46: {
      s.alb = vec3f(0.93, 0.92, 0.88);
      s.emi = vec3f(1.0, 0.95, 0.85) * 0.35 * u.windows;
      s.spec = 0.3;
    }
    case 50, 51, 52, 53: {
      let fc = vec2i(floor(p.xz / CS));
      let b = textureLoad(ffBTex, wrapT(fc), 0);
      let style = i32(b.w + 0.5);
      let typ = style & 15;
      let zone = style >> 4;
      let hr = hsh(i32(floor(facU / 2.8)) + fc.x * 13, i32(floor(p.y / 3.6)) + fc.y * 7, 51);
      let lp2 = 0.08 + 0.3 * u.windows;
      let lit = mix(step(hr, lp2), lp2, sstepJ(1800.0, 4500.0, t));
      var base = vec3f(0.1, 0.11, 0.13);
      var wc = vec3f(1.0, 0.72, 0.45);
      switch typ {
        case 2: { base = vec3f(0.38, 0.33, 0.27); }
        case 3: { base = vec3f(0.32, 0.22, 0.48); wc = vec3f(0.8, 0.5, 1.0); }
        case 4, 5: { base = vec3f(0.07, 0.16, 0.06); wc = vec3f(0.0); }
        case 6: { base = vec3f(0.06, 0.08, 0.1); wc = vec3f(0.4, 0.9, 1.0); }
        case 8: { base = vec3f(0.2, 0.26, 0.2); }
        case 9: { base = vec3f(0.14, 0.12, 0.1); wc = vec3f(1.0, 0.45, 0.12); }
        case 10: { base = vec3f(0.62, 0.62, 0.6); wc = vec3f(0.8, 0.9, 1.0); }
        case 11: { base = vec3f(0.55, 0.12, 0.08); wc = vec3f(1.0, 0.3, 0.2); }
        case 13: { base = vec3f(0.2, 0.16, 0.08); wc = vec3f(1.0, 0.8, 0.4); }
        default: {}
      }
      if (zone == 1) { wc = mix(wc, vec3f(1.0, 0.3, 0.8), 0.4); }
      s.alb = base;
      s.emi = wc * lit * step(abs(n.y), 0.5) * u.windows * 0.9;
      s.spec = 0.3;
      s.refl = 0.05 + 0.3 * fres;
    }
    default: {
      let irid = 0.5 + 0.5 * cos(6.2831 * (vec3f(0.0, 0.33, 0.67) + (1.0 - ndv) * 0.9 + p.y * 0.003));
      let gc = glowColor(p);
      s.alb = vec3f(0.012, 0.016, 0.026);
      s.refl = 0.06 + 0.8 * pow(1.0 - ndv, 3.0);
      s.tint = mix(vec3f(1.0), mix(gc, irid, 0.5), 0.6);
      s.spec = 1.5;
      let band = pow(0.5 + 0.5 * sin(p.y * 0.16 + (p.x + p.z) * 0.04 - u.time * 0.8), 24.0);
      let core = ndv * ndv;
      let lvl = 0.03 + 0.2 * u.windows;
      var em = gc * mix(vec3f(1.0), irid, 0.3) * lvl * (0.35 + 0.65 * core) + gc * band * (0.25 + 0.9 * u.windows) * detail;
      if (mi == 6) { em *= 0.8; }
      if (mi == 9) { em = gc * (0.9 + 1.1 * u.windows) * mix(0.3, 1.0, detail); }
      s.emi = em + gc * pow(1.0 - ndv, 6.0) * (0.1 + 0.35 * u.windows);
    }
  }
  if ((mi == 1 || mi == 2) && abs(n.y) < 0.5) { facadeFx(&s, p, n, ci, lq, detail, pow(1.0 - ndv, 4.0)); }
  if (mi == 1 || mi == 2 || mi == 8 || mi == 10 || mi == 15 || mi == 13) {
    let dens = smoothstep(0.08, 0.55, forestF(wrapP(p.xz)));
    if (dens > 0.01 && abs(n.y) < 0.75) {
      let strand = vnoise(vec2f(facU * 1.3, 5.0), 20);
      let ivyH = dens * 26.0 * (0.3 + 1.1 * strand);
      let fall = 1.0 - smoothstep(ivyH - 5.0, ivyH, p.y);
      let clumps = smoothstep(0.3, 0.6, vnoise(vec2f(facU * 1.2, p.y * 0.18), 21) + 0.45 * (1.0 - p.y / max(ivyH, 1.0)));
      let iv = fall * clumps * select(1.0, 0.7, mi == 1);
      s.alb = mix(s.alb, vec3f(0.045, 0.085, 0.028) * (0.8 + 0.4 * vnoise(vec2f(facU, p.y) * 2.3, 23)), iv);
      s.emi *= 1.0 - iv;
      s.refl *= 1.0 - iv;
      s.trans = max(s.trans, iv * 0.5);
    }
  }
  if (mi != 12 && mi != 14 && mi != 17 && mi != 24 && mi != 26 && mi != 28 && mi != 29) { s.emi *= blackoutF(p); }
  return s;
}

// methane frost settles on up-facing surfaces, heavier during and after snowfall
// 3D value noise with its gradient (x: value 0..1, yzw: d/dp), for weathering and bump
fn vn3(q: vec3f, k: i32) -> vec4f {
  let i = floor(q);
  let f = q - i;
  let w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let dw = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  let x = i32(i.x);
  let y = i32(i.y);
  let z = i32(i.z) * 1013;
  let a = hsh(x + z, y, k);
  let b = hsh(x + 1 + z, y, k);
  let c = hsh(x + z, y + 1, k);
  let d = hsh(x + 1 + z, y + 1, k);
  let e = hsh(x + z + 1013, y, k);
  let f1 = hsh(x + 1 + z + 1013, y, k);
  let g = hsh(x + z + 1013, y + 1, k);
  let h = hsh(x + 1 + z + 1013, y + 1, k);
  let k1 = b - a;
  let k2 = c - a;
  let k3 = e - a;
  let k4 = a - b - c + d;
  let k5 = a - c - e + g;
  let k6 = a - b - e + f1;
  let k7 = -a + b + c - d + e - f1 - g + h;
  let v = a + k1 * w.x + k2 * w.y + k3 * w.z + k4 * w.x * w.y + k5 * w.y * w.z + k6 * w.z * w.x + k7 * w.x * w.y * w.z;
  let gr = dw * vec3f(k1 + k4 * w.y + k6 * w.z + k7 * w.y * w.z, k2 + k5 * w.z + k4 * w.x + k7 * w.z * w.x,
    k3 + k6 * w.x + k5 * w.y + k7 * w.x * w.y);
  return vec4f(v, gr);
}

// Weathering for every surface near the camera (first hit only): patchy tone, tholin dust (the orange-brown fallout
// of Titan's haze) settling on whatever faces up, dark streaks running down walls, grime at street level, and a
// bumped normal so flat faces stop reading as clean planes. Glass gets a dirt film only; lit signs and screens, and
// the walkers, are left alone.
fn weathering(sIn: Surf, nIn: vec3f, p: vec3f, m: i32, t: f32, nOut: ptr<function, vec3f>) -> Surf {
  var s = sIn;
  *nOut = nIn;
  let det = 1.0 - smoothstep(50.0, 170.0, t);
  if (det <= 0.0 || m == 56 || m == 62 || m == 16 || luma(s.emi) > 2.0 * luma(s.alb) + 0.05 || s.wet >= 1.0) { return s; }
  let n = nIn;
  if (m == 24) {
    // walkers: no dirt, only the weave and creases of their suits, fine and close up
    let wv = vn3(p * 40.0, 305);
    let cr = vn3(p * vec3f(6.0, 22.0, 6.0), 306);
    let gw = wv.yzw * 0.004 + cr.yzw * 0.01;
    *nOut = normalize(n - (gw - n * dot(gw, n)) * 6.0 * det * (1.0 - smoothstep(0.3, 0.8, s.spec)));
    s.alb *= 0.9 + 0.2 * cr.x;
    return s;
  }
  let big = vn3(p * 0.3, 301);
  let mid = vn3(p * 1.9, 302);
  let fine = vn3(p * 9.0, 303);
  let mot = big.x * 0.65 + mid.x * 0.35;
  let glass = smoothstep(0.25, 0.5, s.refl);
  let vert = 1.0 - smoothstep(0.35, 0.7, abs(n.y));
  let facU = select(p.x, p.z, abs(n.x) > abs(n.z));
  // streaks: long thin runs down walls, strongest just under where something sticks out
  let run = smoothstep(0.55, 0.85, vnoise(vec2f(facU * 1.6, p.y * 0.06), 304)) * vert;
  let dust = smoothstep(0.35, 0.95, n.y) * (0.45 + 0.55 * mot);
  let low = exp(-max(p.y, 0.0) * 0.45) * vert;
  var a = s.alb * (0.68 + 0.64 * mot) * (1.0 - 0.45 * run) * (1.0 - 0.45 * low * (0.6 + 0.4 * mid.x)) * (0.85 + 0.3 * fine.x);
  a = mix(a, vec3f(0.3, 0.19, 0.1) * (0.8 + 0.4 * fine.x), dust * 0.6);
  a = mix(a, a * vec3f(0.85, 0.72, 0.55), run * 0.4);
  s.alb = mix(s.alb, mix(a, s.alb * (0.9 + 0.2 * mot), glass), det);
  s.refl *= 1.0 - 0.35 * det * (dust + 0.5 * run) * (1.0 - 0.4 * glass);
  s.spec *= 1.0 - 0.4 * det * mot;
  // bump: the gradient of the middle and fine noise, less on glass and metal-smooth surfaces
  let amp = 0.2 * det * (1.0 - glass) * (1.0 - 0.6 * smoothstep(0.3, 0.9, s.spec));
  let gv = mid.yzw * 0.06 + fine.yzw * 0.012;
  let gt = gv - n * dot(gv, n);
  *nOut = normalize(n - gt * amp * 8.0);
  return s;
}

fn frostify(sfIn: Surf, n: vec3f, p: vec3f, m: f32) -> Surf {
  var s = sfIn;
  // settled snow (ev.wx.x, 0..1, built up by the page while it snows): on whatever faces up, first in patches that
  // grow and join as it deepens. It melts off anything warm: lit surfaces (lamp pools, signs, glazing), wet streets
  // (they go to slush), glass, the ground round the pod fab.
  let cov0 = ev.wx.x;
  let mi = i32(m + 0.5);
  // not on things that move (walkers, vehicles, drones, craft): the patches are fixed in the world
  let moving = mi == 24 || mi == 12 || mi == 14 || mi == 17 || mi == 28 || mi == 29 || mi == 70;
  if (cov0 > 0.001 && !moving) {
    let up = smoothstep(0.55, 0.85, n.y);
    let nz = vnoise(p.xz * 0.35, 590) * 0.6 + vnoise(p.xz * 1.7, 591) * 0.4;
    var cov = up * smoothstep(1.05 - cov0, 1.2 - cov0, nz + 0.15 * cov0);
    cov *= 1.0 - smoothstep(0.04, 0.35, luma(s.emi));
    cov *= 1.0 - 0.3 * smoothstep(0.3, 0.6, s.refl);
    cov *= 1.0 - smoothstep(60.0, 20.0, length(p.xz - FAB_W - vec2f(0.0, 0.0)) - 90.0);
    let slush = s.wet;
    if (cov > 0.001 && s.trans < 0.5) {
      let snow = mix(vec3f(0.95, 0.93, 0.9), vec3f(0.36, 0.33, 0.3), slush);
      s.alb = mix(s.alb, snow * (0.92 + 0.08 * vnoise(p.xz * 9.0, 592)), cov);
      s.spec = mix(s.spec, 0.35, cov);
      s.refl = mix(s.refl, 0.02 + 0.2 * slush, cov);
      s.rough = mix(s.rough, 0.2, cov);
      s.emi *= 1.0 - 0.5 * cov;
    }
  }
  let f = ev.sky.w * sstepJ(0.5, 0.92, n.y) * (0.7 + 0.3 * vnoise(p.xz * 0.7, 132));
  if (f > 0.001 && s.refl < 0.5 && s.trans < 0.5) {
    s.alb = mix(s.alb, vec3f(0.86, 0.82, 0.74), f);
    s.spec = mix(s.spec, 0.5, f);
  }
  return s;
}

fn lightSurf(n: vec3f, rd: vec3f, sf: Surf, sha: f32, occ: f32) -> vec3f {
  let L = u.sunDir;
  let ndl = dot(n, L);
  let wrap = mix(max(ndl, 0.0), clamp((ndl + 0.45) / 1.45, 0.0, 1.0), sf.trans);
  let dif = wrap * sha;
  let hal = normalize(L - rd);
  let spe = pow(max(dot(n, hal), 0.0), 80.0) * sf.spec * max(ndl, 0.0) * sha;
  let amb = mix(u.fogCol * 0.16 + u.skyHor * 0.08, u.skyTop * 1.1, 0.5 + 0.5 * n.y) * occ;
  let bounce = u.sunCol * 0.03 * clamp(0.5 - 0.5 * n.y, 0.0, 1.0) * occ;
  let moonL = (vec3f(0.16, 0.5, 0.45) * max(dot(n, ev.moonA.xyz), 0.0) + vec3f(0.5, 0.18, 0.3) * max(dot(n, ev.moonB.xyz), 0.0)) * (0.08 + 0.3 * u.stars) * occ;
  var col = sf.alb * (u.sunCol * dif + amb + bounce + moonL);
  col += min(u.sunCol * spe * 0.5, vec3f(3.0));
  let back = pow(clamp(dot(rd, L), 0.0, 1.0), 3.0);
  col += sf.alb * sf.trans * u.sunCol * back * 0.8 * (0.3 + 0.7 * sha) * occ;
  return col + sf.emi;
}

// ---------- sun shadow map (world-anchored, toroidal, filled incrementally) ----------
fn smKey(id: vec2i) -> u32 {
  return u32(id.x & 0x3fff) | (u32(id.y & 0x3fff) << 14u) | (u32(sp.gen) << 28u);
}

fn shadowLookup(p: vec3f, n: vec3f, jit: vec2f) -> f32 {
  let ndl = clamp(dot(n, sp.lz), 0.08, 1.0);
  let slope = min(sqrt(1.0 - ndl * ndl) / ndl, 5.0);
  let pb = p + n * (0.1 + sp.ts * (0.6 + 0.6 * (1.0 - ndl)));
  let uvf = vec2f(dot(pb, sp.lx), dot(pb, sp.ly)) / sp.ts - 0.5 + jit;
  let i0 = vec2i(floor(uvf));
  let f = uvf - floor(uvf);
  let wp = dot(pb, sp.lz);
  let nn = i32(sp.n);
  var s = vec4f(0.0);
  for (var k = 0; k < 4; k++) {
    let id = i0 + vec2i(k & 1, k >> 1);
    let slot = vec2i(((id.x % nn) + nn) % nn, ((id.y % nn) + nn) % nn);
    let tx = textureLoad(shadowTex, slot, 0);
    if (tx.y != smKey(id)) { return -1.0; }
    s[k] = select(1.0, 0.0, wp < bitcast<f32>(tx.x) - sp.ts * (0.5 + 1.1 * slope) - 0.1);
  }
  return mix(mix(s.x, s.y, f.x), mix(s.z, s.w, f.x), f.y);
}

@compute @workgroup_size(8, 8) fn shadowBuild(@builtin(global_invocation_id) gid: vec3u) {
  let r = rectU;
  if (i32(gid.x) >= r.z || i32(gid.y) >= r.w) { return; }
  let id = vec2i(r.x + i32(gid.x), r.y + i32(gid.y));
  let uu = (f32(id.x) + 0.5) * sp.ts;
  let vv = (f32(id.y) + 0.5) * sp.ts;
  let w0 = (275.0 - sp.ly.y * vv) / sp.lz.y;
  let ro = sp.lx * uu + sp.ly * vv + sp.lz * w0;
  gNoDyn = true;
  var dummy = 1.0;
  let hit = traceScene(ro, -sp.lz, 1250.0, 140, 24, 40, &dummy, false);
  var wHit = -1e9;
  if (hit.kind >= 2) { wHit = w0 - hit.t; }
  let nn = i32(sp.n);
  let slot = vec2i(((id.x % nn) + nn) % nn, ((id.y % nn) + nn) % nn);
  textureStore(shadowOut, slot, vec4u(bitcast<u32>(wHit), smKey(id), 0u, 0u));
}

// ---------- rasterized proxies: conservative ray start distances ----------
struct PxOut { @builtin(position) pos: vec4f, @location(0) wp: vec3f };

fn projectPx(wp: vec3f) -> vec4f {
  let v = wp - u.camPos;
  let z = dot(v, u.camFwd);
  let nearZ = 0.1;
  let farZ = 2000.0;
  return vec4f(dot(v, u.camRight) / (u.fov * u.res.x / u.res.y), dot(v, u.camUp) / u.fov, z * farZ / (farZ - nearZ) - farZ * nearZ / (farZ - nearZ), z);
}

fn boxVertex(vi: u32, lo: vec3f, hi: vec3f) -> PxOut {
  var tbl = array<u32, 36>(0u, 1u, 3u, 0u, 3u, 2u, 4u, 6u, 7u, 4u, 7u, 5u, 0u, 4u, 5u, 0u, 5u, 1u,
                           2u, 3u, 7u, 2u, 7u, 6u, 0u, 2u, 6u, 0u, 6u, 4u, 1u, 5u, 7u, 1u, 7u, 3u);
  let c = tbl[vi];
  let k = vec3f(f32(c & 1u), f32((c >> 1u) & 1u), f32((c >> 2u) & 1u));
  var wp = mix(lo, hi, k);
  let m = 0.25 + length(wp - u.camPos) * (3.0 * u.fov / u.res.y);
  wp += (k * 2.0 - 1.0) * m;
  var o: PxOut;
  o.wp = wp;
  o.pos = projectPx(wp);
  return o;
}

@vertex fn vsCell(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> PxOut {
  var o: PxOut;
  o.pos = vec4f(2.0, 2.0, 2.0, 1.0);
  o.wp = vec3f(0.0);
  let sx = i32(ii) % NC;
  let sz = i32(ii) / NC;
  let t0 = textureLoad(cellTex, vec2i(sx * 3, sz), 0);
  let t1 = textureLoad(cellTex, vec2i(sx * 3 + 1, sz), 0);
  let top = max(t1.y, t0.w);
  if (top <= 0.0 || t0.x > 1.5e7) { return o; }
  let cen = (t0.xy + 0.5) * CS;
  var lo = vec3f(cen.x - HALF, -0.5, cen.y - HALF);
  var hi = vec3f(cen.x + HALF, top + 0.5, cen.y + HALF);
  if (t0.w <= 0.0 && ((i32(round(t0.z)) >> 5) & 30720) == 0 && ((i32(round(t0.z)) >> 20) & 7) != 3 && (i32(round(t0.z)) & 15) != 14) {
    let typ = i32(round(t0.z)) & 15;
    var ctr = cen;
    var ext = vec2f(FOOT);
    if (typ == 1 || typ == 2) {
      let t2 = textureLoad(cellTex, vec2i(sx * 3 + 2, sz), 0);
      ctr = cen + t2.xy;
      ext = t1.zw + 0.6;
      if (typ == 1 && t2.z >= 0.72) { ext = vec2f(max(t1.z, t1.w) * 1.42 + 0.6); }
    }
    lo = vec3f(max(ctr.x - ext.x, cen.x - FOOT), -0.5, max(ctr.y - ext.y, cen.y - FOOT));
    hi = vec3f(min(ctr.x + ext.x, cen.x + FOOT), top + 0.5, min(ctr.y + ext.y, cen.y + FOOT));
  }
  return boxVertex(vi, lo, hi);
}

@vertex fn vsGiant(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> PxOut {
  var o: PxOut;
  o.pos = vec4f(2.0, 2.0, 2.0, 1.0);
  o.wp = vec3f(0.0);
  let b = vec2i(floor(u.camPos.xz / BIG)) + vec2i(i32(ii) % 13 - 6, i32(ii) / 13 - 6);
  if (!giantHasW(b)) { return o; }
  let cen = (vec2f(b) + 0.5) * BIG;
  let top = giantTop(b) + 8.0;
  let hw = select(82.0, 104.5, isHive(b) || isFab(b));
  return boxVertex(vi, vec3f(cen.x - hw, -0.5, cen.y - hw), vec3f(cen.x + hw, top, cen.y + hw));
}

@fragment fn fsProxy(i: PxOut) -> @location(0) vec4f {
  return vec4f(length(i.wp - u.camPos), 0.0, 0.0, 1.0);
}

fn rnd3(fc: vec2f, k: i32) -> vec3f {
  let f = i32(u.frame);
  return vec3f(hsh(i32(fc.x), i32(fc.y), f * 5 + k), hsh(i32(fc.x), i32(fc.y), f * 5 + k + 1), hsh(i32(fc.x), i32(fc.y), f * 5 + k + 2)) - 0.5;
}

@fragment fn scene(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let px = vec2f(floor(fc.x) * 2.0 + f32((i32(fc.y) + i32(u.frame)) & 1) + 0.5, fc.y);
  let fj = px + u.jitter;
  let uv = vec2f(fj.x * 2.0 - u.res.x, u.res.y - fj.y * 2.0) / u.res.y;
  let ro = u.camPos;
  let rd = normalize(u.camFwd + (uv.x * u.camRight + uv.y * u.camUp) * u.fov);
  var tProxy = 0.0;
  if (u.p5 < 0.5) { tProxy = max(textureLoad(proxyTex, vec2i(i32(px.x), i32(fc.y)), 0).r - 0.5, 0.0); }
  let hit = tracePrimary(ro, rd, tProxy);
  var col = vec3f(0.0);
  var tOut = TMAX;
  // The primary hit and, for reflective surfaces, the reflected hit are shaded by the same code in a two-pass
  // loop. GPU compilers inline every call, so a single call site keeps the pipeline small and quick to build.
  var cro = ro;
  var crd = rd;
  var h = hit;
  var wgt = vec3f(1.0);
  var tBase = 0.0;
  let nPass = select(2, 3, u.frame < -1.0);
  for (var bounce = 0; bounce < nPass; bounce++) {
    let first = bounce == 0;
    if (h.kind == 0) {
      var sc = fogApply(skyCol(crd), cro, crd, TMAX);
      if (!first) { sc *= min(1.0, 2.5 / max(luma(sc), 1e-4)); }
      col += wgt * sc;
      break;
    }
    let p = cro + crd * h.t;
    if (first) { tOut = h.t; }
    var n = hitNormal(p, h);
    // weathering first, then frost and settled snow on top of it (the tholin dust would brown fresh snow)
    var sf = surface(p, n, h.m, crd, h.t + tBase);
    if (first) { var nb = n; sf = weathering(sf, n, p, i32(h.m + 0.5), h.t, &nb); n = nb; }
    sf = frostify(sf, n, p, h.m);
    var sha = 0.75;
    var occ = 0.85;
    if (first) {
      if (sf.wet > 0.0) { n = normalize(n + rippleN(p) * sf.wet * (0.6 + 0.8 * u.p8)); }
      sha = 0.0;
      if (u.sunDir.y > 0.0 && dot(n, u.sunDir) > -0.3) {
        let sm = shadowLookup(p, n, rnd3(px, 0).xy * 0.9);
        sha = select(0.8, sm, sm >= 0.0);
      }
      occ = 1.0;
      if (h.t < 300.0 && h.kind != 5) { occ = calcAO(p, n, h); }
    }
    var c = lightSurf(n, crd, sf, sha, occ);
    // fog along this segment is an affine blend, fogApply(x) = x * fT + f0
    let f0 = fogApply(vec3f(0.0), cro, crd, h.t);
    let fT = fogApply(vec3f(1.0), cro, crd, h.t).x - f0.x;
    if (!first) {
      var rc = c * fT + f0;
      rc *= min(1.0, 2.5 / max(luma(rc), 1e-4));
      col += wgt * rc;
      break;
    }
    c += sf.alb * beamSpot(p);
    if (sf.refl <= 0.02) { col += c * fT + f0; break; }
    var r = reflect(crd, n);
    r = normalize(r + rnd3(px, 3) * sf.rough * 2.0);
    if (h.kind == 1) { r.y = abs(r.y); }
    let w = clamp(sf.refl, 0.0, 1.0);
    if (!(u.refl > 0.5 && h.t < 350.0 && sf.refl > 0.1)) {
      var rc = fogApply(skyCol(r), p, r, TMAX);
      rc *= min(1.0, 2.5 / max(luma(rc), 1e-4));
      col += mix(c, rc * sf.tint, w) * fT + f0;
      break;
    }
    col += c * (1.0 - w) * fT + f0;
    wgt = sf.tint * w * fT;
    var d2 = 1.0;
    tBase = h.t;
    cro = p + n * 0.08;
    crd = r;
    h = traceScene(cro, crd, 320.0, 22, 12, 18, &d2, false);
  }
  col += beamGlow(ro, rd, tOut) * (0.3 + u.windows);
  let tEv = select(tOut, FARMAX, hit.kind == 0);
  col += fireworksFx(ro, rd, tEv);
  col = launchFx(ro, rd, tEv, col);
  col = smokeFx(ro, rd, tOut, col);
  col = tubesFx(ro, rd, tOut, col);
  col = holoFx(ro, rd, tEv, col);
  col = beamFx(ro, rd, tEv, col);
  col = bubbleFx(ro, rd, tEv, col);
  col = flockFx(ro, rd, tOut, col);
  col = propsFx(ro, rd, tOut, col);
  // a power cut: everything in the area goes dark (with a flicker as it fails and comes back)
  if (ev.blk.w > 0.0) {
    let hp = ro + rd * min(tOut, 3000.0);
    let bd = length(hp.xz - ev.blk.xy);
    col *= 1.0 - ev.blk.w * sstepJ(ev.blk.z, ev.blk.z * 0.55, bd) * sstepJ(400.0, 250.0, hp.y) * (0.4 + 0.6 * u.windows);
  }
  // a burst heat pipe: a rising, spreading plume of warm steam
  if (ev.steam.w > 0.0) {
    let age = u.time - ev.steam.w;
    if (age > 0.0 && age < 30.0) {
      let base = ev.steam.xyz;
      var acc = 0.0;
      let tc = clamp(dot(base + vec3f(0.0, 12.0, 0.0) - ro, rd), 0.0, tOut);
      for (var i = 0; i < 10; i++) {
        let t = tc + (f32(i) - 4.5) * 3.0;
        if (t < 0.0 || t > tOut) { continue; }
        let q = ro + rd * t - base;
        let h = max(q.y, 0.0);
        let rad = 1.5 + h * 0.35 + age * 0.3;
        let r = length(q.xz - vec2f(h * 0.25, 0.0));
        acc += exp(-r * r / (rad * rad)) * exp(-h / (6.0 + age * 1.5)) * step(-1.0, q.y) * (0.6 + 0.4 * vnoise(q.xz * 0.4 + vec2f(0.0, u.time * 0.8), 183));
      }
      let fade = sstepJ(0.0, 1.5, age) * sstepJ(30.0, 18.0, age);
      col = mix(col, (u.skyHor * 0.6 + u.sunCol * 0.15 + vec3f(0.55, 0.5, 0.48) * (0.3 + 0.5 * u.windows)), clamp(acc * 0.3 * fade, 0.0, 0.8));
    }
  }
  col += koiFx(ro, rd, tOut);
  col = max(col, vec3f(0.0));
  col *= min(1.0, 12.0 / max(luma(col), 1e-4));
  return vec4f(col, tOut);
}
