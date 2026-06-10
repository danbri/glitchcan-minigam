#!/usr/bin/env node
// Fetch the real Bristol major-road network (+ railways) from OpenStreetMap via
// Overpass, convert to BNG world coordinates, simplify, and cache in-repo so the
// game never needs the API at runtime.
//
//   node trees/tools/fetch-roads.mjs
//   → trees/data/roads-bristol.json (+ commit the .gz alongside)

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const BBOX = '51.4188,-2.6670,51.4997,-2.5397';   // matches elevation grid

// repo-standard linear BNG approximation (see CLAUDE.md trees section)
const toE = lng => Math.round(358950 + (lng + 2.5970) * 70700);
const toN = lat => Math.round(172850 + (lat - 51.4534) * 111300);

const QUERY = `[out:json][timeout:90];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](${BBOX});
  way["railway"="rail"]["usage"!="industrial"](${BBOX});
);
out geom;`;

const CLASSES = { motorway: 0, trunk: 0, primary: 1, secondary: 2, tertiary: 4 };

const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'User-Agent': 'glitchcan-minigam/1.0 (danbri@danbri.org)',
             'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'data=' + encodeURIComponent(QUERY),
});
if (!res.ok) throw new Error('Overpass HTTP ' + res.status);
const osm = await res.json();

const roads = [];
let points = 0;
for (const el of osm.elements) {
  if (el.type !== 'way' || !el.geometry) continue;
  const cls = el.tags.railway === 'rail' ? 3 : CLASSES[el.tags.highway];
  if (cls === undefined) continue;
  const label = el.tags.ref || el.tags.name || '';
  // thin to >= ~35m spacing, endpoints kept
  const pts = [];
  let last = null;
  for (const g of el.geometry) {
    const e = toE(g.lon), n = toN(g.lat);
    if (last && Math.hypot(e - last[0], n - last[1]) < 35) continue;
    pts.push([e, n]); last = [e, n];
  }
  const end = el.geometry[el.geometry.length - 1];
  const ee = toE(end.lon), en = toN(end.lat);
  if (pts.length && (pts[pts.length-1][0] !== ee || pts[pts.length-1][1] !== en)) pts.push([ee, en]);
  if (pts.length < 2) continue;
  points += pts.length;
  roads.push([cls, label, pts]);
}

mkdirSync(OUT, { recursive: true });
const out = {
  source: 'OpenStreetMap via Overpass API, fetched ' + new Date().toISOString().slice(0,10) +
          ' — © OpenStreetMap contributors, ODbL',
  crs: 'EPSG:27700 (BNG, linear approximation)',
  classes: ['motorway/trunk', 'primary', 'secondary', 'rail', 'tertiary'],
  fields: ['classIndex', 'ref_or_name', 'points[easting,northing]'],
  roads,
};
writeFileSync(join(OUT, 'roads-bristol.json'), JSON.stringify(out));
console.log(`wrote roads-bristol.json: ${roads.length} ways, ${points} points`);
