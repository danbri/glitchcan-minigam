# foafos (factoidal npm build) — vendored

- Source: https://github.com/danbri/factoidal — `docs/npm/foafos/`
  (the Pages mirror of `npm/factoidal/`), package `@danbri/foafos`
  0.1.0-alpha.0 (unpublished).
- Vendored 2026-08-02 from factoidal commit
  `668c70a490646720efcb18a2c4ff53e8137fecc5`; the bundle's own build
  stamp is in `version.json`. License: Apache-2.0 (see LICENSE).
- Files: `browser.js` (ES-module API: `query`, `queryDataset`, `toRdf`,
  `canonicalize`, `setFactoidalUrl`, …) and `factoidal.js` (the
  F*-extracted js_of_ocaml engine, fetched by browser.js relative to
  its own URL — keep the two side by side). `browser.d.ts` for types.
- Deliberately NOT vendored: `factoidal-npm-entry.js` (~1.1 MB,
  lazily loaded only for SHACL/ShEx/OWL/RML/JSON-LD extras),
  `browser-wasm.js` + wasm assets (only for `engine: 'wasm'`), and
  the HACL crypto glue. If a page needs those, vendor them beside
  these files — browser.js resolves them relative to itself.
- Used by: `layerviz/rdf.html`.
- Known quirks of this build (2026-08-02): `FILTER [NOT] EXISTS`
  returns empty results (use `MINUS` or filter in JS); statements
  with unresolvable relative IRIs are dropped silently — always pass
  `baseIRI`. Details: `layerviz/README.md`.

To update: copy the same files from a newer factoidal
`docs/npm/foafos/` and refresh this note with the new commit sha.
