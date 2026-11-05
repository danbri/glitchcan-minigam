// FoafPods: the pod list, connections, and the four app verbs. As in ops.test.js, most of this
// is REFUSALS: an app must not be able to aim a pod call outside its grant, learn the pod's
// address, or see the relay password. The storage is an in-memory fake that records what was
// sent; the real engine over a real relay is packages/foafos/pod/test/run.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FoafSecrets } from '../src/secrets.mjs';
import { FoafPods, POD_OWNER, checkPod, BUILTIN_BASE } from '../src/pods.mjs';

const PASSWORD = 'relay-pw-THIS_MUST_NEVER_APPEAR_ANYWHERE_41c2';
const BASE = 'https://pod.example/';

/** A tiny LWS-ish storage: resources with ETags, containers with listings. */
function fakeStorage(BASE = 'https://pod.example/') {
  const res = new Map([['/', { container: true }]]);
  let n = 0;
  const calls = [];
  const fetch = async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || {});
    calls.push({ url: String(url), method, headers: Object.fromEntries(headers) });
    if (!String(url).startsWith(BASE)) return new Response(null, { status: 400 });
    const path = '/' + decodeURIComponent(String(url).slice(BASE.length));
    const cur = res.get(path);
    if (method === 'HEAD') return new Response(null, { status: cur ? 200 : 404 });
    if (method === 'GET') {
      if (!cur) return new Response(null, { status: 404 });
      if (cur.container) {
        const items = [...res.keys()].filter((k) => k !== path && k.startsWith(path) && !k.slice(path.length).replace(/\/$/, '').includes('/'))
          .map((k) => ({ id: BASE + k.slice(1).split('/').map(encodeURIComponent).join('/'), type: res.get(k).container ? 'Container' : 'DataResource' }));
        return new Response(JSON.stringify({ id: BASE + path.slice(1), items }), { status: 200, headers: { 'Content-Type': 'application/lws+json' } });
      }
      return new Response(cur.body, { status: 200, headers: { 'Content-Type': cur.type, ETag: cur.etag } });
    }
    if (method === 'PUT') {
      const parent = path.replace(/\/?[^/]*\/?$/, '/') || '/';
      if (!res.has(parent)) return new Response(null, { status: 409 });
      if (headers.get('if-match') && headers.get('if-match') !== cur?.etag) return new Response(null, { status: 412 });
      if (headers.get('if-none-match') === '*' && cur) return new Response(null, { status: 412 });
      if (path.endsWith('/')) { res.set(path, { container: true }); return new Response(null, { status: 201 }); }
      const etag = `"e${++n}"`;
      res.set(path, { body: String(init.body ?? ''), type: headers.get('content-type') || 'text/plain', etag });
      return new Response(null, { status: cur ? 204 : 201, headers: { ETag: etag } });
    }
    if (method === 'DELETE') {
      if (!cur) return new Response(null, { status: 404 });
      res.delete(path);
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 405 });
  };
  return { fetch, calls, res };
}

const busSpy = () => { const seen = []; return { seen, publish: (topic, data) => seen.push({ topic, data }) }; };

function rig({ carriage = 'xmpp', storageImpl = fakeStorage(), loginFails = false } = {}) {
  const bus = busSpy();
  const secrets = new FoafSecrets({ bus });
  const logins = [];
  const connectXmpp = async (opts) => {
    logins.push(opts);
    if (loginFails || opts.password !== PASSWORD) throw new Error(`SASL failed for ${opts.password}`);
    return { httpFetch: ({ base }) => { assert.equal(base, BASE); return storageImpl.fetch; }, close() {} };
  };
  const saved = new Map();
  const local = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) };
  const pods = new FoafPods({ secrets, bus, storage: local, connectXmpp, fetchImpl: storageImpl.fetch });
  const rec = carriage === 'xmpp'
    ? { id: 'home', base: BASE, carriage, relay: { url: 'wss://relay.example/xmpp-websocket', domain: 'relay.example', username: 'me' }, podJid: 'pod@relay.example/lws' }
    : { id: 'home', base: BASE, carriage };
  pods.add(rec, carriage === 'xmpp' ? { password: PASSWORD } : {});
  return { pods, secrets, bus, logins, storage: storageImpl, saved, local };
}

const leaks = (r) => JSON.stringify([r.bus.seen, r.pods.audit, r.secrets.audit, r.pods.list(), [...r.saved.values()]]).includes(PASSWORD);

// ── records ───────────────────────────────────────────────────────────────

