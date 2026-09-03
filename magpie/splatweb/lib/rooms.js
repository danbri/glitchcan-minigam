// rooms.js — the room catalogue for the stage: procedural rooms drawn
// from a small splat toolkit (surfaces are TANGENT splats — thin along
// the normal — so walls and floors read crisp instead of foggy), and
// rooms COMPOSED from the licence-proven dbdb stamp pack at whatever
// scale makes a room (a 14 m rock shelf at 0.5 is a garden wall).
//
// A built room is { data, count, floorY, bounds, platforms, obstacles,
// cam, credits } — platforms/obstacles feed the critters' physics
// (critters.js) so a room with levels is a room they can hop around.
import { mulberry32 } from './pose-math.js';
import { FLOATS_PER_SPLAT } from './splat-renderer.js';
import { SplatList, qFromZTo, buildRoom } from './scene-builder.js';
import { loadCompressedPly } from './cply.js';

const DBDB = '../dbdb/splats/pack/';

// ---------------------------------------------------------------- toolkit
class Builder {
  constructor(seed = 1) { this.s = new SplatList(); this.rnd = mulberry32(seed); this.platforms = []; this.obstacles = []; }
  jit(v, j) { return v + (this.rnd() - 0.5) * j; }
  tone(c, k) { const t = 1 + (this.rnd() - 0.5) * k; return [c[0] * t, c[1] * t, c[2] * t]; }
  // a surface patch: tangent splat, thin along n
  surf(p, n, size, c, a = 1, thin = 0.18) {
    this.s.add(p, [size, size, size * thin], c, a, qFromZTo(n));
  }
  blob(p, size, c, a = 1) { this.s.add(p, [size, size, size], c, a); }
  // axis-aligned rectangle patch grid: axis 'y' = horizontal (floor/ceiling), 'x'/'z' = walls
  rect(axis, at, u0, u1, v0, v1, step, color, { jitter = 0.4, toneK = 0.06, alpha = 1, up = 1, size = null, fn = null } = {}) {
    const sz = size || step * 0.78;
    for (let u = u0; u <= u1; u += step) for (let v = v0; v <= v1; v += step) {
      const uu = this.jit(u, step * jitter), vv = this.jit(v, step * jitter);
      let p, n;
      if (axis === 'y') { p = [uu, at, vv]; n = [0, up, 0]; }
      else if (axis === 'z') { p = [uu, vv, at]; n = [0, 0, up]; }
      else { p = [at, vv, uu]; n = [up, 0, 0]; }
      const c = fn ? fn(uu, vv) : color;
      if (!c) continue;
      this.surf(p, n, sz, this.tone(c, toneK), alpha);
    }
  }
  // solid box (6 faces of tangent splats)
  box(cx, cy, cz, w, h, d, color, { step = 0.1, toneK = 0.08, faces = 'all' } = {}) {
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const st = Math.min(step, Math.max(0.02, Math.min(w, h, d) * 0.9));
    const o = { toneK, size: st * 0.8 };
    if (faces === 'all' || faces.includes('top')) this.rect('y', cy + hh, cx - hw, cx + hw, cz - hd, cz + hd, st, color, { ...o, up: 1 });
    if (faces === 'all' || faces.includes('bottom')) this.rect('y', cy - hh, cx - hw, cx + hw, cz - hd, cz + hd, st, color, { ...o, up: -1 });
    if (faces === 'all' || faces.includes('front')) this.rect('z', cz + hd, cx - hw, cx + hw, cy - hh, cy + hh, st, color, { ...o, up: 1 });
    if (faces === 'all' || faces.includes('back')) this.rect('z', cz - hd, cx - hw, cx + hw, cy - hh, cy + hh, st, color, { ...o, up: -1 });
    if (faces === 'all' || faces.includes('sides')) {
      this.rect('x', cx + hw, cz - hd, cz + hd, cy - hh, cy + hh, st, color, { ...o, up: 1 });
      this.rect('x', cx - hw, cz - hd, cz + hd, cy - hh, cy + hh, st, color, { ...o, up: -1 });
    }
  }
  cylinder(cx, y0, cz, r, h, color, { step = 0.08, cap = true, toneK = 0.06 } = {}) {
    const n = Math.max(6, Math.round(2 * Math.PI * r / step));
    for (let y = y0; y <= y0 + h; y += step) for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (Math.round(y / step) % 2) * 0.5 / n * Math.PI * 2;
      this.surf([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r], [Math.cos(a), 0, Math.sin(a)], step * 0.8, this.tone(color, toneK));
    }
    if (cap) this.disc(cx, y0 + h, cz, r, color, { step });
  }
  disc(cx, y, cz, r, color, { step = 0.08, toneK = 0.05, up = 1 } = {}) {
    for (let rr = 0; rr <= r; rr += step) {
      const n = Math.max(1, Math.round(2 * Math.PI * rr / step));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rr * 3;
        this.surf([cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr], [0, up, 0], step * 0.8, this.tone(color, toneK));
      }
    }
  }
  sphere(cx, cy, cz, r, color, { n = 120, toneK = 0.08, alpha = 1, lit = true } = {}) {
    const GA = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const ny = 1 - 2 * (i + 0.5) / n, rr = Math.sqrt(Math.max(0, 1 - ny * ny)), ph = i * GA;
      const nn = [Math.cos(ph) * rr, ny, Math.sin(ph) * rr];
      const sh = lit ? 0.6 + 0.45 * Math.max(0, nn[0] * 0.3 + nn[1] * 0.8 + nn[2] * 0.5) : 1;
      const c = this.tone(color, toneK);
      this.surf([cx + nn[0] * r, cy + nn[1] * r, cz + nn[2] * r], nn, r * 2.4 / Math.sqrt(n) * 1.6, [c[0] * sh, c[1] * sh, c[2] * sh], alpha);
    }
  }
  glow(cx, cy, cz, r, color, n = 20, a = 0.45) {
    for (let i = 0; i < n; i++) {
      const th = this.rnd() * Math.PI * 2, ph = Math.acos(2 * this.rnd() - 1), d = r * Math.cbrt(this.rnd());
      this.blob([cx + Math.sin(ph) * Math.cos(th) * d, cy + Math.cos(ph) * d, cz + Math.sin(ph) * Math.sin(th) * d], r * 0.7, color, a);
    }
  }
  // gradient sky dome + distant ground haze — how a room gets a sky
  sky(top, horizon, r = 40, n = 900) {
    const GA = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const ny = (i + 0.5) / n, rr = Math.sqrt(Math.max(0, 1 - ny * ny)), ph = i * GA;
      const k = Math.pow(ny, 0.6);
      const c = [horizon[0] + (top[0] - horizon[0]) * k, horizon[1] + (top[1] - horizon[1]) * k, horizon[2] + (top[2] - horizon[2]) * k];
      this.s.add([Math.cos(ph) * rr * r, ny * r * 0.6 - 0.5, Math.sin(ph) * rr * r], [r * 0.09, r * 0.09, r * 0.09], c, 0.9);
    }
  }
  platform(x, z, r, y) { this.platforms.push({ x, z, r, y }); }
  obstacle(x, z, r, h) { this.obstacles.push({ x, z, r, h }); }
  finish(extra = {}) {
    return { data: this.s.toFloat32(), count: this.s.count, platforms: this.platforms, obstacles: this.obstacles,
      floorY: 0, bounds: 3.2, credits: [], ...extra };
  }
}

