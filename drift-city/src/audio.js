// ---------- sound: synthesised live with Web Audio, and placed in the world ----------
// Every source has a position in the local frame (metres); the listener follows the camera, and with headphones the
// HRTF panners make each sound come from its direction and distance. Sound on Titan travels at about 200 m/s in the
// cold nitrogen, so distant bangs arrive late. Starts on the first tap; Menu > Sound switches it off.
const AU = { ctx: null, on: true, ready: false, t: {}, pad: [], chord: -1, chordStep: 0, src: {}, radios: [], lpos: [0, 0, 0] };
const SOUND_SPEED = 198;
try { const s = localStorage.getItem("drift.sound"); if (s === "0") AU.on = false; } catch (e) {}
const rr = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function audioInit() {
  if (AU.ctx || !AU.on) return;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  const c = new AC();
  AU.ctx = c;
  AU.master = c.createGain(); AU.master.gain.value = 0;
  AU.muffle = c.createBiquadFilter(); AU.muffle.type = "lowpass"; AU.muffle.frequency.value = 12000;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3;
  // a smooth saturation last, so coinciding events can never clip (a second compressor would add make-up gain)
  const lim = c.createWaveShaper(), lc = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 4 - 2; lc[i] = Math.tanh(x) * 0.84; }
  lim.curve = lc;
  AU.muffle.connect(AU.master); AU.master.connect(comp); comp.connect(lim); lim.connect(c.destination);
  const len = c.sampleRate * 6.5, ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * (i < c.sampleRate * 0.04 ? i / (c.sampleRate * 0.04) : 1); }
  AU.verb = c.createConvolver(); AU.verb.buffer = ir;
  AU.verbIn = c.createGain(); AU.verbIn.gain.value = 0.4;
  AU.verbIn.connect(AU.verb); AU.verb.connect(AU.muffle);
  const nb = (brown) => { const b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; } return b; };
  AU.white = nb(false); AU.brown = nb(true);
  // buses: every group can be faded as a whole
  AU.bus = {};
  for (const k of ["amb", "babble", "clank", "whoosh", "fliers", "env", "radio", "cue", "own"]) { const g = c.createGain(); g.gain.value = 0; g.connect(AU.muffle); AU.bus[k] = g; }
  AU.bus.cue.gain.value = 0.5;
  // wind and the pad (not placed: they are the air itself)
  const w = c.createBufferSource(); w.buffer = AU.brown; w.loop = true;
  AU.windF = c.createBiquadFilter(); AU.windF.type = "lowpass"; AU.windF.frequency.value = 400;
  AU.windG = c.createGain(); AU.windG.gain.value = 0;
  w.connect(AU.windF); AU.windF.connect(AU.windG); AU.windG.connect(AU.muffle); w.start();
  AU.padF = c.createBiquadFilter(); AU.padF.type = "lowpass"; AU.padF.frequency.value = 900;
  AU.padG = c.createGain(); AU.padG.gain.value = 0;
  AU.padF.connect(AU.padG); AU.padG.connect(AU.muffle); AU.padG.connect(AU.verbIn);
  for (let i = 0; i < 4; i++) {
    const o = c.createOscillator(); o.type = i % 2 ? "triangle" : "sine";
    const g = c.createGain(); g.gain.value = 0.25;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05 + 0.03 * i; const lg = c.createGain(); lg.gain.value = 1.5;
    lfo.connect(lg); lg.connect(o.detune); lfo.start(); o.connect(g); g.connect(AU.padF); o.start();
    AU.pad.push(o);
  }
  // everyone outdoors is in a pressure suit, so all speech reaches us over suit radios: a narrow band, a little
  // clipping, and the squelch of each key-up (auKey)
  AU.babbleF = c.createBiquadFilter(); AU.babbleF.type = "highpass"; AU.babbleF.frequency.value = 330;
  const rlp = c.createBiquadFilter(); rlp.type = "lowpass"; rlp.frequency.value = 3000; rlp.Q.value = 1.2;
  const rpk = c.createBiquadFilter(); rpk.type = "peaking"; rpk.frequency.value = 1700; rpk.gain.value = 5;
  const rclip = c.createWaveShaper(), rc = new Float32Array(512);
  for (let i = 0; i < 512; i++) { const x = (i / 511) * 2 - 1; rc[i] = Math.tanh(x * 2.6) / Math.tanh(2.6); }
  rclip.curve = rc;
  const rout = c.createGain(); rout.gain.value = 0.5; // the clipper's curve lifts quiet speech 2.6 times; take that back
  AU.babbleF.connect(rpk); rpk.connect(rlp); rlp.connect(rclip); rclip.connect(rout); rout.connect(AU.bus.babble);
  // our own drone: a faint rotor hum that follows airspeed
  const r1 = c.createOscillator(); r1.type = "sawtooth"; r1.frequency.value = 118;
  const r2 = c.createOscillator(); r2.type = "sawtooth"; r2.frequency.value = 121.5;
  AU.rotorF = c.createBiquadFilter(); AU.rotorF.type = "lowpass"; AU.rotorF.frequency.value = 500;
  AU.rotorG = c.createGain(); AU.rotorG.gain.value = 0;
  r1.connect(AU.rotorF); r2.connect(AU.rotorF); AU.rotorF.connect(AU.rotorG); AU.rotorG.connect(AU.bus.own); r1.start(); r2.start();
  AU.rotor = [r1, r2];
  // a brassy synth pad in a vast space: detuned saws under a slowly sweeping filter, drowned in reverb
  AU.brassF = c.createBiquadFilter(); AU.brassF.type = "lowpass"; AU.brassF.frequency.value = 700; AU.brassF.Q.value = 2;
  const bl = c.createOscillator(); bl.frequency.value = 0.04; const blg = c.createGain(); blg.gain.value = 450; bl.connect(blg); blg.connect(AU.brassF.frequency); bl.start();
  AU.brassG = c.createGain(); AU.brassG.gain.value = 0;
  AU.brassF.connect(AU.brassG); AU.brassG.connect(AU.muffle);
  const bsend = c.createGain(); bsend.gain.value = 1.6; AU.brassG.connect(bsend); bsend.connect(AU.verbIn);
  AU.brass = [];
  for (let i = 0; i < 6; i++) { const o = c.createOscillator(); o.type = "sawtooth"; o.detune.value = (i % 2 ? 7 : -7) + i; const g = c.createGain(); g.gain.value = 0.12; o.connect(g); g.connect(AU.brassF); o.start(); AU.brass.push(o); }
  AU.master.gain.setTargetAtTime(0.5, c.currentTime, 1.5);
  AU.ready = true;
}
function audioSetOn(on) {
  AU.on = on;
  try { localStorage.setItem("drift.sound", on ? "1" : "0"); } catch (e) {}
  if (on) { if (!AU.ctx) audioInit(); else AU.ctx.resume(); if (AU.ready) AU.master.gain.setTargetAtTime(0.5, AU.ctx.currentTime, 0.5); }
  else if (AU.ready) AU.master.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.2);
}
for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, () => { if (!AU.on) return; if (!AU.ctx) audioInit(); else if (AU.ctx.state !== "running") AU.ctx.resume(); }, { passive: true });

