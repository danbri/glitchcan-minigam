/**
 * SDF edit list — the Dreams-style runtime form of a Lucid scene.
 *
 * A scene tree (union/smoothUnion/subtract of transformed primitives) is
 * flattened into a FLAT, ORDERED list of edits. Each edit is one primitive, one
 * transform, one blend op, one colour. A fixed loop folds them into a field:
 *
 *   field = 1e9
 *   for each edit:  field = blend(field, primitive(edit), edit.op, edit.k)
 *
 * This is DATA, not code — the opposite end from json-codegen's compiled tree.
 * The buffer can be edited live (move/add/delete an edit → rewrite the buffer →
 * re-bake the dirty region) which is what the clipclop engine wants.
 *
 * Faithfulness. Sequential folding equals the tree exactly for the additive
 * cases: unions, a single smoothUnion of primitives, and subtracts that apply
 * to the running field. It is an APPROXIMATION for nested smooth blends with
 * DIFFERENT radii (a tree isolates each group's blend; a flat list blends into
 * the running field). That is the real tree-vs-list difference, not a bug.
 *
 * Transform convention: standard TRS. world = t + s * R * local, composed with
 * proper matrices down the tree (R rotation, s uniform scale, t translation).
 * Non-uniform scale is approximated by its mean (SDF distance needs a uniform
 * Lipschitz factor). Verified in Node against a reference tree evaluator.
 */

// ---- tiny vec/mat helpers (row-major 3x3 as [9]) -------------------------

const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
function mat3mul(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}
const mat3vec = (m, v) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
];
const transpose3 = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
function rotXYZ(dx, dy, dz) {
  const rad = (d) => d * Math.PI / 180;
  const cx = Math.cos(rad(dx)), sx = Math.sin(rad(dx));
  const cy = Math.cos(rad(dy)), sy = Math.sin(rad(dy));
  const cz = Math.cos(rad(dz)), sz = Math.sin(rad(dz));
  const Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return mat3mul(mat3mul(Rz, Ry), Rx);
}

// ---- constant/value extraction (edit list needs literals) ----------------

function num(v, dflt = 0) {
  if (v == null) return dflt;
  if (typeof v === 'number') return v;
  if (v.type === 'const') return v.value;
  if (typeof v.value === 'number') return v.value;
  return dflt;
}
function vec3(v, dflt = [0, 0, 0]) {
  if (v == null) return dflt.slice();
  if (Array.isArray(v)) return [num(v[0]), num(v[1]), num(v[2])];
  if (v.type === 'array' && v.values) return [num(v.values[0]), num(v.values[1]), num(v.values[2])];
  return dflt.slice();
}

// ---- primitive table -----------------------------------------------------
// id must match the WGSL dispatch below and the JS eval.
const PRIM = { sphere: 0, box: 1, torus: 2, cylinder: 3, capsule: 4, ellipsoid: 5 };
const OP = { union: 0, subtract: 1, smoothUnion: 2, smoothSubtract: 3 };

// Read a primitive's params vector (meaning depends on prim id).
function primParams(node) {
  const p = node.params || {};
  switch (node.type) {
  case 'sphere': return [num(p.r, 1), 0, 0];
  case 'box': return vec3(p.size, [1, 1, 1]);
  case 'torus': return [num(p.major, 1), num(p.minor, 0.3), 0];
  case 'cylinder': return [num(p.h, 1), num(p.r, 0.5), 0];
  case 'capsule': return [num(p.h, 1), num(p.r, 0.25), 0];
  case 'ellipsoid': return vec3(p.radii, [1, 0.5, 0.5]);
  default: return [0, 0, 0];
  }
}
function primColor(node) {
  const c = node.color || (node.params && node.params.color);
  return c ? vec3(c, [0.8, 0.8, 0.8]) : [0.8, 0.8, 0.8];
}

// ---- transform accumulation ---------------------------------------------
// xf = { R:[9], s:number, t:[3] }  world = t + s*R*local
const XF_ID = () => ({ R: I3.slice(), s: 1, t: [0, 0, 0] });

