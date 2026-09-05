// lam-visemes.js — a reusable "talk burst" sampler using a real viseme set,
// not the single jawOpen sine pulse every demo this session started with.
// The LAM rig's skin.glb carries the full 51 ARKit blendshapes (verified by
// dumping mesh.extras.targetNames directly), including a complete mouth
// set — mouthFunnel, mouthPucker, mouthClose, mouthStretchLeft/Right,
// mouthSmileLeft/Right, mouthLowerDownLeft/Right, mouthUpperUpLeft/Right,
// mouthPressLeft/Right, mouthRollUpper/Lower — but nothing in this project
// drove more than jawOpen before this file. This is still NOT phoneme-
// accurate lip-sync (no audio/text input, no timing from real speech) —
// it's a canned, randomized-but-deterministic sequence of real mouth
// SHAPES cycling at speech-like cadence, meant to demonstrate the rig's
// actual range rather than one shape pulsing bigger and smaller.
//
// Usage (drop into any demo that already calls avatar.pose({..., morph})):
//   import { sampleTalkBurst } from './lib/lam-visemes.js';
//   let talkBurstStart = -1;
//   window.__talkBurst = () => { talkBurstStart = performance.now() / 1000; };
//   // each frame, t = performance.now()/1000:
//   const talkMorph = talkBurstStart >= 0 ? sampleTalkBurst(t - talkBurstStart) : {};
//   return { ..., morph: { ...idleMorph, ...talkMorph } };
// sampleTalkBurst returns {} once elapsed exceeds `durationSec` (default
// 2.5s, matching every demo's existing burst length) so callers don't need
// to separately track an "until" cutoff for the morph values themselves
// (a cutoff is still needed to stop CALLING it / to know the burst ended).

// Loosely Preston-Blair/Oculus-viseme inspired, but composed only from
// shapes actually present in this rig (no tongue/teeth shapes exist in
// ARKit's 51, so TH/L/RR are approximations, not phonetically precise).
export const VISEMES = {
  sil: {},
  AA: { jawOpen: 0.75, mouthFunnel: 0.15 }, // "father", "hot"
  E: { mouthStretchLeft: 0.5, mouthStretchRight: 0.5, jawOpen: 0.15 }, // "bed"
  I: { mouthSmileLeft: 0.4, mouthSmileRight: 0.4, jawOpen: 0.1 }, // "see"
  O: { mouthFunnel: 0.55, mouthPucker: 0.35, jawOpen: 0.45 }, // "go"
  U: { mouthPucker: 0.75, mouthFunnel: 0.3, jawOpen: 0.1 }, // "boot"
  FV: { mouthLowerDownLeft: 0.4, mouthLowerDownRight: 0.4, mouthRollUpper: 0.3 }, // "five"
  MBP: { mouthClose: 0.7, mouthPressLeft: 0.4, mouthPressRight: 0.4 }, // "mama", "boy", "pat"
  L: { jawOpen: 0.25, mouthStretchLeft: 0.2, mouthStretchRight: 0.2, mouthUpperUpLeft: 0.15, mouthUpperUpRight: 0.15 }, // "la"
  WQ: { mouthPucker: 0.6, mouthFunnel: 0.4, jawOpen: 0.05 }, // "we", "queen"
  CH_SH: { mouthFunnel: 0.45, mouthPucker: 0.2, jawOpen: 0.2 }, // "church", "she"
  TH: { jawOpen: 0.2, mouthLowerDownLeft: 0.25, mouthLowerDownRight: 0.25 }, // "think"
  RR: { mouthFunnel: 0.25, mouthPucker: 0.15, jawOpen: 0.25 }, // "red"
};
const VISEME_NAMES = Object.keys(VISEMES).filter((n) => n !== 'sil');

function hash1(n) {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}
function pickViseme(segIdx, seed) {
  const r = hash1(segIdx * 7.31 + seed * 0.0031 + 1);
  return VISEME_NAMES[Math.floor(r * VISEME_NAMES.length) % VISEME_NAMES.length];
}

// elapsed: seconds since the burst started (caller tracks the start time).
// Deterministic given (elapsed, seed) — no persistent state object needed,
// so this is safe to call from multiple demos/avatars without them
// interfering with each other; pass a different `seed` per avatar if you
// want two talking heads to visibly NOT be saying the same "thing".
export function sampleTalkBurst(elapsed, { seed = 0, segMs = 220, smoothMs = 90, durationSec = 2.5 } = {}) {
  if (elapsed < 0 || elapsed > durationSec) return {};
  // brief silence-to-speech and speech-to-silence taper so a burst doesn't
  // start/stop with the mouth already mid-shape
  const fadeSec = 0.15;
  const fade = Math.min(1, elapsed / fadeSec, (durationSec - elapsed) / fadeSec);

  const ms = elapsed * 1000;
  const segIdx = Math.floor(ms / segMs);
  const segT = ms % segMs;
  const curName = pickViseme(segIdx, seed);
  const nextName = pickViseme(segIdx + 1, seed);
  const blend = segT > segMs - smoothMs ? (segT - (segMs - smoothMs)) / smoothMs : 0;
  const cur = VISEMES[curName], next = VISEMES[nextName];

  const out = {};
  const keys = new Set([...Object.keys(cur), ...Object.keys(next)]);
  for (const k of keys) {
    const a = cur[k] || 0, b = next[k] || 0;
    out[k] = (a * (1 - blend) + b * blend) * fade;
  }
  return out;
}
