// lam-splats.js — loads a LAM (Large Avatar Model, aigc3d/LAM, SIGGRAPH
// 2025) head asset: a rigged glTF head mesh (skin.glb, real ARKit-named
// morph targets + a full skeleton) plus its OWN trained per-vertex
// Gaussian splats (offset.ply), which line up 1:1 with the mesh's own
// vertex order (see the NOTE below — vertex_order.json is NOT that map).
//
// Unlike gltf-splats.js/rigged-splats.js — which FAKE splats by
// area-sampling mesh triangles and deriving a billboard orientation from
// the surface normal, re-lit every frame — these splats carry a real
// trained position offset, anisotropic scale, rotation and colour/opacity
// straight from the model, skinned per frame by ordinary glTF LBS
// (JOINTS_0/WEIGHTS_0 + inverse bind matrices) exactly like a mesh vertex
// would be, with the splat's own local rotation composed on top of the
// joint's rotation. `loadLamHead` is the simple rest-pose-only loader
// (also handy for isolating a bad PLY/GLB decode from a bad pose());
// `loadLamAvatar`/`LamHeadAvatar` is the posable version — skeleton bone
// rotations by glTF node name, morph weights by ARKit target name.
//
// offset.ply schema (standard uncompressed 3DGS PLY, empirically
// confirmed 2026-09-03): x y z (offset from the matching mesh vertex, in
// the mesh's own units) · nx ny nz (unused, all zero) · f_dc_0..2 (already
// plain linear RGB 0..1 — NOT spherical-harmonic coefficients, so no
// 0.5+SH_C0*x step) · opacity (logit — apply sigmoid) · scale_0..2
// (log-scale — apply exp) · rot_0..3 (quaternion, stored w,x,y,z — our
// renderer wants x,y,z,w, see splat-renderer.js).
import { qMul, qNormalize } from './pose-math.js';
import { FLOATS_PER_SPLAT } from './splat-renderer.js';
import { parseGlb, prepareViews, readAccessor, matFromTRS, matMul } from './gltf-splats.js';
import { BLENDSHAPES } from './telemetry-codec.js';

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

function parseLamPly(ab) {
  const bytes = new Uint8Array(ab);
  const text = new TextDecoder().decode(bytes.subarray(0, 4096));
  const end = text.indexOf('end_header\n');
  if (end < 0) throw new Error('offset.ply: no PLY header');
  const headerLen = end + 'end_header\n'.length;
  const m = text.match(/element vertex (\d+)/);
  if (!m) throw new Error('offset.ply: no vertex element');
  const n = +m[1];
  const props = [...text.slice(0, end).matchAll(/property float (\w+)/g)].map((x) => x[1]);
  const stride = props.length * 4;
  const propIdx = Object.fromEntries(props.map((p, i) => [p, i]));
  for (const k of ['x', 'y', 'z', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3']) {
    if (propIdx[k] == null) throw new Error(`offset.ply: missing property ${k}`);
  }
  const dv = new DataView(ab, headerLen, n * stride);
  const off = new Float32Array(n * 3), col = new Float32Array(n * 3), op = new Float32Array(n);
  const scl = new Float32Array(n * 3), rot = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const b = i * stride;
    const f = (k) => dv.getFloat32(b + propIdx[k] * 4, true);
    off[i * 3] = f('x'); off[i * 3 + 1] = f('y'); off[i * 3 + 2] = f('z');
    col[i * 3] = f('f_dc_0'); col[i * 3 + 1] = f('f_dc_1'); col[i * 3 + 2] = f('f_dc_2');
    op[i] = sigmoid(f('opacity'));
    scl[i * 3] = Math.exp(f('scale_0')); scl[i * 3 + 1] = Math.exp(f('scale_1')); scl[i * 3 + 2] = Math.exp(f('scale_2'));
    const w = f('rot_0'), x = f('rot_1'), y = f('rot_2'), z = f('rot_3');
    const q = qNormalize([x, y, z, w]);
    rot[i * 4] = q[0]; rot[i * 4 + 1] = q[1]; rot[i * 4 + 2] = q[2]; rot[i * 4 + 3] = q[3];
  }
  return { count: n, off, col, op, scl, rot };
}

