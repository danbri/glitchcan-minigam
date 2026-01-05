# Lucid SDF System - Unit Testing Strategy

**Date:** 2025-11-25
**Target:** Comprehensive testing for DSL parser, IR, GLSL codegen, and node editor
**Framework:** Vitest (recommended) or Jest + Playwright for E2E

---

## Executive Summary

**Current State:** No unit tests exist for Lucid SDF system (only E2E Playwright tests for other minigames)

**Proposed Approach:**
1. **Unit tests** (Vitest) - Parser, IR, GLSL codegen
2. **Component tests** (Vitest + jsdom) - Web Components
3. **Integration tests** (Playwright) - Canvas rendering, WebGL
4. **Visual regression tests** (Playwright) - Rendered output comparison

**Coverage Goals:**
- DSL Parser: **95%+** (critical path)
- GLSL Codegen: **90%+** (deterministic output)
- IR Operations: **95%+** (data integrity)
- Node Editor: **80%+** (UI interactions)

---

## Test Infrastructure Setup

### 1. Install Vitest (Recommended over Jest)

**Why Vitest:**
- ES modules native support
- Faster than Jest
- Vite-compatible (future bundling)
- Better TypeScript support
- Watch mode out of box

```bash
cd /home/user/glitchcan-minigam
npm install --save-dev vitest @vitest/ui jsdom happy-dom
npm install --save-dev @testing-library/dom @testing-library/user-event
```

### 2. Update package.json

```json
{
  "scripts": {
    "test": "playwright test",
    "test:unit": "vitest",
    "test:unit:ui": "vitest --ui",
    "test:unit:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:lucid": "vitest lucid/",
    "test:all": "npm run test:unit && npm run test:e2e"
  }
}
```

### 3. Create vitest.config.js

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./lucid/test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'lucid/test/',
        '**/*.spec.js',
        '**/*.test.js',
      ],
    },
    testMatch: [
      '**/lucid/**/*.test.js',
      '**/lucid/**/*.spec.js',
    ],
  },
});
```

---

## Test Directory Structure

```
lucid/
├── index.html (current monolithic file)
├── ASSESSMENT.md
├── TESTING-STRATEGY.md (this file)
├── test/
│   ├── setup.js                    # Vitest setup/globals
│   ├── fixtures/                   # Test data
│   │   ├── dsl-examples.js        # Sample DSL snippets
│   │   ├── ir-examples.js         # Sample IR nodes
│   │   └── glsl-examples.js       # Expected GLSL output
│   ├── unit/
│   │   ├── parser.test.js         # DSL parser tests
│   │   ├── ir.test.js             # IR structure tests
│   │   ├── glsl-codegen.test.js   # GLSL generation tests
│   │   ├── dsl-writer.test.js     # IR → DSL conversion
│   │   └── sdfgraph.test.js       # Serialization tests
│   ├── component/
│   │   ├── node-editor.test.js    # Node editor component
│   │   ├── glsl-preview.test.js   # DSL editor component
│   │   └── sdf-renderer.test.js   # Renderer component
│   └── integration/
│       ├── render.spec.js         # WebGL rendering (Playwright)
│       ├── dsl-sync.spec.js       # DSL ↔ Graph sync
│       └── visual-regression.spec.js # Screenshot tests
└── core/ (future modular files)
    ├── dsl-parser.js
    ├── dsl-parser.test.js         # Co-located tests
    ├── glsl-codegen.js
    └── glsl-codegen.test.js
```

---

## Test Categories & Examples

### 1. DSL Parser Tests (`parser.test.js`)

**Focus:** Ensure DSL text correctly converts to IR

```javascript
import { describe, it, expect } from 'vitest';
import { parseDslToSceneGraph, normalizeDslText } from '../core/dsl-parser.js';

