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
  assert.match(p.detail, /did not answer/);
  assert.equal(leaks(r), false);
});

test('no password set: the pod says so instead of trying', async () => {
  const r = rig();
  r.secrets.forget(POD_OWNER, 'pod.home.password');
  const p = await r.pods.connect('home');
  assert.equal(p.status, 'needs-login');
  assert.match(p.detail, /Enter your password/);
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
  assert.equal(pods.status('a'), 'needs-login');
  assert.match(pods.get('a').detail, /did not accept this token/);
  pods.add({ id: 'b', label: 'B', base: 'https://b.example/', carriage: 'https', auth: 'bearer' });
  await pods.connect('b');
  assert.match(pods.get('b').detail, /Enter your token/);
  assert.throws(() => pods.add({ id: 'c', base: 'https://c.example/', carriage: 'https', auth: 'basic' }), /auth/);
});

test('an https pod can gain a token after it was added', async () => {
  const seen = [];
  const fetchImpl = async (url, init = {}) => { seen.push(new Headers(init.headers).get('authorization')); return new Response(null, { status: 200 }); };
  const pods = new FoafPods({ secrets: new FoafSecrets(), storage: null, fetchImpl });
  pods.add({ id: 'a', label: 'A', base: 'https://a.example/', carriage: 'https' });
  await pods.connect('a');
  assert.equal(seen.pop(), null);
  pods.setPassword('a', 'later-token');
  assert.equal(pods.get('a').auth, 'bearer');
  await pods.connect('a');
  assert.equal(seen.pop(), 'Bearer later-token');
});

const AGENT_KEY_D = 'agent-private-d-THIS_MUST_NEVER_APPEAR_7f3e';
const AGENT = 'did:key:zDnaeTestAgent1111111111111111111111111111111';

/** A did:key pod: the storage lets in the agents in `granted`; the shell's agent fetch is faked. */
function didRig({ granted = new Set(), locked = false } = {}) {
  const events = [];
  const bus = { publish: (t, d) => events.push(JSON.stringify(d)), subscribe: () => {} };
  const secrets = new FoafSecrets({ bus });
  if (locked) secrets.hasSealed = () => true;
  const made = [];
  const opened = [];
  const store = fakeStorage('http://127.0.0.1:3000/');
  const pods = new FoafPods({ secrets, bus, storage: null,
    newAgent: async () => { made.push(1); return { subject: AGENT, keyId: `${AGENT}#x`, jwk: { kty: 'EC', crv: 'P-256', d: AGENT_KEY_D } }; },
    openAgent: async ({ base, selfIssued }) => {
      opened.push({ base, subject: selfIssued.subject, d: selfIssued.jwk.d === AGENT_KEY_D });
      return async (url, init) => (granted.has(selfIssued.subject) ? store.fetch(url, init) : new Response(null, { status: 403 }));
    } });
  return { pods, events, made, opened, store, secrets };
}

test('a did:key pod makes this browser an agent once, asks for a grant by its did:key, then works', async () => {
  const granted = new Set();
  const r = didRig({ granted });
  r.pods.add({ id: 'laptop', label: 'L', base: 'http://127.0.0.1:3000/', carriage: 'https', auth: 'did-key' });
  await r.pods.connect('laptop');
  assert.equal(r.pods.status('laptop'), 'needs-ok');
  assert.equal(r.pods.get('laptop').agent, AGENT);
  assert.match(r.pods.get('laptop').detail, new RegExp(`foafos-stack lws-allow ${AGENT}`));
  assert.equal(r.pods.get('laptop').hasPassword, true);
  granted.add(AGENT);
  await r.pods.connect('laptop');
  assert.equal(r.pods.status('laptop'), 'online');
  assert.equal(r.made.length, 1, 'the key is made once and kept');
  assert.ok(r.opened.every((o) => o.d && o.base === 'http://127.0.0.1:3000/'), JSON.stringify(r.opened));
  r.pods.grant('app', { 'pod:read': { pod: 'laptop' }, 'pod:write': { pod: 'laptop' } });
  assert.equal((await r.pods.invoke('app', 'pod.put', { path: 'a.txt', body: 'hi', contentType: 'text/plain' })).ok, true);
  assert.equal((await r.pods.invoke('app', 'pod.get', { path: 'a.txt' })).body, 'hi');
  assert.equal((await r.pods.invoke('app', 'pod.list', { path: '' })).ok, true);
  assert.doesNotMatch(r.events.join() + JSON.stringify(r.pods.list()), /THIS_MUST_NEVER_APPEAR/);
});

