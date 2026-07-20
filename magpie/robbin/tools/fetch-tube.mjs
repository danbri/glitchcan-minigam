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

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(path) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`);
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < 5) {   // anonymous rate limit: back off
      await sleep(4000 * (attempt + 1));
      continue;
    }
    throw new Error(`${path}: HTTP ${res.status}`);
  }
}

// deep-tube vs sub-surface lines — the bones of each station's cross-section
const DEEP = new Set(['bakerloo', 'central', 'jubilee', 'northern', 'piccadilly', 'victoria', 'waterloo-city']);
const SUBSURFACE = new Set(['circle', 'district', 'hammersmith-city', 'metropolitan', 'windrush']);

const stations = {};   // NAME -> { lats, lons, ids:Set, zones:[], lines:Set }
const lines = {};      // id -> { name, color, pale?, hollow?, chains: [[NAME]] }

for (const [id, def] of Object.entries(LINES)) {
  const seq = await get(`/Line/${id}/Route/Sequence/all?serviceTypes=Regular`);
  const chains = [];
  const seen = new Set();
  const dirSet = new Set();   // every direction actually served, pre-dedupe
  for (const sps of seq.stopPointSequences) {
    const chain = sps.stopPoint.map(p => {
      const name = norm(p.name);
      const st = (stations[name] ||= { lats: [], lons: [], ids: new Set(), zones: [], lines: new Set() });
      st.lats.push(p.lat);
      st.lons.push(p.lon);
      st.ids.add(p.stationId || p.id);
      st.lines.add(id);
      const z = parseInt(String(p.zone || '').split('+')[0], 10);
      if (z) st.zones.push(z);
      return name;
    });
    for (let i = 0; i + 1 < chain.length; i++) dirSet.add(`${chain[i]}>${chain[i + 1]}`);
    // each branch appears once per direction; keep one of each
    const key = chain.join('|'), rkey = [...chain].reverse().join('|');
    if (seen.has(key) || seen.has(rkey)) continue;
    seen.add(key);
    chains.push(chain);
  }
  // not every line is a pair of tracks in opposite directions: the
  // Heathrow T4 loop, for one, only ever runs one way round. A chain
  // pair whose reverse is never served is one-way.
  const oneWay = [];
  for (const chain of chains)
    for (let i = 0; i + 1 < chain.length; i++) {
      const a = chain[i], b = chain[i + 1];
      if (dirSet.has(`${a}>${b}`) && !dirSet.has(`${b}>${a}`)) oneWay.push([a, b]);
      else if (!dirSet.has(`${a}>${b}`) && dirSet.has(`${b}>${a}`)) oneWay.push([b, a]);
    }
  lines[id] = { name: def.name, color: def.color, ...(def.pale && { pale: true }), chains, ...(oneWay.length && { oneWay }) };
  console.log(`${def.name}: ${chains.length} chains, ${new Set(chains.flat()).size} stations${oneWay.length ? `, ${oneWay.length} one-way stretches` : ''}`);
}

for (const [name, { lat, lon }] of Object.entries(EXTRA_STATIONS)) {
  const st = (stations[name] ||= { lats: [], lons: [], ids: new Set(), zones: [], lines: new Set() });
  st.lats.push(lat);
  st.lons.push(lon);
  st.zones.push(2);
}
for (const [id, def] of Object.entries(EXTRA_LINES)) {
  lines[id] = def;
  for (const chain of def.chains) for (const name of chain) stations[name]?.lines.add(id);
}

// ------------------------------------------------- real station facilities
// lift + escalator counts straight from each StopPoint's Facility props
async function facilitiesFor(ids) {
  let lifts = 0, escalators = 0;
  for (const id of ids) {
    try {
      const d = await get(`/StopPoint/${id}`);
      for (const p of d.additionalProperties || []) {
        if (p.key === 'Lifts') lifts = Math.max(lifts, parseInt(p.value, 10) || 0);
        if (p.key === 'Escalators') escalators = Math.max(escalators, parseInt(p.value, 10) || 0);
      }
    } catch (e) {
      console.warn(`facilities ${id}: ${e.message}`);
    }
  }
  return { lifts, escalators };
}
{
  const queue = Object.keys(stations);
  let done = 0;
  const workers = Array.from({ length: 2 }, async () => {
    for (;;) {
      const name = queue.pop();
      if (!name) return;
      const st = stations[name];
      Object.assign(st, await facilitiesFor([...st.ids]));
      await sleep(300);   // stay under the anonymous rate limit
      if (++done % 40 === 0) console.log(`facilities: ${done} stations…`);
    }
  });
  await Promise.all(workers);
  console.log('facilities: done');
}

// ------------------------------------------------- schematise the map
// Start from real geography (equirectangular km), then relax into an
// octolinear layout: every edge snaps toward the 45° grid with
// near-uniform lengths (suburbs compress, the middle breathes), runs
// straighten through intermediate stations, and stations keep a minimum
// distance apart. The design LANGUAGE of a transit diagram — drawn in
// our own lino style, no TfL artwork.
const KX = Math.cos((51.5 * Math.PI) / 180) * 111.32;   // km per deg lon
const KY = 111.32;                                       // km per deg lat
const P = {};
for (const [name, s] of Object.entries(stations)) {
  const lat = s.lats.reduce((a, b) => a + b) / s.lats.length;
  const lon = s.lons.reduce((a, b) => a + b) / s.lons.length;
  P[name] = [lon * KX, -lat * KY];
}
// unique undirected edges + per-line chains for the straightness pass
const edges = [];
{
  const seenE = new Set();
  for (const def of Object.values(lines))
    for (const chain of def.chains)
      for (let i = 0; i + 1 < chain.length; i++) {
        const a = chain[i], b = chain[i + 1];
        if (a === b) continue;
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (!seenE.has(k)) { seenE.add(k); edges.push([a, b]); }
      }
}
// scale so the median edge is ~3 units long
{
  const lens = edges.map(([a, b]) => Math.hypot(P[b][0] - P[a][0], P[b][1] - P[a][1])).sort((x, y) => x - y);
  const median = lens[Math.floor(lens.length / 2)] || 1;
  const k = 3 / median;
  for (const p of Object.values(P)) { p[0] *= k; p[1] *= k; }
}
const names = Object.keys(P);
for (let iter = 0; iter < 900; iter++) {
  const late = iter > 450;
  // edges snap toward the 45° grid at near-uniform length
  const kSnap = late ? 0.28 : 0.14;
  for (const [a, b] of edges) {
    const pa = P[a], pb = P[b];
    const vx = pb[0] - pa[0], vy = pb[1] - pa[1];
    const len = Math.hypot(vx, vy) || 0.01;
    const ang = Math.atan2(vy, vx);
    const snapped = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
    const L = Math.min(4.2, Math.max(2.4, len));
    const tx = Math.cos(snapped) * L, ty = Math.sin(snapped) * L;
    const dx = (tx - vx) * kSnap / 2, dy = (ty - vy) * kSnap / 2;
    pa[0] -= dx; pa[1] -= dy;
    pb[0] += dx; pb[1] += dy;
  }
  // runs straighten through their intermediate stations
  for (const def of Object.values(lines))
    for (const chain of def.chains)
      for (let i = 1; i + 1 < chain.length; i++) {
        const p = P[chain[i]], q = P[chain[i - 1]], r = P[chain[i + 1]];
        p[0] += ((q[0] + r[0]) / 2 - p[0]) * 0.06;
        p[1] += ((q[1] + r[1]) / 2 - p[1]) * 0.06;
      }
  // breathing room between any two stations
  const MIN = 1.7;
  for (let i = 0; i < names.length; i++) {
    const pi = P[names[i]];
    for (let j = i + 1; j < names.length; j++) {
      const pj = P[names[j]];
      const dx = pj[0] - pi[0], dy = pj[1] - pi[1];
      const d = Math.hypot(dx, dy);
      if (d < MIN && d > 0.001) {
        const push = (MIN - d) * 0.25 / d;
        pi[0] -= dx * push; pi[1] -= dy * push;
        pj[0] += dx * push; pj[1] += dy * push;
      }
    }
  }
}
// rebase to a 260-wide design space
const POS = {};
{
  const xs = names.map(n => P[n][0]), ys = names.map(n => P[n][1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const k = 260 / (Math.max(...xs) - x0);
  for (const n of names) {
    POS[n] = [Math.round((P[n][0] - x0) * k * 100) / 100, Math.round((P[n][1] - y0) * k * 100) / 100];
  }
}

// ------------------------------------------------- per-station facts
// levels are grounded in what serves the station: deep-tube platforms for
// deep lines (inner zones — the tube surfaces further out), sub-surface
// platforms for the cut-and-cover lines in the middle, footbridge-and-
// platform for open-air suburbia. Lift/escalator counts are TfL's own.
const stationsOut = {};
for (const [name, st] of Object.entries(stations)) {
  const zone = st.zones.length ? Math.min(...st.zones) : 6;
  const deep = [...st.lines].some(l => DEEP.has(l)) && zone <= 3;
  const sub = [...st.lines].some(l => SUBSURFACE.has(l)) && zone <= 2;
  stationsOut[name] = {
    zone,
    lifts: st.lifts || 0,
    escalators: st.escalators || 0,
    lines: [...st.lines].sort(),
    deep: deep ? 1 : 0,
    sub: sub ? 1 : 0,
  };
}

// today's real lift outages, snapshotted for provenance/curiosity only —
// the game does NOT consume this: in-game outages are gameplay-tuned
// randomness, not sociology
let liftsOutSnapshot = [];
try {
  const lifts = await get('/Disruptions/Lifts/v2/');
  const byId = {};
  for (const [name, st] of Object.entries(stations))
    for (const id of st.ids) byId[id] = name;
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
  stations: stationsOut,
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
