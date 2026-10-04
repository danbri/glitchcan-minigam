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
  CSV's (F23), spreadsheet-rounded UPRNs in the cultural infrastructure map (F22), custom GPKG srs_id 100000 that is
  BNG. Reach for it before you re-walk or update the triage, harvest another Datastore dataset, judge whether a GLA
  dataset is open or relevant, or join these files to the registry.
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

## Traps (catalogued)

| fault | trap | rule |
|---|---|---|
| F22 | Cultural Infrastructure Map UPRNs rounded by a spreadsheet: 200000000000, 100023000000, 1E+11; many venues share one false UPRN (56 of 599 in the zone) | `uprn_suspect` on the feature; never a key |
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
venues by UPRN (minus `uprn_suspect`) and the brownfield sites by address. The GLA Planning Data Map ArcGIS service
that may hold the missing attributes answered 403 (2026-10-04).
