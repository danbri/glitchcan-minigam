// data-workspace.js — <edot-data>: the data layer that ties the SQLite engine,
// the editable grid, the Excel-like sheet, and the Access-like query workbench
// together — with the bridges between them:
//   • CSV  -> SQLite table         (Import CSV)
//   • table/view -> grid (editable, writes back via SQL)
//   • table -> sheet               (Open as sheet — add formulas over data)
//   • sheet -> SQLite table        (Save as table — now queryable in SQL)
//   • query/view results -> sheet  (Send to sheet)
//   • spreadsheet cell -> SQL      (=SQL("…") in a formula)
// Sheets persist inside the same database (a __edot_sheets meta table).

import { DataEngine, safeIdent, quoteId } from './data-engine.js';
import { parseCsv, coerce, toCsv } from './csv.js';
import { tablesToNquads, nquadsToTables } from './nquads.js';
import { zipSync, unzip, utf8 } from '../js/zip.js';
import { fingerprint } from '../js/data-object.js';
import { holdLabel, consumedPeek } from '../js/longpress.js';
import { getKernel } from '../js/edot-kernel.js';
import './grid-component.js';
import './sheet-component.js';
import './query-component.js';

const META = '__edot_sheets';
const FOLDERS = '__edot_folders';
const SETTINGS = '__edot_settings';
const DEFAULT_FOLDER = 'General';
const CHINOOK_TABLES = ['Album', 'Artist', 'Customer', 'Employee', 'Genre', 'Invoice', 'InvoiceLine', 'MediaType', 'Playlist', 'PlaylistTrack', 'Track'];
const CHINOOK_DEMO = `-- Chinook sample — top-selling artists (a 4-table join)
SELECT ar.Name AS artist,
       ROUND(SUM(il.UnitPrice * il.Quantity), 2) AS revenue,
       COUNT(*) AS lines_sold
FROM Artist ar
JOIN Album al ON al.ArtistId = ar.ArtistId
JOIN Track t  ON t.AlbumId  = al.AlbumId
JOIN InvoiceLine il ON il.TrackId = t.TrackId
GROUP BY ar.ArtistId
ORDER BY revenue DESC
LIMIT 12;`;

export class EdotData extends HTMLElement {
  constructor() { super(); this.engine = new DataEngine(); this.active = null; this.geoIndex = null; }

  async init() {
    this._ready = this.engine.init();
    await this._ready;
    this.engine.run(`CREATE TABLE IF NOT EXISTS ${META} (name TEXT PRIMARY KEY, def TEXT)`);
    this.engine.run(`CREATE TABLE IF NOT EXISTS ${FOLDERS} (obj TEXT PRIMARY KEY, folder TEXT)`);
    this.engine.run(`CREATE TABLE IF NOT EXISTS ${SETTINGS} (k TEXT PRIMARY KEY, v TEXT)`);
    this._render();
    this.refresh();
    this._showWelcome();
    // Let other apps (geo, events, feeds) surface data here as a table.
    try { getKernel().capabilities.provide('data.addTable', ({ title, columns, rows } = {}) => this.addTable(title, columns, rows)); } catch (_) { /* kernel optional */ }
    const gs = this.getAttribute('geo-src');
    if (gs) this.enableGeo(gs).catch(() => {});
    return this;
  }

  // Enable the geo spreadsheet functions (QID/LAT/LON/GEODISTANCE/…) for this
  // data pane's sheets by loading a gazetteer once (an array of Places or a URL
  // to an in-repo NDJSON extract) and sharing the index with every sheet.
  async enableGeo(src) {
    let places = src;
    if (typeof src === 'string') {
      const { parseNdjson } = await import('../places/js/providers/local.js');
      const res = await fetch(src);
      if (!res.ok) throw new Error(`gazetteer ${res.status}`);
      places = parseNdjson(await res.text());
    }
    const idx = new Map();
    for (const p of places || []) {
      if (p.name) idx.set(String(p.name).toLowerCase(), p);
      if (p.wikidataId) idx.set(String(p.wikidataId).toUpperCase(), p);
    }
    this.geoIndex = idx;
    for (const sheet of this.querySelectorAll('edot-sheet')) {
      sheet.geoIndex = idx;
      if (sheet._built) { sheet.recompute(); sheet._paint?.(); }
    }
    return idx.size;
  }

  connectedCallback() { if (!this._built) this.init(); }

