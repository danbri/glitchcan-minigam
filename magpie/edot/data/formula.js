// formula.js — a small Excel-style formula engine: cell refs (A1), ranges
// (A1:B3), arithmetic/comparison/concat operators, and a library of common
// functions. Plus SQL("…") — the bridge that lets a spreadsheet cell pull a
// value straight out of the relational layer.
//
// Pure: evaluate(formula, ctx) where ctx supplies cell/range/sql access.

export class FormulaError extends Error {
  constructor(code) { super(code); this.code = code; this.isFormulaError = true; }
}

// ---- A1 <-> indices (1-based) ----
export function colToNum(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
export function numToCol(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - 1 - r) / 26; }
  return s;
}
export function parseRef(ref) {
  const m = /^\$?([A-Za-z]+)\$?([0-9]+)$/.exec(ref);
  if (!m) return null;
  return { col: colToNum(m[1]), row: parseInt(m[2], 10) };
}

// ---- tokenizer ----
function tokenize(src) {
  const toks = [];
  let i = 0;
  const re = {
    num: /^\d+(\.\d+)?([eE][-+]?\d+)?/,
    str: /^"([^"]*(""[^"]*)*)"/,
    ref: /^\$?[A-Za-z]{1,3}\$?\d+/,
    name: /^[A-Za-z_][A-Za-z0-9_.]*/,
    op2: /^(<=|>=|<>)/,
    op1: /^[-+*/^&=<>%(),:]/,
    ws: /^\s+/,
  };
  while (i < src.length) {
    const s = src.slice(i);
    let m;
    if ((m = re.ws.exec(s))) { i += m[0].length; continue; }
    if ((m = re.num.exec(s))) { toks.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
    if ((m = re.str.exec(s))) { toks.push({ t: 'str', v: m[1].replace(/""/g, '"') }); i += m[0].length; continue; }
    if ((m = re.op2.exec(s))) { toks.push({ t: 'op', v: m[0] }); i += 2; continue; }
    if ((m = re.ref.exec(s)) && parseRef(m[0])) {
      // a ref must not be immediately followed by '(' (then it's a name/function)
      if (src[i + m[0].length] !== '(') { toks.push({ t: 'ref', v: m[0] }); i += m[0].length; continue; }
    }
    if ((m = re.name.exec(s))) {
      const up = m[0].toUpperCase();
      if (up === 'TRUE' || up === 'FALSE') toks.push({ t: 'bool', v: up === 'TRUE' });
      else toks.push({ t: 'name', v: m[0] });
      i += m[0].length; continue;
    }
    if ((m = re.op1.exec(s))) { toks.push({ t: 'op', v: m[0] }); i += 1; continue; }
    throw new FormulaError('#ERROR!');
  }
  return toks;
}

// ---- parser (recursive descent) -> AST ----
function parse(toks) {
  let p = 0;
  const peek = () => toks[p];
  const eat = (v) => { const t = toks[p++]; if (v && (!t || t.v !== v)) throw new FormulaError('#ERROR!'); return t; };

  function expr() { return comparison(); }
  function comparison() {
    let n = concat();
    while (peek() && peek().t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(peek().v)) {
      const op = eat().v; n = { k: 'bin', op, a: n, b: concat() };
    }
    return n;
  }
  function concat() {
    let n = additive();
    while (peek() && peek().v === '&') { eat(); n = { k: 'bin', op: '&', a: n, b: additive() }; }
    return n;
  }
  function additive() {
    let n = mul();
    while (peek() && (peek().v === '+' || peek().v === '-')) { const op = eat().v; n = { k: 'bin', op, a: n, b: mul() }; }
    return n;
  }
  function mul() {
    let n = power();
    while (peek() && (peek().v === '*' || peek().v === '/')) { const op = eat().v; n = { k: 'bin', op, a: n, b: power() }; }
    return n;
  }
  function power() {
    let n = unary();
    if (peek() && peek().v === '^') { eat(); n = { k: 'bin', op: '^', a: n, b: power() }; }
    return n;
  }
  function unary() {
    if (peek() && (peek().v === '-' || peek().v === '+')) { const op = eat().v; return { k: 'unary', op, a: unary() }; }
    return postfix();
  }
  function postfix() {
    let n = primary();
    while (peek() && peek().v === '%') { eat(); n = { k: 'percent', a: n }; }
    return n;
  }
  function primary() {
    const t = peek();
    if (!t) throw new FormulaError('#ERROR!');
    if (t.t === 'num') { eat(); return { k: 'num', v: t.v }; }
    if (t.t === 'str') { eat(); return { k: 'str', v: t.v }; }
    if (t.t === 'bool') { eat(); return { k: 'bool', v: t.v }; }
    if (t.t === 'ref') {
      eat();
      if (peek() && peek().v === ':') { eat(); const b = eat(); if (b.t !== 'ref') throw new FormulaError('#REF!'); return { k: 'range', a: t.v, b: b.v }; }
      return { k: 'ref', v: t.v };
    }
    if (t.v === '(') { eat(); const n = expr(); eat(')'); return n; }
    if (t.t === 'name') {
      eat();
      if (peek() && peek().v === '(') {
        eat('('); const args = [];
        if (peek() && peek().v !== ')') { args.push(expr()); while (peek() && peek().v === ',') { eat(); args.push(expr()); } }
        eat(')');
        return { k: 'call', name: t.v.toUpperCase(), args };
      }
      throw new FormulaError('#NAME?');
    }
    throw new FormulaError('#ERROR!');
  }

  const ast = expr();
  if (p !== toks.length) throw new FormulaError('#ERROR!');
  return ast;
}

// ---- evaluation ----
function toNum(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  if (Number.isNaN(n)) throw new FormulaError('#VALUE!');
  return n;
}
function toStr(v) { return v == null ? '' : (typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v)); }
function flat(args) { const out = []; for (const a of args) Array.isArray(a) ? out.push(...a) : out.push(a); return out; }
function nums(args) { return flat(args).filter((v) => v !== null && v !== '' && v !== undefined).map(toNum); }

// ---- geo helpers (used by the GEO extension functions below) ----
// Resolve a place by name or QID via ctx.geo — a synchronous lookup into a
// gazetteer the host preloaded (cf. how SQL() reads the in-memory db). No network
// in the formula path: the spreadsheet works over the cached place extract.
function geoPlace(ctx, key) {
  if (!ctx || typeof ctx.geo !== 'function') throw new FormulaError('#NAME?');
  const p = ctx.geo(toStr(key));
  if (!p) throw new FormulaError('#N/A');
  return p;
}
function geoNum(v) { if (v == null) throw new FormulaError('#N/A'); return v; }
function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

const FUNCS = {
  SUM: (a) => nums(a).reduce((x, y) => x + y, 0),
  AVERAGE: (a) => { const n = nums(a); if (!n.length) throw new FormulaError('#DIV/0!'); return n.reduce((x, y) => x + y, 0) / n.length; },
  COUNT: (a) => nums(a).length,
  COUNTA: (a) => flat(a).filter((v) => v !== null && v !== '' && v !== undefined).length,
  MIN: (a) => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
  MAX: (a) => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
  PRODUCT: (a) => nums(a).reduce((x, y) => x * y, 1),
  ROUND: (a) => { const f = 10 ** (a[1] == null ? 0 : toNum(a[1])); return Math.round(toNum(a[0]) * f) / f; },
  ABS: (a) => Math.abs(toNum(a[0])),
  INT: (a) => Math.floor(toNum(a[0])),
  MOD: (a) => { const d = toNum(a[1]); if (d === 0) throw new FormulaError('#DIV/0!'); return toNum(a[0]) - d * Math.floor(toNum(a[0]) / d); },
  POWER: (a) => toNum(a[0]) ** toNum(a[1]),
  SQRT: (a) => { const x = toNum(a[0]); if (x < 0) throw new FormulaError('#NUM!'); return Math.sqrt(x); },
  PI: () => Math.PI,
  IF: (a) => (truthy(a[0]) ? a[1] : (a.length > 2 ? a[2] : false)),
  AND: (a) => flat(a).every(truthy),
  OR: (a) => flat(a).some(truthy),
  NOT: (a) => !truthy(a[0]),
  IFERROR: (a) => a[0],   // error handled before call; see eval of call
  CONCAT: (a) => flat(a).map(toStr).join(''),
  CONCATENATE: (a) => flat(a).map(toStr).join(''),
  LEN: (a) => toStr(a[0]).length,
  LEFT: (a) => toStr(a[0]).slice(0, a[1] == null ? 1 : toNum(a[1])),
  RIGHT: (a) => { const n = a[1] == null ? 1 : toNum(a[1]); return n ? toStr(a[0]).slice(-n) : ''; },
  MID: (a) => toStr(a[0]).substr(toNum(a[1]) - 1, toNum(a[2])),
  UPPER: (a) => toStr(a[0]).toUpperCase(),
  LOWER: (a) => toStr(a[0]).toLowerCase(),
  TRIM: (a) => toStr(a[0]).trim(),
  ROUNDUP: (a) => { const f = 10 ** (a[1] == null ? 0 : toNum(a[1])); return Math.ceil(toNum(a[0]) * f) / f; },
  ROUNDDOWN: (a) => { const f = 10 ** (a[1] == null ? 0 : toNum(a[1])); return Math.trunc(toNum(a[0]) * f) / f; },
  TODAY: () => new Date().toISOString().slice(0, 10),
  NOW: () => new Date().toISOString().slice(0, 19).replace('T', ' '),

  // ---- GEO extension functions ----
  // Take a place name (or a Wikidata QID) and read the cached gazetteer via
  // ctx.geo. QID gives the stable Wikidata id; LAT/LON/GEOCODE the coordinates;
  // GEODISTANCE the great-circle km between two places; PLACEKIND/PLACEDESC the
  // metadata. Unknown place -> #N/A; geo not loaded -> #NAME? (wrap in IFERROR).
  QID: (a, ctx) => geoNum(geoPlace(ctx, a[0]).wikidataId),
  WIKIDATA: (a, ctx) => geoNum(geoPlace(ctx, a[0]).wikidataId),
  LAT: (a, ctx) => geoNum(geoPlace(ctx, a[0]).lat),
  LATITUDE: (a, ctx) => geoNum(geoPlace(ctx, a[0]).lat),
  LON: (a, ctx) => geoNum(geoPlace(ctx, a[0]).lon),
  LONGITUDE: (a, ctx) => geoNum(geoPlace(ctx, a[0]).lon),
  GEOCODE: (a, ctx) => { const p = geoPlace(ctx, a[0]); return `${geoNum(p.lat)}, ${geoNum(p.lon)}`; },
  PLACEKIND: (a, ctx) => geoPlace(ctx, a[0]).kind || '',
  PLACEDESC: (a, ctx) => geoPlace(ctx, a[0]).description || '',
  GEODISTANCE: (a, ctx) => {
    const p = geoPlace(ctx, a[0]), q = geoPlace(ctx, a[1]);
    const km = haversineKm(geoNum(p.lat), geoNum(p.lon), geoNum(q.lat), geoNum(q.lon));
    return Math.round(km * 10) / 10;
  },
};

function truthy(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v == null || v === '') return false;
  if (typeof v === 'string') return v.toUpperCase() !== 'FALSE' && v !== '0';
  return !!v;
}

