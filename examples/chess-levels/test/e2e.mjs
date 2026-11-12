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
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }).end(b); }
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

await browser.close(); server.close();
if (failed) { console.log(`${failed} failed`); process.exit(1); }
