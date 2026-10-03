# Activity log: Docklands data curation

Newest last. One entry per working session: what changed, commit, measured effect, open items.
Fault ids (F1…) refer to the fault register in [SKILL.md](SKILL.md); check ids (ID-1, SP-6…) to
`../../quality/CATALOGUE.md`.

## 2026-10-02: corridor and Docklands 3D models

- Imported the supplied Canada Water to Surrey Quays 3D study (eb5eaae) and fixed the faults that stopped it
  working: the reserved word `do` used as a name, and a shadowed `cross` (4d44f1f).
- Built the corridor model from open data (12f0090): OSM API `map.json` for the box plus
  `relation/{id}/full.json` for water relations with missing members (the Thames between Rotherhithe and
  Wapping was absent without them); EA LiDAR DTM/DSM 1 m; Wikidata. WGS84 to BNG through OSTN15 (a Helmert
  transform was 1.8 m out).
- Built the Docklands model, London Bridge to Cody Dock (42cbadb onward). Overpass and Geofabrik were
  unreachable; the OSM source is the openstreetmap.fr Greater London extract (OSM data as of 2026-10-01
  01:43 UTC).
- Pipeline faults found and fixed (F10): `simplify()` collapsed closed rings (now split at the farthest
  point); fetch scripts ran their side effects when imported (main guards); the DLR was drawn on station
  roofs because the DSM sees the roof over a viaduct (bridge points more than 20 m above the ground are now
  interpolated: 42 points).
- Feeds catalogue (200 sources), cited facts (360), published levels, live panel, EA flood walls (19036e5,
  897fde6). Wrong links found in our own text and fixed (F11): an FSA search URL and a flood-check link
  that returned 404, a guessed Wikidata id (rule since: never guess ids).

## 2026-10-03: postcodes, events, registry, joins

- Postcodes (2b12097, 748411f, 5cb5bf4): every E14 candidate (4,000) checked against ONSPD August 2026
  (1,905 live, 1,076 terminated, 1,019 never allocated). The ONSPD hosted table times out on LIKE and range
  queries; ids-only then object-id batches of 200 works.
- Events catalogue (124 sources, 24e4bf4). A what's-on page was marked verified although it served an
  Incapsula challenge; corrected (F11).
- Registry (7760e6b, 9475f24): 1,129 buildings with `cwb-` ids; occupants from OSM, FSA, Wikidata (QLever:
  two-step queries, a variable predicate over a radius times out); joins to UPRN, TOID, INSPIRE, Companies
  House, price paid, LBSM. Privacy limits then in force: organisations only, minimum of 5 homes, no company
  addresses, company counts only in residential buildings (486 companies at one flat).
- Chain-store branches (9b22664): 271 branches of 211 brands; CWG directory read from Internet Archive
  copies because canarywharf.com serves a bot challenge.
- Wet areas and museum records (73f0664); riverbed from UKHO bathymetry (2479e3c).

## 2026-10-03: policy and the data register

- Owner policy (9896f41): restrictions on personal, organisation and address data suspended for this
  project during scoping, planning and prototyping; no proprietary or virally licensed data.
- Data register (32c1f09): every committed data file with sources, licences and OSM use. Found: four pages
  showed OSM data without the "© OpenStreetMap contributors" notice (fixed); the postcode page lacked the
  ONS, OS and Royal Mail notices (fixed); the brands README named Geofabrik as the OSM source (F11, fixed).
- Owner: ODbL allowed for now and to be reviewed; keep track of its use. Website crawls (direct, Internet
  Archive, Common Crawl) allowed for scoping (b209725).

## 2026-10-03: atlas

- Atlas page joining every collection (02da9a3).
- F1 found and fixed: One Canada Square's Wikidata record was on both the tower and the Cabot Place mall.
  Rule: an item named by an OSM `wikidata` tag is not attached to a second outline by coordinate. Effect:
  7 buildings changed; buildings with Wikidata 93 → 89; companies matched to a building 5,345 → 6,355.
- F5 fixed for the atlas: LiDAR heights from the 3D model joined to registry outlines (1,079 of 1,129).
- Seen but not patched (owner direction, below): "Boots in The Ivy"; "Unit Unit 14" addresses.

## 2026-10-03: data-quality audit

