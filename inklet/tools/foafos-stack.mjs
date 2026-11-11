#!/usr/bin/env node
// foafos-stack: one command for the local Foafos servers. Node only, no packages.
// Guide: docs/foafos-local-setup-20261104.md.
//
// Status does not trust a pid file or an open port. It asks each server to do
// its job, and says what it found. Laptop only: everything binds to 127.0.0.1.
// Never expose any of this to a network.
//
// The file storage (LWS) runs with its own authorization server and a root ACL:
// every request needs a token for a did:key agent that the ACL names. Its owner
// key, the read-only key of the Finder folders and the ACL that this tool last
// wrote are in ~/.foafos-stack/lws/ (0700; keys 0600). `foafos-stack lws-setup`
// makes them once (and gives an existing storage its ACL through LWS, with
// authorization on: factoidal installs it at start);
// `lws-allow` and `lws-revoke` change who else may use it. Design and limits:
// docs/foafos-local-lws-auth-20261107.md. The @factoidal/core behind the
// `factoidal` command does the LWS client work (FOAFOS_FACTOIDAL_PKG overrides).

import { spawn, spawnSync } from 'node:child_process';
import { createECDH } from 'node:crypto';
import { appendFileSync, chmodSync, closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, realpathSync, renameSync, rmSync, statSync, statfsSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Backstage, describe, helpText } from '../../packages/foafos/src/backstage.mjs';

const env = process.env;
const HOME = homedir();
const HERE = dirname(realpathSync(fileURLToPath(import.meta.url)));
const STATE = env.FOAFOS_STACK_HOME || join(HOME, '.foafos-stack');
const LOGS = join(STATE, 'logs');
const RUN = join(STATE, 'run');
const num = (name, fallback) => Number(env[name] || fallback);

const C = {
  shellRoot: env.FOAFOS_SHELL_ROOT || join(HOME, 'working/solid'),
  shellPort: num('FOAFOS_SHELL_PORT', 8080),
  xmppPort: num('FOAFOS_XMPP_PORT', 5222),
  wsPort: num('FOAFOS_XMPP_WS_PORT', 5280),
  lwsPort: num('FOAFOS_LWS_PORT', 3000),
  sparqlPort: num('FOAFOS_SPARQL_PORT', 3030),
  sparqlFile: env.FOAFOS_SPARQL_FILE || join(HOME, 'working/sandbox/october/tpac/depmap/data.ttl'),
  xmppDir: env.FOAFOS_XMPP_DIR || join(HOME, 'foafos-xmpp'),
  xmppKey: env.FOAFOS_XMPP_KEY || join(HOME, 'foafos-xmpp.key'),
  lwsDir: env.FOAFOS_LWS_DIR || join(HOME, 'foafos-lws'),
  // Only by this exact opt-in: any program on this computer could then read and write the storage.
  lwsInsecure: env.FOAFOS_LWS_INSECURE_NO_AUTH === 'yes-anyone-on-this-computer-may-write',
  webdavPort: num('FOAFOS_WEBDAV_PORT', 8090),
  webdavUsers: env.FOAFOS_WEBDAV_USERS || join(STATE, 'webdav-users'),
  webdavUser: env.FOAFOS_WEBDAV_USER || 'me',
  flyHost: env.FOAFOS_FLY_HOST || 'foafos-xmpp.fly.dev',
  flyDir: env.FOAFOS_FLY_DIR || join(HOME, '.config/foafos-xmpp-fly'),
  bot: env.FOAFOS_BOT_ACCOUNT || 'foafbot',
};
const START_WAIT = num('FOAFOS_START_WAIT', 20) * 1000;
const STOP_WAIT = 8000;
const PROBE_WAIT = 3000;
const LOG_MAX = 20 * 1024 * 1024;
const SHELL_ORIGIN = `http://localhost:${C.shellPort}`;
const SHELL_PAGE = '/glitchcan-minigam/inklet/finkapp/';

const tty = process.stdout.isTTY && !env.NO_COLOR;
const paint = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const green = paint(32), red = paint(31), yellow = paint(33), dim = paint(2), bold = paint(1);
const say = (s = '') => console.log(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (p) => (p.startsWith(HOME) ? '~' + p.slice(HOME.length) : p);
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 5000, env: { ...env, LC_ALL: 'C' }, ...opts });
  return r.status === 0 ? r.stdout : '';
};
const accountNames = () => {
  try { return readFileSync(join(C.xmppDir, 'accounts'), 'utf8').split('\n').map((l) => l.split(':')[0]).filter(Boolean); } catch { return []; }
};

// ── the storage's agents and its ACL ────────────────────────────────────
// Keys are P-256 private JWKs (mode 0600), never printed. A did:key is public: it is
// the agent's name. agents.json holds the names; root.acl is the ACL this tool last
// wrote to the storage, so a change made elsewhere is noticed, not overwritten.

const LWSK = join(STATE, 'lws');
const K = {
  owner: join(LWSK, 'owner.jwk'), webdav: join(LWSK, 'webdav.jwk'), agents: join(LWSK, 'agents.json'),
  acl: join(LWSK, 'root.acl'), authz: join(LWSK, 'authz'), setup: join(LWSK, 'setup.json'),
};
const DID_KEY = /^did:key:z[1-9A-HJ-NP-Za-km-z]{20,128}$/;
const MODES = { rw: ['Read', 'Write'], r: ['Read'] };
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
const lwsBase = () => `http://127.0.0.1:${C.lwsPort}/`;
const setupDone = () => readJson(K.setup)?.dir === C.lwsDir && existsSync(K.acl) && !!readJson(K.agents)?.owner;

let pkgCache;
/** The @factoidal/core that the `factoidal` command runs. */
const factoidalPkg = () => (pkgCache ??= env.FOAFOS_FACTOIDAL_PKG || (() => {
  const bin = run('which', ['factoidal']).trim();
  try { return bin ? dirname(dirname(realpathSync(bin))) : ''; } catch { return ''; }
})());
const lwsClientModule = () => import(pathToFileURL(join(factoidalPkg(), 'lws/client.mjs')).href);

/** A new did:key agent; its private JWK goes to `file` (0600, never over an existing one). */
async function makeAgent(file) {
  const { createDidKey } = await lwsClientModule();
  const made = await createDidKey();
  const d = made.selfIssued.jwk.d;
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(d, 'base64url'));
  const pub = ecdh.getPublicKey();   // 0x04, x, y: webdav-serve reads a JWK with x and y
  const jwk = { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url'), d };
  writeFileSync(file, `${JSON.stringify(jwk)}\n`, { mode: 0o600, flag: 'wx' });
  return made.agent;
}

/** An LWS client acting as the agent whose key is in `file`. */
async function agentClient(did, file) {
  const { createLwsClient } = await lwsClientModule();
  const jwk = JSON.parse(readFileSync(file, 'utf8'));
  return createLwsClient({ selfIssued: { subject: did, keyId: `${did}#${did.slice('did:key:'.length)}`, jwk } });
}

/** The root ACL: the owner (this tool) Read, Write and Control; the Finder folders Read; then each allowed agent. */
function aclText(a) {
  const one = (frag, did, modes, note) => `# ${note}\n<#${frag}> a acl:Authorization ;\n  acl:agent <${did}> ;\n` +
    `  acl:accessTo <./> ; acl:default <./> ;\n  acl:mode ${modes.map((m) => `acl:${m}`).join(', ')} .\n\n`;
  return '@prefix acl: <http://www.w3.org/ns/auth/acl#> .\n' +
    '# Written by foafos-stack (lws-setup, lws-allow, lws-revoke). If it is changed elsewhere, they refuse to write it.\n\n' +
    one('owner', a.owner, ['Read', 'Write', 'Control'], 'the owner: foafos-stack itself') +
    one('webdav', a.webdav, ['Read'], 'the Finder folders (webdav-serve): read only') +
    a.agents.map((x, i) => one(`agent-${i + 1}`, x.did, x.modes, x.label)).join('');
}
const cleanLabel = (s) => String(s || 'an agent').replace(/[^\w .@:-]/g, '').slice(0, 60) || 'an agent';
const bodyText = (r) => (typeof r?.body === 'string' ? r.body : typeof r?.bodyBase64 === 'string' ? Buffer.from(r.bodyBase64, 'base64').toString('utf8') : '');
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

// ── probes: ask the server, not the operating system ────────────────────