  _render() {
    this._built = true;
    this.innerHTML = '';
    const root = document.createElement('div'); root.className = 'dw';

    const tb = document.createElement('div'); tb.className = 'dw-toolbar';
    // One file input opens any durable upstream form; the workspace routes by
    // extension (.csv / .zip-of-csvs / .sqlite / .nq / .nquads).
    const file = document.createElement('input'); file.type = 'file';
    file.accept = '.csv,.txt,.zip,.sqlite,.db,.nq,.nquads,text/csv,application/zip,application/octet-stream';
    file.style.display = 'none';
    this._openFileInput = file; // reused by the welcome panel's "Open a file"
    const menu = this._btn('☰', () => root.classList.toggle('side-open')); menu.classList.add('dw-menu-btn'); menu.setAttribute('aria-label', 'Show objects');
    tb.append(
      menu,
      this._btn('⬆ Open…', () => file.click(), 'primary'),
      this._btn('🎵 Sample (Chinook)', () => this.loadChinook()),
      this._btn('＋ Sheet', () => this.newSheet()),
      this._btn('＋ Table', () => this.newTable()),
      this._btn('▤ SQL', () => this.openQuery()),
      spacer(),
      // Durable export forms — data outlives the editor (see OPENDOC.md).
      this._btn('⬇ SQLite', () => this.exportDb()),
      this._btn('⬇ CSVs', () => this.exportCsvsZip()),
      this._btn('⬇ N-Quads', () => this.exportNquads()),
      file,
    );

    const side = document.createElement('div'); side.className = 'dw-side';
    const main = document.createElement('div'); main.className = 'dw-main';
    root.append(tb, side, main);
    this.innerHTML = ''; this.appendChild(root);
    this._side = side; this._main = main; this._root = root;
    // Tap the scrim (or pick an item) closes the mobile drawer.
    root.addEventListener('click', (e) => { if (e.target === root) root.classList.remove('side-open'); });

    file.addEventListener('change', () => { if (file.files[0]) this.openAnyFile(file.files[0]); file.value = ''; });
    this.addEventListener('views-changed', () => this.refresh());
    this.addEventListener('to-sheet', (e) => this.sheetFromResult(e.detail));
    this.addEventListener('to-editor', (e) => this.sendToEditor(e.detail.columns, e.detail.rows, 'Query result'));
  }

  _btn(label, fn, cls) {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'dbtn' + (cls ? ` ${cls}` : ''); b.textContent = label;
    b.addEventListener('click', () => { if (consumedPeek(b)) return; fn(); });
    holdLabel(b, label); // same press-and-hold reveal as the editor toolbar
    return b;
  }

  // ---- sidebar ----
  refresh() {
    const objs = this.engine.listObjects().filter((o) => o.name !== META && !o.name.startsWith('__edot'));
    const tables = objs.filter((o) => o.type === 'table');
    const views = objs.filter((o) => o.type === 'view');
    const sheets = this._sheetNames();
    // One unified object list so a folder can hold tables, views and sheets
    // together — "everything in a folder", regardless of kind.
    const items = [
      ...tables.map((t) => ({ name: t.name, kind: 'Tables', icon: '▦', open: () => this.openTable(t.name) })),
      ...views.map((v) => ({ name: v.name, kind: 'Views', icon: '◫', open: () => this.openTable(v.name) })),
      ...sheets.map((n) => ({ name: n, kind: 'Sheets', icon: '▦ƒ', open: () => this.openSheet(n) })),
    ];
    this._side.innerHTML = '';
    this._root?.classList.toggle('dw-empty-objects', items.length === 0);

    // Group every object under its folder (defaulting to the active project /
    // General). Folders with no objects still show so they can be filled.
    const byFolder = new Map();
    for (const f of this._allFolders()) byFolder.set(f, []);
    for (const it of items) {
      const f = this._objFolder(it.name);
      if (!byFolder.has(f)) byFolder.set(f, []);
      byFolder.get(f).push(it);
    }

    const head = document.createElement('div'); head.className = 'dw-side-head';
    const add = document.createElement('button'); add.type = 'button'; add.className = 'dw-newfolder'; add.textContent = '＋ Folder';
    add.title = 'New folder'; add.addEventListener('click', () => this._newFolder());
    head.appendChild(add); this._side.appendChild(head);

    const folders = [...byFolder.keys()].sort((a, b) => (a === this._defaultFolder() ? -1 : b === this._defaultFolder() ? 1 : a.localeCompare(b)));
    for (const folder of folders) this._renderFolder(folder, byFolder.get(folder));
  }

