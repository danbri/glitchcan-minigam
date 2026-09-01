// pose-math.js — quaternion & pose helpers for splatweb. See DESIGN.md §4.
// Quaternions are [x, y, z, w]. No dependencies.

export function qIdentity() { return [0, 0, 0, 1]; }

export function qNormalize(q) {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

export function qMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export function qConjugate(q) { return [-q[0], -q[1], -q[2], q[3]]; }

export function qRotVec(q, v) {
  // v' = q * v * q^-1, expanded
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ];
}

// yaw about Y, pitch about X, roll about Z (applied roll, then pitch, then yaw)
export function qFromEuler(yaw, pitch, roll) {
  const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2);
  const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
  const cr = Math.cos(roll / 2), sr = Math.sin(roll / 2);
  return qNormalize([
    sp * cy * cr + cp * sy * sr,
    cp * sy * cr - sp * cy * sr,
    cp * cy * sr - sp * sy * cr,
    cp * cy * cr + sp * sy * sr,
  ]);
}

export function qToEuler(q) {
  const [x, y, z, w] = q;
  const sinp = 2 * (w * x - y * z);
  return {
    pitch: Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp),
    yaw: Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y)),
    roll: Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z)),
  };
}

// Interpolate a → b at t. t may exceed [0,1] slightly for extrapolation;
// nlerp keeps that stable (normalized), which slerp's trig does not.
export function qSlerp(a, b, t) {
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  let dot = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (dot < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; dot = -dot; }
  if (dot > 0.9995 || t < 0 || t > 1) {
    return qNormalize([
      a[0] + (bx - a[0]) * t, a[1] + (by - a[1]) * t,
      a[2] + (bz - a[2]) * t, a[3] + (bw - a[3]) * t,
    ]);
  }
  const th = Math.acos(dot), sth = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / sth, wb = Math.sin(t * th) / sth;
  return [a[0] * wa + bx * wb, a[1] * wa + by * wb, a[2] * wa + bz * wb, a[3] * wa + bw * wb];
}

export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// Angular difference in degrees between two quats (for error readouts)
export function qAngleDeg(a, b) {
  const dot = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
  return 2 * Math.acos(dot) * 180 / Math.PI;
}

// Deterministic PRNG for procedural content
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
