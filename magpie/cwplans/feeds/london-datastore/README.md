# London Datastore walk (2026-10-04)

A recorded walk through the whole London Datastore (https://data.london.gov.uk/, Greater London Authority) for the
Docklands zone: the catalogue, a triage of every dataset by written rules, and a harvest of 13 open datasets clipped
to the zone. Owner, 2026-10-04: "Can we work our way through open data London portal?"

- Tool: `tools/walk-london-datastore.mjs` (https://github.com/danbri/glitchcan-minigam/blob/master/magpie/cwplans/tools/walk-london-datastore.mjs)
- Method, rules and how to re-walk: skill `cwplans-london-datastore`
  (https://github.com/danbri/glitchcan-minigam/blob/master/magpie/cwplans/skills/cwplans-london-datastore/SKILL.md)
- Files here: `catalogue.json` (every dataset, one per line), `triage.json` (class and reasons per dataset, ranked list),
  one folder per harvested dataset with a `.geojson` that carries a `meta` member (source, URLs, fetch date, licence,
  attribution, method, counts).

## Source, API and terms

- The site runs on DataPress. Current API: `GET /api/v3/datasets/export.json` (all 1,305 public datasets in one
  response, 11 MB) and `GET /api/v3/dataset/<id>`. The CKAN-compatible `/api/action/package_search` still answers (all
  datasets in one response; `q`, `rows`, `start` are ignored); `organization_list` and `license_list` answer
  410 "Deprecated Route". `/api/3/action/*` redirects (307) to `/api/action/*`.
- Fields used: licence, topics, tags, `custom.geo` (spatial granularity), `custom.update_frequency`, created and
  updated dates, resources (file, size, timestamp, timeframe), links with their QA status.
- Terms (https://data.london.gov.uk/about/terms-and-conditions, read 2026-10-04): data may be used for any purpose;
  each dataset has its own licence; a re-user must state that **the GLA cannot warrant the quality or accuracy of the
  data**, and must not imply GLA endorsement. robots.txt disallows only `/debug`, `/manage/`, `/login`, `/logout`.
- Politeness: one request at a time, at least 1.1 s apart, backoff on 429 and 5xx, User-Agent
  `glitchcan-cwplans/0.1 (https://github.com/danbri/glitchcan-minigam)`. The walk itself is two requests; the harvest
  made 18 downloads (91 MB, including the two later dropped: Flood Risk and the 2024 LGBTQ venue list). A per-dataset detail walk (`--details`) was stopped after 186 of 1,305:
  those records added only a generic format word ("spreadsheet") and no `archivedAt`.

## Counts (triage of 1,305 datasets)

Licence class (from the dataset's licence title):

| class | datasets | allowed here |
|---|---|---|
| ogl (OGL v2 476, OGL v3 396) | 872 | yes |
| cc-by (Creative Commons Attribution) | 68 | yes, with attribution |
| public-domain (Public Domain 5, PDDL 4) | 9 | yes |
| odc-by (ODC Attribution) | 7 | yes, with attribution |
| share-alike (CC BY-SA 3, ODbL 5) | 8 | **no** (CLAUDE.md: no share-alike except OSM) |
| restricted (All Rights Reserved 13, CC Non-Commercial 2) | 15 | no |
| other (TfL Transport Data Service Licence) | 2 | not taken |
| none stated | 324 | no (until the publisher states one) |

Relevance to the zone (first rule that matches):

| class | datasets | open |
|---|---|---|
| zone-place (names a place in the model box: Isle of Dogs, Poplar, Royal Docks, Canada Water...) | 6 | 3 |
| zone-borough (names only Tower Hamlets, Southwark, Lewisham, Greenwich, Newham or the City) | 12 | 10 |
| london-fine (London-wide, finer than a borough: point, polygon, ward, LSOA, MSOA, OA, postcode, grid) | 263 | 224 |
| london-borough (borough rows only) | 362 | |
| london-coarse (London, region or coarser) | 255 | |
| other-area (names only places outside the zone) | 54 | |
| unknown (no geo field, no granularity word) | 353 | |

Relevant (zone-place, zone-borough, london-fine): **281**; open and relevant: 237; open, relevant, not sensitive and
new to the project: 202 (`meta.counts.open_relevant_new` before this commit's registrations: 215).

Kind (update frequency): periodic 509, static ("One off") 330, live (daily, hourly, realtime) 13, unknown 453.
533 datasets have no resource newer than 2020 (`stale`).

Themes (keyword rules on title and tags plus the Datastore topics; a dataset can have several): people and housing
statistics 598, buildings and places 297, environment 256, occupants and organisations 189, transport 138, events and
works 122, heritage 6.

Sensitive (catalogued, never harvested): 7 — MPS homicide dashboard, MPS custody and strip searches, two MPS stop and
search sets, LFB bariatric incidents, rough sleeping (CHAIN), suicide mortality rates.

**What the project already had** (dataset ids and slugs found in the committed files before this walk): held 2
(London Public Realm Trees 2r45m in `docklands/data/trees.json`; LBSM 2 2k55d through `tools/registry-lbsm.mjs`),
listed 45 (catalogue entries in `feeds/feeds.json`, the 2026-10-03 survey and notes; the LDD extracts are only
documented), excluded before 3 (MPS homicide, MPS custody, road casualties). After this commit: held 15. One old
reference does not resolve to a current dataset: `dataset/recorded_crime_summary` (in `feeds/feeds.json`).

## Harvested (13 datasets, new to the project)

Zone = the 3D model box (WGS84 -0.095, 51.474 to 0.015, 51.522). Whole geometries that meet the box are kept;
`whole_in_zone` and `in_cw` (meets the Canary Wharf registry box) are added. Output: GeoJSON, WGS84 (BNG through OSTN15).

| folder | dataset | licence | source features | in zone | in CW box | joins |
|---|---|---|---|---|---|---|
| `cultural-infrastructure/` | 23697 Cultural Infrastructure Map 2023 (26 venue layers) | OGL v3 | 5,256 | 662 | 13 | UPRN (599; 56 rounded, F22), ward and borough codes, address, website |
| `brownfield-register/` | 2og9g Brownfield Register (CSV points) | OGL v3 | 3,066 (167 without a point) | 229 | 6 | site reference, organisation URI, address text |
| `conservation-areas/` | emqwg Conservation Areas | OGL v3 | 1,095 | 112 | 6 | GLA layer reference, borough |
| `southwark-local-list/` | e1r5k Southwark Local List | OGL v3 | 1,242 | 599 | 0 | postcode, street, council PDF link |
| `designated-open-space/` | e195k Designated Open Space (2019 file) | OGL v3 | 5,475 | 517 | 16 | layer reference, borough |
| `site-allocations/` | 2jxpm Site Allocations | OGL v3 | 2,072 | 137 | 9 | geometry only (F23) |
| `strategic-industrial-land/` | 2y5xy SIL | OGL v3 | 148 | 14 | 0 | geometry only (F23) |
| `locally-significant-industrial-sites/` | 29z31 LSIS | OGL v3 | 324 | 8 | 1 | geometry only (F23) |
| `safeguarded-wharves/` | 2g90r Safeguarded Wharves | OGL v3 | 52 | 10 | 1 | site name, borough, direction text |
| `article4-office-residential/` | 2gy3r Article 4: office to residential (2019) | OGL v3 | 571 | 9 | 1 | layer reference, borough |
| `central-activities-zone/` | 23jxk Central Activities Zone (London Plan 2021) | OGL v3 | 1 | 1 | 0 | — |
| `air-quality-monitoring-sites/` | 23n41 Air Quality Monitoring Sites | CC BY 4.0 | 239 | 28 | 0 | site id, network |
| `lvmf-2026-consultation/` | 2gqpn LVMF 2026 consultation (paths, vistas, viewpoints) | OGL v3 | 114 | 35 | 0 | view ids |

Attribution for every file: "Contains public sector information licensed under the Open Government Licence v3.0"
(CC BY for the air quality sites) with the publisher named in `meta.attribution`, and "The GLA cannot warrant the
quality or accuracy of the data." No field was dropped (no personal contact fields in these 13).

Choices made by hand from the ranked list (also in the tool's `HARVEST` table):
- Cultural Infrastructure: the 2023 dataset's GIS file (all 26 venue types) instead of the 2025 dataset (2rj5o: no
  licence stated) or the 2024 one (2zj1y: LGBTQ venues only).
- Brownfield Register: the CSV, not the GeoPackage (F23: the GPKG has no attributes and its OBJECTID is not the CSV's).
- Flood Risk (2w4wy) was harvested once and dropped: 994 polygons with no flood zone class, all pointing to the EA
  Flood Map for Planning, which is the better source.
- Southwark's own Conservation Areas (2rjn1, ranked first) is not taken: the London-wide set (emqwg) has them.

## Ranked backlog (open, relevant, not harvested)

From `triage.json` `meta.ranked`, with why each matters and what stops it today.

| rank | dataset | why it matters | note |
|---|---|---|---|
| 1 | e55z7 Town Centre Boundaries (gpkg, 2025-12) | London Plan town centre outlines and classes in the zone | listed in feeds.json, not held; quick |
| 2 | epr7z Opportunity Areas (gpkg, 2025-12) | the Isle of Dogs and South Poplar OA outline (the OAPF area) | listed, quick |
| 3 | 2rq4w GLA High Street Boundaries (gpkg, 2025-06) | high street outlines in the zone | listed, quick |
| 4 | vqmx7 Business Improvement Districts (CC BY, shp zip, 2025-05) | BID outlines in the zone: who manages the public realm | listed; the tool's shapefile reader is ready |
| 5 | 20od9 Statistical GIS Boundary Files | ward, LSOA, MSOA, OA outlines for the joins below | ONS boundaries already held for wards; OA/LSOA would be new |
| 6 | exp5p Postcode Directory for London (csv) | postcode to OA/LSOA/ward | ONSPD already held (`postcodes/`): duplicate, low value |
| 7 | 2lw9m / e76rk 2021 Census labour market by ward and LSOA | residents' work, joins by ward and LSOA codes | statistics; take after the boundaries |
| 8 | 2wwq4 2024-based housing-led population projections by ward (ODC-By) | the zone's expected growth by ward | attribution licence |
| 9 | 29j4y London Schools Atlas | pupil flows by school | GIAS already gives the schools; atlas adds catchments |
| 10 | 2w4xy / e56xw UKPN proposed and open streetworks (CC BY, live) | utility works in the zone | links only (UKPN portal, API key); overlaps Street Manager in `feeds/works/` |
| 11 | 2468x UKPN live power cuts (CC BY, live) | outages by postcode sector | UKPN portal API |
| 12 | v8onw / vdjx4 / vd455 ULEZ boundaries (gpkg) | the zone is inside every ULEZ stage | low value: the whole zone is in |
| 13 | vdjql Areas of Intensification (gpkg) | London Plan intensification areas | check whether any meet the zone |
| 14 | 2lzpg Electric Vehicle Charging Site (CC BY, 2019) | rapid charge points | old; the national chargepoint register is better |
| 15 | 2ogw5 London Heat Map 2024 building heat demand (zip 80 MB) | heat demand per building (UPRN/TOID) | listed; large; next for buildings |
| 16 | vdxyl London Solar Opportunity Map by TOID (csv 264 MB) | roof solar potential per building TOID | listed; large; clip by TOID list from OS Open UPRN |
| 17 | 2ko88 / 2zj1y Cultural Infrastructure Map (2019 publication, 2024) | pubs (2ko88 `Pubs.csv`), skate parks, community centres not in the 2023 set | take `Pubs.csv` and `Community_centres` next |
| 18 | e6w0w Plot ratios in industrial developments | building densities on industrial land | 2018 |
| 19 | 2zwnk Noise Pollution in London (Defra, 2018) | road and rail noise contours | old; Defra strategic noise maps 2022 are newer |
| 20 | 2489z Land use by borough and ward | land use shares per ward | 2018 |

Zone-specific but no licence stated (not taken; ask the GLA): 20pw9 and 2j0n0 Isle of Dogs and South Poplar OAPF,
2gq0r Listed Buildings in Southwark, 2z18q Canada Water Masterplan hearing documents, vd43m Tower Hamlets waste
strategy. 2rj5o Cultural Infrastructure Map 2025 (the newest venue list) also states no licence.

## Gaps

- Relevance is decided from metadata (title, tags, geo field, formats), not by opening every file: the 353 "unknown"
  datasets were not opened. A dataset can cover the zone and still be ranked low.
- The theme rules are keyword lists; topics add themes broadly (every "planning" dataset counts as buildings and
  places). Read the reasons before trusting a rank.
- 324 datasets state no licence. Several are GLA documents that are probably OGL; they stay out until the GLA says so.
- Links-only datasets (UKPN, TfL live feeds) need the publisher's own API; not followed.
- Geometry-only GeoPackages (F23): site allocations, SIL and LSIS have no names or references. The GLA Planning Data
  Map ArcGIS service that holds the attributes answered 403 to the container (2026-10-04).