// ---------- placing sounds ----------
function auSetPos(p, pos, tc) {
  const now = AU.ctx.currentTime;
  if (p.positionX) { p.positionX.setTargetAtTime(pos[0], now, tc || 0.05); p.positionY.setTargetAtTime(pos[1], now, tc || 0.05); p.positionZ.setTargetAtTime(pos[2], now, tc || 0.05); }
  else if (p.setPosition) p.setPosition(pos[0], pos[1], pos[2]);
}
function auPanner(pos, ref, roll) {
  const p = AU.ctx.createPanner();
  p.panningModel = "HRTF"; p.distanceModel = "inverse"; p.refDistance = ref || 6; p.maxDistance = 4000; p.rolloffFactor = roll === undefined ? 1.1 : roll;
  if (p.positionX) { p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2]; } else if (p.setPosition) p.setPosition(pos[0], pos[1], pos[2]);
  return p;
}
function audioListener(pos, f, up) {
  if (!AU.ready) return;
  AU.lpos = pos;
  const L = AU.ctx.listener, now = AU.ctx.currentTime, k = 0.03;
  if (L.positionX) {
    L.positionX.setTargetAtTime(pos[0], now, k); L.positionY.setTargetAtTime(pos[1], now, k); L.positionZ.setTargetAtTime(pos[2], now, k);
    L.forwardX.setTargetAtTime(f[0], now, k); L.forwardY.setTargetAtTime(f[1], now, k); L.forwardZ.setTargetAtTime(f[2], now, k);
    L.upX.setTargetAtTime(up[0], now, k); L.upY.setTargetAtTime(up[1], now, k); L.upZ.setTargetAtTime(up[2], now, k);
  } else if (L.setPosition) { L.setPosition(pos[0], pos[1], pos[2]); L.setOrientation(f[0], f[1], f[2], up[0], up[1], up[2]); }
}
// route a sound's output through a panner at pos into a bus
function auOut(node, pos, bus, ref, roll) { const p = auPanner(pos, ref, roll); node.connect(p); p.connect(bus); return p; }
function auDelay(pos) { const l = AU.lpos; return Math.hypot(pos[0] - l[0], pos[1] - l[1], pos[2] - l[2]) / SOUND_SPEED; }

