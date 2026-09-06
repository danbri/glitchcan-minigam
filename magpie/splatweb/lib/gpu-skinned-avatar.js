// gpu-skinned-avatar.js — a LamHeadAvatar (lib/lam-splats.js, UNCHANGED,
// loaded exactly as any CPU demo would via loadLamAvatar()) driven by a
// WGSL compute shader instead of its own pose()'s per-splat JS loop.
//
// Scope, disclosed: skinning (bone rotation), morph-target blending
// (visemes + blink — see MORPH_NAMES below), and a subset of the
// pentagram demo's stylize params (dissolve, twinkle, roundness, ghost
// tint) run on GPU. The CPU pipeline's "lag"/particle/swirl effects are
// NOT ported here — see lib/gpu-splat-compute.js's header for the full
// disclosed scope.
import { qMul } from './pose-math.js';
import { SplatComputePass } from './gpu-splat-compute.js';

// The 15 ARKit morphs lib/lam-visemes.js's VISEMES table actually
// combines (grep the file for the full list — jawOpen/mouthFunnel/
// mouthPucker/etc.), plus the two blink channels idle poses use. LAM
// avatars carry all 51 ARKit targets, but baking all 51 as static
// per-splat GPU buffers would be ~8MB/avatar for channels nothing in
// this project ever drives; this 17-name subset is ~2MB/avatar and
// covers everything sampleTalkBurst()/idle blink actually produce.
const MORPH_NAMES = [
  'jawOpen', 'mouthFunnel', 'mouthPucker', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthRollUpper', 'mouthClose', 'mouthPressLeft', 'mouthPressRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight', 'eyeBlinkLeft', 'eyeBlinkRight',
];
const N_MORPHS = MORPH_NAMES.length; // 17

const REST_STRIDE = 24 + N_MORPHS * 3 + 1; // base 24 + one xyz delta per morph + 1 sizeSeed
const IDENTITY_Q = [0, 0, 0, 1];

// Duplicated from lam-splats.js's own private helpers (not exported
// there) rather than risking a change to that file — these are the
// exact same three small pure functions, used the exact same way, only
// to recompute avatar.J (the joint matrix palette) each frame WITHOUT
// running pose()'s big per-splat loop.
const quatToMat3 = (q) => {
  const [x, y, z, w] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y),
    2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x),
    2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)];
};
const mul3 = (a, b) => [
  a[0] * b[0] + a[3] * b[1] + a[6] * b[2], a[1] * b[0] + a[4] * b[1] + a[7] * b[2], a[2] * b[0] + a[5] * b[1] + a[8] * b[2],
  a[0] * b[3] + a[3] * b[4] + a[6] * b[5], a[1] * b[3] + a[4] * b[4] + a[7] * b[5], a[2] * b[3] + a[5] * b[4] + a[8] * b[5],
  a[0] * b[6] + a[3] * b[7] + a[6] * b[8], a[1] * b[6] + a[4] * b[7] + a[7] * b[8], a[2] * b[6] + a[5] * b[7] + a[8] * b[8],
];

