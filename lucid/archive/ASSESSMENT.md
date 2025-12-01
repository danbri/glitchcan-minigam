# Lucid SDF Playground - Codebase Assessment

**Assessment Date:** 2025-11-25
**Target:** SDF Editor and Renderer with Node Graph Abstraction
**Status:** Analysis of existing implementation for node editor development

---

## Executive Summary

The Lucid SDF playground is a **sophisticated, well-architected web-based SDF (Signed Distance Field) editor** with:
- Text-based DSL for defining SDF scenes
- Real-time GLSL code generation
- WebGL raymarching renderer with compositing
- Modular web component architecture
- **Missing:** Visual node graph editor (currently a stub)

**Overall Quality:** High - clean separation of concerns, good parser design, extensible architecture

**Recommendation:** Build node graph editor on existing IR (Intermediate Representation) structure

---

## Architecture Overview

### Component Structure (Web Components)

```
RaymarcherApp (main container)
├── Tab: Render
│   └── SdfRendererApp (WebGL renderer + controls)
├── Tab: DSL/GLSL
│   └── GlslPreviewApp (DSL editor + GLSL output)
├── Tab: Composite
│   └── CompositeEditorApp (compositing expression editor)
├── Tab: Debug
│   └── DebugConsoleApp (event log viewer)
└── Tab: Editor (exp)
    └── NodeEditorApp ⚠️ STUB - needs implementation
```

### Data Flow

```
DSL Text
  ↓ (parseDslToSceneGraph)
Scene Graph IR (array of nodes)
  ↓ (generateGlslFromSceneGraph)
GLSL Fragment Shader Code
  ↓ (WebGL compilation)
Rendered Output
```

### Global State (AppContext)

```javascript
{
  debugLogger: GlobalDebugLogger,
  sceneGraph: [],           // IR nodes (source of truth)
  sceneObjects: [],         // Currently unused
  instances: {
    nodeEditor: null,       // ⚠️ Stub component
    sdfRenderer: null,
    glslPreview: null,
    compositeEditor: null
  }
}
```

---

## DSL Parser Analysis

### Syntax Support

**Primitives:**
- `sphere(r=1.0, color=[r,g,b], offset=[x,y,z], rot=[rx,ry,rz])`
- `box(s=[x,y,z], color=[r,g,b], offset=[x,y,z], rot=[rx,ry,rz])`
- `capsule(a=[x,y,z], b=[x,y,z], r=0.5, ...)`
- `ellipsoid(r=[x,y,z], ...)`
- `plane(n=[x,y,z], d=0.0, ...)`

**Operators:**
- `union(input1, input2, ...)` - Combines shapes
- `subtract(base, cutout, ...)` - CSG subtraction
- `smoothUnion(input1, input2, k=0.2)` - Smooth blend

**Advanced Features:**
- Quaternion rotation: `rotq=quatEuler(rx, ry, rz)`
- Time-based animation: `r = 1.0 + 0.3*sin(time)`
- Named outputs: `out = s0` (alias nodes)
- Parameters: `arg_1`, `arg_2`, `arg_3`, `arg_4` (UI-controllable)

### Parser Architecture

**Two-stage parsing:**

1. **Legacy IR Parser** (`parseDslToSceneGraph`) - **SOURCE OF TRUTH**
   - Converts DSL → scene graph nodes
   - Handles parameter extraction
   - Creates dependency tracking (inputs/outputs)
   - Used for GLSL code generation

2. **Shadow Parser** (`shadowParseDsl`) - **EXPERIMENTAL**
   - AST-only parser
   - Classifies statements: `def`, `assign`, `call`, `ident`
   - **Not connected to codegen pipeline**
   - Future-proofing for advanced features?

### IR Node Structure

```javascript
{
  id: "s0",                    // Unique identifier
  type: "sphere",              // Node type
  outputType: "DistanceField", // Always DistanceField
  inputs: {                    // Input connections
    in1: "otherId",
    in2: "anotherId"
  },
  inputOrder: ["otherId", "anotherId"], // Preserve order
  params: {                    // Node parameters
    radius: "1.0",
    color: ["1.0", "0.5", "0.2"],
    offset: ["0.0", "0.0", "0.0"],
    arg_1: "1.0"               // Auto-aliased from paramOrder
  },
  paramOrder: ["radius", "color", "offset"] // Preserve order
}
```

**Key Insights:**
- Params stored as **strings** (allows GLSL expressions like `sin(time)`)
- Auto-aliasing: first param → `arg_1`, second → `arg_2`, etc.
- Supports both named params and positional inputs
- Circular dependency detection via topological sort

---

## GLSL Code Generation

### Pipeline

```
Scene Graph IR
  ↓
Topological Sort (resolve dependencies)
  ↓
Generate GLSL Functions (one per node)
  ↓
Compose Final Shader
```

