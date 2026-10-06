---
name: cwplans-kgx
description: >-
  The cwplans knowledge graph in danbri/londat kgx/ and its public search page: how build-kgx.mjs turns the core
  Canary Wharf data (cited facts, registry buildings with outlines, occupants, the typed CWG directory and hours, the
  canonical web layer, sameAs groups, Living Map mall units, the OCR'd store guide) into one named graph per source
  with a meta graph; the IRIs and vocabulary; the four copies (N-Quads, Shardborough, COTTAS, HDT) and what each is
  good for, measured; @factoidal/core persistent storage (pack, activate, store handles, the per-query caps, the Lean
  engine in a browser worker with a fetch host); and the page magpie/cwplans/kg/ (Web Worker, ServiceWorker, views,
  SPARQL editor). Reach for it before you add a graph, change an IRI, query the store, choose a store format, or
  change the search page.
---

# The cwplans knowledge graph (kgx)

Owner, 2026-10-06: "Make londat tld folder kgx and explore state of npm js Factoidal/core for persistent storage.
Build out a first cut at a persistent knowledge graph for core data we have collected, beginning with Canary Wharf
facts. Also keep nquads copies in filetree alongside hdt or shardborough formats if they work. Make a public search
page that uses ServiceWorker and sparql to cache some/all of this an expose useful queries and views of the data."

- Data: https://github.com/danbri/londat/tree/main/kgx (README, `manifest.json`).
- Page: https://danbri.github.io/glitchcan-minigam/magpie/cwplans/kg/ (`kg/index.html`, `kg/worker.js`, `kg/sw.js`).
- Build: `node magpie/cwplans/tools/build-kgx.mjs` (all RDF work with @factoidal/core); add
  `HDT_LIB=<dir of hdt-java-cli jars>` for the HDT copy; `--no-store` skips Shardborough. Commit the output in londat.
  Policy, register and activity log: the hub skill `docklands-data-curation`.

## Graphs, IRIs, vocabulary

- Base `https://danbri.github.io/londat/kgx/`: things `id/…`, graphs `graph/<name>`, vocabulary `vocab#` (prefix `cwk:`),
  schema.org first. No blank nodes anywhere (two Factoidal faults touch blank nodes; see `cwplans-web-harvest`,
  "Factoidal notes").
- One named graph per source, few and large (the store's caps count blocks; a block is one predicate in one graph):
  `facts` (docklands/facts.json: `cwk:CitedFact` about a Wikidata item, property, value, unit, citation, short quote),
  `buildings` (cwb- ids, name, position, levels, height, postcodes, OSM and Wikidata links, `geo:asWKT` outline),
  `occupants` (role, level, mall, `s:openingHours` in OSM syntax, `s:containedInPlace` building, `s:sameAs` OSM and CWG),
  `cwg` (the typed CWG directory plus `s:OpeningHoursSpecification` per day with `cwk:opensMinute`/`cwk:closesMinute`,
  malls as `s:ShoppingCenter`), `web` (canonical schema.org layer, pages merged), `coref-<rule>` (owl:sameAs by key rule),
  `mallmap` (Living Map units `cwk:MallUnit` with outline, and `cwk:Facility` points: lifts, escalators, ramps, stairs,
  entrances, toilets, defibrillators; mall, floor, opening text, centre; from the normalised GeoJSON in londat
  `third_party/cwg/_TMI/mallmap`, whole outlines),
  `storeguide` (`cwk:GuideEntry`: name, section, `cwk:gridRef` like "10C", OCR text and confidence, `s:sameAs` CWG
  entity when matched), `meta` (`void:Dataset` per graph: title, sources, licence, OSM rights, triple count).
- Joins across sources go through `s:sameAs` to the CWG entity IRI (`https://canarywharf.com/<kind>/<slug>/#entity`),
  OSM element URLs and Wikidata items. Mall units join by exact name only, for now.
- A pattern that spans two graphs needs two `GRAPH` blocks (`GRAPH ?g1 {…} GRAPH ?g2 {…}`); one block returns nothing.

## The four copies, measured 2026-10-06 (70k to 88k quads, this container)

Build of 2026-10-06: 87,512 quads in 13 graphs (12 plus `meta`), Shardborough generation `gen-20261006-854bbbff`.

| format | where | size | what it is good for |
|---|---|---|---|
| N-Quads, gzip | `nq/<graph>.nq.gz`, `nq/all.nq.gz` | 0.8 MB all | the reference copy; diffable; any RDF tool |
| Shardborough | `shardborough/` (CURRENT + `gen-<date>-<hash>/`) | 11 MB, 137 blocks + sidecars | queries: 0.4 to 1.5 s in Node and in the browser page |
| COTTAS | `cottas/<graph>.cottas`, `all.cottas` | 3.1 MB all | portable bytes; opens in the browser entry; queries slow (below) |
| HDT | `hdt/<graph>.hdt` (triples, one file per graph) | about 1 MB | exchange with HDT tools; Factoidal reads it very slowly |

- **Shardborough** (`factoidal pack INPUT ROOT/GEN --layout ibk4`, `factoidal activate ROOT GEN`; 14 s for 70k quads)
  is the store to use. The JS command packs since 0.7.x although the README still says `pack` exits 3: trust the
  CHANGELOG. Every artifact is SHA-256 verified. Caps per query: 64 artifacts, 8,388,608 bytes, 100,000 rows. A
  pattern with a variable predicate needs every block (137) and is refused; write the predicates out as a UNION of
  constant-predicate patterns, which the planner maps onto just their blocks (3 predicates: 14 blocks).
- **COTTAS**: `toCottas` given an N-Quads **string** writes an empty store (73 bytes) with no error; given a parsed
  `Dataset` it keeps every quad. The same views took 40 to 280 s through `queryCottas` against about 1 s in Shardborough;
  every extra triple pattern multiplies the time (one view 43 s, the same with two patterns fewer 12 s). Splitting into
  per-graph files did not help (43 s against 47 s).
- **HDT**: written with `rdf2hdt` from hdt-java-cli 3.0.10 (Maven Central; pip `rdflib-hdt` did not build). Factoidal
  `queryHdt` answers correctly but took 22 s for a COUNT on 3,452 triples and 470 to 690 s on the larger graphs.
- `tools/check-factoidal.mjs` re-tests these faults after an upgrade.

## The search page (`kg/`)

- `worker.js` (module Web Worker) imports the Lean engine `l4-assets/l4factoidal.js` from jsDelivr, pinned
  (`@factoidal/core@0.7.1`); its Emscripten loader finds the 5.9 MB wasm by `locateFile`. It repeats bin/store.mjs with
  `fetch()` as the host: read `shardborough/CURRENT` and the manifest, `storeManifestInspect`, then per query
  `storeQueryPlan` (names the blocks), fetch only those blocks, `callBlobIO('storeQuery', …)` gives SPARQL JSON results.
  The entity view batches predicates under the caps (60 blocks, 7.5 MB a batch), out-links and in-links.
- `sw.js`: engine files and `shardborough/gen-*/` files cache first (a generation never changes); CURRENT, the
  manifest and the page network first. The page tells the service worker which generation to keep.
- Measured headless (SwiftShader Chromium, local server): first load 4.7 s, a view 0.4 to 2.5 s, name search 0.6 s,
  the first entity view 8.8 s (it fetches the whole store once), a second visit 0.45 s from the cache, no errors.
- Data base: `?base=` overrides the default `https://raw.githubusercontent.com/danbri/londat/main/kgx/` (sends
  `Access-Control-Allow-Origin: *`). Test locally with `python3 -m http.server` at the folder above both checkouts and
  `?base=/londat/kgx/`.
- Views are SPARQL in the page (`VIEWS`); the editor adds the prefixes. "Open now" ignores hours that run past
  midnight from the day before.

## Open

- Step-free routes: the facilities are in (view "Step-free"); the corridors (indoor lines) and floor links are not yet.
- Units: join to CWG entities by a better key than the exact name (normalised name, mall, level).
- A building-level link from mall units and guide grid squares to registry buildings (position in the outline).
- Turn on GitHub Pages for londat and point the page at it (same origin as the site's host family).
