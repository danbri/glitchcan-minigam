---
name: cwplans-londat-cache
description: >-
  The cache of magpie/cwplans in the danbri/londat repository: an append-only SQLite history of live state in the
  Docklands zone (cwplans/cache/live-YYYY-MM.sqlite, one file per UTC month: Santander Cycles docks, lift outages,
  station crowding, UK Power Networks power cuts, Thames Water storm overflows, NOTAM cranes and areas, AIS vessels
  without small private craft, EA tide and river levels, TfL line status, river-bus arrival counts, Open-Meteo weather,
  plus sources and runs tables), the compact cwplans/cache/latest.json ("latest + last 24 h" per theme) that the atlas
  and the 3D page read before any third-party API (live-cache.js, CwLive), and cwplans/cache/zone.gpkg, an OGC
  GeoPackage of 163 static zone layers for QGIS and GDAL (3D model buildings with heights and cwb- ids, water, greens,
  roads, flood defences, registry buildings, construction sites, river points, every London Datastore and portal
  GeoJSON) with the licence of each layer in gpkg_contents. Covers the tools tools/cache-londat.mjs and
  tools/build-zone-gpkg.mjs, the schema, the hourly GitHub Actions workflow in londat (.github/workflows/cache-live.yml),
  sizes and git growth measured, why JSON and not sql.js-httpvfs for the pages, the request counts before and after,
  the register rule for a monthly file family (cache/live-*.sqlite), and how to validate and open zone.gpkg. Reach for
  it before you add a theme to the cache, change the pages' live panels, rebuild zone.gpkg, or answer "do we keep a
  history of X?" or "can I open this in QGIS?".
---

# The londat cache (cwplans)

Owner, 2026-10-05: "Now we have londata repo are we caching more fetches there and preloading? If not, we should!
Sqlite files would be a simple start. Keep trying". This skill is the answer. Rules of londat itself (what moves there,
the register, `tools/londat.mjs`, `data-base.js`): skill `docklands-data-curation`, "Data hosted in danbri/londat".

## What is where

| file (londat) | what | written by | refresh |
|---|---|---|---|
| https://github.com/danbri/londat/blob/main/cwplans/cache/live-2026-10.sqlite (`cache/live-*.sqlite`) | append-only history, one file per UTC month | `tools/cache-londat.mjs` | hourly (workflow) |
| https://github.com/danbri/londat/blob/main/cwplans/cache/latest.json | newest fetch per theme + 24 h series | `tools/cache-londat.mjs` | each run |
| https://github.com/danbri/londat/blob/main/cwplans/cache/zone.gpkg | 163 GIS layers, GeoPackage | `tools/build-zone-gpkg.mjs` | by hand, when an input changes |
| https://github.com/danbri/londat/blob/main/.github/workflows/cache-live.yml | the hourly job | by hand | - |

Pages read `latest.json` at `https://raw.githubusercontent.com/danbri/londat/main/cwplans/cache/latest.json`
(`CwData.url('cache/latest.json')`; `data-base.js` treats `cache/` as hosted).

## Commands

    NODE_USE_ENV_PROXY=1 LONDAT_DIR=/home/user/londat node magpie/cwplans/tools/cache-londat.mjs        # fetch + append (about 6 min)
    LONDAT_DIR=/home/user/londat node magpie/cwplans/tools/cache-londat.mjs --no-fetch                  # append the snapshots in this checkout
    options: --themes=bikes,tide,...  --dry  --vacuum (when a month is closed)
    LONDAT_DIR=/home/user/londat node magpie/cwplans/tools/build-zone-gpkg.mjs [--core]                 # needs ogr2ogr (apt-get install -y gdal-bin)
    python3.12 /usr/lib/python3/dist-packages/osgeo_utils/samples/validate_gpkg.py /home/user/londat/cwplans/cache/zone.gpkg

`cache-londat.mjs` runs `fetch-live.mjs bikes lifts crowding ukpn overflows notams`, `fetch-river.mjs levels river-bus`
and `fetch-ais.mjs --listen=0` as child processes (their politeness unchanged), then asks two endpoints itself: TfL
`/Line/Mode/tube,dlr,elizabeth-line,overground,river-bus,cable-car/Status` and Open-Meteo `current=` (one request
each, saved in `data/raw/cache/`, gitignored). The fetch tools rewrite their snapshot files in the checkout as always:
in a working copy of the main repository, `git checkout -- magpie/cwplans/feeds/` afterwards unless you mean to commit
fresh snapshots. About 120 requests per run; the crowding loop (65 stations, 1.5 s apart) is most of the 6 minutes.

## Database: node:sqlite

