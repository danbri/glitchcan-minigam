#!/usr/bin/env node
// Fetch the city fabric: building footprints (central Bristol) + neighbourhood
// place names (whole bbox) from OSM. node trees/tools/fetch-fabric.mjs
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const FULL = '51.4188,-2.6670,51.4997,-2.5397';
const CENTRE = '51.4350,-2.6350,51.4720,-2.5600';   // ~4x5km: harbour, centre, Clifton, Stokes Croft, Bedminster
const toE = lng => Math.round(358950 + (lng + 2.5970) * 70700);
const toN = lat => Math.round(172850 + (lat - 51.4534) * 111300);

const QUERY = `[out:json][timeout:180];
(
  way["building"](${CENTRE});
  node["place"~"^(suburb|neighbourhood|quarter)$"](${FULL});
);
out geom;`;

const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'User-Agent': 'glitchcan-minigam/1.0 (danbri@danbri.org)',
             'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'data=' + encodeURIComponent(QUERY),
});
if (!res.ok) throw new Error('Overpass HTTP ' + res.status);
const osm = await res.json();

const buildings = [], places = [];
let pts = 0;
for (const el of osm.elements) {
  if (el.type === 'node' && el.tags?.place) {
    places.push([el.tags.name || '', toE(el.lon), toN(el.lat)]);
  } else if (el.type === 'way' && el.geometry && el.geometry.length >= 4) {
    // thin hard (12m) and quantize; drop tiny footprints
    const ring = []; let last = null;
    for (const g of el.geometry) {
      const e = toE(g.lon), n = toN(g.lat);
      if (last && Math.hypot(e-last[0], n-last[1]) < 12) continue;
      ring.push([e, n]); last = [e, n];
    }
    if (ring.length < 3) continue;
    let a = 0;
    for (let i=0;i<ring.length;i++){ const [x1,y1]=ring[i],[x2,y2]=ring[(i+1)%ring.length]; a += x1*y2-x2*y1; }
    if (Math.abs(a/2) < 60) continue;
    pts += ring.length;
    buildings.push(ring);
  }
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'fabric-bristol.json'), JSON.stringify({
  source: 'OpenStreetMap via Overpass, fetched ' + new Date().toISOString().slice(0,10) +
          ' — © OpenStreetMap contributors, ODbL',
  crs: 'EPSG:27700 (BNG, linear approximation)',
  fields: { buildings: 'ring[[e,n],...] (central ~4x5km)', places: '[name, e, n]' },
  buildings, places,
}));
console.log(`wrote fabric-bristol.json: ${buildings.length} buildings (${pts} pts), ${places.length} places`);
console.log('places:', places.map(p=>p[0]).filter(Boolean).slice(0,30).join(', '));
