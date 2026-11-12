// @foafos/guest against a fake framing window: each promise of the contract's guest side.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connect, cleanPath, memoryStore } from '../guest.mjs';

/** A frame and its parent: what the guest posts, and a way to post to the guest as the parent. */
function frame({ parentOrigin = 'https://host.example' } = {}) {
  const sent = [];
  const parent = { postMessage: (data, target) => { if (target === '*' || target === parentOrigin) sent.push({ data, target }); } };
  let listener = null;
  const w = { parent, addEventListener: (t, fn) => { if (t === 'message') listener = fn; } };
  const fromHost = (data, { source = parent, origin = parentOrigin } = {}) => listener?.({ data, source, origin });
  return { w, sent, fromHost, types: () => sent.map((s) => s.data.type) };
}
const welcome = (level, extra = {}) => ({ fl: 1, type: 'welcome', level, lifecycle: 'running', viewport: { width: 300, height: 200, safe: {}, mode: 'window' }, audio: { level: 1, muted: false }, ...extra });
const tick = () => new Promise((r) => setTimeout(r, 0));

test('not framed, or asking for level 0: level 0, nothing sent', async () => {
  const g0 = await connect({ window: { parent: null } });
  assert.equal(g0.level, 0);
  const f = frame();
  const g = await connect({ level: 0, window: f.w });
  assert.equal(g.level, 0);
  assert.deepEqual(f.sent, []);
  assert.deepEqual(await g.store.put('a.txt', 'x'), { ok: true }, 'level 0 keeps things locally');
});

test('no welcome in time: level 0 after hello, and nothing more is sent; a late welcome is ignored', async () => {
  const f = frame();
  const g = await connect({ level: 2, name: 'Chess', window: f.w, local: memoryStore(), timeoutMs: 20 });
  assert.equal(g.level, 0);
  assert.deepEqual(f.types(), ['hello']);
  f.fromHost(welcome(2));
  g.ready(); g.setActions([{ id: 'new', label: 'New game' }]);
  assert.equal(g.level, 0);
  assert.deepEqual(f.types(), ['hello']);
  assert.equal((await g.store.put('save.pgn', '1. e4')).ok, true, 'kept locally, not sent');
  assert.deepEqual(f.types(), ['hello']);
});

test('a welcome above the level asked for is ignored; junk changes nothing', async () => {
  const f = frame();
  const p = connect({ level: 1, window: f.w, timeoutMs: 30 });
  f.fromHost(welcome(3));                                   // too much: ignored
  f.fromHost({ ...welcome(1), fl: 2 });                     // wrong version
  f.fromHost(welcome(1), { source: {} });                   // another window
  f.fromHost({ fl: 1, type: 'bogus' });
  const g = await p;
  assert.equal(g.level, 0);
});

test('level 1: only hello, ready, actions and paused leave; paused only when owed; actions only from the menu', async () => {
  const f = frame();
  const p = connect({ level: 1, name: 'Chess', actions: [{ id: 'new', label: 'New game' }], window: f.w });
  f.fromHost(welcome(1));
  const g = await p;
  assert.equal(g.level, 1);
  const seen = [];
  g.on('action', (a) => seen.push(a.id));
  g.on('lifecycle', (l) => seen.push(l.state));
  g.ready();
  g.paused();                                               // not owed: nothing sent
  f.fromHost({ fl: 1, type: 'lifecycle', state: 'paused' });
  g.paused();
  f.fromHost({ fl: 1, type: 'action', id: 'new' });
  f.fromHost({ fl: 1, type: 'action', id: 'resign' });      // not in the menu
  assert.equal(await g.store.put('a.txt', 'x').then((r) => r.ok), true, 'level 1 storage is local');
  assert.equal(g.tools([], () => {}), false);
  assert.equal(g.publish('t', {}), false);
  f.fromHost({ fl: 1, type: 'event', topic: 't', data: 1 }); // above level 1: ignored
  assert.deepEqual(f.types(), ['hello', 'ready', 'paused']);
  assert.deepEqual(seen, ['paused', 'new']);
  assert.ok(f.sent.slice(1).every((s) => s.target === 'https://host.example'), 'after welcome, only to the host that answered');
});

