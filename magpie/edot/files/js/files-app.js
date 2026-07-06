// files-app.js — <edot-files>: a file browser over the unified STORAGE layer.
// This is the concrete "window of files/folders" the ResourceSource model
// enables: one viewer that works against any mount (OPFS device storage today,
// GitHub/WebDAV/S3/Solid tomorrow) because every backend speaks the same
// list/read/write/remove/stat/mkdir interface.
//
// Listings are LAZY / windowed: we ask the mount for one page at a time via
// list(path, {offset, limit}) and surface a "Load more" control when a window
// fills — never materialising a folder that might hold 100k entries.
import { getKernel } from '../../js/edot-kernel.js';
import { OpfsResourceSource } from '../../js/resource-source.js';

const PAGE = 50; // small on purpose, to prove windowing

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = (p) => '/' + String(p == null ? '' : p).split('/').filter(Boolean).join('/');
const join = (dir, name) => norm(norm(dir) === '/' ? '/' + name : norm(dir) + '/' + name);
const fmtSize = (n) => {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};
// Decide whether bytes are valid UTF-8 text (so we can show them in a panel).
function decodeText(bytes) {
  try {
    const txt = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // Reject binary-ish content with NULs even if it technically decoded.
    if (txt.includes('\0')) return null;
    return txt;
  } catch (_) { return null; }
}

class EdotFiles extends HTMLElement {
  connectedCallback() {
    if (this._mounted) return; this._mounted = true;
    this.mount = null;          // active ResourceSource
    this.mounts = [];           // [{id,label}]
    this.path = '/';            // current folder
    this.entries = [];          // accumulated window(s) for the current folder
    this.offset = 0;            // next list() offset
    this.hasMore = false;       // last window was full → maybe more
    this.render();
    this.init();
  }

  // ---- mounts ----
  async init() {
    let kernel = null;
    try { kernel = getKernel(); } catch (_) { /* kernel optional */ }
    // Discover storage connections (if Connections has been wired).
    if (kernel) {
      try {
        const listed = kernel.capabilities.invoke('connections.list', { capability: 'storage' });
        if (Array.isArray(listed)) this.mounts = listed.map((a) => ({ id: a.id, label: a.label || a.id, provider: a.provider }));
      } catch (_) { /* connections optional */ }
    }
    // Resolve the device mount via the kernel; fall back to a fresh OPFS source.
    let mount = null;
    if (kernel) { try { mount = kernel.capabilities.invoke('storage.source', { id: 'device' }); } catch (_) {} }
    if (!mount) { mount = new OpfsResourceSource({ id: 'device' }); }
    if (!this.mounts.some((m) => m.id === (mount.id || 'device'))) {
      this.mounts.unshift({ id: mount.id || 'device', label: 'This device', provider: mount.provider || 'opfs' });
    }
    this.mount = mount;
    this._renderMountPicker();
    await this.navigate('/');
  }

  async selectMount(id) {
    let mount = null;
    try { mount = getKernel().capabilities.invoke('storage.source', { id }); } catch (_) {}
    if (!mount) { this._setStatus(`Could not open mount "${id}".`); return; }
    this.mount = mount;
    await this.navigate('/');
  }

  // ---- navigation + lazy listing ----
  async navigate(path) {
    this.path = norm(path);
    this.entries = [];
    this.offset = 0;
    this.hasMore = false;
    this._renderBreadcrumb();
    this._setStatus('Loading…');
    await this.loadMore(true);
  }

  async loadMore(first = false) {
    if (!this.mount) return;
    try {
      const win = await this.mount.list(this.path, { offset: this.offset, limit: PAGE });
      this.entries = this.entries.concat(win);
      this.offset += win.length;
      this.hasMore = win.length === PAGE; // a full window may have a next page
      this._renderList();
      this._setStatus(first
        ? (this.entries.length ? `${this.entries.length} item${this.entries.length === 1 ? '' : 's'}.` : 'Empty folder.')
        : `Showing ${this.entries.length} item${this.entries.length === 1 ? '' : 's'}.`);
    } catch (e) {
      this._setStatus(`Could not list ${this.path}: ${e.message}`);
    }
  }

