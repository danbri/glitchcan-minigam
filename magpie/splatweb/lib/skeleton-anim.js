// skeleton-anim.js — model-agnostic humanoid animation in AVATAR space
// (y up, facing +z, metres): a relaxed stance, stored procedural clips
// (idle, walk, wave, nod, shrug, dance, talk gestures), pose blending,
// two-bone arm IK against the rig's own bone lengths, and a composer that
// turns (clip + telemetry) into the per-bone rotations rigged-splats.js
// consumes. Rotations follow that module's convention: each bone's
// quaternion acts in the frame its parent has already been rotated into.
//
// Arm helpers (T-pose rest, left arm along +x, right along −x):
//   down(side, deg)   lower the arm from the T-pose toward the hip
//   fwd(side, deg)    swing it forward (+z)
//   bendUp(side, deg) elbow: fold the forearm upward
//   fwd(side, deg) on the LOWER arm: fold the forearm forward
// side = +1 left, −1 right. Legs hang −y: legSwing(deg) forward, knee(deg).
import { qMul, qConjugate, qRotVec, qFromEuler, qSlerp, qNormalize, clamp, lerp } from './pose-math.js';

const D = Math.PI / 180;
export const Q_ID = [0, 0, 0, 1];
export const SIDE = { left: 1, right: -1 };

export const eul = (pitch, yaw, roll) => qFromEuler(yaw * D, pitch * D, roll * D);
export const down = (side, deg) => eul(0, 0, -side * deg);
export const fwd = (side, deg) => eul(0, -side * deg, 0);
export const bendUp = (side, deg) => eul(0, 0, side * deg);
export const legSwing = (deg) => eul(-deg, 0, 0);
export const knee = (deg) => eul(deg, 0, 0);
// upper arm: swing forward first, then lower — the natural order
export const arm = (side, dn, fw = 0) => qMul(down(side, dn), fwd(side, fw));

