// edot-app.js — application bootstrap. Wires the editor, toolbar, file menu,
// status bar, autosave, and drag-and-drop together. Everything below is glue;
// the behaviour lives in the focused modules it imports.

import { Editor } from './editor.js';
import { Toolbar } from './toolbar.js';
import { Announcer } from './a11y.js';
import { Storage } from './storage.js';
import * as IO from './io.js';
import * as LO from './libreoffice-bridge.js';

class App {
  constructor() {
    this.announce = (m, o) => this.announcer.toast(m, o);
    this.announcer = new Announcer();
    this.storage = new Storage();

    this.editorEl = document.getElementById('editor');
    this.editor = new Editor(this.editorEl);
    this.toolbar = new Toolbar(document.getElementById('toolbar'), this.editor, this.announce);

    this.titleInput = document.getElementById('doc-title');
    this.saveState = document.getElementById('save-state');
    this.statWords = document.getElementById('stat-words');
    this.statChars = document.getElementById('stat-chars');
    this.fileInput = document.getElementById('file-input');

    this.docTitle = 'Untitled document';
    this.lastExportExt = 'docx';

    this._wireEditor();
    this._wireMenu();
    this._wireTitle();
    this._wireGlobalKeys();
    this._wireDragDrop();
    this._restore();
    this._reflectBackend();
  }

  _wireEditor() {
    this.editor.onSelectionCallback(() => this.toolbar.refresh());
    this.editor.onChangeCallback(() => {
      this._refreshStats();
      this._markDirty();
      this.storage.save({ title: this.docTitle, html: this.editor.getContent() });
      this.toolbar.refresh();
    });
  }

  _wireTitle() {
    this.titleInput.value = this.docTitle;
    const apply = () => {
      this.docTitle = this.titleInput.value.trim() || 'Untitled document';
      this.storage.save({ title: this.docTitle, html: this.editor.getContent() });
    };
    this.titleInput.addEventListener('input', apply);
    this.titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.editor.focus(); }
    });
  }

  // ---- File menu ----
  _wireMenu() {
    const button = document.getElementById('menu-button');
    const panel = document.getElementById('menu-panel');

    // Build the export entries dynamically from the format registry.
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
    this.fileInput.accept = IO.importAccept();
    this.fileInput.addEventListener('change', () => {
      if (this.fileInput.files[0]) this.openFile(this.fileInput.files[0]);
      this.fileInput.value = '';
    });

    const toggle = (open) => {
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      if (open) {
        const first = panel.querySelector('.menu-item');
        first && first.focus();
      }
    };
    this._closeMenu = () => toggle(false);
    button.addEventListener('click', () => toggle(panel.hidden));
    document.addEventListener('click', (e) => {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== button) toggle(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) { toggle(false); button.focus(); }
    });
    // Arrow navigation within the menu.
    panel.addEventListener('keydown', (e) => {
      const items = Array.from(panel.querySelectorAll('.menu-item'));
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
  }

  _wireGlobalKeys() {
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.exportAs(this.lastExportExt);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        this.fileInput.click();
      }
    });
  }

  _wireDragDrop() {
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ['dragenter', 'dragover', 'drop'].forEach((ev) =>
      document.addEventListener(ev, stop, false));
    document.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (file) this.openFile(file);
    });
  }

  _restore() {
    const saved = this.storage.load();
    if (saved && saved.html) {
      this.docTitle = saved.title || this.docTitle;
      this.titleInput.value = this.docTitle;
      this.editor.setContent(saved.html);
      this.announce('Restored your last document');
    } else {
      this.editor.setContent(WELCOME);
    }
    this._refreshStats();
    this._markClean();
  }

  _reflectBackend() {
    const badge = document.getElementById('backend-state');
    if (!badge) return;
    badge.textContent = LO.isConfigured()
      ? 'LibreOffice WASM: configured'
      : 'LibreOffice WASM: not configured (native I/O active)';
  }

  // ---- Actions ----
  newDocument() {
    if (!this.editor.isEmpty() && !confirm('Start a new document? Unsaved changes in this tab will be cleared.')) return;
    this.docTitle = 'Untitled document';
    this.titleInput.value = this.docTitle;
    this.editor.setContent('<p><br></p>');
    this.storage.clear();
    this.editor.focus();
    this.announce('New document');
    this._markClean();
  }

  async openFile(file) {
    try {
      this.announce(`Opening ${file.name}…`);
      const html = await IO.importFile(file);
      this.docTitle = file.name.replace(/\.[^.]+$/, '') || 'Untitled document';
      this.titleInput.value = this.docTitle;
      this.editor.setContent(html);
      this.editor.focus();
      this.lastExportExt = IO.extOf(file.name) || this.lastExportExt;
      this.announce(`Opened ${file.name}`);
      this._markClean();
    } catch (err) {
      console.error(err);
      this.announce(err.message || 'Could not open that file', { error: true });
    }
  }

  async exportAs(ext) {
    try {
      const blob = await IO.exportDocument(this.editor.getContent(), this.docTitle, ext);
      IO.downloadBlob(blob, `${sanitizeFilename(this.docTitle)}.${ext}`);
      this.lastExportExt = ext;
      this.announce(`Saved as .${ext}`);
      this._markClean();
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
    this.saveState.textContent = this.storage.available ? 'Autosaved locally' : 'Autosave unavailable';
    this.saveState.dataset.dirty = 'false';
  }
}

function esc(s) { return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
function sanitizeFilename(name) { return (name || 'document').replace(/[\/\\:*?"<>|]+/g, '_').slice(0, 80); }

const WELCOME = `
<h1>Welcome to edot</h1>
<p>A small, modular, <strong>accessible</strong> word processor that runs entirely in your browser — no server, no upload, your text never leaves the page.</p>
<h2>Try it</h2>
<ul>
<li>Format with the toolbar or shortcuts: <strong>Ctrl/⌘+B</strong>, <em>+I</em>, <u>+U</u>.</li>
<li>Open a <strong>.docx</strong>, Markdown, HTML or text file (<strong>Ctrl/⌘+O</strong>) — or drag one onto the page.</li>
<li>Save it back out in any format from the <strong>File</strong> menu (<strong>Ctrl/⌘+S</strong>).</li>
</ul>
<h2>About formats</h2>
<p>Word, Markdown, HTML and text round-trip natively and offline. Richer formats (.odt, .doc, .rtf, PDF export) light up when a LibreOffice&nbsp;WASM backend is configured — see the project README.</p>
<blockquote>Everything you type autosaves to this browser. Use <strong>File ▸ Save as</strong> to keep a real copy.</blockquote>
`;

window.addEventListener('DOMContentLoaded', () => { window.__edot = new App(); });
