// Tests of pod-summary.mjs and pod-davmount.mjs, against fixture pods in a temp directory.
// pod-davmount is tested only through a real lws-serve with an ACL: it never reads a pod directory.
// No relay and no browser. A fixture is made by the real Factoidal engine; the "running
// pod" is the real pod.mjs on a fixture. Exit 0 when every check passes.
//
//   cd packages/foafos/pod && npm run test:tools
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { appendFileSync, chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { connect, createServer } from 'node:net';
import { createRequire } from 'node:module';
import { networkInterfaces, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLwsStorage } from '@factoidal/core/lws';
import { mountFile as davMountFile, plan as davPlan, serveArgs as davServeArgs } from '../pod-davmount.mjs';
import { readPod } from '../pod-read.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SUMMARY = resolve(here, '../pod-summary.mjs');
const DAVMOUNT = resolve(here, '../pod-davmount.mjs');
const POD = resolve(here, '../pod.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'pod-tools-'));

let passed = 0;
let failed = 0;
const check = (cond, what) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (cond) passed += 1; else failed += 1; };
const children = [];
const cleanup = () => {
  for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } }
  try { execFileSync('chmod', ['-R', 'u+rwX', tmp]); rmSync(tmp, { recursive: true, force: true }); } catch { /* the OS clears it */ }
};

const enc = new TextEncoder();
const HOST = [['Host', 'pod.example']];
const INBOX_TOKEN = `INBOXTOKEN${randomBytes(8).toString('hex')}`;
const BODY_MARKER = `BODYMARKER${randomBytes(8).toString('hex')}`;

/** A fixture pod, made by the engine. The journal is left in place, as a running pod leaves it. */
async function makePod(dir, { subscribe = true, ...options } = {}) {
  const s = await openLwsStorage({ baseIri: 'https://pod.example/', dir, realClock: true, insecureNoAuth: true, ...options });
  const step = (method, target, type, body = '') => s.step({ method, target,
    headers: [...(type ? [['Content-Type', type]] : []), ...HOST], body: typeof body === 'string' ? enc.encode(body) : body });
  await step('PUT', '/notes/a.txt', 'text/plain', 'first version');
  await step('PUT', '/notes/a.txt', 'text/plain', `hello ${BODY_MARKER}`);
  await step('PUT', '/notes/deep/b.json', 'application/json', '{"x":1}');
  await step('PUT', '/my%20notes/a%20b%C3%A9%26%3C.txt', 'text/plain', 'spaced');
  await step('PUT', '/photo.bin', 'application/octet-stream', Uint8Array.from({ length: 4096 }, (_, i) => i % 251));
  await step('PUT', '/empty.txt', 'text/plain', '');
  await step('PUT', '/gone.txt', 'text/plain', 'bye');
  await step('DELETE', '/gone.txt');
  if (subscribe) {
    await step('POST', '/.well-known/lws-subscriptions/', 'application/lws+json',
      JSON.stringify({ type: 'WebhookSubscription', topic: ['https://pod.example/'], inbox: `https://hook.example/in?tok=${INBOX_TOKEN}` }));
  }
  s.close();
}

