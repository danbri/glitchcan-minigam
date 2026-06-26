// test-gpu.mjs — GPU capability detection + the createImageBitmap image path.
// Honesty: WebGPU adapters are unavailable under headless SwiftShader, so this
// asserts the FALLBACK CONTRACT (callers degrade gracefully), not that WebGPU
// renders. The image path is checked end-to-end (decode + downscale).
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
    const buf = await readFile(path.join(ROOT, rel));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/magpie/edot`;

// GL flags so WebGL2 is present (as on real hardware); WebGPU stays absent (honest).
const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${base}/index.html`);

  const g = await page.evaluate(async (b) => {
    const gpu = await import(`${b}/js/gpu.js`);
    const report = await gpu.gpuReport();
    const adapter1 = await gpu.webGPUAdapterAvailable();
    const adapter2 = await gpu.webGPUAdapterAvailable(); // cached → consistent
    return { report, hasWebGPU: gpu.hasWebGPU(), hasWebGL2: gpu.hasWebGL2(), preferred: gpu.preferredBackend(), adapter1, adapter2 };
  }, base);

  ok('WebGL2 is available (as on real hardware)', g.hasWebGL2 === true);
  ok('gpuReport returns a well-formed capability object', typeof g.report.webgl2 === 'boolean' && ['webgpu', 'webgl2', 'webgl', 'cpu'].includes(g.report.preferred));
  ok('webGPUAdapterAvailable returns a boolean and is consistent (cached)', typeof g.adapter1 === 'boolean' && g.adapter1 === g.adapter2);
  // The fallback contract: no usable WebGPU adapter ⇒ never claim webgpu is ready.
  ok('no WebGPU adapter headless ⇒ adapter probe is false (graceful fallback)', g.adapter1 === false);
  ok('preferredBackend falls back to a WebGL tier when WebGPU is absent', g.hasWebGPU ? g.preferred === 'webgpu' : g.preferred === 'webgl2');

  // Image import uses the optimized createImageBitmap path and still downscales.
  const img = await page.evaluate(async (b) => {
    const { prepareImage } = await import(`${b}/js/image-util.js`);
    const c = document.createElement('canvas'); c.width = 2400; c.height = 1200; c.getContext('2d').fillRect(0, 0, 2400, 1200);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    const file = new File([blob], 'big.jpg', { type: 'image/jpeg' });
    const out = await prepareImage(file);
    const dim = await new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.src = out.dataUrl; });
    return { hasBitmap: typeof createImageBitmap === 'function', longest: Math.max(dim.w, dim.h), aspect: +(dim.w / dim.h).toFixed(2) };
  }, base);
  ok('createImageBitmap is the available fast path in this engine', img.hasBitmap === true);
  ok('optimized image path downscales to the cap, aspect preserved', img.longest <= 1600 && img.longest >= 1500 && img.aspect === 2);

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs.slice(0, 4));
} finally {
  await browser.close();
  server.close();
}
console.log(fail ? '\nGPU FAIL' : '\nGPU OK');
process.exit(fail ? 1 : 0);
