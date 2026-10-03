#!/usr/bin/env node
// Canary Wharf building registry: internal building ids, cross-references, occupants and owners.
//   node magpie/cwplans/tools/registry-osm.mjs        # OSM features with tags in the Canary Wharf box
//   node magpie/cwplans/tools/registry-wikidata.mjs   # Wikidata via QLever (geo)
//   node magpie/cwplans/tools/registry-fhrs.mjs       # FSA Tower Hamlets file, dated snapshot
//   node magpie/cwplans/tools/build-registry.mjs      # -> magpie/cwplans/registry/buildings.json, ids.json
// Ids: "cwb-NNNN", minted once and kept in registry/ids.json (keyed by OSM element); a rebuild reuses them.
// Only organisations appear as occupants or owners. Method and limits: magpie/cwplans/registry/README.md.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { gunzipSync } from 'zlib';
import { join } from 'path';
import { TOOLS, RAW, bngProjector, polyArea, pointIn, joinRings } from './lib.mjs';
import { ORIGIN } from './fetch-docklands.mjs';
import { CW_BOX } from './registry-osm.mjs';

const OUT = join(TOOLS, '..', 'registry'), R = join(RAW, 'registry');
mkdirSync(OUT, { recursive: true });
const toBNG = await bngProjector();
const local = (lon, lat) => { const [e, n] = toBNG(lon, lat); return [e - ORIGIN.E0, -(n - ORIGIN.N0)]; };
const r1 = v => Math.round(v * 10) / 10;

// ---- inputs
const osm = JSON.parse(gunzipSync(readFileSync(join(R, 'osm-cw.json.gz'))));
const wd = JSON.parse(readFileSync(join(R, 'wikidata-cw.json'), 'utf8'));
const fhrsFile = readdirSync(join(R, 'fhrs')).filter(f => /^FHRS530-.*\.json\.gz$/.test(f)).sort().at(-1);
const fhrs = JSON.parse(gunzipSync(readFileSync(join(R, 'fhrs', fhrsFile))));
const pcs = new Map(JSON.parse(readFileSync(join(TOOLS, '..', 'postcodes', 'postcodes.json'), 'utf8')).postcodes.map(p => [p.pc, p]));
const normPc = pc => String(pc || '').toUpperCase().replace(/\s+/g, '').replace(/^(.+)(\d[A-Z]{2})$/, '$1 $2');

