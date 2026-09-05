// Organic/natural "growth" treatments for the LAM head-in-a-setting demos:
// clumps of real harvested dbdb foliage (fern/vine/hedge/canopy/pond, all
// CC BY 4.0, Botanical Garden Kiel · Simon Bethke — see ATTRIBUTION note in
// demo-lam-organic.html) placed as hair/crown/undergrowth around a LAM face.
//
// Verified by direct render (Sept 2026): fern, vine and hedge all read as
// clean recognizable foliage at 2000-point decimation. boulder/crag/rockface
// (the "calico" desert-rock scene) read as noisy/spiky at the same
// decimation and are NOT used here — a "mossy stone" idea was dropped
// rather than shipped rough (see fork report).
//
// A treatment is generative/parametric, not one bespoke look per entry: a
// small number of REAL verified base elements (fern/vine/hedge/canopy/pond)
// combined with placement RECIPES (crown, trailing, wild-tangle, sparse
// accent, undergrowth-base) and density/spread/tint parameters, so ~20
// distinct treatments come from genuinely different combinations rather
// than cosmetic renames of one look.
import { FLOATS_PER_SPLAT } from './splat-renderer.js';
import { loadDbdbCsv } from './dbdb-csv-loader.js';
import { qMul, qNormalize } from './pose-math.js';

const ELEMENT_FILES = {
  fern: 'third_party/dbdb-organic-csv/fern.csv',
  vine: 'third_party/dbdb-organic-csv/vine.csv',
  hedge: 'third_party/dbdb-organic-csv/hedge.csv',
  canopy: 'third_party/dbdb-organic-csv/canopy.csv',
  pond: 'third_party/dbdb-organic-csv/pond.csv',
};

const elementCache = {};
async function loadElement(id) {
  if (elementCache[id]) return elementCache[id];
  const { data, count } = await loadDbdbCsv(ELEMENT_FILES[id]);
  // recenter to the element's own bbox center + floor, so instances can be
  // placed by translation alone without each carrying the source scan's
  // arbitrary world offset
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    const o = i * FLOATS_PER_SPLAT;
    for (let k = 0; k < 3; k++) { const v = data[o + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  }
  const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2, floorY = mn[1];
  for (let i = 0; i < count; i++) {
    const o = i * FLOATS_PER_SPLAT;
    data[o] -= cx; data[o + 1] -= floorY; data[o + 2] -= cz;
  }
  const size = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
  const rec = { data, count, size };
  elementCache[id] = rec;
  return rec;
}
export async function preloadOrganicElements(ids) {
  await Promise.all([...new Set(ids)].map(loadElement));
}

function fibonacciHemisphere(n, yMin = 0.15) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const yFrac = yMin + (1 - yMin) * (i / Math.max(1, n - 1));
    const r = Math.sqrt(Math.max(0, 1 - yFrac * yFrac));
    const th = golden * i;
    pts.push([Math.cos(th) * r, yFrac, Math.sin(th) * r]);
  }
  return pts;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stamp `count` scaled/yawed/tinted instances of `el` at hemisphere points
