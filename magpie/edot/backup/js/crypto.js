// crypto.js — Tier-1 passphrase envelope encryption for edot backups.
//
// Implements the "common core" of ENCRYPTED-BACKUP.md, Tier 1:
//
//   1. A random AES-GCM-256 DEK (data key) encrypts the snapshot bytes; the GCM
//      tag carries integrity (a flipped ciphertext byte fails to decrypt).
//   2. A KEK (key-encryption key) is derived from the user's passphrase via
//      PBKDF2(SHA-256, random salt, >=200k iterations). The DEK is *wrapped*
//      (encrypted) under the KEK with AES-GCM, so the passphrase never touches
//      the bulk ciphertext directly.
//   3. A versioned, self-describing header travels with the ciphertext:
//        { v, kdf, salt, iv, wrappedDEK, cipherIv, sha256OfPlaintext, createdAt }
//      We also record SHA-256(plaintext) — the OPENDOC fingerprint gesture — so
//      a restore can prove it recovered exactly what was backed up.
//
// Everything is Web Crypto (crypto.subtle). No vendored crypto lib, no CDN.
//
// --- Tier-2 UPGRADE PATH (out of scope here; see ENCRYPTED-BACKUP.md §Tier 2) ---
// To make decryption *conditional on an OIDC login*, the KEK must mix in a
// secret released only by an auth-gated key service:
//     KEK = HKDF( concat( PBKDF2(passphrase, salt), S_user ) )
// `deriveKek()` is the single seam where that S_user would be folded in. The
// `kdf` header field is versioned precisely so Tier-2 envelopes ('pbkdf2+hkdf')
// can coexist with Tier-1 ones ('pbkdf2'). Search "TIER2-HOOK" below.
//
// Argon2id is mentioned in the design as a stronger KDF option; it needs a
// vendored WASM module, so PBKDF2 (built into Web Crypto) is the Tier-1 choice.
// The `kdf` field lets a future 'argon2id' envelope be recognised and rejected
// gracefully by older clients instead of mis-decoded.

const ENVELOPE_VERSION = 1;
const ENVELOPE_MAGIC = 'EDOTBK01';        // 8 ASCII bytes; cheap sanity/version guard
export const PBKDF2_ITERATIONS = 210000;  // >= 200k per spec (OWASP 2023 floor for SHA-256)
const SALT_BYTES = 16;
const IV_BYTES = 12;                       // 96-bit nonce, the AES-GCM standard

const subtle = (globalThis.crypto && globalThis.crypto.subtle) || null;
function requireSubtle() {
  if (!subtle) throw new Error('Web Crypto (crypto.subtle) unavailable — needs a secure context (https/localhost).');
  return subtle;
}

// ---- public API -------------------------------------------------------------

/**
 * Encrypt snapshot bytes into a self-contained envelope (header + ciphertext).
 * @param {Uint8Array|ArrayBuffer} bytes  plaintext snapshot
 * @param {string} passphrase
 * @returns {Promise<Uint8Array>} envelope bytes (magic + JSON header + ciphertext)
 */
