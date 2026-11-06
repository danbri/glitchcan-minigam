import test from 'node:test';
import assert from 'node:assert/strict';
import { FoafTools } from '../src/tools.mjs';
import { ToolGrants, PERSON, BROWSER_AGENT, SHELL_APP, accountCaller, describeGrant } from '../src/tool-grants.mjs';
import { createChatCommands } from '../src/chat-commands.mjs';

const TOOLS = [
  { name: 'get_view', description: 'Where the camera is', readOnly: true },
  { name: 'go_to', description: 'Fly somewhere' },
  { name: 'set_time', description: 'Change the light' },
];
const bus = () => { const seen = []; return { seen, publish: (topic, data) => seen.push({ topic, data }), subscribe: () => () => {} }; };
function world(t, { id = 'docklands', label = 'Moglob', reply = true } = {}) {
  const calls = [];
  const p = t.attach({ id, label, source: {}, post: (m) => { calls.push(m); if (reply) queueMicrotask(() => t.receive(p, { type: 'webmcp.result', id: m.id, ok: true, value: 1 })); } });
  t.receive(p, { type: 'webmcp.tools', tools: TOOLS });
  return { p, calls };
}
const ME = accountCaller('me@localhost');
const BOT = accountCaller('foafbot@localhost');
const storage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('a caller with no grant reaches nothing, and the refusal is on the bus', async () => {
  const b = bus();
  const t = new FoafTools({ bus: b });
  const { calls } = world(t);
  assert.equal((await t.call('moglob', 'get_view', {}, { caller: ME })).reason, 'not-granted');
  assert.equal(calls.length, 0);
  const e = b.seen.find((x) => x.topic === 'tools.called');
  assert.match(e.data.summary, /me@localhost called Moglob get_view: not-granted/);
  assert.equal(e.data.ok, false);
});

test('look reads and changes nothing; a named tool adds exactly that tool', async () => {
  const t = new FoafTools();
  world(t);
  t.grants.grant('me@localhost', 'docklands');
  assert.equal((await t.call('moglob', 'get_view', {}, { caller: ME })).ok, true);
  assert.equal((await t.call('moglob', 'go_to', {}, { caller: ME })).reason, 'not-granted');
  t.grants.grant('me@localhost', 'moglob', { tools: ['go_to'] });
  assert.equal((await t.call('moglob', 'go_to', {}, { caller: ME })).ok, true);
  assert.equal((await t.call('moglob', 'set_time', {}, { caller: ME })).reason, 'not-granted');
});

test('one caller\'s grant is not another\'s, and one app\'s is not another\'s', async () => {
  const t = new FoafTools();
  world(t);
  world(t, { id: 'drift', label: 'Drift' });
  t.grants.grant('me@localhost', 'docklands', { level: 'all' });
  assert.equal((await t.call('moglob', 'go_to', {}, { caller: ME })).ok, true);
  assert.equal((await t.call('moglob', 'go_to', {}, { caller: BOT })).reason, 'not-granted');
  assert.equal((await t.call('drift', 'go_to', {}, { caller: ME })).reason, 'not-granted');
});

test('a caller cannot be named by a string or a look-alike object', async () => {
  const t = new FoafTools();
  world(t);
  t.grants.grant('me@localhost', '*', { level: 'all' });
  for (const caller of ['me@localhost', 'you', { kind: 'person', id: 'you' }, { id: 'me@localhost' }, null]) {
    assert.equal((await t.call('moglob', 'go_to', {}, { caller })).reason, 'not-granted', JSON.stringify(caller));
  }
});

test('a bot cannot get an account id that looks like the browser agent, or a bad grant', () => {
  const g = new ToolGrants();
  assert.equal(g.grant('nobody', '*').reason, 'bad-caller');
  assert.equal(g.grant('me@localhost/phone', '*').reason, 'bad-caller');
  assert.equal(g.grant('me@localhost', 'a b').reason, 'bad-app');
  assert.equal(g.grant('me@localhost', '*', { level: 'root' }).reason, 'bad-level');
  assert.equal(g.grant('me@localhost', '*', { tools: ['a b'] }).reason, 'bad-tool');
  assert.equal(g.list().length, 0);
});

