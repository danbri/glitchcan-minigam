// nquads.js — map relational tables <-> RDF N-Quads, a durable, software-
// independent upstream form. Each table becomes a named graph; each row a
// subject; each column a predicate; cells are literals. Generic N-Quads from
// elsewhere import too (graph -> table, predicate -> column, subject -> row).
//
// This is the "data ages like wine" face: an open, self-describing dataset
// that outlives any particular editor.

const XSD = 'http://www.w3.org/2001/XMLSchema#';
const iri = (s) => `<${s}>`;
const enc = (s) => encodeURIComponent(String(s));

function literal(v) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Number.isInteger(v) ? `"${v}"^^<${XSD}integer>` : `"${v}"^^<${XSD}double>`;
  }
  const s = String(v == null ? '' : v)
    .replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  return `"${s}"`;
}

// ---- export: engine tables -> N-Quads text ----
export function tablesToNquads(engine, tables) {
  const list = tables || engine.listObjects()
    .filter((o) => o.type === 'table' && !o.name.startsWith('__edot'))
    .map((o) => o.name);
  let out = '';
  for (const t of list) {
    const g = iri(`urn:edot:table:${enc(t)}`);
    const cols = engine.columns(t).map((c) => c.name);
    const { rows } = engine.query(`SELECT rowid, * FROM ${q(t)}`);
    for (const row of rows) {
      const rowid = row[0];
      const s = iri(`urn:edot:row:${enc(t)}:${rowid}`);
      cols.forEach((col, i) => {
        const v = row[i + 1];
        if (v === null || v === undefined) return;
        out += `${s} ${iri(`urn:edot:prop:${enc(t)}:${enc(col)}`)} ${literal(v)} ${g} .\n`;
      });
    }
  }
  return out;
}

// ---- import: N-Quads text -> [{ name, columns, rows }] ----
export function nquadsToTables(text) {
  const graphs = new Map(); // table -> { cols, colSet, rows: Map(subj -> obj) }
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const terms = parseLine(line);
    if (terms.length < 3) continue;
    const [s, p, o, gg] = terms;
    const table = graphToTable(gg ? gg.value : '');
    const col = predToCol(p.value);
    const subj = s.value;
    let G = graphs.get(table);
    if (!G) { G = { cols: [], colSet: new Set(), rows: new Map() }; graphs.set(table, G); }
    if (!G.colSet.has(col)) { G.colSet.add(col); G.cols.push(col); }
    let R = G.rows.get(subj);
    if (!R) { R = {}; G.rows.set(subj, R); }
    if (R[col] === undefined) R[col] = o.type === 'literal' ? coerce(o) : o.value;
  }
  const out = [];
  for (const [name, G] of graphs) {
    const columns = G.cols;
    const rows = [...G.rows.values()].map((r) => columns.map((c) => (r[c] === undefined ? null : r[c])));
    out.push({ name, columns, rows });
  }
  return out;
}

function graphToTable(g) {
  const m = /^urn:edot:table:(.+)$/.exec(g || '');
  if (m) return safeName(decodeURIComponent(m[1]));
  if (!g) return 'default';
  return safeName(lastSeg(g));
}
function predToCol(p) {
  const m = /^urn:edot:prop:[^:]+:(.+)$/.exec(p || '');
  if (m) return safeName(decodeURIComponent(m[1]));
  return safeName(lastSeg(p));
}
function lastSeg(uri) { return String(uri).split(/[/#]/).filter(Boolean).pop() || 'value'; }
function safeName(s) {
  let id = String(s).replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!id) id = 'col';
  if (/^[0-9]/.test(id)) id = '_' + id;
  return id;
}
function coerce(o) {
  if (o.datatype && /(integer|decimal|double|float|long|int)$/i.test(o.datatype)) {
    const n = Number(o.value); if (!Number.isNaN(n)) return n;
  }
  return o.value;
}

// minimal N-Quads line tokenizer -> array of terms {type, value, datatype?}
function parseLine(line) {
  const terms = []; let i = 0;
  const ws = () => { while (i < line.length && /\s/.test(line[i])) i++; };
  while (true) {
    ws();
    if (i >= line.length || line[i] === '.') break;
    const c = line[i];
    if (c === '<') { const j = line.indexOf('>', i); if (j < 0) break; terms.push({ type: 'iri', value: line.slice(i + 1, j) }); i = j + 1; }
    else if (c === '"') {
      let j = i + 1, val = '';
      while (j < line.length) {
        if (line[j] === '\\') { val += unesc(line[j + 1]); j += 2; }
        else if (line[j] === '"') break;
        else { val += line[j]; j++; }
      }
      i = j + 1;
      let datatype = null;
      if (line[i] === '^' && line[i + 1] === '^' && line[i + 2] === '<') { const k = line.indexOf('>', i); datatype = line.slice(i + 3, k); i = k + 1; }
      else if (line[i] === '@') { let k = i + 1; while (k < line.length && /[\w-]/.test(line[k])) k++; i = k; }
      terms.push({ type: 'literal', value: val, datatype });
    }
    else if (c === '_' && line[i + 1] === ':') { let j = i + 2; while (j < line.length && /\S/.test(line[j]) && line[j] !== '.') j++; terms.push({ type: 'bnode', value: line.slice(i, j) }); i = j; }
    else break;
  }
  return terms;
}
function unesc(ch) { return ({ n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\' })[ch] || ch; }
function q(id) { return '"' + String(id).replace(/"/g, '""') + '"'; }
