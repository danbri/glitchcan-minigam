# Maps

`<edot-maps>` is a mobile-first, accessible maps viewer built on MapLibre GL JS. It covers the everyday needs met by the major mapping platforms: a pannable/zoomable/tiltable map, place search, saved places with IndexedDB persistence, directions, a basemap layer switcher, KML/KMZ overlay import, GeoJSON saved-places import/export, and shareable URL-hash permalinks. It is a light-DOM custom element (`edot-maps`) sharing a single stylesheet (`css/maps.css`) — no shadow DOM, no bundler, no runtime CDN. MapLibre is vendored locally (`vendor/maplibre-gl.js`). If WebGL is unavailable (e.g. CI without a GL backend), the map canvas is not created and a notice is shown; all non-GL logic (search parsing, saved-place CRUD, routing maths, hash encode/decode, GeoJSON helpers) still works and is fully testable headless. Entry point: `magpie/edot/maps/maps.html`.

**Headless caveat:** tile rendering, actual 3D relief pixels, real WebGL extrusion, and WebXR sessions cannot be verified in CI. The Playwright suites run SwiftShader (no network) and assert config + DOM state only. Features marked `[partial]` below are implemented but have unverifiable render paths in CI; verify them in a real browser with network access.

---

## Features

- **Basemap OSM (raster)** `[stable]` — default; OpenStreetMap raster tiles via the Nominatim-family config. Subdomain expansion (`{s}`) handled by `basemap.js`.
- **Basemap Carto Light (raster)** `[stable]` — CARTO light raster tiles; four subdomains expanded at style-build time.
- **Basemap Streets/vector (OpenFreeMap)** `[stable]` — keyless vector style at `https://tiles.openfreemap.org/styles/liberty`; required for 3D buildings. Style resolved as a URL; MapLibre fetches the style JSON at runtime.
- **3D terrain** `[partial]` — `⛰ 3D` toolbar button. Adds a `raster-dem` DEM source (AWS Open Data Terrain Tiles, Terrarium encoding, no API key), calls `setTerrain()` and `setSky()`, eases pitch to 60°. Falls back to flat 2D with a notice if DEM tiles fail. Config in `maps-config.js` under `terrain`. Rendered relief pixels not verified headless.
- **3D buildings** `[partial]` — `🏙 3D buildings` toolbar button. Extrudes building footprints from the active vector style's `fill-extrusion` or auto-detected `building` source-layer (`detectBuildingSource`). Height resolves via `coalesce`: `height` → `render_height` → `building:levels`×3m → 6m default. If the active basemap is raster (no footprints), the button auto-switches to the vector basemap and tilts in one step. Actual extrusion pixels not verified headless.
- **Saved places / pins** `[stable]` — full CRUD (save, update, delete) persisted to IndexedDB via `PlacesStore`. HTML markers with colour-coded dots, popup with name/note/coordinates, delete button. Rendered as both HTML markers and a backing GeoJSON source (`saved-places`). Survives page reload.
- **Pin toggle** `[stable]` — `📍 Pins` button hides/shows all saved-place markers and the GeoJSON circle layer; `aria-pressed` tracks state.
- **Search / geocoding** `[stable]` — geocodes via Nominatim (`buildGeocodeUrl` / `parseGeocodeResults`). Places a transient marker with a "Save place" popup. Shows a dropdown result list with keyboard navigation. Network-gated; shows a notice on error.
- **Drop marker (long-press / right-click)** `[stable]` — `contextmenu` event drops a transient pin at the tapped location with a "Save place" popup.
- **Routing / directions** `[stable]` — `🛣 Directions` toolbar button reveals a directions panel. Resolves `lat,lng` inputs without network; geocodes named places via Nominatim. Routes via OSRM (`driving` profile). Draws a blue polyline on the map and shows formatted distance + duration. `routeFromFixture()` applies a raw OSRM JSON response directly (used in tests).
- **GeoJSON import** `[stable]` — `⬆ Import` button in the sidebar (accessible via `☰` drawer on mobile) reads a `.geojson` / `.json` file and adds point features as saved places. Non-point geometries are skipped. Shows a notice if no point features found or the file is not valid GeoJSON.
- **GeoJSON export** `[stable]` — `⬇ Export` button serialises all saved places as a GeoJSON FeatureCollection and triggers a download (`edot-places.geojson`).
- **KML / KMZ import** `[stable]` — `🌍 KML` button in the sidebar (accessible via `☰` drawer on mobile) opens a `.kml` or `.kmz` file. KML is parsed to GeoJSON via `kmlToGeoJson` (real DOMParser; not string parsing). KMZ is unzipped via `DecompressionStream`. Renders three map layers: polygon fill, line, point. Overlays are transient (not persisted). A style switch re-applies the last opened overlay.
- **Events-as-map-layer** `[partial]` — opt-in via `?events` query param. `events-layer.js` reads the calendar's IndexedDB store, filters events with a `locationGeo` coordinate, and draws them as a GeoJSON circle/halo/label layer (`edot-events`). Clicking a feature shows a popup with title, location, ISO timestamp, and Wikidata QID link. Requires the calendar app's store to be populated; network-independent once seeded.
- **WebXR capability gating** `[partial]` — `🥽 XR` button is hidden by default. `xrSupport()` probes `navigator.xr.isSessionSupported` for `immersive-ar` then `immersive-vr`. If supported, the button is revealed and labelled `AR` or `VR`. `enterXr()` starts an immersive session with a minimal cleared frame loop. Never shown on iOS / desktops without a headset. XR session itself is not testable headless.
- **Geolocation** `[stable]` — `🧭 My location` button triggers MapLibre's `GeolocateControl` (track user location, high accuracy); falls back to raw `navigator.geolocation` when the control is absent.
- **Shareable permalink hash** `[stable]` — URL hash format `#map=<zoom>/<lat>/<lng>` optionally suffixed `/<markerLng>,<markerLat>`. Updated on `moveend` via `history.replaceState`. Decoded on load and on `hashchange`.
- **Notices / toast** `[partial]` — transient status messages shown in a `.mp-notice` overlay (auto-dismiss after 4 s, tap-to-dismiss). Used for: WebGL unavailability, terrain load failure, XR errors, basemap switches, KML parsing errors, and geolocation denial. The notice DOM exists but toast plumbing depends on `_notice` being set before any notice call — no independent queue.

