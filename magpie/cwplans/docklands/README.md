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
| `../feeds/` | 200 checked data sources and APIs for the area; browsable at https://danbri.github.io/glitchcan-minigam/magpie/cwplans/feeds/ |
| `../tools/fetch-docklands.mjs`, `osm-clip-docklands.mjs`, `build-docklands.mjs`, `lib.mjs` | the pipeline |

Rebuild (raw files are not committed except the Wikidata snapshots):

    node magpie/cwplans/tools/fetch-raw.mjs grid                               # OSTN15 grid
    node magpie/cwplans/tools/fetch-docklands.mjs                              # OSM extract (150 MB), 96 LiDAR tiles, EA flood defences, Wikidata
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
| tidal flood walls, embankments, flood gates with crest levels | Environment Agency Spatial Flood Defences (OGC API Features), 995 segments; owner and maintainer fields dropped | Open Government Licence v3.0 |
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
- Open track and roads: OSM geometry at the LiDAR level (DSM on bridges and viaducts). Where a viaduct runs under a station roof or a building, the DSM sees the roof. Bridge points more than 20 m above the LiDAR ground are therefore replaced by interpolation from the nearest lower points on the same way (42 points, mostly the DLR through Canary Wharf). Within 120 m of Canary Wharf DLR station the drawn track now ranges from 8.1 to 23.6 m OD (before the fix: up to 41.1 m). Points up to 20 m above the ground are kept, so a low roof can still lift the track; no source for the viaduct height was found to set a better limit.
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

- Flood defences: 995 EA segments (942 walls, 30 bridge abutments, 11 embankments, 8 engineered high ground, 4 flood gates), drawn from the LiDAR ground up to the surveyed crest level (`actual_ucl`, else `actual_dcl`, else the design level). Crests in the box run from 5.07 to 8.75 m AOD, median 5.62 m; most design levels are 5.23 or 5.28 m AOD. With the live data loaded, the page compares the Tower Pier tide with the lowest crest.

- Thames riverbed: UKHO INSPIRE bathymetry (Open Government Licence; not for navigation). It comes from the PLA multibeam survey of 2013–2017, as 6,028 soundings in the box, with point spacing measured at about 25 m (19 m at the HMS Belfast berth). The soundings are heights above Admiralty Chart Datum. They are converted to ODN with the PLA Tide Booklet 2025 values: chart datum is 3.20 m below ODN at London Bridge and 3.35 m at North Woolwich, interpolated by longitude. That interpolation is an approximation. Each sounding is drawn as one square, with no surface between soundings. Seen with the cut-away, or through the river. Files: `../registry/sources/pla/`.

## Registry data in the 3D view (added 2026-10-03)

- Tap a building at Canary Wharf: its registry record opens (heights from each source, floors, owner, homes, companies, postcodes, occupants by level, data-quality issues, link to the atlas), the building is outlined, and up to 40 occupants with a level are drawn as labels at ground + level × storey height. A level is a floor index, not a measured height.
- Picking: every building is drawn off screen in a colour that encodes its registry number; the pixel under the tap gives the building. The cut-away applies, so you can tap into the ground.
- The link from 3D buildings to registry ids is built by `tools/build-atlas.mjs` (`mi` in `atlas/data/atlas.json`): 1,188 model buildings belong to 1,079 registry buildings. Buildings outside the Canary Wharf box have no registry record (dark grey in the colour modes).
- "Colour buildings by": height, occupants, homes, registered companies, floors below ground, data-quality issues (square-root colour scale).
- Pins: heritage records (`registry/sources/museums/`), data-quality issues by severity (`quality/issues.json`), and crime for the latest month from police.uk (live, on request; police.uk locations are anonymised points, Open Government Licence).
- Satellite colours: the terrain coloured from the least cloudy recent Sentinel-2 true-colour image (13 August 2026, 0.01% cloud, 10 m), sampled once per terrain vertex. Rebuild with `NODE_USE_ENV_PROXY=1 node magpie/cwplans/tools/build-imagery.mjs 2026-06-01` (reads only the model window of the COG by HTTP range requests). Copernicus licence; not share-alike.

