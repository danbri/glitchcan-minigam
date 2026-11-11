// e2e-chat-shared.mjs: two shells and an outside client on the shared test server.
// Design: docs/foafos-shared-xmpp-20261105.md.
//
// Uses the PUBLIC server wss://foafos-xmpp.fly.dev, the local shell page from
// `foafos-stack start shell`, and the accounts in ~/.config/foafos-xmpp-fly/accounts.
// `foafos` and `test2` are the shells, and `me` is the outside client over direct TLS.
// It prints no password.
//
//   node inklet/finkapp/test/e2e-chat-shared.mjs

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { connect } from 'node:tls';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOMAIN = 'foafos-xmpp.fly.dev';
const ROOM = `bus@rooms.${DOMAIN}`;
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SHELL = process.env.SHELL_URL || `http://localhost:8080/${relative(join(homedir(), 'working/solid'), repo)}/inklet/finkapp/?root=apps&player=none`;
const accounts = Object.fromEntries(readFileSync(join(homedir(), '.config/foafos-xmpp-fly/accounts'), 'utf8').split('\n')
  .filter((l) => l.includes(':')).map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1)]));

let failed = 0;
const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (!cond) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The outside client: raw XML over certificate-checked direct TLS.
async function outside(account, nick) {
  const c = { got: '' };
  c.s = connect({ host: DOMAIN, port: 5223, servername: DOMAIN });
  c.s.setEncoding('utf8');
  c.s.on('data', (d) => { c.got += d; });
  c.until = async (re, ms = 15000) => {
    for (let t = 0; t < ms; t += 50) { const m = re.exec(c.got); if (m) return m; await wait(50); }
    throw new Error(`timed out waiting for ${re}`);
  };
  const stream = `<?xml version='1.0'?><stream:stream to='${DOMAIN}' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams' version='1.0'>`;
  c.s.write(stream); await c.until(/<\/stream:features>/);
  c.s.write(`<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='PLAIN'>${Buffer.from(`\0${account}\0${accounts[account]}`).toString('base64')}</auth>`);
  await c.until(/<success/); c.got = '';
  c.s.write(stream); await c.until(/<\/stream:features>/);
  c.s.write(`<iq type='set' id='b'><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><resource>e2e-${Date.now()}</resource></bind></iq>`);
  await c.until(/<jid>/);
  c.s.write(`<presence to='${ROOM}/${nick}'><x xmlns='http://jabber.org/protocol/muc'/></presence>`);
  await c.until(/code="110"|code='110'/);
  return c;
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], channel: 'chrome' });
async function shell(account) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => { try { if (window === top && !localStorage.getItem('foafos.chat')) localStorage.setItem('foafos.chat', '{"mode":"off"}'); } catch { /* a sandboxed frame */ } });
  await page.goto(SHELL);
  await page.waitForFunction(() => window.FoafOS?.chat && FoafOS.launchApp, null, { timeout: 60000 });
  await page.evaluate(() => { FoafOS.launchApp('chat'); FoafOS.launchApp('playlist'); });
  await page.waitForSelector('#foafos-chat', { timeout: 30000 });
  await page.check('input[name=fc-place][value=shared]');
  await page.fill('#chat-username', account);
  await page.fill('#chat-password', accounts[account]);
  await page.click('#foafos-chat .fc-connect .fc-actions .fc-primary');
  await page.waitForFunction(() => ['online', 'error'].includes(FoafOS.chat.state), null, { timeout: 30000 });
  const state = await page.evaluate(() => `${FoafOS.chat.state} ${FoafOS.chat.detail}`);
  check(state.startsWith('online'), `shell as ${account}: ${state}`);
  await page.waitForFunction((r) => FoafOS.chat.conversations.get(r)?.joined, ROOM, { timeout: 15000 });
  return page;
}

let client;
try {
  const a = await shell('foafos');
  const b = await shell('test2');
  const c = await a.evaluate(() => { const k = FoafOS.chat.config(); return { nick: k.nick, mirrorApps: k.mirrorApps, inbound: k.inbound }; });
  check(c.mirrorApps === 'topics' && c.inbound === false, `defaults stay: apps ${c.mirrorApps}, inbound ${c.inbound}, nick ${c.nick}`);
  client = await outside('me', `outside-${Date.now().toString(36)}`);
  check(true, `outside client joined ${ROOM}`);

  let playlist;
  for (let i = 0; i < 200 && !playlist; i++) {
    const f = a.frames().find((x) => x.url().includes('/apps/playlist/'));
    if (f && await f.evaluate(() => !!window.foafos?.bus).catch(() => false)) playlist = f;
    else await wait(100);
  }
  await wait(1000);
  const tag = `probe${Date.now().toString(36)}`;
  await playlist.evaluate((t) => foafos.bus.publish(`app.playlist.${t}`, { summary: 'tea is ready' }), tag);
  const m = await client.until(new RegExp(`<message[^>]*>(?:(?!</message>)[\\s\\S])*app\\.playlist\\.${tag}[\\s\\S]*?</message>`));
  console.log('     outside client saw:', /<body>([\s\S]*?)<\/body>/.exec(m[0])?.[1]);
  check(m[0].includes('guest:playlist#'), 'the Playlist topic reaches the outside client, naming the sandboxed app');
  check(!m[0].includes('tea is ready'), 'the room gets the topic and no content');
  await b.waitForFunction(([r, t]) => FoafOS.chat.conversations.get(r)?.messages.some((x) => JSON.stringify(x).includes(t)), [ROOM, tag], { timeout: 10000 });
  check(true, 'the second shell sees the same event');
  const hello = `hello from outside ${tag}`;
  client.s.write(`<message to='${ROOM}' type='groupchat'><body>${hello}</body></message>`);
  await a.waitForFunction(([r, t]) => FoafOS.chat.conversations.get(r)?.messages.some((x) => x.body === t), [ROOM, hello], { timeout: 10000 });
  check(true, 'the shell shows what the outside client said');
} catch (e) { check(false, e.message); } finally {
  client?.s.destroy();
  await browser.close();
}
console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
