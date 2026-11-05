import test from 'node:test';
import assert from 'node:assert/strict';
import { replyIsFrom } from '../src/xmpp-ws.mjs';
import { FoafChat } from '../src/chat.mjs';

const secrets = (pw) => ({ grant() {}, names: () => (pw ? ['chat.password'] : []), put() {},
  use: async (o, n, fn) => { if (!pw) return { ok: false, reason: 'missing' }; try { return { ok: true, result: await fn(pw) }; } catch { return { ok: false, reason: 'failed' }; } } });
const bus = { publish() {}, subscribe: () => () => {} };
const el = (name, attrs, kids = []) => ({ localName: name, getAttribute: (k) => attrs[k] ?? null, children: kids, textContent: attrs.text ?? '', firstElementChild: kids[0] || null });
const dm = (from, text) => el('message', { from, type: 'chat' }, [el('body', { text })]);

function connected(cfg = {}) {
  const sent = [];
  const x = { jid: 'foafos@localhost/foafos', send: (s) => sent.push(s), close() {} };
  const chat = new FoafChat({ bus, secrets: secrets('pw'), connect: async () => x });
  chat.configure({ mode: 'server', url: 'ws://127.0.0.1:1/x', domain: 'localhost', username: 'foafos', ...cfg });
  return { chat, x, sent };
}

test('a direct message runs a command only from an allowed account', async () => {
  const { chat, x, sent } = connected({ commandJids: ['me@localhost'] });
  await chat.start();
  const ran = [];
  chat.onCommand = async (t, { from }) => { ran.push([t, from]); return 'done'; };
  x.onstanza(dm('mallory@localhost/r', '/call moglob go_to {}'));
  await new Promise((r) => setTimeout(r));
  assert.deepEqual(ran, []);
  x.onstanza(dm('me@localhost/r', '/apps'));
  await new Promise((r) => setTimeout(r));
  assert.deepEqual(ran, [['/apps', 'me@localhost']]);
  assert.ok(sent.some((s) => s.includes('to="me@localhost"') && s.includes('done')));
});

test('nobody can send commands until an account is allowed', async () => {
  const { chat, x } = connected();
  await chat.start();
  let ran = false;
  chat.onCommand = async () => { ran = true; };
  x.onstanza(dm('me@localhost/r', '/apps'));
  await new Promise((r) => setTimeout(r));
  assert.equal(ran, false);
});

test('a room message is never a command, whatever its nickname', async () => {
  const { chat, x } = connected({ commandJids: ['me@localhost'] });
  await chat.start();
  let ran = false;
  chat.onCommand = async () => { ran = true; };
  x.onstanza(el('message', { from: 'bus@rooms.localhost/me@localhost', type: 'groupchat' }, [el('body', { text: '/apps' })]));
  await new Promise((r) => setTimeout(r));
  assert.equal(ran, false);
});

test('a refused login reports the reason, not "failed"', async () => {
  class XmppError extends Error {}
  const chat = new FoafChat({ bus, secrets: secrets('pw'), connect: async () => { throw new XmppError('SASL SCRAM-SHA-256 failed: not-authorized'); } });
  chat.configure({ mode: 'server', url: 'ws://127.0.0.1:1/x', domain: 'localhost', username: 'foafos' });
  assert.match((await chat.start()).reason, /not-authorized/);
});

test('any other failure keeps its message hidden, as it might hold the secret', async () => {
  const chat = new FoafChat({ bus, secrets: secrets('hunter2'), connect: async () => { throw new TypeError('bad url with hunter2'); } });
  chat.configure({ mode: 'server', url: 'ws://127.0.0.1:1/x', domain: 'localhost', username: 'foafos' });
  assert.doesNotMatch((await chat.start()).reason, /hunter2/);
});

test('a lost connection tries again, and stopping cancels that', async () => {
  const { chat, x } = connected();
  await chat.start();
  x.onclose();
  await new Promise((r) => setTimeout(r));
  assert.equal(chat.state, 'reconnecting');
  await chat.stop();
  assert.equal(chat.state, 'stopped');
});

test('mirrored events become events, and other talk stays talk', async () => {
  const { chat, x } = connected();
  await chat.start();
  const g = (nick, text) => x.onstanza(el('message', { from: `bus@rooms.localhost/${nick}`, type: 'groupchat' }, [el('body', { text })]));
  g('foafos', 'app.spawn {"summary":"Notes started"}');
  g('dan', 'app.spawn was fun');
  const [a, b] = chat.conversations.get('bus@rooms.localhost').messages;
  assert.equal(a.kind, 'event');
  assert.equal(a.data.summary, 'Notes started');
  assert.equal(b.kind, 'message');
});

test('an IQ reply counts only from the account the request went to', () => {
  const me = { jid: 'alice@localhost/foafos', domain: 'localhost' };
  const yes = (to, from) => assert.equal(replyIsFrom({ ...me, to, from }), true, `${to} ${from}`);
  const no = (to, from) => assert.equal(replyIsFrom({ ...me, to, from }), false, `${to} ${from}`);
  yes('pod@localhost/lws', 'pod@localhost/lws');
  yes('pod@localhost', 'pod@localhost/lws');
  yes('Pod@Localhost/lws', 'pod@localhost/lws');
  yes('pod@localhost/lws', 'pod@localhost');
  no('pod@localhost/lws', 'mallory@localhost/x');
  no('pod@localhost/lws', 'pod@localhost.evil/x');
  no('pod@localhost/lws', null);
  no('pod@localhost/lws', 'localhost');
  yes(null, null);
  yes(null, 'localhost');
  yes(null, 'alice@localhost');
  no(null, 'mallory@localhost/x');
  assert.equal(replyIsFrom({ to: null, from: 'mallory@localhost/x', jid: null, domain: 'localhost' }), false);
});
