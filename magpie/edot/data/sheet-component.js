// sheet-component.js — <edot-sheet>: an Excel-like spreadsheet. Cells hold a
// value or a "=formula". A1 headers, a formula bar, and live recompute. The
// `=SQL("…")` function (via the engine) lets a cell read the relational layer,
// and the whole sheet can be materialised to a SQL table (see the workspace).

import { evaluate, FormulaError, numToCol, colToNum, parseRef } from './formula.js';

export class EdotSheet extends HTMLElement {
  constructor() {
    super();
    this.rowsN = 30; this.colsN = 8;
    this.cells = new Map();   // "r,c" -> { raw }
    this.values = new Map();  // "r,c" -> computed value (or {error})
    this.active = { r: 1, c: 1 };
    this.engine = null;       // optional DataEngine for =SQL()
  }

  connectedCallback() { if (!this._built) this._render(); }

  // Load a 2D array of raw cell strings (row-major), optional column count.
  setGrid({ rows = [], cols } = {}) {
    this.cells.clear();
    this.rowsN = Math.max(this.rowsN, rows.length);
    this.colsN = Math.max(this.colsN, cols || (rows[0] ? rows[0].length : 0));
    rows.forEach((row, r) => row.forEach((v, c) => {
      if (v !== '' && v != null) this.cells.set(`${r + 1},${c + 1}`, { raw: String(v) });
    }));
    this._render();
  }

  // Export computed values as { columns, rows } (used to materialise a table).
  toTable({ headerRow = true } = {}) {
    const usedR = this._extentRows(), usedC = this._extentCols();
    const grid = [];
    for (let r = 1; r <= usedR; r++) {
      const row = [];
      for (let c = 1; c <= usedC; c++) row.push(this._display(r, c, true));
      grid.push(row);
    }
    let columns;
    if (headerRow && grid.length) columns = grid.shift().map((v, i) => (v == null || v === '' ? `col${i + 1}` : String(v)));
    else columns = Array.from({ length: usedC }, (_, i) => numToCol(i + 1));
    return { columns, rows: grid };
  }

  serialize() { return { rowsN: this.rowsN, colsN: this.colsN, cells: Array.from(this.cells.entries()) }; }
  deserialize(d) {
    if (!d) return;
    this.rowsN = d.rowsN || this.rowsN; this.colsN = d.colsN || this.colsN;
    this.cells = new Map(d.cells || []);
    this._render();
  }

  _extentRows() { let m = 0; for (const k of this.cells.keys()) m = Math.max(m, +k.split(',')[0]); return Math.max(1, m); }
  _extentCols() { let m = 0; for (const k of this.cells.keys()) m = Math.max(m, +k.split(',')[1]); return Math.max(1, m); }

  _render() {
    this._built = true;
    const bar = document.createElement('div');
    bar.className = 'sheet-bar';
    const addr = document.createElement('span'); addr.className = 'addr';
    const fx = document.createElement('span'); fx.className = 'fx'; fx.textContent = 'ƒx';
    const fInput = document.createElement('input'); fInput.className = 'formula'; fInput.setAttribute('aria-label', 'Formula bar');
    bar.append(addr, fx, fInput);

    const wrap = document.createElement('div'); wrap.className = 'grid-wrap';
    const table = document.createElement('table'); table.className = 'grid'; table.tabIndex = 0;
    const thead = document.createElement('thead'); const htr = document.createElement('tr');
    const corner = document.createElement('th'); corner.className = 'corner'; htr.appendChild(corner);
    for (let c = 1; c <= this.colsN; c++) { const th = document.createElement('th'); th.textContent = numToCol(c); htr.appendChild(th); }
    thead.appendChild(htr); table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (let r = 1; r <= this.rowsN; r++) {
      const tr = document.createElement('tr');
      const rh = document.createElement('td'); rh.className = 'rowhead'; rh.textContent = String(r); tr.appendChild(rh);
      for (let c = 1; c <= this.colsN; c++) { const td = document.createElement('td'); td.dataset.r = r; td.dataset.c = c; tr.appendChild(td); }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);

    this.innerHTML = ''; this.append(bar, wrap);
    this._table = table; this._addr = addr; this._fInput = fInput;
    this._wire();
    this.recompute();
    this._selectActive();
  }

