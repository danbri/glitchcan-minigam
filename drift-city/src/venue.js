// ---------- music in the venues: played live, a different band in each room ----------
// When you stand in a venue's room (roomNow in tales.js), its music fades in and the street outside drops to a murmur
// through the walls (AU.outside). Nothing is recorded or sampled: every note is synthesised here with Web Audio and
// scheduled a quarter of a second ahead, from chord changes and simple rules for each player.
//   1 the Cold Tap: a jukebox in the corner, a slow soul-blues shuffle through a small speaker.
//   2 the Low Orbit: lounge for ship crews, electric piano and a soft bossa pulse from the ceiling speakers.
//   3 the Lantern Cellar: the late jam, live and loud: swing ride, brushes, walking bass, piano comping, a tenor
//     improvising in phrases.
//   4 the Warmhouse club: a piano trio playing a ballad before the set, in a big warm room.
// How it is built and how to change it: the drift-city skill, "Music in the venues".
const VENUE = { k: 0, out: null, g: null, verb: null, next: 0, beat: 0, bar: 0, lead: null, style: null,
  nb: 0, marks: [], gapFrom: -1, gapUntil: -1, bpmMul: 1, crowd: null, cNext: 0 };
// Tunes end. Each style plays `tune` bars, then stops for `gap` seconds: the room claps (`clap`, 0 for the jukebox,
// which only changes its record), the talk comes up, and the live bands count the next one in. The next tune is a
// little faster or slower. Owner, September 2026: the rooms were "eerily empty"; music that never breathes, no crowd
// and no applause were a large part of that.
const VENUE_SHAPE = { 1: { tune: 24, gap: 3, clap: 0 }, 2: { tune: 32, gap: 5, clap: 0.35 }, 3: { tune: 48, gap: 6, clap: 0.9 }, 4: { tune: 32, gap: 7, clap: 0.75 } };
// the players on the stand, in the room's own axes (x forward from the door, z to the right, y up from the floor):
// [x, y, z, facing (0 = toward the far end, pi/2 = to the right), hue, pose (propPerson: 0 stand, 2 sit, 4 drums)]
const ROOM_BAND = {
  3: [[12.4, 0.3, 0.15, 1.57, 0.62, 4], [12.75, 0.3, -1.05, 3.14, 0.08, 0], [11.65, 0.3, -0.2, 3.14, 0.35, 0]],
  4: [[24.6, 0.7, 1.75, 1.57, 0.7, 4], [23.75, 0.7, 1.15, 3.14, 0.15, 0], [24.05, 0.7, -2.8, 0.0, 0.9, 2]],
};
function roomBand(R, out) {
  for (const m of ROOM_BAND[R.room] || []) {
    const c = Math.cos(R.yaw), s = Math.sin(R.yaw);
    out.push({ kind: 0, x: R.x + c * m[0] - s * m[2], y: R.y - 1.7 + m[1], z: R.z + s * m[0] + c * m[2], rot: Math.PI / 2 - (R.yaw + m[3]), scale: 1, hue: m[4], param: m[5] });
  }
}
// the crowd, from three two-second recordings (audio/crowd, ElevenLabs sound effects): grains of about a second from
// random points, at slightly different speeds, overlapping, panned about; level while the band plays and between tunes
const VENUE_CROWD = { 1: { set: ["bar-a", "bar-b"], lvl: 0.5, play: 0.9 }, 2: { set: ["bar-b", "club"], lvl: 0.38, play: 0.85 },
  3: { set: ["bar-a", "bar-b", "club"], lvl: 0.55, play: 0.8 }, 4: { set: ["club", "bar-b"], lvl: 0.5, play: 0.35 } };
