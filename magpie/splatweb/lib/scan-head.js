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
];
const LIGHT = (() => { const v = [0.3, 0.75, 0.6]; const l = Math.hypot(...v); return v.map(x => x / l); })();
const ZERO10 = new Float32Array(10);

export async function loadScanHead(url = FACECAP_URL, { count = 9000, headHeight = 0.34, yaw = 0 } = {}) {
  const res = await loadGlbSplats(url, {
    count, targetHeight: headHeight, yaw, at: [0, 0, 0], light: null, morphNames: WANTED,
    // facecap's texture is KTX2/basisu — undecodable without a transcoder,
    // so the head renders as a skin-toned sculpture (shape + rig intact)
    tint: [0.92, 0.72, 0.6],
  });
  return { count: res.count, base: res.data, morphs: res.morphs, normals: res.normals, heightM: res.heightM };
}

// packet channels → facecap morph weights
function weightsFor(blend) {
  const lx = blend[BI.eyeLookX], ly = blend[BI.eyeLookY];
  return [
    ['jawOpen', blend[BI.jawOpen]],
    ['eyeBlink_L', blend[BI.eyeBlinkLeft]],
    ['eyeBlink_R', blend[BI.eyeBlinkRight]],
    ['browInnerUp', blend[BI.browInnerUp]],
    ['mouthSmile_L', blend[BI.mouthSmileLeft]],
    ['mouthSmile_R', blend[BI.mouthSmileRight]],
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
