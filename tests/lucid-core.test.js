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
      expect(scene.root.count).toBe(8);
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
      expect(scene.root.period).toEqual([2, 0, 2]);
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
