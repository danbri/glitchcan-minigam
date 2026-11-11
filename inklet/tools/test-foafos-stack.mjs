// Tests for foafos-stack, on spare ports with a private state folder: nothing here
// touches the real servers. Run: node inklet/tools/test-foafos-stack.mjs
//
// Storage runs as the stack runs it: its own authorization server, a root ACL,
// did:key agents (docs/foafos-local-lws-auth-20261107.md). The tests make the
// keys with lws-setup, then check who gets what: no token 401, a browser agent
// only after lws-allow, the Finder agent read only and no ACL, a stranger 403,
// WebDAV with no login 401. Migration of a storage made with no authorization
// is tested on its own storage. The LWS client is the @factoidal/core behind
// the `factoidal` command, as in foafos-stack.

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TOOL = join(dirname(fileURLToPath(import.meta.url)), 'foafos-stack.mjs');
const T = mkdtempSync(join(tmpdir(), 'foafos-stack-'));
const P = 20000 + Math.floor(Math.random() * 20000);
mkdirSync(join(T, 'xmpp'));
mkdirSync(join(T, 'root/glitchcan-minigam/inklet/finkapp'), { recursive: true });
writeFileSync(join(T, 'root/glitchcan-minigam/inklet/finkapp/index.html'), '<title>foafos</title>');
writeFileSync(join(T, 'root/glitchcan-minigam/inklet/finkapp/foafos-shell.js'), '// shell');
writeFileSync(join(T, 'xmpp/accounts'), 'foafos:secret-for-a-test\n', { mode: 0o600 });
writeFileSync(join(T, 'key'), 'ab'.repeat(32), { mode: 0o600 });
writeFileSync(join(T, 'data.ttl'), '<urn:a> <urn:b> <urn:c> .\n');

const ENV = { ...process.env, NO_COLOR: '1', FOAFOS_STACK_HOME: join(T, 'state'), FOAFOS_SHELL_ROOT: join(T, 'root'), FOAFOS_SHELL_PORT: String(P),
  FOAFOS_XMPP_PORT: String(P + 1), FOAFOS_XMPP_WS_PORT: String(P + 2), FOAFOS_LWS_PORT: String(P + 3), FOAFOS_SPARQL_PORT: String(P + 4), FOAFOS_WEBDAV_PORT: String(P + 5),
  FOAFOS_SPARQL_FILE: join(T, 'data.ttl'), FOAFOS_XMPP_DIR: join(T, 'xmpp'), FOAFOS_XMPP_KEY: join(T, 'key'), FOAFOS_LWS_DIR: join(T, 'lws'),
  FOAFOS_START_WAIT: '12' };
delete ENV.FOAFOS_LWS_AUTH;
delete ENV.FOAFOS_LWS_INSECURE_NO_AUTH;
const LWS = `http://127.0.0.1:${P + 3}/`;
const DAV = `http://127.0.0.1:${P + 5}/`;
const DAV_PASSWORD = `dav-pw-${Math.random().toString(36).slice(2)}`;
const PKG = (() => { const b = spawnSync('which', ['factoidal'], { encoding: 'utf8' }).stdout.trim(); return b ? dirname(dirname(realpathSync(b))) : ''; })();
const lwsClient = () => import(pathToFileURL(join(PKG, 'lws/client.mjs')).href);
const keyOf = (name) => JSON.parse(readFileSync(join(T, `state/lws/${name}.jwk`), 'utf8'));
const agents = () => JSON.parse(readFileSync(join(T, 'state/lws/agents.json'), 'utf8'));
const asAgent = async (did, jwk) => (await lwsClient()).createLwsClient({ selfIssued: { subject: did, keyId: `${did}#${did.slice(8)}`, jwk } });
const statusOf = async (p) => { try { const r = await p; return r?.status ?? 200; } catch (e) { return e?.detail?.status ?? e?.reason; } };
const dav = (path, init = {}, login = true) => fetch(DAV + path, { ...init, headers: { ...(init.headers || {}), ...(login ? { Authorization: `Basic ${Buffer.from(`me:${DAV_PASSWORD}`).toString('base64')}` } : {}) } });
/** Every private key value under the state folder: none may appear in any output. */
const secretsOut = () => ['owner', 'webdav', 'recovery'].map((n) => keyOf(n).d);
mkdirSync(join(T, 'state'), { mode: 0o700 });
spawnSync('factoidal', ['webdav-user', join(T, 'state/webdav-users'), 'me', '--iterations', '100000'], { input: DAV_PASSWORD });
const stack = (args, env = {}) => {
  const r = spawnSync('node', [TOOL, ...args], { env: { ...ENV, ...env }, encoding: 'utf8', timeout: 60000 });
  return { code: r.status, out: r.stdout + r.stderr };
};
const state = () => Object.fromEntries(JSON.parse(stack(['status', '--json']).out).services.map((s) => [s.name, s]));
const pidOf = (n) => JSON.parse(readFileSync(join(T, `state/run/${n}.json`), 'utf8')).pid;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