// Mirrors the FK half of LamHeadAvatar.pose() (lam-splats.js) — walks the
// node tree, composes bone rotations, rebuilds the joint matrix palette
// into avatar.J. Reuses the avatar's OWN scratch arrays (accum/newRot/
// newPos/J), exactly as pose() itself does, so this allocates nothing
// per frame. Deliberately NOT calling pose() itself — that would also
// run the expensive per-splat loop this whole module exists to avoid.
function updateJointPalette(avatar, bones = {}) {
  const { parent, order, restRot, restPos, accum, newRot, newPos, nodeName, skin, J } = avatar;
  for (const nd of order) {
    const qa = bones[nodeName[nd]];
    const pa = parent[nd];
    const accP = pa < 0 ? IDENTITY_Q : accum[pa];
    accum[nd] = qa ? qMul(accP, qa) : accP;
    newRot[nd] = mul3(quatToMat3(accum[nd]), restRot[nd]);
    if (pa < 0) newPos[nd] = restPos[nd].slice();
    else {
      const dlt = [restPos[nd][0] - restPos[pa][0], restPos[nd][1] - restPos[pa][1], restPos[nd][2] - restPos[pa][2]];
      const [qx, qy, qz, qw] = accP;
      const tx = 2 * (qy * dlt[2] - qz * dlt[1]), ty = 2 * (qz * dlt[0] - qx * dlt[2]), tz = 2 * (qx * dlt[1] - qy * dlt[0]);
      const rx = dlt[0] + qw * tx + (qy * tz - qz * ty), ry = dlt[1] + qw * ty + (qz * tx - qx * tz), rz = dlt[2] + qw * tz + (qx * ty - qy * tx);
      newPos[nd] = [newPos[pa][0] + rx, newPos[pa][1] + ry, newPos[pa][2] + rz];
    }
  }
  const sk = skin;
  for (let k = 0; k < sk.joints.length; k++) {
    const nd = sk.joints[k], R = newRot[nd], t = newPos[nd], m = sk.ibm, mo = k * 16, jo = nd * 12;
    for (let c = 0; c < 4; c++) {
      const b0 = m[mo + c * 4], b1 = m[mo + c * 4 + 1], b2 = m[mo + c * 4 + 2], b3 = m[mo + c * 4 + 3];
      J[jo + c * 3] = R[0] * b0 + R[3] * b1 + R[6] * b2 + t[0] * b3;
      J[jo + c * 3 + 1] = R[1] * b0 + R[4] * b1 + R[7] * b2 + t[1] * b3;
      J[jo + c * 3 + 2] = R[2] * b0 + R[5] * b1 + R[8] * b2 + t[2] * b3;
    }
  }
}

const hash1 = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
// JS mirror of the WGSL hash3/noise3 below (identical dot-product
// constants and hash1), used once at REST-buffer build time to bake a
// genuinely spatially-coherent (not per-splat-independent salt-and-
// pepper) "how big does THIS splat get" seed for the orbit-particle
// effect — see buildRestBuffer's sizeSeed and the WGSL PARTICLE FX block.
const hash3JS = (x, y, z) => hash1(x * 374.16 + y * 668.26 + z * 2147.48);
function noise3JS(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const c000 = hash3JS(ix, iy, iz), c100 = hash3JS(ix + 1, iy, iz);
  const c010 = hash3JS(ix, iy + 1, iz), c110 = hash3JS(ix + 1, iy + 1, iz);
  const c001 = hash3JS(ix, iy, iz + 1), c101 = hash3JS(ix + 1, iy, iz + 1);
  const c011 = hash3JS(ix, iy + 1, iz + 1), c111 = hash3JS(ix + 1, iy + 1, iz + 1);
  const x00 = c000 + (c100 - c000) * ux, x10 = c010 + (c110 - c010) * ux;
  const x01 = c001 + (c101 - c001) * ux, x11 = c011 + (c111 - c011) * ux;
  const y0 = x00 + (x10 - x00) * uy, y1 = x01 + (x11 - x01) * uy;
  return y0 + (y1 - y0) * uz;
}

