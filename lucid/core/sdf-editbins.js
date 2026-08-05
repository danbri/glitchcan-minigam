/**
 * Spatial binning for the edit list — the GPU-scalable form of "trim at point
 * of use". Instead of every sample testing every edit's bound (the per-sample
 * cull in sdf-editlist.js), we bin edits into a coarse grid ONCE, so each grid
 * cell (one clipclop brick) folds only the handful of edits whose surface can
 * reach it. Bake cost drops from O(all edits) to O(edits-near-brick).
 *
 * This is the Dreams model: the scene is DATA (a flat edit buffer + a CSR bin
 * index), both live in GPU storage buffers, and the generate/bake pass reads
 * the bin for the brick it is filling. Editing the scene rewrites the buffers,
 * not the shader — no per-frame recompile.
 *
 * Exactness (narrow band). A clipclop brick stores a NARROW-BAND SDF: distance
 * matters near the surface, far distance is clamped. We bin an edit into every
 * cell its surface can come within `band` of (radius = bound + smooth-margin +
 * band). So for any sample whose true distance is within the band, its cell
 * holds every edit that could set that distance → the binned fold equals the
 * full fold EXACTLY in the band. Outside the band the binned field may read
 * larger (fewer edits), which the clipmap clamps anyway. Verified in Node.
 *
 * Pairs with sdf-editlist.js (flattenToEdits gives {op,k,xf.t,bound,...}; the
 * seed-uniform evalEdits(edits, p, idx) folds an arbitrary subset).
 */

import { flattenToEdits, evalEdits } from './sdf-editlist.js';

const OP_SMOOTH_UNION = 2, OP_SMOOTH_SUBTRACT = 3;
const STRIDE = 23; // must match sdf-editlist.js

/** Smooth-blend margin of an edit (the blend reaches k past contact). */
function editMargin(e) {
  return (e.op === OP_SMOOTH_UNION || e.op === OP_SMOOTH_SUBTRACT) ? (e.k || 0) : 0;
}

/**
 * A grid sized to hold every edit's band-expanded bound sphere.
 * @param {Array} edits - from flattenToEdits
 * @param {object} [opts] - { cell, band, pad }
 * @returns {{ origin:[3], cell:number, band:number, dims:[3], nCells:number }}
 */
export function computeGrid(edits, opts = {}) {
  const cell = opts.cell || 1.0;
  const band = opts.band != null ? opts.band : cell;
  const pad = opts.pad != null ? opts.pad : 1;
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const e of edits) {
    const R = e.bound + editMargin(e) + band;
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], e.xf.t[a] - R);
      hi[a] = Math.max(hi[a], e.xf.t[a] + R);
    }
  }
  if (!isFinite(lo[0])) { lo = [0, 0, 0]; hi = [0, 0, 0]; } // empty scene
  const origin = lo.map((v) => Math.floor(v / cell) * cell - pad * cell);
  const dims = hi.map((v, a) => Math.max(1, Math.ceil((v - origin[a]) / cell) + pad));
  return { origin, cell, band, dims, nCells: dims[0] * dims[1] * dims[2] };
}

/** Integer cell coords of a world point (unclamped). */
function cellCoord(grid, p) {
  return [
    Math.floor((p[0] - grid.origin[0]) / grid.cell),
    Math.floor((p[1] - grid.origin[1]) / grid.cell),
    Math.floor((p[2] - grid.origin[2]) / grid.cell)
  ];
}

/** Flat cell index of a world point, or -1 if outside the grid. */
export function cellIndexOf(grid, p) {
  const [cx, cy, cz] = cellCoord(grid, p);
  const [nx, ny, nz] = grid.dims;
  if (cx < 0 || cy < 0 || cz < 0 || cx >= nx || cy >= ny || cz >= nz) return -1;
  return (cz * ny + cy) * nx + cx;
}

/**
 * Bin edits into the grid. CSR layout: cellStart[nCells+1] gives each cell's
 * slice of cellEdits[]. An edit lands in every cell its (bound+margin+band)
 * sphere's AABB covers — a conservative superset, so the band fold stays exact.
 * @returns {{ grid, cellStart:Uint32Array, cellEdits:Uint32Array, maxPerCell:number, avgPerCell:number }}
 */
