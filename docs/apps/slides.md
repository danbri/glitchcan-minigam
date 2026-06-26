# Slides

`<edot-slides>` is the presentation authoring and playback app in the edot browser office suite. It lives at `magpie/edot/slides/` and is defined in `slides-app.js` as a light-DOM custom element (`customElements.define('edot-slides', EdotSlides)`). The element is a thin controller over the canonical deck data model in `slides-model.js`; every edit mutates `this.deck`, re-renders only the affected panel, and debounce-persists the deck to IndexedDB via `slides-store.js` (400 ms debounce, 16:9 slide coordinate space with element x/y/w/h normalised to 0..1). Exports and imports route through the codecs in `slides-formats.js`. A `window.__slides` hook exposes the class, formats, store, and model factories for headless testing.

---

## Features

- **Slides / layouts / themes** [stable] — five layouts (`title`, `title-content`, `two-column`, `section`, `blank`) and four themes (`classic`, `midnight`, `paper`, `ink`) with bg/fg/accent/font properties. Theme is set deck-wide via a toolbar `<select>`; slide background can be overridden per slide with the `_bgControl` colour picker.
- **Text / image / shape elements** [stable] — text elements carry `runs[]` (text, bold, italic, level) and a semantic `role` (title, subtitle, body, body2, section). Images are stored as data URLs; shapes support `rect`, `ellipse`, and `line` with fill/stroke colours.
- **Sub-object select / move / resize** [stable] — clicking an element shows a move grip (`✥`) and four corner resize handles (`sl-handle-{nw,ne,sw,se}`) via `_selectEl` / `_addElControls`. Pointer capture is used for drag; move clamps position to `[0, 1−w]` / `[0, 1−h]`; resize enforces a 0.04 minimum dimension.
- **Rotation / orientability** [stable] — every element type carries a `rotation` field (degrees, 0..359). The inspector exposes a number input and a `⟳ 90°` step button; `applyRot` normalises the value and re-renders. Reflected as `rotate(${deg}deg)` CSS transform.
- **Image import + downsize + SVG** [stable] — `insertImage` calls `prepareImage` (from `../js/image-util.js`) which caps large bitmaps at 1600 px longest edge and preserves aspect ratio; SVG files are embedded as vector data URLs unchanged. `fitImage` sizes the resulting element on the slide.
- **Inspector arrange / colour / orient** [stable] — the right-panel inspector (`_renderInspector`) shows when an element is selected; provides Arrange (front/forward/backward/back via `_reorder`), Colour pickers for fill/stroke on shapes, and Orient (rotation) for all element types, plus element position/size readout and delete.
- **Present mode + presenter view + exit** [stable] — `startPresent` overlays `sl-present` full-screen; keyboard (Arrow, Space, PageDown/Up, Home, End, Escape, P), click-zone, and swipe navigation. Presenter view (toggled with `P` or button) shows next-slide SVG preview, speaker notes, and a running elapsed-time + wall-clock timer. A visible `✕` exit button is always present for touch devices where Escape is unavailable.
- **PPTX / ODP / HTML / JSON import-export** [partial] — JSON (`.edeck`) is lossless (the canonical form). PPTX export covers title/body/bullets/images/shapes/notes; PPTX import recovers title/body runs (bold/italic/indent level), images, and notes. ODP export covers text/images/simple shapes/notes; ODP import is best-effort text + notes. PDF export (hand-rolled PDF 1.4) renders text and shapes but embeds images as grey placeholder boxes only. HTML export produces a self-contained, keyboard-navigable file. PNG export rasterises one slide via canvas. Themes and animations are not preserved in PPTX/ODP.
- **Rail thumbnails** [stable] — `_renderRail` renders each slide as an SVG thumbnail (240 px wide via `fmt.slideToSvg`). `_renderRailThumb(i)` refreshes a single thumbnail on every keystroke, avoiding a full rail re-render.
- **`applyDeckData` hydration** [stable] — the public async method `applyDeckData(deckObj)` awaits `this._ready` (the initial IndexedDB load promise), normalises the raw JSON, resets to slide 0, re-renders, and persists. Used by the project system to push a loaded deck into the live app without a file round-trip.

