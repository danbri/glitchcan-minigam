# Backup

`<edot-backup>` is a client-side, end-to-end encrypted backup and restore component for the edot suite. It serialises every edot IndexedDB database into a single snapshot blob, encrypts it with a user-supplied passphrase (AES-GCM-256 over a PBKDF2-derived key, 210 000 iterations), and stores the resulting opaque ciphertext in one of four pluggable remote backends: GitHub, S3-compatible storage, WebDAV, or a Solid Pod. All cryptography uses Web Crypto (`crypto.subtle`); there are no vendored crypto libs and no CDN dependencies.

The component is explicitly **ALPHA**: a badge and one-line warning are rendered on every load. Passphrase loss is irreversible in Tier 1 — there is no server-side recovery path.

Entry point: `magpie/edot/backup/backup.html` (also imports `<edot-login-button>` sign-in chip).  
Web component: `magpie/edot/backup/js/backup-ui.js` → `EdotBackup`.  
Headless-test hook: `window.__backup` (crypto module, snapshot module, store registry, live component handle).

---

## Features

- **Passphrase-based E2E encryption** [stable] — `crypto.js` derives a KEK from the passphrase via PBKDF2 (SHA-256, 210 000 iterations, 16-byte random salt), generates a random AES-GCM-256 DEK, encrypts the snapshot under the DEK, wraps the DEK under the KEK, and packs a versioned self-describing envelope (`EDOTBK01` magic, JSON header, ciphertext). Wrong-passphrase and tamper errors are surfaced as distinct, clear exceptions; a SHA-256 fingerprint of the plaintext is recorded in the header and verified on restore.
- **IndexedDB snapshot (collect + restore)** [stable] — `snapshot.js` walks a configurable list of edot databases (`edot-data`, `edot-calendar`, `edot-maps`, `edot-find`, `edot-grid`, `edot-sheet`, `edot-query`; intentionally excludes `edot-auth`). Binary values (e.g. the SQLite `Uint8Array` blob) are base64-tagged so they survive JSON serialisation. Missing databases are skipped gracefully. Restore bumps the IDB version if new stores must be created.
- **Back up now action** [stable] — button in the UI (`#bk-backup`) that runs `createSnapshot → encryptSnapshot → store.put`, shows intermediate status messages, and displays the SHA-256 fingerprint once done.
- **Refresh / list snapshots** [stable] — `#bk-refresh` calls `store.list(cfg)` and renders a `<ul>` of snapshot entries with id, size (where available), Restore, and Delete buttons.
- **Restore from snapshot** [stable] — per-snapshot Restore button calls `store.get → decryptSnapshot → restoreSnapshot`; requires the passphrase to be filled in first.
- **Delete snapshot** [stable] — per-snapshot Delete button calls `store.remove`; refreshes the list after.
- **Backend configuration form** [partial] — selecting a backend from the `<select>` re-renders a fieldset of labelled inputs for that backend's required fields (repo/token/dir/branch for GitHub, baseUrl/user/password for WebDAV, etc.). Secret fields (`token`, `password`) get `type="password"`. Config is held in component memory only; it is not persisted across page loads (no localStorage opt-in is implemented).
- **Backend: GitHub** [stable] — `stores/github.js` uses the GitHub Contents API (`api.github.com`) with a fine-grained PAT; PUT fetches the existing blob SHA first to allow overwrites; list filters the directory for `.enc` files. CORS-enabled natively.
- **Backend: S3-compatible** [partial] — `stores/s3.js` supports presigned-URL delegation (`cfg.presign`) or direct `cfg.urls`; raw SigV4 is intentionally not implemented. Listing parses ListObjectsV2 XML without a library. CORS must be configured on the bucket.
- **Backend: WebDAV** [partial] — `stores/webdav.js` uses PUT/GET/DELETE + `PROPFIND Depth:1` with Basic auth; PROPFIND must be allowed in the server's CORS config (not default on most servers).
- **Backend: Solid Pod** [partial] — `stores/solid.js` uses LDP container operations with a bearer token (Tier-1 shim). Production Solid-OIDC + DPoP is explicitly marked `TODO`; an injectable `cfg.dpopHeaders` seam exists for future wiring to `magpie/edot/auth/`.
- **ALPHA badge + experimental warning** [stable] — rendered by `backup-ui.js` on every load regardless of backend state.
- **Local / offline export** [broken] — there is no "export to file" or "save locally" action; the only output path is a remote store. A user who cannot reach any backend has no offline fallback.
- **Error display** [partial] — errors from backup, restore, list, and delete are caught and displayed as raw `.message` strings in `#bk-status` with `data-kind="error"`. No user-friendly wrapping, no guidance on CORS failures vs. auth failures vs. network errors.
- **Form validation ordering** [partial] — the passphrase check happens inside `doBackup()`/`doRestore()` before any network calls, which is correct. However, backend field validation (e.g. missing `repo`, missing `baseUrl`) is delegated entirely to the adapter and surfaces only as a raw error string at the end of the operation rather than inline on the form field.
- **Tier-2 upgrade path** [untested] — `crypto.js` has clearly-marked `TIER2-HOOK` seams in `deriveKek()` for mixing in an OIDC-gated `S_user` secret; the `kdf` header field is versioned so Tier-2 envelopes can coexist with Tier-1 ones. Nothing is wired; no tests exist for this path.

