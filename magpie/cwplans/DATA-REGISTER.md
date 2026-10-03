# Data register: magpie/cwplans

Generated from `data-register.json` by `tools/check-data-register.mjs --write` on 2026-10-03. Edit the JSON, not this file.

## Policy

- personal org address data: Restrictions suspended for this project during scoping, planning and prototyping (owner, October 2026; CLAUDE.md, Data ethics, exception).
- licence limit: Never fetch or commit proprietary, restricted-licence or virally licensed data.
- crawls: Website crawls, direct and via the Internet Archive or Common Crawl, are fair use for scoping (owner, 2026-10-03). Each crawl-derived file names its method and date here. Re-check before anything leaves the prototyping phase.
- odbl: OpenStreetMap data (ODbL 1.0, share-alike) is allowed for now (owner, 2026-10-03). Its use is to be reviewed in full during planning and prototyping. Every committed file that holds OSM data, or data derived from it, is listed here with osm.use other than 'none'.

## OpenStreetMap (ODbL) use

Attribution on every page that shows OSM data: "© OpenStreetMap contributors", linked to https://www.openstreetmap.org/copyright.

| extract | OSM data as of | fetched | committed |
|---|---|---|---|
| osmfr-greater-london: https://download.openstreetmap.fr/extracts/europe/united_kingdom/england/greater_london-latest.osm.pbf | 2026-10-01T01:43:50Z (osmosis_replication_timestamp in the PBF header) | 2026-10-02 | no (data/raw/docklands/greater_london-latest.osm.pbf) |
| osm-api-corridor: https://api.openstreetmap.org/api/0.6/map.json (corridor box) and /api/0.6/relation/{id}/full.json for incomplete water relations | (API, live) | 2026-10-02 | yes |

| file | size | use | what OSM data | extract | shown on |
|---|---|---|---|---|---|
| `data/cwplans-data.js` | 715 kB | derived | building outlines and levels, water, roads, railways, stations, tunnels | osm-api-corridor | index.html |
| `data/raw/osm-map.json.gz` | 1.4 MB | raw | all elements in the box | osm-api-corridor |  |
| `data/raw/osm-water-full.json.gz` | 17 kB | raw | relation members | osm-api-corridor |  |
| `data/sourced-levels.json` | 8 kB | ids | OSM node and way ids that place each station |  |  |
| `docklands/data/area.js` | 5.6 MB | derived | building outlines, parts and levels, water, greens, roads, railways, tunnels, place names | osmfr-greater-london | docklands/index.html |
| `docklands/data/under.js` | 296 kB | derived | building:levels:underground, indoor ways and points with a level tag | osmfr-greater-london | docklands/index.html |
| `data/raw/postcodes/osm-addr-postcodes.json` | 154 kB | counts | counts, street names and feature kinds per postcode | osmfr-greater-london |  |
| `postcodes/postcodes.json` | 1.2 MB | counts | osm_features, osm_streets, osm_kinds per postcode | osmfr-greater-london | postcodes/index.html |
| `postcodes/postcodes.csv` | 356 kB | counts | as postcodes.json | osmfr-greater-london |  |
| `data/raw/registry/osm-cw.json.gz` | 840 kB | raw | buildings, parts, shops, offices, amenities, entrances, with all tags | osmfr-greater-london |  |
| `registry/buildings.json` | 2.3 MB | derived | building outlines (centroid, area), names, levels, addresses, occupant names, brands and levels | osmfr-greater-london | registry/index.html |
| `registry/ids.json` | 36 kB | ids | OSM way and relation ids of building outlines | osmfr-greater-london |  |
| `registry/sources/brands/branches.json` | 221 kB | derived | OSM ids, names, brand tags, levels, positions, match rules | osmfr-greater-london |  |
| `registry/sources/brands/storelocator.json` | 33 kB | counts | Greater London branch counts per brand, and website=* tags used to find URLs | osmfr-greater-london |  |
| `registry/sources/brands/README.md` | 72 kB | notes | branch table with OSM ids, names and levels |  |  |
| `atlas/data/atlas.json` | 2.1 MB | derived | building outlines (microdegrees), names, levels; OSM feature counts and streets per postcode; model heights matched to outlines | osmfr-greater-london | atlas/index.html |
| `quality/issues.json` | 235 kB | derived | OSM ids, names, tag values (level, addr:postcode, addr:unit) and positions of features with issues | osmfr-greater-london | atlas/index.html |
| `quality/CATALOGUE.md` | 34 kB | notes | examples quote OSM ids, names and tag values |  |  |
| `quality/README.md` | 12 kB | notes | counts from the audit |  |  |
| `docklands/data/indoor.js` | 434 kB | derived | walkable ways and nodes with level tags, lifts, escalators, platforms, named shops and entrances | osmfr-greater-london | docklands/index.html |
| `registry/categories.json` | 66 kB | derived | occupant names and the OSM tags that state their kind (amenity, office, shop, leisure, tourism) | osmfr-greater-london | docklands/index.html |
| `docklands/data/splats/cw-synth.splat.gz` | 4.8 MB | derived | building outlines and heights as splat positions and sizes | osmfr-greater-london | docklands/index.html |
| `README.md` | 11 kB | notes | describes the OSM layers |  |  |
| `docklands/README.md` | 21 kB | notes | describes the OSM layers and counts |  |  |
| `postcodes/README.md` | 8 kB | notes | counts of postcodes seen in OSM |  |  |
| `registry/README.md` | 10 kB | notes | counts of OSM-placed occupants |  |  |

