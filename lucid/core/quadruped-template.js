/**
 * The quadruped as a VM TEMPLATE — one description, two evaluations.
 *
 * The body-plan formulas below are written against a small ops adapter. Run
 * with the SYMBOLIC adapter they record an expression DAG that compiles to
 * VM bytecode (sdf-vm.js) — the GPU interprets it, so any parameter (species
 * dims, colours, `fed`) changes live with a buffer write, no codegen.
 * Run with the NUMERIC adapter the same formulas produce plain numbers, from
 * which a reference scene is built via the PROVEN orientedCapsule/flatten
 * path — tests require the two to agree, so the template cannot drift from
 * the pipeline the renderer already trusts.
 *
 * The `fed` parameter is the live-morph showcase: it grows a belly sphere,
 * thickens the torso and sags the stance — the "bear ate food" case.
 */

import { makeSym, compileTemplate, interpretEdits, EDIT_STRIDE } from './sdf-vm.js';
import { orientedCapsule } from './sdf-template.js';

// ---- adapters --------------------------------------------------------------
export function symbolicAdapter() {
  const S = makeSym();
  return {
    S,
    p: (name) => S.param(name),
    k: (v) => S.k(v),
    add: (a, b) => S.lift(a).add(b), sub: (a, b) => S.lift(a).sub(b),
    mul: (a, b) => S.lift(a).mul(b), div: (a, b) => S.lift(a).div(b),
    min: (a, b) => S.lift(a).min(b), max: (a, b) => S.lift(a).max(b),
    neg: (a) => S.lift(a).neg(), sqrt: (a) => S.lift(a).sqrt(),
    sel: (c, t, e) => S.sel(c, t, e)
  };
}
export function numericAdapter(params) {
  return {
    p: (name) => { if (!(name in params)) throw new Error('missing param ' + name); return params[name]; },
    k: (v) => v,
    add: (a, b) => a + b, sub: (a, b) => a - b,
    mul: (a, b) => a * b, div: (a, b) => a / b,
    min: Math.min, max: Math.max,
    neg: (a) => -a, sqrt: (a) => Math.sqrt(Math.max(a, 0)),
    sel: (c, t, e) => (c > 0 ? t : e)
  };
}