// ---------------------------------------------------------------- procedural rooms
function buildStudio() {
  const r = buildRoom();
  return { data: r.toFloat32(), count: r.count, platforms: [{ x: -1.8, z: -0.8, r: 0.55, y: 0.76 }],
    obstacles: [{ x: 2.9, z: -2.2, r: 0.4, h: 1.3 }], floorY: 0, bounds: 3.2, credits: [] };
}

// The library: shelves on three walls, a mezzanine along the back with a
// staircase up, reading tables and an armchair — many LEVELS, so the
// critters have somewhere to hop: steps → gallery → shelf tops.
function buildLibrary() {
  const b = new Builder(7);
  const W = 4.5, Dp = 3.2, H = 4.2;             // half-width, half-depth, height
  const WOOD = [0.42, 0.28, 0.16], DARK = [0.28, 0.17, 0.1], PLASTER = [0.72, 0.66, 0.56], RUG = [0.5, 0.16, 0.14];
  // parquet floor
  b.rect('y', 0, -W, W, -Dp, Dp, 0.12, WOOD, { toneK: 0.12, fn: (x, z) => {
    const k = (Math.floor(x / 0.6) + Math.floor(z / 0.3)) % 2 ? 1.08 : 0.92;
    return [WOOD[0] * k, WOOD[1] * k, WOOD[2] * k];
  } });
  b.disc(0.3, 0.012, 0.6, 1.5, RUG, { step: 0.1, toneK: 0.1 });
  // walls + ceiling with a warm skylight
  b.rect('z', -Dp, -W, W, 0, H, 0.15, PLASTER);
  b.rect('x', -W, -Dp, Dp, 0, H, 0.15, PLASTER);
  b.rect('x', W, -Dp, Dp, 0, H, 0.15, PLASTER, { up: -1 });
  b.rect('y', H, -W, W, -Dp, Dp, 0.2, [0.6, 0.58, 0.54], { up: -1 });
  b.rect('y', H - 0.02, -1.4, 1.4, -1.0, 1.0, 0.12, [1.0, 0.95, 0.82], { up: -1, alpha: 0.95 });
  b.glow(0, H - 0.4, 0, 0.7, [1.0, 0.93, 0.75], 16, 0.12);
  // bookshelves: a unit = uprights + shelves + rows of spines
  const spineCols = [[0.55, 0.15, 0.12], [0.16, 0.28, 0.5], [0.2, 0.42, 0.25], [0.7, 0.55, 0.2], [0.5, 0.25, 0.45], [0.85, 0.82, 0.7], [0.25, 0.2, 0.2]];
  const shelfUnit = (x0, x1, z, dir, yTop) => {   // along a wall facing +z (dir=1) or -z
    const depth = 0.32;
    for (let y = 0.05; y < yTop; y += 0.36) {
      b.box((x0 + x1) / 2, y + 0.02, z + dir * depth / 2, x1 - x0, 0.03, depth, DARK, { step: 0.09, faces: ['top', 'front', 'back'] });
      // spines
      for (let x = x0 + 0.05; x < x1 - 0.05;) {
        const w = 0.03 + b.rnd() * 0.04, h = 0.2 + b.rnd() * 0.11;
        const c = spineCols[Math.floor(b.rnd() * spineCols.length)];
        if (b.rnd() < 0.92) b.box(x + w / 2, y + 0.04 + h / 2, z + dir * (depth * 0.5), w, h, depth * 0.85, c, { step: 0.05, faces: ['front', 'top'], toneK: 0.12 });
        x += w + 0.006;
      }
    }
    b.box(x0 - 0.02, yTop / 2, z + dir * depth / 2, 0.04, yTop, depth, DARK, { step: 0.08 });
    b.box(x1 + 0.02, yTop / 2, z + dir * depth / 2, 0.04, yTop, depth, DARK, { step: 0.08 });
    b.box((x0 + x1) / 2, yTop + 0.02, z + dir * depth / 2, x1 - x0 + 0.08, 0.04, depth, DARK, { step: 0.09, faces: ['top', 'front'] });
  };
  // back wall: shelves under the mezzanine (2.1 m) and above it
  for (const [x0, x1] of [[-4.3, -2.4], [-2.2, -0.3], [0.3, 2.2], [2.4, 4.3]]) shelfUnit(x0, x1, -Dp + 0.01, 1, 2.0);
  for (const [x0, x1] of [[-4.3, -2.4], [-2.2, -0.3], [0.3, 2.2], [2.4, 4.3]]) {
    // upper shelves sit on the gallery floor
    const save = b.s.arr.length;
    shelfUnit(x0, x1, -Dp + 0.01, 1, 1.7);
    for (let i = save; i < b.s.arr.length; i += FLOATS_PER_SPLAT) b.s.arr[i + 1] += 2.25;
  }
  // side walls: tall shelves
  for (const [z0, z1] of [[-1.4, 0.4], [0.6, 2.4]]) {
    const save = b.s.arr.length;
    shelfUnit(z0, z1, 0, 1, 3.2);   // build along x then rotate onto the wall
    for (let i = save; i < b.s.arr.length; i += FLOATS_PER_SPLAT) {
      const x = b.s.arr[i], z = b.s.arr[i + 2];
      b.s.arr[i] = -W + 0.01 + z; b.s.arr[i + 2] = x;
      const q = [b.s.arr[i + 3], b.s.arr[i + 4], b.s.arr[i + 5], b.s.arr[i + 6]];
      // rotate the tangent by -90° about y
      const cy = Math.SQRT1_2, sy = -Math.SQRT1_2;
      b.s.arr[i + 3] = cy * q[0] + sy * q[2]; b.s.arr[i + 4] = cy * q[1] + sy * q[3];
      b.s.arr[i + 5] = cy * q[2] - sy * q[0]; b.s.arr[i + 6] = cy * q[3] - sy * q[1];
    }
  }
  // mezzanine gallery along the back: floor slab at 2.2, balustrade
  const MZ = 2.2, MD = 1.7;
  b.box(0, MZ - 0.06, -Dp + MD / 2, 2 * W, 0.12, MD, WOOD, { step: 0.12, faces: ['top', 'bottom', 'front'] });
  for (let x = -W + 0.1; x <= W; x += 0.28) b.box(x, MZ + 0.45, -Dp + MD, 0.03, 0.9, 0.03, DARK, { step: 0.05 });
  b.box(0, MZ + 0.92, -Dp + MD, 2 * W, 0.05, 0.06, DARK, { step: 0.1 });
  for (let x = -W + 0.9; x < W; x += 1.8) b.platform(x, -Dp + MD / 2, 0.95, MZ);
  // staircase up the right wall: 10 steps, each a platform
  const steps = 10, rise = MZ / steps, run = 0.3;
  for (let i = 0; i < steps; i++) {
    const y = rise * (i + 1), z = Dp - 0.5 - i * run;
    b.box(W - 0.55, y - 0.06, z, 1.0, 0.12, run, WOOD, { step: 0.08, faces: ['top', 'front', 'sides'] });
    b.box(W - 0.55, y / 2 - rise * 0.5, z, 1.0, y - rise, run, DARK, { step: 0.15, faces: ['front', 'sides'] });
    b.platform(W - 0.55, z, 0.45, y);
    if (i % 2 === 0) b.box(W - 1.06, y + 0.4, z, 0.03, 0.8, 0.03, DARK, { step: 0.05 });
  }
  b.box(W - 1.06, MZ / 2 + 0.55, Dp - 0.5 - (steps - 1) * run / 2, 0.04, 0.05, steps * run, DARK, { step: 0.1 });
  b.obstacle(W - 0.55, Dp - 0.5 - (steps - 1) * run / 2, 0.55, 0.0);   // (climbable: obstacles ignored above their h)
  // reading tables + chairs
  for (const [tx, tz] of [[-1.6, 0.9], [1.4, 1.4]]) {
    b.box(tx, 0.74, tz, 1.4, 0.05, 0.8, [0.36, 0.24, 0.14], { step: 0.07, faces: ['top', 'front', 'back', 'sides'] });
    for (const [lx, lz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) b.box(tx + lx, 0.36, tz + lz, 0.06, 0.72, 0.06, DARK, { step: 0.06 });
    b.platform(tx, tz, 0.7, 0.77);
    // an open book + a brass lamp
    b.box(tx - 0.3, 0.78, tz, 0.3, 0.03, 0.22, [0.92, 0.88, 0.78], { step: 0.05, faces: ['top'] });
    b.cylinder(tx + 0.4, 0.77, tz - 0.1, 0.02, 0.35, [0.7, 0.55, 0.25], { step: 0.05, cap: false });
    b.sphere(tx + 0.4, 1.17, tz - 0.1, 0.11, [0.25, 0.5, 0.35], { n: 60 });
    b.glow(tx + 0.4, 1.1, tz - 0.1, 0.16, [1.0, 0.9, 0.6], 8, 0.16);
    b.obstacle(tx, tz, 0.75, 0.74);
  }
  // armchair
  b.box(-3.2, 0.25, 1.9, 0.9, 0.5, 0.9, [0.35, 0.42, 0.3], { step: 0.07 });
  b.box(-3.2, 0.75, 1.5, 0.9, 0.5, 0.15, [0.3, 0.37, 0.26], { step: 0.07 });
  b.box(-3.68, 0.6, 1.9, 0.14, 0.2, 0.9, [0.3, 0.37, 0.26], { step: 0.07 });
  b.box(-2.72, 0.6, 1.9, 0.14, 0.2, 0.9, [0.3, 0.37, 0.26], { step: 0.07 });
  b.platform(-3.2, 1.9, 0.42, 0.5);
  b.obstacle(-3.2, 1.9, 0.5, 0.5);
  // floor lamps
  for (const [lx, lz] of [[-3.9, 0.2], [3.6, 2.6]]) {
    b.cylinder(lx, 0, lz, 0.02, 1.6, [0.3, 0.3, 0.32], { step: 0.06, cap: false });
    b.cylinder(lx, 1.55, lz, 0.22, 0.28, [0.95, 0.85, 0.65], { step: 0.07, cap: false });
    b.glow(lx, 1.65, lz, 0.28, [1.0, 0.85, 0.55], 12, 0.16);
  }
  // rolling ladder on the left shelves
  for (let y = 0.2; y < 3.0; y += 0.28) b.box(-W + 0.55, y, -0.5, 0.5, 0.03, 0.04, WOOD, { step: 0.05 });
  b.box(-W + 0.32, 1.6, -0.5, 0.04, 3.1, 0.04, DARK, { step: 0.08 }); b.box(-W + 0.78, 1.6, -0.5, 0.04, 3.1, 0.04, DARK, { step: 0.08 });
  return b.finish({ bounds: 3.6, cam: { target: [0, 1.2, -0.5], radius: 4.2 }, critterY: 0 });
}

function buildRooftop() {
  const b = new Builder(11);
  const W = 5, Dp = 4;
  b.sky([0.03, 0.04, 0.1], [0.12, 0.09, 0.16], 45, 800);
  // stars
  for (let i = 0; i < 260; i++) {
    const th = b.rnd() * Math.PI * 2, ph = b.rnd() * 0.45 * Math.PI;
    b.blob([Math.cos(th) * Math.cos(ph) * 42, Math.sin(ph) * 42 + 2, Math.sin(th) * Math.cos(ph) * 42], 0.12 + b.rnd() * 0.1, [1, 1, 0.95], 0.9);
  }
  b.sphere(-14, 22, -30, 1.6, [1.0, 0.97, 0.85], { n: 80, lit: false });
  b.glow(-14, 22, -30, 4, [0.9, 0.9, 1.0], 20, 0.12);
  // roof: concrete + parapet
  b.rect('y', 0, -W, W, -Dp, Dp, 0.13, [0.36, 0.36, 0.38], { toneK: 0.09 });
  for (const [x0, x1, z0, z1] of [[-W, W, -Dp - 0.2, -Dp], [-W, W, Dp, Dp + 0.2], [-W - 0.2, -W, -Dp, Dp], [W, W + 0.2, -Dp, Dp]]) {
    b.box((x0 + x1) / 2, 0.55, (z0 + z1) / 2, x1 - x0, 1.1, z1 - z0, [0.5, 0.48, 0.46], { step: 0.14 });
  }
  b.obstacle(0, -Dp - 0.1, 0.1, 1.1);
  // skyline: distant blocks with lit windows
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + b.rnd() * 0.2, d = 16 + b.rnd() * 14;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, h = 6 + b.rnd() * 18, w = 3 + b.rnd() * 5;
    b.box(x, h / 2 - 3, z, w, h, w, [0.06, 0.07, 0.1], { step: 0.6, toneK: 0.1 });
    for (let y = -2; y < h - 3; y += 0.9) for (let k = -w / 2 + 0.4; k < w / 2; k += 0.8) {
      if (b.rnd() < 0.55) continue;
      const warm = b.rnd() < 0.7;
      const c = warm ? [1.0, 0.85, 0.5] : [0.6, 0.8, 1.0];
      const nx = -Math.cos(a), nz = -Math.sin(a);
      b.surf([x + nx * (w / 2 + 0.02) + nz * k, y, z + nz * (w / 2 + 0.02) - nx * k], [nx, 0, nz], 0.35, c, 0.95);
    }
  }
  // water tank on legs + AC unit + a vent: platforms
  b.cylinder(2.8, 1.5, -2.2, 0.8, 1.4, [0.42, 0.3, 0.22], { step: 0.1 });
  b.cylinder(2.8, 2.9, -2.2, 0.85, 0.12, [0.35, 0.25, 0.18], { step: 0.1 });
  for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) b.box(2.8 + lx, 0.75, -2.2 + lz, 0.08, 1.5, 0.08, [0.3, 0.3, 0.32], { step: 0.08 });
  b.platform(2.8, -2.2, 0.75, 3.02); b.obstacle(2.8, -2.2, 0.85, 3.0);
  b.box(-2.6, 0.5, -2.4, 1.4, 1.0, 1.0, [0.6, 0.62, 0.64], { step: 0.1 });
  b.platform(-2.6, -2.4, 0.65, 1.0); b.obstacle(-2.6, -2.4, 0.8, 1.0);
  b.box(-0.2, 0.3, -3.2, 0.9, 0.6, 0.6, [0.45, 0.45, 0.47], { step: 0.1 });
  b.platform(-0.2, -3.2, 0.42, 0.6);
  // string lights across the roof
  for (const [x0, z0, x1, z1] of [[-W, Dp, W, -Dp], [-W, -Dp, W, Dp]]) {
    for (let t = 0; t <= 1; t += 0.03) {
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = 2.6 - Math.sin(t * Math.PI) * 0.5;
      b.blob([x, y, z], 0.012, [0.25, 0.22, 0.2], 1);
      if (Math.round(t * 100) % 9 === 0) { b.blob([x, y - 0.05, z], 0.04, [1.0, 0.85, 0.5], 1); b.glow(x, y - 0.05, z, 0.22, [1.0, 0.8, 0.45], 8, 0.25); }
    }
  }
  // deck chairs + a small table
  for (const [cx, cz, a] of [[0.8, 1.6, 0.3], [-0.9, 1.9, -0.4]]) {
    const c = Math.cos(a), s = Math.sin(a);
    b.box(cx, 0.22, cz, 0.6, 0.06, 1.2, [0.85, 0.35, 0.3], { step: 0.07 });
    b.box(cx - s * 0.55, 0.55, cz - c * 0.55, 0.6, 0.6, 0.06, [0.85, 0.35, 0.3], { step: 0.07 });
    b.platform(cx, cz, 0.35, 0.25);
  }
  return b.finish({ bounds: 4.2, cam: { target: [0, 1.2, -0.6], radius: 5 } });
}

