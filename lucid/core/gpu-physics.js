/**
 * GPU physics — step 1 & 2: a writable body buffer and one integrator pass.
 *
 * The plan (see clipclop/README): physics does not need its own world. It
 * writes transforms. So a body is just a position + velocity, and one compute
 * pass integrates it. On the GPU the state lives in a storage buffer and never
 * comes back to the CPU — no readback, which is what makes web physics fast.
 *
 * This module ships two things that MUST agree:
 *   1. generatePhysicsWgsl(cfg)  — the real GPU compute shader (the artifact).
 *   2. stepBodies(bodies, cfg)   — a CPU twin with the SAME math, line for line.
 * The twin is how we verify the physics in Node (no WebGPU headless) and how the
 * Mayfly demo drives shapes so you can see it. On a WebGPU device the shader
 * runs as a compute pass; the twin is the oracle it must match.
 *
 * Step 1&2 scope: gravity, damping, integrate, ground bounce, wall reflect —
 * single dispatch, O(N), no cross-body sync. Pairwise piling and XPBD joints
 * (the quadruped puppet) are the next steps.
 */

export function defaultPhysicsConfig() {
  return {
    gravity: -9.8,
    dt: 1 / 60,
    damping: 0.995,     // velocity retained per step (air drag)
    restitution: 0.45,  // bounce energy on the ground
    friction: 0.86,     // tangential velocity kept on ground contact
    radius: 0.35,       // body radius (sphere)
    groundY: 0,
    bound: 2.2          // half-extent of the x/z box the bodies live in
  };
}

/** Deterministic initial bodies: a jittered stack above the ground. No RNG. */
export function initBodies(n, cfg = defaultPhysicsConfig()) {
  const bodies = [];
  const cols = Math.ceil(Math.sqrt(n));
  for (let i = 0; i < n; i++) {
    const gx = (i % cols) - (cols - 1) / 2;
    const gz = Math.floor(i / cols) - (cols - 1) / 2;
    // index-based jitter (reproducible)
    const jx = ((i * 0.3197) % 1 - 0.5) * 0.25;
    const jz = ((i * 0.7331) % 1 - 0.5) * 0.25;
    // start tight so pairwise separation piles them into a heap
    bodies.push({
      p: [gx * cfg.radius * 1.15 + jx, 2.2 + (i % 6) * 0.5, gz * cfg.radius * 1.15 + jz],
      v: [0, 0, 0]
    });
  }
  return bodies;
}

/**
 * CPU twin of the integrator. Mutates bodies in place. MUST stay identical to
 * the WGSL `integrate` entry below — same order, same ops.
 */
export function stepBodies(bodies, cfg = defaultPhysicsConfig()) {
  const { gravity, dt, damping, restitution, friction, radius, groundY, bound } = cfg;
  for (const b of bodies) {
    let [px, py, pz] = b.p;
    let [vx, vy, vz] = b.v;

    // integrate (semi-implicit Euler)
    vy += gravity * dt;
    vx *= damping; vy *= damping; vz *= damping;
    px += vx * dt; py += vy * dt; pz += vz * dt;

    // ground
    if (py < groundY + radius) {
      py = groundY + radius;
      vy = -vy * restitution;
      vx *= friction; vz *= friction;
    }
    // walls (reflect at the box edges)
    if (px > bound - radius) { px = bound - radius; vx = -vx * restitution; }
    if (px < -bound + radius) { px = -bound + radius; vx = -vx * restitution; }
    if (pz > bound - radius) { pz = bound - radius; vz = -vz * restitution; }
    if (pz < -bound + radius) { pz = -bound + radius; vz = -vz * restitution; }

    b.p = [px, py, pz];
    b.v = [vx, vy, vz];
  }
  return bodies;
}

/**
 * Pairwise separation (step 3). Jacobi push-apart: read a SNAPSHOT of all
 * positions, write corrected ones, so the result is order-independent and maps
 * 1:1 to a GPU pass that reads `bodies` and writes `scratch`. Runs K iterations.
 * Bodies that overlap get pushed apart by half the overlap each. Re-clamped to
 * the ground and walls afterwards. Mirrors the WGSL `collide` entry.
 */
