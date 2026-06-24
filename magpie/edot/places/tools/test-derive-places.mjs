// test-derive-places.mjs — pure-Node test of the extract-builder: GeoJSON ->
// normalized, bbox-clipped, de-duplicated Place[] across Overture/plain shapes.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseFeatures, derivePlaces, featureToPlace, toNdjson } from './derive-places.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

const features = parseFeatures(readFileSync(path.join(HERE, 'fixtures/sample.geojson'), 'utf8'));
const bbox = [-2.72, 51.41, -2.51, 51.50]; // Bristol-ish
const places = derivePlaces(features, { bbox, source: 'overture-places' });
const by = Object.fromEntries(places.map((p) => [p.name, p]));

ok('clips to bbox and drops the un-named feature (4 of 6)', places.length === 4);
ok('Delta Tower (outside bbox) is excluded', !places.some((p) => p.name.startsWith('Delta')));

ok('Overture names.primary -> name', !!by['Cafe Alpha']);
ok('Overture categories.primary -> kind', by['Cafe Alpha'].kind === 'cafe');
ok('Overture sources[].wikidata -> wikidataId', by['Cafe Alpha'].wikidataId === 'Q1');

ok('plain GeoJSON properties.name + .wikidata', by['Bravo Books'] && by['Bravo Books'].wikidataId === 'Q2');
ok('plain .category -> kind', by['Bravo Books'].kind === 'bookshop');

ok('missing wikidata -> null (not invented)', by['Charlie Park'].wikidataId === null);

ok('non-Point geometry falls back to a coordinate', !!by['Echo Line'] && Math.abs(by['Echo Line'].lon - (-2.61)) < 1e-6);
ok('every place carries the source id', places.every((p) => p.source === 'overture-places'));

// dedupe by QID
{
  const dup = derivePlaces([...features, features[0]], { bbox, source: 'x' });
  ok('duplicate (same QID) is de-duplicated', dup.filter((p) => p.wikidataId === 'Q1').length === 1);
}

// featureToPlace rounds coordinates; toNdjson round-trips
{
  const p = featureToPlace(features[0], 'x');
  ok('coordinates are normalized numbers', typeof p.lat === 'number' && typeof p.lon === 'number');
  const round = toNdjson([p]).trim();
  ok('toNdjson emits one parseable Place per line', JSON.parse(round).name === 'Cafe Alpha');
}

console.log(fail ? 'DERIVE-PLACES FAIL' : 'DERIVE-PLACES OK');
process.exit(fail ? 1 : 0);
