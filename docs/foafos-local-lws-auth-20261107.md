# The local file storage asks who you are (2026-11-07)

Owner request, 2026-11-07, answer to "change foafos-stack's local LWS to --authz with an ACL?":
"yeah obviously." The local storage must not be an open store that any program on the laptop can
read and write.

Before this change, `foafos-stack` ran `factoidal lws-serve ~/foafos-lws --insecure-no-auth`, and
the Finder folders (`webdav-serve`) let anyone in as Guest. Now:

| Part | Before | Now |
| --- | --- | --- |
| `lws` (port 3000) | `--insecure-no-auth` | `--authz ~/.foafos-stack/lws/authz --allow-http --root-acl ~/.foafos-stack/lws/root.acl`: its own authorization server on the same port; every request needs a token for a `did:key` agent that the ACL names |
| `webdav` (port 8090) | mount `auth: none`, `--guest guest` | mount `kind: lws`, `auth: did-key`, `key-file: ~/.foafos-stack/lws/webdav.jwk` (that agent may only read), `--users ~/.foafos-stack/webdav-users`, no `--guest`: no login gives 401 |
| the shell | plain `fetch`, no sign-in | its own `did:key` agent for that pod (`auth: 'did-key'`), let in by `foafos-stack lws-allow` |

The rule is the one in `packages/foafos/pod/pod-davmount.mjs` (commit 5a917ab7): **every access to
the storage goes through LWS as a named agent, and the storage's ACL decides.** Nothing serves or
mounts the storage by reading its directory. There is no `kind: local` mount.

## Who is who

| Agent | Key | Rights in the root ACL | Used by |
| --- | --- | --- | --- |
| owner | `~/.foafos-stack/lws/owner.jwk` (0600) | Read, Write, Control | `foafos-stack` only: `lws-allow`, `lws-revoke`, and the `owner signs in` check of `status` |
| webdav | `~/.foafos-stack/lws/webdav.jwk` (0600) | Read | `webdav-serve` (the Finder folders). It cannot write and cannot read `.acl` (that needs Control) |
| a browser | in that browser's FoafSecrets, never shown | Read, Write (or Read with `--read-only`) | the Foafos shell, after `foafos-stack lws-allow DID` |
| recovery | `~/.foafos-stack/lws/recovery.jwk` (0600) when `lws-setup` made it: **move it offline**; or none here, with `--recovery-did DID` | Control of the root only (`acl:accessTo <./>`, no `acl:default`, no Read, no Write) | `foafos-stack lws-recover KEYFILE`: it may rewrite `/.acl` and read or write nothing else |

A `did:key` is public: it is the agent's name, made from its public key. A `.jwk` file is a
private key: never share it, never print it. `~/.foafos-stack/lws/agents.json` holds the names (no
keys). `~/.foafos-stack/lws/root.acl` is the ACL that `foafos-stack` last wrote to the storage.

The ACL uses relative IRIs (`<./>`, `<#owner>`), so it does not depend on the port.

## How the shell signs in

- A pod record may say `auth: 'did-key'` (`packages/foafos/src/pods.mjs`, `checkPod`). The "This
  computer" button of System, Pods adds the local storage that way. A saved pod record for
  `http://127.0.0.1:3000/` or `http://localhost:3000/` with no sign-in is changed to `did-key` when
  the shell starts.
- On the first connect, the shell asks the Factoidal engine for a new P-256 `did:key`
  (`createDidKey` of `@factoidal/core/lws/client`) and keeps it in FoafSecrets as the secret
  `pod.<id>.agent` of `foafos.pods`. The record keeps only the public `did:key` (`agent`).
- Each connect opens a Factoidal LWS client with `selfIssued: { subject, keyId, jwk }`. The client
  reads the storage's 401, finds its authorization server, and exchanges a self-signed JWT for an
  access token. `packages/foafos/src/lws-agent.mjs` (`lwsAgentFetch`) carries that token on the
  ordinary requests of FoafPods, and gets a new one after a 401.
- The storage refuses an agent that is not in the ACL (403). The pod then shows "Needs your OK",
  the `did:key`, and the command to run: `foafos-stack lws-allow did:key:…`. After that,
  Connect works.

Apps see none of this. They still get `pod.get`, `pod.put`, `pod.list` and `pod.delete` in their
own folder, as before.

## The owner's steps, once

```sh
foafos-stack stop webdav lws      # if they run
foafos-stack lws-setup            # keys, the ACL, a copy of ~/foafos-lws, its ACL, a WebDAV password
foafos-stack start
```

