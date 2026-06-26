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

  // Opens to a friendly start panel (Open file / Sample / New sheet / SQL) —
  // NOT straight into a raw SQL prompt.
  ok('opens to the welcome start panel, not SQL', await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.dw-welcome .dw-card-t')].map((e) => e.textContent);
    return cards.includes('Open a file') && cards.includes('Write SQL') && !document.querySelector('.q-editor');
  }));

  // Sign-in chip (consistency with the other suite apps).
  ok('header shows the alpha sign-in chip', await page.evaluate(() => {
    const c = document.querySelector('.app-header .login-slot edot-login-button');
    const badge = document.querySelector('.app-header .login-slot .alpha-badge');
    return !!c && /alpha/i.test(badge?.textContent || '');
  }));

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

  // 4e. Durable upstream forms round-trip (OPENDOC): N-Quads and zip-of-CSVs.
  const nq = await page.evaluate(async () => {
    const { tablesToNquads, nquadsToTables } = await import('./nquads.js');
    const d = document.querySelector('edot-data');
    d.engine.createTableFromColumns('rt_people', ['name', 'age'], [['Ada', 36], ['Bo', 9]]);
    const text = tablesToNquads(d.engine, ['rt_people']);
    const back = nquadsToTables(text);
    const t = back.find((x) => x.name === 'rt_people');
    return { hasQuad: /urn:edot:prop:rt_people:age/.test(text), name: t && t.name, cols: t && t.columns.slice().sort().join(','), rows: t && t.rows.length, age: t && t.rows.map((r) => r[t.columns.indexOf('age')]).sort((a, b) => a - b) };
  });
  ok('N-Quads export emits typed quads', nq.hasQuad);
  ok('N-Quads round-trips a table (name/cols/rows)', nq.name === 'rt_people' && nq.cols === 'age,name' && nq.rows === 2);
  ok('N-Quads preserves numeric typing', Array.isArray(nq.age) && nq.age[0] === 9 && nq.age[1] === 36);

  // Determinism (foundations §5): the durable export forms are byte-stable, so a
  // committed version's SHA-256 fingerprint is reproducible.
  const det = await page.evaluate(async () => {
    const { tablesToNquads } = await import('./nquads.js');
    const { toCsv } = await import('./csv.js');
    const d = document.querySelector('edot-data');
    const nq1 = tablesToNquads(d.engine, ['rt_people']);
    const nq2 = tablesToNquads(d.engine, ['rt_people']);
    const data = d.engine.tableRows('rt_people');
    const c1 = toCsv(data.columns, data.rows);
    const c2 = toCsv(data.columns, data.rows);
    return { nq: nq1 === nq2, csv: c1 === c2 };
  });
  ok('N-Quads export is deterministic (byte-identical)', det.nq === true);
  ok('CSV export is deterministic (byte-identical)', det.csv === true);

  const zip = await page.evaluate(async () => {
    const { zipSync, unzip, utf8 } = await import('../js/zip.js');
    const { parseCsv, toCsv } = await import('./csv.js');
    const d = document.querySelector('edot-data');
    const data = d.engine.tableRows('rt_people');
    const blob = await zipSync({ 'rt_people.csv': toCsv(data.columns, data.rows) });
    const map = await unzip(await blob.arrayBuffer());
    const rows = parseCsv(utf8.decode(map['rt_people.csv']));
    return { entries: Object.keys(map), header: rows[0].join(','), body: rows.length - 1 };
  });
  ok('zip-of-CSVs round-trips entry + content', zip.entries.includes('rt_people.csv') && zip.header === 'name,age' && zip.body === 2);

  // 4f. Export fingerprint (SHA-256): committed/signable provenance.
  ok('export fingerprints content (sha256)', await page.evaluate(async () => {
    const d = document.querySelector('edot-data');
    let fn = '', captured = null;
    const orig = document.createElement.bind(document);
    document.createElement = (t) => { const el = orig(t); if (t === 'a') { Object.defineProperty(el, 'click', { value: () => { captured = el.download; }, configurable: true }); } return el; };
    const fp = await d._emit(new TextEncoder().encode('hello world'), 'probe.nq', 'application/n-quads');
    document.createElement = orig;
    // SHA-256("hello world") = b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
    return fp === 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9' && captured === 'probe.nq';
  }));

  // 4g. Datasheet sort: click a header to sort (asc/desc); edits after sorting
  // still write back to the right underlying row (order map, not raw index).
  const sort = await page.evaluate(async () => {
    const d = document.querySelector('edot-data');
    d.engine.createTableFromColumns('rt_sort', ['city', 'pop'], [['Bristol', 460], ['Bath', 94], ['Wells', 12]]);
    d.openTable('rt_sort');
    await new Promise((r) => setTimeout(r, 30));
    const grid = d._main.querySelector('edot-grid');
    const popHeader = () => grid.querySelector('thead th[data-c="1"]');
    const firstCity = () => grid.querySelector('tbody tr td[data-c="0"]').textContent;
    popHeader().click();                         // sort by pop ascending
    const asc = firstCity();
    popHeader().click();                         // sort by pop descending
    const desc = firstCity();
    // Top visible row is now Bristol (pop 460). Edit it to 999 and confirm the
    // write lands on Bristol — not on whatever row index 0 used to be.
    const topPop = grid.querySelector('tbody tr td[data-c="1"]');
    grid._setActive(+topPop.dataset.r, 1); grid._startEdit('999'); grid._commit();
    await new Promise((r) => setTimeout(r, 30));
    return { asc, desc, bristol: d.engine.query("SELECT pop FROM rt_sort WHERE city='Bristol'").rows[0][0] };
  });
  ok('grid sorts ascending on header click', sort.asc === 'Wells');
  ok('grid sorts descending on second click', sort.desc === 'Bristol');
  ok('edit after sort writes back to the correct row', sort.bristol === 999);

  // 4h. "View as" faces: one object shown as datasheet / spreadsheet / RDF.
  const faces = await page.evaluate(async () => {
    const d = document.querySelector('edot-data');
    d.engine.createTableFromColumns('rt_face', ['city', 'pop'], [['Bristol', 460], ['Bath', 94]]);
    d.openTable('rt_face', 'grid');
    await new Promise((r) => setTimeout(r, 20));
    const hasGrid = !!d._main.querySelector('edot-grid');
    const switcher = d._main.querySelectorAll('.dw-face').length;
    d.openTable('rt_face', 'sheet');
    await new Promise((r) => setTimeout(r, 20));
    const hasSheet = !!d._main.querySelector('edot-sheet');
    d.openTable('rt_face', 'rdf');
    await new Promise((r) => setTimeout(r, 20));
    const rdf = d._main.querySelector('.dw-rdf');
    return { hasGrid, switcher, hasSheet, rdfHasQuad: !!rdf && /urn:edot:prop:rt_face:pop/.test(rdf.value) };
  });
  ok('datasheet face renders a grid with a 3-way switcher', faces.hasGrid && faces.switcher === 3);
  ok('spreadsheet face renders a sheet', faces.hasSheet);
  ok('RDF face shows the N-Quads form of the object', faces.rdfHasQuad);

  // 4f. Folders: every object lives in a folder; objects move; a project folder
  //     collects new objects; nothing is loose at the top level.
  const folders = await page.evaluate(async () => {
    const d = document.querySelector('edot-data');
    await d.addTable('Alpha', ['a', 'b'], [[1, 2]]);
    await d.addTable('Beta', ['a', 'b'], [[3, 4]]);
    const defFolder = d._objFolder('Alpha');
    d._setObjFolder('Beta', 'Reports'); d._saveExtraFolders(['Reports']); d.refresh();
    const folderNames = [...d.querySelectorAll('.dw-folder-nm')].map((e) => e.textContent);
    const betaFolder = d._objFolder('Beta');
    d.setProjectFolder('My Project');
    await d.addTable('Gamma', ['x'], [[9]]);
    const gammaFolder = d._objFolder('Gamma');
    const looseItems = [...d.querySelectorAll('.dw-side > .dw-item')].length;
    return { defFolder, folderNames, betaFolder, gammaFolder, looseItems };
  });
  ok('new objects default into a folder (General)', folders.defFolder === 'General');
  ok('an object can be moved to another folder', folders.betaFolder === 'Reports' && folders.folderNames.includes('Reports'));
  ok('a project folder collects newly created objects', folders.gammaFolder === 'My Project');
  ok('no object is loose outside a folder', folders.looseItems === 0);

  // 5. Persistence: DB exports to bytes.
  ok('database exports to bytes', await page.evaluate(() => document.querySelector('edot-data').engine.exportDb().length > 0));

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally { await browser.close(); server.close(); }
console.log(fail ? `\n${fail} FAILURE(S)` : '\nDATA LAYER OK');
process.exit(fail ? 1 : 0);
