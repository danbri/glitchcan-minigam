#!/usr/bin/env node
// Boidwars in the shell: OS controls, real window sizes, a live bridge.
//
//   node inklet/finkapp/test/e2e-boidwars.mjs
//
// Reported from the field: "no OS controls and the different window
// sizes seem untested". Both were true, plus a third defect nobody had
// named: this guest wraps thumbwar/battleboids.html in a NESTED iframe,
// and its integration was written with `contentDocument` access — which
// a sandboxed opaque origin forbids. The auto-start and the completion
// poll were silent no-ops, so the game sat on its splash screen forever
// and never reported a result.
//
// What this locks:
//  - the WM chrome appears, expanded, for a controls:'none' guest
//  - full / split / pip each give the nested canvas a sane box, and the
//    canvas RESIZES with it (a nested frame gets no resize event of its
//    own when only its parent's box changed)
//  - the postMessage bridge comes up and the game leaves its splash
//  - the debug clock reaches two frames deep

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8149;
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
await new Promise(r => setTimeout(r, 900));

const fail = (m) => { console.error('✖', m); process.exitCode = 1; };
const pass = (m) => console.log('✔', m);

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push((e.stack || String(e)).slice(0, 600)));

  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?story=/${repoName}/inklet/hampstead.fink.js`);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
  await page.waitForTimeout(1200);

  // Launch boidwars the way the story does
  await page.evaluate(() => FinkMinigames.startMinigame('battleboids', 'normal'));
  await page.waitForSelector('#minigame-iframe-battleboids', { timeout: 15000 });
  await page.waitForFunction(() => window.FinkWM?.active === true, null, { timeout: 6000 });

  // 1. OS controls exist and are discoverable, even for a guest that
  // declares controls:'none' (that means "no d-pad", not "no shell")
  const chrome = await page.evaluate(() => {
    const el = document.getElementById('wm-chrome');
    const r = el.getBoundingClientRect();
    return {
      hidden: el.classList.contains('wm-hidden'),
      collapsed: el.classList.contains('collapsed'),
      w: Math.round(r.width),
      buttons: [...el.querySelectorAll('button')].filter(b => b.offsetParent !== null).length,
    };
  });
  !chrome.hidden && !chrome.collapsed && chrome.buttons >= 4
    ? pass(`OS controls present: ${chrome.buttons} visible buttons, ${chrome.w}px chrome`)
    : fail(`no usable OS controls: ${JSON.stringify(chrome)}`);

  // 2. the bridge: the game must leave its splash and start playing.
  // Before the fix this frame stayed on 'splash_html' forever.
  const wrapper = () => page.frames().find(f => f.url().includes('minigames/battleboids/index.html'));
  let game = null;
  for (let i = 0; i < 60 && !game; i++) {
    game = page.frames().find(f => f.url().includes('thumbwar/battleboids.html'));
    if (!game) await page.waitForTimeout(250);
  }
  if (!game) throw new Error('nested boidwars frame never appeared');
  let state = null;
  for (let i = 0; i < 60; i++) {
    state = await game.evaluate(() => (typeof gameState === 'string' ? gameState : null)).catch(() => null);
    if (state && state !== 'splash_html') break;
    await page.waitForTimeout(400);
  }
  state && state !== 'splash_html'
    ? pass(`bridge up: game left the splash (state "${state}")`)
    : fail(`game stuck on splash — bridge dead (state "${state}")`);

  // 3. window sizes: each mode gives the guest a real box, and the
  // canvas inside follows it
  const canvasBox = () => game.evaluate(() => {
    const c = document.getElementById('gameCanvas');
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), inner: window.innerHeight };
  });
  const viewBox = () => page.evaluate(() => {
    const r = document.getElementById('minigame-view').getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) };
  });

  const sizes = {};
  for (const mode of ['full', 'split', 'pip']) {
    await page.evaluate((m) => FinkWM.setMode(m), mode);
    await page.waitForTimeout(900);
    sizes[mode] = { view: await viewBox(), canvas: await canvasBox() };
  }

  const vh = 860;
  sizes.full.view.h > vh * 0.6 && sizes.full.view.bottom <= vh
    ? pass(`full: ${sizes.full.view.w}×${sizes.full.view.h}, nothing off-screen`)
    : fail(`full mode wrong: ${JSON.stringify(sizes.full.view)}`);
  sizes.split.view.h > 180 && sizes.split.view.h < sizes.full.view.h
    ? pass(`split: game gets ${sizes.split.view.h}px (< full's ${sizes.full.view.h}px)`)
    : fail(`split mode wrong: ${JSON.stringify(sizes.split.view)}`);
  sizes.pip.view.w <= 220 && sizes.pip.view.h <= 160
    ? pass(`pip: ${sizes.pip.view.w}×${sizes.pip.view.h}`)
    : fail(`pip mode wrong: ${JSON.stringify(sizes.pip.view)}`);

  // the canvas must actually shrink — this is what the resize relay buys
  sizes.pip.canvas.h < sizes.full.canvas.h && sizes.pip.canvas.h > 0
    ? pass(`canvas follows the window: ${sizes.full.canvas.h}px full → ${sizes.pip.canvas.h}px pip`)
    : fail(`canvas ignored the resize: full=${sizes.full.canvas.h} pip=${sizes.pip.canvas.h}`);
  // and nothing may render wider than its frame
  const overflow = Object.entries(sizes).filter(([, s]) => s.canvas.w > s.view.w + 2);
  overflow.length === 0
    ? pass('no mode renders content wider than its window')
    : fail(`overflow in ${overflow.map(([m]) => m).join(', ')}`);

  await page.evaluate(() => FinkWM.setMode('full'));
  await page.waitForTimeout(500);

  // 4. pause reaches two frames deep (the game's own loop halts)
  await page.evaluate(() => FinkMinigames.togglePause());
  await page.waitForTimeout(600);
  // boidwarsPaused is a top-level `let`, so it is NOT on window
  const paused = await game.evaluate(() => boidwarsPaused === true).catch(() => null);
  paused === true
    ? pass('pause reaches the nested game loop')
    : fail(`pause did not reach the game: boidwarsPaused=${paused}`);
  await page.evaluate(() => FinkMinigames.togglePause());
  await page.waitForTimeout(400);

  // 5. the debug clock crosses both frame boundaries
  await page.evaluate(() => __finkDebug.slow(50));
  await page.waitForTimeout(600);
  const deep = await game.evaluate(() => window.__mgDebug?.state || null);
  deep?.scale === 0.02
    ? pass('debug clock forwarded two frames deep (scale 0.02)')
    : fail(`slow-mo stopped at the wrapper: ${JSON.stringify(deep)}`);
  await page.evaluate(() => __finkDebug.normal());

  pageErrors.length === 0 ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nBOIDWARS E2E: FAIL' : '\nBOIDWARS E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 400)}`);
  console.log('\nBOIDWARS E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
