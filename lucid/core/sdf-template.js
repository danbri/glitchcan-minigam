/**
 * SDF templates — a parameterized family as ONE function of a parameter vector.
 *
 * The edit list showed a scene is data. A template goes one step further: the
 * NUMBERS in that data come from a small parameter vector. So `pig`, `sheep`,
 * `cow`, `dog` are not four models — they are four POINTS in one quadruped
 * parameter space, and everything between them is a valid animal you reach by
 * lerping the vector. Animate the vector → morph; the clipclop bake re-does only
 * the dirty bricks.
 *
 * quadruped(params) returns a Lucid scene tree (a smoothUnion of transformed
 * primitives), so it plugs into EVERYTHING already built: Mayfly/Stinkyfish
 * render it, json-codegen compiles it, flattenToEdits turns it into the edit
 * buffer, and the clipclop splice bakes it. The template is the front of the
 * pipeline; the edit list is its runtime form.
 *
 * Convention: forward = −z, up = +y, right = +x. Ground at y = 0.
 */

// ---- default parameter vector -------------------------------------------
// All lengths are in a ~1-unit animal; a global `scale` sizes the whole thing.
export const QUADRUPED_DEFAULTS = {
  scale: 1,
  bodyLength: 1.0,   // half-length along z
  bodyGirth: 0.55,   // body radius (x/y)
  bodySag: 0.85,     // vertical squash of the body ellipsoid
  legLength: 0.9,
  legRadius: 0.13,
  legSpreadX: 0.42,  // half distance between L/R legs
  legSpreadZ: 0.62,  // half distance between front/back legs
  neckLength: 0.55,
  neckRadius: 0.17,
  neckAngle: 45,     // degrees, leaning forward+up
  headSize: 0.34,
  snoutLength: 0.26,
  snoutRadius: 0.15,
  earSize: 0.12,
  earUp: 0.7,        // 0 floppy/out, 1 upright
  tailLength: 0.5,
  tailRadius: 0.05,
  tailAngle: 30,     // degrees below horizontal at the base
  bodyColor: [0.72, 0.55, 0.42],
  legColor: [0.5, 0.38, 0.29],
  snoutColor: [0.4, 0.3, 0.26],
  smoothK: 0.14
};

// ---- named species = points in the parameter space ----------------------
export const QUADRUPED_PRESETS = {
  pig: {
    bodyLength: 0.95, bodyGirth: 0.62, bodySag: 0.82, legLength: 0.5, legRadius: 0.15,
    legSpreadX: 0.4, legSpreadZ: 0.55, neckLength: 0.28, neckRadius: 0.24, neckAngle: 30,
    headSize: 0.34, snoutLength: 0.2, snoutRadius: 0.19, earSize: 0.12, earUp: 0.55,
    tailLength: 0.28, tailRadius: 0.045, tailAngle: -10, smoothK: 0.18,
    bodyColor: [0.95, 0.66, 0.66], legColor: [0.86, 0.55, 0.55], snoutColor: [0.85, 0.5, 0.5]
  },
  sheep: {
    bodyLength: 0.95, bodyGirth: 0.66, bodySag: 0.95, legLength: 0.62, legRadius: 0.12,
    legSpreadX: 0.4, legSpreadZ: 0.55, neckLength: 0.34, neckRadius: 0.2, neckAngle: 42,
    headSize: 0.3, snoutLength: 0.18, snoutRadius: 0.12, earSize: 0.13, earUp: 0.25,
    tailLength: 0.2, tailRadius: 0.05, tailAngle: 40, smoothK: 0.22,
    bodyColor: [0.92, 0.9, 0.85], legColor: [0.3, 0.28, 0.26], snoutColor: [0.28, 0.26, 0.25]
  },
  cow: {
    bodyLength: 1.25, bodyGirth: 0.6, bodySag: 0.82, legLength: 1.0, legRadius: 0.14,
    legSpreadX: 0.46, legSpreadZ: 0.78, neckLength: 0.5, neckRadius: 0.22, neckAngle: 48,
    headSize: 0.34, snoutLength: 0.3, snoutRadius: 0.18, earSize: 0.14, earUp: 0.4,
    tailLength: 0.85, tailRadius: 0.045, tailAngle: 60, smoothK: 0.14,
    bodyColor: [0.55, 0.36, 0.24], legColor: [0.3, 0.2, 0.14], snoutColor: [0.75, 0.62, 0.58]
  },
  dog: {
    bodyLength: 0.95, bodyGirth: 0.42, bodySag: 0.8, legLength: 0.72, legRadius: 0.1,
    legSpreadX: 0.34, legSpreadZ: 0.62, neckLength: 0.46, neckRadius: 0.17, neckAngle: 52,
    headSize: 0.3, snoutLength: 0.3, snoutRadius: 0.12, earSize: 0.16, earUp: 0.85,
    tailLength: 0.6, tailRadius: 0.05, tailAngle: 35, smoothK: 0.12,
    bodyColor: [0.72, 0.52, 0.3], legColor: [0.6, 0.42, 0.24], snoutColor: [0.25, 0.2, 0.18]
  }
};

