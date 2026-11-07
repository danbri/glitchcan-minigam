// The flow a person uses, in the real shell: open System, open Pods, add the known server, sign
// in the wrong way and the right way, by account over XMPP and by token over HTTPS, keep the
// login, reload, unlock, still set up. Local relay and pod; the known-server list is replaced with
// one that points at them, and nothing else is stubbed. One store, two carriages, as on Fly:
// XMPP has an allow list, HTTPS has a bearer token in front. Then one app gets an extra pod (a
// second local storage), and Pod Notes' real frame tries what an app must not be able to do.
//
//   cd packages/foafos/pod && RELAY=factoidal FACTOIDAL_BIN=... node test/e2e-system.mjs [--shots DIR]
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import { openLwsStorage } from '@factoidal/core/lws';
import { chromium } from 'playwright';
import { startXmpp, parseRoute } from '../pod.mjs';
import { startRelay } from './relay.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const PORT = 18767, POD_PORT = 18789, EXTRA_PORT = 18790;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHELL = `${ORIGIN}/${basename(repo)}/inklet/finkapp/`;
const BASE = `http://127.0.0.1:${POD_PORT}/`;
const EXTRA_BASE = `http://127.0.0.1:${EXTRA_PORT}/`;
const PASSWORD = 'userpass-NOT-FOR-ANY-APP-91c3';
const OTHER = 'otherpass-NOT-FOR-ANY-APP-55d0';
const TOKEN = 'token-NOT-FOR-ANY-APP-7e2f';
const PASSPHRASE = 'a passphrase for this test';
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (shots) mkdirSync(shots, { recursive: true });

let failed = 0, passed = 0;
const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (cond) passed++; else failed++; };

const relay = await startRelay({ accounts: [['pod', 'podpass'], ['user', PASSWORD], ['other', OTHER]], origin: ORIGIN });
console.log(`relay: ${relay.name}`);
const storage = await openLwsStorage({ baseIri: BASE, insecureNoAuth: true, realClock: true });
const podXmpp = await startXmpp(storage, { service: relay.xmpp, domain: 'localhost', username: 'pod', password: 'podpass',
  allow: new Set(['user@localhost']), routes: [parseRoute('GET,HEAD,PUT,POST,PATCH,DELETE /')] });

// What Caddy does on Fly: the token, or 401. With no token set, an open pod.
const serve = (storage, token) => createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, if-match, if-none-match, link, accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'etag, content-type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (token && req.headers.authorization !== `Bearer ${token}`) { res.statusCode = 401; return res.end('token required'); }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = [];
  for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) if (!/^(authorization|origin)$/i.test(req.rawHeaders[i])) headers.push([req.rawHeaders[i], req.rawHeaders[i + 1]]);
  const a = await storage.step({ method: req.method, target: req.url, headers, body: new Uint8Array(Buffer.concat(chunks)) });
  for (const [k, v] of a.headers) res.appendHeader(k, String(v));
  res.statusCode = a.status;
  res.end(a.body);
});
const https = serve(storage, TOKEN);
await new Promise((r) => https.listen(POD_PORT, '127.0.0.1', r));
// A second pod, for the extra-pod checks.
const extraStorage = await openLwsStorage({ baseIri: EXTRA_BASE, insecureNoAuth: true, realClock: true });
const extraHttp = serve(extraStorage, null);
await new Promise((r) => extraHttp.listen(EXTRA_PORT, '127.0.0.1', r));

const CORS_SERVER = `
import http.server, functools
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', ${PORT}),
    functools.partial(H, directory='${resolve(repo, '..')}')).serve_forever()
`;
const site = spawn('python3', ['-c', CORS_SERVER], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const cleanup = () => { try { site.kill(); } catch {} relay.stop(); };
process.on('exit', cleanup);

const KNOWN = `export const KNOWN_PODS = [{ id: 'fly', label: 'Shared test server', base: ${JSON.stringify(BASE)}, note: 'A test.', ways: [
  { id: 'xmpp', title: 'Username and password', sub: 'Over XMPP', help: 'Account help.', carriage: 'xmpp', relay: { url: ${JSON.stringify(relay.ws)}, domain: 'localhost' }, podJid: 'pod@localhost/lws' },
  { id: 'https', title: 'Token', sub: 'Over HTTPS', help: 'Token help.', carriage: 'https', auth: 'bearer' }] }];`;

const CONTAINER_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.CHROMIUM_PATH || (existsSync(CONTAINER_CHROME) ? CONTAINER_CHROME : undefined);
const browser = await chromium.launch({ headless: true,
  args: ['--no-sandbox', ...(relay.insecureTls ? ['--ignore-certificate-errors'] : [])],
  ...(executablePath ? { executablePath } : { channel: 'chrome' }) });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 860 } });