// ---- buildings (outlines) and parts, as rings of [lon, lat]
const wayById = new Map(osm.features.filter(f => f.type === 'way').map(f => [f.id, f]));
const ringOf = refs => refs.map(r => osm.nodes[r]).filter(Boolean);
function rings(f) {
  if (f.type === 'way') return f.refs[0] === f.refs.at(-1) ? [ringOf(f.refs)] : null;
  const outer = joinRings(f.members.filter(m => m.type === 'way' && m.role !== 'inner').map(m => wayById.get(m.ref)?.refs));
  return outer ? outer.map(ringOf) : null;
}
const [W, S, E, N] = CW_BOX, inBox = (lon, lat) => lon >= W && lon <= E && lat >= S && lat <= N;
const mean = ring => ring.reduce((s, p) => [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length], [0, 0]);
const all = [];
for (const f of osm.features) {
  if (f.type === 'node' || !(f.tags.building || f.tags['building:part'])) continue;
  const rs = rings(f); if (!rs || !rs[0] || rs[0].length < 4) continue;
  const c = mean(rs[0]);
  all.push({ f, rs, c, part: !!f.tags['building:part'] && !f.tags.building });
}
const outlines = all.filter(b => !b.part && inBox(b.c[0], b.c[1]));
const inside = (b, lon, lat) => b.rs.some(r => pointIn([lon, lat], r));
// metres from a point to a building outline (for points just outside, e.g. entrances on the wall)
const mPerDeg = [111320 * Math.cos(51.5 * Math.PI / 180), 110540];
function distTo(b, lon, lat) {
  let d = Infinity;
  for (const r of b.rs) for (let i = 1; i < r.length; i++) {
    const ax = (r[i - 1][0] - lon) * mPerDeg[0], ay = (r[i - 1][1] - lat) * mPerDeg[1], bx = (r[i][0] - lon) * mPerDeg[0], by = (r[i][1] - lat) * mPerDeg[1];
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    d = Math.min(d, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return d;
}
function buildingAt(lon, lat, tol = 12) {
  let hit = outlines.find(b => inside(b, lon, lat)); if (hit) return { b: hit, how: 'inside' };
  let best = null; for (const b of outlines) { const d = distTo(b, lon, lat); if (d < tol && (!best || d < best.d)) best = { b, d }; }
  return best ? { b: best.b, how: `within ${Math.round(best.d)} m` } : null;
}

// ---- ids: reuse, else mint in reading order (north to south in 100 m bands, then west to east)
const idsFile = join(OUT, 'ids.json'), ids = existsSync(idsFile) ? JSON.parse(readFileSync(idsFile, 'utf8')) : { note: 'Canary Wharf building ids. Keys are OSM elements; never reuse a retired id.', next: 1, map: {} };
const key = b => `${b.f.type}/${b.f.id}`;
for (const b of outlines) b.xz = local(b.c[0], b.c[1]);
let minted = 0;
for (const b of [...outlines].sort((a, z) => Math.floor(a.xz[1] / 100) - Math.floor(z.xz[1] / 100) || a.xz[0] - z.xz[0])) {
  if (!ids.map[key(b)]) { ids.map[key(b)] = 'cwb-' + String(ids.next++).padStart(4, '0'); minted++; }
  b.id = ids.map[key(b)];
}

// ---- records
const rec = new Map(outlines.map(b => {
  const t = b.f.tags, lr = b.rs[0].map(([lon, lat]) => local(lon, lat));
  return [b.id, {
    id: b.id, name: t.name || null, osm_name: t.name || null, osm: [key(b)], wikidata: t.wikidata || null, wikipedia: t.wikipedia || null,
    address: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ') || null, postcodes: new Set(t['addr:postcode'] ? [normPc(t['addr:postcode'])] : []),
    building: t.building, levels: t['building:levels'] ? +t['building:levels'] : null, levels_underground: t['building:levels:underground'] ? +t['building:levels:underground'] : null, height: t.height ? parseFloat(t.height) : null,
    lat: +b.c[1].toFixed(6), lon: +b.c[0].toFixed(6), x: r1(b.xz[0]), z: r1(b.xz[1]), area_m2: Math.round(Math.abs(polyArea(lr))),
    parts: [], occupants: [], features: [], owners: [], facts: {},
  }];
}));
for (const p of all.filter(b => b.part)) { const h = buildingAt(p.c[0], p.c[1], 0); if (h) rec.get(h.b.id).parts.push({ osm: key(p), name: p.f.tags.name || null, height: p.f.tags.height ? parseFloat(p.f.tags.height) : null, min_height: p.f.tags.min_height ? parseFloat(p.f.tags.min_height) : null, levels: p.f.tags['building:levels'] ? +p.f.tags['building:levels'] : null }); }

// ---- occupants from OSM: tagged nodes and non-building ways (shops in malls are often areas)
const ROLE = t => t.shop ? 'shop' : /^(restaurant|cafe|bar|pub|fast_food|food_court|ice_cream|biergarten)$/.test(t.amenity || '') ? 'food and drink' : t.office ? 'office' : t.amenity ? 'service: ' + t.amenity : t.leisure ? 'leisure: ' + t.leisure : t.tourism ? 'tourism: ' + t.tourism : t.healthcare ? 'healthcare' : t.craft ? 'craft' : /station|subway_entrance|train_station_entrance/.test(t.railway || t.public_transport || '') ? 'transport' : null;
let osmPlaced = 0, osmLoose = 0;
for (const f of osm.features) {
  const t = f.tags; if (t.building || t['building:part'] || !t.name) continue;
  const role = ROLE(t); if (!role) continue;
  const c = f.type === 'node' ? [f.lon, f.lat] : (() => { const rs = rings(f); return rs && rs[0] ? mean(rs[0]) : null; })(); if (!c || !inBox(c[0], c[1])) continue;
  const h = buildingAt(c[0], c[1]); if (!h) { osmLoose++; continue; }
  osmPlaced++;
  const r = rec.get(h.b.id);
  // public art, information boards and the like are features of the building, not occupants
  if (/^tourism: (artwork|information|viewpoint|attraction)$/.test(role)) { r.features.push({ name: t.name, kind: role.replace('tourism: ', ''), osm: `${f.type}/${f.id}` }); continue; }
  r.occupants.push({ name: t.name, role, source: 'osm', osm: `${f.type}/${f.id}`, placed: h.how, ...(t.level ? { level: t.level } : {}), ...(t.brand ? { brand: t.brand } : {}), ...(t['brand:wikidata'] ? { brand_wikidata: t['brand:wikidata'] } : {}), ...(t.website ? { website: t.website } : {}), ...(t.opening_date ? { opening_date: t.opening_date } : {}) });
  if (t['addr:postcode']) r.postcodes.add(normPc(t['addr:postcode']));
}

// ---- occupants from the FSA file: positioned premises by location; the rest listed under their postcode
const byPostcode = {};
let fsaPlaced = 0;
for (const e of fhrs.establishments) {
  const o = { name: e.name, role: 'food business (FSA)', source: 'fsa', fhrs_id: e.id, type: e.type, rating: e.rating, rating_date: e.rating_date, address: e.address, postcode: normPc(e.postcode), url: `https://ratings.food.gov.uk/business/${e.id}` };
  const h = e.lat != null && inBox(e.lon, e.lat) ? buildingAt(e.lon, e.lat) : null;
  if (h) { const r = rec.get(h.b.id); r.occupants.push({ ...o, placed: h.how }); r.postcodes.add(o.postcode); fsaPlaced++; }
  else if (pcs.get(o.postcode) && /^cw-/.test(pcs.get(o.postcode).tier)) (byPostcode[o.postcode] ||= []).push({ ...o, placed: e.lat == null ? 'no position in the FSA data' : 'position outside every building' });
}

// ---- Wikidata: the building's own item, items located in it, headquarters, occupants, owners
const items = new Map(wd.items.map(i => [i.id, i]));
const wkt = s => s.match(/-?[\d.]+/g).map(Number);
const BUILDINGISH = /building|skyscraper|tower|shopping|station|hotel|structure|block|plaza|mall|museum|hall|centre|center/i;
for (const it of wd.items) {
  const [lon, lat] = wkt(it.coord); if (!inBox(lon, lat)) continue;
  const h = buildingAt(lon, lat, 5); if (!h) continue;
  const r = rec.get(h.b.id), cls = (it.props['instance of'] || []).map(c => c.label).join(', ');
  if (!r.wikidata && BUILDINGISH.test(cls) && !wd.items.some(o => o !== it && o.id !== it.id && BUILDINGISH.test((o.props['instance of'] || []).map(c => c.label).join(' ')) && (() => { const [a, b] = wkt(o.coord); return inside(h.b, a, b); })())) r.wikidata = it.id;
  else if (r.wikidata !== it.id && !BUILDINGISH.test(cls)) r.occupants.push({ name: it.label, role: 'located here (Wikidata)', source: 'wikidata', wikidata: it.id, type: cls, placed: h.how });
}
const recByQ = new Map([...rec.values()].filter(r => r.wikidata).map(r => [r.wikidata, r]));
for (const r of recByQ.values()) {
  const it = items.get(r.wikidata); if (!it) continue;
  // OSM often names a tower after its main occupant ("HSBC UK" for 8 Canada Square): the Wikidata label names the building
  r.name = it.label || r.name; r.description = it.description || null;
  for (const [k, vs] of Object.entries(it.props)) if (!['instance of'].includes(k)) r.facts[k] = vs.map(v => typeof v === 'object' ? v.label || v.id : v);
  r.facts.classes = (it.props['instance of'] || []).map(c => c.label);
  for (const o of it.props['owned by'] || []) r.owners.push({ name: o.label, wikidata: o.id, source: 'wikidata P127' });
  for (const o of it.props['occupant'] || []) r.occupants.push({ name: o.label, role: 'occupant (Wikidata P466)', source: 'wikidata', wikidata: o.id });
  for (const pc of it.props['postal code'] || []) r.postcodes.add(normPc(pc));
}
for (const h of wd.hq) { const r = recByQ.get(h.place); if (r) r.occupants.push({ name: h.label, role: 'headquarters (Wikidata P159)', source: 'wikidata', wikidata: h.org, ...(h.website ? { website: h.website } : {}) }); }

// ---- joins with the company and property sources (registry/sources/, see SOURCES-companies-property.md)
// Privacy: company-level and property-level only; figures about homes are given only where there are at least
// K homes, so no figure describes a single home; company addresses are not copied (the Companies House link has them).
const K = 5, SRC = join(OUT, 'sources'), has = f => existsSync(join(SRC, f));
const readJ = f => JSON.parse(readFileSync(join(SRC, f), 'utf8'));
const recs = [...rec.values()], outlineOf = new Map(outlines.map(b => [b.id, b]));
const NUM = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10, TWENTY: 20, 'TWENTY FIVE': 25, THIRTY: 30, FORTY: 40, FIFTY: 50 };
const normAddr = s => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\b(TWENTY FIVE|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|TWENTY|THIRTY|FORTY|FIFTY)\b/g, m => NUM[m]).replace(/\s+/g, ' ').trim();
// keys a building answers to: "1 CANADA SQUARE", "ONE CANADA SQUARE" -> "1 CANADA SQUARE", the OSM and Wikidata names
for (const r of recs) r.keys = [...new Set([r.address, r.name, r.osm_name, ...(r.facts['street address'] || [])].filter(Boolean).map(normAddr).filter(k => k.length > 5))];
const matchBuilding = (pc, text) => { const t = normAddr(text); const c = recs.filter(r => r.postcodes.has(pc) && r.keys.some(k => t.includes(k))); return c.length === 1 ? c[0] : null; };
const joins = {};
if (has('uprn/uprn-canary-wharf.csv')) {
  const toidOf = new Map(), usrnOf = new Map();
  if (has('uprn/uprn-linked-ids-canary-wharf.csv')) for (const line of readFileSync(join(SRC, 'uprn/uprn-linked-ids-canary-wharf.csv'), 'utf8').split('\n').slice(1)) { const [u, link, id] = line.split(','); if (link === 'TopographicArea_TOID') toidOf.set(u, id); else if (link === 'Street_USRN') usrnOf.set(u, id); }
  let placed = 0;
  for (const line of readFileSync(join(SRC, 'uprn/uprn-canary-wharf.csv'), 'utf8').split('\n').slice(1)) {
    const [u, , , lat, lon] = line.split(','); if (!u) continue;
    const h = buildingAt(+lon, +lat, 0); if (!h) continue;
    const r = rec.get(h.b.id); r.uprns = (r.uprns || 0) + 1; placed++;
    if (toidOf.has(u)) (r.toidSet ||= new Set()).add(toidOf.get(u));
    if (usrnOf.has(u)) (r.usrnSet ||= new Set()).add(usrnOf.get(u));
  }
  joins.uprn_in_buildings = placed;
}
if (has('uprn/lbsm2-homes-summary.json')) {
  const l = readJ('uprn/lbsm2-homes-summary.json'); let n = 0;
  for (const r of recs) if (r.toidSet) {
    const parts = [...r.toidSet].map(t => l.per_toid[t]).filter(Boolean); if (!parts.length) continue;
    const homes = parts.reduce((s, p) => s + p.homes, 0);
    const sum = k => parts.reduce((o, p) => { for (const [a, v] of Object.entries(p[k] || {})) o[a] = (o[a] || 0) + v; return o; }, {});
    r.homes = homes >= K ? { count: homes, source: 'GLA London Building Stock Model 2 (modelled where no EPC)', property_type: sum('property_type'), construction_age_band: sum('construction_age_band'), epc_rating: sum('epc_rating') } : { count: `fewer than ${K}`, source: 'GLA LBSM2' };
    n++;
  }
  joins.lbsm_buildings = n;
}
if (has('landregistry/inspire-canary-wharf.geojson')) {
  const g = readJ('landregistry/inspire-canary-wharf.geojson'); let n = 0;
  for (const r of recs) for (const f of g.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    if (polys.some(pl => pointIn([r.lon, r.lat], pl[0]))) { (r.inspire ||= []).push(f.properties.inspire_id); n++; }
  }
  joins.inspire_links = n; joins.inspire_attribution = g.attribution;
}
const companiesOut = {}, homesOut = {};
if (has('companies/companies-by-postcode.json')) {
  const c = readJ('companies/companies-by-postcode.json'); let matched = 0, total = 0;
  for (const [pc, list] of Object.entries(c.postcodes)) for (const co of list) {
    total++;
    const b = matchBuilding(pc, [co.address_line1, co.address_line2].join(' '));
    const slimCo = { number: co.number, name: co.name, status: co.status, category: co.category, incorporated: co.incorporated, sic: (co.sic || []).map(x => String(x).slice(0, 5)), ...(b ? { building: b.id } : {}) };
    (companiesOut[pc] ||= []).push(slimCo);
    if (b) { matched++; (b.companies ||= []).push({ number: co.number, name: co.name, incorporated: co.incorporated, sic: slimCo.sic }); }
  }
  joins.companies = total; joins.companies_matched_to_building = matched;
}
if (has('landregistry/price-paid-by-postcode.json')) {
  const pp = readJ('landregistry/price-paid-by-postcode.json'), byB = new Map();
  const agg = txs => { const homes = new Set(txs.map(t => `${t.paon}|${t.saon}|${t.street}`)), prices = txs.map(t => t.price).sort((a, b) => a - b), years = {}; for (const t of txs) years[t.date.slice(0, 4)] = (years[t.date.slice(0, 4)] || 0) + 1;
    return { homes_sold_since_1995: homes.size, sales: txs.length, first: txs.map(t => t.date).sort()[0], last: txs.map(t => t.date).sort().at(-1), median_price: prices[prices.length >> 1], new_build_sales: txs.filter(t => t.new_build).length, sales_by_year: years }; };
  for (const [pc, txs] of Object.entries(pp.postcodes)) {
    const a = agg(txs); if (a.homes_sold_since_1995 >= K) homesOut[pc] = a; else homesOut[pc] = { homes_sold_since_1995: `fewer than ${K}` };
    for (const t of txs) { const b = matchBuilding(pc, `${t.paon} ${t.street}`) || matchBuilding(pc, t.paon); if (b) { if (!byB.has(b.id)) byB.set(b.id, []); byB.get(b.id).push(t); } }
  }
  for (const [id, txs] of byB) { const a = agg(txs); rec.get(id).sales = a.homes_sold_since_1995 >= K ? { ...a, source: 'HM Land Registry Price Paid (OGL)' } : { homes_sold_since_1995: `fewer than ${K}` }; }
  joins.price_paid_buildings = byB.size;
}
// In a residential building a registered office is often a flat: give the number of companies, not their names.
for (const r of recs) if (r.companies && (r.homes || /^(apartments|residential|house|terrace|detached|semidetached_house)$/.test(r.building))) r.companies = { count: r.companies.length, note: 'residential building: company names are not listed here (see the Companies House link)' };
for (const r of recs) { if (r.toidSet) r.toids = [...r.toidSet].sort(); if (r.usrnSet) r.usrns = [...r.usrnSet].sort(); delete r.toidSet; delete r.usrnSet; delete r.keys; }
if (Object.keys(companiesOut).length) writeFileSync(join(OUT, 'companies-by-postcode.json'), JSON.stringify({ source: 'Companies House Basic Company Data (company-level only; addresses not copied)', postcodes: companiesOut }));
if (Object.keys(homesOut).length) writeFileSync(join(OUT, 'homes-by-postcode.json'), JSON.stringify({ source: `HM Land Registry Price Paid (OGL); totals per postcode, only where at least ${K} homes have sold`, postcodes: homesOut }));
console.log('joins', JSON.stringify(joins));

