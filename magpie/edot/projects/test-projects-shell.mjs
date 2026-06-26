// test-projects-shell.mjs — Projects inside the real shell: using a template
// hydrates the live workspace (doc → Editor, deck → Slides, table → Data), and
// the snapshot capability round-trips the workspace back into a project.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
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

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/index.html#projects`);
  await page.waitForSelector('edot-projects .pj-gallery .pj-card');
  ok('Projects is reachable from the shell and shows templates', (await page.$$('edot-projects .pj-card')).length >= 2);

  // Use the first template (Field Survey) → it should hydrate the workspace.
  await page.click('edot-projects .pj-card:first-child .pj-use');
  await page.waitForFunction(() => location.hash === '#workspace', null, { timeout: 10000 });
  // Give the panes a moment to hydrate (data engine + slides ready promise).
  await page.waitForFunction(() => {
    const ws = document.querySelector('.view[data-app="workspace"]');
    const ed = ws && ws.querySelector('edot-editor');
    return ed && ed.getContent && /Survey Brief/.test(ed.getContent());
  }, null, { timeout: 15000 }).catch(() => {});

  const hydrated = await page.evaluate(() => {
    const ws = document.querySelector('.view[data-app="workspace"]');
    const ed = ws.querySelector('edot-editor');
    const sl = ws.querySelector('edot-slides');
    const dt = ws.querySelector('edot-data');
    return {
      doc: ed && ed.getContent ? ed.getContent() : '',
      deckTitle: sl && sl.deck ? sl.deck.title : null,
      table: dt && dt.active ? dt.active.name : null,
    };
  });
  ok('template doc hydrated into the Editor pane', /Survey Brief/.test(hydrated.doc));
  ok('template deck hydrated into the Slides pane', /Survey Findings/.test(hydrated.deckTitle || ''));
  ok('template table hydrated into the Data pane', !!hydrated.table);

  // Snapshot the workspace back into a project bundle.
  const snap = await page.evaluate(async () => {
    const { getKernel } = await import('./js/edot-kernel.js');
    const s = await getKernel().capabilities.invoke('project.snapshot');
    return { name: s.manifest.name, docs: s.manifest.docs.length, slides: s.manifest.slides.length, hasDocFile: !!s.files['docs/document.html'], hasDeckFile: !!s.files['slides/deck.json'] };
  });
  ok('snapshot produces a manifest with a document and a deck', snap.docs >= 1 && snap.slides >= 1);
  ok('snapshot bundles the document and deck files', snap.hasDocFile && snap.hasDeckFile);

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally {
  await browser.close();
  server.close();
}
console.log(fail ? '\nPROJECTS-SHELL FAIL' : '\nPROJECTS-SHELL OK');
process.exit(fail ? 1 : 0);
