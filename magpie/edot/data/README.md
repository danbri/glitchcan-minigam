# edot data — a browser data layer (SQLite WASM) as web components

A spreadsheet **and** a database in the browser, sharing one SQLite engine — an
Excel-like formula grid and an Access-like SQL/query/view workbench, with the
two thoughtfully wired together. No server, no backend.

**Live:** `magpie/edot/data/data.html` (also linked from the editor — **File ▸
Data workspace**).

## Pillars

- **SQLite, in the browser** — [sql.js](../../../third_party/sqljs/) (SQLite
  compiled to WASM) runs on the main thread (no COOP/COEP, so it works on GitHub
  Pages) and persists the whole database to **IndexedDB**. Stores both
  CSV-imported data and hand-made relational tables/views.
- **Excel-like spreadsheet** (`<edot-sheet>`) — A1 cells holding values or
  `=formulas`: arithmetic, comparisons, `&` concat, ranges (`A1:B3`), and ~30
  functions (SUM, AVERAGE, IF, ROUND, CONCAT, LEFT/MID/RIGHT, …). Formula bar,
  live recompute, circular-reference detection.
- **Access-like queries** (`<edot-query>`) — write SQL over your tables, run it,
  see results in a grid, and **save a SELECT as a view**.
- **Sample database** — **🎵 Sample (Chinook)** loads the open-source
  [Chinook](../../../third_party/chinook/) database (the multi-engine successor
  to Northwind: 11 related tables / ~3,500 tracks) and opens a demo 4-table
  join, so the relational features have real data to play with.
- **Editable grid** (`<edot-grid>`) — reusable, keyboard-navigable; cell edits
  on a table write straight back via SQL `UPDATE`.

## The integration (Excel ↔ Access)

This is the point — the two halves talk to each other:

| Bridge | How |
| --- | --- |
| CSV → table | **Import CSV** creates a SQLite table (numeric coercion). |
| table/view → grid | Open it; edits `UPDATE` the row by `rowid`. |
| table → sheet | **Open as sheet** — add formula columns over real data. |
| **sheet → table** | **Save as table** — the computed values become a SQLite table, now queryable in SQL. |
| query → sheet | **Send to sheet** — drop a result set into a new spreadsheet. |
| **cell → SQL** | `=SQL("SELECT …")` in any formula pulls a scalar straight from the relational layer. |
| **table/result → document** | **→ Editor** sends a table, sheet, or query result into an open edot document (as an HTML table) — live via a BroadcastChannel, or picked up on next open via localStorage. |

Sheets live *inside* the same database (a `__edot_sheets` meta table), so they
persist and round-trip with everything else. Export/import the whole workspace
as a `.sqlite` file.

## Web components

```
data/
  data-engine.js      DataEngine — sql.js wrapper + IndexedDB persistence
  formula.js          Excel-style formula parser/evaluator (+ SQL() bridge)
  csv.js              RFC4180-ish CSV parse/serialize
  grid-component.js   <edot-grid>    editable, keyboard-navigable grid
  sheet-component.js  <edot-sheet>   spreadsheet with formula bar + recompute
  query-component.js  <edot-query>   SQL editor + results + save-as-view
  data-workspace.js   <edot-data>    the workspace tying it all together
  data.html           host page
```

All four are real custom elements (`customElements.define`) using light DOM +
the shared `data.css`, so they can be embedded individually.

**Mobile:** the object list (tables/views/sheets) collapses into a slide-in
**☰ drawer** with a scrim, the toolbar stays sticky, and tap targets grow on
coarse pointers — sharing the editor's design tokens for a consistent feel.

## Testing

```bash
node magpie/edot/data/test-data.mjs   # 12 checks, real Chromium + sql.js
```

Covers: engine boot, CSV→table, numeric coercion, grid edit→`UPDATE`, view
create/query/sidebar, table→sheet, `=SUM(range)`, `=SQL()` bridge, sheet→table
materialisation, and DB export.

## Limits / roadmap

- Formula functions are a useful subset, not all of Excel; no cross-sheet
  references yet (a sheet references the DB via `=SQL()` instead).
- Grids render up to a couple of thousand rows (no virtualisation yet).
- Deeper editor integration (drop a query/table into an edot document) is a
  natural next step; today they share the browser and the `.sqlite`/CSV files.
