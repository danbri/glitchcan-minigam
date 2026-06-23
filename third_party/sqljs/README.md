# sql.js (vendored)

[sql.js](https://github.com/sql-js/sql.js) — SQLite compiled to WebAssembly via
Emscripten. Runs entirely in the browser on the main thread (no COOP/COEP
headers, so it works on GitHub Pages), in-memory, with `db.export()` /
`new SQL.Database(bytes)` for persistence.

- Version: 1.10.3 (dist `sql-wasm.js` + `sql-wasm.wasm`)
- License: MIT (see `LICENSE`)
- Used by edot's data layer (`magpie/edot/data/`).
