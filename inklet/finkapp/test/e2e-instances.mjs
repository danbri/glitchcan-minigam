#!/usr/bin/env node
// Multiple guests at once, safely.
//
//   node inklet/finkapp/test/e2e-instances.mjs
//
// Reported from the field: "when we run entire little apps in this env
// they can be multiply instantiated yet only show up as one in window
// list". The window list was the visible symptom; underneath, NOTHING
// distinguished one running guest from another.
//
// Both message paths were bare `window.addEventListener('message', …)`
// with no `event.source` check. So:
//   · two copies of a widget each ran BOTH handlers — one gem counted twice
//   · they shared one `lastSync`, so each report was measured against the
//     other's total and the story's diamonds walked
//   · closing one removed the listener the other was still using
//   · ANY frame on the page could post `set-variable` and have it applied
//     with whatever grants the focused guest happened to hold, which
//     makes the manifest capability model decorative
//
// A manifest attached to a TYPE means nothing if the host cannot tell
// which frame is speaking. This locks that it now can.

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8153;
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

  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?story=/${repoName}/inklet/hampstead.fink.js`);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
  await page.waitForTimeout(1200);

  // Two copies of the SAME widget, side by side, plus one of another
  // type — the shape the field report described.
  // 'inline' display auto-starts; the caller owns DOM insertion.
  await page.evaluate(() => {
    const host = document.getElementById('story-output') || document.body;
    for (const t of ['mudslider', 'mudslider', 'gridluck']) {
      host.appendChild(FinkMinigames.createInlineContainer(t, 'inline'));
    }
  });
  await page.waitForFunction(() => FinkMinigames.instances.size >= 3, null, { timeout: 20000 });

  const roster = await page.evaluate(() => [...FinkMinigames.instances.values()]
    .map(i => ({ id: i.id, type: i.type, kind: i.kind, container: i.containerId })));
  const ids = new Set(roster.map(r => r.id));
  roster.length === 3 && ids.size === 3
    ? pass(`three guests running, three distinct identities: ${roster.map(r => `${r.id}=${r.type}`).join(', ')}`)
    : fail(`instances not distinct: ${JSON.stringify(roster)}`);

  const dupes = roster.filter(r => r.type === 'mudslider');
  dupes.length === 2 && dupes[0].container !== dupes[1].container
    ? pass('two copies of one widget each have their own container + record')
    : fail(`same-type copies collapsed: ${JSON.stringify(dupes)}`);

  // 1. THE CROSS-TALK TEST. Widget A reports gems; only A's baseline may
  // move. Under the old shared `lastSync` both handlers ran and the two
  // widgets' totals were measured against each other.
  await page.waitForFunction(() =>
    document.querySelectorAll('iframe[src*="/minigames/"]').length >= 3, null, { timeout: 20000 });
  await page.waitForTimeout(2500);

  const before = await page.evaluate(() => [...FinkMinigames.instances.values()]
    .map(i => ({ id: i.id, gems: i.lastSync.gameGems })));

  // speak as ONE specific widget, from inside its own frame
  const speaker = await page.evaluate(() => {
    const i = [...FinkMinigames.instances.values()].find(x => x.type === 'mudslider');
    return i.id;
  });
  const speakerFrame = await page.evaluate((id) => {
    const inst = FinkMinigames.instances.get(id);
    return inst.iframe.src;
  }, speaker);
  const f = page.frames().find(fr => fr.url() === speakerFrame);
  if (!f) throw new Error('could not find the speaking guest frame');
  await f.evaluate(() => parent.postMessage({ type: 'progress', data: { gems: 5 } }, '*'));
  await page.waitForTimeout(600);

  const after = await page.evaluate(() => [...FinkMinigames.instances.values()]
    .map(i => ({ id: i.id, gems: i.lastSync.gameGems })));
  const moved = after.filter(a => a.gems !== (before.find(b => b.id === a.id)?.gems ?? 0));
  moved.length === 1 && moved[0].id === speaker
    ? pass(`one widget's progress moved only its own baseline (${speaker})`)
    : fail(`cross-talk: ${moved.length} instances moved — ${JSON.stringify(moved)}`);

  // 2. THE SPOOF TEST. A frame that is not a registered guest speaks the
  // SDK vocabulary. It must be ignored AND announced — an honest bug and
  // an attack look identical from here, so neither may be silent.
  const giroBefore = await page.evaluate(() => FinkInkEngine.story.variablesState['giro_cashed']);
  await page.evaluate(async () => {
    const rogue = document.createElement('iframe');
    rogue.title = 'rogue frame (test)';
    rogue.sandbox = 'allow-scripts';
    rogue.srcdoc = `<script>
      parent.postMessage({type:'set-variable', name:'giro_cashed', value:true}, '*');
      parent.postMessage({type:'progress', data:{gems: 9999}}, '*');
      parent.postMessage({type:'complete', result:{success:true, variables:{diamonds: 999999}}}, '*');
    <\/script>`;
    document.body.appendChild(rogue);
    await new Promise(r => setTimeout(r, 900));
    rogue.remove();
    return true;
  });
  const giroAfter = await page.evaluate(() => FinkInkEngine.story.variablesState['giro_cashed']);
  giroAfter === giroBefore
    ? pass('a frame that is not a running guest cannot write story variables')
    : fail(`SPOOF SUCCEEDED: giro_cashed ${giroBefore} → ${giroAfter}`);

  // still three, and none of them killed by the rogue's `complete`
  const stillRunning = await page.evaluate(() => FinkMinigames.instances.size);
  stillRunning === 3
    ? pass('a spoofed `complete` did not close anybody else\'s window')
    : fail(`rogue complete closed ${3 - stillRunning} instance(s)`);

  // 3. CLOSING ONE MUST NOT DEAFEN THE OTHERS. The old code removed the
  // shared listener whenever any guest closed.
  const victim = roster.find(r => r.type === 'gridluck');
  await page.evaluate((cid) => FinkMinigames._closeInlineMinigame(cid, false), victim.container);
  await page.waitForTimeout(400);
  const left = await page.evaluate(() => FinkMinigames.instances.size);
  left === 2 ? pass('closing one guest leaves the other two registered')
             : fail(`close cascaded: ${left} left, expected 2`);

  const survivorBefore = await page.evaluate((id) =>
    FinkMinigames.instances.get(id).lastSync.gameGems, speaker);
  await f.evaluate(() => parent.postMessage({ type: 'progress', data: { gems: 11 } }, '*'));
  await page.waitForTimeout(600);
  const survivorAfter = await page.evaluate((id) =>
    FinkMinigames.instances.get(id).lastSync.gameGems, speaker);
  survivorAfter !== survivorBefore
    ? pass(`a survivor is still heard after a sibling closed (${survivorBefore} → ${survivorAfter})`)
    : fail('closing a sibling deafened the remaining guests');

  // 4. The shell can SEE them all — the original complaint was that
  // several running widgets showed up as one entry.
  const shelf = await page.evaluate(() => {
    const b = window.FoafOS?.bus;
    const seen = b?.retained?.('minigame.instance') || [];
    return { retained: seen.length, live: FinkMinigames.instances.size,
             ids: [...FinkMinigames.instances.keys()] };
  });
  shelf.live === 2 && shelf.ids.length === 2
    ? pass(`shell can enumerate every running guest (${shelf.ids.join(', ')})`)
    : fail(`roster wrong: ${JSON.stringify(shelf)}`);

  pageErrors.length === 0 ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nINSTANCES E2E: FAIL' : '\nINSTANCES E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 400)}`);
  console.log('\nINSTANCES E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