---

## Side-effecting actions (command-registry inventory)

| Action | Trigger | Effect | Proposed command id |
|---|---|---|---|
| Back up now | Click `#bk-backup` | Calls `createSnapshot → encryptSnapshot → store.put`; mutates the remote store; updates `#bk-status` and `#bk-fp`; triggers a list refresh | `backup.backup` |
| Refresh list | Click `#bk-refresh` | Calls `store.list(cfg)`; rewrites `#bk-list` DOM | `backup.listRefresh` |
| Restore snapshot | Click per-item Restore button (`data-act="restore"`) | Calls `store.get → decryptSnapshot → restoreSnapshot`; overwrites live IndexedDB stores; updates `#bk-status` | `backup.restore` |
| Delete snapshot | Click per-item Delete button (`data-act="remove"`) | Calls `store.remove`; updates remote store; triggers a list refresh | `backup.delete` |
| Select backend | Change `#bk-backend` `<select>` | Re-renders the backend fieldset; resets `this.cfg` to `defaultFields(backend)` (loses any previously entered values) | `backup.selectBackend` |
| Set passphrase | Input into `#bk-pass` | In-memory only; no side effect until Back up / Restore is triggered | — (form state, not a command) |

---

## User journeys

1. **First backup to GitHub** — User opens `backup.html`, enters a GitHub repo (`owner/name`) and a fine-grained PAT in the backend fieldset, enters a strong passphrase, clicks "Back up now". The component collects all edot IndexedDB data, encrypts it, PUTs a `.enc` file to the repo, displays the SHA-256 fingerprint, and shows the snapshot in the list.

2. **Restore after device loss** — User opens `backup.html` on a new device, enters the same GitHub credentials and passphrase, clicks "Refresh list", identifies the snapshot in the list, enters the passphrase again (or it was already in the field), clicks Restore. The component fetches the envelope, decrypts it, and re-populates all IndexedDB stores. The status line instructs the user to reload other apps.

3. **Switching to a different backend** — User changes the backend selector from GitHub to WebDAV; the fieldset re-renders with baseUrl/user/password fields; user fills them in; any earlier GitHub credentials are discarded.

4. **Deleting an old snapshot** — User clicks Refresh list, sees several old snapshots in the list, clicks Delete on one. The component calls `store.remove`, the item is removed from the remote, and the list refreshes automatically.

5. **Verifying backup integrity** — After backing up, the SHA-256 fingerprint of the snapshot plaintext is shown in `#bk-fp`. The same fingerprint is stored in the envelope header; on restore, `decryptSnapshot` recomputes it and refuses to proceed if there is a mismatch, giving the user an independent integrity check.

---

## Test coverage

Coverage source: `magpie/edot/backup/test-backup.mjs` (27 assertions in `test-coverage.json`).