// around (cx,cy,cz) radius `headR`, writing into `out` starting at float
// offset `o`. Returns the new offset. `instScale` in head-radii.
function stampInstances(out, o, el, { cx, cy, cz, headR, count, instScale, yMinFrac, seed, tint, jitter = 0.15 }) {
  const rnd = mulberry32(seed);
  const dirs = fibonacciHemisphere(count, yMinFrac);
  const elMaxDim = Math.max(el.size[0], el.size[1], el.size[2]) || 1;
  for (let i = 0; i < count; i++) {
    const [dx, dy, dz] = dirs[i];
    const jx = (rnd() - 0.5) * jitter, jz = (rnd() - 0.5) * jitter;
    const px = cx + (dx + jx) * headR, py = cy + dy * headR * 0.85, pz = cz + (dz + jz) * headR;
    const yaw = rnd() * Math.PI * 2;
    const s = (instScale * headR / elMaxDim) * (0.75 + 0.5 * rnd());
    const cyaw = Math.cos(yaw / 2), syaw = Math.sin(yaw / 2);
    for (let k = 0; k < el.count; k++) {
      const io = k * FLOATS_PER_SPLAT;
      const lx = el.data[io], ly = el.data[io + 1], lz = el.data[io + 2];
      // rotate (lx,lz) around Y by yaw
      const rxr = lx * Math.cos(yaw) - lz * Math.sin(yaw);
      const rzr = lx * Math.sin(yaw) + lz * Math.cos(yaw);
      const wx = px + rxr * s, wy = py + ly * s, wz = pz + rzr * s;
      // compose element's own quat with the instance yaw (Y axis)
      const eq = [el.data[io + 3], el.data[io + 4], el.data[io + 5], el.data[io + 6]];
      const yq = [0, syaw, 0, cyaw];
      const q = qNormalize(qMul(yq, eq));
      const oo = o + (i * el.count + k) * FLOATS_PER_SPLAT;
      out[oo] = wx; out[oo + 1] = wy; out[oo + 2] = wz;
      out[oo + 3] = q[0]; out[oo + 4] = q[1]; out[oo + 5] = q[2]; out[oo + 6] = q[3];
      out[oo + 7] = el.data[io + 7] * s; out[oo + 8] = el.data[io + 8] * s; out[oo + 9] = el.data[io + 9] * s;
      out[oo + 10] = Math.min(1, el.data[io + 10] * tint[0]);
      out[oo + 11] = Math.min(1, el.data[io + 11] * tint[1]);
      out[oo + 12] = Math.min(1, el.data[io + 12] * tint[2]);
      out[oo + 13] = el.data[io + 13];
    }
  }
  return o + count * el.count * FLOATS_PER_SPLAT;
}

// One recipe = one placement PATTERN. Each is parametrized (element, count,
// scale, tint, hemisphere-start) into several distinct TREATMENTS below.
function buildRecipe(bounds, { element, count, instScale, yMinFrac, seed, tint }) {
  const { mnx, mxx, mny, mxy, mnz, mxz } = bounds;
  const cx = (mnx + mxx) / 2, cz = (mnz + mxz) / 2;
  const headW = mxx - mnx, headH = mxy - mny;
  const headR = Math.max(headW, headH) * 0.5 * 1.15;
  const cy = (mxy + mny) / 2;
  const el = elementCache[element];
  const out = new Float32Array(count * el.count * FLOATS_PER_SPLAT);
  const n = stampInstances(out, 0, el, { cx, cy, cz, headR, count, instScale, yMinFrac, seed, tint });
  return { data: out.subarray(0, n), count: n / FLOATS_PER_SPLAT };
}

const GREEN = [1, 1, 1], AUTUMN = [1.25, 0.85, 0.55], PALE = [1.15, 1.15, 1.0], DEEP = [0.6, 0.85, 0.6];

