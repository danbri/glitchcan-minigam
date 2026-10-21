# foafos: identity, storage, backup and portability through LWS (design note, 2026-10-21)

Owner, 2026-10-21, verbatim: "Unlike miniapps foafos doesn't depend on superapps; it is for
better or worse browser-based, so interop issues around web views can go away. It consequently
needs a stronger story around auth/id, cloud, backups, data portability. Perhaps the Factoidal
LWS implementation helps there."

This note records what exists in both repositories, what fits, what is missing, and a staged
plan. Repositories as read: glitchcan-minigam `master` at 7d92a675; factoidal-core `main` at
3ee7148. Related: `magpie/miniapps/README.md` (the MiniApp runner).

## 1. What a super app gives a MiniApp, and what foafos must get elsewhere

A WeChat or Alipay MiniApp gets these from its host app:
- an account (the host's login)
- cloud storage (the vendor's cloud)
- a device-independent home for its data
- payment

The W3C MiniApp drafts left all four out of scope. foafos runs in an ordinary browser, so
WebView interop is not a problem for it. The browser gives it a runtime and one origin's
local storage, and nothing more. foafos must therefore get the other parts from open
protocols:
- identity: who the user is, and which app acts for them
- storage that is not tied to one browser profile
- backup and restore
- export in open formats
- the same data on more than one device

## 2. What glitchcan has today

- **Identity.**
  - edot has OpenID Connect with PKCE for 16 providers (`magpie/edot/auth/js/`). Every
    `clientId` is empty (`auth/auth-config.js:54-64`), so no provider works on the live
    site. ID-token signatures are not checked: `verifyIdTokenSignature` is a stub
    (`oidc.js:293`, `auth/SECURITY.md:58-79`). There are no refresh tokens, and logout is
    local only.
  - foafos itself has only a device-local session with a profile that the user types in
    (`packages/foafos/src/session.mjs:9-30`), sealed by a passphrase.
  - There is no WebID, Solid-OIDC or DPoP; only a seam (`resource-source.js:550-558`).
- **Storage.**
  - `FoafStore` writes plaintext JSON to `localStorage` in the shell origin, 256 KB per app
    (`store.mjs`). Its backend interface is `{read(ns), write(ns, obj)}`, and the header
    says "local now, cloud later". No cloud backend exists.
  - edot has 9 `ResourceSource` backends (memory, OPFS, brokered, brokered git, local
    folder, GitHub, WebDAV, Solid, S3) in `magpie/edot/js/resource-source.js`. Its Solid
    backend lists containers with a regex over Turtle, not an RDF parser, and sends no
    ETag or If-Match.
  - The brokered verbs `solid.put` and `s3.put` exist (`ops.mjs:324-415`), but nothing calls
    them.
- **Backup.**
  - The edot Backup app writes an encrypted snapshot of 7 IndexedDB databases (envelope
    `EDOTBK01`, AES-GCM-256, PBKDF2 210k) to GitHub, S3, WebDAV or Solid.
  - It does not cover `localStorage` data (FoafStore namespaces, the Files tree). It is not
    offered inside foafos, where IndexedDB is refused to sandboxed apps.
  - Nothing exports a whole foafos shell.
- **Portability.** Several export formats exist:
  - edot projects as a ZIP of HTML, CSV, JSON, GeoJSON and ICS
  - Data app tables as SQLite, CSV or N-Quads
  - the entity model as Turtle (`js/ontology.js`)
- **Sync.** None between devices. Cross-tab only (BroadcastChannel).

## 3. What Factoidal has (factoidal-core, `skills/lws-solid/SKILL.md`)

- **Protocols.**
  - LWS Protocol 1.0 core: the editor's draft of 2026-10-19, which is also the W3C Working
    Draft of that date (https://www.w3.org/TR/lws10-core/).
  - Solid Protocol 0.11.0, as a refinement of the same store.
  - All protocol decisions are made in Lean 4 (`formal/lean4/L4Factoidal/LWS/`, `Solid/`),
    compiled to wasm. The JS hosts only move bytes.
- **Conformance.** Touchstone, the LWS harness of another implementer (221 tests), latest
  run: open configuration 75 pass, 0 fail, 146 inapplicable; with authorization 152 pass,
  0 fail, 69 inapplicable (`docs/designissues/2026-10-21-lws-touchstone-run.md:360-363`).
  The largest inapplicable groups are:
  - type index and search (issue 912, 40 tests)
  - access requests and grants (issue 913, about 27 tests)
- **Authorization.**
  - Bearer JWTs (ES256, RS256 and EdDSA through HACL*), checked for `iss`, `aud`, `exp`,
    `nbf` and `iat`.
  - Issuer discovery through `/.well-known/lws-configuration`.
  - Web Access Control on `.acl` resources, with the token's `sub` as the agent.
  - The Solid server also checks Solid-OIDC with DPoP.
  - Out of scope: token issuance (no authorization server of its own), ACP, and the LWS
    authentication-suite drafts.
- **Formats.**
  - Containers as `application/lws+json`, JSON-LD or Turtle.
  - Linksets for metadata, JSON Patch, and `application/problem+json` errors.
  - Data resources byte for byte.
  - The `lwsSnapshot` op dumps a whole storage as one JSON document (`lws-snapshot-2`), and
    `lwsOpen` can load one. That is a backup and restore format, but there is no HTTP
    endpoint for it.
- **Notifications.** Webhooks only (signed AS2 activities). A browser cannot receive a
  webhook.
- **Where it runs.**
  - The shipped hosts (`lws/server.mjs`, `solid/server`, `solid/client`) import `node:fs`
    through `store-host/index.mjs:75`, so they do not load in a browser.
  - The wasm itself has no such dependency. `openLwsStorage` is a socket-free
    `step(request)` loop (`lws/server.mjs:211-361`), so a browser or Service Worker host is
    about 100 lines. Nobody has written or tested one.
  - The whole storage is in memory, with a JSON snapshot file after each change.
    Shardborough persistence has not started.
- **Package.**
  - `@factoidal/core` 0.11.0 is published, Apache-2.0, 13.1 MB unpacked; the wasm alone is
    12.4 MB. It has the LWS and Solid ops.
  - Notifications, moves, paging and the Touchstone repairs are only in the unreleased 0.12.0.
  - glitchcan still depends on 0.7.1, which has no LWS.
- **Client.** The client (`createSolidClient`) speaks Solid, not LWS. It has no ETag,
  linkset, JSON Patch or paging support, its bodies are text only, and it sends no
  `Authorization` (pass in an authenticated `fetch`).

## 4. How LWS fits foafos

LWS separates three parties: the storage, the authorization server, and the client (the app
acting for a person). foafos already separates the same parties inside the browser: the
shell holds credentials, apps hold capabilities, and brokers act at the time of use. The fit
per concern:

| Concern | With LWS | foafos change | Factoidal change |
|---|---|---|---|
| Per-app storage | A container per app, for example `<storage>/apps/<app_id>/`. Values are JSON resources with ETags; writes use `If-Match`. | A `FoafStore` backend that reads and writes the container. The shell holds the token; apps keep `storage.get/set` and never see a credential. | none |
| MiniApp packages | `.ma` files stored as data resources; `registry.json` becomes a container listing | `registry.json` lookup becomes an LWS GET | none |
| Identity | LWS authn-openid: an OIDC ID token is the credential (`sub`, `iss`, `azp`); `sub` dereferences to a controlled identifier document. Token exchange (RFC 8693) at the storage's authorization server gives a bearer JWT that lives 300 s or less. | Fix ID-token signature checks (JWKS). Publish a client identifier document for foafos at a fixed URL on Pages. Add the token exchange step. | An authorization server that does the token exchange. None exists in Factoidal, and it is out of scope today. |
| Permissions | WAC on the app's container. Cross-app access by LWS access grants. | `req_permissions` and AppTree grants decide which container a node may reach | Access grants (issue 913) |
| Backup | The whole storage is one `lws-snapshot-2` document, or a copy of the containers to a second storage | A "Back up" action: snapshot, encrypt with the existing `EDOTBK01` envelope, write to a second storage or download | An HTTP or op route to export and import a snapshot of one container subtree |
| Portability | The data stays in the user's storage, not in the app. Listings are RDF; Factoidal parses and queries them. | Apps write open formats (JSON, CSV, Turtle, N-Quads) to their container | none |
| Devices | One storage reached from each device. ETags give optimistic concurrency. | Conflict handling on 412 | A browser-reachable change channel (WebSocket or SSE). Webhooks cannot reach a browser. |
| Offline | A local LWS storage in a Service Worker, with the same HTTP surface as the remote one | Apps always talk LWS. The Service Worker is the local copy; a remote storage is for sync and backup. | A browser-safe host for the wasm, with no `node:fs` import |

The Service Worker row matters most. With it, every foafos app uses one storage interface,
whether it is offline or online, and "where is my data" has one answer: an LWS storage,
first on this device, then wherever the user points it. Its cost is the 12.4 MB wasm, which
the Service Worker would load once and cache.

## 5. Staged plan

1. **FoafStore LWS backend, tested against a real server.** Run `factoidal lws-serve`
   (0.11.0) in Node in the test. Store one app's namespace as JSON resources with
   `If-Match`. Test the 412 path. No identity yet (`--insecure-no-auth` in the test only).
   This needs no Factoidal change.
2. **Browser host for the Factoidal LWS engine.** A `step(request)` loop over
   `lwsOpen`/`lwsStep`/`lwsSnapshot` with no `node:fs` import, run in a Service Worker. This
   belongs in factoidal-core (`npm/factoidal/lws/browser.mjs`), with a browser test. foafos
   then uses `https://<pages>/…/lws/` paths that the Service Worker answers.
3. **Identity.**
   - Fix the edot JWKS check.
   - Publish a foafos client identifier document on Pages.
   - Add the LWS authn-openid credential and token exchange.
   - Decide who runs the authorization server (section 6, question 2).
4. **Backup and export.** Snapshot the local storage, encrypt it, and write it to a second
   storage or download it. Restore from the same file. Then add an export of each app
   container as a ZIP, with RDF listings.
5. **MiniApps.** `system.permission.STORAGE` grants the app's container. Packages live in
   the storage. Access to another app's data waits for LWS access grants (issue 913).

## 6. Questions for the owner

1. Is an LWS storage the single home for foafos app data: local in a Service Worker first,
   remote by the user's choice?
2. Who runs the remote storage and its authorization server? Options:
   - `factoidal lws-serve` on fly.io. `docs/foafos-notes.md` lists a fly.io service as
     "deliberately not yet".
   - The user's own server.
   - A third-party LWS server.
3. Should the LWS client and the browser host be written in Lean in factoidal-core (the
   direction "do it clean in Lean"), with foafos as the first user? Or in JS in foafos
   first?

## Update, 2026-10-21 (later): a home pod over XMPP, measured

Owner, verbatim: "Can we do this and wire up comms to the LWS over an xmpp binding? Is that
just wanky and needless? Could it be a pod at home?"

A prototype is in `magpie/miniapps/lws/`: one Factoidal LWS storage served over HTTP and over
XEP-0332 through an XMPP relay. The browser client uses RFC 7395 and SCRAM, and FoafStore runs
over LWS with ETag merge. The end-to-end test passes 15 of 15. The verdict, the measurements
and the costs are in `magpie/miniapps/lws/README.md`.

## Sources

- LWS publications: https://www.w3.org/groups/wg/lws/publications/
  - Core: https://www.w3.org/TR/lws10-core/ (Working Draft, 2026-10-19)
  - OpenID Connect suite: https://www.w3.org/TR/lws10-authn-openid/ (Working Draft, 2026-10-15)
  - Controlled Identifiers suite: https://www.w3.org/TR/lws10-authn-ssi-cid/ (Working Draft, 2026-10-15)
- factoidal-core files:
  - `skills/lws-solid/SKILL.md`
  - `docs/designissues/2026-10-21-lws-overview.md`
  - `docs/designissues/2026-10-21-lws-touchstone-run.md`
  - `docs/lws-solid-conformance.md`
  - `npm/factoidal/lws/server.mjs`
  - `npm/factoidal/solid/client/index.mjs`
- glitchcan files:
  - `docs/foafos-secrets-and-auth-20260726.md`
  - `magpie/edot/ENCRYPTED-BACKUP.md`
  - `packages/foafos/src/{store,ops,secrets,session}.mjs`
  - `magpie/edot/js/resource-source.js`
