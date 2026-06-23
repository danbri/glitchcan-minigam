// snapshot.js — collect the suite's IndexedDB databases into one serialisable
// blob, and restore them back. The blob is plaintext here; crypto.js encrypts
// it into an envelope before it ever leaves the device.
//
// IndexedDB has no native "dump the whole database" call, so we walk it: open
// each database, enumerate its object stores, read every record (with its key
// when the store has no keyPath), and pack it all — plus a manifest — into one
// JSON document. Restore replays it: open/upgrade each database to hold the
// listed stores, clear them, and put the records back.
//
// Patterns mirror data-engine.js (promise-wrapped IDB open/get/put). Binary
// values (e.g. the edot-data SQLite Uint8Array blob) are tagged and base64'd so
// they survive JSON; everything else is round-tripped as-is via structured data.
//
// The DB/store list is *configurable* (DEFAULT_DATABASES) so new edot apps can
// opt in without editing this file.

import { sha256Hex, b64, unb64, asU8 } from './crypto.js';

// Sane defaults: every IndexedDB database the edot suite is known to use, with
// the object stores inside each. Discovered from the codebase (June 2026):
//   edot-data → kv (the SQLite blob), edot-calendar → calendars/events,
//   edot-maps → places, plus the editor's library/find/grid/sheet/query stores.
// `stores: '*'` means "enumerate whatever stores the DB actually has".
export const DEFAULT_DATABASES = [
  { name: 'edot-data', stores: '*' },       // SQLite blob store ('kv')
  { name: 'edot-calendar', stores: '*' },   // calendars + events
  { name: 'edot-maps', stores: '*' },       // saved map places
  { name: 'edot-find', stores: '*' },
  { name: 'edot-grid', stores: '*' },
  { name: 'edot-sheet', stores: '*' },
  { name: 'edot-query', stores: '*' },
  // Intentionally NOT included by default: 'edot-auth' / 'edot-login' hold OIDC
  // tokens/session secrets — backing those up is a separate, careful decision.
];

const SNAPSHOT_VERSION = 1;
const BINARY_TAG = '__edot_b64__';   // marker object for byte values inside JSON

/**
 * Build one serialisable snapshot blob across the chosen databases.
 * @param {{databases?: Array, indexedDB?: IDBFactory}} [opts]
 * @returns {Promise<{bytes: Uint8Array, manifest: object}>}
 */
export async function createSnapshot(opts = {}) {
  const idb = opts.indexedDB || globalThis.indexedDB;
  const wanted = opts.databases || DEFAULT_DATABASES;

  const dbDump = {};
  const manifestDbs = [];
  for (const spec of wanted) {
    const present = await dbExists(idb, spec.name);
    if (!present) continue;                 // graceful: skip DBs not on this device
    const db = await openExisting(idb, spec.name);
    try {
      const storeNames = resolveStores(db, spec.stores);
      const stores = {};
      const manifestStores = [];
      for (const sn of storeNames) {
        const records = await readStore(db, sn);
        stores[sn] = { keyPath: storeKeyPath(db, sn), records };
        manifestStores.push({ store: sn, count: records.length });
      }
      dbDump[spec.name] = { version: db.version, stores };
      manifestDbs.push({ db: spec.name, version: db.version, stores: manifestStores });
    } finally { db.close(); }
  }

  const payload = { v: SNAPSHOT_VERSION, databases: dbDump };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const manifest = {
    v: SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    databases: manifestDbs,
    totalRecords: manifestDbs.reduce((n, d) => n + d.stores.reduce((m, s) => m + s.count, 0), 0),
    sha256: await sha256Hex(bytes),
  };
  return { bytes, manifest };
}

/** Inspect a snapshot blob's manifest without restoring it. */
export async function readSnapshotManifest(bytes) {
  const payload = JSON.parse(new TextDecoder().decode(asU8(bytes)));
  const databases = Object.entries(payload.databases || {}).map(([db, d]) => ({
    db,
    version: d.version,
    stores: Object.entries(d.stores).map(([store, s]) => ({ store, count: s.records.length })),
  }));
  return {
    v: payload.v,
    databases,
    totalRecords: databases.reduce((n, d) => n + d.stores.reduce((m, s) => m + s.count, 0), 0),
    sha256: await sha256Hex(asU8(bytes)),
  };
}

/**
 * Restore a snapshot blob back into IndexedDB. Each listed store is created if
 * missing, cleared, then re-populated. Returns the manifest of what was written.
 * @param {Uint8Array|ArrayBuffer} bytes
 * @param {{indexedDB?: IDBFactory}} [opts]
 */