  // ---- file/folder actions ----
  async openEntry(entry) {
    if (entry.kind === 'folder') { await this.navigate(entry.path); return; }
    this._setStatus(`Opening ${entry.name}…`);
    let bytes;
    try { bytes = await this.mount.read(entry.path); } catch (e) { this._setStatus(`Could not read ${entry.name}: ${e.message}`); return; }
    const text = decodeText(bytes);
    if (text != null) { this._showText(entry, text); }
    else { this._offerDownload(entry, bytes); }
  }

  async newFolder() {
    const name = (prompt('New folder name:', '') || '').trim();
    if (!name) return;
    if (name.includes('/')) { this._setStatus('Folder names can’t contain "/".'); return; }
    try {
      await this.mount.mkdir(join(this.path, name));
      this._setStatus(`Created folder "${name}".`);
      await this.navigate(this.path);
    } catch (e) { this._setStatus(`Could not create folder: ${e.message}`); }
  }

  async deleteEntry(entry) {
    const what = entry.kind === 'folder' ? `folder "${entry.name}" and everything in it` : `file "${entry.name}"`;
    if (!confirm(`Delete ${what}? This cannot be undone.`)) return;
    try {
      await this.mount.remove(entry.path);
      this._setStatus(`Deleted "${entry.name}".`);
      await this.navigate(this.path);
    } catch (e) { this._setStatus(`Could not delete ${entry.name}: ${e.message}`); }
  }

