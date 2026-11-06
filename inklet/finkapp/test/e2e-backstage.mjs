// e2e-backstage.mjs: the three Backstage views see the same room (docs/foafos-backstage-20261106.md).
//
// A real shell joins a new room on the stack's XMPP server. An account with no grant
// sends it a command by direct message, and the shell refuses it (chat.refused, on the
// default mirror list). Then each view must name that account and that refusal:
// the Backstage panel in the shell, backstage.html as an outside client, and
// `foafos-stack backstage --json`. Each view's /help must open.
//
//   foafos-stack start xmpp shell
//   node inklet/finkapp/test/e2e-backstage.mjs
//
// Accounts come from ~/foafos-xmpp/accounts: `foafos` is the shell, `me` holds no
// grant, `foafbot` signs in the page and the command (it only reads).
// SHELL_URL names another copy of the shell; CHROMIUM_PATH another browser.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, accounts, wait } from './lib/xmpp-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const served = relative(join(homedir(), 'working/solid'), repo);
const SHELL = process.env.SHELL_URL || `http://localhost:8080/${served}/inklet/finkapp/?root=apps&player=none`;
const PAGE = new URL('backstage.html', SHELL).href;
const ROOM = `e2e-backstage-${Date.now().toString(36)}`;
const ROOM_JID = `${ROOM}@rooms.localhost`;
const SHELL_TO = 'foafos@localhost/foafos';
const SENDER = 'me@localhost';

let failed = 0;
const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (!cond) failed++; };

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' }) });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const shell = await context.newPage();
await shell.addInitScript(() => { try { if (window === top && !localStorage.getItem('foafos.chat')) localStorage.setItem('foafos.chat', '{"mode":"off"}'); } catch { /* a sandboxed frame */ } });
const errors = [];
shell.on('pageerror', (e) => errors.push(`shell: ${e.message}`));

let sender;
const refuse = () => sender.dm(SHELL_TO, '/where');
try {
  // ── a shell in a new room ──
  await shell.goto(SHELL);
  await shell.waitForFunction(() => window.FoafOS?.chat && FoafOS.launchApp, null, { timeout: 60000 });
  await shell.evaluate(() => FoafOS.launchApp('chat'));
  await shell.waitForSelector('#foafos-chat');
  await shell.check('input[name=fc-place][value=computer]');
  await shell.fill('#chat-username', 'foafos');
  await shell.fill('#chat-password', accounts.foafos);
  await shell.evaluate(() => document.querySelector('#foafos-chat .fc-advanced').open = true);
  await shell.fill('#chat-room', ROOM);
  await shell.fill('#chat-room-domain', 'rooms.localhost');
  await shell.click('#foafos-chat .fc-connect .fc-actions .fc-primary');
  await shell.waitForFunction((r) => FoafOS.chat.conversations.get(r)?.joined, ROOM_JID, { timeout: 30000 });
  check(true, `the shell is in ${ROOM_JID}`);
  sender = await Client.open('me', { resource: 'e2e-backstage' });

  // ── 1. the panel in the shell ──
  check(await shell.evaluate(() => typeof FoafOS.openBackstage === 'function'), 'the shell has a Backstage panel');
  await shell.evaluate(() => FoafOS.launchApp('backstage'));
  await shell.waitForSelector('#foafos-backstage .bs-summary');
  refuse();
  await shell.waitForFunction((who) => document.querySelector('#foafos-backstage')?.textContent.includes(who), SENDER, { timeout: 15000 }).catch(() => {});
  const panel = await shell.evaluate(() => document.querySelector('#foafos-backstage').textContent);
  check(panel.includes(SENDER) && panel.includes('no-grant'), 'the panel names the refused account and the reason');
  check(/foafos\s*shell/.test(panel), 'the panel shows the shell as kind "shell"');
  check(panel.includes('Grants in this browser'), 'the panel lists the grants in this browser');
  await shell.click('#foafos-backstage .bs-bar button');
  check(await shell.isVisible('#foafos-backstage .bs-help') && (await shell.textContent('#foafos-backstage .bs-help')).includes('Who acted'), 'the panel /help opens');
  await shell.click('#foafos-backstage .bs-bar button');

  // ── 2. the page, as an outside client ──
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`page console: ${m.text()}`); });
  await page.goto(`${PAGE}?server=local&as=foafbot&room=${ROOM}`);
  await page.fill('#bs-password', accounts.foafbot);
  await page.click('form.bs-form button[type=submit]');
  await page.waitForFunction(() => window.__backstage.room(), null, { timeout: 15000 });
  check(await page.inputValue('#bs-password') === '', 'the page clears the password field');
  await wait(800);
  refuse();
  const gotPage = await page.waitForFunction((who) => window.__backstage.model()?.snapshot().callers.some((c) => c.who === who && c.refused > 0), SENDER, { timeout: 15000 }).then(() => true, () => false);
  check(gotPage, 'the page names the refused account');
  const pageNick = await page.evaluate(() => window.__backstage.nick());
  const kinds = await page.evaluate(() => Object.fromEntries(window.__backstage.model().snapshot().members.map((m) => [m.nick, m.kind])));
  check(kinds.foafos === 'shell' && kinds[pageNick] === 'you', `the page sees the shell and itself (${JSON.stringify(kinds)})`);
  await page.goto(`${PAGE}#help`);
  check(await page.isVisible('.bs-help'), 'the page /help opens from #help');

  // ── 3. the command ──
  const cli = spawn(process.execPath, [join(repo, 'inklet/tools/foafos-stack.mjs'), 'backstage', 'local', '--as', 'foafbot', '--room', ROOM, '--wait', '6', '--json'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  cli.stdout.on('data', (d) => { out += d; });
  cli.stderr.on('data', (d) => { err += d; });
  await wait(2500);
  refuse();
  const code = await new Promise((r) => cli.on('close', r));
  let snap = null;
  try { snap = JSON.parse(out); } catch { /* reported below */ }
  check(code === 0 && !!snap, `foafos-stack backstage --json exits 0 with JSON (${code}${err ? `: ${err.trim().slice(0, 200)}` : ''})`);
  check(!!snap?.callers?.some((c) => c.who === SENDER && c.refused > 0), 'the command names the refused account');
  check(snap?.members?.some((m) => m.nick === 'foafos' && m.kind === 'shell'), 'the command sees the shell');
  check(typeof snap?.laptop?.model === 'string' && 'running' in (snap?.laptop || {}), 'the command reports the bot side of this laptop');

  // ── the panel sees the other views as viewers ──
  const viewer = await shell.evaluate(() => document.querySelector('#foafos-backstage').textContent);
  check(viewer.includes('Backstage'), 'the panel lists the other Backstage views');

  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
} catch (e) {
  check(false, `exception: ${e.message}`);
} finally {
  sender?.close();
  await browser.close();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
