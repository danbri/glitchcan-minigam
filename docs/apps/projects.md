# Projects

`<edot-projects>` is the project-bundle app. A project is a standard `.zip` file
(`*.edot.zip`) that packages a complete problem space — its documents, data tables,
slide decks, saved places, and calendar events — together with a JSON manifest
(`edot-project.json`). The bundle is self-contained: you can share it as a single
file, open it in a fresh browser session, and the entire workspace is restored.

**Open flow:** the app reads the `.zip`, parses the manifest, then publishes a
`project:open` event on the kernel bus. The shell's `hydrateProject()` handler
subscribes to that event and writes the first document into Editor, the first deck
into Slides, and the first CSV into Data (under a project-named folder), then
navigates to the Workspace view.

**Save flow:** `_save()` invokes the `project.snapshot` capability registered by the
shell. The snapshot handler reads the live Editor content, the active Slides deck, and
the active Data table (via `dt.activeTableCsv()`), assembles a `{ manifest, files }`
object, and returns it. Projects-app wraps that in `buildProjectZip()` and triggers a
browser download.

---

## Features

- **ZIP codec — STORE write** [stable] — `zipStore()` in `edot-project.js` builds
  STORE-method (uncompressed) `.zip` files with correct CRC-32 per entry and a
  well-formed central directory + EOCD. Dependency-free; runs in Node and browser.
- **ZIP codec — DEFLATE read** [stable] — `unzip()` handles both method 0 (STORE)
  and method 8 (DEFLATE via `DecompressionStream`); throws on unsupported methods.
- **Manifest** [stable] — `edot-project.json` with schema
  `{ edotProject:1, name, description, problemSpace, apps, docs, data, slides, places, calendar }`.
  `buildProjectZip()` serialises it as the first entry; `readProjectZip()` validates
  presence and the `edotProject` flag.
- **Template: field-survey** [stable] — Survey Brief doc, Sites CSV, Findings deck;
  `apps: ['editor','data','slides','maps']`.
- **Template: event-plan** [stable] — Run Sheet doc, Guests CSV, Schedule deck (ink
  theme); `apps: ['editor','data','slides','calendar']`.
- **Template: blank** [stable] — minimal doc, 2-column CSV, single-slide deck;
  `apps: ['editor','data','slides']`.
- **Open .zip from disk** [stable] — `<input type="file">` reads the file, calls
  `readProjectZip()`, shows a detail panel (manifest + declared files table), then
  lets the user click "Open in workspace →" to hydrate.
- **Save current workspace as .zip** [stable] — invokes `project.snapshot`, zips the
  result with `buildProjectZip()`, and triggers a `<a download>` click. Falls back to
  re-zipping the last opened project when no snapshot capability is available.
- **Hydrate Editor** [stable] — shell writes the first declared `docs[]` file into
  `edot-editor` via `setContent()`.
- **Hydrate Slides** [stable] — shell writes the first declared `slides[]` file into
  `edot-slides` via `applyDeckData(JSON.parse(...))`.
- **Hydrate Data** [stable] — shell sets a project folder (`setProjectFolder()`) then
  imports the first `data[]` CSV via `addCsvTable()`.
- **Snapshot: document** [stable] — shell captures `ed.getContent()`, writes
  `docs/document.html`.
- **Snapshot: deck** [stable] — shell captures `sl.deck`, writes `slides/deck.json`.
- **Snapshot: data table** [partial] — shell calls `dt.activeTableCsv()` which
  returns only the *currently active* table, not all tables in the project. Multi-table
  projects are not fully round-tripped.

---

## Side-effecting actions (command-registry inventory)

| Action | Trigger | Effect | Proposed command id |
|---|---|---|---|
| Use template | Click "Use template" on a template card | Builds project from template, publishes `project:open`, navigates to Workspace | `projects.useTemplate` |
| Download template .zip | Click ".zip" ghost button on a template card | Builds project from template and downloads `<slug>.edot.zip` immediately (no hydration) | `projects.downloadTemplate` |
| Open project from file | `<input type="file">` change event | Reads `.zip`, parses manifest, shows detail panel; does NOT hydrate yet | `projects.openFile` |
| Load into workspace | Click "Open in workspace →" in detail panel | Publishes `project:open` on bus → shell hydrates Editor/Slides/Data, navigates to Workspace | `projects.loadIntoWorkspace` |
| Save current as .zip | Click "⬇ Save current as .zip" | Invokes `project.snapshot` capability, zips result, triggers browser download | `projects.saveSnapshot` |

**Bus event:** `project:open` — payload `{ manifest, files: { [path: string]: string } }`.
Published by `EdotProjects.openProject()`; consumed by `hydrateProject()` in
`index.html:174`. Any app on the kernel bus can subscribe.

**Capability:** `project.snapshot` — registered by the shell at `index.html:177`.
Returns a promise resolving to `{ manifest, files }`. Invoked by `_save()` in
`projects-app.js:129`.

---

## User journeys

1. **Start from a template.** User opens the Projects app, sees the template gallery,
   clicks "Use template" on Field Survey. The app builds the project object in memory,
   publishes `project:open`, and the shell immediately hydrates: the Survey Brief
   appears in Editor, the Sites table in Data, and the Findings deck in Slides. The
   user fills in the template content in each pane.

