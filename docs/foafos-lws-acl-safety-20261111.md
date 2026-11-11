# Pod access control: no open window, no lockout, recovery (2026-11-11)

A record of the work of 2026-11-08 to 2026-11-11 on the access control of the local file storage
(LWS) and the protocols around it. Steps for the owner are in
[foafos-local-lws-auth-20261107.md](foafos-local-lws-auth-20261107.md); the stack guide is
[foafos-local-setup-20261104.md](foafos-local-setup-20261104.md).

## The rules (owner's instructions)

- All pod access goes through LWS as a named agent, and the pod's ACL decides. WebDAV only through
  `factoidal webdav-serve` with a `kind: lws`, `auth: did-key` mount (`packages/foafos/pod/pod-davmount.mjs`).
  Never `kind: local`, never a server or tool that reads a pod directory.
- Protection commitments must be explicit as theorems (owner, 2026-11-11: "theorems should try to make
  protection commitments explicit"). If a change protects future users, make it in code now.
- HTTP-over-XMPP stays deny by default and is not used for this work.
- XMPP: Factoidal's own server only; federation off.

## The protocols and where each one decides

| Protocol | Component | Decision | Proof status |
|---|---|---|---|
| LWS (HTTP) | `factoidal lws-serve --authz` | Bearer token from the storage's own authorization server (`authz-serve`), then Web Access Control over Turtle `.acl` resources (`Solid.Server.allowed`) | Lean; fail closed: `allowed_without_acl` |
| WebDAV | `factoidal webdav-serve`, `kind: lws` mount | Basic login (`--users`, no guest), then the request goes to LWS as the mount's did:key agent | Login in Lean; data access is the LWS decision |
| XMPP | `factoidal xmpp-serve` (local stack; Fly app `foafos-xmpp`) | SCRAM login; failed logins limited per account and per client (on Fly, per salted hash of the client IP from PROXY v2); every IQ reply carries `from` | Lean; `handleIq_send_has_from` and related |
| HTTP-over-XMPP (XEP-0332) | only `webdav-serve --xmpp … --xmpp-allow JID` | bare-JID allow list (`HttpOverXmpp.allowed`), then the same login as TCP | waiting limits proved; the allow list has `#guard`s and tests but **no theorem yet** |

Policy is RDF data (Turtle ACLs with the `acl:` vocabulary). Every decision is Lean code compiled to
Wasm; the JavaScript hosts only carry bytes and print notices.

## The changes

### 1. The first root ACL with no open window

Before: an existing storage made with `--insecure-no-auth` has no `/.acl`. With `--authz` it refused
everyone, so `lws-setup` served it with no authorization for about one second to PUT `/.acl`.

Now: with authorization on and a root ACL given, the open writes it as `/.acl` before any request is
answered. An existing `/.acl` is never replaced.

- factoidal-core https://github.com/danbri/factoidal-core/commit/495ef4a3c521de9c2006f08bb5cf3ecfcdd947c2
  (`formal/lean4/L4Factoidal/LWS/RootAclInstall.lean`)
- glitchcan-minigam https://github.com/danbri/glitchcan-minigam/commit/b9fe1827bbe3a3fdaaef69fc1c4d2ea418d5afc8
  (`lws-setup` uses it; refuses with an older Factoidal unless `--open-acl-window`)
- Theorems: `install_only_when_absent`, `install_keeps_existing`, `install_off_unchanged`,
  `install_no_acl_given_unchanged`, `install_has_root_acl`, `install_writes_given`,
  `install_other_paths`, `allowed_without_acl`.
- Limit: the port is bound before the open (the port sets the base IRI). Requests wait for the open,
  and authorization fails closed until the ACL is there. No test measures this.
- Behaviour change: if an owner deletes the root `/.acl`, the next start with `--root-acl`/`--owner`
  puts it back.

### 2. No lockout, recovery agent, operator reset

- factoidal-core https://github.com/danbri/factoidal-core/commit/2ae53ba2eb937ead59955ff3a5798570f9ac7b67
  (`L4Factoidal/LWS/NoLockout.lean`, `NoLockoutTheorems.lean`)
- glitchcan-minigam https://github.com/danbri/glitchcan-minigam/commit/d0421ba3f576fee04989101109c9b08c8586cc7f

**Guard.** With authorization on, a request that leaves the root ACL with no agent that has
`acl:Control` on the root gets **409 Conflict** and changes nothing. "Has Control" is the same WAC
`allowed` that every request uses (`hasRootControl_iff`). Main theorem `step_keeps_root_control`;
also `decided_served_guarded`, `lockout_iff`, `accepted_keeps_control`, `guard_refused_unchanged`.
409, not 403: this server's 403 tells the client to get another token, which is wrong here.

**Recovery agent.** `foafos-stack lws-setup` adds `<#recovery>`: `acl:Control` of the root only (no
Read, no Write, no `acl:default`). Its key is `~/.foafos-stack/lws/recovery.jwk` (0600, never printed);
`--recovery-did DID` names an existing one. `foafos-stack lws-recover KEYFILE [--new-owner]` writes the
ACL again as that agent.

**Operator reset (last resort).** `factoidal lws-acl-reset DIR FILE --operator`: only when no server
holds the directory lock; replaces only `/.acl` through the storage library and its journal; refuses an
ACL with no Control agent. Theorems `reset_has_control`, `reset_writes`, `reset_other_paths`,
`reset_refuses`; the lock refusal is the existing `DirLock.decide` theorems. Not proved: that the host
takes the lock before the open (host code).

## Tests (as reported by the implementing runs)

- `npm/factoidal/test/lws-root-acl-install.test.mjs` 2/2; `lws-no-lockout.test.mjs` 6/6;
  `test/lws-*.test.mjs` 24/24; `tests/lws/*` all pass (encryption: 1 known failure, issue 1136).
- `inklet/tools/test-foafos-stack.mjs` 26/26.
- Not tested: a PATCH, move or access grant that changes `/.acl`; `lws-recover --new-owner`;
  `lws-acl-reset` on a snapshot or encrypted storage; the browser in-page path; the Deno host.

## State and what is left

- Neither change is in a release yet (0.35.1 is latest). The owner's `~/foafos-lws` still runs with
  no authorization, on 0.33.0. After a release: stop lws and webdav, run `foafos-stack lws-setup`,
  restart on the new version, compare SHA-256 of the storage files with the copy taken before (only
  `/.acl` and its index and journal records may differ), check that status shows "no token: 401" and
  "owner signs in". Then the owner moves `recovery.jwk` offline.
- Open: a theorem that a sender not on `--xmpp-allow` is refused and nothing changes.
- Open: the tail-recursion gate's csimp sub-gate reports stale `Harness/CryptoProbe.c` IR in copied
  `.lake` directories (not from this work).