---

## Side-effecting actions (command-registry inventory)

| Action | Trigger (toolbar / sidebar / drawer / API) | Effect | Proposed command id |
|---|---|---|---|
| Switch basemap | `mp-select` dropdown in toolbar | Calls `setStyle()` on the MapLibre map; re-adds sources/layers on `styledata`; updates `_layerSel.value` and `this.basemap` | `maps.setBasemap` |
| Toggle 3D terrain | `⛰ 3D` button in toolbar | Adds DEM source, calls `setTerrain()` / `setSky()`, eases pitch to 60°; reversing sets terrain null, sky null, returns pitch/bearing to 0 | `maps.toggle3D` |
| Toggle 3D buildings | `🏙 3D buildings` button in toolbar | Adds/removes `fill-extrusion` layer; auto-switches to vector basemap + tilts if raster basemap active | `maps.toggleBuildings` |
| Toggle saved-places pins | `📍 Pins` button in toolbar | Sets `visibility` on the `saved-places` GeoJSON layer; shows/hides all HTML markers; flips `aria-pressed` | `maps.togglePlacesLayer` |
| Search / geocode | Search form submit / `🔎` button in toolbar | Fetches Nominatim, renders result list, flies map to first result, places transient marker with Save popup | `maps.geocodeAndFly` |
| Drop marker (context menu) | Right-click / long-press on map | Places transient marker at tapped coordinates with Save popup | `maps.dropMarker` |
| Save place | "＋ Save place" in marker popup | Writes a new place to IndexedDB, refreshes marker layer and sidebar list | `maps.savePlace` |
| Delete place | `🗑` delete button in sidebar list | Removes place from IndexedDB, removes marker from map | `maps.deletePlace` |
| Fly to saved place | Place name button in sidebar list | Flies map to the place's coordinates; closes the mobile drawer | `maps.flyTo` |
| Toggle directions panel | `🛣 Directions` button in toolbar | Shows/hides `.mp-directions` form; focuses From input on open | `maps.toggleDirections` |
| Calculate route | Directions form submit | Resolves both endpoints (lat,lng or geocode), calls OSRM, draws blue polyline, shows distance+duration summary | `maps.route` |
| Clear route | API: `clearRoute()` | Empties the route GeoJSON source; clears summary text | `maps.clearRoute` |
| Import GeoJSON (places) | `⬆ Import` in sidebar (via `☰` drawer on mobile) | Reads file, parses GeoJSON, adds Point features as saved places to IndexedDB | `maps.importGeoJson` |
| Export GeoJSON (places) | `⬇ Export` in sidebar (via `☰` drawer on mobile) | Serialises saved places as FeatureCollection, triggers download of `edot-places.geojson` | `maps.exportGeoJson` |
| Import KML / KMZ | `🌍 KML` in sidebar (via `☰` drawer on mobile) | Reads file, converts KML→GeoJSON, adds three map layers (fill/line/point), fits bounds | `maps.importKml` |
| Clear KML overlay | API: `clearKml()` | Removes `imported-kml-fill`, `-line`, `-pt` layers and the `imported-kml` source | `maps.clearKml` |
| Geolocate (my location) | `🧭 My location` button in toolbar | Triggers `GeolocateControl.trigger()` or falls back to raw `navigator.geolocation` | `maps.locate` |
| Enter XR | `🥽 XR/AR/VR` button in toolbar (hidden unless supported) | Calls `xrEnter(mode)`, starts immersive session frame loop | `maps.enterXr` |
| Open saved-places drawer | `☰` button in toolbar (mobile) | Toggles `side-open` class on root; reveals the sidebar on narrow viewports | `maps.toggleSidebar` |
| Apply permalink hash | `hashchange` / on load | Calls `map.jumpTo()` with decoded centre/zoom; restores a shared marker | `maps.applyHash` |

