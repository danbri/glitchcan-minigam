// grid-component.js — <edot-grid>: a reusable, keyboard-navigable, optionally
// editable data grid. Emits `cell-change` { row, col, value, columnName } when
// an edit is committed. Used for table/view display and query results.
//
// Click a column header to sort (the Access/Sheets datasheet convention):
// asc → desc → original. Sorting only reorders what's shown — a display→original
// order map is kept so edits still write back to the right underlying row, and
// `cell-change` / `cell-select` always report the ORIGINAL row index.

export class EdotGrid extends HTMLElement {
  constructor() {
    super();
    this._data = { columns: [], rows: [], editable: false, rowHeaders: true };
    this._active = { r: 0, c: 0 };       // r,c are DISPLAY coordinates
    this._editing = false;
    this._sort = { col: -1, dir: 0 };    // dir: 1 asc, -1 desc, 0 none
    this._order = null;                  // display index -> original row index
  }

  connectedCallback() { if (!this._built) this._render(); }

  setData(data) {
    this._data = { rowHeaders: true, editable: false, ...data };
    this._active = { r: 0, c: 0 };
    this._sort = { col: -1, dir: 0 };
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

  // Build the display→original order from the current sort state.
  _computeOrder() {
    const n = this._data.rows.length;
    const idx = Array.from({ length: n }, (_, i) => i);
    const { col, dir } = this._sort;
    if (!dir || col < 0) { this._order = idx; return; }
    const rows = this._data.rows;
    idx.sort((i, j) => (cmp(rows[i][col], rows[j][col]) * dir) || (i - j)); // stable
    this._order = idx;
  }

  _render() {
    this._built = true;
    this._computeOrder();
    const { columns, rowHeaders } = this._data;
    const wrap = document.createElement('div');
    wrap.className = 'grid-wrap';
    const table = document.createElement('table');
    table.className = 'grid';
    table.tabIndex = 0;

    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    if (rowHeaders) { const corner = document.createElement('th'); corner.className = 'corner'; htr.appendChild(corner); }
    columns.forEach((name, c) => {
      const th = document.createElement('th');
      th.className = 'sortable';
      th.dataset.c = c;
      const lab = document.createElement('span'); lab.className = 'th-label'; lab.textContent = name;
      const ind = document.createElement('span'); ind.className = 'th-sort';
      ind.textContent = this._sort.col === c ? (this._sort.dir === 1 ? ' ▲' : ' ▼') : '';
      if (this._sort.col === c && this._sort.dir) th.classList.add('sorted');
      th.append(lab, ind);
      htr.appendChild(th);
    });
    thead.appendChild(htr); table.appendChild(thead);

    const tbody = document.createElement('tbody');
    this._order.forEach((orig, r) => {
      const row = this._data.rows[orig];
      const tr = document.createElement('tr');
      if (rowHeaders) { const rh = document.createElement('td'); rh.className = 'rowhead'; rh.textContent = String(r + 1); tr.appendChild(rh); }
      columns.forEach((_, c) => {
        const td = document.createElement('td');
        const v = row[c];
        if (typeof v === 'number') td.classList.add('num');
        td.textContent = v == null ? '' : String(v);
        td.dataset.r = r; td.dataset.c = c;   // r is the DISPLAY index
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
    this._setActive(this._active.r, this._active.c);
  }

  _td(r, c) { return this._table && this._table.querySelector(`td[data-r="${r}"][data-c="${c}"]`); }

  // Translate a display row index to the original row index it stands for.
  _orig(displayRow) { return this._order ? this._order[displayRow] : displayRow; }

  _setActive(r, c) {
    const rows = this._data.rows.length, cols = this._data.columns.length;
    if (!rows || !cols) return;
    r = Math.max(0, Math.min(rows - 1, r)); c = Math.max(0, Math.min(cols - 1, c));
    this._table.querySelectorAll('td.active').forEach((e) => e.classList.remove('active'));
    const td = this._td(r, c);
    if (td) { td.classList.add('active'); this._active = { r, c };
      this.dispatchEvent(new CustomEvent('cell-select', { detail: { row: this._orig(r), col: c, columnName: this._data.columns[c] } }));
      td.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }

  // Cycle a column's sort: none → asc → desc → none.
  sortBy(c) {
    this._commit();
    if (this._sort.col === c) { this._sort.dir = this._sort.dir === 1 ? -1 : (this._sort.dir === -1 ? 0 : 1); }
    else { this._sort.col = c; this._sort.dir = 1; }
    if (!this._sort.dir) this._sort.col = -1;
    this._active = { r: 0, c };
    this._render();
  }

  _wire() {
    const t = this._table;
    t.addEventListener('mousedown', (e) => {
      const td = e.target.closest('td:not(.rowhead)');
      if (td && td.dataset.r != null) { this._commit(); this._setActive(+td.dataset.r, +td.dataset.c); t.focus(); }
    });
    t.addEventListener('click', (e) => {
      const th = e.target.closest('th.sortable');
      if (th && th.dataset.c != null) this.sortBy(+th.dataset.c);
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
      const orig = this._orig(+td.dataset.r);
      this._data.rows[orig][+td.dataset.c] = value;
      this.dispatchEvent(new CustomEvent('cell-change', {
        detail: { row: orig, col: +td.dataset.c, value, columnName: this._data.columns[+td.dataset.c] },
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

// Mixed-type compare: nulls last, numbers (and numeric strings) numerically,
// text case-insensitively with natural ordering.
function cmp(a, b) {
  const na = a == null || a === '', nb = b == null || b === '';
  if (na && nb) return 0; if (na) return 1; if (nb) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const fa = Number(a), fb = Number(b);
  if (!Number.isNaN(fa) && !Number.isNaN(fb)) return fa - fb;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

customElements.define('edot-grid', EdotGrid);
