# OPENDOC — data is central, editors are faces

> Data ages like wine. Software ages like fish.

This data layer borrows its spirit from 1990s **OpenDoc**: the durable thing is
the *data object*, not the application. Editors are task-contextual *faces* over
that object — a spreadsheet face, an Access-like database face, an RDF face —
and they are interchangeable. You pick the face that suits the task; the data
underneath is unchanged.

## The data object and its upstream forms

A data object's most upstream (canonical, software-independent) form can be any
of three open, self-describing formats. The workspace reads and writes all
three, and they are interchangeable representations of the same object:

| Form | File | What it is | Best when |
|------|------|-----------|-----------|
| **SQLite** | `.sqlite` / `.db` | the live relational database, lossless | you want everything — tables, views, types — round-tripped exactly |
| **Zip of CSVs** | `.csv.zip` | one CSV per table + a `MANIFEST.txt` | the data should be diff-able, git-friendly, openable in anything |
| **N-Quads** | `.nq` | RDF: one named graph per table, row→subject, column→predicate | the data wants to be linked, merged with other graphs, or self-describing |

`⬇ SQLite`, `⬇ CSVs`, and `⬇ N-Quads` export each form; `⬆ Open…` imports any of
them (routing by extension, sniffing as a fallback). CSV stays the easy on-ramp.

### Lossless vs. lossy, honestly

- **SQLite round-trips losslessly** — it *is* the working store.
- **Zip-of-CSVs** carries table shape and cell values; it does not carry views,
  formulas, or column types (CSV has no types — numbers are re-inferred on
  import). It is the most portable and the most human-legible.
- **N-Quads** carries tables, rows, columns, and literal *types* (integers and
  doubles survive as `xsd:integer` / `xsd:double`). Views and formulas are not
  exported. Generic N-Quads from elsewhere import too: each graph becomes a
  table, each predicate a column, each subject a row.

When you need a guaranteed-faithful archive, keep the `.sqlite`. The CSV and
N-Quads forms are for portability, diffing, and linking.

## Extension islands pass through unharmed

Anything the workspace doesn't understand should survive a round-trip rather
than be silently dropped. The `.sqlite` form is the strong guarantee here: an
import/export cycle preserves tables, views, indexes, and triggers the UI never
surfaces — they are carried as opaque islands. (CSV and N-Quads are lossy by
construction and make no such promise; that's the trade for portability.)

## Versions committed, maybe even signed

> Older versions committed, maybe even digitally signed.

Every export is **fingerprinted with SHA-256** over the exact bytes, shown in the
export toast (`sha256 b94d27b9934d…`). The fingerprint is a content address: two
exports with the same hash are byte-identical, and a committed hash lets a later
reader verify an archive hasn't drifted. It is the honest, dependency-free first
step toward digital signing — sign the hash and you've signed the object.

## Faces, not formats, in front of the user

The grid (database face), the sheet (spreadsheet face), and the query workbench
(Access-like face) all read and write the *same* SQLite object. Open a table as
a sheet, add formulas, save it back as a table; run a query, save it as a view;
send any of it to the document editor. The format you exported from is not the
format you have to think in — the object is central, the faces are contextual.

## Files

- `nquads.js` — relational tables ⇄ RDF N-Quads
- `csv.js` + `js/zip.js` — relational tables ⇄ zip-of-CSVs
- `data-engine.js` — the SQLite (WASM) object store and its `.sqlite` export
- `data-workspace.js` — the faces, the export/import toolbar, the fingerprint
