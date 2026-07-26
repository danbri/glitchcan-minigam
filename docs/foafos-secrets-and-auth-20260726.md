# Is login the next big puzzle for foafos?

July 2026. Short answer: **no — login is largely built and tested. Secret
HOLDING is the gap, and it is a capability problem, not an auth problem.**

Written in response to: *"the whole edot office system … drafted a lot of
storage functionality including a reasonable attempt at Github-backed saving
which required a SECRET … I also asked for stubs for s3, for Solid, and for
logging in with OIDC. None of which was tested."*

## First, a correction: it is tested

`magpie/edot/auth/` is in better shape than remembered.

- Authorization Code + **PKCE (S256)** via Web Crypto — never implicit.
- **16+ provider presets**, with GitHub correctly flagged as non-OIDC (no
  `id_token`).
- A written, honest `SECURITY.md` that says plainly it is a public client on
  a static host with no backend and no client secret.
- `magpie/edot/auth/test-auth.mjs`: **34 passing assertions**, including a
  full callback exchange that lands an account in the shared session, and
  BroadcastChannel notification of sibling tabs. Every IdP interaction is
  mocked via an injected `fetch` — deliberately, so it never touches a real
  provider.

What is *not* tested is a real IdP round trip, which this environment cannot
do anyway (the headless browser has no egress). And the S3 / Solid / GitHub
`ResourceSource` classes exist with the same interface as the rest but have
no suites of their own.

## What is actually broken, measured

Under `?root=office`, with edot de-privileged (July 2026), asking it to
"stay signed in" and stashing a token exactly as its own `session.js` does:

| | |
|---|---|
| token in `FoafStore.snapshot('edot')`, plaintext | **true** |
| plaintext **on disk** in `foafos.store.edot` | **true** |
| `sessionStorage`-scoped token reaching disk | false — the shim is memory-only, so the *default* is safer under foafos than standalone |
| bus / audit carrying the value | false — the store records key and size, never the value |
| the shell's sealed-session crypto used on this path | **none** — it exists and nothing reaches it |

Nothing was broken to cause this. `session.js` implements "stay signed in"
by moving tokens from `sessionStorage` to `localStorage`; under foafos that
`localStorage` is app-sdk's shim over the storage broker. **Reading back what
you wrote is what a storage broker is FOR.** Which is precisely why a
credential cannot live in one: the single guarantee FoafStore makes is the
one a secret cannot afford.

Note what changed and what did not. Standalone edot also keeps the token in
plaintext in its own origin's `localStorage`, and its SECURITY.md says so.
What foafos changes is *who holds it*: one origin, one file, every app's
secrets together.

## The shape of the answer

Not "add login". The two moves that follow from everything else in this
system:

### 1. A `secrets` capability, distinct from `storage`

Shipped: `packages/foafos/src/secrets.mjs`. Same shape as FoafStore — grant,
check, audit, refuse in the open — with a deliberately **worse interface**:

```
PUT     an app may hand a secret over
NAMES   an app may ask which of its own secrets exist
USE     an app may ask the SHELL to do something with one
GET     there is no get
```

The asymmetry is the design. A token an app cannot read back is a token it
cannot leak, log, put in a URL, or be tricked into posting somewhere by
injected script. `secrets.get()` exists only to *refuse* with an
explanation, because a documented refusal is a design and a missing method
is an omission.

Separate capability, not a sub-case of `storage`: an app that may remember
preferences should not thereby get to keep credentials.

At rest it is sealed with the session passphrase (AES-GCM + PBKDF2, the
existing `session.mjs`). **Without a passphrase there is no sealing**, so it
holds secrets for the run and *says* they are unsealed — rather than
silently writing them out in the clear, which is the failure it exists to
stop.

### 2. Broker the ACTION, not the token — the real prize

edot does not want a GitHub token. It wants *this file committed to that
repo*. So:

```
app:    foaf.invoke('git.commit', { repo, branch, path, content, message })
shell:  secrets.use('edot', 'gh.token', (t) => fetch(…, {headers:{Authorization:`Bearer ${t}`}}))
```

The value never enters the app's frame. The capability becomes `git:write`,
scopeable to a repo. One login serves every app. Revoking is real, because
the shell holds the only copy. And it is the same move as brokering storage
instead of handing back `allow-same-origin`, or brokering story variables
instead of letting a guest write them: **hand over the outcome, never the
authority**.

This is where S3 and Solid land too. Both need a credential and a signed or
authenticated request; both become shell-side operations over a secret the
app can name but not see. The `ResourceSource` interface already in
`magpie/edot/js/resource-source.js` is the right seam — `BrokeredResourceSource`
(July 2026) proved a whole filesystem can hide behind it.

## Honest limits

- **No backend, so no refresh tokens worth the name.** PKCE public client
  is the ceiling on GitHub Pages. Access tokens expire and the user signs in
  again. A "bring your own PAT" path (what GitHub-backed saving already is)
  stays the pragmatic option, and is now storable without being readable.
- **`use()` must never accept a guest-supplied function.** That would be
  reading the secret with extra steps. Only named shell-side operations.
- **Sealed at rest needs a passphrase the user actually sets.** Today
  nothing prompts for one on the office root, so in practice secrets are
  memory-only there. That is the honest default, not a solved problem.
- **The verb side is not built yet.** `git.commit`, `s3.put`, `solid.put`
  are the next increment; `FoafSecrets` is the primitive they need.

## Verified

- `packages/foafos/test/secrets.test.js` — 12 assertions. The property under
  test is an *absence*, so most of them grep the whole observable surface
  (audit, bus, report, sealed blob) for the secret itself: it appears in
  none. Also: a failing `use` reports the error TYPE and never its message,
  because a fetch failure's message and URL routinely contain the
  credential.
- `e2e-caps` — inside a real sandboxed app: put and name succeed, `get`
  throws `FoafSecretsNotReadable`, asking the shell directly is refused
  `not-readable`, the shell can `use` the value, and the token is absent
  from the store, from disk and from the audit.
