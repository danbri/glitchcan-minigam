// test-slides-edit.mjs — sub-object editing on a slide: select, move (drag),
// resize (corner handle), re-layer (z-order), and the element inspector.
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

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/slides/slides.html`);
  await page.waitForSelector('edot-slides .sl-canvas');

  // Add two shapes so we can test selection + re-layer deterministically.
  await page.evaluate(() => {
    const s = document.querySelector('edot-slides');
    s.slide.elements.push({ type: 'shape', shape: 'rect', x: 0.30, y: 0.30, w: 0.20, h: 0.20, fill: '#88aacc', stroke: '#335577' });
    s.slide.elements.push({ type: 'shape', shape: 'ellipse', x: 0.55, y: 0.30, w: 0.18, h: 0.18, fill: '#ccaa88', stroke: '#775533' });
    s._renderEditor();
  });
  const shapeCount = await page.$$eval('.sl-el-shape', (e) => e.length);
  ok('two shapes rendered', shapeCount === 2);

  // Select the first shape → selection chrome + inspector appear.
  const first = (await page.$$('.sl-el-shape'))[0];
  await first.click({ position: { x: 6, y: 6 } });
  ok('clicking an element selects it (4 resize handles + move grip)',
    (await page.$$eval('.sl-el.selected .sl-handle', (e) => e.length)) === 4 && !!(await page.$('.sl-el.selected .sl-move')));
  ok('the inspector shows for the selection (Arrange controls)',
    (await page.$eval('.sl-inspector', (e) => !e.hidden)) && /Arrange/.test(await page.$eval('.sl-inspector', (e) => e.textContent)));

  // Move: drag the selected box body and check its normalized x increased.
  const idxOf = () => page.evaluate(() => { const s = document.querySelector('edot-slides'); return s.slide.elements.findIndex((e) => e.type === 'shape'); });
  const xBefore = await page.evaluate(() => { const s = document.querySelector('edot-slides'); return s.slide.elements.find((e) => e.shape === 'rect').x; });
  const bb = await (await page.$('.sl-el.selected')).boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2 + 80, bb.y + bb.height / 2 + 30, { steps: 6 });
  await page.mouse.up();
  const xAfter = await page.evaluate(() => { const s = document.querySelector('edot-slides'); return s.slide.elements.find((e) => e.shape === 'rect').x; });
  ok('dragging the body moves the element (x increased)', xAfter > xBefore + 0.02);

  // Resize: drag the SE handle and check width grew.
  const wBefore = await page.evaluate(() => { const s = document.querySelector('edot-slides'); return s.slide.elements.find((e) => e.shape === 'rect').w; });
  const se = await page.$('.sl-el.selected .sl-handle-se');
  const sb = await se.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + 70, sb.y + 40, { steps: 6 });
  await page.mouse.up();
  const wAfter = await page.evaluate(() => { const s = document.querySelector('edot-slides'); return s.slide.elements.find((e) => e.shape === 'rect').w; });
  ok('dragging the SE handle resizes the element (width grew)', wAfter > wBefore + 0.02);

  // Re-layer: the rect is currently before the ellipse; "Bring to front" moves it last.
  const orderBefore = await page.evaluate(() => document.querySelector('edot-slides').slide.elements.map((e) => e.shape || e.type));
  await page.click('.sl-inspector >> text=⤒ Front');
  const orderAfter = await page.evaluate(() => document.querySelector('edot-slides').slide.elements.map((e) => e.shape || e.type));
  ok('“Bring to front” re-layers the element to the top (last in order)',
    orderAfter[orderAfter.length - 1] === 'rect' && orderBefore.length === orderAfter.length);

  // Deselect by clicking bare canvas.
  await page.click('.sl-canvas', { position: { x: 4, y: 4 } });
  ok('clicking bare canvas deselects (inspector hidden)', await page.$eval('.sl-inspector', (e) => e.hidden) && !(await page.$('.sl-el.selected')));

  // Presenter view: Present, then P toggles notes + next preview + timer.
  await page.evaluate(() => { document.querySelector('edot-slides').slide.notes = 'Thank the sponsors.'; });
  await page.click('button:has-text("Present")');
  await page.waitForSelector('.sl-present');
  await page.keyboard.press('p');
  await page.waitForTimeout(200);
  const pv = await page.evaluate(() => ({
    on: document.querySelector('.sl-present').classList.contains('presenter'),
    notes: document.querySelector('.sl-pv-notes')?.textContent,
    next: !!document.querySelector('.sl-pv-next svg, .sl-pv-end'),
    timer: /\d\d:\d\d/.test(document.querySelector('.sl-pv-timer')?.textContent || ''),
  }));
  ok('presenter view shows notes, next-slide preview and a timer', pv.on && /sponsors/.test(pv.notes) && pv.next && pv.timer);
  await page.keyboard.press('Escape');

  ok('no page errors', errs.length === 0);
} finally {
  await browser.close();
  server.close();
}

console.log(fail ? 'SLIDES-EDIT FAIL' : 'SLIDES-EDIT OK');
process.exit(fail ? 1 : 0);
