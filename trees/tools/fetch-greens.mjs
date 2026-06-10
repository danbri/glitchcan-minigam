#!/usr/bin/env node
// Fetch Bristol's parks/woods polygons and railway stations from OSM and cache
// in-repo.  node trees/tools/fetch-greens.mjs → trees/data/greens-bristol.json
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const BBOX = '51.4188,-2.6670,51.4997,-2.5397';
const toE = lng => Math.round(358950 + (lng + 2.5970) * 70700);
const toN = lat => Math.round(172850 + (lat - 51.4534) * 111300);

const QUERY = `[out:json][timeout:120];
(
  way["leisure"~"^(park|nature_reserve|recreation_ground|common)$"](${BBOX});
  way["landuse"~"^(grass|cemetery|allotments|meadow|forest)$"](${BBOX});
  way["natural"="wood"](${BBOX});
  relation["leisure"~"^(park|nature_reserve|common)$"](${BBOX});
  node["railway"="station"](${BBOX});
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

function ring(geom){           // thin to ~45m, closed
  const pts = []; let last = null;
  for (const g of geom) {
    const e = toE(g.lon), n = toN(g.lat);
    if (last && Math.hypot(e-last[0], n-last[1]) < 45) continue;
    pts.push([e, n]); last = [e, n];
  }
  return pts.length >= 3 ? pts : null;
}
function area(pts){            // shoelace, m^2
  let a = 0;
  for (let i=0;i<pts.length;i++){ const [x1,y1]=pts[i],[x2,y2]=pts[(i+1)%pts.length]; a += x1*y2-x2*y1; }
  return Math.abs(a/2);
}

const greens = [], stations = [];
for (const el of osm.elements) {
  if (el.type === 'node' && el.tags?.railway === 'station') {
    stations.push([el.tags.name || 'STATION', toE(el.lon), toN(el.lat)]);
  } else if (el.type === 'way' && el.geometry) {
    const r = ring(el.geometry);
    if (r && area(r) > 15000) greens.push([el.tags?.name || '', r]);   // >1.5ha only
  } else if (el.type === 'relation' && el.members) {
    for (const m of el.members) {
      if (m.role !== 'outer' || !m.geometry) continue;
      const r = ring(m.geometry);
      if (r && area(r) > 15000) greens.push([el.tags?.name || '', r]);
    }
  }
}
greens.sort((a,b)=>area(b[1])-area(a[1]));
const top = greens.slice(0, 160);   // biggest 160 polygons cover the identity parks

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'greens-bristol.json'), JSON.stringify({
  source: 'OpenStreetMap via Overpass, fetched ' + new Date().toISOString().slice(0,10) +
          ' — © OpenStreetMap contributors, ODbL',
  crs: 'EPSG:27700 (BNG, linear approximation)',
  fields: { greens: '[name, ring[[e,n],...]]', stations: '[name, e, n]' },
  greens: top, stations,
}));
console.log(`wrote greens-bristol.json: ${top.length} green polygons (of ${greens.length}), ${stations.length} stations`);
