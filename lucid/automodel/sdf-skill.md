# SDF Skill Reference - Lucid JSON Format

## Overview

Lucid is a real-time raymarcher that renders 3D scenes defined in JSON. Scenes are built using SDF (Signed Distance Field) primitives combined with boolean operations, transforms, and materials.

## Scene Structure

```json
{
  "title": "Scene Name",
  "subtitle": "Description",
  "version": "1.0",
  "camera": { "distance": 10, "phi": 0.3, "theta": 0.2, "target": [0, 0, 0] },
  "defs": { /* reusable definitions */ },
  "root": { /* scene graph */ }
}
```

## Coordinate System

- **X-axis**: Left-right (positive = right)
- **Y-axis**: Up-down (positive = up)
- **Z-axis**: Front-back (positive = forward)

## Primitives (7 types)

All primitives support inline `color` param and `transform`.

### Sphere
```json
{ "type": "sphere", "params": { "r": 0.5, "color": [1, 0, 0] } }
```

### Box
```json
{ "type": "box", "params": { "size": [0.3, 0.3, 0.3], "color": [0, 1, 0] } }
```

### Cylinder
```json
{ "type": "cylinder", "params": { "h": 0.5, "r": 0.2, "color": [0, 0, 1] } }
```

### Torus
```json
{ "type": "torus", "params": { "major": 0.4, "minor": 0.1, "color": [1, 1, 0] } }
```

### Capsule
```json
{ "type": "capsule", "params": { "h": 0.4, "r": 0.15, "color": [1, 0.5, 0] } }
```

### Ellipsoid
Primary primitive for organic forms.
```json
{ "type": "ellipsoid", "params": { "radii": [0.5, 0.3, 0.2], "color": [0.8, 0.4, 1] } }
```
- `radii`: Semi-axes lengths [x, y, z]

### Plane
```json
{ "type": "plane", "params": { "normal": [0, 1, 0], "h": 0.5, "color": [0.3, 0.3, 0.3] } }
```

## Boolean Operations

### Union
Combines multiple shapes.
```json
{ "type": "union", "children": [ /* shapes */ ] }
```

### SmoothUnion
Blended combination with organic transitions.
```json
{ "type": "smoothUnion", "k": 0.3, "children": [ /* shapes */ ] }
```
- `k`: Blend radius (0.1-1.0). Higher = more blending.
- Typical: 0.2-0.5 for organic, 0.1 for subtle blends.

### Subtract
Carves second shape from first.
```json
{
  "type": "subtract",
  "children": [
    { /* shape to keep */ },
    { /* shape to remove */ }
  ]
}
```

### Intersect
Keeps only overlapping volume.
```json
{
  "type": "intersect",
  "children": [ /* shapes */ ]
}
```

## Symmetry & Repetition

### Mirror
Creates bilateral symmetry.
```json
{ "type": "mirror", "axis": "x", "child": { /* shape */ } }
```
- `axis`: `"x"`, `"y"`, `"z"`, or combined `"xz"`, `"xy"`, etc.

### Radial
Repeats around an axis.
```json
{ "type": "radial", "count": 6, "axis": "z", "child": { /* shape */ } }
```

### Repeat
Infinite grid repetition.
```json
{ "type": "repeat", "period": [1.0, 0, 1.0], "child": { /* shape */ } }
```
- `period`: Spacing in each axis (0 = no repeat on that axis)

## Transforms

Inline on any node, or wrap with transform node.

### Translate
```json
"transform": { "translate": [x, y, z] }
```

### Rotate (Euler)
```json
"transform": { "rotate": [rx, ry, rz] }  // degrees, XYZ order
```

### Rotate (Axis-Angle)
```json
"transform": { "rotateAxis": { "axis": [1, 1, 0], "angle": 45 } }
```

### Rotate (Quaternion)
```json
"transform": { "rotateQ": [x, y, z, w] }
```

### Transform Node (wrapper)
```json
{
  "type": "transform",
  "transform": { "translate": [1, 0, 0], "rotate": [0, 45, 0] },
  "child": { /* shape */ }
}
```

## Materials

### Material Wrapper
Applies color and emission to geometry.
```json
{
  "type": "material",
  "params": { "color": [r, g, b], "emit": 0.5 },
  "child": { /* geometry */ }
}
```
- `color`: RGB 0.0-1.0
- `emit`: Glow intensity 0.0-1.0 (optional)

## Modifiers

### Round
Softens edges.
```json
{ "type": "round", "r": 0.05, "child": { /* shape */ } }
```

### Shell
Hollows out shapes.
```json
{ "type": "shell", "thickness": 0.03, "child": { /* shape */ } }
```

## Definitions & References

Define once, reuse many times.
```json
{
  "defs": {
    "leg": { "type": "capsule", "params": { "h": 0.5, "r": 0.1 } }
  },
  "root": {
    "type": "union",
    "children": [
      { "type": "ref", "id": "leg", "transform": { "translate": [0.5, 0, 0] } },
      { "type": "ref", "id": "leg", "transform": { "translate": [-0.5, 0, 0] } }
    ]
  }
}
```

## Expressions (Animation)

Animate any numeric value with math expressions.
```json
{
  "r": { "expr": "add", "args": [0.5, { "expr": "mul", "args": [0.1, { "expr": "sin", "args": [{ "var": "time" }] }] }] }
}
```

Available:
- **Variables**: `{ "var": "time" }`
- **Math**: `sin`, `cos`, `add`, `mul`, `sub`, `div`, `abs`, `min`, `max`

## Common Patterns

### Compound Limb (multi-section)
```json
{
  "type": "smoothUnion", "k": 0.25,
  "children": [
    { "type": "ellipsoid", "params": { "radii": [1.0, 0.3, 0.4] }, "transform": { "translate": [0.5, 0, 0] } },
    { "type": "ellipsoid", "params": { "radii": [0.8, 0.25, 0.35] }, "transform": { "translate": [1.5, 0, 0] } },
    { "type": "ellipsoid", "params": { "radii": [0.6, 0.2, 0.3] }, "transform": { "translate": [2.3, 0, 0] } }
  ]
}
```

### Bumpy Surface Detail
```json
{
  "type": "union",
  "children": [
    { "type": "ellipsoid", "params": { "radii": [0.15, 0.12, 0.12] }, "transform": { "translate": [x, y, z] } }
    // ... more bumps with varied radii and positions
  ]
}
```

### Flat Paddle (horizontal surface)
```json
{
  "type": "mirror", "axis": "x",
  "child": {
    "type": "ellipsoid",
    "params": { "radii": [2.0, 0.15, 0.6] },  // wide, FLAT, moderate depth
    "transform": { "translate": [1.0, 0, 0] }
  }
}
```

### Notched Shape (subtract for detail)
```json
{
  "type": "subtract",
  "children": [
    { "type": "ellipsoid", "params": { "radii": [2.0, 0.5, 0.5] } },
    { "type": "ellipsoid", "params": { "radii": [0.3, 0.6, 0.3] }, "transform": { "translate": [0, 0, 0] } }
  ]
}
```

## Debugging Tips

1. **Feature not visible?** Increase size 50-100%
2. **Too much blending?** Reduce smoothUnion k-value
3. **Wrong orientation?** Check rotate order (XYZ Euler)
4. **Color not showing?** Ensure material wrapper is outermost
5. **Shapes disappearing?** Check transform positions - may be off-camera
6. **Proportions wrong?** Measure ratios against reference
