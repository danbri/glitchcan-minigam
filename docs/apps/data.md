# Data

`<edot-data>` is the SQLite + spreadsheet + query workbench app of the edot suite. It runs a full SQLite database in the browser (via sql.js / WASM, no COOP/COEP required) backed by IndexedDB, and exposes three interchangeable "faces" for each object: a datasheet grid (editable, sorts columns), a formula spreadsheet (Excel-style, includes geo and SQL bridge functions), and an RDF N-Quads view. Structured data surfaces here from other apps (Calendar, Feeds) via the `data.addTable` kernel capability, and data flows out to the Editor via `data:share`.

Entry point: `magpie/edot/data/data.html`. Custom element: `edot-data` (defined in `data-workspace.js:672`). Engine: `DataEngine` in `data-engine.js`. Sheet: `EdotSheet` in `sheet-component.js`. Grid: `EdotGrid` in `grid-component.js`. Query workbench: `EdotQuery` in `query-component.js`.

---

## Features

- **SQLite WASM engine** [stable] — Full in-browser SQLite via sql.js; persists to IndexedDB as a serialized binary blob (400 ms debounced; `data-engine.js:150–156`). Supports tables, views, arbitrary SQL. No server, no COOP/COEP headers needed.
- **Tables** [stable] — User-created tables with prompt-driven column definition; editable rows (insert/delete via rowid); cell-level UPDATE writes back on edit commit. Column sort (asc → desc → original) with a display-order map so edits after sorting hit the correct row (`grid-component.js:40–48`).
- **Views** [stable] — Named views created from SELECT queries via the query workbench; listed in sidebar alongside tables; read-only in the grid face.
- **Sheets (standalone)** [stable] — 30×8 default grid persisted as JSON in the `__edot_sheets` meta table; auto-save on `change`; serialize/deserialize round-trip (`sheet-component.js:76–82`).
- **Spreadsheet face over a table** [stable] — Any table/view opens as a scratch compute lens; edits not written back; "Save as table" materializes the computed grid into a new SQL table (`data-workspace.js:307–329`).
- **Formula engine** [stable] — Recursive-descent parser, AST evaluator. Operators: arithmetic, comparison, concatenation (`&`), percent. Cell refs (`A1`), ranges (`A1:B3`), absolute refs (`$A$1`). Circular reference detection (`#CIRC!`). Functions: SUM, AVERAGE, COUNT, COUNTA, MIN, MAX, PRODUCT, ROUND/UP/DOWN, ABS, INT, MOD, POWER, SQRT, PI, IF, AND, OR, NOT, IFERROR, CONCAT/CONCATENATE, LEN, LEFT, RIGHT, MID, UPPER, LOWER, TRIM, TODAY, NOW (`formula.js:169–221`).
- **`=SQL("…")` bridge** [stable] — A formula cell can execute any SQL query against the live engine; returns the first cell of the first result row (`sheet-component.js:207`).
- **Geo extension functions** [stable] — QID/WIKIDATA, LAT/LATITUDE, LON/LONGITUDE, GEOCODE, PLACEKIND, PLACEDESC, GEODISTANCE (haversine). Require a preloaded gazetteer (`enableGeo` / `loadGeo`); resolve synchronously at eval time. Unknown place → `#N/A`; no gazetteer → `#NAME?` (catchable with IFERROR). `data-workspace.js:62–80`, `formula.js:152–222`.
- **Three-way object faces** [stable] — Datasheet (editable `<edot-grid>`), Spreadsheet (formula `<edot-sheet>`), RDF (`<textarea>` of N-Quads). Segmented "View as" control with `aria-current` (`data-workspace.js:265–345`).
- **Folders** [stable] — All objects (tables, views, sheets) live in a named folder. Default folder is "General" or the active project folder. Empty folders are shown. Objects can be moved. Extra folder names persisted in `__edot_settings`. No object is loose at the top level (`data-workspace.js:195–238`).
- **Project folder integration** [stable] — `setProjectFolder(name)` sets where new/surfaced objects land; called by the shell when a project opens (`data-workspace.js:235–239`).
- **Welcome panel** [stable] — Shown on init instead of a raw SQL prompt. Five cards: Open a file, Sample database, New spreadsheet, New table, Write SQL (`data-workspace.js:377–400`).
- **Chinook sample DB** [stable] — Fetches `third_party/chinook/Chinook_Sqlite.sql`, creates 11 tables (Album, Artist, Customer, Employee, Genre, Invoice, InvoiceLine, MediaType, Playlist, PlaylistTrack, Track), opens the query workbench with a 4-table revenue demo query (`data-workspace.js:514–525`).
- **CSV import** [stable] — RFC 4180-ish parser; numeric coercion; header row becomes column names; safe identifier sanitization with deduplication (`csv.js`, `data-workspace.js:424–435`).
- **ZIP-of-CSVs import** [stable] — Imports every `.csv` entry from a zip archive as a separate table (`data-workspace.js:591–606`).
- **SQLite file import** [stable] — Accepts `.sqlite`/`.db` files; replaces the in-memory DB and re-persists to IndexedDB (`data-workspace.js:589`).
- **N-Quads import** [stable] — Parses N-Quads text; maps named graph → table, predicate → column, subject → row; typed literals coerced to numbers (`nquads.js:47–72`, `data-workspace.js:608–620`).
- **Unified file open (extension sniffing)** [stable] — Single file input routes by extension; falls back to magic-byte sniffing for unknown extensions (`data-workspace.js:574–587`).
- **SQLite export** [stable] — Binary `.sqlite` download; SHA-256 fingerprint shown in toast (`data-workspace.js:553`).
- **ZIP-of-CSVs export** [stable] — All user tables as CSVs in a zip with `MANIFEST.txt`; SHA-256 fingerprint (`data-workspace.js:555–566`).
- **N-Quads export** [stable] — All tables as typed N-Quads; named graph per table; SHA-256 fingerprint (`data-workspace.js:568–571`, `nquads.js:24–44`). Exports are deterministic (byte-identical across calls).
- **Per-table CSV export** [stable] — Download a single table as CSV from the datasheet face (`data-workspace.js:642–645`).
- **RDF face per-table N-Quads export + clipboard copy** [stable] — From the RDF face, download or copy the N-Quads for the active object (`data-workspace.js:333–345`).
- **Query workbench** [stable] — `<edot-query>`: SQL textarea + ▶ Run (Ctrl/⌘+Enter), result in `<edot-grid>`, row count status, "Save as view", "Send to sheet", "→ Editor" (`query-component.js`).
- **Send to sheet** [stable] — Query results create a new sheet in `__edot_sheets` and open it (`data-workspace.js:505–511`).
- **Send to editor (cross-tab)** [stable] — Converts columns/rows to HTML table; writes to `localStorage['edot.handoff']`; broadcasts via `BroadcastChannel('edot')`; also publishes `data:share` on the kernel bus (`data-workspace.js:528–539`).
- **`data.addTable` kernel capability** [stable] — Registered on `getKernel().capabilities` during `init()`; allows Calendar, Feeds, and other apps to surface a structured table into Data without any direct reference to `EdotData` (`data-workspace.js:53`).
- **`data:share` kernel bus publish** [stable] — Published by `sendToEditor`; consumed by Workspace to route the table into Slides or the Editor pane (`data-workspace.js:537`).
- **Mobile object drawer** [stable] — ☰ button toggles `.side-open` class; tap on scrim closes (`data-workspace.js:97, 119`).
- **Export SHA-256 fingerprint** [stable] — All durable exports (SQLite, N-Quads, zip-CSVs) call `fingerprint()` from `js/data-object.js`; hash shown in toast and stored as `_lastFingerprint` (`data-workspace.js:630–640`).
- **addColumn / rename (engine level)** [partial] — `DataEngine` exposes `addColumn` and `rename` (`data-engine.js:108–118`) but no UI in the workspace triggers them.
- **geo-src attribute auto-enable** [partial] — `<edot-data geo-src="…">` triggers `enableGeo` on init (`data-workspace.js:54–55`); no UI to enable/disable geo at runtime after mount.
- **PLACEDESC geo function** [stable] — Returns `description` field from gazetteer; tested via QID lookup (`test-geo-formula.mjs:23`).

