// test-feed.mjs — RSS/Atom parsing (real DOMParser), catalogue queries, and
// surfacing a fetched feed/.ics into the Data feature as a table. Headless: the
// parser is a browser API and the surfacing path runs in the real shell.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.xml': 'application/xml', '.ics': 'text/calendar', '.ndjson': 'application/x-ndjson', '.gz': 'application/gzip' };
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
const base = `http://127.0.0.1:${port}/magpie/edot`;

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${base}/index.html#data`);
  await page.waitForFunction(() => !!document.querySelector('edot-data'));

  // RSS + Atom parse via DOMParser.
  const parsed = await page.evaluate(async (b) => {
    const { parseFeed, feedToTable } = await import(`${b}/feeds/js/feed.js`);
    const rss = parseFeed(await (await fetch(`${b}/feeds/fixtures/sample-rss.xml`)).text());
    const atom = parseFeed(await (await fetch(`${b}/feeds/fixtures/sample-atom.xml`)).text());
    return { rss, atom, table: feedToTable(rss.items) };
  }, base);
  ok('RSS: reads channel title + items', parsed.rss.kind === 'rss' && parsed.rss.title === 'Example City News' && parsed.rss.items.length === 2);
  ok('RSS: item has title/link/date', parsed.rss.items[0].title === 'Road closure on High St' && /example\.org\/1/.test(parsed.rss.items[0].link));
  ok('Atom: reads feed title + entries', parsed.atom.kind === 'atom' && parsed.atom.title === 'Example Hazards' && parsed.atom.items.length === 2);
  ok('Atom: resolves rel=alternate link, falls back to first', /q1/.test(parsed.atom.items[0].link) && /q2/.test(parsed.atom.items[1].link));
  ok('feedToTable yields Title/Date/Link rows', parsed.table.columns.join(',') === 'Title,Date,Link' && parsed.table.rows.length === 2);

  // Catalogue queries by place (QID + name).
  const cat = await page.evaluate(async (b) => {
    const F = await import(`${b}/feeds/js/feeds.js`);
    return { byQid: (await F.feedsForPlace('Q23154')).map((f) => f.id), byName: (await F.calendarsForPlace('Scotland')).map((c) => c.id), all: await F.allSources() };
  }, base);
  ok('catalogue: feeds for a place by QID (Bristol→bbc-bristol)', cat.byQid.includes('bbc-bristol'));
  ok('catalogue: calendars for a place by name (Scotland)', cat.byName.includes('uk-bank-holidays-scotland'));
  ok('catalogue: exposes feeds + calendars', cat.all.feeds.length >= 4 && cat.all.calendars.length >= 2);

  // Surface a fetched feed + .ics into Data as tables via the data.addTable capability.
  const surfaced = await page.evaluate(async (b) => {
    const { getKernel } = await import(`${b}/js/edot-kernel.js`);
    const F = await import(`${b}/feeds/js/feeds.js`);
    const feed = await F.fetchFeedTable(`${b}/feeds/fixtures/sample-rss.xml`, 'City News');
    const ics = await F.fetchIcsTable(`${b}/feeds/fixtures/sample.ics`, 'Holidays');
    const t1 = await getKernel().capabilities.invoke('data.addTable', { title: feed.title, columns: feed.columns, rows: feed.rows });
    const t2 = await getKernel().capabilities.invoke('data.addTable', { title: ics.title, columns: ics.columns, rows: ics.rows });
    return { feedCount: feed.count, icsCount: ics.count, t1, t2 };
  }, base);
  ok('fetchFeedTable returns parsed items', surfaced.feedCount === 2);
  ok('fetchIcsTable returns parsed events', surfaced.icsCount === 2);
  ok('data.addTable surfaces a feed as a Data table', !!surfaced.t1);
  ok('data.addTable surfaces an .ics as a Data table', !!surfaced.t2);
  // The tables really exist in the Data object list.
  await page.waitForTimeout(200);
  const tableNames = await page.$$eval('edot-data .dw-item', (els) => els.map((e) => e.textContent));
  ok('surfaced tables appear in the Data object browser', tableNames.some((t) => /city|news/i.test(t)) && tableNames.some((t) => /holiday/i.test(t)));

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally {
  await browser.close();
  server.close();
}
console.log(fail ? '\nFEED FAIL' : '\nFEED OK');
process.exit(fail ? 1 : 0);