/** Every path, mode, size, mtime, ctime and content under dir. Read time (atime) is left out. */
function hashTree(dir) {
  const lines = [];
  const walk = (at) => {
    for (const name of readdirSync(at).sort()) {
      const file = join(at, name);
      const s = lstatSync(file);
      const rel = file.slice(dir.length);
      if (s.isDirectory()) { lines.push(`d ${rel} ${s.mode} ${s.mtimeMs} ${s.ctimeMs}`); walk(file); }
      else lines.push(`f ${rel} ${s.mode} ${s.size} ${s.mtimeMs} ${s.ctimeMs} ${createHash('sha256').update(readFileSync(file)).digest('hex')}`);
    }
  };
  walk(dir);
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

const summary = (...args) => {
  const r = spawnSync(process.execPath, [SUMMARY, ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr, all: r.stdout + r.stderr };
};
const summaryJson = (dir) => JSON.parse(summary(dir, '--json').out);
const shape = (report) => report.entries.map(({ path, kind, contentType, size, modified, body }) => ({ path, kind, contentType, size, modified, body }));

// ---------------------------------------------------------------------------
// pod-summary
const podA = join(tmp, 'a');
await makePod(podA);
const rawIndex = JSON.parse(readFileSync(join(podA, 'lws-files.json'), 'utf8'));
const SIGNING_KEY = rawIndex.notifications.signingKey;
check(typeof SIGNING_KEY === 'string' && SIGNING_KEY.length > 20, 'the fixture holds a signing key');
check(readFileSync(join(podA, 'lws-journal')).includes(INBOX_TOKEN), 'the fixture journal holds the inbox token');

// Negative control: the hash sees what it is there to see.
{
  const pod = join(tmp, 'a-control');
  cpSync(podA, pod, { recursive: true });
  const start = hashTree(pod);
  check(hashTree(pod) === start, 'control: the hash is stable with no change');
  writeFileSync(join(pod, 'lws-files.json'), readFileSync(join(pod, 'lws-files.json')));
  const rewritten = hashTree(pod);
  check(rewritten !== start, 'control: the hash changes when a file is rewritten with the same bytes');
  writeFileSync(join(pod, 'new-file'), '');
  check(hashTree(pod) !== rewritten, 'control: the hash changes when a file is added');
}

{
  const before = hashTree(podA);
  const text = summary(podA);
  const json = summary(podA, '--json');
  check(text.code === 0 && json.code === 0, 'summary exits 0 in both modes');
  check(hashTree(podA) === before, 'closed pod: directory hash is the same after text and --json runs');

  const r = JSON.parse(json.out);
  const paths = r.entries.map((e) => e.path);
  check(r.journal.records > 0 && r.indexSeq === 0, 'the fixture state is in the journal, not in the index');
  check(paths.includes('/notes/deep/b.json') && !paths.includes('/gone.txt'), 'the journal is replayed: a put is there and a delete is gone');
  const a = r.entries.find((e) => e.path === '/notes/a.txt');
  check(a.size === `hello ${BODY_MARKER}`.length && a.contentType === 'text/plain', 'an overwrite shows the new size and the content type');
  check(/^\d{4}-\d\d-\d\dT/.test(a.modified), 'an entry has a date');
  check(r.contentTypes['text/plain'] === 3 && r.contentTypes['application/json'] === 1, 'content types are counted');
  check(r.subscriptions === 1 && r.grants === 0, 'counts come from the journal side state');
  check(r.orphans.length === 0 && r.bodyProblems.length === 0, 'a clean pod has no orphans and no body problems');
  check(r.lock.present === false, 'no lock on a closed pod');
  check(text.out.includes('grants   0') && text.out.includes('a bé&<.txt') && text.out.includes('deep/') && text.out.includes('orphan bodies: 0'), 'text output has the grant line, decoded names and the tree');
}

// Orphans, a missing body, a size fault, and a torn journal tail, on a copy.
{
  const pod = join(tmp, 'a-orphans');
  cpSync(podA, pod, { recursive: true });
  mkdirSync(join(pod, 'bodies/7f'), { recursive: true });
  writeFileSync(join(pod, 'bodies/7f/000000000000007f'), 'not recorded yet');
  const r0 = readPod(pod);
  const unusedNumber = Math.max(...[...r0.entries.values()].map((e) => e.body ?? 0)) - 1;
  const used = new Set([...r0.entries.values()].map((e) => e.body));
  const freeNumber = [...Array(r0.nextBody).keys()].find((n) => !used.has(n));
  check(freeNumber !== undefined && unusedNumber >= 0, 'the fixture has a free body number below nextBody');
  const hex = freeNumber.toString(16).padStart(16, '0');
  mkdirSync(join(pod, 'bodies', hex.slice(-2)), { recursive: true });
  writeFileSync(join(pod, 'bodies', hex.slice(-2), hex), 'left behind');
  writeFileSync(join(pod, 'bodies/7f/000000000000007f.tmp'), 'temp');
  const r = summaryJson(pod);
  const reasons = Object.fromEntries(r.orphans.map((o) => [o.file.split('/').pop(), o.reason]));
  check(r.orphans.length === 3, 'three orphan body files are found');
  check(reasons['000000000000007f'] === 'not-yet-recorded' && reasons['000000000000007f.tmp'] === 'temporary', 'a number past nextBody and a .tmp file have their reasons');
  check(Object.values(reasons).filter((v) => v === 'unused' || v === 'pending-remove').length === 1, 'a free number below nextBody is an orphan');

  const b = r.entries.find((e) => e.path === '/notes/deep/b.json').body;
  unlinkSync(join(pod, b));
  appendFileSync(join(pod, r.entries.find((e) => e.path === '/photo.bin').body), 'x');
  const r2 = summaryJson(pod);
  check(r2.bodyProblems.some((p) => p.path === '/notes/deep/b.json' && p.problem === 'missing'), 'a missing body is reported');
  check(r2.bodyProblems.some((p) => p.path === '/photo.bin' && p.problem.startsWith('size')), 'a body of the wrong size is reported');

  appendFileSync(join(pod, 'lws-journal'), Buffer.concat([Buffer.from('LWJ1'), Buffer.from([0, 0, 1, 0]), randomBytes(12)]));
  const r3 = summaryJson(pod);
  check(r3.journal.unreadBytes === 20 && r3.entries.length === r2.entries.length, 'a torn journal tail is counted and the valid records stand');
}

// The reader against the engine: a start compacts the journal into the index.
{
  const pod = join(tmp, 'a-compact');
  cpSync(podA, pod, { recursive: true });
  const replayed = summaryJson(pod);
  (await openLwsStorage({ baseIri: 'https://pod.example/', dir: pod, realClock: true, insecureNoAuth: true })).close();
  const compacted = summaryJson(pod);
  check(compacted.journal.records === 0 && compacted.indexSeq === replayed.seq, 'the engine compacted the fixture');
  check(JSON.stringify(shape(replayed)) === JSON.stringify(shape(compacted)), 'replay in this tool gives the same entries as compaction in the engine');
  check(compacted.subscriptions === 1, 'the subscription count is the same from the index');

  const index = JSON.parse(readFileSync(join(pod, 'lws-files.json'), 'utf8'));
  index.access.grants = [{ agent: 'a', token: 'GRANTSECRET1' }, { agent: 'b', token: 'GRANTSECRET2' }];
  writeFileSync(join(pod, 'lws-files.json'), JSON.stringify(index));
  const withGrants = summary(pod);
  check(withGrants.out.includes('grants   2') && !withGrants.all.includes('GRANTSECRET'), 'grants are counted and not printed (synthetic grants in the index)');
}

// A directory with no write permission: the tool needs none.
{
  const pod = join(tmp, 'a-readonly');
  cpSync(podA, pod, { recursive: true });
  execFileSync('chmod', ['-R', 'a-w', pod]);
  check(summary(pod).code === 0, 'summary runs on a directory with no write permission');
}

// Secrets, in every mode and on the fault paths.
{
  const secrets = [SIGNING_KEY, INBOX_TOKEN, BODY_MARKER];
  const clean = (text) => !secrets.some((s) => text.includes(s)) && !/signingKey|inbox|tok=/i.test(text);
  check(clean(summary(podA).all), 'text mode prints no signing key, no inbox token, no body content');
  check(clean(summary(podA, '--json').all), '--json prints no signing key, no inbox token, no body content');
  check(!JSON.stringify([...readPod(podA).entries.values()]).includes(SIGNING_KEY), 'the reader state holds no signing key');

  const broken = join(tmp, 'a-broken');
  cpSync(podA, broken, { recursive: true });
  const index = readFileSync(join(broken, 'lws-files.json'), 'utf8');
  writeFileSync(join(broken, 'lws-files.json'), index.replace(`"signingKey":"${SIGNING_KEY}"`, `"signingKey" "${SIGNING_KEY}"`));
  const fault = summary(broken);
  check(fault.code === 2 && fault.err.includes('not valid JSON') && !fault.all.includes(SIGNING_KEY), 'a broken index gives exit 2, and the message does not quote the key');
}

// A sealed storage: real seal, by the engine.
const sealedPod = join(tmp, 'sealed');
const STORAGE_KEY = randomBytes(32).toString('hex');
{
  await makePod(sealedPod, { storageKey: STORAGE_KEY });
  const keyId = JSON.parse(readFileSync(join(sealedPod, 'lws-files.json'), 'utf8')).keyId;
  const text = summary(sealedPod);
  const json = summary(sealedPod, '--json');
  const r = JSON.parse(json.out);
  check(text.code === 0 && r.sealed === true && r.bodyFiles.count > 0 && !('entries' in r), 'a sealed pod reports that it is sealed, with body counts and no tree');
  check(![STORAGE_KEY, keyId].some((s) => text.all.includes(s) || json.all.includes(s)), 'a sealed pod prints no key and no key id');
}

// Usage and a directory that is not a pod.
{
  check(summary().code === 2, 'no DIR is exit 2');
  const empty = join(tmp, 'empty');
  mkdirSync(empty);
  const r = summary(empty);
  check(r.code === 2 && r.err.includes('not a pod directory'), 'a directory with no index is exit 2');
}

// ---------------------------------------------------------------------------
// A running pod: the real pod.mjs holds lws.lock.
const podLive = join(tmp, 'live');
await makePod(podLive, { subscribe: false });   // a delivery retry would write to the journal during a hash
const livePort = 19000 + Math.floor(Math.random() * 20000);
const liveBase = `http://127.0.0.1:${livePort}/`;
const pod = spawn(process.execPath, [POD, '--base', liveBase, '--dir', podLive, '--http', String(livePort), '--insecure-no-auth', '--quiet'], { stdio: ['ignore', 'ignore', 'pipe'] });
children.push(pod);
pod.stderr.on('data', (d) => process.stderr.write(d));
for (let i = 0; i < 100; i += 1) {
  try { if ((await fetch(liveBase)).status < 500) break; } catch { /* not yet */ }
  await new Promise((r) => { setTimeout(r, 100); });
}
const livePut = (path, body) => fetch(new URL(path, liveBase), { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body });
{
  check((await livePut('/live-1.txt', 'from the running pod')).status === 201, 'the running pod takes a write');
  check(existsSync(join(podLive, 'lws.lock')), 'the running pod holds lws.lock');
  const lockText = readFileSync(join(podLive, 'lws.lock'), 'utf8');
  const lockToken = JSON.parse(lockText).token;
  check(typeof lockToken === 'string' && lockToken.length > 8, 'the lock holds a process token');

  const before = hashTree(podLive);
  const text = summary(podLive);
  const json = summary(podLive, '--json');
  check(text.code === 0 && json.code === 0, 'summary runs while the lock is held');
  check(hashTree(podLive) === before, 'running pod: directory hash is the same after text and --json runs');
  const r = JSON.parse(json.out);
  check(r.lock.pid === pod.pid && r.lock.alive === true, 'the report names the running pod process');
  check(r.entries.some((e) => e.path === '/live-1.txt'), 'a write to the running pod is in the report');
  check(!text.all.includes(lockToken) && !json.all.includes(lockToken), 'the lock token is not printed');

  // Reads during writes: every read gives a report.
  let writing = true;
  const writer = (async () => { for (let i = 0; writing; i += 1) await livePut(`/load/${i % 5}.txt`, `version ${i}`); })();
  let ok = 0;
  for (let i = 0; i < 12; i += 1) {
    const run = await new Promise((done) => {
      const c = spawn(process.execPath, [SUMMARY, podLive, '--json'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      c.stdout.on('data', (d) => { out += d; });
      c.on('close', (code) => done({ code, out }));
    });
    try { if (run.code === 0 && JSON.parse(run.out).format === 'lws-files-1') ok += 1; } catch { /* counted as not ok */ }
  }
  writing = false;
  await writer;
  check(ok === 12, `12 of 12 reads during writes give a report (${ok})`);
}

// ---------------------------------------------------------------------------
// pod-davmount: only through LWS. A real lws-serve with a root ACL and three did:key
// agents (owner: Read, Write, Control; reader: Read; stranger: nothing); each agent gets
// its own pod-davmount (factoidal webdav-serve, kind: lws, auth: did-key). The pod's ACL
// decides every WebDAV read.
{
  const FACTOIDAL = join(dirname(createRequire(import.meta.url).resolve('@factoidal/core/package.json')), 'bin', 'factoidal.mjs');
  const work = join(tmp, 'dav');
  mkdirSync(work);
  const users = join(work, 'users.txt');
  const AGENTS = ['owner', 'reader', 'stranger'];
  for (const a of AGENTS) {
    const r = spawnSync(process.execPath, [FACTOIDAL, 'webdav-user', users, a, '--iterations', '100000'], { input: `pw-${a}\n`, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`webdav-user ${a}: ${r.stderr}`);
  }
  const freePort = () => new Promise((done) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => done(port)); });
  });
  const podPort = await freePort();
  const podUrl = `http://127.0.0.1:${podPort}/`;

  /** Start a child; resolve with its http origin from stdout and its did:key from stderr. */
  const startChild = (argv, { wantDid = false } = {}) => new Promise((done, fail) => {
    const c = spawn(process.execPath, argv, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FACTOIDAL_LWS_KEY: '' } });
    children.push(c);
    let out = '';
    let err = '';
    const timer = setTimeout(() => fail(new Error(`no start: ${out} ${err}`)), 120000);
    const ready = () => {
      const m = /^(http:\/\/127\.0\.0\.1:\d+)$/m.exec(out);
      const d = /as (did:key:z[1-9A-HJ-NP-Za-km-z]+)/.exec(err);
      if (m && (!wantDid || d)) { clearTimeout(timer); done({ c, origin: m[1], did: d?.[1], log: () => out + err }); }
    };
    c.stdout.on('data', (b) => { out += b; ready(); });
    c.stderr.on('data', (b) => { err += b; ready(); });
    c.on('exit', (code) => { clearTimeout(timer); fail(new Error(`exited ${code}: ${err}`)); });
  });
  const mounts = {};
  for (const a of AGENTS) {
    mounts[a] = await startChild([DAVMOUNT, podUrl, '--key-file', join(work, `${a}.jwk`), '--users', users, '--user', a], { wantDid: true });
  }
  check(AGENTS.every((a) => (statSync(join(work, `${a}.jwk`)).mode & 0o777) === 0o600), 'each agent key file is owner-only (0600)');
  check(AGENTS.every((a) => /kind: lws|\(lws, read-only, as did:key:/.test(mounts[a].log())), 'each mount is kind lws, read only, as a did:key agent');

  const R = podUrl;
  const auth = (frag, agent, modes) => `<${R}.acl#${frag}> a acl:Authorization ;\n  acl:agent <${mounts[agent].did}> ;\n  acl:accessTo <${R}> ; acl:default <${R}> ;\n  acl:mode ${modes} .\n`;
  writeFileSync(join(work, 'root.acl'), '@prefix acl: <http://www.w3.org/ns/auth/acl#> .\n\n' +
    auth('owner', 'owner', 'acl:Read, acl:Write, acl:Control') + auth('reader', 'reader', 'acl:Read'));
  await startChild([FACTOIDAL, 'lws-serve', join(work, 'pod'), '--port', String(podPort), '--authz', join(work, 'as'), '--storage', 'files', '--root-acl', join(work, 'root.acl')]);

  const { createLwsClient } = await import('@factoidal/core/lws/client');
  const jwk = JSON.parse(readFileSync(join(work, 'owner.jwk'), 'utf8'));
  const did = mounts.owner.did;
  const owner = await createLwsClient({ selfIssued: { subject: did, keyId: `${did}#${did.slice(8)}`, jwk } });
  const put = await owner.update(`${podUrl}hello.txt`, { body: BODY_MARKER, mediaType: 'text/plain', precondition: 'none' });
  check(put.status === 201, 'the owner writes hello.txt over LWS');

  const basic = (u, p) => ({ authorization: `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}` });
  const login = (a) => basic(a, `pw-${a}`);
  const dav = async (a, method, path, headers = {}) => {
    const r = await fetch(`${mounts[a].origin}${path}`, { method, headers });
    return { status: r.status, text: await r.text() };
  };

  const ok = await dav('reader', 'GET', '/pod/hello.txt', login('reader'));
  check(ok.status === 200 && ok.text === BODY_MARKER, 'reader (acl:Read) reads hello.txt through WebDAV');
  const list = await dav('reader', 'PROPFIND', '/pod/', { depth: '1', ...login('reader') });
  check(list.status === 207 && list.text.includes('hello.txt'), 'reader lists the pod root');
  const acl = await dav('reader', 'GET', '/pod/.acl', login('reader'));
  check(acl.status !== 200 && !acl.text.includes('acl:Authorization'), `reader (no acl:Control) cannot read .acl (${acl.status})`);
  const ownerAcl = await dav('owner', 'GET', '/pod/.acl', login('owner'));
  check(ownerAcl.status === 200, 'owner (acl:Control) reads .acl: the pod decides, not the WebDAV side');
  const stranger = await dav('stranger', 'GET', '/pod/hello.txt', login('stranger'));
  check(stranger.status !== 200 && !stranger.text.includes(BODY_MARKER), `stranger (no grant) is refused by the pod (${stranger.status})`);
  const strangerList = await dav('stranger', 'PROPFIND', '/pod/', { depth: '1', ...login('stranger') });
  check(!strangerList.text.includes('hello.txt'), 'stranger cannot list the pod');
  check((await dav('reader', 'GET', '/pod/hello.txt')).status === 401, 'no credentials: 401 (no guest)');
  check((await dav('reader', 'GET', '/pod/hello.txt', basic('reader', 'wrong'))).status === 401, 'a wrong password: 401');
  check((await dav('reader', 'GET', '/pod/hello.txt', login('stranger'))).status === 404, 'another login does not reach this mount');
  check((await dav('owner', 'PUT', '/pod/new.txt', login('owner'))).status === 403, 'read only: PUT is 403, even for the owner');
  check((await fetch(`${podUrl}hello.txt`)).status === 401, 'the pod itself: no token, 401');

  // Refusals of the CLI: a pod directory is never read.
  const refuse = (...args) => spawnSync(process.execPath, [DAVMOUNT, ...args], { encoding: 'utf8' });
  const dir = refuse(podA, '--key-file', join(work, 'reader.jwk'), '--users', users, '--user', 'reader');
  check(dir.status === 2 && dir.stderr.includes('never by reading its directory'), 'a pod directory is refused, exit 2');
  check(refuse(podUrl, '--users', users, '--user', 'reader').status === 2, 'no --key-file: exit 2');
  check(refuse(podUrl, '--key-file', join(work, 'reader.jwk'), '--user', 'reader').status === 2, 'no --users: exit 2');
  check(refuse(podUrl, '--key-file', join(work, 'reader.jwk'), '--users', users, '--user', 'reader', '--port', 'x').status === 2, 'a bad --port: exit 2');
  const p = davPlan([podUrl, '--key-file', 'k.jwk', '--users', users, '--user', 'reader']);
  const text = davMountFile(p);
  check(/- kind: lws\n/.test(text) && /- auth: did-key\n/.test(text) && !/kind: local/.test(text), 'the mount file is kind lws with auth did-key');
  check(!davServeArgs('/x', p).includes('--guest') && davServeArgs('/x', p).includes('--users'), 'webdav-serve runs with --users and no --guest');
  const src = readFileSync(DAVMOUNT, 'utf8');
  check(!/pod-read|lws-files|openLwsStorage|bodies\//.test(src), 'pod-davmount.mjs has no code that reads a pod directory');
  check(!existsSync(resolve(here, '../pod-dav.mjs')), 'the direct WebDAV server pod-dav.mjs is gone');

  for (const a of AGENTS) mounts[a].c.kill('SIGTERM');
}

pod.kill('SIGKILL');
await new Promise((r) => { pod.on('close', r); });
{
  const r = summaryJson(podLive);
  check(r.lock.present === true && r.lock.alive === false, 'a lock left by a dead pod shows as stale');
}

cleanup();
console.log(`${passed} pass, ${failed} fail`);
process.exit(failed ? 1 : 0);
