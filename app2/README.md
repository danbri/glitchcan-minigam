app2 workspace

This folder contains two packages:

- gcfink: Core FINK/INK utilities (extraction, engine glue, utils) with basic tests.
- gcui: Glitchcanary UI package skeleton (no implementation here).

Notes
- No external dependencies are required for tests; a tiny Node test runner is included.
- If `inkjs` is available globally (e.g., injected in a browser), `gcfink` can use it. In Node, tests inject a stub compiler to validate integration without network installs.

Running tests
- Node-only tests (no browser): `node gcfink/test/run.js`
- Headless browser (optional):
  1. `npm i -D playwright`
  2. `node gcfink/test/headless/run-playwright.js`

Headless Browser Notes
- The headless page (`gcfink/headless/page.html`) loads `inkjs` from a CDN; if offline, the headless test will skip/fail early.
- The Playwright script loads a real FINK file (e.g., `inklet/bagend.fink.js`), extracts Ink via in-page `oooOO`, compiles with inkjs, and summarizes the run.
