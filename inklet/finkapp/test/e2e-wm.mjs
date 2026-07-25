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

  // 1. chrome: opens EXPANDED so the controls are discoverable (a lone
  // grip was reported in the field as "this game has no OS controls")
  const chromeOpen = await box('#wm-chrome');
  const openExpanded = await page.evaluate(() =>
    !document.getElementById('wm-chrome').classList.contains('collapsed'));
  openExpanded && chromeOpen.w > 200
    ? pass(`chrome opens expanded (${chromeOpen.w}px, all controls visible)`)
    : fail(`chrome not discoverable on open: w=${chromeOpen?.w} expanded=${openExpanded}`);
  await page.evaluate(() => FinkWM._setCollapsed(true));
  const chrome = await box('#wm-chrome');
  chrome.w < 90 ? pass(`collapses to a grip (${chrome.w}px)`) : fail(`grip too wide: ${chrome.w}`);

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
  // and the two panes must TILE: no clipped game bottom, no story text
  // hidden behind it (padding-bottom:50vh made this fail invisibly)
  const tile = await page.evaluate(() => {
    const n = document.getElementById('narrative-view').getBoundingClientRect();
    const g = document.getElementById('minigame-view').getBoundingClientRect();
    return { gap: Math.round(g.top - n.bottom), overshoot: Math.round(g.bottom - window.innerHeight) };
  });
  Math.abs(tile.gap) <= 1 && tile.overshoot <= 0
    ? pass('split panes tile exactly (no overlap, nothing clipped)')
    : fail(`split does not tile: gap=${tile.gap} overshoot=${tile.overshoot}`);

  // 3b. WHOSE CONTROLS ARE THESE? In split there are two panes and a
  // floating toolbar claims neither. Reported from the field: "when
  // splitscreen it can be v confusing which part of screen the window
  // manager controls". Both panes must be named, the names must meet at
  // the seam (clear of the draggable toolbar at the screen top), the
  // toolbar must name its target, and touching it must mark the pane.
  const own = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.wm-pane-label')].map(e => {
      const r = e.getBoundingClientRect();
      return { text: e.textContent.trim(), y: Math.round(r.y), bottom: Math.round(r.bottom),
               shown: getComputedStyle(e).display !== 'none' };
    });
    const chrome = document.getElementById('wm-chrome');
    return {
      labels,
      seam: Math.round(document.getElementById('minigame-view').getBoundingClientRect().top),
      chromeBottom: Math.round(chrome.getBoundingClientRect().bottom),
      chip: document.getElementById('wm-target')?.textContent?.trim(),
      chipShown: getComputedStyle(document.getElementById('wm-target')).display !== 'none',
      aria: chrome.getAttribute('aria-label'),
    };
  });
  const story = own.labels.find(l => /story/i.test(l.text));
  const gameLbl = own.labels.find(l => !/story/i.test(l.text));
  story?.shown && gameLbl?.shown
    ? pass(`both panes named: "${story.text}" / "${gameLbl.text}"`)
    : fail(`panes not both labelled: ${JSON.stringify(own.labels)}`);
  Math.abs(story.bottom - own.seam) <= 3 && Math.abs(gameLbl.y - own.seam) <= 3
    ? pass(`names meet at the seam (${own.seam}px)`)
    : fail(`labels not at the seam ${own.seam}: story ends ${story.bottom}, game starts ${gameLbl.y}`);
  story.y > own.chromeBottom
    ? pass('story label clears the toolbar (it used to sit underneath it)')
    : fail(`story label under the chrome: label ${story.y} vs chrome bottom ${own.chromeBottom}`);
  own.chipShown && own.chip && /pane/i.test(own.aria || '')
    ? pass(`toolbar names its target: chip "${own.chip}", label "${own.aria}"`)
    : fail(`toolbar does not say what it controls: ${JSON.stringify(own)}`);

  // Focus, not hover: a keyboard user needs the cue as much as a mouse
  // user, and `page.hover` is at the mercy of whatever floats above the
  // toolbar. Both paths run through the same listener.
  await page.focus('#wm-handle');
  await page.waitForTimeout(250);
  const governedByFocus = await page.evaluate(() =>
    document.getElementById('minigame-view').classList.contains('wm-governed'));
  governedByFocus ? pass('focusing the toolbar accents the pane it governs')
                  : fail('no cue linking the toolbar to its pane (focus)');
  // and the touch path: a tap never hovers, so it flashes instead
  await page.evaluate(() => {
    document.getElementById('minigame-view').classList.remove('wm-governed');
    document.getElementById('wm-chrome').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  const governedByTap = await page.evaluate(() =>
    document.getElementById('minigame-view').classList.contains('wm-governed'));
  governedByTap ? pass('a tap flashes the same cue (touch never hovers)')
                : fail('tap did not mark the governed pane');

  // ...and the names get OUT OF THE WAY. A permanent strip sits on the
  // guest's own readout — robbin's FLOCK/SCORE was covered by the first
  // version of this — so they behave like a TV naming its input.
  await page.evaluate(() => {
    FinkWM._flashLabels(150);
    document.getElementById('minigame-view').classList.remove('wm-governed');
  });
  await page.waitForTimeout(700);
  const faded = await page.evaluate(() =>
    [...document.querySelectorAll('.wm-pane-label')].every(l => getComputedStyle(l).display === 'none'));
  faded ? pass('pane names stand down after naming, leaving the guest its screen')
        : fail('pane names persist over the guest HUD');
  await page.evaluate(() => FinkWM._flashLabels());

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

  // 7. FLIP STORM. Reported from the field: "display gets all messed up or
  // mostly black after flipping a few times". Every mode change rewrites
  // the panes' heights and the guest reallocates its canvas backing store,
  // so a burst of flips is a burst of reallocations. Click the REAL buttons
  // faster than the 350ms transition, then assert on measured pixels:
  //   · the panes tile the viewport with no gap and no overlap
  //   · the guest fits INSIDE its own frame (scrollHeight === innerHeight);
  //     a guest 4px too tall is 4px of clipped game board
  //   · the canvas backing store matches its CSS box — a stale backing
  //     store is exactly what "messed up or mostly black" looks like
  await page.evaluate(() => { FinkWM.setMode('full'); FinkWM._setCollapsed(false); });
  await page.waitForTimeout(400);
  for (const id of ['wm-split', 'wm-full', 'wm-pip', 'wm-split', 'wm-full',
                    'wm-pip', 'wm-split', 'wm-full', 'wm-split']) {
    await page.evaluate(() => FinkWM._setCollapsed(false));
    await page.click(`#${id}`, { force: true }).catch(() => {});
    await page.waitForTimeout(90);              // inside the transition
  }
  await page.waitForTimeout(1200);               // past the settle debounce
  const storm = await page.evaluate(() => {
    const v = document.getElementById('minigame-view').getBoundingClientRect();
    const n = document.getElementById('narrative-view').getBoundingClientRect();
    return { mode: FinkWM.mode, vh: window.innerHeight,
      gameTop: Math.round(v.y), gameH: Math.round(v.height),
      narrTop: Math.round(n.y), narrBottom: Math.round(n.bottom) };
  });
  const stormFrame = page.frames().find(f => f.url().includes('magpie/robbin/robbin.html'));
  const guest = await stormFrame.evaluate(() => {
    const c = document.getElementById('game');
    const r = c.getBoundingClientRect();
    return { ih: window.innerHeight, sh: document.body.scrollHeight,
      cw: c.width, ch: c.height,
      boxW: Math.round(r.width), boxH: Math.round(r.height) };
  });
  const tiles = storm.mode === 'split' && storm.gameH > 100 &&
    Math.abs(storm.gameTop + storm.gameH - storm.vh) <= 2 &&
    storm.narrBottom <= storm.gameTop + 2;
  tiles ? pass(`10 fast flips: panes still tile (story→${storm.narrBottom}, game ${storm.gameTop}+${storm.gameH}=${storm.vh})`)
        : fail(`flip storm broke the tiling: ${JSON.stringify(storm)}`);
  guest.sh === guest.ih
    ? pass(`guest fits its frame after the storm (${guest.sh}px in ${guest.ih}px)`)
    : fail(`guest overflows its own frame by ${guest.sh - guest.ih}px — that is clipped game`);
  Math.abs(guest.cw - guest.boxW) <= 2 && Math.abs(guest.ch - guest.boxH) <= 2
    ? pass(`canvas backing store tracked the resize (${guest.cw}×${guest.ch})`)
    : fail(`stale backing store: canvas ${guest.cw}×${guest.ch} in a ${guest.boxW}×${guest.boxH} box`);

  // 8. exit is a VERB, not a kill switch: robbin declared 'quit', so ✕
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

  await page.evaluate(() => FinkWM.setMode('full'));
  await page.waitForTimeout(300);
  const fullHidden = await page.evaluate(() => ({
    labels: [...document.querySelectorAll('.wm-pane-label')]
      .every(l => getComputedStyle(l).display === 'none'),
    aria: document.getElementById('wm-chrome').getAttribute('aria-label'),
  }));
  fullHidden.labels && !/pane/i.test(fullHidden.aria)
    ? pass('one pane needs no telling apart — labels and chip stand down')
    : fail(`labels persist in full mode: ${JSON.stringify(fullHidden)}`);

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
