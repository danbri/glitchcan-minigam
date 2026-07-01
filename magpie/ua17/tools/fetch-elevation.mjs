#!/usr/bin/env node
// Fetches REAL terrain elevation grids (DEM) for the London and New York
// regions from the public Open-Topo-Data API (ASTER GDEM, 30m), and writes
// ../data/elevation-london.json / elevation-nyc.json. Real elevation gives
// real coastlines (land where height>0, sea where <=0) and real relief — the
// "use OSM + elevation like the trees project" approach.
//
// Re-run: node tools/fetch-elevation.mjs   (slow: public API is ~1 req/s)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

const REGIONS = [
  // [key, south, west, north, east] — ~0.45° tall boxes centred on each city/coast
  { key: 'london', s: 51.30, w: -0.62, n: 51.70, e: 0.30 },
  { key: 'nyc', s: 40.48, w: -74.35, n: 40.92, e: -73.70 },
];
const N = 64; // grid resolution per axis (64x64 = 4096 samples)

function curlJson(url, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      return JSON.parse(execFileSync('curl', ['-sS', '--fail', '--max-time', '25', url], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
    } catch (err) {
      if (i === attempts - 1) throw err;
      execFileSync('sleep', [String(3 * (i + 1))]);
    }
  }
}

for (const r of REGIONS) {
  console.log(`fetching ${r.key} DEM ${N}x${N}...`);
  const grid = new Array(N * N).fill(0);
  const coords = [];
  for (let iy = 0; iy < N; iy++) {
    for (let ix = 0; ix < N; ix++) {
      const lat = r.s + (r.n - r.s) * (iy / (N - 1));
      const lon = r.w + (r.e - r.w) * (ix / (N - 1));
      coords.push([iy * N + ix, lat, lon]);
    }
  }
  // 100 locations per request (API limit), ~1.1s apart.
  for (let b = 0; b < coords.length; b += 100) {
    const batch = coords.slice(b, b + 100);
    const locs = batch.map(([, lat, lon]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join('|');
    const url = `https://api.opentopodata.org/v1/aster30m?locations=${locs}`;
    const json = curlJson(url);
    json.results.forEach((res, k) => { grid[batch[k][0]] = res.elevation == null ? 0 : Math.round(res.elevation); });
    process.stdout.write(`  ${Math.min(b + 100, coords.length)}/${coords.length}\r`);
    execFileSync('sleep', ['1.1']);
  }
  const out = {
    source: 'Open-Topo-Data / ASTER GDEM v3 (30m), NASA/METI — public elevation API',
    fetchedAt: new Date().toISOString(),
    region: r.key,
    bbox: { s: r.s, w: r.w, n: r.n, e: r.e },
    n: N,
    // elevations in metres, row-major (iy outer, ix inner), south->north, west->east
    elev: grid,
  };
  writeFileSync(join(__dirname, '..', 'data', `elevation-${r.key}.json`), JSON.stringify(out));
  const land = grid.filter((v) => v > 0).length;
  console.log(`\nWrote data/elevation-${r.key}.json (${land}/${grid.length} land samples)`);
}
console.log('done');
