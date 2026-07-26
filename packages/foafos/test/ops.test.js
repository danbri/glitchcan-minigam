// What is under test is mostly a set of REFUSALS, and the load-bearing one
// is "the app cannot choose where the request goes". So a good half of this
// file is attempts to aim a brokered credential somewhere it was not
// granted — that is the attack these ops exist to make impossible, and an
// op suite that only proves the happy path proves nothing worth knowing.
//
// Every fetch is injected. There is no network here (by design: this
// environment has none), which is also why the results assert on what was
// SENT rather than on what a real GitHub would say.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FoafSecrets, SECRETS_CAP } from '../src/secrets.mjs';
import {
  FoafOps, defaultOps, gitCommitOp, s3PutOp, solidPutOp, cleanPath, withinPrefix,
} from '../src/ops.mjs';

const TOKEN = 'ghp_THIS_MUST_NEVER_APPEAR_ANYWHERE_9f3c';

const spyFetch = (responder) => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    return responder(String(url), init, calls.length);
  };
  return { fetch, calls };
};
const json = (status, obj) => ({ status, ok: status < 300, json: async () => obj, text: async () => JSON.stringify(obj) });
const busSpy = () => { const seen = []; return { seen, publish: (topic, data) => seen.push({ topic, data }) }; };

const rig = ({ responder = () => json(201, {}), scopes, bus = busSpy(), secret = 'git.token' } = {}) => {
  const secrets = new FoafSecrets({ bus });
  secrets.grant('edot', [SECRETS_CAP]);
  secrets.put('edot', secret, TOKEN);
  const { fetch, calls } = spyFetch(responder);
  const ops = defaultOps({ secrets, bus, fetchImpl: fetch });
  if (scopes) ops.grant('edot', scopes);
  return { ops, secrets, bus, calls };
};

const GIT_SCOPE = { 'git:write': { repo: 'danbri/notes', branch: 'main', pathPrefix: 'edot/' } };

// ── path handling: the guard, not a helper ─────────────────────────────

test('cleanPath refuses traversal outright rather than resolving it', () => {
  assert.equal(cleanPath('a/../../etc/passwd'), null);
  assert.equal(cleanPath('..'), null);
  assert.equal(cleanPath('a/./b//c'), 'a/b/c');
  assert.equal(cleanPath('/leading/slash'), 'leading/slash');
  assert.equal(cleanPath(''), null);
  assert.equal(cleanPath(null), null);
});

test('withinPrefix is a boundary, not a string startsWith', () => {
  assert.equal(withinPrefix('edot/a', 'edot'), true);
  assert.equal(withinPrefix('edot', 'edot'), true);
  assert.equal(withinPrefix('edotsecrets/a', 'edot'), false, 'a sibling that shares a prefix is not inside it');
  assert.equal(withinPrefix('anything', ''), true, 'no prefix means the whole scope');
});

// ── the capability + scope gate ────────────────────────────────────────