const WGSL_TRANSFORM = /* wgsl */`
fn quatMul(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(
    a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
    a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
    a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
    a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z);
}
fn quatNorm(q: vec4<f32>) -> vec4<f32> { return q / max(length(q), 1e-6); }

// Shepperd's method, inlined scalar — same approach (and same reasoning:
// avoid a per-splat allocation) as the CPU version's inlined equivalent
// in lam-splats.js pose().
fn mat3ToQuat(m0:f32,m1:f32,m2:f32,m3:f32,m4:f32,m5:f32,m6:f32,m7:f32,m8:f32) -> vec4<f32> {
  let tr = m0 + m4 + m8;
  var x: f32; var y: f32; var z: f32; var w: f32;
  if (tr > 0.0) {
    let s = sqrt(tr + 1.0) * 2.0;
    w = 0.25*s; x = (m5-m7)/s; y = (m6-m2)/s; z = (m1-m3)/s;
  } else if (m0 > m4 && m0 > m8) {
    let s = sqrt(1.0 + m0 - m4 - m8) * 2.0;
    w = (m5-m7)/s; x = 0.25*s; y = (m3+m1)/s; z = (m6+m2)/s;
  } else if (m4 > m8) {
    let s = sqrt(1.0 + m4 - m0 - m8) * 2.0;
    w = (m6-m2)/s; x = (m3+m1)/s; y = 0.25*s; z = (m7+m5)/s;
  } else {
    let s = sqrt(1.0 + m8 - m0 - m4) * 2.0;
    w = (m1-m3)/s; x = (m6+m2)/s; y = (m7+m5)/s; z = 0.25*s;
  }
  return quatNorm(vec4<f32>(x,y,z,w));
}

fn hash1(n: f32) -> f32 { return fract(sin(n * 12.9898) * 43758.5453); }
fn hash3(p: vec3<f32>) -> f32 { return hash1(dot(p, vec3<f32>(374.16, 668.26, 2147.48))); }
fn noise3(p: vec3<f32>) -> f32 {
  let i = floor(p); let f = fract(p); let u = f*f*(3.0-2.0*f);
  let c000=hash3(i); let c100=hash3(i+vec3<f32>(1,0,0));
  let c010=hash3(i+vec3<f32>(0,1,0)); let c110=hash3(i+vec3<f32>(1,1,0));
  let c001=hash3(i+vec3<f32>(0,0,1)); let c101=hash3(i+vec3<f32>(1,0,1));
  let c011=hash3(i+vec3<f32>(0,1,1)); let c111=hash3(i+vec3<f32>(1,1,1));
  let x00=mix(c000,c100,u.x); let x10=mix(c010,c110,u.x);
  let x01=mix(c001,c101,u.x); let x11=mix(c011,c111,u.x);
  let y0=mix(x00,x10,u.y); let y1=mix(x01,x11,u.y);
  return mix(y0,y1,u.z);
}

// OBJ layout (all per-frame, re-uploaded every dispatch — see
// updateJointPalette above for where the joint matrices come from):
//   0 time, 1 dissolve, 2 twinkle, 3 roundness, 4 ghost,
//   5..7 tint rgb, 8..10 at xyz, 11 yaw,
//   12..14 centre xyz, 15 scale,
//   16 sizeMult (uniform scale about the "at" placement point — the
//      pentagram demo's "big when live, small when dissolved" effect;
//      1.0 = no change, fully backward compatible with callers that
//      don't set it), 17 fxIntensity (a flat post-multiply on final
//      alpha — the pentagram demo's overdraw fix: many stacked
//      semi-transparent dissolved splats approach full opacity
//      regardless of small per-splat alpha changes, so a flat scale is
//      the one thing that composites linearly; 1.0 = no change),
//   18 particleFx (master intensity for the orbit-particle effect below,
//      0 = fully off/identical to every existing caller, 1 = full
//      effect), 19..20 pole xz (world-space axis the particles orbit —
//      for a ring of avatars placed by FACET_R*sin/cos(angleOf(i)) around
//      the origin, as the pentagram demo does, that pole is (0,0)),
//   21..37 morph weights, one per MORPH_NAMES entry (0..1 each),
//   38.. joint palette, 12 floats per NODE (matches lam-splats.js's own
//        J layout exactly, indexed by the REST buffer's raw node index —
//        see gpu-skinned-avatar.js's buildRestBuffer for why this isn't
//        compacted to just the used joints).
const N_MORPHS: u32 = ${N_MORPHS}u;
const REST_STRIDE: u32 = ${REST_STRIDE}u;
const MORPH_OBJ_BASE: u32 = 21u;
const JOINT_OBJ_BASE: u32 = 21u + ${N_MORPHS}u;
// orbit-particle effect shape constants — see the PARTICLE FX block below
const PARTICLE_PERIOD: f32 = 2.0;       // seconds per splat's launch/return cycle
const PARTICLE_ORBIT_TURNS: f32 = 1.0;   // full turns around the pole at peak envelope
// LAM heads load at whatever scale their source GLB used — for these
// faces that's roughly 0.2-0.3 world units across (see gpu-skinned-
// avatar.js's own "sample" measurement: bbox ~0.43 tall). A first pass
// at ORBIT_RADIUS=0.5 / SIZE_BOOST=2.5 was sized for a ~human-scale (1-2
// unit) object and instead blew the whole creature out into an
// unrecognizable full-frame cloud at these small sizes — same class of
// mistake as the CPU demo's first medusa-fling pass overshooting before
// being dialled back. These are ~6-8x smaller, tuned by looking at an
// actual screenshot, not guessed twice.
const PARTICLE_ORBIT_RADIUS: f32 = 0.05; // world units of outward launch at peak, before sizeSeed/particleFx scaling
const PARTICLE_SIZE_BOOST: f32 = 0.4;    // extra scale at peak, scaled by each splat's own perlin sizeSeed

fn transform(i: u32) -> array<f32, 14> {
  let b = i * REST_STRIDE;
  var restPos = vec3<f32>(REST[b], REST[b+1u], REST[b+2u]);
  let restRot = vec4<f32>(REST[b+3u], REST[b+4u], REST[b+5u], REST[b+6u]);
  let restScale = vec3<f32>(REST[b+7u], REST[b+8u], REST[b+9u]);
  let restColor = vec3<f32>(REST[b+10u], REST[b+11u], REST[b+12u]);
  let baseAlpha = REST[b+13u];
  let jIdx = vec4<f32>(REST[b+14u], REST[b+15u], REST[b+16u], REST[b+17u]);
  let jW = vec4<f32>(REST[b+18u], REST[b+19u], REST[b+20u], REST[b+21u]);
  let noiseSeed = REST[b+22u];
  let pSeed = REST[b+23u];
  let sizeSeed = REST[b+24u + ${N_MORPHS}u * 3u]; // right after the morph-delta block

  let time = OBJ[0]; let dissolve = OBJ[1]; let twinkle = OBJ[2]; let roundness = OBJ[3];
  let ghost = OBJ[4]; let tint = vec3<f32>(OBJ[5], OBJ[6], OBJ[7]);
  let at = vec3<f32>(OBJ[8], OBJ[9], OBJ[10]); let yaw = OBJ[11];
  let centre = vec3<f32>(OBJ[12], OBJ[13], OBJ[14]); let avScale = OBJ[15];
  let sizeMult = OBJ[16]; let fxIntensity = OBJ[17];
  let particleFx = OBJ[18]; let poleX = OBJ[19]; let poleZ = OBJ[20];
  let jointBase = JOINT_OBJ_BASE;

  // morph blend — applied to the REST position BEFORE skinning, same
  // order as lam-splats.js pose()'s "for (const [d,w] of mw) px+=d*w"
  // loop. 17 static per-splat deltas × a live weight each, same shape
  // as the CPU morph loop just moved onto GPU.
  let morphRestBase = b + 24u;
  for (var m = 0u; m < N_MORPHS; m = m + 1u) {
    let w = OBJ[MORPH_OBJ_BASE + m];
    if (w <= 0.0) { continue; }
    let mo = morphRestBase + m * 3u;
    restPos = restPos + vec3<f32>(REST[mo], REST[mo+1u], REST[mo+2u]) * w;
  }

  var skinnedPos = restPos;
  var qSkin = vec4<f32>(0.0, 0.0, 0.0, 1.0);
  // matches lam-splats.js pose()'s own gate exactly: it checks only the
  // FIRST weight component (glTF WEIGHTS_0 is conventionally sorted
  // descending, so a zero first weight means unweighted), not the sum.
  if (jW.x > 0.0) {
    var m = array<f32,12>();
    for (var e = 0u; e < 12u; e = e + 1u) { m[e] = 0.0; }
    for (var j = 0u; j < 4u; j = j + 1u) {
      let w = jW[j];
      if (w <= 0.0) { continue; }
      let jo = jointBase + u32(jIdx[j]) * 12u;
      for (var e = 0u; e < 12u; e = e + 1u) { m[e] = m[e] + OBJ[jo + e] * w; }
    }
    skinnedPos = vec3<f32>(
      m[0]*restPos.x + m[3]*restPos.y + m[6]*restPos.z + m[9],
      m[1]*restPos.x + m[4]*restPos.y + m[7]*restPos.z + m[10],
      m[2]*restPos.x + m[5]*restPos.y + m[8]*restPos.z + m[11]);
    qSkin = mat3ToQuat(m[0],m[1],m[2],m[3],m[4],m[5],m[6],m[7],m[8]);
  }
  let q = quatNorm(quatMul(qSkin, restRot));

  let lx = (skinnedPos.x - centre.x) * avScale;
  let ly = (skinnedPos.y - centre.y) * avScale;
  let lz = (skinnedPos.z - centre.z) * avScale;
  let cy = cos(yaw); let sy = sin(yaw);
  // sizeMult scales the OFFSET from "at", not the final world position —
  // a true uniform scale about the facet's own placement point (same
  // trick the CPU pentagram demo's scaleMult loop uses), so a facet
  // shrinking/growing never looks like the whole scene shrinking.
  var wx = at.x + (lx*cy + lz*sy) * sizeMult;
  var wy = at.y + ly * sizeMult;
  var wz = at.z + (-lx*sy + lz*cy) * sizeMult;
  let qYaw = vec4<f32>(0.0, sin(yaw*0.5), 0.0, cos(yaw*0.5));
  var outQuat = quatNorm(quatMul(qYaw, q));

  var scale = restScale * sizeMult;
  if (roundness > 0.0) {
    let avgS = (scale.x + scale.y + scale.z) / 3.0;
    scale = mix(scale, vec3<f32>(avgS), roundness);
    outQuat = quatNorm(mix(outQuat, vec4<f32>(0.0,0.0,0.0,1.0), roundness));
  }

  var alpha = baseAlpha;
  if (twinkle > 0.0) {
    let ph = sin(time * (2.2 + pSeed * 3.1) + noiseSeed);
    alpha = clamp(alpha + twinkle * ph, 0.0, 1.0);
  }
  if (dissolve > 0.0) {
    let nz = noise3(vec3<f32>(wx*14.0 + noiseSeed*0.37, wy*14.0, wz*14.0 + time*0.35));
    let cutoff = dissolve * 0.92;
    if (nz <= cutoff) { alpha = alpha * pow(clamp(nz/(cutoff+1e-4), 0.0, 1.0), 2.0); } else { alpha = alpha; }
  }
  // fxIntensity LAST, same order as the CPU pentagram demo — it's meant
  // to be a flat post-multiply on whatever twinkle/dissolve produced,
  // not an input to them (see the OBJ layout comment above).
  alpha = alpha * fxIntensity;
  var color = restColor;
  if (ghost > 0.0) {
    let lum = color.x*0.3 + color.y*0.59 + color.z*0.11;
    color = mix(color, tint*lum, ghost);
  }

  // ---------------------------------------------------------- PARTICLE FX
  // "each splat over a 2-second period launches into an orbit of [the
  // shared] pole, grows to a size set by perlin-per-splat, and shrinks
  // back down again, swirling back to its home location" — applied AFTER
  // everything above, on top of wherever the splat's skin/place/stylize
  // pipeline already put it, so "home" is wherever it's ALREADY animating
  // to this frame (a mid-transition or head-turned position included),
  // not a fixed rest point.
  //
  // Every splat runs the SAME 2-second cycle but at its own PHASE (via
  // noiseSeed, already a per-splat static random value baked at load
  // time), so the population is continuously, unsynchronizedly launching
  // and returning rather than all popping at once. The envelope is 0 at
  // both ends of the ACTIVE WINDOW by construction (sin(0)=sin(pi)=0), so
  // the orbit angle and radial offset are ALSO exactly 0 there — "swirls
  // back to its home location" falls out of the math rather than needing
  // a separate return step.
  //
  // ACTIVE_WINDOW matters more than it looks: a first pass used
  // sin(cyclePos*pi) directly over the FULL cycle — but that's nonzero
  // almost everywhere in (0,1), so with phases spread uniformly across
  // the population, EVERY splat was partially displaced ALL the time,
  // with no genuine at-rest moment for any of them — the creature never
  // resolved into a recognisable face at any instant, just constant
  // noise. Confining the launch to a fraction of the cycle gives most of
  // the population a real "at home, undisplaced" majority of the time.
  if (particleFx > 0.0) {
    let cyclePos = fract((time + noiseSeed) / PARTICLE_PERIOD);
    let ACTIVE_WINDOW = 0.35;
    var env = 0.0;
    if (cyclePos < ACTIVE_WINDOW) {
      env = sin((cyclePos / ACTIVE_WINDOW) * 3.14159265) * particleFx;
    }

    // orbit: rotate (wx,wz) around the shared vertical pole axis, and
    // push outward along the same radius — one splat's whole launch arc
    // is a spiral out-and-around then back, not just a spin-in-place.
    let dx = wx - poleX; let dz = wz - poleZ;
    let r = length(vec2<f32>(dx, dz));
    let baseAngle = atan2(dz, dx);
    let newAngle = baseAngle + env * PARTICLE_ORBIT_TURNS * 6.283185;
    let newR = r + env * PARTICLE_ORBIT_RADIUS;
    wx = poleX + newR * cos(newAngle);
    wz = poleZ + newR * sin(newAngle);

    // size: "grown to a size determined by perlin-per-splat" — sizeSeed
    // is a spatially-coherent (not per-splat-independent) noise value
    // baked once from this splat's rest position, so nearby splats swell
    // together in patches rather than popcorn-popping individually.
    scale = scale * (1.0 + env * sizeSeed * PARTICLE_SIZE_BOOST);

    // colour/luminosity: a LIVE (not baked) noise field, so the shimmer
    // itself drifts over time instead of being a fixed per-splat tint —
    // "screw with colours, luminosity... following perlin dynamics and
    // time functions". Two independent samples: one drives brightness,
    // one drives a hue-ish push toward a shifting accent colour.
    let shimmer = noise3(vec3<f32>(restPos.x*5.0, restPos.y*5.0, restPos.z*5.0 + time*0.5));
    let brightness = 1.0 + env * (shimmer - 0.5) * 1.1;
    color = color * brightness;
    let hueN = noise3(vec3<f32>(restPos.z*5.0 + 19.0, time*0.35, restPos.x*5.0 + 7.0));
    let accent = vec3<f32>(0.5 + 0.5*sin(hueN*6.283185), 0.5 + 0.5*sin(hueN*6.283185 + 2.094), 0.5 + 0.5*sin(hueN*6.283185 + 4.189));
    color = mix(color, accent, env * 0.25);
  }

  var out: array<f32, 14>;
  out[0]=wx; out[1]=wy; out[2]=wz;
  out[3]=outQuat.x; out[4]=outQuat.y; out[5]=outQuat.z; out[6]=outQuat.w;
  out[7]=scale.x; out[8]=scale.y; out[9]=scale.z;
  out[10]=color.x; out[11]=color.y; out[12]=color.z; out[13]=alpha;
  return out;
}
`;

