# Places & Geo

The Places layer is edot's lazy gazetteer: a unified `searchPlaces()` API, a pluggable provider registry, and an `<edot-place-input>` autocomplete web component. It is consumed by Calendar (event location field), Maps (events-layer QID resolution), Data (geo spreadsheet functions), and Feeds (QID-keyed feed catalogue queries).

**Normalized Place shape** — shared across all providers and the formula layer:

```
{ name, wikidataId, lat, lon, kind, description, source }
```

Coordinates (`lat`/`lon`) may be `null` (Wikidata search returns none); `wikidataId` may be `null` (GeoNames/local have no QID). The facade merges hits for the same place from multiple sources so a single Place carries both.

**Source:** `magpie/edot/places/js/` (facade + web component + 3 providers), `magpie/edot/data/formula.js` (geo functions), `magpie/edot/places/tools/derive-places.mjs` (offline build tool). Catalogue: `magpie/edot/places/places-catalogue.json`.

---

## Features

- **Lazy provider registry** [stable] — `REGISTRY` in `places.js` holds `import()` thunks for `wikidata`, `geonames`, and `local`. Each provider module is loaded at most once per session (cached Promise). Apps pay nothing until a place is searched.

- **Wikidata provider** [stable] — `wbsearchentities` API (CORS-enabled, no key): returns `name + wikidataId + description`; no coordinates at search time. `coordsFor(qid)` lazily pulls P625 property only when the user selects a result.

- **GeoNames provider** [partial] — `searchJSON` API; returns `name + lat + lon + kind + description`; no QIDs. Requires a free `username` passed via `.config = { geonames: { username } }`; without one the source is a silent no-op. Not covered by any automated test.

- **Local/extract provider** [stable] — offline NDJSON search (`local.js`). Accepts a preloaded `index` array or a `url` to fetch-and-parse once (cached by URL). Two-pass search: prefix-matches first, then substring-matches, up to `limit`. Tested against the in-repo seed (`data/seed-places.ndjson`, 7 UK cities).

- **Progressive search merge/rank** [stable] — `searchPlaces()` runs all active sources concurrently via `Promise.allSettled`. Results are merged as each source resolves: a coordless Wikidata QID hit and a coordinate-bearing local/GeoNames hit with the same QID collapse into one Place. `onUpdate` callback fires on each partial result so the dropdown paints immediately rather than waiting for the slowest source. Ranking scores exact name match (+100), prefix (+50), contains (+20), has QID (+8), has coords (+4).

- **`<edot-place-input>` ARIA combobox** [stable] — `role=combobox` on the inner `<input>`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; `role=listbox/option` on the dropdown. 200 ms debounce on input. Keyboard: ArrowUp/Down navigate options, Enter selects, Escape closes. Mouse: `mousedown` + `preventDefault` on options to avoid blur-before-click race. Fires `place-selected` CustomEvent (bubbling) with the normalized Place as `event.detail`. Options display name, optional description, and QID badge. Lazy at two levels: the host page `import()`s `place-input.js` on demand; the element itself `import()`s `places.js` only when the user starts typing.

- **Lazy coordinate fill on selection** [stable] — when a selected hit has a QID but no coordinates (Wikidata search result), `_select()` calls `coordsFor(qid)` and attaches `lat`/`lon` to the Place before firing `place-selected`. Failure is silently swallowed (coords are best-effort).

- **Geo spreadsheet functions** [stable] — implemented in `formula.js` FUNCS map, resolved via synchronous `ctx.geo` callback (a `Map` keyed by lowercased name and by QID). Functions: `QID` / `WIKIDATA` (aliases, return Wikidata id string), `LAT` / `LATITUDE`, `LON` / `LONGITUDE`, `GEOCODE` (returns `"lat, lon"` string), `PLACEKIND`, `PLACEDESC`, `GEODISTANCE` (haversine, rounded to 0.1 km). Unknown place → `#N/A`; no gazetteer loaded → `#NAME?`; both catchable by `IFERROR`. Arguments may be string literals or cell references.

- **Gazetteer loading** [stable] — `EdotSheet.loadGeo(src)` and `DataWorkspace.enableGeo(src)` accept either a Place array or a URL to an NDJSON file. Both index by lowercased name and by uppercased QID, then push the shared `Map` to every child `<edot-sheet>` and trigger recompute.

