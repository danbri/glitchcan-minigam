#!/usr/bin/env node
/**
 * Kanren-RDF Test Suite
 * Tests core logic programming and RDF operations
 */

// ============================================
// CORE DATA MODEL (copied from demo)
// ============================================

class Var {
  constructor(name) {
    this.name = name;
    this.id = Symbol(name);
  }
  toString() { return '?' + this.name; }
}

class BNode {
  constructor(label, scope) {
    this.label = label;
    this.scope = scope;
    this.id = Symbol(`${scope}:${label}`);
  }
  toString() { return `_:${this.label}`; }
}

class URI {
  constructor(value) { this.value = value; }
  toString() { return `<${this.value}>`; }
}

class Literal {
  constructor(value, datatype = null, lang = null, annotations = {}) {
    this.value = value;
    this.datatype = datatype;
    this.lang = lang;
    this.annotations = annotations;
  }

  static parseAnnotatedDT(dt) {
    if (!dt || !dt.includes('|')) return { base: dt, annotations: {} };
    const [base, ...rest] = dt.split('|');
    const annotations = {};
    for (const part of rest) {
      const idx = part.indexOf(':');
      if (idx > 0) annotations[part.slice(0, idx)] = part.slice(idx + 1);
    }
    return { base, annotations };
  }

  toAnnotatedDT() {
    let dt = this.datatype || 'xsd:string';
    for (const [k, v] of Object.entries(this.annotations)) {
      dt += `|${k}:${v}`;
    }
    return dt;
  }

  toString() {
    let out = `"${this.value}"`;
    if (this.lang) return out + `@${this.lang}`;
    if (this.datatype || Object.keys(this.annotations).length) {
      return out + `^^<${this.toAnnotatedDT()}>`;
    }
    return out;
  }
}

class Triple {
  constructor(s, p, o) { this.s = s; this.p = p; this.o = o; }
}

class Claim {
  constructor(id, triples, meta = {}) {
    this.id = id;
    this.triples = triples;
    this.agent = meta.agent || null;
    this.time = meta.time || new Date().toISOString();
    this.derivedFrom = meta.derivedFrom || [];
    this.confidence = meta.confidence ?? 1.0;
  }
}

// ============================================
// KANREN CORE
// ============================================

class Substitution {
  constructor(map = new Map()) {
    this.map = map;
    this.lastClaim = null;
  }

  extend(v, val) {
    const m = new Map(this.map);
    m.set(v.id, val);
    const s = new Substitution(m);
    s.lastClaim = this.lastClaim;
    return s;
  }

  walk(val) {
    while (val instanceof Var && this.map.has(val.id)) {
      val = this.map.get(val.id);
    }
    return val;
  }
}

function termEq(a, b) {
  if (a instanceof URI && b instanceof URI) return a.value === b.value;
  if (a instanceof Literal && b instanceof Literal) {
    return a.value === b.value && a.datatype === b.datatype && a.lang === b.lang;
  }
  if (a instanceof BNode && b instanceof BNode) {
    return a.scope === b.scope && a.label === b.label;
  }
  return a === b;
}

function unify(u, v, sub) {
  u = sub.walk(u);
  v = sub.walk(v);
  if (u instanceof Var && v instanceof Var && u.id === v.id) return sub;
  if (u instanceof Var) return sub.extend(u, v);
  if (v instanceof Var) return sub.extend(v, u);
  if (termEq(u, v)) return sub;
  return null;
}

function* bind(stream, goal) {
  for (const sub of stream) yield* goal(sub);
}

function conj(g1, g2) {
  return sub => bind(g1(sub), g2);
}

function disj(g1, g2) {
  return function* (sub) {
    yield* g1(sub);
    yield* g2(sub);
  };
}

function eq(u, v) {
  return function* (sub) {
    const s = unify(u, v, sub);
    if (s) yield s;
  };
}

function runGoal(goal) {
  return goal(new Substitution());
}

// ============================================
// BLOOM FILTER (NEW - from PRD)
// ============================================

class BloomFilter {
  constructor(size = 1024, hashCount = 3) {
    this.size = size;
    this.hashCount = hashCount;
    this.bits = new Uint8Array(Math.ceil(size / 8));
  }