---

## Side-effecting actions (command-registry inventory)

| Action | Trigger | Effect | Proposed command id |
|---|---|---|---|
| Open file (any format) | Toolbar "⬆ Open…" button → hidden file input; Welcome card "📂 Open a file" | Routes by extension/magic bytes to importCsv / importDbFile / importCsvsZip / importNquadsFile; refreshes sidebar; opens result | `data:open-file` |
| Load Chinook sample | Toolbar "🎵 Sample (Chinook)" button; Welcome card "🎵 Sample database" | Drops then recreates 11 Chinook tables from SQL; opens query workbench with demo query | `data:load-sample` |
| New sheet | Toolbar "＋ Sheet" button; Welcome card "▦ƒ New spreadsheet" | Prompts for name; creates 30×8 blank sheet in `__edot_sheets`; opens it | `data:new-sheet` |
| New table | Toolbar "＋ Table" button; Welcome card "▦ New table" | Prompts for name and column list; creates empty SQL table; opens it | `data:new-table` |
| Open SQL workbench | Toolbar "▤ SQL" button; Welcome card "▤ Write SQL" | Replaces main panel with `<edot-query>` | `data:open-query` |
| Export SQLite | Toolbar "⬇ SQLite" button | Serializes in-memory DB; triggers download of `edot-data.sqlite`; shows SHA-256 toast | `data:export-sqlite` |
| Export ZIP-of-CSVs | Toolbar "⬇ CSVs" button | Zips all user tables as CSVs + MANIFEST.txt; downloads `edot-data.csv.zip`; shows SHA-256 toast | `data:export-csvs-zip` |
| Export N-Quads | Toolbar "⬇ N-Quads" button | Serializes all tables as N-Quads; downloads `edot-data.nq`; shows SHA-256 toast | `data:export-nquads` |
| Add row (datasheet face) | "＋ Row" button (datasheet toolbar) | Inserts a NULL row into the active table; re-renders | `data:insert-row` |
| Delete row (datasheet face) | "✕ Row" button (datasheet toolbar) | Deletes the selected rowid from the active table; re-renders | `data:delete-row` |
| Export CSV (single table) | "⬇ CSV" button (datasheet toolbar) | Downloads active table as `<name>.csv` | `data:export-table-csv` |
| Send to editor | "→ Editor" button (datasheet, sheet, and query toolbars) | Writes HTML table to `localStorage['edot.handoff']`; broadcasts on BroadcastChannel; publishes `data:share` on kernel bus | `data:send-to-editor` |
| Switch face (datasheet/spreadsheet/RDF) | Segmented "View as" control (3 buttons) on any table/view header | Replaces main panel with grid / sheet / RDF textarea for the same object | `data:set-face` |
| Save sheet as table (from sheet face or standalone sheet) | "▤ Save as table" button | Materializes current sheet computed values into a new SQL table; opens it in datasheet face | `data:sheet-to-table` |
| Export N-Quads (RDF face) | "⬇ N-Quads" button (RDF face toolbar) | Downloads N-Quads for the active table only | `data:export-object-nquads` |
| Copy N-Quads to clipboard (RDF face) | "⎘ Copy" button (RDF face toolbar) | Writes N-Quads text to clipboard; shows toast | `data:copy-nquads` |
| Run SQL query | "▶ Run" button or Ctrl/⌘+Enter in query workbench | Executes SQL; shows results in grid; updates row count | `data:run-query` |
| Save query as view | "Save as view" button (query workbench) | Calls `engine.createView(name, sql)`; dispatches `views-changed`; refreshes sidebar | `data:save-view` |
| Send query result to sheet | "Send to sheet" button (query workbench) | Creates a sheet from query result in `__edot_sheets`; opens it | `data:query-to-sheet` |
| New folder | "＋ Folder" button (sidebar head) | Prompts for name; persists to `__edot_settings`; re-renders sidebar | `data:new-folder` |
| Move object to folder | "⤴" icon on each sidebar item | Prompts for target folder name; updates `__edot_folders`; re-renders | `data:move-to-folder` |
| Delete object | "✕" icon on each sidebar item | Confirms; drops table/view or deletes from `__edot_sheets`; clears from `__edot_folders` | `data:delete-object` |
| `addTable(title, columns, rows)` | Kernel capability `data.addTable` (called by Calendar, Feeds) | Creates a SQL table from structured data; refreshes sidebar; opens it | `data:add-table` (capability) |
| `addCsvTable(title, text)` | API call (Projects shell hydration) | Parses CSV text; creates SQL table; opens it | `data:add-csv-table` |
| `setProjectFolder(name)` | Shell API (called when a project opens) | Sets `_projectFolder`; ensures folder persisted; refreshes sidebar | `data:set-project-folder` |
| Enable geo (`geo-src` attribute or `enableGeo(src)`) | Attribute on `<edot-data>`; programmatic API | Fetches NDJSON gazetteer; builds name+QID index; injects into all active sheets | `data:enable-geo` |
| Toggle mobile drawer | "☰" button | Adds/removes `.side-open` class on root div | `data:toggle-drawer` |

