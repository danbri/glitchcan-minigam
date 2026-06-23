// data-engine.js — SQLite (via sql.js / WASM) data layer for edot.
//
// Runs SQLite entirely in the browser on the main thread (no COOP/COEP, so it
// works on GitHub Pages), in memory, and persists by serialising the whole
// database to IndexedDB. Stores both CSV-imported data and hand-made
// relational tables/views. This is the shared engine behind the data web
// components (grid / sheet / query / workspace).

const SQLJS_BASE = new URL('../../../third_party/sqljs/', import.meta.url);
const IDB_DB = 'edot-data';
const IDB_STORE = 'kv';
const IDB_KEY = 'db.sqlite';

let _scriptPromise = null;
function loadSqlJsScript() {
  if (_scriptPromise) return _scriptPromise;
  _scriptPromise = new Promise((resolve, reject) => {
    if (window.initSqlJs) return resolve(window.initSqlJs);
    const s = document.createElement('script');
    s.src = new URL('sql-wasm.js', SQLJS_BASE).href;
    s.onload = () => resolve(window.initSqlJs);
    s.onerror = () => reject(new Error('Failed to load sql.js'));
    document.head.appendChild(s);
  });
  return _scriptPromise;
}

export class DataEngine extends EventTarget {
  constructor() {
    super();
    this.SQL = null;
    this.db = null;
    this._saveTimer = null;
  }

  async init() {
    const initSqlJs = await loadSqlJsScript();
    this.SQL = await initSqlJs({ locateFile: (f) => new URL(f, SQLJS_BASE).href });
    const saved = await idbGet().catch(() => null);
    this.db = saved ? new this.SQL.Database(saved) : new this.SQL.Database();
    this._changed();
    return this;
  }

  // ---- low-level ----
  run(sql, params) { this.db.run(sql, params); this._touch(); }

  // First result set as { columns, rows }.
  query(sql, params) {
    const stmt = this.db.prepare(sql);
    try {
      if (params) stmt.bind(params);
      const columns = stmt.getColumnNames();
      const rows = [];
      while (stmt.step()) rows.push(stmt.get());
      return { columns: columns.length ? columns : (rows[0] ? rows[0].map((_, i) => `c${i}`) : []), rows };
    } finally { stmt.free(); }
  }

  exec(sql) { const r = this.db.exec(sql); this._touch(); return r; }

  // ---- schema ----
  listObjects() {
    const { rows } = this.query(
      "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') " +
      "AND name NOT LIKE 'sqlite_%' ORDER BY type, name");
    return rows.map(([name, type]) => ({ name, type }));
  }

  columns(table) {
    const { rows } = this.query(`PRAGMA table_info(${quoteId(table)})`);
    return rows.map(([cid, name, type, notnull, dflt, pk]) => ({ name, type, notnull: !!notnull, pk: !!pk }));
  }

  isView(name) {
    const { rows } = this.query("SELECT type FROM sqlite_master WHERE name=?", [name]);
    return rows[0] && rows[0][0] === 'view';
  }

  // ---- rows (editable tables expose rowid) ----
  tableRows(table, { limit = 1000, offset = 0 } = {}) {
    const view = this.isView(table);
    const cols = this.columns(table).map((c) => c.name);
    const sel = view ? '*' : `rowid AS __rowid, *`;
    const { columns, rows } = this.query(
      `SELECT ${sel} FROM ${quoteId(table)} LIMIT ${+limit} OFFSET ${+offset}`);
    if (view) return { columns, rows, rowids: null, editable: false };
    const rowids = rows.map((r) => r[0]);
    return { columns: columns.slice(1), rows: rows.map((r) => r.slice(1)), rowids, editable: true, cols };
  }

  updateCell(table, rowid, column, value) {
    this.run(`UPDATE ${quoteId(table)} SET ${quoteId(column)}=? WHERE rowid=?`, [value, rowid]);
  }

  insertEmptyRow(table) {
    const cols = this.columns(table);
    if (!cols.length) throw new Error('Table has no columns');
    const names = cols.map((c) => quoteId(c.name)).join(',');
    const qs = cols.map(() => 'NULL').join(',');
    this.run(`INSERT INTO ${quoteId(table)} (${names}) VALUES (${qs})`);
    const { rows } = this.query('SELECT last_insert_rowid()');
    return rows[0][0];
  }

  deleteRow(table, rowid) { this.run(`DELETE FROM ${quoteId(table)} WHERE rowid=?`, [rowid]); }

  addColumn(table, name) { this.run(`ALTER TABLE ${quoteId(table)} ADD COLUMN ${quoteId(name)}`); }

  dropObject(name) {
    const kind = this.isView(name) ? 'VIEW' : 'TABLE';
    this.run(`DROP ${kind} IF EXISTS ${quoteId(name)}`);
  }

  rename(oldName, newName) {
    if (this.isView(oldName)) throw new Error('Rename a view by recreating it');
    this.run(`ALTER TABLE ${quoteId(oldName)} RENAME TO ${quoteId(newName)}`);
  }

  createView(name, selectSql) {
    this.run(`DROP VIEW IF EXISTS ${quoteId(name)}`);
    this.run(`CREATE VIEW ${quoteId(name)} AS ${selectSql}`);
  }

  // ---- CSV ----
  createTableFromColumns(name, columnNames, rows = []) {
    const cols = columnNames.map((c) => quoteId(c)).join(', ');
    this.run(`DROP TABLE IF EXISTS ${quoteId(name)}`);
    this.run(`CREATE TABLE ${quoteId(name)} (${cols})`);
    if (rows.length) {
      const ph = columnNames.map(() => '?').join(',');
      const stmt = this.db.prepare(`INSERT INTO ${quoteId(name)} VALUES (${ph})`);
      try {
        this.db.run('BEGIN');
        for (const r of rows) stmt.run(columnNames.map((_, i) => (r[i] === undefined ? null : r[i])));
        this.db.run('COMMIT');
      } finally { stmt.free(); }
      this._touch();
    }
  }

  // ---- persistence ----
  exportDb() { return this.db.export(); }
  async importDb(bytes) {
    this.db = new this.SQL.Database(new Uint8Array(bytes));
    await this._persistNow();
    this._changed();
  }

  _touch() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._persistNow(), 400);
    this._changed();
  }
  _changed() { this.dispatchEvent(new Event('change')); }
  async _persistNow() { try { await idbSet(this.db.export()); } catch (_) { /* quota */ } }
  async clearAll() { this.db = new this.SQL.Database(); await this._persistNow(); this._changed(); }
}

// ---- helpers ----
export function quoteId(id) { return '"' + String(id).replace(/"/g, '""') + '"'; }

// sanitize a string into a valid SQL identifier (table/column).
export function safeIdent(s, fallback = 'col') {
  let id = String(s == null ? '' : s).trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!id) id = fallback;
  if (/^[0-9]/.test(id)) id = '_' + id;
  return id;
}

// ---- IndexedDB blob store (no external deps) ----
function idbOpen() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbSet(bytes) {
  const db = await idbOpen();
  await new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
async function idbGet() {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const rq = tx.objectStore(IDB_STORE).get(IDB_KEY);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => rej(rq.error);
  });
}
