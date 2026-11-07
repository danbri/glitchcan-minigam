// Places in the pod: the places.* tools the shell offers, and the Places tab of System.
// Headless, against `foafos-stack start shell`, on the built-in pod. No window appears.
// Moglob does not announce its tools under headless software GL, so a stand-in frame
// answers get_view, fly_to and go_to here; the real one is the same protocol.
//   CHROMIUM_PATH=... node e2e-places.mjs
//   FOAFOS_URL=http://localhost:8091/glitchcan-minigam/inklet/finkapp/ to test another checkout
import { chromium } from 'playwright';

const { CHROMIUM_PATH } = process.env;
const BASE = process.env.FOAFOS_URL || 'http://localhost:8080/glitchcan-minigam/inklet/finkapp/';
let failed = 0;
const check = (ok, what, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${ok || detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`); if (!ok) failed++; };

const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => { if (!/serviceWorker/.test(e.message)) errors.push(e.message); });
  page.on('dialog', (d) => d.accept());
  await page.goto(`${BASE}?root=all&player=none`);
  await page.waitForFunction(() => window.FoafOS?.launchApp && FoafOS.tools?.find('places'), null, { timeout: 30000 });

  const offered = await page.evaluate(() => FoafOS.tools.find('places').tools.map((t) => t.name + (t.readOnly ? '' : '*')));
  check(String(offered) === 'list,save*,delete*,fly_to*', 'the shell offers places.list, save, delete and fly_to; only list is read-only', offered);

  // A stand-in Moglob, attached as the shell attaches a frame.
  await page.evaluate(() => {
    window.__moglobCalls = [];
    const VIEW = { eye: { lon: -0.0235, lat: 51.4995, height_m: 812 }, target: { lon: -0.0235, lat: 51.5055, height_m: 12, ground_m: 3 }, heading_deg: 180, pitch_deg: -40, range_m: 1200 };
    const p = FoafOS.tools.attach({ id: 'docklands', label: 'Moglob', source: { standIn: true }, post: (m) => {
      window.__moglobCalls.push(m);
      queueMicrotask(() => FoafOS.tools.receive(p, { type: 'webmcp.result', id: m.id, ok: true, value: m.name === 'get_view' ? VIEW : { status: 'flying' } }));
    } });
    FoafOS.tools.receive(p, { type: 'webmcp.tools', api: 'stand-in', tools: [{ name: 'get_view', readOnly: true }, { name: 'fly_to' }, { name: 'go_to' }] });
  });

  const r = await page.evaluate(async () => {
    const { PERSON } = await import('../../packages/foafos/src/tool-grants.mjs');
    const me = (t, a) => FoafOS.tools.call('places', t, a, { caller: PERSON });
    const out = {};
    out.before = await me('list', {});
    out.fromView = await me('save', { name: 'One Canada Square', description: 'The tower, from the south' });
    out.given = await me('save', { name: 'Tokyo Station', lat: 35.6812, lon: 139.7671, altitude: 1500 });
    out.doc = await FoafOS.pods.invoke('foafos.places', 'pod.get', { path: 'one-canada-square.jsonld' });
    // A second place of one name is a new file: the built-in pod honours If-None-Match.
    out.dup = await me('save', { name: 'Tokyo Station', lat: 1, lon: 1 });
    out.firstKept = await FoafOS.pods.invoke('foafos.places', 'pod.get', { path: 'tokyo-station.jsonld' });
    out.ambiguous = await me('delete', { place: 'TOKYO STATION' });
    out.dupGone = await me('delete', { place: 'tokyo-station-2' });
    out.list = await me('list', {});
    out.fly = await me('fly_to', { place: 'one canada square', duration_s: 6 });
    out.flyArgs = window.__moglobCalls.at(-1);
    out.agent = await FoafOS.tools.call('places', 'save', { name: 'x', lat: 0, lon: 0 }, { caller: { kind: 'agent', id: 'browser-agent', label: 'a browser agent' } });
    return out;
  });
  check(r.before.ok, 'places.list works with no places', r.before);
  check(r.fromView.ok && r.fromView.value.saved.lat === 51.5055 && r.fromView.value.saved.view.altitude === 809 && r.fromView.value.saved.view.pitch === 40,
    'places.save with no coordinates saves where Moglob looks, with its view', r.fromView);
  check(r.given.ok && r.given.value.saved.id === 'tokyo-station', 'places.save from coordinates', r.given);
  let doc = null;
  try { doc = JSON.parse(r.doc.body); } catch { /* checked below */ }
  check(r.doc.ok && /ld\+json/.test(r.doc.contentType) && doc?.['@type'] === 'Place' && doc.geo?.['@type'] === 'GeoCoordinates' && doc.geo.latitude === 51.5055 && doc['foafos:view']?.['foafos:altitude'] === 809,
    'the pod holds places/one-canada-square.jsonld, a schema.org Place', r.doc);
  check(r.dup.ok && r.dup.value.saved.id === 'tokyo-station-2' && JSON.parse(r.firstKept.body).geo.latitude === 35.6812,
    'a second save of one name makes tokyo-station-2 and keeps the first', { dup: r.dup, first: r.firstKept });
  check(/Say which by id: tokyo-station, tokyo-station-2/.test(r.ambiguous.error || ''), 'a delete by a shared name asks which', r.ambiguous);
  check(r.dupGone.ok, 'a delete by id works', r.dupGone);
  check(r.list.ok && r.list.value.places.map((p) => p.name).join() === 'One Canada Square,Tokyo Station', 'places.list lists both, in name order', r.list);
  check(r.fly.ok && r.fly.value.used === 'fly_to' && r.flyArgs?.name === 'fly_to'
    && JSON.stringify(r.flyArgs.args) === JSON.stringify({ lon: -0.0235, lat: 51.5055, alt_m: 809, heading_deg: 180, pitch_deg: 40, duration_s: 6 }),
  'places.fly_to calls Moglob\'s fly_to with the saved view', r.flyArgs);
  check(r.agent.reason === 'not-granted', 'a browser agent with a grant to look may not save a place', r.agent);

  // The Places tab of System.
  await page.evaluate(() => FoafOS.openPlaces());
  await page.waitForSelector('#foafos-places .fp-place', { timeout: 10000 });
  const names = await page.$$eval('#foafos-places .fp-place h3', (hs) => hs.map((h) => h.textContent));
  check(names.join() === 'One Canada Square,Tokyo Station', 'the Places tab lists them', names);
  await page.click('#foafos-places .fp-add summary');
  const inputs = page.locator('#foafos-places .fp-add input');
  const callsBefore = await page.evaluate(() => window.__moglobCalls.length);
  await inputs.nth(0).fill('Nowhere');
  await page.click('#foafos-places .fp-add button:has-text("Add")');
  await page.waitForTimeout(300);
  const blank = await page.evaluate(() => ({ status: document.querySelector('#foafos-places .fp-status').textContent, calls: window.__moglobCalls.length, cards: document.querySelectorAll('#foafos-places .fp-place').length }));
  check(/latitude and a longitude/.test(blank.status) && blank.calls === callsBefore && blank.cards === 2, 'Add with no coordinates asks for them, and saves nothing', blank);
  await inputs.nth(0).fill('Greenwich');
  await inputs.nth(1).fill('51.4769');
  await inputs.nth(2).fill('-0.0005');
  await page.click('#foafos-places .fp-add button:has-text("Add")');
  await page.waitForFunction(() => document.querySelectorAll('#foafos-places .fp-place').length === 3, null, { timeout: 10000 }).catch(() => {});
  check(await page.locator('#foafos-places .fp-place[data-place="greenwich"]').count() === 1, 'a place added by coordinates in the tab is listed');
  await page.click('#foafos-places [aria-label="Fly to Tokyo Station"]');
  await page.waitForTimeout(300);
  const last = await page.evaluate(() => window.__moglobCalls.at(-1));
  check(last?.name === 'fly_to' && last.args.lat === 35.6812 && last.args.alt_m === 1500, 'Fly to in the tab flies Moglob there', last);
  // A place deleted by a tool leaves the open tab.
  await page.evaluate(async () => {
    const { PERSON } = await import('../../packages/foafos/src/tool-grants.mjs');
    await FoafOS.tools.call('places', 'delete', { place: 'greenwich' }, { caller: PERSON });
  });
  await page.waitForFunction(() => document.querySelectorAll('#foafos-places .fp-place').length === 2, null, { timeout: 10000 }).catch(() => {});
  check(await page.locator('#foafos-places .fp-place').count() === 2, 'a place deleted by a tool leaves the open tab');
  await page.click('#foafos-places [aria-label="Delete Tokyo Station"]');
  await page.waitForFunction(() => document.querySelectorAll('#foafos-places .fp-place').length === 1, null, { timeout: 10000 }).catch(() => {});
  check(await page.locator('#foafos-places .fp-place').count() === 1, 'Delete in the tab deletes the place');
  check(!errors.length, 'no page errors', errors);
} finally {
  await browser.close();
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