  // Simple hash functions using FNV-1a variant
  _hash(str, seed) {
    let hash = 2166136261 ^ seed;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash) % this.size;
  }

  add(key) {
    for (let i = 0; i < this.hashCount; i++) {
      const pos = this._hash(key, i);
      this.bits[Math.floor(pos / 8)] |= (1 << (pos % 8));
    }
  }

  mayContain(key) {
    for (let i = 0; i < this.hashCount; i++) {
      const pos = this._hash(key, i);
      if (!(this.bits[Math.floor(pos / 8)] & (1 << (pos % 8)))) {
        return false;
      }
    }
    return true;
  }

  toJSON() {
    return {
      size: this.size,
      hashCount: this.hashCount,
      bits: Array.from(this.bits)
    };
  }

  static fromJSON(data) {
    const bf = new BloomFilter(data.size, data.hashCount);
    bf.bits = new Uint8Array(data.bits);
    return bf;
  }
}

// ============================================
// INDEXED CLAIM STORE
// ============================================

class IndexedClaimStore {
  constructor() {
    this.claims = new Map();
    this.counter = 0;
    this.composites = new Map();
    this.bloomStats = { checks: 0, skips: 0 };
  }

  addClaim(triples, meta = {}) {
    const id = `claim:c${++this.counter}`;
    const claim = new Claim(id, triples, meta);

    // Build Bloom filter for this claim
    claim.bloom = new BloomFilter(1024, 3);
    for (const t of triples) {
      if (t.s instanceof URI) {
        claim.bloom.add(`s:${t.s.value}`);
        claim.bloom.add(`sp:${t.s.value}:${t.p.value}`);
      }
      if (t.p instanceof URI) {
        claim.bloom.add(`p:${t.p.value}`);
      }
      if (t.o instanceof URI) {
        claim.bloom.add(`o:${t.o.value}`);
        claim.bloom.add(`po:${t.p.value}:${t.o.value}`);
      }
      if (t.s instanceof URI && t.p instanceof URI && t.o instanceof URI) {
        claim.bloom.add(`spo:${t.s.value}:${t.p.value}:${t.o.value}`);
      }
    }

    this.claims.set(id, claim);
    return claim;
  }

  // Kanren goal with Bloom filter optimization
  tripleo(s, p, o, filter = {}) {
    const store = this;
    return function* (sub) {
      const ss = sub.walk(s);
      const pp = sub.walk(p);
      const oo = sub.walk(o);

      for (const claim of store.claims.values()) {
        if (filter.minConf && claim.confidence < filter.minConf) continue;

        // Bloom filter pre-check
        store.bloomStats.checks++;
        let mayMatch = true;

        if (!(ss instanceof Var) && ss instanceof URI) {
          if (!claim.bloom.mayContain(`s:${ss.value}`)) mayMatch = false;
        }
        if (mayMatch && !(pp instanceof Var) && pp instanceof URI) {
          if (!claim.bloom.mayContain(`p:${pp.value}`)) mayMatch = false;
        }
        if (mayMatch && !(oo instanceof Var) && oo instanceof URI) {
          if (!claim.bloom.mayContain(`o:${oo.value}`)) mayMatch = false;
        }

        if (!mayMatch) {
          store.bloomStats.skips++;
          continue;
        }

        // Full scan only if Bloom says "maybe"
        for (const triple of claim.triples) {
          let s1 = unify(ss, triple.s, sub);
          if (!s1) continue;
          s1 = unify(pp, triple.p, s1);
          if (!s1) continue;
          s1 = unify(oo, triple.o, s1);
          if (s1) {
            s1.lastClaim = claim;
            yield s1;
          }
        }
      }
    };
  }

  // Transitive closure / path query
  *pathQuery(start, predicate, maxDepth = 5) {
    const visited = new Set();
    const queue = [{ node: start, depth: 0, path: [start] }];

    while (queue.length > 0) {
      const { node, depth, path } = queue.shift();
      const nodeKey = node instanceof URI ? node.value : String(node);

      if (visited.has(nodeKey)) continue;
      visited.add(nodeKey);

      if (depth > 0) {
        yield { node, depth, path: [...path] };
      }

      if (depth >= maxDepth) continue;

      // Find outgoing edges via Kanren
      const x = new Var('x');
      for (const sub of this.tripleo(node, predicate, x)(new Substitution())) {
        const next = sub.walk(x);
        queue.push({
          node: next,
          depth: depth + 1,
          path: [...path, next]
        });
      }
    }
  }

  composeGraphs(op, left, right) {
    const id = `genid:${encodeURIComponent(left)}${op}${encodeURIComponent(right)}`;
    this.composites.set(id, { op, left, right });
    return id;
  }
}

