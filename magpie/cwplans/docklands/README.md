# Docklands: London Bridge to Cody Dock

Live page: https://danbri.github.io/glitchcan-minigam/magpie/cwplans/docklands/
Canada Water corridor (the first, smaller model): https://danbri.github.io/glitchcan-minigam/magpie/cwplans/

A 3D model of the Thames from London Bridge to Cody Dock and from Limehouse to Greenwich, with the most detail at Canary Wharf, above and below ground. It is built from open data only. The page also loads live readings on request (tides, weather, air quality, line status, storm overflows, traffic cameras).

## Files

| file | what it is |
|---|---|
| `index.html` | the page: WebGL view, cut-away, floors, underground detail, live panel, text table of what is below ground |
| `data/area.js` | terrain, water, greens, 41,803 buildings, railways, roads, tunnels, places (5.4 MB, about 1.6 MB gzipped) |
| `data/under.js` | basements, indoor ways, points with a level, published structures |
| `facts.json`, `FACTS.md` | 360 cited facts about station depths, tunnels, towers, docks and ground, each with a quote from the page it came from |
| `vendor/earcut.min.js` | polygon triangulation in the browser (earcut, ISC licence, `vendor/earcut.LICENSE`) |
| `../data/sourced-levels.json` | the published levels the model uses (a hand-picked subset of `facts.json`) |
| `../feeds/` | 200 checked data sources and APIs for the area |
| `../tools/fetch-docklands.mjs`, `osm-clip-docklands.mjs`, `build-docklands.mjs`, `lib.mjs` | the pipeline |

Rebuild (raw files are not committed except the Wikidata snapshots):

    node magpie/cwplans/tools/fetch-raw.mjs grid                               # OSTN15 grid
    node magpie/cwplans/tools/fetch-docklands.mjs                              # OSM extract (150 MB), 96 LiDAR tiles, Wikidata
    node --max-old-space-size=6000 magpie/cwplans/tools/osm-clip-docklands.mjs  # about 1 minute
    node --max-old-space-size=8000 magpie/cwplans/tools/build-docklands.mjs     # about 30 seconds

## Area and coordinates

- Box: WGS84 −0.0950, 51.4740 to 0.0150, 51.5220; BNG E 532400–539900, N 176700–182300 (7.5 × 5.6 km).
- Local metres: x = E − 537550, z = −(N − 180300) (One Canada Square is near 0, 0; north is −z); y = metres above Ordnance Datum Newlyn.
- WGS84 → BNG through the OS OSTN15 grid. For live points the page uses a quadratic fit to that transform; its largest error over the box is 0.03 m.

## Sources and licences

| layer | source | licence |
|---|---|---|
| buildings, parts, water, greens, roads, railways, tunnels, indoor ways, stations, points with a level | OpenStreetMap, Greater London extract from download.openstreetmap.fr (2026-10-02) | ODbL 1.0, © OpenStreetMap contributors |
| ground (DTM) and surface (first-return DSM), 1 m | Environment Agency LiDAR Composite, WCS, 48 tiles of 1 km | Open Government Licence v3.0 |
| names, descriptions, heights, floors above and below ground | Wikidata SPARQL, items in the box | CC0 |
| published levels | see `../data/sourced-levels.json`: Wikipedia, Crossrail Learning Legacy (Arup paper), Canal & River Trust, Architects' Journal | each value is quoted with its URL |
| live panel | EA flood-monitoring API, Open-Meteo, London Air Quality Network, TfL Unified API, Thames Water storm overflow feed (ArcGIS) | see `../feeds/feeds.json` for each licence |

Geofabrik and Overpass were unreachable from the build container, so the OSM data comes from the openstreetmap.fr extract.

## What is measured, what is published, what is assumed