test('the browser agent is a caller like any other', async () => {
  const added = [];
  const g = new ToolGrants({ defaults: [{ caller: 'browser-agent', app: '*', level: 'look' }] });
  const t = new FoafTools({ grants: g, document: { modelContext: { registerTool: async (tool) => added.push(tool) } } });
  world(t);
  await new Promise((r) => setTimeout(r));
  const tool = (n) => added.find((x) => x.name === `moglob.${n}`);
  assert.equal(await tool('get_view').execute({}), '1');
  await assert.rejects(tool('go_to').execute({}), /not-granted/);
  g.grant('browser-agent', 'docklands', { tools: ['go_to'] });
  assert.equal(await tool('go_to').execute({}), '1');
  assert.equal(g.allows(BROWSER_AGENT, { id: 'docklands', slug: 'moglob' }, TOOLS[2]), false);
});

test('taking a grant back stops a call in flight, and a late answer is dropped', async () => {
  const t = new FoafTools();
  const { p, calls } = world(t, { reply: false });
  t.grants.grant('me@localhost', 'docklands', { level: 'all' });
  t.grants.grant('foafbot@localhost', 'docklands', { level: 'all' });
  const mine = t.call('moglob', 'go_to', {}, { caller: ME });
  const theirs = t.call('moglob', 'go_to', {}, { caller: BOT });
  await new Promise((r) => setTimeout(r));
  t.grants.revoke('foafbot@localhost');
  assert.equal((await theirs).reason, 'revoked');
  assert.equal(p.pending.size, 1);
  t.receive(p, { type: 'webmcp.result', id: calls[1].id, ok: true, value: 'late' });
  t.receive(p, { type: 'webmcp.result', id: calls[0].id, ok: true, value: 2 });
  assert.equal((await mine).value, 2);
});

test('narrowing a wide grant stops only the calls it no longer covers', async () => {
  const t = new FoafTools();
  const { p } = world(t, { reply: false });
  t.grants.grant('foafbot@localhost', '*', { level: 'all' });
  t.grants.grant('foafbot@localhost', 'docklands', { tools: ['go_to'] });
  const go = t.call('moglob', 'go_to', {}, { caller: BOT });
  const light = t.call('moglob', 'set_time', {}, { caller: BOT });
  await new Promise((r) => setTimeout(r));
  t.grants.revoke('foafbot@localhost', '*');
  assert.equal((await light).reason, 'revoked');
  assert.equal(p.pending.size, 1);
  t._drop(p, 'closed');
  assert.equal((await go).reason, 'closed');
});

test('grants survive a reload, defaults apply only to a shell with none, and bad stored ones are dropped', () => {
  const s = storage();
  const defaults = [{ caller: 'browser-agent', app: '*', level: 'look' }];
  const a = new ToolGrants({ storage: s, defaults });
  a.grant('foafbot@localhost', 'docklands', { tools: ['go_to'] });
  a.revoke('browser-agent');
  const b = new ToolGrants({ storage: s, defaults });
  assert.deepEqual(b.list().map((g) => g.caller), ['foafbot@localhost']);
  s.setItem('foafos.toolGrants', JSON.stringify([{ caller: 'not a jid', app: '*', level: 'all' }, { caller: 'a@b', app: 'x', tools: 'go_to' }, { caller: 'c@d', app: 'y', level: 'root' }]));
  assert.deepEqual(new ToolGrants({ storage: s }).list(), [{ caller: 'c@d', app: 'y', level: 'look', tools: [] }]);
});

test('the words for a grant', () => {
  assert.equal(describeGrant({ level: 'all', tools: [] }), 'everything');
  assert.equal(describeGrant({ level: 'look', tools: [] }), 'look only');
  assert.equal(describeGrant({ level: 'look', tools: ['go_to'] }), 'look, and go_to');
});

