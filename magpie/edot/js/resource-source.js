// resource-source.js — the unified STORAGE interface. A ResourceSource is a
// MOUNT: a namespace of folders and files you can list/read/write, regardless of
// whether it is local files, OPFS, a GitHub repo, S3, WebDAV, or a Solid pod.
// Backup backends, project save/open, and file open/save all converge on this
// one interface instead of four bespoke registries.
//
// Listings are LAZY / windowed (the recorded Mozilla-RDF-datasource lesson): a
// folder with 100k entries lists in O(window), never by materialising the tree.
//
// A ResourceSource implements:
//   id, provider, account?, capability:'storage'
//   list(dirPath, {offset,limit}): Entry[] | Promise<…>   // a directory window
//   read(path): bytes | Promise<bytes>
//   write(path, bytes): void | Promise<void>
//   remove(path): void | Promise<void>
//   stat(path): Entry|null | Promise<…>
//   mkdir(path): void | Promise<void>
// Entry = { name, path, kind:'folder'|'file', size?, mtime?, locality? }

import { PROVIDERS } from './ontology.js';

const norm = (p) => '/' + String(p == null ? '' : p).split('/').filter(Boolean).join('/');
const parentOf = (p) => { const n = norm(p); const i = n.lastIndexOf('/'); return i <= 0 ? '/' : n.slice(0, i); };
const baseName = (p) => norm(p).split('/').filter(Boolean).pop() || '';

// An in-memory ResourceSource — the reference implementation + the offline/test
// backend. Real backends (github/s3/webdav/solid/local-fs) implement the same
// interface over their transport.
export class MemoryResourceSource {
  constructor({ id = 'mem', provider = 'opfs', account = null, locality } = {}) {
    this.id = id; this.provider = provider; this.account = account; this.capability = 'storage';
    this.locality = locality || (PROVIDERS[provider] && PROVIDERS[provider].locality) || 'local';
    this._files = new Map();   // path -> { bytes, mtime }
    this._dirs = new Set(['/']); // explicit folders (also implied by file paths)
  }

  mkdir(path) { const p = norm(path); for (let d = p; d !== '/'; d = parentOf(d)) this._dirs.add(d); }
  write(path, bytes) { const p = norm(path); this.mkdir(parentOf(p)); this._files.set(p, { bytes, mtime: 0 }); }
  read(path) { const f = this._files.get(norm(path)); if (!f) throw new Error(`not found: ${path}`); return f.bytes; }
  remove(path) {
    const p = norm(path);
    if (this._files.has(p)) { this._files.delete(p); return; }
    // a folder: drop it and everything under it
    for (const k of [...this._files.keys()]) if (k === p || k.startsWith(p + '/')) this._files.delete(k);
    for (const d of [...this._dirs]) if (d === p || d.startsWith(p + '/')) this._dirs.delete(d);
  }
  stat(path) {
    const p = norm(path);
    if (this._files.has(p)) return { name: baseName(p), path: p, kind: 'file', size: this._files.get(p).bytes.length, locality: this.locality };
    if (this._dirs.has(p) || p === '/') return { name: baseName(p) || '/', path: p, kind: 'folder', locality: this.locality };
    return null;
  }

  // The lazy window. Computes the immediate children of dirPath, then slices.
  list(dirPath, { offset = 0, limit = 100 } = {}) {
    const dir = norm(dirPath);
    const prefix = dir === '/' ? '/' : dir + '/';
    const folders = new Set(), files = [];
    for (const d of this._dirs) { if (d !== dir && d.startsWith(prefix)) { const rest = d.slice(prefix.length); if (rest && !rest.includes('/')) folders.add(rest); } }
    for (const [f, meta] of this._files) {
      if (!f.startsWith(prefix)) continue;
      const rest = f.slice(prefix.length);
      if (!rest) continue;
      if (rest.includes('/')) folders.add(rest.split('/')[0]);
      else files.push({ name: rest, path: f, kind: 'file', size: meta.bytes.length, locality: this.locality });
    }
    const entries = [
      ...[...folders].sort().map((name) => ({ name, path: norm(prefix + name), kind: 'folder', locality: this.locality })),
      ...files.sort((a, b) => a.name.localeCompare(b.name)),
    ];
    return entries.slice(offset, offset + limit);
  }
  // Total immediate children (for a virtualised view's scrollbar).
  count(dirPath) { return this.list(dirPath, { offset: 0, limit: Infinity }).length; }
}

