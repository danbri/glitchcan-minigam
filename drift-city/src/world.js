const C = 26, HALF = 13, BIG = 208, NC = 96, NW = 768, LW = NW * C;

function hsh(x, y, k) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(k | 0, 1442695041)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h & 0xffffff) / 16777216;
}
function vnoise(px, py, k) {
  const ix = Math.floor(px), iy = Math.floor(py);
  const fx = px - ix, fy = py - iy;
  const wx = fx * fx * (3 - 2 * fx), wy = fy * fy * (3 - 2 * fy);
  const a = hsh(ix, iy, k), b = hsh(ix + 1, iy, k), c = hsh(ix, iy + 1, k), d = hsh(ix + 1, iy + 1, k);
  const m0 = a + (b - a) * wx, m1 = c + (d - c) * wx;
  return m0 + (m1 - m0) * wy;
}
function sstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
// The world is a torus of NW x NW blocks (about 20 km across) with the city in the middle. Block indices wrap
// to [-384, 383] so the seam runs through the wild land, and every static feature repeats exactly across it.
function wrapS(i) { return ((((i + 384) % NW) + NW) % NW) - 384; }
function wrapN(i, n) { const h = n >> 1; return ((((i + h) % n) + n) % n) - h; }
function wrapP(x) { return x - LW * Math.round(x / LW); }
// value noise on a lattice of spacing s metres that repeats over the world
function pvn(x, z, s, k) {
  const n = Math.round(LW / s);
  const px = x / s, pz = z / s;
  const ix = Math.floor(px), iz = Math.floor(pz);
  const fx = px - ix, fz = pz - iz;
  const wx = fx * fx * (3 - 2 * fx), wz = fz * fz * (3 - 2 * fz);
  const x0 = ((ix % n) + n) % n, z0 = ((iz % n) + n) % n, x1 = (x0 + 1) % n, z1 = (z0 + 1) % n;
  const a = hsh(x0, z0, k), b = hsh(x1, z0, k), c = hsh(x0, z1, k), d = hsh(x1, z1, k);
  const m0 = a + (b - a) * wx, m1 = c + (d - c) * wx;
  return m0 + (m1 - m0) * wz;
}
function cityDist(x, z) { return Math.hypot(wrapP(x), wrapP(z)); }
// Current landing site: dryness and elevation offsets, a noise offset so each site differs, a landform at the
// local origin (1 impact crater, 2 cryovolcano) and whether the city is here.
// Titan is one fixed function of absolute position. Local coordinates (x east, z south, metres) sit on a tangent
// frame at an anchor point on the sphere; REG.ox/oz is where the local origin is relative to the anchor, and
// REG.cx/cz the centre of the 20 km window that the GPU terrain texture holds. Storage wraps every 20 km, so each
// stored point stands for the copy of itself nearest the window centre, and the window follows the camera.
const REG = { city: 1, ox: 0, oz: 0, cx: 0, cz: 0 };
// the anchor starts at Drift city (58 N, 318 W), so everything computed while the page loads is already in place
const GEO = (() => {
  const f = 58 * Math.PI / 180, l = 42 * Math.PI / 180;
  const U = [Math.cos(f) * Math.cos(l), Math.sin(f), Math.cos(f) * Math.sin(l)], E = [-Math.sin(l), 0, Math.cos(l)];
  const N = [E[1] * U[2] - E[2] * U[1], E[2] * U[0] - E[0] * U[2], E[0] * U[1] - E[1] * U[0]];
  return { E, U, N, feats: [] };
})();
const TITAN_RM = 2575000;
function repX(x) { return REG.cx + wrapP(x - REG.cx); }
function repZ(z) { return REG.cz + wrapP(z - REG.cz); }
// The city's shape: a core about 3.4 km across round the origin, and the harbour arm, a strip 760 m wide running
// north-east from the core to the shore of Kraken Mare. citySdf is negative inside (a union of a disc and a capsule);
// cityR is written so that cityDist - cityR = citySdf, which every "am I in the city, how far past its edge" test
// already uses. Mirrored in scene.wgsl and fallback.js.
const CITY_CORE = 1700, CITY_ARM = [3300, -3300], CITY_ARM_W = 380;
function citySdf(x, z) {
  const px = wrapP(x), pz = wrapP(z);
  const core = CITY_CORE + 380 * (pvn(x, z, 1248, 201) - 0.5) + 200 * (pvn(x, z, 624, 202) - 0.5);
  const ax = CITY_ARM[0], az = CITY_ARM[1], t = Math.max(0, Math.min(1, (px * ax + pz * az) / (ax * ax + az * az)));
  return Math.min(Math.hypot(px, pz) - core, Math.hypot(px - ax * t, pz - az * t) - CITY_ARM_W);
}
function cityR(x, z) {
  if (!REG.city || Math.hypot(repX(x) + REG.ox, repZ(z) + REG.oz) > 14000) return -1e9;
  return cityDist(x, z) - citySdf(x, z); }
