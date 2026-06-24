// derive-places.mjs — build a normalized Place NDJSON extract from a source,
// clipped to a bounding box. This is the offline "pull it in when needed" step
// the catalogue's `planned` extracts point at: clip a region once, cache it
// (LFS for the big gzipped ones), and the local provider / geo functions serve it.
//
// Input is GeoJSON (a FeatureCollection or newline-delimited Features). That's
// what you get from Overture or Foursquare after a DuckDB export, e.g.:
//
//   duckdb -c "COPY (
//     SELECT names.primary AS name, bbox, geometry,
//            categories.primary AS kind,
//            (SELECT s.dataset||':'||s.record_id FROM UNNEST(sources) AS t(s)
//             WHERE s.dataset='wikidata' LIMIT 1) AS wikidata
//     FROM read_parquet('s3://overturemaps-us-west-2/release/.../*.parquet')
//     WHERE bbox.xmin > <minLon> AND bbox.xmax < <maxLon>
//       AND bbox.ymin > <minLat> AND bbox.ymax < <maxLat>
//   ) TO 'overture.geojson' (FORMAT GDAL, DRIVER 'GeoJSON');"
//
//   node derive-places.mjs --in overture.geojson --source overture-places \
//        --bbox -2.72,51.41,-2.51,51.50 --gzip --out ../data/overture-bristol.ndjson
//
// The field mapping below is intentionally permissive: it understands plain
// GeoJSON (properties.name / .wikidata) AND Overture's nested shapes
// (names.primary, categories.primary, sources[].dataset='wikidata').
//
// Pure core (derivePlaces) is exported for tests; the CLI wraps it.

// ---- field extraction (permissive across Overture / Foursquare / plain GeoJSON) ----
function pick(props, ...keys) {
  for (const k of keys) { const v = props?.[k]; if (v != null && v !== '') return v; }
  return null;
}
function extractName(p) {
  return pick(p, 'name', '@name') || p?.names?.primary || p?.names?.common?.[0]?.value || null;
}
function extractKind(p) {
  return pick(p, 'kind', 'category', 'class', 'fclass') || p?.categories?.primary || p?.categories?.main || null;
}
function extractWikidata(p) {
  const direct = pick(p, 'wikidata', '@wikidata', 'wikidata_id');
  if (direct) return /^Q\d+$/.test(direct) ? direct : (String(direct).match(/Q\d+/)?.[0] || null);
  const srcs = p?.sources;
  if (Array.isArray(srcs)) {
    const w = srcs.find((s) => (s.dataset || s.source) === 'wikidata');
    const id = w && (w.record_id || w.recordId || w.id);
    if (id) return String(id).match(/Q\d+/)?.[0] || null;
  }
  return null;
}
function pointOf(geom) {
  if (!geom) return null;
  if (geom.type === 'Point') return geom.coordinates; // [lon, lat]
  // Fallback: centroid of a feature's bbox-ish first ring / first coord.
  const flat = (function dig(c) { return Array.isArray(c[0]) ? dig(c[0]) : c; })(geom.coordinates || []);
  return Array.isArray(flat) && flat.length >= 2 ? flat : null;
}
function inBbox([lon, lat], bbox) {
  if (!bbox) return true;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

// Map one GeoJSON feature to a normalized Place (or null to drop it).
export function featureToPlace(feature, source) {
  const p = feature?.properties || {};
  const name = extractName(p);
  const pt = pointOf(feature?.geometry);
  if (!name || !pt) return null;
  const [lon, lat] = pt.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    name: String(name),
    wikidataId: extractWikidata(p),
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    kind: extractKind(p),
    description: pick(p, 'description', 'admin', 'address') || null,
    source: source || 'derived',
  };
}

// Core: features[] -> normalized, bbox-clipped, de-duplicated Place[].
export function derivePlaces(features, { bbox, source } = {}) {
  const out = [];
  const seen = new Set();
  for (const f of features || []) {
    const place = featureToPlace(f, source);
    if (!place) continue;
    if (!inBbox([place.lon, place.lat], bbox)) continue;
    const key = place.wikidataId || `${place.name.toLowerCase()}@${place.lat},${place.lon}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(place);
  }
  return out;
}

export function toNdjson(places) {
  return places.map((p) => JSON.stringify(p)).join('\n') + '\n';
}

// Parse GeoJSON: a FeatureCollection object, or newline-delimited Features.
export function parseFeatures(text) {
  const t = text.trim();
  if (t[0] === '{') {
    const j = JSON.parse(t);
    if (j.type === 'FeatureCollection') return j.features || [];
    if (j.type === 'Feature') return [j];
  }
  return t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
}

// ---- CLI ----
async function main() {
  const { readFile, writeFile } = await import('node:fs/promises');
  const { gzipSync } = await import('node:zlib');
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const inFile = opt('--in');
  const outFile = opt('--out');
  const source = opt('--source', 'derived');
  const bboxStr = opt('--bbox');
  const gzip = args.includes('--gzip');
  if (!inFile || !outFile) {
    console.error('usage: derive-places.mjs --in <geojson> --out <ndjson> [--source id] [--bbox minLon,minLat,maxLon,maxLat] [--gzip]');
    process.exit(2);
  }
  const bbox = bboxStr ? bboxStr.split(',').map(Number) : null;
  const features = parseFeatures(await readFile(inFile, 'utf8'));
  const places = derivePlaces(features, { bbox, source });
  const ndjson = toNdjson(places);
  if (gzip) {
    const buf = gzipSync(Buffer.from(ndjson));
    await writeFile(outFile.endsWith('.gz') ? outFile : outFile + '.gz', buf);
    console.log(JSON.stringify({ out: outFile + (outFile.endsWith('.gz') ? '' : '.gz'), count: places.length, bytes: buf.length, lfs: true }));
  } else {
    await writeFile(outFile, ndjson);
    console.log(JSON.stringify({ out: outFile, count: places.length, bytes: Buffer.byteLength(ndjson), lfs: false }));
  }
}

// Run as CLI only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) main();
