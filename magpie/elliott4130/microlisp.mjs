// MicroLisp - Bit-packed cells with reference counting
// Inspired by early Lisps: two pointers per word, 3 tag bits
//
// Cell layout (32-bit word):
//   [31:29] tag (3 bits) - type discriminator
//   [28:16] car (13 bits) - index into heap (8192 cells max)
//   [15:3]  cdr (13 bits) - index into heap
//   [2:0]   refcount (3 bits) - 0-7, saturates at 7 (immortal)
//
// Tags:
//   000 = CONS (car/cdr are cell indices)
//   001 = FIXNUM (car=high13, cdr=low13 → 26-bit signed int)
//   010 = SYMBOL (car=atom index, cdr=unused)
//   011 = NIL
//   100 = BUILTIN (car=opcode, cdr=unused)
//   101 = CLOSURE (car=env, cdr=lambda cell)
//   110 = FREE (on freelist)
//   111 = FORWARDING (for GC, unused with refcount)

const HEAP_SIZE = 8192;
const TAG_CONS = 0;
const TAG_FIXNUM = 1;
const TAG_SYMBOL = 2;
const TAG_NIL = 3;
const TAG_BUILTIN = 4;
const TAG_CLOSURE = 5;
const TAG_FREE = 6;

// Heap: array of 32-bit cells
const heap = new Uint32Array(HEAP_SIZE);
let freeList = 0;
let allocCount = 0;

// Symbol table (interned atoms)
const symbols = new Map();
const symbolNames = [];

// Pack/unpack cell
const packCell = (tag, car, cdr, rc) => ((tag & 7) << 29) | ((car & 0x1FFF) << 16) | ((cdr & 0x1FFF) << 3) | (rc & 7);
const getTag = cell => (cell >>> 29) & 7;
const getCar = cell => (cell >>> 16) & 0x1FFF;
const getCdr = cell => (cell >>> 3) & 0x1FFF;
const getRC = cell => cell & 7;

// Set car/cdr preserving other fields
const setCar = (idx, newCar) => {
  const cell = heap[idx];
  heap[idx] = (cell & 0xE000FFFF) | ((newCar & 0x1FFF) << 16);
};
const setCdr = (idx, newCdr) => {
  const cell = heap[idx];
  heap[idx] = (cell & 0xFFFF0007) | ((newCdr & 0x1FFF) << 3);
};

// Reference counting
const incRef = idx => {
  if (idx === 0) return; // NIL is immortal
  const cell = heap[idx];
  const rc = getRC(cell);
  if (rc < 7) heap[idx] = (cell & ~7) | (rc + 1);
};

const decRef = idx => {
  if (idx === 0) return;
  const cell = heap[idx];
  const rc = getRC(cell);
  if (rc === 7) return; // Saturated, immortal
  if (rc === 1) {
    // Free this cell
    const tag = getTag(cell);
    if (tag === TAG_CONS || tag === TAG_CLOSURE) {
      decRef(getCar(cell));
      decRef(getCdr(cell));
    }
    heap[idx] = packCell(TAG_FREE, freeList, 0, 0);
    freeList = idx;
    allocCount--;
  } else if (rc > 1) {
    heap[idx] = (cell & ~7) | (rc - 1);
  }
};

// Allocate a cell
const alloc = (tag, car, cdr) => {
  if (freeList === 0) throw new Error('Out of memory');
  const idx = freeList;
  freeList = getCar(heap[idx]);
  heap[idx] = packCell(tag, car, cdr, 1);
  allocCount++;
  if (tag === TAG_CONS || tag === TAG_CLOSURE) {
    incRef(car);
    incRef(cdr);
  }
  return idx;
};