  _renderFolder(folder, items) {
    const det = document.createElement('details'); det.className = 'dw-folder'; det.open = true;
    const sum = document.createElement('summary'); sum.className = 'dw-folder-h';
    sum.innerHTML = `<span class="dw-folder-ic">📁</span><span class="dw-folder-nm"></span><span class="dw-folder-n">${items.length}</span>`;
    sum.querySelector('.dw-folder-nm').textContent = folder;
    det.appendChild(sum);
    if (!items.length) {
      const e = document.createElement('div'); e.className = 'dw-empty'; e.textContent = 'Empty — move items here.'; det.appendChild(e);
    }
    for (const item of items) {
      const it = document.createElement('button'); it.type = 'button'; it.className = 'dw-item';
      if (this.active && this.active.name === item.name) it.classList.add('active');
      const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = item.icon; ic.title = item.kind;
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = item.name;
      const mv = document.createElement('span'); mv.textContent = '⤴'; mv.title = 'Move to folder'; mv.className = 'hint';
      mv.addEventListener('click', (e) => { e.stopPropagation(); this._moveToFolder(item.name); });
      const del = document.createElement('span'); del.textContent = '✕'; del.title = 'Delete'; del.className = 'hint';
      del.addEventListener('click', (e) => { e.stopPropagation(); this._delete(item.kind, item.name); });
      it.append(ic, nm, mv, del);
      it.addEventListener('click', () => { item.open(); this._root.classList.remove('side-open'); });
      det.appendChild(it);
    }
    this._side.appendChild(det);
  }

  // ---- folders ----
  _defaultFolder() { return this._projectFolder || DEFAULT_FOLDER; }
  // The folder an object belongs to (its stored folder, or the default).
  _objFolder(name) {
    try { const r = this.engine.query(`SELECT folder FROM ${FOLDERS} WHERE obj=?`, [name]).rows; if (r.length && r[0][0]) return r[0][0]; } catch (_) {}
    return this._defaultFolder();
  }
  _setObjFolder(name, folder) {
    this.engine.run(`INSERT INTO ${FOLDERS}(obj, folder) VALUES(?,?) ON CONFLICT(obj) DO UPDATE SET folder=excluded.folder`, [name, folder]);
  }
  // Known folder names: the default, any referenced by an object, plus explicitly
  // created (possibly empty) folders persisted in settings.
  _allFolders() {
    const set = new Set([this._defaultFolder()]);
    try { for (const r of this.engine.query(`SELECT DISTINCT folder FROM ${FOLDERS}`).rows) if (r[0]) set.add(r[0]); } catch (_) {}
    for (const f of this._extraFolders()) set.add(f);
    return [...set];
  }
  _extraFolders() {
    try { const r = this.engine.query(`SELECT v FROM ${SETTINGS} WHERE k='folders'`).rows; return r.length ? JSON.parse(r[0][0]) : []; } catch (_) { return []; }
  }
  _saveExtraFolders(list) {
    this.engine.run(`INSERT INTO ${SETTINGS}(k,v) VALUES('folders',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`, [JSON.stringify([...new Set(list)])]);
  }
  _newFolder() {
    const name = (prompt('New folder name:', '') || '').trim();
    if (!name) return;
    this._saveExtraFolders([...this._extraFolders(), name]);
    this.refresh();
  }
  _moveToFolder(name) {
    const folders = this._allFolders();
    const to = (prompt(`Move "${name}" to folder (existing: ${folders.join(', ')}):`, this._objFolder(name)) || '').trim();
    if (!to) return;
    this._setObjFolder(name, to);
    this._saveExtraFolders([...this._extraFolders(), to]);
    this.refresh();
  }
  // Set the current project's folder; new/surfaced objects land here. Called by
  // the shell when a project opens, mirroring how the project scopes the workspace.
  setProjectFolder(name) {
    this._projectFolder = (name || '').trim() || null;
    if (this._projectFolder) this._saveExtraFolders([...this._extraFolders(), this._projectFolder]);
    if (this._side) this.refresh();
  }

