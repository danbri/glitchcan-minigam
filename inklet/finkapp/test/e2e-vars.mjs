#!/usr/bin/env node
// Variable governance + the debug clock, end to end in the real shell.
//
//   node inklet/finkapp/test/e2e-vars.mjs
//
// What this locks:
//  - a guest's manifest is a CAPABILITY, not decoration: writes it never
//    declared are denied at the host boundary (before June 2026 every
//    guest could set every story variable, including `diamonds`)
//  - declared writes still land, so governance is not just a brake
//  - inside a dream the shared economy is read-only
//  - a guest cannot READ another work's private plot state
//  - __finkDebug.slow(50) actually slows the guest's frame delivery,
//    which is what makes headless inspection possible at all
//
// The attacks are posted FROM INSIDE the guest frame, the way a cheating
// game would send them — not by calling host functions directly.

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { openStory, goto, varOf as runnerVar } from './lib/story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8147;
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

  // The story plays in the boxed runner; its ink variables live in that
  // frame. The shell holds the shared-economy mirror (FoafOS.storyVars) that
  // a guest's governed writes land in while the story that launched it owns it.
  const r = await openStory(page, `http://127.0.0.1:${PORT}`, repoName, 'inklet/hampstead.fink.js');
  await page.waitForTimeout(800);

  // 0. the broker knows what the story declares (the runner reads the names
  // from the compiled story and tells the shell, so an unbound write can be
  // told apart from a denied one)
  const bound = await page.evaluate(() => {
    const b = window.FoafOS?.vars?.bound;
    return b ? { size: b.size, hasPrivate: b.has('giro_cashed'), hasShared: b.has('diamonds') } : null;
  });
  bound?.hasPrivate && bound.hasShared
    ? pass(`broker bound to the story's ${bound.size} declared variables`)
    : fail(`broker not bound to the compiled story: ${JSON.stringify(bound)}`);

  // Put treasure in the shell's economy the way a story does — a governed
  // story.vars write from the runner — so the guest's read in leg 7 has
  // something to see. (The mirror holds only what has been written through
  // the broker; a story's own VAR defaults are not pushed into it.)
  const seeded = await r.evaluate(() => window.__storyrunner.spend('diamonds', 3));
  seeded?.ok && await page.evaluate(() => FoafOS.storyVars.get('diamonds')) === 3
    ? pass('the story wrote its shared economy through the broker (diamonds = 3)')
    : fail(`story could not write its own shared economy: ${JSON.stringify(seeded)}`);

  // The runner meets `# MINIGAME: robbin` and asks the shell (story.launch).
  await goto(r, 'hampstead_tube');
  // the wrapper redirects, so the real game frame appears a beat later
  let gameFrame = null;
  for (let i = 0; i < 80 && !gameFrame; i++) {
    gameFrame = page.frames().find(f => f.url().includes('magpie/robbin/robbin.html'));
    if (!gameFrame) await page.waitForTimeout(250);
  }
  if (!gameFrame) throw new Error('robbin game frame never appeared');
  await gameFrame.waitForFunction(() => !!window.__robbin, null, { timeout: 20000 });
  await page.waitForFunction(() => Array.isArray(window.FinkMinigames?.currentGrants?.write)
    && FinkMinigames.currentGrants.write.length > 0, null, { timeout: 8000 });
  const owner = await page.evaluate(() => FoafOS.storyVars.owner);
  owner ? pass(`the launching story owns the economy while its game plays (${owner})`)
        : fail('no story owns the economy while robbin plays: guest writes would go nowhere');

  // 1. the manifest arrived as a capability
  const grants = await page.evaluate(() => FinkMinigames.currentGrants);
  grants.write.includes('robbin_birds') && grants.write.includes('diamonds')
    && !grants.write.includes('giro_cashed')
    ? pass(`robbin's capability: write ${grants.write.join(', ')}`)
    : fail(`grants wrong: ${JSON.stringify(grants)}`);

  // helper: post a message to the host as the guest would
  const asGuest = (msg) => gameFrame.evaluate((m) => parent.postMessage(m, '*'), msg);
  // what the shell holds for the playing story (a governed write lands here)
  const varOf = (n) => page.evaluate((k) => FoafOS.storyVars.get(k), n);
  const denialsFor = (n) => page.evaluate((k) =>
    FoafOS.vars.log.filter(e => !e.ok && e.name === k).length, n);

  // 2. THE ATTACK: reach into the story's private state
  const giroBefore = await runnerVar(r, 'giro_cashed');
  await asGuest({ type: 'set-variable', name: 'giro_cashed', value: true });
  await page.waitForTimeout(300);
  const giroAfter = await runnerVar(r, 'giro_cashed');
  giroAfter === giroBefore && await varOf('giro_cashed') === undefined
    && await denialsFor('giro_cashed') === 1
    ? pass('undeclared write to the story\'s private state DENIED and audited')
    : fail(`guest reached story innards: ${giroBefore} → ${giroAfter}`);

  // 3. THE OTHER ATTACK: mint currency it never declared… robbin DOES
  // declare diamonds, so use the name it does not: mega_diamonds
  const megaBefore = await varOf('mega_diamonds');
  const megaRunnerBefore = await runnerVar(r, 'mega_diamonds');
  await asGuest({ type: 'set-variable', name: 'mega_diamonds', value: 999999 });
  await page.waitForTimeout(300);
  await varOf('mega_diamonds') === megaBefore && await denialsFor('mega_diamonds') === 1
    ? pass('undeclared write to the shared economy DENIED')
    : fail(`guest minted mega_diamonds: ${megaBefore} → ${await varOf('mega_diamonds')}`);

  // 4. and an absurd value for a name it DID declare
  await asGuest({ type: 'set-variable', name: 'diamonds', value: 1e12 });
  await page.waitForTimeout(300);
  await denialsFor('diamonds') >= 1 && await varOf('diamonds') === 3
    ? pass('declared-but-absurd value rejected by platform limits')
    : fail(`no value ceiling: diamonds = ${await varOf('diamonds')}`);

  // 5. governance is not just a brake — declared writes land
  await asGuest({ type: 'set-variable', name: 'robbin_birds', value: 7 });
  await page.waitForTimeout(300);
  await varOf('robbin_birds') === 7
    ? pass('declared write lands (robbin_birds = 7)')
    : fail(`declared write blocked: robbin_birds = ${await varOf('robbin_birds')}`);

  // 6. dreams are strict: the shared economy is read-only below depth 0
  const dBefore = await varOf('diamonds');
  await page.evaluate(() => FoafOS.vars.setDepth(1));
  await asGuest({ type: 'set-variable', name: 'diamonds', value: (dBefore || 0) + 5 });
  await page.waitForTimeout(300);
  const dInDream = await varOf('diamonds');
  await page.evaluate(() => FoafOS.vars.setDepth(0));
  await asGuest({ type: 'set-variable', name: 'diamonds', value: (dBefore || 0) + 5 });
  await page.waitForTimeout(300);
  const dAwake = await varOf('diamonds');
  dInDream === dBefore && dAwake === (dBefore || 0) + 5
    ? pass('no spending the waking world from inside a dream')
    : fail(`dream strictness broken: before=${dBefore} inDream=${dInDream} awake=${dAwake}`);

  // 7. a guest sees the economy and its own declarations, not the plot.
  // robbin keeps the init payload on game.embedVars — assert the read
  // actually happened, or this test proves nothing.
  const seen = await gameFrame.evaluate(() => Object.keys(window.__robbin?.game?.embedVars || {}));
  const leaked = seen.filter(k => ['giro_cashed', 'fraud_caught', 'met_artist', 'mortgage_signed'].includes(k));
  seen.includes('diamonds') && leaked.length === 0
    ? pass(`guest sees ${seen.length} variables (${seen.join(', ')}) — no plot state`)
    : fail(`guest read wrong: saw [${seen.join(', ')}], leaked [${leaked.join(', ')}]`);

  // 8. the debug clock: 50× slow must really slow frame DELIVERY.
  // Time the window from the HOST: every clock inside the guest is
  // deliberately a lie once the scale is set, so a guest-side stopwatch
  // (or setTimeout backstop) would be stretched along with the game.
  const probe = () => gameFrame.evaluate(() => {
    window.__frameProbe = 0;
    const tick = () => { window.__frameProbe++; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await probe();
  await page.waitForTimeout(2000);
  const realFrames = await gameFrame.evaluate(() => window.__frameProbe);

  await page.evaluate(() => __finkDebug.slow(50));
  await page.waitForTimeout(300);
  const scaled = await gameFrame.evaluate(() => window.__mgDebug?.state || null);
  scaled?.scale === 0.02 && scaled.k === 50
    ? pass('guest clock virtualised: scale 0.02, every 50th frame')
    : fail(`slow(50) did not reach the guest: ${JSON.stringify(scaled)}`);

  await gameFrame.evaluate(() => { window.__frameProbe = 0; });
  await page.waitForTimeout(2000);
  const slowFrames = await gameFrame.evaluate(() => window.__frameProbe);
  slowFrames > 0 && slowFrames < Math.max(2, realFrames / 5)
    ? pass(`frames throttled over the same 2s: ${realFrames} → ${slowFrames}`)
    : fail(`slow mode delivered ${slowFrames} frames vs ${realFrames} at full speed`);

  // 9. freeze + step is deterministic
  await page.evaluate(() => __finkDebug.freeze());
  await page.waitForTimeout(400);
  await gameFrame.evaluate(() => { window.__frameProbe = 0; });
  await page.waitForTimeout(700);
  const frozen = await gameFrame.evaluate(() => window.__frameProbe);
  const beforeStep = await gameFrame.evaluate(() => window.__mgDebug.state.delivered);
  await page.evaluate(() => __finkDebug.step(1));
  await page.waitForTimeout(700);
  const afterStep = await gameFrame.evaluate(() => window.__mgDebug.state.delivered);
  frozen === 0 && afterStep === beforeStep + 1
    ? pass(`freeze stops the guest; step(1) delivers exactly one frame`)
    : fail(`freeze/step broken: frozen=${frozen} delivered ${beforeStep}→${afterStep}`);
  await page.evaluate(() => __finkDebug.normal());

  // 10. the whole picture in one call for a headless driver
  const state = await page.evaluate(() => __finkDebug.state());
  state.type === 'robbin' && state.vars && state.vars.denied >= 3 && state.grants
    ? pass(`__finkDebug.state(): ${state.vars.written} writes, ${state.vars.denied} denied`)
    : fail(`devtools state incomplete: ${JSON.stringify(state).slice(0, 240)}`);

  // 11. the accepted writes, and only those, reach the story's own ink.
  // A guest writes the shell's mirror; completion hands the runner what the
  // game changed. The denied private write must not ride along.
  await page.evaluate(() => FinkMinigames.handleMinigameComplete({ type: 'robbin', success: true, score: 0 }));
  await r.waitForFunction(() => !window.__storyrunner.paused(), null, { timeout: 10000 }).catch(() => {});
  const back = await r.evaluate(() => ({
    paused: window.__storyrunner.paused(),
    birds: window.__storyrunner.varOf('robbin_birds'),
    giro: window.__storyrunner.varOf('giro_cashed'),
    mega: window.__storyrunner.varOf('mega_diamonds'),
  }));
  !back.paused && back.birds === 7 && back.giro === giroBefore && back.mega === megaRunnerBefore
    ? pass(`completion wrote the accepted writes into the story's ink (robbin_birds = 7), nothing denied`)
    : fail(`writeback wrong: ${JSON.stringify(back)} (giro before ${giroBefore}, mega before ${megaRunnerBefore})`);

  pageErrors.length === 0 ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nVARS E2E: FAIL' : '\nVARS E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 400)}`);
  console.log('\nVARS E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