// ---------- one-shot sounds ----------
const VOWELS = [[730, 1090], [270, 2290], [300, 870], [530, 1840], [640, 1190], [440, 1020], [390, 1990], [660, 1720]];
function auSyllable(pos, voice, gain) {
  const c = AU.ctx, t = c.currentTime, dur = rr(0.07, 0.22);
  const o = c.createOscillator(); o.type = "sawtooth";
  const f0 = voice * rr(0.92, 1.12);
  o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * rr(0.85, 1.15), t + dur);
  const V = pick(VOWELS), g = c.createGain(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), mix = c.createGain();
  f1.type = f2.type = "bandpass"; f1.frequency.value = V[0] * (voice > 160 ? 1.15 : 1); f2.frequency.value = V[1] * (voice > 160 ? 1.12 : 1); f1.Q.value = 6; f2.Q.value = 8;
  mix.gain.value = gain * 0.4;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.02); g.gain.setTargetAtTime(0, t + dur * 0.6, dur * 0.25);
  o.connect(g); g.connect(f1); g.connect(f2); f1.connect(mix); f2.connect(mix);
  auOut(mix, pos, AU.babbleF, 4, 1.3);
  o.start(t); o.stop(t + dur + 0.2);
}
// a radio key-up or key-down: a burst of squelch, and sometimes a roger beep at the end
function auKey(pos, gain, end, rig) {
  const c = AU.ctx, t = c.currentTime, len = end ? rr(0.12, 0.22) : rr(0.03, 0.06);
  const n = c.createBufferSource(); n.buffer = AU.white;
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = rr(1500, 2600); bp.Q.value = 0.9;
  const g = c.createGain(); g.gain.setValueAtTime(gain * (0.25 + 0.35 * rig), t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  n.connect(bp); bp.connect(g); auOut(g, pos, AU.babbleF, 4, 1.3);
  n.start(t, Math.random() * 2, len + 0.05);
  if (end && Math.random() < 0.3) {
    const o = c.createOscillator(); o.frequency.setValueAtTime(1250, t + len); o.frequency.setValueAtTime(950, t + len + 0.05);
    const og = c.createGain(); og.gain.setValueAtTime(0, t + len); og.gain.linearRampToValueAtTime(gain * 0.12, t + len + 0.01); og.gain.setValueAtTime(gain * 0.12, t + len + 0.09); og.gain.linearRampToValueAtTime(0, t + len + 0.1);
    o.connect(og); auOut(og, pos, AU.babbleF, 4, 1.3); o.start(t + len); o.stop(t + len + 0.12);
  }
}
// a phrase over a suit radio: key-up, syllables rising or falling like a sentence (a few lost to crackle on a poor
// rig), key-down. rig: 0 a clean, expensive set; 1 an old one. Returns how long it lasts, in seconds.
function auPhrase(pos, gain, voice, n, rig, rate) {
  voice = voice || pick([100, 115, 130, 185, 205, 230, 270]);
  n = n || Math.floor(rr(3, 9));
  rig = rig === undefined ? rr(0.2, 0.7) : rig;
  rate = rate || 1;
  auKey(pos, gain, false, rig);
  const step = () => rr(110, 190) * rate;
  let at = 70;
  for (let i = 0; i < n; i++) {
    const lost = Math.random() < 0.08 * rig;
    setTimeout(() => { if (!AU.ready) return; if (lost) auKey(pos, gain * 0.6, false, 1); else auSyllable(pos, voice * (1 + 0.08 * Math.sin(i * 0.9)), gain); }, at);
    at += step();
  }
  setTimeout(() => { if (AU.ready) auKey(pos, gain, true, rig); }, at + 60);
  return (at + 300) / 1000;
}
// the story's people, each with a voice, a pace and a radio set that says what they can afford
const AU_VOICES = {
  bo: [195, 1.2, 0.6], tam: [100, 1.3, 0.85], obi: [122, 1.1, 0.4], castellane: [112, 1.0, 0.05],
  mei: [215, 0.85, 0.5], sato: [205, 0.8, 0.25], wren: [182, 1.35, 0.9],
  you: [150, 1.0, 0.3],
  // Per Aspera
  mags: [205, 1.15, 0.5], dex: [118, 1.25, 0.6], oskar: [108, 0.9, 0.35], nuala: [190, 0.95, 0.45], pell: [140, 0.8, 0.0], ruth: [200, 1.05, 0.2],
  // the Org's polite public voice, and an Elder with the filters off
  org: [235, 0.85, 0.0], elder: [172, 1.2, 0.3],
};
// a line of dialogue: queued after the line before it, as long as the line is, from the nearest story person
// (or, with nobody placed, from just in front of Pip, whose receiver picks it up)
function audioVoice(who, words, from) {
  if (!AU.ready || !AU.on) return;
  const v = AU_VOICES[who];
  if (!v) return;
  const c = AU.ctx, now = c.currentTime;
  const start = Math.max(now + 0.15, AU.vEnd || 0);
  const n = Math.max(3, Math.min(26, Math.round(words * 0.9)));
  AU.vEnd = start + n * 0.15 * v[1] + 0.8;
  // `from` is a position, or a function giving one when the line is spoken; none means inside your own helmet
  setTimeout(() => {
    if (!AU.ready || !AU.on) return;
    const at = (typeof from === "function" ? from() : from) || [AU.lpos[0], AU.lpos[1] - 0.3, AU.lpos[2]];
    auPhrase(at, 0.9, v[0], n, v[2], v[1]);
  }, (start - now) * 1000);
}
// a vendor's call: long sung vowels with a falling tune
function auVendor(pos) {
  const c = AU.ctx, t = c.currentTime, f0 = pick([150, 175, 210]);
  [0, 0.45, 0.9].forEach((dt, i) => {
    const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(f0 * [1.26, 1.12, 1][i], t + dt); o.frequency.linearRampToValueAtTime(f0 * [1.19, 1.06, 0.94][i], t + dt + 0.4);
    const V = pick(VOWELS), bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = V[0]; bp.Q.value = 5;
    const bp2 = c.createBiquadFilter(); bp2.type = "bandpass"; bp2.frequency.value = V[1]; bp2.Q.value = 7;
    const g = c.createGain(); g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(0.35, t + dt + 0.06); g.gain.setTargetAtTime(0, t + dt + 0.32, 0.08);
    o.connect(g); g.connect(bp); g.connect(bp2); const m = c.createGain(); bp.connect(m); bp2.connect(m);
    auOut(m, pos, AU.babbleF, 8, 1.1);
    o.start(t + dt); o.stop(t + dt + 0.6);
  });
}
// an exoskeleton footfall: a ringing clank (steel, aluminium or a heavy frame) over a thud
function auClank(pos, gain) {
  const c = AU.ctx, t = c.currentTime;
  const mat = pick([[900, 2.76, 18, 0.35], [1600, 2.41, 26, 0.22], [520, 3.1, 12, 0.5]]);
  const n = c.createBufferSource(); n.buffer = AU.white;
  const bp1 = c.createBiquadFilter(), bp2 = c.createBiquadFilter(); bp1.type = bp2.type = "bandpass";
  const base = mat[0] * rr(0.85, 1.2); bp1.frequency.value = base; bp2.frequency.value = base * mat[1]; bp1.Q.value = mat[2]; bp2.Q.value = mat[2] * 1.3;
  const g = c.createGain(); g.gain.setValueAtTime(gain * 0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + mat[3]);
  n.connect(bp1); n.connect(bp2); bp1.connect(g); bp2.connect(g);
  const th = c.createOscillator(); th.frequency.setValueAtTime(rr(70, 100), t); th.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  const tg = c.createGain(); tg.gain.setValueAtTime(gain * 0.6, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  th.connect(tg);
  const m = c.createGain(); g.connect(m); tg.connect(m);
  auOut(m, pos, AU.bus.clank, 3, 1.4);
  n.start(t, Math.random() * 2, 0.5); th.start(t); th.stop(t + 0.2);
  // a servo whine, sometimes
  if (Math.random() < 0.25) {
    const s = c.createOscillator(); s.type = "square"; s.frequency.setValueAtTime(rr(700, 1100), t + 0.05); s.frequency.linearRampToValueAtTime(rr(1300, 1900), t + 0.25);
    const sg = c.createGain(); sg.gain.setValueAtTime(0, t + 0.05); sg.gain.linearRampToValueAtTime(gain * 0.05, t + 0.1); sg.gain.linearRampToValueAtTime(0, t + 0.28);
    const sf = c.createBiquadFilter(); sf.type = "lowpass"; sf.frequency.value = 2500;
    s.connect(sf); sf.connect(sg); auOut(sg, pos, AU.bus.clank, 3, 1.4); s.start(t + 0.05); s.stop(t + 0.3);
  }
}
// an android's step: a clean servo glide and a small, exact click, no thud (it weighs what it should)
function auServo(pos, gain) {
  const c = AU.ctx, t = c.currentTime;
  const o = c.createOscillator(); o.type = "triangle"; const f0 = rr(620, 880);
  o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.5, t + 0.16); o.frequency.linearRampToValueAtTime(f0 * 1.45, t + 0.22);
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain * 0.07, t + 0.03); g.gain.linearRampToValueAtTime(0, t + 0.24);
  o.connect(g); auOut(g, pos, AU.bus.clank, 2.5, 1.5); o.start(t); o.stop(t + 0.26);
  const n = c.createBufferSource(); n.buffer = AU.white;
  const hp = c.createBiquadFilter(); hp.type = "bandpass"; hp.frequency.value = rr(3500, 5000); hp.Q.value = 4;
  const cg = c.createGain(); cg.gain.setValueAtTime(gain * 0.5, t + 0.24); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.27);
  n.connect(hp); hp.connect(cg); auOut(cg, pos, AU.bus.clank, 2.5, 1.5); n.start(t + 0.24, Math.random() * 2, 0.05);
}
// weighted boots landing after a long, slow stride: two soft, heavy thuds, and a suit valve's breath now and then
function auBoots(pos, gain) {
  const c = AU.ctx, t = c.currentTime;
  [0, rr(0.05, 0.09)].forEach((dt, i) => {
    const o = c.createOscillator(); o.frequency.setValueAtTime(rr(62, 80), t + dt); o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.18);
    const g = c.createGain(); g.gain.setValueAtTime(gain * (i ? 0.45 : 0.6), t + dt); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.22);
    o.connect(g); auOut(g, pos, AU.bus.clank, 3, 1.4); o.start(t + dt); o.stop(t + dt + 0.25);
  });
  const n = c.createBufferSource(); n.buffer = AU.brown;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500;
  const ng = c.createGain(); ng.gain.setValueAtTime(gain * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  n.connect(lp); lp.connect(ng); auOut(ng, pos, AU.bus.clank, 3, 1.4); n.start(t, Math.random() * 2, 0.15);
  if (Math.random() < 0.3) {
    const v = c.createBufferSource(); v.buffer = AU.white;
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = rr(2500, 4000); bp.Q.value = 2;
    const vg = c.createGain(); vg.gain.setValueAtTime(0, t + 0.3); vg.gain.linearRampToValueAtTime(gain * 0.08, t + 0.45); vg.gain.linearRampToValueAtTime(0, t + 0.9);
    v.connect(bp); bp.connect(vg); auOut(vg, pos, AU.bus.clank, 3, 1.4); v.start(t + 0.3, Math.random() * 2, 0.7);
  }
}
// a glider's cape catching the thick air: a soft flutter that rises and falls with the hop
function auCape(pos, gain) {
  const c = AU.ctx, t = c.currentTime, dur = rr(0.8, 1.4);
  const n = c.createBufferSource(); n.buffer = AU.white;
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(rr(350, 500), t); bp.frequency.linearRampToValueAtTime(rr(700, 1000), t + dur * 0.5); bp.frequency.linearRampToValueAtTime(rr(300, 450), t + dur); bp.Q.value = 1.4;
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain * 0.25, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
  const fl = c.createOscillator(); fl.frequency.value = rr(11, 19); const fg = c.createGain(); fg.gain.value = gain * 0.12; fl.connect(fg); fg.connect(g.gain);
  n.connect(bp); bp.connect(g); auOut(g, pos, AU.bus.whoosh, 3, 1.3);
  n.start(t, Math.random() * 2, dur + 0.05); fl.start(t); fl.stop(t + dur + 0.05);
}
// somebody's pet drone passing close: a small, high, wavering buzz
function auBuzz(pos, gain) {
  const c = AU.ctx, t = c.currentTime, dur = rr(1.2, 2.2);
  const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = rr(290, 380);
  const vib = c.createOscillator(); vib.frequency.value = rr(5, 9); const vg = c.createGain(); vg.gain.value = rr(8, 20); vib.connect(vg); vg.connect(o.frequency);
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1400; bp.Q.value = 1.5;
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain * 0.06, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(bp); bp.connect(g); auOut(g, pos, AU.bus.clank, 3, 1.3);
  o.start(t); o.stop(t + dur + 0.05); vib.start(t); vib.stop(t + dur + 0.05);
}
// a pod passing in its tube overhead: the source really moves along the tube
function auWhoosh(from, to, gain, dur) {
  const c = AU.ctx, t = c.currentTime;
  const n = c.createBufferSource(); n.buffer = AU.white; n.loop = true;
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = rr(1, 2);
  const lo = rr(250, 450), hi = rr(1000, 1800);
  bp.frequency.setValueAtTime(lo, t); bp.frequency.exponentialRampToValueAtTime(hi, t + dur * 0.5); bp.frequency.exponentialRampToValueAtTime(lo * 0.8, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  // and a hum from the pod's motor, dropping in pitch as it passes
  const hm = c.createOscillator(); hm.type = "triangle"; hm.frequency.setValueAtTime(rr(160, 240), t); hm.frequency.linearRampToValueAtTime(rr(120, 150), t + dur);
  const hg = c.createGain(); hg.gain.setValueAtTime(0.0001, t); hg.gain.exponentialRampToValueAtTime(gain * 0.25, t + dur * 0.5); hg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(bp); bp.connect(g); hm.connect(hg);
  const m = c.createGain(); g.connect(m); hg.connect(m);
  const p = auOut(m, from, AU.bus.whoosh, 6, 1.0);
  if (p.positionX) { p.positionX.linearRampToValueAtTime(to[0], t + dur); p.positionY.linearRampToValueAtTime(to[1], t + dur); p.positionZ.linearRampToValueAtTime(to[2], t + dur); }
  n.start(t, Math.random() * 2); n.stop(t + dur + 0.1); hm.start(t); hm.stop(t + dur + 0.1);
}
// a flier's call: a glide, a trill or a soft chord swell, blooming in the reverb
function auFlier(pos, gain) {
  const c = AU.ctx, t = c.currentTime, scale = [0, 2, 4, 7, 9, 12, 14, 16], root = pick([392, 349.2, 440]);
  const kind = Math.random();
  const notes = kind < 0.5 ? [pick(scale)] : kind < 0.8 ? [pick(scale), pick(scale), pick(scale)] : [0, 4, 7].map((s) => s + pick([0, 2, 5]));
  const dur = rr(1.6, 3.8), g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + rr(0.3, 0.9)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  notes.forEach((s, i) => {
    const f = root * Math.pow(2, s / 12) * (Math.random() < 0.3 ? 0.5 : 1), st2 = kind >= 0.5 && kind < 0.8 ? t + i * 0.18 : t;
    const bend = Math.pow(2, rr(-4, 3) / 12);
    for (const [m, a] of [[1, 1], [2.01, 0.3], [3.03, 0.12]]) {
      const o = c.createOscillator(); o.frequency.setValueAtTime(f * m, st2); o.frequency.exponentialRampToValueAtTime(f * m * bend, t + dur);
      const og = c.createGain(); og.gain.value = a / notes.length; o.connect(og); og.connect(g); o.start(st2); o.stop(t + dur + 0.1);
    }
  });
  const p = auOut(g, pos, AU.bus.fliers, 20, 0.8);
  const send = c.createGain(); send.gain.value = 1.3; p.connect(send); send.connect(AU.verbIn);
}
// a temple bell: inharmonic partials, a long decay
function auBell(pos, gain) {
  const c = AU.ctx, t = c.currentTime + auDelay(pos), f = rr(140, 190), g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 7);
  for (const [m, a] of [[1, 1], [2.02, 0.6], [2.74, 0.45], [4.1, 0.3], [5.4, 0.2]]) { const o = c.createOscillator(); o.frequency.value = f * m; const og = c.createGain(); og.gain.value = a * 0.3; o.connect(og); og.connect(g); o.start(t); o.stop(t + 7.1); }
  const p = auOut(g, pos, AU.bus.env, 20, 0.7); const s = c.createGain(); s.gain.value = 0.8; p.connect(s); s.connect(AU.verbIn);
}
// wind chimes in the lantern strings
function auChimes(pos, gain) {
  const c = AU.ctx, t = c.currentTime, n = Math.floor(rr(2, 6));
  for (let i = 0; i < n; i++) {
    const tt = t + rr(0, 1.2), f = pick([1318, 1480, 1661, 1976, 2217, 2637]);
    const o = c.createOscillator(); o.frequency.value = f; const o2 = c.createOscillator(); o2.frequency.value = f * 2.76;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(gain * 0.25, tt + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.8);
    o.connect(g); o2.connect(g); auOut(g, pos, AU.bus.env, 4, 1.2); o.start(tt); o2.start(tt); o.stop(tt + 1.9); o2.stop(tt + 1.9);
  }
}
// a small service robot chirping to itself
function auChirp(pos, gain) {
  const c = AU.ctx, t = c.currentTime, n = Math.floor(rr(2, 5));
  for (let i = 0; i < n; i++) {
    const tt = t + i * rr(0.07, 0.14), o = c.createOscillator(); o.type = pick(["square", "triangle"]);
    o.frequency.setValueAtTime(rr(900, 2200), tt); o.frequency.exponentialRampToValueAtTime(rr(700, 2600), tt + 0.06);
    const g = c.createGain(); g.gain.setValueAtTime(gain * 0.12, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.07);
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 3000;
    o.connect(f); f.connect(g); auOut(g, pos, AU.bus.env, 3, 1.4); o.start(tt); o.stop(tt + 0.08);
  }
}
// ice cracking in the cold: a sharp snap and a singing ring
function auIce(pos, gain) {
  const c = AU.ctx, t = c.currentTime + auDelay(pos);
  const n = c.createBufferSource(); n.buffer = AU.white;
  const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500;
  const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  const o = c.createOscillator(); o.frequency.setValueAtTime(rr(2500, 4000), t); o.frequency.exponentialRampToValueAtTime(rr(600, 1000), t + 0.9);
  const og = c.createGain(); og.gain.setValueAtTime(gain * 0.15, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  n.connect(hp); hp.connect(g); o.connect(og);
  const m = c.createGain(); g.connect(m); og.connect(m);
  const p = auOut(m, pos, AU.bus.env, 15, 0.8); const s = c.createGain(); s.gain.value = 1; p.connect(s); s.connect(AU.verbIn);
  n.start(t, Math.random() * 2, 0.1); o.start(t); o.stop(t + 1);
}
// a firework or distant boom: a crack and a thump, arriving late across the cold air
function audioBang(pos, big) {
  if (!AU.ready || !AU.on) return;
  const c = AU.ctx, t = c.currentTime + auDelay(pos);
  const n = c.createBufferSource(); n.buffer = AU.white;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = big ? 600 : 2200;
  const g = c.createGain(); g.gain.setValueAtTime(big ? 0.8 : 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 4 : 1.2));
  const th = c.createOscillator(); th.frequency.setValueAtTime(big ? 45 : 70, t); th.frequency.exponentialRampToValueAtTime(28, t + 0.6);
  const tg = c.createGain(); tg.gain.setValueAtTime(big ? 1.0 : 0.6, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
  n.connect(lp); lp.connect(g); th.connect(tg);
  const m = c.createGain(); g.connect(m); tg.connect(m);
  const p = auOut(m, pos, AU.bus.env, 60, 0.6); const s = c.createGain(); s.gain.value = 0.9; p.connect(s); s.connect(AU.verbIn);
  n.start(t, Math.random() * 1.5, big ? 4 : 1.3); th.start(t); th.stop(t + 0.9);
}
function audioChime() {
  if (!AU.ready) return;
  const c = AU.ctx, t = c.currentTime;
  [0, 4, 7, 12].forEach((s, i) => {
    const o = c.createOscillator(); o.frequency.value = 660 * Math.pow(2, s / 12);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.09); g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 1.4);
    o.connect(g); g.connect(AU.bus.cue); g.connect(AU.verbIn); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 1.5);
  });
}
function audioDepart() {
  if (!AU.ready) return;
  const l = AU.lpos;
  auWhoosh([l[0] - 30, l[1] - 5, l[2]], [l[0] + 30, l[1] + 20, l[2]], 0.4, 3.2);
}