  _delete(section, name) {
    if (!confirm(`Delete ${name}?`)) return;
    if (section === 'Sheets') this.engine.run(`DELETE FROM ${META} WHERE name=?`, [name]);
    else this.engine.dropObject(name);
    try { this.engine.run(`DELETE FROM ${FOLDERS} WHERE obj=?`, [name]); } catch (_) {}
    if (this.active && this.active.name === name) this._main.innerHTML = '';
    this.active = null;
    this.refresh();
  }

  // ---- table / view view: one object, interchangeable task-contextual faces
  // (OpenDoc spirit). The same table is shown as a datasheet (database face), a
  // spreadsheet (compute lens), or RDF (the durable N-Quads form). ----
  openTable(name, face = 'grid') {
    this._face = face;
    this.active = { kind: 'table', name, face };
    this._main.innerHTML = '';
    if (face === 'sheet') return this._tableSheetFace(name);
    if (face === 'rdf') return this._tableRdfFace(name);
    this._tableGridFace(name);
  }

  // A segmented "view as" control shared by every face.
  _faceSwitcher(name) {
    const wrap = document.createElement('span'); wrap.className = 'dw-faces';
    wrap.setAttribute('role', 'group'); wrap.setAttribute('aria-label', 'View as');
    for (const [id, glyph, label] of [['grid', '▦', 'Datasheet'], ['sheet', '▦ƒ', 'Spreadsheet'], ['rdf', '⌗', 'RDF']]) {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'dw-face' + (this._face === id ? ' active' : '');
      if (this._face === id) b.setAttribute('aria-current', 'true');
      b.textContent = `${glyph} ${label}`;
      b.addEventListener('click', () => { if (consumedPeek(b)) return; this.openTable(name, id); });
      holdLabel(b, `View this object as a ${label.toLowerCase()}`);
      wrap.appendChild(b);
    }
    return wrap;
  }

  _tableGridFace(name) {
    const data = this.engine.tableRows(name, { limit: 2000 });
    const common = [
      this._btn('→ Editor', () => this.sendToEditor(data.columns, data.rows, name)),
      this._btn('⬇ CSV', () => this.downloadCsv(name)),
    ];
    this._main.appendChild(this._head(name, [
      this._faceSwitcher(name),
      ...(data.editable ? [
        this._btn('＋ Row', () => { this.engine.insertEmptyRow(name); this.openTable(name, 'grid'); }),
        this._btn('✕ Row', () => this._deleteActiveRow(name)),
      ] : []),
      ...common,
    ], 'Datasheet — click a column header to sort; double-tap a cell to edit.'));
    const grid = document.createElement('edot-grid');
    this._main.appendChild(grid);
    grid.setData({ columns: data.columns, rows: data.rows, editable: data.editable });
    this._gridState = { name, rowids: data.rowids };
    grid.addEventListener('cell-select', (e) => { this._activeRow = e.detail.row; });
    grid.addEventListener('cell-change', (e) => {
      const rowid = data.rowids[e.detail.row];
      this.engine.updateCell(name, rowid, e.detail.columnName, coerce(e.detail.value));
    });
    this.refresh();
  }

  // Spreadsheet face: a compute lens over the table. It's a scratch surface —
  // edits aren't written back (use "Save as table" to materialise).
  _tableSheetFace(name) {
    const data = this.engine.tableRows(name, { limit: 2000 });
    this._main.appendChild(this._head(name, [
      this._faceSwitcher(name),
      this._btn('▤ Save as table', () => this._materializeActiveSheet(name)),
      this._btn('→ Editor', () => { const t = this._activeSheet.toTable({ headerRow: true }); this.sendToEditor(t.columns, t.rows, name); }),
    ], 'Spreadsheet lens — add =formulas in spare cells (e.g. =SUM(B2:B9)). Scratch view; edits aren’t written back — use “Save as table”.'));
    const sheet = document.createElement('edot-sheet');
    this._main.appendChild(sheet);
    sheet.engine = this.engine;
    if (this.geoIndex) sheet.geoIndex = this.geoIndex;
    sheet.setGrid({ rows: [data.columns, ...data.rows.map((r) => r.map((v) => (v == null ? '' : v)))] });
    sheet.recompute(); sheet._paint();
    this._activeSheet = sheet;
    this.refresh();
  }

  _materializeActiveSheet(srcName) {
    const sheet = this._activeSheet; if (!sheet) return;
    const { columns, rows } = sheet.toTable({ headerRow: true });
    const tableName = this._unique(safeIdent(srcName) + '_edit');
    this.engine.createTableFromColumns(tableName, dedupe(columns.map((c) => safeIdent(c))), rows.map((r) => r.map(coerce)));
    this.refresh(); this.openTable(tableName, 'grid');
  }

