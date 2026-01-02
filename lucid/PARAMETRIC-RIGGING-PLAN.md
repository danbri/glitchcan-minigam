# Lucid Parametric Rigging Implementation Plan

## Overview

This document describes the current Lucid SDF system architecture and outlines an implementation plan for adding parametric rigging capabilities, based on guidance from gpt5.2:

> "Lucid already has an expression AST (expr/args + var) and defs/ref + mirror, so adding named params is just extending the existing evaluator environment (currently {time}) to include scene.params and optionally per-ref overrides. Then most 'rigging' is done by rewriting literals in radii/translate/rotate into expressions over those params (e.g. bodyLength, bodyRadius, flipperLen, ratios), and by refactoring repeated geometry into defs and instancing it with ref + mirror for symmetry. If you want constraint-checking, add a lightweight metrics/constraints block evaluated after building node AABBs (min/max per axis) so you can compute ratios like flipperLen/bodyLen and report violations numerically; that gives goal-blind critics something grounded to optimise against without relying on 'looks like X'."

---

## Current Architecture Analysis

### 1. Expression AST System

**Location:** `lucid/core/json-loader.js:210-243`

The expression system is already well-designed with three value types:

```javascript
// Constant number
{ type: 'const', value: 1.8 }

// Variable reference (currently only 'time' in environment)
{ type: 'var', name: 'time' }

// Expression with operation and arguments
{ type: 'expr', op: 'sin', args: [{ type: 'var', name: 'time' }] }

// Array of values
{ type: 'array', values: [...] }
```

**Available Operations** (from `json-codegen.js:1371-1398`):
- Arithmetic: `add`, `sub`, `mul`, `div`, `mod`, `neg`
- Math: `abs`, `floor`, `ceil`, `fract`, `sin`, `cos`, `tan`, `min`, `max`, `pow`, `sqrt`
- Interpolation: `clamp`, `step`, `smoothstep`, `mix`
- Noise: `noise`, `fbm`, `turbulence`, `hash`

**Current Environment:**
- Only `time` variable is available (`json-codegen.js:1350` - adds `u_${value.name}` uniform)
- Local variables supported via `ctx.localVars` (used by `repeat` for instance IDs)

### 2. Defs/Ref System (Define & Use)

**Location:** `lucid/core/json-loader.js:169-182, 290-310`

The system supports defining reusable geometry:

```json
{
  "defs": {
    "leg": { "type": "cylinder", "params": { "r": 0.08, "h": 0.8 } }
  },
  "root": {
    "type": "union",
    "children": [
      { "type": "ref", "id": "leg", "transform": { "translate": [-0.8, 0, 0.4] } },
      { "type": "ref", "id": "leg", "transform": { "translate": [0.8, 0, 0.4] } }
    ]
  }
}
```

**Current Implementation:**
- `defs` are registered in `nodeRegistry.defs` Map
- `ref` nodes store a reference to the processed definition
- **Parameter overrides exist in schema but are TODO** (`json-loader.js:305-307`):
  ```javascript
  if (refNode.overrides) {
    // TODO: Implement parameter override logic
    // For now, just wrap in a material/transform node if needed
  }
  ```

### 3. Symmetry-Based Instancing

**Eclipsed defs/ref for many use cases** via domain modifiers:

#### Mirror (`json-codegen.js:792-831`)
```json
{ "type": "mirror", "axis": "x", "child": { ... } }
```
- Uses `abs(p.x)` to fold space
- O(1) cost regardless of instance count
- Great for bilateral symmetry (flipper pairs, eyes, etc.)

#### Radial (`json-codegen.js:846-907`)
```json
{ "type": "radial", "count": 12, "axis": "y", "child": { ... } }
```
- Uses angular folding with `mod(angle, segment)`
- O(1) cost for any instance count
- Perfect for flowers, starfish, wheel spokes

#### Repeat (`json-codegen.js:914-986`)
```json
{ "type": "repeat", "period": [1.2, 2.0, 1.2], "exposeId": "flakeId", "child": { ... } }
```
- Infinite tiling with `mod(p, period)`
- **Exposes instance ID** for per-instance variation via expressions
- O(1) cost for infinite instances

### 4. Current Type Handling

The tree view UI tracks editable values with types (`index.html:2440`):
```javascript
treeNavState.editableValues = [
  { path, value, paramName, nodeNotes, type: 'number' }  // or 'glsl', 'expr'
]
```

**Gap identified:** No semantic differentiation between vec3 types:
- Geometric vec3 (position, radii) - unbounded, different axis meanings
- Color vec3 (RGB) - bounded 0-1, needs color picker
- Direction vec3 (normals) - unit vector constraint

### 5. Parameter Tweaking Infrastructure

**Live parameter editing** already works (`index.html:2938-3000`):

1. Tree view shows clickable values with path tracking
2. Slider widget appears for numeric values
3. `updateTreeSliderValue()` modifies JSON and re-renders in real-time
4. `setValueByPath()` handles nested path updates

**Critical for rigging:** This infrastructure can be reused for named params.

---

## Defs/Ref vs Symmetry: When to Use Each

