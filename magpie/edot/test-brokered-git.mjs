// test-brokered-git.mjs — the repo mount that never holds a token.
//
// The interesting assertion is a NEGATIVE one, so it is the one this file
// works hardest at: BrokeredGitSource must have no path to a credential, no
// way to name the repo, and no way to talk to api.github.com itself. What it
// has is `foaf.invoke`, and the whole point is that everything about where
// the commit goes lives on the other side of that call.
//
// Pure Node: a stub `foaf` stands in for the shell (which the real e2e-caps
// leg exercises for real, inside a sandboxed frame). No network, by design.
import { BrokeredGitSource } from './js/resource-source.js';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };
const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

// A stub shell. Note what it does NOT offer: any way to read a secret.
const stubFoaf = ({ caps = ['storage', 'git:write'], reply = () => ({ ok: true, status: 201, url: 'https://github.com/x' }) } = {}) => {
  const invoked = [];
  return {
    invoked,
    can: (c) => caps.includes(c),
    verbs: async () => [{ verb: 'git.commit', capability: 'git:write', secret: 'git.token' }],
    invoke: async (verb, detail) => { invoked.push({ verb, detail }); return reply(verb, detail); },
  };
};

// ---- it is a remote mount that publishes ------------------------------------
const foaf = stubFoaf();
const src = new BrokeredGitSource({ storage: memStorage(), foaf });
ok('it presents as a remote github mount', src.provider === 'github' && src.locality === 'remote');
ok('it says out loud that it holds no token', /never sees a token/.test(src.note));
ok('canPublish reflects the capability, not a config flag', src.canPublish === true);

const r = await src.write('/notes/todo.md', enc('# buy milk'));
ok('a write publishes via the git.commit verb', foaf.invoked.length === 1 && foaf.invoked[0].verb === 'git.commit');
ok('it sends a RELATIVE path and text — no repo, no owner, no branch, no host',
  (() => {
    const d = foaf.invoked[0].detail;
    return d.path === 'notes/todo.md' && d.content === '# buy milk'
      && !('repo' in d) && !('owner' in d) && !('branch' in d)
      && !JSON.stringify(d).includes('github.com');
  })());
ok('the publish result is reported, not swallowed', r.ok === true && r.status === 201 && src.lastPublish.ok === true);

// ---- the local mirror is not conditional on the network ---------------------
ok('the bytes are readable locally straight away', dec(await src.read('/notes/todo.md')) === '# buy milk');

const failing = stubFoaf({ reply: () => ({ ok: false, reason: 'http', status: 403 }) });
const src2 = new BrokeredGitSource({ storage: memStorage(), foaf: failing });
const r2 = await src2.write('/a.md', enc('draft'));
ok('a refused publish still keeps the edit locally', dec(await src2.read('/a.md')) === 'draft');
ok('…and reports the status so a UI can say "saved, not published"', r2.ok === false && r2.status === 403);

// ---- no capability, no publish ---------------------------------------------
const src3 = new BrokeredGitSource({ storage: memStorage(), foaf: stubFoaf({ caps: ['storage'] }) });
ok('without git:write it does not even try', src3.canPublish === false);
const r3 = await src3.write('/a.md', enc('x'));
ok('…and says why rather than looking successful', r3.ok === false && r3.reason === 'no-capability');
ok('the local write still happened', dec(await src3.read('/a.md')) === 'x');

const src4 = new BrokeredGitSource({ storage: memStorage(), foaf: null });
ok('standalone (no shell at all) is a refusal, not a crash', src4.canPublish === false);

// ---- honest about what it cannot do ----------------------------------------
const src5 = new BrokeredGitSource({ storage: memStorage(), foaf: stubFoaf() });
await src5.write('/gone.md', enc('bye'));
const rm = src5.remove('/gone.md');
ok('remove is local-only and SAYS so — there is no git.delete verb',
  rm.reason === 'delete-not-brokered');

const bin = new BrokeredGitSource({ storage: memStorage(), foaf: stubFoaf() });
const rb = await bin.write('/img.png', new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x80]));
ok('binary is refused rather than mangled into invalid UTF-8',
  rb.ok === false && rb.reason === 'binary-unsupported');
ok('…and the local copy is still byte-exact',
  (await bin.read('/img.png'))[4] === 0x80);

// ---- the negative claim, checked against the source -------------------------
const source = await (await import('node:fs/promises')).readFile(
  new URL('./js/resource-source.js', import.meta.url), 'utf8');
const cls = source.slice(source.indexOf('export class BrokeredGitSource'),
                         source.indexOf('// A user-chosen LOCAL FOLDER'));
ok('the class never mentions api.github.com', !cls.includes('api.github.com'));
ok('the class never reads a token, secret or Authorization header',
  !/token|secret|Authorization/i.test(cls.replace(/never sees a token|holds none|same credential|no token/gi, '')));

console.log(fail ? `\n${fail} check(s) failed` : '\nAll checks passed');
process.exit(fail ? 1 : 0);
