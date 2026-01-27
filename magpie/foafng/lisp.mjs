// μLisp - Minimal efficient Lisp in ~200 lines
// Supports: lambda, define, let, if, quote, quasiquote, macros, TCO

const Sym = s => ({ type: 'sym', name: s });
const isSym = x => x?.type === 'sym';
const Cons = (car, cdr) => ({ type: 'cons', car, cdr });
const isCons = x => x?.type === 'cons';
const NIL = { type: 'nil' };
const isNil = x => x === NIL || x?.type === 'nil';

// Convert JS array to Lisp list
const list = (...xs) => xs.reduceRight((acc, x) => Cons(x, acc), NIL);
const toArray = lst => {
  const arr = [];
  while (isCons(lst)) { arr.push(lst.car); lst = lst.cdr; }
  return arr;
};

// Tokenizer
const tokenize = src => {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === ';') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if ('()\'`,.@'.includes(c)) { tokens.push(c); i++; continue; }
    let j = i;
    while (j < src.length && !/[\s()';`,]/.test(src[j])) j++;
    tokens.push(src.slice(i, j));
    i = j;
  }
  return tokens;
};

// Parser
const parse = tokens => {
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const read = () => {
    const tok = consume();
    if (tok === '(') return readList();
    if (tok === "'") return list(Sym('quote'), read());
    if (tok === '`') return list(Sym('quasiquote'), read());
    if (tok === ',') {
      if (peek() === '@') { consume(); return list(Sym('unquote-splicing'), read()); }
      return list(Sym('unquote'), read());
    }
    if (tok === '#t') return true;
    if (tok === '#f') return false;
    if (/^-?\d+(\.\d+)?$/.test(tok)) return parseFloat(tok);
    if (tok.startsWith('"')) return tok.slice(1, -1);
    return Sym(tok);
  };

  const readList = () => {
    const items = [];
    while (peek() && peek() !== ')') {
      if (peek() === '.') { consume(); const cdr = read(); consume(); return items.reduceRight((a, x) => Cons(x, a), cdr); }
      items.push(read());
    }
    consume(); // )
    return list(...items);
  };

  return read();
};

// Environment
const Env = (bindings = {}, parent = null) => ({
  bindings,
  parent,
  get(name) {
    if (name in this.bindings) return this.bindings[name];
    if (this.parent) return this.parent.get(name);
    throw new Error(`Undefined: ${name}`);
  },
  set(name, val) { this.bindings[name] = val; },
  define(name, val) { this.bindings[name] = val; }
});

// Evaluation with TCO
const evaluate = (expr, env) => {
  while (true) {
    if (isSym(expr)) return env.get(expr.name);
    if (!isCons(expr)) return expr; // number, string, bool, nil

    const [op, ...args] = toArray(expr);
    if (!isSym(op)) {
      // Application of non-symbol (lambda call)
      const fn = evaluate(op, env);
      const vals = args.map(a => evaluate(a, env));
      if (typeof fn === 'function') return fn(...vals);
      if (fn.type === 'closure') {
        env = Env(Object.fromEntries(fn.params.map((p, i) => [p.name, vals[i]])), fn.env);
        expr = fn.body;
        continue; // TCO
      }
      throw new Error('Not callable');
    }

    const name = op.name;

    // Special forms
    if (name === 'quote') return args[0];

    if (name === 'quasiquote') {
      const expand = (x, depth = 1) => {
        if (!isCons(x)) return x;
        const [h, ...t] = toArray(x);
        if (isSym(h) && h.name === 'unquote' && depth === 1) return evaluate(t[0], env);
        if (isSym(h) && h.name === 'quasiquote') return list(h, expand(t[0], depth + 1));
        if (isSym(h) && h.name === 'unquote') return list(h, expand(t[0], depth - 1));
        // Handle unquote-splicing
        const expanded = [];
        let cur = x;
        while (isCons(cur)) {
          const item = cur.car;
          if (isCons(item) && isSym(item.car) && item.car.name === 'unquote-splicing' && depth === 1) {
            expanded.push(...toArray(evaluate(toArray(item)[1], env)));
          } else {
            expanded.push(expand(item, depth));
          }
          cur = cur.cdr;
        }
        return list(...expanded);
      };
      return expand(args[0]);
    }

    if (name === 'if') {
      const cond = evaluate(args[0], env);
      expr = (cond !== false && !isNil(cond)) ? args[1] : (args[2] ?? NIL);
      continue; // TCO
    }

    if (name === 'lambda' || name === 'λ') {
      const params = toArray(args[0]);
      const body = args.length > 2 ? Cons(Sym('begin'), list(...args.slice(1))) : args[1];
      return { type: 'closure', params, body, env };
    }

    if (name === 'define') {
      if (isCons(args[0])) {
        // (define (f x) body) => (define f (lambda (x) body))
        const [fname, ...params] = toArray(args[0]);
        const body = args.length > 2 ? Cons(Sym('begin'), list(...args.slice(1))) : args[1];
        env.define(fname.name, { type: 'closure', params, body, env });
      } else {
        env.define(args[0].name, evaluate(args[1], env));
      }
      return NIL;
    }

    if (name === 'set!') {
      let e = env;
      while (e) {
        if (args[0].name in e.bindings) { e.bindings[args[0].name] = evaluate(args[1], env); return NIL; }
        e = e.parent;
      }
      throw new Error(`Undefined: ${args[0].name}`);
    }

    if (name === 'let') {
      const bindings = toArray(args[0]).map(b => [toArray(b)[0].name, evaluate(toArray(b)[1], env)]);
      env = Env(Object.fromEntries(bindings), env);
      expr = args.length > 2 ? Cons(Sym('begin'), list(...args.slice(1))) : args[1];
      continue; // TCO
    }

    if (name === 'let*') {
      for (const b of toArray(args[0])) {
        const [k, v] = toArray(b);
        env = Env({ [k.name]: evaluate(v, env) }, env);
      }
      expr = args[1];
      continue;
    }

    if (name === 'letrec') {
      const newEnv = Env({}, env);
      for (const b of toArray(args[0])) {
        const [k, v] = toArray(b);
        newEnv.define(k.name, evaluate(v, newEnv));
      }
      env = newEnv;
      expr = args[1];
      continue;
    }

    if (name === 'begin') {
      for (let i = 0; i < args.length - 1; i++) evaluate(args[i], env);
      expr = args[args.length - 1];
      continue; // TCO
    }

    if (name === 'and') {
      let result = true;
      for (const a of args) {
        result = evaluate(a, env);
        if (result === false || isNil(result)) return false;
      }
      return result;
    }

    if (name === 'or') {
      for (const a of args) {
        const result = evaluate(a, env);
        if (result !== false && !isNil(result)) return result;
      }
      return false;
    }

    if (name === 'cond') {
      for (const clause of args) {
        const [test, ...body] = toArray(clause);
        if ((isSym(test) && test.name === 'else') || (evaluate(test, env) !== false)) {
          expr = body.length > 1 ? Cons(Sym('begin'), list(...body)) : body[0];
          continue;
        }
      }
      return NIL;
    }

    if (name === 'defmacro') {
      const [mname, params] = [args[0].name, toArray(args[1])];
      const body = args[2];
      env.define(mname, { type: 'macro', params, body, env });
      return NIL;
    }

    // Function application
    const fn = env.get(name);

    // Macro expansion
    if (fn?.type === 'macro') {
      const expanded = evaluate(fn.body, Env(Object.fromEntries(fn.params.map((p, i) => [p.name, args[i]])), fn.env));
      expr = expanded;
      continue;
    }

    const vals = args.map(a => evaluate(a, env));

    if (typeof fn === 'function') return fn(...vals);
    if (fn?.type === 'closure') {
      env = Env(Object.fromEntries(fn.params.map((p, i) => [p.name, vals[i]])), fn.env);
      expr = fn.body;
      continue; // TCO
    }

    throw new Error(`Not callable: ${name}`);
  }
};

