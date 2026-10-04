---
name: cwplans-open-portals
description: >-
  The open-data catalogues other than the London Datastore, walked for the magpie/cwplans Docklands zone with one tool,
  tools/walk-portals.mjs, and one adapter per portal in tools/portals/: data.gov.uk (CKAN package_search, all 59,451
  datasets; scope S1-S4, states T0-T11), planning.data.gov.uk (MHCLG, every dataset OGL, zone counts by the platform's
  spatial query or by zone planning organisation; states P0-P8), the six zone borough portals, Nomis / ONS Census 2021
  tables, the ONS Open Geography Portal and other national APIs. Covers each portal's API, robots.txt and terms, the
  written triage rules and the final state of every dataset (harvested, held, listed-for-harvest, deferred,
  not-relevant, not-open, unavailable, sensitive, walked-elsewhere), the licence classes (no licence = metadata only;
  "no restrictions" without a licence name is not open; GOV.UK/ONS site terms), the harvests in feeds/portals/ clipped
  to the 3D model box (listed buildings and outlines, Heritage at Risk, Article 4 areas, area TPOs, EA flood zones,
  section 106 agreements...), size rules for the repo, and the traps (Poplar is a tree, short slugs match prose,
  safeguarding areas are not safeguarding of people, deleted records keep resources). Reach for it before you walk,
  re-triage or harvest any national or borough portal for cwplans, or answer "is dataset X open and in the zone?".
---

# Open-data portals for magpie/cwplans

Policy, the fault register and the activity log: the hub skill `docklands-data-curation`. Append what you did to its
`ACTIVITY-LOG.md`. The London Datastore has its own skill (`cwplans-london-datastore`) and tool; this walk copies its
method (walk, area from the data, written triage rules, one final state per dataset, harvest clipped to the zone,
size caps) for the other portals. Results: https://github.com/danbri/glitchcan-minigam/blob/master/magpie/cwplans/feeds/portals/README.md.
Checked against the tool and the files on 2026-10-04.

## Run

    NODE_USE_ENV_PROXY=1 node magpie/cwplans/tools/walk-portals.mjs dgu walk        # 60 pages, ~2 min; raw all.jsonl.gz (7 MB)
    node magpie/cwplans/tools/walk-portals.mjs dgu triage                            # no network
    node magpie/cwplans/tools/walk-portals.mjs dgu catalogue                         # the committed compact catalogue
    NODE_USE_ENV_PROXY=1 node magpie/cwplans/tools/walk-portals.mjs pdg walk         # 478 requests, ~9 min
    node magpie/cwplans/tools/walk-portals.mjs pdg triage
    NODE_USE_ENV_PROXY=1 node magpie/cwplans/tools/walk-portals.mjs pdg harvest [dataset ...]
    node magpie/cwplans/tools/walk-portals.mjs index                                 # feeds/portals/index.json
    node magpie/cwplans/tools/check-data-register.mjs --write

`--refresh` re-downloads raw files (`data/raw/portals/<portal>/`, gitignored). Order per portal: walk, triage,
harvest, register, triage again (harvested datasets become `harvested`), index. The zone reference is
`feeds/london-datastore/zone-codes.json` (postcodes, OA/LSOA/MSOA/ward codes) and the zone UPRN list in the London
Datastore raw cache (`data/raw/london-datastore/zone-uprns.txt`), loaded by `zoneRefs()`.

**Politeness** (in `walk-portals.mjs`): one request at a time over the whole run, at least 1.1 s apart; robots.txt is
read for every host before its first request and obeyed (longest matching rule wins; `allowed()`); backoff on 429 and
5xx (Retry-After honoured); the project User-Agent. Do not run two copies against one host at once.

## Licence classes (`licenceClass`)