Node 22.22 has `node:sqlite` without a flag (it prints an ExperimentalWarning; the tool removes the warning listener
before the import). No npm dependency, so the workflow needs only the three libraries the fetch tools import (proj4,
geotiff, earcut). SQLite 3.50. `better-sqlite3` was not needed.

## Schema (schema version 1, table `meta`)

Times are Unix seconds, UTC. `fetch_time` is the snapshot's own `meta.fetched`, so a second run on the same snapshot
adds nothing (`INSERT OR IGNORE`; all state tables are `WITHOUT ROWID` with that key).

| table | key | columns |
|---|---|---|
| `sources` | theme | register_key, url, licence, attribution, politeness, review |
| `runs` | run_id | started, finished, tool, mode, counts (JSON), errors (JSON), bytes_before, bytes_after |
| `places` | id | kind, name, lat, lon, zone (docks, stations, overflows, piers, gauges; updated in place) |
| `bikes` | fetch_time, id | bikes, e_bikes, empty_docks, docks, unavailable_docks, locked |
| `lifts`, `lifts_fetches` | fetch_time, id / fetch_time | lifts_out, lift_ids / stations_out (a fetch with no outage still has a row) |
| `crowding` | fetch_time, id | time, pct_baseline |
| `power_cuts`, `power_cut_fetches` | fetch_time, id / fetch_time | type, status_id, customers, created, estimated_restoration, restored, postcode_sectors, lat, lon / network_incidents, in_zone |
| `overflows` | fetch_time, id | status (1, 0, -1), status_start, latest_event_start, latest_event_end |
| `notams` | fetch_time, id | kind, name, lat, lon, height_agl_ft, height_amsl_ft, start, end_time, crane, lit, area (facts only) |
| `ais_positions` | mmsi, time | fetch_time, lat, lon, sog_kn, cog, heading, nav_status, source, licence_class |
| `ais_vessels` | mmsi | name, callsign, imo, ship_type, ship_type_group, class, flag, length_m, beam_m, first_seen, last_seen |
| `ais_fetches` | fetch_time | vessels_listed, private_counted, dropped_licence, by_source |
| `tide` | station, time | value (15-minute EA readings; each run brings 48 h, each reading stored once) |
| `line_status` | fetch_time, line_id, severity | status, reason (300 characters at most) |
| `river_bus` | fetch_time, pier_id, line_id | arrivals, next_s (counts of predictions, not each prediction) |
| `weather` | time | fetch_time, temp_c, humidity_pct, wind_kmh, gust_kmh, wind_dir, cloud_pct, precip_mm, weather_code |

Rules: small private craft are never listed (the `fetch-ais.mjs` rule is repeated in the tool: ITU 36/37 and class B
without a type are dropped; their count is `ais_fetches.private_counted`). No NOTAM text, no UK Power Networks letter
text, no JamCam images. A run goes into the month of its newest snapshot, so tide readings within 48 h of a month
boundary can be in two files. Not cached, on purpose: LAQN air quality (no open licence found; the pages still ask it on
request), police.uk crime (monthly), JamCam stills (TfL serves them), the helicopter structure (static).

Example: `SELECT datetime(fetch_time,'unixepoch') t, sum(bikes) FROM bikes GROUP BY fetch_time;`

## Sizes and growth (measured 2026-10-05)

- First file: 565 kB after two runs (the 4 October snapshots replayed with `--no-fetch`, and one live run). The first
  run of each kind adds 2,000 to 3,000 tide rows (48 h); later runs add about 350 rows.
- 48 simulated hourly runs (the real rows repeated with new times): about 22 kB per run, so about 0.5 MB a day and
  16 MB a month per file. In git, with one commit per run, the 48 versions packed to 683 kB in all (`git gc
  --aggressive`): SQLite appends change few pages, so deltas are small. Do not VACUUM each run: it rewrites pages and
  spoils the deltas. Expected londat growth: about 10 MB a month for the SQLite and a few MB for `latest.json`.
- Not git LFS: raw.githubusercontent.com serves the pointer, not the file, and the free quota is 1 GB.
- `latest.json`: 46 kB, 13 kB gzipped.
- `zone.gpkg`: 67.9 MB, 163 layers (17 from the main repository, 146 London Datastore and portal GeoJSON). GitHub warns
  above 50 MB and refuses above 100 MB. Each rebuild adds about 65 MB to londat history: rebuild only when an input
  changes. `--core` (the 17 main-repository layers) is 16.9 MB if a split is ever needed.

## Pages: JSON, not sql.js-httpvfs

Decision with numbers: `latest.json` is one request of 13 kB gzipped. sql.js-httpvfs would need its worker and the
sql.js WebAssembly (about 1 MB) and several 4 kB range requests per query, for data a page shows as one line. The
SQLite is for analysis (QGIS, Python, a notebook), not for page loads.

