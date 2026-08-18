#!/usr/bin/env node
/* scan-contact.mjs — labelled triage sheets for raw scans.
 *
 * Renders every scan in splats/harvest/ (or any directory of .sog/.ply) at
 * one bearing and composes them twelve to a sheet, so a hundred harvested
 * scans can be judged from nine pictures.
 *
 * WHY the flip, the percentile framing and the floater cull are there — and
 * the rule about validating a viewer against a scan you already trust — is
 * in the splat-catalogue skill (§6). Add what you learn there, not here.
 *
 * Usage:
 *   node magpie/dbdb/tools/scan-contact.mjs                 # all of harvest/
 *   node magpie/dbdb/tools/scan-contact.mjs --dir ../splats --per 9
 *   node magpie/dbdb/tools/scan-contact.mjs --only cabin,stones
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
const DIR = path.resolve(HERE, opt('dir', '../splats/harvest'));
const OUT = path.resolve(HERE, opt('out', 'contact'));
const PER = +opt('per', 12);             // cells per sheet
const CELL = +opt('cell', 300);
const ONLY = (opt('only', '') || '').split(',').filter(Boolean);
/* every scan met so far is y-down; flip by default (skill §6) */
const FLIP = opt('flip', '1') !== '0';
const PORT = 8979;

const files = fs.readdirSync(DIR)
  .filter(f => /\.(sog|ply)$/i.test(f))
  .filter(f => !ONLY.length || ONLY.includes(f.replace(/\.[^.]+$/, '')))
  .sort();
if (!files.length) { console.error('no scans in ' + DIR); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png',
  '.ply': 'application/octet-stream', '.sog': 'application/octet-stream' };

const VIEW = `<!doctype html><meta charset="utf-8"><title>contact</title>
<style>html,body{margin:0;height:100%;overflow:hidden;
  background:radial-gradient(120% 95% at 50% 88%, #1b2228 0%, #0d1114 55%, #070a0c 100%)}
canvas{display:block;width:100%;height:100%}</style><canvas id="c"></canvas>
<script type="module">
import * as pc from '/third_party/playcanvas/playcanvas.min.mjs';
const q = new URLSearchParams(location.search);
const app = new pc.Application(document.getElementById('c'),
  { graphicsDeviceOptions: { alpha: true, antialias: false } });
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.graphicsDevice.maxPixelRatio = devicePixelRatio;
app.start();
if (app.scene.gsplat) { app.scene.gsplat.splatBudget = 0; app.scene.gsplat.minPixelSize = 0; }
const cam = new pc.Entity();
cam.addComponent('camera', { clearColor: new pc.Color(0,0,0,0), fov: 34, farClip: 4000 });
app.root.addChild(cam);
window.__load = (url, flip) => new Promise(res => {
  const a = new pc.Asset('s', 'gsplat', { url });
  a.once('load', () => {
    const e = new pc.Entity(); e.addComponent('gsplat', { asset: a });
    /* a parameter, because the sheet is what informs the judgement */
    if (flip) e.setLocalEulerAngles(180, 0, 0);
    app.root.addChild(e);
    /* floater cull — the work-buffer modifier from the splat-style skill.
       All three entry points must be declared or it silently does nothing. */
    e.gsplat.setParameter('uMinAlpha', 0.5);
    const cullGLSL = [
      'uniform float uMinAlpha;',
      'void modifySplatCenter(inout vec3 c) {}',
      'void modifySplatRotationScale(vec3 a, vec3 b, inout vec4 r, inout vec3 s) {}',
      'void modifySplatColor(vec3 c, inout vec4 col) { if (col.a < uMinAlpha) col.a = 0.0; }'
    ].join('\\n');
    const cullWGSL = [
      'uniform uMinAlpha: f32;',
      'fn modifySplatCenter(c: ptr<function, vec3f>) {}',
      'fn modifySplatRotationScale(a: vec3f, b: vec3f, r: ptr<function, vec4f>, s: ptr<function, vec3f>) {}',
      'fn modifySplatColor(c: vec3f, col: ptr<function, vec4f>) { if ((*col).a < uniform.uMinAlpha) { (*col).a = 0.0; } }'
    ].join('\\n');
    e.gsplat.setWorkBufferModifier({ glsl: cullGLSL, wgsl: cullWGSL });
    window.__ent = e;
    /* the engine's aabb spans the floater halo, so frame on a percentile
       box of the centres instead (skill §6) */
    const bb = a.resource.aabb;
    const ctr = a.resource.centers;
    const pick = (k) => {
      const v = [];
      for (let i = k; i < ctr.length; i += 3 * 7) v.push(ctr[i]);
      v.sort((x, y) => x - y);
      return [v[Math.floor(v.length * 0.06)], v[Math.floor(v.length * 0.94)]];
    };
    const [x0, x1] = pick(0), [y0, y1] = pick(1), [z0, z1] = pick(2);
    window.__fit = {
      c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
      h: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2],
      full: [bb.halfExtents.x * 2, bb.halfExtents.y * 2, bb.halfExtents.z * 2]
    };
    res(window.__fit);
  });
  a.once('error', e => res({ error: String(e) }));
  app.assets.add(a); app.assets.load(a);
});
window.__frame = (cx, cy, cz, dist, yawDeg, pitchDeg) => {
  const y = yawDeg * Math.PI / 180, p = pitchDeg * Math.PI / 180;
  cam.setPosition(cx + dist * Math.cos(p) * Math.sin(y),
                  cy + dist * Math.sin(p),
                  cz + dist * Math.cos(p) * Math.cos(y));
  cam.lookAt(new pc.Vec3(cx, cy, cz));
};
<\/script>`;