describe('DSL Parser', () => {
  describe('normalizeDslText', () => {
    it('handles multi-line statements', () => {
      const input = `
        sphere(
          r = 1.0,
          color = [1.0, 0.5, 0.2]
        )
      `;
      const lines = normalizeDslText(input);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('sphere( r = 1.0, color = [1.0, 0.5, 0.2] )');
    });

    it('strips comments', () => {
      const input = `
        # This is a comment
        sphere(r=1.0) // inline comment
      `;
      const lines = normalizeDslText(input);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('sphere(r=1.0)');
    });

    it('handles nested parentheses', () => {
      const input = 'sphere(r=1.0+sin(time*2.0))';
      const lines = normalizeDslText(input);
      expect(lines[0]).toBe(input);
    });
  });

  describe('parseDslToSceneGraph', () => {
    it('parses simple sphere', () => {
      const dsl = 'sphere(r=1.0)';
      const { nodes, errors } = parseDslToSceneGraph(dsl);

      expect(errors).toHaveLength(0);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'sphere',
        outputType: 'DistanceField',
        params: { radius: '1.0' },
      });
    });

    it('parses sphere with all parameters', () => {
      const dsl = `
        s0 = sphere(
          r = 2.5,
          color = [1.0, 0.5, 0.2],
          offset = [0.0, 1.0, 0.0],
          rot = [0.0, 0.5, 0.0]
        )
      `;
      const { nodes, errors } = parseDslToSceneGraph(dsl);

      expect(errors).toHaveLength(0);
      expect(nodes[0]).toMatchObject({
        id: 's0',
        type: 'sphere',
        params: {
          radius: '2.5',
          color: ['1.0', '0.5', '0.2'],
          offset: ['0.0', '1.0', '0.0'],
          rot: ['0.0', '0.5', '0.0'],
        },
      });
    });

    it('parses union operator', () => {
      const dsl = `
        s0 = sphere(r=1.0)
        s1 = sphere(r=0.8)
        out = union(s0, s1)
      `;
      const { nodes, errors } = parseDslToSceneGraph(dsl);

      expect(errors).toHaveLength(0);
      expect(nodes).toHaveLength(3);
      expect(nodes[2]).toMatchObject({
        id: 'out',
        type: 'union',
        inputs: { in1: 's0', in2: 's1' },
        inputOrder: ['s0', 's1'],
      });
    });

    it('parses alias nodes', () => {
      const dsl = `
        s0 = sphere(r=1.0)
        out = s0
      `;
      const { nodes, errors } = parseDslToSceneGraph(dsl);

      expect(errors).toHaveLength(0);
      expect(nodes[1]).toMatchObject({
        id: 'out',
        type: 'alias',
        inputs: { in1: 's0' },
      });
    });

    it('auto-aliases positional params', () => {
      const dsl = 'sphere(r=1.0, color=[1,0,0])';
      const { nodes } = parseDslToSceneGraph(dsl);

      expect(nodes[0].params.arg_1).toBe('1.0');
      expect(nodes[0].params.arg_2).toEqual(['1', '0', '0']);
    });

    it('handles quaternion rotation', () => {
      const dsl = 'box(s=1.0, rotq=quatEuler(0.5, 0.0, 0.0))';
      const { nodes, errors } = parseDslToSceneGraph(dsl);

      expect(errors).toHaveLength(0);
      expect(nodes[0].params.rotq).toBe('quatEuler(0.5, 0.0, 0.0)');
    });

    it('detects duplicate IDs', () => {
      const dsl = `
        s0 = sphere(r=1.0)
        s0 = box(s=1.0)
      `;
      const { errors } = parseDslToSceneGraph(dsl);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Duplicate id 's0'");
    });

    it('handles time-based expressions', () => {
      const dsl = 'sphere(r=1.0+0.5*sin(time))';
      const { nodes } = parseDslToSceneGraph(dsl);

      expect(nodes[0].params.radius).toBe('1.0+0.5*sin(time)');
    });

    it('reports unknown function errors', () => {
      const dsl = 'unknownShape(x=1.0)';
      const { nodes, errors } = parseDslToSceneGraph(dsl);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Unknown function 'unknownShape'");
      expect(nodes).toHaveLength(1); // Still creates placeholder node
    });
  });
});
```

### 2. GLSL Code Generation Tests (`glsl-codegen.test.js`)

**Focus:** Ensure IR correctly generates GLSL

```javascript
import { describe, it, expect } from 'vitest';
import { generateGlslFromSceneGraph } from '../core/glsl-codegen.js';

