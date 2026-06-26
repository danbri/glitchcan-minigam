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

- **Backup backends unified** — `backup`'s `stores/*` (github/webdav/s3/solid)
  already shared one `put/get/list/remove` blob interface; `storeResourceSource()`
  (in `resource-source.js`) bridges any such store to the `ResourceSource`
  interface (deriving folders from `/` in keys). A configured backend that
  successfully lists registers itself in Connections (`backup-<id>`), so the same
  GitHub/WebDAV/S3/Solid storage Projects-or-a-file-dialog can now reach is the
  backup target — one storage layer, not two.

Remaining (incremental): add **File System Access** as the `local-fs` tier
(real user-chosen folders); a **Connections management UI**; route a generic file
open/save dialog through `connections`; wrap the mail/calendar/chat services as
`Account.capability(name)` so the same Connections surface manages services too.
(Live round-trips for the remote storage backends need credentials, so they're
verified at the request-shaping level — the bridge is proven with a fake store;
real network round-trips are not CI-checked, by the standing headless rule.)

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