after(() => { stack(['stop']); rmSync(T, { recursive: true, force: true }); });

test('nothing running: every service says stopped, and status exits 1', () => {
  const r = stack(['status']);
  assert.equal(r.code, 1);
  assert.match(r.out, /5 of 5 not healthy/);
  assert.match(r.out, /xmpp: stopped\. Run: foafos-stack start xmpp/);
});

test('the storage will not start before lws-setup, and says what to run', () => {
  const r = stack(['start', 'lws']);
  assert.equal(r.code, 1);
  assert.match(r.out, /run foafos-stack lws-setup once/);
});

test('lws-setup makes private keys and the ACL, and prints no key', () => {
  const r = stack(['lws-setup']);
  assert.equal(r.code, 0, r.out);
  const mode = (f) => (statSync(join(T, 'state/lws', f)).mode & 0o777).toString(8);
  assert.equal(mode('.'), '700');
  for (const f of ['owner.jwk', 'webdav.jwk', 'recovery.jwk', 'root.acl', 'agents.json']) assert.equal(mode(f), '600', f);
  const a = agents();
  assert.match(a.owner, /^did:key:z/);
  assert.match(r.out, new RegExp(a.owner));
  // The recovery agent: named, its key file named with the advice to move it offline, never printed.
  assert.match(a.recovery, /^did:key:z/);
  assert.match(r.out, new RegExp(`made the recovery agent ${a.recovery}`));
  assert.match(r.out, /recovery\.jwk: move it offline now/);
  for (const d of secretsOut()) assert.ok(!r.out.includes(d), 'a private key was printed');
  const acl = readFileSync(join(T, 'state/lws/root.acl'), 'utf8');
  assert.ok(acl.includes(`acl:agent <${a.owner}> ;\n  acl:accessTo <./> ; acl:default <./> ;\n  acl:mode acl:Read, acl:Write, acl:Control .`), acl);
  assert.ok(acl.includes(`acl:agent <${a.webdav}> ;\n  acl:accessTo <./> ; acl:default <./> ;\n  acl:mode acl:Read .`), acl);
  // Control of the root only: no acl:default, no Read, no Write.
  assert.ok(acl.includes(`<#recovery> a acl:Authorization ;\n  acl:agent <${a.recovery}> ;\n  acl:accessTo <./> ;\n  acl:mode acl:Control .`), acl);
  assert.match(stack(['lws-setup']).out, /has its owner and ACL already/);
});

test('one command starts everything, and each server passes its real check', () => {
  const r = stack(['start']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /all 5 healthy/);
  const s = state();
  for (const n of ['xmpp', 'lws', 'webdav', 'sparql', 'shell']) {
    assert.equal(s[n].state, 'healthy', JSON.stringify(s[n]));
    assert.ok(s[n].checks.length > 0, n);
    assert.ok(s[n].checks.every((c) => c.ok), JSON.stringify(s[n].checks));
  }
  assert.equal(s.foafbot.state, 'stopped');
});