- Owner direction: catalogue and analyse data-quality and error classes systematically instead of patching
  individual mistakes; this is the basis for the compositing layers.
- `tools/audit-quality.mjs`, `quality/README.md` (analysis and five compositing layers), atlas section
  `#quality`, map layer, quality notes in records (60180d7). 27 checks, 1,564 issues.
- Two first-draft checks were wrong and were corrected before commit: a repeated-word check flagged real
  names ("Tian Tian Market"); a postcode check flagged valid OSM ";" lists. A coverage claim in the draft
  analysis ("no source sees more than 60% of branches") was wrong: OSM sees 79%.
- Pipeline faults found by the audit, catalogued, not fixed: F2 (";" lists: 79 features, 247 postcode links
  lost) and F3 ("Unit Unit": 52 addresses).

## 2026-10-03: mall placement class and this skill

- The "Boots in The Ivy" case traced: OSM Boots (Canada Place, Mall Level -1) placed by proximity (2 m) in
  The Ivy; FSA "Boots the Chemist (4)" (Jubilee Place) inside Northern Trust. Classified as F4 and measured
  with a new check, SP-6: 86 of 181 mall or below-ground occupants are in an outline that is not their mall,
  34 more below ground in a building with no basement record. Audit: 28 checks, 1,684 issues
  (8 high, 818 medium, 858 low); 159 buildings and 44 postcodes with issues.
- `quality/README.md`: new finding "the estate is three-dimensional; the joins are not", and an "occupant
  container" row in the precedence table.
- Skill renamed `cwplans-data` → `docklands-data-curation` at the owner's request, with a fault register
  (F1–F11) and this log.

## 2026-10-03: privacy limits, source survey, data in 3D

- Owner asked to remove the registry privacy limits. The code change was blocked by the environment's safety check ("PII data handling") before anything ran; nothing changed. The planned change list (care-of and address lines, minimum of 5 homes, residential company rule, OSM contact tags, Wikidata people, FSA home-based premises, GOV.UK tribunal decisions, EA owner fields) is reported to the owner, who decides how to proceed.
- Source survey: seven research agents, one per area, 341 new sources (461 of the 541 catalogue entries now verified), 135 recorded exclusions. Merged into `feeds/feeds.json` with an `area` field; tables in `feeds/SURVEY-2026-10-03.md`. Agents fetched every URL; none copied personal details (69 entries flagged `personal_data`, checked by hand). Several sites are blocked by bot challenges (met.police.uk, london.gov.uk, tfl.gov.uk web pages, pla.co.uk, canarywharf.com, Vertus); not bypassed.
- 3D view: the atlas build links 1,188 model buildings to 1,079 registry buildings (`mi`). The 3D page picks buildings off screen, opens their record, draws occupants at their floors, colours buildings by six measures, and shows heritage, quality and live police.uk pins. Tested headless (SwiftShader): 89 distinct buildings picked on a 40 px grid; no page errors.
- Satellite: `tools/build-imagery.mjs` colours the terrain from Sentinel-2 L2A (13 August 2026, 0.01% cloud). Options checked: EA vertical aerial photography is OGL but covers Canary Wharf only in 2007 (40 cm colour) and 2012 (20 cm, night-time); EOX cloudless mosaics after 2016 are CC BY-NC-SA (excluded: share-alike); Capella open SAR of London (CC BY 4.0, 0.33 m, 2024-11-27) stops west of the City; OpenAerialMap has four CC BY drone images at Canada Water and Deptford, none at Canary Wharf; Google photorealistic 3D tiles need a key and limit caching.

## 2026-10-03: underground walking network and routes

- Owner direction: the underground estate (multilevel malls, lifts, stations) must be represented in 3D with shopping, entertainment and routing.
- `tools/build-indoor.mjs` builds the OSM walking network by level (`docklands/data/indoor.js`); the 3D page draws it and finds routes, step-free optionally. First build: the Jubilee platforms were cut off, because OSM platforms are areas that paths do not share nodes with; area hubs fixed it (below-ground points in the main network 152 of 201 → 206 of 207).
- New audit checks NET-1 to NET-4 (fault F12); audit now 32 checks.
- Three research agents collecting estate maps (Internet Archive), station layouts (TfL API, Crossrail papers) and planning drawings: results to be catalogued.

