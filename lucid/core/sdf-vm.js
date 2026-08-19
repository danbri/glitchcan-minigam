/**
 * SDF template VM — parameterised models as DATA interpreted on the GPU,
 * instead of rigid code generation.
 *
 * A template (e.g. the quadruped) is written ONCE in JS against the symbolic
 * ops API below. Evaluating it with S in symbolic mode records an expression
 * DAG over a small named parameter vector; the compiler linearises that DAG
 * into straight-line register bytecode — no jumps, no loops, fixed length.
 * A tiny WGSL compute pass then interprets one edit's program per thread and
 * writes the edit-list storage buffer the fold already reads.
 *
 * Why this parallelises properly:
 *  - Straight-line SSA bytecode: every thread runs the same fixed-bound
 *    interpreter loop — uniform control flow, the shape GPUs schedule best.
 *  - Model conditionals are PREDICATION (a SEL instruction → WGSL select),
 *    never divergent branches: "if dog then ears upright" is a data-parallel
 *    mix, so a warp never splits on model logic.
 *  - One thread per edit; each edit's program is the slice of the DAG its 23
 *    outputs need (shared subexpressions inside an edit are computed once).
 *
 * The payoff: changing a parameter ("the bear ate — belly bigger") is a
 * 4-byte buffer write + one small dispatch + a re-bake mark. No shader
 * recompile, no CPU re-flatten, no geometry rebuild.
 *
 * Everything is twin-tested: interpretEdits() runs the IDENTICAL bytecode in
 * JS, so the compiler and both interpreters are locked together by tests.
 */

// ---- opcodes (must match the WGSL switch in generateVmWgsl) ---------------
export const OPS = {
  CONST: 0, PARAM: 1, ADD: 2, SUB: 3, MUL: 4, DIV: 5,
  MIN: 6, MAX: 7, NEG: 8, ABS: 9, SQRT: 10, SEL: 11, OUT: 12
};
export const EDIT_STRIDE = 23;   // must match sdf-editlist.js
export const VM_MAX_REGS = 512;  // per-thread register file (f32)

// ---- symbolic builder ------------------------------------------------------
// S.param(name) / S.k(value) make leaves; node methods build the DAG with CSE
// (structurally identical nodes are shared). Numbers auto-lift to constants.

export function makeSym() {
  const nodes = [];              // all nodes, in creation order
  const memo = new Map();        // CSE: key -> node
  const paramNames = [];         // ordered parameter vector

  function intern(op, a, b, c, value) {
    const key = op + ':' + (a ? a.id : '') + ':' + (b ? b.id : '') + ':' + (c ? c.id : '') + ':' + (value !== undefined ? value : '');
    let n = memo.get(key);
    if (n) return n;
    n = { id: nodes.length, op, a, b, c, value };
    nodes.push(n);
    memo.set(key, n);
    return wrap(n);
  }
  function lift(x) { return (typeof x === 'number') ? S.k(x) : x; }

  // Node methods return new wrapped nodes; wrap() attaches them.
  function wrap(n) {
    if (n.add) return n; // already wrapped
    n.add = (o) => intern('add', n, lift(o));
    n.sub = (o) => intern('sub', n, lift(o));
    n.mul = (o) => intern('mul', n, lift(o));
    n.div = (o) => intern('div', n, lift(o));
    n.min = (o) => intern('min', n, lift(o));
    n.max = (o) => intern('max', n, lift(o));
    n.neg = () => intern('neg', n);
    n.abs = () => intern('abs', n);
    n.sqrt = () => intern('sqrt', n);
    return n;
  }

  const S = {
    k(v) { return intern('const', null, null, null, v); },
    param(name) {
      let i = paramNames.indexOf(name);
      if (i < 0) { paramNames.push(name); i = paramNames.length - 1; }
      return intern('param', null, null, null, i);
    },
    // SEL(cond, then, else): cond > 0 picks `then`. The predication primitive —
    // model branching compiles to this, never to divergent control flow.
    sel(cond, a, b) { return intern('sel', lift(cond), lift(a), lift(b)); },
    // gt(a, b) -> 1/0 as a float, for feeding sel. (a>b) == max(sign(a-b),0);
    // built from primitives: step = sel would recurse — use (a-b) directly as
    // the condition value: callers pass s.gt(a,b) meaning "positive if a>b".
    gt(a, b) { return lift(a).sub(lift(b)); },
    lift,
    nodes, paramNames
  };
  return S;
}

