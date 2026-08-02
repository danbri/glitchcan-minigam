/**
 * S-expression surface syntax for Lucid's scene/expression IR.
 *
 * Lucid's IR is already an S-expression in a JSON costume:
 *   { expr: 'mul', args: [{ var: 'rotationSpeed' }, { var: 'time' }] }   ==  (* rotationSpeed time)
 *   { type: 'union', children: [a, b] }                                   ==  (union a b)
 *
 * This module is a *surface syntax* over that IR — not a replacement format.
 * read()/print() convert text <-> IR; codegen, the rig evaluator, and the
 * clipclop bridge all keep consuming the same IR unchanged. So adopting
 * S-expressions is additive and reversible: no engine touches this file.
 *
 * A real reader (tokenizer + recursive descent) — NOT regex parsing.
 *
 * Scope of this first pass: the EXPRESSION sublanguage (the shared substrate
 * under codegen + rig + future compute templates) plus the scene node tree
 * (primitives, CSG, transforms, material). The scene tree is deliberately a
 * common-subset bridge; expressions are complete.
 */

// ============================================================
// Reader:  text -> nested forms (arrays of atoms/lists)
// ============================================================
// Atoms: numbers -> JS number, :keyword -> {kw:'name'}, "string" -> {str:'..'},
// bare symbol -> {sym:'name'}. Lists: (...) -> array, [...] -> {vec:[...]}.

export function read(text) {
  const toks = tokenize(text);
  const forms = [];
  let i = 0;
  while (i < toks.length) {
    const [form, next] = readForm(toks, i);
    forms.push(form);
    i = next;
  }
  return forms;
}

// Read exactly one top-level form (convenience for single expressions).
export function readOne(text) {
  const forms = read(text);
  if (forms.length !== 1) throw new Error(`readOne: expected 1 form, got ${forms.length}`);
  return forms[0];
}

function tokenize(text) {
  const toks = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === ';') { // line comment
      while (i < n && text[i] !== '\n') i++;
      continue;
    }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(' || c === ')' || c === '[' || c === ']') {
      toks.push({ t: c }); i++; continue;
    }
    if (c === '"') {
      let j = i + 1, s = '';
      while (j < n && text[j] !== '"') {
        if (text[j] === '\\' && j + 1 < n) { s += text[j + 1]; j += 2; }
        else { s += text[j]; j++; }
      }
      if (j >= n) throw new Error('unterminated string');
      toks.push({ t: 'str', v: s }); i = j + 1; continue;
    }
    // atom: read up to whitespace or bracket
    let j = i;
    while (j < n && !/\s/.test(text[j]) && !'()[]";'.includes(text[j])) j++;
    toks.push({ t: 'atom', v: text.slice(i, j) });
    i = j;
  }
  return toks;
}

function readForm(toks, i) {
  const tok = toks[i];
  if (!tok) throw new Error('unexpected end of input');
  if (tok.t === '(' || tok.t === '[') {
    const close = tok.t === '(' ? ')' : ']';
    const items = [];
    let j = i + 1;
    while (j < toks.length && toks[j].t !== close) {
      if (toks[j].t === ')' || toks[j].t === ']') throw new Error(`mismatched ${toks[j].t}`);
      const [item, next] = readForm(toks, j);
      items.push(item);
      j = next;
    }
    if (j >= toks.length) throw new Error(`unterminated ${tok.t}`);
    return [tok.t === '(' ? items : { vec: items }, j + 1];
  }
  if (tok.t === ')' || tok.t === ']') throw new Error(`unexpected ${tok.t}`);
  if (tok.t === 'str') return [{ str: tok.v }, i + 1];
  // atom
  return [atom(tok.v), i + 1];
}

function atom(s) {
  if (s.startsWith(':')) return { kw: s.slice(1) };
  // number? (int, float, leading -, exponent)
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return Number(s);
  return { sym: s };
}

