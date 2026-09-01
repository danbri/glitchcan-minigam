// scene-builder.js — procedural splat content for the demos: a stylised
// room "avatar" and a blendshape-driven head. Stands in for real scanned
// bundles (DESIGN.md §6 honesty box). Splat layout: see splat-renderer.js.
import { mulberry32, qMul, qRotVec, qFromEuler, clamp } from './pose-math.js';
import { FLOATS_PER_SPLAT } from './splat-renderer.js';
import { BLENDSHAPES } from './telemetry-codec.js';

const BI = {};
BLENDSHAPES.forEach((n, i) => { BI[n] = i; });

class SplatList {
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
  for (let x = -4; x <= 4; x += 0.22) {
    for (let z = -3; z <= 3; z += 0.22) {
      const plank = Math.floor((x + 4) / 0.6) % 2 ? 0.03 : -0.02;
      const c = 0.42 + plank + (rnd() - 0.5) * 0.05;
      s.add([jitter(x, 0.1), 0, jitter(z, 0.1)], [0.16, 0.02, 0.16], [c, c * 0.72, c * 0.5], 0.95);
    }
  }
  // walls — plaster, slightly cool
  const wall = (px, pz, nx, nz, len) => {
    for (let u = -len; u <= len; u += 0.24) {
      for (let y = 0.1; y <= 2.8; y += 0.24) {
        const c = 0.62 + (rnd() - 0.5) * 0.04 + y * 0.02;
        s.add([px + nx * 0 + (nz !== 0 ? u : 0), jitter(y, 0.08), pz + (nx !== 0 ? u : 0)],
          [nz !== 0 ? 0.18 : 0.03, 0.18, nx !== 0 ? 0.18 : 0.03], [c * 0.93, c * 0.94, c], 0.95);
      }
    }
  };
  wall(0, -3, 0, 1, 4);    // back wall
  wall(-4, 0, 1, 0, 3);    // left wall
  wall(4, 0, -1, 0, 3);    // right wall