function buildBeach() {
  const b = new Builder(5);
  b.sky([0.35, 0.55, 0.9], [0.85, 0.8, 0.72], 50, 900);
  // sand
  const SAND = [0.86, 0.76, 0.55];
  for (let x = -10; x <= 10; x += 0.28) for (let z = -3; z <= 10; z += 0.28) {
    const y = -0.02 + Math.sin(x * 0.7) * Math.cos(z * 0.5) * 0.03;
    b.surf([b.jit(x, 0.15), y, b.jit(z, 0.15)], [0, 1, 0], 0.26, b.tone(SAND, 0.08));
  }
  // sea: bands of blue toward the horizon + foam at the edge
  for (let z = -3.2; z >= -40; z -= 0.6) {
    const k = Math.min(1, (-z - 3) / 30);
    const c = [0.12 + 0.15 * k, 0.45 + 0.15 * k, 0.6 + 0.2 * k];
    for (let x = -45; x <= 45; x += 0.6) {
      const foam = z > -4.2 && b.rnd() < 0.5;
      b.surf([b.jit(x, 0.3), -0.05 + Math.sin(x * 0.4 + z) * 0.03, b.jit(z, 0.3)], [0, 1, 0], 0.6, foam ? [0.95, 0.97, 1] : b.tone(c, 0.05), 0.95);
    }
  }
  // pier: deck at 0.9 m going out over the water, posts, rail
  const PY = 0.9, WOOD = [0.5, 0.36, 0.22];
  for (let z = 1.5; z >= -9; z -= 0.14) b.box(1.5, PY, z, 2.2, 0.06, 0.12, WOOD, { step: 0.09, faces: ['top', 'front'], toneK: 0.12 });
  for (let z = 1.4; z >= -9; z -= 1.5) for (const x of [0.5, 2.5]) {
    b.cylinder(x, -0.3, z, 0.08, PY + 0.3, [0.32, 0.24, 0.16], { step: 0.07, cap: false });
    b.box(x, PY + 0.55, z, 0.06, 1.0, 0.06, WOOD, { step: 0.07 });
  }
  for (const x of [0.5, 2.5]) b.box(x, PY + 1.05, -3.75, 0.05, 0.05, 10.5, WOOD, { step: 0.08 });
  for (let z = 1; z >= -8.5; z -= 1.4) b.platform(1.5, z, 0.9, PY + 0.03);
  b.obstacle(1.5, -3.5, 1.2, PY);
  // steps up to the pier
  for (let i = 0; i < 4; i++) { const y = (i + 1) * PY / 4; b.box(1.5, y - 0.04, 2.0 + (3 - i) * 0.3, 1.4, 0.08, 0.3, WOOD, { step: 0.08, faces: ['top', 'front'] }); b.platform(1.5, 2.0 + (3 - i) * 0.3, 0.5, y); }
  // umbrella + towels
  b.cylinder(-2.2, 0, 1.2, 0.03, 2.1, [0.9, 0.9, 0.9], { step: 0.06, cap: false });
  for (let i = 0; i < 200; i++) {
    const a = b.rnd() * Math.PI * 2, rr = Math.sqrt(b.rnd()) * 1.2;
    const stripe = Math.floor(a / (Math.PI / 4)) % 2 ? [0.9, 0.2, 0.2] : [0.97, 0.95, 0.9];
    b.surf([-2.2 + Math.cos(a) * rr, 2.1 - rr * 0.35, 1.2 + Math.sin(a) * rr], [Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35], 0.16, stripe);
  }
  b.box(-2.6, 0.02, 2.4, 0.9, 0.03, 1.8, [0.2, 0.5, 0.8], { step: 0.08, faces: ['top'] });
  b.box(-1.4, 0.02, 2.6, 0.9, 0.03, 1.8, [0.9, 0.6, 0.2], { step: 0.08, faces: ['top'] });
  // a beach ball, a bucket
  b.sphere(-3.4, 0.25, 0.3, 0.25, [0.9, 0.3, 0.3], { n: 80 });
  b.cylinder(-1.0, 0, -0.5, 0.15, 0.25, [0.95, 0.75, 0.2], { step: 0.05 });
  b.obstacle(-2.2, 1.2, 0.1, 2.0);
  return b.finish({ bounds: 4.5, cam: { target: [0, 1.0, -0.3], radius: 5 } });
}