### Use Defs/Ref When:
1. **Asymmetric placement** - table legs at specific positions
2. **Parameter variation** - same shape with different sizes/colors
3. **Explicit control** - need predictable instance positions
4. **Non-geometric patterns** - placement doesn't follow domain symmetry

### Use Symmetry When:
1. **Bilateral symmetry** - mirror for pairs (flippers, ears)
2. **Rotational symmetry** - radial for equal angular distribution
3. **Tiling** - repeat for grids/patterns
4. **Performance critical** - O(1) vs O(n) in GLSL

### Whale Model Analysis

The current whale (`lucid/scenes/ablation/whale.json`) uses:
- ✅ **mirror** for flipper pairs and eye pairs
- ✅ **smoothUnion** for organic blending
- ❌ **NO defs/ref** - all geometry is inline
- ❌ **NO params** - 109+ hardcoded literals

---

## Implementation Plan

### Phase 1: Scene-Level Parameters

**Goal:** Extend evaluator environment to include `scene.params`

#### 1.1 JSON Schema Extension
```json
{
  "title": "Humpback Whale",
  "params": {
    "bodyLength": { "value": 12.0, "type": "scalar", "min": 8, "max": 16 },
    "bodyRadius": { "value": 1.8, "type": "scalar", "min": 1, "max": 3 },
    "flipperRatio": { "value": 0.31, "type": "scalar", "min": 0.2, "max": 0.4 },
    "bodyColor": { "value": [0.15, 0.17, 0.22], "type": "color3" },
    "headPos": { "value": [0, 0.12, 6.5], "type": "position3" }
  },
  "root": { ... }
}
```

**Type semantics:**
| Type | Description | UI Widget | Constraints |
|------|-------------|-----------|-------------|
| `scalar` | Single numeric value | Slider | min/max bounds |
| `color3` | RGB color [0-1] | Color picker | 0-1 per component |
| `position3` | XYZ position | 3x sliders | unbounded |
| `radii3` | Ellipsoid axes | 3x sliders | positive only |
| `direction3` | Unit vector | Sphere picker | normalized |

#### 1.2 Loader Extension (`json-loader.js`)

```javascript
export function loadJsonScene(json) {
  // ... existing code ...

  return {
    version: json.version || '1.0',
    root: nodeRegistry.root,
    defs: nodeRegistry.defs,
    params: json.params || {},  // NEW: pass through scene params
    quality: json.quality || 'medium',
    camera: json.camera || null
  };
}
```

#### 1.3 GLSL Codegen Extension (`json-codegen.js`)

```javascript
export function generateGlslFromJson(scene, options = {}) {
  const ctx = {
    uniforms: new Set(),
    functions: [],
    helpers: [],
    helperCounter: 0,
    showCutters: options.showCutters || false,
    localVars: {},
    instanceIdParam: null,
    sceneParams: scene.params || {}  // NEW: scene parameters
  };

  // Generate uniforms for scene params
  for (const [name, param] of Object.entries(scene.params || {})) {
    if (param.type === 'scalar') {
      ctx.uniforms.add(`u_${name}`);
    } else if (param.type === 'color3' || param.type === 'position3' || param.type === 'radii3') {
      ctx.uniforms.add(`u_${name}`);  // Will be vec3
    }
  }
  // ...
}
```

Modify `valueToGlsl()`:
```javascript
function valueToGlsl(value, ctx) {
  // ...
  case 'var':
    // Check scene params first
    if (ctx.sceneParams && ctx.sceneParams[value.name]) {
      const param = ctx.sceneParams[value.name];
      if (param.type === 'scalar') {
        return `u_${value.name}`;
      } else {
        return `u_${value.name}`;  // vec3 types
      }
    }
    // Check local scoped variables
    if (ctx.localVars && ctx.localVars[value.name]) {
      return ctx.localVars[value.name];
    }
    // Fall back to uniform
    ctx.uniforms.add(`u_${value.name}`);
    return `u_${value.name}`;
}
```

#### 1.4 Raymarcher Uniform Binding (`raymarcher.js`)

```javascript
// In render():
for (const [name, param] of Object.entries(this.sceneParams || {})) {
  const loc = gl.getUniformLocation(this.program, `u_${name}`);
  if (param.type === 'scalar') {
    gl.uniform1f(loc, param.value);
  } else if (param.type === 'color3' || param.type === 'position3' || param.type === 'radii3') {
    gl.uniform3f(loc, param.value[0], param.value[1], param.value[2]);
  }
}
```

### Phase 2: Per-Ref Parameter Overrides

**Goal:** Enable `{ "type": "ref", "id": "flipper", "params": { "length": 6.5 } }`

#### 2.1 Complete the TODO in `json-loader.js:305`

```javascript
if (refNode.overrides) {
  // Apply parameter overrides by cloning def and merging params
  const expanded = JSON.parse(JSON.stringify(def));
  if (expanded.params) {
    for (const [key, value] of Object.entries(refNode.overrides)) {
      expanded.params[key] = value;
    }
  }
  return processNode(expanded, registry, depth);
}
```

