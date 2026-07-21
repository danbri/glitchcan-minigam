#!/usr/bin/env node
// relayout-map.mjs — re-lay the TUBE FLOCK map as a HYBRID of the two
// famous pictures of London: the octolinear transit diagram and the real
// geography. Stations start from their true coordinates (cached in
// data/station-geo.json, fetched once from TfL /Line/{id}/StopPoints),
// get the classic tube-map radial zoom (centre enlarged, suburbs gently
// compressed — r^POW), then relax toward the 45° grid while a geographic
// anchor keeps every station honest about where it really is. Relative
// edge lengths survive (only softly clamped), so Chesham stays far and
// Leicester Square → Covent Garden stays short. The Thames rides the
// same transform: the river is the one landmark even the schematic map
// never dared drop.
//
//   node magpie/robbin/tools/relayout-map.mjs
//
// Rewrites tube-network.js in place: new pos + thames, everything else
// (chains, facts, one-way pairs, step-free, snapshots) preserved.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NETWORK } from '../tube-network.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEO_CACHE = join(ROOT, 'data', 'station-geo.json');
const API = 'https://api.tfl.gov.uk';
const norm = raw => raw
  .replace(/ Underground Station$/, '')
  .replace(/-Underground$/i, '')
  .replace(/ \((Bakerloo|Central|Circle Line|H&C Line|Dist&Picc Line)\)/i, '')
  .replace(/ \(London\)$/, '')
  .replace(/\./g, '')
  .toUpperCase()
  .replace(/\s+/g, ' ')
  .trim();

