---
name: cwplans-river-and-water
description: >-
  The river, docks, locks, water quality and boats of the magpie/cwplans Docklands zone (the Thames from London Bridge
  to the Royal Docks, West India, Millwall, Greenland, South and Royal Docks, Limehouse Basin, Bow Creek and the Lea,
  Deptford Creek and the Ravensbourne), as dated snapshots in feeds/river/ made by tools/fetch-river.mjs: PLA Notices to
  Mariners (harbourmaster, from the PLA ArcGIS layer NtMs_Live because pla.co.uk blocks scripts), Canal & River Trust
  stoppage notices (the JSON endpoint behind the notices page), Thames Barrier planned test closures (GOV.UK, OGL), EA
  flood warnings, EA tide and river levels (Thames gauges, barrier DIFF stations, Lee and Ravensbourne), tidal lock
  rules (Limehouse, West India Dock Entrance, Bow, South Dock) with OSM positions, swim-water results for Eden Dock (Sea
  Lanes Canary Wharf) and the Royal Docks (RoDMA PDF certificate), EA continuous sondes and the Water Quality Archive,
  TfL river buses (routes, timetables, live arrival predictions), OSM moorings, houseboats and ships, PLA visitor
  moorings, and Wikidata vessels. Licences per source, the facts-only rule for PLA and CRT, why there is no open live
  AIS, and the traps (time-stamped URLs and --no-fetch, minute-level DIFF readings, a sonde with impossible values F24,
  two CRT pages that disagree on the West India lock window, a certificate that misnames King George V Dock). Reach for
  it before you refresh or add a river or water source, show boats, locks, notices or swim-water status on the 3D page,
  or answer "can I swim in the dock today?", "is the lock open?" or "what ships are on the river?".
---

# River, docks and water for magpie/cwplans

Policy, the fault register and the activity log are in the hub skill `docklands-data-curation`
(`magpie/cwplans/skills/docklands-data-curation/`). Append what you did to its `ACTIVITY-LOG.md`. Sources, counts and
rejected sources as a table: `magpie/cwplans/feeds/river/README.md`
(https://github.com/danbri/glitchcan-minigam/blob/master/magpie/cwplans/feeds/river/README.md). Written 2026-10-04.

## Run

    NODE_USE_ENV_PROXY=1 node magpie/cwplans/tools/fetch-river.mjs              # all 14 sources, about 6 minutes
    NODE_USE_ENV_PROXY=1 node magpie/cwplans/tools/fetch-river.mjs crt-notices locks   # locks reads crt-notices.json: run it after
    node magpie/cwplans/tools/fetch-river.mjs --no-fetch                        # rebuild every file from data/raw/river/
    node magpie/cwplans/tools/fetch-river.mjs --list

Needs `osmium` (installed) and `pdftotext` (`apt-get install -y poppler-utils`; it was missing in a fresh container),
and the local OSM extract `data/raw/docklands/greater_london-latest.osm.pbf` (`tools/fetch-docklands.mjs osm`).
Without `NODE_USE_ENV_PROXY=1`, Node fetch ignores the proxy here. Politeness: one request at a time per host, at least
1.1 s apart, up to 5 tries with Retry-After or a doubling pause on 429, 5xx, timeouts and resets; QLever through
`tools/lib.mjs` `qlever()`. The raw cache is `data/raw/river/<source>/` (gitignored: the `.gitignore` line was lost once
when another working copy rewrote the file; append, never replace, and check `git diff` before committing it).

## Licence rules used

| class | sources | what is kept |
|---|---|---|
| open (OGL, CC0, TfL terms) | EA flood-monitoring, EA hydrology, EA Water Quality Archive, GOV.UK Thames Barrier page, TfL, Wikidata | values as published |
| ODbL (allowed, tracked) | OSM | element id, centroid, a short tag list |
| licence not stated | PLA ArcGIS layers (NtMs_Live, Visitor Moorings) | facts and links only: notice number, title, dates, reach, closure flag, issuer role, centroid and bbox. Not kept: notice text, polygons, internal comments, invoice references, staff names, contact numbers and e-mails |
| © publisher, no open licence | CRT notices, CRT and Southwark lock pages, Sea Lanes results, RoDMA certificate | facts with the URL and fetch date (crawl for scoping, owner 2026-10-03). Lock rules are paraphrased by hand into `locks-facts.json`, never copied |
| not allowed | Global Fishing Watch (CC BY-NC), MarineTraffic, VesselFinder, OpenSeaMap tiles (CC BY-SA), CRT ArcGIS layers (no commercial use) | nothing fetched or committed |

## Methods, source by source

- **PLA notices.** `https://maps.pla.co.uk/server/rest/services/Hosted/NtMs_Live/FeatureServer/0/query` with the zone
  envelope. The `name` field can hold a placeholder ("M##-25"): the notice number comes from the `link`. `kind` is a
  keyword class of the title. A polygon wider than 0.3 degrees is "portwide" (Tidal Thames fish surveys, the Medway mast
  removal, tide-table corrections): show those as a list, not on the map. The layer holds only current notices; there is
  no archive.
- **CRT notices.** `https://canalrivertrust.org.uk/api/stoppage/notices?consult=false&start=..&end=..&fields=..&geometry=point`
  returns all of England and Wales (1,076 notices for a 300-day window) as GeoJSON points. Found by watching the notices
  page's own requests in headless Chromium after "Apply filters" (the page renders no list until then; the endpoint is
  in no static bundle). Type and reason ids are mapped with the lookups embedded in the page on 2026-10-04: re-check them
  if a new id appears. Keep a notice when one of its points is in the zone.
