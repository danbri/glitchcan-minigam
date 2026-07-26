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

Shipped: `packages/foafos/src/ops.mjs`.

edot does not want a GitHub token. It wants *this file committed to that
repo*. So:

```
app:    foaf.invoke('git.commit', { path, content, message })
shell:  secrets.use('edot', 'git.token', (t) => fetch(…, {headers:{Authorization:`Bearer ${t}`}}))
```

The value never enters the app's frame. The capability is `git:write`. One
login serves every app. Revoking is real, because the shell holds the only
copy. Same move as brokering storage instead of handing back
`allow-same-origin`, or brokering story variables instead of letting a guest
write them: **hand over the outcome, never the authority**.

Note what is **absent** from the app's message: a function, and a repo.

`use(appId, name, fn)` looked like the answer until you ask who supplies
`fn`. If a guest could, "use" would be `get` with extra steps. So the wire
carries a verb NAME plus data, and the shell owns the dictionary.

And the destination is not the app's to choose either:

> **THE SCOPE SUPPLIES THE DESTINATION. THE APP SUPPLIES THE DATA.**

This is the load-bearing rule, not a style preference. An op that took its
repo or host from the caller would be a signed-request-to-anywhere primitive
with a live credential attached — an app could aim a working GitHub token at
any repo that token can reach. So the grant names the repo, the branch and
an allowed path prefix; the app brings a relative path (rejected outright if
it contains `..`) and a body. `api.github.com` is hard-coded in the op.

Three ops ship: `git.commit` (Contents API), `s3.put` (SigV4, signed
shell-side), `solid.put` (LDP bearer PUT). Each declares its own capability
and its own secret name, is throttled per minute, and reports an HTTP status
but never a response body — GitHub's own 403 quotes the token back at you.

A verb with **no destination configured is refused**, which is the right
default for something that writes to a person's repo. The scope is validated
when it is set, so a typo fails then rather than at someone's first Save.

### 3. The shell collects the credential, not the app

`FoafOS.aimOp(appId, capability, scope)` needed a caller, and the obvious
place for one turned out to be a load-bearing design point rather than a
convenience. The **Publishing** panel (Apps → Make → 🔑) holds *both* halves:

- the **destination**, because an app that could choose its own repo could
  aim a working token at any repo that token reaches;
- the **credential**, because a token the app collects is a token the app has
  *held*, however briefly. Typed into the shell, it never enters the guest
  frame at all — not even on the way in. `secrets.put` is then a shell-side
  call, and the field is cleared so the value does not sit in the DOM.

Before it existed, `git:write` was granted, brokered, tested and unreachable
by a person. Tested-but-unreachable is worth saying out loud, and the previous
version of this document did; this is the fix rather than a footnote.

The first caller: `BrokeredGitSource` in `magpie/edot/js/resource-source.js`
— a repo mount with no token in it. Reads come from its local mirror (reading
a private repo needs the same credential it deliberately lacks), so the
semantics are *publish*, not sync, and it says so in the connections list
rather than pretending. A refused publish still keeps the edit locally and
reports the status, because losing someone's work to a 403 would be the worst
of both worlds.

S3 and Solid ride the same rail. Neither has a caller yet, so neither
capability is declared on any app: a vocabulary that contains names nothing
uses is how a vocabulary starts lying.

## Honest limits

- **No backend, so no refresh tokens worth the name.** PKCE public client
  is the ceiling on GitHub Pages. Access tokens expire and the user signs in
  again. A "bring your own PAT" path (what GitHub-backed saving already is)
  stays the pragmatic option, and is now storable without being readable.
- **Sealed at rest needs a passphrase the user actually sets.** Today
  nothing prompts for one on the office root, so in practice secrets are
  memory-only there. That is the honest default, not a solved problem.
- **No `git.delete`, and reads are not brokered.** `BrokeredGitSource.remove`
  clears the local mirror and says the repo copy remains; binary content is
  refused rather than mangled through a text-only verb.
- **Solid is bearer-token only, not DPoP.** A DPoP-bound token needs a proof
  signed per request with a key the shell would also have to hold — a real
  increment, not a line of config, and claiming otherwise would be exactly
  the kind of unverified stub this document is a response to.
- **`s3.put` and `solid.put` have no callers.** They are tested (including
  against AWS's published SigV4 vector) but nothing in the suite uses them,
  so no app declares those capabilities.

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
- `packages/foafos/test/ops.test.js` — 18 assertions, and roughly half are
  attempts to aim a brokered credential somewhere it was not granted: another
  repo, another host, outside the path prefix, via `..`. An ops suite that
  only proved the happy path would prove nothing worth knowing.
- `packages/foafos/test/sigv4.test.js` — AWS's published test vector. For
  signing code, "it looks like the spec" is not a standard.
- `magpie/edot/test-brokered-git.mjs` — 18 assertions on the caller,
  including two that read the class's own source back and check it never
  mentions `api.github.com` and never touches a token.
- `e2e-caps` again, for the verb side: an unaimed verb is refused and not
  even listed; once aimed, a **sandboxed app commits a file it has no
  credential for**; all four real HTTP requests (intercepted, so the shell's
  own `fetch` runs) went to the granted repo on the granted branch, despite
  the app asking for `attacker/loot` on `gh-pages`; the token is in the
  Authorization header and in no result, audit line or keyspace; and a saved
  destination does not resurrect a capability the app tree denied.
- `e2e-caps` once more for the panel, driven through real clicks — a panel
  that only works from the console is not a panel. A person aims the verb and
  types the key, the app then commits with a credential **it never handled at
  all**, the input is cleared so the value is not left in the DOM, and the
  typed key appears nowhere the app can observe.
