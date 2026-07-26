---
name: edot-suite
description: >-
  Work on magpie/edot — the browser office suite, at the SUITE level: the
  kernel (Bus + Capabilities registry over BroadcastChannel), the thirteen
  apps around the editor (Data, Calendar, Files, Mail, Slides, Maps, Groups,
  Projects, Backup, Automations, Connections, Places, auth), the nine
  ResourceSource storage backends, OIDC/PKCE login, and how all of it behaves
  when sandboxed inside the foafos shell. Use this when adding or wiring an
  edot app, registering or invoking a kernel capability, adding a storage
  backend, touching auth, or running the 53-suite test harness. For the
  EDITOR's own internals (document model, io-docx/pdf/markdown, toolbar,
  commands) read magpie/edot/README.md instead — it is thorough and this file
  deliberately does not duplicate it.
---

# edot at the suite level

211 files, the largest area in this repo. `magpie/edot/README.md` (241 lines)
documents the **editor** — document model, format I/O, toolbar, commands,
sanitizer, PDF/ZIP-without-libraries — and does it well. **Read it for
anything inside `js/`.** This file covers what it does not: the suite around
the editor, and the fact that the whole thing also runs de-privileged inside
foafos.

Every claim here was checked against the code on 2026-07-26; where a number
appears, the way to re-check it is named.

## The shape: one shell, thirteen apps, one kernel

`edot.html` is the editor shell. `index.html` is the suite page. Each app is a
directory with its own HTML entry point:

```
auth/login.html   automations/  backup/   calendar/  connections/
data/data.html    files/        groups/   mail/      maps/
places/           projects/     slides/
```

They are separate pages, not a SPA. They talk through the kernel.

## The kernel — `js/edot-kernel.js`

```js
import { getKernel } from './js/edot-kernel.js';
const kernel = getKernel();                      // browser singleton, lazy

kernel.capabilities.provide(id, fn, meta)        // returns an unprovide fn
kernel.capabilities.invoke(id, payload)
kernel.capabilities.has(id) / .list()
kernel.bus.publish / .subscribe                  // BroadcastChannel('edot-kernel')
kernel.index                                     // ObjectIndex over localStorage
```

Three behaviours that will surprise you:

1. **`invoke` is local-first, then fire-and-forget.** If this page provides
   the capability, it is called directly and **its return value comes back**.
   If not, the call is *published on the bus* for a sibling tab and **returns
   `undefined` immediately** — no result, no error. It throws only when there
   is neither a local provider nor a bus. So `const x = invoke(...)` gives you
   a value in one pane and `undefined` across tabs, from identical code.
2. **A provider may live in a PAGE, not a module.** `project.snapshot` is
   registered in `index.html:239`, so Projects' snapshot-and-zip works when
   reached from the suite page and silently produces `null` anywhere else —
   the call site wraps it in `try/catch`. Before concluding a capability is
   missing, grep the HTML as well as the JS.
3. **Capability ids are a vocabulary with no schema.** Verified in use:
   `connections.activeIdentity`, `connections.capability`,
   `connections.identities`, `connections.list`, `data.addTable`,
   `editor.addData`, `groups.share`, `slides.addData`, `storage.source`.
   Nothing validates a typo — a misspelled id is a silent no-op via route (1).

### THE TRAP: there are TWO different `invoke`s

| call | registry | what it means |
|---|---|---|
| `kernel.capabilities.invoke('data.addTable', …)` | edot's own | ask another edot pane/tab to do something |
| `foaf.invoke('git.commit', …)` | **the foafos shell** | ask the SHELL to act with a credential this app cannot read |

They are unrelated systems that happen to share a verb. `git.commit` is the
second kind — `BrokeredGitSource` calls it, and it only exists when edot is
running inside foafos. See the `fink` skill for that side.

## Storage: nine backends, one interface

`js/resource-source.js` — `list / read / write / remove / stat / mkdir /
verify`, implemented by:

```
MemoryResourceSource   OpfsResourceSource     LocalFsResourceSource
GitHubResourceSource   WebDavResourceSource   SolidResourceSource
S3ResourceSource       BrokeredResourceSource BrokeredGitSource
```

