// Audio must not outlive the thing that started it.
//
// Field report: "I played riverbend muted, then afterwards played
// gridluck. Turning on sound I hear the whitenoise I vaguely associate
// with riverbend." Exactly right. `# FOLEY: water(...)` is a LOOPING
// filtered-noise bed with a 60s tail, and opening a game window did not
// stop it — the story's river played on underneath an unrelated maze.
//
// Muting hid the leak rather than causing it: mute is a LEVEL, not a
// stop, which is the correct design and also why this went unnoticed.
// That is the general shape worth testing — a bug you can only hear
// after you stop listening.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStory } from './lib/story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const repoName = basename(repoRoot);
const PORT = 8153;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const CORS_SERVER = `
import http.server, functools
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin','*'); super().end_headers()
    def log_message(self,*a): pass
http.server.ThreadingHTTPServer(('127.0.0.1',${PORT}), functools.partial(H, directory='${join(repoRoot, '..')}')).serve_forever()
`;
const server = spawn('python3', ['-c', CORS_SERVER], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));

const fail = (m) => { console.error('✖', m); process.exitCode = 1; };
const pass = (m) => console.log('✔', m);
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const layersOf = (page) => page.evaluate(() => Object.keys(window.FinkFoley?.layers || {}));
  const newPage = async () => {
    const page = await browser.newPage({ viewport: { width: 430, height: 860 }, hasTouch: true });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    return { page, errs };
  };

  // ── 1. riverbend's own `# FOLEY:` tags, in the runner ──────────────
  // The field report's story. Its first knot says `# FOLEY: water(...)` and
  // `# FOLEY: wind(...)`; the old host engine sent those to FinkFoley. The
  // runner is now the only engine, so the bed must still reach the shell's
  // FinkFoley from the box.
  {
    const { page, errs } = await newPage();
    await openStory(page, `http://127.0.0.1:${PORT}`, repoName, 'inklet/riverbend.fink.js');
    await page.waitForFunction(() => Object.keys(window.FinkFoley?.layers || {}).length > 0, null, { timeout: 8000 })
      .catch(() => {});
    const started = await layersOf(page);
    started.length
      ? pass(`riverbend laid down its # FOLEY: ambience from the runner (${started.join(', ')})`)
      : fail('riverbend: its # FOLEY: tags reached no foley layer — the runner does not act on # FOLEY:');
    errs.length === 0 ? pass('riverbend: no page errors') : fail(`riverbend page errors: ${errs.slice(0, 2).join(' · ')}`);
    await page.close();
  }

  // ── 2. the leak itself, on ambience the runner DOES start ───────────
  // world-between-worlds opens with `# AUDIO: synth:wind`, which the runner
  // brokers to the shell's FinkFoley (story.audio, action 'foley'). That is a
  // looping bed started from a story, so the leak property is testable on it.
  {
    const { page, errs } = await newPage();
    await openStory(page, `http://127.0.0.1:${PORT}`, repoName, 'inklet/world-between-worlds.fink.js');
    await page.waitForFunction(() => Object.keys(window.FinkFoley?.layers || {}).length > 0, null, { timeout: 8000 })
      .catch(() => {});
    await page.waitForTimeout(1000);
    const started = await layersOf(page);
    started.length
      ? pass(`the story laid down its ambience through the runner (${started.join(', ')})`)
      : fail('no foley layers — this test cannot prove anything without them');

    // mute is a LEVEL, not a stop: the bed must still be running
    await page.evaluate(() => FoafOS.audio.setMuted(true));
    await page.waitForTimeout(300);
    const muted = await layersOf(page);
    muted.length === started.length && started.length > 0
      ? pass('mute silences without stopping (a level, not a stop)')
      : fail(`mute stopped layers: ${started.length} → ${muted.length}`);

    // now leave the story for a game — the ambience must not come with us
    await page.evaluate(() => FinkMinigames.startMinigame('gridluck', 'normal'));
    await page.waitForFunction(() => window.FinkWM?.active === true, null, { timeout: 15000 });
    await page.waitForTimeout(2500);
    const inGame = await layersOf(page);
    inGame.length === 0 && started.length > 0
      ? pass('opening a game window stops the story ambience')
      : fail(`story foley leaked into the game (or never started): ${inGame.join(', ')}`);

    // the actual symptom: unmute inside the game and hear the last story
    await page.evaluate(() => FoafOS.audio.setMuted(false));
    await page.waitForTimeout(400);
    const afterUnmute = await layersOf(page);
    afterUnmute.length === 0 && started.length > 0
      ? pass('unmuting inside the game is silent — no wind under the maze')
      : fail(`unmute revealed leaked ambience: ${afterUnmute.join(', ')}`);

    errs.length === 0 ? pass('no page errors')
      : fail(`page errors: ${errs.slice(0, 2).join(' · ')}`);
    await page.close();
  }
  console.log(process.exitCode ? '\nAUDIO LEAK E2E: FAIL' : '\nAUDIO LEAK E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 250)}`);
  console.log('\nAUDIO LEAK E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
