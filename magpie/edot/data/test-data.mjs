// test-data.mjs — headless test of the edot data layer (SQLite WASM engine,
// editable grid, Excel-like sheet, Access-like query, and the integrations).
// Serves the repo root and drives the real <edot-data> in Chromium.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
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
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/data/data.html`);
  await page.waitForFunction(() => { const d = document.querySelector('edot-data'); return d && d.engine && d.engine.db; }, null, { timeout: 20000 });
  ok('engine (sqlite wasm) booted', true);

  // 1. CSV -> table.
  await page.evaluate(async () => {
    const d = document.querySelector('edot-data');
    const csv = 'name,amount\nAda,100\nBob,250\nCai,75\n';
    await d.importCsv(new File([csv], 'sales.csv', { type: 'text/csv' }));
  });
  await page.waitForTimeout(150);
  ok('CSV imported as a table (sidebar)', await page.evaluate(() => !![...document.querySelectorAll('.dw-item .nm')].find((e) => e.textContent === 'sales')));
  ok('table grid renders rows', await page.evaluate(() => document.querySelectorAll('edot-grid table.grid tbody tr').length === 3));
  ok('amount is numeric in store', await page.evaluate(() => {
    const d = document.querySelector('edot-data');
    return d.engine.query('SELECT typeof(amount) FROM sales LIMIT 1').rows[0][0] === 'integer';
  }));

  // 2. Editable grid writes back via SQL.
  const edited = await page.evaluate(() => {
    const d = document.querySelector('edot-data');
    const data = d.engine.tableRows('sales');
    d.engine.updateCell('sales', data.rowids[0], 'amount', 999);
    return d.engine.query('SELECT amount FROM sales WHERE name=?', ['Ada']).rows[0][0];
  });
  ok('grid edit -> UPDATE persists', edited === 999);

  // 3. Query + Save as view (Access-like).
  const q = await page.evaluate(() => {
    const d = document.querySelector('edot-data');
    d.engine.createView('big', 'SELECT name, amount FROM sales WHERE amount >= 100');
    return d.engine.query('SELECT count(*) FROM big').rows[0][0];
  });
  ok('view created and queryable', q === 2);
  await page.evaluate(() => document.querySelector('edot-data').refresh());
  ok('view appears in sidebar', await page.evaluate(() => !![...document.querySelectorAll('.dw-item .nm')].find((e) => e.textContent === 'big')));

  // 4. Table -> sheet, formulas incl. =SQL, sheet -> table.
  const sheetResult = await page.evaluate(async () => {
    const d = document.querySelector('edot-data');
    d.tableToSheet('sales');                // creates 'sales_sheet'
    await new Promise((r) => setTimeout(r, 50));
    const sheet = d._activeSheet;
    // data is header row + 3 rows => amounts in B2:B4
    sheet._setRaw(6, 1, '=SUM(B2:B4)');     // total of amounts
    sheet._setRaw(7, 1, '=SQL("SELECT count(*) FROM sales")');
    const total = sheet.values.get('6,1');
    const sqlCell = sheet.values.get('7,1');
    return { total, sqlCell };
  });
  ok('sheet formula =SUM(range) computes', sheetResult.total === 999 + 250 + 75);
  ok('sheet =SQL() reads the database', sheetResult.sqlCell === 3);

  const materialized = await page.evaluate(() => {
    const d = document.querySelector('edot-data');
    d.sheetToTable(d.active.name);   // materialise the active sheet
    const names = d.engine.listObjects().map((o) => o.name);
    return names.some((n) => /sales/.test(n) && n !== 'sales');
  });
  ok('sheet -> SQL table (materialised, queryable)', materialized);

  // 4b. Chinook sample (open-source Northwind successor): 11 tables + joins.
  await page.evaluate(async () => { await document.querySelector('edot-data').loadChinook(); });
  await page.waitForTimeout(100);
  ok('Chinook core tables loaded', await page.evaluate(() =>
    document.querySelector('edot-data').engine.query(
      "SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN ('Artist','Album','Track','Invoice','InvoiceLine')").rows[0][0] === 5));
  ok('Chinook has ~3500 tracks', await page.evaluate(() =>
    document.querySelector('edot-data').engine.query('SELECT count(*) FROM Track').rows[0][0] > 3000));
  ok('Chinook 4-table join runs', await page.evaluate(() => {
    const rows = document.querySelector('edot-data').engine.query(
      'SELECT ar.Name FROM Artist ar JOIN Album al ON al.ArtistId=ar.ArtistId ' +
      'JOIN Track t ON t.AlbumId=al.AlbumId JOIN InvoiceLine il ON il.TrackId=t.TrackId ' +
      'GROUP BY ar.ArtistId ORDER BY SUM(il.UnitPrice*il.Quantity) DESC LIMIT 1').rows;
    return rows.length === 1 && typeof rows[0][0] === 'string';
  }));
  ok('Chinook sidebar shows the tables', await page.evaluate(() =>
    !![...document.querySelectorAll('.dw-item .nm')].find((e) => e.textContent === 'Track')));

  // 4c. Send to editor writes an HTML-table handoff for the editor to pick up.
  const handoff = await page.evaluate(() => {
    const d = document.querySelector('edot-data');
    d.sendToEditor(['x', 'y'], [[1, 2], [3, 4]], 'My table');
    return JSON.parse(localStorage.getItem('edot.handoff'));
  });
  ok('sendToEditor writes an HTML-table handoff', handoff && handoff.type === 'insert' && handoff.title === 'My table' && /<table>.*<td>1<\/td>/.test(handoff.html));

  // 4d. Mobile object-drawer toggle.
  ok('mobile drawer toggles via ☰', await page.evaluate(() => {
    const d = document.querySelector('edot-data');
    d.querySelector('.dw-menu-btn').click();
    const open = d._root.classList.contains('side-open');
    d._root.classList.remove('side-open');
    return open;
  }));

  // 5. Persistence: DB exports to bytes.
  ok('database exports to bytes', await page.evaluate(() => document.querySelector('edot-data').engine.exportDb().length > 0));

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally { await browser.close(); server.close(); }
console.log(fail ? `\n${fail} FAILURE(S)` : '\nDATA LAYER OK');
process.exit(fail ? 1 : 0);