export function binEdits(edits, grid) {
  const [nx, ny, nz] = grid.dims;
  const counts = new Uint32Array(grid.nCells);
  const spans = []; // per edit: [x0,x1,y0,y1,z0,z1]

  for (const e of edits) {
    const R = e.bound + editMargin(e) + grid.band;
    const c0 = cellCoord(grid, [e.xf.t[0] - R, e.xf.t[1] - R, e.xf.t[2] - R]);
    const c1 = cellCoord(grid, [e.xf.t[0] + R, e.xf.t[1] + R, e.xf.t[2] + R]);
    const span = [
      Math.max(0, c0[0]), Math.min(nx - 1, c1[0]),
      Math.max(0, c0[1]), Math.min(ny - 1, c1[1]),
      Math.max(0, c0[2]), Math.min(nz - 1, c1[2])
    ];
    spans.push(span);
    for (let z = span[4]; z <= span[5]; z++)
      for (let y = span[2]; y <= span[3]; y++)
        for (let x = span[0]; x <= span[1]; x++)
          counts[(z * ny + y) * nx + x]++;
  }

  // prefix sum → cellStart
  const cellStart = new Uint32Array(grid.nCells + 1);
  for (let i = 0; i < grid.nCells; i++) cellStart[i + 1] = cellStart[i] + counts[i];
  const total = cellStart[grid.nCells];
  const cellEdits = new Uint32Array(total);
  const cursor = cellStart.slice(0, grid.nCells);

  // scatter edit indices in ASCENDING order so each cell folds edits in the
  // same global order the flat list would (subtract/blend order preserved).
  for (let ei = 0; ei < edits.length; ei++) {
    const [x0, x1, y0, y1, z0, z1] = spans[ei];
    for (let z = z0; z <= z1; z++)
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const ci = (z * ny + y) * nx + x;
          cellEdits[cursor[ci]++] = ei;
        }
  }

  let maxPerCell = 0, nonEmpty = 0, sum = 0;
  for (let i = 0; i < grid.nCells; i++) {
    if (counts[i] > 0) { nonEmpty++; sum += counts[i]; maxPerCell = Math.max(maxPerCell, counts[i]); }
  }
  return { grid, cellStart, cellEdits, maxPerCell, avgPerCell: nonEmpty ? sum / nonEmpty : 0 };
}

/**
 * Fold only the edits binned to p's cell → { d, color }. The CPU twin of the
 * GPU per-brick bake. Outside the grid it returns empty space (d large): the
 * grid is sized to enclose all geometry, so that never happens for real points.
 */
export function evalBinnedField(edits, binned, p) {
  const ci = cellIndexOf(binned.grid, p);
  if (ci < 0) return { d: 1e9, color: [0.6, 0.6, 0.6] };
  const s = binned.cellStart[ci], e = binned.cellStart[ci + 1];
  const idx = [];
  for (let j = s; j < e; j++) idx.push(binned.cellEdits[j]);
  return evalEdits(edits, p, idx);
}

/** Convenience: flatten a scene, size a grid, and bin it in one call. */
export function binScene(scene, opts = {}) {
  const { edits, unsupported } = flattenToEdits(scene);
  const grid = computeGrid(edits, opts);
  const binned = binEdits(edits, grid);
  return { edits, binned, grid, unsupported };
}

/**
 * WGSL for the storage-buffer, per-brick binned field. Unlike the spliced
 * edit-list (a baked private array), this reads three storage buffers, so the
 * scene is live data the bake pass indexes by brick. Emitted as an integration
 * target: the engine binds editData/binStart/binEdits + a grid uniform. Group
 * and binding numbers are parameters so they slot into the engine's layout.
 */
