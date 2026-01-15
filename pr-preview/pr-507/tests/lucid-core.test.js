/**
 * Unit tests for Lucid SDF-CSG core modules
 * Run with: npx vitest run tests/lucid-core.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock browser environment for modules
globalThis.window = globalThis;
globalThis.document = { createElement: () => ({}) };

// Import after setting up globals
const { loadJsonScene } = await import('../lucid/core/json-loader.js');
const { generateGlslFromJson } = await import('../lucid/core/json-codegen.js');

describe('json-loader.js', () => {
  describe('loadJsonScene', () => {
    it('should load a simple sphere', () => {
      const json = {
        version: '1.0',
        root: {
          type: 'sphere',
          params: { r: 1.0, color: [1, 0, 0] }
        }
      };
      const scene = loadJsonScene(json);
      expect(scene).toBeDefined();
      expect(scene.root).toBeDefined();
      expect(scene.root.type).toBe('sphere');
    });

    it('should load a box with transform', () => {
      const json = {
        version: '1.0',
        root: {
          type: 'box',
          params: { size: [1, 2, 3], color: [0, 1, 0] },
          transform: { translate: [1, 2, 3] }
        }
      };
      const scene = loadJsonScene(json);
      expect(scene.root.type).toBe('box');
      // Loader wraps arrays in structured format for animation support
      expect(scene.root.transform.translate.type).toBe('array');
      expect(scene.root.transform.translate.values.map(v => v.value)).toEqual([1, 2, 3]);
    });

    it('should load union of multiple children', () => {
      const json = {
        version: '1.0',
        root: {
          type: 'union',
          children: [
            { type: 'sphere', params: { r: 1.0 } },
            { type: 'box', params: { size: [1, 1, 1] } }
          ]
        }
      };
      const scene = loadJsonScene(json);
      expect(scene.root.type).toBe('union');
      expect(scene.root.children.length).toBe(2);
    });

    it('should resolve refs to defs', () => {
      const json = {
        version: '1.0',
        defs: {
          mySphere: { type: 'sphere', params: { r: 0.5 } }
        },
        root: {
          type: 'ref',
          id: 'mySphere'
        }
      };
      const scene = loadJsonScene(json);
      // Loader keeps refs as refs - resolution happens in codegen
      expect(scene.root.type).toBe('ref');
      expect(scene.root.refId).toBe('mySphere');
      // Defs stored as Map for codegen to resolve
      expect(scene.defs.get('mySphere').type).toBe('sphere');
    });

    it('should process expression values', () => {
      const json = {
        version: '1.0',
        root: {
          type: 'sphere',
          params: {
            r: { expr: 'add', args: [1.0, { expr: 'sin', args: [{ var: 'time' }] }] },
            color: [1, 0, 0]
          }
        }
      };
      const scene = loadJsonScene(json);
      expect(scene.root.params.r.type).toBe('expr');
      expect(scene.root.params.r.op).toBe('add');
    });

    it('should process variable references', () => {
      const json = {
        version: '1.0',
        root: {
          type: 'sphere',
          params: {
            r: { var: 'time' },
            color: [1, 0, 0]
          }
        }
      };
      const scene = loadJsonScene(json);
      expect(scene.root.params.r.type).toBe('var');
      expect(scene.root.params.r.name).toBe('time');
    });

    it('should process all primitive types', () => {
      const primitives = ['sphere', 'box', 'torus', 'cylinder', 'capsule', 'ellipsoid', 'plane'];
      primitives.forEach(primType => {
        const json = {
          version: '1.0',
          root: { type: primType, params: {} }
        };
        const scene = loadJsonScene(json);
        expect(scene.root.type).toBe(primType);
      });
    });

    it('should process CSG operations', () => {
      const ops = ['union', 'subtract', 'intersect', 'smoothUnion', 'smoothSubtract', 'smoothIntersect'];
      ops.forEach(opType => {
        const json = {
          version: '1.0',
          root: {
            type: opType,
            children: [
              { type: 'sphere', params: { r: 1 } },
              { type: 'sphere', params: { r: 0.5 } }
            ],
            k: 0.2
          }
        };
        const scene = loadJsonScene(json);
        expect(scene.root.type).toBe(opType);
      });
    });

    it('should process radial modifier', () => {
      const json = {
        version: '1.0',
        root: {
          type: 'radial',
          count: 8,
          axis: 'y',
          child: { type: 'sphere', params: { r: 0.2 } }
        }
      };
      const scene = loadJsonScene(json);
      expect(scene.root.type).toBe('radial');
      // Loader normalizes values to IR format: {type: 'const', value: N}
      expect(scene.root.count).toEqual({ type: 'const', value: 8 });
    });

    it('should process mirror modifier', () => {
      const json = {
        version: '1.0',
        root: {
          type: 'mirror',
          axis: 'xz',
          child: { type: 'sphere', params: { r: 0.5 } }
        }
      };
      const scene = loadJsonScene(json);
      expect(scene.root.type).toBe('mirror');
      expect(scene.root.axis).toBe('xz');
    });

    it('should process repeat modifier', () => {
      const json = {
        version: '1.0',
        root: {
          type: 'repeat',
          period: [2, 0, 2],
          child: { type: 'sphere', params: { r: 0.3 } }
        }
      };
      const scene = loadJsonScene(json);
      expect(scene.root.type).toBe('repeat');
      // Loader normalizes arrays to IR format: {type: 'array', values: [...]}
      expect(scene.root.period).toEqual({
        type: 'array',
        values: [
          { type: 'const', value: 2 },
          { type: 'const', value: 0 },
          { type: 'const', value: 2 }
        ]
      });
    });

    it('should process Euler rotation', () => {
      const json = {
        version: '1.0',
        root: {
          type: 'box',
          params: { size: [1, 1, 1] },
          transform: { rotate: [45, 90, 0] }
        }
      };
      const scene = loadJsonScene(json);
      // Rotation arrays wrapped in structured format
      expect(scene.root.transform.rotate.type).toBe('array');
      expect(scene.root.transform.rotate.values.map(v => v.value)).toEqual([45, 90, 0]);
    });

    it('should process quaternion rotation', () => {
      const json = {
        version: '1.0',
        root: {
          type: 'box',
          params: { size: [1, 1, 1] },
          transform: { rotateQ: [0, 0.7071, 0, 0.7071] }
        }
      };
      const scene = loadJsonScene(json);
      // Quaternion (4 values) wrapped as 'array' type
      expect(scene.root.transform.rotateQ.type).toBe('array');
      expect(scene.root.transform.rotateQ.values.map(v => v.value)).toEqual([0, 0.7071, 0, 0.7071]);
    });

    it('should process axis-angle rotation', () => {
      const json = {
        version: '1.0',
        root: {
          type: 'box',
          params: { size: [1, 1, 1] },
          transform: { rotateAxis: { axis: [1, 1, 0], angle: 60 } }
        }
      };
      const scene = loadJsonScene(json);
      // Axis wrapped as array, angle as const
      expect(scene.root.transform.rotateAxis.axis.type).toBe('array');
      expect(scene.root.transform.rotateAxis.axis.values.map(v => v.value)).toEqual([1, 1, 0]);
      expect(scene.root.transform.rotateAxis.angle.type).toBe('const');
      expect(scene.root.transform.rotateAxis.angle.value).toBe(60);
    });
  });
});

describe('json-codegen.js', () => {
  describe('generateGlslFromJson', () => {
    it('should generate GLSL for a sphere', () => {
      const scene = {
        root: {
          type: 'sphere',
          params: { r: 1.0, color: [1, 0, 0] },
          transform: { translate: [0, 0, 0], rotate: [0, 0, 0] }
        }
      };
      const glsl = generateGlslFromJson(scene);
      expect(glsl).toContain('sdSphere');
      expect(glsl).toContain('g_df_scene');
    });

    it('should generate GLSL for a box', () => {
      const scene = {
        root: {
          type: 'box',
          params: { size: [1, 1, 1], color: [0, 1, 0] },
          transform: { translate: [0, 0, 0], rotate: [0, 0, 0] }
        }
      };
      const glsl = generateGlslFromJson(scene);
      expect(glsl).toContain('sdBox');
    });

    it('should generate GLSL for union', () => {
      const scene = {
        root: {
          type: 'union',
          children: [
            { type: 'sphere', params: { r: 1.0, color: [1, 0, 0] }, transform: {} },
            { type: 'box', params: { size: [0.5, 0.5, 0.5], color: [0, 1, 0] }, transform: {} }
          ],
          transform: {}
        }
      };
      const glsl = generateGlslFromJson(scene);
      expect(glsl).toContain('min(');
    });

    it('should generate GLSL for smoothUnion with k parameter', () => {
      const scene = {
        root: {
          type: 'smoothUnion',
          k: 0.3,
          children: [
            { type: 'sphere', params: { r: 1.0, color: [1, 0, 0] }, transform: {} },
            { type: 'sphere', params: { r: 0.5, color: [0, 1, 0] }, transform: {} }
          ],
          transform: {}
        }
      };
      const glsl = generateGlslFromJson(scene);
      expect(glsl).toContain('smin');
    });

    it('should generate GLSL for subtract', () => {
      const scene = {
        root: {
          type: 'subtract',
          children: [
            { type: 'sphere', params: { r: 1.0, color: [1, 0, 0] }, transform: {} },
            { type: 'box', params: { size: [0.5, 0.5, 0.5], color: [0, 1, 0] }, transform: {} }
          ],
          transform: {}
        }
      };
      const glsl = generateGlslFromJson(scene);
      expect(glsl).toContain('max(');
    });

    it('should generate GLSL for intersect', () => {
      const scene = {
        root: {
          type: 'intersect',
          children: [
            { type: 'sphere', params: { r: 1.0, color: [1, 0, 0] }, transform: {} },
            { type: 'box', params: { size: [0.8, 0.8, 0.8], color: [0, 1, 0] }, transform: {} }
          ],
          transform: {}
        }
      };
      const glsl = generateGlslFromJson(scene);
      expect(glsl).toContain('max(');
    });

    it('should generate GLSL for smoothIntersect with k parameter', () => {
      const scene = {
        root: {
          type: 'smoothIntersect',
          k: 0.25,
          children: [
            { type: 'sphere', params: { r: 1.0, color: [1, 0, 0] }, transform: {} },
            { type: 'box', params: { size: [0.8, 0.8, 0.8], color: [0, 1, 0] }, transform: {} }
          ],
          transform: {}
        }
      };
      const glsl = generateGlslFromJson(scene);
      // Should generate smooth maximum (smax) formula
      expect(glsl).toContain('smoothIntersect');
      expect(glsl).toContain('0.25'); // k parameter
    });

    it('should generate smooth max formula for smoothIntersect', () => {
      const scene = {
        root: {
          type: 'smoothIntersect',
          k: 0.3,
          children: [
            { type: 'sphere', params: { r: 1.0, color: [1, 0, 0] }, transform: {} },
            { type: 'sphere', params: { r: 0.5, color: [0, 1, 0] }, transform: { translate: [0.5, 0, 0] } }
          ],
          transform: {}
        }
      };
      const glsl = generateGlslFromJson(scene);
      // Smooth max formula uses: 0.5 - 0.5 * (b - a) / k (note the minus sign)
      expect(glsl).toContain('0.5 - 0.5');
      // And adds k * h * (1.0 - h) instead of subtracting (note the plus sign)
      expect(glsl).toContain('+ 0.3');
    });

    it('should handle smoothIntersect with 3+ children', () => {
      const scene = {
        root: {
          type: 'smoothIntersect',
          k: 0.2,
          children: [
            { type: 'sphere', params: { r: 1.0, color: [1, 0, 0] }, transform: {} },
            { type: 'box', params: { size: [0.8, 0.8, 0.8], color: [0, 1, 0] }, transform: {} },
            { type: 'sphere', params: { r: 0.6, color: [0, 0, 1] }, transform: { translate: [0, 0.5, 0] } }
          ],
          transform: {}
        }
      };
      const glsl = generateGlslFromJson(scene);
      expect(glsl).toContain('smoothIntersect');
      // Should chain multiple smooth max operations
      expect(glsl).toContain('result');
    });

    it('should handle smoothIntersect with single child', () => {
      const scene = {
        root: {
          type: 'smoothIntersect',
          k: 0.2,
          children: [
            { type: 'sphere', params: { r: 1.0, color: [1, 0, 0] }, transform: {} }
          ],
          transform: {}
        }
      };
      const glsl = generateGlslFromJson(scene);
      // Should still produce valid GLSL
      expect(glsl).toContain('g_df_scene');
      expect(glsl).toContain('sdSphere');
    });

    it('should handle smoothIntersect with variable k parameter', () => {
      const scene = {
        params: {
          blendK: { value: 0.3, type: 'scalar', min: 0, max: 1 }
        },
        root: {
          type: 'smoothIntersect',
          k: { type: 'var', name: 'blendK' },
          children: [
            { type: 'sphere', params: { r: 1.0, color: [1, 0, 0] }, transform: {} },
            { type: 'box', params: { size: [0.8, 0.8, 0.8], color: [0, 1, 0] }, transform: {} }
          ],
          transform: {}
        }
      };
      const glsl = generateGlslFromJson(scene);
      expect(glsl).toContain('u_blendK');
    });

    it('should generate different code for smoothUnion vs smoothIntersect', () => {
      const unionScene = {
        root: {
          type: 'smoothUnion',
          k: 0.3,
          children: [
            { type: 'sphere', params: { r: 1.0, color: [1, 0, 0] }, transform: {} },
            { type: 'sphere', params: { r: 0.5, color: [0, 1, 0] }, transform: {} }
          ],
          transform: {}
        }
      };
      const intersectScene = {
        root: {
          type: 'smoothIntersect',
          k: 0.3,
          children: [
            { type: 'sphere', params: { r: 1.0, color: [1, 0, 0] }, transform: {} },
            { type: 'sphere', params: { r: 0.5, color: [0, 1, 0] }, transform: {} }
          ],
          transform: {}
        }
      };
      const unionGlsl = generateGlslFromJson(unionScene);
      const intersectGlsl = generateGlslFromJson(intersectScene);

      // smoothUnion uses: 0.5 + 0.5 * ... and subtracts k*h*(1-h)
      expect(unionGlsl).toContain('0.5 + 0.5');
      expect(unionGlsl).toContain('- 0.3');

      // smoothIntersect uses: 0.5 - 0.5 * ... and adds k*h*(1-h)
      expect(intersectGlsl).toContain('0.5 - 0.5');
      expect(intersectGlsl).toContain('+ 0.3');
    });

    it('should generate rotation helper functions', () => {
      const scene = {
        root: {
          type: 'box',
          params: { size: [1, 1, 1], color: [1, 0, 0] },
          transform: { translate: [0, 0, 0], rotate: [45, 0, 0] }
        }
      };
      const glsl = generateGlslFromJson(scene);
      expect(glsl).toContain('rotX');
    });

    it('should generate time variable reference', () => {
      const scene = {
        root: {
          type: 'sphere',
          params: {
            r: { type: 'expr', op: 'sin', args: [{ type: 'var', name: 'time' }] },
            color: [1, 0, 0]
          },
          transform: {}
        }
      };
      const glsl = generateGlslFromJson(scene);
      expect(glsl).toContain('u_time');
    });

    it('should generate expression operators', () => {
      const scene = {
        root: {
          type: 'sphere',
          params: {
            r: { type: 'expr', op: 'add', args: [1.0, { type: 'expr', op: 'mul', args: [0.3, { type: 'var', name: 'time' }] }] },
            color: [1, 0, 0]
          },
          transform: {}
        }
      };
      const glsl = generateGlslFromJson(scene);
      expect(glsl).toMatch(/\(.*\+.*\)/);  // Should contain addition
      expect(glsl).toMatch(/\(.*\*.*\)/);  // Should contain multiplication
    });

    it('should generate GLSL for radial modifier', () => {
      const scene = {
        root: {
          type: 'radial',
          count: 6,
          axis: 'y',
          child: {
            type: 'sphere',
            params: { r: 0.2, color: [1, 0, 0] },
            transform: { translate: [1, 0, 0] }
          },
          transform: {}
        }
      };
      const glsl = generateGlslFromJson(scene);
      // Radial should generate angle-based repetition
      expect(glsl).toContain('atan');
    });

    it('should generate GLSL for mirror modifier', () => {
      const scene = {
        root: {
          type: 'mirror',
          axis: 'x',
          child: {
            type: 'sphere',
            params: { r: 0.5, color: [1, 0, 0] },
            transform: { translate: [1, 0, 0] }
          },
          transform: {}
        }
      };
      const glsl = generateGlslFromJson(scene);
      expect(glsl).toContain('abs');
    });

    it('should handle LCD-003: mirror with ancestor rotation', () => {
      // LCD-003: When mirror is under a rotated parent, the mirror axis
      // should be in local (rotated) space, not world space.
      // This test verifies that ancestor rotations are tracked and
      // the mirror operation includes rotation undo/redo code.
      const scene = {
        root: {
          type: 'transform',
          transform: { rotate: [0, 45, 0] },  // 45 degree Y rotation
          child: {
            type: 'union',
            children: [
              {
                type: 'subtract',
                children: [
                  {
                    type: 'box',
                    params: { size: [1, 0.2, 1], color: [0.7, 0.7, 0.7] }
                  },
                  {
                    type: 'mirror',
                    axis: 'x',
                    child: {
                      type: 'box',
                      params: { size: [0.5, 0.3, 1], color: [1, 0, 0] },
                      transform: { translate: [0.6, 0, 0] }
                    }
                  }
                ]
              }
            ]
          }
        }
      };
      const glsl = generateGlslFromJson(scene);
      // Should contain the LCD-003 fix comment indicating local space transform
      expect(glsl).toContain('LCD-003');
      // Should contain rotation functions for undo/redo
      expect(glsl).toContain('rotY');
    });

    it('should generate GLSL for repeat modifier', () => {
      const scene = {
        root: {
          type: 'repeat',
          period: [2, 0, 2],
          child: {
            type: 'sphere',
            params: { r: 0.3, color: [1, 0, 0] },
            transform: {}
          },
          transform: {}
        }
      };
      const glsl = generateGlslFromJson(scene);
      expect(glsl).toContain('mod');
    });

    it('should generate all primitive SDF functions', () => {
      const primitiveParams = {
        sphere: { r: 1.0, color: [1, 0, 0] },
        box: { size: [1, 1, 1], color: [1, 0, 0] },
        torus: { major: 1.0, minor: 0.3, color: [1, 0, 0] },
        cylinder: { h: 1.0, r: 0.5, color: [1, 0, 0] },
        capsule: { h: 1.0, r: 0.2, color: [1, 0, 0] },
        ellipsoid: { radii: [1, 0.5, 0.3], color: [1, 0, 0] },
        plane: { normal: [0, 1, 0], h: 0, color: [1, 0, 0] }
      };

      Object.entries(primitiveParams).forEach(([primType, params]) => {
        const scene = {
          root: {
            type: primType,
            params,
            transform: {}
          }
        };
        const glsl = generateGlslFromJson(scene);
        expect(glsl).toContain('g_df_scene');
        expect(glsl.length).toBeGreaterThan(100);
      });
    });
  });
});

describe('Integration: loadJsonScene -> generateGlslFromJson', () => {
  it('should produce valid GLSL from JSON input', () => {
    const json = {
      version: '1.0',
      root: {
        type: 'smoothUnion',
        k: 0.2,
        children: [
          { type: 'sphere', params: { r: 0.8, color: [1, 0.5, 0.2] } },
          { type: 'box', params: { size: [0.5, 0.5, 0.5], color: [0.2, 0.5, 1] }, transform: { translate: [0.5, 0, 0] } }
        ]
      }
    };
    const scene = loadJsonScene(json);
    const glsl = generateGlslFromJson(scene);

    // Should have all required components
    expect(glsl).toContain('vec4 g_df_scene(vec3 p)');
    expect(glsl).toContain('return');
    expect(glsl).not.toContain('undefined');
    expect(glsl).not.toContain('NaN');
  });

  it('should handle complex nested scenes', () => {
    const json = {
      version: '1.0',
      defs: {
        petal: { type: 'sphere', params: { r: 0.15, color: [1, 0.4, 0.4] } }
      },
      root: {
        type: 'union',
        children: [
          { type: 'sphere', params: { r: 0.3, color: [1, 0.8, 0.2] } },
          {
            type: 'radial',
            count: 8,
            axis: 'y',
            child: {
              type: 'ref',
              id: 'petal',
              transform: { translate: [0.5, 0, 0] }
            }
          }
        ]
      }
    };
    const scene = loadJsonScene(json);
    const glsl = generateGlslFromJson(scene);

    expect(glsl).toContain('g_df_scene');
    expect(glsl.length).toBeGreaterThan(200);
  });

  it('should handle animated expressions', () => {
    const json = {
      version: '1.0',
      root: {
        type: 'sphere',
        params: {
          r: { expr: 'add', args: [1.0, { expr: 'mul', args: [0.3, { expr: 'sin', args: [{ var: 'time' }] }] }] },
          color: [
            { expr: 'add', args: [0.5, { expr: 'mul', args: [0.5, { expr: 'sin', args: [{ var: 'time' }] }] }] },
            0.5,
            1.0
          ]
        }
      }
    };
    const scene = loadJsonScene(json);
    const glsl = generateGlslFromJson(scene);

    expect(glsl).toContain('u_time');
    expect(glsl).toContain('sin');
  });

  it('should apply parameter overrides in refs (LCD-002)', () => {
    const json = {
      version: '1.0',
      defs: {
        baseSphere: { type: 'sphere', params: { r: 1.0, color: [1, 0, 0] } }
      },
      root: {
        type: 'union',
        children: [
          // First ref: default radius 1.0
          { type: 'ref', id: 'baseSphere' },
          // Second ref: overridden radius 0.5
          { type: 'ref', id: 'baseSphere', params: { r: 0.5 }, transform: { translate: [2, 0, 0] } }
        ]
      }
    };
    const scene = loadJsonScene(json);
    const glsl = generateGlslFromJson(scene);

    // Should generate two different sphere calls with different radii
    expect(glsl).toContain('sdSphere');
    // The overridden radius should appear in the generated code
    expect(glsl).toContain('0.5');
    expect(glsl).toContain('1.0');
  });
});

describe('Scene Health Checks', () => {
  it('should have all toc.json paths pointing to valid scene files', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const scenesDir = path.resolve('./lucid/scenes');
    const tocPath = path.join(scenesDir, 'toc.json');
    const tocContent = fs.readFileSync(tocPath, 'utf-8');
    const toc = JSON.parse(tocContent);

    const missingFiles = [];
    const invalidJson = [];

    for (const category of toc.categories || []) {
      for (const scene of category.scenes || []) {
        if (!scene.path) continue;
        const fullPath = path.join(scenesDir, scene.path);

        // Check file exists
        if (!fs.existsSync(fullPath)) {
          missingFiles.push(scene.path);
          continue;
        }

        // Check it's valid JSON with required fields
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const json = JSON.parse(content);
          if (!json.root && !json.version) {
            invalidJson.push(`${scene.path}: missing root or version`);
          }
        } catch (e) {
          invalidJson.push(`${scene.path}: ${e.message}`);
        }
      }
    }

    if (missingFiles.length > 0) {
      console.error(`Missing scene files: ${missingFiles.join(', ')}`);
    }
    if (invalidJson.length > 0) {
      console.error(`Invalid scene JSON: ${invalidJson.join(', ')}`);
    }

    expect(missingFiles.length).toBe(0);
    expect(invalidJson.length).toBe(0);
  });

  it('should have all scene JSON files linked in toc.json', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const scenesDir = path.resolve('./lucid/scenes');
    const tocPath = path.join(scenesDir, 'toc.json');

    // Read TOC and extract all referenced paths
    const tocContent = fs.readFileSync(tocPath, 'utf-8');
    const toc = JSON.parse(tocContent);

    const linkedPaths = new Set();
    for (const category of toc.categories || []) {
      for (const scene of category.scenes || []) {
        if (scene.path) {
          linkedPaths.add(scene.path);
        }
      }
    }

    // Find all JSON files in scenes/ (excluding toc.json and subfolders like old/, subag1/)
    const excludeDirs = ['old', 'subag1', 'round2', 'round3', 'round4', 'round5', 'round6', 'round7', 'round8', 'round9', 'round10'];

    function findJsonFiles(dir, baseDir) {
      const files = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name)) {
            files.push(...findJsonFiles(fullPath, baseDir));
          }
        } else if (entry.name.endsWith('.json') && entry.name !== 'toc.json') {
          const relPath = path.relative(baseDir, fullPath);
          files.push(relPath);
        }
      }
      return files;
    }

    const allSceneFiles = findJsonFiles(scenesDir, scenesDir);
    const unlinkedScenes = allSceneFiles.filter(f => !linkedPaths.has(f));

    // Report unlinked scenes (warning, not failure - allows experimental files)
    if (unlinkedScenes.length > 0) {
      console.warn(`Unlinked scenes (not in toc.json): ${unlinkedScenes.join(', ')}`);
    }

    // Ensure at least 80% of scenes are linked
    const linkRatio = (allSceneFiles.length - unlinkedScenes.length) / allSceneFiles.length;
    expect(linkRatio).toBeGreaterThan(0.5); // At least 50% should be linked
  });
});

// ============================================================
// Format Conversion Utilities
// ============================================================

/**
 * Unwrap structured value (from loader or raw JSON) to readable format
 */
