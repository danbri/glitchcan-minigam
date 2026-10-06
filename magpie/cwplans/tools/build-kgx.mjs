// Build the first cut of the cwplans knowledge graph in danbri/londat kgx/: one named graph per source (cited Canary
// Wharf facts, registry buildings with outlines, occupants, the typed CWG directory with hours, the canonical web
// layer, sameAs groups, the Living Map mall units when archived), a meta graph describing each one, and three copies of
// the same quads: N-Quads (gzip, per graph and all), a Shardborough store (factoidal pack + activate) and COTTAS files.
// All RDF work with @factoidal/core. No blank nodes: every node has an IRI.
//   node magpie/cwplans/tools/build-kgx.mjs [--no-store]
//   out: $LONDAT_DIR/kgx/   (nq/, shardborough/, cottas/, queries/, manifest.json)
// Skill: cwplans-kgx.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync } from 'fs';
import { gzipSync, gunzipSync } from 'zlib';
import { createHash } from 'crypto';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { parse, serialize, toCottas, openCottas, queryCottas, closeCottas, Dataset, dataFactory as F } from '@factoidal/core';
import { TOOLS } from './lib.mjs';
import { LONDAT_DIR } from './londat.mjs';

const CW = join(TOOLS, '..'), ROOT = join(CW, '..', '..'), OUT = join(LONDAT_DIR, 'kgx');
const KG = 'https://danbri.github.io/londat/kgx/', ID = KG + 'id/', V = KG + 'vocab#', GR = KG + 'graph/';
const NS = { s: 'https://schema.org/', rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#', owl: 'http://www.w3.org/2002/07/owl#', geo: 'http://www.opengis.net/ont/geosparql#',
  dct: 'http://purl.org/dc/terms/', prov: 'http://www.w3.org/ns/prov#', void: 'http://rdfs.org/ns/void#', wd: 'http://www.wikidata.org/entity/', cwk: V };
const J = f => JSON.parse(readFileSync(join(CW, f), 'utf8'));
const OH = createRequire(import.meta.url)(join(CW, 'docklands', 'opening-hours.js'));
const sha = s => createHash('sha1').update(s).digest('hex').slice(0, 12);
const slug = s => String(s || '').normalize('NFKD').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'x';
const iri = (p, l) => F.namedNode(NS[p] + l), N = u => F.namedNode(u);
const lit = (v, dt) => v == null || v === '' ? null : typeof v === 'number' ? F.literal(String(v), iri('xsd', Number.isInteger(v) ? 'integer' : 'decimal')) : dt ? F.literal(String(v), iri('xsd', dt)) : F.literal(String(v));
const TYPE = iri('rdf', 'type'), today = new Date().toISOString().slice(0, 10);

const graphs = new Map();     // name -> { quads, meta }
function graph(name, meta) { const g = { name, iri: N(GR + name), quads: [], meta }; graphs.set(name, g);
  g.add = (s, p, o) => { if (s && p && o != null) g.quads.push(F.quad(typeof s === 'string' ? N(s) : s, p, typeof o === 'string' ? N(o) : o, g.iri)); };
  g.lit = (s, p, v, dt) => { const l = lit(v, dt); if (l) g.add(s, p, l); };
  return g; }

// 1. cited facts about Canary Wharf and the zone (docklands/facts.json)
{ const g = graph('facts', { title: 'Cited facts about Canary Wharf and the Docklands structures', source: ['magpie/cwplans/docklands/facts.json'],
    licence: 'facts with short quotes from cited pages (crawl rule of 2026-10-03, scoping); each fact names its source URL', tool: 'magpie/cwplans/tools/build-kgx.mjs' });
  const f = J('docklands/facts.json');
  for (const x of f.facts) {
    const id = ID + 'fact/' + sha(JSON.stringify([x.subject, x.property, x.value, x.source_url])), subj = x.wikidata ? NS.wd + x.wikidata : ID + 'thing/' + slug(x.subject);
    g.add(id, TYPE, iri('cwk', 'CitedFact')); g.add(id, iri('cwk', 'about'), subj); g.lit(subj, iri('rdfs', 'label'), x.subject);
    g.lit(id, iri('s', 'propertyID'), x.property); g.lit(id, iri('s', 'value'), x.value); g.lit(id, iri('s', 'unitText'), x.unit);
    g.lit(id, iri('cwk', 'referenceLevel'), x.reference_level); if (x.source_url) g.add(id, iri('s', 'citation'), x.source_url);
    g.lit(id, iri('cwk', 'quote'), x.quote); g.lit(id, iri('dct', 'date'), x.retrieved, 'date'); g.lit(id, iri('rdfs', 'comment'), x.note);
  } }