// Initialize heap with free list
const initHeap = () => {
  heap[0] = packCell(TAG_NIL, 0, 0, 7); // NIL at index 0, immortal
  for (let i = 1; i < HEAP_SIZE; i++) {
    heap[i] = packCell(TAG_FREE, i + 1, 0, 0);
  }
  heap[HEAP_SIZE - 1] = packCell(TAG_FREE, 0, 0, 0); // End of free list
  freeList = 1;
  allocCount = 0;
  // Reset symbol table
  symbols.clear();
  symbolNames.length = 0;
  // Reset global environment (set after globalEnv is declared)
  if (typeof globalEnv !== 'undefined') globalEnv = [];
};

// NIL constant
const NIL = 0;

// Constructors
const cons = (car, cdr) => alloc(TAG_CONS, car, cdr);
const fixnum = n => {
  const bits = n & 0x3FFFFFF; // 26-bit
  return alloc(TAG_FIXNUM, (bits >>> 13) & 0x1FFF, bits & 0x1FFF);
};
const intern = name => {
  if (symbols.has(name)) return symbols.get(name);
  const id = symbolNames.length;
  symbolNames.push(name);
  const idx = alloc(TAG_SYMBOL, id, 0);
  heap[idx] = (heap[idx] & ~7) | 7; // Make immortal
  symbols.set(name, idx);
  return idx;
};
const builtin = opcode => alloc(TAG_BUILTIN, opcode, 0);
const closure = (env, lambda) => alloc(TAG_CLOSURE, env, lambda);

// Accessors
const car = idx => {
  const tag = getTag(heap[idx]);
  if (tag !== TAG_CONS) throw new Error('car of non-cons');
  return getCar(heap[idx]);
};
const cdr = idx => {
  const tag = getTag(heap[idx]);
  if (tag !== TAG_CONS) throw new Error('cdr of non-cons');
  return getCdr(heap[idx]);
};
const fixnumVal = idx => {
  const cell = heap[idx];
  const bits = (getCar(cell) << 13) | getCdr(cell);
  return bits >= 0x2000000 ? bits - 0x4000000 : bits; // Sign extend
};
const symbolName = idx => symbolNames[getCar(heap[idx])];

// Type predicates
const isNil = idx => idx === 0 || getTag(heap[idx]) === TAG_NIL;
const isCons = idx => getTag(heap[idx]) === TAG_CONS;
const isFixnum = idx => getTag(heap[idx]) === TAG_FIXNUM;
const isSymbol = idx => getTag(heap[idx]) === TAG_SYMBOL;
const isBuiltin = idx => getTag(heap[idx]) === TAG_BUILTIN;
const isClosure = idx => getTag(heap[idx]) === TAG_CLOSURE;

// List utilities
const list = (...items) => items.reduceRight((acc, x) => cons(x, acc), NIL);
const toArray = lst => {
  const arr = [];
  while (!isNil(lst)) {
    arr.push(car(lst));
    lst = cdr(lst);
  }
  return arr;
};
const length = lst => {
  let n = 0;
  while (!isNil(lst)) { n++; lst = cdr(lst); }
  return n;
};

// Parser
const tokenize = src => {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === ';') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if ('()\''.includes(c)) { tokens.push(c); i++; continue; }
    let j = i;
    while (j < src.length && !/[\s()';]/.test(src[j])) j++;
    tokens.push(src.slice(i, j));
    i = j;
  }
  return tokens;
};

const parse = tokens => {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  const read = () => {
    const tok = next();
    if (tok === '(') return readList();
    if (tok === "'") return list(intern('quote'), read());
    if (/^-?\d+$/.test(tok)) return fixnum(parseInt(tok, 10));
    return intern(tok);
  };

  const readList = () => {
    const items = [];
    while (peek() && peek() !== ')') items.push(read());
    next(); // )
    return list(...items);
  };

  return read();
};

// Global environment (mutable for recursion support)
let globalEnv = [];

const globalLookup = sym => {
  for (const [s, v] of globalEnv) {
    if (s === sym) return v;
  }
  return null;
};

const globalSet = (sym, val) => {
  for (let i = 0; i < globalEnv.length; i++) {
    if (globalEnv[i][0] === sym) { globalEnv[i][1] = val; return; }
  }
  globalEnv.push([sym, val]);
};

