// rigged-splats.js — a SKINNED, MORPHING splat avatar from a VRM / rigged
// GLB. The mesh is area-sampled once into splats (like gltf-splats.js),
// but each sample also keeps its skin joints + weights, its rest normal,
// its unlit base colour and the VRM expression morph deltas. Every frame
// `pose()` runs linear-blend skinning on the CPU, applies the expression
// weights, re-lights against the posed normals and writes the block in
// the renderer's 14-float layout — the same "rewrite a splat block per
// frame" mechanism the procedural avatar and the critters use.
//
// Spaces. MODEL space is the glTF file's own (VRM 0.x models face −z).
// AVATAR space is what callers see: metres, feet at y=0, centred, facing
// +z — the sampler's place() transform (scale, centre, yaw). Bone
// rotations are given in avatar space and converted internally.
//
// Forward kinematics is done in model space on the humanoid skeleton:
//   accum[n]  = accum[parent] ⊗ A[n]          (A = caller's bone rotation)
//   rot'[n]   = accum[n] · restRot[n]
//   pos'[n]   = pos'[parent] + accum[parent] · (restPos[n] − restPos[parent])
// so a bone rotation is "rotate this joint and everything below it, in
// the frame its parent has already been rotated into" — what an
// animation clip means by "bend the elbow". Then J = [rot'|pos'] · ibm.
import { mulberry32, qMul, qConjugate, qRotVec, qNormalize } from './pose-math.js';
import { FLOATS_PER_SPLAT } from './splat-renderer.js';
import { parseGlb, prepareViews, readAccessor, matFromTRS, matMul, textureFor, sampleColor,
  xfmPoint, xfmNormal } from './gltf-splats.js';

export const HUMAN_BONES = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
];

// name-based fallback for rigs without a VRM humanoid block (mixamo names)
const NAME_RX = {
  hips: /hips$/i, spine: /spine$/i, chest: /spine1$/i, upperChest: /spine2$/i,
  neck: /neck$/i, head: /head$/i,
  leftShoulder: /leftshoulder$/i, leftUpperArm: /leftarm$/i, leftLowerArm: /leftforearm$/i, leftHand: /lefthand$/i,
  rightShoulder: /rightshoulder$/i, rightUpperArm: /rightarm$/i, rightLowerArm: /rightforearm$/i, rightHand: /righthand$/i,
  leftUpperLeg: /leftupleg$/i, leftLowerLeg: /leftleg$/i, leftFoot: /leftfoot$/i, leftToes: /lefttoebase$/i,
  rightUpperLeg: /rightupleg$/i, rightLowerLeg: /rightleg$/i, rightFoot: /rightfoot$/i, rightToes: /righttoebase$/i,
};

function humanoidMap(gltf) {
  const out = {};
  const v0 = gltf.extensions?.VRM?.humanoid?.humanBones;
  const v1 = gltf.extensions?.VRMC_vrm?.humanoid?.humanBones;
  if (v0) for (const b of v0) out[b.bone] = b.node;
  else if (v1) for (const k of Object.keys(v1)) out[k] = v1[k].node;
  else {
    gltf.nodes.forEach((n, i) => {
      for (const k of Object.keys(NAME_RX)) if (out[k] == null && NAME_RX[k].test(n.name || '')) out[k] = i;
    });
  }
  return out;
}

// VRM expression groups → [{ name, binds: [{ mesh, index, weight 0..1 }] }]
function morphGroups(gltf) {
  const groups = [];
  const v0 = gltf.extensions?.VRM?.blendShapeMaster?.blendShapeGroups;
  if (v0) {
    for (const g of v0) {
      const nm = (g.presetName && g.presetName !== 'unknown') ? g.presetName : (g.name || '').toLowerCase();
      if (!nm || !g.binds?.length) continue;
      groups.push({ name: nm, binds: g.binds.map(b => ({ mesh: b.mesh, index: b.index, weight: (b.weight ?? 100) / 100 })) });
    }
  }
  const v1 = gltf.extensions?.VRMC_vrm?.expressions;
  if (v1) {
    const all = { ...(v1.preset || {}), ...(v1.custom || {}) };
    for (const nm of Object.keys(all)) {
      const binds = (all[nm].morphTargetBinds || []).map(b => ({
        mesh: gltf.nodes[b.node]?.mesh, index: b.index, weight: b.weight ?? 1,
      })).filter(b => b.mesh != null);
      if (binds.length) groups.push({ name: nm, binds });
    }
  }
  return groups;
}

const yawQuat = (yaw) => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];