const yawQuat = (yaw) => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];

// Rest-pose only (no LBS skinning yet). base: URL prefix ending in '/'
// holding skin.glb, offset.ply, vertex_order.json.
export async function loadLamHead(base, opts = {}) {
  // maxScale/maxAspect mirror cply.js's needle suppression: LAM's raw
  // per-vertex scales include near-degenerate flat/thin gaussians (one
  // axis orders of magnitude thinner than the others) that the renderer's
  // screen-space ellipse radius (clamped at 512px) draws as long streaks.
  const { targetHeight = null, yaw = 0, at = [0, 0, 0], alpha = 1, alphaMin = 0.05, maxScale = 0.006, maxAspect = 4, debugDots = false, debugNoOffset = false } = opts;
  // NOTE 2026-09-03: vertex_order.json looked like it should be the
  // plyRow → meshVertex map (LAM_WebRender ships it alongside these two
  // files, same length, a 0..N-1 permutation) but empirically it is NOT:
  // indexing skin.glb's POSITION by vertex_order[i] scrambles the head
  // into a blob, while indexing directly by i (offset.ply row i = mesh
  // vertex i) reproduces a correct, recognisable face. So PLY rows and
  // mesh vertices are already 1:1 in file order; vertex_order.json is
  // unused here (its real purpose in LAM_WebRender is still unconfirmed).
  const [glbAb, plyAb] = await Promise.all([
    fetch(base + 'skin.glb').then((r) => r.arrayBuffer()),
    fetch(base + 'offset.ply').then((r) => r.arrayBuffer()),
  ]);
  const { json: gltf, bin } = parseGlb(glbAb);
  const views = await prepareViews(gltf, bin);
  const prim = gltf.meshes[0].primitives[0];
  const pos = readAccessor(gltf, views, prim.attributes.POSITION);
  const ply = parseLamPly(plyAb);
  if (ply.count !== pos.count) throw new Error(`offset.ply count ${ply.count} != skin.glb vertex count ${pos.count}`);

  const n = ply.count;
  const rest = new Float32Array(n * 3);
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    const x = pos.data[i * 3] + (debugNoOffset ? 0 : ply.off[i * 3]);
    const y = pos.data[i * 3 + 1] + (debugNoOffset ? 0 : ply.off[i * 3 + 1]);
    const z = pos.data[i * 3 + 2] + (debugNoOffset ? 0 : ply.off[i * 3 + 2]);
    rest[i * 3] = x; rest[i * 3 + 1] = y; rest[i * 3 + 2] = z;
    if (x < mn[0]) mn[0] = x; if (x > mx[0]) mx[0] = x;
    if (y < mn[1]) mn[1] = y; if (y > mx[1]) mx[1] = y;
    if (z < mn[2]) mn[2] = z; if (z > mx[2]) mx[2] = z;
  }
  const height = mx[1] - mn[1];
  const scale = targetHeight ? targetHeight / height : 1;
  const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const qYaw = yawQuat(yaw);

  const out = new Float32Array(n * FLOATS_PER_SPLAT);
  let made = 0;
  for (let i = 0; i < n; i++) {
    if (ply.op[i] < alphaMin) continue;
    const i3 = i * 3, i4 = i * 4, o = made * FLOATS_PER_SPLAT;
    const lx = (rest[i3] - cx) * scale, ly = (rest[i3 + 1] - mn[1]) * scale, lz = (rest[i3 + 2] - cz) * scale;
    out[o] = at[0] + lx * cy + lz * sy;
    out[o + 1] = at[1] + ly;
    out[o + 2] = at[2] - lx * sy + lz * cy;
    if (debugDots) {
      out[o + 3] = 0; out[o + 4] = 0; out[o + 5] = 0; out[o + 6] = 1;
      out[o + 7] = 0.0015; out[o + 8] = 0.0015; out[o + 9] = 0.0015;
    } else {
      const q = qNormalize(qMul(qYaw, [ply.rot[i4], ply.rot[i4 + 1], ply.rot[i4 + 2], ply.rot[i4 + 3]]));
      out[o + 3] = q[0]; out[o + 4] = q[1]; out[o + 5] = q[2]; out[o + 6] = q[3];
      // needle suppression: cap the largest axis relative to the smallest,
      // then cap all axes to an absolute maximum (same recipe as cply.js)
      let s0 = ply.scl[i3] * scale, s1 = ply.scl[i3 + 1] * scale, s2 = ply.scl[i3 + 2] * scale;
      const smin = Math.max(1e-5, Math.min(s0, s1, s2)), cap = Math.min(maxScale, smin * maxAspect);
      out[o + 7] = Math.min(s0, cap); out[o + 8] = Math.min(s1, cap); out[o + 9] = Math.min(s2, cap);
    }
    out[o + 10] = ply.col[i3]; out[o + 11] = ply.col[i3 + 1]; out[o + 12] = ply.col[i3 + 2];
    out[o + 13] = ply.op[i] * alpha;
    made++;
  }
  return {
    data: out.subarray(0, made * FLOATS_PER_SPLAT), count: made,
    dims: [(mx[0] - mn[0]) * scale, height * scale, (mx[2] - mn[2]) * scale],
  };
}

