// End to end through the real foafos shell (inklet/finkapp, ?root=office):
//
//   the Pods panel adds a home pod over XMPP, holds its password, connects
//   through the relay (RFC 7395), browses it, and marks it "apps use this";
//   Pod Notes, a sandboxed app (opaque origin), saves and reads a note through
//   foaf.pod.* and never sees the pod's address or the password;
//   attacks posted from INSIDE app frames are refused.
//
//   cd packages/foafos/pod && npm install && node test/e2e-shell.mjs
//   (relay and browser choice as in test/run.mjs; see test/relay.mjs)
import { spawn } from 'node:child_process';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { openLwsStorage } from '@factoidal/core/lws';
import { chromium } from 'playwright';
import { startXmpp, startHttp } from '../pod.mjs';
import { startRelay } from './relay.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const serveRoot = resolve(repo, '..');
const PORT = 18766;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHELL = `${ORIGIN}/${basename(repo)}/inklet/finkapp/?root=office&app=pods`;
const BASE = 'https://pod.example/';
const PASSWORD = 'userpass-NOT-FOR-ANY-APP-73b1';

let failed = 0;
const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (!cond) failed++; };

// 1. Relay, pod (HTTP on loopback for the test's own checks, XMPP for the browser).
const relay = await startRelay({ accounts: [['pod', 'podpass'], ['user', PASSWORD]], origin: ORIGIN });
console.log(`relay: ${relay.name}`);
const storage = await openLwsStorage({ baseIri: BASE, insecureNoAuth: true, realClock: true });
const http = await startHttp(storage, { port: 18788 });
const podXmpp = await startXmpp(storage, { service: relay.xmpp, domain: 'localhost', username: 'pod', password: 'podpass',
  allow: new Set(['user@localhost']) });
const viaHttp = (path, init) => fetch(`http://127.0.0.1:18788/${path}`, init);

