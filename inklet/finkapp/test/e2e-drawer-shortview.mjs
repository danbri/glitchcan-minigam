#!/usr/bin/env node
// The shell drawer on a SHORT viewport — an in-app browser (Claude's iOS
// WKWebView) has a URL bar on top and a toolbar plus the home indicator on
// the bottom, so the usable height is much shorter than Safari's. The drawer
// used to be overflow:hidden with only the FEED scrolling; on a short screen
// the fixed sections (SOUND, SKIN, APPS, WINDOWS) were squeezed and clipped
// with no way to reach them — "the app list and running apps are missing".
//
// This asserts that on a short viewport the APPS and WINDOWS sections are
// present AND reachable (scrollable into the drawer's visible box).
//
//   node inklet/finkapp/test/e2e-drawer-shortview.mjs

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8187;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const CORS_SERVER = `
import http.server, functools
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', ${PORT}),
    functools.partial(H, directory='${serveRoot}')).serve_forever()
`;
const server = spawn('python3', ['-c', CORS_SERVER], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

let failures = 0;
const fail = (m) => { console.error('✖', m); failures++; };
const pass = (m) => console.log('✔', m);

let browser;
try {
  browser = await chromium.launch({
    headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader'],
  });
  // A deliberately short viewport — a phone in-app browser after its
  // chrome eats the top and bottom. iPhone 14 is 390×844; take ~430px
  // of that for the browser's own furniture.
  const page = await browser.newPage({ viewport: { width: 390, height: 320 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/`);
  await page.waitForFunction(() => !!window.FoafOS?.launchApp, null, { timeout: 25000 });
  await page.waitForTimeout(1200);

  // Open the drawer via the dock.
  await page.click('#foafos-dock');
  await page.waitForTimeout(400);
  const open = await page.evaluate(() =>
    document.getElementById('foafos-drawer').classList.contains('open'));
  if (open) pass('drawer opened from the dock');
  else fail('drawer did not open');

  // THE FIX ITSELF: when content is taller than the short viewport the
  // drawer must offer a SCROLL PATH (overflow-y:auto + scrollHeight beyond
  // the visible box). The old overflow:hidden drawer had none — content
  // that did not fit was simply clipped away, which is why the app list and
  // running list went missing in the in-app browser.
  const scroll = await page.evaluate(() => {
    const d = document.getElementById('foafos-drawer');
    return {
      overflowY: getComputedStyle(d).overflowY,
      canScroll: d.scrollHeight > d.clientHeight + 4,
      scrollH: d.scrollHeight, clientH: d.clientHeight,
    };
  });
  if (scroll.overflowY === 'auto' || scroll.overflowY === 'scroll') {
    pass(`drawer body is scrollable (overflow-y:${scroll.overflowY})`);
  } else fail(`drawer not scrollable: overflow-y is ${scroll.overflowY}`);
  if (scroll.canScroll) {
    pass(`content exceeds the short viewport and scrolls (${scroll.scrollH} > ${scroll.clientH})`);
  } else fail(`no scroll path for overflowing content (${scroll.scrollH} vs ${scroll.clientH})`);

  // The APPS and WINDOWS sections must EXIST (they are always in the markup)
  // and be REACHABLE — scrollable so their box lands inside the drawer's
  // visible height. On the old overflow:hidden drawer they were clipped
  // below the fold with no scroll path.
  const sections = ['#foafos-apps-wrap', '#foafos-shelf-wrap'];
  for (const sel of sections) {
    const reachable = await page.evaluate(async (s) => {
      const drawer = document.getElementById('foafos-drawer');
      const el = document.querySelector(s);
      if (!el) return { ok: false, why: 'missing from markup' };
      el.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 150));
      const d = drawer.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      // its box overlaps the drawer's visible box after scrolling to it
      const visible = r.bottom > d.top + 4 && r.top < d.bottom - 4;
      return { ok: visible, why: `el ${Math.round(r.top)}-${Math.round(r.bottom)} vs drawer ${Math.round(d.top)}-${Math.round(d.bottom)}` };
    }, sel);
    if (reachable.ok) pass(`${sel} is present and reachable on a short viewport (${reachable.why})`);
    else fail(`${sel} not reachable: ${reachable.why}`);
  }

  // The two APPS buttons that OPEN the app list and the running list must be
  // hittable (in the layout, non-zero box, inside the drawer once scrolled).
  const buttons = await page.evaluate(async () => {
    const drawer = document.getElementById('foafos-drawer');
    const out = {};
    for (const id of ['foafos-home-btn', 'foafos-switch-btn']) {
      const b = document.getElementById(id);
      if (!b) { out[id] = 'missing'; continue; }
      b.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 120));
      const d = drawer.getBoundingClientRect();
      const r = b.getBoundingClientRect();
      out[id] = (r.width > 0 && r.height > 0 && r.bottom > d.top && r.top < d.bottom) ? 'hittable' : `off (${Math.round(r.top)}-${Math.round(r.bottom)})`;
    }
    return out;
  });
  if (buttons['foafos-home-btn'] === 'hittable') pass('⊞ Apps button hittable on a short viewport');
  else fail('Apps button not hittable: ' + buttons['foafos-home-btn']);
  if (buttons['foafos-switch-btn'] === 'hittable') pass('⧉ Running button hittable on a short viewport');
  else fail('Running button not hittable: ' + buttons['foafos-switch-btn']);

  // The header ✕ must stay reachable (sticky) even after scrolling down.
  const closeReachable = await page.evaluate(async () => {
    const drawer = document.getElementById('foafos-drawer');
    drawer.scrollTop = drawer.scrollHeight;   // scroll to the very bottom
    await new Promise((r) => setTimeout(r, 120));
    const d = drawer.getBoundingClientRect();
    const c = document.getElementById('foafos-close').getBoundingClientRect();
    return c.top >= d.top - 2 && c.bottom <= d.top + 80;   // pinned near the top edge
  });
  if (closeReachable) pass('header ✕ stays pinned while the body scrolls');
  else fail('header ✕ scrolled away');

  if (!pageErrors.length) pass('no page errors');
  else fail('page errors: ' + pageErrors.join(' | '));
} catch (e) {
  fail('threw: ' + (e && e.stack ? e.stack : e));
} finally {
  if (browser) await browser.close();
  server.kill();
}

console.log(failures ? `\nDRAWER SHORT-VIEW: ${failures} FAIL` : '\nDRAWER SHORT-VIEW: PASS');
process.exit(failures ? 1 : 0);
