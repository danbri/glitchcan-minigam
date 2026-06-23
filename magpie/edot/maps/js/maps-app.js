// maps-app.js — <edot-maps>: a mobile-first, accessible maps viewer over
// MapLibre GL JS, covering the everyday needs of the mega-platforms: a pannable/
// zoomable/tiltable map, place search, saved places, directions, a layer
// switcher and shareable permalinks.
//
// Light-DOM custom element sharing css/maps.css (the edot convention — no shadow
// DOM, one stylesheet). Mobile-first: the saved-places sidebar collapses to a
// slide-in drawer via the ☰ button; the toolbar wraps; controls are coarse-
// pointer sized in CSS. Full keyboard/ARIA on the controls and list.
//
// MapLibre is loaded as a UMD bundle (vendor/maplibre-gl.js -> window.maplibregl)
// so there is no runtime CDN dependency and no bundler. If WebGL is unavailable
// (e.g. headless without a GL backend), the map simply isn't created and the app
// surfaces a clear notice; all the non-map logic (search parsing, saved-place
// CRUD, routing maths, hash, GeoJSON) still works and stays testable.

import { MAPS_CONFIG } from './maps-config.js';
import { PlacesStore, newPlaceId } from './places-store.js';
import { resolveBasemapStyle } from './basemap.js';
import {
  buildGeocodeUrl, parseGeocodeResults, buildRouteUrl, parseRoute, routeToGeoJson,
  encodeHash, decodeHash, placesToGeoJson, geoJsonToPlaces, formatDistance, formatDuration,
  isValidLngLat,
} from './geo.js';

const PLACES_SRC = 'saved-places';
const ROUTE_SRC = 'route';

export class EdotMaps extends HTMLElement {
  constructor() {
    super();
    this.store = new PlacesStore();
    this.cfg = MAPS_CONFIG;
    this.places = [];
    this.map = null;            // MapLibre map (null when GL unavailable)
    this.glAvailable = false;
    this.basemap = MAPS_CONFIG.defaultBasemap;
    this.placesVisible = true;  // saved-places overlay toggle
    this._markers = new Map();  // place id -> maplibregl.Marker
    this._searchMarker = null;  // transient marker for the last search/drop
    this._routePts = { from: null, to: null }; // [lng,lat] each
    this._suppressHash = false;
  }

  async init() {
    if (this._initPromise) return this._initPromise;     // idempotent boot
    this._initPromise = this._doInit();
    return this._initPromise;
  }
  async _doInit() {
    await this.store.init();
    this.places = await this.store.getAll();
    this._render();
    this._initMap();
    this._built = true;
    return this;
  }

  connectedCallback() { if (!this._initPromise) this.init(); }
  disconnectedCallback() { if (this.map) try { this.map.remove(); } catch (_) { /* */ } }