function composeXf(outer, node) {
  const tr = node.transform || {};
  const T = tr.translate ? vec3(tr.translate) : [0, 0, 0];
  const rotArr = tr.rotate
    ? (Array.isArray(tr.rotate) ? tr.rotate.map(num)
      : (tr.rotate.type === 'array' ? tr.rotate.values.map(num) : [0, 0, 0]))
    : [0, 0, 0];
  // rotateAxis { axis, angle(deg) } — Rodrigues; else euler XYZ.
  let R_node;
  if (tr.rotateAxis) {
    const ax = vec3(tr.rotateAxis.axis, [0, 1, 0]);
    const L = Math.hypot(ax[0], ax[1], ax[2]) || 1;
    const u = [ax[0] / L, ax[1] / L, ax[2] / L];
    const th = num(tr.rotateAxis.angle, 0) * Math.PI / 180;
    const c = Math.cos(th), s = Math.sin(th), t = 1 - c;
    R_node = [
      t * u[0] * u[0] + c, t * u[0] * u[1] - s * u[2], t * u[0] * u[2] + s * u[1],
      t * u[0] * u[1] + s * u[2], t * u[1] * u[1] + c, t * u[1] * u[2] - s * u[0],
      t * u[0] * u[2] - s * u[1], t * u[1] * u[2] + s * u[0], t * u[2] * u[2] + c
    ];
  } else {
    R_node = rotXYZ(rotArr[0] || 0, rotArr[1] || 0, rotArr[2] || 0);
  }
  // The eval path uses R^T as the world→local point rotation. Codegen applies
  // the rotation matrix directly to the point, so store its transpose here to
  // MATCH the shader (not the inverse). Without this the baked field renders
  // rotations backwards vs Mayfly/Stinkyfish.
  R_node = transpose3(R_node);
  let s_node = 1;
  if (tr.scale != null) {
    const sc = tr.scale;
    if (typeof sc === 'number' || sc.type === 'const') s_node = num(sc, 1);
    else { const v = vec3(sc, [1, 1, 1]); s_node = (v[0] + v[1] + v[2]) / 3; }
  }
  // A_new = outer ∘ node
  return {
    R: mat3mul(outer.R, R_node),
    s: outer.s * s_node,
    t: [
      outer.t[0] + outer.s * mat3vec(outer.R, T)[0],
      outer.t[1] + outer.s * mat3vec(outer.R, T)[1],
      outer.t[2] + outer.s * mat3vec(outer.R, T)[2]
    ]
  };
}

// ---- flatten -------------------------------------------------------------

/**
 * Flatten a processed scene (from json-loader) into an ordered edit list.
 * @returns {{ edits: Array, unsupported: string[] }}
 * Each edit: { prim, op, k, xf:{R,s,t}, params:[3], color:[3] }
 * op is how this edit merges into the running field.
 */
export function flattenToEdits(scene) {
  const root = scene.root || scene;
  const edits = [];
  const unsupported = [];

  // op is the blend used when this node's leaves merge into the running field.
  function walk(node, xf, op, k, colorOverride) {
    if (!node || !node.type) return;
    const nx = node.transform ? composeXf(xf, node) : xf;

    if (PRIM[node.type] !== undefined) {
      edits.push({
        prim: PRIM[node.type], op, k,
        xf: nx,
        params: primParams(node),
        color: colorOverride || primColor(node)
      });
      return;
    }
    switch (node.type) {
    case 'union':
    case 'group':
      (node.children || []).forEach(c => walk(c, nx, op, k, colorOverride));
      return;
    case 'smoothUnion': {
      const kk = num(node.k, 0.1);
      (node.children || []).forEach(c => walk(c, nx, OP.smoothUnion, kk, colorOverride));
      return;
    }
    case 'subtract':
      (node.children || []).forEach((c, i) =>
        walk(c, nx, i === 0 ? op : OP.subtract, k, colorOverride));
      return;
    case 'smoothSubtract': {
      const kk = num(node.k, 0.1);
      (node.children || []).forEach((c, i) =>
        walk(c, nx, i === 0 ? op : OP.smoothSubtract, kk, colorOverride));
      return;
    }
    case 'material':
      walk(node.child, nx, op, k, primColor(node));
      return;
    case 'transform':
      walk(node.child, nx, op, k, colorOverride);
      return;
    default:
      if (!unsupported.includes(node.type)) unsupported.push(node.type);
    }
  }

  walk(root, XF_ID(), OP.union, 0, null);
  return { edits, unsupported };
}

// ---- JS reference evaluators (for Node verification) ---------------------

function primDist(local, prim, pr) {
  const [x, y, z] = local;
  const xz = Math.hypot(x, z);
  switch (prim) {
  case 0: return len3(local) - pr[0];                          // sphere
  case 1: {                                                     // box
    const qx = Math.abs(x) - pr[0], qy = Math.abs(y) - pr[1], qz = Math.abs(z) - pr[2];
    const o = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
    return o + Math.min(Math.max(qx, Math.max(qy, qz)), 0);
  }
  case 2: return Math.hypot(xz - pr[0], y) - pr[1];             // torus
  case 3: {                                                     // cylinder
    const dx = Math.abs(xz) - pr[1], dy = Math.abs(y) - pr[0];
    return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  }
  case 4: {                                                     // capsule
    const yy = y - Math.max(-pr[0], Math.min(pr[0], y));
    return Math.hypot(x, yy, z) - pr[1];
  }
  case 5: {                                                     // ellipsoid
    const k0 = Math.hypot(x / pr[0], y / pr[1], z / pr[2]);
    const k1 = Math.hypot(x / (pr[0] * pr[0]), y / (pr[1] * pr[1]), z / (pr[2] * pr[2]));
    return k0 * (k0 - 1) / k1;
  }
  default: return 1e9;
  }
}