// Environment: alist of (symbol . value) pairs
const envLookup = (env, sym) => {
  while (!isNil(env)) {
    const binding = car(env);
    if (car(binding) === sym) return cdr(binding);
    env = cdr(env);
  }
  // Check global
  const global = globalLookup(sym);
  if (global !== null) return global;
  throw new Error(`Undefined: ${symbolName(sym)}`);
};

const envExtend = (env, sym, val) => cons(cons(sym, val), env);

// Builtins
const OP_ADD = 0, OP_SUB = 1, OP_MUL = 2, OP_DIV = 3;
const OP_LT = 4, OP_EQ = 5, OP_CONS = 6, OP_CAR = 7, OP_CDR = 8;
const OP_NILP = 9, OP_PRINT = 10;

const builtinNames = {
  '+': OP_ADD, '-': OP_SUB, '*': OP_MUL, '/': OP_DIV,
  '<': OP_LT, '=': OP_EQ, 'cons': OP_CONS, 'car': OP_CAR, 'cdr': OP_CDR,
  'null?': OP_NILP, 'print': OP_PRINT
};

const applyBuiltin = (op, args) => {
  const a = () => fixnumVal(car(args));
  const b = () => fixnumVal(car(cdr(args)));
  switch (op) {
    case OP_ADD: return fixnum(a() + b());
    case OP_SUB: return fixnum(a() - b());
    case OP_MUL: return fixnum(a() * b());
    case OP_DIV: return fixnum(Math.floor(a() / b()));
    case OP_LT: return a() < b() ? intern('t') : NIL;
    case OP_EQ: return car(args) === car(cdr(args)) ? intern('t') : NIL;
    case OP_CONS: return cons(car(args), car(cdr(args)));
    case OP_CAR: return car(car(args));
    case OP_CDR: return cdr(car(args));
    case OP_NILP: return isNil(car(args)) ? intern('t') : NIL;
    case OP_PRINT: console.log(stringify(car(args))); return NIL;
    default: throw new Error(`Unknown builtin: ${op}`);
  }
};

// Evaluator with TCO
const evaluate = (expr, env) => {
  while (true) {
    if (isNil(expr)) return NIL;
    if (isFixnum(expr)) return expr;
    if (isSymbol(expr)) {
      const name = symbolName(expr);
      if (name === 't') return expr;
      if (name === 'nil') return NIL;
      if (name in builtinNames) return builtin(builtinNames[name]);
      return envLookup(env, expr);
    }
    if (!isCons(expr)) return expr;

    const op = car(expr);
    const args = cdr(expr);

    if (isSymbol(op)) {
      const name = symbolName(op);

      if (name === 'quote') return car(args);

      if (name === 'if') {
        const cond = evaluate(car(args), env);
        expr = isNil(cond) ? car(cdr(cdr(args))) : car(cdr(args));
        continue; // TCO
      }

      if (name === 'lambda') {
        return closure(env, expr);
      }

      if (name === 'define') {
        const sym = car(args);
        const val = evaluate(car(cdr(args)), env);
        globalSet(sym, val); // Use global for recursion
        return NIL;
      }

      if (name === 'let') {
        let bindings = car(args);
        while (!isNil(bindings)) {
          const binding = car(bindings);
          const sym = car(binding);
          const val = evaluate(car(cdr(binding)), env);
          env = envExtend(env, sym, val);
          bindings = cdr(bindings);
        }
        expr = car(cdr(args));
        continue; // TCO
      }

      if (name === 'begin') {
        let rest = args;
        while (!isNil(cdr(rest))) {
          evaluate(car(rest), env);
          rest = cdr(rest);
        }
        expr = car(rest);
        continue; // TCO
      }
    }

    // Function application
    const fn = evaluate(op, env);
    let evaledArgs = NIL;
    let argList = args;
    const evaledArr = [];
    while (!isNil(argList)) {
      evaledArr.push(evaluate(car(argList), env));
      argList = cdr(argList);
    }
    evaledArgs = list(...evaledArr);

    if (isBuiltin(fn)) {
      return applyBuiltin(getCar(heap[fn]), evaledArgs);
    }

    if (isClosure(fn)) {
      const closureEnv = getCar(heap[fn]);
      const lambdaExpr = getCdr(heap[fn]);
      // lambdaExpr is (lambda (params...) body)
      const params = car(cdr(lambdaExpr));
      const body = car(cdr(cdr(lambdaExpr)));

      // Bind parameters
      let newEnv = closureEnv;
      let ps = params;
      let as = evaledArgs;
      while (!isNil(ps)) {
        newEnv = envExtend(newEnv, car(ps), car(as));
        ps = cdr(ps);
        as = cdr(as);
      }

      env = newEnv;
      expr = body;
      continue; // TCO
    }

    throw new Error('Not callable');
  }
};