// ---- param helpers -------------------------------------------------------

const lerp = (a, b, t) => a + (b - a) * t;
function lerpVec(a, b, t) { return a.map((v, i) => lerp(v, b[i], t)); }

/** Resolve a preset name / partial object into a full parameter vector. */
export function resolveParams(p) {
  const base = { ...QUADRUPED_DEFAULTS };
  const over = typeof p === 'string' ? (QUADRUPED_PRESETS[p] || {}) : (p || {});
  return { ...base, ...over };
}

/** Blend two parameter vectors (names or objects). t in [0,1]. */
export function lerpQuadruped(a, b, t) {
  const A = resolveParams(a), B = resolveParams(b), out = {};
  for (const k of Object.keys(A)) {
    out[k] = Array.isArray(A[k]) ? lerpVec(A[k], B[k], t)
      : typeof A[k] === 'number' ? lerp(A[k], B[k], t) : A[k];
  }
  return out;
}

// ---- node builders (Lucid IR) -------------------------------------------

const sphere = (r, pos, color) => ({ type: 'sphere', params: { r, color }, transform: { translate: pos } });
const ellipsoid = (radii, pos, color, rotate) => ({ type: 'ellipsoid', params: { radii, color }, transform: rotate ? { translate: pos, rotate } : { translate: pos } });
const cylinder = (h, r, pos, color) => ({ type: 'cylinder', params: { h, r, color }, transform: { translate: pos } });
const capsule = (h, r, pos, color, rotate) => ({ type: 'capsule', params: { h, r, color }, transform: rotate ? { translate: pos, rotate } : { translate: pos } });

/**
 * Build a quadruped scene tree from a parameter vector (name or object).
 * @returns {{ name, root }} a Lucid scene ready for loadJsonScene.
 */