- **`derive-places.mjs` offline build tool** [stable] — converts a GeoJSON FeatureCollection (or newline-delimited Features) to a normalized NDJSON extract, with optional bbox clipping and de-duplication by QID. Field mapping understands plain GeoJSON (`properties.name`, `properties.wikidata`) and Overture nested shapes (`names.primary`, `categories.primary`, `sources[].dataset='wikidata'`). Non-Point geometry falls back to the first ring's first coordinate. CLI flags: `--in`, `--out`, `--source`, `--bbox`, `--gzip`.

- **Planned sources** [untested] — `overture-places` (Overture Maps, ~60 M POIs, CDLA-Permissive-2.0) and `foursquare-places` (~100 M venues, Apache-2.0) are documented in the catalogue with `runtime: "planned"`. No extracts are in the repo; `derive-places.mjs` is the intended build path.

---

## Side-effecting actions / integration points

| Integration | Used by | Effect |
|---|---|---|
| `<edot-place-input>` element, `place-selected` event | Calendar (event edit dialog) | `calendar-app.js` line 334: `pickedPlace` captured; on save, `ev.locationWikidata` and `ev.locationGeo` are persisted to the event record if the typed value matches the picked name |
| `<edot-place-input>` element, `.value` property | Calendar (event edit dialog) | Pre-seeds the text field with `ev.location` when editing an existing event |
| `searchPlaces()` | `<edot-place-input>` internal `_run()` | Queries active catalogue sources concurrently; fires `onUpdate` for each arriving batch |
| `coordsFor(wikidataId)` | `<edot-place-input>._select()` | One Wikidata P625 fetch per selection when the chosen hit had no coords; result mutates the Place in-place before `place-selected` fires |
| `ctx.geo` / `EdotSheet.loadGeo()` | `formula.js` geo functions via `sheet-component.js` and `data-workspace.js` | Synchronous Map lookup at formula eval time; must be preloaded before any geo formula evaluates |
| `feedsForPlace(qid)` / `calendarsForPlace(qid)` in `feeds.js` | Calendar ("Browse" catalogue picker) | Filters the feed/calendar catalogue by Wikidata QID (or loose name match) |
| Maps events layer (`test-events-layer.mjs`) | Maps app | `eventsToFeatures` reads `ev.locationWikidata` QID and `ev.locationGeo` coords to place calendar events as GeoJSON point features |

---

## User journeys

1. **Autocomplete a place and get its QID (Calendar event):** User opens a Calendar event dialog, focuses the Location field. `calendar-app.js` inserts `<edot-place-input sources="wikidata,local-seed">` and lazy-imports `place-input.js`. User types "Bris" — after 200 ms debounce, `searchPlaces()` runs Wikidata and local-seed in parallel; local-seed resolves immediately with Bristol (Q23154, lat 51.4545, lon −2.5879); Wikidata resolves shortly after with entity results. Dropdown paints each batch as it arrives. User picks "Bristol"; `coordsFor("Q23154")` is called (Bristol already has coords from local-seed, so this is skipped only if coords already present). `place-selected` fires; on Save, `ev.locationWikidata = "Q23154"` and `ev.locationGeo = {lat:51.4545, lon:-2.5879}` are stored.

2. **Keyboard-navigate and select (accessibility path):** User tabs to `<edot-place-input>`, types a query. Presses ArrowDown — first option gets `aria-selected="true"` and `aria-activedescendant` points to its `id`. Pressing Enter commits the selection; listbox closes (`aria-expanded="false"`).

3. **Use QID in a spreadsheet formula:** Data workspace calls `enableGeo("places/data/seed-places.ndjson")` — NDJSON is fetched, parsed, indexed. User types `=QID("London")` in a cell — formula engine calls `ctx.geo("london")`, returns Place `{wikidataId:"Q84",...}`, result is `"Q84"`. Unknown name returns `#N/A`; `=IFERROR(QID("Nowhere"),"?")` returns `"?"`.

4. **Compute distance between two places:** User types `=GEODISTANCE("London","Edinburgh")` — two `ctx.geo` lookups, haversine formula applied, result rounded to 0.1 km, returns approximately 534.

5. **Build an offline extract with derive-places:** Developer runs `duckdb` to export a bbox-clipped Overture parquet to `overture.geojson`, then: `node derive-places.mjs --in overture.geojson --source overture-places --bbox -2.72,51.41,-2.51,51.50 --gzip --out ../data/overture-bristol.ndjson`. Output: gzipped NDJSON, de-duplicated by QID, ready for the local provider or `loadGeo()`.

