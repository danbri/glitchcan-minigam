// test-object-index.mjs — pure-Node unit test for the object/metadata index
// (storage-injectable; no browser needed).
import { ObjectIndex, memoryStore } from './js/object-index.js';

let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

const store = memoryStore();
const ix = new ObjectIndex(store);

// upsert validates id + type.
let threw = false; try { ix.upsert({ title: 'no id' }); } catch { threw = true; }
ok('upsert requires id and type', threw);

// Basic insert + retrieve.
const a = ix.upsert({ id: 'd1', type: 'doc', title: 'Alpha', modifiedAt: 100, fingerprint: 'f1' });
ok('upsert returns the stored record', a.id === 'd1' && a.type === 'doc' && a.title === 'Alpha');
ok('get retrieves by id', ix.get('d1')?.title === 'Alpha');
ok('has/size reflect inserts', ix.has('d1') && ix.size === 1);

// Body never enters the index (only known fields are kept).
const b = ix.upsert({ id: 'd2', type: 'doc', title: 'Beta', modifiedAt: 200, body: { html: '<p>secret</p>' } });
ok('the body is not stored in the index', !('body' in b));

// Governance seams default to null and are reserved.
ok('governance seams default null', b.owner === null && b.labels === null && b.acl === null);

// Partial upsert preserves prior fields (a bare touch keeps title + fingerprint).
ix.upsert({ id: 'd1', type: 'doc', modifiedAt: 300 });
ok('partial upsert preserves title', ix.get('d1').title === 'Alpha');
ok('partial upsert preserves fingerprint', ix.get('d1').fingerprint === 'f1');
ok('partial upsert preserves createdAt', ix.get('d1').createdAt === 100);
ok('partial upsert updates modifiedAt', ix.get('d1').modifiedAt === 300);

// Ordering: most-recently-modified first.
ix.upsert({ id: 'd3', type: 'deck', title: 'Gamma', modifiedAt: 50 });
ok('all() sorts newest first', ix.all().map((r) => r.id).join(',') === 'd1,d2,d3');

// byType + search.
ok('byType filters', ix.byType('deck').length === 1 && ix.byType('doc').length === 2);
ok('search matches title', ix.search('beta').map((r) => r.id).join() === 'd2');
ok('search matches type', ix.search('deck').map((r) => r.id).join() === 'd3');
ok('empty search returns all', ix.search('').length === 3);

// remove.
ok('remove reports it removed', ix.remove('d2') === true && !ix.has('d2'));
ok('remove of a missing id reports false', ix.remove('nope') === false);

// Persistence: a fresh index over the SAME store sees the data (separate of any
// app body store).
const ix2 = new ObjectIndex(store);
ok('a new index over the same store reloads records', ix2.size === 2 && ix2.get('d1')?.title === 'Alpha');

// clear.
ix2.clear();
ok('clear empties the index and persists', ix2.size === 0 && new ObjectIndex(store).size === 0);

console.log(fail ? `\n${fail} FAILURE(S)` : '\nOBJECT-INDEX OK');
process.exit(fail ? 1 : 0);