export function quadruped(p) {
  const q = resolveParams(p);
  const parts = [];

  const by = q.legLength + q.bodyGirth * 0.55;         // body centre height
  const bodyC = [0, by, 0];
  parts.push(ellipsoid([q.bodyGirth, q.bodyGirth * q.bodySag, q.bodyLength], bodyC, q.bodyColor));

  // four legs (vertical cylinders from the ground)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    parts.push(cylinder(q.legLength / 2, q.legRadius,
      [sx * q.legSpreadX, q.legLength / 2, sz * q.legSpreadZ], q.legColor));
  }

  // neck — a capsule leaning forward+up from the body front
  const frontZ = -q.bodyLength * 0.8;
  const neckBaseY = by + q.bodyGirth * 0.3;
  const na = q.neckAngle * Math.PI / 180;
  const neckMid = [0, neckBaseY + Math.sin(na) * q.neckLength * 0.5, frontZ - Math.cos(na) * q.neckLength * 0.5];
  parts.push(capsule(q.neckLength / 2, q.neckRadius, neckMid, q.bodyColor, [q.neckAngle, 0, 0]));

  // head at the end of the neck
  const headC = [0, neckBaseY + Math.sin(na) * q.neckLength, frontZ - Math.cos(na) * q.neckLength - q.headSize * 0.4];
  parts.push(sphere(q.headSize, headC, q.bodyColor));

  // snout forward of the head
  const snoutC = [headC[0], headC[1] - q.headSize * 0.2, headC[2] - q.headSize * 0.6 - q.snoutLength * 0.5];
  parts.push(ellipsoid([q.snoutRadius, q.snoutRadius * 0.85, q.snoutLength], snoutC, q.snoutColor));

  // two ears on top of the head
  const earAngle = lerp(70, 0, q.earUp);               // upright → out
  for (const sx of [-1, 1]) {
    parts.push(ellipsoid([q.earSize * 0.5, q.earSize, q.earSize * 0.35],
      [headC[0] + sx * q.headSize * 0.55, headC[1] + q.headSize * 0.6, headC[2] + q.headSize * 0.1],
      q.snoutColor, [0, 0, sx * earAngle]));
  }

  // tail off the back
  const backZ = q.bodyLength * 0.85;
  const ta = q.tailAngle * Math.PI / 180;
  const tailMid = [0, by + q.bodyGirth * 0.2 - Math.sin(ta) * q.tailLength * 0.5, backZ + Math.cos(ta) * q.tailLength * 0.5];
  parts.push(capsule(q.tailLength / 2, q.tailRadius, tailMid, q.legColor, [90 - q.tailAngle, 0, 0]));

  const body = { type: 'smoothUnion', k: q.smoothK, children: parts };
  const root = q.scale && q.scale !== 1
    ? { type: 'transform', transform: { scale: q.scale }, child: body }
    : body;
  return { name: 'quadruped', root };
}

// ---- driving the template geometry from a physics rig (item 2) -----------

/** A capsule oriented from A to B (Lucid capsule runs along +y → rotateAxis). */
export function orientedCapsule(A, B, r, color) {
  const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const len = Math.hypot(d[0], d[1], d[2]) || 1e-6;
  const dir = [d[0] / len, d[1] / len, d[2] / len];
  const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
  let axis = [dir[2], 0, -dir[0]];                 // cross([0,1,0], dir)
  const al = Math.hypot(axis[0], axis[1], axis[2]);
  if (al < 1e-5) axis = [1, 0, 0];                 // dir parallel to Y
  else axis = [axis[0] / al, axis[1] / al, axis[2] / al];
  const angle = Math.acos(Math.max(-1, Math.min(1, dir[1]))) * 180 / Math.PI;
  return { type: 'capsule', params: { h: len / 2, r, color },
    transform: { translate: mid, rotateAxis: { axis, angle } } };
}

// ---- uniform-driven posing (for smooth animation, no per-frame recompile) --
// The scene structure (N parts) is compiled ONCE with every value as a uniform;
// each frame only the uniform VALUES change (setParam), never the shader. Every
// part is a capsule — a sphere is a capsule with h = 0 — so one layout fits all.

/** Part descriptor from two joints (a capsule) — {t,axis,angle°,h,r,color}. */
function capPart(A, B, r, color) {
  const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const len = Math.hypot(d[0], d[1], d[2]) || 1e-6;
  const dir = [d[0] / len, d[1] / len, d[2] / len];
  let axis = [dir[2], 0, -dir[0]];
  const al = Math.hypot(axis[0], axis[1], axis[2]);
  axis = al < 1e-5 ? [1, 0, 0] : [axis[0] / al, axis[1] / al, axis[2] / al];
  return { t: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2],
    axis, angle: Math.acos(Math.max(-1, Math.min(1, dir[1]))) * 180 / Math.PI, h: len / 2, r, color };
}
const sphPart = (P, r, color) => ({ t: P.slice(), axis: [0, 1, 0], angle: 0, h: 0, r, color });

