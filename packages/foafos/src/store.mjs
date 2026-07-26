// FoafStore — the state broker.
//
// An app in a sandboxed frame has an OPAQUE ORIGIN, where `localStorage`
// and `sessionStorage` throw SecurityError. That is the isolation working
// as intended: a guest cannot reach the shell's storage, or any other
// app's. But an app still needs somewhere to keep things, and the answer
// is not "hand it the whole origin back" — it is to broker.
//
// Each app gets a namespace it cannot name its way out of. The shell
// holds the actual bytes; the app holds a capability. Same shape as
// FoafVars: grant, check, audit, and refuse in the open.
//
// Local now, cloud later, ONE interface. A backend is just:
//     { read(ns) -> object, write(ns, object) -> void }
// so a synced backend drops in without any app knowing.

export const STORE_CAP = 'storage';
export const DEFAULT_QUOTA = 256 * 1024;   // per app, bytes of JSON

/** localStorage-backed backend. The shell's origin, not the app's. */
export const localBackend = (storage) => ({
  read(ns) {
    try { return JSON.parse(storage.getItem(`foafos.store.${ns}`) || '{}'); }
    catch { return {}; }
  },
  write(ns, obj) {
    storage.setItem(`foafos.store.${ns}`, JSON.stringify(obj));
  },
});

/** In-memory backend — tests, and any app granted ephemeral storage. */
export const memoryBackend = () => {
  const m = new Map();
  return {
    read: (ns) => ({ ...(m.get(ns) || {}) }),
    write: (ns, obj) => { m.set(ns, { ...obj }); },
  };
};

export class FoafStore {
  constructor({ bus = null, backend = null, quotaBytes = DEFAULT_QUOTA, quotas = {} } = {}) {
    this.bus = bus;
    this.backend = backend || memoryBackend();
    this.quotaBytes = quotaBytes;
    // Per-app overrides. One quota for everything is the right DEFAULT and
    // the wrong RULE: an app that keeps a SQLite file needs a different
    // allowance from one that keeps a station number, and the alternative
    // — raising the default for everybody — dissolves the limit for the
    // apps it was protecting us from. Named per app, so the generosity is
    // as auditable as the grant.
    this.quotas = new Map(Object.entries(quotas));
    this.grants = new Map();      // appId -> Set(capabilities)
    this.audit = [];
  }

  /** The allowance this app gets: its own if named, else the default. */
  quotaFor(appId) {
    return this.quotas.has(appId) ? this.quotas.get(appId) : this.quotaBytes;
  }
  setQuota(appId, bytes) { this.quotas.set(appId, bytes); return this; }

  _say(topic, data) {
    this.audit.push({ topic, ...data });
    if (this.audit.length > 200) this.audit.shift();
    this.bus?.publish(topic, data);
  }

  grant(appId, caps = []) {
    this.grants.set(appId, new Set(caps));
    return this;
  }
  revoke(appId) { this.grants.delete(appId); return this; }
  can(appId, cap) { return !!this.grants.get(appId)?.has(cap); }

  // An app that was never granted storage does not get a silent empty
  // object — that reads as "you have no data yet" and an app will
  // happily overwrite on that basis. It gets null, and a denial on the bus.
  snapshot(appId) {
    if (!this.can(appId, STORE_CAP)) {
      this._say('store.denied', { summary: `${appId} has no storage capability`, appId, op: 'snapshot' });
      return null;
    }
    return this.backend.read(appId);
  }

  usage(appId) {
    const data = this.backend.read(appId);
    return JSON.stringify(data).length;
  }

  set(appId, key, value) {
    if (!this.can(appId, STORE_CAP)) {
      this._say('store.denied', { summary: `${appId} may not write ${key}`, appId, key, op: 'set' });
      return { ok: false, reason: 'denied' };
    }
    const data = this.backend.read(appId);
    const before = data[key];
    data[key] = String(value);
    const size = JSON.stringify(data).length;
    const quota = this.quotaFor(appId);
    if (size > quota) {
      // Refuse loudly and leave the old value intact. A half-applied
      // write is worse than a refused one.
      if (before === undefined) delete data[key]; else data[key] = before;
      this._say('store.quota', {
        summary: `${appId} is out of storage (${size} > ${quota} bytes)`,
        appId, key, size, quota,
      });
      return { ok: false, reason: 'quota', size, quota };
    }
    this.backend.write(appId, data);
    this._say('store.set', { summary: `${appId} stored ${key}`, appId, key, size });
    return { ok: true, size };
  }

  remove(appId, key) {
    if (!this.can(appId, STORE_CAP)) {
      this._say('store.denied', { summary: `${appId} may not remove ${key}`, appId, key, op: 'remove' });
      return { ok: false, reason: 'denied' };
    }
    const data = this.backend.read(appId);
    delete data[key];
    this.backend.write(appId, data);
    this._say('store.remove', { summary: `${appId} removed ${key}`, appId, key });
    return { ok: true };
  }

  clear(appId) {
    if (!this.can(appId, STORE_CAP)) {
      this._say('store.denied', { summary: `${appId} may not clear storage`, appId, op: 'clear' });
      return { ok: false, reason: 'denied' };
    }
    this.backend.write(appId, {});
    this._say('store.clear', { summary: `${appId} cleared its storage`, appId });
    return { ok: true };
  }

  /** For the inspector: who holds what, and how much are they using. */
  report() {
    return [...this.grants.entries()].map(([appId, caps]) => ({
      appId, capabilities: [...caps],
      bytes: this.can(appId, STORE_CAP) ? this.usage(appId) : 0,
      quota: this.quotaFor(appId),
    }));
  }
}
