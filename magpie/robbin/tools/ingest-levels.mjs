#!/usr/bin/env node
// ingest-levels.mjs — bake REAL station depths and storey numbers into
// tube-levels.js, from two machine-readable TfL sources cached in data/:
//
//  1. data/station-depths-foi-0493-2223.csv — TfL FOI-0493-2223
//     ("Copy of Station depths.csv", foi.tfl.gov.uk). Per station:
//     ground level outside the station (metres above Ordnance Datum)
//     and per-line, per-direction platform levels referred to London
//     Underground Datum, which the file's own notes define as 100 m
//     below Ordnance Datum Newlyn. depth = ground − (platform − 100).
//
//  2. data/tfl-stationdata/ — TfL's step-free station topology feed
//     (api.tfl.gov.uk/stationdata/tfl-stationdata-detailed.zip; see
//     FeedInfo.csv for the feed date). StationPoints.csv assigns every
//     area of every station a LEVEL NUMBER in TfL's own convention:
//     street = 0, storeys count down (Hampstead platforms −4, Bank
//     Northern −5, Epping's footbridge +1). Area names encode lines
//     (CenEB = Central eastbound, NorSB = Northern southbound, Jubil,
//     HamWB, RPL-N = rail platform …), which lets us read per-line
//     platform storeys directly from TfL's data.
//
// Output: tube-levels.js — per game station: per-line { level, depth },
// plus the real ticket-hall / concourse storey. Stations the data
// doesn't cover simply aren't listed; the game falls back to synthesis.
// Run offline: node tools/ingest-levels.mjs   (from magpie/robbin/)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NETWORK } from '../tube-network.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = f => readFileSync(join(ROOT, f), 'utf8');

// tiny CSV splitter (quoted fields appear in both files)
function csv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const out = [];
    let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    rows.push(out);
  }
  return rows;
}

