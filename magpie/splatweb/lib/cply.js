// cply.js — decoder for splat-transform / SuperSplat "compressed PLY"
// Gaussian splats (the format of the dbdb stamp pack). Structure: an
// ASCII PLY header, then `chunk` records (18 floats: per-256-splat
// min/max for position, log-scale, colour) and `vertex` records (4
// uint32: packed position 11/10/11, packed rotation 2+10/10/10, packed
// scale 11/10/11, packed colour 8888). Output is our renderer's 14-float
// splat layout, re-based so the element's floor sits at y=0, centred in
// x/z, in real metres.
import { FLOATS_PER_SPLAT } from './splat-renderer.js';

const SQRT2 = Math.SQRT2;

function parseHeader(bytes) {
  const text = new TextDecoder().decode(bytes.subarray(0, 4096));
  const end = text.indexOf('end_header');
  if (end < 0) throw new Error('no PLY header');
  const headerLen = end + 'end_header'.length + 1;
  let chunks = 0, verts = 0;
  for (const line of text.slice(0, end).split('\n')) {
    const m = line.match(/^element (\w+) (\d+)/);
    if (m && m[1] === 'chunk') chunks = +m[2];
    if (m && m[1] === 'vertex') verts = +m[2];
  }
  if (!chunks || !verts) throw new Error('not a compressed splat PLY');
  return { headerLen, chunks, verts };
}

