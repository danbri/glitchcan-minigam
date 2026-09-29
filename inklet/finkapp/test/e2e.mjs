#!/usr/bin/env node
// finkapp end-to-end: the mandatory journey, automated, through the runner.
//   TOC loads → Episodes → Hampstead plays through to its end →
//   choice labels visible → no errors
//
//   node inklet/finkapp/test/e2e.mjs
//
// Stories play only in the boxed story runner (inklet/apps/storyrunner), in
// a sandboxed frame. This suite drives that frame by tapping its real choice
// buttons, and checks that the host-page engine is really gone from the shell.
//
// Self-contained: spawns its own static server (with CORS, which the runner's
// opaque-origin frame needs locally; GitHub Pages sends ACAO:* itself) on a
// fixed port, serving the PARENT of the repo so the app's absolute
// /glitchcan-minigam/... paths resolve exactly as on GitHub Pages.
// Chromium path override: PW_CHROME env var.

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { runnerFrame } from './lib/story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');          // .../glitchcan-minigam
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8137;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const shots = join(tmpdir(), 'finkapp-e2e');
try { mkdirSync(shots, { recursive: true }); } catch { /* screenshots are optional */ }

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

const fail = (msg) => { console.error('✖', msg); process.exitCode = 1; };
const pass = (msg) => console.log('✔', msg);

