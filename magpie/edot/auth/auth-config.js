// auth-config.js — DEPLOYER CONFIGURATION. Fill in client IDs and the redirect
// URI per provider here, after you've registered the app with each IdP.
//
// Nothing secret belongs in this file: a browser PKCE public client has NO
// client secret. The only values are public client IDs and the redirect URI
// (which the IdP also has on record). Safe to commit / ship on GitHub Pages.
//
// HOW TO ENABLE A PROVIDER:
//   1. Register an "application" / "OAuth client" with that IdP.
//   2. Choose application type = SPA / public / "no client secret" + PKCE.
//   3. Register the EXACT redirect URI below (must match character-for-char).
//   4. Paste the issued client_id into AUTH_CONFIG.providers[<id>].clientId.
//   5. For template providers (okta/auth0/keycloak/cognito), also set `issuer`
//      (and any {placeholder} endpoints) to your tenant/domain/region.
//
// The redirect URI defaults to this directory's login.html, which doubles as
// the callback handler. On GitHub Pages that is e.g.
//   https://danbri.github.io/glitchcan-minigam/magpie/edot/auth/login.html

export const AUTH_CONFIG = {
  // Computed at runtime when blank: the absolute URL of login.html next to
  // this file. Override only if your callback lives elsewhere.
  redirectUri: '',

  // Default "stay signed in" off (sessionStorage). Deployers can flip this.
  defaultPersistent: false,

  // Per-provider overrides merged over the presets in js/providers.js.
  // Only `clientId` is required to light up a provider; the rest are for
  // template providers that need a tenant/domain/region.
  providers: {
    google: { clientId: '' },
    microsoft: { clientId: '' },
    apple: { clientId: '' },          // Apple "Services ID"
    okta: { clientId: '', issuer: '' },      // e.g. https://dev-123.okta.com/oauth2/default
    auth0: { clientId: '', issuer: '' },     // e.g. https://your-tenant.us.auth0.com/
    keycloak: { clientId: '', issuer: '' },  // e.g. https://kc.example.com/realms/myrealm
    gitlab: { clientId: '' },
    cognito: { clientId: '', issuer: '', authorize: '', token: '', userinfo: '' },
    salesforce: { clientId: '' },
    yahoo: { clientId: '' },
    paypal: { clientId: '' },
    linkedin: { clientId: '' },
    discord: { clientId: '' },
    twitch: { clientId: '' },
    spotify: { clientId: '' },
    github: { clientId: '' },          // OAuth2 only; needs a proxy for token exchange
  },
};

// Resolve the effective redirect URI (config value or login.html beside us).
export function resolveRedirectUri() {
  if (AUTH_CONFIG.redirectUri) return AUTH_CONFIG.redirectUri;
  try { return new URL('./login.html', import.meta.url).href; } catch { return ''; }
}

// Which providers has the deployer actually configured (non-empty clientId)?
export function configuredProviderIds() {
  return Object.entries(AUTH_CONFIG.providers)
    .filter(([, c]) => c && c.clientId)
    .map(([id]) => id);
}
