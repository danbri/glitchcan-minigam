#!/usr/bin/env node
/* style-probe.mjs — prove a splat style, do not hope for one.
 *
 * Renders a pack element plain, applies each work-buffer modifier in STYLES,
 * renders again, and reports the share of lit pixels that moved. Exits
 * non-zero if a style moved under 1% — which is the same as "it did not run".
 *
 * WHY a style can fail in total silence, why all three entry points must be
 * declared, how uniforms reach the shader, and what each style is for: the
 * splat-style skill. Add a style to STYLES and it is covered by this check.
 *
 * Usage:
 *   node magpie/dbdb/tools/style-probe.mjs                 # every style, on pickup
 *   node magpie/dbdb/tools/style-probe.mjs duotone --element hut
 *   node magpie/dbdb/tools/style-probe.mjs --out /tmp/styles
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
const ELEMENT = opt('element', 'pickup');
const OUT = opt('out', path.join(HERE, 'styles'));
const only = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const PORT = 8975;

const pack = JSON.parse(fs.readFileSync(path.join(HERE, '../splats/pack/pack.json'), 'utf8'));
const el = pack.elements.find(e => e.id === ELEMENT);
if (!el) { console.error('no such element: ' + ELEMENT); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

/* all three entry points, always: the chunk REPLACES the stock one and a
   missing declaration fails the build in silence (splat-style skill) */
const HEAD_GLSL = `
void modifySplatCenter(inout vec3 center) {}
void modifySplatRotationScale(vec3 oc, vec3 mc, inout vec4 rotation, inout vec3 scale) {}
`;
const HEAD_WGSL = `
fn modifySplatCenter(center: ptr<function, vec3f>) {}
fn modifySplatRotationScale(oc: vec3f, mc: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}
`;

const STYLES = {
  /* two-colour ramp over luminance: a palette, not a filter */
  duotone: {
    params: { uShadow: [0.06, 0.10, 0.22], uLight: [1.00, 0.86, 0.55], uAmount: 0.95 },
    glsl: `uniform vec3 uShadow; uniform vec3 uLight; uniform float uAmount;` + HEAD_GLSL + `
void modifySplatColor(vec3 center, inout vec4 color) {
    float l = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
    color.rgb = mix(color.rgb, mix(uShadow, uLight, smoothstep(0.05, 0.75, l)), uAmount);
}`,
    wgsl: `uniform uShadow: vec3f; uniform uLight: vec3f; uniform uAmount: f32;` + HEAD_WGSL + `
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    let l = dot((*color).rgb, vec3f(0.2126, 0.7152, 0.0722));
    let duo = mix(uniform.uShadow, uniform.uLight, vec3f(smoothstep(0.05, 0.75, l)));
    (*color) = vec4f(mix((*color).rgb, duo, vec3f(uniform.uAmount)), (*color).a);
}`
  },

  /* floater removal by opacity: free, and reversible unlike a re-clip */
  cull: {
    params: { uMinAlpha: 0.55 },
    glsl: `uniform float uMinAlpha;` + HEAD_GLSL + `
void modifySplatColor(vec3 center, inout vec4 color) {
    if (color.a < uMinAlpha) color.a = 0.0;
}`,
    wgsl: `uniform uMinAlpha: f32;` + HEAD_WGSL + `
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    if ((*color).a < uniform.uMinAlpha) { (*color).a = 0.0; }
}`
  },

  /* shrink every gaussian; also proves the geometry entry points run */
  crisp: {
    params: { uShrink: 0.55 },
    glsl: `uniform float uShrink;
void modifySplatCenter(inout vec3 center) {}
void modifySplatRotationScale(vec3 oc, vec3 mc, inout vec4 rotation, inout vec3 scale) { scale *= uShrink; }
void modifySplatColor(vec3 center, inout vec4 color) {}`,
    wgsl: `uniform uShrink: f32;
fn modifySplatCenter(center: ptr<function, vec3f>) {}
fn modifySplatRotationScale(oc: vec3f, mc: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
    (*scale) = (*scale) * uniform.uShrink;
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {}`
  },

  /* world-height fog: the work buffer sees world centres, so it belongs
     to the object rather than the camera */
  fog: {
    params: { uFog: [0.35, 0.42, 0.55], uTop: 3.0 },
    glsl: `uniform vec3 uFog; uniform float uTop;` + HEAD_GLSL + `
void modifySplatColor(vec3 center, inout vec4 color) {
    float t = clamp(1.0 - center.y / uTop, 0.0, 1.0);
    color.rgb = mix(color.rgb, uFog, t * 0.7);
}`,
    wgsl: `uniform uFog: vec3f; uniform uTop: f32;` + HEAD_WGSL + `
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    let t = clamp(1.0 - center.y / uniform.uTop, 0.0, 1.0);
    (*color) = vec4f(mix((*color).rgb, uniform.uFog, vec3f(t * 0.7)), (*color).a);
}`
  }
};

const names = only.length ? only : Object.keys(STYLES);
for (const n of names) if (!STYLES[n]) { console.error('no such style: ' + n); process.exit(2); }