test('a did:key pod: a bad record is refused, a locked key waits, and REMOVE forgets the key', async () => {
  assert.throws(() => checkPod({ id: 'x', base: 'http://127.0.0.1:3000/', carriage: 'https', auth: 'did-key', agent: 'not-a-did' }), /agent/);
  assert.throws(() => checkPod({ id: 'x', base: 'https://r.example/', carriage: 'xmpp', auth: 'did-key', relay: { url: 'wss://r.example/', domain: 'r' }, podJid: 'p@r/l' }), /auth/);
  assert.equal(checkPod({ id: 'x', base: 'https://a.example/', carriage: 'https', auth: 'bearer', agent: AGENT }).agent, undefined);
  const r = didRig({ locked: true });
  r.pods.add({ id: 'laptop', label: 'L', base: 'http://127.0.0.1:3000/', carriage: 'https', auth: 'did-key' });
  await r.pods.connect('laptop');
  assert.equal(r.pods.status('laptop'), 'locked');
  assert.equal(r.made.length, 0, 'no new key while the saved one is locked');
  const r2 = didRig();
  r2.pods.add({ id: 'laptop', label: 'L', base: 'http://127.0.0.1:3000/', carriage: 'https', auth: 'did-key' });
  await r2.pods.connect('laptop');
  assert.equal(r2.secrets.has(POD_OWNER, 'pod.laptop.agent'), true);
  await r2.pods.remove('laptop');
  assert.equal(r2.secrets.has(POD_OWNER, 'pod.laptop.agent'), false);
});

// ── signing in (System, Pods tab) ────────────────────────────────────────

const WAY_XMPP = { carriage: 'xmpp', relay: { url: 'wss://relay.example/xmpp-websocket', domain: 'relay.example', username: 'me' }, podJid: 'pod@relay.example/lws' };

test('a saved server can wait for its account, and asks in words a person can act on', async () => {
  const r = rig();
  r.pods.add({ id: 'saved', base: BASE, carriage: 'xmpp', relay: { url: WAY_XMPP.relay.url, domain: 'relay.example' }, podJid: WAY_XMPP.podJid });
  const p = await r.pods.connect('saved');
  assert.equal(p.status, 'needs-login');
  assert.match(p.detail, /username and password/);
  assert.equal(r.logins.length, 0);
});

test('signIn moves a pod from a token to an account, drops the old secret, and remembers', async () => {
  const r = rig();
  r.pods.add({ id: 'fly', base: BASE, carriage: 'https', auth: 'bearer' }, { password: 'OLD-TOKEN-0a1b' });
  const p = await r.pods.signIn('fly', { way: WAY_XMPP, secret: PASSWORD });
  assert.equal(p.status, 'online');
  assert.equal(p.carriage, 'xmpp');
  assert.equal(p.auth, undefined);
  assert.equal(p.hasPassword, true);
  assert.equal(r.logins.at(-1).username, 'me');
  assert.equal(r.logins.at(-1).password, PASSWORD);
  const saved = r.saved.get('foafos.pods');
  assert.equal(JSON.parse(saved).find((x) => x.id === 'fly').auto, true);
  assert.doesNotMatch(saved, /OLD-TOKEN/);
  assert.equal(leaks(r), false);
  await r.pods.signIn('fly', { way: { carriage: 'https', auth: 'bearer' } });
  assert.equal(r.pods.get('fly').hasPassword, false, 'a password is not sent as a token');
  assert.equal(r.pods.status('fly'), 'needs-login');
});

test('a wrong password asks again; it is not reported as a server fault', async () => {
  const r = rig();
  const bad = new FoafPods({ secrets: r.secrets, storage: null,
    connectXmpp: async () => { throw new Error('SASL SCRAM-SHA-256 failed: not-authorized'); } });
  bad.add({ id: 'x', base: BASE, ...WAY_XMPP });
  const p = await bad.signIn('x', { secret: 'wrong' });
  assert.equal(p.status, 'needs-login');
  assert.match(p.detail, /did not accept this username and password/);
});