---

## Test coverage

| Feature | Covered by (suite::assertion label) | Status |
|---|---|---|
| Wikidata provider: name + QID returned, no coords | `test-places.mjs` :: "wikidata.search returns name + QID" | Pass |
| Local provider: prefix search against seed NDJSON | `test-places.mjs` :: "local.search finds the seed entry with coords + QID" | Pass |
| Local provider: seed row count | `test-places.mjs` :: "local seed parsed all 7 rows" | Pass |
| Merge: same-QID hits collapse to one Place | `test-places.mjs` :: "merge collapses same-QID hits into one" | Pass |
| Merge: fused Place carries QID + coords | `test-places.mjs` :: "merged Place has both QID and coordinates" | Pass |
| Merge: contributing sources recorded | `test-places.mjs` :: "merge records contributing sources" | Pass |
| Rank: exact name match wins | `test-places.mjs` :: "rank puts the exact-name match first" | Pass |
| Facade end-to-end: one fused result | `test-places.mjs` :: "facade returns Edinburgh as one fused Place" | Pass |
| Facade: fused Place has QID + coords from two sources | `test-places.mjs` :: "fused Place carries QID AND coordinates from two sources" | Pass |
| Planned sources (overture/foursquare) not queried | `test-places.mjs` :: "planned sources (overture/foursquare) were not queried" | Pass |
| ARIA: dropdown shows name + QID badge | `test-place-input.mjs` :: "option shows the name and its Wikidata QID" | Pass |
| ARIA: `aria-expanded` true while open | `test-place-input.mjs` :: "combobox reports expanded while open" | Pass |
| ARIA: ArrowDown sets `aria-activedescendant` | `test-place-input.mjs` :: "arrow key sets aria-activedescendant" | Pass |
| `place-selected` event: name + QID | `test-place-input.mjs` :: "place-selected fired with name + QID" | Pass |
| `place-selected` event: coordinates present | `test-place-input.mjs` :: "selected place carries coordinates" | Pass |
| ARIA: listbox collapses after selection | `test-place-input.mjs` :: "listbox collapses after selection" | Pass |
| No browser errors | `test-place-input.mjs` :: "no page errors" | Pass |
| `QID()` / `WIKIDATA()` by name | `test-geo-formula.mjs` :: "QID(\"Bristol\") -> Q23154" / "WIKIDATA by name is the same id" | Pass |
| `PLACEDESC()` lookup by QID string | `test-geo-formula.mjs` :: "lookup works by QID too" | Pass |
| `LAT()` / `LON()` | `test-geo-formula.mjs` :: "LAT(\"London\") ~ 51.5" / "LON(\"London\") ~ -0.13" | Pass |
| `GEOCODE()` returns "lat, lon" string | `test-geo-formula.mjs` :: "GEOCODE returns \"lat, lon\"" | Pass |
| `PLACEKIND()` | `test-geo-formula.mjs` :: "PLACEKIND(\"London\") -> city" | Pass |
| `GEODISTANCE()` haversine | `test-geo-formula.mjs` :: "GEODISTANCE London<->Edinburgh ~ 534 km" | Pass |
| Geo functions compose with other formula functions | `test-geo-formula.mjs` :: "GEO functions compose (ROUND of a distance)" | Pass |
| Cell-ref argument to geo functions | `test-geo-formula.mjs` :: "cell-ref arg works via a fake ctx.cell" | Pass |
| Unknown place → `#N/A` / IFERROR | `test-geo-formula.mjs` :: "unknown place -> #N/A, catchable by IFERROR" | Pass |
| No gazetteer → `#NAME?` | `test-geo-formula.mjs` :: "no gazetteer loaded -> #NAME?" | Pass |
| Geo functions in real workspace (integration) | `test-workspace.mjs` :: "data pane has geo functions (=QID -> Q84)" / "data pane =GEODISTANCE computes (~534 km)" | Pass |
| derive-places: bbox clipping + unnamed drop | `test-derive-places.mjs` :: "clips to bbox and drops the un-named feature (4 of 6)" | Pass |
| derive-places: outside-bbox excluded | `test-derive-places.mjs` :: "Delta Tower (outside bbox) is excluded" | Pass |
| derive-places: Overture `names.primary` → name | `test-derive-places.mjs` :: "Overture names.primary -> name" | Pass |
| derive-places: Overture `categories.primary` → kind | `test-derive-places.mjs` :: "Overture categories.primary -> kind" | Pass |
| derive-places: Overture `sources[].wikidata` → wikidataId | `test-derive-places.mjs` :: "Overture sources[].wikidata -> wikidataId" | Pass |
| derive-places: plain GeoJSON `properties.name` + `.wikidata` | `test-derive-places.mjs` :: "plain GeoJSON properties.name + .wikidata" | Pass |
| derive-places: plain `.category` → kind | `test-derive-places.mjs` :: "plain .category -> kind" | Pass |
| derive-places: missing wikidata → null | `test-derive-places.mjs` :: "missing wikidata -> null (not invented)" | Pass |
| derive-places: non-Point geometry fallback | `test-derive-places.mjs` :: "non-Point geometry falls back to a coordinate" | Pass |
| derive-places: source id propagated | `test-derive-places.mjs` :: "every place carries the source id" | Pass |
| derive-places: QID deduplication | `test-derive-places.mjs` :: "duplicate (same QID) is de-duplicated" | Pass |
| derive-places: coordinate normalization + toNdjson | `test-derive-places.mjs` :: "coordinates are normalized numbers" / "toNdjson emits one parseable Place per line" | Pass |

