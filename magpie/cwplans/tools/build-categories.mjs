// Occupant categories per registry building: finance, shops, catering, leisure, entertainment. Drives the "glow"
// outlines in the 3D page and the counts in the atlas.
//
//   NODE_USE_ENV_PROXY=1 node magpie/cwplans/tools/build-categories.mjs     # fetches Wikidata classes once, then cached
//
// in:  registry/buildings.json, data/raw/registry/osm-cw.json.gz (OSM tags by id: the registry keeps only a role),
//      Wikidata P31 (instance of) and P452 (industry) of every occupant item (cached in data/raw/registry/wikidata-occupant-classes.json)
// out: registry/categories.json  { rules, buildings: { cwb-id: { finance: [{ name, source, why, dated }], ... } } }
// Rules: a category comes only from a class stated by a source (an OSM tag, a Wikidata class or industry, the FSA
// business type, the CWG directory section). Names are never used to guess a class. Companies House registered
// offices are not occupants (audit SE-1) and are not used. Wikidata occupant links carry no dates (audit TM-4):
// those entries are marked dated: false, because some are former tenants.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { TOOLS, UA } from './lib.mjs';

const CW = join(TOOLS, '..');
const REG = JSON.parse(readFileSync(join(CW, 'registry/buildings.json'), 'utf8'));
const OSM = JSON.parse(gunzipSync(readFileSync(join(CW, 'data/raw/registry/osm-cw.json.gz'))));
const tagsOf = new Map(OSM.features.map(f => [`${f.type}/${f.id}`, f.tags || {}]));

