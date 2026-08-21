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

import { flattenToEdits, evalEdits, chunkEdits, packEditData, groundWgsl } from './sdf-editlist.js';

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
 * The safe binned field, JS twin of the WGSL below — verification only.
 *
 * Near the surface (|d| ≤ band) the cell fold is EXACT: every edit whose
 * surface can come within `band` of p is binned in p's cell by construction.
 * Beyond the band the cell fold OVER-estimates (missing far edits), and an
 * over-estimated SDF makes a sphere-tracer overstep. So when the cell fold
 * finds nothing within the band, return a conservative LOWER bound instead:
 * max(band, min over chunks of (|p−centre| − radius)). Both terms provably
 * never exceed the true distance there — safe to march, exact where it counts.
 */
export function evalBinnedSafe(edits, binned, chunks, p, opts = {}) {
  const band = binned.grid.band;
  const near = evalBinnedField(edits, binned, p);
  let d = near.d, color = near.color;
  if (opts.ground) {
    const gd = p[1] - opts.ground.y;   // exact plane joins the fold everywhere
    if (gd < d) { d = gd; color = opts.ground.color || [0.2, 0.22, 0.18]; }
  }
  if (d <= band) return { d, color };
  let lb = opts.ground ? p[1] - opts.ground.y : 1e9;
  for (const [cx, cy, cz, cr] of chunks) {
    lb = Math.min(lb, Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz) - cr);
  }
  return { d: Math.max(band, lb), color };
}

/**
 * WGSL for the storage-buffer, per-brick binned field — the production form.
 * Four read-only storage buffers on one bind group: the packed edit data, the
 * CSR bin index (binStart/binEdits), and gridData = [origin.xyz, cell,
 * dims.xyz, band] followed by NCHUNK chunk spheres (centre.xyz, radius) for
 * the far-field lower bound. Entry is ${prefix}editField(p)->vec4f so it
 * drops into the same cacheSceneSample seam as the flat fold.
 * Per-sample cost: the handful of edits in p's cell — O(edits-near-brick).
 */
export function generateBinnedFieldWgsl(nChunks, opts = {}) {
  const P = (n) => (opts.prefix || 'lx_') + n;
  const g = opts.group != null ? opts.group : 1;
  const b = opts.binding != null ? opts.binding : 0;
  return `// ===== Lucid → binned edit list (storage buffers, per-brick trim) =====
const ${P('NCHUNK')}: u32 = ${nChunks}u;
@group(${g}) @binding(${b}) var<storage, read> ${P('editData')}: array<f32>;
@group(${g}) @binding(${b + 1}) var<storage, read> ${P('binStart')}: array<u32>;
@group(${g}) @binding(${b + 2}) var<storage, read> ${P('binEdits')}: array<u32>;
@group(${g}) @binding(${b + 3}) var<storage, read> ${P('gridData')}: array<f32>;
fn ${P('cellIndex')}(p: vec3f) -> i32 {
  let o = vec3f(${P('gridData')}[0], ${P('gridData')}[1], ${P('gridData')}[2]);
  let cell = ${P('gridData')}[3];
  let d = vec3i(i32(${P('gridData')}[4]), i32(${P('gridData')}[5]), i32(${P('gridData')}[6]));
  let c = vec3i(floor((p - o) / cell));
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
fn ${P('editField')}(p: vec3f) -> vec4f {
  var d = 1e9;
  var col = vec3f(0.6, 0.6, 0.6);
  let band = ${P('gridData')}[7];
  let ci = ${P('cellIndex')}(p);
  if (ci >= 0) {
    let s = ${P('binStart')}[u32(ci)];
    let e = ${P('binStart')}[u32(ci) + 1u];
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
  }
${opts.ground ? groundWgsl(opts.ground) : ''}  // Beyond the band the cell fold over-estimates (missing far edits) and a
  // sphere-tracer would overstep. Swap in a conservative lower bound from the
  // chunk spheres: max(band, min |p-centre|-radius) never exceeds true d there.
  // (The ground plane is exact everywhere, so it both joins the fold above and
  // seeds the lower bound here.)
  if (d > band) {
    var lb = ${opts.ground ? 'gd' : '1e9'};
    for (var ch = 0u; ch < ${P('NCHUNK')}; ch = ch + 1u) {
      let co = 8u + ch * 4u;
      let cc = vec3f(${P('gridData')}[co], ${P('gridData')}[co + 1u], ${P('gridData')}[co + 2u]);
      lb = min(lb, length(p - cc) - ${P('gridData')}[co + 3u]);
    }
    d = max(band, lb);
  }
  return vec4f(d, col);
}
`;
}

/**
 * Everything the splice needs to run a scene binned: the WGSL (entry
 * ${prefix}editField, group-1 storage bindings) plus the four typed arrays to
 * upload. `cell`/`band` size the bin grid (default 1.0/0.75 — a few edits per
 * cell at animal scale; the safety fallback makes any choice correct).
 */
export function buildBinnedFieldData(scene, opts = {}) {
  const { edits, binned, grid, unsupported } = binScene(scene, {
    cell: opts.cell != null ? opts.cell : 1.0,
    band: opts.band != null ? opts.band : 0.75
  });
  const chunks = chunkEdits(edits, opts.chunk || 16);
  const wgsl = generateBinnedFieldWgsl(chunks.length, opts);
  const gridData = Float32Array.from([
    ...grid.origin, grid.cell, ...grid.dims, grid.band, ...chunks.flat()
  ]);
  return {
    wgsl,
    editData: Float32Array.from(packEditData(edits)),
    binStart: binned.cellStart,          // Uint32Array, nCells+1
    binEdits: binned.cellEdits,          // Uint32Array
    gridData,
    count: edits.length,
    cells: grid.nCells,
    avgPerCell: binned.avgPerCell,
    maxPerCell: binned.maxPerCell,
    edits, binned, chunks, unsupported
  };
}