### Code Generation Strategy

**Each node becomes a GLSL function:**
```glsl
// Node: s0 = sphere(r=1.0, color=[1.0,0.5,0.2])
vec4 g_sdfn_s0(vec3 p) {
  vec3 q = p;
  q -= vec3(0.0, 0.0, 0.0);      // offset
  q = g_rotateXYZ(q, vec3(0.0)); // rotation
  float d = g_sdSphere(q, 1.0);  // primitive SDF
  vec3 color = clamp(vec3(1.0, 0.5, 0.2), 0.0, 1.0);
  return vec4(d, color);          // distance + color
}
```

**Operators compose functions:**
```glsl
// union(n0, n1)
vec4 g_sdfn_out(vec3 p) {
  vec4 v0 = g_sdfn_n0(p);
  vec4 v1 = g_sdfn_n1(p);
  vec4 best = v0;
  if (v1.x < best.x) best = v1;
  return best;
}
```

**Strengths:**
- Clean function-per-node approach
- Supports GLSL expressions in parameters (`sin(u_time)`)
- Proper dependency ordering
- Quaternion support for complex rotations

**Weaknesses:**
- No optimization/inlining
- Large shaders for complex graphs
- No common subexpression elimination

---

## Renderer Features

### Multi-Layer Compositing

Three render layers:
- `colSurf` - Surface color (first SDF hit)
- `colVol` - Volume accumulation (raymarch density)
- `colUtil` - Utility layer (depth, etc.)

Custom compositing expression (editable):
```glsl
finalColor = mix(colSurf, colVol, 0.4) + 0.2 * colUtil;
```

### Rendering Modes

1. **DSL Graph Render** - User-defined scene graph
2. **Jellies** - Demo: sphere + box smooth union
3. **Volume Shapes** - Tiled primitives (cubes/spheres/capsules)
4. **Bouncing Ball** - Physics demo with squash/stretch

### Advanced Features

- **Edge rendering** - Fresnel-based edge detection for DSL mode
- **Orbit camera** - Automatic rotation around origin
- **Adjustable raymarch** - Steps, step size, max distance
- **Live parameter control** - `arg_1` through `arg_4` sliders
- **Pause rendering** - Performance/debug control
- **Visibility handling** - Auto-pause when tab hidden

---

## Existing Integration Points

### Event System

```javascript
// DSL parameter usage detection
window.dispatchEvent(new CustomEvent("dsl-args-usage", {
  detail: { arg_1: true, arg_2: false, ... }
}));

// Composite expression updates
window.dispatchEvent(new CustomEvent("composite-updated", {
  detail: { expr: "..." }
}));

// Debug logging
window.dispatchEvent(new CustomEvent("debug-log", {
  detail: { message, type, time }
}));
```

### Component Communication

Components access each other via `appContext.instances`:
```javascript
if (appContext.instances.sdfRenderer) {
  appContext.instances.sdfRenderer.rebuildProgramFromSceneGraph();
}
```

---

## Gap Analysis: What's Missing for Node Editor

### 1. Visual Canvas Component ⚠️
**Current:** Empty stub in `NodeEditorApp`
**Needed:**
- Canvas rendering system (HTML5 Canvas or SVG)
- Node rendering (boxes with ports)
- Connection rendering (bezier curves)
- Grid/background rendering

### 2. Node Interaction System ⚠️
**Current:** None
**Needed:**
- Drag-drop node positioning
- Click-drag connection creation
- Node selection/multi-selection
- Context menus for node creation
- Pan/zoom canvas navigation

### 3. Graph Serialization ⚠️
**Current:** IR exists but no export/import
**Needed:**
- **sdfgraph format** (JSON schema)
- Export graph to file/clipboard
- Import graph from file/text
- Version compatibility handling

### 4. Bidirectional Sync ⚠️
**Current:** DSL → IR only
**Needed:**
- IR → DSL conversion (reverse codegen)
- Live sync between text DSL ↔ visual graph
- Conflict resolution strategy
- "Source of truth" mode switching

### 5. Node Type Registry ⚠️
**Current:** Hardcoded in parser
**Needed:**
- Node type definitions (metadata)
- Port definitions (inputs/outputs)
- Default parameter values
- UI hints for parameter editing

### 6. Parameter Editing UI ⚠️
**Current:** Only DSL text editing
**Needed:**
- Per-node property panel
- Type-appropriate widgets (sliders, color pickers)
- Expression editing (for `sin(time)` etc.)
- Preview/validation feedback

### 7. Graph Utilities ⚠️
**Current:** Basic topological sort
**Needed:**
- Layout algorithms (auto-arrange nodes)
- Cycle detection with user feedback
- Subgraph selection/extraction
- Node grouping/commenting

---

## Opportunities & Strengths

### ✅ Strong Foundation