// 3D value noise on the sphere, for the irregular edges of the large features
function gn3(x, y, z, k) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const wx = fx * fx * (3 - 2 * fx), wy = fy * fy * (3 - 2 * fy), wz = fz * fz * (3 - 2 * fz);
  const h = (a, b, c) => hsh(a + c * 7919, b, k), m = (a, b, t) => a + (b - a) * t;
  const a0 = m(h(ix, iy, iz), h(ix + 1, iy, iz), wx), b0 = m(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), wx);
  const c0 = m(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), wx), d0 = m(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), wx);
  return m(m(a0, b0, wy), m(c0, d0, wy), wz);
}
// Large-scale geography at an absolute point (metres from the anchor): [dryness shift, elevation shift, added height,
// dune strength]. Features are real ones at true size: seas as basins, dune belts, Xanadu's uplands, bright plains,
// crater rims, the Sotra pit beside Doom Mons, and the polar lake fields.
function geoN(ax, az) {
  const R0 = TITAN_RM, U = GEO.U, E = GEO.E, N = GEO.N;
  const nx = U[0] * R0 + E[0] * ax - N[0] * az, ny = U[1] * R0 + E[1] * ax - N[1] * az, nz = U[2] * R0 + E[2] * ax - N[2] * az;
  const l = Math.hypot(nx, ny, nz);
  return [nx / l, ny / l, nz / l];
}
function geoField(n) {
  const out = [0, 0, 0, 0];
  if (!GEO.feats.length) return out;
  const R0 = TITAN_RM, nx = n[0], ny = n[1], nz = n[2];
  const wob = (gn3(nx * 64 + 1000, ny * 64 + 1000, nz * 64 + 1000, 460) - 0.5) * 0.3;
  for (const f of GEO.feats) {
    const k = 2 * R0 * Math.asin(Math.min(Math.hypot(nx - f[0], ny - f[1], nz - f[2]) * 0.5, 1)) / f[3];
    if (k > 1.6) continue;
    const t = f[4];
    if (t === 1) { const q = sstep(1.0, 0.8, k + wob); out[1] -= 0.3 * q; out[0] -= 0.05 * q; }
    else if (t === 3) { const q = sstep(1.1, 0.85, k + wob); out[0] += 0.3 * q; out[1] += 0.02 * q; out[3] = Math.max(out[3], q); }
    else if (t === 4) out[1] += 0.2 * sstep(1.1, 0.8, k + wob);
    else if (t === 5) { const q = sstep(1.1, 0.8, k + wob); out[1] += 0.07 * q; out[0] += 0.05 * q; }
    else if (t === 6) { const hr = Math.min(700, Math.max(150, 0.012 * f[3])); out[2] += hr * Math.exp(-(((k - 1) / 0.1) ** 2)) - 0.7 * hr * sstep(1.0, 0.8, k) + 0.3 * hr * Math.exp(-Math.max(k - 1, 0) / 0.35) * sstep(0.95, 1.05, k); }
    else if (t === 7) out[2] -= 1700 * sstep(1.05, 0.7, k);
    else if (t === 8) out[2] += 1450 * Math.exp(-k * k * 2.5);
  }
  const pl = sstep(0.87, 0.93, Math.abs(ny));
  if (pl > 0) { const lk = pl * sstep(0.58, 0.64, gn3(nx * 171 + 1000, ny * 171 + 1000, nz * 171 + 1000, 470)); out[1] -= 0.25 * lk; out[0] -= 0.1 * pl; }
  return out;
}
// one possible oasis per 1248 m square of desert
function oasisAt(x, z) {
  const S = 1248, gx = Math.floor(x / S), gz = Math.floor(z / S), hx = ((gx % 16) + 16) % 16, hz = ((gz % 16) + 16) % 16;
  if (hsh(hx, hz, 233) > 0.35) return [1e9, 0];
  const ox = (gx + 0.3 + 0.4 * hsh(hx, hz, 234)) * S, oz = (gz + 0.3 + 0.4 * hsh(hx, hz, 235)) * S;
  return [Math.hypot(x - ox, z - oz), 8 + 26 * pvn(ox, oz, 2496, 231)];
}
function biomeW(dry, elev) {
  const sea = sstep(0.40, 0.34, elev), mnt = sstep(0.60, 0.70, elev), mid = Math.max(0, 1 - sea - mnt);
  const des = sstep(0.56, 0.63, dry), bad = sstep(0.46, 0.52, dry) * (1 - des);
  const swp = sstep(0.40, 0.34, dry) * sstep(0.52, 0.45, elev), fo = Math.max(0, 1 - des - bad - swp);
  return { sea, mnt, mid, des, bad, swp, fo };
}
// Terrain at a point: [ground height, water level (-100 = none), dryness, elevation]. The GPU builds the same
// values per block corner (terrBuild) and draws the bilinear surface between them.
function terrainAt(xIn, zIn) {
  const x0 = repX(xIn), z0 = repZ(zIn), x = x0, z = z0;
  // everything below is sampled at the absolute point on the sphere, so a place looks the same from any anchor
  const nv = geoN(x0 + REG.ox, z0 + REG.oz);
  const g = geoField(nv);
  const qx = nv[0] * TITAN_RM, qy = nv[1] * TITAN_RM, qz = nv[2] * TITAN_RM, northM = Math.asin(nv[1]) * TITAN_RM;
  const tn = (S, k) => 0.5 + (gn3(qx / S + 20000, qy / S + 20000, qz / S + 20000, k) - 0.5) * 1.17;
  const dry = tn(4992, 203) * 0.65 + tn(2496, 204) * 0.35 + g[0];
  const elev = tn(4992, 205) * 0.6 + tn(2496, 206) * 0.3 + tn(1248, 207) * 0.1 + g[1];
  const edge = sstep(0, 1, (cityDist(x0, z0) - cityR(x0, z0)) / 1400);
  if (edge <= 0) return [0, -100, dry, elev];
  const w = biomeW(dry, elev);
  let H = 0, W = -100;
  if (w.sea > 0) { H += w.sea * (-6 - 34 * tn(1248, 260)); if (w.sea > 0.02) W = 0; }
  if (w.mnt > 0) {
    let m = 0, a = 1;
    for (let i = 0; i < 5; i++) { const n = 1 - Math.abs(tn(1248 / (1 << i), 210 + i) * 2 - 1); m += n * n * a; a *= 0.5; }
    m /= 1.9375;
    H += w.mnt * (40 + 760 * m * m);
  }
  if (w.mid > 0) {
    let hm = 0;
    if (w.fo > 0) { const f = tn(1248, 240) * 0.6 + tn(624, 241) * 0.3 + tn(312, 242) * 0.1; hm += w.fo * (6 + 70 * f * f); }
    if (w.des > 0) {
      const d = Math.sin(northM * 0.0242 + 6 * tn(1248, 230));
      let hd = 8 + 26 * tn(2496, 231) + 14 * (0.5 + 0.5 * d) * (0.5 + 0.5 * d) * tn(624, 232);
      if (w.des * w.mid > 0.5 && edge > 0.99) {
        const oa = oasisAt(x0, z0);
        if (oa[0] < 110) { hd = oa[1] - 3.5 + (hd - oa[1] + 3.5) * sstep(30, 100, oa[0]); if (oa[0] < 70) W = Math.max(W, oa[1] - 1.2); }
      }
      hm += w.des * hd;
    }
    if (w.bad > 0) {
      const b = tn(624, 220) * 0.57 + tn(312, 221) * 0.29 + tn(156, 222) * 0.14;
      const tb = b * 7, fl = Math.floor(tb);
      hm += w.bad * (15 + 190 * (fl + sstep(0.75, 0.95, tb - fl)) / 7);
    }
    if (w.swp > 0) { hm += w.swp * (0.6 + 2.2 * tn(156, 250) * tn(624, 251)); if (w.swp * w.mid > 0.35) W = Math.max(W, 1.4); }
    H += w.mid * hm;
  }
  // methane rivers: a meandering contour of large-scale noise on the sphere, about 150 m wide, carved into the land
  // and filled with liquid (dry channels in deserts); none in mountain cores or out at sea
  // distance to the centreline is the noise value over its gradient, so the channel keeps a steady width
  const rvAt = (ox, oy, oz) => gn3((qx + ox) / 6000 + 20000, (qy + oy) / 6000 + 20000, (qz + oz) / 6000 + 20000, 480) * 1.17 + (gn3((qx + ox) / 1500 + 20000, (qy + oy) / 1500 + 20000, (qz + oz) / 1500 + 20000, 481) - 0.5) * 0.14 - 0.585 + 0.5 * 0.17;
  const r0 = rvAt(0, 0, 0), rv0 = Math.abs(r0);
  if (rv0 < 0.06 && edge > 0.99) {
    const gx = rvAt(40, 0, 0) - r0, gy = rvAt(0, 40, 0) - r0, gz = rvAt(0, 0, 40) - r0;
    const dm = rv0 / Math.max(Math.hypot(gx, gy, gz) / 40, 1e-7);
    const ch = sstep(55, 18, dm) * (1 - sstep(0.2, 0.5, w.mnt)) * (1 - sstep(0.3, 0.6, w.sea));
    if (ch > 0) {
      if (w.des < 0.5 && ch > 0.4 && H < 40) W = Math.max(W, H - 1.8);
      H -= 5 * ch;
    }
  }
  // Titan's great dune fields: ridges up to about 90 m high and 2.4 km apart, running east to west
  if (g[3] > 0 && w.des > 0) H += 90 * g[3] * w.des * w.mid * Math.pow(0.5 + 0.5 * Math.sin(northM * 0.002618 + 3 * tn(5000, 471)), 2.5);
  return [edge * H + g[2], edge > 0.01 ? W : -100, dry, elev];
}
// the drawn surface: bilinear between block-corner values, as on the GPU
const vtxCache = new Map();
function vtxSurf(i, j) {
  const key = wrapS(i) * 1000 + wrapS(j);
  let v = vtxCache.get(key);
  if (v === undefined) {
    const t = terrainAt(i * C, j * C);
    v = Math.max(t[0], t[1]);
    if (vtxCache.size > 60000) vtxCache.clear();
    vtxCache.set(key, v);
  }
  return v;
}
function terrSurfAt(x, z) {
  const gx = x / C, gz = z / C, ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
  const a = vtxSurf(ix, iz), b = vtxSurf(ix + 1, iz), c = vtxSurf(ix, iz + 1), d = vtxSurf(ix + 1, iz + 1);
  const m0 = a + (b - a) * fx, m1 = c + (d - c) * fx;
  return m0 + (m1 - m0) * fz;
}
// tree cover in the wild land, from the biome (same rule as treeParams on the GPU)
function wildTreeDens(H, W, dry, elev, x, z) {
  if (W > H - 0.3) return 0;
  const w = biomeW(dry, elev);
  let d = w.mnt * 0.75 * sstep(440, 330, H) + w.mid * (w.fo * 0.8 + w.swp * 0.45 + w.bad * 0.06 + w.des * 0.03) + w.sea * 0.1 * sstep(1, 4, H);
  if (w.des > 0.3) { const oa = oasisAt(x, z); if (oa[0] < 120) d = Math.max(d, 0.9 * sstep(120, 70, oa[0])); }
  return d;
}
// Districts, laid out by hand so the city has a geography you can learn. From the centre: the financial core, with
// the neon strip along the main east-west avenue through it; then by compass bearing, the old town round the
// Assembly Hall (north-east), the dorms (south-east), Chinatown (south-west) and the crystal gardens (north-west);
// the industrial works and then the spaceport along the harbour arm to the shore. Borders wobble a little.
// Ids: 0 financial core, 1 neon strip, 2 old town, 3 Chinatown, 4 industrial, 5 spaceport, 6 dorms, 7 crystal gardens.
function zoneAt(cx, cz) {
  const x = (cx + 0.5) * C, z = (cz + 0.5) * C, px = wrapP(x), pz = wrapP(z), r = Math.hypot(px, pz);
  const ax = CITY_ARM[0], az = CITY_ARM[1], t = Math.max(0, Math.min(1, (px * ax + pz * az) / (ax * ax + az * az)));
  if (Math.hypot(px - ax * t, pz - az * t) < CITY_ARM_W + 80 && r > CITY_CORE * 0.9) return t < 0.72 ? 4 : 5;
  if (Math.abs(pz - 40) < 95 && Math.abs(px) < 1250) return 1;
  if (r < 480 + 120 * (pvn(x, z, 624, 211) - 0.5)) return 0;
  const b = ((Math.atan2(px, -pz) * 180 / Math.PI) + 360 + 50 * (pvn(x, z, 624, 210) - 0.5)) % 360;
  return b < 115 ? 2 : b < 205 ? 6 : b < 290 ? 3 : 7;
}
// Landmarks are placed, not scattered: one Lumen pyramid and one ringed spire in the financial core, one plain
// megatower over the dorms (big-block coordinates, 8 x 8 cells). Mirrored in scene.wgsl (giantHasW, the ring).
const PYRAMID_CELL = [-6, -3], PAGODA_CELL = [-35, 16], SPIRE_BLOCK = [0, -1], GIANT_BLOCKS = [[0, -1]];
// The Hive: the cattle-class pod block, a patched, hulking castle 620 x 420 m and 240 m tall on the dorms' outer edge,
// looming over the nicer city. Big blocks x 2..4, z 5..6 (centre HIVE_C); mirrored as isHive and hiveSDF in scene.wgsl.
const HIVE_C = [728, 1248], HIVE_H = 240;
function hiveHas(bx, bz) { const wx = wrapN(bx, 96), wz = wrapN(bz, 96); return !!REG.city && wx >= 2 && wx <= 4 && wz >= 5 && wz <= 6; }
// its silhouette for the distant skyline: plinth, body, corner towers and the off-centre keep (local metres)
function hiveTopAt(lx, lz) {
  const ax = Math.abs(lx), az = Math.abs(lz);
  if ((ax > 217 && ax < 293 && az > 112 && az < 188) || (Math.abs(lx + 40) < 60 && Math.abs(lz - 10) < 50)) return HIVE_H;
  if (ax < 270 && az < 170) return 190;
  return ax < 300 && az < 196 ? 60 : 0;
}
// The pod fab: where the Hive's capsule homes are made, on big block (5, 5) beside it, powered by a beam from an orbital
// power station (the receiver cup tops a 100 m tower). Mirrored as isFab / fabSDF / beamFx in scene.wgsl.
const FAB_C = [5.5 * BIG, 5.5 * BIG], FAB_H = 110;
// the beam comes down from the station along this direction (unit vector, pointing up the beam)
const BEAM_DIR = (() => { const v = [-0.35, 1, 0.25], l = Math.hypot(...v); return v.map((x) => x / l); })();
// The Warmhouse: a 170 m bubble of warm Earth air that floats over the west edge of the city, tethered at four points.
// Mirrored as bubbleC / bubbleSDF / bubbleFx in scene.wgsl (keep the drift the same). Why it floats: the skill, "Warmhouse".
const BUB_R = 170;
function bubbleAt(t) { return [-1650 + 9 * Math.sin(t * 0.031), 300 + 5 * Math.sin(t * 0.047), 520 + 7 * Math.cos(t * 0.027)]; }
const BUB_C = bubbleAt(0);
function fabHas(bx, bz) { return !!REG.city && wrapN(bx, 96) === 5 && wrapN(bz, 96) === 5; }
function fabTopAt(lx, lz) { return Math.abs(lx) < 14 && Math.abs(lz) < 14 ? FAB_H : 26; }
// Hillside letters spelling DRIFT CITY on the first hill north of the city, facing it.
const SIGN = (() => {
  for (const dir of [-1, 1]) for (const x0 of [0, -20, 20, -40, 40, -60, 60]) {
    const r0 = cityR(x0 * C, dir * 6000);
    for (let d = r0 + 250; d < r0 + 3500; d += C) {
      const z = dir * d;
      let ok = true, hs = 1e9, hl = -1e9;
      for (let k = -3; k <= 2 && ok; k++) {
        const t = terrainAt((x0 + k + 0.5) * C, z);
        if (t[1] > t[0] - 1 || t[0] < 12) ok = false;
        hs = Math.min(hs, t[0]); hl = Math.max(hl, t[0]);
      }
      if (ok && hl - hs < 16) {
        const zc = (Math.floor(z / C) + 0.5) * C;
        let base = -1e9;
        for (let x = (x0 - 3) * C; x <= (x0 + 2) * C; x += 4) for (const dz of [-2, 0, 2]) base = Math.max(base, terrainAt(x, zc + dz)[0]);
        return { cz: wrapS(Math.floor(z / C)), cx0: x0 - 3, face: -dir, base: base + 2 };
      }
    }
  }
  return null;
})();
const EGG_TOP = { 1: 30, 2: 9, 3: 6, 4: 5, 5: 14, 6: 22, 7: 17, 8: 4, 9: 2.5, 10: 3.5, 11: 7, 12: 15, 15: 21, 17: 8, 18: 7, 19: 14, 20: 4 };
// The story's stone circle, on a rise north-north-east of the city, and the treehouse in the forest below it:
// placed, so the fliers' bearing in the story points at them. Nowhere else has either.
const STONES_AT = [1162, -3194], TREEHOUSE_AT = [1436, -3946];
function wildEgg(cx, cz, t, relief, x, z) {
  if (cx === wrapS(Math.floor(STONES_AT[0] / C)) && cz === wrapS(Math.floor(STONES_AT[1] / C))) return 3;
  if (cx === wrapS(Math.floor(TREEHOUSE_AT[0] / C)) && cz === wrapS(Math.floor(TREEHOUSE_AT[1] / C))) return 7;
  if (hsh(cx, cz, 400) > 0.0025 || relief > 6) return 0;
  const k = hsh(cx, cz, 401), H = t[0], W = t[1], w = biomeW(t[2], t[3]);
  if (W > H + 0.3) {
    const depth = W - H;
    if (W === 0 && depth > 15) return k < 0.6 ? 11 : 0;
    if (depth > 2.5 && depth < 12) return k < 0.4 ? 10 : 0;
    if (W > 1 && depth < 1.2) return 9;
    return 0;
  }
  if (w.sea > 0.3 && H < 12) return k < 0.4 ? 1 : k < 0.7 ? 2 : k < 0.9 ? 18 : 0;
  if (w.mnt > 0.6) return H > 420 ? (k < 0.55 ? 4 : 20) : (k < 0.4 ? 17 : 0);
  if (w.des * w.mid > 0.5) { const oa = oasisAt(x, z); if (oa[0] < 130) return 9; return k < 0.35 ? 8 : k < 0.6 ? 19 : k < 0.75 ? 15 : 0; }
  if (w.bad * w.mid > 0.5) return k < 0.45 ? 5 : k < 0.75 ? 15 : 0;
  if (w.swp * w.mid > 0.5) return k < 0.4 ? 17 : 0;
  return k < 0.55 ? 6 : k < 0.9 ? 17 : 0;
}
function wildCell(o, cx, cz, ccx, ccz, lite) {
  o.wild = true; o.typ = 5; o.h = 0; o.offx = 0; o.offz = 0; o.top = 0; o.treeTop = 0;
  if (lite) return o;
  const tc = terrainAt(ccx, ccz);
  let hmax = -1e9, hmin = 1e9, dmax = wildTreeDens(tc[0], tc[1], tc[2], tc[3], ccx, ccz);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const t = terrainAt((cx + i) * C, (cz + j) * C), sf = Math.max(t[0], t[1]);
    hmax = Math.max(hmax, sf); hmin = Math.min(hmin, sf);
    dmax = Math.max(dmax, wildTreeDens(t[0], t[1], t[2], t[3], (cx + i) * C, (cz + j) * C));
  }
  if (dmax > 0.02) o.treeTop = hmax + 26;
  let egg = 0;
  if (REG.city && SIGN && cz === SIGN.cz && cx >= SIGN.cx0 && cx < SIGN.cx0 + 5) { egg = 12; o.v = (cx - SIGN.cx0) / 16 + (SIGN.face > 0 ? 0.5 : 0); }
  else egg = wildEgg(cx, cz, tc, hmax - hmin, ccx, ccz);
  if (egg) { o.typ = 14; o.egg = egg; o.h = egg === 12 ? SIGN.base : Math.max(tc[0], tc[1]); o.top = Math.max(o.h, hmax) + EGG_TOP[egg]; o.treeTop = 0; }
  return o;
}

