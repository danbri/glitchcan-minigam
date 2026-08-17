#!/usr/bin/env node
/* element-sheet.mjs — A TURNAROUND, NOT A GAME SCREENSHOT.
 *
 * The first pass at showing the pack took 352x248 grabs off the game
 * page: one angle, game chrome, the renderer's own look. That is a
 * screenshot of a game, not a picture of an object. What a catalogue
 * needs is a character sheet — the same object from several bearings,
 * big enough to judge.
 *
 * Framing is computed, then MEASURED AND CORRECTED. The box in pack.json
 * is the cut box: padded, and not always ordered the way you assume. A
 * distance derived from it alone left `hut` filling 59% of its frame and
 * the rest black — which is most of what "low resolution" turns out to
 * mean in a thumbnail. So the tool renders once, measures the silhouette
 * that actually appears, corrects the distance, and only then shoots.
 * All bearings share one distance, so sizes stay comparable across a
 * sheet.
 *
 * The other half of looking sharp: render at DPR 3 and compose down to
 * 2x. Splats have no MSAA to lean on, and that supersample is where the
 * crispness comes from. WebP, not JPEG — blocking is very visible on a
 * dark noisy scan.
 *
 * The renderer is still SwiftShader in this container — a CPU
 * pretending to be a GPU. That costs SPEED, not correctness: it is the
 * same PlayCanvas gsplat path, and the output is a real image. Slow is
 * fine for a catalogue.
 *
 * Usage:
 *   node magpie/dbdb/tools/element-sheet.mjs                 # all, 4-up
 *   node magpie/dbdb/tools/element-sheet.mjs pickup --angles 9
 *   node magpie/dbdb/tools/element-sheet.mjs --cell 520 --out /tmp/sheets
 *   npm run splat:thumbs      # 1-up WebP thumbnails for catalog.html
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
const ANGLES = +opt('angles', 4);          // 1 => a thumbnail, 4 => 2x2, 9 => 3x3
const CELL = +opt('cell', 460);            // css px per cell; rendered at 2x
const OUT = opt('out', path.join(HERE, 'sheets'));
/* WebP or JPEG for the catalogue grid: 34 sheets of PNG is 35MB and no page
   wants that. WebP holds a dark, noisy splat far better than JPEG at the same
   weight — JPEG blocking is most of what "murky" means on these. The
   re-encode happens on a <canvas> in the page — no native binary, so the tool
   runs the same on a laptop as in the container. */
const FORMAT = ['jpeg', 'webp'].includes(opt('format', 'png')) ? opt('format', 'png') : 'png';
const EXT = { jpeg: '.jpg', webp: '.webp', png: '.png' }[FORMAT];
const QUALITY = +opt('quality', 0.92);
/* SUPERSAMPLING. The page is rendered at DPR x and composed down to 2x, so
   every output pixel is an average of (DPR/2)^2 rendered ones. Splats have no
   MSAA to lean on, so this is where the crispness comes from. */
