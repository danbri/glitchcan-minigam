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

### Phase 5: Rig Layer (Constraint-Based Relationships)

**Goal:** Treat params as constraints, not just knobs. Add a declarative layer that defines what must move together and what must not.

> "The key next step is to treat params as constraints, not just knobs: some should be derived (e.g. flipper length = bodyLength × ratio), some bounded by morphology, and some linked across nodes (phase-locked, monotonic, or conserved)." — GPT synthesis

#### 5.1 Architecture

```
BEFORE:
  params (independent) → expressions → SDF tree → GLSL

AFTER:
  params (constrained) → rig layer → expressions → SDF tree → GLSL
                           ↓
                    relationships:
                    - derived values
                    - bounds enforcement
                    - phase/motion coupling
                    - conserved quantities
```

The rig layer is **species-agnostic** - it provides primitives (chains, phase, bounds) that any creature can use with different topology.

#### 5.2 Schema Extension

```json
{
  "params": {
    "bodyLength": { "value": 12.0, "type": "scalar", "min": 8, "max": 16 },
    "flipperRatio": { "value": 0.31, "type": "scalar", "min": 0.25, "max": 0.35 }
  },
  "rig": {
    "derived": {
      "flipperLength": { "expr": "mul", "args": [{ "var": "bodyLength" }, { "var": "flipperRatio" }] },
      "headLength": { "expr": "mul", "args": [{ "var": "bodyLength" }, 0.22] }
    },
    "bounds": {
      "flipperRatio": { "min": 0.25, "max": 0.35, "reason": "Humpback pectoral fins are 25-35% body length" },
      "bodyAspect": { "min": 0.7, "max": 1.0, "reason": "Cetacean body cross-section constraints" }
    },
    "chains": {
      "spine": {
        "joints": ["head", "torso", "peduncle", "flukes"],
        "type": "sequential",
        "constraints": { "maxBend": 15 }
      },
      "flipper_L": {
        "joints": ["shoulder", "mid", "tip"],
        "type": "sequential",
        "constraints": { "maxBend": 25, "taper": 0.7 }
      }
    },
    "phase": {
      "swimCycle": {
        "driver": { "expr": "mul", "args": [{ "var": "time" }, 1.5] },
        "followers": {
          "flukeAngle": { "amplitude": 20, "phase": 0.0 },
          "peduncleAngle": { "amplitude": 12, "phase": -0.2 },
          "torsoAngle": { "amplitude": 5, "phase": -0.4 }
        }
      }
    },
    "conserved": {
      "volume": { "tolerance": 0.05, "warn": true }
    }
  },
  "root": { ... }
}
```

#### 5.3 Rig Evaluator (`lucid/core/rig-evaluator.js`)

**Purpose:** Evaluate rig relationships before SDF tree processing

```javascript
/**
 * Evaluate rig layer to produce final param values
 * @param {Object} params - Base params from scene
 * @param {Object} rig - Rig definition with derived, bounds, chains, phase
 * @param {number} time - Current time for animation
 * @returns {{ values: Object, violations: Array }}
 */
export function evaluateRig(params, rig, time = 0) {
  const values = {};
  const violations = [];

  // 1. Copy base param values
  for (const [name, param] of Object.entries(params)) {
    values[name] = param.value;
  }

  // 2. Evaluate derived params (topologically sorted)
  if (rig.derived) {
    const sorted = topologicalSort(rig.derived, values);
    for (const name of sorted) {
      values[name] = evaluateExpr(rig.derived[name], values, time);
    }
  }

  // 3. Check bounds constraints
  if (rig.bounds) {
    for (const [name, bound] of Object.entries(rig.bounds)) {
      const val = values[name];
      if (val < bound.min || val > bound.max) {
        violations.push({
          type: 'bounds',
          param: name,
          value: val,
          min: bound.min,
          max: bound.max,
          reason: bound.reason
        });
      }
    }
  }

  // 4. Evaluate phase-coupled animations
  if (rig.phase) {
    for (const [cycleName, cycle] of Object.entries(rig.phase)) {
      const driver = evaluateExpr(cycle.driver, values, time);
      for (const [follower, config] of Object.entries(cycle.followers)) {
        const phase = config.phase || 0;
        const amplitude = config.amplitude || 1;
        values[`${cycleName}_${follower}`] = Math.sin(driver + phase * Math.PI * 2) * amplitude;
      }
    }
  }

  return { values, violations };
}
```