## 2026-10-03: TfL step-free topology and live lifts in routing

- Station agent: TfL publishes step-free station topology (GTFS pathways, 2026-08-03: station points with a level index, lifts with the points they join; no stairs or escalators) and a live lift fault feed (`/Disruptions/Lifts/v2`, CORS open). Today lift LU 2 (ticket hall to Jubilee platforms, Canary Wharf) is out of service.
- `build-indoor.mjs` adds 68 TfL station points, 51 lift links and 29 paths. First version joined TfL points to OSM wherever the level numbers matched; a test route then reached the Jubilee platforms around the faulty lift through a false join (TfL -2 is the Jubilee platforms, OSM -2 the concourse above). Now joined at street level (0) only. New audit check NET-5 (22 of 68 TfL points differ from the nearest OSM level).
- 3D routes skip lifts that TfL reports out of service and list the faults; the network layer draws them red.

## 2026-10-03: ground images, phone layout, rail levels, underground sources

- Ground images (owner: "piece together some imagery to try"): EA survey downloads over the model (tiles TQ3075, TQ3080,
  TQ3575, TQ3580, 2.8 GB, not committed): colour aerial 2008 (40 cm), night-time aerial 2012 (20 cm), LiDAR
  intensity 2020 (1 m). The aerial photos are ECW; built the ECW 3.3 decoder from source and `tools/native/ecw2ppm.c`
  (skill, "Imagery"). `tools/build-aerial.py` mosaics each product to one 2500 × 1866 JPEG at 3 m a pixel
  (0.8 to 1.8 MB) in `docklands/data/tex/`. First build had 1-pixel black seams at tile edges (rounding); fixed by
  integer edges and one pixel of overlap. Source faults recorded, not corrected: the 2008 west tiles are from another
  flight (bluer); no 2008 tile in the north-west corner; the night survey stops near Whitechapel Road.
- 3D page redesigned for phones (owner: "tiny form widgets offscreen below are not practical"): full-screen model,
  search box, depth gauge on the left edge, bottom tabs with a resizable sheet, route ends set by press-and-hold on
  the model or from records, ground-image chips, night mode. Tested headless at 390 × 844 (touch) and 1280 × 800:
  no horizontal scroll, no page errors; press-and-hold at Cabot Square to Waitrose found a 486 m route and reported
  the faulty Jubilee lift.
- Tunnel agent: no public 3D model of a station or tunnel exists (TfL drawings are TfL copyright; Sketchfab CC BY
  items need a login and are trains or one rotunda). TfL FOI-0493-2223 (2022) gives Jubilee rail levels; checked
  against the live CSV. Added as tunnel controls; the Wikipedia and interview depths at Canada Water and North
  Greenwich were 4 m and 6 m deeper (F13; new check AT-5: 2 issues). Rebuilt `area.js` and `cwplans-data.js`.
- Estate agent: CWG estate and mall maps 2003 to 2025 in the Internet Archive (all rights reserved); Living Map runs
  map.canarywharf.com (venue API without key: 9 levels -4 to 2, 8 areas; no licence stated, reference only);
  AccessAble 2022 guides give lift floors and step counts. Catalogues of all four agents (117 sources, 64
  exclusions) committed in `feeds/underground/` with a generated README.
- Data register: textures, the four catalogues, the TfL FOI source, and `data/raw/docklands/tfl-stationdata-gtfs.zip`
  (committed in a1b0dd4 without an entry: found by the check). Audit: 34 checks, 1,686 records (9 high, 819 medium,
  858 low); before: 1,684 (8 high).

## 2026-10-03: F2 and F3 fixed in the parsers

- `tools/osm-values.mjs`: `osmList` (split ";" lists) and `unitLabel` (add "Unit" only to a bare designator), with
  fixture tests (`node --test magpie/cwplans/tools/test/*.test.mjs`: 2 tests, pass). Used by `postcodes.mjs`,
  `build-registry.mjs` and `build-branches.mjs`. `postcodes.mjs osm` reruns the OSM address tally without the
  network steps.
- PL-1 redefined to measure our loss, not the source lists: for each OSM feature with a postcode list, are all its
  postcodes in the registry record that holds it? Before the fix 57 of 59; after 0. PL-2: 52 → 0.
