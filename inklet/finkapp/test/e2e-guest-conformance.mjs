// foafos-lite conformance inside full foafos (issue 1038 step 4): the app that runs the suite
// standalone and under @foafos/host-lite (packages/foafos-host-lite/test/conformance.test.mjs)
// runs it here, in a sandboxed frame of the real shell, with storage in the shared pod.
// Also: pause and resume from the shell reach it as lifecycle, and its ⋯ menu calls its action.
//   SHELL_URL=... CHROMIUM_PATH=... node e2e-guest-conformance.mjs
import { chromium } from 'playwright';

const URL_ = process.env.SHELL_URL || 'http://localhost:8080/glitchcan-minigam/inklet/finkapp/?root=all&player=none';
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`); if (!ok) failed++; };

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => { if (!/serviceWorker/.test(e.message)) errors.push(e.message); });
  await page.goto(URL_);
  await page.waitForFunction(() => window.FoafOS?.launchApp, null, { timeout: 30000 });
  await page.waitForTimeout(700);
  check(await page.evaluate(() => { FoafOS.openHome(); const listed = !!document.querySelector('#foafos-home .foafos-app[data-app="guest-conformance"]'); document.getElementById('foafos-home')?.remove(); return !listed; }),
    'the fixture is not listed in All apps');
  await page.evaluate(() => FoafOS.launchApp('guest-conformance'));
  let frame = null;
  for (let i = 0; i < 100 && !frame; i++) { await page.waitForTimeout(100); frame = page.frames().find((f) => f.url().includes('foafos-guest/conformance/app.html')); }
  check(!!frame, 'the conformance app opens in a window');
  await frame.waitForFunction(() => window.__conformance, null, { timeout: 20000 });
  const conf = await frame.evaluate(() => window.__conformance);
  check(conf.level === 2, `full foafos grants level 2 (${conf.level})`);
  for (const r of conf.results) check(r.ok, `suite: ${r.name}${r.ok ? '' : ` — ${r.detail}`}`);

  // Pause and resume through Task Manager's verb reach the app as lifecycle.
  await page.evaluate(() => { const n = [...FoafOS.apps.nodes.values()].find((x) => x.appId === 'guest-conformance'); FoafOS.setSubtreeSuspended(n.id, true); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const n = [...FoafOS.apps.nodes.values()].find((x) => x.appId === 'guest-conformance'); FoafOS.setSubtreeSuspended(n.id, false); });
  await page.waitForTimeout(300);
  const life = await frame.evaluate(() => window.__conformance.life);
  check(life.join() === 'paused,running', `pause and resume reach the app (${life.join()})`);

  // The app's menu: ⋯ in its window bar, Ping calls its action.
  await page.click('.foafos-lite-menu');
  await page.click('.foafos-lite-list button');
  await page.waitForTimeout(300);
  const acts = await frame.evaluate(() => window.__conformance.acts);
  check(acts.join() === 'ping', `the window's ⋯ menu calls the app's action (${acts.join() || 'none'})`);
  check(!errors.length, `no page errors ${errors.slice(0, 2)}`);
} catch (e) {
  console.log(`FAIL exception: ${e.message}`);
  failed++;
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
