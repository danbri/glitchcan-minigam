import test from 'node:test';
import assert from 'node:assert/strict';
import { redact, scrubText, eventBody, cleanName, neverMirrored, MIRROR_NS } from '../src/bus-mirror.mjs';
import { FoafChat } from '../src/chat.mjs';
import { createChatCommands } from '../src/chat-commands.mjs';
import { ToolGrants, accountCaller, PERSON } from '../src/tool-grants.mjs';

const secrets = { grant() {}, names: () => ['chat.password'], put() {}, use: async (o, n, fn) => ({ ok: true, result: await fn('pw') }) };
const el = (name, attrs, kids = [], ns = null) => ({ localName: name, namespaceURI: ns, getAttribute: (k) => attrs[k] ?? null, children: kids, textContent: attrs.text ?? '', firstElementChild: kids[0] || null });

function fakeBus() {
  const subs = [];
  const events = [];
  return { events, subscribe: (p, fn) => { subs.push(fn); return () => {}; },
    publish(topic, data = {}, { source = 'local' } = {}) { const e = { topic, data, source }; events.push(e); for (const s of [...subs]) s(e); return e; } };
}

async function connected(cfg = {}) {
  const bus = fakeBus();
  const sent = [];
  const x = { jid: 'foafos@localhost/foafos', send: (s) => sent.push(s), close() {} };
  const chat = new FoafChat({ bus, secrets, connect: async () => x });
  chat.configure({ mode: 'server', url: 'ws://127.0.0.1:1/x', domain: 'localhost', username: 'foafos', ...cfg });
  await chat.start();
  return { chat, x, sent, bus };
}
const room = 'bus@rooms.localhost';
const groupchat = (nick, text, kids = []) => el('message', { from: `${room}/${nick}`, type: 'groupchat' }, [el('body', { text }), ...kids]);
const marker = () => el('x', {}, [], MIRROR_NS);

test('secret keys and secret-looking text are removed, at any depth', () => {
  const out = JSON.stringify(redact({
    summary: 'fine', password: 'p1', apiKey: 'p2', headers: { Authorization: 'p3', cookie: 'p4' }, list: [{ token: 'p5' }],
    url: 'https://bob:p6@example.org/a?access_token=p7&page=2', text: 'Bearer abcdefgh12345678', pat: 'ghp_abcdefghijklmnopqrstuvwxyz012345',
    jwt: 'eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.c2lnbmF0dXJl', blob: 'A'.repeat(64),
    pem: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
  }));
  assert.ok(out.includes('fine') && out.includes('page=2'));
  for (const s of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'abcdefgh12345678', 'ghp_', 'eyJ', 'AAAA', 'BEGIN']) assert.ok(!out.includes(s), s);
});

test('redact bounds size and survives a cycle', () => {
  const a = { name: 'a' };
  a.self = a;
  assert.equal(redact(a).self, '(repeated)');
  let deep = {};
  for (let i = 0; i < 20; i++) deep = { deep };
  assert.ok(JSON.stringify(redact(deep)).includes('deeper data left out'));
  assert.equal(redact(Array(100).fill(1)).length, 33);
  assert.ok(scrubText('a b '.repeat(1000)).length <= 501);
  assert.equal(redact(() => 1), undefined);
});

test('text that would end an XML stream is removed', () => {
  assert.equal(scrubText('a￾b￿c'), 'abc');
  assert.equal(cleanName('app.x<y z>"'), 'app.x_y_z__');
});

test('a long event stays whole JSON', () => {
  const body = eventBody('a.b', { summary: 's', v: 'x'.repeat(5000) }, 2000);
  assert.deepEqual(JSON.parse(body.slice(4)), { truncated: true, summary: 's' });
});

test('some topics never go, even with * on the mirror list', async () => {
  for (const t of ['net.xmpp.message', 'secrets.use', 'chat.status', 'chat.message']) assert.ok(neverMirrored(t), t);
  const { chat, bus, sent } = await connected({ mirror: ['*'] });
  sent.length = 0;
  bus.publish('secrets.use', { name: 'x' });
  bus.publish('chat.message', { nick: 'a', body: 'b' });
  bus.publish('anything.else', { a: 1 });
  assert.equal(sent.length, 1);
  assert.ok(sent[0].includes('anything.else') && sent[0].includes(MIRROR_NS));
  await chat.stop();
});

