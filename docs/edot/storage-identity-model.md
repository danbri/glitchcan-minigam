# edot — Storage & Identity Model (folders, servers, pods, files; OS vs platforms)

The abstraction behind "where data lives and how you reach it". The suite had
**four** parallel registries with the same shape — `backup` BACKENDS
(github/s3/webdav/solid), `mail/adapters` (gmail/graph/imap/jmap), `auth/providers`
(OAuth), `places/providers` (gazetteers). This is the unifying model.

## Four orthogonal axes (don't conflate them)

1. **Identity** — *who you are*: an OAuth session, a Solid WebID, S3 keys, or
   *nothing* (local).
2. **Provider / Account** — an (authenticated) connection to a backend: "my
   GitHub", "my pod", "this device".
3. **Capability** — what an account offers. Deliberately the same word as the
   kernel's capabilities, one level up: **storage** (blobs in a namespace) or a
   typed service — **mail / calendar / chat / people / vcs**.
4. **Resources** — the things inside: Folders & Files (or Messages / Events /
   Channels / Contacts), accessed **lazily** (the recorded Mozilla-RDF-datasource
   rule — never materialise a huge listing).

## OS vs Platform (falls out of axis 1)

- **OS / local** — a provider with **no remote identity**. Access is
  **capability-granted by the OS**: a File System Access permission prompt, or
  the OPFS sandbox. "Login" is replaced by a *grant*. (`auth: 'grant'` / `'none'`.)
- **Platform** — carries its own identity (OAuth / WebID / keys / password) and
  scopes storage/services to the authenticated account.
- **Solid pod** — the maximal case: identity *and* storage *and* access-control in
  one origin (`offers: storage + people`, `auth: 'webid'`).

A **folder/file is a uniform resource** regardless of the mount underneath. What
differs is the mount, not the folder.

## Made explicit (this commit)

- **Ontology (`js/ontology.js`)** — types `Provider`, `Account`, `Identity`,
  `Storage` (a mount that `contains` Folder/File); `CAPABILITIES`
  (storage/mail/calendar/chat/people/vcs); and the **`PROVIDERS` catalogue** — the
  data-driven map of every backend with `kind` (os|platform), `auth`
  (grant/none/oauth/keys/password/webid), `offers`, and `locality`. Relations
  `offers / storedIn / authenticatedBy / hasIdentity` emit as RDF. `providersOffering(cap)`
  answers "where could I save this / get mail from".
- **Storage interface (`js/resource-source.js`)** — a `ResourceSource` is a MOUNT:
  `list(dir,{offset,limit})` (lazy window), `read/write/remove/stat/mkdir`, with
  `Entry = {name, path, kind:'folder'|'file', size?, locality?}`. `MemoryResourceSource`
  is the reference + offline/test backend (a 1000-entry folder lists by window).
  `makeAccount({provider})` surfaces `offers`, `requiresAuth`, `isLocal`, and
  `capability('storage') → ResourceSource`.

## Mapping the existing code onto the model

| Existing | Axis | Becomes |
|----------|------|---------|
| `auth/providers.js` (OAuth) | Identity | Account identities |
| `backup` BACKENDS (github/s3/webdav/solid) | storage capability | `ResourceSource` backends |
| `mail/adapters` (gmail/graph/jmap/imap) | mail capability | service adapters on an Account |
| `groups` transport (xmpp) | chat capability | service adapter |
| `places/providers` (wikidata/geonames/local) | reference data | read-only gazetteer capability |
| `collection-source.js` | resource listing | the lazy access pattern (shared discipline) |
| `projects` (.zip) | serialization | a bundle that can live in ANY storage mount |
| Data `folders` | resource org | Folders within a storage mount |

## Built so far (decisions approved)

- **OPFS is the working local backend** — `OpfsResourceSource` (in
  `resource-source.js`) implements the interface over the Origin Private File
  System: zero-prompt, persistent, no login. Real CRUD + listing, tested headless.
  (File System Access for *user-chosen* folders is the next local tier; OPFS is
  the private store.)
- **One Connections surface** — `js/connections.js` (`getConnections()`) manages
  Accounts and seeds a real local **`device`** account by default. Exposed over
  the kernel: `connections.list({capability})` and `storage.source({id})`.
- **Demonstrated end-to-end** — Projects now has **Save to device** / **Open from
  device**, writing the project `.zip` into OPFS at `/projects/…` through the
  `device` mount. Persists across reload (tested).

- **Identity axis wired (OIDC → Connections)** — `auth/js/session.js`'s
  `AuthSession` (the multi-account OIDC/PKCE sign-in store) is the concrete
  **Identity** axis. `getConnections()` lazily attaches it in a browser
  (`attachIdentities`), so signed-in identities surface via
  `connections.identities` / `connections.activeIdentity` over the kernel, and
  AuthSession's `change` events bridge onto the `connections:changed` bus topic.
  The Connections manager shows a **"Signed in"** section listing identities with
  the current user marked. Identities *back* platform accounts (an identity at a
  provider); they are not themselves capability-bearing, so they're modelled
  distinctly. Guarded/lazy: the pure-Node tests never attach a session and
  `identities()` returns `[]`.

