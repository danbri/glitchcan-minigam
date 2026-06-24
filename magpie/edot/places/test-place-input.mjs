// test-place-input.mjs — headless test of <edot-place-input> over the in-repo
// seed (sources="local-seed"), so it runs fully offline. Drives the real ARIA
// combobox: type, see options with a QID badge, choose, and assert the
// place-selected event carries the name + Wikidata QID + coordinates.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ndjson': 'application/x-ndjson' };
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
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/places/demo.html`);
  await page.waitForSelector('edot-place-input .pl-input');

  // Type a prefix; the seed should surface Edinburgh with its QID badge.
  await page.fill('edot-place-input .pl-input', 'edin');
  await page.waitForSelector('edot-place-input [role="option"]', { timeout: 5000 });
  const optText = await page.$eval('edot-place-input [role="option"]', (li) => li.textContent);
  ok('option shows the name and its Wikidata QID', /Edinburgh/.test(optText) && /Q23436/.test(optText));

  const expanded = await page.$eval('edot-place-input .pl-input', (i) => i.getAttribute('aria-expanded'));
  ok('combobox reports expanded while open', expanded === 'true');

  // Choose via keyboard (ArrowDown to activedescendant, Enter to select).
  await page.focus('edot-place-input .pl-input');
  await page.keyboard.press('ArrowDown');
  const activeDesc = await page.$eval('edot-place-input .pl-input', (i) => i.getAttribute('aria-activedescendant'));
  ok('arrow key sets aria-activedescendant', !!activeDesc);
  await page.keyboard.press('Enter');

  const picked = await page.evaluate(() => window.__lastPlace);
  ok('place-selected fired with name + QID', picked && picked.name === 'Edinburgh' && picked.wikidataId === 'Q23436');
  ok('selected place carries coordinates', picked && Math.round(picked.lat) === 56);

  const collapsed = await page.$eval('edot-place-input .pl-input', (i) => i.getAttribute('aria-expanded'));
  ok('listbox collapses after selection', collapsed === 'false');

  ok('no page errors', errs.length === 0);
} finally {
  await browser.close();
  server.close();
}

console.log(fail ? 'PLACE-INPUT FAIL' : 'PLACE-INPUT OK');
process.exit(fail ? 1 : 0);
