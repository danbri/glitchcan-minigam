// gltf-splats.js — minimal in-browser GLB/VRM → Gaussian-splat sampler.
// Parses binary glTF 2.0 (which .vrm files are, plus extensions we ignore),
// walks the node hierarchy, area-samples the triangle surface, samples the
// base-color texture at each point, and emits splats in our 14-float layout
// (see splat-renderer.js): surface-tangent ellipses with baked lambert.
//
// Deliberate limits (sketch-sized): triangles mode 4 only; skins are
// ignored (you get the bind/T-pose); morph targets, sparse accessors,
// KHR material extensions and non-baseColor maps are ignored.
import { mulberry32 } from './pose-math.js';
import { FLOATS_PER_SPLAT } from './splat-renderer.js';

const COMP = {
  5120: Int8Array, 5121: Uint8Array, 5122: Int16Array,
  5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array,
};
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function parseGlb(ab) {
  const dv = new DataView(ab);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB');
  let off = 12, json = null, bin = null;
  while (off < ab.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    const chunk = ab.slice(off + 8, off + 8 + len);
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(chunk));
    else if (type === 0x004E4942) bin = chunk;
    off += 8 + len + (len % 4 ? 4 - len % 4 : 0);
  }
  return { json, bin };
}

// bufferView indirection: views[i] = { buffer, offset, stride } — plain
// views point into the BIN chunk; EXT_meshopt_compression views are
// decoded up-front (official MIT meshoptimizer decoder, loaded from CDN
// only when a model actually uses the extension).
async function prepareViews(gltf, bin) {
  const views = (gltf.bufferViews || []).map(bv => ({
    buffer: bin, offset: bv.byteOffset || 0, stride: bv.byteStride || 0, byteLength: bv.byteLength,
  }));
  if (!(gltf.extensionsUsed || []).includes('EXT_meshopt_compression')) return views;
  const { MeshoptDecoder } = await import('https://cdn.jsdelivr.net/npm/meshoptimizer@0.20.0/meshopt_decoder.module.js');
  await MeshoptDecoder.ready;
  gltf.bufferViews.forEach((bv, i) => {
    const ext = bv.extensions?.EXT_meshopt_compression;
    if (!ext) return;
    const out = new Uint8Array(ext.count * ext.byteStride);
    MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride,
      new Uint8Array(bin, ext.byteOffset || 0, ext.byteLength), ext.mode, ext.filter);
    views[i] = { buffer: out.buffer, offset: 0, stride: ext.byteStride, byteLength: out.byteLength };
  });
  return views;
}

function readAccessor(gltf, views, idx) {
  const acc = gltf.accessors[idx];
  const v = views[acc.bufferView];
  const T = COMP[acc.componentType];
  const n = NCOMP[acc.type];
  const stride = (v.stride || n * T.BYTES_PER_ELEMENT) / T.BYTES_PER_ELEMENT;
  const base = v.offset + (acc.byteOffset || 0);
  const avail = Math.floor((v.buffer.byteLength - base) / T.BYTES_PER_ELEMENT);
  const want = acc.count === 0 ? 0 : stride * (acc.count - 1) + n;
  const src = new T(v.buffer, base, Math.min(want, avail));
  const out = new Float32Array(acc.count * n);
  const norm = acc.normalized ? (T === Uint8Array ? 255 : T === Uint16Array ? 65535
    : T === Int8Array ? 127 : T === Int16Array ? 32767 : 1) : 1;
  for (let i = 0; i < acc.count; i++) {
    for (let c = 0; c < n; c++) out[i * n + c] = (src[i * stride + c] || 0) / norm;
  }
  return { data: out, count: acc.count, n };
}

