// network-sim.js — a lossy channel in one page: latency + jitter + loss.
// Models an unreliable, unordered RTCDataChannel (DESIGN.md §3). Jitter can
// reorder packets naturally; the receiver's seq/timestamp handling must cope.
export class NetworkSim {
  constructor({ latencyMs = 80, jitterMs = 30, lossPct = 5 } = {}) {
    this.latencyMs = latencyMs;
    this.jitterMs = jitterMs;
    this.lossPct = lossPct;
    this.queue = [];            // { due, payload }
    this.sent = 0; this.dropped = 0; this.delivered = 0;
    this.bytesSent = 0;
    this._rateWindow = [];      // [tMs, bytes] for kbps readout
  }

  send(payload, nowMs) {
    this.sent++;
    this.bytesSent += payload.byteLength;
    this._rateWindow.push([nowMs, payload.byteLength]);
    if (Math.random() * 100 < this.lossPct) { this.dropped++; return; }
    const due = nowMs + this.latencyMs + Math.random() * this.jitterMs;
    this.queue.push({ due, payload });
  }

  // returns array of payloads due by nowMs (possibly out of order — kept so)
  drain(nowMs) {
    const out = [];
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].due <= nowMs) {
        out.push(this.queue.splice(i, 1)[0].payload);
      }
    }
    this.delivered += out.length;
    return out;
  }

  kbps(nowMs) {
    const cutoff = nowMs - 2000;
    while (this._rateWindow.length && this._rateWindow[0][0] < cutoff) this._rateWindow.shift();
    const bytes = this._rateWindow.reduce((a, r) => a + r[1], 0);
    return (bytes * 8) / 2000;  // over the 2 s window
  }

  lossActualPct() { return this.sent ? (100 * this.dropped / this.sent) : 0; }
}