// ============================================
// TEST FRAMEWORK
// ============================================

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    testsPassed++;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    \x1b[31m${e.message}\x1b[0m`);
    testsFailed++;
  }
}

function assert(cond, msg = 'Assertion failed') {
  if (!cond) throw new Error(msg);
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`);
}

// ============================================
// TESTS
// ============================================

console.log('\n\x1b[1m=== Kanren-RDF Test Suite ===\x1b[0m\n');

console.log('\x1b[36mUnification Tests:\x1b[0m');

test('unify two identical URIs', () => {
  const a = new URI('http://example.org/alice');
  const b = new URI('http://example.org/alice');
  const sub = unify(a, b, new Substitution());
  assert(sub !== null, 'Should unify identical URIs');
});

test('unify variable with URI', () => {
  const x = new Var('x');
  const a = new URI('http://example.org/alice');
  const sub = unify(x, a, new Substitution());
  assert(sub !== null, 'Should unify');
  const walked = sub.walk(x);
  assert(walked instanceof URI, 'Should walk to URI');
  assertEqual(walked.value, 'http://example.org/alice');
});

test('unify two variables', () => {
  const x = new Var('x');
  const y = new Var('y');
  const sub = unify(x, y, new Substitution());
  assert(sub !== null, 'Should unify');
});

test('fail to unify different URIs', () => {
  const a = new URI('http://example.org/alice');
  const b = new URI('http://example.org/bob');
  const sub = unify(a, b, new Substitution());
  assert(sub === null, 'Should fail');
});

test('transitive unification', () => {
  const x = new Var('x');
  const y = new Var('y');
  const a = new URI('http://example.org/alice');
  let sub = unify(x, y, new Substitution());
  sub = unify(y, a, sub);
  const walked = sub.walk(x);
  assertEqual(walked.value, 'http://example.org/alice');
});

console.log('\n\x1b[36mKanren Goal Tests:\x1b[0m');

test('eq goal succeeds for matching', () => {
  const x = new Var('x');
  const a = new URI('http://example.org/alice');
  const results = [...runGoal(eq(x, a))];
  assertEqual(results.length, 1, 'Should have one result');
});

test('conj combines two goals', () => {
  const x = new Var('x');
  const y = new Var('y');
  const a = new URI('http://example.org/alice');
  const b = new URI('http://example.org/bob');
  const goal = conj(eq(x, a), eq(y, b));
  const results = [...runGoal(goal)];
  assertEqual(results.length, 1, 'Should have one result');
  assertEqual(results[0].walk(x).value, 'http://example.org/alice');
  assertEqual(results[0].walk(y).value, 'http://example.org/bob');
});

test('disj produces multiple results', () => {
  const x = new Var('x');
  const a = new URI('http://example.org/alice');
  const b = new URI('http://example.org/bob');
  const goal = disj(eq(x, a), eq(x, b));
  const results = [...runGoal(goal)];
  assertEqual(results.length, 2, 'Should have two results');
});

console.log('\n\x1b[36mClaim Store Tests:\x1b[0m');

test('add and query claims', () => {
  const store = new IndexedClaimStore();
  const alice = new URI('http://example.org/alice');
  const bob = new URI('http://example.org/bob');
  const knows = new URI('http://xmlns.com/foaf/0.1/knows');

  store.addClaim([new Triple(alice, knows, bob)], {
    agent: 'http://example.org/agents/dan',
    confidence: 0.9
  });

  const x = new Var('x');
  const y = new Var('y');
  const results = [...runGoal(store.tripleo(x, knows, y))];

  assertEqual(results.length, 1, 'Should find one result');
  assertEqual(results[0].walk(x).value, 'http://example.org/alice');
  assertEqual(results[0].walk(y).value, 'http://example.org/bob');
});

test('join query across claims', () => {
  const store = new IndexedClaimStore();
  const alice = new URI('http://example.org/alice');
  const bob = new URI('http://example.org/bob');
  const charlie = new URI('http://example.org/charlie');
  const knows = new URI('http://xmlns.com/foaf/0.1/knows');

  store.addClaim([new Triple(alice, knows, bob)], { confidence: 0.9 });
  store.addClaim([new Triple(bob, knows, charlie)], { confidence: 0.8 });

  const x = new Var('x');
  const y = new Var('y');
  const z = new Var('z');

  // Find: ?x knows ?y AND ?y knows ?z (friends-of-friends)
  const goal = conj(
    store.tripleo(x, knows, y),
    store.tripleo(y, knows, z)
  );

  const results = [...runGoal(goal)];
  assertEqual(results.length, 1, 'Should find one friend-of-friend chain');
  assertEqual(results[0].walk(x).value, 'http://example.org/alice');
  assertEqual(results[0].walk(y).value, 'http://example.org/bob');
  assertEqual(results[0].walk(z).value, 'http://example.org/charlie');
});

