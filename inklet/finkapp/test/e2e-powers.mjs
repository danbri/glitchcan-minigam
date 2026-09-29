#!/usr/bin/env node
// What is running, and what it may do — one source of truth.
//
//   node inklet/finkapp/test/e2e-powers.mjs
//
// The app tree holds every running node's powers; the brokers ask it, and the
// switcher shows it. Measured before this suite existed (September 2026):
//   · a stage app launched from the picker got TWO nodes, and one outlived the
//     game as a ghost row
//   · closing an app left its storage and secrets grants in the brokers
//   · an unknown `# MINIGAME:` name, and the table of contents' canarywharf,
//     played Gem Hunt instead
//   · the suspend path TOGGLED a game's pause instead of setting it
//
// It also plays Drift city's Lantern Cellar through the production path: a
// boxed story's `# MINIGAME: cellar` opens the novel page as a sandboxed stage
// app that holds no capability, and the minigame protocol carries a narrative
// guest end to end — pause, snapshot on close, restore, and the story's own
// exit handing control back.

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8171;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = `http://127.0.0.1:${PORT}/${repoName}`;

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
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function frameMatching(page, re, tries = 80) {
  for (let i = 0; i < tries; i++) {
    const f = page.frames().find((fr) => re.test(fr.url()));
    if (f) return f;
    await wait(250);
  }
  return null;
}

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

  // ── Part 1: the shell with no story, driving the tree and the brokers ──
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/inklet/finkapp/?player=none`);
  await page.waitForFunction(() => window.FoafOS?.apps && window.FinkMinigames, null, { timeout: 20000 });
  await wait(800);
  const count = (id) => page.evaluate((a) => [...FoafOS.apps.nodes.values()].filter((n) => n.appId === a).length, id);

  // 1. One node per stage app, gone when the game ends
  await page.evaluate(() => FoafOS.launchApp('gridluck'));
  await wait(2000);
  const gridRunning = await count('gridluck');
  await page.evaluate(() => FinkMinigames.endMinigame());
  await wait(1200);
  const gridAfter = await count('gridluck');
  gridRunning === 1 && gridAfter === 0
    ? pass('a stage app launched from the picker is ONE node, and it goes when the game ends')
    : fail(`stage launch nodes: ${gridRunning} while running, ${gridAfter} after the end`);

  await page.evaluate(() => FoafOS.launchApp('gems'));
  await wait(800);
  const gemsRunning = await count('gems');
  await page.evaluate(() => FinkMinigames.endMinigame());
  await wait(800);
  const gemsAfter = await count('gems');
  gemsRunning === 1 && gemsAfter === 0
    ? pass('a host-drawn game (gems) gets its one node too, closed on completion')
    : fail(`gems nodes: ${gemsRunning} while running, ${gemsAfter} after the end`);

  // Closing it from the switcher ends the game, and the game then reports
  // completion. That report must not close the node a second time.
  const closedOnce = await page.evaluate(async () => {
    FoafOS.launchApp('gems');
    await new Promise((r) => setTimeout(r, 600));
    const id = [...FoafOS.apps.nodes.values()].find((n) => n.appId === 'gems')?.id;
    let events = 0;
    const off = FoafOS.bus.subscribe('app.close', (e) => { if ((e.data.closed || []).includes(id)) events++; });
    FoafOS.apps.close(id);
    await new Promise((r) => setTimeout(r, 600));
    off();
    return { id, events, left: [...FoafOS.apps.nodes.values()].filter((n) => n.appId === 'gems').length,
             active: FinkMinigames.active };
  });
  closedOnce.id && closedOnce.events === 1 && closedOnce.left === 0 && !closedOnce.active
    ? pass('closing a host-drawn game from the switcher ends it, and closes its node once')
    : fail(`gems close from the switcher: ${JSON.stringify(closedOnce)}`);

  // 2. Broker grants follow the tree
  await page.evaluate(() => FoafOS.launchApp('sheets'));
  await page.waitForFunction(() => [...FoafOS.apps.nodes.values()].some((n) => n.appId === 'sheets'));
  const whileOpen = await page.evaluate(() => FoafOS.store.can('sheets', 'storage'));
  await page.evaluate(() => {
    for (const n of [...FoafOS.apps.nodes.values()]) if (n.appId === 'sheets') FoafOS.apps.close(n.id);
  });
  await wait(300);
  const afterClose = await page.evaluate(() => ({
    sheets: FoafOS.store.can('sheets', 'storage'),
    shellNs: FoafOS.root.capabilities.includes('storage') ? FoafOS.store.can(FoafOS.snapshotNs, 'storage') : true,
    secretsHolders: [...FoafOS.secrets.grants.keys()],
  }));
  whileOpen && !afterClose.sheets
    ? pass('closing an app\'s last node revokes its storage grant in the broker')
    : fail(`storage grant: open=${whileOpen}, after close=${afterClose.sheets}`);
  afterClose.shellNs
    ? pass('the shell\'s own snapshot namespace is not an app, and keeps its grant')
    : fail('the shell lost its own snapshot namespace');
  afterClose.secretsHolders.length === 0
    ? pass('no closed app is left holding secrets')
    : fail(`secrets still held by: ${afterClose.secretsHolders.join(', ')}`);

  // 3. The tree hands out nothing that can change it
  const sealed = await page.evaluate(() => {
    const n = FoafOS.rootNode;
    let pushThrew = false;
    try { n.capabilities.push('forged:power'); } catch { pushThrew = true; }
    try { n.suspended = true; } catch { /* sloppy mode ignores it; either way nothing changes */ }
    return { pushThrew, holds: FoafOS.apps.can(n.id, 'forged:power'), suspended: FoafOS.apps.get(n.id).suspended,
             set: typeof FoafOS.apps.nodes.set, del: typeof FoafOS.apps.nodes.delete };
  });
  sealed.pushThrew && !sealed.holds && !sealed.suspended && sealed.set === 'undefined' && sealed.del === 'undefined'
    ? pass('node views and the node map are read-only: powers change only through the tree')
    : fail(`the tree leaked a writable handle: ${JSON.stringify(sealed)}`);

  // 4. The one registry: unknown names refused, canarywharf is its own game
  const refused = await page.evaluate(async () => {
    const seen = [];
    const off = FoafOS.bus.subscribe('minigame.refused', (e) => seen.push(e.data.type));
    const returned = FinkMinigames.startMinigame('nosuchgame');
    await new Promise((r) => setTimeout(r, 300));
    off();
    return { returned, seen, active: FinkMinigames.active,
             gems: getComputedStyle(document.getElementById('game-container') || document.body).display !== 'none'
               && !!document.getElementById('game-container') };
  });
  refused.returned === false && refused.seen.includes('nosuchgame') && !refused.active
    ? pass('an unregistered game name is refused out loud, not turned into Gem Hunt')
    : fail(`unknown game: ${JSON.stringify(refused)}`);

  await page.evaluate(() => FinkMinigames.startMinigame('canarywharf'));
  const wharf = await frameMatching(page, /magpie\/dbdb\/canarywharf\.html/, 40);
  wharf
    ? pass('canarywharf (linked from the table of contents) now opens its own page')
    : fail('canarywharf did not open its page');
  await page.evaluate(() => FinkMinigames.endMinigame());
  await wait(800);

  // ── Part 2: Drift city's cellar, through a boxed story ──────────────────
  const story = await browser.newPage({ viewport: { width: 430, height: 860 } });
  story.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  await story.goto(`${BASE}/inklet/finkapp/?story=/${repoName}/drift-city/novel/cellar-entry.fink.js`);
  await story.waitForFunction(() => window.FoafOS?.apps, null, { timeout: 20000 });
  const runner = await frameMatching(story, /apps\/storyrunner\/index\.html/);
  if (!runner) throw new Error('no story runner frame');
  await runner.waitForFunction(() => window.__storyrunner?.ready?.()
    && window.__storyrunner.state.choices.length > 0, null, { timeout: 25000 });
  const opening = await runner.evaluate(() => document.getElementById('prose')?.textContent || '');
  opening.includes('Ferry Street. Snow settles on your case.')
    ? pass('the entry story plays in the box')
    : fail(`entry story prose: ${opening.slice(0, 120)}`);

  // 5. An unregistered game from a story is refused by the shell, before the stage
  const ask = await runner.evaluate(() => window.foaf.storyRequest('story.launch', { game: 'nosuchgame' }));
  !ask.ok && ask.reason === 'unregistered'
    ? pass('the shell refuses a story\'s request for an unregistered game')
    : fail(`story.launch of an unknown game: ${JSON.stringify(ask)}`);

  // 6. # MINIGAME: cellar opens the page as a sandboxed stage app
  await runner.evaluate(() => window.__storyrunner.choose(0));
  let cellar = await frameMatching(story, /drift-city\/novel\/cellar\.html/);
  if (!cellar) throw new Error('the cellar guest never opened');
  await cellar.waitForFunction(() => document.querySelector('[slot=ink] button'), null, { timeout: 20000 });
  const guest = await cellar.evaluate(() => ({
    origin: self.origin,
    ink: document.querySelector('[slot=ink]').innerText,
    stills: [...document.querySelectorAll('novel-page img')].every((i) => i.complete && i.naturalWidth > 0),
  }));
  guest.origin === 'null' && guest.ink.includes('The jam goes on under the street.') && guest.stills
    ? pass('# MINIGAME: cellar opens the novel page in an opaque-origin frame, with its own ink and media')
    : fail(`cellar guest: ${JSON.stringify(guest).slice(0, 300)}`);
  const paused = await runner.evaluate(() => window.__storyrunner.paused());
  paused ? pass('the outer story is paused while the cellar plays') : fail('the outer story did not pause');

  const node = await story.evaluate(() => {
    const n = [...FoafOS.apps.nodes.values()].find((x) => x.appId === 'cellar');
    return n && { id: n.id, label: n.label, caps: [...n.capabilities], parent: FoafOS.apps.get(n.parentId)?.appId,
                  bus: n.scopes.bus };
  });
  node && node.caps.length === 0 && node.parent === 'story-session' && node.bus?.publish?.[0] === 'guest.cellar.*'
    ? pass(`the cellar is one node under the story session, holding nothing (bus: ${node.bus.publish})`)
    : fail(`cellar node: ${JSON.stringify(node)}`);

  // 7. The switcher shows the powers in force
  const shown = await story.evaluate(async (id) => {
    FoafOS.openSwitcher();
    await new Promise((r) => setTimeout(r, 200));
    const row = [...document.querySelectorAll('.foafos-switch-row')]
      .find((r) => r.querySelector('.ttl')?.textContent === 'The Lantern Cellar');
    const sub = row?.querySelector('.sub')?.textContent || '';
    const runnerRow = [...document.querySelectorAll('.foafos-switch-row')]
      .find((r) => r.querySelector('.ttl')?.textContent === 'Finkosphere');
    // the count the row should give, from the node itself (a new power must
    // not break a check about how the row shows powers)
    const held = [...FoafOS.apps.nodes.values()].find((n) => n.appId === 'storyrunner')?.capabilities.length ?? -1;
    const runner = { sub: runnerRow?.querySelector('.sub')?.textContent || '',
                     name: runnerRow?.querySelector('.c-powers')?.title || '',
                     h: Math.round(runnerRow?.getBoundingClientRect().height || 0), held };
    row?.querySelector('.foafos-switch-info')?.click();
    await new Promise((r) => setTimeout(r, 200));
    const rows = Object.fromEntries([...document.querySelectorAll('.foafos-app-info .fi-row')]
      .map((d) => [d.querySelector('.fi-k')?.textContent, d.querySelector('.fi-v')?.textContent]));
    document.querySelector('.foafos-overlay-close')?.click();
    return { sub, rows, runner };
  }, node?.id);
  shown.sub.includes('holds nothing')
    ? pass(`the switcher row says what the node holds ("${shown.sub}")`)
    : fail(`switcher row: ${JSON.stringify(shown.sub)}`);
  shown.runner.held > 1 && shown.runner.sub.includes(`holds ${shown.runner.held} powers`)
    && shown.runner.name.includes('story:launch') && shown.runner.h < 160
    ? pass(`a row gives the COUNT (${shown.runner.sub.split(' · ').pop()}, ${shown.runner.h}px tall at phone width); `
      + 'its Powers cell names them')
    : fail(`story runner row: ${JSON.stringify(shown.runner)}`);
  (shown.rows.bus || '').includes('guest.cellar.*') && (shown.rows.sandbox || '').includes('allow-scripts')
    && (shown.rows.variables || '').includes('no vars:write')
    ? pass('ⓘ shows the bus scope, the frame sandbox and the variables the node may not touch')
    : fail(`ⓘ rows: ${JSON.stringify(shown.rows)}`);

  // 8. A guest that holds no vars:write writes nothing
  await cellar.evaluate(() => parent.postMessage({ type: 'set-variable', name: 'diamonds', value: 99 }, '*'));
  await wait(400);
  const denial = await story.evaluate(() => FoafOS.vars.log.filter((l) => l.name === 'diamonds').at(-1));
  denial && !denial.ok && /does not hold vars:write/.test(denial.reason)
    ? pass('the cellar may not write story variables: its node holds no vars:write')
    : fail(`vars write by the cellar: ${JSON.stringify(denial)}`);

  // 9. Pause freezes the page; resume restarts it
  await story.evaluate((id) => FoafOS.setNodeSuspended(id, true), node.id);
  await wait(600);
  const frozen = await cellar.evaluate(() => ({
    paused: document.querySelector('novel-page').paused,
    running: document.getAnimations().filter((a) => a.playState === 'running').length,
    video: document.querySelector('novel-page video').paused,
  }));
  frozen.paused && frozen.running === 0 && frozen.video
    ? pass('suspending the node freezes every animation and the video in the page')
    : fail(`pause did not freeze the page: ${JSON.stringify(frozen)}`);
  await story.evaluate((id) => FoafOS.setNodeSuspended(id, false), node.id);
  await wait(600);
  const thawed = await cellar.evaluate(() => ({
    paused: document.querySelector('novel-page').paused,
    running: document.getAnimations().filter((a) => a.playState === 'running').length,
  }));
  !thawed.paused && thawed.running > 0
    ? pass(`resuming restarts them (${thawed.running} animations running)`)
    : fail(`resume did not restart the page: ${JSON.stringify(thawed)}`);

  // 10. Close keeps a snapshot; reopening restores panel and choices
  const clickChoice = (f, text) => f.evaluate((t) => {
    const b = [...document.querySelectorAll('[slot=ink] button')].find((x) => x.textContent === t);
    if (b) b.click();
    return !!b;
  }, text);
  await clickChoice(cellar, 'Go down to the Lantern Cellar, Chinatown');
  await wait(300);
  await clickChoice(cellar, 'Look at the stage');
  await wait(2200);
  const there = await cellar.evaluate(() => ({
    current: document.querySelector('novel-page').current,
    choices: [...document.querySelectorAll('[slot=ink] button')].map((b) => b.textContent),
  }));
  await story.evaluate(() => FinkMinigames.endMinigame());
  await runner.waitForFunction(() => !window.__storyrunner.paused(), null, { timeout: 10000 });
  await wait(600);
  const kept = await story.evaluate(() => FinkMinigames.hasSnapshot('cellar'));
  kept ? pass(`closing the cellar kept its place (panel ${there.current})`) : fail('no snapshot kept on close');

  await runner.evaluate(() => window.__storyrunner.choose(0));
  await wait(1500);
  cellar = await frameMatching(story, /drift-city\/novel\/cellar\.html/);
  await cellar.waitForFunction(() => document.querySelector('[slot=ink] button'), null, { timeout: 20000 });
  await wait(800);
  const back = await cellar.evaluate(() => ({
    current: document.querySelector('novel-page').current,
    choices: [...document.querySelectorAll('[slot=ink] button')].map((b) => b.textContent),
  }));
  back.current === there.current && JSON.stringify(back.choices) === JSON.stringify(there.choices)
    ? pass(`reopening restored the panel and the reader's choices (${back.choices.join(' / ')})`)
    : fail(`restore: before ${JSON.stringify(there)}, after ${JSON.stringify(back)}`);

  // 11. The story's own exit hands control back, and a finished visit keeps no save
  await clickChoice(cellar, 'Back to Ferry Street');
  await runner.waitForFunction(() => !window.__storyrunner.paused(), null, { timeout: 10000 });
  await wait(500);
  const after = await runner.evaluate(() => document.getElementById('prose')?.textContent || '');
  after.includes('Ferry Street, the snow still falling.')
    ? pass('"Back to Ferry Street" completes the guest, and the outer story resumes after the tag')
    : fail(`after the cellar: ${after.slice(0, 160)}`);
  const cleared = await story.evaluate(() => ({
    snapshot: FinkMinigames.hasSnapshot('cellar'),
    nodes: [...FoafOS.apps.nodes.values()].filter((n) => n.appId === 'cellar').length,
  }));
  !cleared.snapshot && cleared.nodes === 0
    ? pass('a completed visit forgets its snapshot and leaves no node behind')
    : fail(`after completion: ${JSON.stringify(cleared)}`);

  pageErrors.length === 0 ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nPOWERS E2E: FAIL' : '\nPOWERS E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 400)}`);
  console.log('\nPOWERS E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
