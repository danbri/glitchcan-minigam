# pdf.js (vendored)

Mozilla's PDF renderer, used by Files to show a PDF in its preview. Chrome's own PDF viewer does not
run inside a sandboxed frame, such as Files'.

- Source: the `pdfjs-dist` package, version 6.4.299 (https://github.com/mozilla/pdf.js)
- Licence: Apache-2.0 (`LICENSE`, unchanged)
- Files: `build/pdf.min.mjs` and `build/pdf.worker.min.mjs`, copied unmodified.

Files loads it only when a PDF is picked, so it costs nothing otherwise. A sandboxed frame has no
origin of its own, so the server must send `Access-Control-Allow-Origin`. GitHub Pages does.