---

## User journeys

1. **Switch basemap and enable 3D buildings.** User opens the map (OSM raster by default). They open the basemap `<select>` and choose "Streets (vector · 3D buildings)". MapLibre loads the OpenFreeMap vector style. They then click `🏙 3D buildings` — the component auto-detects the `building` source-layer from the OpenMapTiles schema, adds a `fill-extrusion` layer, and eases the pitch to 55°. If they were already on a raster basemap when they clicked Buildings, the component shows "Switching to the vector basemap…" and performs both steps in sequence.

2. **Save a place from a search.** User types "Clifton Suspension Bridge" in the search box and submits. The app geocodes via Nominatim, flies to the first result, and shows a transient marker popup with the result name, coordinates, and a "＋ Save place" button. User clicks Save. The place is written to IndexedDB, appears in the sidebar list with its colour dot, and a permanent HTML marker appears on the map. On a narrow screen the user taps `☰` to open the sidebar and see the saved place in the list.

3. **Get directions.** User taps `🛣 Directions`, which reveals the directions form. They type `51.45, -2.59` in From (resolved client-side, no network) and "Bristol Temple Meads" in To (geocoded via Nominatim). After submitting, the app fetches an OSRM route, draws a blue polyline on the map, fits the bounds to the route, and shows "5.2 km · 11 min" in the summary line.

4. **Import a KML overlay.** User taps `☰` to open the saved-places drawer, then clicks `🌍 KML`. They pick a `.kml` file containing placemarks and linestrings. The app parses it with `kmlToGeoJson` (DOMParser-based), adds polygon fill, line, and point layers to the map, and fits the map to the overlay's bounding box. The overlay is labelled as transient — if the user switches basemap, it is re-applied automatically on `styledata`.

5. **View calendar events on the map.** User navigates to `maps.html?events`. The page loads normally then calls `mountEventOverlay()`, which reads `locationGeo` coordinates from the calendar's IndexedDB store. Located events appear as blue circle + halo + label markers on the map. Clicking one opens a popup showing the event title, location text, ISO start time, and a Wikidata link if the location was resolved.