function shell() {
  const t = new FoafTools();
  world(t);
  const opened = [];
  const run = createChatCommands({ chat: { mirrors: () => false }, tools: t, bus: bus(), openApp: async (id) => opened.push(id), findApp: (n) => ({ id: n, name: n }) });
  return { t, run, opened };
}
const from = (jid) => ({ remote: { from: jid } });

test('/go and /where follow the account\'s grants', async () => {
  const { t, run } = shell();
  assert.match((await run('/go tower', from('foafbot@localhost'))).text, /may not do that/);
  t.grants.grant('foafbot@localhost', 'docklands');
  assert.doesNotMatch((await run('/where', from('foafbot@localhost'))).text, /may not/);
  assert.match((await run('/go tower', from('foafbot@localhost'))).text, /may not do that/);
  assert.match((await run('/call moglob go_to {"place":"x"}', from('foafbot@localhost'))).text, /may not do that/);
  t.grants.grant('foafbot@localhost', 'docklands', { tools: ['go_to'] });
  assert.match((await run('/go tower', from('foafbot@localhost'))).text, /Going to/);
});

test('/open and /bus are the shell\'s, and need their own grant', async () => {
  const { t, run, opened } = shell();
  t.grants.grant('foafbot@localhost', 'docklands', { level: 'all' });
  assert.match((await run('/open notes', from('foafbot@localhost'))).text, /may not do that/);
  assert.match((await run('/bus', from('foafbot@localhost'))).text, /may not do that/);
  assert.deepEqual(opened, []);
  t.grants.grant('foafbot@localhost', 'shell', { tools: ['open'] });
  assert.match((await run('/open notes', from('foafbot@localhost'))).text, /Opening/);
  assert.deepEqual(opened, ['notes']);
  assert.equal(t.grants.allows(BOT, SHELL_APP, { name: 'bus', readOnly: true }), true);
});

test('/grant, /grants and /revoke work in the Chat window, and never from outside it', async () => {
  const { t, run } = shell();
  t.grants.grant('me@localhost', '*', { level: 'all' });
  for (const c of ['/grant me@localhost moglob all', '/revoke foafbot@localhost', '/grants']) {
    assert.match((await run(c, from('me@localhost'))).text, /only in the Chat window/, c);
  }
  assert.match((await run('/grant foafbot@localhost moglob go_to')).text, /foafbot@localhost may use moglob: look, and go_to/);
  assert.equal(t.grants.list().find((g) => g.caller === 'foafbot@localhost').app, 'docklands');
  assert.match((await run('/grant agent * look')).text, /agent may use \*/);
  assert.match((await run('/grants')).text, /foafbot@localhost, docklands: look, and go_to/);
  assert.match((await run('/revoke foafbot@localhost moglob')).text, /Taken back/);
  assert.equal(t.grants.holds('foafbot@localhost'), false);
  assert.match((await run('/grant foafbot@localhost')).text, /Use \/grant/);
  assert.match((await run('/grant not-a-jid moglob look')).text, /Refused: bad-caller/);
});

test('/open says so when an app did not open', async () => {
  const t = new FoafTools();
  const run = createChatCommands({ chat: { mirrors: () => false }, tools: t, bus: bus(), openApp: async () => null, findApp: (n) => ({ id: n, name: 'Moglob' }) });
  assert.match((await run('/open moglob')).text, /Moglob did not open/);
});

test('the person is always allowed, whatever the grants say', () => {
  assert.equal(new ToolGrants().allows(PERSON, { id: 'x', slug: 'x' }, { name: 'y' }), true);
});

test('an owner account may use everything with no grant, and nobody else gains anything', () => {
  const g = new ToolGrants({});
  g.isOwner = (id) => id === 'me@example.org';
  const app = { id: 'docklands', slug: 'moglob' };
  assert.equal(g.holds('me@example.org'), true);
  assert.equal(g.allows(accountCaller('me@example.org'), app, { name: 'go_to' }), true);
  assert.equal(g.allowsAction(accountCaller('me@example.org'), app, 'pause'), true);
  assert.equal(g.holds('other@example.org'), false);
  assert.equal(g.allows(accountCaller('other@example.org'), app, { name: 'go_to' }), false);
});
