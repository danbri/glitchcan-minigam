#!/usr/bin/env node
/* view-scout.mjs — hunt each splat scene for views a human would call
   pretty, without a human in the loop for the boring part.

   Method (heuristics shortlist, eyes decide — the ABCD doctrine):
   1. Load dream.html?scene=K&edit=1 headless; the edit hit mesh gives
      us every scan point in world space (__dream.centers).
   2. Find the DENSE zones (grid density on a subsample) and pick a
      spread of anchor points from the top-density cells — these are
      the "most realistic zones": digitization is best where the
      scanner lingered.
   3. For each anchor, frame 2 candidate views (camera part-way toward
      the scene centre, slightly raised, looking at the anchor; and
      the reverse side).
   4. Screenshot each, score it IN-PAGE with plain image statistics:
      sharpness (mean |Laplacian| of luma), luma entropy, Hasler-
      Süsstrunk colourfulness, dark/clipped fractions.
   5. Emit per-scene: shots, a score-ranked contact sheet (montage),
      and ready-to-paste station JSON for the top views.

   The final pick stays visual: a person (or a vision model) looks at
   the contact sheet and chooses. Scores only decide what is WORTH
   looking at.

   Usage:  node magpie/dbdb/tools/view-scout.mjs [sceneKey ...]
           (default: all place scenes)   env: PORT=8940 OUT=dir
*/
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = process.env.OUT || path.join(ROOT, 'magpie/dbdb/tools/scout-out');
const PORT = +(process.env.PORT || 8940);
const SCENES = process.argv.slice(2).length ? process.argv.slice(2)
  : ['garden', 'carshop', 'forest', 'museum', 'pool', 'watertower', 'calico'];
const ANCHORS = 8, VIEWS_PER = 2, SETTLE_MS = 3200;

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

/* in-page: pick spread anchors from the top-density grid cells */
const pickAnchors = (nAnchors) => {
  const pts = __dream.centers, F = __dream.frame;
  const C = F.C, R = F.R, cell = R / 6;
  const key = (x, y, z) => Math.round(x / cell) + '|' + Math.round(y / cell) + '|' + Math.round(z / cell);
  const density = new Map();
  const step = Math.max(3, Math.floor(pts.length / 3 / 60000)) * 3;
  for (let i = 0; i < pts.length; i += step) {
    const k = key(pts[i], pts[i + 1], pts[i + 2]);
    density.set(k, (density.get(k) || 0) + 1);
  }
  const cells = [...density.entries()].sort((a, b) => b[1] - a[1]);
  const top = cells.slice(0, Math.max(12, Math.floor(cells.length * 0.15)))
    .map(([k, n]) => { const [x, y, z] = k.split('|').map(Number);
      return { p: [x * cell, y * cell, z * cell], n }; });
  const picked = [];
  while (picked.length < nAnchors && top.length) {   // greedy max-min spread
    let best = null, bd = -1;
    for (const c of top) {
      const d = picked.length ? Math.min(...picked.map(q =>
        Math.hypot(c.p[0] - q.p[0], c.p[1] - q.p[1], c.p[2] - q.p[2]))) : c.n;
      if (d > bd) { bd = d; best = c; }
    }
    picked.push(best); top.splice(top.indexOf(best), 1);
  }
  return { anchors: picked.map(c => c.p), C, R,
    baseLen: F.baseLen, baseElev: F.baseElev };
};

/* in-page: score the current rendered frame from a screenshot data-url */
const scoreShot = async (durl) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = durl; });
  const W = 160, H = Math.round(W * img.height / img.width);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const L = new Float32Array(W * H); let dark = 0, clip = 0;
  let rgM = 0, ybM = 0, rg2 = 0, yb2 = 0;
  for (let i = 0; i < W * H; i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
    const l = 0.299 * r + 0.587 * gg + 0.114 * b;
    L[i] = l; if (l < 16) dark++; if (l > 240) clip++;
    const rg = r - gg, yb = 0.5 * (r + gg) - b;
    rgM += rg; ybM += yb; rg2 += rg * rg; yb2 += yb * yb;
  }
  const N = W * H;
  const colorful = Math.sqrt(rg2 / N - (rgM / N) ** 2) + Math.sqrt(yb2 / N - (ybM / N) ** 2)
    + 0.3 * Math.hypot(rgM / N, ybM / N);
  let sharp = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    sharp += Math.abs(4 * L[i] - L[i - 1] - L[i + 1] - L[i - W] - L[i + W]);
  }
  sharp /= (W - 2) * (H - 2);
  const hist = new Float32Array(32);
  for (let i = 0; i < N; i++) hist[Math.min(31, L[i] / 8 | 0)]++;
  let ent = 0;
  for (const h of hist) if (h) { const p = h / N; ent -= p * Math.log2(p); }
  const darkF = dark / N, clipF = clip / N;
  /* appeal: information + colour + detail, punished for emptiness */
  const score = ent * 0.5 + Math.min(colorful, 60) / 60 * 2.5 + Math.min(sharp, 12) / 12 * 2.0
    - Math.max(0, darkF - 0.45) * 6 - Math.max(0, clipF - 0.3) * 4;
  return { score: +score.toFixed(3), ent: +ent.toFixed(2), colorful: +colorful.toFixed(1),
    sharp: +sharp.toFixed(2), darkF: +darkF.toFixed(2), clipF: +clipF.toFixed(2) };
};