// 2. registry buildings with outlines (registry/buildings.json, atlas/data/atlas.json)
const B = J('registry/buildings.json').buildings, atlasG = new Map(J('atlas/data/atlas.json').buildings.map(b => [b.id, b.g]));
const bIri = id => ID + 'building/' + id;
{ const g = graph('buildings', { title: 'Registry buildings of the Canary Wharf box (cwb- ids): names, positions, outlines, levels, height, postcodes, identifiers',
    source: ['magpie/cwplans/registry/buildings.json', 'magpie/cwplans/atlas/data/atlas.json'], licence: 'derived from OpenStreetMap (© OpenStreetMap contributors, ODbL 1.0), Wikidata (CC0), OS Open UPRN/USRN/TOID ids (OGL)', osm: true, tool: 'magpie/cwplans/tools/build-kgx.mjs' });
  for (const b of B) {
    const s = bIri(b.id); g.add(s, TYPE, iri('s', 'Place')); g.add(s, TYPE, iri('cwk', 'Building')); g.lit(s, iri('s', 'identifier'), b.id);
    g.lit(s, iri('s', 'name'), b.name); if (b.osm_name && b.osm_name !== b.name) g.lit(s, iri('s', 'alternateName'), b.osm_name); g.lit(s, iri('cwk', 'houseName'), b.housename);
    g.lit(s, iri('s', 'latitude'), b.lat); g.lit(s, iri('s', 'longitude'), b.lon); g.lit(s, iri('cwk', 'levels'), b.levels); g.lit(s, iri('cwk', 'levelsUnderground'), b.levels_underground);
    g.lit(s, iri('cwk', 'heightMetres'), b.height); g.lit(s, iri('cwk', 'footprintAreaM2'), b.area_m2); g.lit(s, iri('cwk', 'buildingTag'), b.building);
    if (typeof b.uprns === 'number') g.lit(s, iri('cwk', 'uprnCount'), b.uprns);
    for (const pc of b.postcodes || []) g.lit(s, iri('s', 'postalCode'), pc);
    for (const o of b.osm || []) g.add(s, iri('s', 'sameAs'), 'https://www.openstreetmap.org/' + o);
    if (b.wikidata) g.add(s, iri('owl', 'sameAs'), NS.wd + b.wikidata);
    for (const t of b.toids || []) g.lit(s, iri('cwk', 'toid'), t);
    const rings = atlasG.get(b.id);
    if (rings?.length) { const geom = s + '/geometry';
      const wkt = 'POLYGON(' + rings.map(q => { const pts = []; let la = 0, lo = 0; for (let i = 0; i < q.length; i += 2) { la += q[i]; lo += q[i + 1]; pts.push(`${(lo / 1e6).toFixed(6)} ${(la / 1e6).toFixed(6)}`); } if (pts[0] !== pts.at(-1)) pts.push(pts[0]); return '(' + pts.join(', ') + ')'; }).join(', ') + ')';
      g.add(s, iri('geo', 'hasGeometry'), geom); g.add(geom, TYPE, iri('geo', 'Geometry')); g.add(geom, iri('geo', 'asWKT'), F.literal(wkt, iri('geo', 'wktLiteral'))); }
  } }