// Helper to call any function (JS or closure)
const apply = (fn, args, env) => {
  if (typeof fn === 'function') return fn(...args);
  if (fn?.type === 'closure') {
    const callEnv = Env(Object.fromEntries(fn.params.map((p, i) => [p.name, args[i]])), fn.env);
    return evaluate(fn.body, callEnv);
  }
  throw new Error('Not callable');
};

// Standard library
const stdlib = Env({
  '+': (...xs) => xs.reduce((a, b) => a + b, 0),
  '-': (a, b) => b === undefined ? -a : a - b,
  '*': (...xs) => xs.reduce((a, b) => a * b, 1),
  '/': (a, b) => a / b,
  '%': (a, b) => a % b,
  '<': (a, b) => a < b,
  '>': (a, b) => a > b,
  '<=': (a, b) => a <= b,
  '>=': (a, b) => a >= b,
  '=': (a, b) => a === b,
  'eq?': (a, b) => a === b,
  'equal?': (a, b) => JSON.stringify(a) === JSON.stringify(b),
  'not': x => x === false || isNil(x),

  'cons': Cons,
  'car': x => x.car,
  'cdr': x => x.cdr,
  'list': list,
  'null?': isNil,
  'pair?': isCons,
  'symbol?': isSym,
  'number?': x => typeof x === 'number',
  'string?': x => typeof x === 'string',
  'length': x => typeof x === 'string' ? x.length : toArray(x).length,
  'append': (...lists) => list(...lists.flatMap(toArray)),
  'reverse': x => list(...toArray(x).reverse()),
  'map': (f, lst) => list(...toArray(lst).map(x => apply(f, [x]))),
  'filter': (f, lst) => list(...toArray(lst).filter(x => { const r = apply(f, [x]); return r !== false && !isNil(r); })),
  'reduce': (f, init, lst) => toArray(lst).reduce((a, x) => apply(f, [a, x]), init),
  'nth': (n, lst) => toArray(lst)[n],

  'print': (...xs) => { console.log(...xs.map(stringify)); return NIL; },
  'error': msg => { throw new Error(msg); },
  'apply': (f, args) => apply(f, toArray(args)),

  'nil': NIL,
  '#t': true,
  '#f': false,
});

// Pretty printer
const stringify = x => {
  if (isNil(x)) return 'nil';
  if (isSym(x)) return x.name;
  if (isCons(x)) {
    const items = [];
    while (isCons(x)) { items.push(stringify(x.car)); x = x.cdr; }
    if (!isNil(x)) items.push('.', stringify(x));
    return `(${items.join(' ')})`;
  }
  if (x?.type === 'closure') return `#<lambda>`;
  if (x?.type === 'macro') return `#<macro>`;
  if (typeof x === 'string') return `"${x}"`;
  return String(x);
};

// REPL
const run = (src, env = Env({}, stdlib)) => {
  const tokens = tokenize(`(begin ${src})`);
  const ast = parse(tokens);
  return evaluate(ast, env);
};

// Export
export { run, parse, tokenize, evaluate, Env, stdlib, stringify, Sym, Cons, NIL, list, toArray, isCons, isNil, isSym };

// CLI
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('lisp.mjs') && process.argv[2]) {
  const fs = await import('fs');
  const src = process.argv[2] === '-e' ? process.argv[3] : fs.readFileSync(process.argv[2], 'utf8');
  console.log(stringify(run(src)));
}
