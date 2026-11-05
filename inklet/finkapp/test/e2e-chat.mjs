// e2e-chat.mjs — the shell's bus room (FoafChat, docs/foafos-chat-20261103.md).
//
// 1. Built-in: the Factoidal Lean XMPP server runs in the page; the shell
//    joins bus@rooms.foafos.local and a mirrored bus event appears in the room.
// 2. Server: the Chat window points the shell at a localhost `xmpp-serve`
//    (the Node host, started here); an outside XMPP client joins the room,
//    sees the shell's events, and what it says reaches the shell's bus.
//
// Needs a @factoidal/core checkout with the message carrier (xmppMsg*):
//   FACTOIDAL=/path/to/factoidal-core/npm/factoidal node inklet/finkapp/test/e2e-chat.mjs
// The page loads it as a same-origin path (?factoidal=/factoidal/), served
// here by request routing.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, basename, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const serveRoot = resolve(repo, '..');
const FACTOIDAL = process.env.FACTOIDAL || resolve(repo, '../../factoidal-core/npm/factoidal');
if (!existsSync(join(FACTOIDAL, 'xmpp/inpage.mjs'))) { console.log(`SKIP no @factoidal/core with xmpp/inpage.mjs at ${FACTOIDAL}`); process.exit(0); }
const PORT = Number(process.env.PORT) || 18791;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHELL = `${ORIGIN}/${basename(repo)}/inklet/finkapp/?root=office&player=none&app=chat&factoidal=/factoidal/`;

let failed = 0;
const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (!cond) failed++; };

const site = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', serveRoot], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

// The localhost server (part 2): the same Node host as `factoidal xmpp-serve`.
const { listen } = await import(join(FACTOIDAL, 'xmpp/server.mjs'));
const xmpp = await listen({ domain: 'localhost', mucDomain: 'rooms.localhost', pollMs: 0, onError: () => {},
  accounts: [{ username: 'foafos', password: 'shell-pw-1' }, { username: 'me', password: 'me-pw-2' }],
  // The browser sends ORIGIN; the outside client here is Node, which sends none.
  websocket: { port: 0, path: '/xmpp-websocket', allowedOrigins: [ORIGIN], allowNoOrigin: true } });

const CONTAINER_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.CHROMIUM_PATH || (existsSync(CONTAINER_CHROME) ? CONTAINER_CHROME : undefined);
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(executablePath ? { executablePath } : { channel: 'chrome' }) });
const cleanup = async () => { try { await browser.close(); } catch {} try { await xmpp.close(); } catch {} try { site.kill(); } catch {} };

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' };
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.route(`${ORIGIN}/factoidal/**`, async (route) => {
  const path = new URL(route.request().url()).pathname.slice('/factoidal/'.length);
  try {
    route.fulfill({ status: 200, contentType: TYPES[extname(path)] || 'application/octet-stream', body: await readFile(join(FACTOIDAL, path)) });
  } catch { route.fulfill({ status: 404, body: 'not found' }); }
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  // ── 1. built-in ──
  await page.goto(SHELL);
  await page.waitForSelector('#foafos-chat', { timeout: 20000 });
  check(true, 'the Chat window opens from ?app=chat under ?root=office');
  await page.waitForFunction(() => ['online', 'error'].includes(FoafOS.chat.state), null, { timeout: 180000 });
  const st = await page.evaluate(() => ({ state: FoafOS.chat.state, detail: FoafOS.chat.detail, room: FoafOS.chat.roomJid() }));
  check(st.state === 'online', `built-in server: ${st.state} (${st.detail})`);
  check(st.room === 'bus@rooms.foafos.local', `the bus room is ${st.room}`);
  await page.evaluate(() => FoafOS.bus.publish('audio.play', { track: 3 }));
  await page.waitForFunction(() => FoafOS.chat.log.some((m) => m.body.startsWith('audio.play')), null, { timeout: 10000 });
  check(true, 'a mirrored bus event (audio.play) is in the built-in room');
  await page.evaluate(() => FoafOS.bus.publish('secrets.use', { name: 'x' }));
  await page.waitForTimeout(300);
  check(!(await page.evaluate(() => FoafOS.chat.log.some((m) => m.body.startsWith('secrets.')))), 'a topic not on the mirror list stays out of the room');

  // ── 2. localhost server ──
  await page.click('#foafos-chat .fc-status');
  await page.check('input[name=fc-place][value=other]');
  await page.fill('#chat-url', xmpp.wsOrigin);
  await page.fill('#chat-domain', 'localhost');
  await page.fill('#chat-username', 'foafos');
  await page.fill('#chat-password', 'shell-pw-1');
  await page.click('#foafos-chat .fc-connect .fc-actions .fc-primary');
  await page.waitForFunction(() => ['online', 'error'].includes(FoafOS.chat.state) && FoafOS.chat.config().mode === 'server', null, { timeout: 20000 });
  const s2 = await page.evaluate(() => ({ state: FoafOS.chat.state, detail: FoafOS.chat.detail, pw: document.getElementById('chat-password').value,
    stored: localStorage.getItem('foafos.chat') }));
  check(s2.state === 'online', `localhost server: ${s2.state} (${s2.detail})`);
  check(s2.pw === '' && !String(s2.stored).includes('shell-pw-1'), 'the password field is cleared and the password is not in localStorage');

  // An outside client, as Gajim would be: join the room, read, speak.
  const ws = new WebSocket(xmpp.wsOrigin, 'xmpp');
  const got = [];
  ws.addEventListener('message', (e) => got.push(String(e.data)));
  await new Promise((r) => ws.addEventListener('open', r));
  const next = async (pred, ms = 10000) => {
    const t0 = Date.now();
    for (;;) {
      const i = got.findIndex(pred);
      if (i >= 0) return got.splice(0, i + 1)[i];
      if (Date.now() - t0 > ms) throw new Error(`timed out; got ${JSON.stringify(got)}`);
      await new Promise((r) => setTimeout(r, 30));
    }
  };
  const open = "<open xmlns='urn:ietf:params:xml:ns:xmpp-framing' to='localhost' version='1.0'/>";
  ws.send(open); await next((m) => m.includes('<stream:features'));
  ws.send("<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='PLAIN'>" + btoa('\0me\0me-pw-2') + '</auth>');
  await next((m) => m.startsWith('<success'));
  ws.send(open); await next((m) => m.includes('<stream:features'));
  ws.send("<iq type='set' id='b'><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><resource>gajim</resource></bind></iq>");
  await next((m) => m.includes('<jid>'));
  ws.send("<presence to='bus@rooms.localhost/me'><x xmlns='http://jabber.org/protocol/muc'/></presence>");
  await next((m) => m.includes('bus@rooms.localhost/me') && m.includes('110'));
  check(true, 'an outside XMPP client joins bus@rooms.localhost');

  await page.evaluate(() => FoafOS.bus.publish('audio.pause', { at: 12 }));
  const seen = await next((m) => m.includes('audio.pause'));
  check(/from=["']bus@rooms\.localhost\/foafos["']/.test(seen), 'the outside client sees the shell\'s audio.pause, from bus@rooms.localhost/foafos');

  ws.send("<message to='bus@rooms.localhost' type='groupchat'><body>hello from gajim</body></message>");
  await page.waitForFunction(() => FoafOS.chat.log.some((m) => m.nick === 'me' && m.body === 'hello from gajim'), null, { timeout: 10000 });
  check(true, 'what the outside client says reaches the shell (chat log)');
  ws.close();

  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
} catch (e) {
  check(false, `exception: ${e.message}`);
} finally {
  await cleanup();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
