#!/usr/bin/env node
// ?app=<id> is a one-tap deep link that makes THAT app the surface. The
// shell launches it. The legacy host player must NOT also auto-boot the
// bundled story behind it — "behind the demo window the general fink stuff
// is running" was exactly that: the boxed runner on top, the default story
// loaded underneath it.
//
// Asserts: with ?app=storyrunner, the runner frame appears AND the legacy
// story engine idled (no currentStoryUrl, no compiled story). And a control:
// without ?app=, the default story DOES boot (so the gate is not too wide).
//
//   node inklet/finkapp/test/e2e-app-deeplink.mjs

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8189;
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
await new Promise((r) => setTimeout(r, 900));

let failures = 0;
const fail = (m) => { console.error('✖', m); failures++; };
const pass = (m) => console.log('✔', m);
const base = `http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/`;

let browser;
try {
  browser = await chromium.launch({
    headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader'],
  });

  // ── ?app=storyrunner: runner opens, legacy story engine idles ────────
  {
    const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
    await page.goto(base + '?app=storyrunner');
    await page.waitForFunction(() => !!window.FoafOS?.launchApp, null, { timeout: 25000 });
    // give the shell's deep-link launch (300ms) and any legacy auto-boot
    // (100ms) time to run, then some
    await page.waitForTimeout(2500);

    const frame = page.frames().find((f) => f.url().includes('apps/storyrunner'));
    if (frame) pass('?app=storyrunner opened the runner frame');
    else fail('?app=storyrunner did not open the runner');

    const legacy = await page.evaluate(() => ({
      url: window.FinkPlayer?.currentStoryUrl || null,
      story: !!window.FinkInkEngine?.story,
    }));
    if (!legacy.url && !legacy.story) {
      pass('legacy story engine idled — no general fink story running behind the app');
    } else fail(`background story booted behind the app: ${JSON.stringify(legacy)}`);
    await page.close();
  }

  // ── CONTROL: no ?app= → the default story DOES boot (gate not too wide) ─
  {
    const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
    await page.goto(base);
    await page.waitForFunction(() => !!window.FoafOS?.launchApp, null, { timeout: 25000 });
    // PLAYER-AGNOSTIC on purpose. The gate under test is "?app= means that
    // app, and nothing else", so the control has to be "a plain boot DOES
    // open a story surface" — without naming which player provides it. The
    // earlier version read the host engine only, so it would have failed the
    // day the boxed runner became the default and told us the gate was too
    // wide, which would have been the wrong diagnosis.
    await page.waitForFunction(
      () => !!window.FinkInkEngine?.story || !!window.FinkPlayer?.currentStoryUrl
        || [...document.querySelectorAll('iframe')].some(f => /apps\/storyrunner\//.test(f.src)),
      null, { timeout: 20000 }).catch(() => {});
    const booted = await page.evaluate(() => ({
      url: window.FinkPlayer?.currentStoryUrl || null,
      story: !!window.FinkInkEngine?.story,
      boxed: [...document.querySelectorAll('iframe')].some(f => /apps\/storyrunner\//.test(f.src)),
    }));
    if (booted.url || booted.story || booted.boxed) {
      pass(`control: plain boot still opens a story surface (${booted.boxed ? 'boxed runner' : booted.url || 'compiled in host'})`);
    } else fail('control: no story surface boots at all — gate is too wide');
    await page.close();
  }
} catch (e) {
  fail('threw: ' + (e && e.stack ? e.stack : e));
} finally {
  if (browser) await browser.close();
  server.kill();
}

console.log(failures ? `\nAPP DEEPLINK: ${failures} FAIL` : '\nAPP DEEPLINK: PASS');
process.exit(failures ? 1 : 0);