// ---- links per building and per postcode
const ch = pc => `https://find-and-update.company-information.service.gov.uk/advanced-search/get-results?registeredOfficeAddress=${encodeURIComponent(pc).replace(/%20/g, '+')}`;
const ppd = pc => `https://landregistry.data.gov.uk/app/ppd/search?postcode=${encodeURIComponent(pc).replace(/%20/g, '+')}`;
const out = [...rec.values()].sort((a, b) => a.id.localeCompare(b.id)).map(r => {
  const postcodes = [...r.postcodes].filter(Boolean).sort();
  return {
    ...r, postcodes,
    postcode_info: postcodes.map(pc => { const p = pcs.get(pc); return { pc, status: p ? p.status : 'not in ONSPD E14 list', tier: p?.tier || null, large_user: !!p?.large_user }; }),
    links: {
      osm: r.osm.map(k => `https://www.openstreetmap.org/${k}`),
      ...(r.wikidata ? { wikidata: `https://www.wikidata.org/wiki/${r.wikidata}` } : {}),
      ...(r.wikipedia ? { wikipedia: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.wikipedia.replace(/^en:/, '').replace(/ /g, '_'))}` } : {}),
      companies_house_by_postcode: postcodes.map(ch), land_registry_price_paid_by_postcode: postcodes.map(ppd),
    },
  };
});
const summary = {
  generated: new Date().toISOString().slice(0, 10), box: CW_BOX, buildings: out.length, minted_this_run: minted,
  named: out.filter(r => r.name).length, with_wikidata: out.filter(r => r.wikidata).length, with_occupants: out.filter(r => r.occupants.length).length,
  occupants: out.reduce((n, r) => n + r.occupants.length, 0), osm_placed: osmPlaced, osm_not_in_a_building: osmLoose, fsa_placed: fsaPlaced, fsa_by_postcode_only: Object.values(byPostcode).flat().length,
  with_owner: out.filter(r => r.owners.length).length, joins: Object.fromEntries(Object.entries(joins).filter(([k]) => k !== 'inspire_attribution')), attribution_inspire: joins.inspire_attribution || null,
  sources: { osm: osm.extracted, wikidata_qlever: wd.fetched, fsa: fhrs.fetched },
};
writeFileSync(idsFile, JSON.stringify(ids, null, 1));
writeFileSync(join(OUT, 'buildings.json'), JSON.stringify({ summary, buildings: out, unplaced_by_postcode: byPostcode }));
console.log(JSON.stringify(summary, null, 1));