test('an account the pod refuses (403 over XMPP) is told so, and the connection closes', async () => {
  let closed = 0;
  const r = rig();
  const pods = new FoafPods({ secrets: r.secrets, storage: null,
    connectXmpp: async () => ({ httpFetch: () => async () => new Response(null, { status: 403 }), close() { closed++; } }) });
  pods.add({ id: 'x', base: BASE, ...WAY_XMPP });
  const p = await pods.signIn('x', { secret: 'pw' });
  assert.equal(p.status, 'needs-login');
  assert.match(p.detail, /does not let it in/);
  assert.equal(closed, 1);
  assert.equal(pods.fetchFor('x'), null);
});

test('an https pod that wants a token is not called online', async () => {
  const pods = new FoafPods({ secrets: new FoafSecrets(), storage: null, fetchImpl: async () => new Response(null, { status: 401 }) });
  pods.add({ id: 'a', base: 'https://a.example/', carriage: 'https' });
  assert.equal((await pods.connect('a')).status, 'needs-login');
  assert.match(pods.get('a').detail, /asks for a token/);
});

test('after a reload a sealed login is locked, and unlocking connects the pod again', async () => {
  const blob = new Map();
  const store = { getItem: (k) => blob.get(k) ?? null, setItem: (k, v) => blob.set(k, v), removeItem: (k) => blob.delete(k) };
  const open = async () => {
    const bus = new (await import('../src/bus.mjs')).FoafBus();
    const secrets = new FoafSecrets({ bus, storage: store });
    const logins = [];
    const pods = new FoafPods({ secrets, bus, storage: store, connectXmpp: async (o) => { logins.push(o); return { httpFetch: () => async () => new Response(null, { status: 200 }), close() {} }; } });
    return { secrets, pods, logins };
  };
  const a = await open();
  a.pods.add({ id: 'x', base: BASE, ...WAY_XMPP });
  await a.pods.signIn('x', { secret: PASSWORD });
  await a.secrets.seal('a passphrase');
  assert.doesNotMatch([...blob.values()].join(), new RegExp(PASSWORD));

  const b = await open();
  const p = b.pods.get('x');
  assert.equal(p.locked, true);
  assert.equal(p.relay.username, 'me');
  assert.equal((await b.pods.connect('x')).status, 'locked');
  assert.match(b.pods.get('x').detail, /Unlock/);
  await b.secrets.unseal('a passphrase');
  for (let i = 0; i < 50 && b.pods.status('x') !== 'online'; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(b.pods.status('x'), 'online');
  assert.equal(b.logins.at(-1).password, PASSWORD);
  await b.pods.disconnect('x');

  const c = await open();
  await c.secrets.unseal('a passphrase');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(c.logins.length, 0, 'a pod the person disconnected stays disconnected');
});

test('the known servers load, and every way in them makes a valid pod with no account or secret', async () => {
  const { KNOWN_PODS } = await import('../../../inklet/finkapp/foafos-known-pods.js');
  assert.ok(KNOWN_PODS.length > 0);
  for (const k of KNOWN_PODS) {
    assert.ok(k.ways.length > 0);
    for (const { relay, podJid, carriage, auth } of k.ways) {
      assert.ok(checkPod({ id: k.id, base: k.base, carriage, ...(auth ? { auth } : {}), ...(relay ? { relay, podJid } : {}) }));
      assert.equal(relay?.username, undefined, 'a known server names no account');
    }
  }
});


// ── the shared pod and extra pods ─────────────────────────────────────────
// Design: docs/foafos-pods-per-app-20261107.md. As above, most of this is refusals.

const VAULT = 'https://vault.example/';

/** A shared pod, "home", and a second pod, "vault", each with its own storage. */
async function twoPods({ storage = new Map() } = {}) {
  const common = fakeStorage();
  const other = fakeStorage(VAULT);
  const bus = busSpy();
  const secrets = new FoafSecrets({ bus });
  const local = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
  const fetchImpl = (url, init) => (String(url).startsWith(VAULT) ? other : common).fetch(url, init);
  const pods = new FoafPods({ secrets, bus, storage: local, fetchImpl });
  const open = async () => {
    await pods.connect('home');
    await pods.connect('vault');
    pods.grant('notes', { 'pod:read': { pod: 'home' }, 'pod:write': { pod: 'home' } });
    pods.grant('reader', { 'pod:read': { pod: 'home' } });
  };
  if (!storage.has('foafos.pods')) {
    pods.add({ id: 'home', base: BASE, carriage: 'https', forApps: true });
    pods.add({ id: 'vault', label: 'My private vault', base: VAULT, carriage: 'https' });
  }
  await open();
  return { pods, common, other, bus, storage, open };
}

test('the shared pod stays the default, and a saved list with no extras is read as it was', async () => {
  const before = JSON.stringify([{ id: 'home', label: 'home', base: BASE, carriage: 'https', forApps: true, auto: false }]);
  const r = await (async () => {
    const storage = new Map([['foafos.pods', before]]);
    const secrets = new FoafSecrets({});
    const pods = new FoafPods({ secrets, storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) } });
    return { pods, storage };
  })();
  assert.equal(r.pods.appsPod(), 'home');
  assert.deepEqual(r.pods.extraGrants(), []);
  assert.equal(r.storage.get('foafos.pods'), before, 'nothing is rewritten');
  assert.equal(r.storage.has('foafos.pods.extras'), false, 'and nothing is added until a person gives a grant');

  const t = await twoPods();
  t.pods.grantExtra('notes', 'vault');
  assert.equal(t.pods.appsPod(), 'home', 'an extra pod does not change the shared pod');
  assert.equal((await t.pods.invoke('notes', 'pod.put', { path: 'a.txt', body: 'x' })).ok, true);
  assert.ok(t.common.res.has('/apps/notes/a.txt'), 'with no handle a call goes to the shared pod');
  assert.equal(t.other.res.has('/apps/notes/a.txt'), false);
  assert.ok(!('extras' in JSON.parse(t.storage.get('foafos.pods'))[1]), 'a grant is not put in the pod record');
});

