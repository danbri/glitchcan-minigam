// e2e-bus-xmpp.mjs: the app bus over a real XMPP server (docs/foafos-bus-xmpp-20261105.md).
//
// Runs against the local stack, not a server of its own: the shell page comes
// from `foafos-stack`'s shell service and XMPP from its xmpp service, and two
// outside clients sign in over TCP, as any XMPP client does. It uses a new room,
// so it disturbs nothing else on that server.
//
//   foafos-stack start xmpp shell
//   node inklet/finkapp/test/e2e-bus-xmpp.mjs
//
// Accounts come from ~/foafos-xmpp/accounts. `foafos` is the shell, `foafbot`
// is the granted account and `me` holds nothing. Stop foafbot first, or its
// replies mix with these. SHELL_URL names another copy of the shell.

import { chromium } from 'playwright';
import { homedir } from 'node:os';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, accounts, wait } from './lib/xmpp-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const served = relative(join(homedir(), 'working/solid'), repo);
const SHELL = process.env.SHELL_URL || `http://localhost:8080/${served}/inklet/finkapp/?root=apps&player=none`;
const NS = 'urn:foafos:bus:0';
const ROOM = `e2e-bus-${Date.now().toString(36)}`;
const ROOM_JID = `${ROOM}@rooms.localhost`;
const SHELL_JID = 'foafos@localhost';
const AGENT_JID = 'foafbot@localhost';
const SHELL_TO = `${SHELL_JID}/foafos`;

let failed = 0;
const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (!cond) failed++; };