test('an app with no grant is refused, in the open, before any fetch', async () => {
  const { ops, bus, calls } = rig({});
  const r = await ops.invoke('edot', 'git.commit', { path: 'edot/a.md', content: 'hi' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'denied');
  assert.equal(r.capability, 'git:write');
  assert.equal(calls.length, 0, 'nothing was sent');
  assert.ok(bus.seen.some((e) => e.topic === 'ops.refused'));
});

test('an unknown verb is a named refusal, not a crash', async () => {
  const { ops } = rig({ scopes: GIT_SCOPE });
  assert.equal((await ops.invoke('edot', 'rm.rf', {})).reason, 'unknown-verb');
});

test('a grant missing a required scope key fails loudly', async () => {
  const secrets = new FoafSecrets();
  secrets.grant('edot', [SECRETS_CAP]);
  const ops = defaultOps({ secrets, fetchImpl: async () => json(201, {}) });
  // repo is validated at grant time — a typo in a manifest should not wait
  // for someone to press Save before it is noticed.
  assert.throws(() => ops.grant('edot', { 'git:write': { repo: 'not-a-repo' } }), /owner\/name/);
  assert.throws(() => ops.grant('edot', { 'solid:write': { base: 'http://pod.example/x/' } }), /must be https/);
});

// ── THE RULE: the scope supplies the destination ────────────────────────

test('an app cannot redirect a commit to another repo', async () => {
  const { ops, calls } = rig({ responder: () => json(404, {}), scopes: GIT_SCOPE });
  await ops.invoke('edot', 'git.commit', {
    path: 'edot/a.md', content: 'hi',
    repo: 'attacker/loot', owner: 'attacker', branch: 'gh-pages',   // all ignored
  });
  assert.ok(calls.every((c) => c.url.startsWith('https://api.github.com/repos/danbri/notes/')),
    `every request went to the granted repo; saw ${calls.map((c) => c.url).join(', ')}`);
  const put = calls.find((c) => c.method === 'PUT');
  assert.equal(JSON.parse(put.body).branch, 'main', 'the branch came from the grant, not the caller');
});

test('an app cannot escape its path prefix, by traversal or otherwise', async () => {
  const { ops, calls } = rig({ scopes: GIT_SCOPE });
  const a = await ops.invoke('edot', 'git.commit', { path: '.github/workflows/evil.yml', content: 'x' });
  assert.equal(a.reason, 'bad-params');
  const b = await ops.invoke('edot', 'git.commit', { path: 'edot/../.github/x.yml', content: 'x' });
  assert.equal(b.reason, 'bad-params');
  assert.equal(calls.length, 0, 'a rejected path never reaches the network');
});

test('the host is not configurable — s3 and solid stay inside their grant', async () => {
  const secrets = new FoafSecrets();
  secrets.grant('edot', [SECRETS_CAP]);
  secrets.put('edot', 's3.secretAccessKey', TOKEN);
  secrets.put('edot', 'solid.token', TOKEN);
  const { fetch, calls } = spyFetch(() => json(200, {}));
  const ops = defaultOps({ secrets, fetchImpl: fetch });
  ops.grant('edot', {
    's3:write': { bucket: 'my-bucket', region: 'eu-west-2', accessKeyId: 'AKID', keyPrefix: 'edot/' },
    'solid:write': { base: 'https://pod.example/edot/' },
  });
  await ops.invoke('edot', 's3.put', { key: 'edot/a.txt', content: 'hi', endpoint: 'https://evil.example' });
  await ops.invoke('edot', 'solid.put', { path: 'a.txt', content: 'hi', base: 'https://evil.example/' });
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /^https:\/\/s3\.eu-west-2\.amazonaws\.com\/my-bucket\/edot\/a\.txt$/);
  assert.match(calls[1].url, /^https:\/\/pod\.example\/edot\/a\.txt$/);
  assert.ok(!calls.some((c) => c.url.includes('evil')), 'no app-supplied host reached fetch');
});

// ── the credential ─────────────────────────────────────────────────────

test('the token reaches the request and nothing else', async () => {
  const { ops, bus, calls } = rig({ responder: (url, init) => json(init.method === 'GET' ? 404 : 201, { content: { sha: 'abc' }, commit: { sha: 'def' } }), scopes: GIT_SCOPE });
  const r = await ops.invoke('edot', 'git.commit', { path: 'edot/a.md', content: 'hello', message: 'test' });
  assert.equal(r.ok, true);
  assert.equal(r.sha, 'abc');
  // it IS in the Authorization header — that is the point of the exercise
  assert.ok(calls.some((c) => String(c.headers.Authorization).includes(TOKEN)));
  // and nowhere the app or a log can see
  assert.ok(!JSON.stringify(r).includes(TOKEN), 'the result the app gets is clean');
  assert.ok(!JSON.stringify(bus.seen).includes(TOKEN), 'the bus is clean');
  assert.ok(!JSON.stringify(ops.audit).includes(TOKEN), 'the audit is clean');
});

test('no secret stored means a named answer telling the app what to ask for', async () => {
  const secrets = new FoafSecrets();
  secrets.grant('edot', [SECRETS_CAP]);              // capable, but empty
  const ops = defaultOps({ secrets, fetchImpl: async () => json(201, {}) });
  ops.grant('edot', GIT_SCOPE);
  const r = await ops.invoke('edot', 'git.commit', { path: 'edot/a.md', content: 'x' });
  assert.equal(r.reason, 'no-secret');
  assert.equal(r.secret, 'git.token', 'so the app knows which name to put');
});

test('an app that may keep secrets but has no verb grant still cannot act', async () => {
  const { ops } = rig({});                            // secret present, no ops grant
  assert.equal((await ops.invoke('edot', 'git.commit', { path: 'a', content: 'x' })).reason, 'denied');
});

// ── failure reporting ──────────────────────────────────────────────────

test('an HTTP failure reports a status and never a message', async () => {
  const { ops, bus } = rig({
    responder: (url, init) => (init.method === 'GET' ? json(404, {}) : json(403, { message: `Bad credentials ${TOKEN}` })),
    scopes: GIT_SCOPE,
  });
  const r = await ops.invoke('edot', 'git.commit', { path: 'edot/a.md', content: 'x' });
  assert.equal(r.ok, false);
  assert.equal(r.status, 403);
  assert.equal(r.reason, 'http');
  assert.ok(!JSON.stringify(r).includes(TOKEN));
  assert.ok(!JSON.stringify(bus.seen).includes(TOKEN),
    "GitHub's own 403 body quotes the token — so no body is passed through");
});

