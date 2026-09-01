// telemetry-codec.js — the 32-byte presence packet. Spec: DESIGN.md §4.
// Layout (little-endian):
//   [ 0.. 3] timestamp uint32 ms      [ 4.. 7] sequence uint32
//   [ 8..15] head quat 4×int16/32767  [16..21] head pos 3×int16 mm
//   [22..31] 10 blendshapes uint8
import { qNormalize, clamp } from './pose-math.js';

export const PACKET_BYTES = 32;
export const PACKET_HZ_DEFAULT = 30;

export const BLENDSHAPES = [
  'jawOpen', 'eyeBlinkLeft', 'eyeBlinkRight', 'browInnerUp',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthPucker',
  'eyeLookX', 'eyeLookY', 'cheekPuff',
];
// eyeLookX/Y are signed (−1..1); the rest are 0..1
const SIGNED = new Set(['eyeLookX', 'eyeLookY']);

export function makePose() {
  return { tMs: 0, seq: 0, quat: [0, 0, 0, 1], pos: [0, 0, 0], blend: new Float32Array(10) };
}

export function encodePose(pose, buf) {
  const ab = buf || new ArrayBuffer(PACKET_BYTES);
  const dv = new DataView(ab);
  dv.setUint32(0, pose.tMs >>> 0, true);
  dv.setUint32(4, pose.seq >>> 0, true);
  const q = qNormalize(pose.quat);
  for (let i = 0; i < 4; i++) dv.setInt16(8 + i * 2, Math.round(clamp(q[i], -1, 1) * 32767), true);
  for (let i = 0; i < 3; i++) dv.setInt16(16 + i * 2, Math.round(clamp(pose.pos[i] * 1000, -32767, 32767)), true);
  for (let i = 0; i < 10; i++) {
    const v = SIGNED.has(BLENDSHAPES[i]) ? pose.blend[i] * 0.5 + 0.5 : pose.blend[i];
    dv.setUint8(22 + i, Math.round(clamp(v, 0, 1) * 255));
  }
  return ab;
}

export function decodePose(ab, out) {
  const dv = new DataView(ab);
  const pose = out || makePose();
  pose.tMs = dv.getUint32(0, true);
  pose.seq = dv.getUint32(4, true);
  for (let i = 0; i < 4; i++) pose.quat[i] = dv.getInt16(8 + i * 2, true) / 32767;
  pose.quat = qNormalize(pose.quat);
  for (let i = 0; i < 3; i++) pose.pos[i] = dv.getInt16(16 + i * 2, true) / 1000;
  for (let i = 0; i < 10; i++) {
    const raw = dv.getUint8(22 + i) / 255;
    pose.blend[i] = SIGNED.has(BLENDSHAPES[i]) ? raw * 2 - 1 : raw;
  }
  return pose;
}

export function hexDump(ab) {
  const b = new Uint8Array(ab);
  const rows = [];
  for (let o = 0; o < b.length; o += 8) {
    const bytes = [...b.slice(o, o + 8)].map(x => x.toString(16).padStart(2, '0')).join(' ');
    rows.push(o.toString().padStart(2, ' ') + '  ' + bytes);
  }
  return rows.join('\n');
}

export function bandwidthStats(hz) {
  const payload = PACKET_BYTES * hz;                 // bytes/s
  const wire = (PACKET_BYTES + 28) * hz;             // + rough SCTP/DTLS/UDP overhead
  return {
    payloadKbps: payload * 8 / 1000,
    wireKbps: wire * 8 / 1000,
    withOpusKbps: wire * 8 / 1000 + 28,              // + 28 kbps Opus voice
    videoKbps: 1500,                                 // typical 720p30 call
  };
}
