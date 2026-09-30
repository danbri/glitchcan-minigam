if (process.env.LITE) globalThis.__forceLite = true;
if (process.env.FAILFULL) globalThis.__failFull = true;
if (!process.env.INTRO) globalThis.__noIntro = true;
import { createRequire as __cr } from 'module';
if (process.env.TALE) globalThis.inkjs = __cr(import.meta.url)('inkjs/full');
import { create, globals } from 'webgpu';
import fs from 'fs';
import { storyInk } from '../tools/story.mjs';
import vm from 'vm';
Object.assign(globalThis, globals);
const gpu = create([]);
const html = fs.readFileSync(process.env.PAGE || new URL('../dist/city.html', import.meta.url), 'utf8');
const OUT = process.env.OUT || '.';
const wg = {};
for (const m of html.matchAll(/<script type="text\/(?:wgsl|ink)" id="([^"]+)">\n([\s\S]*?)<\/script>/g)) wg[m[1]] = m[2];
const main = html.match(/<script>\n([\s\S]*?)<\/script>/)[1];
const errors = [];
const origReq = GPUAdapter.prototype.requestDevice;
let theDevice = null;
GPUAdapter.prototype.requestDevice = async function (d) {
  const dev = await origReq.call(this, d);
  dev.onuncapturederror = (e) => { errors.push(e.error.message); };
  theDevice = dev; return dev;
};
const W = +(process.env.W || 390), H = +(process.env.H || 844), DPR = +(process.env.DPR || 2);
const handlers = {};
function el(id) {
  return { id, style: {}, hidden: true, textContent: wg[id] || '', innerHTML: '', classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, f) { (f ?? !this._s.has(c)) ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    setAttribute() {}, addEventListener(t, f) { handlers[id + ':' + t] = f; }, setPointerCapture() {}, appendChild() {} };
}
const els = {};
let curTex = null, ctxCfg = null;
const canvas = el('c');
canvas.width = 300; canvas.height = 150;
canvas.getContext = () => ({
  configure(cfg) { ctxCfg = cfg; },
  getCurrentTexture() {
    if (!curTex || curTex.width !== canvas.width || curTex.height !== canvas.height) {
      curTex = ctxCfg.device.createTexture({ size: [canvas.width, canvas.height], format: ctxCfg.format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    }
    return curTex;
  },
});
els.c = canvas;
globalThis.document = { getElementById: (id) => (els[id] ||= el(id)), createElement: () => { const e = el('pre'); els.__pre = e; return e; } };
Object.defineProperty(globalThis, 'navigator', { value: { gpu: Object.assign(gpu, { getPreferredCanvasFormat: () => 'bgra8unorm' }) }, configurable: true, writable: true });
globalThis.window = globalThis; globalThis.innerWidth = W; globalThis.innerHeight = H; globalThis.devicePixelRatio = DPR;
globalThis.matchMedia = () => ({ matches: true });
globalThis.addEventListener = () => {};
const realSetTimeout = setTimeout; globalThis.setTimeout = () => 0; globalThis.clearTimeout = () => {};
let rafCb = null;
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
const t0 = performance.now();
vm.runInThisContext(main.replace("init().catch((e) => startFallback(", "init().catch((e) => { console.log(\"INIT ERROR\", (e && e.stack) || e); } ) && void (0 && startFallback("));
// wait for init to finish (pipelines are async)
for (let i = 0; i < 20000 && !rafCb; i++) await new Promise((r) => realSetTimeout(r, 25));
if (!rafCb) { console.log('init did not reach the frame loop', errors, els.errMsg?.textContent); process.exit(1); }
handlers['status:click'] && handlers['status:click']();
const N = +(process.env.FRAMES || 90);
let now = performance.now();
const tStart = performance.now();
let tTail = 0;
for (let f = 0; f < N; f++) {
  const cb = rafCb; rafCb = null; if (!(process.env.FREEZE && f > 12)) now += 1000 / 60;
  if (f === N - 20) tTail = performance.now();
  if (!process.env.TOD && f === 25 && handlers['bTime:click']) { handlers['bTime:click'](); console.log('time of day switched at frame 25'); }
  if (process.env.GO && f === 3) { globalThis.__drift.goTo(process.env.GO); }
  if (f === 6) console.log('GPULOG', JSON.stringify(globalThis.__driftGPU || null));
  if (process.env.INTRO) {
    const D = globalThis.__drift;
    if (f === 5 && !process.env.GATEONLY) { D.gateEnter(false); }
    if (f === 9 && process.env.GATEONLY) console.log('INTROLOG waiting at the opening page:', D.NAVG(), 'mode', D.NAV.mode, 'intro on', D.INTRO.on);
    if (f === 7) console.log('INTROLOG start: mode', D.NAV.mode, 'quiet trip', !!(D.NAV.trip && D.NAV.trip.quiet), 'intro on', D.INTRO.on);
    if (f === 8 && D.NAV.trip) D.NAV.trip.t = D.NAV.trip.T;
    if (f === 10) { console.log('INTROLOG after the descent: mode', D.NAV.mode); if (D.INTRO.path) D.INTRO.path.t = D.INTRO.path.T * +(process.env.INTRO_AT || 0.45); }
    if (f === 13) console.log('INTROLOG on the path: camera', D.st.x.toFixed(0), D.st.y.toFixed(0), D.st.z.toFixed(0));
    if (f === 14 && process.env.INTRO_END && D.INTRO.path) D.INTRO.path.t = D.INTRO.path.T;
    if (f === 16) console.log('INTROLOG end: mode', D.NAV.mode, 'intro on', D.INTRO.on, 'story on', D.TALE.on, 'place', D.NAV.visit && D.NAV.visit.to.id);
  }
  if (process.env.FOLLOW && f === 2) { globalThis.__drift.setFollow(true); }
  if (process.env.TALE && f === 3) { const D = globalThis.__drift; D.TALE.story = new globalThis.inkjs.Compiler(storyInk()).Compile(); D.TALE.on = true; try { D.taleAdvance(); } catch (e) { console.log('ADVANCE ERROR', e.stack.split('\n').slice(0, 6).join(' | ')); } console.log('choices', D.TALE.story.currentChoices.map((c) => c.text).join(' / '), '| scene', D.TALE.scene, '| visit to', D.NAV.visit && D.NAV.visit.to.id, '| hotspots', D.TALE.hot.length); }
  if (process.env.TALE && f === 5) { const D = globalThis.__drift; if (D.TALE.story) D.taleChoose(+process.env.TALE); }
  if (process.env.TALE && f === 6) { const V = globalThis.__drift.NAV.visit; if (V) V.t = V.T; }
  if (process.env.TALE && f === 6) { const D = globalThis.__drift; console.log('PROPLOG scene', D.TALE.scene, 'place', D.TALE.place, 'props', (D.TALE.props || []).map((p) => p.kind + (p.clue ? '(' + p.clue + ')' : '')).join(',')); }
  if (process.env.TALE && f === 7) { const D = globalThis.__drift; const before = D.TALE.paras.length + ' paras at ' + D.TALE.place + ', ' + D.TALE.hot.length + ' clue(s) to find'; D.taleClose(); const mid = D.NAV.mode; D.taleOpen(); console.log('REOPEN before:', before, '| after close mode', mid, '| after reopen:', D.TALE.paras.length, 'paras, place', D.TALE.place, ', visit to', D.NAV.visit && D.NAV.visit.to.id, ',', D.TALE.hot.length, 'clue(s), choices', D.TALE.story.currentChoices.length); }
  if (process.env.MENU && f === 3) {
    const D = globalThis.__drift, M = D.MENU;
    D.toggleGoPanel();
    const show = () => { const p = M.stack[M.stack.length - 1]; console.log('MENU [' + p.title + ']', p.items().map((i) => (i.check ? '(on) ' : '') + i.label + (i.sub ? ' >' : '') + (i.detail ? ' {' + i.detail + '}' : '')).join(' | ')); };
    show();
    const open = (label) => { const it = M.stack[M.stack.length - 1].items().find((i) => i.label === label); M.stack.push(it.sub()); D.renderMenu(); show(); };
    open('Travel'); open('Titan'); open('Seas and lakes'); M.stack.length = 2; open('The Saturn system'); open('Moons');
    M.stack.length = 1; open('Places in the city'); M.stack.length = 1; open('Developer');
    D.padShow(true); D.PAD.lx = 0.6; D.PAD.ry = 0.8; console.log('PAD on', D.PAD.on);
  }
  // LIFEGEN=n: run both Life boards n generations before the render, so a gun's gliders are out (the runner's clock
  // barely moves, so the page itself steps them only a few times)
  if (process.env.LIFEGEN && f === 2) { const D = globalThis.__drift; for (let i = 0; i < +process.env.LIFEGEN; i++) { D.lifeStep(); D.lifeStepR(); } D.LIFE.acc = 1; }
  if (process.env.HOP && f === 3) { const D = globalThis.__drift; if (process.env.HOP.startsWith('place:')) D.hopPlace(process.env.HOP.slice(6)); else D.hop(D.destById(process.env.HOP)); }
  // CAM=x,y,z,yaw,pitch: after a HOP, look from there instead
  if (process.env.CAM && f === 3) { const D = globalThis.__drift, [x, y, z, yaw, pitch] = process.env.CAM.split(',').map(Number), c = { ...D.NAV.visit.to, x, y, z, yaw, pitch }; D.NAV.visit.from = c; D.NAV.visit.to = c; }
  // SNOW=0..1 forces snowfall; TOD=n steps the time of day n times; MOVE=dx,dz moves the camera each frame (streaks)
  if (process.env.SNOW) globalThis.__drift.WX.forced = +process.env.SNOW;
  if (process.env.TOD && f === 3) for (let i = 0; i < +process.env.TOD; i++) handlers['bTime:click']();
  if (process.env.MOVE && f > 3 && globalThis.__drift.NAV.visit) { const [mx, mz] = process.env.MOVE.split(',').map(Number), v = globalThis.__drift.NAV.visit; const c = { ...v.to, x: v.to.x + mx, z: v.to.z + mz }; v.from = c; v.to = c; }
  if (process.env.FREEALT && f === 3) { const D = globalThis.__drift; D.startFree(D.flatCamTitan()); const P = D.NAV.free.P, l = Math.hypot(...P), a = 2575 + (+process.env.FREEALT); D.NAV.free.P = P.map((v) => v * a / l); }
  if (process.env.GO && f === 4 && globalThis.__drift.NAV.trip) { const tr = globalThis.__drift.NAV.trip; tr.t = tr.T * (+process.env.GOAT || 0.985); }
  cb(now);
  await theDevice.queue.onSubmittedWorkDone();
}
const tEnd = performance.now();
console.log('frames', N, 'wall ms/frame', ((tEnd - tStart) / N).toFixed(1), 'steady (last 20)', ((tEnd - tTail) / 20).toFixed(1), 'canvas', canvas.width, canvas.height);
console.log('errors', errors.length ? errors.slice(0, 5) : 'none', 'err panel:', els.errMsg?.textContent || '');
console.log('stats:', els.stats?.textContent);
// save final frame
const w = canvas.width, h = canvas.height, bpr = Math.ceil(w * 4 / 256) * 256;
const buf = theDevice.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
const enc = theDevice.createCommandEncoder();
enc.copyTextureToBuffer({ texture: curTex }, { buffer: buf, bytesPerRow: bpr }, [w, h]);
theDevice.queue.submit([enc.finish()]);
await buf.mapAsync(GPUMapMode.READ);
const src = new Uint8Array(buf.getMappedRange());
const out = Buffer.alloc(w * h * 3);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * bpr + x * 4, o = (y * w + x) * 3; out[o] = src[i + 2]; out[o + 1] = src[i + 1]; out[o + 2] = src[i]; }
fs.writeFileSync(OUT + '/frame.rgb', out);
{ const N = globalThis.__drift && globalThis.__drift.NAV; if (N) { const c = N.cam; const sp = [1221870, 0, 0]; let info = 'nav mode ' + N.mode + ' spaceMix ' + N.spaceMix.toFixed(2);
  if (N.trip) info += ' trip s ' + (N.trip.t / N.trip.T).toFixed(3);
  if (c) { const d = [sp[0] - c.P[0], sp[1] - c.P[1], sp[2] - c.P[2]]; const l = Math.hypot(...d); info += ' F.sat ' + ((c.F[0] * d[0] + c.F[1] * d[1] + c.F[2] * d[2]) / l).toFixed(4) + ' P ' + c.P.map((v) => v.toFixed(0)).join(','); }
  console.log(info); const S = globalThis.__drift.SPACE_DATA; console.log('SP pos', Array.from(S.slice(0,3)).map(v=>v.toFixed(0)).join(','), 'F', Array.from(S.slice(4,7)).map(v=>v.toFixed(3)).join(','), 'R', Array.from(S.slice(8,11)).map(v=>v.toFixed(3)).join(','), 'Up', Array.from(S.slice(12,15)).map(v=>v.toFixed(3)).join(','), 'fov', S[7], 'sat', Array.from(S.slice(20,23)).join(',')); } }
fs.writeFileSync(OUT + '/frame.json', JSON.stringify({ w, h }));
process.exit(0);
