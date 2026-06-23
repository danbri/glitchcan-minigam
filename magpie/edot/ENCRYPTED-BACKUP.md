# Encrypted backup & restore — design note

> Optionally upload an encrypted copy of your local IndexedDB, and restore it
> later using a combination of secrets from that interaction **plus** authing as
> the OIDC account holder(s) it was encrypted for.

Status: **design only.** This documents the cryptography and the honest limits
before any irreversible storage choice is made. It answers the key question:
*can unlocking be made conditional on showing an OIDC login?*

## What we're protecting

The suite keeps user data in IndexedDB (edot documents, the `edot-data` SQLite
blob, calendar events, saved map places). A backup is a single **dump** of those
stores. We want: confidentiality at rest in whatever store we pick, integrity,
and an *optional* requirement that restoring proves an identity (OIDC), not just
knowledge of a passphrase.

## The honest constraint (read this first)

**Pure in-browser crypto cannot, by itself, enforce "you must be logged in to
decrypt."** Once the decryption key is derivable on the device, anyone with the
ciphertext + that key can decrypt offline, logged in or not. OIDC in a static
app proves identity *to a remote party*; it does not, on its own, hand you a
secret. So to truly gate decryption on auth, **a second party must release key
material only after verifying a valid OIDC token.** That party can be tiny (a
single token-checked endpoint or a KMS), but it cannot be "nothing."

Everything below is built around that fact. Three tiers, weakest to strongest.

## Envelope encryption (the common core, all tiers)

1. Serialize the chosen IndexedDB stores → one `dump` (bytes). Reuse the
   OPENDOC fingerprint idea: record `SHA-256(dump)` in a manifest.
2. Generate a random **DEK** (Data Encryption Key), `AES-GCM-256`.
3. `ciphertext = AES-GCM(DEK, iv, dump)` — the GCM tag gives integrity.
4. **Wrap the DEK** with a **KEK** (Key Encryption Key). *How the KEK is formed
   is the only thing that differs between tiers.*
5. Upload `{ wrappedDEK, iv, ciphertext, manifest, header }`. The store sees
   only opaque bytes. (Older versions can be retained — committed, à la OPENDOC.)

Restore reverses it: obtain KEK → unwrap DEK → AES-GCM decrypt → verify SHA-256
→ load into IndexedDB.

All primitives are Web Crypto (`crypto.subtle`): AES-GCM, PBKDF2/HKDF, ECDH/RSA
for multi-recipient wrapping. No vendored crypto lib.

### Tier 1 — Passphrase only (no real auth gate)
`KEK = PBKDF2(passphrase, salt, high-iterations)` (or Argon2id if we vendor one).
OIDC is used **only to label/locate** the blob (the account `sub` names it), not
to gate it. Simple, fully client-side, works on Pages today. **"Logged in" is
convenience, not a cryptographic requirement** — be honest in the UI.

### Tier 2 — Auth-gated key service (recommended for real enforcement)
A minimal backend/KMS holds a per-user **wrap secret** `S_user`. It releases
`S_user` **only** on presentation of a valid OIDC `id_token` whose `aud`/`iss`
it checks (and `sub` matches the blob owner). Then:

```
KEK = HKDF( concat( PBKDF2(passphrase, salt), S_user ) )
```

Now unlocking needs **both**: the passphrase (something you know) **and** a
successful OIDC login (which is the only way to get `S_user`). No login → no
`S_user` → the offline ciphertext is useless. This is the "conditional on
showing OIDC login" the request asks for, done properly. The service is small:
verify token → return a 32-byte secret. It never sees the passphrase, the DEK,
or the plaintext.

### Tier 3 — Multi-recipient / split-secret
- **Multi-recipient (encrypt "for" one or more OIDC holders):** give each
  intended account an asymmetric keypair (public key registered, e.g. via the
  key service or a directory). Wrap the DEK once per recipient public key
  (ECDH-ES). Any listed holder can unwrap *their* copy after authenticating to
  retrieve their private key — this is literally "encrypted for the OIDC account
  holder(s)."
- **Shamir split:** split the DEK into `k`-of-`n` shares — one derived from the
  passphrase, one released by the auth-gated service, optionally one kept on the
  device. Reconstruction needs OIDC (its share) *plus* the passphrase. Gives
  recovery flexibility (e.g. 2-of-3) and quorum/multi-party unlock.

## Storage targets (deferred — ciphertext is opaque, so anywhere works)
- **GitHub private repo / Gist** — reuse the GitHub connection edot already has;
  push the ciphertext as a file, retain history = free versioning.
- **S3 / WebDAV** — user-configured bucket/endpoint, provider-neutral.
- **The key service's own blob store** — if we build Tier 2/3 anyway.

Choice doesn't affect the crypto. Pick when we pick the key-service host.

## What leaks / metadata
Even encrypted, the store learns: blob exists, size, timestamps, and (if we name
by `sub`) which account it belongs to. Mitigate by padding sizes to buckets and
naming blobs by an opaque random id mapped through the key service.

## Recommended build order
1. **Now (client-only, safe):** Tier-1 envelope encryption + restore + SHA-256
   manifest + a local "export encrypted backup / import encrypted backup" flow.
   No server, no irreversible choice. Reuses the OPENDOC fingerprint gesture.
2. **When a backend target is chosen:** add the **Tier-2 auth-gated key service**
   to get true OIDC-conditional unlock (this is the part the request really
   wants, and the part that *requires* a small trusted endpoint).
3. **If sharing is needed:** Tier-3 multi-recipient wrapping so a backup can be
   encrypted *for* specific OIDC account holders.

## Open decisions for danbri
- Host for the Tier-2 key service (Cloudflare Worker / tiny Lambda / self-host)?
  It's the difference between "passphrase with an OIDC label" and "genuinely
  can't decrypt without logging in."
- Storage target (GitHub vs S3/WebDAV vs key-service blob)?
- Argon2id (vendored) vs PBKDF2 (built-in) for the passphrase KDF?
- Recovery model: pure passphrase loss = data loss, or a recovery share?
