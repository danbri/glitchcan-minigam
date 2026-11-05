import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceFetch } from '../src/device-fetch.mjs';
import { describeLocation } from '../src/locations.mjs';
import { FoafPods, checkPod } from '../src/pods.mjs';
import { FoafSecrets } from '../src/secrets.mjs';

const BASE = 'https://device.foafos.local/opfs/';

// A directory handle in memory, with the File System Access API's shape and errors.
const err = (name) => Object.assign(new Error(name), { name });
class Dir {
  kind = 'directory';
  kids = new Map();
  async getDirectoryHandle(n, { create = false } = {}) {
    if (/[/\\]/.test(n) || n === '.' || n === '..') throw new TypeError('bad name');
    let k = this.kids.get(n);
    if (k && k.kind !== 'directory') throw err('TypeMismatchError');
    if (!k) { if (!create) throw err('NotFoundError'); k = new Dir(); this.kids.set(n, k); }
    return k;
  }
  async getFileHandle(n, { create = false } = {}) {
    let k = this.kids.get(n);
    if (k && k.kind !== 'file') throw err('TypeMismatchError');
    if (!k) { if (!create) throw err('NotFoundError'); k = new FileH(); this.kids.set(n, k); }
    return k;
  }
  async removeEntry(n) {
    const k = this.kids.get(n);
    if (!k) throw err('NotFoundError');
    if (k.kind === 'directory' && k.kids.size) throw err('InvalidModificationError');
    this.kids.delete(n);
  }
  async *entries() { yield* this.kids.entries(); }
}
let clock = 1000;
class FileH {
  kind = 'file'; bytes = new Uint8Array(); modified = 0;
  async getFile() { const b = this.bytes, m = this.modified; return { size: b.length, lastModified: m, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; }
  async createWritable() { const f = this; let next = new Uint8Array(); return { write: async (d) => { next = new TextEncoder().encode(String(d)); }, close: async () => { f.bytes = next; f.modified = ++clock; } }; }
}
const setup = () => { const root = new Dir(); return { root, f: deviceFetch(root, BASE) }; };
const put = (f, p, body, headers = {}) => f(BASE + p, { method: 'PUT', body, headers });

test('a file goes in and comes out, with a type and an etag', async () => {
  const { f } = setup();
  await f(BASE + 'notes/', { method: 'PUT' });
  const w = await put(f, 'notes/a.txt', 'héllo');
  assert.equal(w.status, 201);
  const r = await f(BASE + 'notes/a.txt');
  assert.equal(r.status, 200);
  assert.equal(await r.text(), 'héllo');
  assert.equal(r.headers.get('content-type'), 'text/plain');
  assert.equal(r.headers.get('etag'), w.headers.get('etag'));
  assert.equal((await put(f, 'notes/a.txt', 'again')).status, 204);
});

test('a folder lists its contents as a pod does, with names encoded', async () => {
  const { f } = setup();
  await f(BASE + 'sub/', { method: 'PUT' });
  await put(f, 'my file.txt', 'x');
  const r = await f(BASE, { headers: { Accept: 'application/lws+json' } });
  const doc = await r.json();
  assert.deepEqual(doc.items.map((i) => i.id).sort(), [`${BASE}my%20file.txt`, `${BASE}sub/`]);
  assert.equal(doc.items.find((i) => i.id.endsWith('sub/')).type, 'Container');
});

test('nothing outside the root can be named', async () => {
  const { root, f } = setup();
  await put(f, 'inside.txt', 'x');
  for (const p of ['../x', 'a/../../x', '..%2fx', '%2e%2e/x', 'a%2fb', 'a%5cb', '..', '.', 'a//b', '%00', 'a%00b', '%zz']) {
    for (const init of [{}, { method: 'PUT', body: 'evil' }, { method: 'DELETE' }]) {
      const r = await f(BASE + p, init);
      assert.equal(r.status, 400, `${init.method || 'GET'} ${p}`);
    }
  }
  assert.equal((await f('https://elsewhere.example/x')).status, 400);
  assert.equal((await f('https://device.foafos.local/opfs-other/x')).status, 400);
  assert.deepEqual([...root.kids.keys()], ['inside.txt']);
});

test('a stale write or delete is refused, and a create can demand a new file', async () => {
  const { f } = setup();
  const first = (await put(f, 'a.txt', 'one')).headers.get('etag');
  assert.equal((await put(f, 'a.txt', 'two', { 'If-Match': first })).status, 204);
  assert.equal((await put(f, 'a.txt', 'three', { 'If-Match': first })).status, 412);
  assert.equal((await f(BASE + 'a.txt', { method: 'DELETE', headers: { 'If-Match': first } })).status, 412);
  assert.equal((await put(f, 'a.txt', 'x', { 'If-None-Match': '*' })).status, 412);
  assert.equal(await (await f(BASE + 'a.txt')).text(), 'two');
});

test('missing things are 404, a full folder cannot be deleted, and the root cannot be replaced', async () => {
  const { f } = setup();
  assert.equal((await f(BASE + 'nope.txt')).status, 404);
  assert.equal((await f(BASE + 'nope/')).status, 404);
  assert.equal((await f(BASE + 'nope/a.txt')).status, 404);
  assert.equal((await put(f, 'nope/a.txt', 'x')).status, 404);
  await f(BASE + 'd/', { method: 'PUT' });
  await put(f, 'd/a.txt', 'x');
  assert.equal((await f(BASE + 'd/', { method: 'DELETE' })).status, 409);
  assert.equal((await f(BASE, { method: 'DELETE' })).status, 405);
  assert.equal((await f(BASE, { method: 'POST' })).status, 405);
});

test('permission lost while running is 403, not a crash', async () => {
  const root = new Dir();
  root.getFileHandle = async () => { throw err('NotAllowedError'); };
  assert.equal((await deviceFetch(root, BASE)(BASE + 'a.txt')).status, 403);
});

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const secrets = () => new FoafSecrets({ store: memory() });
const devicePods = (openDevice) => {
  const pods = new FoafPods({ secrets: secrets(), storage: memory(), openDevice });
  pods.add({ id: 'device', label: 'This device', base: BASE, carriage: 'device', device: 'opfs' });
  pods.grant('files', { 'pod:read': { pod: 'device', prefix: '' }, 'pod:write': { pod: 'device', prefix: '' } });
  return pods;
};

test('a device pod works through the ordinary pod verbs, and opens on first use', async () => {
  const pods = devicePods(async () => ({ ok: true, root: new Dir() }));
  assert.equal((await pods.invoke('files', 'pod.put', { path: 'a/b.txt', body: 'hi', contentType: 'text/plain' })).ok, true);
  assert.equal((await pods.invoke('files', 'pod.get', { path: 'a/b.txt' })).body, 'hi');
  assert.deepEqual((await pods.invoke('files', 'pod.list', { path: 'a/' })).items, [{ path: 'b.txt', container: false }]);
  assert.equal((await pods.invoke('files', 'pod.delete', { path: 'a/b.txt' })).ok, true);
});

test('a folder needing the person\'s OK says so, and asks only when told it may', async () => {
  const asked = [];
  const pods = devicePods(async (rec, { ask }) => { asked.push(ask); return ask ? { ok: true, root: new Dir() } : { ok: false, status: 'needs-ok', detail: 'allow it' }; });
  assert.equal((await pods.invoke('files', 'pod.list', { path: '' })).reason, 'needs-ok');
  assert.equal(pods.status('device'), 'needs-ok');
  await pods.connect('device', { ask: true });
  assert.equal(pods.status('device'), 'online');
  assert.deepEqual(asked, [false, true]);
});

test('calls made while a location opens wait for it, and it opens once', async () => {
  let opened = 0;
  const pods = devicePods(async () => { opened++; await new Promise((r) => setTimeout(r, 20)); return { ok: true, root: new Dir() }; });
  const all = await Promise.all([1, 2, 3].map(() => pods.invoke('files', 'pod.list', { path: '' })));
  assert.deepEqual(all.map((r) => r.ok), [true, true, true]);
  assert.equal(opened, 1);
});

test('a very large file is refused before it is read', async () => {
  const { root, f } = setup();
  const big = new FileH();
  big.getFile = async () => ({ size: 9 * 1024 * 1024, lastModified: 1, arrayBuffer: async () => { throw new Error('read it'); } });
  root.kids.set('big.txt', big);
  assert.equal((await f(BASE + 'big.txt')).status, 413);
  assert.equal((await f(BASE + 'big.txt', { method: 'HEAD' })).status, 200);
});

test('a folder whose permission ends becomes a question, not a failure', async () => {
  const root = new Dir();
  const pods = devicePods(async () => ({ ok: true, root }));
  assert.equal((await pods.invoke('files', 'pod.list', { path: '' })).ok, true);
  root.getDirectoryHandle = root.getFileHandle = async () => { throw err('NotAllowedError'); };
  root.entries = async function* () { throw err('NotAllowedError'); };
  assert.equal((await pods.invoke('files', 'pod.get', { path: 'a.txt' })).reason, 'needs-ok');
  assert.equal(pods.status('device'), 'needs-ok');
});

test('a shell with no device support says so', async () => {
  const pods = devicePods(null);
  await pods.connect('device');
  assert.equal(pods.status('device'), 'error');
});

test('a device pod must say which kind it is', () => {
  assert.throws(() => checkPod({ id: 'x', base: BASE, carriage: 'device' }), /device/);
  assert.equal(checkPod({ id: 'x', base: BASE, carriage: 'device', device: 'folder' }).device, 'folder');
  assert.equal(checkPod({ id: 'x', base: 'https://p.example/', carriage: 'https', device: 'folder' }).device, undefined);
});

test('every location says where it is, what it needs, and what could lose it', () => {
  const kinds = [
    { carriage: 'device', device: 'folder', label: 'Notes', base: BASE },
    { carriage: 'device', device: 'opfs', label: 'This device', base: BASE },
    { carriage: 'builtin', kept: 'sealed', label: 'This browser', base: BASE },
    { carriage: 'builtin', kept: 'run', label: 'This browser', base: BASE },
    { carriage: 'https', label: 'Laptop', base: 'http://127.0.0.1:3000/' },
    { carriage: 'https', label: 'Cloud', base: 'https://pod.example/' },
    { carriage: 'xmpp', label: 'Home', base: 'https://pod.example/', podJid: 'pod@x.example', relay: { url: 'wss://x.example/ws' } },
  ];
  for (const p of kinds) {
    const d = describeLocation({ id: 'x', status: 'online', ...p });
    for (const k of ['where', 'needs', 'risk', 'icon', 'kind']) assert.ok(d[k], `${p.carriage} ${k}`);
    assert.equal(d.dev.carriage, p.carriage);
  }
  assert.equal(describeLocation({ id: 'x', status: 'online', ...kinds[0] }).finder, true);
  assert.equal(describeLocation({ id: 'x', status: 'online', ...kinds[1] }).finder, false);
  assert.match(describeLocation({ id: 'x', status: 'online', ...kinds[3] }).risk, /loses them/);
  assert.equal(describeLocation({ id: 'x', status: 'needs-ok', ...kinds[0] }).statusText, 'Needs your OK');
});