test('an app is mirrored as the config says', async () => {
  const { chat, bus, sent } = await connected();
  const say = () => { sent.length = 0; bus.publish('app.x.y', { summary: 'held', token: 't0k3n' }, { source: 'guest:x#1' }); return sent.join(''); };
  assert.ok(say().includes('guest:x#1') && !sent[0].includes('held'));
  chat.configure({ mirrorApps: 'data' });
  assert.ok(say().includes('held') && !sent[0].includes('t0k3n'));
  chat.configure({ mirrorApps: 'off' });
  assert.equal(say(), '');
  assert.equal(chat.configure({ mirrorApps: 'all' }).ok, false);
  await chat.stop();
});

test('events from another tab or from the room are not mirrored', async () => {
  const { chat, bus, sent } = await connected({ mirror: ['*'] });
  sent.length = 0;
  bus.publish('audio.play', {}, { source: 'tab' });
  bus.publish('audio.play', {}, { source: 'net.xmpp' });
  assert.equal(sent.length, 0);
  await chat.stop();
});

test('one noisy app cannot fill the room, and the loss is reported', async () => {
  const { chat, bus, sent } = await connected();
  sent.length = 0;
  for (let i = 0; i < 30; i++) bus.publish('app.x.y', {}, { source: 'guest:x#1' });
  bus.publish('audio.play', {});
  assert.equal(sent.filter((s) => s.includes('app.x.y')).length, 5);
  assert.equal(sent.filter((s) => s.includes('audio.play')).length, 1);
  await new Promise((r) => setTimeout(r, 1050));
  assert.ok(sent.some((s) => s.includes('chat.dropped') && s.includes('25 events')));
  await chat.stop();
});

test('a marked stanza never goes onto the bus, and an unmarked one is not an event', async () => {
  const { chat, x, bus } = await connected();
  bus.events.length = 0;
  x.onstanza(groupchat('foafos', 'app.spawn {"summary":"Notes started"}', [marker()]));
  x.onstanza(groupchat('mallory', 'app.close {"id":"x"}', [marker()]));
  assert.deepEqual(bus.events, []);
  x.onstanza(groupchat('dan', 'app.close {"id":"x"}'));
  const msgs = chat.conversations.get(room).messages;
  assert.equal(msgs[0].kind, 'event');
  assert.equal(msgs[2].kind, 'message');
  assert.ok(bus.events.every((e) => e.source === 'net.xmpp'));
  assert.ok(bus.events.some((e) => e.topic === 'net.xmpp.message'));
  await chat.stop();
});

test('a mirror list of * does not loop', async () => {
  const { chat, x, sent } = await connected({ mirror: ['*'] });
  sent.length = 0;
  x.onstanza(groupchat('foafos', 'hello'));
  x.onstanza(groupchat('dan', 'hello'));
  assert.equal(sent.length, 0);
  await chat.stop();
});

test('room text onto the bus is bounded', async () => {
  const { chat, x, bus } = await connected();
  bus.events.length = 0;
  for (let i = 0; i < 40; i++) x.onstanza(groupchat('dan', 'x'.repeat(9000)));
  const got = bus.events.filter((e) => e.topic === 'net.xmpp.message');
  assert.equal(got.length, 20);
  assert.equal(got[0].data.body.length, 2000);
  await chat.stop();
});