// Builds the static (upload-once) REST buffer straight from the already-
// loaded avatar's own public fields — parseLamPly/loadLamAvatar in
// lam-splats.js are untouched and do all the actual asset parsing.
function buildRestBuffer(avatar) {
  const { count, pos, ply, jidx, jw, scale, maxScale, maxAspect, morphs } = avatar;
  // Missing-morph arrays (an avatar without every ARKit target — shouldn't
  // happen for LAM assets, but defensive) contribute a zero delta rather
  // than throwing.
  const ZERO3 = new Float32Array(count * 3);
  const morphArrays = MORPH_NAMES.map((nm) => morphs[nm] || ZERO3);
  const rest = new Float32Array(count * REST_STRIDE);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3, i4 = i * 4, o = i * REST_STRIDE;
    rest[o] = pos[i3] + ply.off[i3];
    rest[o + 1] = pos[i3 + 1] + ply.off[i3 + 1];
    rest[o + 2] = pos[i3 + 2] + ply.off[i3 + 2];
    rest[o + 3] = ply.rot[i4]; rest[o + 4] = ply.rot[i4 + 1]; rest[o + 5] = ply.rot[i4 + 2]; rest[o + 6] = ply.rot[i4 + 3];
    let s0 = ply.scl[i3] * scale, s1 = ply.scl[i3 + 1] * scale, s2 = ply.scl[i3 + 2] * scale;
    const smin = Math.max(1e-5, Math.min(s0, s1, s2)), cap = Math.min(maxScale, smin * maxAspect);
    rest[o + 7] = Math.min(s0, cap); rest[o + 8] = Math.min(s1, cap); rest[o + 9] = Math.min(s2, cap);
    rest[o + 10] = ply.col[i3]; rest[o + 11] = ply.col[i3 + 1]; rest[o + 12] = ply.col[i3 + 2];
    rest[o + 13] = ply.op[i] < avatar.alphaMin ? 0 : ply.op[i]; // bake culling as invisible, not a shorter array
    rest[o + 14] = jidx[i4]; rest[o + 15] = jidx[i4 + 1]; rest[o + 16] = jidx[i4 + 2]; rest[o + 17] = jidx[i4 + 3];
    rest[o + 18] = jw[i4]; rest[o + 19] = jw[i4 + 1]; rest[o + 20] = jw[i4 + 2]; rest[o + 21] = jw[i4 + 3];
    rest[o + 22] = hash1(i * 37.719 + 17.3) * 1000;
    rest[o + 23] = hash1(i * 78.233 + 91.1);
    const mo0 = o + 24;
    for (let m = 0; m < N_MORPHS; m++) {
      const d = morphArrays[m], mo = mo0 + m * 3;
      rest[mo] = d[i3]; rest[mo + 1] = d[i3 + 1]; rest[mo + 2] = d[i3 + 2];
    }
    // Spatially-coherent (real Perlin-style, not per-splat white noise)
    // "how big does this splat get" seed for the orbit-particle effect —
    // sampled from the splat's own rest position, so nearby splats swell
    // together in patches. Frequency 5 was picked empirically: high
    // enough that a face-sized region sees several patches, low enough
    // that neighbouring splats still clearly agree with each other.
    rest[mo0 + N_MORPHS * 3] = noise3JS(
      (pos[i3] + ply.off[i3]) * 5, (pos[i3 + 1] + ply.off[i3 + 1]) * 5, (pos[i3 + 2] + ply.off[i3 + 2]) * 5,
    );
  }
  return rest;
}

