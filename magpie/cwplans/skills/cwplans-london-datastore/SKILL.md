---
name: cwplans-london-datastore
description: >-
  The London Datastore (data.london.gov.uk, GLA, a DataPress site) walked for magpie/cwplans: the current API
  (/api/v3/datasets/export.json gives all 1,305 datasets in one response; the CKAN-compatible /api/action/package_search
  ignores q, rows and start; organization_list and license_list answer 410), the site terms (any purpose; state that
  the GLA cannot warrant the data), the tool tools/walk-london-datastore.mjs (walk, triage, harvest), the written
  triage rules (licence class, relevance to the Docklands zone, kind, held/listed by the project, value themes, join
  keys, sensitive titles, score), the 13 harvested datasets in feeds/london-datastore/ (conservation areas, Southwark
  local list, brownfield register, site allocations, SIL, LSIS, safeguarded wharves, Article 4, designated open
  space, CAZ, air quality sites, cultural infrastructure venues, LVMF 2026 views) clipped to the 3D model box, and
  the traps: GLA Planning Constraints Map GeoPackages with geometry only and a brownfield OBJECTID that is not the
  CSV's (F23), spreadsheet-rounded UPRNs in the cultural infrastructure map (F22) and the method that amends them in a copy
  (tools/amend-uprns.mjs: detection classes, recovery routes, confidence, amendments file), a constant position offset
  in 10 venue layers (F25), custom GPKG srs_id 100000 that is
  BNG. Reach for it before you re-walk or update the triage, harvest another Datastore dataset, judge whether a GLA
  dataset is open or relevant, join these files to the registry, or repair a rounded or damaged column in any
  spreadsheet-sourced file.
---

# London Datastore for magpie/cwplans

Policy, the fault register (F-numbers) and the activity log: the hub skill `docklands-data-curation`
(`magpie/cwplans/skills/docklands-data-curation/`). Append what you did to its `ACTIVITY-LOG.md`.
Results and the ranked backlog: https://github.com/danbri/glitchcan-minigam/blob/master/magpie/cwplans/feeds/london-datastore/README.md.
Checked against the tool and the files on 2026-10-04.

## Run

    NODE_USE_ENV_PROXY=1 node magpie/cwplans/tools/walk-london-datastore.mjs walk          # catalogue.json (2 requests)
    node magpie/cwplans/tools/walk-london-datastore.mjs triage                             # triage.json (no network)
    NODE_USE_ENV_PROXY=1 node magpie/cwplans/tools/walk-london-datastore.mjs harvest [key ...]   # feeds/london-datastore/<key>/
    node magpie/cwplans/tools/check-data-register.mjs --write

`--refresh` re-downloads (raw files in `data/raw/london-datastore/`, gitignored, are reused otherwise). `--details`
also GETs `/api/v3/dataset/<id>` for every dataset (1,305 requests, about 25 minutes); a check of 186 on 2026-10-04
found nothing the export lacks except a generic format word, so it is not needed for a normal re-walk.
Politeness is in the tool: one request at a time over the whole run, at least 1.1 s apart, backoff on 429 and 5xx,
the project User-Agent. Do not run two copies at once (two processes are two queues).

## The API (2026-10-04)

- `GET /api/v3/datasets/export.json`: every public dataset with `licence {title,url}`, `topics`, `tags`,
  `custom.geo` (spatial granularity: Point Location, Ward, LSOA, Borough, Greater London...), `custom.update_frequency`,
  `createdAt`, `updatedAt`, `resources` (url, filename, size, timestamp, timeframeFrom/To), `links` (url, httpStatus,
  qaTimestamp). Publisher = `logo.title` (the organisation); 14 datasets have none and fall back to the CKAN maintainer.
- `/api/action/package_search` (CKAN-compatible) returns all datasets at once; text search does not work: filter
  locally. `/api/3/action/*` redirects to `/api/action/*`. Deprecated routes answer 410 and name the v3 endpoints.
- Download URLs: `https://data.london.gov.uk/download/<dataset id>/<resource id>/<file>`; every resource in the
  export has this form (the catalogue stores `file` and rebuilds the URL).
- Terms: https://data.london.gov.uk/about/terms-and-conditions. Each dataset's licence rules; the site asks re-users
  to state that the GLA cannot warrant the quality or accuracy of the data. Every harvested `meta.attribution` says so.