describe('GLSL Code Generation', () => {
  it('generates sphere function', () => {
    const ir = [{
      id: 's0',
      type: 'sphere',
      outputType: 'DistanceField',
      inputs: {},
      inputOrder: [],
      params: { radius: '1.0' },
      paramOrder: ['radius'],
    }];

    const glsl = generateGlslFromSceneGraph(ir);

    expect(glsl).toContain('vec4 g_sdfn_s0(vec3 p)');
    expect(glsl).toContain('g_sdSphere(q, 1.0)');
    expect(glsl).toContain('sampleGraphScene');
  });

  it('generates union operator', () => {
    const ir = [
      { id: 's0', type: 'sphere', inputs: {}, inputOrder: [], params: { radius: '1.0' }, paramOrder: [] },
      { id: 's1', type: 'sphere', inputs: {}, inputOrder: [], params: { radius: '0.8' }, paramOrder: [] },
      { id: 'out', type: 'union', inputs: { in1: 's0', in2: 's1' }, inputOrder: ['s0', 's1'], params: {}, paramOrder: [] },
    ];

    const glsl = generateGlslFromSceneGraph(ir);

    expect(glsl).toContain('vec4 g_sdfn_out(vec3 p)');
    expect(glsl).toContain('g_sdfn_s0(p)');
    expect(glsl).toContain('g_sdfn_s1(p)');
    expect(glsl).toContain('if (v1.x < best.x) best = v1');
  });

  it('performs topological sort', () => {
    // Define in reverse dependency order
    const ir = [
      { id: 'out', type: 'alias', inputs: { in1: 's0' }, inputOrder: ['s0'], params: {}, paramOrder: [] },
      { id: 's0', type: 'sphere', inputs: {}, inputOrder: [], params: { radius: '1.0' }, paramOrder: [] },
    ];

    const glsl = generateGlslFromSceneGraph(ir);
    const s0Index = glsl.indexOf('g_sdfn_s0');
    const outIndex = glsl.indexOf('g_sdfn_out');

    expect(s0Index).toBeLessThan(outIndex); // s0 defined before out
  });

  it('replaces time with u_time', () => {
    const ir = [{
      id: 's0',
      type: 'sphere',
      inputs: {},
      inputOrder: [],
      params: { radius: '1.0 + 0.5*sin(time)' },
      paramOrder: ['radius'],
    }];

    const glsl = generateGlslFromSceneGraph(ir);

    expect(glsl).toContain('u_time');
    expect(glsl).not.toContain('sin(time)');
  });

  it('handles vec3 color parameters', () => {
    const ir = [{
      id: 's0',
      type: 'sphere',
      inputs: {},
      inputOrder: [],
      params: {
        radius: '1.0',
        color: ['1.0', '0.5', '0.2'],
      },
      paramOrder: ['radius', 'color'],
    }];

    const glsl = generateGlslFromSceneGraph(ir);

    expect(glsl).toContain('vec3 color = clamp(vec3(1.0, 0.5, 0.2)');
  });

  it('handles offset transformation', () => {
    const ir = [{
      id: 's0',
      type: 'sphere',
      inputs: {},
      inputOrder: [],
      params: {
        radius: '1.0',
        offset: ['1.0', '2.0', '3.0'],
      },
      paramOrder: ['radius', 'offset'],
    }];

    const glsl = generateGlslFromSceneGraph(ir);

    expect(glsl).toContain('q -= vec3(1.0, 2.0, 3.0)');
  });

  it('handles rotation transformation', () => {
    const ir = [{
      id: 's0',
      type: 'box',
      inputs: {},
      inputOrder: [],
      params: {
        size: '1.0',
        rot: ['0.5', '0.0', '0.0'],
      },
      paramOrder: ['size', 'rot'],
    }];

    const glsl = generateGlslFromSceneGraph(ir);

    expect(glsl).toContain('g_rotateXYZ(q, vec3(0.5, 0.0, 0.0))');
  });

  it('handles quaternion rotation', () => {
    const ir = [{
      id: 's0',
      type: 'box',
      inputs: {},
      inputOrder: [],
      params: {
        size: '1.0',
        rotq: 'quatEuler(0.5, 0.0, 0.0)',
      },
      paramOrder: ['size', 'rotq'],
    }];

    const glsl = generateGlslFromSceneGraph(ir);

    expect(glsl).toContain('vec4 qrot = quatEuler(0.5, 0.0, 0.0)');
    expect(glsl).toContain('g_qrotate(q, qrot)');
  });

  it('detects cycles and logs error', () => {
    const ir = [
      { id: 's0', type: 'alias', inputs: { in1: 's1' }, inputOrder: ['s1'], params: {}, paramOrder: [] },
      { id: 's1', type: 'alias', inputs: { in1: 's0' }, inputOrder: ['s0'], params: {}, paramOrder: [] },
    ];

    const glsl = generateGlslFromSceneGraph(ir);

    // Should still generate code but mark cycle
    expect(glsl).toContain('WARNING: graph contains cycles');
  });

  it('generates empty scene for no nodes', () => {
    const glsl = generateGlslFromSceneGraph([]);

    expect(glsl).toContain('No nodes');
    expect(glsl).toContain('sampleGraphScene');
  });
});
```

### 3. IR Structure Tests (`ir.test.js`)

**Focus:** Ensure IR maintains data integrity

```javascript
import { describe, it, expect } from 'vitest';