  _wire() {
    const t = this._table;
    t.addEventListener('mousedown', (e) => {
      const td = e.target.closest('td:not(.rowhead)');
      if (td && td.dataset.r) { this._commitEdit(); this.active = { r: +td.dataset.r, c: +td.dataset.c }; this._selectActive(); t.focus(); }
    });
    t.addEventListener('dblclick', (e) => { if (e.target.closest('td:not(.rowhead)')) this._startEdit(); });
    t.addEventListener('keydown', (e) => this._onKey(e));
    this._fInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._setRaw(this.active.r, this.active.c, this._fInput.value); this.active = { r: this.active.r + 1, c: this.active.c }; this._selectActive(); t.focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); this._selectActive(); }
    });
  }

  _onKey(e) {
    if (this._editing) {
      if (e.key === 'Enter') { e.preventDefault(); this._commitEdit(); this.active = { r: Math.min(this.rowsN, this.active.r + 1), c: this.active.c }; this._selectActive(); }
      else if (e.key === 'Escape') { e.preventDefault(); this._cancelEdit(); }
      else if (e.key === 'Tab') { e.preventDefault(); this._commitEdit(); this.active = { r: this.active.r, c: Math.min(this.colsN, this.active.c + 1) }; this._selectActive(); }
      return;
    }
    const { r, c } = this.active;
    const move = (nr, nc) => { e.preventDefault(); this.active = { r: Math.max(1, Math.min(this.rowsN, nr)), c: Math.max(1, Math.min(this.colsN, nc)) }; this._selectActive(); };
    if (e.key === 'ArrowUp') move(r - 1, c);
    else if (e.key === 'ArrowDown' || e.key === 'Enter') move(r + 1, c);
    else if (e.key === 'ArrowLeft') move(r, c - 1);
    else if (e.key === 'ArrowRight') move(r, c + 1);
    else if (e.key === 'Tab') move(r, c + (e.shiftKey ? -1 : 1));
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this._setRaw(r, c, ''); }
    else if (e.key === 'F2') { e.preventDefault(); this._startEdit(); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) this._startEdit(e.key);
  }

  _selectActive() {
    const { r, c } = this.active;
    this._table.querySelectorAll('td.active').forEach((e) => e.classList.remove('active'));
    const td = this._tdEl(r, c);
    if (td) { td.classList.add('active'); td.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    this._addr.textContent = numToCol(c) + r;
    const cell = this.cells.get(`${r},${c}`);
    this._fInput.value = cell ? cell.raw : '';
  }

  _tdEl(r, c) { return this._table.querySelector(`td[data-r="${r}"][data-c="${c}"]`); }

  _startEdit(initial) {
    if (this._editing) return;
    const { r, c } = this.active; const td = this._tdEl(r, c); if (!td) return;
    this._editing = true;
    const cell = this.cells.get(`${r},${c}`);
    const input = document.createElement('input'); input.className = 'cell-input';
    input.value = initial !== undefined ? initial : (cell ? cell.raw : '');
    td.textContent = ''; td.appendChild(input); input.focus();
    if (initial === undefined) input.select();
    input.addEventListener('blur', () => this._commitEdit());
    this._editor = { input, r, c };
  }

  _commitEdit() {
    if (!this._editing || !this._editor) return;
    const { input, r, c } = this._editor; const val = input.value;
    this._editing = false; this._editor = null;
    this._setRaw(r, c, val);
  }

  _cancelEdit() {
    if (!this._editing) return;
    this._editing = false; this._editor = null;
    this.recompute(); this._paint(); this._selectActive();
  }

  _setRaw(r, c, raw) {
    const key = `${r},${c}`;
    if (raw === '' || raw == null) this.cells.delete(key);
    else this.cells.set(key, { raw: String(raw) });
    this.recompute();
    this._paint();
    this._selectActive();
    this.dispatchEvent(new Event('change'));
  }

  // ---- evaluation ----
  recompute() {
    this.values.clear();
    const ctx = {
      cell: (col, row) => this._valueAt(row, col, new Set()),
      range: (c1, r1, c2, r2) => { const a = []; for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) a.push(this._valueAt(r, c, new Set())); return a; },
      sql: (q) => { if (!this.engine) throw new FormulaError('#NAME?'); const res = this.engine.query(q); return res.rows[0] ? res.rows[0][0] : null; },
    };
    this._ctx = ctx;
    for (const key of this.cells.keys()) {
      const [r, c] = key.split(',').map(Number);
      this._valueAt(r, c, new Set());
    }
  }

  _valueAt(r, c, stack) {
    const key = `${r},${c}`;
    if (this.values.has(key)) return this.values.get(key);
    const cell = this.cells.get(key);
    if (!cell) return null;
    const raw = cell.raw;
    if (raw[0] !== '=') {
      const num = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(raw.trim()) ? Number(raw) : raw;
      this.values.set(key, num); return num;
    }
    if (stack.has(key)) { const e = { error: '#CIRC!' }; this.values.set(key, e); return e; }
    stack.add(key);
    let result;
    try {
      const ctx = {
        cell: (col, row) => { const v = this._valueAt(row, col, stack); return v && v.error ? 0 : v; },
        range: (c1, r1, c2, r2) => { const a = []; for (let rr = r1; rr <= r2; rr++) for (let cc = c1; cc <= c2; cc++) { const v = this._valueAt(rr, cc, stack); a.push(v && v.error ? 0 : v); } return a; },
        sql: this._ctx.sql,
      };
      result = evaluate(raw, ctx);
    } catch (err) { result = { error: err.code || '#ERROR!' }; }
    stack.delete(key);
    this.values.set(key, result);
    return result;
  }

  _display(r, c, computed) {
    const cell = this.cells.get(`${r},${c}`);
    if (!cell) return '';
    if (!computed) return cell.raw;
    const v = this.values.get(`${r},${c}`);
    if (v && v.error) return v.error;
    return v == null ? '' : v;
  }

  _paint() {
    for (let r = 1; r <= this.rowsN; r++) {
      for (let c = 1; c <= this.colsN; c++) {
        const td = this._tdEl(r, c); if (!td) continue;
        const cell = this.cells.get(`${r},${c}`);
        const v = cell ? this.values.get(`${r},${c}`) : null;
        td.classList.toggle('formula-cell', !!(cell && cell.raw[0] === '='));
        td.classList.toggle('err', !!(v && v.error));
        td.classList.toggle('num', typeof v === 'number');
        td.textContent = v == null ? '' : (v.error ? v.error : String(v));
      }
    }
  }
}

customElements.define('edot-sheet', EdotSheet);
