---
name: docklands-data-curation
description: >-
  Curate the Canary Wharf, Isle of Dogs and Docklands open data in magpie/cwplans — the building registry
  (cwb- ids), occupants, postcodes, chain-store branches, heritage, river, feeds, the atlas, the 3D model data,
  the data register, pipeline.json and METHODS.md, and the data-quality audit. Use this when rebuilding or adding a
  source, joining two sources, changing a tool in magpie/cwplans/tools/, judging why two sources disagree, or about
  to correct a wrong value. READ "CATALOGUE FIRST" BEFORE PATCHING ANYTHING: the owner's direction (October 2026) is
  to catalogue and analyse error classes, not to fix records one at a time, because the classes drive the
  compositing layers. Holds the fault register (F1...) and the rebuild order. The 3D page itself, web crawls and the
  public registers have their own skills (docklands-3d-page, cwplans-web-harvest, cwplans-public-registers). Append
  what you did to ACTIVITY-LOG.md in this directory before you finish.
---

# Docklands data curation

Pages: https://danbri.github.io/glitchcan-minigam/magpie/cwplans/atlas/ (everything joined; data quality at
`#quality`), https://danbri.github.io/glitchcan-minigam/magpie/cwplans/docklands/ (3D).
Policy for this directory: the repo `CLAUDE.md`, Data ethics, "EXCEPTION — magpie/cwplans/" (personal,
organisation and address data allowed during prototyping; no proprietary or restricted-licence data; OSM
under ODbL allowed and tracked; website crawls allowed for scoping and recorded). The owner's rules with their dates
are in `methods-intro.md` (top of METHODS.md).
Store finders (owner, 2026-10-03: "we are permitted per industry convention to submit storefinder forms with UK
postcodes"): a UK postcode in a brand's store-finder search, nothing else; limits and method in `cwplans-web-harvest`.

**Activity log:** [ACTIVITY-LOG.md](ACTIVITY-LOG.md), dated, newest last. Add an entry for every session
that changes data, tools, checks or policy: what changed, the commit, the measured effect (audit counts
before and after), and what is still open. The other cwplans skills write their entries here too.

## Skills for this project

| skill | home | reach for it when |
|---|---|---|
| `docklands-data-curation` (this one) | `magpie/cwplans/skills/` | policy, catalogue first, the fault register, joins, rebuild order, methods, provenance, the data register |
| `docklands-3d-page` | `magpie/cwplans/docklands/skills/` | editing `docklands/index.html`: programs and vertex formats, interface, styles, splats, Night mode and its calibration, the fp16 lesson, headless testing, shipping |
| `cwplans-web-harvest` | `magpie/cwplans/skills/` | crawling entity websites, the headless render, store finders, JSON-LD repair, Factoidal and N-Quads, branch scopes, opening hours, the Chromium proxy CA fix |
| `cwplans-public-registers` | `magpie/cwplans/skills/` | GIAS, CQC, ODS, charities, Ofsted, gambling, Active Places, FSA pubs: licences, fields dropped, the join and its traps (F17 to F20), rejected sources |
| `cwplans-london-datastore` | `magpie/cwplans/skills/` | the London Datastore walk: the v3 export API and terms, `tools/walk-london-datastore.mjs` (walk, triage, harvest), the triage rules, the 13 harvested sets in `feeds/london-datastore/`, the ranked backlog, F22 and F23 |
| `docklands-sky` | `magpie/cwplans/docklands/skills/` | the page clock and `?t=`, the sky (sun, moon phase and limb, planets, stars, constellation lines, Milky Way, satellites), Open-Meteo weather, EA tide at the time shown, the photo-time solution, `tools/fetch-sky.mjs` and the snapshots, their licences |
| `cwplans-river-and-water` | `magpie/cwplans/skills/` | the river, docks and water: PLA notices to mariners, CRT stoppages, Thames Barrier tests, EA tide and feeder-river levels, tidal lock rules, swim-water results for Eden Dock and the Royal Docks, EA sondes and WIMS, TfL river buses, moorings and vessels (`tools/fetch-river.mjs`, `feeds/river/`); no open live AIS |
| `cwplans-crown-lighting` | `magpie/cwplans/skills/` | the coloured crown lighting (One Canada Square's halo, 25 Bank Street, Newfoundland): how colours are chosen, the aviation flash, the (incomplete) history, `tools/fetch-crown-lighting.mjs`, `registry/sources/lighting/`, judging a colour from a photo |
| `cwplans-live-state` | `magpie/cwplans/skills/` | live state in the zone (`tools/fetch-live.mjs`, `feeds/live/`): hire bikes, lift outages, station busyness, JamCams, power cuts, storm overflows, NOTAM cranes, the helicopter route H4 and EGR159; what cannot be known (live helicopter positions, dockless bikes) and the ranked backlog |

## Ship at once

Owner, 2026-10-03: "shipping immediately to live site is fine and urgent. Don't batch things up, as live site is my only
way to see progress." Commit and push each working change to master as soon as it passes its check (syntax, a headless
load with no page errors, `check-data-register.mjs`), then confirm the live file matches the commit
(https://danbri.github.io/glitchcan-minigam/ + path). Do not hold finished work back to bundle it with other work.
The page-side recipe and the lesson behind "re-read the whole line" are in `docklands-3d-page`.

## Catalogue first

`tools/audit-quality.mjs` runs the same checks on every rebuild (39 on 2026-10-03, nine classes:
identity, position, attribute conflict, validity, pipeline, routing network, currency, coverage, meaning). Output:
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

| F14 | 2026-10-03 | `fetch-cwg.mjs` parse: the category regex stopped at the tag's own closing div (no category on any of 369 pages); "United Kingdom" (unit) and "55 Upper Bank Street" (upper) read as levels; the first place in list order won ("Bank Street" inside "Upper Bank Street"); only E14/E16 postcodes (Wood Wharf uses E22) | pipeline | fixed: `registry/sources/brands/tools/cwg-fields.mjs` with tests; re-run from the cached pages. 339 entries with categories; 4 levels, 1 mall, 5 missing malls, 3 postcodes corrected; branches unchanged | `tools/test/cwg-fields.test.mjs` |
| F15 | 2026-10-03 | Business contact tags (phone, email, contact:*) dropped by `registry-osm.mjs`, and `build-registry.mjs` copied only website and opening_date to occupants | pipeline (coverage) | fixed: occupants keep opening_hours, cuisine, wheelchair, check_date, start_date, operator, url, website, phone, email, contact:* (cwplans exception) | buildings.json occupants |
| F16 | 2026-10-03 | CWG directory joined only through the brand table: 226 of 374 entries had no registry occupant | coverage (join rule) | fixed in `build-registry.mjs`: name keys + place (mall, postcode or building), never across two malls; else a new occupant by street address, mall host outline or the one building of the postcode, with a confidence. 336 of 374 linked; 38 unplaced by class | CV-3: 38; SP-7: 8 low; CV-2: 205 → 162 |

| F17 | 2026-10-03 | One UPRN on many register records: GIAS gives 8 schools at different postcodes UPRN 6064816 (a council office, inside the Poplar Public Mortuary outline); a first join put 9 schools in that building. One more UPRN point is 300 m from the school's own GIAS point | identity (source) | rule in use: a UPRN given to records at two or more postcodes in one register, or over 150 m from the register's own point, is not a key | ID-5: 9 |
| F18 | 2026-10-03 | Register addresses that are not where the organisation works: 16 GIAS correspondence addresses (overseas schools, 30 Skylines Village), 84 records at the registered-office service at E14 5HU / 10th floor 5 Churchill Place (ODS and charities), 13 care-of and accountant addresses, 22 charity contact addresses in residential buildings | meaning (source) | rule in use: excluded before the join and counted | SE-3: 135 |
| F19 | 2026-10-03 | "The one registry building with the postcode" is not "the postcode covers one building": registry postcodes come from occupants, so a pub carried E14 0EY and took the Newby Place health centre (8 ODS records); a virtual-office address (71-75 Shelton Street) carried E14 5RE | join rule | fixed: the postcode alone places a record only when the ONSPD centre is within 50 m of that building and the address names no other street | CV-4: 14 (centre over 50 m) + 2 (street) |
| F20 | 2026-10-03 | One organisation as two register records in one building (ODS provider and its site, "360 CAMHS" and "360 CAMHS LONDON"; OSM "Sk:n" and CQC "Sk:n - London Canary Wharf"): name keys differ, so both stay | identity (join rule) | open | ID-2: 84 → 89 |
| F21 | 2026-10-04 | EA tide gauge Tower Pier (0007): readings jump by 0.4 to 0.9 m between neighbours for about two hours around low water (4 Oct 2026, 00:00 to 01:15 UTC: -0.745, -0.808, -0.822, -0.620, -0.426 m OD while Charlton read -1.59 to -1.02); a dry or faulty gauge, not the river | validity (source) | rule in use in `docklands/sky.js` `cleanGauges`: a reading is left out when its difference from the nearest other gauge departs more than 0.45 m from the median of that difference over 2 h either side. 5 of 119 Tower Pier readings in the 3-4 Oct snapshot; 0 at Charlton and Silvertown | `data/sky/tide-2026-10-03.json` |
| F22 | 2026-10-04 | UPRNs rounded by a spreadsheet in the GLA Cultural Infrastructure Map (London Datastore 23697, `os_addressbase_uprn`): 12-digit UPRNs published as 200000000000, 100023000000 or 1E+11, so many venues share one false UPRN | validity (source) | rule in use in `tools/walk-london-datastore.mjs` harvest: a UPRN field with an exponent, or 9 or more digits ending in 5 or more zeros, gets `uprn_suspect` and is not a key | `feeds/london-datastore/cultural-infrastructure/`: 56 of 599 zone venues with a UPRN |
| F23 | 2026-10-04 | GLA Planning Constraints Map GeoPackages of 2025-12-23 (Site Allocations, Strategic Industrial Land, Locally Significant Industrial Sites, Brownfield Register) hold polygons with OBJECTID, Shape_Length and Shape_Area only; the Brownfield Register CSV in the same dataset has the attributes but its objectid is another numbering (127 of 238 zone polygons lie over 500 m from the CSV point with that id) | meaning (source) | rule in use: never join by that OBJECTID; the brownfield harvest reads the CSV and its own points (geox, geoy; WGS84 or BNG per row); the three others are kept as designation outlines with `attributes_in_source: none` | `feeds/london-datastore/*/` meta |
| F24 | 2026-10-04 | EA sonde BARIERA (Thames Barrier Gardens Pier) publishes impossible values: ammonium 192 to 245 mg/L, pH 5.2, turbidity -93.6 NTU (two days to 4 Oct 2026, 'Unchecked'), while Cadogan Pier and Erith read pH 7.8, ammonium 3 to 8 mg/L | validity (source) | rule in use in `tools/fetch-river.mjs` `SUSPECT`: values kept and flagged in `values.suspect` (pH outside 6 to 9.5, negative turbidity or oxygen, ammonium over 50 mg/L) | `feeds/river/ea-sondes.json`: 3 of 20 series |

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
- The page side (drawing the image through the terrain's x, z, resampling to 2048 px for mipmaps): `docklands-3d-page`, "Styles".

## Splats and drone frames

Moved to `docklands-3d-page` ("Styles", Gaussian splats): synthesis (`tools/build-splats.mjs`), the `.splat` format
and the determinant rule, depth compositing, drone frames, OpenSplat training and `tools/publish-trained-splat.mjs`.

## Wikidata through QLever

**Pace ourselves and ask once.** The first version called wbgetentities in batches and got "too many
  requests" (owner, 2026-10-03: "maybe the rate limiting should come from us? Or a more carefully posed efficient
  query? QLever is very good"). Now `tools/lib.mjs` `qlever()` runs one query at a time, at least 1.5 s apart, with
  backoff on 429 and 5xx; and the tool asks two questions in total: the classes of all 65 occupant items (VALUES over
  the ids) and all occupant and headquarters links of the 86 building items with their qualifiers. 2.9 s, no
  retries. Cached in `data/raw/registry/wikidata-occupant-classes.json`; delete it to refresh.

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
- `registry/sources/facades/`: measured bays and colours from CC BY and PD photos. Check against a known count where
  one exists (One Canada Square: 19.9 bays measured, 19.8 known). Most recent Commons photos of the new towers are
  CC BY-SA: look only. Commons and Flickr rate-limit the container (429, retry after 600 s).
- How the page loads and draws trees and photo facade tiles: `docklands-3d-page`, "Styles".

## Page rendering lessons (docklands/index.html)

Moved to `docklands-3d-page`: photo facade mip levels, the vertex alpha byte, pixel-art materials, phone audio, the
fp16 / highp fault, the test sizes and photo views, Night mode, aviation lights and label gestures.

## Measured lessons (the reasons behind the rules)

- **OSM tags can hold lists.** Split on ";" for every tag on ingest (F2).
- **Never prefix a label to free text.** Parse unit designators out of the value (F3).
- **One Wikidata item, one outline.** An OSM `wikidata` tag outranks containment of the item's coordinate
  (F1). OSM itself tags three items on two outlines each (ID-1): model complex → building → part.
- **The estate is three-dimensional.** A mall is a container of its own, below and between buildings;
  place its occupants by mall and level, and keep the building above only as context (F4).
- **Join a directory on name and place, never on name alone.** A CWG entry joins an occupant only when a name key is
  equal and the place agrees (same mall, shared postcode, or the building its address names); two malls never join,
  except Canada Place and the One Canada Square mall, which CWG and the FSA name both ways (F16). Classes left over:
  street addresses with no registry building (Wood Wharf is newer than many outlines), car parks, estate-wide entries,
  pages with no address, renamed venues ("London Museum Docklands").
- **A register address has a role.** Correspondence, registered-office, care-of and charity contact addresses are
  not places (F18). A UPRN is a key only when it is unique to one place and agrees with the register's own point
  (F17). The postcode alone needs one building at the postcode centre, not one building that carries the postcode
  (F19). Keep the key, its precision and a confidence on every link. Register traps in full: `cwplans-public-registers`.
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

## Structured data from rendered pages

Moved to `cwplans-web-harvest`: the plain crawl, the headless render, store finders, the JSON-LD repair classes,
Factoidal and the N-Quads dataset, branch / chain / organisation attribution, opening hours, the Chromium proxy CA fix.
Registers (GIAS, CQC, ODS and the rest): `cwplans-public-registers`.

## Rebuild order

    node magpie/cwplans/tools/build-registry.mjs        # registry/buildings.json (needs data/raw/registry/*)
    node magpie/cwplans/tools/join-web-facts.mjs        # occupants[].web from registry/sources/web/structured-facts.json
    node magpie/cwplans/tools/build-categories.mjs      # registry/categories.json (QLever only when its cache lacks an item)
    node magpie/cwplans/tools/build-atlas.mjs           # atlas/data/atlas.json (reads the registry and docklands/data/area.js)
    node magpie/cwplans/tools/audit-quality.mjs         # quality/issues.json, quality/CATALOGUE.md (reads the atlas)
    node magpie/cwplans/tools/check-data-register.mjs --write   # every committed data file registered?

The fetch and 3D steps are in `magpie/cwplans/docklands/README.md` and `registry/README.md`; the web and register
fetches in their skills. The order of every tool is the `after` list of its activity in `pipeline.json`. Raw extracts
over a few MB stay local (gitignored); `data-register.json` says what is committed and why.

## Methods

Owner, 2026-10-03: "record ALL our data methods in skills or other concrete committed artifacts". The method catalogue
is [METHODS.md](../../METHODS.md) (https://github.com/danbri/glitchcan-minigam/blob/master/magpie/cwplans/METHODS.md):
the owner rules, every tool by subject area in rebuild order, the hand-judgement steps and the fault register summary.
It is generated: edit `pipeline.json` (tool activities, and `manual_activities` for hand steps) and `methods-intro.md`
(the hand-written policy section), never METHODS.md.
- **Every new or changed tool updates its `pipeline.json` activity in the same commit**: method, rules (source and
  endpoint, query, join keys and thresholds, precedence, what is dropped and why, units and rounding, cache,
  politeness), `area`, `faults` (F-numbers below) and `judgement` (where a hand decision enters and where it is
  recorded). A hand step with no committed script gets a `manual_activities` entry with a `gap`.
- `node magpie/cwplans/tools/check-data-register.mjs --write` regenerates METHODS.md, DATA-REGISTER.md and
  pipeline.jsonld. The check fails on an unlisted tool, an empty method or rules, an unknown area and a fault id that
  is not in the fault register.

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
same commit as the file. `skills/` directories (at any depth, so `docklands/skills/`
too) and `vendor/` are not data and are not registered.

## Pages and tests

- The atlas (`atlas/index.html`) loads `atlas/data/atlas.json` first and the detail files on demand. Hash
  routes: `#view`, `#view/b/cwb-0413`, `#view/pc/E14-5AB`, `#quality/q/SP-6`; `#cwb-NNNN` also works.
  `window.__atlas.open(kind, id)` opens a record. Building and postcode records list their quality issues.
- The 3D page: `docklands-3d-page` (URL switches, `window.__docklands`, the headless recipe).
- Test headless with Playwright from a local `python3 -m http.server` (fetch needs http). The atlas basemap comes from
  tile.openstreetmap.org: an October 2026 session could not reach it from the container, and on 2026-10-04 `curl`
  through the proxy got HTTP 200. Check before you report a missing basemap, and say which it was.
- `node --test magpie/cwplans/tools/test/*.test.mjs`: parser fixtures (15 tests on 2026-10-04).
