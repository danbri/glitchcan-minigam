// test-files.mjs — headless Playwright test for <edot-files>, the file browser
// over the unified storage layer. Seeds the device OPFS mount, then drives the
// real component DOM: listing, breadcrumb navigation, new folder, upload/write,
// opening a text file, delete, and lazy "Load more" windowing.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.ndjson': 'application/x-ndjson', '.gz': 'application/gzip' };
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
const base = `http://127.0.0.1:${port}/magpie/edot`;

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${base}/files/files.html`);
  await page.waitForSelector('edot-files .fl-app');

  // Seed the device OPFS mount BEFORE first render settles: a couple of files,
  // a subfolder with a file, and a "big" folder with > one page (50) of files.
  await page.evaluate(async (b) => {
    const { OpfsResourceSource } = await import(`${b}/js/resource-source.js`);
    const s = new OpfsResourceSource({ id: 'device' });
    const enc = (x) => new TextEncoder().encode(x);
    await s.write('/readme.txt', enc('Hello from edot files.'));
    await s.write('/data.bin', new Uint8Array([0, 1, 2, 3, 255, 254]));
    await s.write('/docs/note.txt', enc('a note inside docs'));
    // A folder with 120 files to force at least two list() windows (PAGE = 50).
    for (let i = 0; i < 120; i++) {
      const n = String(i).padStart(3, '0');
      await s.write(`/many/file-${n}.txt`, enc(`item ${n}`));
    }
  }, base);

  // Re-navigate root so the component lists the freshly-seeded entries.
  await page.evaluate(() => document.querySelector('edot-files').navigate('/'));
  await page.waitForFunction(() => document.querySelectorAll('edot-files .fl-row').length > 0);

  // 1) Lists folders first, then files.
  const rootRows = await page.$$eval('edot-files .fl-row .fl-name', (els) => els.map((e) => e.textContent));
  const rootKinds = await page.$$eval('edot-files .fl-open', (els) => els.map((e) => e.classList.contains('is-folder') ? 'folder' : 'file'));
  ok('lists folders and files of the root', rootRows.includes('docs') && rootRows.includes('many') && rootRows.includes('readme.txt') && rootRows.includes('data.bin'));
  const firstFileIdx = rootKinds.indexOf('file');
  const lastFolderIdx = rootKinds.lastIndexOf('folder');
  ok('folders are listed before files', firstFileIdx > lastFolderIdx);

  // 2) Navigate into a folder updates breadcrumb + listing.
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('edot-files .fl-open')];
    rows.find((r) => r.querySelector('.fl-name').textContent === 'docs').click();
  });
  await page.waitForFunction(() => [...document.querySelectorAll('edot-files .fl-name')].some((e) => e.textContent === 'note.txt'));
  const crumbs = await page.$$eval('edot-files .fl-crumb', (els) => els.map((e) => e.textContent));
  ok('navigating into a folder updates the breadcrumb', crumbs[0] === 'Home' && crumbs.includes('docs'));
  ok('breadcrumb marks the current folder with aria-current', await page.$eval('edot-files .fl-crumb[aria-current="location"]', (e) => e.textContent) === 'docs');
  ok('folder listing shows the folder’s file', (await page.$$eval('edot-files .fl-name', (els) => els.map((e) => e.textContent))).includes('note.txt'));

  // 3) Breadcrumb click navigates back to Home.
  await page.evaluate(() => [...document.querySelectorAll('edot-files .fl-crumb')].find((c) => c.textContent === 'Home').click());
  await page.waitForFunction(() => [...document.querySelectorAll('edot-files .fl-name')].some((e) => e.textContent === 'readme.txt'));
  ok('clicking Home in breadcrumb returns to root', (await page.$$eval('edot-files .fl-crumb', (els) => els.map((e) => e.textContent))).length === 1);

  // 4) New folder (stub the prompt so it's deterministic).
  await page.evaluate(() => { window.prompt = () => 'fresh'; });
  await page.click('edot-files .fl-new');
  await page.waitForFunction(() => [...document.querySelectorAll('edot-files .fl-name')].some((e) => e.textContent === 'fresh'));
  ok('"New folder" creates a folder', true);

  // 5) Upload / write a file shows it (drive the component's write path).
  await page.evaluate(async () => {
    const el = document.querySelector('edot-files');
    await el.mount.write('/uploaded.md', new TextEncoder().encode('# uploaded\nbody'));
    await el.navigate('/');
  });
  await page.waitForFunction(() => [...document.querySelectorAll('edot-files .fl-name')].some((e) => e.textContent === 'uploaded.md'));
  ok('writing/uploading a file shows it in the listing', true);

  // 6) Opening a text file shows its content in the viewer panel.
  await page.evaluate(() => [...document.querySelectorAll('edot-files .fl-open')].find((r) => r.querySelector('.fl-name').textContent === 'readme.txt').click());
  await page.waitForSelector('edot-files .fl-viewer:not([hidden]) .fl-viewer-body');
  const shown = await page.$eval('edot-files .fl-viewer-body', (e) => e.textContent);
  ok('opening a text file shows its content', shown === 'Hello from edot files.');

  // 6b) Opening a binary file offers a download instead of text.
  await page.evaluate(() => [...document.querySelectorAll('edot-files .fl-open')].find((r) => r.querySelector('.fl-name').textContent === 'data.bin').click());
  await page.waitForSelector('edot-files .fl-viewer:not([hidden]) .fl-download');
  ok('opening a binary file offers a download', await page.$('edot-files .fl-download') !== null);

  // 7) Delete removes an entry (stub confirm to accept).
  await page.evaluate(() => { window.confirm = () => true; });
  await page.evaluate(() => [...document.querySelectorAll('edot-files .fl-row')]
    .find((r) => r.querySelector('.fl-name').textContent === 'readme.txt')
    .querySelector('.fl-del').click());
  await page.waitForFunction(() => ![...document.querySelectorAll('edot-files .fl-name')].some((e) => e.textContent === 'readme.txt'));
  ok('delete removes an entry', true);

  // 8) Lazy "Load more" reveals a second window for a >1-page folder.
  // Close the open viewer panel first so it doesn't overlap the list controls.
  await page.evaluate(() => { const v = document.querySelector('edot-files .fl-viewer'); if (v) { v.hidden = true; v.innerHTML = ''; } });
  await page.evaluate(() => document.querySelector('edot-files').navigate('/many'));
  await page.waitForFunction(() => document.querySelectorAll('edot-files .fl-row').length >= 50);
  const firstWindow = await page.$$eval('edot-files .fl-row', (els) => els.length);
  ok('first window holds exactly one page (50)', firstWindow === 50);
  const hasMore = await page.$('edot-files .fl-load-more') !== null;
  ok('a full window surfaces a "Load more" control', hasMore);
  await page.click('edot-files .fl-load-more');
  await page.waitForFunction(() => document.querySelectorAll('edot-files .fl-row').length > 50);
  const secondWindow = await page.$$eval('edot-files .fl-row', (els) => els.length);
  ok('"Load more" reveals a second window', secondWindow > firstWindow && secondWindow === 100);

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs.slice(0, 4));
} finally {
  await browser.close();
  server.close();
}
console.log(fail ? '\nFILES FAIL' : '\nFILES OK');
process.exit(fail ? 1 : 0);
