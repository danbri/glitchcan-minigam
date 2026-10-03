---
name: docklands-data-curation
description: >-
  Curate the Canary Wharf, Isle of Dogs and Docklands open data in magpie/cwplans — the building registry
  (cwb- ids), occupants, postcodes, chain-store branches, heritage, river, feeds, the atlas, the 3D models,
  the data register and the data-quality audit. Use this when rebuilding or adding a source, joining two
  sources, changing a tool in magpie/cwplans/tools/, judging why two sources disagree, or about to correct
  a wrong value. READ "CATALOGUE FIRST" BEFORE PATCHING ANYTHING: the owner's direction (October 2026) is to
  catalogue and analyse error classes, not to fix records one at a time, because the classes drive the
  compositing layers. Append what you did to ACTIVITY-LOG.md in this directory before you finish.
---

# Docklands data curation

Pages: https://danbri.github.io/glitchcan-minigam/magpie/cwplans/atlas/ (everything joined; data quality at
`#quality`), https://danbri.github.io/glitchcan-minigam/magpie/cwplans/docklands/ (3D).
Policy for this directory: the repo `CLAUDE.md`, Data ethics, "EXCEPTION — magpie/cwplans/" (personal,
organisation and address data allowed during prototyping; no proprietary or restricted-licence data; OSM
under ODbL allowed and tracked; website crawls allowed for scoping and recorded).

**Activity log:** [ACTIVITY-LOG.md](ACTIVITY-LOG.md), dated, newest last. Add an entry for every session
that changes data, tools, checks or policy: what changed, the commit, the measured effect (audit counts
before and after), and what is still open.

## Ship at once