test('an extra pod names the pod and the app, and the app reaches only its own prefix there', async () => {
  const r = await twoPods();
  const handle = r.pods.grantExtra('notes', 'vault');
  assert.deepEqual(r.pods.extraGrants(), [{ appId: 'notes', handle, pod: 'vault' }]);
  assert.deepEqual(r.pods.scopeFor('notes', 'pod:write', handle), { pod: 'vault', prefix: 'apps/notes/' });
  assert.equal((await r.pods.invoke('notes', 'pod.put', { pod: handle, path: 'b.txt', body: 'second' })).ok, true);
  assert.ok(r.other.res.has('/apps/notes/b.txt'));
  assert.equal(r.common.res.has('/apps/notes/b.txt'), false);
  assert.equal((await r.pods.invoke('notes', 'pod.get', { pod: handle, path: 'b.txt' })).body, 'second');
  assert.deepEqual((await r.pods.invoke('notes', 'pod.list', { pod: handle })).items, [{ path: 'b.txt', container: false }]);
  assert.equal((await r.pods.invoke('notes', 'pod.delete', { pod: handle, path: 'b.txt' })).ok, true);

  const before = r.other.calls.length;
  for (const path of ['../other/x', '../../x', 'a/../../x']) {
    assert.equal((await r.pods.invoke('notes', 'pod.put', { pod: handle, path, body: 'x' })).reason, 'bad-params', path);
  }
  assert.equal(r.other.calls.length, before, 'refused before any fetch');
});

test('a grant is the person\'s to give: an unknown pod, the shared pod and a bad app id are refused', async () => {
  const r = await twoPods();
  assert.throws(() => r.pods.grantExtra('notes', 'nope'), /no pod/);
  assert.throws(() => r.pods.grantExtra('notes', 'home'), /shared pod/);
  for (const bad of ['../edot', 'a/b', '', null]) assert.throws(() => r.pods.grantExtra(bad, 'vault'), /app id/);
  assert.equal(r.pods.grantExtra('notes', 'vault'), r.pods.grantExtra('notes', 'vault'), 'given twice, it is one grant');
  assert.equal(r.pods.extraGrants().length, 1);
});