test('checkPod refuses addresses that would let a pod be spoofed or sniffed', () => {
  const ok = { id: 'home', base: BASE, carriage: 'https' };
  assert.equal(checkPod(ok).base, BASE);
  assert.throws(() => checkPod({ ...ok, base: 'http://pod.example/' }), /https/);
  assert.equal(checkPod({ ...ok, base: 'http://127.0.0.1:8787/' }).base, 'http://127.0.0.1:8787/');
  assert.throws(() => checkPod({ ...ok, base: 'https://pod.example/x' }), /end with/);
  assert.throws(() => checkPod({ ...ok, id: '../x' }), /id/);
  assert.throws(() => checkPod({ ...ok, carriage: 'ftp' }), /carriage/);
  const x = { ...ok, carriage: 'xmpp', relay: { url: 'ws://relay.example/ws', domain: 'd', username: 'u' }, podJid: 'pod@d/lws' };
  assert.throws(() => checkPod(x), /wss/);
  assert.ok(checkPod({ ...x, relay: { ...x.relay, url: 'ws://127.0.0.1:5280/ws' } }));
  assert.throws(() => checkPod({ ...x, relay: { ...x.relay, url: 'wss://r/ws' }, podJid: 'nope' }), /podJid/);
});

test('records persist without the password; the password stays in FoafSecrets', () => {
  const r = rig();
  const stored = JSON.parse(r.saved.get('foafos.pods'));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, 'home');
  assert.equal(r.pods.get('home').hasPassword, true);
  assert.ok(r.secrets.has(POD_OWNER, 'pod.home.password'));
  assert.equal(leaks(r), false);
  // A second shell on the same storage sees the pod, not the password.
  const again = new FoafPods({ secrets: new FoafSecrets(), storage: r.local });
  assert.equal(again.get('home').carriage, 'xmpp');
  assert.equal(again.get('home').hasPassword, false);
});

// ── connections ─────────────────────────────────────────────────────────

test('connect over XMPP logs in with the held password and probes the storage', async () => {
  const r = rig();
  const p = await r.pods.connect('home');
  assert.equal(p.status, 'online');
  assert.equal(r.logins.length, 1);
  assert.equal(r.logins[0].username, 'me');
  assert.deepEqual(r.storage.calls[0], { url: BASE, method: 'HEAD', headers: {} });
  assert.equal(leaks(r), false);
  await r.pods.disconnect('home');
  assert.equal(r.pods.status('home'), 'offline');
});

test('a failed login is an error status whose text carries no password', async () => {
  const r = rig({ loginFails: true });
  const p = await r.pods.connect('home');
  assert.equal(p.status, 'error');
  assert.match(p.detail, /could not log in/);
  assert.equal(leaks(r), false);
});

test('no password set: the pod says so instead of trying', async () => {
  const r = rig();
  r.secrets.forget(POD_OWNER, 'pod.home.password');
  const p = await r.pods.connect('home');
  assert.equal(p.status, 'error');
  assert.match(p.detail, /no password/);
  assert.equal(r.logins.length, 0);
});

test('an offline pod (504 from the carriage) is reported as offline, not online', async () => {
  const r = rig({ storageImpl: { fetch: async () => new Response(null, { status: 504 }), calls: [] } });
  assert.equal((await r.pods.connect('home')).status, 'error');
  assert.match(r.pods.get('home').detail, /offline/);
});

// ── the app verbs ───────────────────────────────────────────────────────

async function granted(opts) {
  const r = rig(opts);
  await r.pods.connect('home');
  r.pods.grant('notes', { 'pod:read': { pod: 'home' }, 'pod:write': { pod: 'home' } });
  r.pods.grant('reader', { 'pod:read': { pod: 'home', prefix: 'apps/notes/' } });
  return r;
}

test('put then get then list then delete, inside apps/<appId>/', async () => {
  const r = await granted();
  const put = await r.pods.invoke('notes', 'pod.put', { path: 'today.json', body: '{"a":1}', contentType: 'application/json' });
  assert.equal(put.ok, true);
  assert.equal(put.status, 201);
  // The parent containers were made top down.
  assert.ok(r.storage.res.get('/apps/').container && r.storage.res.get('/apps/notes/').container);
  const got = await r.pods.invoke('notes', 'pod.get', { path: 'today.json' });
  assert.deepEqual([got.ok, got.body, got.etag], [true, '{"a":1}', put.etag]);
  const ls = await r.pods.invoke('notes', 'pod.list', { path: '' });
  assert.deepEqual(ls.items, [{ path: 'today.json', container: false }]);
  // Nothing an app receives names the pod.
  assert.ok(!JSON.stringify([put, got, ls]).includes('pod.example'));
  assert.equal((await r.pods.invoke('notes', 'pod.delete', { path: 'today.json' })).status, 204);
});