- **Thames Barrier.** GOV.UK content API `/api/content/guidance/the-thames-barrier`: the HTML table of planned tests in
  `details.body`, times converted from London time with the BST/GMT offset of the day. The page says gates may move up
  to an hour early and tests can be cancelled. No feed of flood-defence closures exists; the live signal is the DIFF_*
  stations in `levels.json` (upstream minus downstream level).
- **Levels.** EA flood-monitoring `/id/stations/{id}` and `/id/stations/{id}/readings?since=..&_sorted&_limit=10000`.
  The DIFF_* stations publish about once a minute: the first reading in each 15-minute slot is kept (a 600 kB file became
  130 kB). Stations list measures that publish nothing (Tower Pier and Westminster each list a second "Tidal Level"):
  skip measures with no readings. Tower Pier reads wrong around low water (fault F21): clean as `docklands/sky.js` does
  before drawing a water surface from it.
- **Locks.** `feeds/river/locks-facts.json` is hand-written: windows as hours either side of HW or LW at a named place,
  hours by season or weekday, booking rules, the source URL and the date read. The tool adds the OSM centroid, the CRT
  notices whose title or waterway matches `crt_match`, and an HTTP check of each cited page.
  CRT's two pages disagree on the West India Dock Entrance Lock: "3 hours either side of HW North Woolwich, book seven
  days ahead" (Locks to the River Thames, edited 22 September 2026) and "1 hour either side of HW London Bridge (minus
  about 20 minutes)" (Boating London Docklands). Both are kept, the newer page first (class: attribute conflict).
- **Eden Dock.** The table `wq-readings-table` on https://sealanescanarywharf.co.uk/water-quality/ (date, rating, E. coli,
  intestinal enterococci in cfu/100 ml; four rows on 2026-10-04) and the `weather-item-value` before "Water Temperature"
  on the Swimming page. The page does not say when the temperature was measured: it is stamped with the fetch time.
  Position: OSM relation 18985240 (Eden Dock). canarywharf.com is behind an Imperva challenge; the Sea Lanes site is not.