// 3. occupants (registry/buildings.json occupants)
const occIri = new Map();
{ const g = graph('occupants', { title: 'Occupants of the registry buildings: shops, food and drink, services, offices, with role, level, opening hours and links',
    source: ['magpie/cwplans/registry/buildings.json'], licence: 'joined from OSM (ODbL), FSA ratings (OGL), Canary Wharf Group directory (crawl rule, scoping), brand and register sources named per occupant in the registry', osm: true, tool: 'magpie/cwplans/tools/build-kgx.mjs' });
  for (const b of B) (b.occupants || []).forEach((o, i) => {
    const s = `${bIri(b.id)}/occupant/${slug(o.name)}-${sha(JSON.stringify([o.name, o.osm, o.source, i]))}`; occIri.set(o, s);
    g.add(s, TYPE, iri('s', /food/.test(o.role || '') ? 'FoodEstablishment' : /^shop/.test(o.role || '') ? 'Store' : 'LocalBusiness'));
    g.lit(s, iri('s', 'name'), o.name); g.lit(s, iri('cwk', 'role'), o.role); g.lit(s, iri('cwk', 'sourceKind'), o.source); g.add(s, iri('s', 'containedInPlace'), bIri(b.id));
    g.lit(s, iri('cwk', 'level'), o.level ?? o.level_cwg); g.lit(s, iri('cwk', 'mall'), o.mall); g.lit(s, iri('s', 'openingHours'), o.opening_hours);
    if (o.web?.opening_hours) g.lit(s, iri('cwk', 'webOpeningHours'), o.web.opening_hours);
    if (o.osm) g.add(s, iri('s', 'sameAs'), 'https://www.openstreetmap.org/' + o.osm);
    if (o.cwg_url) g.add(s, iri('s', 'sameAs'), o.cwg_url.replace(/\/?$/, '/') + '#entity');
    if (/^https?:\/\//.test(o.website || '')) g.add(s, iri('s', 'url'), o.website);
    if (o.brand_wikidata) g.add(s, iri('s', 'brand'), NS.wd + o.brand_wikidata); else g.lit(s, iri('cwk', 'brandName'), o.brand);
    g.lit(s, iri('cwk', 'odsCode'), o.ods_code); g.lit(s, iri('cwk', 'cqcLocationId'), o.cqc_location_id); g.lit(s, iri('s', 'servesCuisine'), o.cuisine);
  }); }

// 4. the typed CWG directory with hours, levels and malls
{ const g = graph('cwg', { title: 'Canary Wharf Group directory: typed occupants, malls, levels, page dates and weekly opening hours',
    source: ['magpie/cwplans/registry/sources/brands/cwg-directory-typed.nq', 'magpie/cwplans/registry/sources/brands/cwg-directory-typed.json', 'magpie/cwplans/registry/sources/brands/cwg-hours.json'],
    licence: 'Canary Wharf Group pages as archived by the Internet Archive; crawl rule of 2026-10-03, scoping only', tool: 'magpie/cwplans/tools/build-kgx.mjs' });
  const ds = await parse(readFileSync(join(CW, 'registry/sources/brands/cwg-directory-typed.nq'), 'utf8'), { format: 'nquads' });
  for (const q of ds.toArray()) g.add(q.subject, q.predicate, q.object);
  const typed = new Map(J('registry/sources/brands/cwg-directory-typed.json').entries.map(e => [e.slug, e]));
  const DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], hm = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  for (const h of J('registry/sources/brands/cwg-hours.json').entries) {
    const t = typed.get(h.slug); if (!t) continue; const s = t.cwg_url.replace(/\/?$/, '/') + '#entity';
    if (h.mall) { const m = ID + 'mall/' + slug(h.mall); g.add(s, iri('s', 'containedInPlace'), m); g.add(m, TYPE, iri('s', /Place$|Square$/.test(h.mall) && ['Cabot Place', 'Canada Place', 'Jubilee Place', 'Crossrail Place', 'Churchill Place'].includes(h.mall) ? 'ShoppingCenter' : 'Place')); g.lit(m, iri('s', 'name'), h.mall); }
    g.lit(s, iri('cwk', 'levelText'), h.level); for (const b of t.registry_buildings || []) g.add(s, iri('cwk', 'registryBuilding'), bIri(b));
    if (!h.opening_hours) { if (h.state === 'coming-soon') g.lit(s, iri('cwk', 'status'), 'coming soon'); continue; }
    g.lit(s, iri('s', 'openingHours'), h.opening_hours); g.lit(s, iri('cwk', 'hoursAsOf'), h.archived_on ? `${h.archived_on.slice(0, 4)}-${h.archived_on.slice(4, 6)}-${h.archived_on.slice(6, 8)}` : null, 'date');
    const P = OH.parse(h.opening_hours); if (!P) continue;
    P.week.forEach((spans, d) => (spans || []).forEach(([o, c], k) => { const n = `${s}-hours-${DAY[d]}-${k}`; g.add(s, iri('s', 'openingHoursSpecification'), n); g.add(n, TYPE, iri('s', 'OpeningHoursSpecification'));
      g.add(n, iri('s', 'dayOfWeek'), iri('s', DAY[d])); g.lit(n, iri('s', 'opens'), hm(o)); g.lit(n, iri('s', 'closes'), hm(c)); g.lit(n, iri('cwk', 'opensMinute'), o); g.lit(n, iri('cwk', 'closesMinute'), c); }));
  } }

