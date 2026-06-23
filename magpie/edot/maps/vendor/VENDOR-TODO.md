# Vendored third-party libraries — edot maps

This app has **no runtime CDN dependency**. The map engine is vendored here.

## MapLibre GL JS — VENDORED ✅

- **Version:** 5.6.0
- **License:** BSD-3-Clause (see `LICENSE.txt`)
- **Files in this directory:**
  - `maplibre-gl.js` — the UMD bundle (defines `window.maplibregl`)
  - `maplibre-gl.css` — the control/popup stylesheet
  - `LICENSE.txt` — full BSD-3-Clause text + bundled-dependency notices
- **Loaded by:** `../maps.html` via
  `<script src="vendor/maplibre-gl.js"></script>` and
  `<link rel="stylesheet" href="vendor/maplibre-gl.css">`.

### If you ever need to re-fetch / upgrade

Outbound network in some environments is policy-restricted. If these files are
missing, drop in the exact versions from one of:

```
# unpkg (used for the current vendor)
curl -sSL -o maplibre-gl.js  https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js
curl -sSL -o maplibre-gl.css https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css
curl -sSL -o LICENSE.txt     https://unpkg.com/maplibre-gl@5.6.0/LICENSE.txt

# or GitHub release assets
#   https://github.com/maplibre/maplibre-gl-js/releases/tag/v5.6.0
```

The component (`js/maps-app.js`) **degrades gracefully** when `window.maplibregl`
is absent: it skips map creation, shows a notice, and still runs search-result
parsing, saved-place CRUD (IndexedDB), routing maths, GeoJSON import/export and
the permalink hash — all of which are unit-tested without WebGL.
