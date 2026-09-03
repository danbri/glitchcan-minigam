// scene-builder.js — procedural splat content for the demos: a stylised
// room "avatar" and a blendshape-driven head. Stands in for real scanned
// bundles (DESIGN.md §6 honesty box). Splat layout: see splat-renderer.js.
import { mulberry32, qMul, qRotVec, qConjugate, qFromEuler, clamp } from './pose-math.js';
import { FLOATS_PER_SPLAT } from './splat-renderer.js';
import { BLENDSHAPES } from './telemetry-codec.js';

const BI = {};
BLENDSHAPES.forEach((n, i) => { BI[n] = i; });

// quaternion rotating local +z onto unit vector n (for surface-tangent splats)
export function qFromZTo(n) {
  const w = 1 + n[2];
  if (w < 1e-6) return [1, 0, 0, 0];
  const l = Math.hypot(n[1], n[0], w);
  return [-n[1] / l, n[0] / l, 0, w / l];
}

export class SplatList {
  constructor() { this.arr = []; }
  // pos[3], scale[3], color[3], alpha, quat (optional)
  add(pos, scale, color, alpha = 1, quat = [0, 0, 0, 1]) {
    this.arr.push(pos[0], pos[1], pos[2], quat[0], quat[1], quat[2], quat[3],
      scale[0], scale[1], scale[2], color[0], color[1], color[2], alpha);
  }
  get count() { return this.arr.length / FLOATS_PER_SPLAT; }
  toFloat32() { return new Float32Array(this.arr); }
}

// ---------------------------------------------------------------- the room
// 8m × 6m, y-up, origin at floor centre. ~3k splats.
export function buildRoom(seed = 42) {
  const rnd = mulberry32(seed);
  const s = new SplatList();
  const jitter = (v, j) => v + (rnd() - 0.5) * j;

  // floor — warm wood, plank-ish hue banding
  for (let x = -4; x <= 4; x += 0.13) {
    for (let z = -3; z <= 3; z += 0.13) {
      const plank = Math.floor((x + 4) / 0.6) % 2 ? 0.03 : -0.02;
      const c = 0.42 + plank + (rnd() - 0.5) * 0.05;
      s.add([jitter(x, 0.06), 0, jitter(z, 0.06)], [0.08, 0.012, 0.08], [c, c * 0.72, c * 0.5], 1);
    }
  }
  // walls — plaster, slightly cool
  const wall = (px, pz, nx, nz, len) => {
    for (let u = -len; u <= len; u += 0.15) {
      for (let y = 0.08; y <= 2.8; y += 0.15) {
        const c = 0.62 + (rnd() - 0.5) * 0.04 + y * 0.02;
        const uj = jitter(u, 0.08);
        s.add([px + (nz !== 0 ? uj : 0), jitter(y, 0.08), pz + (nx !== 0 ? uj : 0)],
          [nz !== 0 ? 0.105 : 0.022, 0.105, nx !== 0 ? 0.105 : 0.022], [c * 0.93, c * 0.94, c], 1);
      }
    }
  };
  wall(0, -3, 0, 1, 4);    // back wall
  wall(-4, 0, 1, 0, 3);    // left wall
  wall(4, 0, -1, 0, 3);    // right wall

  // window on back wall — cool daylight glow
  for (let x = -1.1; x <= 1.1; x += 0.09) {
    for (let y = 1.2; y <= 2.3; y += 0.09) {
      s.add([jitter(x + 1.6, 0.04), jitter(y, 0.04), -2.93], [0.07, 0.07, 0.015], [0.75, 0.85, 1.0], 0.95);
    }
  }
  // rug
  for (let i = 0; i < 480; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    s.add([Math.cos(a) * r * 1.3, 0.03, Math.sin(a) * r * 0.9 + 0.4],
      [0.07, 0.014, 0.07], [0.55 + rnd() * 0.1, 0.2, 0.22], 1);
  }
  // table — top + 4 legs
  for (let x = -0.55; x <= 0.55; x += 0.065) {
    for (let z = -0.3; z <= 0.3; z += 0.065) {
      s.add([jitter(x - 1.8, 0.012), 0.74, jitter(z - 0.8, 0.012)], [0.048, 0.014, 0.048], [0.3, 0.2, 0.13], 1);
    }
  }
  for (const [lx, lz] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) {
    for (let y = 0.06; y < 0.72; y += 0.12) {
      s.add([lx - 1.8, y, lz - 0.8], [0.03, 0.08, 0.03], [0.25, 0.16, 0.1], 1);
    }
  }
  // plant — pot, stem, foliage
  for (let y = 0.05; y <= 0.3; y += 0.07) {
    for (let a = 0; a < Math.PI * 2; a += 0.7) {
      const r = 0.14 - y * 0.1;
      s.add([2.9 + Math.cos(a) * r, y, -2.2 + Math.sin(a) * r], [0.06, 0.05, 0.06], [0.5, 0.3, 0.2], 1);
    }
  }
  for (let y = 0.35; y <= 0.8; y += 0.09) s.add([2.9, y, -2.2], [0.02, 0.06, 0.02], [0.24, 0.34, 0.15], 1);
  for (let i = 0; i < 200; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 0.35, h = 0.7 + rnd() * 0.6;
    s.add([2.9 + Math.cos(a) * r, h, -2.2 + Math.sin(a) * r],
      [0.055, 0.04, 0.055], [0.15 + rnd() * 0.15, 0.4 + rnd() * 0.2, 0.14], 0.9);
  }
  // shelf with books on left wall
  for (let z = -1.6; z <= -0.2; z += 0.1) s.add([-3.9, 1.4, z], [0.03, 0.02, 0.08], [0.32, 0.22, 0.14], 1);
  for (let z = -1.55; z <= -0.25; z += 0.09) {
    s.add([-3.86, 1.53, z], [0.02, 0.1, 0.035], [0.3 + rnd() * 0.5, 0.25 + rnd() * 0.4, 0.3 + rnd() * 0.4], 1);
  }
  // ceiling — closes the void seen from low angles
  for (let x = -4; x <= 4; x += 0.2) {
    for (let z = -3; z <= 3; z += 0.2) {
      const c = 0.5 + (rnd() - 0.5) * 0.03;
      s.add([jitter(x, 0.08), 2.86, jitter(z, 0.08)], [0.13, 0.02, 0.13], [c, c, c * 1.04], 1);
    }
  }
  // two warm ceiling light glows
  for (const lx of [-1.5, 1.5]) {
    for (let i = 0; i < 24; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 0.18;
      s.add([lx + Math.cos(a) * r, 2.75 + (rnd() - 0.5) * 0.06, Math.sin(a) * r],
        [0.13, 0.1, 0.13], [1.0, 0.93, 0.78], 0.5);
    }
  }
  return s;
}