// Blended crowns: 2-3 source elements sharing ONE hemisphere placement set
// (same instance count/yMinFrac -> same slot directions), so this is a real
// interpolation rather than the "mixed-*" treatments above (which just
// concatenate two independently-placed patches side by side). Per slot, a
// weighted random pick chooses which source's element/scale stamps there —
// weights control the blend ratio, so as they shift the crown reads as
// fading from one foliage to another rather than a hard 50/50 split. Every
// slot ALSO gets the full weighted-average tint of all sources (not just
// its own pick's tint), so even a "pure fern" slot picks up a wash of the
// other source's colour — the actual "blur together" effect, since a real
// point-for-point geometric interpolation between different plants' scans
// has no meaningful correspondence (different topologies entirely).
function buildBlendedCrown(bounds, sources, { count, yMinFrac, seed, jitter = 0.15 }) {
  const { mnx, mxx, mny, mxy, mnz, mxz } = bounds;
  const cx = (mnx + mxx) / 2, cz = (mnz + mxz) / 2;
  const headW = mxx - mnx, headH = mxy - mny;
  const headR = Math.max(headW, headH) * 0.5 * 1.15;
  const cy = (mxy + mny) / 2;
  const rnd = mulberry32(seed);
  const dirs = fibonacciHemisphere(count, yMinFrac);
  const wsum = sources.reduce((s, x) => s + x.weight, 0);
  const cum = []; let acc = 0;
  for (const s of sources) { acc += s.weight / wsum; cum.push(acc); }
  const blendedTint = [0, 0, 0];
  for (const s of sources) { for (let k = 0; k < 3; k++) blendedTint[k] += s.tint[k] * (s.weight / wsum); }

  const maxElCount = Math.max(...sources.map((s) => elementCache[s.element].count));
  const out = new Float32Array(count * maxElCount * FLOATS_PER_SPLAT);
  for (let i = 0; i < count; i++) {
    const r = rnd();
    let pick = sources[sources.length - 1];
    for (let k = 0; k < cum.length; k++) { if (r <= cum[k]) { pick = sources[k]; break; } }
    const el = elementCache[pick.element];
    const [dx, dy, dz] = dirs[i];
    const jx = (rnd() - 0.5) * jitter, jz = (rnd() - 0.5) * jitter;
    const px = cx + (dx + jx) * headR, py = cy + dy * headR * 0.85, pz = cz + (dz + jz) * headR;
    const yaw = rnd() * Math.PI * 2;
    const cyaw = Math.cos(yaw / 2), syaw = Math.sin(yaw / 2);
    const elMaxDim = Math.max(el.size[0], el.size[1], el.size[2]) || 1;
    const s = (pick.instScale * headR / elMaxDim) * (0.75 + 0.5 * rnd());
    // fade a fraction of instances toward transparent — "fading bits",
    // distinct from the blend-selection above (which picks WHAT stamps,
    // this decides whether the pick is fully solid or ghosted into the mix)
    const fadeAlpha = rnd() < 0.2 ? 0.35 + rnd() * 0.4 : 1;
    for (let k = 0; k < el.count; k++) {
      const io = k * FLOATS_PER_SPLAT;
      const lx = el.data[io], ly = el.data[io + 1], lz = el.data[io + 2];
      const rxr = lx * Math.cos(yaw) - lz * Math.sin(yaw);
      const rzr = lx * Math.sin(yaw) + lz * Math.cos(yaw);
      const wx = px + rxr * s, wy = py + ly * s, wz = pz + rzr * s;
      const eq = [el.data[io + 3], el.data[io + 4], el.data[io + 5], el.data[io + 6]];
      const yq = [0, syaw, 0, cyaw];
      const q = qNormalize(qMul(yq, eq));
      // fixed maxElCount stride per slot (NOT el.count, which varies by
      // which element got picked) — a slot whose element has fewer splats
      // than maxElCount just leaves the remainder of its reserved region
      // at the buffer's zero-init default (alpha 0 -> invisible, harmless).
      const oo = (i * maxElCount + k) * FLOATS_PER_SPLAT;
      out[oo] = wx; out[oo + 1] = wy; out[oo + 2] = wz;
      out[oo + 3] = q[0]; out[oo + 4] = q[1]; out[oo + 5] = q[2]; out[oo + 6] = q[3];
      out[oo + 7] = el.data[io + 7] * s; out[oo + 8] = el.data[io + 8] * s; out[oo + 9] = el.data[io + 9] * s;
      out[oo + 10] = Math.min(1, el.data[io + 10] * blendedTint[0]);
      out[oo + 11] = Math.min(1, el.data[io + 11] * blendedTint[1]);
      out[oo + 12] = Math.min(1, el.data[io + 12] * blendedTint[2]);
      out[oo + 13] = el.data[io + 13] * fadeAlpha;
    }
  }
  return { data: out, count: out.length / FLOATS_PER_SPLAT };
}