// 2. The site, with CORS (sandboxed frames have an opaque origin; their module
//    scripts are fetched with Origin: null).
const CORS_SERVER = `
import http.server, functools
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', ${PORT}),
    functools.partial(H, directory='${serveRoot}')).serve_forever()
`;
const site = spawn('python3', ['-c', CORS_SERVER], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const cleanup = () => { try { site.kill(); } catch {} relay.stop(); };
process.on('exit', cleanup);

// 3. The browser.
const CONTAINER_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.CHROMIUM_PATH || (existsSync(CONTAINER_CHROME) ? CONTAINER_CHROME : undefined);
const browser = await chromium.launch({ headless: true,
  args: ['--no-sandbox', ...(relay.insecureTls ? ['--ignore-certificate-errors'] : [])],
  ...(executablePath ? { executablePath } : { channel: 'chrome' }) });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(SHELL);
  await page.waitForSelector('#foafos-pods', { timeout: 20000 });
  check(true, 'the Pods panel opens from ?app=pods under ?root=office');

  // Add the pod through the form.
  const fill = async (id, v) => page.fill(`#${id}`, v);
  await fill('pod-add-id', 'home');
  await fill('pod-add-label', 'Home pod');
  await fill('pod-add-base', BASE);
  await page.selectOption('#pod-add-carriage', 'xmpp');
  await fill('pod-add-relay', relay.ws);
  await fill('pod-add-domain', 'localhost');
  await fill('pod-add-username', 'user');
  await fill('pod-add-password', PASSWORD);
  await fill('pod-add-podjid', 'pod@localhost/lws');
  // The window redraws on every app and pod event; a click that lands during a redraw is lost
  // (the button it pressed is gone), so press again until the pod is there.
  for (let i = 0; i < 5 && !(await page.evaluate(() => FoafOS.pods.get('home'))); i++) {
    await page.click('#foafos-pods button[aria-label="Add this pod"]');
  }
  const added = await page.evaluate(() => FoafOS.pods.get('home'));
  check(added?.carriage === 'xmpp' && added.hasPassword === true, `pod added from the form, password held (${JSON.stringify(added && { status: added.status, hasPassword: added.hasPassword })})`);

  // Connect.
  await page.click('#foafos-pods section[data-pod="home"] button:text-is("CONNECT")');
  await page.waitForFunction(() => FoafOS.pods.status('home') !== 'connecting' && FoafOS.pods.status('home') !== 'offline', null, { timeout: 20000 });
  const status = await page.evaluate(() => FoafOS.pods.get('home'));
  check(status.status === 'online', `connect through the relay: ${status.status}${status.detail ? ` (${status.detail})` : ''}`);
  await page.waitForFunction(() => /^online/.test(document.querySelector('#foafos-pods section[data-pod="home"] .pod-status')?.textContent || ''));
  check(true, 'the panel shows the pod online');

  // Browse the storage root.
  await page.click('#foafos-pods section[data-pod="home"] button:text-is("BROWSE")');
  await page.waitForFunction(() => /\/ {2}\(200\)/.test(document.querySelector('#foafos-pods section[data-pod="home"]')?.textContent || ''));
  check(true, 'BROWSE lists the storage root (200)');

  // Apps use this pod; launch Pod Notes.
  await page.click('#foafos-pods section[data-pod="home"] button:text-is("APPS USE THIS")');
  check(await page.evaluate(() => FoafOS.pods.appsPod()) === 'home', 'the pod is marked "apps use this"');
  await page.evaluate(() => FoafOS.launchApp('podnotes'));
  let notes = null;
  for (let i = 0; i < 80 && !notes; i++) {
    notes = page.frames().find((f) => f.url().includes('/apps/podnotes/'));
    if (!notes) await page.waitForTimeout(250);
  }
  await notes.waitForFunction(() => window.__podnotes && !/Starting/.test(document.getElementById('status').textContent), null, { timeout: 15000 });
  const grants = await page.evaluate(() => FoafOS.pods.holders());
  check(grants.some((g) => g.appId === 'podnotes' && g.capability === 'pod:write' && g.prefix === 'apps/podnotes/'),
    `Pod Notes holds pod:read and pod:write on apps/podnotes/ (${JSON.stringify(grants)})`);

  // The frame is sandboxed: no reach into the shell.
  const boxed = await notes.evaluate(() => { try { return String(parent.document.title); } catch (e) { return `refused: ${e.name}`; } });
  check(boxed.startsWith('refused'), `Pod Notes is at an opaque origin: parent.document ${boxed}`);

  // Save a note through the buttons.
  await notes.fill('#name', 'hello');
  await notes.fill('#text', 'kept at home, reached over XMPP');
  await notes.click('#save');
  // Not the status line: "Saved hello." is replaced by the listing as soon as refresh() ends.
  await notes.waitForFunction(() => window.__podnotes.state().current?.name === 'hello', null, { timeout: 15000 });
  const onPod = await viaHttp('apps/podnotes/notes/hello.txt');
  check(onPod.status === 200 && (await onPod.text()) === 'kept at home, reached over XMPP', `the note is in the pod at apps/podnotes/notes/hello.txt (${onPod.status})`);
  const listed = await notes.evaluate(() => [...document.querySelectorAll('#notes button')].map((b) => b.textContent));
  check(JSON.stringify(listed) === '["hello"]', `the app lists its notes: ${JSON.stringify(listed)}`);

  // Another device changes the note; the app's stale save is refused, not lost.
  const cur = await viaHttp('apps/podnotes/notes/hello.txt');
  const other = await viaHttp('apps/podnotes/notes/hello.txt', { method: 'PUT', body: 'changed on the laptop',
    headers: { 'Content-Type': 'text/plain', 'If-Match': cur.headers.get('etag') } });
  check(other.ok, `another device changes the note over HTTP (${other.status})`);
  await notes.fill('#text', 'stale edit');
  await notes.click('#save');
  await notes.waitForFunction(() => /changed elsewhere/.test(document.getElementById('status').textContent), null, { timeout: 15000 });
  check((await (await viaHttp('apps/podnotes/notes/hello.txt')).text()) === 'changed on the laptop', 'a stale save is refused (412) and the other device\'s text is kept');

  // Attacks from inside the frame.
  const attacks = await notes.evaluate(async () => {
    const out = {};
    out.traversal = (await foaf.pod.put('../edot/evil.txt', 'x')).reason;
    out.deep = (await foaf.pod.get('notes/../../../x')).reason;
    out.unknown = await new Promise((resolve) => {
      const rid = 'raw1';
      const on = (e) => { if (e.data?.rid === rid) { removeEventListener('message', on); resolve(e.data.reason); } };
      addEventListener('message', on);
      parent.postMessage({ type: 'pod', rid, verb: 'pod.chmod', params: { path: 'x' } }, '*');
    });
    const ls = await foaf.pod.list('');
    out.listing = JSON.stringify(ls);
    return out;
  });
  check(attacks.traversal === 'bad-params' && attacks.deep === 'bad-params', `traversal refused from inside the frame (${attacks.traversal}, ${attacks.deep})`);
  check(attacks.unknown === 'unknown-verb', `an unknown pod verb is refused (${attacks.unknown})`);
  check(!attacks.listing.includes('pod.example') && !attacks.listing.includes('localhost') && !attacks.listing.includes(PASSWORD),
    'what the app receives names neither the pod, the relay nor the password');
  const outside = await viaHttp('apps/edot/evil.txt');
  check(outside.status === 404, `nothing was written outside the app's container (${outside.status})`);

  // An app without the capability: Calendar holds storage, not pod:*.
  await page.evaluate(() => FoafOS.launchApp('calendar'));
  let cal = null;
  for (let i = 0; i < 80 && !cal; i++) {
    cal = page.frames().find((f) => f.url().includes('/calendar'));
    if (!cal) await page.waitForTimeout(250);
  }
  await cal.waitForFunction(() => window.foaf, null, { timeout: 15000 });
  const calTry = await cal.evaluate(async () => (await foaf.pod.list('')).reason);
  check(calTry === 'denied', `an app without pod:read is refused (${calTry})`);

  // No pod for apps: the app is told what to do, not given a silent failure.
  await page.evaluate(() => FoafOS.pods.setAppsPod(null));
  const noPod = await notes.evaluate(async () => (await foaf.pod.list('notes/')).reason);
  check(noPod === 'no-pod', `with no pod chosen for apps the verb answers ${noPod}`);

  // The password is nowhere an app or the page's storage could read it.
  const exposure = await page.evaluate((pw) => {
    const all = JSON.stringify([FoafOS.pods.audit, FoafOS.secrets.audit, FoafOS.pods.list(),
      Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))]);
    return { leaked: all.includes(pw), formEmpty: document.getElementById('pod-add-password')?.value === '' };
  }, PASSWORD);
  check(!exposure.leaked, 'the password is in no audit line, pod record or localStorage key');
  check(exposure.formEmpty, 'the password field was cleared after ADD');

  // The pod goes offline: the panel says so on the next connect.
  await podXmpp.stop();
  await page.evaluate(() => FoafOS.pods.connect('home'));
  const off = await page.evaluate(() => FoafOS.pods.get('home'));
  check(off.status === 'error' && /offline/.test(off.detail), `pod offline: ${off.status} (${off.detail})`);

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
} catch (e) {
  console.log(`FAIL ${e.message}`);
  failed++;
} finally {
  await browser.close();
  http.close();
  storage.close();
  cleanup();
}
console.log(failed ? `${failed} FAILED` : 'all passed');
if (failed && relay.stderr()) console.log(relay.stderr().slice(-1500));
process.exit(failed ? 1 : 0);
