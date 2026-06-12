#!/usr/bin/env node
// THE canonical pipeline: derive ALL game layers from the complete OSM extract
// cached at trees/data/bristol.osm.pbf (Geofabrik, ODbL). No network needed.
//   node trees/tools/derive-layers.mjs
// Regenerates: roads-, water-, greens-, fabric-, pubs- bristol.json
// (Supersedes fetch-roads/greens/water/fabric.mjs — kept for provenance.)
import { createReadStream, writeFileSync } from 'fs';
import { Writable } from 'stream';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const parseOSM = require('osm-pbf-parser');

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const PBF = join(DATA, 'bristol.osm.pbf');
const toE = lng => Math.round(358950 + (lng + 2.5970) * 70700);
const toN = lat => Math.round(172850 + (lat - 51.4534) * 111300);
const BB = { eMin: 354000, eMax: 363000, nMin: 169000, nMax: 178000 };
const inBB = (e, n) => e >= BB.eMin && e <= BB.eMax && n >= BB.nMin && n <= BB.nMax;
const SRC = (what) => `OpenStreetMap (Geofabrik bristol extract, derived ${new Date().toISOString().slice(0,10)}) — © OpenStreetMap contributors, ODbL — ${what}`;

function scan(onItems){
  return new Promise((res, rej) => {
    createReadStream(PBF).pipe(parseOSM()).pipe(new Writable({objectMode: true,
      write(items, enc, next){ onItems(items); next(); }}))
      .on('finish', res).on('error', rej);
  });
}
function ring(coords, thin){           // [[e,n],...] thinned, endpoints kept
  const pts = []; let last = null;
  for(const [e, n] of coords){
    if(last && Math.hypot(e-last[0], n-last[1]) < thin) continue;
    pts.push([e, n]); last = [e, n];
  }
  const end = coords[coords.length-1];
  if(pts.length && (pts[pts.length-1][0] !== end[0] || pts[pts.length-1][1] !== end[1])) pts.push(end);
  return pts;
}
function area(pts){
  let a = 0;
  for(let i=0;i<pts.length;i++){ const [x1,y1]=pts[i],[x2,y2]=pts[(i+1)%pts.length]; a += x1*y2-x2*y1; }
  return Math.abs(a/2);
}
const centroid = pts => pts.reduce((a,[e,n])=>[a[0]+e/pts.length, a[1]+n/pts.length], [0,0]).map(Math.round);

// ---- pass 1: node coords + tagged POI nodes ----
const nodeCoord = new Map();
const pubs = [], places = [], stations = [];
await scan(items => {
  for(const it of items){
    if(it.type !== 'node') continue;
    const e = toE(it.lon), n = toN(it.lat);
    nodeCoord.set(it.id, [e, n]);
    if(!it.tags || !inBB(e, n)) continue;
    if(it.tags.amenity === 'pub' && it.tags.name) pubs.push([it.tags.name, e, n]);
    if(/^(suburb|neighbourhood|quarter)$/.test(it.tags.place || '')) places.push([it.tags.name || '', e, n]);
    if(it.tags.railway === 'station') stations.push([it.tags.name || 'STATION', e, n]);
  }
});
console.log('pass 1:', nodeCoord.size, 'nodes;', pubs.length, 'pub nodes,', places.length, 'places,', stations.length, 'stations');

// ---- pass 2: ways -> layers; keep refs for relation resolution ----
const ROADCLS = { motorway:0, trunk:0, primary:1, secondary:2, tertiary:4,
  residential:5, unclassified:5, living_street:5 };
