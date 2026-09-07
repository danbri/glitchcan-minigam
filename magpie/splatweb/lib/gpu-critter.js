// gpu-critter.js — a Critter (lib/critters.js, UNCHANGED) driven by a
// WGSL compute shader for its per-frame transform, instead of
// Critter.build() rebuilding all 196 splats in JS every frame.
//
// Physics (Critter.tick()) stays exactly as-is, on CPU — it's small-N
// (per-critter, not per-splat), genuinely sequential/stateful game logic
// with critter-critter collision, not GPU-shaped work. Only the "turn
// this critter's live state into 196 splats" step moves to GPU — and
// now that includes ear-flop and jaw/mouth, not just squash+facing.
//
// How ear-flop and jaw get to the GPU without hand-deriving their
// geometry (and risking a mismatch with critters.js's real formulas):
// both effects are EXACTLY LINEAR in their driving value (vel[1] for
// flop, jaw for the mouth) in Critter.build()'s own code. So instead of
// re-deriving "which splat indices are ears" and "what's the flop
// coefficient", buildRestTemplate() calls the critter's own build()
// THREE times — once at rest, once with a probe flop, once with a probe
// jaw — and takes the numerical difference to recover the exact
// per-splat linear response. Any future change to critters.js's ear/
// mouth geometry is picked up automatically, with zero changes needed
// here, as long as build() stays linear in those two inputs (it visibly
// is: grep `this.vel[1]` and `this.jaw` in critters.js).
import { FLOATS_PER_SPLAT } from './splat-renderer.js';
import { SPLATS_PER_CRITTER } from './critters.js';
import { SplatComputePass } from './gpu-splat-compute.js';

const REST_STRIDE = 12; // lx,ly,lz, sc, r,g,b, alpha, flopDX,flopDZ, jawDY,jawDScale
const FLOP_PROBE = 0.5; // clamp range is [-0.5,0.5] — largest safe probe value
const JAW_PROBE = 1.0;  // jaw's own natural range is 0..1

const WGSL_TRANSFORM = /* wgsl */`
// OBJ layout: 0..2 pos xyz, 3 facing, 4 squash, 5 critter radius r,
// 6 flop (from live vel[1]), 7 jaw (live talk/viseme state), 8 alphaMult,
// 9..11 camPos xyz.
//
// GLASSY TRANSPARENCY: a flat alphaMult multiply looked wrong (user's own
// read: "nothing like the glassy transparency in the reference" —
// scottstts/Jelly-Baby's candy-like material) — because in THIS shader's
// premultiplied-alpha output (color.rgb * alpha, see splat-renderer-gpu.js
// fs()), scaling alpha down ALSO dims the colour contribution
// proportionally, so the whole critter just fades toward grey/black
// instead of reading as vivid see-through material.
//
// Real glass/jelly reads as "see-through facing the camera, more solid at
// the silhouette rim" — a fresnel term. Cheap to fake here with no
// lighting model at all: jelly critters are round, so each REST local
// point's OWN direction from the body centre already approximates its
// surface normal. rimAlpha = mix(alphaMult, 1.0, fresnel) — centre-facing
// splats (fresnel≈0) get the full translucent alphaMult; edge-on splats
// (fresnel≈1, dot(normal,viewDir)≈0) stay opaque, exactly the glass-
// sphere rim look. Backward compatible BY CONSTRUCTION: at alphaMult=1,
// mix(1,1,fresnel)=1 always regardless of view angle — zero change for
// every existing caller. Colour is boosted as rimAlpha drops, compensating
// for the same premultiplied dimming so the see-through parts stay vivid
// rather than washed out.
fn transform(i: u32) -> array<f32, 14> {
  let b = i * 12u;
  var lx = REST[b]; var lz = REST[b+2u];
  let ly0 = REST[b+1u]; var sc = REST[b+3u];
  let col = vec3<f32>(REST[b+4u], REST[b+5u], REST[b+6u]); let alpha = REST[b+7u];
  let flopDX = REST[b+8u]; let flopDZ = REST[b+9u];
  let jawDY = REST[b+10u]; let jawDScale = REST[b+11u];

  let px = OBJ[0]; let py = OBJ[1]; let pz = OBJ[2];
  let facing = OBJ[3]; let s = max(OBJ[4], 0.05); let r = OBJ[5];
  let flop = OBJ[6]; let jaw = OBJ[7]; let alphaMult = OBJ[8];
  let camPos = vec3<f32>(OBJ[9], OBJ[10], OBJ[11]);

  // local direction BEFORE flop/jaw/squash distort it — the least-noisy
  // approximation of "which way does this splat's patch of surface face"
  let nLocal = normalize(vec3<f32>(lx, ly0, lz) + vec3<f32>(1e-5, 0.0, 0.0));

  // apply the live-driven local deltas BEFORE squash/facing, matching
  // Critter.build()'s own order (flop/jaw shift the LOCAL point, put()
  // then squashes+rotates+translates it)
  lx = lx + flopDX * flop;
  lz = lz + flopDZ * flop;
  let ly = ly0 + jawDY * jaw;
  sc = sc + jawDScale * jaw;

  let fx = sin(facing); let fz = cos(facing);
  let sxz = 1.0 / sqrt(s);
  let wx = (fz*lx + fx*lz) * sxz;
  let wz = (-fx*lx + fz*lz) * sxz;

  let worldX = px + wx; let worldY = py + ly*s - r*(1.0-s)*0.5; let worldZ = pz + wz;
  let nWorld = normalize(vec3<f32>(fz*nLocal.x + fx*nLocal.z, nLocal.y, -fx*nLocal.x + fz*nLocal.z));
  let viewDir = normalize(camPos - vec3<f32>(worldX, worldY, worldZ));
  let fresnel = pow(clamp(1.0 - abs(dot(nWorld, viewDir)), 0.0, 1.0), 1.8);
  let rimAlpha = mix(alphaMult, 1.0, fresnel);
  let colorBoost = 1.0 + (1.0 - rimAlpha) * 0.8;

  var out: array<f32, 14>;
  out[0] = worldX; out[1] = worldY; out[2] = worldZ;
  out[3] = 0.0; out[4] = 0.0; out[5] = 0.0; out[6] = 1.0;
  out[7] = sc * sxz; out[8] = sc * s; out[9] = sc;
  out[10] = col.x * colorBoost; out[11] = col.y * colorBoost; out[12] = col.z * colorBoost;
  out[13] = alpha * rimAlpha;
  return out;
}
`;

