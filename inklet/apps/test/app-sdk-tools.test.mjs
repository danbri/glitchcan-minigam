// foafos.tools in app-sdk.js: an app offers tools to the shell over postMessage.
// No browser: the SDK runs in a vm context with a fake window and parent.
//   node --test inklet/apps/test/app-sdk-tools.test.mjs   (or npm run test:app-sdk)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SDK = readFileSync(fileURLToPath(new URL('../app-sdk.js', import.meta.url)), 'utf8');

// A page inside a frame: `sent` is what reached the parent; `deliver` is a message
// arriving at the page, from the parent unless another source is given. As in a
// foafos frame, the page's origin is opaque unless `origin` says otherwise; with
// `standalone`, the page is its own parent.
function framedPage({ origin = 'null', standalone = false } = {}) {
  const sent = [];
  const handlers = [];
  const parent = { postMessage: (m) => sent.push(JSON.parse(JSON.stringify(m))) };
  const window = {
    parent,
    origin,
    location: { pathname: '/apps/test/' },
    addEventListener: (type, fn) => { if (type === 'message') handlers.push(fn); },
  };
  const ctx = vm.createContext({ window, location: window.location, setTimeout, console, JSON, Promise, Error, Map, Set, Object, Array, String });
  if (standalone) { window.parent = window; window.postMessage = parent.postMessage; }
  vm.runInContext(SDK, ctx);
  const deliver = (data, source = parent) => { for (const fn of handlers) fn({ data, source }); };
  const tick = () => new Promise((r) => setTimeout(r, 5));
  // Objects made in the vm have its prototypes: compare them as JSON.
  const call = async (name, args) => JSON.parse(JSON.stringify(await window.foafos.tools.call(name, args)));
  return { foafos: window.foafos, sent, deliver, tick, parent, call };
}

const listTool = {
  name: 'list_notes', description: 'The names of your notes.', readOnly: true,
  handler: async () => ['a', 'b'],
};
const addTool = {
  name: 'add_note', description: 'Add a note.',
  inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  handler: ({ name }) => ({ saved: name }),
};

test('registering tools sends one list to the parent, in the webmcp.tools shape', async () => {
  const { foafos, sent, tick } = framedPage();
  foafos.tools.register(listTool);
  foafos.tools.register(addTool);
  await tick();
  const lists = sent.filter((m) => m.type === 'webmcp.tools');
  assert.equal(lists.length, 1);
  assert.equal(lists[0].api, 'app-sdk/1');
  assert.deepEqual(lists[0].tools, [
    { name: 'list_notes', description: 'The names of your notes.', inputSchema: { type: 'object', properties: {} }, readOnly: true },
    { name: 'add_note', description: 'Add a note.', inputSchema: addTool.inputSchema, readOnly: false },
  ]);
  // What is listed carries no handler.
  assert.ok(foafos.tools.list().every((t) => !('handler' in t)));
});

test('webmcp.list from the parent sends the list again', async () => {
  const { foafos, sent, deliver, tick } = framedPage();
  foafos.tools.register(listTool);
  await tick();
  sent.length = 0;
  deliver({ type: 'webmcp.list' });
  await tick();
  assert.equal(sent.filter((m) => m.type === 'webmcp.tools').length, 1);
});

test('webmcp.call runs the handler and answers with webmcp.result', async () => {
  const { foafos, sent, deliver, tick } = framedPage();
  foafos.tools.register(listTool);
  foafos.tools.register(addTool);
  await tick();
  deliver({ type: 'webmcp.call', id: 't1', name: 'list_notes', args: {} });
  deliver({ type: 'webmcp.call', id: 't2', name: 'add_note', args: { name: 'x' } });
  await tick();
  const results = sent.filter((m) => m.type === 'webmcp.result');
  assert.deepEqual(results.find((m) => m.id === 't1'), { type: 'webmcp.result', id: 't1', ok: true, value: ['a', 'b'] });
  assert.deepEqual(results.find((m) => m.id === 't2'), { type: 'webmcp.result', id: 't2', ok: true, value: { saved: 'x' } });
});

test('errors come back as ok:false with a message: unknown tool, missing argument, a throw', async () => {
  const { foafos, sent, deliver, tick } = framedPage();
  foafos.tools.register(addTool);
  foafos.tools.register({ name: 'boom', handler: () => { throw new Error('it broke'); } });
  await tick();
  deliver({ type: 'webmcp.call', id: 'a', name: 'nope', args: {} });
  deliver({ type: 'webmcp.call', id: 'b', name: 'add_note', args: {} });
  deliver({ type: 'webmcp.call', id: 'c', name: 'boom', args: {} });
  await tick();
  const r = Object.fromEntries(sent.filter((m) => m.type === 'webmcp.result').map((m) => [m.id, m]));
  assert.deepEqual(r.a, { type: 'webmcp.result', id: 'a', ok: false, error: 'no tool called "nope"' });
  assert.deepEqual(r.b, { type: 'webmcp.result', id: 'b', ok: false, error: 'missing name' });
  assert.deepEqual(r.c, { type: 'webmcp.result', id: 'c', ok: false, error: 'it broke' });
});