/** Compute the 13 quadruped part descriptors from a rig + species tint. */
export function quadrupedRigParts(rig, params = {}) {
  const q = resolveParams(params);
  const at = {}; rig.joints.forEach((n, i) => { at[n] = rig.bodies[i].p; });
  const bodyR = params.bodyR ?? 0.34, legR = params.legR ?? 0.13;
  const bc = q.bodyColor, lc = q.legColor, sc = q.snoutColor;
  const nd = [at.head[0] - at.neck[0], at.head[1] - at.neck[1], at.head[2] - at.neck[2]];
  const nl = Math.hypot(nd[0], nd[1], nd[2]) || 1e-6;
  const snoutC = [at.head[0] + nd[0] / nl * bodyR * 0.9, at.head[1] + nd[1] / nl * bodyR * 0.9, at.head[2] + nd[2] / nl * bodyR * 0.9];
  return [
    capPart(at.shoulder, at.hip, bodyR, bc),
    capPart(at.shoulder, at.neck, bodyR * 0.6, bc),
    capPart(at.hip, at.tail, legR * 0.7, lc),
    capPart(at.shoulder, at.footFL, legR, lc),
    capPart(at.shoulder, at.footFR, legR, lc),
    capPart(at.hip, at.footBL, legR, lc),
    capPart(at.hip, at.footBR, legR, lc),
    sphPart(at.head, bodyR * 0.9, bc),
    sphPart(snoutC, bodyR * 0.55, sc),
    ...['footFL', 'footFR', 'footBL', 'footBR'].map(fn => sphPart(at[fn], legR * 1.1, sc))
  ];
}

/** A scene of N capsule parts, every value a uniform. Compile ONCE.
 * Declares every var in `params` — Stinkyfish (WebGPU) builds a FIXED uniform
 * layout from scene.params at compile time, so an undeclared var stays 0 and the
 * scene renders black. (Mayfly creates uniforms on demand, hiding the bug.) */
export function partsUniformScene(n, k = 0.12) {
  const children = [];
  const params = {};
  const dcl = (name) => { params[name] = { type: 'scalar', value: 0 }; };
  for (let i = 0; i < n; i++) {
    for (const s of ['t' + i + 'x', 't' + i + 'y', 't' + i + 'z', 'a' + i + 'x', 'a' + i + 'y', 'a' + i + 'z',
      'ang' + i, 'h' + i, 'r' + i, 'c' + i + 'r', 'c' + i + 'g', 'c' + i + 'b']) dcl(s);
    children.push({ type: 'capsule',
      params: { h: { var: `h${i}` }, r: { var: `r${i}` }, color: [{ var: `c${i}r` }, { var: `c${i}g` }, { var: `c${i}b` }] },
      transform: { translate: [{ var: `t${i}x` }, { var: `t${i}y` }, { var: `t${i}z` }],
        rotateAxis: { axis: [{ var: `a${i}x` }, { var: `a${i}y` }, { var: `a${i}z` }], angle: { var: `ang${i}` } } } });
  }
  return { name: 'parts-uniform', params, root: { type: 'smoothUnion', k, children } };
}

/** Flatten part descriptors into a {uniformName: value} map for setParam. */
export function partsToUniforms(parts, extra = {}) {
  const u = { ...extra };
  parts.forEach((p, i) => {
    u[`t${i}x`] = p.t[0]; u[`t${i}y`] = p.t[1]; u[`t${i}z`] = p.t[2];
    u[`a${i}x`] = p.axis[0]; u[`a${i}y`] = p.axis[1]; u[`a${i}z`] = p.axis[2];
    u[`ang${i}`] = p.angle; u[`h${i}`] = p.h; u[`r${i}`] = p.r;
    u[`c${i}r`] = p.color[0]; u[`c${i}g`] = p.color[1]; u[`c${i}b`] = p.color[2];
  });
  return u;
}

