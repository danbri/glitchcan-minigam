// test-geo-formula.mjs — pure-Node test of the GEO spreadsheet extension
// functions in formula.js. They resolve against a preloaded gazetteer via
// ctx.geo (exactly how the sheet wires it), so this needs no browser/network.
import { evaluate } from './formula.js';

let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

const gaz = new Map();
for (const p of [
  { name: 'London', wikidataId: 'Q84', lat: 51.5074, lon: -0.1278, kind: 'city', description: 'England, United Kingdom' },
  { name: 'Edinburgh', wikidataId: 'Q23436', lat: 55.9533, lon: -3.1883, kind: 'city', description: 'Scotland, United Kingdom' },
  { name: 'Bristol', wikidataId: 'Q23154', lat: 51.4545, lon: -2.5879, kind: 'city', description: 'England, United Kingdom' },
]) { gaz.set(p.name.toLowerCase(), p); gaz.set(p.wikidataId, p); }

const ctx = {
  cell: () => null, range: () => [], sql: () => null,
  geo: (k) => gaz.get(String(k).toLowerCase()) || gaz.get(String(k).toUpperCase()) || null,
};
const ev = (f) => evaluate(f, ctx);

// QID / WIKIDATA
ok('QID("Bristol") -> Q23154', ev('=QID("Bristol")') === 'Q23154');
ok('WIKIDATA by name is the same id', ev('=WIKIDATA("Edinburgh")') === 'Q23436');
ok('lookup works by QID too', ev('=PLACEDESC("Q84")').includes('England'));

// coordinates
ok('LAT("London") ~ 51.5', Math.abs(ev('=LAT("London")') - 51.5074) < 1e-6);
ok('LON("London") ~ -0.13', Math.abs(ev('=LON("London")') - (-0.1278)) < 1e-6);
ok('GEOCODE returns "lat, lon"', ev('=GEOCODE("Bristol")') === '51.4545, -2.5879');
ok('PLACEKIND("London") -> city', ev('=PLACEKIND("London")') === 'city');

// distance (great-circle): London <-> Edinburgh is ~534 km
{
  const d = ev('=GEODISTANCE("London","Edinburgh")');
  ok('GEODISTANCE London<->Edinburgh ~ 534 km', d > 525 && d < 545);
}

// composition with the rest of the engine
ok('GEO functions compose (ROUND of a distance)', ev('=ROUND(GEODISTANCE("London","Bristol"),0)') >= 150 && ev('=ROUND(GEODISTANCE("London","Bristol"),0)') <= 200);
ok('cell-ref arg works via a fake ctx.cell', evaluate('=QID(A1)', { ...ctx, cell: () => 'Bristol' }) === 'Q23154');

// error handling
ok('unknown place -> #N/A, catchable by IFERROR', ev('=IFERROR(QID("Nowhere"),"?")') === '?');
{
  let code = null;
  try { evaluate('=QID("London")', { cell: () => null, range: () => [], sql: () => null }); } catch (e) { code = e.code; }
  ok('no gazetteer loaded -> #NAME?', code === '#NAME?');
}

console.log(fail ? 'GEO-FORMULA FAIL' : 'GEO-FORMULA OK');
process.exit(fail ? 1 : 0);
