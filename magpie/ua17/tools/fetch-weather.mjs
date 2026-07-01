#!/usr/bin/env node
// Fetches real current cloud cover along the LHR->EWR great-circle route from
// Open-Meteo (no API key needed) and writes ../data/weather.json.
// Re-run this to refresh the snapshot: node tools/fetch-weather.mjs
//
// Output is a small array of waypoints with cloud-cover percentages by band,
// used to place the cloud field in the three.js scene. This is a one-shot
// SNAPSHOT (today's weather), not a live feed — the app works fully offline
// after this file is committed.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LHR = { lat: 51.4700, lon: -0.4543, name: 'London Heathrow (LHR)' };
const EWR = { lat: 40.6895, lon: -74.1745, name: 'Newark Liberty (EWR)' };
const WAYPOINTS = 14;

// Great-circle interpolation (slerp) between two lat/lon points, fraction 0..1.
function slerp(a, b, t) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const lat1 = toRad(a.lat), lon1 = toRad(a.lon);
  const lat2 = toRad(b.lat), lon2 = toRad(b.lon);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
  ));
  if (d === 0) return { lat: a.lat, lon: a.lon };
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lon = Math.atan2(y, x);
  return { lat: toDeg(lat), lon: toDeg(lon) };
}

async function fetchCloudsAt(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&hourly=cloudcover,cloudcover_low,cloudcover_mid,cloudcover_high,temperature_2m,weathercode&forecast_days=1&timezone=UTC`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`open-meteo ${res.status} for ${lat},${lon}`);
  const json = await res.json();
  const nowHour = new Date().toISOString().slice(0, 13);
  let idx = json.hourly.time.findIndex((t) => t.startsWith(nowHour));
  if (idx < 0) idx = 0;
  return {
    total: json.hourly.cloudcover[idx],
    low: json.hourly.cloudcover_low[idx],
    mid: json.hourly.cloudcover_mid[idx],
    high: json.hourly.cloudcover_high[idx],
    temperature: json.hourly.temperature_2m[idx],
    weathercode: json.hourly.weathercode[idx],
  };
}

const waypoints = [];
for (let i = 0; i < WAYPOINTS; i++) {
  const t = i / (WAYPOINTS - 1);
  const { lat, lon } = slerp(LHR, EWR, t);
  process.stdout.write(`fetching ${i + 1}/${WAYPOINTS} (${lat.toFixed(2)}, ${lon.toFixed(2)})...\n`);
  const cloud = await fetchCloudsAt(lat, lon);
  waypoints.push({ t, lat: Number(lat.toFixed(3)), lon: Number(lon.toFixed(3)), cloud });
}

const out = {
  source: 'Open-Meteo (api.open-meteo.com), free forecast API, no key required',
  fetchedAt: new Date().toISOString(),
  route: { from: LHR.name, to: EWR.name },
  waypoints,
};

writeFileSync(join(__dirname, '..', 'data', 'weather.json'), JSON.stringify(out, null, 2));
console.log(`Wrote data/weather.json with ${waypoints.length} waypoints.`);
