#!/usr/bin/env node
// Fetches a real one-off snapshot of other air traffic over the North Atlantic
// corridor from OpenSky Network's public, keyless REST API and writes
// ../data/flights-snapshot.json. This is "who else is up there right now" —
// a SNAPSHOT for offline flavour, not a live tracker.
//
// Re-run: node tools/fetch-flights-snapshot.mjs
//
// Privacy note: we deliberately drop callsigns/icao24 (which can identify a
// specific aircraft/owner) and keep only position, altitude and heading —
// enough to draw anonymous "another plane!" blips for a toddler audience.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Bounding box roughly covering the LHR-EWR corridor (Ireland to the US east coast).
const BBOX = { lamin: 38, lomin: -80, lamax: 56, lomax: 0 };

const url = `https://opensky-network.org/api/states/all?lamin=${BBOX.lamin}&lomin=${BBOX.lomin}&lamax=${BBOX.lamax}&lomax=${BBOX.lomax}`;
console.log('fetching', url);

// Shells out to curl (rather than node's fetch) so this plays nicely with any
// HTTPS_PROXY in the environment; OpenSky's anonymous tier is also flaky
// under shared-IP load, hence the retries.
function curlJson(u, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      const out = execFileSync('curl', ['-sS', '--fail', '--max-time', '20',
        '-A', 'glitchcan-minigam-ua17 (https://github.com/danbri/glitchcan-minigam)', u], { encoding: 'utf8' });
      return JSON.parse(out);
    } catch (err) {
      if (i === attempts - 1) throw err;
      const wait = 2000 * (i + 1);
      console.log(`curl failed, retrying in ${wait}ms...`);
      execFileSync('sleep', [String(wait / 1000)]);
    }
  }
}

const json = curlJson(url);

const flights = (json.states || [])
  .filter((s) => s[5] != null && s[6] != null && s[7] != null && !s[8]) // lon, lat, baro_altitude present, not on ground
  .map((s) => ({
    lon: Number(s[5].toFixed(2)),
    lat: Number(s[6].toFixed(2)),
    altitude_m: Math.round(s[7]),
    heading: s[10] != null ? Math.round(s[10]) : 0,
  }))
  .slice(0, 60); // plenty for a sky full of distant blips, keeps the file tiny

const out = {
  source: 'OpenSky Network public REST API (opensky-network.org), anonymized: no callsign/icao24 kept',
  fetchedAt: new Date().toISOString(),
  bbox: BBOX,
  flights,
};

writeFileSync(join(__dirname, '..', 'data', 'flights-snapshot.json'), JSON.stringify(out, null, 2));
console.log(`Wrote data/flights-snapshot.json with ${flights.length} aircraft.`);
