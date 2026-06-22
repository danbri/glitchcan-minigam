# edot — a small, modular, accessible word processor

A browser word processor that runs entirely client-side. No server, no upload,
no build step — open `edot.html` from a static host (it lives on GitHub Pages
with the rest of this repo) and write. Your text never leaves the page.

**Live:** `magpie/edot/edot.html`

## What it does

- **Rich text editing** — headings (H1–H3), bold/italic/underline/strikethrough,
  bulleted & numbered lists, block quotes, code blocks, links, indent/outdent,
  undo/redo, clear-formatting.
- **Real file I/O, offline:**
  - **Word `.docx`** — native OOXML read *and* write (no dependency).
  - **Markdown** — bidirectional, CommonMark subset.
  - **HTML** — standalone self-styled documents.
  - **Plain text.**
- **High-fidelity I/O (optional)** — `.odt`, `.doc`, `.rtf` import and PDF/ODT/RTF
  export via a pluggable **LibreOffice WASM** backend (see below).
- **Autosave** to `localStorage` so a refresh never loses work.
- **Accessibility first** — ARIA toolbar with roving tabindex, screen-reader
  live announcements, full keyboard operation, skip link, honours
  `prefers-color-scheme` and `prefers-reduced-motion`.
- **Mobile-first**, touch-friendly targets, responsive page.

## Keyboard

| Action | Shortcut |
| --- | --- |
| Bold / Italic / Underline | `Ctrl/⌘ + B / I / U` |
| Undo / Redo | `Ctrl/⌘ + Z` / `Ctrl/⌘ + Shift + Z` (or `Ctrl/⌘ + Y`) |
| Open file | `Ctrl/⌘ + O` (or drag a file onto the page) |
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
  storage.js           debounced localStorage autosave
  io.js                format registry + open/save orchestration
  io-docx.js           native OOXML .docx read/write
  io-markdown.js       Markdown <-> document HTML
  io-html.js           standalone HTML document import/export
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

## LibreOffice WASM bridge

The native path covers the structural core of `.docx`/Markdown/HTML/text
offline. For **full fidelity** — tables, images, complex styles, and the
`.doc`/`.odt`/`.rtf`/PDF formats — edot defers to real LibreOffice compiled to
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

A headless smoke test boots the real app in Chromium and exercises the format
round-trips, the ZIP layer, the sanitizer, and the toolbar wiring:

```bash
node magpie/edot/test-edot.mjs
```

(Uses the environment's vendored Chromium at `/opt/pw-browsers/` via
`playwright-core`.)

## Limits / honest scope

- The native `.docx` writer covers paragraphs, Heading 1–3, bold/italic/
  underline/strike runs, ordered & unordered lists, block quotes, code, and
  hyperlinks. **Tables, images, footnotes, and complex styles need the
  LibreOffice WASM backend.**
- Markdown is a CommonMark *subset* (no tables/footnotes/nested lists yet).
- One document at a time; autosave keeps a single working slot. Use
  **Save as** for durable copies.