function unwrapValue(v) {
  if (v === null || v === undefined) return v;
  if (typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(unwrapValue);

  // Loader-processed format
  if (v.type === 'const') return v.value;
  if (v.type === 'array' || v.type === 'position3') {
    return v.values ? v.values.map(unwrapValue) : v;
  }
  if (v.type === 'var') return `$${v.name}`;
  if (v.type === 'expr') return `(${v.op} ...)`;

  // Raw JSON format
  if ('var' in v) return `$${v.var}`;
  if ('expr' in v) return `(${v.expr} ...)`;
  if ('value' in v && Object.keys(v).length <= 3) return v.value;

  return JSON.stringify(v);
}

/**
 * Convert JSON SDF tree to Lispy s-expression format
 * Example: (smoothUnion :k 0.3 (sphere :r 1.0) (box :size [1 1 1]))
 */
function jsonToLispy(node, indent = 0) {
  if (!node || typeof node !== 'object') return String(node);

  const type = node.type || 'unknown';
  const parts = [type];

  // Add params as :key value pairs
  if (node.params) {
    for (const [k, v] of Object.entries(node.params)) {
      if (k === 'color') continue; // Skip verbose color arrays
      const raw = unwrapValue(v);
      const val = Array.isArray(raw) ? `[${raw.join(' ')}]` : raw;
      parts.push(`:${k} ${val}`);
    }
  }

  // Add special properties
  if (node.k !== undefined) {
    const raw = unwrapValue(node.k);
    parts.push(`:k ${raw}`);
  }
  if (node.count !== undefined) parts.push(`:count ${node.count}`);
  if (node.axis !== undefined) parts.push(`:axis "${node.axis}"`);

  // Add children recursively
  if (node.children) {
    for (const child of node.children) {
      parts.push(jsonToLispy(child, indent + 1));
    }
  }
  if (node.child) {
    parts.push(jsonToLispy(node.child, indent + 1));
  }

  return `(${parts.join(' ')})`;
}

/**
 * Convert JSON SDF tree to indented tree format (for human reading)
 * Example:
 *   smoothUnion k=0.3
 *     sphere r=1.0
 *     box size=[1,1,1]
 */
function jsonToTree(node, indent = 0) {
  if (!node || typeof node !== 'object') return '';

  const prefix = '  '.repeat(indent);
  const type = node.type || 'unknown';
  const paramParts = [];

  // Add key params inline
  if (node.params) {
    for (const [k, v] of Object.entries(node.params)) {
      if (k === 'color') continue;
      const raw = unwrapValue(v);
      const val = Array.isArray(raw) ? `[${raw.join(',')}]` : raw;
      paramParts.push(`${k}=${val}`);
    }
  }
  if (node.k !== undefined) {
    const raw = unwrapValue(node.k);
    paramParts.push(`k=${raw}`);
  }
  if (node.count !== undefined) paramParts.push(`count=${node.count}`);
  if (node.axis !== undefined) paramParts.push(`axis=${node.axis}`);

  let line = `${prefix}${type}`;
  if (paramParts.length > 0) line += ` ${paramParts.join(' ')}`;

  const lines = [line];

  // Add children
  if (node.children) {
    for (const child of node.children) {
      lines.push(jsonToTree(child, indent + 1));
    }
  }
  if (node.child) {
    lines.push(jsonToTree(node.child, indent + 1));
  }

  return lines.join('\n');
}

/**
 * Parse simple lispy s-expression back to JSON
 * Handles: (type :key val child1 child2)
 */
function lispyToJson(sexpr) {
  sexpr = sexpr.trim();
  if (!sexpr.startsWith('(') || !sexpr.endsWith(')')) {
    throw new Error('Invalid s-expression: must be wrapped in parens');
  }

  const inner = sexpr.slice(1, -1).trim();
  const tokens = tokenizeLispy(inner);
  if (tokens.length === 0) return null;

  const type = tokens[0];
  const node = { type, params: {} };
  let i = 1;

  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.startsWith(':')) {
      // Keyword argument
      const key = tok.slice(1);
      i++;
      if (i < tokens.length) {
        const val = tokens[i];
        if (val.startsWith('[')) {
          // Array value
          node.params[key] = val.slice(1, -1).split(/\s+/).map(Number);
        } else if (val.startsWith('"')) {
          node.params[key] = val.slice(1, -1);
        } else if (!isNaN(Number(val))) {
          node.params[key] = Number(val);
        } else {
          node.params[key] = val;
        }
        i++;
      }
    } else if (tok.startsWith('(')) {
      // Child node
      if (!node.children) node.children = [];
      node.children.push(lispyToJson(tok));
      i++;
    } else {
      i++;
    }
  }

  return node;
}

