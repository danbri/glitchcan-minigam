// test-workspace.mjs — headless test of the composable host (workspace.html).
// Verifies the three app components mount as panes over ONE kernel, and that a
// single data share fans out live — in-process, no file — to BOTH the Slides and
// the Editor pane via the kernel's capability registry.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };
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
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/workspace.html`);
  await page.waitForFunction(() => window.__ws && window.__ws.kernel && document.querySelector('edot-editor .page'), null, { timeout: 20000 });

  // Three panes, one per app component.
  const panes = await page.$$eval('.ws-pane', (els) => els.map((e) => e.dataset.pane));
  ok('three panes mount: data, slides, editor', ['data', 'slides', 'editor'].every((p) => panes.includes(p)));

  // The editor pane is the real surface: its formatting toolbar got built.
  ok('editor pane built its formatting toolbar', await page.$$eval('edot-editor .toolbar .tbtn', (e) => e.length) > 5);

  // One publish on the shared bus fans out to both table-capable panes.
  await page.evaluate(() => window.__ws.kernel.bus.publish('data:share', {
    columns: ['name', 'type'], rows: [['album', 'table'], ['artist', 'table']], title: 'Schema',
  }));
  await page.waitForFunction(() => document.querySelector('edot-editor .page table'), null, { timeout: 5000 });

  const tables = await page.$$eval('edot-editor .page table', (e) => e.length);
  const heading = await page.$$eval('edot-editor .page h3', (e) => e.map((n) => n.textContent));
  ok('data share lands in the editor pane as one titled table', tables === 1 && heading.includes('Schema'));

  const slideCount = await page.evaluate(() => document.querySelector('edot-slides')?.deck?.slides?.length ?? -1);
  ok('the SAME share also reached the slides pane', slideCount >= 2);

  // The Data pane has the geo extension functions (geo-src gazetteer loaded).
  await page.waitForFunction(() => { const d = document.querySelector('edot-data'); return d && d.geoIndex && d.geoIndex.size > 0; }, null, { timeout: 10000 });
  const geo = await page.evaluate(() => {
    const d = document.querySelector('edot-data');
    const s = document.createElement('edot-sheet');
    s.geoIndex = d.geoIndex;            // a sheet created in this pane gets the index
    document.body.appendChild(s);
    s.setGrid({ rows: [['=QID("London")', '=GEODISTANCE("London","Edinburgh")']] });
    const out = { qid: s._display(1, 1, true), dist: s._display(1, 2, true) };
    s.remove();
    return out;
  });
  ok('data pane has geo functions (=QID -> Q84)', geo.qid === 'Q84');
  ok('data pane =GEODISTANCE computes (~534 km)', geo.dist > 525 && geo.dist < 545);

  // The editor exposes its document content like the other components expose theirs.
  const content = await page.evaluate(() => document.querySelector('edot-editor').getContent());
  ok('editor.getContent() returns the inserted document', content.includes('<table'));

  ok('no page errors', errs.length === 0);
} finally {
  await browser.close();
  server.close();
}

console.log(fail ? 'WORKSPACE FAIL' : 'WORKSPACE OK');
process.exit(fail ? 1 : 0);