/** Open a socket, send `out`, and resolve what came back once `done` accepts it. */
function talk(port, out, done) {
  return new Promise((resolve) => {
    const s = connect({ host: '127.0.0.1', port });
    let got = '';
    const end = (v) => { clearTimeout(t); s.destroy(); resolve(v); };
    const t = setTimeout(() => end(got), PROBE_WAIT);
    s.on('connect', () => s.write(out));
    s.on('data', (d) => { got += d; if (done(got)) end(got); });
    s.on('error', () => end(''));
    s.on('close', () => end(got));
  });
}
const check = (name, ok, detail = '') => ({ name, ok: !!ok, detail });
async function web(url, init = {}) {
  try { return await fetch(url, { ...init, signal: AbortSignal.timeout(PROBE_WAIT) }); } catch { return null; }
}

const FOREIGN = 'https://not-allowed.example';

const wsHandshake = (origin) => talk(C.wsPort, ['GET /xmpp-websocket HTTP/1.1', `Host: 127.0.0.1:${C.wsPort}`, `Origin: ${origin}`, 'Upgrade: websocket', 'Connection: Upgrade',
  'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version: 13', 'Sec-WebSocket-Protocol: xmpp', '', ''].join('\r\n'), (g) => g.includes('\r\n'));

async function probeXmpp() {
  const stream = await talk(C.xmppPort, `<?xml version='1.0'?><stream:stream to='localhost' version='1.0' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams'>`,
    (g) => g.includes('</stream:features>'));
  const ws = await wsHandshake(SHELL_ORIGIN);
  const foreign = await wsHandshake(FOREIGN);
  return [
    check('xmpp stream', stream.includes('stream:features'), stream ? '' : 'no answer'),
    check('browser websocket', / 101 /.test(ws.split('\r\n')[0]), ws ? `${ws.split('\r\n')[0]}, for origin ${SHELL_ORIGIN}` : 'no answer'),
    check('other sites refused', foreign && !/ 101 /.test(foreign.split('\r\n')[0]), foreign ? foreign.split('\r\n')[0] : 'no answer'),
  ];
}

async function probeLws() {
  const r = await web(`http://127.0.0.1:${C.lwsPort}/`, { headers: { Origin: SHELL_ORIGIN, Accept: 'application/lws+json' } });
  const allow = r?.headers.get('access-control-allow-origin');
  const other = await web(`http://127.0.0.1:${C.lwsPort}/`, { headers: { Origin: FOREIGN, Accept: 'application/lws+json' } });
  const otherAllow = other?.headers.get('access-control-allow-origin');
  const sandbox = await web(`http://127.0.0.1:${C.lwsPort}/`, { headers: { Origin: 'null', Accept: 'application/lws+json' } });
  const sandboxAllow = sandbox?.headers.get('access-control-allow-origin');
  const checks = [
    check('storage answers', r && r.status < 500, r ? `HTTP ${r.status}` : 'no answer'),
    check('browser may use it', allow === '*' || allow === SHELL_ORIGIN, allow ? `allows ${allow}` : `no CORS header for ${SHELL_ORIGIN}`),
    check('other sites refused', other && !(otherAllow === '*' || otherAllow === FOREIGN), otherAllow ? `allows ${otherAllow}` : 'no CORS header for another site'),
    check('sandboxed pages refused', sandbox && !(sandboxAllow === '*' || sandboxAllow === 'null'), sandboxAllow ? `allows ${sandboxAllow}` : 'no CORS header for Origin: null'),
  ];
  if (C.lwsInsecure) return checks;
  // Real authorization: no token, no data; and the owner's agent signs in and is let in.
  checks.push(check('needs a token', r?.status === 401, r ? `a request with no token gets HTTP ${r.status}` : 'no answer'));
  const a = readJson(K.agents);
  let owner = 'no owner key: foafos-stack lws-setup';
  if (a?.owner && existsSync(K.owner)) {
    try {
      const client = await agentClient(a.owner, K.owner);
      const h = await withTimeout(client.head(lwsBase()), PROBE_WAIT * 2);
      owner = h?.status ? `HTTP ${h.status}` : 'ok';
    } catch (e) {
      const st = e?.detail?.status;
      owner = st === 403 ? 'refused (403): the storage has no ACL for it; foafos-stack lws-setup' : `failed: ${st ? `HTTP ${st}` : e?.reason || e?.message || 'error'}`;
    }
  }
  checks.push(check('owner signs in', /^(ok|HTTP 2\d\d)$/.test(owner), owner));
  return checks;
}

async function probeWebdav() {
  // This tool has no WebDAV password, so it checks only what a stranger gets.
  const list = await web(`http://127.0.0.1:${C.webdavPort}/`, { method: 'PROPFIND', headers: { Depth: '0' } });
  const put = await web(`http://127.0.0.1:${C.webdavPort}/foafos/stack-check.txt`, { method: 'PUT', body: 'x' });
  return [
    check('login required', list?.status === 401, list ? `no login gets HTTP ${list.status}` : 'no answer'),
    check('read only', put && put.status >= 400, put ? `a write gets HTTP ${put.status}` : 'no answer'),
  ];
}

async function probeSparql() {
  const r = await web(`http://127.0.0.1:${C.sparqlPort}/ds/sparql?query=${encodeURIComponent('ASK {}')}`, { headers: { Accept: 'application/sparql-results+json' } });
  let body = null;
  try { body = await r?.json(); } catch { /* not JSON: reported below */ }
  return [check('query runs', typeof body?.boolean === 'boolean', r ? `HTTP ${r.status}` : 'no answer')];
}

async function probeShell() {
  const page = await web(`http://127.0.0.1:${C.shellPort}${SHELL_PAGE}`);
  const text = page?.ok ? await page.text() : '';
  const script = await web(`http://127.0.0.1:${C.shellPort}${SHELL_PAGE}foafos-shell.js`, { method: 'HEAD' });
  return [
    check('page loads', /foafos/i.test(text), page ? `HTTP ${page.status}` : 'no answer'),
    check('shell code served', script?.ok, script ? `HTTP ${script.status}` : 'no answer'),
    check('apps may load it', page?.headers.get('access-control-allow-origin') === '*', 'sandboxed apps need its CORS header'),
  ];
}

async function probeBotLike(pid) {
  const link = run('lsof', ['-nP', '-a', '-p', String(pid), '-iTCP', '-sTCP:ESTABLISHED', '-Fn']);
  return [check('connected to XMPP', /:5223\b/.test(link), link ? '' : 'no connection')];
}

async function probeBot(pid) {
  const link = run('lsof', ['-nP', '-a', '-p', String(pid), '-iTCP', '-sTCP:ESTABLISHED', '-Fn']);
  return [check('signed in to xmpp', new RegExp(`:${C.xmppPort}\\b`).test(link), link ? '' : 'no connection to the XMPP server')];
}

// ── the services ────────────────────────────────────────────────────────

