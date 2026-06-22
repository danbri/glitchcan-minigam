// edot-app.js — application bootstrap. Wires the editor, toolbar, file menu,
// the local document library, status bar, autosave, and drag-and-drop.
// Behaviour lives in the focused modules it imports; this is the glue.

import { Editor } from './editor.js';
import { Toolbar } from './toolbar.js';
import { Announcer } from './a11y.js';
import { Library } from './library.js';
import { FindReplace } from './find-replace.js';
import * as IO from './io.js';
import * as LO from './libreoffice-bridge.js';

const LAST_DOC_KEY = 'edot.currentDoc';

class App {
  constructor() {
    this.announcer = new Announcer();
    this.announce = (m, o) => this.announcer.toast(m, o);

    this.editorEl = document.getElementById('editor');
    this.editor = new Editor(this.editorEl);
    this.toolbar = new Toolbar(document.getElementById('toolbar'), this.editor, this.announce);
    this.findReplace = new FindReplace(this.editor, this.announce);

    this.titleInput = document.getElementById('doc-title');
    this.saveState = document.getElementById('save-state');
    this.statWords = document.getElementById('stat-words');
    this.statChars = document.getElementById('stat-chars');
    this.fileInput = document.getElementById('file-input');

    this.doc = null;           // current library record { id, title, html, ... }
    this.lastExportExt = 'docx';
    this._saveTimer = null;

    this._wireEditor();
    this._wireMenu();
    this._wireTitle();
    this._wireDialog();
    this._wireGlobalKeys();
    this._wireDragDrop();
    this._reflectBackend();
    this._boot();
  }

  async _boot() {
    this.library = await Library.create();
    const docsNote = document.getElementById('docs-storage');
    if (docsNote) docsNote.textContent = `Stored locally in this browser (${this.library.kind}). Documents never leave your device.`;

    // Restore the last-open document, else the most recent, else a welcome doc.
    let doc = null;
    const lastId = this._lastId();
    if (lastId) doc = await this.library.getDoc(lastId);
    if (!doc) {
      const all = await this.library.listDocs();
      doc = all[0] || null;
    }
    if (!doc) doc = await this.library.createDoc('Welcome to edot', WELCOME);

    this._loadDoc(doc, { announce: false });
    this.announce('Document ready');
  }

  _lastId() { try { return localStorage.getItem(LAST_DOC_KEY); } catch { return null; } }
  _rememberId(id) { try { localStorage.setItem(LAST_DOC_KEY, id); } catch { /* ignore */ } }

  _loadDoc(doc, { announce = true } = {}) {
    this.doc = doc;
    this.titleInput.value = doc.title;
    this.editor.setContent(doc.html);
    this._rememberId(doc.id);
    this._refreshStats();
    this._markClean();
    this.editor.focus();
    if (announce) this.announce(`Opened “${doc.title}”`);
  }

