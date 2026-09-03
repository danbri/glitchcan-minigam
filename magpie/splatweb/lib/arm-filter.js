// arm-filter.js — the two halves of "arms that do not jump around".
//
// SENDER side: OneEuro — the standard low-latency jitter filter for
// tracked landmarks (Casiez et al. 2012): a low-pass whose cutoff rises
// with speed, so slow hands are steady and fast hands are not laggy.
// Applied to the MediaPipe world landmarks before they are quantized.
//
// VIEWER side: ArmSmoother — a critically damped spring that chases the
// telemetry wrist target with a speed ceiling (a human wrist does not
// exceed ~3 m/s in conversation), plus visibility HYSTERESIS: tracking
// that flickers in and out blends the arm between IK and the idle clip
// over a few hundred ms instead of snapping. Output: a target and a
// 0..1 weight for the IK blend.
export class OneEuro {
  constructor({ minCutoff = 1.2, beta = 0.05, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
    this.x = null; this.dx = 0;
  }
  static alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(v, dt) {
    if (this.x == null || !(dt > 0)) { this.x = v; return v; }
    const dxRaw = (v - this.x) / dt;
    const ad = OneEuro.alpha(this.dCutoff, dt);
    this.dx += (dxRaw - this.dx) * ad;
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    const a = OneEuro.alpha(cutoff, dt);
    this.x += (v - this.x) * a;
    return this.x;
  }
  reset() { this.x = null; this.dx = 0; }
}
export class Vec3Euro {
  constructor(opts) { this.f = [new OneEuro(opts), new OneEuro(opts), new OneEuro(opts)]; }
  filter(v, dt) { return [this.f[0].filter(v[0], dt), this.f[1].filter(v[1], dt), this.f[2].filter(v[2], dt)]; }
  reset() { for (const f of this.f) f.reset(); }
}

export class ArmSmoother {
  constructor({ omega = 16, maxSpeed = 3.0, fadeIn = 0.25, fadeOut = 0.45, holdMs = 250 } = {}) {
    this.omega = omega; this.maxSpeed = maxSpeed;
    this.fadeIn = fadeIn; this.fadeOut = fadeOut; this.holdMs = holdMs;
    this.p = null; this.v = [0, 0, 0];
    this.w = 0;                 // blend weight into IK
    this.lastSeen = -1e9;
    this.t = 0;
  }
  // target: [x,y,z] or null; vis: 0/1 from the packet; returns {t, w}
  update(target, vis, dt) {
    this.t += dt;
    const seen = !!target && vis > 0.5;
    if (seen) this.lastSeen = this.t;
    // hold: brief drop-outs (a packet lost, a frame with no skeleton)
    // do not start the fade-out
    const alive = seen || (this.t - this.lastSeen) * 1000 < this.holdMs;
    const wantW = alive ? 1 : 0;
    const rate = wantW > this.w ? dt / this.fadeIn : dt / this.fadeOut;
    this.w += Math.sign(wantW - this.w) * Math.min(Math.abs(wantW - this.w), rate);
    if (target) {
      if (!this.p) { this.p = target.slice(); this.v = [0, 0, 0]; }
      else {
        // critically damped spring: x'' = ω²(target − x) − 2ω x'
        const w = this.omega;
        for (let i = 0; i < 3; i++) {
          const a = w * w * (target[i] - this.p[i]) - 2 * w * this.v[i];
          this.v[i] += a * dt;
        }
        const sp = Math.hypot(this.v[0], this.v[1], this.v[2]);
        if (sp > this.maxSpeed) { const k = this.maxSpeed / sp; this.v[0] *= k; this.v[1] *= k; this.v[2] *= k; }
        for (let i = 0; i < 3; i++) this.p[i] += this.v[i] * dt;
      }
    }
    return { t: this.p, w: this.p ? this.w : 0 };
  }
}