// a small theatre: raked tiers (levels!), a stage, red curtains, footlights
function buildTheatre() {
  const b = new Builder(3);
  const W = 5, RED = [0.55, 0.08, 0.1], DARK = [0.12, 0.1, 0.11], GOLD = [0.8, 0.65, 0.3];
  b.rect('y', 0, -W, W, -1, 6, 0.15, [0.16, 0.13, 0.13]);
  b.rect('z', 6, -W, W, 0, 5, 0.2, DARK, { up: -1 });
  b.rect('x', -W, -3, 6, 0, 5, 0.2, DARK); b.rect('x', W, -3, 6, 0, 5, 0.2, DARK, { up: -1 });
  b.rect('y', 5, -W, W, -3, 6, 0.25, [0.08, 0.07, 0.08], { up: -1 });
  // stage: raised platform at the front (−z), proscenium arch, curtains
  b.box(0, 0.4, -1.8, 2 * W, 0.8, 2.6, [0.35, 0.25, 0.15], { step: 0.14, faces: ['top', 'front', 'sides'] });
  for (let x = -W + 0.8; x < W; x += 1.6) b.platform(x, -1.8, 0.85, 0.8);
  b.obstacle(0, -1.8, 0.01, 0.8);
  b.rect('z', -3.1, -W, W, 0.8, 5, 0.15, [0.1, 0.08, 0.12], { up: 1 });
  // curtains: wavy tall sheets each side, partly open
  for (const sx of [-1, 1]) {
    for (let x = 0; x < 2.4; x += 0.08) {
      const wave = Math.sin(x * 9) * 0.12;
      for (let y = 0.85; y < 4.3; y += 0.1) {
        const c = b.tone(RED, 0.15); const sh = 0.75 + 0.35 * Math.max(0, Math.cos(x * 9));
        b.surf([sx * (W - 0.1 - x), y, -3.0 + wave], [0, 0, 1], 0.09, [c[0] * sh, c[1] * sh, c[2] * sh]);
      }
    }
  }
  b.box(0, 4.55, -3.0, 2 * W, 0.5, 0.25, RED, { step: 0.12, faces: ['front', 'bottom'] });
  b.box(0, 4.85, -3.05, 2 * W, 0.12, 0.3, GOLD, { step: 0.1, faces: ['front'] });
  for (const sx of [-1, 1]) b.box(sx * (W - 0.25), 2.5, -3.05, 0.5, 4.5, 0.3, GOLD, { step: 0.12, faces: ['front', 'sides'] });
  // footlights
  for (let x = -W + 0.5; x < W; x += 0.7) { b.blob([x, 0.86, -0.55], 0.05, [1, 0.9, 0.7], 1); b.glow(x, 0.9, -0.6, 0.35, [1.0, 0.85, 0.6], 10, 0.22); }
  // raked tiers of seats, each tier a level
  const tiers = 4;
  for (let t = 0; t < tiers; t++) {
    const y = t * 0.38, z0 = 0.6 + t * 1.3;
    b.box(0, y - 0.1 * (t > 0 ? 1 : 0) - (t === 0 ? 0 : 0), z0 + 0.65, 2 * W, Math.max(0.02, y), 1.3, [0.2, 0.17, 0.17], { step: 0.16, faces: ['top', 'front'] });
    for (let x = -W + 0.7; x < W - 0.4; x += 0.62) {
      if (Math.abs(x) < 0.45) continue;      // aisle
      b.box(x, y + 0.24, z0 + 0.5, 0.52, 0.1, 0.5, RED, { step: 0.08, faces: ['top', 'front', 'sides'] });
      b.box(x, y + 0.5, z0 + 0.8, 0.52, 0.55, 0.1, RED, { step: 0.08, faces: ['front', 'top', 'back'] });
      b.box(x, y + 0.14, z0 + 0.5, 0.5, 0.2, 0.46, DARK, { step: 0.12, faces: ['front', 'sides'] });
      if (x % 2 < 1) b.platform(x, z0 + 0.5, 0.3, y + 0.29);
    }
    for (let x = -W + 0.6; x < W; x += 1.3) b.platform(x, z0 + 0.65, 0.65, y);
  }
  // wall sconces
  for (const sx of [-1, 1]) for (let z = 0; z < 6; z += 2) { b.blob([sx * (W - 0.1), 2.6, z], 0.06, [1, 0.85, 0.6], 1); b.glow(sx * (W - 0.3), 2.6, z, 0.5, [1.0, 0.8, 0.5], 14, 0.18); }
  return b.finish({ bounds: 4.5, floorY: 0, avatarAt: [0, 0.8, -1.8], cam: { target: [0, 1.4, -1.2], radius: 5.5 }, critterY: 0 });
}

