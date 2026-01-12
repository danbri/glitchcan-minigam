# Node-Based UI Investigation

## Current Data Model

Lucid scenes are JSON trees where each node has a `type`. This maps directly to a node-graph UI.

### Node Categories

| Category | Types | Sockets |
|----------|-------|---------|
| **Primitives** | sphere, box, torus, capsule, cylinder, ellipsoid, cone, plane | 0 in, 1 out |
| **CSG Ops** | union, subtract, intersect, smoothUnion, smoothSubtract, smoothIntersect | N in, 1 out |
| **Wrappers** | transform, material, group, mirror, radial, repeat | 1 in, 1 out |
| **Modifiers** | round, shell, displace | 1 in, 1 out |
| **Reference** | ref | 0 in, 1 out (points to def) |

### Example Tree → Graph

```json
{
  "type": "smoothUnion",
  "k": 0.3,
  "children": [
    { "type": "sphere", "r": 1 },
    {
      "type": "transform",
      "translate": [2, 0, 0],
      "child": { "type": "box", "size": [0.5, 0.5, 0.5] }
    }
  ]
}
```

```
┌──────────┐     ┌─────────────┐
│  sphere  │────▶│             │
│  r=1     │     │ smoothUnion │────▶ output
└──────────┘     │   k=0.3     │
                 │             │
┌──────────┐     └──────▲──────┘
│   box    │            │
│ 0.5³     │     ┌──────┴──────┐
└────┬─────┘     │  transform  │
     └──────────▶│  tx=2       │
                 └─────────────┘
```

## Candidate Libraries

| Library | Pros | Cons |
|---------|------|------|
| **Vanilla Canvas** | Zero deps, full control, matches Lucid philosophy | More code |
| [Litegraph.js](https://github.com/jagenjo/litegraph.js) | Standalone, WebGL nodes, simple | Less maintained |
| [Rete.js](https://rete.js.org/) | Vue/React/Vanilla, TypeScript, active | Complex API |

**Preferred: Vanilla Canvas** - no dependencies, just like the rest of Lucid.

## Zero-Dep Implementation Sketch

```javascript
// ~300 lines for basic node graph
class NodeGraph {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nodes = [];
    this.connections = [];
    this.dragging = null;
    this.connecting = null;
    this.setupEvents();
  }

  addNode(type, x, y) {
    const schema = NODE_SCHEMAS[type];
    this.nodes.push({ id: crypto.randomUUID(), type, x, y, ...schema.defaults });
  }

  render() {
    // Draw connections as bezier curves
    // Draw nodes as rounded rects
    // Draw sockets as circles
  }

  toJSON() {
    // Convert graph → Lucid scene JSON
  }

  fromJSON(scene) {
    // Convert Lucid scene JSON → graph
  }
}
```

Core features needed:
- Drag nodes
- Connect sockets (bezier curves)
- Delete nodes/connections
- Property panel (HTML overlay)
- Zoom/pan

## Integration Points

1. **JSON ↔ Graph sync** - bidirectional: edit nodes → update JSON, load JSON → create nodes
2. **Live preview** - render scene on each graph change
3. **Parameter panels** - node properties (radius, color, k-value)
4. **Defs/Refs** - special handling for reusable components

## Minimal MVP

1. Single HTML file with canvas + sidebar
2. NodeGraph class (~300 lines)
3. NODE_SCHEMAS matching Lucid types
4. Graph → JSON export (toJSON)
5. JSON → Graph import (fromJSON)
6. Wire to existing Mayfly renderer via postMessage or import

## Not Yet Implemented

This is investigation only. No code exists yet. Would be a separate project/PR.

## See Also

- `lucid/core/json-codegen.js` - switch statement shows all node types
- `lucid/scenes/*.json` - example scene files
- Blender Geometry Nodes, Houdini - inspiration