`live-cache.js` (`CwLive`) is loaded after `data-base.js` by the atlas and the 3D page. `CwLive.pick(theme, fromCache,
live, direct)` uses the cache unless the visitor ticks "Live" (3D page: `#liveDirect`; atlas: `[data-direct]` in each
live panel) or the theme is older than 60 minutes; each line says "(londat cache, fetched …)" or "(live from the source:
reason)". Cached: tide (Tower Pier 0007, Silvertown 0001), weather, line status (Jubilee, DLR, Elizabeth, Windrush,
cable car), storm overflows (filtered to the model box as the live query). The 3D page's camera markers come from the
committed `feeds/live/jamcams.json` unless Live is ticked (106 cameras in the box from the snapshot, 116 from TfL's
4.5 km radius query on 2026-10-05). Air quality is always live (not cached).

Requests measured headless (Playwright, 2026-10-05), pressing "Load live data":

| page | before (and with Live ticked) | after (default) |
|---|---|---|
| 3D page, 1600 x 900 DPR 1 and 390 x 844 DPR 3 | 7 third-party (EA 2, Open-Meteo, LAQN, TfL 2, ArcGIS) | 2 (raw.githubusercontent.com 1, LAQN 1) |
| atlas | 6 (EA 2, Open-Meteo, LAQN, TfL, ArcGIS) | 2 (raw.githubusercontent.com 1, LAQN 1) |

At page load nothing changed: the atlas asks no third party; the 3D page asks only Open Waters AIS (the ships layer,
on by default by the owner's decision of 2026-10-04, polling every 60 s; not touched). No console errors at either size.
In the container, Open-Meteo sometimes fails CORS through the proxy with Live ticked: an environment fault, not the page.

## Scheduling

`.github/workflows/cache-live.yml` in londat: cron `17 * * * *` and `workflow_dispatch`; sparse checkout of
`magpie/cwplans/tools`, `feeds/live`, `feeds/river` and `data-register.json` from glitchcan-minigam master (verified to
be enough by running the tools in such a checkout), `npm install` of proj4, geotiff and earcut, the tool, then a commit
of `cache/live-*.sqlite` and `cache/latest.json` with three pull-rebase-push tries; `concurrency` stops overlap. The
session could push the workflow file to londat (2026-10-05) but could not start it by API (403 "Resource not accessible
by integration"): the first run is the first cron after the push. Check the Actions tab of londat. A Claude Routine is
not used for this.

## Register

- `data-register.json` has hosted entries for `cache/live-*.sqlite` (a family: `check-data-register.mjs` matches a `*`
  in the file name against the londat folder and needs at least one file; a new month needs no edit), `cache/latest.json`
  and `cache/zone.gpkg` (osm use "derived"; 177 sources, the union of its inputs). AIS rows carry the AIS review note.
- `pipeline.json` activities `cache-londat` and `build-zone-gpkg` (area feeds).
- `tools/londat.mjs` `HOSTED_DIRS` includes `cache/`; `data-base.js` treats `cache/` as hosted.
- Run `LONDAT_DIR=/home/user/londat node magpie/cwplans/tools/check-data-register.mjs --write` and read the exit code.

## zone.gpkg in QGIS and GDAL

QGIS: Layer > Add Layer > Add Vector Layer, choose the file (or drag it into the window), pick layers. `model_*`
layers are EPSG:27700 (British National Grid; area.js x = E - 537550, z = -(N - 180300)); the others EPSG:4326; London
Datastore and portal layers keep the CRS of their GeoJSON. Licence and attribution per layer: Layer Properties >
Information (the gpkg_contents description, written from the register; ODbL first where the file uses OSM), and the
attribute table `layer_licences`. GDAL: `ogrinfo -so zone.gpkg model_buildings`. R-tree indexes on all 162 spatial
layers.

Traps found while building it:
- area.js tunnels have `pts` ([x, z, y, along, …]) and no `q`.
- GDAL's `/vsigzip/` writes a `.properties` sidecar next to each `.gz` it reads (six appeared in londat and failed the
  register check): the tool sets `CPL_VSIL_GZIP_WRITE_PROPERTIES=NO`.
- `validate_gpkg.py` Req 152: 59 empty geometries in `portal_pdg_flood_risk_zone` without the empty flag; the tool sets
  empty geometries to NULL and keeps their attributes. The system `python3` has no working GDAL bindings; `python3.12`
  has.
- A `file://` clone ignores `--filter=blob:none`: a test clone of glitchcan-minigam took 1.1 GB of a 1.4 GB free disk.
  Test sparse checkouts with `git worktree add --no-checkout` instead.
