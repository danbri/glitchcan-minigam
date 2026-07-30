#!/usr/bin/env node
// Play boidwars headless, inside the shell, and report what happened.
//
//   node inklet/finkapp/test/play-boidwars.mjs [--turns 8] [--slow 5] [--shots]
//
// This is a PLAYTEST, not an assertion suite: it drives a real battle
// through the real input path and prints a turn-by-turn account, so a
// human (or the next model) can see whether the game is actually
// playable in the shell rather than merely loading in it.
//
// Boidwars is turn-based artillery, which makes it a good headless
// subject: the interesting moments are discrete, and between them the
// game is just flocking. Real-time guests need the debug clock badly;
// this one mostly needs patience. `--slow N` runs the whole thing N×
// slower anyway, which is how you'd inspect a cast frame by frame.
//
// `--shots` writes PNGs to /tmp/boidwars-*.png (SwiftShader; fine for
// "what is on screen", useless for how it feels).

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const TURNS = argOf('--turns', 8);
const SLOW = argOf('--slow', 1);
const SHOTS = args.includes('--shots');

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8151;
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

const log = (...a) => console.log(...a);
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push((e.stack || String(e)).split('\n').slice(0, 2).join(' | ')));

  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?player=legacy&story=/${repoName}/inklet/hampstead.fink.js`);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => FinkMinigames.startMinigame('battleboids', 'normal'));

  let game = null;
  for (let i = 0; i < 60 && !game; i++) {
    game = page.frames().find(f => f.url().includes('thumbwar/battleboids.html'));
    if (!game) await page.waitForTimeout(250);
  }
  if (!game) throw new Error('boidwars frame never appeared');
  await game.waitForFunction(() => !!window.__boidwars, null, { timeout: 20000 });

  if (SLOW > 1) {
    await page.evaluate((s) => __finkDebug.setTimeScale(1 / s), SLOW);
    log(`clock: ${SLOW}× slow\n`);
  }

  // The game ENDING is a legitimate outcome, and when it does the shell
  // closes the window and this frame detaches — so every read has to
  // survive that rather than crashing the run one turn before the
  // interesting part.
  let closed = false;
  const EMPTY = { state: 'closed', turn: -1, myTurn: false, msg: '', wizards: [], boids: 0,
                  stats: { player1: {}, player2: {} }, grid: {} };
  const st = async () => {
    if (closed) return EMPTY;
    try {
      return await game.evaluate(() => {
        const b = window.__boidwars;
        return { state: b.state, turn: b.turn, myTurn: b.myTurn, msg: b.message,
                 wizards: b.wizards, boids: b.boids, stats: b.stats, grid: b.grid };
      });
    } catch {
      closed = true;
      return EMPTY;
    }
  };

  // What the shell saw, once the guest is gone: the SDK result is the
  // only record left of who won.
  const hostVerdict = () => page.evaluate(() => ({
    stillRunning: !!document.querySelector('#minigame-iframe-battleboids'),
    won: FinkInkEngine?.story?.variablesState?.['battleboids_won'],
    scratch: window.FoafOS?.vars ? Object.fromEntries(FoafOS.vars.scratch) : null,
    denied: window.FoafOS?.vars?.log.filter(e => !e.ok).map(e => `${e.name}: ${e.reason}`) || [],
  })).catch(() => null);

  // wall-clock budget scales with the debug clock, or a slowed run times
  // out before the game has done anything
  const budget = (ms) => ms * Math.max(1, SLOW);
  const waitFor = async (pred, ms, label) => {
    const t0 = Date.now();
    while (Date.now() - t0 < budget(ms)) {
      const s = await st();
      if (s.state === 'closed') return s;
      if (pred(s)) return s;
      await page.waitForTimeout(250);
    }
    log(`  … gave up waiting for ${label} after ${Math.round((Date.now() - t0) / 1000)}s`);
    return null;
  };

  // the splash clears before resetGameInternal() has placed the wizards
  let s = await waitFor(x => x.state !== 'splash_html' && x.wizards.length === 2,
    25000, 'the battle to be set up');
  if (!s) throw new Error('game never started');
  log(`booted: ${s.grid.w}×${s.grid.h} grid, ${s.wizards.length} wizards`);
  log(`start:  ${s.wizards.map(w => `${w.isAI ? 'PURPLE(ai)' : 'BLUE(you)'} ${w.health}hp @${w.x},${w.y}`).join('  ·  ')}\n`);

  if (SHOTS) await page.screenshot({ path: '/tmp/boidwars-00-start.png' });

  const history = [];
  let turn = 0;
  let stalled = 0;

  while (turn < TURNS) {
    s = await waitFor(x => x.myTurn || x.state === 'gameOver', 30000, 'my turn');
    if (!s) { stalled++; if (stalled >= 2) { log('\nSTALLED: never got another turn.'); break; } continue; }
    if (s.state === 'gameOver' || s.state === 'closed') break;
    stalled = 0;
    turn++;

    // Aim: walk the shot in. Artillery wants a spread, not one lucky
    // pixel — vary height and lead so a miss teaches us something.
    const dx = [0, -30, 30, -60, 60][turn % 5];
    const dy = [0, -20, 20, -40, 10][turn % 5];
    const shot = await game.evaluate(([x, y]) => {
      const t = window.__boidwars.aimAtEnemy(x, y);
      return t && window.__boidwars.cast(t.x, t.y) ? t : null;
    }, [dx, dy]);

    const before = s;
    if (!shot) { log(`turn ${turn}: could not cast (state=${s.state} turn=${s.turn})`); continue; }

    // Let the boids fly. NOTE: a flock takes longer to cross the map
    // than a turn lasts, so damage from this cast usually lands during
    // the NEXT turn. Per-turn deltas are meaningless here — track the
    // health curve instead and attribute nothing.
    const after = await waitFor(x => x.turn === 1 || x.state === 'gameOver', 25000, 'the shot to land') || await st();
    const hpDelta = (after.wizards[1]?.health ?? 0) - (before.wizards[1]?.health ?? 0);
    history.push({ turn, aim: `${dx >= 0 ? '+' : ''}${dx},${dy >= 0 ? '+' : ''}${dy}`, hpDelta,
                   enemyHp: after.wizards[1]?.health, myHp: after.wizards[0]?.health,
                   boids: after.boids, attackers: after.stats.player1.attackers });
    // attackers vs workers is the whole story of a boidwars shot: a
    // flock that all went to work mined terrain instead of fighting
    const p1 = after.stats.player1;
    log(`turn ${turn}: cast at (${Math.round(shot.x)},${Math.round(shot.y)}) offset ${dx},${dy}` +
        ` → purple ${before.wizards[1]?.health}hp → ${after.wizards[1]?.health}hp` +
        `${hpDelta ? ` (${hpDelta})` : ' (no damage)'}`);
    log(`         flock: ${after.boids} aloft · ${p1.attackers} attacking · ${p1.workers} mining` +
        ` · blue wizard at ${after.wizards[0]?.x},${after.wizards[0]?.y} purple at ${after.wizards[1]?.x},${after.wizards[1]?.y}`);
    if (SHOTS && turn <= 3) await page.screenshot({ path: `/tmp/boidwars-${String(turn).padStart(2, '0')}-cast.png` });

    if (after.state === 'gameOver' || after.state === 'closed') break;

    // the AI's reply
    const reply = await waitFor(x => x.myTurn || x.state === 'gameOver', 30000, "the AI's reply");
    if (reply) {
      const mine = reply.wizards[0]?.health, was = after.wizards[0]?.health;
      if (mine !== was) log(`         AI replied: blue ${was}hp → ${mine}hp`);
      if (reply.state === 'gameOver' || reply.state === 'closed') { s = reply; break; }
    }
  }

  const end = await st();
  const last = history[history.length - 1] || {};
  log(`\n--- after ${turn} turn${turn === 1 ? '' : 's'} ---`);
  if (end.state === 'closed') {
    const v = await hostVerdict();
    log('state:  BATTLE OVER — the guest completed and the shell closed the window');
    log(`result: battleboids_won = ${v?.won}` +
        (v?.scratch && 'battleboids_won' in v.scratch
          ? '  (held in the broker\'s scratch: no story declares this VAR)' : ''));
    if (v?.denied?.length) log(`denied: ${v.denied.slice(0, 3).join(' · ')}`);
  } else {
    log(`state:  ${end.state}${end.msg ? `  "${end.msg.trim()}"` : ''}`);
    log(`health: ${end.wizards.map(w => `${w.isAI ? 'PURPLE' : 'BLUE'} ${w.health}`).join(' · ')}`);
    log(`board:  ${end.boids} boids · blue mountain ${end.stats.player1.mountainBlocks} blocks` +
        ` · purple ${end.stats.player2.mountainBlocks}`);
  }

  const curve = history.map(h => h.enemyHp).join(' → ');
  const dealt = 7 - (end.wizards[1]?.health ?? last.enemyHp ?? 7);
  const taken = 7 - (end.wizards[0]?.health ?? last.myHp ?? 7);
  log(`\nshots:  ${history.length} cast`);
  log(`purple: 7 → ${curve}   (${dealt} damage dealt)`);
  log(`blue:   ${taken} damage taken`);
  if (history.length && !dealt) {
    log('        NOTHING got through in the whole run. In boidwars an');
    log('        attacking boid dies the instant it touches solid rock, so');
    log('        a flock that cannot clear the mountains just mines them —');
    log('        check the world aspect and the mountain silhouette.');
  }
  log(errors.length ? `errors: ${errors.length}\n  ${errors.slice(0, 4).join('\n  ')}` : 'errors: none');
  if (SHOTS) { await page.screenshot({ path: '/tmp/boidwars-99-end.png' }); log('shots:  /tmp/boidwars-*.png'); }
} catch (e) {
  console.error('fatal:', String(e).slice(0, 400));
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