## Using the page on a phone (redesigned 2026-10-03)

The model fills the screen; nothing important sits below it.
The screen shows only the city, two round buttons at the top left and the attribution line (owner, 2026-10-03: "The city is the star not our endless word buttons").
- Menu button (top left): a drawer slides in from the left with the views (Whole area, Canary Wharf, Underground, Plan, Below ground) and three tabs: Layers, Route and About. The help text is in About. Close it with the cross, a tap outside it, Escape or a swipe to the left. On a phone, a view closes the drawer so you see the result.
- Search button: opens one search box for buildings (registry), labelled places and every routable place in the walking network (shops, platforms, exits). A result flies the camera there; a place below ground also cuts the model away just above its level.
- "Below ground" (in the menu) shows the depth gauge at the left edge. Drag the handle down to remove everything above that level (m OD), so the malls, platforms and tunnels show; the cross on the gauge closes it.
- Tap a building or a label: its record opens in a card at the bottom. Drag the card's handle to resize it, tap the handle to step through the sizes, or close it with its cross. Records have "Route from here" and "Route to here".
- Press and hold anywhere on the model: a menu offers "Route from here" and "Route to here" at the nearest mapped walkway or platform on screen (among the points not cut away). When both ends are set, the route is found at once.
- Map labels are plain text with a dark halo, not boxes.
- Two fingers: twist to turn the view (both styles). In pixel art, one finger moves, two fingers pinch to zoom and move up or down to tilt; with a mouse, right or Shift drag turns and tilts. The round arrow buttons at the top right turn by a quarter.
- A finger that lands on a label still joins the drag, pinch or twist; a tap on a label opens its record.
- Music in pixel art: the buildings themselves follow the bands (vertex shader: stretch, swirl, noise about each building's centre and base); in the map style the splat towers do.
- Music: "Play your own file…" is a button (a label for the file input, so phones open their file picker); the file plays only in the browser.
- On a wide screen the record card docks at the bottom right and the drawer does not dim the map.

## Ground images (added 2026-10-03)

Layers, "Ground image", drapes one of these over the terrain:
| choice | what | resolution in the page | built by |
|---|---|---|---|
| Aerial photo 2008 | EA vertical aerial photography, colour, 40 cm, flown 25 August 2007 to 18 October 2008 | 3 m a pixel, 2048 px texture | `tools/build-aerial.py rgb2008` |
| Night 2012 | EA night-time aerial photography, 20 cm, January to April 2012 | 3 m | `tools/build-aerial.py night2012` |
| LiDAR intensity 2020 | National LiDAR Programme return intensity, 1 m (how strongly each surface reflects the laser: roads dark, roofs and paint bright, sun glint on water) | 3 m | `tools/build-aerial.py intensity2020` |
| Satellite 2026 | Sentinel-2 true colour, 13 August 2026, 10 m, one colour per 20 m terrain point | vertex colours | `tools/build-imagery.mjs` |

All EA images are OGL v3.0 and come from the survey download service (`https://environment.data.gov.uk/tiles/collections/survey/<product>/<year>/<res>/<tile>`, tiles TQ3075, TQ3080, TQ3575, TQ3580; about 2.8 GB as ZIPs in `data/raw/imagery/`, not committed). The aerial photographs are ECW files: no decoder in the container's GDAL reads them, so `tools/native/ecw2ppm.c` is compiled against the ECW 3.3 SDK (see the `docklands-data-curation` skill, "Imagery"). The intensity tiles are GeoTIFF. Coverage limits: the 2008 photography has no tile north-west of Shadwell, and the west tiles come from a different flight (bluer); the night survey stops near Whitechapel Road. These gaps are black in the image.

Not used: EOX cloudless mosaics (CC BY-NC-SA), Google photorealistic tiles (key and caching terms). The EA also has a 2017 oblique photograph of the Thames Barrier (TQ3575, OGL), outside the model box.

## Facades, glow outlines and Gaussian splats (added 2026-10-03)

- Facades: buildings are drawn by their own shader with a window grid (3.6 m storeys, 1.8 m bays, from the distance along each wall) that fades with distance; with "Night 2012" about 40% of windows are lit. Roofs of buildings under 40 m take the ground image. The windows are drawn, not measured: no open facade imagery is used (Mapillary and Geograph are share-alike).
- Glow (Layers, "Glow: who is inside"): banks and finance in red, shops, food and drink, leisure and entertainment in their own colours. A building glows when a source states such an occupant: OSM tags (amenity=bank, office=financial, shop=*, ...), Wikidata P31/P452 of the occupant, the FSA business type, or the CWG directory section (`tools/build-categories.mjs`, `../registry/categories.json`). Names are never used to guess, and Companies House registered offices are not counted. Wikidata occupant links have no dates, so some are former tenants (marked "undated" in the record). Today: 18 buildings with finance occupants, 79 with shops, 144 with food and drink, 28 with leisure, 6 with entertainment. Known gaps: firms that no source places in a building (for example JPMorgan at 25 Bank Street) do not glow.
- The glow is drawn with the depth test (nearer towers hide it, as with real light) and once more faintly without it, so a hidden building still shows.
- Gaussian splats (Layers, "Gaussian splats"): `data/splats/cw-synth.splat.gz` holds 669,306 splats synthesised from this model by `tools/build-splats.mjs` (no training): ground discs coloured from the 2008 aerial photograph every 4 m, roofs every 4 m, wall discs per 3.6 m storey and 7.2 m of wall with a glass band in front. Standard 32-byte `.splat` records in model metres and axes, gzipped (4.5 MB; 20 MB unpacked); a standard 3DGS PLY copy is written to `data/raw/splats/` for other tools. The page draws them as instanced quads sorted back to front in a worker. "Splats only" keeps the model in the depth buffer without drawing it, so glow outlines, routes and labels pass in front of and behind the splats correctly. Needs WebGL instancing and gzip DecompressionStream (all current browsers). On SwiftShader (headless tests) one frame takes about 30 s; on a phone GPU it is real time but heavy: the set is sized for desktops first.
- Drone frames for training: the page has a free camera (`__docklands.setEye(eye, target, fovY)`), `?capture` (no overlays) and `renderNow()`; see `tools/drone-flight.mjs` and `tools/drone-capture.mjs`.

## Night (added 2026-10-04)

Layers, Style, "Night" (or `?night`): the map style as Canary Wharf looks from the river after dark. The owner's six night photos from the river (2026-10-03) are the reference; they are not in the repo, only the numbers measured from them (below).

- Lit windows (facade shader, `nightCol`): walls go dark and a share of the 1.8 m x 3.6 m window cells light up by what the building is used for. The use comes from the atlas index (`../atlas/data/atlas.json`): homes > 0 or an OSM type of residential, apartments, house: warm light (about 2700 to 3200 K), lit by flats of 3 windows, with a low-frequency noise so lit and dark flats cluster; about 5% of flats blue-white. Commercial, office, retail and similar: cool white, lit by whole floors (about a third) and by bands along a floor. Hotels: warm, more lit. Buildings with no registry record (outside the Canary Wharf box): a warm mix, fewer lit. Buildings under 30 m light fewer windows. The use and the roof top go to the shader as a fourth value of the per-vertex building attribute (`g.w` = use x 1000 + roof top in m OD), not in the vertex alpha byte. Far away a window is under one pixel: the shader uses its mean (derivatives) so the facades do not shimmer. Works with photo facades on (the tile, dark, with the lit grid on top) and off. With a data colour mode the colours stay readable.
- Crowns: Newfoundland (cwb-0451) has a lit warm-white diagrid band in its top 13 m; One Canada Square (cwb-0413) has a pink-red band under the pyramid, the pyramid faintly lit from its base and a light at the apex; other towers over 90 m have a soft band at the top. Soft sprites round the two crowns stand in for bloom.
- Red aviation lights: steady red at the roof corners (where the outline turns by more than 35 degrees, at most the 4 extremes) of every building over 45 m (950 buildings, 4,437 lights); towers over 150 m also every 50 m below the top. Towers use the top tier ring of `data/towers.json`, other buildings their model outline. Drawn as additive soft sprites with a halo, tested against depth.
- Riverside lamps (2,378): one about every 25 m along the EA flood walls (3 m inland, where the riverside walks run) and along paths and roads within 40 m of the water (a 10 m water raster), at least 16 m apart; warm orange, 30% white LED. Positions are drawn from these lines, not from a lamp survey.
- Water: near-black warm brown. It marks its pixels in the stencil buffer (the context has a stencil). The reflections of the red lights, lamps, crowns and of lit windows (columns of light for buildings near the water, coloured by use) are drawn after the scene as vertical streaks from the water under each light to below its mirror image about the river level, with ripples that move (about 20 frames a second while Night is on), only where the stencil marks water.
- Sky: near black at the top, a warm brown-grey glow at the horizon, a slight haze of the same colour on far buildings. The moon is drawn at its real position and phase for the current time at Canary Wharf (low-precision sun and moon formulas as in SunCalc), twice its apparent size; it is not drawn below the horizon. Splats are dimmed at night (they have no lit windows). Pixel art has no night; the Night chip is off there.
- Cost (headless SwiftShader, 800 x 600, median of 7 frames): river view 1026 ms day, 1125 ms night; Canary Wharf overview 1238 ms day, 1465 ms night. About +10 to +18%: two extra draw calls of about 11,000 sprites and a sky quad, no extra render pass.

Measured from the photos (Pillow, medians of regions): sky at the top #101010 to #1f1e1c, sky just above the skyline #191919 to #3b3832 (one hazy photo #504c42); water between the streaks #191009 to #392c17; red lamps #d92821; warm windows #c1a573; pixels brighter than 55% luma are 64% warm and 36% neutral or cool (the neutral share includes overexposed warm windows). Facade area brighter than 35% luma on six tower and block crops: 3 to 12% (median about 9%); with window openings about 40% of a facade that is about 20 to 30% of windows lit. The same measure on the rendered towers from the river: 7 to 11%.

Known differences from the photos: no lens bloom or glare beyond the sprite halos; window light is drawn, not known (the real lit pattern changes every night); the window grid is the same 1.8 m x 3.6 m everywhere (real bays differ); logos and signs (HSBC, Citi, the Canary Wharf pier sign) are missing; trees and parks along the bank are not lit; reflections are of point lights and columns, not a mirror image of the facades.

## Drone flight and splat training frames (added 2026-10-03)

`tools/drone-flight.mjs` plans a smooth flight over the Canary Wharf estate and 300 m round it: centripetal Catmull-Rom splines through 127 eye waypoints and a second spline of look targets; turn rate under 10 deg/s, lateral acceleration under 1.5 m/s², along-track under 0.6 m/s²; yaw and pitch smoothed; 44 to 339 m above the ground, never nearer than 30 m to a building. The flight is 33.6 km, 51.5 minutes at 30 fps: a high overview loop, a spiral in, low passes over North and South Dock, orbits of Newfoundland and Landmark Pinnacle, Wood Wharf and the Canada Square towers, crossings over Heron Quays and Cabot Square, and a neighbourhood ring.

`tools/drone-capture.mjs` renders it in this page (`?capture`: photo style on the 2008 aerial photo) and writes a training set to `data/raw/drone/<run>/` (not committed): `images/`, `transforms.json` (nerfstudio, OPENCV without distortion, OpenGL camera-to-world in model metres and axes), `sparse_pc.ply` (182,830 points from the model), a COLMAP text model, coverage and pose checks, `preview.mp4`, `contact.jpg`. The run `cw-photo-480`: 480 frames at 960 × 540; 196 of the 197 estate buildings seen from 3 or more of 8 directions; projected roof outlines land within 0.34 px (median) of the rendered buildings. About 3 s a frame on SwiftShader.

    python3 -m http.server 8765 --bind 127.0.0.1
    node magpie/cwplans/tools/drone-flight.mjs --out path.json --svg plan.svg --coverage 480
    node magpie/cwplans/tools/drone-capture.mjs --run cw-photo-480 --frames 480

Found on the way: 28 model buildings belong to two registry records each, and the pick buffer answers with the later one (the parts of 8 Canada Square answer as an unnamed record): a registry duplicate class for the quality catalogue.

## Isometric pixel art (added 2026-10-03)

Layers, "Style": "Isometric pixel art" (or `?pixel`). An orthographic isometric camera (30 degrees down, turn in 90-degree steps with the arrows; drag moves, pinch or wheel zooms); the scene is drawn at one art pixel per 3 screen pixels and mapped to a 33-colour palette (`data/pixel-palette.json`: 24 colours extracted from a reference picture the owner supplied, 9 accents for trees, water and vehicles) with dark outlines where the brightness steps. Buildings take warm brick and stone colours, towers over 70 m blue and grey glass; windows are drawn on the art-pixel grid. Stylised trees line the minor roads and fill the parks (not surveyed trees). Animated and illustrative, not live data: walkers on the pavements, cyclists, cars, black cabs and red buses keeping left, now and then a police car, ambulance or fire engine with flashing lights; gulls; on the Thames (centreline from `data/river.json`, keeping to starboard) Thames Clipper catamarans, tourist boats, tugs towing waste barges, an aggregate barge and speedboats with wakes; swimmers in lanes in Eden Dock, the swimming area in Middle Dock opened in 2022 and relaunched as Eden Dock in October 2024 (https://www.timeout.com/london/news/canary-wharfs-open-water-swimming-spot-has-officially-reopened-070424, https://londonist.com/london/great-outdoors/open-water-swimming-canary-wharf-middle-dock).

## Music visualiser (added 2026-10-03)

Layers, "Music": the synthesised splats become a music visualiser. Each splat knows its building (`data/splats/cw-synth.groups.bin.gz`), and each building follows one of 24 frequency bands, from west (bass) to east (treble), so the skyline acts as a spectrum analyser. In the splat shader each building stretches up from its base with its band (Stretch), turns round its own axis, more at the top (Swirl), and shakes (Noise); loud bands also light up. The camera orbits slowly (switch off with "Orbit the camera"). Sources: three tracks by Kevin MacLeod (CC BY 3.0) streamed from Wikimedia Commons, which allows cross-origin analysis (`data/music.json`, credit shown while playing); your own file (played only in your browser); or the microphone (nothing is recorded or sent). Open with `#music` to go straight to the controls. The audio must start from a tap (browser rule). Limits: the splat order is sorted for the still model, so strong stretch can show small sorting errors; trained splat sets have no building groups yet, so they do not animate.

## Skyline by year (added 2026-10-03)

Layers, "Skyline by year": the buildings on the estate and 300 m round it take their measured height in each Environment Agency LiDAR surface model that flew them: 1999 (2 m), 2003 (1 m), 2007 (0.5 m), 2012 (0.5 and 1 m), 2018, 2020 and 2022 (1 m). The 2015 survey is left out: it flew under 20% of the box (its tile over the estate is 99% empty). Height = 90th percentile of the surface model inside today's OSM outline minus the model ground; a building under 3 m, or under a quarter of its height today (a cleared site with hoardings), is not standing that year. Checked against known dates: 8 Canada Square (2002) absent in 1999 and 209 m from 2007; Landmark Pinnacle 87 m in 2018 (under construction) and 234 m from 2020; One Park Drive measured 51 m in 2018, under a quarter of its 204 m, so it shows from 2020. The 2022 composite has no flight dates in its file names. Limits: today's outlines only, so buildings demolished before today do not appear; a building that a survey did not fly keeps today's height that year, drawn in slate blue (the note under the slider gives the count). Build: `bash magpie/cwplans/tools/fetch-dsm.sh` (1 GB into data/raw/dsm/, not committed) and `node --max-old-space-size=12000 magpie/cwplans/tools/build-skyline.mjs` (about 7 minutes). Output `data/skyline.json` with the survey dates.

## Walking network and routes (added 2026-10-03)

- `data/indoor.js` (built by `node magpie/cwplans/tools/build-indoor.mjs`, about 1 minute): the OSM walking network of the Canary Wharf area with each point on its level: 10,647 points, 13,044 links (277 stair, 46 escalator and 47 lift links), levels -4 to +2, and 789 named places (shops, food and drink, entertainment, services, platforms, entrances).
- How it is built: one network point per (OSM node, level); stairs and escalators are oriented by the levels their ends touch (or `incline`); lifts join their listed levels; walkable areas (platforms, concourses, indoor corridors and rooms) get a hub joined to every path end inside them or within 3 m of their edge; nodes that ways reach at two levels with no connector are joined and counted as faults.
- In the page (Route tab): "Show the walking network" draws it (pink indoor, orange stairs, yellow escalators, blue lifts); "Route from … to …" finds the quickest route (walking 1.3 m/s, stairs 0.5 m/s, escalators 0.75 m/s, lifts 25 s + 4 s a level), with a step-free option that uses lifts and ramps only, and lists the steps. A typed name with several branches resolves to the one nearest the start.
- Example: Jubilee line westbound platform (level -3) to Rituals (Jubilee Place, level -2): 192 m by escalator; step-free 284 m by lift.
- Stations: TfL's step-free topology (GTFS pathways, 2026-08-03) adds 68 station points and 51 lift links with TfL's level numbers; they join the OSM network at street level only, because TfL and OSM number levels below the street differently (audit NET-5). Routes read TfL's live lift faults (`api.tfl.gov.uk/Disruptions/Lifts/v2`) and avoid lifts that are out of service. Powered by TfL Open Data.
- Limits, measured by the audit (NET-1 to NET-5): 42 unjoined parts; 192 points where OSM joins two levels with no connector; 18 escalators and 11 lifts without their levels; 46 places with no corridor on their own level. Heights are ground + level × storey height. Estate and station plans are being collected to close these gaps.

## Known gaps

From `FACTS.md`, not found in any source fetched:
- the height of the DLR viaduct at Canary Wharf, Heron Quays and West India Quay
- platform depths at Wapping, Rotherhithe, Canning Town and Island Gardens
- depths of the Jubilee line under the Thames between stations (TfL refused tunnel alignments in FOI 1700-1213 on security grounds); Blackwall Tunnel inverts are known only from a desk study (about -20.4 and -24.4 m OD), not yet used
- the levels of the Canada Place, Cabot Place and Churchill Place malls, and the service roads under the estate
- present water depths of docks other than North Dock
- a numeric ground log at Canary Wharf itself

Jubilee line rail levels (added 2026-10-03): TfL FOI-0493-2223 gives the rail level in every Jubilee platform in London Underground Datum (OD - 100 m): Canary Wharf -15.6, Canada Water -13.3, North Greenwich -13.5, Bermondsey -12.5, London Bridge -23.2 (Northern line -19.6) m OD. They are tunnel controls now. They replace two rounded depths (Canada Water "22 m down", North Greenwich "25 m down"), which were 4 and 6 m deeper (audit AT-5). Source records for the whole underground estate: `../feeds/underground/README.md`.

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
