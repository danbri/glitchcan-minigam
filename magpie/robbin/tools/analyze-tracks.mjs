#!/usr/bin/env node
// analyze-tracks.mjs — listen to the three soundtrack MP3s with WebAudio
// and write robbin-score.js: a MIDI-like, parameterized approximation of
// each track (tempo, key, per-bar chord loop, energy curve) that the
// in-game ScorePlayer performs live — loopable to the bar and free to
// respond to the game (intensity layers, rush-hour pace, swells).
//
//   node magpie/robbin/tools/analyze-tracks.mjs   (needs the local server
//   conventions of this repo: serves repo root on 8090, headless chromium)
//
// This is honest approximation, not transcription: onset autocorrelation
// for tempo, per-bar chroma vs 24 triad templates for harmony, chroma
// self-similarity for the loop length, RMS for the energy arc.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TRACKS = {
  engines: 'audio/the-quiet-engines.mp3',
  gears: 'audio/gears-and-birdcalls.mp3',
  passacaglia: 'audio/the-inexorable-passacaglia.mp3',
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8090/magpie/robbin/robbin.html');

const analyze = url => page.evaluate(async (u) => {
  const res = await fetch(u);
  const raw = await res.arrayBuffer();
  const off = new OfflineAudioContext(1, 1, 44100);
  const buf = await off.decodeAudioData(raw);
  // mono, decimated ×4 → 11025 Hz
  const ch = buf.numberOfChannels > 1
    ? (() => { const a = buf.getChannelData(0), b = buf.getChannelData(1), m = new Float32Array(a.length);
        for (let i = 0; i < a.length; i++) m[i] = (a[i] + b[i]) / 2; return m; })()
    : buf.getChannelData(0);
  const sr = buf.sampleRate / 4;
  const x = new Float32Array(Math.floor(ch.length / 4));
  for (let i = 0; i < x.length; i++) x[i] = ch[i * 4];

  // onset envelope: RMS flux over 23ms hops
  const HOP = 256, WIN = 512;
  const nF = Math.floor((x.length - WIN) / HOP);
  const rms = new Float32Array(nF);
  for (let i = 0; i < nF; i++) {
    let s = 0;
    for (let j = 0; j < WIN; j++) { const v = x[i * HOP + j]; s += v * v; }
    rms[i] = Math.sqrt(s / WIN);
  }
  const flux = new Float32Array(nF);
  for (let i = 1; i < nF; i++) flux[i] = Math.max(0, rms[i] - rms[i - 1]);

  // tempo 60–180 BPM by autocorrelation of the flux
  const fps = sr / HOP;
  let bestBpm = 100, bestScore = -1;
  for (let bpm = 60; bpm <= 180; bpm++) {
    const lag = Math.round(fps * 60 / bpm);
    let s = 0, n = 0;
    for (let i = 0; i + lag < nF; i++) { s += flux[i] * flux[i + lag]; n++; }
    s /= n || 1;
    if (s > bestScore) { bestScore = s; bestBpm = bpm; }
  }
  const beatLen = 60 / bestBpm;              // seconds
  const barLen = beatLen * 4;
  const nBars = Math.floor((x.length / sr) / barLen) - 1;

  // per-bar chroma via Goertzel over C2..B5
  const chroma = [];
  const energy = [];
  const goertzel = (seg, freq) => {
    const w = 2 * Math.PI * freq / sr;
    const c = 2 * Math.cos(w);
    let s0 = 0, s1 = 0, s2 = 0;
    for (let i = 0; i < seg.length; i++) { s0 = seg[i] + c * s1 - s2; s2 = s1; s1 = s0; }
    return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) / seg.length;
  };
  for (let b = 0; b < nBars; b++) {
    const i0 = Math.floor(b * barLen * sr);
    const seg = x.subarray(i0, Math.min(x.length, i0 + Math.floor(barLen * sr)));
    const c12 = new Array(12).fill(0);
    for (let midi = 36; midi < 84; midi++) {
      const fr = 440 * Math.pow(2, (midi - 69) / 12);
      c12[midi % 12] += goertzel(seg, fr);
    }
    const mx = Math.max(...c12) || 1;
    chroma.push(c12.map(v => v / mx));
    let s = 0;
    for (let i = 0; i < seg.length; i += 8) s += seg[i] * seg[i];
    energy.push(Math.sqrt(s / (seg.length / 8)));
  }

  // chord per bar: 24 triad templates
  const chordOf = c12 => {
    let best = { root: 0, minor: false, s: -1 };
    for (let r = 0; r < 12; r++) {
      for (const minor of [false, true]) {
        const third = (r + (minor ? 3 : 4)) % 12, fifth = (r + 7) % 12;
        const s = c12[r] * 1.2 + c12[third] + c12[fifth] * 0.9;
        if (s > best.s) best = { root: r, minor, s };
      }
    }
    return best;
  };
  const chords = chroma.map(chordOf);

  // loop length by chroma self-similarity over candidate cycles
  const sim = (a, b2) => { let s = 0; for (let i = 0; i < 12; i++) s += a[i] * b2[i]; return s; };
  let loop = 4, loopScore = -1;
  for (const L of [4, 8, 12, 16]) {
    if (nBars < L * 2) continue;
    let s = 0, n = 0;
    for (let i = 0; i + L < nBars; i++) { s += sim(chroma[i], chroma[i + L]); n++; }
    s /= n || 1;
    if (s > loopScore) { loopScore = s; loop = L; }
  }
  // the canonical loop: modal chord at each position of the cycle
  const cycle = [];
  for (let p = 0; p < loop; p++) {
    const tally = new Map();
    for (let i = p; i < nBars; i += loop) {
      const k = `${chords[i].root}|${chords[i].minor ? 1 : 0}`;
      tally.set(k, (tally.get(k) || 0) + 1);
    }
    const [k] = [...tally.entries()].sort((a2, b2) => b2[1] - a2[1])[0];
    const [root, m] = k.split('|').map(Number);
    cycle.push({ root, minor: !!m });
  }
  // energy arc over the cycle + overall build (start vs end thirds)
  const eCycle = new Array(loop).fill(0).map((_, p) => {
    let s = 0, n = 0;
    for (let i = p; i < nBars; i += loop) { s += energy[i]; n++; }
    return s / (n || 1);
  });
  const eMax = Math.max(...eCycle) || 1;
  const third = Math.floor(nBars / 3);
  const eStart = energy.slice(0, third).reduce((a2, b2) => a2 + b2, 0) / (third || 1);
  const eEnd = energy.slice(-third).reduce((a2, b2) => a2 + b2, 0) / (third || 1);
  // key: strongest root weighted by duration
  const keyTally = new Array(12).fill(0);
  chords.forEach((c, i) => { keyTally[c.root] += energy[i]; });
  const keyRoot = keyTally.indexOf(Math.max(...keyTally));
  const minorKey = chords.filter(c => c.root === keyRoot).filter(c => c.minor).length
    > chords.filter(c => c.root === keyRoot).length / 2;

  return {
    bpm: bestBpm,
    duration: Math.round(x.length / sr),
    bars: nBars,
    loop,
    keyRoot,
    minorKey,
    cycle,
    energy: eCycle.map(v => Math.round(v / eMax * 100) / 100),
    build: Math.round((eEnd / (eStart || 1)) * 100) / 100,
  };
}, url);

const out = {};
for (const [name, rel] of Object.entries(TRACKS)) {
  out[name] = await analyze(rel);
  console.log(name, JSON.stringify(out[name]));
}
await browser.close();

const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pretty = Object.entries(out).map(([k, v]) =>
  `//  · ${k}: ${v.bpm} BPM, ${NOTE[v.keyRoot]}${v.minorKey ? 'm' : ''}, ${v.loop}-bar loop, build ×${v.build}`).join('\n');
writeFileSync(join(ROOT, 'robbin-score.js'), `// GENERATED by tools/analyze-tracks.mjs — do not edit by hand.
// A MIDI-like, parameterized approximation of the three soundtrack
// recordings, analyzed from the audio itself (onset autocorrelation for
// tempo, per-bar chroma vs triad templates for harmony, chroma
// self-similarity for loop length, RMS for the energy arc):
${pretty}
// The ScorePlayer performs these live: loopable to the bar, responsive
// to flock size, rush hour and rescues. Approximation, not transcription.
export const SCORE = ${JSON.stringify(out, null, 1)};
`);
console.log('wrote robbin-score.js');
