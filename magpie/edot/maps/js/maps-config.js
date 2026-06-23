// maps-config.js — configurable endpoints and defaults for the maps viewer.
//
// Everything that touches the network (basemap tiles, geocoding, routing) is
// pulled from here so a deployment can be re-pointed at self-hosted services
// without editing component code. Defaults use community demo endpoints; they
// are rate-limited and, per their usage policies, require a sane zoom range and
// visible attribution (both honoured by the component).
//
// No personal/dataset content is ever stored remotely — the only persistence
// is the user's own saved places in IndexedDB (see CLAUDE.md data-ethics rule).

export const MAPS_CONFIG = {
  // Initial view (Bristol — matches the repo's OSM/trees lineage). Overridden by
  // the URL hash when present.
  defaultCenter: [-2.5879, 51.4545], // [lng, lat]
  defaultZoom: 12,
  minZoom: 1,
  maxZoom: 19, // OSM raster tiles top out around 19.

  // Basemaps: a raster OSM style works with zero vector-tile backend, so it is
  // the default. A vector style URL can be swapped in (any MapLibre style JSON
  // or remote .json). The layer switcher lists every entry here.
  basemaps: {
    osm: {
      label: 'OSM (raster)',
      type: 'raster',
      // {s} is expanded to a/b/c by buildRasterStyle.
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
    carto_light: {
      label: 'Carto Light (raster)',
      type: 'raster',
      tiles: ['https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
      subdomains: ['a', 'b', 'c', 'd'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
    // A vector style: a full MapLibre style JSON served remotely. Only usable
    // online; falls back to a raster basemap if it fails to load.
    vector_demo: {
      label: 'Vector (demo)',
      type: 'vector',
      styleUrl: 'https://demotiles.maplibre.org/style.json',
      attribution: '© OpenStreetMap contributors',
    },
  },
  defaultBasemap: 'osm',

  // Geocoding (place name -> coords). Nominatim demo endpoint; network-gated.
  // The response parser (parseGeocodeResults) is pure and unit-tested.
  geocoder: {
    url: 'https://nominatim.openstreetmap.org/search',
    format: 'jsonv2',
    limit: 6,
  },

  // Routing (A -> B). OSRM demo server; network-gated. The GeoJSON/route parser
  // (parseRoute) is pure and unit-tested against a fixture.
  router: {
    // {profile}/{coords} are filled by buildRouteUrl. coords = "lng,lat;lng,lat".
    url: 'https://router.project-osrm.org/route/v1',
    profile: 'driving',
  },

  // Saved-place marker colours offered in the editor.
  placeColors: ['#8b4513', '#1a73e8', '#188038', '#b5126b', '#7b1fa2', '#e37400'],
};
