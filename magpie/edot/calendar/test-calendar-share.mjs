// test-calendar-share.mjs — the .ics catalogue → Calendar layer → share-to-group
// + open-as-table flow (modelled on the geo "save a place" pattern). Uses a
// same-origin fixture .ics so the subscribe fetch actually succeeds headlessly.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ics': 'text/calendar' };
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

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${base}/calendar/calendar.html`);
  await page.waitForFunction(() => window.__cal && window.__cal.app && window.__cal.app._built, null, { timeout: 20000 });

  // Subscribe to a same-origin .ics (stands in for a hoarded catalogue calendar).
  const sub = await page.evaluate(async (b) => {
    const app = window.__cal.app;
    const cal = await app.subscribe(`${b}/feeds/fixtures/sample.ics`, 'Sample Holidays');
    return { name: cal.name, layers: app.calendars.length, events: app.eventsForCalendar(cal).length, id: cal.id };
  }, base);
  ok('subscribing adds a calendar layer', sub.layers >= 2 && sub.name === 'Sample Holidays');
  ok('the layer is populated with the .ics events', sub.events === 2);

  // Browse-catalogue picker lists the hoarded .ics calendars (geo-style).
  await page.evaluate(() => window.__cal.app.openBrowseCalendars());
  await page.waitForFunction(() => document.querySelectorAll('edot-calendar .cal-browse-row').length > 0, null, { timeout: 4000 });
  const browse = await page.$$eval('edot-calendar .cal-browse-name', (els) => els.map((e) => e.textContent));
  ok('browse picker lists catalogue calendars', browse.some((t) => /bank holidays/i.test(t)));
  await page.evaluate(() => { const b = document.querySelector('edot-calendar .cal-modal-back, edot-calendar .cal-modal'); if (b) b.remove(); });

  // Share to group + open as table go through the kernel capabilities.
  const wired = await page.evaluate(async (id) => {
    const { getKernel } = await import('../js/edot-kernel.js');
    const k = getKernel();
    const shared = []; const tabled = [];
    k.capabilities.provide('groups.share', (p) => { shared.push(p); return true; });
    k.capabilities.provide('data.addTable', (p) => { tabled.push(p); return 'events'; });
    const app = window.__cal.app;
    const cal = app.calendarById(id);
    app.shareCalendarToGroup(cal);
    app.calendarEventsToTable(cal);
    return { shared, tabled };
  }, sub.id);
  ok('Share to group invokes groups.share with the calendar', wired.shared.length === 1 && wired.shared[0].kind === 'calendar' && /Sample Holidays/.test(wired.shared[0].title));
  ok('shared payload carries the events', wired.shared[0].payload && wired.shared[0].payload.events.length === 2);
  ok('Open as table invokes data.addTable with event rows', wired.tabled.length === 1 && wired.tabled[0].rows.length === 2 && wired.tabled[0].columns.includes('Summary'));

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally {
  await browser.close();
  server.close();
}
console.log(fail ? '\nCALENDAR-SHARE FAIL' : '\nCALENDAR-SHARE OK');
process.exit(fail ? 1 : 0);
