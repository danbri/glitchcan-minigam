// critters.js — jelly critters: procedural splat creatures that hop and
// tumble around a room with squash-and-stretch physics, each with its own
// voice (TextTalker pitch/rate) and a viseme-driven mouth. The group-scene
// seed: every critter is an entity = a splat block rewritten per frame,
// exactly the mechanism the telepresence avatar uses.
import { FLOATS_PER_SPLAT } from './splat-renderer.js';
import { mulberry32 } from './pose-math.js';

export const SPLATS_PER_CRITTER = 196;

const PALETTES = [
  { body: [0.95, 0.5, 0.6], ear: [0.85, 0.35, 0.5], belly: [1.0, 0.85, 0.88] },   // pink
  { body: [0.55, 0.85, 0.5], ear: [0.4, 0.7, 0.35], belly: [0.85, 1.0, 0.8] },    // lime
  { body: [0.55, 0.68, 0.98], ear: [0.4, 0.5, 0.85], belly: [0.82, 0.88, 1.0] },  // blue
  { body: [0.98, 0.85, 0.35], ear: [0.85, 0.7, 0.2], belly: [1.0, 0.95, 0.7] },   // banana
  { body: [0.98, 0.65, 0.35], ear: [0.85, 0.5, 0.22], belly: [1.0, 0.85, 0.68] }, // orange
  { body: [0.8, 0.6, 0.95], ear: [0.65, 0.45, 0.85], belly: [0.92, 0.85, 1.0] },  // lavender
];

export const CRITTER_LINES = [
  'boing!', 'hello hello.', 'I am a small jelly.', 'wheee!', 'banana?',
  'bounce with me!', 'ooh, a visitor.', 'splat splat.', 'tiny thoughts, big hops.',
  'is it snack time?', 'the floor is springy today.', 'I like this room.',
];

// tiny value noise (hashed lattice, smooth bilinear) — perlin-style
// coherent randomness for gusts: nearby critters get similar-but-not-
// identical impulses
export function vnoise(x, y) {
  const h = (ix, iy) => {
    let n = ix * 374761393 + iy * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967296;
  };
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return (h(ix, iy) * (1 - sx) + h(ix + 1, iy) * sx) * (1 - sy)
    + (h(ix, iy + 1) * (1 - sx) + h(ix + 1, iy + 1) * sx) * sy;
}

// fling everyone skyward on a coherent noise field; heavier critters
// (bigger, or a raised weight slider) fly less
export function throwCritters(critters, power = 3.2, weight = 1) {
  const t0 = performance.now() * 0.0007;
  for (const c of critters) {
    const mass = weight * Math.pow(c.r / 0.18, 1.4);
    const nUp = vnoise(c.pos[0] * 0.8 + t0, c.pos[2] * 0.8 - t0);
    const nX = vnoise(c.pos[0] * 0.6 + 31.7, c.pos[2] * 0.6 + t0);
    const nZ = vnoise(c.pos[2] * 0.6 + 77.3 + t0, c.pos[0] * 0.6);
    c.vel[1] += power * (0.9 + nUp * 1.1) / mass;
    c.vel[0] += power * (nX - 0.5) * 1.4 / mass;
    c.vel[2] += power * (nZ - 0.5) * 1.4 / mass;
    c.squash = 0.65;
    c.squashV = -2;                          // anticipation snap
    c.justThrown = true;                     // page may play a flung yelp
    c.facing = Math.atan2(c.vel[0], c.vel[2]);
  }
}

export class Critter {
  constructor(seed, bounds = 2.4) {
    const rnd = mulberry32(seed);
    this.rnd = rnd;
    this.pal = PALETTES[seed % PALETTES.length];
    // size classes: most medium, some chonkers (+1/3), some littles
    const sizeMul = [1, 1, 1.33, 0.75, 1, 1.18, 0.8][seed % 7];
    this.r = (0.14 + rnd() * 0.08) * sizeMul;
    this.earLen = 0.7 + rnd() * 1.3;         // bunny ↔ blob spectrum
    this.bounds = bounds;
    const a = rnd() * Math.PI * 2, d = 0.6 + rnd() * (bounds - 0.8);
    this.pos = [Math.cos(a) * d, this.r + rnd() * 0.8, Math.sin(a) * d];
    this.vel = [0, 0, 0];
    this.facing = rnd() * Math.PI * 2;
    this.squash = 1;
    this.hopT = 0.4 + rnd() * 2;
    this.chirpT = 2 + rnd() * 12;
    this.jaw = 0;
    this.jumpTalent = 0.7 + rnd() * 0.9;     // some jump much higher than others
    this.elasticity = 0.6 + rnd() * 1.0;     // how jelly: squash depth + wobble
    this.squashV = 0;                        // squash spring velocity
    // per-critter voice: smaller critters squeak
    this.voicePitch = Math.max(0.3, 2.1 - this.r * 7 + (rnd() - 0.5) * 0.3);
    this.voiceRate = 0.9 + rnd() * 0.5;
  }