// The route to Hampstead's victory screen: every score point the story offers
// on the straight road (score >= 8 at the housewarming), then the ending.
// Each entry is the start of a choice LABEL, as the reader sees it.
const HAMPSTEAD_ROUTE = [
  'Continue', 'Boot the Speccy',
  'Open wardrobe', 'Wear the tie', 'Close wardrobe', 'Leave for Main Street',
  'East to Job Centre', 'Collect your GIRO cheque', 'Cash the giro',
  'West to Oxfam', 'Browse jacket rail', 'Dig in bargain bin', 'Return to street',
  'South to Duke Pub', 'Buy a round', 'Return to street',
  'North to Gallery District', 'Bluff modern-art theory',
  'Visit Sir Lionel', 'Present playwright', 'Proceed to estate agent', 'Sign the mortgage',
  'Rest in your achievement',
];

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
  const pageErrors = [];
  const consoleErrors = [];
  const missing = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // A 404 is reported below as non-fatal, the same as before.
    if (/Failed to load resource/.test(t)) return;
    consoleErrors.push(`${m.location()?.url?.split('/').pop() || '?'}: ${t.slice(0, 160)}`);
  });
  page.on('response', r => { if (r.status() === 404) missing.push(r.url()); });

  // 1. boot: a plain visit opens the runner on the table of contents
  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/`);
  const r = await runnerFrame(page);
  await r.waitForFunction(() => window.__storyrunner?.ready?.()
    && window.__storyrunner.state.choices.length > 0, null, { timeout: 60000 });
  const toc = await r.evaluate(() => ({
    url: window.__storyrunner.state.storyUrl,
    choices: window.__storyrunner.state.choices,
    boxed: window.__storyrunner.state.boxedCompile,
  }));
  /\/inklet\/toc\.fink\.js$/.test(toc.url || '') && toc.boxed
    ? pass(`boot: the runner compiled the TOC in its box (${toc.choices.length} choices)`)
    : fail(`boot: the runner is not on the TOC: ${JSON.stringify(toc)}`);

  // the shell page: the removed host engine is ABSENT, the kept modules present
  const mods = await page.evaluate(() => ({
    gone: ['FinkInkEngine', 'FinkUI', 'FinkPlayer', 'FinkNavigation', 'FinkSandbox', 'inkjs']
      .filter(m => m in window),
    kept: ['FinkMinigames', 'FinkAudio', 'FinkFoley', 'FinkWM', 'FinkLinks', 'FinkBreadcrumb', 'FoafOS']
      .filter(m => !window[m]),
  }));
  mods.gone.length === 0
    ? pass('shell: no host story engine (FinkInkEngine, FinkUI, FinkPlayer, FinkNavigation, FinkSandbox, inkjs all absent)')
    : fail(`shell: removed modules still present: ${mods.gone.join(', ')}`);
  mods.kept.length === 0
    ? pass('shell: kept modules present (FinkMinigames, FinkAudio, FinkFoley, FinkWM, FinkLinks, FinkBreadcrumb, FoafOS)')
    : fail(`shell: kept modules missing: ${mods.kept.join(', ')}`);

  // the story is a session node under the runner's window node
  const tree = await page.evaluate(() => {
    const nodes = [...FoafOS.apps.nodes.values()];
    const runner = nodes.find(n => n.appId === 'storyrunner');
    const session = nodes.find(n => n.appId === 'story-session');
    return { runner: !!runner, session: !!session, under: !!(runner && session && session.parentId === runner.id),
             label: session?.label || null };
  });
  tree.under
    ? pass(`tree: the TOC is a story-session under the runner ("${tree.label}")`)
    : fail(`tree: no story-session under the runner: ${JSON.stringify(tree)}`);
  await page.screenshot({ path: join(shots, '1-toc.png') }).catch(() => {});

  // Tap a real choice button in the runner frame, by the start of its label.
  // The button must be on screen with its label showing: a reader cannot tap
  // what they cannot see, and a label-less button is the old defect this
  // journey exists to catch.
  const tap = async (label) => {
    const want = label.toLowerCase();
    try {
      await r.waitForFunction((w) => window.__storyrunner?.state.choices
        .some(c => c.trim().toLowerCase().startsWith(w)), want, { timeout: 20000 });
    } catch {
      const seen = await r.evaluate(() => window.__storyrunner.state.choices).catch(() => []);
      fail(`no choice "${label}" — offered: [${seen.join(' | ')}]`);
      return false;
    }
    const btn = r.locator('#choices button').filter({ hasText: new RegExp('^\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    const box = await btn.boundingBox();
    const text = (await btn.textContent() || '').trim();
    if (!box || box.width < 1 || box.height < 1 || !text) {
      fail(`choice "${label}" is not visibly labelled (box=${JSON.stringify(box)}, text="${text}")`);
      return false;
    }
    await btn.click();
    return true;
  };
  // Every choice on offer carries a label (not only the one we tap).
  const labelsVisible = () => r.evaluate(() => {
    const btns = [...document.querySelectorAll('#choices button')];
    return btns.length > 0 && btns.every(b => b.textContent.trim().length > 0
      && b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().height > 0);
  });

  // 2. Episodes menu
  (await labelsVisible())
    ? pass('toc: every choice is a visible, labelled button')
    : fail('toc: a choice button has no visible label');
  await tap('Episodes');
  await r.waitForFunction(() => window.__storyrunner.state.choices.some(c => /hampstead/i.test(c)),
    null, { timeout: 15000 })
    .then(() => pass('episodes: menu lists Hampstead'))
    .catch(() => fail('episodes: Hampstead never appeared'));

  // 3. into Hampstead: the runner loads the external FINK and compiles it
  await tap('Hampstead');
  // The knot's `# FINK:` tag names the episode. The runner follows it as soon
  // as the knot is reached; an engine that stops on the knot instead offers
  // "enter Hampstead". Accept either route, as the old journey did.
  const route = await r.waitForFunction(() => {
    const s = window.__storyrunner.state;
    if (/\/inklet\/hampstead\.fink\.js$/.test(s.storyUrl || '')) return 'loaded';
    if (s.choices.some(c => /^enter hampstead/i.test(c.trim()))) return 'enter';
    return false;
  }, null, { timeout: 30000 }).then(h => h.jsonValue()).catch(() => null);
  if (route === 'enter') await tap('enter Hampstead');
  try {
    await r.waitForFunction(() => /\/inklet\/hampstead\.fink\.js$/.test(window.__storyrunner.state.storyUrl || '')
      && window.__storyrunner.ready() && window.__storyrunner.state.choices.length > 0, null, { timeout: 30000 });
    pass('hampstead: external FINK loaded and compiled in the runner');
  } catch {
    const s = await r.evaluate(() => ({ url: window.__storyrunner.state.storyUrl, choices: window.__storyrunner.state.choices }));
    throw new Error(`Hampstead never loaded: ${JSON.stringify(s)}`);
  }
  await page.screenshot({ path: join(shots, '2-hampstead.png') }).catch(() => {});

  // 4. play Hampstead through to its end, by tapping, checking labels at every beat
  let beats = 0, unlabelled = 0;
  for (const step of HAMPSTEAD_ROUTE) {
    if (!(await labelsVisible())) unlabelled++;
    if (!(await tap(step))) break;
    beats++;
    if (step === 'Sign the mortgage') {
      // the housewarming, with score >= 8, must reach the victory screen
      await r.waitForFunction(() => window.__storyrunner.state.prose.some(p => /HAMPSTEAD ACHIEVED/.test(String(p.text ?? p))),
        null, { timeout: 15000 })
        .then(() => pass('hampstead: the victory screen rendered (*** HAMPSTEAD ACHIEVED ***)'))
        .catch(async () => fail(`hampstead: no victory text; prose: ${JSON.stringify((await r.evaluate(() => window.__storyrunner.state.prose)).slice(-4))}`));
    }
  }
  beats === HAMPSTEAD_ROUTE.length && unlabelled === 0
    ? pass(`story: ${beats} choice beats played by tapping, every choice labelled`)
    : fail(`story: ${beats}/${HAMPSTEAD_ROUTE.length} beats played, ${unlabelled} beat(s) with an unlabelled choice`);
  const end = await r.waitForFunction(() => window.__storyrunner.state.ended, null, { timeout: 15000 })
    .then(() => true).catch(() => false);
  const score = await r.evaluate(() => window.__storyrunner.varOf('score'));
  end
    ? pass(`hampstead: played to its END (score ${score}/8)`)
    : fail(`hampstead: did not reach its end (score ${score})`);
  await page.screenshot({ path: join(shots, '3-played.png') }).catch(() => {});

  // 5. hygiene
  pageErrors.length === 0
    ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 3).join(' · ')}`);
  consoleErrors.length === 0
    ? pass('no console errors')
    : fail(`console errors: ${consoleErrors.slice(0, 3).join(' · ')}`);
  if (missing.length) console.log('  (404s, non-fatal:', missing.slice(0, 4).map(u => u.split('/').pop()).join(', ') + ')');

  console.log(process.exitCode ? '\nFINKAPP E2E: FAIL' : '\nFINKAPP E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 300)}`);
  console.log('\nFINKAPP E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
