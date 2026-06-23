# edot — encrypted backup & restore (Tier 1) · **ALPHA**

Client-side, passphrase-encrypted backup and restore of your local edot data
(IndexedDB) to a pluggable storage backend: **GitHub · S3 · WebDAV · Solid**.

> ⚠️ **ALPHA — experimental.** Verify your backups before relying on them.
> Encryption is end-to-end with **your passphrase only**. There is **no
> recovery** in Tier 1: **lose the passphrase = lose the data.**

This implements **Tier 1** of [`../ENCRYPTED-BACKUP.md`](../ENCRYPTED-BACKUP.md)
(passphrase envelope encryption). Tier 2 (the OIDC-gated key service that makes
decryption *conditional on a login*) needs a backend and is **out of scope**
here — the code leaves clearly-marked hooks for it (see *Tier-2 hooks* below).

Open `backup.html` (served over https or localhost — Web Crypto needs a secure
context). No build step, no runtime CDN dependencies: Web Crypto + `fetch` only.

## How it works (the envelope)

```
snapshot  = serialise(chosen IndexedDB databases)     // snapshot.js
DEK       = random AES-GCM-256                          // data key
ciphertext= AES-GCM(DEK, iv, snapshot)                 // GCM tag = integrity
KEK       = PBKDF2(passphrase, salt, 210k, SHA-256)    // crypto.js
wrappedDEK= AES-GCM(KEK, iv, DEK)                       // passphrase wraps the key
envelope  = magic + JSON header + ciphertext           // self-describing, versioned
```

The header is `{ v, kdf, salt, iv, wrappedDEK, cipherIv, sha256OfPlaintext,
createdAt }`. `sha256OfPlaintext` is the OPENDOC fingerprint gesture — a restore
re-hashes the recovered bytes and refuses a mismatch. A wrong passphrase fails
at DEK-unwrap; a tampered ciphertext fails the GCM tag — both surface as clear
errors, never silent corruption.

## Files

| File | Purpose |
|---|---|
| `js/crypto.js` | Tier-1 envelope: PBKDF2 KEK, AES-GCM DEK wrap, versioned header, SHA-256 fingerprint. The `deriveKek()` seam is where Tier-2 folds in `S_user`. |
| `js/snapshot.js` | Collect/restore IndexedDB databases into one blob + manifest. DB/store list is configurable (`DEFAULT_DATABASES`). |
| `js/stores/github.js` | GitHub Contents API adapter (base64 file under `edot-backups/`). |
| `js/stores/s3.js` | S3-compatible adapter via **presigned URLs** (CORS-friendly). |
| `js/stores/webdav.js` | WebDAV adapter (PUT/GET/PROPFIND/DELETE, Basic auth). |
| `js/stores/solid.js` | Solid Pod adapter (LDP container; bearer-token shim, DPoP seam). |
| `js/stores/index.js` | Backend registry (`github`/`s3`/`webdav`/`solid`). |
| `js/backup-config.js` | Per-backend config placeholders + CORS notes. |
| `js/backup-ui.js` | `<edot-backup>` web component (light DOM, accessible, mobile-first). |
| `css/backup.css` | Component styles (reuses `../css/edot.css` variables, dark-mode aware). |
| `backup.html` | Page; exposes `window.__backup` headless-test hook. |
| `test-backup.mjs` | Headless Chromium test (mocked `fetch`, ✅/❌, non-zero exit). |

Every adapter shares one opaque-blob interface and an **injectable `fetch`**
(mirroring `../js/git-remote.js`), so the suite is fully testable offline:

```js
put(id, bytes, cfg)            // → {}
get(id, cfg)                   // → Uint8Array
list(cfg)                      // → [{ id, size, modified }]
remove(id, cfg)               // → {}
```

## Per-backend setup & CORS caveats

### GitHub  — *fully working*
- `cfg = { repo: 'owner/name', token, dir = 'edot-backups', branch? }`
- Token: a fine-grained PAT with **Contents: read/write** on a **private** repo.
- **CORS: none needed** — `api.github.com` is CORS-enabled. Repo history gives
  you free versioning of every backup.

