// The foafos-lite tutorial's Minichess (packages/foafos-guest/examples/minichess) in full foafos:
// level 2, a move is saved in its pod folder and is there after closing and reopening; New game
// from the window's ⋯ menu starts again. The server must send Access-Control-Allow-Origin (the
// app imports @foafos/guest as a module from a sandboxed frame).
//   SHELL_URL=... CHROMIUM_PATH=... node e2e-minichess-lite.mjs
import { chromium } from 'playwright';

const URL_ = process.env.SHELL_URL || 'http://localhost:8080/glitchcan-minigam/inklet/finkapp/?root=all&player=none';
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`); if (!ok) failed++; };
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
const gameFrame = async (page) => {
  for (let i = 0; i < 100; i++) { const f = page.frames().find((x) => x.url().includes('examples/minichess/')); if (f) return f; await page.waitForTimeout(100); }
  return null;
};
const open = async (page) => {
  await page.evaluate(() => FoafOS.launchApp('minichess-lite'));
  const f = await gameFrame(page);
  await f.waitForFunction(() => window.__minichess?.guest, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  return f;
};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(URL_);
  await page.waitForFunction(() => window.FoafOS?.launchApp, null, { timeout: 30000 });
  await page.waitForTimeout(700);
  let f = await open(page);
  check(await f.evaluate(() => window.__minichess.guest.level) === 2, 'Minichess is hosted at level 2');
  // A queen move, chosen from the game's own legal moves.
  const moved = await f.evaluate(() => { const m = getValidMovesForPiece(queenPos, 'queen')[0]; makeQueenMove(m.row, m.col); return m; });
  // The move, the king's reply, and the save after it.
  // The turn only passes to black once the queen's move has been drawn, so wait for black, then white.
  await f.waitForFunction(() => currentTurn === 'black' || gameOver, null, { timeout: 10000 });
  await f.waitForFunction(() => currentTurn === 'white' || gameOver, null, { timeout: 10000 });
  await page.waitForTimeout(500);
  const after = await f.evaluate(() => ({ queenPos, kingPos }));
  const saved = await page.evaluate(() => FoafOS.pods.invoke('minichess-lite', 'pod.get', { path: 'games/current.json' }));
  check(saved.ok && JSON.parse(saved.body).queenPos.col === after.queenPos.col, `the game is saved in its pod folder (${saved.ok ? saved.body : saved.reason})`);
  // Close and open again: the same position.
  await page.evaluate(() => [...document.querySelectorAll('.foafos-window')].find((w) => w.querySelector('iframe')?.src.includes('examples/minichess/')).querySelector('.foafos-window-close').click());
  await page.waitForTimeout(600);
  f = await open(page);
  const back = await f.evaluate(() => ({ queenPos, kingPos }));
  check(JSON.stringify(back) === JSON.stringify(after), `reopened, the game goes on where it was (${JSON.stringify(back)}; before closing ${JSON.stringify(after)})`);
  // New game from the window's menu.
  await page.click('.foafos-lite-menu');
  await page.click('.foafos-lite-list button');
  await page.waitForTimeout(600);
  const fresh = await f.evaluate(() => ({ queenPos, kingPos }));
  check(fresh.queenPos.row === 1 && fresh.queenPos.col === 2 && fresh.kingPos.row === 0 && fresh.kingPos.col === 0, `New game from the ⋯ menu starts again (${JSON.stringify(fresh)}, first move was ${JSON.stringify(moved)})`);
} catch (e) {
  console.log(`FAIL exception: ${e.message}`);
  failed++;
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
