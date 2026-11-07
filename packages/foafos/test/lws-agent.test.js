// lwsAgentFetch against a REAL lws-serve with its own authorization server and a root ACL: the
// Factoidal client signs in as a did:key agent, and plain fetches carry its token. This pins the
// client's session shape (tokens[].root, tokens[].token) that lws-agent.mjs reads.
//
// Uses the @factoidal/core behind the `factoidal` command (as foafos-stack does), or
// FACTOIDAL_PKG=/path/to/@factoidal/core. Skipped when neither is there.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { lwsAgentFetch, DID_KEY } from '../src/lws-agent.mjs';

function factoidalPkg() {
  if (process.env.FACTOIDAL_PKG) return process.env.FACTOIDAL_PKG;
  const bin = spawnSync('which', ['factoidal'], { encoding: 'utf8' }).stdout.trim();
  return bin ? dirname(dirname(realpathSync(bin))) : '';
}
const PKG = factoidalPkg();
const HAVE = PKG && existsSync(join(PKG, 'lws/client.mjs'));
const T = mkdtempSync(join(tmpdir(), 'lws-agent-'));
let server = null;
after(() => { server?.kill('SIGTERM'); rmSync(T, { recursive: true, force: true }); });

test('a did:key agent reads, writes and lists through plain fetch; others are refused', { skip: !HAVE && 'no @factoidal/core' }, async () => {
  const { createDidKey, createLwsClient } = await import(pathToFileURL(join(PKG, 'lws/client.mjs')).href);
  const me = await createDidKey();
  const stranger = await createDidKey();
  assert.match(me.agent, DID_KEY);
  writeFileSync(join(T, 'root.acl'), `@prefix acl: <http://www.w3.org/ns/auth/acl#> .
<#me> a acl:Authorization ; acl:agent <${me.agent}> ; acl:accessTo <./> ; acl:default <./> ; acl:mode acl:Read, acl:Write .
`);
  const origin = await new Promise((resolve, reject) => {
    server = spawn(process.execPath, [join(PKG, 'bin/factoidal.mjs'), 'lws-serve', join(T, 'pod'), '--authz', join(T, 'as'), '--allow-http',
      '--root-acl', join(T, 'root.acl'), '--host', '127.0.0.1', '--port', '0', '--storage', 'files'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    server.stdout.on('data', (b) => { out += b; const m = /^(http:\/\/127\.0\.0\.1:\d+)$/m.exec(out); if (m) resolve(m[1]); });
    server.on('exit', (c) => reject(new Error(`lws-serve exited ${c}`)));
  });
  const base = `${origin}/`;
  const make = async (k) => lwsAgentFetch({ client: await createLwsClient({ selfIssued: k.selfIssued }), base, fetch: globalThis.fetch });
  const f = await make(me);
  assert.equal((await fetch(`${base}a.txt`)).status, 401, 'no token, no data');
  const put = await f(`${base}notes/a.txt`, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: 'hello' });
  assert.ok([201, 204].includes(put.status), `PUT ${put.status}`);
  const got = await f(`${base}notes/a.txt`);
  assert.equal(got.status, 200);
  assert.equal(await got.text(), 'hello');
  const list = await f(`${base}notes/`, { headers: { Accept: 'application/lws+json' } });
  assert.equal(list.status, 200);
  assert.match(await list.text(), /a\.txt/);
  assert.equal((await f(`${base}.acl`)).status, 403, 'no Control, so no ACL');
  const s = await make(stranger);
  assert.equal((await s(`${base}notes/a.txt`)).status, 403, 'a stranger did:key is refused');
  await assert.rejects(() => f('http://127.0.0.1:1/x'), /only its own storage/);
});