export async function restoreSnapshot(bytes, opts = {}) {
  const idb = opts.indexedDB || globalThis.indexedDB;
  const payload = JSON.parse(new TextDecoder().decode(asU8(bytes)));
  if (!payload || !payload.databases) throw new Error('Not a valid edot snapshot.');

  const restored = [];
  for (const [dbName, dump] of Object.entries(payload.databases)) {
    const storeNames = Object.keys(dump.stores);
    // Bump the version if we must add stores the current DB lacks. Opening with
    // a version >= existing triggers onupgradeneeded where stores are created.
    const targetVersion = await neededVersion(idb, dbName, dump.version, storeNames);
    const db = await openForRestore(idb, dbName, targetVersion, dump.stores);
    try {
      const wroteStores = [];
      for (const [sn, sdump] of Object.entries(dump.stores)) {
        const n = await writeStore(db, sn, sdump.records);
        wroteStores.push({ store: sn, count: n });
      }
      restored.push({ db: dbName, version: db.version, stores: wroteStores });
    } finally { db.close(); }
  }
  return { databases: restored, totalRecords: restored.reduce((n, d) => n + d.stores.reduce((m, s) => m + s.count, 0), 0) };
}

// ---- IndexedDB plumbing (promise-wrapped, mirrors data-engine.js) -----------

function dbExists(idb, name) {
  // databases() is widely supported; fall back to "open and check version".
  if (typeof idb.databases === 'function') {
    return idb.databases().then((list) => list.some((d) => d.name === name)).catch(() => true);
  }
  return Promise.resolve(true);
}

function openExisting(idb, name) {
  return new Promise((resolve, reject) => {
    const r = idb.open(name);                     // no version: opens current
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error(`IndexedDB "${name}" is blocked by another tab.`));
  });
}

function resolveStores(db, spec) {
  const all = Array.from(db.objectStoreNames);
  if (!spec || spec === '*') return all;
  return (Array.isArray(spec) ? spec : [spec]).filter((s) => all.includes(s));
}

function storeKeyPath(db, sn) {
  const tx = db.transaction(sn, 'readonly');
  const kp = tx.objectStore(sn).keyPath;
  return kp == null ? null : kp;   // null => out-of-line keys; we store them explicitly
}

function readStore(db, sn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(sn, 'readonly');
    const store = tx.objectStore(sn);
    const out = [];
    const inlineKey = store.keyPath != null;     // inline keys live inside the value
    const cur = store.openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) return;            // done; resolution happens in tx.oncomplete
      out.push(inlineKey ? { value: encodeValue(c.value) }
                         : { key: encodeValue(c.key), value: encodeValue(c.value) });
      c.continue();
    };
    cur.onerror = () => reject(cur.error);
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
}

function writeStore(db, sn, records) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(sn)) {
      return reject(new Error(`Store "${sn}" missing after upgrade — cannot restore.`));
    }
    const tx = db.transaction(sn, 'readwrite');
    const store = tx.objectStore(sn);
    store.clear();
    for (const rec of records) {
      if ('key' in rec) store.put(decodeValue(rec.value), decodeValue(rec.key));
      else store.put(decodeValue(rec.value));    // inline key inside the value
    }
    tx.oncomplete = () => resolve(records.length);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error(`Restore of "${sn}" aborted.`));
  });
}

// Decide the version to open with for restore: at least the snapshot's, bumped
// by one if the live DB is missing any store we need to write.
async function neededVersion(idb, name, snapVersion, storeNames) {
  let liveVersion = 0; let liveStores = [];
  try {
    const db = await openExisting(idb, name);
    liveVersion = db.version; liveStores = Array.from(db.objectStoreNames); db.close();
  } catch { /* DB doesn't exist yet */ }
  const missing = storeNames.some((s) => !liveStores.includes(s));
  let v = Math.max(liveVersion, snapVersion || 1, 1);
  if (missing && v <= liveVersion) v = liveVersion + 1;   // force an upgrade tx
  return v;
}

function openForRestore(idb, name, version, storesDump) {
  return new Promise((resolve, reject) => {
    const r = idb.open(name, version);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const [sn, sdump] of Object.entries(storesDump)) {
        if (!db.objectStoreNames.contains(sn)) {
          // Recreate with the original keyPath so inline keys keep working.
          db.createObjectStore(sn, sdump.keyPath != null ? { keyPath: sdump.keyPath } : undefined);
        }
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error(`IndexedDB "${name}" is blocked by another tab.`));
  });
}

// ---- value (de)serialisation ------------------------------------------------
// JSON can't carry typed arrays. Tag byte values so the SQLite Uint8Array blob
// and friends survive the round-trip. Strings/numbers/plain objects pass through.

function encodeValue(v) {
  if (v instanceof Uint8Array) return { [BINARY_TAG]: b64(v) };
  if (v instanceof ArrayBuffer) return { [BINARY_TAG]: b64(new Uint8Array(v)) };
  if (Array.isArray(v)) return v.map(encodeValue);
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const out = {};
    for (const k of Object.keys(v)) out[k] = encodeValue(v[k]);
    return out;
  }
  return v;
}

function decodeValue(v) {
  if (v && typeof v === 'object') {
    if (typeof v[BINARY_TAG] === 'string') return unb64(v[BINARY_TAG]);
    if (Array.isArray(v)) return v.map(decodeValue);
    const out = {};
    for (const k of Object.keys(v)) out[k] = decodeValue(v[k]);
    return out;
  }
  return v;
}