Use values: **raw**: OSM elements as downloaded (tags and geometry); **derived**: a database built from OSM data together with other sources (geometry, names, tags); **counts**: only counts or short lists (street names, kinds) computed from OSM; **ids**: only OSM element ids, as links or join keys; **notes**: documentation that quotes or tabulates OSM-derived values; **none**: no OSM data.

### OSM elsewhere in the repository (not this project)

Outside this project; listed so that the ODbL review sees the whole repository. Found with: git grep -l -i -E 'openstreetmap|odbl' and git ls-files | grep -i osm (2026-10-03).

- `trees/data/bristol.osm.pbf`: raw, complete OSM Bristol extract (Geofabrik)
- `trees/data/fabric-bristol.json`: derived, buildings (and .gz copy)
- `trees/data/roads-bristol.json`: derived, roads (and .gz copy)
- `trees/data/water-bristol.json`: derived, water (and .gz copy)
- `trees/data/greens-bristol.json`: derived, parks (and .gz copy)
- `trees/data/pubs-bristol.json`: derived, pubs (and .gz copy)
- `trees/data/shops-bristol.json`: derived, shops (and .gz copy)
- `magpie/ua17/data/buildings-london.json`: derived, tall buildings, Overpass, 2026-07-01
- `magpie/ua17/data/buildings-nyc.json`: derived, tall buildings, Overpass
- `magpie/edot/maps/js/maps-config.js`: tiles, loads tile.openstreetmap.org raster tiles at run time; no OSM data committed

## Marked for review

- `data/sourced-levels.json`: quotes include Wikipedia text (CC BY-SA); TfL FOI rail levels have no stated licence
- `docklands/facts.json`: 169 quotes are Wikipedia text (CC BY-SA 4.0, share-alike), the rest short quotes from all-rights-reserved pages: before anything leaves the prototyping phase, decide whether to keep the quote text or only the value and URL
- `docklands/FACTS.md`: as docklands/facts.json
- `registry/buildings.json`: occupants include CWG page links and mall names from cwg-directory.json
- `registry/sources/brands/branches.json`: includes CWG directory fields (see cwg-directory.json)
- `registry/sources/brands/cwg-directory.json`: no open licence on canarywharf.com: re-check before anything leaves the prototyping phase
- `feeds/underground/stations.json`: short quotes from copyright documents (CWG, TfL, Crossrail); re-check before production
- `feeds/underground/planning.json`: short quotes from copyright documents (CWG, TfL, Crossrail); re-check before production
- `feeds/underground/estate.json`: short quotes from copyright documents (CWG, TfL, Crossrail); re-check before production
- `feeds/underground/tunnels.json`: short quotes from copyright documents (CWG, TfL, Crossrail); re-check before production

## All registered files