// ---------- continuous sources placed in the world ----------
// each is a looping sound with its own panner; the scene tells us where the nearest one is and how loud it should be
function auLoop(kind) {
  const c = AU.ctx;
  const out = c.createGain(); out.gain.value = 0;
  const p = auPanner([0, 0, 0], kind === "water" ? 10 : kind === "industry" ? 30 : kind === "hive" ? 90 : kind === "beam" ? 60 : 15, 0.9);
  out.connect(p); p.connect(AU.bus.env);
  const n = c.createBufferSource(); n.buffer = kind === "rumble" || kind === "industry" || kind === "dorm" || kind === "hive" ? AU.brown : AU.white; n.loop = true;
  const f = c.createBiquadFilter();
  const mod = c.createGain(); mod.gain.value = 1;
  if (kind === "water") { f.type = "lowpass"; f.frequency.value = 800; }
  else if (kind === "river") { f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 1.5; }
  else if (kind === "hiss") { f.type = "highpass"; f.frequency.value = 4500; }
  else if (kind === "rumble") { f.type = "lowpass"; f.frequency.value = 140; }
  else if (kind === "cable") {
    // the skaters' cable running over its pulleys: a hum with a roller's flutter
    f.type = "bandpass"; f.frequency.value = 1100; f.Q.value = 3;
    const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = 96; const og = c.createGain(); og.gain.value = 0.05; o.connect(og); og.connect(mod); o.start();
    const trem = c.createOscillator(); trem.frequency.value = 6.5; const tg = c.createGain(); tg.gain.value = 0.35; trem.connect(tg); tg.connect(mod.gain); trem.start();
  }
  else if (kind === "dorm") {
    // the dorms: ventilation, and thousands of people murmuring into their headsets behind the walls
    f.type = "bandpass"; f.frequency.value = 520; f.Q.value = 1.2;
    for (const [fq, a] of [[50, 0.12], [100, 0.06], [150.5, 0.03]]) { const o = c.createOscillator(); o.frequency.value = fq; const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(mod); o.start(); }
    const am = c.createOscillator(); am.frequency.value = 0.7; const ag = c.createGain(); ag.gain.value = 0.3; am.connect(ag); ag.connect(mod.gain); am.start();
  }
  else if (kind === "beam") {
    // the receiver taking the beam: a high-voltage buzz with a crackle in it
    f.type = "highpass"; f.frequency.value = 2500;
    for (const [fq, a] of [[100, 0.12], [200, 0.08], [300, 0.05]]) { const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = fq; const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(mod); o.start(); }
    const cr = c.createOscillator(); cr.type = "square"; cr.frequency.value = 7.3; const cg = c.createGain(); cg.gain.value = 0.25; cr.connect(cg); cg.connect(mod.gain); cr.start();
  }
  else if (kind === "hive") {
    // the Hive: a building-sized air handler, mains hum, and the slow beat of its fans
    f.type = "lowpass"; f.frequency.value = 220;
    for (const [fq, a] of [[50, 0.18], [100, 0.1], [150, 0.05], [37.5, 0.12]]) { const o = c.createOscillator(); o.frequency.value = fq; const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(mod); o.start(); }
    const am = c.createOscillator(); am.frequency.value = 0.35; const ag = c.createGain(); ag.gain.value = 0.35; am.connect(ag); ag.connect(mod.gain); am.start();
  }
  else if (kind === "industry") { f.type = "lowpass"; f.frequency.value = 300; const o = c.createOscillator(); o.frequency.value = 55; const og = c.createGain(); og.gain.value = 0.2; o.connect(og); og.connect(mod); o.start(); const o2 = c.createOscillator(); o2.frequency.value = 110.5; const og2 = c.createGain(); og2.gain.value = 0.08; o2.connect(og2); og2.connect(mod); o2.start(); }
  else if (kind === "shimmer") {
    // a flock's soft shimmer: slowly beating high partials
    for (const [fq, a] of [[784, 0.3], [786.5, 0.3], [1175, 0.18], [1568, 0.1]]) { const o = c.createOscillator(); o.frequency.value = fq; const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(mod); o.start(); }
    const trem = c.createOscillator(); trem.frequency.value = 0.4; const tg = c.createGain(); tg.gain.value = 0.4; trem.connect(tg); tg.connect(mod.gain); trem.start();
    mod.connect(out); const s = c.createGain(); s.gain.value = 0.8; p.connect(s); s.connect(AU.verbIn);
    return { out, p, n: null, kind };
  }
  n.connect(f); f.connect(mod); mod.connect(out); n.start(0, Math.random() * 2);
  return { out, p, n, f, mod, kind };
}
function auLoopSet(kind, pos, gain) {
  let s = AU.src[kind];
  if (!s) { if (!pos || !(gain > 0.001)) return; s = AU.src[kind] = auLoop(kind); }
  const now = AU.ctx.currentTime;
  if (pos) auSetPos(s.p, pos, 0.3);
  s.out.gain.setTargetAtTime(pos ? gain : 0, now, 0.6);
  // lapping water and gurgling rivers move in slow waves
  if ((kind === "water" || kind === "river") && now > (s.next || 0)) {
    s.next = now + rr(0.6, 1.8);
    s.mod.gain.setTargetAtTime(rr(0.3, 1.1), now, rr(0.2, 0.6));
    if (kind === "river") s.f.frequency.setTargetAtTime(rr(600, 1400), now, 0.2);
  }
}

