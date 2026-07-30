#!/usr/bin/env node
// Office, game and TV in ONE installation.
//
//   node inklet/finkapp/test/e2e-desktop.mjs [--shots]
//
// "Should we put office and game and tv in the same installation as a
// test?" — yes, and this is it. The claim under test is not that three
// apps can each load; it is that the shell hosts them WITHOUT KNOWING
// WHICH IS WHICH: one launcher, one running-list, one volume, one
// switcher. If the spreadsheet needs a special case, it is not an OS.
//
// Also locks the honest part of the audio service: the shell CANNOT turn
// down a guest that never answered the audio probe, and the control has
// to say so instead of showing a slider that lies.

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SHOTS = process.argv.includes('--shots');
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8167;
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
  const page = await browser.newPage({ viewport: { width: 900, height: 900 }, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 160)));

  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?player=legacy&story=/${repoName}/inklet/hampstead.fink.js`);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
  await page.waitForTimeout(1200);

  // ---- 1. one launcher lists all three families ------------------------
  await page.evaluate(() => FoafOS.openHome());
  await page.waitForSelector('#foafos-home', { timeout: 5000 });
  const grid = await page.evaluate(() => {
    const fams = [...document.querySelectorAll('#foafos-home section h3')].map(h => h.textContent.trim());
    return { families: fams, apps: document.querySelectorAll('.foafos-app').length };
  });
  const wanted = ['Office', 'Play', 'Media'];
  wanted.every(w => grid.families.some(f => f.includes(w))) && grid.apps >= 10
    ? pass(`one grid, ${grid.apps} apps: ${grid.families.join(' / ')}`)
    : fail(`launcher missing families: ${JSON.stringify(grid)}`);
  if (SHOTS) await page.screenshot({ path: '/tmp/desktop-1-home.png' });
  await page.evaluate(() => document.getElementById('foafos-home')?.remove());

  // ---- 2. launch one of each, the same way -----------------------------
  await page.evaluate(() => { FoafOS.launchApp('sheets'); FoafOS.launchApp('channels'); });
  await page.waitForTimeout(500);
  await page.evaluate(() => FoafOS.launchApp('robbin'));   // a game goes to the WM
  await page.waitForTimeout(4000);

  const alive = await page.evaluate(() => ({
    windows: [...document.querySelectorAll('.foafos-window')]
      .map(w => w.querySelector('.foafos-window-bar span')?.textContent),
    game: window.FinkMinigames?.currentType || null,
    frames: [...document.querySelectorAll('.foafos-window iframe')].map(f => f.getAttribute('src')),
  }));
  alive.windows.length === 2 && alive.game === 'robbin'
    ? pass(`three running at once: ${alive.windows.join(', ')} + game "${alive.game}"`)
    : fail(`not all three up: ${JSON.stringify(alive)}`);

  const officeUp = page.frames().some(f => f.url().includes('/edot/data/'));
  const tvUp = page.frames().some(f => f.url().includes('/apps/tv/'));
  officeUp && tvUp
    ? pass('the spreadsheet and the channel player are real, loaded documents')
    : fail(`frames missing: office=${officeUp} tv=${tvUp}`);

  // the TV app must have found its channels — a baked list that has
  // drifted from the library is the obvious way this rots
  const tv = page.frames().find(f => f.url().includes('/apps/tv/'));
  const chans = tv ? await tv.evaluate(() => document.querySelectorAll('#channels li').length).catch(() => 0) : 0;
  chans >= 20 ? pass(`TV tuned in: ${chans} channels off the tape library`)
              : fail(`channel list looks wrong: ${chans}`);
  if (SHOTS) await page.screenshot({ path: '/tmp/desktop-2-running.png' });

  // ---- 3. ONE switcher sees all of them --------------------------------
  await page.evaluate(() => FoafOS.openSwitcher());
  await page.waitForSelector('#foafos-switcher', { timeout: 5000 });
  // Assert on app IDs, and take the expected LABELS from the registry rather
  // than writing them here. This used to match `/data|channels/i` against the
  // card text, so renaming Channels to "Glitchcan Original Soundtrack" broke
  // a test that has nothing to do with names — a display string is not an
  // identity, and a suite that treats it as one fails on every rename.
  const view = await page.evaluate(async () => {
    const { appById } = await import('./foafos-apps.js');
    return {
      cards: [...document.querySelectorAll('.foafos-switch-card .ttl')].map(t => t.textContent),
      running: [...window.FoafOS.apps.nodes.values()].map(n => n.appId),
      expect: ['sheets', 'channels'].map(id => appById(id)?.name),
    };
  });
  const hasStory = view.cards.some(c => /story/i.test(c));
  const hasGame = view.cards.some(c => /robbin/i.test(c));
  const idsUp = ['sheets', 'channels'].every(id => view.running.includes(id));
  const labelsShown = view.expect.every(n => n && view.cards.includes(n));
  hasStory && hasGame && idsUp && labelsShown
    ? pass(`switcher lists every family: ${view.cards.join(' · ')}`)
    : fail(`switcher incomplete: ${JSON.stringify(view)}`);
  if (SHOTS) await page.screenshot({ path: '/tmp/desktop-3-switcher.png' });
  await page.evaluate(() => document.getElementById('foafos-switcher')?.remove());

  // ---- 4. ONE volume, and an honest account of its reach ---------------
  const before = await page.evaluate(() => ({
    level: FoafOS.audio.level, coverage: FoafOS.audio.coverage(),
  }));
  before.coverage.total >= 3
    ? pass(`volume governs ${before.coverage.governed}/${before.coverage.total} sources`)
    : fail(`audio sinks not registered: ${JSON.stringify(before)}`);

  await page.evaluate(() => FoafOS.audio.setVolume(0.5));
  const half = await page.evaluate(() => ({
    finkAudio: window.FinkAudio?.masterLevel,
    foley: window.FinkFoley?.masterLevel,
    label: document.getElementById('foafos-vol-out')?.textContent,
  }));
  half.finkAudio === 0.5 && half.foley === 0.5 && half.label === '50%'
    ? pass('one slider moves the story music, the foley and the UI together')
    : fail(`volume did not reach same-document sources: ${JSON.stringify(half)}`);

  // the TV app is a guest; it can only be turned down because it ANSWERED
  const tvVol = tv ? await tv.evaluate(() => window.__tvLevel ?? null).catch(() => null) : null;
  const muted = await page.evaluate(() => { FoafOS.audio.setMuted(true); return FoafOS.audio.level; });
  await page.waitForTimeout(400);
  const tvMuted = tv ? await tv.evaluate(() => {
    const a = document.querySelector('audio');
    return { level: window.__tvLevel ?? null, elementVolume: a ? a.volume : null };
  }).catch(() => null) : null;
  muted === 0 && tvMuted && tvMuted.level === 0
    ? pass('mute reaches a guest that answered the audio probe')
    : fail(`guest not muted: ${JSON.stringify(tvMuted)} (was ${tvVol})`);

  // ...and says plainly what it cannot reach
  const note = await page.evaluate(() => ({
    text: document.getElementById('foafos-audio-note')?.textContent || '',
    uncovered: FoafOS.audio.coverage().uncovered,
  }));
  note.uncovered.length
    ? (/cannot turn it down/.test(note.text)
        ? pass(`admits what it cannot reach: ${note.uncovered.join(', ')}`)
        : fail(`ungoverned sources not disclosed: "${note.text}"`))
    : pass('every running source is under control (nothing to disclose)');

  await page.evaluate(() => FoafOS.audio.setMuted(false));

  // ---- 5. isolation still holds with an office app in the room ---------
  const isolation = await page.evaluate(() => ({
    instances: [...FinkMinigames.instances.values()].map(i => i.id),
    denied: FoafOS.vars.log.filter(e => !e.ok).length,
  }));
  isolation.instances.length === 1
    ? pass('the office windows are not minigame instances — no confusion of kinds')
    : fail(`instance registry polluted: ${JSON.stringify(isolation)}`);

  errs.length === 0 ? pass('no page errors across three families')
    : fail(`page errors: ${errs.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nDESKTOP E2E: FAIL' : '\nDESKTOP E2E: PASS');
  if (SHOTS) console.log('shots: /tmp/desktop-*.png');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 400)}`);
  console.log('\nDESKTOP E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
