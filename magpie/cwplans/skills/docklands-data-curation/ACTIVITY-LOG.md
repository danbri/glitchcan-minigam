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

## 2026-10-03: skyline by year; provenance manifest checked

- `tools/fetch-dsm.sh` and `tools/build-skyline.mjs`: EA LiDAR DSM tiles 1999 to 2022 over the estate (16 ZIPs,
  1 GB, local), heights of 2,389 model buildings per survey, with flight dates; `docklands/data/skyline.json`
  (85 kB) and a year slider with play in the 3D page. Faults found and handled: the 2012 1 m request for TQ3580
  returns a server error (only 0.5 m exists); the 2015 survey did not fly the estate (tile 99% empty), so years that
  fly under 20% of the buildings are left out and listed; a cleared site with hoardings measured 5 to 8 m and showed
  future towers as low blocks, so "standing" now needs a quarter of today's height. Buildings a survey did not fly
  are drawn in slate blue at today's height.
- Checked against known dates: 8 Canada Square absent 1999, 209 m from 2007; Landmark Pinnacle 87 m (2018) then
  234 m; Newfoundland 160 m (2018) then 218 m.
- `pipeline.json` (57 activities + fetch-dsm, 5 libraries, 2 tests) committed; its 11 header mismatches corrected
  in the tools, which now point to their activity; 9 source keys added to the register (OSTN15 grid, PLA and CRT
  ArcGIS, VOA, GOV.UK search, Wikipedia search, FSA API, EA DSM history, feed providers); register entries that
  disagreed with the code corrected (postcodes/queries.json sources, hand-made museum and UKHO files).

## 2026-10-03: pixel art, declutter, towers, trees, facades, trained splats

- Pixel-art style: zoomed out, one art pixel per CSS pixel and no windows or outlines (no speckle); district colours;
  water 1.2 m above its level. A variable used before its declaration stopped the page from loading; the headless
  load test found it before the push.
- Declutter (owner: "The city is the star not our endless word buttons"): a menu button opens a left drawer with the
  views, Layers, Route and About (help text there); the record is a card at the bottom; labels are plain text.
- Towers: 27 towers fitted from the LiDAR (roof RMSE 0.8 to 3.7 m) drawn as tiers; One Canada Square's pyramid.
- Trees: 81,875 trees and 15,708 green areas from open sources; real trees in pixel art and under Show > Trees.
- Facades: facts for 31 towers, 56 open photos with attribution; not yet used by the shader.
- Splats: first trained set (OpenSplat, CPU, 3,000 steps), 167,073 splats after the crop, in the splat set menu.
- Register: a check failure was committed once because the check output went through `tail`, which hid its exit
  status; fixed in the next commit. Run the check on its own and read its exit code.

## 2026-10-03: gestures, music, pixel materials, photo facades

- Two-finger twist turns the view in both styles; pixel art tilts with two fingers. Pinches that started on a label
  did nothing before; fixed.
- Music: starts inside the tap; a now-playing bar with stop; the own-file button opens the phone's picker.
- Pixel art: materials instead of a height ramp; measured facade colours on the towers.
- Photo facades: 16 tower tiles from CC BY photos (atlas 243 kB), credited in About.

## 2026-10-03: CWG directory joined into the registry; OSM contact tags kept; six new categories

- `fetch-cwg.mjs` parse faults (F14) fixed with `registry/sources/brands/tools/cwg-fields.mjs` and fixture tests
  (`tools/test/cwg-fields.test.mjs`); re-run from the cached archive pages (no new fetch except 2 failed retries for
  pages that were never archived). Categories now on 339 of 374 entries (was 0); 4 wrong levels, 1 wrong mall, 5
  missing malls, 3 missing E22 postcodes corrected. `build-branches.mjs` re-run: 271 branches, no change.
- `registry-osm.mjs` keeps business phone, email, website and contact:* (F15); same 12,793 features. Occupants now
  carry opening_hours, cuisine, wheelchair, check_date, start_date, opening_date, operator, url, website, phone,
  email, contact links. Buildings keep addr:housename.