describe('IR Node Structure', () => {
  it('validates sphere node structure', () => {
    const node = {
      id: 's0',
      type: 'sphere',
      outputType: 'DistanceField',
      inputs: {},
      inputOrder: [],
      params: { radius: '1.0' },
      paramOrder: ['radius'],
    };

    expect(node).toHaveProperty('id');
    expect(node).toHaveProperty('type');
    expect(node).toHaveProperty('outputType', 'DistanceField');
    expect(node).toHaveProperty('inputs');
    expect(node).toHaveProperty('inputOrder');
    expect(node).toHaveProperty('params');
    expect(node).toHaveProperty('paramOrder');
  });

  it('validates union node has inputs', () => {
    const node = {
      id: 'u0',
      type: 'union',
      outputType: 'DistanceField',
      inputs: { in1: 's0', in2: 's1' },
      inputOrder: ['s0', 's1'],
      params: {},
      paramOrder: [],
    };

    expect(Object.keys(node.inputs)).toHaveLength(2);
    expect(node.inputOrder).toHaveLength(2);
  });

  it('preserves parameter order', () => {
    const node = {
      id: 's0',
      type: 'sphere',
      outputType: 'DistanceField',
      inputs: {},
      inputOrder: [],
      params: { color: [1, 0, 0], radius: '1.0' }, // params out of order
      paramOrder: ['radius', 'color'], // correct order
    };

    expect(node.paramOrder[0]).toBe('radius');
    expect(node.paramOrder[1]).toBe('color');
  });
});
```

### 4. sdfgraph Serialization Tests (`sdfgraph.test.js`)

**Focus:** Ensure JSON export/import works

```javascript
import { describe, it, expect } from 'vitest';
import { exportSdfGraph, importSdfGraph, validateSdfGraph } from '../core/sdfgraph.js';

