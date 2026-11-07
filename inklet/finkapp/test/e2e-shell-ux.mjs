// The shell's everyday moves: finding apps, switching, snapping, recall keys and notices.
// Headless, against `foafos-stack start shell`. No window appears on the desktop.
//   CHROMIUM_PATH=... node e2e-shell-ux.mjs
import { chromium } from 'playwright';

const { CHROMIUM_PATH } = process.env;
const URL_ = 'http://localhost:8080/glitchcan-minigam/inklet/finkapp/?root=all&player=none';
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`); if (!ok) failed++; };

const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH });
const open = async (viewport, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => { if (!/serviceWorker/.test(e.message)) errors.push(e.message); });
  await page.goto(URL_);
  await page.waitForFunction(() => window.FoafOS?.launchApp, null, { timeout: 30000 });
  await page.waitForTimeout(700);
  return { ctx, page, errors };
};
const keys = async (page, list) => {
  await page.keyboard.down('Control');
  for (const k of list) await page.keyboard.press(k);
  await page.keyboard.up('Control');
  await page.waitForTimeout(250);
};
const onTop = (page, sel) => page.evaluate((s) => {
  const r = document.querySelector(s).getBoundingClientRect();
  return !!document.elementFromPoint(r.left + r.width / 2, r.top + 8)?.closest(s);
}, sel);

try {
  const { ctx, page, errors } = await open({ width: 1280, height: 800 });

  // All apps
  await keys(page, [';', 'a']);
  check(await page.isVisible('#foafos-home'), 'ctrl ; a opens All apps');
  check(await page.evaluate(() => document.querySelector('#foafos-home details[data-folder="essentials"]')?.open === true), 'Essentials starts open');
  await page.fill('.foafos-home-search input', 'zzzz');
  check(await page.isVisible('.foafos-home-none'), 'a search with no match says so');
  await page.fill('.foafos-home-search input', 'tally');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  check(await page.evaluate(() => [...document.querySelectorAll('.foafos-window')].some((w) => /Tally/.test(w.textContent))), 'Enter opens the top result, and search finds widgets');

  // What you open comes to the front
  await page.evaluate(() => FoafOS.launchApp('chat'));
  await page.waitForTimeout(800);
  await page.evaluate(() => FoafOS.launchApp('system'));
  await page.waitForTimeout(500);
  check(await onTop(page, '#foafos-session-win'), 'what you open comes to the front');

  // Snapping
  const box = () => page.evaluate(() => { const r = document.getElementById('foafos-session-win').getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); });
  await keys(page, [';', 'l']);
  check(String(await box()) === '0,0,640,800', 'ctrl ; l snaps left, full height');
  await keys(page, [';', 'r']);
  check(String(await box()) === '640,0,640,800', 'ctrl ; r snaps right');
  await keys(page, [';', 'm']);
  check(await page.evaluate(() => document.querySelector('#foafos-session-win .foafos-window-max').getAttribute('aria-pressed')) === 'true', 'ctrl ; m uses the real Maximize');

  // Menu and All windows
  await keys(page, [';', 'f', 'o', 'a', 'f']);
  check(await page.evaluate(() => !document.getElementById('wm-chrome').classList.contains('collapsed')), 'ctrl ; f o a f opens the menu');
  check(await page.evaluate(() => document.querySelectorAll('#wm-open-sect button').length) >= 2, 'the menu lists open windows');
  await page.evaluate(() => FinkWM._setCollapsed(true));
  await keys(page, [';', 's']);
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => document.querySelectorAll('.foafos-ov-close').length);
  check(before >= 2, 'ctrl ; s shows cards with close buttons');
  await page.evaluate(() => document.querySelector('.foafos-ov-close').click());
  await page.waitForTimeout(1000);
  check(await page.evaluate(() => document.querySelectorAll('.foafos-ov-close').length) === before - 1, 'closing a card leaves All windows open on the rest');
  await page.evaluate(() => document.getElementById('foafos-ov-done')?.click());

  // Notices
  await page.evaluate(() => { FoafOS.pods.add({ id: 'uxpod', label: 'Ux pod', base: 'https://pod.example/', carriage: 'https', auth: 'bearer' }); FoafOS.pods.setAppsPod('uxpod'); });
  await page.waitForTimeout(400);
  const said = await page.evaluate(() => document.querySelector('#foafos-nudge span')?.textContent || ''); check(/Ux pod/.test(said), `a pod that needs a login says so: ${said}`);
  check(await page.evaluate(() => document.getElementById('wm-chrome').classList.contains('wm-attention')), 'and marks the menu handle');
  check(!errors.length, `no page errors ${errors.slice(0, 2)}`);
  await ctx.close();

  // Phone
  const phone = await open({ width: 390, height: 780 }, true);
  await phone.page.evaluate(() => FoafOS.openSystem());
  await phone.page.waitForTimeout(400);
  const small = await phone.page.evaluate(() => [...document.querySelectorAll('.foafos-window-btn')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 40).length);
  check(small === 0, 'window buttons are touch sized on a phone');
  await phone.ctx.close();
} catch (e) {
  console.log(`FAIL exception: ${e.message}`);
  failed++;
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
