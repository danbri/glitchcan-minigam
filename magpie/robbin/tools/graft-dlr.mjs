#!/usr/bin/env node
// graft-dlr.mjs — add the Docklands Light Railway to tube-network.js
// WITHOUT re-laying the map. The 2026 authenticity audit found the
// Underground graph itself complete (Circle loop closed, all Northern/
// Central/Piccadilly/Met/District branches present) but the DLR wholly
// absent — no Lewisham, no Beckton, no LONDON CITY AIRPORT.
//
// A full re-bake (fetch-tube + relayout) would reflow every station and
// drop hand-carried keys (the Thames). So this grafts instead:
//   1. fetch the DLR's real chains + facilities from the TfL API;
//   2. fit an affine lon/lat → map-position transform over the EXISTING
//      east-London stations (data/station-geo.json is the ground truth
//      the layout grew from), and place only the NEW stations with it;
//   3. relax just the newcomers (existing stations never move);
//   4. write tube-network.js back with every other key untouched.
//
//   node magpie/robbin/tools/graft-dlr.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const API = 'https://api.tfl.gov.uk';

const { NETWORK } = await import(join(ROOT, 'tube-network.js'));
const GEO = JSON.parse(readFileSync(join(ROOT, 'data', 'station-geo.json'), 'utf8'));

const norm = raw => raw
  .replace(/ DLR Station$/i, '')
  .replace(/ Underground Station$/, '')
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
    if (res.status === 429 && attempt < 5) { await sleep(4000 * (attempt + 1)); continue; }
    throw new Error(`${path}: HTTP ${res.status}`);
  }
}

// ------------------------------------------------ 1. the DLR, for real
const seq = await get('/Line/dlr/Route/Sequence/all?serviceTypes=Regular');
const stops = {};    // NAME -> { lats, lons, ids:Set, zones:[] }
const chains = [];
const seen = new Set();
const dirSet = new Set();
for (const sps of seq.stopPointSequences) {
  const chain = sps.stopPoint.map(p => {
    const name = norm(p.name);
    const st = (stops[name] ||= { lats: [], lons: [], ids: new Set(), zones: [] });
    st.lats.push(p.lat);
    st.lons.push(p.lon);
    st.ids.add(p.stationId || p.id);
    const z = parseInt(String(p.zone || '').split('+')[0], 10);
    if (z) st.zones.push(z);
    return name;
  });
  for (let i = 0; i + 1 < chain.length; i++) dirSet.add(`${chain[i]}>${chain[i + 1]}`);
  const key = chain.join('|'), rkey = [...chain].reverse().join('|');
  if (seen.has(key) || seen.has(rkey)) continue;
  seen.add(key);
  chains.push(chain);
}
const oneWay = [];
for (const chain of chains)
  for (let i = 0; i + 1 < chain.length; i++) {
    const a = chain[i], b = chain[i + 1];
    if (dirSet.has(`${a}>${b}`) && !dirSet.has(`${b}>${a}`)) oneWay.push([a, b]);
    else if (!dirSet.has(`${a}>${b}`) && dirSet.has(`${b}>${a}`)) oneWay.push([b, a]);
  }
const allNames = [...new Set(chains.flat())];
const fresh = allNames.filter(n => !NETWORK.pos[n]);
const shared = allNames.filter(n => NETWORK.pos[n]);
console.log(`DLR: ${chains.length} chains, ${allNames.length} stations (${fresh.length} new, shared: ${shared.join(', ')})`);