function editDist(edit, p) {
  const rel = sub3(p, edit.xf.t);
  const local0 = mat3vec(transpose3(edit.xf.R), rel);
  const local = [local0[0] / edit.xf.s, local0[1] / edit.xf.s, local0[2] / edit.xf.s];
  return primDist(local, edit.prim, edit.params) * edit.xf.s;
}

/** Evaluate the flat edit list at p → { d, color }. Mirrors the WGSL loop. */
export function evalEdits(edits, p) {
  let d = 1e9, color = [0.6, 0.6, 0.6];
  for (let i = 0; i < edits.length; i++) {
    const e = edits[i];
    const ed = editDist(e, p);
    if (i === 0) { d = (e.op === OP.subtract || e.op === OP.smoothSubtract) ? -ed : ed; color = e.color; continue; }
    if (e.op === OP.union) {
      if (ed < d) { d = ed; color = e.color; }
    } else if (e.op === OP.smoothUnion) {
      const k = e.k || 1e-6;
      const h = Math.min(Math.max(0.5 + 0.5 * (ed - d) / k, 0), 1);
      d = ed * (1 - h) + d * h - k * h * (1 - h);
      color = [
        e.color[0] * (1 - h) + color[0] * h,
        e.color[1] * (1 - h) + color[1] * h,
        e.color[2] * (1 - h) + color[2] * h
      ];
    } else if (e.op === OP.subtract) {
      d = Math.max(d, -ed);
    } else if (e.op === OP.smoothSubtract) {
      const k = e.k || 1e-6;
      const h = Math.min(Math.max(0.5 - 0.5 * (d + ed) / k, 0), 1);
      d = d * (1 - h) + (-ed) * h + k * h * (1 - h);
    }
  }
  return { d, color };
}

/** Reference tree evaluator (true tree field) — verification only. */
export function evalTree(node, p, xf = XF_ID(), colorOverride = null) {
  const nx = node.transform ? composeXf(xf, node) : xf;
  const toLocal = (x) => {
    const rel = sub3(x, nx.t);
    const l = mat3vec(transpose3(nx.R), rel);
    return [l[0] / nx.s, l[1] / nx.s, l[2] / nx.s];
  };
  if (PRIM[node.type] !== undefined) {
    return { d: primDist(toLocal(p), PRIM[node.type], primParams(node)) * nx.s, color: colorOverride || primColor(node) };
  }
  const kids = node.children || [];
  switch (node.type) {
  case 'union':
  case 'group': {
    let best = { d: 1e9, color: [0.6, 0.6, 0.6] };
    for (const c of kids) { const r = evalTree(c, p, nx, colorOverride); if (r.d < best.d) best = r; }
    return best;
  }
  case 'smoothUnion': {
    const k = num(node.k, 0.1) || 1e-6;
    let acc = null;
    for (const c of kids) {
      const b = evalTree(c, p, nx, colorOverride);
      if (!acc) { acc = b; continue; }
      const h = Math.min(Math.max(0.5 + 0.5 * (b.d - acc.d) / k, 0), 1);
      const d = b.d * (1 - h) + acc.d * h - k * h * (1 - h);
      acc = { d, color: [b.color[0] * (1 - h) + acc.color[0] * h, b.color[1] * (1 - h) + acc.color[1] * h, b.color[2] * (1 - h) + acc.color[2] * h] };
    }
    return acc || { d: 1e9, color: [0.6, 0.6, 0.6] };
  }
  case 'subtract': {
    let acc = evalTree(kids[0], p, nx, colorOverride);
    for (let i = 1; i < kids.length; i++) acc = { d: Math.max(acc.d, -evalTree(kids[i], p, nx, colorOverride).d), color: acc.color };
    return acc;
  }
  case 'material': return evalTree(node.child, p, nx, primColor(node));
  case 'transform': return evalTree(node.child, p, nx, colorOverride);
  default: return { d: 1e9, color: [0.6, 0.6, 0.6] };
  }
}

// ---- WGSL generation -----------------------------------------------------
// Bake the edit list as a flat const f32 array + a data-driven loop. Stays
// uniform-free, so it splices into clipclop like the codegen bridge does.