1. **Clean IR Design**
   - Scene graph already supports full features
   - Easy to serialize to JSON
   - Clear input/output model

2. **Modular Architecture**
   - Web components = easy to extend
   - Global state management in place
   - Event-based communication works

3. **Extensible DSL**
   - Shadow parser experiments show forward-thinking
   - String-based params allow GLSL expressions
   - Support for advanced math (quaternions)

4. **Real-time Feedback**
   - Instant GLSL compilation
   - Live preview in renderer
   - Debug console for troubleshooting

### 🎯 Strategic Advantages

1. **Existing Examples in Codebase**
   - `plotgraph/strange_and_norrell.html` uses `vis-network` library
   - Reference for graph visualization patterns
   - Could adapt or use similar approach

2. **Performance Considerations**
   - Shadow DOM isolation prevents CSS conflicts
   - Selective rendering updates possible
   - Web Workers could offload graph layout

3. **Interoperability Potential**
   - **sdfgraph format** could be shared across tools
   - Export to other renderers (Unity, Blender, etc.)
   - Import from other node-based tools

---

## Recommendations

### Phase 1: Core Node Editor (MVP)

**Goal:** Basic visual graph editing with DSL sync

1. **Implement Canvas Rendering**
   - Use HTML5 Canvas for performance
   - Render nodes as rounded rectangles
   - Bezier curves for connections
   - Simple grid background

2. **Add Basic Interactions**
   - Drag to reposition nodes
   - Click ports to create connections
   - Right-click to delete

3. **DSL → Graph Sync**
   - Parse DSL to IR (already works)
   - Layout algorithm to position nodes
   - Render IR as visual graph

4. **Graph → DSL Sync**
   - Convert IR back to DSL text
   - Preserve formatting where possible
   - Update text editor on graph changes

### Phase 2: Enhanced Editing

**Goal:** Professional node editing experience

1. **Node Creation UI**
   - Toolbox/palette of node types
   - Drag from palette to canvas
   - Search/filter node types

2. **Parameter Editing**
   - Click node to show properties panel
   - Type-specific widgets (sliders, colors)
   - Expression editor for complex params

3. **Advanced Interactions**
   - Multi-select (shift+click, box select)
   - Copy/paste subgraphs
   - Undo/redo system
   - Pan/zoom canvas

### Phase 3: sdfgraph Format & Sharing

**Goal:** Interoperability and asset sharing

1. **Define sdfgraph JSON Schema**
   ```json
   {
     "version": "1.0",
     "nodes": [...],
     "connections": [...],
     "metadata": {
       "name": "My SDF Model",
       "author": "...",
       "description": "..."
     }
   }
   ```

2. **Export/Import**
   - Save to `.sdfgraph.json` file
   - Copy to clipboard as JSON
   - Import with validation

3. **Gallery/Library**
   - Preset node graphs (sphere, box, etc.)
   - User-saved favorites
   - Community sharing potential

### Phase 4: Advanced Features

**Goal:** Power-user workflows

1. **Subgraph/Macros**
   - Group nodes into reusable components
   - Parameterize subgraphs
   - Expand/collapse for clarity

2. **Visual Debugging**
   - Highlight active node in graph
   - Show intermediate SDF values
   - Step-through evaluation

3. **Optimization**
   - Detect redundant nodes
   - Suggest optimizations
   - GLSL code inlining options

---

## Technical Considerations

### Canvas vs SVG

**Recommendation: HTML5 Canvas**

| Aspect | Canvas | SVG |
|--------|--------|-----|
| Performance | ✅ Better for many nodes | ⚠️ Slower with >100 elements |
| Interactivity | Manual hit testing needed | ✅ Built-in event handling |
| Rendering | Immediate mode (fast) | Retained mode (DOM overhead) |
| Scaling | Need manual handling | ✅ Vector-based |
| Libraries | Fabric.js, Konva.js | D3.js, vis-network |

**Choice:** Canvas for large graphs, SVG acceptable for small graphs

### Layout Algorithm Options

1. **Force-Directed** (D3.js force simulation)
   - Organic, automatic
   - Can be chaotic for large graphs

2. **Hierarchical/Layered** (Sugiyama)
   - Clean left-to-right flow
   - Good for DAGs (directed acyclic graphs)

3. **Manual with Snap-to-Grid**
   - User control
   - Clean alignment
   - **Recommended for MVP**

### State Management

**Current:** Global `appContext.sceneGraph`
**Proposed:** Add graph-specific state
```javascript
appContext.graphEditor = {
  nodes: Map<id, {ir, x, y, width, height}>,
  connections: Map<id, {from, to, fromPort, toPort}>,
  selection: Set<id>,
  viewport: {x, y, zoom},
  history: [] // For undo/redo
}
```

---

## File Structure Proposal

