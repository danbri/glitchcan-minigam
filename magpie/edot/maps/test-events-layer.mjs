// test-events-layer.mjs — the calendar-events-on-the-map overlay. Seeds the
// calendar store with located events, mounts the overlay on the real <edot-maps>,
// and asserts a GeoJSON events layer appears with the right features (incl. the
// Wikidata QID carried from the calendar's location autocomplete).
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

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/maps/maps.html`);
  await page.waitForFunction(() => window.__maps && window.__maps.app, null, { timeout: 20000 });

  // Pure mapping: events without coordinates are dropped.
  const pure = await page.evaluate(async () => {
    const { eventsToFeatures } = await import('./js/events-layer.js');
    const fc = eventsToFeatures([
      { summary: 'A', locationGeo: { lat: 51.45, lon: -2.59 }, locationWikidata: 'Q23154' },
      { summary: 'No location' }, // dropped
    ]);
    return { n: fc.features.length, qid: fc.features[0].properties.wikidata, lon: fc.features[0].geometry.coordinates[0] };
  });
  ok('eventsToFeatures keeps only located events, carries the QID', pure.n === 1 && pure.qid === 'Q23154' && Math.abs(pure.lon - (-2.59)) < 1e-9);

  // Real path: seed the calendar store, then read the located events back through
  // loadEventFeatures (IndexedDB only — no WebGL, so deterministic in headless).
  const store = await page.evaluate(async () => {
    const { CalendarStore } = await import('../calendar/js/store.js');
    const s = new CalendarStore();
    await s.init();
    await s.putEvents([
      { id: 'e1', uid: 'e1', calendarId: 'c', summary: 'Bristol meetup', location: 'Bristol', locationWikidata: 'Q23154', locationGeo: { lat: 51.4545, lon: -2.5879 }, start: new Date('2026-06-25T10:00:00Z'), end: new Date('2026-06-25T11:00:00Z') },
      { id: 'e2', uid: 'e2', calendarId: 'c', summary: 'London review', location: 'London', locationWikidata: 'Q84', locationGeo: { lat: 51.5074, lon: -0.1278 }, start: new Date('2026-06-26T09:00:00Z'), end: new Date('2026-06-26T10:00:00Z') },
      { id: 'e3', uid: 'e3', calendarId: 'c', summary: 'No-location call', location: '' }, // dropped
    ]);
    const { loadEventFeatures } = await import('./js/events-layer.js');
    const fc = await loadEventFeatures();
    return { n: fc.features.length, titles: fc.features.map((f) => f.properties.title).sort(), qids: fc.features.map((f) => f.properties.wikidata).sort() };
  });
  ok('loadEventFeatures reads the two located events back (un-located skipped)', store.n === 2);
  ok('features carry the calendar QIDs', store.titles.join(',') === 'Bristol meetup,London review' && store.qids.join(',') === 'Q23154,Q84');

  // drawEvents against a stub map (deterministic — no live GL 'load' to await):
  // asserts the source + circle/halo/label layers and the data it sets.
  const draw = await page.evaluate(async () => {
    const { drawEvents } = await import('./js/events-layer.js');
    const layers = []; let added = null;
    const map = {
      _src: null,
      getSource(id) { return this._src && this._src.id === id ? this._src : undefined; },
      addSource(id, def) { this._src = { id, _data: def.data, setData() {} }; added = def.data; },
      addLayer(def) { layers.push(def.id); },
      getLayer() { return false; },
      on() {}, getCanvas() { return { style: {} }; },
    };
    const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-2.59, 51.45] }, properties: { title: 'X', wikidata: 'Q1' } }] };
    drawEvents(map, fc);
    return { layers, count: added ? added.features.length : 0 };
  });
  ok('drawEvents adds the events source + circle/halo/label layers', ['edot-events', 'edot-events-halo', 'edot-events-label'].every((l) => draw.layers.includes(l)));
  ok('the source is fed the event features', draw.count === 1);

  ok('no page errors', errs.length === 0);
} finally {
  await browser.close();
  server.close();
}

console.log(fail ? 'EVENTS-LAYER FAIL' : 'EVENTS-LAYER OK');
process.exit(fail ? 1 : 0);