  async uploadFiles(fileList) {
    const files = [...(fileList || [])];
    if (!files.length) return;
    let done = 0;
    for (const f of files) {
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        await this.mount.write(join(this.path, f.name), bytes);
        done++;
      } catch (e) { this._setStatus(`Upload failed for ${f.name}: ${e.message}`); }
    }
    if (done) { this._setStatus(`Uploaded ${done} file${done === 1 ? '' : 's'}.`); await this.navigate(this.path); }
  }

  // ---- UI ----
  render() {
    this.innerHTML = `
      <div class="fl-app">
        <header class="fl-head">
          <div class="fl-mounts"></div>
          <nav class="fl-breadcrumb" aria-label="Folder path"></nav>
          <div class="fl-actions">
            <button class="fl-btn fl-new" type="button" title="New folder">📁＋ New folder</button>
            <label class="fl-btn fl-upload-label" title="Upload a file">⬆ Upload
              <input class="fl-upload" type="file" multiple hidden aria-label="Upload file">
            </label>
          </div>
        </header>
        <div class="fl-status" role="status" aria-live="polite"></div>
        <ul class="fl-list" aria-label="Files and folders"></ul>
        <div class="fl-more"></div>
        <div class="fl-viewer" hidden></div>
      </div>`;
    this.querySelector('.fl-new').addEventListener('click', () => this.newFolder());
    this.querySelector('.fl-upload').addEventListener('change', (e) => { this.uploadFiles(e.target.files); e.target.value = ''; });
  }

  _setStatus(msg) { const s = this.querySelector('.fl-status'); if (s) s.textContent = msg || ''; }

  _renderMountPicker() {
    const host = this.querySelector('.fl-mounts'); if (!host) return;
    // Only show a picker when there is a genuine choice.
    if (this.mounts.length <= 1) { host.innerHTML = ''; return; }
    const sel = document.createElement('select');
    sel.className = 'fl-mount-select';
    sel.setAttribute('aria-label', 'Storage location');
    const GLYPH = { opfs: '📦', 'local-fs': '💻', github: '🐙', s3: '🪣', webdav: '🗄', solid: '🪪' };
    for (const m of this.mounts) {
      const opt = document.createElement('option');
      opt.value = m.id; opt.textContent = `${GLYPH[m.provider] || '💾'} ${m.label}`;
      if (this.mount && m.id === (this.mount.id || 'device')) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => this.selectMount(sel.value));
    host.innerHTML = '';
    const lbl = document.createElement('span'); lbl.className = 'fl-mount-lbl'; lbl.textContent = '💾';
    host.appendChild(lbl); host.appendChild(sel);
  }

  _renderBreadcrumb() {
    const nav = this.querySelector('.fl-breadcrumb'); if (!nav) return;
    nav.innerHTML = '';
    const segs = this.path.split('/').filter(Boolean);
    const crumbs = [{ name: 'Home', path: '/' }];
    let acc = '';
    for (const s of segs) { acc += '/' + s; crumbs.push({ name: s, path: acc }); }
    crumbs.forEach((c, i) => {
      const last = i === crumbs.length - 1;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fl-crumb';
      b.textContent = c.name;
      if (last) b.setAttribute('aria-current', 'location');
      b.addEventListener('click', () => this.navigate(c.path));
      nav.appendChild(b);
      if (!last) { const sep = document.createElement('span'); sep.className = 'fl-sep'; sep.textContent = '›'; sep.setAttribute('aria-hidden', 'true'); nav.appendChild(sep); }
    });
  }

  _renderList() {
    const list = this.querySelector('.fl-list'); if (!list) return;
    list.innerHTML = '';
    if (!this.entries.length) {
      const li = document.createElement('li'); li.className = 'fl-empty'; li.textContent = 'This folder is empty.';
      list.appendChild(li);
    }
    for (const entry of this.entries) {
      const li = document.createElement('li');
      li.className = 'fl-row';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'fl-open ' + (entry.kind === 'folder' ? 'is-folder' : 'is-file');
      const verb = entry.kind === 'folder' ? 'Open folder' : 'Open file';
      open.setAttribute('aria-label', `${verb} ${entry.name}`);
      const icon = entry.kind === 'folder' ? '📁' : '📄';
      const meta = entry.kind === 'file' ? fmtSize(entry.size) : 'folder';
      open.innerHTML =
        `<span class="fl-icon" aria-hidden="true">${icon}</span>` +
        `<span class="fl-name">${esc(entry.name)}</span>` +
        `<span class="fl-meta">${esc(meta)}</span>`;
      open.addEventListener('click', () => this.openEntry(entry));
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'fl-del';
      del.setAttribute('aria-label', `Delete ${entry.name}`);
      del.textContent = '🗑';
      del.addEventListener('click', () => this.deleteEntry(entry));
      li.appendChild(open); li.appendChild(del);
      list.appendChild(li);
    }
    this._renderMore();
  }

  _renderMore() {
    const host = this.querySelector('.fl-more'); if (!host) return;
    host.innerHTML = '';
    if (!this.hasMore) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fl-load-more';
    b.textContent = 'Load more…';
    b.addEventListener('click', () => this.loadMore(false));
    host.appendChild(b);
  }

  _showText(entry, text) {
    const v = this.querySelector('.fl-viewer'); if (!v) return;
    v.hidden = false;
    v.innerHTML = '';
    const head = document.createElement('div'); head.className = 'fl-viewer-head';
    const title = document.createElement('span'); title.className = 'fl-viewer-title'; title.textContent = entry.name;
    const close = document.createElement('button'); close.type = 'button'; close.className = 'fl-viewer-close'; close.setAttribute('aria-label', 'Close preview'); close.textContent = '✕';
    close.addEventListener('click', () => { v.hidden = true; v.innerHTML = ''; });
    head.appendChild(title); head.appendChild(close);
    const pre = document.createElement('pre'); pre.className = 'fl-viewer-body'; pre.textContent = text;
    v.appendChild(head); v.appendChild(pre);
    this._setStatus(`Viewing ${entry.name} (${fmtSize(entry.size)}).`);
  }

  _offerDownload(entry, bytes) {
    const v = this.querySelector('.fl-viewer'); if (!v) return;
    v.hidden = false;
    v.innerHTML = '';
    const head = document.createElement('div'); head.className = 'fl-viewer-head';
    const title = document.createElement('span'); title.className = 'fl-viewer-title'; title.textContent = entry.name;
    const close = document.createElement('button'); close.type = 'button'; close.className = 'fl-viewer-close'; close.setAttribute('aria-label', 'Close preview'); close.textContent = '✕';
    close.addEventListener('click', () => { v.hidden = true; v.innerHTML = ''; });
    head.appendChild(title); head.appendChild(close);
    const body = document.createElement('div'); body.className = 'fl-viewer-binary';
    const note = document.createElement('p'); note.textContent = `This file isn’t UTF-8 text (${fmtSize(bytes.length)}). Download it instead:`;
    const a = document.createElement('a');
    a.className = 'fl-download';
    a.download = entry.name;
    try { a.href = URL.createObjectURL(new Blob([bytes])); } catch (_) { a.href = '#'; }
    a.textContent = `⬇ Download ${entry.name}`;
    body.appendChild(note); body.appendChild(a);
    v.appendChild(head); v.appendChild(body);
    this._setStatus(`${entry.name} is a binary file.`);
  }
}

if (!customElements.get('edot-files')) customElements.define('edot-files', EdotFiles);
export { EdotFiles };