- **`sigv4()` is exported and verified against AWS's published test vector**
  (`test-s3-source.mjs`). Do not hand-roll signing next to it.
- Every remote backend takes an injectable `fetchImpl`, which is why they are
  Node-testable with no network. Keep that; this environment has no egress.
- `makeAccount({ provider, identity, sources })` binds an identity to a
  provider and surfaces capabilities; an account offers a capability if the
  `PROVIDERS` catalogue declares it **or** a live adapter is wired for it.
- **`BrokeredResourceSource` and `BrokeredGitSource` are the sandboxed pair.**
  The first is a whole filesystem over the foafos store broker (because OPFS
  needs an origin and is refused in a sandboxed frame). The second is a repo
  mount with **no token in it** — reads come from a local mirror, writes go
  through `foaf.invoke('git.commit')`, so the semantics are *publish*, not
  sync, and it says so rather than pretending.

## Auth — better than its reputation

`auth/` is Authorization Code + **PKCE (S256)** via Web Crypto, never
implicit. 16+ provider presets, GitHub correctly flagged non-OIDC (no
`id_token`). An honest `auth/SECURITY.md` states plainly that it is a public
client on a static host with no backend and no client secret.

**`node magpie/edot/auth/test-auth.mjs` → 34 passing checks**, including a
full callback exchange landing an account in the shared session and
BroadcastChannel notification of sibling tabs. Every IdP interaction is
mocked through an injected `fetch`, deliberately.

Note the path: it is `auth/test-auth.mjs`. Running
`magpie/edot/test-auth.mjs` gives MODULE_NOT_FOUND, and a careless read of
that error looks exactly like "the auth tests are broken".

What is genuinely untested: a real IdP round trip (impossible here — no
egress), and the S3/Solid/GitHub `ResourceSource` classes have no suites of
their own beyond the ones named above.

## Running inside foafos (July 2026)

All four Office apps offered by the shell — edot, Data, Calendar, Files —
were migrated off the `same-origin` escape hatch. What that means for you:

- **Load `inklet/apps/app-sdk.js` FIRST** in any app HTML that should work in
  the shell, before any other script, so `localStorage` is the brokered shim
  before app code runs. It **probes** and installs only where the native API
  is unusable, so standalone pages keep their real storage.
- In a sandboxed frame **IndexedDB is refused** ("access to the Indexed
  Database API is denied in this context") and **OPFS rejects** — no origin,
  no storage bucket. Both Calendar's store and Data's SQLite blob gained
  fallbacks chosen by *trying*, not by feature-testing.
- Data gets a **4MB quota** by name (`quotas: { sheets: … }` in the shell)
  because an almost-empty SQLite file is already ~43KB base64 against a 256KB
  default. A refused write is announced, not swallowed.
- A credential must go to `foaf.secrets` (put/use, never get), **not** to
  `localStorage`. Measured before that existed: "stay signed in" put a bearer
  token in the shell's own origin, in plaintext, on disk.

## Testing

```
node magpie/edot/run-tests.mjs            # all 53 suites, one summary
node magpie/edot/run-tests.mjs data mail  # only matching suites
```

Each suite is a standalone Node script that launches headless Chromium, prints
✅/❌ and exits non-zero. Count them with `grep -c "^  \['" run-tests.mjs`.

**Serve from the repo root, not from the app folder.** `test-edot.mjs` used to
root its own server at `magpie/edot/`, which clamped `edot.html`'s legitimate
`../../inklet/apps/app-sdk.js` to `/inklet/…` and 404'd it — two unexplained
console errors that sat in that suite until 2026-07-26. Give the page the
directory layout it actually ships in.

## Honest limits

- `libreoffice-bridge.js` reports **not configured**; there is no WASM backend
  wired. That is by design and its test asserts the graceful refusal.
- `js/edot-app.js` and `js/editor-host.js` contain a duplicated
  `'Network/CORS error reaching api.github.com.'` branch — two copies of the
  same error mapping, a candidate for consolidation, not a bug.
- The suite has no bundler and no framework, on purpose. Do not introduce one.