| file | size | what | sources (licence) |
|---|---|---|---|
| `data/cwplans-data.js` | 715 kB | corridor 3D model data (Canada Water corridor page) | OpenStreetMap (ODbL 1.0); Environment Agency LiDAR Composite DTM/DSM 1 m (OGL v3.0); Wikidata (CC0 1.0); short quotations from published pages (Wikipedia text is CC BY-SA 4.0 (share-alike); the other pages are all rights reserved) |
| `data/raw/osm-map.json.gz` | 1.4 MB | OSM API map.json for the corridor box | OpenStreetMap (ODbL 1.0) |
| `data/raw/osm-water-full.json.gz` | 17 kB | full water relations (the Thames, Pool of London) | OpenStreetMap (ODbL 1.0) |
| `data/raw/wikidata-around.json` | 307 kB | Wikidata items near the corridor | Wikidata (CC0 1.0) |
| `data/raw/wikidata-facts.json` | 33 kB | Wikidata heights, floors and dates | Wikidata (CC0 1.0) |
| `data/sourced-levels.json` | 8 kB | published station and structure levels used as tunnel controls | short quotations from published pages (Wikipedia text is CC BY-SA 4.0 (share-alike); the other pages are all rights reserved); TfL FOI-0493-2223 (FOI disclosure; no open licence stated. Only six cited values are used, as facts with their source row; re-check before production); written or computed in this project (repository licence); OpenStreetMap (ODbL 1.0) |
| `data/raw/docklands/ea-defences.json.gz` | 35 kB | EA flood defences in the Docklands box | Environment Agency Spatial Flood Defences (OGL v3.0) |
| `data/raw/docklands/wikidata-facts.json.gz` | 13 kB | Wikidata facts for the Docklands box | Wikidata (CC0 1.0) |
| `data/raw/docklands/wikidata-items.json.gz` | 212 kB | Wikidata items in the Docklands box | Wikidata (CC0 1.0) |
| `docklands/data/area.js` | 5.6 MB | Docklands 3D model: terrain, water, greens, 41,803 buildings, railways, roads, tunnels, places, flood defences, riverbed | OpenStreetMap (ODbL 1.0); Environment Agency LiDAR Composite DTM/DSM 1 m (OGL v3.0); Wikidata (CC0 1.0); Environment Agency Spatial Flood Defences (OGL v3.0); UKHO INSPIRE bathymetry and wrecks (OGL v3.0); PLA Tide Booklet 2025 (two published numbers used as facts); short quotations from published pages (Wikipedia text is CC BY-SA 4.0 (share-alike); the other pages are all rights reserved) |
| `docklands/data/under.js` | 296 kB | basements, indoor ways, points with a level, published structures | OpenStreetMap (ODbL 1.0); Wikidata (CC0 1.0); short quotations from published pages (Wikipedia text is CC BY-SA 4.0 (share-alike); the other pages are all rights reserved) |
| `docklands/facts.json` | 166 kB | 360 cited facts (depths, tunnels, towers, docks, ground) | short quotations from published pages (Wikipedia text is CC BY-SA 4.0 (share-alike); the other pages are all rights reserved); Wikidata (CC0 1.0) |
| `docklands/FACTS.md` | 89 kB | the same facts as a table | short quotations from published pages (Wikipedia text is CC BY-SA 4.0 (share-alike); the other pages are all rights reserved); Wikidata (CC0 1.0) |
| `data/raw/postcodes/onspd-aug2026.json.gz` | 58 kB | ONSPD rows for E14 | ONS Postcode Directory, August 2026 (OGL v3.0) |
| `data/raw/postcodes/osm-addr-postcodes.json` | 154 kB | per postcode: number of OSM features with that addr:postcode, their streets and kinds | OpenStreetMap (ODbL 1.0) |
| `data/raw/postcodes/wards.json` | 13 kB | ward codes and names | ONS ward names and boundaries (OGL v3.0) |
| `postcodes/postcodes.json` | 1.2 MB | all 4,000 candidate E14 postcodes with status, tier, dates, ward, position, OSM streets | ONS Postcode Directory, August 2026 (OGL v3.0); ONS ward names and boundaries (OGL v3.0); OpenStreetMap (ODbL 1.0); written or computed in this project (repository licence) |
| `postcodes/postcodes.csv` | 356 kB | the same as CSV | ONS Postcode Directory, August 2026 (OGL v3.0); ONS ward names and boundaries (OGL v3.0); OpenStreetMap (ODbL 1.0); written or computed in this project (repository licence) |
| `postcodes/queries.json` | 291 kB | web search templates per postcode | ONS Postcode Directory, August 2026 (OGL v3.0); written or computed in this project (repository licence) |
| `postcodes/canary-wharf-ward.geojson` | 12 kB | Canary Wharf ward boundary | ONS ward names and boundaries (OGL v3.0) |
| `data/raw/registry/osm-cw.json.gz` | 840 kB | OSM features with full tags in the Canary Wharf box | OpenStreetMap (ODbL 1.0) |
| `data/raw/registry/wikidata-cw.json` | 138 kB | Wikidata items, headquarters, occupants and owners in the box (QLever) | Wikidata (CC0 1.0) |
| `data/raw/registry/fhrs/FHRS530-2026-10-03.json.gz` | 35 kB | FSA food premises snapshot, E14 | FSA Food Hygiene Rating data, Tower Hamlets (OGL v3.0) |
| `registry/buildings.json` | 2.3 MB | 1,129 buildings with ids, names, occupants, owners, postcodes and joins | OpenStreetMap (ODbL 1.0); Wikidata (CC0 1.0); FSA Food Hygiene Rating data, Tower Hamlets (OGL v3.0); ONS Postcode Directory, August 2026 (OGL v3.0); OS Open UPRN and Open Linked Identifiers (OGL v3.0); GLA London Building Stock Model 2 (OGL v3.0); HM Land Registry INSPIRE Index Polygons (OGL v3.0 with conditions); HM Land Registry Price Paid Data (OGL v3.0); Companies House Basic Company Data (free reuse (OGL terms for Companies House public data)); OSM name-suggestion-index 8.0.20260918 (BSD-3-Clause); Canary Wharf Group directory pages (none stated (all rights reserved by default)); written or computed in this project (repository licence) |
| `registry/ids.json` | 36 kB | id register: OSM element to cwb-NNNN | OpenStreetMap (ODbL 1.0); written or computed in this project (repository licence) |
| `registry/companies-by-postcode.json` | 2.9 MB | companies per postcode (number, name, status, category, dates, SIC) | Companies House Basic Company Data (free reuse (OGL terms for Companies House public data)) |
| `registry/homes-by-postcode.json` | 95 kB | price-paid totals per postcode, at least 5 homes | HM Land Registry Price Paid Data (OGL v3.0) |
| `registry/sources/uprn/uprn-summary.json` | 14 kB | UPRN counts in the box | OS Open UPRN and Open Linked Identifiers (OGL v3.0) |
| `registry/sources/landregistry/inspire-canary-wharf.geojson` | 1.5 MB | INSPIRE index polygons touching the box | HM Land Registry INSPIRE Index Polygons (OGL v3.0 with conditions) |
| `registry/sources/brands/brands-uk.json` | 443 kB | UK brands from the name-suggestion-index | OSM name-suggestion-index 8.0.20260918 (BSD-3-Clause) |
| `registry/sources/brands/wikidata-brands.json` | 345 kB | Wikidata facts for the brands | Wikidata (CC0 1.0) |
| `registry/sources/brands/wikidata-near.json` | 35 kB | Wikidata branch items near Canary Wharf | Wikidata (CC0 1.0) |
| `registry/sources/brands/branches.json` | 221 kB | 271 chain-store branches with evidence per source | OpenStreetMap (ODbL 1.0); OSM name-suggestion-index 8.0.20260918 (BSD-3-Clause); FSA Food Hygiene Rating data, Tower Hamlets (OGL v3.0); Wikidata (CC0 1.0); Canary Wharf Group directory pages (none stated (all rights reserved by default)); brand store-locator pages (none stated); written or computed in this project (repository licence) |
| `registry/sources/brands/storelocator.json` | 33 kB | store-locator URLs checked for the top 30 brand families | brand store-locator pages (none stated); OpenStreetMap (ODbL 1.0); written or computed in this project (repository licence) |
| `registry/sources/brands/cwg-directory.json` | 226 kB | 374 entries of the Canary Wharf Group shop, restaurant and venue directory | Canary Wharf Group directory pages (none stated (all rights reserved by default)) |
| `registry/sources/brands/tools/cwg-decisions.json` | 4 kB | hand decisions on CWG directory matches | written or computed in this project (repository licence); Canary Wharf Group directory pages (none stated (all rights reserved by default)) |
| `registry/sources/brands/tools/fsa-decisions.json` | 7 kB | hand decisions on FSA matches | written or computed in this project (repository licence); FSA Food Hygiene Rating data, Tower Hamlets (OGL v3.0) |
| `registry/sources/brands/tools/storelocator-manual.json` | 2 kB | store-locator URLs found by hand | written or computed in this project (repository licence); brand store-locator pages (none stated) |
| `registry/sources/brands/README.md` | 72 kB | method and the full branch table | written or computed in this project (repository licence); OpenStreetMap (ODbL 1.0); FSA Food Hygiene Rating data, Tower Hamlets (OGL v3.0); Canary Wharf Group directory pages (none stated (all rights reserved by default)) |
| `registry/sources/museums/records-open.json` | 3.5 MB | 6,629 open museum and heritage records with positions | Wikidata (CC0 1.0); Historic England open data hub (OGL v3.0); ADS / ARIADNE catalogue records (per record: OGL v3.0 or CC-BY (Portable Antiquities Scheme)) |
| `registry/sources/museums/apa_greater_london.geojson` | 354 kB | Greater London Archaeological Priority Areas | Historic England open data hub (OGL v3.0) |
| `registry/sources/pla/ukho_thames_teddington_greenwich_25m.geojson` | 395 kB | Thames soundings, 25 m | UKHO INSPIRE bathymetry and wrecks (OGL v3.0) |
| `registry/sources/pla/ukho_thames_greenwich_coalhouse_50m.geojson` | 286 kB | Thames soundings, 50 m | UKHO INSPIRE bathymetry and wrecks (OGL v3.0) |
| `registry/sources/pla/ukho_thames_hms_belfast_berth.geojson` | 4 kB | HMS Belfast berth survey | UKHO INSPIRE bathymetry and wrecks (OGL v3.0) |
| `registry/sources/pla/ukho_wrecks_obstructions_areas.geojson` | 2 kB | UKHO wrecks and obstructions, areas | UKHO INSPIRE bathymetry and wrecks (OGL v3.0) |
| `registry/sources/pla/ukho_wrecks_obstructions_points.geojson` | 13 kB | UKHO wrecks and obstructions, points | UKHO INSPIRE bathymetry and wrecks (OGL v3.0) |
| `atlas/data/atlas.json` | 2.1 MB | the atlas index: building outlines and measures, postcodes with company and sales totals, heritage places, riverbed soundings in m OD, wrecks, flood defences, Wikidata items, published levels | OpenStreetMap (ODbL 1.0); Environment Agency LiDAR Composite DTM/DSM 1 m (OGL v3.0); Wikidata (CC0 1.0); ONS Postcode Directory, August 2026 (OGL v3.0); Companies House Basic Company Data (free reuse (OGL terms for Companies House public data)); HM Land Registry Price Paid Data (OGL v3.0); Historic England open data hub (OGL v3.0); ADS / ARIADNE catalogue records (per record: OGL v3.0 or CC-BY (Portable Antiquities Scheme)); UKHO INSPIRE bathymetry and wrecks (OGL v3.0); PLA Tide Booklet 2025 (two published numbers used as facts); Environment Agency Spatial Flood Defences (OGL v3.0); GLA London Building Stock Model 2 (OGL v3.0); short quotations from published pages (Wikipedia text is CC BY-SA 4.0 (share-alike); the other pages are all rights reserved) |
| `quality/issues.json` | 235 kB | data-quality audit: 34 checks with counts, breakdowns, examples and one record per issue | OpenStreetMap (ODbL 1.0); FSA Food Hygiene Rating data, Tower Hamlets (OGL v3.0); Wikidata (CC0 1.0); ONS Postcode Directory, August 2026 (OGL v3.0); Companies House Basic Company Data (free reuse (OGL terms for Companies House public data)); Canary Wharf Group directory pages (none stated (all rights reserved by default)); OSM name-suggestion-index 8.0.20260918 (BSD-3-Clause); Environment Agency LiDAR Composite DTM/DSM 1 m (OGL v3.0); Historic England open data hub (OGL v3.0); written or computed in this project (repository licence) |
| `quality/CATALOGUE.md` | 34 kB | the audit as tables (generated) | written or computed in this project (repository licence); OpenStreetMap (ODbL 1.0); FSA Food Hygiene Rating data, Tower Hamlets (OGL v3.0); Canary Wharf Group directory pages (none stated (all rights reserved by default)) |
| `quality/README.md` | 12 kB | analysis of the error classes and the proposed compositing layers | written or computed in this project (repository licence) |
| `docklands/data/indoor.js` | 434 kB | walking network in 3D: footways, corridors, stairs, escalators, lifts, platforms and walkable areas by level, TfL station points and lifts, and named places, for routing | OpenStreetMap (ODbL 1.0); Environment Agency LiDAR Composite DTM/DSM 1 m (OGL v3.0); Transport for London open data: step-free station topology (TfL open data terms (Powered by TfL Open Data; OGL-based); the terms page was not readable from the container: re-check before production) |
| `docklands/data/tex/rgb2008.jpg` | 1.8 MB | ground texture: EA colour aerial photography 2007-08, 40 cm, mosaicked to 3 m a pixel over the model box | Environment Agency survey downloads: vertical aerial photography 2008 (OGL v3.0) |
| `docklands/data/tex/night2012.jpg` | 792 kB | ground texture: EA night-time aerial photography January to April 2012, 20 cm, mosaicked to 3 m a pixel | Environment Agency survey downloads: vertical aerial photography 2008 (OGL v3.0) |
| `docklands/data/tex/intensity2020.jpg` | 1.4 MB | ground texture: National LiDAR Programme return intensity 2020, 1 m, stretched to 8 bits at 3 m a pixel | Environment Agency survey downloads: vertical aerial photography 2008 (OGL v3.0) |
| `docklands/data/tex/textures.json` | 2 kB | index of the ground textures: image box in local metres, source, licence, attribution | Environment Agency survey downloads: vertical aerial photography 2008 (OGL v3.0); written or computed in this project (repository licence) |
| `data/raw/docklands/tfl-stationdata-gtfs.zip` | 147 kB | TfL step-free station topology (GTFS pathways and levels), as downloaded; input to tools/build-indoor.mjs | Transport for London open data: step-free station topology (TfL open data terms (Powered by TfL Open Data; OGL-based); the terms page was not readable from the container: re-check before production) |
| `feeds/underground/stations.json` | 75 kB | catalogue of sources for the underground estate: station plans, TfL topology and Crossrail papers (URLs, dates, licence, levels found with short quotes) | short quotations from published pages (Wikipedia text is CC BY-SA 4.0 (share-alike); the other pages are all rights reserved); written or computed in this project (repository licence) |
| `feeds/underground/stations-excluded.json` | 5 kB | sources looked at for station plans, TfL topology and Crossrail papers and not used, with the reason | written or computed in this project (repository licence) |
| `feeds/underground/planning.json` | 70 kB | catalogue of sources for the underground estate: planning drawings of the malls and stations (URLs, dates, licence, levels found with short quotes) | short quotations from published pages (Wikipedia text is CC BY-SA 4.0 (share-alike); the other pages are all rights reserved); written or computed in this project (repository licence) |
| `feeds/underground/planning-excluded.json` | 5 kB | sources looked at for planning drawings of the malls and stations and not used, with the reason | written or computed in this project (repository licence) |
| `feeds/underground/estate.json` | 35 kB | catalogue of sources for the underground estate: Canary Wharf estate maps and the indoor-map service (URLs, dates, licence, levels found with short quotes) | short quotations from published pages (Wikipedia text is CC BY-SA 4.0 (share-alike); the other pages are all rights reserved); written or computed in this project (repository licence) |
| `feeds/underground/estate-excluded.json` | 4 kB | sources looked at for Canary Wharf estate maps and the indoor-map service and not used, with the reason | written or computed in this project (repository licence) |
| `feeds/underground/tunnels.json` | 53 kB | catalogue of sources for the underground estate: tunnel alignments, station depths and 3D models (URLs, dates, licence, levels found with short quotes) | short quotations from published pages (Wikipedia text is CC BY-SA 4.0 (share-alike); the other pages are all rights reserved); written or computed in this project (repository licence) |
| `feeds/underground/tunnels-excluded.json` | 5 kB | sources looked at for tunnel alignments, station depths and 3D models and not used, with the reason | written or computed in this project (repository licence) |
| `registry/categories.json` | 66 kB | occupant categories per registry building (finance, shops, catering, leisure, entertainment) with the stated class behind each; drives the 3D glow layers | OpenStreetMap (ODbL 1.0); Wikidata (CC0 1.0); FSA Food Hygiene Rating data, Tower Hamlets (OGL v3.0); Canary Wharf Group directory pages (none stated (all rights reserved by default)); written or computed in this project (repository licence) |
| `docklands/data/splats/cw-synth.splat.gz` | 4.8 MB | Gaussian splats synthesised from the 3D model for the Canary Wharf estate and 300 m round it (669,306 splats; ground coloured from the 2008 aerial photograph) | OpenStreetMap (ODbL 1.0); Environment Agency LiDAR Composite DTM/DSM 1 m (OGL v3.0); Environment Agency survey downloads: vertical aerial photography 2008 (OGL v3.0) |
| `docklands/data/splats/cw-synth.json` | 1 kB | metadata of the synthesised splat set: box, counts, method | written or computed in this project (repository licence) |
| `docklands/data/imagery.js` | 424 kB | satellite colour per 3D terrain vertex (Sentinel-2 true colour, 13 August 2026, 10 m) | Copernicus Sentinel-2 L2A (Copernicus Sentinel data: free, full and open (attribution)) |
| `feeds/SURVEY-2026-10-03.md` | 168 kB | the 2026-10-03 source survey (341 sources in seven areas, 135 left out with reasons) | written or computed in this project (repository licence) |
| `feeds/feeds.json` | 737 kB | 541 checked data sources and APIs (catalogue; 341 added by the 2026-10-03 survey, with an area field) | written or computed in this project (repository licence) |
| `feeds/events.json` | 163 kB | 124 event, calendar, news and openings sources (catalogue) | written or computed in this project (repository licence) |
| `feeds/underground/README.md` | 36 kB | the underground-estate source catalogues as tables (117 sources), with short quotes from copyright documents | written or computed in this project (repository licence); short quotations from published pages (Wikipedia text is CC BY-SA 4.0 (share-alike); the other pages are all rights reserved) |
| `feeds/README.md` | 113 kB | the feeds catalogue as text | written or computed in this project (repository licence) |
| `feeds/EVENTS.md` | 50 kB | the events catalogue as text | written or computed in this project (repository licence) |
| `registry/sources/SOURCES-companies-property.md` | 17 kB | access and licence notes for company and property data | written or computed in this project (repository licence) |
| `registry/sources/museums/README.md` | 11 kB | museum records method and licences | written or computed in this project (repository licence) |
| `registry/sources/pla/README.md` | 16 kB | wet-area sources and licences | written or computed in this project (repository licence) |
| `research-report-2026-10.md` | 16 kB | the owner's research report, verbatim | supplied by the repository owner (owner's) |
| `README.md` | 11 kB | corridor notes | written or computed in this project (repository licence) |
| `docklands/README.md` | 21 kB | Docklands notes | written or computed in this project (repository licence) |
| `postcodes/README.md` | 8 kB | postcode method | written or computed in this project (repository licence) |
| `registry/README.md` | 10 kB | registry method | written or computed in this project (repository licence) |

