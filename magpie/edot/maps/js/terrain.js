// terrain.js — pure helpers for MapLibre-native 3D: a raster-DEM terrain source,
// a sky/atmosphere layer, and a 3D-buildings fill-extrusion layer.
//
// Everything here is network-free and side-effect-free (it only builds plain
// config objects), so it is unit-testable headless without WebGL. The component
// (maps-app.js) hands these objects to the live map's setTerrain/addLayer/
// addSource. If the DEM tiles or the basemap's building data are missing, the
// component degrades gracefully (it just doesn't add the layer / drops to 2D).
//
// DEM choice: MapLibre needs a raster *Terrain-RGB / Terrarium* encoded DEM. The
// default below (AWS Terrain Tiles, Terrarium encoding, public, no API key) is
// the only widely-usable keyless DEM. If a deployment prefers another DEM it is
// pointed at via MAPS_CONFIG.terrain (encoding + tiles), so no code edit needed.

export const TERRAIN_SRC = 'terrain-dem';
export const BUILDINGS_LAYER = 'edot-3d-buildings';

// Build the raster-DEM source object for addSource(TERRAIN_SRC, …).
// `cfg` is MAPS_CONFIG.terrain. Encoding is 'terrarium' or 'mapbox'.
export function buildDemSource(cfg) {
  if (!cfg || !Array.isArray(cfg.tiles) || !cfg.tiles.length) return null;
  return {
    type: 'raster-dem',
    tiles: cfg.tiles.slice(),
    tileSize: cfg.tileSize || 256,
    minzoom: cfg.minzoom || 0,
    maxzoom: cfg.maxzoom || 15,
    // 'terrarium' (Mapzen/AWS) or 'mapbox' (Terrain-RGB). MapLibre decodes both.
    encoding: cfg.encoding || 'terrarium',
    attribution: cfg.attribution || '',
  };
}

// The setTerrain() argument: which source to read elevation from + exaggeration.
export function buildTerrainSpec(cfg) {
  if (!cfg) return null;
  const ex = Number.isFinite(cfg.exaggeration) ? cfg.exaggeration : 1.3;
  return { source: TERRAIN_SRC, exaggeration: ex };
}

// The sky/atmosphere spec for map.setSky() (MapLibre v5 — the sky is a map-level
// property, not a layer). Gentle daylight defaults; tweakable via cfg.sky.
// Returns a plain object suitable for `map.setSky(spec)`.
export function buildSkySpec(cfg = {}) {
  const sky = cfg.sky || {};
  return {
    'sky-color': sky.skyColor || '#88c1ec',
    'horizon-color': sky.horizonColor || '#dfe9f2',
    'fog-color': sky.fogColor || '#e8eef5',
    'horizon-fog-blend': Number.isFinite(sky.horizonFogBlend) ? sky.horizonFogBlend : 0.5,
    'fog-ground-blend': Number.isFinite(sky.fogGroundBlend) ? sky.fogGroundBlend : 0.5,
    'sky-horizon-blend': Number.isFinite(sky.skyHorizonBlend) ? sky.skyHorizonBlend : 0.8,
    'atmosphere-blend': Number.isFinite(sky.atmosphereBlend) ? sky.atmosphereBlend : 0.8,
  };
}

// A fill-extrusion layer that extrudes building footprints by height. It reads
// from a vector source+source-layer (whatever the active style exposes for
// buildings). Returns null when we don't know where the buildings live.
//
// `opts`: { source, sourceLayer, heightProp, levelsProp, color, minZoom }.
// Height resolves to: numeric `height` → `render_height` → levels×3m → 6m.
export function buildBuildingsLayer(opts = {}) {
  const source = opts.source;
  if (!source) return null;
  const heightProp = opts.heightProp || 'height';
  const levelsProp = opts.levelsProp || 'building:levels';
  const layer = {
    id: BUILDINGS_LAYER,
    type: 'fill-extrusion',
    source,
    minzoom: Number.isFinite(opts.minZoom) ? opts.minZoom : 14,
    paint: {
      'fill-extrusion-color': opts.color || '#b9a88f',
      'fill-extrusion-height': [
        'coalesce',
        ['to-number', ['get', heightProp]],
        ['to-number', ['get', 'render_height']],
        ['*', ['to-number', ['get', levelsProp]], 3],
        6,
      ],
      'fill-extrusion-base': [
        'coalesce',
        ['to-number', ['get', 'min_height']],
        ['to-number', ['get', 'render_min_height']],
        0,
      ],
      'fill-extrusion-opacity': Number.isFinite(opts.opacity) ? opts.opacity : 0.85,
    },
  };
  if (opts.sourceLayer) layer['source-layer'] = opts.sourceLayer;
  if (opts.filter) layer.filter = opts.filter;
  return layer;
}

// Inspect a loaded style's sources for a vector source likely to carry building
// footprints, so 3D buildings can light up automatically on vector basemaps that
// expose them. Returns { source, sourceLayer } or null. `style` is the object
// returned by map.getStyle(). This is a best-effort heuristic, not magic: many
// styles already declare their own building layers; we only add ours when we can
// confidently find a building source-layer and the style hasn't got an extrusion.
export function detectBuildingSource(style) {
  if (!style || !style.sources) return null;
  // Prefer an existing fill-extrusion layer's source/source-layer — that's the
  // ground truth for where buildings live in this style.
  for (const l of style.layers || []) {
    if (l.type === 'fill-extrusion' && l.source) {
      return { source: l.source, sourceLayer: l['source-layer'] || null, existing: l.id };
    }
  }
  // Otherwise look for a vector source and guess a 'building' source-layer.
  for (const [id, src] of Object.entries(style.sources)) {
    if (src && src.type === 'vector') return { source: id, sourceLayer: 'building' };
  }
  return null;
}