### Gaps (untested)

- **GeoNames provider** — no test (live or stubbed) of `geonames.js`. The provider is in the registry and catalogue but `test-places.mjs` uses a stubFetch that returns 404 for anything that is not `wbsearchentities`; no test feeds it a GeoNames-shaped response or verifies its field mapping.
- **GeoNames + Wikidata merge path in the browser** — the facade's cross-source merge is tested with two local stub fixtures; the real Wikidata + GeoNames combination in a browser is not exercised.
- **GeoNames `username` missing → silent no-op** — documented in the provider but not asserted in any test.
- **`coordsFor()` error handling** — the `try/catch` in `_select()` that swallows coord-fetch errors is not tested; no test simulates a P625 lookup failure.
- **`<edot-place-input>` Escape key** — the keydown handler has an `Escape` branch but it is not asserted in `test-place-input.mjs`.
- **`<edot-place-input>` ArrowUp** — only ArrowDown is exercised by the test.
- **`<edot-place-input>` `.value` setter before upgrade** — the `_pendingValue` path (set before `connectedCallback`) is not covered.
- **`<edot-place-input>` multi-source progressive paint** — the `onUpdate` streaming callback is invoked in code but no test checks that partial results appear before the full result.
- **`<edot-place-input>` mouse-click selection** — only keyboard selection is tested; the `mousedown` listener path is not covered.
- **Calendar `ev.locationWikidata` / `ev.locationGeo` persistence** — the calendar integration is not exercised by any test in `test-calendar.mjs`.
- **`EdotSheet.loadGeo()` URL path** — the string-URL fetch branch of `loadGeo` is not tested; `test-geo-formula.mjs` uses an in-memory `Map`.
- **`derive-places.mjs` CLI** — the CLI `main()` is only run directly; its `--gzip` output, argument validation, and JSON log line are not tested.
- **Planned sources (overture-places, foursquare-places)** — no extracts exist; the `derive-places` tool is tested against a hand-crafted fixture but never against real Overture or Foursquare data.
- **`LATITUDE` / `LONGITUDE` aliases** — present in FUNCS but not separately asserted (only `LAT`/`LON` are tested).

---

## Known issues

- **GeoNames requires manual configuration** — there is no UI for entering a `username`; it must be passed programmatically via `<edot-place-input>.config = { geonames: { username } }`. A user who does not know to do this gets silent omission of GeoNames results.
- **Cross-origin feeds and coords may be CORS-blocked** — `coordsFor()` hits `www.wikidata.org` directly; in restrictive CSP environments (e.g. a stricter `default-src`) this fetch may fail silently.
- **Local provider early-exit bug** — in `local.js`, the `starts` early-exit (`if (starts.length >= limit) break`) runs before `contains` is populated, so a query that finds `limit` prefix matches will never check any substring matches, even if they would rank higher globally.
- **GeoNames not tested** — the provider is wired into the registry but has zero automated test coverage; field mapping regressions would be silent.
- **`derive-places` polygon centroid is the first ring's first vertex** — for complex polygons this is not a centroid; it may place the extracted point at an unexpected location.