test('a server is its own session, so a closing terminal cannot reach it', () => {
  const pid = pidOf('shell');
  const line = spawnSync('ps', ['-o', 'ppid=,pgid=,tty=', '-p', String(pid)], { encoding: 'utf8' }).stdout.trim().split(/\s+/);
  assert.equal(Number(line[1]), pid);
  assert.match(line[2], /^(\?+|-)$/);
});

test('starting twice does nothing, and the JSON holds no secret', () => {
  const pid = pidOf('sparql');
  assert.match(stack(['start', 'sparql']).out, /already running/);
  assert.equal(pidOf('sparql'), pid);
  assert.doesNotMatch(stack(['status', '--json']).out, /secret-for-a-test/);
  assert.doesNotMatch(stack(['status', '-v']).out, /secret-for-a-test/);
});

test('a crash is not a stop: it is named, with what to do, and clears on restart', async () => {
  process.kill(pidOf('sparql'), 'SIGKILL');
  await wait(300);
  const r = stack(['status']);
  assert.equal(r.code, 1);
  assert.match(r.out, /sparql\s+crashed/);
  assert.match(r.out, /stopped without being asked to/);
  assert.match(r.out, /foafos-stack restart sparql/);
  assert.equal(stack(['restart', 'sparql']).code, 0);
  assert.equal(state().sparql.state, 'healthy');
});

test('a process that lives but stops answering is degraded, not healthy', async () => {
  const pid = pidOf('shell');
  process.kill(pid, 'SIGSTOP');
  try {
    const s = state().shell;
    assert.notEqual(s.state, 'healthy', JSON.stringify(s));
    assert.ok(s.problems.some((p) => /page loads failed/.test(p)), JSON.stringify(s.problems));
  } finally { process.kill(pid, 'SIGCONT'); }
  await wait(300);
  assert.equal(state().shell.state, 'healthy');
});

test('a browser origin the server refuses shows as a failed check', () => {
  const s = JSON.parse(stack(['status', '--json'], { FOAFOS_SHELL_PORT: String(P + 9) }).out).services.find((x) => x.name === 'xmpp');
  assert.equal(s.checks.find((c) => c.name === 'browser websocket').ok, false, JSON.stringify(s.checks));
});

test('a server open to other sites is not healthy', () => {
  const s = state();
  for (const n of ['xmpp', 'lws']) assert.ok(s[n].checks.find((c) => c.name === 'other sites refused')?.ok, JSON.stringify(s[n].checks));
  assert.ok(s.lws.checks.find((c) => c.name === 'sandboxed pages refused')?.ok, JSON.stringify(s.lws.checks));
});