export async function encryptSnapshot(bytes, passphrase) {
  const s = requireSubtle();
  const plain = asU8(bytes);
  if (!passphrase) throw new Error('A passphrase is required to encrypt a backup.');

  const sha256OfPlaintext = await sha256Hex(plain);

  // Fresh random material for every backup: salt (KDF), DEK, and two IVs.
  const salt = randomBytes(SALT_BYTES);
  const cipherIv = randomBytes(IV_BYTES);
  const wrapIv = randomBytes(IV_BYTES);

  const dek = await s.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const kek = await deriveKek(passphrase, salt);

  // Bulk encrypt under the DEK; the GCM tag is appended to the ciphertext.
  const ciphertext = new Uint8Array(
    await s.encrypt({ name: 'AES-GCM', iv: cipherIv }, dek, plain));

  // Wrap (encrypt) the raw DEK under the KEK so only the passphrase unlocks it.
  const rawDek = new Uint8Array(await s.exportKey('raw', dek));
  const wrappedDEK = new Uint8Array(
    await s.encrypt({ name: 'AES-GCM', iv: wrapIv }, kek, rawDek));

  const header = {
    magic: ENVELOPE_MAGIC,
    v: ENVELOPE_VERSION,
    kdf: { name: 'pbkdf2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS },
    cipher: 'AES-GCM-256',
    salt: b64(salt),
    iv: b64(wrapIv),          // IV used to wrap the DEK
    wrappedDEK: b64(wrappedDEK),
    cipherIv: b64(cipherIv),  // IV used for the bulk snapshot ciphertext
    sha256OfPlaintext,
    createdAt: new Date().toISOString(),
  };
  return packEnvelope(header, ciphertext);
}

/**
 * Decrypt an envelope back to the original snapshot bytes.
 * Throws clearly on a wrong passphrase (DEK unwrap fails), on tampering (GCM
 * auth failure), or on a fingerprint mismatch.
 * @param {Uint8Array|ArrayBuffer} envelopeBytes
 * @param {string} passphrase
 * @returns {Promise<Uint8Array>} plaintext snapshot
 */
export async function decryptSnapshot(envelopeBytes, passphrase) {
  const s = requireSubtle();
  if (!passphrase) throw new Error('A passphrase is required to decrypt a backup.');
  const { header, ciphertext } = unpackEnvelope(asU8(envelopeBytes));

  if (header.magic !== ENVELOPE_MAGIC) throw new Error('Not an edot backup envelope (bad magic).');
  if (header.v !== ENVELOPE_VERSION) throw new Error(`Unsupported envelope version ${header.v}.`);
  if (header.kdf && header.kdf.name !== 'pbkdf2') {
    // TIER2-HOOK: a 'pbkdf2+hkdf' (auth-gated) or 'argon2id' envelope lands here.
    throw new Error(`This backup uses an unsupported KDF (${header.kdf.name}); a newer client is required.`);
  }

  const salt = unb64(header.salt);
  const kek = await deriveKek(passphrase, salt, header.kdf && header.kdf.iterations);

  // Unwrap the DEK. A wrong passphrase yields a wrong KEK and the GCM tag check
  // fails here — surfaced as a clear, non-leaky error.
  let rawDek;
  try {
    rawDek = new Uint8Array(await s.decrypt(
      { name: 'AES-GCM', iv: unb64(header.iv) }, kek, unb64(header.wrappedDEK)));
  } catch {
    throw new Error('Wrong passphrase, or the backup header was tampered with.');
  }
  const dek = await s.importKey('raw', rawDek, { name: 'AES-GCM' }, false, ['decrypt']);

  let plain;
  try {
    plain = new Uint8Array(await s.decrypt(
      { name: 'AES-GCM', iv: unb64(header.cipherIv) }, dek, ciphertext));
  } catch {
    throw new Error('Backup is corrupt or was tampered with (authentication failed).');
  }

  // Verify the recorded OPENDOC fingerprint — defence in depth beyond the tag.
  if (header.sha256OfPlaintext) {
    const got = await sha256Hex(plain);
    if (got !== header.sha256OfPlaintext) {
      throw new Error('Restored bytes do not match the recorded SHA-256 fingerprint.');
    }
  }
  return plain;
}

/** Parse just the header of an envelope (no passphrase needed) — for listings. */
export function readEnvelopeHeader(envelopeBytes) {
  return unpackEnvelope(asU8(envelopeBytes)).header;
}

/** SHA-256 of bytes as a lowercase hex string (the OPENDOC fingerprint form). */
export async function sha256Hex(bytes) {
  const buf = await requireSubtle().digest('SHA-256', asU8(bytes));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- KEK derivation (the Tier-1 vs Tier-2 seam) -----------------------------

/**
 * Derive the AES-GCM KEK from a passphrase + salt via PBKDF2.
 *
 * TIER2-HOOK: this is the *only* place the key-derivation differs by tier. To
 * gate decryption on an OIDC login (Tier 2), fetch S_user from the auth-gated
 * key service (see magpie/edot/auth/) and replace the returned key with:
 *     HKDF( concat( pbkdf2Bits, S_user ) )  ->  importKey AES-GCM
 * The passphrase still never leaves the device; the service only releases
 * S_user after verifying the OIDC id_token. Nothing else in this file changes.
 */
async function deriveKek(passphrase, salt, iterations = PBKDF2_ITERATIONS) {
  const s = requireSubtle();
  const baseKey = await s.importKey(
    'raw', new TextEncoder().encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']);
  return s.deriveKey(
    { name: 'PBKDF2', salt: asU8(salt), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ---- envelope framing -------------------------------------------------------
// Layout: [8-byte magic][4-byte big-endian header length][JSON header][ciphertext]

function packEnvelope(header, ciphertext) {
  const headerJson = new TextEncoder().encode(JSON.stringify(header));
  const out = new Uint8Array(8 + 4 + headerJson.length + ciphertext.length);
  out.set(new TextEncoder().encode(ENVELOPE_MAGIC), 0);
  new DataView(out.buffer).setUint32(8, headerJson.length, false);
  out.set(headerJson, 12);
  out.set(ciphertext, 12 + headerJson.length);
  return out;
}

function unpackEnvelope(bytes) {
  if (bytes.length < 12) throw new Error('Truncated backup envelope.');
  const magic = new TextDecoder().decode(bytes.subarray(0, 8));
  if (magic !== ENVELOPE_MAGIC) throw new Error('Not an edot backup envelope (bad magic).');
  const headerLen = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, false);
  const headerEnd = 12 + headerLen;
  if (headerEnd > bytes.length) throw new Error('Corrupt backup envelope (bad header length).');
  let header;
  try { header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, headerEnd))); }
  catch { throw new Error('Corrupt backup envelope (unparseable header).'); }
  return { header, ciphertext: bytes.subarray(headerEnd) };
}

// ---- small byte / base64 helpers (unicode-safe, chunked for big blobs) ------

export function asU8(x) {
  if (x instanceof Uint8Array) return x;
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  throw new Error('Expected bytes (Uint8Array/ArrayBuffer).');
}

function randomBytes(n) { return globalThis.crypto.getRandomValues(new Uint8Array(n)); }

export function b64(bytes) {
  const u8 = asU8(bytes);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) bin += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  return btoa(bin);
}

export function unb64(str) {
  const bin = atob(String(str).replace(/\s/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