  _wireEditor() {
    this.editor.onSelectionCallback(() => this.toolbar.refresh());
    this.editor.onChangeCallback(() => {
      this._refreshStats();
      this._markDirty();
      this._scheduleSave();
      this.toolbar.refresh();
    });
  }

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      if (!this.doc || !this.library) return;
      this.doc.html = this.editor.getContent();
      this.doc.title = this.titleInput.value.trim() || 'Untitled document';
      this.doc = await this.library.saveDoc(this.doc);
      this._markClean();
    }, 500);
  }

  _wireTitle() {
    this.titleInput.addEventListener('input', () => { this._markDirty(); this._scheduleSave(); });
    this.titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.editor.focus(); }
    });
  }

  // ---- File menu ----
  _wireMenu() {
    const button = document.getElementById('menu-button');
    const panel = document.getElementById('menu-panel');

    const exportList = document.getElementById('export-list');
    for (const fmt of IO.exportFormats()) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu-item';
      item.setAttribute('role', 'menuitem');
      item.innerHTML = `<span>Save as ${esc(fmt.label)}</span>` +
        (fmt.wasm ? '<span class="hint">WASM</span>' : `<span class="hint">.${fmt.ext}</span>`);
      item.addEventListener('click', () => { this._closeMenu(); this.exportAs(fmt.ext); });
      exportList.appendChild(item);
    }

    document.getElementById('mi-new').addEventListener('click', () => { this._closeMenu(); this.newDocument(); });
    document.getElementById('mi-open').addEventListener('click', () => { this._closeMenu(); this.fileInput.click(); });
    document.getElementById('mi-docs').addEventListener('click', () => { this._closeMenu(); this.openLibrary(); });
    document.getElementById('mi-find').addEventListener('click', () => { this._closeMenu(); this.findReplace.open(true); });

    this.fileInput.accept = IO.importAccept();
    this.fileInput.addEventListener('change', () => {
      if (this.fileInput.files[0]) this.openFile(this.fileInput.files[0]);
      this.fileInput.value = '';
    });

    const toggle = (open) => {
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      if (open) { const f = panel.querySelector('.menu-item'); f && f.focus(); }
    };
    this._closeMenu = () => toggle(false);
    button.addEventListener('click', () => toggle(panel.hidden));
    document.addEventListener('click', (e) => {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== button) toggle(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) { toggle(false); button.focus(); }
    });
    panel.addEventListener('keydown', (e) => {
      const items = Array.from(panel.querySelectorAll('.menu-item'));
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
  }

  // ---- Documents library dialog ----
    document.getElementById('docs-new').addEventListener('click', () => {
      if (typeof this.dialog.close === 'function') this.dialog.close();
      else this.dialog.removeAttribute('open');
      this.newDocument();
    });
  }

  async openLibrary() {
    const list = document.getElementById('docs-list');
    list.innerHTML = '';
    const docs = await this.library.listDocs();
    for (const d of docs) {
      list.appendChild(this._docRow(d));
    }
    if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
    else this.dialog.setAttribute('open', '');
  }

  _docRow(d) {
    const li = document.createElement('li');
    li.className = 'doc-row' + (this.doc && d.id === this.doc.id ? ' current' : '');

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'doc-open';
    const when = new Date(d.updatedAt).toLocaleString();
    open.innerHTML = `<span class="doc-name">${esc(d.title)}</span><span class="doc-meta">${esc(when)}</span>`;
    open.addEventListener('click', async () => {
      const fresh = await this.library.getDoc(d.id);
      this.dialog.close();
      this._loadDoc(fresh);
    });

    const rename = iconBtn('✏️', 'Rename', async () => {
      const name = window.prompt('Rename document:', d.title);
      if (name && name.trim()) {
        d.title = name.trim();
        await this.library.saveDoc(d);
        if (this.doc && this.doc.id === d.id) { this.doc.title = d.title; this.titleInput.value = d.title; }
        this.openLibrary();
      }
    });
    const dup = iconBtn('⧉', 'Duplicate', async () => {
      const copy = await this.library.createDoc(`${d.title} (copy)`, d.html);
      this.announce(`Duplicated “${d.title}”`);
      this.openLibrary();
      void copy;
    });
    const del = iconBtn('🗑️', 'Delete', async () => {
      if (!window.confirm(`Delete “${d.title}”? This cannot be undone.`)) return;
      await this.library.deleteDoc(d.id);
      if (this.doc && this.doc.id === d.id) {
        const all = await this.library.listDocs();
        this._loadDoc(all[0] || await this.library.createDoc('Untitled document', '<p><br></p>'), { announce: false });
      }
      this.announce('Document deleted');
      this.openLibrary();
    });
    del.classList.add('icon-btn');

    li.append(open, rename, dup, del);
    return li;
  }

  _wireGlobalKeys() {
    document.addEventListener('keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); this.exportAs(this.lastExportExt); }
      else if (k === 'o' && e.shiftKey) { e.preventDefault(); this.openLibrary(); }
      else if (k === 'o') { e.preventDefault(); this.fileInput.click(); }
      else if (k === 'f') { e.preventDefault(); this.findReplace.open(false); }
      else if (k === 'h') { e.preventDefault(); this.findReplace.open(true); }
    });
  }

  _wireDragDrop() {
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ['dragenter', 'dragover', 'drop'].forEach((ev) => document.addEventListener(ev, stop, false));
    document.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (file) this.openFile(file);
    });
  }

  _reflectBackend() {
    const badge = document.getElementById('backend-state');
    if (!badge) return;
    badge.textContent = LO.isConfigured()
      ? 'LibreOffice WASM: configured'
      : 'LibreOffice WASM: not configured (native I/O active)';
  }

  // ---- Actions ----
  async newDocument() {
    const doc = await this.library.createDoc('Untitled document', '<p><br></p>');
    this._loadDoc(doc);
    this.announce('New document');
  }

  async openFile(file) {
    try {
      this.announce(`Opening ${file.name}…`);
      const html = await IO.importFile(file);
      const title = file.name.replace(/\.[^.]+$/, '') || 'Untitled document';
      const doc = await this.library.createDoc(title, html);
      this.lastExportExt = IO.extOf(file.name) || this.lastExportExt;
      this._loadDoc(doc);
      this.announce(`Imported ${file.name}`);
    } catch (err) {
      console.error(err);
      this.announce(err.message || 'Could not open that file', { error: true });
    }
  }

  async exportAs(ext) {
    try {
      const html = this.editor.getContent();
      const title = this.titleInput.value.trim() || 'Untitled document';
      const blob = await IO.exportDocument(html, title, ext);
      IO.downloadBlob(blob, `${sanitizeFilename(title)}.${ext}`);
      this.lastExportExt = ext;
      this.announce(`Saved as .${ext}`);
    } catch (err) {
      console.error(err);
      this.announce(err.message || `Could not export .${ext}`, { error: true });
    }
  }

  // ---- Status ----
  _refreshStats() {
    const s = this.editor.stats();
    this.statWords.textContent = `${s.words} ${s.words === 1 ? 'word' : 'words'}`;
    this.statChars.textContent = `${s.chars} ${s.chars === 1 ? 'char' : 'chars'}`;
  }

  _markDirty() {
    this.saveState.textContent = 'Editing…';
    this.saveState.dataset.dirty = 'true';
  }

  _markClean() {
    this.saveState.textContent = this.library
      ? `Saved · ${this.library.kind}`
      : 'Autosave unavailable';
    this.saveState.dataset.dirty = 'false';
  }
}