function evalNode(n, ctx) {
  switch (n.k) {
    case 'num': return n.v;
    case 'str': return n.v;
    case 'bool': return n.v;
    case 'ref': { const r = parseRef(n.v); return ctx.cell(r.col, r.row); }
    case 'range': { const a = parseRef(n.a), b = parseRef(n.b); return ctx.range(Math.min(a.col, b.col), Math.min(a.row, b.row), Math.max(a.col, b.col), Math.max(a.row, b.row)); }
    case 'unary': { const v = toNum(evalNode(n.a, ctx)); return n.op === '-' ? -v : v; }
    case 'percent': return toNum(evalNode(n.a, ctx)) / 100;
    case 'bin': return evalBin(n, ctx);
    case 'call': return evalCall(n, ctx);
    default: throw new FormulaError('#ERROR!');
  }
}

function evalBin(n, ctx) {
  const op = n.op;
  if (op === '&') return toStr(evalNode(n.a, ctx)) + toStr(evalNode(n.b, ctx));
  const a = evalNode(n.a, ctx), b = evalNode(n.b, ctx);
  if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
    let x = a, y = b;
    if (typeof x === 'number' || typeof y === 'number') { x = toNum(a); y = toNum(b); }
    else { x = toStr(a); y = toStr(b); }
    switch (op) { case '=': return x === y; case '<>': return x !== y; case '<': return x < y; case '>': return x > y; case '<=': return x <= y; case '>=': return x >= y; }
  }
  const x = toNum(a), y = toNum(b);
  switch (op) {
    case '+': return x + y; case '-': return x - y; case '*': return x * y;
    case '/': if (y === 0) throw new FormulaError('#DIV/0!'); return x / y;
    case '^': return x ** y;
  }
  throw new FormulaError('#ERROR!');
}

