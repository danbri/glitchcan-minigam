// edot-editor.js — the editor as a complete, embeddable, MULTI-INSTANCE custom
// element. It wraps the same core the standalone page uses — Editor (the
// contenteditable surface), Toolbar (the WAI-ARIA formatting toolbar) and the
// shared command library — and exposes enough configuration, methods, callbacks
// and an escape hatch to its core that a host can build the full editor page
// (File menu, Open, GitHub, export, palette, autosave, find/replace) ON TOP of
// it. The page owns title/library/dialogs; the component owns the document
// surface and formatting.
//
// MULTIPLE INSTANCES are first-class:
//  • control ids are per-instance (toolbar.js), and alignment targets the editor
//    holding the selection (commands.js) — so two editors never cross wires;
//  • the ONE kernel capability `editor.addData` is registered once at module load
//    and routes to the most-recently-focused editor (a registry tracks them),
//    instead of each instance clobbering the previous provider.
//
// Configuration (attributes / properties):
//   placeholder, readonly, spellcheck, notoolbar ; .content, .readOnly
// Methods:
//   getContent/setContent, insertHtml, insertData, exec(commandId), focus,
//   focusEnd, stats, markClean ; getters: .core (the Editor), .announce, .isDirty
// Events (all bubble):
//   edot-ready, edot-change {detail:{editor}}, edot-selectionchange {detail:{editor}}

import { Editor } from './editor.js';
import { Toolbar } from './toolbar.js';
import { Announcer } from './a11y.js';
import { COMMANDS, setBlockFormat, currentBlockFormat, setAlign, currentAlign, createLink as cmdCreateLink } from './commands.js';
import { getKernel } from './edot-kernel.js';

let seq = 0;

// ---- multi-instance registry + single kernel capability --------------------
const instances = new Set();
let active = null;                 // most-recently-focused editor
let capabilityWired = false;

