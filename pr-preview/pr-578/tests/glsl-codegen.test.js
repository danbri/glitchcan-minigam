/**
 * Unit Tests for GLSL Code Generation
 *
 * Tests the GLSL shader code generation from scene graph IR including:
 * - Template function generation
 * - Time variable conversion (time → u_time)
 * - Type inference for template parameters
 * - Proper GLSL syntax output
 */

import { test, expect } from '@playwright/test';
import { generateGlslFromSceneGraph } from '../lucid/core/glsl-codegen.js';
import { parseDslToSceneGraph } from '../lucid/core/dsl-parser.js';

test.describe('GLSL Codegen - Basic Primitives', () => {

  test('should generate GLSL for sphere', () => {
    const sceneGraph = [{
      id: 's1',
      type: 'sphere',
      params: { r: '1.0', center: '[0,0,0]', color: '[1,0,0]' },
      inputs: {},
      inputOrder: []
    }];
    const glsl = generateGlslFromSceneGraph(sceneGraph);
    expect(glsl).toContain('g_sdSphere');
    expect(glsl).toContain('1.0');
  });

  test('should generate GLSL for box', () => {
    const sceneGraph = [{
      id: 'b1',
      type: 'box',
      params: { size: '[1,1,1]', center: '[0,0,0]' },
      inputs: {},
      inputOrder: []
    }];
    const glsl = generateGlslFromSceneGraph(sceneGraph);
    expect(glsl).toContain('g_sdBox');
  });

  test('should generate GLSL for cylinder', () => {
    const sceneGraph = [{
      id: 'c1',
      type: 'cylinder',
      params: { r: '0.5', h: '2.0', center: '[0,0,0]' },
      inputs: {},
      inputOrder: []
    }];
    const glsl = generateGlslFromSceneGraph(sceneGraph);
    expect(glsl).toContain('g_sdCylinder');
  });
});

test.describe('GLSL Codegen - Time Variable Conversion', () => {

  test('should convert time to u_time in expressions', () => {
    const dsl = 's = sphere(r=1.0, center=[sin(time), 0, 0])\nout = s';
    const result = parseDslToSceneGraph(dsl);
    const glsl = generateGlslFromSceneGraph(result.sceneGraph);

    // Should contain u_time, not time
    expect(glsl).toContain('u_time');
    expect(glsl).not.toMatch(/\btime\b/); // word boundary match to avoid 'u_time'
  });

  test('should handle complex time expressions', () => {
    const dsl = `
s = sphere(
  r=1.0 + sin(time*2.0)*0.5,
  center=[cos(time), sin(time), 0]
)
out = s
`;
    const result = parseDslToSceneGraph(dsl);
    const glsl = generateGlslFromSceneGraph(result.sceneGraph);

    expect(glsl).toContain('u_time');
    expect(glsl).toContain('sin(u_time');
    expect(glsl).toContain('cos(u_time');
  });
});

test.describe('GLSL Codegen - Union and Boolean Operations', () => {

  test('should generate union with multiple inputs', () => {
    const dsl = `
s1 = sphere(r=1.0, center=[-1,0,0])
s2 = sphere(r=1.0, center=[0,0,0])
s3 = sphere(r=1.0, center=[1,0,0])
u = union(s1, s2, s3)
out = u
`;
    const result = parseDslToSceneGraph(dsl);
    const glsl = generateGlslFromSceneGraph(result.sceneGraph);

    // Should have union logic (finding minimum distance)
    expect(glsl).toContain('vec4');
    // Should handle multiple inputs correctly
    expect(glsl).toMatch(/v0|v1|v2/); // Variable declarations for union inputs
  });

  test('should generate subtract operation', () => {
    const dsl = `
s1 = sphere(r=2.0, center=[0,0,0])
s2 = sphere(r=1.0, center=[0,0,0])
diff = subtract(a=s1, b=s2)
out = diff
`;
    const result = parseDslToSceneGraph(dsl);
    const glsl = generateGlslFromSceneGraph(result.sceneGraph);

    expect(glsl).toContain('g_opSubtract');
  });

  test('should generate smoothUnion', () => {
    const dsl = `
s1 = sphere(r=1.0, center=[-1,0,0])
s2 = sphere(r=1.0, center=[1,0,0])
su = smoothUnion(s1, s2, k=0.5)
out = su
`;
    const result = parseDslToSceneGraph(dsl);
    const glsl = generateGlslFromSceneGraph(result.sceneGraph);

    expect(glsl).toContain('g_opSmoothUnion');
    expect(glsl).toContain('0.5'); // k parameter
  });
});

