// The foafos-lite conformance suite (packages/foafos-guest/conformance/suite.mjs), run by the same
// app code standalone, under @foafos/host-lite with its memory store, and under host-lite with a
// store that keeps its own versions, as a pod does. Full foafos runs it in the browser
// (inklet/finkapp/test/e2e-guest-conformance.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { hostApp, memoryStore } from '../host-lite.mjs';
import { connect } from '../../foafos-guest/guest.mjs';
import { runConformance } from '../../foafos-guest/conformance/suite.mjs';

function pair({ hostOrigin = 'https://host.example' } = {}) {
  const make = () => { const ls = new Set(); return { ls, addEventListener: (t, fn) => { if (t === 'message') ls.add(fn); }, removeEventListener: (t, fn) => ls.delete(fn) }; };
  const page = make(), app = make();
  const deliver = (to, from, origin, data) => setTimeout(() => { for (const fn of to.ls) fn({ data: structuredClone(data), source: from, origin }); }, 0);
  app.parent = { postMessage: (data, target) => { if (target === '*' || target === hostOrigin) deliver(page, appWin, 'null', data); } };
  const appWin = { postMessage: (data) => deliver(app, app.parent, hostOrigin, data) };
  const frame = { contentWindow: appWin, getBoundingClientRect: () => ({ width: 400, height: 300 }) };
  return { page, app, frame };
}
const memLocal = () => { const m = new Map(); return { get: async (k) => m.get(k), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); }, keys: async () => [...m.keys()] }; };
const allPass = (results) => { const bad = results.filter((r) => !r.ok); assert.deepEqual(bad, [], JSON.stringify(bad)); };

test('standalone: level 0, local storage, every check passes', async () => {
  const w = { addEventListener() {}, removeEventListener() {} };
  w.parent = w;                                                     // not framed
  const guest = await connect({ level: 2, window: w, local: memLocal(), timeoutMs: 50 });
  assert.equal(guest.level, 0);
  allPass(await runConformance(guest));
});

test('host-lite with its memory store: level 2, every check passes', async () => {
  const p = pair();
  hostApp(p.frame, { offer: 2, folder: 'conf-app', store: memoryStore(), window: p.page });
  const guest = await connect({ level: 2, window: p.app, timeoutMs: 300 });
  assert.equal(guest.level, 2);
  allPass(await runConformance(guest));
});

test('host-lite with a store that versions what it keeps (as a pod does): etags are the store\'s', async () => {
  const p = pair();
  const m = new Map();
  let n = 0;
  const podLike = {
    get: async (k) => m.get(k),
    put: async (k, v) => { const etag = `"pod-${++n}"`; m.set(k, { ...v, etag }); return { etag }; },
    delete: async (k) => { m.delete(k); },
    keys: async () => [...m.keys()],
    list: async (prefix) => { const seen = new Set(); for (const k of m.keys()) if (k.startsWith(prefix)) { const r = k.slice(prefix.length), i = r.indexOf('/'); seen.add(i < 0 ? r : r.slice(0, i + 1)); } return [...seen].map((path) => ({ path, container: path.endsWith('/') })); },
  };
  hostApp(p.frame, { offer: 2, folder: 'conf-app', store: podLike, window: p.page });
  const guest = await connect({ level: 2, window: p.app, timeoutMs: 300 });
  allPass(await runConformance(guest));
});

test('host-lite offering only level 1: storage stays local, every check passes', async () => {
  const p = pair();
  hostApp(p.frame, { offer: 1, window: p.page });
  const guest = await connect({ level: 2, window: p.app, local: memLocal(), timeoutMs: 300 });
  assert.equal(guest.level, 1);
  allPass(await runConformance(guest));
});