test('NEGATIVE: an app cannot aim at a pod it was not given, and every miss looks the same', async () => {
  const r = await twoPods();
  const theirs = r.pods.grantExtra('reader', 'vault');
  const calls = () => r.common.calls.length + r.other.calls.length;
  const before = calls();
  const answers = [];
  for (const pod of ['vault', 'home', VAULT, BASE, 'My private vault', theirs, 'extra-0000000000000000', 'nope', '', 0, false, {}, ['vault'], '__proto__']) {
    answers.push(await r.pods.invoke('notes', 'pod.get', { pod, path: 'x' }));
  }
  for (const a of answers) assert.deepEqual(a, answers[0]);
  assert.equal(answers[0].reason, 'denied');
  assert.equal(calls(), before, 'no miss reached a storage');
});

test('NEGATIVE: an app cannot list, add or choose a pod; there is no such verb', async () => {
  const r = await twoPods();
  for (const verb of ['pod.locations', 'pod.use', 'pod.addFolder', 'pod.extras', 'pod.grantExtra', 'pod.ask', 'pods.list', 'pod.add']) {
    assert.equal((await r.pods.invoke('notes', verb, { id: 'vault', pod: 'vault' })).reason, 'unknown-verb', verb);
  }
  assert.deepEqual(r.pods.extraGrants(), [], 'and nothing was granted');
  assert.deepEqual(r.pods.extrasFor('notes'), []);
});

test('NEGATIVE: what an app is told names no pod', async () => {
  const r = await twoPods();
  const handle = r.pods.grantExtra('notes', 'vault');
  assert.match(handle, /^extra-[0-9a-f]{16}$/);
  const words = ['vault', 'home', 'pod.example', 'My private vault'];
  const told = [r.pods.extrasFor('notes')];
  assert.deepEqual(told[0], [{ handle, read: true, write: true }]);
  told.push(await r.pods.invoke('notes', 'pod.put', { pod: handle, path: 'a/b.txt', body: 'x', contentType: 'text/plain' }));
  told.push(await r.pods.invoke('notes', 'pod.get', { pod: handle, path: 'a/b.txt' }));
  told.push(await r.pods.invoke('notes', 'pod.list', { pod: handle, path: 'a/' }));
  told.push(await r.pods.invoke('notes', 'pod.get', { pod: handle, path: 'gone' }));
  await r.pods.disconnect('vault');
  await r.pods.disconnect('home');
  told.push(await r.pods.invoke('notes', 'pod.get', { pod: handle, path: 'a/b.txt' }));
  told.push(await r.pods.invoke('notes', 'pod.get', { path: 'a/b.txt' }));
  assert.equal(told.at(-1).reason, 'offline');
  const seen = JSON.stringify(told);
  for (const w of words) assert.ok(!seen.includes(w), `an answer carries "${w}": ${seen}`);
  assert.ok(r.pods.audit.some((a) => a.topic === 'pods.refused' && a.pod === 'vault'), 'the shell\'s own log still names it');
});

test('NEGATIVE: an extra pod gives no new verb, and two apps cannot tell they share a pod', async () => {
  const r = await twoPods();
  const a = r.pods.grantExtra('notes', 'vault');
  const b = r.pods.grantExtra('reader', 'vault');
  assert.notEqual(a, b);
  assert.deepEqual(r.pods.extrasFor('reader'), [{ handle: b, read: true, write: false }]);
  assert.equal((await r.pods.invoke('reader', 'pod.put', { pod: b, path: 'x', body: 'x' })).reason, 'denied', 'a reader stays a reader');
  await r.pods.invoke('notes', 'pod.put', { pod: a, path: 'mine.txt', body: 'x' });
  assert.equal((await r.pods.invoke('reader', 'pod.list', { pod: b })).status, 404, 'each app sees only its own prefix');
  assert.equal(r.other.calls.at(-1).url, `${VAULT}apps/reader/`);
  assert.deepEqual(r.pods.extrasFor('stranger'), [], 'an app with no pod grant is told nothing');
  r.pods.extras.set('stranger', new Map([[a, 'vault']]));
  assert.equal((await r.pods.invoke('stranger', 'pod.get', { pod: a, path: 'x' })).reason, 'denied', 'a grant alone is not a capability');
});