test('If-Match conflicts come back as conflict, and If-None-Match guards a create', async () => {
  const r = await granted();
  const first = await r.pods.invoke('notes', 'pod.put', { path: 'x.json', body: '1', ifNoneMatch: true });
  assert.equal(first.ok, true);
  const again = await r.pods.invoke('notes', 'pod.put', { path: 'x.json', body: '2', ifNoneMatch: true });
  assert.deepEqual([again.ok, again.reason, again.status], [false, 'conflict', 412]);
  const stale = await r.pods.invoke('notes', 'pod.put', { path: 'x.json', body: '3', etag: '"old"' });
  assert.equal(stale.reason, 'conflict');
  const fresh = await r.pods.invoke('notes', 'pod.put', { path: 'x.json', body: '4', etag: first.etag });
  assert.equal(fresh.ok, true);
});

test('an app cannot leave its prefix: traversal, absolute IRIs and other apps are refused before any fetch', async () => {
  const r = await granted();
  const before = r.storage.calls.length;
  for (const path of ['../other/x', 'a/../../x', '..', 'https://evil.example/x', '/../x']) {
    const out = await r.pods.invoke('notes', 'pod.put', { path, body: 'x' });
    // An absolute IRI is not traversal: it becomes a path INSIDE the prefix, which is harmless.
    if (path.startsWith('https:')) { assert.equal(out.ok, true); continue; }
    assert.equal(out.reason, 'bad-params', path);
  }
  assert.ok(r.storage.calls.slice(before).every((c) => c.url.startsWith(BASE + 'apps/notes/') || c.url === BASE + 'apps/'));
});

test('capabilities are checked per verb; a reader cannot write; unknown verbs and apps are refused', async () => {
  const r = await granted();
  assert.equal((await r.pods.invoke('reader', 'pod.put', { path: 'x', body: 'x' })).reason, 'denied');
  assert.equal((await r.pods.invoke('reader', 'pod.delete', { path: 'x' })).reason, 'denied');
  assert.equal((await r.pods.invoke('stranger', 'pod.get', { path: 'x' })).reason, 'denied');
  assert.equal((await r.pods.invoke('notes', 'pod.chmod', { path: 'x' })).reason, 'unknown-verb');
  // The reader's grant names the notes prefix, so it reads what notes wrote.
  await r.pods.invoke('notes', 'pod.put', { path: 'shared.txt', body: 'hello' });
  assert.equal((await r.pods.invoke('reader', 'pod.get', { path: 'shared.txt' })).body, 'hello');
});

test('a pod that is not connected refuses instead of queuing; a removed pod takes its grants with it', async () => {
  const r = await granted();
  await r.pods.disconnect('home');
  assert.equal((await r.pods.invoke('notes', 'pod.get', { path: 'x' })).reason, 'offline');
  await r.pods.remove('home');
  assert.equal(r.pods.scopeFor('notes', 'pod:read'), null);
  assert.equal(r.secrets.has(POD_OWNER, 'pod.home.password'), false);
});

test('grants are checked when given: unknown pod, unknown capability, dirty prefix', () => {
  const r = rig();
  assert.throws(() => r.pods.grant('a', { 'pod:read': { pod: 'nope' } }), /no known pod/);
  assert.throws(() => r.pods.grant('a', { 'pod:admin': { pod: 'home' } }), /unknown capability/);
  assert.throws(() => r.pods.grant('a', { 'pod:read': { pod: 'home', prefix: '../x' } }), /clean path/);
  r.pods.grant('a', { 'pod:read': { pod: 'home' } });
  assert.equal(r.pods.scopeFor('a', 'pod:read').prefix, 'apps/a/');
});

test('throttle, size limit, and non-text reads', async () => {
  const r = await granted();
  r.pods.perMinute = 2;
  await r.pods.invoke('notes', 'pod.list', {});
  await r.pods.invoke('notes', 'pod.list', {});
  assert.equal((await r.pods.invoke('notes', 'pod.list', {})).reason, 'throttled');
  r.pods.perMinute = 100;
  assert.equal((await r.pods.invoke('notes', 'pod.put', { path: 'big', body: 'x'.repeat(1024 * 1024 + 1) })).reason, 'too-large');
  await r.pods.invoke('notes', 'pod.put', { path: 'b.bin', body: 'x', contentType: 'application/octet-stream' });
  assert.equal((await r.pods.invoke('notes', 'pod.get', { path: 'b.bin' })).reason, 'not-text');
});

