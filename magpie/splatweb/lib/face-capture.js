// face-capture.js — real webcam face capture via MediaPipe Tasks
// FaceLandmarker (Apache-2.0; see catalogue.html). Loaded from CDN on
// demand — nothing heavy rides the page until the CAM button is pressed.
// Output: head quaternion + position + our 10 packet blendshape channels
// (the 52-blendshape set this maps from is the set the packet's channel
// names were taken from — see DESIGN.md §4).
//
// Frames are processed locally; no video leaves the page.
import { Vec3Euro } from './arm-filter.js';
const VERSION = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
// the FULL pose model: noticeably better 3D world landmarks than lite
// (the arm's z is what makes IK plausible), still real-time on a laptop
// GPU; heavy is available but ~3× the cost for little visible gain here
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

// 4x4 column-major → quaternion (rotation part)
function matToQuat(m) {
  const m00 = m[0], m10 = m[1], m20 = m[2],
    m01 = m[4], m11 = m[5], m21 = m[6],
    m02 = m[8], m12 = m[9], m22 = m[10];
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

// Automatic expression calibration: everyone's raw blendshape scores sit
// in a different sub-range (a resting jaw reads ~0.08, a big grin may
// only reach 0.6). Track a decaying per-channel min/max while capture
// runs and remap onto the full 0..1 range, so the avatar reaches full
// expressions calibrated to the person actually on camera.
class AutoCal {
  constructor(nCh) {
    this.min = new Float32Array(nCh).fill(0.25);
    this.max = new Float32Array(nCh).fill(0.45);
  }
  map(i, v) {
    // fast expand, slow contract — the range learns in a few seconds
    if (v < this.min[i]) this.min[i] = v; else this.min[i] += (v - this.min[i]) * 0.0004;
    if (v > this.max[i]) this.max[i] = v; else this.max[i] += (v - this.max[i]) * 0.0004;
    const lo = Math.min(this.min[i], 0.3);
    const hi = Math.max(this.max[i], lo + 0.25);
    const out = (v - lo) / (hi - lo);
    return out < 0 ? 0 : out > 1 ? 1 : out;
  }
}

export class FaceCapture {
  constructor() {
    this.active = false;
    this.cal = new AutoCal(8);   // the 8 unsigned expression channels
    this.faceSeen = false;
    this.armsSeen = false;
    this.arms = null;     // { l: {t:[x,y,z], e:[x,y,z], vis}, r: {...} } avatar-local wrist + elbow offsets
    this.torso = null;    // { yaw, pitch, roll, vis } from the shoulder/hip lines
    // OneEuro on the world landmarks we use (shoulders, elbows, wrists, hips)
    this._euro = {};
    this._lastPoseT = 0;
    this.error = null;
    this._lastVideoT = -1;
    this._out = { quat: [0, 0, 0, 1], pos: [0, 1.45, 0], blend: new Float32Array(10) };
  }

  async start(onStatus = () => {}) {
    this.error = null;
    try {
      onStatus('loading FaceLandmarker + PoseLandmarker (CDN)…');
      const { FaceLandmarker, PoseLandmarker, FilesetResolver } = await import(`${CDN}/+esm`);
      const files = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
      try { this.lm = await FaceLandmarker.createFromOptions(files, opts('GPU')); }
      catch { this.lm = await FaceLandmarker.createFromOptions(files, opts('CPU')); }
      // skeleton for the arms — optional: face capture still works without it
      const pOpts = (delegate) => ({
        baseOptions: { modelAssetPath: POSE_MODEL, delegate },
        runningMode: 'VIDEO', numPoses: 1,
      });
      try { this.pl = await PoseLandmarker.createFromOptions(files, pOpts('GPU')); }
      catch { try { this.pl = await PoseLandmarker.createFromOptions(files, pOpts('CPU')); } catch { this.pl = null; } }

      onStatus('asking for camera…');
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.muted = true;
      this.video.playsInline = true;
      await this.video.play();
      this.active = true;
    } catch (e) {
      this.error = e.name === 'NotAllowedError' ? 'camera permission denied'
        : String(e.message || e);
      this.stop();
      throw e;
    }
  }

  stop() {
    this.active = false;
    this.faceSeen = false;
    this.armsSeen = false;
    this.arms = null;
    this.torso = null;
    if (this.pl) { this.pl.close?.(); this.pl = null; }
    if (this.stream) { for (const t of this.stream.getTracks()) t.stop(); this.stream = null; }
    if (this.lm) { this.lm.close?.(); this.lm = null; }
    this.video = null;
  }

  // call once per animation frame; returns {quat, pos, blend} or null (no face)
  tick(nowMs) {
    if (!this.active || !this.video || this.video.readyState < 2) return null;
    if (this.video.currentTime === this._lastVideoT) return this.faceSeen ? this._out : null;
    this._lastVideoT = this.video.currentTime;

    let res;
    try { res = this.lm.detectForVideo(this.video, nowMs); }
    catch { return null; }
    this._tickArms(nowMs);
    this.debugFace = res.faceLandmarks?.[0] || null;
    const cats = res.faceBlendshapes?.[0]?.categories;
    const mat = res.facialTransformationMatrixes?.[0]?.data;
    if (!cats || !mat) { this.faceSeen = false; return null; }
    this.faceSeen = true;

    const o = this._out;
    o.quat = matToQuat(mat);
    // translation is centimetres in camera space; scale gently into our
    // head-sway range so the avatar shifts rather than roams
    o.pos = [
      Math.max(-0.2, Math.min(0.2, mat[12] / 100 * 0.5)),
      1.45 + Math.max(-0.1, Math.min(0.1, mat[13] / 100 * 0.5)),
      0,
    ];
    const by = {};
    for (const c of cats) by[c.categoryName] = c.score;
    const b = o.blend;
    b[0] = this.cal.map(0, by.jawOpen || 0);
    b[1] = this.cal.map(1, by.eyeBlinkLeft || 0);
    b[2] = this.cal.map(2, by.eyeBlinkRight || 0);
    b[3] = this.cal.map(3, by.browInnerUp || 0);
    b[4] = this.cal.map(4, by.mouthSmileLeft || 0);
    b[5] = this.cal.map(5, by.mouthSmileRight || 0);
    b[6] = this.cal.map(6, by.mouthPucker || 0);
    // gaze: fold the four per-eye look scores into signed x/y
    b[7] = ((by.eyeLookOutRight || 0) + (by.eyeLookInLeft || 0)
      - (by.eyeLookOutLeft || 0) - (by.eyeLookInRight || 0)) / 2;
    b[8] = ((by.eyeLookUpLeft || 0) + (by.eyeLookUpRight || 0)
      - (by.eyeLookDownLeft || 0) - (by.eyeLookDownRight || 0)) / 2;
    b[9] = this.cal.map(7, by.cheekPuff || 0);
    return o;
  }

  // PoseLandmarker world landmarks → per-arm wrist AND elbow offsets from
  // the shoulder (scaled by this person's arm length onto a nominal 0.47 m
  // reach; the viewer rescales to its avatar's own bones), plus the torso:
  // shoulder-line yaw/roll and the lean of the shoulder-mid above the
  // hip-mid. Landmarks are OneEuro-filtered first (arm-filter.js) so the
  // wire carries a steady signal rather than detector jitter.
  // NOTE: world-landmark axis signs were not verified against a live body;
  // the mirror checkbox swaps sides/flips x if it reads backwards.
  _tickArms(nowMs) {
    if (!this.pl) { this.arms = null; this.torso = null; return; }
    let res;
    try { res = this.pl.detectForVideo(this.video, nowMs); }
    catch { this.arms = null; this.torso = null; return; }
    const wl = res.worldLandmarks?.[0], il = res.landmarks?.[0];
    this.debugPose = il || null;
    if (!wl || !il) { this.armsSeen = false; this.arms = null; this.torso = null; return; }
    const dt = this._lastPoseT ? Math.min(0.2, (nowMs - this._lastPoseT) / 1000) : 0.033;
    this._lastPoseT = nowMs;
    // camera space → avatar-local: x stays, y down → up, z toward camera → back
    const P = (i) => {
      const f = this._euro[i] || (this._euro[i] = new Vec3Euro({ minCutoff: 1.0, beta: 0.08 }));
      return f.filter([wl[i].x, -wl[i].y, -wl[i].z], dt);
    };
    const vis = (...ids) => Math.min(...ids.map(i => il[i].visibility ?? 1));
    const NOMINAL = 0.47;
    const armFor = (S, E, W) => {
      const s = P(S), e = P(E), w = P(W);
      const seg = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const human = (seg(s, e) + seg(e, w)) || 0.55;
      const k = NOMINAL / human;
      return {
        t: [(w[0] - s[0]) * k, (w[1] - s[1]) * k, (w[2] - s[2]) * k],
        e: [(e[0] - s[0]) * k, (e[1] - s[1]) * k, (e[2] - s[2]) * k],
        vis: vis(S, E, W) > 0.5 ? 1 : 0,
      };
    };
    // MediaPipe indices: L shoulder/elbow/wrist 11/13/15, R 12/14/16, hips 23/24
    this.arms = { l: armFor(11, 13, 15), r: armFor(12, 14, 16) };
    this.armsSeen = this.arms.l.vis > 0 || this.arms.r.vis > 0;
    // torso: shoulder line (left − right) gives yaw + roll; hips give lean
    const ls = P(11), rs = P(12);
    const sh = [ls[0] - rs[0], ls[1] - rs[1], ls[2] - rs[2]];
    const shVis = vis(11, 12) > 0.5;
    let yaw = Math.atan2(-sh[2], Math.abs(sh[0]) + 1e-6);
    let roll = Math.atan2(sh[1], Math.abs(sh[0]) + 1e-6);
    let pitch = 0;
    if (vis(23, 24) > 0.4) {
      const lh = P(23), rh = P(24);
      const up = [(ls[0] + rs[0] - lh[0] - rh[0]) / 2, (ls[1] + rs[1] - lh[1] - rh[1]) / 2, (ls[2] + rs[2] - lh[2] - rh[2]) / 2];
      pitch = Math.atan2(-up[2], Math.abs(up[1]) + 1e-6);   // forward lean = toward camera
    }
    const clampA = (a) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, a));
    this.torso = { yaw: clampA(yaw), pitch: clampA(pitch), roll: clampA(roll), vis: shVis ? 1 : 0 };
  }
}