---

## Side-effecting actions (command-registry inventory)

| Action | Trigger (toolbar / inspector / rail / key / API / capability) | Effect | Proposed command id |
|---|---|---|---|
| Add slide | Toolbar `+ Slide` button | Inserts `newSlide(layout)` after `this.current`; advances current index; re-renders rail + editor; debounce-saves | `slides.addSlide` |
| Duplicate slide | Rail `⧉` button per slide | Calls `cloneSlide` (deep clone, new id) and inserts after index `i`; re-renders | `slides.duplicateSlide` |
| Delete slide | Rail `✕` button per slide (disabled when only 1 slide) | Splices slide from array; clamps current index; re-renders | `slides.deleteSlide` |
| Move slide up / down | Rail `▲` / `▼` buttons per slide | Swaps adjacent slides; keeps current tracking; re-renders | `slides.moveSlide` |
| Change deck title | Toolbar title `<input>` | Sets `this.deck.title`; debounce-saves | `slides.setDeckTitle` |
| Change deck theme | Toolbar theme `<select>` | Sets `this.deck.theme`; re-renders rail + editor | `slides.setTheme` |
| Change slide layout | Per-slide layout `<select>` in editor bar | Calls `changeLayout`: remaps title/body runs into fresh `layoutElements`, preserves extras (images/shapes); re-renders | `slides.changeLayout` |
| Set slide background | Per-slide `🎨` colour input | Sets `slide.background` (overrides theme bg); re-renders | `slides.setBackground` |
| Edit text (contenteditable) | Direct typing in `.sl-text` regions | `_syncTextFromDom` reads DOM lines back into `el.runs[]` (text, bold, italic, level); debounce-saves; refreshes rail thumbnail | `slides.editText` |
| Bold / Italic format | Slide bar `B` / `I` buttons (execCommand) | Toggles bold/italic on the active selection via `document.execCommand`; syncs runs back into model | `slides.formatBold` / `slides.formatItalic` |
| Add bullet | Slide bar `• Bullet` button | Pushes `{ text: 'New point', level: 0 }` onto the active body element's `runs[]`; re-renders | `slides.addBullet` |
| Indent / Outdent bullet | Slide bar `⇥ Indent` / `⇤ Outdent` buttons | Increments / decrements `runs[last].level` (clamped 0..4); re-renders | `slides.indentBullet` / `slides.outdentBullet` |
| Edit speaker notes | Notes `<textarea>` below canvas | Sets `slide.notes`; debounce-saves | `slides.editNotes` |
| Insert image | Slide bar `🖼 Image` button → file input | `insertImage(file)` → `prepareImage` → `fitImage`; pushes image element centred on slide; selects it; re-renders | `slides.insertImage` |
| Insert shape | Slide bar `◇ Shape ▾` menu → rect / ellipse / line | `insertShape(shape)` pushes shape element at (0.3, 0.3, 0.3, 0.25) with theme accent/fg colours; re-renders | `slides.insertShape` |
| Move element (drag) | Drag element body (non-text) or move grip `✥` | `_startMove` updates `el.x`, `el.y` via pointer capture; debounce-saves on pointer up; refreshes rail thumbnail | `slides.moveElement` |
| Resize element (drag) | Drag corner handles `sl-handle-{nw,ne,sw,se}` | `_startResize` updates `el.x`, `el.y`, `el.w`, `el.h` from the dragged corner; enforces MIN=0.04; debounce-saves | `slides.resizeElement` |
| Rotate element | Inspector rotation number input or `⟳ 90°` button | `applyRot` sets `el.rotation` (normalised 0..359); re-renders + rail thumb | `slides.rotateElement` |
| Re-layer element | Inspector `⤒ Front` / `↑` / `↓` / `⤓ Back` buttons | `_reorder(dir)` splices element to new position in `slide.elements[]`; re-renders | `slides.reorderElement` |
| Set shape fill colour | Inspector fill `<input type="color">` (shape only) | Sets `el.fill`; re-renders + rail thumb | `slides.setFill` |
| Set shape stroke colour | Inspector stroke `<input type="color">` (shape only) | Sets `el.stroke`; re-renders + rail thumb | `slides.setStroke` |
| Delete element | Inspector `🗑 Delete element` button or selection `✕` handle | `deleteElement(idx)` splices element from `slide.elements[]`; re-renders | `slides.deleteElement` |
| Start presentation | Toolbar `▶ Present` button (primary) | `startPresent()` creates `.sl-present` overlay; requests fullscreen; wires keyboard handler; starts timer; renders slide SVG | `slides.startPresent` |
| Next / prev slide (present) | Arrow keys / Space / PageDown / PageUp / click-zone / swipe | `presentNext` / `presentPrev` advances or decrements `this.presentIndex`; re-renders present stage | `slides.presentNext` / `slides.presentPrev` |
| Jump to first / last (present) | Home / End keys | Sets `this.presentIndex = 0` or `deck.slides.length - 1`; re-renders | `slides.presentJump` |
| Toggle presenter view | Present overlay `👁 Presenter` button or `P` key | Toggles `.presenter` class on overlay; shows/hides next-slide preview, notes, timer | `slides.togglePresenterView` |
| Exit presentation | `✕` button or Escape key | `exitPresent()` clears timer interval, removes overlay, exits fullscreen, syncs `this.current` to `this.presentIndex`; re-renders edit view | `slides.exitPresent` |
| New deck | File menu `New deck` | `newDeckPrompt` saves current deck, creates `newDeck()`, persists, resets to slide 0, full re-render | `slides.newDeck` |
| Open deck from library | File menu `Open deck…` | `openLibrary` lists IndexedDB decks; chosen deck loaded via `loadDeck` + `normalizeDeck`; re-rendered | `slides.openDeck` |
| Open sample deck | File menu `Samples…` | `openSamples` fetches `third_party/slide-examples/index.json`, then the chosen `.json` via `fmt.jsonToDeck`; persists + re-renders | `slides.openSample` |
| Import file | File menu `Import file…` → file input | `importFile` dispatches on extension: `.json`/`.edeck` → `jsonToDeck`; `.pptx` → `pptxToDeck`; `.odp` → `odpToDeck`; unknown → sniff; persists + re-renders | `slides.importFile` |
| Export `.edeck` (JSON) | File menu `Export deck (.edeck)` | `exportJson` → `deckToJson` → blob download; shows SHA-256 fingerprint toast | `slides.exportJson` |
| Export PPTX | File menu `Export PPTX` | `exportPptx` → `deckToPptx` → blob download | `slides.exportPptx` |
| Export ODP | File menu `Export ODP` | `exportOdp` → `deckToOdp` → blob download | `slides.exportOdp` |
| Export PDF | File menu `Export PDF` | `exportPdf` → `deckToPdf` → blob download | `slides.exportPdf` |
| Export HTML | File menu `Export HTML` | `exportHtml` → `deckToHtml` → blob download | `slides.exportHtml` |
| Export PNG (current slide) | File menu `Export PNG (current slide)` | `exportPng` → `slideToPng` (SVG rasterised via canvas at 1920 px wide) → blob download | `slides.exportPng` |
| Delete deck from library | Library dialog `🗑` per deck | `deleteDeck(id)` from IndexedDB; row removed from dialog | `slides.deleteDeck` |
| Push data slide from kernel | `slides.addData` kernel capability (API) | `addDataSlide(columns, rows, title)` builds a `title-content` slide from tabular data (up to 12 rows, columns joined with ` · `); inserts after current; re-renders; returns new slide id | `slides.addDataSlide` |
| Apply deck from project | `applyDeckData(deckObj)` public method | Awaits `_ready`, normalises and replaces `this.deck`, resets to slide 0, deselects, full re-render, saves | `slides.applyDeckData` |