describe('sdfgraph Serialization', () => {
  it('exports IR to sdfgraph JSON', () => {
    const ir = [
      {
        id: 's0',
        type: 'sphere',
        outputType: 'DistanceField',
        inputs: {},
        inputOrder: [],
        params: { radius: '1.0' },
        paramOrder: ['radius'],
      },
    ];

    const sdfgraph = exportSdfGraph(ir, { name: 'Test Scene' });

    expect(sdfgraph).toHaveProperty('version');
    expect(sdfgraph).toHaveProperty('metadata');
    expect(sdfgraph).toHaveProperty('nodes');
    expect(sdfgraph.nodes).toHaveLength(1);
    expect(sdfgraph.nodes[0]).toHaveProperty('position');
  });

  it('imports sdfgraph JSON to IR', () => {
    const sdfgraph = {
      version: '1.0.0',
      metadata: { name: 'Test' },
      nodes: [
        {
          id: 's0',
          type: 'sphere',
          position: { x: 100, y: 100 },
          params: { radius: '1.0' },
        },
      ],
      connections: [],
    };

    const ir = importSdfGraph(sdfgraph);

    expect(ir).toHaveLength(1);
    expect(ir[0]).toMatchObject({
      id: 's0',
      type: 'sphere',
      params: { radius: '1.0' },
    });
  });

  it('validates sdfgraph schema', () => {
    const valid = {
      version: '1.0.0',
      metadata: {},
      nodes: [],
      connections: [],
    };

    expect(validateSdfGraph(valid)).toBe(true);

    const invalid = { nodes: [] }; // missing version, metadata
    expect(validateSdfGraph(invalid)).toBe(false);
  });

  it('round-trips IR → sdfgraph → IR', () => {
    const originalIr = [
      {
        id: 's0',
        type: 'sphere',
        outputType: 'DistanceField',
        inputs: {},
        inputOrder: [],
        params: { radius: '1.5' },
        paramOrder: ['radius'],
      },
    ];

    const sdfgraph = exportSdfGraph(originalIr);
    const restoredIr = importSdfGraph(sdfgraph);

    expect(restoredIr).toMatchObject(originalIr);
  });
});
```

### 5. DSL Writer Tests (`dsl-writer.test.js`)

**Focus:** Ensure IR → DSL conversion works (reverse of parser)

```javascript
import { describe, it, expect } from 'vitest';
import { generateDslFromIr } from '../core/dsl-writer.js';

describe('DSL Writer (IR → DSL)', () => {
  it('generates sphere DSL', () => {
    const ir = [{
      id: 's0',
      type: 'sphere',
      params: { radius: '1.0' },
      paramOrder: ['radius'],
    }];

    const dsl = generateDslFromIr(ir);

    expect(dsl).toContain('s0 = sphere(r=1.0)');
  });

  it('generates multi-line formatted DSL', () => {
    const ir = [{
      id: 's0',
      type: 'sphere',
      params: {
        radius: '1.0',
        color: ['1.0', '0.5', '0.2'],
        offset: ['0.0', '1.0', '0.0'],
      },
      paramOrder: ['radius', 'color', 'offset'],
    }];

    const dsl = generateDslFromIr(ir, { multiline: true });

    expect(dsl).toContain('s0 = sphere(');
    expect(dsl).toContain('  r = 1.0,');
    expect(dsl).toContain('  color = [1.0, 0.5, 0.2],');
    expect(dsl).toContain('  offset = [0.0, 1.0, 0.0]');
    expect(dsl).toContain(')');
  });

  it('round-trips DSL → IR → DSL', () => {
    const originalDsl = 'sphere(r=1.0, color=[1.0,0.5,0.2])';
    const ir = parseDslToSceneGraph(originalDsl).nodes;
    const regeneratedDsl = generateDslFromIr(ir);

    // Parse both to compare semantically (formatting may differ)
    const originalIr = parseDslToSceneGraph(originalDsl).nodes;
    const regeneratedIr = parseDslToSceneGraph(regeneratedDsl).nodes;

    expect(regeneratedIr).toMatchObject(originalIr);
  });
});
```

### 6. Component Tests (`node-editor.test.js`)

**Focus:** Test web components in isolation

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/dom';
import '@testing-library/jest-dom';

// Import component definition
import '../components/node-editor.js';

describe('NodeEditorApp Component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders canvas element', () => {
    container.innerHTML = '<node-editor-app></node-editor-app>';
    const editor = container.querySelector('node-editor-app');

    expect(editor).toBeInTheDocument();

    // Check shadow DOM
    const canvas = editor.shadowRoot.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  it('initializes with empty graph', () => {
    container.innerHTML = '<node-editor-app></node-editor-app>';
    const editor = container.querySelector('node-editor-app');

    expect(editor.graph.nodes.size).toBe(0);
    expect(editor.graph.connections.size).toBe(0);
  });

  it('adds node programmatically', () => {
    container.innerHTML = '<node-editor-app></node-editor-app>';
    const editor = container.querySelector('node-editor-app');

    editor.addNode({ type: 'sphere', x: 100, y: 100 });

    expect(editor.graph.nodes.size).toBe(1);
  });

  it('creates connection between nodes', () => {
    container.innerHTML = '<node-editor-app></node-editor-app>';
    const editor = container.querySelector('node-editor-app');

    const node1 = editor.addNode({ type: 'sphere', x: 100, y: 100 });
    const node2 = editor.addNode({ type: 'union', x: 300, y: 100 });
    editor.connect(node1.id, node2.id, 'output', 'in1');

    expect(editor.graph.connections.size).toBe(1);
  });
});
```