const roads = [], water = [], greens = [], buildings = [];
const wayRefs = new Map();   // only for ways we may need in relations
await scan(items => {
  for(const it of items){
    if(it.type !== 'way' || !it.refs) continue;
    const t = it.tags || {};
    const coords = [];
    for(const r of it.refs){ const c = nodeCoord.get(r); if(c) coords.push(c); }
    if(coords.length < 2) continue;
    if(!coords.some(([e,n]) => inBB(e,n))) { wayRefs.set(it.id, it.refs); continue; }
    wayRefs.set(it.id, it.refs);
    const isGreen = /^(park|garden|nature_reserve|recreation_ground|common)$/.test(t.leisure || '') ||
                    /^(grass|cemetery|allotments|meadow|forest|village_green)$/.test(t.landuse || '') ||
                    t.natural === 'wood';
    if(t.highway && ROADCLS[t.highway] !== undefined){
      roads.push([ROADCLS[t.highway], t.ref || t.name || '', ring(coords, 35)]);
    } else if(t.railway === 'rail' && t.usage !== 'industrial'){
      roads.push([3, t.name || '', ring(coords, 35)]);
    } else if(t.natural === 'water' || /^(riverbank|dock|canal)$/.test(t.waterway || '')){
      const r = ring(coords, 20);
      if(r.length >= 3 && area(r) > 2500) water.push([t.name || '', r]);
    } else if(isGreen){
      const r = ring(coords, 16);
      if(r.length >= 3 && area(r) > 1200) greens.push([t.name || '', r]);
    }
    if(t.building){
      const r = ring(coords, 4);     // terraced houses are ~8m wide: thin gently
      if(r.length >= 3 && area(r) > 30){
        const h = parseFloat(t.height) || (parseFloat(t['building:levels']) || 0) * 3.2;
        const bt = t.building;
        const type = /^(house|terrace|residential|detached|semidetached_house|bungalow)$/.test(bt) ? 1
                   : /^(apartments|dormitory)$/.test(bt) ? 2
                   : /^(commercial|retail|office|hotel)$/.test(bt) ? 3
                   : /^(industrial|warehouse)$/.test(bt) ? 4
                   : /^(church|cathedral|chapel)$/.test(bt) ? 5
                   : /^(university|civic|public|school|hospital)$/.test(bt) ? 6 : 0;
        buildings.push([Math.round(h*10)/10, r, type]);
        if(t.amenity === 'pub' && t.name) pubs.push([t.name, ...centroid(r)]);
      }
    } else if(t.amenity === 'pub' && t.name){
      pubs.push([t.name, ...centroid(ring(coords, 4))]);
    }
  }
});
console.log('pass 2:', roads.length, 'roads,', water.length, 'water,', greens.length, 'greens,',
            buildings.length, 'buildings,', pubs.length, 'pubs total');

// ---- pass 3: multipolygon relations (Floating Harbour etc.) ----
await scan(items => {
  for(const it of items){
    if(it.type !== 'relation') continue;
    const t = it.tags || {};
    const isWater = t.natural === 'water' || t.waterway === 'riverbank';
    const isGreen = /^(park|garden|nature_reserve|common)$/.test(t.leisure || '');
    if(!isWater && !isGreen) continue;
    for(const m of it.members || []){
      if(m.type !== 'way' || m.role !== 'outer') continue;
      const refs = wayRefs.get(m.id); if(!refs) continue;
      const coords = [];
      for(const r of refs){ const c = nodeCoord.get(r); if(c) coords.push(c); }
      if(coords.length < 3 || !coords.some(([e,n]) => inBB(e,n))) continue;
      const rg = ring(coords, isWater ? 20 : 16);
      if(rg.length < 3) continue;
      if(isWater && area(rg) > 2500) water.push([t.name || '', rg]);
      if(isGreen && area(rg) > 1200) greens.push([t.name || '', rg]);
    }
  }
});
water.sort((a,b)=>area(b[1])-area(a[1]));
greens.sort((a,b)=>area(b[1])-area(a[1]));
console.log('pass 3 done:', water.length, 'water,', greens.length, 'greens');

writeFileSync(join(DATA,'roads-bristol.json'), JSON.stringify({ source: SRC('major roads + rail'),
  crs:'EPSG:27700 (BNG, linear approximation)',
  classes:['motorway/trunk','primary','secondary','rail','tertiary','residential'],
  fields:['classIndex','ref_or_name','points[easting,northing]'], roads }));
writeFileSync(join(DATA,'water-bristol.json'), JSON.stringify({ source: SRC('water polygons'),
  crs:'EPSG:27700', fields:'[name, ring]', water: water.slice(0,200) }));
writeFileSync(join(DATA,'greens-bristol.json'), JSON.stringify({ source: SRC('parks/greens'),
  crs:'EPSG:27700', fields:{greens:'[name, ring]', stations:'[name,e,n]'}, greens, stations }));
writeFileSync(join(DATA,'fabric-bristol.json'), JSON.stringify({ source: SRC('ALL buildings + places'),
  crs:'EPSG:27700', fields:{buildings:'[height_or_0, ring, typeCode]', places:'[name,e,n]'}, buildings, places }));
writeFileSync(join(DATA,'pubs-bristol.json'), JSON.stringify({ source: SRC('named pubs'),
  crs:'EPSG:27700', fields:'[name, e, n]', pubs }));
console.log('layers written.');
