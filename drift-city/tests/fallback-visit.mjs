// The WebGL fallback in a story place: a hop arrives and holds there, W walks into the scene, and the map view goes
// up and comes back. Headless Chromium has no WebGPU, so this page runs the fallback (the drift-city skill, "The WebGL fallback").
//   python3 drift-city/tools/assemble.py && node drift-city/tests/fallback-visit.mjs
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const page = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'city.html')).href + '?nointro';
let failed = 0;
const pass = (m) => console.log('✔', m);
const fail = (m) => { failed++; console.error('✖', m); };

const b = await chromium.launch({ headless: true, executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 480, height: 320 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(page);
await p.waitForFunction(() => globalThis.__drift && __drift.places().length > 0, null, { timeout: 60000 });
await p.waitForTimeout(3000);
const where = () => p.evaluate(() => ({ mode: __drift.NAV.mode, at: [__drift.st.x, __drift.st.y, __drift.st.z], to: __drift.NAV.visit && [__drift.NAV.visit.to.x, __drift.NAV.visit.to.y, __drift.NAV.visit.to.z], status: document.getElementById('status').textContent }));
const dist = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);

for (const id of ['civic_axis', 'street_1']) {
  await p.evaluate((id) => __drift.hopPlace(id), id);
  await p.waitForTimeout(4000);
  const r1 = await where();
  await p.waitForTimeout(3000);
  const r2 = await where();
  r1.mode === 'visit' && dist(r1.at, r1.to) < 0.5 && dist(r2.at, r1.at) < 0.5
    ? pass(`${id}: the view arrives and stays (${dist(r2.at, r2.to).toFixed(2)} m from the place)`)
    : fail(`${id}: ${JSON.stringify({ r1, r2 })}`);
  !/Autopilot/.test(r2.status) ? pass(`${id}: status line "${r2.status}"`) : fail(`${id}: status line says "${r2.status}"`);
}
const a = (await where()).at;
await p.keyboard.down('w'); await p.waitForTimeout(2500); await p.keyboard.up('w');
const moved = dist((await where()).at, a);
moved > 1 ? pass(`W walks into the scene (${moved.toFixed(1)} m)`) : fail(`W moved ${moved.toFixed(2)} m`);
// the map view is a visit too: up to 900 m looking straight down, then back to flight when it is turned off
await p.evaluate(() => __drift.mapViewSet(true));
await p.waitForTimeout(5000);
const mv = await p.evaluate(() => ({ mode: __drift.NAV.mode, y: __drift.st.y, pitch: __drift.st.pitch }));
mv.mode === 'visit' && mv.y >= 899 && mv.pitch < -1.45
  ? pass(`map view: ${mv.y.toFixed(0)} m up, looking down (pitch ${mv.pitch.toFixed(2)})`) : fail(`map view: ${JSON.stringify(mv)}`);
await p.evaluate(() => __drift.mapViewSet(false));
await p.waitForTimeout(5000);
const back = await p.evaluate(() => ({ mode: __drift.NAV.mode, y: __drift.st.y }));
back.mode === 'visit' && back.y < 20 ? pass(`map view off: back in the scene (${back.y.toFixed(1)} m)`) : fail(`map view off: ${JSON.stringify(back)}`);
errs.length ? fail('page errors: ' + errs.slice(0, 3).join(' | ')) : pass('no page errors');
await b.close();
console.log(failed ? '\nFALLBACK-VISIT: FAIL' : '\nFALLBACK-VISIT: PASS');
process.exit(failed ? 1 : 0);
