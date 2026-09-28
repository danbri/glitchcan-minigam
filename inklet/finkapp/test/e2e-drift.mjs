#!/usr/bin/env node
// Drift City's stage apps in the shell: "drift" (the city) and "talkinghead"
// (a cast member's face speaking a recorded line), opened by the entry story
// drift-city/foafos-entry.fink.js, and the # MINIGAME: arguments that choose
// what they show.
//
//   node inklet/finkapp/test/e2e-drift.mjs
//
// Plain headless Chromium: no WebGPU, so the city runs its WebGL fallback
// (slowly, on SwiftShader). The checks are about the protocol, not frames.
// The story-game-sync skill has the model; the drift-city skill the lessons.

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8174;
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

async function frameMatching(page, re, tries = 120) {
  for (let i = 0; i < tries; i++) {
    const f = page.frames().find((fr) => re.test(fr.url()));
    if (f) return f;
    await wait(250);
  }
  return null;
}
const runnerOf = (page) => frameMatching(page, /apps\/storyrunner/);
const choices = (runner) => runner.evaluate(() => [...window.__storyrunner.state.choices]);
async function chooseText(runner, text) {
  await runner.waitForFunction((t) => window.__storyrunner?.state.choices.includes(t), text, { timeout: 30000 });
  await runner.evaluate((t) => window.__storyrunner.choose(window.__storyrunner.state.choices.indexOf(t)), text);
}
const nodeOf = (page, appId) => page.evaluate((a) => {
  const n = [...FoafOS.apps.nodes.values()].find((x) => x.appId === a);
  return n ? { id: n.id, parent: FoafOS.apps.get(n.parentId)?.surface, caps: [...n.capabilities], args: n.scopes?.args || null,
    suspended: n.suspended } : null;
}, appId);

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));

  // 1. the shell's filter, as a unit: declared keys pass, the host's own are
  // taken out, anything else is dropped
  await page.goto(`${BASE}/inklet/finkapp/?story=/${repoName}/drift-city/foafos-entry.fink.js`);
  await page.waitForFunction(() => window.FoafOS?.launchArgs, null, { timeout: 20000 });
  const filt = await page.evaluate(() => FoafOS.launchArgs(FoafOS.stageApp('drift'),
    { tale: 'peraspera', mode: 'night', controls: 'sideways', bogus: '1', evil: 'a/../b c' }));
  JSON.stringify(filt.app) === '{"tale":"peraspera"}' && filt.host.mode === 'night' && !filt.host.controls
    && filt.dropped.join() === 'controls,bogus,evil'
    ? pass('only declared keys pass (tale); mode goes to the stage host; a bad controls value, an undeclared key and a value with a space are dropped')
    : fail(`launchArgs: ${JSON.stringify(filt)}`);

  // 2. the story opens the city on one of its stories
  let runner = await runnerOf(page);
  await runner.waitForFunction(() => window.__storyrunner?.ready?.() && window.__storyrunner.state.choices.length > 0, null, { timeout: 30000 });
  await chooseText(runner, 'Per Aspera');
  const city = await frameMatching(page, /drift-city\/dist\/city\.html\?tale=peraspera$/);
  if (!city) throw new Error('the city frame never opened with ?tale=peraspera');
  await city.waitForFunction(() => window.__drift?.host?.().sdk?._config, null, { timeout: 60000 });
  const inCity = await city.evaluate(() => ({ on: __drift.host().on, args: __drift.host().sdk._config.args,
    file: __drift.TALE.file, origin: String(self.origin) }));
  const dnode = await nodeOf(page, 'drift');
  inCity.on && inCity.args?.tale === 'peraspera' && inCity.file === 'peraspera.fink.js' && inCity.origin === 'null'
    && dnode && JSON.stringify(dnode.args) === '{"tale":"peraspera"}' && dnode.caps.join() === 'audio'
    ? pass(`"# MINIGAME: drift tale=peraspera" opens the city on Per Aspera, in a sandboxed frame, as a node holding audio with args tale=peraspera`)
    : fail(`city: ${JSON.stringify({ inCity, dnode })}`);

  // 3. the Task Manager shows what the story asked for
  const tmRow = await page.evaluate(() => {
    FoafOS.openSwitcher();
    const row = [...document.querySelectorAll('#foafos-switcher tr.foafos-switch-row')]
      .find((r) => r.querySelector('.ttl')?.textContent === 'Drift City');
    const txt = row?.querySelector('.c-state')?.textContent || '';
    FoafOS.openSwitcher();
    return txt;
  });
  /tale=peraspera/.test(tmRow)
    ? pass(`the Task Manager row says it: "${tmRow}"`)
    : fail(`Task Manager state cell: "${tmRow}"`);

  // 4. pause and resume reach the city
  await page.evaluate((id) => FoafOS.setSubtreeSuspended(id, true), dnode.id);
  await wait(400);
  const paused = await city.evaluate(() => __drift.host().paused);
  await page.evaluate((id) => FoafOS.setSubtreeSuspended(id, false), dnode.id);
  await wait(400);
  const resumed = !(await city.evaluate(() => __drift.host().paused));
  paused && resumed
    ? pass('pausing the node pauses the city (frames, sound, tour, recorded line); resuming restarts it')
    : fail(`pause: ${JSON.stringify({ paused, resumed })}`);

  // 5. the master volume reaches its level
  await page.evaluate(() => FoafOS.audio.setVolume?.(0.3));
  await wait(300);
  const lvl = await city.evaluate(() => __drift.host().level);
  await page.evaluate(() => FoafOS.audio.setVolume?.(1));
  Math.abs(lvl - 0.3) < 0.01
    ? pass(`the master volume sets the city's level (${lvl})`)
    : fail(`level after setVolume(0.3): ${lvl}`);

  // 6. open the story in the city and take one step, so there is a save
  await city.evaluate(() => __drift.taleOpen());
  await city.waitForFunction(() => __drift.TALE.story && document.querySelectorAll('#taleChoices button').length > 0, null, { timeout: 60000 });
  const firstChoice = await city.evaluate(() => document.querySelector('#taleChoices button').textContent);
  await city.evaluate(() => __drift.taleChoose(0));
  await city.waitForFunction(() => !!__drift.taleMem()['drift.tale:peraspera.fink.js'], null, { timeout: 30000 }).catch(() => {});
  const saved = await city.evaluate(() => JSON.parse(__drift.taleMem()['drift.tale:peraspera.fink.js'] || 'null'));
  // The choice starts Mags's recorded lines, and the city loads her head for its comms feed: one long synchronous task
  // (5 MB, 20,000 splats). A close during that task answers the snapshot request after the shell's 400ms wait, and the
  // save is lost (seen here: two runs in three). Let the load finish first.
  await city.waitForFunction(() => !__drift.HEADS.who || __drift.HEADS.av || __drift.HEADS.fail, null, { timeout: 60000 }).catch(() => {});
  saved?.state
    ? pass(`Per Aspera plays in the city ("${firstChoice}" chosen), and its save goes to memory: the frame has no storage of its own`)
    : fail(`city story: ${JSON.stringify({ firstChoice, saved: !!saved })}`);

  // 7. its snapshot is its story saves. Asked directly with a long wait: on
  // SwiftShader a frame of the city takes seconds, and the close path waits
  // 400ms for an answer. On a GPU a frame takes 16 to 33ms.
  await page.waitForFunction(() => FinkMinigames.windowInstance?.contracts?.has('snapshot'), null, { timeout: 60000 })
    .catch(() => {});
  const snap = await page.evaluate(() => FinkMinigames._requestSnapshot(FinkMinigames.windowInstance, 20000));
  snap && snap.v === 1 && snap.saves?.['drift.tale:peraspera.fink.js']
    ? pass(`the city answers the snapshot contract with its story saves (${Object.keys(snap.saves).join(', ')})`)
    : fail(`snapshot: ${JSON.stringify(snap)}`);

  // 8. closed from the Task Manager, paused first so its thread is free to
  // answer in time: the snapshot is kept, and the story goes on
  await page.evaluate(() => { window.__mgEv = []; FoafOS.bus.subscribe('minigame.*', (e) => __mgEv.push(`${e.topic}: ${e.data?.summary || ''}`)); });
  await page.evaluate((id) => FoafOS.setSubtreeSuspended(id, true), dnode.id);
  await wait(1500);
  await page.evaluate((id) => FoafOS.apps.close(id), dnode.id);
  await page.waitForFunction(() => ![...FoafOS.apps.nodes.values()].some((n) => n.appId === 'drift'), null, { timeout: 10000 });
  await wait(600);
  const kept = await page.evaluate(() => FinkMinigames._snapshots?.drift ?? null);
  await runner.waitForFunction(() => window.__storyrunner.state.choices.length > 0, null, { timeout: 15000 });
  const back = await choices(runner);
  kept?.v === 1 && back.includes('Per Aspera')
    ? pass('closing the city keeps that snapshot, and the story goes on to its choices')
    : fail(`close: ${JSON.stringify({ kept, back, events: await page.evaluate(() => window.__mgEv) })}`);

  // 9. reopened, the city gets the snapshot back: Per Aspera is where it was
  await chooseText(runner, 'Per Aspera');
  const again = await frameMatching(page, /drift-city\/dist\/city\.html\?tale=peraspera$/);
  const restored = again && await again.waitForFunction(() => !!window.__drift?.taleMem?.()['drift.tale:peraspera.fink.js'], null, { timeout: 60000 })
    .then(() => true, () => false);
  restored
    ? pass('reopened, the city gets its saves back from the snapshot, so Per Aspera resumes where it was left')
    : fail('reopen: the saves did not come back');
  const dnode2 = await nodeOf(page, 'drift');
  await page.evaluate((id) => FoafOS.setSubtreeSuspended(id, true), dnode2.id);
  await wait(1000);
  await page.evaluate((id) => FoafOS.apps.close(id), dnode2.id);
  await runner.waitForFunction(() => window.__storyrunner.state.choices.length > 0, null, { timeout: 15000 });

  // 10. a cast member speaks a recorded line, with no tap in its frame
  await chooseText(runner, 'Go into the Cold Tap and ask Mags');
  const feed = await frameMatching(page, /drift-city\/feed\/index\.html\?line=mags-1$/);
  if (!feed) throw new Error('the talking head never opened with ?line=mags-1');
  await feed.waitForFunction(() => window.__feed, null, { timeout: 20000 });
  const played = await feed.waitForFunction(() => __feed.audio.currentTime > 0.3, null, { timeout: 20000 }).then(() => true, () => false);
  const hnode = await nodeOf(page, 'talkinghead');
  played && hnode && JSON.stringify(hnode.args) === '{"line":"mags-1"}' && hnode.caps.join() === 'audio'
    ? pass('"# MINIGAME: talkinghead line=mags-1" plays the clip without a tap in its frame (autoplay), as a node holding audio')
    : fail(`talking head: ${JSON.stringify({ played, hnode, tap: await feed.evaluate(() => !document.getElementById('play').hidden) })}`);

  // 11. pause reaches the clip (checked while the line is still playing)
  await page.evaluate((id) => FoafOS.setSubtreeSuspended(id, true), hnode.id);
  await wait(300);
  const hPaused = await feed.evaluate(() => __feed.audio.paused);
  const tAt = await feed.evaluate(() => __feed.audio.currentTime);
  await wait(800);
  const held = await feed.evaluate((t) => Math.abs(__feed.audio.currentTime - t) < 0.05, tAt);
  await page.evaluate((id) => FoafOS.setSubtreeSuspended(id, false), hnode.id);
  await wait(300);
  const hResumed = await feed.evaluate(() => !__feed.audio.paused || __feed.audio.ended);
  hPaused && held && hResumed
    ? pass('pausing the node holds the line where it is; resuming plays on')
    : fail(`talking head pause: ${JSON.stringify({ hPaused, held, hResumed })}`);

  // 12. the face: Mags's LAM head loads and draws while she speaks
  const head = await feed.waitForFunction(() => __feed.HEADS.who === 'mags' && __feed.HEADS.av && __feed.HEADS.r, null, { timeout: 15000 })
    .then(() => true, () => false);
  const hs = head ? null : await feed.evaluate(() => ({ who: __feed.HEADS.who, av: !!__feed.HEADS.av, r: !!__feed.HEADS.r, fail: __feed.HEADS.fail })).catch(() => 'gone');
  head
    ? pass('Mags\'s rigged splat head (LAM) loads in the sandboxed frame and draws')
    : fail(`the head: ${JSON.stringify(hs)}`);

  // 13. the line ends, control comes back, the story goes on to the next line
  // (its own talking head) and then to its choice
  const second = await frameMatching(page, /drift-city\/feed\/index\.html\?line=mags-3$/, 160);
  await runner.waitForFunction(() => window.__storyrunner.state.choices.includes('Thank her and go'), null, { timeout: 60000 })
    .catch(() => {});
  const after = await choices(runner);
  second && after.includes('Thank her and go')
    ? pass('each line hands control back when it ends: the second line opens its own feed (line=mags-3), then the story offers "Thank her and go"')
    : fail(`after the lines: ${JSON.stringify({ second: !!second, after })}`);

  errs.length === 0 ? pass('no page errors') : fail(`page errors: ${errs.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nDRIFT APPS E2E: FAIL' : '\nDRIFT APPS E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 400)}`);
  console.log('\nDRIFT APPS E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