for (const key of SCENES) {
  console.log('— scene:', key);
  const dir = path.join(OUT, key); fs.mkdirSync(dir, { recursive: true });
  const pg = await browser.newPage({ viewport: { width: 390, height: 740 } });
  pg.on('pageerror', e => console.log('  PAGEERR', e.message));
  try {
    await pg.goto(`http://localhost:${PORT}/magpie/dbdb/dream.html?scene=${key}&edit=1`);
    await pg.waitForFunction(() => window.__dream && __dream.loaded, null, { timeout: 120000 });
    await pg.waitForFunction(() => __dream.centers && __dream.centers.length, null, { timeout: 60000 });
    await pg.evaluate(() => __dream.setDomForce(false));
    const info = await pg.evaluate(pickAnchors, ANCHORS);
    const { C, R, baseLen, baseElev } = info;
    const results = [];
    for (let ai = 0; ai < info.anchors.length; ai++) {
      const A = info.anchors[ai];
      for (let vi = 0; vi < VIEWS_PER; vi++) {
        /* camera part-way from anchor toward centre (vi=0) or beyond
           the anchor on the far side (vi=1), slightly raised */
        let dx = C[0] - A[0], dz = C[2] - A[2];
        const hl = Math.hypot(dx, dz) || 1; dx /= hl; dz /= hl;
        const sgn = vi === 0 ? 1 : -1;
        const back = 0.5 * R * sgn;
        const cam = [A[0] + dx * back, A[1] + 0.14 * R, A[2] + dz * back];
        await pg.evaluate(([c, a]) => __dream.setCam(c[0], c[1], c[2], a[0], a[1], a[2]),
          [[cam, A]][0]);
        await pg.waitForTimeout(SETTLE_MS);
        const name = `a${ai}v${vi}`;
        const buf = await pg.screenshot();
        fs.writeFileSync(path.join(dir, name + '.png'), buf);
        const durl = 'data:image/png;base64,' + buf.toString('base64');
        const m = await pg.evaluate(scoreShot, durl);
        /* the pose, in station terms (matches edit COPY exactly) */
        const dist = Math.hypot(cam[0] - A[0], cam[1] - A[1], cam[2] - A[2]);
        const st = {
          scene: key, label: 'SCOUT ' + name,
          pos: A.map(v => +v.toFixed(3)),
          yaw: +(Math.atan2(cam[0] - A[0], cam[2] - A[2]) * 180 / Math.PI).toFixed(1),
          pit: +(baseElev - (Math.atan2(cam[1] - A[1], Math.hypot(cam[0] - A[0], cam[2] - A[2]))
            * 180 / Math.PI)).toFixed(1),   // positive pitch lowers the camera
          d: +Math.min(1.5, Math.max(0.2, dist / baseLen)).toFixed(3),
        };
        results.push({ name, ...m, st });
        console.log(`  ${name} score ${m.score} (ent ${m.ent} col ${m.colorful} shp ${m.sharp} dark ${m.darkF})`);
      }
    }
    results.sort((a, b) => b.score - a.score);
    fs.writeFileSync(path.join(dir, 'scores.json'), JSON.stringify(results, null, 2));
    console.log('  top:', results.slice(0, 4).map(r => r.name + ':' + r.score).join('  '));
  } catch (e) { console.log('  SCENE FAILED:', e.message); }
  await pg.close();
}
await browser.close(); srv.close();
console.log('done →', OUT);