  // window on back wall — cool daylight glow
  for (let x = -1.1; x <= 1.1; x += 0.14) {
    for (let y = 1.2; y <= 2.3; y += 0.14) {
      s.add([jitter(x + 1.6, 0.04), jitter(y, 0.04), -2.93], [0.1, 0.1, 0.02], [0.75, 0.85, 1.0], 0.9);
    }
  }
  // rug
  for (let i = 0; i < 220; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    s.add([Math.cos(a) * r * 1.3, 0.03, Math.sin(a) * r * 0.9 + 0.4],
      [0.12, 0.02, 0.12], [0.55 + rnd() * 0.1, 0.2, 0.22], 0.9);
  }
  // table — top + 4 legs
  for (let x = -0.55; x <= 0.55; x += 0.11) {
    for (let z = -0.3; z <= 0.3; z += 0.11) {
      s.add([jitter(x - 1.8, 0.02), 0.74, jitter(z - 0.8, 0.02)], [0.09, 0.02, 0.09], [0.3, 0.2, 0.13], 1);
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
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 0.35, h = 0.7 + rnd() * 0.6;
    s.add([2.9 + Math.cos(a) * r, h, -2.2 + Math.sin(a) * r],
      [0.09, 0.06, 0.09], [0.15 + rnd() * 0.15, 0.4 + rnd() * 0.2, 0.14], 0.85);
  }
  // shelf with books on left wall
  for (let z = -1.6; z <= -0.2; z += 0.1) s.add([-3.9, 1.4, z], [0.03, 0.02, 0.08], [0.32, 0.22, 0.14], 1);
  for (let z = -1.55; z <= -0.25; z += 0.09) {
    s.add([-3.86, 1.53, z], [0.02, 0.1, 0.035], [0.3 + rnd() * 0.5, 0.25 + rnd() * 0.4, 0.3 + rnd() * 0.4], 1);
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
// default view). Rebuilt from the pose every frame — ~200 splats, trivial.
const SKIN = [0.82, 0.62, 0.5];
const HAIR = [0.2, 0.14, 0.1];
const SHIRT = [0.22, 0.32, 0.45];

export function avatarSplatCount() { return buildAvatarSplats(null).count; }

// pose: decoded telemetry pose, or null for rest. Returns a SplatList in
// WORLD space (head rotated by pose.quat around the neck, then translated
// so the neck sits at pose.pos + at).
export function buildAvatarSplats(pose, at = [0, 0, 0]) {
  const s = new SplatList();
  const b = pose ? pose.blend : new Float32Array(10);
  const q = pose ? pose.quat : [0, 0, 0, 1];
  const base = pose ? [at[0] + pose.pos[0], at[1] + (pose.pos[1] - 1.45), at[2] + pose.pos[2]] : at;

  const jaw = b[BI.jawOpen], blinkL = b[BI.eyeBlinkLeft], blinkR = b[BI.eyeBlinkRight];
  const brow = b[BI.browInnerUp], smL = b[BI.mouthSmileLeft], smR = b[BI.mouthSmileRight];
  const pucker = b[BI.mouthPucker], lookX = b[BI.eyeLookX], lookY = b[BI.eyeLookY];

  // head-local splats collected first, then rotated
  const local = [];
  const addL = (pos, scale, color, alpha = 1, quat = [0, 0, 0, 1]) =>
    local.push([pos, scale, color, alpha, quat]);

  const rnd = mulberry32(7);
  // skull shell
  for (let i = 0; i < 90; i++) {
    const th = Math.acos(1 - 2 * rnd()), ph = rnd() * Math.PI * 2;
    const nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph);
    const isHair = ny > 0.35 || nz < -0.55;
    addL([nx * 0.095, 0.13 + ny * 0.11, nz * 0.09],
      [0.045, 0.045, 0.045], isHair ? HAIR : SKIN, 0.95);
  }
  // ears
  for (const sx of [-1, 1]) addL([sx * 0.1, 0.12, -0.01], [0.02, 0.03, 0.02], SKIN);
  // nose
  addL([0, 0.1, 0.1], [0.018, 0.025, 0.02], [SKIN[0] * 0.96, SKIN[1] * 0.9, SKIN[2] * 0.88]);
  // eyes: white + pupil; blink squashes vertically
  for (const [sx, blink] of [[-1, blinkL], [1, blinkR]]) {
    const open = clamp(1 - blink, 0.06, 1);
    addL([sx * 0.038, 0.145, 0.085], [0.017, 0.014 * open, 0.008], [0.97, 0.97, 0.95]);
    addL([sx * 0.038 + lookX * 0.008, 0.145 + lookY * 0.006, 0.093],
      [0.007, 0.008 * open, 0.004], [0.1, 0.08, 0.07]);
  }
  // brows raise with browInnerUp
  for (const sx of [-1, 1]) {
    addL([sx * 0.04, 0.175 + brow * 0.012, 0.088], [0.022, 0.005, 0.006], HAIR, 1,
      qFromEuler(0, 0, sx * -0.15));
  }
  // mouth: dark opening scaled by jaw; lip bar; smile corners lift
  const mouthY = 0.055 - jaw * 0.018;
  const mouthW = clamp(0.03 - pucker * 0.012 + (smL + smR) * 0.004, 0.012, 0.04);
  addL([0, mouthY, 0.088], [mouthW, 0.004 + jaw * 0.022, 0.008], [0.32, 0.1, 0.1]);
  addL([0, mouthY + 0.008 + jaw * 0.01, 0.09], [mouthW * 1.05, 0.004, 0.006], [0.75, 0.42, 0.4]);
  for (const [sx, sm] of [[-1, smL], [1, smR]]) {
    addL([sx * (mouthW + 0.006), mouthY + sm * 0.014, 0.086], [0.007, 0.006, 0.006],
      [0.72, 0.45, 0.42]);
  }
  // chin/jaw mass follows jawOpen
  addL([0, 0.02 - jaw * 0.02, 0.055], [0.05, 0.04, 0.045], SKIN, 0.95);

  // rotate head-locals by pose quat about the neck (y = 0.02); HS scales the
  // whole head up so it reads at room distance
  const HS = 1.3;
  for (const [pos, scale, color, alpha, quat] of local) {
    const p = qRotVec(q, [pos[0] * HS, (pos[1] - 0.02) * HS, pos[2] * HS]);
    s.add([base[0] + p[0], base[1] + 1.45 + 0.02 + p[1], base[2] + p[2]],
      [scale[0] * HS, scale[1] * HS, scale[2] * HS], color, alpha, qMul(q, quat));
  }
  // torso — does not rotate with the head
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    addTorso(s, base, a, r, rnd);
  }
  return s;
}

function addTorso(s, base, a, r, rnd) {
  const y = 1.15 + rnd() * 0.28;
  const width = 0.16 + (1.43 - y) * 0.25;
  s.add([base[0] + Math.cos(a) * r * width, base[1] + y, base[2] + Math.sin(a) * r * 0.08],
    [0.07, 0.06, 0.06], [SHIRT[0] + rnd() * 0.04, SHIRT[1] + rnd() * 0.04, SHIRT[2] + rnd() * 0.04], 0.95);
}
