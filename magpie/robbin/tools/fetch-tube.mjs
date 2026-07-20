#!/usr/bin/env node
// fetch-tube.mjs — bake the whole London Underground into tube-network.js
// for TUBE FLOCK. Cached in-repo and reproducible, same pattern as
// trees/tools: run it again to refresh, commit the output.
//
//   node magpie/robbin/tools/fetch-tube.mjs
//
// Sources (TfL Unified API, no key needed at this volume):
//   /Line/{id}/Route/Sequence/all   — ordered station chains incl. branches
//   /Disruptions/Lifts/v2/         — today's real lift outages (snapshot)
// Step-free status is CURATED below (TfL removed accessibility fields from
// StopPoint); it is roughly-right, not authoritative — the game only
// promises "real-ish".

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.tfl.gov.uk';

// the eleven Underground lines, official colours; pale ones get an ink
// underlay on the lino paper so they stay legible
const LINES = {
  bakerloo:            { name: 'Bakerloo',            color: '#B36305' },
  central:             { name: 'Central',             color: '#E32017' },
  circle:              { name: 'Circle',              color: '#FFD300', pale: true },
  district:            { name: 'District',            color: '#00782A' },
  'hammersmith-city':  { name: 'Hammersmith & City',  color: '#F3A9BB', pale: true },
  jubilee:             { name: 'Jubilee',             color: '#A0A5A9' },
  metropolitan:        { name: 'Metropolitan',        color: '#9B0056' },
  northern:            { name: 'Northern',            color: '#26221e' },
  piccadilly:          { name: 'Piccadilly',          color: '#003688' },
  victoria:            { name: 'Victoria',            color: '#0098D4' },
  'waterloo-city':     { name: 'Waterloo & City',     color: '#95CDBA', pale: true },
};

// the Windrush line segment the game already loves (London Overground,
// not in the tube feed) — real stations, real-ish geography
const EXTRA_STATIONS = {
  'ROTHERHITHE':  { lat: 51.50084, lon: -0.05196 },
  'SURREY QUAYS': { lat: 51.49338, lon: -0.04755 },
};
const EXTRA_LINES = {
  windrush: {
    name: 'Windrush', color: '#c77b2f', hollow: true,
    chains: [['ROTHERHITHE', 'CANADA WATER', 'SURREY QUAYS']],
  },
};

// CURATED step-free-ish stations (street to platforms, more or less).
// Not authoritative — close enough for a cosy bird game.
const STEP_FREE = [
  // (BANK is left out on purpose: its lifts reach the Northern side but
  // the Central line platforms still aren't step-free, and the game's
  // BANK is the grand old four-level maze)
  'AMERSHAM', 'BALHAM', 'BARKING', 'BERMONDSEY', 'BLACKFRIARS',
  'BLACKHORSE ROAD', 'BOND STREET', 'BOROUGH', 'BRIXTON', 'BUCKHURST HILL',
  'CALEDONIAN ROAD', 'CANADA WATER', 'CANARY WHARF', 'CANNING TOWN',
  'CHESHAM', 'COCKFOSTERS', 'EALING BROADWAY', "EARL'S COURT", 'EDGWARE',
  'EPPING', 'FARRINGDON', 'FINSBURY PARK', 'FULHAM BROADWAY', 'GREEN PARK',
  'GREENFORD', 'HAINAULT', 'HAMMERSMITH', 'HARROW & WEALDSTONE',
  'HARROW-ON-THE-HILL', 'HEATHROW TERMINAL 4', 'HEATHROW TERMINAL 5',
  'HEATHROW TERMINALS 2 & 3', 'HENDON CENTRAL', 'HIGHBURY & ISLINGTON',
  'HILLINGDON', 'HOUNSLOW EAST', 'HOUNSLOW WEST', 'KENNINGTON',
  'KEW GARDENS', 'KILBURN', "KING'S CROSS ST PANCRAS", 'LIVERPOOL STREET',
  'LONDON BRIDGE', 'MARYLEBONE', 'MILL HILL EAST', 'MOOR PARK', 'MOORGATE',
  'MORDEN', 'NEWBURY PARK', 'NINE ELMS', 'NORTH GREENWICH', 'OAKWOOD',
  'OSTERLEY', 'PADDINGTON', 'BATTERSEA POWER STATION', 'RICHMOND',
  'SEVEN SISTERS', 'SOUTH WOODFORD', 'SOUTHGATE', 'SOUTHWARK', 'STANMORE',
  'STOCKWELL', 'STRATFORD', 'SUDBURY TOWN', 'SURREY QUAYS',
  'TOTTENHAM COURT ROAD', 'TOTTENHAM HALE', 'TOWER HILL', 'UXBRIDGE',
  'VAUXHALL', 'VICTORIA', 'WATERLOO', 'WEMBLEY CENTRAL', 'WEMBLEY PARK',
  'WEST HAM', 'WEST HAMPSTEAD', 'WESTMINSTER', 'WHITECHAPEL',
  'WILLESDEN GREEN', 'WIMBLEDON', 'WOOD LANE', 'WOODFORD', 'WOODSIDE PARK',
];