test('a thrown fetch reports its type only, since the message carries the URL', async () => {
  const { ops } = rig({
    responder: () => { throw new TypeError(`fetch failed for https://api.github.com/x?token=${TOKEN}`); },
    scopes: GIT_SCOPE,
  });
  const r = await ops.invoke('edot', 'git.commit', { path: 'edot/a.md', content: 'x' });
  assert.equal(r.reason, 'failed');
  assert.equal(r.error, 'TypeError');
  assert.ok(!JSON.stringify(r).includes(TOKEN));
});

// ── shape of the thing ─────────────────────────────────────────────────

test('an existing file is updated: the sha is looked up, not demanded of the app', async () => {
  const { ops, calls } = rig({
    responder: (url, init) => (init.method === 'GET'
      ? json(200, { sha: 'existing-sha' })
      : json(200, { content: { sha: 'new-sha' }, commit: { sha: 'c1' } })),
    scopes: GIT_SCOPE,
  });
  await ops.invoke('edot', 'git.commit', { path: 'edot/a.md', content: 'x' });
  assert.equal(JSON.parse(calls[1].body).sha, 'existing-sha');
});

test('content is base64 for the Contents API, and UTF-8 safe', async () => {
  const { ops, calls } = rig({ responder: (u, i) => json(i.method === 'GET' ? 404 : 201, {}), scopes: GIT_SCOPE });
  await ops.invoke('edot', 'git.commit', { path: 'edot/a.md', content: 'héllo — ünicode' });
  const sent = JSON.parse(calls[1].body).content;
  assert.equal(Buffer.from(sent, 'base64').toString('utf8'), 'héllo — ünicode');
});

test('a runaway app is throttled, and the throttle is not a silent drop', async () => {
  let t = 0;
  const secrets = new FoafSecrets();
  secrets.grant('edot', [SECRETS_CAP]);
  secrets.put('edot', 'git.token', TOKEN);
  const bus = busSpy();
  const { fetch, calls } = spyFetch((u, i) => json(i.method === 'GET' ? 404 : 201, {}));
  const ops = defaultOps({ secrets, bus, fetchImpl: fetch, now: () => t });
  ops.grant('edot', GIT_SCOPE);
  let refusals = 0;
  for (let i = 0; i < 20; i++) {
    const r = await ops.invoke('edot', 'git.commit', { path: `edot/${i}.md`, content: 'x' });
    if (r.reason === 'throttled') refusals++;
  }
  assert.equal(refusals, 8, 'gitCommitOp allows 12 a minute');
  assert.ok(bus.seen.some((e) => e.data?.reason === 'throttled'));
  t += 61_000;                                    // a minute later it is fine again
  assert.notEqual((await ops.invoke('edot', 'git.commit', { path: 'edot/z.md', content: 'x' })).reason, 'throttled');
  assert.equal(calls.filter((c) => c.method === 'PUT').length, 13);
});

test('list() says which verbs exist, who holds them and where they point', async () => {
  const { ops } = rig({ scopes: GIT_SCOPE });
  const git = ops.list().find((o) => o.verb === 'git.commit');
  assert.equal(git.capability, 'git:write');
  assert.equal(git.secret, 'git.token');
  assert.deepEqual(git.holders.map((h) => h.appId), ['edot']);
  assert.equal(git.holders[0].scope.repo, 'danbri/notes');
  assert.deepEqual(ops.list().map((o) => o.verb).sort(), ['git.commit', 's3.put', 'solid.put']);
});

test('every default op declares a capability and a secret, and none is generic', () => {
  for (const op of [gitCommitOp, s3PutOp, solidPutOp]) {
    assert.ok(op.capability.endsWith(':write'), `${op.verb} names a write capability`);
    assert.ok(op.secret.includes('.'), `${op.verb} names its own secret`);
    assert.equal(typeof op.run, 'function');
  }
  // No op takes a function or a URL from its caller. The registry itself is
  // the enforcement point: `run` is only ever reached via a registered verb.
  assert.throws(() => new FoafOps({ secrets: new FoafSecrets() }).register({ verb: 'x' }),
    /verb, capability, secret and run/);
});

test('ops without a FoafSecrets refuses to exist', () => {
  assert.throws(() => new FoafOps({}), /FoafSecrets is required/);
});
