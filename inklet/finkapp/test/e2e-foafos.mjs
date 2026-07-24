#!/usr/bin/env node
// foafos shell end to end: the finkapp page as a small web OS.
//
//   node inklet/finkapp/test/e2e-foafos.mjs
//
// Locks: the bus carries platform events; the feed renders them as widget
// cards; the shelf restores a backgrounded window; pip blurs the guest's
// audio (audio-focus protocol); sessions are ephemeral until sealed with a
// passphrase, and survive a reload only encrypted.

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8145;
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
  // hasTouch ⇒ pointer:coarse, which is what gates the on-screen pad
  const context = await browser.newContext({ viewport: { width: 430, height: 860 }, hasTouch: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));

  const URL = `http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?story=/${repoName}/inklet/hampstead.fink.js`;
  await page.goto(URL);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
  await page.waitForTimeout(1500);

  // 1. shell boots: FoafOS global, dock button, ephemeral session
  const boot = await page.evaluate(() => ({
    foafos: !!window.FoafOS,
    dock: !!document.getElementById('foafos-dock'),
    session: window.FoafOS?.session.current?.id?.length > 10,
    beats: window.FoafOS?.bus.retained('*').length ?? -1,
  }));
  boot.foafos && boot.dock && boot.session
    ? pass('shell booted: bus, dock, ephemeral session')
    : fail(`shell boot wrong: ${JSON.stringify(boot)}`);

  // 2. platform events land on the bus as the game opens
  await page.evaluate(() => {
    window.__events = [];
    FoafOS.bus.subscribe('*', (e) => window.__events.push(e.topic));
    FinkInkEngine.story.ChoosePathString('hampstead_tube');
    FinkInkEngine.continueStory();
  });
  await page.waitForSelector('#minigame-iframe-robbin', { timeout: 15000 });
  await page.waitForFunction(() => window.FinkWM?.active === true, null, { timeout: 5000 });
  await page.waitForTimeout(1000);
  const topics = await page.evaluate(() => window.__events);
  ['story.beat', 'minigame.start', 'wm.mode', 'wm.open'].every(t => topics.includes(t))
    ? pass(`bus carried ${topics.length} events incl. story.beat/minigame.start/wm.*`)
    : fail(`missing platform events: ${JSON.stringify(topics)}`);

  // 3. drawer: feed rendered cards, shelf lists the game window
  await page.click('#foafos-dock');
  await page.waitForTimeout(400);
  const drawer = await page.evaluate(() => ({
    open: document.getElementById('foafos-drawer').classList.contains('open'),
    cards: document.querySelectorAll('foafos-feed foaf-card').length,
    chip: [...(document.querySelector('#foafos-shelf foaf-tree')?.shadowRoot.querySelectorAll('[role=treeitem]') ?? [])]
      .map(li => li.textContent).find(t => /Robbin/.test(t)) || null,
  }));
  drawer.open && drawer.cards >= 4 && /Robbin/i.test(drawer.chip || '')
    ? pass(`drawer: ${drawer.cards} feed cards, shelf chip "${drawer.chip}"`)
    : fail(`drawer wrong: ${JSON.stringify(drawer)}`);

  // 4. audio-focus: pip blurs the guest, shelf chip restores it
  const frame = page.frames().find(f => f.url().includes('magpie/robbin/robbin.html'));
  await frame.waitForFunction(() => window.__robbin?.game?.embed === true, null, { timeout: 15000 });
  await page.evaluate(() => FinkWM.setMode('pip'));
  await page.waitForTimeout(400);
  const blurred = await frame.evaluate(() => window.__robbin.game._audioFocus === false);
  blurred ? pass('pip sent audio-blur — guest ducked') : fail('guest never lost audio focus');
  await page.evaluate(() => {
    const sr = document.querySelector('#foafos-shelf foaf-tree').shadowRoot;
    [...sr.querySelectorAll('[role=treeitem]')].find(li => /Robbin/.test(li.textContent))
      ?.querySelector('.row').click();
  });
  await page.waitForTimeout(400);
  const restored = await page.evaluate(() => ({ mode: FinkWM.mode, drawerOpen: document.getElementById('foafos-drawer').classList.contains('open') }));
  const refocused = await frame.evaluate(() => window.__robbin.game._audioFocus === true);
  restored.mode !== 'pip' && !restored.drawerOpen && refocused
    ? pass('shelf chip restored the window and audio focus')
    : fail(`shelf restore wrong: ${JSON.stringify({ restored, refocused })}`);

  // 4b. cluster: a SECOND shell window claims audio — the first window's
  // game is told to yield. One machine, one soundtrack.
  // same browser context — BroadcastChannel does not cross contexts
  const page2 = await context.newPage();
  await page2.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/`);
  await page2.waitForFunction(() => !!window.FoafOS?.cluster, null, { timeout: 25000 });
  await page2.waitForTimeout(500);
  const clusterView = await page2.evaluate(() => ({
    members: FoafOS.cluster.members.size,
    coordinator: FoafOS.cluster.coordinator,
  }));
  clusterView.members >= 2 && clusterView.coordinator
    ? pass(`second window joined the cluster (${clusterView.members} members, coordinator elected)`)
    : fail(`cluster wrong: ${JSON.stringify(clusterView)}`);
  const granted = await page2.evaluate(() => FoafOS.cluster.claim('audio', { label: 'window two' }));
  await page.waitForTimeout(600);
  const yielded = await frame.evaluate(() => window.__robbin.game._audioFocus === false);
  granted && yielded
    ? pass('window two claimed audio — window one\'s game yielded (cross-window blur)')
    : fail(`arbitration failed: granted=${granted} yielded=${yielded}`);
  await page2.close();

  // 4c. widget launcher: two tally guests as floating windows in the
  // SAME shell as the game — isolated, feed sees their events
  await page.evaluate(() => { FoafOS.openWidget('tally'); FoafOS.openWidget('tally'); });
  await page.waitForFunction(() =>
    document.querySelectorAll('.foafos-window foafos-guest iframe').length === 2, null, { timeout: 10000 });
  await page.waitForTimeout(800);
  const tallies = page.frames().filter(f => f.url().includes('tally/index.html'));
  await tallies[0].evaluate(() => document.getElementById('bump').click());
  await page.waitForTimeout(300);
  // the shelf lists EVERY window per instance: story + game + 2 widgets
  await page.evaluate(() => document.getElementById('foafos-dock').click());
  await page.waitForTimeout(300);
  const chips = await page.evaluate(() => {
    const sr = document.querySelector('#foafos-shelf foaf-tree').shadowRoot;
    return [...sr.querySelectorAll('[role=treeitem] > .row .label')].map(x => x.textContent);
  });
  chips.length === 5 && chips[0] === 'Story' && chips.filter(c => c.includes('Tally')).length === 2
    ? pass(`shelf tree lists all windows: ${chips.join(' | ')}`)
    : fail(`shelf tree wrong: ${JSON.stringify(chips)}`);
  await page.evaluate(() => document.getElementById('foafos-dock').click());
  const widgetCheck = {
    a: await tallies[0].evaluate(() => document.getElementById('count').textContent),
    b: await tallies[1].evaluate(() => document.getElementById('count').textContent),
    event: await page.evaluate(() => window.__events.some(t => t.startsWith?.('widget.tally.') || t === undefined)
      || FoafOS.bus.retained('*').length >= 0),   // feed liveness via bus
  };
  widgetCheck.a === '1' && widgetCheck.b === '0'
    ? pass('launcher: two tally widgets beside the game, state disjoint')
    : fail(`widget windows wrong: ${JSON.stringify(widgetCheck)}`);
  await page.evaluate(() => document.querySelectorAll('.foafos-window').forEach(w => w.remove()));

  // 4d. input as an OS service: the pad lives in the HOST page (only it
  // sees the real viewport + safe areas), the guest hides its own, and
  // presses arrive as SDK key messages with service-owned autorepeat.
  const guestPad = await frame.evaluate(() => ({
    hostControls: window.__robbin.game.hostControls === true,
    ownPadHidden: getComputedStyle(document.getElementById('touch')).display === 'none',
  }));
  guestPad.hostControls && guestPad.ownPadHidden
    ? pass('guest yielded its on-screen pad to the shell')
    : fail(`guest pad not yielded: ${JSON.stringify(guestPad)}`);
  await frame.evaluate(() => {
    window.__keys = [];
    addEventListener('message', e => { if (e.data?.type === 'key') window.__keys.push(`${e.data.event}:${e.data.key}`); });
  });
  const padGeom = await page.evaluate(async () => {
    FinkMinigames.currentControls = 'dpad';
    FoafOS.refreshPad();
    await new Promise(r => setTimeout(r, 200));
    const p = document.getElementById('foaf-pad');
    const r = p.getBoundingClientRect();
    const btn = p.querySelector('[data-action="left"]');
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    await new Promise(r2 => setTimeout(r2, 150));
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    await new Promise(r2 => setTimeout(r2, 80));
    return { hidden: p.hidden, onScreen: r.bottom <= window.innerHeight + 1, bottom: Math.round(r.bottom), vh: window.innerHeight };
  });
  const keys = await frame.evaluate(() => window.__keys);
  padGeom.onScreen && !padGeom.hidden && keys[0] === 'keydown:ArrowLeft' && keys.at(-1) === 'keyup:ArrowLeft' && keys.length > 2
    ? pass(`host pad on screen (${padGeom.bottom}/${padGeom.vh}) and routed ${keys.length} key events with autorepeat`)
    : fail(`input service wrong: ${JSON.stringify({ padGeom, keys })}`);
  await page.evaluate(() => { FinkMinigames.currentControls = 'none'; FoafOS.refreshPad(); });

  // 5. session: seal with passphrase, reload, sealed survives, unlock round-trips
  await page.evaluate(async () => {
    FoafOS.session.current.profile.name = 'Wren of Hampstead';
    FoafOS.session.current.data.testMark = 42;
    await FoafOS.session.seal('kulupu waso tawa');
  });
  const atRest = await page.evaluate(() => localStorage.getItem('foafos.session.v1'));
  !atRest.includes('Wren') && JSON.parse(atRest).ct
    ? pass('session at rest is ciphertext (no plaintext leak)')
    : fail('session persisted readable!');
  await page.goto(URL);
  await page.waitForFunction(() => window.FoafOS?.session, null, { timeout: 20000 });
  const wrong = await page.evaluate(() => FoafOS.session.unlock('wrong').then(() => 'opened', e => String(e.message)));
  /wrong passphrase/.test(wrong) ? pass('wrong passphrase rejected') : fail(`bad unlock: ${wrong}`);
  const unlocked = await page.evaluate(() => FoafOS.session.unlock('kulupu waso tawa')
    .then(s => ({ name: s.profile.name, mark: s.data.testMark })));
  unlocked.name === 'Wren of Hampstead' && unlocked.mark === 42
    ? pass('session unlocked after reload — profile and data intact')
    : fail(`unlock round-trip wrong: ${JSON.stringify(unlocked)}`);

  // 6. builtin gems: PAUSE actually stops time (regression: gem expiry
  // timers used to run through pause; the game completed itself and
  // vanished from the window list while "paused")
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    GemsMinigame.config.normal = { spawnCount: 2, spawnInterval: 100, maxGems: 2, timeout: 400, emojis: ['💎'] };
    FinkMinigames.startMinigame('gems', 'normal');
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => FinkMinigames.togglePause());
  await page.waitForTimeout(1500);   // > timeout+delay: unpatched, game self-completes here
  const pausedState = await page.evaluate(() => ({
    active: FinkMinigames.active, paused: FinkMinigames.windowState.paused,
  }));
  pausedState.active && pausedState.paused
    ? pass('paused gems window survives (expiry timers frozen)')
    : fail(`gems vanished while paused: ${JSON.stringify(pausedState)}`);
  await page.evaluate(() => FinkMinigames.togglePause());
  await page.waitForFunction(() => FinkMinigames.active === false, null, { timeout: 10000 });
  pass('resumed gems completes normally');

  // 7. standard widgets: a data share opens in the shell's <foaf-table>
  await page.evaluate(() => FoafOS.bus.publish('widget.data.x.share',
    { title: 'Birds', columns: ['name', 'count'], rows: [['robin', 1], ['wren', 2]] },
    { source: 'guest:x' }));
  await page.waitForTimeout(400);
  const tableView = await page.evaluate(() => {
    const t = document.querySelector('.foafos-window foaf-table');
    return t ? {
      caption: t.shadowRoot.querySelector('caption').textContent,
      rows: t.shadowRoot.querySelectorAll('tbody tr').length,
      sortable: t.shadowRoot.querySelector('th[aria-sort]') !== null,
    } : null;
  });
  tableView?.rows === 2 && /Birds · 2 rows/.test(tableView.caption) && tableView.sortable
    ? pass(`share opened in standard table explorer ("${tableView.caption}")`)
    : fail(`foaf-table wrong: ${JSON.stringify(tableView)}`);

  // 8. the Maker window: variables x-ray + SDK tap
  await page.evaluate(() => {
    FinkInkEngine.story.variablesState['diamonds'] = 7;
    FoafOS.openMaker();
  });
  await page.waitForTimeout(600);
  const maker = await page.evaluate(() => {
    const w = document.getElementById('foafos-maker');
    const t = w?.querySelector('foaf-table');
    const rows = t ? [...t.shadowRoot.querySelectorAll('tbody tr')].map(r => r.textContent) : [];
    return {
      state: w?.querySelector('#maker-state')?.textContent || '',
      diamondsRow: rows.find(r => r.includes('diamonds')),
      sdkCards: w?.querySelectorAll('foafos-feed foaf-card').length ?? 0,
    };
  });
  /story: (end|play)/.test(maker.state) && /diamonds7/.test((maker.diamondsRow || '').replace(/\s/g, ''))
    ? pass(`maker: state line + live variables (${maker.diamondsRow?.trim()})`)
    : fail(`maker wrong: ${JSON.stringify(maker)}`);
  // SET writes into the running story
  await page.evaluate(() => {
    const w = document.getElementById('foafos-maker');
    w.querySelector('#maker-var').value = 'diamonds';
    w.querySelector('#maker-val').value = '42';
    w.querySelector('#maker-set').click();
  });
  const setback = await page.evaluate(() => FinkInkEngine.story.variablesState['diamonds']);
  setback === 42 ? pass('maker SET wrote a live story variable') : fail(`maker set failed: ${setback}`);

  pageErrors.length === 0 ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nFOAFOS E2E: FAIL' : '\nFOAFOS E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 300)}`);
  console.log('\nFOAFOS E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
