// face-capture.js — real webcam face capture via MediaPipe Tasks
// FaceLandmarker (Apache-2.0; see catalogue.html). Loaded from CDN on
// demand — nothing heavy rides the page until the CAM button is pressed.
// Output: head quaternion + position + our 10 packet blendshape channels
// (the 52-blendshape set this maps from is the set the packet's channel
// names were taken from — see DESIGN.md §4).
//
// Frames are processed locally; no video leaves the page.
const VERSION = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

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

export class FaceCapture {
  constructor() {
    this.active = false;
    this.faceSeen = false;
    this.error = null;
    this._lastVideoT = -1;
    this._out = { quat: [0, 0, 0, 1], pos: [0, 1.45, 0], blend: new Float32Array(10) };
  }

  async start(onStatus = () => {}) {
    this.error = null;
    try {
      onStatus('loading FaceLandmarker (CDN)…');
      const { FaceLandmarker, FilesetResolver } = await import(`${CDN}/+esm`);
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
    b[0] = by.jawOpen || 0;
    b[1] = by.eyeBlinkLeft || 0;
    b[2] = by.eyeBlinkRight || 0;
    b[3] = by.browInnerUp || 0;
    b[4] = by.mouthSmileLeft || 0;
    b[5] = by.mouthSmileRight || 0;
    b[6] = by.mouthPucker || 0;
    // gaze: fold the four per-eye look scores into signed x/y
    b[7] = ((by.eyeLookOutRight || 0) + (by.eyeLookInLeft || 0)
      - (by.eyeLookOutLeft || 0) - (by.eyeLookInRight || 0)) / 2;
    b[8] = ((by.eyeLookUpLeft || 0) + (by.eyeLookUpRight || 0)
      - (by.eyeLookDownLeft || 0) - (by.eyeLookDownRight || 0)) / 2;
    b[9] = by.cheekPuff || 0;
    return o;
  }
}
