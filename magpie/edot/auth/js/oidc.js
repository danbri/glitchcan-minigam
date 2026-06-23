// oidc.js — the OIDC Authorization-Code-with-PKCE client core.
//
// Design mirrors js/git-remote.js: a small class with an INJECTABLE `fetch`
// (`new OidcClient(provider, { fetchImpl })`) so the whole flow — discovery,
// authorize-URL building, token exchange, id_token validation — is unit
// testable in Node against a mocked fetch, with no live IdP.
//
// Flow, end to end (public client, no secret):
//   1. createPkcePair()  → code_verifier/challenge + state + nonce  (pkce.js)
//   2. buildAuthorizeUrl() → send the browser to the IdP; stash the transient
//      state/verifier/nonce in sessionStorage keyed by `state`.
//   3. IdP redirects back to redirect_uri with ?code=…&state=…
//   4. handleRedirectCallback() → verify state, POST code+verifier to /token.
//   5. decodeIdToken() → base64url-decode + validate nonce/aud/iss/exp claims.
//
// ── CORS REALITY (read providers.js too) ────────────────────────────────────
// Step 4 is a browser fetch() to the IdP token endpoint. It only succeeds when
// that endpoint sends Access-Control-Allow-Origin. Google and Microsoft do for
// PKCE public clients; Okta/Auth0/Keycloak/Cognito/GitLab/Salesforce generally
// do; Apple/Yahoo/PayPal/LinkedIn/Discord/Twitch/Spotify/GitHub generally do
// NOT and need a same-origin proxy. We do not paper over this: a CORS failure
// surfaces as a clear error, not a silent hang.
//
// ── SIGNATURE VERIFICATION (deferred — see SECURITY.md) ─────────────────────
// decodeIdToken validates *claims* (nonce, aud, iss, exp/iat) but does NOT yet
// verify the JWT *signature* against the provider JWKS. For an in-browser
// Authorization-Code flow that is acceptable transitional scope: the id_token
// arrives over a direct TLS channel from the token endpoint (not via the
// redirect/front channel), so it isn't attacker-substitutable in transit. Full
// JWKS RS256/ES256 verification via crypto.subtle.verify is the documented
// secure-completion step; `verifyIdTokenSignature` below is a stub that says so.

import { base64urlDecodeToString, base64urlDecodeToBytes } from './pkce.js';

const TXN_PREFIX = 'edot.auth.txn.'; // sessionStorage key per in-flight `state`

export class OidcClient {
  /**
   * @param {object} provider  a preset from providers.js (clone + clientId set)
   * @param {object} [opts]
   * @param {function} [opts.fetchImpl]  injectable fetch (defaults to window.fetch)
   * @param {Storage}  [opts.txnStore]   where transient PKCE state lives
   *                                      (defaults to sessionStorage)
   */
  constructor(provider, { fetchImpl, txnStore } = {}) {
    if (!provider) throw new Error('OidcClient: provider is required');
    this.provider = provider;
    this.fetch = fetchImpl || ((...a) => fetch(...a));
    this.txnStore = txnStore || (typeof sessionStorage !== 'undefined' ? sessionStorage : memoryStore());
    this._discovered = null; // cached discovery document
  }

