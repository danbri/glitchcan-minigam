#!/usr/bin/env node
// The dream stack, end to end (spec §3.4 / docs/3dmap-idea.md):
// LINKREL goDeeper pushes the outer frame; the inner story plays at
// depth 1 (surface visibly deepens); its END is the pop edge — the
// outer story resumes mid-breath, exactly after the descent line.
//
//   node inklet/finkapp/test/e2e-dream.mjs

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8156;
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
const clickChoice = (page, re) => page.evaluate((src) => {
  const rx = new RegExp(src, 'i');
  [...document.querySelectorAll('#choices button, .choice')]
    .find(b => rx.test(b.textContent))?.click();
}, re.source);

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));

  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?story=/${repoName}/inklet/demos/dream-outer.fink.js`);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
  await page.waitForFunction(() => document.body.textContent.includes('baseline reality'), null, { timeout: 10000 });
  await page.waitForTimeout(900);
  pass('outer story at baseline (depth 0)');

  // descend
  await clickChoice(page, /sleep/);
  await page.waitForFunction(() => document.body.textContent.includes('Everything is paper'), null, { timeout: 15000 });
  const deep = await page.evaluate(() => ({
    depth: FinkInkEngine.depth,
    attr: document.body.dataset.finkDepth,
    state: FoafOS?.bus.retained('story.state')[0]?.data ?? null,
  }));
  deep.depth === 1 && deep.attr === '1' && deep.state?.depth === 1
    ? pass('goDeeper pushed a frame: depth 1, surface + bus agree')
    : fail(`depth wrong: ${JSON.stringify(deep)}`);

  // play the dream to its end — END at depth is the pop edge
  await page.waitForTimeout(700);
  await clickChoice(page, /fly/);
  await page.waitForFunction(() => document.body.textContent.includes('sand in your shoes'), null, { timeout: 15000 });
  const back = await page.evaluate(() => ({
    depth: FinkInkEngine.depth,
    attr: document.body.dataset.finkDepth,
    resumedMidKnot: document.body.textContent.includes('sand in your shoes'),
    // position proof: the offered choices are the POST-descent ones,
    // not the opening Sleep/Stay pair (scrollback history may show old text)
    choices: [...document.querySelectorAll('#choices button, .choice')].map(b => b.textContent.trim()),
  }));
  back.depth === 0 && back.attr === '0' && back.resumedMidKnot
    && back.choices.some(c => /carry on/i.test(c)) && !back.choices.some(c => /sleep/i.test(c))
    ? pass('dream END popped: outer resumed mid-breath (not from the start)')
    : fail(`pop wrong: ${JSON.stringify(back)}`);

  // and the outer story still plays on to its own true END
  await page.waitForTimeout(700);
  await clickChoice(page, /carry on/);
  await page.waitForFunction(() => document.body.textContent.includes('The kettle is real'), null, { timeout: 10000 });
  const end = await page.evaluate(() => FoafOS?.bus.retained('story.state')[0]?.data?.phase);
  end === 'end'
    ? pass('outer END is terminal (depth 0) and story.state says so')
    : fail(`end state wrong: ${end}`);

  pageErrors.length === 0 ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nDREAM E2E: FAIL' : '\nDREAM E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 300)}`);
  console.log('\nDREAM E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