// 20 treatments: 5 elements x ~4 placement/tint variants each, all sharing
// the same two verified mechanisms (real dbdb foliage + hemisphere
// stamping) — genuinely different combinations, not renamed duplicates.
export const ORGANIC_TREATMENTS = [
  { id: 'fern-crown-light', label: 'Fern crown, light', elements: ['fern'], recipe: (b) => buildRecipe(b, { element: 'fern', count: 6, instScale: 0.55, yMinFrac: 0.35, seed: 1, tint: GREEN }) },
  { id: 'fern-crown-full', label: 'Fern crown, full', elements: ['fern'], recipe: (b) => buildRecipe(b, { element: 'fern', count: 12, instScale: 0.6, yMinFrac: 0.2, seed: 2, tint: GREEN }) },
  { id: 'fern-crown-autumn', label: 'Fern crown, autumn tint', elements: ['fern'], recipe: (b) => buildRecipe(b, { element: 'fern', count: 10, instScale: 0.6, yMinFrac: 0.25, seed: 3, tint: AUTUMN }) },
  { id: 'fern-sparse-accent', label: 'Fern, sparse accent', elements: ['fern'], recipe: (b) => buildRecipe(b, { element: 'fern', count: 3, instScale: 0.5, yMinFrac: 0.45, seed: 4, tint: GREEN }) },

  { id: 'vine-trail-short', label: 'Vine, short trail', elements: ['vine'], recipe: (b) => buildRecipe(b, { element: 'vine', count: 8, instScale: 0.5, yMinFrac: 0.3, seed: 5, tint: GREEN }) },
  { id: 'vine-trail-long', label: 'Vine, long trailing', elements: ['vine'], recipe: (b) => buildRecipe(b, { element: 'vine', count: 8, instScale: 0.85, yMinFrac: 0.15, seed: 6, tint: DEEP }) },
  { id: 'vine-wild-tangle', label: 'Vine, wild tangle', elements: ['vine'], recipe: (b) => buildRecipe(b, { element: 'vine', count: 16, instScale: 0.55, yMinFrac: 0.1, seed: 7, tint: GREEN }) },
  { id: 'vine-pale-accent', label: 'Vine, pale accent', elements: ['vine'], recipe: (b) => buildRecipe(b, { element: 'vine', count: 5, instScale: 0.6, yMinFrac: 0.4, seed: 8, tint: PALE }) },

  { id: 'hedge-tidy', label: 'Hedge, tidy crop', elements: ['hedge'], recipe: (b) => buildRecipe(b, { element: 'hedge', count: 7, instScale: 0.45, yMinFrac: 0.4, seed: 9, tint: DEEP }) },
  { id: 'hedge-wild', label: 'Hedge, wild growth', elements: ['hedge'], recipe: (b) => buildRecipe(b, { element: 'hedge', count: 14, instScale: 0.6, yMinFrac: 0.15, seed: 10, tint: GREEN }) },
  { id: 'hedge-autumn', label: 'Hedge, autumn', elements: ['hedge'], recipe: (b) => buildRecipe(b, { element: 'hedge', count: 10, instScale: 0.55, yMinFrac: 0.25, seed: 11, tint: AUTUMN }) },
  { id: 'hedge-full-mane', label: 'Hedge, full mane', elements: ['hedge'], recipe: (b) => buildRecipe(b, { element: 'hedge', count: 18, instScale: 0.65, yMinFrac: 0.05, seed: 12, tint: GREEN }) },

  { id: 'canopy-overhead-light', label: 'Canopy, light cover', elements: ['canopy'], recipe: (b) => buildRecipe(b, { element: 'canopy', count: 4, instScale: 0.9, yMinFrac: 0.55, seed: 13, tint: GREEN }) },
  { id: 'canopy-overhead-dense', label: 'Canopy, dense cover', elements: ['canopy'], recipe: (b) => buildRecipe(b, { element: 'canopy', count: 7, instScale: 1.0, yMinFrac: 0.45, seed: 14, tint: DEEP }) },
  { id: 'canopy-autumn', label: 'Canopy, autumn', elements: ['canopy'], recipe: (b) => buildRecipe(b, { element: 'canopy', count: 6, instScale: 0.95, yMinFrac: 0.5, seed: 15, tint: AUTUMN }) },

  { id: 'pond-base-ring', label: 'Pond, base ring', elements: ['pond'], recipe: (b) => buildRecipe(b, { element: 'pond', count: 5, instScale: 0.7, yMinFrac: 0.5, seed: 16, tint: PALE }) },
  { id: 'pond-full-surround', label: 'Pond, full surround', elements: ['pond'], recipe: (b) => buildRecipe(b, { element: 'pond', count: 9, instScale: 0.6, yMinFrac: 0.35, seed: 17, tint: GREEN }) },

  { id: 'mixed-undergrowth', label: 'Mixed undergrowth', elements: ['fern', 'hedge'], recipe: (b) => {
    const a = buildRecipe(b, { element: 'fern', count: 6, instScale: 0.5, yMinFrac: 0.3, seed: 18, tint: GREEN });
    const c = buildRecipe(b, { element: 'hedge', count: 6, instScale: 0.5, yMinFrac: 0.3, seed: 19, tint: DEEP });
    const out = new Float32Array(a.count * FLOATS_PER_SPLAT + c.count * FLOATS_PER_SPLAT);
    out.set(a.data, 0); out.set(c.data, a.count * FLOATS_PER_SPLAT);
    return { data: out, count: a.count + c.count };
  } },
  { id: 'mixed-vine-fern', label: 'Mixed vine + fern', elements: ['vine', 'fern'], recipe: (b) => {
    const a = buildRecipe(b, { element: 'vine', count: 6, instScale: 0.6, yMinFrac: 0.2, seed: 20, tint: GREEN });
    const c = buildRecipe(b, { element: 'fern', count: 5, instScale: 0.5, yMinFrac: 0.35, seed: 21, tint: GREEN });
    const out = new Float32Array(a.count * FLOATS_PER_SPLAT + c.count * FLOATS_PER_SPLAT);
    out.set(a.data, 0); out.set(c.data, a.count * FLOATS_PER_SPLAT);
    return { data: out, count: a.count + c.count };
  } },
  // Blended crowns (per owner request): 2-3 sources genuinely interpolated
  // via shared hemisphere slots + weighted per-slot picks + full blended
  // tint on every slot — see buildBlendedCrown's comment for why this beats
  // literal point-for-point geometric interpolation between different
  // plants' scans.
  { id: 'blend-fern-vine', label: 'Blend: fern <-> vine', elements: ['fern', 'vine'], recipe: (b) => buildBlendedCrown(b, [
    { element: 'fern', tint: GREEN, instScale: 0.55, weight: 0.55 },
    { element: 'vine', tint: DEEP, instScale: 0.6, weight: 0.45 },
  ], { count: 12, yMinFrac: 0.25, seed: 26 }) },
  { id: 'blend-hedge-canopy', label: 'Blend: hedge <-> canopy', elements: ['hedge', 'canopy'], recipe: (b) => buildBlendedCrown(b, [
    { element: 'hedge', tint: AUTUMN, instScale: 0.55, weight: 0.6 },
    { element: 'canopy', tint: GREEN, instScale: 0.9, weight: 0.4 },
  ], { count: 10, yMinFrac: 0.35, seed: 27 }) },
  { id: 'blend-garden-triad', label: 'Blend: fern/vine/hedge triad', elements: ['fern', 'vine', 'hedge'], recipe: (b) => buildBlendedCrown(b, [
    { element: 'fern', tint: GREEN, instScale: 0.5, weight: 0.34 },
    { element: 'vine', tint: PALE, instScale: 0.55, weight: 0.33 },
    { element: 'hedge', tint: AUTUMN, instScale: 0.5, weight: 0.33 },
  ], { count: 14, yMinFrac: 0.2, seed: 28 }) },

  { id: 'garden-riot', label: 'Garden riot (all four)', elements: ['fern', 'vine', 'hedge', 'canopy'], recipe: (b) => {
    const parts = [
      buildRecipe(b, { element: 'fern', count: 4, instScale: 0.5, yMinFrac: 0.35, seed: 22, tint: GREEN }),
      buildRecipe(b, { element: 'vine', count: 4, instScale: 0.55, yMinFrac: 0.2, seed: 23, tint: DEEP }),
      buildRecipe(b, { element: 'hedge', count: 4, instScale: 0.5, yMinFrac: 0.3, seed: 24, tint: AUTUMN }),
      buildRecipe(b, { element: 'canopy', count: 3, instScale: 0.85, yMinFrac: 0.55, seed: 25, tint: GREEN }),
    ];
    const total = parts.reduce((s, p) => s + p.count, 0);
    const out = new Float32Array(total * FLOATS_PER_SPLAT);
    let off = 0;
    for (const p of parts) { out.set(p.data, off); off += p.count * FLOATS_PER_SPLAT; }
    return { data: out, count: total };
  } },
];

export async function preloadAllOrganicElements() {
  await preloadOrganicElements(['fern', 'vine', 'hedge', 'canopy', 'pond']);
}
