# Foafos Viewer: third-party file renderers run apart from the pod

2026-11-13. Issue: https://github.com/danbri/glitchcan-minigam/issues/1171. Part of the safety map of
https://github.com/danbri/factoidal-core/issues/427 (which code can reach what).

## The problem

PR https://github.com/danbri/glitchcan-minigam/pull/1090 put pdf.js (Mozilla, Apache-2.0, about 1.7 MB
of third-party JavaScript) into the Files frame to show PDFs. The Files frame holds every grant Files
has: read, write, delete, move, upload and download on the pod, plus the location verbs. It had no
Content Security Policy, so code in it could also send data to any server. A fault in pdf.js, or a
hostile PDF that finds one, had all of that reach. Owner, 2026-11-13: "we should not be that exposed
to a 3p app".

## What changed (step 1)

- **The Viewer**, `inklet/apps/viewer/` (`index.html`, `viewer.js`, `viewer.css`), shows one file
  that its parent frame hands it: PDF (pdf.js), picture, sound, video or text (as text, never as
  markup).
- **Files embeds the Viewer for a PDF.** The frame has `sandbox="allow-scripts"` and no other token,
  so it has an opaque origin, no top navigation, no popups and no forms. Files sends a copy of the
  file's bytes once, as a transferred `ArrayBuffer`. It treats what comes back as untrusted: whole
  numbers (page, pages) and short text, shown as text.
- **The Viewer has no foafos bridge.** It does not load the app SDK and asks the shell for nothing.
  It can only post messages to its parent.
- **No network.** The Viewer's CSP is
  `default-src 'none'; script-src 'self'; style-src 'self'; img-src blob: data:; media-src blob:;
  font-src blob: data:; worker-src 'self' blob:; connect-src 'none'; form-action 'none'; base-uri 'none'`.
  Scripts come only from this site: the Viewer's own and pdf.js.
- **pdf.js with its safe switches:** `isEvalSupported: false`, `enableXfa: false`,
  `useSystemFonts: false`. pdf.js is not loaded into the Files frame at any time.
- **Pinned bytes.** `third_party/pdfjs/README.md` has the SHA-256 of both files, checked against
  the `pdfjs-dist` 6.4.299 tarball from npm on 2026-11-13 (same bytes).
  `npm run test:viewer` fails when a file changes.

Pictures, sound and video still show in Files itself, through the host browser's own `<img>`,
`<audio>` and `<video>` elements from a `blob:` URL. No third-party JavaScript runs for them.

## Tests

`inklet/finkapp/test/e2e-files-locations.mjs`, 2026-11-13 on a Mac (Chrome headless shell 1248):
117 pass, 0 fail (out of 117). The checks for this change:

- A two-page PDF made in the test shows page 1 with text on it (713 dark pixels). Next page, clicked
  in the Viewer as a person would, shows "Page 2 of 2".
- The frame's sandbox is exactly `allow-scripts`, and no request for `third_party/pdfjs/` is made
  from the Files frame.
- From inside the Viewer: `foafos` is undefined. Reading the parent document is refused. `fetch` is
  refused. `sendBeacon` is stopped by `connect-src` (counted from the `securitypolicyviolation` event,
  because `sendBeacon` can return true and still be stopped). A picture from the site is refused.

Mutation checks: with `default-src` and `connect-src` removed from the CSP, the isolation check fails
("fetch SENT, beacon SENT"). With one byte added to `pdf.min.mjs`, `npm run test:viewer` fails.

The same run also fixed a timing fault in the test. It reloaded at once after the icon view was
chosen, before the shell's store had kept the choice, and failed 3 of 4 runs on a Mac. It now waits
for the button to show the choice, then 500 ms.

## Fault found on the way

The first version stopped listening for the Viewer's messages when the frame was not in the page.
Files builds the detail panel before it puts it in the page, and other messages (from the shell)
arrive meanwhile. So the listener removed itself before the Viewer was ready, and the PDF never
showed. It now stops only after the frame has been in the page and then left it.

## Next (step 2, not done)

- **The Viewer as an "Open with" handler that needs only a share.** Today the shell offers only apps
  that hold `pod:read` (`fileHandlers` in `inklet/finkapp/foafos-shell.js`), so a handler app would
  hold more than the one file. A manifest flag for a share-only handler would let the Viewer open
  from the shell with the one file and nothing else. That changes shell sandbox code, so it is a
  separate step with its own tests (`docs/foafos-open-with-20261105.md`, "Binary files: pod verbs
  carry text", is also in the way).
- Optional: move pictures, sound and video previews into the Viewer too, so that all renderers of
  untrusted files sit in one place.
