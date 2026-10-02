#!/usr/bin/env node
// Build the Docklands model data from the raw files.
//   node magpie/cwplans/tools/fetch-raw.mjs grid                 (OSTN15 grid, shared with the corridor)
//   node magpie/cwplans/tools/fetch-docklands.mjs                (OSM extract, LiDAR tiles, Wikidata)
//   node --max-old-space-size=6000 magpie/cwplans/tools/osm-clip-docklands.mjs
//   node --max-old-space-size=6000 magpie/cwplans/tools/build-docklands.mjs
// out: magpie/cwplans/docklands/data/area.js   (terrain, water, greens, buildings, roads, rail, tunnels, places)
//      magpie/cwplans/docklands/data/under.js  (levels, indoor ways, underground points, basements: the Canary Wharf detail)
// Local metres: x = E - E0, z = -(N - N0) (north is -z), y = metres above Ordnance Datum Newlyn.
// What is measured and what is assumed: magpie/cwplans/docklands/README.md.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { gunzipSync } from 'zlib';
import { join } from 'path';
import { TOOLS, bngProjector, mosaic, r1, pct, min, polyArea, clipRing, cellsIn, poly, enc, joinRings, simplify } from './lib.mjs';
import { DIR, BOX_BNG, ORIGIN, lidarTiles, tileFile } from './fetch-docklands.mjs';

const OUTDIR = join(TOOLS, '..', 'docklands', 'data');
const { E0, N0 } = ORIGIN;
const TERRAIN_CELL = 20;
const B = { x0: BOX_BNG.e0 - E0, x1: BOX_BNG.e1 - E0, z0: -(BOX_BNG.n1 - N0), z1: -(BOX_BNG.n0 - N0) };
const inside = (x, z, m = 0) => x >= B.x0 + m && x <= B.x1 - m && z >= B.z0 + m && z <= B.z1 - m;

const toBNG = await bngProjector();
const toLocal = (lon, lat) => { const [e, n] = toBNG(lon, lat); return [e - E0, -(n - N0)]; };
// Canary Wharf focus box (same as osm-clip-docklands.mjs FOCUS), in local metres
const [fa, fb] = [toLocal(-0.0300, 51.5100), toLocal(-0.0050, 51.4980)];
const FOCUS = { x0: fa[0], x1: fb[0], z0: fa[1], z1: fb[1] };
const inFocus = (x, z) => x >= FOCUS.x0 && x <= FOCUS.x1 && z >= FOCUS.z0 && z <= FOCUS.z1;

// ---- LiDAR (EA composite 1 m), as local-coordinate lookups
const files = n => lidarTiles().map(t => tileFile(n, t)).filter(existsSync);
const [DTMm, DSMm] = [await mosaic(files('dtm')), await mosaic(files('dsm'))];
const DTM = (x, z) => DTMm.at(x + E0, N0 - z), DSM = (x, z) => DSMm.at(x + E0, N0 - z);
const win = (R, x, z, rad, pick) => { const v = []; for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) { const s = R(x + dx, z + dz); if (s !== null) v.push(s); } return v.length ? pick(v) : null; };
console.log(`lidar: ${DTMm.tiles.length} DTM + ${DSMm.tiles.length} DSM tiles`);

// ---- terrain grid: 7 x 7 m medians every 20 m
const nx = Math.round((B.x1 - B.x0) / TERRAIN_CELL) + 1, nz = Math.round((B.z1 - B.z0) / TERRAIN_CELL) + 1, terrainDm = new Array(nx * nz);
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const x = Math.min(B.x1 - 1, B.x0 + i * TERRAIN_CELL), z = Math.min(B.z1 - 1, B.z0 + j * TERRAIN_CELL);
  terrainDm[j * nx + i] = Math.round((win(DTM, x, z, 3, v => pct(v, .5)) ?? 0) * 10);
}

