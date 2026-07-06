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

// Shared base for backends that are a tree of Web File System directory handles:
// OPFS (the app's private store) and a user-picked local folder (File System
// Access). Subclasses only supply _root(). Same ResourceSource interface as every
// other mount. (Directory handles have no random-access pagination, so list()
// reads a directory's entries then windows them — fine for local folders.)
class DirectoryResourceSource {
  constructor({ id, provider, locality = 'local' }) { this.id = id; this.provider = provider; this.account = null; this.capability = 'storage'; this.locality = locality; }
  async _root() { throw new Error('abstract: subclass provides the root directory handle'); }
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
    try { const f = await (await dir.getFileHandle(baseName(p))).getFile(); return { name: baseName(p), path: p, kind: 'file', size: f.size, mtime: f.lastModified, locality: this.locality }; } catch (_) {}
    try { await dir.getDirectoryHandle(baseName(p)); return { name: baseName(p) || '/', path: p, kind: 'folder', locality: this.locality }; } catch (_) {}
    return p === '/' ? { name: '/', path: '/', kind: 'folder', locality: this.locality } : null;
  }
  async list(dirPath, { offset = 0, limit = 100 } = {}) {
    const dir = await this._dir(dirPath); const folders = [], files = [];
    const base = norm(dirPath) === '/' ? '' : norm(dirPath);
    for await (const [name, h] of dir.entries()) {
      if (h.kind === 'directory') folders.push({ name, path: `${base}/${name}`, kind: 'folder', locality: this.locality });
      else { const f = await h.getFile(); files.push({ name, path: `${base}/${name}`, kind: 'file', size: f.size, mtime: f.lastModified, locality: this.locality }); }
    }
    folders.sort((a, b) => a.name.localeCompare(b.name)); files.sort((a, b) => a.name.localeCompare(b.name));
    return [...folders, ...files].slice(offset, offset + limit);
  }
}

// OPFS — the app's private store. Zero-prompt, persistent, no login.
export class OpfsResourceSource extends DirectoryResourceSource {
  constructor({ id = 'opfs' } = {}) { super({ id, provider: 'opfs', locality: 'local' }); }
  async _root() { return navigator.storage.getDirectory(); }
}

