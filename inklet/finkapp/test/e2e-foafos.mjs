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
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
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
    chip: document.querySelector('.foafos-chip')?.textContent || null,
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
  await page.click('.foafos-chip');
  await page.waitForTimeout(400);
  const restored = await page.evaluate(() => ({ mode: FinkWM.mode, drawerOpen: document.getElementById('foafos-drawer').classList.contains('open') }));
  const refocused = await frame.evaluate(() => window.__robbin.game._audioFocus === true);
  restored.mode !== 'pip' && !restored.drawerOpen && refocused
    ? pass('shelf chip restored the window and audio focus')
    : fail(`shelf restore wrong: ${JSON.stringify({ restored, refocused })}`);

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
