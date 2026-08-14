#!/usr/bin/env node
/* object-scout.mjs — FIND THE THINGS IN A SCAN.
 *
 * The wall scout hunts flat surfaces and the view scout hunts pretty
 * cameras. Neither finds OBJECTS, and objects are what the clone-stamp
 * pack is made of: a rusted car, a shack, a fern. Picking those boxes
 * by hand meant flying around a scene guessing coordinates.
 *
 * Method — shortlist by heuristic, eyes decide (the ABCD doctrine):
 *   1. Load dream.html?scene=K&edit=1 headless and take the scan's
 *      world points from __dream.centers.
 *   2. Voxelise. Drop the GROUND: the lowest occupied band over most
 *      of the footprint, or every object stays welded to the floor and
 *      the whole scene comes back as one blob.
 *   3. Connected components over the remaining voxels (26-neighbour).
 *   4. Keep components of plausible object size and print a ready-to-
 *      paste `splatpack.mjs clip` line for each, biggest first.
 *
 * It does not decide anything. It turns "fly around and guess" into a
 * list to look at.
 *
 * Usage:
 *   node magpie/dbdb/tools/object-scout.mjs carshop
 *   node magpie/dbdb/tools/object-scout.mjs watertower --voxel 0.3 --min 400
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const argv = process.argv.slice(2);
const scene = argv.find(a => !a.startsWith('--')) || 'carshop';
const num = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : parseFloat(argv[i + 1]); };
const VOX = num('voxel', 0.3);          // voxel edge, world units
const MINV = num('min', 120);            // minimum voxels for a component
const BAND = num('band', 0.9);           // ground band removed, world units
const PORT = 8971;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.ply': 'application/octet-stream', '.sog': 'application/octet-stream',
  '.splat': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  fs.readFile(path.join(ROOT, u), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(u)] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*' });
    r.end(d);
  });
});
await new Promise(r => srv.listen(PORT, r));

const b = await chromium.launch({ headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport: { width: 900, height: 600 } });
await pg.goto(`http://localhost:${PORT}/magpie/dbdb/dream.html?scene=${scene}&edit=1`);
await pg.waitForFunction(() => window.__dream && window.__dream.loaded, null, { timeout: 180000 });
await pg.waitForTimeout(4000);

const found = await pg.evaluate(({ VOX, MINV, BAND }) => {
  const c = window.__dream.centers;
  if (!c || !c.length) return { err: 'no centers' };
  const n = c.length / 3;
  /* 1. BOUNDS BY PERCENTILE. A drone scan trails stray splats for
     hundreds of metres — raw min/max on carshop gave a 2339x505x2713
     voxel grid, which is the sky, not the scene. Trim to the core. */
  const samp = (o) => {
    const a = [];
    const step = Math.max(1, (n / 60000) | 0);
    for (let i = 0; i < n; i += step) { const v = c[i * 3 + o]; if (isFinite(v)) a.push(v); }
    a.sort((p, q) => p - q);
    return [a[(a.length * 0.01) | 0], a[(a.length * 0.99) | 0]];
  };
  const [x0, x1] = samp(0), [y0, y1] = samp(1), [z0, z1] = samp(2);
  /* 2. voxelise */
  const W = Math.ceil((x1 - x0) / VOX) + 1, H = Math.ceil((y1 - y0) / VOX) + 1,
        D = Math.ceil((z1 - z0) / VOX) + 1;
  if (W * H * D > 40e6) return { err: 'grid too big: ' + W + 'x' + H + 'x' + D };
  const idx = (a, b2, d) => (a * H + b2) * D + d;
  const count = new Int32Array(W * H * D);
  for (let i = 0; i < n; i++) {
    const x = c[i * 3], y = c[i * 3 + 1], z = c[i * 3 + 2];
    if (!isFinite(x + y + z)) continue;
    if (x < x0 || x > x1 || y < y0 || y > y1 || z < z0 || z > z1) continue;  // outside the core
    count[idx(Math.min(W - 1, (x - x0) / VOX | 0), Math.min(H - 1, (y - y0) / VOX | 0),
              Math.min(D - 1, (z - z0) / VOX | 0))]++;
  }
  /* 3. THE GROUND, PER COLUMN. Everything stands on the floor, so
     without cutting it every object is one component — carshop came
     back as three blobs. The floor is not flat in a drone scan, so it
     is found per column (lowest occupied voxel) and a BAND above it is
     removed. Two voxels was not enough; the band is a real height. */
  const bandV = Math.max(1, Math.round(BAND / VOX));
  const ground = new Uint8Array(W * H * D);
  for (let a = 0; a < W; a++) for (let d = 0; d < D; d++) {
    for (let h = 0; h < H; h++) if (count[idx(a, h, d)] > 0) {
      for (let k = 0; k < bandV && h + k < H; k++) ground[idx(a, h + k, d)] = 1;
      break;
    }
  }
  /* 4. connected components on what is left */
  const live = (a, h, d) => a >= 0 && h >= 0 && d >= 0 && a < W && h < H && d < D
    && count[idx(a, h, d)] > 0 && !ground[idx(a, h, d)];
  const seen = new Uint8Array(W * H * D);
  const out = [];
  const stack = new Int32Array(W * H * D);
  for (let a = 0; a < W; a++) for (let h = 0; h < H; h++) for (let d = 0; d < D; d++) {
    const s0 = idx(a, h, d);
    if (seen[s0] || !live(a, h, d)) continue;
    let sp = 0; stack[sp++] = s0; seen[s0] = 1;
    let vox = 0, pts = 0;
    let ax0 = a, ax1 = a, ah0 = h, ah1 = h, ad0 = d, ad1 = d;
    while (sp) {
      const s = stack[--sp];
      const dd = s % D, hh = ((s - dd) / D) % H, aa = ((s - dd) / D - hh) / H;
      vox++; pts += count[s];
      if (aa < ax0) ax0 = aa; if (aa > ax1) ax1 = aa;
      if (hh < ah0) ah0 = hh; if (hh > ah1) ah1 = hh;
      if (dd < ad0) ad0 = dd; if (dd > ad1) ad1 = dd;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
        if (!i && !j && !k) continue;
        const na = aa + i, nh = hh + j, nd = dd + k;
        if (!live(na, nh, nd)) continue;
        const ns = idx(na, nh, nd);
        if (seen[ns]) continue;
        seen[ns] = 1; stack[sp++] = ns;
      }
    }
    if (vox < MINV) continue;
    out.push({
      vox, pts,
      c: [x0 + (ax0 + ax1 + 1) / 2 * VOX, y0 + (ah0 + ah1 + 1) / 2 * VOX, z0 + (ad0 + ad1 + 1) / 2 * VOX],
      size: [(ax1 - ax0 + 1) * VOX, (ah1 - ah0 + 1) * VOX, (ad1 - ad0 + 1) * VOX],
    });
  }
  return { n, bounds: [[x0, y0, z0], [x1, y1, z1]], grid: [W, H, D], out };
}, { VOX, MINV, BAND });

