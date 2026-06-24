# edot slides

An accessible, mobile-first slide-presentation app (author + edit + present)
for the edot suite. Entry point: **`slides.html`** hosting `<edot-slides>`.

Vanilla ES modules, light-DOM Web Components, a shared CSS file, no runtime CDN
or WASM dependencies. Reuses the repo's offline ZIP layer (`../js/zip.js`,
native `CompressionStream`) for PPTX/ODP and follows `../js/io-pdf.js`'s
hand-rolled approach for PDF. Decks persist to IndexedDB (its own
`edot-slides` database), mirroring the idb helper pattern in
`../data/data-engine.js`. Only the user's own decks are stored, locally.

## The canonical "core"

The deck is plain JSON; everything else (PPTX / ODP / PDF / HTML / PNG) is
*derived* from it. Element positions are normalized 0..1 of the slide W×H
(16:9 default).

```
{ version, id, title, theme, mtime, slides:[
  { id, layout, background, notes, elements:[
    { type:'text',  x,y,w,h, role?, runs:[{text, bold?, italic?, level?}] } |
    { type:'image', x,y,w,h, dataUrl, alt } |
    { type:'shape', x,y,w,h, shape:'rect'|'ellipse'|'line', fill, stroke }
  ] }
] }
```

## Files

| File | Purpose |
|------|---------|
| `slides.html` | Entry page; hosts `<edot-slides>`, links back to the editor. |
| `slides.css` | Shared light-DOM stylesheet; mobile-first, dark-mode aware. |
| `slides-model.js` | Canonical deck core: factories, layouts, themes, normalization. |
| `slides-store.js` | IndexedDB persistence (save/load/list/delete decks). |
| `slides-formats.js` | All codecs: JSON, PPTX (im/ex), ODP (im/ex), PDF, HTML, PNG/SVG. |
| `slides-app.js` | `<edot-slides>` component: rail, editor, present mode, file menu. |
| `test-slides.mjs` | Headless Chromium test harness (run `node test-slides.mjs`). |

`window.__slides` exposes `{ EdotSlides, formats, store, model, el }` as the
headless-test hook.

## Features

**Authoring / editing (full):** thumbnail rail (select; reorder up/down;
add / duplicate / delete); five layouts (Title, Title+Content, Two-Column,
Section, Blank); in-place contenteditable title/body editing with bold/italic
and bullet indent levels; insert image (file → dataURL); rect/ellipse/line
shapes; per-slide background color; per-slide speaker notes; four themes.

**Editing (partial / by-design):** the editor is layout-driven (you edit the
title/body/notes placeholders and add image/shape elements), **not** a full
freeform drag-resize DTP canvas — that was explicitly de-prioritized in the
brief. Elements have fixed layout positions; reorder is via buttons (no drag).

**Present mode (full):** fullscreen overlay; next/prev via arrow keys,
click/tap (left third = back), and swipe; live slide counter; `Esc` exits;
`Home`/`End` jump. A presenter view (current + next + notes + timer) is **not**
built (noted as a bonus in the brief).

## Fidelity matrix — be honest, not 100%

| Format | Import | Export | Survives | Dropped / approximated |
|--------|:------:|:------:|----------|------------------------|
| **JSON** (native) | ✅ | ✅ | **Everything — lossless.** The core itself. | — |
| **PPTX** | ✅ best-effort | ✅ best-effort | Titles, body bullet text (bold/italic, indent level), images, speaker notes, slide order, 16:9 size. Import also reads element positions (xfrm). | **Animations, transitions, charts, SmartArt, tables, exact theme/fonts, master/layout placeholders, freeform/grouped shapes.** Export ships one generic blank layout + minimal master/theme. Import infers title vs body from `ph type`; layout id is not preserved. PDF-style precise text autofit is not reproduced. |
| **ODP** | ✅ best-effort | ✅ best-effort | Title + body text, notes, images, simple shapes (rect/ellipse/line), positions. | Theming/master styles approximate; bullet levels and bold are minimally mapped; no transitions/animations/charts. |
| **PDF** | — (terminal) | ✅ | One page per slide; background color, title/body text (bold/italic, bullet markers, indent), shape outlines. Page = 16:9 (720×405pt). | **Not re-importable.** Images render as gray placeholder boxes (no PNG/JPEG XObject pipeline here); ellipses drawn as rectangles; non-WinAnsi chars → `?`. |
| **HTML** | — (terminal) | ✅ | Single self-contained file: every slide, theme colors/font, images (inline data URLs), shapes, notes (toggle with `n`); keyboard + click + swipe nav; print = one slide per page. | **Not re-importable.** No editing. |
| **PNG** | — | ✅ (per slide) | Current slide rasterized via SVG→canvas at requested width. | Browser-only (needs canvas); fonts depend on the rendering environment. |
| **Keynote `.key`** | ❌ | ❌ | — | Out of scope (proprietary/undocumented). Interop with Keynote is via PPTX or PDF. |

**Determinism:** generated ZIPs (PPTX/ODP) zero all mod-times (via `zip.js`),
so repeated exports of the same deck are byte-identical (asserted in the test).

## Known limits / caveats

- PPTX/ODP exports declare a single minimal slide layout + master + theme.
  PowerPoint / LibreOffice Impress open them and show the text/images/notes,
  but will not show edot's theme as a native theme — colors are best-effort.
- PPTX import classifies the **first** `title`/`ctrTitle` placeholder as the
  title and everything else with text as body; decks authored elsewhere with
  unusual placeholder structures may import their text but flatten layout.
- The PDF embeds no raster images by design (keeps the file dependency-free and
  small); use HTML or PNG export when images must appear.
- Headless tests check DOM/logic/format-bytes, not pixels (per CLAUDE.md, the
  remote Chromium's canvas/WebGL is limited).

## Running the tests

```
node magpie/edot/slides/test-slides.mjs
```

Drives the real `<edot-slides>` in headless Chromium and exits non-zero on any
failure. Covers deck CRUD + IndexedDB reload, JSON round-trip, PPTX
export-validity + round-trip (text/notes/images), ODP round-trip, present-mode
navigation (programmatic + real keydown), and PDF/HTML export shape.