### Phase 3: Constraint Metrics Block

**Goal:** Compute AABBs and validate geometric ratios

#### 3.1 Schema Extension

```json
{
  "params": { ... },
  "metrics": {
    "totalLength": { "node": "root", "axis": "z", "measure": "span" },
    "flipperSpan": { "node": "root.children[2]", "axis": "x", "measure": "span" }
  },
  "constraints": [
    {
      "name": "flipperRatio",
      "expr": { "expr": "div", "args": [{ "var": "flipperSpan" }, { "var": "totalLength" }] },
      "target": 0.31,
      "tolerance": 0.03,
      "severity": "warning"
    }
  ],
  "root": { ... }
}
```

#### 3.2 AABB Computation (CPU-side)

```javascript
// New file: lucid/core/metrics.js
export function computeMetrics(scene) {
  const aabbs = {};

  function computeNodeAABB(node, transform = identity()) {
    // Recursive AABB computation based on node type
    // Returns { min: [x,y,z], max: [x,y,z] }
  }

  for (const [name, metric] of Object.entries(scene.metrics || {})) {
    const node = getNodeByPath(scene.root, metric.node);
    const aabb = computeNodeAABB(node);

    if (metric.measure === 'span') {
      const axisIdx = { x: 0, y: 1, z: 2 }[metric.axis];
      aabbs[name] = aabb.max[axisIdx] - aabb.min[axisIdx];
    }
  }

  return aabbs;
}

export function validateConstraints(scene, metrics) {
  const violations = [];

  for (const constraint of scene.constraints || []) {
    const env = { ...metrics, ...scene.params };
    const actual = evaluateExpr(constraint.expr, env);
    const error = Math.abs(actual - constraint.target);

    if (error > constraint.tolerance) {
      violations.push({
        name: constraint.name,
        expected: constraint.target,
        actual,
        error,
        severity: constraint.severity
      });
    }
  }

  return violations;
}
```

### Phase 4: UI Parameter Panel

**Goal:** Dedicated parameter editor with typed widgets

#### 4.1 Parameter Panel HTML

```html
<div id="params-panel" class="params-panel">
  <h3>Scene Parameters</h3>
  <div id="params-content"></div>
  <div id="constraints-content"></div>
</div>
```

#### 4.2 Dynamic Widget Generation

```javascript
function generateParamWidgets(params) {
  return Object.entries(params).map(([name, param]) => {
    switch (param.type) {
      case 'scalar':
        return `<div class="param-row">
          <label>${name}</label>
          <input type="range" min="${param.min}" max="${param.max}"
                 value="${param.value}" data-param="${name}">
          <span>${param.value}</span>
        </div>`;
      case 'color3':
        return `<div class="param-row">
          <label>${name}</label>
          <input type="color" value="${rgbToHex(param.value)}" data-param="${name}">
        </div>`;
      // ... other types
    }
  }).join('');
}
```

---

## Example: Parametric Whale

### Before (current whale.json)
```json
{
  "type": "ellipsoid",
  "params": { "radii": [1.8, 1.55, 6.0] },
  "transform": { "translate": [0, 0, 0] }
}
```

### After (parametric)
```json
{
  "params": {
    "bodyRadius": { "value": 1.8, "type": "scalar", "min": 1, "max": 3 },
    "bodyLength": { "value": 12.0, "type": "scalar", "min": 8, "max": 16 },
    "bodyAspect": { "value": 0.86, "type": "scalar", "min": 0.7, "max": 1.0 }
  },
  "root": {
    "type": "ellipsoid",
    "params": {
      "radii": [
        { "var": "bodyRadius" },
        { "expr": "mul", "args": [{ "var": "bodyRadius" }, { "var": "bodyAspect" }] },
        { "expr": "div", "args": [{ "var": "bodyLength" }, 2] }
      ]
    }
  }
}
```

---

## Migration Strategy

1. **Phase 1: Non-breaking** - Add `params` block support, existing scenes unchanged
2. **Phase 2: Gradual** - Refactor whale.json one section at a time
3. **Phase 3: Validation** - Add constraints, run PMAC parliament with metrics
4. **Phase 4: UI** - Parameter panel for live editing

---

## Files to Modify

| File | Changes |
|------|---------|
| `lucid/core/json-loader.js` | Add params passthrough, complete ref overrides TODO |
| `lucid/core/json-codegen.js` | Add sceneParams to context, modify valueToGlsl |
| `lucid/ui/raymarcher.js` | Add sceneParams field, bind param uniforms |
| `lucid/index.html` | Add params panel, typed widgets |
| `lucid/core/metrics.js` | NEW: AABB computation, constraint validation |
| `lucid/automodel/sdf-skill.md` | Document params, metrics, constraints |

---

## Success Criteria

1. ✅ Whale model uses named params instead of magic numbers
2. ✅ Slider adjusts `flipperRatio` with live preview
3. ✅ Constraint checker reports `flipperSpan/bodyLength = 0.31 ± 0.03`
4. ✅ PMAC Agent B can report numeric violations, not just "looks wrong"
5. ✅ No regression in existing demos (params optional)