OGL (any version), CC BY, ODC-By, CC0/PDDL/public domain are **open**. Anything non-commercial or closed is
**restricted**; CC BY-SA and ODbL are **share-alike** (never harvested; OSM is the only share-alike exception in
`CLAUDE.md`). "No conditions apply" or "no restrictions" without a licence name is **open-unclear**: not harvested
until a licence is found (the Tower Hamlets ArcGIS Hub says "No special restrictions or limitations ... except that
data scraping tools should not be used": not a licence). No licence is **none**: metadata only.
Site terms: a data.gov.uk record with no licence whose resources all sit on GOV.UK, ONS, Nomis, NHS Digital, DfT road
traffic or data.police.uk is `ogl-site-terms` (those sites state OGL v3.0 for their content), and is open.

## data.gov.uk

- API: `https://www.data.gov.uk/api/action/package_search?rows=1000&start=<n>&sort=metadata_created asc` (the bare
  domain answers 301). A page of 1,000 full records is 18 MB, so the walk writes a compact record per dataset to
  `data/raw/portals/dgu/all.jsonl.gz` (7 MB for all 59,451) and keeps no description text, only the area words found
  in it. `ext_bbox` spatial search is refused ("Local parameters are not supported"); INSPIRE records carry
  `bbox-*-long/lat` extras instead, and the licence in the `licence` and `access_constraints` extras.
- Scope: S1 local publishers, S2 named national publishers (`NATIONAL_ORGS`), S3 the GLA (= London Datastore, state
  walked-elsewhere), S4 other publishers whose title or tags name a zone place or borough. Out of scope: counted per
  organisation in the meta.
- States, first match: T0 by hand (`JUDGED`), T1 sensitive title, T2 held, T3 walked-elsewhere (the GLA; any resource
  on the ONS Open Geography Portal, the OS Data Hub or the City of London map service, which other adapters walk
  whole), T4 unavailable (no resources, or "Deleted"/"withdrawn" in the title), T5 not-relevant administrative
  (payments, spending, staff, contracts, FOI; title and slug), T6 not-open, T7 not-relevant other area (bounding box
  misses the zone, or the title names another region, county, city or London borough), T8 deferred documents only,
  T9 listed-for-harvest (zone place, zone borough, London-fine or national-fine), T10 not-relevant coarser than a
  borough, T11 deferred area unknown.
- Relevance: zone place in title or tags (not the description) unless tree or crop words are present; zone borough
  in title or tags, or an S1 publisher; then the bounding box (inside London and meeting the zone = london-fine); then
  fine area words in the description or a spatial resource (national-fine); then coarse words (national-coarse).
- Held: the dataset id, or its slug when it has 15+ characters and a hyphen, appears in a tool, data-register.json
  or pipeline.json (listed: in a .md or feeds/feeds.json).
- Committed size: `triage.json` lists one by one only the datasets that need a decision or hold data; the bulk states
  are name lists in `by_state` keyed "state | rule | reason" (every in-scope name is in exactly one place);
  `catalogue.json` holds the compact records of the datasets listed one by one. 4.2 MB together on 2026-10-04.
- Score ranks the listed ones only: relevance weight x (1 + 0.5 per theme) x recency x 1.3 for a spatial resource
  x 0.8 if listed elsewhere. It does not decide. Most listed records are national spatial layers whose metadata
  cannot say whether they hold anything in the zone: probe the service (WFS `resultType=hits` with the box, ArcGIS
  `returnCountOnly`) before harvesting.

## planning.data.gov.uk

- API: `dataset.json` (222 datasets, all `licence: ogl3`, attribution text per dataset); `entity.json` and
  `entity.geojson` with `dataset=<d>&geometry=<WKT polygon>&geometry_relation=intersects&limit=500&offset=<n>`;
  responses carry `count`. Non-geography datasets (documents, agreements, plans) are read per zone planning
  organisation: `organisation_entity` = GLA 144, Greenwich 150, Lewisham 198, City 203, Newham 246, Southwark 329,
  Tower Hamlets 350. robots.txt disallows `/fact/` (and `/entity/?` for GPTBot); the walk uses neither.
- States: P0 by hand (`JUDGED`: held from another source with the file named, or coarser than the zone), P1
  harvested, P2 ended, P3 not-open, P4 empty, P5 code list, P6 nothing in the zone, P7 listed-for-harvest, P8
  deferred. 2026-10-04: harvested 26, held 11, not-relevant 79, unavailable 106.
- Harvest (`HARVEST` table): geography by the spatial query, whole geometries rounded to 6 decimals with `in_zone`,
  `whole_in_zone`, `in_cw`; tables by organisation. `flood-risk-zone` is simplified (Douglas-Peucker 0.000005
  degrees, about 0.5 m) and cut at the box (`clipped_to_zone`): uncut it was 5.5 MB, cut 1.2 MB. A cut polygon is for
  display, not for area sums (a hole crossing the edge is cut as a ring).
- Held elsewhere (do not harvest twice): title boundaries (HMLR INSPIRE, `registry-inspire.mjs`), trees
  (`build-trees.mjs`), NaPTAN, GIAS, scheduled monuments and APAs (registry/sources/museums), conservation areas,
  brownfield and CAZ (London Datastore), wards.
- Section 106 / CIL agreements, contributions and transactions: only the Royal Borough of Greenwich publishes them to
  the platform (370 agreements, 1,398 contributions, 813 transactions on 2026-10-04).

## Size rules

Commit zone extracts only; national files stay in `data/raw/portals/` (gitignored, `.gitignore` line
`data/raw/portals`). Round coordinates to 6 decimals; cut very large polygons at the box when only the zone part is
useful, and say so in the meta. Report the size of each batch in the activity log. Disk in the container is small
(3.9 GB free on 2026-10-04): stream national CSVs and keep only zone rows.

## Traps (catalogued)

| trap | rule |
|---|---|
| "Poplar" is a tree: Forestry Commission short rotation coppice, black poplar clones and Energy Crops records matched the zone place list | zone places from title and tags only, not next to tree or crop words |
| Short slugs ("locks", "matrix", "find", "deaths") match project prose | held needs the id, or a slug of 15+ characters with a hyphen |
| "Safeguarding" is also a planning word (airport, Crossrail, Bank station safeguarding areas) | the sensitive rule asks for child or adult safeguarding |
| Deleted data.gov.uk records keep resources ("Deleted - moved to other existing datasets"), and their slug, not the title, says "spending" | unavailable by title; the administrative rule reads title and slug |
| The Tower Hamlets ArcGIS Hub has no named licence | not open; the same layers are taken from planning.data.gov.uk (OGL) |
| EA `spatialdata/<name>/wfs` answers, but its `next` links and the OGC API live under `/geoservices`, which robots.txt disallows | query through `/spatialdata/` only |
