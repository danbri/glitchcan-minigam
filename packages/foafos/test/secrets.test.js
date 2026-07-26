// The property under test is an ABSENCE: the value must not come back out,
// anywhere. So most of these assertions grep the whole observable surface —
// audit, bus, report, sealed blob — for the secret itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FoafSecrets, SECRETS_CAP, MAX_SECRET_BYTES } from '../src/secrets.mjs';

const TOKEN = 'gho_THIS_MUST_NEVER_APPEAR_ANYWHERE_9f3c';

const busSpy = () => {
  const seen = [];
  return { seen, publish: (topic, data) => seen.push({ topic, data }) };
};
const memStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
    _all: () => [...m.values()].join('|'),
  };
};

test('an app without the capability cannot put, name or use', () => {
  const bus = busSpy();
  const s = new FoafSecrets({ bus });
  assert.equal(s.put('edot', 'gh', TOKEN).reason, 'denied');
  assert.equal(s.names('edot'), null, 'names is null, not an empty list — absent is not empty');
  assert.ok(bus.seen.some(e => e.topic === 'secrets.denied'));
});

test('a granted app can put and list its own names, and nothing more', () => {
  const s = new FoafSecrets();
  s.grant('edot', [SECRETS_CAP]);
  assert.equal(s.put('edot', 'gh.token', TOKEN).ok, true);
  assert.deepEqual(s.names('edot'), ['gh.token']);
  assert.equal(s.has('edot', 'gh.token'), true);
});

test('there is no read, and asking says what to do instead', () => {
  const s = new FoafSecrets();
  s.grant('edot', [SECRETS_CAP]);
  s.put('edot', 'gh', TOKEN);
  assert.throws(() => s.read('edot', 'gh'), (e) => {
    assert.equal(e.name, 'FoafSecretsNotReadable');
    assert.match(e.message, /secrets\.use/);
    return true;
  });
});

test('use hands the value to a SHELL function and returns only its result', async () => {
  const s = new FoafSecrets();
  s.grant('edot', [SECRETS_CAP]);
  s.put('edot', 'gh', TOKEN);
  let sawInside = null;
  const r = await s.use('edot', 'gh', (v) => { sawInside = v; return 'committed abc123'; });
  assert.equal(r.ok, true);
  assert.equal(r.result, 'committed abc123');
  assert.equal(sawInside, TOKEN, 'the shell-side operation does get the value');
  assert.ok(!JSON.stringify(r).includes(TOKEN), 'but the caller\'s result does not carry it');
});

test('use refuses without the capability, and reports a missing name', async () => {
  const s = new FoafSecrets();
  assert.equal((await s.use('edot', 'gh', () => 1)).reason, 'denied');
  s.grant('edot', [SECRETS_CAP]);
  assert.equal((await s.use('edot', 'nope', () => 1)).reason, 'missing');
});

test('a failing use reports the error TYPE, never its message', async () => {
  // A fetch failure's message and URL routinely contain the credential.
  const bus = busSpy();
  const s = new FoafSecrets({ bus });
  s.grant('edot', [SECRETS_CAP]);
  s.put('edot', 'gh', TOKEN);
  const r = await s.use('edot', 'gh', (v) => { throw new TypeError(`failed on https://x/?t=${v}`); });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'TypeError');
  assert.ok(!JSON.stringify(r).includes(TOKEN));
  assert.ok(!JSON.stringify(bus.seen).includes(TOKEN), 'and the bus did not carry it either');
});

test('NO VALUE ESCAPES: audit, bus and report are all clean', async () => {
  const bus = busSpy();
  const s = new FoafSecrets({ bus });
  s.grant('edot', [SECRETS_CAP]);
  s.put('edot', 'gh', TOKEN);
  s.names('edot');
  await s.use('edot', 'gh', () => 'ok');
  s.forget('edot', 'gh');
  const surface = JSON.stringify({ audit: s.audit, bus: bus.seen, report: s.report() });
  assert.ok(!surface.includes(TOKEN), 'the secret appeared in an observable surface');
  // and the report still says the useful thing
  s.put('edot', 'gh', TOKEN);
  assert.deepEqual(s.report().apps.find(a => a.appId === 'edot').names, ['gh']);
});

test('an oversized value is refused, and a hoarding app is capped', () => {
  const s = new FoafSecrets();
  s.grant('edot', [SECRETS_CAP]);
  assert.equal(s.put('edot', 'huge', 'x'.repeat(MAX_SECRET_BYTES + 1)).reason, 'too-large');
  for (let i = 0; i < 30; i++) s.put('edot', `k${i}`, 'v');
  assert.equal(s.names('edot').length, 24);
  assert.equal(s.put('edot', 'one-more', 'v').reason, 'too-many');
});