console.log('\n\x1b[36mBloom Filter Tests:\x1b[0m');

test('Bloom filter basic operations', () => {
  const bf = new BloomFilter(1024, 3);
  bf.add('hello');
  bf.add('world');

  assert(bf.mayContain('hello'), 'Should contain hello');
  assert(bf.mayContain('world'), 'Should contain world');
  // Note: mayContain can have false positives, but unlikely for distinct strings
});

test('Bloom filter serialization', () => {
  const bf = new BloomFilter(1024, 3);
  bf.add('test');

  const json = bf.toJSON();
  const bf2 = BloomFilter.fromJSON(json);

  assert(bf2.mayContain('test'), 'Deserialized filter should contain test');
});

test('Bloom filter optimization reduces scans', () => {
  const store = new IndexedClaimStore();
  const knows = new URI('http://xmlns.com/foaf/0.1/knows');
  const likes = new URI('http://example.org/likes');

  // Add 100 claims with 'knows' predicate
  for (let i = 0; i < 100; i++) {
    store.addClaim([
      new Triple(
        new URI(`http://example.org/person${i}`),
        knows,
        new URI(`http://example.org/person${i + 1}`)
      )
    ]);
  }

  // Add 100 claims with 'likes' predicate
  for (let i = 0; i < 100; i++) {
    store.addClaim([
      new Triple(
        new URI(`http://example.org/person${i}`),
        likes,
        new URI(`http://example.org/thing${i}`)
      )
    ]);
  }

  store.bloomStats = { checks: 0, skips: 0 };

  // Query only 'likes' - should skip all 'knows' claims
  const x = new Var('x');
  const y = new Var('y');
  const results = [...runGoal(store.tripleo(x, likes, y))];

  assertEqual(results.length, 100, 'Should find 100 likes triples');
  assert(store.bloomStats.skips > 0, 'Should have skipped some claims via Bloom filter');
  console.log(`      (Bloom filter: ${store.bloomStats.checks} checks, ${store.bloomStats.skips} skips)`);
});

console.log('\n\x1b[36mPath Query Tests:\x1b[0m');

test('transitive closure / path query', () => {
  const store = new IndexedClaimStore();
  const knows = new URI('http://xmlns.com/foaf/0.1/knows');

  // Chain: alice -> bob -> charlie -> diana
  const alice = new URI('http://example.org/alice');
  const bob = new URI('http://example.org/bob');
  const charlie = new URI('http://example.org/charlie');
  const diana = new URI('http://example.org/diana');

  store.addClaim([new Triple(alice, knows, bob)]);
  store.addClaim([new Triple(bob, knows, charlie)]);
  store.addClaim([new Triple(charlie, knows, diana)]);

  const results = [...store.pathQuery(alice, knows, 5)];

  assertEqual(results.length, 3, 'Should find 3 reachable nodes');
  assertEqual(results[0].depth, 1, 'Bob at depth 1');
  assertEqual(results[1].depth, 2, 'Charlie at depth 2');
  assertEqual(results[2].depth, 3, 'Diana at depth 3');
});

console.log('\n\x1b[36mAnnotated Datatype Tests:\x1b[0m');

test('parse annotated datatype', () => {
  const { base, annotations } = Literal.parseAnnotatedDT('xsd:string|ctx:chunk1|sig:abc123');
  assertEqual(base, 'xsd:string');
  assertEqual(annotations.ctx, 'chunk1');
  assertEqual(annotations.sig, 'abc123');
});

test('literal with annotations', () => {
  const lit = new Literal('B', 'xsd:string', null, { ctx: 'dvla', issued: '1989' });
  const str = lit.toString();
  assert(str.includes('xsd:string'), 'Should have base type');
  assert(str.includes('ctx:dvla'), 'Should have ctx annotation');
  assert(str.includes('issued:1989'), 'Should have issued annotation');
});

// ============================================
// SUMMARY
// ============================================

console.log('\n\x1b[1m=== Summary ===\x1b[0m');
console.log(`  \x1b[32mPassed: ${testsPassed}\x1b[0m`);
if (testsFailed > 0) {
  console.log(`  \x1b[31mFailed: ${testsFailed}\x1b[0m`);
  process.exit(1);
} else {
  console.log('\n\x1b[32m✓ All tests passed!\x1b[0m\n');
}