const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/contact.html') { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(VIEW); return; }
  fs.readFile(path.join(ROOT, u), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(u)] || 'application/octet-stream' });
    r.end(d);
  });
});
await new Promise(r => srv.listen(PORT, r));

const b = await chromium.launch({ headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const rel = path.relative(ROOT, DIR).split(path.sep).join('/');
const cells = [];
for (const f of files) {
  const pg = await b.newPage({ viewport: { width: CELL, height: CELL }, deviceScaleFactor: 2 });
  let cell = null;
  try {
    await pg.goto(`http://localhost:${PORT}/contact.html`);
    const fit = await pg.evaluate(([u, fl]) => window.__load(u, fl), ['/' + rel + '/' + f, FLIP]);
    if (fit.error) throw new Error(fit.error);
    /* fit the engine's box: worst of the two in-plane half-extents and
       the vertical one, at this bearing */
    const t = Math.tan(34 * Math.PI / 360);
    /* centres are from the unflipped cloud; the 180° turn negates y and z */
    if (FLIP) { fit.c[1] = -fit.c[1]; fit.c[2] = -fit.c[2]; }
    const [hx, hy, hz] = fit.h;
    const dist = Math.max(Math.hypot(hx, hz), hy) / t * 1.02;
    await pg.evaluate(([c, d]) => window.__frame(c[0], c[1], c[2], d, 35, 26), [fit.c, dist]);
    await pg.waitForTimeout(5000);
    cell = { name: f.replace(/\.[^.]+$/, ''),
      png: (await pg.screenshot({ type: 'png' })).toString('base64'),
      span: (2 * Math.max(hx, hy, hz)).toFixed(1) };
    console.log(`  ${cell.name.padEnd(28)} ${cell.span} m across`);
  } catch (e) {
    console.log(`  ${f.padEnd(28)} FAILED ${String(e.message).slice(0, 60)}`);
  }
  await pg.close();
  if (cell) cells.push(cell);
}

/* labelled: an unlabelled sheet is useless the moment you act on a cell */
const pg = await b.newPage({ viewport: { width: 400, height: 400 } });
await pg.goto(`http://localhost:${PORT}/contact.html`);
const sheets = [];
for (let i = 0; i < cells.length; i += PER) {
  const group = cells.slice(i, i + PER);
  const cols = Math.ceil(Math.sqrt(group.length * 4 / 3));
  const b64 = await pg.evaluate(async ({ group, cols, cell }) => {
    const rows = Math.ceil(group.length / cols);
    const lab = 26;
    const cv = document.createElement('canvas');
    cv.width = cols * cell; cv.height = rows * (cell + lab);
    const g = cv.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.fillStyle = '#07090b'; g.fillRect(0, 0, cv.width, cv.height);
    for (let k = 0; k < group.length; k++) {
      const x = (k % cols) * cell, y = ((k / cols) | 0) * (cell + lab);
      const im = await createImageBitmap(await (await fetch('data:image/png;base64,' + group[k].png)).blob());
      g.drawImage(im, x, y, cell, cell);
      g.fillStyle = '#0b0f12'; g.fillRect(x, y + cell, cell, lab);
      g.fillStyle = '#7fffb0'; g.font = '15px ui-monospace,monospace';
      g.fillText(group[k].name.slice(0, 26), x + 7, y + cell + 18);
      g.fillStyle = '#6c8a7c';
      g.fillText(group[k].span + 'm', x + cell - 62, y + cell + 18);
    }
    return cv.toDataURL('image/webp', 0.9).split(',')[1];
  }, { group, cols, cell: CELL * 2 });
  const file = path.join(OUT, `sheet-${String(i / PER + 1).padStart(2, '0')}.webp`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  sheets.push(file);
}
await b.close(); srv.close();
console.log(`\n${cells.length} scans on ${sheets.length} sheets -> ${OUT}`);
