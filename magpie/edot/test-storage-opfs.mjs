// test-storage-opfs.mjs — the OPFS ResourceSource (a REAL local backend) and the
// Projects "save to / open from device" round-trip through it. Headless: OPFS is
// supported in Chromium, so this exercises actual persistent local storage.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.ndjson': 'application/x-ndjson', '.gz': 'application/gzip' };
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

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${base}/index.html`);

  // 1) OPFS ResourceSource: CRUD + lazy listing against real OPFS.
  const fs = await page.evaluate(async (b) => {
    const { OpfsResourceSource } = await import(`${b}/js/resource-source.js`);
    const s = new OpfsResourceSource({ id: 't' });
    const enc = (x) => new TextEncoder().encode(x);
    await s.write('/docs/hello.txt', enc('hi there'));
    await s.write('/docs/notes/a.txt', enc('aaa'));
    const read = new TextDecoder().decode(await s.read('/docs/hello.txt'));
    const rootList = (await s.list('/docs')).map((e) => `${e.kind}:${e.name}`);
    const stat = await s.stat('/docs/hello.txt');
    await s.remove('/docs/hello.txt');
    const afterRemove = await s.stat('/docs/hello.txt');
    const win = await s.list('/docs', { offset: 0, limit: 1 });
    return { read, rootList, statKind: stat && stat.kind, statSize: stat && stat.size, removed: afterRemove === null, winLen: win.length };
  }, base);
  ok('OPFS write+read round-trips bytes', fs.read === 'hi there');
  ok('OPFS lists folders + files of a directory', fs.rootList.includes('folder:notes') && fs.rootList.includes('file:hello.txt'));
  ok('OPFS stat reports a file with size', fs.statKind === 'file' && fs.statSize === 8);
  ok('OPFS remove deletes the file', fs.removed);
  ok('OPFS list honours the window limit', fs.winLen === 1);

  // 2) Connections seeds a real local account over the kernel.
  const conn = await page.evaluate(async (b) => {
    const { getConnections } = await import(`${b}/js/connections.js`);
    const { getKernel } = await import(`${b}/js/edot-kernel.js`);
    getConnections();
    const listed = getKernel().capabilities.invoke('connections.list', { capability: 'storage' });
    const src = getKernel().capabilities.invoke('storage.source', { id: 'device' });
    return { hasDevice: listed.some((a) => a.id === 'device' && a.isLocal), srcOk: !!src && src.capability === 'storage' };
  }, base);
  ok('connections.list (storage) includes the local device account', conn.hasDevice);
  ok('storage.source resolves the device mount over the kernel', conn.srcOk);

  // 3) Projects: save the current workspace to device, then open it back.
  await page.goto(`${base}/projects/projects.html`);
  await page.waitForSelector('edot-projects .pj-gallery .pj-card');
  // Start a template so there's a project to save.
  await page.click('edot-projects .pj-card:first-child .pj-use');
  await page.waitForTimeout(150);
  await page.click('edot-projects .pj-save-device');
  await page.waitForFunction(() => /Saved .* to this device/.test(document.querySelector('edot-projects .pj-status')?.textContent || ''), null, { timeout: 5000 });
  ok('Projects saves the current project to device storage', true);
  // Reload (proves persistence) and open it back from device.
  await page.reload();
  await page.waitForSelector('edot-projects .pj-open-device');
  await page.click('edot-projects .pj-open-device');
  await page.waitForSelector('edot-projects .pj-device-row .pj-btn', { timeout: 5000 });
  const onDevice = await page.$$eval('edot-projects .pj-device-row .pj-btn:first-child', (els) => els.map((e) => e.textContent));
  ok('a saved project persists on device across reload', onDevice.some((t) => /\.edot\.zip/.test(t)));
  await page.click('edot-projects .pj-device-row .pj-btn:first-child');
  await page.waitForFunction(() => /Loaded .* from this device/.test(document.querySelector('edot-projects .pj-status')?.textContent || ''), null, { timeout: 5000 });
  ok('opening from device loads the project back', true);

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs.slice(0, 4));
} finally {
  await browser.close();
  server.close();
}
console.log(fail ? '\nSTORAGE-OPFS FAIL' : '\nSTORAGE-OPFS OK');
process.exit(fail ? 1 : 0);