// ---- Wikidata classes of occupant items (P31) and industries (P452), with English labels
const WDC = join(CW, 'data/raw/registry/wikidata-occupant-classes.json');
const qids = [...new Set(REG.buildings.flatMap(b => b.occupants.map(o => o.wikidata)).filter(Boolean))];
let wdc = existsSync(WDC) ? JSON.parse(readFileSync(WDC, 'utf8')) : { fetched: null, items: {} };
const missing = qids.filter(q => !wdc.items[q]);
if (missing.length) {
  // wbgetentities, 40 ids a call; Wikidata answers "too many requests" in plain text when busy: wait and retry
  const api = async ids => { for (let k = 1; ; k++) { const r = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=claims|labels&languages=en&format=json&maxlag=5`, { headers: { 'User-Agent': UA } }), t = await r.text();
    try { const j = JSON.parse(t); if (j.entities) return j; } catch {} if (k > 6) throw new Error('Wikidata: ' + t.slice(0, 80)); await new Promise(res => setTimeout(res, 4000 * k)); } };
  const claims = {};
  for (let i = 0; i < missing.length; i += 40) Object.assign(claims, (await api(missing.slice(i, i + 40))).entities);
  const val = (e, p) => (e.claims?.[p] || []).map(c => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
  const classIds = [...new Set(Object.values(claims).flatMap(e => [...val(e, 'P31'), ...val(e, 'P452')]))], labels = {};
  for (let i = 0; i < classIds.length; i += 40) for (const [id, e] of Object.entries((await api(classIds.slice(i, i + 40))).entities)) labels[id] = e.labels?.en?.value || id;
  for (const [q, e] of Object.entries(claims)) wdc.items[q] = { label: e.labels?.en?.value || null, p31: val(e, 'P31').map(c => labels[c]), p452: val(e, 'P452').map(c => labels[c]) };
  wdc.fetched = new Date().toISOString().slice(0, 10);
  writeFileSync(WDC, JSON.stringify(wdc, null, 1));
  console.log(`Wikidata classes fetched for ${missing.length} items`);
}

// ---- rules: [category, test on (occupant, OSM tags, Wikidata classes), reason]
const FIN_WD = /\b(bank|banking|financial|finance|insurance|investment|asset management|stock exchange|securities|credit rating|brokerage|hedge fund|private equity|payment|financial regulator|regulatory agency)\b/i;
const RULES = [
  ['finance', (o, t) => /^(bank|bureau_de_change|money_transfer)$/.test(t.amenity || '') || /^(financial|insurance|financial_advisor|tax_advisor)$/.test(t.office || ''), (o, t) => `OSM ${t.amenity ? 'amenity=' + t.amenity : 'office=' + t.office}`],
  ['finance', (o, t, w) => w && (w.p31.some(c => FIN_WD.test(c)) || w.p452.some(c => FIN_WD.test(c))), (o, t, w) => `Wikidata ${[...w.p31, ...w.p452].filter(c => FIN_WD.test(c)).slice(0, 2).join(', ')}`],
  ['finance', o => /^(service: bank|branch: bank|service: bureau_de_change|service: money_transfer)$/.test(o.role), o => `role ${o.role}`],
  ['shop', (o, t) => !!t.shop || /^(branch: shop|shop)$/.test(o.role) || /^Retailers/.test(o.type || ''), (o, t) => t.shop ? `OSM shop=${t.shop}` : o.type ? `FSA ${o.type}` : `role ${o.role}`],
  ['catering', (o, t) => /^(restaurant|cafe|bar|pub|fast_food|food_court|ice_cream|biergarten)$/.test(t.amenity || '') || /^(food and drink|branch: (cafe|bar|takeaway|restaurant|fast food|pub))$/.test(o.role) || /^(Restaurant|Takeaway|Pub\/bar|Other catering|Mobile caterer)/.test(o.type || ''), (o, t) => t.amenity ? `OSM amenity=${t.amenity}` : o.type ? `FSA ${o.type}` : `role ${o.role}`],
  ['leisure', (o, t) => /^(fitness_centre|sports_centre|swimming_pool|sauna|dance|sports_hall)$/.test(t.leisure || '') || /^leisure: (fitness_centre|sports_centre|swimming_pool|sauna|dance)$/.test(o.role) || /^(branch: hotel|tourism: hotel)$/.test(o.role) || /^Hotel/.test(o.type || ''), (o, t) => t.leisure ? `OSM leisure=${t.leisure}` : o.type ? `FSA ${o.type}` : `role ${o.role}`],
  ['entertainment', (o, t, w) => /^(cinema|theatre|nightclub|arts_centre|casino|events_venue|music_venue|planetarium)$/.test(t.amenity || '') || /^(amusement_arcade|bowling_alley|escape_game|miniature_golf|adult_gaming_centre)$/.test(t.leisure || '') || /^(museum|gallery)$/.test(t.tourism || '') || /^service: (cinema|theatre|nightclub|events_venue|arts_centre)$/.test(o.role) || /^Pub\/bar\/nightclub/.test(o.type || '') && /nightclub/i.test(t.amenity || '') || (w && w.p31.some(c => /movie theater|cinema|theatre|music venue|nightclub|museum|art gallery|bowling/i.test(c))), (o, t, w) => t.amenity ? `OSM amenity=${t.amenity}` : t.leisure ? `OSM leisure=${t.leisure}` : t.tourism ? `OSM tourism=${t.tourism}` : w ? `Wikidata ${w.p31[0]}` : `role ${o.role}`],
];
const CATS = ['finance', 'shop', 'catering', 'leisure', 'entertainment'];

const out = {}, totals = Object.fromEntries(CATS.map(c => [c, { buildings: 0, occupants: 0 }]));
for (const b of REG.buildings) {
  const rec = {};
  for (const o of b.occupants) {
    const t = (o.osm && tagsOf.get(o.osm)) || {}, w = o.wikidata ? wdc.items[o.wikidata] : null, done = new Set();
    for (const [cat, test, why] of RULES) if (!done.has(cat) && test(o, t, w)) { done.add(cat); if ((rec[cat] || []).some(x => x.name === (o.name || w?.label || ''))) continue; (rec[cat] ||= []).push({ name: o.name || w?.label || '', source: o.source, why: why(o, t, w), ...(o.source === 'wikidata' || /wikidata/.test(o.role) ? { dated: false } : {}) }); }
  }
  if (Object.keys(rec).length) { out[b.id] = rec; for (const c of Object.keys(rec)) { totals[c].buildings++; totals[c].occupants += rec[c].length; } }
}
writeFileSync(join(CW, 'registry/categories.json'), JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  rules: 'A category comes only from a class a source states: OSM tags (amenity, office, shop, leisure, tourism), Wikidata P31 instance of and P452 industry, the FSA business type, the CWG directory section. Names are not used. Companies House registered offices are not used (SE-1). Wikidata occupant links have no dates (TM-4): dated false marks them; some are former tenants.',
  totals, buildings: out,
}));
console.log('categories.json:', JSON.stringify(totals));
