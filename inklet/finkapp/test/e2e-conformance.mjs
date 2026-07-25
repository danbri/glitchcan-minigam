#!/usr/bin/env node
// The conformance probe: adaptation, not compliance.
//
//   node inklet/finkapp/test/e2e-conformance.mjs
//
// The shell cannot inspect a guest — opaque origin, no DOM access — so
// "does this widget know its duties?" can only be answered by asking and
// seeing who answers.
//
// The rule: a guest that answers gets the OS service; a guest that stays
// silent has never heard of the contract, is therefore doing its own
// thing, and the shell RETRACTS the equivalent service rather than
// stacking on top of it. Mudslider is why — it drew its own arrows
// underneath the shell's joystick and the player got two overlapping
// control systems.
//
// Silence must cost a legacy widget NOTHING. That is the property this
// locks, in both directions.

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8157;
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

const boot = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 430, height: 860 }, hasTouch: true });
  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?story=/${repoName}/inklet/hampstead.fink.js`);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
  await page.waitForTimeout(1200);
  return page;
};
// The real on-screen pad is the shell's FoafInput surface (#foaf-pad);
// #game-dpad is the legacy element the WM no longer shows.
const padVisible = (page) => page.evaluate(() => {
  const p = document.getElementById('foaf-pad');
  if (!p) return false;
  return !p.hidden && p.getBoundingClientRect().width > 0;
});

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

  // ---- 1. A CONFORMING guest keeps the service -------------------------
  // mudslider now registers sdk.onControls, which both applies the policy
  // and answers the probe.
  {
    const page = await boot(browser);
    await page.evaluate(() => FinkMinigames.startMinigame('mudslider', 'normal'));
    await page.waitForFunction(() => FinkMinigames.windowInstance?.contracts?.has('controls'),
      null, { timeout: 20000 }).then(() => {}).catch(() => {});
    const inst = await page.evaluate(() => ({
      contracts: [...(FinkMinigames.windowInstance?.contracts || [])],
      retracted: !!FinkMinigames.windowInstance?.inputRetracted,
    }));
    inst.contracts.includes('controls')
      ? pass(`mudslider answers the probe: speaks ${inst.contracts.join(', ')}`)
      : fail(`conforming guest did not answer: ${JSON.stringify(inst)}`);

    // wait past the grace period and confirm the shell did NOT retract
    await page.waitForTimeout(3200);
    const after = await page.evaluate(() => !!FinkMinigames.windowInstance?.inputRetracted);
    const pad = await padVisible(page);
    !after && pad
      ? pass('host keeps the pad for a guest that agreed to hide its own')
      : fail(`service wrongly retracted from a conforming guest (retracted=${after} pad=${pad})`);

    // and the guest really did hide its arrows — the original defect
    const guest = page.frames().find(f => f.url().includes('/minigames/mudslider/'));
    const ownPadHidden = guest ? await guest.evaluate(() => {
      const el = document.querySelector('gc-minigam-slovib');
      const c = el?.shadowRoot?.getElementById('controls');
      return !c || getComputedStyle(c).display === 'none';
    }).catch(() => null) : null;
    ownPadHidden === true
      ? pass('guest hid its own arrows — no two overlapping control systems')
      : fail(`guest still drawing its own controls under the host pad (${ownPadHidden})`);
    await page.close();
  }

  // ---- 2. An IGNORANT guest gets the service retracted ------------------
  // Simulate a widget that predates the contract by suppressing its
  // answer. Everything else about it is unchanged — which is the point:
  // legacy guests must keep working untouched.
  {
    const page = await boot(browser);
    await page.evaluate(() => {
      // deafen the shell to this guest's conformance, as if it never sent one
      FinkMinigames._acceptConformanceReal = FinkMinigames._acceptConformance;
      FinkMinigames._acceptConformance = () => {};
      // The announcer is a transient live region — it clears itself
      // between messages, so its instantaneous text is a flaky thing to
      // assert on. Record what the announcer SUBSCRIBES to instead.
      window.__spoken = [];
      FoafOS.bus.subscribe('sys.guest.nonconforming', (e) => window.__spoken.push(e.data?.summary || ''));
    });
    await page.evaluate(() => FinkMinigames.startMinigame('mudslider', 'normal'));
    await page.waitForFunction(() => !!FinkMinigames.windowInstance?.iframe, null, { timeout: 15000 });

    await page.waitForTimeout(900);
    const padDuringGrace = await padVisible(page);
    padDuringGrace
      ? pass('the pad is offered first — the shell asks before it assumes')
      : fail('shell never offered the service, so the probe proves nothing');

    await page.waitForFunction(() => FinkMinigames.windowInstance?.inputRetracted === true,
      null, { timeout: 12000 })
      .then(() => pass('silence past the grace period → host retracts its pad'))
      .catch(() => fail('an ignorant guest kept the host pad on top of its own controls'));

    const pad = await padVisible(page);
    !pad ? pass('host pad is gone, leaving the guest its own controls')
         : fail('pad still on screen after retraction');

    // The guest must be TOLD, not just abandoned: one that had already
    // hidden its controls has to put them back or nobody can play.
    const guest = page.frames().find(f => f.url().includes('/minigames/mudslider/'));
    const ownPadBack = guest ? await guest.evaluate(() => {
      const el = document.querySelector('gc-minigam-slovib');
      const c = el?.shadowRoot?.getElementById('controls');
      return !!c && getComputedStyle(c).display !== 'none';
    }).catch(() => null) : null;
    ownPadBack === true
      ? pass('guest told to take input back has visible controls again')
      : fail(`retraction left the player with no controls at all (${ownPadBack})`);

    const spoken = await page.evaluate(() => window.__spoken || []);
    // and the announcer really is wired to that topic, or recording it
    // proves only that the bus works
    const wired = await page.evaluate(() => {
      const el = document.getElementById('foafos-announcer');
      FoafOS.bus.publish('sys.guest.nonconforming', { summary: 'probe check' });
      return new Promise(r => setTimeout(() => r(el?.textContent || ''), 120));
    });
    spoken.some(t => /does not speak|keeps its own/.test(t)) && wired === 'probe check'
      ? pass(`non-conformance announced: "${spoken[0]}"`)
      : fail(`not announced (events=${JSON.stringify(spoken)} announcer="${wired}")`);
    await page.close();
  }

  // ---- 3. A LATE answer is honoured ------------------------------------
  // Better a brief flicker than a game with no controls, so conformance
  // arriving after the deadline restores the service.
  {
    const page = await boot(browser);
    await page.evaluate(() => {
      FinkMinigames._acceptConformanceReal = FinkMinigames._acceptConformance;
      FinkMinigames._acceptConformance = () => {};
    });
    await page.evaluate(() => FinkMinigames.startMinigame('mudslider', 'normal'));
    await page.waitForFunction(() => FinkMinigames.windowInstance?.inputRetracted === true,
      null, { timeout: 15000 });
    await page.evaluate(() => {
      FinkMinigames._acceptConformance = FinkMinigames._acceptConformanceReal;
      FinkMinigames._acceptConformance(FinkMinigames.windowInstance, ['controls']);
    });
    await page.waitForTimeout(500);
    const restored = {
      retracted: await page.evaluate(() => !!FinkMinigames.windowInstance?.inputRetracted),
      pad: await padVisible(page),
    };
    !restored.retracted && restored.pad
      ? pass('a late answer restores the service')
      : fail(`late conformance ignored: ${JSON.stringify(restored)}`);
    await page.close();
  }

  console.log(process.exitCode ? '\nCONFORMANCE E2E: FAIL' : '\nCONFORMANCE E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 400)}`);
  console.log('\nCONFORMANCE E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