const CROWD_BUF = {};
function crowdLoad() {
  if (CROWD_BUF.asked || typeof fetch !== "function") return;
  CROWD_BUF.asked = true;
  for (const n of ["bar-a", "bar-b", "club", "applause"]) {
    fetch("../audio/crowd/" + n + ".mp3").then((r) => r.arrayBuffer()).then((b) => AU.ctx.decodeAudioData(b)).then((d) => { CROWD_BUF[n] = d; }).catch(() => {});
  }
}
function crowdGrain(t, lvl) {
  const set = VENUE_CROWD[VENUE.k].set.map((n) => CROWD_BUF[n]).filter(Boolean);
  if (!set.length || !VENUE.crowd) return;
  const c = AU.ctx, buf = set[Math.floor(Math.random() * set.length)], d = Math.min(1.0, buf.duration * 0.5);
  const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = rr(0.9, 1.1);
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + d * 0.35); g.gain.setValueAtTime(lvl, t + d * 0.65); g.gain.linearRampToValueAtTime(0, t + d);
  let last = g;
  if (c.createStereoPanner) { const pn = c.createStereoPanner(); pn.pan.value = rr(-0.7, 0.7); g.connect(pn); last = pn; }
  src.connect(g); last.connect(VENUE.crowd);
  src.start(t, Math.random() * (buf.duration - d - 0.02)); src.stop(t + d + 0.05);
}
function crowdClap(t, lvl) {
  const buf = CROWD_BUF.applause;
  if (!buf || !VENUE.crowd || lvl <= 0) return;
  for (const [dt, rate, v] of [[0, 1, 1], [0.35, 0.93, 0.7]]) {
    const src = AU.ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = AU.ctx.createGain(); g.gain.value = lvl * v; src.connect(g); g.connect(VENUE.crowd); src.start(t + dt);
  }
}
// the band's position for the lights and the people (main.js puts it in ev.wx.w): beats since the room began, while a
// tune plays; -1 to -2 through the break between tunes. Without sound, the same shape runs on the page's clock.
function venueBand(k, clock) {
  const Sh = VENUE_SHAPE[k], S = VENUE_STYLES[k];
  if (!Sh) return -1;
  if (typeof AU !== "undefined" && AU.ready && AU.on && VENUE.out && VENUE.k === k) {
    const now = AU.ctx.currentTime;
    if (now >= VENUE.gapFrom && now < VENUE.gapUntil) return -1 - (now - VENUE.gapFrom) / (VENUE.gapUntil - VENUE.gapFrom);
    let m = null;
    for (const x of VENUE.marks) if (x[0] <= now) m = x;
    return m ? (m[1] + (now - m[0]) / m[2]) % 512 : -1;
  }
  const tl = Sh.tune * S.beats * 60 / S.bpm, ph = clock % (tl + Sh.gap);
  return ph < tl ? (ph * S.bpm / 60) % 512 : -1 - (ph - tl) / Sh.gap;
}
const VENUE_STYLES = {
  1: { bpm: 70, swing: 0.67, beats: 4, key: 55, verb: 0.7, chords: [[0, "7"], [0, "7"], [0, "7"], [0, "7"], [5, "7"], [5, "7"], [0, "7"], [0, "7"], [7, "7"], [5, "7"], [0, "7"], [7, "7"]],
    parts: { bass: "two", keys: "organ", drums: "shuffle", lead: "guitar" }, lead: [52, 74], phrase: 0.55, radio: true },
  2: { bpm: 84, swing: 0.5, beats: 4, key: 50, verb: 1.3, chords: [[0, "maj7"], [0, "maj7"], [5, "maj7"], [5, "maj7"], [9, "m9"], [2, "m9"], [7, "9"], [7, "9"]],
    parts: { bass: "bossa", keys: "epiano", drums: "bossa", lead: "vibes" }, lead: [62, 84], phrase: 0.35 },
  3: { bpm: 132, swing: 0.66, beats: 4, key: 58, verb: 0.9, chords: [[2, "m7"], [7, "7"], [0, "maj7"], [0, "maj7"], [2, "m7"], [7, "7"], [0, "maj7"], [9, "7"], [2, "m7"], [7, "7"], [4, "m7"], [9, "7"], [2, "m7"], [7, "7"], [0, "maj7"], [0, "maj7"]],
    parts: { bass: "walk", keys: "comp", drums: "swing", lead: "sax" }, lead: [49, 75], phrase: 0.75 },
  4: { bpm: 64, swing: 0.6, beats: 4, key: 51, verb: 2.4, chords: [[0, "maj7"], [9, "m7"], [2, "m7"], [7, "7"], [4, "m7"], [9, "7"], [2, "m7"], [7, "7"]],
    parts: { bass: "two", keys: "ballad", drums: "brushes", lead: "piano" }, lead: [67, 86], phrase: 0.6 },
};
const VENUE_Q = { maj7: [0, 4, 7, 11, 14], m7: [0, 3, 7, 10, 14], m9: [0, 3, 7, 10, 14], 7: [0, 4, 7, 10, 14], 9: [0, 4, 7, 10, 14] };
// the scale an improviser uses over each kind of chord
const VENUE_SCALE = { maj7: [0, 2, 4, 7, 9, 11], m7: [0, 2, 3, 5, 7, 9, 10], m9: [0, 2, 3, 5, 7, 9, 10], 7: [0, 2, 3, 4, 7, 9, 10], 9: [0, 2, 4, 5, 7, 9, 10] };
const vHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function venueIR(c, secs, bright) {
  const len = Math.floor(c.sampleRate * secs), ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; lp += (w - lp) * bright; d[i] = lp * Math.pow(1 - i / len, 3); }
  }
  return ir;
}
// the room's sound: a gain to fade the whole band, its own reverb, and for the jukebox a small speaker's band
function venueBuild(k) {
  const c = AU.ctx, S = VENUE_STYLES[k];
  if (VENUE.out) { const o = VENUE.out; o.gain.setTargetAtTime(0, c.currentTime, 0.3); setTimeout(() => o.disconnect(), 2000); }
  const out = c.createGain(); out.gain.value = 0; out.connect(AU.master);
  const g = c.createGain(); g.gain.value = 1;
  let last = g;
  if (S.radio) {
    const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 170;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3600;
    const sh = c.createWaveShaper(), cv = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; cv[i] = Math.tanh(x * 1.8) * 0.8; }
    sh.curve = cv;
    g.connect(hp); hp.connect(sh); sh.connect(lp); last = lp;
  }
  last.connect(out);
  const crowd = c.createGain(); crowd.gain.value = 1; crowd.connect(out);
  crowdLoad();
  const verb = c.createConvolver(); verb.buffer = venueIR(c, S.verb, k === 4 ? 0.35 : 0.6);
  const send = c.createGain(); send.gain.value = k === 4 ? 0.5 : 0.3;
  last.connect(send); send.connect(verb); verb.connect(out);
  Object.assign(VENUE, { k, out, g, crowd, style: S, next: c.currentTime + 0.3, beat: 0, bar: 0, lead: null, marks: [], gapFrom: -1, gapUntil: -1, bpmMul: 1, cNext: c.currentTime });
}
// ---------- the players' instruments ----------
function vEnv(g, t, a, peak, tau, end) {
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0, t + a, tau);
  return end;
}
function vOsc(type, f, t, end, dest) { const o = AU.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(dest); o.start(t); o.stop(end); return o; }
function vNoise(t, end, dest) { const s = AU.ctx.createBufferSource(); s.buffer = AU.white; s.loop = true; s.connect(dest); s.start(t, Math.random() * 2); s.stop(end); return s; }
function vFilt(type, f, q, dest) { const b = AU.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; }
function vGain(dest) { const g = AU.ctx.createGain(); g.gain.value = 0; g.connect(dest); return g; }
// an upright bass: a round low pluck with a little thump at the front
function vBass(t, m, d, v) {
  const G = VENUE.g, g = vGain(G), f = vHz(m), end = t + d + 0.4;
  vEnv(g, t, 0.008, 0.5 * v, Math.max(0.18, d * 0.55), end);
  const lp = vFilt("lowpass", 700, 0.8, g);
  vOsc("triangle", f, t, end, lp); vOsc("sine", f, t, end, g);
  const k = vGain(G); vEnv(k, t, 0.002, 0.12 * v, 0.02, t + 0.1); vNoise(t, t + 0.1, vFilt("lowpass", 900, 1, k));
}
// an electric piano: a sine struck by a sine (FM), the bell fading faster than the tone
function vEP(t, m, d, v) {
  const c = AU.ctx, G = VENUE.g, g = vGain(G), f = vHz(m), end = t + d + 1.2;
  vEnv(g, t, 0.004, 0.13 * v, 0.9, end);
  const car = c.createOscillator(); car.frequency.value = f;
  const mod = c.createOscillator(); mod.frequency.value = f;
  const mg = c.createGain(); mg.gain.setValueAtTime(f * 2.2, t); mg.gain.setTargetAtTime(f * 0.25, t, 0.25);
  mod.connect(mg); mg.connect(car.frequency); car.connect(g);
  car.start(t); mod.start(t); car.stop(end); mod.stop(end);
}
// an acoustic piano: a few stretched partials, the higher ones dying first, and a hammer's knock
function vPiano(t, m, d, v) {
  const G = VENUE.g, f = vHz(m), end = t + Math.max(d, 1.2) + 1.5;
  [[1, 1, 1.6], [2.003, 0.45, 0.9], [3.009, 0.22, 0.55], [4.02, 0.12, 0.35]].forEach(([h, a, tau]) => {
    const g = vGain(G); vEnv(g, t, 0.003, 0.11 * v * a, tau * Math.min(1.6, 300 / f + 0.6), end); vOsc("sine", f * h, t, end, g);
  });
  const k = vGain(G); vEnv(k, t, 0.001, 0.03 * v, 0.015, t + 0.06); vNoise(t, t + 0.06, vFilt("bandpass", 2500, 1, k));
}
// an organ, for the jukebox record: drawbars, a slow swell
function vOrgan(t, m, d, v) {
  const G = VENUE.g, g = vGain(G), f = vHz(m), end = t + d + 0.3;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 * v, t + 0.05); g.gain.setValueAtTime(0.05 * v, t + d); g.gain.linearRampToValueAtTime(0, t + d + 0.2);
  [1, 2, 3, 4].forEach((h, i) => { const hg = vGain(g); hg.gain.value = [1, 0.6, 0.35, 0.2][i]; vOsc("sine", f * h, t, end, hg); });
}
// a tenor saxophone: a sawtooth through a breathy formant, the vibrato growing into long notes
function vSax(t, m, d, v) {
  const c = AU.ctx, G = VENUE.g, g = vGain(G), f = vHz(m), end = t + d + 0.12;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09 * v, t + 0.035); g.gain.setValueAtTime(0.08 * v, t + d); g.gain.linearRampToValueAtTime(0, t + d + 0.1);
  const lp = vFilt("lowpass", 1400 + 1800 * v, 0.7, g), bp = vFilt("peaking", 1100, 1.4, lp); bp.gain.value = 8;
  const o = vOsc("sawtooth", f, t, end, bp);
  if (d > 0.3) {
    const lfo = c.createOscillator(); lfo.frequency.value = 5.3;
    const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + d);
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(end);
  }
  o.frequency.setValueAtTime(f * 0.985, t); o.frequency.linearRampToValueAtTime(f, t + 0.04);
  const bg = vGain(G); vEnv(bg, t, 0.02, 0.012 * v, 0.08, t + 0.3); vNoise(t, t + 0.3, vFilt("bandpass", 2400, 0.8, bg));
}
// a guitar on the record: a quick bright pluck
function vGuitar(t, m, d, v) {
  const G = VENUE.g, g = vGain(G), f = vHz(m), end = t + d + 0.5;
  vEnv(g, t, 0.003, 0.09 * v, Math.max(0.15, d * 0.6), end);
  const lp = vFilt("lowpass", 2600, 2, g); lp.frequency.setValueAtTime(4200, t); lp.frequency.setTargetAtTime(1200, t, 0.15);
  vOsc("sawtooth", f, t, end, lp); vOsc("square", f * 1.003, t, end, vFilt("lowpass", 1500, 0.5, lp));
}
// vibraphone: a pure bar with a slow tremolo
function vVibes(t, m, d, v) {
  const c = AU.ctx, G = VENUE.g, g = vGain(G), f = vHz(m), end = t + d + 1.6;
  vEnv(g, t, 0.002, 0.07 * v, 1.1, end);
  const tr = c.createGain(); tr.gain.value = 0.7; tr.connect(g);
  const lfo = c.createOscillator(); lfo.frequency.value = 5.5; const lg = c.createGain(); lg.gain.value = 0.3; lfo.connect(lg); lg.connect(tr.gain); lfo.start(t); lfo.stop(end);
  vOsc("sine", f, t, end, tr); const h = vGain(tr); vEnv(h, t, 0.002, 0.25, 0.15, end); vOsc("sine", f * 4, t, end, h);
}
function vDrum(kind, t, v) {
  const G = VENUE.g, g = vGain(G);
  if (kind === "ride") { vEnv(g, t, 0.002, 0.05 * v, 0.35, t + 1.2); const bp = vFilt("bandpass", 7200, 1.2, g); vNoise(t, t + 1.2, bp); [3160, 4830, 5920].forEach((f) => { const q = vGain(bp); q.gain.value = 0.4; vOsc("square", f * rr(0.99, 1.01), t, t + 1.2, q); }); }
  else if (kind === "hat") { vEnv(g, t, 0.001, 0.05 * v, 0.03, t + 0.15); vNoise(t, t + 0.15, vFilt("highpass", 7500, 0.7, g)); }
  else if (kind === "brush") { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045 * v, t + 0.06); g.gain.setTargetAtTime(0, t + 0.07, 0.09); vNoise(t, t + 0.5, vFilt("bandpass", 3200, 0.6, g)); }
  else if (kind === "snare") { vEnv(g, t, 0.001, 0.12 * v, 0.07, t + 0.35); vNoise(t, t + 0.35, vFilt("bandpass", 2200, 0.8, g)); const b = vGain(G); vEnv(b, t, 0.001, 0.08 * v, 0.04, t + 0.2); vOsc("triangle", 190, t, t + 0.2, b); }
  else if (kind === "kick") { vEnv(g, t, 0.002, 0.35 * v, 0.12, t + 0.5); const o = vOsc("sine", 95, t, t + 0.5, g); o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.2); }
  else if (kind === "rim") { vEnv(g, t, 0.001, 0.06 * v, 0.02, t + 0.1); vOsc("triangle", 1700, t, t + 0.1, g); vNoise(t, t + 0.05, vFilt("bandpass", 3000, 2, g)); }
}
// ---------- the players ----------
function vChordTones(ch, base) { return VENUE_Q[ch[1]].map((i) => base + ch[0] + i); }
function vNear(m, lo, hi) { while (m < lo) m += 12; while (m > hi) m -= 12; return m; }
// one beat of the band: t is its start, b its number in the bar, B the beat length in seconds
function venueBeat(t, b, B) {
  const S = VENUE.style, P = S.parts, ch = S.chords[VENUE.bar % S.chords.length], nx = S.chords[(VENUE.bar + 1) % S.chords.length];
  const off = t + B * S.swing, hum = () => rr(-0.008, 0.008);
  const root = vNear(S.key - 24 + ch[0], 33, 45), tones = vChordTones(ch, S.key - 12);
  // bass
  if (P.bass === "walk") {
    let m = root;
    if (b === 1) m = vNear(root + pick([VENUE_Q[ch[1]][1], 7, 9]), 33, 50);
    if (b === 2) m = vNear(root + 7, 33, 50);
    if (b === 3) { const nr = vNear(S.key - 24 + nx[0], 33, 45); m = nr + (Math.random() < 0.5 ? -1 : 1); }
    vBass(t + hum(), m, B * 0.9, b === 0 ? 1 : 0.8);
  } else if (P.bass === "two") { if (b === 0 || b === 2) vBass(t + hum(), b === 0 ? root : vNear(root + 7, 33, 50), B * 1.8, 0.9); }
  else if (P.bass === "bossa") { if (b === 0) vBass(t, root, B * 1.4, 0.8); if (b === 1) vBass(t + B * 0.5, vNear(root + 7, 33, 50), B * 0.4, 0.6); if (b === 2) vBass(t, vNear(root + 7, 33, 50), B * 1.4, 0.8); if (b === 3) vBass(t + B * 0.5, root, B * 0.4, 0.6); }
  // drums
  if (P.drums === "swing") {
    vDrum("ride", t + hum(), b % 2 ? 0.8 : 1);
    if (b % 2) { vDrum("hat", t, 0.7); if (Math.random() < 0.5) vDrum("ride", off, 0.55); }
    if (Math.random() < 0.18) vDrum("snare", off, rr(0.2, 0.45));
    if (b === 0 && Math.random() < 0.3) vDrum("kick", t, 0.3);
  } else if (P.drums === "brushes") { vDrum("brush", t, b % 2 ? 0.9 : 0.6); if (b % 2) vDrum("hat", t, 0.35); }
  else if (P.drums === "shuffle") { vDrum("hat", t, 0.6); vDrum("hat", off, 0.4); if (b % 2) vDrum("snare", t, 0.5); else vDrum("kick", t, 0.6); }
  else if (P.drums === "bossa") { vDrum("hat", t, 0.35); vDrum("hat", t + B * 0.5, 0.25); if ([0, 3].includes(b) || (b === 1 && VENUE.bar % 2)) vDrum("rim", t + (b === 1 ? B * 0.5 : 0), 0.5); if (b === 0 || b === 2) vDrum("kick", t, 0.35); }
  // chords
  const voicing = [tones[1], tones[3], tones[4]].map((m) => vNear(m, 55, 70)).sort((a, c) => a - c);
  if (P.keys === "comp") {
    // Charleston and anticipations: a stab on 1, on the "and" of 2, sometimes on 4's "and" to the next chord
    if ((b === 0 && Math.random() < 0.6) || (b === 1 && Math.random() < 0.55) || (b === 3 && Math.random() < 0.25)) {
      const at = b === 0 ? t : off, dd = B * rr(0.3, 0.6);
      voicing.forEach((m) => vPiano(at + hum(), m, dd, rr(0.45, 0.7)));
    }
  } else if (P.keys === "epiano") { if (b === 0 || (b === 2 && Math.random() < 0.5)) voicing.forEach((m, i) => vEP(t + i * 0.012, m, B * 1.8, 0.8)); }
  else if (P.keys === "organ") { if (b === 0) voicing.forEach((m) => vOrgan(t, m, B * 3.8, 0.8)); }
  else if (P.keys === "ballad") { if (b === 0) [...voicing, vNear(root + 12, 40, 52)].forEach((m, i) => vPiano(t + i * 0.03, m, B * 3.5, 0.55)); if (b === 2 && Math.random() < 0.5) voicing.forEach((m) => vPiano(t, m, B * 1.5, 0.35)); }
  // the lead: phrases with rests between, chord tones on the strong beats, steps between them
  venueLead(t, b, B, ch, off);
}
function venueLead(t, b, B, ch, off) {
  const S = VENUE.style, L = VENUE.lead || (VENUE.lead = { m: Math.round((S.lead[0] + S.lead[1]) / 2), rest: 2, left: 0 });
  if (b === 0) {
    if (L.left <= 0 && L.rest <= 0) { L.left = Math.floor(rr(4, 12)); if (Math.random() > S.phrase) { L.rest = Math.floor(rr(2, 6)); L.left = 0; } }
    else if (L.left <= 0) L.rest--;
  }
  if (L.left <= 0) return;
  const play = (at, dur, strong) => {
    const sc = VENUE_SCALE[ch[1]], ct = VENUE_Q[ch[1]].slice(0, 4);
    const set = (strong ? ct : sc).map((i) => S.key + ch[0] + i);
    // move to the nearest note of the set in a chosen direction, a step or a leap
    const dir = L.m > S.lead[1] - 4 ? -1 : L.m < S.lead[0] + 4 ? 1 : Math.random() < 0.5 ? -1 : 1;
    let best = L.m, bd = 99;
    for (let o = -2; o <= 2; o++) for (const p of set) { const m = p + o * 12, dd = (m - L.m) * dir; if (dd > 0 && dd < bd && m >= S.lead[0] && m <= S.lead[1]) { bd = dd; best = m; } }
    L.m = best;
    const inst = { sax: vSax, guitar: vGuitar, vibes: vVibes, piano: vPiano }[S.parts.lead];
    inst(at + rr(-0.01, 0.015), L.m, dur, strong ? rr(0.75, 1) : rr(0.5, 0.8));
  };
  const r = Math.random();
  if (S.parts.lead === "sax" && r < 0.55) { play(t, B * S.swing * 0.95, true); play(off, B * (1 - S.swing) * 0.9, false); }
  else if (r < 0.8) play(t, B * rr(0.8, 1.9), b % 2 === 0);
  L.left -= 1 / S.beats;
}
// each frame: fade the band in or out with the room, and keep a quarter of a second of notes scheduled
function venueStep() {
  if (!AU.ready || !AU.on || !AU.outside) return;
  const c = AU.ctx, now = c.currentTime, R = typeof roomNow === "function" ? roomNow() : null, k = R ? R.room : 0;
  AU.outside.gain.setTargetAtTime(k ? 0.22 : 1, now, 0.6);
  if (k && k !== VENUE.k) venueBuild(k);
  if (!VENUE.out) return;
  VENUE.out.gain.setTargetAtTime(k ? (k === 1 ? 0.45 : 0.55) : 0, now, k ? 0.8 : 0.4);
  if (!k) { if (VENUE.out.gain.value < 0.01) { VENUE.out.disconnect(); VENUE.out = null; VENUE.k = 0; } return; }
  const S = VENUE.style, Sh = VENUE_SHAPE[k], C = VENUE_CROWD[k];
  let B = 60 / (S.bpm * VENUE.bpmMul);
  if (VENUE.next < now) VENUE.next = now + 0.05;
  while (VENUE.next < now + 0.25) {
    if (VENUE.beat === 0 && VENUE.bar >= Sh.tune) {
      // the end of a tune: the break, the applause, a new tempo, and for the live bands the drummer's count-in
      VENUE.gapFrom = VENUE.next; VENUE.gapUntil = VENUE.next + Sh.gap;
      crowdClap(VENUE.next + 0.15, Sh.clap);
      VENUE.bar = 0; VENUE.lead = null; VENUE.bpmMul = rr(0.92, 1.08); B = 60 / (S.bpm * VENUE.bpmMul);
      if (k >= 3) for (let i = 0; i < 4; i++) vDrum("rim", VENUE.gapUntil - (4 - i) * B, i < 2 ? 0.35 : 0.5);
      VENUE.next = VENUE.gapUntil;
      continue;
    }
    VENUE.marks.push([VENUE.next, VENUE.nb++, B]); if (VENUE.marks.length > 12) VENUE.marks.shift();
    venueBeat(VENUE.next, VENUE.beat, B);
    VENUE.next += B;
    VENUE.beat = (VENUE.beat + 1) % S.beats;
    if (VENUE.beat === 0) VENUE.bar++;
  }
  // the crowd: louder between tunes, and quiet in the club while the trio plays
  const inGap = now >= VENUE.gapFrom && now < VENUE.gapUntil + 1.5;
  if (VENUE.cNext < now) VENUE.cNext = now + 0.02;
  while (VENUE.cNext < now + 0.3) { crowdGrain(VENUE.cNext, C.lvl * (inGap ? 1.3 : C.play)); VENUE.cNext += rr(0.25, 0.4); }
}