export function collideBodies(bodies, cfg = defaultPhysicsConfig(), iterations = 4) {
  const { radius, groundY, bound } = cfg;
  const minD = 2 * radius;
  for (let it = 0; it < iterations; it++) {
    const snap = bodies.map(b => b.p.slice());  // Jacobi snapshot
    for (let i = 0; i < bodies.length; i++) {
      let cx = 0, cy = 0, cz = 0;
      const [ax, ay, az] = snap[i];
      for (let j = 0; j < bodies.length; j++) {
        if (j === i) continue;
        const dx = ax - snap[j][0], dy = ay - snap[j][1], dz = az - snap[j][2];
        const dist = Math.hypot(dx, dy, dz);
        if (dist < minD && dist > 1e-6) {
          const push = (minD - dist) * 0.5 / dist;
          cx += dx * push; cy += dy * push; cz += dz * push;
        }
      }
      let px = ax + cx, py = ay + cy, pz = az + cz;
      // re-clamp to ground and walls
      if (py < groundY + radius) py = groundY + radius;
      px = Math.max(-bound + radius, Math.min(bound - radius, px));
      pz = Math.max(-bound + radius, Math.min(bound - radius, pz));
      bodies[i].p = [px, py, pz];
    }
  }
  return bodies;
}

/** One full frame: integrate, then K separation iterations. */
export function stepPhysics(bodies, cfg = defaultPhysicsConfig(), collideIters = 4) {
  stepBodies(bodies, cfg);
  collideBodies(bodies, cfg, collideIters);
  return bodies;
}

// ---- XPBD distance constraints (step 4) ---------------------------------
// Bodies gain an inverse mass `w` (default 1; a pinned body has w = 0). A
// constraint {a, b, rest, compliance} holds two bodies a fixed distance apart.
// This is what turns loose bodies into a jointed structure — a rope, a net, or
// a creature whose limbs stay attached.

const invMass = (b) => (b.w === undefined ? 1 : b.w);

/**
 * One XPBD frame: predict, solve constraints (+ ground/walls) K iterations,
 * then derive velocity from the position change. Deterministic. The CPU twin of
 * the GPU solver (whose GPU form needs constraint colouring — the next artifact).
 */
export function stepXPBD(bodies, constraints, cfg = defaultPhysicsConfig(), iters = 8) {
  const { gravity, dt, damping, radius, groundY, bound } = cfg;
  const prev = bodies.map(b => b.p.slice());

  // predict (only non-pinned bodies move)
  for (const b of bodies) {
    if (invMass(b) > 0) {
      b.v[1] += gravity * dt;
      b.v = [b.v[0] * damping, b.v[1] * damping, b.v[2] * damping];
      b.p = [b.p[0] + b.v[0] * dt, b.p[1] + b.v[1] * dt, b.p[2] + b.v[2] * dt];
    }
  }

  const adt2 = dt * dt;
  for (let it = 0; it < iters; it++) {
    for (const con of constraints) {
      const a = bodies[con.a], b = bodies[con.b];
      const wa = invMass(a), wb = invMass(b);
      if (wa + wb === 0) continue;
      const dx = a.p[0] - b.p[0], dy = a.p[1] - b.p[1], dz = a.p[2] - b.p[2];
      const dist = Math.hypot(dx, dy, dz) || 1e-6;
      const C = dist - con.rest;
      const alpha = (con.compliance || 0) / adt2;
      const s = (-C / (wa + wb + alpha)) / dist;
      a.p = [a.p[0] + dx * s * wa, a.p[1] + dy * s * wa, a.p[2] + dz * s * wa];
      b.p = [b.p[0] - dx * s * wb, b.p[1] - dy * s * wb, b.p[2] - dz * s * wb];
    }
    // ground + walls per iteration
    for (const bd of bodies) {
      if (bd.p[1] < groundY + radius) bd.p[1] = groundY + radius;
      bd.p[0] = Math.max(-bound + radius, Math.min(bound - radius, bd.p[0]));
      bd.p[2] = Math.max(-bound + radius, Math.min(bound - radius, bd.p[2]));
    }
  }

  // velocity from motion; pinned bodies are held exactly
  for (let i = 0; i < bodies.length; i++) {
    if (invMass(bodies[i]) > 0) {
      bodies[i].v = [(bodies[i].p[0] - prev[i][0]) / dt, (bodies[i].p[1] - prev[i][1]) / dt, (bodies[i].p[2] - prev[i][2]) / dt];
    } else {
      bodies[i].p = prev[i].slice();
      bodies[i].v = [0, 0, 0];
    }
  }
  return bodies;
}

