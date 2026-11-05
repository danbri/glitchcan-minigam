// The goal, end to end, against the real stack and the live Fly prototype.
//
// A sandboxed app reads and writes through every kind of pod. Then a client that is
// not ours joins the XMPP room, watches, and drives Moglob's WebMCP tools, and so does
// an AI. Windowed Chrome, because Moglob needs a GPU.
//
//   foafos-stack start && foafos-stack start proto
//   python3 -m venv /tmp/slix && /tmp/slix/bin/pip install slixmpp
//   SLIX_PYTHON=/tmp/slix/bin/python CHROMIUM_PATH=... FACTOIDAL=... node e2e-goal.mjs
//
// The laptop pod over HTTP-over-XMPP is packages/foafos/pod/test/e2e-shell.mjs, or
// `foafos-stack start pod-laptop` here (POD_LAPTOP=1).
import { execFile, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const { FACTOIDAL, SLIX_PYTHON, CHROMIUM_PATH } = process.env;
const DOMAIN = 'foafos-proto.fly.dev';
const CONF = join(homedir(), '.config/foafos-proto');
const account = (n) => readFileSync(join(CONF, 'accounts'), 'utf8').split('\n').find((l) => l.startsWith(`${n}:`)).slice(n.length + 1);
const TOKEN = readFileSync(join(CONF, 'token'), 'utf8').trim();
const ORIGIN = 'http://localhost:8080';
const SHELL = `${ORIGIN}/glitchcan-minigam/inklet/finkapp/?app=docklands&player=none&factoidal=/factoidal/`;
setTimeout(() => { console.log('DEADLINE'); process.exit(3); }, 280000);

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`); if (!ok) failed++; };
const outside = async (args, ms = 45000) => {
  const { stdout } = await promisify(execFile)(SLIX_PYTHON, ['-W', 'ignore', join(here, 'outside-client.py'), ...args], { timeout: ms }).catch((e) => ({ stdout: e.stdout || '' }));
  return stdout;
};

const browser = await chromium.launch({ headless: false, executablePath: CHROMIUM_PATH });
const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' };
await context.route(`${ORIGIN}/factoidal/**`, (route) => {
  const path = new URL(route.request().url()).pathname.slice('/factoidal/'.length);
  try { route.fulfill({ status: 200, contentType: TYPES[extname(path)] || 'application/octet-stream', body: readFileSync(join(FACTOIDAL, path)) }); }
  catch { route.fulfill({ status: 404, body: '' }); }
});
const page = await context.newPage();
page.on('framenavigated', (fr) => { if (fr === page.mainFrame()) console.log(`NAV ${fr.url().slice(0, 100)}`); });
page.on('crash', () => console.log('PAGE CRASHED'));
page.on('console', (m) => { if (/reload|refresh|update|version/i.test(m.text())) console.log(`LOG ${m.text().slice(0, 120)}`); });
let bot = null;

try {
  await page.goto(SHELL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.FoafOS?.tools && FoafOS.pods, null, { timeout: 30000 });
  await page.waitForFunction(() => FoafOS.tools.list().some((a) => a.tools.some((t) => t.name === 'go_to')), null, { timeout: 60000 });
  check(true, 'Moglob offers its WebMCP tools');

  await page.evaluate(({ token, foafos, DOMAIN }) => {
    const add = (rec, o) => { if (!FoafOS.pods.get(rec.id)) FoafOS.pods.add(rec, o); };
    add({ id: 'laptop-lws', label: 'This computer', base: 'http://127.0.0.1:3000/', carriage: 'https' });
    add({ id: 'fly-https', label: 'Fly, over HTTPS', base: `https://${DOMAIN}/`, carriage: 'https', auth: 'bearer' }, { password: token });
    add({ id: 'fly-xmpp', label: 'Fly, over XMPP', base: `https://pod.${DOMAIN}/`, carriage: 'xmpp', podJid: `pod@${DOMAIN}/lws`,
      relay: { url: 'ws://127.0.0.1:15280/xmpp-websocket', domain: DOMAIN, username: 'foafos' } }, { password: foafos });
  }, { token: TOKEN, foafos: account('foafos'), DOMAIN });
  await page.evaluate(() => FoafOS.launchApp('files'));
  let f = null;
  for (let i = 0; i < 80 && !f; i++) {
    const x = page.frames().find((y) => y.url().includes('apps/files/'));
    if (x && await x.evaluate(() => !!window.__files?.state().locations.length).catch(() => false)) f = x;
    else await page.waitForTimeout(250);
  }
  check(!!f, 'Files, a sandboxed app, is running');
  const sandboxed = await f.evaluate(() => { try { return parent.document ? 'reached' : 'refused'; } catch { return 'refused'; } });
  check(sandboxed === 'refused', 'its origin is opaque: parent.document is refused');

  const kinds = [['browser', 'ephemeral, in the browser'], ['device', 'device storage in the browser'], ['laptop-lws', 'laptop, over HTTP'], ['fly-https', 'remote, over HTTPS, on Fly'], ['fly-xmpp', 'remote, over HTTP-over-XMPP, on Fly']];
  if (process.env.POD_LAPTOP) {
    await page.evaluate(({ DOMAIN, foafos }) => FoafOS.pods.add({ id: 'laptop-xmpp', label: 'Laptop, over XMPP', base: `https://pod-laptop.${DOMAIN}/`, carriage: 'xmpp', podJid: `podlaptop@${DOMAIN}/lws`,
      relay: { url: 'ws://127.0.0.1:15280/xmpp-websocket', domain: DOMAIN, username: 'foafos' } }, { password: foafos }), { DOMAIN, foafos: account('foafos') });
    kinds.push(['laptop-xmpp', 'laptop, over HTTP-over-XMPP through Fly']);
  }
  for (const [id, words] of kinds) {
    const text = `written by a sandboxed app to ${id} at ${Date.now()}`;
    const r = await f.evaluate(async ({ id, text }) => {
      await window.__files.useLocation(id);
      const s = window.__files.state();
      const put = await foaf.pod.put('goal/hello.txt', text, { contentType: 'text/plain' });
      const get = await foaf.pod.get('goal/hello.txt');
      const list = await foaf.pod.list('goal/');
      return { current: s.current, status: s.locations.find((l) => l.id === id)?.status, put: put.ok || put.reason, body: get.body, listed: list.items?.map((i) => i.path) };
    }, { id, text });
    let outsideView = '';
    if (id === 'fly-https') {
      const seen = await fetch(`https://${DOMAIN}/goal/hello.txt`, { headers: { Authorization: `Bearer ${TOKEN}` } });
      outsideView = (await seen.text()) === text ? ', and seen on Fly from outside the browser' : ', NOT seen from outside';
    }
    const del = await f.evaluate(() => foaf.pod.delete('goal/hello.txt'));
    check(r.current === id && r.put === true && r.body === text && r.listed?.includes('hello.txt') && del.ok && !outsideView.includes('NOT'),
      `${words}: write, read, list, delete${outsideView}${r.put === true ? '' : ` (${JSON.stringify(r).slice(0, 160)})`}`);
  }

  // The room.
  const started = await page.evaluate(async ({ foafos, DOMAIN }) => {
    const c = FoafOS.chat;
    c.configure({ mode: 'server', url: 'ws://127.0.0.1:15280/xmpp-websocket', domain: DOMAIN, username: 'foafos', room: 'bus', roomDomain: `rooms.${DOMAIN}`, nick: `foafos-${Math.random().toString(16).slice(2, 6)}` }, { password: foafos });
    await c.stop?.(true);
    const r = await c.start();
    FoafOS.grants.grant(`me@${DOMAIN}`, 'docklands', { tools: ['go_to'] });
    FoafOS.grants.grant(`foafbot@${DOMAIN}`, 'docklands', { tools: ['go_to'] });
    return { r, state: c.state, detail: c.detail };
  }, { foafos: account('foafos'), DOMAIN });
  await page.waitForFunction(() => /in bus@/.test(FoafOS.chat.detail || ''), null, { timeout: 20000 }).catch(() => {});
  check(await page.evaluate(() => FoafOS.chat.state === 'online'), `the shell is in the Fly room (${JSON.stringify(started).slice(0, 100)})`);

  const camera = () => page.evaluate(async () => { const r = await FoafOS.chatCommand('/call moglob get_view'); return r.value?.target ? [r.value.target.lon, r.value.target.lat].map((n) => +n.toFixed(3)) : null; });
  const before = await camera();
  const human = outside([`me@${DOMAIN}`, account('me'), `bus@rooms.${DOMAIN}`, `person-${Date.now() % 100000}`, '9', `dm:foafos@${DOMAIN}:/go Tower Bridge`]);
  await page.waitForTimeout(3000);
  await page.evaluate(() => FoafOS.bus.publish('app.spawn', { summary: 'activity the room can see', id: 'x', appId: 'goal' }));
  const seen = await human;
  await page.waitForTimeout(1500);
  const moved = await camera();
  console.log(seen.split('\n').filter((l) => /^(SESSION|JOINED|SENT|DM|ROOM)/.test(l)).map((l) => `     ${l.slice(0, 110)}`).join('\n'));
  check(/^JOINED/m.test(seen), 'a client that is not ours (slixmpp) joins the room');
  check(/^ROOM .*(app\.spawn|activity)/m.test(seen), 'and it observes app activity in the room');
  check(/^DM foafos.*Going to/m.test(seen) && String(before) !== String(moved) && Math.abs(moved[0] + 0.075) < 0.02, `and it drives WebMCP: Moglob went from ${before} to ${moved}, Tower Bridge`);

  if (process.env.NO_AI !== '1') {
    bot = spawn('python3', [join(here, '../../tools/chat-ai.py'), '--tls', '--port', '15223', '--domain', DOMAIN, '--room', `bus@rooms.${DOMAIN}`, '--dir', CONF], { stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise((r) => bot.stdout.once('data', r));
    const said = await outside([`me@${DOMAIN}`, account('me'), `bus@rooms.${DOMAIN}`, `asker-${Date.now() % 100000}`, '22', 'say:@foafbot please go to Canary Wharf'], 60000);
    await page.waitForTimeout(2000);
    const after = await camera();
    console.log(said.split('\n').filter((l) => /^ROOM foafbot/.test(l)).map((l) => `     ${l.slice(0, 120)}`).join('\n'));
    check(/^ROOM foafbot/m.test(said) && String(after) !== String(moved), `an AI in the room drives WebMCP: Moglob went to ${after}`);
  }
} catch (e) { check(false, `exception: ${e.message.slice(0, 260)}`); }
try { bot?.kill(); } catch {}
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 4000))]);
console.log(failed ? `${failed} FAILED` : 'GOAL: ALL PASS');
process.exit(failed ? 1 : 0);