// ------------------------------- 2. affine fit over east-London anchors
// anchors: existing stations east of centre with known geography
const anchors = Object.keys(NETWORK.pos).filter(n => GEO[n] && GEO[n][0] > -0.15);
// least squares: [x] = [lon lat 1]·A  (two independent 3-param fits)
function fit(dim) {
  let Sxx = 0, Sxy = 0, Sx1 = 0, Syy = 0, Sy1 = 0, S11 = 0, Tx = 0, Ty = 0, T1 = 0;
  for (const n of anchors) {
    const [lon, lat] = GEO[n];
    const v = NETWORK.pos[n][dim];
    Sxx += lon * lon; Sxy += lon * lat; Sx1 += lon;
    Syy += lat * lat; Sy1 += lat; S11 += 1;
    Tx += lon * v; Ty += lat * v; T1 += v;
  }
  // solve 3×3 [Sxx Sxy Sx1; Sxy Syy Sy1; Sx1 Sy1 S11] · c = [Tx Ty T1]
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
// fit sanity: how far off are the anchors themselves?
{
  let worst = 0;
  for (const n of anchors) {
    const [px, py] = place(...GEO[n]);
    worst = Math.max(worst, Math.hypot(px - NETWORK.pos[n][0], py - NETWORK.pos[n][1]));
  }
  console.log(`affine fit over ${anchors.length} anchors, worst residual ${worst.toFixed(1)} units`);
}

const P = { ...NETWORK.pos };
const geoOut = { ...GEO };
for (const n of fresh) {
  const st = stops[n];
  const lon = st.lons.reduce((a, b) => a + b) / st.lons.length;
  const lat = st.lats.reduce((a, b) => a + b) / st.lats.length;
  geoOut[n] = [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
  P[n] = place(lon, lat);
}

// --------------------------- 3. relax the newcomers; nobody else moves
const edges = [];
for (const chain of chains)
  for (let i = 0; i + 1 < chain.length; i++)
    if (chain[i] !== chain[i + 1]) edges.push([chain[i], chain[i + 1]]);
const freshSet = new Set(fresh);
const every = Object.keys(P);
for (let iter = 0; iter < 260; iter++) {
  // DLR edges keep sane lengths (only the fresh end of an edge moves)
  for (const [a, b] of edges) {
    const pa = P[a], pb = P[b];
    const vx = pb[0] - pa[0], vy = pb[1] - pa[1];
    const len = Math.hypot(vx, vy) || 0.01;
    const L = Math.min(4.6, Math.max(2.2, len));
    const f = ((L - len) / len) * 0.12;
    if (freshSet.has(a)) { pa[0] -= vx * f; pa[1] -= vy * f; }
    if (freshSet.has(b)) { pb[0] += vx * f; pb[1] += vy * f; }
  }
  // breathing room, fresh stations only
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

// ------------------------------------------ 4. facts for the newcomers
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
  stationsOut[n] = {
    zone: st.zones.length ? Math.min(...st.zones) : 3,
    lifts, escalators,
    lines: ['dlr'],
    deep: 0, sub: 0,          // the DLR rides high: viaducts and docksides
  };
  console.log(`  ${n}: zone ${stationsOut[n].zone}, ${lifts} lifts, ${escalators} escalators`);
}
for (const n of shared) {
  const lines = new Set(stationsOut[n].lines);
  lines.add('dlr');
  stationsOut[n] = { ...stationsOut[n], lines: [...lines].sort() };
}

const linesOut = {
  ...NETWORK.lines,
  dlr: { name: 'DLR', color: '#00A4A7', chains, ...(oneWay.length && { oneWay }) },
};
// every DLR station is genuinely step-free — that is the whole point of it
const stepFree = [...new Set([...NETWORK.stepFree, ...allNames])].sort();

const out = `// tube-network.js — the whole London Underground for TUBE FLOCK.
// GENERATED by tools/fetch-tube.mjs from the TfL Unified API — do not edit
// by hand; re-run the tool to refresh. Step-free list is curated (real-ish).
// Snapshot date: ${NETWORK.generated} · relaid out ${NETWORK.relaidOut}
// DLR grafted ${new Date().toISOString().slice(0, 10)} by tools/graft-dlr.mjs
// (existing positions untouched; newcomers placed by local affine fit).

export const NETWORK = ${JSON.stringify({
  generated: NETWORK.generated,
  relaidOut: NETWORK.relaidOut,
  dlrGrafted: new Date().toISOString().slice(0, 10),
  pos: P,
  thames: NETWORK.thames,
  stations: stationsOut,
  lines: linesOut,
  stepFree,
  liftsOutSnapshot: NETWORK.liftsOutSnapshot,
}, null, 1)};
`;
writeFileSync(join(ROOT, 'tube-network.js'), out);
writeFileSync(join(ROOT, 'data', 'station-geo.json'), JSON.stringify(geoOut, null, 1));
console.log(`wrote tube-network.js: ${Object.keys(P).length} stations, ${Object.keys(linesOut).length} lines`);
