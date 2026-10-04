// Fetch the sky, weather and tide data for the 3D page's Sky panel (docklands/sky.js) and write small snapshots to
// docklands/data/sky/. Method and rules: pipeline.json activity "fetch-sky"; lessons: docklands/README.md
// "Sky, time, weather and tide".
//
//   NODE_USE_ENV_PROXY=1 node magpie/cwplans/tools/fetch-sky.mjs [stars] [lines] [sats] [weather] [tide] [--date 2026-10-03]
//
// With no part named, all five run. --date picks the evening of the weather and tide snapshots (London date; the
// snapshot covers that day and the next, so the hours after midnight are in it). Satellites are always the current
// CelesTrak elements (CelesTrak keeps no history), so run "sats" within a day or two of the date.
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';
import { TOOLS, get } from './lib.mjs';

const OUT = join(TOOLS, '..', 'docklands', 'data', 'sky');
const args = process.argv.slice(2), di = args.indexOf('--date'), DATE = di >= 0 ? args[di + 1] : '2026-10-03';
const parts = args.filter((a, i) => !a.startsWith('--') && !(di >= 0 && i === di + 1));
const want = p => !parts.length || parts.includes(p);
const next = d => new Date(Date.parse(d + 'T12:00Z') + 864e5).toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0, 10);
mkdirSync(OUT, { recursive: true });
const save = (f, o) => { const s = JSON.stringify(o); writeFileSync(join(OUT, f), s + '\n'); console.log(`wrote docklands/data/sky/${f} (${(s.length / 1024).toFixed(1)} KB)`); };
// the agent proxy and some hosts time out now and then: three more tries, 3, 6 and 9 s apart; a 4xx is not retried
const fetchRetry = async u => { for (let k = 0; ; k++) try { return await get(u); } catch (e) { if (k >= 3 || /^4\d\d /.test(e.message)) throw e; await new Promise(r => setTimeout(r, 3000 * (k + 1))); } };
const json = async u => JSON.parse((await fetchRetry(u)).toString('utf8'));

// 1. Yale Bright Star Catalogue, 5th revised edition (CDS V/50), stars to V 5.5: J2000 position, V, B-V.
// Fixed columns from the CDS ReadMe (1-based): HR 1-4, RAh 76-77, RAm 78-79, RAs 80-83, DE- 84, DEd 85-86,
// DEm 87-88, DEs 89-90, Vmag 103-107, B-V 110-114. Rows with no J2000 position (the 14 novae and galaxies) are dropped.
if (want('stars')) {
  const txt = gunzipSync(await fetchRetry('https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz')).toString('latin1'), rows = [];
  for (const l of txt.split('\n')) {
    const c = (a, b) => l.slice(a - 1, b).trim(), v = +c(103, 107);
    if (!c(76, 77) || !c(103, 107) || !(v <= 5.5)) continue;
    const ra = (+c(76, 77) + +c(78, 79) / 60 + +c(80, 83) / 3600) * 15, de = (c(84, 84) === '-' ? -1 : 1) * (+c(85, 86) + +c(87, 88) / 60 + +c(89, 90) / 3600);
    const bv = c(110, 114) === '' ? 0.6 : +c(110, 114);
    rows.push([+c(1, 4), Math.round(ra * 1000) / 1000, Math.round(de * 1000) / 1000, Math.round(v * 100) / 100, Math.round(bv * 100) / 100]);
  }
  rows.sort((a, b) => a[3] - b[3]);
  save('stars.json', { source: 'Yale Bright Star Catalogue, 5th revised ed. (Hoffleit & Warren 1991), CDS V/50 catalog.gz', url: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50', fetched: today,
    licence: 'public domain (NASA ADC); CDS asks that the catalogue be cited', fields: ['hr', 'ra_deg_j2000', 'dec_deg_j2000', 'vmag', 'b_v'], limit_vmag: 5.5, note: 'B-V missing: 0.6 assumed', stars: rows });
}

