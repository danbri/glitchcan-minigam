#!/usr/bin/env node
// The CAROUSEL — a mobile shell, not a desktop one.
//
// Free-floating draggable boxes are a desktop artifact. On a phone one
// thing owns the screen, you swipe between things, and a second thing
// appears only when it earns half. This locks the model:
//
//   · the unit you swipe between is a DECK, and a deck is a TOP-LEVEL
//     SUBTREE — a story and the game it launched are ONE card, because
//     the capability tree already knows they are one thing
//   · one app owns the screen when it is alone
//   · a deck holding a stage game yields half to it — composition inside
//     a card (the "story in text mode beside a 3D map" case), with both
//     panes live at once and the channel between them wired
//   · switching decks parks the other ALIVE, never kills it
//   · leaving carousel mode restores the desktop model exactly
//
//   node inklet/finkapp/test/e2e-carousel.mjs

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8186;
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
      '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 430, height: 860 }, hasTouch: true });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

  // NAME THE FIXTURE. `?player=boxed` alone now opens the INSTALLATION's
  // boot story (the TOC), which is correct for a reader and wrong for this
  // suite: the walk below needs demo.fink.js, whose doorway links to a
  // story with a `# MINIGAME:`. Relying on "whatever boxed happens to
  // open" made this test fail the moment that default improved.
  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/`
    + `?player=boxed&shell=carousel`
    + `&story=/${repoName}/inklet/apps/storyrunner/demo.fink.js`);
  await page.waitForFunction(() => window.FoafOS?.isCarousel?.() === true, null, { timeout: 25000 });
  await page.waitForTimeout(2500);

  // ── 1. the mode boots, with its deck strip ──────────────────────────
  const strip = await page.evaluate(() => !!document.getElementById('foafos-deck-strip'));
  strip ? pass('?shell=carousel boots the carousel with its deck strip')
        : fail('no deck strip');

  // ── 2. alone, one app owns the screen ───────────────────────────────
  const solo = await page.evaluate(() => {
    const w = document.querySelector('.foafos-window');
    const r = w.getBoundingClientRect();
    return { decks: FoafOS.decks().length, width: Math.round(r.width), vw: window.innerWidth };
  });
  solo.decks === 1 && solo.width > solo.vw * 0.9
    ? pass(`one app owns the screen (${solo.width}px of ${solo.vw}px)`)
    : fail(`solo layout wrong: ${JSON.stringify(solo)}`);

  // ── 3. HIERARCHY: a launched game joins its launcher's deck ─────────
  // Walk the demo into peer.fink.js, whose # MINIGAME: launches a game.
  const runnerFrame = () => page.frames().find((f) => { try { return new URL(f.url()).pathname.includes('/apps/storyrunner/'); } catch { return false; } });
  for (const label of ['drowned newsreel', 'odd coin', 'humming doorway']) {
    await page.waitForTimeout(1100);
    const f = runnerFrame();
    if (!f) continue;
    for (const b of await f.$$('button')) {
      if ((await b.textContent()).includes(label)) { await b.click(); break; }
    }
  }
  await page.waitForTimeout(4500);
  const deck = await page.evaluate(() => FoafOS.decks());
  deck.length === 1 && deck[0].stage && deck[0].members.length === 2
    ? pass(`the launched game joins its launcher's deck: "${deck[0].members.join(' ▸ ')}" — one card, not two`)
    : fail(`hierarchy lost — a launched game became its own card: ${JSON.stringify(deck)}`);

  // ── 4. COMPOSITION: both panes share the deck, live, wired ──────────
  const shared = await page.evaluate(async () => {
    const { appById } = await import('./foafos-apps.js');
    const w = document.querySelector('.foafos-window');
    const r = w.getBoundingClientRect();
    const stage = document.getElementById('minigame-view');
    const s = stage ? stage.getBoundingClientRect() : null;
    return {
      windowLive: !w.classList.contains('foafos-pane-off') && r.height > 40,
      winTop: Math.round(r.top), winH: Math.round(r.height),
      stageLive: !!(s && s.height > 40), stageTop: s ? Math.round(s.top) : null,
      stageH: s ? Math.round(s.height) : null,
      wmMode: window.FinkWM?.mode,
      gameHearsStory: (appById('waterworld')?.bus?.subscribe || []).includes('story.state'),
    };
  });
  const stacked = shared.stageTop !== null && shared.winTop + shared.winH <= shared.stageTop + 8;
  shared.windowLive && shared.stageLive && stacked && shared.wmMode === 'split'
    ? pass(`the deck composes: story ${shared.winH}px above stage ${shared.stageH}px, both live`)
    : fail(`composition wrong: ${JSON.stringify(shared)}`);
  shared.gameHearsStory
    ? pass('the channel between panes is wired (the game hears story.state)')
    : fail('panes share a deck but no channel between them');

  // ── 5. a second TOP-LEVEL app is a second deck ──────────────────────
  await page.evaluate(() => FoafOS.launchApp('logger'));
  await page.waitForTimeout(1300);
  const decks = await page.evaluate(() => FoafOS.decks().map((d) => d.title));
  decks.length === 2
    ? pass(`a second top-level app is a second deck: ${decks.join(' | ')}`)
    : fail(`deck derivation wrong: ${JSON.stringify(decks)}`);

  // ── 6. switching parks the other ALIVE ──────────────────────────────
  await page.evaluate(() => FoafOS.goDeck(1));
  await page.waitForTimeout(700);
  const switched = await page.evaluate(() => {
    const wins = [...document.querySelectorAll('.foafos-window')];
    return {
      on: wins.filter((w) => !w.classList.contains('foafos-pane-off')).length,
      off: wins.filter((w) => w.classList.contains('foafos-pane-off')).length,
      alive: wins.length,
      nodes: FoafOS.apps.nodes.size,
      title: document.querySelector('#foafos-deck-strip .dk-title')?.textContent,
    };
  });
  switched.on === 1 && switched.off >= 1 && switched.alive >= 2
    ? pass(`switching shows one deck and parks the other ALIVE ("${switched.title}")`)
    : fail(`deck switch wrong: ${JSON.stringify(switched)}`);

  // ── 7. leaving restores the desktop model ───────────────────────────
  await page.evaluate(() => FoafOS.setCarousel(false));
  await page.waitForTimeout(400);
  const off = await page.evaluate(() => ({
    strip: !!document.getElementById('foafos-deck-strip'),
    panes: document.querySelectorAll('.foafos-window.foafos-pane').length,
    carousel: FoafOS.isCarousel(),
    windows: document.querySelectorAll('.foafos-window').length,
  }));
  !off.strip && off.panes === 0 && !off.carousel && off.windows >= 2
    ? pass('leaving carousel restores the desktop model with every window intact')
    : fail(`exit incomplete: ${JSON.stringify(off)}`);

  pageErrors.length ? fail(`page errors: ${pageErrors.join(' | ')}`)
                    : pass('zero page errors');
} catch (e) {
  fail(`e2e crashed: ${e.message}`);
} finally {
  await browser?.close();
  server.kill();
}
console.log(failures ? `\nCAROUSEL E2E: FAIL (${failures})` : '\nCAROUSEL E2E: PASS');
process.exit(failures ? 1 : 0);