const CANON = new Set(Object.keys(NETWORK.stations));
// FOI/stationdata names → the game's station keys where spelling drifts
const ALIAS = {
  'HEATHROW AIRPORT TERMINAL 1, 2 & 3': 'HEATHROW TERMINALS 2 & 3',
  'HEATHROW TERMINALS 1, 2 & 3': 'HEATHROW TERMINALS 2 & 3',
  'HEATHROW TERMINALS 123': 'HEATHROW TERMINALS 2 & 3',
  'BANK / MONUMENT': 'BANK',
  'ST JOHNS WOOD': "ST JOHN'S WOOD",
  'ST PAULS': "ST PAUL'S",
  'QUEENS PARK': "QUEEN'S PARK",
  'REGENTS PARK': "REGENT'S PARK",
  'EARLS COURT': "EARL'S COURT",
  'KINGS CROSS ST PANCRAS': "KING'S CROSS ST PANCRAS",
  'SHEPHERDS BUSH': "SHEPHERD'S BUSH",
  'SHEPHERDS BUSH MARKET': "SHEPHERD'S BUSH MARKET",
  'TOTTERIDGE AND WHETSTONE': 'TOTTERIDGE & WHETSTONE',
  'TOTTERIDGE': 'TOTTERIDGE & WHETSTONE',
  'BROMLEY BY BOW': 'BROMLEY-BY-BOW',
  'KENSINGTON ( OLYMPIA )': 'KENSINGTON (OLYMPIA)',
  'HARROW ON THE HILL': 'HARROW-ON-THE-HILL',
  'RAYNERS LANE': 'RAYNERS LANE',
  'ELEPHANT AND CASTLE': 'ELEPHANT & CASTLE',
  'HIGHBURY AND ISLINGTON': 'HIGHBURY & ISLINGTON',
  'KENSINGTON OLYMPIA': 'KENSINGTON (OLYMPIA)',
};
function norm(name) {
  let n = name.toUpperCase()
    .replace(/\(BAKERLOO\)|\(CIRCLE.*?\)|\(DISTRICT\)|\(HAMMERSMITH & CITY\)|\(H & C\)|\(CENTRAL\)|\(MET.*?\)/g, '')
    .replace(/ (CITY|CHARING X) BRANCH$/g, '')   // Northern line branch twins merge
    .replace(/\bST\./g, 'ST')
    .replace(/\s+/g, ' ')
    .trim();
  if (CANON.has(n)) return n;
  const deAmp = n.replace(/ AND /g, ' & ');
  if (CANON.has(deAmp)) return deAmp;
  const deApos = n.replace(/[’']/g, "'");
  if (CANON.has(deApos)) return deApos;
  if (ALIAS[n]) return ALIAS[n];
  const noApos = n.replace(/[’']/g, '');
  if (ALIAS[noApos]) return ALIAS[noApos];
  return null;
}

// ------------------------------------------------- 1. FOI depths (m)
// header row 1 names the lines over paired direction columns
const FOI_LINES = [
  [2, 'bakerloo'], [4, 'central'], [6, 'district'], [8, 'hammersmith-city'],
  [10, 'jubilee'], [12, 'metropolitan'], [14, 'northern'], [16, 'piccadilly'],
  [18, 'victoria'], [20, 'waterloo-city'],
];
const depths = {};   // key → { line → depth in metres below street }
const foiRows = csv(rd('data/station-depths-foi-0493-2223.csv'));
let foiUnmatched = [];
for (const row of foiRows.slice(2)) {
  const raw = (row[0] || '').trim();
  const ground = parseFloat(row[1]);
  if (!raw || !Number.isFinite(ground)) continue;   // notes rows carry no ground level
  const key = norm(raw);
  if (!key) { foiUnmatched.push(raw); continue; }
  const d = depths[key] || (depths[key] = {});
  for (const [c, line] of FOI_LINES) {
    const vals = [row[c], row[c + 1]].map(parseFloat).filter(Number.isFinite);
    if (!vals.length) continue;
    const plat = vals.reduce((a, b) => a + b) / vals.length;
    const depth = ground - (plat - 100);
    // keep the deeper figure when line-qualified twin rows merge
    if (d[line] === undefined || depth > d[line]) d[line] = Math.round(depth * 10) / 10;
  }
}
// the Circle shares every one of its platforms; borrow its hosts' figure
for (const d of Object.values(depths)) {
  const host = d['hammersmith-city'] ?? d['district'] ?? d['metropolitan'];
  if (host !== undefined && d['circle'] === undefined) d['circle'] = host;
}

// --------------------------------------- 2. stationdata storey numbers
const stations = csv(rd('data/tfl-stationdata/Stations.csv')).slice(1);
const points = csv(rd('data/tfl-stationdata/StationPoints.csv')).slice(1);
const idName = new Map(stations.map(r => [r[0], r[1]]));
const pointLevel = new Map(points.map(r => [r[0], parseInt(r[4], 10)]));
// area-name prefixes that identify a LINE's platform areas
const AREA_LINE = [
  [/^bak/i, 'bakerloo'], [/^cen/i, 'central'], [/^dis/i, 'district'],
  [/^ham/i, 'hammersmith-city'], [/^cir/i, 'circle'], [/^jub/i, 'jubilee'],
  [/^nor(nb|sb|th|eb|wb)/i, 'northern'], [/^pic/i, 'piccadilly'],
  [/^vic/i, 'victoria'], [/^wat/i, 'waterloo-city'], [/^rpl/i, 'windrush'],
];
const EXCLUDE = /^(dlr|el\b|el |elm|elbh|tram)/i;   // other modes' storeys
const WINDRUSH = new Set(['ROTHERHITHE', 'CANADA WATER', 'SURREY QUAYS']);
const topo = {};   // key → { lineLevel: {line→storey}, negs:Set, hasUp:bool }
for (const p of points) {
  const [, stationId, areaName, , levelStr] = p;
  const name = idName.get(stationId);
  if (!name) continue;
  const key = norm(name);
  if (!key) continue;
  const level = parseInt(levelStr, 10);
  if (!Number.isFinite(level)) continue;
  const t = topo[key] || (topo[key] = { lineLevel: {}, negs: new Set(), hasUp: false });
  if (EXCLUDE.test(areaName)) continue;
  let matched = null;
  for (const [re, line] of AREA_LINE) if (re.test(areaName)) { matched = line; break; }
  // RPL (rail platform) areas mean the Windrush line only at the three
  // Windrush stations the game carries; elsewhere they're National Rail
  if (matched === 'windrush' && !WINDRUSH.has(key)) matched = null;
  if (matched && areaName !== 'MET') {      // 'MET' alone is an entrance, not the Met line
    const prev = t.lineLevel[matched];
    if (prev === undefined || level < prev) t.lineLevel[matched] = level;
  } else {
    if (level < 0) t.negs.add(level);
    if (level >= 1) t.hasUp = true;
  }
}

// ------------------------------------------- 2b. real lift graphs
// Lifts.csv routes each lift through named station areas; joined to
// StationPoints' storey numbers this is the on-site Lift guide as data:
// Canada Water = [0↔−1], [−1→−2→−3], [−1→−2]. On-site signage letters
// lifts (the photo of Canada Water's board says A/B/C even though the
// feed's FriendlyNames say 1/2/4), and boards letter the street lift
// first — so we sort by (shallowest top, deepest reach) and let the
// game assign A, B, C in that order.
const liftGraphs = {};   // key → [[levels shallow→deep], ...]
for (const row of csv(rd('data/tfl-stationdata/Lifts.csv')).slice(1)) {
  const [stationId, , , , , , fromAreas, mid1, mid2, toAreas] = row;
  const name = idName.get(stationId);
  const key = name && norm(name);
  if (!key) continue;
  const lvls = new Set();
  for (const field of [fromAreas, mid1, mid2, toAreas]) {
    for (const areaId of (field || '').split('|')) {
      const lv = pointLevel.get(areaId.trim());
      if (Number.isFinite(lv)) lvls.add(lv);
    }
  }
  if (lvls.size < 2) continue;
  (liftGraphs[key] = liftGraphs[key] || []).push([...lvls].sort((a, b) => b - a));
}
for (const lifts of Object.values(liftGraphs)) {
  lifts.sort((a, b) => (b[0] - a[0]) || (a[a.length - 1] - b[b.length - 1]));
}

// --------------------------------------------------------- 3. merge
const out = {};
const keys = new Set([...Object.keys(depths), ...Object.keys(topo), ...Object.keys(liftGraphs)]);
for (const key of [...keys].sort()) {
  const d = depths[key] || {};
  const t = topo[key] || { lineLevel: {}, negs: new Set(), hasUp: false };
  const lines = {};
  for (const line of new Set([...Object.keys(d), ...Object.keys(t.lineLevel)])) {
    const e = {};
    if (t.lineLevel[line] !== undefined) e.level = t.lineLevel[line];
    if (d[line] !== undefined) e.depth = d[line];
    // an entrance name can shadow a line prefix (Waterloo Road at
    // Waterloo): a positive storey contradicting a below-street depth
    // is a bad decode — trust the FOI depth, drop the storey
    if (e.level >= 1 && e.depth >= 3) delete e.level;
    lines[line] = e;
  }
  if (!Object.keys(lines).length && !t.negs.size) continue;
  const entry = { lines };
  const platLevels = new Set(Object.values(t.lineLevel));
  const negs = [...t.negs].filter(n => !platLevels.has(n)).sort((a, b) => b - a);
  if (negs.length) entry.ticket = negs[0];              // storey closest to street
  const deepest = Math.min(...Object.values(t.lineLevel), 0);
  const conc = negs.filter(n => n > deepest).sort((a, b) => a - b)[0];
  if (conc !== undefined && conc !== entry.ticket) entry.concourse = conc;
  if (liftGraphs[key]) entry.liftGraph = liftGraphs[key];
  out[key] = entry;
}

const covered = Object.keys(out).filter(k => CANON.has(k));
const withLevels = covered.filter(k => Object.values(out[k].lines).some(l => l.level !== undefined));
const withDepths = covered.filter(k => Object.values(out[k].lines).some(l => l.depth !== undefined));
const withLifts = covered.filter(k => out[k].liftGraph);
console.log(`stations in game network : ${CANON.size}`);
console.log(`covered by real data     : ${covered.length} (storeys ${withLevels.length}, depths ${withDepths.length}, lift graphs ${withLifts.length})`);
if (foiUnmatched.length) console.log('FOI names unmatched      :', foiUnmatched.join(' | '));
const un2 = [...new Set(stations.map(r => r[1]))].filter(n => !norm(n));
console.log('stationdata unmatched    :', un2.length, '(non-tube/non-windrush stations expected here)');

const body = Object.entries(out).filter(([k]) => CANON.has(k))
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
writeFileSync(join(ROOT, 'tube-levels.js'), `// GENERATED by tools/ingest-levels.mjs — do not edit by hand.
// Real per-station storey numbers and platform depths, from:
//  · TfL FOI-0493-2223 station depths CSV (data/station-depths-foi-0493-2223.csv)
//  · TfL step-free station topology feed (data/tfl-stationdata/, see FeedInfo.csv)
// level: TfL's own storey number (street = 0, down is negative);
// depth: metres below the street outside the station.
export const STATION_LEVELS = {
${body}
};
`);
console.log('wrote tube-levels.js');
