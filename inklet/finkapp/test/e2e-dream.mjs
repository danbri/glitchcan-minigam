#!/usr/bin/env node
// The dream stack, end to end (spec §3.4 / docs/3dmap-idea.md), played by
// the boxed story runner on a REAL story pair (demos/dream-outer + inner):
// LINKREL goDeeper pushes the outer frame; the inner story plays at
// depth 1 (the runner, the shell's count, the broker and the surface all
// agree); inside that real dream the shared economy is read-only; the
// inner END is the pop edge — the outer story resumes mid-breath, exactly
// after the descent line, and the economy is writable again.
//
// e2e-storyrunner.mjs drives the depth by posting story.link straight at
// the shell (no story loaded). This suite is the other half: the depth and
// the read-only rule reached by PLAYING a # LINKREL: goDeeper tag.
//
//   node inklet/finkapp/test/e2e-dream.mjs

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { openStory } from './lib/story.mjs';

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
// Take the runner's choice whose text matches, as a reader would.
const chooseText = (r, re) => r.evaluate((src) => {
  const rx = new RegExp(src, 'i');
  const i = window.__storyrunner.state.choices.findIndex((c) => rx.test(c));
  if (i >= 0) window.__storyrunner.choose(i);
  return i;
}, re.source);
const proseHas = (r, text, ms = 15000) => r.waitForFunction(
  (t) => window.__storyrunner.state.prose.some((p) => p.text.includes(t)), text, { timeout: ms });

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));

  const r = await openStory(page, `http://127.0.0.1:${PORT}`, repoName, 'inklet/demos/dream-outer.fink.js');
  await proseHas(r, 'baseline reality');
  // hear the runner's own end announcement on the shell bus
  await page.evaluate(() => {
    window.__dreamLog = [];
    FoafOS.bus.subscribe('*', (e) => {
      if (/^app\.storyrunner\.(ended|surfacing)$/.test(e.topic)) window.__dreamLog.push(e.topic);
    });
  });
  const d0 = await r.evaluate(() => window.__storyrunner.depth());
  d0 === 0 ? pass('outer story at baseline (depth 0)') : fail(`outer story starts at depth ${d0}`);

  // descend
  (await chooseText(r, /sleep/)) >= 0 || fail('no Sleep choice to descend with');
  await proseHas(r, 'Everything is paper');
  await page.waitForTimeout(300);
  const deep = {
    runner: await r.evaluate(() => window.__storyrunner.depth()),
    runnerAttr: await r.evaluate(() => document.body.dataset.depth),
    ...(await page.evaluate(() => ({
      shell: FoafOS.storyDepth('storyrunner'),
      broker: FoafOS.vars.depth,
      attr: document.body.dataset.finkDepth,
      state: FoafOS.bus.retained('story.state')[0]?.data?.depth ?? null,
    }))),
  };
  deep.runner === 1 && deep.runnerAttr === '1' && deep.shell === 1 && deep.broker === 1
    && deep.attr === '1' && deep.state === 1
    ? pass('goDeeper pushed a frame: depth 1 — runner, shell count, broker, surface and bus agree')
    : fail(`depth wrong: ${JSON.stringify(deep)}`);

  // the dream read-only rule, reached by PLAYING into a dream
  const dreamSpend = await r.evaluate(() => window.__storyrunner.spend('diamonds', 5));
  dreamSpend?.ok === false && /dream/.test(dreamSpend.reason || '')
    ? pass(`a story inside a real dream cannot spend the waking world ("${dreamSpend.reason}")`)
    : fail(`dream spent the shared economy: ${JSON.stringify(dreamSpend)}`);

  // play the dream to its end — END at depth is the pop edge
  (await chooseText(r, /fly/)) >= 0 || fail('no Fly choice in the dream');
  await proseHas(r, 'sand in your shoes');
  await r.waitForFunction(() => window.__storyrunner.state.choices.length > 0, null, { timeout: 10000 });
  await page.waitForTimeout(300);
  const back = await r.evaluate(() => ({
    depth: window.__storyrunner.depth(),
    attr: document.body.dataset.depth,
    // position proof: the offered choices are the POST-descent ones,
    // not the opening Sleep/Stay pair
    choices: window.__storyrunner.state.choices,
  }));
  const backShell = await page.evaluate(() => ({
    shell: FoafOS.storyDepth('storyrunner'), broker: FoafOS.vars.depth,
    attr: document.body.dataset.finkDepth, surfacing: window.__dreamLog.includes('app.storyrunner.surfacing'),
  }));
  back.depth === 0 && back.attr === '0' && backShell.shell === 0 && backShell.broker === 0
    && backShell.attr === '0'
    && back.choices.some(c => /carry on/i.test(c)) && !back.choices.some(c => /sleep/i.test(c))
    ? pass('dream END popped: outer resumed mid-breath (not from the start), every depth back to 0')
    : fail(`pop wrong: ${JSON.stringify({ back, backShell })}`);

  // awake again, the same spend is allowed — the rule is about depth, not a brake
  const awakeSpend = await r.evaluate(() => window.__storyrunner.spend('diamonds', 5));
  const mirror = await page.evaluate(() => FoafOS.storyVars.get('diamonds'));
  awakeSpend?.ok === true && mirror === 5
    ? pass('surfaced, the story may spend the shared economy again (diamonds = 5)')
    : fail(`waking spend refused: ${JSON.stringify(awakeSpend)} mirror=${mirror}`);

  // and the outer story still plays on to its own true END
  (await chooseText(r, /carry on/)) >= 0 || fail('no Carry on choice');
  await proseHas(r, 'The kettle is real', 10000);
  await r.waitForFunction(() => window.__storyrunner.state.ended, null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  const end = {
    ended: await r.evaluate(() => window.__storyrunner.state.ended),
    depth: await r.evaluate(() => window.__storyrunner.depth()),
    announced: await page.evaluate(() => window.__dreamLog.includes('app.storyrunner.ended')),
  };
  end.ended && end.depth === 0 && end.announced
    ? pass('outer END is terminal at depth 0, and the runner announced it on the bus')
    : fail(`end state wrong: ${JSON.stringify(end)}`);

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
