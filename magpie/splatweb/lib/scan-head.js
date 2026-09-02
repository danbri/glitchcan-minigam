// scan-head.js — a PRE-RIGGED realistic head as the avatar's head: a
// morph-target GLB (ARKit blendshape set) is splat-ified once at load,
// then every frame the packet's blendshape weights displace the sampled
// splats (barycentric morph deltas), the head rotates with the packet
// quaternion, and per-splat lambert is baked against the rotated normals.
//
// Default model: "Face Cap" head (bannaflak.com) as shipped in the
// three.js examples. ⚠ LICENCE: the model was "kindly provided" to
// three.js — no explicit open licence. It is LINKED at runtime from the
// three.js repo (pinned tag via jsdelivr), NOT vendored into this repo.
// Credit it wherever it renders; replace before any serious use.
import { loadGlbSplats } from './gltf-splats.js';
import { FLOATS_PER_SPLAT } from './splat-renderer.js';
import { BLENDSHAPES } from './telemetry-codec.js';

export const FACECAP_URL =
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf/facecap.glb';
export const FACECAP_CREDIT =
  '“Face Cap” head model by bannaflak.com, via the three.js examples (no explicit licence — linked, not redistributed)';

const BI = {};
BLENDSHAPES.forEach((n, i) => { BI[n] = i; });

// facecap uses the ARKit set with _L/_R suffixes
const WANTED = [
  'jawOpen', 'eyeBlink_L', 'eyeBlink_R', 'browInnerUp',
  'mouthSmile_L', 'mouthSmile_R', 'mouthPucker', 'cheekPuff',
  'eyeLookIn_L', 'eyeLookOut_L', 'eyeLookUp_L', 'eyeLookDown_L',
  'eyeLookIn_R', 'eyeLookOut_R', 'eyeLookUp_R', 'eyeLookDown_R',
  // chord targets — driven indirectly so single packet channels expand
  // into full expressions (see weightsFor)
  'cheekSquint_L', 'cheekSquint_R', 'eyeSquint_L', 'eyeSquint_R',
  'mouthDimple_L', 'mouthDimple_R', 'browOuterUp_L', 'browOuterUp_R',
  'eyeWide_L', 'eyeWide_R', 'mouthStretch_L', 'mouthStretch_R',
  'mouthLowerDown_L', 'mouthLowerDown_R', 'mouthUpperUp_L', 'mouthUpperUp_R',
];
const LIGHT = (() => { const v = [0.3, 0.75, 0.6]; const l = Math.hypot(...v); return v.map(x => x / l); })();
const ZERO10 = new Float32Array(10);

export async function loadScanHead(url = FACECAP_URL, { count = 9000, headHeight = 0.34, yaw = 0, hair = [0.17, 0.12, 0.09] } = {}) {
  const res = await loadGlbSplats(url, {
    count, targetHeight: headHeight, yaw, at: [0, 0, 0], light: null, morphNames: WANTED,
    // facecap's texture is KTX2/basisu — undecodable without a transcoder,
    // so the head renders as a skin-toned sculpture (shape + rig intact)
    tint: [0.92, 0.72, 0.6],
  });
  return addHair(res, hair);
}