### S3-compatible  — *working via presigned URLs; raw SigV4 intentionally shimmed*
- Primary path: `cfg.presign(method, key) -> url` (PUT/GET/DELETE/LIST signed
  **server-side**), plus `cfg.listUrl` (a presigned `ListObjectsV2` URL). For
  quick tests you may instead pass direct `cfg.urls = { put, get, del, list }`.
- **Raw AWS SigV4 from the browser is NOT implemented** on purpose: it would
  ship your secret key to the page. Keep signing on a tiny backend.
- **CORS:** the bucket needs a CORS policy allowing your origin and
  `PUT/GET/DELETE`. ListObjectsV2 returns XML, which we parse without a lib.

### WebDAV  — *fully working*
- `cfg = { baseUrl, user?, password? }` (Basic auth). Listing uses `PROPFIND`
  `Depth: 1` and parses the multistatus XML namespace-agnostically.
- **CORS:** most WebDAV servers (Nextcloud, Apache `mod_dav`) must be configured
  to send CORS headers for your origin **and** allow the `PROPFIND` method in
  `Access-Control-Allow-Methods` — otherwise the browser blocks listing.

### Solid  — *working with a bearer token (Tier-1 shim); Solid-OIDC + DPoP is TODO*
- `cfg = { container, token? }` — `container` is a Pod container URL ending `/`.
  PUT/GET/DELETE a resource; list via a Turtle `GET` of the container
  (`ldp:contains`).
- **Auth:** Tier 1 sends `Authorization: Bearer <token>`. **Production Solid is
  Solid-OIDC + DPoP** (DPoP-bound access tokens with a per-request proof JWT);
  bearer-only tokens are rejected by DPoP-enforcing servers. The adapter accepts
  an injectable `cfg.dpopHeaders(method, url)` provider so the auth module can
  supply proofs later without forking the file. **(SOLID-OIDC TODO.)**
- **CORS:** most Community/Enterprise Solid Servers already send permissive CORS.

## Tier-2 hooks left for the OIDC-gated key service

Tier 2 (`../ENCRYPTED-BACKUP.md` §Tier 2) makes decryption *conditional on a
valid OIDC login* by mixing a service-released secret `S_user` into the KEK:
`KEK = HKDF( concat( PBKDF2(passphrase, salt), S_user ) )`. The seams:

1. **`crypto.js` → `deriveKek()`** — the single place key derivation happens.
   Search **`TIER2-HOOK`**. Fold `S_user` (fetched from the auth-gated service
   after an OIDC token check) into an HKDF here; nothing else in `crypto.js`
   changes.
2. **`crypto.js` header `kdf` field** — versioned (`'pbkdf2'` today). A Tier-2
   envelope would record `'pbkdf2+hkdf'`; `decryptSnapshot` already rejects
   unknown KDFs gracefully so old/new clients coexist.
3. **`stores/solid.js` → `dpopHeaders` seam** (**`SOLID-OIDC TODO`**) — where
   `magpie/edot/auth/` (`OidcClient` / `AuthSession`) injects Solid-OIDC + DPoP
   proofs. This is the storage adapter that the auth module will tie into.

Argon2id is noted in the design as a stronger KDF; it needs a vendored WASM
module, so PBKDF2 (built-in) is the Tier-1 choice, with the `kdf` field reserved
to recognise an `'argon2id'` envelope in future.

## Test

```sh
node magpie/edot/backup/test-backup.mjs
```

Covers: crypto round-trip + wrong-passphrase + tamper + fingerprint; snapshot
seed→wipe→restore (incl. binary values); all four adapters against a mocked
`fetch` (verifying method/URL shapes — GitHub Contents PUT, WebDAV PROPFIND,
Solid container GET); the full snapshot→encrypt→GitHub→decrypt path; and the UI
(ALPHA badge present, no page errors). All network is mocked — no credentials.