Then in Foafos: System, Pods, "This computer" (or Connect on the pod). The card shows
`foafos-stack lws-allow did:key:…`. Run it in a terminal, then press Connect. Set a session
passphrase in Foafos to keep the key over a reload (see Limits).

Finder: Go, Connect to Server, `http://127.0.0.1:8090/`, Registered User, user `me` and the WebDAV
password that `lws-setup` asked for. More logins: `factoidal webdav-user ~/.foafos-stack/webdav-users NAME`.

Other commands: `foafos-stack lws-revoke DID`, `foafos-stack lws-agents` (names and rights, no keys).

## Migration of `~/foafos-lws` (a storage made with no authorization)

Measured with `@factoidal/core` 0.33.0 on temporary storages, 2026-11-07:

1. `--root-acl` gives an ACL only to a **new** storage. The engine uses it only when there is no
   saved storage (`formal/lean4/Wasm/Ops/Lws.lean`, `oc.snapshot.getD (initialStorage oc.now oc.rootAcl)`).
   On an existing storage it is ignored.
2. A storage made with `--insecure-no-auth` has no `.acl` (`GET /.acl` gives 404). Opened with
   `--authz`, it refuses every agent with 403, its owner too. The data is not lost, but no agent can reach it.
3. One `PUT /.acl` through LWS, with authorization still off, then a start with `--authz`: the owner
   reads the old data (200), a stranger gets 403, no token gets 401.

Before 2026-11-11, `foafos-stack lws-setup` did step 3 itself: it started
`factoidal lws-serve ~/foafos-lws --insecure-no-auth --host 127.0.0.1 --port 0 --no-cors` for about one
second and PUT `/.acl`. For that second any program on this computer could read and write the whole
storage. That window is now gone.

### Since 2026-11-11: the first ACL is installed with authorization on