---

## User journeys

1. **Build a 3-slide deck from scratch.** Open the app; the initial deck has two placeholder slides. Use the toolbar title input to name the deck. Select `Title` layout in the layout dropdown and click `+ Slide` to add a title slide; type a title in the contenteditable placeholder. Add a second slide with `title-content` layout; use `• Bullet` to add points, `⇥ Indent` / `⇤ Outdent` to nest them. Insert a third blank slide for a closing graphic. The deck auto-saves every 400 ms; it is also available from File → Open deck… on next visit.

2. **Insert and rotate an image.** On any slide, click `🖼 Image` in the slide bar and choose a JPEG or PNG. Large files are automatically downscaled to 1600 px longest edge. The image element appears centred on the slide and is immediately selected. Drag its body to reposition. Drag the `se` corner handle to resize. In the inspector, type `45` in the rotation field (or click `⟳ 90°` twice) to rotate it. The rail thumbnail updates live.

3. **Insert and style a shape.** Click `◇ Shape ▾` and choose `Rectangle`. A filled rectangle appears at (30%, 30%). Select it; the inspector shows Colour pickers for Fill and Stroke. Adjust them. Use `⤒ Front` / `⤓ Back` to change stacking order relative to other elements.

4. **Present with presenter view.** Click `▶ Present`. The deck expands to fullscreen. Press `P` (or click `👁 Presenter`) to open presenter view: speaker notes for the current slide appear in the right panel alongside a thumbnail of the next slide and a running elapsed-time timer. Navigate with arrow keys, Space, or left/right tap zones. Press Escape or tap `✕` to exit; the editor jumps to whichever slide was showing when you exited.