---

## User journeys

1. **Load the Chinook sample DB and run a query**
   - Open Data. The welcome panel is shown.
   - Click "🎵 Sample database" (or toolbar "🎵 Sample (Chinook)").
   - The 11 Chinook tables are created; the SQL workbench opens with a pre-filled 4-table revenue join.
   - Press ▶ Run (or Ctrl+Enter). The top-selling artists appear in the grid with row count.
   - Click "Save as view" to name and save the result as a reusable view in the sidebar.

2. **Import a CSV and edit data in the datasheet**
   - Click "⬆ Open…" (or the "📂 Open a file" welcome card). Select a `.csv` file.
   - The table appears in the sidebar under the General folder; the datasheet opens.
   - Click a column header to sort ascending; click again for descending; again to restore.
   - Double-click a cell to edit it. Press Enter to commit; the UPDATE writes to SQLite immediately.
   - Click "＋ Row" to append a blank row; "✕ Row" to delete the selected one.
   - Click "⬇ CSV" to export the current table as a single CSV.

3. **New spreadsheet with geo formula**
   - Click "▦ƒ New spreadsheet" (or toolbar "＋ Sheet"). Name it.
   - Type city names in column A (e.g. A1: `London`, A2: `Bristol`).
   - In B1: `=LAT(A1)`, in B2: `=LON(A2)`, in C1: `=GEODISTANCE(A1,A2)`.
   - If a gazetteer has been loaded (via `geo-src` attribute or `enableGeo()`), the coordinates and distance appear. Unknown names produce `#N/A`; wrap in IFERROR to show a fallback.
   - Click "▤ Save as table" to materialize the computed grid into a SQL table for further querying.