test('level 2: store goes to the host with a fresh rid, one answer each; bad paths never leave; ending fails what is owed', async () => {
  const f = frame();
  const p = connect({ level: 2, window: f.w });
  f.fromHost(welcome(2));
  const g = await p;
  const put = g.store.put('games/1.pgn', '1. e4 e5');
  await tick();
  const req = f.sent.at(-1).data;
  assert.deepEqual([req.type, req.op, req.path], ['store', 'put', ['games', '1.pgn']]);
  f.fromHost({ fl: 1, type: 'store-result', rid: req.rid, ok: true, etag: '"e1"' });
  f.fromHost({ fl: 1, type: 'store-result', rid: req.rid, ok: false });   // a second reply: ignored
  assert.deepEqual(await put, { ok: true, etag: '"e1"' });
  for (const bad of ['../x', '%2e%2e/x', 'a\\b', 'a//b', './a', '']) assert.deepEqual(await g.store.get(bad), { ok: false, reason: 'denied' }, bad);
  assert.equal(f.sent.filter((s) => s.data.type === 'store').length, 1, 'no bad path was sent');
  const owed = g.store.get('games/1.pgn');
  await tick();
  f.fromHost({ fl: 1, type: 'lifecycle', state: 'ending' });
  assert.deepEqual(await owed, { ok: false, reason: 'offline' });
  g.ready();
  assert.equal(f.sent.at(-1).data.type, 'store', 'nothing is sent after ending');
  assert.deepEqual(await g.store.put('late.txt', 'x'), { ok: false, reason: 'offline' }, 'a request after ending fails at once');
  const rids = f.sent.filter((s) => s.data.rid).map((s) => s.data.rid);
  assert.equal(new Set(rids).size, rids.length, 'rids are unique');
});

test('level 3: each call gets exactly one tool-result; events only from the host', async () => {
  const f = frame();
  const p = connect({ level: 3, window: f.w });
  f.fromHost(welcome(3));
  const g = await p;
  g.tools([{ name: 'move', description: 'Play a move' }], async (name, args) => { if (name !== 'move') throw new Error('no such tool'); return { played: args.san }; });
  f.fromHost({ fl: 1, type: 'call', rid: 'h1', name: 'move', args: { san: 'e4' } });
  f.fromHost({ fl: 1, type: 'call', rid: 'h2', name: 'resign', args: {} });
  await tick(); await tick();
  const results = f.sent.filter((s) => s.data.type === 'tool-result').map((s) => s.data);
  assert.deepEqual(results, [{ fl: 1, type: 'tool-result', rid: 'h1', ok: true, result: { played: 'e4' } }, { fl: 1, type: 'tool-result', rid: 'h2', ok: false, error: 'no such tool' }]);
  const events = [];
  g.on('event', (e) => events.push(e.topic));
  f.fromHost({ fl: 1, type: 'event', topic: 'chat', data: {} });
  f.fromHost({ fl: 1, type: 'event', topic: 'x', data: {} }, { origin: 'https://evil.example' });
  assert.deepEqual(events, ['chat']);
});

test('hosts: with a list, hello goes only to those origins, and other origins are not heard', async () => {
  const f = frame({ parentOrigin: 'https://evil.example' });
  const g = await connect({ level: 2, hosts: ['https://foafos.example'], window: f.w, timeoutMs: 20 });
  assert.deepEqual(f.sent, [], 'the browser delivers nothing to a parent whose origin is not listed');
  f.fromHost(welcome(2), { origin: 'https://evil.example' });
  assert.equal(g.level, 0);
});

test('paths: segments of [A-Za-z0-9._~-], not . or ..; the empty path only for list', () => {
  assert.deepEqual(cleanPath('a/b.txt'), ['a', 'b.txt']);
  assert.deepEqual(cleanPath('', { forList: true }), []);
  assert.deepEqual(cleanPath('dir/', { forList: true }), ['dir']);
  for (const bad of ['', '..', '.', 'a/../b', '%2e%2e', 'a b', 'a\\b', '/abs', 'é']) assert.equal(cleanPath(bad), null, bad);
});

test('the module: no network, no globals replaced, nothing at import, small', () => {
  const src = readFileSync(new URL('../guest.mjs', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'WebTransport', 'RTCPeerConnection', 'EventSource', 'Worker', 'SharedWorker', 'serviceWorker', 'sendBeacon', 'import(', 'eval', 'Function(', 'defineProperty', 'prototype', 'localStorage', 'document.']) {
    assert.ok(!src.includes(name), `the source names ${name}`);
  }
  const top = src.split('\n').filter((l) => /^\S/.test(l) && !/^(export |const |\}|\/\/)/.test(l));
  assert.deepEqual(top, [], 'top level is only declarations');
  assert.ok(readFileSync(new URL('../guest.mjs', import.meta.url)).length < 12 * 1024, 'under 12 KiB');
});
