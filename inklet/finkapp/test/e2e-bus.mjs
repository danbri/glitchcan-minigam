#!/usr/bin/env node
// Stage guests and window apps are full foafos apps — ON THE BUS.
//
// Proves, with a real sandboxed guest (waterworld) and a real window app:
//   · a granted guest publish reaches the shell bus, stamped
//     `guest:<type>#<instance>` — provenance survives the bridge
//   · an UNGRANTED publish is dropped AND announced (sys.guest.denied),
//     and the topic never appears on the bus
//   · a granted shell event (wm.mode) reaches the guest's subscriber —
//     waterworld sheds its chrome in pip because it HEARD the WM
//   · the guest's own beats (guest.waterworld.*) ride the bus
//   · a window app speaks the same wire protocol under its own grants
//
// Attacks are posted FROM INSIDE the guest frame (parent.postMessage),
// the way a cheating game would — not by calling host functions.
//
//   node inklet/finkapp/test/e2e-bus.mjs

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8181;
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

  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?player=legacy&story=/${repoName}/inklet/world-between-worlds.fink.js`);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
  await page.waitForTimeout(1200);

  // record everything relevant BEFORE the guest exists
  await page.evaluate(() => {
    window.__busLog = [];
    FoafOS.bus.subscribe('*', (e) => {
      if (/^(guest\.|app\.|sys\.guest\.denied)/.test(e.topic)) {
        window.__busLog.push({ topic: e.topic, source: e.source, data: e.data });
      }
    });
  });

  await page.evaluate(() => {
    FinkInkEngine.story.ChoosePathString('play_waterworld');
    FinkInkEngine.continueStory();
  });
  let frame = null;
  for (let i = 0; i < 40 && !frame; i++) {
    frame = page.frames().find(f => f.url().includes('magpie/waterworld'));
    if (!frame) await page.waitForTimeout(500);
  }
  if (!frame) throw new Error('game frame not found');
  await frame.waitForFunction(() => !!window.__waterworld, null, { timeout: 20000 });
  pass('waterworld booted in its sandboxed frame');

  // ── 1. the shell attached a scoped bus with the registry grants ──────
  const attached = await page.evaluate(() => {
    const inst = [...window.FinkMinigames.instances.values()].find(i => i.type === 'waterworld');
    return { hasBus: !!inst?.scopedBus, grants: inst?.busGrants, name: inst?.busName };
  });
  if (attached.hasBus && attached.grants?.publish?.includes('guest.waterworld.*')) {
    pass(`scoped bus attached (${attached.name}, publish ${attached.grants.publish.join(',')})`);
  } else fail('scoped bus not attached: ' + JSON.stringify(attached));

  // ── 2. granted publish, posted from INSIDE the guest ─────────────────
  await frame.evaluate(() => {
    parent.postMessage({ type: 'bus-publish', topic: 'guest.waterworld.probe', data: { n: 7 } }, '*');
  });
  await page.waitForFunction(() =>
    window.__busLog.some(e => e.topic === 'guest.waterworld.probe'), null, { timeout: 5000 });
  const probe = await page.evaluate(() =>
    window.__busLog.find(e => e.topic === 'guest.waterworld.probe'));
  if (/^guest:waterworld#mg\d+$/.test(probe.source) && probe.data?.n === 7) {
    pass(`granted publish rode the bus, stamped ${probe.source}`);
  } else fail('publish arrived with wrong provenance: ' + JSON.stringify(probe));

  // ── 3. ungranted publish: dropped AND announced, never delivered ─────
  await frame.evaluate(() => {
    parent.postMessage({ type: 'bus-publish', topic: 'wm.mode', data: { mode: 'full' } }, '*');
  });
  await page.waitForFunction(() =>
    window.__busLog.some(e => e.topic === 'sys.guest.denied'), null, { timeout: 5000 });
  const denied = await page.evaluate(() => ({
    denial: window.__busLog.find(e => e.topic === 'sys.guest.denied')?.data,
    leaked: window.__busLog.some(e => e.topic === 'wm.mode' && /^guest:/.test(e.source)),
  }));
  if (denied.denial?.topic === 'wm.mode' && !denied.leaked) {
    pass('ungranted publish denied in the open, nothing leaked');
  } else fail('denial wrong: ' + JSON.stringify(denied));

  // ── 4. shell → guest: wm.mode reaches the guest's subscriber ─────────
  await page.evaluate(() => window.FinkWM.setMode('pip'));
  await frame.waitForFunction(() =>
    document.body.classList.contains('wm-pip'), null, { timeout: 5000 });
  pass('guest HEARD wm.mode and shed its chrome for pip');
  await page.evaluate(() => window.FinkWM.setMode('full'));
  await frame.waitForFunction(() =>
    !document.body.classList.contains('wm-pip'), null, { timeout: 5000 });
  pass('and put it back on return to full');

  // ── 5. the game's own beats ride the bus (win → guest.waterworld.win) ─
  await frame.evaluate(() => window.__waterworld.win());
  await page.waitForFunction(() =>
    window.__busLog.some(e => e.topic === 'guest.waterworld.win'), null, { timeout: 10000 });
  pass('completion beat published to guest.waterworld.win');

  // ── 6. a WINDOW app speaks the same protocol under its own grants ────
  await page.waitForTimeout(1000);
  const appId = await page.evaluate(() => {
    const candidates = ['channels', 'soundtrack', 'data', 'calendar'];
    for (const id of candidates) {
      try { const w = FoafOS.launchApp(id); if (w) return id; } catch (e) { /* next */ }
    }
    return null;
  });
  if (!appId) fail('no window app available to launch');
  else {
    let appFrame = null;
    for (let i = 0; i < 20 && !appFrame; i++) {
      appFrame = page.frames().find(f => f !== frame && /inklet\/apps|magpie/.test(f.url()) && f.url() !== 'about:blank');
      if (!appFrame) await page.waitForTimeout(400);
    }
    if (!appFrame) fail(`window app ${appId} frame never appeared`);
    else {
      await appFrame.evaluate((id) => {
        parent.postMessage({ type: 'bus-publish', topic: `app.${id}.probe`, data: { hi: 1 } }, '*');
        parent.postMessage({ type: 'bus-publish', topic: 'secrets.denied', data: { forged: true } }, '*');
      }, appId);
      await page.waitForFunction((id) =>
        window.__busLog.some(e => e.topic === `app.${id}.probe`), appId, { timeout: 5000 });
      const appProbe = await page.evaluate((id) => ({
        probe: window.__busLog.find(e => e.topic === `app.${id}.probe`),
        forgery: window.__busLog.filter(e => e.topic === 'sys.guest.denied')
          .some(e => e.data?.topic === 'secrets.denied'),
      }), appId);
      if (appProbe.probe && /^guest:/.test(appProbe.probe.source) && appProbe.forgery) {
        pass(`window app ${appId} on the bus; forged shell topic denied`);
      } else fail('window app bus wrong: ' + JSON.stringify(appProbe));
    }
  }

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