/**
 * Build the full quadruped GEOMETRY from a physics rig's joint positions — a
 * torso, neck, four legs, a tail (oriented capsules) and a head (sphere). So
 * the ragdoll is not beads: it is the animal, and as physics moves the joints,
 * the limbs follow. `params` sets colours/thicknesses (a species tint).
 * @param {{bodies:Array, joints:string[]}} rig - from buildQuadrupedRig
 */
export function poseQuadrupedFromRig(rig, params = {}) {
  const q = resolveParams(params);
  const at = {};
  rig.joints.forEach((name, i) => { at[name] = rig.bodies[i].p; });
  // Part sizes come from the species dims (girth → torso radius, etc.) so pig,
  // sheep, cow and dog differ in shape, not only colour. Explicit bodyR/legR
  // still override (used by the neutral defaults).
  const bodyR = params.bodyR ?? (q.bodyGirth * 0.62);
  const legR = params.legR ?? q.legRadius;
  const headR = q.headSize;
  const bcol = q.bodyColor, lcol = q.legColor, scol = q.snoutColor;

  // Body height (spine) and the head→snout forward direction.
  const bodyY = (at.shoulder[1] + at.hip[1]) / 2;
  const fwd = (() => {
    const d = [at.head[0] - at.neck[0], at.head[1] - at.neck[1], at.head[2] - at.neck[2]];
    const l = Math.hypot(d[0], d[1], d[2]) || 1e-6;
    return [d[0] / l, d[1] / l, d[2] / l];
  })();

  // A leg drops from the body SIDE straight down to its pinned foot — the top
  // sits just inside the torso (so it fuses), the foot stays where physics
  // pinned it. This is what makes four planted legs instead of twigs splaying
  // from one hub.
  const leg = (foot) => {
    const top = [Math.sign(foot[0] || 1) * bodyR * 0.85, bodyY - bodyR * 0.5, foot[2]];
    return orientedCapsule(top, foot, legR, lcol);
  };

  const head = at.head;
  // snout: forward of the head, length/width from the species.
  const snoutTip = [head[0] + fwd[0] * (headR + q.snoutLength), head[1] + fwd[1] * (headR + q.snoutLength), head[2] + fwd[2] * (headR + q.snoutLength)];
  // ears: above the head; earUp lifts them (dog upright) vs sets them out (pig).
  const earR = q.earSize * 0.7;
  const ear = (sx) => ({ type: 'sphere', params: { r: earR, color: bcol },
    transform: { translate: [head[0] + sx * (headR * 0.55 + earR * (1 - q.earUp)), head[1] + headR * (0.5 + 0.5 * q.earUp), head[2] - fwd[2] * headR * 0.2] } });

  const parts = [
    orientedCapsule(at.shoulder, at.hip, bodyR, bcol),        // torso (girth = species)
    orientedCapsule(at.shoulder, head, bodyR * 0.6, bcol),    // neck: fuses body to head
    orientedCapsule(at.hip, at.tail, Math.max(legR * 0.5, q.tailRadius), lcol), // tail
    leg(at.footFL), leg(at.footFR), leg(at.footBL), leg(at.footBR),
    { type: 'sphere', params: { r: headR, color: bcol }, transform: { translate: head.slice() } }, // head
    orientedCapsule(head, snoutTip, q.snoutRadius, scol),     // snout (forward)
    ear(-1), ear(1),
    // four foot pads
    ...['footFL', 'footFR', 'footBL', 'footBR'].map(fn => ({ type: 'sphere', params: { r: legR * 1.05, color: scol }, transform: { translate: at[fn].slice() } }))
  ];
  return { name: 'quadruped-posed', root: { type: 'smoothUnion', k: 0.12, children: parts } };
}