// 2. Constellation lines from d3-celestial (Olaf Frohn, BSD-3-Clause; lines after the IAU constellation charts).
// Kept: the 3-letter id and the line strings, coordinates rounded to 0.01 degree, longitude as RA in degrees 0-360.
if (want('lines')) {
  const d = await json('https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json');
  const lines = d.features.map(f => [f.id, f.geometry.coordinates.map(ls => ls.flatMap(([lo, la]) => [Math.round(((lo + 360) % 360) * 100) / 100, Math.round(la * 100) / 100]))]);
  save('constellation-lines.json', { source: 'd3-celestial data/constellations.lines.json (Olaf Frohn)', url: 'https://github.com/ofrohn/d3-celestial', fetched: today, licence: 'BSD-3-Clause (repository licence, Copyright (c) 2015, Olaf Frohn); lines after the IAU constellation charts',
    fields: 'per constellation: [IAU abbreviation, [[ra, dec, ra, dec, ...] per line string]] in J2000 degrees', lines });
}

// 3. Satellites: CelesTrak GP data (OMM JSON) for the ISS, the Chinese space station and the "visual" group
// (about 150 bright satellites). One request per group, once; CelesTrak asks for no more than one download per two hours.
if (want('sats')) {
  const groups = [['stations-iss', 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json'], ['css', 'https://celestrak.org/NORAD/elements/gp.php?CATNR=48274&FORMAT=json'],
    ['visual', 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=json']], seen = new Set(), sats = [];
  for (const [, u] of groups) for (const o of await json(u)) if (!seen.has(o.NORAD_CAT_ID)) { seen.add(o.NORAD_CAT_ID); sats.push(o); }
  save(`sats-${DATE}.json`, { source: 'CelesTrak GP data (OMM JSON), from 18 SDS / Space-Track', url: 'https://celestrak.org/NORAD/elements/', fetched: new Date().toISOString(), requests: groups.map(g => g[1]),
    licence: 'no licence stated; US Government GP data republished by CelesTrak; credit CelesTrak; usage policy: at most one download per 2 hours', count: sats.length, sats });
}

// 4. Weather: Open-Meteo hourly for Canary Wharf (51.5050, -0.0200), the date and the next day, London time.
// The forecast API keeps recent past days with the high-resolution models (visibility included); the archive API
// (ERA5) has no visibility. Model: best_match (for London the UK Met Office 2 km UKV first).
if (want('weather')) {
  const H = 'temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,wind_speed_10m,wind_direction_10m';
  const u = `https://api.open-meteo.com/v1/forecast?latitude=51.505&longitude=-0.02&start_date=${DATE}&end_date=${next(DATE)}&hourly=${H}&timezone=Europe%2FLondon`;
  const d = await json(u);
  save(`weather-${DATE}.json`, { source: 'Open-Meteo forecast API (best_match model), past hours', url: u, fetched: new Date().toISOString(), licence: 'CC BY 4.0', attribution: 'Weather data by Open-Meteo.com',
    latitude: d.latitude, longitude: d.longitude, timezone: d.timezone, units: d.hourly_units, hourly: d.hourly });
}

// 5. Tide: Environment Agency flood-monitoring readings (15-minute, m AOD) at the tidal Thames gauges round the
// Isle of Dogs: Tower Pier (0007) upstream, Charlton (0003) and Silvertown (0001) downstream. Times in UTC.
if (want('tide')) {
  const st = { '0007': 'Tower Pier', '0003': 'Charlton', '0001': 'Silvertown' }, out = {};
  for (const [id, name] of Object.entries(st)) {
    const s = (await json(`https://environment.data.gov.uk/flood-monitoring/id/stations/${id}`)).items;
    const u = `https://environment.data.gov.uk/flood-monitoring/id/measures/${id}-level-tidal_level-i-15_min-mAOD/readings?startdate=${DATE}&enddate=${next(next(DATE))}&_sorted&_limit=1000`;
    const r = (await json(u)).items.map(x => [x.dateTime.replace(':00Z', 'Z'), x.value]).sort((a, b) => a[0] < b[0] ? -1 : 1);
    out[id] = { name, lat: s.lat, lon: s.long, url: u, readings: r };
  }
  save(`tide-${DATE}.json`, { source: 'Environment Agency real-time flood-monitoring API, tidal level readings', url: 'https://environment.data.gov.uk/flood-monitoring/doc/reference', fetched: new Date().toISOString(), licence: 'OGL v3.0',
    attribution: 'This uses Environment Agency flood and river level data from the real-time data API (Beta)', units: 'm AOD (Ordnance Datum Newlyn), 15-minute instantaneous readings, UTC', stations: out });
}