#### 5.4 Integration Points

**json-loader.js:**
```javascript
export function loadJsonScene(json) {
  // ... existing code ...
  return {
    version: json.version || '1.0',
    root: nodeRegistry.root,
    defs: nodeRegistry.defs,
    params: json.params || {},
    rig: json.rig || null,  // NEW: pass through rig definition
    quality: json.quality || 'medium',
    camera: json.camera || null
  };
}
```

**raymarcher.js:**
```javascript
// In render():
if (this.rig) {
  const { values, violations } = evaluateRig(this.sceneParams, this.rig, time);
  // Bind evaluated values as uniforms
  for (const [name, value] of Object.entries(values)) {
    const loc = gl.getUniformLocation(this.program, `u_${name}`);
    if (loc) gl.uniform1f(loc, value);
  }
  // Report violations
  if (violations.length > 0) {
    this.onConstraintViolation?.(violations);
  }
}
```

#### 5.5 UI: Constraint Violations Panel

```html
<div id="rig-violations" class="violations-panel">
  <h4>⚠️ Constraint Violations</h4>
  <ul id="violation-list"></ul>
</div>
```

```javascript
raymarcher.onConstraintViolation = (violations) => {
  const list = document.getElementById('violation-list');
  list.innerHTML = violations.map(v => `
    <li class="violation ${v.type}">
      <strong>${v.param}</strong>: ${v.value.toFixed(3)}
      (expected ${v.min}–${v.max})
      <br><small>${v.reason}</small>
    </li>
  `).join('');
};
```

#### 5.6 Why This Scales

| Feature | What It Enables |
|---------|-----------------|
| **Derived params** | Dimension reduction: control ratios, not absolute values |
| **Bounds** | Morphological validity without hardcoding species rules |
| **Chains** | Skeletal coherence for any articulated creature |
| **Phase coupling** | Coordinated motion without per-node animation code |
| **Conserved quantities** | Volume/mass preservation during deformation |

The rig layer is **declarative and portable** - it doesn't know about SDFs, it just produces param values that the existing expression system consumes.

---

## Migration Strategy

1. **Phase 1: Non-breaking** - Add `params` block support, existing scenes unchanged ✅
2. **Phase 2: Gradual** - Refactor whale.json one section at a time ✅
3. **Phase 3: Validation** - Add constraints, run PMAC parliament with metrics
4. **Phase 4: UI** - Parameter panel for live editing ✅
5. **Phase 5: Rig Layer** - Derived params, bounds, chains, phase coupling (NEW)

---

## Files to Modify

| File | Changes |
|------|---------|
| `lucid/core/json-loader.js` | Add params passthrough, complete ref overrides TODO, pass rig block |
| `lucid/core/json-codegen.js` | Add sceneParams to context, modify valueToGlsl, register derived params |
| `lucid/core/rig-evaluator.js` | NEW: Rig layer evaluation (derived, bounds, phase, chains) |
| `lucid/ui/raymarcher.js` | Add sceneParams field, bind param uniforms, integrate rig evaluator |
| `lucid/index.html` | Add params panel, typed widgets, constraint violations display |
| `lucid/core/metrics.js` | NEW: AABB computation, constraint validation |
| `lucid/automodel/sdf-skill.md` | Document params, rig layer, metrics, constraints |

---

## Success Criteria

1. ✅ Whale model uses named params instead of magic numbers
2. ✅ Slider adjusts `flipperRatio` with live preview
3. ✅ Constraint checker reports `flipperSpan/bodyLength = 0.31 ± 0.03`
4. ✅ PMAC Agent B can report numeric violations, not just "looks wrong"
5. ✅ No regression in existing demos (params optional)
6. ⬜ Derived params computed from rig.derived expressions
7. ⬜ Bounds violations reported in UI with reason text
8. ⬜ Phase-coupled animation produces coordinated motion
9. ⬜ Rig layer is species-agnostic (same code works for dolphin, dragon, etc.)
