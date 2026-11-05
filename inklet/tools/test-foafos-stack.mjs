// Tests for foafos-stack, on spare ports with a private state folder: nothing here
// touches the real servers. Run: node inklet/tools/test-foafos-stack.mjs
//
// Storage is tested with real authorization (--authz), so the tests never need
// the no-authorization flag that the laptop setup uses.

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  FOAFOS_XMPP_PORT: String(P + 1), FOAFOS_XMPP_WS_PORT: String(P + 2), FOAFOS_LWS_PORT: String(P + 3), FOAFOS_SPARQL_PORT: String(P + 4),
  FOAFOS_SPARQL_FILE: join(T, 'data.ttl'), FOAFOS_XMPP_DIR: join(T, 'xmpp'), FOAFOS_XMPP_KEY: join(T, 'key'), FOAFOS_LWS_DIR: join(T, 'lws'),
  FOAFOS_LWS_AUTH: `--authz ${join(T, 'authz')} --allow-http`, FOAFOS_START_WAIT: '12' };
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
  assert.match(r.out, /4 of 4 not healthy/);
  assert.match(r.out, /xmpp: stopped\. Run: foafos-stack start xmpp/);
});

test('one command starts everything, and each server passes its real check', () => {
  const r = stack(['start']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /all 4 healthy/);
  const s = state();
  for (const n of ['xmpp', 'lws', 'sparql', 'shell']) {
    assert.equal(s[n].state, 'healthy', JSON.stringify(s[n]));
    assert.ok(s[n].checks.length > 0, n);
    assert.ok(s[n].checks.every((c) => c.ok), JSON.stringify(s[n].checks));
  }
  assert.equal(s.foafbot.state, 'stopped');
});

test('a server is its own session, so a closing terminal cannot reach it', () => {
  const pid = pidOf('shell');
  const line = spawnSync('ps', ['-o', 'ppid=,pgid=,tty=', '-p', String(pid)], { encoding: 'utf8' }).stdout.trim().split(/\s+/);
  assert.equal(line[0], '1');
  assert.equal(Number(line[1]), pid);
  assert.match(line[2], /\?\?|-/);
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
  for (const n of ['xmpp', 'lws', 'sparql', 'shell']) assert.equal(s[n].state, 'stopped', n);
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