export async function loadRiggedSplats(url, opts = {}) {
  const { count = 18000, targetHeight = null, yaw = Math.PI, seed = 11 } = opts;
  const ab = await (await fetch(url)).arrayBuffer();
  const { json: gltf, bin } = parseGlb(ab);
  const views = await prepareViews(gltf, bin);
  const nodes = gltf.nodes;
  const N = nodes.length;

  // node tree in parent-first order, rest local + world matrices
  const parent = new Int32Array(N).fill(-1);
  nodes.forEach((n, i) => (n.children || []).forEach(c => { parent[c] = i; }));
  const order = [];
  const visit = (i) => { order.push(i); for (const c of nodes[i].children || []) visit(c); };
  for (const r of gltf.scenes[gltf.scene || 0].nodes) visit(r);
  const local = nodes.map(n => n.matrix ? new Float32Array(n.matrix) : matFromTRS(n.translation, n.rotation, n.scale));
  const world = new Array(N);
  for (const i of order) world[i] = parent[i] < 0 ? local[i] : matMul(world[parent[i]], local[i]);

  const human = humanoidMap(gltf);
  const skins = (gltf.skins || []).map(sk => ({
    joints: sk.joints,
    ibm: sk.inverseBindMatrices != null ? readAccessor(gltf, views, sk.inverseBindMatrices).data : null,
  }));
  const groups = morphGroups(gltf);

  // gather triangles; skinned prims keep RAW positions (joint matrices
  // replace the node transform per the glTF spec), static prims are
  // baked to world space
  const tris = [];
  const morphCache = new Map();   // `${mesh}/${target}` → Float32Array deltas
  const morphAcc = (meshIdx, prim, ti) => {
    const key = meshIdx + '/' + ti;
    if (!morphCache.has(key)) {
      const acc = prim.targets?.[ti]?.POSITION;
      morphCache.set(key, acc != null ? readAccessor(gltf, views, acc).data : null);
    }
    return morphCache.get(key);
  };
  for (const ni of order) {
    const node = nodes[ni];
    if (node.mesh == null) continue;
    const mesh = gltf.meshes[node.mesh];
    const skin = node.skin != null ? skins[node.skin] : null;
    const W = world[ni];
    for (const prim of mesh.primitives) {
      if ((prim.mode ?? 4) !== 4 || prim.attributes.POSITION == null) continue;
      const pos = readAccessor(gltf, views, prim.attributes.POSITION);
      const nrm = prim.attributes.NORMAL != null ? readAccessor(gltf, views, prim.attributes.NORMAL) : null;
      const uv = prim.attributes.TEXCOORD_0 != null ? readAccessor(gltf, views, prim.attributes.TEXCOORD_0) : null;
      const jn = skin && prim.attributes.JOINTS_0 != null ? readAccessor(gltf, views, prim.attributes.JOINTS_0) : null;
      const wt = skin && prim.attributes.WEIGHTS_0 != null ? readAccessor(gltf, views, prim.attributes.WEIGHTS_0) : null;
      const idx = prim.indices != null ? readAccessor(gltf, views, prim.indices).data : null;
      // morph binds that touch this mesh: group → [{ deltas, weight }]
      const gm = groups.map(g => g.binds.filter(b => b.mesh === node.mesh)
        .map(b => ({ deltas: morphAcc(node.mesh, prim, b.index), weight: b.weight }))
        .filter(b => b.deltas));
      const nTri = (idx ? idx.length : pos.count) / 3;
      for (let t = 0; t < nTri; t++) {
        const ia = idx ? idx[t * 3] : t * 3, ib = idx ? idx[t * 3 + 1] : t * 3 + 1, ic = idx ? idx[t * 3 + 2] : t * 3 + 2;
        const P = (i) => [pos.data[i * 3], pos.data[i * 3 + 1], pos.data[i * 3 + 2]];
        let p0 = P(ia), p1 = P(ib), p2 = P(ic);
        if (!skin) { p0 = xfmPoint(W, p0); p1 = xfmPoint(W, p1); p2 = xfmPoint(W, p2); }
        const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
        const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
        const area = Math.hypot(cx, cy, cz) / 2;
        if (area < 1e-12) continue;
        const fn = [cx / (2 * area), cy / (2 * area), cz / (2 * area)];
        const nAt = (i) => {
          if (!nrm) return fn;
          const n = [nrm.data[i * 3], nrm.data[i * 3 + 1], nrm.data[i * 3 + 2]];
          return skin ? n : xfmNormal(W, n);
        };
        const uvAt = (i) => uv ? [uv.data[i * 2], uv.data[i * 2 + 1]] : [0, 0];
        tris.push({ p0, p1, p2, n0: nAt(ia), n1: nAt(ib), n2: nAt(ic),
          uv0: uvAt(ia), uv1: uvAt(ib), uv2: uvAt(ic), mat: prim.material, area,
          ia, ib, ic, jn, wt, skin, gm });
      }
    }
  }
  if (!tris.length) throw new Error('no triangles found');
  const texCache = new Map();
  for (const t of tris) await textureFor(gltf, views, t.mat, texCache);

  // rest-pose bbox in model space → place() transform
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const skinWorld = (t, p) => {   // rest skinning = identity for bbox purposes
    return p;
  };
  for (const t of tris) for (const p of [t.p0, t.p1, t.p2]) {
    const q = skinWorld(t, p);
    for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], q[i]); mx[i] = Math.max(mx[i], q[i]); }
  }
  const height = mx[1] - mn[1];
  const scale = targetHeight ? targetHeight / height : 1;
  const centre = [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2];

  // area-weighted sampling
  const cum = new Float32Array(tris.length);
  let total = 0;
  for (let i = 0; i < tris.length; i++) { total += tris[i].area; cum[i] = total; }
  const rnd = mulberry32(seed);
  const rest = new Float32Array(count * 3), nrmA = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const jidx = new Uint16Array(count * 4), jw = new Float32Array(count * 4);
  const morphs = groups.map(() => new Float32Array(count * 3));
  const morphUsed = groups.map(() => false);
  let made = 0;
  for (let i = 0; i < count; i++) {
    const r = rnd() * total;
    let lo = 0, hi = tris.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; cum[mid] < r ? lo = mid + 1 : hi = mid; }
    const t = tris[lo];
    let a = rnd(), b = rnd();
    if (a + b > 1) { a = 1 - a; b = 1 - b; }
    const c = 1 - a - b;
    const u = t.uv0[0] * c + t.uv1[0] * a + t.uv2[0] * b;
    const v = t.uv0[1] * c + t.uv1[1] * a + t.uv2[1] * b;
    const cl = sampleColor(texCache.get(t.mat), u, v);
    if (cl[3] < 0.4) continue;
    const o3 = made * 3;
    for (let k = 0; k < 3; k++) {
      rest[o3 + k] = t.p0[k] * c + t.p1[k] * a + t.p2[k] * b;
      nrmA[o3 + k] = t.n0[k] * c + t.n1[k] * a + t.n2[k] * b;
    }
    col[o3] = cl[0]; col[o3 + 1] = cl[1]; col[o3 + 2] = cl[2];
    // joints: merge the three vertices' influences, keep the top four
    if (t.jn && t.wt) {
      const acc = new Map();
      for (const [vi, bw] of [[t.ia, c], [t.ib, a], [t.ic, b]]) {
        for (let k = 0; k < 4; k++) {
          const w = t.wt.data[vi * 4 + k] * bw;
          if (w <= 0) continue;
          const j = t.jn.data[vi * 4 + k];
          acc.set(j, (acc.get(j) || 0) + w);
        }
      }
      const top = [...acc.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
      const sum = top.reduce((s, e) => s + e[1], 0) || 1;
      for (let k = 0; k < 4; k++) {
        jidx[made * 4 + k] = top[k] ? t.skin.joints[top[k][0]] : 0;
        jw[made * 4 + k] = top[k] ? top[k][1] / sum : 0;
      }
    }
    // morph deltas (model space, pre-skinning)
    for (let g = 0; g < groups.length; g++) {
      for (const { deltas, weight } of t.gm[g]) {
        for (let k = 0; k < 3; k++) {
          const d = (deltas[t.ia * 3 + k] * c + deltas[t.ib * 3 + k] * a + deltas[t.ic * 3 + k] * b) * weight;
          morphs[g][o3 + k] += d;
          if (d !== 0) morphUsed[g] = true;
        }
      }
    }
    made++;
  }
  const morphMap = {};
  groups.forEach((g, i) => { if (morphUsed[i]) morphMap[g.name] = morphs[i].subarray(0, made * 3); });

  const sSize = Math.sqrt((total * scale * scale) / count) * 0.72;
  return new RiggedAvatar({
    count: made, rest: rest.subarray(0, made * 3), nrm: nrmA.subarray(0, made * 3), col: col.subarray(0, made * 3),
    jidx: jidx.subarray(0, made * 4), jw: jw.subarray(0, made * 4), morphs: morphMap,
    nodes: { N, parent, order, world }, skins, human, scale, centre, yaw, size: sSize,
    heightM: height * scale, sourceTris: tris.length,
  });
}