| Feature | Covered by (suite::assertion label) | Status |
|---|---|---|
| Page boot + hook | `backup::page + __backup hook ready` | covered |
| Sign-in chip in header | `backup::header shows the alpha sign-in chip` | covered |
| Encrypt→decrypt round-trip | `backup::crypto: encrypt→decrypt recovers exact bytes` | covered |
| Wrong-passphrase failure | `backup::crypto: wrong passphrase fails` | covered |
| Tampered ciphertext failure (GCM) | `backup::crypto: flipped ciphertext byte fails (GCM)` | covered |
| SHA-256 fingerprint in header | `backup::crypto: recorded SHA-256 matches plaintext` | covered |
| PBKDF2 iteration floor (≥200k) | `backup::crypto: PBKDF2 iterations >= 200k` | covered |
| Envelope version field | `backup::crypto: envelope is versioned (v=1)` | covered |
| Snapshot manifest record count | `backup::snapshot: manifest counts the seeded records` | covered |
| Snapshot wipe (clear) | `backup::snapshot: wipe empties the store` | covered |
| Snapshot restore | `backup::snapshot: restore brings data back` | covered |
| Binary value round-trip | `backup::snapshot: binary (Uint8Array) value round-trips` | covered |
| All adapters: put→get bytes equal | `backup::${name}: put→get returns identical bytes` (×4) | covered |
| All adapters: list after put | `backup::${name}: list returns the put id` (×4) | covered |
| All adapters: remove | `backup::${name}: remove works` (×4) | covered |
| GitHub Contents PUT issued | `backup::github: issues a Contents PUT` | covered |
| WebDAV PROPFIND issued | `backup::webdav: list issues a PROPFIND` | covered |
| Solid container GET issued | `backup::solid: list issues a container GET` | covered |
| Full E2E encrypt→store→decrypt | `backup::e2e: snapshot→encrypt→put→get→decrypt recovers bytes` | covered |
| E2E fingerprint match | `backup::e2e: restored snapshot fingerprint matches` | covered |
| ALPHA badge rendered | `backup::ui: ALPHA badge present` | covered |
| Experimental warning rendered | `backup::ui: experimental warning present` | covered |
| Back up control rendered | `backup::ui: renders the Back up control` | covered |
| UI backup flow succeeds | `backup::ui: backup via component succeeds` | covered |
| SHA-256 fingerprint shown in UI | `backup::ui: SHA-256 fingerprint shown after backup` | covered |
| Snapshot appears in list after backup | `backup::ui: snapshot appears in the list` | covered |
| No page errors | `backup::no page errors` | covered |

### Gaps (untested)

- **Local / offline export** — no test for downloading the encrypted blob as a local file (feature does not exist).
- **Restore via UI** — `doRestore()` is exercised in the E2E crypto test but the UI Restore button (`data-act="restore"`) is never clicked in the test suite.
- **Delete via UI** — `doRemove()` is not triggered through the UI in any test.
- **Backend select change** — switching the `#bk-backend` `<select>` and its effect on fieldset re-render is not tested.
- **Backend form validation errors** — missing required fields (e.g. empty `repo`, empty `baseUrl`) surfacing as error status strings are not tested.
- **Passphrase missing guard** — the early-return when `#bk-pass` is empty in `doBackup()` / `doRestore()` is not tested.
- **Tier-2 upgrade path** — `deriveKek` TIER2-HOOK and versioned `kdf` header rejection of unknown KDF types are not tested.
- **S3 raw SigV4 / missing presign error** — the `throw new Error('S3: no way to obtain a presigned…')` path in `urlFor()` is not tested.
- **Solid DPoP seam** — `dpopHeaders` injectable is not exercised.
- **Status kind styling** — `data-kind="error"` vs `data-kind="ok"` on `#bk-status` is not asserted.
- **Config persistence (or lack thereof)** — that form state is not saved across page loads is not verified.
- **Size display** — `fmtSize()` formatting in the snapshot list is not asserted.

---

## Known issues

- **No local/offline export** — the only backup target is a remote store. Users without credentials for any supported backend cannot back up.
- **Raw error strings** — network, auth, and CORS failures are forwarded directly as `e.message` to `#bk-status` with no user-friendly interpretation. A CORS preflight rejection and a wrong token look identical from the user's perspective.
- **Backend switching discards config** — changing the `#bk-backend` selector resets `this.cfg` to `defaultFields(backend)`, silently discarding any previously entered credentials.
- **Validation fires late** — adapter-level validation (missing `repo`, missing `baseUrl`, missing `container`) throws only after the user clicks Back up or Restore, not as inline form feedback.
- **Solid-OIDC + DPoP incomplete** — the Solid adapter uses a bearer-token shim; DPoP-enforcing servers will reject it. The `dpopHeaders` seam and the wiring to `magpie/edot/auth/` are explicitly marked TODO.
- **S3 listing requires extra config** — `cfg.listUrl` or a `presign` function must be provided by the user; there is no auto-discovery of a listing URL.
- **`edot-auth` databases intentionally excluded** — OIDC tokens and session secrets are not backed up in Tier 1. This is by design but is not surfaced in the UI.
- **No progress indication during large backups** — status text updates are the only feedback; there is no progress bar or byte-count display during the snapshot collection or upload.
