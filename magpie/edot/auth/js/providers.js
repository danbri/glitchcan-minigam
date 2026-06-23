// providers.js — presets for mainstream OIDC / OAuth2 identity providers.
//
// Each preset carries enough to start an Authorization-Code-with-PKCE flow:
//   - `issuer`      : the OIDC issuer URL. When present, the client can fetch
//                     `${issuer}/.well-known/openid-configuration` and discover
//                     endpoints automatically (preferred — survives URL churn).
//   - `authorize` / `token` / `userinfo` / `jwks` : explicit endpoints, used as
//                     a fallback (or override) when discovery is unavailable.
//   - `scopes`      : sensible default scopes (always including `openid` for
//                     true OIDC providers).
//   - `clientId`    : BLANK by default — a deployer fills this in via
//                     auth-config.js after registering the app with the IdP.
//   - `pkce`        : whether the provider supports/needs PKCE S256 (all the
//                     real OIDC ones here do; it's safe to always send).
//   - `oidc`        : false for OAuth2-only providers that return NO id_token
//                     (e.g. GitHub) — the client must use userinfo instead.
//   - `template`    : true when the endpoints contain a {placeholder} the
//                     deployer must replace (tenant, domain, region, …).
//
// IMPORTANT — CORS REALITY (do not pretend otherwise):
//   A browser PKCE public client must POST to the *token* endpoint over fetch.
//   That only works if the IdP returns CORS headers on that endpoint.
//     ✅ Google, Microsoft (Azure AD v2), Okta, Auth0, Keycloak, Cognito,
//        GitLab, Salesforce — documented to support CORS for SPA/public PKCE.
//     ⚠️  Apple, Yahoo, PayPal, LinkedIn, Discord, Twitch, Spotify, GitHub —
//        historically send NO Access-Control-Allow-Origin on /token, so the
//        browser token exchange is blocked by the same-origin policy. These
//        generally need a tiny same-origin proxy to complete the exchange.
//   The `corsTokenEndpoint` flag records the *expected* behaviour so the UI can
//   warn honestly. It is a documentation aid, not a guarantee — verify per
//   tenant/region, because IdPs change CORS posture over time.