  // ---- DOM scaffold --------------------------------------------------------
  _render() {
    this.innerHTML = '';
    const root = document.createElement('div'); root.className = 'mp'; this._root = root;

    // Toolbar: search, layer switcher, locate, directions toggle, sidebar ☰.
    const tb = document.createElement('div'); tb.className = 'mp-toolbar';

    const menuBtn = this._btn('☰', 'Show saved places', () => root.classList.toggle('side-open'), 'mp-menu-btn');

    const search = document.createElement('form'); search.className = 'mp-search'; search.setAttribute('role', 'search');
    const sInput = document.createElement('input');
    sInput.type = 'search'; sInput.placeholder = 'Search places…'; sInput.className = 'mp-search-input';
    sInput.setAttribute('aria-label', 'Search for a place'); sInput.autocomplete = 'off';
    const sBtn = this._btn('🔎', 'Search', null); sBtn.type = 'submit';
    search.append(sInput, sBtn);
    search.addEventListener('submit', (e) => { e.preventDefault(); this.geocodeAndFly(sInput.value.trim()); });
    this._searchInput = sInput;
    const results = document.createElement('ul'); results.className = 'mp-results'; results.hidden = true;
    results.setAttribute('role', 'listbox'); results.setAttribute('aria-label', 'Search results');
    this._results = results;

    // Layer/basemap switcher.
    const layerSel = document.createElement('select'); layerSel.className = 'mp-select';
    layerSel.setAttribute('aria-label', 'Basemap');
    for (const [id, b] of Object.entries(this.cfg.basemaps)) {
      const o = document.createElement('option'); o.value = id; o.textContent = b.label; layerSel.appendChild(o);
    }
    layerSel.value = this.basemap;
    layerSel.addEventListener('change', () => this.setBasemap(layerSel.value));
    this._layerSel = layerSel;

    const placesToggle = document.createElement('button');
    placesToggle.type = 'button'; placesToggle.className = 'mbtn mp-overlay-toggle';
    placesToggle.setAttribute('aria-pressed', 'true');
    placesToggle.textContent = '📍 Places';
    placesToggle.title = 'Show/hide saved places overlay';
    placesToggle.addEventListener('click', () => this.togglePlacesLayer());
    this._placesToggle = placesToggle;

    tb.append(
      menuBtn, search,
      this._btn('🧭', 'My location', () => this.locate(), 'mp-locate'),
      this._btn('🛣', 'Directions', () => this.toggleDirections(), 'mp-dir-btn'),
      layerSel, placesToggle,
    );

    // Directions panel (hidden until toggled).
    const dir = document.createElement('form'); dir.className = 'mp-directions'; dir.hidden = true;
    dir.innerHTML = '';
    const from = document.createElement('input'); from.className = 'mp-dir-from'; from.placeholder = 'From (place or lat,lng)'; from.setAttribute('aria-label', 'Route start');
    const to = document.createElement('input'); to.className = 'mp-dir-to'; to.placeholder = 'To (place or lat,lng)'; to.setAttribute('aria-label', 'Route end');
    const go = this._btn('Route', 'Find route', null, 'primary'); go.type = 'submit';
    const summary = document.createElement('span'); summary.className = 'mp-dir-summary'; summary.setAttribute('aria-live', 'polite');
    dir.append(from, to, go, summary);
    dir.addEventListener('submit', (e) => { e.preventDefault(); this.route(from.value.trim(), to.value.trim()); });
    this._dir = dir; this._dirFrom = from; this._dirTo = to; this._dirSummary = summary;

    // Sidebar: saved places list + import/export.
    const side = document.createElement('aside'); side.className = 'mp-side'; side.setAttribute('aria-label', 'Saved places');
    const sideHead = document.createElement('div'); sideHead.className = 'mp-side-head';
    sideHead.innerHTML = '<h2>Saved places</h2>';
    const ioBar = document.createElement('div'); ioBar.className = 'mp-io';
    const importInput = document.createElement('input'); importInput.type = 'file'; importInput.accept = '.geojson,.json,application/geo+json,application/json'; importInput.style.display = 'none';
    importInput.addEventListener('change', () => { const f = importInput.files[0]; if (f) this.importGeoJsonFile(f); importInput.value = ''; });
    ioBar.append(
      this._btn('⬆ Import', 'Import places (GeoJSON)', () => importInput.click()),
      this._btn('⬇ Export', 'Export places (GeoJSON)', () => this.exportGeoJson()),
      importInput,
    );
    const list = document.createElement('ul'); list.className = 'mp-place-list'; this._list = list;
    side.append(sideHead, ioBar, list);

    // Map host.
    const mapHost = document.createElement('div'); mapHost.className = 'mp-map'; this._mapHost = mapHost;
    const notice = document.createElement('div'); notice.className = 'mp-notice'; notice.hidden = true; this._notice = notice;
    mapHost.appendChild(notice);

    const main = document.createElement('div'); main.className = 'mp-main';
    main.append(results, dir, mapHost);

    root.append(tb, side, main);
    this.appendChild(root);
    this._renderPlaceList();
  }