- **Royal Docks.** The PDF linked as "Water Quality Testing Results" on https://royaldockswaterways.com/impact-responsibility/documents/
  (Royal Docks Waterways, formerly londonsroyaldocks.com, which now redirects). `pdftotext -layout` for the per-sample
  values; `-raw` for the cyanobacteria rows, whose layout splits the numbers across lines. The two numbers per taxon
  are kept as printed (`colonies_ml`, `result_as_printed`): the result is often colonies x size class (48 x 50 = 2400)
  but not always (Oscillatoria 50 and 50), so it is not called cells/ml. The sample pages say "Royal George V Dock";
  the overview and OSM say King George V Dock: mapped by `DOCK_ALIAS`, the written form kept. Positions are the west or
  east fifth of the OSM dock polygon: approximate, and labelled so.
- **EA sondes.** Hydrology API, stations CADOG2 (Cadogan Pier), BARIERA (Thames Barrier Gardens Pier), ERITH1 (Erith),
  every measure from two days back. No sonde lies in the zone box. BARIERA's ammonium (about 210 mg/L), pH (5.25) and
  turbidity (-93.6 NTU) on 2026-10-04 are impossible for the estuary: flagged in `values.suspect` by the `SUSPECT` rules
  (fault F24), never changed.
- **EA Water Quality Archive.** `sampling-point?latitude&longitude&radius(km)&limit<=250&skip` needs
  `Accept: application/ld+json` (plain JSON gets 404) and refuses limit over 250. Three radius searches cover the zone;
  points are BNG, converted with a Helmert transform (about 5 m). Observations come oldest first: read `totalItems`, then
  the last 60 with `skip`.
- **River buses.** TfL `Line/Mode/river-bus` (rb1, rb4, rb6, woolwich-ferry), `Route/Sequence/{dir}` (longest
  sequence, first line string), `Timetable/{first zone pier}?direction=` (departures plus minutes to later piers per
  interval set; without `direction` it returns a disambiguation list), and `Line/{ids}/Arrivals` (one request for all
  lines). TfL gives no positions; place a boat by its predicted arrival and the route line. Planned river-bus closures
  are in `feeds/works/tfl-lines.json`.
- **OSM.** `osmium extract -b` the zone envelope, `tags-filter` (moorings, marinas, slipways, piers, docks, lock gates,
  locks, ferry terminals, houseboats, ships, wrecks, movable bridges, seamarks), `export -f geojsonseq`. osmium exports
  some closed ways twice: dedupe by type/id (785 rows became 632). Houseboat names are boat names, not people.
- **Wikidata vessels.** One QLever query: P31 subclass of watercraft (Q1229765) with P625 in the envelope. P625 can be a
  former berth: say so where shown.

## AIS: why there is no live vessel layer

No open, licensed, browser-usable live AIS exists for the Thames. aisstream.io needs a key (GitHub sign-in), forbids
browser connections and states no data licence; AISHub needs a contributed receiver; Global Fishing Watch is CC BY-NC;
MarineTraffic and VesselFinder are proprietary. If the owner supplies an aisstream key and accepts its terms, the route
is a small server (or a scheduled fetch) that subscribes with the zone bounding box and writes positions as facts; ship
names and MMSI of commercial vessels are public broadcasts, but small private craft can identify their owners: treat
those like personal data under the cwplans exception and do not show them outside scoping.

## Priority list: AIS sources named by the owner (2026-10-04)

The owner asked for these on the priority list. The notes are the owner's summary plus how each fits this project;
verify the terms and the coverage at the source before any fetch, and record the result here.

