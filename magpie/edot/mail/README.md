# edot mail

A fast, accessible, mobile-first webmail client for the edot suite, with a
**pluggable backend-adapter architecture**. The UI is provider-agnostic: it only
ever talks to a `MailAdapter` (`js/adapters/base.js`), so Gmail, Microsoft Graph,
JMAP, and IMAP-via-proxy all drop in behind the same normalized shapes.

Entry point: **`mail.html`** hosting `<edot-mail>`. Vanilla ES modules, Web
Components via `customElements.define`, light DOM + shared `mail.css`, no runtime
CDN dependencies (Web APIs + `fetch` only).

## Honest transport reality

**A browser cannot speak raw IMAP or SMTP — there is no TCP socket API in a web
page.** This is a hard limit, not a missing feature. So the four backends differ
fundamentally in how they reach a server:

| Backend | Transport (now, browser-side) | Auth | Implemented | Caveats |
|---|---|---|---|---|
| **gmail** | ✅ Browser-direct — Gmail REST is CORS-enabled | OAuth 2.0 bearer (Google) | list / read / send / flags / move / archive / delete / threads / search / draft | Needs a Google **client ID** + the `https://www.googleapis.com/auth/gmail.modify` scope. No client ID shipped. |
| **graph** | ✅ Browser-direct — Microsoft Graph is CORS-enabled | OAuth 2.0 bearer (Microsoft) | list / read / send / flags / move / archive / delete / threads / search / draft | Needs an Azure **client ID** + `Mail.Read`, `Mail.Send` (and `Mail.ReadWrite` for flag/move/delete). |
| **jmap** | ✅ Browser-direct *when the JMAP server sends CORS* (Fastmail does) | Bearer API token or HTTP Basic | list / read / send / flags / move / archive / delete / threads / search / draft | Needs a **session URL** + token. Open standard (RFC 8620/8621). |
| **imap** | ⚠️ **Requires a WebSocket proxy** — browsers cannot open raw TCP | IMAP/SMTP creds, held by the proxy | full adapter (client half) against the documented protocol | The proxy is **NOT built or deployed here**. Without `proxyUrl` the adapter is `isAvailable() === false` and refuses honestly. |

`capabilities()` on every adapter advertises `{ threads, search, push, flags,
move, send }` truthfully so the UI hides/disables controls a backend can't do.

### OAuth scopes (on top of the default `openid email profile`)

The bearer token comes from the edot auth module (`auth/js/oidc.js` +
`session.js`). Mail needs **extra** scopes that the deployer must request when
registering the app:

- **Gmail (Google provider):** `https://www.googleapis.com/auth/gmail.modify`
- **Graph (Microsoft provider):** `Mail.Read`, `Mail.Send` (+ `Mail.ReadWrite`)

No secrets live in code. `mail-config.js` carries blank client-ID / URL
placeholders and documents exactly what each backend needs.

## The IMAP WebSocket-proxy protocol

Because the browser can't do TCP, `js/adapters/imap.js` implements the **client
half** of a small JSON protocol over a WebSocket. A server-side proxy (which you
would deploy separately — **not part of this repo**) holds the real IMAP/SMTP
connection and translates these messages. One JSON object per request; the proxy
replies with the matching `id` (or `{ id, error }`).

```
→ { id, op:'login',  host, port, secure, user, pass }     ← { id, ok }
→ { id, op:'list' }                                       ← { id, mailboxes:[{name,role,unread,total}] }
→ { id, op:'select', mailbox }                            ← { id, exists, uidnext }
→ { id, op:'search', mailbox, query, limit, cursor }      ← { id, uids:[…], nextCursor }
→ { id, op:'fetch',  mailbox, uid, what:'headers'|'full'} ← { id, raw, flags:[…] }   (raw = RFC822 string)
→ { id, op:'store',  mailbox, uid, add:[…], remove:[…] }  ← { id, ok }   (IMAP flags: \Seen \Flagged \Answered)
→ { id, op:'move',   mailbox, uid, dest }                 ← { id, ok }
→ { id, op:'expunge',mailbox, uid }                       ← { id, ok }
→ { id, op:'append', mailbox, raw }                       ← { id, ok }   (save draft)
→ { id, op:'send',   raw, envelope }                      ← { id, ok }   (proxy relays via SMTP)
```

The `raw` RFC822 returned by `fetch` is parsed by `js/mime.js` — that is exactly
the structured-vs-raw boundary the MIME parser exists for. `socketFactory` is
injectable so the adapter is testable against a fake WebSocket with no network
(see `test-mail.mjs`).

## Reading-pane security posture

Email HTML is hostile by default. `js/sanitize.js` is the reading-pane security
boundary — email HTML never reaches the DOM raw:

- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`, `<base>`,
  `<form>`, `<style>`, `<noscript>`, frames/applets are **removed entirely**.
- all `on*` event-handler attributes are **stripped**; only an allow-list of
  attributes survives.
- `javascript:` / `vbscript:` / non-image `data:` URLs are **neutralized**.
- **remote resources are BLOCKED by default** (anti-tracking / privacy): the
  real `src` is parked in `data-blocked-src`, the live `src` cleared, so nothing
  is fetched. CSS `url()` in inline styles is blocked the same way;
  `expression()`/`@import`/`behavior:` are killed. A **"Load remote content"**
  affordance re-runs the sanitizer with `allowRemote:true` on demand.
- links are **seat-belted**: `target="_blank"` + `rel="noopener noreferrer
  nofollow"`.
- the sanitized fragment is rendered in a **passive container** with no script
  execution.

## Data ethics

The app handles the user's own mail. The local cache (`js/cache.js`, IndexedDB)
is **device-local only** and mail content is never shipped anywhere except the
configured provider. Nothing phones home.

## Files

- `mail.html` — entry point; hosts `<edot-mail>`, exposes `window.__mail`.
- `mail.css` — mobile-first three-pane layout, dark mode, mobile drawer.
- `mail-config.js` — blank provider config placeholders (client IDs, scopes,
  JMAP session URL, IMAP proxy URL). No secrets.
- `js/edot-mail.js` — the `<edot-mail>` web component (three panes, compose,
  reply/forward, actions, keyboard shortcuts, help).
- `js/adapters/base.js` — the `MailAdapter` interface + normalized shapes +
  address helpers; injectable `fetch`.
- `js/adapters/{gmail,graph,jmap,imap}.js` — the four backends.
- `js/adapters/index.js` — the adapter registry + honest backend info.
- `js/mime.js` — RFC 5322 / MIME parser for the raw-RFC822 paths.
- `js/sanitize.js` — reading-pane HTML sanitizer (the security boundary).
- `js/cache.js` — local IndexedDB message/metadata cache.
- `test-mail.mjs` — headless Chromium test; all `fetch`/WebSocket mocked.

## Tests

```
node magpie/edot/mail/test-mail.mjs
```

Covers MIME (multipart, alternative selection, base64 + quoted-printable,
RFC 2047 subjects, attachments), each adapter against mocked `fetch`/WebSocket
(normalized shapes + send method/URL/body), sanitization (script/handler removal,
remote-image blocking + load-on-demand, link seatbelt), and the UI (mailbox +
message list, message open, compose draft shape + send, search). 47 checks; no
page errors.

## Keyboard shortcuts

`j`/`k` next/previous · `Enter` open · `r`/`a` reply/reply-all · `f` forward ·
`e` archive · `#` delete · `u` mark unread · `c` compose · `/` search · `?` help.