test('a call from any window but the parent is ignored', async () => {
  const { foafos, sent, deliver, tick } = framedPage();
  let ran = 0;
  foafos.tools.register({ name: 'count', handler: () => ++ran });
  await tick();
  sent.length = 0;
  deliver({ type: 'webmcp.call', id: 'x', name: 'count', args: {} }, { postMessage() {} });
  deliver({ type: 'webmcp.list' }, null);
  await tick();
  assert.equal(ran, 0);
  assert.deepEqual(sent, []);
});

test('unregister takes a tool back and sends the shorter list', async () => {
  const { foafos, sent, tick } = framedPage();
  const off = foafos.tools.register(listTool);
  foafos.tools.register(addTool);
  await tick();
  sent.length = 0;
  off();
  await tick();
  const last = sent.filter((m) => m.type === 'webmcp.tools').pop();
  assert.deepEqual(last.tools.map((t) => t.name), ['add_note']);
});

test('bad registrations throw; foafos.tools.call runs a tool in the page', async () => {
  const { foafos, call } = framedPage();
  assert.throws(() => foafos.tools.register({ name: 'has space', handler() {} }), /tool name/);
  assert.throws(() => foafos.tools.register({ name: 'nohandler' }), /handler/);
  foafos.tools.register(addTool);
  assert.deepEqual(await call('add_note', { name: 'y' }), { ok: true, value: { saved: 'y' } });
});

test('a handler that returns nothing answers null; the answer is plain JSON', async () => {
  const { foafos, call } = framedPage();
  foafos.tools.register({ name: 'quiet', handler: () => undefined });
  foafos.tools.register({ name: 'dated', handler: () => ({ when: new Date(0), fn() {} }) });
  assert.deepEqual(await call('quiet', {}), { ok: true, value: null });
  assert.deepEqual(await call('dated', {}), { ok: true, value: { when: '1970-01-01T00:00:00.000Z' } });
});

test('a page with a real origin offers no tools and answers no call', async () => {
  for (const opts of [{ origin: 'https://danbri.github.io' }, { standalone: true }]) {
    const { foafos, sent, deliver, tick, call } = framedPage(opts);
    foafos.tools.register(listTool);
    await tick();
    deliver({ type: 'webmcp.list' });
    deliver({ type: 'webmcp.call', id: 'x', name: 'list_notes', args: {} });
    await tick();
    assert.deepEqual(sent.filter((m) => m.type.startsWith('webmcp.')), [], JSON.stringify(opts));
    // The app itself may still run its tools.
    assert.deepEqual(await call('list_notes', {}), { ok: true, value: ['a', 'b'] });
  }
});

test('app.init sends the list again, and the tools contract is declared', async () => {
  const { foafos, sent, deliver, tick } = framedPage();
  foafos.tools.register(listTool);
  await tick();
  sent.length = 0;
  deliver({ type: 'app.init', appId: 'podnotes', capabilities: [] });
  await tick();
  assert.ok(sent.some((m) => m.type === 'conformance' && m.contracts.includes('tools')));
  assert.equal(sent.filter((m) => m.type === 'webmcp.tools').length, 1);
});

test('names must be strings; a second tool of one name replaces the first, whose way back then does nothing', async () => {
  const { foafos, call } = framedPage();
  assert.throws(() => foafos.tools.register({ name: 5, handler() {} }), /tool name/);
  const offFirst = foafos.tools.register({ name: 'dup', handler: () => 1 });
  foafos.tools.register({ name: 'dup', handler: () => 2 });
  offFirst();
  assert.deepEqual(await call('dup', {}), { ok: true, value: 2 });
});

test('arguments that are not an object count as none; required means present and not null', async () => {
  const { foafos, call } = framedPage();
  foafos.tools.register(addTool);
  assert.deepEqual(await call('add_note', ['x']), { ok: false, error: 'missing name' });
  assert.deepEqual(await call('add_note', 'x'), { ok: false, error: 'missing name' });
  assert.deepEqual(await call('add_note', { name: null }), { ok: false, error: 'missing name' });
  assert.deepEqual(await call('add_note', Object.create({ name: 'inherited' })), { ok: false, error: 'missing name' });
});

test('a handler that returns a function answers null; the api string can be set', async () => {
  const { foafos, sent, tick, call } = framedPage();
  foafos.tools.api = 'notes/2';
  foafos.tools.register({ name: 'fn', handler: () => () => 1 });
  await tick();
  assert.equal(foafos.tools.api, 'notes/2');
  assert.equal(sent.find((m) => m.type === 'webmcp.tools').api, 'notes/2');
  assert.deepEqual(await call('fn', {}), { ok: true, value: null });
});
