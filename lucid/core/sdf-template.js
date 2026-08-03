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