// -------------------------------------------------------------- the avatar
// Head-local template, origin at neck base, facing +z (toward camera at
// default view). Rebuilt from the pose every frame — ~400 splats, trivial.
//
// Realism levers (a real scanned splat gets these for free, we bake them):
// per-splat directional shading recomputed against the ROTATED head each
// frame, a shaped skull (jaw taper, flat face, occipital bulge), hair as
// directional strands, eye highlights, and a structured torso.
const SKIN = [0.85, 0.64, 0.52];
const HAIR = [0.23, 0.16, 0.11];
const SHIRT = [0.24, 0.33, 0.45];
const LIGHT = normalize([0.3, 0.75, 0.6]);   // world light, roughly camera-side + above

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
// quaternion for an orthonormal basis (columns x, y, z)
function basisToQuat(x, y, z) {
  const m00 = x[0], m01 = y[0], m02 = z[0], m10 = x[1], m11 = y[1], m12 = z[1],
    m20 = x[2], m21 = y[2], m22 = z[2];
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const sq = Math.sqrt(tr + 1) * 2;
    return [(m21 - m12) / sq, (m02 - m20) / sq, (m10 - m01) / sq, 0.25 * sq];
  } else if (m00 > m11 && m00 > m22) {
    const sq = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return [0.25 * sq, (m01 + m10) / sq, (m02 + m20) / sq, (m21 - m12) / sq];
  } else if (m11 > m22) {
    const sq = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return [(m01 + m10) / sq, 0.25 * sq, (m12 + m21) / sq, (m02 - m20) / sq];
  }
  const sq = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return [(m02 + m20) / sq, (m12 + m21) / sq, 0.25 * sq, (m10 - m01) / sq];
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Appearance presets for the procedural avatar. hairLine is the ny
// threshold where hair starts (higher = receding; >0.85 ≈ bald).
// Beyond colours, presets carry real geometry: headW/headH (skull
// proportions), jawTaper (lower = squarer jaw), puff (hair volume), eyeX
// (eye spacing), eyeSize, browTh, nose, mouth, ear, build (torso), and
// features: beard, moustache, glasses. Splat count varies per preset —
// consumers must rebuild buffers on switch.
export const AVATAR_PRESETS = [
  { id: 'hazel', name: 'Hazel', skin: [0.85, 0.64, 0.52], hair: [0.23, 0.16, 0.11], shirt: [0.24, 0.33, 0.45], hairLine: 0.40, hairStyle: 'crop' },
  { id: 'kofi', name: 'Kofi', skin: [0.45, 0.30, 0.22], hair: [0.09, 0.07, 0.06], shirt: [0.72, 0.55, 0.20], hairLine: 0.52, hairStyle: 'wild',
    headW: 1.08, jawTaper: 0.30, nose: 1.2, mouth: 1.1, beard: true, build: 1.12, puff: 1.0 },
  { id: 'saoirse', name: 'Saoirse', skin: [0.93, 0.76, 0.66], hair: [0.65, 0.35, 0.16], shirt: [0.25, 0.45, 0.30], hairLine: 0.34, hairStyle: 'bob',
    headW: 0.92, headH: 1.04, jawTaper: 0.52, nose: 0.78, mouth: 0.88, browTh: 0.65, puff: 1.16, build: 0.88 },
  { id: 'nadia', name: 'Nadia', skin: [0.72, 0.52, 0.40], hair: [0.12, 0.10, 0.09], shirt: [0.50, 0.20, 0.25], hairLine: 0.38, hairStyle: 'bob',
    glasses: true, eyeSize: 1.15, eyeX: 0.045, nose: 0.9, puff: 1.1, build: 0.94 },
  { id: 'silas', name: 'Silas', skin: [0.55, 0.38, 0.30], hair: [0.60, 0.60, 0.62], shirt: [0.18, 0.42, 0.42], hairLine: 0.60, hairStyle: 'side',
    moustache: true, ear: 1.3, browTh: 1.45, nose: 1.12, jawTaper: 0.46, build: 0.92 },
  { id: 'bjorn', name: 'Björn', skin: [0.90, 0.72, 0.60], hair: [0.78, 0.68, 0.45], shirt: [0.40, 0.30, 0.55], hairLine: 0.88,
    headW: 1.07, jawTaper: 0.28, nose: 1.15, beard: true, browTh: 1.2, build: 1.18 },
  // different visual FORMS — same telemetry, different dialects
  { id: 'vex', name: 'Vector', form: 'phosphor', unlit: true, hairLine: 0.4,
    skin: [0.35, 1.0, 0.5], hair: [0.2, 0.9, 0.4], shirt: [0.06, 0.3, 0.16] },
  { id: 'blok', name: 'Blok', form: 'voxel', hairLine: 0.4,
    skin: [0.85, 0.6, 0.42], hair: [0.32, 0.2, 0.5], shirt: [0.9, 0.5, 0.15] },
  { id: 'papier', name: 'Papier', form: 'cutout', unlit: true, hairLine: 0.4,
    skin: [0.98, 0.8, 0.64], hair: [0.16, 0.16, 0.22], shirt: [0.93, 0.32, 0.25] },
  { id: 'volt', name: 'Volt', form: 'bot', hairLine: 1,
    skin: [0.6, 0.63, 0.68], hair: [0.3, 0.32, 0.36], shirt: [0.2, 0.22, 0.28] },
];

