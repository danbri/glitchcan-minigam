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
  check(await f.evaluate(() => window.__minichess.guest.level) === 3, 'Minichess is hosted at level 3');
  // Level 3: its tools are in the shell's registry, and play works through them; the board is on the bus.
  await page.waitForFunction(() => FoafOS.tools.find('minichess-lite')?.tools.length === 4, null, { timeout: 10000 }).catch(() => {});
  const viaTools = await page.evaluate(async () => {
    const { PERSON } = await import('../../packages/foafos/src/tool-grants.mjs');
    const seen = [];
    const un = FoafOS.bus.subscribe('app.minichess-lite.board', (e) => seen.push(e.data));
    const call = (t, a = {}) => FoafOS.tools.call('minichess-lite', t, a, { caller: PERSON });
    const names = FoafOS.tools.find('minichess-lite').tools.map((t) => t.name + (t.readOnly ? '' : '*')).join();
    const legal = await call('legal_moves');
    const moved = await call('move', { to: legal.value[0] });
    const bad = await call('move', { to: 'z9' });
    const fresh = await call('new_game');
    await new Promise((r) => setTimeout(r, 400));
    un();
    return { names, legal: legal.value, moved: moved.value, bad: bad.ok === false && /a square is/.test(bad.error || ''), fresh: fresh.value, seen: seen.length, lastSeen: seen.at(-1) };
  });
  check(viaTools.names === 'board,legal_moves,move*,new_game*', `its four tools are offered (${viaTools.names})`);
  check(Array.isArray(viaTools.legal) && viaTools.legal.length > 0 && viaTools.moved?.queen === viaTools.legal[0] && viaTools.moved?.turn !== 'king',
    `legal_moves and move play through the tools, the king replying (${JSON.stringify(viaTools.moved)})`);
  check(viaTools.bad, 'a move to a square that is not on the board is refused with a reason');
  check(viaTools.fresh?.queen === 'c2' && viaTools.seen > 0 && viaTools.lastSeen?.queen === 'c2', `the board is published on the bus as it changes (${viaTools.seen} events)`);

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