const chatAi = () => join(C.shellRoot, 'glitchcan-minigam/inklet/tools/chat-ai.py');
const webdavDir = () => join(STATE, 'webdav');
/** The login names in the WebDAV users file (NAME:pbkdf2-sha256:...); the hashes are not read. */
const webdavLogins = () => { try { return readFileSync(C.webdavUsers, 'utf8').split('\n').map((l) => l.split(':')[0]).filter((n) => /^[A-Za-z0-9_.-]{1,64}$/.test(n)); } catch { return []; } };
const lwsAuthArgs = () => (C.lwsInsecure ? ['--insecure-no-auth'] : ['--authz', K.authz, '--allow-http', '--root-acl', K.acl]);
const INSECURE_WORDS = 'THE FILE STORAGE RUNS WITH NO AUTHORIZATION (FOAFOS_LWS_INSECURE_NO_AUTH): any program on this computer can read and write it';
const flyAccount = (name) => {
  try { return readFileSync(join(C.flyDir, 'accounts'), 'utf8').split('\n').find((l) => l.startsWith(`${name}:`))?.slice(name.length + 1) ?? null; } catch { return null; }
};
const ORIGINS = (flag) => [flag, 'https://danbri.github.io', flag, SHELL_ORIGIN];
const SERVICES = {
  xmpp: {
    title: 'chat server', always: true, ports: () => [C.xmppPort, C.wsPort], sign: 'xmpp-serve', factoidal: true, probe: probeXmpp, cwd: () => HOME,
    argv: () => ['factoidal', 'xmpp-serve', C.xmppDir, '--domain', 'localhost', '--muc', 'rooms.localhost',
      ...(C.xmppPort === 5222 ? [] : ['--port', String(C.xmppPort)]), '--ws-port', String(C.wsPort), ...ORIGINS('--ws-origin'), '--state-key', C.xmppKey],
    needs: () => [
      existsSync(join(C.xmppDir, 'accounts')) ? null : `no ${short(join(C.xmppDir, 'accounts'))}: see "One-time setup" in the guide`,
      existsSync(C.xmppKey) ? null : `no ${short(C.xmppKey)}: see "One-time setup" in the guide`],
  },
  lws: {
    title: 'file storage', always: true, ports: () => [C.lwsPort], sign: 'lws-serve', factoidal: true, probe: probeLws, cwd: () => HOME,
    argv: () => ['factoidal', 'lws-serve', C.lwsDir, ...lwsAuthArgs(), '--host', '127.0.0.1', '--port', String(C.lwsPort), '--storage', 'files',
      '--cors-origin', SHELL_ORIGIN, '--cors-origin', 'https://danbri.github.io'],
    needs: () => [
      env.FOAFOS_LWS_AUTH ? 'FOAFOS_LWS_AUTH is no longer read: the storage always runs with authorization. Unset it (see docs/foafos-local-lws-auth-20261107.md)' : null,
      C.lwsInsecure || setupDone() ? null : `the storage has no owner and no ACL yet: run foafos-stack lws-setup once (it leaves the data in ${short(C.lwsDir)} as it is)`],
  },
  webdav: {
    title: 'read-only folders for Finder', always: true, after: 'lws', ports: () => [C.webdavPort], sign: 'webdav-serve', factoidal: true, probe: probeWebdav, cwd: () => HOME,
    // No --guest: a request with no login gets 401. The mount reaches LWS only as its own did:key agent.
    argv: () => ['factoidal', 'webdav-serve', webdavDir(), '--host', '127.0.0.1', '--port', String(C.webdavPort), '--users', C.webdavUsers],
    needs: () => {
      const users = webdavLogins();
      if (!existsSync(K.webdav)) return ['no key for the Finder folders: run foafos-stack lws-setup'];
      if (!users.length) return [`no WebDAV login in ${short(C.webdavUsers)}: run foafos-stack lws-setup, or factoidal webdav-user ${short(C.webdavUsers)} ${C.webdavUser}`];
      mkdirSync(webdavDir(), { recursive: true, mode: 0o700 });
      chmodSync(webdavDir(), 0o700);
      writeFileSync(join(webdavDir(), 'foafos.md'), `# Foafos\n\n- kind: lws\n- url: ${lwsBase()}\n- auth: did-key\n- key-file: ${K.webdav}\n- users: ${users.join(', ')}\n`, { mode: 0o600 });
      return [];
    },
  },
  sparql: {
    title: 'data queries', always: true, ports: () => [C.sparqlPort], sign: 'serve --file', factoidal: true, probe: probeSparql, cwd: () => HOME,
    argv: () => ['factoidal', 'serve', '--file', C.sparqlFile, '/ds', '--host', '127.0.0.1', '--port', String(C.sparqlPort)],
    needs: () => [existsSync(C.sparqlFile) ? null : `no RDF file at ${short(C.sparqlFile)}: set FOAFOS_SPARQL_FILE`],
  },
  shell: {
    title: 'Foafos itself', always: true, ports: () => [C.shellPort], sign: 'serve-foafos.py', probe: probeShell, cwd: () => C.shellRoot,
    argv: () => ['python3', join(HERE, 'serve-foafos.py'), String(C.shellPort)],
    needs: () => [existsSync(join(C.shellRoot, 'glitchcan-minigam')) ? null : `no glitchcan-minigam in ${short(C.shellRoot)}: set FOAFOS_SHELL_ROOT`],
  },
  // This laptop's pod, dialling out to the XMPP server on Fly. It is off unless named: see the security
  // review before leaving it on, because the server is public.
  'pod-laptop': {
    title: 'laptop pod on Fly XMPP (optional)', always: false, ports: () => [], sign: 'pod.mjs', probe: probeBotLike, cwd: () => join(C.shellRoot, 'glitchcan-minigam/packages/foafos/pod'),
    argv: () => ['node', 'pod.mjs', '--base', `https://pod-laptop.${C.flyHost}/`, '--dir', join(HOME, 'foafos-lws-xmpp'), '--xmpp', `xmpps://${C.flyHost}:5223`,
      '--domain', C.flyHost, '--jid', 'podlaptop', '--allow', `foafos@${C.flyHost}`,
      '--route', 'GET,HEAD,PUT,POST,PATCH,DELETE /', '--insecure-no-auth'],
    env: () => ({ POD_PASSWORD: flyAccount('podlaptop') ?? '' }),
    needs: () => {
      mkdirSync(join(HOME, 'foafos-lws-xmpp'), { recursive: true });
      return [
        flyAccount('podlaptop') ? null : `no podlaptop account in ${short(join(C.flyDir, 'accounts'))}`,
        existsSync(join(C.shellRoot, 'glitchcan-minigam/packages/foafos/pod/node_modules')) ? null : 'run npm install in packages/foafos/pod'];
    },
  },
  foafbot: {
    title: 'room bot (optional)', always: false, after: 'xmpp', ports: () => [], sign: 'chat-ai.py', probe: probeBot, cwd: () => HOME,
    argv: () => ['python3', chatAi(), '--account', C.bot, '--nick', C.bot, '--port', String(C.xmppPort), '--dir', C.xmppDir],
    needs: () => [
      existsSync(chatAi()) ? null : `no chat-ai.py in ${short(C.shellRoot)}`,
      accountNames().includes(C.bot) ? null : `no ${C.bot} account in ${short(join(C.xmppDir, 'accounts'))}: see the top of chat-ai.py`,
      run('which', ['claude']) ? null : 'the claude command is not on PATH'],
  },
};
const NAMES = Object.keys(SERVICES);
const DEFAULTS = NAMES.filter((n) => SERVICES[n].always);

// ── what is really running ──────────────────────────────────────────────

const recordFile = (n) => join(RUN, `${n}.json`);
const oldPidFile = (n) => join(RUN, `${n}.pid`);   // written by the shell-script version of this tool

/** What was started, or null. A pid file from the old script is adopted as it stands. */
function record(n) {
  try { return JSON.parse(readFileSync(recordFile(n), 'utf8')); } catch { /* none, or unreadable */ }
  try { return { pid: Number(readFileSync(oldPidFile(n), 'utf8')), adopted: true }; } catch { return null; }
}
const forget = (n) => { rmSync(recordFile(n), { force: true }); rmSync(oldPidFile(n), { force: true }); };

/** The process, if `pid` is still the one we started: a pid can be reused, so its signature and start time must match. */
function processOf(n, rec) {
  if (!rec?.pid) return null;
  const line = run('ps', ['-o', 'stat=,pgid=,lstart=,command=', '-p', String(rec.pid)]).trim();
  const m = /^(\S+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+[\d:]{8}\s+\d{4}|\w{3}\s+\d+\s+\w{3}\s+[\d:]{8}\s+\d{4})\s+(.*)$/.exec(line);
  if (!m || m[1].startsWith('Z') || !m[4].includes(SERVICES[n].sign)) return null;
  // Compared as times: the text of a start time depends on the locale it was recorded in.
  if (rec.lstart && Date.parse(rec.lstart) !== Date.parse(m[3])) return null;
  return { pid: rec.pid, pgid: Number(m[2]), lstart: m[3], command: m[4] };
}