// A REAL local backend: the Origin Private File System (OPFS). Zero-prompt,
// browser-native, persistent. Same ResourceSource interface as everything else,
// so Projects/Backup/file-open can save here with no account or login. (OPFS has
// no random-access pagination, so list() collects a directory's entries then
// windows them — fine for app storage; remote paged sources handle the huge case.)
export class OpfsResourceSource {
  constructor({ id = 'opfs' } = {}) { this.id = id; this.provider = 'opfs'; this.account = null; this.capability = 'storage'; this.locality = 'local'; }
  async _root() { return navigator.storage.getDirectory(); }
  async _dir(path, create = false) {
    let h = await this._root();
    for (const seg of norm(path).split('/').filter(Boolean)) h = await h.getDirectoryHandle(seg, { create });
    return h;
  }
  async mkdir(path) { await this._dir(path, true); }
  async write(path, bytes) {
    const p = norm(path); const dir = await this._dir(parentOf(p), true);
    const fh = await dir.getFileHandle(baseName(p), { create: true });
    const w = await fh.createWritable(); await w.write(bytes); await w.close();
  }
  async read(path) {
    const p = norm(path); const dir = await this._dir(parentOf(p));
    const fh = await dir.getFileHandle(baseName(p)); const f = await fh.getFile();
    return new Uint8Array(await f.arrayBuffer());
  }
  async remove(path) { const p = norm(path); const dir = await this._dir(parentOf(p)); await dir.removeEntry(baseName(p), { recursive: true }); }
  async stat(path) {
    const p = norm(path); const dir = await this._dir(parentOf(p)).catch(() => null); if (!dir) return null;
    try { const f = await (await dir.getFileHandle(baseName(p))).getFile(); return { name: baseName(p), path: p, kind: 'file', size: f.size, mtime: f.lastModified, locality: 'local' }; } catch (_) {}
    try { await dir.getDirectoryHandle(baseName(p)); return { name: baseName(p) || '/', path: p, kind: 'folder', locality: 'local' }; } catch (_) {}
    return p === '/' ? { name: '/', path: '/', kind: 'folder', locality: 'local' } : null;
  }
  async list(dirPath, { offset = 0, limit = 100 } = {}) {
    const dir = await this._dir(dirPath); const folders = [], files = [];
    const base = norm(dirPath) === '/' ? '' : norm(dirPath);
    for await (const [name, h] of dir.entries()) {
      if (h.kind === 'directory') folders.push({ name, path: `${base}/${name}`, kind: 'folder', locality: 'local' });
      else { const f = await h.getFile(); files.push({ name, path: `${base}/${name}`, kind: 'file', size: f.size, mtime: f.lastModified, locality: 'local' }); }
    }
    folders.sort((a, b) => a.name.localeCompare(b.name)); files.sort((a, b) => a.name.localeCompare(b.name));
    return [...folders, ...files].slice(offset, offset + limit);
  }
}

// Bridge: present a flat blob store (the backup `stores/*` interface —
// put(key,bytes,cfg) / get(key,cfg) / list(cfg)->[{id,size,modified}] /
// remove(key,cfg)) as a ResourceSource. This is the unification — every backup
// backend (github/webdav/s3/solid) becomes a mount usable by Projects, a file
// dialog, anything — and lands in Connections. Folders are derived from '/' in
// keys (the store stays flat underneath).
export function storeResourceSource(store, cfg, { id = store.id, provider = store.id, locality = 'remote', account = null } = {}) {
  const keyOf = (path) => norm(path).replace(/^\//, '');
  return {
    id, provider, account, capability: 'storage', locality,
    async _keys() { return (await store.list(cfg)).map((it) => ({ key: it.id, size: it.size || 0, mtime: it.modified || 0 })); },
    async read(path) { return store.get(keyOf(path), cfg); },
    async write(path, bytes) { await store.put(keyOf(path), bytes, cfg); },
    async remove(path) { await store.remove(keyOf(path), cfg); },
    async mkdir() { /* flat store: directories are implicit in keys */ },
    async stat(path) {
      const k = keyOf(path); const items = await this._keys(); const f = items.find((i) => i.key === k);
      return f ? { name: baseName(path), path: norm(path), kind: 'file', size: f.size, mtime: f.mtime, locality } : null;
    },
    async list(dirPath, { offset = 0, limit = 100 } = {}) {
      const dir = norm(dirPath); const prefix = dir === '/' ? '' : dir.replace(/^\//, '') + '/';
      const items = await this._keys(); const folders = new Set(), files = [];
      for (const it of items) {
        if (prefix && !it.key.startsWith(prefix)) continue;
        const rest = it.key.slice(prefix.length); if (!rest) continue;
        if (rest.includes('/')) folders.add(rest.split('/')[0]);
        else files.push({ name: rest, path: norm('/' + prefix + rest), kind: 'file', size: it.size, mtime: it.mtime, locality });
      }
      const entries = [
        ...[...folders].sort().map((name) => ({ name, path: norm('/' + prefix + name), kind: 'folder', locality })),
        ...files.sort((a, b) => a.name.localeCompare(b.name)),
      ];
      return entries.slice(offset, offset + limit);
    },
  };
}

// An Account binds an Identity to a Provider and surfaces the capabilities it
// offers. capability('storage') returns a ResourceSource; other capabilities
// (mail/calendar/chat/people/vcs) return the matching service adapter.
export function makeAccount({ provider, identity = null, sources = {} } = {}) {
  const meta = PROVIDERS[provider] || { offers: [], auth: 'none', kind: 'platform', locality: 'remote' };
  return {
    provider, identity, meta,
    offers: meta.offers.slice(),
    requiresAuth: meta.auth !== 'none' && meta.auth !== 'grant',
    isLocal: meta.kind === 'os',
    capability(name) { return meta.offers.includes(name) ? (sources[name] || null) : null; },
  };
}