  // ---- discovery ----------------------------------------------------------
  // Fetch `${issuer}/.well-known/openid-configuration` and cache it. Generic
  // providers (Keycloak, Okta, Auth0, …) need only an `issuer` to work.
  async discover() {
    if (this._discovered) return this._discovered;
    const issuer = this.provider.issuer;
    if (!issuer) return null; // provider relies on explicit endpoints only
    // Spec: append exactly "/.well-known/openid-configuration", honouring any
    // path in the issuer, and collapsing a trailing slash.
    const base = issuer.replace(/\/+$/, '');
    const res = await this.fetch(`${base}/.well-known/openid-configuration`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
    const doc = await res.json();
    this._discovered = doc;
    return doc;
  }

  // Resolve effective endpoints: explicit preset values win, else discovery,
  // else null. Returns { authorize, token, userinfo, jwks, issuer }.
  async endpoints() {
    let d = null;
    try { d = await this.discover(); } catch { d = null; }
    const p = this.provider;
    return {
      issuer: p.issuer || (d && d.issuer) || null,
      authorize: p.authorize || (d && d.authorization_endpoint) || null,
      token: p.token || (d && d.token_endpoint) || null,
      userinfo: p.userinfo || (d && d.userinfo_endpoint) || null,
      jwks: p.jwks || (d && d.jwks_uri) || null,
    };
  }

  // ---- authorize ----------------------------------------------------------
  // Build the front-channel authorization URL. Pure string building — does not
  // navigate — so it's trivially testable. Accepts pre-generated PKCE material
  // (so the caller controls persistence/lifetime).
  buildAuthorizeUrl({
    clientId, redirectUri, scopes, state, nonce, codeChallenge,
    codeChallengeMethod = 'S256', responseMode, extraParams,
  }) {
    const p = this.provider;
    const authorize = p.authorize || (this._discovered && this._discovered.authorization_endpoint);
    if (!authorize) throw new Error('No authorization endpoint (run discover() first or set provider.authorize)');
    const scopeList = scopes && scopes.length ? scopes : p.scopes;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId || p.clientId || '',
      redirect_uri: redirectUri,
      scope: (scopeList || []).join(' '),
      state,
    });
    if (nonce) params.set('nonce', nonce);
    if (codeChallenge) {
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', codeChallengeMethod);
    }
    const mode = responseMode || p.responseMode;
    if (mode) params.set('response_mode', mode);
    if (extraParams) for (const [k, v] of Object.entries(extraParams)) params.set(k, v);
    const sep = authorize.includes('?') ? '&' : '?';
    return `${authorize}${sep}${params.toString()}`;
  }

  // Persist the per-request transaction (verifier/nonce/redirect/etc.) keyed by
  // its CSRF `state`, so handleRedirectCallback can recover it after the round
  // trip through the IdP. sessionStorage is per-tab and cleared on close.
  saveTransaction(state, txn) {
    try { this.txnStore.setItem(TXN_PREFIX + state, JSON.stringify(txn)); } catch { /* blocked */ }
  }
  loadTransaction(state) {
    try {
      const raw = this.txnStore.getItem(TXN_PREFIX + state);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  clearTransaction(state) {
    try { this.txnStore.removeItem(TXN_PREFIX + state); } catch { /* */ }
  }

  // One call: generate PKCE, persist the transaction, return the authorize URL.
  // The caller then sets window.location = url (kept out of here for testing).
  async startLogin({ clientId, redirectUri, scopes, pkce, extraParams }) {
    if (!pkce) throw new Error('startLogin: pass a PKCE bundle from createPkcePair()');
    await this.discover().catch(() => null);
    const url = this.buildAuthorizeUrl({
      clientId, redirectUri, scopes,
      state: pkce.state, nonce: pkce.nonce, codeChallenge: pkce.codeChallenge,
      extraParams,
    });
    this.saveTransaction(pkce.state, {
      providerId: this.provider.id,
      codeVerifier: pkce.codeVerifier,
      nonce: pkce.nonce,
      redirectUri,
      clientId: clientId || this.provider.clientId || '',
      createdAt: Date.now(),
    });
    return url;
  }

  // ---- redirect callback + token exchange --------------------------------
  // Parse code/state from a callback URL, verify state against the stored
  // transaction (CSRF defence), then exchange the code at the token endpoint.
  // `urlString` defaults to the live location so it works as a page handler.
  async handleRedirectCallback(urlString) {
    const url = new URL(urlString || (typeof location !== 'undefined' ? location.href : ''));
    // Auth params may arrive in the query (response_type=code) or, for some
    // providers / response_modes, the fragment. Check both.
    const q = url.searchParams;
    const hash = url.hash && url.hash.length > 1 ? new URLSearchParams(url.hash.slice(1)) : new URLSearchParams();
    const get = (k) => q.get(k) ?? hash.get(k);

    const error = get('error');
    if (error) {
      const e = new Error(`Authorization error: ${error}${get('error_description') ? ` — ${get('error_description')}` : ''}`);
      e.oauthError = error;
      throw e;
    }
    const code = get('code');
    const state = get('state');
    if (!code || !state) throw new Error('Callback missing code or state');

    const txn = this.loadTransaction(state);
    if (!txn) throw new Error('Unknown or expired state (possible CSRF) — no matching transaction');
    // (state equality is implied by the keyed lookup; assert defensively.)
    if (txn.state && txn.state !== state) throw new Error('State mismatch (possible CSRF)');

    const tokens = await this.exchangeCode({
      code,
      codeVerifier: txn.codeVerifier,
      redirectUri: txn.redirectUri,
      clientId: txn.clientId,
    });
    this.clearTransaction(state);
    return { tokens, txn };
  }

  // POST the authorization code + PKCE verifier to the token endpoint.
  // Returns the parsed token response: { access_token, id_token, expires_in,…}.
  async exchangeCode({ code, codeVerifier, redirectUri, clientId }) {
    const eps = await this.endpoints();
    if (!eps.token) throw new Error('No token endpoint (discovery failed and provider.token unset)');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId || this.provider.clientId || '',
      code_verifier: codeVerifier,
    });
    let res;
    try {
      res = await this.fetch(eps.token, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });
    } catch (netErr) {
      // A thrown fetch here is almost always the CORS preflight/opaque wall.
      const e = new Error(
        `Token request to ${eps.token} failed (likely CORS — this IdP may not ` +
        `allow browser token exchange; a same-origin proxy is needed). ${netErr.message}`);
      e.cause = netErr; e.likelyCors = true;
      throw e;
    }
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) {
      const e = new Error(json.error_description || json.error || `Token endpoint ${res.status}`);
      e.status = res.status; e.data = json;
      throw e;
    }
    return json;
  }

  // ---- userinfo (for OAuth2-only providers / extra claims) ---------------
  async fetchUserInfo(accessToken) {
    const eps = await this.endpoints();
    if (!eps.userinfo) return null;
    const res = await this.fetch(eps.userinfo, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`userinfo ${res.status}`);
    return res.json();
  }

  // ---- id_token decode + claim validation --------------------------------
  // Decode header/payload (base64url, no external lib) and validate the
  // security-relevant claims. Throws on any failure so a bad token is never
  // mistaken for a session. Signature verification is DEFERRED (see top).
  decodeIdToken(jwt, { nonce, clientId, issuer, clockSkewSec = 120, now } = {}) {
    const parts = String(jwt).split('.');
    if (parts.length !== 3) throw new Error('id_token is not a well-formed JWT');
    const header = JSON.parse(base64urlDecodeToString(parts[0]));
    const payload = JSON.parse(base64urlDecodeToString(parts[1]));

    const nowSec = Math.floor((now != null ? now : Date.now()) / 1000);

    // nonce: replay defence — must equal the one we generated.
    if (nonce != null && payload.nonce !== nonce) {
      throw new Error('id_token nonce mismatch (possible replay)');
    }
    // aud: the token must be intended for *this* client.
    if (clientId != null) {
      const aud = payload.aud;
      const audMatch = Array.isArray(aud) ? aud.includes(clientId) : aud === clientId;
      if (!audMatch) throw new Error('id_token aud does not match client_id');
      // If azp (authorized party) is present with multiple audiences, it must be us.
      if (Array.isArray(aud) && aud.length > 1 && payload.azp && payload.azp !== clientId) {
        throw new Error('id_token azp does not match client_id');
      }
    }
    // iss: must match the expected issuer (modulo a trailing slash).
    if (issuer != null) {
      const norm = (s) => String(s).replace(/\/+$/, '');
      if (norm(payload.iss) !== norm(issuer)) throw new Error('id_token iss mismatch');
    }
    // exp / iat / nbf: temporal validity with a small clock-skew allowance.
    if (typeof payload.exp === 'number' && nowSec > payload.exp + clockSkewSec) {
      throw new Error('id_token expired');
    }
    if (typeof payload.nbf === 'number' && nowSec + clockSkewSec < payload.nbf) {
      throw new Error('id_token not yet valid (nbf)');
    }
    if (typeof payload.iat === 'number' && payload.iat - clockSkewSec > nowSec) {
      throw new Error('id_token issued in the future (iat)');
    }
    return { header, payload };
  }

  // Stub: full JWKS signature verification is the documented next step.
  // Intentionally NOT implemented to avoid a false sense of security — see
  // SECURITY.md. A real implementation would fetch eps.jwks, select the key by
  // header.kid, import it via crypto.subtle.importKey (RSASSA-PKCS1-v1_5 / ES),
  // and crypto.subtle.verify the signing input (parts[0]+'.'+parts[1]).
  async verifyIdTokenSignature(/* jwt */) {
    return { verified: false, deferred: true,
      reason: 'JWKS signature verification is deferred — see auth/SECURITY.md' };
  }
}

// A minimal in-memory Storage shim for non-browser / test contexts.
function memoryStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

// Convenience re-export so callers can `import { base64urlDecodeToBytes } from './oidc.js'`.
export { base64urlDecodeToBytes };