1. **Open Waters AIS** (https://openwaters.io/ais/). First to check. Real-time stream (WebSocket, SSE, NMEA) and
   GeoJSON snapshots for a bounding box; code MIT; data re-served under each source's own terms, with the source named
   on every event. To check: (a) coverage of the zone bounding box (the Thames needs UK receivers, so probably the
   volunteer network or AISHub/aisstream, not the Norwegian or Finnish sources); (b) the terms page and the free-tier
   rate and area limits; (c) whether the per-event source field lets us keep only events whose own terms are open.
   Licence fit: volunteer receptions CC0 (allowed); the volunteer aggregate ODbL (share-alike: OSM is the only
   share-alike source allowed without the owner's agreement, so ask first, as for adsb.lol); events from AISHub or
   aisstream (no formal open terms: not kept). Small private craft can identify their owners: treat as personal data
   under the cwplans exception, scoping only.
2. **Kystverket / BarentsWatch** (Norwegian Coastal Administration). NLOD 2.0, open, attribution, no registration for
   the open tier; raw TCP stream, APIs, history in Kystdatahuset. Licence fit: allowed. Coverage: Norwegian waters only,
   so no Thames positions. Use: a test stream for the AIS pipeline (decode, filter by box, write facts), and the
   Norwegian legs of ships that also call at London (match by MMSI), if that is wanted.
3. **US Marine Cadastre / NOAA** (https://marinecadastre.gov/ais/). US government work, public domain in the US;
   historical bulk files (GeoParquet) and AccessAIS extracts. Licence fit: allowed. Coverage: US waters only. Use: a
   reference for file formats, vessel-type codes and track cleaning methods; no zone data.
4. **Global Fishing Watch APIs**. Processed AIS products (fishing effort, presence, vessel identity); free for
   non-commercial use (CC BY-NC style), key required. Licence fit: non-commercial is a restricted licence, which the
   cwplans licence limit excludes; needs the owner's decision before any use. Coverage: global, but aimed at fishing.

## Tower Bridge lift times: not fetched (terms, 2026-10-04)

https://www.towerbridge.org.uk/lift-times redirects to https://www.towerbridge.org.uk/bridge-lifts (date, time,
vessel name, vessel type, direction; about 6 to 10 days ahead, past lifts removed). robots.txt answers 404 (no rules).
The site's Legal statement (https://www.towerbridge.org.uk/legal/legal-statement, City Bridge Foundation) forbids it:
clause 2.5 "You shall not conduct, facilitate, authorise or permit any text or data mining or web scraping" (any robot,
bot, spider or scraper "to access, obtain, copy, monitor or republish any portion of the site or any data"), and clause
5.3 forbids copying, publishing or making derivative works from data on the site. That is an explicit contract term,
stronger than "no licence stated", so the crawl-for-scoping rule (owner, 2026-10-03) was not applied on our own
decision: no source in `tools/fetch-river.mjs`, no `tower-bridge-lifts.json`, no history file. The owner decides. If the
owner says yes: one page a day, facts only (date, time, direction, vessel name, vessel type, fetch time), appended to a
dated history file, vessel names matched to `wikidata-vessels.json` and OSM ships by name only. Other routes checked:
none open (the X account is excluded; PLA notices do not list lifts). The 3D page's Tower Bridge card links to the page.

## Proposed use on the 3D page (not built)

- River buses as moving markers between piers, driven by the timetable and corrected by live TfL arrivals (CORS, no
  key, so the page can call TfL itself); the Woolwich Ferry crossing likewise.
- Lock badges at the OSM positions: green when the clock is inside the window (tide gauges for LW/HW from `levels.json`
  or a high-water time), red with the CRT notice title when a closure is in force.
- Swim-water chips on Eden Dock and the three Royal Docks: last sample date, rating, E. coli, water temperature.
- Harbourmaster notices as tinted boxes on the river (bbox) with the PLA link; port-wide ones in a list.
- Thames Barrier: a closure banner on test days, and the DIFF difference as a live gauge.
- Moorings, houseboats and named historic ships (Wikidata, OSM) as small labelled markers at the water's edge.

## Traps, in short

- A URL with the run's date or time in it is cached under a stable key (`cached(..., key)`), or `--no-fetch` cannot
  find it.
- `locks` reads `crt-notices.json`: run `crt-notices` first.
- The EA bathing-water API answers 403 from this container (Azure gateway) for every User-Agent tried.
- pla.co.uk and the PLA tide pages: Cloudflare challenge; use maps.pla.co.uk (ArcGIS), which answers.
- The Internet Archive CDX API timed out from the container on 2026-10-04.
