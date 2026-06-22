// test-mobile.mjs — mobile-first behaviour: tap-to-focus (keyboard),
// touch-driven File menu, and a locked app shell (no document overscroll).
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(async (req, res) => { try { const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'edot.html'; const buf = await readFile(path.join(DIR, rel)); res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' }); res.end(buf); } catch { res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, r)); const port = server.address().port;
const b = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };
try {
  // iPhone-ish: small viewport, touch, mobile UA.
  const ctx = await b.newContext({ viewport: { width: 390, height: 720 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/edot.html`);
  await page.waitForFunction(() => !!window.__edot && !!window.__edot.doc);

  // The toolbar must keep real height + all its buttons (Safari was crushing
  // it to a sliver under the locked flex shell).
  const tb = await page.evaluate(() => {
    const t = document.getElementById('toolbar');
    return { h: t.getBoundingClientRect().height, btns: t.querySelectorAll('.tbtn').length };
  });
  ok('toolbar has its buttons', tb.btns >= 12);
  ok('toolbar is not crushed (>=36px tall)', tb.h >= 36);

  // Start a clean doc, then TAP the page -> editor must take focus.
  await page.click('#menu-button'); await page.tap('#mi-new'); await page.waitForTimeout(200);
  const box = await page.locator('#editor').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + 80); // tap on the page body
  await page.waitForTimeout(150);
  ok('tap on page focuses the editor', await page.evaluate(() => document.activeElement && document.activeElement.id === 'editor'));

  // Tapping the grey margin (outside the page) also focuses via JS.
  await page.evaluate(() => document.activeElement.blur());
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height - 6);
  await page.waitForTimeout(150);
  ok('tap on margin focuses the editor', await page.evaluate(() => document.activeElement && document.activeElement.id === 'editor'));

  // Now typing should land in the editor.
  await page.keyboard.type('typed on mobile');
  await page.waitForTimeout(150);
  ok('typing after tap reaches the editor', /typed on mobile/.test(await page.textContent('#editor')));

  // File menu opens on tap and an item is reachable.
  await page.tap('#menu-button'); await page.waitForTimeout(150);
  ok('File menu opens on tap', await page.isVisible('#menu-panel'));
  ok('menu button reports expanded', await page.getAttribute('#menu-button', 'aria-expanded') === 'true');
  ok('a Save-as item is visible', await page.isVisible('text=Save as PDF'));
  // tapping an item acts (open library dialog) and closes the menu
  await page.tap('#mi-docs'); await page.waitForTimeout(200);
  ok('menu item action fired (library dialog open)', await page.evaluate(() => document.getElementById('docs-dialog').open === true));
  await page.evaluate(() => document.getElementById('docs-dialog').close());

  // App shell is locked: body/html don't scroll, overscroll contained.
  const shell = await page.evaluate(() => {
    const cs = (el) => getComputedStyle(el);
    return {
      htmlOverflow: cs(document.documentElement).overflow,
      bodyOverflow: cs(document.body).overflow,
      htmlOverscroll: cs(document.documentElement).overscrollBehavior || cs(document.documentElement).overscrollBehaviorY,
      mainOverscroll: cs(document.querySelector('.app-main')).overscrollBehavior || cs(document.querySelector('.app-main')).overscrollBehaviorY,
      bodyScrollable: document.body.scrollHeight > document.body.clientHeight + 1,
    };
  });
  ok('html overflow hidden', shell.htmlOverflow === 'hidden');
  ok('body overflow hidden', shell.bodyOverflow === 'hidden');
  ok('document overscroll is none', /none/.test(shell.htmlOverscroll));
  ok('scroll region contains overscroll', /contain/.test(shell.mainOverscroll));
  ok('body itself does not scroll', shell.bodyScrollable === false);

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally { await b.close(); server.close(); }
console.log(fail ? `\n${fail} MOBILE FAILURE(S)` : '\nMOBILE OK');
process.exit(fail ? 1 : 0);