function forestF(x, z) { return sstep(0.5, 0.66, vnoise(x / 260, z / 260, 7) * 0.7 + vnoise(x / 90, z / 90, 8) * 0.3); }
function treeDens(x, z) { return sstep(0.12, 0.55, forestF(x, z)); }
// the Assembly Hall stands on one giant cell about 1 km south-east of the centre
function hallAt(bx, bz) { return REG.city && wrapN(bx, 96) === 3 && wrapN(bz, 96) === -4 && Math.hypot(repX((bx + 0.5) * BIG) + REG.ox, repZ((bz + 0.5) * BIG) + REG.oz) < 14000; }
function giantHas(bx, bz) {
  if (hallAt(bx, bz) || hiveHas(bx, bz) || fabHas(bx, bz)) return true;
  const wx = wrapN(bx, 96), wz = wrapN(bz, 96);
  return REG.city && GIANT_BLOCKS.some((g) => g[0] === wx && g[1] === wz);
}
function giantH(bx, bz) { return hallAt(bx, bz) ? 96 : hiveHas(bx, bz) ? HIVE_H : fabHas(bx, bz) ? FAB_H : 150 + 110 * hsh(wrapN(bx, 96), wrapN(bz, 96), 21); }

function computeBase(cx0, cz0, lite) {
  const cx = wrapS(cx0), cz = wrapS(cz0);
  const ccx = (cx + 0.5) * C, ccz = (cz + 0.5) * C;
  const r0 = hsh(cx, cz, 1), r1 = hsh(cx, cz, 2), r2 = hsh(cx, cz, 3), r3 = hsh(cx, cz, 4), r4 = hsh(cx, cz, 5);
  let v = hsh(cx, cz, 6);
  const s = hsh(cx, cz, 7);
  let wx = 5 + 3.5 * r2, wz = 5 + 3.5 * r3;
  const o = { typ: 5, roof: 0, fl: 0, h: 0, top: 0, wx, wz, offx: (r3 - 0.5) * 2 * (9 - wx), offz: (r4 - 0.5) * 2 * (9 - wz), v, s, treeTop: 0, egg: 0, zone: 0, wild: false };
  if (cityDist(ccx, ccz) > cityR(ccx, ccz) - 13) return wildCell(o, cx, cz, ccx, ccz, lite);
  const zone = zoneAt(cx, cz);
  o.zone = zone;
  const fin = (fl) => { o.fl = fl | (zone << 15); if (o.typ !== 4 && o.typ !== 5 && o.typ !== 6 && o.top < 5.6) o.top = 5.6; return o; };
  if (!lite) {
    let dmax = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) dmax = Math.max(dmax, treeDens(cx * C - 5 + i * 12, cz * C - 5 + j * 12));
    o.treeTop = dmax > 0.015 ? 17 : 0;
  }
  const bx = Math.floor((cx + 0.5) / 8), bz = Math.floor((cz + 0.5) / 8);
  const ax = cx - bx * 8, az = cz - bz * 8;
  if (hiveHas(bx, bz) || fabHas(bx, bz)) { o.typ = 6; o.treeTop = 0; return fin(0); }
  if (ax >= 1 && ax <= 6 && az >= 1 && az <= 6 && hallAt(bx, bz)) { o.typ = 6; o.treeTop = 0; return fin(0); }
  if ((ax === 3 || ax === 4) && (az === 3 || az === 4) && giantHas(bx, bz)) { o.typ = 6; return fin(0); }
  // the old town's civic axis: an open avenue two cells wide running south from the Assembly Hall along x = 728,
  // walled on both sides by unbroken rows of crowned stone blocks of one height
  if (zone === 2 && cz >= -24 && cz <= -6) {
    if (cx === 27 || cx === 28) { o.typ = 5; o.h = 0; o.top = 0; o.treeTop = 0; return fin(32); }
    if (cx === 26 || cx === 29) {
      o.typ = 1; o.wx = o.wz = 8.8; o.offx = 0; o.offz = 0;
      o.v = 0.5; o.h = 38; o.roof = 1; o.top = 38 + 5 + 0.12 * 38 + 0.5;
      return fin(1024);
    }
  }
  const F = forestF(ccx, ccz);
  if (F > (zone === 7 ? 0.47 : 0.55)) {
    if (r0 < 0.3) { o.typ = 4; o.h = 14 + 24 * r1; o.offx = 0; o.offz = 0; o.top = o.h + 4.5; }
    return fin(0);
  }
  // district set pieces: industrial works, spaceport, corporate pyramids
  if (zone === 4 && r0 < 0.72) {
    o.typ = 9; o.offx = 0; o.offz = 0;
    if (v < 0.22) o.h = 70 + 30 * r1; else if (v < 0.4) o.h = 48 + 12 * r1; else if (v < 0.55) o.h = 50 + 12 * r1; else if (v < 0.75) o.h = 16 + 5 * r1; else o.h = 11 + 3 * r1;
    o.top = o.h + (v >= 0.22 && v < 0.4 ? 17 : 2.5);
    return fin(0);
  }
  if (zone === 5 && r0 < 0.62) {
    o.typ = 10; o.offx = 0; o.offz = 0;
    if (v < 0.28) { o.h = 44 + 22 * r1; o.top = o.h + 4; }
    else if (v < 0.43) { o.h = 0; o.top = 4; }
    else if (v < 0.63) { o.h = 18; o.top = 24; }
    else if (v < 0.78) { o.h = 15; o.top = 17; }
    else if (v < 0.9) { o.h = 20; o.top = 27; }
    else { o.h = 34; o.top = 42; }
    return fin(0);
  }
  if (cx === wrapS(PYRAMID_CELL[0]) && cz === wrapS(PYRAMID_CELL[1])) { o.typ = 13; o.offx = 0; o.offz = 0; o.h = 80; o.top = o.h + 3; return fin(0); }
  const cb = vnoise(ccx / 420, ccz / 420, 9), hb = vnoise(ccx / 310, ccz / 310, 10);
  let pc = 0.02 + 0.14 * cb * cb, po = 0.06 + 0.22 * cb, ph = 0.12 + 0.45 * hb, hs = 1;
  if (zone === 0) { pc *= 0.5; po *= 0.7; ph *= 0.3; hs = 1.35; }
  else if (zone === 1) { pc *= 0.3; po *= 0.4; ph = 0.35; hs = 0.55; }
  else if (zone === 2) { pc *= 0.3; po *= 0.3; ph = 0.72; hs = 0.5; }
  else if (zone === 3) { pc = 0; po = 0; ph = 0.62; hs = 0.6; }
  else if (zone === 4) { pc = 0; po *= 0.3; ph = 0.2; hs = 0.3; }
  else if (zone === 5) { pc *= 0.3; po *= 0.5; ph = 0.1; hs = 0.4; }
  else if (zone === 6) { pc *= 0.2; po *= 0.3; ph = 0.08; }
  else { pc = 0.3; po = 0.3; ph *= 0.5; }
  // crystal towers belong to the crystal gardens; elsewhere they are rare
  if (zone !== 7) pc *= 0.3;
  const h0 = (typ) => typ === 1 ? (v < 0.4 ? 1.06 : 1) : 1;
  if (r0 < 0.07) { o.typ = 0; o.h = 4 + 8 * r1; o.top = o.h + 0.5; }
  else if (r0 < 0.07 + pc) { o.typ = 3; o.h = 16 + 50 * r1 * r1; o.offx = 0; o.offz = 0; o.top = o.h + 0.5; }
  else if (r0 < 0.07 + pc + po) { o.typ = 8; o.h = 26 + 70 * r1 * r1; o.offx = 0; o.offz = 0; o.top = o.h + 4.5; }
  else if (r0 < 0.07 + pc + po + ph) {
    o.typ = 2; o.h = 10 + 16 * r1;
    if (v < 0.45) o.top = o.h + 4 + Math.min(wx, wz) * 0.62 + 2.8;
    else if (v < 0.78) o.top = o.h * 2.2 + 0.5;
    else o.top = o.h + wx * 0.32 + 0.5;
  } else {
    o.typ = 1;
    if (zone === 6) {
      // the dorms: broad residential slabs of capsule homes, where most people are, under their headsets
      v = 0.4 + 0.31 * v; o.v = v;
      wx = 8 + r2; wz = 8 + r3; o.wx = wx; o.wz = wz;
      o.offx = (r3 - 0.5) * 2 * (9 - wx); o.offz = (r4 - 0.5) * 2 * (9 - wz);
      o.h = 45 + 65 * r1;
    } else o.h = Math.max(12, (18 + 130 * r1 * r1 * r1) * hs);
    o.top = o.h * h0(1) + 0.3 + (o.h > 80 ? 15 : 0);
  }
  // districts by their form, not only their signs:
  // Lumen, the financial core: severe. Full-footprint slabs, all tall, one dark-glass style, no crowns, few signs.
  if (zone === 0 && o.typ === 1) {
    wx = wz = 8.6; o.wx = wx; o.wz = wz; o.offx = 0; o.offz = 0;
    v = 0.05 + 0.3 * v; o.v = v;
    o.h = 70 + 50 * r1; o.top = o.h * h0(1) + 0.3 + 15;
  }
  // Chinatown: tight. Low blocks that fill their lots, so the streets between them are alleys.
  if (zone === 3 && (o.typ === 1 || o.typ === 2)) {
    wx = 8.4 + 0.5 * r2; wz = 8.4 + 0.5 * r3; o.wx = wx; o.wz = wz; o.offx = 0; o.offz = 0;
    if (o.typ === 1) { o.h = 12 + 18 * r1; o.top = o.h * h0(1) + 0.3; }
  }
  const crown = zone === 7 ? 0 : 0.1;
  if ((o.typ === 1 && r4 > 0.86 - 0.2 * cb + crown) || (o.typ === 2 && r4 > 0.92 + crown * 0.5)) {
    o.roof = 1;
    if (o.typ === 1) o.top = Math.max(o.top, o.h * h0(1) - 2 + 5 + 0.12 * o.h + 0.5);
    else o.top = Math.max(o.top, o.h * 1.1 + 6.5);
  }
  if (zone === 0 && o.typ === 1) o.roof = 0;
  // the pagoda: one, in the middle of Chinatown
  if (cx === wrapS(PAGODA_CELL[0]) && cz === wrapS(PAGODA_CELL[1])) { o.typ = 11; o.roof = 0; o.h = 0; o.offx = 0; o.offz = 0; o.top = 47; return fin(1); }
  // one landmark per 32 x 32 block region: a pagoda (always in Chinatown) or a lattice tower
  const rgx = Math.floor(cx / 32), rgz = Math.floor(cz / 32);
  if (cx === rgx * 32 + 4 + Math.floor(hsh(rgx, rgz, 140) * 24) && cz === rgz * 32 + 4 + Math.floor(hsh(rgx, rgz, 141) * 24)
      && o.typ <= 2 && (zone === 2 || zone === 0) && hsh(rgx, rgz, 144) < 0.4) {
    // lattice towers only in the old town and the core, and not in every region
    const id = 2;
    o.typ = 11; o.roof = 0; o.h = 0; o.offx = 0; o.offz = 0; o.top = id === 1 ? 47 : 134;
    return fin(id);
  }
  // feature flags: signs, shops and set pieces, dense in the neon district and Chinatown
  const nd = zone === 1 ? 1 : zone === 3 ? 0.85 : zone === 0 ? 0.05 : 0.12 + 0.3 * sstep(0.42, 0.7, vnoise(ccx / 350, ccz / 350, 33));
  let fl = 0;
  const seed = (Math.imul(cx, 7919) + Math.imul(cz, 104729)) | 0;
  const s0 = Math.floor(hsh(seed, 1, 40) * 4);
  const face = (side) => {
    const ax = side < 2, sg = (side & 1) === 0 ? 1 : -1;
    return { wall: (ax ? o.offx : o.offz) + sg * (ax ? o.wx : o.wz), wa: ax ? o.wx : o.wz, wb: ax ? o.wz : o.wx };
  };
  if (o.typ === 1 || o.typ === 2) {
    const twisted = o.typ === 1 && v >= 0.72;
    if (!twisted && hsh(cx, cz, 50) < 0.15 + 0.6 * nd) fl |= 1;
    if (o.typ === 1 && v >= 0.4 && !twisted && o.h < 32 && hsh(cx, cz, 51) < (zone === 1 ? 0.2 : 0.07)) { fl |= 2; o.roof = 0; o.top = o.h + 7.3; }
    if (o.typ === 1 && nd > 0.35 && hsh(cx, cz, 53) < 0.18) fl |= 4;
    if (hsh(cx, cz, 54) < 0.3 + 0.6 * nd) fl |= 1024;
    const fg = face((s0 + 1) % 4), fe = face((s0 + 3) % 4);
    if (o.typ === 1 && !twisted && fg.wa >= 3.5 && fg.wb >= 3 && hsh(cx, cz, 55) < 0.3) fl |= 64;
    if (o.typ === 1 && !twisted && Math.abs(fe.wall) <= 7.45 && fe.wb >= 3 && hsh(cx, cz, 56) < 0.35) fl |= 128;
    if (o.typ === 1 && o.h > 45 && hsh(cx, cz, 57) < 0.3 + 0.5 * nd) fl |= 256;
    if (hsh(cx, cz, 58) < 0.035) fl |= 512;
  }
  if (o.typ === 0) {
    const r = hsh(cx, cz, 52);
    // a Ferris wheel or two on the neon strip; night markets in Chinatown and on the strip
    if (r < 0.25 && zone === 1 && hsh(cx, cz, 59) < 0.12) { fl |= 8; o.top = 19.3; }
    else if (r >= 0.25 && r < 0.6 && (zone === 3 || zone === 1) && hsh(cx, cz, 60) < (zone === 3 ? 0.75 : 0.4)) { fl |= 16; o.top = 2.8; }
    else if (r < 0.8) { fl |= 32; o.top = 0; }
  }
  // small city easter eggs
  let egg = 0;
  const e = hsh(cx, cz, 70);
  if (o.typ === 1 && v < 0.72 && !o.roof && !(fl & 2)) {
    const roofY = o.h * h0(1);
    if (e < 0.014) { egg = 21; o.top = Math.max(o.top, roofY + 1.3); }
    else if (zone === 1 && o.h < 30 && e < 0.08) { egg = 22; o.top = Math.max(o.top, roofY + 7.5); }
    else if ((zone === 5 || zone === 0) && o.h < 60 && e < 0.06) { egg = 23; o.top = Math.max(o.top, roofY + 4.5); }
    else if (o.h > 60 && e > 0.965) egg = 28;
  }
  if (egg === 0 && (zone === 1 || zone === 3) && (fl & 1024) && hsh(cx, cz, 71) < 0.3) egg = 27;
  if (o.typ === 0 && !(fl & 56) && e < 0.4) { egg = (zone === 5 || zone === 0) ? 25 : 24; o.top = Math.max(o.top, egg === 25 ? 22 : 10); }
  if (o.typ === 0 && (fl & 32) && e < 0.45) egg = 26;
  o.egg = egg;
  return fin(fl);
}