// ---------- radios: four made-up stations, heard through small speakers in the world ----------
const STATIONS = [
  { name: "Kraken FM", bpm: 84, chords: [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 61, 64, 67]], wave: "sine", beat: "jazz" },
  { name: "Haze Radio", bpm: 96, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], wave: "sawtooth", beat: "arp" },
  { name: "Temple Band", bpm: 50, chords: [[50, 57, 62], [50, 57, 64], [48, 55, 62], [50, 57, 62]], wave: "triangle", beat: "drone" },
  { name: "The Ferry Hour", bpm: 120, chords: [[60, 64, 67], [55, 59, 62], [60, 64, 67], [53, 57, 60]], wave: "square", beat: "waltz" },
];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function auRadio() {
  const c = AU.ctx;
  // a small, boxy speaker: band-limited and a little overdriven
  const inp = c.createGain(); inp.gain.value = 0.5;
  const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 320;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200;
  const ws = c.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.2); } ws.curve = curve;
  const out = c.createGain(); out.gain.value = 0;
  inp.connect(hp); hp.connect(lp); lp.connect(ws); ws.connect(out);
  const p = auPanner([0, 0, 0], 3, 1.5); out.connect(p); p.connect(AU.bus.radio);
  // a constant faint hiss
  const h = c.createBufferSource(); h.buffer = AU.white; h.loop = true; const hg = c.createGain(); hg.gain.value = 0.015; h.connect(hg); hg.connect(inp); h.start(0, Math.random() * 2);
  return { inp, out, p, st: 0, seg: "static", segEnd: 0, nextBeat: 0, beat: 0, bar: 0 };
}
function auRadioNote(r, midi, t, dur, wave, gain) {
  const c = AU.ctx, o = c.createOscillator(); o.type = wave; o.frequency.value = mtof(midi);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(r.inp); o.start(t); o.stop(t + dur + 0.05);
}
function auRadioStep(r, now) {
  const c = AU.ctx, S = STATIONS[r.st];
  if (now > r.segEnd) {
    // between segments, a moment of tuning static
    r.seg = r.seg === "static" ? (Math.random() < 0.72 ? "music" : "talk") : "static";
    r.segEnd = now + (r.seg === "static" ? rr(0.8, 1.8) : r.seg === "music" ? rr(25, 45) : rr(7, 14));
    if (r.seg === "static") {
      const n = c.createBufferSource(); n.buffer = AU.white; const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 3;
      bp.frequency.setValueAtTime(400, now); bp.frequency.exponentialRampToValueAtTime(3000, now + 0.8); bp.frequency.exponentialRampToValueAtTime(800, now + 1.6);
      const g = c.createGain(); g.gain.value = 0.3; n.connect(bp); bp.connect(g); g.connect(r.inp); n.start(now, Math.random() * 2, 1.8);
      const wh = c.createOscillator(); wh.frequency.setValueAtTime(rr(900, 2000), now); wh.frequency.exponentialRampToValueAtTime(rr(300, 3000), now + 1.2);
      const wg = c.createGain(); wg.gain.setValueAtTime(0.05, now); wg.gain.linearRampToValueAtTime(0, now + 1.4); wh.connect(wg); wg.connect(r.inp); wh.start(now); wh.stop(now + 1.5);
      if (Math.random() < 0.3) r.st = Math.floor(Math.random() * STATIONS.length);
    } else if (r.seg === "talk") {
      // the station's jingle, then the host talking
      [0, 4, 7].forEach((s, i) => auRadioNote(r, 72 + s, now + i * 0.16, 0.5, "triangle", 0.25));
    }
    r.nextBeat = now + 0.2;
  }
  if (r.seg === "static") return;
  if (r.seg === "talk") {
    if (now > r.nextBeat) {
      r.nextBeat = now + rr(0.9, 2.4);
      const voice = r.st === 2 ? 95 : pick([105, 120, 190]);
      const n = Math.floor(rr(4, 10));
      for (let i = 0; i < n; i++) {
        const t = now + i * rr(0.1, 0.17), dur = rr(0.07, 0.18), o = c.createOscillator(); o.type = "sawtooth";
        o.frequency.setValueAtTime(voice * (1.1 - i * 0.02) * rr(0.95, 1.08), t);
        const V = pick(VOWELS), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(); f1.type = f2.type = "bandpass"; f1.frequency.value = V[0]; f2.frequency.value = V[1]; f1.Q.value = 6; f2.Q.value = 8;
        const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.02); g.gain.setTargetAtTime(0, t + dur * 0.6, dur * 0.25);
        o.connect(g); g.connect(f1); g.connect(f2); f1.connect(r.inp); f2.connect(r.inp); o.start(t); o.stop(t + dur + 0.2);
      }
    }
    return;
  }
  // music: schedule a beat at a time
  const spb = 60 / S.bpm;
  while (r.nextBeat < now + 0.25) {
    const t = r.nextBeat, b = r.beat, per = S.beat === "waltz" ? 3 : 4, ch = S.chords[r.bar % S.chords.length];
    if (S.beat === "jazz") {
      if (b % 2 === 0) auRadioNote(r, ch[0] - 12, t, spb * 0.9, "sine", 0.5);
      if (b % 2 === 1) ch.slice(1).forEach((m) => auRadioNote(r, m, t, spb * 0.7, "triangle", 0.12));
      if (Math.random() < 0.45) auRadioNote(r, pick(ch) + 12 + pick([0, 2, -1]), t + spb * pick([0, 0.5]), spb * 0.6, "sine", 0.18);
      const n = c.createBufferSource(); n.buffer = AU.white; const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000; const g = c.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); n.connect(hp); hp.connect(g); g.connect(r.inp); n.start(t, Math.random() * 2, 0.15);
    } else if (S.beat === "arp") {
      for (let k = 0; k < 2; k++) auRadioNote(r, ch[(b * 2 + k) % ch.length] + 12, t + k * spb / 2, spb * 0.45, "sawtooth", 0.08);
      if (b === 0) auRadioNote(r, ch[0] - 12, t, spb * 3.8, "sawtooth", 0.1);
    } else if (S.beat === "drone") {
      if (b === 0) ch.forEach((m) => auRadioNote(r, m - 12, t, spb * 3.9, "triangle", 0.12));
      if (Math.random() < 0.35) auRadioNote(r, pick(ch) + 12, t, 2.5, "sine", 0.2);
    } else {
      if (b === 0) auRadioNote(r, ch[0] - 12, t, spb * 0.9, "square", 0.12);
      else ch.forEach((m) => auRadioNote(r, m, t, spb * 0.6, "square", 0.05));
      if (Math.random() < 0.5) auRadioNote(r, pick(ch) + 12, t, spb * 0.8, "square", 0.06);
    }
    r.beat = (b + 1) % per; if (r.beat === 0) r.bar++;
    r.nextBeat += spb;
  }
}

