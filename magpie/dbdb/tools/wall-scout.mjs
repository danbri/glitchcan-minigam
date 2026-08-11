#!/usr/bin/env node
/* wall-scout.mjs — semi-automated catalogue of the FLAT surfaces in
   each splat scene: walls, windows, screens, sign-boards — the places
   where the dream can write clues, clocks, scores, codes, messages.

   Method:
   1. Load dream.html?scene=K&edit=1 headless; take the scan's world
      points from __dream.centers.
   2. Bin points into grid cells; for each populous cell, RANSAC a
      plane (random triples, inlier band). A cell that is mostly
      inliers to one near-vertical plane is a wall candidate.
   3. Greedy max-min spread over the best candidates; orient each
      normal toward the scene centre (the readable side).
   4. Screenshot each candidate face-on, and emit ready-to-paste
      registry JSON: { p, yaw, w } — position, facing bearing, width.

   The pick stays visual: look at the shots, keep the real walls,
   discard the foliage that happened to be flat for one cell.

   Usage: node magpie/dbdb/tools/wall-scout.mjs [sceneKey ...]
          env: PORT=8952 OUT=dir
*/
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = process.env.OUT || path.join(ROOT, 'magpie/dbdb/tools/scout-out');
const PORT = +(process.env.PORT || 8952);
const SCENES = process.argv.slice(2).length ? process.argv.slice(2)
  : ['tree', 'garden', 'carshop', 'forest', 'museum', 'pool', 'watertower', 'calico'];
const CANDS = 8, SETTLE_MS = 3200;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webp': 'image/webp', '.sog': 'application/octet-stream',
  '.splat': 'application/octet-stream', '.ply': 'application/octet-stream' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise(r => srv.listen(PORT, r));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

/* in-page: RANSAC flat cells out of the scan */
const findWalls = (nWant) => {
  const pts = __dream.centers, F = __dream.frame;
  const C = F.C, R = F.R, cell = R / 5;
  const key = (x, y, z) => Math.round(x / cell) + '|' + Math.round(y / cell) + '|' + Math.round(z / cell);
  const bins = new Map();
  const step = Math.max(3, Math.floor(pts.length / 3 / 80000)) * 3;
  for (let i = 0; i < pts.length; i += step) {
    const k = key(pts[i], pts[i + 1], pts[i + 2]);
    let a = bins.get(k); if (!a) { a = []; bins.set(k, a); }
    if (a.length < 4000) a.push(i);
  }
  const cands = [];
  const band = 0.015 * R;
  for (const [k, idx] of bins) {
    if (idx.length < 120) continue;
    let best = null;
    for (let trial = 0; trial < 24; trial++) {
      const i1 = idx[(Math.random() * idx.length) | 0], i2 = idx[(Math.random() * idx.length) | 0],
        i3 = idx[(Math.random() * idx.length) | 0];
      const ax = pts[i2] - pts[i1], ay = pts[i2 + 1] - pts[i1 + 1], az = pts[i2 + 2] - pts[i1 + 2];
      const bx = pts[i3] - pts[i1], by = pts[i3 + 1] - pts[i1 + 1], bz = pts[i3 + 2] - pts[i1 + 2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const nl = Math.hypot(nx, ny, nz); if (nl < 1e-6) continue;
      nx /= nl; ny /= nl; nz /= nl;
      const d0 = nx * pts[i1] + ny * pts[i1 + 1] + nz * pts[i1 + 2];
      let inl = 0;
      for (let j = 0; j < idx.length; j += 2) {
        const i0 = idx[j];
        if (Math.abs(nx * pts[i0] + ny * pts[i0 + 1] + nz * pts[i0 + 2] - d0) < band) inl++;
      }
      if (!best || inl > best.inl) best = { inl, n: [nx, ny, nz] };
    }
    if (!best) continue;
    const frac = best.inl / Math.ceil(idx.length / 2);
    if (frac < 0.55) continue;              // not flat enough
    if (Math.abs(best.n[1]) > 0.45) continue; // floor/ceiling — we want WALLS
    const [gx, gy, gz] = k.split('|').map(Number);
    const p = [gx * cell, gy * cell, gz * cell];
    /* readable side: normal faces the scene centre */
    let n = best.n;
    if ((C[0] - p[0]) * n[0] + (C[2] - p[2]) * n[2] < 0) n = [-n[0], -n[1], -n[2]];
    cands.push({ p, n, frac: +frac.toFixed(2), pts: idx.length });
  }
  cands.sort((a, b) => b.frac * b.pts - a.frac * a.pts);
  const picked = [];
  for (const c of cands) {
    if (picked.length >= nWant) break;
    if (picked.every(q => Math.hypot(c.p[0] - q.p[0], c.p[1] - q.p[1], c.p[2] - q.p[2]) > R / 3))
      picked.push(c);
  }
  return { walls: picked, C, R };
};

for (const key of SCENES) {
  console.log('— scene:', key);
  const dir = path.join(OUT, key + '-walls'); fs.mkdirSync(dir, { recursive: true });
  const pg = await browser.newPage({ viewport: { width: 390, height: 740 } });
  pg.on('pageerror', e => console.log('  PAGEERR', e.message));
  try {
    await pg.goto(`http://localhost:${PORT}/magpie/dbdb/dream.html?scene=${key}&edit=1`);
    await pg.waitForFunction(() => window.__dream && __dream.loaded, null, { timeout: 120000 });
    await pg.waitForFunction(() => __dream.centers && __dream.centers.length, null, { timeout: 60000 });
    await pg.evaluate(() => __dream.closeTerm());
    const { walls, C, R } = await pg.evaluate(findWalls, CANDS);
    console.log('  candidates:', walls.length);
    const out = [];
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      const cam = [w.p[0] + w.n[0] * 0.55 * R, w.p[1] + 0.06 * R, w.p[2] + w.n[2] * 0.55 * R];
      await pg.evaluate(([c, a]) => __dream.setCam(c[0], c[1], c[2], a[0], a[1], a[2]), [cam, w.p]);
      await pg.waitForTimeout(SETTLE_MS);
      const buf = await pg.screenshot();
      fs.writeFileSync(path.join(dir, 'w' + i + '.png'), buf);
      const entry = { p: w.p.map(v => +v.toFixed(2)),
        yaw: +(Math.atan2(w.n[0], w.n[2]) * 180 / Math.PI).toFixed(1),
        w: +(0.5 * R).toFixed(2), flat: w.frac, pts: w.pts };
      out.push({ shot: 'w' + i + '.png', ...entry });
      console.log('  w' + i, JSON.stringify(entry));
    }
    fs.writeFileSync(path.join(dir, 'walls.json'), JSON.stringify(out, null, 2));
  } catch (e) { console.log('  SCENE FAILED:', e.message); }
  await pg.close();
}
await browser.close(); srv.close();
console.log('done →', OUT);
