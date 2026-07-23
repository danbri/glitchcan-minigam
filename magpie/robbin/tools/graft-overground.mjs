#!/usr/bin/env node
// graft-overground.mjs — extend the Windrush line to its FULL real
// extent, and add the Elizabeth line's London core, without re-laying
// the map (same surgical approach as graft-dlr.mjs: existing positions
// and the Thames stay byte-identical; newcomers are placed by an
// affine lon/lat→map fit over the whole existing network and then
// relaxed alone).
//
// The Windrush fragment (Rotherhithe–Canada Water–Surrey Quays) came
// from the original hand-baked EXTRA_LINES. A field report riding the
// real thing north — Wapping, Shadwell, Whitechapel — settled it: the
// game gets the whole line, Highbury & Islington to Clapham Junction,
// Crystal Palace, West Croydon and New Cross, from the TfL API.
//
// The Elizabeth line is clipped to its London core (Paddington ↔
// Abbey Wood / Stratford): the map is a London map, and Reading and
// Shenfield would drag the whole design space forty miles sideways.
//
//   node magpie/robbin/tools/graft-overground.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const API = 'https://api.tfl.gov.uk';

const { NETWORK } = await import(join(ROOT, 'tube-network.js'));
const GEO = JSON.parse(readFileSync(join(ROOT, 'data', 'station-geo.json'), 'utf8'));

// same-place, different feed name → the station the map already has
const MERGE = {
  'NEW CROSS ELL': 'NEW CROSS',
  'CUSTOM HOUSE': 'CUSTOM HOUSE (FOR EXCEL)',
};