- Effects: registry postcode links 1,050 → 1,146 (the audit's earlier estimate of 247 lost links counted list
  values, many of which the buildings already had from other features); companies matched to a building
  6,355 → 9,787; 299 E14 postcodes gained 312 OSM features (all gains inside the box trace to a list feature).
- SE-1 rose 24 → 36: 12 more residential buildings with 20 or more registered companies, made visible by the
  recovered postcode links (the same class, not new errors). No other count changed.
- Audit: 34 checks, 1,567 records (9 high, 752 medium, 806 low).

## 2026-10-03: drone, splats, glow, Wikidata through QLever

- 3D page: facade shader (window grid, night lights, aerial roofs), glow outlines by occupant kind, free camera and
  capture mode, Gaussian splats synthesised from the model (`tools/build-splats.mjs`, 669,306 splats) with depth
  compositing. Two subagents: drone flight and capture, CPU 3DGS training.
- `tools/build-categories.mjs`: occupant kinds from stated classes only. First version fetched Wikidata classes with
  wbgetentities and hit "too many requests". Owner: pace ourselves, or one well-posed query; QLever. Now
  `tools/lib.mjs` `qlever()` (one call at a time, 1.5 s apart, backoff on 429/5xx) and two queries in total, which
  also fetch the P580/P582 qualifiers and P576 dissolution of every occupant link (F8, partly fixed).
- Effect: of 34 Wikidata occupant links 4 are current, 6 former (FCA left 25 North Colonnade in 2018; FSA, NYSE
  Euronext Liffe, Allianz Trade at One Canada Square; Banc of America Securities at 5 Canada Square), 24 undated.
  Finance glow 18 → 17 buildings. TM-4 34 → 30 issues (6 medium, 24 low). Audit 1,563 records.

## 2026-10-03: provenance manifest; level parsing (VA-2)

- Owner: selected sources will go through a data integration pipeline into a knowledge graph; record sources and
  transforms with that in mind. Added `pipeline.json` (one PROV activity a tool: used, generated, rules, network,
  deterministic, after; drafted by a subagent from the code), its checks in `tools/check-data-register.mjs`, and the
  export `pipeline.jsonld` (PROV-O, DCAT, Dublin Core). Policy line "knowledge_graph" in `data-register.json`.
- Level parsing: one parser for OSM levels in `tools/osm-values.mjs` (`osmLevels`: ";" and "," lists, ranges
  expanded, fractions), with fixture tests; used by `build-indoor.mjs`, `build-docklands.mjs` (its own parser kept
  only the ends of a range) and `build-registry.mjs` (occupants now carry `levels` next to the raw `level`).
- VA-2 redefined as values our parser cannot read: 100 → 0 (86 ";" lists, 11 comma lists, 2 fractions, 1 range, all
  read). No other count changed. Audit: 1,463 records (9 high, 758 medium, 696 low).

## Open, in the order proposed

1. (Done: F2, F3, VA-2.)
2. F4: mall containers (CWG mall, OSM indoor areas) with levels; place mall occupants by mall.
3. F7: precision class and relation type on every position; no building placement from postcode centres.
4. Link records (method, distance, confidence) in the registry.
5. F9: per-mall level offset table.
6. F8: done for occupant links (QLever qualifiers); still to do: drop or mark former occupants in the registry itself, and company status dates.
7. Re-crawl the CWG directory and expire entries not seen.
8. Privacy limits: the owner approved removal (2026-10-03); the change was blocked by the environment's safety check. Waiting on the owner.
9. 3D: time slider from the EA DSM series (1999 to 2022, all fetched by the same survey API) with Wikidata inception and Tower Hamlets planning completions; live trains from TfL arrivals; Overture building heights where OSM has none. (Night texture: done.)
10. Mall levels: compare the Living Map venue levels (-4, -3, -2, -1, -1M, 0, M, 1, 2) and the AccessAble lift floors with OSM and CWG levels, as input to the F9 offset table.
11. Tunnel controls still unused: Blackwall Tunnel inverts (desk study), Silvertown Tunnel road levels (DCO sections), the Crossrail long section (digitised, licence not stated: ask the owner before committing).
