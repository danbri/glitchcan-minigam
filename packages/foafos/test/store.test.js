import assert from 'node:assert/strict';
import test from 'node:test';
import { FoafStore, memoryBackend, STORE_CAP } from '../src/store.mjs';

const mkBus = () => {
  const seen = [];
  return { seen, publish: (topic, data) => seen.push({ topic, ...data }) };
};

test('an app without the capability is refused, and told so', () => {
  const bus = mkBus();
  const s = new FoafStore({ bus, backend: memoryBackend() });
  s.grant('sheets', []);                       // launched, but no storage
  // null, NOT {} — an empty object reads as "no data yet" and an app
  // will overwrite on that basis.
  assert.equal(s.snapshot('sheets'), null);
  assert.deepEqual(s.set('sheets', 'a', '1'), { ok: false, reason: 'denied' });
  assert.ok(bus.seen.some(e => e.topic === 'store.denied'));
});

test('a granted app reads back what it wrote', () => {
  const s = new FoafStore({ backend: memoryBackend() });
  s.grant('sheets', [STORE_CAP]);
  assert.deepEqual(s.snapshot('sheets'), {});
  s.set('sheets', 'doc', 'hello');
  assert.deepEqual(s.snapshot('sheets'), { doc: 'hello' });
  s.remove('sheets', 'doc');
  assert.deepEqual(s.snapshot('sheets'), {});
});

test('apps cannot see each other', () => {
  const s = new FoafStore({ backend: memoryBackend() });
  s.grant('a', [STORE_CAP]).grant('b', [STORE_CAP]);
  s.set('a', 'secret', 'x');
  assert.deepEqual(s.snapshot('b'), {});
  // and a key cannot escape its namespace by being named cleverly
  s.set('b', '../a/secret', 'y');
  assert.deepEqual(s.snapshot('a'), { secret: 'x' });
});

test('quota refuses without half-applying', () => {
  const bus = mkBus();
  const s = new FoafStore({ bus, backend: memoryBackend(), quotaBytes: 64 });
  s.grant('big', [STORE_CAP]);
  s.set('big', 'k', 'small');
  const r = s.set('big', 'k', 'x'.repeat(200));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'quota');
  // the OLD value survives: a half-applied write is worse than a refused one
  assert.deepEqual(s.snapshot('big'), { k: 'small' });
  assert.ok(bus.seen.some(e => e.topic === 'store.quota'));
});

test('a brand new key that blows the quota leaves no trace', () => {
  const s = new FoafStore({ backend: memoryBackend(), quotaBytes: 40 });
  s.grant('big', [STORE_CAP]);
  s.set('big', 'fits', 'ok');
  s.set('big', 'huge', 'y'.repeat(500));
  assert.deepEqual(s.snapshot('big'), { fits: 'ok' });
});

test('report shows who holds what', () => {
  const s = new FoafStore({ backend: memoryBackend() });
  s.grant('sheets', [STORE_CAP]).grant('robbin', []);
  s.set('sheets', 'a', '12345');
  const r = s.report();
  assert.equal(r.find(x => x.appId === 'sheets').capabilities[0], STORE_CAP);
  assert.ok(r.find(x => x.appId === 'sheets').bytes > 0);
  assert.equal(r.find(x => x.appId === 'robbin').bytes, 0);
});
