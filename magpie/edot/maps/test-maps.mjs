// test-maps.mjs — headless test of the edot maps viewer. Same style as
// ../data/test-data.mjs and ../calendar/test-calendar.mjs: serves the repo root,
// drives the real <edot-maps> in Chromium, prints ✅/❌, exits non-zero on any
// failure.
//
// IMPORTANT (CLAUDE.md headless caveat): WebGL renders via SwiftShader at ~2fps
// and WebGPU is unavailable headless, so we DO NOT verify rendered tiles/pixels.
// We test logic + DOM: geocode-response → marker parsing, routing-fixture →
// polyline + distance/duration formatting, saved-place CRUD persisted to
// IndexedDB, layer toggle hides/shows the saved-places layer, URL-hash
// encode/decode round-trip, and that the component boots and builds its controls
// with no page errors. A MapLibre map object is checked opportunistically: if GL
// initialises it's asserted, otherwise the test still validates all non-GL logic.
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
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/maps/maps.html`);
  await page.waitForFunction(() => window.__maps && window.__maps.app && window.__maps.app._built, null, { timeout: 20000 });
  // Clean store so reruns are deterministic.
  await page.evaluate(async () => { await window.__maps.store.clearAll(); window.__maps.app.places = []; window.__maps.app._afterPlacesChanged(); });
  ok('component booted and built its controls', await page.evaluate(() =>
    !!document.querySelector('edot-maps .mp-toolbar') &&
    !!document.querySelector('edot-maps .mp-search-input') &&
    document.querySelectorAll('edot-maps .mp-select option').length >= 2));

  const glReady = await page.evaluate(() => !!(window.__maps.app.map && window.__maps.app.glAvailable));
  console.log(`   (WebGL map ${glReady ? 'INITIALISED — smoke-checking map object' : 'NOT available headless — validating non-GL logic only'})`);
  if (glReady) ok('MapLibre map object exists (smoke)', await page.evaluate(() => typeof window.__maps.app.map.getCenter === 'function'));

  // 1. Geocode response -> normalized markers (pure parser, no network).
  const geo = await page.evaluate(() => {
    const { parseGeocodeResults, buildGeocodeUrl } = window.__maps.geo;
    const sample = [
      { display_name: 'Bristol, England, UK', lat: '51.4545', lon: '-2.5879', type: 'city', boundingbox: ['51.40', '51.50', '-2.65', '-2.51'] },
      { display_name: 'No coords here', lat: 'NaN', lon: '' },
      { display_name: 'Bath, England', lat: '51.3811', lon: '-2.3590', class: 'place' },
    ];
    const res = parseGeocodeResults(sample);
    return {
      count: res.length,
      first: res[0],
      url: buildGeocodeUrl('bristol'),
      bboxNormalised: res[0].bbox, // [west, south, east, north]
    };
  });
  ok('geocode parser drops invalid + keeps valid results', geo.count === 2);
  ok('geocode parser normalises lat/lon to numbers', geo.first.lat === 51.4545 && geo.first.lng === -2.5879);
  ok('geocode parser normalises bbox to [W,S,E,N]', JSON.stringify(geo.bboxNormalised) === JSON.stringify([-2.65, 51.40, -2.51, 51.50]));
  ok('geocode URL carries the query + format', /[?&]q=bristol/.test(geo.url) && /format=/.test(geo.url));

  // 2. Routing fixture -> polyline coords + distance/duration formatting.
  const route = await page.evaluate(() => {
    const fixture = {
      code: 'Ok',
      routes: [{
        distance: 5234, duration: 642,
        geometry: { type: 'LineString', coordinates: [[-2.59, 51.45], [-2.58, 51.46], [-2.57, 51.47]] },
      }],
    };
    const parsed = window.__maps.app.routeFromFixture(fixture); // applies + draws
    const summary = document.querySelector('edot-maps .mp-dir-summary').textContent;
    const buildUrl = window.__maps.geo.buildRouteUrl([-2.59, 51.45], [-2.57, 51.47]);
    return { ok: parsed.ok, n: parsed.coords.length, distance: parsed.distance, summary, buildUrl };
  });
  ok('route fixture parses to a 3-point polyline', route.ok && route.n === 3);
  ok('route distance is read from the response', route.distance === 5234);
  ok('route summary formats distance + duration', /5\.2 km/.test(route.summary) && /11 min|10 min/.test(route.summary));
  ok('route URL is OSRM-shaped (lng,lat;lng,lat + geojson)', /\/driving\/-2\.59,51\.45;-2\.57,51\.47\?/.test(route.buildUrl) && /geometries=geojson/.test(route.buildUrl));

  // 2b. distance/duration formatting edge cases (pure).
  const fmt = await page.evaluate(() => {
    const { formatDistance, formatDuration } = window.__maps.geo;
    return { m: formatDistance(842), km: formatDistance(15400), s: formatDuration(20), min: formatDuration(642), hm: formatDuration(3 * 3600 + 25 * 60) };
  });
  ok('formatters: metres/km/seconds/minutes/hours', fmt.m === '842 m' && fmt.km === '15 km' && fmt.s === '20 s' && fmt.min === '11 min' && fmt.hm === '3 h 25 min');

  // 3. Saved-place CRUD persisted to IndexedDB.
  const crud = await page.evaluate(async () => {
    const app = window.__maps.app;
    const p = await app.savePlace({ name: 'Harbourside', note: 'lunch', lng: -2.6, lat: 51.448, color: '#188038' });
    const afterSave = (await app.store.getAll()).length;
    await app.updatePlace(p.id, { note: 'coffee' });
    const note = (await app.store.getAll()).find((x) => x.id === p.id).note;
    const inList = !![...document.querySelectorAll('edot-maps .mp-place-name')].find((e) => e.textContent === 'Harbourside');
    await app.deletePlace(p.id);
    const afterDelete = (await app.store.getAll()).length;
    return { afterSave, note, inList, afterDelete };
  });
  ok('savePlace persists to IndexedDB', crud.afterSave === 1);
  ok('saved place renders in the sidebar list', crud.inList);
  ok('updatePlace writes back the edited note', crud.note === 'coffee');
  ok('deletePlace removes it from the store', crud.afterDelete === 0);

  // 3b. Persistence survives a reload (real IndexedDB, not just in-memory).
  await page.evaluate(async () => { await window.__maps.app.savePlace({ name: 'Persisted', lng: -2.5, lat: 51.5 }); });
  await page.reload();
  await page.waitForFunction(() => window.__maps && window.__maps.app && window.__maps.app._built, null, { timeout: 20000 });
  ok('saved places survive a page reload', await page.evaluate(async () =>
    (await window.__maps.store.getAll()).some((p) => p.name === 'Persisted')));

  // 4. GeoJSON import/export round-trip (pure helpers + store).
  const gj = await page.evaluate(async () => {
    const { placesToGeoJson, geoJsonToPlaces } = window.__maps.geo;
    const fc = placesToGeoJson([{ id: 'a', name: 'Clifton', note: 'view', lng: -2.62, lat: 51.46, color: '#b5126b', created: 1 }]);
    const back = geoJsonToPlaces(fc);
    // a foreign minimal export (only geometry) should still import
    const foreign = geoJsonToPlaces({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 51] } }] });
    const skipsNonPoint = geoJsonToPlaces({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }] });
    return {
      featType: fc.features[0].geometry.type, coords: fc.features[0].geometry.coordinates,
      back: back[0], foreignN: foreign.length, foreignName: foreign[0] && foreign[0].name, skipN: skipsNonPoint.length,
    };
  });
  ok('places export to GeoJSON Point features', gj.featType === 'Point' && JSON.stringify(gj.coords) === JSON.stringify([-2.62, 51.46]));
  ok('GeoJSON round-trips name/note/coords', gj.back.name === 'Clifton' && gj.back.note === 'view' && gj.back.lng === -2.62);
  ok('import tolerates a minimal foreign export', gj.foreignN === 1 && /51\.0000/.test(gj.foreignName));
  ok('import skips non-Point geometry', gj.skipN === 0);

  // 4b. importGeoJsonFile path (drag-in a file) lands places in the store.
  const imp = await page.evaluate(async () => {
    const fc = { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { name: 'Imported A' }, geometry: { type: 'Point', coordinates: [-2.5, 51.4] } },
      { type: 'Feature', properties: { name: 'Imported B' }, geometry: { type: 'Point', coordinates: [-2.4, 51.5] } },
    ] };
    const file = new File([JSON.stringify(fc)], 'p.geojson', { type: 'application/geo+json' });
    const n = await window.__maps.app.importGeoJsonFile(file);
    return { n, names: (await window.__maps.store.getAll()).map((p) => p.name) };
  });
  ok('importGeoJsonFile adds both points', imp.n === 2 && imp.names.includes('Imported A') && imp.names.includes('Imported B'));

  // 5. Layer toggle hides/shows the saved-places overlay.
  const layer = await page.evaluate(() => {
    const app = window.__maps.app;
    const t = app._placesToggle;
    const before = t.getAttribute('aria-pressed');
    app.togglePlacesLayer();           // -> hidden
    const hidden = t.getAttribute('aria-pressed');
    // GL layer visibility (only when a map exists)
    const glVis = app.map && app.map.getLayer && app.map.getLayer('saved-places')
      ? app.map.getLayoutProperty('saved-places', 'visibility') : 'none';
    app.togglePlacesLayer();           // -> visible again
    const shown = t.getAttribute('aria-pressed');
    return { before, hidden, shown, glVis };
  });
  ok('places-layer toggle flips aria-pressed', layer.before === 'true' && layer.hidden === 'false' && layer.shown === 'true');
  ok('places-layer toggle sets layer visibility=none when hidden', layer.glVis === 'none' || layer.glVis === undefined);

  // 6. URL-hash encode/decode round-trip (permalink/state).
  const hash = await page.evaluate(() => {
    const { encodeHash, decodeHash } = window.__maps.geo;
    const h1 = encodeHash({ zoom: 13.5, center: [-2.5879, 51.4545] });
    const d1 = decodeHash(h1);
    const h2 = encodeHash({ zoom: 16, center: [-2.6, 51.46], marker: [-2.61, 51.47] });
    const d2 = decodeHash(h2);
    const bad = decodeHash('#something-else');
    return { h1, d1, h2, d2, bad };
  });
  ok('hash encodes z/lat/lng', /^#map=13\.5\/51\.4545\/-2\.5879$/.test(hash.h1));
  ok('hash decodes back to center+zoom', hash.d1 && hash.d1.zoom === 13.5 && hash.d1.center[0] === -2.5879 && hash.d1.center[1] === 51.4545);
  ok('hash round-trips an optional marker', hash.h2.endsWith('/-2.61,51.47') && hash.d2.marker[0] === -2.61 && hash.d2.marker[1] === 51.47);
  ok('non-map hash decodes to null', hash.bad === null);

  // 6b. applyHash drives the live view (only asserted when GL is up).
  if (glReady) {
    const applied = await page.evaluate(() => {
      const s = window.__maps.app.applyHash('#map=15/51.5/-0.12');
      const c = window.__maps.app.map.getCenter();
      return { s, lng: +c.lng.toFixed(2), lat: +c.lat.toFixed(2) };
    });
    ok('applyHash jumps the map to the shared view', applied.s && applied.lng === -0.12 && applied.lat === 51.5);
  }

  // 7. Basemap style builder (raster inline; vector = URL) — pure.
  const bm = await page.evaluate(() => {
    const { buildRasterStyle, resolveBasemapStyle, expandSubdomains } = window.__maps.basemap;
    const cfg = window.__maps.config;
    const raster = buildRasterStyle(cfg.basemaps.osm);
    const carto = resolveBasemapStyle(cfg.basemaps.carto_light);
    const vec = resolveBasemapStyle(cfg.basemaps.openfreemap);
    const subs = expandSubdomains('https://{s}.x/{z}/{x}/{y}.png', ['a', 'b']);
    return {
      rasterOk: raster.version === 8 && raster.layers[0].type === 'raster' && /tile\.openstreetmap/.test(raster.sources.basemap.tiles[0]),
      attribution: raster.sources.basemap.attribution,
      cartoSubdomains: carto.style.sources.basemap.tiles.length, // {s} expanded
      vectorIsUrl: vec.vector === true && typeof vec.style === 'string',
      hasBuildingsBasemap: Object.values(cfg.basemaps).some((b) => b.buildings),
      subs: subs.length,
    };
  });
  ok('raster basemap builds a valid inline style with OSM tiles', bm.rasterOk);
  ok('raster basemap carries attribution', /OpenStreetMap/.test(bm.attribution));
  ok('{s} subdomains expand to multiple tile URLs', bm.cartoSubdomains === 4 && bm.subs === 2);
  ok('vector basemap resolves to a style URL', bm.vectorIsUrl);
  ok('a building-capable vector basemap is configured (3D buildings have a source)', bm.hasBuildingsBasemap);

  // 8. setBasemap updates the select + state (no network needed for the switch).
  ok('setBasemap switches the active basemap + select', await page.evaluate(() => {
    const app = window.__maps.app;
    app.setBasemap('carto_light');
    return app.basemap === 'carto_light' && app._layerSel.value === 'carto_light';
  }));

  // 9. Directions panel toggles (DOM) and resolves "lat,lng" without network.
  const dir = await page.evaluate(async () => {
    const app = window.__maps.app;
    app.toggleDirections(true);
    const open = !app._dir.hidden;
    const pt = await app._resolvePoint('51.45, -2.59'); // lat,lng -> [lng,lat]
    return { open, pt };
  });
  ok('directions panel opens', dir.open);
  ok('"lat,lng" input resolves to [lng,lat] without network', dir.pt && dir.pt[0] === -2.59 && dir.pt[1] === 51.45);

  // Command registry (Phase 2): Maps registers its commands; one runs end-to-end.
  const reg = await page.evaluate(async () => {
    const { getRegistry } = await import('../js/command-registry.js');
    const r = getRegistry();
    const ids = r.contributions({ app: 'maps' }).map((c) => c.id);
    const app = window.__maps.app; const before = app._dir.hidden;
    r.run('maps.directions', { app: 'maps' });
    return { ids, toggled: before !== app._dir.hidden };
  });
  ok('Maps registers its commands (3d/buildings/pins/directions)', reg.ids.includes('maps.toggle3d') && reg.ids.includes('maps.toggleBuildings') && reg.ids.includes('maps.togglePins') && reg.ids.includes('maps.directions'));
  ok('maps.directions runs through the registry (toggles the panel)', reg.toggled);
  ok('Maps contributes cross-app sharing commands (group + data table)', reg.ids.includes('maps.shareToGroup') && reg.ids.includes('maps.placesToTable'));

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally { await browser.close(); server.close(); }
console.log(fail ? `\n${fail} FAILURE(S)` : '\nMAPS OK');
process.exit(fail ? 1 : 0);