test('the storage: no token gets 401, and a browser agent gets in only after lws-allow', async () => {
  assert.equal((await fetch(`${LWS}`)).status, 401);
  assert.equal((await fetch(`${LWS}x.txt`, { method: 'PUT', body: 'x' })).status, 401);
  const { createDidKey } = await lwsClient();
  const browser = await createDidKey();
  const shell = await asAgent(browser.agent, browser.selfIssued.jwk);
  assert.equal(await statusOf(shell.update(`${LWS}notes/a.txt`, { body: 'from the shell', mediaType: 'text/plain', precondition: 'none' })), 403);
  const allow = stack(['lws-allow', browser.agent, '--label', 'test browser']);
  assert.equal(allow.code, 0, allow.out);
  // stack() blocks this event loop for seconds, so a kept-alive socket the server closed meanwhile
  // is seen only now: let it go before the next request.
  await wait(300);
  assert.equal(await statusOf(shell.update(`${LWS}notes/a.txt`, { body: 'from the shell', mediaType: 'text/plain', precondition: 'none' })), 201);
  const read = await shell.read(`${LWS}notes/a.txt`);
  assert.equal(read.status, 200);
  const listed = await shell.list(`${LWS}notes/`);
  assert.match(JSON.stringify(listed), /notes\/a\.txt/);
  assert.equal(await statusOf(shell.read(`${LWS}.acl`)), 403, 'a browser agent has no Control');
  const out = stack(['lws-agents']).out;
  assert.match(out, new RegExp(`${browser.agent}  read, write  \\(test browser\\)`));
  for (const d of [...secretsOut(), browser.selfIssued.jwk.d]) assert.ok(!(out + allow.out).includes(d), 'a private key was printed');

  // The Finder agent reads, but cannot write or read the ACL; a stranger gets nothing.
  const a = agents();
  const finder = await asAgent(a.webdav, keyOf('webdav'));
  assert.equal(await statusOf(finder.read(`${LWS}notes/a.txt`)), 200);
  assert.equal(await statusOf(finder.update(`${LWS}notes/b.txt`, { body: 'x', mediaType: 'text/plain', precondition: 'none' })), 403);
  assert.equal(await statusOf(finder.read(`${LWS}.acl`)), 403);
  const stranger = await createDidKey();
  assert.equal(await statusOf((await asAgent(stranger.agent, stranger.selfIssued.jwk)).read(`${LWS}notes/a.txt`)), 403);

  // WebDAV: no login 401; the login reads as the Finder agent; no write, no ACL.
  assert.equal((await dav('', { method: 'PROPFIND', headers: { Depth: '1' } }, false)).status, 401);
  assert.equal((await dav('foafos/notes/a.txt', {}, false)).status, 401);
  const got = await dav('foafos/notes/a.txt');
  assert.equal(got.status, 200);
  assert.equal(await got.text(), 'from the shell');
  assert.equal((await dav('foafos/notes/c.txt', { method: 'PUT', body: 'x' })).status, 403);
  assert.notEqual((await dav('foafos/.acl')).status, 200);
  const mount = readFileSync(join(T, 'state/webdav/foafos.md'), 'utf8');
  assert.match(mount, /- auth: did-key/);
  assert.doesNotMatch(mount, /kind: local|guest/);
  assert.equal((statSync(join(T, 'state/webdav')).mode & 0o777).toString(8), '700');

  // Revoked: refused again. An ACL changed elsewhere is not overwritten.
  assert.equal(stack(['lws-revoke', browser.agent]).code, 0);
  await wait(300);
  assert.equal(await statusOf((await asAgent(browser.agent, browser.selfIssued.jwk)).read(`${LWS}notes/a.txt`)), 403);
  const copy = join(T, 'state/lws/root.acl');
  const saved = readFileSync(copy, 'utf8');
  writeFileSync(copy, `${saved}# changed\n`);
  const refused = stack(['lws-allow', stranger.agent]);
  writeFileSync(copy, saved);
  assert.equal(refused.code, 1);
  assert.match(refused.out, /changed elsewhere/);
  assert.equal(stack(['lws-allow', 'did:key:nonsense']).code, 2);
});

test('the recovery agent may rewrite the root ACL, and may read or write no data', async () => {
  await wait(300);   // the previous test ended with stack(): let a kept-alive socket the server closed go
  const a = agents();
  const rec = await asAgent(a.recovery, keyOf('recovery'));
  assert.equal(await statusOf(rec.read(`${LWS}notes/a.txt`)), 403, 'no Read of data');
  assert.equal(await statusOf(rec.read(LWS)), 403, 'no Read of the root container');
  assert.equal(await statusOf(rec.update(`${LWS}notes/r.txt`, { body: 'x', mediaType: 'text/plain', precondition: 'none' })), 403, 'no Write');
  const now = await rec.read(`${LWS}.acl`);
  assert.equal(now.status, 200, 'Control: it reads the ACL');
  const text = typeof now.body === 'string' ? now.body : Buffer.from(now.bodyBase64 ?? '', 'base64').toString('utf8');
  assert.equal(text, readFileSync(join(T, 'state/lws/root.acl'), 'utf8'));
  // It rewrites the ACL (lws-recover, with the key file the owner would bring back from offline).
  const r = stack(['lws-recover', join(T, 'state/lws/recovery.jwk')]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /written by the recovery agent/);
  for (const d of secretsOut()) assert.ok(!r.out.includes(d), 'a private key was printed');
  await wait(300);
  const owner = await asAgent(a.owner, keyOf('owner'));
  assert.equal(await statusOf(owner.read(`${LWS}notes/a.txt`)), 200, 'the owner keeps its access');
  assert.equal(await statusOf(rec.read(`${LWS}notes/a.txt`)), 403, 'still no Read of data');
  // A key that is not the recovery agent's is refused by the storage.
  const wrong = stack(['lws-recover', join(T, 'state/lws/webdav.jwk')]);
  assert.equal(wrong.code, 1, wrong.out);
  assert.match(wrong.out, /lws-acl-reset/);
});

