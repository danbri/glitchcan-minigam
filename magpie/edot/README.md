# edot — a small, modular, accessible word processor & office-doc tool

A browser word processor that runs entirely client-side. No server, no upload,
no build step — open `edot.html` from a static host (it lives on GitHub Pages
with the rest of this repo) and write. Your text never leaves your device.

It aims at the job Google Docs / Office 365 do, minus the cloud: rich editing,
real Office-format import/export, and a local document library — but private,
offline, and dependency-free.

**Live:** `magpie/edot/edot.html`

## What it does

- **Rich text editing** — headings (H1–H3), bold/italic/underline/strikethrough,
  paragraph **alignment** (left/centre/right/justify), bulleted & numbered
  lists, block quotes, code blocks, links, indent/outdent, undo/redo,
  clear-formatting.
- **Find & replace** — `Ctrl/⌘+F` (find) / `Ctrl/⌘+H` (replace), live match
  count, case sensitivity, replace-one / replace-all. Matches are shown with the
  CSS Custom Highlight API (no DOM mutation), with a select-and-scroll fallback.
- **Open from URL** — paste any document URL; **GitHub / GitLab / Bitbucket /
  gist “blob” links are rewritten to their raw file automatically**
  (`js/open-url.js`). Same-origin and `raw.githubusercontent.com` work in the
  browser; other hosts may be blocked by CORS (the dialog says so).
- **Examples** — `File ▸ Examples` opens ready-made documents (incl. the full
  Adam Morton *Searching for Logic* textbook, vendored under
  `third_party/searching-for-logic/`).
- **Close** (`Ctrl/⌘+W`) — closes the current document; it stays safe in the
  library.
- **Local document library** — multiple named documents stored on-device in
  **IndexedDB** (localStorage fallback), with continuous autosave. **File ▸ My
  documents** lists, opens, renames, duplicates, and deletes them. Nothing is
  ever uploaded.
- **Real file I/O, offline & dependency-free:**
  - **Word `.docx`** — native OOXML read *and* write, including **tables**,
    **embedded images** (imported as data-URLs), headings, lists, alignment,
    and hyperlinks.
  - **PDF** — native multi-page export (A4, base-14 fonts, wrapped text flow,
    inline bold/italic/links, lists, quotes, code, page breaks). No backend.
  - **HTML + RDFa** — standalone self-styled documents that declare common
    RDFa prefixes/vocab and preserve any semantic markup you author.
  - **CSS** — export the document stylesheet on its own.
  - **Markdown** — bidirectional (CommonMark subset).
  - **Plain text.**
- **Semantic authoring (RDFa)** — select text and tag it 🏷️ with a `property`
  (and optional `typeof`); the meaning is preserved through editing and HTML
  export. Distinguishes edot from a plain word processor.
- **High-fidelity I/O (optional)** — `.odt`, `.doc`, `.rtf` import and ODT/RTF
  export via a pluggable **LibreOffice WASM** backend (see below).
- **Accessibility first** — ARIA toolbar with roving tabindex, screen-reader
  live announcements, full keyboard operation, native `<dialog>` modal, skip
  link, honours `prefers-color-scheme` and `prefers-reduced-motion`.
- **Mobile-first**, touch-friendly targets, responsive page.

## Keyboard

| Action | Shortcut |
| --- | --- |
| Bold / Italic / Underline | `Ctrl/⌘ + B / I / U` |
| Undo / Redo | `Ctrl/⌘ + Z` / `Ctrl/⌘ + Shift + Z` (or `Ctrl/⌘ + Y`) |
| Find / Find & replace | `Ctrl/⌘ + F` / `Ctrl/⌘ + H` |
| New document | `Ctrl/⌘ + N` (via menu) |
| Open file from disk | `Ctrl/⌘ + O` (or drag a file onto the page) |
| My documents (library) | `Ctrl/⌘ + Shift + O` |
| Save / export | `Ctrl/⌘ + S` (last-used format) — pick a format in **File ▸ Save as** |
| Move within toolbar | Arrow keys / `Home` / `End` |

## Architecture

Everything is a focused ES module — no framework, no bundler. Each piece does
one job and the rest of the app talks to it through a small interface, so any
part can be swapped without touching the others.

```
edot.html              app shell (semantic, ARIA, no inline script)
css/edot.css           mobile-first, dark-mode & reduced-motion aware
js/
  edot-app.js          bootstrap: wires modules, File menu, status bar, autosave
  editor.js            the contenteditable surface (content, paste, shortcuts)
  toolbar.js           WAI-ARIA toolbar pattern (roving tabindex, aria-pressed)
  commands.js          editing command registry (the only execCommand caller)
  document-model.js    canonical = sanitized HTML; normalize, plain-text, stats
  a11y.js              live-region announcer + transient toasts
  library.js           local document store (IndexedDB, localStorage fallback)
  find-replace.js      find & replace (CSS Custom Highlight API)
  open-url.js          URL/git-host link resolution -> raw fetch + metadata
  examples.js          File ▸ Examples manifest
  io.js                format registry + open/save orchestration
  io-docx.js           native OOXML .docx read/write (incl. alignment via w:jc)
  io-pdf.js            native multi-page PDF export (base-14 fonts)
  io-markdown.js       Markdown <-> document HTML
  io-html.js           standalone HTML+RDFa document I/O + CSS export
  zip.js               dependency-free ZIP (native CompressionStream)
  libreoffice-bridge.js  pluggable LibreOffice-WASM conversion bridge
```