  _btn(label, title, onClick, extra = '') {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mbtn' + (extra ? ' ' + extra : '');
    b.textContent = label; if (title) { b.title = title; b.setAttribute('aria-label', title); }
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  // ---- map setup -----------------------------------------------------------
  _initMap() {
    const gl = (typeof window !== 'undefined') && window.maplibregl;
    if (!gl) { this._showNotice('Map engine not loaded. See vendor/VENDOR-TODO.md.'); return; }

    const start = decodeHash(location.hash) || { center: this.cfg.defaultCenter, zoom: this.cfg.defaultZoom };
    const { style } = resolveBasemapStyle(this.cfg.basemaps[this.basemap]);

    try {
      this.map = new gl.Map({
        container: this._mapHost,
        style,
        center: start.center,
        zoom: start.zoom,
        minZoom: this.cfg.minZoom,
        maxZoom: this.cfg.maxZoom,
        attributionControl: false, // we add our own compact control below
        pitchWithRotate: true,
        dragRotate: true,
      });
    } catch (e) {
      this._showNotice('WebGL is unavailable here — map rendering is disabled, but search and saved places still work.');
      this.dispatchEvent(new CustomEvent('mapunavailable', { detail: String(e) }));
      return;
    }
    this.glAvailable = true;

    // Standard controls (mega-platform parity): zoom/rotate, scale, attribution,
    // geolocate.
    this.map.addControl(new gl.NavigationControl({ visualizePitch: true }), 'top-right');
    this.map.addControl(new gl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    this.map.addControl(new gl.AttributionControl({ compact: true }), 'bottom-right');
    this._geolocate = new gl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true, showUserLocation: true,
    });
    this.map.addControl(this._geolocate, 'top-right');

    this.map.on('load', () => this._onMapLoad());
    this.map.on('moveend', () => this._syncHash());
    // Long-press / right-click drops a marker (a "what's here" gesture).
    this.map.on('contextmenu', (e) => this.dropMarker([e.lngLat.lng, e.lngLat.lat]));
    this.dispatchEvent(new Event('mapready'));
  }