- `build-registry.mjs` CWG join (F16). Entries: 148 linked by the branch join (before and after), 82 joined by name and
  place (23 same mall, 32 same street or square, 12 shared postcode, 15 same building), 106 added as new occupants (19
  street address, 79 mall host outline, 8 by postcode; confidence 17 high, 81 medium, 8 low), 38 unplaced. Linked to
  an occupant: 148 → 336 of 374. Occupants 1,161 → 1,267. Mall hosts derived from OSM name or addr:housename: Cabot
  Place cwb-0411, Canada Place cwb-0466, Jubilee Place cwb-0586, Crossrail Place cwb-0358, One Canada Square cwb-0413,
  The Park Pavilion cwb-0460, West Wintergarden cwb-0584; Churchill Place has none (2 entries placed by the one retail
  building of E14 5RB, low).
- Unplaced classes (CV-3): street address on no registry building 13 (mostly Wood Wharf), car park 5, no archived page
  5, page with no address 4, estate-wide 3, postcode names several buildings and no address 3, postcode on no building
  2, E22 postcode and no address 1, no postcode and a street place 1, two OSM records in two buildings 1 (Vertus Edit,
  "3 & 15 West Lane"). Also: 6 entries join OSM and FSA records that sit in different buildings (F4/F7 evidence);
  "London Museum Docklands" does not join the museum's old name.
- `build-categories.mjs`: bar, alcohol, education, health, sport, arts from stated classes (OSM, FSA type, Wikidata
  P31, CWG section and single-class CWG labels; "Sport & Fitness" and the vet in "Healthcare" left out after reading
  the examples). Totals (buildings/occupants): finance 17/28 → 18/30, shop 79/225 → 81/256, catering 144/505 →
  145/540, leisure 28/31 → 28/32, entertainment 6/7 → 6/7; new: bar 28/42, alcohol 3/3, education 20/24, health
  29/38, sport 19/29, arts 5/6. The 3D page glows only the first five (its list is in docklands/index.html).
- `tools/scan-model-pois.mjs` → `registry/model-box-pois.json`: OSM POIs of the six classes in the whole model box
  (total / in the registry / in the registry box but not in it / outside the registry box): bar 569/29/0/540, alcohol
  51/4/0/47, education 303/19/3/281, health 336/35/2/299, sport 817/31/22/764, arts 97/7/1/89. In the registry box the
  28 missing are 21 unnamed (the registry takes named features only) and 7 named (Boots node/4558839860, South Quay
  College, Poplar Bowls Club and others) that lie more than 12 m from any outline.
- Audit 34 checks / 1,463 issues → 36 / 1,481. New CV-3 (38) and SP-7 (8 low-confidence placements). CV-2 (CWG-only
  entries) 205 → 162. SP-2 now leaves out key placements (173, unchanged). SP-6 reads addr:housename as a mall name:
  issues 120 → 119 with population 181 → 304 (CWG malls now on 123 more occupants). Rises from new evidence, not
  new faults: AT-3 46 → 59 (more OSM/CWG level pairs, F9), ID-2 83 → 84 (Third Space has two CWG pages), ID-3 20 → 22
  (CWG entries named after their building). Tests: 8 of 8 pass.
- Register: entries updated for buildings.json, categories.json, cwg-directory.json, issues.json; new
  model-box-pois.json; pipeline.json: fetch-cwg, registry-osm, build-registry, build-categories, audit-quality
  updated, scan-model-pois added, cwg-fields.mjs as a library, its test. The register check still fails on two tools
  of the parallel sessions (tools/crawl-sites.mjs, tools/fetch-registers.mjs: not in pipeline.json).

## 2026-10-03: regulatory and public registers

- New tool `tools/fetch-registers.mjs` (polite per-host queue, >= 1 s, backoff on 429/5xx). Output
  `registry/sources/registers/<source>.json` ({meta, records}) and README.md; raw in `data/raw/registers/`
  (gitignored). Entries for data-register.json and pipeline.json are in `registry/sources/registers/register-entries.json`
  for the main session to merge (not merged by this agent). Not committed by this agent.
- Kept per source (in the box / E14): GIAS 23 / 63 (OGL); CQC directory 47 / 84 (OGL); NHS ODS 258 / 422 (OGL);
  Charity Commission 131 / 316 (OGL); Ofsted childcare on non-domestic premises 16 / 45 (OGL); Gambling Commission
  premises 8 / 14 (OGL per data.gov.uk record only); Sport England Active Places 13 / 37 sites, 103 facilities
  (CC BY 4.0); FSA Pub/bar/nightclub 17 / 37 (OGL, from the FHRS snapshot).
