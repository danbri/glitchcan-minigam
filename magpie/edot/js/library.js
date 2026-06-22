// library.js — persistent, multi-document local storage.
//
// This is what "stores locally" means for an office tool: a real document
// library, not a single autosave slot. Backed by IndexedDB (survives across
// sessions, large quota), with a localStorage fallback when IDB is blocked
// (e.g. some private-mode browsers). Documents are { id, title, html,
// createdAt, updatedAt }.

const DB = 'edot';
const STORE = 'documents';
const LS_KEY = 'edot.library.v1';

function uid() {
  return 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

class IdbLibrary {
  constructor(db) { this.db = db; }

  static open() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('no idb')); return; }
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('updatedAt', 'updatedAt');
        }
      };
      req.onsuccess = () => resolve(new IdbLibrary(req.result));
      req.onerror = () => reject(req.error);
    });
  }

  _tx(mode) { return this.db.transaction(STORE, mode).objectStore(STORE); }
  _p(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }

  async put(doc) { await this._p(this._tx('readwrite').put(doc)); return doc; }
  get(id) { return this._p(this._tx('readonly').get(id)); }
  async remove(id) { await this._p(this._tx('readwrite').delete(id)); }
  async list() {
    const all = await this._p(this._tx('readonly').getAll());
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

class LocalLibrary {
  constructor() { this.map = this._read(); }
  _read() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } }
  _write() { try { localStorage.setItem(LS_KEY, JSON.stringify(this.map)); } catch { /* quota */ } }
  async put(doc) { this.map[doc.id] = doc; this._write(); return doc; }
  async get(id) { return this.map[id] || null; }
  async remove(id) { delete this.map[id]; this._write(); }
  async list() { return Object.values(this.map).sort((a, b) => b.updatedAt - a.updatedAt); }
}

export class Library {
  constructor(backend, kind) { this.backend = backend; this.kind = kind; }

  static async create() {
    try { return new Library(await IdbLibrary.open(), 'IndexedDB'); }
    catch { return new Library(new LocalLibrary(), 'localStorage'); }
  }

  async listDocs() { return this.backend.list(); }
  async getDoc(id) { return this.backend.get(id); }
  async deleteDoc(id) { return this.backend.remove(id); }

  // Create a new document record and return it.
  async createDoc(title, html) {
    const now = Date.now();
    return this.backend.put({ id: uid(), title: title || 'Untitled document', html: html || '<p><br></p>', createdAt: now, updatedAt: now });
  }

  // Upsert an existing document (used by autosave).
  async saveDoc(doc) {
    return this.backend.put({ ...doc, updatedAt: Date.now() });
  }
}
