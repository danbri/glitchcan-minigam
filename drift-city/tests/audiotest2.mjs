import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { OfflineAudioContext } = require('node-web-audio-api');
const fs = require('fs');
globalThis.setTimeout = (f, ms) => { const at = off.currentTime + ms / 1000; pend.push([at, f]); };
const pend = [];
const sr = 44100, secs = 36;
const off = new OfflineAudioContext(2, sr * secs, sr);
globalThis.AudioContext = function () { return off; };
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
// main.js globals that audio.js reads (the walkers' footfalls, the Morse key)
globalThis.FEET = { list: [] };
globalThis.MORSE = { key: 0 };
setInterval && 0;
const clampv = (v, a, b) => Math.min(b, Math.max(a, v));
const A = new Function('clampv', fs.readFileSync(process.env.AUDIO || new URL('../src/audio.js', import.meta.url), 'utf8') + '; return { AU, audioInit, audioStep, audioListener, audioBang, audioChime, audioCity, voice: typeof audioVoice === "function" ? audioVoice : null };')(clampv);
A.audioInit();
const street = { sidewalks: [[10, 0.8, 5], [-12, 0.8, -8], [6, 0.8, -15]], busy: [[10, 1.6, 5]], persons: [[3, 1.6, 6], [-4, 1.6, 7]], tubeLines: [[0, 11, 0, 0, 1], [0, 11, 0, 1, 0]],
  flocks: [[30, 45, -20], [-80, 60, 40]], market: [8, 3, 12], pagoda: [-40, 16, 30], radios: [[4, 1.2, 6, 0], [-5, 1.2, 8, 2], [20, 9, -10]], lamps: [[6, 3.6, 4]], cable: [9.95, 4.4, 3], dorm: [40, 14, -30] };
const wild = { water: [25, 0, 10], cold: [60, -5, 30], flocks: [[50, 40, 0]] };
const world = (t) => {
  if (t < 12) return { mode: 'surface', alt: 1.7, people: 0.8, tubes: 0.9, flierDist: 35, story: 0.7, tod: 2, snow: 0, speed: 0, places: street };
  if (t < 24) return { mode: 'surface', alt: 3, people: 0, tubes: 0, flierDist: 55, story: 0, tod: 2, snow: 0, speed: 15, places: wild };
  return { mode: 'space', alt: 1e6, people: 0, tubes: 0, flierDist: 1e9, story: 0, tod: 2, snow: 0, speed: 0, places: {} };
};
const fired = {};
const origs = {};
for (let t = 0.05; t < secs; t += 0.05) {
  const tt = t;
  off.suspend(tt).then(() => {
    // turn slowly on the spot, so the scene moves around us
    const a = tt * 0.2;
    A.audioListener([0, 1.7, 0], [Math.cos(a), 0, Math.sin(a)], [0, 1, 0]);
    const b = Object.assign({}, A.AU.t);
    A.audioStep(0.05, world(tt)); A.audioCity(0.05, world(tt)); if (Math.abs(tt - 2) < 0.026) { A.AU.t.horn = 0; A.AU.t.pa = 0; A.AU.t.spinner = 0; }
    for (const k of Object.keys(A.AU.t)) if (A.AU.t[k] > (b[k] ?? -9) + 0.3) { const key = Math.floor(tt / 12) + ':' + k; fired[key] = (fired[key] || 0) + 1; }
    if (Math.abs(tt - 5) < 0.026) A.audioBang([400, 200, -300], false);
    if (A.voice && Math.abs(tt - 3) < 0.026) { A.voice('wren', 14, [3, 1.6, 6]); A.voice('castellane', 12, null); A.voice('you', 5, null); }
    for (let i = pend.length - 1; i >= 0; i--) if (pend[i][0] <= tt) { const f = pend[i][1]; pend.splice(i, 1); f(); }
    off.resume();
  });
}
const buf = await off.startRendering();
if (process.env.WAV) { const n = buf.length, d = Buffer.alloc(44 + n * 4); d.write('RIFF', 0); d.writeUInt32LE(36 + n * 4, 4); d.write('WAVEfmt ', 8); d.writeUInt32LE(16, 16); d.writeUInt16LE(1, 20); d.writeUInt16LE(2, 22); d.writeUInt32LE(sr, 24); d.writeUInt32LE(sr * 4, 28); d.writeUInt16LE(4, 32); d.writeUInt16LE(16, 34); d.write('data', 36); d.writeUInt32LE(n * 4, 40); const a = buf.getChannelData(0), b = buf.getChannelData(1); for (let i = 0; i < n; i++) { d.writeInt16LE(Math.max(-32767, Math.min(32767, a[i] * 32767)), 44 + i * 4); d.writeInt16LE(Math.max(-32767, Math.min(32767, b[i] * 32767)), 46 + i * 4); } fs.writeFileSync(process.env.WAV, d); }
const L = buf.getChannelData(0), R = buf.getChannelData(1);
const names = ['night street', 'wild shore', 'space'];
for (let s = 0; s < 3; s++) {
  let sum = 0, peak = 0, sl = 0, srr = 0, nan = 0;
  for (let i = s * 12 * sr + sr; i < (s + 1) * 12 * sr; i++) { if (!isFinite(L[i]) || !isFinite(R[i])) { nan++; continue; } const v = (L[i] + R[i]) * 0.5; sum += v * v; sl += L[i] * L[i]; srr += R[i] * R[i]; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  const rms = Math.sqrt(sum / (11 * sr));
  const ev = Object.entries(fired).filter(([k]) => k.startsWith(s + ':')).map(([k, v]) => k.split(':')[1] + ' ' + v).join(', ');
  console.log(names[s].padEnd(12), 'loudness', (20 * Math.log10(rms + 1e-9)).toFixed(1), 'dBFS, peak', (20 * Math.log10(peak + 1e-9)).toFixed(1), '| left/right', (10 * Math.log10(sl / (srr + 1e-12))).toFixed(1), 'dB | bad samples', nan, '| events:', ev);
}
console.log('radios', A.AU.radios.length, 'stations', A.AU.radios.map((r) => r.st + '/' + r.seg).join(' '), '| loops', Object.keys(A.AU.src).join(' '));
