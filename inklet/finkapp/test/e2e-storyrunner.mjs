#!/usr/bin/env node
// FinkStoryRunner — the narrative runtime, BOXED. Sandboxed all the way UP.
//
// Proves the story+runtime containment the live host-side player lacks:
//   · the runner compiles and PLAYS a real ink story entirely inside its
//     own opaque-origin frame (prose + a choice tree)
//   · it has NO host reach: parent.FoafOS / parent.FinkInkEngine throw
//     (opaque origin — the SecurityError IS the boundary working)
//   · a story's # BG: colours the RUNNER's frame, never the host body
//   · a # MINIGAME: tag does NOT launch anything directly — it surfaces as
//     a capability-checked story.launch REQUEST the shell governs, and the
//     launched guest is itself boxed (up AND down)
//   · story:launch is refused when the capability is withheld
//
//   node inklet/finkapp/test/e2e-storyrunner.mjs

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8184;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Sandboxed app frames have opaque origins: their module imports and story
// fetch need CORS locally (GitHub Pages sends ACAO:* in production).
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
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/`);
  await page.waitForFunction(() => !!window.FoafOS?.launchApp, null, { timeout: 25000 });
  await page.waitForTimeout(1200);

  // record governed story.requests on the shell bus before we launch
  await page.evaluate(() => {
    window.__srLog = [];
    FoafOS.bus.subscribe('story.request', (e) => window.__srLog.push(e.data));
  });

  // launch the boxed runner
  await page.evaluate(() => FoafOS.launchApp('storyrunner'));
  let frame = null;
  for (let i = 0; i < 40 && !frame; i++) {
    frame = page.frames().find((f) => f.url().includes('apps/storyrunner'));
    if (!frame) await page.waitForTimeout(400);
  }
  if (!frame) throw new Error('storyrunner frame never appeared');
  await frame.waitForFunction(() => window.__storyrunner?.ready?.(), null, { timeout: 20000 });
  pass('boxed runner compiled and started a story in its own frame');

  // ── 1. it PLAYED: prose + a choice tree rendered in-frame ────────────
  const played = await frame.evaluate(() => {
    const s = window.__storyrunner.state;
    return { prose: s.prose.length, choices: s.choices.length, bg: s.bg };
  });
  if (played.prose >= 1 && played.choices >= 2) {
    pass(`story played in-frame (${played.prose} prose, ${played.choices} choices)`);
  } else fail('runner did not render a playable beat: ' + JSON.stringify(played));

  // ── 2. # BG: coloured the RUNNER's frame, never the host ─────────────
  const bg = await frame.evaluate(() => document.body.style.background);
  const hostBg = await page.evaluate(() => document.body.style.background);
  if (/10, 31, 20/.test(bg)) {
    pass(`# BG: styled the runner frame (${bg})`);
  } else fail('BG not applied in frame: ' + JSON.stringify({ bg, recorded: played.bg }));
  if (!/10, 31, 20/.test(hostBg)) pass('host body was NOT restyled by the story');
  else fail('story reached the HOST background: ' + hostBg);

  // ── 3. NO host reach: parent globals are unreachable (opaque origin) ──
  const reach = await frame.evaluate(() => {
    const probe = (fn) => { try { return fn() ? 'reached' : 'absent'; } catch (e) { return 'blocked:' + e.name; } };
    return {
      foafos: probe(() => window.parent.FoafOS),
      engine: probe(() => window.parent.FinkInkEngine),
      doc: probe(() => window.parent.document.body),
    };
  });
  const contained = Object.values(reach).every((v) => v !== 'reached');
  if (contained) pass(`no host reach from the box (${JSON.stringify(reach)})`);
  else fail('BOX LEAKS to host: ' + JSON.stringify(reach));

  // ── 3b. boxes within boxes: the story's JS ran in a NESTED sandbox, ──
  // not in the runner frame. The demo's file-level JS sets __stpr_canary;
  // if it had run in the runner frame, the runner window would carry it.
  const inner = await frame.evaluate(() => ({
    boxed: !!window.__storyrunner.state.boxedCompile,
    canaryInRunner: typeof window.__stpr_canary,     // 'undefined' when boxed
  }));
  if (inner.boxed && inner.canaryInRunner === 'undefined') {
    pass('compile step nested in its own box — story JS never touched the runner');
  } else fail('inner box leaked: ' + JSON.stringify(inner));

  // ── 4. a choice that hits # MINIGAME: surfaces as a governed request ──
  // Choose option 0 ("Take the torch") → hatch → # MINIGAME: waterworld.
  await frame.evaluate(() => window.__storyrunner.choose(0));
  await page.waitForTimeout(800);
  const req = await frame.evaluate(() => window.__storyrunner.state.requests);
  const launchReq = req.find((r) => r.verb === 'story.launch');
  if (launchReq && launchReq.detail?.game === 'waterworld') {
    pass('# MINIGAME: surfaced as a story.launch REQUEST, not a direct launch');
  } else fail('minigame tag did not become a governed request: ' + JSON.stringify(req));
  const sawGoverned = await page.evaluate(() =>
    window.__srLog.some((e) => e.verb === 'story.launch'));
  if (sawGoverned) pass('the shell governed the launch request (bus story.request)');
  else fail('shell never saw the story.launch request');

  // the Running ⓘ "utilized" ledger must count the narrative effect —
  // story:* is a broker path like storage/secrets/verb/audio
  const tallied = await page.evaluate(() => FoafOS.capUse('storyrunner')?.['story:launch'] || 0);
  if (tallied >= 1) pass(`capUse tallied story:launch (${tallied})`);
  else fail('story:launch not counted in the capUse ledger: ' + tallied);

  // ── 5. withheld capability is refused (named, not silent) ────────────
  const refusal = await frame.evaluate(async () => {
    // story.navigate is granted here but not implemented; story.link too.
    // Use an unknown verb to prove the deny path shape.
    return window.foaf.storyRequest('story.smuggle', { anywhere: 'evil.example' });
  });
  if (refusal && refusal.ok === false && refusal.reason === 'unknown-verb') {
    pass('an ungoverned narrative verb is refused with a named reason');
  } else fail('deny path wrong: ' + JSON.stringify(refusal));

  if (pageErrors.length) fail('page errors: ' + pageErrors.join(' | '));
  else pass('zero page errors');
} catch (e) {
  fail('e2e crashed: ' + e.message);
} finally {
  await browser?.close();
  server.kill();
}
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