- Catalogued, not patched: 16 GIAS "Fieldwork Overseas Establishments" (schools abroad) use 30 Skylines Village,
  E14 9TS as a correspondence address (`address_role`); 82 ODS records in the box sit at E14 5HU, the
  registered-office service at 5 Churchill Place (class of SE-1); charity contact addresses are not premises.
- Not reached: Tower Hamlets premises licence register (alcohol-entertainment.towerhamlets.gov.uk: TLS handshake
  failure, HTTP 503; only the start page in the Internet Archive). Rejected: PRA lists (Bank of England terms:
  non-commercial internal use); FCA register and NHS service search (keys, terms unread); OfS register (refused
  this client).

## 2026-10-03: website crawl

- Website crawl, tools/crawl-sites.mjs (new). 859 URLs on 393 hosts from buildings.json occupants, branches.json, storelocator.json and cwg-directory.json (FSA, OSM, Wikidata, Wikipedia, Companies House and Land Registry links skipped by rule). 737 pages read (369 CWG pages as Internet Archive copies reused from fetch-cwg.mjs, 368 direct); 122 not read (bot challenge 59, 404/410 18, 401/403 15, TLS 10, timeout 7, DNS 4, robots.txt 4, 429 2, connection 2, 5xx 1). Direct pages: JSON-LD 246, opening hours 61, schema.org telephone 77, names the branch 154 (235 are home pages). 61 new feed URLs (registry/sources/web/discovered-feeds.json), not yet verified. Out: registry/sources/web/site-facts.json, discovered-feeds.json, README.md. Open: merge register-entries.json into data-register.json and pipeline.json; verify the feeds; script-rendered store pages give no facts without a browser.

## 2026-10-03: regulatory and public registers joined into the registry

- `build-registry.mjs`: the registers in `registry/sources/registers/` (GIAS, CQC, ODS, charities, Ofsted childcare,
  gambling, Active Places, FSA pubs) join occupants with a link per record (`occupant.registers[]`: register, id,
  kind, status, key, precision, confidence) and the source ids on the occupant. Keys: UPRN, register point, named mall
  (F4), street address with postcode, street address alone, name at the same postcode, postcode alone (guarded, F19).
  Occupants 1,267 → 1,486.
- Per register (placed / joined an existing occupant / added / unplaced in the box / outside the box or not a place):
  GIAS 7 / 3 / 4 / 1 / 39 outside + 16 correspondence; Active Places 12 / 3 / 9 / 3 / 22; ODS 157 / 36 / 121 / 26 / 153
  + 86 not places; CQC 40 / 27 / 13 / 9 / 35; Ofsted childcare 13 / 3 / 10 / 3 / 29; gambling 6 / 0 / 6 / 2 / 6;
  charities 58 / 3 / 55 / 46 / 179 + 33 not places; FSA pubs 16 / 15 / 1 / 2 / 19.
- New faults F17 (shared UPRN), F18 (addresses that are not places), F19 (postcode alone), F20 (provider and site
  pairs). Categories: education 20/24 → 26/38, health 29/38 → 44/79, sport 19/29 → 22/35, bar 28/42 → 28/43, shop
  81/256 → 83/262 (betting shops), new charity 26/58; others unchanged.
- Audit 36 checks / 1,481 issues → 39 / 1,750: new CV-4 (92 in the box with no building), ID-5 (9), SE-3 (135);
  SP-7 8 → 30 low-confidence key placements (population 325); ID-2 84 → 89 (F20); ID-3 22 → 25; SP-6 119 → 122. Tests
  8 of 8. Register check exit 0.

## 2026-10-03: structured data from rendered pages, store finders, Factoidal

- New tools: `tools/render-structured-data.mjs` (headless Chromium render of every entity URL, robots.txt per
  navigation, 3 pages at once, one per host, 2 s gap; store-finder searches with the branch postcode, owner rule of
  2026-10-03), `tools/structured-dom.mjs` (in-page JSON-LD / microdata / RDFa extractor), `tools/jsonld-clean.mjs`
  (repairs by class; tests `tools/test/jsonld-clean.test.mjs`, 7 of 7), `tools/extract-structured-data.mjs`
  (Factoidal: JSON-LD to RDF, named graph per page, SPARQL). `@factoidal/core` ^0.7.1 added to the root
  devDependencies. Not committed by this session; register and pipeline entries are in
  `registry/sources/web/structured-register-entries.json` for the main session to merge.
