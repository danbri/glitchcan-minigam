#!/usr/bin/env node
// Fetches real OSM building footprints for two skyline snapshots — the City
// of London (departure) and Midtown/Lower Manhattan (arrival, standing in
// for the NYC skyline visible from the EWR approach) — via the public
// Overpass API. Writes ../data/buildings-london.json and
// ../data/buildings-nyc.json.
//
// Re-run: node tools/fetch-buildings.mjs
//
// Data minimisation (per project data-ethics rules): we keep ONLY footprint
// geometry (converted to local metres) and height. No addresses, tags beyond
// building name (public landmark names, not personal data), or OSM ids.
// We filter to buildings tall enough to read as a skyline silhouette, which
// also keeps the OSM query (and this file) small.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UA = 'glitchcan-minigam-ua17 (https://github.com/danbri/glitchcan-minigam)';

const CITIES = [
  {
    key: 'london',
    origin: { lat: 51.5074, lon: -0.0877 }, // roughly the Gherkin, City of London
    bbox: [51.500, -0.100, 51.515, -0.075],
    minHeight: 15,
  },
  {
    key: 'nyc',
    origin: { lat: 40.7484, lon: -73.9857 }, // roughly the Empire State Building
    bbox: [40.744, -73.995, 40.762, -73.965],
    minHeight: 90,
  },
];

function parseHeight(tags) {
  const raw = tags.height ?? tags['building:height'];
  if (!raw) return null;
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Flat local-metres projection around a small-area origin (fine at city scale).
function toLocalMetres(lat, lon, origin) {
  const mPerDegLat = 110540;
  const mPerDegLon = 111320 * Math.cos((origin.lat * Math.PI) / 180);
  return [
    Number(((lon - origin.lon) * mPerDegLon).toFixed(1)),
    Number(((lat - origin.lat) * mPerDegLat).toFixed(1)),
  ];
}

// Keep footprints small: dedupe consecutive duplicate nodes, cap point count.
function simplifyFootprint(points, maxPoints = 10) {
  const deduped = [];
  for (const p of points) {
    const last = deduped[deduped.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) deduped.push(p);
  }
  if (deduped.length <= maxPoints) return deduped;
  const step = deduped.length / maxPoints;
  const out = [];
  for (let i = 0; i < maxPoints; i++) out.push(deduped[Math.floor(i * step)]);
  return out;
}

for (const city of CITIES) {
  const [s, w, n, e] = city.bbox;
  const query = `[out:json][timeout:25];way["building"]["height"](${s},${w},${n},${e});out geom;`;
  console.log(`fetching ${city.key} buildings...`);
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`overpass ${res.status} for ${city.key}`);
  const json = await res.json();

  const buildings = [];
  for (const el of json.elements) {
    if (el.type !== 'way' || !el.geometry) continue;
    const height = parseHeight(el.tags || {});
    if (!height || height < city.minHeight) continue;
    const footprint = simplifyFootprint(
      el.geometry.map((g) => toLocalMetres(g.lat, g.lon, city.origin)),
    );
    if (footprint.length < 3) continue;
    buildings.push({
      name: el.tags?.name || null,
      height: Math.round(height),
      footprint,
    });
  }
  buildings.sort((a, b) => b.height - a.height);

  const out = {
    source: 'OpenStreetMap via Overpass API (overpass-api.de), (c) OpenStreetMap contributors, ODbL',
    fetchedAt: new Date().toISOString(),
    city: city.key,
    origin: city.origin,
    minHeight: city.minHeight,
    buildings,
  };
  writeFileSync(join(__dirname, '..', 'data', `buildings-${city.key}.json`), JSON.stringify(out, null, 2));
  console.log(`Wrote data/buildings-${city.key}.json with ${buildings.length} buildings.`);
}