// Distant skyline: [body top, half width x, half width z, style = typ + 16 * zone] for one block, or null.
function farInfo(cx, cz) {
  if (!REG.city) return null;
  const w0 = wrapS(cx), z0 = wrapS(cz);
  if (w0 * w0 + z0 * z0 > 292 * 292) return null;
  const o = computeBase(cx, cz, true);
  if (o.wild) return null;
  const st = o.typ + 16 * o.zone, v = o.v;
  switch (o.typ) {
    case 0: return (o.fl & 8) ? [19, 9, 1.5, st] : null;
    case 1: return [o.h * (v < 0.4 ? 1.06 : 1), o.wx, o.wz, st];
    case 2: return [o.h, o.wx, o.wz, st];
    case 3: return [o.h, 3.5, 3.5, st];
    case 4: return [o.h, 6, 6, st];
    case 5: return [14, 12.5, 12.5, st];
    case 6: { const w = wrapS(cx), z = wrapS(cz), bx = Math.floor((w + 0.5) / 8), bz = Math.floor((z + 0.5) / 8); if (hiveHas(bx, bz)) { const t = hiveTopAt((w + 0.5) * C - HIVE_C[0], (z + 0.5) * C - HIVE_C[1]); return t > 0 ? [t, 13, 13, st] : null; } if (fabHas(bx, bz)) return [fabTopAt((w + 0.5) * C - FAB_C[0], (z + 0.5) * C - FAB_C[1]), 13, 13, st]; return [giantH(bx, bz), 13, 13, st]; }
    case 8: return [o.h, 6.5, 6.5, st];
    case 9: return v < 0.22 ? [o.h, 3.5, 3.5, st] : v < 0.4 ? [o.h, 2.5, 2.5, st] : [o.h, v < 0.75 ? 8.5 : 9, v < 0.75 ? 8.5 : 9, st];
    case 10: return v < 0.28 ? [o.h, 3, 3, st] : v < 0.43 ? [2, 9, 9, st] : v < 0.63 ? [18, 9, 6, st] : v < 0.78 ? [15, 9, 9, st] : v < 0.9 ? [20, 5, 5, st] : [34, 3, 3, st];
    case 11: return (o.fl & 3) === 1 ? [44, 6, 6, st] : [130, 2.5, 2.5, st];
    case 13: return [o.h, 5, 5, st];
  }
  return null;
}

