// The Lantern Cellar's graphic-novel page inside Per Aspera (owner, September 2026: "Can you work the novel
// format we prototyped into the story?"). The first visit to the cellar opens the page (`# MINIGAME: cellar
// exits=oskar`); its stage panel offers Per Aspera's own ways out, and the story goes on from the one taken:
// "Sit in with Oskar" to Oskar, "Back to Ferry Street" to the street. A second visit does not open the page.
//
//   node inklet/finkapp/test/e2e-novel.mjs
import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { openStory, varOf } from './lib/story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8176;
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

const fail = (m) => { console.error('✖', m); process.exitCode = 1; };
const pass = (m) => console.log('✔', m);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function frameMatching(page, re, ms = 30000) {
  for (let t = 0; t < ms; t += 250) {
    const f = page.frames().find((fr) => re.test(fr.url()));
    if (f) return f;
    await wait(250);
  }
  return null;
}
async function chooseText(runner, text) {
  await runner.waitForFunction((t) => window.__storyrunner?.state.choices.includes(t), text, { timeout: 30000 });
  await runner.evaluate((t) => window.__storyrunner.choose(window.__storyrunner.state.choices.indexOf(t)), text);
}
// the page's ink window: its choice buttons, in order
const pageChoices = (f) => f.evaluate(() => [...document.querySelectorAll('.ink button.choice')].map((b) => b.textContent));
async function pageChoose(f, text) {
  await f.waitForFunction((t) => [...document.querySelectorAll('.ink button.choice')].some((b) => b.textContent === t), text, { timeout: 20000 });
  await f.evaluate((t) => [...document.querySelectorAll('.ink button.choice')].find((b) => b.textContent === t).click(), text);
}
const prose = (r) => r.evaluate(() => document.getElementById('prose').textContent);

const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] });
const errors = [];
try {
  for (const exit of ['Sit in with Oskar', 'Back to Ferry Street']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    const r = await openStory(page, BASE, repoName, 'drift-city/story/peraspera.fink.js');
    await chooseText(r, 'Go down to the Lantern Cellar, Chinatown');
    const f = await frameMatching(page, /drift-city\/novel\/cellar\.html/);
    if (!f) { fail('the cellar page did not open'); await ctx.close(); continue; }
    const args = new URL(f.url()).searchParams.get('exits');
    const paused = await r.evaluate(() => window.__storyrunner.state.pausedFor);
    await pageChoose(f, 'Go down to the Lantern Cellar, Chinatown');
    await pageChoose(f, 'Look at the stage');
    const stage = await pageChoices(f);
    await pageChoose(f, exit);
    const back = await r.waitForFunction(() => !window.__storyrunner.state.pausedFor && window.__storyrunner.state.choices.length > 0,
      null, { timeout: 20000 }).then(() => true, () => false);
    const score = await varOf(r, 'game_score');
    const text = await prose(r);
    const choices = await r.evaluate(() => [...window.__storyrunner.state.choices]);
    const gone = !page.frames().some((fr) => /novel\/cellar\.html/.test(fr.url()));
    if (exit === 'Sit in with Oskar') {
      args === 'oskar' && paused && stage.includes('Sit in with Oskar') && stage.includes('Back to Ferry Street') && back && score === 1
        && /You unpack the bass/.test(text) && gone
        ? pass(`the first visit to the cellar opens its novel page (exits=${args}; the story waits for it), the stage offers ${stage.map((s) => `"${s}"`).join(', ')}, and "Sit in with Oskar" there takes the story to Oskar (game_score ${score}), the page closed`)
        : fail(`oskar exit: ${JSON.stringify({ args, paused, stage, back, score, gone, choices, text: text.slice(-900) })}`);
    } else {
      back && score === 2 && choices.includes('Go down to the Lantern Cellar, Chinatown') && gone
        ? pass(`"Back to Ferry Street" on the page takes the story back to the street (game_score ${score}; choices: ${choices.length})`)
        : fail(`street exit: ${JSON.stringify({ back, score, gone, choices })}`);
      // a second visit is the story's text, with no page
      await chooseText(r, 'Go down to the Lantern Cellar, Chinatown');
      await wait(2500);
      const again = page.frames().some((fr) => /novel\/cellar\.html/.test(fr.url()));
      const c2 = await r.evaluate(() => [...window.__storyrunner.state.choices]);
      !again && c2.includes('Sit in with Oskar')
        ? pass('a second visit to the cellar is the story\'s text and choices, with no page')
        : fail(`second visit: ${JSON.stringify({ again, c2 })}`);
    }
    await ctx.close();
  }
  errors.length ? fail(`page errors: ${errors[0]}`) : pass('no page errors');
} finally {
  await browser.close();
  server.kill();
}
console.log(process.exitCode ? '\nNOVEL E2E: FAIL' : '\nNOVEL E2E: PASS');
