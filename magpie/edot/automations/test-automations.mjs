// test-automations.mjs — the Automations app + its sandboxed Worker runtime.
// Proves: scripts run in a DOM-less sandbox, the `edot` API round-trips to the
// kernel (invoke/publish), event payloads reach the script, runaway scripts are
// killed by the timeout, and a real automation drives an app (slides.addData).
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
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

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/automations/automations.html`);
  await page.waitForSelector('edot-automations .au-app');

  // --- sandbox runtime: edot.log / invoke / event / result ---
  const r = await page.evaluate(async () => {
    const { getKernel } = await import('../js/edot-kernel.js');
    const { AutomationRuntime } = await import('./js/automation-runtime.js');
    const k = getKernel();
    const cap = [];
    k.capabilities.provide('test.echo', (p) => { cap.push(p); return { got: p }; });
    const logs = [];
    const rt = new AutomationRuntime((op, p) => {
      if (op === 'invoke') return k.capabilities.invoke(p.name, p.payload);
      if (op === 'publish') { k.bus.publish(p.topic, p.payload); return true; }
      return null;
    });
    const result = await rt.run(
      "edot.log('hi', 42); const x = await edot.invoke('test.echo', { a: 1 }); edot.log('got', x); return x.got.a + event.n;",
      { onLog: (a) => logs.push(a), event: { n: 5 } });
    const sandbox = await rt.run('return [typeof document, typeof window, typeof self];');
    return { result, logs, cap, sandbox };
  });
  ok('script result uses the event payload (1 + 5)', r.result === 6);
  ok('edot.log reaches the host', r.logs.some((a) => a[0] === 'hi' && a[1] === 42));
  ok('edot.invoke round-trips to a kernel capability', r.cap.length === 1 && r.cap[0].a === 1);
  ok('sandbox has NO DOM (document & window undefined, self is the worker)', r.sandbox[0] === 'undefined' && r.sandbox[1] === 'undefined' && r.sandbox[2] === 'object');

  // --- runaway scripts are terminated by the timeout ---
  const timedOut = await page.evaluate(async () => {
    const { AutomationRuntime } = await import('./js/automation-runtime.js');
    const rt = new AutomationRuntime(async () => null);
    try { await rt.run('while (true) {}', { timeoutMs: 500 }); return false; } catch (e) { return /timed out/i.test(e.message); }
  });
  ok('a runaway script is killed by the timeout', timedOut === true);

  // --- the app: seeds present, and a real automation drives an app capability ---
  const names = await page.$$eval('edot-automations .au-name', (e) => e.map((x) => x.textContent));
  ok('seed automations are present', names.includes('Hello, log') && names.includes('Push cities to Slides'));

  await page.evaluate(async () => {
    const { getKernel } = await import('../js/edot-kernel.js');
    window.__slide = [];
    getKernel().capabilities.provide('slides.addData', (p) => { window.__slide.push(p); return true; });
  });
  await page.click('edot-automations .au-item-main:has-text("Push cities to Slides")');
  await page.click('edot-automations .au-run');
  await page.waitForFunction(() => (window.__slide || []).length > 0, null, { timeout: 5000 });
  const slide = await page.evaluate(() => window.__slide);
  ok('an automation drives slides.addData through the kernel', slide.length === 1 && slide[0].title === 'Cities' && slide[0].rows.length === 3);

  const logText = await page.$eval('edot-automations .au-log', (e) => e.textContent);
  ok('the run log shows the automation output', /✓|Added a slide/.test(logText));

  ok('no page errors', errs.length === 0);
} finally {
  await browser.close();
  server.close();
}

console.log(fail ? 'AUTOMATIONS FAIL' : 'AUTOMATIONS OK');
process.exit(fail ? 1 : 0);