### 7. Integration Tests (Playwright)

**Focus:** End-to-end workflows with WebGL

```javascript
// lucid/test/integration/render.spec.js
import { test, expect } from '@playwright/test';

test.describe('Lucid SDF Renderer', () => {
  test('loads default DSL and renders', async ({ page }) => {
    await page.goto('/lucid/index.html');

    // Wait for WebGL canvas
    await expect(page.locator('canvas#canvas')).toBeVisible();

    // Check no console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.waitForTimeout(1000); // Let render loop run
    expect(errors).toHaveLength(0);
  });

  test('DSL editing updates GLSL output', async ({ page }) => {
    await page.goto('/lucid/index.html');

    // Switch to DSL/GLSL tab
    await page.click('text=DSL / GLSL');

    // Clear DSL and enter new code
    const dslTextarea = page.locator('#dsl');
    await dslTextarea.fill('sphere(r=2.0)');

    // Click Render button
    await page.click('#render');

    // Check GLSL output contains new code
    const glslTextarea = page.locator('#glsl');
    const glsl = await glslTextarea.inputValue();
    expect(glsl).toContain('g_sdSphere(q, 2.0)');
  });

  test('scene preset switching works', async ({ page }) => {
    await page.goto('/lucid/index.html');

    // Switch to different preset
    await page.selectOption('#preset', 'ball');

    // Verify rendering updated (check canvas not blank)
    const canvas = page.locator('canvas#canvas');
    const screenshot = await canvas.screenshot();
    expect(screenshot.length).toBeGreaterThan(1000); // Not empty
  });

  test('parameter sliders update rendering', async ({ page }) => {
    await page.goto('/lucid/index.html');

    // Switch to DSL mode with arg_1
    await page.click('text=DSL / GLSL');
    await page.locator('#dsl').fill('sphere(r=1.0+arg_1)');
    await page.click('#render');

    // Switch back to render tab
    await page.click('text=Render');

    // Adjust arg_1 slider
    await page.locator('#arg1').fill('0.5');

    // Should render without errors
    await page.waitForTimeout(500);
  });
});

test.describe('Visual Regression', () => {
  test('default scene matches baseline', async ({ page }) => {
    await page.goto('/lucid/index.html');
    await page.waitForTimeout(1000); // Wait for animation frame

    const canvas = page.locator('canvas#canvas');
    await expect(canvas).toHaveScreenshot('lucid-default.png', {
      maxDiffPixels: 100, // Allow minor rendering differences
    });
  });
});
```