## Triage rules (in the tool; `triage.json` `meta.rules` repeats them)

- **Licence class**: OGL v2/v3, CC BY, ODC-By, Public Domain/PDDL are open. CC BY-SA and ODbL are share-alike: never
  harvested (repo `CLAUDE.md`; OSM is the only share-alike exception). All Rights Reserved, CC NC: restricted. No
  licence: not harvested (324 datasets, including both Isle of Dogs OAPF records and the 2025 cultural venue list).
- **Relevance**, first match: zone-place (title or tag names a place in the model box; strip "upon Thames",
  "Thames Estuary", "Thames Gateway", "Thamesmead" first, or the 33-borough tag sets match "thames"); zone-borough
  (names only zone boroughs; a dataset naming four or more boroughs is London-wide); other-area; then the `geo`
  field: finer than a borough = london-fine, borough rows = london-borough, London or coarser = london-coarse; with no
  geo field, a granularity word or a spatial file format; else unknown.
- **Have**: a dataset id or slug in a committed file. Tools, data files, `data-register.json`, `pipeline.json` = held;
  `.md` notes, `feeds/` catalogues and the 2026-10-03 survey = listed; an `excluded` list or a survey "left out" line =
  excluded-before. `feeds/london-datastore/` itself and the generated docs are not read. After you register a harvest,
  re-run triage: the harvested datasets become held and drop out of the ranking.
- **Sensitive** titles (homicide, custody, strip and intimate searches, stop and search, suicide, rough sleeping,
  bariatric incidents...) score 0 and are never harvested, whatever the licence (data ethics in `CLAUDE.md`).
- **Score** = relevance weight x theme value x recency x machine-readable x join key x open x (held 0, listed 0.8).
  It ranks; it does not decide. The themes are keyword lists and the Datastore topics add themes broadly, so read the
  `reasons` and the resources before choosing.

## Harvest

The `HARVEST` table in the tool names each dataset, the resource file and its reader: GeoPackage (`node:sqlite` plus a
WKB reader), GeoJSON, shapefile zip (`unzip` plus a .shp/.dbf/.prj reader), CSV (RFC 4180). Zone test in BNG: a
geometry is kept when it meets the 3D model box (vertex inside, edge crossing, or box inside a polygon); whole
geometries are kept, with `whole_in_zone` and `in_cw` (Canary Wharf registry box). Output: `<key>/<key>.geojson`,
WGS84 to 6 decimals through OSTN15, with a `meta` member: source, dataset id, page, resources with URL and dates,
fetch date, licence and URL, attribution, layers and CRS, method, counts, `attributes_in_source`, fields dropped.

To add a dataset: check its licence class and resources in `catalogue.json`, add a row to `HARVEST`, run
`harvest <key>`, read the output by hand (attributes present? coordinates in the right place? `in_zone` plausible?),
register the file and a `lds-<id>` source in `data-register.json`, add it to the activity's `used` and `generated`
lists in `pipeline.json`, run the check, re-run triage, and update the README table and backlog.

## Amending rounded UPRNs (F22): copy, amend, record

Owner, 2026-10-04: "Can we record a methodology for fixing this by copying and amending the spreadsheet?" The method
is general: it applies to any spreadsheet-sourced file with an identifier column (UPRN, USRN, company number, phone).
Tool: `tools/amend-uprns.mjs` (recipe `cultural-infrastructure`, or generic flags; see its header).

    NODE_USE_ENV_PROXY=1 node magpie/cwplans/tools/amend-uprns.mjs cultural-infrastructure   # about 3 min first run
    node magpie/cwplans/tools/check-data-register.mjs --write

**Rules.**

1. Do not change the source file. The harvested file stays as harvested. Write a copy next to it
   (`<key>.uprn-amended.geojson`) and a separate amendments file (`<key>.uprn-amendments.json`).
2. Change only cells in a rounded class (below). Never change a value that is not suspect, also when a route
   "finds" a better one: that is a different fault, and it goes in the catalogue.
3. Record every change: row id, column, old value, new value, route, evidence, confidence, applied, date. Record every
   value left unknown, with the reason and what each route found. In the copy, a changed feature gets `uprn_amended`
   (old value, route, confidence, amendment number); an unknown one keeps `uprn_suspect` and gets `uprn_unresolved`.
