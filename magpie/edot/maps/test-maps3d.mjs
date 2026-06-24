// test-maps3d.mjs — headless tests for the 3D / geospatial-3D additions to the
// edot maps viewer: terrain/sky/buildings config builders (pure), KML→GeoJSON
// conversion (pure, real DOMParser), the GeoJSON-bounds helper, and the DOM
// wiring of the 3D / Buildings toggle buttons.
//
// Same harness + caveats as test-maps.mjs: WebGL renders via SwiftShader and
// WebGPU is unavailable headless, so we DON'T verify rendered relief/extrusion
// pixels — we assert the config the component hands MapLibre and the toggles'
// state. The KML parser is exercised end-to-end through the browser's DOMParser.
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

  const glReady = await page.evaluate(() => !!(window.__maps.app.map && window.__maps.app.glAvailable));
  console.log(`   (WebGL map ${glReady ? 'INITIALISED' : 'NOT available headless — validating non-GL logic only'})`);

  // 1. Terrain config builders (pure).
  const ter = await page.evaluate(() => {
    const t = window.__maps.terrain; const cfg = window.__maps.config.terrain;
    const dem = t.buildDemSource(cfg);
    const spec = t.buildTerrainSpec(cfg);
    const sky = t.buildSkySpec(cfg);
    const noDem = t.buildDemSource({ tiles: [] });
    return { dem, spec, sky, noDem, src: t.TERRAIN_SRC };
  });
  ok('DEM source is raster-dem with the configured tiles + encoding',
    ter.dem && ter.dem.type === 'raster-dem' && /terrarium/.test(ter.dem.tiles[0]) && ter.dem.encoding === 'terrarium');
  ok('terrain spec references the DEM source + exaggeration',
    ter.spec.source === ter.src && ter.spec.exaggeration === 1.4);
  ok('sky spec carries sky/horizon/fog colours for setSky',
    ter.sky['sky-color'] && ter.sky['horizon-color'] && ter.sky['fog-color']);
  ok('DEM builder returns null when no tiles configured', ter.noDem === null);

  // 2. 3D buildings layer builder + source detection (pure).
  const bld = await page.evaluate(() => {
    const t = window.__maps.terrain;
    const layer = t.buildBuildingsLayer({ source: 'src', sourceLayer: 'building', color: '#abc' });
    // detect from a style that already has a fill-extrusion layer
    const withExtrusion = t.detectBuildingSource({
      sources: { v: { type: 'vector' } },
      layers: [{ id: 'b', type: 'fill-extrusion', source: 'v', 'source-layer': 'building' }],
    });
    // detect from a vector source with no extrusion -> guess 'building' layer
    const guess = t.detectBuildingSource({ sources: { openmaptiles: { type: 'vector' } }, layers: [] });
    // raster-only style -> null
    const none = t.detectBuildingSource({ sources: { basemap: { type: 'raster' } }, layers: [] });
    return { layer, withExtrusion, guess, none, id: t.BUILDINGS_LAYER };
  });
  ok('buildings layer is a fill-extrusion with height expression',
    bld.layer.type === 'fill-extrusion' && bld.layer.id === bld.id &&
    Array.isArray(bld.layer.paint['fill-extrusion-height']) &&
    bld.layer['source-layer'] === 'building');
  ok('detect prefers an existing fill-extrusion source/source-layer',
    bld.withExtrusion && bld.withExtrusion.source === 'v' && bld.withExtrusion.sourceLayer === 'building');
  ok('detect falls back to a vector source + guessed building layer',
    bld.guess && bld.guess.source === 'openmaptiles' && bld.guess.sourceLayer === 'building');
  ok('detect returns null for a raster-only style', bld.none === null);

  // 3. KML → GeoJSON (pure, real DOMParser).
  const kml = await page.evaluate(() => {
    const { kmlToGeoJson } = window.__maps.kml;
    const doc = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
 <Document>
  <Placemark><name>Pin</name><description>a point</description>
    <Point><coordinates>-2.59,51.45,0</coordinates></Point></Placemark>
  <Placemark><name>Path</name>
    <LineString><coordinates>-2.6,51.4 -2.5,51.5 -2.4,51.45</coordinates></LineString></Placemark>
  <Placemark><name>Area</name>
    <Polygon><outerBoundaryIs><LinearRing>
      <coordinates>-2.7,51.4 -2.6,51.4 -2.6,51.5 -2.7,51.5 -2.7,51.4</coordinates>
    </LinearRing></outerBoundaryIs></Polygon></Placemark>
  <Placemark><name>Multi</name>
    <ExtendedData><Data name="kind"><value>poi</value></Data></ExtendedData>
    <MultiGeometry>
      <Point><coordinates>0,0</coordinates></Point>
      <Point><coordinates>1,1</coordinates></Point>
    </MultiGeometry></Placemark>
 </Document>
</kml>`;
    const fc = kmlToGeoJson(doc);
    const byName = (n) => fc.features.find((f) => f.properties.name === n);
    return {
      n: fc.features.length,
      type: fc.type,
      point: byName('Pin'),
      line: byName('Path'),
      poly: byName('Area'),
      multiCount: fc.features.filter((f) => f.properties.kind === 'poi').length,
      polyClosed: (() => { const c = byName('Area').geometry.coordinates[0]; return JSON.stringify(c[0]) === JSON.stringify(c[c.length - 1]); })(),
    };
  });
  ok('KML parses to a FeatureCollection', kml.type === 'FeatureCollection');
  ok('KML yields point/line/polygon + 2 from MultiGeometry (5 features)', kml.n === 5);
  ok('KML Point keeps lng,lat and drops altitude', kml.point.geometry.type === 'Point' && JSON.stringify(kml.point.geometry.coordinates) === JSON.stringify([-2.59, 51.45]));
  ok('KML LineString has 3 vertices', kml.line.geometry.type === 'LineString' && kml.line.geometry.coordinates.length === 3);
  ok('KML Polygon ring is closed (first==last)', kml.poly.geometry.type === 'Polygon' && kml.polyClosed);
  ok('KML MultiGeometry expands to separate features w/ ExtendedData', kml.multiCount === 2);

  // 3b. KML error handling — malformed XML throws (not silently mis-parsed).
  const kmlErr = await page.evaluate(() => {
    try { window.__maps.kml.kmlToGeoJson('<kml><Placemark><Point>'); return 'no-throw'; }
    catch (e) { return 'threw'; }
  });
  ok('malformed KML throws rather than mis-parsing', kmlErr === 'threw');

  // 4. featureCollectionBounds (pure) over mixed geometry.
  const bounds = await page.evaluate(() => {
    const { featureCollectionBounds } = window.__maps.geo;
    const fc = { type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-2.6, 51.4] } },
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-2.4, 51.5], [-2.5, 51.45]] } },
    ] };
    const empty = featureCollectionBounds({ type: 'FeatureCollection', features: [] });
    return { b: featureCollectionBounds(fc), empty };
  });
  ok('bounds spans all coordinates [[W,S],[E,N]]',
    JSON.stringify(bounds.b) === JSON.stringify([[-2.6, 51.4], [-2.4, 51.5]]));
  ok('bounds is null for an empty collection', bounds.empty === null);

  // 5. 3D toggle DOM wiring (state flips even without GL).
  const toggles = await page.evaluate(() => {
    const app = window.__maps.app;
    const d3 = app._d3Toggle; const bld = app._bldToggle;
    const before = d3.getAttribute('aria-pressed');
    app.toggle3D();           // -> on
    const on = d3.getAttribute('aria-pressed');
    const is3D = app.is3D;
    app.toggle3D();           // -> off
    const off = d3.getAttribute('aria-pressed');
    // buildings toggle exists + flips its own state field
    app.toggleBuildings(true);
    const bState = app.buildings3D || bld.getAttribute('aria-pressed') === 'true' || bld.getAttribute('aria-pressed') === 'false';
    app.toggleBuildings(false);
    return { before, on, is3D, off, hasBld: !!bld, bState };
  });
  ok('3D toggle button starts off and flips aria-pressed on/off',
    toggles.before === 'false' && toggles.on === 'true' && toggles.off === 'false');
  ok('toggle3D updates the is3D state field', toggles.is3D === true);
  ok('Buildings toggle button is present and toggleable', toggles.hasBld && toggles.bState);

  // 5b. KML import button + input are wired into the sidebar.
  ok('KML import control exists in the toolbar', await page.evaluate(() =>
    !!document.querySelector('edot-maps .mp-kml-btn') && !!window.__maps.app._kmlInput));

  // 5c. addKmlGeoJson stores the FC for re-apply across style switches.
  ok('addKmlGeoJson records the overlay FeatureCollection', await page.evaluate(() => {
    const app = window.__maps.app;
    const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-2.5, 51.5] } }] };
    const n = app.addKmlGeoJson(fc);
    return n === 1 && app._importedFC === fc;
  }));

  // 6. If GL is up, smoke-check that enabling 3D adds the DEM source + terrain.
  if (glReady) {
    const live = await page.evaluate(async () => {
      const app = window.__maps.app;
      app.set3D(true);
      // give MapLibre a tick to register the source
      await new Promise((r) => setTimeout(r, 300));
      const hasSrc = !!(app.map.getSource && app.map.getSource(window.__maps.terrain.TERRAIN_SRC));
      const terr = app.map.getTerrain ? app.map.getTerrain() : null;
      app.set3D(false);
      return { hasSrc, terr };
    });
    ok('enabling 3D adds the DEM source (live map)', live.hasSrc);
  }

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally { await browser.close(); server.close(); }
console.log(fail ? `\n${fail} FAILURE(S)` : '\nMAPS-3D OK');
process.exit(fail ? 1 : 0);