/** A chain of `n` bodies between two pinned ends → sags into a catenary. */
export function buildChain(n, a, b, cfg = defaultPhysicsConfig()) {
  const bodies = [], constraints = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    bodies.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 0.001 * i, a[2] + (b[2] - a[2]) * t], v: [0, 0, 0], w: (i === 0 || i === n - 1) ? 0 : 1 });
  }
  // segment rest length > end span / segments, so the chain has slack and sags
  const seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (n - 1) * 1.35;
  for (let i = 0; i < n - 1; i++) constraints.push({ a: i, b: i + 1, rest: seg, compliance: 0 });
  return { bodies, constraints };
}

/**
 * A quadruped skeleton as XPBD bodies + bone constraints — a physical ragdoll.
 * 10 joints (shoulder, mid-spine, hip, neck, head, tail, four feet) linked by
 * rigid bones. Drop it and it flops and settles: geometry driven by physics.
 * @returns {{ bodies, constraints, bones, joints }} bones/joints for rendering.
 */
export function buildQuadrupedRig(opts = {}) {
  const stand = opts.stand || false;                 // stand on pinned feet vs flop
  const bodyLen = opts.bodyLen ?? 1.6;
  const standH = opts.standH ?? 1.1;
  const spread = opts.spread ?? 0.5;
  const footY = opts.footY ?? 0.15;                  // ground contact height
  const y0 = opts.dropY ?? (stand ? 0 : 1.2);        // stand at ground, or fall from height
  // neck/head/tail reach — species proportions (defaults = the neutral animal).
  const neckUp = opts.neckUp ?? 0.22, neckFwd = opts.neckFwd ?? 0.14;
  const headUp = opts.headUp ?? 0.30, headFwd = opts.headFwd ?? 0.30;
  const tailUp = opts.tailUp ?? 0.10, tailBack = opts.tailBack ?? 0.70;

  const J = {}; // name -> position
  const hz = bodyLen / 2;
  const fy = stand ? footY : y0;                     // feet on the ground when standing
  J.shoulder = [0, standH + y0, -hz];
  J.mid = [0, standH + y0 + 0.05, 0];
  J.hip = [0, standH + y0, hz];
  J.neck = [0, standH + y0 + neckUp, -hz - neckFwd];
  J.head = [0, standH + y0 + headUp, -hz - headFwd];
  J.tail = [0, standH + y0 + tailUp, hz + tailBack];
  J.footFL = [-spread, fy, -hz + 0.1];
  J.footFR = [spread, fy, -hz + 0.1];
  J.footBL = [-spread, fy, hz - 0.1];
  J.footBR = [spread, fy, hz - 0.1];

  const names = Object.keys(J);
  const idx = Object.fromEntries(names.map((n, i) => [n, i]));
  // When standing, pin the feet AND the spine ends (shoulder, hip). Distance
  // constraints fix bone LENGTHS, not ANGLES, so pinning feet alone lets the
  // body pendulum down and collapse. Pinning both ends of each leg makes the
  // stance rigid; only the neck, head and tail hang and settle naturally.
  const pinned = (n) => n.startsWith('foot') || n === 'shoulder' || n === 'hip' || n === 'neck' || n === 'head';
  const bodies = names.map(n => ({ p: J[n].slice(), v: [0, 0, 0], w: (stand && pinned(n)) ? 0 : 1 }));

  const dist = (a, b) => Math.hypot(J[a][0] - J[b][0], J[a][1] - J[b][1], J[a][2] - J[b][2]);
  const boneList = [
    ['shoulder', 'mid'], ['mid', 'hip'], ['shoulder', 'hip'],   // spine + brace
    ['shoulder', 'neck'], ['neck', 'head'],                     // neck
    ['hip', 'tail'],                                            // tail
    ['shoulder', 'footFL'], ['shoulder', 'footFR'],            // front legs
    ['hip', 'footBL'], ['hip', 'footBR'],                      // back legs
    ['footFL', 'footFR'], ['footBL', 'footBR']                 // stance braces
  ];
  const constraints = boneList.map(([a, b]) => ({ a: idx[a], b: idx[b], rest: dist(a, b), compliance: a === 'shoulder' && b === 'hip' ? 0.0 : 0.0 }));
  const bones = boneList.map(([a, b]) => [idx[a], idx[b]]);
  return { bodies, constraints, bones, joints: names };
}