function buildGrotto() {
  const b = new Builder(19);
  const R = 5.5;
  // rock dome: noise-displaced sphere, tangent splats
  const GA = Math.PI * (3 - Math.sqrt(5)), n = 2600;
  for (let i = 0; i < n; i++) {
    const ny = (i + 0.5) / n, rr = Math.sqrt(Math.max(0, 1 - ny * ny)), ph = i * GA;
    const dir = [Math.cos(ph) * rr, ny, Math.sin(ph) * rr];
    const bump = 1 + 0.12 * Math.sin(ph * 3.1 + ny * 9) + 0.08 * Math.sin(ph * 7.3) * Math.cos(ny * 13);
    const rad = R * bump;
    const p = [dir[0] * rad, dir[1] * rad * 0.75, dir[2] * rad];
    const k = 0.7 + 0.5 * Math.max(0, ny) ;
    const c = [0.32 * k, 0.27 * k, 0.24 * k];
    b.surf(p, [-dir[0], -dir[1], -dir[2]], 0.34, b.tone(c, 0.18), 1, 0.12);
  }
  // floor: rough stone + a pool
  b.rect('y', 0, -R, R, -R, R, 0.2, [0.3, 0.26, 0.23], { toneK: 0.2, fn: (x, z) => (x * x + z * z < R * R * 0.85) ? [0.3, 0.26, 0.23] : null });
  b.disc(1.2, 0.02, 1.8, 1.6, [0.08, 0.35, 0.4], { step: 0.11 });
  b.glow(1.2, 0.1, 1.8, 0.5, [0.2, 0.7, 0.8], 6, 0.06);
  // stalactites
  for (let i = 0; i < 24; i++) {
    const a = b.rnd() * Math.PI * 2, d = b.rnd() * 3.5;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, top = 3.8 - d * 0.25, len = 0.4 + b.rnd() * 1.2;
    for (let t = 0; t < 1; t += 0.12) b.blob([x, top - t * len, z], 0.16 * (1 - t) + 0.03, b.tone([0.36, 0.3, 0.26], 0.1));
  }
  // crystals: glowing clusters, unlit
  const CRY = [[0.3, 0.9, 1.0], [0.9, 0.4, 1.0], [0.4, 1.0, 0.6]];
  for (let i = 0; i < 14; i++) {
    const a = b.rnd() * Math.PI * 2, d = 1.5 + b.rnd() * 3.2;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, c = CRY[i % 3];
    for (let k = 0; k < 5; k++) {
      const h = 0.2 + b.rnd() * 0.5, ox = (b.rnd() - 0.5) * 0.4, oz = (b.rnd() - 0.5) * 0.4;
      for (let t = 0; t < 1; t += 0.2) b.blob([x + ox + t * 0.05, t * h, z + oz], 0.07 * (1 - t * 0.7), c, 0.95);
    }
    b.glow(x, 0.25, z, 0.3, c, 5, 0.07);
  }
  // rock ledges at several heights: hoppable levels
  for (const [x, z, y, r] of [[-2.6, -1.2, 0.5, 0.9], [-3.2, 0.8, 1.1, 0.8], [2.8, -2.2, 0.7, 1.0], [-1.0, -3.0, 1.4, 0.7], [3.3, 0.9, 1.6, 0.7]]) {
    b.cylinder(x, 0, z, r, y, [0.34, 0.29, 0.25], { step: 0.14, toneK: 0.18 });
    b.platform(x, z, r * 0.85, y); b.obstacle(x, z, r, y);
  }
  return b.finish({ bounds: 3.8, cam: { target: [0, 1.1, -0.4], radius: 4.5 } });
}