await ctx.route('**/foafos-known-pods.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: KNOWN }));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const urls = [];
page.on('request', (r) => urls.push(r.url()));

const shot = async (name, p = page) => { if (shots) await p.screenshot({ path: join(shots, `${name}.png`) }); };
const card = (id) => `#foafos-pods section[data-pod="${id}"]`;
const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent || '', sel);
const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 20000 });
const statusIs = (id, s) => until(([i, want]) => FoafOS.pods.status(i) === want, [id, s]);
const openShell = async () => {
  await page.goto(`${SHELL}?root=office`);
  await until(() => window.FoafOS?.openSystem && FoafOS._mountPods);
};
const openTab = async () => {
  await page.evaluate(() => FoafOS.openSystem());
  await page.click('#foafos-session-win .fs-tabs [data-tab="pods"]');
  await page.waitForSelector('#foafos-session-win #foafos-pods:not([hidden])');
};
const signIn = async (id, { user, secret }) => {
  if (user !== undefined) await page.fill(`#pod-${id}-username`, user);
  await page.fill(`#pod-${id}-password`, secret);
  await page.click(`${card(id)} .fp-signin button[type=submit]`);
};

try {
  await openShell();

  // One UI: the launcher has no second door, and the old app is gone.
  const door = await page.evaluate(() => ({ row: !!FoafOS.apps && (window.__foafAppRegistry || []).some((a) => a.id === 'pods'), sys: (window.__foafAppRegistry || []).some((a) => a.id === 'system') }));
  check(!door.row && door.sys, 'no pods app in the registry, and System is there');
  await page.evaluate(() => { try { FoafOS.launchApp('pods'); } catch { /* refused */ } });
  await page.waitForTimeout(200);
  check(await page.evaluate(() => !document.getElementById('foafos-pods')?.isConnected), 'launching "pods" opens no old window');
  await openTab();
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#foafos-session-win .fs-tabs button')].map((b) => [b.textContent, b.dataset.tab]));
  check(tabs.every(([, t]) => t) && tabs.some(([l]) => l === 'Pods'), `Pods is a tab of System, not a button out (${tabs.map(([l]) => l).join(', ')})`);
  check(await page.evaluate(() => document.querySelectorAll('#foafos-pods').length === 1 && !/PodStore/.test(document.getElementById('foafos-session-win').textContent)), 'one pods surface, and it is in System');

  // The known server is offered, with no address to remember.
  await page.waitForSelector('#foafos-pods [data-known="fly"]');
  await shot('1-offered');
  await page.click('#foafos-pods [data-known="fly"] button');
  await page.waitForSelector(card('fly'));
  const ways = await page.evaluate((c) => [...document.querySelectorAll(`${c} .fp-way`)].map((w) => w.textContent), card('fly'));
  check(ways.length === 2 && /Username and password/.test(ways[0]) && /XMPP/.test(ways[0]) && /Token/.test(ways[1]) && /HTTPS/.test(ways[1]), `two ways to sign in, in plain words: ${ways.join(' | ')}`);
  await shot('2-sign-in');

  // Nothing typed.
  await page.click(`${card('fly')} .fp-signin button[type=submit]`);
  await page.waitForFunction((c) => /Enter your username/.test(document.querySelector(`${c} .fp-error`)?.textContent), card('fly'));
  check(true, 'an empty form says what is missing');

  // The wrong password, then an account the pod does not list, then the right one.
  await signIn('fly', { user: 'user', secret: 'wrong' });
  await statusIs('fly', 'needs-login');
  await until((c) => /did not accept this username and password/.test(document.querySelector(`${c} .pod-status`)?.textContent), card('fly'));
  check(true, 'a wrong password says so, and the form stays');
  await shot('3-wrong-password');
  await signIn('fly', { user: 'other', secret: OTHER });
  await until((c) => /does not let it in/.test(document.querySelector(`${c} .pod-status`)?.textContent), card('fly'));
  check(await page.evaluate(() => FoafOS.pods.status('fly')) === 'needs-login', 'an account not on the pod\'s list is told so, and is not called connected');
  await shot('4-not-on-list');
  await signIn('fly', { user: 'user@localhost', secret: PASSWORD });
  await statusIs('fly', 'online');
  await until((c) => /^Connected/.test(document.querySelector(`${c} .pod-status`)?.textContent), card('fly'));
  check(/as user@localhost/.test(await text(card('fly'))), 'signed in over XMPP; a full JID is taken as the username');
  await page.click(`${card('fly')} button:text-is("Make this the shared pod")`);
  check(await page.evaluate(() => FoafOS.pods.appsPod()) === 'fly', 'the pod is for apps');
  await shot('5-connected');

  // An app reaches it through the verbs.
  const put = await page.evaluate(() => { FoafOS.pods.grant('e2e', { 'pod:write': { pod: 'fly' }, 'pod:read': { pod: 'fly' } }); return FoafOS.pods.invoke('e2e', 'pod.put', { path: 'a.txt', body: 'over xmpp' }); });
  check(put.ok, `a file goes to the pod over XMPP (${put.status ?? put.reason})`);

  // Change to a token: the password goes, and the same files are there.
  await page.click(`${card('fly')} details.fp-more summary`);
  await page.click(`${card('fly')} button:text-is("Change how you sign in")`);
  await page.click(`#pod-fly-way-https`);
  await page.waitForFunction(() => document.querySelector('label:has(#pod-fly-password)')?.textContent.startsWith('Token'));
  check(!(await page.$('#pod-fly-username')), 'the token way asks for no username');
  await shot('6-token-way');
  await signIn('fly', { secret: 'bad-token' });
  await until((c) => /did not accept this token/.test(document.querySelector(`${c} .pod-status`)?.textContent), card('fly'));
  check(true, 'a wrong token says so');
  await signIn('fly', { secret: TOKEN });
  await statusIs('fly', 'online');
  // A grant for no live app does not outlast the next sync, so it is made again here.
  const read = await page.evaluate(() => { FoafOS.pods.grant('e2e', { 'pod:read': { pod: 'fly' } }); return FoafOS.pods.invoke('e2e', 'pod.get', { path: 'a.txt' }); });
  check(read.body === 'over xmpp', `the token way reads the same file over HTTPS (${JSON.stringify(read)})`);

  // Back to the account, then keep the login.
  await page.click(`${card('fly')} details.fp-more summary`).catch(() => {});
  await page.evaluate(() => document.querySelector('section[data-pod="fly"] details.fp-more').open = true);
  await page.click(`${card('fly')} button:text-is("Change how you sign in")`);
  await page.click('#pod-fly-way-xmpp');
  await signIn('fly', { user: 'user', secret: PASSWORD });
  await statusIs('fly', 'online');
  await page.waitForSelector('#pods-keep-pass');
  await shot('7-keep');
  await page.fill('#pods-keep-pass', PASSPHRASE);
  await page.click('#foafos-pods .fp-keep button[type=submit]');
  await until(() => FoafOS.secrets.sealed === true);
  await until(() => /saved on this device/.test(document.querySelector('#foafos-pods .fp-keep')?.textContent));
  check(true, 'the login is kept under a passphrase, from the Pods tab');

  const exposure = async () => page.evaluate((list) => {
    const all = JSON.stringify([FoafOS.pods.audit, FoafOS.secrets.audit, FoafOS.pods.list(), location.href,
      Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])),
      Object.fromEntries(Object.keys(sessionStorage).map((k) => [k, sessionStorage.getItem(k)]))]);
    return list.filter((s) => all.includes(s)).length;
  }, [PASSWORD, OTHER, TOKEN, PASSPHRASE]);
  check(await exposure() === 0, 'no password, token or passphrase in an audit line, a pod record, the URL or browser storage');

  // Reload: the setup is there, locked. Unlock connects it again.
  await page.reload();
  await page.waitForSelector('#foafos-unlock-ask');
  await shot('8-reload-unlock');
  await page.evaluate(() => document.querySelector('#foafos-unlock-ask button[type=button]').click());
  await until(() => window.FoafOS?.openSystem);
  await openTab();
  await page.waitForSelector(card('fly'));
  const locked = await text(`${card('fly')} .pod-status`);
  check(/Unlock/.test(locked) && /as user@localhost/.test(await text(card('fly'))), `after a reload the server and the account are still there: ${locked}`);
  check(!(await page.$('#pod-fly-password')), 'a locked login asks for the passphrase, not for the password again');
  await shot('9-locked');
  await page.click(`${card('fly')} button:text-is("Unlock")`);
  await page.fill('#foafos-unlock-ask input', PASSPHRASE);
  await page.click('#foafos-unlock-ask button[type=submit]');
  await statusIs('fly', 'online');
  check(await page.evaluate(() => FoafOS.pods.appsPod()) === 'fly', 'unlocking connects it again, and it is still the pod for apps');
  await until((c) => /^Connected/.test(document.querySelector(`${c} .pod-status`)?.textContent), card('fly'));
  await shot('10-connected-again');
  check(await exposure() === 0, 'no secret reached storage or the audit after unlock');

  // One app, one extra pod. The grant is the person's, in System; the app sees only a handle.
  await page.evaluate((base) => FoafOS.pods.add({ id: 'vault', label: 'My private vault', base, carriage: 'https' }), EXTRA_BASE);
  await page.evaluate(() => FoafOS.pods.connect('vault'));
  await statusIs('vault', 'online');
  await page.waitForSelector('#foafos-pod-extras #pod-extra-app');
  check(/Shared pod/.test(await text(`${card('fly')} .fp-head`)), 'the common pod is called the shared pod');
  const offered = await page.evaluate(() => ({
    apps: [...document.querySelectorAll('#pod-extra-app option')].map((o) => o.value),
    pods: [...document.querySelectorAll('#pod-extra-pod option')].map((o) => o.value) }));
  check(offered.apps.includes('podnotes') && !offered.apps.includes('files') && !offered.pods.includes('fly') && offered.pods.includes('vault'),
    `the grant place offers pod apps and pods that are not the shared pod (${JSON.stringify(offered)})`);
  check(/An app with two pods can copy data between them/.test(await text('#foafos-pod-extras')), 'the grant screen says that an app with two pods can copy between them');
  await page.selectOption('#pod-extra-app', 'podnotes');
  await page.selectOption('#pod-extra-pod', 'vault');
  await shot('12-extra-grant');
  await page.click('#foafos-pod-extras button:text-is("Give access")');
  await page.waitForSelector('#foafos-pod-extras .fp-extra[data-app="podnotes"][data-pod="vault"]');
  check(true, 'a person gives one app an extra pod in the Pods tab');
  await shot('13-extra-granted');

  await page.evaluate(() => FoafOS.launchApp('podnotes'));
  let notes = null;
  for (let i = 0; i < 80 && !notes; i++) {
    notes = page.frames().find((f) => f.url().includes('/apps/podnotes/'));
    if (!notes) await page.waitForTimeout(250);
  }
  await notes.waitForFunction(() => window.foaf?.pod?.extras, null, { timeout: 15000 });
  // A raw message, as a hostile app would send it: the SDK offers less than this.
  const raw = (verb, params) => notes.evaluate(([v, p]) => new Promise((resolve) => {
    const rid = `raw-${Math.random()}`;
    const on = (e) => { if (e.data?.rid === rid) { removeEventListener('message', on); resolve(e.data); } };
    addEventListener('message', on);
    parent.postMessage({ type: 'pod', rid, verb: v, params: p }, '*');
  }), [verb, params]);
  const seenByApp = [];
  const extras = await raw('pod.extras', {});
  seenByApp.push(extras);
  const handle = extras.extras?.[0]?.handle;
  check(extras.ok && extras.extras.length === 1 && /^extra-[0-9a-f]{16}$/.test(handle) && extras.extras[0].write === true, 'the app sees one neutral handle');
  const putExtra = await notes.evaluate((pod) => foaf.pod.put('a.txt', 'in the extra pod', { pod }), handle);
  const putShared = await notes.evaluate(() => foaf.pod.put('b.txt', 'in the shared pod'));
  const listExtra = await notes.evaluate((pod) => foaf.pod.list('', { pod }), handle);
  seenByApp.push(putExtra, putShared, listExtra);
  const onExtra = await fetch(`${EXTRA_BASE}apps/podnotes/a.txt`);
  check(putExtra.ok && onExtra.status === 200 && (await onExtra.text()) === 'in the extra pod', `a file goes to the extra pod, in the app's own folder (${putExtra.status ?? putExtra.reason})`);
  check((await fetch(`${EXTRA_BASE}apps/podnotes/b.txt`)).status === 404 && putShared.ok, 'with no handle a file goes to the shared pod');
  check(listExtra.items?.some((i) => i.path === 'a.txt') && !listExtra.items.some((i) => i.path === 'b.txt'), 'a list with the handle shows the extra pod');

  // What an app must not do. Each answer comes back from the real shell, through the frame.
  for (const pod of ['vault', 'fly', 'browser', EXTRA_BASE, 'My private vault', 'extra-0000000000000000']) {
    const r = await raw('pod.get', { path: 'a.txt', pod });
    seenByApp.push(r);
    check(r.reason === 'denied' && r.body === undefined, `pod "${pod}" as a target is refused the same way (${r.reason})`);
  }
  for (const verb of ['pod.locations', 'pod.use', 'pod.addFolder', 'pod.handlers', 'pod.openWith']) {
    const r = await raw(verb, { id: 'vault', app: 'podnotes', path: 'a.txt' });
    seenByApp.push(r);
    check(r.reason === 'denied', `${verb} is refused to an ordinary app (${r.reason})`);
  }
  for (const verb of ['pod.grantExtra', 'pod.ask', 'pods.list', 'pod.add']) {
    const r = await raw(verb, { id: 'vault', pod: 'vault' });
    seenByApp.push(r);
    check(r.reason === 'unknown-verb', `there is no ${verb} verb (${r.reason})`);
  }
  check((await raw('pod.put', { pod: handle, path: '../edot/x.txt', body: 'x' })).reason === 'bad-params', 'a handle does not leave the app\'s folder');
  check((await fetch(`${EXTRA_BASE}apps/edot/x.txt`)).status === 404, 'nothing was written outside the app\'s folder');
  await page.evaluate(() => FoafOS.pods.disconnect('vault'));
  const offlineSays = await raw('pod.get', { path: 'a.txt', pod: handle });
  seenByApp.push(offlineSays);
  check(offlineSays.reason === 'offline', `an extra pod that is offline says so (${offlineSays.reason})`);
  await page.evaluate(() => FoafOS.pods.connect('vault'));
  await statusIs('vault', 'online');
  const toldApp = JSON.stringify(seenByApp);
  check(!['vault', '"fly"', '127.0.0.1', 'localhost', 'My private'].some((w) => toldApp.includes(w)), `no answer to the app names a pod or an address (${toldApp.length} bytes read)`);

  // No shared pod: apps have no pod, and the extra pod is not picked in its place.
  await openTab();   // Notes opened on top of it
  await page.click(`${card('fly')} button:text-is("Stop sharing with apps")`);
  await until((c) => !/Shared pod/.test(document.querySelector(`${c} .fp-head`)?.textContent), card('fly'));
  const none = await notes.evaluate(async (pod) => ({ plain: (await foaf.pod.get('a.txt')).reason, aimed: (await foaf.pod.get('a.txt', { pod })).reason, extras: (await foaf.pod.extras()).extras }), handle);
  check(none.plain === 'no-pod' && none.aimed === 'denied' && none.extras.length === 0, `with no shared pod the app has no pod (${JSON.stringify(none)})`);
  check(await page.evaluate(() => FoafOS.pods.appsPod()) === null, 'no extra pod was made the shared pod');
  check(/no app can use an extra pod/.test(await text('#foafos-pod-extras')), 'the tab says so');
  await page.click(`${card('fly')} button:text-is("Make this the shared pod")`);
  await page.waitForFunction(() => document.querySelector('#foafos-pod-extras') && !/no app can use an extra pod/.test(document.querySelector('#foafos-pod-extras').textContent));
  check((await notes.evaluate((pod) => foaf.pod.get('a.txt', { pod }), handle)).body === 'in the extra pod', 'with a shared pod again the grant works');

  // Remove access, in the tab; give it again; a reload keeps it; removing the pod ends it.
  await page.click('#foafos-pod-extras .fp-extra button');
  await page.waitForFunction(() => !document.querySelector('#foafos-pod-extras .fp-extra'));
  check((await notes.evaluate((pod) => foaf.pod.get('a.txt', { pod }), handle)).reason === 'denied', 'Remove access ends it at once, in a running app');
  await page.click('#foafos-pod-extras button:text-is("Give access")');
  await page.waitForSelector('#foafos-pod-extras .fp-extra');
  const grantsKept = await page.evaluate(() => FoafOS.pods.extraGrants());
  await page.reload();
  await page.waitForSelector('#foafos-unlock-ask');
  await page.evaluate(() => document.querySelector('#foafos-unlock-ask button[type=button]').click());
  await until(() => window.FoafOS?.openSystem);
  check(JSON.stringify(await page.evaluate(() => FoafOS.pods.extraGrants())) === JSON.stringify(grantsKept) && grantsKept.length === 1, 'a reload keeps the grant, with its handle');
  await page.evaluate(() => FoafOS.pods.remove('vault'));
  check(await page.evaluate(() => FoafOS.pods.extraGrants().length === 0 && localStorage.getItem('foafos.pods.extras') === '[]' && FoafOS.pods.appsPod() === 'fly'), 'removing the pod removes its grant, and the shared pod stays');

  // The owner's state: an old "fly" record with a token that a reload lost, no saved logins.
  const fresh = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  await fresh.route('**/foafos-known-pods.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: KNOWN }));
  await fresh.addInitScript((base) => {
    if (!localStorage.getItem('foafos.pods')) localStorage.setItem('foafos.pods', JSON.stringify([{ id: 'fly', label: 'fly', base, carriage: 'https', auth: 'bearer', forApps: false }]));
  }, BASE);
  const p2 = await fresh.newPage();
  await p2.goto(`${SHELL}?root=office&app=pods`);
  await p2.waitForSelector('#foafos-session-win #foafos-pods:not([hidden])', { timeout: 20000 });
  await p2.waitForSelector(card('fly'));
  await p2.evaluate(() => FoafOS.pods.connect('fly'));
  await p2.waitForFunction((c) => /token/i.test(document.querySelector(`${c} .pod-status`)?.textContent), card('fly'));
  const words = await p2.evaluate((c) => document.querySelector(c).textContent, card('fly'));
  check(!/no access token set/.test(words) && /Enter your token/.test(words), 'the old error is gone: the card says what to do next');
  const both = await p2.evaluate((c) => document.querySelectorAll(`${c} .fp-way`).length, card('fly'));
  check(both === 2, 'an old fly record is offered a username and password too');
  const fit = await p2.evaluate(() => { const b = document.getElementById('foafos-pods').getBoundingClientRect(); return b.right <= innerWidth && b.left >= 0; });
  check(fit, 'the tab fits a phone');
  if (shots) await p2.screenshot({ path: join(shots, '11-phone-old-record.png') });
  await p2.click('#pod-fly-way-xmpp');
  await p2.waitForSelector('#pod-fly-username');
  await p2.fill('#pod-fly-username', 'user');
  await p2.fill('#pod-fly-password', PASSWORD);
  await p2.click(`${card('fly')} .fp-signin button[type=submit]`);
  await p2.waitForFunction(() => FoafOS.pods.status('fly') === 'online', null, { timeout: 20000 });
  check(true, 'the old record signs in with an account');
  await p2.reload();
  await p2.waitForSelector('#foafos-session-win #foafos-pods:not([hidden])', { timeout: 20000 });
  await p2.waitForSelector('#pod-fly-password');
  const kept = await p2.evaluate(() => ({ user: document.getElementById('pod-fly-username')?.value, pass: document.getElementById('pod-fly-password').value }));
  check(kept.user === 'user' && kept.pass === '', 'with no passphrase a reload keeps the setup and the username, and asks only for the password');
  await fresh.close();

  check(!urls.some((u) => [PASSWORD, OTHER, TOKEN].some((s) => u.includes(s))), 'no secret in any URL requested');
  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
} catch (e) {
  console.log(`FAIL ${e.message}`);
  await shot('failure').catch(() => {});
  failed++;
} finally {
  await browser.close();
  await podXmpp.stop().catch(() => {});
  https.close();
  extraHttp.close();
  storage.close();
  extraStorage.close();
  cleanup();
}
console.log(failed ? `${failed} FAILED, ${passed} passed` : `all ${passed} passed`);
if (failed && relay.stderr()) console.log(relay.stderr().slice(-1200));
process.exit(failed ? 1 : 0);