5. **Round-trip a deck to PPTX and back.** File → Export PPTX downloads a standards-valid `.pptx` file containing all slide XML, images in `ppt/media/`, and a notes slide for each slide that has notes. Re-import it via File → Import file…; title text, body bullets (with bold/italic/indent level), notes, and embedded images all round-trip. Theme and shape styling are approximate.

6. **Receive data pushed from the Data app.** When a workspace automation calls the `slides.addData` kernel capability with `{ columns, rows, title }`, the currently focused `<edot-slides>` instance receives the call via `addDataSlide`. A new `title-content` slide is inserted after the current slide; its body lists up to 12 rows of data formatted as column-joined strings. The new slide becomes current, the rail updates, and the deck auto-saves — no file dialog or user interaction required.

---

## Test coverage

| Feature | Covered by (suite :: assertion label) | Status |
|---|---|---|
| Component boot | test-slides.mjs :: `component booted with a deck` | Covered |
| Deck build + IDB persistence | test-slides.mjs :: `deck has 2 slides after build`, `title text persisted to IndexedDB`, `bullet bold flag persisted`, `speaker notes persisted` | Covered |
| Object index registration (no body) | test-slides.mjs :: `saved deck is recorded in the shared object index` | Covered |
| Contenteditable text sync | test-slides.mjs :: `contenteditable edit syncs into the deck core` | Covered |
| `addSlide` | test-slides.mjs :: `addSlide inserts a slide` | Covered |
| `duplicateSlide` | test-slides.mjs :: `duplicateSlide adds a copy` | Covered |
| `moveSlide` | test-slides.mjs :: `moveSlide reorders` | Covered |
| `deleteSlide` | test-slides.mjs :: `deleteSlide removes a slide` | Covered |
| JSON round-trip (lossless) | test-slides.mjs :: `JSON round-trip is lossless` | Covered |
| JSON export idempotence | test-slides.mjs :: `JSON export is idempotent` | Covered |
| PPTX export structure | test-slides.mjs :: `PPTX contains presentation.xml`, `PPTX contains slide1.xml`, `PPTX contains [Content_Types].xml`, `PPTX slide1.xml carries the title text`, `PPTX content-types declares slide parts`, `PPTX blob is application/zip` | Covered |
| PPTX notes export | test-slides.mjs :: `PPTX emits a notes slide for noted slides` | Covered |
| PPTX round-trip (text + notes) | test-slides.mjs :: `PPTX round-trip recovers slide count`, `PPTX round-trip recovers title text`, `PPTX round-trip recovers body bullets`, `PPTX round-trip recovers notes` | Covered |
| PPTX image round-trip | test-slides.mjs :: `PPTX round-trip carries an image element`, `PPTX round-trip image is a PNG data URL` | Covered |
| ODP round-trip | test-slides.mjs :: `ODP round-trip recovers slide count`, `ODP round-trip recovers title`, `ODP round-trip recovers body`, `ODP round-trip recovers notes` | Covered |
| Present mode (overlay, next/prev, exit) | test-slides.mjs :: `present mode renders an overlay`, `present next advances the index`, `present prev rewinds the index`, `Esc exits present mode (overlay removed)` | Covered |
| Present keyboard navigation | test-slides.mjs :: `ArrowRight advances in present mode`, `Escape key exits present mode` | Covered |
| PDF export | test-slides.mjs :: `PDF export starts with %PDF`, `PDF export is non-empty`, `PDF has one page per slide`, `PDF blob is application/pdf` | Covered |
| HTML export | test-slides.mjs :: `HTML export contains all slide texts`, `HTML export is self-contained (no remote refs)`, `HTML export is keyboard-navigable`, `HTML export has one section per slide` | Covered |
| PPTX / ODP determinism | test-slides.mjs :: `PPTX export is deterministic (byte-identical)`, `ODP export is deterministic (byte-identical)` | Covered |
| Sub-object selection (handles + inspector) | test-slides-edit.mjs :: `clicking an element selects it (4 resize handles + move grip)`, `the inspector shows for the selection (Arrange controls)` | Covered |
| Element move (drag) | test-slides-edit.mjs :: `dragging the body moves the element (x increased)` | Covered |
| Element resize (corner handle) | test-slides-edit.mjs :: `dragging the SE handle resizes the element (width grew)` | Covered |
| Z-order (bring to front) | test-slides-edit.mjs :: `"Bring to front" re-layers the element to the top (last in order)` | Covered |
| Deselect on bare canvas | test-slides-edit.mjs :: `clicking bare canvas deselects (inspector hidden)` | Covered |
| Presenter view (notes + next preview + timer) | test-slides-edit.mjs :: `presenter view shows notes, next-slide preview and a timer` | Covered |
| Present exit button (touch) | test-slides-edit.mjs :: `present mode has a visible exit button (touch-reachable)`, `clicking the exit button leaves present mode` | Covered |
| Image downscale (1600 px cap) | test-slides-edit.mjs :: `large bitmap is downscaled to the 1600px cap`, `downscale preserves aspect ratio (2:1)`, `image element is sized (positioned within page)` | Covered |
| SVG kept as vector | test-slides-edit.mjs :: `SVG is embedded as vector (not rasterized)` | Covered |
| Element rotation | test-slides-edit.mjs :: `an element can be rotated (orientability)` | Covered |
| Sample deck import (JSON) | test-samples.mjs :: `${file} imports without error`, `${file} has >= N slides`, `${file} preserves text "…"`, `${file} preserves >= N images` | Covered (5 decks) |
| Sample deck PPTX round-trip | test-samples.mjs :: `${file} re-imports without error`, `${file} re-imports with slides`, `${file} round-trip preserves "…"` | Covered |
| Multilingual / RTL text preservation | test-samples.mjs :: `multilingual JSON→PPTX→import keeps Arabic`, `…Hebrew`, `…CJK` | Covered |
| `slides.addData` capability via automation | test-automations.mjs :: `an automation drives slides.addData through the kernel` | Covered (cross-suite) |
| `applyDeckData` via project hydration | test-projects-shell.mjs :: `template deck hydrated into the Slides pane` | Covered (cross-suite) |
| Data share reaches slides pane | test-workspace.mjs :: `the SAME share also reached the slides pane` | Covered (cross-suite) |

