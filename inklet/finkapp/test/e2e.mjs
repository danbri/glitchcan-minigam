#!/usr/bin/env node
// finkapp end-to-end: the mandatory journey, automated.
//   TOC loads → Episodes → Hampstead plays → choices advance → no errors
//
//   node inklet/finkapp/test/e2e.mjs
//
// Self-contained: spawns its own static server on an ephemeral port,
// serving the PARENT of the repo so the app's absolute
// /glitchcan-minigam/... paths resolve exactly as on GitHub Pages.
// Chromium path override: PW_CHROME env var.

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');          // .../glitchcan-minigam
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8137;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const shots = join(tmpdir(), 'finkapp-e2e');

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', serveRoot],
  { stdio: 'ignore', detached: false });
await new Promise(r => setTimeout(r, 900));

const fail = (msg) => { console.error('✖', msg); process.exitCode = 1; };
const pass = (msg) => console.log('✔', msg);

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
  const pageErrors = [];
  const missing = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));
  page.on('response', r => { if (r.status() === 404) missing.push(r.url()); });

  // 1. boot: all modules, TOC compiled
  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/`);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 20000 });
  const boot = await page.evaluate(() => ({
    modules: ['FinkPlayer', 'FinkInkEngine', 'FinkSandbox', 'FinkNavigation',
      'FinkMinigames', 'FinkAudio', 'FinkFoley', 'MinigameHost'].filter(m => !window[m]),
    story: !!window.FinkInkEngine.story,
  }));
  boot.modules.length === 0 && boot.story
    ? pass('boot: all modules present, TOC compiled')
    : fail(`boot: missing ${boot.modules.join(',')} story=${boot.story}`);
  await page.screenshot({ path: join(shots, '1-toc.png') }).catch(() => {});
  await page.waitForTimeout(2500);   // listeners attach after first render

  // 2. Episodes menu
  const waitForChoice = (re, timeout = 10000) =>
    page.waitForFunction((src) => {
      const rx = new RegExp(src, 'i');
      return [...document.querySelectorAll('button, .choice')].some(x => rx.test(x.textContent));
    }, re, { timeout }).then(() => true).catch(() => false);
  const dumpChoices = () => page.evaluate(() =>
    [...document.querySelectorAll('button, .choice')]
      .filter(b => b.offsetParent).map(b => b.textContent.trim().slice(0, 30)));
  const clickChoice = async (re, label) => {
    if (!await waitForChoice(re)) {
      fail(`no choice matching /${re}/ (${label}) — visible: [${(await dumpChoices()).join(' | ')}]`);
      return false;
    }
    await page.waitForTimeout(700);   // buttons render before they are wired
    await page.evaluate((src) => {
      const rx = new RegExp(src, 'i');
      [...document.querySelectorAll('button, .choice')].find(x => rx.test(x.textContent))?.click();
    }, re);
    await page.waitForTimeout(400);
    return true;
  };
  await clickChoice('episode', 'TOC menu');
  if (!await waitForChoice('hampstead', 6000)) {   // one retry: the first tap can land pre-wiring
    await clickChoice('episode', 'TOC menu (retry)');
  }
  (await waitForChoice('hampstead'))
    ? pass('episodes: menu lists Hampstead')
    : fail('episodes: Hampstead never appeared');

  // 3. into Hampstead (external FINK load → second compile)
  await clickChoice('hampstead', 'episodes menu');
  // the selected knot offers "enter Hampstead"; some engine paths load
  // the external FINK straight from the tag — accept either route
  const entered = await waitForChoice('enter', 6000);
  if (entered) await clickChoice('enter', 'hampstead selected knot');
  try {
    await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 2, null, { timeout: 12000 });
  } catch {
    if (entered) await clickChoice('enter', 'hampstead selected knot (retry)');
    await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 2, null, { timeout: 15000 });
  }
  pass('hampstead: external FINK loaded and compiled');
  await page.screenshot({ path: join(shots, '2-hampstead.png') }).catch(() => {});

  // 4. play two beats of the story: choices must keep arriving
  for (let i = 0; i < 2; i++) {
    await page.waitForFunction(() =>
      [...document.querySelectorAll('button, .choice')]
        .some(b => b.offsetParent && b.textContent.trim().length > 3), null, { timeout: 10000 })
      .catch(() => {});
    const n = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, .choice')]
        .filter(b => b.offsetParent && b.textContent.trim().length > 3
          && !/^[\u25b6\ud83c-\udbff\udc00-\udfff\u2630\u21ba\u2699\ufe0f\s]+$/u.test(b.textContent.trim()));
      if (btns.length) btns[0].click();
      return btns.length;
    });
    if (!n) { fail(`story beat ${i + 1}: no story choices offered`); break; }
    await page.waitForTimeout(900);
  }
  pass('story: two choice beats played');
  await page.screenshot({ path: join(shots, '3-played.png') }).catch(() => {});

  // 5. hygiene
  pageErrors.length === 0
    ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 3).join(' · ')}`);
  if (missing.length) console.log('  (404s, non-fatal:', missing.slice(0, 4).map(u => u.split('/').pop()).join(', ') + ')');

  console.log(process.exitCode ? '\nFINKAPP E2E: FAIL' : '\nFINKAPP E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 300)}`);
  console.log('\nFINKAPP E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
