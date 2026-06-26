// test-a11y-commands.mjs — accessibility of the command surfaces: the menu bar
// is a keyboard-navigable ARIA menubar, and the ⌘K palette is a proper combobox
// with aria-activedescendant. Keyboard-only users must be able to drive both.
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
  // Go to the Editor for a rich menu bar.
  await page.evaluate(() => window.__cmdk.registry.run('nav.editor', { app: 'workspace' }));
  await page.waitForFunction(() => location.hash === '#editor', null, { timeout: 8000 });
  await page.waitForSelector('#menubar [data-top="File"]');

  // Menubar ARIA + roving tabindex.
  ok('menubar has role=menubar', await page.$eval('#menubar', (e) => e.getAttribute('role') === 'menubar'));
  ok('top items are role=menuitem with aria-haspopup', await page.$$eval('#menubar [data-top]', (els) => els.every((e) => e.getAttribute('role') === 'menuitem' && e.getAttribute('aria-haspopup') === 'menu')));
  ok('menubar exposes exactly one tab stop (roving tabindex)', await page.$$eval('#menubar [data-top]', (els) => els.filter((e) => e.tabIndex === 0).length === 1));

  // Keyboard: focus File, ArrowDown opens it and moves focus into the menu.
  await page.focus('#menubar [data-top="File"]');
  await page.keyboard.press('ArrowDown');
  await page.waitForSelector('.menu [role="menuitem"]', { timeout: 3000 });
  ok('ArrowDown opens the menu and focuses the first item', await page.evaluate(() => { const a = document.activeElement; return a && a.classList.contains('mi') && a.getAttribute('role') === 'menuitem'; }));
  const firstLabel = await page.evaluate(() => document.activeElement.querySelector('.lbl').textContent);
  await page.keyboard.press('ArrowDown');
  ok('ArrowDown moves focus to the next menu item', await page.evaluate((f) => document.activeElement.querySelector('.lbl').textContent !== f, firstLabel));
  // Escape closes and returns focus to the menubar button.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  ok('Escape closes the menu and restores focus to the menubar', await page.evaluate(() => !document.querySelector('.menu') && document.activeElement.dataset.top === 'File'));

  // Palette: combobox pattern with aria-activedescendant.
  await page.evaluate(() => window.__cmdk.open());
  await page.waitForFunction(() => !document.querySelector('.cmdk').hidden);
  ok('palette input is a combobox controlling the listbox', await page.$eval('.cmdk-input', (e) => e.getAttribute('role') === 'combobox' && e.getAttribute('aria-controls') === 'cmdk-listbox' && e.getAttribute('aria-expanded') === 'true'));
  await page.fill('.cmdk-input', 'go to');
  await page.waitForTimeout(60);
  ok('options have role=option and the first is aria-selected', await page.evaluate(() => { const o = document.querySelector('.cmdk-item'); return o && o.getAttribute('role') === 'option' && o.getAttribute('aria-selected') === 'true'; }));
  const ad1 = await page.$eval('.cmdk-input', (e) => e.getAttribute('aria-activedescendant'));
  ok('input points at the active option via aria-activedescendant', /^cmdk-opt-0$/.test(ad1 || ''));
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(40);
  ok('ArrowDown advances aria-activedescendant', (await page.$eval('.cmdk-input', (e) => e.getAttribute('aria-activedescendant'))) === 'cmdk-opt-1');
  ok('a status live-region reports the result count', /command/.test(await page.$eval('.cmdk-status', (e) => e.textContent)));

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs.slice(0, 4));
} finally {
  await browser.close();
  server.close();
}
console.log(fail ? '\nA11Y-COMMANDS FAIL' : '\nA11Y-COMMANDS OK');
process.exit(fail ? 1 : 0);