6. **Share a map view.** User pans and zooms the map; the URL hash updates automatically to `#map=14/51.4545/-2.5879`. They copy and share the URL. A recipient opens it — `applyHash()` reads the hash on load and calls `map.jumpTo()` to restore the exact view. If the hash also encoded a marker (e.g. dropped via right-click before sharing), the transient marker is restored too.

---

## Test coverage

| Feature | Covered by (suite::assertion label) | Status |
|---|---|---|
| Component boot + control scaffold | test-maps.mjs::"component booted and built its controls" | stable |
| MapLibre map object (smoke) | test-maps.mjs::"MapLibre map object exists (smoke)" | conditional on GL |
| Geocode parser (drops invalid, normalises lat/lon, bbox) | test-maps.mjs::"geocode parser drops invalid + keeps valid results", "geocode parser normalises lat/lon to numbers", "geocode parser normalises bbox to [W,S,E,N]" | stable |
| Geocode URL shape | test-maps.mjs::"geocode URL carries the query + format" | stable |
| Route fixture → polyline + distance | test-maps.mjs::"route fixture parses to a 3-point polyline", "route distance is read from the response" | stable |
| Route summary formatting | test-maps.mjs::"route summary formats distance + duration" | stable |
| OSRM URL shape | test-maps.mjs::"route URL is OSRM-shaped (lng,lat;lng,lat + geojson)" | stable |
| Distance/duration formatters (edge cases) | test-maps.mjs::"formatters: metres/km/seconds/minutes/hours" | stable |
| Save place persisted to IndexedDB | test-maps.mjs::"savePlace persists to IndexedDB" | stable |
| Saved place appears in sidebar | test-maps.mjs::"saved place renders in the sidebar list" | stable |
| updatePlace writes back to store | test-maps.mjs::"updatePlace writes back the edited note" | stable |
| deletePlace removes from store | test-maps.mjs::"deletePlace removes it from the store" | stable |
| Persistence across reload | test-maps.mjs::"saved places survive a page reload" | stable |
| GeoJSON export (Point features) | test-maps.mjs::"places export to GeoJSON Point features" | stable |
| GeoJSON round-trip (name/note/coords) | test-maps.mjs::"GeoJSON round-trips name/note/coords" | stable |
| GeoJSON import tolerates minimal foreign export | test-maps.mjs::"import tolerates a minimal foreign export" | stable |
| GeoJSON import skips non-Point geometry | test-maps.mjs::"import skips non-Point geometry" | stable |
| importGeoJsonFile (file path) adds both points | test-maps.mjs::"importGeoJsonFile adds both points" | stable |
| Places-layer toggle (aria-pressed) | test-maps.mjs::"places-layer toggle flips aria-pressed" | stable |
| Places-layer toggle (MapLibre visibility) | test-maps.mjs::"places-layer toggle sets layer visibility=none when hidden" | stable |
| Hash encode (z/lat/lng) | test-maps.mjs::"hash encodes z/lat/lng" | stable |
| Hash decode (center+zoom) | test-maps.mjs::"hash decodes back to center+zoom" | stable |
| Hash round-trip with optional marker | test-maps.mjs::"hash round-trips an optional marker" | stable |
| Non-map hash decodes to null | test-maps.mjs::"non-map hash decodes to null" | stable |
| applyHash jumps the live map | test-maps.mjs::"applyHash jumps the map to the shared view" | conditional on GL |
| Raster basemap builds valid inline style | test-maps.mjs::"raster basemap builds a valid inline style with OSM tiles" | stable |
| Raster basemap attribution present | test-maps.mjs::"raster basemap carries attribution" | stable |
| Subdomain expansion | test-maps.mjs::"{s} subdomains expand to multiple tile URLs" | stable |
| Vector basemap resolves to URL | test-maps.mjs::"vector basemap resolves to a style URL" | stable |
| Building-capable basemap configured | test-maps.mjs::"a building-capable vector basemap is configured (3D buildings have a source)" | stable |
| setBasemap switches state + select | test-maps.mjs::"setBasemap switches the active basemap + select" | stable |
| Directions panel opens | test-maps.mjs::"directions panel opens" | stable |
| lat,lng input resolves without network | test-maps.mjs::'"lat,lng" input resolves to [lng,lat] without network' | stable |
| No page errors (test-maps) | test-maps.mjs::"no page errors" | stable |
| DEM source spec (raster-dem, tiles, encoding) | test-maps3d.mjs::"DEM source is raster-dem with the configured tiles + encoding" | stable |
| Terrain spec (source + exaggeration) | test-maps3d.mjs::"terrain spec references the DEM source + exaggeration" | stable |
| Sky spec colours | test-maps3d.mjs::"sky spec carries sky/horizon/fog colours for setSky" | stable |
| DEM builder null when no tiles | test-maps3d.mjs::"DEM builder returns null when no tiles configured" | stable |
| Buildings layer (fill-extrusion + height expression) | test-maps3d.mjs::"buildings layer is a fill-extrusion with height expression" | stable |
| detectBuildingSource prefers existing extrusion | test-maps3d.mjs::"detect prefers an existing fill-extrusion source/source-layer" | stable |
| detectBuildingSource fallback to vector source | test-maps3d.mjs::"detect falls back to a vector source + guessed building layer" | stable |
| detectBuildingSource returns null for raster-only | test-maps3d.mjs::"detect returns null for a raster-only style" | stable |
| KML parses to FeatureCollection | test-maps3d.mjs::"KML parses to a FeatureCollection" | stable |
| KML Point/Line/Polygon/MultiGeometry (5 features) | test-maps3d.mjs::"KML yields point/line/polygon + 2 from MultiGeometry (5 features)" | stable |
| KML Point lng/lat correct, altitude dropped | test-maps3d.mjs::"KML Point keeps lng,lat and drops altitude" | stable |
| KML LineString vertices | test-maps3d.mjs::"KML LineString has 3 vertices" | stable |
| KML Polygon ring closed | test-maps3d.mjs::"KML Polygon ring is closed (first==last)" | stable |
| KML MultiGeometry + ExtendedData | test-maps3d.mjs::"KML MultiGeometry expands to separate features w/ ExtendedData" | stable |
| Malformed KML throws | test-maps3d.mjs::"malformed KML throws rather than mis-parsing" | stable |
| featureCollectionBounds spans all coords | test-maps3d.mjs::"bounds spans all coordinates [[W,S],[E,N]]" | stable |
| featureCollectionBounds null for empty | test-maps3d.mjs::"bounds is null for an empty collection" | stable |
| 3D toggle DOM wiring (aria-pressed) | test-maps3d.mjs::"3D toggle button starts off and flips aria-pressed on/off" | stable |
| toggle3D updates is3D state field | test-maps3d.mjs::"toggle3D updates the is3D state field" | stable |
| Buildings toggle present and toggleable | test-maps3d.mjs::"Buildings toggle button is present and toggleable" | stable |
| KML import button wired in sidebar | test-maps3d.mjs::"KML import control exists in the toolbar" | stable |
| addKmlGeoJson records the overlay FC | test-maps3d.mjs::"addKmlGeoJson records the overlay FeatureCollection" | stable |
| Enabling 3D adds DEM source (live map) | test-maps3d.mjs::"enabling 3D adds the DEM source (live map)" | conditional on GL |
| No page errors (test-maps3d) | test-maps3d.mjs::"no page errors" | stable |
| XR button hidden without WebXR | test-maps-xr.mjs::"XR button is hidden when the device has no WebXR" | stable |
| XR button shown when immersive-vr supported | test-maps-xr.mjs::"XR button is shown when the device supports immersive-vr" | stable |
| XR button labelled for the supported mode | test-maps-xr.mjs::"XR button is labelled for the supported mode (VR)" | stable |
| eventsToFeatures drops un-located, carries QID | test-events-layer.mjs::"eventsToFeatures keeps only located events, carries the QID" | stable |
| loadEventFeatures reads located events from IndexedDB | test-events-layer.mjs::"loadEventFeatures reads the two located events back (un-located skipped)" | stable |
| Event features carry calendar QIDs | test-events-layer.mjs::"features carry the calendar QIDs" | stable |
| drawEvents adds source + circle/halo/label layers | test-events-layer.mjs::"drawEvents adds the events source + circle/halo/label layers" | stable |
| drawEvents feeds features to the source | test-events-layer.mjs::"the source is fed the event features" | stable |
| No page errors (test-events-layer) | test-events-layer.mjs::"no page errors" | stable |

