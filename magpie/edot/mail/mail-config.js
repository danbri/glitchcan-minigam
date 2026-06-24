// mail-config.js — provider configuration placeholders. BLANK by default and
// fully documented; NO SECRETS in code (CLAUDE.md). A deployer fills these in,
// or the app harvests an OAuth token at runtime from the edot auth module
// (auth/js/oidc.js + session.js).
//
// OAuth scopes the providers need ON TOP of the default openid/email/profile:
//   Gmail (Google provider):   https://www.googleapis.com/auth/gmail.modify
//   Graph (Microsoft provider): Mail.Read, Mail.Send   (+ Mail.ReadWrite for
//                               flag/move/delete)
// Register the client IDs with the IdP (Google Cloud console / Azure portal)
// and add the redirect URI for this app. The token is then passed to the
// adapter as config.token (static) or config.getToken (async refresh).

export const MAIL_CONFIG = {
  // Which backend to use by default: 'gmail' | 'graph' | 'jmap' | 'imap'.
  defaultBackend: 'gmail',

  gmail: {
    // OAuth client ID registered in Google Cloud (NOT a secret in a public
    // client, but still deployer-supplied). Token comes from the auth module.
    clientId: '',
    scopes: ['https://www.googleapis.com/auth/gmail.modify'],
    // token / getToken injected at runtime by the app.
  },

  graph: {
    clientId: '',
    scopes: ['Mail.Read', 'Mail.Send', 'Mail.ReadWrite'],
  },

  jmap: {
    // e.g. 'https://api.fastmail.com/jmap/session'. Token is a provider API
    // token (bearer). For HTTP Basic, set `basic` to base64('user:pass').
    sessionUrl: '',
    token: '',
    accountId: '', // optional; defaults to the primary mail account
  },

  imap: {
    // ⚠️ Browsers cannot speak raw IMAP/SMTP. This requires a WebSocket proxy
    // that holds the real connection (protocol documented in README.md). With
    // no proxyUrl the IMAP adapter refuses honestly instead of pretending.
    proxyUrl: '',          // e.g. 'wss://your-proxy.example/imap'
    host: '', port: 993, secure: true,
    user: '', pass: '',    // prefer an app password; never commit real creds
  },
};