---

## Test Fixtures & Helpers

### DSL Examples (`test/fixtures/dsl-examples.js`)

```javascript
export const DSL_EXAMPLES = {
  simpleSphere: 'sphere(r=1.0)',

  animatedSphere: `
    s0 = sphere(
      r = 1.0 + 0.3*sin(time),
      color = [0.4 + 0.4*sin(time), 0.6, 1.0]
    )
    out = s0
  `,

  twoSpheres: `
    s0 = sphere(r=1.0, offset=[-0.8, 0.0, 0.0], color=[1.0, 0.2, 0.2])
    s1 = sphere(r=0.8, offset=[0.8, 0.0, 0.0], color=[0.2, 0.8, 1.0])
    out = union(s0, s1)
  `,

  boxMinusSphere: `
    b = box(s=[1.3, 0.9, 0.7], color=[0.2, 0.9, 0.4])
    s = sphere(r=0.9)
    out = subtract(b, s)
  `,

  smoothUnion: `
    s0 = sphere(r=1.0, offset=[-0.5, 0.0, 0.0])
    s1 = sphere(r=1.0, offset=[0.5, 0.0, 0.0])
    out = smoothUnion(s0, s1, k=0.5)
  `,

  invalidSyntax: 'sphere(r=)', // Missing value
  unknownType: 'unknownShape(x=1)',
  cyclicDependency: `
    a = union(b)
    b = union(a)
  `,
};
```

### Test Helpers (`test/setup.js`)

```javascript
import { vi } from 'vitest';

// Mock WebGL context for unit tests
global.WebGLRenderingContext = class {
  getExtension() { return null; }
  createShader() { return {}; }
  shaderSource() {}
  compileShader() {}
  getShaderParameter() { return true; }
  createProgram() { return {}; }
  attachShader() {}
  linkProgram() {}
  getProgramParameter() { return true; }
};

// Mock Canvas for component tests
global.HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
  if (type === 'webgl') return new WebGLRenderingContext();
  return null;
});

// Mock performance.now
global.performance = { now: () => Date.now() };
```

---

## Coverage Goals & Metrics

### Critical Path Coverage (95%+)

- DSL parser (`parseDslToSceneGraph`)
- GLSL codegen (`generateGlslFromSceneGraph`)
- IR structure validation
- Topological sort (cycle detection)

### High Priority Coverage (90%+)

- DSL normalization (`normalizeDslText`)
- Parameter parsing (`parseParams`, `parseInputsAndParams`)
- sdfgraph serialization/deserialization
- DSL writer (IR → DSL)

### Medium Priority Coverage (80%+)

- Node editor interactions
- Component lifecycle
- Event handling
- Canvas rendering utilities

### Lower Priority Coverage (60%+)

- UI components (buttons, sliders)
- Debug console
- Visual styling

### Coverage Report Commands

```bash
# Generate coverage report
npm run test:unit:coverage

# View HTML report
open coverage/index.html

# Check coverage thresholds
npx vitest --coverage --coverage.statements=90
```

---

## Testing Best Practices

### 1. Arrange-Act-Assert Pattern

```javascript
it('parses sphere with radius', () => {
  // Arrange
  const dsl = 'sphere(r=1.0)';

  // Act
  const { nodes, errors } = parseDslToSceneGraph(dsl);

  // Assert
  expect(errors).toHaveLength(0);
  expect(nodes[0].params.radius).toBe('1.0');
});
```

### 2. Test Edge Cases

```javascript
describe('Edge Cases', () => {
  it('handles empty DSL', () => {
    const { nodes, errors } = parseDslToSceneGraph('');
    expect(nodes).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('handles whitespace-only DSL', () => {
    const { nodes } = parseDslToSceneGraph('   \n\n  ');
    expect(nodes).toHaveLength(0);
  });

  it('handles very long param arrays', () => {
    const dsl = `sphere(color=[${Array(100).fill('1.0').join(',')}])`;
    const { errors } = parseDslToSceneGraph(dsl);
    expect(errors).toHaveLength(0); // Should not crash
  });
});
```

