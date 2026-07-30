#!/usr/bin/env node
// The whole minigame corpus, driven in the shell, one report.
//
//   node inklet/finkapp/test/sweep-minigames.mjs [--shots]
//
// For every widget any story invokes: does it load, does it start, does
// it draw anything, does it accept input, does it report to the host,
// and is there anything at all for a screen reader? Loading is not
// playing and playing is not finished, so each is measured separately.

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const SHOTS = process.argv.includes('--shots');
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8155;
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

// Every widget name a story actually invokes, from the finkiverse map.
const universe = JSON.parse(await readFile(join(repoRoot, 'docs/fink-universe.json'), 'utf8'));
const INVOKED = [...new Set(universe.edges.filter(e => e.type === 'minigame')
  .map(e => e.to.replace('widget:', '')))];

const rows = [];
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  for (const type of INVOKED) {
    const page = await browser.newPage({ viewport: { width: 430, height: 860 }, hasTouch: true });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 120)));
    const row = { type, errors: errs };
    try {
      await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?player=legacy&story=/${repoName}/inklet/hampstead.fink.js`);
      await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
      await page.waitForTimeout(1000);

      const t0 = Date.now();
      await page.evaluate((t) => FinkMinigames.startMinigame(t, 'normal'), type);
      // inline guests (gems/mega) render in-page; iframe guests get a frame
      await page.waitForTimeout(600);
      row.iframe = await page.evaluate(() => !!document.querySelector('#iframe-minigame-container iframe'));

      if (row.iframe) {
        await page.waitForFunction(() => FinkMinigames.instances.size > 0, null, { timeout: 15000 }).catch(() => {});
        // wait for the guest to say hello
        row.ready = await page.waitForFunction(
          () => FinkMinigames.windowInstance?.verbs !== undefined, null, { timeout: 20000 })
          .then(() => true).catch(() => false);
        row.grants = await page.evaluate(() => FinkMinigames.windowInstance?.grants?.write?.length ?? -1);
      } else {
        row.ready = await page.evaluate(() => FinkMinigames.active);
        row.grants = null;
      }
      row.bootMs = Date.now() - t0;

      // Did anything actually render? Sample the game view's pixels.
      await page.waitForTimeout(3500);
      const shot = await page.locator('#minigame-view').screenshot({ timeout: 10000 }).catch(() => null);
      row.drew = shot ? shot.length > 3000 : false;
      if (SHOTS && shot) {
        const { writeFile } = await import('node:fs/promises');
        await writeFile(`/tmp/sweep-${type}.png`, shot);
      }

      // Accessibility, measured across EVERY frame the guest owns.
      // Several guests are wrappers around a nested game (battleboids,
      // gridluck), so measuring only the outermost frame reports the
      // wrapper's empty document and flatters the result.
      const guestFrames = page.frames().filter(f =>
        /\/minigames\/|\/thumbwar\/|\/robbin\//.test(f.url()));
      const per = await Promise.all(guestFrames.map(fr => fr.evaluate(() => {
        const q = (s) => document.querySelectorAll(s).length;
        const canvases = [...document.querySelectorAll('canvas')];
        return {
          live: q('[aria-live]'),
          labelled: q('[aria-label]'),
          headings: q('h1,h2'),
          focusable: q('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
          canvases: canvases.length,
          canvasLabelled: canvases.filter(c => c.getAttribute('aria-label')).length,
          a11yService: !!window.__mgA11y,
        };
      }).catch(() => null)));
      const merged = per.filter(Boolean).reduce((a, b) => ({
        live: a.live + b.live, labelled: a.labelled + b.labelled,
        headings: a.headings + b.headings, focusable: a.focusable + b.focusable,
        canvases: a.canvases + b.canvases, canvasLabelled: a.canvasLabelled + b.canvasLabelled,
        a11yService: a.a11yService || b.a11yService,
      }), { live: 0, labelled: 0, headings: 0, focusable: 0, canvases: 0, canvasLabelled: 0, a11yService: false });
      row.frames = guestFrames.length;
      row.a11y = guestFrames.length ? merged : await page.evaluate(() => {
        const el = document.getElementById('minigame-view');
        return {
          live: el.querySelectorAll('[aria-live]').length,
          labelled: el.querySelectorAll('[aria-label]').length,
          headings: el.querySelectorAll('h1,h2').length,
          focusable: el.querySelectorAll('button,[tabindex]:not([tabindex="-1"])').length,
          canvases: el.querySelectorAll('canvas').length, canvasLabelled: 0,
          a11yService: false, inline: true,
        };
      });

      // Does the shell announce anything on its behalf?
      row.announced = await page.evaluate(() =>
        (document.getElementById('foafos-announcer')?.textContent || '').trim().slice(0, 60));
    } catch (e) {
      row.fatal = String(e).split('\n')[0].slice(0, 140);
    }
    row.errors = errs.slice(0, 2);
    rows.push(row);
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill();
}

const yn = (v) => v === true ? 'yes' : v === false ? 'NO' : String(v);
console.log(`\nMINIGAME SWEEP — ${rows.length} widgets invoked by stories\n`);
console.log('widget        boot   ready  drew   grants  frames  focusable  live  canvas-labelled');
console.log('-'.repeat(86));
for (const r of rows) {
  const a = r.a11y || {};
  console.log(
    r.type.padEnd(13),
    String(r.bootMs ?? '—').padEnd(6),
    yn(r.ready).padEnd(6),
    yn(r.drew).padEnd(6),
    String(r.grants ?? '—').padEnd(7),
    String(r.frames ?? 1).padEnd(7),
    String(a.focusable ?? '—').padEnd(10),
    String(a.live ?? '—').padEnd(5),
    a.canvases ? `${a.canvasLabelled}/${a.canvases}` : '—');
}
console.log();
for (const r of rows) {
  if (r.fatal) console.log(`  ${r.type}: FATAL ${r.fatal}`);
  if (r.errors?.length) console.log(`  ${r.type}: ${r.errors.join(' · ')}`);
  if (r.announced) console.log(`  ${r.type}: announcer said "${r.announced}"`);
}
if (SHOTS) console.log('\nshots: /tmp/sweep-*.png');