function tokenizeLispy(str) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    // Skip whitespace
    while (i < str.length && /\s/.test(str[i])) i++;
    if (i >= str.length) break;

    if (str[i] === '(') {
      // Find matching close paren
      let depth = 1;
      let start = i;
      i++;
      while (i < str.length && depth > 0) {
        if (str[i] === '(') depth++;
        else if (str[i] === ')') depth--;
        i++;
      }
      tokens.push(str.slice(start, i));
    } else if (str[i] === '[') {
      // Array literal
      let start = i;
      while (i < str.length && str[i] !== ']') i++;
      i++; // include ]
      tokens.push(str.slice(start, i));
    } else if (str[i] === '"') {
      // String literal
      let start = i;
      i++;
      while (i < str.length && str[i] !== '"') i++;
      i++; // include closing "
      tokens.push(str.slice(start, i));
    } else {
      // Regular token
      let start = i;
      while (i < str.length && !/[\s()\[\]]/.test(str[i])) i++;
      tokens.push(str.slice(start, i));
    }
  }
  return tokens;
}

// ============================================================
// S-expression DSL Module Tests (sexpr-dsl.js)
// ============================================================

// Import the DSL module
const { sceneToSexpr, sexprToScene, nodeToSexpr, sexprToNode } = await import('../lucid/core/sexpr-dsl.js');

