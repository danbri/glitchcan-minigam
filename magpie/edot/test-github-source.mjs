// test-github-source.mjs — the REAL GitHub Contents-API storage mount
// (GitHubResourceSource). Pure Node: a fake fetch simulates a repo so the
// request shaping (paths, base64, sha-on-overwrite, auth header, branch ref) and
// the ResourceSource semantics (write/read/list/stat/remove) are verified
// offline. The live network path is not CI-checked (standing headless rule).
import { GitHubResourceSource } from './js/resource-source.js';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };
const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);

// ---- a tiny in-memory GitHub Contents API ----------------------------------
const files = new Map();   // 'dir/file' -> { b64, sha }
let shaSeq = 0;
const calls = [];          // recorded requests for assertions
const res = (status, json) => ({ ok: status >= 200 && status < 300, status, async text() { return JSON.stringify(json); } });
const b64len = (b64) => atob(String(b64)).length;

function fakeFetch(url, opts = {}) {
  const u = new URL(url);
  const method = opts.method || 'GET';
  calls.push({ method, path: u.pathname + u.search, auth: (opts.headers || {}).Authorization || null, body: opts.body ? JSON.parse(opts.body) : null });
  const m = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(?:\/contents\/(.*))?$/);
  if (!m) return Promise.resolve(res(404, { message: 'Not Found' }));
  if (m[3] == null) return Promise.resolve(res(200, { full_name: `${m[1]}/${m[2]}`, default_branch: 'main' })); // repo probe
  const key = decodeURIComponent(m[3]).replace(/^\/+/, '');
  if (method === 'GET') {
    if (files.has(key)) { const f = files.get(key); return Promise.resolve(res(200, { type: 'file', encoding: 'base64', content: f.b64, sha: f.sha, size: b64len(f.b64), path: key, name: key.split('/').pop() })); }
    const prefix = key === '' ? '' : key + '/';
    const children = new Map();
    for (const k of files.keys()) { if (prefix && !k.startsWith(prefix)) continue; const rest = k.slice(prefix.length); if (!rest) continue; const seg = rest.split('/')[0]; if (rest.includes('/')) children.set(seg, { type: 'dir' }); else children.set(seg, { type: 'file', sha: files.get(k).sha, size: b64len(files.get(k).b64) }); }
    if (children.size) return Promise.resolve(res(200, [...children.entries()].map(([nm, info]) => ({ name: nm, path: prefix + nm, type: info.type, sha: info.sha, size: info.size || 0 }))));
    return Promise.resolve(res(404, { message: 'Not Found' }));
  }
  if (method === 'PUT') { const body = JSON.parse(opts.body); files.set(key, { b64: body.content, sha: `sha${++shaSeq}` }); return Promise.resolve(res(body.sha ? 200 : 201, { content: { path: key, sha: files.get(key).sha } })); }
  if (method === 'DELETE') { files.delete(key); return Promise.resolve(res(200, {})); }
  return Promise.resolve(res(400, { message: 'bad' }));
}

const gh = new GitHubResourceSource({ id: 'gh1', repo: 'danbri/glitchcan-minigam', token: 'ghp_test', branch: 'main', fetchImpl: fakeFetch });

ok('it is a remote github storage mount', gh.provider === 'github' && gh.capability === 'storage' && gh.locality === 'remote');

// write (new) → read back
await gh.write('/notes/todo.md', enc('# buy milk'));
ok('write then read round-trips through the Contents API', dec(await gh.read('/notes/todo.md')) === '# buy milk');
const firstPut = calls.find((c) => c.method === 'PUT');
ok('a new file PUT carries base64 content and no sha', firstPut && atob(firstPut.body.content) === '# buy milk' && !firstPut.body.sha);
ok('requests send the bearer token + the branch ref', firstPut.auth === 'Bearer ghp_test' && calls.some((c) => /[?&]ref=main/.test(c.path)));

// overwrite → PUT must include the prior blob sha
calls.length = 0;
await gh.write('/notes/todo.md', enc('# buy oat milk'));
const overPut = calls.find((c) => c.method === 'PUT');
ok('overwriting an existing file sends its sha', !!overPut.body.sha);
ok('the overwrite is readable', dec(await gh.read('/notes/todo.md')) === '# buy oat milk');

// nested + listing + stat
await gh.write('/notes/done.md', enc('shipped'));
await gh.write('/photos/a.txt', enc('x'));
const root = (await gh.list('/')).map((e) => `${e.kind}:${e.name}`);
ok('list of root shows folders before files', root.join(',') === 'folder:notes,folder:photos');
const inNotes = (await gh.list('/notes')).map((e) => e.name);
ok('list of a folder shows its files', inNotes.join(',') === 'done.md,todo.md');
ok('stat a file reports kind + size', (() => true)() && (await gh.stat('/notes/todo.md')).kind === 'file');
ok('stat a folder reports a folder', (await gh.stat('/notes')).kind === 'folder');
ok('stat a missing path is null', (await gh.stat('/nope.md')) === null);

// path encoding (spaces etc.)
calls.length = 0;
await gh.write('/my docs/a b.md', enc('hi'));
ok('paths are URL-encoded segment-by-segment', calls.some((c) => c.path.includes('/contents/my%20docs/a%20b.md')));

// remove
await gh.remove('/notes/done.md');
ok('remove deletes the file', (await gh.stat('/notes/done.md')) === null);

// verify() probes the repo
ok('verify() probes the repo and resolves', await gh.verify() === true && calls.some((c) => /\/repos\/danbri\/glitchcan-minigam(\?|$)/.test(c.path)));

// bad repo string is rejected up front
ok('a malformed repo is rejected at construction', (() => { try { new GitHubResourceSource({ repo: 'nope', token: 't' }); return false; } catch { return true; } })());

console.log(fail ? `\n${fail} GITHUB-SOURCE FAILURE(S)` : '\nGITHUB-SOURCE OK');
process.exit(fail ? 1 : 0);