// ---------------------------------------------------------------- stamp rooms
// parts: { el, at, yaw, stride, scale }; ground: procedural base under the stamps
async function buildStamps(def, packMeta) {
  const parts = await Promise.all(def.parts.map(pp =>
    loadCompressedPly(DBDB + pp.el + '.compressed.ply', { at: pp.at, yaw: pp.yaw || 0, stride: pp.stride || 4, scale: pp.scale || 1,
      maxAspect: pp.maxAspect || 4, maxScale: (pp.maxScale || 0.3) * (pp.scale || 1) })));
  let ground = null;
  if (def.ground) {
    const b = new Builder(2);
    def.ground(b);
    ground = b.s;
  }
  let total = ground ? ground.count : 0;
  for (const pt of parts) total += pt.count;
  const data = new Float32Array(total * FLOATS_PER_SPLAT);
  let off = 0;
  if (ground) { data.set(ground.toFloat32(), 0); off = ground.count * FLOATS_PER_SPLAT; }
  for (const pt of parts) { data.set(pt.data, off); off += pt.data.length; }
  const credits = [...new Set(def.parts.map(pp => (packMeta.find(e => e.id === pp.el) || {}).credit || pp.el))];
  return { data, count: total, credits, platforms: def.platforms || [], obstacles: def.obstacles || [],
    floorY: def.floorY || 0, bounds: def.bounds || 3.2, cam: def.cam };
}

const groundDisc = (color, r = 6, y = -0.01, sky = null) => (b) => {
  if (sky) b.sky(sky[0], sky[1], 45, 700);
  for (let i = 0; i < 1400; i++) {
    const a = b.rnd() * Math.PI * 2, rr = Math.sqrt(b.rnd()) * r;
    b.surf([Math.cos(a) * rr, y, Math.sin(a) * rr], [0, 1, 0], 0.22, b.tone(color, 0.1), 0.95);
  }
};

