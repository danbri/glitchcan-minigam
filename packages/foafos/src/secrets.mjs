// FoafSecrets — a secret is not storage.
//
// MEASURED, and the reason this exists. edot's auth module offers "stay
// signed in", which its own session.js implements by moving tokens from
// sessionStorage to localStorage. Under foafos that `localStorage` is
// app-sdk's shim over FoafStore, so the bearer token ends up:
//
//   · in `FoafStore.snapshot('edot')`, in plaintext
//   · in `foafos.store.edot`, in plaintext, ON DISK, in the SHELL's origin
//
// Nothing was broken to make that happen — it is what the storage broker is
// FOR. An app is meant to read back what it wrote. That is exactly why a
// credential does not belong there: the one guarantee FoafStore makes is
// the one a secret cannot afford.
//
// So a second broker, with a deliberately worse interface:
//
//   PUT      an app may hand a secret over
//   NAMES    an app may ask which of its own secrets exist
//   USE      an app may ask the SHELL to do something with one
//   GET      there is no get. On purpose. See `read()` below.
//
// The asymmetry is the whole design. An app that cannot read a token back
// cannot leak it, cannot log it, cannot put it in a URL, and cannot be
// tricked into posting it somewhere by injected script. It can still ASK
// for the operation it actually wanted — "commit this file", "PUT this
// object" — which is the same move as brokering storage instead of handing
// back `allow-same-origin`.
//
// At rest: sealed with the session passphrase (session.mjs, AES-GCM +
// PBKDF2). WITHOUT a passphrase there is no sealing available, so secrets
// stay in memory for the run and are honestly reported as unsealed rather
// than quietly written to disk in the clear — the failure this module was
// built to stop.

import { sealSession, openSession } from './session.mjs';

export const SECRETS_CAP = 'secrets';
export const MAX_SECRET_BYTES = 8 * 1024;      // a token, not a document
export const MAX_PER_APP = 24;

/** Never let a secret reach a log line, a summary or an exception. */
const redact = (v) => (v == null ? '(none)' : `${String(v).length} bytes`);

export class FoafSecrets {
  constructor({ bus = null, storage = null, key = 'foafos.secrets' } = {}) {
    this.bus = bus;
    this.storage = storage;                    // where the SEALED blob lives
    this.key = key;
    this.grants = new Map();                   // appId -> Set(capabilities)
    this._mem = new Map();                     // appId -> Map(name -> value)
    this.sealed = false;                       // is what we hold sealed at rest?
    this._passphrase = null;
    this.audit = [];
  }

  // Deliberately mirrors FoafStore's shape, so the two brokers are learned
  // once. `_say` takes only facts that are safe to publish — the value is
  // never one of them, and there is a test that greps for it.
  _say(topic, data) {
    this.audit.push({ topic, ...data });
    if (this.audit.length > 200) this.audit.shift();
    this.bus?.publish(topic, data);
  }

  grant(appId, caps = []) { this.grants.set(appId, new Set(caps)); return this; }
  revoke(appId) { this.grants.delete(appId); return this; }
  can(appId, cap = SECRETS_CAP) { return !!this.grants.get(appId)?.has(cap); }

  /**
   * There is no read. Present so that the refusal is a DOCUMENTED answer
   * rather than a missing method — a caller reaching for it gets told what
   * to do instead, which is the difference between a design and an
   * omission.
   */
  read() {
    const e = new Error(
      'foafos: secrets cannot be read back. Ask the shell to USE the secret ' +
      '(secrets.use) so the value never enters the app.');
    e.name = 'FoafSecretsNotReadable';
    throw e;
  }

  put(appId, name, value) {
    if (!this.can(appId)) {
      this._say('secrets.denied', { summary: `${appId} has no secrets capability`, appId, name, op: 'put' });
      return { ok: false, reason: 'denied' };
    }
    const v = String(value == null ? '' : value);
    if (v.length > MAX_SECRET_BYTES) {
      this._say('secrets.refused', {
        summary: `${appId} tried to store ${v.length} bytes as a secret`,
        appId, name, op: 'put', reason: 'too-large', bytes: v.length,
      });
      return { ok: false, reason: 'too-large' };
    }
    const box = this._mem.get(appId) || new Map();
    if (!box.has(name) && box.size >= MAX_PER_APP) {
      this._say('secrets.refused', {
        summary: `${appId} already holds ${box.size} secrets`,
        appId, name, op: 'put', reason: 'too-many',
      });
      return { ok: false, reason: 'too-many' };
    }
    box.set(name, v);
    this._mem.set(appId, box);
    this._say('secrets.put', {
      summary: `${appId} stored a secret "${name}" (${redact(v)})`,
      appId, name, bytes: v.length, sealed: this.sealed,
    });
    return { ok: true, sealed: this.sealed };
  }

  /** Which of its OWN secrets does this app have? Names only, ever. */
  names(appId) {
    if (!this.can(appId)) {
      this._say('secrets.denied', { summary: `${appId} has no secrets capability`, appId, op: 'names' });
      return null;
    }
    return [...(this._mem.get(appId) || new Map()).keys()];
  }

  has(appId, name) { return (this._mem.get(appId) || new Map()).has(name); }