  _onMapLoad() {
    const gl = window.maplibregl;
    // Route source + line layer.
    if (!this.map.getSource(ROUTE_SRC)) {
      this.map.addSource(ROUTE_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({
        id: ROUTE_SRC, type: 'line', source: ROUTE_SRC,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#1a73e8', 'line-width': 5, 'line-opacity': 0.8 },
      });
    }
    // Saved-places overlay is rendered with HTML markers (accessible, themable),
    // but we also keep a GeoJSON source so the overlay is a real toggleable
    // layer and so it can be exported/inspected.
    if (!this.map.getSource(PLACES_SRC)) {
      this.map.addSource(PLACES_SRC, { type: 'geojson', data: placesToGeoJson(this.places) });
      this.map.addLayer({
        id: PLACES_SRC, type: 'circle', source: PLACES_SRC,
        paint: { 'circle-radius': 6, 'circle-color': ['coalesce', ['get', 'color'], '#8b4513'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
      });
    }
    this._refreshPlaceMarkers();
    void gl;
  }

  _showNotice(msg) { if (this._notice) { this._notice.textContent = msg; this._notice.hidden = false; } }

  // ---- basemap / layers ----------------------------------------------------
  setBasemap(id) {
    if (!this.cfg.basemaps[id]) return;
    this.basemap = id;
    if (this._layerSel) this._layerSel.value = id;
    if (!this.map) return;
    const { style } = resolveBasemapStyle(this.cfg.basemaps[id]);
    // setStyle wipes our sources/layers; re-add them once the new style loads.
    this.map.setStyle(style);
    this.map.once('styledata', () => this._onMapLoad());
  }

  togglePlacesLayer(force) {
    this.placesVisible = force === undefined ? !this.placesVisible : !!force;
    this._placesToggle.setAttribute('aria-pressed', String(this.placesVisible));
    const vis = this.placesVisible ? 'visible' : 'none';
    if (this.map && this.map.getLayer && this.map.getLayer(PLACES_SRC)) {
      this.map.setLayoutProperty(PLACES_SRC, 'visibility', vis);
    }
    for (const m of this._markers.values()) {
      const el = m.getElement(); if (el) el.style.display = this.placesVisible ? '' : 'none';
    }
    return this.placesVisible;
  }

  // ---- search / geocoding --------------------------------------------------
  // Geocode then fly to the first result; also list results for keyboard pick.
  async geocodeAndFly(query) {
    if (!query) return null;
    this._results.hidden = true; this._results.innerHTML = '';
    let results = [];
    try {
      const res = await fetch(buildGeocodeUrl(query, this.cfg.geocoder), { headers: { Accept: 'application/json' } });
      results = parseGeocodeResults(await res.json());
    } catch (e) {
      this._showResultsMessage('Search needs a network connection.');
      return null;
    }
    if (!results.length) { this._showResultsMessage('No matches.'); return []; }
    this._renderResults(results);
    this.flyToResult(results[0]);
    return results;
  }

  _showResultsMessage(msg) {
    this._results.innerHTML = `<li class="mp-result-msg" role="status">${esc(msg)}</li>`;
    this._results.hidden = false;
  }

  _renderResults(results) {
    this._results.innerHTML = '';
    results.forEach((r, i) => {
      const li = document.createElement('li');
      li.className = 'mp-result'; li.setAttribute('role', 'option'); li.tabIndex = 0;
      li.textContent = r.name;
      const pick = () => { this.flyToResult(r); this._results.hidden = true; };
      li.addEventListener('click', pick);
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      this._results.appendChild(li);
    });
    this._results.hidden = false;
  }

  flyToResult(r) {
    if (!r) return;
    this._setSearchMarker([r.lng, r.lat], r.name);
    if (!this.map) return;
    if (r.bbox && r.bbox.every(Number.isFinite)) {
      this.map.fitBounds([[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[3]]], { padding: 40, maxZoom: 16 });
    } else {
      this.map.flyTo({ center: [r.lng, r.lat], zoom: Math.max(this.map.getZoom(), 14) });
    }
  }

  // A transient marker for the current search / dropped pin, with a "Save" popup.
  _setSearchMarker(lngLat, name) {
    if (!this.map || !window.maplibregl) return;
    if (this._searchMarker) this._searchMarker.remove();
    const gl = window.maplibregl;
    const el = document.createElement('div'); el.className = 'mp-pin mp-pin-search'; el.setAttribute('aria-label', name || 'Pin');
    const popup = new gl.Popup({ offset: 18 }).setHTML(
      `<div class="mp-pop"><strong>${esc(name || 'Dropped pin')}</strong>` +
      `<div class="mp-pop-coord">${lngLat[1].toFixed(5)}, ${lngLat[0].toFixed(5)}</div>` +
      `<button type="button" class="mbtn primary mp-pop-save">＋ Save place</button></div>`);
    this._searchMarker = new gl.Marker({ element: el }).setLngLat(lngLat).setPopup(popup).addTo(this.map);
    this._searchMarker.togglePopup();
    popup.getElement()?.querySelector('.mp-pop-save')?.addEventListener('click', () => {
      this.savePlace({ name: name || `${lngLat[1].toFixed(4)}, ${lngLat[0].toFixed(4)}`, lng: lngLat[0], lat: lngLat[1] });
      this._searchMarker.remove(); this._searchMarker = null;
    });
  }

  dropMarker(lngLat) { this._setSearchMarker(lngLat, 'Dropped pin'); }

  // ---- geolocation ---------------------------------------------------------
  // Permission-gated, graceful. Uses MapLibre's GeolocateControl when present;
  // falls back to the raw Geolocation API otherwise.
  locate() {
    if (this._geolocate) { this._geolocate.trigger(); return; }
    if (!('geolocation' in navigator)) { this._showNotice('Geolocation is not available on this device.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { const c = [pos.coords.longitude, pos.coords.latitude]; if (this.map) this.map.flyTo({ center: c, zoom: 15 }); this._setSearchMarker(c, 'You are here'); },
      () => this._showNotice('Location permission denied or unavailable.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // ---- saved places --------------------------------------------------------
  async savePlace({ name, note = '', lng, lat, color }) {
    if (!isValidLngLat(lng, lat)) return null;
    const place = {
      id: newPlaceId(),
      name: name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      note, lng, lat,
      color: color || this.cfg.placeColors[0],
      created: Date.now(),
    };
    await this.store.put(place);
    this.places = await this.store.getAll();
    this._afterPlacesChanged();
    return place;
  }

  async updatePlace(id, patch) {
    const cur = this.places.find((p) => p.id === id); if (!cur) return null;
    const next = { ...cur, ...patch };
    await this.store.put(next);
    this.places = await this.store.getAll();
    this._afterPlacesChanged();
    return next;
  }

  async deletePlace(id) {
    await this.store.delete(id);
    this.places = await this.store.getAll();
    this._afterPlacesChanged();
  }

  _afterPlacesChanged() {
    this._renderPlaceList();
    if (this.map && this.map.getSource && this.map.getSource(PLACES_SRC)) {
      this.map.getSource(PLACES_SRC).setData(placesToGeoJson(this.places));
    }
    this._refreshPlaceMarkers();
  }

  _refreshPlaceMarkers() {
    if (!this.map || !window.maplibregl) return;
    const gl = window.maplibregl;
    // Remove markers for deleted places.
    for (const [id, m] of this._markers) {
      if (!this.places.some((p) => p.id === id)) { m.remove(); this._markers.delete(id); }
    }
    for (const p of this.places) {
      let m = this._markers.get(p.id);
      if (!m) {
        const el = document.createElement('div'); el.className = 'mp-pin'; el.setAttribute('aria-label', p.name);
        const popup = new gl.Popup({ offset: 18 }).setHTML(
          `<div class="mp-pop"><strong>${esc(p.name)}</strong>` +
          (p.note ? `<div class="mp-pop-note">${esc(p.note)}</div>` : '') +
          `<div class="mp-pop-coord">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</div></div>`);
        m = new gl.Marker({ element: el, color: p.color }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(this.map);
        this._markers.set(p.id, m);
      }
      m.getElement().style.background = p.color || '';
      m.getElement().style.display = this.placesVisible ? '' : 'none';
      m.setLngLat([p.lng, p.lat]);
    }
  }

  _renderPlaceList() {
    const list = this._list; if (!list) return;
    list.innerHTML = '';
    if (!this.places.length) {
      const li = document.createElement('li'); li.className = 'mp-empty';
      li.textContent = 'No saved places yet. Search, or long-press the map, then “Save place”.';
      list.appendChild(li); return;
    }
    for (const p of this.places) {
      const li = document.createElement('li'); li.className = 'mp-place';
      const dot = document.createElement('span'); dot.className = 'mp-dot'; dot.style.background = p.color || '#8b4513'; dot.setAttribute('aria-hidden', 'true');
      const main = document.createElement('button'); main.type = 'button'; main.className = 'mp-place-go';
      main.innerHTML = `<span class="mp-place-name">${esc(p.name)}</span>` + (p.note ? `<span class="mp-place-note">${esc(p.note)}</span>` : '');
      main.setAttribute('aria-label', `Go to ${p.name}`);
      main.addEventListener('click', () => this.flyTo(p));
      const del = this._btn('🗑', `Delete ${p.name}`, () => this.deletePlace(p.id), 'mp-place-del');
      li.append(dot, main, del);
      list.appendChild(li);
    }
  }

  flyTo(p) {
    this._root.classList.remove('side-open');
    if (this.map) this.map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(this.map.getZoom(), 15) });
  }

  // ---- import / export -----------------------------------------------------
  async importGeoJsonFile(file) {
    try {
      const json = JSON.parse(await file.text());
      const places = geoJsonToPlaces(json, newPlaceId);
      if (!places.length) { this._showNotice('No point features found in that GeoJSON.'); return 0; }
      await this.store.putMany(places);
      this.places = await this.store.getAll();
      this._afterPlacesChanged();
      return places.length;
    } catch (e) { this._showNotice('Could not read that file as GeoJSON.'); return 0; }
  }

  exportGeoJson() {
    const blob = new Blob([JSON.stringify(placesToGeoJson(this.places), null, 2)], { type: 'application/geo+json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'edot-places.geojson';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---- directions / routing ------------------------------------------------
  toggleDirections(force) {
    const open = force === undefined ? this._dir.hidden : force;
    this._dir.hidden = !open;
    if (open) this._dirFrom.focus();
  }

  // Resolve a "from"/"to" input which may be "lat,lng" or a place name.
  async _resolvePoint(text) {
    const m = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m) { const lat = parseFloat(m[1]); const lng = parseFloat(m[2]); if (isValidLngLat(lng, lat)) return [lng, lat]; }
    try {
      const res = await fetch(buildGeocodeUrl(text, this.cfg.geocoder), { headers: { Accept: 'application/json' } });
      const r = parseGeocodeResults(await res.json())[0];
      return r ? [r.lng, r.lat] : null;
    } catch (_) { return null; }
  }

  // Request, parse and draw a route; show distance + duration. Network-gated;
  // the parsing/maths/drawing are exercised by tests via routeFromFixture().
  async route(fromText, toText) {
    this._dirSummary.textContent = 'Routing…';
    const from = await this._resolvePoint(fromText);
    const to = await this._resolvePoint(toText);
    if (!from || !to) { this._dirSummary.textContent = 'Could not resolve both points.'; return null; }
    this._routePts = { from, to };
    let parsed;
    try {
      const res = await fetch(buildRouteUrl(from, to, this.cfg.router));
      parsed = parseRoute(await res.json());
    } catch (_) { this._dirSummary.textContent = 'Routing needs a network connection.'; return null; }
    return this._applyRoute(parsed);
  }

  // Shared route application — used by both live routing and the test fixture.
  _applyRoute(parsed) {
    if (!parsed || !parsed.ok) { this._dirSummary.textContent = parsed && parsed.error ? parsed.error : 'No route.'; return parsed; }
    this.drawRoute(parsed.coords);
    this._dirSummary.textContent = `${formatDistance(parsed.distance)} · ${formatDuration(parsed.duration)}`;
    return parsed;
  }

  // For tests / offline: apply a raw OSRM response object directly.
  routeFromFixture(osrmJson) { return this._applyRoute(parseRoute(osrmJson)); }

  drawRoute(coords) {
    if (!coords || !coords.length) return;
    if (this.map && this.map.getSource && this.map.getSource(ROUTE_SRC)) {
      this.map.getSource(ROUTE_SRC).setData(routeToGeoJson(coords));
      const lons = coords.map((c) => c[0]); const lats = coords.map((c) => c[1]);
      this.map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 60 });
    }
  }

  clearRoute() {
    this._routePts = { from: null, to: null };
    this._dirSummary.textContent = '';
    if (this.map && this.map.getSource && this.map.getSource(ROUTE_SRC)) {
      this.map.getSource(ROUTE_SRC).setData({ type: 'FeatureCollection', features: [] });
    }
  }

  // ---- permalink hash ------------------------------------------------------
  _syncHash() {
    if (this._suppressHash || !this.map) return;
    const c = this.map.getCenter();
    const marker = this._searchMarker ? (() => { const l = this._searchMarker.getLngLat(); return [l.lng, l.lat]; })() : null;
    const h = encodeHash({ zoom: this.map.getZoom(), center: [c.lng, c.lat], marker });
    if (h && h !== location.hash) history.replaceState(null, '', h);
  }

  // Apply a hash (used on load and by deep-link navigation). Returns the state.
  applyHash(hash = location.hash) {
    const s = decodeHash(hash);
    if (!s) return null;
    if (this.map) {
      this.map.jumpTo({ center: s.center, zoom: s.zoom });
      if (s.marker) this._setSearchMarker(s.marker, 'Shared location');
    }
    return s;
  }
}

// Minimal HTML escaping for the small dynamic strings we inject (place names,
// notes, messages). Keeps the popups/list XSS-safe.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

if (typeof customElements !== 'undefined' && !customElements.get('edot-maps')) {
  customElements.define('edot-maps', EdotMaps);
}
