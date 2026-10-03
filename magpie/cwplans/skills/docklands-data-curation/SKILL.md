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

## Catalogue first

`tools/audit-quality.mjs` runs the same checks on every rebuild (32 in October 2026, eight classes:
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
| F2 | 2026-10-03 | OSM tags hold ";" lists (`addr:postcode="E14 9DT;E14 9FQ"`, `level="0;1"`); `postcodes.mjs`, `build-registry.mjs` and `build-branches.mjs` read the list as one value | pipeline | open | PL-1: 79 features, 247 postcode links lost; VA-2: 97 level lists |
| F3 | 2026-10-03 | `build-branches.mjs` writes "Unit " before OSM `addr:unit`, which often already says "Unit 14": "Unit Unit 14" | pipeline | open | PL-2: 52 branch addresses; 118 OSM `addr:unit` values start with "Unit" |
| F4 | 2026-10-03 | Mall and below-ground occupants placed by a 2D point-in-outline test: the malls run under several buildings, so shops land in the building above. Example: Boots (OSM, Canada Place, Mall Level -1) placed in The Ivy "within 2 m"; FSA "Boots the Chemist (4)" (Jubilee Place) inside Northern Trust; Nicolas (One Canada Square mall) inside Crossrail Place | position (join rule) | open | SP-6: 86 of 181 mall or below-ground occupants in an outline that is not their mall; 34 more below ground in a building with no basement record |
| F5 | 2026-10-03 | The registry had no heights for most buildings: only OSM `height` tags and Wikidata were read | coverage | fixed in 02da9a3 for the atlas: `build-atlas.mjs` takes the 3D model's LiDAR height by point-in-polygon of the model footprints (1,079 of 1,129) | CV-1: height 95.6% |
| F6 | 2026-10-03 | OSM names buildings after tenants ("HSBC UK" for 8 Canada Square) | identity (source) | rule in use: Wikidata label first | ID-3: 20 |
| F7 | 2026-10-03 | FSA positions: more than half are postcode centres or shared points, and were used for building placement | position (source + join rule) | open | SP-3: 412 of 764 |
| F8 | 2026-10-03 | Wikidata occupant and headquarters links fetched without dates: former tenants look current (the Financial Services Authority at One Canada Square) | currency (query) | open | TM-4: 34 |
| F9 | 2026-10-03 | OSM level and CWG mall level use different schemes; the offset depends on the mall | attribute conflict (source schemes) | open: needs a per-mall offset table | AT-3: 46 of 72 differ; Cabot Place −1 for 19 of 26, Jubilee Place 0 for 11 of 13 |
| F10 | 2026-10-02/03 | Earlier faults, fixed when found: `simplify()` collapsed closed rings; incomplete Thames multipolygons dropped (needed relation members); DLR drawn on station roofs (DSM) until bridge points over 20 m were interpolated; scripts ran side effects when imported (main guards added) | pipeline | fixed | ACTIVITY-LOG.md, 2026-10-02 |
| F11 | 2026-10-02/03 | Wrong claims in our own text, fixed: an FSA search URL and a flood-check link that returned 404; a guessed Wikidata id; a feed marked verified behind a bot challenge; wrong bearings in a README; "Geofabrik" named as the OSM source (it was openstreetmap.fr) | documentation | fixed | ACTIVITY-LOG.md |

| F12 | 2026-10-03 | The OSM walking network below ground is thin and inconsistent: platforms and concourses drawn as areas that paths do not share nodes with; escalators without levels; levels joined with no connector | routing network (source) | open; areas joined by hubs in `build-indoor.mjs`, the rest measured | NET-1 to NET-4: 42 parts, 192 level joins, 30 connectors without levels, 46 places off their level |

Add new faults here with the next F number, and in the activity log.

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
- **Heights.** LiDAR for buildings older than the survey; nine buildings show under half their
  floor-count height and are newer (AT-1).

## Rebuild order

    node magpie/cwplans/tools/build-registry.mjs        # registry/buildings.json (needs data/raw/registry/*)
    node magpie/cwplans/tools/build-atlas.mjs           # atlas/data/atlas.json (reads the registry and docklands/data/area.js)
    node magpie/cwplans/tools/audit-quality.mjs         # quality/issues.json, quality/CATALOGUE.md (reads the atlas)
    node magpie/cwplans/tools/check-data-register.mjs --write   # every committed data file registered?

The fetch and 3D steps are in `magpie/cwplans/docklands/README.md` and `registry/README.md`. Raw extracts
over a few MB stay local (gitignored); `data-register.json` says what is committed and why.

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