// ============================================================
// Expression sublanguage:  forms <-> expr IR
// ============================================================

// Symbol -> canonical IR op name. Infix aliases first, then pass-through funcs.
const OP_FROM_SYM = {
  '+': 'add', '*': 'mul', '/': 'div', '%': 'mod',
  // '-' handled specially (sub vs neg by arity)
};
const FUNC_OPS = new Set([
  'add', 'sub', 'mul', 'div', 'mod', 'neg',
  'abs', 'floor', 'ceil', 'fract', 'round',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'pow', 'sqrt', 'exp', 'log',
  'min', 'max', 'clamp', 'step', 'smoothstep', 'mix', 'lerp',
  'noise', 'fbm', 'turbulence', 'hash',
  'vec2', 'vec3', 'vec4', 'length', 'normalize', 'dot', 'cross'
]);
// Print side: IR op -> preferred symbol.
const SYM_FROM_OP = { add: '+', mul: '*', div: '/', mod: '%', sub: '-' };

/**
 * Convert a read() form into expression IR that codegen/rig accept.
 */
export function formToExpr(form) {
  if (typeof form === 'number') return form;
  if (form && form.str !== undefined) return form.str;
  if (form && form.sym !== undefined) return { var: form.sym };
  if (form && form.vec !== undefined) {
    // literal vector: all-number -> raw array; else {type:'array',values:[...]}
    const vals = form.vec.map(formToExpr);
    if (vals.every(v => typeof v === 'number')) return vals;
    return { type: 'array', values: vals.map(wrapConst) };
  }
  if (Array.isArray(form)) {
    if (form.length === 0) throw new Error('empty list is not an expression');
    const head = form[0];
    if (!head || head.sym === undefined) throw new Error('expression head must be a symbol');
    const sym = head.sym;
    const args = form.slice(1).map(formToExpr);
    // '-' : one arg = neg, else = sub
    if (sym === '-') {
      return args.length === 1 ? { expr: 'neg', args } : { expr: 'sub', args };
    }
    const op = OP_FROM_SYM[sym] || (FUNC_OPS.has(sym) ? sym : null);
    if (!op) throw new Error(`unknown expression operator: ${sym}`);
    return { expr: op, args };
  }
  throw new Error(`cannot convert form to expression: ${JSON.stringify(form)}`);
}

function wrapConst(v) {
  return typeof v === 'number' ? { type: 'const', value: v } : v;
}

/**
 * Convert expression IR to an S-expression string.
 */
export function exprToSexpr(node) {
  if (typeof node === 'number') return numStr(node);
  if (typeof node === 'string') return JSON.stringify(node);
  if (Array.isArray(node)) return `[${node.map(exprToSexpr).join(' ')}]`;
  if (node == null) return '0';
  if (node.var !== undefined) return node.var;
  if (node.type === 'const' || (node.value !== undefined && node.expr === undefined && node.type === undefined)) {
    return numStr(node.value);
  }
  if (node.type === 'array' && node.values) {
    return `[${node.values.map(exprToSexpr).join(' ')}]`;
  }
  const op = node.expr || node.op;
  if (op) {
    const args = (node.args || []).map(exprToSexpr);
    if (op === 'neg') return `(neg ${args[0]})`;
    const sym = SYM_FROM_OP[op] || op;
    return `(${sym} ${args.join(' ')})`;
  }
  throw new Error(`cannot convert expr IR to s-expr: ${JSON.stringify(node)}`);
}

function numStr(v) {
  if (typeof v !== 'number') return '0';
  return Number.isInteger(v) ? String(v) : String(v);
}

// ============================================================
// Scene node sublanguage (common subset):  forms <-> scene IR
// ============================================================

const PRIMITIVES = new Set(['sphere', 'box', 'torus', 'cylinder', 'capsule', 'ellipsoid', 'cone', 'roundCone', 'plane']);
const CSG = new Set(['union', 'subtract', 'intersect', 'smoothUnion', 'smoothIntersect', 'smoothSubtract', 'group']);