  forget(appId, name) {
    if (!this.can(appId)) {
      this._say('secrets.denied', { summary: `${appId} has no secrets capability`, appId, name, op: 'forget' });
      return { ok: false, reason: 'denied' };
    }
    const box = this._mem.get(appId);
    const had = !!box?.delete(name);
    this._say('secrets.forget', { summary: `${appId} forgot "${name}"`, appId, name, had });
    return { ok: true, had };
  }

  /**
   * Use a secret WITHOUT handing it over.
   *
   * `fn` runs shell-side and receives the value; whatever it returns is
   * what the caller gets. The point is that `fn` belongs to the shell (a
   * git commit, a signed S3 PUT), never to the guest — a guest that could
   * pass its own function here would just be reading the secret with extra
   * steps, so the transport layer must expose named OPERATIONS, not this.
   */
  async use(appId, name, fn) {
    if (!this.can(appId)) {
      this._say('secrets.denied', { summary: `${appId} has no secrets capability`, appId, name, op: 'use' });
      return { ok: false, reason: 'denied' };
    }
    const box = this._mem.get(appId);
    if (!box?.has(name)) {
      this._say('secrets.missing', { summary: `${appId} has no secret "${name}"`, appId, name });
      return { ok: false, reason: 'missing' };
    }
    this._say('secrets.use', { summary: `${appId} used "${name}"`, appId, name });
    try {
      const result = await fn(box.get(name));
      return { ok: true, result };
    } catch (e) {
      // The value may well be inside a fetch error's message or URL, so the
      // message is NOT passed through — only its type.
      this._say('secrets.use.failed', {
        summary: `${appId}'s use of "${name}" failed (${e?.name || 'Error'})`,
        appId, name, error: e?.name || 'Error',
      });
      return { ok: false, reason: 'failed', error: e?.name || 'Error' };
    }
  }

  // ── at rest ────────────────────────────────────────────────────────────
  // Sealing needs a passphrase. If there is none, we keep secrets for the
  // run and SAY they are unsealed. The alternative — writing them out in
  // the clear — is the exact bug this module exists to prevent, so it is
  // not offered.

  /**
   * Is there a sealed blob on this device?
   *
   * Needed because "no secret stored" and "your secret is right there,
   * sealed, and nobody has unlocked it" are completely different situations
   * for a user, and a broker that reports the first for the second sends
   * them off to mint a new token they did not need. The UI can only tell
   * them apart if this exists.
   */
  hasSealed() {
    try { return !!this.storage?.getItem(this.key); } catch (e) { return false; }
  }

  /** Drop the sealed blob AND everything held for the run. */
  clearSealed() {
    const had = this.hasSealed();
    try { this.storage?.removeItem(this.key); } catch (e) { /* nothing to do */ }
    const n = this.count();
    this._mem = new Map();
    this._passphrase = null;
    this.sealed = false;
    this._say('secrets.cleared', {
      summary: `every stored secret was forgotten (${n} held, ${had ? 'sealed blob removed' : 'nothing on disk'})`,
      count: n, had,
    });
    return { ok: true, forgotten: n };
  }

  async seal(passphrase) {
    if (!passphrase) throw new Error('a passphrase is required to seal secrets');
    if (!this.storage) return { ok: false, reason: 'no-storage' };
    const plain = {};
    for (const [appId, box] of this._mem) plain[appId] = Object.fromEntries(box);
    const blob = await sealSession(plain, passphrase);
    this.storage.setItem(this.key, JSON.stringify(blob));
    this._passphrase = passphrase;
    this.sealed = true;
    this._say('secrets.sealed', {
      summary: `secrets sealed at rest (${this.count()} across ${this._mem.size} app(s))`,
      apps: this._mem.size, count: this.count(),
    });
    return { ok: true };
  }

  async unseal(passphrase) {
    if (!this.storage) return { ok: false, reason: 'no-storage' };
    const raw = this.storage.getItem(this.key);
    if (!raw) return { ok: false, reason: 'nothing-stored' };
    let plain;
    try {
      plain = await openSession(JSON.parse(raw), passphrase);
    } catch (e) {
      this._say('secrets.unseal.failed', { summary: 'wrong passphrase for stored secrets' });
      return { ok: false, reason: 'wrong-passphrase' };
    }
    this._mem = new Map(Object.entries(plain).map(([a, o]) => [a, new Map(Object.entries(o))]));
    this._passphrase = passphrase;
    this.sealed = true;
    this._say('secrets.unsealed', {
      summary: `secrets unsealed (${this.count()} across ${this._mem.size} app(s))`,
      apps: this._mem.size, count: this.count(),
    });
    return { ok: true };
  }

  /** Re-seal after a change, if we are already sealed. Silent no-op if not. */
  async flush() {
    if (!this.sealed || !this._passphrase) return { ok: false, reason: 'not-sealed' };
    return this.seal(this._passphrase);
  }

  count() {
    let n = 0;
    for (const box of this._mem.values()) n += box.size;
    return n;
  }

  /**
   * For the inspector: who holds which NAMES, and whether any of it is
   * sealed. A report that included values would undo the whole module, so
   * this is also what the "no value ever escapes" test asserts against.
   */
  report() {
    return {
      sealed: this.sealed,
      apps: [...this.grants.keys()].map((appId) => ({
        appId,
        capable: this.can(appId),
        names: [...(this._mem.get(appId) || new Map()).keys()],
      })),
    };
  }
}
