import test from 'node:test';
import assert from 'node:assert/strict';
import { FoafTools } from '../src/tools.mjs';
import { createChatCommands } from '../src/chat-commands.mjs';

const bus = () => { const seen = []; return { seen, publish: (topic, data) => seen.push({ topic, data }), subscribe: () => () => {} }; };
const TOOLS = [
  { name: 'get_view', description: 'Where the camera is', readOnly: true },
  { name: 'go_to', description: 'Fly somewhere', inputSchema: { required: ['place'] } },
];
// A frame that answers every call with what it was asked.
function moglob(t, { alive = () => true, reply = true } = {}) {
  const source = {};
  const p = t.attach({ id: 'docklands', label: 'Moglob', source, alive,
    post: (m) => { if (reply) queueMicrotask(() => t.receive(p, { type: 'webmcp.result', id: m.id, ok: true, value: { echo: m.name, args: m.args } })); } });
  t.receive(p, { type: 'webmcp.tools', api: '1.10.0', tools: TOOLS });
  return p;
}

test('an app is found by its id or its name, in any case', () => {
  const t = new FoafTools();
  moglob(t);
  assert.equal(t.find('docklands').label, 'Moglob');
  assert.equal(t.find('MOGLOB').id, 'docklands');
  assert.equal(t.find('nothing'), null);
});

test('a read needs no write permission; a change does', async () => {
  const t = new FoafTools();
  moglob(t);
  assert.equal((await t.call('moglob', 'get_view')).ok, true);
  assert.equal((await t.call('moglob', 'go_to', { place: 'x' })).reason, 'read-only-caller');
  assert.equal((await t.call('moglob', 'go_to', { place: 'x' }, { allowWrite: true })).ok, true);
});

test('bad calls are refused before they reach the frame', async () => {
  const t = new FoafTools();
  moglob(t);
  assert.equal((await t.call('nope', 'get_view')).reason, 'no-app');
  assert.equal((await t.call('moglob', 'nope')).reason, 'no-tool');
  assert.equal((await t.call('moglob', 'get_view', [])).reason, 'bad-args');
  assert.equal((await t.call('moglob', 'go_to', {}, { allowWrite: true })).reason, 'bad-args');
});

test('a frame that never answers times out, and one that closes fails its calls', async () => {
  const t = new FoafTools();
  let here = true;
  moglob(t, { reply: false, alive: () => here });
  assert.equal((await t.call('moglob', 'get_view', {}, { timeoutMs: 10 })).reason, 'timeout');
  const waiting = t.call('moglob', 'get_view');
  here = false;
  t.prune();
  assert.equal((await waiting).reason, 'closed');
  assert.deepEqual(t.list(), []);
});

test('the bus hears who called what, never the arguments', async () => {
  const b = bus();
  const t = new FoafTools({ bus: b });
  moglob(t);
  await t.call('moglob', 'go_to', { place: 'a secret place' }, { allowWrite: true, caller: 'me@localhost' });
  const e = b.seen.find((x) => x.topic === 'tools.called');
  assert.match(e.data.summary, /me@localhost called Moglob go_to: ok/);
  assert.doesNotMatch(JSON.stringify(e.data), /secret/);
});

test('WebMCP gets every tool under the app name, and a new list replaces the old', async () => {
  const added = [];
  const t = new FoafTools({ document: { modelContext: { registerTool: async (tool, o) => added.push({ tool, o }) } } });
  const p = moglob(t);
  await new Promise((r) => setTimeout(r));
  assert.deepEqual(added.map((a) => a.tool.name), ['moglob.get_view', 'moglob.go_to']);
  assert.equal(added[0].tool.annotations.readOnlyHint, true);
  assert.equal(added[1].tool.annotations.readOnlyHint, false);
  const first = added[0].o.signal;
  t.receive(p, { type: 'webmcp.tools', tools: TOOLS });
  assert.equal(first.aborted, true);
  assert.equal(await added[1].tool.execute({ place: 'x' }).then(JSON.parse).then((v) => v.echo), 'go_to');
});

test('commands: a remote caller gets the remote set only', async () => {
  const t = new FoafTools();
  moglob(t);
  const run = createChatCommands({ chat: { mirrors: () => false }, tools: t, bus: bus() });
  assert.equal(await run('hello'), null);
  assert.match((await run('/apps')).text, /moglob: 2 tools/);
  assert.match((await run('/join x', { remote: { from: 'me@x' } })).text, /only in the Chat window/);
  assert.doesNotMatch((await run('/help', { remote: { from: 'me@x' } })).text, /\/join/);
  assert.equal((await run('/call moglob go_to {"place":"Tower"}', { remote: { from: 'me@x' } })).value.args.place, 'Tower');
  assert.match((await run('/call moglob go_to {nope}')).text, /not valid JSON/);
  assert.match((await run('/nonsense')).text, /no \/nonsense command/);
});

test('/where and /go work on whichever world is open, and say so when none is', async () => {
  const t = new FoafTools();
  const run = createChatCommands({ chat: { mirrors: () => false }, tools: t, bus: bus() });
  assert.match((await run('/go somewhere')).text, /No world is open/);
  moglob(t);
  assert.equal((await run('/go tower of london')).value.args.place, 'tower of london');
  assert.match((await run('/go')).text, /Where to/);
  assert.match((await run('/where', { remote: { from: 'me@x' } })).text, /Moglob/);
});