4. **Organize objects into folders**
   - After importing several tables and creating sheets, all land in the General (or project) folder.
   - Click "＋ Folder" in the sidebar head. Type "Reports". An empty Reports folder appears.
   - Click "⤴" next to a table name. Type "Reports" at the prompt. The item moves.
   - When the shell opens a project, `setProjectFolder("My Project")` redirects new objects automatically.

5. **Receive a feed or calendar as a table**
   - From the Calendar or Feeds apps, the user selects "Open as table".
   - Those apps call the `data.addTable` kernel capability with title, columns, and rows.
   - Data creates a SQL table, opens it in the datasheet face, and adds it to the sidebar under the current folder.
   - The user can then query it with SQL, open it in the spreadsheet face, or export it.

6. **Export durable forms and verify fingerprints**
   - Click "⬇ SQLite" to download `edot-data.sqlite` — a complete, software-independent copy of the database. A SHA-256 hash is shown in the toast (first 12 hex chars + "…").
   - Click "⬇ CSVs" to download `edot-data.csv.zip` — every user table as a CSV with a MANIFEST.txt. Same fingerprint treatment.
   - Click "⬇ N-Quads" to download `edot-data.nq` — the RDF form. Or open a table, switch to the RDF face, and use "⎘ Copy" to put the N-Quads of that one table on the clipboard.
   - Exports are byte-deterministic: re-exporting the same data produces the same file and the same SHA-256.