Total across all four suites: **70 assertions** (37 + 24 + 3 + 6).

### Gaps (untested)

The following behaviours are implemented but cannot be verified headless:

- **Rendered tile pixels** — basemap raster and vector tiles require network + working GL; SwiftShader runs at ~2 FPS with no outbound network in CI.
- **3D terrain relief** — actual rendered elevation displacement via `setTerrain()` is not pixel-asserted; only the config/source handed to MapLibre is tested.
- **3D building extrusion render** — `fill-extrusion` geometry is not pixel-verified; only layer spec and toggle state are asserted.
- **Basemap auto-switch for buildings** — the `_addBuildings()` path that calls `setBasemap()` when no footprints are found on the current style runs only when a live map is present and a raster basemap is active.
- **XR immersive session** — `enterXr()` requires a real XR device; only capability-gating (button visibility + label) is tested.
- **Drop marker (contextmenu)** — `dropMarker()` is covered by code path but no test drives a right-click on the map canvas.
- **Geolocation (locate())** — `GeolocateControl.trigger()` and the raw geolocation fallback are not tested (no permission/GPS in CI).
- **Directions with named endpoints** — only the `lat,lng` fast path is tested; the geocode-and-route network path is not exercised in CI.
- **KMZ inflate path** — `kmzToKml()` (DecompressionStream) is described as verified end-to-end during development but no automated test covers it.
- **Mobile drawer reachability** — the `☰` button toggle is not asserted in the maps tests (though the calendar suite covers the analogous pattern).
- **Notice auto-dismiss timer** — `_showNotice()` sets a `setTimeout`; no test asserts that the notice disappears after 4 s.
- **Export download trigger** — `exportGeoJson()` creates an `<a>` and calls `.click()` in the DOM; no test verifies the download was initiated.
- **Events popup click** — the `click` handler on the `edot-events` layer shows a MapLibre popup; not tested.

