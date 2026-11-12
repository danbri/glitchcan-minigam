// The chess app in a real browser. Serves the repository from a local port, plays a few moves,
// and saves screenshots to SHOTS (if set).
//   CHROMIUM_PATH=... SHOTS=/some/dir node examples/chess-levels/test/e2e.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../../..');
const TYPES = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream', 'access-control-allow-origin': '*' }).end(b); }
  catch { res.writeHead(404).end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/examples/chess-levels/`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
const shot = async (page, name) => { if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, `chess-${name}.png`) }); };
let failed = 0;
async function check(name, fn) {
  const page = await browser.newPage({ viewport: { width: 520, height: 600 } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  try { await fn(page); assert.deepEqual(errors, []); console.log(`ok - ${name}`); }
  catch (e) { failed++; console.log(`not ok - ${name}\n  ${String(e.message || e).split('\n').join('\n  ')}`); }
  await page.close();
}
const sq = (page, s) => page.locator(`#board [data-sq="${s}"]`);
const pieceAt = (page, s) => sq(page, s).getAttribute('aria-label');

await check('level 0: plays alone, black answers, undo takes back both', async (page) => {
  await page.goto(base + 'index.html');
  await sq(page, 'c2').click();
  assert.equal(await page.locator('#board .target').count(), 1);
  await sq(page, 'c3').click();
  await page.waitForFunction(() => /Your move/.test(document.getElementById('status').textContent));
  assert.equal(await pieceAt(page, 'c2'), 'c2 empty');   // white moved (and black may have taken on c3)
  await shot(page, 'level0');
  await page.click('#undo');
  assert.equal(await pieceAt(page, 'c2'), 'c2 white pawn');
  assert.equal(await pieceAt(page, 'c3'), 'c3 empty');
  for (const f of 'abcde') assert.equal(await pieceAt(page, f + '4'), f + '4 black pawn');
});

await check('level 0: keyboard only', async (page) => {
  await page.goto(base + 'index.html');
  await sq(page, 'b2').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /Your move/.test(document.getElementById('status').textContent));
  assert.equal(await pieceAt(page, 'b2'), 'b2 empty');
});

const app = (page) => page.frameLocator('#app');
const appSq = (page, s) => app(page).locator(`#board [data-sq="${s}"]`);
const sent = (page) => page.$$eval('#sent li', (lis) => lis.map((li) => JSON.parse(li.textContent)));

await check('level 1: in a sandboxed frame, hosted', async (page) => {
  await page.setViewportSize({ width: 980, height: 640 });
  await page.goto(base + 'host.html');
  await page.waitForFunction(() => document.getElementById('level').textContent === '2');
  await page.locator('#menu button', { hasText: 'Undo' }).waitFor();
  await page.waitForFunction(() => /"ready"/.test(document.getElementById('sent').textContent));
  // pause while black is thinking: black does not move until resumed
  await appSq(page, 'c2').click(); await appSq(page, 'c3').click();
  await page.click('#pause');
  await page.waitForFunction(() => /acknowledged/.test(document.getElementById('state').textContent));
  await page.waitForTimeout(800);
  assert.match(await app(page).locator('#status').textContent(), /Paused/);
  const before = await app(page).locator('#board').innerHTML();
  await page.waitForTimeout(600);
  assert.equal(await app(page).locator('#board').innerHTML(), before);
  await shot(page, 'level1-paused');
  await page.click('#resume');
  await app(page).locator('#status', { hasText: 'Your move' }).waitFor();
  assert.notEqual(await app(page).locator('#board').innerHTML(), before);   // black moved only now
  // the host's menu drives the app
  await page.locator('#menu button', { hasText: 'New game' }).click();
  assert.equal(await appSq(page, 'c2').getAttribute('aria-label'), 'c2 white pawn');
  await page.check('#pip');
  await app(page).locator('nav').waitFor({ state: 'hidden' });
  await shot(page, 'level1-small');
  // What the app sent, all of it: hello (level, name, menu), ready, paused, and (level 2) its saved game.
  const msgs = await sent(page);
  assert.deepEqual(msgs.filter((m) => m.type !== 'store').map((m) => m.type), ['hello', 'ready', 'paused']);
  assert.deepEqual(msgs[0], { fl: 1, type: 'hello', level: 2, name: 'Chess 5×5', actions: [{ id: 'new', label: 'New game' }, { id: 'undo', label: 'Undo' }] });
  for (const m of msgs.filter((m) => m.type === 'store')) {
    assert.deepEqual(m.path, ['games', 'current.json']);
    assert.ok(m.op === 'get' || (m.op === 'put' && Object.keys(JSON.parse(m.body)).join() === 'moves'), JSON.stringify(m));
  }
});

await check('level 2: the game is kept in the host\'s folder and carries on after a reload', async (page) => {
  await page.setViewportSize({ width: 980, height: 640 });
  await page.goto(base + 'host.html');
  await page.waitForFunction(() => document.getElementById('level').textContent === '2');
  await appSq(page, 'b1').click(); await appSq(page, 'c3').click();
  await app(page).locator('#status', { hasText: 'Your move' }).waitFor();
  const board = await app(page).locator('#board').innerHTML();
  await page.locator('#folder li', { hasText: 'chess/games/current.json' }).waitFor();
  const kept = JSON.parse((await page.locator('#folder li').first().textContent()).split('  ')[1]);
  assert.equal(kept.moves.length, 2);
  assert.equal(kept.moves[0], 'b1c3');
  await page.click('#reload');
  await page.waitForFunction(() => document.getElementById('level').textContent === '2');
  await app(page).locator('#status', { hasText: 'Your move' }).waitFor();
  await page.waitForFunction((b) => document.querySelector('#app').contentDocument === null, board);   // still sandboxed
  await page.waitForTimeout(200);
  assert.equal(await app(page).locator('#board').innerHTML(), board);
  await shot(page, 'level2-reloaded');
});

await check('level 2: with no host, the game is kept in the browser and carries on after a reload', async (page) => {
  await page.goto(base + 'index.html');
  await sq(page, 'e2').click(); await sq(page, 'e3').click();
  await page.waitForFunction(() => /Your move/.test(document.getElementById('status').textContent));
  const board = await page.locator('#board').innerHTML();
  await page.reload();
  await page.waitForFunction((b) => document.getElementById('board').innerHTML === b, board, { timeout: 3000 });
  await page.click('#new');   // leave nothing behind for other tests
});

await check('level 1: framed by a page that is not a host, it still plays (level 0)', async (page) => {
  await page.setContent(`<iframe id="app" sandbox="allow-scripts" src="${base}index.html" style="width:500px;height:560px"></iframe>`);
  await appSq(page, 'c2').click(); await appSq(page, 'c3').click();
  await app(page).locator('#status', { hasText: 'Your move' }).waitFor();
});

await browser.close(); server.close();
if (failed) { console.log(`${failed} failed`); process.exit(1); }