- URLs: 1,025 (559 hosts) from buildings.json occupants (website, cwg_website, store_url), branches.json,
  storelocator.json, cwg-directory.json and 171 registered-charity websites; 369 are Internet Archive CWG copies read
  from cache. Rendered 901 of 1,067 attempts (including 42 store-finder result pages); failures: bot challenge 63,
  dns 33, 404/410 21, 401/403 11, tls 10, timeout 8, HTTP error 6, 5xx 4, connection 3, robots disallowed 2,
  robots.txt 5xx 3, 429 2.
- Pages with JSON-LD 695, microdata 72, RDFa 798 (schema.org RDFa 1); only after scripts: JSON-LD 22 pages,
  microdata 4, RDFa 5. Store finders: 247 searches for 201 brands; 29 branch pages that name the branch.
- `structured-facts.json`: 232 records for 210 entity keys; opening hours for 109 keys at branch scope (95 high
  confidence), 5 chain, 7 organisation; telephone 126 branch; events on 2 keys (12 events). Every OSM opening_hours
  string parses. No audit counts changed (the registry is not yet joined to these facts).
- Open: join structured-facts.json into the registry and the atlas (hours, phone) with its confidence; a check
  for hours that disagree with OSM `opening_hours`; all.nq is 12 MB (gzip it, or keep only schema.org quads, if the
  repository size matters); store finders still fail for 100 brands with no finder link and 50 with no postcode box.

## 2026-10-03: methods audit and METHODS.md

Owner instruction, 2026-10-03: "record ALL our data methods in skills or other concrete committed artifacts".

