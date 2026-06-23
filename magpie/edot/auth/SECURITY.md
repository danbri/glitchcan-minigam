# edot auth — security notes

A system-wide, **client-side-only** OIDC login module for the edot suite
(office editor + calendar + maps). It runs entirely in the browser on static
GitHub Pages: there is no backend, so it is a **public client** with no client
secret. This document is deliberately honest about what that buys and what it
costs.

## Flow: Authorization Code + PKCE (S256)

We use the OAuth 2.0 **Authorization Code** grant with **PKCE** (RFC 7636,
SHA-256 / `S256`), never the deprecated implicit flow.

1. `createPkcePair()` generates a random `code_verifier`, its
   `code_challenge = base64url(SHA-256(code_verifier))`, plus a `state` and a
   `nonce` (all via Web Crypto).
2. We redirect to the IdP with the `code_challenge` (front channel). The
   `code_verifier` never leaves the browser at this point.
3. The IdP redirects back with an authorization `code`.
4. We POST the `code` **and** the raw `code_verifier` to the token endpoint
   (direct, back-channel-style TLS request). The IdP recomputes the challenge
   and rejects the exchange unless it matches.

### Why PKCE for a public client

Without a client secret, a stolen authorization code could otherwise be
redeemed by anyone. PKCE binds the code to the specific browser session that
initiated it: only the holder of the original `code_verifier` can redeem it.
This is the OAuth Security BCP's required pattern for SPAs.

## `state` — CSRF protection

`state` is a high-entropy random value stored (keyed) in `sessionStorage`
before redirect. On callback we look the transaction up **by** `state`; an
unknown or mismatched `state` is rejected (`handleRedirectCallback` throws).
This prevents an attacker from injecting their own authorization response into
a victim's session.

## `nonce` — id_token replay protection

`nonce` is generated per request and sent in the authorize call. The returned
`id_token` must echo the same `nonce`; `decodeIdToken` rejects a mismatch. This
prevents replay of a previously captured `id_token`.

## Claim validation (implemented)

`decodeIdToken` base64url-decodes the JWT header/payload with no external
library and validates:

- **`nonce`** equals the value we generated (replay),
- **`aud`** contains our `client_id` (and `azp` if multiple audiences),
- **`iss`** matches the expected issuer (trailing slash normalised),
- **`exp` / `nbf` / `iat`** temporal validity, with a small clock-skew window.

Any failure throws, so a malformed or mistargeted token is never accepted as a
session.

## JWT signature verification (DEFERRED — the secure-completion step)

`decodeIdToken` does **not** yet verify the JWT *signature* against the
provider's JWKS. `verifyIdTokenSignature()` is an explicit stub that reports
`deferred: true` rather than silently returning success.

Why this is acceptable as transitional scope, and not a sham:

- In the **Authorization Code** flow the `id_token` is delivered over a direct
  TLS request to the token endpoint — it is **not** carried through the
  attacker-influenceable front-channel redirect. So unlike the implicit flow,
  there is no in-transit substitution vector that signature checking would
  catch here.
- Claim validation (above) already pins `aud`/`iss`/`nonce`/`exp`.

The secure-completion step (do this before treating `id_token` claims as
trustworthy in a higher-stakes context, or if you ever accept tokens from a
less-trusted channel) is: fetch the provider's `jwks_uri`, select the key by
the JWT header `kid`, import it with `crypto.subtle.importKey`
(`RSASSA-PKCS1-v1_5` for RS256, `ECDSA P-256` for ES256), and
`crypto.subtle.verify` over the signing input `header.payload`. All achievable
with Web Crypto, no external library.

## Token storage / XSS exposure (honest)

- **Default:** tokens live in `sessionStorage`, scoped to the tab and erased on
  close — the smallest blast radius we can offer without a backend.
- **Opt-in "stay signed in":** tokens move to `localStorage` and survive
  restarts. We keep exactly one active store and wipe the other on toggle so a
  token is never duplicated.
- **The honest caveat:** any token in web storage is reachable by JavaScript,
  so a successful **XSS** in any suite app can exfiltrate it. There is no
  `HttpOnly` cookie protection available to a static, backend-less site. Keep
  the suite's CSP tight, avoid `innerHTML` with untrusted data, and prefer
  short-lived access tokens. A backend with `HttpOnly`, `Secure`,
  `SameSite=Strict` cookies + a token-exchange proxy is the hardening path if
  the threat model demands it.
- No refresh-token rotation is implemented; expired sessions require re-login.

## No client secrets

This is a public client. **No client secret is stored or shipped** — that would
be pointless (everything in the browser is public) and dangerous. `auth-config.js`
holds only public `client_id`s and the public `redirect_uri`.

## CORS reality (per provider)

A browser PKCE client must `fetch()` the token endpoint. That only works if the
IdP sends `Access-Control-Allow-Origin` on it.

- **Generally OK in-browser:** Google, Microsoft (Azure AD v2), Okta, Auth0,
  Keycloak, Amazon Cognito, GitLab, Salesforce.
- **Generally NOT (token endpoint lacks CORS — needs a same-origin proxy):**
  Apple, Yahoo, PayPal, LinkedIn, Discord, Twitch, Spotify, and GitHub
  (which is OAuth2-only and issues no `id_token`).

`providers.js` records the *expected* posture in `corsTokenEndpoint`; the UI
warns (⚠) accordingly. This is documentation, not a promise — IdPs change, so
verify per tenant/region. When a token exchange is CORS-blocked, `exchangeCode`
throws a clear `likelyCors` error instead of hanging.

## Redirect-URI registration

The `redirect_uri` must be registered with each IdP **exactly** (scheme, host,
path — character for character). The default is `login.html` in this directory,
which doubles as the callback handler. On GitHub Pages that is e.g.
`https://danbri.github.io/glitchcan-minigam/magpie/edot/auth/login.html`.

## Cross-app session sharing

Login state is shared across suite apps/tabs via `BroadcastChannel('edot-auth')`
(with a `storage`-event fallback). This is **same-origin** only — exactly the
trust boundary we want; it does not widen token exposure beyond the origin that
already holds the tokens.