// ---------- the mix follows the world, every frame ----------
// w: { mode, alt, people, tubes, flierDist, story, tod, snow, speed,
//      places: { sidewalks[], busy[], persons[], tubeLines[], flocks[], water, river, industry, spaceport, wheel,
//                market, pagoda, lamps[], radios[], cold } } (positions in the local frame)
const CHORDS = [
  [[220, 277.2, 329.6, 440], [196, 246.9, 329.6, 392], [174.6, 220, 261.6, 349.2], [196, 246.9, 293.7, 392]],
  [[196, 246.9, 293.7, 392], [174.6, 220, 261.6, 329.6], [164.8, 207.7, 246.9, 329.6], [174.6, 220, 277.2, 349.2]],
  [[174.6, 207.7, 261.6, 311.1], [155.6, 196, 233.1, 311.1], [164.8, 196, 246.9, 293.7], [146.8, 174.6, 220, 277.2]],
  [[164.8, 196, 246.9, 329.6], [146.8, 185, 220, 293.7], [155.6, 196, 233.1, 311.1], [146.8, 174.6, 220, 293.7]],
];
function audioStep(dt, w) {
  if (!AU.ready || !AU.on) return;
  const c = AU.ctx, now = c.currentTime, T = (p, v, k) => p.setTargetAtTime(v, now, k);
  const space = w.mode === "space" || w.alt > 60000;
  const ground = Math.exp(-Math.max(w.alt, 0) / 60);
  const P = w.places || {};
  T(AU.windG.gain, space ? 0 : 0.05 + 0.12 * (1 - ground) + 0.06 * w.snow + 0.04 * Math.min(w.speed / 60, 1), 1.5);
  T(AU.windF.frequency, 250 + 500 * (1 - ground) + 150 * Math.sin(now * 0.07) + 300 * Math.min(w.speed / 80, 1), 2.0);
  // the pad moves slowly through four chords for the time of day
  AU.chordT = (AU.chordT || 0) - dt;
  if (w.tod !== AU.chord || AU.chordT <= 0) { AU.chord = w.tod; AU.chordT = rr(14, 24); AU.chordStep = (AU.chordStep + 1) % 4; CHORDS[w.tod][AU.chordStep].forEach((f, i) => AU.pad[i].frequency.setTargetAtTime(f * 0.5, now, 3)); }
  T(AU.padG.gain, space ? 0.03 : 0.035 + 0.03 * (1 - ground), 2.0);
  T(AU.padF.frequency, 500 + 700 * (w.tod === 0 ? 1 : 0.5), 3.0);
  T(AU.muffle.frequency, space ? 6000 : 12000 - 9000 * w.snow, 1.5);
  // our drone's rotors: louder and higher with speed, silent in space and on foot in a story place
  const flying = !space && (w.mode === "surface" || w.mode === "free") ? 1 : 0;
  T(AU.rotorG.gain, flying * (0.015 + 0.025 * Math.min(w.speed / 40, 1)), 0.5);
  AU.rotor.forEach((o, i) => T(o.frequency, (118 + i * 3.5) * (0.85 + 0.4 * Math.min(w.speed / 40, 1)), 0.4));
  T(AU.bus.own.gain, 1, 0.5);
  // the city
  const people = space ? 0 : Math.max(w.people * ground, w.story);
  T(AU.bus.babble.gain, 0.6 * people, 0.8);
  T(AU.bus.clank.gain, space ? 0 : 0.45 * w.people * ground, 0.8);
  T(AU.bus.whoosh.gain, space ? 0 : 0.7 * w.tubes * Math.exp(-Math.max(w.alt - 11, 0) / 50), 0.8);
  T(AU.bus.fliers.gain, space ? 0 : 0.6, 1.0);
  T(AU.bus.env.gain, space ? 0 : 0.8, 1.0);
  T(AU.bus.radio.gain, space ? 0 : 0.5, 1.0);
  const due = (k, rate) => { AU.t[k] = (AU.t[k] || rr(0, 1)) - dt * rate; if (AU.t[k] <= 0) { AU.t[k] = rr(0.5, 1.5); return true; } return false; };
  const near = (arr) => arr && arr.length ? pick(arr) : null;
  // people talking over their suit radios: from a walker you can see (not an android), else from a busy pavement.
  // Footfalls are placed and timed by the walkers themselves (audioFeet in main.js).
  if (people > 0.02 && due("phrase", 3.5 * people)) {
    const hs = (FEET.list || []).filter((q) => q.kind !== 1);
    const at = hs.length ? (() => { const q = pick(hs); return [q.x, 1.6, q.z]; })() : near(P.busy) || near(P.sidewalks);
    if (at) auPhrase(at, rr(0.4, 1));
  }
  auLoopSet("cable", P.cable, space ? 0 : 0.1);
  auLoopSet("dorm", P.dorm, space ? 0 : 0.22);
  if (P.dorm && !space && due("dormvoice", 0.25)) auPhrase([P.dorm[0] + rr(-8, 8), P.dorm[1] + rr(-6, 10), P.dorm[2] + rr(-8, 8)], rr(0.2, 0.4));
  if (w.tubes * ground > 0.05 && due("whoosh", 0.4 * w.tubes) && P.tubeLines && P.tubeLines.length) {
    const L = pick(P.tubeLines), s = Math.random() < 0.5 ? -1 : 1, len = rr(90, 160);
    auWhoosh([L[0] - L[3] * s * len, L[1], L[2] - L[4] * s * len], [L[0] + L[3] * s * len, L[1], L[2] + L[4] * s * len], rr(0.3, 0.6), rr(2.2, 3.6));
  }
  // fliers: a soft shimmer from the nearest flock, and calls from within it
  const fl = space ? 0 : Math.exp(-w.flierDist / 90);
  if (P.flocks && P.flocks.length) auLoopSet("shimmer", P.flocks[0], 0.05 * fl);
  if (fl > 0.03 && due("flier", 0.9 * fl + 0.08) && P.flocks && P.flocks.length) { const f = pick(P.flocks.slice(0, 2)); auFlier([f[0] + rr(-15, 15), f[1] + rr(-5, 5), f[2] + rr(-15, 15)], rr(0.2, 0.45)); }
  // the places around us
  auLoopSet("water", P.water, space ? 0 : 0.25);
  auLoopSet("river", P.river, space ? 0 : 0.18);
  auLoopSet("industry", P.industry, space ? 0 : 0.35);
  auLoopSet("hive", P.hive, space ? 0 : 0.3);
  auLoopSet("beam", P.fab, space ? 0 : 0.35);
  auLoopSet("rumble", P.spaceport, space ? 0 : 0.4);
  auLoopSet("hiss", P.lamps && P.lamps.length ? P.lamps[0] : null, space ? 0 : 0.08 + 0.1 * w.snow);
  if (P.pagoda && due("bell", 0.035)) auBell(P.pagoda, 0.35);
  if ((P.pagoda || P.market) && due("chimes", 0.12)) auChimes(P.market || P.pagoda, 0.5);
  if (P.market && due("vendor", 0.08)) auVendor(P.market);
  if (P.wheel && due("creak", 0.1)) { const t = c.currentTime, o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(rr(70, 110), t); o.frequency.linearRampToValueAtTime(rr(50, 140), t + 0.9); const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = rr(400, 900); bp.Q.value = 9; const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.2); g.gain.linearRampToValueAtTime(0, t + 1); o.connect(bp); bp.connect(g); auOut(g, P.wheel, AU.bus.env, 25, 0.8); o.start(t); o.stop(t + 1.1); }
  if (w.people * ground > 0.1 && due("chirp", 0.15) && P.sidewalks && P.sidewalks.length) auChirp(pick(P.sidewalks), 0.6);
  if (P.cold && (w.tod >= 2) && due("ice", 0.05)) auIce(P.cold, 0.5);
  // radios: each nearby set plays its own station
  const want = space ? [] : (P.radios || []).slice(0, 3);
  while (AU.radios.length < want.length) { const r = auRadio(); r.st = Math.floor(Math.random() * STATIONS.length); AU.radios.push(r); }
  AU.radios.forEach((r, i) => {
    const at = want[i];
    if (at) { if (at[3] !== undefined && r.fixed !== at[3]) { r.fixed = at[3]; r.st = at[3]; } auSetPos(r.p, at, 0.3); r.out.gain.setTargetAtTime(0.38, now, 0.5); auRadioStep(r, now); }
    else r.out.gain.setTargetAtTime(0, now, 0.5);
  });
}

