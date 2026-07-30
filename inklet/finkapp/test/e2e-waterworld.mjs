#!/usr/bin/env node
// The waterworld widget loop, end to end: world-between-worlds arcade →
// # MINIGAME: waterworld boots the real game in a sandboxed iframe →
// the guest conforms (controls/audio/snapshot) → host input reaches the
// sim → completion writes waterworld_won/score/diamonds back into Ink →
// the story resumes on arcade_return with the trophy choice unlocked.
//
//   node inklet/finkapp/test/e2e-waterworld.mjs

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8178;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Sandboxed iframes have opaque origins; the game's ES modules need CORS
// locally (GitHub Pages sends ACAO:* in production).
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
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));

  // 1. boot the shell straight into the hub story
  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?player=legacy&story=/${repoName}/inklet/world-between-worlds.fink.js`);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
  await page.waitForTimeout(1500);
  pass('world-between-worlds compiled');

  // 2. jump to the arcade knot that fires the MINIGAME tag (seed the
  // purse so init carries live economy into the guest)
  await page.evaluate(() => {
    FinkInkEngine.story.variablesState['diamonds'] = 3;
    FinkInkEngine.story.ChoosePathString('play_waterworld');
    FinkInkEngine.continueStory();
  });

  // 3. the guest frame boots the real game (post-redirect) and conforms
  await page.waitForFunction(() => {
    const inst = [...(window.FinkMinigames?.instances?.values() || [])]
      .find(i => i.type === 'waterworld');
    return !!inst?.iframe;
  }, null, { timeout: 15000 });
  pass('waterworld instance registered');

  await page.waitForFunction(() => !!window.FinkMinigames.iframeMinigame, null, { timeout: 5000 });
  // the wrapper redirects; wait until a frame is on the real game URL
  let frame = null;
  for (let i = 0; i < 40 && !frame; i++) {
    frame = page.frames().find(f => f.url().includes('magpie/waterworld'));
    if (!frame) await page.waitForTimeout(500);
  }
  if (!frame) throw new Error('game frame not found (redirect failed?)');
  await frame.waitForFunction(() => !!window.__waterworld, null, { timeout: 20000 });
  pass('game booted inside the sandboxed frame');

  // grants came from the manifest, fetched before src — fail-closed check
  const grants = await page.evaluate(() => {
    const inst = [...window.FinkMinigames.instances.values()].find(i => i.type === 'waterworld');
    return inst?.grants;
  });
  if (grants?.write?.includes('waterworld_won')) pass('manifest grants loaded (write: waterworld_won)');
  else fail('manifest grants missing: ' + JSON.stringify(grants));

  // conformance: the guest registered controls/audio/snapshot, so the
  // shell keeps its input service and the guest hid its own pad
  await page.waitForTimeout(1200);
  const conf = await page.evaluate(() => {
    const inst = [...window.FinkMinigames.instances.values()].find(i => i.type === 'waterworld');
    return [...(inst?.contracts || [])];
  });
  if (conf.includes('controls') && conf.includes('audio')) pass(`guest conforms: ${conf.join(', ')}`);
  else fail('guest did not answer the conformance probe: ' + JSON.stringify(conf));
  const padHidden = await frame.evaluate(() =>
    getComputedStyle(document.getElementById('pad')).display === 'none');
  if (padHidden) pass('guest hid its own touch pad (host owns input)');
  else fail('guest pad still visible under host input');

  // 4. HOST INPUT MUST REACH THE SIM — prove a press arrives, not that
  // code exists. Post the SDK key message the way the shell does.
  const yaw0 = await frame.evaluate(() => window.__waterworld.game.yaw);
  await frame.evaluate(() => {
    // same shape FoafInput sends
    window.postMessage({ type: 'key', event: 'keydown', key: 'ArrowLeft', code: 'ArrowLeft' }, '*');
  });
  await page.waitForTimeout(700);
  const yaw1 = await frame.evaluate(() => {
    window.postMessage({ type: 'key', event: 'keyup', key: 'ArrowLeft', code: 'ArrowLeft' }, '*');
    return window.__waterworld.game.yaw;
  });
  if (Math.abs(yaw1 - yaw0) > 0.2) pass(`host key steered the sub (yaw ${yaw0.toFixed(2)} → ${yaw1.toFixed(2)})`);
  else fail(`host key did nothing (yaw ${yaw0.toFixed(2)} → ${yaw1.toFixed(2)})`);

  // 5. completion: win the game, variables must land in Ink and the
  // story must resume. The frame DETACHES on complete — read the verdict
  // from the host, never the frame.
  await frame.evaluate(() => window.__waterworld.win());
  await page.waitForFunction(() =>
    FinkInkEngine.story.variablesState['waterworld_won'] === true, null, { timeout: 15000 });
  pass('waterworld_won written back into Ink');
  const vars = await page.evaluate(() => ({
    treasure: FinkInkEngine.story.variablesState['waterworld_treasure'],
    diamonds: FinkInkEngine.story.variablesState['diamonds'],
    score: FinkInkEngine.story.variablesState['score'],
  }));
  if (vars.treasure > 0) pass(`treasure banked: ${vars.treasure}`);
  else fail('waterworld_treasure not written: ' + JSON.stringify(vars));
  if (vars.diamonds > 3) pass(`diamonds grew from 3 to ${vars.diamonds}`);
  else fail(`diamonds did not grow (${vars.diamonds})`);

  // story resumed on arcade_return with the trophy choice unlocked
  await page.waitForTimeout(1500);
  const choices = await page.evaluate(() =>
    [...document.querySelectorAll('#choices button, .choice-btn')].map(b => b.textContent.trim()));
  if (choices.some(c => /dripping chest/i.test(c))) pass('trophy choice unlocked in arcade_return');
  else fail('trophy choice missing; choices: ' + JSON.stringify(choices));

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
