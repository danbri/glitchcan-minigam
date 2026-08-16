#!/usr/bin/env node
/* element-sheet.mjs — A TURNAROUND, NOT A GAME SCREENSHOT.
 *
 * The first pass at showing the pack took 352x248 grabs off the game
 * page: one angle, game chrome, the renderer's own look. That is a
 * screenshot of a game, not a picture of an object. What a catalogue
 * needs is a character sheet — the same object from several bearings,
 * big enough to judge.
 *
 * Framing here is EXACT, not guessed, and that matters: the clipper
 * canonicalises every element (centred on x/z, base floored to y=0,
 * facing rotated to +z) and records its dims in pack.json. So the
 * camera can be placed from arithmetic. The earlier hand-rolled viewer
 * that guessed at percentile bounds rendered known-good scans as mush;
 * this one has no guessing left in it.
 *
 * The renderer is still SwiftShader in this container — a CPU
 * pretending to be a GPU. That costs SPEED, not correctness: it is the
 * same PlayCanvas gsplat path, and at 2x device pixels the output is a
 * real image. Slow is fine for a catalogue.
 *
 * Usage:
 *   node magpie/dbdb/tools/element-sheet.mjs                 # all, 4-up
 *   node magpie/dbdb/tools/element-sheet.mjs pickup --angles 9
 *   node magpie/dbdb/tools/element-sheet.mjs --cell 520 --out /tmp/sheets
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const ANGLES = +opt('angles', 4);          // 4 => 2x2, 9 => 3x3
const CELL = +opt('cell', 460);            // css px per cell; rendered at 2x
const OUT = opt('out', path.join(HERE, 'sheets'));
const only = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const PORT = 8973;

const pack = JSON.parse(fs.readFileSync(path.join(HERE, '../splats/pack/pack.json'), 'utf8'));
const els = pack.elements.filter(e => !only.length || only.includes(e.id));
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.ply': 'application/octet-stream', '.sog': 'application/octet-stream' };

/* The page is deliberately bare: one gsplat, one camera, a flat ground
   shadow, nothing else. No HUD, no post-processing, no game. */
const VIEW = `<!doctype html><meta charset="utf-8"><title>sheet</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}
canvas{display:block;width:100%;height:100%}</style><canvas id="c"></canvas>
<script type="module">
import * as pc from '/third_party/playcanvas/playcanvas.min.mjs';
const q = new URLSearchParams(location.search);
const app = new pc.Application(document.getElementById('c'), {});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.graphicsDevice.maxPixelRatio = devicePixelRatio;
app.start();
if (app.scene.gsplat) { app.scene.gsplat.splatBudget = 0; app.scene.gsplat.minPixelSize = 0; }
const cam = new pc.Entity();
cam.addComponent('camera', { clearColor: new pc.Color(0,0,0,0), fov: 32, farClip: 400 });
app.root.addChild(cam);
const a = new pc.Asset('e', 'gsplat', { url: q.get('u') });
app.assets.add(a);
/* dims come from pack.json — the clip is canonical, so this is arithmetic */
const W = +q.get('w'), H = +q.get('h'), D = +q.get('d');
const target = new pc.Vec3(0, H * 0.45, 0);
const radius = Math.max(W, D, H) * 0.5;
const dist = radius / Math.tan(32 * Math.PI / 360) * 1.28;
window.__frame = (yawDeg, pitchDeg) => {
  const y = yawDeg * Math.PI / 180, p = pitchDeg * Math.PI / 180;
  cam.setPosition(
    target.x + dist * Math.cos(p) * Math.sin(y),
    target.y + dist * Math.sin(p),
    target.z + dist * Math.cos(p) * Math.cos(y));
  cam.lookAt(target);
};
a.on('load', () => {
  const e = new pc.Entity(); e.addComponent('gsplat', { asset: a }); app.root.addChild(e);
  window.__frame(35, 16); window.__ok = true;
});
a.on('error', e => { window.__err = String(e); });
app.assets.load(a);
<\/script>`;

const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/sheet.html') { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(VIEW); return; }
  fs.readFile(path.join(ROOT, u), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(u)] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*' });
    r.end(d);
  });
});
await new Promise(r => srv.listen(PORT, r));

/* bearings: even around the compass, plus a raised three-quarter that
   is the one a person actually judges an object from */
const BEARINGS = ANGLES === 9
  ? [[35,16],[80,16],[125,16],[170,16],[215,16],[260,16],[305,16],[350,16],[35,62]]
  : [[35,16],[125,16],[215,16],[305,16]];
const COLS = ANGLES === 9 ? 3 : 2;

const b = await chromium.launch({ headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

for (const el of els) {
  const pg = await b.newPage({ viewport: { width: CELL, height: CELL }, deviceScaleFactor: 2 });
  const url = `http://localhost:${PORT}/sheet.html`
    + `?u=/magpie/dbdb/splats/pack/${el.file}`
    + `&w=${el.dims[0]}&h=${el.dims[1]}&d=${el.dims[2]}`;
  await pg.goto(url);
  try { await pg.waitForFunction(() => window.__ok || window.__err, null, { timeout: 180000 }); }
  catch (e) { console.log(el.id, 'TIMEOUT'); await pg.close(); continue; }
  const err = await pg.evaluate(() => window.__err);
  if (err) { console.log(el.id, 'ERROR', err); await pg.close(); continue; }

  const shots = [];
  for (const [yaw, pitch] of BEARINGS) {
    await pg.evaluate(([y, p]) => window.__frame(y, p), [yaw, pitch]);
    await pg.waitForTimeout(3200);                       // let the sorter settle
    shots.push((await pg.screenshot({ type: 'png' })).toString('base64'));
  }
  /* compose the sheet in the page, so it stays one file per element */
  const sheet = await pg.evaluate(async ({ shots, cols, cell }) => {
    const rows = Math.ceil(shots.length / cols);
    const cv = document.createElement('canvas');
    cv.width = cols * cell; cv.height = rows * cell;
    const g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < shots.length; i++) {
      const im = await createImageBitmap(await (await fetch('data:image/png;base64,' + shots[i])).blob());
      g.drawImage(im, (i % cols) * cell, ((i / cols) | 0) * cell, cell, cell);
    }
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 2;
    for (let c = 1; c < cols; c++) { g.beginPath(); g.moveTo(c * cell, 0); g.lineTo(c * cell, cv.height); g.stroke(); }
    for (let r = 1; r < rows; r++) { g.beginPath(); g.moveTo(0, r * cell); g.lineTo(cv.width, r * cell); g.stroke(); }
    return cv.toDataURL('image/png').split(',')[1];
  }, { shots, cols: COLS, cell: CELL * 2 });

  fs.writeFileSync(path.join(OUT, el.id + '.png'), Buffer.from(sheet, 'base64'));
  const kb = (fs.statSync(path.join(OUT, el.id + '.png')).size / 1024) | 0;
  console.log(el.id.padEnd(12), BEARINGS.length + ' bearings', String(kb).padStart(5) + 'K');
  await pg.close();
}
await b.close(); srv.close();
console.log('\nsheets ->', OUT);
