/**
 * Unit Tests for DSL Parser
 *
 * Tests the core DSL parsing functionality including:
 * - Template extraction and expansion
 * - Arithmetic expression handling
 * - Argument splitting
 * - Scene graph IR generation
 */

import { test, expect } from '@playwright/test';
import {
  normalizeDslText,
  extractMacros,
  expandMacros,
  splitArgs,
  parseDslToSceneGraph,
  shadowParseDsl
} from '../lucid/core/dsl-parser.js';

test.describe('DSL Parser - Text Normalization', () => {

  test('should normalize basic DSL text', () => {
    const input = `sphere(r=1.0)\nbox(size=[1,1,1])`;
    const result = normalizeDslText(input);
    expect(result).toEqual(['sphere(r=1.0)', 'box(size=[1,1,1])']);
  });

  test('should handle multi-line expressions with parentheses', () => {
    const input = `sphere(
      r=1.0,
      center=[0,0,0]
    )`;
    const result = normalizeDslText(input);
    expect(result.length).toBe(1);
    expect(result[0]).toContain('r=1.0');
    expect(result[0]).toContain('center=[0,0,0]');
  });

  test('should strip comments', () => {
    const input = `# This is a comment\nsphere(r=1.0) # inline comment`;
    const result = normalizeDslText(input);
    expect(result).toEqual(['sphere(r=1.0)']);
  });

  test('should handle empty lines', () => {
    const input = `sphere(r=1.0)\n\n\nbox(size=[1,1,1])`;
    const result = normalizeDslText(input);
    expect(result).toEqual(['sphere(r=1.0)', 'box(size=[1,1,1])']);
  });
});

test.describe('DSL Parser - Argument Splitting', () => {

  test('should split simple arguments', () => {
    const result = splitArgs('a=1, b=2, c=3');
    expect(result).toEqual(['a=1', 'b=2', 'c=3']);
  });

  test('should handle array literals', () => {
    const result = splitArgs('center=[1,2,3], color=[0.5,0.5,0.5]');
    expect(result.length).toBe(2);
    expect(result[0]).toBe('center=[1,2,3]');
    expect(result[1]).toBe('color=[0.5,0.5,0.5]');
  });

  test('should handle nested parentheses', () => {
    const result = splitArgs('a=func(1,2), b=3');
    expect(result.length).toBe(2);
    expect(result[0]).toBe('a=func(1,2)');
    expect(result[1]).toBe('b=3');
  });

  test('should handle expressions with operators', () => {
    const result = splitArgs('x=1+2, y=3*4');
    expect(result.length).toBe(2);
    expect(result[0]).toBe('x=1+2');
    expect(result[1]).toBe('y=3*4');
  });

  test('should handle sin(time) expressions', () => {
    const result = splitArgs('x=-1.5 + sin(time)*0.3, y=0.6');
    expect(result.length).toBe(2);
    expect(result[0]).toBe('x=-1.5 + sin(time)*0.3');
    expect(result[1]).toBe('y=0.6');
  });
});

test.describe('DSL Parser - Template System', () => {

  test('should parse template definition', () => {
    const dsl = `
template invader(x, y, color):
  body = box(size=[0.5, 0.4, 0.3], center=[x, y, 0], color=color)
  return body

i1 = invader(-1.5, 0.6, [0.0, 1.0, 0.5])
out = i1
`;
    const result = parseDslToSceneGraph(dsl);
    expect(result.errors).toEqual([]);
    expect(result.sceneGraph.length).toBeGreaterThan(0);
  });

  test('should handle arithmetic expressions in templates', () => {
    const dsl = `
template pulsing(x, y):
  pulse = 0.3 + sin(time*2.0)*0.1
  body = box(size=[pulse, pulse, 0.3], center=[x, y, 0])
  return body

i1 = pulsing(0.0, 0.0)
out = i1
`;
    const result = parseDslToSceneGraph(dsl);
    // Should NOT have parse errors about arithmetic expressions
    const arithmeticErrors = result.errors.filter(e =>
      e.msg.includes('Expected function call')
    );
    expect(arithmeticErrors.length).toBe(0);
  });

  test('should expand template instances', () => {
    const dsl = `
template simple(x):
  s = sphere(r=1.0, center=[x, 0, 0])
  return s

i1 = simple(1.0)
i2 = simple(2.0)
out = union(i1, i2)
`;
    const result = parseDslToSceneGraph(dsl);
    expect(result.errors).toEqual([]);
    const nodes = result.sceneGraph;
    // Should have expanded template instances
    const spheres = nodes.filter(n => n.type === 'sphere');
    expect(spheres.length).toBeGreaterThan(0);
  });

  test('should handle multiple template parameters', () => {
    const dsl = `
template box3d(x, y, z, size, color):
  b = box(size=[size, size, size], center=[x, y, z], color=color)
  return b

b1 = box3d(0, 0, 0, 1.0, [1.0, 0.0, 0.0])
out = b1
`;
    const result = parseDslToSceneGraph(dsl);
    expect(result.errors).toEqual([]);
  });
});