const norm = raw => {
  const n = raw
    .replace(/ (Rail|DLR|Underground) Station$/i, '')
    .replace(/ \(London\)$/, '')
    .replace(/\./g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  return MERGE[n] || n;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(path) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`);
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < 5) { await sleep(4000 * (attempt + 1)); continue; }
    throw new Error(`${path}: HTTP ${res.status}`);
  }
}

// Elizabeth line: London core only
const LIZ_CORE = new Set(['PADDINGTON', 'BOND STREET', 'TOTTENHAM COURT ROAD',
  'FARRINGDON', 'LIVERPOOL STREET', 'WHITECHAPEL', 'STRATFORD', 'CANARY WHARF',
  'CUSTOM HOUSE (FOR EXCEL)', 'WOOLWICH', 'ABBEY WOOD']);

const stops = {};   // NAME -> { lats, lons, ids:Set, zones:[] }
async function fetchLine(id, clip) {
  const seq = await get(`/Line/${id}/Route/Sequence/all?serviceTypes=Regular`);
  const chains = [];
  const seen = new Set();
  const dirSet = new Set();
  for (const sps of seq.stopPointSequences) {
    let chain = sps.stopPoint.map(p => {
      const name = norm(p.name);
      const st = (stops[name] ||= { lats: [], lons: [], ids: new Set(), zones: [] });
      st.lats.push(p.lat);
      st.lons.push(p.lon);
      st.ids.add(p.stationId || p.id);
      const z = parseInt(String(p.zone || '').split('+')[0], 10);
      if (z) st.zones.push(z);
      return name;
    });
    // clipped lines keep only their maximal in-core runs
    const runs = [];
    if (clip) {
      let run = [];
      for (const n of chain) {
        if (clip.has(n)) run.push(n);
        else { if (run.length > 1) runs.push(run); run = []; }
      }
      if (run.length > 1) runs.push(run);
    } else runs.push(chain);
    for (const r of runs) {
      for (let i = 0; i + 1 < r.length; i++) dirSet.add(`${r[i]}>${r[i + 1]}`);
      const key = r.join('|'), rkey = [...r].reverse().join('|');
      if (seen.has(key) || seen.has(rkey)) continue;
      seen.add(key);
      chains.push(r);
    }
  }
  const oneWay = [];
  for (const chain of chains)
    for (let i = 0; i + 1 < chain.length; i++) {
      const a = chain[i], b = chain[i + 1];
      if (dirSet.has(`${a}>${b}`) && !dirSet.has(`${b}>${a}`)) oneWay.push([a, b]);
      else if (!dirSet.has(`${a}>${b}`) && dirSet.has(`${b}>${a}`)) oneWay.push([b, a]);
    }
  return { chains, oneWay };
}

const windrush = await fetchLine('windrush', null);
const liz = await fetchLine('elizabeth', LIZ_CORE);
const allNames = [...new Set([...windrush.chains.flat(), ...liz.chains.flat()])];
const fresh = allNames.filter(n => !NETWORK.pos[n]);
console.log(`windrush: ${windrush.chains.length} chains · elizabeth core: ${liz.chains.length} chains`);
console.log(`${allNames.length} stations touched, ${fresh.length} new: ${fresh.join(' · ')}`);

// affine lon/lat→pos fit over the whole existing network
const anchors = Object.keys(NETWORK.pos).filter(n => GEO[n]);
function fit(dim) {
  let Sxx = 0, Sxy = 0, Sx1 = 0, Syy = 0, Sy1 = 0, S11 = 0, Tx = 0, Ty = 0, T1 = 0;
  for (const n of anchors) {
    const [lon, lat] = GEO[n];
    const v = NETWORK.pos[n][dim];
    Sxx += lon * lon; Sxy += lon * lat; Sx1 += lon;
    Syy += lat * lat; Sy1 += lat; S11 += 1;
    Tx += lon * v; Ty += lat * v; T1 += v;
  }
  const M = [[Sxx, Sxy, Sx1, Tx], [Sxy, Syy, Sy1, Ty], [Sx1, Sy1, S11, T1]];
  for (let i = 0; i < 3; i++) {
    const piv = M[i][i];
    for (let j = i; j < 4; j++) M[i][j] /= piv;
    for (let k = 0; k < 3; k++) {
      if (k === i) continue;
      const f = M[k][i];
      for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j];
    }
  }
  return [M[0][3], M[1][3], M[2][3]];
}
const AX = fit(0), AY = fit(1);
const place = (lon, lat) => [
  AX[0] * lon + AX[1] * lat + AX[2],
  AY[0] * lon + AY[1] * lat + AY[2],
];

const P = { ...NETWORK.pos };
const geoOut = { ...GEO };
for (const n of fresh) {
  const st = stops[n];
  const lon = st.lons.reduce((a, b) => a + b) / st.lons.length;
  const lat = st.lats.reduce((a, b) => a + b) / st.lats.length;
  geoOut[n] = [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
  P[n] = place(lon, lat);
}

// relax only the newcomers against everyone
const edges = [];
for (const chain of [...windrush.chains, ...liz.chains])
  for (let i = 0; i + 1 < chain.length; i++)
    if (chain[i] !== chain[i + 1]) edges.push([chain[i], chain[i + 1]]);
const freshSet = new Set(fresh);
const every = Object.keys(P);
for (let iter = 0; iter < 260; iter++) {
  for (const [a, b] of edges) {
    const pa = P[a], pb = P[b];
    const vx = pb[0] - pa[0], vy = pb[1] - pa[1];
    const len = Math.hypot(vx, vy) || 0.01;
    const L = Math.min(4.6, Math.max(2.2, len));
    const f = ((L - len) / len) * 0.12;
    if (freshSet.has(a)) { pa[0] -= vx * f; pa[1] -= vy * f; }
    if (freshSet.has(b)) { pb[0] += vx * f; pb[1] += vy * f; }
  }
  for (const n of fresh) {
    const pn = P[n];
    for (const m of every) {
      if (m === n) continue;
      const pm = P[m];
      const dx = pn[0] - pm[0], dy = pn[1] - pm[1];
      const d = Math.hypot(dx, dy);
      if (d < 1.7 && d > 0.001) {
        const push = (1.7 - d) * 0.4 / d;
        pn[0] += dx * push; pn[1] += dy * push;
      }
    }
  }
}
for (const n of fresh) P[n] = [Math.round(P[n][0] * 100) / 100, Math.round(P[n][1] * 100) / 100];

// facts for the newcomers
const stationsOut = { ...NETWORK.stations };
for (const n of fresh) {
  const st = stops[n];
  let lifts = 0, escalators = 0;
  for (const id of st.ids) {
    try {
      const d = await get(`/StopPoint/${id}`);
      for (const p of d.additionalProperties || []) {
        if (p.key === 'Lifts') lifts = Math.max(lifts, parseInt(p.value, 10) || 0);
        if (p.key === 'Escalators') escalators = Math.max(escalators, parseInt(p.value, 10) || 0);
      }
    } catch (e) { console.warn(`facilities ${id}: ${e.message}`); }
    await sleep(250);
  }
  const onLiz = liz.chains.some(c => c.includes(n));
  const onWr = windrush.chains.some(c => c.includes(n));
  stationsOut[n] = {
    zone: st.zones.length ? Math.min(...st.zones) : 2,
    lifts, escalators,
    lines: [...(onLiz ? ['elizabeth'] : []), ...(onWr ? ['windrush'] : [])],
    deep: 0,
    sub: onLiz ? 1 : 0,      // the Liz core runs in its big new boxes
  };
  console.log(`  ${n}: zone ${stationsOut[n].zone}, ${lifts} lifts, ${escalators} escalators`);
}
// stations already on the map that these lines call at
for (const n of allNames.filter(n => !freshSet.has(n))) {
  const lines = new Set(stationsOut[n].lines);
  if (windrush.chains.some(c => c.includes(n))) lines.add('windrush');
  if (liz.chains.some(c => c.includes(n))) lines.add('elizabeth');
  stationsOut[n] = { ...stationsOut[n], lines: [...lines].sort() };
}

const linesOut = { ...NETWORK.lines };
// the Windrush keeps its game identity (bronze, hollow) at full length
linesOut.windrush = {
  name: 'Windrush', color: '#c77b2f', hollow: true,
  chains: windrush.chains,
  ...(windrush.oneWay.length && { oneWay: windrush.oneWay }),
};
linesOut.elizabeth = {
  name: 'Elizabeth', color: '#6950A1',
  chains: liz.chains,
  ...(liz.oneWay.length && { oneWay: liz.oneWay }),
};

const out = `// tube-network.js — the whole London Underground for TUBE FLOCK.
// GENERATED by tools/fetch-tube.mjs from the TfL Unified API — do not edit
// by hand; re-run the tool to refresh. Step-free list is curated (real-ish).
// Snapshot date: ${NETWORK.generated} · relaid out ${NETWORK.relaidOut}
// DLR grafted ${NETWORK.dlrGrafted} by tools/graft-dlr.mjs
// Windrush (full) + Elizabeth core grafted ${new Date().toISOString().slice(0, 10)}
// by tools/graft-overground.mjs (existing positions untouched).

export const NETWORK = ${JSON.stringify({
  generated: NETWORK.generated,
  relaidOut: NETWORK.relaidOut,
  dlrGrafted: NETWORK.dlrGrafted,
  overgroundGrafted: new Date().toISOString().slice(0, 10),
  pos: P,
  thames: NETWORK.thames,
  stations: stationsOut,
  lines: linesOut,
  stepFree: NETWORK.stepFree,
  liftsOutSnapshot: NETWORK.liftsOutSnapshot,
}, null, 1)};
`;
writeFileSync(join(ROOT, 'tube-network.js'), out);
writeFileSync(join(ROOT, 'data', 'station-geo.json'), JSON.stringify(geoOut, null, 1));
console.log(`wrote tube-network.js: ${Object.keys(P).length} stations, ${Object.keys(linesOut).length} lines`);