// ---------- event sounds ----------
// a heat pipe bursting: a pressure thump, then a long hiss that fades
function audioSteam(pos) {
  if (!AU.ready || !AU.on) return;
  const c = AU.ctx, t = c.currentTime + auDelay(pos);
  const n = c.createBufferSource(); n.buffer = AU.white; n.loop = true;
  const hp = c.createBiquadFilter(); hp.type = "bandpass"; hp.frequency.setValueAtTime(3500, t); hp.frequency.exponentialRampToValueAtTime(1800, t + 8); hp.Q.value = 0.6;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 9);
  const th = c.createOscillator(); th.frequency.setValueAtTime(60, t); th.frequency.exponentialRampToValueAtTime(30, t + 0.4);
  const tg = c.createGain(); tg.gain.setValueAtTime(0.7, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  n.connect(hp); hp.connect(g); th.connect(tg);
  const m = c.createGain(); g.connect(m); tg.connect(m);
  auOut(m, pos, AU.bus.env, 12, 0.9);
  n.start(t, Math.random() * 2); n.stop(t + 9.2); th.start(t); th.stop(t + 0.6);
}
// an emergency pod: a two-tone wail moving along a tube overhead
function audioSiren(from, to, dur) {
  if (!AU.ready || !AU.on) return;
  const c = AU.ctx, t = c.currentTime;
  const o = c.createOscillator(); o.type = "sawtooth";
  for (let k = 0; k < dur / 0.6; k++) o.frequency.setValueAtTime(k % 2 ? 620 : 830, t + k * 0.6);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.5); g.gain.setValueAtTime(0.3, t + dur - 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); lp.connect(g);
  const p = auOut(g, from, AU.bus.env, 10, 0.9);
  if (p.positionX) { p.positionX.linearRampToValueAtTime(to[0], t + dur); p.positionY.linearRampToValueAtTime(to[1], t + dur); p.positionZ.linearRampToValueAtTime(to[2], t + dur); }
  o.start(t); o.stop(t + dur + 0.1);
}
// the power failing: a heavy electrical clunk and a dying hum
function audioThunk(pos) {
  if (!AU.ready || !AU.on) return;
  const c = AU.ctx, t = c.currentTime + auDelay(pos);
  const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(30, t + 2.5);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 400;
  const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
  o.connect(lp); lp.connect(g);
  const n = c.createBufferSource(); n.buffer = AU.brown; const ng = c.createGain(); ng.gain.setValueAtTime(0.9, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); n.connect(ng);
  const m = c.createGain(); g.connect(m); ng.connect(m);
  auOut(m, pos, AU.bus.env, 25, 0.8);
  o.start(t); o.stop(t + 2.7); n.start(t, 0, 0.35);
  for (let i = 0; i < 4; i++) setTimeout(() => { if (AU.ready) auPhrase([pos[0] + rr(-20, 20), 1.6, pos[2] + rr(-20, 20)], 0.8); }, 400 + i * 350);
}
// a flock startled into the air: a flurry of calls
function audioFlurry(pos) {
  if (!AU.ready || !AU.on) return;
  for (let i = 0; i < 6; i++) setTimeout(() => { if (AU.ready) auFlier([pos[0] + rr(-20, 20), pos[1] + rr(-8, 8), pos[2] + rr(-20, 20)], rr(0.3, 0.5)); }, i * rr(90, 220));
}
// a rush at the market: vendors calling, one after another
function audioRush(pos) {
  if (!AU.ready || !AU.on) return;
  for (let i = 0; i < 4; i++) setTimeout(() => { if (AU.ready) auVendor([pos[0] + rr(-25, 25), 3, pos[2] + rr(-25, 25)]); }, i * rr(900, 2200));
}

// sky lanterns going up: soft chimes and a murmur of appreciation
function audioLanterns(pos) {
  if (!AU.ready || !AU.on) return;
  auChimes([pos[0], pos[1] + 4, pos[2]], 0.6);
  for (let i = 0; i < 3; i++) setTimeout(() => { if (AU.ready) auPhrase([pos[0] + rr(-10, 10), 1.6, pos[2] + rr(-10, 10)], 0.6); }, 600 + i * 500);
}