// column-major mat4 helpers
function matMul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
function matFromTRS(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q;
  return new Float32Array([
    (1 - 2 * (y * y + z * z)) * s[0], (2 * (x * y + w * z)) * s[0], (2 * (x * z - w * y)) * s[0], 0,
    (2 * (x * y - w * z)) * s[1], (1 - 2 * (x * x + z * z)) * s[1], (2 * (y * z + w * x)) * s[1], 0,
    (2 * (x * z + w * y)) * s[2], (2 * (y * z - w * x)) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ]);
}
const xfmPoint = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];
const xfmNormal = (m, p) => {
  const v = [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2],
  ];
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
function qFromZTo(n) {
  const w = 1 + n[2];
  if (w < 1e-6) return [1, 0, 0, 0];
  const l = Math.hypot(n[1], n[0], w);
  return [-n[1] / l, n[0] / l, 0, w / l];
}

async function textureFor(gltf, views, matIdx, cache) {
  if (matIdx == null) return null;
  if (cache.has(matIdx)) return cache.get(matIdx);
  const mat = gltf.materials?.[matIdx] || {};
  const pbr = mat.pbrMetallicRoughness || {};
  const entry = { factor: pbr.baseColorFactor || [1, 1, 1, 1], img: null };
  const texIdx = pbr.baseColorTexture?.index;
  if (texIdx != null) {
    const img = gltf.images?.[gltf.textures[texIdx].source];
    if (img?.bufferView != null) {
      const v = views[img.bufferView];
      const bytes = new Uint8Array(v.buffer, v.offset, v.byteLength);
      try {
        const bmp = await createImageBitmap(new Blob([bytes], { type: img.mimeType }));
        const w = Math.min(bmp.width, 512), h = Math.min(bmp.height, 512);
        const cv = new OffscreenCanvas(w, h);
        const ctx = cv.getContext('2d');
        ctx.drawImage(bmp, 0, 0, w, h);
        entry.img = { px: ctx.getImageData(0, 0, w, h).data, w, h };
      } catch { /* undecodable image → factor only */ }
    }
  }
  cache.set(matIdx, entry);
  return entry;
}

function sampleColor(tex, u, v) {
  if (!tex) return [0.75, 0.75, 0.75, 1];
  const f = tex.factor;
  if (!tex.img) return [f[0], f[1], f[2], f[3]];
  const { px, w, h } = tex.img;
  const x = Math.min(w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * w)));
  const y = Math.min(h - 1, Math.max(0, Math.floor((v - Math.floor(v)) * h)));
  const i = (y * w + x) * 4;
  return [px[i] / 255 * f[0], px[i + 1] / 255 * f[1], px[i + 2] / 255 * f[2], px[i + 3] / 255 * f[3]];
}

const xfmVec = (m, p) => [   // linear part only — for morph deltas
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2],
];

