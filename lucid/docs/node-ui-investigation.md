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
| [Rete.js](https://rete.js.org/) | Vue/React/Vanilla, TypeScript, active | Complex API |
| [Litegraph.js](https://github.com/jagenjo/litegraph.js) | Standalone, WebGL nodes, simple | Less maintained |
| [Flume](https://flume.dev/) | React, type-safe connections | React only |
| [Baklava](https://github.com/newcat/baern) | Vue 3, TypeScript | Vue only |
| [Node-RED](https://nodered.org/) | Mature, huge ecosystem | Server-based, overkill |

## Integration Points

1. **JSON ↔ Graph sync** - bidirectional: edit nodes → update JSON, load JSON → create nodes
2. **Live preview** - render scene on each graph change
3. **Parameter panels** - node properties (radius, color, k-value)
4. **Defs/Refs** - special handling for reusable components

## Minimal MVP

1. Pick Litegraph.js (simplest, no framework deps)
2. Register node types matching Lucid primitives/ops
3. Graph → JSON export
4. JSON → Graph import
5. Wire to existing Mayfly renderer

## Not Yet Implemented

This is investigation only. No code exists yet. Would be a separate project/PR.

## See Also

- `lucid/core/json-codegen.js` - switch statement shows all node types
- `lucid/scenes/*.json` - example scene files
- Blender Geometry Nodes, Houdini - inspiration