### Option A: Single File (Current Approach)
```
lucid/
└── index.html (expand NodeEditorApp inline)
```
**Pros:** Simple deployment, no module loading
**Cons:** File already 2200+ lines, will become unwieldy

### Option B: Modular ES6 (Recommended)
```
lucid/
├── index.html (import modules)
├── core/
│   ├── sdfgraph.js          # Graph data structure + serialization
│   ├── dsl-parser.js        # Extract from index.html
│   ├── glsl-codegen.js      # Extract from index.html
│   └── dsl-writer.js        # NEW: IR → DSL conversion
├── components/
│   ├── node-canvas.js       # Canvas rendering logic
│   ├── node-editor.js       # NodeEditorApp component
│   ├── node-palette.js      # Node creation UI
│   └── property-panel.js    # Parameter editing UI
├── utils/
│   ├── layout.js            # Graph layout algorithms
│   ├── interactions.js      # Drag/zoom/select handlers
│   └── node-registry.js     # Node type definitions
└── examples/
    ├── blob.sdfgraph.json
    ├── two-spheres.sdfgraph.json
    └── box-minus-sphere.sdfgraph.json
```

### Option C: Hybrid
```
lucid/
├── index.html               # Monolithic version
├── index-modular.html       # Modular version
└── lib/ (shared modules)
```
**Pros:** Keep working version, experiment safely
**Cons:** Maintenance overhead

**Recommendation: Option B (Modular)** - Better long-term maintainability

---

## sdfgraph Format Specification (Draft)

```json
{
  "version": "1.0.0",
  "metadata": {
    "name": "Animated Blob",
    "description": "Sphere with sine wave animation",
    "author": "user",
    "created": "2025-11-25T00:00:00Z",
    "modified": "2025-11-25T00:00:00Z",
    "tags": ["animation", "sphere"]
  },
  "nodes": [
    {
      "id": "s0",
      "type": "sphere",
      "position": {"x": 100, "y": 100},
      "params": {
        "radius": "1.0 + 0.3*sin(time)",
        "color": ["0.4 + 0.4*sin(time)", "0.6", "1.0"],
        "offset": ["0.0", "0.3*sin(time*0.7)", "0.0"]
      }
    },
    {
      "id": "out",
      "type": "alias",
      "position": {"x": 300, "y": 100},
      "inputs": ["s0"]
    }
  ],
  "connections": [
    {
      "id": "conn1",
      "from": "s0",
      "to": "out",
      "fromPort": "output",
      "toPort": "in1"
    }
  ],
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1.0
  }
}
```

**Key Features:**
- Extends IR with visual layout (`position`)
- Preserves all DSL functionality
- Human-readable JSON
- Versioned for compatibility
- Metadata for organization

---

## Risk Assessment

### Low Risk
- ✅ IR structure is solid foundation
- ✅ GLSL codegen well-tested
- ✅ Web component architecture proven
- ✅ Existing DSL parser handles edge cases

### Medium Risk
- ⚠️ Canvas performance with 100+ nodes
  - **Mitigation:** Viewport culling, level-of-detail
- ⚠️ DSL ↔ Graph sync conflicts
  - **Mitigation:** "Source of truth" mode toggle
- ⚠️ Complex graph layouts (cycles, clutter)
  - **Mitigation:** Auto-layout + manual override

### High Risk
- 🔴 Breaking changes to IR structure
  - **Mitigation:** Maintain backward compatibility
- 🔴 Scope creep (too many features)
  - **Mitigation:** Phased rollout, MVP first

---

## Next Steps

### Immediate Actions

1. **Decision Required:** Choose file structure (Option A/B/C)
2. **Prototype Canvas:** Simple node + connection rendering
3. **Test IR → DSL:** Verify round-trip conversion works
4. **Define Node Registry:** Extract node types from parser

### Week 1 Goals

- [ ] Basic canvas with draggable nodes
- [ ] Render existing DSL as visual graph
- [ ] Click node to highlight in DSL text

### Month 1 Goals

- [ ] Full DSL ↔ Graph sync
- [ ] Node creation UI
- [ ] Parameter editing panel
- [ ] Export/import sdfgraph format

---

## Conclusion

The Lucid SDF playground has an **excellent foundation** for adding a node graph editor:
- Clean IR that maps naturally to visual nodes
- Modular component architecture ready for extension
- Real-time rendering pipeline already works

**The missing piece is purely the visual editing layer** - the core graph abstraction already exists in the IR.

**Recommended approach:** Build the node editor as a **visual view** over the existing IR, with bidirectional sync to the DSL text. This preserves the power-user text workflow while adding visual editing for accessibility.

**sdfgraph format** should be a simple JSON serialization of the IR + visual layout metadata, making it easy to share models across tools.

---

**Assessment completed:** Ready for node editor implementation planning.
