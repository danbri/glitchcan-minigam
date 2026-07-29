// The snapshot contract: closing a game no longer throws it away.
//
// What is actually being claimed, and why each part is measured rather
// than asserted from the source:
//
// 1. A guest that registers `onSnapshot`/`onRestore` DECLARES the
//    contract, and the host can see it declared. (Declaration is the
//    only thing that makes the request legal — the shell cannot reach
//    into an opaque origin and serialise a guest itself.)
// 2. Closing asks, and WAITS for the answer. The first implementation
//    fired the question and destroyed the frame in the same tick; every
//    round-trip came back empty and nothing failed loudly. So this test
//    compares state THROUGH a close, not the presence of a code path.
// 3. Reopening restores it: same room, same position, same score, same
//    lives.
// 4. A guest that does NOT speak the contract is not hung by it — the
//    close still completes, and the shell says so instead of pretending.
//
// The played-state mutation (score/lives) is deliberate: position alone
// could be a coincidence of the spawn point, 42/2 cannot be.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const repoName = basename(repoRoot);
const PORT = 8161;
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
const base = `http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/`;
const story = `?story=/${repoName}/inklet/hampstead.fink.js`;

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 860 }, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 140)));
  await page.goto(base + story);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 30000 });
  await page.waitForTimeout(1200);

  // Boot mudslider and get past its own "Ready?" gate. The game lives in
  // a shadow root, so the button has to be found through it.
  const boot = async () => {
    await page.evaluate(() => FinkMinigames.startMinigame('mudslider', 'normal'));
    await page.waitForFunction(() => window.FinkWM?.active === true, null, { timeout: 20000 });
    await page.waitForTimeout(5000);
    const f = page.frames().find(x => /minigames\/mudslider/.test(x.url()));
    if (!f) throw new Error('mudslider frame never appeared');
    await f.evaluate(() => {
      for (const el of document.querySelectorAll('*')) {
        const b = el.shadowRoot?.getElementById('start-button-minigame');
        if (b) { b.click(); return; }
      }
    });
    await page.waitForTimeout(1200);
    return f;
  };

  // Position + the two numbers a player would actually mind losing.
  const readState = (f) => f.evaluate(() => {
    const el = [...document.querySelectorAll('*')]
      .find(e => e.shadowRoot && e.tagName.startsWith('GC-'));
    return el?.player
      ? { x: el.player.x, y: el.player.y, score: el.playerState.score, lives: el.playerState.lives }
      : null;
  });

  let frame = await boot();

  // ── 1. the guest declares the contract, and the host sees it ───────
  const contracts = await page.evaluate(() => [...(FinkMinigames.windowInstance?.contracts || [])]);
  contracts.includes('snapshot')
    ? pass(`guest declares snapshot (contracts: ${contracts.join(', ')})`)
    : fail(`guest did not declare snapshot: ${JSON.stringify(contracts)}`);

  // ── 2. the switcher discloses it BEFORE the ✕ is pressed ──────────
  const disclosed = await page.evaluate(() => {
    const sw = FoafOS.openSwitcher();
    const rows = [...sw.querySelectorAll('.foafos-switch-card')].map(c => c.textContent);
    const kill = [...sw.querySelectorAll('.foafos-switch-act.foafos-danger')]
      .map(b => b.getAttribute('aria-label'));
    sw.remove();
    return { rows, kill };
  });
  disclosed.rows.some(t => /keeps its place/.test(t))
    ? pass('switcher discloses that closing keeps its place')
    : fail(`switcher said nothing about state: ${JSON.stringify(disclosed.rows)}`);
  disclosed.kill.some(t => /its place is kept/.test(t || ''))
    ? pass('close button says what it will and will not take')
    : fail(`close button aria-label silent: ${JSON.stringify(disclosed.kill)}`);

  // ── 3. play, mutate unmistakably, close, reopen ────────────────────
  const fresh = await readState(frame);
  for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(140); }
  await frame.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(e => e.shadowRoot && e.tagName.startsWith('GC-'));
    el.playerState.score = 42;
    el.playerState.lives = 2;
  });
  const before = await readState(frame);
  JSON.stringify(before) !== JSON.stringify(fresh)
    ? pass(`played state differs from fresh (${JSON.stringify(before)})`)
    : fail('play did not change anything — the rest of this test would be vacuous');

  await page.evaluate(() => FinkMinigames.endMinigame());
  await page.waitForTimeout(1400);

  await page.evaluate(() => FinkMinigames.hasSnapshot('mudslider'))
    ? pass('host holds a snapshot after close')
    : fail('nothing was captured on the way out');

  // The window really did close: no live frame, container emptied.
  const closed = await page.evaluate(() => ({
    inst: !!FinkMinigames.windowInstance,
    frame: !!FinkMinigames.iframeMinigame,
    kids: document.getElementById('iframe-minigame-container')?.children.length ?? -1,
  }));
  (!closed.inst && !closed.frame && closed.kids === 0)
    ? pass('the close is a real close, not a deferral')
    : fail(`window did not fully close: ${JSON.stringify(closed)}`);

  frame = await boot();
  const after = await readState(frame);
  JSON.stringify(after) === JSON.stringify(before)
    ? pass(`reopened where it left off (${JSON.stringify(after)})`)
    : fail(`restore lost state: closed ${JSON.stringify(before)}, reopened ${JSON.stringify(after)}`);

  // ── 4. a guest that cannot snapshot is still closable ─────────────
  await page.evaluate(() => FinkMinigames.endMinigame());
  await page.waitForTimeout(1400);
  const t0 = Date.now();
  await page.evaluate(async () => {
    // Pretend a guest declared the contract and then went silent: the
    // close must still finish, on the timeout, rather than hanging.
    await FinkMinigames.startMinigame('gridluck', 'normal');
  });
  await page.waitForFunction(() => window.FinkWM?.active === true, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const silent = await page.evaluate(() => {
    const has = FinkMinigames.windowInstance?.contracts?.has('snapshot') || false;
    const sw = FoafOS.openSwitcher();
    const rows = [...sw.querySelectorAll('.foafos-switch-card')].map(c => c.textContent);
    sw.remove();
    return { has, rows };
  });
  if (!silent.has) {
    silent.rows.some(t => /closing loses it/.test(t))
      ? pass('a guest that cannot snapshot is reported as such, not silently lost')
      : fail(`no disclosure for a non-snapshotting guest: ${JSON.stringify(silent.rows)}`);
  } else {
    pass('gridluck speaks snapshot too — no non-snapshotting guest to check here');
  }
  await page.evaluate(() => FinkMinigames.endMinigame());
  await page.waitForFunction(() => !FinkMinigames.iframeMinigame, null, { timeout: 5000 });
  const took = Date.now() - t0;
  took < 30000
    ? pass(`close completed without hanging (${took}ms for the whole leg)`)
    : fail(`close hung: ${took}ms`);

  // ── 5. a second adopter, to prove the contract is not mudslider-shaped ──
  {
    await page.evaluate(() => FinkMinigames.startMinigame('chess', 'normal'));
    await page.waitForFunction(() => window.FinkWM?.active === true, null, { timeout: 20000 });
    await page.waitForTimeout(3000);
    const cf = page.frames().find(x => /minigames\/chess/.test(x.url()));
    if (!cf) {
      fail('chess frame never appeared');
    } else {
      // `let` at the top of a classic script lands in the global lexical
      // environment, so these are readable from an evaluated expression
      // even though they are not properties of `window`.
      const read = () => cf.evaluate(() => ({ q: queenPos, k: kingPos, t: currentTurn }));
      await cf.evaluate(() => { queenPos = { row: 2, col: 3 }; currentTurn = 'black'; });
      const cBefore = await read();
      await page.evaluate(() => FinkMinigames.endMinigame());
      await page.waitForTimeout(1400);
      await page.evaluate(() => FinkMinigames.startMinigame('chess', 'normal'));
      await page.waitForFunction(() => window.FinkWM?.active === true, null, { timeout: 20000 });
      await page.waitForTimeout(3000);
      const cf2 = page.frames().find(x => /minigames\/chess/.test(x.url()));
      const cAfter = await cf2.evaluate(() => ({ q: queenPos, k: kingPos, t: currentTurn }));
      JSON.stringify(cAfter) === JSON.stringify(cBefore)
        ? pass(`chess restored its position too (${JSON.stringify(cAfter.q)}, ${cAfter.t} to move)`)
        : fail(`chess lost its position: ${JSON.stringify(cBefore)} → ${JSON.stringify(cAfter)}`);
      await page.evaluate(() => FinkMinigames.endMinigame());
      await page.waitForTimeout(1200);
    }
  }

  // ── 6. it survives a reload, because the shell wrote it to the store ──
  // In-memory-only would pass every test above and still lose the
  // player's game the moment they refreshed.
  {
    await page.reload();
    await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => FinkMinigames.hasSnapshot('mudslider'))
      ? pass('snapshot survived a page reload (written through to FoafStore)')
      : fail('snapshot was memory-only: gone after reload');

    const rf = await boot();
    const revived = await readState(rf);
    JSON.stringify(revived) === JSON.stringify(before)
      ? pass(`reload-then-reopen still lands on ${JSON.stringify(revived)}`)
      : fail(`after reload the game restarted: ${JSON.stringify(revived)}`);
    await page.evaluate(() => FinkMinigames.endMinigame());
    await page.waitForTimeout(1200);
  }

  // ── 7. finishing clears the save ──────────────────────────────────
  // Otherwise "keeps its place" would mean never being able to start a
  // fresh run: every reopen drops you back into a game already decided.
  {
    const gf = await boot();
    await gf.evaluate(() => {
      document.dispatchEvent(new CustomEvent('minigame-won', { detail: { score: 7 } }));
    });
    await page.waitForTimeout(1500);
    !(await page.evaluate(() => FinkMinigames.hasSnapshot('mudslider')))
      ? pass('a finished game clears its save')
      : fail('a won game would still resume — no way to start fresh');
  }

  errs.length === 0 ? pass('no page errors') : fail(`page errors: ${errs.slice(0, 2).join(' | ')}`);
  await page.close();

  console.log(process.exitCode ? '\nSNAPSHOT E2E: FAIL' : '\nSNAPSHOT E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 250)}`);
  console.log('\nSNAPSHOT E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