  // env: { floorY (rest height — sit ON tall grass, not inside it),
  //        obstacles: [{x, z, r}] — bouncy cylinder colliders (the hut),
  //        platforms: [{x, z, r, y}] — landable tops (XR tables/chairs),
  //        roamBounds — widens the home range (XR free-roam) }
  tick(dt, critters, env = {}) {
    const floorY = env.floorY || 0;
    const B = env.roamBounds ?? this.bounds;
    const p = this.pos, v = this.vel;
    v[1] -= (env.gravity ?? 6.5) * (env.weight ?? 1) * dt;
    p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
    // effective ground: the floor, or the top of a platform we are over
    // and above — jumping up from below passes through, falling lands
    let ground = floorY;
    for (const pf of env.platforms || []) {
      if (Math.hypot(p[0] - pf.x, p[2] - pf.z) < pf.r && v[1] <= 0.01
        && p[1] >= pf.y - 0.05) ground = Math.max(ground, pf.y);
    }
    let squashT = 1;
    if (p[1] <= this.r + ground) {           // ground contact
      const impact = Math.max(0, -v[1]);
      p[1] = this.r + ground;
      v[1] = impact > 0.4 ? impact * 0.35 : 0;   // damped bounce
      v[0] *= 0.85; v[2] *= 0.85;
      squashT = Math.max(0.35, 1 - impact * 0.16 * this.elasticity);
      if (impact > 1.1) this.justLanded = true;   // page may play a landing yelp
      this.hopT -= dt;
      if (this.hopT <= 0) {                  // hop somewhere (centre-biased)
        this.hopT = 0.8 + this.rnd() * 2.4;
        const toC = Math.atan2(-p[2], -p[0]);
        // cautious about the edges: the further out, the more the next
        // hop points home
        const edge = Math.hypot(p[0], p[2]) / B;
        let dir = this.rnd() < Math.max(0, (edge - 0.45) * 1.8)
          ? toC + (this.rnd() - 0.5) * 0.6
          : this.rnd() * Math.PI * 2;
        let power = (1.4 + this.rnd() * 1.3) * (env.jumpMul ?? 1) * this.jumpTalent;
        // free-roam: sometimes aim at a nearby platform (a real-world
        // table/chair top in XR) and jump hard enough to clear it
        if (env.platforms?.length && this.rnd() < 0.4) {
          let best = null, bd = 3;
          for (const pf of env.platforms) {
            const dd = Math.hypot(pf.x - p[0], pf.z - p[2]);
            if (dd < bd && pf.y > p[1] - 0.1) { bd = dd; best = pf; }
          }
          if (best) {
            dir = Math.atan2(best.z - p[2], best.x - p[0]);
            const rise = Math.max(0.2, best.y - p[1] + this.r + 0.15);
            const need = Math.sqrt(2 * (env.gravity ?? 6.5) * (env.weight ?? 1) * rise) * 1.06;
            power = Math.min(Math.max(power, need), 7);
          }
        }
        v[0] = Math.cos(dir) * power * 0.55;
        v[2] = Math.sin(dir) * power * 0.55;
        v[1] = power;
        this.facing = dir;
      }
    } else {
      squashT = 1 + Math.min(0.55, Math.abs(v[1]) * 0.09 * this.elasticity);  // airborne stretch
    }
    // obstacle colliders: bounce OFF the big things instead of through
    for (const ob of env.obstacles || []) {
      if (ob.h && p[1] - this.r * 0.3 > ob.h) continue;   // above its top
      const dx = p[0] - ob.x, dz = p[2] - ob.z;
      const d2 = Math.hypot(dx, dz), min2 = ob.r + this.r * 0.8;
      if (d2 > 1e-4 && d2 < min2) {
        const nx = dx / d2, nz = dz / d2;
        p[0] = ob.x + nx * min2; p[2] = ob.z + nz * min2;
        const vn = v[0] * nx + v[2] * nz;
        if (vn < 0) {                        // lively elastic bounce + a hop
          v[0] -= 2 * vn * nx; v[2] -= 2 * vn * nz;
          v[1] += 0.6;
          this.squash = Math.min(this.squash, 0.75);
          this.facing = Math.atan2(v[0], v[2]);
        }
      }
    }
    // edge caution: a continuous homeward pull grows near the boundary —
    // straying far feels effortful, so they cluster in the middle
    const dc = Math.hypot(p[0], p[2]);
    if (dc > B * 0.55) {
      const pull = (dc / B - 0.55) * 4.5 * dt;
      v[0] -= p[0] / dc * pull; v[2] -= p[2] / dc * pull;
    }
    // soft walls
    const d = Math.hypot(p[0], p[2]);
    if (d > B) {
      const nx = p[0] / d, nz = p[2] / d;
      p[0] = nx * B; p[2] = nz * B;
      const vn = v[0] * nx + v[2] * nz;
      if (vn > 0) { v[0] -= 2 * vn * nx; v[2] -= 2 * vn * nz; }
    }
    // critter-critter: HARD positional separation (no shared space) plus
    // a jelly velocity push; each moves half the overlap, so a pair
    // resolves symmetrically
    for (const o of critters) {
      if (o === this) continue;
      const dx = p[0] - o.pos[0], dy = p[1] - o.pos[1], dz = p[2] - o.pos[2];
      const dist = Math.hypot(dx, dy, dz), min = (this.r + o.r) * 0.92;
      if (dist > 1e-4 && dist < min) {
        const nx = dx / dist, ny = dy / dist, nz = dz / dist;
        const half = (min - dist) * 0.5;
        p[0] += nx * half; p[2] += nz * half;
        if (ny > 0.3) p[1] += ny * half;      // pushed off the top of another
        const push = (min - dist) * 3 * dt;
        v[0] += nx * push * 8; v[1] += Math.max(0, ny) * push * 4; v[2] += nz * push * 8;
        this.squash = Math.min(this.squash, 0.8);
      }
    }
    // damped-spring squash: underdamped, so impacts OVERSHOOT and jiggle —
    // jellier critters wobble longer
    const stiff = 150, zeta = 0.55 - this.elasticity * 0.2;
    this.squashV += ((squashT - this.squash) * stiff - this.squashV * 2 * Math.sqrt(stiff) * zeta) * dt;
    this.squash += this.squashV * dt;
    this.squash = Math.max(0.3, Math.min(1.65, this.squash));
  }