function evalCall(n, ctx) {
  const name = n.name;
  // SQL("…") integration — run a query against the relational layer.
  if (name === 'SQL') {
    if (!ctx.sql) throw new FormulaError('#NAME?');
    const q = toStr(evalNode(n.args[0], ctx));
    try { return ctx.sql(q); } catch (_) { throw new FormulaError('#SQL!'); }
  }
  if (name === 'IFERROR') {
    try { return evalNode(n.args[0], ctx); } catch (e) { if (e.isFormulaError) return n.args[1] ? evalNode(n.args[1], ctx) : ''; throw e; }
  }
  const fn = FUNCS[name];
  if (!fn) throw new FormulaError('#NAME?');
  const args = n.args.map((a) => evalNode(a, ctx));
  return fn(args, ctx);
}

// Public: evaluate a formula string ("=…" or bare). Returns value or throws
// FormulaError (use .code for the #ERR token).
export function evaluate(formula, ctx) {
  let src = String(formula);
  if (src[0] === '=') src = src.slice(1);
  const ast = parse(tokenize(src));
  return evalNode(ast, ctx);
}

// Collect the cells/ranges a formula depends on (for recompute ordering).
export function dependencies(formula) {
  let src = String(formula); if (src[0] === '=') src = src.slice(1);
  const deps = [];
  const ast = parse(tokenize(src));
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (n.k === 'ref') { const r = parseRef(n.v); deps.push({ col: r.col, row: r.row }); }
    else if (n.k === 'range') { const a = parseRef(n.a), b = parseRef(n.b); for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) deps.push({ col: c, row: r }); }
    for (const k of ['a', 'b']) if (n[k]) walk(n[k]);
    if (n.args) n.args.forEach(walk);
  })(ast);
  return deps;
}