// device: from requestComputeDevice(). avatar: a loaded LamHeadAvatar
// (loadLamAvatar() from lam-splats.js — unmodified). outBuffer: the GPU
// storage buffer to write into (pass a GpuSplatScene drawable's outBuf).
export function createGpuSkinnedAvatar(device, avatar, outBuffer) {
  const N = avatar.nodes.N;
  const MORPH_OBJ_BASE = 21;
  const JOINT_OBJ_BASE = MORPH_OBJ_BASE + N_MORPHS;
  const objFloats = JOINT_OBJ_BASE + N * 12;
  const pass = new SplatComputePass(device, { restStride: REST_STRIDE, wgslTransform: WGSL_TRANSFORM, maxObjFloats: objFloats });
  const rest = buildRestBuffer(avatar);
  pass.setData(rest, avatar.count, outBuffer);
  const obj = new Float32Array(objFloats);

  // params: { dissolve, twinkle, roundness, ghost, tint:[r,g,b], at:[x,y,z],
  //           yaw, sizeMult, fxIntensity, particleFx, pole:[x,z],
  //           bones:{nodeName: quat}, morph:{arkitName: 0..1} } —
  // particleFx (0..1, default 0 — off, byte-identical to every existing
  // caller) is the master intensity for the orbit-launch-and-return
  // particle effect (see the WGSL PARTICLE FX block); pole is the
  // world-space (x,z) axis those particles orbit, default [0,0] (the
  // natural centre of a ring of avatars placed by FACET_R*sin/cos as the
  // pentagram demo does).
  return {
    splatCount: avatar.count,
    dispatch(time, params = {}) {
      updateJointPalette(avatar, params.bones || {});
      obj[0] = time;
      obj[1] = params.dissolve || 0; obj[2] = params.twinkle || 0; obj[3] = params.roundness || 0; obj[4] = params.ghost || 0;
      const tint = params.tint || [0.72, 0.95, 1.12];
      obj[5] = tint[0]; obj[6] = tint[1]; obj[7] = tint[2];
      const at = params.at || [0, 0, 0];
      obj[8] = at[0]; obj[9] = at[1]; obj[10] = at[2];
      obj[11] = params.yaw || 0;
      obj[12] = avatar.centre[0]; obj[13] = avatar.centre[1]; obj[14] = avatar.centre[2]; obj[15] = avatar.scale;
      obj[16] = params.sizeMult ?? 1; obj[17] = params.fxIntensity ?? 1;
      obj[18] = params.particleFx || 0;
      const pole = params.pole || [0, 0];
      obj[19] = pole[0]; obj[20] = pole[1];
      const morph = params.morph || {};
      for (let m = 0; m < N_MORPHS; m++) obj[MORPH_OBJ_BASE + m] = morph[MORPH_NAMES[m]] || 0;
      obj.set(avatar.J.subarray(0, N * 12), JOINT_OBJ_BASE);
      pass.dispatch(obj);
    },
  };
}