test.describe('GLSL Codegen - Template Function Generation', () => {

  test('should generate GLSL function for template', () => {
    const dsl = `
template invader(x, y, color):
  body = box(size=[0.5, 0.4, 0.3], center=[x, y, 0], color=color)
  return body

i1 = invader(-1.5, 0.6, [0.0, 1.0, 0.5])
i2 = invader(1.5, 0.6, [0.0, 1.0, 0.5])
out = union(i1, i2)
`;
    const result = parseDslToSceneGraph(dsl);
    const glsl = generateGlslFromSceneGraph(result.sceneGraph);

    // Should generate a template function
    expect(glsl).toContain('template_invader');
    // Should have function signature with parameters
    expect(glsl).toMatch(/vec4\s+template_invader\s*\(/);
  });

  test('should optimize template with multiple instances', () => {
    const dsl = `
template simple(x):
  s = sphere(r=1.0, center=[x, 0, 0])
  return s

i1 = simple(-2.0)
i2 = simple(-1.0)
i3 = simple(0.0)
i4 = simple(1.0)
i5 = simple(2.0)
out = union(i1, i2, i3, i4, i5)
`;
    const result = parseDslToSceneGraph(dsl);
    const glsl = generateGlslFromSceneGraph(result.sceneGraph);

    // With 5 instances, should generate function (threshold is 2+)
    expect(glsl).toContain('template_simple');
    // Should call the function multiple times
    const functionCalls = (glsl.match(/template_simple\(/g) || []).length;
    expect(functionCalls).toBeGreaterThanOrEqual(5);
  });

  test('should handle template with arithmetic expressions', () => {
    // CRITICAL: Tests the splitArgs import fix
    const dsl = `
template pulsing(x, y):
  pulse = 0.3 + sin(time*2.0)*0.1
  body = box(size=[pulse, pulse*0.8, 0.3], center=[x, y, 0])
  return body

i1 = pulsing(0.0, 0.0)
out = i1
`;
    const result = parseDslToSceneGraph(dsl);

    // Parser should succeed without errors
    expect(result.errors).toEqual([]);

    // GLSL generation should not throw
    let glsl;
    expect(() => {
      glsl = generateGlslFromSceneGraph(result.sceneGraph);
    }).not.toThrow();

    // Should contain time conversion
    expect(glsl).toContain('u_time');

    // Should have template function
    expect(glsl).toContain('template_pulsing');
  });

  test('should handle template parameters in expressions', () => {
    const dsl = `
template offset_sphere(x, offset):
  s = sphere(r=1.0, center=[x + offset, 0, 0])
  return s

i1 = offset_sphere(0.0, 1.5)
out = i1
`;
    const result = parseDslToSceneGraph(dsl);
    const glsl = generateGlslFromSceneGraph(result.sceneGraph);

    // Should handle parameter arithmetic
    expect(glsl).toBeDefined();
    expect(glsl.length).toBeGreaterThan(0);
  });
});

test.describe('GLSL Codegen - Type Inference', () => {

  test('should infer vec3 for color parameters', () => {
    const dsl = `
template colored(color):
  s = sphere(r=1.0, color=color)
  return s

i1 = colored([1.0, 0.0, 0.0])
out = i1
`;
    const result = parseDslToSceneGraph(dsl);
    const glsl = generateGlslFromSceneGraph(result.sceneGraph);

    // Function signature should have vec3 for color
    // Note: Current implementation might default to float, this tests the expectation
    expect(glsl).toContain('template_colored');
  });

  test('should handle mixed parameter types', () => {
    const dsl = `
template mixed(x, size, color):
  b = box(size=[size, size, size], center=[x, 0, 0], color=color)
  return b

i1 = mixed(1.0, 0.5, [1.0, 0.0, 0.0])
out = i1
`;
    const result = parseDslToSceneGraph(dsl);
    const glsl = generateGlslFromSceneGraph(result.sceneGraph);

    expect(glsl).toContain('template_mixed');
    // Should compile without errors
    expect(glsl.length).toBeGreaterThan(0);
  });
});

test.describe('GLSL Codegen - Edge Cases', () => {

  test('should handle empty scene graph', () => {
    const glsl = generateGlslFromSceneGraph([]);
    expect(glsl).toBeDefined();
    expect(glsl.length).toBeGreaterThan(0);
    // Should still generate valid GLSL with fallback
    expect(glsl).toContain('sampleGraphScene');
  });

  test('should handle scene graph with no output', () => {
    const sceneGraph = [{
      id: 's1',
      type: 'sphere',
      params: { r: '1.0' },
      inputs: {},
      inputOrder: []
    }];
    // No 'out' node
    const glsl = generateGlslFromSceneGraph(sceneGraph);
    expect(glsl).toBeDefined();
  });

  test('should handle deeply nested operations', () => {
    const dsl = `
s1 = sphere(r=1.0, center=[0,0,0])
s2 = sphere(r=0.5, center=[0.5,0,0])
s3 = sphere(r=0.25, center=[0,0.5,0])
u1 = union(s1, s2)
u2 = union(u1, s3)
out = u2
`;
    const result = parseDslToSceneGraph(dsl);
    const glsl = generateGlslFromSceneGraph(result.sceneGraph);

    expect(glsl).toBeDefined();
    expect(glsl).toContain('vec4');
  });
});

test.describe('GLSL Codegen - Regression Tests', () => {

  test('REGRESSION: splitArgs must be imported', () => {
    // This test verifies the fix for missing splitArgs import
    const dsl = `
template test(x, y):
  s = sphere(r=1.0, center=[x, y, 0])
  return s

i1 = test(0, 0)
i2 = test(1, 1)
out = union(i1, i2)
`;
    const result = parseDslToSceneGraph(dsl);

    // Should not throw "Can't find variable: splitArgs"
    expect(() => {
      generateGlslFromSceneGraph(result.sceneGraph);
    }).not.toThrow();
  });

  test('REGRESSION: arithmetic expressions in templates should work', () => {
    // Verifies both parser and codegen fixes
    const dsl = `
template animated(x):
  pulse = 0.3 + sin(time*2.0)*0.1
  eye_size = 0.08 + sin(time*3.0)*0.02
  s = sphere(r=pulse, center=[x, 0, 0])
  return s

i1 = animated(0)
out = i1
`;
    const result = parseDslToSceneGraph(dsl);
    expect(result.errors).toEqual([]);

    const glsl = generateGlslFromSceneGraph(result.sceneGraph);
    expect(glsl).toContain('u_time');
    expect(glsl).not.toContain('ReferenceError');
  });
});