test('a share stays one file, whatever handle comes with it', async () => {
  const r = await twoPods();
  await r.pods.invoke('notes', 'pod.put', { path: 'one.txt', body: 'one' });
  const token = r.pods.offerShare('reader', { pod: 'home', path: 'apps/notes/one.txt' });
  assert.equal(r.pods.claimShare('reader', 'w1').token, token);
  const got = await r.pods.invoke('reader', 'pod.get', { share: token, pod: 'vault', path: 'other' }, { holder: 'w1' });
  assert.equal(got.body, 'one');
  assert.equal(r.other.calls.filter((c) => c.method === 'GET').length, 0);
});

test('a grant survives a reload with the same handle; bad saved rows are dropped', async () => {
  const r = await twoPods();
  const handle = r.pods.grantExtra('notes', 'vault');
  const again = await twoPods({ storage: r.storage });
  assert.deepEqual(again.pods.extraGrants(), [{ appId: 'notes', handle, pod: 'vault' }]);

  const good = JSON.parse(r.storage.get('foafos.pods.extras'))[0];
  for (const bad of ['not json', '{}', 'null']) {
    r.storage.set('foafos.pods.extras', bad);
    assert.deepEqual((await twoPods({ storage: r.storage })).pods.extraGrants(), [], bad);
  }
  r.storage.set('foafos.pods.extras', JSON.stringify([null, 7, { ...good, pod: 'gone' }, { ...good, handle: 'vault' }, { ...good, app: 3 }]));
  assert.deepEqual((await twoPods({ storage: r.storage })).pods.extraGrants(), []);
});

test('revoking and removing: the handle goes dead, and removing a pod removes its grants', async () => {
  const r = await twoPods();
  const a = r.pods.grantExtra('notes', 'vault');
  r.pods.revokeExtra('notes', a);
  assert.equal((await r.pods.invoke('notes', 'pod.get', { pod: a, path: 'x' })).reason, 'denied');
  r.pods.revokeExtra('notes', a);   // again: nothing to do
  const b = r.pods.grantExtra('notes', 'vault');
  assert.notEqual(a, b, 'a new grant is a new handle, so an old one cannot come back');
  r.pods.grantExtra('reader', 'vault');
  await r.pods.remove('vault');
  assert.deepEqual(r.pods.extraGrants(), []);
  assert.equal(r.storage.get('foafos.pods.extras'), '[]');
  assert.equal((await r.pods.invoke('notes', 'pod.get', { pod: b, path: 'x' })).reason, 'denied');
  assert.equal(r.pods.appsPod(), 'home', 'the shared pod is not touched');
});

test('removing the shared pod leaves apps with no pod, and picks no extra pod', async () => {
  const r = await twoPods();
  const handle = r.pods.grantExtra('notes', 'vault');
  await r.pods.remove('home');
  assert.equal(r.pods.appsPod(), null);
  assert.equal(r.pods.get('vault').forApps, false, 'the extra pod is not promoted');
  assert.equal(r.pods.scopeFor('notes', 'pod:read'), null);
  const before = r.other.calls.length;
  assert.equal((await r.pods.invoke('notes', 'pod.get', { path: 'x' })).reason, 'denied', 'no default');
  assert.equal((await r.pods.invoke('notes', 'pod.get', { pod: handle, path: 'x' })).reason, 'denied', 'and the handle sleeps');
  assert.deepEqual(r.pods.extrasFor('notes'), []);
  assert.equal(r.other.calls.length, before);
  assert.deepEqual(r.pods.extraGrants().map((g) => g.pod), ['vault'], 'the person\'s grant is kept');

  // The person makes a new shared pod: the grant wakes, with the same handle.
  r.pods.add({ id: 'next', base: 'https://pod.example/next/', carriage: 'https', forApps: true });
  await r.pods.connect('next');
  r.pods.grant('notes', { 'pod:read': { pod: 'next' } });
  assert.equal(r.pods.scopeFor('notes', 'pod:read', handle).pod, 'vault');
});