const cellCache = new Map();
function clearTerrainCache() { vtxCache.clear(); }
function resetWorldCaches() { vtxCache.clear(); cellCache.clear(); baseCache.clear(); for (let i = 0; i < cellData.length; i += 12) cellData[i] = 1e9; }
const baseCache = new Map();
function baseAt(cx, cz) {
  const key = cx * 100003 + cz;
  let v = baseCache.get(key);
  if (v === undefined) {
    v = computeBase(cx, cz, false);
    if (baseCache.size > 30000) { let n = 0; for (const k of baseCache.keys()) { baseCache.delete(k); if (++n >= 5000) break; } }
    baseCache.set(key, v);
  }
  return v;
}
function walkY(ax, az, axis) { return 14 + 20 * hsh(ax, az, 131 + axis); }
// A skywalk joins two facing towers across a street when both are tall and wide enough there.
function walkOK(a, b, ax, az, axis) {
  if (a.typ !== 1 || b.typ !== 1 || a.v >= 0.72 || b.v >= 0.72 || (a.fl & 2) || (b.fl & 2)) return false;
  if (hsh(ax, az, 132 + axis) > (a.zone === 0 ? 0.8 : 0.5)) return false;
  const y = walkY(ax, az, axis);
  const ha = a.v < 0.4 ? a.h * 0.6 : a.h, hb = b.v < 0.4 ? b.h * 0.6 : b.h;
  if (y + 1.7 > Math.min(ha, hb) - 2) return false;
  if (axis === 0) {
    if (a.offx + a.wx < 8 || b.offx - b.wx > -8) return false;
    return !(a.offz - a.wz > -1.7 || a.offz + a.wz < 1.7 || b.offz - b.wz > -1.7 || b.offz + b.wz < 1.7);
  }
  if (a.offz + a.wz < 8 || b.offz - b.wz > -8) return false;
  return !(a.offx - a.wx > -1.7 || a.offx + a.wx < 1.7 || b.offx - b.wx > -1.7 || b.offx + b.wx < 1.7);
}
function computeCell(cx0, cz0) {
  const cx = wrapS(cx0), cz = wrapS(cz0);
  const o = Object.assign({}, baseAt(cx, cz));
  if (o.wild) { o.fl |= 262144; return o; }
  const xp = wrapS(cx + 1), xm = wrapS(cx - 1), zp = wrapS(cz + 1), zm = wrapS(cz - 1);
  if (walkOK(o, baseAt(xp, cz), cx, cz, 0)) o.fl |= 2048;
  if (walkOK(baseAt(xm, cz), o, xm, cz, 0)) o.fl |= 8192;
  if (walkOK(o, baseAt(cx, zp), cx, cz, 1)) o.fl |= 4096;
  if (walkOK(baseAt(cx, zm), o, cx, zm, 1)) o.fl |= 16384;
  if (o.zone === 3) {
    const china = (b) => !b.wild && b.zone === 3 && b.typ !== 4 && b.typ !== 5 && b.typ !== 6;
    let bits = 0;
    if (china(baseAt(xp, cz))) bits |= 1;
    if (china(baseAt(xm, cz))) bits |= 2;
    if (china(baseAt(cx, zp))) bits |= 4;
    if (china(baseAt(cx, zm))) bits |= 8;
    if (china(o)) { o.egg += 64 * bits; if (bits) o.top = Math.max(o.top, 7.3); }
  }
  if (o.fl & 1) {
    const s0 = Math.floor(hsh((Math.imul(cx, 7919) + Math.imul(cz, 104729)) | 0, 1, 40) * 4);
    if (o.fl & [2048, 8192, 4096, 16384][s0]) o.fl &= ~1;
  }
  return o;
}
function cellAt(cx0, cz0) {
  const cx = wrapS(cx0), cz = wrapS(cz0);
  const key = cx * 100003 + cz;
  let v = cellCache.get(key);
  if (v === undefined) {
    v = computeCell(cx, cz);
    if (cellCache.size > 20000) { let n = 0; for (const k of cellCache.keys()) { cellCache.delete(k); if (++n >= 3000) break; } }
    cellCache.set(key, v);
  }
  return v;
}