const DPR = +opt('dpr', 3);
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
<style>html,body{margin:0;height:100%;overflow:hidden;
  /* not pure black: a scan of dark timber against #000 reads as a smudge.
     A charcoal ground with a soft lift under the object gives it an edge
     without touching a single colour in the splat. */
  background:radial-gradient(120% 95% at 50% 88%, #1b2228 0%, #0d1114 55%, #070a0c 100%)}
canvas{display:block;width:100%;height:100%}</style><canvas id="c"></canvas>
<script type="module">
import * as pc from '/third_party/playcanvas/playcanvas.min.mjs';
const q = new URLSearchParams(location.search);
/* alpha:true, or the canvas clears to opaque black and the page's charcoal
   backdrop never shows — an object on #000 with no ground reads as a smudge */
const app = new pc.Application(document.getElementById('c'),
  { graphicsDeviceOptions: { alpha: true, antialias: false } });
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
/* dims come from pack.json — the clip is canonical, so this is arithmetic.
   The distance is computed in the tool, once, from the silhouette the box
   casts at every bearing, so all cells share one scale and a wide flat
   object is not marooned in black. */
const H = +q.get('h');
const target = new pc.Vec3(0, H * 0.45, 0);
const dist = +q.get('dist');
let zoom = 1;                       // set by the measured second pass
window.__frame = (yawDeg, pitchDeg) => {
  const y = yawDeg * Math.PI / 180, p = pitchDeg * Math.PI / 180, d = dist * zoom;
  cam.setPosition(
    target.x + d * Math.cos(p) * Math.sin(y),
    target.y + d * Math.sin(p),
    target.z + d * Math.cos(p) * Math.cos(y));
  cam.lookAt(target);
};
window.__zoom = z => { zoom = z; };
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
  : ANGLES === 1
    ? [[35,16]]
    : [[35,16],[125,16],[215,16],[305,16]];
const COLS = ANGLES === 9 ? 3 : ANGLES === 1 ? 1 : 2;

/* FIT THE FRAME, DO NOT GUESS AT IT.
   The old distance came from the bounding SPHERE, which wastes most of the
   cell on anything that is not a ball: `hut` filled barely half its
   thumbnail and the rest was black. This projects the box onto the camera's
   right and up axes at each bearing and takes the distance the worst bearing
   needs, so the object is as large as it can be while every cell keeps the
   same scale — which is what makes sizes comparable across a sheet. */
const FOV = 32, PAD = 1.06;
function fitDistance([W, H, D]) {
  const t = Math.tan(FOV * Math.PI / 360);
  let worst = 0;
  for (const [yawDeg, pitchDeg] of BEARINGS) {
    const y = yawDeg * Math.PI / 180, p = pitchDeg * Math.PI / 180;
    const halfRight = 0.5 * (W * Math.abs(Math.cos(y)) + D * Math.abs(Math.sin(y)));
    const footprint = W * Math.abs(Math.sin(y)) + D * Math.abs(Math.cos(y));
    /* the camera looks at 0.45H, so the taller side of that split is what
       must fit; the footprint tilts into the vertical axis as pitch rises */
    const halfUp = 0.55 * H * Math.cos(p) + 0.5 * footprint * Math.sin(p);
    worst = Math.max(worst, halfRight / t, halfUp / t);
  }
  return worst * PAD;
}

/* how much of the frame the object actually covers, 0..1, measured from a
   screenshot: the brightest the charcoal backdrop ever gets is 27+34+40, so
   anything over 125 is splat. Screenshot, not drawImage on the canvas —
   a WebGL canvas without preserveDrawingBuffer reads back blank. */
async function silhouette(pg) {
  const png = 'data:image/png;base64,' + (await pg.screenshot({ type: 'png' })).toString('base64');
  return pg.evaluate(async u => {
    const im = await createImageBitmap(await (await fetch(u)).blob());
    const cv = new OffscreenCanvas(im.width, im.height), g = cv.getContext('2d');
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, im.width, im.height).data;
    let x0 = im.width, y0 = im.height, x1 = -1, y1 = -1;
    for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
      const i = (y * im.width + x) * 4;
      if (d[i] + d[i+1] + d[i+2] > 125) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return 0;
    return Math.max((x1 - x0) / im.width, (y1 - y0) / im.height);
  }, png);
}

const b = await chromium.launch({ headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

for (const el of els) {
  const pg = await b.newPage({ viewport: { width: CELL, height: CELL }, deviceScaleFactor: DPR });
  const url = `http://localhost:${PORT}/sheet.html`
    + `?u=/magpie/dbdb/splats/pack/${el.file}`
    + `&h=${el.dims[1]}&dist=${fitDistance(el.dims).toFixed(3)}`;
  await pg.goto(url);
  try { await pg.waitForFunction(() => window.__ok || window.__err, null, { timeout: 180000 }); }
  catch (e) { console.log(el.id, 'TIMEOUT'); await pg.close(); continue; }
  const err = await pg.evaluate(() => window.__err);
  if (err) { console.log(el.id, 'ERROR', err); await pg.close(); continue; }

  /* SECOND PASS: measure, then zoom. The box in pack.json is the CUT box,
     which is padded and can be ordered differently from the cloud that ends
     up inside it, so a distance derived from it alone left `hut` filling 59%
     of its frame. Rendering once, measuring the silhouette that actually
     appears, and correcting the distance removes every assumption about what
     the numbers mean. Measured on the two bearings furthest apart, so one
     distance still serves the whole sheet. */
  const probes = BEARINGS.length > 1 ? [BEARINGS[0], BEARINGS[1]] : [BEARINGS[0]];
  let fill = 0;
  for (const [yaw, pitch] of probes) {
    await pg.evaluate(([y, p]) => window.__frame(y, p), [yaw, pitch]);
    await pg.waitForTimeout(2600);
    fill = Math.max(fill, await silhouette(pg));
  }
  if (fill > 0.02) {
    const zoom = Math.max(0.35, Math.min(2.2, fill / 0.94));
    await pg.evaluate(z => window.__zoom(z), zoom);
  }

  const shots = [];
  for (const [yaw, pitch] of BEARINGS) {
    await pg.evaluate(([y, p]) => window.__frame(y, p), [yaw, pitch]);
    await pg.waitForTimeout(3200);                       // let the sorter settle
    shots.push((await pg.screenshot({ type: 'png' })).toString('base64'));
  }
  /* compose the sheet in the page, so it stays one file per element */
  const sheet = await pg.evaluate(async ({ shots, cols, cell, format, quality }) => {
    const rows = Math.ceil(shots.length / cols);
    const cv = document.createElement('canvas');
    cv.width = cols * cell; cv.height = rows * cell;
    const g = cv.getContext('2d');
    g.imageSmoothingQuality = 'high';     // this is the supersample resolve
    g.fillStyle = '#0b0f12'; g.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < shots.length; i++) {
      const im = await createImageBitmap(await (await fetch('data:image/png;base64,' + shots[i])).blob());
      g.drawImage(im, (i % cols) * cell, ((i / cols) | 0) * cell, cell, cell);
    }
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 2;
    for (let c = 1; c < cols; c++) { g.beginPath(); g.moveTo(c * cell, 0); g.lineTo(c * cell, cv.height); g.stroke(); }
    for (let r = 1; r < rows; r++) { g.beginPath(); g.moveTo(0, r * cell); g.lineTo(cv.width, r * cell); g.stroke(); }
    return cv.toDataURL('image/' + format, quality).split(',')[1];
  }, { shots, cols: COLS, cell: CELL * 2, format: FORMAT, quality: QUALITY });

  const file = path.join(OUT, el.id + EXT);
  fs.writeFileSync(file, Buffer.from(sheet, 'base64'));
  const kb = (fs.statSync(file).size / 1024) | 0;
  console.log(el.id.padEnd(12), BEARINGS.length + ' bearings', String(kb).padStart(5) + 'K');
  await pg.close();
}
await b.close(); srv.close();
console.log('\nsheets ->', OUT);
