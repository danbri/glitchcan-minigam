// Headless browser test of the runner. Needs a static server at the repo root:
//   python3 -m http.server 8765   (from the repo root)
//   node magpie/miniapps/test/browser.mjs [base-url]
// Exit 0 when every check passes.
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:8765/magpie/miniapps/';
const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

let failed = 0;
const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (!cond) failed++; };
const states = () => page.evaluate(() => window.__miniapps.host.log.map(e => `${e.scope}:${e.state}${e.route ? ':' + e.route.split('/').pop() : ''}`));
const pageFrame = (i) => page.frames().filter(f => f.parentFrame() === page.mainFrame())[i];
const waitFor = async (fn, ms = 5000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await page.waitForTimeout(50); } return false; };

await page.goto(base + 'index.html?lang=zh-CN');
await waitFor(() => page.evaluate(() => !!window.__miniapps));
check(await waitFor(async () => (await states()).includes('page:shown:index')), 'start page reaches "shown"');
const s1 = await states();
check(JSON.stringify(s1.slice(0, 5)) === JSON.stringify(['global:launched', 'global:shown', 'page:loaded:index', 'page:ready:index', 'page:shown:index']),
  `order launched, shown, loaded, ready, shown: ${s1.slice(0, 5).join(' ')}`);

const view = pageFrame(1);
check(await view.evaluate(() => document.querySelector('h1').textContent) === '你好，小程序', 'i18n: zh-CN title in the view');
check(await view.evaluate(() => location.origin) === 'null', 'view frame origin is opaque');
check(await pageFrame(0).evaluate(() => location.origin) === 'null', 'logic frame origin is opaque');
check(await view.evaluate(() => { try { return parent.document && 'reachable'; } catch { return 'blocked'; } }) === 'blocked', 'view cannot reach the host DOM');
check(await waitFor(() => view.evaluate(() => /访问次数: \d+ · app shown/.test(document.getElementById('status').textContent))), 'logic -> view message with stored visit count');
check(await view.evaluate(() => document.querySelector('img').src.startsWith('data:image/svg+xml')), 'package image becomes a data: URL');

const grants = await page.evaluate(() => ({ g: window.__miniapps.host.granted.map(x => x.cap), r: window.__miniapps.host.refused.map(x => x.name) }));
check(JSON.stringify(grants.g) === '["storage","geolocation"]' && JSON.stringify(grants.r) === '["system.permission.CAMERA"]', `grants ${JSON.stringify(grants)}`);

// Navigation: link with a query string, then deeper, then back.
await view.click('a.btn');
check(await waitFor(async () => (await states()).includes('page:shown:detail')), 'link opens the detail page');
check((await states()).includes('page:hidden:index'), 'index page goes "hidden"');
const detail = pageFrame(2);
check(await detail.evaluate(() => document.getElementById('q').textContent) === '{"from":"index","n":"1"}', 'pageInputQuery from the link');
check(decodeURIComponent(page.url()).includes('foafos://miniapp/org.glitchcan.hello;version=1.0.0/pages/detail/detail?from=index&n=1'), `URL carries the MiniApp URI: ${decodeURIComponent(page.url())}`);
await page.click('#back');
check(await waitFor(async () => (await states()).filter(s => s === 'page:shown:index').length === 2), 'back shows the index page again');
check((await states()).includes('page:unloaded:detail'), 'back unloads the detail page');

// Deep link straight to the detail page.
const deep = await page.evaluate(() => location.href.replace(/uri=[^&]*/, 'uri=' + encodeURIComponent('foafos://miniapp/org.glitchcan.hello/pages/detail/detail?n=7')));
const page2 = await browser.newPage();
page2.on('pageerror', (e) => errors.push(`page2 pageerror: ${e.message}`));
await page2.goto(deep);
const f2 = () => page2.frames().filter(f => f.parentFrame() === page2.mainFrame())[1];
check(await (async () => { for (let i = 0; i < 100; i++) { const f = f2(); if (f && await f.evaluate(() => document.getElementById('q')?.textContent).catch(() => null) === '{"n":"7"}') return true; await page2.waitForTimeout(50); } return false; })(), 'deep link opens detail with n=7');
await page2.close();

// Home and back; an error in the logic layer; close.
await page.click('#hide');
await page.click('#show');
let s = await states();
check(s.slice(-4).join(' ') === 'page:hidden:index global:hidden global:shown page:shown:index', `home/return: ${s.slice(-4).join(' ')}`);
await pageFrame(1).click('#err');
check(await waitFor(async () => (await states()).includes('global:error')), 'logic-layer exception -> global "error"');
check((await states()).at(-1) === 'global:shown', 'after the error the app is "shown" again');
await page.click('#close');
s = await states();
check(s.slice(-2).join(' ') === 'page:unloaded:index global:unloaded', `close: ${s.slice(-2).join(' ')}`);
check(await page.evaluate(() => window.__miniapps.tree.children(window.__miniapps.root.id).length) === 0, 'tree node closed');

// Attenuation: a root without geolocation refuses LOCATION, and the API call is denied.
await page.goto(base + 'index.html?deny=geolocation');
await waitFor(async () => (await page.evaluate(() => window.__miniapps?.host.log.length || 0)) >= 5);
const r2 = await page.evaluate(() => window.__miniapps.host.refused.map(x => `${x.name}:${x.reason}`));
check(r2.includes('system.permission.LOCATION:the root does not hold it'), `LOCATION refused by attenuation: ${r2}`);
await pageFrame(1).click('#loc');
check(await waitFor(() => pageFrame(1).evaluate(() => /location refused: denied/.test(document.getElementById('log').textContent))), 'location.get denied at call time');

await page.screenshot({ path: process.env.SHOT || '/tmp/miniapps-runner.png', fullPage: true });
check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