  // writes SPLATS_PER_CRITTER splats at out[off..]; jaw 0..1 opens the mouth
  build(out, off) {
    const rnd = mulberry32(99);              // stable per-frame body noise
    const { body, ear, belly } = this.pal;
    const s = this.squash, r = this.r;
    const sy = s, sxz = 1 / Math.sqrt(s);
    const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
    const rx = fz, rzz = -fx;                 // right vector
    const P = this.pos;
    let o = off;
    const put = (lx, ly, lz, sc, col, alpha = 1) => {
      // local → world: squash, face rotation, translate (splat quats stay
      // identity — jelly critters are all soft rounded shapes)
      const wx = (rx * lx + fx * lz) * sxz, wz = (rzz * lx + fz * lz) * sxz;
      out[o] = P[0] + wx; out[o + 1] = P[1] + ly * sy - r * (1 - sy) * 0.5; out[o + 2] = P[2] + wz;
      out[o + 3] = 0; out[o + 4] = 0; out[o + 5] = 0; out[o + 6] = 1;
      out[o + 7] = sc * sxz; out[o + 8] = sc * sy; out[o + 9] = sc;
      out[o + 10] = col[0]; out[o + 11] = col[1]; out[o + 12] = col[2]; out[o + 13] = alpha;
      o += FLOATS_PER_SPLAT;
    };
    // body — pear-ish shell, belly-lit front
    const GA = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < 150; i++) {
      const ny = 1 - 2 * (i + 0.5) / 150;
      const rr = Math.sqrt(Math.max(0, 1 - ny * ny)) * (1 - ny * 0.18);
      const ph = i * GA;
      const nx = Math.cos(ph) * rr, nz = Math.sin(ph) * rr;
      const isBelly = nz > 0.45 && ny < 0.35;
      const c = isBelly ? belly : body;
      const tone = 0.92 + rnd() * 0.16 + ny * 0.06;
      put(nx * r, ny * r * 0.95, nz * r, r * 0.22,
        [c[0] * tone, c[1] * tone, c[2] * tone]);
    }
    // ears (length varies per critter; flop against vertical velocity)
    const flop = Math.max(-0.5, Math.min(0.5, -this.vel[1] * 0.12));
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 8; k++) {
        const t = k / 7;
        put(sx * r * 0.38 + sx * t * flop * r * 0.3,
          r * (0.8 + t * this.earLen * 0.55),
          -r * 0.1 + t * flop * r * 0.5,
          r * (0.14 - t * 0.06), k > 5 ? [ear[0] * 1.1, ear[1] * 0.9, ear[2] * 0.95] : ear);
      }
    }
    // eyes + pupils (face forward)
    for (const sx of [-1, 1]) {
      put(sx * r * 0.32, r * 0.28, r * 0.82, r * 0.13, [0.98, 0.98, 0.96]);
      put(sx * r * 0.32, r * 0.28, r * 0.93, r * 0.055, [0.08, 0.07, 0.08]);
      put(sx * r * 0.30, r * 0.33, r * 0.97, r * 0.025, [1, 1, 1]);
    }
    // mouth — opens with the viseme jaw
    put(0, r * 0.02 - this.jaw * r * 0.1, r * 0.92, r * (0.06 + this.jaw * 0.12), [0.45, 0.15, 0.18]);
    put(0, r * 0.1, r * 0.9, r * 0.045, [body[0] * 0.75, body[1] * 0.6, body[2] * 0.6]);
    // feet
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        put(sx * r * (0.35 + k * 0.02), -r * 0.88, r * (0.15 + k * 0.06),
          r * 0.09, [body[0] * 0.85, body[1] * 0.8, body[2] * 0.8]);
      }
    }
    // pad to the fixed budget with invisible splats (count stays constant)
    while (o < off + SPLATS_PER_CRITTER * FLOATS_PER_SPLAT) {
      out[o + 13] = 0; out[o + 6] = 1; o += FLOATS_PER_SPLAT;
    }
  }
}