export const ROOM_DEFS = [
  { id: 'proc', name: 'Studio', glyph: '🎨', kind: 'proc', build: buildStudio },
  { id: 'library', name: 'Library', glyph: '📚', kind: 'proc', build: buildLibrary, critters: 8 },
  { id: 'rooftop', name: 'Rooftop', glyph: '🌃', kind: 'proc', build: buildRooftop, critters: 5 },
  { id: 'beach', name: 'Beach pier', glyph: '🏖', kind: 'proc', build: buildBeach },
  { id: 'theatre', name: 'Theatre', glyph: '🎭', kind: 'proc', build: buildTheatre, critters: 6 },
  { id: 'grotto', name: 'Grotto', glyph: '💎', kind: 'proc', build: buildGrotto, critters: 6 },
  { id: 'museum', name: 'Conservatory', glyph: '🏛', kind: 'stamps', parts: [
    { el: 'hall', at: [0, -0.05, 0], yaw: 0 },
    { el: 'windowwall', at: [0, 0, -3.2], yaw: 0, stride: 6 },
    { el: 'windowwall', at: [-3.2, 0, -1.2], yaw: Math.PI / 2, stride: 6 },
    { el: 'windowwall', at: [3.2, 0, -1.2], yaw: -Math.PI / 2, stride: 6 },
  ] },
  { id: 'ghost', name: 'Ghost garden', glyph: '🌿', kind: 'stamps', parts: [
    { el: 'grass', at: [0, 0.02, 0], yaw: 0.3, stride: 4 },
    { el: 'grass', at: [-1.6, 0.02, -2.2], yaw: 1.4, stride: 4 },
    { el: 'hut', at: [1.9, 0, -2.6], yaw: -0.4 },
  ], floorY: 0.12 },
  { id: 'desert', name: 'Ghost town', glyph: '🏜', kind: 'stamps', ground: groundDisc([0.72, 0.6, 0.45], 9, -0.01, [[0.25, 0.3, 0.55], [0.95, 0.6, 0.4]]), parts: [
    { el: 'trail', at: [0, 0, 0], yaw: 0.2, stride: 4 }, { el: 'trail', at: [2.6, 0, -1.8], yaw: 1.2, stride: 4 },
    { el: 'hut', at: [-2.6, 0, -3.0], yaw: 0.5, stride: 1 },
    { el: 'redtruck', at: [3.4, 0, -0.6], yaw: 2.4, stride: 3 },
    { el: 'pickup', at: [-4.0, 0, 1.2], yaw: -0.7, stride: 1 },
    { el: 'trestle', at: [2.4, 0, -5.0], yaw: 0.3, scale: 0.7, stride: 3 },
    { el: 'cistern', at: [-0.4, 0, -5.6], yaw: 1.0, scale: 0.7, stride: 3 },
  ], bounds: 3.6, obstacles: [{ x: 3.4, z: -0.6, r: 1.6, h: 1.8 }, { x: -2.6, z: -3.0, r: 1.5, h: 1.3 }, { x: -4.0, z: 1.2, r: 1.6, h: 1.2 }],
    cam: { target: [0, 1.2, -0.8], radius: 5.5 } },
  { id: 'maze', name: 'Hedge maze', glyph: '🌳', kind: 'stamps', ground: groundDisc([0.42, 0.5, 0.28], 9, -0.02, [[0.45, 0.65, 0.95], [0.85, 0.9, 0.95]]), parts: [
    { el: 'grass', at: [0, 0, 0], yaw: 0.2, stride: 4 }, { el: 'grass', at: [-2.9, 0, -0.4], yaw: 1.1, stride: 4 },
    { el: 'grass', at: [2.9, 0, 0.6], yaw: 2.3, stride: 4 }, { el: 'grass', at: [0.4, 0, -3.0], yaw: 0.7, stride: 4 },
    { el: 'hedge', at: [0, 0, -3.8], yaw: 0, stride: 4 }, { el: 'hedge2', at: [2.4, 0, -3.8], yaw: 0, stride: 4 }, { el: 'hedge3', at: [-2.4, 0, -3.8], yaw: 0, stride: 4 },
    { el: 'hedge', at: [-4.2, 0, -2.2], yaw: Math.PI / 2, stride: 4 }, { el: 'hedge2', at: [-4.2, 0, 0.2], yaw: Math.PI / 2, stride: 4 },
    { el: 'hedge3', at: [4.2, 0, -2.2], yaw: -Math.PI / 2, stride: 4 }, { el: 'hedge', at: [4.2, 0, 0.2], yaw: -Math.PI / 2, stride: 4 },
    { el: 'hedge2', at: [-1.6, 0, -1.4], yaw: Math.PI / 2, stride: 4, scale: 0.8 }, { el: 'hedge3', at: [1.8, 0, 1.2], yaw: 0, stride: 4, scale: 0.8 },
    { el: 'pond', at: [0.2, 0.01, 2.6], yaw: 0, stride: 3, scale: 0.8 },
    { el: 'palmfan', at: [-3.2, 0, 2.6], yaw: 0.6, stride: 4, scale: 0.7 },
  ], bounds: 3.4, floorY: 0.12,
    obstacles: [{ x: -1.6, z: -1.4, r: 0.6, h: 1.4 }, { x: 1.8, z: 1.2, r: 0.9, h: 1.4 }, { x: -3.2, z: 2.6, r: 0.8, h: 1.8 }],
    cam: { target: [0, 1.2, -0.8], radius: 5.5 } },
  { id: 'glasshouse', name: 'Glasshouse', glyph: '🌴', kind: 'stamps', ground: (b) => {
    b.sky([0.55, 0.7, 0.9], [0.9, 0.9, 0.85], 30, 500);
    for (let x = -4; x <= 4; x += 0.2) for (let z = -4; z <= 4; z += 0.2) {
      const k = (Math.floor(x / 0.4) + Math.floor(z / 0.4)) % 2 ? 0.55 : 0.68;
      b.surf([b.jit(x, 0.05), -0.01, b.jit(z, 0.05)], [0, 1, 0], 0.17, b.tone([k, k * 0.95, k * 0.85], 0.05));
    }
  }, parts: [
    { el: 'windowwall', at: [-1.4, 0, -3.6], yaw: 0, stride: 4 }, { el: 'windowwall', at: [1.4, 0, -3.6], yaw: 0, stride: 4 },
    { el: 'windowwall', at: [-3.8, 0, -1.6], yaw: Math.PI / 2, stride: 4 }, { el: 'windowwall', at: [-3.8, 0, 1.2], yaw: Math.PI / 2, stride: 4 },
    { el: 'windowwall', at: [3.8, 0, -1.6], yaw: -Math.PI / 2, stride: 4 }, { el: 'windowwall', at: [3.8, 0, 1.2], yaw: -Math.PI / 2, stride: 4 },
    { el: 'pond', at: [0.4, 0, 0.6], yaw: 0, stride: 3 },
    { el: 'palmfan', at: [-2.4, 0, -2.2], yaw: 0.3, stride: 4 },
    { el: 'plantbed', at: [2.6, 0, -2.4], yaw: 0, stride: 3 }, { el: 'plantbed2', at: [2.8, 0, 1.6], yaw: 1.0, stride: 3 },
    { el: 'fern2', at: [-2.6, 0, 1.4], yaw: 0.4, stride: 3 }, { el: 'fern3', at: [-1.2, 0, 2.6], yaw: 1.1, stride: 3 },
    { el: 'hedge2', at: [0, 0, -2.9], yaw: 0, stride: 4, scale: 0.8 },
  ], bounds: 3.2, obstacles: [{ x: -2.4, z: -2.2, r: 0.9, h: 2.5 }, { x: 2.6, z: -2.4, r: 0.7, h: 1.8 }, { x: 2.8, z: 1.6, r: 0.7, h: 1.8 }],
    cam: { target: [0, 1.2, -0.8], radius: 5 } },
  { id: 'forest', name: 'Forest path', glyph: '🌲', kind: 'stamps', ground: groundDisc([0.4, 0.45, 0.25], 9, -0.03, [[0.35, 0.5, 0.6], [0.6, 0.66, 0.5]]), parts: [
    { el: 'trail', at: [0, 0, -0.6], yaw: 0, stride: 3 },
    { el: 'grass', at: [-2.8, 0.0, -1.0], yaw: 0.6, stride: 4 }, { el: 'grass', at: [2.8, 0.0, 1.2], yaw: 2.1, stride: 4 },
    { el: 'grass', at: [-2.4, 0.0, 2.2], yaw: 1.6, stride: 4 }, { el: 'grass', at: [2.6, 0.0, -2.4], yaw: 0.3, stride: 4 },
    { el: 'canopy', at: [-3.2, 0, -4.0], yaw: 0, scale: 1.8, stride: 1 },
    { el: 'canopy', at: [3.6, 0, -3.2], yaw: 1.3, scale: 1.5, stride: 1 },
    { el: 'canopy', at: [2.2, 0.0, -1.6], yaw: 0.5, scale: 1.2, stride: 1 },
    { el: 'hedge3', at: [-3.2, 0, 2.6], yaw: 0.9, stride: 3 },
    { el: 'hedge', at: [-4.2, 0, -0.6], yaw: 1.4, stride: 4 },
    { el: 'fern', at: [1.6, 0, 2.4], yaw: 0, stride: 4 },
  ], floorY: 0.1, bounds: 3.4, obstacles: [{ x: -3.2, z: -4.0, r: 1.2, h: 4 }, { x: 3.6, z: -3.2, r: 1.0, h: 3.5 }, { x: 2.2, z: -1.6, r: 0.8, h: 2.5 }],
    cam: { target: [0, 1.2, -0.8], radius: 5.5 } },
  { id: 'grove', name: 'Winter grove', glyph: '🎄', kind: 'stamps', ground: groundDisc([0.9, 0.92, 0.97], 9, -0.01, [[0.05, 0.07, 0.18], [0.3, 0.3, 0.45]]), parts: [
    { el: 'pine', at: [-2.8, 0, -3.6], yaw: 0, scale: 0.36, stride: 3, maxScale: 0.08 },
    { el: 'pine', at: [3.2, 0, -2.6], yaw: 1.3, scale: 0.3, stride: 3, maxScale: 0.08 },
    { el: 'pine', at: [0.6, 0, -5.4], yaw: 2.2, scale: 0.42, stride: 3, maxScale: 0.08 },
    { el: 'hut', at: [-4.6, 0, 0.8], yaw: 1.2, stride: 1 },
  ], bounds: 3.4, obstacles: [{ x: -2.8, z: -3.6, r: 1.2, h: 3 }, { x: 3.2, z: -2.6, r: 1.0, h: 2.5 }, { x: -4.6, z: 0.8, r: 1.5, h: 1.3 }],
    cam: { target: [0, 1.2, -0.8], radius: 5.5 } },
  { id: 'yard', name: 'Garage yard', glyph: '🛠', kind: 'stamps', ground: groundDisc([0.5, 0.46, 0.4], 9, -0.01, [[0.45, 0.5, 0.6], [0.75, 0.72, 0.68]]), parts: [
    { el: 'shed', at: [0.6, 0, -6.0], yaw: 0, scale: 0.55, stride: 3, maxScale: 0.15 },
    { el: 'pump', at: [-2.4, 0, -2.2], yaw: 0.4, stride: 5 },
    { el: 'rustcar', at: [2.6, 0, -1.6], yaw: 2.2, scale: 0.85, stride: 4 },
    { el: 'pickup', at: [-3.8, 0, 1.4], yaw: -0.9, scale: 0.85, stride: 1 },
    { el: 'trestle', at: [4.4, 0, 1.8], yaw: 0.3, scale: 0.5, stride: 4 },
    { el: 'cistern', at: [-0.6, 0, 3.6], yaw: 1.2, scale: 0.5, stride: 4 },
    { el: 'tower', at: [-5.5, 0, -8], yaw: 0.6, scale: 0.35, stride: 2 },
    { el: 'chassis', at: [0.8, 0, 1.4], yaw: 0.9, scale: 0.6, stride: 1 },
  ], bounds: 3.6, obstacles: [{ x: 2.6, z: -1.6, r: 1.6, h: 1.4 }, { x: -3.8, z: 1.4, r: 1.7, h: 1.2 }, { x: -2.4, z: -2.2, r: 0.7, h: 2 }],
    platforms: [{ x: 0.8, z: 1.4, r: 1.2, y: 0.55 }],
    cam: { target: [0, 1.2, -0.8], radius: 5.5 } },
];

const cache = new Map();
let packMeta = null;
export async function loadRoom(id) {
  const def = ROOM_DEFS.find(r => r.id === id) || ROOM_DEFS[0];
  if (cache.has(def.id)) return cache.get(def.id);
  let room;
  if (def.kind === 'proc') room = def.build();
  else {
    if (!packMeta) packMeta = (await (await fetch(DBDB + 'pack.json')).json()).elements;
    room = await buildStamps(def, packMeta);
  }
  room.def = def;
  cache.set(def.id, room);
  return room;
}