// minimal rotation taking unit vector a onto unit vector b
export function qFromTo(a, b) {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (d < -0.9999) {
    // antiparallel: any axis ⟂ a
    let ax = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const c = cross(a, ax);
    return qNormalize([c[0], c[1], c[2], 0]);
  }
  const c = cross(a, b);
  return qNormalize([c[0], c[1], c[2], 1 + d]);
}
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const v3 = (a, d, k) => [a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// a pose: { bones: {name: quat}, hips: [x,y,z], morph: {name: w} }
export function blendPose(a, b, t) {
  if (t <= 0) return a; if (t >= 1) return b;
  const bones = {};
  for (const k of new Set([...Object.keys(a.bones || {}), ...Object.keys(b.bones || {})])) {
    bones[k] = qSlerp(a.bones?.[k] || Q_ID, b.bones?.[k] || Q_ID, t);
  }
  const ha = a.hips || [0, 0, 0], hb = b.hips || [0, 0, 0];
  const morph = {};
  for (const k of new Set([...Object.keys(a.morph || {}), ...Object.keys(b.morph || {})])) {
    morph[k] = lerp(a.morph?.[k] || 0, b.morph?.[k] || 0, t);
  }
  return { bones, hips: [lerp(ha[0], hb[0], t), lerp(ha[1], hb[1], t), lerp(ha[2], hb[2], t)], morph };
}
// layer b OVER a: bones present in b are composed (a then b), others kept
export function layerPose(a, b, w = 1) {
  const bones = { ...(a.bones || {}) };
  for (const k of Object.keys(b.bones || {})) {
    const q = w < 1 ? qSlerp(Q_ID, b.bones[k], w) : b.bones[k];
    bones[k] = bones[k] ? qMul(bones[k], q) : q;
  }
  const ha = a.hips || [0, 0, 0], hb = b.hips || [0, 0, 0];
  return { bones, hips: [ha[0] + hb[0] * w, ha[1] + hb[1] * w, ha[2] + hb[2] * w],
    morph: { ...(a.morph || {}), ...(b.morph || {}) } };
}

// ---------------------------------------------------------------- clips
// every clip: (t seconds, params) → pose, defined relative to the T-pose;
// most start from RELAXED (arms hanging, slight elbow)
function relaxed(t = 0, sway = 1) {
  const s = Math.sin(t * 0.9) * 2 * sway, s2 = Math.sin(t * 1.3 + 1) * 1.5 * sway;
  return {
    bones: {
      leftUpperArm: arm(1, 74 + s, 4), rightUpperArm: arm(-1, 74 - s, 4),
      leftLowerArm: fwd(1, 14 + s2), rightLowerArm: fwd(-1, 14 - s2),
      leftHand: fwd(1, 4), rightHand: fwd(-1, 4),
      leftShoulder: eul(0, 0, -2), rightShoulder: eul(0, 0, 2),
    },
    hips: [0, 0, 0], morph: {},
  };
}

export const CLIPS = {
  idle: {
    name: 'idle', loop: true,
    pose(t) {
      const p = relaxed(t);
      const br = Math.sin(t * 1.25);           // breathing
      p.bones.chest = eul(1.2 * br, 0, 0);
      p.bones.upperChest = eul(0.8 * br, Math.sin(t * 0.37) * 3, 0);
      p.bones.spine = eul(0, 0, Math.sin(t * 0.23) * 1.5);
      p.bones.head = eul(Math.sin(t * 0.7) * 1.5, Math.sin(t * 0.41 + 2) * 3, Math.sin(t * 0.3) * 1);
      p.bones.hips = eul(0, Math.sin(t * 0.19) * 2, Math.sin(t * 0.23) * -1.5);
      p.hips = [Math.sin(t * 0.23) * 0.012, -0.004 + br * 0.002, 0];
      // weight-shift: one knee softens
      const ws = Math.sin(t * 0.23);
      p.bones.leftLowerLeg = knee(Math.max(0, ws) * 4); p.bones.rightLowerLeg = knee(Math.max(0, -ws) * 4);
      return p;
    },
  },
  walk: {
    name: 'walk', loop: true,
    // t is the stride PHASE in radians (caller advances it by speed)
    pose(ph, { speed = 1 } = {}) {
      const s = clamp(speed, 0, 1.4);
      const p = relaxed(ph * 0.3, 0.3);
      const sw = Math.sin(ph), sw2 = Math.sin(2 * ph);
      const swingA = 26 * s;
      p.bones.leftUpperLeg = legSwing(swingA * sw);
      p.bones.rightUpperLeg = legSwing(-swingA * sw);
      // knee folds during the forward swing (just after the leg passes under)
      const kL = Math.max(0, Math.sin(ph + 0.9)) ** 1.5 * 48 * s + 4;
      const kR = Math.max(0, Math.sin(ph + 0.9 + Math.PI)) ** 1.5 * 48 * s + 4;
      p.bones.leftLowerLeg = knee(kL); p.bones.rightLowerLeg = knee(kR);
      // feet roughly level: cancel most of the leg angle
      p.bones.leftFoot = eul(swingA * sw * 0.6 - kL * 0.55 + 4, 0, 0);
      p.bones.rightFoot = eul(-swingA * sw * 0.6 - kR * 0.55 + 4, 0, 0);
      // arms counter-swing
      p.bones.leftUpperArm = arm(1, 76, -22 * s * sw);
      p.bones.rightUpperArm = arm(-1, 76, 22 * s * sw);
      p.bones.leftLowerArm = fwd(1, 18 + 10 * s * Math.max(0, -sw));
      p.bones.rightLowerArm = fwd(-1, 18 + 10 * s * Math.max(0, sw));
      // pelvis + torso
      p.bones.hips = eul(0, 5 * s * sw, 2.5 * s * Math.sin(ph + Math.PI / 2));
      p.bones.upperChest = eul(3 * s, -7 * s * sw, -2 * s * Math.sin(ph + Math.PI / 2));
      p.bones.head = eul(-2 * s, 3 * s * sw, 0);
      p.hips = [0, -0.02 * s + 0.018 * s * Math.abs(sw2) * 0.5, 0];
      return p;
    },
  },
  wave: {
    name: 'wave', loop: true, length: 3,
    pose(t) {
      const p = relaxed(t);
      const k = clamp(t / 0.5, 0, 1);            // raise over half a second
      const raise = Math.sin(k * Math.PI / 2);
      p.bones.rightUpperArm = qSlerp(p.bones.rightUpperArm, arm(-1, -25, 25), raise);
      p.bones.rightLowerArm = qSlerp(p.bones.rightLowerArm,
        qMul(bendUp(-1, 70 + 22 * Math.sin(t * 9)), fwd(-1, 25)), raise);
      p.bones.rightHand = eul(0, 0, 15 * Math.sin(t * 9 + 1));
      p.bones.head = eul(-3, -8 * raise, 6 * raise);
      p.bones.upperChest = eul(0, -6 * raise, 3 * raise);
      p.morph = { joy: 0.6 * raise, e: 0.25 * raise };
      return p;
    },
  },
  nod: {
    name: 'nod', loop: false, length: 1.4,
    pose(t) {
      const p = relaxed(t);
      const e = clamp(t / 1.4, 0, 1);
      p.bones.head = eul(16 * Math.sin(e * Math.PI * 2) * (1 - e * 0.4), 0, 0);
      p.bones.neck = eul(6 * Math.sin(e * Math.PI * 2), 0, 0);
      return p;
    },
  },
  shrug: {
    name: 'shrug', loop: false, length: 1.8,
    pose(t) {
      const p = relaxed(t);
      const e = clamp(t / 1.8, 0, 1), k = Math.sin(e * Math.PI);
      p.bones.leftShoulder = eul(0, 0, 14 * k); p.bones.rightShoulder = eul(0, 0, -14 * k);
      p.bones.leftUpperArm = arm(1, 62 - 8 * k, 20 * k); p.bones.rightUpperArm = arm(-1, 62 - 8 * k, 20 * k);
      p.bones.leftLowerArm = qMul(bendUp(1, 55 * k), fwd(1, 35 * k));
      p.bones.rightLowerArm = qMul(bendUp(-1, 55 * k), fwd(-1, 35 * k));
      p.bones.leftHand = eul(0, 0, -40 * k); p.bones.rightHand = eul(0, 0, 40 * k);
      p.bones.head = eul(-4 * k, 0, 9 * k);
      p.bones.upperChest = eul(-2 * k, 0, -2 * k);
      p.morph = { o: 0.3 * k };
      return p;
    },
  },
  dance: {
    name: 'dance', loop: true,
    pose(t) {
      const p = relaxed(t);
      const b = t * 2 * Math.PI * (112 / 60);     // 112 bpm
      const s = Math.sin(b), c = Math.cos(b), s2 = Math.sin(b / 2);
      p.hips = [Math.sin(b / 2) * 0.05, -0.03 + 0.03 * Math.abs(c), 0];
      p.bones.hips = eul(0, 14 * s2, 6 * s);
      p.bones.spine = eul(4 * c, -8 * s2, -3 * s);
      p.bones.upperChest = eul(3 * s, -10 * s2, 4 * s);
      p.bones.head = eul(6 * c, 10 * s2, -5 * s);
      p.bones.leftUpperArm = arm(1, 40 + 30 * s, 30 + 20 * c);
      p.bones.rightUpperArm = arm(-1, 40 - 30 * s, 30 - 20 * c);
      p.bones.leftLowerArm = qMul(bendUp(1, 70 + 25 * c), fwd(1, 20));
      p.bones.rightLowerArm = qMul(bendUp(-1, 70 - 25 * c), fwd(-1, 20));
      p.bones.leftUpperLeg = legSwing(8 * s); p.bones.rightUpperLeg = legSwing(-8 * s);
      p.bones.leftLowerLeg = knee(14 + 10 * Math.max(0, s)); p.bones.rightLowerLeg = knee(14 + 10 * Math.max(0, -s));
      p.morph = { joy: 0.5, a: 0.15 + 0.15 * Math.abs(s) };
      return p;
    },
  },
  talk: {
    name: 'talk', loop: true,
    // gesticulation layer for speech — hands come up and move with the words
    pose(t, { energy = 1 } = {}) {
      const p = relaxed(t);
      const e = clamp(energy, 0, 1);
      const a = Math.sin(t * 3.1), b = Math.sin(t * 2.3 + 1.2), c = Math.sin(t * 4.7 + 0.4);
      p.bones.leftUpperArm = arm(1, 66 - 6 * e * a, 18 * e + 8 * e * b);
      p.bones.rightUpperArm = arm(-1, 66 + 6 * e * b, 22 * e + 8 * e * a);
      p.bones.leftLowerArm = qMul(bendUp(1, e * (45 + 25 * a)), fwd(1, 30 * e));
      p.bones.rightLowerArm = qMul(bendUp(-1, e * (50 + 25 * b)), fwd(-1, 30 * e));
      p.bones.leftHand = eul(0, 20 * e * c, -15 * e * a); p.bones.rightHand = eul(0, -20 * e * a, 15 * e * b);
      p.bones.head = eul(2 * e * b, 4 * e * a, 2 * e * c);
      p.bones.upperChest = eul(3 * e, 3 * e * b, 0);
      return p;
    },
  },
  sit: {
    name: 'sit', loop: true,
    pose(t) {
      const p = relaxed(t, 0.5);
      p.hips = [0, -0.42, 0.02];
      p.bones.leftUpperLeg = legSwing(84); p.bones.rightUpperLeg = legSwing(84);
      p.bones.leftLowerLeg = knee(86); p.bones.rightLowerLeg = knee(86);
      p.bones.leftFoot = eul(-2, 0, 0); p.bones.rightFoot = eul(-2, 0, 0);
      p.bones.leftUpperArm = arm(1, 70, 30); p.bones.rightUpperArm = arm(-1, 70, 30);
      p.bones.leftLowerArm = fwd(1, 50); p.bones.rightLowerArm = fwd(-1, 50);
      p.bones.spine = eul(4, 0, 0);
      p.bones.chest = eul(1.2 * Math.sin(t * 1.25), 0, 0);
      return p;
    },
  },
};
export const CLIP_NAMES = Object.keys(CLIPS);

// ---------------------------------------------------------------- the rig
// Bone lengths + rest directions from a loaded RiggedAvatar (avatar space).
export class Rig {
  constructor(avatar) {
    this.av = avatar;
    const j = (b) => avatar.restJoint(b);
    this.arms = {};
    for (const side of ['left', 'right']) {
      const S = j(side + 'UpperArm'), E = j(side + 'LowerArm'), W = j(side + 'Hand');
      if (!S || !E || !W) continue;
      this.arms[side] = { S, L1: Math.hypot(...sub(E, S)), L2: Math.hypot(...sub(W, E)),
        d0u: norm(sub(E, S)), d0l: norm(sub(W, E)) };
    }
    this.height = avatar.heightM;
    this.chain = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head'];
    this.parentOf = {
      spine: 'hips', chest: 'spine', upperChest: 'chest', neck: 'upperChest', head: 'neck',
      leftShoulder: 'upperChest', leftUpperArm: 'leftShoulder', leftLowerArm: 'leftUpperArm', leftHand: 'leftLowerArm',
      rightShoulder: 'upperChest', rightUpperArm: 'rightShoulder', rightLowerArm: 'rightUpperArm', rightHand: 'rightLowerArm',
      leftUpperLeg: 'hips', leftLowerLeg: 'leftUpperLeg', leftFoot: 'leftLowerLeg', leftToes: 'leftFoot',
      rightUpperLeg: 'hips', rightLowerLeg: 'rightUpperLeg', rightFoot: 'rightLowerLeg', rightToes: 'rightFoot',
    };
    // rigs missing chest/upperChest/neck: skip the missing link
    for (const k of Object.keys(this.parentOf)) {
      let p = this.parentOf[k];
      while (p && !avatar.hasBone(p)) p = this.parentOf[p];
      this.parentOf[k] = p || null;
    }
    // total reach used to normalise telemetry wrist targets (captured
    // against a 0.47 m nominal reach — see face-capture.js)
    const a = this.arms.left || this.arms.right;
    this.reach = a ? a.L1 + a.L2 : 0.47;
  }

  // accumulated (world-frame) rotation of a bone under a pose
  accum(bones, bone) {
    let q = Q_ID;
    const chain = [];
    for (let b = bone; b; b = this.parentOf[b]) chain.unshift(b);
    for (const b of chain) if (bones[b]) q = qMul(q, bones[b]);
    return q;
  }

  // two-bone IK: wrist target relative to the shoulder (avatar space,
  // metres) + optional elbow hint (same frame) → upper/lower arm quats
  // that slot into `bones`. Returns the solved elbow/wrist for overlays.
  armIK(bones, side, target, elbowHint = null) {
    const A = this.arms[side];
    if (!A) return null;
    const sgn = SIDE[side];
    // the shoulder's parent frame, as already posed
    const accP = this.accum(bones, side + 'Shoulder') ;
    const S = [0, 0, 0];
    let d = Math.hypot(...target);
    const dir = d > 1e-4 ? norm(target) : [sgn, -0.5, 0.2];
    d = clamp(d, 0.05, A.L1 + A.L2 - 0.005);
    const cosA = clamp((d * d + A.L1 * A.L1 - A.L2 * A.L2) / (2 * d * A.L1), -1, 1);
    const a1 = Math.acos(cosA);
    // elbow pole: from the captured elbow if we have one, else down/out/back
    let pole = elbowHint ? elbowHint.slice() : [sgn * 0.35, -1, -0.3];
    const pd = dot(pole, dir);
    pole = [pole[0] - dir[0] * pd, pole[1] - dir[1] * pd, pole[2] - dir[2] * pd];
    const pl = Math.hypot(...pole);
    pole = pl > 1e-3 ? [pole[0] / pl, pole[1] / pl, pole[2] / pl] : norm(cross(dir, [0, 0, 1]));
    const E = v3(v3(S, dir, A.L1 * Math.cos(a1)), pole, A.L1 * Math.sin(a1));
    const W = v3(S, dir, d);
    const du = norm(sub(E, S)), dl = norm(sub(W, E));
    // accum[upper] must map the rest direction onto du, and it composes
    // as accP ⊗ A_upper — likewise for the lower arm
    const Qu = qFromTo(A.d0u, du);
    const Au = qMul(qConjugate(accP), Qu);
    const Ql = qFromTo(A.d0l, dl);
    const Al = qMul(qConjugate(qMul(accP, Au)), Ql);
    bones[side + 'UpperArm'] = Au;
    bones[side + 'LowerArm'] = Al;
    return { E, W, S: A.S };
  }
}

// ---------------------------------------------------------------- composer
// Telemetry channel indices (telemetry-codec.js BLENDSHAPES order)
const BI = { jawOpen: 0, eyeBlinkLeft: 1, eyeBlinkRight: 2, browInnerUp: 3, mouthSmileLeft: 4,
  mouthSmileRight: 5, mouthPucker: 6, eyeLookX: 7, eyeLookY: 8, cheekPuff: 9 };

// packet blendshapes → VRM expression weights, using whatever the model has
export function morphFromBlend(b, has) {
  if (!b) return {};
  const jaw = b[BI.jawOpen], pk = b[BI.mouthPucker], sm = (b[BI.mouthSmileLeft] + b[BI.mouthSmileRight]) / 2;
  const m = {};
  m.a = jaw * (1 - pk * 0.6);
  m.o = jaw * pk * 0.8;
  m.u = pk * (1 - jaw * 0.5) * 0.7;
  if (has('blink_l') || has('blink_r')) { m.blink_l = b[BI.eyeBlinkLeft]; m.blink_r = b[BI.eyeBlinkRight]; }
  else m.blink = Math.max(b[BI.eyeBlinkLeft], b[BI.eyeBlinkRight]);
  if (has('joy')) m.joy = sm;
  else if (has('fun')) m.fun = sm;
  else m.e = sm * 0.45 * (1 - jaw);   // a wide 'e' is the nearest thing to a smile
  if (has('surprised')) m.surprised = b[BI.browInnerUp] * 0.5;
  return m;
}

// The stage's composer: base locomotion (idle ↔ walk by speed), gesture
// clip layered on top, then the packet — head quat split neck/head, arms
// by IK when telemetry has them (weight w per arm), torso lean/yaw.
export class PoseComposer {
  constructor(rig) {
    this.rig = rig;
    this.t = 0;
    this.walkPhase = 0;
    this.gesture = null;   // { clip, t0 }
    this.facing = 0;       // body yaw, radians
    this.speed = 0;
    this.talkW = 0;
    this.lastIK = {};
  }
  play(name) { this.gesture = CLIPS[name] ? { clip: CLIPS[name], t0: this.t } : null; }
  tick(dt) { this.t += dt; }

  // rx: decoded pose (or null) — quat, pos, blend, arms {l:{t,e,vis},r}, torso
  // env: { speed (m/s), heading (rad), armW: {left, right} (0..1 blend
  //        weights from the arm smoother), talking }
  compose(rx, env = {}) {
    const rig = this.rig, t = this.t, dt = env.dt || 0.016;
    const speed = clamp((env.speed || 0) / 0.9, 0, 1.3);   // 0.9 m/s = full stride
    this.walkPhase += dt * (4.2 + speed * 4.5) * Math.min(1, speed * 3);
    let pose = CLIPS.idle.pose(t);
    if (speed > 0.02) pose = blendPose(pose, CLIPS.walk.pose(this.walkPhase, { speed }), clamp(speed * 2.5, 0, 1));
    // gesture layer (one-shot clips fade out at their end)
    if (this.gesture) {
      const g = this.gesture, gt = t - g.t0;
      const len = g.clip.length || 2.5;
      if (!g.clip.loop && gt > len + 0.4) this.gesture = null;
      else {
        const fadeIn = clamp(gt / 0.3, 0, 1);
        const fadeOut = g.clip.loop ? 1 : clamp((len + 0.4 - gt) / 0.4, 0, 1);
        pose = blendPose(pose, g.clip.pose(gt), fadeIn * fadeOut);
      }
    }
    // speech gesticulation, weighted by how much the mouth is moving
    const jaw = rx ? rx.blend[BI.jawOpen] : 0;
    this.talkW = lerp(this.talkW, (env.talking || jaw > 0.15) ? 1 : 0, 1 - Math.exp(-dt * 3));
    if (this.talkW > 0.01 && !this.gesture && speed < 0.2) {
      pose = blendPose(pose, CLIPS.talk.pose(t, { energy: 0.8 }), this.talkW * 0.85);
    }
    const bones = pose.bones;
    // body facing (walk heading, or the resting facing)
    const face = eul(0, this.facing / D, 0);
    bones.hips = bones.hips ? qMul(face, bones.hips) : face;
    if (rx) {
      // torso from telemetry (v2): yaw/roll on the chest, lean on the spine
      if (rx.torso) {
        const tq = eul(rx.torso.pitch / D * 0.6, rx.torso.yaw / D * 0.7, rx.torso.roll / D * 0.7);
        bones.upperChest = bones.upperChest ? qMul(bones.upperChest, tq) : tq;
        const sq = eul(rx.torso.pitch / D * 0.4, 0, 0);
        bones.spine = bones.spine ? qMul(bones.spine, sq) : sq;
      }
      // head: the packet quaternion, body-relative, 35 % neck / 65 % head
      const hq = rx.quat;
      const nq = qSlerp(Q_ID, hq, 0.35), hh = qSlerp(Q_ID, hq, 0.65);
      bones.neck = bones.neck ? qMul(bones.neck, nq) : nq;
      bones.head = bones.head ? qMul(bones.head, hh) : hh;
      // arms: IK toward the (smoothed) wrist targets, blended by weight
      const aw = env.armW || {};
      for (const side of ['left', 'right']) {
        const w = aw[side] || 0;
        if (w <= 0.001 || !rx.arms) continue;
        const a = side === 'left' ? rx.arms.l : rx.arms.r;
        const tgt = env.armTargets?.[side] || a.t;
        const k = rig.reach / 0.47;
        const clipU = bones[side + 'UpperArm'], clipL = bones[side + 'LowerArm'];
        const sol = rig.armIK(bones, side, [tgt[0] * k, tgt[1] * k, tgt[2] * k],
          a.e ? [a.e[0] * k, a.e[1] * k, a.e[2] * k] : null);
        if (sol && w < 0.999) {
          bones[side + 'UpperArm'] = qSlerp(clipU || Q_ID, bones[side + 'UpperArm'], w);
          bones[side + 'LowerArm'] = qSlerp(clipL || Q_ID, bones[side + 'LowerArm'], w);
        }
        if (sol) this.lastIK[side] = sol;
      }
    }
    // expressions: the packet and the clip both vote; the stronger wins
    const pm = morphFromBlend(rx && rx.blend, (n) => !!rig.av.morphs[n]);
    const morph = { ...(pose.morph || {}) };
    for (const k of Object.keys(pm)) morph[k] = Math.max(morph[k] || 0, pm[k]);
    pose.morph = morph;
    return pose;
  }
}
