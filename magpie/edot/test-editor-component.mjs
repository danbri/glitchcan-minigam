// test-editor-component.mjs — the <edot-editor> component's host-facing API and,
// critically, MULTIPLE INSTANCES on one page. Drives the host demo (which builds
// page chrome purely on the component API) to prove a host can build the full
// edit page, and that two editors never cross wires.
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

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

// Select all text inside an editor's .page (so commands have a target).
const selectAll = (id) => `(() => { const el = document.getElementById('${id}').querySelector('.page'); const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); el.focus(); })()`;

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/editor-host-demo.html`);
  await page.waitForFunction(() => window.__hostdemo && document.querySelectorAll('edot-editor .page').length === 2);

  // --- multiple instances: no duplicate ids, two real toolbars ---
  const dup = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    const seen = new Set(), dups = new Set();
    for (const i of ids) { if (seen.has(i)) dups.add(i); seen.add(i); }
    return { dups: [...dups], toolbars: document.querySelectorAll('edot-editor .toolbar').length, pageIds: [...document.querySelectorAll('edot-editor .page')].map((p) => p.id) };
  });
  ok('two editors, no duplicate element ids across instances', dup.dups.length === 0);
  ok('each editor has its own toolbar and a unique page id', dup.toolbars === 2 && new Set(dup.pageIds).size === 2);

  // --- config: content property, readonly, stats ---
  await page.evaluate(() => { window.__hostdemo.edA.content = '<p>hello world</p>'; });
  ok('content property get/set round-trips', (await page.evaluate(() => window.__hostdemo.edA.getContent())).includes('hello world'));
  ok('stats() reflects content', (await page.evaluate(() => window.__hostdemo.edA.stats().words)) === 2);
  await page.click('#roA');
  ok('readonly config disables editing on A only', await page.evaluate(() => {
    const a = window.__hostdemo.edA.querySelector('.page').getAttribute('contenteditable');
    const b = window.__hostdemo.edB.querySelector('.page').getAttribute('contenteditable');
    return a === 'false' && b === 'true';
  }));
  await page.click('#roA'); // back to editable

  // --- exec / setBlock / align via the host menu, scoped to the right editor ---
  await page.evaluate(selectAll('edA'));
  await page.click('#blockA'); // focus select then choose H1
  await page.selectOption('#blockA', 'h1');
  await page.evaluate(selectAll('edA'));
  await page.evaluate(() => window.__hostdemo.edA.align('center'));
  const aHtml = await page.evaluate(() => window.__hostdemo.edA.getContent());
  ok('host menu setBlock(h1) applied to A', /<h1/i.test(aHtml));
  ok('host menu align(center) applied to A', /text-align:\s*center/i.test(aHtml));
  const bHtml = await page.evaluate(() => window.__hostdemo.edB.getContent());
  ok('editor B was NOT affected by commands run on A', !/<h1/i.test(bHtml) && !/text-align:\s*center/i.test(bHtml));

  // --- the change event drove the host dirty indicator ---
  ok('edot-change event fired the host dirty dot', await page.evaluate(() => document.getElementById('dotA').classList.contains('on')));

  // --- multi-instance kernel routing: a data share lands in the FOCUSED editor ---
  await page.evaluate(() => { window.__hostdemo.edB.focus(); });
  await page.click('#shareB');
  await page.waitForTimeout(150);
  ok('data share routed to the focused editor (B)', await page.evaluate(() => window.__hostdemo.edB.getContent().includes('Q23154')));
  ok('the unfocused editor (A) did not receive the share', !(await page.evaluate(() => window.__hostdemo.edA.getContent().includes('Q23154'))));
  // refocus A and share again → now A gets it
  await page.evaluate(() => { window.__hostdemo.edA.focus(); });
  await page.click('#shareB');
  await page.waitForTimeout(150);
  ok('after focusing A, the next share routes to A', await page.evaluate(() => window.__hostdemo.edA.getContent().includes('Q23154')));

  // --- image import: bitmap downscaled, SVG kept vector, survives sanitizer ---
  const img = await page.evaluate(async () => {
    const ed = window.__hostdemo.edA; ed.content = '<p>doc</p>';
    const c = document.createElement('canvas'); c.width = 2400; c.height = 1200;
    c.getContext('2d').fillRect(0, 0, 2400, 1200);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    await ed.insertImageFile(new File([blob], 'big.jpg', { type: 'image/jpeg' }));
    const html = ed.getContent();
    const m = /<img[^>]+src="([^"]+)"/i.exec(html);
    const dim = m ? await new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth }); i.src = m[1]; }) : { w: 0 };
    await ed.insertImageFile(new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"></svg>'], 'v.svg', { type: 'image/svg+xml' }));
    return { hasImg: /<img/i.test(html), isData: m && /^data:image\//.test(m[1]), bitmapW: dim.w, svgVector: /data:image\/svg\+xml/.test(ed.getContent()) };
  });
  ok('editor inserts an image as a data URL (survives the sanitizer)', img.hasImg && img.isData);
  ok('editor downscales a large bitmap on import', img.bitmapW <= 1600 && img.bitmapW >= 1500);
  ok('editor keeps an imported SVG as vector', img.svgVector);

  ok('no page errors', errs.length === 0);
} finally {
  await browser.close();
  server.close();
}

console.log(fail ? 'EDITOR-COMPONENT FAIL' : 'EDITOR-COMPONENT OK');
process.exit(fail ? 1 : 0);
