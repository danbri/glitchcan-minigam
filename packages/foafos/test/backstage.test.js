import test from 'node:test';
import assert from 'node:assert/strict';
import { Backstage, actOf, describe, helpSections, helpText, ACTOR_TOPICS } from '../src/backstage.mjs';
import { DEFAULT_MIRROR } from '../src/chat.mjs';
import { eventBody } from '../src/bus-mirror.mjs';

const ev = (topic, data) => eventBody(topic, data, 2000);

test('every actor topic is on the shell default mirror list', () => {
  for (const t of ACTOR_TOPICS) assert.ok(DEFAULT_MIRROR.includes(t), t);
});

test('kinds: bot by nickname, shell by marker or name, you, member', () => {
  const b = new Backstage({ self: 'backstage-1a2b' });
  for (const n of ['foafbot', 'foafos-9f3c', 'shell2', 'me', 'backstage-1a2b', 'backstage-77aa']) b.presence(n);
  b.message('shell2', ev('app.spawn', { id: 'x' }), { marked: true });
  const kind = Object.fromEntries(b.snapshot().members.map((m) => [m.nick, m.kind]));
  assert.deepEqual(kind, { foafbot: 'bot', 'foafos-9f3c': 'shell', shell2: 'shell', me: 'member', 'backstage-1a2b': 'you', 'backstage-77aa': 'viewer' });
});

test('an unmarked message that looks like an event is talk, not an event', () => {
  const b = new Backstage();
  b.presence('me');
  b.message('me', ev('app.action', { id: 'playlist', action: 'queue', from: { label: 'me@x' } }));
  const s = b.snapshot();
  assert.equal(s.acts.length, 0);
  assert.equal(s.members[0].said, 1);
  assert.equal(s.members[0].kind, 'member');
});

test('actions are counted per caller, by the stamped account, not the nickname', () => {
  const b = new Backstage();
  b.presence('foafos');
  b.message('foafos', ev('app.action', { id: 'playlist', action: 'queue', from: { kind: 'account', label: 'foafbot@localhost' } }), { marked: true, ts: 1 });
  b.message('foafos', ev('tools.called', { app: 'moglob', tool: 'go_to', caller: 'foafbot@localhost', ok: false, summary: 'foafbot@localhost called Moglob go_to: not-granted' }), { marked: true, ts: 2 });
  b.message('foafos', ev('chat.refused', { from: 'stranger@localhost', reason: 'no-grant' }), { marked: true, ts: 3 });
  const s = b.snapshot();
  assert.deepEqual(s.callers.map((c) => [c.who, c.allowed, c.refused]), [['stranger@localhost', 0, 1], ['foafbot@localhost', 1, 1]]);
  assert.equal(s.acts[0].reason, 'no-grant');
  assert.equal(s.acts[1].reason, 'not-granted');
  assert.equal(s.acts[2].what, 'playlist queue');
});

test('actOf ignores other topics', () => {
  assert.equal(actOf('app.spawn', {}), null);
  assert.equal(actOf('app.action', null).who, 'someone');
});

test('describe gives lines with no markup', () => {
  const b = new Backstage();
  b.presence('foafbot');
  const lines = describe(b.snapshot(), { room: 'bus@rooms.localhost' });
  assert.match(lines[0], /bus@rooms\.localhost: 1 here/);
  assert.ok(lines.some((l) => /foafbot\s+bot/.test(l)));
});

test('help: one text per view, with the common parts in each', () => {
  for (const s of ['app', 'page', 'cli']) {
    const titles = helpSections(s).map(([t]) => t);
    for (const t of ['What it is', 'Members', 'Who acted', 'What it cannot see', 'Where it runs']) assert.ok(titles.includes(t), `${s}: ${t}`);
  }
  assert.match(helpText("cli"), /foafos-stack backstage \[local\|proto\|shared\] \[--as ACCOUNT\] \[--room NAME\]/);
  assert.match(helpText('page'), /RFC 7395/);
});
