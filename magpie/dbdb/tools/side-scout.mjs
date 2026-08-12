#!/usr/bin/env node
/* side-scout.mjs — turntable every pack element and find its
   PHOTOGENIC side vs its weak angles (the scanner never saw the far
   side; clips have bald backs). Scores shortlist, eyes decide; the
   verdicts go into pack.json as `sides` so compositions can point
   weak arcs at walls.
   Usage: node magpie/dbdb/tools/side-scout.mjs [elementId ...] */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, 'magpie/dbdb/tools/scout-out/sides');
const PORT = +(process.env.PORT || 8956);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webp': 'image/webp', '.ply': 'application/octet-stream' };
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

/* in-page scorer: coverage (element pixels vs void), sharpness, dark */
const score = async (durl) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = durl; });
  const W = 150, H = Math.round(W * img.height / img.width);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const L = new Float32Array(W * H); let lit = 0;
  for (let i = 0; i < W * H; i++) {
    L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    if (L[i] > 14) lit++;
  }
  let sharp = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    sharp += Math.abs(4 * L[i] - L[i - 1] - L[i + 1] - L[i - W] - L[i + W]);
  }
  sharp /= (W - 2) * (H - 2);
  const cover = lit / (W * H);
  return { cover: +cover.toFixed(3), sharp: +sharp.toFixed(2),
    score: +(cover * 5 + Math.min(sharp, 14) / 14 * 5).toFixed(2) };
};

const browser = await chromium.launch({ headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await browser.newPage({ viewport: { width: 360, height: 360 } });
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.goto(`http://localhost:${PORT}/magpie/dbdb/splatpack.html`);
await pg.waitForFunction(() => window.__pack && __pack.ready, null, { timeout: 300000 });
await pg.addStyleTag({ content: '#bar,#cred,#head,#phos{display:none}' });   // clean plates
const all = await pg.evaluate(() => __pack.els);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : all;
const report = {};
for (const id of ids) {
  await pg.evaluate(i => __pack.solo(i), id);
  await pg.waitForTimeout(1500);
  report[id] = [];
  for (let a = 0; a < 8; a++) {
    const yaw = a * 45;
    await pg.evaluate(y => __pack.setCam(y, 12, 0.6), yaw);
    await pg.waitForTimeout(2600);
    const buf = await pg.screenshot();
    fs.writeFileSync(path.join(OUT, `${id}-${yaw}.png`), buf);
    const m = await pg.evaluate(score, 'data:image/png;base64,' + buf.toString('base64'));
    report[id].push({ yaw, ...m });
    process.stdout.write(`  ${id}@${yaw}: ${m.score} (cov ${m.cover})\n`);
  }
  const best = [...report[id]].sort((x, y) => y.score - x.score)[0];
  const worst = [...report[id]].sort((x, y) => x.score - y.score)[0];
  console.log(`${id}: best ${best.yaw}° (${best.score}) · weakest ${worst.yaw}° (${worst.score})`);
}
fs.writeFileSync(path.join(OUT, 'sides-scores.json'), JSON.stringify(report, null, 2));
await browser.close(); srv.close();
console.log('done →', OUT);