// Runs Critter.build() with a fixed pose (squash/facing/pos/jaw/vel all
// pinned) and returns the raw splat buffer — a small helper so
// buildRestTemplate can probe multiple poses without repeating the
// save/restore dance three times over.
function buildAt(critter, { squash, facing, jaw, velY }) {
  const saved = { squash: critter.squash, facing: critter.facing, pos: critter.pos, jaw: critter.jaw, vel: critter.vel };
  critter.squash = squash; critter.facing = facing; critter.pos = [0, 0, 0]; critter.jaw = jaw; critter.vel = [0, velY, 0];
  const tmp = new Float32Array(SPLATS_PER_CRITTER * FLOATS_PER_SPLAT);
  critter.build(tmp, 0);
  Object.assign(critter, saved);
  return tmp;
}

function buildRestTemplate(critter) {
  const n = SPLATS_PER_CRITTER;
  const base = buildAt(critter, { squash: 1, facing: 0, jaw: 0, velY: 0 });
  // vel[1] = -FLOP_PROBE/0.12 makes Critter.build()'s flop come out to
  // exactly +FLOP_PROBE (flop = clamp(-vel[1]*0.12, -0.5, 0.5))
  const flopProbe = buildAt(critter, { squash: 1, facing: 0, jaw: 0, velY: -FLOP_PROBE / 0.12 });
  const jawProbe = buildAt(critter, { squash: 1, facing: 0, jaw: JAW_PROBE, velY: 0 });

  const rest = new Float32Array(n * REST_STRIDE);
  for (let i = 0; i < n; i++) {
    const si = i * FLOATS_PER_SPLAT, o = i * REST_STRIDE;
    rest[o] = base[si]; rest[o + 1] = base[si + 1]; rest[o + 2] = base[si + 2];
    rest[o + 3] = base[si + 7]; // scale.x == scale.y == scale.z at squash=1 (verified against put()'s math)
    rest[o + 4] = base[si + 10]; rest[o + 5] = base[si + 11]; rest[o + 6] = base[si + 12];
    rest[o + 7] = base[si + 13];
    rest[o + 8] = (flopProbe[si] - base[si]) / FLOP_PROBE;         // dx per unit flop
    rest[o + 9] = (flopProbe[si + 2] - base[si + 2]) / FLOP_PROBE; // dz per unit flop
    rest[o + 10] = (jawProbe[si + 1] - base[si + 1]) / JAW_PROBE;  // dy per unit jaw
    rest[o + 11] = (jawProbe[si + 7] - base[si + 7]) / JAW_PROBE;  // dScale per unit jaw
  }
  return { rest, count: n };
}

// device: from requestComputeDevice(). critter: a live Critter instance
// (lib/critters.js) whose .tick() the caller keeps calling every frame,
// unmodified — and whose .jaw the caller may keep driving from a
// TextTalker/viseme clip exactly as demo-critters.html already does.
// outBuffer: the GPU storage buffer to write into.
export function createGpuCritter(device, critter, outBuffer) {
  const { rest, count } = buildRestTemplate(critter);
  const pass = new SplatComputePass(device, { restStride: REST_STRIDE, wgslTransform: WGSL_TRANSFORM, maxObjFloats: 12 });
  pass.setData(rest, count, outBuffer);
  const obj = new Float32Array(12);
  return {
    splatCount: count,
    // alphaMult (0..1, default 1 — identical to every existing caller):
    // the glassy/fresnel-rim translucency strength (see the WGSL comment
    // above) — 1 disables it entirely regardless of camPos. camPos
    // (default [0,0,3], only read when alphaMult<1) should be the
    // caller's actual camera world position for the rim to face the
    // right way; harmless if approximate for a small critter.
    dispatch({ alphaMult = 1, camPos = [0, 0, 3] } = {}) {
      obj[0] = critter.pos[0]; obj[1] = critter.pos[1]; obj[2] = critter.pos[2];
      obj[3] = critter.facing; obj[4] = critter.squash; obj[5] = critter.r;
      obj[6] = Math.max(-0.5, Math.min(0.5, -critter.vel[1] * 0.12)); // same formula as Critter.build()'s own `flop`
      obj[7] = critter.jaw; obj[8] = alphaMult;
      obj[9] = camPos[0]; obj[10] = camPos[1]; obj[11] = camPos[2];
      pass.dispatch(obj);
    },
  };
}
