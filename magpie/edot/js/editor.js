// editor.js — the core editable surface.
// Owns the contenteditable element: content get/set, the empty-state
// placeholder, paste sanitization, keyboard shortcuts, and change/selection
// notifications. Knows nothing about toolbars, files, or formats.

import { normalize, sanitizeHtml, stats } from './document-model.js';
import { COMMANDS } from './commands.js';

export class Editor {
  constructor(el) {
    this.el = el;
    this.el.setAttribute('contenteditable', 'true');
    this.el.setAttribute('role', 'textbox');
    this.el.setAttribute('aria-multiline', 'true');
    this.el.setAttribute('aria-label', 'Document body');
    this.el.spellcheck = true;

    this._changeCb = () => {};
    this._selectionCb = () => {};

    // Force tag-based formatting (<b>/<i>/<u>) instead of CSS-styled spans.
    // The document sanitizer strips style attributes, so CSS-based output
    // would lose its formatting on save — this keeps execCommand output in
    // the sanitizer's allow-list. Also make Enter produce <p>, not <div>.
    try {
      document.execCommand('styleWithCSS', false, false);
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch (_) { /* not all engines support these */ }

    this._wire();
    this._updateEmpty();
  }

  onChangeCallback(fn) { this._changeCb = fn; }
  onSelectionCallback(fn) { this._selectionCb = fn; }

  getContent() { return normalize(this.el.innerHTML); }

  setContent(html) {
    this.el.innerHTML = normalize(html);
    this._updateEmpty();
    this._changeCb();
  }

  isEmpty() {
    return stats(this.el.innerHTML).chars === 0;
  }

  stats() { return stats(this.el.innerHTML); }

  focus() { this.el.focus(); }

  // Remove the one document-level listener this editor owns.
  destroy() {
    if (this._onSelectionChange) document.removeEventListener('selectionchange', this._onSelectionChange);
  }

  // Insert sanitized HTML at the caret (if it's inside the editor) or append
  // to the end. Used to drop tables/query results in from the data workspace.
  insertHtml(html) {
    const clean = sanitizeHtml(html);
    const sel = window.getSelection();
    if (sel && sel.rangeCount && this.el.contains(sel.anchorNode)) {
      this.el.focus();
      document.execCommand('insertHTML', false, clean);
    } else {
      this.el.insertAdjacentHTML('beforeend', clean);
    }
    this._updateEmpty();
    this.onChange();
  }

  // Focus and drop the caret at the very end. Used when a tap lands on the
  // page margin or empty area — on mobile this is what actually raises the
  // on-screen keyboard, since it runs inside the tap gesture.
  focusEnd() {
    this.el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(this.el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Called by toolbar after a command runs, and internally on input.
  onChange() {
    this._updateEmpty();
    this._changeCb();
  }

  _updateEmpty() {
    this.el.dataset.empty = this.isEmpty() ? 'true' : 'false';
  }

  _wire() {
    this.el.addEventListener('input', () => this.onChange());

    // Selection-driven toolbar state. Stored so destroy() can remove it (the
    // only listener this instance puts on the shared document).
    this._onSelectionChange = () => {
      if (document.activeElement === this.el || this.el.contains(document.activeElement)) {
        this._selectionCb();
      }
    };
    document.addEventListener('selectionchange', this._onSelectionChange);

    // Keyboard shortcuts (Ctrl/Cmd based).
    this.el.addEventListener('keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      for (const [, cmd] of Object.entries(COMMANDS)) {
        if (cmd.key === key && !!cmd.shift === e.shiftKey) {
          e.preventDefault();
          cmd.exec();
          this.onChange();
          this._selectionCb();
          return;
        }
      }
      // Ctrl+Shift+Z as an alternate redo.
      if (key === 'z' && e.shiftKey) {
        e.preventDefault();
        COMMANDS.redo.exec();
        this.onChange();
      }
    });

    // Paste: strip everything to safe document HTML, never raw clipboard HTML.
    this.el.addEventListener('paste', (e) => {
      e.preventDefault();
      const cb = e.clipboardData;
      const html = cb.getData('text/html');
      const text = cb.getData('text/plain');
      let insert;
      if (html) {
        insert = sanitizeHtml(html);
      } else {
        insert = text.split(/\n{2,}/)
          .map((p) => `<p>${escapeText(p).replace(/\n/g, '<br>')}</p>`).join('');
      }
      document.execCommand('insertHTML', false, insert);
      this.onChange();
    });

    // Drag-and-drop a file onto the page is handled at app level; here we
    // just prevent the browser from navigating away on stray drops.
    this.el.addEventListener('dragover', (e) => e.preventDefault());
  }
}

function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