function heightAt(x, z, yRef = 1e9) {
  let hgt = Math.max(0, terrSurfAt(x, z));
  const cx = Math.floor(x / C), cz = Math.floor(z / C);
  const lx = x - (cx + 0.5) * C, lz = z - (cz + 0.5) * C;
  const e = HALF - Math.max(Math.abs(lx), Math.abs(lz));
  const cell = cellAt(cx, cz);
  if (cell.wild) {
    if (cell.treeTop > 0) hgt = Math.max(hgt, cell.treeTop);
    if (cell.typ === 14 && e > 2.0) hgt = Math.max(hgt, cell.top);
    return hgt;
  }
  if (e > 3.0) hgt = Math.max(hgt, cell.top);
  if (treeDens(wrapP(x), wrapP(z)) > 0.004) hgt = Math.max(hgt, 19);
  const bx = Math.floor(x / BIG), bz = Math.floor(z / BIG);
  if (giantHas(bx, bz)) {
    const gd = Math.hypot(x - (bx + 0.5) * BIG, z - (bz + 0.5) * BIG);
    const gh = giantH(bx, bz);
    if (gd < 42) hgt = Math.max(hgt, gh + 4);
    else if (gd < 80) hgt = Math.max(hgt, gh * 0.72);
  }
  // skywalks over the street: an obstacle unless the drone is well below them
  if (e <= 3.4) {
    const wl = (ax, az, axis) => { const y = walkY(wrapS(ax), wrapS(az), axis); if (yRef > y - 5.2) hgt = Math.max(hgt, y + 1.8); };
    if (Math.abs(lz) < 1.8) {
      if (lx > 9 && (cell.fl & 2048)) wl(cx, cz, 0);
      if (lx < -9 && (cellAt(cx - 1, cz).fl & 2048)) wl(cx - 1, cz, 0);
    }
    if (Math.abs(lx) < 1.8) {
      if (lz > 9 && (cell.fl & 4096)) wl(cx, cz, 1);
      if (lz < -9 && (cellAt(cx, cz - 1).fl & 4096)) wl(cx, cz - 1, 1);
    }
    // lantern strings across Chinatown streets
    if (((cell.fl >> 15) & 7) === 3 && yRef > 3) hgt = Math.max(hgt, 7.4);
  }
  return hgt;
}