// Pretty printer
const stringify = idx => {
  if (isNil(idx)) return 'nil';
  if (isFixnum(idx)) return String(fixnumVal(idx));
  if (isSymbol(idx)) return symbolName(idx);
  if (isBuiltin(idx)) return `#<builtin:${getCar(heap[idx])}>`;
  if (isClosure(idx)) return '#<closure>';
  if (isCons(idx)) {
    const items = [];
    while (isCons(idx)) {
      items.push(stringify(car(idx)));
      idx = cdr(idx);
    }
    if (!isNil(idx)) items.push('.', stringify(idx));
    return `(${items.join(' ')})`;
  }
  return `#<unknown:${getTag(heap[idx])}>`;
};

// Main run function
const run = src => {
  initHeap();
  globalEnv = []; // Reset global environment
  const tokens = tokenize(`(begin ${src})`);
  const ast = parse(tokens);
  return evaluate(ast, NIL);
};

// Stats
const stats = () => ({
  heapSize: HEAP_SIZE,
  allocated: allocCount,
  free: HEAP_SIZE - allocCount - 1,
  symbols: symbolNames.length,
  cellSize: '32 bits (tag:3 car:13 cdr:13 rc:3)'
});

export { run, stringify, stats, initHeap, cons, car, cdr, list, fixnum, intern, NIL };

// Self-test
if (process.argv[1]?.endsWith('microlisp.mjs')) {
  console.log('=== MicroLisp (bit-packed cells, refcount GC) ===\n');

  const tests = [
    ['(+ 2 3)', '5'],
    ['(* 4 5)', '20'],
    ['(- 10 3)', '7'],
    ['(< 1 2)', 't'],
    ['(< 2 1)', 'nil'],
    ['(if (< 1 2) 10 20)', '10'],
    ['(if (< 2 1) 10 20)', '20'],
    ['(car (cons 1 2))', '1'],
    ['(cdr (cons 1 2))', '2'],
    ['((lambda (x) (* x x)) 5)', '25'],
    ['(let ((x 3) (y 4)) (+ x y))', '7'],
    ['(begin (define fact (lambda (n) (if (< n 2) 1 (* n (fact (- n 1)))))) (fact 5))', '120'],
    ['(begin (define fib (lambda (n) (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2)))))) (fib 10))', '55'],
  ];

  let passed = 0;
  for (const [src, expected] of tests) {
    const result = stringify(run(src));
    if (result === expected) {
      console.log(`  ✓ ${src} → ${result}`);
      passed++;
    } else {
      console.log(`  ✗ ${src} → ${result} (expected ${expected})`);
    }
  }

  console.log(`\n=== Stats ===`);
  const s = stats();
  console.log(`  Cell size: ${s.cellSize}`);
  console.log(`  Heap: ${s.allocated} allocated, ${s.free} free`);
  console.log(`  Symbols: ${s.symbols} interned`);
  console.log(`\n${passed}/${tests.length} tests passed`);
}
