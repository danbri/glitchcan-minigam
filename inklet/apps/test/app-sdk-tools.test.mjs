// foaf.tools in app-sdk.js: an app offers tools to the shell over postMessage.
// No browser: the SDK runs in a vm context with a fake window and parent.
//   node --test inklet/apps/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SDK = readFileSync(fileURLToPath(new URL('../app-sdk.js', import.meta.url)), 'utf8');

// A page inside a frame: `sent` is what reached the parent; `deliver` is a message
// arriving at the page, from the parent unless another source is given.
function framedPage() {
  const sent = [];
  const handlers = [];
  const parent = { postMessage: (m) => sent.push(JSON.parse(JSON.stringify(m))) };
  const window = {
    parent,
    location: { pathname: '/apps/test/' },
    addEventListener: (type, fn) => { if (type === 'message') handlers.push(fn); },
  };
  const ctx = vm.createContext({ window, location: window.location, setTimeout, console, JSON, Promise, Error, Map, Set, Object, Array, String });
  vm.runInContext(SDK, ctx);
  const deliver = (data, source = parent) => { for (const fn of handlers) fn({ data, source }); };
  const tick = () => new Promise((r) => setTimeout(r, 5));
  // Objects made in the vm have its prototypes: compare them as JSON.
  const call = async (name, args) => JSON.parse(JSON.stringify(await window.foaf.tools.call(name, args)));
  return { foaf: window.foaf, sent, deliver, tick, parent, call };
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
  const { foaf, sent, tick } = framedPage();
  foaf.tools.register(listTool);
  foaf.tools.register(addTool);
  await tick();
  const lists = sent.filter((m) => m.type === 'webmcp.tools');
  assert.equal(lists.length, 1);
  assert.equal(lists[0].api, 'app-sdk/1');
  assert.deepEqual(lists[0].tools, [
    { name: 'list_notes', description: 'The names of your notes.', inputSchema: { type: 'object', properties: {} }, readOnly: true },
    { name: 'add_note', description: 'Add a note.', inputSchema: addTool.inputSchema, readOnly: false },
  ]);
  // What is listed carries no handler.
  assert.ok(foaf.tools.list().every((t) => !('handler' in t)));
});

test('webmcp.list from the parent sends the list again', async () => {
  const { foaf, sent, deliver, tick } = framedPage();
  foaf.tools.register(listTool);
  await tick();
  sent.length = 0;
  deliver({ type: 'webmcp.list' });
  await tick();
  assert.equal(sent.filter((m) => m.type === 'webmcp.tools').length, 1);
});

test('webmcp.call runs the handler and answers with webmcp.result', async () => {
  const { foaf, sent, deliver, tick } = framedPage();
  foaf.tools.register(listTool);
  foaf.tools.register(addTool);
  await tick();
  deliver({ type: 'webmcp.call', id: 't1', name: 'list_notes', args: {} });
  deliver({ type: 'webmcp.call', id: 't2', name: 'add_note', args: { name: 'x' } });
  await tick();
  const results = sent.filter((m) => m.type === 'webmcp.result');
  assert.deepEqual(results.find((m) => m.id === 't1'), { type: 'webmcp.result', id: 't1', ok: true, value: ['a', 'b'] });
  assert.deepEqual(results.find((m) => m.id === 't2'), { type: 'webmcp.result', id: 't2', ok: true, value: { saved: 'x' } });
});

test('errors come back as ok:false with a message: unknown tool, missing argument, a throw', async () => {
  const { foaf, sent, deliver, tick } = framedPage();
  foaf.tools.register(addTool);
  foaf.tools.register({ name: 'boom', handler: () => { throw new Error('it broke'); } });
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
  const { foaf, sent, deliver, tick } = framedPage();
  let ran = 0;
  foaf.tools.register({ name: 'count', handler: () => ++ran });
  await tick();
  sent.length = 0;
  deliver({ type: 'webmcp.call', id: 'x', name: 'count', args: {} }, { postMessage() {} });
  deliver({ type: 'webmcp.list' }, null);
  await tick();
  assert.equal(ran, 0);
  assert.deepEqual(sent, []);
});

test('unregister takes a tool back and sends the shorter list', async () => {
  const { foaf, sent, tick } = framedPage();
  const off = foaf.tools.register(listTool);
  foaf.tools.register(addTool);
  await tick();
  sent.length = 0;
  off();
  await tick();
  const last = sent.filter((m) => m.type === 'webmcp.tools').pop();
  assert.deepEqual(last.tools.map((t) => t.name), ['add_note']);
});

test('bad registrations throw; foaf.tools.call runs a tool in the page', async () => {
  const { foaf, call } = framedPage();
  assert.throws(() => foaf.tools.register({ name: 'has space', handler() {} }), /tool name/);
  assert.throws(() => foaf.tools.register({ name: 'nohandler' }), /handler/);
  foaf.tools.register(addTool);
  assert.deepEqual(await call('add_note', { name: 'y' }), { ok: true, value: { saved: 'y' } });
});

test('a handler that returns nothing answers null; the answer is plain JSON', async () => {
  const { foaf, call } = framedPage();
  foaf.tools.register({ name: 'quiet', handler: () => undefined });
  foaf.tools.register({ name: 'dated', handler: () => ({ when: new Date(0), fn() {} }) });
  assert.deepEqual(await call('quiet', {}), { ok: true, value: null });
  assert.deepEqual(await call('dated', {}), { ok: true, value: { when: '1970-01-01T00:00:00.000Z' } });
});
