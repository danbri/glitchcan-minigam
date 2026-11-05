import test from 'node:test';
import assert from 'node:assert/strict';
import { handlersFor, handlesProblems } from '../src/handlers.mjs';
import { FoafPods } from '../src/pods.mjs';
import { FoafSecrets } from '../src/secrets.mjs';
import { deviceFetch } from '../src/device-fetch.mjs';

const notes = { id: 'notes', name: 'Notes', icon: 'n', handles: [{ types: ['text/plain', 'text/markdown'], extensions: ['txt', 'md'], actions: ['view', 'edit'], comment: 'Markdown opens as source.' }] };
const viewer = { id: 'view', name: 'Viewer', handles: [{ types: ['image/*'], actions: ['view'], comment: 'Slow over 100 MB. GIFs lose their animation.' }] };
const plain = { id: 'other', name: 'Other' };

test('a file finds its apps by type or extension, with their comments', () => {
  const apps = [notes, viewer, plain];
  assert.deepEqual(handlersFor(apps, { path: 'a.txt' }).map((h) => h.appId), ['notes']);
  assert.deepEqual(handlersFor(apps, { path: 'x', contentType: 'text/plain; charset=utf-8' }).map((h) => h.appId), ['notes']);
  assert.deepEqual(handlersFor(apps, { path: 'A.MD' }).map((h) => h.appId), ['notes']);
  const [h] = handlersFor(apps, { path: 'p.gif', contentType: 'image/gif' });
  assert.equal(h.appId, 'view');
  assert.match(h.comment, /GIFs lose their animation/);
  assert.deepEqual(h.actions, ['view']);
  assert.deepEqual(handlersFor(apps, { path: 'a.zip', contentType: 'application/zip' }), []);
  assert.deepEqual(handlersFor(apps, { path: 'noextension' }), []);
  assert.deepEqual(handlersFor(apps, {}), []);
});

test('a bad handles list is named', () => {
  assert.deepEqual(handlesProblems(notes.handles), []);
  assert.deepEqual(handlesProblems([{ extensions: ['txt'], actions: ['view'] }]), []);
  assert.match(handlesProblems('x')[0], /must be a list/);
  assert.match(handlesProblems([{ actions: ['view'] }])[0], /types or extensions/);
  assert.match(handlesProblems([{ types: ['nope'], actions: ['view'] }])[0], /media types/);
  assert.match(handlesProblems([{ extensions: ['.txt'], actions: ['view'] }])[0], /no dot/);
  assert.match(handlesProblems([{ extensions: ['txt'], actions: ['delete'] }])[0], /actions/);
  assert.match(handlesProblems([{ extensions: ['txt'], actions: ['view'], comment: 3 }])[0], /comment/);
});