const STRIDE = 22; // prim,op,k,s, RT(9), t(3), pr(3), col(3)

function f(v) { return Number.isInteger(v) ? v + '.0' : String(v); }

/** @returns {{ wgsl:string, count:number, unsupported:string[] }} */
export function generateEditListWgsl(scene, opts = {}) {
  const prefix = opts.prefix || 'lx_';
  const { edits, unsupported } = flattenToEdits(scene);
  const data = [];
  for (const e of edits) {
    const RT = transpose3(e.xf.R); // store R^T rows so local = R^T*(p-t)/s
    data.push(e.prim, e.op, e.k, e.xf.s,
      RT[0], RT[1], RT[2], RT[3], RT[4], RT[5], RT[6], RT[7], RT[8],
      e.xf.t[0], e.xf.t[1], e.xf.t[2],
      e.params[0], e.params[1], e.params[2],
      e.color[0], e.color[1], e.color[2]);
  }
  const N = edits.length;
  const arr = data.map(f).join(', ');
  const P = (n) => prefix + n;

  const wgsl = `// ===== Lucid → edit list (generated, data-driven) =====
// ${N} edits, stride ${STRIDE}. Folded by a loop, not compiled per node.
const ${P('EDITS')}: u32 = ${N}u;
const ${P('editData')} = array<f32, ${Math.max(1, N * STRIDE)}>(${N ? arr : '0.0'});
fn ${P('editPrim')}(pl: vec3f, prim: i32, pr: vec3f) -> f32 {
  if (prim == 0) { return length(pl) - pr.x; }
  if (prim == 1) { let q = abs(pl) - pr; return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0); }
  if (prim == 2) { return length(vec2f(length(pl.xz) - pr.x, pl.y)) - pr.y; }
  if (prim == 3) { let d = abs(vec2f(length(pl.xz), pl.y)) - vec2f(pr.y, pr.x); return min(max(d.x, d.y), 0.0) + length(max(d, vec2f(0.0))); }
  if (prim == 4) { var q = pl; q.y = q.y - clamp(q.y, -pr.x, pr.x); return length(q) - pr.y; }
  if (prim == 5) { let k0 = length(pl / pr); let k1 = length(pl / (pr * pr)); return k0 * (k0 - 1.0) / k1; }
  return 1e9;
}
fn ${P('editField')}(p: vec3f) -> vec4f {
  var d = 1e9;
  var col = vec3f(0.6, 0.6, 0.6);
  for (var i = 0u; i < ${P('EDITS')}; i = i + 1u) {
    let o = i * ${STRIDE}u;
    let prim = i32(${P('editData')}[o]);
    let op = i32(${P('editData')}[o + 1u]);
    let k = ${P('editData')}[o + 2u];
    let s = ${P('editData')}[o + 3u];
    let r0 = vec3f(${P('editData')}[o + 4u], ${P('editData')}[o + 5u], ${P('editData')}[o + 6u]);
    let r1 = vec3f(${P('editData')}[o + 7u], ${P('editData')}[o + 8u], ${P('editData')}[o + 9u]);
    let r2 = vec3f(${P('editData')}[o + 10u], ${P('editData')}[o + 11u], ${P('editData')}[o + 12u]);
    let t = vec3f(${P('editData')}[o + 13u], ${P('editData')}[o + 14u], ${P('editData')}[o + 15u]);
    let pr = vec3f(${P('editData')}[o + 16u], ${P('editData')}[o + 17u], ${P('editData')}[o + 18u]);
    let c = vec3f(${P('editData')}[o + 19u], ${P('editData')}[o + 20u], ${P('editData')}[o + 21u]);
    let rel = p - t;
    let local = vec3f(dot(r0, rel), dot(r1, rel), dot(r2, rel)) / s;
    let ed = ${P('editPrim')}(local, prim, pr) * s;
    if (i == 0u) {
      d = select(ed, -ed, op == 1 || op == 3);
      col = c;
    } else if (op == 0) {
      if (ed < d) { d = ed; col = c; }
    } else if (op == 2) {
      let h = clamp(0.5 + 0.5 * (ed - d) / k, 0.0, 1.0);
      d = mix(ed, d, h) - k * h * (1.0 - h);
      col = mix(c, col, h);
    } else if (op == 1) {
      d = max(d, -ed);
    } else if (op == 3) {
      let h = clamp(0.5 - 0.5 * (d + ed) / k, 0.0, 1.0);
      d = mix(d, -ed, h) + k * h * (1.0 - h);
    }
  }
  return vec4f(d, col);
}
`;
  return { wgsl, count: N, unsupported };
}
