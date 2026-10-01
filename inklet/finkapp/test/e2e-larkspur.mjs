// Larkspur Falls: The Snowglobe Affair (cozyverse/larkspur.fink.js), played on a phone-sized screen with touch.
// The solving path: every clue, all four names of the man with the wreath, the right accusation. Checks that each
// beat's picture or video is there (the file loads), that the choice buttons are big enough to tap (44 px), that
// the page does not scroll sideways, that the clue count shows in the status bar, and that the ending knows.
//
//   node inklet/finkapp/test/e2e-larkspur.mjs        (SHOTS=dir saves a phone screenshot before each choice)
import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { openStory, varOf } from './lib/story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8177;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = `http://127.0.0.1:${PORT}`;
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

let failed = 0;
const fail = (m) => { failed++; console.error('✖', m); };
const pass = (m) => console.log('✔', m);

const PATH = ['Begin', 'Ask him the way', '"Why does it go up?"', 'Look at the case', 'Read the festival ledger',
  'Ask who has keys', 'Go with Wes', 'Ask about last year\'s festival', 'Look out of the window', 'Drink the cocoa',
  'Go into Pruitt\'s Pies', 'Talk to the man in the camel coat', 'Look up at the ladder', 'Go to the festival',
  'Agatha Pruitt', '"Are you asking?"'];

const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] });
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  const r = await openStory(page, BASE, repoName, 'cozyverse/larkspur.fink.js');
  const media = new Map();
  let small = [], wide = [], noPoster = [];
  for (const label of PATH) {
    await r.waitForFunction((t) => window.__storyrunner.state.choices.includes(t), label, { timeout: 30000 })
      .catch(() => {});
    const st = await r.evaluate(() => window.__storyrunner.state);
    if (!st.choices.includes(label)) { fail(`no choice "${label}"; offered: ${JSON.stringify(st.choices)}`); break; }
    if (st.media?.resolved) media.set(st.media.src, st.media.resolved);
    if (st.media?.kind === 'VIDEO') st.media.poster ? media.set(st.media.src + ' poster', st.media.poster) : noPoster.push(st.media.src);
    // tap targets and sideways scroll, measured on the runner's own page
    const m = await r.evaluate(() => ({
      buttons: [...document.querySelectorAll('#choices button')].map((b) => [b.textContent, Math.round(b.getBoundingClientRect().height)]),
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    for (const [t, h] of m.buttons) if (h < 44) small.push(`${t} (${h} px)`);
    if (m.sideways > 1) wide.push(`${label}: ${m.sideways} px`);
    if (process.env.SHOTS) { await page.waitForTimeout(600); await page.screenshot({ path: `${process.env.SHOTS}/${String(PATH.indexOf(label)).padStart(2, '0')}.png` }); }
    await r.evaluate((t) => window.__storyrunner.choose(window.__storyrunner.state.choices.indexOf(t)), label);
  }
  await r.waitForFunction(() => window.__storyrunner.state.ended, null, { timeout: 30000 }).catch(() => {});
  const end = await r.evaluate(() => window.__storyrunner.state);
  if (end.media?.resolved) media.set(end.media.src, end.media.resolved);

  const v = { solved: await varOf(r, 'solved'), clues: await varOf(r, 'clues'), names: await varOf(r, 'names') };
  end.ended && v.solved === true && v.clues === 3 && v.names === 4
    ? pass(`the solving path ends solved, with 3 of 3 clues and all 4 names (${PATH.length} choices)`)
    : fail(`ending: ${JSON.stringify({ ended: end.ended, ...v })}`);
  const prose = await r.evaluate(() => document.getElementById('prose').textContent);
  /You solved the Snowglobe Affair/.test(prose) && /You noticed all four of him/.test(prose)
    ? pass('the credits say so') : fail('the credits do not mention the result');
  const bar = await r.evaluate(() => { const b = document.getElementById('statusbar'); return b && !b.hidden ? b.textContent : null; });
  bar && /3/.test(bar) ? pass(`status bar shows the clues ("${bar.trim()}")`) : fail(`status bar: ${JSON.stringify(bar)}`);

  // every picture and video the path showed is a real file
  const bad = [];
  for (const [src, url] of media) {
    const res = await page.request.get(url);
    if (!res.ok()) bad.push(`${src} ${res.status()}`);
  }
  media.size >= 10 && !bad.length ? pass(`all ${media.size} media files on the path load`) : fail(`media: ${media.size} seen; missing ${bad.join(', ')}`);
  noPoster.length ? fail(`videos without a poster: ${noPoster.join(', ')}`) : pass('every video shows a poster picture before it plays');
  small.length ? fail(`choice buttons under 44 px: ${small.slice(0, 5).join('; ')}`) : pass('every choice button is at least 44 px tall');
  wide.length ? fail(`sideways scroll: ${wide.join('; ')}`) : pass('no sideways scroll at 390 px');
  await page.screenshot({ path: process.env.SHOT || '/tmp/larkspur-end.png' });
  errors.length ? fail('page errors: ' + errors.slice(0, 3).join(' | ')) : pass('no page errors');
} finally {
  await browser.close();
  server.kill();
}
console.log(failed ? '\nLARKSPUR E2E: FAIL' : '\nLARKSPUR E2E: PASS');
process.exit(failed ? 1 : 0);
