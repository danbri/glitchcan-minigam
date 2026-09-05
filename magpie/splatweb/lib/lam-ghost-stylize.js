// lam-ghost-stylize.js — a per-frame stylize pass for a LAM face's ALREADY
// POSED splat buffer (apply after avatar.pose(), before renderer.writeRegion).
// Built to close a stylistic gap the owner flagged: LAM faces are
// near-photoreal splat reconstructions, but the dbdb foliage "hair"
// (lam-organic-treatments.js) is much lower-fidelity/triangular — sitting
// side by side they clash. Rather than trying to make foliage more
// photoreal, this pulls the FACE toward a stylized, ephemeral register:
// noise-driven dissolve/slices, particle-ification (fewer/bigger/blockier
// splats — "lowpoly for splats"), secondary-action lag (a real per-splat
// physics lerp, not a shader trick — see GhostStylizer.update below), and
// an optional desaturated "radio/CRT" palette.
//
// Everything is 0..1 tunable and independent, so it can sit near-identical
// to the source look (all params 0) up to fully-dissolved-ghost (params
// near 1), not an on/off toggle.
import { FLOATS_PER_SPLAT } from './splat-renderer.js';

// --- cheap smooth value-noise (trilinear-interpolated hash lattice). Not a
// "real" gradient Perlin, but continuous and cheap enough for ~15k splats/
// frame in JS, and visually indistinguishable from Perlin at this scale.
function hashV(ix, iy, iz) {
  let n = (ix * 374761393 + iy * 668265263 + iz * 2147483647) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967295;
}
const smooth = (t) => t * t * (3 - 2 * t);
function valueNoise3(x, y, z) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = smooth(x - x0), fy = smooth(y - y0), fz = smooth(z - z0);
  const c000 = hashV(x0, y0, z0), c100 = hashV(x0 + 1, y0, z0);
  const c010 = hashV(x0, y0 + 1, z0), c110 = hashV(x0 + 1, y0 + 1, z0);
  const c001 = hashV(x0, y0, z0 + 1), c101 = hashV(x0 + 1, y0, z0 + 1);
  const c011 = hashV(x0, y0 + 1, z0 + 1), c111 = hashV(x0 + 1, y0 + 1, z0 + 1);
  const x00 = c000 + (c100 - c000) * fx, x10 = c010 + (c110 - c010) * fx;
  const x01 = c001 + (c101 - c001) * fx, x11 = c011 + (c111 - c011) * fx;
  const y0v = x00 + (x10 - x00) * fy, y1v = x01 + (x11 - x01) * fy;
  return y0v + (y1v - y0v) * fz;
}
const frac = (x) => x - Math.floor(x);
const hash1 = (n) => frac(Math.sin(n) * 43758.5453);

// One instance per LAM avatar. `count` = avatar.lastCount (the alpha-culled
// live splat count — verified constant across frames for a fixed avatar,
// since it depends only on the static per-vertex opacity, not pose).
export class GhostStylizer {
  constructor(count) {
    this.count = count;
    this.curPos = null; // lazily seeded from the first target on update()
    this.lagSeed = new Float32Array(count);   // independent per-splat randoms —
    this.pSeed = new Float32Array(count);     // deliberately NOT reusing one
    this.noiseSeed = new Float32Array(count); // stream for 3 unrelated purposes
    for (let i = 0; i < count; i++) {
      this.lagSeed[i] = hash1(i * 12.9898 + 3.7);
      this.pSeed[i] = hash1(i * 78.233 + 91.1);
      this.noiseSeed[i] = hash1(i * 37.719 + 17.3) * 1000;
    }
  }