---

## Test coverage

### test-data.mjs (37 assertions, Playwright/Chromium)

| Feature | Covered by (suite::assertion label) | Status |
|---|---|---|
| Engine boot | `test-data.mjs :: engine (sqlite wasm) booted` | covered |
| Welcome panel (not SQL) | `test-data.mjs :: opens to the welcome start panel, not SQL` | covered |
| Auth/alpha chip | `test-data.mjs :: header shows the alpha sign-in chip` | covered |
| CSV import → table | `test-data.mjs :: CSV imported as a table (sidebar)` | covered |
| Grid row rendering | `test-data.mjs :: table grid renders rows` | covered |
| Numeric coercion on import | `test-data.mjs :: amount is numeric in store` | covered |
| Cell edit → UPDATE | `test-data.mjs :: grid edit -> UPDATE persists` | covered |
| View creation and query | `test-data.mjs :: view created and queryable` | covered |
| View in sidebar | `test-data.mjs :: view appears in sidebar` | covered |
| Sheet formula =SUM(range) | `test-data.mjs :: sheet formula =SUM(range) computes` | covered |
| Sheet =SQL() bridge | `test-data.mjs :: sheet =SQL() reads the database` | covered |
| Sheet materialization to table | `test-data.mjs :: sheet -> SQL table (materialised, queryable)` | covered |
| Chinook tables load | `test-data.mjs :: Chinook core tables loaded` | covered |
| Chinook row count | `test-data.mjs :: Chinook has ~3500 tracks` | covered |
| Chinook 4-table join | `test-data.mjs :: Chinook 4-table join runs` | covered |
| Chinook sidebar | `test-data.mjs :: Chinook sidebar shows the tables` | covered |
| Send to editor handoff | `test-data.mjs :: sendToEditor writes an HTML-table handoff` | covered |
| Mobile drawer toggle | `test-data.mjs :: mobile drawer toggles via ☰` | covered |
| N-Quads export (typed quads) | `test-data.mjs :: N-Quads export emits typed quads` | covered |
| N-Quads round-trip | `test-data.mjs :: N-Quads round-trips a table (name/cols/rows)` | covered |
| N-Quads numeric typing | `test-data.mjs :: N-Quads preserves numeric typing` | covered |
| N-Quads determinism | `test-data.mjs :: N-Quads export is deterministic (byte-identical)` | covered |
| CSV determinism | `test-data.mjs :: CSV export is deterministic (byte-identical)` | covered |
| ZIP-of-CSVs round-trip | `test-data.mjs :: zip-of-CSVs round-trips entry + content` | covered |
| Export SHA-256 fingerprint | `test-data.mjs :: export fingerprints content (sha256)` | covered |
| Grid sort ascending | `test-data.mjs :: grid sorts ascending on header click` | covered |
| Grid sort descending | `test-data.mjs :: grid sorts descending on second click` | covered |
| Edit after sort → correct row | `test-data.mjs :: edit after sort writes back to the correct row` | covered |
| Datasheet face + 3-way switcher | `test-data.mjs :: datasheet face renders a grid with a 3-way switcher` | covered |
| Spreadsheet face | `test-data.mjs :: spreadsheet face renders a sheet` | covered |
| RDF face | `test-data.mjs :: RDF face shows the N-Quads form of the object` | covered |
| Folders: default folder | `test-data.mjs :: new objects default into a folder (General)` | covered |
| Folders: move object | `test-data.mjs :: an object can be moved to another folder` | covered |
| Folders: project folder scoping | `test-data.mjs :: a project folder collects newly created objects` | covered |
| Folders: no loose objects | `test-data.mjs :: no object is loose outside a folder` | covered |
| DB export to bytes | `test-data.mjs :: database exports to bytes` | covered |
| No page errors | `test-data.mjs :: no page errors` | covered |