// ---- vec3 helpers over symbolic (or plain-number) scalars ------------------
export const V = {
  add: (a, b) => [a[0].add ? a[0].add(b[0]) : a[0] + b[0], a[1].add ? a[1].add(b[1]) : a[1] + b[1], a[2].add ? a[2].add(b[2]) : a[2] + b[2]],
  sub: (a, b) => [a[0].sub ? a[0].sub(b[0]) : a[0] - b[0], a[1].sub ? a[1].sub(b[1]) : a[1] - b[1], a[2].sub ? a[2].sub(b[2]) : a[2] - b[2]],
  scale: (a, s) => [a[0].mul ? a[0].mul(s) : a[0] * s, a[1].mul ? a[1].mul(s) : a[1] * s, a[2].mul ? a[2].mul(s) : a[2] * s],
  dot: (a, b) => {
    if (a[0].mul) return a[0].mul(b[0]).add(a[1].mul(b[1])).add(a[2].mul(b[2]));
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },
  len: (a) => { const d = V.dot(a, a); return d.sqrt ? d.sqrt() : Math.sqrt(d); }
};

// ---- compiler: per-edit programs from output DAGs --------------------------
// editsOutputs: Array of 23-element arrays of symbolic nodes (one per edit).
// Returns flat bytecode (Uint32Array, 4 u32 per instruction), a per-edit
// [offset,length] table, the constant pool, and the parameter name order.

export function compileTemplate(S, editsOutputs) {
  const consts = [];
  const constIdx = new Map();
  const cid = (v) => {
    if (!constIdx.has(v)) { constIdx.set(v, consts.length); consts.push(v); }
    return constIdx.get(v);
  };
  const OPCODE = { const: OPS.CONST, param: OPS.PARAM, add: OPS.ADD, sub: OPS.SUB, mul: OPS.MUL, div: OPS.DIV, min: OPS.MIN, max: OPS.MAX, neg: OPS.NEG, abs: OPS.ABS, sqrt: OPS.SQRT, sel: OPS.SEL };

  const code = [];
  const table = [];
  let maxRegs = 0;

  for (const outputs of editsOutputs) {
    if (outputs.length !== EDIT_STRIDE) throw new Error(`edit needs ${EDIT_STRIDE} outputs, got ${outputs.length}`);
    // topo-order the union of this edit's output subgraphs
    const order = [];
    const seen = new Set();
    const visit = (n) => {
      if (!n || seen.has(n.id)) return;
      seen.add(n.id);
      visit(n.a); visit(n.b); visit(n.c);
      order.push(n);
    };
    outputs.forEach(visit);

    const reg = new Map(); // node id -> register (== instruction index)
    const ofs = code.length / 4;
    for (const n of order) {
      const pc = code.length / 4 - ofs;
      reg.set(n.id, pc);
      switch (n.op) {
      case 'const': code.push(OPS.CONST, cid(n.value), 0, 0); break;
      case 'param': code.push(OPS.PARAM, n.value, 0, 0); break;
      case 'sel': code.push(OPS.SEL, reg.get(n.a.id), reg.get(n.b.id), reg.get(n.c.id)); break;
      case 'neg': case 'abs': case 'sqrt':
        code.push(OPCODE[n.op], reg.get(n.a.id), 0, 0); break;
      default:
        code.push(OPCODE[n.op], reg.get(n.a.id), reg.get(n.b.id), 0);
      }
    }
    // 23 OUT instructions: write reg -> slot
    for (let s = 0; s < EDIT_STRIDE; s++) {
      code.push(OPS.OUT, reg.get(outputs[s].id), s, 0);
    }
    const len = code.length / 4 - ofs;
    if (len > VM_MAX_REGS) throw new Error(`edit program too long: ${len} > ${VM_MAX_REGS} registers`);
    maxRegs = Math.max(maxRegs, len);
    table.push(ofs, len);
  }

  return {
    code: Uint32Array.from(code),
    table: Uint32Array.from(table),
    consts: Float32Array.from(consts),
    paramNames: S.paramNames.slice(),
    count: editsOutputs.length,
    maxRegs
  };
}

