# edot maps — 3D / geospatial-3D features

This documents the 3D additions to `<edot-maps>`. Everything is **MapLibre-native
or pure JS** — no new runtime dependency, no CDN, no build step (CLAUDE.md rules).

## 1. 3D terrain (working)
A **⛰ 3D** toolbar button tilts the map into 3D using MapLibre's built-in terrain:

- Adds a `raster-dem` source (`terrain-dem`) and calls `map.setTerrain(...)`.
- Adds a sky/atmosphere via `map.setSky(...)` (MapLibre v5 API).
- Eases `pitch` to 60° (configurable). Drag-rotate / pitch gestures were already
  enabled in the base app (`pitchWithRotate`, `dragRotate`).
- Toggling off removes terrain + sky and returns pitch/bearing to 0.

**DEM source** is configurable in `js/maps-config.js` under `terrain`. The default
is **AWS Open Data Terrain Tiles** (Terrarium encoding, public, **no API key**) —
the one widely-usable keyless DEM. Re-point `terrain.tiles` / `terrain.encoding`
for a self-hosted or Mapbox-Terrain-RGB DEM. If the DEM tiles fail to load the
component shows a notice and **falls back to flat 2D** (no crash).

Builders live in `js/terrain.js` (`buildDemSource`, `buildTerrainSpec`,
`buildSkySpec`) and are pure / unit-tested in `test-maps3d.mjs`.

> Headless note (CLAUDE.md): WebGL runs via SwiftShader and the sandbox has no
> outbound network, so rendered relief *pixels* aren't asserted in CI. The tests
> assert the **config handed to MapLibre** and that enabling 3D adds the DEM
> source + terrain on the live map. Verify the actual relief in a real browser
> with network access.

## 2. 3D buildings (working where the basemap has footprints)
A **🏙 Buildings** toolbar button extrudes building footprints with a
`fill-extrusion` layer (`js/terrain.js` → `buildBuildingsLayer`). It
**auto-detects** the building source/source-layer from the active style
(`detectBuildingSource`): it prefers any existing `fill-extrusion` layer's
source, else guesses a `building` source-layer on a vector source.

Height resolves via a `coalesce` expression: `height` → `render_height` →
`building:levels`×3m → 6m default.

The default **raster** OSM basemap has **no** building footprints, so the button
is a **graceful no-op + notice** there. Switch to a **vector** basemap that
exposes buildings (e.g. an OpenMapTiles-schema style) to see extrusions. The
included `vector_demo` (demotiles) is country-level and has no buildings; point
`basemaps` at a fuller vector style for real 3D buildings.

## 3. KML / KMZ import (working, pure JS)
A **🌍 KML** sidebar button opens a `.kml` or `.kmz` file and renders it as a map
overlay (three layers: polygon fill, line, point).

- `js/kml.js` — pure KML→GeoJSON using the platform **DOMParser** (a real XML
  parser, not regex/string hackparsing). Handles Point, LineString, LinearRing,
  Polygon (with holes), MultiGeometry (→ separate features), gx:Track/MultiTrack,
  and folds `<name>`/`<description>`/`<ExtendedData>` into feature properties.
  Altitude is dropped for 2D GeoJSON (MapLibre drapes geometry on the terrain).
- `js/kmz.js` — unzips the KMZ (a ZIP) with **zero dependencies**: reads ZIP
  local-file headers and inflates `doc.kml` (or the first `.kml`) via the
  platform `DecompressionStream('deflate-raw')`. Stored (uncompressed) entries
  are returned as-is. (Limitation: requires the compressed size in the local
  header — true of Google Earth / GDAL / ogr2ogr output. Streaming data
  descriptors are not handled.)
- KML overlays are **transient** (not persisted). GeoJSON *Import* still adds
  **saved places** as before — unchanged.

Tested in `test-maps3d.mjs` (KML→GeoJSON, malformed-XML rejection, bounds) and
the KMZ inflate path verified end-to-end with a real `.kmz` during development.

## 4. Gaussian splats (STUB — not implemented, on purpose)
`js/splats.js` is an **inert, clearly-labelled placeholder**. A real 3D Gaussian
splat renderer is a large dependency we won't pull from a CDN, and faking a demo
would be dishonest. The stub documents exactly what a future integration needs:

1. A **vendored** self-contained splat renderer under `maps/vendor/` (+ licence).
2. A **`.splat` / `.ply` loader** (binary: position, scale, rotation quat, SH0
   colour, opacity per splat — parsed with a DataView, never strings).
3. A MapLibre **`CustomLayerInterface`** (`type:'custom'`, `renderingMode:'3d'`)
   sharing the map's GL context + view/projection matrix, georeferenced by an
   anchor lng/lat + local ENU frame.
4. Per-frame **depth sorting** of splats and respect for the map depth buffer so
   terrain/buildings occlude splats correctly.

`addSplatLayer()` returns `{ added:false, reason:… }` today.

## Config summary (`js/maps-config.js`)
- `terrain` — DEM tiles, encoding, tileSize, min/max zoom, exaggeration, pitch.
- `buildings` — color, opacity, minZoom (fallback hints; source is auto-detected).

## Tests
`node magpie/edot/run-tests.mjs maps` runs both `test-maps.mjs` (unchanged,
still green) and the new `test-maps3d.mjs`.