await b.close(); srv.close();

if (found.err) { console.error('scout failed:', found.err); process.exit(1); }
console.log(`scene ${scene}: ${found.n} scan points, grid ${found.grid.join('x')} at ${VOX}`);
console.log(`bounds ${found.bounds.map(v => v.map(x => x.toFixed(1)).join(',')).join('  ->  ')}`);

const objs = found.out
  .filter(o => o.size[0] > 0.7 && o.size[2] > 0.7 && o.size[1] > 0.5
            && o.size[0] < 14 && o.size[2] < 14)
  .sort((a, b2) => b2.pts - a.pts)
  .slice(0, 24);

console.log(`\n${objs.length} object-sized components (of ${found.out.length} above ${MINV} voxels)\n`);
objs.forEach((o, i) => {
  const c = o.c.map(v => +v.toFixed(2)), s = o.size.map(v => +(v * 1.12).toFixed(1));
  console.log(`  #${String(i).padStart(2)}  ${String(o.pts).padStart(7)} pts  `
    + `size ${s.join(' x ')}   centre ${c.join(',')}`);
  console.log(`      node magpie/dbdb/tools/splatpack.mjs clip --scene ${scene} --id NAME`
    + ` --c ${c.join(',')} --yaw 0 --size ${s.join(',')}`);
});
console.log('\nSizes are padded 12% so a box does not shave its own object.');
console.log('Pick by eye, name them, then clip. Nothing here decides anything.');
