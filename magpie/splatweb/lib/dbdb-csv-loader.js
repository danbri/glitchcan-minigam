// Loads a standard (uncompressed) 3D Gaussian Splat CSV — the format
// @playcanvas/splat-transform emits for `x,y,z,rot_0..3,scale_0..2,opacity,
// f_dc_0..2` (INRIA 3DGS convention, SH-band-0-only here since we decimate
// with -H not used, but pack elements were cut with no higher SH bands per
// pack.json). This is deliberately NOT a parser for the pack's native
// `.compressed.ply` (chunked/bit-packed quantization) — hand-decoding that
// format without a reference implementation risks exactly the "coloured
// mush" failure this project has hit before; splat-transform (real CLI,
// `npx @playcanvas/splat-transform`) does the real decompression + decimation
// offline, and this loader only has to parse plain CSV floats.
//
// Standard 3DGS conventions this applies (all verified against real output,
// Sept 2026): rot_0..3 is (w,x,y,z) — reordered here to the (x,y,z,w) this
// project's FLOATS_PER_SPLAT layout uses; scale_0..2 is LOG-space (needs
// exp()); opacity is LOGIT-space (needs sigmoid()); f_dc_0..2 is the 0th
// spherical-harmonic band, converted to RGB via `0.5 + SH_C0 * f_dc`
// (SH_C0 = 0.28209479177387814), clamped to [0,1].
import { FLOATS_PER_SPLAT } from './splat-renderer.js';

const SH_C0 = 0.28209479177387814;
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

export async function loadDbdbCsv(url) {
  const text = await fetch(url).then((r) => r.text());
  const lines = text.split('\n');
  const header = lines[0].split(',');
  const idx = {};
  header.forEach((h, i) => { idx[h.trim()] = i; });
  const need = ['x', 'y', 'z', 'rot_0', 'rot_1', 'rot_2', 'rot_3', 'scale_0', 'scale_1', 'scale_2', 'opacity', 'f_dc_0', 'f_dc_1', 'f_dc_2'];
  for (const k of need) if (idx[k] == null) throw new Error(`dbdb csv ${url} missing column ${k}`);

  const rows = lines.slice(1).filter((l) => l.trim().length > 0);
  const n = rows.length;
  const out = new Float32Array(n * FLOATS_PER_SPLAT);
  for (let i = 0; i < n; i++) {
    const c = rows[i].split(',');
    const x = +c[idx.x], y = +c[idx.y], z = +c[idx.z];
    const w = +c[idx.rot_0], qx = +c[idx.rot_1], qy = +c[idx.rot_2], qz = +c[idx.rot_3];
    const sx = Math.exp(+c[idx.scale_0]), sy = Math.exp(+c[idx.scale_1]), sz = Math.exp(+c[idx.scale_2]);
    const a = sigmoid(+c[idx.opacity]);
    const r = Math.min(1, Math.max(0, 0.5 + SH_C0 * +c[idx.f_dc_0]));
    const g = Math.min(1, Math.max(0, 0.5 + SH_C0 * +c[idx.f_dc_1]));
    const b = Math.min(1, Math.max(0, 0.5 + SH_C0 * +c[idx.f_dc_2]));
    const o = i * FLOATS_PER_SPLAT;
    out[o] = x; out[o + 1] = y; out[o + 2] = z;
    out[o + 3] = qx; out[o + 4] = qy; out[o + 5] = qz; out[o + 6] = w;
    out[o + 7] = sx; out[o + 8] = sy; out[o + 9] = sz;
    out[o + 10] = r; out[o + 11] = g; out[o + 12] = b; out[o + 13] = a;
  }
  return { data: out, count: n };
}