test('the audit names verb, path and status, and never a body or the password', async () => {
  const r = await granted();
  await r.pods.invoke('notes', 'pod.put', { path: 'secret-diary.txt', body: 'BODY_TEXT_NOT_FOR_THE_BUS' });
  const topics = r.bus.seen.map((s) => s.topic);
  assert.ok(topics.includes('pods.invoke') && topics.includes('pods.done'));
  assert.ok(JSON.stringify(r.bus.seen).includes('apps/notes/secret-diary.txt'));
  assert.ok(!JSON.stringify(r.bus.seen).includes('BODY_TEXT_NOT_FOR_THE_BUS'));
  assert.equal(leaks(r), false);
});

test('carriage https uses the injected fetch directly', async () => {
  const r = rig({ carriage: 'https' });
  assert.equal((await r.pods.connect('home')).status, 'online');
  assert.equal(r.logins.length, 0);
});

// ── the built-in pod (carriage 'builtin') ─────────────────────────────────

/** A shell's pieces for the built-in pod: a fake engine (fakeStorage, sealed "snapshots" that
 *  record the key they were made with) and an in-memory snapshot store. */
function builtinRig({ saved = new Map(), snaps = new Map(), sealedSecrets = null } = {}) {
  const listeners = new Map();
  const bus = {
    seen: [],
    publish(topic, data) { this.seen.push({ topic, data }); for (const f of listeners.get(topic) || []) f(data); },
    subscribe(topic, f) { listeners.set(topic, [...(listeners.get(topic) || []), f]); return () => {}; },
  };
  const local = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v), removeItem: (k) => saved.delete(k) };
  const secrets = new FoafSecrets({ bus, storage: local });
  const opens = [];
  const openBuiltin = async ({ storageKey, snapshot, onSnapshot }) => {
    if (snapshot && snapshot.key !== storageKey) throw new Error('sealed under another key');
    const store = fakeStorage(BUILTIN_BASE);
    if (snapshot) for (const [k, v] of snapshot.res) store.res.set(k, v);
    opens.push({ storageKey, snapshot });
    const fetch = async (url, init) => {
      const r = await store.fetch(url, init);
      if (['PUT', 'DELETE'].includes((init?.method || 'GET').toUpperCase())) onSnapshot({ key: storageKey, res: [...store.res] });
      return r;
    };
    return { fetch, close() {}, snapshot: () => ({ key: storageKey, res: [...store.res] }) };
  };
  const snapshots = { get: async (id) => snaps.get(id), put: async (id, s) => { snaps.set(id, s); } };
  const pods = new FoafPods({ secrets, bus, storage: local, openBuiltin, snapshots });
  return { pods, secrets, bus, saved, snaps, opens, local };
}
const write = { 'pod:read': { pod: 'browser' }, 'pod:write': { pod: 'browser' } };
const settle = () => new Promise((r) => setTimeout(r, 0));

test('a new shell starts with the built-in pod, chosen for apps; after REMOVE it does not come back', async () => {
  const r = builtinRig();
  assert.equal(r.pods.appsPod(), 'browser');
  assert.equal(r.pods.get('browser').carriage, 'builtin');
  assert.equal(r.pods.get('browser').kept, 'run');
  await r.pods.remove('browser');
  const again = builtinRig({ saved: r.saved });
  assert.equal(again.pods.list().length, 0);
  // A shell with no built-in engine adds nothing.
  assert.equal(new FoafPods({ secrets: new FoafSecrets(), storage: { getItem: () => null, setItem() {} } }).list().length, 0);
});

test('the built-in pod opens on first use, with a new key held as a secret', async () => {
  const r = builtinRig();
  r.pods.grant('podnotes', write);
  assert.equal(r.pods.status('browser'), 'offline');
  const put = await r.pods.invoke('podnotes', 'pod.put', { path: 'notes/a.txt', body: 'hello' });
  assert.equal(put.ok, true, JSON.stringify(put));
  assert.equal(r.pods.status('browser'), 'online');
  assert.equal(r.opens.length, 1);
  assert.match(r.opens[0].storageKey, /^[0-9a-f]{64}$/);
  assert.ok(r.secrets.has(POD_OWNER, 'pod.browser.key'));
  const got = await r.pods.invoke('podnotes', 'pod.get', { path: 'notes/a.txt' });
  assert.equal(got.body, 'hello');
  // Not sealed: nothing is written out, and the key appears in no log or record.
  await settle();
  assert.equal(r.snaps.size, 0);
  const key = r.opens[0].storageKey;
  assert.ok(!JSON.stringify([r.bus.seen, r.pods.audit, r.pods.list(), [...r.saved.values()]]).includes(key));
});

