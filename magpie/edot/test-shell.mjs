// test-shell.mjs — the unified menu-driven shell (index.html): a single entry
// point with a File/Edit/View menu bar that adapts per app, MS-Access-style data
// views, and working menu actions. Verifies the showcase end to end.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ndjson': 'application/x-ndjson', '.wasm': 'application/wasm' };
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
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/index.html`);
  await page.waitForFunction(() => document.querySelector('.menubar') && document.querySelectorAll('.rail button').length >= 7);

  // One entry point: persistent app rail + a menu bar.
  ok('single shell: app rail + menu bar present', await page.$('.rail button[data-nav="editor"]') && await page.$('.menubar'));

  // Menu bar adapts per app.
  await page.click('.rail button[data-nav="editor"]');
  await page.waitForSelector('.view[data-app="editor"] edot-editor .page');
  await page.waitForFunction(() => [...document.querySelectorAll('.menubar > button')].some((b) => b.textContent === 'Insert'));
  const editorTops = await page.$$eval('.menubar > button', (e) => e.map((b) => b.textContent));
  ok('Editor shows File / Edit / Insert / View / Help', ['File', 'Edit', 'Insert', 'View', 'Help'].every((t) => editorTops.includes(t)));

  // A menu action runs (View → Heading 1 applies <h1> to the selection).
  await page.evaluate(() => {
    const ed = document.querySelector('.view[data-app="editor"] edot-editor');
    ed.setContent('<p>hello</p>');
    const el = ed.querySelector('.page'); const r = document.createRange(); r.selectNodeContents(el);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); el.focus();
  });
  await page.click('.menubar > button[data-top="View"]'); await page.waitForTimeout(120);
  await page.click('.menu .mi:has-text("Heading 1")'); await page.waitForTimeout(150);
  ok('Editor menu action works (View → Heading 1)', /<h1/i.test(await page.evaluate(() => document.querySelector('.view[data-app="editor"] edot-editor').getContent())));

  // Data app: MS-Access-style data views in the View menu, and an action works.
  await page.click('.rail button[data-nav="data"]');
  await page.waitForSelector('.view[data-app="data"] edot-data .dw');
  await page.waitForFunction(() => { const b = [...document.querySelectorAll('.menubar > button')]; return b.length && b.every((x) => x.textContent !== 'Insert'); });
  await page.click('.menubar > button[data-top="View"]'); await page.waitForTimeout(150);
  const dataViews = await page.$$eval('.menu .mi .lbl', (e) => e.map((x) => x.textContent));
  ok('Data View menu offers data views (query / spreadsheet / datasheet)',
    dataViews.some((l) => /query/i.test(l)) && dataViews.some((l) => /spreadsheet/i.test(l)) && dataViews.some((l) => /datasheet/i.test(l)));
  await page.click('.menu .mi:has-text("Chinook")'); await page.waitForTimeout(2500);
  ok('Data menu action works (load sample DB populates objects)',
    (await page.evaluate(() => document.querySelectorAll('.view[data-app="data"] .dw-side .dw-item').length)) > 5);

  // View → Open app submenu switches apps.
  await page.click('.menubar > button[data-top="View"]'); await page.waitForTimeout(120);
  await page.click('.menu .mi:has-text("Open app")'); await page.waitForTimeout(120);
  await page.click('.menu .mi:has-text("Calendar")'); await page.waitForTimeout(800);
  ok('View → Open app switches the active app', await page.evaluate(() => location.hash === '#calendar' && !document.querySelector('.view[data-app="calendar"]').hidden));

  // Mobile: the Workspace must show ONE pane at a time (sub-tabs), not three
  // stacked apps — the cluttered phone layout this fixes.
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mob.goto(`http://127.0.0.1:${port}/magpie/edot/index.html`);
  await mob.waitForSelector('.ws-subtabs');
  await mob.waitForTimeout(800);
  const visible = await mob.$$eval('.ws-pane', (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.dataset.ws));
  const tabsShown = await mob.$eval('.ws-subtabs', (el) => getComputedStyle(el).display !== 'none');
  ok('mobile: workspace shows one pane with sub-tabs (not three stacked)', visible.length === 1 && tabsShown);
  await mob.close();

  ok('no page errors', errs.length === 0);
} finally {
  await browser.close();
  server.close();
}

console.log(fail ? 'SHELL FAIL' : 'SHELL OK');
process.exit(fail ? 1 : 0);
