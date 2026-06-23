// grid-component.js — <edot-grid>: a reusable, keyboard-navigable, optionally
// editable data grid. Emits `cell-change` { row, col, value, columnName } when
// an edit is committed. Used for table/view display and query results.

export class EdotGrid extends HTMLElement {
  constructor() {
    super();
    this._data = { columns: [], rows: [], editable: false, rowHeaders: true };
    this._active = { r: 0, c: 0 };
    this._editing = false;
  }

  connectedCallback() { if (!this._built) this._render(); }

  setData(data) {
    this._data = { rowHeaders: true, editable: false, ...data };
    this._active = { r: 0, c: 0 };
    this._render();
  }

  // Update one cell's displayed value without a full re-render.
  setCell(r, c, value, { error = false, formula = false } = {}) {
    const td = this._td(r, c);
    if (!td) return;
    td.textContent = value == null ? '' : String(value);
    td.classList.toggle('err', error);
    td.classList.toggle('num', !error && typeof value === 'number');
    td.classList.toggle('formula-cell', formula);
  }

  _render() {
    this._built = true;
    const { columns, rows, rowHeaders } = this._data;
    const wrap = document.createElement('div');
    wrap.className = 'grid-wrap';
    const table = document.createElement('table');
    table.className = 'grid';
    table.tabIndex = 0;

    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    if (rowHeaders) { const corner = document.createElement('th'); corner.className = 'corner'; htr.appendChild(corner); }
    columns.forEach((name) => { const th = document.createElement('th'); th.textContent = name; htr.appendChild(th); });
    thead.appendChild(htr); table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach((row, r) => {
      const tr = document.createElement('tr');
      if (rowHeaders) { const rh = document.createElement('td'); rh.className = 'rowhead'; rh.textContent = String(r + 1); tr.appendChild(rh); }
      columns.forEach((_, c) => {
        const td = document.createElement('td');
        const v = row[c];
        if (typeof v === 'number') td.classList.add('num');
        td.textContent = v == null ? '' : String(v);
        td.dataset.r = r; td.dataset.c = c;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    this.innerHTML = '';
    this.appendChild(wrap);
    this._table = table;
    this._wire();
    this._setActive(0, 0);
  }

  _td(r, c) { return this._table && this._table.querySelector(`td[data-r="${r}"][data-c="${c}"]`); }

  _setActive(r, c) {
    const rows = this._data.rows.length, cols = this._data.columns.length;
    if (!rows || !cols) return;
    r = Math.max(0, Math.min(rows - 1, r)); c = Math.max(0, Math.min(cols - 1, c));
    this._table.querySelectorAll('td.active').forEach((e) => e.classList.remove('active'));
    const td = this._td(r, c);
    if (td) { td.classList.add('active'); this._active = { r, c };
      this.dispatchEvent(new CustomEvent('cell-select', { detail: { row: r, col: c, columnName: this._data.columns[c] } }));
      td.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }

  _wire() {
    const t = this._table;
    t.addEventListener('mousedown', (e) => {
      const td = e.target.closest('td:not(.rowhead)');
      if (td && td.dataset.r != null) { this._commit(); this._setActive(+td.dataset.r, +td.dataset.c); t.focus(); }
    });
    t.addEventListener('dblclick', (e) => { if (e.target.closest('td:not(.rowhead)')) this._startEdit(); });
    t.addEventListener('keydown', (e) => this._onKey(e));
  }

  _onKey(e) {
    if (this._editing) {
      if (e.key === 'Enter') { e.preventDefault(); this._commit(); this._setActive(this._active.r + 1, this._active.c); }
      else if (e.key === 'Escape') { e.preventDefault(); this._cancel(); }
      else if (e.key === 'Tab') { e.preventDefault(); this._commit(); this._setActive(this._active.r, this._active.c + 1); }
      return;
    }
    const { r, c } = this._active;
    if (e.key === 'ArrowUp') { e.preventDefault(); this._setActive(r - 1, c); }
    else if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); this._setActive(r + 1, c); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this._setActive(r, c - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this._setActive(r, c + 1); }
    else if (e.key === 'Tab') { e.preventDefault(); this._setActive(r, c + (e.shiftKey ? -1 : 1)); }
    else if (this._data.editable && (e.key === 'F2' || e.key === 'Backspace')) { e.preventDefault(); this._startEdit(e.key === 'Backspace' ? '' : undefined); }
    else if (this._data.editable && e.key.length === 1 && !e.ctrlKey && !e.metaKey) { this._startEdit(e.key); }
  }

  _startEdit(initial) {
    if (!this._data.editable || this._editing) return;
    const { r, c } = this._active;
    const td = this._td(r, c);
    if (!td) return;
    this._editing = true;
    const old = td.textContent;
    const input = document.createElement('input');
    input.className = 'cell-input';
    input.value = initial !== undefined ? initial : old;
    td.textContent = ''; td.appendChild(input);
    input.focus();
    if (initial === undefined) input.select();
    input.addEventListener('blur', () => this._commit());
    this._editor = { input, td, old };
  }

  _commit() {
    if (!this._editing || !this._editor) return;
    const { input, td, old } = this._editor;
    const value = input.value;
    this._editing = false; this._editor = null;
    td.textContent = value;
    if (value !== old) {
      this._data.rows[+td.dataset.r][+td.dataset.c] = value;
      this.dispatchEvent(new CustomEvent('cell-change', {
        detail: { row: +td.dataset.r, col: +td.dataset.c, value, columnName: this._data.columns[+td.dataset.c] },
      }));
    }
  }

  _cancel() {
    if (!this._editing || !this._editor) return;
    const { td, old } = this._editor;
    this._editing = false; this._editor = null;
    td.textContent = old;
  }
}

customElements.define('edot-grid', EdotGrid);