  // target: freshly avatar.pose()-computed splat buffer (>= count splats,
  // offset 0). out: written with the stylized result (same length is fine;
  // may be the same array as target — read-then-write per splat is safe).
  // t: seconds. params, all 0..1 unless noted:
  //   lag        — secondary-action trailing (0 = snap to pose exactly)
  //   dissolve   — noise/slice-driven alpha cutout (0 = fully solid)
  //   particle   — "lowpoly for splats": drop a fraction of splats, enlarge
  //                and voxel-snap the rest (0 = untouched continuous surface)
  //   ghost      — desaturate + cool CRT/radio tint + faint scanline banding
  //   noiseFreq  — spatial frequency for dissolve noise (default ~14)
  //   sliceSpeed — how fast the dissolve "slice" bands sweep (default ~1.1)
  update(target, out, t, params = {}) {
    const { lag = 0, dissolve = 0, particle = 0, ghost = 0, noiseFreq = 14, sliceSpeed = 1.1, twinkle = 0, jitter = 0, roundness = 0,
      // tintTarget: optional [r,g,b] multiplier the `ghost` blend moves
      // toward (default matches the ORIGINAL hardcoded cool-CRT constants
      // exactly, so every existing caller that doesn't pass this is
      // unaffected) — lets each caller pick its own persona/mood colour
      // instead of always the one cool tint.
      tintTarget = [0.72, 0.95, 1.12],
      // coreWeight (optional Float32Array, per-splat, 0..1, 1=core/center,
      // 0=periphery) + swirl (0..1 scalar): when BOTH omitted, behaviour is
      // byte-for-byte identical to before this addition, for every existing
      // caller. When present: peripheral splats (low coreWeight) get an
      // EXTRA fade/rounding on top of whatever dissolve/particle/roundness
      // the caller already set, AND get pulled toward the world Y-axis
      // (x=0,z=0) with a slow per-splat swirl rotation around it. Built for
      // a specific creature (demo-lam-pentagram.html) where several
      // dissolved faces share one central mass and should read as one
      // writhing intermixed tangle at their edges rather than separate
      // blobs each sitting rigidly on its own facet, while each face's own
      // core (eyes/nose/mouth) stays comparatively solid so it still reads
      // as a face at a glance.
      coreWeight = null, swirl = 0 } = params;
    const n = this.count;
    if (!this.curPos) {
      this.curPos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const o = i * FLOATS_PER_SPLAT;
        this.curPos[i * 3] = target[o]; this.curPos[i * 3 + 1] = target[o + 1]; this.curPos[i * 3 + 2] = target[o + 2];
      }
    }
    // particle-ify voxel size shrinks (coarser) as `particle` rises —
    // 0 = no snapping, 1 = ~4cm cells (chunky/lowpoly clumping)
    const voxel = particle > 0 ? 0.003 + particle * particle * 0.04 : 0;