/**
 * Convert a scene-node form into scene-node IR (the shape json-loader consumes).
 * Supported heads:
 *   (sphere :r 0.5 :color [1 0 0])            primitive with keyword params
 *   (union A B ...)  (subtract A B ...)        CSG (smooth* take :k)
 *   (translate [x y z] BODY)                   transform wrappers
 *   (rotate [x y z] BODY)  (scale s BODY)
 *   (material [r g b] BODY)                    color override
 */
export function formToNode(form) {
  if (!Array.isArray(form) || !form[0] || form[0].sym === undefined) {
    throw new Error(`scene node must be a (head ...) list, got ${JSON.stringify(form)}`);
  }
  const head = form[0].sym;
  const rest = form.slice(1);

  if (head === 'translate' || head === 'rotate' || head === 'scale') {
    const value = formToExpr(rest[0]);
    const child = formToNode(rest[1]);
    const key = head === 'translate' ? 'translate' : head === 'rotate' ? 'rotate' : 'scale';
    return { type: 'transform', transform: { [key]: value }, child };
  }

  if (head === 'material') {
    const color = formToExpr(rest[0]);
    const child = formToNode(rest[1]);
    // color must live at params.color: the GLSL codegen reads only
    // node.params.color (WGSL reads either). Put it there for both.
    return { type: 'material', params: { color }, child };
  }

  if (CSG.has(head)) {
    const { kw, positional } = splitKw(rest);
    const node = { type: head, children: positional.map(formToNode) };
    if (kw.k !== undefined) node.k = kw.k;
    return node;
  }

  if (PRIMITIVES.has(head)) {
    const { kw } = splitKw(rest);
    return { type: head, params: kw };
  }

  throw new Error(`unknown scene node head: ${head}`);
}

// Split (:kw val :kw val positional...) into a params object + positional list.
function splitKw(items) {
  const kw = {};
  const positional = [];
  let i = 0;
  while (i < items.length) {
    const it = items[i];
    if (it && it.kw !== undefined) {
      kw[it.kw] = formToExpr(items[i + 1]);
      i += 2;
    } else {
      positional.push(it);
      i += 1;
    }
  }
  return { kw, positional };
}

/**
 * Convert scene-node IR to an S-expression string (common subset).
 */
export function nodeToSexpr(node, indent = 0) {
  const pad = '  '.repeat(indent);
  if (!node || !node.type) return `${pad}()`;

  // transform wrapper -> (translate/rotate/scale VALUE BODY)
  if (node.type === 'transform' && node.child && node.transform) {
    const t = node.transform;
    const key = t.translate ? 'translate' : t.rotate ? 'rotate' : t.scale ? 'scale' : null;
    if (key) {
      const val = exprToSexpr(t[key]);
      return `${pad}(${key} ${val}\n${nodeToSexpr(node.child, indent + 1)})`;
    }
  }
  if (node.type === 'material' && node.child) {
    const col = exprToSexpr(node.color || node.params?.color || [0.8, 0.8, 0.8]);
    return `${pad}(material ${col}\n${nodeToSexpr(node.child, indent + 1)})`;
  }
  if (CSG.has(node.type)) {
    const k = node.k !== undefined ? ` :k ${exprToSexpr(node.k)}` : '';
    const kids = (node.children || []).map(c => nodeToSexpr(c, indent + 1)).join('\n');
    return `${pad}(${node.type}${k}\n${kids})`;
  }
  if (PRIMITIVES.has(node.type)) {
    const params = node.params || {};
    const kvs = Object.entries(params).map(([k, v]) => `:${k} ${exprToSexpr(v)}`).join(' ');
    return `${pad}(${node.type}${kvs ? ' ' + kvs : ''})`;
  }
  // fallthrough for uncovered node types (ref, repeat, mirror, ...)
  return `${pad}(${node.type} #|uncovered|#)`;
}