function wireCapabilityOnce() {
  if (capabilityWired) return;
  try {
    // Registered ONCE for all instances; routes to the focused editor (or the
    // newest one) so a co-located Data pane's share lands where the user is.
    getKernel().capabilities.provide('editor.addData', ({ columns, rows, title } = {}) => {
      const target = (active && instances.has(active)) ? active : [...instances].pop();
      if (!target) return false;
      target.insertData(columns, rows, title);
      return true;
    });
    capabilityWired = true;
  } catch (_) { /* kernel optional — the component still works standalone */ }
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function tableHtml(columns = [], rows = []) {
  const head = columns.length
    ? `<thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>` : '';
  const body = `<tbody>${rows.map((r) => {
    const cells = Array.isArray(r) ? r : columns.map((c) => r?.[c]);
    return `<tr>${cells.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`;
  }).join('')}</tbody>`;
  return `<table>${head}${body}</table>`;
}

export class EdotEditor extends HTMLElement {
  static get observedAttributes() { return ['placeholder', 'readonly', 'spellcheck']; }

  connectedCallback() {
    if (this._built) return;
    this._built = true;
    this._uid = ++seq;
    this._dirty = false;

    const placeholder = this.getAttribute('placeholder') || 'Start writing…';
    this.innerHTML = `
      <div class="toolbar" role="toolbar" aria-label="Formatting"></div>
      <div class="app-main">
        <article class="page" id="edot-page-${this._uid}" dir="auto" data-placeholder="${esc(placeholder)}" data-empty="true"></article>
      </div>`;
    const toolbarRoot = this.querySelector('.toolbar');
    this.editorEl = this.querySelector('.page');

    this.announcer = new Announcer();
    this._announce = (m, o) => this.announcer.toast(m, o);
    this.editor = new Editor(this.editorEl);

    if (this.hasAttribute('notoolbar')) {
      this.toolbar = null;
      toolbarRoot.hidden = true;
    } else {
      this.toolbar = new Toolbar(toolbarRoot, this.editor, this._announce);
    }

    this.editor.onSelectionCallback(() => {
      this.toolbar?.refresh();
      this.dispatchEvent(new CustomEvent('edot-selectionchange', { bubbles: true, detail: { editor: this } }));
    });
    this.editor.onChangeCallback(() => {
      this._dirty = true;
      this.dispatchEvent(new CustomEvent('edot-change', { bubbles: true, detail: { editor: this } }));
    });

    if (this.hasAttribute('readonly')) this.readOnly = true;
    if (this.hasAttribute('spellcheck')) this.editorEl.spellcheck = this.getAttribute('spellcheck') !== 'false';
    if (this._pendingContent != null) { this.editor.setContent(this._pendingContent); this._pendingContent = null; this._dirty = false; }

    // Register in the multi-instance set; track focus so the kernel capability
    // and any "active editor" host logic target the right one.
    instances.add(this);
    if (!active) active = this;
    this._onFocusIn = () => { active = this; };
    this.addEventListener('focusin', this._onFocusIn);
    wireCapabilityOnce();

    this.dispatchEvent(new CustomEvent('edot-ready', { bubbles: true, detail: { editor: this } }));
  }

  disconnectedCallback() {
    if (this._onFocusIn) this.removeEventListener('focusin', this._onFocusIn);
    instances.delete(this);
    if (active === this) active = [...instances].pop() || null;
    this.editor?.destroy?.();
    this.toolbar?.destroy?.();
    this.announcer?.destroy?.();
  }

  attributeChangedCallback(name, _old, val) {
    if (!this._built) return;
    if (name === 'readonly') this.readOnly = val !== null;
    else if (name === 'placeholder') this.editorEl.dataset.placeholder = val || '';
    else if (name === 'spellcheck') this.editorEl.spellcheck = val !== 'false';
  }

  // ---- configuration ----
  get readOnly() { return this.editorEl?.getAttribute('contenteditable') === 'false'; }
  set readOnly(v) {
    if (!this.editorEl) return;
    this.editorEl.setAttribute('contenteditable', v ? 'false' : 'true');
    const tb = this.querySelector('.toolbar');
    if (tb && this.toolbar) tb.style.display = v ? 'none' : '';
  }
  get content() { return this.editor ? this.getContent() : (this._pendingContent || ''); }
  set content(html) { if (this.editor) this.setContent(html); else this._pendingContent = html; }

  // ---- content + commands API (what a host page builds on) ----
  getContent() { return this.editor.getContent(); }
  setContent(html) { this.editor.setContent(html); this._dirty = false; }
  insertHtml(html) { this.editor.insertHtml(html); }
  insertData(columns = [], rows = [], title = '') {
    this.editor.insertHtml((title ? `<h3>${esc(title)}</h3>` : '') + tableHtml(columns, rows));
  }
  focus() { this.editor.focus(); }
  focusEnd() { this.editor.focusEnd(); }
  stats() { return this.editor.stats(); }
  markClean() { this._dirty = false; }
  get isDirty() { return this._dirty; }

  // Run a formatting command by id (bold, h1, alignCenter, …) — for host menus,
  // command palettes and keyboard shortcuts wired outside the toolbar.
  exec(commandId) {
    const cmd = COMMANDS[commandId];
    if (!cmd) return false;
    this.editor.focus();
    cmd.exec();
    this.editor.onChange();
    this.toolbar?.refresh();
    return true;
  }
  commandState(commandId) {
    const cmd = COMMANDS[commandId];
    return cmd && cmd.state ? cmd.state() : false;
  }
  // Block format + alignment + links are handled specially (not execCommand
  // toggles), so expose them too — a host menu needs the full set.
  setBlock(tag) { this.editor.focus(); setBlockFormat(tag); this.editor.onChange(); this.toolbar?.refresh(); }
  align(value) { this.editor.focus(); setAlign(value); this.editor.onChange(); this.toolbar?.refresh(); }
  createLink() { this.editor.focus(); cmdCreateLink(this._announce); this.editor.onChange(); }
  currentBlock() { return currentBlockFormat(); }
  currentAlign() { return currentAlign(); }

  // The underlying surface + announcer, so a host can build subsystems that need
  // them directly (e.g. `new FindReplace(editor.core, editor.announce)`), exactly
  // as the standalone page does.
  get core() { return this.editor; }
  get announce() { return this._announce; }
}

customElements.define('edot-editor', EdotEditor);
