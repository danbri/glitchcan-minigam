// pose-driver.js — simulated capture for the demos (stands in for a real
// face tracker; see DESIGN.md §6 honesty box). Two inputs blended:
//   - pointer: drag on a pad sets head yaw/pitch targets
//   - auto "performer" mode: wander, periodic blinks, talk bursts
import { qFromEuler, lerp, clamp } from './pose-math.js';
import { makePose, BLENDSHAPES } from './telemetry-codec.js';

const BI = {};
BLENDSHAPES.forEach((n, i) => { BI[n] = i; });

export class PoseDriver {
  constructor() {
    this.auto = true;
    this.talking = false;         // held button forces talk
    this.mirror = true;           // drag right → face looks screen-right (like a mirror)
    this._voice = null;           // real mic jaw level (0..1) when a VoiceJaw feeds us
    this.pose = makePose();
    this.seq = 0;
    this._yaw = 0; this._pitch = 0; this._roll = 0;
    this._tYaw = 0; this._tPitch = 0;
    this._pointerActive = false;
    this._nextBlink = 1.2;
    this._blinkPhase = 1;         // >=1 means not blinking
    this._talkUntil = 0; this._nextTalk = 2;
    this._smile = 0; this._tSmile = 0.15;
    this._t = 0;
  }

  // x, y in [-1, 1] from a pointer pad
  setPointer(x, y, active) {
    this._pointerActive = active;
    if (active) {
      this._tYaw = clamp(this.mirror ? -x : x, -1, 1) * 0.7;
      this._tPitch = clamp(y, -1, 1) * 0.45;
    }
  }
  setTalking(on) { this.talking = on; }
  setSmile(v) { this._tSmile = clamp(v, 0, 1); }
  // real mic level 0..1 overrides simulated talk; null returns to simulation
  setVoiceLevel(v) { this._voice = v; }
  setNeutral() { this._tYaw = 0; this._tPitch = 0; }

  // dt seconds; returns the current pose (same object, mutated)
  tick(dt, nowMs) {
    this._t += dt;
    const t = this._t;

    if (this.auto && !this._pointerActive) {
      // slow attention wander
      this._tYaw = Math.sin(t * 0.31) * 0.45 + Math.sin(t * 0.83 + 1.7) * 0.15;
      this._tPitch = Math.sin(t * 0.47 + 0.5) * 0.18;
    }
    // spring toward targets — this smoothing is sender-side, part of "capture"
    const k = 1 - Math.exp(-dt * 6);
    this._yaw = lerp(this._yaw, this._tYaw, k);
    this._pitch = lerp(this._pitch, this._tPitch, k);
    this._roll = lerp(this._roll, this._tYaw * -0.12, k);

    // blinks
    this._nextBlink -= dt;
    if (this._nextBlink <= 0) { this._blinkPhase = 0; this._nextBlink = 1.5 + Math.random() * 3.5; }
    let blink = 0;
    if (this._blinkPhase < 1) {
      this._blinkPhase = Math.min(1, this._blinkPhase + dt / 0.22);
      blink = Math.sin(this._blinkPhase * Math.PI);   // close then open
    }

    // talk bursts (auto) or held talk button
    if (this.auto) {
      this._nextTalk -= dt;
      if (this._nextTalk <= 0) { this._talkUntil = t + 1.2 + Math.random() * 2.2; this._nextTalk = 3 + Math.random() * 4; }
    }
    let talking = this.talking || (this.auto && t < this._talkUntil);
    let jaw = talking
      ? Math.max(0, 0.28 + 0.32 * Math.sin(t * 17) + 0.2 * Math.sin(t * 41 + 2))
      : 0.02;
    if (this._voice != null) {         // real speech energy wins over simulation
      jaw = this._voice * 0.9;
      talking = this._voice > 0.12;
    }

    this._smile = lerp(this._smile, this._tSmile, 1 - Math.exp(-dt * 3));

    const p = this.pose;
    p.tMs = nowMs >>> 0;
    p.seq = this.seq++;
    p.quat = qFromEuler(this._yaw, this._pitch, this._roll);
    p.pos = [Math.sin(t * 0.2) * 0.02, 1.45 + Math.sin(t * 0.9) * 0.008, 0];
    const b = p.blend;
    b[BI.jawOpen] = clamp(jaw, 0, 1);
    b[BI.eyeBlinkLeft] = blink;
    b[BI.eyeBlinkRight] = blink;
    b[BI.browInnerUp] = clamp(0.15 + (talking ? 0.25 * Math.sin(t * 5) : 0) - this._pitch * 0.4, 0, 1);
    b[BI.mouthSmileLeft] = this._smile;
    b[BI.mouthSmileRight] = this._smile * 0.92;
    b[BI.mouthPucker] = talking ? clamp(0.2 * Math.sin(t * 13 + 1), 0, 1) : 0;
    b[BI.eyeLookX] = clamp(this._tYaw * -0.8, -1, 1);
    b[BI.eyeLookY] = clamp(this._tPitch * -0.8, -1, 1);
    b[BI.cheekPuff] = 0;
    return p;
  }
}

// Wire a <div>/<canvas> pad to a driver; returns an unbind function.
export function bindPointerPad(el, driver) {
  const toXY = (e) => {
    const r = el.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1];
  };
  let down = false;
  const move = (e) => { if (down) { const [x, y] = toXY(e); driver.setPointer(x, y, true); } };
  const start = (e) => { down = true; el.setPointerCapture?.(e.pointerId); move(e); };
  const end = () => { down = false; driver.setPointer(0, 0, false); };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  return () => {
    el.removeEventListener('pointerdown', start);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', end);
    el.removeEventListener('pointercancel', end);
  };
}
