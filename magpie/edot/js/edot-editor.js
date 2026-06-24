// edot-editor.js — the editor surface as an embeddable custom element.
//
// Wraps the SAME core the standalone page uses — Editor (contenteditable surface),
// Toolbar (the WAI-ARIA formatting toolbar), and the shared commands — scoped to
// the element's own light-DOM root. That lets the editor live as a workspace pane
// beside <edot-data> and <edot-slides>, all sharing one kernel, while the
// full-featured standalone page (edot.html / edot-app.js) stays exactly as it is.
//
// This is the pane-sized surface: the editable document + formatting. The page's
// heavy chrome (File menu, Open/GitHub/source dialogs, autosave, export) is NOT
// part of the component — a host that wants those builds them around it, the way
// edot.html does today.
//
// Styling lives in css/edot-editor.css (scoped to this element so it can't bleed
// onto sibling panes). Light DOM, not shadow — contenteditable + execCommand are
// unreliable across a shadow boundary, and the existing components are light too.

import { Editor } from './editor.js';
import { Toolbar } from './toolbar.js';
import { Announcer } from './a11y.js';
import { getKernel } from './edot-kernel.js';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Render a tabular result ({columns, rows}) to sanitiser-friendly table HTML.
// rows may be arrays (positional) or objects keyed by column name.
function tableHtml(columns = [], rows = []) {
  const head = columns.length
    ? `<thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>`
    : '';
  const body = `<tbody>${rows.map((r) => {
    const cells = Array.isArray(r) ? r : columns.map((c) => r?.[c]);
    return `<tr>${cells.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`;
  }).join('')}</tbody>`;
  return `<table>${head}${body}</table>`;
}

export class EdotEditor extends HTMLElement {
  connectedCallback() {
    if (this._built) return;
    this._built = true;

    this.innerHTML = `
      <div class="toolbar" role="toolbar" aria-label="Formatting"></div>
      <div class="app-main">
        <article class="page" dir="auto" data-placeholder="Start writing…" data-empty="true"></article>
      </div>`;
    const toolbarRoot = this.querySelector('.toolbar');
    this.editorEl = this.querySelector('.page');

    this.announcer = new Announcer();
    const announce = (m, o) => this.announcer.toast(m, o);
    this.editor = new Editor(this.editorEl);
    this.toolbar = new Toolbar(toolbarRoot, this.editor, announce);
    this.editor.onSelectionCallback(() => this.toolbar.refresh());
    this.editor.onChangeCallback(() => this.dispatchEvent(new CustomEvent('edot-change', { bubbles: true })));

    // Expose an insert capability on the shared kernel. We deliberately DON'T
    // auto-subscribe to 'data:share' — the host decides which panes a share lands
    // in (mirrors how <edot-slides> exposes addDataSlide and the host routes to it).
    try {
      getKernel().capabilities.provide('editor.addData', ({ columns, rows, title } = {}) => {
        this.insertData(columns, rows, title);
        return true;
      });
    } catch (_) { /* kernel optional — the component still works standalone */ }
  }

  disconnectedCallback() {
    this.editor?.destroy?.();
    this.announcer?.destroy?.();
  }

  // Public surface (parallels EdotSlides.addDataSlide / EdotData's methods).
  getContent() { return this.editor.getContent(); }
  setContent(html) { this.editor.setContent(html); }
  insertHtml(html) { this.editor.insertHtml(html); }
  insertData(columns = [], rows = [], title = '') {
    this.editor.insertHtml((title ? `<h3>${esc(title)}</h3>` : '') + tableHtml(columns, rows));
  }
  focus() { this.editor.focus(); }
}

customElements.define('edot-editor', EdotEditor);
