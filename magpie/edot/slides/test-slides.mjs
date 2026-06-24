// test-slides.mjs — headless test of the edot slides app: deck CRUD +
// IndexedDB persistence, native JSON round-trip, PPTX export/import round-trip,
// ODP round-trip, present-mode navigation, and the terminal exports (PDF/HTML).
//
// Same harness style as magpie/edot/data/test-data.mjs: a tiny static server
// rooted at the repo, the real <edot-slides> driven in Chromium via the
// window.__slides hook, ✅/❌ lines, and a non-zero exit on any failure.
//
// Per CLAUDE.md: headless Canvas/WebGL is limited, so these assertions check
// DOM/logic/format-bytes (titles in slide1.xml, %PDF header, text in HTML),
// not pixels.
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

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/slides/slides.html`);
  await page.waitForFunction(() => window.__slides && window.__slides.el && window.__slides.el.deck);
  ok('component booted with a deck', true);

  // 1. Build a deck programmatically: title + bullets + notes; persist + reload.
  const built = await page.evaluate(async () => {
    const S = window.__slides;
    const el = S.el;
    const deck = S.model.newDeck('Test Deck');
    deck.slides = [
      { id: 's1', layout: 'title', background: null, notes: 'opening remarks', elements: [
        { type: 'text', role: 'title', x: 0.1, y: 0.34, w: 0.8, h: 0.18, runs: [{ text: 'Hello Slides' }] },
        { type: 'text', role: 'subtitle', x: 0.1, y: 0.54, w: 0.8, h: 0.12, runs: [{ text: 'a subtitle' }] },
      ] },
      { id: 's2', layout: 'title-content', background: null, notes: 'speak slowly', elements: [
        { type: 'text', role: 'title', x: 0.06, y: 0.06, w: 0.88, h: 0.16, runs: [{ text: 'Agenda' }] },
        { type: 'text', role: 'body', x: 0.06, y: 0.26, w: 0.88, h: 0.66, runs: [
          { text: 'First point', level: 0, bold: true },
          { text: 'Second point', level: 0 },
          { text: 'A sub-point', level: 1, italic: true },
        ] },
      ] },
    ];
    el.deck = S.model.normalizeDeck(deck);
    el.current = 0;
    el._render();
    await el._saveNow();
    // Reload from IDB by id.
    const reloaded = await S.store.loadDeck(el.deck.id);
    return {
      id: el.deck.id,
      title: reloaded.title,
      slideCount: reloaded.slides.length,
      titleText: reloaded.slides[0].elements[0].runs[0].text,
      bodyBold: reloaded.slides[1].elements[1].runs[0].bold,
      notes: reloaded.slides[1].notes,
    };
  });
  ok('deck has 2 slides after build', built.slideCount === 2);
  ok('title text persisted to IndexedDB', built.titleText === 'Hello Slides');
  ok('bullet bold flag persisted', built.bodyBold === true);
  ok('speaker notes persisted', built.notes === 'speak slowly');

  // The deck registers in the suite-wide object index (same-origin localStorage,
  // shared with the editor) — metadata only, never the slide body.
  ok('saved deck is recorded in the shared object index', await page.evaluate((id) => {
    const ix = JSON.parse(localStorage.getItem('edot.objectIndex.v1') || '{}');
    const r = ix[id];
    return !!r && r.type === 'deck' && r.title === 'Test Deck' && !('slides' in r) && !('body' in r);
  }, built.id));

  // 1b. Edit a slide via the DOM editor (contenteditable) and confirm sync.
  const edited = await page.evaluate(() => {
    const el = window.__slides.el;
    el.current = 1; el._renderEditor();
    const titleEd = el._editorEl.querySelector('.sl-text.is-title');
    titleEd.innerHTML = '<div data-level="0">Edited Agenda</div>';
    titleEd.dispatchEvent(new Event('input', { bubbles: true }));
    return window.__slides.formats; // force eval; real check below
  });
  const editedTitle = await page.evaluate(() => window.__slides.el.deck.slides[1].elements[0].runs.map((r) => r.text).join(''));
  ok('contenteditable edit syncs into the deck core', editedTitle === 'Edited Agenda');

  // 1c. add / duplicate / delete / reorder.
  const ops = await page.evaluate(() => {
    const el = window.__slides.el;
    const start = el.deck.slides.length;
    el.current = 0; el.addSlide('section');
    const afterAdd = el.deck.slides.length;
    el.duplicateSlide(1);
    const afterDup = el.deck.slides.length;
    const firstId = el.deck.slides[0].id;
    el.moveSlide(0, 1);
    const movedDown = el.deck.slides[1].id === firstId;
    el.deleteSlide(el.deck.slides.length - 1);
    const afterDel = el.deck.slides.length;
    return { start, afterAdd, afterDup, movedDown, afterDel };
  });
  ok('addSlide inserts a slide', ops.afterAdd === ops.start + 1);
  ok('duplicateSlide adds a copy', ops.afterDup === ops.afterAdd + 1);
  ok('moveSlide reorders', ops.movedDown === true);
  ok('deleteSlide removes a slide', ops.afterDel === ops.afterDup - 1);

  // 2. Native JSON round-trip recovers the deck exactly.
  const json = await page.evaluate(() => {
    const S = window.__slides;
    const deck = S.model.newDeck('Round Trip');
    deck.slides[1].notes = 'note here';
    deck.slides[1].elements.find((e) => e.role === 'body').runs = [{ text: 'one', level: 0, bold: true, italic: false }, { text: 'two', level: 1, bold: false, italic: false }];
    const norm = S.model.normalizeDeck(deck);
    const text = S.formats.deckToJson(norm);
    const back = S.formats.jsonToDeck(text);
    return {
      same: JSON.stringify(back) === JSON.stringify(norm),
      again: S.formats.deckToJson(back) === text, // determinism / idempotence
    };
  });
  ok('JSON round-trip is lossless', json.same === true);
  ok('JSON export is idempotent', json.again === true);

  // 3. PPTX export produces a valid ZIP whose slide1.xml has the title text.
  const pptx = await page.evaluate(async () => {
    const S = window.__slides;
    const { unzip, utf8 } = await import('../js/zip.js');
    const deck = S.model.newDeck('Deck PPTX');
    deck.slides[0].elements[0].runs = [{ text: 'TITLE ALPHA' }];
    deck.slides[1].elements.find((e) => e.role === 'body').runs = [{ text: 'bullet one', level: 0 }, { text: 'bullet two', level: 0 }];
    deck.slides[1].notes = 'remember this';
    const blob = await S.formats.deckToPptx(deck);
    const map = await unzip(await blob.arrayBuffer());
    const names = Object.keys(map);
    const slide1 = utf8.decode(map['ppt/slides/slide1.xml']);
    const ct = utf8.decode(map['[Content_Types].xml']);
    const hasNotes = names.includes('ppt/notesSlides/notesSlide2.xml');
    return {
      hasPres: names.includes('ppt/presentation.xml'),
      hasSlide1: names.includes('ppt/slides/slide1.xml'),
      hasCt: names.includes('[Content_Types].xml'),
      titleInSlide1: /TITLE ALPHA/.test(slide1),
      ctValid: /presentationml\.slide\b/.test(ct),
      hasNotes,
      blobType: blob.type,
    };
  });
  ok('PPTX contains presentation.xml', pptx.hasPres);
  ok('PPTX contains slide1.xml', pptx.hasSlide1);
  ok('PPTX contains [Content_Types].xml', pptx.hasCt);
  ok('PPTX slide1.xml carries the title text', pptx.titleInSlide1);
  ok('PPTX content-types declares slide parts', pptx.ctValid);
  ok('PPTX emits a notes slide for noted slides', pptx.hasNotes);
  ok('PPTX blob is application/zip', /zip/.test(pptx.blobType));

  // 4. PPTX round-trip: export -> import recovers title + body text + notes.
  const pptxRt = await page.evaluate(async () => {
    const S = window.__slides;
    const deck = S.model.newDeck('RT PPTX');
    deck.slides[0].elements[0].runs = [{ text: 'Keynote Title' }];
    const body = deck.slides[1].elements.find((e) => e.role === 'body');
    body.runs = [{ text: 'Alpha point', level: 0, bold: true }, { text: 'Beta point', level: 1 }];
    deck.slides[1].notes = 'two lines\nof notes';
    const blob = await S.formats.deckToPptx(deck);
    const back = await S.formats.pptxToDeck(await blob.arrayBuffer());
    const t0 = back.slides[0].elements.map((e) => (e.runs || []).map((r) => r.text).join(' ')).join(' ');
    const allText = back.slides.flatMap((s) => s.elements).flatMap((e) => (e.runs || []).map((r) => r.text)).join(' | ');
    const notes = back.slides.map((s) => s.notes).join(' / ');
    return { count: back.slides.length, t0, allText, notes };
  });
  ok('PPTX round-trip recovers slide count', pptxRt.count === 2);
  ok('PPTX round-trip recovers title text', /Keynote Title/.test(pptxRt.t0));
  ok('PPTX round-trip recovers body bullets', /Alpha point/.test(pptxRt.allText) && /Beta point/.test(pptxRt.allText));
  ok('PPTX round-trip recovers notes', /two lines/.test(pptxRt.notes));

  // 4b. PPTX round-trip carries an embedded image.
  const pptxImg = await page.evaluate(async () => {
    const S = window.__slides;
    // 1x1 transparent PNG.
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const deck = S.model.newDeck('Img Deck');
    deck.slides[0].elements.push({ type: 'image', x: 0.2, y: 0.2, w: 0.4, h: 0.4, dataUrl: png, alt: 'dot' });
    const blob = await S.formats.deckToPptx(deck);
    const back = await S.formats.pptxToDeck(await blob.arrayBuffer());
    const imgs = back.slides.flatMap((s) => s.elements).filter((e) => e.type === 'image');
    return { n: imgs.length, isPng: imgs[0] && /^data:image\/png/.test(imgs[0].dataUrl) };
  });
  ok('PPTX round-trip carries an image element', pptxImg.n >= 1);
  ok('PPTX round-trip image is a PNG data URL', pptxImg.isPng === true);

  // 5. ODP round-trip recovers title + body + notes.
  const odpRt = await page.evaluate(async () => {
    const S = window.__slides;
    const deck = S.model.newDeck('ODP Deck');
    deck.slides[0].elements[0].runs = [{ text: 'Odf Title' }];
    deck.slides[1].elements.find((e) => e.role === 'body').runs = [{ text: 'odf bullet', level: 0 }];
    deck.slides[1].notes = 'odf note';
    const blob = await S.formats.deckToOdp(deck);
    const back = await S.formats.odpToDeck(await blob.arrayBuffer());
    const allText = back.slides.flatMap((s) => s.elements).flatMap((e) => (e.runs || []).map((r) => r.text)).join(' | ');
    return { count: back.slides.length, hasTitle: /Odf Title/.test(allText), hasBullet: /odf bullet/.test(allText), notes: back.slides.map((s) => s.notes).join('/') };
  });
  ok('ODP round-trip recovers slide count', odpRt.count === 2);
  ok('ODP round-trip recovers title', odpRt.hasTitle);
  ok('ODP round-trip recovers body', odpRt.hasBullet);
  ok('ODP round-trip recovers notes', /odf note/.test(odpRt.notes));

  // 6. Present mode: next/prev advances index; Esc exits.
  const present = await page.evaluate(() => {
    const el = window.__slides.el;
    el.deck = window.__slides.model.newDeck('Present Deck');
    el.current = 0; el._render();
    el.startPresent();
    const startIdx = el.presentIndex;
    el.presentNext();
    const afterNext = el.presentIndex;
    el.presentPrev();
    const afterPrev = el.presentIndex;
    const overlayPresent = !!document.querySelector('.sl-present');
    el.exitPresent();
    const overlayGone = !document.querySelector('.sl-present');
    return { startIdx, afterNext, afterPrev, overlayPresent, overlayGone, presenting: el.presenting };
  });
  ok('present mode renders an overlay', present.overlayPresent === true);
  ok('present next advances the index', present.afterNext === present.startIdx + 1);
  ok('present prev rewinds the index', present.afterPrev === present.startIdx);
  ok('Esc exits present mode (overlay removed)', present.overlayGone === true && present.presenting === false);

  // 6b. Present mode via keyboard (real keydown handlers).
  const presentKeys = await page.evaluate(async () => {
    const el = window.__slides.el;
    el.startPresent();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const idx = el.presentIndex;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const gone = !document.querySelector('.sl-present');
    return { idx, gone };
  });
  ok('ArrowRight advances in present mode', presentKeys.idx >= 1);
  ok('Escape key exits present mode', presentKeys.gone === true);

  // 7. PDF export: %PDF header, one page per slide.
  const pdf = await page.evaluate(async () => {
    const S = window.__slides;
    const deck = S.model.newDeck('PDF Deck'); // 2 slides
    const blob = S.formats.deckToPdf(deck, deck.title);
    const buf = new Uint8Array(await blob.arrayBuffer());
    const head = new TextDecoder('latin1').decode(buf.slice(0, 5));
    const text = new TextDecoder('latin1').decode(buf);
    const pageCount = (text.match(/\/Type \/Page\b/g) || []).length;
    return { head, size: buf.length, pageCount, type: blob.type };
  });
  ok('PDF export starts with %PDF', pdf.head === '%PDF-');
  ok('PDF export is non-empty', pdf.size > 500);
  ok('PDF has one page per slide', pdf.pageCount === 2);
  ok('PDF blob is application/pdf', pdf.type === 'application/pdf');

  // 8. HTML export contains every slide's text and is self-contained.
  const html = await page.evaluate(() => {
    const S = window.__slides;
    const deck = S.model.newDeck('HTML Deck');
    deck.slides[0].elements[0].runs = [{ text: 'UNIQUE_TITLE_X' }];
    deck.slides[1].elements.find((e) => e.role === 'body').runs = [{ text: 'UNIQUE_BODY_Y', level: 0 }];
    const out = S.formats.deckToHtml(deck);
    return {
      hasTitle: out.includes('UNIQUE_TITLE_X'),
      hasBody: out.includes('UNIQUE_BODY_Y'),
      selfContained: out.includes('<script>') && !/src=["']http/.test(out) && !/href=["']http/.test(out),
      navigable: /addEventListener\('keydown'/.test(out),
      sections: (out.match(/<section/g) || []).length,
    };
  });
  ok('HTML export contains all slide texts', html.hasTitle && html.hasBody);
  ok('HTML export is self-contained (no remote refs)', html.selfContained);
  ok('HTML export is keyboard-navigable', html.navigable);
  ok('HTML export has one section per slide', html.sections === 2);

  // 9. Determinism: two PPTX exports of the same deck are byte-identical.
  const det = await page.evaluate(async () => {
    const S = window.__slides;
    const deck = S.model.normalizeDeck(S.model.newDeck('Det'));
    const a = new Uint8Array(await (await S.formats.deckToPptx(deck)).arrayBuffer());
    const b = new Uint8Array(await (await S.formats.deckToPptx(deck)).arrayBuffer());
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  });
  ok('PPTX export is deterministic (byte-identical)', det === true);

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally { await browser.close(); server.close(); }
console.log(fail ? `\n${fail} FAILURE(S)` : '\nSLIDES OK');
process.exit(fail ? 1 : 0);