test('sealed at rest is CIPHERTEXT, and survives a round trip', async () => {
  const storage = memStorage();
  const s = new FoafSecrets({ storage });
  s.grant('edot', [SECRETS_CAP]);
  s.put('edot', 'gh', TOKEN);
  assert.equal(s.sealed, false, 'unsealed until told otherwise — and it says so');

  assert.equal((await s.seal('correct horse')).ok, true);
  assert.equal(s.sealed, true);
  assert.ok(!storage._all().includes(TOKEN), 'the stored blob is not plaintext');

  const fresh = new FoafSecrets({ storage });
  fresh.grant('edot', [SECRETS_CAP]);
  assert.equal((await fresh.unseal('correct horse')).ok, true);
  assert.equal(fresh.has('edot', 'gh'), true);
  let got = null;
  await fresh.use('edot', 'gh', (v) => { got = v; });
  assert.equal(got, TOKEN, 'the value survived the round trip');
});

test('a wrong passphrase is refused without disturbing what is held', async () => {
  const storage = memStorage();
  const s = new FoafSecrets({ storage });
  s.grant('edot', [SECRETS_CAP]);
  s.put('edot', 'gh', TOKEN);
  await s.seal('right');

  const other = new FoafSecrets({ storage });
  other.grant('edot', [SECRETS_CAP]);
  assert.equal((await other.unseal('wrong')).reason, 'wrong-passphrase');
  assert.equal(other.has('edot', 'gh'), false, 'nothing was half-loaded');
});

test('sealing is never implicit: no passphrase means memory-only, and it admits it', async () => {
  // The whole point. Writing a token to disk in the clear is the bug this
  // module exists to stop, so an unsealed store must refuse to persist
  // rather than silently degrade.
  const storage = memStorage();
  const s = new FoafSecrets({ storage });
  s.grant('edot', [SECRETS_CAP]);
  s.put('edot', 'gh', TOKEN);
  assert.equal(s.sealed, false);
  assert.equal(storage.getItem('foafos.secrets'), null, 'nothing was written');
  assert.equal((await s.flush()).reason, 'not-sealed');
  await assert.rejects(() => s.seal(''), /passphrase/);
  assert.ok(!storage._all().includes(TOKEN));
});

test('apps cannot see each other, by name or by use', async () => {
  const s = new FoafSecrets();
  s.grant('edot', [SECRETS_CAP]).grant('sheets', [SECRETS_CAP]);
  s.put('edot', 'gh', TOKEN);
  assert.deepEqual(s.names('sheets'), []);
  assert.equal((await s.use('sheets', 'gh', () => 1)).reason, 'missing');
});

// hasSealed exists because "you have no key" and "your key is right there,
// sealed, and nobody unlocked it" are completely different situations for a
// user. A broker that reports the first for the second sends them off to
// mint a token they already have.
test('a sealed blob on the device is distinguishable from having nothing', async () => {
  const store = memStorage();
  const a = new FoafSecrets({ storage: store });
  assert.equal(a.hasSealed(), false, 'nothing stored yet');
  a.grant('edot', [SECRETS_CAP]);
  a.put('edot', 'gh.token', TOKEN);
  await a.seal('hunter2');

  // A FRESH broker over the same device: it holds nothing, but must not
  // claim there is nothing to hold.
  const b = new FoafSecrets({ storage: store });
  assert.equal(b.count(), 0);
  assert.equal(b.hasSealed(), true, 'it can tell the difference');
  assert.deepEqual(b.names('edot'), null, 'and still refuses an ungranted app');
  b.grant('edot', [SECRETS_CAP]);
  assert.deepEqual(b.names('edot'), [], 'granted but locked reads as empty, not as the value');
  assert.equal((await b.unseal('hunter2')).ok, true);
  assert.deepEqual(b.names('edot'), ['gh.token']);
});

test('with no storage at all, hasSealed is false rather than a thrown error', () => {
  assert.equal(new FoafSecrets({}).hasSealed(), false);
});

test('clearSealed takes the blob AND what is held — FORGET must mean forget', async () => {
  const store = memStorage();
  const bus = busSpy();
  const s = new FoafSecrets({ storage: store, bus });
  s.grant('edot', [SECRETS_CAP]);
  s.put('edot', 'gh.token', TOKEN);
  await s.seal('hunter2');
  assert.ok(store._all().length > 0);

  const r = s.clearSealed();
  assert.equal(r.forgotten, 1);
  assert.equal(s.hasSealed(), false, 'the sealed blob is gone from the device');
  assert.equal(s.count(), 0, 'and nothing is still held in memory');
  assert.equal(s.sealed, false);
  assert.ok(!store._all().includes(TOKEN));
  assert.ok(bus.seen.some(e => e.topic === 'secrets.cleared'), 'and it says so');
  // a re-seal after clearing must not silently resurrect anything
  assert.equal((await s.unseal('hunter2')).reason, 'nothing-stored');
});
