#!/usr/bin/env node
// `# APP:` in the boxed story runner (docs/foafos-apps-20261022.md, section 6).
//
//   · then=wait (the default) pauses the story, sends story.launch WITHOUT the
//     then= key, and resumes with the game's result
//   · then=beside opens the app beside the story (the # WORLD: path) and the
//     story goes on
//   · then=go to an app that does not exist is refused out loud, and the story goes on
//     (then=go to the playlist, a single-instance app: e2e-apps-demo.mjs)
//   · the old name, # MINIGAME:, still pauses and launches
//
//   node inklet/finkapp/test/e2e-app-tag.mjs
// Fixture: inklet/apps/storyrunner/app-tag.fink.js

import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { serve } from '../../../magpie/miniapps/test/serve.mjs';
import { openStory, goto } from './lib/story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoName = basename(join(here, '..', '..', '..'));
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let failures = 0;
const pass = (m) => console.log('✔', m);
const fail = (m) => { console.error('✖', m); failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 20000) {
  for (let t = 0; t < ms; t += 200) { try { const v = await fn(); if (v) return v; } catch { /* not yet */ } await wait(200); }
  return null;
}

const srv = await serve(0);
const base = srv.url.replace(/\/glitchcan-minigam$/, '');
const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

try {
  const r = await openStory(page, base, repoName, 'inklet/apps/storyrunner/app-tag.fink.js');
  // openStory returns at the first choices, but the runner's boot (a 140 ms wait for a
  // restore, then boot and the deep link) can still restart the story after that, and a
  // goto made in between is lost. Wait until the reading has been still for a second.
  let last = '';
  for (let still = 0; still < 5;) {
    const now = await r.evaluate(() => JSON.stringify(window.__storyrunner.state.prose));
    still = now === last ? still + 1 : 0; last = now; await wait(200);
  }
  const st = () => r.evaluate(() => {
    const s = window.__storyrunner.state;
    return { paused: window.__storyrunner.paused(), pausedFor: s.pausedFor, world: s.world,
      launches: s.requests.filter((q) => q.verb === 'story.launch').map((q) => q.detail),
      choices: s.choices.length, status: document.getElementById('status')?.textContent || '',
      prose: s.prose.map((p) => p.text).join(' | ') };
  });

  // then=go to an app that does not exist: refused out loud, the story goes
  // on, nothing is launched.
  await goto(r, 'go');
  let s = await until(async () => { const x = await st(); return /goes on at once/.test(x.prose) && /refused/.test(x.status) && x; });
  s && !s.paused && s.choices > 0 && s.launches.length === 0 && /player: open refused \(unknown-app\)/.test(s.status)
    ? pass(`then=go: the story goes on and says why nothing opened ("${s.status}")`)
    : fail(`then=go: ${JSON.stringify(s || await st())}`);

  // then=wait: pause, launch without then=, resume with the result.
  const playGame = async (knot, label) => {
    const before = (await st()).launches.length;
    // The then=go step leaves "refused" in the status line; clear it, or the
    // wait below takes that old line for this step's refusal.
    await r.evaluate(() => { const el = document.getElementById('status'); if (el) el.textContent = ''; });
    await goto(r, knot);
    const p = await until(async () => { const x = await st(); return x.launches.length > before && (x.pausedFor || /refused/.test(x.status)) && x; });
    const req = p?.launches.at(-1);
    p && p.pausedFor === 'waterworld' && p.choices === 0 && req.game === 'waterworld' && !('then' in (req.args || {}))
      ? pass(`${label}: the story pauses and asks the shell for waterworld (args ${JSON.stringify(req.args)})`)
      : fail(`${label}: ${JSON.stringify(p)}`);
    const guest = await until(() => page.frames().find((f) => /waterworld/.test(f.url())), 20000);
    if (!guest) { fail(`${label}: no waterworld frame`); return; }
    await guest.evaluate(() => parent.postMessage({ type: 'complete', result: { success: true, score: 7, variables: {} } }, '*'));
    const done = await until(async () => { const x = await st(); return !x.paused && /Back from the game: true, score 7/.test(x.prose) && x; });
    done ? pass(`${label}: the game's result comes back and the story goes on`) : fail(`${label}: did not resume: ${JSON.stringify(await st())}`);
  };
  await playGame('waiting', '# APP: (then=wait)');
  await playGame('oldname', '# MINIGAME: (the old name)');

  // then=beside, last: the world it opens stays on the stage.
  const launchesBefore = (await st()).launches.length;
  await goto(r, 'beside');
  s = await until(async () => { const x = await st(); return /beside the story/.test(x.prose) && x; });
  s && s.world === 'drift' && !s.paused && s.choices > 0 && s.launches.length === launchesBefore
    ? pass('then=beside: the app opens beside the story (the # WORLD: path) and the story goes on')
    : fail(`then=beside: ${JSON.stringify(s)}`);
  const worldArgs = await r.evaluate(() => window.__storyrunner.state.world);
  worldArgs === 'drift' ? pass('then= was not passed on as an app argument (the world is "drift")') : fail(`world: ${worldArgs}`);

  const mine = pageErrors.filter((e) => !/caches/.test(e));
  mine.length === 0 ? pass('no page errors') : fail(`page errors: ${mine.join(' | ')}`);
} catch (e) {
  fail(`threw: ${e.message}`);
} finally {
  await browser.close();
  await srv.close();
}
console.log(failures ? `\n${failures} FAILURE(S)` : '\nall passed');
process.exit(failures ? 1 : 0);
