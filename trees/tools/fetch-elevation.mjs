#!/usr/bin/env node
// Fetch a real elevation grid for central Bristol from OpenTopoData (EU-DEM 25m)
// and cache it in the repo so the games never need the API at runtime.
//
//   node trees/tools/fetch-elevation.mjs
//   → trees/data/elevation-bristol.json (+ commit the .gz alongside)
//
// Public API etiquette: max 100 locations/request, 1 request/sec.

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

// Bounding box in WGS84, derived from the BNG box E 354000-363000, N 169000-178000
// (9 km x 9 km around Queen Square) using the repo's standard linear approximation:
// lat = 51.4534 + (N-172850)/111300 ; lng = -2.5970 + (E-358950)/70700
const BBOX = { latMin: 51.4188, latMax: 51.4997, lngMin: -2.6670, lngMax: -2.5397 };
const ROWS = 128, COLS = 128; // ~70 m spacing
const DATASET = 'eudem25m';

const points = [];
for (let r = 0; r < ROWS; r++) {
  const lat = BBOX.latMin + (BBOX.latMax - BBOX.latMin) * r / (ROWS - 1);
  for (let c = 0; c < COLS; c++) {
    const lng = BBOX.lngMin + (BBOX.lngMax - BBOX.lngMin) * c / (COLS - 1);
    points.push([lat, lng]);
  }
}

const sleep = ms => new Promise(res => setTimeout(res, ms));
const elev = new Array(points.length);

for (let i = 0; i < points.length; i += 100) {
  const batch = points.slice(i, i + 100);
  const locs = batch.map(p => p[0].toFixed(6) + ',' + p[1].toFixed(6)).join('|');
  const url = `https://api.opentopodata.org/v1/${DATASET}?locations=${locs}`;
  let ok = false;
  for (let attempt = 0; attempt < 4 && !ok; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      json.results.forEach((r, j) => {
        elev[i + j] = r.elevation == null ? 0 : Math.round(r.elevation * 10) / 10;
      });
      ok = true;
    } catch (e) {
      console.error(`batch ${i / 100}: ${e.message}, retry ${attempt + 1}`);
      await sleep(2000 * (attempt + 1));
    }
  }
  if (!ok) throw new Error('giving up at batch ' + i / 100);
  process.stdout.write(`\r${Math.min(i + 100, points.length)}/${points.length}`);
  await sleep(1100); // 1 req/sec limit
}
console.log();

mkdirSync(OUT, { recursive: true });
const out = {
  source: 'OpenTopoData ' + DATASET + ' (EU-DEM, Copernicus), fetched ' + new Date().toISOString().slice(0, 10),
  bbox: BBOX, rows: ROWS, cols: COLS, order: 'row-major, south-to-north, west-to-east',
  units: 'm', data: elev,
};
writeFileSync(join(OUT, 'elevation-bristol.json'), JSON.stringify(out));
const stats = elev.filter(e => e != null);
console.log(`wrote elevation-bristol.json  min ${Math.min(...stats)}m  max ${Math.max(...stats)}m`);