### Design notes

- **The document is sanitized HTML.** Every importer normalizes *into* this
  shape and every exporter reads *from* it; formats never talk to each other.
  Pasted/imported content is run through an allow-list sanitizer that drops
  scripts, styles, event handlers, and `javascript:` URLs.
- **ZIP without a vendored deflate.** `.docx` is a ZIP of XML. `zip.js` uses the
  browser-native `CompressionStream`/`DecompressionStream` (`deflate-raw`), so
  there is no third-party compression code and it works fully offline. CRC-32 is
  computed in-module.
- **`execCommand` is confined to `commands.js`.** It is deprecated but remains
  the only cross-browser contenteditable mutator with native undo integration.
  Isolating it there makes a future Selection/Range rewrite a one-file change.
- **PDF without a renderer.** `io-pdf.js` emits PDF 1.4 directly using the 14
  standard fonts (no embedding) and measures text with an offscreen `<canvas>`
  for line breaking — so there is no PDF library and it works offline.
- **Storage is real, not a slot.** `library.js` keeps every document in
  IndexedDB; the current document autosaves continuously and survives reloads.

## LibreOffice WASM bridge

The native path covers the structural core of `.docx`/PDF/Markdown/HTML/text
offline. For **full fidelity** — tables, images, complex styles, and the
`.doc`/`.odt`/`.rtf` formats — edot defers to real LibreOffice compiled to
WebAssembly (the [ZetaOffice / zetajs](https://zetaoffice.net) project).

A full LibreOffice WASM build is hundreds of megabytes, so it is **not bundled**
— that weight should never be forced on every visitor of a static site. Instead
the engine is *pluggable*: point edot at a backend and the extra formats light
up; leave it unset and the native path handles everything it can.

**Configure a backend** (before the app loads) with a global:

```html
<script>
  window.EDOT_LIBREOFFICE = {
    // ES module exporting:  async convert({ bytes, from, to }) => Uint8Array
    // (optionally an async init(cfg))
    moduleUrl: 'https://your-host/zeta/edot-lo-adapter.js',
  };
</script>
```

…or at runtime: `localStorage.setItem('edot.libreoffice.url', '<moduleUrl>')`.

The adapter contract is intentionally tiny (`convert({bytes, from, to})`) so any
LibreOffice-WASM distribution can sit behind it. When a backend is present, edot
also routes `.docx` through it for higher-fidelity import, falling back to the
native reader if conversion fails.

## Testing

Headless tests boot the real app in Chromium and exercise every format
round-trip (docx, markdown, zip, RDFa, alignment), the PDF structure, find &
replace, the document library persistence across reloads, the sanitizer, and the
toolbar wiring:

```bash
node magpie/edot/test-edot.mjs       # functional smoke test (56 checks)
node magpie/edot/test-e2e.mjs        # end-to-end UI driving (23 checks)
node magpie/edot/test-mobile.mjs     # mobile: tap-to-focus, touch menu, locked shell (14 checks)
node magpie/edot/verify-pdf.mjs      # deep PDF structural validation + sample
```

(Both use the environment's vendored Chromium at `/opt/pw-browsers/` via
`playwright-core`. `verify-pdf.mjs` writes `/tmp/edot-sample.pdf` and checks the
xref offsets, trailer→catalog→pages chain, and content-stream lengths.)

## Roadmap: editing files in git

edot already *reads* from git hosts (Open from URL). A design study for the
next step — **diffing and committing back to a remote repo**, entirely
client-side (GitHub Device Flow / fine-grained PAT, `jsdiff` preview, PR-based
writes) — is in [`docs/git-sync-methodology.md`](docs/git-sync-methodology.md).
The `doc.source` metadata captured on URL-open is the hook it builds on.

## Limits / honest scope

- The native `.docx` path covers paragraphs, Heading 1–3, bold/italic/
  underline/strike runs, ordered & unordered lists, block quotes, code,
  hyperlinks, alignment, **tables**, and **images**. Import brings tables and
  embedded images in (images become data-URLs); export writes tables back.
  **Image *export* to .docx, footnotes, and complex styles still need the
  LibreOffice WASM backend.**
- **PDF export** currently renders text, lists, quotes and code; tables are
  flattened to text and images are omitted (both are on the roadmap).
- Tables and images that can't be represented in **Markdown/plain text** are
  exported as a GFM table / `![alt](src)` where possible, else dropped.
- PDF export uses the base-14 fonts and WinAnsi/Latin-1 text; characters outside
  that range (e.g. CJK, emoji) are exported as `?`. Inline styling is per-run
  (bold/italic/links); it does not embed images or tables.
- Markdown is a CommonMark *subset* (no tables/footnotes/nested lists yet).
  Paragraph alignment round-trips through HTML, DOCX and PDF but not Markdown or
  plain text, which have no concept of it.
- Editing is single-document at a time, but the library holds as many documents
  as you like; switch via **File ▸ My documents**.