export function generateBinnedEditWgsl(opts = {}) {
  const P = (n) => (opts.prefix || 'lx_') + n;
  const g = opts.group != null ? opts.group : 3;
  const b = opts.binding != null ? opts.binding : 0;
  return `// ===== Lucid → binned edit list (storage buffers, per-brick trim) =====
struct ${P('Grid')} { origin: vec3f, cell: f32, dims: vec3i, band: f32 };
@group(${g}) @binding(${b}) var<storage, read> ${P('editData')}: array<f32>;
@group(${g}) @binding(${b + 1}) var<storage, read> ${P('binStart')}: array<u32>;
@group(${g}) @binding(${b + 2}) var<storage, read> ${P('binEdits')}: array<u32>;
@group(${g}) @binding(${b + 3}) var<uniform> ${P('grid')}: ${P('Grid')};
fn ${P('cellIndex')}(p: vec3f) -> i32 {
  let c = vec3i(floor((p - ${P('grid')}.origin) / ${P('grid')}.cell));
  let d = ${P('grid')}.dims;
  if (any(c < vec3i(0)) || any(c >= d)) { return -1; }
  return (c.z * d.y + c.y) * d.x + c.x;
}
fn ${P('editPrim')}(pl: vec3f, prim: i32, pr: vec3f) -> f32 {
  if (prim == 0) { return length(pl) - pr.x; }
  if (prim == 1) { let q = abs(pl) - pr; return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0); }
  if (prim == 2) { return length(vec2f(length(pl.xz) - pr.x, pl.y)) - pr.y; }
  if (prim == 3) { let dd = abs(vec2f(length(pl.xz), pl.y)) - vec2f(pr.y, pr.x); return min(max(dd.x, dd.y), 0.0) + length(max(dd, vec2f(0.0))); }
  if (prim == 4) { var q = pl; q.y = q.y - clamp(q.y, -pr.x, pr.x); return length(q) - pr.y; }
  if (prim == 5) { let k0 = length(pl / pr); let k1 = length(pl / (pr * pr)); return k0 * (k0 - 1.0) / k1; }
  return 1e9;
}
fn ${P('binnedField')}(p: vec3f) -> vec4f {
  var d = 1e9;
  var col = vec3f(0.6, 0.6, 0.6);
  let ci = ${P('cellIndex')}(p);
  if (ci < 0) { return vec4f(d, col); }
  let s = ${P('binStart')}[ci];
  let e = ${P('binStart')}[ci + 1];
  for (var j = s; j < e; j = j + 1u) {
    let o = ${P('binEdits')}[j] * ${STRIDE}u;
    let prim = i32(${P('editData')}[o]);
    let op = i32(${P('editData')}[o + 1u]);
    let k = ${P('editData')}[o + 2u];
    let sc = ${P('editData')}[o + 3u];
    let r0 = vec3f(${P('editData')}[o + 4u], ${P('editData')}[o + 5u], ${P('editData')}[o + 6u]);
    let r1 = vec3f(${P('editData')}[o + 7u], ${P('editData')}[o + 8u], ${P('editData')}[o + 9u]);
    let r2 = vec3f(${P('editData')}[o + 10u], ${P('editData')}[o + 11u], ${P('editData')}[o + 12u]);
    let t = vec3f(${P('editData')}[o + 13u], ${P('editData')}[o + 14u], ${P('editData')}[o + 15u]);
    let pr = vec3f(${P('editData')}[o + 16u], ${P('editData')}[o + 17u], ${P('editData')}[o + 18u]);
    let c = vec3f(${P('editData')}[o + 19u], ${P('editData')}[o + 20u], ${P('editData')}[o + 21u]);
    let bound = ${P('editData')}[o + 22u];
    if (op == 0 || op == 2) {
      let margin = select(0.0, k, op == 2);
      if (length(p - t) - bound - margin > d) { continue; }
    }
    let rel = p - t;
    let local = vec3f(dot(r0, rel), dot(r1, rel), dot(r2, rel)) / sc;
    let ed = ${P('editPrim')}(local, prim, pr) * sc;
    if (op == 0) {
      if (ed < d) { d = ed; col = c; }
    } else if (op == 2) {
      let h = clamp(0.5 + 0.5 * (ed - d) / k, 0.0, 1.0);
      d = mix(ed, d, h) - k * h * (1.0 - h);
      col = mix(c, col, h);
    } else if (op == 1) {
      d = max(d, -ed);
    } else if (op == 3) {
      let h = clamp(0.5 - 0.5 * (d + ed) / k, 0.0, 1.0);
      d = mix(d, -ed, h) + k * h * (1.0 - h);
    }
  }
  return vec4f(d, col);
}
`;
}
