#!/usr/bin/env node
// The widget loop, end to end: Hampstead street → descend into the tube
// → # MINIGAME: robbin boots the real game in a sandboxed iframe at
// HAMPSTEAD → completion writes robbin_birds back into Ink → the story
// resumes on tube_return.
//
//   node inklet/finkapp/test/e2e-robbin.mjs
//
// Serves with CORS (sandboxed iframes have opaque origins; the game's
// ES modules won't load locally without it — GitHub Pages sends
// Access-Control-Allow-Origin: * in production).

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8139;
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

  // 1. load Hampstead directly as the first story
  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?story=/${repoName}/inklet/hampstead.fink.js`);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
  await page.waitForTimeout(2000);
  pass('hampstead compiled as first story');

  // 2. jump the story to the tube knot — the MINIGAME tag must fire
  await page.evaluate(() => {
    FinkInkEngine.story.ChoosePathString('hampstead_tube');
    FinkInkEngine.continueStory();
  });
  await page.waitForSelector('#minigame-iframe-robbin', { timeout: 15000 });
  pass('# MINIGAME: robbin raised the iframe');

  // 3. the real game boots inside, at HAMPSTEAD, in embed mode
  await page.waitForFunction(() => {
    const f = document.querySelector('#minigame-iframe-robbin');
    return !!f;
  }, null, { timeout: 5000 });
  let frame = null;
  await page.waitForFunction(() => true, null, { timeout: 100 }).catch(() => {});
  for (let i = 0; i < 60 && !frame; i++) {
    frame = page.frames().find(f => f.url().includes('magpie/robbin/robbin.html'));
    if (!frame) await page.waitForTimeout(500);
  }
  if (!frame) throw new Error('robbin frame never appeared (redirect failed?)');
  await frame.waitForFunction(() =>
    window.__robbin?.game?.state === 'tube' && window.__robbin.game.embed === true, null, { timeout: 20000 });
  const inGame = await frame.evaluate(() => ({
    cur: window.__robbin.game.tube.cur,
    started: window.__robbin.game._embedStarted,
  }));
  inGame.cur === 'HAMPSTEAD' && inGame.started
    ? pass(`game booted in embed mode at ${inGame.cur}`)
    : fail(`embed boot wrong: ${JSON.stringify(inGame)}`);

  // 4. play: fake three rescues, then quit through the game's own flow
  await frame.evaluate(() => {
    const g = window.__robbin.game;
    for (const name of ['TITCH', 'PECK', 'MOSS'])
      g.tube.roster.push({ sp: 'wren', name });
    g.tube.score = 1200;
    g.embedComplete(true);
  });
  await page.waitForFunction(() =>
    (FinkInkEngine?.story?.variablesState?.['robbin_birds'] ?? 0) === 3, null, { timeout: 10000 });
  pass('complete wrote robbin_birds=3 into Ink');

  // 5. the story resumed on tube_return; taking the exit choice reacts
  // to the flock (the reaction lives BEHIND a choice so Ink evaluates
  // it after completion — tag/lookahead semantics, see INK-GOTCHAS)
  await page.waitForFunction(() =>
    document.body.textContent.includes('hauls you back'), null, { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    [...document.querySelectorAll('button, .choice')]
      .find(b => /out into the rain/i.test(b.textContent))?.click();
  });
  await page.waitForFunction(() =>
    document.body.textContent.includes('surface blinking'), null, { timeout: 10000 });
  pass('story resumed: the flock is acknowledged after the exit choice');

  pageErrors.length === 0 ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nROBBIN WIDGET E2E: FAIL' : '\nROBBIN WIDGET E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 300)}`);
  console.log('\nROBBIN WIDGET E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