// ---------------------------------------------------------------- posable avatar
// column-major 3x3 helpers (same conventions as rigged-splats.js's private
// ones — duplicated rather than imported since that module doesn't export
// them). The matrix→quaternion step (Shepperd's method) that used to live
// here as `mat3ToQuat` is now inlined as scalar math directly in the
// per-splat loop in pose() below, to avoid allocating a JS array per splat.
const rot3 = (m) => [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
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

// Full asset load: mesh + skeleton + morph targets + real splat params,
// ready for per-frame pose(). base: URL prefix ending in '/'.
export async function loadLamAvatar(base, opts = {}) {
  const { targetHeight = null, yaw = 0, alphaMin = 0.05, maxScale = 0.006, maxAspect = 4, meshBase = base } = opts;
  // meshBase defaults to base (skin.glb + offset.ply co-located, as the
  // original sample/synth-face folders do) but can point elsewhere so many
  // offset.ply files can share ONE skin.glb instead of each carrying its
  // own 3.6MB copy of an identical mesh — real saving once you're past a
  // handful of avatars (50 duplicated copies would be ~180MB for nothing).
  const [glbAb, plyAb] = await Promise.all([
    fetch(meshBase + 'skin.glb').then((r) => r.arrayBuffer()),
    fetch(base + 'offset.ply').then((r) => r.arrayBuffer()),
  ]);
  const { json: gltf, bin } = parseGlb(glbAb);
  const views = await prepareViews(gltf, bin);
  const nodes = gltf.nodes, N = nodes.length;
  const prim = gltf.meshes[0].primitives[0];
  const pos = readAccessor(gltf, views, prim.attributes.POSITION);
  const jn = readAccessor(gltf, views, prim.attributes.JOINTS_0);
  const wt = readAccessor(gltf, views, prim.attributes.WEIGHTS_0);
  const ply = parseLamPly(plyAb);
  if (ply.count !== pos.count) throw new Error(`offset.ply count ${ply.count} != skin.glb vertex count ${pos.count}`);
  const n = ply.count;

  // node tree, parent-first order, rest local + world matrices
  const parent = new Int32Array(N).fill(-1);
  nodes.forEach((nd, i) => (nd.children || []).forEach((c) => { parent[c] = i; }));
  const order = [];
  const visit = (i) => { order.push(i); for (const c of nodes[i].children || []) visit(c); };
  for (const r of gltf.scenes[gltf.scene || 0].nodes) visit(r);
  const local = nodes.map((nd) => (nd.matrix ? new Float32Array(nd.matrix) : matFromTRS(nd.translation, nd.rotation, nd.scale)));
  const world = new Array(N);
  for (const i of order) world[i] = parent[i] < 0 ? local[i] : matMul(world[parent[i]], local[i]);
  const nodeName = nodes.map((nd) => nd.name || '');
  const nodeIndexByName = {};
  nodeName.forEach((nm, i) => { if (nm && nodeIndexByName[nm] == null) nodeIndexByName[nm] = i; });

  const skinDef = gltf.skins[0];
  const ibm = readAccessor(gltf, views, skinDef.inverseBindMatrices).data;
  const skin = { joints: skinDef.joints, ibm };

  // morph targets: mesh.extras.targetNames gives the ARKit name for each
  // prim.targets[] slot; keep only the POSITION deltas (same local space
  // as the base mesh — applied pre-skin, same as rigged-splats.js).
  const targetNames = gltf.meshes[0].extras?.targetNames || [];
  const morphs = {};
  if (prim.targets) {
    for (let ti = 0; ti < prim.targets.length; ti++) {
      const nm = targetNames[ti];
      const acc = prim.targets[ti].POSITION;
      if (nm && acc != null) morphs[nm] = readAccessor(gltf, views, acc).data;
    }
  }

  // per-splat joint indices (JOINTS_0 values are indices INTO skin.joints,
  // not raw node indices — resolve once here, same as rigged-splats.js)
  const jidx = new Uint16Array(n * 4), jw = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) {
    jidx[i] = skin.joints[jn.data[i]] ?? 0;
    jw[i] = wt.data[i];
  }

  // rest bbox (mesh + ply offset) → place() transform, same as loadLamHead
  let mnv = [Infinity, Infinity, Infinity], mxv = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const v = pos.data[i * 3 + k] + ply.off[i * 3 + k];
      if (v < mnv[k]) mnv[k] = v; if (v > mxv[k]) mxv[k] = v;
    }
  }
  const height = mxv[1] - mnv[1];
  const scale = targetHeight ? targetHeight / height : 1;
  const centre = [(mnv[0] + mxv[0]) / 2, mnv[1], (mnv[2] + mxv[2]) / 2];

  return new LamHeadAvatar({
    count: n, pos: pos.data, ply, jidx, jw, morphs,
    nodes: { N, parent, order, world }, nodeName, nodeIndexByName, skin,
    scale, centre, yaw, heightM: height * scale,
    alphaMin, maxScale, maxAspect,
  });
}