// ---- GPU constraint solving: graph colouring (step "item 1") ------------
// Two constraints that share a body cannot be solved in the same parallel
// dispatch (they'd write the same body — a race). Greedy graph colouring splits
// the constraints into BATCHES where no two share a body; each batch is then one
// race-free compute dispatch. This is what lets XPBD run on the GPU.

/** @returns {{ batches: number[][], colors: number }} batches of constraint indices. */
export function colorConstraints(constraints) {
  const colorOf = new Array(constraints.length).fill(-1);
  // bodyColors[body] = Set of colors already used by a constraint touching it
  const bodyColors = new Map();
  const used = (b) => bodyColors.get(b) || (bodyColors.set(b, new Set()), bodyColors.get(b));
  for (let i = 0; i < constraints.length; i++) {
    const { a, b } = constraints[i];
    let c = 0;
    while (used(a).has(c) || used(b).has(c)) c++;
    colorOf[i] = c;
    used(a).add(c); used(b).add(c);
  }
  const colors = Math.max(0, ...colorOf) + 1;
  const batches = Array.from({ length: colors }, () => []);
  colorOf.forEach((c, i) => batches[c].push(i));
  return { batches, colors };
}

/**
 * XPBD stepped batch-by-batch, exactly as the GPU would dispatch it (one batch =
 * one race-free pass). Same result as stepXPBD, proving the colouring is usable.
 */
export function stepXPBDColored(bodies, constraints, batches, cfg = defaultPhysicsConfig(), iters = 8) {
  const { gravity, dt, damping, radius, groundY, bound } = cfg;
  const prev = bodies.map(b => b.p.slice());
  for (const b of bodies) {
    if (invMass(b) > 0) {
      b.v[1] += gravity * dt;
      b.v = [b.v[0] * damping, b.v[1] * damping, b.v[2] * damping];
      b.p = [b.p[0] + b.v[0] * dt, b.p[1] + b.v[1] * dt, b.p[2] + b.v[2] * dt];
    }
  }
  const adt2 = dt * dt;
  for (let it = 0; it < iters; it++) {
    for (const batch of batches) {          // each batch is parallel-safe on the GPU
      for (const ci of batch) {
        const con = constraints[ci];
        const a = bodies[con.a], b = bodies[con.b];
        const wa = invMass(a), wb = invMass(b);
        if (wa + wb === 0) continue;
        const dx = a.p[0] - b.p[0], dy = a.p[1] - b.p[1], dz = a.p[2] - b.p[2];
        const dist = Math.hypot(dx, dy, dz) || 1e-6;
        const s = (-(dist - con.rest) / (wa + wb + (con.compliance || 0) / adt2)) / dist;
        a.p = [a.p[0] + dx * s * wa, a.p[1] + dy * s * wa, a.p[2] + dz * s * wa];
        b.p = [b.p[0] - dx * s * wb, b.p[1] - dy * s * wb, b.p[2] - dz * s * wb];
      }
    }
    for (const bd of bodies) {
      if (bd.p[1] < groundY + radius) bd.p[1] = groundY + radius;
      bd.p[0] = Math.max(-bound + radius, Math.min(bound - radius, bd.p[0]));
      bd.p[2] = Math.max(-bound + radius, Math.min(bound - radius, bd.p[2]));
    }
  }
  for (let i = 0; i < bodies.length; i++) {
    if (invMass(bodies[i]) > 0) bodies[i].v = [(bodies[i].p[0] - prev[i][0]) / dt, (bodies[i].p[1] - prev[i][1]) / dt, (bodies[i].p[2] - prev[i][2]) / dt];
    else { bodies[i].p = prev[i].slice(); bodies[i].v = [0, 0, 0]; }
  }
  return bodies;
}