// 3x3 rotation from a column-major 4x4
const rot3 = (m) => [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
const quatToMat3 = (q) => {
  const [x, y, z, w] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y),
    2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x),
    2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)];
};
// column-major 3x3 product a·b
const mul3 = (a, b) => [
  a[0] * b[0] + a[3] * b[1] + a[6] * b[2], a[1] * b[0] + a[4] * b[1] + a[7] * b[2], a[2] * b[0] + a[5] * b[1] + a[8] * b[2],
  a[0] * b[3] + a[3] * b[4] + a[6] * b[5], a[1] * b[3] + a[4] * b[4] + a[7] * b[5], a[2] * b[3] + a[5] * b[4] + a[8] * b[5],
  a[0] * b[6] + a[3] * b[7] + a[6] * b[8], a[1] * b[6] + a[4] * b[7] + a[7] * b[8], a[2] * b[6] + a[5] * b[7] + a[8] * b[8],
];
function qFromZTo(n) {
  const w = 1 + n[2];
  if (w < 1e-6) return [1, 0, 0, 0];
  const l = Math.hypot(n[1], n[0], w);
  return [-n[1] / l, n[0] / l, 0, w / l];
}

export class RiggedAvatar {
  constructor(d) {
    Object.assign(this, d);
    const { N, parent, order, world } = d.nodes;
    this.parent = parent; this.order = order;
    this.restRot = new Array(N); this.restPos = new Array(N);
    for (let i = 0; i < N; i++) {
      this.restRot[i] = rot3(world[i]);
      this.restPos[i] = [world[i][12], world[i][13], world[i][14]];
    }
    this.nodeBone = new Array(N).fill(null);
    for (const b of HUMAN_BONES) if (this.human[b] != null) this.nodeBone[this.human[b]] = b;
    this.qYaw = yawQuat(this.yaw);            // avatar = qYaw · model
    this.qYawInv = qConjugate(this.qYaw);
    this.accum = new Array(N); this.newRot = new Array(N); this.newPos = new Array(N);
    // joint matrix scratch (3x4 each) for every node referenced by a skin
    this.J = new Float32Array(N * 12);
    this.posed = false;
    this.light = [0.3, 0.75, 0.6];
    this.tint = null;
  }

