// The Pods tab against the real Fly server, from a page at https://danbri.github.io. Headless. Reads
// accounts from ~/.config/foafos-xmpp-fly/accounts and prints no password. Never signs in as me@.
// It only reads: HEAD and a listing of the root. LOCAL=<repo> serves the page from a checkout,
// at the same address, so a change can be tried before it is on Pages.
//   node test/live-fly.mjs [--shots DIR]
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const accounts = Object.fromEntries(readFileSync(join(homedir(), '.config/foafos-xmpp-fly/accounts'), 'utf8').trim().split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1)]));
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (shots) mkdirSync(shots, { recursive: true });
const SITE = 'https://danbri.github.io/glitchcan-minigam/';
let failed = 0, passed = 0;
const check = (c, w) => { console.log(`${c ? 'PASS' : 'FAIL'} ${w}`); if (c) passed++; else failed++; };
const exe = process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, ...(existsSync(exe) ? { executablePath: exe } : { channel: 'chrome' }) });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
if (process.env.LOCAL) {
  const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };
  await ctx.route(`${SITE}**`, (r) => {
    const path = new URL(r.request().url()).pathname.replace('/glitchcan-minigam/', '').replace(/\/$/, '/index.html');
    const file = join(process.env.LOCAL, path);
    return existsSync(file) ? r.fulfill({ status: 200, body: readFileSync(file), contentType: types[extname(file)] || 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } }) : r.continue();
  });
}
const page = await ctx.newPage();
const shot = (n) => shots ? page.screenshot({ path: join(shots, `${n}.png`) }) : null;
const card = '#foafos-pods section[data-pod="fly"]';
const says = (re) => page.waitForFunction(([c, s]) => new RegExp(s).test(document.querySelector(`${c} .pod-status`)?.textContent), [card, re.source], { timeout: 30000 });
const signIn = async (user, secret) => {
  if (user) await page.fill('#pod-fly-username', user);
  await page.fill('#pod-fly-password', secret);
  await page.click(`${card} .fp-signin button[type=submit]`);
};
try {
  await page.goto(`${SITE}inklet/finkapp/?root=office&app=pods`);
  await page.waitForSelector('#foafos-session-win #foafos-pods:not([hidden])', { timeout: 30000 });
  check(true, 'the live page opens the Pods tab of System');
  // edot boots under this root and comes to the front, as a person would see: press System to raise it.
  await page.waitForTimeout(2500);
  await page.evaluate(() => FoafOS.openSystem('pods'));
  await page.click('#foafos-pods [data-known="fly"] button');
  await page.waitForSelector('#pod-fly-username');
  await shot('live-1-add');
  await signIn('test1', 'not-the-password');
  await says(/did not accept this username and password/);
  check(true, 'Fly: a wrong password is refused, in words');
  await signIn('test1', accounts.test1);
  await says(/does not let it in/);
  check(await page.evaluate(() => FoafOS.pods.status('fly')) === 'needs-login', 'Fly: test1 logs in to the server and the pod refuses it (allow list)');
  await shot('live-2-not-on-list');
  await page.click('#pod-fly-way-https');
  await page.waitForFunction(() => !document.getElementById('pod-fly-username'));
  await signIn(null, 'not-the-token');
  await says(/did not accept this token/);
  check(true, 'Fly: a wrong token over HTTPS is refused, in words');
  await shot('live-3-token');
  await page.click('#pod-fly-way-xmpp');
  await page.waitForSelector('#pod-fly-username');
  await signIn('foafos', accounts.foafos);
  await page.waitForFunction(() => FoafOS.pods.status('fly') === 'online', null, { timeout: 30000 });
  check(true, 'Fly: the account on the allow list connects over XMPP');
  await page.click(`${card} button:text-is("Browse")`);
  await page.waitForFunction((c) => /\(200\)/.test(document.querySelector(c)?.textContent), card, { timeout: 30000 });
  check(true, 'Fly: the pod root lists over XMPP (200)');
  await shot('live-4-connected');
  await page.reload();
  await page.waitForSelector(`${card}`, { timeout: 30000 });
  const kept = await page.evaluate(() => ({ user: document.getElementById('pod-fly-username')?.value, pw: document.getElementById('pod-fly-password')?.value }));
  check(kept.user === 'foafos' && kept.pw === '', 'after a reload the server and username are there, and only the password is asked for');
  await shot('live-5-reload');
  const leaks = await page.evaluate((list) => { const all = JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))) + location.href; return list.filter((s) => all.includes(s)).length; }, [accounts.test1, accounts.foafos]);
  check(leaks === 0, 'no password in localStorage or the address');
} catch (e) { check(false, e.message.split('\n')[0]); await shot('live-failure'); }
await browser.close();
console.log(failed ? `${failed} FAILED, ${passed} passed` : `all ${passed} passed`);
process.exit(failed ? 1 : 0);