/** Who is listening on a port, and on which address. */
function listeners(port) {
  const out = [];
  let pid = 0;
  for (const l of run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpn']).split('\n')) {
    if (l[0] === 'p') pid = Number(l.slice(1));
    if (l[0] === 'n') out.push({ pid, address: l.slice(1) });
  }
  return out;
}
const pgidOf = (pid) => Number(run('ps', ['-o', 'pgid=', '-p', String(pid)]).trim());
const commandOf = (pid) => run('ps', ['-o', 'command=', '-p', String(pid)]).trim().replace(/^\S*\/Python /, 'python ').slice(0, 90);
const cwdOf = (pid) => /^n(.+)$/m.exec(run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']))?.[1] || '';

function uptime(ms) {
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
  return d ? `${d}d${h}h` : h ? `${h}h${String(m).padStart(2, '0')}m` : m ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

/** The last line since the last start that looks like trouble. */
function logTrouble(n) {
  const text = logSinceStart(n);
  return text.split('\n').filter((l) => /\b(error|fatal|exception|traceback|refused|failed)\b/i.test(l) && !/EXPERIMENTAL/.test(l)).pop()?.slice(0, 140) || '';
}
function logSinceStart(n) {
  let text = '';
  try {
    const file = join(LOGS, `${n}.log`);
    const size = statSync(file).size, from = Math.max(0, size - 65536), fd = openSync(file, 'r'), buf = Buffer.alloc(size - from);
    readSync(fd, buf, 0, buf.length, from); closeSync(fd);
    text = buf.toString();
  } catch { return ''; }
  const i = text.lastIndexOf('=== start ');
  return i < 0 ? text : text.slice(i);
}

function gitOf(dir) {
  const repo = join(dir, 'glitchcan-minigam');
  const git = (...a) => run('git', ['-C', repo, ...a]).trim();
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (!branch) return null;
  const changed = git('status', '--porcelain', '--untracked-files=no').split('\n').filter(Boolean).length;
  return { branch, commit: git('rev-parse', '--short', 'HEAD'), changed };
}

/** The whole truth about one service. */
async function inspect(n) {
  const s = SERVICES[n], rec = record(n), proc = processOf(n, rec);
  const out = { name: n, title: s.title, state: 'stopped', pid: null, uptime: null, ports: [], checks: [], problems: [], notes: [], fix: null,
    command: null, cwd: null, log: join(LOGS, `${n}.log`), logBytes: existsSync(join(LOGS, `${n}.log`)) ? statSync(join(LOGS, `${n}.log`)).size : 0 };
  const seen = s.ports().map((port) => ({ port, listeners: listeners(port) }));

  if (!proc) {
    const taken = seen.find((p) => p.listeners.length);
    if (taken) {
      const pid = taken.listeners[0].pid;
      out.state = 'blocked'; out.pid = pid;
      out.ports = seen.map((p) => ({ port: p.port, listening: !!p.listeners.length, ours: false }));
      out.problems.push(`port ${taken.port} is held by something this tool did not start: pid ${pid}, ${commandOf(pid)}`);
      out.fix = `kill ${pid}, then foafos-stack start ${n}`;
      return out;
    }
    out.ports = seen.map((p) => ({ port: p.port, listening: false, ours: false }));
    if (rec) {
      out.state = 'crashed';
      out.problems.push(`stopped without being asked to${rec.startedAt ? ` (started ${new Date(rec.startedAt).toLocaleString()})` : ''}`);
      const why = logTrouble(n);
      if (why) out.problems.push(`log says: ${why}`);
      out.fix = `foafos-stack logs ${n} --no-follow, then foafos-stack restart ${n}`;
    }
    return out;
  }

  out.pid = proc.pid;
  out.command = proc.command;
  out.cwd = cwdOf(proc.pid);
  const started = Date.parse(proc.lstart);
  out.uptime = Number.isNaN(started) ? null : uptime(Date.now() - started);
  for (const { port, listeners: ls } of seen) {
    const mine = ls.filter((l) => l.pid === proc.pid || pgidOf(l.pid) === proc.pgid);
    out.ports.push({ port, listening: !!ls.length, ours: !!mine.length, addresses: ls.map((l) => l.address) });
    if (!ls.length) out.problems.push(`not listening on port ${port}`);
    else if (!mine.length) out.problems.push(`port ${port} is held by another process, pid ${ls[0].pid}`);
    for (const l of ls) if (!/^(127\.0\.0\.1|\[::1\]|localhost):/.test(l.address)) out.problems.push(`open beyond this computer: ${l.address}`);
  }
  out.checks = out.ports.every((p) => p.listening) ? await s.probe(proc.pid) : [];
  for (const c of out.checks) if (!c.ok) out.problems.push(`${c.name} failed${c.detail ? `: ${c.detail}` : ''}`);
  const young = rec.startedAt && Date.now() - rec.startedAt < START_WAIT;
  out.state = !out.problems.length ? 'healthy' : young ? 'starting' : 'degraded';
  if (out.state === 'degraded') {
    out.fix = `foafos-stack logs ${n} --no-follow, then foafos-stack restart ${n}`;
    const why = logTrouble(n);
    if (why) out.problems.push(`log says: ${why}`);
  }
  // Running, but not as it would start now.
  const wanted = s.argv().slice(1).join(' ');
  if (!proc.command.includes(wanted)) out.notes.push(`running with older settings: foafos-stack restart ${n} to apply them`);
  if (s.cwd() !== out.cwd && out.cwd && realOr(s.cwd()) !== realOr(out.cwd)) out.notes.push(`running in ${short(out.cwd)}, not ${short(s.cwd())}: foafos-stack restart ${n} to apply`);
  if (s.factoidal) {
    if (rec.version && installedVersion() && rec.version !== installedVersion()) out.notes.push(`running ${rec.version}, but ${installedVersion()} is installed: foafos-stack restart ${n}`);
  }
  if (n === 'lws' && proc.command.includes('--insecure-no-auth')) out.notes.push(red(INSECURE_WORDS));
  return out;
}
const realOr = (p) => { try { return realpathSync(p); } catch { return p; } };
let versionCache;
const installedVersion = () => (versionCache ??= /@factoidal\/core\s+(\S+)/.exec(run('factoidal', ['--version']))?.[1] || '');

// ── start and stop ──────────────────────────────────────────────────────

function launch(n) {
  const s = SERVICES[n], log = join(LOGS, `${n}.log`);
  try { if (statSync(log).size > LOG_MAX) renameSync(log, `${log}.1`); } catch { /* no log yet */ }
  const fd = openSync(log, 'a', 0o600);
  writeFileSync(fd, `\n=== start ${new Date().toISOString()} ${n} ===\n`);
  if (n === 'lws') mkdirSync(C.lwsDir, { recursive: true });
  const [cmd, ...args] = s.argv();
  // detached: its own session, so no closing terminal can hang it up.
  const child = spawn(cmd, args, { cwd: s.cwd(), detached: true, stdio: ['ignore', fd, fd], env: { ...env, PYTHONUNBUFFERED: '1', ...(s.env ? s.env() : {}) } });
  child.on('error', () => {});
  child.unref();
  closeSync(fd);
  if (!child.pid) return null;
  const rec = { pid: child.pid, startedAt: Date.now(), argv: s.argv(), cwd: s.cwd(), version: s.factoidal ? installedVersion() : undefined };
  rec.lstart = processOf(n, { pid: child.pid })?.lstart;
  if (!rec.lstart) { spawnSync('sleep', ['0.1']); rec.lstart = processOf(n, { pid: child.pid })?.lstart; }
  writeFileSync(recordFile(n), JSON.stringify(rec, null, 2));
  rmSync(oldPidFile(n), { force: true });
  return rec;
}

async function startOne(n) {
  const s = SERVICES[n];
  const now = await inspect(n);
  if (now.state === 'healthy') { say(`${n}: already running (pid ${now.pid})`); return true; }
  if (['starting', 'degraded'].includes(now.state)) { say(yellow(`${n}: already running but ${now.state}: ${now.problems[0]}`)); return false; }
  if (now.state === 'blocked') { for (const p of now.problems) say(red(`${n}: ${p}`)); say(`  fix: ${now.fix}`); return false; }
  if (s.factoidal && !run('which', ['factoidal'])) { say(red(`${n}: the factoidal command is not on PATH: npm i -g @factoidal/core`)); return false; }
  const missing = s.needs().filter(Boolean);
  if (missing.length) { for (const m of missing) say(red(`${n}: ${m}`)); return false; }
  if (s.after && (await inspect(s.after)).state !== 'healthy') { say(red(`${n}: needs ${s.after} running first: foafos-stack start ${s.after}`)); return false; }
  if (n === 'lws' && C.lwsInsecure) say(red(bold(`lws: WARNING: ${INSECURE_WORDS}. Unset FOAFOS_LWS_INSECURE_NO_AUTH to stop this.`)));
  forget(n);
  const rec = launch(n);
  if (!rec) { say(red(`${n}: could not start ${s.argv()[0]}`)); return false; }
  const deadline = Date.now() + START_WAIT;
  for (;;) {
    await sleep(250);
    const r = await inspect(n);
    if (r.state === 'healthy') { say(green(`${n}: started`) + ` (pid ${r.pid}${r.ports.length ? `, port ${r.ports.map((p) => p.port).join(',')}` : ''})`); return true; }
    if (r.state === 'blocked') { for (const p of r.problems) say(red(`${n}: ${p}`)); return false; }
    if (r.state === 'crashed' || r.state === 'stopped') {
      say(red(`${n}: exited during start. Its log:`));
      say(logSinceStart(n).trim().split('\n').slice(-12).map((l) => `  ${l.slice(0, 150)}`).join('\n'));
      return false;
    }
    if (Date.now() > deadline) { say(red(`${n}: still not healthy after ${START_WAIT / 1000}s: ${r.problems.join('; ')}`)); say(`  see: foafos-stack logs ${n} --no-follow`); return false; }
  }
}

async function stopOne(n) {
  const rec = record(n), proc = processOf(n, rec);
  if (!proc) {
    const r = await inspect(n);
    if (r.state === 'blocked') { say(yellow(`${n}: not started by this tool, so left alone. ${r.problems[0]}`)); return false; }
    forget(n);
    say(rec ? `${n}: was not running; cleared its crash record` : `${n}: not running`);
    return true;
  }
  const signal = (sig) => { try { process.kill(proc.pgid === proc.pid ? -proc.pid : proc.pid, sig); } catch { /* gone */ } };
  signal('SIGTERM');
  const deadline = Date.now() + STOP_WAIT;
  while (processOf(n, rec) && Date.now() < deadline) await sleep(100);
  let killed = false;
  if (processOf(n, rec)) { signal('SIGKILL'); killed = true; await sleep(300); }
  const left = SERVICES[n].ports().filter((p) => listeners(p).length);
  forget(n);
  try { appendFileSync(join(LOGS, `${n}.log`), `=== stop ${new Date().toISOString()} ${n} ===\n`); } catch { /* no log */ }
  if (left.length) { say(red(`${n}: stopped, but port ${left.join(',')} is still in use`)); return false; }
  say(killed ? yellow(`${n}: did not stop in ${STOP_WAIT / 1000}s, so it was killed`) : `${n}: stopped`);
  return true;
}

// ── status ──────────────────────────────────────────────────────────────

const COLOUR = { healthy: green, starting: yellow, degraded: red, crashed: red, blocked: red, stopped: dim };

async function status(flags) {
  const all = await Promise.all(NAMES.map(inspect));
  const required = all.filter((r) => SERVICES[r.name].always || r.state !== 'stopped');
  const wrong = required.filter((r) => r.state !== 'healthy');
  const git = gitOf(all.find((r) => r.name === 'shell').cwd || C.shellRoot);
  if (flags.json) {
    say(JSON.stringify({ at: new Date().toISOString(), healthy: !wrong.length, services: all, shell: { root: C.shellRoot, git } }, null, 2));
    return wrong.length ? 1 : 0;
  }
  say(`${bold('Foafos stack')}  ${new Date().toLocaleTimeString()}  ${wrong.length ? red(`${wrong.length} of ${required.length} not healthy`) : green(`all ${required.length} healthy`)}`);
  say();
  const row = (a, b, c, d, e, f) => `${a.padEnd(9)}${b}${c.padEnd(8)}${d.padEnd(9)}${e.padEnd(11)}${f}`;
  say(dim(row('SERVICE', 'STATE'.padEnd(10), 'PID', 'UP', 'PORTS', 'CHECKED')));
  for (const r of all) {
    const checks = r.checks.map((c) => (c.ok ? green('✓ ') : red('✗ ')) + c.name).join('  ');
    say(row(r.name, COLOUR[r.state](r.state.padEnd(10)), String(r.pid ?? '-'), r.uptime ?? '-', r.ports.map((p) => p.port).join(',') || '-', checks || dim(r.title)));
    if (flags.verbose) {
      if (r.command) say(dim(`         command: ${r.command}`));
      if (r.cwd) say(dim(`         folder:  ${short(r.cwd)}`));
      for (const c of r.checks) if (c.detail) say(dim(`         ${c.name}: ${c.detail}`));
      for (const p of r.ports) if (p.addresses) say(dim(`         port ${p.port}: ${p.addresses.join(', ')}`));
      say(dim(`         log:     ${short(r.log)} (${Math.round(r.logBytes / 1024)} KB)`));
    }
  }
  const trouble = all.filter((r) => r.problems.length || (SERVICES[r.name].always && r.state === 'stopped'));
  if (trouble.length) {
    say(); say(bold('To fix'));
    for (const r of trouble) {
      if (r.state === 'stopped') { say(`  ${r.name}: stopped. ${dim('Run:')} foafos-stack start ${r.name}`); continue; }
      for (const p of r.problems) say(`  ${r.name}: ${p}`);
      if (r.fix) say(`  ${dim('Run:')} ${r.fix}`);
    }
  }
  const notes = all.flatMap((r) => r.notes.map((t) => `${r.name}: ${t}`));
  if (notes.length) { say(); say(bold('Worth knowing')); for (const t of notes) say(`  ${t}`); }
  say();
  const where = all.find((r) => r.name === 'shell').cwd || C.shellRoot;
  say(`${dim('Shell code:')} ${short(where)}${git ? `, ${git.branch} at ${git.commit}${git.changed ? yellow(`, ${git.changed} files changed`) : ''}` : ''}`);
  say(`${dim('Logs:')}       ${short(LOGS)}  ${dim('(foafos-stack logs)')}`);
  return wrong.length ? 1 : 0;
}

// ── logs, doctor, urls ──────────────────────────────────────────────────

async function logs(args) {
  let lines = '40', follow = true;
  const names = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-n') {
      lines = args[++i];
      if (!/^\d+$/.test(lines ?? '')) { say(red('-n needs a number of lines')); return 2; }
    }
    else if (args[i] === '--no-follow') follow = false;
    else if (SERVICES[args[i]]) names.push(args[i]);
    else { say(red(`unknown: ${args[i]} (services: ${NAMES.join(' ')})`)); return 2; }
  }
  const tails = [];
  const chosen = (names.length ? names : NAMES).filter((n) => names.length || existsSync(join(LOGS, `${n}.log`)));
  const kids = chosen.map((n) => {
    const file = join(LOGS, `${n}.log`);
    if (!existsSync(file)) writeFileSync(file, '');
    const k = spawn('tail', ['-n', lines, ...(follow ? ['-F'] : []), file], { stdio: ['ignore', 'pipe', 'ignore'] });
    let rest = '';
    k.stdout.on('data', (d) => {
      const part = (rest + d).split('\n');
      rest = part.pop();
      for (const l of part) say(`${dim(n.padEnd(8) + '|')} ${l}`);
    });
    tails.push(k);
    return new Promise((r) => k.on('close', r));
  });
  const stop = () => { for (const k of tails) k.kill(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  await Promise.all(kids);
  return 0;
}

function doctor() {
  const rows = [];
  const add = (ok, what, fix = '') => rows.push({ ok, what, fix });
  const major = Number(process.versions.node.split('.')[0]);
  add(major >= 20, `node ${process.versions.node}`, 'needs node 20 or later');
  add(!!run('which', ['lsof']), 'lsof, for status', 'status cannot see ports without it');
  add(!!run('which', ['python3']), 'python3, for the shell');
  const v = installedVersion();
  add(!!v, v ? `factoidal ${v}` : 'factoidal', 'npm i -g @factoidal/core');
  const accounts = accountNames();
  add(accounts.length > 0, `XMPP accounts: ${accounts.join(', ') || 'none'}`, 'see "One-time setup" in the guide');
  try { const m = statSync(join(C.xmppDir, 'accounts')).mode & 0o077; add(!m, 'accounts file is private', `chmod 600 ${short(join(C.xmppDir, 'accounts'))}`); } catch { /* reported above */ }
  add(existsSync(C.xmppKey), `state key ${short(C.xmppKey)}`, 'see "One-time setup" in the guide');
  try { add(!(statSync(C.xmppKey).mode & 0o077), 'state key is private', `chmod 600 ${short(C.xmppKey)}`); } catch { /* reported above */ }
  add(existsSync(join(C.shellRoot, 'glitchcan-minigam')), `shell code in ${short(C.shellRoot)}`, 'set FOAFOS_SHELL_ROOT');
  add(existsSync(join(HERE, 'serve-foafos.py')), 'serve-foafos.py beside this script');
  add(existsSync(C.sparqlFile), `RDF file ${short(C.sparqlFile)}`, 'set FOAFOS_SPARQL_FILE');
  add(C.lwsInsecure || setupDone(), `storage owner and ACL for ${short(C.lwsDir)}`, 'foafos-stack lws-setup');
  for (const f of [K.owner, K.webdav, C.webdavUsers]) {
    try { add(!(statSync(f).mode & 0o077), `${short(f)} is private`, `chmod 600 ${short(f)}`); } catch { /* not made yet: reported above */ }
  }
  if (C.lwsInsecure) rows.push({ ok: false, what: INSECURE_WORDS, fix: 'unset FOAFOS_LWS_INSECURE_NO_AUTH' });
  if (existsSync(C.sparqlFile) && !statSync(C.sparqlFile).size) rows.push({ ok: null, what: 'that RDF file is empty, so SPARQL has no data', fix: '' });
  rows.push({ ok: accounts.includes(C.bot) ? true : null, what: `${C.bot} account, for the optional room bot`, fix: 'see the top of chat-ai.py' });
  rows.push({ ok: run('which', ['claude']) ? true : null, what: 'claude command, for the optional room bot', fix: '' });
  try { const f = statfsSync(HOME), gb = (f.bavail * f.bsize) / 1e9; rows.push({ ok: gb > 2 ? true : null, what: `${gb.toFixed(1)} GB free on disk`, fix: gb > 2 ? '' : 'low: logs and storage can fill it' }); } catch { /* unknown */ }
  for (const r of rows) say(`${r.ok === true ? green('✓') : r.ok === null ? yellow('!') : red('✗')} ${r.what}${r.ok === true || !r.fix ? '' : dim(`  (${r.fix})`)}`);
  return rows.some((r) => r.ok === false) ? 1 : 0;
}

// ── backstage: the bots, read only ──────────────────────────────────────
// The laptop side (the bot process, its model, its /tell file, its refusals),
// then the room through xmpp-chat.py --jsonl. Model and help text:
// packages/foafos/src/backstage.mjs. Design: docs/foafos-backstage-20261106.md.

function botSide() {
  const rec = record('foafbot');
  const proc = processOf('foafbot', rec);
  let model = '';
  const flag = proc && /--model\s+(\S+)/.exec(proc.command);
  if (flag) model = flag[1];
  else { try { model = /'--model', default='([^']+)'/.exec(readFileSync(existsSync(chatAi()) ? chatAi() : join(HERE, 'chat-ai.py'), 'utf8'))?.[1] || ''; } catch { /* no chat-ai.py */ } }
  const tellFile = join(C.xmppDir, 'foafbot-tell.json');
  let tell;
  try {
    const t = JSON.parse(readFileSync(tellFile, 'utf8'));
    tell = { file: short(tellFile), owners: Array.isArray(t.owners) ? t.owners.map(String) : [],
      allow: Object.fromEntries(Object.entries(t.allow || {}).map(([k, v]) => [k, Array.isArray(v) ? v.map(String) : []])) };
  } catch (e) { tell = { file: short(tellFile), off: existsSync(tellFile) ? 'unreadable' : 'no file' }; }
  let refusals = [];
  try { refusals = readFileSync(join(LOGS, 'foafbot.log'), 'utf8').split('\n').filter((l) => l.includes('tell refused')).slice(-5); } catch { /* no log */ }
  return { account: C.bot, running: !!proc, pid: proc?.pid ?? null, model, modelFrom: flag ? 'command line' : 'chat-ai.py default', tell, refusals };
}

async function backstage(args) {
  if (args[0] === 'help' || args.includes('--help') || args.includes('-h')) { say(helpText('cli')); return 0; }
  const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
  const server = ['local', 'proto', 'shared'].find((s) => args.includes(s)) || 'local';
  const watch = args.includes('--watch');
  const json = args.includes('--json');
  const wait = Number(opt('--wait', 8));
  const bot = botSide();
  if (!json) {
    say(bold('This laptop'));
    say(`  ${bot.running ? green('●') : dim('○')} ${bot.account}: ${bot.running ? `running (pid ${bot.pid})` : 'not running (foafos-stack start foafbot)'}`);
    say(`    model ${bot.model || '(unknown)'}, from the ${bot.modelFrom}`);
    say(bot.tell.off ? `    /tell off: ${bot.tell.off} at ${bot.tell.file}`
      : `    /tell on: owners ${bot.tell.owners.join(', ') || 'none'}; allow ${Object.entries(bot.tell.allow).map(([a, l]) => `${a} ${l.join(' ')}`).join('; ') || 'nothing'}`);
    say(`    last /tell refusals: ${bot.refusals.length ? '' : 'none in the log'}`);
    for (const l of bot.refusals) say(`      ${dim(l)}`);
    say('');
  }
  const nick = `backstage-${Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')}`;
  const model = new Backstage({ self: nick });
  const argv = [join(HERE, 'xmpp-chat.py'), server, '--as', opt('--as', 'me'), '--room', opt('--room', 'bus'), '--nick', nick, '--jsonl', '--wait', String(watch ? 7 * 24 * 3600 : wait)];
  let room = '', failed = '';
  if (!json) say(bold(`The room on ${server}`) + dim(watch ? '  (Ctrl-C to stop)' : `  (listening ${wait} seconds)`));
  const kid = spawn('python3', argv, { stdio: ['ignore', 'pipe', 'pipe'] });
  let rest = '', err = '';
  kid.stderr.on('data', (d) => { err += d; });
  kid.stdout.on('data', (d) => {
    const part = (rest + d).split('\n');
    rest = part.pop();
    for (const l of part) {
      let e; try { e = JSON.parse(l); } catch { continue; }
      if (e.t === 'connected') room = e.room;
      else if (e.t === 'presence') model.presence(e.nick, { present: e.type !== 'unavailable' && e.type !== 'error', role: e.role });
      else if (e.t === 'error') failed = `the room refused ${e.nick}: ${e.cond}`;
      else if (e.t === 'groupchat') {
        const before = model.acts.length;
        model.message(e.nick, e.body, { marked: !!e.marked, ts: e.ts });
        if (watch && model.acts.length > before) {
          const a = model.acts[model.acts.length - 1];
          say(`${new Date(a.ts).toISOString().slice(11, 19)} ${a.ok ? green('ok     ') : red('refused')} ${a.who || '?'} ${a.what}${a.ok ? '' : ` (${a.reason})`}  ${dim(`${a.topic} via ${a.by}`)}`);
        }
      }
    }
  });
  const stop = () => kid.kill('SIGINT');
  process.on('SIGINT', stop);
  const code = await new Promise((r) => kid.on('close', r));
  process.off('SIGINT', stop);
  if (!room) { say(red(`could not join: ${err.trim() || `xmpp-chat.py exited ${code}`}`)); return 1; }
  const snap = model.snapshot();
  if (json) { say(JSON.stringify({ laptop: bot, room, nick, ...snap }, null, 2)); return failed ? 1 : 0; }
  for (const l of describe(snap, { room })) say(`  ${l}`);
  if (failed) say(red(`  ${failed}`));
  say(dim('  Kinds are guesses from the room. foafos-stack backstage help says what this can and cannot see.'));
  return failed ? 1 : 0;
}

function urls() {
  say(`Moglob   ${SHELL_ORIGIN}${SHELL_PAGE}?app=docklands`);
  say(`All apps ${SHELL_ORIGIN}${SHELL_PAGE}?root=all`);
  say(`Drift    ${SHELL_ORIGIN}${SHELL_PAGE}?app=drift`);
  say(`XMPP     ws://127.0.0.1:${C.wsPort}/xmpp-websocket  (TCP 127.0.0.1:${C.xmppPort}, room bus@rooms.localhost)`);
  say(`LWS      http://127.0.0.1:${C.lwsPort}/`);
  say(`WebDAV   http://127.0.0.1:${C.webdavPort}/  (Finder: Go, Connect to Server, then Registered User, with your WebDAV login; read only)`);
  say(`SPARQL   http://127.0.0.1:${C.sparqlPort}/ds/sparql`);
  say(`Backstage ${SHELL_ORIGIN}${SHELL_PAGE}?app=backstage  (and ${SHELL_ORIGIN}${SHELL_PAGE}backstage.html)`);
}

// ── the storage's owner, ACL and agents ─────────────────────────────────

/** Once: the keys, the ACL, and for a storage that already holds data, that ACL written through LWS. */
async function lwsSetup(args = []) {
  const openWindow = args.includes('--open-acl-window');
  mkdirSync(LWSK, { recursive: true, mode: 0o700 });
  chmodSync(LWSK, 0o700);
  if (!factoidalPkg() || !existsSync(join(factoidalPkg(), 'lws/client.mjs'))) { say(red('no @factoidal/core with lws/client.mjs behind the factoidal command: npm i -g @factoidal/core')); return 1; }
  let a = readJson(K.agents);
  if (!a) {
    if (existsSync(K.owner) || existsSync(K.webdav)) { say(red(`key files in ${short(LWSK)} but no agents.json: move them away, then run lws-setup again`)); return 1; }
    a = { owner: await makeAgent(K.owner), webdav: await makeAgent(K.webdav), agents: [] };
    writeFileSync(K.agents, `${JSON.stringify(a, null, 2)}\n`, { mode: 0o600 });
    say(`made the storage owner ${a.owner}`);
    say(`made the Finder folders' agent ${a.webdav} (read only)`);
  }
  const acl = aclText(a);
  if (readJson(K.setup)?.dir !== C.lwsDir) {
    if (processOf('lws', record('lws'))) { say(red('lws is running: foafos-stack stop webdav lws, then lws-setup, then start')); return 1; }
    const existing = ['lws-files.json', 'lws-journal', 'lws-state.json'].some((f) => existsSync(join(C.lwsDir, f)));
    let how = 'new';
    let backup = null;
    if (existing) {
      // An existing storage with no root ACL refuses every agent once authorization is on. A factoidal
      // that installs --root-acl into an existing storage at start (before it answers any request) gives
      // it its ACL with authorization on from the first moment. An older one cannot: then the only way is
      // the old one, a short start with NO authorization, and only when asked for by --open-acl-window.
      const installs = await rootAclInstallSupported();
      if (!installs && !openWindow) {
        say(red('the factoidal behind the factoidal command cannot give an existing storage its first ACL with authorization on.'));
        say(red('Update it (npm i -g @factoidal/core), then run lws-setup again. Nothing was changed.'));
        say(`Or, knowing that for about a second any program on this computer could read and write ${short(C.lwsDir)}: foafos-stack lws-setup --open-acl-window`);
        return 1;
      }
      backup = `${C.lwsDir}.before-acl-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 13)}`;
      if (existsSync(backup)) { say(red(`${short(backup)} exists already: move it away`)); return 1; }
      if (spawnSync('cp', ['-Rp', C.lwsDir, backup]).status !== 0) { say(red(`could not copy ${short(C.lwsDir)} to ${short(backup)}`)); return 1; }
      say(`copied the storage to ${short(backup)} first (nothing is deleted)`);
      if (!installs) say(yellow('--open-acl-window: the storage runs with NO authorization for about a second, on a private port'));
      const r = installs ? await installFirstAcl(acl, a) : await writeFirstAcl(acl);
      if (!r.ok) { say(red(r.why)); return 1; }
      how = r.how;
    }
    writeFileSync(K.acl, acl, { mode: 0o600 });
    writeFileSync(K.setup, `${JSON.stringify({ dir: C.lwsDir, at: new Date().toISOString(), how, backup }, null, 2)}\n`, { mode: 0o600 });
    say(how === 'new' ? `${short(C.lwsDir)}: a new storage gets this ACL at its first start` : `${short(C.lwsDir)}: ${how}`);
  } else say(`${short(C.lwsDir)}: has its owner and ACL already`);
  if (!webdavLogins().length) {
    if (process.stdin.isTTY) {
      say(`a WebDAV login for Finder, user "${C.webdavUser}":`);
      spawnSync('factoidal', ['webdav-user', C.webdavUsers, C.webdavUser], { stdio: 'inherit' });
    } else say(yellow(`no WebDAV login yet: factoidal webdav-user ${short(C.webdavUsers)} ${C.webdavUser}`));
  }
  say('');
  say('Next: foafos-stack start. Then in Foafos, System, Pods, "This computer": it shows this browser\'s did:key.');
  say('Let it in with: foafos-stack lws-allow did:key:...');
  return 0;
}

/** Does the factoidal behind the command install a root ACL into an existing storage at start? Asked of
 *  its engine on a scratch storage in a temporary folder, in this process, with no socket. */
async function rootAclInstallSupported() {
  const tmp = mkdtempSync(join(tmpdir(), 'foafos-acl-probe-'));
  try {
    const { openLwsStorage } = await import(pathToFileURL(join(factoidalPkg(), 'lws/server.mjs')).href);
    const at = { baseIri: 'http://127.0.0.1:9/', dir: join(tmp, 'storage'), storage: 'files' };
    await (await openLwsStorage({ ...at, insecureNoAuth: true })).close();
    const s = await openLwsStorage({ ...at, rootAcl: '@prefix acl: <http://www.w3.org/ns/auth/acl#> .\n' });
    const said = (s.notices || []).some((n) => /^root ACL: /.test(n));
    await s.close();
    return said;
  } catch { return false; } finally { rmSync(tmp, { recursive: true, force: true }); }
}

/** Start the storage WITH authorization on a private port and the ACL as --root-acl: factoidal installs it
 *  before the first answer when the storage has none, and keeps one it has. Then read it back as the owner. */
async function installFirstAcl(acl, a) {
  const file = join(LWSK, 'root.acl.first');
  writeFileSync(file, acl, { mode: 0o600 });
  const child = spawn('factoidal', ['lws-serve', C.lwsDir, '--authz', K.authz, '--allow-http', '--root-acl', file, '--host', '127.0.0.1', '--port', '0', '--storage', 'files', '--no-cors'],
    { cwd: HOME, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  const origin = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), START_WAIT);
    child.stdout.on('data', (b) => { out += b; const m = /^(http:\/\/127\.0\.0\.1:\d+)$/m.exec(out); if (m) { clearTimeout(t); resolve(m[1]); } });
    child.stderr.on('data', (b) => { out += b; });
    child.on('exit', () => { clearTimeout(t); resolve(null); });
  });
  const stop = () => new Promise((r) => { if (child.exitCode !== null) return r(); child.on('exit', r); child.kill('SIGTERM'); });
  try {
    if (!origin) return { ok: false, why: `the storage did not open:\n${out.split('\n').filter((l) => l && !/EXPERIMENTAL/.test(l)).slice(-4).join('\n')}` };
    const installed = /root ACL: this storage had no root ACL/.test(out);
    let text = null;
    let status = null;
    try {
      const r = await withTimeout((await agentClient(a.owner, K.owner)).read(`${origin}/.acl`), PROBE_WAIT * 3);
      status = r?.status ?? 200;
      text = bodyText(r);
    } catch (e) { status = e?.detail?.status ?? e?.reason ?? e?.message; }
    if (text === acl) return { ok: true, how: installed ? 'an existing storage: its data is as it was, and it now has a root ACL (installed at start, with authorization on)' : 'it had this ACL already' };
    if (installed) return { ok: false, why: `the root ACL was installed, but the owner could not read it back (${status}): see docs/foafos-local-lws-auth-20261107.md` };
    return { ok: false, why: `this storage has a root ACL that foafos-stack did not write. It is left as it is.\nOptions: add the owner ${a.owner} to it with Control yourself, then copy it to ${short(K.acl)}; or point FOAFOS_LWS_DIR at a new storage. See docs/foafos-local-lws-auth-20261107.md.` };
  } finally { await stop(); rmSync(file, { force: true }); }
}