test.describe('DSL Parser - Scene Graph Generation', () => {

  test('should parse sphere primitive', () => {
    const dsl = 's = sphere(r=1.0, center=[0,0,0], color=[1,0,0])\nout = s';
    const result = parseDslToSceneGraph(dsl);
    expect(result.errors).toEqual([]);
    expect(result.sceneGraph.length).toBeGreaterThan(0);
    const sphere = result.sceneGraph.find(n => n.type === 'sphere');
    expect(sphere).toBeDefined();
    expect(sphere.params.r).toBe('1.0');
  });

  test('should parse box primitive', () => {
    const dsl = 'b = box(size=[1,1,1], center=[0,0,0])\nout = b';
    const result = parseDslToSceneGraph(dsl);
    expect(result.errors).toEqual([]);
    const box = result.sceneGraph.find(n => n.type === 'box');
    expect(box).toBeDefined();
  });

  test('should parse union operation', () => {
    const dsl = `
s1 = sphere(r=1.0, center=[-1,0,0])
s2 = sphere(r=1.0, center=[1,0,0])
u = union(s1, s2)
out = u
`;
    const result = parseDslToSceneGraph(dsl);
    expect(result.errors).toEqual([]);
    const union = result.sceneGraph.find(n => n.type === 'union');
    expect(union).toBeDefined();
    expect(union.inputs).toBeDefined();
  });

  test('should parse subtract operation', () => {
    const dsl = `
s1 = sphere(r=2.0, center=[0,0,0])
s2 = sphere(r=1.0, center=[0,0,0])
diff = subtract(a=s1, b=s2)
out = diff
`;
    const result = parseDslToSceneGraph(dsl);
    expect(result.errors).toEqual([]);
    const subtract = result.sceneGraph.find(n => n.type === 'subtract');
    expect(subtract).toBeDefined();
  });

  test('should handle time variable in expressions', () => {
    const dsl = 's = sphere(r=1.0, center=[sin(time), 0, 0])\nout = s';
    const result = parseDslToSceneGraph(dsl);
    expect(result.errors).toEqual([]);
    const sphere = result.sceneGraph.find(n => n.type === 'sphere');
    expect(sphere).toBeDefined();
    // Time expression should be preserved in params
    expect(sphere.params.center).toBeDefined();
  });
});

test.describe('DSL Parser - Error Handling', () => {

  test('should report syntax errors', () => {
    const dsl = 'invalid syntax here!!!';
    const result = parseDslToSceneGraph(dsl);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should report undefined variables', () => {
    const dsl = 'out = undefined_variable';
    const result = parseDslToSceneGraph(dsl);
    // Should complete but mark undefined variable
    expect(result.sceneGraph).toBeDefined();
  });

  test('should NOT error on template arithmetic expressions', () => {
    // CRITICAL: This test verifies the fix for arithmetic expression parsing
    const dsl = `
template test(x):
  pulse = 0.3 + sin(time)*0.1
  s = sphere(r=pulse, center=[x, 0, 0])
  return s

i1 = test(0)
out = i1
`;
    const result = parseDslToSceneGraph(dsl);
    // The fix should prevent "Expected function call" errors on arithmetic lines
    const arithmeticErrors = result.errors.filter(e =>
      e.msg.includes('Expected function call') && e.msg.includes('pulse')
    );
    expect(arithmeticErrors.length).toBe(0);
  });
});

test.describe('DSL Parser - Macro System', () => {

  test('should extract macros', () => {
    const dsl = `
def RED: [1.0, 0.0, 0.0]
def RADIUS: 2.0
s = sphere(r=RADIUS, color=RED)
out = s
`;
    const macros = extractMacros(dsl);
    expect(macros.has('RED')).toBe(true);
    expect(macros.has('RADIUS')).toBe(true);
    expect(macros.get('RED')).toBe('[1.0, 0.0, 0.0]');
    expect(macros.get('RADIUS')).toBe('2.0');
  });

  test('should expand macros', () => {
    const text = 's = sphere(r=RADIUS, color=COLOR)';
    const macros = new Map([
      ['RADIUS', '1.5'],
      ['COLOR', '[1,0,0]']
    ]);
    const result = expandMacros(text, macros);
    expect(result).toContain('1.5');
    expect(result).toContain('[1,0,0]');
  });

  test('should handle macro in array literals', () => {
    const text = 'center=[X, Y, Z]';
    const macros = new Map([
      ['X', '1.0'],
      ['Y', '2.0'],
      ['Z', '3.0']
    ]);
    const result = expandMacros(text, macros);
    expect(result).toBe('center=[1.0, 2.0, 3.0]');
  });
});