// ------------------------------------------------------ 1. geography
let GEO;   // name → [lon, lat]
if (existsSync(GEO_CACHE)) {
  GEO = JSON.parse(readFileSync(GEO_CACHE, 'utf8'));
  console.log(`geo cache: ${Object.keys(GEO).length} stations`);
} else {
  GEO = {
    // the Windrush pair the tube feed doesn't carry
    'ROTHERHITHE': [-0.05196, 51.50084],
    'SURREY QUAYS': [-0.04755, 51.49338],
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (const line of Object.keys(NETWORK.lines).filter(l => l !== 'windrush')) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${API}/Line/${line}/StopPoints`);
      if (res.ok) {
        for (const sp of await res.json()) {
          const key = norm(sp.commonName || '');
          if (NETWORK.stations[key] && sp.lon && sp.lat) GEO[key] = [sp.lon, sp.lat];
        }
        break;
      }
      if (res.status === 429 && attempt < 5) { await sleep(4000 * (attempt + 1)); continue; }
      throw new Error(`${line}: HTTP ${res.status}`);
    }
    await sleep(300);
  }
  writeFileSync(GEO_CACHE, JSON.stringify(GEO, null, 1));
  console.log(`fetched + cached geo for ${Object.keys(GEO).length} stations`);
}
const names = Object.keys(NETWORK.stations);
const missing = names.filter(n => !GEO[n]);
if (missing.length) throw new Error(`no geography for: ${missing.join(', ')}`);

// --------------------------------------- 2. the hybrid transformation
// equirectangular km, then the tube-map radial zoom about the centre
const KX = Math.cos((51.5 * Math.PI) / 180) * 111.32;
const KY = 111.32;
const proj = ([lon, lat]) => [lon * KX, -lat * KY];
const CENTRE = proj([-0.124, 51.51]);   // Charing Cross-ish, the map's heart
const POW = 0.74;                        // 1 = pure geography, lower = more Beck
const zoom = p => {
  const dx = p[0] - CENTRE[0], dy = p[1] - CENTRE[1];
  const r = Math.hypot(dx, dy) || 1e-6;
  const r2 = Math.pow(r, POW);
  return [CENTRE[0] + (dx / r) * r2, CENTRE[1] + (dy / r) * r2];
};
const G = {};   // anchor: where geography (post-zoom) says each station is
for (const n of names) G[n] = zoom(proj(GEO[n]));
// scale so the median edge is ~3 design units
const edges = [];
{
  const seen = new Set();
  for (const def of Object.values(NETWORK.lines))
    for (const chain of def.chains)
      for (let i = 0; i + 1 < chain.length; i++) {
        const a = chain[i], b = chain[i + 1];
        if (a === b) continue;
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (!seen.has(k)) { seen.add(k); edges.push([a, b]); }
      }
}
let SCALE = 1;
{
  const lens = edges.map(([a, b]) => Math.hypot(G[b][0] - G[a][0], G[b][1] - G[a][1])).sort((x, y) => x - y);
  SCALE = 3 / (lens[Math.floor(lens.length / 2)] || 1);
  for (const n of names) { G[n][0] *= SCALE; G[n][1] *= SCALE; }
}
const P = {};
for (const n of names) P[n] = [...G[n]];

// octolinear relaxation WITH a geographic conscience: geography leads
// early (the city keeps its true shape), the 45° grid crystallises late
const ITER = 900;
for (let iter = 0; iter < ITER; iter++) {
  const f = iter / ITER;
  const kSnap = 0.1 + 0.26 * f * f;
  for (const [a, b] of edges) {
    const pa = P[a], pb = P[b];
    const vx = pb[0] - pa[0], vy = pb[1] - pa[1];
    const len = Math.hypot(vx, vy) || 0.01;
    const ang = Math.atan2(vy, vx);
    const snapped = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
    // lengths stay proportional to reality — only softly clamped
    const L = Math.min(5.5, Math.max(1.7, len));
    const tx = Math.cos(snapped) * L, ty = Math.sin(snapped) * L;
    const dx = (tx - vx) * kSnap / 2, dy = (ty - vy) * kSnap / 2;
    pa[0] -= dx; pa[1] -= dy;
    pb[0] += dx; pb[1] += dy;
  }
  for (const def of Object.values(NETWORK.lines))
    for (const chain of def.chains)
      for (let i = 1; i + 1 < chain.length; i++) {
        const p = P[chain[i]], q = P[chain[i - 1]], r = P[chain[i + 1]];
        p[0] += ((q[0] + r[0]) / 2 - p[0]) * (0.04 + 0.05 * f);
        p[1] += ((q[1] + r[1]) / 2 - p[1]) * (0.04 + 0.05 * f);
      }
  // the anchor: geography always keeps a vote, loudest at the start —
  // and in the last stretch it goes quiet so the grid can crystallise
  const kGeo = f > 0.85 ? 0 : 0.006 + 0.03 * (1 - f);
  for (const n of names) {
    P[n][0] += (G[n][0] - P[n][0]) * kGeo;
    P[n][1] += (G[n][1] - P[n][1]) * kGeo;
  }
  const MIN = 1.55;
  for (let i = 0; i < names.length; i++) {
    const pi = P[names[i]];
    for (let j = i + 1; j < names.length; j++) {
      const pj = P[names[j]];
      const dx = pj[0] - pi[0], dy = pj[1] - pi[1];
      const d = Math.hypot(dx, dy);
      if (d < MIN && d > 0.001) {
        const push = (MIN - d) * 0.22 / d;
        pi[0] -= dx * push; pi[1] -= dy * push;
        pj[0] += dx * push; pj[1] += dy * push;
      }
    }
  }
}

// ------------------------------------------------------- 3. the Thames
// A stylised centreline, west to east, from public geography — enough
// bends to be unmistakably the Thames: the Richmond loops, the Barnes
// dip, the Westminster S, the Isle of Dogs meander, the O2 wrap.
const THAMES_LL = [
  [-0.334, 51.404], [-0.305, 51.410], [-0.316, 51.423], [-0.327, 51.437],
  [-0.320, 51.452], [-0.303, 51.461], [-0.318, 51.472], [-0.303, 51.484],
  [-0.287, 51.490], [-0.268, 51.487], [-0.253, 51.470], [-0.240, 51.475],
  [-0.229, 51.487], [-0.216, 51.479], [-0.211, 51.462], [-0.191, 51.460],
  [-0.176, 51.470], [-0.172, 51.481], [-0.155, 51.484], [-0.140, 51.483],
  [-0.128, 51.487], [-0.122, 51.494], [-0.122, 51.501], [-0.117, 51.507],
  [-0.110, 51.510], [-0.099, 51.511], [-0.088, 51.508], [-0.075, 51.505],
  [-0.056, 51.504], [-0.045, 51.500], [-0.036, 51.506], [-0.030, 51.495],
  [-0.021, 51.485], [-0.010, 51.488], [-0.004, 51.503], [0.003, 51.505],
  [0.008, 51.496], [0.020, 51.492], [0.035, 51.492], [0.050, 51.496],
  [0.070, 51.505], [0.095, 51.513],
];
let thames = THAMES_LL.map(ll => {
  const p = zoom(proj(ll));
  return [p[0] * SCALE, p[1] * SCALE];
});
// the stations moved while they relaxed; the river must move WITH the
// city or it lies about which bank things are on. Warp each river point
// by an inverse-distance blend of the displacement its neighbouring
// stations took (soft floor so no single station yanks the water).
thames = thames.map(p => {
  const near = names
    .map(n => ({ n, d2: (G[n][0] - p[0]) ** 2 + (G[n][1] - p[1]) ** 2 }))
    .sort((a, b) => a.d2 - b.d2).slice(0, 10);
  let wx = 0, wy = 0, tw = 0;
  for (const { n, d2 } of near) {
    const w2 = 1 / (d2 + 0.8);
    wx += (P[n][0] - G[n][0]) * w2;
    wy += (P[n][1] - G[n][1]) * w2;
    tw += w2;
  }
  return [p[0] + wx / tw, p[1] + wy / tw];
});
// two rounds of Chaikin so the ribbon flows
for (let round = 0; round < 2; round++) {
  const out = [thames[0]];
  for (let i = 0; i + 1 < thames.length; i++) {
    const a = thames[i], b = thames[i + 1];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
    out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  out.push(thames[thames.length - 1]);
  thames = out;
}

// -------------------------------------------- 4. rebase + write it out
const xs = names.map(n => P[n][0]), ys = names.map(n => P[n][1]);
const x0 = Math.min(...xs), y0 = Math.min(...ys);
const k260 = 260 / (Math.max(...xs) - x0);
const round2 = v => Math.round(v * 100) / 100;
const pos = {};
for (const n of names) pos[n] = [round2((P[n][0] - x0) * k260), round2((P[n][1] - y0) * k260)];
const thamesOut = thames.map(p => [round2((p[0] - x0) * k260), round2((p[1] - y0) * k260)]);

const out = {
  generated: NETWORK.generated,
  relaidOut: new Date().toISOString().slice(0, 10),
  pos,
  thames: thamesOut,
  stations: NETWORK.stations,
  lines: NETWORK.lines,
  stepFree: NETWORK.stepFree,
  liftsOutSnapshot: NETWORK.liftsOutSnapshot,
};
writeFileSync(join(ROOT, 'tube-network.js'),
  `// tube-network.js — the whole London Underground for TUBE FLOCK.
// GENERATED by tools/fetch-tube.mjs from the TfL Unified API — do not edit
// by hand; re-run the tool to refresh. Step-free list is curated (real-ish).
// Layout re-derived by tools/relayout-map.mjs: a geography/octolinear
// HYBRID (radial centre zoom + 45° snap + geographic anchor) with the
// Thames baked in from a stylised centreline.
// Snapshot date: ${NETWORK.generated} · relayout: ${out.relaidOut}

export const NETWORK = ${JSON.stringify(out, null, 1)};
`);
console.log(`relaid ${names.length} stations; thames ${thamesOut.length} pts; wrote tube-network.js`);

// debug SVG so humans can eyeball the whole city at once
{
  const W = 1200, Hh = 900;
  const px = ([x, y]) => [x * (W - 60) / 260 + 30, y * (W - 60) / 260 + 30];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" style="background:#f2ecdd">`;
  svg += `<polyline fill="none" stroke="#a8c8da" stroke-width="9" stroke-linejoin="round" points="${thamesOut.map(p => px(p).map(v => v.toFixed(1)).join(',')).join(' ')}"/>`;
  for (const [id, def] of Object.entries(NETWORK.lines)) {
    for (const chain of def.chains) {
      svg += `<polyline fill="none" stroke="${def.color}" stroke-width="2.2" stroke-linejoin="round" points="${chain.map(n => px(pos[n]).map(v => v.toFixed(1)).join(',')).join(' ')}"/>`;
    }
  }
  for (const n of names) {
    const [x, y] = px(pos[n]);
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="#26221e"/>`;
  }
  for (const n of ['WESTMINSTER', 'WATERLOO', 'EMBANKMENT', 'LONDON BRIDGE', 'TOWER HILL',
    'PUTNEY BRIDGE', 'KEW GARDENS', 'RICHMOND', 'CANARY WHARF', 'NORTH GREENWICH',
    'CANADA WATER', 'VAUXHALL', 'PIMLICO', 'BANK', "KING'S CROSS ST PANCRAS", 'STRATFORD',
    'HAMMERSMITH', 'BRIXTON', 'MORDEN', 'EPPING', 'HEATHROW TERMINAL 4', 'AMERSHAM']) {
    const [x, y] = px(pos[n]);
    svg += `<text x="${(x + 3).toFixed(1)}" y="${(y - 3).toFixed(1)}" font-size="9" fill="#26221e">${n}</text>`;
  }
  svg += '</svg>';
  writeFileSync(join(ROOT, 'data', 'map-debug.svg'), svg);
  console.log('debug render: data/map-debug.svg');
}