Owner, 2026-10-03: "shipping immediately to live site is fine and urgent. Don't batch things up, as live site is my only
way to see progress." Commit and push each working change to master as soon as it passes its check (syntax, a headless
load with no page errors), then confirm the live file matches the commit
(https://danbri.github.io/glitchcan-minigam/ + path). Do not hold finished work back to bundle it with other work.
Lesson from the same day: a comment inserted in the middle of a line commented out `gl.colorMask(true)` and left the
3D page black after "Splats only"; render() now resets that state every frame. After editing a long one-line
statement, re-read the whole line.

## Catalogue first

`tools/audit-quality.mjs` runs the same checks on every rebuild (34 in October 2026, eight classes:
identity, position, attribute conflict, validity, pipeline, currency, coverage, meaning). Output:
`quality/issues.json`, `quality/CATALOGUE.md`; the analysis and the proposed compositing layers are in
`quality/README.md`. When you find a wrong value:

1. Name its class. If no check covers it, add one (method, population, breakdown, examples, rule) and
   re-run. Do not edit the record.
2. Change a tool only when the fault is in our own pipeline (class "pipeline") or in a join rule, and keep
   the check so the count shows the effect.
3. Re-run the audit and compare: the targeted count should fall and no other count should rise. Write the
   counts in the activity log.
4. Read a new check's examples by hand before trusting it. In October 2026 two first drafts were wrong
   (a repeated-word check flagged real names such as "Tian Tian Market"; a postcode check called valid OSM
   ";" lists malformed), and one claim in the analysis (branch coverage) was wrong until it was computed.

## Fault register

Faults found in this project's joins and tools. "Open" means catalogued and measured, not yet fixed.

| id | found | fault | class | status | evidence |
|---|---|---|---|---|---|
| F1 | 2026-10-03 | One Wikidata item attached to two outlines: One Canada Square's coordinate lies in the Cabot Place mall outline below the tower, so `build-registry.mjs` gave the mall the tower's record (235 m, 50 floors, owner, Wikidata occupants) as well as the tower | identity (join rule) | fixed in 02da9a3: an item named by an OSM `wikidata` tag is not attached to a second outline by coordinate. 7 buildings changed; companies matched to a building 5,345 → 6,355 | audit ID-1, ID-4 (0 after the fix) |
| F2 | 2026-10-03 | OSM tags hold ";" lists (`addr:postcode="E14 9DT;E14 9FQ"`, `level="0;1"`); `postcodes.mjs`, `build-registry.mjs` and `build-branches.mjs` read the list as one value | pipeline | fixed: `tools/osm-values.mjs` `osmList`, fixture tests in `tools/test/`. Registry postcode links 1,050 → 1,146; companies matched to a building 6,355 → 9,787; 312 more OSM features counted under 299 E14 postcodes | PL-1 (now: list postcodes missing from the record that holds the feature): 57 → 0; VA-2: level lists remain (not yet parsed by the level readers) |
| F3 | 2026-10-03 | `build-branches.mjs` writes "Unit " before OSM `addr:unit`, which often already says "Unit 14": "Unit Unit 14" | pipeline | fixed: `unitLabel` adds "Unit" only to a bare designator ("14", "14a", "R12") | PL-2: 52 → 0; 57 branch addresses changed (also "Unit Promenade Level" → "Promenade Level") |
| F4 | 2026-10-03 | Mall and below-ground occupants placed by a 2D point-in-outline test: the malls run under several buildings, so shops land in the building above. Example: Boots (OSM, Canada Place, Mall Level -1) placed in The Ivy "within 2 m"; FSA "Boots the Chemist (4)" (Jubilee Place) inside Northern Trust; Nicolas (One Canada Square mall) inside Crossrail Place | position (join rule) | open | SP-6: 86 of 181 mall or below-ground occupants in an outline that is not their mall; 34 more below ground in a building with no basement record |
| F5 | 2026-10-03 | The registry had no heights for most buildings: only OSM `height` tags and Wikidata were read | coverage | fixed in 02da9a3 for the atlas: `build-atlas.mjs` takes the 3D model's LiDAR height by point-in-polygon of the model footprints (1,079 of 1,129) | CV-1: height 95.6% |
| F6 | 2026-10-03 | OSM names buildings after tenants ("HSBC UK" for 8 Canada Square) | identity (source) | rule in use: Wikidata label first | ID-3: 20 |
| F7 | 2026-10-03 | FSA positions: more than half are postcode centres or shared points, and were used for building placement | position (source + join rule) | open | SP-3: 412 of 764 |
| F8 | 2026-10-03 | Wikidata occupant and headquarters links fetched without dates: former tenants look current (the Financial Services Authority at One Canada Square) | currency (query) | partly fixed: one QLever query fetches P580/P582 and P576 for every occupant and headquarters link (`tools/build-categories.mjs`); former tenants no longer glow. The registry still lists them | TM-4: 34 undated → 4 current, 6 former, 24 undated |
| F9 | 2026-10-03 | OSM level and CWG mall level use different schemes; the offset depends on the mall | attribute conflict (source schemes) | open: needs a per-mall offset table | AT-3: 46 of 72 differ; Cabot Place −1 for 19 of 26, Jubilee Place 0 for 11 of 13 |
| F10 | 2026-10-02/03 | Earlier faults, fixed when found: `simplify()` collapsed closed rings; incomplete Thames multipolygons dropped (needed relation members); DLR drawn on station roofs (DSM) until bridge points over 20 m were interpolated; scripts ran side effects when imported (main guards added) | pipeline | fixed | ACTIVITY-LOG.md, 2026-10-02 |
| F11 | 2026-10-02/03 | Wrong claims in our own text, fixed: an FSA search URL and a flood-check link that returned 404; a guessed Wikidata id; a feed marked verified behind a bot challenge; wrong bearings in a README; "Geofabrik" named as the OSM source (it was openstreetmap.fr) | documentation | fixed | ACTIVITY-LOG.md |
| F12 | 2026-10-03 | The OSM walking network below ground is thin and inconsistent: platforms and concourses drawn as areas that paths do not share nodes with; escalators without levels; levels joined with no connector | routing network (source) | open; areas joined by hubs in `build-indoor.mjs`, the rest measured | NET-1 to NET-4: 42 parts, 192 level joins, 30 connectors without levels, 46 places off their level |

| F13 | 2026-10-03 | Tunnel controls from secondary sources: Canada Water Jubilee "22 m down" (Wikipedia) and North Greenwich "25 m down" (an interview) were 4 m and 6 m deeper than TfL's measured rail levels; a depth "below ground" has no stated reference point | attribute conflict (source precedence) | fixed: TfL FOI rail levels added as controls, the old ones kept with `superseded_by` and not applied (`applyControls` skips them) | AT-5: 2 |

Add new faults here with the next F number, and in the activity log.

## Imagery

Ground textures for the 3D page come from the EA survey download service (OGL): find what covers a box with
`POST https://environment.data.gov.uk/backend/catalog/api/tiles/collections/survey/search` (body: a GeoJSON
polygon), then GET each result `uri` (a ZIP; HEAD returns 405). Products over the model: colour aerial 2008
(40 cm), night-time aerial 2012 (20 cm), LiDAR intensity 2018 and 2020 (1 m), DSM and DTM for 1999, 2003,
2005, 2007, 2012, 2015, 2018, 2020 and 2022, and one 2017 oblique photograph.

- **The aerial photographs are ECW.** Debian's GDAL has no ECW driver and the Hexagon SDK needs a login. The
  ECW 3.3 SDK source (`git clone https://github.com/makinacorpus/libecw`) builds with
  `./configure CXXFLAGS="-O1 -w -std=gnu++98 -fpermissive" --prefix=/opt/ecw && make && make install` (the
  install step fails on headers after the libraries are in `/opt/ecw/lib`; that is enough). Then
  `g++ -x c++ -DLINUX -DPOSIX -D_LARGEFILE64_SOURCE tools/native/ecw2ppm.c -I<src>/Source/include -L/opt/ecw/lib -lNCSEcw -lNCSUtil -lNCSCnet -lpthread -o tools/native/ecw2ppm`
  (the binary is gitignored). Without `-DLINUX -DPOSIX` the headers stop with "unknown machine type". Its
  licence allows decoding in free software; we commit only the decoded, resampled JPEGs (the imagery is OGL).
- **Python here has no working numpy** (Debian's numpy fails to import after a pip install). `build-aerial.py`
  uses Pillow alone; float GeoTIFFs open as mode "F" and `point()` takes only linear functions on them.
- **Mosaics:** paste each tile with integer start and end pixels plus one pixel of overlap, or 1-pixel black
  seams appear at every tile edge (first build, 2026-10-03). Mask pure black: ECW tiles are black outside the
  flown area.
- **Coverage is uneven:** the 2008 colour tiles west of Limehouse come from another flight and are bluer; the
  north-west corner has no 2008 tile; the night survey stops near Whitechapel Road. Say so where the image is
  shown, do not colour-match.
- WebGL: draw the texture through the terrain's own x, z (uv from the box in `textures.json`); resample to
  2048 × 2048 on a canvas so the GPU can mipmap it.

## Splats and drone frames

- Two ways to get Gaussian splats of the estate: **synthesis** (`tools/build-splats.mjs`: discs sampled straight from
  the model surfaces, colours from the aerial photo and the facade rule; seconds, exact geometry) and **training**
  (drone frames from the page, `tools/drone-capture.mjs`, then a 3DGS trainer on CPU). Training on renders of our own
  model can only learn what the renders show: it gives a standard splat scene, not new information.
- Format: standard 32-byte `.splat` in model metres and axes (x east, y up, z south), gzipped for the page. A
  rotation built from three axis vectors must have determinant +1: a frame (t, up, n) with n = t × up flipped is a
  reflection and gives a wrong quaternion. Pick the normal sign for the frame, and the outward side separately.
- Counts: the first synthesis (3 m ground, a disc per window) made 1.6 million splats, 49 MB; 4 m ground and one glass
  band per 7.2 m wall cell made 669,306 (20 MB, 4.5 MB gzipped). SwiftShader needs about 30 s a frame for that: test
  splat views with `renderNow()` and `canvas.toDataURL`, not `page.screenshot` (it re-renders and times out).
- Depth compositing: "Splats only" draws the model into the depth buffer with the colour mask off and a polygon
  offset (splats lie on the walls and the ground), then the splats with the depth test and no depth write, then the
  glow. Without the offset, wall splats flicker against their own wall.
- Categories for the glow come only from stated classes (`tools/build-categories.mjs`).
- **Wikidata: pace ourselves and ask once.** The first version called wbgetentities in batches and got "too many
  requests" (owner, 2026-10-03: "maybe the rate limiting should come from us? Or a more carefully posed efficient
  query? QLever is very good"). Now `tools/lib.mjs` `qlever()` runs one query at a time, at least 1.5 s apart, with
  backoff on 429 and 5xx; and the tool asks two questions in total: the classes of all 65 occupant items (VALUES over
  the ids) and all occupant and headquarters links of the 86 building items with their qualifiers. 2.9 s, no
  retries. Cached in `data/raw/registry/wikidata-occupant-classes.json`; delete it to refresh.

- **Training (measured 2026-10-03).** OpenSplat 1.2.2 on libtorch CPU (`tools/train-splat.sh`). Poses go in as the
  nerfstudio camera-to-world matrices with no change; a wrong convention fails loudly ("No cameras see any sparse
  points"). Do not pass `--center`: without it the output stays in model metres. 480 frames at 480 x 270, 3,000 steps:
  33 min on a shared 4-core machine, 1.1 GB. With 2,000 steps or fewer, set `--refine-every 250` or nothing densifies.
  `--val-render` leaks about 40 MB a render: the OOM killer stopped one run. Do not edit `train-splat.sh` while a run
  is going: bash reads the file as it goes, and the first run's conversion step died with a syntax error that the
  finished file does not have.
- Trained output has floaters out to 2 km (OpenSplat trains on a black background; sky becomes splats at random
  depths). `tools/publish-trained-splat.mjs` keeps the flown box plus 150 m, -30 to 260 m OD and axes up to 25 m
  (21,222 of 188,295 removed) and gives each splat its building, so the music visualiser works on it too.

## Towers

- `tools/build-towers.py` fits tiers to the 1 m DSM for the towers of 100 m and over; `docklands/data/towers.json`
  replaces their prisms on the page (today only; the year slider keeps prisms).
- The "2022" composite DSM merges only the 2017-12/2018-01 and 2020-12-12 flights: it is not an independent check of
  2020. The independent check is the 2018 flight, for towers finished by January 2018.
- Glass towers lose returns in the 2020 flight (58% of the roof cells for Novotel and Dollar Bay): use 2018 there.
  Where 2020 has a gap, the composite fills it from near the ground (a 10 m hole at One Canada Square's apex):
  treat such cells as no data.
- OSM outlines lean in the aerial photos they were traced from: shift each footprint by whole metres (at most 4) onto
  the LiDAR building before fitting.
- Report roof RMSE on roof cells only. With walls in, a 1 m misfit at a 200 m wall is a 200 m error (raw RMSE 11 to
  58 m means nothing).
- Wikidata's 104.8 m for 33 Canada Square is probably the height of the next wing of Citigroup Centre; the DSM gives
  78.5 m. Catalogue such differences; do not patch.

## Trees and facades

- `docklands/data/trees.json` (`tools/build-trees.mjs`): GLA public realm trees first, then TPO points, OSM, Forest
  Research Trees Outside Woodland, each only where no kept tree is within 3 m. Only position, taxon, height, crown,
  source and record id are kept (the Bristol rule applies here too). GLA canopy and green cover 2024 are all rights
  reserved, Curio Canopy is CC BY-SA: not used. 20 TOW "lone trees" are over 35 m (cranes or structures): the page
  leaves out trees over 35 m; they are not corrected in the file.
- The page loads trees.json only when trees are shown (pixel art or the Trees switch) and draws the 18,516 within
  900 m of the estate; the whole file as boxes would be about 30 MB of vertices on a phone.
- `registry/sources/facades/`: measured bays and colours from CC BY and PD photos. Check against a known count where
  one exists (One Canada Square: 19.9 bays measured, 19.8 known). Most recent Commons photos of the new towers are
  CC BY-SA: look only. Commons and Flickr rate-limit the container (429, retry after 600 s).

## Measured lessons (the reasons behind the rules)

- **OSM tags can hold lists.** Split on ";" for every tag on ingest (F2).
- **Never prefix a label to free text.** Parse unit designators out of the value (F3).
- **One Wikidata item, one outline.** An OSM `wikidata` tag outranks containment of the item's coordinate
  (F1). OSM itself tags three items on two outlines each (ID-1): model complex → building → part.
- **The estate is three-dimensional.** A mall is a container of its own, below and between buildings;
  place its occupants by mall and level, and keep the building above only as context (F4).
- **Levels are labels.** OSM `level` is a mapper's index; CWG names levels per mall; measure the offset
  per mall (F9). Convert to metres only through published slab levels (`data/sourced-levels.json`).
- **A position has a precision and a meaning.** Postcode-centre points place a postcode, not a building
  (F7). 5,888 of 6,629 heritage points are where an object is kept (SE-2).
- **A registered office is not an occupant.** E14 5HU has 2,652 registered companies (SE-1).
- **Links need dates** (F8). Company status, FSA rating dates, CWG archive dates and the LiDAR survey date
  travel with the values they qualify.
- **Depths need a datum and an owner.** "22 m down" has no reference point; TfL's rail level has a datum
  (London Underground Datum = OD - 100 m). The asset owner's level outranks a rounded secondary depth; keep
  the loser as evidence with `superseded_by` (F13, AT-5).
- **Heights.** LiDAR for buildings older than the survey; nine buildings show under half their
  floor-count height and are newer (AT-1).

## Rebuild order

    node magpie/cwplans/tools/build-registry.mjs        # registry/buildings.json (needs data/raw/registry/*)
    node magpie/cwplans/tools/build-atlas.mjs           # atlas/data/atlas.json (reads the registry and docklands/data/area.js)
    node magpie/cwplans/tools/audit-quality.mjs         # quality/issues.json, quality/CATALOGUE.md (reads the atlas)
    node magpie/cwplans/tools/check-data-register.mjs --write   # every committed data file registered?

The fetch and 3D steps are in `magpie/cwplans/docklands/README.md` and `registry/README.md`. Raw extracts
over a few MB stay local (gitignored); `data-register.json` says what is committed and why.

## Provenance for the knowledge graph

Owner, 2026-10-03: "In future we will create a corpus that brings select sources through a data integration pipeline
into a Knowledge Graph environment. Bear that in mind as we record sources and transforms." So:
- Every tool is an activity in `pipeline.json`: what it used (committed files, local raw files, external sources
  with the endpoint and the request), what it generated, the rules that change data, network or not, deterministic
  or not, and which activities must run before it. Add or change the entry in the same commit as the tool.
- Keep source identifiers as they come (OSM type/id, Wikidata QID, UPRN, TOID, FHRS id, company number, cwb- id):
  they become IRIs. Never replace a source id with a name.
- Keep dates and qualifiers with values (fetch date, survey date, P580/P582): a graph without time repeats F8.
- `node magpie/cwplans/tools/check-data-register.mjs --write` checks the manifest against the tools and the register
  and writes `pipeline.jsonld` (W3C PROV-O, DCAT, Dublin Core).

## Data register

Every committed data file has an entry in `data-register.json`: sources (keys into its `sources` table with
licence and attribution), `osm.use` (raw, derived, counts, ids, notes, none), the OSM extract, and
`shown_on` pages. The check fails on an unregistered file and on a page that shows OSM data without the
visible "© OpenStreetMap contributors" link to https://www.openstreetmap.org/copyright. Add the entry in the
same commit as the file. `skills/` and `vendor/` are not data and are not registered.

## Pages and tests

- The atlas (`atlas/index.html`) loads `atlas/data/atlas.json` first and the detail files on demand. Hash
  routes: `#view`, `#view/b/cwb-0413`, `#view/pc/E14-5AB`, `#quality/q/SP-6`; `#cwb-NNNN` also works.
  `window.__atlas.open(kind, id)` opens a record. Building and postcode records list their quality issues.
- The 3D page accepts `#at=x,z,dist` in local metres (x = E − 537550, z = −(N − 180300)).
- Test headless with Playwright from a local `python3 -m http.server` (fetch needs http). This container
  cannot reach tile.openstreetmap.org, so the basemap is missing from captures; say so when you report.