test('lws-setup --recovery-did names a recovery agent and makes no key for it', async () => {
  const home = join(T, 'state-rd');
  const { createDidKey } = await lwsClient();
  const given = (await createDidKey()).agent;
  const env = { FOAFOS_STACK_HOME: home, FOAFOS_LWS_DIR: join(T, 'lws-rd') };
  assert.equal(stack(['lws-setup', '--recovery-did', 'did:key:nonsense'], env).code, 2);
  assert.ok(!existsSync(join(home, 'lws/agents.json')), 'nothing made after a bad did');
  const r = stack(['lws-setup', '--recovery-did', given], env);
  assert.equal(r.code, 0, r.out);
  assert.equal(JSON.parse(readFileSync(join(home, 'lws/agents.json'), 'utf8')).recovery, given);
  assert.ok(!existsSync(join(home, 'lws/recovery.jwk')));
  assert.match(readFileSync(join(home, 'lws/root.acl'), 'utf8'), new RegExp(`acl:agent <${given}> ;\n  acl:accessTo <./> ;\n  acl:mode acl:Control \\.`));
});

test('state is private to you', () => {
  const mode = (f) => (statSync(f).mode & 0o777).toString(8);
  assert.equal(mode(join(T, 'state')), '700');
  assert.equal(mode(join(T, 'state/logs/shell.log')), '600');
  assert.equal(stack(['logs', 'shell', '-n']).code, 2);
  assert.equal(stack(['logs', 'shell', '-n', 'abc']).code, 2);
});

test('settings that changed since the start are pointed out', () => {
  const s = JSON.parse(stack(['status', '--json'], { FOAFOS_SPARQL_FILE: join(T, 'other.ttl') }).out).services.find((x) => x.name === 'sparql');
  assert.match(s.notes.join(), /older settings/);
});

test('a pid reused by another program is not mistaken for the server', () => {
  const file = join(T, 'state/run/sparql.json');
  const saved = readFileSync(file, 'utf8');
  writeFileSync(file, JSON.stringify({ ...JSON.parse(saved), pid: process.pid }));
  try {
    const s = state().sparql;
    assert.equal(s.state, 'blocked', JSON.stringify(s));
  } finally { writeFileSync(file, saved); }
});

test('a start time recorded in another locale still matches', () => {
  const file = join(T, 'state/run/sparql.json');
  const saved = readFileSync(file, 'utf8');
  const rec = JSON.parse(saved);
  const m = /^(\w+) (\w+) +(\d+) (\S+) (\d+)$/.exec(rec.lstart);
  assert.ok(m, rec.lstart);
  writeFileSync(file, JSON.stringify({ ...rec, lstart: `${m[1]} ${m[3].padStart(2)} ${m[2]} ${m[4]} ${m[5]}` }));
  try { assert.equal(state().sparql.state, 'healthy'); } finally { writeFileSync(file, saved); }
});

test('a pid file from the old script is adopted, not lost', () => {
  const pid = pidOf('sparql');
  const json = join(T, 'state/run/sparql.json');
  const saved = readFileSync(json, 'utf8');
  rmSync(json);
  writeFileSync(join(T, 'state/run/sparql.pid'), `${pid}\n`);
  assert.equal(state().sparql.state, 'healthy');
  rmSync(join(T, 'state/run/sparql.pid'));
  writeFileSync(json, saved);
});