    for (let i = 0; i < n; i++) {
      const o = i * FLOATS_PER_SPLAT;
      let tx = target[o], ty = target[o + 1], tz = target[o + 2];

      if (voxel > 0) {
        tx = Math.round(tx / voxel) * voxel;
        ty = Math.round(ty / voxel) * voxel;
        tz = Math.round(tz / voxel) * voxel;
      }

      // secondary-action lag: persistent per-splat position lerped toward
      // the (possibly voxel-snapped) target at a per-splat rate — this is
      // real frame-to-frame state, not a shader illusion, so when the head
      // turns some splats measurably fall behind and catch up over
      // subsequent frames (verified in the demo via a position sample diff).
      const baseRate = 0.05 + 0.55 * this.lagSeed[i];
      const rate = lag > 0 ? (1 - lag) + lag * baseRate : 1;
      const cx = this.curPos[i * 3] + (tx - this.curPos[i * 3]) * rate;
      const cy = this.curPos[i * 3 + 1] + (ty - this.curPos[i * 3 + 1]) * rate;
      const cz = this.curPos[i * 3 + 2] + (tz - this.curPos[i * 3 + 2]) * rate;
      this.curPos[i * 3] = cx; this.curPos[i * 3 + 1] = cy; this.curPos[i * 3 + 2] = cz;

      // jitter: small per-frame positional buzz, output-only (NOT folded
      // into curPos, so it doesn't fight or accumulate with the lag lerp
      // above) — a fast, uncorrelated register distinct from lag's smooth
      // trailing-behind, closer to static/interference than motion.
      let jx = cx, jy = cy, jz = cz;
      if (jitter > 0) {
        const amp = jitter * jitter * 0.012;
        jx += (valueNoise3(tx * 40 + this.noiseSeed[i], ty * 40, t * 9 + this.noiseSeed[i]) - 0.5) * amp;
        jy += (valueNoise3(tx * 40, ty * 40 + this.noiseSeed[i], t * 9 + this.noiseSeed[i] + 50) - 0.5) * amp;
        jz += (valueNoise3(tx * 40 + this.noiseSeed[i] + 90, ty * 40, t * 9) - 0.5) * amp;
      }

      let alpha = target[o + 13];

      if (twinkle > 0) {
        // brightness sparkle, independent of dissolve's alpha-cutout.
        // Additive (not multiplicative against base alpha) so it swings
        // ALL the way between off and fully on even for near-opaque
        // splats — a multiplicative factor barely moved high-alpha splats,
        // which is why the range felt capped. At twinkle=1 the swing is
        // already the full ±1; values above 1 (slider goes to 3) don't add
        // more travel — they saturate at the 0/1 clamp for a larger share
        // of each cycle, which reads as a harder, more binary on/off
        // flicker rather than a smooth pulse.
        const ph = Math.sin(t * (2.2 + this.pSeed[i] * 3.1) + this.noiseSeed[i]);
        alpha = Math.min(1, Math.max(0, alpha + twinkle * ph));
      }

      if (dissolve > 0) {
        // coarse spatial noise ("lowpoly" chunks, not per-splat static) +
        // literal moving horizontal slice bands, blended
        const nz = valueNoise3(tx * noiseFreq + this.noiseSeed[i] * 0.001, ty * noiseFreq, tz * noiseFreq + t * 0.35);
        const slice = Math.sin(ty * 26 + t * sliceSpeed + this.noiseSeed[i] * 0.02) * 0.5 + 0.5;
        const field = nz * 0.7 + slice * 0.3;
        const cutoff = dissolve * 0.92;
        alpha *= field > cutoff ? 1 : Math.max(0, field / (cutoff + 1e-4)) ** 2;
      }

      // particle: EXACTLY the original behaviour (drop a fraction, enlarge
      // survivors) — untouched, per owner instruction. Shape/orientation of
      // survivors is NOT altered here.
      let sx = target[o + 7], sy = target[o + 8], sz = target[o + 9];
      let qx = target[o + 3], qy = target[o + 4], qz = target[o + 5], qw = target[o + 6];
      if (particle > 0) {
        if (this.pSeed[i] < particle * 0.82) alpha = 0; // dropped — fewer visible splats
        else {
          const boost = 1 + particle * 2.6;
          sx *= boost; sy *= boost; sz *= boost;
        }
      }

      // roundness: a SEPARATE, independent slider — "classic tiny ball
      // particles". Splats inherit an anisotropic scale + orientation from
      // the original Gaussian reconstruction (splat heritage); this blends
      // scale toward isotropic (equal xyz) AND rotation toward identity as
      // `roundness` rises, so at roundness=1 every splat is a true uniform
      // sphere regardless of its source shape — independent of whatever
      // `particle` is doing (works with particle=0 too, i.e. round balls at
      // full/original density).
      if (roundness > 0) {
        const avgS = (sx + sy + sz) / 3;
        sx = sx * (1 - roundness) + avgS * roundness;
        sy = sy * (1 - roundness) + avgS * roundness;
        sz = sz * (1 - roundness) + avgS * roundness;
        qx *= (1 - roundness); qy *= (1 - roundness); qz *= (1 - roundness);
        qw = qw * (1 - roundness) + roundness;
        const qlen = Math.hypot(qx, qy, qz, qw) || 1;
        qx /= qlen; qy /= qlen; qz /= qlen; qw /= qlen;
      }

      // peripheral swirl-into-shared-mass: only active when the caller
      // supplies coreWeight (per-splat core/edge weight) AND swirl>0.
      // peri=0 at this splat's own face-center (coreWeight=1) -> no change
      // at all, so a face's core stays exactly as solid as dissolve/
      // particle/roundness already made it. peri approaches 1 at the
      // face's own periphery (hairline/jaw/ears, coreWeight->0) -> pulled
      // toward the shared world Y-axis and rotated around it (a stable,
      // non-accumulating function of absolute time t, not a running
      // integrator, so it can't run away frame to frame) plus an extra
      // fade/rounding on top of whatever the scalar params already did.
      if (coreWeight && swirl > 0) {
        const peri = 1 - coreWeight[i];
        if (peri > 0) {
          const pullAmt = peri * swirl * 0.55;
          const px2 = jx * (1 - pullAmt), pz2 = jz * (1 - pullAmt);
          const ang = t * 0.6 * peri * swirl + this.noiseSeed[i] * 0.01;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          jx = px2 * ca - pz2 * sa;
          jz = px2 * sa + pz2 * ca;
          alpha *= 1 - peri * swirl * 0.5;
          const extraRound = peri * swirl * 0.6;
          const avgS2 = (sx + sy + sz) / 3;
          sx = sx * (1 - extraRound) + avgS2 * extraRound * 1.4;
          sy = sy * (1 - extraRound) + avgS2 * extraRound * 1.4;
          sz = sz * (1 - extraRound) + avgS2 * extraRound * 1.4;
          qx *= (1 - extraRound); qy *= (1 - extraRound); qz *= (1 - extraRound);
          qw = qw * (1 - extraRound) + extraRound;
          const qlen2 = Math.hypot(qx, qy, qz, qw) || 1;
          qx /= qlen2; qy /= qlen2; qz /= qlen2; qw /= qlen2;
        }
      }

      out[o] = jx; out[o + 1] = jy; out[o + 2] = jz;
      out[o + 3] = qx; out[o + 4] = qy; out[o + 5] = qz; out[o + 6] = qw;
      out[o + 7] = sx; out[o + 8] = sy; out[o + 9] = sz;

      let r = target[o + 10], g = target[o + 11], b = target[o + 12];
      if (ghost > 0) {
        const lum = r * 0.3 + g * 0.59 + b * 0.11;
        const scan = 0.85 + 0.15 * Math.sin(ty * 140 + t * 2.2);
        const gr = lum * tintTarget[0] * scan, gg = lum * tintTarget[1] * scan, gb = lum * tintTarget[2] * scan;
        r += (gr - r) * ghost; g += (gg - g) * ghost; b += (gb - b) * ghost;
      }
      out[o + 10] = r; out[o + 11] = g; out[o + 12] = b; out[o + 13] = alpha;
    }
  }
}
