// foafos sessions — ephemeral by default, persistable only sealed.
//
// A session is a plain object: { v, id, createdAt, profile, data }.
// It lives in memory and dies with the tab unless the user chooses to keep
// it — and keeping it ALWAYS means sealing: AES-256-GCM, key derived from a
// user passphrase via PBKDF2-SHA256. There is no unencrypted persistence
// path; a session without a passphrase is deliberately transient.
//
// This is device-local credential-less identity. Federated login (WebID,
// fedi, OAuth …) is a later layer that would populate `profile` — the
// storage contract here doesn't change.

const te = new TextEncoder();
const td = new TextDecoder();

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const SESSION_KEY = 'foafos.session.v1';
const KDF_ITERATIONS = 210000;

export function createSession(profile = {}) {
  return {
    v: 1,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    profile,        // { name, avatar, homepage, webid? … } — user-asserted
    data: {},       // shell + widget state (bookmarks, feed prefs, …)
  };
}

async function deriveKey(passphrase, salt, iterations) {
  const base = await crypto.subtle.importKey(
    'raw', te.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// session + passphrase → sealed blob (safe to put in localStorage)
export async function sealSession(session, passphrase) {
  if (!passphrase) throw new Error('a passphrase is required to persist a session');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(session)));
  return {
    v: 1, kdf: 'PBKDF2-SHA256', iterations: KDF_ITERATIONS,
    salt: b64(salt), iv: b64(iv), ct: b64(ct),
  };
}

// sealed blob + passphrase → session (throws on wrong passphrase)
export async function openSession(sealed, passphrase) {
  const key = await deriveKey(passphrase, unb64(sealed.salt), sealed.iterations);
  let pt;
  try {
    pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, key, unb64(sealed.ct));
  } catch {
    throw new Error('wrong passphrase (or corrupted session)');
  }
  return JSON.parse(td.decode(pt));
}

// storage is anything with getItem/setItem/removeItem (localStorage, a shim…)
export function saveSealed(sealed, storage) {
  storage.setItem(SESSION_KEY, JSON.stringify(sealed));
}
export function loadSealed(storage) {
  const raw = storage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function clearSealed(storage) {
  storage.removeItem(SESSION_KEY);
}
