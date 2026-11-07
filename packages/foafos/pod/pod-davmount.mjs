#!/usr/bin/env node
// Show a running LWS pod as a WebDAV server, so that Finder can mount it. Every request
// goes through the pod's own LWS access control.
//
//   node pod-davmount.mjs POD_URL --key-file FILE --users FILE --user NAME [--port N]
//
// This is a thin wrapper around `factoidal webdav-serve` (the verified, LWS-mediated
// WebDAV path in @factoidal/core). It writes one mount file:
//
//   kind: lws, url: POD_URL, auth: did-key, key-file: FILE, users: NAME
//
// so the WebDAV server reaches the pod only through the LWS client, as the key's did:key
// agent, and the pod decides each request with its own ACL. It never reads a pod
// directory. A path (not an http/https URL) is refused.
//
// Login: HTTP Basic from --users (made with `factoidal webdav-user FILE NAME`); no guest,
// so a request with no credentials gets 401. Bound to 127.0.0.1. Read only (Factoidal
// issue 1147). The did:key is printed at start: the pod's ACL must grant it acl:Read
// where the reader may read, and nothing else.
//
// Exit: 2 a usage fault; otherwise the exit code of webdav-serve.

import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const USAGE = 'usage: pod-davmount POD_URL --key-file FILE --users FILE --user NAME [--port N]';

/** The checked arguments, or a reason to refuse. Exported for the tests. */
export function plan(argv) {
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
      port: { type: 'string', default: '0' }, 'key-file': { type: 'string' }, users: { type: 'string' }, user: { type: 'string' },
    } }));
  } catch (e) { return { error: e.message }; }
  if (positionals.length !== 1) return { error: 'give one POD_URL' };
  let url;
  try { url = new URL(positionals[0]); } catch { url = null; }
  if (url === null || !['http:', 'https:'].includes(url.protocol)) {
    return { error: `${positionals[0]} is not an http or https URL: pod-davmount reaches a pod only over LWS, never by reading its directory` };
  }
  if (url.username || url.password || url.search || url.hash) return { error: 'the POD_URL may not hold credentials, a query or a fragment' };
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) return { error: `bad --port ${values.port}` };
  for (const k of ['key-file', 'users', 'user']) if (!values[k]) return { error: `--${k} is required` };
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(values.user)) return { error: 'a --user name is 1 to 64 of A-Z a-z 0-9 _ . -' };
  if (!existsSync(values.users)) return { error: `no users file ${values.users}: make one with "factoidal webdav-user ${values.users} ${values.user}"` };
  return { url: url.href.endsWith('/') ? url.href : `${url.href}/`, port, keyFile: resolve(values['key-file']), users: resolve(values.users), user: values.user };
}

/** The mount file text: kind lws with a did:key agent, never kind local. */
export function mountFile({ url, keyFile, user }) {
  return `# Pod ${url}\n- kind: lws\n- url: ${url}\n- auth: did-key\n- key-file: ${keyFile}\n- users: ${user}\n`;
}

/** The webdav-serve command line: no --guest, loopback only. */
export function serveArgs(configDir, { port, users }) {
  return ['webdav-serve', configDir, '--host', '127.0.0.1', '--port', String(port), '--users', users];
}

function factoidalCli() {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve('@factoidal/core/package.json')), 'bin', 'factoidal.mjs');
}

async function main() {
  const p = plan(process.argv.slice(2));
  if (p.error) {
    console.error(`pod-davmount: ${p.error}\n${USAGE}`);
    process.exit(2);
  }
  const configDir = mkdtempSync(join(tmpdir(), 'pod-davmount-'));
  chmodSync(configDir, 0o700);
  writeFileSync(join(configDir, 'pod.md'), mountFile(p), { mode: 0o600 });
  const child = spawn(process.execPath, [factoidalCli(), ...serveArgs(configDir, p)], { stdio: 'inherit' });
  const clean = () => rmSync(configDir, { recursive: true, force: true });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
  child.on('exit', (code, signal) => { clean(); process.exit(code ?? (signal ? 0 : 1)); });
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