### test-geo-formula.mjs (12 assertions, pure Node)

| Feature | Covered by (suite::assertion label) | Status |
|---|---|---|
| QID() by name | `test-geo-formula.mjs :: QID("Bristol") -> Q23154` | covered |
| WIKIDATA() alias | `test-geo-formula.mjs :: WIKIDATA by name is the same id` | covered |
| QID lookup by QID string | `test-geo-formula.mjs :: lookup works by QID too` | covered |
| LAT() | `test-geo-formula.mjs :: LAT("London") ~ 51.5` | covered |
| LON() | `test-geo-formula.mjs :: LON("London") ~ -0.13` | covered |
| GEOCODE() | `test-geo-formula.mjs :: GEOCODE returns "lat, lon"` | covered |
| PLACEKIND() | `test-geo-formula.mjs :: PLACEKIND("London") -> city` | covered |
| GEODISTANCE() | `test-geo-formula.mjs :: GEODISTANCE London<->Edinburgh ~ 534 km` | covered |
| Geo + math composition | `test-geo-formula.mjs :: GEO functions compose (ROUND of a distance)` | covered |
| Cell-ref argument to geo fn | `test-geo-formula.mjs :: cell-ref arg works via a fake ctx.cell` | covered |
| Unknown place → #N/A via IFERROR | `test-geo-formula.mjs :: unknown place -> #N/A, catchable by IFERROR` | covered |
| No gazetteer → #NAME? | `test-geo-formula.mjs :: no gazetteer loaded -> #NAME?` | covered |

### Cross-suite coverage of Data features

| Feature | Covered by (suite::assertion label) | Status |
|---|---|---|
| data.addTable capability (from Calendar) | `test-calendar-share.mjs :: Open as table invokes data.addTable with event rows` | covered |
| data.addTable (from Feeds) | `test-feed.mjs :: data.addTable surfaces a feed as a Data table` | covered |
| data.addTable (ICS from Feeds) | `test-feed.mjs :: data.addTable surfaces an .ics as a Data table` | covered |
| Surfaced tables in sidebar | `test-feed.mjs :: surfaced tables appear in the Data object browser` | covered |
| Template table hydration via addCsvTable | `test-projects-shell.mjs :: template table hydrated into the Data pane` | covered |
| Geo in workspace (=QID) | `test-workspace.mjs :: data pane has geo functions (=QID -> Q84)` | covered |
| Geo in workspace (=GEODISTANCE) | `test-workspace.mjs :: data pane =GEODISTANCE computes (~534 km)` | covered |
| Shell Data View menu | `test-shell.mjs :: Data View menu offers data views (query / spreadsheet / datasheet)` | covered |
| Shell Data menu action (load sample) | `test-shell.mjs :: Data menu action works (load sample DB populates objects)` | covered |
| data:share bus publish | `test-workspace.mjs :: data share lands in the editor pane as one titled table` | covered |

### Gaps (untested)