---

## Known issues

- **Import/Export reachability on mobile.** The `⬆ Import`, `⬇ Export`, and `🌍 KML` controls live inside the `.mp-side` sidebar, which collapses below the map on narrow viewports. They are reachable via the `☰` menu button, which toggles the `side-open` class and slides the sidebar into view. The controls are not duplicated in the toolbar, so they require the drawer to be open on mobile. This is by design, not a regression, but the test suite does not assert the drawer-then-import path.
- **Toast / notice queue.** `_showNotice()` is a single-slot notice: a second notice arriving within the auto-dismiss window replaces the first without queuing. If two rapid error conditions fire (e.g. a terrain 404 immediately after a basemap switch), only the second message is visible.
- **Gaussian splat layer stub.** `js/splats.js` is an explicitly inert placeholder (`addSplatLayer()` returns `{ added: false, reason: … }` unconditionally). It is documented in `README-3D.md` as a future integration requiring a vendored renderer.
- **Vector basemap online-only.** The OpenFreeMap vector style (`openfreemap` basemap) is fetched from `https://tiles.openfreemap.org/styles/liberty` at runtime. There is no offline fallback; if the endpoint is unreachable, the basemap switch silently leaves the style in a broken state with no user-visible notice.
- **KMZ streaming data descriptors not handled.** `kmzToKml()` requires the compressed size to be present in the ZIP local-file header. KMZ files produced with streaming data descriptors (where sizes are written in a trailing footer rather than the local header) will fail. Google Earth, GDAL, and ogr2ogr output is handled correctly.
- **`applyHash` and `setBasemap` are conditional on GL.** Both functions take early-exit paths when `this.map` is null (no WebGL). Deep-linking to a basemap other than the default cannot be encoded in the hash format; the hash carries only zoom/centre/marker.