const BASE = 'https://device.foafos.local/opfs/';
class Dir {
  kind = 'directory'; kids = new Map();
  async getDirectoryHandle(n, { create } = {}) { let k = this.kids.get(n); if (!k) { if (!create) throw Object.assign(new Error('x'), { name: 'NotFoundError' }); k = new Dir(); this.kids.set(n, k); } return k; }
  async getFileHandle(n, { create } = {}) { let k = this.kids.get(n); if (!k) { if (!create) throw Object.assign(new Error('x'), { name: 'NotFoundError' }); k = new File1(); this.kids.set(n, k); } return k; }
  async *entries() { yield* this.kids.entries(); }
}
let tick = 1;
class File1 {
  kind = 'file'; bytes = new Uint8Array(); at = 0;
  async getFile() { const b = this.bytes; return { size: b.length, lastModified: this.at, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; }
  async createWritable() { const f = this; let n; return { write: async (d) => { n = new TextEncoder().encode(String(d)); }, close: async () => { f.bytes = n; f.at = ++tick; } }; }
}
async function setup() {
  const memory = new Map();
  const storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
  const root = new Dir();
  const pods = new FoafPods({ secrets: new FoafSecrets(), storage, openDevice: async () => ({ ok: true, root }) });
  pods.add({ id: 'device', label: 'D', base: BASE, carriage: 'device', device: 'opfs' });
  pods.grant('files', { 'pod:read': { pod: 'device', prefix: '' }, 'pod:write': { pod: 'device', prefix: '' } });
  pods.grant('notes', { 'pod:read': { pod: 'device' }, 'pod:write': { pod: 'device' } });
  await pods.connect('device');
  await pods.invoke('files', 'pod.put', { path: 'work/a.txt', body: 'one', contentType: 'text/plain' });
  await pods.invoke('files', 'pod.put', { path: 'work/secret.txt', body: 'keep out', contentType: 'text/plain' });
  return pods;
}
const claim = (pods, write = true, holder = 'w1', app = 'notes') => { pods.offerShare(app, { pod: 'device', path: 'work/a.txt', write }); return pods.claimShare(app, holder); };

test('a shared file can be read and saved, by the window that holds it', async () => {
  const pods = await setup();
  const s = claim(pods);
  assert.equal(s.name, 'a.txt');
  const r = await pods.invoke('notes', 'pod.get', { path: '', share: s.token }, { holder: 'w1' });
  assert.equal(r.body, 'one');
  assert.equal((await pods.invoke('notes', 'pod.put', { path: '', body: 'two', etag: r.etag, contentType: 'text/plain', share: s.token }, { holder: 'w1' })).ok, true);
  assert.equal((await pods.invoke('files', 'pod.get', { path: 'work/a.txt' })).body, 'two');
});

test('a share reaches that file only: the path an app sends is ignored', async () => {
  const pods = await setup();
  const s = claim(pods);
  for (const path of ['work/secret.txt', '../work/secret.txt', '/work/secret.txt']) {
    assert.equal((await pods.invoke('notes', 'pod.get', { path, share: s.token }, { holder: 'w1' })).body, 'one', path);
  }
  assert.equal((await pods.invoke('notes', 'pod.get', { path: 'work/secret.txt' }, { holder: 'w1' })).ok, false);
});

test('a share cannot list or delete, and a read-only share cannot write', async () => {
  const pods = await setup();
  const s = claim(pods);
  assert.equal((await pods.invoke('notes', 'pod.delete', { path: '', share: s.token }, { holder: 'w1' })).reason, 'denied');
  assert.equal((await pods.invoke('notes', 'pod.list', { path: '', share: s.token }, { holder: 'w1' })).reason, 'denied');
  const r = claim(pods, false, 'w2');
  assert.equal(r.write, false);
  assert.equal((await pods.invoke('notes', 'pod.put', { path: '', body: 'x', share: r.token }, { holder: 'w2' })).reason, 'read-only');
  assert.equal((await pods.invoke('notes', 'pod.get', { path: '', share: r.token }, { holder: 'w2' })).body, 'one');
});

test('a token is no use to another window, another app, or after its window closes', async () => {
  const pods = await setup();
  const s = claim(pods);
  const other = claim(pods, true, 'w2');
  assert.equal((await pods.invoke('notes', 'pod.get', { path: '', share: s.token }, { holder: 'w2' })).reason, 'denied');
  assert.equal((await pods.invoke('files', 'pod.get', { path: '', share: s.token }, { holder: 'w1' })).reason, 'denied');
  assert.equal((await pods.invoke('notes', 'pod.get', { path: '', share: 'made-up' }, { holder: 'w1' })).reason, 'denied');
  pods.endShares(['w1']);
  assert.equal((await pods.invoke('notes', 'pod.get', { path: '', share: s.token }, { holder: 'w1' })).reason, 'denied');
  assert.equal((await pods.invoke('notes', 'pod.get', { path: '', share: other.token }, { holder: 'w2' })).ok, true);
});

test('an offer goes to one window of that app, once, and can be withdrawn', async () => {
  const pods = await setup();
  const token = pods.offerShare('notes', { pod: 'device', path: 'work/a.txt' });
  assert.equal(pods.claimShare('other', 'w9'), null);
  assert.equal(pods.claimShare('notes', null), null);
  assert.equal(pods.claimShare('notes', 'w1').token, token);
  assert.equal(pods.claimShare('notes', 'w1').token, token);   // a reloaded window keeps it
  assert.equal(pods.claimShare('notes', 'w2'), null);
  pods.cancelOffer(pods.offerShare('notes', { pod: 'device', path: 'work/a.txt' }));
  assert.equal(pods.claimShare('notes', 'w3'), null);
  assert.equal(pods.claimShare('notes', undefined), null);
  assert.throws(() => pods.offerShare('notes', { pod: 'device', path: '../x' }));
  assert.throws(() => pods.offerShare('notes', { pod: 'nope', path: 'x' }));
});

test('an offer bound to a window goes to that window, not to another of the same app', async () => {
  const pods = await setup();
  const token = pods.offerShare('notes', { pod: 'device', path: 'work/a.txt' });
  pods.bindOffer(token, 'w2');
  assert.equal(pods.claimShare('notes', 'w1'), null);
  assert.equal(pods.claimShare('notes', 'w2').token, token);
});

test('a stale save through a share is refused', async () => {
  const pods = await setup();
  const s = claim(pods);
  const r = await pods.invoke('notes', 'pod.get', { path: '', share: s.token }, { holder: 'w1' });
  await pods.invoke('files', 'pod.put', { path: 'work/a.txt', body: 'changed', contentType: 'text/plain' });
  assert.equal((await pods.invoke('notes', 'pod.put', { path: '', body: 'x', etag: r.etag, share: s.token }, { holder: 'w1' })).reason, 'conflict');
});
