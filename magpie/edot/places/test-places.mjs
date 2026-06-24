// test-places.mjs — offline unit test of the places stack (providers + facade +
// merge/rank), with a stubbed fetch so it needs no network. Proves the headline
// behaviour: names + Wikidata QIDs, with a coordless Wikidata hit and a
// coordinate-bearing local hit for the same place fusing into one Place.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as wikidata from './js/providers/wikidata.js';
import * as local from './js/providers/local.js';
import { searchPlaces, merge, rank } from './js/places.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

// A stub Wikidata API: returns Edinburgh (Q23436), no coordinates.
function stubFetch(url) {
  const u = String(url);
  if (u.includes('wbsearchentities')) {
    return Promise.resolve({ ok: true, json: async () => ({ search: [
      { id: 'Q23436', label: 'Edinburgh', description: 'capital city of Scotland' },
      { id: 'Q207159', label: 'Edinburgh of the Seven Seas', description: 'settlement on Tristan da Cunha' },
    ] }) });
  }
  return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
}

// ---- provider: wikidata returns name + QID ----
{
  const r = await wikidata.search('Edinburgh', { fetch: stubFetch });
  ok('wikidata.search returns name + QID', r[0].name === 'Edinburgh' && r[0].wikidataId === 'Q23436' && r[0].lat === null);
}

// ---- provider: local seed parses and searches offline ----
const seed = local.parseNdjson(readFileSync(path.join(HERE, 'data/seed-places.ndjson'), 'utf8'));
{
  const r = await local.search('edin', { index: seed });
  ok('local.search finds the seed entry with coords + QID', r[0]?.name === 'Edinburgh' && r[0].wikidataId === 'Q23436' && Math.round(r[0].lat) === 56);
  ok('local seed parsed all 7 rows', seed.length === 7);
}

// ---- merge fuses a coordless QID hit with a coordinate hit ----
{
  const fused = merge([
    { name: 'Edinburgh', wikidataId: 'Q23436', lat: null, lon: null, kind: null, description: 'd', source: 'wikidata' },
    { name: 'Edinburgh', wikidataId: 'Q23436', lat: 55.95, lon: -3.19, kind: 'city', description: null, source: 'local' },
  ]);
  ok('merge collapses same-QID hits into one', fused.length === 1);
  ok('merged Place has both QID and coordinates', fused[0].wikidataId === 'Q23436' && fused[0].lat === 55.95);
  ok('merge records contributing sources', fused[0].sources.includes('wikidata') && fused[0].sources.includes('local'));
}

// ---- rank: exact name + QID + coords ranks first ----
{
  const ordered = rank([
    { name: 'Edinburgh Castle', wikidataId: 'Q464552', lat: 55.9, lon: -3.2, source: 'x' },
    { name: 'Edinburgh', wikidataId: 'Q23436', lat: 55.95, lon: -3.19, source: 'x' },
  ], 'Edinburgh');
  ok('rank puts the exact-name match first', ordered[0].name === 'Edinburgh');
}

// ---- facade: end-to-end over a catalogue, offline ----
{
  const cat = JSON.parse(readFileSync(path.join(HERE, 'places-catalogue.json'), 'utf8'));
  const results = await searchPlaces('Edinburgh', {
    catalogue: cat,
    fetch: stubFetch,
    config: { 'local-seed': { index: seed } }, // feed the seed in-memory (no file:// fetch in Node)
    limit: 8,
  });
  const edin = results.find((p) => p.wikidataId === 'Q23436');
  ok('facade returns Edinburgh as one fused Place', !!edin && results.filter((p) => p.wikidataId === 'Q23436').length === 1);
  ok('fused Place carries QID AND coordinates from two sources', edin && edin.wikidataId === 'Q23436' && edin.lat != null && edin.sources.length >= 2);
  ok('planned sources (overture/foursquare) were not queried', results.every((p) => (p.sources || []).every((s) => s !== 'overture-places')));
}

console.log(fail ? 'PLACES FAIL' : 'PLACES OK');
process.exit(fail ? 1 : 0);