/** Only with --open-acl-window and a factoidal too old to install a root ACL at start: start the storage
 *  with NO authorization on a private port, write its first ACL, stop it. For that time any local program
 *  could read and write the storage. */
async function writeFirstAcl(acl) {
  const child = spawn('factoidal', ['lws-serve', C.lwsDir, '--insecure-no-auth', '--host', '127.0.0.1', '--port', '0', '--storage', 'files', '--no-cors'],
    { cwd: HOME, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  const origin = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), START_WAIT);
    child.stdout.on('data', (b) => { out += b; const m = /^(http:\/\/127\.0\.0\.1:\d+)$/m.exec(out); if (m) { clearTimeout(t); resolve(m[1]); } });
    child.stderr.on('data', (b) => { out += b; });
    child.on('exit', () => { clearTimeout(t); resolve(null); });
  });
  const stop = () => new Promise((r) => { if (child.exitCode !== null) return r(); child.on('exit', r); child.kill('SIGTERM'); });
  if (!origin) { await stop(); return { ok: false, why: `the storage did not open:\n${out.split('\n').filter((l) => l && !/EXPERIMENTAL/.test(l)).slice(-4).join('\n')}` }; }
  try {
    const url = `${origin}/.acl`;
    const now = await fetch(url, { signal: AbortSignal.timeout(PROBE_WAIT * 3) });
    const text = await now.text();
    if (now.status === 200) {
      if (text === acl) return { ok: true, how: 'it had this ACL already' };
      return { ok: false, why: `this storage has a root ACL that foafos-stack did not write. It is left as it is.\nOptions: add the owner ${readJson(K.agents).owner} to it with Control yourself, then copy it to ${short(K.acl)}; or point FOAFOS_LWS_DIR at a new storage. See docs/foafos-local-lws-auth-20261107.md.` };
    }
    if (now.status !== 404) return { ok: false, why: `reading its ACL gave HTTP ${now.status}: nothing was written` };
    const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'text/turtle', 'If-None-Match': '*' }, body: acl, signal: AbortSignal.timeout(PROBE_WAIT * 3) });
    if (put.status !== 201) return { ok: false, why: `writing its ACL gave HTTP ${put.status}: see docs/foafos-local-lws-auth-20261107.md` };
    return { ok: true, how: 'an existing storage: its data is as it was, and it now has a root ACL' };
  } finally { await stop(); }
}