// Load a .glb/.vrm from url and sample it into splats.
// opts: count (splats), targetHeight (m; scales the model), at [x,y,z] (feet/world
// offset), yaw (radians), light [x,y,z] (baked lambert; null = unlit), seed,
// morphNames (array → returns per-splat morph POSITION deltas + normals,
// for pre-rigged faces; matched against mesh.extras.targetNames).
export async function loadGlbSplats(url, opts = {}) {
  const { count = 20000, targetHeight = null, at = [0, 0, 0], yaw = 0,
    light = [0.3, 0.75, 0.6], seed = 11, tint = null, morphNames = null } = opts;
  const ab = await (await fetch(url)).arrayBuffer();
  const { json: gltf, bin } = parseGlb(ab);
  const views = await prepareViews(gltf, bin);

  // gather world-transformed triangles
  const tris = [];   // {p0,p1,p2,n0,n1,n2,uv0,uv1,uv2,mat,area}
  const scene = gltf.scenes[gltf.scene || 0];
  const walk = (nodeIdx, parent) => {
    const node = gltf.nodes[nodeIdx];
    const local = node.matrix ? new Float32Array(node.matrix)
      : matFromTRS(node.translation, node.rotation, node.scale);
    const world = matMul(parent, local);
    if (node.mesh != null) {
      const meshIdx = node.mesh;
      const mesh = gltf.meshes[node.mesh];
      for (const prim of mesh.primitives) {
        if ((prim.mode ?? 4) !== 4 || prim.attributes.POSITION == null) continue;
        // morph targets: read POSITION deltas for the wanted names
        let morphData = null;
        if (morphNames && prim.targets && mesh.extras?.targetNames) {
          morphData = [];
          for (let wi = 0; wi < morphNames.length; wi++) {
            const ti = mesh.extras.targetNames.indexOf(morphNames[wi]);
            if (ti >= 0 && prim.targets[ti]?.POSITION != null) {
              morphData.push({ wi, data: readAccessor(gltf, views, prim.targets[ti].POSITION).data });
            }
          }
          if (!morphData.length) morphData = null;
        }
        const pos = readAccessor(gltf, views, prim.attributes.POSITION);
        const nrm = prim.attributes.NORMAL != null ? readAccessor(gltf, views, prim.attributes.NORMAL) : null;
        const uv = prim.attributes.TEXCOORD_0 != null ? readAccessor(gltf, views, prim.attributes.TEXCOORD_0) : null;
        const idx = prim.indices != null ? readAccessor(gltf, views, prim.indices).data : null;
        const nTri = (idx ? idx.length : pos.count) / 3;
        for (let t = 0; t < nTri; t++) {
          const ia = idx ? idx[t * 3] : t * 3, ib = idx ? idx[t * 3 + 1] : t * 3 + 1, ic = idx ? idx[t * 3 + 2] : t * 3 + 2;
          const p0 = xfmPoint(world, [pos.data[ia * 3], pos.data[ia * 3 + 1], pos.data[ia * 3 + 2]]);
          const p1 = xfmPoint(world, [pos.data[ib * 3], pos.data[ib * 3 + 1], pos.data[ib * 3 + 2]]);
          const p2 = xfmPoint(world, [pos.data[ic * 3], pos.data[ic * 3 + 1], pos.data[ic * 3 + 2]]);
          const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
          const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
          const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
          const area = Math.hypot(cx, cy, cz) / 2;
          if (area < 1e-12) continue;
          const fn = [cx / (2 * area), cy / (2 * area), cz / (2 * area)];
          const nAt = (i) => nrm ? xfmNormal(world, [nrm.data[i * 3], nrm.data[i * 3 + 1], nrm.data[i * 3 + 2]]) : fn;
          const uvAt = (i) => uv ? [uv.data[i * 2], uv.data[i * 2 + 1]] : [0, 0];
          tris.push({ p0, p1, p2, n0: nAt(ia), n1: nAt(ib), n2: nAt(ic),
            uv0: uvAt(ia), uv1: uvAt(ib), uv2: uvAt(ic), mat: prim.material, area,
            ia, ib, ic, morphData, world, meshIdx });
        }
      }
    }
    for (const c of node.children || []) walk(c, world);
  };
  const I = matFromTRS();
  for (const n of scene.nodes) walk(n, I);
  if (!tris.length) throw new Error('no triangles found');

  // decode the textures we need
  const cache = new Map();
  for (const t of tris) await textureFor(gltf, views, t.mat, cache);

  // model bbox → scale + centre
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const p of [t.p0, t.p1, t.p2]) {
    for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i]); mx[i] = Math.max(mx[i], p[i]); }
  }
  const height = mx[1] - mn[1];
  const scale = targetHeight ? targetHeight / height : 1;
  const cxm = (mn[0] + mx[0]) / 2, czm = (mn[2] + mx[2]) / 2;
  const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
  const place = (p) => {
    const x = (p[0] - cxm) * scale, y = (p[1] - mn[1]) * scale, z = (p[2] - czm) * scale;
    return [at[0] + x * cyaw + z * syaw, at[1] + y, at[2] - x * syaw + z * cyaw];
  };
  const rotN = (n) => [n[0] * cyaw + n[2] * syaw, n[1], -n[0] * syaw + n[2] * cyaw];

  // area-weighted sampling
  const cum = new Float32Array(tris.length);
  let total = 0;
  for (let i = 0; i < tris.length; i++) { total += tris[i].area; cum[i] = total; }
  const rnd = mulberry32(seed);
  const sSize = Math.sqrt((total * scale * scale) / count) * 0.72;
  const L = light ? (() => { const l = Math.hypot(...light); return [light[0] / l, light[1] / l, light[2] / l]; })() : null;

  const out = new Float32Array(count * FLOATS_PER_SPLAT);
  const morphOut = morphNames ? morphNames.map(() => new Float32Array(count * 3)) : null;
  const normalsOut = morphNames ? new Float32Array(count * 3) : null;
  const meshIdOut = morphNames ? new Uint16Array(count) : null;
  let w = 0, made = 0;
  for (let i = 0; i < count; i++) {
    const r = rnd() * total;
    let lo = 0, hi = tris.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; cum[mid] < r ? lo = mid + 1 : hi = mid; }
    const t = tris[lo];
    let a = rnd(), b = rnd();
    if (a + b > 1) { a = 1 - a; b = 1 - b; }
    const c = 1 - a - b;
    const lerp3 = (v0, v1, v2) => [v0[0] * c + v1[0] * a + v2[0] * b, v0[1] * c + v1[1] * a + v2[1] * b, v0[2] * c + v1[2] * a + v2[2] * b];
    const p = place(lerp3(t.p0, t.p1, t.p2));
    let n = lerp3(t.n0, t.n1, t.n2);
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    n = rotN([n[0] / nl, n[1] / nl, n[2] / nl]);
    const u = t.uv0[0] * c + t.uv1[0] * a + t.uv2[0] * b;
    const v = t.uv0[1] * c + t.uv1[1] * a + t.uv2[1] * b;
    const col = sampleColor(cache.get(t.mat), u, v);
    if (tint) { col[0] *= tint[0]; col[1] *= tint[1]; col[2] *= tint[2]; }
    if (col[3] < 0.4) continue;                       // cutout transparency
    if (morphOut && t.morphData) {
      for (const { wi, data } of t.morphData) {
        const dl = [
          data[t.ia * 3] * c + data[t.ib * 3] * a + data[t.ic * 3] * b,
          data[t.ia * 3 + 1] * c + data[t.ib * 3 + 1] * a + data[t.ic * 3 + 1] * b,
          data[t.ia * 3 + 2] * c + data[t.ib * 3 + 2] * a + data[t.ic * 3 + 2] * b,
        ];
        const dw = xfmVec(t.world, dl);
        const dx = dw[0] * scale, dy = dw[1] * scale, dz = dw[2] * scale;
        morphOut[wi][made * 3] = dx * cyaw + dz * syaw;
        morphOut[wi][made * 3 + 1] = dy;
        morphOut[wi][made * 3 + 2] = -dx * syaw + dz * cyaw;
      }
    }
    if (normalsOut) {
      normalsOut[made * 3] = n[0]; normalsOut[made * 3 + 1] = n[1]; normalsOut[made * 3 + 2] = n[2];
      meshIdOut[made] = t.meshIdx;
    }
    const sh = L ? 0.55 + 0.5 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) : 1;
    const q = qFromZTo(n);
    out[w++] = p[0]; out[w++] = p[1]; out[w++] = p[2];
    out[w++] = q[0]; out[w++] = q[1]; out[w++] = q[2]; out[w++] = q[3];
    out[w++] = sSize; out[w++] = sSize; out[w++] = sSize * 0.3;
    out[w++] = col[0] * sh; out[w++] = col[1] * sh; out[w++] = col[2] * sh; out[w++] = 1;
    made++;
  }
  const res = { data: out.subarray(0, made * FLOATS_PER_SPLAT), count: made,
    heightM: height * scale, sourceTris: tris.length };
  if (morphNames) {
    res.morphs = {};
    morphNames.forEach((nm, wi) => { res.morphs[nm] = morphOut[wi].subarray(0, made * 3); });
    res.normals = normalsOut.subarray(0, made * 3);
    res.meshIds = meshIdOut.subarray(0, made);
  }
  return res;
}
