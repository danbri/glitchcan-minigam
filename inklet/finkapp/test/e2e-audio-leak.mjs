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
  const page = await browser.newPage({ viewport: { width: 430, height: 860 }, hasTouch: true });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 160)));

  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?player=legacy&story=/${repoName}/inklet/riverbend.fink.js`);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
  await page.waitForTimeout(2000);

  const layers = () => page.evaluate(() => Object.keys(window.FinkFoley?.layers || {}));
  const started = await layers();
  started.length
    ? pass(`riverbend laid down its ambience (${started.join(', ')})`)
    : fail('no foley layers — this test cannot prove anything without them');

  // mute is a LEVEL, not a stop: the bed must still be running
  await page.evaluate(() => FoafOS.audio.setMuted(true));
  await page.waitForTimeout(300);
  const muted = await layers();
  muted.length === started.length
    ? pass('mute silences without stopping (a level, not a stop)')
    : fail(`mute stopped layers: ${started.length} → ${muted.length}`);

  // now leave the story for a game — the river must not come with us
  await page.evaluate(() => FinkMinigames.startMinigame('gridluck', 'normal'));
  await page.waitForFunction(() => window.FinkWM?.active === true, null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  const inGame = await layers();
  inGame.length === 0
    ? pass('opening a game window stops the story ambience')
    : fail(`story foley leaked into the game: ${inGame.join(', ')}`);

  // the actual symptom: unmute inside the game and hear the last story
  await page.evaluate(() => FoafOS.audio.setMuted(false));
  await page.waitForTimeout(400);
  const afterUnmute = await layers();
  afterUnmute.length === 0
    ? pass('unmuting inside the game is silent — no river under the maze')
    : fail(`unmute revealed leaked ambience: ${afterUnmute.join(', ')}`);

  pageErrors.length === 0 ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 2).join(' · ')}`);
  console.log(process.exitCode ? '\nAUDIO LEAK E2E: FAIL' : '\nAUDIO LEAK E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 250)}`);
  console.log('\nAUDIO LEAK E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