// ---- the body plan (adapter-generic) ----------------------------------------
// Returns parts: {kind:'capsule', A, B, r, color} | {kind:'sphere', C, r, color}
// A/B/C are 3-arrays of adapter scalars. All formulas mirror the proven
// puppet.html + poseQuadrupedFromRig mapping, made analytic (no physics settle).
export function buildQuadrupedParts(A) {
  const P = (n) => A.p(n);
  const mul = A.mul, add = A.add, sub = A.sub;

  const fed = P('fed');
  const bodyLen = mul(P('bodyLength'), 1.7);
  const standH = sub(add(0.55, P('legLength')), mul(0.06, fed));   // heavier → sags
  const spread = add(P('legSpreadX'), 0.06);
  const headSize = P('headSize');
  const neckLen = P('neckLength');
  const hz = mul(bodyLen, 0.5);

  const bodyR = mul(mul(P('bodyGirth'), 0.62), add(1, mul(0.18, fed)));
  const legR = P('legRadius');

  // joints (analytic rest pose; stand mode pinned nearly everything anyway)
  const shoulder = [A.k(0), standH, A.neg(hz)];
  const hip = [A.k(0), standH, hz];
  const head = [A.k(0), add(standH, mul(headSize, 0.7)), A.neg(add(hz, add(neckLen, mul(headSize, 0.4))))];
  const neck = [A.k(0), add(standH, mul(headSize, 0.5)), A.neg(add(hz, mul(neckLen, 0.55)))];
  const tailPt = [A.k(0), sub(standH, 0.2), add(hz, mul(A.max(0.4, P('tailLength')), 0.7))];

  const bodyCol = [P('bodyColR'), P('bodyColG'), P('bodyColB')];
  const legCol = [P('legColR'), P('legColG'), P('legColB')];
  const snoutCol = [P('snoutColR'), P('snoutColG'), P('snoutColB')];

  // head→snout forward direction (normalized head-neck)
  const fd = [sub(head[0], neck[0]), sub(head[1], neck[1]), sub(head[2], neck[2])];
  const fl = A.sqrt(add(add(mul(fd[0], fd[0]), mul(fd[1], fd[1])), add(mul(fd[2], fd[2]), 1e-9)));
  const fwd = [A.div(fd[0], fl), A.div(fd[1], fl), A.div(fd[2], fl)];

  const foot = (sx, sz) => [mul(spread, sx), A.k(0.15), mul(add(hz, -0.1), sz)];
  const legTop = (sx, sz) => [mul(mul(bodyR, 0.85), sx), sub(standH, mul(bodyR, 0.5)), mul(add(hz, -0.1), sz)];

  const snoutReach = add(headSize, P('snoutLength'));
  const snoutTip = [add(head[0], mul(fwd[0], snoutReach)), add(head[1], mul(fwd[1], snoutReach)), add(head[2], mul(fwd[2], snoutReach))];

  const earR = mul(P('earSize'), 0.7);
  const earUp = P('earUp');
  const ear = (sx) => [
    add(head[0], mul(add(mul(headSize, 0.55), mul(earR, sub(1, earUp))), sx)),
    add(head[1], mul(headSize, add(0.5, mul(0.5, earUp)))),
    sub(head[2], mul(mul(fwd[2], headSize), 0.2))
  ];

  // the belly — grows with fed, hides inside the torso when empty
  const belly = [A.k(0), sub(standH, mul(bodyR, add(0.15, mul(0.35, fed)))), A.k(0.15)];
  const bellyR = mul(bodyR, add(0.55, mul(0.75, fed)));

  return [
    { kind: 'capsule', A: shoulder, B: hip, r: bodyR, color: bodyCol },
    { kind: 'capsule', A: shoulder, B: head, r: mul(bodyR, 0.6), color: bodyCol },
    { kind: 'capsule', A: hip, B: tailPt, r: A.max(mul(legR, 0.5), P('tailRadius')), color: legCol },
    { kind: 'capsule', A: legTop(-1, -1), B: foot(-1, -1), r: legR, color: legCol },
    { kind: 'capsule', A: legTop(1, -1), B: foot(1, -1), r: legR, color: legCol },
    { kind: 'capsule', A: legTop(-1, 1), B: foot(-1, 1), r: legR, color: legCol },
    { kind: 'capsule', A: legTop(1, 1), B: foot(1, 1), r: legR, color: legCol },
    { kind: 'sphere', C: head, r: headSize, color: bodyCol },
    { kind: 'capsule', A: head, B: snoutTip, r: P('snoutRadius'), color: snoutCol },
    { kind: 'sphere', C: ear(-1), r: earR, color: bodyCol },
    { kind: 'sphere', C: ear(1), r: earR, color: bodyCol },
    { kind: 'sphere', C: belly, r: bellyR, color: bodyCol }
  ];
}

// ---- parts → 23 edit outputs (the packEditData layout, adapter-generic) ----
// Layout per edit: prim,op,k,s, R(9 rows, Rodrigues), t(3), pr(3), col(3), bound.
// The rotation math mirrors composeXf: axis = cross(Y, dir) normalized (with a
// predicated fallback), c = dir.y, s = sqrt(1-c²) — no trig, and s ≥ 0 matches
// acos-derived angles. World placement (wx,wy,wz + wscale) is parametric too.
const SMOOTH_K = 0.12;