// opts: at [x,y,z] world offset for the centred, floor-based element;
// yaw radians; scale uniform (default 1 — the data is in real metres);
// alphaMin drops near-transparent splats.
// stride N keeps every Nth splat, scaling the survivors up by √N so
// coverage holds — the cheap client-side LOD for heavy elements.
// maxScale / maxAspect suppress the needle splats that low-density scan
// regions decode into (the "triangular spikey" look): each axis is capped,
// and any axis more than maxAspect× the smallest is pulled back.
export function decodeCompressedPly(ab, { at = [0, 0, 0], yaw = 0, scale = 1, alphaMin = 0.02, stride = 1,
  maxScale = 0.3, maxAspect = 7 } = {}) {
  const bytes = new Uint8Array(ab);
  const { headerLen, chunks, verts } = parseHeader(bytes);
  // header length is not guaranteed 4-aligned — slice to aligned copies
  const chunkF = new Float32Array(ab.slice(headerLen, headerLen + chunks * 72));
  const vertU = new Uint32Array(ab.slice(headerLen + chunks * 72, headerLen + chunks * 72 + verts * 16));

  // first pass: positions + bbox
  const pos = new Float32Array(verts * 3);
  let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
  for (let i = 0; i < verts; i++) {
    const c = (i >> 8) * 18;
    const pw = vertU[i * 4];
    const px = chunkF[c] + ((pw >>> 21) & 0x7ff) / 2047 * (chunkF[c + 3] - chunkF[c]);
    const py = chunkF[c + 1] + ((pw >>> 11) & 0x3ff) / 1023 * (chunkF[c + 4] - chunkF[c + 1]);
    const pz = chunkF[c + 2] + (pw & 0x7ff) / 2047 * (chunkF[c + 5] - chunkF[c + 2]);
    pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;
    if (px < mnx) mnx = px; if (px > mxx) mxx = px;
    if (py < mny) mny = py; if (py > mxy) mxy = py;
    if (pz < mnz) mnz = pz; if (pz > mxz) mxz = pz;
  }
  const cx = (mnx + mxx) / 2, cz = (mnz + mxz) / 2;
  const cy = Math.sin(yaw / 2), cw = Math.cos(yaw / 2);   // yaw quat (0, cy, 0, cw)
  const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);

  const out = new Float32Array(Math.ceil(verts / stride) * FLOATS_PER_SPLAT);
  const sizeUp = Math.sqrt(stride);
  let made = 0;
  for (let i = 0; i < verts; i += stride) {
    const c = (i >> 8) * 18;
    const colw = vertU[i * 4 + 3];
    // packed as (r<<24)|(g<<16)|(b<<8)|a
    const a = (colw & 0xff) / 255;
    if (a < alphaMin) continue;
    const o = made * FLOATS_PER_SPLAT;
    // position: recentre, yaw, offset
    const lx = (pos[i * 3] - cx) * scale, ly = (pos[i * 3 + 1] - mny) * scale, lz = (pos[i * 3 + 2] - cz) * scale;
    out[o] = at[0] + lx * cyaw + lz * syaw;
    out[o + 1] = at[1] + ly;
    out[o + 2] = at[2] - lx * syaw + lz * cyaw;
    // rotation: 2-bit largest-component index + 3×10-bit components
    const rw = vertU[i * 4 + 1];
    const largest = rw >>> 30;
    const v0 = ((rw >>> 20) & 0x3ff) / 1023 * SQRT2 - SQRT2 / 2;
    const v1 = ((rw >>> 10) & 0x3ff) / 1023 * SQRT2 - SQRT2 / 2;
    const v2 = (rw & 0x3ff) / 1023 * SQRT2 - SQRT2 / 2;
    const rest = Math.sqrt(Math.max(0, 1 - v0 * v0 - v1 * v1 - v2 * v2));
    // components ordered (x,y,z,w) with `largest` omitted and reinserted
    const q = [];
    let vi = 0;
    for (let k2 = 0; k2 < 4; k2++) q[k2] = (k2 === largest) ? rest : [v0, v1, v2][vi++];
    // compose with the yaw rotation: q' = qYaw ⊗ q
    out[o + 3] = cw * q[0] + cy * q[2];
    out[o + 4] = cw * q[1] + cy * q[3];
    out[o + 5] = cw * q[2] - cy * q[0];
    out[o + 6] = cw * q[3] - cy * q[1];
    // scale: log-space lerp then exp, with needle suppression
    const sw = vertU[i * 4 + 2];
    let s0 = Math.min(maxScale, Math.exp(chunkF[c + 6] + ((sw >>> 21) & 0x7ff) / 2047 * (chunkF[c + 9] - chunkF[c + 6])) * scale * sizeUp);
    let s1 = Math.min(maxScale, Math.exp(chunkF[c + 7] + ((sw >>> 11) & 0x3ff) / 1023 * (chunkF[c + 10] - chunkF[c + 7])) * scale * sizeUp);
    let s2 = Math.min(maxScale, Math.exp(chunkF[c + 8] + (sw & 0x7ff) / 2047 * (chunkF[c + 11] - chunkF[c + 8])) * scale * sizeUp);
    const smin = Math.max(1e-4, Math.min(s0, s1, s2)), cap = smin * maxAspect;
    out[o + 7] = Math.min(s0, cap);
    out[o + 8] = Math.min(s1, cap);
    out[o + 9] = Math.min(s2, cap);
    // colour: chunk-ranged rgb + absolute alpha
    out[o + 10] = chunkF[c + 12] + ((colw >>> 24) & 0xff) / 255 * (chunkF[c + 15] - chunkF[c + 12]);
    out[o + 11] = chunkF[c + 13] + ((colw >>> 16) & 0xff) / 255 * (chunkF[c + 16] - chunkF[c + 13]);
    out[o + 12] = chunkF[c + 14] + ((colw >>> 8) & 0xff) / 255 * (chunkF[c + 17] - chunkF[c + 14]);
    out[o + 13] = a;
    made++;
  }
  return {
    data: out.subarray(0, made * FLOATS_PER_SPLAT),
    count: made,
    dims: [(mxx - mnx) * scale, (mxy - mny) * scale, (mxz - mnz) * scale],
  };
}

export async function loadCompressedPly(url, opts) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
  return decodeCompressedPly(await r.arrayBuffer(), opts);
}