/**
 * The GPU constraint-solve compute shader. One dispatch per colour batch: each
 * thread owns one constraint in the batch and writes both its bodies — safe
 * because a batch shares no bodies. Host loops batches × iterations.
 */
export function generateXpbdSolveWgsl() {
  return `// ===== XPBD constraint solve — one race-free colour batch =====
struct Body { pos: vec4f, vel: vec4f };
struct Con { ab: vec2u, rest: f32, compliance: f32 }; // a,b indices; rest; compliance
@group(0) @binding(0) var<storage, read_write> bodies: array<Body>;
@group(0) @binding(1) var<storage, read> cons: array<Con>;   // constraints of THIS batch
@group(0) @binding(2) var<uniform> u: vec4f;                  // x = invW default, y = dt

@compute @workgroup_size(64)
fn solve(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= arrayLength(&cons)) { return; }
  let c = cons[i];
  let pa = bodies[c.ab.x].pos.xyz;
  let pb = bodies[c.ab.y].pos.xyz;
  let wa = bodies[c.ab.x].vel.w;   // inverse mass packed in vel.w
  let wb = bodies[c.ab.y].vel.w;
  if (wa + wb == 0.0) { return; }
  let d = pa - pb;
  let dist = max(length(d), 1e-6);
  let alpha = c.compliance / (u.y * u.y);
  let s = (-(dist - c.rest) / (wa + wb + alpha)) / dist;
  bodies[c.ab.x].pos = vec4f(pa + d * (s * wa), 0.0);
  bodies[c.ab.y].pos = vec4f(pb - d * (s * wb), 0.0);
}
`;
}

const f = (v) => (Number.isInteger(v) ? v + '.0' : String(v));

/**
 * The GPU compute shader. Bodies live in a read_write storage buffer; the host
 * dispatches `integrate` once per frame. State never leaves the GPU.
 */
export function generatePhysicsWgsl(cfg = defaultPhysicsConfig()) {
  const { gravity, dt, damping, restitution, friction, radius, groundY, bound } = cfg;
  return `// ===== GPU physics — integrator (generated) =====
// One dispatch per frame. Body state stays in the storage buffer: no readback.
struct Body { pos: vec4f, vel: vec4f };
@group(0) @binding(0) var<storage, read_write> bodies: array<Body>;

const G: f32 = ${f(gravity)};
const DT: f32 = ${f(dt)};
const DAMP: f32 = ${f(damping)};
const REST: f32 = ${f(restitution)};
const FRIC: f32 = ${f(friction)};
const RAD: f32 = ${f(radius)};
const GROUND: f32 = ${f(groundY)};
const BOUND: f32 = ${f(bound)};

@compute @workgroup_size(64)
fn integrate(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= arrayLength(&bodies)) { return; }
  var p = bodies[i].pos.xyz;
  var v = bodies[i].vel.xyz;

  // integrate (semi-implicit Euler)
  v.y = v.y + G * DT;
  v = v * DAMP;
  p = p + v * DT;

  // ground
  if (p.y < GROUND + RAD) {
    p.y = GROUND + RAD;
    v.y = -v.y * REST;
    v.x = v.x * FRIC; v.z = v.z * FRIC;
  }
  // walls
  if (p.x >  BOUND - RAD) { p.x =  BOUND - RAD; v.x = -v.x * REST; }
  if (p.x < -BOUND + RAD) { p.x = -BOUND + RAD; v.x = -v.x * REST; }
  if (p.z >  BOUND - RAD) { p.z =  BOUND - RAD; v.z = -v.z * REST; }
  if (p.z < -BOUND + RAD) { p.z = -BOUND + RAD; v.z = -v.z * REST; }

  bodies[i].pos = vec4f(p, 0.0);
  bodies[i].vel = vec4f(v, 0.0);
}

// Pairwise separation (step 3). Jacobi: read bodies, write scratch. The host
// runs this K times per frame, copying scratch -> bodies between iterations.
@group(0) @binding(1) var<storage, read_write> scratch: array<vec4f>;

@compute @workgroup_size(64)
fn collide(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  let n = arrayLength(&bodies);
  if (i >= n) { return; }
  let minD = 2.0 * RAD;
  let a = bodies[i].pos.xyz;
  var corr = vec3f(0.0, 0.0, 0.0);
  for (var j: u32 = 0u; j < n; j = j + 1u) {
    if (j == i) { continue; }
    let d = a - bodies[j].pos.xyz;
    let dist = length(d);
    if (dist < minD && dist > 1e-6) {
      corr = corr + d * ((minD - dist) * 0.5 / dist);
    }
  }
  var p = a + corr;
  p.y = max(p.y, GROUND + RAD);
  p.x = clamp(p.x, -BOUND + RAD, BOUND - RAD);
  p.z = clamp(p.z, -BOUND + RAD, BOUND - RAD);
  scratch[i] = vec4f(p, 0.0);
}
`;
}

