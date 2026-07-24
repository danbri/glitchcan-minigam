#!/usr/bin/env node
// FinkWM end to end: the game runner as window manager.
//
//   node inklet/finkapp/test/e2e-wm.mjs
//
// Locks the contracts the old slider panel broke:
//  - SPLIT gives the game a real share of the screen (the old EMBED state
//    collapsed it to a 4px sliver under flex min-height:0)
//  - PIP is never a one-way door (the old MINI state hid the only control
//    that could restore it)
//  - the chrome is compact, collapsible, and dockable to either edge
//  - pause is orthogonal to geometry and reversible in any mode

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8143;
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
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));

  // Boot straight into the widget loop (same path e2e-robbin locks)
  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?story=/${repoName}/inklet/hampstead.fink.js`);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    FinkInkEngine.story.ChoosePathString('hampstead_tube');
    FinkInkEngine.continueStory();
  });
  await page.waitForSelector('#minigame-iframe-robbin', { timeout: 15000 });
  await page.waitForFunction(() => window.FinkWM?.active === true, null, { timeout: 5000 });

  const box = (sel) => page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null;
  }, sel);

  // 1. chrome: visible, compact when collapsed
  const chrome = await box('#wm-chrome');
  const collapsed = await page.evaluate(() => document.getElementById('wm-chrome').classList.contains('collapsed'));
  chrome && collapsed && chrome.w < 90
    ? pass(`chrome present, collapsed to grip (${chrome.w}x${chrome.h})`)
    : fail(`chrome wrong: ${JSON.stringify(chrome)} collapsed=${collapsed}`);

  // 2. grip tap expands the toolbar
  await page.click('#wm-handle');
  const expanded = await page.evaluate(() =>
    !document.getElementById('wm-chrome').classList.contains('collapsed') &&
    getComputedStyle(document.getElementById('wm-buttons')).display !== 'none');
  expanded ? pass('grip tap expands the toolbar') : fail('toolbar did not expand');

  // 3. SPLIT: story and game genuinely share the screen
  await page.click('#wm-split');
  await page.waitForTimeout(500);
  const split = await page.evaluate(() => ({
    mode: FinkWM.mode,
    game: document.getElementById('minigame-view').getBoundingClientRect().height,
    narrative: document.getElementById('narrative-view').classList.contains('active') &&
      document.getElementById('narrative-view').getBoundingClientRect().height,
  }));
  split.mode === 'split' && split.game > 250 && split.narrative > 150
    ? pass(`split: game ${Math.round(split.game)}px + story ${Math.round(split.narrative)}px (no sliver)`)
    : fail(`split broken: ${JSON.stringify(split)}`);

  // 4. PIP: small, then a tap restores — no one-way doors
  await page.click('#wm-pip');
  await page.waitForTimeout(500);
  const pip = await box('#minigame-view');
  pip.w <= 220 && pip.h <= 160
    ? pass(`pip: ${pip.w}x${pip.h} in the corner`)
    : fail(`pip wrong size: ${JSON.stringify(pip)}`);
  await page.mouse.click(pip.x + pip.w / 2, pip.y + pip.h / 2);
  await page.waitForTimeout(500);
  const restored = await page.evaluate(() => ({
    mode: FinkWM.mode,
    h: document.getElementById('minigame-view').getBoundingClientRect().height,
  }));
  restored.mode === 'split' && restored.h > 250
    ? pass('pip tap restores to previous mode')
    : fail(`pip is a roach motel again: ${JSON.stringify(restored)}`);

  // 5. pause: orthogonal, reversible (expand explicitly — grip taps toggle)
  await page.evaluate(() => FinkWM._setCollapsed(false));
  await page.click('#minigame-pause');
  const paused = await page.evaluate(() => FinkMinigames.windowState.paused &&
    document.getElementById('minigame-view').classList.contains('paused'));
  paused ? pass('pause engages (frost + SDK message)') : fail('pause did not engage');
  await page.click('#minigame-pause');
  const resumed = await page.evaluate(() => !FinkMinigames.windowState.paused);
  resumed ? pass('pause releases') : fail('pause stuck');

  // 6. chrome drag-docks to the left edge and persists
  await page.evaluate(() => FinkWM._setCollapsed(true));
  const grip = await box('#wm-handle');
  await page.mouse.move(grip.x + grip.w / 2, grip.y + grip.h / 2);
  await page.mouse.down();
  await page.mouse.move(60, 300, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const docked = await page.evaluate(() => ({
    left: document.getElementById('wm-chrome').getBoundingClientRect().left,
    stored: JSON.parse(localStorage.getItem('fink.wm.dock') || 'null'),
  }));
  docked.left < 50 && docked.stored?.side === 'left'
    ? pass(`chrome drag-docked left (persisted top=${docked.stored.top})`)
    : fail(`dock failed: ${JSON.stringify(docked)}`);

  // 7. exit is a VERB, not a kill switch: robbin declared 'quit', so ✕
  // delegates to the game's own paper dialog; confirming there completes
  // through the normal SDK path and the shell closes the window.
  await page.evaluate(() => { FinkWM.setMode('full'); FinkWM._setCollapsed(false); });
  await page.waitForTimeout(300);
  const gameFrame = page.frames().find(f => f.url().includes('magpie/robbin/robbin.html'));
  await gameFrame.waitForFunction(() => window.__robbin?.game?.state === 'tube', null, { timeout: 15000 });
  await page.click('#returnToStory');
  await page.waitForTimeout(500);
  const delegated = await page.evaluate(() => !!document.querySelector('#minigame-iframe-robbin'))
    && await gameFrame.evaluate(() => window.__robbin.game.tube.quitConfirm === true);
  delegated
    ? pass('✕ delegated: game window survives, native quit dialog is up')
    : fail('✕ hard-killed a guest that owns its quit flow');
  await gameFrame.evaluate(() => {
    const t = window.__robbin.game.tube;
    const r = t.quitDialogRects();
    t.quitTap(r.quit.x + r.quit.w / 2, r.quit.y + r.quit.h / 2);
  });
  await page.waitForTimeout(800);
  const closed = await page.evaluate(() => ({
    wmActive: FinkWM.active,
    chromeHidden: document.getElementById('wm-chrome').classList.contains('wm-hidden'),
    narrative: document.getElementById('narrative-view').classList.contains('active'),
    gameGone: !document.getElementById('minigame-view').classList.contains('active'),
  }));
  !closed.wmActive && closed.chromeHidden && closed.narrative && closed.gameGone
    ? pass('exit: window closed, chrome hidden, story restored')
    : fail(`exit incomplete: ${JSON.stringify(closed)}`);

  pageErrors.length === 0 ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nFINKWM E2E: FAIL' : '\nFINKWM E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 300)}`);
  console.log('\nFINKWM E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
