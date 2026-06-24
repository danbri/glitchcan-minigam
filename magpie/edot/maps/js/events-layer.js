// events-layer.js — overlay calendar events that have a location onto the map.
//
// Additive by design: it reads the calendar's IndexedDB store (events carry
// locationGeo + locationWikidata now that the calendar's Location field is a
// place autocomplete) and draws them as a distinct, self-contained GeoJSON layer
// on the map EdotMaps already exposes via `this.map`. It does NOT edit the maps
// core — maps.html opts in with ?events. This is the backdrop the calendar's
// stored coordinates were for: where your located events actually are.

import { CalendarStore } from '../../calendar/js/store.js';

const SRC = 'edot-events';
const COLOR = '#1d6fb8';

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Pure: events[] -> a GeoJSON FeatureCollection of the located ones.
export function eventsToFeatures(events) {
  const features = [];
  for (const ev of events || []) {
    const g = ev.locationGeo;
    if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon)) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [g.lon, g.lat] },
      properties: {
        title: ev.summary || '(untitled event)',
        location: ev.location || '',
        wikidata: ev.locationWikidata || '',
        start: ev.start ? new Date(ev.start).toISOString() : '',
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

export async function loadEventFeatures() {
  const store = new CalendarStore();
  await store.init();
  return eventsToFeatures(await store.getEvents());
}

function whenReady(map) {
  return new Promise((res) => {
    if (map.isStyleLoaded && map.isStyleLoaded()) res();
    else map.once('load', () => res());
  });
}

async function getMap(mapsEl, timeout = 8000) {
  const start = Date.now();
  while (!mapsEl || !mapsEl.map) {
    if (Date.now() - start > timeout) return null;
    await new Promise((r) => setTimeout(r, 50));
  }
  await whenReady(mapsEl.map);
  return mapsEl.map;
}

// Add (or update) the events source + layers on an already-ready map.
export function drawEvents(map, fc) {
  const gl = (typeof window !== 'undefined') && window.maplibregl;
  if (map.getSource(SRC)) { map.getSource(SRC).setData(fc); return; }

  map.addSource(SRC, { type: 'geojson', data: fc });
  map.addLayer({ id: `${SRC}-halo`, type: 'circle', source: SRC,
    paint: { 'circle-radius': 11, 'circle-color': COLOR, 'circle-opacity': 0.18 } });
  map.addLayer({ id: SRC, type: 'circle', source: SRC,
    paint: { 'circle-radius': 6, 'circle-color': COLOR, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
  map.addLayer({ id: `${SRC}-label`, type: 'symbol', source: SRC,
    layout: { 'text-field': ['get', 'title'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
    paint: { 'text-color': COLOR, 'text-halo-color': '#fff', 'text-halo-width': 1.2 } });

  if (gl) {
    map.on('click', SRC, (e) => {
      const f = e.features && e.features[0]; if (!f) return;
      const p = f.properties || {};
      const when = p.start ? new Date(p.start).toLocaleString() : '';
      const qid = p.wikidata ? ` · <a href="https://www.wikidata.org/wiki/${p.wikidata}" target="_blank" rel="noopener">${esc(p.wikidata)}</a>` : '';
      new gl.Popup().setLngLat(e.lngLat)
        .setHTML(`<strong>${esc(p.title)}</strong><br>${esc(p.location)}${qid}${when ? '<br>' + esc(when) : ''}`)
        .addTo(map);
    });
    map.on('mouseenter', SRC, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', SRC, () => { map.getCanvas().style.cursor = ''; });
  }
}

function fitTo(map, fc) {
  const gl = window.maplibregl;
  if (!gl || !fc.features.length) return;
  const b = new gl.LngLatBounds();
  for (const f of fc.features) b.extend(f.geometry.coordinates);
  map.fitBounds(b, { padding: 60, maxZoom: 12, duration: 0 });
}

// Mount the overlay on an <edot-maps> element. Pass {features} to display a
// given set; otherwise it reads the located events from the calendar store.
export async function mountEventOverlay(mapsEl, opts = {}) {
  const map = await getMap(mapsEl);
  if (!map) return 0;
  const fc = opts.features
    ? { type: 'FeatureCollection', features: opts.features }
    : await loadEventFeatures();
  drawEvents(map, fc);
  if (opts.fit !== false) fitTo(map, fc);
  return fc.features.length;
}