export function partEditOutputs(A, part) {
  const mul = A.mul, add = A.add, sub = A.sub;
  const w = [A.p('wx'), A.p('wy'), A.p('wz')];
  const ws = A.p('wscale');
  const place = (pt) => [add(w[0], mul(pt[0], ws)), add(w[1], mul(pt[1], ws)), add(w[2], mul(pt[2], ws))];

  if (part.kind === 'sphere') {
    const t = place(part.C);
    return [
      A.k(0), A.k(2), A.k(SMOOTH_K), ws,
      A.k(1), A.k(0), A.k(0), A.k(0), A.k(1), A.k(0), A.k(0), A.k(0), A.k(1),
      t[0], t[1], t[2],
      part.r, A.k(0), A.k(0),
      part.color[0], part.color[1], part.color[2],
      mul(part.r, ws)
    ];
  }

  // capsule A→B
  const d = [sub(part.B[0], part.A[0]), sub(part.B[1], part.A[1]), sub(part.B[2], part.A[2])];
  const len = A.sqrt(add(add(mul(d[0], d[0]), mul(d[1], d[1])), add(mul(d[2], d[2]), 1e-12)));
  const dir = [A.div(d[0], len), A.div(d[1], len), A.div(d[2], len)];
  const mid = [mul(add(part.A[0], part.B[0]), 0.5), mul(add(part.A[1], part.B[1]), 0.5), mul(add(part.A[2], part.B[2]), 0.5)];

  // axis = normalize(cross([0,1,0], dir)) = normalize(dir.z, 0, -dir.x),
  // predicated to (1,0,0) when dir ∥ Y (al ~ 0); s=0 there so R degenerates
  // correctly (identity or the 180° flip), same as the acos/rodrigues path.
  const al = A.sqrt(add(mul(dir[2], dir[2]), mul(dir[0], dir[0])));
  const isDegenerate = sub(1e-5, al);                    // >0 when parallel to Y
  const ux = A.sel(isDegenerate, A.k(1), A.div(dir[2], A.max(al, 1e-12)));
  const uy = A.k(0);
  const uz = A.sel(isDegenerate, A.k(0), A.div(A.neg(dir[0]), A.max(al, 1e-12)));

  const c = dir[1];
  const s = A.sqrt(A.max(sub(1, mul(c, c)), 0));
  const tt = sub(1, c);

  // Rodrigues rows, row-major, exactly as composeXf writes R_node (uy = 0
  // simplifies the terms; kept literal for clarity).
  const r00 = add(mul(mul(tt, ux), ux), c);
  const r01 = sub(mul(mul(tt, ux), uy), mul(s, uz));
  const r02 = add(mul(mul(tt, ux), uz), mul(s, uy));
  const r10 = add(mul(mul(tt, ux), uy), mul(s, uz));
  const r11 = add(mul(mul(tt, uy), uy), c);
  const r12 = sub(mul(mul(tt, uy), uz), mul(s, ux));
  const r20 = sub(mul(mul(tt, ux), uz), mul(s, uy));
  const r21 = add(mul(mul(tt, uy), uz), mul(s, ux));
  const r22 = add(mul(mul(tt, uz), uz), c);

  const t = place(mid);
  const h = mul(len, 0.5);
  return [
    A.k(4), A.k(2), A.k(SMOOTH_K), ws,
    r00, r01, r02, r10, r11, r12, r20, r21, r22,
    t[0], t[1], t[2],
    h, part.r, A.k(0),
    part.color[0], part.color[1], part.color[2],
    mul(add(h, part.r), ws)
  ];
}

// ---- compile / evaluate ------------------------------------------------------

/** Compile the quadruped template to VM bytecode. */
export function buildQuadrupedProgram() {
  const A = symbolicAdapter();
  const parts = buildQuadrupedParts(A);
  const outputs = parts.map((part) => partEditOutputs(A, part).map((x) => A.S.lift(x)));
  return compileTemplate(A.S, outputs);
}

/** Reference edits via the INDEPENDENT proven path: numeric parts →
 *  orientedCapsule/spheres → a scene → flattenToEdits → packEditData. */
export async function referenceEditData(paramValues) {
  const { loadJsonScene } = await import('./json-loader.js');
  const { flattenToEdits, packEditData } = await import('./sdf-editlist.js');
  const scene = referenceScene(paramValues);
  const { edits } = flattenToEdits(loadJsonScene(scene));
  return Float32Array.from(packEditData(edits));
}

/** The same parts, numerically, as a normal Lucid scene (also the headless
 *  visual twin — renderable in Mayfly). */
export function referenceScene(paramValues) {
  const A = numericAdapter(paramValues);
  const parts = buildQuadrupedParts(A);
  const children = parts.map((p) => p.kind === 'sphere'
    ? { type: 'sphere', params: { r: p.r, color: p.color }, transform: { translate: p.C } }
    : orientedCapsule(p.A, p.B, p.r, p.color));
  return { name: 'vm-quadruped', root: { type: 'transform',
    transform: { translate: [paramValues.wx, paramValues.wy, paramValues.wz], scale: paramValues.wscale },
    child: { type: 'smoothUnion', k: SMOOTH_K, children } } };
}

/** Run the compiled program on the CPU twin → editData floats. */
export function templateEditData(prog, paramValues) {
  return interpretEdits(prog, paramValues);
}

// ---- the bear ---------------------------------------------------------------
export function bearParams(fed = 0) {
  return {
    fed,
    wx: 0, wy: 1.2, wz: 5, wscale: 1.6,
    bodyLength: 1.0, bodyGirth: 0.72, legLength: 0.55, legRadius: 0.17,
    legSpreadX: 0.42, neckLength: 0.22, headSize: 0.36,
    snoutLength: 0.22, snoutRadius: 0.17, earSize: 0.17, earUp: 0.75,
    tailLength: 0.12, tailRadius: 0.06,
    bodyColR: 0.45, bodyColG: 0.32, bodyColB: 0.22,
    legColR: 0.34, legColG: 0.24, legColB: 0.17,
    snoutColR: 0.72, snoutColG: 0.6, snoutColB: 0.48
  };
}
export { EDIT_STRIDE };