  // RDF face: the durable N-Quads form of this one table, viewable in place.
  _tableRdfFace(name) {
    const text = tablesToNquads(this.engine, [name]);
    this._main.appendChild(this._head(name, [
      this._faceSwitcher(name),
      this._btn('⬇ N-Quads', () => this._emit(utf8.encode(text), `${name}.nq`, 'application/n-quads')),
      this._btn('⎘ Copy', () => { try { navigator.clipboard.writeText(text); this._toast('N-Quads copied to clipboard'); } catch { this._toast('Clipboard unavailable'); } }),
    ], 'RDF face — the durable N-Quads form: named graph = table, predicate = column, subject = row.'));
    const pre = document.createElement('textarea');
    pre.className = 'dw-rdf'; pre.readOnly = true; pre.spellcheck = false;
    pre.value = text || '(no rows yet)';
    this._main.appendChild(pre);
    this.refresh();
  }

  _deleteActiveRow(name) {
    const r = this._activeRow; if (r == null || !this._gridState) return;
    const rowid = this._gridState.rowids[r];
    if (rowid == null) return;
    this.engine.deleteRow(name, rowid);
    this.openTable(name);
  }

  // ---- sheet view ----
  openSheet(name) {
    this.active = { kind: 'sheet', name };
    const def = this._loadSheet(name);
    this._main.innerHTML = '';
    this._main.appendChild(this._head(name, [
      this._btn('▤ Save as table', () => this.sheetToTable(name)),
      this._btn('→ Editor', () => { const t = this._activeSheet.toTable({ headerRow: true }); this.sendToEditor(t.columns, t.rows, name); }),
    ], 'Spreadsheet — type values or =formulas (try =SUM(A1:A3) or =SQL("SELECT count(*) FROM …"))'));
    const sheet = document.createElement('edot-sheet');
    this._main.appendChild(sheet);
    sheet.engine = this.engine;
    if (this.geoIndex) sheet.geoIndex = this.geoIndex;
    sheet.deserialize(def);
    sheet.recompute(); sheet._paint();
    sheet.addEventListener('change', () => this._saveSheet(name, sheet.serialize()));
    this._activeSheet = sheet;
    this.refresh();
  }