// ---------- the big city: horns, public address, flying cars, and the brass pad ----------
const BRASS = [[43, 50, 55, 58, 62, 67], [41, 48, 53, 56, 60, 65], [39, 46, 51, 55, 58, 63], [38, 45, 50, 53, 57, 62]];
function auHorn() {
  const c = AU.ctx, l = AU.lpos, a = Math.random() * 6.283, d = rr(900, 2200);
  const pos = [l[0] + Math.cos(a) * d, 60, l[2] + Math.sin(a) * d], t = c.currentTime + auDelay(pos);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, t + 0.6); g.gain.setValueAtTime(0.45, t + 2.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(180, t); lp.frequency.linearRampToValueAtTime(420, t + 1.2); lp.frequency.linearRampToValueAtTime(220, t + 4.5);
  for (const f of [48.99, 49.4, 73.4]) { const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + 4.6); }
  lp.connect(g);
  const p = auOut(g, pos, AU.bus.env, 300, 0.5); const s2 = c.createGain(); s2.gain.value = 1.4; p.connect(s2); s2.connect(AU.verbIn);
}
function auAnnounce() {
  const c = AU.ctx, l = AU.lpos, a = Math.random() * 6.283, d = rr(200, 600);
  const pos = [l[0] + Math.cos(a) * d, rr(40, 120), l[2] + Math.sin(a) * d], t = c.currentTime + auDelay(pos);
  // echoing off the towers: a feedback delay
  const inp = c.createGain(); inp.gain.value = 0.9;
  const dl = c.createDelay(2); dl.delayTime.value = rr(0.28, 0.42); const fb = c.createGain(); fb.gain.value = 0.42;
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1200; bp.Q.value = 0.8;
  inp.connect(bp); bp.connect(dl); dl.connect(fb); fb.connect(dl);
  const out = c.createGain(); out.gain.value = 1; bp.connect(out); dl.connect(out);
  const p = auOut(out, pos, AU.bus.env, 120, 0.6); const sv = c.createGain(); sv.gain.value = 0.9; p.connect(sv); sv.connect(AU.verbIn);
  // a two-note chime, then the announcement
  [[659.3, 0], [523.3, 0.45]].forEach(([f, dt]) => { const o = c.createOscillator(); o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(0.4, t + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 1.2); o.connect(g); g.connect(inp); o.start(t + dt); o.stop(t + dt + 1.3); });
  const voice = pick([110, 190]), n = Math.floor(rr(10, 18));
  for (let i = 0; i < n; i++) {
    const tt = t + 1.3 + i * rr(0.11, 0.17), dur = rr(0.08, 0.18), o = c.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(voice * (1.05 - i * 0.006) * rr(0.96, 1.05), tt);
    const V = pick(VOWELS), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(); f1.type = f2.type = "bandpass"; f1.frequency.value = V[0]; f2.frequency.value = V[1]; f1.Q.value = 6; f2.Q.value = 8;
    const g = c.createGain(); g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.7, tt + 0.02); g.gain.setTargetAtTime(0, tt + dur * 0.6, dur * 0.25);
    o.connect(g); g.connect(f1); g.connect(f2); f1.connect(inp); f2.connect(inp); o.start(tt); o.stop(tt + dur + 0.2);
  }
}
function auSpinner() {
  const l = AU.lpos, a = Math.random() * 6.283, h = rr(40, 80), len = rr(250, 400);
  const from = [l[0] + Math.cos(a) * len, l[1] + h, l[2] + Math.sin(a) * len], to = [l[0] - Math.cos(a) * len, l[1] + h, l[2] - Math.sin(a) * len];
  const c = AU.ctx, t = c.currentTime, dur = rr(5, 8);
  auWhoosh(from, to, 0.5, dur);
  // the turbine: a low, gliding hum
  const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(rr(80, 110), t); o.frequency.linearRampToValueAtTime(rr(55, 70), t + dur);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 350;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); lp.connect(g);
  const p = auOut(g, from, AU.bus.env, 25, 0.9);
  if (p.positionX) { p.positionX.linearRampToValueAtTime(to[0], t + dur); p.positionY.linearRampToValueAtTime(to[1], t + dur); p.positionZ.linearRampToValueAtTime(to[2], t + dur); }
  o.start(t); o.stop(t + dur + 0.1);
}
function audioCity(dt, w) {
  if (!AU.ready || !AU.on || !AU.brass) return;
  const c = AU.ctx, now = c.currentTime, space = w.mode === "space" || w.alt > 60000;
  const city = space ? 0 : Math.min(1, w.tubes * 1.5 + 0.25) * Math.exp(-Math.max(w.alt, 0) / 3000);
  const night = w.tod >= 1 ? 1 : 0.5;
  AU.brassG.gain.setTargetAtTime(0.016 * city * night, now, 3);
  AU.brassT = (AU.brassT || 0) - dt;
  if (AU.brassT <= 0) { AU.brassT = rr(14, 24); AU.brassK = ((AU.brassK || 0) + 1 + (Math.random() < 0.3 ? 1 : 0)) % 4; BRASS[AU.brassK].forEach((m, i) => AU.brass[i].frequency.setTargetAtTime(440 * Math.pow(2, (m - 69) / 12), now, 2.5)); }
  const due = (k, rate) => { AU.t[k] = (AU.t[k] === undefined ? rr(0.3, 1) : AU.t[k]) - dt * rate; if (AU.t[k] <= 0) { AU.t[k] = rr(0.6, 1.4); return true; } return false; };
  if (city > 0.2 && due("horn", 0.012)) auHorn();
  if (city > 0.3 && due("pa", 0.014)) auAnnounce();
  if (city > 0.2 && w.alt < 250 && due("spinner", 0.03)) auSpinner();
  auRadioAct(dt, city, night);
}
// The radio layer, in the mood of Kraftwerk's Radio-Activity (no melody, no words, nothing sampled): a Geiger counter
// ticking at a slowly wandering rate, the masts' Morse as a faint sine on the air (same key as the lights,
// morse.js), a tuning sweep now and then, and a slow low call far off, like a whale's across an ocean.
function auRadioAct(dt, city, night) {
  const c = AU.ctx, now = c.currentTime;
  if (!AU.ra) {
    const bus = c.createGain(); bus.gain.value = 0; bus.connect(AU.muffle);
    const send = c.createGain(); send.gain.value = 0.5; bus.connect(send); send.connect(AU.verbIn);
    const mo = c.createOscillator(); mo.frequency.value = 690;
    const mg = c.createGain(); mg.gain.value = 0;
    mo.connect(mg); mg.connect(bus); mo.start();
    AU.ra = { bus, mg, geiger: 0, sweepT: rr(8, 20), callT: rr(20, 40), lastKey: 0 };
  }
  const R = AU.ra;
  R.bus.gain.setTargetAtTime(0.5 * (0.35 + 0.65 * city) * (0.6 + 0.4 * night), now, 2);
  // Morse, in step with the masts
  const k = typeof MORSE !== "undefined" ? MORSE.key : 0;
  if (k !== R.lastKey) { R.mg.gain.setTargetAtTime(k ? 0.028 : 0, now, 0.006); R.lastKey = k; }
  // Geiger clicks: a Poisson process whose rate drifts between about 0.4 and 6 a second
  const rate = 0.4 + 5.6 * Math.pow(0.5 + 0.5 * Math.sin(now * 0.037) * Math.sin(now * 0.011 + 1.3), 3);
  R.geiger += dt * rate;
  while (R.geiger > 0 && Math.random() < Math.min(1, R.geiger)) {
    R.geiger -= 1;
    const src = c.createBufferSource(); src.buffer = AU.white;
    const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500;
    const g = c.createGain(), t0 = now + Math.random() * dt;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.09, t0 + 0.0008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);
    src.connect(hp); hp.connect(g); g.connect(R.bus);
    src.start(t0, Math.random() * 2, 0.02);
  }
  if (R.geiger < 0) R.geiger = 0;
  // a tuning sweep: band-passed noise gliding up, and the whistle of a carrier passing through
  R.sweepT -= dt;
  if (R.sweepT <= 0) {
    R.sweepT = rr(25, 55);
    const src = c.createBufferSource(); src.buffer = AU.white; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 6;
    bp.frequency.setValueAtTime(300, now); bp.frequency.exponentialRampToValueAtTime(2600, now + 3.5);
    const g = c.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.05, now + 0.8); g.gain.linearRampToValueAtTime(0, now + 3.6);
    const wh = c.createOscillator(); wh.frequency.setValueAtTime(1800, now + 1.2); wh.frequency.exponentialRampToValueAtTime(220, now + 2.4);
    const wg = c.createGain(); wg.gain.setValueAtTime(0, now + 1.2); wg.gain.linearRampToValueAtTime(0.012, now + 1.7); wg.gain.linearRampToValueAtTime(0, now + 2.4);
    src.connect(bp); bp.connect(g); g.connect(R.bus); wh.connect(wg); wg.connect(R.bus);
    src.start(now); src.stop(now + 3.8); wh.start(now + 1.2); wh.stop(now + 2.5);
  }
  // the far call: a slow glide in the low bass with a few harmonics (a phone speaker hears the harmonics)
  R.callT -= dt;
  if (R.callT <= 0) {
    R.callT = rr(40, 90);
    const f0 = rr(48, 62), T = rr(4, 7);
    const g = c.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.07, now + T * 0.35); g.gain.linearRampToValueAtTime(0, now + T);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420;
    for (const [h, a] of [[1, 1], [2, 0.5], [3, 0.3], [5, 0.12]]) {
      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(f0 * h, now); o.frequency.linearRampToValueAtTime(f0 * h * 0.72, now + T);
      const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(lp); o.start(now); o.stop(now + T + 0.1);
    }
    lp.connect(g); g.connect(R.bus); g.connect(AU.verbIn);
  }
}