export const PROVIDERS = {
  // ---- Full OIDC, browser-friendly (CORS on token endpoint) --------------
  google: {
    id: 'google',
    name: 'Google',
    issuer: 'https://accounts.google.com',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
    jwks: 'https://www.googleapis.com/oauth2/v3/certs',
    scopes: ['openid', 'email', 'profile'],
    clientId: '',
    oidc: true, pkce: true, corsTokenEndpoint: true,
    color: '#4285F4', initials: 'G',
  },

  microsoft: {
    id: 'microsoft',
    name: 'Microsoft',
    // "common" tenant works for personal + work/school accounts (Azure AD v2).
    issuer: 'https://login.microsoftonline.com/common/v2.0',
    authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userinfo: 'https://graph.microsoft.com/oidc/userinfo',
    jwks: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
    scopes: ['openid', 'email', 'profile'],
    clientId: '',
    oidc: true, pkce: true, corsTokenEndpoint: true,
    color: '#2F2F2F', initials: 'MS',
  },

  okta: {
    id: 'okta',
    name: 'Okta',
    // Replace {yourOktaDomain} with e.g. dev-12345.okta.com.
    issuer: 'https://{yourOktaDomain}/oauth2/default',
    scopes: ['openid', 'email', 'profile'],
    clientId: '',
    oidc: true, pkce: true, corsTokenEndpoint: true, template: true,
    color: '#007DC1', initials: 'OK',
  },

  auth0: {
    id: 'auth0',
    name: 'Auth0',
    // Replace {yourAuth0Domain} with e.g. your-tenant.us.auth0.com.
    issuer: 'https://{yourAuth0Domain}/',
    scopes: ['openid', 'email', 'profile'],
    clientId: '',
    oidc: true, pkce: true, corsTokenEndpoint: true, template: true,
    color: '#EB5424', initials: 'A0',
  },

  keycloak: {
    id: 'keycloak',
    name: 'Keycloak / generic OIDC',
    // Generic OIDC: point `issuer` at any compliant provider's realm and let
    // discovery do the rest. e.g. https://kc.example.com/realms/myrealm
    issuer: 'https://{yourKeycloakHost}/realms/{realm}',
    scopes: ['openid', 'email', 'profile'],
    clientId: '',
    oidc: true, pkce: true, corsTokenEndpoint: true, template: true,
    color: '#4D4D4D', initials: 'KC',
  },

  gitlab: {
    id: 'gitlab',
    name: 'GitLab',
    issuer: 'https://gitlab.com',
    authorize: 'https://gitlab.com/oauth/authorize',
    token: 'https://gitlab.com/oauth/token',
    userinfo: 'https://gitlab.com/oauth/userinfo',
    jwks: 'https://gitlab.com/oauth/discovery/keys',
    scopes: ['openid', 'email', 'profile'],
    clientId: '',
    oidc: true, pkce: true, corsTokenEndpoint: true,
    color: '#FC6D26', initials: 'GL',
  },

  cognito: {
    id: 'cognito',
    name: 'Amazon Cognito',
    // Replace {region} and {userPoolId}; the hosted-UI domain ({domain}) is
    // what authorize/token actually live on.
    issuer: 'https://cognito-idp.{region}.amazonaws.com/{userPoolId}',
    authorize: 'https://{domain}.auth.{region}.amazoncognito.com/oauth2/authorize',
    token: 'https://{domain}.auth.{region}.amazoncognito.com/oauth2/token',
    userinfo: 'https://{domain}.auth.{region}.amazoncognito.com/oauth2/userInfo',
    scopes: ['openid', 'email', 'profile'],
    clientId: '',
    oidc: true, pkce: true, corsTokenEndpoint: true, template: true,
    color: '#FF9900', initials: 'AW',
  },

  salesforce: {
    id: 'salesforce',
    name: 'Salesforce',
    issuer: 'https://login.salesforce.com',
    authorize: 'https://login.salesforce.com/services/oauth2/authorize',
    token: 'https://login.salesforce.com/services/oauth2/token',
    userinfo: 'https://login.salesforce.com/services/oauth2/userinfo',
    jwks: 'https://login.salesforce.com/id/keys',
    scopes: ['openid', 'email', 'profile'],
    clientId: '',
    oidc: true, pkce: true, corsTokenEndpoint: true,
    color: '#00A1E0', initials: 'SF',
  },

  // ---- Full OIDC, but token endpoint typically has NO CORS ---------------
  apple: {
    id: 'apple',
    name: 'Apple',
    issuer: 'https://appleid.apple.com',
    authorize: 'https://appleid.apple.com/auth/authorize',
    token: 'https://appleid.apple.com/auth/token',
    jwks: 'https://appleid.apple.com/auth/keys',
    // Apple requires response_mode=form_post when email/name scopes are asked,
    // and its token endpoint is not CORS-enabled for browsers.
    scopes: ['openid', 'email', 'name'],
    clientId: '',
    oidc: true, pkce: true, corsTokenEndpoint: false,
    responseMode: 'form_post',
    color: '#000000', initials: '',
  },

  yahoo: {
    id: 'yahoo',
    name: 'Yahoo',
    issuer: 'https://api.login.yahoo.com',
    authorize: 'https://api.login.yahoo.com/oauth2/request_auth',
    token: 'https://api.login.yahoo.com/oauth2/get_token',
    userinfo: 'https://api.login.yahoo.com/openid/v1/userinfo',
    jwks: 'https://api.login.yahoo.com/openid/v1/certs',
    scopes: ['openid', 'email', 'profile'],
    clientId: '',
    oidc: true, pkce: true, corsTokenEndpoint: false,
    color: '#6001D2', initials: 'Y!',
  },

  paypal: {
    id: 'paypal',
    name: 'PayPal',
    issuer: 'https://www.paypalobjects.com',
    authorize: 'https://www.paypal.com/signin/authorize',
    token: 'https://api-m.paypal.com/v1/oauth2/token',
    userinfo: 'https://api-m.paypal.com/v1/identity/openidconnect/userinfo',
    scopes: ['openid', 'email', 'profile'],
    clientId: '',
    oidc: true, pkce: true, corsTokenEndpoint: false,
    color: '#003087', initials: 'PP',
  },

  // ---- OAuth2-only (NO id_token); identity via userinfo ------------------
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    // LinkedIn's "Sign In with LinkedIn using OpenID Connect" product does
    // issue an id_token; the classic OAuth2 product does not. Discovery URL:
    issuer: 'https://www.linkedin.com/oauth',
    authorize: 'https://www.linkedin.com/oauth/v2/authorization',
    token: 'https://www.linkedin.com/oauth/v2/accessToken',
    userinfo: 'https://api.linkedin.com/v2/userinfo',
    jwks: 'https://www.linkedin.com/oauth/openid/jwks',
    scopes: ['openid', 'email', 'profile'],
    clientId: '',
    oidc: true, pkce: false, corsTokenEndpoint: false,
    color: '#0A66C2', initials: 'in',
  },

  discord: {
    id: 'discord',
    name: 'Discord',
    authorize: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    userinfo: 'https://discord.com/api/users/@me',
    scopes: ['identify', 'email'],
    clientId: '',
    oidc: false, pkce: true, corsTokenEndpoint: false,
    color: '#5865F2', initials: 'D',
  },

  twitch: {
    id: 'twitch',
    name: 'Twitch',
    // Twitch is OIDC-capable: claims via id_token when scope `openid` is sent.
    issuer: 'https://id.twitch.tv/oauth2',
    authorize: 'https://id.twitch.tv/oauth2/authorize',
    token: 'https://id.twitch.tv/oauth2/token',
    userinfo: 'https://id.twitch.tv/oauth2/userinfo',
    jwks: 'https://id.twitch.tv/oauth2/keys',
    scopes: ['openid', 'user:read:email'],
    clientId: '',
    oidc: true, pkce: false, corsTokenEndpoint: false,
    color: '#9146FF', initials: 'T',
  },

  spotify: {
    id: 'spotify',
    name: 'Spotify',
    authorize: 'https://accounts.spotify.com/authorize',
    token: 'https://accounts.spotify.com/api/token',
    userinfo: 'https://api.spotify.com/v1/me',
    scopes: ['user-read-email', 'user-read-private'],
    clientId: '',
    oidc: false, pkce: true, corsTokenEndpoint: false,
    color: '#1DB954', initials: 'S',
  },

  github: {
    id: 'github',
    name: 'GitHub',
    // ⚠️ OAuth2 only — GitHub does NOT issue an OIDC id_token for user login.
    // Identity comes from the REST API (/user). PKCE is not supported on the
    // standard OAuth app token endpoint, and /login/oauth/access_token has no
    // CORS, so a browser-only flow needs a proxy. Included for completeness.
    authorize: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    userinfo: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
    clientId: '',
    oidc: false, pkce: false, corsTokenEndpoint: false,
    color: '#24292F', initials: 'GH',
  },
};

// A stable, display-ordered list (objects, not just ids).
export function listProviders() {
  return Object.values(PROVIDERS);
}

// Look up a preset by id. Returns a shallow clone so callers can layer config
// (client IDs, resolved template values) without mutating the shared preset.
export function getProvider(id) {
  const p = PROVIDERS[id];
  return p ? { ...p, scopes: [...p.scopes] } : null;
}

// True if any endpoint/issuer still contains an unresolved {placeholder}.
export function hasUnresolvedPlaceholders(provider) {
  return ['issuer', 'authorize', 'token', 'userinfo', 'jwks']
    .some((k) => typeof provider[k] === 'string' && /\{[^}]+\}/.test(provider[k]));
}
