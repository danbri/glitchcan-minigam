// kml.js — pure KML → GeoJSON conversion (no map, no network).
//
// KML is XML. We parse it with the platform DOMParser (present in browsers and
// modern Node via a global) and walk Placemarks into GeoJSON Features. This is
// NOT regex/string hackparsing — we use a real XML parser and the DOM API. The
// conversion is deliberately side-effect-free so it is unit-testable headless.
//
// Supported geometry: Point, LineString, Polygon (with inner holes),
// MultiGeometry (-> GeoMetryCollection-ish: emitted as separate features),
// and gx:Track/gx:MultiTrack (-> LineString). Placemark <name>/<description>
// become feature properties; simple <ExtendedData> name/value pairs are folded
// in too. Coordinates are KML "lng,lat[,alt]" tuples; altitude is dropped for
// 2D GeoJSON (MapLibre drapes geometry on the terrain).
//
// KMZ (a zip containing doc.kml) is handled in maps-app.js, which unzips with a
// tiny vendored-free inflate path and feeds the inner KML string here.

// Parse a KML string into a GeoJSON FeatureCollection.
export function kmlToGeoJson(kmlText, DomParser) {
  const Parser = DomParser || (typeof DOMParser !== 'undefined' ? DOMParser : null);
  if (!Parser) throw new Error('No DOMParser available to parse KML');
  const doc = new Parser().parseFromString(String(kmlText), 'application/xml');
  // A parse error shows up as a <parsererror> element in browsers.
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('KML is not well-formed XML');
  }
  const features = [];
  const placemarks = doc.getElementsByTagName('Placemark');
  for (let i = 0; i < placemarks.length; i++) {
    featuresFromPlacemark(placemarks[i]).forEach((f) => features.push(f));
  }
  return { type: 'FeatureCollection', features };
}

// Build 0..n features from one <Placemark> (MultiGeometry yields several).
function featuresFromPlacemark(pm) {
  const props = placemarkProps(pm);
  const out = [];
  for (const geom of geometriesOf(pm)) {
    if (geom) out.push({ type: 'Feature', properties: { ...props }, geometry: geom });
  }
  return out;
}

// Collect the <name>, <description> and <ExtendedData> of a placemark.
function placemarkProps(pm) {
  const props = {};
  const name = childText(pm, 'name');
  const desc = childText(pm, 'description');
  if (name) props.name = name;
  if (desc) props.description = desc;
  // <ExtendedData><Data name="k"><value>v</value></Data></ExtendedData>
  const ed = firstChildByTag(pm, 'ExtendedData');
  if (ed) {
    const datas = ed.getElementsByTagName('Data');
    for (let i = 0; i < datas.length; i++) {
      const k = datas[i].getAttribute('name');
      const v = childText(datas[i], 'value');
      if (k && v != null && props[k] === undefined) props[k] = v;
    }
    // <SimpleData name="k">v</SimpleData> (schema data)
    const simples = ed.getElementsByTagName('SimpleData');
    for (let i = 0; i < simples.length; i++) {
      const k = simples[i].getAttribute('name');
      const v = textOf(simples[i]);
      if (k && v && props[k] === undefined) props[k] = v;
    }
  }
  return props;
}

// Yield GeoJSON geometry objects found directly under a placemark (handles
// MultiGeometry by recursing into its children).
function geometriesOf(node) {
  const geoms = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const el = node.childNodes[i];
    if (el.nodeType !== 1) continue; // elements only
    const tag = localName(el);
    if (tag === 'Point') {
      const c = firstCoord(parseCoords(childText(el, 'coordinates')));
      if (c) geoms.push({ type: 'Point', coordinates: c });
    } else if (tag === 'LineString' || tag === 'LinearRing') {
      const cs = parseCoords(childText(el, 'coordinates'));
      if (cs.length >= 2) geoms.push({ type: 'LineString', coordinates: cs });
    } else if (tag === 'Polygon') {
      const ring = polygonRings(el);
      if (ring.length) geoms.push({ type: 'Polygon', coordinates: ring });
    } else if (tag === 'MultiGeometry') {
      geometriesOf(el).forEach((g) => geoms.push(g));
    } else if (tag === 'Track' || tag === 'MultiTrack') {
      // gx:Track — a series of <gx:coord>lng lat alt</gx:coord> elements.
      const cs = trackCoords(el);
      if (cs.length >= 2) geoms.push({ type: 'LineString', coordinates: cs });
    }
  }
  return geoms;
}

// Outer + inner boundary rings of a <Polygon> as GeoJSON ring arrays.
function polygonRings(poly) {
  const rings = [];
  const outer = firstChildByTag(poly, 'outerBoundaryIs');
  if (outer) {
    const lr = firstChildByTag(outer, 'LinearRing');
    const cs = lr ? parseCoords(childText(lr, 'coordinates')) : [];
    if (cs.length >= 3) rings.push(closeRing(cs));
  }
  // every <innerBoundaryIs> is a hole
  for (let i = 0; i < poly.childNodes.length; i++) {
    const el = poly.childNodes[i];
    if (el.nodeType === 1 && localName(el) === 'innerBoundaryIs') {
      const lr = firstChildByTag(el, 'LinearRing');
      const cs = lr ? parseCoords(childText(lr, 'coordinates')) : [];
      if (cs.length >= 3) rings.push(closeRing(cs));
    }
  }
  return rings;
}

// gx:Track: <gx:coord>lng lat alt</gx:coord> (space-separated, not comma).
function trackCoords(track) {
  const out = [];
  for (let i = 0; i < track.childNodes.length; i++) {
    const el = track.childNodes[i];
    if (el.nodeType === 1 && localName(el) === 'coord') {
      const p = textOf(el).trim().split(/\s+/).map(Number);
      if (p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) out.push([p[0], p[1]]);
    }
  }
  return out;
}

// ---- coordinate + DOM helpers ----------------------------------------------

// KML <coordinates> is whitespace-separated "lng,lat[,alt]" tuples.
function parseCoords(text) {
  if (!text) return [];
  const out = [];
  for (const tok of String(text).trim().split(/\s+/)) {
    if (!tok) continue;
    const parts = tok.split(',').map(Number);
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      out.push([parts[0], parts[1]]); // drop altitude for 2D GeoJSON
    }
  }
  return out;
}
function firstCoord(coords) { return coords.length ? coords[0] : null; }
// GeoJSON polygons must be closed (first == last); KML rings usually are.
function closeRing(cs) {
  const a = cs[0]; const b = cs[cs.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) return cs.concat([a.slice()]);
  return cs;
}

// localName that works whether or not the parser is namespace-aware
// (gx:coord -> 'coord', kml:Point -> 'Point').
function localName(el) {
  return el.localName || (el.tagName && el.tagName.includes(':') ? el.tagName.split(':').pop() : el.tagName) || '';
}
function textOf(el) { return el && el.textContent != null ? el.textContent : ''; }
// First *direct or descendant* element with this local name's text content,
// but scoped so a Placemark's own <name> wins over nested ones.
function childText(parent, tag) {
  const el = firstChildByTag(parent, tag);
  return el ? textOf(el).trim() : '';
}
// First descendant element matching a local name (namespace-agnostic).
function firstChildByTag(parent, tag) {
  // Prefer a direct child (so <coordinates> inside the right geometry is used).
  for (let i = 0; i < parent.childNodes.length; i++) {
    const el = parent.childNodes[i];
    if (el.nodeType === 1 && localName(el) === tag) return el;
  }
  // Fall back to first descendant.
  const all = parent.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) if (localName(all[i]) === tag) return all[i];
  return null;
}
