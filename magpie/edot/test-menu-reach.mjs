// test-menu-reach.mjs — every menu must be REACHABLE, not merely open.
//
// Regression guard for the "hamburger menu does nothing useful" report:
// the File menu grew past two dozen items while its max-height/overflow
// clamp lived only inside a phones-only media query. On a normal window
// it therefore rendered ~1071px tall in an 800px viewport, so most of
// its contents sat below the fold with no way to scroll to them — a
// working menu that looked broken.
//
// Rule under test, at BOTH sizes: the panel opens, fits the viewport,
// and every item can be reached (scrolled to and clicked).
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ndjson': 'application/x-ndjson', '.wasm': 'application/wasm' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
    const buf = await readFile(path.join(ROOT, rel));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  for (const vp of [{ width: 1200, height: 800, name: 'desktop' }, { width: 390, height: 780, name: 'phone' }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.name === 'phone' });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port}/magpie/edot/edot.html`);
    await page.waitForSelector('#menu-button');
    await page.waitForTimeout(600);

    await page.click('#menu-button');
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const p = document.getElementById('menu-panel');
      const r = p.getBoundingClientRect();
      const items = [...p.querySelectorAll('.menu-item')];
      return {
        open: !p.hidden,
        items: items.length,
        fitsViewport: r.bottom <= window.innerHeight + 1 && r.top >= -1,
        scrollable: p.scrollHeight > p.clientHeight ? p.clientHeight > 0 : true,
        lastReachable: (() => {
          const last = items.at(-1);
          last.scrollIntoView({ block: 'nearest' });
          const lr = last.getBoundingClientRect(), pr = p.getBoundingClientRect();
          return lr.bottom <= pr.bottom + 1 && lr.bottom <= window.innerHeight + 1;
        })(),
      };
    });
    ok(`${vp.name}: File menu opens with its ${m.items} items`, m.open && m.items > 10);
    ok(`${vp.name}: panel fits inside the window`, m.fitsViewport);
    ok(`${vp.name}: the LAST item can be scrolled to and reached`, m.lastReachable);
    await page.close();
    await ctx.close();
  }
} catch (e) {
  ok(`fatal: ${String(e).slice(0, 160)}`, false);
} finally {
  await browser.close();
  server.close();
}
console.log(fail ? `\n${fail} failed` : '\nAll menu-reach checks passed');
process.exit(fail ? 1 : 0);
