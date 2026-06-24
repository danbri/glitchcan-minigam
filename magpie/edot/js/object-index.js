// object-index.js — a tiny, storage-independent metadata index over the suite's
// DataObjects.
//
// It records WHAT exists — id, type, title, schema version, content fingerprint,
// timestamps, venue — and NEVER the body. It is deliberately separate from each
// app's body store (the editor library, the slides store, the SQLite engine):
// this is the single table that ACLs, sync state, full-text search and retention
// hang off in the Enterprise phase (see docs/research/pre-enterprise-foundations.md
// §2 and the backend's /index job in backend-and-capabilities.md). It reserves the
// governance seams (owner / labels / acl) and carries them losslessly until they
// are implemented (§4) — the "extension islands pass through unharmed" discipline.
//
// Local now, server-mirrored later. Isomorphic + storage-injectable (a
// localStorage-shaped { getItem, setItem }) so it unit-tests in pure Node.

const KEY = 'edot.objectIndex.v1';

// A localStorage-shaped in-memory store for Node/tests (and a private-mode fallback).
export function memoryStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

export class ObjectIndex {
  // storage: a localStorage-shaped { getItem, setItem }. Defaults to localStorage
  // in a browser, otherwise an in-memory store.
  constructor(storage, key = KEY) {
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : memoryStore());
    this.key = key;
    this._map = this._read();
  }

  _read() { try { return JSON.parse(this.storage.getItem(this.key) || '{}') || {}; } catch { return {}; } }
  _write() { try { this.storage.setItem(this.key, JSON.stringify(this._map)); } catch { /* quota / blocked */ } }

  // Insert or update an object's metadata. Only known fields are kept — the body
  // never enters the index. A partial upsert preserves prior fields (so a bare
  // { id, type, modifiedAt } touch doesn't wipe the title or fingerprint).
  upsert(entry) {
    if (!entry || !entry.id || !entry.type) throw new Error('index entry needs an id and a type');
    const prev = this._map[entry.id] || {};
    const modifiedAt = entry.modifiedAt ?? prev.modifiedAt ?? null;
    const rec = {
      id: entry.id,
      type: entry.type,
      title: entry.title ?? prev.title ?? '',
      schemaVersion: entry.schemaVersion ?? prev.schemaVersion ?? null,
      fingerprint: entry.fingerprint ?? prev.fingerprint ?? null,
      venue: entry.venue ?? prev.venue ?? 'local',
      createdAt: prev.createdAt ?? entry.createdAt ?? modifiedAt,
      modifiedAt,
      // Governance seams — reserved, carried through untouched until implemented (§4).
      owner: entry.owner ?? prev.owner ?? null,
      labels: entry.labels ?? prev.labels ?? null,
      acl: entry.acl ?? prev.acl ?? null,
    };
    this._map[entry.id] = rec;
    this._write();
    return rec;
  }

  get(id) { return this._map[id] || null; }
  has(id) { return Object.prototype.hasOwnProperty.call(this._map, id); }
  remove(id) { const had = this.has(id); delete this._map[id]; this._write(); return had; }
  get size() { return Object.keys(this._map).length; }

  // All records, most-recently-modified first.
  all() { return Object.values(this._map).sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0)); }
  byType(type) { return this.all().filter((r) => r.type === type); }

  // Substring search over title / type / id (the metadata search the /index job
  // will later do server-side over the full corpus).
  search(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return this.all();
    return this.all().filter((r) => `${r.title} ${r.type} ${r.id}`.toLowerCase().includes(q));
  }

  clear() { this._map = {}; this._write(); }
}