## Sources

| key | source | licence | attribution or note |
|---|---|---|---|
| osm | OpenStreetMap | ODbL 1.0 | © OpenStreetMap contributors |
| nsi | OSM name-suggestion-index 8.0.20260918 | BSD-3-Clause | a separate project from the OSM database; its brand list is not ODbL data |
| wikidata | Wikidata (SPARQL; QLever for the registry) | CC0 1.0 |  |
| ea-lidar | Environment Agency LiDAR Composite DTM/DSM 1 m (WCS) | OGL v3.0 |  |
| ea-defences | Environment Agency Spatial Flood Defences (OGC API Features) | OGL v3.0 | owner and maintainer fields dropped |
| ukho | UKHO INSPIRE bathymetry and wrecks (PLA multibeam survey 2013–2017) | OGL v3.0 | Contains public sector information, licensed under the Open Government Licence v3.0, from the UK Hydrographic Office not for navigation |
| pla-tide-booklet | PLA Tide Booklet 2025 (chart datum to ODN values only) | two published numbers used as facts |  |
| onspd | ONS Postcode Directory, August 2026 (ONS ArcGIS hosted table) | OGL v3.0 | Contains OS data © Crown copyright and database right 2026; contains Royal Mail data © Royal Mail copyright and database right 2026; source: Office for National Statistics licensed under the Open Government Licence v3.0 |
| ons-boundaries | ONS ward names and boundaries | OGL v3.0 | Source: Office for National Statistics licensed under the Open Government Licence v3.0. Contains OS data © Crown copyright and database right 2026 |
| fsa | FSA Food Hygiene Rating data, Tower Hamlets (FHRS530) | OGL v3.0 |  |
| os-open-uprn | OS Open UPRN and Open Linked Identifiers | OGL v3.0 | Contains OS data © Crown copyright and database right 2026 |
| lbsm | GLA London Building Stock Model 2 | OGL v3.0 |  |
| hmlr-inspire | HM Land Registry INSPIRE Index Polygons | OGL v3.0 with conditions | This information is subject to Crown copyright and database rights 2026 and is reproduced with the permission of HM Land Registry. The polygons (including the associated geometry, namely x, y co-ordinates) are subject to Crown copyright and database rights 2026 Ordnance Survey 100026316. |
| hmlr-price-paid | HM Land Registry Price Paid Data | OGL v3.0 | Contains HM Land Registry data © Crown copyright and database right 2026. This data is licensed under the Open Government Licence v3.0. |
| companies-house | Companies House Basic Company Data | free reuse (OGL terms for Companies House public data) |  |
| historic-england | Historic England open data hub (records, Archaeological Priority Areas) | OGL v3.0 |  |
| ads-ariadne | ADS / ARIADNE catalogue records (only the OGL and CC-BY ones) | per record: OGL v3.0 or CC-BY (Portable Antiquities Scheme) | records under the ADS terms of use are not committed |
| cwg-site | Canary Wharf Group directory pages (canarywharf.com), read from Internet Archive copies | none stated (all rights reserved by default) | see the review note on cwg-directory.json |
| brand-sites | brand store-locator pages | none stated | only URLs and a yes/no check are kept, no page content |
| copernicus-sentinel | Copernicus Sentinel-2 L2A (via Earth Search / Element 84) | Copernicus Sentinel data: free, full and open (attribution) | Contains modified Copernicus Sentinel data |
| ea-survey-imagery | Environment Agency survey downloads: vertical aerial photography 2008 (RGB, 40 cm) and 2012 (night-time, 20 cm), National LiDAR Programme intensity 2020 (1 m) | OGL v3.0 | © Environment Agency copyright and/or database right. All rights reserved (OGL v3.0) |
| tfl-foi | TfL FOI-0493-2223 (2022): station depths, rail levels in London Underground Datum | FOI disclosure; no open licence stated. Only six cited values are used, as facts with their source row; re-check before production |  |
| tfl-open-data | Transport for London open data: step-free station topology (GTFS pathways, 2026-08-03) and the live lift disruption feed | TfL open data terms (Powered by TfL Open Data; OGL-based); the terms page was not readable from the container: re-check before production | Powered by TfL Open Data |
| web-quotes | short quotations from published pages (Wikipedia 169 of 360 in facts.json, also Crossrail Learning Legacy, Tideway, Canal & River Trust, trade press and others) | Wikipedia text is CC BY-SA 4.0 (share-alike); the other pages are all rights reserved | each quote is one sentence or less, kept with its URL to cite a number |
| own | written or computed in this project (method, decisions, URLs, search templates) | repository licence |  |
| owner-supplied | supplied by the repository owner | owner's |  |