const yawQuatV = (yaw) => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
const IDENTITY_Q = [0, 0, 0, 1];

export class LamHeadAvatar {
  constructor(d) {
    Object.assign(this, d);
    const { N, parent, order, world } = d.nodes;
    this.parent = parent; this.order = order;
    this.restRot = new Array(N); this.restPos = new Array(N);
    for (let i = 0; i < N; i++) {
      this.restRot[i] = rot3(world[i]);
      this.restPos[i] = [world[i][12], world[i][13], world[i][14]];
    }
    this.qYaw = yawQuatV(this.yaw);
    this.accum = new Array(N); this.newRot = new Array(N); this.newPos = new Array(N);
    this.J = new Float32Array(N * 12);
    this.posed = false;
  }

  get morphNames() { return Object.keys(this.morphs); }
  hasBone(name) { return this.nodeIndexByName[name] != null; }

  // pose: { at, bones: {nodeName: quat, MODEL space — no yaw conjugation
  // needed since these are raw skeleton node names, not avatar-space
  // humanoid bones}, morph: {arkitName: 0..1}, alpha }.
  // Writes count splats at out[off..]. Returns out.
  pose(p, out, off = 0) {
    const at = p.at || [0, 0, 0];
    const bones = p.bones || {};
    const { parent, order, restRot, restPos, accum, newRot, newPos, nodeName } = this;
    for (const nd of order) {
      const qa = bones[nodeName[nd]];
      const pa = parent[nd];
      const accP = pa < 0 ? IDENTITY_Q : accum[pa];
      accum[nd] = qa ? qMul(accP, qa) : accP;
      newRot[nd] = mul3(quatToMat3(accum[nd]), restRot[nd]);
      if (pa < 0) newPos[nd] = restPos[nd].slice();
      else {
        const dlt = [restPos[nd][0] - restPos[pa][0], restPos[nd][1] - restPos[pa][1], restPos[nd][2] - restPos[pa][2]];
        // rotate dlt by accP (quaternion rotate-vector, inlined to avoid an import cycle)
        const [qx, qy, qz, qw] = accP;
        const tx = 2 * (qy * dlt[2] - qz * dlt[1]), ty = 2 * (qz * dlt[0] - qx * dlt[2]), tz = 2 * (qx * dlt[1] - qy * dlt[0]);
        const rx = dlt[0] + qw * tx + (qy * tz - qz * ty), ry = dlt[1] + qw * ty + (qz * tx - qx * tz), rz = dlt[2] + qw * tz + (qx * ty - qy * tx);
        newPos[nd] = [newPos[pa][0] + rx, newPos[pa][1] + ry, newPos[pa][2] + rz];
      }
    }
    const J = this.J;
    const sk = this.skin;
    for (let k = 0; k < sk.joints.length; k++) {
      const nd = sk.joints[k], R = newRot[nd], t = newPos[nd], m = sk.ibm, mo = k * 16, jo = nd * 12;
      for (let c = 0; c < 4; c++) {
        const b0 = m[mo + c * 4], b1 = m[mo + c * 4 + 1], b2 = m[mo + c * 4 + 2], b3 = m[mo + c * 4 + 3];
        J[jo + c * 3] = R[0] * b0 + R[3] * b1 + R[6] * b2 + t[0] * b3;
        J[jo + c * 3 + 1] = R[1] * b0 + R[4] * b1 + R[7] * b2 + t[1] * b3;
        J[jo + c * 3 + 2] = R[2] * b0 + R[5] * b1 + R[8] * b2 + t[2] * b3;
      }
    }
    this.posed = true;

    const { count, pos, ply, jidx, jw, morphs, scale, centre, yaw, alphaMin, maxScale, maxAspect } = this;
    const mw = [];
    for (const nm of Object.keys(p.morph || {})) {
      const w = p.morph[nm];
      if (w > 0.002 && morphs[nm]) mw.push([morphs[nm], Math.min(1, w)]);
    }
    const alpha = p.alpha ?? 1;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const M = new Float32Array(12);
    // qYaw is the same for every splat in this call — read its 4 scalars
    // once outside the loop instead of re-touching the array per splat.
    const [yqx, yqy, yqz, yqw] = this.qYaw;
    let o = off, made = 0;
    for (let i = 0; i < count; i++) {
      if (ply.op[i] < alphaMin) continue;
      const i3 = i * 3, i4 = i * 4;
      let px = pos[i3] + ply.off[i3], py = pos[i3 + 1] + ply.off[i3 + 1], pz = pos[i3 + 2] + ply.off[i3 + 2];
      for (const [d, w] of mw) { px += d[i3] * w; py += d[i3 + 1] * w; pz += d[i3 + 2] * w; }
      const lqx = ply.rot[i4], lqy = ply.rot[i4 + 1], lqz = ply.rot[i4 + 2], lqw = ply.rot[i4 + 3];
      const w0 = jw[i4];
      // qSkin, identity unless this splat is actually skinned (w0 > 0)
      let sqx = 0, sqy = 0, sqz = 0, sqw = 1;
      if (w0 > 0) {
        M.fill(0);
        for (let k = 0; k < 4; k++) {
          const w = jw[i4 + k];
          if (w <= 0) break;
          const jo = jidx[i4 + k] * 12;
          for (let e = 0; e < 12; e++) M[e] += J[jo + e] * w;
        }
        const qx = M[0] * px + M[3] * py + M[6] * pz + M[9];
        const qy = M[1] * px + M[4] * py + M[7] * pz + M[10];
        const qz = M[2] * px + M[5] * py + M[8] * pz + M[11];
        px = qx; py = qy; pz = qz;
        // mat3ToQuat, inlined scalar (Shepperd's method) — this and every
        // quaternion combine below used to go through pose-math.js's
        // array-returning helpers, allocating up to 6 short-lived JS
        // arrays PER SPLAT (qLocal, the mat3ToQuat result, two qMul
        // results, two qNormalize results). At ~13.5k splats × 5 avatars
        // that was ~400k avoidable array allocations every frame. Same
        // math, scalars only, no allocation.
        const m00 = M[0], m10 = M[1], m20 = M[2], m01 = M[3], m11 = M[4], m21 = M[5], m02 = M[6], m12 = M[7], m22 = M[8];
        const tr = m00 + m11 + m22;
        if (tr > 0) {
          const s = Math.sqrt(tr + 1) * 2;
          sqw = 0.25 * s; sqx = (m21 - m12) / s; sqy = (m02 - m20) / s; sqz = (m10 - m01) / s;
        } else if (m00 > m11 && m00 > m22) {
          const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
          sqw = (m21 - m12) / s; sqx = 0.25 * s; sqy = (m01 + m10) / s; sqz = (m02 + m20) / s;
        } else if (m11 > m22) {
          const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
          sqw = (m02 - m20) / s; sqx = (m01 + m10) / s; sqy = 0.25 * s; sqz = (m12 + m21) / s;
        } else {
          const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
          sqw = (m10 - m01) / s; sqx = (m02 + m20) / s; sqy = (m12 + m21) / s; sqz = 0.25 * s;
        }
        const sl = Math.hypot(sqx, sqy, sqz, sqw) || 1;
        sqx /= sl; sqy /= sl; sqz /= sl; sqw /= sl;
      }
      // q = normalize(qSkin * qLocal), Hamilton product inlined
      let qx = sqw * lqx + sqx * lqw + sqy * lqz - sqz * lqy;
      let qy = sqw * lqy - sqx * lqz + sqy * lqw + sqz * lqx;
      let qz = sqw * lqz + sqx * lqy - sqy * lqx + sqz * lqw;
      let qs = sqw * lqw - sqx * lqx - sqy * lqy - sqz * lqz;
      let ql = Math.hypot(qx, qy, qz, qs) || 1;
      qx /= ql; qy /= ql; qz /= ql; qs /= ql;
      // place: recentre, scale, yaw, at
      const lx = (px - centre[0]) * scale, ly = (py - centre[1]) * scale, lz = (pz - centre[2]) * scale;
      const wx = at[0] + lx * cy + lz * sy, wy = at[1] + ly, wz = at[2] - lx * sy + lz * cy;
      // qw = normalize(qYaw * q), same inlined product
      let owx = yqw * qx + yqx * qs + yqy * qz - yqz * qy;
      let owy = yqw * qy - yqx * qz + yqy * qs + yqz * qx;
      let owz = yqw * qz + yqx * qy - yqy * qx + yqz * qs;
      let oww = yqw * qs - yqx * qx - yqy * qy - yqz * qz;
      const owl = Math.hypot(owx, owy, owz, oww) || 1;
      owx /= owl; owy /= owl; owz /= owl; oww /= owl;
      const oo = off + made * FLOATS_PER_SPLAT;
      out[oo] = wx; out[oo + 1] = wy; out[oo + 2] = wz;
      out[oo + 3] = owx; out[oo + 4] = owy; out[oo + 5] = owz; out[oo + 6] = oww;
      let s0 = ply.scl[i3] * scale, s1 = ply.scl[i3 + 1] * scale, s2 = ply.scl[i3 + 2] * scale;
      const smin = Math.max(1e-5, Math.min(s0, s1, s2)), cap = Math.min(maxScale, smin * maxAspect);
      out[oo + 7] = Math.min(s0, cap); out[oo + 8] = Math.min(s1, cap); out[oo + 9] = Math.min(s2, cap);
      out[oo + 10] = ply.col[i3]; out[oo + 11] = ply.col[i3 + 1]; out[oo + 12] = ply.col[i3 + 2];
      out[oo + 13] = ply.op[i] * alpha;
      made++;
    }
    this.lastCount = made;
    return out;
  }

  toFloat32(at = [0, 0, 0]) {
    const out = new Float32Array(this.count * FLOATS_PER_SPLAT);
    this.pose({ at }, out, 0);
    return out.subarray(0, this.lastCount * FLOATS_PER_SPLAT);
  }
}

// Translate the telemetry packet's 10-channel blendshape array into the
// {arkitName: weight} shape LamHeadAvatar.pose()'s `morph` wants. 8 of the
// 10 packet channels are already real ARKit names (see telemetry-codec.js
// BLENDSHAPES) and match LAM's mesh.extras.targetNames directly; eyeLookX/Y
// are a simplified signed proxy with no single matching ARKit target, so
// (like the VRM path's "no gaze" limit) they're dropped here too.
export function arkitMorphFromBlend(blend) {
  if (!blend) return {};
  const m = {};
  BLENDSHAPES.forEach((nm, i) => { if (nm !== 'eyeLookX' && nm !== 'eyeLookY') m[nm] = blend[i]; });
  return m;
}
