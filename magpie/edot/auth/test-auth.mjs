// test-auth.mjs — headless test of the edot OIDC auth module. Same style as
// data/test-data.mjs: a tiny http.server rooted at the repo, a real Chromium,
// the ✅/❌ ok() pattern, non-zero exit on failure. Every IdP interaction
// (discovery / token / userinfo) is MOCKED via an injected fetch — we never
// touch a real provider.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
    const buf = await readFile(path.join(ROOT, rel));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/auth/login.html`);
  await page.waitForFunction(() => window.__auth && window.__auth.ready === true, null, { timeout: 20000 });
  ok('login.html boots + exposes window.__auth', await page.evaluate(() => !!window.__auth && !!window.__auth.session));

  // 1. PKCE — known RFC 7636 Appendix B test vector.
  const pkce = await page.evaluate(async () => {
    const m = await import('./js/pkce.js');
    // RFC 7636 B: verifier "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    //  => challenge "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await m.generateCodeChallenge(verifier);
    const v2 = m.generateCodeVerifier();
    const valid = /^[A-Za-z0-9\-._~]+$/.test(v2) && v2.length >= 43 && v2.length <= 128;
    return { challenge, valid, vlen: v2.length };
  });
  ok('PKCE S256 matches RFC 7636 vector', pkce.challenge === 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  ok('code_verifier charset + length valid (43..128)', pkce.valid);

  // 2. buildAuthorizeUrl includes all required params.
  const authUrl = await page.evaluate(async () => {
    const { OidcClient } = await import('./js/oidc.js');
    const { getProvider } = await import('./js/providers.js');
    const c = new OidcClient(getProvider('google'));
    const u = c.buildAuthorizeUrl({
      clientId: 'CLIENT123', redirectUri: 'https://app.test/cb',
      scopes: ['openid', 'email', 'profile'],
      state: 'ST', nonce: 'NO', codeChallenge: 'CH',
    });
    return u;
  });
  const au = new URL(authUrl);
  ok('authorize url: response_type=code', au.searchParams.get('response_type') === 'code');
  ok('authorize url: client_id present', au.searchParams.get('client_id') === 'CLIENT123');
  ok('authorize url: redirect_uri present', au.searchParams.get('redirect_uri') === 'https://app.test/cb');
  ok('authorize url: scope includes openid', /(^|\s)openid(\s|$)/.test(au.searchParams.get('scope')));
  ok('authorize url: state present', au.searchParams.get('state') === 'ST');
  ok('authorize url: nonce present', au.searchParams.get('nonce') === 'NO');
  ok('authorize url: code_challenge present', au.searchParams.get('code_challenge') === 'CH');
  ok('authorize url: code_challenge_method=S256', au.searchParams.get('code_challenge_method') === 'S256');

  // 3. OIDC discovery populates endpoints from .well-known.
  const disc = await page.evaluate(async () => {
    const { OidcClient } = await import('./js/oidc.js');
    const provider = { id: 'generic', issuer: 'https://idp.test', scopes: ['openid'] };
    const mockFetch = async (url) => {
      if (String(url).endsWith('/.well-known/openid-configuration')) {
        return new Response(JSON.stringify({
          issuer: 'https://idp.test',
          authorization_endpoint: 'https://idp.test/authorize',
          token_endpoint: 'https://idp.test/token',
          userinfo_endpoint: 'https://idp.test/userinfo',
          jwks_uri: 'https://idp.test/jwks',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}', { status: 404 });
    };
    const c = new OidcClient(provider, { fetchImpl: mockFetch });
    const eps = await c.endpoints();
    return eps;
  });
  ok('discovery populates authorize endpoint', disc.authorize === 'https://idp.test/authorize');
  ok('discovery populates token endpoint', disc.token === 'https://idp.test/token');
  ok('discovery populates jwks endpoint', disc.jwks === 'https://idp.test/jwks');

  // 4. Token exchange + decodeIdToken validates nonce/aud and extracts claims;
  //    an invalid nonce is rejected.
  const tok = await page.evaluate(async () => {
    const { OidcClient } = await import('./js/oidc.js');
    const { base64urlEncode } = await import('./js/pkce.js');
    // Build an unsigned-but-well-formed JWT with our claims.
    const enc = (obj) => base64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));
    const header = enc({ alg: 'RS256', typ: 'JWT', kid: 'k1' });
    const payload = enc({
      iss: 'https://idp.test', aud: 'CLIENT123', sub: 'user-1', nonce: 'NONCE-OK',
      email: 'ada@idp.test', name: 'Ada Lovelace', exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const idToken = `${header}.${payload}.SIGNATURE`;

    const provider = {
      id: 'generic', issuer: 'https://idp.test',
      authorize: 'https://idp.test/authorize', token: 'https://idp.test/token',
      scopes: ['openid'],
    };
    const mockFetch = async (url, opts) => {
      if (String(url).endsWith('/token') && opts && opts.method === 'POST') {
        // confirm the verifier + grant_type made it into the body
        const body = new URLSearchParams(opts.body);
        if (body.get('grant_type') !== 'authorization_code' || !body.get('code_verifier')) {
          return new Response('{"error":"invalid_request"}', { status: 400 });
        }
        return new Response(JSON.stringify({
          access_token: 'AT', id_token: idToken, token_type: 'Bearer', expires_in: 3600,
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}', { status: 404 });
    };
    const c = new OidcClient(provider, { fetchImpl: mockFetch });
    const tokens = await c.exchangeCode({
      code: 'CODE', codeVerifier: 'VERIFIER', redirectUri: 'https://app.test/cb', clientId: 'CLIENT123',
    });
    // valid decode
    const good = c.decodeIdToken(tokens.id_token, { nonce: 'NONCE-OK', clientId: 'CLIENT123', issuer: 'https://idp.test' });
    // invalid nonce should throw
    let nonceRejected = false;
    try { c.decodeIdToken(tokens.id_token, { nonce: 'WRONG', clientId: 'CLIENT123' }); }
    catch { nonceRejected = true; }
    // wrong aud should throw
    let audRejected = false;
    try { c.decodeIdToken(tokens.id_token, { clientId: 'OTHER' }); }
    catch { audRejected = true; }
    return { gotIdToken: !!tokens.id_token, name: good.payload.name, email: good.payload.email, nonceRejected, audRejected };
  });
  ok('token exchange returns an id_token', tok.gotIdToken);
  ok('decodeIdToken extracts claims (name/email)', tok.name === 'Ada Lovelace' && tok.email === 'ada@idp.test');
  ok('decodeIdToken rejects an invalid nonce', tok.nonceRejected);
  ok('decodeIdToken rejects a wrong aud', tok.audRejected);

  // 5. Callback with a mismatched state is rejected.
  const cb = await page.evaluate(async () => {
    const { OidcClient } = await import('./js/oidc.js');
    const provider = { id: 'generic', authorize: 'https://idp.test/authorize', token: 'https://idp.test/token', scopes: ['openid'] };
    // memory txn store: only "GOODSTATE" exists.
    const mem = new Map();
    const txnStore = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
    const c = new OidcClient(provider, { fetchImpl: async () => new Response('{}', { status: 200 }), txnStore });
    c.saveTransaction('GOODSTATE', { providerId: 'generic', codeVerifier: 'V', redirectUri: 'https://app.test/cb', clientId: 'C', nonce: 'N' });
    let rejected = false;
    try { await c.handleRedirectCallback('https://app.test/cb?code=X&state=BADSTATE'); }
    catch { rejected = true; }
    return { rejected };
  });
  ok('handleRedirectCallback rejects mismatched state (CSRF)', cb.rejected);

  // 6. Multi-account session: two identities coexist, switch, signOut removes one.
  const multi = await page.evaluate(async () => {
    const { AuthSession } = await import('./js/session.js');
    const s = new AuthSession({ storageKey: 'edot.auth.test.accounts' });
    s.signOutAll(); // clean slate
    const a1 = s.upsertAccount({ providerId: 'google', providerName: 'Google', claims: { sub: 'u1', name: 'Ada', email: 'ada@g.test', exp: Math.floor(Date.now() / 1000) + 3600 }, tokens: { access_token: 'A1', id_token: 't1', expires_in: 3600 } });
    const a2 = s.upsertAccount({ providerId: 'microsoft', providerName: 'Microsoft', claims: { sub: 'u2', name: 'Bo', email: 'bo@ms.test' }, tokens: { access_token: 'A2', id_token: 't2' } });
    const both = s.list().length;
    const activeIsBo = s.active().key === a2.key;       // last added is active
    const switched = s.setActive(a1.key) && s.active().name === 'Ada';
    const removed = s.signOut(a2.key);
    const left = s.list().length;
    s.close();
    return { both, activeIsBo, switched, removed, left, a1: a1.key, a2: a2.key };
  });
  ok('two identities coexist', multi.both === 2);
  ok('newly added account becomes active', multi.activeIsBo);
  ok('account switcher changes the active identity', multi.switched);
  ok('signOut removes exactly one account', multi.removed && multi.left === 1);

  // 7. Session persistence round-trips, and BroadcastChannel notifies a peer.
  const persist = await page.evaluate(async () => {
    const { AuthSession } = await import('./js/session.js');
    const key = 'edot.auth.test.persist';
    let s1 = new AuthSession({ storageKey: key });
    s1.signOutAll();
    s1.setPersistent(true); // -> localStorage
    s1.upsertAccount({ providerId: 'google', providerName: 'Google', claims: { sub: 'p1', name: 'Cy', email: 'cy@g.test' }, tokens: { access_token: 'A' } });
    s1.close();
    // A fresh instance must load the persisted account from localStorage.
    const s2 = new AuthSession({ storageKey: key });
    const roundTrip = s2.list().length === 1 && s2.list()[0].name === 'Cy' && s2.isPersistent();

    // BroadcastChannel: a change on one instance reaches another.
    const peer = new AuthSession({ storageKey: key });
    let notified = false;
    peer.addEventListener('change', () => { notified = true; });
    s2.upsertAccount({ providerId: 'microsoft', providerName: 'Microsoft', claims: { sub: 'p2', name: 'Di' }, tokens: {} });
    await new Promise((r) => setTimeout(r, 50));
    const persisted = peer.isPersistent();
    // cleanup
    s2.setPersistent(false); s2.signOutAll();
    s2.close(); peer.close();
    return { roundTrip, notified, persisted };
  });
  ok('session persists to localStorage and reloads', persist.roundTrip);
  ok('BroadcastChannel notifies sibling sessions', persist.notified);

  // 8. End-to-end callback through window.__auth with a mocked token endpoint.
  const e2e = await page.evaluate(async () => {
    const { base64urlEncode } = await import('./js/pkce.js');
    const enc = (obj) => base64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));
    // Seed a transaction as if startLogin ran for google.
    const state = 'E2ESTATE';
    const provider = window.__auth.resolveProvider('google');
    sessionStorage.setItem('edot.auth.txn.' + state, JSON.stringify({
      providerId: 'google', codeVerifier: 'VER', nonce: 'E2ENONCE',
      redirectUri: 'https://app.test/cb', clientId: 'GOOGLE_CLIENT',
    }));
    const idToken = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
      iss: 'https://accounts.google.com', aud: 'GOOGLE_CLIENT', sub: 'g-42',
      nonce: 'E2ENONCE', name: 'Ezra', email: 'ezra@g.test',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })}.SIG`;
    const mockFetch = async (url, opts) => {
      if (String(url).includes('googleapis.com/token') && opts && opts.method === 'POST') {
        return new Response(JSON.stringify({ access_token: 'AT', id_token: idToken, token_type: 'Bearer', expires_in: 3600 }),
          { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}', { status: 404 });
    };
    window.__auth.session.signOutAll();
    const account = await window.__auth.completeCallback(
      'https://app.test/cb?code=AUTHCODE&state=' + state,
      { fetchImpl: mockFetch, provider },
    );
    return { name: account.name, sub: account.sub, provider: account.provider, inSession: window.__auth.session.list().length };
  });
  ok('full callback exchange creates a session account', e2e.name === 'Ezra' && e2e.sub === 'g-42' && e2e.provider === 'google');
  ok('completed account lands in the shared session', e2e.inSession === 1);

  // 9. Provider preset coverage sanity.
  const provs = await page.evaluate(async () => {
    const { listProviders } = await import('./js/providers.js');
    const all = listProviders();
    const ids = all.map((p) => p.id);
    const required = ['google', 'microsoft', 'apple', 'okta', 'auth0', 'keycloak', 'gitlab', 'cognito', 'salesforce', 'yahoo', 'paypal', 'linkedin', 'discord', 'twitch', 'spotify', 'github'];
    return { count: all.length, hasAll: required.every((r) => ids.includes(r)), githubOidc: all.find((p) => p.id === 'github').oidc };
  });
  ok('ships >=16 provider presets', provs.count >= 16);
  ok('all required providers present', provs.hasAll);
  ok('GitHub flagged as non-OIDC (no id_token)', provs.githubOidc === false);

  // Demo identity: a clearly-labelled, on-device sign-in so the identity flow is
  // usable before any provider client-id is configured.
  await page.evaluate(() => window.__auth.session.signOutAll());
  await page.waitForTimeout(50);
  const demoBtn = await page.$('edot-login [data-act="demo"]');
  ok('login panel offers a "demo identity (local only)" option', !!demoBtn);
  await demoBtn.click();
  await page.waitForTimeout(100);
  const demo = await page.evaluate(() => {
    const s = window.__auth.session; const a = s.active();
    return { signedIn: s.isSignedIn(), provider: a && a.provider, name: a && a.name, rows: document.querySelectorAll('edot-login .auth-account').length };
  });
  ok('clicking demo signs in a local-only identity', demo.signedIn && demo.provider === 'demo');
  ok('the demo identity renders as an account', demo.rows >= 1 && /demo/i.test(demo.name || ''));
  await page.evaluate(() => window.__auth.session.signOutAll());

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally { await browser.close(); server.close(); }
console.log(fail ? `\n${fail} FAILURE(S)` : '\nAUTH MODULE OK');
process.exit(fail ? 1 : 0);