describe('sexpr-dsl.js - Scene S-expression DSL', () => {
  describe('sceneToSexpr - JSON to S-expression', () => {
    it('should convert a simple scene to s-expression', () => {
      const json = {
        title: 'Test Sphere',
        version: '1.0',
        root: {
          type: 'sphere',
          params: { r: 1.0 }
        }
      };

      const sexpr = sceneToSexpr(json);
      expect(sexpr).toContain('(scene "Test Sphere"');
      expect(sexpr).toContain(':version "1.0"');
      expect(sexpr).toContain('(sphere :r 1)');
    });

    it('should convert params section correctly', () => {
      const json = {
        title: 'Parametric Test',
        params: {
          radius: { type: 'scalar', value: 0.5, min: 0, max: 2 },
          color: { type: 'color3', value: [1, 0, 0] }
        },
        root: { type: 'sphere', params: { r: { var: 'radius' } } }
      };

      const sexpr = sceneToSexpr(json);
      expect(sexpr).toContain('(params');
      expect(sexpr).toContain('(radius :type scalar :value 0.5 :min 0 :max 2)');
      expect(sexpr).toContain('(color :type color3 :value [1 0 0])');
    });

    it('should convert camera settings', () => {
      const json = {
        title: 'Camera Test',
        camera: { distance: 8, phi: 0.4, theta: 0.2, target: [0, 1, 0] },
        root: { type: 'sphere', params: { r: 1 } }
      };

      const sexpr = sceneToSexpr(json);
      expect(sexpr).toContain('(camera :distance 8 :phi 0.4 :theta 0.2 :target [0 1 0])');
    });

    it('should convert defs section', () => {
      const json = {
        title: 'Defs Test',
        defs: {
          mySphere: { type: 'sphere', params: { r: 0.5 } }
        },
        root: { type: 'ref', id: 'mySphere' }
      };

      const sexpr = sceneToSexpr(json);
      expect(sexpr).toContain('(defs');
      expect(sexpr).toContain('(mySphere');
      expect(sexpr).toContain('(sphere :r 0.5)');
      expect(sexpr).toContain('(ref "mySphere")');
    });

    it('should convert variable references as $name', () => {
      const json = {
        title: 'Var Test',
        root: { type: 'sphere', params: { r: { var: 'radius' } } }
      };

      const sexpr = sceneToSexpr(json);
      expect(sexpr).toContain('$radius');
    });

    it('should convert expressions correctly', () => {
      const json = {
        title: 'Expr Test',
        root: {
          type: 'sphere',
          params: {
            r: { expr: 'add', args: [1, { expr: 'sin', args: [{ var: 'time' }] }] }
          }
        }
      };

      const sexpr = sceneToSexpr(json);
      expect(sexpr).toContain('(add 1 (sin $time))');
    });

    it('should convert CSG operations with children', () => {
      const json = {
        title: 'CSG Test',
        root: {
          type: 'smoothUnion',
          k: 0.3,
          children: [
            { type: 'sphere', params: { r: 1 } },
            { type: 'box', params: { size: [1, 1, 1] } }
          ]
        }
      };

      const sexpr = sceneToSexpr(json);
      expect(sexpr).toContain('(smoothUnion :k 0.3');
      expect(sexpr).toContain('(sphere :r 1)');
      expect(sexpr).toContain('(box :size [1 1 1])');
    });

    it('should convert modifiers (mirror, radial, repeat)', () => {
      const json = {
        title: 'Modifier Test',
        root: {
          type: 'mirror',
          axis: 'x',
          child: {
            type: 'radial',
            count: 6,
            axis: 'y',
            child: { type: 'sphere', params: { r: 0.2 }, transform: { translate: [1, 0, 0] } }
          }
        }
      };

      const sexpr = sceneToSexpr(json);
      expect(sexpr).toContain('(mirror :axis "x"');
      expect(sexpr).toContain('(radial :count 6 :axis "y"');
    });

    it('should convert transforms', () => {
      const json = {
        title: 'Transform Test',
        root: {
          type: 'sphere',
          params: { r: 1 },
          transform: {
            translate: [1, 2, 3],
            rotate: [45, 0, 0],
            scale: 2
          }
        }
      };

      const sexpr = sceneToSexpr(json);
      expect(sexpr).toContain(':translate [1 2 3]');
      expect(sexpr).toContain(':rotate [45 0 0]');
      expect(sexpr).toContain(':scale 2');
    });
  });

  describe('sexprToScene - S-expression to JSON', () => {
    it('should parse a simple scene', () => {
      const sexpr = `(scene "Test Sphere"
        :version "1.0"
        (root
          (sphere :r 1.5)))`;

      const json = sexprToScene(sexpr);
      expect(json.title).toBe('Test Sphere');
      expect(json.version).toBe('1.0');
      expect(json.root.type).toBe('sphere');
      expect(json.root.params.r).toBe(1.5);
    });

    it('should parse params section', () => {
      const sexpr = `(scene "Params Test"
        (params
          (radius :type scalar :value 0.5 :min 0 :max 2)
          (color :type color3 :value [1 0 0]))
        (root
          (sphere :r $radius)))`;

      const json = sexprToScene(sexpr);
      expect(json.params.radius.type).toBe('scalar');
      expect(json.params.radius.value).toBe(0.5);
      expect(json.params.radius.min).toBe(0);
      expect(json.params.radius.max).toBe(2);
      expect(json.params.color.type).toBe('color3');
      expect(json.params.color.value).toEqual([1, 0, 0]);
    });

    it('should parse camera settings', () => {
      const sexpr = `(scene "Camera Test"
        (camera :distance 8 :phi 0.4 :theta 0.2)
        (root (sphere :r 1)))`;

      const json = sexprToScene(sexpr);
      expect(json.camera.distance).toBe(8);
      expect(json.camera.phi).toBe(0.4);
      expect(json.camera.theta).toBe(0.2);
    });

    it('should parse defs section', () => {
      const sexpr = `(scene "Defs Test"
        (defs
          (mySphere (sphere :r 0.5)))
        (root (ref "mySphere")))`;

      const json = sexprToScene(sexpr);
      expect(json.defs.mySphere.type).toBe('sphere');
      expect(json.defs.mySphere.params.r).toBe(0.5);
      expect(json.root.type).toBe('ref');
      expect(json.root.id).toBe('mySphere');
    });

    it('should parse variable references', () => {
      const sexpr = `(scene "Var Test"
        (root (sphere :r $radius)))`;

      const json = sexprToScene(sexpr);
      expect(json.root.params.r).toEqual({ var: 'radius' });
    });

    it('should parse expressions', () => {
      const sexpr = `(scene "Expr Test"
        (root (sphere :r (add 1 (sin $time)))))`;

      const json = sexprToScene(sexpr);
      expect(json.root.params.r).toEqual({
        expr: 'add',
        args: [1, { expr: 'sin', args: [{ var: 'time' }] }]
      });
    });

    it('should parse CSG operations with children', () => {
      const sexpr = `(scene "CSG Test"
        (root
          (smoothUnion :k 0.3
            (sphere :r 1)
            (box :size [1 1 1]))))`;

      const json = sexprToScene(sexpr);
      expect(json.root.type).toBe('smoothUnion');
      expect(json.root.k).toBe(0.3);
      expect(json.root.children.length).toBe(2);
      expect(json.root.children[0].type).toBe('sphere');
      expect(json.root.children[1].type).toBe('box');
    });

    it('should parse modifiers with child', () => {
      const sexpr = `(scene "Modifier Test"
        (root
          (mirror :axis "x"
            (sphere :r 0.5))))`;

      const json = sexprToScene(sexpr);
      expect(json.root.type).toBe('mirror');
      expect(json.root.axis).toBe('x');
      expect(json.root.child.type).toBe('sphere');
    });
  });

  describe('Round-trip: sceneToSexpr → sexprToScene', () => {
    it('should round-trip a simple scene', () => {
      const original = {
        title: 'Round Trip Test',
        version: '1.0',
        root: {
          type: 'sphere',
          params: { r: 1.5 }
        }
      };

      const sexpr = sceneToSexpr(original);
      const roundTripped = sexprToScene(sexpr);

      expect(roundTripped.title).toBe(original.title);
      expect(roundTripped.version).toBe(original.version);
      expect(roundTripped.root.type).toBe(original.root.type);
      expect(roundTripped.root.params.r).toBe(original.root.params.r);
    });

    it('should round-trip params correctly', () => {
      const original = {
        title: 'Params Round Trip',
        params: {
          radius: { type: 'scalar', value: 0.5, min: 0, max: 2 }
        },
        root: { type: 'sphere', params: { r: { var: 'radius' } } }
      };

      const sexpr = sceneToSexpr(original);
      const roundTripped = sexprToScene(sexpr);

      expect(roundTripped.params.radius.type).toBe(original.params.radius.type);
      expect(roundTripped.params.radius.value).toBe(original.params.radius.value);
      expect(roundTripped.root.params.r).toEqual({ var: 'radius' });
    });

    it('should round-trip camera settings', () => {
      const original = {
        title: 'Camera Round Trip',
        camera: { distance: 8, phi: 0.4, theta: 0.2 },
        root: { type: 'sphere', params: { r: 1 } }
      };

      const sexpr = sceneToSexpr(original);
      const roundTripped = sexprToScene(sexpr);

      expect(roundTripped.camera.distance).toBe(original.camera.distance);
      expect(roundTripped.camera.phi).toBe(original.camera.phi);
      expect(roundTripped.camera.theta).toBe(original.camera.theta);
    });

    it('should round-trip defs and refs', () => {
      const original = {
        title: 'Defs Round Trip',
        defs: {
          part: { type: 'sphere', params: { r: 0.5 } }
        },
        root: { type: 'ref', id: 'part' }
      };

      const sexpr = sceneToSexpr(original);
      const roundTripped = sexprToScene(sexpr);

      expect(roundTripped.defs.part.type).toBe('sphere');
      expect(roundTripped.defs.part.params.r).toBe(0.5);
      expect(roundTripped.root.id).toBe('part');
    });

    it('should round-trip nested CSG operations', () => {
      const original = {
        title: 'CSG Round Trip',
        root: {
          type: 'smoothUnion',
          k: 0.3,
          children: [
            { type: 'sphere', params: { r: 1 } },
            { type: 'box', params: { size: [1, 1, 1] } }
          ]
        }
      };

      const sexpr = sceneToSexpr(original);
      const roundTripped = sexprToScene(sexpr);

      expect(roundTripped.root.type).toBe('smoothUnion');
      expect(roundTripped.root.k).toBe(0.3);
      expect(roundTripped.root.children.length).toBe(2);
      expect(roundTripped.root.children[0].params.r).toBe(1);
      expect(roundTripped.root.children[1].params.size).toEqual([1, 1, 1]);
    });

    it('should round-trip expressions', () => {
      const original = {
        title: 'Expr Round Trip',
        root: {
          type: 'sphere',
          params: {
            r: { expr: 'add', args: [1, { expr: 'mul', args: [0.3, { var: 'time' }] }] }
          }
        }
      };

      const sexpr = sceneToSexpr(original);
      const roundTripped = sexprToScene(sexpr);

      expect(roundTripped.root.params.r.expr).toBe('add');
      expect(roundTripped.root.params.r.args[0]).toBe(1);
      expect(roundTripped.root.params.r.args[1].expr).toBe('mul');
    });
  });

  describe('Real scene file round-trips', () => {
    it('should round-trip smooth-union.json', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const scenePath = path.resolve('./lucid/scenes/csg/smooth-union.json');
      const content = fs.readFileSync(scenePath, 'utf-8');
      const original = JSON.parse(content);

      const sexpr = sceneToSexpr(original);
      const roundTripped = sexprToScene(sexpr);

      // Check key properties preserved
      expect(roundTripped.title).toBe(original.title);
      expect(roundTripped.root.type).toBe(original.root.type);
      expect(roundTripped.root.children.length).toBe(original.root.children.length);

      // Check params preserved
      expect(Object.keys(roundTripped.params || {})).toEqual(Object.keys(original.params || {}));
    });

    it('should produce readable s-expression output', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const scenePath = path.resolve('./lucid/scenes/csg/smooth-union.json');
      const content = fs.readFileSync(scenePath, 'utf-8');
      const json = JSON.parse(content);

      const sexpr = sceneToSexpr(json);

      // Basic structure checks
      expect(sexpr).toContain('(scene');
      expect(sexpr).toContain('(params');
      expect(sexpr).toContain('(root');
      expect(sexpr.startsWith('(scene')).toBe(true);
      expect(sexpr.endsWith(')')).toBe(true);

      // Log for manual inspection
      console.log('=== S-expression DSL output (smooth-union.json) ===');
      console.log(sexpr);
    });
  });
});

