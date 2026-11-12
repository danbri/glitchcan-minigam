import test from 'node:test';
import assert from 'node:assert/strict';
import { TextIndex, words } from '../src/search.mjs';

test('words: any script, lower case, accents folded', () => {
  assert.deepEqual(words('Café au LAIT, naïve 2026 — Ελλάδα'), ['cafe', 'au', 'lait', 'naive', '2026', 'ελλαδα']);
});

test('search: every word must be there; results only from the index; best first', () => {
  const ix = new TextIndex();
  ix.put('a.txt', 'red apple, red cherry');
  ix.put('b.txt', 'green apple');
  ix.put('c.md', 'a red car');
  assert.deepEqual(ix.search('apple').map((h) => h.path), ['a.txt', 'b.txt']);
  assert.deepEqual(ix.search('red apple').map((h) => h.path), ['a.txt']);
  assert.deepEqual(ix.search('red').map((h) => h.path), ['a.txt', 'c.md']);   // a.txt has "red" twice
  assert.deepEqual(ix.search('banana'), []);
  assert.deepEqual(ix.search('  ,, '), []);
  assert.match(ix.search('cherry')[0].snippet, /cherry/);
});

test('put and remove give the same index as building again', () => {
  const live = new TextIndex();
  live.put('a.txt', 'one two');
  live.put('b.txt', 'two three');
  live.put('a.txt', 'three four');       // replaced
  live.remove('b.txt');
  live.put('c.txt', 'four');
  const fresh = new TextIndex();
  fresh.put('a.txt', 'three four');
  fresh.put('c.txt', 'four');
  for (const q of ['one', 'two', 'three', 'four', 'three four']) {
    assert.deepEqual(live.search(q).map((h) => [h.path, h.score]), fresh.search(q).map((h) => [h.path, h.score]), q);
  }
  assert.equal(live.bytes, fresh.bytes);
  assert.deepEqual([...live.terms.keys()].sort(), [...fresh.terms.keys()].sort());
});

test('keep filters before the limit, so refused results never hide allowed ones', () => {
  const ix = new TextIndex();
  for (let i = 0; i < 10; i++) ix.put(`secret/${i}.txt`, 'plan plan plan');
  ix.put('mine/plan.txt', 'plan');
  const hits = ix.search('plan', { limit: 3, keep: (p) => p.startsWith('mine/') });
  assert.deepEqual(hits.map((h) => h.path), ['mine/plan.txt']);
});