test('sealed: each change is kept; a reload opens the same notes after UNLOCK', async () => {
  const r = builtinRig();
  r.pods.grant('podnotes', write);
  await r.pods.invoke('podnotes', 'pod.put', { path: 'notes/a.txt', body: 'first' });
  await r.secrets.seal('correct horse');           // what SAVE in the session bar does
  await settle();
  assert.equal(r.snaps.size, 1, 'sealing writes what is held now');
  assert.equal(r.pods.get('browser').kept, 'sealed');
  await r.pods.invoke('podnotes', 'pod.put', { path: 'notes/b.txt', body: 'second' });
  await settle();

  // A reload: the pod list, the sealed secrets and the snapshot are on the device.
  const b = builtinRig({ saved: r.saved, snaps: r.snaps });
  b.pods.grant('podnotes', write);
  const before = await b.pods.invoke('podnotes', 'pod.get', { path: 'notes/b.txt' });
  assert.equal(before.ok, false);
  assert.equal(before.reason, 'locked');
  assert.equal(b.pods.status('browser'), 'locked');
  assert.equal(b.opens.length, 0, 'nothing is opened, and nothing overwritten, without the key');
  await b.secrets.unseal('correct horse');
  await settle(); await settle();
  assert.equal(b.pods.status('browser'), 'online');
  assert.equal((await b.pods.invoke('podnotes', 'pod.get', { path: 'notes/b.txt' })).body, 'second');
});

test('a snapshot with no key on the device is an error, and is left as it is', async () => {
  const snaps = new Map([['browser', { key: 'f'.repeat(64), res: [] }]]);
  const r = builtinRig({ snaps });
  r.pods.grant('podnotes', write);
  const got = await r.pods.invoke('podnotes', 'pod.list', { path: 'notes/' });
  assert.equal(got.ok, false);
  assert.equal(r.pods.status('browser'), 'error');
  assert.equal(r.snaps.get('browser').key, 'f'.repeat(64));
  assert.equal(r.opens.length, 0);
});

test('an https pod with a bearer token sends it, and apps never see it', async () => {
  const seen = [];
  const fetchImpl = async (url, init = {}) => { seen.push({ method: init.method || 'GET', auth: new Headers(init.headers).get('authorization') }); return new Response(init.method === 'HEAD' ? null : 'body', { status: 200, headers: { 'Content-Type': 'text/plain', ETag: '"1"' } }); };
  const events = [];
  const bus = { publish: (t, d) => events.push(JSON.stringify(d)) };
  const pods = new FoafPods({ secrets: new FoafSecrets({ bus }), bus, storage: null, fetchImpl });
  pods.add({ id: 'cloud', label: 'C', base: 'https://pod.example/', carriage: 'https', auth: 'bearer' }, { password: 's3cret-token' });
  assert.equal(pods.get('cloud').hasPassword, true);
  await pods.connect('cloud');
  assert.equal(pods.status('cloud'), 'online');
  pods.grant('app', { 'pod:read': { pod: 'cloud' } });
  const r = await pods.invoke('app', 'pod.get', { path: 'a.txt' });
  assert.equal(r.body, 'body');
  assert.ok(seen.length >= 2 && seen.every((s) => s.auth === 'Bearer s3cret-token'), JSON.stringify(seen));
  assert.doesNotMatch(JSON.stringify(r) + events.join() + JSON.stringify(pods.list()), /s3cret-token/);
});

test('an https pod that refuses its token, or has none, says so', async () => {
  const fetchImpl = async () => new Response(null, { status: 401 });
  const pods = new FoafPods({ secrets: new FoafSecrets(), storage: null, fetchImpl });
  pods.add({ id: 'a', label: 'A', base: 'https://a.example/', carriage: 'https', auth: 'bearer' }, { password: 'bad' });
  await pods.connect('a');
  assert.equal(pods.status('a'), 'error');
  assert.match(pods.get('a').detail, /refused the access token/);
  pods.add({ id: 'b', label: 'B', base: 'https://b.example/', carriage: 'https', auth: 'bearer' });
  await pods.connect('b');
  assert.match(pods.get('b').detail, /no access token/);
  assert.throws(() => pods.add({ id: 'c', base: 'https://c.example/', carriage: 'https', auth: 'basic' }), /auth/);
});