4. Never guess. Two candidates are never chosen between; a low-confidence candidate is recorded and not applied.
5. One venue, one answer: rows with the same normalised name within 50 m (the same venue in several layers) are
   recovered together; their ranges are intersected and their candidates pooled.
6. Measure the route before trusting it: hide valid values behind the same rounding and recover them blind
   (`meta.validation` in the amendments file). A confidence level is a measured precision, not a feeling.

**Detection: the classes of a UPRN cell** (every cell is classified; the counts are in `meta.catalogue`).

| class | test | action | cultural venues, 662 rows |
|---|---|---|---|
| scientific | `1.00E+11`, `1.00023E+11` (seen in the CSVs and the ArcGIS service, not in the GPKG) | amend | 0 |
| trailing-zeros | 9 or more digits that end in 5 or more zeros | amend | 56 |
| empty, text ("No UPRN", "See notes"), decimal, out-of-range (over 12 digits, or 0), padded (spaces) | | count only | 63, 31, 0, 3, 18 |
| duplicate | one value on venues with other names more than 50 m apart | count only (shared buildings are real) | 18 values, 4 of them rounded |
| not in OS Open UPRN | the value has no point in OS Open UPRN in the zone + 300 m | count only | 14 |
| far from OS Open UPRN | the value's point is over 150 m from the venue (F17's limit) | count only | 14 |
| layer offset | a constant vector between the venue points and their own UPRN points in one layer (modal 5 m bin over 50 m, 25 % of the layer or more) | count only (F25) | 10 layers, 114 venues |

A short UPRN is not a fault: Tower Hamlets UPRNs have 7 digits. "Below the 12-digit range" is tested by the reference
check (not in OS Open UPRN, or far from it), not by length.

**The range a rounded value allows.** Excel rounds to k significant digits, so the true value lies within half a unit
of the last kept digit: `1.00023E+11` -> [100022500000, 100023500000). A plain `200000000000` hides k; read it with
its non-zero prefix (k = 1) -> [150000000000, 250000000000), the widest honest range. Other rounded forms of the same
venue narrow it: `1.00023E+11` in one release and `1.00E+11` in another intersect. Every candidate must lie in the range.

**Recovery order** (stop at the first route that gives exactly one candidate in range):

- (a) The same dataset in other formats, layers and releases. Checked first because it can fix many at once. Here:
  every CSV, zip and venue GPKG of 23697 (all revisions), 2ko88 (the 2018-2020 releases) and 2zj1y, and the GLA ArcGIS
  service of the public map (116 files, 82,223 rows). Match: same normalised name (or one contains the other, 8+
  characters) and point within 50 m. Result: the rounding is in every release; it helped only where the same venue sat
  in another layer with its full UPRN (Bishopsgate Institute in Dance rehearsal studios) or in an older release before
  rounding (Printworks, The Albany). The 2025 list (2rj5o) has no licence: not used.
- (b) OS Open UPRN points (OGL) in the smallest OSM building outline that contains the venue point (no outline: points
  within 10 m). In an F25 layer the point moved by the layer offset is tried too. Only points in the range count.
- (c) Registers with UPRNs (GIAS, ODS, Active Places in `registry/sources/registers/`), matched as in (a). They cover
  E14 only; no cultural venue with a rounded UPRN is in E14, so (c) found nothing here.
- (d) Unknown, with the reason: "no candidate in range" or "n candidates, not chosen between".

**Confidence** (thresholds are constants at the top of the tool):

| level | rule | measured (valid 12-digit UPRNs rounded to 3 and to 6 digits, recovered blind; 160 venues) | applied |
|---|---|---|---|
| high | route a, exact name, and the candidate's OS Open UPRN point within 150 m of the venue (or of the venue moved by its layer offset) | route a, other releases only: 61 of 61 and 63 of 63 correct, 0 wrong | yes |
| medium | route a otherwise; route c; route b when the one candidate's point is within 1 m of the venue's own point in an outline of at most 25 UPRN points | route b medium: 2 of 2 and 7 of 7 correct, 0 wrong (small sample) | yes |
| low | any other route b result | route b unique: 38 correct, 9 wrong (k = 3); 50 correct, 9 wrong (k = 6); most cases ambiguous | no |

