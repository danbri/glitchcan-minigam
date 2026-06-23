// places-store.js — IndexedDB persistence for the user's saved places.
//
// Mirrors the idb open/get/put approach in ../../data/data-engine.js and
// ../../calendar/js/store.js: a single object store keyed by id, records are
// plain JSON. This is the ONLY thing the maps app persists, and it is entirely
// the user's own data — coordinates, a name, a note and a colour they chose. No
// dataset/personal content from any external source is stored (CLAUDE.md
// data-ethics rule).

const IDB_DB = 'edot-maps';
const IDB_VERSION = 1;
const STORE = 'places';

function idbOpen() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_DB, IDB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function reqDone(t) {
  return new Promise((res, rej) => { t.oncomplete = res; t.onabort = () => rej(t.error); t.onerror = () => rej(t.error); });
}

export class PlacesStore extends EventTarget {
  constructor() { super(); this.db = null; }

  async init() { this.db = await idbOpen(); return this; }

  async getAll() {
    const store = this.db.transaction(STORE).objectStore(STORE);
    const rows = await new Promise((res, rej) => { const rq = store.getAll(); rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error); });
    return rows.sort((a, b) => (a.created || 0) - (b.created || 0));
  }

  async put(place) {
    const t = this.db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put(place);
    await reqDone(t);
    this._changed();
    return place;
  }

  async putMany(places) {
    const t = this.db.transaction(STORE, 'readwrite');
    const s = t.objectStore(STORE);
    for (const p of places) s.put(p);
    await reqDone(t);
    this._changed();
  }

  async delete(id) {
    const t = this.db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).delete(id);
    await reqDone(t);
    this._changed();
  }

  async clearAll() {
    const t = this.db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).clear();
    await reqDone(t);
    this._changed();
  }

  _changed() { this.dispatchEvent(new Event('change')); }
}

// A stable-ish id for new places (no external deps; crypto.randomUUID when
// available, else a timestamp+random fallback).
export function newPlaceId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `p_${crypto.randomUUID()}`;
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