- **Services register as Accounts** — apps now register their live backend into
  Connections so the one registry answers "where's my mail / chat / calendar?":
  - **Mail** (`setAdapter`) → a `mail:<account>` account (provider gmail/graph)
    whose `mail` capability is the live `MailAdapter`.
  - **Groups** (on connect/demo) → an `xmpp` account that is **groupware, not just
    chat**: it offers `chat + people + calendar + storage` (a MIX channel's pubsub
    nodes — "the future of MUCs"). Live `chat`/`people` adapters are wired;
    `calendar`/`storage` are declared-but-unwired until their nodes exist
    (`capabilityFor` returns `null`, honestly).
  - **Calendar** (on init) → a local `local-calendar` account (OS-tier `calendar`
    capability) exposing the live calendar/events adapter.
  An account now **offers a capability if the provider declares it OR a live
  adapter is wired for it** (`makeAccount` unions `PROVIDERS[p].offers` with the
  `sources` keys) — so a generic JMAP/IMAP/custom adapter offers its capability
  even when the provider isn't in the catalogue.

- **Cross-app sharing graph completed** — Maps and Slides join the same unified
  share graph Calendar uses: **Maps** contributes *Share places to group*
  (`groups.share`) and *Open places as data table* (`data.addTable`); **Slides**
  contributes *Share deck to group*. Every app that produces shareable content now
  reaches Groups and Data through kernel capabilities, not bespoke wiring.

- **Backup backends unified** — `backup`'s `stores/*` (github/webdav/s3/solid)
  already shared one `put/get/list/remove` blob interface; `storeResourceSource()`
  (in `resource-source.js`) bridges any such store to the `ResourceSource`
  interface (deriving folders from `/` in keys). A configured backend that
  successfully lists registers itself in Connections (`backup-<id>`), so the same
  GitHub/WebDAV/S3/Solid storage Projects-or-a-file-dialog can now reach is the
  backup target — one storage layer, not two.

Done since: **File System Access** `local-fs` tier (real user-chosen folders);
the **Connections management UI** (`connections/`, now also showing signed-in
identities); the **mail/calendar/chat services wrapped as `Account.capability(name)`**
so the one Connections surface manages GitHub-as-storage, Gmail-as-mail and
XMPP-as-groupware uniformly; and the **OIDC identity axis** feeding Connections.

- **GitHub is a real remote mount** — `GitHubResourceSource` (in
  `resource-source.js`) implements the full `ResourceSource` interface over the
  CORS-enabled GitHub Contents API: arbitrary paths and directories (not the
  backup store's flattened `edot-backups/<id>.enc` blobs), base64 content,
  sha-on-overwrite, branch refs, `verify()` probe. The Connections "Add" picker
  connects it for real (repo + token, live-verified) and registers it, so the
  editor's **Save to… → GitHub** and the Files browser write through the same one
  interface. `test-github-source.mjs` proves write/read/list/stat/remove +
  request shaping against a fake Contents API; `test-connections-ui.mjs` proves
  the connect-then-write-then-read path end to end. (A document's "open a pull
  request" remains a separate, GitHub-specific editor action — a PR is richer
  than a blob write.)

Remaining (incremental): route a generic file open/save dialog through
`connections` for the *other* apps (the editor's Save to… already does; the Files
app is the browser); wire the remaining remotes (S3/WebDAV/Solid/oauth) the way
GitHub is now wired; implement the MIX `calendar`/`storage` pubsub nodes so the
Groups account's declared capabilities become live adapters. (Live round-trips
for the remote backends and live XMPP federation need real credentials/a server,
so they're verified at the request-shaping/crypto level — GitHub against a fake
Contents API, the store bridge with a fake store, SCRAM against the RFC 5802
vector; real network round-trips are not CI-checked, by the standing headless
rule.)

## Open design choices (for decision before the big build)

These are the calls to make before unifying the real backends onto `ResourceSource`:

1. **Local files** — adopt the **File System Access API** (read/write real folders,
   with permission grants) as the `local-fs` backend, with **OPFS** as the
   zero-prompt private store? (Both already modelled as `kind:'os'`.)
2. **Canonical remote model** — treat **Solid/LDP** containers as the reference
   remote shape (it's the most complete: storage + identity + ACL), and map
   github/s3/webdav onto the same `ResourceSource` interface?
3. **Unify now or incrementally** — refactor `backup` backends + `projects`
   save/open + a future file-open/save dialog onto `ResourceSource` in one pass,
   or adapter-by-adapter? (The interface + memory backend exist and are tested; the
   real backends are the remaining work.)
4. **Storage vs services** — keep them as one `Account.capability(name)` surface
   (storage returns a ResourceSource; mail returns a MailAdapter), so a single
   "Connections" UI manages GitHub-as-storage and Gmail-as-mail uniformly?

Tests: `test-resource-source.mjs` (lazy listing, CRUD, Account/provider model),
ontology additions in `test-ontology.mjs`, `docs/edot/ontology.ttl` regenerated
with the provider individuals.
