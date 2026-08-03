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