// ---- JS twin interpreter (bit-for-bit the WGSL loop, in float64) -----------
export function interpretEdits(prog, paramValues) {
  const out = new Float32Array(prog.count * EDIT_STRIDE);
  const P = prog.paramNames.map((n) => {
    if (!(n in paramValues)) throw new Error('missing param: ' + n);
    return paramValues[n];
  });
  const regs = new Float64Array(VM_MAX_REGS);
  for (let ei = 0; ei < prog.count; ei++) {
    const ofs = prog.table[ei * 2], len = prog.table[ei * 2 + 1];
    for (let pc = 0; pc < len; pc++) {
      const o = (ofs + pc) * 4;
      const op = prog.code[o], a = prog.code[o + 1], b = prog.code[o + 2], c = prog.code[o + 3];
      let v = 0;
      switch (op) {
      case OPS.CONST: v = prog.consts[a]; break;
      case OPS.PARAM: v = P[a]; break;
      case OPS.ADD: v = regs[a] + regs[b]; break;
      case OPS.SUB: v = regs[a] - regs[b]; break;
      case OPS.MUL: v = regs[a] * regs[b]; break;
      case OPS.DIV: v = regs[a] / regs[b]; break;
      case OPS.MIN: v = Math.min(regs[a], regs[b]); break;
      case OPS.MAX: v = Math.max(regs[a], regs[b]); break;
      case OPS.NEG: v = -regs[a]; break;
      case OPS.ABS: v = Math.abs(regs[a]); break;
      case OPS.SQRT: v = Math.sqrt(Math.max(regs[a], 0)); break;
      case OPS.SEL: v = regs[a] > 0 ? regs[b] : regs[c]; break;
      case OPS.OUT: out[ei * EDIT_STRIDE + b] = regs[a]; break;
      }
      regs[pc] = v;
    }
  }
  return out;
}

// ---- WGSL interpreter (the GPU side of the twin) ---------------------------
// One thread per edit; straight-line loop; model conditionals are select().
export function generateVmWgsl(prog, opts = {}) {
  const P = (n) => (opts.prefix || 'lxvm_') + n;
  const g = opts.group != null ? opts.group : 0;
  return `// ===== Lucid SDF template VM (generated) =====
// ${prog.count} edit programs, straight-line bytecode, one thread per edit.
const ${P('COUNT')}: u32 = ${prog.count}u;
@group(${g}) @binding(0) var<storage, read> ${P('code')}: array<vec4<u32>>;
@group(${g}) @binding(1) var<storage, read> ${P('table')}: array<vec2<u32>>;
@group(${g}) @binding(2) var<storage, read> ${P('consts')}: array<f32>;
@group(${g}) @binding(3) var<storage, read> ${P('params')}: array<f32>;
@group(${g}) @binding(4) var<storage, read_write> ${P('out')}: array<f32>;
@compute @workgroup_size(16)
fn ${P('main')}(@builtin(global_invocation_id) gid: vec3<u32>) {
  let ei = gid.x;
  if (ei >= ${P('COUNT')}) { return; }
  var regs: array<f32, ${VM_MAX_REGS}>;
  let ofs = ${P('table')}[ei].x;
  let len = ${P('table')}[ei].y;
  for (var pc = 0u; pc < len; pc = pc + 1u) {
    let ins = ${P('code')}[ofs + pc];
    let a = ins.y; let b = ins.z; let c = ins.w;
    var v = 0.0;
    switch ins.x {
      case 0u: { v = ${P('consts')}[a]; }
      case 1u: { v = ${P('params')}[a]; }
      case 2u: { v = regs[a] + regs[b]; }
      case 3u: { v = regs[a] - regs[b]; }
      case 4u: { v = regs[a] * regs[b]; }
      case 5u: { v = regs[a] / regs[b]; }
      case 6u: { v = min(regs[a], regs[b]); }
      case 7u: { v = max(regs[a], regs[b]); }
      case 8u: { v = -regs[a]; }
      case 9u: { v = abs(regs[a]); }
      case 10u: { v = sqrt(max(regs[a], 0.0)); }
      case 11u: { v = select(regs[c], regs[b], regs[a] > 0.0); }
      case 12u: { ${P('out')}[ei * ${EDIT_STRIDE}u + b] = regs[a]; }
      default: { }
    }
    regs[pc] = v;
  }
}
`;
}
