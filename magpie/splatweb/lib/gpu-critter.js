// gpu-critter.js — a Critter (lib/critters.js, UNCHANGED) driven by a
// WGSL compute shader for its per-frame squash/facing transform, instead
// of Critter.build() rebuilding all 196 splats in JS every frame.
//
// Physics (Critter.tick()) stays exactly as-is, on CPU — it's small-N
// (per-critter, not per-splat), genuinely sequential/stateful game logic
// with critter-critter collision, not GPU-shaped work. Only the "turn
// this critter's pose into 196 splats" step moves to GPU.
//
// Scope, disclosed: jaw/mouth animation is NOT ported — the rest
// template is built with jaw=0 and stays that way. Everything else
// Critter.build() draws (body, ears with velocity flop baked at template
// time... see buildRestTemplate below for why ear-flop is also frozen)
// works; see lib/gpu-splat-compute.js's header for the general scope note.
import { FLOATS_PER_SPLAT } from './splat-renderer.js';
import { SPLATS_PER_CRITTER } from './critters.js';
import { SplatComputePass } from './gpu-splat-compute.js';

const REST_STRIDE = 8; // lx, ly, lz, sc, r, g, b, alpha

const WGSL_TRANSFORM = /* wgsl */`
// OBJ layout: 0..2 pos xyz, 3 facing, 4 squash, 5 critter radius r
fn transform(i: u32) -> array<f32, 14> {
  let b = i * 8u;
  let lx = REST[b]; let ly = REST[b+1u]; let lz = REST[b+2u]; let sc = REST[b+3u];
  let col = vec3<f32>(REST[b+4u], REST[b+5u], REST[b+6u]); let alpha = REST[b+7u];

  let px = OBJ[0]; let py = OBJ[1]; let pz = OBJ[2];
  let facing = OBJ[3]; let s = max(OBJ[4], 0.05); let r = OBJ[5];
  let fx = sin(facing); let fz = cos(facing);
  let sxz = 1.0 / sqrt(s);
  // same local->world as Critter.build()'s put(): squash, face rotation,
  // translate. Splat orientation stays identity (jelly critters are soft
  // rounded blobs with no oriented geometry, same as the CPU version).
  let wx = (fz*lx + fx*lz) * sxz;
  let wz = (-fx*lx + fz*lz) * sxz;

  var out: array<f32, 14>;
  out[0] = px + wx; out[1] = py + ly*s - r*(1.0-s)*0.5; out[2] = pz + wz;
  out[3] = 0.0; out[4] = 0.0; out[5] = 0.0; out[6] = 1.0;
  out[7] = sc * sxz; out[8] = sc * s; out[9] = sc;
  out[10] = col.x; out[11] = col.y; out[12] = col.z; out[13] = alpha;
  return out;
}
`;

// Reuses Critter.build() ITSELF (unmodified) to generate the rest
// template: temporarily pin squash=1/facing=0/pos=0/jaw=0 (identity
// transform — see the module header for why jaw stays 0 permanently),
// call the critter's own build(), read back the now-local-space
// positions/colours, then restore the critter's real live state. This
// is the same trick demo-compositor.html's design relies on elsewhere in
// this session: reuse existing content-generation code unchanged, only
// move the PER-FRAME transform step.
function buildRestTemplate(critter) {
  const savedSquash = critter.squash, savedFacing = critter.facing, savedPos = critter.pos, savedJaw = critter.jaw, savedVel = critter.vel;
  critter.squash = 1; critter.facing = 0; critter.pos = [0, 0, 0]; critter.jaw = 0; critter.vel = [0, 0, 0];
  const n = SPLATS_PER_CRITTER;
  const tmp = new Float32Array(n * FLOATS_PER_SPLAT);
  critter.build(tmp, 0);
  critter.squash = savedSquash; critter.facing = savedFacing; critter.pos = savedPos; critter.jaw = savedJaw; critter.vel = savedVel;

  const rest = new Float32Array(n * REST_STRIDE);
  for (let i = 0; i < n; i++) {
    const si = i * FLOATS_PER_SPLAT, o = i * REST_STRIDE;
    rest[o] = tmp[si]; rest[o + 1] = tmp[si + 1]; rest[o + 2] = tmp[si + 2];
    rest[o + 3] = tmp[si + 7]; // scale.x == scale.y == scale.z at squash=1 (verified against put()'s math)
    rest[o + 4] = tmp[si + 10]; rest[o + 5] = tmp[si + 11]; rest[o + 6] = tmp[si + 12];
    rest[o + 7] = tmp[si + 13];
  }
  return { rest, count: n };
}

// device: from requestComputeDevice(). critter: a live Critter instance
// (lib/critters.js) whose .tick() the caller keeps calling every frame,
// unmodified. outBuffer: the GPU storage buffer to write into.
export function createGpuCritter(device, critter, outBuffer) {
  const { rest, count } = buildRestTemplate(critter);
  const pass = new SplatComputePass(device, { restStride: REST_STRIDE, wgslTransform: WGSL_TRANSFORM, maxObjFloats: 8 });
  pass.setData(rest, count, outBuffer);
  const obj = new Float32Array(8);
  return {
    splatCount: count,
    dispatch() {
      obj[0] = critter.pos[0]; obj[1] = critter.pos[1]; obj[2] = critter.pos[2];
      obj[3] = critter.facing; obj[4] = critter.squash; obj[5] = critter.r;
      pass.dispatch(obj);
    },
  };
}
