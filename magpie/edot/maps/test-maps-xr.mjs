// test-maps-xr.mjs — the capability gating for the experimental WebXR button.
// The immersive session itself can't be tested headless (no XR device), so we
// verify the part that matters for everyone else: the button is HIDDEN unless the
// device reports immersive support, and SHOWN (labelled AR/VR) when it does.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
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

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };
const url = `http://127.0.0.1:${port}/magpie/edot/maps/maps.html`;

try {
  // No XR device → the button stays hidden.
  const a = await browser.newPage();
  await a.goto(url);
  await a.waitForFunction(() => window.__maps && window.__maps.app, null, { timeout: 20000 });
  await a.waitForTimeout(300);
  ok('XR button is hidden when the device has no WebXR', await a.$eval('.mp-xr-toggle', (e) => e.hidden));
  await a.close();

  // Device reports immersive-vr support → the button reveals, labelled VR.
  const b = await browser.newPage();
  await b.addInitScript(() => {
    Object.defineProperty(navigator, 'xr', {
      configurable: true,
      value: { isSessionSupported: (m) => Promise.resolve(m === 'immersive-vr') },
    });
  });
  await b.goto(url);
  await b.waitForFunction(() => window.__maps && window.__maps.app, null, { timeout: 20000 });
  await b.waitForFunction(() => { const x = document.querySelector('.mp-xr-toggle'); return x && !x.hidden; }, null, { timeout: 5000 });
  ok('XR button is shown when the device supports immersive-vr', !(await b.$eval('.mp-xr-toggle', (e) => e.hidden)));
  ok('XR button is labelled for the supported mode (VR)', /VR/.test(await b.$eval('.mp-xr-toggle', (e) => e.textContent)));
  await b.close();
} finally {
  await browser.close();
  server.close();
}

console.log(fail ? 'MAPS-XR FAIL' : 'MAPS-XR OK');
process.exit(fail ? 1 : 0);