  // A friendly start panel instead of dropping users into a raw SQL prompt.
  // SQL is one card here, not the front door.
  _showWelcome() {
    this.active = null;
    this._main.innerHTML = '';
    const w = document.createElement('div'); w.className = 'dw-welcome';
    const h = document.createElement('h2'); h.textContent = 'Data';
    const p = document.createElement('p'); p.textContent = 'Spreadsheets, tables and queries over a database that runs in your browser. Start with:';
    const grid = document.createElement('div'); grid.className = 'dw-welcome-grid';
    const card = (icon, title, desc, fn) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'dw-card';
      const i = document.createElement('span'); i.className = 'dw-card-ic'; i.textContent = icon;
      const t = document.createElement('span'); t.className = 'dw-card-t'; t.textContent = title;
      const d = document.createElement('span'); d.className = 'dw-card-d'; d.textContent = desc;
      b.append(i, t, d); b.addEventListener('click', fn); return b;
    };
    grid.append(
      card('📂', 'Open a file', 'CSV · SQLite · N-Quads', () => this._openFileInput?.click()),
      card('🎵', 'Sample database', 'Explore the Chinook demo', () => this.loadChinook()),
      card('▦ƒ', 'New spreadsheet', 'Cells & formulas (incl. geo)', () => this.newSheet()),
      card('▦', 'New table', 'An editable datasheet', () => this.newTable()),
      card('▤', 'Write SQL', 'Query workbench (advanced)', () => this.openQuery()),
    );
    w.append(h, p, grid);
    this._main.appendChild(w);
  }

  // ---- query view ----
  openQuery() {
    this.active = { kind: 'query', name: null };
    this._main.innerHTML = '';
    this._main.appendChild(this._head('SQL query', [], 'Run SQL over your tables, sheets and views. Ctrl/⌘+Enter runs. Save a SELECT as a view.'));
    const q = document.createElement('edot-query');
    this._main.appendChild(q);
    q.engine = this.engine;
    this.refresh();
  }

  _head(title, actions = [], sub) {
    const wrap = document.createElement('div');
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:.4rem;align-items:center;margin-bottom:.4rem;flex-wrap:wrap';
    const h = document.createElement('strong'); h.textContent = title; h.style.fontSize = '1.05rem';
    row.appendChild(h); actions.forEach((a) => row.appendChild(a));
    wrap.appendChild(row);
    if (sub) { const s = document.createElement('div'); s.className = 'hint'; s.style.marginBottom = '.4rem'; s.textContent = sub; wrap.appendChild(s); }
    return wrap;
  }

  // ---- integrations ----
  async importCsv(file) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) return;
    const base = safeIdent(file.name.replace(/\.[^.]+$/, ''), 'imported');
    const name = this._unique(base);
    const header = rows[0].map((h, i) => safeIdent(h || `col${i + 1}`, `col${i + 1}`));
    const body = rows.slice(1).map((r) => r.map(coerce));
    this.engine.createTableFromColumns(name, dedupe(header), body);
    this.refresh();
    this.openTable(name);
  }

  // Hydrate from a project bundle: create a table named `title` from CSV text.
  // Waits for the SQLite engine so it's safe to call right after mount.
  async addCsvTable(title, text) {
    if (this._ready) { try { await this._ready; } catch (_) { /* engine error surfaces below */ } }
    const rows = parseCsv(String(text || ''));
    if (!rows.length) return null;
    const name = this._unique(safeIdent(title || 'table', 'imported'));
    const header = rows[0].map((h, i) => safeIdent(h || `col${i + 1}`, `col${i + 1}`));
    const body = rows.slice(1).map((r) => r.map(coerce));
    this.engine.createTableFromColumns(name, dedupe(header), body);
    this.refresh();
    this.openTable(name);
    return name;
  }

  // Surface structured data (from geo / events / feeds) as a table. Waits for the
  // engine, dedupes the name, opens it. Returns the created table name.
  async addTable(title, columns, rows) {
    if (this._ready) { try { await this._ready; } catch (_) { /* engine error surfaces below */ } }
    const cols = dedupe((columns || []).map((c, i) => safeIdent(c || `col${i + 1}`, `col${i + 1}`)));
    const name = this._unique(safeIdent(title || 'table', 'imported'));
    this.engine.createTableFromColumns(name, cols, (rows || []).map((r) => r.map(coerce)));
    this.refresh();
    this.openTable(name);
    return name;
  }

  // For project snapshot: the active table as { title, csv }, or null.
  activeTableCsv() {
    if (!this.active || this.active.kind !== 'table' || !this.active.name) return null;
    try { const d = this.engine.tableRows(this.active.name, { limit: 100000 }); return { title: this.active.name, csv: toCsv(d.columns, d.rows) }; }
    catch (_) { return null; }
  }

  newTable() {
    const name = prompt('New table name:', 'table1'); if (!name) return;
    const colsStr = prompt('Columns (comma-separated):', 'name, value'); if (!colsStr) return;
    const cols = dedupe(colsStr.split(',').map((c) => safeIdent(c)));
    const tn = this._unique(safeIdent(name));
    this.engine.createTableFromColumns(tn, cols, []);
    this.refresh(); this.openTable(tn);
  }

  newSheet() {
    const name = prompt('New sheet name:', 'sheet1'); if (!name) return;
    const n = this._uniqueSheet(safeIdent(name));
    this._saveSheet(n, { rowsN: 30, colsN: 8, cells: [] });
    this.refresh(); this.openSheet(n);
  }

  tableToSheet(name) {
    const data = this.engine.tableRows(name, { limit: 2000 });
    const sheetName = this._uniqueSheet(name + '_sheet');
    const grid = [data.columns, ...data.rows.map((r) => r.map((v) => (v == null ? '' : v)))];
    const sheet = document.createElement('edot-sheet');
    sheet.setGrid({ rows: grid });
    this._saveSheet(sheetName, sheet.serialize());
    this.refresh(); this.openSheet(sheetName);
  }

  sheetToTable(sheetName) {
    const sheet = this._activeSheet; if (!sheet) return;
    const { columns, rows } = sheet.toTable({ headerRow: true });
    const tableName = this._unique(safeIdent(sheetName.replace(/_sheet$/, '')) || 'sheet_table');
    this.engine.createTableFromColumns(tableName, dedupe(columns.map((c) => safeIdent(c))), rows.map((r) => r.map(coerce)));
    this.refresh(); this.openTable(tableName);
  }

  sheetFromResult({ columns, rows }) {
    const name = this._uniqueSheet('query_sheet');
    const grid = [columns, ...rows.map((r) => r.map((v) => (v == null ? '' : v)))];
    const sheet = document.createElement('edot-sheet'); sheet.setGrid({ rows: grid });
    this._saveSheet(name, sheet.serialize());
    this.refresh(); this.openSheet(name);
  }

  // ---- Chinook sample (the open-source Northwind successor) ----
  async loadChinook() {
    const present = this.engine.query("SELECT name FROM sqlite_master WHERE type='table' AND name='Track'").rows.length;
    if (present && !confirm('Reload the Chinook sample? Its tables will be replaced.')) return;
    for (const t of CHINOOK_TABLES) this.engine.run(`DROP TABLE IF EXISTS ${quoteId(t)}`);
    const url = new URL('../../../third_party/chinook/Chinook_Sqlite.sql', import.meta.url);
    const sql = await (await fetch(url)).text();
    this.engine.run(sql);
    this.refresh();
    this.openQuery();
    const q = this._main.querySelector('edot-query');
    if (q) { q.setSql(CHINOOK_DEMO); q.run(); }
  }

  // ---- send to the edot editor (cross-tab) ----
  sendToEditor(columns, rows, title) {
    const html = toHtmlTable(columns, rows);
    const payload = { type: 'insert', title, html, at: Date.now() };
    try { localStorage.setItem('edot.handoff', JSON.stringify(payload)); } catch { /* quota */ }
    let live = false;
    try { const bc = new BroadcastChannel('edot'); bc.postMessage(payload); bc.close(); live = true; } catch { /* */ }
    // Also offer the raw table on the shared kernel bus, so a co-located host (the
    // workspace) can route it live into another pane (e.g. Slides) with no
    // serialize. Harmless on the standalone page — nothing subscribes there.
    try { getKernel().bus.publish('data:share', { columns, rows, title }); } catch { /* */ }
    this._toast(live ? 'Sent to the Editor — open the Editor app to see it.' : 'Saved for the Editor.');
  }

  _toast(msg) {
    let t = this.querySelector('.dw-toast');
    if (!t) { t = document.createElement('div'); t.className = 'dw-toast'; this.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ---- durable export forms (OPENDOC.md) ----
  // Each is a complete, software-independent upstream form of the same data
  // object: SQLite file, a zip of CSVs, or RDF N-Quads. Every export is
  // fingerprinted (SHA-256) so a version can be committed and verified later.
  async exportDb() { await this._emit(this.engine.exportDb(), 'edot-data.sqlite', 'application/octet-stream'); }

  async exportCsvsZip() {
    const files = {};
    const tables = this._userTableNames();
    for (const t of tables) {
      const d = this.engine.tableRows(t, { limit: 1000000 });
      files[`${t}.csv`] = toCsv(d.columns, d.rows);
    }
    files['MANIFEST.txt'] = `edot data object — ${tables.length} table(s)\n` +
      tables.map((t) => `  ${t}.csv`).join('\n') + `\nexported ${new Date().toISOString()}\n`;
    const blob = await zipSync(files);
    await this._emit(new Uint8Array(await blob.arrayBuffer()), 'edot-data.csv.zip', 'application/zip');
  }

  async exportNquads() {
    const text = tablesToNquads(this.engine);
    await this._emit(utf8.encode(text), 'edot-data.nq', 'application/n-quads');
  }

  // ---- unified import: route by extension (sniff as a fallback) ----
  async openAnyFile(file) {
    const n = (file.name || '').toLowerCase();
    try {
      if (n.endsWith('.sqlite') || n.endsWith('.db')) return await this.importDbFile(file);
      if (n.endsWith('.zip')) return await this.importCsvsZip(file);
      if (n.endsWith('.nq') || n.endsWith('.nquads')) return await this.importNquadsFile(file);
      if (n.endsWith('.csv') || n.endsWith('.txt')) return await this.importCsv(file);
      // Unknown extension: sniff the leading bytes.
      const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      if (head[0] === 0x50 && head[1] === 0x4b) return await this.importCsvsZip(file);     // 'PK'
      if (utf8.decode(head).startsWith('SQLite format')) return await this.importDbFile(file);
      return await this.importCsv(file);
    } catch (e) { this._toast(`Could not open ${file.name}: ${e.message}`); }
  }

  async importDbFile(file) { await this.engine.importDb(await file.arrayBuffer()); this.refresh(); this.openQuery(); this._toast(`Loaded ${file.name}`); }

  async importCsvsZip(file) {
    const map = await unzip(await file.arrayBuffer());
    let count = 0, last = null;
    for (const [fname, bytes] of Object.entries(map)) {
      if (!/\.csv$/i.test(fname)) continue;
      const rows = parseCsv(utf8.decode(bytes));
      if (!rows.length) continue;
      const name = this._unique(safeIdent(fname.replace(/.*\//, '').replace(/\.[^.]+$/, ''), 'imported'));
      const header = dedupe(rows[0].map((h, i) => safeIdent(h || `col${i + 1}`, `col${i + 1}`)));
      this.engine.createTableFromColumns(name, header, rows.slice(1).map((r) => r.map(coerce)));
      count++; last = name;
    }
    this.refresh();
    if (last) this.openTable(last);
    this._toast(`Imported ${count} table(s) from ${file.name}`);
  }

  async importNquadsFile(file) {
    const tables = nquadsToTables(await file.text());
    let last = null;
    for (const t of tables) {
      const name = this._unique(safeIdent(t.name, 'graph'));
      // N-Quads literals are already typed by the parser — don't re-coerce.
      this.engine.createTableFromColumns(name, dedupe(t.columns.map((c) => safeIdent(c))), t.rows);
      last = name;
    }
    this.refresh();
    if (last) this.openTable(last);
    this._toast(`Imported ${tables.length} table(s) from N-Quads`);
  }

  _userTableNames() {
    return this.engine.listObjects()
      .filter((o) => o.type === 'table' && o.name !== META && !o.name.startsWith('__edot'))
      .map((o) => o.name);
  }

  // Download + content fingerprint. SHA-256 is the "older versions committed,
  // maybe even digitally signed" gesture: the hash identifies this exact bytes.
  async _emit(bytes, filename, mime) {
    download(new Blob([bytes], { type: mime }), filename);
    let fp = '';
    // Shared SHA-256 helper — one fingerprint implementation across the suite
    // (editor .edoc, slides .edeck, and these durable data forms). See js/data-object.js.
    try { fp = await fingerprint(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)); }
    catch { /* crypto.subtle needs a secure context */ }
    this._lastFingerprint = fp;
    this._toast(`Exported ${filename}${fp ? ` · sha256 ${fp.slice(0, 12)}…` : ''}`);
    return fp;
  }

  downloadCsv(name) {
    const d = this.engine.tableRows(name, { limit: 100000 });
    download(new Blob([toCsv(d.columns, d.rows)], { type: 'text/csv' }), `${name}.csv`);
  }

  // ---- sheet meta storage ----
  _sheetNames() { return this.engine.query(`SELECT name FROM ${META} ORDER BY name`).rows.map((r) => r[0]); }
  _loadSheet(name) { const r = this.engine.query(`SELECT def FROM ${META} WHERE name=?`, [name]).rows[0]; return r ? JSON.parse(r[0]) : null; }
  _saveSheet(name, def) { this.engine.run(`INSERT OR REPLACE INTO ${META} (name, def) VALUES (?, ?)`, [name, JSON.stringify(def)]); }

  _existingNames() { return new Set([...this.engine.listObjects().map((o) => o.name), ...this._sheetNames()]); }
  _unique(base) { const ex = this._existingNames(); let n = base, i = 2; while (ex.has(n)) n = `${base}_${i++}`; return n; }
  _uniqueSheet(base) { const ex = new Set(this._sheetNames()); let n = base, i = 2; while (ex.has(n)) n = `${base}_${i++}`; return n; }
}

function dedupe(cols) {
  const seen = new Map(); return cols.map((c) => { let n = c; while (seen.has(n)) n = `${c}_${seen.get(c) + 1}`; seen.set(c, (seen.get(c) || 1) + 1); seen.set(n, 1); return n; });
}
function toHtmlTable(columns, rows) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  let h = '<table><tr>' + columns.map((c) => `<th>${esc(c)}</th>`).join('') + '</tr>';
  for (const r of rows) h += '<tr>' + r.map((v) => `<td>${esc(v)}</td>`).join('') + '</tr>';
  return h + '</table>';
}
function spacer() { const s = document.createElement('span'); s.className = 'dw-spacer'; return s; }
function download(blob, filename) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}

customElements.define('edot-data', EdotData);
