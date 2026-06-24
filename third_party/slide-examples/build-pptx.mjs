// build-pptx.mjs — produce real .pptx files from the self-authored JSON decks by
// running the edot slides app's OWN PPTX exporter headlessly (no python-pptx,
// no library — the bytes are exactly what the app ships). This both delivers
// real CC0 .pptx fixtures and exercises the export→import round-trip end to end.
//
// Mirrors the harness in magpie/edot/slides/test-slides.mjs: a tiny static
// server rooted at the repo, the app loaded in Chromium, decks driven via
// window.__slides. Run with `node build-pptx.mjs` from this directory.

import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

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

// Which JSON decks to export to .pptx (the brief requires at least corporate +
// multilingual; we also do equations + torture as bonus fixtures).
const DECKS = ['corporate', 'multilingual-rtl', 'equations', 'torture'];

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => { console.error('PAGE ERROR', String(e)); });
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/slides/slides.html`);
  await page.waitForFunction(() => window.__slides && window.__slides.formats);

  for (const name of DECKS) {
    const json = await readFile(path.join(HERE, `${name}.json`), 'utf8');
    // Export inside the page using the real codec, return base64 bytes out.
    const b64 = await page.evaluate(async (text) => {
      const S = window.__slides;
      const deck = S.formats.jsonToDeck(text); // normalize via native import path
      const blob = await S.formats.deckToPptx(deck);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    }, json);
    const bytes = Buffer.from(b64, 'base64');
    await writeFile(path.join(HERE, `${name}.pptx`), bytes);
    console.log(`wrote ${name}.pptx (${bytes.length} bytes)`);
  }
} finally {
  await browser.close();
  server.close();
}