### 3. Use Descriptive Test Names

❌ Bad:
```javascript
it('works', () => { /* ... */ });
it('test1', () => { /* ... */ });
```

✅ Good:
```javascript
it('parses sphere with radius parameter', () => { /* ... */ });
it('detects circular dependencies and reports error', () => { /* ... */ });
```

### 4. Test One Thing Per Test

❌ Bad:
```javascript
it('parser and codegen work', () => {
  const { nodes } = parseDslToSceneGraph('sphere(r=1.0)');
  const glsl = generateGlslFromSceneGraph(nodes);
  expect(nodes).toHaveLength(1);
  expect(glsl).toContain('g_sdSphere');
});
```

✅ Good:
```javascript
it('parses sphere DSL', () => {
  const { nodes } = parseDslToSceneGraph('sphere(r=1.0)');
  expect(nodes).toHaveLength(1);
});

it('generates GLSL for sphere', () => {
  const ir = [{ id: 's0', type: 'sphere', /* ... */ }];
  const glsl = generateGlslFromSceneGraph(ir);
  expect(glsl).toContain('g_sdSphere');
});
```

### 5. Use Test Data Builders

```javascript
// test/fixtures/builders.js
export function buildSphereNode(overrides = {}) {
  return {
    id: 's0',
    type: 'sphere',
    outputType: 'DistanceField',
    inputs: {},
    inputOrder: [],
    params: { radius: '1.0' },
    paramOrder: ['radius'],
    ...overrides,
  };
}

// Usage in tests
it('generates GLSL for sphere', () => {
  const node = buildSphereNode({ params: { radius: '2.5' } });
  const glsl = generateGlslFromSceneGraph([node]);
  expect(glsl).toContain('g_sdSphere(q, 2.5)');
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/lucid-tests.yml
name: Lucid SDF Tests

on:
  push:
    branches: [main, claude/*]
    paths:
      - 'lucid/**'
      - 'package.json'
      - '.github/workflows/lucid-tests.yml'
  pull_request:
    paths:
      - 'lucid/**'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run unit tests
        run: npm run test:unit

      - name: Generate coverage
        run: npm run test:unit:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: lucid-unit

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Run integration tests
        run: npx playwright test lucid/test/integration/

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-results
          path: test-results/
```

---

## Next Steps

### Phase 1: Setup (Week 1)

1. ✅ Create testing strategy document (this file)
2. ⏳ Install Vitest and dependencies
3. ⏳ Configure vitest.config.js
4. ⏳ Create test directory structure
5. ⏳ Write test fixtures/helpers

### Phase 2: Core Tests (Week 2-3)

1. ⏳ DSL parser tests (30+ test cases)
2. ⏳ GLSL codegen tests (25+ test cases)
3. ⏳ IR structure tests (15+ test cases)
4. ⏳ sdfgraph serialization tests (10+ test cases)

### Phase 3: Component Tests (Week 4)

1. ⏳ Node editor component tests
2. ⏳ DSL editor component tests
3. ⏳ Renderer component tests

### Phase 4: Integration (Week 5)

1. ⏳ Playwright integration tests
2. ⏳ Visual regression baselines
3. ⏳ CI/CD workflow setup

---

## Conclusion

This testing strategy provides:

- **95%+ coverage** for critical DSL parser and GLSL codegen
- **Unit tests** (Vitest) for fast feedback
- **Component tests** for web component isolation
- **Integration tests** (Playwright) for end-to-end workflows
- **Visual regression** tests for rendering consistency

**Key Benefits:**
- Confidence for refactoring to modular architecture
- Fast iteration on node editor features
- Regression prevention for complex DSL parsing
- Documentation via test examples

**Ready to implement:** Start with Phase 1 setup, then incrementally add tests as features are extracted into modules.