// A user-chosen LOCAL FOLDER via the File System Access API — the OS tier: access
// is capability-granted by the OS (a folder-picker prompt), no remote identity.
// pick() must be called from a user gesture. (Not exercisable headless — there is
// no real folder picker in CI — but it's the same DirectoryResourceSource code
// path proven by OPFS.)
export class LocalFsResourceSource extends DirectoryResourceSource {
  constructor({ id = 'local-fs', handle = null } = {}) { super({ id, provider: 'local-fs', locality: 'local' }); this._handle = handle; }
  async _root() { if (!this._handle) throw new Error('No folder chosen — call pick() first'); return this._handle; }
  get ready() { return !!this._handle; }
  // Prompt the user to grant a folder (read/write). Resolves true on grant.
  async pick() {
    if (typeof showDirectoryPicker !== 'function') throw new Error('File System Access API unavailable in this browser');
    this._handle = await showDirectoryPicker({ mode: 'readwrite' });
    return true;
  }
  // Re-confirm permission on a remembered handle (handles can be persisted via IDB).
  async ensurePermission() {
    if (!this._handle) return false;
    if ((await this._handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
    return (await this._handle.requestPermission({ mode: 'readwrite' })) === 'granted';
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

// A REAL remote storage mount over the GitHub Contents API — arbitrary paths and
// directories (unlike the backup github store, which flattens keys into opaque
// `edot-backups/<id>.enc` blobs). api.github.com is CORS-enabled, so the browser
// reaches it directly with a token. Writes commit straight to a branch; the
// editor's "open a pull request" flow stays a separate, GitHub-specific action.
// `fetchImpl` is injectable so the request shaping is unit-testable offline.
const ghB64 = (bytes) => { const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); let bin = ''; for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(bin); };
const ghBytes = (b64) => { const bin = atob(String(b64).replace(/\s/g, '')); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };

export class GitHubResourceSource {
  constructor({ id, repo, token, branch = '', fetchImpl } = {}) {
    const [owner, name] = String(repo || '').split('/');
    if (!owner || !name) throw new Error('GitHub: repo must be "owner/name"');
    this.id = id || `github-${owner}-${name}`;
    this.provider = 'github'; this.capability = 'storage'; this.locality = 'remote';
    this.account = null; this.repo = `${owner}/${name}`;
    this._owner = owner; this._name = name; this._token = token; this._branch = branch;
    this._fetch = fetchImpl || ((...a) => fetch(...a));
  }
  async _req(method, path, body) {
    const res = await this._fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        ...(this._token ? { Authorization: `Bearer ${this._token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text }; }
    if (!res.ok) { const e = new Error(json.message || `GitHub ${res.status}`); e.status = res.status; e.data = json; throw e; }
    return json;
  }
  _enc(p) { return norm(p).split('/').filter(Boolean).map(encodeURIComponent).join('/'); }
  _ref() { return this._branch ? `?ref=${encodeURIComponent(this._branch)}` : ''; }
  async _sha(path) { try { return (await this._req('GET', `/repos/${this._owner}/${this._name}/contents/${this._enc(path)}${this._ref()}`)).sha; } catch (e) { if (e.status === 404) return null; throw e; } }

  async read(path) {
    const j = await this._req('GET', `/repos/${this._owner}/${this._name}/contents/${this._enc(path)}${this._ref()}`);
    if (Array.isArray(j)) throw new Error(`Not a file: ${path}`);
    if (j.encoding !== 'base64') throw new Error('GitHub: unexpected file encoding');
    return ghBytes(j.content);
  }
  async write(path, bytes, { message } = {}) {
    const sha = await this._sha(path);
    return this._req('PUT', `/repos/${this._owner}/${this._name}/contents/${this._enc(path)}`, {
      message: message || `edot: update ${norm(path)}`, content: ghB64(bytes),
      ...(this._branch ? { branch: this._branch } : {}), ...(sha ? { sha } : {}),
    });
  }
  async remove(path) {
    const sha = await this._sha(path);
    if (!sha) return;
    return this._req('DELETE', `/repos/${this._owner}/${this._name}/contents/${this._enc(path)}`, {
      message: `edot: remove ${norm(path)}`, sha, ...(this._branch ? { branch: this._branch } : {}),
    });
  }
  async mkdir() { /* git has no empty directories — folders exist only via files */ }
  async stat(path) {
    let j; try { j = await this._req('GET', `/repos/${this._owner}/${this._name}/contents/${this._enc(path)}${this._ref()}`); } catch (e) { if (e.status === 404) return null; throw e; }
    if (Array.isArray(j)) return { name: baseName(path) || '/', path: norm(path), kind: 'folder', locality: 'remote' };
    return { name: baseName(path), path: norm(path), kind: 'file', size: j.size, locality: 'remote' };
  }
  async list(dirPath, { offset = 0, limit = 100 } = {}) {
    let items; try { items = await this._req('GET', `/repos/${this._owner}/${this._name}/contents/${this._enc(dirPath)}${this._ref()}`); } catch (e) { if (e.status === 404) return []; throw e; }
    if (!Array.isArray(items)) return []; // a file path, not a directory
    const entries = items.map((it) => ({ name: it.name, path: norm('/' + it.path), kind: it.type === 'dir' ? 'folder' : 'file', size: it.size, locality: 'remote' }))
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1));
    return entries.slice(offset, offset + limit);
  }
  // Cheap reachability/auth probe used by the Connections "Connect" flow.
  async verify() { await this._req('GET', `/repos/${this._owner}/${this._name}`); return true; }
}

// A REAL remote storage mount over WebDAV — the standards-native networked
// filesystem (Nextcloud, ownCloud, Apache mod_dav, …). WebDAV is hierarchical,
// so it maps straight onto ResourceSource: PROPFIND=list/stat, GET=read,
// PUT=write, DELETE=remove, MKCOL=mkdir. Namespace-agnostic XML parsing (the
// same regex approach as backup/js/stores/webdav.js — works without DOMParser,
// so it's unit-testable in Node). Basic auth; `fetchImpl` injectable.
// (CORS: a browser needs the server to allow the origin + PROPFIND/MKCOL — a
// deployment concern; the protocol is fully implemented here.)
function davResponses(xml) {
  const out = [], re = /<(?:\w+:)?response[\s>]([\s\S]*?)<\/(?:\w+:)?response>/g;
  const pick = (b, t) => { const m = new RegExp(`<(?:\\w+:)?${t}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${t}>`).exec(b); return m ? m[1].trim() : ''; };
  let m;
  while ((m = re.exec(xml))) {
    const b = m[1], href = decodeURIComponent(pick(b, 'href'));
    if (!href) continue;
    out.push({
      href,
      isCollection: /<(?:\w+:)?resourcetype[^>]*>[\s\S]*?<(?:\w+:)?collection/.test(b),
      size: Number(pick(b, 'getcontentlength')) || 0,
      mtime: pick(b, 'getlastmodified') || null,
    });
  }
  return out;
}

export class WebDavResourceSource {
  constructor({ id, baseUrl, user, password, fetchImpl } = {}) {
    if (!baseUrl) throw new Error('WebDAV: baseUrl is required');
    this.provider = 'webdav'; this.capability = 'storage'; this.locality = 'remote'; this.account = null;
    this._base = String(baseUrl).replace(/\/+$/, '');
    this.id = id || 'webdav-' + this._base.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    this._basePath = (() => { try { return new URL(this._base + '/').pathname; } catch { return '/'; } })();
    this._headers = {};
    if (user != null) this._headers.Authorization = 'Basic ' + btoa(unescape(encodeURIComponent(`${user}:${password || ''}`)));
    this._fetch = fetchImpl || ((...a) => fetch(...a));
  }
  _url(p, dir = false) { const segs = norm(p).split('/').filter(Boolean).map(encodeURIComponent); return this._base + '/' + segs.join('/') + (dir && segs.length ? '/' : ''); }
  _relPath(href) { let hp; try { hp = new URL(href, this._base).pathname; } catch { hp = href; } const rel = hp.slice(this._basePath.length).replace(/\/+$/, ''); return rel; }

  async read(path) {
    const res = await this._fetch(this._url(path), { method: 'GET', headers: this._headers });
    if (!res.ok) { const e = new Error(`WebDAV GET ${res.status}`); e.status = res.status; throw e; }
    return new Uint8Array(await res.arrayBuffer());
  }
  async mkdir(path) {
    // Create each missing ancestor collection (MKCOL is non-recursive).
    const segs = norm(path).split('/').filter(Boolean); let cur = '';
    for (const s of segs) {
      cur += '/' + s;
      const res = await this._fetch(this._url(cur, true), { method: 'MKCOL', headers: this._headers });
      if (!res.ok && res.status !== 405 && res.status !== 301) { const e = new Error(`WebDAV MKCOL ${res.status}`); e.status = res.status; throw e; } // 405 = exists
    }
  }
  async write(path, bytes) {
    const parent = parentOf(path);
    if (parent !== '/') await this.mkdir(parent);
    const res = await this._fetch(this._url(path), { method: 'PUT', headers: { ...this._headers, 'Content-Type': 'application/octet-stream' }, body: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes) });
    if (!res.ok && res.status !== 201 && res.status !== 204) { const e = new Error(`WebDAV PUT ${res.status}`); e.status = res.status; throw e; }
  }
  async remove(path) {
    const res = await this._fetch(this._url(path), { method: 'DELETE', headers: this._headers });
    if (!res.ok && res.status !== 204 && res.status !== 404) { const e = new Error(`WebDAV DELETE ${res.status}`); e.status = res.status; throw e; }
  }
  async stat(path) {
    const res = await this._fetch(this._url(path), { method: 'PROPFIND', headers: { ...this._headers, Depth: '0', 'Content-Type': 'application/xml' } });
    if (res.status === 404) return null;
    if (!res.ok && res.status !== 207) { const e = new Error(`WebDAV PROPFIND ${res.status}`); e.status = res.status; throw e; }
    const r = davResponses(await res.text())[0]; if (!r) return null;
    return r.isCollection
      ? { name: baseName(path) || '/', path: norm(path), kind: 'folder', locality: 'remote' }
      : { name: baseName(path), path: norm(path), kind: 'file', size: r.size, locality: 'remote' };
  }
  async list(dirPath, { offset = 0, limit = 100 } = {}) {
    const res = await this._fetch(this._url(dirPath, true), { method: 'PROPFIND', headers: { ...this._headers, Depth: '1', 'Content-Type': 'application/xml' } });
    if (res.status === 404) return [];
    if (!res.ok && res.status !== 207) { const e = new Error(`WebDAV PROPFIND ${res.status}`); e.status = res.status; throw e; }
    const selfRel = norm(dirPath).replace(/^\//, '');
    const entries = [];
    for (const r of davResponses(await res.text())) {
      const rel = this._relPath(r.href);
      if (rel === '' || rel === selfRel) continue;             // the collection itself
      const name = rel.split('/').pop();
      entries.push({ name, path: norm('/' + rel), kind: r.isCollection ? 'folder' : 'file', size: r.size, locality: 'remote' });
    }
    entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1));
    return entries.slice(offset, offset + limit);
  }
  // Reachability/auth probe for the Connections "Connect" flow.
  async verify() { const res = await this._fetch(this._url('/', true), { method: 'PROPFIND', headers: { ...this._headers, Depth: '0' } }); if (!res.ok && res.status !== 207) { const e = new Error(`WebDAV ${res.status}`); e.status = res.status; throw e; } return true; }
}

// An Account binds an Identity to a Provider and surfaces the capabilities it
// offers. capability('storage') returns a ResourceSource; other capabilities
// (mail/calendar/chat/people/vcs) return the matching service adapter.
export function makeAccount({ provider, identity = null, sources = {} } = {}) {
  const meta = PROVIDERS[provider] || { offers: [], auth: 'none', kind: 'platform', locality: 'remote' };
  // An account offers a capability if the provider DECLARES it (catalogue
  // metadata) OR a live adapter is WIRED for it (sources). This lets a generic
  // adapter (a JMAP/IMAP mailbox, a custom backend) offer its capability even
  // when the provider isn't in the catalogue, while still listing declared-but-
  // unwired capabilities (e.g. a MIX channel's calendar node before it's built).
  const offers = [...new Set([...meta.offers, ...Object.keys(sources)])];
  return {
    provider, identity, meta,
    offers,
    requiresAuth: meta.auth !== 'none' && meta.auth !== 'grant',
    isLocal: meta.kind === 'os',
    capability(name) { return offers.includes(name) ? (sources[name] || null) : null; },
  };
}