// procedural hair strands fitted to the scan's scalp: identity comes more
// from a hairline than from pores — a bald scan reads mannequin. Strands
// sit on scalp splats and inherit their morph deltas (so they track the
// head's motion exactly).
function addHair(res, hairColor) {
  const b0 = res.data, n0 = res.count, nor = res.normals;
  const scalpMinY = res.heightM * 0.6;
  const picks = [];
  for (let i = 0; i < n0; i++) {
    const j = i * 3;
    if (nor[j + 1] > 0.25 && b0[i * FLOATS_PER_SPLAT + 1] > scalpMinY
      && nor[j + 2] < 0.75) picks.push(i);
  }
  const hc = picks.length;
  const base = new Float32Array((n0 + hc) * FLOATS_PER_SPLAT);
  base.set(b0);
  const normals = new Float32Array((n0 + hc) * 3);
  normals.set(nor);
  const morphs = {};
  for (const name of Object.keys(res.morphs)) {
    const m = new Float32Array((n0 + hc) * 3);
    m.set(res.morphs[name]);
    morphs[name] = m;
  }
  let seed = 5;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < hc; k++) {
    const i = picks[k], o = i * FLOATS_PER_SPLAT, oo = (n0 + k) * FLOATS_PER_SPLAT, j = i * 3;
    const nx = nor[j], ny = nor[j + 1], nz = nor[j + 2];
    // strand base: scalp point pushed slightly out along the normal
    base[oo] = b0[o] + nx * 0.005;
    base[oo + 1] = b0[o + 1] + ny * 0.005;
    base[oo + 2] = b0[o + 2] + nz * 0.005;
    // downhill tangent for strand direction
    let tx = -nx * -ny, ty = -1 - ny * -ny, tz = -nz * -ny;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    // orientation: reuse the base splat's quat (tangent frame is close
    // enough at strand scale); elongate along local x via the scales
    base[oo + 3] = b0[o + 3]; base[oo + 4] = b0[o + 4]; base[oo + 5] = b0[o + 5]; base[oo + 6] = b0[o + 6];
    base[oo + 7] = 0.0085 + rnd() * 0.004; base[oo + 8] = 0.0035; base[oo + 9] = 0.0028;
    const gl = 0.75 + rnd() * 0.5;
    base[oo + 10] = hairColor[0] * gl; base[oo + 11] = hairColor[1] * gl; base[oo + 12] = hairColor[2] * gl;
    base[oo + 13] = 0.98;
    normals[(n0 + k) * 3] = nx; normals[(n0 + k) * 3 + 1] = ny; normals[(n0 + k) * 3 + 2] = nz;
    // strands ride their scalp splat's morph deltas
    for (const name of Object.keys(morphs)) {
      const m = morphs[name];
      m[(n0 + k) * 3] = m[j]; m[(n0 + k) * 3 + 1] = m[j + 1]; m[(n0 + k) * 3 + 2] = m[j + 2];
    }
  }
  return { count: n0 + hc, base, morphs, normals, heightM: res.heightM };
}

// packet channels → facecap morph weights, expanded as EXPRESSION
// CHORDS: a real smile is smile + cheek raise + eye narrowing + dimples;
// a real brow-raise lifts the whole brow and widens the eyes; an open
// jaw stretches the mouth. Driving single morphs 1:1 read as weak and
// false — this table is what fixed that.
function weightsFor(blend) {
  const lx = blend[BI.eyeLookX], ly = blend[BI.eyeLookY];
  const jaw = blend[BI.jawOpen], sL = blend[BI.mouthSmileLeft], sR = blend[BI.mouthSmileRight];
  const brow = blend[BI.browInnerUp];
  return [
    ['jawOpen', jaw],
    ['mouthLowerDown_L', jaw * 0.4], ['mouthLowerDown_R', jaw * 0.4],
    ['mouthUpperUp_L', jaw * 0.25], ['mouthUpperUp_R', jaw * 0.25],
    ['mouthStretch_L', jaw * 0.2], ['mouthStretch_R', jaw * 0.2],
    ['eyeBlink_L', blend[BI.eyeBlinkLeft]],
    ['eyeBlink_R', blend[BI.eyeBlinkRight]],
    ['browInnerUp', brow],
    ['browOuterUp_L', brow * 0.75], ['browOuterUp_R', brow * 0.75],
    ['eyeWide_L', brow * 0.5], ['eyeWide_R', brow * 0.5],
    ['mouthSmile_L', sL], ['mouthSmile_R', sR],
    ['cheekSquint_L', sL * 0.7], ['cheekSquint_R', sR * 0.7],
    ['eyeSquint_L', sL * 0.35], ['eyeSquint_R', sR * 0.35],
    ['mouthDimple_L', sL * 0.5], ['mouthDimple_R', sR * 0.5],
    ['mouthPucker', blend[BI.mouthPucker]],
    ['cheekPuff', blend[BI.cheekPuff]],
    ['eyeLookOut_R', Math.max(lx, 0)], ['eyeLookIn_L', Math.max(lx, 0)],
    ['eyeLookOut_L', Math.max(-lx, 0)], ['eyeLookIn_R', Math.max(-lx, 0)],
    ['eyeLookUp_L', Math.max(ly, 0)], ['eyeLookUp_R', Math.max(ly, 0)],
    ['eyeLookDown_L', Math.max(-ly, 0)], ['eyeLookDown_R', Math.max(-ly, 0)],
  ];
}

