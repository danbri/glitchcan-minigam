// test-commands-shell.mjs — command-registry Phase 1 in the real shell: the ⌘K
// palette renders from the registry, navigation commands switch apps, the Slides
// pilot contributes typed commands (element actions gated by selection via the
// ontology), and Automations can run any command by id through the kernel.
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

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/index.html`);
  await page.waitForFunction(() => window.__cmdk && window.__cmdk.registry);
  await page.waitForTimeout(300);

  // Navigation commands exist for every app.
  ok('registry has navigation commands for apps', await page.evaluate(() => {
    const r = window.__cmdk.registry;
    return r.has('nav.slides') && r.has('nav.editor') && r.has('nav.maps');
  }));

  // ⌘K palette renders from the registry and filters.
  await page.evaluate(() => window.__cmdk.open());
  ok('palette opens and is visible', !(await page.$eval('.cmdk', (e) => e.hidden)));
  await page.fill('.cmdk-input', 'slides');
  await page.waitForTimeout(50);
  ok('palette filters to matching commands', await page.evaluate(() => [...document.querySelectorAll('.cmdk-item .cmdk-t')].some((e) => /slides/i.test(e.textContent))));
  await page.keyboard.press('Escape');

  // A navigation command switches the active app.
  await page.evaluate(() => window.__cmdk.registry.run('nav.slides', { app: 'workspace' }));
  await page.waitForFunction(() => location.hash === '#slides', null, { timeout: 8000 });
  ok('running nav.slides switches to the Slides app', (await page.evaluate(() => location.hash)) === '#slides');
  await page.waitForSelector('.view[data-app="slides"] edot-slides');
  await page.waitForTimeout(300);

  // Slides pilot contributes its commands when Slides is active.
  const slideCmds = await page.evaluate(() => window.__cmdk.registry.contributions({ app: 'slides' }).map((c) => c.id));
  ok('Slides contributes deck + insert commands when active', slideCmds.includes('slides.addSlide') && slideCmds.includes('slides.present') && slideCmds.includes('slides.insertRect'));

  // Focus the standalone Slides instance so it is the command target.
  await page.evaluate(() => document.querySelector('.view[data-app="slides"] edot-slides').dispatchEvent(new FocusEvent('focusin', { bubbles: true })));

  // Element commands are GATED by selection (ontology SlideElement) — absent with
  // nothing selected, present once an element is selected.
  ok('element commands are hidden with no selection', !(await page.evaluate(() => window.__cmdk.registry.contributions({ app: 'slides' }).some((c) => c.id === 'slides.rotate'))));
  const sel = await page.evaluate(() => {
    const el = document.querySelector('.view[data-app="slides"] edot-slides');
    el._selectEl(0);
    return window.__cmdk.registry.contributions({ app: 'slides' }).map((c) => c.id);
  });
  ok('element commands appear once an element is selected', sel.includes('slides.rotate') && sel.includes('slides.bringToFront'));

  // Running slides.addSlide through the registry mutates the deck.
  const grew = await page.evaluate(() => {
    const el = document.querySelector('.view[data-app="slides"] edot-slides');
    const before = el.deck.slides.length;
    window.__cmdk.registry.run('slides.addSlide', { app: 'slides' });
    return { before, after: el.deck.slides.length };
  });
  ok('slides.addSlide via the registry adds a slide', grew.after === grew.before + 1);

  // Running slides.rotate rotates the selected element (orientability command).
  const rot = await page.evaluate(() => {
    const el = document.querySelector('.view[data-app="slides"] edot-slides');
    el._selectEl(0);
    const before = el.slide.elements[0].rotation || 0;
    window.__cmdk.registry.run('slides.rotate', { app: 'slides' });
    return { before, after: el.slide.elements[0].rotation };
  });
  ok('slides.rotate via the registry rotates the element', rot.after === ((rot.before + 90) % 360));

  // Automations bridge: run any command by id through the kernel capability.
  const viaKernel = await page.evaluate(async () => {
    const { getKernel } = await import('./js/edot-kernel.js');
    const el = document.querySelector('.view[data-app="slides"] edot-slides');
    const before = el.deck.slides.length;
    getKernel().capabilities.invoke('command.run', { id: 'slides.addSlide' });
    return { before, after: el.deck.slides.length };
  });
  ok('Automations can run a command by id (command.run capability)', viaKernel.after === viaKernel.before + 1);

  // ---- Data pilot (Phase 2): commands contributed; loadSample runs ----
  await page.evaluate(() => window.__cmdk.registry.run('nav.data', { app: 'slides' }));
  await page.waitForFunction(() => location.hash === '#data', null, { timeout: 8000 });
  await page.waitForFunction(() => { const d = document.querySelector('.view[data-app="data"] edot-data'); return d && d.engine && d.engine.db; }, null, { timeout: 20000 });
  await page.evaluate(() => document.querySelector('.view[data-app="data"] edot-data').dispatchEvent(new FocusEvent('focusin', { bubbles: true })));
  const dataCmds = await page.evaluate(() => window.__cmdk.registry.contributions({ app: 'data' }).map((c) => c.id));
  ok('Data contributes commands when active', dataCmds.includes('data.loadSample') && dataCmds.includes('data.newTable') && dataCmds.includes('data.exportNquads'));
  await page.evaluate(() => window.__cmdk.registry.run('data.loadSample', { app: 'data' }));
  await page.waitForFunction(() => { const d = document.querySelector('.view[data-app="data"] edot-data'); try { return d.engine.query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='Track'").rows[0][0] === 1; } catch { return false; } }, null, { timeout: 15000 });
  ok('data.loadSample via the registry loads the sample database', true);

  // ---- Calendar pilot (Phase 2): commands contributed; view switch runs ----
  await page.evaluate(() => window.__cmdk.registry.run('nav.calendar', { app: 'data' }));
  await page.waitForFunction(() => location.hash === '#calendar', null, { timeout: 8000 });
  await page.waitForFunction(() => window.__cmdk.registry.contributions({ app: 'calendar' }).some((c) => c.id === 'calendar.viewWeek'), null, { timeout: 10000 });
  await page.evaluate(() => document.querySelector('.view[data-app="calendar"] edot-calendar').dispatchEvent(new FocusEvent('focusin', { bubbles: true })));
  const calCmds = await page.evaluate(() => window.__cmdk.registry.contributions({ app: 'calendar' }).map((c) => c.id));
  ok('Calendar contributes commands when active', calCmds.includes('calendar.newEvent') && calCmds.includes('calendar.browse') && calCmds.includes('calendar.viewWeek'));
  const cview = await page.evaluate(() => { const c = document.querySelector('.view[data-app="calendar"] edot-calendar'); window.__cmdk.registry.run('calendar.viewWeek', { app: 'calendar' }); return c.view; });
  ok('calendar.viewWeek via the registry switches the view', cview === 'week');

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs.slice(0, 4));
} finally {
  await browser.close();
  server.close();
}
console.log(fail ? '\nCOMMANDS-SHELL FAIL' : '\nCOMMANDS-SHELL OK');
process.exit(fail ? 1 : 0);