### Gaps (untested)

The following features have no direct assertions in the slides test suites and are not covered by cross-suite tests:

- **Deck title edit** (`this.deck.title` mutation via toolbar input) — untested.
- **Deck theme change** (`this.deck.theme` mutation; re-render path with theme colours) — untested.
- **Per-slide background colour** (`slide.background` override; `_bgControl`) — untested.
- **Change slide layout** (`changeLayout` / `layoutElements` remapping) — untested.
- **Speaker notes edit** (`slide.notes` mutation via the textarea; distinct from the notes read-back in present mode tests) — untested (notes are set programmatically in tests, not via the UI textarea).
- **Bold / Italic `execCommand` format buttons** (`_fmtBtn` / `document.execCommand`) — untested.
- **Add bullet / Indent / Outdent** (`_addBullet`, `_indent`) — untested.
- **Insert shape** (`insertShape`; all three shape types) — shapes are injected via `slide.elements.push` directly in the edit tests, not via the `insertShape` method.
- **Shape colour inspector (fill / stroke pickers)** — untested.
- **Backward / Send-to-back reorder** — only `⤒ Front` is tested; `↑`, `↓`, `⤓ Back` are untested.
- **Z-order inspector for NW / NE / SW handles** — only SE resize handle is tested.
- **New deck prompt** (`newDeckPrompt`) — untested.
- **Open library dialog** (`openLibrary`) — untested.
- **Open samples dialog** (`openSamples`) — the manifest fetch and per-sample open button flow are not exercised by the component (test-samples.mjs tests the codec directly, not the dialog).
- **Delete deck from library** (`deleteDeck` via library dialog) — untested.
- **Export PNG** (`slideToPng` / `exportPng`) — untested; the format is browser-canvas-dependent and was excluded from the headless suite.
- **Export PDF images** — images are known to render as grey boxes in PDF; this behaviour is undocumented by an assertion.
- **Mobile rail toggle** (`☰` button, `rail-open` class, scrim dismiss) — untested.
- **Present mode Home / End keys** — jump-to-first / jump-to-last keyboard shortcuts are untested.
- **Present mode touch swipe** — swipe navigation is untested.
- **Multi-instance focus routing** (`slidesInstances`, `activeSlides` tracking) — untested.
- **`_ready` promise guard in `applyDeckData`** — the await-before-replace race-condition guard is not directly tested.
- **File import sniff path** (unknown extension → try JSON, fallback to PPTX) — untested.
- **SHA-256 fingerprint toast on `.edeck` export** — untested.

