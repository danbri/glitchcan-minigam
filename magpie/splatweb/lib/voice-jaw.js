// voice-jaw.js — real speech energy from the microphone via Web Audio,
// mapped to a jawOpen level. This is genuine capture (unlike the simulated
// pose driver): RMS energy, a noise gate, fast attack / slower release.
// Nothing is recorded and no audio leaves the page.
export class VoiceJaw {
  constructor() {
    this.active = false;
    this.level = 0;         // 0..1 smoothed jaw level
    this.error = null;
  }

  async start() {
    this.error = null;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      this.ctx = new AudioContext();
      await this.ctx.resume();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);
      this.buf = new Float32Array(this.analyser.fftSize);
      this.active = true;
    } catch (e) {
      this.error = e.name === 'NotAllowedError' ? 'microphone permission denied' : String(e.message || e);
      this.stop();
      throw e;
    }
  }

  stop() {
    this.active = false;
    this.level = 0;
    if (this.stream) { for (const t of this.stream.getTracks()) t.stop(); this.stream = null; }
    if (this.ctx) { this.ctx.close(); this.ctx = null; }
  }

  // dt in seconds; returns the smoothed jaw level 0..1
  tick(dt) {
    if (!this.active) return 0;
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    const rms = Math.sqrt(sum / this.buf.length);
    const gated = Math.max(0, rms - 0.012);          // noise gate
    const target = Math.min(1, gated * 9);
    const k = target > this.level ? 1 - Math.exp(-dt * 35) : 1 - Math.exp(-dt * 9);
    this.level += (target - this.level) * k;
    return this.level;
  }
}