// line-qualified twins (both Hammersmiths, both Edgware Roads, H&C
// Paddington) merge under one name — they're official out-of-station
// interchanges and one dot each is plenty for a bird's-eye map.
// "(Olympia)" is a real name component and stays.
const norm = raw => raw
  .replace(/ Underground Station$/, '')
  .replace(/-Underground$/i, '')
  .replace(/ \((Bakerloo|Central|Circle Line|H&C Line|Dist&Picc Line)\)/i, '')
  .replace(/ \(London\)$/, '')
  .replace(/\./g, '')
  .toUpperCase()
  .replace(/\s+/g, ' ')
  .trim();

async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

const stations = {};   // NAME -> { lats: [], lons: [] }
const lines = {};      // id -> { name, color, pale?, hollow?, chains: [[NAME]] }

for (const [id, def] of Object.entries(LINES)) {
  const seq = await get(`/Line/${id}/Route/Sequence/all?serviceTypes=Regular`);
  const chains = [];
  const seen = new Set();
  for (const sps of seq.stopPointSequences) {
    const chain = sps.stopPoint.map(p => {
      const name = norm(p.name);
      (stations[name] ||= { lats: [], lons: [] });
      stations[name].lats.push(p.lat);
      stations[name].lons.push(p.lon);
      return name;
    });
    // each branch appears once per direction; keep one of each
    const key = chain.join('|'), rkey = [...chain].reverse().join('|');
    if (seen.has(key) || seen.has(rkey)) continue;
    seen.add(key);
    chains.push(chain);
  }
  lines[id] = { name: def.name, color: def.color, ...(def.pale && { pale: true }), chains };
  console.log(`${def.name}: ${chains.length} chains, ${new Set(chains.flat()).size} stations`);
}

for (const [name, { lat, lon }] of Object.entries(EXTRA_STATIONS)) {
  (stations[name] ||= { lats: [], lons: [] });
  stations[name].lats.push(lat);
  stations[name].lons.push(lon);
}
for (const [id, def] of Object.entries(EXTRA_LINES)) lines[id] = def;

// project: equirectangular km, then scaled so the network is ~260 units
// wide. +x east, +y south (screen-style), origin at the NW corner.
const all = Object.values(stations).map(s => ({
  lat: s.lats.reduce((a, b) => a + b) / s.lats.length,
  lon: s.lons.reduce((a, b) => a + b) / s.lons.length,
}));
const latMax = Math.max(...all.map(p => p.lat));
const lonMin = Math.min(...all.map(p => p.lon));
const lonMax = Math.max(...all.map(p => p.lon));
const KX = Math.cos((51.5 * Math.PI) / 180) * 111.32;   // km per deg lon
const KY = 111.32;                                       // km per deg lat
const widthKm = (lonMax - lonMin) * KX;
const SCALE = 260 / widthKm;                             // design units per km

const POS = {};
for (const [name, s] of Object.entries(stations)) {
  const lat = s.lats.reduce((a, b) => a + b) / s.lats.length;
  const lon = s.lons.reduce((a, b) => a + b) / s.lons.length;
  POS[name] = [
    Math.round((lon - lonMin) * KX * SCALE * 100) / 100,
    Math.round((latMax - lat) * KY * SCALE * 100) / 100,
  ];
}

// today's real lift outages, snapshotted (station ids -> our names where
// they are tube stations we know)
let liftsOutSnapshot = [];
try {
  const lifts = await get('/Disruptions/Lifts/v2/');
  const byId = {};
  for (const [id] of Object.entries(LINES)) {
    const seq = await get(`/Line/${id}/Route/Sequence/all?serviceTypes=Regular`);
    for (const sps of seq.stopPointSequences)
      for (const p of sps.stopPoint) byId[p.stationId || p.id] = norm(p.name);
  }
  liftsOutSnapshot = [...new Set(lifts.map(l => byId[l.stationUniqueId]).filter(Boolean))].sort();
  console.log(`lift outages today (tube): ${liftsOutSnapshot.length}`);
} catch (e) {
  console.warn('lift disruption snapshot skipped:', e.message);
}

const out = `// tube-network.js — the whole London Underground for TUBE FLOCK.
// GENERATED by tools/fetch-tube.mjs from the TfL Unified API — do not edit
// by hand; re-run the tool to refresh. Step-free list is curated (real-ish).
// Snapshot date: ${new Date().toISOString().slice(0, 10)}

export const NETWORK = ${JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  pos: POS,
  lines,
  stepFree: STEP_FREE.filter(n => POS[n]).sort(),
  liftsOutSnapshot,
}, null, 1)};
`;

const here = dirname(fileURLToPath(import.meta.url));
const dest = join(here, '..', 'tube-network.js');
writeFileSync(dest, out);
const missing = STEP_FREE.filter(n => !POS[n]);
if (missing.length) console.warn('step-free names not in network (check spelling):', missing);
console.log(`wrote ${dest}: ${Object.keys(POS).length} stations, ${Object.keys(lines).length} lines`);