// Write the posed head into out at outOffset (floats). Scalar-inlined —
// this runs per frame over ~9k splats, so no per-splat allocations.
export function buildScanHeadSplats(head, pose, at, out, outOffset = 0) {
  const q = pose ? pose.quat : [0, 0, 0, 1];
  const blend = pose ? pose.blend : ZERO10;
  const base = pose
    ? [at[0] + pose.pos[0], at[1] + (pose.pos[1] - 1.45), at[2] + pose.pos[2]]
    : at;
  const NECK_Y = 1.45;
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  // light rotated into head-local space (q⁻¹ · LIGHT)
  const rot = (x, y, z, sx, sy, sz, sw) => {   // rotate (x,y,z) by quat (s)
    const tx = 2 * (sy * z - sz * y), ty = 2 * (sz * x - sx * z), tz = 2 * (sx * y - sy * x);
    return [x + sw * tx + (sy * tz - sz * ty), y + sw * ty + (sz * tx - sx * tz), z + sw * tz + (sx * ty - sy * tx)];
  };
  const [llx, lly, llz] = rot(LIGHT[0], LIGHT[1], LIGHT[2], -qx, -qy, -qz, qw);

  const act = [];
  for (const [name, wt] of weightsFor(blend)) {
    const arr = head.morphs[name];
    if (arr && wt > 0.004) act.push([arr, Math.min(wt, 1)]);
  }
  const b = head.base, N = head.count, nor = head.normals;
  for (let i = 0; i < N; i++) {
    const o = i * FLOATS_PER_SPLAT, oo = outOffset + o;
    let x = b[o], y = b[o + 1], z = b[o + 2];
    for (let m = 0; m < act.length; m++) {
      const arr = act[m][0], wt = act[m][1], j = i * 3;
      x += arr[j] * wt; y += arr[j + 1] * wt; z += arr[j + 2] * wt;
    }
    // world position: rotate about the neck, then translate
    const p = rot(x, y, z, qx, qy, qz, qw);
    out[oo] = base[0] + p[0];
    out[oo + 1] = base[1] + NECK_Y + p[1];
    out[oo + 2] = base[2] + p[2];
    // splat orientation: q · baseQuat
    const ax = b[o + 3], ay = b[o + 4], az = b[o + 5], aw = b[o + 6];
    out[oo + 3] = qw * ax + qx * aw + qy * az - qz * ay;
    out[oo + 4] = qw * ay - qx * az + qy * aw + qz * ax;
    out[oo + 5] = qw * az + qx * ay - qy * ax + qz * aw;
    out[oo + 6] = qw * aw - qx * ax - qy * ay - qz * az;
    out[oo + 7] = b[o + 7]; out[oo + 8] = b[o + 8]; out[oo + 9] = b[o + 9];
    const j = i * 3;
    const nd = nor[j] * llx + nor[j + 1] * lly + nor[j + 2] * llz;
    const sh = 0.6 + 0.45 * Math.max(0, nd);
    out[oo + 10] = b[o + 10] * sh; out[oo + 11] = b[o + 11] * sh; out[oo + 12] = b[o + 12] * sh;
    out[oo + 13] = b[o + 13];
  }
  return N;
}
