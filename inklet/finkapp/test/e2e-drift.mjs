#!/usr/bin/env node
// Drift City's stage apps in the shell: "drift" (the city) and "talkinghead"
// (a cast member's face speaking a recorded line), opened by the entry story
// drift-city/foafos-entry.fink.js, and the # MINIGAME: arguments that choose
// what they show. Then the city as the WORLD beside a story (# WORLD: drift):
// the story plays in the foafos runner and its tags drive the city.
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
const runnerOf = (page) => frameMatching(page, /apps\/storyrunner\/index\.html/);
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
  // The hub now opens the stories as a world (sections 15 on). The city as a GAME with its own story is still a path:
  // the verb that "# MINIGAME: drift tale=peraspera" sends.
  const launchDrift = () => runner.evaluate(() => window.foaf.storyRequest('story.launch', { game: 'drift', args: { tale: 'peraspera' } }));
  await launchDrift();
  const city = await frameMatching(page, /drift-city\/dist\/city\.html\?tale=peraspera$/);
  if (!city) throw new Error('the city frame never opened with ?tale=peraspera');
  await city.waitForFunction(() => window.__drift?.host?.().sdk?._config, null, { timeout: 60000 });
  const inCity = await city.evaluate(() => ({ on: __drift.host().on, args: __drift.host().sdk._config.args,
    file: __drift.TALE.file, origin: String(self.origin) }));
  const dnode = await nodeOf(page, 'drift');
  inCity.on && inCity.args?.tale === 'peraspera' && inCity.file === 'peraspera.fink.js' && inCity.origin === 'null'
    && dnode && JSON.stringify(dnode.args) === '{"tale":"peraspera"}' && dnode.caps.join() === 'audio,vars:read,vars:write,story:steer'
    ? pass(`story.launch drift tale=peraspera (what "# MINIGAME: drift tale=peraspera" sends) opens the city on Per Aspera, in a sandboxed frame, as a node holding audio and vars with args tale=peraspera`)
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
  await launchDrift();
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
  const kind = head ? await feed.evaluate(() => __feed.HEADS.r.kind).catch(() => 'gone') : null;
  head && kind === 'webgl2'
    ? pass('Mags\'s rigged splat head (LAM) loads in the sandboxed frame and draws; with no WebGPU adapter here, on the CPU and WebGL2')
    : fail(`the head: ${JSON.stringify({ hs, kind })}`);

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

  // ── THE WORLD BESIDE A STORY (# WORLD: drift) ──────────────────────────
  // The owner, September 2026: inside foafos the city "still uses Drift's
  // baked-in Fink/Ink client, instead of the foafos framework". Now the hub
  // links to Per Aspera as a dream, the foafos runner plays it, and the
  // story's own # WORLD: drift opens the city beside it.
  {
    const wpage = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    const werrs = [];
    wpage.on('pageerror', (e) => werrs.push(String(e).slice(0, 200)));
    await wpage.goto(`${BASE}/inklet/finkapp/?story=/${repoName}/drift-city/foafos-entry.fink.js`);
    const wr = await runnerOf(wpage);
    await wr.waitForFunction(() => window.__storyrunner?.ready?.() && window.__storyrunner.state.choices.length > 0, null, { timeout: 30000 });
    await chooseText(wr, 'Per Aspera');
    await wr.waitForFunction(() => /peraspera/.test(window.__storyrunner.state.storyUrl || '')
      && window.__storyrunner.state.choices.length > 0, null, { timeout: 60000 });
    const st = await wr.evaluate(() => ({ file: window.__storyrunner.state.storyUrl.split('/').pop(),
      depth: window.__storyrunner.depth(), world: window.__storyrunner.state.world, choices: window.__storyrunner.state.choices }));
    // 15. the story is the runner's
    st.file === 'peraspera.fink.js' && st.depth === 1 && st.world === 'drift' && st.choices.includes('Look around')
      ? pass('the hub links to Per Aspera as a dream: the foafos runner plays it, its # WORLD: drift names the city, and clues come as choices ("Look around")')
      : fail(`runner: ${JSON.stringify(st)}`);

    // 16. the city opens beside the story
    const wcity = await frameMatching(wpage, /drift-city\/dist\/city\.html\?world=1$/);
    if (!wcity) throw new Error('the city never opened with ?world=1');
    await wcity.waitForFunction(() => (window.__drift?.TALE?.worldBeats || 0) > 0, null, { timeout: 90000 });
    const wn = await wpage.evaluate(() => {
      const n = [...FoafOS.apps.nodes.values()].find((x) => x.appId === 'drift');
      const win = document.querySelector('.foafos-window iframe[src*="storyrunner"]')?.closest('.foafos-window');
      return n && { parent: FoafOS.apps.get(n.parentId)?.surface, caps: [...n.capabilities].join(),
        yielded: !!win?.classList.contains('foafos-yielded') };
    });
    wn && wn.parent === 'story' && wn.caps === 'audio,vars:read,vars:write,story:steer' && !wn.yielded
      ? pass('the city opens beside the story, not over it: a node under the dream session holding audio and vars, and the story window stays on screen')
      : fail(`world node: ${JSON.stringify(wn)}`);
    // on a phone the world's place is the reader's, in the window manager's toolbar: split, full or pip
    await wpage.setViewportSize({ width: 390, height: 844 });
    const lay = [];
    for (const mode of ['split', 'full', 'pip']) {
      await wpage.evaluate((m) => window.FinkWM.setMode(m), mode);
      await wait(600);
      lay.push(await wpage.evaluate(() => {
        const R = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; };
        const win = document.querySelector('.foafos-window iframe[src*="storyrunner"]').closest('.foafos-window');
        const chrome = document.getElementById('wm-chrome');
        return { mode: document.body.dataset.stageMode, stage: R(document.getElementById('minigame-view')), story: R(win),
          shown: getComputedStyle(win).visibility === 'visible',
          stageOver: +getComputedStyle(document.getElementById('minigame-view')).zIndex > +getComputedStyle(win).zIndex,
          toolbar: +getComputedStyle(chrome).zIndex > +getComputedStyle(win).zIndex };
      }));
    }
    await wpage.evaluate(() => window.FinkWM.setMode('full'));
    await wpage.setViewportSize({ width: 1000, height: 760 });
    const [sl, fu, pp] = lay;
    const apart = sl.story[1] <= sl.stage[0] + 1 || sl.stage[1] <= sl.story[0] + 1;
    const filled = Math.min(sl.story[0], sl.stage[0]) <= 1 && Math.max(sl.story[1], sl.stage[1]) >= 843;
    sl.mode === 'split' && sl.shown && apart && filled && sl.toolbar && fu.mode === 'full' && !fu.shown
      && pp.mode === 'pip' && pp.shown && pp.stageOver
      ? pass(`on a phone the window manager places the world: split gives the story ${sl.story.join("-")} and the city ${sl.stage.join("-")}, full hides the story, pip floats the city over it; its toolbar stays on top`)
      : fail(`world layout by mode: ${JSON.stringify(lay)}`);

    // 17. the story's first step drives the city, which has no story of its own
    const c1 = await wcity.evaluate(() => ({ world: __drift.host().world, scene: __drift.TALE.scene, place: __drift.TALE.place,
      on: __drift.TALE.on, panelHidden: document.getElementById('tale').hidden,
      gateHidden: document.getElementById('gate')?.hidden !== false, base: __drift.TALE.base || '', wvars: { ...__drift.TALE.wvars } }));
    c1.world && c1.scene === 'street' && c1.place === 'street_1' && !c1.on && c1.panelHidden && c1.gateHidden
      && /drift-city\/story\/peraspera\.fink\.js$/.test(c1.base) && 'want_time' in c1.wvars && 'want_weather' in c1.wvars
      ? pass('the first step\'s tags drive the city (scene street, place street_1); no story panel, no opening page; it has the story\'s want_time and want_weather')
      : fail(`city in world mode: ${JSON.stringify(c1)}`);

    // 17b. a world may re-enter ONLY the scene the story's last # scene: named
    await wpage.evaluate(() => { window.__rw = []; FoafOS.bus.subscribe('app.storyrunner.world', (e) => window.__rw.push(e.data)); });
    const beforeWrong = await choices(wr);
    await wcity.evaluate(() => __drift.host().sdk.reenterScene('mags'));
    await wpage.waitForFunction(() => window.__rw.some((x) => x.reenter === 'mags'), null, { timeout: 15000 }).catch(() => {});
    const wrong = await wpage.evaluate(() => window.__rw.find((x) => x.reenter === 'mags') || null);
    const afterWrong = await choices(wr);
    wrong && wrong.ok === false && JSON.stringify(afterWrong) === JSON.stringify(beforeWrong)
      ? pass('the city asks to enter "mags" while the reader is on the street: refused by the runner, the story unchanged')
      : fail(`wrong scene: ${JSON.stringify({ wrong, beforeWrong, afterWrong })}`);

    // 17c. a clue found in the city: its VAR goes to the story, and the story re-enters the scene
    const clue = await wcity.evaluate(() => {
      const h = __drift.TALE.hot.find((x) => x.v === 'voucher');
      if (!h) return null;
      __drift.taleFound(h);
      return h.v;
    });
    const found = clue && await wr.waitForFunction(() => window.__storyrunner.varOf('voucher') === true
      && window.__storyrunner.state.choices.includes('Go to the emigration gate'), null, { timeout: 30000 })
      .then(() => wr.evaluate(() => ({ choices: window.__storyrunner.state.choices,
        told: window.__storyrunner.state.prose.some((p) => /The voucher is the Org's/.test(p.text || p)) })), () => null);
    const hotAfter = await wcity.waitForFunction(() => !__drift.TALE.hot.some((x) => x.v === 'voucher'), null, { timeout: 15000 })
      .then(() => true, () => false);
    found && !found.choices.includes('Look around') && found.told && hotAfter
      ? pass('a clue found in the city (the voucher) sets its VAR in the story, which re-enters the street: the voucher text, no "Look around", the way to the gate; the city does not offer it again')
      : fail(`found in the city: ${JSON.stringify({ clue, found, hotAfter })}`);

    // 18. variables both ways, through the shell
    await wr.waitForFunction(() => !!window.__storyrunner.varOf('hour'), null, { timeout: 30000 }).catch(() => {});
    const h0 = await wr.evaluate(() => window.__storyrunner.varOf('hour'));
    const sent = await wr.evaluate(() => window.foaf.storyRequest('story.world', { op: 'vars', values: { want_time: 'dusk', heard_mags: true } }));
    const h1 = await wr.waitForFunction(() => window.__storyrunner.varOf('hour') === 'dusk', null, { timeout: 30000 })
      .then(() => 'dusk', () => wr.evaluate(() => window.__storyrunner.varOf('hour')));
    h0 && sent?.sent === 1 && h1 === 'dusk'
      ? pass(`the city writes hour into the story ("${h0}"); want_time=dusk reaches the city (the shell sends only the row's read list: 1 of 2), and the city answers hour=dusk`)
      : fail(`variables: ${JSON.stringify({ h0, sent, h1 })}`);

    // 19. a choice moves the city; a recorded line resolves against the story's own address
    await chooseText(wr, 'Go into the Cold Tap and ask Mags');
    const c2 = await wcity.waitForFunction(() => __drift.TALE.scene === 'mags', null, { timeout: 30000 })
      .then(() => wcity.evaluate(() => ({ place: __drift.TALE.place, speech: __drift.TALE.speech?.el?.src || '' })), () => null);
    c2 && c2.place === 'cold_tap' && /drift-city\/audio\/cast\/mags-\d\.mp3$/.test(c2.speech)
      ? pass(`a choice in the story moves the city to the Cold Tap, and Mags's recorded line plays in the city from the story's path (${c2.speech.split('/').slice(-3).join('/')})`)
      : fail(`after the choice: ${JSON.stringify(c2)}`);

    // 19b. the shell plays the line, not the city's frame (a new frame has had no tap on iOS),
    // and sends the play time back: the talking head is open and its clock runs
    const sp = await wcity.waitForFunction(() => {
      const el = __drift.TALE.speech?.el;
      return el && !(el instanceof HTMLMediaElement) && !el.paused && el.currentTime > 0.3 && __drift.HEADS.who;
    }, null, { timeout: 30000 }).then(() => wcity.evaluate(() => ({ t: +__drift.TALE.speech.el.currentTime.toFixed(2), who: __drift.HEADS.who })), () => null);
    sp && sp.who === 'mags'
      ? pass(`the shell plays Mags's line and sends its play time back (${sp.t}s): the city has no audio element of its own for it, and her head shows`)
      : fail(`shell speech: ${JSON.stringify({ sp, s: await wcity.evaluate(() => ({ src: __drift.TALE.speech?.el?.src, paused: __drift.TALE.speech?.el?.paused, who: __drift.HEADS.who })) })}`);

    // 20. the city's menu leaves the story and the sound to foafos
    const labels = await wcity.evaluate(() => {
      document.getElementById('bMenu').click();
      const l = [...document.querySelectorAll('#goPanel .rows .rl')].map((e) => e.textContent);
      document.getElementById('bMenu').click();
      return l;
    });
    labels.length > 3 && !labels.includes('Story') && !labels.includes('Sound')
      ? pass(`the city's menu has no Story and no Sound: the story is the runner's and the volume is the shell's (${labels.length} items)`)
      : fail(`city menu: ${JSON.stringify(labels)}`);

    // 20a. THE CITY'S MENU IS THE SHELL'S (spec §5.9; owner, September 2026: "The settings we had in a hamburger menu
    // should be formalised via foafos menuing"). Inside foafos the city draws no ☰ of its own; its rows arrive as
    // actions, the shell's one window menu draws them, and a choice there runs the city's row.
    const acts = await wpage.waitForFunction(() => (window.FinkWM?._appActions || []).length > 3, null, { timeout: 15000 })
      .then(() => wpage.evaluate(() => FinkWM._appActions.map((a) => a.label)), () => []);
    const cityBurger = await wcity.evaluate(() => document.getElementById('bMenu').hidden);
    const night = () => wpage.evaluate(() => {
      const tw = (FinkWM._appActions || []).find((a) => a.label === 'Time and weather');
      return tw?.items?.find((a) => a.label === 'Night') || null;
    });
    const before = await night();
    const ran = before ? await wpage.evaluate((id) => FinkMinigames.runAction(id), before.id) : false;
    const after = await wpage.waitForFunction(() => {
      const tw = (window.FinkWM?._appActions || []).find((a) => a.label === 'Time and weather');
      return tw?.items?.find((a) => a.label === 'Night')?.checked === true;
    }, null, { timeout: 10000 }).then(() => true, () => false);
    const forged = await wpage.evaluate(() => FinkMinigames.runAction('menu/Developer/Forget the saved story (not offered)'));
    cityBurger && acts.includes('Time and weather') && acts.includes('Travel') && before && ran && after && !forged
      ? pass(`the city has no ☰ of its own in foafos; its menu is the shell's (${acts.length} rows: ${acts.slice(0, 4).join(' · ')} …), and Time and weather › Night chosen there sets the city's night`)
      : fail(`city menu as actions: ${JSON.stringify({ cityBurger, acts, before, ran, after, forged })}`);

    // 20c. NOTHING OF THE CITY'S OWN OVER ITS VIEW (owner, September 2026: "other bits of random ui on screen";
    // "Promote them into foafos"). Its readout is the shell's, with where the camera is on Titan (IAU_2015:60600);
    // a pick is a selection the shell shows with its actions; a hint is a line in the shell's activity stream.
    const hostUi = await wcity.evaluate(() => ({ ui: getComputedStyle(document.getElementById('ui')).display,
      where: __drift.titanWhere(), p0: __drift.titanPoint(0, 0, 0), pN: __drift.titanPoint(0, 0, -5000) }));
    const status = await wpage.waitForFunction(() => (FoafOS.bus.retained('app.drift.status')[0]?.data?.items || []).length > 1,
      null, { timeout: 15000 }).then(() => wpage.evaluate(() => FoafOS.bus.retained('app.drift.status')[0].data.items), () => null);
    const northKm = (hostUi.pN.lat - hostUi.p0.lat) * Math.PI / 180 * 2575;
    hostUi.ui === 'none' && status?.some((it) => it.id === 'at' && /°[NS] .*°[EW]$/.test(it.value))
      && hostUi.where.crs === 'IAU_2015:60600' && hostUi.p0.lat === 58 && hostUi.p0.lon === 42 && Math.abs(northKm - 5) < 0.01
      && typeof hostUi.where.view?.az === 'number'
      ? pass(`the city's readout is the shell's (${status.map((it) => it.value).join(' · ')}); positions in IAU_2015:60600: the city at 58°N 42°E (318°W), 5 km north is ${northKm.toFixed(3)} km of latitude, the camera looks at azimuth ${hostUi.where.view.az}°`)
      : fail(`readout and coordinates: ${JSON.stringify({ ui: hostUi.ui, status, where: hostUi.where, northKm })}`);
    await wcity.evaluate(() => __drift.pickGo(innerWidth / 2, innerHeight * 0.62, false));
    const sel = await wpage.waitForFunction(() => FoafOS.bus.retained('app.drift.selection')[0]?.data?.entity, null, { timeout: 10000 })
      .then(() => wpage.evaluate(() => ({ e: FoafOS.bus.retained('app.drift.selection')[0].data.entity,
        card: !document.getElementById('foafos-selection').hidden,
        buttons: [...document.querySelectorAll('#foafos-selection .sel-actions button')].map((b) => b.textContent) })), () => null);
    const flew = sel ? await wpage.evaluate(() => { document.querySelector('#foafos-selection [data-action="pick:fly"]')?.click(); return true; }) : false;
    const visiting = flew && await wcity.waitForFunction(() => __drift.NAV.mode === 'visit' && __drift.NAV.visit?.look, null, { timeout: 10000 }).then(() => true, () => false);
    sel?.card && /^(building|place|person|vehicle):/.test(sel.e.id) && sel.e.where?.crs === 'IAU_2015:60600'
      && sel.buttons.includes('Fly there') && visiting
      ? pass(`a pick is a selection in the shell: ${sel.e.kind} "${sel.e.name}" (${sel.e.id}, ${sel.e.where.lat.toFixed(4)}°N ${sel.e.where.lon.toFixed(4)}°E), with ${sel.buttons.join(' / ')}; Fly there flies`)
      : fail(`selection: ${JSON.stringify({ sel, visiting })}`);
    // 20d. THE CITY'S OWN PAUSE (owner, September 2026: "an in-game pause at top of main menu (different to foafos
    // pause …)"; while paused, "neighbouring pickables might also be highlighted in ways that allow a simple tap to
    // make them the highlighted entity"). The first row of the city's menu stops the world clock and not the view;
    // a selection's neighbours get rings, and a tap on one makes it the selection.
    const first = await wpage.evaluate(() => (FinkWM._appActions || [])[0] || null);
    const pRan = first ? await wpage.evaluate((id) => FinkMinigames.runAction(id), first.id) : false;
    const paused = await wcity.waitForFunction(() => __drift.CITYP.on, null, { timeout: 10000 }).then(() => true, () => false);
    const w0 = await wcity.evaluate(() => [__drift.wclock(), __drift.now()]);
    await wpage.waitForTimeout(1200);
    const w1 = await wcity.evaluate(() => [__drift.wclock(), __drift.now()]);
    await wcity.evaluate(() => __drift.pickGo(innerWidth / 2, innerHeight * 0.62, false));
    const rings = await wcity.waitForFunction(() => document.querySelectorAll('.pickNear:not([hidden])').length > 0, null, { timeout: 10000 })
      .then(() => wcity.evaluate(() => document.querySelectorAll('.pickNear:not([hidden])').length), () => 0);
    const selId0 = await wpage.evaluate(() => FoafOS.bus.retained('app.drift.selection')[0]?.data?.entity?.id);
    const ringName = rings ? await wcity.evaluate(() => { const r = document.querySelector('.pickNear:not([hidden])'); const n = r.getAttribute('aria-label'); r.click(); return n; }) : null;
    const selId1 = await wpage.waitForFunction((a) => { const id = FoafOS.bus.retained('app.drift.selection')[0]?.data?.entity?.id; return id && id !== a ? id : null; },
      selId0, { timeout: 10000 }).then((h) => h.jsonValue(), () => null);
    await wpage.evaluate((id) => FinkMinigames.runAction(id), first?.id);
    const resumed = await wcity.waitForFunction(() => !__drift.CITYP.on && document.querySelectorAll('.pickNear').length === 0, null, { timeout: 10000 }).then(() => true, () => false);
    /^Pause the city/.test(first?.label || '') && first?.closes === true && pRan && paused && w1[0] === w0[0] && w1[1] > w0[1] && rings > 0 && selId1 && resumed
      ? pass(`the city's menu starts with "${first.label}" (it closes the window menu, so the view is free to tap): the world's clock stops (${w0[0].toFixed(2)} s, still after 1.2 s) while the page's goes on; the selection's neighbours get ${rings} rings, and a tap on "${ringName}" makes it the selection (${selId1}); unpausing clears them`)
      : fail(`city pause: ${JSON.stringify({ first: first?.label, pRan, paused, w0, w1, rings, selId0, selId1, resumed })}`);
    // 20e. the map overlay (owner, September 2026: "see map overlaid on the 3D"): a row of the city's Map menu in
    // the shell's window menu; it lays the districts' and places' names over the view, and turns off again
    const mapRow = await wpage.evaluate(() => (FinkWM._appActions || []).find((a) => a.label === 'Map')?.items?.find((x) => /^Map overlay/.test(x.label)) || null);
    if (mapRow) await wpage.evaluate((id) => FinkMinigames.runAction(id), mapRow.id);
    const mapLabels = await wcity.waitForFunction(() => document.querySelectorAll('.mapLabel:not([hidden])').length > 2, null, { timeout: 10000 })
      .then(() => wcity.evaluate(() => [...document.querySelectorAll('.mapLabel:not([hidden])')].map((e) => e.textContent)), () => []);
    if (mapRow) await wpage.evaluate((id) => FinkMinigames.runAction(id), mapRow.id);
    const cleared = await wcity.waitForFunction(() => document.querySelectorAll('.mapLabel').length === 0, null, { timeout: 10000 }).then(() => true, () => false);
    mapRow?.closes === true && mapLabels.length > 2 && cleared
      ? pass(`Map › Map overlay lays names over the city (${mapLabels.length} in view: ${mapLabels.slice(0, 4).join(', ')} …) and takes them away again`)
      : fail(`map overlay: ${JSON.stringify({ mapRow, mapLabels, cleared })}`);
    // 20f. a person has a home and a workplace, real buildings of the city, the same ones every time (owner,
    // September 2026: "persistent identities for each including apartment blocks, jobs"); names wait for the owner
    const who = await wcity.evaluate(() => { const w = __drift.walkersNear(__drift.st.x, __drift.st.z, 200, __drift.wclock())[0];
      if (!w) return null; __drift.pickSelect({ name: 'someone', x: w.x, z: w.z, y0: 0, r: 4, h: 2.2, person: w }); return w.id; });
    const card = who === null ? null : await wpage.waitForFunction(() => document.querySelectorAll('#foafos-selection .sel-fact').length > 0, null, { timeout: 10000 })
      .then(() => wpage.evaluate(() => ({ facts: [...document.querySelectorAll('#foafos-selection .sel-fact')].map((e) => e.textContent),
        btns: [...document.querySelectorAll('#foafos-selection .sel-actions button')].map((b) => b.textContent) })), () => null);
    const home = card ? await wpage.evaluate(() => { document.querySelector('#foafos-selection [data-action="pick:home"]')?.click(); return true; })
      .then(() => wpage.waitForFunction(() => FoafOS.bus.retained('app.drift.selection')[0]?.data?.entity?.kind === 'building', null, { timeout: 10000 }))
      .then(() => wpage.evaluate(() => FoafOS.bus.retained('app.drift.selection')[0].data.entity.name), () => null) : null;
    card && card.facts.some((f) => /^Home: /.test(f)) && card.btns.includes('Their home') && home && card.facts[0].endsWith(home)
      ? pass(`a person has a home and a workplace in the city (${card.facts.join('; ')}); "Their home" selects it`)
      : fail(`person's places: ${JSON.stringify({ who, card, home })}`);
    // the talking head's line (section 19) went to the shell's activity stream, and its face with it
    // the feed has it once the line has ended; while it plays it is the live card on screen
    const stream = await wpage.evaluate(() => [...document.querySelectorAll('#foafos-feed-wrap foaf-activity, #foafos-activity foaf-activity')]
      .map((c) => ({ label: c.getAttribute('aria-label'), img: !!c.shadowRoot?.querySelector('.face img, .face canvas') })));
    const mags = stream.find((c) => /^Mags/.test(c.label || ''));
    const headOff = await wcity.evaluate(() => !document.querySelector('.headFeed') || document.querySelector('.headFeed').classList.contains('hostOff')
      || document.querySelector('.headFeed').hidden);
    mags && headOff
      ? pass(`the talking head speaks in the shell's activity stream ("${mags.label.slice(0, 60)}…"${mags.img ? ', with a still of the face' : ''}), not over the view`)
      : fail(`activity stream: ${JSON.stringify({ stream: stream.slice(0, 4), headOff })}`);
    // the stream in a window the shell manages (owner, September 2026: its items "only render within monolithic
    // World pane, not managed in foafos"): opened from the window menu, it holds the history (Mags's line among
    // it) and the new items, and while it is open nothing is drawn over the app's pane
    await wpage.evaluate(() => document.getElementById('wm-sys-activity').click());
    const actWin = await wpage.waitForSelector('#foafos-activity-win', { timeout: 5000 }).then(() => true, () => false);
    await wpage.evaluate(() => FoafOS.postActivity('drift', { who: 'Test', text: 'a line for the window' }, 'Drift City'));
    const act = await wpage.evaluate(() => ({
      live: [...document.querySelectorAll('#foafos-activity-win .act-live foaf-activity')].map((c) => c.getAttribute('aria-label')),
      hist: [...document.querySelectorAll('#foafos-activity-win foafos-feed foaf-activity')].map((c) => c.getAttribute('aria-label')),
      overPane: document.querySelectorAll('#foafos-activity .foafos-activity-item').length }));
    actWin && act.live.some((l) => /a line for the window/.test(l || '')) && [...act.live, ...act.hist].some((l) => /^Mags/.test(l || '')) && act.overPane === 0
      ? pass(`the activity stream has a window of its own in foafos (window menu › Activity): new items go there (${act.live.length}), the history is there (${act.hist.length}), and Mags's line with them (a live line joins the history when it ends), and nothing is drawn over the city`)
      : fail(`activity window: ${JSON.stringify({ actWin, act })}`);
    await wpage.evaluate(() => document.getElementById('foafos-activity-win')?.remove());

    // 20b. the city never plays its own story beside a foafos one. Field report, September 2026: "The tea stall
    // story ink ui seems to use its builtin ink engine": the opening flight's end, the Story button and the t key
    // all opened the city's own story panel, over the runner's story.
    const own = await wcity.evaluate(() => {
      const b = document.getElementById('bTale');
      const btnHidden = !!b && (b.hidden || getComputedStyle(b).display === 'none');
      __drift.taleOpen();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
      __drift.taleLink('lamplighter.fink.js');
      return { btnHidden, on: __drift.TALE.on, panelHidden: document.getElementById('tale').hidden, story: !!__drift.TALE.story };
    });
    own.btnHidden && !own.on && own.panelHidden && !own.story
      ? pass('as a world the city has no Story button, and its own story player does not open (taleOpen, the t key, a link)')
      : fail(`city's own story in world mode: ${JSON.stringify(own)}`);

    // 21. closing the city tells the story, which goes on as text
    const wid = await wpage.evaluate(() => [...FoafOS.apps.nodes.values()].find((x) => x.appId === 'drift')?.id);
    await wpage.evaluate((id) => FoafOS.apps.close(id), wid);
    const told = await wr.waitForFunction(() => window.__storyrunner.state.world === null, null, { timeout: 15000 }).then(() => true, () => false);
    const still = await choices(wr);
    const fullAgain = await wpage.evaluate(() => !document.querySelector('.foafos-window iframe[src*="storyrunner"]')
      ?.closest('.foafos-window')?.classList.contains('foafos-with-world'));
    told && still.length > 0 && fullAgain
      ? pass('closing the city tells the story (world.closed); the story goes on as text, with its choices, and has the whole screen again')
      : fail(`after closing the city: ${JSON.stringify({ told, still, fullAgain })}`);

    // 21b. and the reader can have it back. Field report, September 2026: "After closing World pane, i cant get it
    // back." The runner offers it again; the city is rebuilt from the lines it was last sent.
    const offer = await wr.evaluate(() => { const b = document.getElementById('world-open'); return b && !b.hidden ? b.getAttribute('aria-label') : null; });
    await wr.evaluate(() => document.getElementById('world-open')?.click());
    const back = await wr.waitForFunction(() => window.__storyrunner.state.world === 'drift', null, { timeout: 15000 }).then(() => true, () => false);
    const wcity2 = back ? await frameMatching(wpage, /drift-city\/dist\/city\.html\?world=1$/) : null;
    const rebuilt = wcity2 && await wcity2.waitForFunction(() => (window.__drift?.TALE?.worldBeats || 0) > 0 && !!window.__drift.TALE.scene,
      null, { timeout: 90000 }).then(() => wcity2.evaluate(() => __drift.TALE.scene), () => null);
    const hiddenAgain = await wr.evaluate(() => document.getElementById('world-open').hidden);
    offer && back && rebuilt && hiddenAgain
      ? pass(`a closed world can be opened again from the story ("${offer}"); the city comes back in the scene ${rebuilt}`)
      : fail(`reopen the world: ${JSON.stringify({ offer, back, rebuilt, hiddenAgain })}`);
    werrs.length === 0 ? pass('world: no page errors') : fail(`world page errors: ${werrs.slice(0, 3).join(' · ')}`);
    await wpage.close();
  }

  // 22-23. the world comes back with the story: Per Aspera opened directly
  // (the save wins only when the address names the same story file)
  {
    const rpage = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    const rerrs = [];
    rpage.on('pageerror', (e) => rerrs.push(String(e).slice(0, 200)));
    await rpage.goto(`${BASE}/inklet/finkapp/?story=/${repoName}/drift-city/story/peraspera.fink.js`);
    const r1 = await runnerOf(rpage);
    await r1.waitForFunction(() => window.__storyrunner?.ready?.() && window.__storyrunner.state.choices.length > 0, null, { timeout: 30000 });
    // opened directly, the story starts at its opening: the runner used to follow its own first position report as
    // a deep link and enter the opening knot twice, so the reader saw the second-visit text
    const opening = await r1.evaluate(() => (window.__storyrunner.state.prose[0]?.text || '').slice(0, 40));
    /^Night on Ferry Street/.test(opening)
      ? pass('Per Aspera opened directly starts with its opening text, not its second-visit text')
      : fail(`opening text: "${opening}"`);
    const rc1 = await frameMatching(rpage, /drift-city\/dist\/city\.html\?world=1$/);
    if (!rc1) throw new Error('Per Aspera opened directly did not open its world');
    await rc1.waitForFunction(() => (window.__drift?.TALE?.worldBeats || 0) > 0, null, { timeout: 90000 });
    await chooseText(r1, 'Go down to the Lantern Cellar, Chinatown');
    await rc1.waitForFunction(() => __drift.TALE.scene === 'cellar', null, { timeout: 30000 }).catch(() => {});
    await wait(500);
    await rpage.evaluate(() => document.querySelector('.foafos-window iframe[src*="storyrunner"]')
      ?.closest('.foafos-window')?.querySelector('.foafos-window-close')?.click());
    await rpage.waitForFunction(() => ![...FoafOS.apps.nodes.values()].some((n) => n.appId === 'drift'), null, { timeout: 15000 }).catch(() => {});
    await wait(1500);
    const saved = await rpage.evaluate(() => {
      const raw = (FoafOS.store.snapshot(FoafOS.snapshotNs) || {})['app:storyrunner'];
      try { return JSON.parse(raw); } catch { return null; }
    });
    const cityGone = await rpage.evaluate(() => ![...FoafOS.apps.nodes.values()].some((n) => n.appId === 'drift'));
    saved?.world?.tag === 'drift' && cityGone
      && (saved.world.lines || []).some((l) => (l.tags || []).some((t) => /^scene:\s*cellar/.test(t)))
      ? pass('closing the story window closes its city too, and the kept place holds the world: its tag and the lines sent, up to the cellar scene')
      : fail(`kept world: ${JSON.stringify({ world: saved?.world ? { tag: saved.world.tag, lines: saved.world.lines?.length } : null, cityGone })}`);

    await rpage.evaluate(() => FoafOS.launchApp('storyrunner'));
    const r2 = await runnerOf(rpage);
    const resumed = r2 && await r2.waitForFunction(() => window.__storyrunner?.state?.resumedFromSave, null, { timeout: 30000 }).then(() => true, () => false);
    const rc2 = await frameMatching(rpage, /drift-city\/dist\/city\.html\?world=1$/);
    const back = rc2 && await rc2.waitForFunction(() => window.__drift?.TALE?.scene === 'cellar', null, { timeout: 90000 })
      .then(() => rc2.evaluate(() => ({ scene: __drift.TALE.scene, place: __drift.TALE.place })), () => null);
    resumed && back?.scene === 'cellar' && back.place === 'lantern_cellar'
      ? pass('reopening the story resumes it and reopens its world; the replay puts the city back at the cellar')
      : fail(`restore: ${JSON.stringify({ resumed, back })}`);
    rerrs.length === 0 ? pass('restore: no page errors') : fail(`restore page errors: ${rerrs.slice(0, 3).join(' · ')}`);
    await rpage.close();
  }

  // 24-27. controls from foafos: two analog sticks on a touch phone, and a gamepad
  {
    const tpage = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const terrs = [];
    tpage.on('pageerror', (e) => terrs.push(String(e).slice(0, 200)));
    await tpage.goto(`${BASE}/inklet/finkapp/?story=/${repoName}/drift-city/story/peraspera.fink.js`);
    const tr = await runnerOf(tpage);
    await tr.waitForFunction(() => window.__storyrunner?.ready?.() && window.__storyrunner.state.choices.length > 0, null, { timeout: 30000 });
    const tc = await frameMatching(tpage, /drift-city\/dist\/city\.html\?world=1$/);
    if (!tc) throw new Error('no city on the phone page');
    await tc.waitForFunction(() => window.__drift?.host?.().sticks === true, null, { timeout: 90000 });
    await wait(500);
    // 24. the foafos pad shows two sticks, over the city and above the story; the city hides its own
    const pad = await tpage.evaluate(() => {
      const p = document.getElementById('foaf-pad');
      const w = document.querySelector('.foafos-window iframe[src*="storyrunner"]')?.closest('.foafos-window');
      return { hidden: p.hidden, sticks: p.classList.contains('sticks'),
        dir: getComputedStyle(p.querySelector('.foaf-pad-dir')).display,
        stickW: Math.round(p.querySelector('.foaf-stick-r').getBoundingClientRect().width),
        pad: [Math.round(p.getBoundingClientRect().top), Math.round(p.getBoundingClientRect().bottom)],
        stage: [Math.round(document.getElementById('minigame-view').getBoundingClientRect().top), Math.round(document.getElementById('minigame-view').getBoundingClientRect().bottom)],
        story: [Math.round(w.getBoundingClientRect().top), Math.round(w.getBoundingClientRect().bottom)],
        dock: [Math.round(document.getElementById('foafos-dock').getBoundingClientRect().top), Math.round(document.getElementById('foafos-dock').getBoundingClientRect().bottom)],
        dockHidden: getComputedStyle(document.getElementById('foafos-dock')).display === 'none',
        mode: document.body.dataset.stageMode };
    });
    const own = await tc.evaluate(() => ({ on: __drift.PAD.on, hidden: document.getElementById('pad')?.hidden !== false }));
    const within = (x, box) => x[0] >= box[0] - 1 && x[1] <= box[1] + 1;
    !pad.hidden && pad.sticks && pad.dir === 'none' && pad.stickW > 60 && pad.mode === 'split' && within(pad.pad, pad.stage)
      && !own.on && own.hidden && pad.dockHidden
      ? pass(`on a phone a world opens split; the foafos pad shows two sticks over the city (pad ${pad.pad.join('-')}, city ${pad.stage.join('-')}, story ${pad.story.join('-')}); the city's own sticks are hidden; the ⊞ dock steps aside while the window menu is there`)
      : fail(`foafos sticks: ${JSON.stringify({ pad, own })}`);

    // 25. a thumb on the right stick moves the city; lifting it stops it
    const box = await tpage.evaluate(() => {
      const r = document.querySelector('#foaf-pad .foaf-stick-r').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height };
    });
    await tpage.mouse.move(box.x, box.y);
    await tpage.mouse.down();
    await tpage.mouse.move(box.x, box.y - box.h * 0.45, { steps: 4 });
    const ry = await tc.waitForFunction(() => __drift.PAD.ry > 0.5, null, { timeout: 10000 })
      .then(() => tc.evaluate(() => __drift.PAD.ry), () => tc.evaluate(() => __drift.PAD.ry));
    await tpage.mouse.up();
    const stopped = await tc.waitForFunction(() => __drift.PAD.ry === 0 && __drift.PAD.rx === 0, null, { timeout: 10000 })
      .then(() => true, () => false);
    ry > 0.5 && stopped
      ? pass(`the right stick pushed up reaches the city as a value (ry ${ry.toFixed(2)}), and lifting the thumb sends zeros`)
      : fail(`stick drag: ${JSON.stringify({ ry, stopped })}`);

    // 26. a gamepad: both sticks as values (y turned so up is +), and the on-screen pad retires
    await tpage.evaluate(() => {
      const gp = { index: 0, id: 'Test Pad (Standard)', connected: true, mapping: 'standard',
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0.6, 0, 0, -0.9] };
      window.__fakePad = gp;
      navigator.getGamepads = () => [gp];
      const ev = new Event('gamepadconnected');
      ev.gamepad = gp;
      window.dispatchEvent(ev);
    });
    const g = await tc.waitForFunction(() => __drift.PAD.lx > 0.4 && __drift.PAD.ry > 0.8, null, { timeout: 10000 })
      .then(() => tc.evaluate(() => ({ lx: __drift.PAD.lx, ry: __drift.PAD.ry })), () => tc.evaluate(() => ({ lx: __drift.PAD.lx, ry: __drift.PAD.ry })));
    const retired = await tpage.evaluate(() => document.getElementById('foaf-pad').hidden);
    g.lx > 0.4 && g.ry > 0.8 && retired
      ? pass(`a gamepad's two sticks reach the city (lx ${g.lx.toFixed(2)}, ry ${g.ry.toFixed(2)}: its up is +), and the on-screen pad retires`)
      : fail(`gamepad sticks: ${JSON.stringify({ g, retired })}`);

    // 27. unplugged, the sticks go back to zero: a stick left pushed must not keep the city moving
    await tpage.evaluate(() => { navigator.getGamepads = () => []; window.dispatchEvent(new Event('gamepaddisconnected')); });
    const zeroed = await tc.waitForFunction(() => !__drift.PAD.lx && !__drift.PAD.ly && !__drift.PAD.rx && !__drift.PAD.ry, null, { timeout: 10000 })
      .then(() => true, () => false);
    const padBack = await tpage.waitForFunction(() => !document.getElementById('foaf-pad').hidden, null, { timeout: 5000 })
      .then(() => true, () => false);
    zeroed && padBack && terrs.length === 0
      ? pass('unplugging the gamepad sends zeros, and the on-screen pad comes back; no page errors')
      : fail(`unplugged: ${JSON.stringify({ zeroed, padBack, terrs: terrs.slice(0, 2) })}`);
    await tpage.close();
  }

  // 14. with WebGPU (Dawn's SwiftShader adapter, software): the head is posed
  // in a WGSL compute pass and drawn with WebGPU, in the same sandboxed frame
  const gpuBrowser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan',
      '--use-vulkan=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  try {
    const gpage = await gpuBrowser.newPage({ viewport: { width: 900, height: 700 } });
    const gerrs = [];
    gpage.on('pageerror', (e) => gerrs.push(String(e).slice(0, 200)));
    await gpage.goto(`${BASE}/inklet/finkapp/?story=/${repoName}/drift-city/foafos-entry.fink.js`);
    const grunner = await runnerOf(gpage);
    await grunner.waitForFunction(() => window.__storyrunner?.ready?.() && window.__storyrunner.state.choices.length > 0, null, { timeout: 30000 });
    await chooseText(grunner, 'Go into the Cold Tap and ask Mags');
    const gfeed = await frameMatching(gpage, /drift-city\/feed\/index\.html\?line=mags-1$/);
    const g = gfeed && await gfeed.waitForFunction(() => window.__feed?.HEADS.r?.kind && window.__feed.HEADS.frames >= 3, null, { timeout: 30000 })
      .then(() => gfeed.evaluate(() => ({ kind: __feed.HEADS.r.kind, frames: __feed.HEADS.frames, fail: __feed.HEADS.fail })), () => null);
    g?.kind === 'webgpu' && !g.fail && gerrs.length === 0
      ? pass(`with WebGPU, the head is posed in a compute pass and drawn with WebGPU inside the sandboxed frame (${g.frames} frames on a software adapter)`)
      : fail(`WebGPU head: ${JSON.stringify({ g, gerrs: gerrs.slice(0, 2) })}`);
  } finally { await gpuBrowser.close(); }

  console.log(process.exitCode ? '\nDRIFT APPS E2E: FAIL' : '\nDRIFT APPS E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 400)}`);
  console.log('\nDRIFT APPS E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
