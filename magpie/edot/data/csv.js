// csv.js — RFC 4180-ish CSV parse/serialize (no dependencies).

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', i = 0, inQ = false;
  const s = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  while (i < s.length) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  // last field/row
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  // drop a trailing empty row from a final newline
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  return rows;
}

export function toCsv(columns, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = columns && columns.length ? esc.length && columns.map(esc).join(',') + '\n' : '';
  return head + rows.map((r) => r.map(esc).join(',')).join('\n') + '\n';
}

// Coerce a CSV string cell to a number when it looks numeric (keeps text otherwise).
export function coerce(v) {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') return v;
  const t = v.trim();
  if (t !== '' && /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t)) return Number(t);
  return v;
}