- **`addColumn` UI** — `DataEngine.addColumn` and `DataEngine.rename` exist at `data-engine.js:108–118` but no workspace UI invokes them; neither is tested.
- **`importDbFile` end-to-end** — The function exists and is wired to the file input; no test drives it from a real `.sqlite` file.
- **`importCsvsZip` end-to-end** — The function exists; no test uploads a real zip archive.
- **`importNquadsFile` end-to-end** — The function exists; N-Quads import from a file object is untested (the N-Quads module itself is tested via direct API call in `test-data.mjs`).
- **`tableToSheet` (standalone)** — `data-workspace.js:487–495`; used internally from test but the `tableToSheet` method path (as distinct from `_tableSheetFace`) is not exercised with a standalone assertion.
- **Formula bar keyboard editing** — Formula bar input (Enter/Escape) is implemented in `sheet-component.js:129–132` but not tested headlessly.
- **Circular reference detection (`#CIRC!`)** — Implemented in `sheet-component.js:227` but no test covers a circular formula.
- **`PLACEDESC` function standalone** — Covered implicitly via QID lookup in `test-geo-formula.mjs:23` but there is no explicit PLACEDESC assertion.
- **`geo-src` attribute auto-enable** — `data-workspace.js:54–55`; no test exercises the attribute path (geo is enabled programmatically in the workspace test).
- **Export download trigger** — The `_emit` / `downloadCsv` paths create `<a>` elements and trigger `.click()`; the SHA-256 test in `test-data.mjs` intercepts `document.createElement` to capture the filename but the actual file download is not verified.
- **Delete object (UI)** — The "✕" button in the sidebar calls `_delete`; no test clicks it.
- **New folder UI** — `_newFolder` prompts the user; not testable headlessly without `page.evaluate` intercepting `window.prompt`.
- **Move to folder UI** — `_moveToFolder` also uses `prompt`; only the underlying `_setObjFolder` / `_saveExtraFolders` are exercised via `evaluate` in `test-data.mjs`.
- **`activeTableCsv()`** — Used by the Projects snapshot; the `test-projects-shell.mjs` snapshot test covers the round-trip but `activeTableCsv` is not asserted directly.
- **Mobile drawer scrim close** — Implemented at `data-workspace.js:119`; not tested.

---

## Known issues

- **`addColumn` / `rename` not exposed in UI** — `DataEngine` supports both at `data-engine.js:108–118` but neither is reachable from any toolbar or menu in `EdotData`.
- **`rename` blocked for views** — `DataEngine.rename` throws `'Rename a view by recreating it'` (`data-engine.js:116`); no UI wraps this for tables either.
- **Sheet grid size is fixed at render time** — `EdotSheet` renders the fixed `rowsN × colsN` grid; there is no UI to add rows or columns after creation. The grid does not auto-expand when data is pasted or typed beyond the initial bounds.
- **Spreadsheet face is a scratch lens** — The hint text says "edits aren't written back"; there is no undo. Discarding the face loses any in-progress formula work unless "Save as table" is clicked first.
- **View editing not supported** — Views appear in the sidebar and open in the datasheet face, but they are read-only (no ＋ Row / ✕ Row buttons). The "View as" switcher still offers the sheet and RDF faces.
- **Table limit 2000 rows in grid/sheet faces** — `tableRows` is called with `{ limit: 2000 }` in both `_tableGridFace` and `_tableSheetFace`; large tables are silently truncated. The CSV export uses `limit: 100000` and the zip export `limit: 1000000`.
- **`prompt()` for folder and table names** — New folder, new table, move-to-folder, and new sheet all use `window.prompt`, which is blocked in some embedded contexts and is not accessible-keyboard-friendly.
- **Geo requires external NDJSON or programmatic load** — There is no UI in the Data app itself to load a gazetteer; it must be provided via the `geo-src` HTML attribute or the `enableGeo(src)` API. The Workspace wires this up; the standalone `data.html` does not.
