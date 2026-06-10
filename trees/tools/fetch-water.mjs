#!/usr/bin/env node
// Fetch Bristol's real water polygons (Avon, Floating Harbour, New Cut, docks)
// from OSM and cache in-repo. node trees/tools/fetch-water.mjs
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const BBOX = '51.4188,-2.6670,51.4997,-2.5397';
const toE = lng => Math.round(358950 + (lng + 2.5970) * 70700);
const toN = lat => Math.round(172850 + (lat - 51.4534) * 111300);

const QUERY = `[out:json][timeout:120];
(
  way["natural"="water"](${BBOX});
  way["waterway"~"^(riverbank|dock|canal)$"](${BBOX});
  relation["natural"="water"](${BBOX});
  relation["waterway"="riverbank"](${BBOX});
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

function ring(geom, minPts=3, thin=25){
  const pts = []; let last = null;
  for (const g of geom) {
    const e = toE(g.lon), n = toN(g.lat);
    if (last && Math.hypot(e-last[0], n-last[1]) < thin) continue;
    pts.push([e, n]); last = [e, n];
  }
  return pts.length >= minPts ? pts : null;
}
function area(pts){
  let a = 0;
  for (let i=0;i<pts.length;i++){ const [x1,y1]=pts[i],[x2,y2]=pts[(i+1)%pts.length]; a += x1*y2-x2*y1; }
  return Math.abs(a/2);
}

const water = [];
for (const el of osm.elements) {
  if (el.type === 'way' && el.geometry) {
    const r = ring(el.geometry);
    if (r && area(r) > 3000) water.push([el.tags?.name || '', r]);
  } else if (el.type === 'relation' && el.members) {
    for (const m of el.members) {
      if (m.role !== 'outer' || !m.geometry) continue;
      const r = ring(m.geometry);
      if (r && area(r) > 3000) water.push([el.tags?.name || '', r]);
    }
  }
}
water.sort((a,b)=>area(b[1])-area(a[1]));
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'water-bristol.json'), JSON.stringify({
  source: 'OpenStreetMap via Overpass, fetched ' + new Date().toISOString().slice(0,10) +
          ' — © OpenStreetMap contributors, ODbL',
  crs: 'EPSG:27700 (BNG, linear approximation)',
  fields: '[name, ring[[e,n],...]]',
  water: water.slice(0, 120),
}));
console.log(`wrote water-bristol.json: ${Math.min(water.length,120)} polygons (of ${water.length})`);
console.log('biggest:', water.slice(0,6).map(w=>w[0]||'(unnamed)').join(' | '));
