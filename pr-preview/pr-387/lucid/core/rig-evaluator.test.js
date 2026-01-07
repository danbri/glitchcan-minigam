/**
 * Unit Tests for Rig Evaluator Core Math Functions
 *
 * Run with: node --experimental-vm-modules lucid/core/rig-evaluator.test.js
 * Or in browser: Load as module and check console for results
 */

import { evaluateExpr, topologicalSort, evaluateRig, validateRig } from './rig-evaluator.js';

// Simple test runner
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(`  ${e.message}`);
    failed++;
  }
}

function assertEquals(actual, expected, msg = '') {
  if (typeof expected === 'number' && typeof actual === 'number') {
    // Use approximate equality for floats
    if (Math.abs(actual - expected) > 1e-10) {
      throw new Error(`${msg} Expected ${expected}, got ${actual}`);
    }
  } else if (actual !== expected) {
    throw new Error(`${msg} Expected ${expected}, got ${actual}`);
  }
}

function assertApprox(actual, expected, tolerance = 1e-6, msg = '') {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg} Expected ~${expected}, got ${actual} (tolerance: ${tolerance})`);
  }
}

function assertArrayEquals(actual, expected, msg = '') {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    throw new Error(`${msg} Expected arrays`);
  }
  if (actual.length !== expected.length) {
    throw new Error(`${msg} Array length mismatch: ${actual.length} vs ${expected.length}`);
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(`${msg} Array mismatch at index ${i}: ${actual[i]} vs ${expected[i]}`);
    }
  }
}

console.log('\n=== evaluateExpr: Basic Types ===\n');

test('evaluateExpr: number passthrough', () => {
  assertEquals(evaluateExpr(42, {}), 42);
  assertEquals(evaluateExpr(3.14, {}), 3.14);
  assertEquals(evaluateExpr(-1, {}), -1);
  assertEquals(evaluateExpr(0, {}), 0);
});

test('evaluateExpr: null/undefined returns 0', () => {
  assertEquals(evaluateExpr(null, {}), 0);
  assertEquals(evaluateExpr(undefined, {}), 0);
});

test('evaluateExpr: string variable reference', () => {
  assertEquals(evaluateExpr('foo', { foo: 10 }), 10);
  assertEquals(evaluateExpr('bar', { bar: -5 }), -5);
  assertEquals(evaluateExpr('missing', {}), 0); // undefined var returns 0
});

test('evaluateExpr: time variable', () => {
  assertEquals(evaluateExpr('time', {}, 5.5), 5.5);
  assertEquals(evaluateExpr({ type: 'var', name: 'time' }, {}, 10), 10);
});

test('evaluateExpr: const type', () => {
  assertEquals(evaluateExpr({ type: 'const', value: 99 }, {}), 99);
});

test('evaluateExpr: var type', () => {
  assertEquals(evaluateExpr({ type: 'var', name: 'x' }, { x: 7 }), 7);
});

console.log('\n=== evaluateExpr: Arithmetic Operations ===\n');

test('evaluateExpr: add', () => {
  assertEquals(evaluateExpr({ expr: 'add', args: [1, 2] }, {}), 3);
  assertEquals(evaluateExpr({ expr: 'add', args: [1, 2, 3, 4] }, {}), 10);
  assertEquals(evaluateExpr({ expr: 'add', args: [] }, {}), 0);
});

test('evaluateExpr: sub', () => {
  assertEquals(evaluateExpr({ expr: 'sub', args: [10, 3] }, {}), 7);
  assertEquals(evaluateExpr({ expr: 'sub', args: [5] }, {}), 5); // missing second arg
});

test('evaluateExpr: mul', () => {
  assertEquals(evaluateExpr({ expr: 'mul', args: [3, 4] }, {}), 12);
  assertEquals(evaluateExpr({ expr: 'mul', args: [2, 3, 4] }, {}), 24);
  assertEquals(evaluateExpr({ expr: 'mul', args: [] }, {}), 1);
});

test('evaluateExpr: div with valid denominator', () => {
  assertEquals(evaluateExpr({ expr: 'div', args: [10, 2] }, {}), 5);
  assertEquals(evaluateExpr({ expr: 'div', args: [7, 2] }, {}), 3.5);
});

test('evaluateExpr: div by zero returns 0 (not Infinity)', () => {
  assertEquals(evaluateExpr({ expr: 'div', args: [10, 0] }, {}), 0);
  assertEquals(evaluateExpr({ expr: 'div', args: [0, 0] }, {}), 0);
  assertEquals(evaluateExpr({ expr: 'div', args: [-5, 0] }, {}), 0);
});

test('evaluateExpr: mod', () => {
  assertEquals(evaluateExpr({ expr: 'mod', args: [10, 3] }, {}), 1);
  assertEquals(evaluateExpr({ expr: 'mod', args: [10, 0] }, {}), 0); // mod by zero guard
});

console.log('\n=== evaluateExpr: Unary Operations ===\n');

test('evaluateExpr: abs', () => {
  assertEquals(evaluateExpr({ expr: 'abs', args: [-5] }, {}), 5);
  assertEquals(evaluateExpr({ expr: 'abs', args: [5] }, {}), 5);
  assertEquals(evaluateExpr({ expr: 'abs', args: [0] }, {}), 0);
});

test('evaluateExpr: neg', () => {
  assertEquals(evaluateExpr({ expr: 'neg', args: [5] }, {}), -5);
  assertEquals(evaluateExpr({ expr: 'neg', args: [-5] }, {}), 5);
});

test('evaluateExpr: floor', () => {
  assertEquals(evaluateExpr({ expr: 'floor', args: [3.7] }, {}), 3);
  assertEquals(evaluateExpr({ expr: 'floor', args: [-3.7] }, {}), -4);
});

test('evaluateExpr: ceil', () => {
  assertEquals(evaluateExpr({ expr: 'ceil', args: [3.2] }, {}), 4);
  assertEquals(evaluateExpr({ expr: 'ceil', args: [-3.2] }, {}), -3);
});

test('evaluateExpr: fract', () => {
  assertApprox(evaluateExpr({ expr: 'fract', args: [3.7] }, {}), 0.7);
  assertApprox(evaluateExpr({ expr: 'fract', args: [5.0] }, {}), 0.0);
});

console.log('\n=== evaluateExpr: Trigonometric Functions ===\n');

test('evaluateExpr: sin', () => {
  assertApprox(evaluateExpr({ expr: 'sin', args: [0] }, {}), 0);
  assertApprox(evaluateExpr({ expr: 'sin', args: [Math.PI / 2] }, {}), 1);
  assertApprox(evaluateExpr({ expr: 'sin', args: [Math.PI] }, {}), 0);
});

test('evaluateExpr: cos', () => {
  assertApprox(evaluateExpr({ expr: 'cos', args: [0] }, {}), 1);
  assertApprox(evaluateExpr({ expr: 'cos', args: [Math.PI / 2] }, {}), 0);
  assertApprox(evaluateExpr({ expr: 'cos', args: [Math.PI] }, {}), -1);
});

test('evaluateExpr: tan', () => {
  assertApprox(evaluateExpr({ expr: 'tan', args: [0] }, {}), 0);
  assertApprox(evaluateExpr({ expr: 'tan', args: [Math.PI / 4] }, {}), 1);
});

console.log('\n=== evaluateExpr: Min/Max/Clamp ===\n');

test('evaluateExpr: min', () => {
  assertEquals(evaluateExpr({ expr: 'min', args: [3, 7] }, {}), 3);
  assertEquals(evaluateExpr({ expr: 'min', args: [5, 2, 8, 1] }, {}), 1);
});

test('evaluateExpr: max', () => {
  assertEquals(evaluateExpr({ expr: 'max', args: [3, 7] }, {}), 7);
  assertEquals(evaluateExpr({ expr: 'max', args: [5, 2, 8, 1] }, {}), 8);
});

test('evaluateExpr: clamp', () => {
  assertEquals(evaluateExpr({ expr: 'clamp', args: [5, 0, 10] }, {}), 5);  // within range
  assertEquals(evaluateExpr({ expr: 'clamp', args: [-5, 0, 10] }, {}), 0); // below min
  assertEquals(evaluateExpr({ expr: 'clamp', args: [15, 0, 10] }, {}), 10); // above max
});

console.log('\n=== evaluateExpr: Power/Sqrt ===\n');

test('evaluateExpr: pow', () => {
  assertEquals(evaluateExpr({ expr: 'pow', args: [2, 3] }, {}), 8);
  assertEquals(evaluateExpr({ expr: 'pow', args: [10, 0] }, {}), 1);
  assertEquals(evaluateExpr({ expr: 'pow', args: [5] }, {}), 5); // missing exponent defaults to 1
});

test('evaluateExpr: sqrt', () => {
  assertEquals(evaluateExpr({ expr: 'sqrt', args: [9] }, {}), 3);
  assertEquals(evaluateExpr({ expr: 'sqrt', args: [0] }, {}), 0);
  assertEquals(evaluateExpr({ expr: 'sqrt', args: [-1] }, {}), 0); // negative clamped to 0
});

console.log('\n=== evaluateExpr: Interpolation Functions ===\n');

test('evaluateExpr: step', () => {
  assertEquals(evaluateExpr({ expr: 'step', args: [0.5, 0.3] }, {}), 0); // x < edge
  assertEquals(evaluateExpr({ expr: 'step', args: [0.5, 0.5] }, {}), 1); // x == edge
  assertEquals(evaluateExpr({ expr: 'step', args: [0.5, 0.7] }, {}), 1); // x > edge
});

test('evaluateExpr: smoothstep', () => {
  assertEquals(evaluateExpr({ expr: 'smoothstep', args: [0, 1, -0.5] }, {}), 0); // below edge0
  assertEquals(evaluateExpr({ expr: 'smoothstep', args: [0, 1, 1.5] }, {}), 1);  // above edge1
  assertApprox(evaluateExpr({ expr: 'smoothstep', args: [0, 1, 0.5] }, {}), 0.5);  // midpoint
});

test('evaluateExpr: mix', () => {
  assertEquals(evaluateExpr({ expr: 'mix', args: [0, 10, 0] }, {}), 0);   // t=0
  assertEquals(evaluateExpr({ expr: 'mix', args: [0, 10, 1] }, {}), 10);  // t=1
  assertEquals(evaluateExpr({ expr: 'mix', args: [0, 10, 0.5] }, {}), 5); // t=0.5
});

console.log('\n=== evaluateExpr: Nested Expressions ===\n');

test('evaluateExpr: nested arithmetic', () => {
  // (2 + 3) * 4 = 20
  const expr = {
    expr: 'mul',
    args: [
      { expr: 'add', args: [2, 3] },
      4
    ]
  };
  assertEquals(evaluateExpr(expr, {}), 20);
});

test('evaluateExpr: nested with variables', () => {
  // sin(time * 2) + offset
  const expr = {
    expr: 'add',
    args: [
      { expr: 'sin', args: [{ expr: 'mul', args: ['time', 2] }] },
      'offset'
    ]
  };
  assertApprox(evaluateExpr(expr, { offset: 1 }, Math.PI / 4), Math.sin(Math.PI / 2) + 1);
});

console.log('\n=== topologicalSort ===\n');

test('topologicalSort: simple dependency chain', () => {
  const derived = {
    c: { expr: 'add', args: ['b', 1] },
    b: { expr: 'mul', args: ['a', 2] },
  };
  const baseValues = { a: 5 };
  const sorted = topologicalSort(derived, baseValues);
  // b depends on a (base), c depends on b, so order should be [b, c]
  assertArrayEquals(sorted, ['b', 'c']);
});

test('topologicalSort: independent params', () => {
  const derived = {
    x: 10,
    y: 20,
  };
  const sorted = topologicalSort(derived, {});
  assertEquals(sorted.length, 2);
  assertEquals(sorted.includes('x'), true);
  assertEquals(sorted.includes('y'), true);
});

console.log('\n=== evaluateRig ===\n');

test('evaluateRig: basic param extraction', () => {
  const params = {
    width: { value: 10 },
    height: { value: 20 },
  };
  const result = evaluateRig(params, null);
  assertEquals(result.values.width, 10);
  assertEquals(result.values.height, 20);
});

test('evaluateRig: derived params', () => {
  const params = {
    width: { value: 5 },
    height: { value: 10 },
  };
  const rig = {
    derived: {
      area: { expr: 'mul', args: ['width', 'height'] },
      perimeter: { expr: 'mul', args: [{ expr: 'add', args: ['width', 'height'] }, 2] },
    }
  };
  const result = evaluateRig(params, rig);
  assertEquals(result.values.area, 50);
  assertEquals(result.values.perimeter, 30);
  assertEquals(result.derived.area, 50);
});

test('evaluateRig: bounds violations', () => {
  const params = {
    x: { value: 150 },  // will violate max
    y: { value: -10 },   // will violate min
  };
  const rig = {
    bounds: {
      x: { min: 0, max: 100 },
      y: { min: 0, max: 100 },
    }
  };
  const result = evaluateRig(params, rig);
  assertEquals(result.violations.length, 2);
  assertEquals(result.violations[0].param, 'x');
  assertEquals(result.violations[1].param, 'y');
});

console.log('\n=== validateRig ===\n');

test('validateRig: detects unknown param reference', () => {
  const params = { a: { value: 1 } };
  const rig = {
    derived: {
      bad: { expr: 'add', args: ['unknown', 1] }
    }
  };
  const errors = validateRig(params, rig);
  assertEquals(errors.length > 0, true);
  assertEquals(errors[0].includes('unknown'), true);
});

test('validateRig: accepts valid references', () => {
  const params = { a: { value: 1 } };
  const rig = {
    derived: {
      b: { expr: 'mul', args: ['a', 2] }
    }
  };
  const errors = validateRig(params, rig);
  assertEquals(errors.length, 0);
});

// Summary
console.log('\n=== Test Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

if (failed > 0) {
  console.log('\n❌ Some tests failed!');
  if (typeof process !== 'undefined') process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
}

export { test, assertEquals, assertApprox };