// ---- OSM clip
const osm = JSON.parse(gunzipSync(readFileSync(join(DIR, 'osm-clip.json.gz'))));
const ways = new Map(osm.ways.map(w => [w.id, w])), rels = osm.rels;
const xzCache = new Map();
const xz = id => { let p = xzCache.get(id); if (!p) { const c = osm.nodes[id]; if (!c) return null; p = toLocal(c[0], c[1]); xzCache.set(id, p); } return p; };
const tunnelish = t => t.tunnel && t.tunnel !== 'no';
const bridgeish = t => t.bridge && t.bridge !== 'no';
const num = v => { const m = String(v ?? '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
const levelsOf = v => String(v ?? '').split(/[;,]/).map(s => s.trim()).flatMap(s => { const m = s.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/); return m ? [+m[1], +m[2]] : [parseFloat(s)]; }).filter(isFinite);
// rings of a way or a multipolygon (all outers; inner rings attached to the outer that contains them)
function polysOf(el) {
  if (el.type === 'way' || el.refs) return el.refs[0] === el.refs.at(-1) ? [[el.refs]] : [];
  const mem = role => el.members.filter(m => m.type === 'way' && (role === 'inner' ? m.role === 'inner' : m.role !== 'inner')).map(m => ways.get(m.ref)?.refs);
  const outers = joinRings(mem('outer')), inners = joinRings(mem('inner')) || [];
  if (!outers) return [];
  return outers.map(o => [o, ...inners.filter(h => h.length && xz(h[0]) && outers.length === 1)]);
}
const toRings = (idRings, tol) => {
  const rings = idRings.map(r => r.map(xz)).filter(r => r.every(Boolean)).map(r => clipRing(simplify(r, tol), B)).filter(r => r && r.length >= 3);
  return rings.length && Math.abs(polyArea(rings[0])) > 1 ? rings : null;
};
const centroid = r => r.reduce((s, p) => [s[0] + p[0] / r.length, s[1] + p[1] / r.length], [0, 0]);

// ---- Wikidata facts, by item
const wdFacts = new Map();
for (const b of JSON.parse(gunzipSync(readFileSync(join(DIR, 'wikidata-facts.json.gz')))).results.bindings) {
  const q = b.item.value.split('/').pop(), p = b.prop.value.split('/').pop();
  if (!wdFacts.has(q)) wdFacts.set(q, {});
  const f = wdFacts.get(q), v = /^[\d.-]+$/.test(b.val.value) ? +b.val.value : b.val.value.replace(/T00:00:00Z$/, '');
  (f[p] ||= []).push(b.unitLabel ? [v, b.unitLabel.value] : v);
}
const wdNum = (q, p) => { const v = wdFacts.get(q)?.[p]?.[0]; return Array.isArray(v) ? (v[1] === 'foot' ? v[0] * .3048 : v[0]) : (typeof v === 'number' ? v : NaN); };

// ---- buildings and building parts
// Simple 3D Buildings: an outline that contains parts is drawn by its parts; heights from tags, else LiDAR.
const SRC = { lidar: 0, levels: 1, tag: 2, guess: 3, newer: 4 };
const bstat = { lidar: 0, levels: 0, tag: 0, guess: 0, newer: 0, partsOnly: 0, small: 0 };
const outlines = [], parts = [];
for (const el of [...ways.values(), ...rels.map(r => ({ ...r, type: 'relation' }))]) {
  const t = el.tags; if (!t) continue;
  const isPart = !!t['building:part'] && t['building:part'] !== 'no', isB = !!t.building && t.building !== 'no' && !isPart;
  if (!isPart && !isB) continue;
  for (const idRings of polysOf(el)) {
    const c0 = xz(idRings[0][0]); if (!c0) continue;
    const focus = inFocus(c0[0], c0[1]);
    const rings = toRings(idRings, focus ? .2 : .6); if (!rings) continue;
    const area = Math.abs(polyArea(rings[0])), c = centroid(rings[0]);
    if (!inside(c[0], c[1], 1)) continue;
    if (!focus && isB && area < 12) { bstat.small++; continue; }
    (isPart ? parts : outlines).push({ el, t, rings, area, c, focus });
  }
}
// which outlines have parts: grid lookup on outline bounding boxes
const cellKey = (x, z) => `${Math.floor(x / 100)},${Math.floor(z / 100)}`;
const grid = new Map();
outlines.forEach((o, i) => { const xs = o.rings[0].map(p => p[0]), zs = o.rings[0].map(p => p[1]); o.bb = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  for (let gx = Math.floor(o.bb[0] / 100); gx <= Math.floor(o.bb[1] / 100); gx++) for (let gz = Math.floor(o.bb[2] / 100); gz <= Math.floor(o.bb[3] / 100); gz++) { const k = `${gx},${gz}`; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); } });
const pointInRing = (p, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
for (const p of parts) for (const i of grid.get(cellKey(p.c[0], p.c[1])) || []) { const o = outlines[i]; if (pointInRing(p.c, o.rings[0])) { o.hasParts = true; p.parent = o; } }

function heightOf(o) {
  if (o.hc) return o.hc;
  const t = o.t, cells = cellsIn(o.rings, o.area > 4000 ? 2 : 1);
  const ground = cells.length ? pct(cells.map(([x, z]) => DTM(x, z)).filter(v => v !== null), .5) : DTM(o.c[0], o.c[1]);
  const diffs = cells.map(([x, z]) => { const a = DSM(x, z), b = DTM(x, z); return a === null || b === null ? null : a - b; }).filter(v => v !== null);
  const lidarH = diffs.length >= 6 ? pct(diffs, .9) : null;
  const levels = num(t['building:levels']), tagH = num(t.height), wdH = t.wikidata ? wdNum(t.wikidata, 'P2048') : NaN;
  let h, s;
  if (isFinite(tagH)) { h = tagH; s = 'tag'; }
  else if (lidarH !== null && lidarH >= 2 && !(isFinite(levels) && lidarH < levels * 3 * .5)) { h = lidarH; s = 'lidar'; }
  else if (isFinite(wdH) && !o.parent) { h = wdH; s = 'tag'; }
  else if (isFinite(levels)) { h = levels * 3 + 1; s = lidarH !== null && lidarH >= 2 ? 'newer' : 'levels'; }
  else if (lidarH !== null && lidarH >= 2) { h = lidarH; s = 'lidar'; }
  else { h = /^(construction|roof|ruins)$/.test(t.building || '') ? 0 : 6; s = 'guess'; }
  return (o.hc = { ground, h, s, lidarH });
}
const buildings = [], basements = [];
for (const o of [...outlines, ...parts]) {
  if (o.hasParts) { bstat.partsOnly++; }
  const t = o.t, { ground, h, s } = heightOf(o);
  const minH = o.parent ? (isFinite(num(t.min_height)) ? num(t.min_height) : isFinite(num(t['building:min_level'])) ? num(t['building:min_level']) * 3 : 0) : 0;
  const base = o.parent ? heightOf(o.parent).ground : ground;
  // basements: OSM building:levels:underground, else Wikidata floors below ground (P1139)
  const ugL = num(t['building:levels:underground']), wdUg = t.wikidata ? wdNum(t.wikidata, 'P1139') : NaN;
  const nUg = isFinite(ugL) && ugL > 0 ? ugL : isFinite(wdUg) && wdUg > 0 ? wdUg : 0;
  if (!o.parent && nUg) basements.push({ ...poly(o.rings), b: r1(ground), n: nUg, src: isFinite(ugL) && ugL > 0 ? 'osm' : 'wikidata', ...(t.name ? { name: t.name } : {}), ...(t.wikidata ? { wd: t.wikidata } : {}) });
  if (o.hasParts || h <= minH) continue;   // drawn by its parts
  const m = poly(o.rings); if (!m) continue;
  bstat[s]++;
  buildings.push({ ...m, b: r1(base), h: r1(h), ...(minH ? { mh: r1(minH) } : {}), s: SRC[s], ...(o.focus && t.name ? { n: t.name } : {}), ...(o.focus && t.wikidata ? { wd: t.wikidata } : {}) });
}
console.log(`buildings ${buildings.length} (outlines ${outlines.length}, parts ${parts.length}) ${JSON.stringify(bstat)}, basements ${basements.length}`);

// ---- water and greens
const water = [], greens = [];
const memberOfWaterRel = new Set(rels.filter(r => r.tags.natural === 'water' || r.tags.waterway).flatMap(r => r.members.map(m => m.ref)));
for (const el of [...ways.values(), ...rels.map(r => ({ ...r, type: 'relation' }))]) {
  const t = el.tags; if (!t) continue;
  const isW = t.natural === 'water' || t.waterway === 'riverbank' || t.waterway === 'dock' || t.landuse === 'basin' || t.landuse === 'reservoir';
  const isG = /^(park|garden|common|recreation_ground|nature_reserve)$/.test(t.leisure || '') || /^(grass|recreation_ground|forest)$/.test(t.landuse || '');
  if (!isW && !isG) continue;
  if (el.refs && isW && memberOfWaterRel.has(el.id) && !t.name) continue;
  for (const idRings of polysOf(el)) {
    const rings = toRings(idRings, isW ? .8 : 1.5); if (!rings || Math.abs(polyArea(rings[0])) < (isW ? 40 : 300)) continue;
    const m = poly(rings); if (!m) continue;
    if (isG) { greens.push(m); continue; }
    const cells = cellsIn(rings, 4).filter((_, i) => i % 3 === 0).map(([x, z]) => DTM(x, z)).filter(v => v !== null);
    if (!cells.length) continue;
    water.push({ ...m, level: r1(pct(cells, .25)), ...(t.name ? { n: t.name } : {}), ...(t.tidal === 'yes' || t.water === 'river' ? { tidal: 1 } : {}) });
  }
}

// ---- lines: railways and roads, open and in tunnel
const RAIL = /^(rail|subway|light_rail)$/;
const ROADS = { motorway: 1, trunk: 1, primary: 1, secondary: 1, motorway_link: 2, trunk_link: 2, primary_link: 2, secondary_link: 2, tertiary: 2, tertiary_link: 3, unclassified: 3, residential: 3 };
const isRailW = w => RAIL.test(w.tags.railway || '');
const isRoadW = w => !!ROADS[w.tags.highway];
const isFootTunnel = w => /^(footway|path|pedestrian|cycleway|steps|corridor)$/.test(w.tags.highway || '') && tunnelish(w.tags) && (/[Tt]unnel/.test(w.tags.name || w.tags['tunnel:name'] || '') || +w.tags.layer <= -2);
const openLevel = (w, x, z) => bridgeish(w.tags) ? win(DSM, x, z, 1, min) : win(DTM, x, z, 1, min);
function densify(ids, step) {
  const out = []; let s = 0;
  ids.forEach((id, i) => {
    const p = xz(id); if (!p) return;
    if (out.length) { const q = out.at(-1), L = Math.hypot(p[0] - q[0], p[1] - q[1]), k = Math.ceil(L / step); for (let j = 1; j < k; j++) out.push([q[0] + j / k * (p[0] - q[0]), q[1] + j / k * (p[1] - q[1]), q[2] + j / k * L]); s = q[2] + L; }
    out.push([p[0], p[1], s]);
  });
  return out;
}
// open cut / shaft test: LiDAR ground > 6 m below the ground 25-35 m around (see corridor README)
function openCut(x, z) {
  const bed = win(DTM, x, z, 1, min), ring = [];
  for (let k = 0; k < 24; k++) { const a = k / 24 * 2 * Math.PI, rr = k % 2 ? 25 : 35, v = DTM(x + rr * Math.cos(a), z + rr * Math.sin(a)); if (v !== null) ring.push(v); }
  return bed !== null && ring.length > 12 && pct(ring, .4) - bed > 6 ? r1(bed) : null;
}
const lines = [];   // {k: rail|subway|light_rail|road|foot, name, tunnel, bridge, pts}
function addOpen(w, kind, step) {
  const pts = densify(w.refs, step).filter(([x, z]) => inside(x, z) && DTM(x, z) !== null).map(([x, z]) => [x, z, openLevel(w, x, z) ?? DTM(x, z)]);
  // open line: q = enc([x, z, y, ...], 3)
  if (pts.length >= 2) lines.push({ k: kind, ...(w.tags.name && kind !== 'road' ? { name: w.tags.name } : {}), ...(bridgeish(w.tags) ? { bridge: 1 } : {}), ...(kind === 'road' ? { c: ROADS[w.tags.highway] } : {}), q: enc(pts.flat(), 3) });
}
function addTunnels(tunnelWays, openWays, kind) {
  const portals = new Map(), tunnelNodes = new Set(tunnelWays.flatMap(w => w.refs));
  for (const w of openWays) for (const id of w.refs) if (tunnelNodes.has(id)) { const p = xz(id); if (!p || !inside(p[0], p[1])) continue; const lv = openLevel(w, p[0], p[1]); if (lv !== null) portals.set(id, r1(lv)); }
  const adj = new Map();
  for (const w of tunnelWays) for (let i = 1; i < w.refs.length; i++) { const a = w.refs[i - 1], b = w.refs[i]; for (const [p, q] of [[a, b], [b, a]]) { if (!adj.has(p)) adj.set(p, []); adj.get(p).push([q, w]); } }
  const isEnd = id => portals.has(id) || adj.get(id).length !== 2;
  const used = new Set(), key = (a, b) => a < b ? `${a}_${b}` : `${b}_${a}`;
  for (const start of adj.keys()) if (isEnd(start)) for (const [first, w0] of adj.get(start)) {
    if (used.has(key(start, first))) continue;
    const ids = [start], wl = [w0]; let prev = start, cur = first; used.add(key(prev, cur));
    while (true) { ids.push(cur); if (isEnd(cur)) break; const n = adj.get(cur).find(([q]) => q !== prev && !used.has(key(cur, q))); if (!n) break; used.add(key(cur, n[0])); if (!wl.includes(n[1])) wl.push(n[1]); prev = cur; cur = n[0]; }
    const all = densify(ids, 10), len = all.at(-1)?.[2] ?? 0;
    const pts = all.filter(([x, z]) => inside(x, z) && DTM(x, z) !== null).map(([x, z, s]) => [r1(x), r1(z), r1(DTM(x, z)), r1(s), kind === 'foot' ? null : openCut(x, z)]);
    if (pts.length < 2) continue;
    for (let i = 0; i < pts.length; i++) if (pts[i][4] != null) { let j = i; while (j + 1 < pts.length && pts[j + 1][4] != null && pts[j + 1][3] - pts[j][3] < 30) j++; const lo = Math.min(...pts.slice(i, j + 1).map(p => p[4])); for (let k = i; k <= j; k++) pts[k][4] = lo; i = j; }
    const names = [...new Set(wl.map(w => w.tags.name || w.tags['tunnel:name']).filter(Boolean))];
    const lvls = wl.flatMap(w => levelsOf(w.tags.level)), layer = Math.min(...wl.map(w => +w.tags.layer || 0));
    lines.push({ k: kind === 'rail' ? wl[0].tags.railway : kind, name: names.join(' / '), tunnel: 1, layer, ...(lvls.length ? { level: Math.min(...lvls) } : {}), len: r1(len), ends: [portals.get(ids[0]) ?? null, portals.get(ids.at(-1)) ?? null], pts });
  }
  return portals.size;
}
const allW = [...ways.values()].filter(w => w.tags && Object.keys(w.tags).length);
const railW = allW.filter(isRailW), roadW = allW.filter(isRoadW);
for (const w of railW) if (!tunnelish(w.tags)) addOpen(w, w.tags.railway, 10);
for (const w of roadW) if (!tunnelish(w.tags)) addOpen(w, 'road', 25);
const railPortals = addTunnels(railW.filter(w => tunnelish(w.tags)), railW.filter(w => !tunnelish(w.tags)), 'rail');
const roadPortals = addTunnels(roadW.filter(w => tunnelish(w.tags)), roadW.filter(w => !tunnelish(w.tags)), 'road');
const footW = allW.filter(isFootTunnel);
addTunnels(footW, allW.filter(w => w.tags.highway && !tunnelish(w.tags)), 'foot');
console.log(`lines ${lines.length}: open ${lines.filter(l => !l.tunnel).length}, tunnel chains ${lines.filter(l => l.tunnel).length} (rail portals ${railPortals}, road portals ${roadPortals}, foot tunnel ways ${footW.length})`);

// ---- the underground and indoor detail (whole box, but almost all of it is at Canary Wharf and the City)
// indoor or level-tagged ways and areas, drawn at ground + level x storey height in the page
const indoor = [];
for (const w of allW) {
  const t = w.tags; if (isRailW(w) || t.building || t['building:part']) continue;
  const lv = levelsOf(t.level); if (!lv.length) continue;
  if (!(t.indoor || t.highway || t.railway === 'platform' || t.public_transport === 'platform' || t.shop || t.amenity || t.room)) continue;
  const p0 = xz(w.refs[0]); if (!p0 || !inside(p0[0], p0[1])) continue;
  const closed = w.refs[0] === w.refs.at(-1) && w.refs.length > 3 && !t.highway;
  const pts = w.refs.map(xz).filter(Boolean);
  const g = DTM(p0[0], p0[1]);
  const kind = t.railway === 'platform' || t.public_transport === 'platform' ? 'platform' : t.highway === 'steps' ? 'steps' : t.highway === 'elevator' ? 'lift' : t.indoor === 'room' || t.shop ? 'room' : t.highway ? 'corridor' : 'area';
  if (closed) { const m = poly([pts]); if (m) indoor.push({ kind, lv, g: r1(g), ...m, ...(t.name ? { name: t.name } : {}) }); }
  else indoor.push({ kind, lv, g: r1(g), line: enc(pts.flat()), ...(t.name ? { name: t.name } : {}) });
}
// points: stations, entrances, shops and halls with a level
const pois = [];
for (const p of osm.pois) {
  const [x, z] = toLocal(p.lon, p.lat); if (!inside(x, z)) continue;
  const t = p.tags, lv = levelsOf(t.level);
  const kind = /^(station|halt)$/.test(t.railway || '') || t.public_transport === 'station' ? 'station' : /entrance/.test(t.railway || '') || t.entrance ? 'entrance' : t.place ? 'place' : t.man_made ? 'shaft' : t.amenity === 'ferry_terminal' ? 'pier' : 'poi';
  if (kind === 'poi' && !lv.length) continue;
  pois.push({ kind, name: t.name || '', x: r1(x), z: r1(z), g: r1(DTM(x, z) ?? 0), ...(lv.length ? { lv } : {}), ...(t.wikidata ? { wd: t.wikidata } : {}), ...(t.station || t.subway || t.light_rail ? { mode: t.station || (t.light_rail ? 'light_rail' : 'subway') } : {}), ...(kind === 'poi' ? { what: t.shop ? 'shop' : t.amenity || t.indoor || 'other' } : {}), osm: `node/${p.id}` });
}

// ---- places from Wikidata: transport, water, landform, tall buildings, bridges, tunnels, docks
const KEEP = /station|tunnel|tunnel portal|ventilation shaft|railway junction|dock|body of water|lock|bridge|skyscraper|office building|tower|high-rise|shopping (center|centre|mall)|pier|museum|cable car|aerial tramway|river|basin|marina|stadium|arena|park|island|peninsula|area of London|district|neighbo(u)?rhood/i;
const items = new Map();
for (const b of JSON.parse(gunzipSync(readFileSync(join(DIR, 'wikidata-items.json.gz')))).results.bindings) {
  const q = b.item.value.split('/').pop();
  if (!items.has(q)) items.set(q, { q, label: b.itemLabel?.value, desc: b.itemDescription?.value || '', coord: b.coord.value, cls: new Set(), wp: b.article?.value || null });
  if (b.classLabel) items.get(q).cls.add(b.classLabel.value);
}
const P = { P2048: 'height', P1101: 'floors above ground', P1139: 'floors below ground', P2044: 'elevation', P2043: 'length', P4511: 'vertical depth', P2610: 'thickness', P571: 'inception', P1619: 'opened', P2046: 'area' };
const places = [];
for (const it of items.values()) {
  const cls = [...it.cls]; if (!cls.some(c => KEEP.test(c)) || /^Q\d+$/.test(it.label) || /memorial|war memorial|grave|cemetery/i.test(cls.join(' '))) continue;
  const [lon, lat] = it.coord.match(/-?[\d.]+(e-?\d+)?/gi).map(Number), [x, z] = toLocal(lon, lat); if (!inside(x, z)) continue;
  const f = wdFacts.get(it.q), facts = {};
  if (f) for (const [p, vs] of Object.entries(f)) if (P[p]) facts[P[p]] = [...new Set(vs.map(v => Array.isArray(v) ? `${v[0]} ${v[1]}` : String(v)))];
  places.push({ name: it.label, desc: it.desc, cls: cls.slice(0, 4), x: r1(x), z: r1(z), g: r1(DTM(x, z) ?? 0), wd: it.q, ...(it.wp ? { wp: it.wp } : {}), ...(Object.keys(facts).length ? { facts } : {}) });
}

// ---- write
mkdirSync(OUTDIR, { recursive: true });
const meta = {
  built: new Date().toISOString().slice(0, 10),
  origin: { crs: 'EPSG:27700', E0, N0, note: 'x = E - E0, z = -(N - N0) (north is -z), y = metres above ODN' },
  extent: B, focus: FOCUS,
  sources: [
    { id: 'osm', text: '© OpenStreetMap contributors, ODbL 1.0', url: 'https://www.openstreetmap.org/copyright' },
    { id: 'lidar', text: 'Environment Agency LiDAR Composite DTM and First Return DSM, 1 m. © Environment Agency copyright and/or database right. Open Government Licence v3.0', url: 'https://environment.data.gov.uk/dataset/13787b9a-26a4-4775-8523-806d13af58fc' },
    { id: 'wikidata', text: 'Wikidata, CC0', url: 'https://www.wikidata.org/' },
    { id: 'ostn15', text: 'OSTN15 transformation, © Ordnance Survey (free to use)', url: 'https://www.ordnancesurvey.co.uk/business-government/tools-support/os-net/for-developers' },
  ],
  buildingHeightSources: Object.keys(SRC), buildingStats: bstat,
};
const write = (file, name, obj) => {
  const js = `// Generated by magpie/cwplans/tools/build-docklands.mjs on ${meta.built}. Do not edit by hand.\n// Sources and licences: meta.sources and magpie/cwplans/docklands/README.md.\nglobalThis.${name} = ${JSON.stringify(obj)};\n`;
  writeFileSync(join(OUTDIR, file), js); console.log(`wrote docklands/data/${file}: ${(js.length / 1e6).toFixed(2)} MB`);
};
write('area.js', 'DOCKLANDS_AREA', { meta, terrain: { cell: TERRAIN_CELL, nx, nz, x0: B.x0, z0: B.z0, dm: terrainDm }, water, greens, buildings, lines, places });
write('under.js', 'DOCKLANDS_UNDER', { meta: { built: meta.built }, basements, indoor, pois });
console.log(`water ${water.length}, greens ${greens.length}, places ${places.length}, indoor ${indoor.length}, pois ${pois.length}`);
