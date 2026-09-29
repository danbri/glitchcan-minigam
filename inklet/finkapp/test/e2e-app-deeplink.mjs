#!/usr/bin/env node
// ?app=<id> is a one-tap deep link that makes THAT app the surface. The
// shell launches it. The boot must NOT also open the bundled story behind
// it — "behind the demo window the general fink stuff is running" was
// exactly that: the app on top, the default story loaded underneath it.
//
// Stories play only in the story runner now, so "a story behind the app"
// means a SECOND runner window. Asserts: with ?app=storyrunner, exactly one
// runner frame opens (the app itself); with ?app=calendar, no runner frame
// opens at all. And a control: without ?app=, the default story DOES boot
// in the runner (so the gate is not too wide).
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

  // ── ?app=storyrunner: the runner opens, and no second one behind it ──
  const runners = (page) => page.frames().filter((f) => /apps\/storyrunner\/index\.html/.test(f.url())).length;
  {
    const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
    await page.goto(base + '?app=storyrunner');
    await page.waitForFunction(() => !!window.FoafOS?.launchApp, null, { timeout: 25000 });
    // give the shell's deep-link launch (300ms) and the boot story's launch
    // (150ms) time to run, then some
    await page.waitForTimeout(2500);

    const n = runners(page);
    if (n >= 1) pass('?app=storyrunner opened the runner frame');
    else fail('?app=storyrunner did not open the runner');
    if (n <= 1) pass('no second runner — no general fink story running behind the app');
    else fail(`background story booted behind the app: ${n} runner frames`);
    await page.close();
  }

  // ── ?app=<not a story>: no runner at all ─────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
    await page.goto(base + '?app=calendar');
    await page.waitForFunction(() => !!window.FoafOS?.launchApp, null, { timeout: 25000 });
    await page.waitForTimeout(2500);
    const n = runners(page);
    if (n === 0) pass('?app=calendar: no story runner opened behind the app');
    else fail(`?app=calendar: ${n} story runner frame(s) opened behind the app`);
    await page.close();
  }

  // ── CONTROL: no ?app= → the default story DOES boot (gate not too wide) ─
  {
    const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
    await page.goto(base);
    await page.waitForFunction(() => !!window.FoafOS?.launchApp, null, { timeout: 25000 });
    // The control: a plain boot DOES open a story surface — the runner.
    await page.waitForFunction(
      () => [...document.querySelectorAll('iframe')].some(f => /apps\/storyrunner\//.test(f.src)),
      null, { timeout: 20000 }).catch(() => {});
    const boxed = await page.evaluate(() =>
      [...document.querySelectorAll('iframe')].some(f => /apps\/storyrunner\//.test(f.src)));
    if (boxed) pass('control: plain boot still opens a story surface (the runner)');
    else fail('control: no story surface boots at all — gate is too wide');
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