// 5. the canonical web layer (schema.org idioms rewritten) and 6. sameAs groups, one graph per key rule
const TP = join(ROOT, 'third_party', 'cwplans-structured-data');
{ const g = graph('web', { title: 'Canonical schema.org layer from the web harvest (branch cards, weekly hours, organisation cards), all pages merged',
    source: ['third_party/cwplans-structured-data/idioms/canonical.nq.gz'], licence: "the publishers' own markup; crawl rule of 2026-10-03, scoping only", tool: 'magpie/cwplans/tools/build-kgx.mjs' });
  const ds = await parse(gunzipSync(readFileSync(join(TP, 'idioms', 'canonical.nq.gz'))).toString(), { format: 'nquads' });
  for (const q of ds.toArray()) { g.add(q.subject, q.predicate, q.object); }
  const pages = new Set(ds.toArray().map(q => q.graph.value)); for (const p of pages) g.add(p, TYPE, iri('s', 'WebPage'));
}
{ const ds = await parse(gunzipSync(readFileSync(join(TP, 'coref', 'sameas.nq.gz'))).toString(), { format: 'nquads' });
  const desc = new Map(JSON.parse(readFileSync(join(TP, 'coref', 'descriptions.json'), 'utf8')).descriptions.map(d => [d.iri, d]));
  const byRule = new Map(); for (const q of ds.toArray()) { const r = q.graph.value.split('/').pop(); (byRule.get(r) || byRule.set(r, []).get(r)).push(q); }
  for (const [rule, qs] of byRule) { const g = graph('coref-' + rule, { title: `Same-thing links by key rule "${rule}" between web descriptions`, source: ['third_party/cwplans-structured-data/coref/sameas.nq.gz'], licence: 'derived from the web harvest (scoping)', tool: 'magpie/cwplans/tools/web-coref.mjs' });
    for (const q of qs) { g.add(q.subject, q.predicate, q.object); for (const t of [q.subject, q.object]) { const d = desc.get(t.value); if (d) { g.lit(t, iri('s', 'name'), d.name); if (/^https?:/.test(d.page)) g.add(t, iri('s', 'subjectOf'), d.page); g.lit(t, iri('cwk', 'descriptionKind'), d.kind); } } } }
}

// 7. Living Map mall units and facilities, from the normalised GeoJSON (third_party/cwg/_TMI/mallmap, made by
// cwg-mallmap-tmi.mjs: whole outlines) or, without it, from the zoom-17 tiles (largest piece per unit)
const MM = join(LONDAT_DIR, 'third_party', 'cwg', 'mallmap'), TMI = join(LONDAT_DIR, 'third_party', 'cwg', '_TMI', 'mallmap');
const wktOf = gm => { const ring = r => '(' + r.map(([lo, la]) => `${lo.toFixed(7)} ${la.toFixed(7)}`).join(', ') + ')';
  return gm.type === 'Point' ? `POINT(${gm.coordinates[0].toFixed(7)} ${gm.coordinates[1].toFixed(7)})`
    : gm.type === 'Polygon' ? 'POLYGON(' + gm.coordinates.map(ring).join(', ') + ')'
    : gm.type === 'MultiPolygon' ? 'MULTIPOLYGON(' + gm.coordinates.map(p => '(' + p.map(ring).join(', ') + ')').join(', ') + ')' : null; };