  // model → avatar space (positions)
  place(p, at = [0, 0, 0]) {
    const x = (p[0] - this.centre[0]) * this.scale, y = (p[1] - this.centre[1]) * this.scale, z = (p[2] - this.centre[2]) * this.scale;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return [at[0] + x * c + z * s, at[1] + y, at[2] - x * s + z * c];
  }
  // rest joint position in avatar space (feet at 0, origin at model centre)
  restJoint(bone) {
    const n = this.human[bone];
    return n == null ? null : this.place(this.restPos[n]);
  }
  // posed joint position in avatar space (after pose()); same `at` as pose
  joint(bone) {
    const n = this.human[bone];
    return n == null || !this.posed ? this.restJoint(bone) : this.place(this.newPos[n], this._at);
  }
  hasBone(bone) { return this.human[bone] != null; }
  get morphNames() { return Object.keys(this.morphs); }

  // pose: { at, bones: {bone: quat (avatar space)}, hipsOffset: [x,y,z] (avatar
  // space, metres), morph: {name: 0..1}, light, tint, alpha }.
  // Writes count splats at out[off..] (14 floats each). Returns out.
  pose(p, out, off = 0) {
    const at = p.at || [0, 0, 0];
    this._at = at;
    const bones = p.bones || {};
    const { parent, order, restRot, restPos, accum, newRot, newPos } = this;
    const hipsNode = this.human.hips;
    const hipsOff = p.hipsOffset ? qRotVec(this.qYawInv, [p.hipsOffset[0] / this.scale, p.hipsOffset[1] / this.scale, p.hipsOffset[2] / this.scale]) : null;
    for (const n of order) {
      const b = this.nodeBone[n];
      const qa = b && bones[b];
      // avatar-space rotation → model space by conjugating with the yaw
      const A = qa ? qMul(this.qYawInv, qMul(qa, this.qYaw)) : null;
      const pa = parent[n];
      const accP = pa < 0 ? [0, 0, 0, 1] : accum[pa];
      accum[n] = A ? qMul(accP, A) : accP;
      newRot[n] = mul3(quatToMat3(accum[n]), restRot[n]);
      if (pa < 0) newPos[n] = restPos[n].slice();
      else {
        const d = [restPos[n][0] - restPos[pa][0], restPos[n][1] - restPos[pa][1], restPos[n][2] - restPos[pa][2]];
        const r = qRotVec(accP, d);
        newPos[n] = [newPos[pa][0] + r[0], newPos[pa][1] + r[1], newPos[pa][2] + r[2]];
      }
      if (hipsOff && n === hipsNode) { newPos[n][0] += hipsOff[0]; newPos[n][1] += hipsOff[1]; newPos[n][2] += hipsOff[2]; }
    }
    // joint matrices J = [R|t] · ibm  (3x4, column-major 4 columns of 3)
    const J = this.J;
    for (const sk of this.skins) {
      if (!sk.ibm) continue;
      for (let k = 0; k < sk.joints.length; k++) {
        const n = sk.joints[k], R = newRot[n], t = newPos[n], m = sk.ibm, mo = k * 16, jo = n * 12;
        for (let c = 0; c < 4; c++) {
          const b0 = m[mo + c * 4], b1 = m[mo + c * 4 + 1], b2 = m[mo + c * 4 + 2], b3 = m[mo + c * 4 + 3];
          J[jo + c * 3] = R[0] * b0 + R[3] * b1 + R[6] * b2 + t[0] * b3;
          J[jo + c * 3 + 1] = R[1] * b0 + R[4] * b1 + R[7] * b2 + t[1] * b3;
          J[jo + c * 3 + 2] = R[2] * b0 + R[5] * b1 + R[8] * b2 + t[2] * b3;
        }
      }
    }
    this.posed = true;

    // per-splat: morph → skin → place → light → write
    const { count, rest, nrm, col, jidx, jw, morphs, scale, centre, yaw, size } = this;
    const mw = [];
    for (const nm of Object.keys(p.morph || {})) {
      const w = p.morph[nm];
      if (w > 0.002 && morphs[nm]) mw.push([morphs[nm], Math.min(1, w)]);
    }
    const L = p.light || this.light, tint = p.tint || this.tint, alpha = p.alpha ?? 1;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const M = new Float32Array(12);
    let o = off;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3, i4 = i * 4;
      let px = rest[i3], py = rest[i3 + 1], pz = rest[i3 + 2];
      for (const [d, w] of mw) { px += d[i3] * w; py += d[i3 + 1] * w; pz += d[i3 + 2] * w; }
      let nx = nrm[i3], ny = nrm[i3 + 1], nz = nrm[i3 + 2];
      const w0 = jw[i4];
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
        const mx = M[0] * nx + M[3] * ny + M[6] * nz;
        const my = M[1] * nx + M[4] * ny + M[7] * nz;
        const mz = M[2] * nx + M[5] * ny + M[8] * nz;
        nx = mx; ny = my; nz = mz;
      }
      // place: centre, scale, yaw, at
      const lx = (px - centre[0]) * scale, ly = (py - centre[1]) * scale, lz = (pz - centre[2]) * scale;
      const wx = at[0] + lx * cy + lz * sy, wy = at[1] + ly, wz = at[2] - lx * sy + lz * cy;
      const nl = Math.hypot(nx, ny, nz) || 1;
      const wnx = (nx * cy + nz * sy) / nl, wny = ny / nl, wnz = (-nx * sy + nz * cy) / nl;
      const sh = L ? 0.55 + 0.5 * Math.max(0, wnx * L[0] + wny * L[1] + wnz * L[2]) : 1;
      const q = qFromZTo([wnx, wny, wnz]);
      out[o] = wx; out[o + 1] = wy; out[o + 2] = wz;
      out[o + 3] = q[0]; out[o + 4] = q[1]; out[o + 5] = q[2]; out[o + 6] = q[3];
      out[o + 7] = size; out[o + 8] = size; out[o + 9] = size * 0.3;
      let r = col[i3] * sh, g = col[i3 + 1] * sh, b = col[i3 + 2] * sh;
      if (tint) { r *= tint[0]; g *= tint[1]; b *= tint[2]; }
      out[o + 10] = r; out[o + 11] = g; out[o + 12] = b; out[o + 13] = alpha;
      o += FLOATS_PER_SPLAT;
    }
    return out;
  }

  // convenience: a fresh block at rest
  toFloat32(at = [0, 0, 0]) {
    const out = new Float32Array(this.count * FLOATS_PER_SPLAT);
    return this.pose({ at }, out, 0);
  }
}
