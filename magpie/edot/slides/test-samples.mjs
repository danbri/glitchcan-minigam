// test-samples.mjs — headless test of the third_party/slide-examples/ sample
// decks: every self-authored deck imports through the native JSON path without
// error and preserves its slide count + text, and the real .pptx exports
// re-import (round-trip) preserving titles INCLUDING the RTL strings.
//
// Same harness style as test-slides.mjs: a static server rooted at the repo,
// the real <edot-slides> driven in Chromium via window.__slides, ✅/❌ lines,
// non-zero exit on any failure. Run: node test-samples.mjs  →  "SAMPLES OK".
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json' };
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
const origin = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

// Expected shape per sample: minimum slide count + a distinctive substring we
// require to survive native import.
const EXPECT = {
  'corporate.json': { minSlides: 5, needle: 'Quarterly Business Review' },
  'arty.json': { minSlides: 6, needle: 'DESIGN AS ATMOSPHERE', minImages: 5 },
  'equations.json': { minSlides: 6, needle: 'E = mc²' },
  'multilingual-rtl.json': { minSlides: 5, needle: 'مرحبا' },     // Arabic (RTL)
  'torture.json': { minSlides: 16, needle: 'Torture Test' },
};

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${origin}/magpie/edot/slides/slides.html`);
  await page.waitForFunction(() => window.__slides && window.__slides.formats);
  ok('component booted with codecs', true);

  // 0. The manifest is fetchable from the app's relative base + lists 5 decks.
  const manifest = await page.evaluate(async () => {
    const m = await fetch('../../../third_party/slide-examples/index.json').then((r) => r.json());
    return (m && m.samples) || [];
  });
  ok('manifest loads from the app base and lists samples', manifest.length === 5);

  // 1. Each self-authored JSON imports without error + preserves count/text.
  for (const [file, exp] of Object.entries(EXPECT)) {
    const res = await page.evaluate(async (args) => {
      const [file, base] = args;
      const S = window.__slides;
      const text = await fetch(base + file).then((r) => r.text());
      let deck, err = null;
      try { deck = S.formats.jsonToDeck(text); } catch (e) { err = String(e); }
      if (err) return { err };
      const allText = deck.slides
        .flatMap((s) => s.elements)
        .flatMap((e) => (e.runs || []).map((r) => r.text))
        .join(' ␟ ');
      const images = deck.slides.flatMap((s) => s.elements).filter((e) => e.type === 'image').length;
      return { slides: deck.slides.length, allText, images, title: deck.title };
    }, [file, '../../../third_party/slide-examples/']);

    ok(`${file} imports without error`, !res.err);
    if (res.err) { console.log('   ', res.err); continue; }
    ok(`${file} has >= ${exp.minSlides} slides`, res.slides >= exp.minSlides);
    ok(`${file} preserves text "${exp.needle}"`, res.allText.includes(exp.needle));
    if (exp.minImages) ok(`${file} preserves >= ${exp.minImages} images`, res.images >= exp.minImages);
  }

  // 2. The shipped .pptx fixtures re-import (round-trip), preserving titles
  //    incl. the RTL/CJK strings in the multilingual deck.
  const PPTX = {
    'corporate.pptx': ['Quarterly Business Review'],
    'multilingual-rtl.pptx': ['مرحبا', 'שלום', '你好'], // Arabic, Hebrew, CJK
  };
  for (const [file, needles] of Object.entries(PPTX)) {
    const res = await page.evaluate(async (args) => {
      const [file, base] = args;
      const S = window.__slides;
      const buf = await fetch(base + file).then((r) => r.arrayBuffer());
      let deck, err = null;
      try { deck = await S.formats.pptxToDeck(buf); } catch (e) { err = String(e); }
      if (err) return { err };
      const allText = deck.slides
        .flatMap((s) => s.elements)
        .flatMap((e) => (e.runs || []).map((r) => r.text))
        .join(' ␟ ');
      return { slides: deck.slides.length, allText };
    }, [file, '../../../third_party/slide-examples/']);

    ok(`${file} re-imports without error`, !res.err);
    if (res.err) { console.log('   ', res.err); continue; }
    ok(`${file} re-imports with slides`, res.slides >= 1);
    for (const n of needles) ok(`${file} round-trip preserves "${n}"`, res.allText.includes(n));
  }

  // 3. Export→import round-trip in-page for the multilingual JSON: load the
  //    JSON, export PPTX, re-import, and confirm the RTL strings survive.
  const rt = await page.evaluate(async (base) => {
    const S = window.__slides;
    const text = await fetch(base + 'multilingual-rtl.json').then((r) => r.text());
    const deck = S.formats.jsonToDeck(text);
    const blob = await S.formats.deckToPptx(deck);
    const back = await S.formats.pptxToDeck(await blob.arrayBuffer());
    const allText = back.slides.flatMap((s) => s.elements).flatMap((e) => (e.runs || []).map((r) => r.text)).join(' ');
    return { ar: allText.includes('مرحبا'), he: allText.includes('שלום'), cjk: allText.includes('你好') };
  }, '../../../third_party/slide-examples/');
  ok('multilingual JSON→PPTX→import keeps Arabic', rt.ar);
  ok('multilingual JSON→PPTX→import keeps Hebrew', rt.he);
  ok('multilingual JSON→PPTX→import keeps CJK', rt.cjk);

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally { await browser.close(); server.close(); }
console.log(fail ? `\n${fail} FAILURE(S)` : '\nSAMPLES OK');
process.exit(fail ? 1 : 0);