/**
 * A scene of N spheres, every value a uniform — compile ONCE, then setParam per
 * frame (no per-frame shader recompile, which is what makes the demos janky).
 */
export function spheresUniformScene(n, opts = {}) {
  const children = [];
  const params = {};   // declare every var so Stinkyfish's fixed layout includes it
  for (let i = 0; i < n; i++) {
    for (const s of [`sx${i}`, `sy${i}`, `sz${i}`, `sr${i}`, `sc${i}r`, `sc${i}g`, `sc${i}b`]) params[s] = { type: 'scalar', value: 0 };
    children.push({ type: 'sphere',
      params: { r: { var: `sr${i}` }, color: [{ var: `sc${i}r` }, { var: `sc${i}g` }, { var: `sc${i}b` }] },
      transform: { translate: [{ var: `sx${i}` }, { var: `sy${i}` }, { var: `sz${i}` }] } });
  }
  const root = opts.smooth
    ? { type: 'smoothUnion', k: opts.k || 0.1, children }
    : { type: 'union', children };
  return { name: 'spheres', params, root };
}

/** {uniformName: value} map for N sphere bodies. radius may be a number or fn. */
export function spheresToUniforms(bodies, radius, colorFn) {
  const u = {};
  bodies.forEach((b, i) => {
    u[`sx${i}`] = b.p[0]; u[`sy${i}`] = b.p[1]; u[`sz${i}`] = b.p[2];
    u[`sr${i}`] = typeof radius === 'function' ? radius(i) : radius;
    const c = colorFn ? colorFn(i) : [0.5, 0.6, 0.85];
    u[`sc${i}r`] = c[0]; u[`sc${i}g`] = c[1]; u[`sc${i}b`] = c[2];
  });
  return u;
}

/** Build a Lucid scene (union of spheres) from body positions, for rendering. */
export function bodiesToScene(bodies, cfg = defaultPhysicsConfig(), colorFn) {
  const children = bodies.map((b, i) => ({
    type: 'sphere',
    params: { r: cfg.radius, color: colorFn ? colorFn(i) : [0.4 + 0.5 * ((i * 0.37) % 1), 0.55, 0.85] },
    transform: { translate: b.p.slice() }
  }));
  // a thin ground slab so contact reads
  children.push({
    type: 'box',
    params: { size: [cfg.bound, 0.05, cfg.bound], color: [0.18, 0.2, 0.24] },
    transform: { translate: [0, cfg.groundY - 0.05, 0] }
  });
  return { name: 'physics', root: { type: 'union', children } };
}