/** Write the ACL for `next` through LWS as the owner, if the storage still holds what this tool last wrote. */
async function writeAcl(next) {
  if (C.lwsInsecure) { say(red('the storage runs with no authorization, so an ACL changes nothing: unset FOAFOS_LWS_INSECURE_NO_AUTH')); return false; }
  if (!setupDone()) { say(red('no owner yet: foafos-stack lws-setup')); return false; }
  const a = readJson(K.agents);
  const url = `${lwsBase()}.acl`;
  let client;
  let now;
  try {
    client = await agentClient(a.owner, K.owner);
    now = await withTimeout(client.read(url), PROBE_WAIT * 3);
  } catch (e) {
    say(red(`could not read the storage's ACL as its owner (${e?.detail?.status ? `HTTP ${e.detail.status}` : e?.reason || e?.message}): is lws running? foafos-stack status`));
    return false;
  }
  if (bodyText(now) !== readFileSync(K.acl, 'utf8')) {
    say(red(`the storage's ACL is not the one this tool last wrote (${short(K.acl)}): it was changed elsewhere, so it is left as it is`));
    return false;
  }
  const text = aclText(next);
  try { await withTimeout(client.update(url, { body: text, mediaType: 'text/turtle' }), PROBE_WAIT * 3); } catch (e) {
    say(red(`the storage did not take the new ACL (${e?.detail?.status ? `HTTP ${e.detail.status}` : e?.reason || e?.message})`));
    return false;
  }
  writeFileSync(K.acl, text, { mode: 0o600 });
  writeFileSync(K.agents, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  return true;
}

function didArg(args) {
  const did = args.find((x) => x.startsWith('did:'));
  if (!did || !DID_KEY.test(did)) { say(red('give a did:key, as the Pods window of Foafos shows it')); return null; }
  return did;
}

async function lwsAllow(args) {
  const did = didArg(args);
  if (!did) return 2;
  const i = args.indexOf('--label');
  const label = cleanLabel(i >= 0 ? args[i + 1] : 'a Foafos browser');
  const modes = args.includes('--read-only') ? MODES.r : MODES.rw;
  const a = readJson(K.agents);
  if (!a) { say(red('no owner yet: foafos-stack lws-setup')); return 1; }
  if ([a.owner, a.webdav].includes(did)) { say(red('that is one of this tool\'s own agents')); return 2; }
  const next = { ...a, agents: [...a.agents.filter((x) => x.did !== did), { did, label, modes }] };
  if (!(await writeAcl(next))) return 1;
  say(green(`${did} may now ${modes.join(' and ').toLowerCase()} the storage`));
  return 0;
}

async function lwsRevoke(args) {
  const did = didArg(args);
  if (!did) return 2;
  const a = readJson(K.agents);
  if (!a?.agents.some((x) => x.did === did)) { say(`${did} is not in the ACL`); return 0; }
  if (!(await writeAcl({ ...a, agents: a.agents.filter((x) => x.did !== did) }))) return 1;
  say(green(`${did} may no longer use the storage`));
  return 0;
}

function lwsAgents() {
  const a = readJson(K.agents);
  if (!a) { say('no owner yet: foafos-stack lws-setup'); return 1; }
  say(`owner   ${a.owner}  read, write, control`);
  say(`webdav  ${a.webdav}  read`);
  for (const x of a.agents) say(`agent   ${x.did}  ${x.modes.join(', ').toLowerCase()}  (${x.label})`);
  return 0;
}

const HELP = `foafos-stack: the local Foafos servers, with one command.

  foafos-stack start   [service...]   start xmpp, lws, sparql and shell, or those named
  foafos-stack stop    [service...]   stop everything, or those named
  foafos-stack restart [service...]
  foafos-stack status  [-v] [--json]  what is really running; exits 1 unless all healthy
  foafos-stack logs    [service...] [-n LINES] [--no-follow]
  foafos-stack chat [local|shared] [--as ACCOUNT] [--say TEXT] [--wait SECONDS]
                                      a plain text XMPP client, already set up
  foafos-stack backstage [local|shared] [--as ACCOUNT] [--room NAME] [--wait SECONDS] [--watch] [--json]
                                      the bots: who is in the room, what each did; read only
  foafos-stack backstage help         what Backstage shows, and what it cannot see
  foafos-stack lws-setup [--open-acl-window]
                                      once: the storage's owner key, its ACL, the Finder key and login
  foafos-stack lws-allow DID [--read-only] [--label TEXT]
                                      let a did:key agent (a browser's) use the storage
  foafos-stack lws-revoke DID         take that away again
  foafos-stack lws-agents             who the storage's ACL lets in (names only, no keys)
  foafos-stack doctor                 check what the servers need
  foafos-stack urls                   the addresses
  foafos-stack open                   open Foafos in your browser (macOS)

Services: ${NAMES.join(' ')}. Those marked optional start only when named.
Guide: docs/foafos-local-setup-20261104.md`;

// ── the command ─────────────────────────────────────────────────────────

function services(given, fallback) {
  const args = given.filter((a) => a !== 'proto');   // the old word for the tunnels, which are gone
  const bad = args.filter((a) => !SERVICES[a]);
  if (bad.length) { say(red(`unknown service: ${bad.join(' ')} (have: ${NAMES.join(' ')})`)); process.exit(2); }
  return args.length ? args : fallback;
}
const order = (list) => NAMES.filter((n) => list.includes(n));

async function main([cmd = 'status', ...args]) {
  if (['help', '-h', '--help'].includes(cmd)) { say(HELP); return 0; }
  if (cmd === 'urls') { urls(); return 0; }
  if (cmd === 'backstage') { mkdirSync(LOGS, { recursive: true, mode: 0o700 }); mkdirSync(RUN, { recursive: true, mode: 0o700 }); return backstage(args); }
  if (!run('which', ['lsof'])) { say(red('this tool needs lsof to see what is listening')); return 1; }
  mkdirSync(STATE, { recursive: true, mode: 0o700 });
  mkdirSync(LOGS, { recursive: true, mode: 0o700 });
  mkdirSync(RUN, { recursive: true, mode: 0o700 });
  chmodSync(STATE, 0o700);
  const stopAll = async (list) => {
    let ok = true;
    for (const n of order(list).reverse()) ok = (await stopOne(n)) && ok;
    return ok;
  };
  const startAll = async (list) => {
    let ok = true;
    for (const n of order(list)) ok = (await startOne(n)) && ok;
    return ok;
  };
  const running = (n) => !!processOf(n, record(n));
  switch (cmd) {
    case 'start': {
      const ok = await startAll(services(args, DEFAULTS));
      if (!args.length) { say(); await status({}); }
      return ok ? 0 : 1;
    }
    case 'stop': {
      // With no names, stop everything this tool started, the bot too.
      const list = services(args, NAMES);
      if (args.includes('xmpp') && !args.includes('foafbot') && running('foafbot')) { say('foafbot needs xmpp, so it stops too'); list.push('foafbot'); }
      return (await stopAll(list)) ? 0 : 1;
    }
    case 'restart': {
      const list = [...services(args, NAMES.filter((n) => SERVICES[n].always || running(n)))];
      if (list.includes('xmpp') && !list.includes('foafbot') && running('foafbot')) { say('foafbot needs xmpp, so it restarts too'); list.push('foafbot'); }
      const stopped = await stopAll(list);
      return (await startAll(list)) && stopped ? 0 : 1;
    }
    case 'status': return status({ verbose: args.includes('-v'), json: args.includes('--json') });
    case 'logs': return logs(args);
    case 'chat': return spawnSync('python3', [join(HERE, 'xmpp-chat.py'), ...args], { stdio: 'inherit' }).status ?? 1;
    case 'doctor': return doctor();
    case 'lws-setup': return lwsSetup(args);
    case 'lws-allow': return lwsAllow(args);
    case 'lws-revoke': return lwsRevoke(args);
    case 'lws-agents': return lwsAgents();
    case 'open': spawnSync('open', [`${SHELL_ORIGIN}${SHELL_PAGE}?root=all`]); return 0;
    default: say(red(`unknown command: ${cmd}`)); say(HELP); return 2;
  }
}

// Not process.exit: that can cut off long output sent down a pipe. The servers are unref'd, so nothing keeps this alive.
process.exitCode = await main(process.argv.slice(2));