`@factoidal/core` (factoidal-core commit 495ef4a3c, https://github.com/danbri/factoidal-core/commit/495ef4a3c521de9c2006f08bb5cf3ecfcdd947c2 ; not yet in a release: 0.35.1 does not have it) installs `--root-acl`
(or the `--owner` ACL) into an EXISTING storage that has no `/.acl`, at start, before it answers any
request. It never replaces an existing `/.acl`, and it changes no other resource. A line on standard
error says which: `root ACL: this storage had no root ACL resource (/.acl); the given root ACL is now
/.acl`, or `root ACL: this storage has a root ACL resource (/.acl); it is kept, and the given root ACL
is not used`. With `--insecure-no-auth` nothing is installed. The decision is in Lean
(`formal/lean4/L4Factoidal/LWS/RootAclInstall.lean` in danbri/factoidal-core), with theorems:
`install_only_when_absent`, `install_keeps_existing`, `install_has_root_acl`, `install_writes_given`,
`install_other_paths`, `install_off_unchanged`, and `allowed_without_acl` (with no ACL resource, Web
Access Control allows no agent anything: fail closed, unchanged).

So `foafos-stack lws-setup`, for a storage that already holds data (it has `lws-files.json`,
`lws-journal` or `lws-state.json`):

- refuses while `lws` runs (the storage's lock refuses a second server anyway);
- asks the installed factoidal whether it installs a root ACL at start: it opens a scratch storage in
  a temporary folder through `openLwsStorage` (in the tool's own process, no socket), once with no
  authorization and once with a root ACL, and looks for the `root ACL:` notice;
- copies the storage directory to `~/foafos-lws.before-acl-YYYYMMDDTHHMM` (`cp -Rp`) first;
- starts `factoidal lws-serve ~/foafos-lws --authz ~/.foafos-stack/lws/authz --allow-http --root-acl FILE
  --host 127.0.0.1 --port 0 --storage files --no-cors` (authorization on from the first moment, a
  random port, no CORS), reads `/.acl` back as the owner's did:key agent, and stops it.

If the storage already has an ACL that foafos-stack did not write, factoidal keeps it; the owner
cannot read it (403) or it differs, so `lws-setup` stops, records nothing, and says so. The options
then: add the owner `did:key` (from `foafos-stack lws-agents`) with Control to that ACL yourself and
copy it to `~/.foafos-stack/lws/root.acl`, or set `FOAFOS_LWS_DIR` to a new storage.

With an OLDER factoidal, `lws-setup` refuses, changes nothing, and says to update
(`npm i -g @factoidal/core`). Only `foafos-stack lws-setup --open-acl-window` still runs the old
way (the second with no authorization, described above), and it says so when it does. There is no
silent fallback.

The test `a storage made with no authorization gets its ACL through LWS, and keeps its data`
(`inklet/tools/test-foafos-stack.mjs`) runs this on a temporary storage, as does the case of a
storage with an ACL of its own. With an older factoidal it checks the refusal, then
`--open-acl-window`. Measured 2026-11-11: with the factoidal of commit 495ef4a3c on `PATH`, all 24
tests pass (`PATH=<dir with that factoidal>:$PATH node --test inklet/tools/test-foafos-stack.mjs`);
with the installed 0.35.1, the migration test passes through the refusal and `--open-acl-window`.
Until a release carries the change, `lws-setup` on the owner's machine refuses for an existing
storage with no ACL (or needs `--open-acl-window`).

## Lockout and recovery (2026-11-11)

Owner request, 2026-11-11: LWS pods must never be lost by an ACL lockout. Three parts, the owner said
yes to all three.

### 1. The storage refuses a lockout (factoidal-core)

With authorization on, `lws-serve` refuses with **409 Conflict** every request that changes the root
ACL resource `/.acl` and leaves it with no agent that has `acl:Control` on the storage root: a PUT
or PATCH of `/.acl` that drops the last Control agent, a DELETE of `/.acl`, and anything else that
would change it (a move, an access grant). A refused request changes nothing. A write that keeps a
Control agent, or swaps the owner for another Control agent, is accepted as before. With
`--insecure-no-auth` the guard does not apply.

The decision is Lean (`formal/lean4/L4Factoidal/LWS/NoLockout.lean` and `NoLockoutTheorems.lean` in
danbri/factoidal-core). "Some agent has acl:Control on the root" means what Web Access Control's
`allowed` decides for every request; the theorem `step_keeps_root_control` says: for every request
handled with authorization on, if before it some agent has acl:Control on the root, then after it
some agent has. Commit: https://github.com/danbri/factoidal-core/commit/2ae53ba2eb937ead59955ff3a5798570f9ac7b67 (not yet in a release: 0.35.1 does not have it).

409 and not 403: the requester was allowed the request (it has Control); the request is refused for
the state it would leave. A 403 from this storage carries `error="insufficient_scope"`, which tells a
client to get another token, and that is the wrong advice here.

### 2. The recovery agent (foafos-stack)

`foafos-stack lws-setup` names a second agent in the root ACL, the recovery agent:

```turtle
<#recovery> a acl:Authorization ;
  acl:agent <did:key:z…> ;
  acl:accessTo <./> ;
  acl:mode acl:Control .
```

Control of the root only: it may read and rewrite `/.acl`, and nothing else (no `acl:default`, so it
inherits nothing below the root; no Read, no Write: data and the root listing give it 403). Its key is
made once, as `~/.foafos-stack/lws/recovery.jwk` (0600), and never printed. **Move that file offline**
(a USB stick, a password manager) and delete it here. To use a recovery agent that you have already,
give `foafos-stack lws-setup --recovery-did did:key:…`: then no key file is made.

A storage set up before 2026-11-11 gets its recovery agent from `foafos-stack lws-setup` run again,
with `lws` running: the tool writes the new ACL through LWS as the owner.

How to recover, in order:

1. **With the recovery key** (the storage running): bring the key file back, then
   `foafos-stack lws-recover /path/to/recovery.jwk`. It writes the ACL this tool keeps for
   `agents.json` (`~/.foafos-stack/lws/root.acl`) to `/.acl`, as the recovery agent. After a lost
   owner key: move `~/.foafos-stack/lws/owner.jwk` away (if it is there), then
   `foafos-stack lws-recover /path/to/recovery.jwk --new-owner`: a new owner key is made and the ACL
   names it. For a recovery agent given with `--recovery-did`, add `--did DID` and use that agent's key.
   Then put the recovery key offline again.
2. **The last resort, offline** (no key works any more): stop the storage
   (`foafos-stack stop webdav lws`), write a root ACL that gives your owner `did:key` acl:Control
   (`foafos-stack lws-agents` shows the names; `~/.foafos-stack/lws/root.acl` is the last one this
   tool wrote), then

   ```sh
   factoidal lws-acl-reset ~/foafos-lws ~/.foafos-stack/lws/root.acl --operator
   ```

   It takes the storage directory lock (it refuses while a server holds it), opens the storage through
   the storage library (the same engine code as `lws-serve`; no other reader of the storage files),
   replaces only `/.acl` through the storage journal, and prints a notice. It refuses a root ACL that
   gives no agent acl:Control on the root, and a directory with no storage. The ACL of foafos-stack
   uses relative IRIs (`<./>`), so no `--base` is needed. Then `foafos-stack start`.

### Tests

`inklet/tools/test-foafos-stack.mjs`: `lws-setup` makes `recovery.jwk` (0600), names the agent and
the file, never prints the key, and the ACL gives it Control of the root only; the recovery agent
reads `/.acl` (200), cannot read data or the root (403) or write (403); `lws-recover` with its key
rewrites the ACL and the owner keeps its access; another key is refused and the command names
`lws-acl-reset`; `--recovery-did` names the agent and makes no key. Part 1 and the operator command
are tested in factoidal-core (`npm/factoidal/test/lws-no-lockout.test.mjs`).

## No authorization: only on purpose, and loudly

`FOAFOS_LWS_INSECURE_NO_AUTH=yes-anyone-on-this-computer-may-write` runs the storage with
`--insecure-no-auth` again. No other value does. Then `start` prints a warning, `status` lists
it under "Worth knowing", and `doctor` fails. The old `FOAFOS_LWS_AUTH` is no longer read: when it
is set, `start lws` refuses and says so.

## Checks

`foafos-stack status` checks, for `lws`: `needs a token` (a request with no token gets 401) and
`owner signs in` (the owner's agent gets a token and is let in). For `webdav`: `login required`
(no login gets 401) and `read only`.

Tests:

- `inklet/tools/test-foafos-stack.mjs`: lws-setup (keys 0600, folder 0700, no key printed), the
  storage (no token 401; a browser agent 403 until `lws-allow`, then write, read, list; no `.acl`
  for it), the webdav agent (reads; write 403; `.acl` 403), a stranger 403, WebDAV (no login 401;
  the login reads; PUT 403; no `.acl`), revoke, an ACL changed elsewhere is not overwritten,
  migration, the opt-in.
- `packages/foafos/test/lws-agent.test.js`: `lwsAgentFetch` against a real `lws-serve --authz`.
  It pins the client session shape that `lws-agent.mjs` reads.
- `packages/foafos/test/pods.test.js`: the `did-key` pod in FoafPods (key made once, grant asked
  by `did:key`, locked key waits, REMOVE forgets the key, no key in events or the list).
- `inklet/finkapp/test/e2e-local-lws-auth.mjs`: the shell in a headless browser, against
  `foafos-stack lws-setup` and `start lws` on a private state folder.

## Limits

- **The browser key is extractable.** The Factoidal engine signs the JWT itself, from the JWK, so
  the key cannot be a non-extractable WebCrypto key. It is a FoafSecrets secret: apps cannot read
  it, and it is not in a log, an event or the pod list. But code that runs in the shell's own
  origin can read it.
- **Without a session passphrase the key lasts one run.** FoafSecrets writes a secret to disk only
  sealed with the passphrase. With no passphrase, a reload makes a new `did:key`, which must be let in
  again (`lws-allow`; `lws-revoke` the old one). With a passphrase the key is sealed in the browser
  and opens with UNLOCK.
- **The token comes from Factoidal's session document** (`tokens[].root`, `tokens[].token`). It is
  not a published API. `lws-agent.test.js` fails if it changes.
- **`--allow-http`**: the authorization server accepts `http://` identifiers, because the storage is
  on `http://127.0.0.1`. That is acceptable only on loopback.
- **The owner key is on disk** (0600, in a 0700 folder). Anyone who can read your home folder can
  read it, and the storage's own files. No ACL protects against file system access. Encryption at
  rest (`factoidal lws-keygen`, `FACTOIDAL_LWS_KEY`) is still off.
- **`lws-setup` runs the storage with no authorization for about one second**, on a random loopback
  port with no CORS, to write the first ACL of an existing storage. It does this once.
- **The recovery key is on disk until you move it.** `lws-setup` makes it in `~/.foafos-stack/lws/`
  and says to move it offline; the tool cannot check that you did.
- **One agent per browser profile and pod.** Several browsers each get their own `did:key` and
  their own `lws-allow`.
- **WebDAV is read only** (Factoidal issue 1147), whatever the ACL says.
- `inklet/finkapp/test/e2e-goal.mjs` adds `http://127.0.0.1:3000/` with no sign-in. Against the
  new storage it will need `auth: 'did-key'` and an `lws-allow`. It was not changed or run here
  (it needs the owner's go).