export function avatarSplatCount() { return buildAvatarSplats(null).count; }

// pose: decoded telemetry pose, or null for rest. Returns a SplatList in
// WORLD space (head rotated by pose.quat around the neck, then translated
// so the neck sits at pose.pos + at).
export function buildAvatarSplats(pose, at = [0, 0, 0], appearance = null, anim = {}) {
  const A = appearance || AVATAR_PRESETS[0];
  // shadow the module colour constants with this avatar's appearance
  const SKIN = A.skin, HAIR = A.hair, SHIRT = A.shirt;
  const F = { headW: 1, headH: 1, jawTaper: 0.42, puff: 1.05, eyeX: 0.042, eyeSize: 1,
    browTh: 1, nose: 1, mouth: 1, ear: 1, build: 1, ...A };
  const s = new SplatList();
  const b = pose ? pose.blend : new Float32Array(10);
  const q = pose ? pose.quat : [0, 0, 0, 1];
  const base = pose ? [at[0] + pose.pos[0], at[1] + (pose.pos[1] - 1.45), at[2] + pose.pos[2]] : at;
  // the light in head-local space, so baked shading tracks head rotation
  const lightL = qRotVec(qConjugate(q), LIGHT);
  const lambert = (n) => 0.5 + 0.55 * Math.max(0, dot(n, lightL));

  const jaw = b[BI.jawOpen], blinkL = b[BI.eyeBlinkLeft], blinkR = b[BI.eyeBlinkRight];
  const brow = b[BI.browInnerUp], smL = b[BI.mouthSmileLeft], smR = b[BI.mouthSmileRight];
  const pucker = b[BI.mouthPucker], lookX = b[BI.eyeLookX], lookY = b[BI.eyeLookY];
  // DERIVED palette — lips, brows, lids, shadows are computed from the
  // preset's skin + hair so every preset stays colour-harmonised
  const LIP = [SKIN[0] * 0.88 + 0.05, SKIN[1] * 0.62, SKIN[2] * 0.6];
  const LIPD = [LIP[0] * 0.55, LIP[1] * 0.45, LIP[2] * 0.45];
  const BROWC = [HAIR[0] * 0.85, HAIR[1] * 0.85, HAIR[2] * 0.85];
  const SHAD = [SKIN[0] * 0.62, SKIN[1] * 0.52, SKIN[2] * 0.48];
  // EXPRESSION CHORDS — single channels expand into correlated motion,
  // so a smile lifts the cheeks and narrows the eyes instead of only
  // bending the mouth (the "big false smile" fix)
  const smile = (smL + smR) / 2;
  // debug density factor: more/fewer samples, sizes scaled to keep coverage
  const DEN = clamp(anim.density || 1, 0.3, 2.5);
  const DSZ = 1 / Math.sqrt(DEN);
  const cheekLift = smile * 0.7;
  const eyeNarrow = smile * 0.30;
  const eyeWiden = brow * 0.25;

  // head-local splats collected first, then rotated. anim.noHead skips the
  // whole procedural head (a scan head replaces it — lib/scan-head.js).
  const local = [];
  const rnd = mulberry32(7);
  if (!anim.noHead) {
  const addL = (pos, scale, color, alpha = 1, quat = [0, 0, 0, 1]) =>
    local.push([pos, scale, color, alpha, quat]);
  // VISUAL FORMS — same telemetry, different visual language. 'painterly'
  // is the soft humanoid; the others are deliberately different dialects.
  const FORM = A.form || 'painterly';
  const smile2 = (smL + smR) / 2;
  if (FORM === 'phosphor') {
    // CRT vector wireframe (the trees/ phosphor heritage): dark occluder
    // core + glowing latitude/meridian strokes + luminous features
    const G = SKIN;
    for (let i = 0; i < 46; i++) {   // dark core (hidden-line occlusion)
      const th = Math.acos(1 - 2 * (i + 0.5) / 46), ph2 = i * 2.4;
      addL([Math.sin(th) * Math.cos(ph2) * 0.078, 0.13 + Math.cos(th) * 0.098, Math.sin(th) * Math.sin(ph2) * 0.083],
        [0.05, 0.05, 0.05], [0.01, 0.035, 0.02], 0.92);
    }
    for (let li = 0; li < 7; li++) {   // latitude rings
      const ny = -0.78 + li * 0.26, r = Math.sqrt(Math.max(0.02, 1 - ny * ny));
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * Math.PI * 2;
        const n = normalize([Math.cos(a) * r, ny, Math.sin(a) * r]);
        const tg = [-Math.sin(a), 0, Math.cos(a)];
        addL([Math.cos(a) * r * 0.095, 0.13 + ny * 0.115, Math.sin(a) * r * 0.1],
          [0.015, 0.0022, 0.0022], G, 0.85, basisToQuat(tg, cross(n, tg), n));
      }
    }
    for (let m = 0; m < 4; m++) {   // meridian arcs
      const az = (m / 4) * Math.PI;
      for (let k = 0; k < 18; k++) {
        const th = -1.25 + (2.5 * k) / 17;
        const r = Math.cos(th), ny = Math.sin(th);
        addL([Math.cos(az) * r * 0.095, 0.13 + ny * 0.115, Math.sin(az) * r * 0.1],
          [0.0022, 0.013, 0.0022], G, 0.7);
      }
    }
    for (const [sx, blink] of [[-1, blinkL], [1, blinkR]]) {   // eyes
      const open = clamp(1 - blink, 0.06, 1);
      addL([sx * 0.042 + lookX * 0.008, 0.155 + lookY * 0.006, 0.096],
        [0.008, 0.008 * open, 0.005], [0.85, 1, 0.9], 1);
      addL([sx * 0.042, 0.155, 0.09], [0.016, 0.014 * open, 0.008], G, 0.3);
    }
    for (const sx of [-1, 1]) {   // brows
      addL([sx * 0.045, 0.185 + brow * 0.014, 0.093], [0.02, 0.0022, 0.003], G, 0.9,
        qFromEuler(0, 0, sx * (-0.2 - brow * 0.15)));
    }
    // mouth: two glowing lines that separate with the jaw
    const g2 = 0.002 + jaw * 0.02;
    addL([0, 0.068 + g2, 0.096], [0.026 + smile2 * 0.008, 0.0022, 0.003], G, 0.95);
    addL([0, 0.068 - g2, 0.096], [0.024 + smile2 * 0.006, 0.0022, 0.003], G, 0.95);
  } else if (FORM === 'voxel') {
    // chunky blocks on a grid, two-tone shaded, features as block swaps
    const cell = 0.023;
    for (let xi = -4; xi <= 4; xi++) for (let yi = -5; yi <= 5; yi++) for (let zi = -4; zi <= 4; zi++) {
      const px = xi * cell, py = yi * cell, pz = zi * cell;
      const rr = (px / 0.095) ** 2 + (py / 0.118) ** 2 + (pz / 0.1) ** 2;
      if (rr > 1 || rr < 0.5) continue;
      const ny = py / 0.118, nzn = pz / 0.1;
      const isHair = (ny > A.hairLine && !(nzn > 0.3 && ny < A.hairLine + 0.25));
      const c = isHair ? HAIR : SKIN;
      const shade = 1 + (((xi + yi + zi) % 2) ? -0.07 : 0.05) + ny * 0.06;
      addL([px, 0.13 + py, pz], [cell * 0.52, cell * 0.52, cell * 0.52],
        [c[0] * shade, c[1] * shade, c[2] * shade], 1);
    }
    for (const [sx, blink] of [[-1, blinkL], [1, blinkR]]) {
      const open = clamp(1 - blink, 0.1, 1);
      addL([sx * 2 * cell, 0.13 + cell, 0.093], [cell * 0.55, cell * 0.55 * open, cell * 0.4], [0.08, 0.08, 0.1], 1);
    }
    for (const sx of [-1, 1]) {
      addL([sx * 2 * cell, 0.13 + (2.1 + brow) * cell, 0.093], [cell * 0.6, cell * 0.28, cell * 0.4], HAIR, 1);
    }
    addL([0, 0.13 - cell, 0.098], [cell * 0.4, cell * 0.4, cell * 0.4], [SKIN[0] * 0.8, SKIN[1] * 0.7, SKIN[2] * 0.65], 1);
    // mouth rows: lower row fades in as the jaw opens
    addL([0, 0.13 - 2.6 * cell, 0.095], [cell * (0.9 + smile2 * 0.5), cell * 0.3, cell * 0.4], [0.45, 0.15, 0.15], 1);
    addL([0, 0.13 - (3.1 + jaw * 1.6) * cell, 0.095], [cell * 0.9, cell * (0.3 + jaw * 0.8), cell * 0.4], [0.3, 0.1, 0.1], clamp(jaw * 2.5, 0, 1));
  } else if (FORM === 'cutout') {
    // flat paper puppet: a few big bold unlit shapes
    addL([0, 0.125, 0.02], [0.088, 0.11, 0.004], SKIN, 1);
    addL([0, 0.185, 0.005], [0.098, 0.07, 0.004], HAIR, 1);
    addL([0, 0.215, 0.026], [0.082, 0.022, 0.004], HAIR, 1);   // fringe
    for (const sx of [-1, 1]) addL([sx * 0.088, 0.12, 0.008], [0.018, 0.028, 0.004], SKIN, 1);  // ears
    for (const [sx, blink] of [[-1, blinkL], [1, blinkR]]) {
      const open = clamp(1 - blink, 0.08, 1);
      addL([sx * 0.04, 0.15, 0.028], [0.02, 0.016 * open, 0.004], [1, 1, 1], 1);
      addL([sx * 0.04 + lookX * 0.009, 0.15 + lookY * 0.006, 0.032], [0.008, 0.01 * open, 0.004], [0.1, 0.1, 0.12], 1);
      addL([sx * 0.04, 0.178 + brow * 0.014, 0.03], [0.024, 0.006, 0.004], HAIR, 1,
        qFromEuler(0, 0, sx * -0.2));
    }
    addL([0.008, 0.125, 0.03], [0.007, 0.02, 0.004], [SKIN[0] * 0.82, SKIN[1] * 0.75, SKIN[2] * 0.7], 1);  // nose
    for (const sx of [-1, 1]) addL([sx * 0.055, 0.105, 0.028], [0.013, 0.009, 0.004], [1, 0.55, 0.5], 0.8); // blush
    addL([0, 0.075 - jaw * 0.012, 0.03], [0.022 + smile2 * 0.01, 0.005 + jaw * 0.028, 0.004], [0.75, 0.2, 0.2], 1);
  } else if (FORM === 'bot') {
    // sleek robot: metal shell, glowing visor eyes, dot-matrix mouth
    const GA2 = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < 320; i++) {
      const ny = 1 - 2 * (i + 0.5) / 320;
      const rr = Math.sqrt(Math.max(0, 1 - ny * ny)), ph2 = i * GA2;
      const n = [Math.cos(ph2) * rr, ny, Math.sin(ph2) * rr];
      const sh = 0.45 + 0.6 * Math.max(0, dot(n, lightL));
      addL([n[0] * 0.088, 0.13 + ny * 0.105, n[2] * 0.092],
        [0.016, 0.016, 0.006], [SKIN[0] * sh, SKIN[1] * sh, SKIN[2] * sh * 1.05], 1, qFromZTo(n));
    }
    addL([0, 0.155, 0.085], [0.078, 0.024, 0.008], [0.04, 0.05, 0.07], 1);   // visor band
    for (const [sx, blink] of [[-1, blinkL], [1, blinkR]]) {
      const open = clamp(1 - blink, 0.05, 1);
      addL([sx * 0.038 + lookX * 0.008, 0.155 + lookY * 0.005, 0.093],
        [0.017 + brow * 0.004, 0.006 * open, 0.004], [0.25, 0.85, 1], 1);
    }
    for (let d2 = -3; d2 <= 3; d2++) {   // dot-matrix mouth, lit by the jaw
      const lit = clamp(0.18 + jaw * 1.2 - Math.abs(d2) * 0.08, 0.05, 1);
      addL([d2 * 0.0105, 0.07 + smile2 * (0.5 - Math.abs(d2) / 6) * 0.02, 0.09],
        [0.0042, 0.0042 + jaw * 0.006, 0.003], [0.25 * lit, 0.85 * lit, 1 * lit], 1);
    }
    for (let k = 0; k < 4; k++) addL([0, 0.245 + k * 0.012, 0], [0.0035, 0.008, 0.0035], [0.35, 0.37, 0.42], 1);
    addL([0, 0.3, 0], [0.009, 0.009, 0.009], [1, 0.35, 0.3], 0.9);           // antenna beacon
  } else {
  // hairstyle parameters (len/wid = strand shape, jit = direction chaos,
  // side = comb bias, curtain = hanging bob edge)
  const HSY = {
    crop: { len: 0.014, wid: 0.005, jit: 0.1 },
    side: { len: 0.018, wid: 0.0046, jit: 0.12, side: 0.8 },
    bob: { len: 0.026, wid: 0.0053, jit: 0.16, curtain: true },
    wild: { len: 0.011, wid: 0.0068, jit: 0.9 },
  }[A.hairStyle || 'crop'];
  // skull — fibonacci-sampled shell, splats TANGENT to the surface (thin
  // along the normal), shaped: jaw tapers, back bulges
  const RX = 0.092 * F.headW, RY = 0.115 * F.headH, RZ = 0.10, CY = 0.13;
  const N_SKULL = Math.round(2700 * DEN), GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N_SKULL; i++) {
    const ny = 1 - 2 * (i + 0.5) / N_SKULL;
    const rr = Math.sqrt(Math.max(0, 1 - ny * ny));
    const ph = i * GA;
    const nx = Math.cos(ph) * rr, nz = Math.sin(ph) * rr;
    const n = [nx, ny, nz];
    const taper = 1 - Math.max(0, -ny - 0.15) * F.jawTaper;  // narrows toward the chin
    const backB = 1 + Math.max(0, -nz) * 0.10;          // occipital bulge
    const faceF = nz > 0 ? 0.94 : 1.0;                  // flatter face plane
    // hairline: full top and back; forehead and face stay skin
    const isHair = (ny > A.hairLine && !(nz > 0.32 && ny < A.hairLine + 0.2)) || (A.hairLine < 0.8 && nz < -0.28 && ny > -0.3);
    const sh = lambert(n);
    const tone = (rnd() - 0.5) * 0.05;
    const pos = [nx * RX * taper * (isHair ? F.puff : 1), CY + ny * RY * (isHair ? F.puff * 0.99 : 1),
      nz * RZ * backB * faceF * (isHair ? F.puff : 1)];
    if (isHair) {
      // strand: elongated along the surface's downhill direction, shaped
      // by the preset's hairStyle (crop / side / bob / wild)
      let t = [0 - n[0] * -n[1], -1 - n[1] * -n[1], 0 - n[2] * -n[1]];   // d − n(d·n), d = down
      const tl = Math.hypot(t[0], t[1], t[2]);
      t = tl > 0.15 ? [t[0] / tl, t[1] / tl, t[2] / tl]
        : normalize([Math.cos(ph + 1.57), 0, Math.sin(ph + 1.57)]);
      if (HSY.side) t = normalize([t[0] + HSY.side, t[1] * 0.5, t[2]]);
      let bt = cross(n, t);
      if (HSY.jit) {
        const th = (rnd() - 0.5) * 2 * HSY.jit;
        const ct = Math.cos(th), st = Math.sin(th);
        t = normalize([t[0] * ct + bt[0] * st, t[1] * ct + bt[1] * st, t[2] * ct + bt[2] * st]);
        bt = cross(n, t);
      }
      const gl = 0.8 + rnd() * 0.45;                    // per-strand sheen variation
      // bobs keep the fringe short so it doesn't drape over the eyes
      const sLen = (HSY.curtain && nz > 0.05) ? HSY.len * 0.5 : HSY.len;
      addL(pos, [sLen * DSZ, HSY.wid * DSZ, 0.0045],
        [HAIR[0] * sh * gl, HAIR[1] * sh * gl, HAIR[2] * sh * gl], 1, basisToQuat(t, bt, n));
    } else {
      // cheeks: blush + the smile chord (lift + out) and jaw stretch
      const isCheek = Math.abs(nx) > 0.4 && ny < 0.05 && ny > -0.45 && nz > 0.25;
      let blush = 0;
      if (isCheek) {
        blush = 0.05 + cheekLift * 0.03;
        pos[1] += cheekLift * 0.007 - jaw * 0.004;
        pos[0] += Math.sign(nx) * cheekLift * 0.0025;
      }
      addL(pos, [0.0071 * DSZ, 0.0071 * DSZ, 0.0028],
        [(SKIN[0] + tone + blush) * sh, (SKIN[1] + tone * 0.8) * sh, (SKIN[2] + tone * 0.7) * sh],
        1, qFromZTo(n));
    }
  }
  // hairstyle: bob adds a hanging curtain around the back and sides
  if (HSY.curtain && A.hairLine < 0.8) {
    for (let i = 0; i < 36; i++) {
      const u = 1.9 + (2 * Math.PI - 3.8) * (i / 35);   // back + sides only
      const dxs = Math.sin(u), dzs = Math.cos(u);
      const gl = 0.75 + rnd() * 0.45;
      addL([dxs * RX * F.puff * 1.03, CY - 0.045 - rnd() * 0.02, dzs * RZ * F.puff * 1.05],
        [0.006, 0.028, 0.005], [HAIR[0] * gl, HAIR[1] * gl, HAIR[2] * gl], 0.95);
    }
  }
  // neck (shaded cylinder)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const n = [Math.cos(a), 0.1, Math.sin(a)];
    const sh = lambert(normalize(n));
    addL([Math.cos(a) * 0.032, 0.02 + (i % 2) * 0.025, Math.sin(a) * 0.032 + 0.005],
      [0.02, 0.025, 0.02], [SKIN[0] * sh, SKIN[1] * sh, SKIN[2] * sh]);
  }
  // ears
  for (const sx of [-1, 1]) {
    const sh = lambert([sx, 0, 0]);
    addL([sx * 0.096 * F.headW, CY, -0.005], [0.013 * F.ear, 0.023 * F.ear, 0.011],
      [SKIN[0] * sh, SKIN[1] * sh, SKIN[2] * sh]);
  }
  // eyes: white + iris + pupil + a specular highlight (the highlight is
  // what makes an eye read as wet rather than painted-on)
  for (const [sx, blink] of [[-1, blinkL], [1, blinkR]]) {
    // chords: smiles narrow the eyes, raised brows widen them
    const open = clamp((1 - blink) * (1 - eyeNarrow) * (1 + eyeWiden), 0.08, 1.15);
    const ex = sx * F.eyeX, ey = CY + 0.025 + ((anim.rig && anim.rig.eyes) || 0);
    addL([ex, ey, 0.092], [0.019 * F.eyeSize, 0.014 * open * F.eyeSize, 0.011], [0.9, 0.89, 0.87]);
    addL([ex + lookX * 0.009, ey + lookY * 0.007, 0.098],
      [0.0095 * F.eyeSize, 0.0105 * open * F.eyeSize, 0.008], [0.32, 0.2, 0.11]);   // iris
    addL([ex + lookX * 0.009, ey + lookY * 0.007, 0.101],
      [0.0045 * F.eyeSize, 0.005 * open * F.eyeSize, 0.005], [0.05, 0.04, 0.04]);   // pupil
    addL([ex + lookX * 0.009 + 0.004, ey + lookY * 0.007 + 0.004, 0.106],
      [0.0022, 0.0022 * open, 0.002], [1, 1, 1], 0.9);              // highlight
    // upper eyelid — a skin shelf that actually descends over the eye
    const lidDrop = blink * 0.017;
    addL([ex, ey + 0.015 - lidDrop, 0.097],
      [0.02 * F.eyeSize, 0.006 + blink * 0.007, 0.009],
      [SKIN[0] * 0.93, SKIN[1] * 0.88, SKIN[2] * 0.85], 0.98);
    // lid crease + lower lid line
    addL([ex, ey + 0.018, 0.092], [0.019, 0.0028, 0.005],
      [SHAD[0], SHAD[1], SHAD[2]], 0.6);
    addL([ex, ey - 0.013, 0.094], [0.016 * F.eyeSize, 0.0022, 0.005],
      [SHAD[0] * 1.15, SHAD[1] * 1.15, SHAD[2] * 1.15], 0.55);
  }
  // brows: whole brow rises with the chord (inner more than outer), and
  // arches slightly when raised
  for (const sx of [-1, 1]) {
    addL([sx * (F.eyeX + 0.003), CY + 0.055 + brow * 0.014, 0.085],
      [0.025 * (0.85 + 0.25 * F.browTh), 0.0055 * F.browTh, 0.01],
      BROWC, 1, qFromEuler(0, 0, sx * (-0.18 - brow * 0.12)));
    addL([sx * (F.eyeX + 0.019), CY + 0.051 + brow * 0.009, 0.08],
      [0.009, 0.0045 * F.browTh, 0.008], BROWC, 0.95, qFromEuler(0, 0, sx * -0.42));
  }
  // nose: lit bridge, warm tip, side + under shadows so it reads in 3D
  const NZ = 0.103 + (F.nose - 1) * 0.008;
  addL([0, CY + 0.002, NZ], [0.009 * F.nose, 0.02 * F.nose, 0.009],
    [SKIN[0] * 1.12, SKIN[1] * 1.05, SKIN[2] * 1.0]);
  addL([0, CY - 0.02, NZ + 0.005], [0.013 * F.nose, 0.01 * F.nose, 0.01],
    [SKIN[0] * 1.02, SKIN[1] * 0.9, SKIN[2] * 0.86]);
  for (const sx of [-1, 1]) {
    addL([sx * 0.014 * F.nose, CY - 0.018, NZ - 0.004], [0.006, 0.011, 0.006],
      [SKIN[0] * 0.72, SKIN[1] * 0.62, SKIN[2] * 0.56], 0.75);
  }
  addL([0, CY - 0.031, NZ - 0.004], [0.01 * F.nose, 0.0035, 0.005],
    [SKIN[0] * 0.6, SKIN[1] * 0.5, SKIN[2] * 0.46], 0.7);
  for (const sx of [-1, 1]) {   // nostrils
    addL([sx * 0.0068 * F.nose, CY - 0.029, NZ - 0.002], [0.0028, 0.002, 0.003],
      [SHAD[0] * 0.6, SHAD[1] * 0.6, SHAD[2] * 0.6], 0.85);
  }
  // philtrum groove
  addL([0, CY - 0.045, 0.0915], [0.0022, 0.007, 0.004], SHAD, 0.4);
  // mouth: dark opening scaled by jaw; muted lips; smile corners lift
  // (anim.rig.mouth/eyes are debug repositioning offsets)
  const RIGO = anim.rig || {};
  const mouthY = CY - 0.062 - jaw * 0.02 + (RIGO.mouth || 0);
  const mouthW = clamp(0.026 * F.mouth - pucker * 0.011 + (smL + smR) * 0.005, 0.012, 0.042);
  addL([0, mouthY, 0.088], [mouthW, 0.004 + jaw * 0.026, 0.012], LIPD);
  addL([0, mouthY + 0.009 + jaw * 0.012, 0.089], [mouthW * 0.96, 0.0035, 0.01], LIP);
  for (const sx of [-1, 1]) {   // cupid's bow peaks
    addL([sx * mouthW * 0.35, mouthY + 0.0115 + jaw * 0.012, 0.0895],
      [0.005, 0.0028, 0.008], [LIP[0] * 1.08, LIP[1] * 1.08, LIP[2] * 1.08]);
  }
  addL([0, mouthY - 0.007 - jaw * 0.012, 0.089], [mouthW * 0.82, 0.004, 0.01],
    [LIP[0] * 1.05, LIP[1] * 1.05, LIP[2] * 1.05]);
  addL([0, mouthY - 0.015 - jaw * 0.014, 0.087], [mouthW * 0.6, 0.0025, 0.005], SHAD, 0.45);
  for (const [sx, sm] of [[-1, smL], [1, smR]]) {
    addL([sx * (mouthW + 0.005), mouthY + 0.009 + sm * 0.016, 0.086], [0.006, 0.005, 0.009], LIP);
  }
  // chin/jaw mass follows jawOpen
  const chSh = lambert([0, -0.4, 0.9]);
  addL([0, 0.035 - jaw * 0.025, 0.06], [0.03, 0.024, 0.026],
    [SKIN[0] * chSh, SKIN[1] * chSh, SKIN[2] * chSh], 0.95);

  // distinguishing features — these change the splat COUNT per preset
  if (A.moustache) {
    for (const sx of [-1, 1]) {
      addL([sx * 0.015, mouthY + 0.017, 0.094], [0.017, 0.006, 0.006],
        [HAIR[0] * 0.95, HAIR[1] * 0.95, HAIR[2] * 0.95], 1, qFromEuler(0, 0, sx * -0.28));
    }
  }
  if (A.beard) {
    for (let i = 0; i < 26; i++) {
      const az = -1.15 + (2.3 * i) / 25;
      const bx = Math.sin(az), bz = Math.cos(az);
      const drop = 0.02 + 0.035 * Math.cos(az * 1.2);   // longest at the chin
      const gl = 0.75 + rnd() * 0.5;
      addL([bx * RX * 0.72, CY - 0.075 - drop - jaw * 0.02, bz * RZ * 0.8 + 0.012],
        [0.012, 0.018, 0.009], [HAIR[0] * gl, HAIR[1] * gl, HAIR[2] * gl], 0.95,
        qFromZTo(normalize([bx, -0.3, bz])));
    }
  }
  if (A.glasses) {
    const DARK = [0.07, 0.07, 0.09];
    for (const sx of [-1, 1]) {
      // rim: elongated splats laid along the ring so it reads as a line
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        addL([sx * F.eyeX + Math.cos(a) * 0.026, CY + 0.025 + Math.sin(a) * 0.021, 0.099],
          [0.0065, 0.0018, 0.002], DARK, 1, qFromEuler(0, 0, a + Math.PI / 2));
      }
      addL([sx * (RX * 0.92), CY + 0.028, 0.045], [0.0025, 0.0025, 0.045], DARK);  // temple arm
    }
    addL([0, CY + 0.031, 0.099], [0.013, 0.0025, 0.0025], DARK);                   // bridge
  }

  }   // end form branch

  // rotate head-locals by pose quat about the neck (y = 0.02); HS scales the
  // whole head up so it reads at room distance
  const HS = 1.3;
  for (const [pos, scale, color, alpha, quat] of local) {
    const p = qRotVec(q, [pos[0] * HS, (pos[1] - 0.02) * HS, pos[2] * HS]);
    s.add([base[0] + p[0], base[1] + 1.45 + 0.02 + p[1], base[2] + p[2]],
      [scale[0] * HS, scale[1] * HS, scale[2] * HS], color, alpha, qMul(q, quat));
  }
  }   // end !anim.noHead

  // torso — does not rotate with the head; shaded in WORLD space.
  // Chest rings + shoulders + upper-arm stubs (no more weeble egg).
  const shirt = (n, mul = 1) => {
    const sh = A.unlit ? mul : (0.55 + 0.5 * Math.max(0, dot(normalize(n), LIGHT))) * mul;
    return [SHIRT[0] * sh, SHIRT[1] * sh, SHIRT[2] * sh];
  };
  const TR = Math.max(6, Math.round(12 * Math.sqrt(DEN)));
  const TC = Math.max(10, Math.round(20 * Math.sqrt(DEN)));
  for (let yi = 0; yi < TR; yi++) {
    const y = 1.128 + yi * (0.342 / TR);
    const r = (0.115 + (1.42 - y) * 0.22) * F.build;
    for (let j = 0; j < TC; j++) {
      const a = (j / TC) * Math.PI * 2 + (yi % 2) * 0.16;
      addWorld(s, base, [Math.cos(a) * r * 1.25, y, Math.sin(a) * r * 0.5],
        [0.026 * DSZ, 0.022 * DSZ, 0.02], shirt([Math.cos(a), 0.15, Math.sin(a)], 0.94 + rnd() * 0.12));
    }
  }
  // arms + hands: shoulder → elbow → wrist → palm + fingers, short
  // sleeves. LOCAL animation only — the 32-byte packet carries no arm
  // telemetry yet (that is packet v1 + PoseLandmarker, DESIGN.md §8);
  // idle sway and talk gesticulation are synthesised viewer-side so the
  // rig is ready for real skeleton data.
  const skinW = (n, mul = 1) => {
    const sh = A.unlit ? mul : (0.55 + 0.5 * Math.max(0, dot(normalize(n), LIGHT))) * mul;
    return [SKIN[0] * sh, SKIN[1] * sh, SKIN[2] * sh];
  };
  const tA = anim.t || 0;
  const gest = jaw > 0.15 ? 1 : 0;
  const v3 = (a, d, k) => [a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k];
  const L1 = 0.25, L2 = 0.22;   // upper arm, forearm bone lengths
  // rig control points, exported for the debug overlay
  s.joints = [[base[0], base[1] + 1.47, base[2]]];
  const armPose = pose && pose.arms ? pose.arms : null;
  for (const sx of [-1, 1]) {
    addWorld(s, base, [sx * 0.205 * F.build, 1.41, 0], [0.062 * F.build, 0.034, 0.048], shirt([sx * 0.5, 1, 0.2]));
    const shoulder = [sx * 0.215 * F.build, 1.395, 0.0];
    const ap = armPose ? (sx < 0 ? armPose.l : armPose.r) : null;
    let elbow, wrist;
    if (ap && ap.vis > 0.5) {
      // two-bone analytic IK to the telemetry wrist target. Offscreen
      // arms (vis 0) never reach here — they idle-animate below.
      let dvec = [ap.t[0], ap.t[1], ap.t[2]];
      let d = Math.hypot(dvec[0], dvec[1], dvec[2]);
      const dir = d > 1e-4 ? [dvec[0] / d, dvec[1] / d, dvec[2] / d] : [sx, -0.5, 0.2];
      d = clamp(d, 0.08, L1 + L2 - 0.01);
      wrist = v3(shoulder, dir, d);
      const cosA = clamp((d * d + L1 * L1 - L2 * L2) / (2 * d * L1), -1, 1);
      const a1 = Math.acos(cosA);
      // elbow pole: down, out, slightly back — orthogonalized against dir
      let pole = [sx * 0.35, -1, -0.3];
      const pd = dot(pole, dir);
      pole = [pole[0] - dir[0] * pd, pole[1] - dir[1] * pd, pole[2] - dir[2] * pd];
      const pl = Math.hypot(pole[0], pole[1], pole[2]);
      pole = pl > 1e-4 ? [pole[0] / pl, pole[1] / pl, pole[2] / pl] : [0, 0, -1];
      elbow = [
        shoulder[0] + dir[0] * L1 * Math.cos(a1) + pole[0] * L1 * Math.sin(a1),
        shoulder[1] + dir[1] * L1 * Math.cos(a1) + pole[1] * L1 * Math.sin(a1),
        shoulder[2] + dir[2] * L1 * Math.cos(a1) + pole[2] * L1 * Math.sin(a1),
      ];
    } else {
      // no telemetry for this arm — synthesized idle sway + talk gestures
      const sway = Math.sin(tA * 0.9 + sx * 1.7) * 0.05;
      const lift = gest * (0.35 + 0.25 * Math.sin(tA * 3.1 + sx * 2.1));
      const outA = 0.16 + sway + lift * 0.6;
      const ud = normalize([sx * Math.sin(outA), -Math.cos(outA), 0.03]);
      elbow = v3(shoulder, ud, L1);
      const bend = 0.35 + lift * 1.5 + 0.06 * Math.sin(tA * 1.3 + sx);
      const fd = normalize([ud[0] * 0.85, ud[1] * Math.cos(bend), Math.sin(bend) * 0.9 + 0.05]);
      wrist = v3(elbow, fd, L2);
    }
    s.joints.push(
      [base[0] + shoulder[0], base[1] + shoulder[1], base[2] + shoulder[2]],
      [base[0] + elbow[0], base[1] + elbow[1], base[2] + elbow[2]],
      [base[0] + wrist[0], base[1] + wrist[1], base[2] + wrist[2]]);
    // draw along the solved joints (same splat count on both paths)
    const uv = normalize([elbow[0] - shoulder[0], elbow[1] - shoulder[1], elbow[2] - shoulder[2]]);
    const fd = normalize([wrist[0] - elbow[0], wrist[1] - elbow[1], wrist[2] - elbow[2]]);
    for (let i = 0; i <= 6; i++) {   // upper arm — sleeve
      addWorld(s, base, v3(shoulder, uv, 0.04 + i * 0.035), [0.028, 0.028, 0.026],
        shirt([sx, 0.2, 0.4], 0.9 + i * 0.015));
    }
    for (let i = 0; i <= 6; i++) {   // forearm — skin
      const r = 0.026 - i * 0.0013;
      addWorld(s, base, v3(elbow, fd, 0.025 + i * 0.033), [r, r, r * 0.9],
        skinW([sx, 0.2, 0.5], 0.95));
    }
    // hand: palm, four fingers, thumb — enough articulation points for
    // future skeleton gesture matching to have somewhere to land
    const palm = v3(wrist, fd, 0.045);
    addWorld(s, base, palm, [0.032, 0.018, 0.04], skinW([sx, 0.1, 0.6]));
    const side = normalize([fd[2] * sx, 0, -fd[0] * sx]);   // across the palm
    for (let f = 0; f < 4; f++) {
      const spread = (f - 1.5) * 0.014;
      const fpos = v3(v3(palm, fd, 0.045), side, spread);
      addWorld(s, base, fpos, [0.008, 0.008, 0.02], skinW([sx, 0.1, 0.7], 0.97));
      addWorld(s, base, v3(fpos, fd, 0.02), [0.007, 0.007, 0.014], skinW([sx, 0.1, 0.7], 0.94));
    }
    addWorld(s, base, v3(v3(palm, side, -0.032), fd, 0.012),
      [0.009, 0.009, 0.016], skinW([sx, 0.2, 0.6], 0.96));
  }
  return s;
}

function addWorld(s, base, pos, scale, color) {
  s.add([base[0] + pos[0], base[1] + pos[1], base[2] + pos[2]], scale, color, 1);
}