const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.json': 'application/json',
  '.ply': 'application/octet-stream', '.sog': 'application/octet-stream' };

const VIEW = `<!doctype html><meta charset="utf-8"><title>style</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}
canvas{display:block;width:100%;height:100%}</style><canvas id="c"></canvas>
<script type="module">
import * as pc from '/third_party/playcanvas/playcanvas.min.mjs';
window.pc = pc;
const q = new URLSearchParams(location.search);
const app = new pc.Application(document.getElementById('c'), {});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.graphicsDevice.maxPixelRatio = devicePixelRatio;
app.start();
const cam = new pc.Entity();
cam.addComponent('camera', { clearColor: new pc.Color(0,0,0,0), fov: 32, farClip: 400 });
app.root.addChild(cam);
const a = new pc.Asset('e', 'gsplat', { url: q.get('u') });
app.assets.add(a);
const W = +q.get('w'), H = +q.get('h'), D = +q.get('d');
const t = new pc.Vec3(0, H * 0.45, 0);
const dist = Math.max(W, D, H) * 0.5 / Math.tan(32 * Math.PI / 360) * 1.28;
a.on('load', () => {
  const e = new pc.Entity(); e.addComponent('gsplat', { asset: a }); app.root.addChild(e);
  window.__ent = e;
  const y = 35 * Math.PI / 180, p = 16 * Math.PI / 180;
  cam.setPosition(t.x + dist*Math.cos(p)*Math.sin(y), t.y + dist*Math.sin(p), t.z + dist*Math.cos(p)*Math.cos(y));
  cam.lookAt(t); window.__ok = true;
});
a.on('error', e => { window.__err = String(e); });
app.assets.load(a);
<\/script>`;

const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/style.html') { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(VIEW); return; }
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
const pg = await b.newPage({ viewport: { width: 420, height: 420 }, deviceScaleFactor: 2 });
const errs = [];
pg.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await pg.goto(`http://localhost:${PORT}/style.html?u=/magpie/dbdb/splats/pack/${el.file}`
  + `&w=${el.dims[0]}&h=${el.dims[1]}&d=${el.dims[2]}`);
await pg.waitForFunction(() => window.__ok || window.__err, null, { timeout: 180000 });
await pg.waitForTimeout(7000);
const plain = path.join(OUT, `${ELEMENT}-plain.png`);
await pg.screenshot({ path: plain });

/* the counter: how many LIT pixels this style actually moved */
async function diff(a, c) {
  const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  return pg.evaluate(async ([A, C]) => {
    const im = async u => createImageBitmap(await (await fetch(u)).blob());
    const [x, y] = await Promise.all([im(A), im(C)]);
    const cv = new OffscreenCanvas(x.width, x.height), g = cv.getContext('2d');
    g.drawImage(x, 0, 0); const px = g.getImageData(0, 0, x.width, x.height).data;
    g.clearRect(0, 0, x.width, x.height); g.drawImage(y, 0, 0);
    const py = g.getImageData(0, 0, x.width, x.height).data;
    let n = 0, lit = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] + px[i+1] + px[i+2] > 24) lit++;
      if (Math.abs(px[i]-py[i]) + Math.abs(px[i+1]-py[i+1]) + Math.abs(px[i+2]-py[i+2]) > 12) n++;
    }
    return { moved: n, lit, pct: +(100 * n / Math.max(1, lit)).toFixed(1) };
  }, [b64(a), b64(c)]);
}

let bad = 0;
for (const name of names) {
  const s = STYLES[name];
  await pg.evaluate(({ glsl, wgsl, params }) => {
    const c = window.__ent.gsplat;
    /* uniforms go on the COMPONENT; setParameter also marks it dirty */
    for (const k in params) {
      const v = params[k];
      c.setParameter(k, Array.isArray(v) ? new Float32Array(v) : v);
    }
    c.setWorkBufferModifier({ glsl, wgsl });
  }, s);
  await pg.waitForTimeout(7000);
  const shot = path.join(OUT, `${ELEMENT}-${name}.png`);
  await pg.screenshot({ path: shot });
  const d = await diff(plain, shot);
  const ok = d.pct >= 1.0;
  if (!ok) bad++;
  console.log(`${name.padEnd(9)} ${String(d.pct).padStart(5)}% of lit pixels moved   ${ok ? 'ok' : 'DID NOT RUN'}`);
  await pg.evaluate(() => window.__ent.gsplat.setWorkBufferModifier(null));
  await pg.waitForTimeout(4000);
}

/* removing the modifier must give the original back, byte for byte */
const back = path.join(OUT, `${ELEMENT}-back.png`);
await pg.screenshot({ path: back });
const rev = await diff(plain, back);
console.log(`reverted  ${String(rev.pct).padStart(5)}% of lit pixels moved   ${rev.moved === 0 ? 'ok' : 'NOT REVERSIBLE'}`);
if (errs.length) console.log('page errors:', errs.slice(0, 3));
console.log('\nimages ->', OUT);
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