function iconBtn(glyph, label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon-btn';
  b.textContent = glyph;
  b.setAttribute('aria-label', label);
  b.title = label;
  b.addEventListener('click', onClick);
  return b;
}

function esc(s) { return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
function sanitizeFilename(name) { return (name || 'document').replace(/[\/\\:*?"<>|]+/g, '_').slice(0, 80); }

const WELCOME = `
<h1>Welcome to edot</h1>
<p>A small, modular, <strong>accessible</strong> word processor and office-document tool that runs entirely in your browser — no server, no upload, your text never leaves the page.</p>
<h2>Write &amp; format</h2>
<ul>
<li>Use the toolbar or shortcuts: <strong>Ctrl/⌘+B</strong>, <em>+I</em>, <u>+U</u>.</li>
<li>Tag any selection with a 🏷️ <strong>semantic property</strong> (RDFa) — meaning that survives HTML export.</li>
</ul>
<h2>Open &amp; save real files</h2>
<ul>
<li>Open <strong>.docx</strong>, Markdown, HTML or text (<strong>Ctrl/⌘+O</strong>) — or drag one onto the page.</li>
<li>Save as <strong>DOCX, PDF, HTML+RDFa, Markdown, CSS or plain text</strong> from the <strong>File</strong> menu (<strong>Ctrl/⌘+S</strong>).</li>
</ul>
<h2>Your documents, stored locally</h2>
<p>Every document is kept in this browser’s local store and autosaves as you type. Open <strong>File ▸ My documents</strong> (<strong>Ctrl/⌘+Shift+O</strong>) to switch between them.</p>
<blockquote>Richer formats (.odt, .doc, .rtf) light up when a LibreOffice&nbsp;WASM backend is configured — see the project README.</blockquote>
`;

window.addEventListener('DOMContentLoaded', () => { window.__edot = new App(); });