- Audit of every tool against its `pipeline.json` activity (75 activities, read from the code). Gaps found, by class:
  politeness not stated or incomplete (27 activities: User-Agent, pauses, retries, timeouts, concurrency); cache or
  re-fetch behaviour not stated (19); units, coordinates or rounding not stated (15); no known-fault (F-number)
  links on any activity; hand
  judgement not marked (20 tools); hand steps with no activity (13: sourced levels, facts.json, the underground and
  feeds catalogues, FSA/CWG decisions, store-locator URLs, records-open subset, UKHO wrecks clip, facade photos and
  regions, palette and music, licence decisions, provenance upkeep, quality analysis); out of date (7: build-skyline
  named `data/raw/dsm/fetch.sh` and listed one input twice; four notes about register errors already fixed; the
  register gave `postcodes.mjs fetch` as producer of `postcodes/canary-wharf-ward.geojson` (the build mode writes
  it); the skill said 34 audit checks in eight classes (39 in nine); the `match-osm.mjs` header said the NSI match is at
  One Canada Square (it is at the feature's position)); vague method (2: match-osm, fetch-raw-lidar); one script not
  listed (`tools/native/ecw2ppm.c`).
- `pipeline.json`: new `areas` (22 subject areas), `area` on every activity, `faults` (F-numbers) on 19 activities,
  `judgement` on 20, rules added from the code, `manual_activities` (13 hand steps; `gap` names 4 one-off scripts
  that are not committed), `tools/native/ecw2ppm.c` as a library.
- `tools/check-data-register.mjs`: fails on an empty method or rules, an unknown area, a fault id not in the fault
  register; lists `tools/native`, `tools/test`, `registry/sources/*/*` and `feeds/*` scripts; `--write` also writes
  `METHODS.md` (from `methods-intro.md`, `pipeline.json`, the fault table in SKILL.md and `quality/issues.json`) and
  exports hand steps, areas, faults and judgement to `pipeline.jsonld`.
- New: `methods-intro.md` (hand-written policy and owner rules, crawl and hand-curation rules), `METHODS.md`
  (generated), both registered. SKILL.md: "Methods" section; audit count corrected.
- Check: `check-data-register.mjs --write` exit 0; `node --test tools/test/*.test.mjs` 15 of 15. Not committed by
  this session.
- Found, not fixed (code): `registry-wikidata.mjs` calls QLever with no pause and no retry (it does not use
  `tools/lib.mjs` `qlever()`); `fetch-dsm.sh` does not send the project User-Agent; `check-feeds.mjs` and
  `check-events.mjs` run 6 requests at once with no per-host gap.
  Fixed the same day (main session): `registry-wikidata.mjs` now uses `lib.mjs` `qlever()` (output unchanged: 288
  items, 3 memorials dropped, 17 headquarters); `fetch-dsm.sh` sends the project User-Agent; the two feed checkers
  send at most one request at a time to a host, 1 s apart.

## 2026-10-04: skills split ("Wrap it all up into skills")

Owner instruction, 2026-10-04: "Wrap it all up into skills". Three new skills, each checked against the code:
- `docklands/skills/docklands-3d-page/` (the 3D page: programs, vertex formats, interface, styles, splats, Night, fp16,
  testing, shipping); `skills/cwplans-web-harvest/` (crawl, render, store finders, JSON-LD repair, Factoidal, scopes,
  join-web-facts, opening hours, proxy CA); `skills/cwplans-public-registers/` (licences, fields dropped, join keys,
  F17 to F20, rejected sources). Symlinked in `.claude/skills/`; `npm run skills:check`: 23 of 23 discoverable, 0
  problems. Rows added to the skills table in the repo `CLAUDE.md`.
- This skill slimmed from 331 to 264 lines: "Page rendering lessons", "Splats and drone frames" and "Structured data
  from rendered pages" moved out (headings kept as pointers, because tool headers name them); the Wikidata / QLever
  lesson has its own section; `join-web-facts.mjs` added to the rebuild order; a skill index with the pending sky,
  time, weather and tide skill (another agent is building that code). Every removed line was checked against the new
  skills.
- `tools/check-data-register.mjs`: `skills/` directories are skipped at any depth (`docklands/skills/` was counted as
  an unregistered data file). Fault table unchanged, METHODS.md not regenerated.
- Measured while verifying (headless SwiftShader, `?view=rotherhithe`, working tree with the sky agent's uncommitted
  sky.js): no page errors at 1600 x 900 DPR 1 and 390 x 844 DPR 3 (canvas 780 x 1688: DPR is capped at 2);
  `NIGHT.n` 84 roofs, 587 red lights, 1,449 lamps, 160 columns, 1,769 reflections, 12 signs; `renderNow()` returns in
  2 ms and the frame is drawn in the next `readPixels` (about 2.2 s at 1600 x 900); the fp16 emulation in Node gives 0
  for 3,554 of 3,600 window cells; `opening-hours.js` reads all 156 distinct opening_hours strings in the registry;
  `node --test tools/test/*.test.mjs` 15 of 15.
- Stale statements found: README "Isometric pixel art" says one art pixel per 3 screen pixels (the code uses 2 CSS px,
  1 when zoomed out); README "Night" says the photos are not in the repo (they are in `docklands/reference/night-2026-10-03/`
  since 2d76be0); the atlas tile host answered curl through the proxy on 2026-10-04. README not edited (another agent's
  file today).

## 2026-10-04 sky, time, weather and tide (sky agent)

- Added `docklands/sky.js` (Menu > Sky, `?t=`, `?t=photo`): page clock; astronomy-engine 2.1.19 (MIT) sun, moon phase and
  limb, planets, Jupiter's moons, rise/set, twilight; Bright Star Catalogue stars (public domain) with a London star limit;
  d3-celestial constellation lines (BSD-3); a computed Milky Way band (Vieira outlines refused: no licence); CelesTrak
  satellites with satellite.js 7.1.0 (MIT; CelesTrak states no licence, marked for review); Open-Meteo cloud and haze
  (CC BY 4.0); EA tide readings interpolated along the Thames to the viewpoint (OGL), drawn through `setTidal`. Replaced
  the old moon code in `index.html` with small hooks. Commits 7025728, 956f3e0.
- Tool `tools/fetch-sky.mjs` (pipeline activity `fetch-sky`, new area "sky"); snapshots `docklands/data/sky/` for
  3 October 2026; five sources and six files added to `data-register.json`; check exits 0 (142 registered).
- Photo time solved from the moon: 3 October 2026 23:56 BST, about ±4 min (method and table in
  `docklands/reference/night-2026-10-03/README.md`). Weather then 15% low cloud, 14 km; Thames −1.20 m OD, falling.
- README "Sky, time, weather and tide" added; the two stale README lines fixed. Skill `docklands-sky` written.
- Open: One Canada Square's model apex projects about 0.9° above the photo's apex in both photos (cause not found);
  no tide predictions (no open source); CelesTrak licence to review before prototyping ends.

## 2026-10-04 permits, works, closures and what's on (works agent)

- Owner: "look into local authority permissioning for events, street closures, markets and events across entire zone"
  and "get tfl and road/bus/train planned works". New tool `tools/fetch-works.mjs` (activity `fetch-works`), snapshots
  in `feeds/works/` (one per source, `{meta, items}`) and `works.json` (1,552 items), page
  https://danbri.github.io/glitchcan-minigam/magpie/cwplans/feeds/whatson.html, skill `cwplans-permits-and-works`.
- Zone: the model box plus a Royal Docks margin (0.015 to 0.085 E). Items: TfL lines 29, TfL buses 53, TfL roads 59
  (9 planned events), Street Manager permits 1,035 open of 3,909 in the zone (September archive) and activities 44,
  Gazette 72 (16 TTROs), Tower Hamlets licence notices 11 (8 TENs), planning 18, markets 28, venue events 203.
- Owner feedback on the first page: "looks like all roads and busses" (85% Street Manager). Page split into "What's on"
  (default, 284 items) and "Closures and works" (rail first, buses, road closures and works grouped by street); venue
  programmes harvested from every verified event feed in `feeds/events.json` at run time.
- Traps met (in the skill): TfL affected stops have lat/lon 0 (NaPTAN 910/930/940 used); the Gazette geo point is the
  publisher's office and each notice names the council's own office postcode (removed before reading districts);
  Gazette robots.txt Crawl-delay 10 (one disallowed `data.jsonld` was fetched by mistake while probing); "press" matched
  "WordPress"; Royal Docks Atom mixes articles with events.
- Not reached or rejected: Tower Hamlets eLR register (TLS reset again); other boroughs' Idox licensing registers (forms:
  owner decision needed); NRE and Network Rail feeds (accounts); Street Manager live (SNS endpoint); Internet Archive
  (proxy drops).
- 10 new event sources added to `feeds/events.json` and an `EVENTS.md` section.

## Open, in the order proposed

1. (Done: F2, F3, VA-2.)
2. F4: mall containers (CWG mall, OSM indoor areas) with levels; place mall occupants by mall.
3. F7: precision class and relation type on every position; no building placement from postcode centres.
4. Link records (method, distance, confidence) in the registry.
5. F9: per-mall level offset table.
6. F8: done for occupant links (QLever qualifiers); still to do: drop or mark former occupants in the registry itself, and company status dates.
7. Re-crawl the CWG directory and expire entries not seen.
8. Privacy limits: the owner approved removal (2026-10-03); the change was blocked by the environment's safety check. Waiting on the owner.
9. 3D: (skyline slider from the EA DSM series: done) add Wikidata inception and Tower Hamlets planning completions to it; live trains from TfL arrivals; Overture building heights where OSM has none. (Night texture: done.)
10. Mall levels: compare the Living Map venue levels (-4, -3, -2, -1, -1M, 0, M, 1, 2) and the AccessAble lift floors with OSM and CWG levels, as input to the F9 offset table.
11. Tunnel controls still unused: Blackwall Tunnel inverts (desk study), Silvertown Tunnel road levels (DCO sections), the Crossrail long section (digitised, licence not stated: ask the owner before committing).
12. CWG join leftovers: a mall container for Churchill Place (no outline names it); Wood Wharf outlines without
    addresses (13 street addresses match nothing); a postcode-to-building table; rename aliases (Museum of London
    Docklands); show bar, alcohol, education, health, sport, arts in the 3D glow menu.
13. Registers: a postcode-to-building table from OS Open UPRN (29 records wait on "postcode covers several buildings");
    merge ODS provider and site pairs (F20); CQC "HSCA Active Locations" columns for coordinates.
14. Methods: commit the one-off scripts named in `pipeline.json` `manual_activities` `gap` (facts.json quote check and
    FACTS.md, feeds/underground README, feeds README and EVENTS.md, pixel palette) when next run; pace
    `registry-wikidata.mjs` through `tools/lib.mjs` `qlever()`.