- Ground: LiDAR DTM, 7 × 7 m medians every 20 m.
- Building heights: the 90th percentile of DSM − DTM inside the footprint (39,415 buildings). An OSM `height` tag wins (1,917). OSM `building:levels` × 3 m + 1 m is used when the LiDAR has too few cells (163), or when the LiDAR shows less than half that height (61, shown amber). The second case means the building is newer than the LiDAR pass; these are spread over the area, with one group at Wood Wharf (Harcourt Tower and its neighbours) and others such as 40 Charter Street. 247 buildings have no data and get 6 m. Outlines with OSM building parts are drawn by their parts (772), using each part's `min_height`.
- Floors (Canary Wharf box): 676 buildings with an OSM `building:levels` or a Wikidata "floors above ground" value. The page spaces the rings evenly from base to roof, so the rings show the count, not the real floor heights.
- Water: OSM areas at the 25th percentile of the LiDAR inside them. The impounded docks come out at 3.3–4.2 m OD. The Canal & River Trust full impound level for West India and Millwall Docks is 4.23 m OD, which agrees. The tidal Thames is one tide state (about 2–3 m OD in the LiDAR pass). The live panel can redraw it at the current Tower Pier gauge level.
- Basements (102): OSM `building:levels:underground`, else Wikidata "floors below ground" (for example 8 Canada Square 4, Newfoundland 3, One Park Drive 2). Depth = storeys × the storey-height setting (default 4 m). This is an assumption, not a measurement.
- Indoor and underground detail (2,184 ways, 903 points): OSM features with a `level` tag, drawn at ground + level × storey height. At Canary Wharf this is the malls (levels −1 and −2), the Jubilee line platforms (−3) and steps and corridors down to −4. An OSM level is an index, not a height, so these positions are approximate.
- Open track and roads: OSM geometry at the LiDAR level (DSM on bridges and viaducts). Where the DLR viaduct runs under a station roof or a building, the DSM sees the roof: within 120 m of Canary Wharf DLR station the drawn track ranges from 8.1 to 41.1 m OD. No source for the viaduct height was found, so this is not corrected.
- Tunnels (572 chains): OSM tunnel ways joined between portals. The level is known at three kinds of control:
  - portals: the LiDAR level of the open track or road at the tunnel mouth
  - open cuts and shafts: points where the LiDAR ground is more than 6 m below its surroundings
  - published station levels from `../data/sourced-levels.json`:

    | place | level | source |
    |---|---|---|
    | Canada Water, East London line platforms | −5.6 m OD (11 m below ground) | Wikipedia |
    | Canada Water, Jubilee line platforms | −16.6 m OD (22 m below ground) | Wikipedia |
    | Canary Wharf, Elizabeth line platforms | −18.05 m OD | Arup paper, Figure 6 |
    | North Greenwich, Jubilee trains | about −19.7 m OD (25 m below ground) | Architects' Journal |
    | Cutty Sark, DLR platforms | −15.6 m OD (20 m below ground) | Wikipedia |

  Between two controls the track follows the straight line between them and dips by at most the "dip" setting, limited by the gradient setting. A chain with one published level and no other control stays flat at that level. A chain with no control lies at the "no measured point" depth below ground. These are model settings, shown in the page under "Model settings (assumptions)".
- Published structures: the eight Crossrail Place slab levels (Arup paper, Figure 6: platform −18.05 m OD, base slab −20.40 m OD, roof garden +17.10 m OD). The paper gives levels in mATD; the conversion OD = mATD − 100 m is inferred from the dock water level in the same figure (104.300), which matches the Canal & River Trust 4.23 m OD. North Dock is drawn as a water volume from its bed (−5.365 m OD, Canal & River Trust) to the full impound level.

## Known gaps

From `FACTS.md`, not found in any source fetched:
- the height of the DLR viaduct at Canary Wharf, Heron Quays and West India Quay
- platform depths at Wapping, Rotherhithe, Canning Town and Island Gardens
- depths of the Blackwall Tunnel and of the Jubilee line under the Thames
- the levels of the Canada Place, Cabot Place and Churchill Place malls, and the service roads under the estate
- present water depths of docks other than North Dock
- a numeric ground log at Canary Wharf itself

The model also has these limits:
- The Jubilee line pit at Canary Wharf ("24 m deep", Wikipedia) has no stated reference level, so it is not used as a control.
- The Thames Tunnel and Rotherhithe Tunnel depths are given relative to high water, and no high-water level is sourced here, so they are not used.

## Live panel

The live panel sends no request until the visitor presses "Load live data". Each source sends CORS headers and needs no key (checked 2026-10-02, see `../feeds/feeds.json`):

- EA tide gauges 0007 Tower Pier and 0001 Silvertown (15-minute readings, m AOD)
- Open-Meteo current weather at Canary Wharf
- London Air Quality Network site TH4, Tower Hamlets – Blackwall
- TfL line status: Jubilee, DLR, Elizabeth line, Windrush, London Cable Car
- the Thames Water storm overflow feed for the box. The page reads status 1 as discharging, 0 as not discharging and −1 as offline.
- TfL JamCam traffic cameras in the box, shown as "cam" markers. Their stills are published by TfL for public viewing.

The feeds catalogue lists only official or openly licensed sources, and cameras that their owners publish. Its "excluded" section gives what was left out and why: directories of unsecured private cameras, people-search and face-recognition sites, personal social media, and records that name private individuals.
