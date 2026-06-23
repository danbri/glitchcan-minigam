// query-component.js — <edot-query>: an Access-like SQL workbench. Type SQL,
// Run, see results in a grid, and Save the SELECT as a named view. Emits
// `views-changed` and `to-sheet` (send results to a new spreadsheet).

import './grid-component.js';

export class EdotQuery extends HTMLElement {
  constructor() { super(); this.engine = null; this._lastSelect = ''; }

  connectedCallback() { if (!this._built) this._render(); }

  setSql(sql) { if (this._editor) this._editor.value = sql; }

  _render() {
    this._built = true;
    this.innerHTML = '';
    const ed = document.createElement('textarea');
    ed.className = 'q-editor'; ed.spellcheck = false;
    ed.placeholder = 'SELECT * FROM …';
    ed.value = 'SELECT name, type FROM sqlite_master\nWHERE type IN ("table","view")\nORDER BY type, name;';
    const bar = document.createElement('div'); bar.className = 'q-bar';
    const run = btn('▶ Run', 'primary');
    const saveView = btn('Save as view');
    const toSheet = btn('Send to sheet');
    const toEditor = btn('→ Editor');
    const status = document.createElement('span'); status.className = 'dw-status';
    bar.append(run, saveView, toSheet, toEditor, status);
    const grid = document.createElement('edot-grid');
    this.append(ed, bar, grid);
    this._editor = ed; this._grid = grid; this._status = status;

    run.addEventListener('click', () => this.run());
    ed.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.run(); } });
    saveView.addEventListener('click', () => this._saveView());
    toSheet.addEventListener('click', () => this._toSheet());
    toEditor.addEventListener('click', () => { if (!this._last) this.run(); if (this._last) this.dispatchEvent(new CustomEvent('to-editor', { bubbles: true, detail: this._last })); });
  }

  run() {
    const sql = this._editor.value.trim().replace(/;\s*$/, '');
    if (!sql) return;
    try {
      const { columns, rows } = this.engine.query(sql);
      this._grid.setData({ columns, rows, editable: false });
      this._status.className = 'dw-status';
      this._status.textContent = `${rows.length} row${rows.length === 1 ? '' : 's'}`;
      this._last = { columns, rows };
      if (/^\s*select/i.test(sql)) this._lastSelect = sql;
    } catch (err) {
      this._status.className = 'dw-status err';
      this._status.textContent = err.message;
    }
  }

  _saveView() {
    const sql = (this._lastSelect || this._editor.value).trim().replace(/;\s*$/, '');
    if (!/^\s*select/i.test(sql)) { this._status.className = 'dw-status err'; this._status.textContent = 'Only SELECT queries can be saved as a view'; return; }
    const name = prompt('View name:', 'my_view');
    if (!name) return;
    try {
      this.engine.createView(name.trim(), sql);
      this._status.className = 'dw-status'; this._status.textContent = `View "${name}" saved`;
      this.dispatchEvent(new CustomEvent('views-changed', { bubbles: true, detail: { name } }));
    } catch (err) { this._status.className = 'dw-status err'; this._status.textContent = err.message; }
  }

  _toSheet() {
    if (!this._last) { this.run(); }
    if (!this._last) return;
    this.dispatchEvent(new CustomEvent('to-sheet', { bubbles: true, detail: this._last }));
  }
}

function btn(label, cls) { const b = document.createElement('button'); b.type = 'button'; b.className = 'dbtn' + (cls ? ` ${cls}` : ''); b.textContent = label; return b; }

customElements.define('edot-query', EdotQuery);