const centreOf = gm => { const r = gm.type === 'Point' ? [gm.coordinates] : gm.type === 'Polygon' ? gm.coordinates[0] : gm.coordinates[0][0];
  return [r.reduce((a, c) => a + c[0], 0) / r.length, r.reduce((a, c) => a + c[1], 0) / r.length]; };
let mallFeatures = [];
if (existsSync(join(TMI, 'summary.json'))) {
  for (const f of readdirSync(TMI).filter(f => /^indoor-floor-.*\.geojson$/.test(f))) mallFeatures.push(...JSON.parse(readFileSync(join(TMI, f), 'utf8')).features);
} else if (existsSync(join(MM, 'tiles', 'indoor', '17'))) {
  const { VectorTile } = await import('@mapbox/vector-tile'); const Protobuf = (await import('pbf')).default; const best = new Map(), dir = join(MM, 'tiles', 'indoor', '17');
  for (const x of readdirSync(dir)) for (const yf of readdirSync(join(dir, x))) { const l = new VectorTile(new Protobuf(readFileSync(join(dir, x, yf)))).layers.indoor; if (!l) continue;
    for (let i = 0; i < l.length; i++) { const f = l.feature(i); const gj = f.toGeoJSON(+x, +yf.replace('.pbf', ''), 17); const k = f.properties.uid + ':' + f.type, a = JSON.stringify(gj.geometry).length; if (!best.has(k) || best.get(k).a < a) best.set(k, { a, f: { properties: f.properties, geometry: gj.geometry } }); } }
  mallFeatures = [...best.values()].map(v => v.f);
}
if (mallFeatures.length) {
  const g = graph('mallmap', { title: 'Mall units and facilities (lifts, escalators, ramps, stairs, entrances, toilets, defibrillators and more) from the Living Map data behind map.canarywharf.com: name, class, type, mall, floor, opening times, outline or position',
    source: ['danbri/londat third_party/cwg/_TMI/mallmap (from third_party/cwg/mallmap tiles)'], licence: "Canary Wharf Group / Living Map; archived at the owner's request 2026-10-06 for reference and accessibility design study, scoping only", tool: 'magpie/cwplans/tools/cwg-mallmap-tmi.mjs, build-kgx.mjs' });
  for (const { properties: p, geometry: gm } of mallFeatures) {
    const poly = /Polygon/.test(gm.type), point = gm.type === 'Point';
    if (!(poly && p.name) && !(point && p.type !== 'arrow')) continue;
    const s = ID + (poly ? 'unit/' : 'facility/') + p.uid; g.add(s, TYPE, iri('cwk', poly ? 'MallUnit' : 'Facility'));
    g.lit(s, iri('s', 'name'), p.name); g.lit(s, iri('cwk', 'unitClass'), p.class); g.lit(s, iri('cwk', 'unitType'), p.type);
    g.lit(s, iri('cwk', 'mall'), p.location_name); g.lit(s, iri('cwk', 'floorName'), p.floor_name); g.lit(s, iri('cwk', 'floorLevel'), Number(p.floor_level));
    g.lit(s, iri('cwk', 'openingTimesText'), p.opening_times); g.lit(s, iri('s', 'telephone'), p.tel_number); g.lit(s, iri('s', 'address'), p.street_address);
    if (/^https?:\/\//.test(p.url || '')) g.add(s, iri('s', 'url'), p.url);
    const wkt = wktOf(gm); if (wkt) { const geom = s + '/geometry'; g.add(s, iri('geo', 'hasGeometry'), geom); g.add(geom, TYPE, iri('geo', 'Geometry')); g.add(geom, iri('geo', 'asWKT'), F.literal(wkt, iri('geo', 'wktLiteral'))); }
    const [cx, cy] = centreOf(gm); g.lit(s, iri('s', 'longitude'), +cx.toFixed(7)); g.lit(s, iri('s', 'latitude'), +cy.toFixed(7));
  }
}

// 8. the CWG store guide of 20 July 2026, read by OCR (danbri/londat third_party/cwg/_TMI): names, sections, grid squares
const SG = join(LONDAT_DIR, 'third_party', 'cwg', '_TMI', 'store-guide-2026-07-20.json');
if (existsSync(SG)) {
  const g = graph('storeguide', { title: 'Canary Wharf Group store guide (20 July 2026): every listed shop, restaurant, café, service and office tenant with its section and grid squares, read by OCR',
    source: ['danbri/londat third_party/cwg/_TMI/store-guide-2026-07-20.json', 'danbri/londat third_party/cwg/maps/260720_store_guide_JULY_composite_v85_vec.pdf'], licence: 'Canary Wharf Group; design © Ravenshaw Studios Limited and Paul & Linda Anthony 2026; facts only, scoping', tool: 'magpie/cwplans/tools/cwg-maps-tmi.mjs, build-kgx.mjs' });
  const sgj = JSON.parse(readFileSync(SG, 'utf8'));
  for (const e of sgj.entries) {
    if (e.section === 'legend' || !e.name) continue;
    const s = ID + 'storeguide/p' + e.page + '/' + slug(e.section) + '/' + slug(e.name) + '-' + sha(JSON.stringify([e.name, e.grid_refs, e.bbox]));
    g.add(s, TYPE, iri('cwk', 'GuideEntry')); g.lit(s, iri('s', 'name'), e.name); g.lit(s, iri('cwk', 'guideSection'), e.section); g.lit(s, iri('cwk', 'guideGroup'), e.group);
    g.lit(s, iri('cwk', 'guidePage'), e.page); for (const r of e.grid_refs || []) g.lit(s, iri('cwk', 'gridRef'), `${r.row}${r.col}`);
    g.lit(s, iri('cwk', 'levelText'), e.level); g.lit(s, iri('rdfs', 'comment'), e.extra); g.lit(s, iri('cwk', 'ocrText'), e.ocr_text); g.lit(s, iri('cwk', 'ocrConfidence'), e.ocr_confidence);
    for (const b of e.buildings || []) g.lit(s, iri('cwk', 'buildingText'), typeof b === 'string' ? b : JSON.stringify(b));
    const m = e.name_matched; if (m?.slug && m?.kind) g.add(s, iri('s', 'sameAs'), `https://canarywharf.com/${m.kind}/${m.slug}/#entity`);
  }
}

// 9. the meta graph: one description per graph
const meta = graph('meta', { title: 'Descriptions of the graphs in this knowledge graph', source: [], licence: 'CC0 (descriptions only)', tool: 'magpie/cwplans/tools/build-kgx.mjs' });
for (const g of graphs.values()) { if (g === meta) continue; const m = g.meta, s = g.iri;
  meta.add(s, TYPE, iri('void', 'Dataset')); meta.add(s, TYPE, iri('prov', 'Entity')); meta.lit(s, iri('dct', 'title'), m.title); meta.lit(s, iri('dct', 'license'), m.licence);
  for (const src of m.source) meta.lit(s, iri('dct', 'source'), src); meta.lit(s, iri('prov', 'wasGeneratedBy'), m.tool); meta.lit(s, iri('dct', 'created'), today, 'date');
  meta.lit(s, iri('void', 'triples'), g.quads.length); if (m.osm) meta.lit(s, iri('dct', 'rights'), '© OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright'); }

// write: N-Quads per graph and all, COTTAS per graph and all, Shardborough store of all
for (const d of ['nq', 'cottas', 'queries']) mkdirSync(join(OUT, d), { recursive: true });
const files = {}, rec = (rel, buf) => { writeFileSync(join(OUT, rel), buf); files[rel] = { bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') }; };
const allQuads = []; const counts = {};
const T = { start: Date.now() }, lap = k => { T[k] = Date.now() - T.start; T.start = Date.now(); };
lap('graphs');
for (const g of graphs.values()) {
  const seen = new Set(), qs = g.quads.filter(q => { const k = q.subject.value + '\u0001' + q.predicate.value + '\u0001' + q.object.termType + q.object.value + '\u0001' + (q.object.datatype?.value || ''); if (seen.has(k)) return false; seen.add(k); return true; });
  counts[g.name] = qs.length; allQuads.push(...qs);
  const nq = await serialize(new Dataset(qs), { format: 'nquads' });
  if (nq.trim().split('\n').length !== qs.length) throw new Error(`serialize lost quads in ${g.name}: ${nq.trim().split('\n').length} of ${qs.length}`);
  rec(`nq/${g.name}.nq.gz`, gzipSync(nq));
  const cb = await toCottas(new Dataset(qs)); rec(`cottas/${g.name}.cottas`, Buffer.from(cb));
}
lap('per_graph_nq_and_cottas');
const allNq = await serialize(new Dataset(allQuads), { format: 'nquads' });
rec('nq/all.nq.gz', gzipSync(allNq));
const allC = await toCottas(new Dataset(allQuads)); rec('cottas/all.cottas', Buffer.from(allC));
// check the COTTAS copy answers like the quads it came from
{ const h = await openCottas(allC); const r = await queryCottas(h, 'SELECT (COUNT(*) AS ?n) WHERE { GRAPH ?g { ?s ?p ?o } }'); await closeCottas(h);
  const n = +r[0].get('n').value; if (n !== allQuads.length) throw new Error(`COTTAS has ${n} quads, expected ${allQuads.length}`); }
lap('all_nq_and_cottas');
// HDT (triples, one file per graph) when an HDT writer is at hand: HDT_LIB = a directory of the hdt-java-cli jars
// (Maven Central org.rdfhdt:hdt-java-cli and its dependencies). Factoidal reads HDT (queryHdt) but writes none.
if (process.env.HDT_LIB) {
  mkdirSync(join(OUT, 'hdt'), { recursive: true });
  for (const g of graphs.values()) {
    const nt = join(OUT, '.g.nt'); writeFileSync(nt, (await serialize(new Dataset(g.quads.map(q => F.quad(q.subject, q.predicate, q.object, F.defaultGraph()))), { format: 'nquads' })));
    execFileSync('java', ['-cp', join(process.env.HDT_LIB, '*'), 'org.rdfhdt.hdt.tools.RDF2HDT', '-rdftype', 'ntriples', nt, join(OUT, 'hdt', g.name + '.hdt')], { stdio: 'pipe' });
    rmSync(nt); const b = readFileSync(join(OUT, 'hdt', g.name + '.hdt')); files[`hdt/${g.name}.hdt`] = { bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') };
    for (const f of readdirSync(join(OUT, 'hdt'))) if (f.endsWith('.index.v1-1')) rmSync(join(OUT, 'hdt', f));
  }
  lap('hdt');
}
if (!process.argv.includes('--no-store')) {
  const tmp = join(OUT, '.all.nq'); writeFileSync(tmp, allNq);
  const store = join(OUT, 'shardborough'), gen = 'gen-' + today.replace(/-/g, '') + '-' + createHash('sha256').update(allNq).digest('hex').slice(0, 8);
  mkdirSync(store, { recursive: true });
  if (!existsSync(join(store, gen))) { const npx = join(ROOT, 'node_modules', '.bin', 'factoidal');
    execFileSync(npx, ['pack', tmp, join(store, gen), '--layout', 'ibk4'], { stdio: 'inherit' }); execFileSync(npx, ['activate', store, gen], { stdio: 'inherit' }); }
  rmSync(tmp);
  for (const d of readdirSync(store)) if (d.startsWith('gen-') && d !== gen) rmSync(join(store, d), { recursive: true });   // keep the current generation only (git keeps history)
  lap('shardborough');
  files['shardborough/'] = { generation: gen, files: readdirSync(join(store, gen)).length, bytes: readdirSync(join(store, gen)).reduce((a, f) => a + statSync(join(store, gen, f)).size, 0) };
}
const manifest = { about: 'cwplans knowledge graph, first cut. One named graph per source; the same quads as N-Quads, COTTAS and a Shardborough store. See README.md.',
  base: KG, built: new Date().toISOString(), tool: 'magpie/cwplans/tools/build-kgx.mjs', engine: '@factoidal/core ' + JSON.parse(readFileSync(join(ROOT, 'node_modules', '@factoidal', 'core', 'package.json'), 'utf8')).version,
  timings_ms: T, prefixes: NS, graphs: Object.fromEntries([...graphs.values()].map(g => [g.name, { iri: g.iri.value, quads: counts[g.name], ...g.meta }])), total_quads: allQuads.length, files };
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(JSON.stringify(counts), 'total', allQuads.length);
