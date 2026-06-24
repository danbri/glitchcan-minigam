// test-data-object.mjs — pure-Node unit test for the DataObject wrapper
// (no browser needed; Web Crypto is global in Node 20+).
import { typeInfo, makeId, canonicalize, fingerprint, wrap, serialize, contentFingerprint, finalize } from './js/data-object.js';

let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

// Deterministic canonicalization: key order doesn't matter.
ok('canonicalize sorts keys deterministically',
  canonicalize({ b: 1, a: { d: 2, c: 3 } }) === canonicalize({ a: { c: 3, d: 2 }, b: 1 }));
ok('canonicalize preserves array order',
  canonicalize({ xs: [3, 1, 2] }) === '{"xs":[3,1,2]}');

// Fingerprint: stable + sensitive to content.
const fpA = await fingerprint('hello world');
ok('fingerprint matches known SHA-256("hello world")',
  fpA === 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
ok('fingerprint differs for different content', (await fingerprint('hello world!')) !== fpA);

// typeInfo
ok('deck type → .edeck + media type', typeInfo('deck').ext === 'edeck' && /edot-deck/.test(typeInfo('deck').media));
ok('unknown type → json fallback', typeInfo('nope').ext === 'json');

// makeId
const ids = new Set(Array.from({ length: 100 }, () => makeId()));
ok('makeId is unique across 100 calls', ids.size === 100);

// Envelope + content fingerprint: identity is content, not metadata/venue.
const body = { slides: [{ id: 's1', title: 'Hi' }], theme: 'ink' };
const a = wrap({ type: 'deck', body, meta: { title: 'A', modifiedAt: 1 } });
const b = wrap({ type: 'deck', body: { theme: 'ink', slides: [{ title: 'Hi', id: 's1' }] }, meta: { title: 'B-different', modifiedAt: 999 } });
const cfA = await contentFingerprint(a);
const cfB = await contentFingerprint(b);
ok('content fingerprint ignores metadata/key-order (same body → same fp)', cfA === cfB);
ok('content fingerprint changes when the body changes',
  (await contentFingerprint(wrap({ type: 'deck', body: { ...body, theme: 'midnight' } }))) !== cfA);

// Round-trip: serialize → parse recovers the body losslessly.
const round = JSON.parse(serialize(a));
ok('serialize round-trips the body', JSON.stringify(round.body) === JSON.stringify(sortBody(body)));
ok('serialize carries id/type/schemaVersion', round.id === a.id && round.type === 'deck' && round.schemaVersion === '1.0.0');

// finalize stamps the fingerprint.
const fin = await finalize(a);
ok('finalize stamps a 64-hex content fingerprint', /^[0-9a-f]{64}$/.test(fin.fingerprint) && fin.fingerprint === cfA);

function sortBody(v) { return JSON.parse(canonicalize(v)); }

console.log(fail ? `\n${fail} FAILURE(S)` : '\nDATA-OBJECT OK');
process.exit(fail ? 1 : 0);