2. **Open a shared .zip.** A colleague emails `field-survey.edot.zip`. User clicks
   "⬆ Open project (.zip)", picks the file. The app decodes the ZIP, shows the detail
   panel listing the manifest name and declared files. User reviews the contents, then
   clicks "Open in workspace →". The shell hydrates the workspace from the bundle.

3. **Download a template .zip without opening it.** User clicks the ".zip" ghost
   button on the Blank template card. The app calls `buildProjectZip(buildTemplate('blank'))` and triggers a download — no bus event, no hydration. The file can be sent to a colleague or archived.

4. **Save the workspace as a .zip.** After editing in the Workspace, user switches to
   Projects and clicks "⬇ Save current as .zip". The app invokes `project.snapshot`;
   the shell reads the live Editor content, active Slides deck, and active Data table,
   and returns `{ manifest, files }`. The app zips it and downloads
   `<project-name>.edot.zip`.

5. **Standalone (no shell).** `<edot-projects>` can be mounted without `index.html`.
   `openProject()` catches the bus publish error silently. `_save()` falls back to
   re-zipping the last opened project when `project.snapshot` is unavailable.

---

## Test coverage

### test-project.mjs (codec + templates — Node, no browser)

| Feature | Covered by (suite::assertion label) | Status |
|---|---|---|
| ZIP STORE write produces valid magic bytes | `test-project.mjs :: zip starts with PK magic` | covered |
| ZIP round-trip (STORE write → STORE read) | `test-project.mjs :: round-trips entry names + bytes` | covered |
| Template manifest name survives round-trip | `test-project.mjs :: [${t.id}] manifest name survives the round-trip` (×3) | covered |
| All content files survive round-trip | `test-project.mjs :: [${t.id}] all ${fileNames.length} content files survive` (×3) | covered |
| Every manifest-declared file present in bundle | `test-project.mjs :: [${t.id}] every manifest-declared file is present` (×3) | covered |
| Slide decks parse with valid slides array | `test-project.mjs :: [${t.id}] deck ${s.id} parses with slides` (×3) | covered |
| System `unzip` validates archive (standards compliance) | `test-project.mjs :: system unzip lists the archive (standards-valid zip)` | covered (conditional on CLI) |
| CRC-32 correctness via system `unzip -t` | `test-project.mjs :: system unzip integrity test passes (CRCs correct)` | covered (conditional on CLI) |

### test-projects-shell.mjs (shell integration — Playwright)

| Feature | Covered by (suite::assertion label) | Status |
|---|---|---|
| Projects app reachable from shell, shows template gallery | `test-projects-shell.mjs :: Projects is reachable from the shell and shows templates` | covered |
| Template doc hydrated into Editor pane | `test-projects-shell.mjs :: template doc hydrated into the Editor pane` | covered |
| Template deck hydrated into Slides pane | `test-projects-shell.mjs :: template deck hydrated into the Slides pane` | covered |
| Template table hydrated into Data pane | `test-projects-shell.mjs :: template table hydrated into the Data pane` | covered |
| Snapshot produces manifest with doc + deck | `test-projects-shell.mjs :: snapshot produces a manifest with a document and a deck` | covered |
| Snapshot bundles document and deck files | `test-projects-shell.mjs :: snapshot bundles the document and deck files` | covered |
| No page errors during the above | `test-projects-shell.mjs :: no page errors` | covered |

### Gaps (untested)

- **DEFLATE read path** — `unzip()` handles method 8 via `DecompressionStream`, but no
  test supplies a DEFLATE-compressed `.zip`. The branch is structurally present but
  never exercised by the suite.
- **Snapshot only captures the active Data table** — `dt.activeTableCsv()` returns one
  table. Projects with multiple data tables silently lose the others on save; no test
  verifies multi-table round-trip behaviour.
- **Open-from-file UI flow** — the detail panel (`_showDetail`, "Open in workspace →"
  button) is not covered by any test. The shell integration test uses `openProject()`
  directly via the template card, not the file-picker path.
- **Standalone fallback (no shell)** — `_save()` re-zips `this.current` when
  `project.snapshot` is unavailable; not tested.
- **Manifest validation rejection** — `readProjectZip()` throws on missing or invalid
  manifest; error-path coverage exists only as inline assertions, not in the test suite.
- **`places[]` and `calendar[]` manifest entries** — declared in the schema and
  rendered in the detail panel, but the hydration handler in `index.html` does not wire
  these to any app pane, and neither test suite covers them.
- **Event-plan `calendar` app entry** — the event-plan template declares
  `apps: ['editor','data','slides','calendar']`; the calendar hydration path is absent.

---

## Known issues

- **Duplicate ZIP implementation.** The edot codebase contains two independent ZIP
  codecs: `magpie/edot/js/zip.js` (used by Editor/Slides/Data for DOCX, PPTX, ODP,
  and zip-of-CSVs exports) and `magpie/edot/projects/js/edot-project.js` (the projects
  codec, re-implements `zipStore`, `unzip`, CRC-32, and little-endian helpers from
  scratch). The two are not shared. `js/zip.js` supports DEFLATE write via native
  `CompressionStream`; the projects codec writes STORE-only. They serve overlapping
  purposes with no cross-dependency, creating a maintenance surface and a potential
  divergence point if ZIP behaviour needs to change.