Why route b alone is weak: the GLA point is often not the point of the venue's own UPRN (the parent building, a
neighbour, an F25 offset), so "the only UPRN in the building in range" was wrong 9 times in 47. The 1 m rule works
because then the publisher geocoded from that very UPRN; the 25-point limit removes blocks of flats and office
towers, where one point holds many UPRNs (Greenwich Dance: 98 points; the venue point is on another UPRN of the building).

**Results, 2026-10-04** (`feeds/london-datastore/cultural-infrastructure/`):

- 56 rounded rows, 49 venues. Fixed 12 rows (12 venues): route a 6 (high), route b 6 (medium), route c 0.
- Still unknown 44 rows: 3 rows (2 venues: Studio 338, The Children's Society archive) with only a low candidate;
  41 rows (35 venues) with no single candidate: 28 venues with 2 to 74 UPRN points in range in their outline (City
  halls, churches, pubs with flats above), 7 with no point in range (venue point outside any outline, or the UPRN
  elsewhere).
- To fix more: AddressBase (licensed: not used), the GLA (ask for the source spreadsheet as .xlsx: the stored number
  keeps all digits even when the cell shows 1E+11), or a hand check per venue (council LLPG pages): record it as a
  manual amendment with its evidence, never in the source file.

**Traps met.** The rounding is older than the 2023 file (2ko88 CSVs carry `1.00E+11`); the ArcGIS field is text and
rounded too; the editable FeatureServers need a token; the same name at one address can have two UPRNs (The Albany:
arts centre 100023569348, theatre 100023280749; the range kept the right one); the 2019 CSV gives Baltic Exchange an
easting and northing 224 m west and 107 m north of the 2023 ones with the same latitude and longitude (one example
checked; match on latitude and longitude, not on eastings).

## Traps (catalogued)

| fault | trap | rule |
|---|---|---|
| F22 | Cultural Infrastructure Map UPRNs rounded by a spreadsheet: 200000000000, 100023000000, 1E+11; many venues share one false UPRN (56 of 599 in the zone). Every release has it | `uprn_suspect` on the feature; never a key. Amended copy: 12 of 56 recovered, 44 still unknown ("Amending rounded UPRNs") |
| F25 | 10 of 26 venue layers: points a constant (-112, +54) m from their own UPRN's OS point (theatres the opposite way); 114 of 491 venues | catalogued, not moved; allow for it in a position join; `meta.catalogue.group_offsets` of the amendments file |
| F23 | Planning Constraints Map GeoPackages of 2025-12-23 (site allocations, SIL, LSIS, brownfield) carry geometry and OBJECTID only; the brownfield CSV's `objectid` is another numbering (127 of 238 zone polygons over 500 m from the CSV point with that id) | never join on that OBJECTID; brownfield read from the CSV's own points; the others kept as outlines with `attributes_in_source: none` |
| | A GPKG custom `srs_id` 100000 ("unnamed", Airy 1830 + the BNG projection) | read as EPSG:27700 by its definition; any other unknown SRS stops the harvest |
| | Brownfield CSV `geox`/`geoy` mix BNG metres and WGS84 degrees row by row; 167 rows have none | per-row test, `no_geometry` counted |
| | The local OSTN15 grid covers only the London area: WGS84 points far outside fail the grid shift | WGS84 rows outside the zone plus 0.02 degrees are skipped before transforming |
| | Flood Risk (2w4wy) is EA Flood Map polygons with no flood zone class | not harvested; use the EA source |
| | Old slugs without ids (`dataset/recorded_crime_summary`) do not resolve | listed in `triage.json` `meta.unmatched_references` |

## Open (2026-10-04)

The ranked backlog is in the README: Town Centre Boundaries, Opportunity Areas, High Street Boundaries and BIDs first
(listed in feeds.json, not held); then boundaries and census tables for ward and LSOA joins; the London Heat Map and
the Solar Opportunity Map by TOID (large; clip by the zone's TOIDs). Not yet joined to the registry: the cultural
venues by UPRN (use the amended copy; high and medium only; minus `uprn_suspect`) and the brownfield sites by address. The GLA Planning Data Map ArcGIS service
that may hold the missing attributes answered 403 (2026-10-04).