test('stop, in order, leaves no port open and no crash behind', () => {
  const r = stack(['stop']);
  assert.equal(r.code, 0, r.out);
  const s = state();
  for (const n of ['xmpp', 'lws', 'webdav', 'sparql', 'shell']) assert.equal(s[n].state, 'stopped', n);
  assert.match(stack(['stop']).out, /not running/);
});

test('something else on a port blocks the start, is named, and is left alone', async () => {
  const other = spawn('node', ['-e', `require('net').createServer().listen(${P + 4},'127.0.0.1')`], { stdio: 'ignore' });
  await wait(500);
  try {
    const started = stack(['start', 'sparql']);
    assert.equal(started.code, 1);
    assert.match(started.out, /held by something this tool did not start/);
    assert.match(started.out, new RegExp(`kill ${other.pid}`));
    assert.equal(state().sparql.state, 'blocked');
    assert.equal(stack(['stop', 'sparql']).code, 1);
    assert.doesNotThrow(() => process.kill(other.pid, 0));
  } finally { other.kill(); }
  await wait(200);
});

test('a server that dies on start shows its own error', () => {
  writeFileSync(join(T, 'bad.ttl'), 'not turtle <<<');
  const r = stack(['start', 'sparql'], { FOAFOS_SPARQL_FILE: join(T, 'bad.ttl') });
  assert.equal(r.code, 1);
  assert.match(r.out, /exited during start/);
  assert.match(r.out, /Turtle parse error/);
  stack(['stop', 'sparql']);
});

test('a storage made with no authorization gets its ACL through LWS, and keeps its data', async (t) => {
  const home = join(T, 'state2');
  const dir = join(T, 'old-lws');
  const env = { FOAFOS_STACK_HOME: home, FOAFOS_LWS_DIR: dir, FOAFOS_LWS_PORT: String(P + 6) };
  // The owner's case: a storage written with --insecure-no-auth.
  const old = spawn('factoidal', ['lws-serve', dir, '--insecure-no-auth', '--host', '127.0.0.1', '--port', String(P + 6), '--storage', 'files'], { stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await fetch(`http://127.0.0.1:${P + 6}/`).catch(() => null)); i++) await wait(250);
  assert.equal((await fetch(`http://127.0.0.1:${P + 6}/kept/old.txt`, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: 'old data' })).status, 201);
  await new Promise((r) => { old.on('exit', r); old.kill('SIGTERM'); });
  const before = readdirSync(dir).sort();

  // A factoidal that installs --root-acl into an existing storage at start: no window with authorization
  // off. An older one: lws-setup refuses and changes nothing, unless --open-acl-window is given.
  let setup = ['lws-setup'];
  let r = stack(setup, env);
  if (/cannot give an existing storage its first ACL with authorization on/.test(r.out)) {
    t.diagnostic('this factoidal cannot install a root ACL at start: checked the refusal, then --open-acl-window');
    assert.equal(r.code, 1, r.out);
    assert.equal(readdirSync(T).filter((f) => f.startsWith('old-lws.before-acl-')).length, 0, 'nothing copied or changed');
    assert.ok(!existsSync(join(home, 'lws/setup.json')));
    setup = ['lws-setup', '--open-acl-window'];
    r = stack(setup, env);
    assert.match(r.out, /NO authorization for about a second/);
  } else {
    t.diagnostic('this factoidal installs the root ACL at start, with authorization on');
    assert.match(r.out, /installed at start, with authorization on/);
    assert.doesNotMatch(r.out, /NO authorization/);
  }
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /its data is as it was/);
  const backup = readdirSync(T).find((f) => f.startsWith('old-lws.before-acl-'));
  assert.ok(backup, 'a copy is made first');
  assert.deepEqual(readdirSync(join(T, backup)).sort(), before);
  assert.equal(stack(['start', 'lws'], env).code, 0);
  try {
    assert.equal((await fetch(`http://127.0.0.1:${P + 6}/kept/old.txt`)).status, 401);
    const a = JSON.parse(readFileSync(join(home, 'lws/agents.json'), 'utf8'));
    const owner = await asAgent(a.owner, JSON.parse(readFileSync(join(home, 'lws/owner.jwk'), 'utf8')));
    const got = await owner.read(`http://127.0.0.1:${P + 6}/kept/old.txt`);
    assert.equal(got.status, 200);
    assert.match(JSON.stringify(got), /old data|b2xkIGRhdGE/);
  } finally { stack(['stop', 'lws'], env); }

  // A storage with an ACL of its own is left as it is.
  const dir3 = join(T, 'own-acl');
  const own = spawn('factoidal', ['lws-serve', dir3, '--insecure-no-auth', '--host', '127.0.0.1', '--port', String(P + 7), '--storage', 'files'], { stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await fetch(`http://127.0.0.1:${P + 7}/`).catch(() => null)); i++) await wait(250);
  const theirs = '@prefix acl: <http://www.w3.org/ns/auth/acl#> .\n<#x> a acl:Authorization ; acl:agentClass acl:AuthenticatedAgent ; acl:accessTo <./> ; acl:mode acl:Read .\n';
  assert.equal((await fetch(`http://127.0.0.1:${P + 7}/.acl`, { method: 'PUT', headers: { 'Content-Type': 'text/turtle' }, body: theirs })).status, 201);
  await new Promise((res) => { own.on('exit', res); own.kill('SIGTERM'); });
  const r3 = stack(setup, { ...env, FOAFOS_LWS_DIR: dir3 });
  assert.equal(r3.code, 1);
  assert.match(r3.out, /did not write\. It is left as it is/);
  const check = spawn('factoidal', ['lws-serve', dir3, '--insecure-no-auth', '--host', '127.0.0.1', '--port', String(P + 7), '--storage', 'files'], { stdio: 'ignore' });
  try {
    let acl = null;
    for (let i = 0; i < 60 && !acl; i++) { acl = await fetch(`http://127.0.0.1:${P + 7}/.acl`).catch(() => null); if (!acl) await wait(250); }
    assert.equal(await acl.text(), theirs);
  } finally { await new Promise((res) => { check.on('exit', res); check.kill('SIGTERM'); }); }
});