const fromRoom = (t) => t.includes(`from="${ROOM_JID}/foafos"`);
const reply = (t) => t.includes(`from="${SHELL_JID}/`) && t.includes('type="chat"');

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' }) });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
// Chat starts in the page by default, a 31 MB download. This test goes straight to the server.
await page.addInitScript(() => { try { if (window === top && !localStorage.getItem('foafos.chat')) localStorage.setItem('foafos.chat', '{"mode":"off"}'); } catch { /* a sandboxed frame */ } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

let agent, outsider;
try {
  await page.goto(SHELL);
  await page.waitForFunction(() => window.FoafOS?.chat && FoafOS.launchApp, null, { timeout: 60000 });
  await page.evaluate(() => {
    window.__seen = [];
    FoafOS.bus.subscribe('*', (e) => window.__seen.push({ topic: e.topic, source: e.source, data: e.data }));
    FoafOS.launchApp('chat');
    FoafOS.launchApp('playlist');
  });
  await page.waitForSelector('#foafos-chat', { timeout: 30000 });
  check(true, 'the Chat window opens under ?root=apps, beside the Playlist');

  // ── defaults, then connect through the Chat window ──
  const d = await page.evaluate(() => { const c = FoafOS.chat.config(); return { inbound: c.inbound, mirrorApps: c.mirrorApps }; });
  check(d.inbound === false && d.mirrorApps === 'topics', `defaults: inbound ${d.inbound}, apps mirrored as ${d.mirrorApps}`);
  await page.check('input[name=fc-place][value=computer]');
  await page.fill('#chat-username', 'foafos');
  await page.fill('#chat-password', accounts.foafos);
  await page.evaluate(() => document.querySelector('#foafos-chat .fc-advanced').open = true);
  await page.fill('#chat-room', ROOM);
  await page.fill('#chat-room-domain', 'rooms.localhost');
  check(!(await page.isChecked('#chat-inbound')), 'the Chat window shows actions from accounts as switched off');
  await page.click('#foafos-chat .fc-connect .fc-actions .fc-primary');
  await page.waitForFunction(() => ['online', 'error'].includes(FoafOS.chat.state), null, { timeout: 30000 });
  const st = await page.evaluate(() => `${FoafOS.chat.state} (${FoafOS.chat.detail})`);
  check(st.startsWith('online'), `the shell on the stack's XMPP server: ${st}`);
  await page.waitForFunction((r) => FoafOS.chat.conversations.get(r)?.joined, ROOM_JID, { timeout: 15000 });

  // The settings stay open from here: the two switches take effect while connected.
  await page.click('#foafos-chat .fc-status');
  await page.evaluate(() => document.querySelector('#foafos-chat .fc-advanced').open = true);

  agent = await Client.open('foafbot', { room: ROOM_JID, nick: 'agent' });
  outsider = await Client.open('me', { room: ROOM_JID, nick: 'outsider' });
  check(true, `two outside clients joined ${ROOM_JID}`);

  const frame = async () => {
    for (let i = 0; i < 200; i++) {
      const f = page.frames().find((x) => x.url().includes('/apps/playlist/'));
      if (f && await f.evaluate(() => !!window.foafos?.bus).catch(() => false)) return f;
      await wait(100);
    }
    throw new Error('no playlist frame');
  };
  const playlist = await frame();
  await wait(1000);   // its app.init
  const queueText = () => playlist.evaluate(() => document.querySelector('#queue').textContent);
  const seen = (fn) => page.evaluate(`window.__seen.filter(${fn})`);

  // ── monitoring: what the app itself publishes ──
  const probe = (tag) => playlist.evaluate((t) => foafos.bus.publish(`app.playlist.${t}`, {
    summary: 'tea is ready', apiToken: 'hunter2-token', nested: { password: 'hunter2-pw' },
    link: 'https://bob:hunter2-login@example.org/a?access_token=hunter2-query&x=1', note: 'Bearer hunter2hunter2hunter2',
  }), tag);
  await probe('probe1');
  const topicOnly = await agent.message((t) => t.includes('app.playlist.probe1'));
  console.log('     room saw:', /<body>([\s\S]*?)<\/body>/.exec(topicOnly || '')?.[1]);
  check(!!topicOnly && fromRoom(topicOnly), 'an app\'s own bus event appears in the room, from the shell');
  check(!!topicOnly && topicOnly.includes('"from":"guest:playlist#'), 'it names the sandboxed app that sent it');
  check(!!topicOnly && !topicOnly.includes('tea is ready'), 'by default the room gets no content from an app');
  check(!!topicOnly && topicOnly.includes(`xmlns="${NS}"`), 'the stanza carries the mirror marker');

  await page.selectOption('#chat-mirror-apps', 'data');
  await probe('probe2');
  const full = await agent.message((t) => t.includes('app.playlist.probe2'));
  console.log('     room saw:', /<body>([\s\S]*?)<\/body>/.exec(full || '')?.[1]);
  check(!!full && full.includes('tea is ready'), 'with apps set to data, the room gets what the app said');
  check(!!full && !full.includes('hunter2'), 'no password, token, login or bearer value reaches the room');
  await page.selectOption('#chat-mirror-apps', 'topics');

  await playlist.evaluate(() => foafos.bus.publish('wm.mode', { mode: 'forged' }));
  await wait(300);
  check((await seen("e => e.topic === 'sys.guest.denied'")).length > 0 && (await seen("e => e.topic === 'wm.mode' && e.data?.mode === 'forged'")).length === 0,
    'an app outside its scope is still stopped by scopeBus');

  await playlist.evaluate(() => { for (let i = 0; i < 40; i++) foafos.bus.publish('app.playlist.flood', { i }); });
  const dropped = await agent.message((t) => t.includes('chat.dropped'));
  check(!!dropped, `a flood is cut, and the room is told: ${/"summary":"([^"]*)/.exec(dropped || '')?.[1]}`);
  const flood = await page.evaluate((r) => FoafOS.chat.conversations.get(r).messages.filter((m) => m.topic === 'app.playlist.flood').length, ROOM_JID);
  check(flood <= 5, `no more than 5 of 40 flood events from one app went to the room (${flood})`);

  // ── inbound: every refusal first ──
  const channel = (await import(join(repo, 'inklet/apps/tv/channels.js'))).CHANNELS[0];
  const before = await queueText();
  const tell = `/tell playlist queue {"track":"${channel.id}"}`;
  const actions = () => seen("e => e.topic === 'app.action'");

  agent.dm(SHELL_TO, tell);
  const noGrant = await agent.message((t) => t.includes('chat.refused') && t.includes('no-grant'));
  check(!!noGrant && !(await actions()).length, 'an account with no grant is refused, and the room sees the refusal');

  await page.evaluate((j) => FoafOS.chatCommand(`/grant ${j} playlist queue`), AGENT_JID);
  agent.dm(SHELL_TO, tell);
  const off = await agent.message(reply);
  check(!!off && off.includes('switched off') && !(await actions()).length, 'with a grant but the switch off, the action is refused');

  await page.check('#chat-inbound');
  outsider.dm(SHELL_TO, tell);
  const outsiderRefused = await agent.message((t) => t.includes('chat.refused') && t.includes('me@localhost'));
  check(!!outsiderRefused && !(await outsider.message(reply, 1000)), 'an unauthorised account is refused, with no answer, even with the switch on');

  agent.say(tell);
  await page.waitForFunction(() => window.__seen.some((e) => e.topic === 'net.xmpp.message' && e.data?.body?.startsWith('/tell')), null, { timeout: 10000 });
  const roomText = (await seen("e => e.topic === 'net.xmpp.message'")).at(-1);
  check(roomText.source === 'net.xmpp' && !(await actions()).length, 'the same words said in the room are data, with source net.xmpp, and run nothing');
  check((await queueText()) === before, 'the app received nothing so far');

  // ── the allowed one ──
  agent.dm(SHELL_TO, tell);
  const sent = await agent.message(reply);
  check(!!sent && sent.includes('Sent queue'), 'the granted account is told the action was sent');
  await playlist.waitForFunction((who) => document.querySelector('#queue').textContent.includes(who) || document.querySelector('#msg').textContent.includes(who), AGENT_JID, { timeout: 10000 });
  console.log('     app shows:', (await playlist.evaluate(() => document.querySelector('#msg').textContent)));
  check(true, `an allowed message from ${AGENT_JID} reached the app in its sandboxed frame, with its JID as sender`);
  const mirroredAction = await outsider.message((t) => t.includes('app.action ') && t.includes(AGENT_JID));
  check(!!mirroredAction, 'everyone in the room sees that action');
  const now = await outsider.message((t) => t.includes('app.playlist.now'), 8000);
  check(!!now, 'the app\'s answer, app.playlist.now from its own frame, comes back to the room');

  // ── disallowed ones ──
  agent.dm(SHELL_TO, '/tell playlist pause');
  const notGranted = await agent.message(reply);
  check(!!notGranted && notGranted.includes('may not do that'), 'a verb outside the account\'s grant is refused');
  await page.evaluate((j) => FoafOS.chatCommand(`/grant ${j} playlist all`), AGENT_JID);
  agent.dm(SHELL_TO, '/tell playlist pause');
  const notByAll = await agent.message(reply);
  check(!!notByAll && notByAll.includes('may not do that'), 'level "all" does not reach actions: each verb must be named');
  await page.evaluate((j) => FoafOS.chatCommand(`/grant ${j} playlist erase`), AGENT_JID);
  agent.dm(SHELL_TO, '/tell playlist erase');
  const notOffered = await agent.message(reply);
  check(!!notOffered && notOffered.includes('no action erase') && (await seen("e => e.topic === 'app.action.refused'")).length === 1,
    'a verb the manifest does not offer is refused by deliverAction, even with a grant');
  agent.dm(SHELL_TO, `/tell playlist queue {"track":{"a":1}}`);
  const badArgs = await agent.message(reply);
  check(!!badArgs && (await actions()).length === 1, 'arguments that are not flat plain values are refused');
  agent.dm(SHELL_TO, `/tell playlist queue ${'x'.repeat(5000)}`);
  const tooBig = await agent.message((t) => t.includes('chat.refused') && t.includes('too-large'));
  check(!!tooBig, 'an oversized command is refused');

  // ── the loop guard ──
  agent.raw(`<message to='${ROOM_JID}' type='groupchat'><body>app.close {"forged":true}</body><x xmlns='${NS}' topic='app.close' source='local'/></message>`);
  await agent.message((t) => t.includes('forged'));
  await wait(400);
  const forged = await seen("e => JSON.stringify(e.data ?? {}).includes('forged') && e.topic !== 'wm.mode'");
  check(forged.length === 0, 'a stanza with the mirror marker never reaches the bus');
  const echoes = await seen("e => e.source === 'net.xmpp' && e.data?.nick === 'foafos'");
  check(echoes.length === 0, 'nothing the shell mirrored came back onto the bus');

  // ── off again, at once ──
  await page.uncheck('#chat-inbound');
  agent.dm(SHELL_TO, tell);
  const offAgain = await agent.message(reply);
  check(!!offAgain && offAgain.includes('switched off') && (await actions()).length === 1, 'switching off applies at once, with no reconnect');

  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
} catch (e) {
  check(false, `exception: ${e.message}`);
} finally {
  agent?.close(); outsider?.close();
  await browser.close();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