const cellData = new Float32Array(NC * NC * 12);
for (let i = 0; i < NC * NC; i++) { cellData[i * 12] = 16000000; cellData[i * 12 + 1] = 16000000; }
function updateWindow(camCx, camCz) {
  const rowCount = new Int32Array(NC), touched = [];
  for (let dz = -NC / 2; dz < NC / 2; dz++) {
    for (let dx = -NC / 2; dx < NC / 2; dx++) {
      const cx = camCx + dx, cz = camCz + dz;
      const sx = ((cx % NC) + NC) % NC, sz = ((cz % NC) + NC) % NC;
      const i = (sz * NC + sx) * 12;
      if (cellData[i] === cx && cellData[i + 1] === cz) continue;
      const c = cellAt(cx, cz);
      cellData[i] = cx; cellData[i + 1] = cz; cellData[i + 2] = c.typ + 16 * c.roof + 32 * c.fl; cellData[i + 3] = c.treeTop;
      cellData[i + 4] = c.h; cellData[i + 5] = c.top; cellData[i + 6] = c.wx; cellData[i + 7] = c.wz;
      cellData[i + 8] = c.offx; cellData[i + 9] = c.offz; cellData[i + 10] = c.v; cellData[i + 11] = c.egg + c.s * 0.999;
      rowCount[sz]++; touched.push(sx, sz);
    }
  }
  const rows = new Set(), cols = new Set();
  for (let z = 0; z < NC; z++) if (rowCount[z] === NC) rows.add(z);
  for (let k = 0; k < touched.length; k += 2) if (!rows.has(touched[k + 1])) cols.add(touched[k]);
  return { count: touched.length / 2, rows, cols };
}