test('no authorization only by the exact opt-in, and loudly; the old setting is refused', () => {
  const words = /NO AUTHORIZATION/;
  assert.doesNotMatch(stack(['doctor'], { FOAFOS_LWS_INSECURE_NO_AUTH: '1' }).out, words);
  const d = stack(['doctor'], { FOAFOS_LWS_INSECURE_NO_AUTH: 'yes-anyone-on-this-computer-may-write' });
  assert.match(d.out, words);
  assert.equal(d.code, 1);
  const r = stack(['start', 'lws'], { FOAFOS_LWS_AUTH: '--insecure-no-auth' });
  assert.equal(r.code, 1);
  assert.match(r.out, /FOAFOS_LWS_AUTH is no longer read/);
});

test('a missing need is said before anything starts', () => {
  const r = stack(['start', 'sparql'], { FOAFOS_SPARQL_FILE: '/nonexistent.ttl' });
  assert.equal(r.code, 1);
  assert.match(r.out, /no RDF file/);
  assert.match(stack(['start', 'foafbot']).out, /no foafbot account/);
});

test('logs are labelled, doctor reports, and bad input is refused', () => {
  stack(['start', 'shell']);
  assert.match(stack(['logs', 'shell', '-n', '5', '--no-follow']).out, /shell\s+\| /);
  stack(['stop', 'shell']);
  assert.match(stack(['doctor']).out, /✓ node/);
  assert.equal(stack(['start', 'nope']).code, 2);
  assert.equal(stack(['frob']).code, 2);
  assert.equal(stack(['logs', 'nope']).code, 2);
});

test('backstage help needs no server, and the main help lists backstage', () => {
  const r = stack(['backstage', 'help']);
  assert.equal(r.code, 0);
  for (const t of ['What it is:', 'Who acted:', 'What it cannot see:', 'On the laptop:']) assert.ok(r.out.includes(t), t);
  assert.match(stack(['help']).out, /foafos-stack backstage \[local\|shared\]/);
});