---

## Known issues

- **PDF images are not embedded.** `deckToPdf` intentionally renders image elements as grey placeholder rectangles (`0.8 0.8 0.8 rg … re f`). The source comment acknowledges there is no JPEG/PNG XObject pipeline. There is no test asserting this behaviour.
- **PDF ellipse is approximated as a rectangle.** The PDF export uses a rectangle path (`re`) for both `rect` and `ellipse` shapes. The source comment says "Rectangle approximation for ellipse too (PDF curve math omitted; honest about it)."
- **ODP shape import is not implemented.** `odpToDeck` only parses `draw:frame` elements with text boxes or images; `draw:rect`, `draw:ellipse`, and `draw:line` primitives in incoming ODP files are silently ignored.
- **ODP italic is not exported.** `deckToOdp` only applies bold via the `Tb` style; italic is omitted from the ODP codec.
- **Two-column layout body2 is not recovered on PPTX import.** `pptxToDeck` maps the first shape as `title` and all subsequent shapes as `body` (with role `body`); the `body2` role used by the `two-column` layout is not preserved.
- **PPTX rotation is not exported or imported.** Element `rotation` fields are ignored by both `deckToPptx` and `pptxToDeck`. There is no rotation transform in the EMU xfrm XML.
- **ODP rotation is not exported or imported.** Same omission in `deckToOdp` / `odpToDeck`.
- **`document.execCommand` is deprecated.** `_fmtBtn` uses `document.execCommand('bold'/'italic')` for in-place formatting. This API is deprecated and may cease to function in future browser releases.
- **`_indent` only affects the last run.** The indent/outdent buttons always modify `el.runs[el.runs.length - 1]`, regardless of which line the caret is on. Multi-line indent control is not implemented.
- **No undo / redo.** There is no undo stack. Any mutation (move, delete, type) is immediately committed to `this.deck` and cannot be reversed.
- **Headless PNG export.** `slideToPng` requires a browser `<canvas>` context and `Image`. It is not exercised by the headless Playwright test suite.
