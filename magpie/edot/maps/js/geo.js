// geo.js — pure geo helpers: response parsing, URL building, distance/duration
// formatting, permalink hash encode/decode, and GeoJSON import/export.
//
// Everything here is deliberately network-free and side-effect-free so it can be
// unit-tested headless (no WebGL, no live geocoder/router). The component wires
// these to fetch() and to the map; the maths and parsing live here.

import { MAPS_CONFIG } from './maps-config.js';

// ---- coordinate helpers ----------------------------------------------------
export function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
export function isValidLngLat(lng, lat) {
  return Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

// Haversine great-circle distance in metres between two [lng,lat] points.
export function haversineMeters([lng1, lat1], [lng2, lat2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Length of a polyline ([[lng,lat],…]) in metres.
export function lineLengthMeters(coords) {
  let m = 0;
  for (let i = 1; i < coords.length; i++) m += haversineMeters(coords[i - 1], coords[i]);
  return m;
}

// ---- human formatting ------------------------------------------------------
export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

// ---- geocoding -------------------------------------------------------------
// Build a Nominatim-style search URL (configurable base).
export function buildGeocodeUrl(query, cfg = MAPS_CONFIG.geocoder) {
  const u = new URL(cfg.url);
  u.searchParams.set('q', query);
  u.searchParams.set('format', cfg.format || 'jsonv2');
  u.searchParams.set('limit', String(cfg.limit || 6));
  return u.toString();
}

// Parse a Nominatim JSON response into normalized results. Tolerant of the few
// field-name variants Nominatim emits (lat/lon strings; display_name).
export function parseGeocodeResults(json) {
  if (!Array.isArray(json)) return [];
  const out = [];
  for (const r of json) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon != null ? r.lon : r.lng);
    if (!isValidLngLat(lng, lat)) continue;
    out.push({
      name: r.display_name || r.name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      lng,
      lat,
      kind: r.type || r.class || '',
      // bbox is [south, north, west, east] in Nominatim; normalize to
      // [west, south, east, north] for MapLibre fitBounds, when present.
      bbox: Array.isArray(r.boundingbox) && r.boundingbox.length === 4
        ? [parseFloat(r.boundingbox[2]), parseFloat(r.boundingbox[0]),
           parseFloat(r.boundingbox[3]), parseFloat(r.boundingbox[1])]
        : null,
    });
  }
  return out;
}

// ---- routing ---------------------------------------------------------------
// Build an OSRM-style route URL. Points are [lng,lat]; OSRM wants lng,lat pairs.
export function buildRouteUrl(from, to, cfg = MAPS_CONFIG.router) {
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  return `${cfg.url}/${cfg.profile}/${coords}?overview=full&geometries=geojson`;
}

// Parse an OSRM route response -> { coords:[[lng,lat]…], distance, duration }.
// Falls back to computing distance from the geometry if the service omits it.
export function parseRoute(json) {
  if (!json || json.code && json.code !== 'Ok') {
    return { ok: false, error: (json && json.message) || (json && json.code) || 'No route' };
  }
  const route = json.routes && json.routes[0];
  if (!route) return { ok: false, error: 'No route' };
  let coords = [];
  const g = route.geometry;
  if (g && Array.isArray(g.coordinates)) coords = g.coordinates.map((c) => [c[0], c[1]]);
  const distance = Number.isFinite(route.distance) ? route.distance : lineLengthMeters(coords);
  const duration = Number.isFinite(route.duration) ? route.duration : NaN;
  return { ok: true, coords, distance, duration };
}

// A GeoJSON LineString feature for the route polyline (the map's route source).
export function routeToGeoJson(coords) {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords },
  };
}

// ---- permalink hash --------------------------------------------------------
// Encode map state into a compact URL hash: #map=z/lat/lng(/markerLng,markerLat)
// (z/lat/lng mirrors the common slippy-map convention).
export function encodeHash({ zoom, center, marker } = {}) {
  if (!center) return '';
  const z = (Math.round((zoom ?? 0) * 100) / 100);
  const lat = Number(center[1].toFixed(5));
  const lng = Number(center[0].toFixed(5));
  let h = `#map=${z}/${lat}/${lng}`;
  if (marker && isValidLngLat(marker[0], marker[1])) {
    h += `/${Number(marker[0].toFixed(5))},${Number(marker[1].toFixed(5))}`;
  }
  return h;
}

// Decode the hash back into state, or null if it isn't a map hash / is invalid.
export function decodeHash(hash) {
  if (!hash) return null;
  const m = String(hash).replace(/^#/, '').match(/^map=([^/]+)\/([^/]+)\/([^/]+)(?:\/([^,]+),([^/]+))?$/);
  if (!m) return null;
  const zoom = parseFloat(m[1]);
  const lat = parseFloat(m[2]);
  const lng = parseFloat(m[3]);
  if (!Number.isFinite(zoom) || !isValidLngLat(lng, lat)) return null;
  const out = { zoom, center: [lng, lat] };
  if (m[4] != null && m[5] != null) {
    const ml = parseFloat(m[4]);
    const mt = parseFloat(m[5]);
    if (isValidLngLat(ml, mt)) out.marker = [ml, mt];
  }
  return out;
}

// ---- GeoJSON bounds --------------------------------------------------------
// Walk every coordinate of a FeatureCollection / Feature / geometry and return
// [[west,south],[east,north]] (MapLibre fitBounds shape), or null if empty.
// Pure + recursive over nested coordinate arrays, so it handles Point /
// LineString / Polygon / Multi* uniformly.
export function featureCollectionBounds(json) {
  let w = Infinity; let s = Infinity; let e = -Infinity; let n = -Infinity;
  const eat = (lng, lat) => {
    if (!isValidLngLat(lng, lat)) return;
    if (lng < w) w = lng; if (lng > e) e = lng;
    if (lat < s) s = lat; if (lat > n) n = lat;
  };
  const walk = (c) => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number' && typeof c[1] === 'number') eat(c[0], c[1]);
    else for (const x of c) walk(x);
  };
  const feats = json && json.type === 'FeatureCollection' ? json.features
    : json && json.type === 'Feature' ? [json] : [];
  for (const f of feats || []) { if (f && f.geometry) walk(f.geometry.coordinates); }
  if (!Number.isFinite(w)) return null;
  return [[w, s], [e, n]];
}

// ---- GeoJSON import/export of saved places ---------------------------------
// Saved place: { id, name, note, lng, lat, color, created }.
export function placesToGeoJson(places) {
  return {
    type: 'FeatureCollection',
    features: places.map((p) => ({
      type: 'Feature',
      properties: { id: p.id, name: p.name, note: p.note || '', color: p.color || '', created: p.created || null },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  };
}

// Parse a GeoJSON FeatureCollection (or a single Feature) into saved places.
// Only Point features are imported; everything else is skipped. Robust to the
// minimal exports of other tools (missing properties).
export function geoJsonToPlaces(json, makeId = () => `p_${Math.random().toString(36).slice(2)}`) {
  const feats = json && json.type === 'FeatureCollection' ? json.features
    : json && json.type === 'Feature' ? [json] : [];
  const out = [];
  for (const f of feats || []) {
    const g = f && f.geometry;
    if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates)) continue;
    const [lng, lat] = g.coordinates;
    if (!isValidLngLat(lng, lat)) continue;
    const props = f.properties || {};
    out.push({
      id: props.id || makeId(),
      name: props.name || props.title || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      note: props.note || props.description || '',
      lng, lat,
      color: props.color || MAPS_CONFIG.placeColors[0],
      created: props.created || Date.now(),
    });
  }
  return out;
}
