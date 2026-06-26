// test-groups.mjs — <edot-groups> in demo (loopback) mode: channels load, a sent
// message reflects into the timeline and the echo bot replies, participants
// render, and the groups.share capability posts a shared card. (A live XMPP
// server can't be exercised here — the loopback transport stands in.)
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
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
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/groups/groups.html`);
  await page.waitForSelector('edot-groups .gr-channel');
  await page.waitForTimeout(150);

  ok('demo seeds channels', (await page.$$('edot-groups .gr-channel')).length >= 2);
  ok('a channel is active and titled', /#general/.test(await page.textContent('.gr-head-name')));
  ok('demo-mode status is shown', /demo mode/i.test(await page.textContent('.gr-status')));
  ok('participants render for the active channel', (await page.$$('edot-groups .gr-person')).length >= 1);

  // Send a message → it reflects, and the echo bot replies.
  await page.fill('edot-groups .gr-input', 'hello world');
  await page.click('edot-groups .gr-send');
  await page.waitForFunction(() => [...document.querySelectorAll('edot-groups .gr-msg-body')].some((e) => /^echo: hello world/.test(e.textContent)), null, { timeout: 4000 });
  const bodies = await page.$$eval('edot-groups .gr-msg-body', (els) => els.map((e) => e.textContent));
  ok('the sent message appears in the timeline', bodies.includes('hello world'));
  ok('the echo bot replies in the channel', bodies.some((b) => /^echo: hello world/.test(b)));
  ok('my own message is right-aligned (.me)', await page.evaluate(() => [...document.querySelectorAll('.gr-msg.me .gr-msg-body')].some((e) => e.textContent === 'hello world')));

  // Switch channel and confirm timelines are separate.
  await page.click('edot-groups .gr-channel:nth-child(2)');
  await page.waitForTimeout(100);
  ok('switching channel changes the timeline', !(await page.$$eval('edot-groups .gr-msg-body', (els) => els.map((e) => e.textContent))).includes('hello world'));

  // groups.share capability posts a share card into the active channel.
  await page.evaluate(async () => {
    const { getKernel } = await import('../js/edot-kernel.js');
    return getKernel().capabilities.invoke('groups.share', { title: 'UK Bank Holidays', kind: 'calendar', payload: { events: 3 } });
  });
  await page.waitForFunction(() => !!document.querySelector('edot-groups .gr-share-card'), null, { timeout: 3000 });
  ok('groups.share posts a shared card into the channel', /calendar: UK Bank Holidays/.test(await page.textContent('edot-groups .gr-share-card')));

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally {
  await browser.close();
  server.close();
}
console.log(fail ? '\nGROUPS FAIL' : '\nGROUPS OK');
process.exit(fail ? 1 : 0);