test('commands are limited by rate and size, and refusals are announced', async () => {
  const { chat, x, bus } = await connected();
  chat.mayCommand = (j) => j === 'me@localhost';
  const ran = [];
  chat.onCommand = async (t) => { ran.push(t); return null; };
  const dm = (from, text) => x.onstanza(el('message', { from, type: 'chat' }, [el('body', { text })]));
  const refusals = () => bus.events.filter((e) => e.topic === 'chat.refused').map((e) => e.data);
  dm('mallory@localhost/r', '/apps');
  assert.deepEqual(refusals(), [{ summary: 'mallory@localhost refused: no-grant', from: 'mallory@localhost', reason: 'no-grant' }]);
  dm('me@localhost/r', `/apps ${'x'.repeat(5000)}`);
  assert.equal(refusals()[1].reason, 'too-large');
  for (let i = 0; i < 12; i++) dm('me@localhost/r', '/apps');
  await new Promise((r) => setTimeout(r));
  assert.equal(ran.length, 9);   // the oversized one counted
  assert.ok(refusals().some((d) => d.reason === 'too-fast'));
  await chat.stop();
});

test('a direct message carrying the marker is not a command', async () => {
  const { chat, x } = await connected();
  chat.mayCommand = () => true;
  let ran = false;
  chat.onCommand = async () => { ran = true; };
  x.onstanza(el('message', { from: 'me@localhost/r', type: 'chat' }, [el('body', { text: '/apps' }), marker()]));
  await new Promise((r) => setTimeout(r));
  assert.equal(ran, false);
  await chat.stop();
});

test('/tell needs the switch, a grant naming the action, and plain arguments', async () => {
  const bus = fakeBus();
  const grants = new ToolGrants();
  const told = [];
  let inbound = false;
  const run = createChatCommands({
    chat: { config: () => ({ inbound }), publicEvent: () => null }, tools: { grants }, bus,
    findApp: (n) => (n === 'playlist' ? { id: 'playlist', name: 'Playlist' } : null),
    deliver: (id, action, args, from) => { told.push({ id, action, args, from }); return action !== 'erase'; },
  });
  const remote = { from: 'me@localhost' };
  const tell = (line) => run(line, { remote });

  assert.match((await tell('/tell playlist play')).text, /switched off/);
  inbound = true;
  assert.match((await tell('/tell playlist play')).text, /may not do that/);
  grants.grant('me@localhost', 'playlist', { level: 'all' });
  grants.grant('me@localhost', '*', { tools: ['play'] });
  assert.match((await tell('/tell playlist play')).text, /may not do that/);
  assert.equal(told.length, 0);

  grants.grant('me@localhost', 'playlist', { tools: ['play', 'erase'] });
  assert.match((await tell('/tell playlist play {"track":"a"}')).text, /Sent play/);
  assert.deepEqual(told[0], { id: 'playlist', action: 'play', args: { track: 'a' }, from: { kind: 'account', label: 'me@localhost' } });
  assert.match((await tell('/tell playlist erase')).text, /no action erase/);

  told.length = 0;
  for (const bad of ['[1]', '{"a":{"b":1}}', '{"__proto__":"x"}', `{"a":"${'x'.repeat(600)}"}`]) await tell(`/tell playlist play ${bad}`);
  assert.equal(told.length, 0);
  assert.match((await tell(`/tell playlist play ${'x'.repeat(3000)}`)).text, /too large/);
  assert.equal((await tell('/tell nosuchapp play')).text.includes('may not'), true);
  assert.ok(bus.events.every((e) => e.topic === 'chat.refused' ? e.data.from === 'me@localhost' : true));
});

test('the person at the Chat window needs neither the switch nor a grant', async () => {
  const grants = new ToolGrants();
  assert.equal(grants.allowsAction(PERSON, { id: 'a', slug: 'a' }, 'x'), true);
  assert.equal(grants.allowsAction(accountCaller('a@b'), { id: 'a', slug: 'a' }, 'x'), false);
  assert.equal(grants.allowsAction({ kind: 'account', id: 'a@b' }, { id: 'a', slug: 'a' }, 'x'), false);
  const told = [];
  const run = createChatCommands({ chat: { config: () => ({ inbound: false }) }, tools: { grants }, findApp: (n) => ({ id: n, name: n }), deliver: (...a) => { told.push(a); return true; } });
  assert.match((await run('/tell a x')).text, /Sent x/);
  assert.equal(told.length, 1);
});
