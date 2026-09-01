// pose-buffer.js — receiver-side jitter buffer + interpolation + capped
// dead-reckoning extrapolation. Receiver model spec: DESIGN.md §4.
import { qSlerp, lerp } from './pose-math.js';
import { makePose } from './telemetry-codec.js';

const EXTRAP_CAP_MS = 200;   // beyond this, freeze (never animate a dead feed)

export class PoseBuffer {
  constructor({ bufferMs = 100 } = {}) {
    this.bufferMs = bufferMs;
    this.packets = [];         // sorted by tMs ascending
    this.playhead = null;      // in sender-timestamp time
    this.lastSeq = -1;
    this.stale = 0;            // packets discarded as older than playhead-1s
    this.extrapolating = false;
    this.frozen = false;
    this.out = makePose();
  }

  push(pose) {
    // clone — callers may reuse the decode target
    const p = {
      tMs: pose.tMs, seq: pose.seq,
      quat: pose.quat.slice(), pos: pose.pos.slice(),
      blend: Float32Array.from(pose.blend),
    };
    if (this.playhead !== null && p.tMs < this.playhead - 1000) { this.stale++; return; }
    // insert sorted (jitter reorders; usually appends)
    let i = this.packets.length;
    while (i > 0 && this.packets[i - 1].tMs > p.tMs) i--;
    this.packets.splice(i, 0, p);
    if (this.packets.length > 120) this.packets.splice(0, this.packets.length - 120);
    if (p.seq > this.lastSeq) this.lastSeq = p.seq;
  }

  // dtMs of real time since last sample; returns interpolated pose or null
  sample(dtMs) {
    const n = this.packets.length;
    if (n === 0) return null;
    const newest = this.packets[n - 1];
    const target = newest.tMs - this.bufferMs;
    if (this.playhead === null) this.playhead = target;
    // advance at real-time rate, slew gently toward target (no jumps)
    this.playhead += dtMs;
    this.playhead += (target - this.playhead) * 0.05;

    const t = this.playhead;
    // find bracketing packets
    let hi = 0;
    while (hi < n && this.packets[hi].tMs < t) hi++;

    if (hi >= n) {
      // past the newest — extrapolate from the last two, capped
      const over = t - newest.tMs;
      this.extrapolating = true;
      if (over > EXTRAP_CAP_MS || n < 2) { this.frozen = over > EXTRAP_CAP_MS; return this._emit(newest); }
      this.frozen = false;
      const prev = this.packets[n - 2];
      const span = Math.max(1, newest.tMs - prev.tMs);
      const f = 1 + Math.min(over, EXTRAP_CAP_MS) / span;   // >1 ⇒ extrapolate
      return this._blend(prev, newest, f);
    }
    this.extrapolating = false; this.frozen = false;
    if (hi === 0) return this._emit(this.packets[0]);
    const a = this.packets[hi - 1], b = this.packets[hi];
    const f = (t - a.tMs) / Math.max(1, b.tMs - a.tMs);
    return this._blend(a, b, f);
  }

  _blend(a, b, f) {
    const o = this.out;
    o.tMs = lerp(a.tMs, b.tMs, f); o.seq = b.seq;
    o.quat = qSlerp(a.quat, b.quat, f);
    for (let i = 0; i < 3; i++) o.pos[i] = lerp(a.pos[i], b.pos[i], f);
    // blendshapes: interpolate inside the bracket, hold when extrapolating
    // (extrapolated jaw flapping looks worse than a held mouth)
    const bf = f > 1 ? 1 : f;
    for (let i = 0; i < 10; i++) o.blend[i] = lerp(a.blend[i], b.blend[i], bf);
    return o;
  }

  _emit(p) {
    const o = this.out;
    o.tMs = p.tMs; o.seq = p.seq;
    o.quat = p.quat.slice(); o.pos = p.pos.slice();
    o.blend.set(p.blend);
    return o;
  }
}
