// @foafos/host-lite with the real @foafos/guest: two windows that post to each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hostApp, memoryStore } from '../host-lite.mjs';
import { connect } from '../../foafos-guest/guest.mjs';

/** A page and its app frame. Messages are delivered asynchronously, with source and origin, as a browser does. */
function pair({ hostOrigin = 'https://host.example' } = {}) {
  const make = () => { const ls = new Set(); return { ls, addEventListener: (t, fn) => { if (t === 'message') ls.add(fn); }, removeEventListener: (t, fn) => ls.delete(fn) }; };
  const page = make(), app = make();
  const log = [];
  const deliver = (to, from, origin, data) => setTimeout(() => { for (const fn of to.ls) fn({ data: structuredClone(data), source: from, origin }); }, 0);
  // Only what the browser would deliver is logged: a post aimed at another origin is dropped.
  app.parent = { postMessage: (data, target) => { if (target === '*' || target === hostOrigin) { log.push({ dir: 'g2h', data }); deliver(page, appWin, 'null', data); } } };
  const appWin = { postMessage: (data) => { log.push({ dir: 'h2g', data }); deliver(app, app.parent, hostOrigin, data); } };
  app.parent.self = app.parent;
  // The guest checks e.source === w.parent; the host checks e.source === frame.contentWindow.
  const frame = { contentWindow: appWin, getBoundingClientRect: () => ({ width: 400, height: 300 }) };
  const pageFix = (d) => d;
  return { page, app, frame, log, sent: (dir) => log.filter((x) => x.dir === dir).map((x) => x.data.type), pageFix };
}
const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));

test('handshake: the host grants the smaller of asked and offered; the guest sees it', async () => {
  const p = pair();
  const host = hostApp(p.frame, { offer: 1, window: p.page });
  const guest = await connect({ level: 3, name: 'Chess', window: p.app, timeoutMs: 200 });
  assert.equal(host.level, 1);
  assert.equal(guest.level, 1);
});

test('lifecycle: in order, paused acknowledged, nothing but owed replies after ending', async () => {
  const p = pair();
  const paused = [];
  const host = hostApp(p.frame, { offer: 2, store: memoryStore(), window: p.page, onPaused: () => paused.push(1) });
  const guest = await connect({ level: 2, window: p.app, timeoutMs: 200 });
  const states = [];
  guest.on('lifecycle', ({ state }) => { states.push(state); if (state === 'paused') guest.paused(); });
  assert.equal(host.resume(), false, 'already running: nothing sent');
  host.pause(); await settle();
  host.resume(); await settle();
  host.end(); await settle();
  assert.equal(host.pause(), false, 'nothing after ending');
  assert.deepEqual(states, ['paused', 'running', 'ending']);
  assert.equal(paused.length, 1);
  assert.deepEqual(await guest.store.get('x.txt'), { ok: false, reason: 'offline' }, 'nothing is sent after ending; the guest knows');
});

test('storage: confined to the app folder; one answer per request; bad paths denied by the host too', async () => {
  const p = pair();
  const store = memoryStore();
  await store.put('other/secret.txt', { body: 'not yours', etag: '"x"' });
  const host = hostApp(p.frame, { offer: 2, folder: 'chess', store, window: p.page });
  const guest = await connect({ level: 2, window: p.app, timeoutMs: 200 });
  assert.equal((await guest.store.put('games/1.pgn', '1. e4')).ok, true);
  assert.equal((await guest.store.get('games/1.pgn')).body, '1. e4');
  assert.deepEqual((await guest.store.list('')).items, [{ path: 'games/', container: true }]);
  const old = (await guest.store.get('games/1.pgn')).etag;
  await guest.store.put('games/1.pgn', '1. d4', { etag: old });
  assert.equal((await guest.store.put('games/1.pgn', 'x', { etag: old })).reason, 'conflict');
  assert.deepEqual(await store.keys(), ['other/secret.txt', 'chess/games/1.pgn']);
  // A guest that skipped its own path check: the host still refuses, and answers once.
  p.app.parent.postMessage({ fl: 1, type: 'store', rid: 'evil', op: 'get', path: ['..', 'other', 'secret.txt'] }, '*');
  p.app.parent.postMessage({ fl: 1, type: 'store', rid: 'evil2', op: 'get', path: ['%2e%2e', 'other'] }, '*');
  await settle();
  const answers = p.log.filter((x) => x.dir === 'h2g' && x.data.type === 'store-result' && /^evil/.test(x.data.rid)).map((x) => [x.data.rid, x.data.reason]);
  assert.deepEqual(answers, [['evil', 'denied'], ['evil2', 'denied']]);
  assert.equal(host.level, 2);
});

test('no store, no storage: a host without one grants at most level 1', async () => {
  const p = pair();
  const host = hostApp(p.frame, { offer: 3, window: p.page });
  const guest = await connect({ level: 2, window: p.app, timeoutMs: 200 });
  assert.equal(host.level, 1);
  assert.equal((await guest.store.put('a', 'x')).ok, true, 'kept locally by the guest');
  assert.ok(!p.sent('g2h').includes('store'));
});

test('level 3: a tool call answered once; events only for topics subscribed and granted; actions only from the menu', async () => {
  const p = pair();
  const got = [];
  const host = hostApp(p.frame, { offer: 3, store: memoryStore(), topics: ['clock'], window: p.page, onPublish: (t, d) => got.push(['pub', t, d]) });
  const guest = await connect({ level: 3, actions: [{ id: 'new', label: 'New game' }], window: p.app, timeoutMs: 200 });
  guest.tools([{ name: 'move' }], async (name, args) => ({ played: args.san }));
  guest.subscribe(['clock', 'chat']);
  guest.on('event', (e) => got.push(['event', e.topic]));
  guest.on('action', (a) => got.push(['action', a.id]));
  guest.publish('moves', { san: 'e4' });
  await settle();
  assert.deepEqual(await host.callTool('move', { san: 'Nf3' }), { ok: true, result: { played: 'Nf3' } });
  assert.equal(host.emit('clock', { t: 1 }), true);
  assert.equal(host.emit('chat', {}), false, 'subscribed but not granted');
  assert.equal(host.emit('weather', {}), false, 'granted? no; subscribed? no');
  host.action('new'); host.action('resign');
  await settle();
  assert.deepEqual(got, [['pub', 'moves', { san: 'e4' }], ['event', 'clock'], ['action', 'new']]);
  assert.equal(p.log.filter((x) => x.data.type === 'tool-result').length, 1);
});

test('a host that is not listed in the app\'s hosts hears nothing', async () => {
  const p = pair({ hostOrigin: 'https://evil.example' });
  const host = hostApp(p.frame, { offer: 3, store: memoryStore(), window: p.page });
  const guest = await connect({ level: 2, hosts: ['https://foafos.example'], window: p.app, timeoutMs: 50 });
  assert.equal(guest.level, 0);
  assert.equal(host.level, 0);
  assert.deepEqual(p.sent('g2h'), []);
});

test('the module: no network, no globals replaced, nothing at import, small', () => {
  const src = readFileSync(new URL('../host-lite.mjs', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'WebTransport', 'RTCPeerConnection', 'EventSource', 'Worker', 'serviceWorker', 'sendBeacon', 'import(', 'eval', 'Function(', 'defineProperty', 'prototype', 'localStorage']) {
    assert.ok(!src.includes(name), `the source names ${name}`);
  }
  assert.ok(readFileSync(new URL('../host-lite.mjs', import.meta.url)).length < 12 * 1024);
});