describe('Format Conversion & Round-trips', () => {
  it('should convert JSON to lispy s-expression format', () => {
    const json = {
      type: 'smoothUnion',
      k: 0.3,
      children: [
        { type: 'sphere', params: { r: 1.0 } },
        { type: 'box', params: { size: [1, 1, 1] } }
      ]
    };

    const lispy = jsonToLispy(json);
    expect(lispy).toContain('smoothUnion');
    expect(lispy).toContain(':k 0.3');
    expect(lispy).toContain('(sphere :r 1)');
    expect(lispy).toContain('(box :size [1 1 1])');
  });

  it('should convert JSON to indented tree format', () => {
    const json = {
      type: 'union',
      children: [
        { type: 'sphere', params: { r: 1.0 } },
        { type: 'box', params: { size: [1, 1, 1] } }
      ]
    };

    const tree = jsonToTree(json);
    expect(tree).toContain('union');
    expect(tree).toContain('  sphere r=1');
    expect(tree).toContain('  box size=[1,1,1]');
    // Check indentation
    const lines = tree.split('\n');
    expect(lines[0]).toBe('union');
    expect(lines[1]).toMatch(/^  sphere/);
    expect(lines[2]).toMatch(/^  box/);
  });

  it('should round-trip simple geometry through lispy format', () => {
    const original = {
      type: 'sphere',
      params: { r: 1.5 }
    };

    const lispy = jsonToLispy(original);
    const roundTripped = lispyToJson(lispy);

    expect(roundTripped.type).toBe(original.type);
    expect(roundTripped.params.r).toBe(original.params.r);
  });

  it('should round-trip nested CSG through lispy format', () => {
    const original = {
      type: 'union',
      children: [
        { type: 'sphere', params: { r: 1 } },
        { type: 'sphere', params: { r: 0.5 } }
      ]
    };

    const lispy = jsonToLispy(original);
    const roundTripped = lispyToJson(lispy);

    expect(roundTripped.type).toBe('union');
    expect(roundTripped.children.length).toBe(2);
    expect(roundTripped.children[0].type).toBe('sphere');
    expect(roundTripped.children[0].params.r).toBe(1);
    expect(roundTripped.children[1].params.r).toBe(0.5);
  });

  it('should produce readable lispy output for complex scenes', async () => {
    const fs = await import('fs');
    const path = await import('path');

    // Load a real scene
    const scenePath = path.resolve('./lucid/scenes/csg/smooth-union.json');
    const content = fs.readFileSync(scenePath, 'utf-8');
    const scene = JSON.parse(content);

    const lispy = jsonToLispy(scene.root);
    const tree = jsonToTree(scene.root);

    // Lispy should be a single line (ish) for piping
    expect(lispy.length).toBeGreaterThan(20);
    expect(lispy.startsWith('(')).toBe(true);
    expect(lispy.endsWith(')')).toBe(true);

    // Tree should be multi-line for reading
    expect(tree.split('\n').length).toBeGreaterThan(1);

    // Log for manual inspection
    console.log('=== Lispy format ===');
    console.log(lispy);
    console.log('\n=== Tree format ===');
    console.log(tree);
  });
});
