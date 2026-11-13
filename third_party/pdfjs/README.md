# pdf.js (vendored)

Mozilla's PDF renderer. Only the Viewer (`inklet/apps/viewer/`) loads it, to show a PDF. Files shows a
PDF by putting the Viewer in a frame inside its own, so pdf.js never runs with Files' access to the
pod. Why, and what the Viewer may do: `docs/foafos-viewer-20261113.md`,
https://github.com/danbri/glitchcan-minigam/issues/1171.

- Source: the `pdfjs-dist` package, version 6.4.299 (https://github.com/mozilla/pdf.js),
  https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz
- Licence: Apache-2.0 (`LICENSE`, unchanged)
- Files: `build/pdf.min.mjs` and `build/pdf.worker.min.mjs`, copied unmodified.

SHA-256, compared with the files in that npm tarball on 2026-11-13 (they are the same):

| File | SHA-256 |
| --- | --- |
| `pdf.min.mjs` | `57456c8e0c81e46be31174b499ef77f2b9f5ee46d04412ba627320a36755d4c2` |
| `pdf.worker.min.mjs` | `9536359f1b8367850d485731ca1d5e45c159a7b7a0912325e539937aa21ceb18` |

`npm run test:viewer` fails when a file here differs from its line in this table. To update pdf.js,
copy the two files from a new `pdfjs-dist`, check them against that tarball, and change the version
and the table in the same commit.

The Viewer runs in a sandboxed frame with no origin of its own, so the server must send
`Access-Control-Allow-Origin` for these modules. GitHub Pages does.
