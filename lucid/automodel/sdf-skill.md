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

### Displace
**Adds noise-based surface texture** - useful for organic detail, rocky surfaces, skin texture.
```json
{
  "type": "displace",
  "amount": 0.15,
  "scale": 5.0,
  "octaves": 3,
  "noiseType": "turbulence",
  "child": { /* shape */ }
}
```
- `amount`: Displacement strength (0.05-0.3 typical)
- `scale`: Noise frequency (1-20, higher = finer detail)
- `octaves`: Detail levels (2-6, more = finer detail but slower)
- `noiseType`: `"noise"` (smooth), `"fbm"` (layered), `"turbulence"` (sharp ridges)
- `animate`: Set `true` for animated noise

**Use cases:**
- Organic skin texture (amount: 0.1, scale: 8, turbulence)
- Rocky asteroid (amount: 0.3, scale: 3, turbulence)
- Subtle surface variation (amount: 0.05, scale: 10, fbm)

## Definitions & References

Define once, reuse many times. Used in 72% of demo scenes.
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

### Defs/Ref vs Symmetry: When to Use Each

**Use Defs/Ref when:**
- Asymmetric placement (table legs at specific positions)
- Parameter variation needed (same shape, different sizes/colors)
- Explicit control over instance positions required
- Non-geometric patterns (placement doesn't follow domain symmetry)

**Use Mirror/Radial/Repeat when:**
- Bilateral symmetry (flipper pairs, eyes, ears) → `mirror`
- Rotational symmetry (flower petals, wheel spokes) → `radial`
- Infinite tiling (fields, grids, particle systems) → `repeat`
- Performance critical - O(1) cost vs O(n) for union

### ExposeId for Per-Instance Variation
```json
{
  "type": "repeat",
  "period": [1.2, 2.0, 1.2],
  "exposeId": "flakeId",
  "child": {
    "type": "sphere",
    "params": {
      "r": { "expr": "add", "args": [
        0.02,
        { "expr": "mul", "args": [{ "expr": "hash", "args": [{ "var": "flakeId" }] }, 0.02] }
      ]}
    }
  }
}
```
- Used in 13% of demos (snowman, flower-meadow, celly)
- `hash(instanceId)` returns 0.0-1.0 pseudo-random per instance

## Expressions (Animation)

Animate any numeric value with math expressions. Used in 52% of demo scenes.
```json
{
  "r": { "expr": "add", "args": [0.5, { "expr": "mul", "args": [0.1, { "expr": "sin", "args": [{ "var": "time" }] }] }] }
}
```

### Available Variables
- `{ "var": "time" }` - Elapsed time in seconds
- `{ "var": "x" }`, `{ "var": "y" }`, `{ "var": "z" }` - Current position
- `{ "var": "instanceId" }` - Per-instance ID (when using `exposeId`)

### Available Operations
- **Arithmetic**: `add`, `sub`, `mul`, `div`, `mod`, `neg`
- **Trigonometry**: `sin`, `cos`, `tan`
- **Math**: `abs`, `floor`, `ceil`, `fract`, `min`, `max`, `pow`, `sqrt`
- **Interpolation**: `clamp`, `step`, `smoothstep`, `mix`
- **Noise**: `noise`, `fbm`, `turbulence`, `hash`

### Expression Patterns
```json
// Speed up time: mul(time, 2.0)
// Phase offset: add(time, 2.1)
// Per-instance offset: add(time, hash(instanceId))
// Conditional gate: smoothstep(0.0, 1.0, time)
// Random decision: step(0.6, hash(id))  → 60% true
```

## Value Semantics (Vec3 Types)

When working with 3-component vectors, understand the semantic type:

| Type | Description | Bounds | Example |
|------|-------------|--------|---------|
| `position3` | XYZ location | unbounded | `"translate": [1.0, 0.5, -2.0]` |
| `radii3` | Ellipsoid axes | positive only | `"radii": [1.8, 1.55, 6.0]` |
| `color3` | RGB color | 0.0-1.0 each | `"color": [0.15, 0.17, 0.22]` |
| `direction3` | Unit vector | normalized | `"normal": [0, 1, 0]` |
| `rotation3` | Euler angles | degrees | `"rotate": [45, 0, 90]` |

**Why this matters:**
- UI can show appropriate widgets (color picker vs sliders)
- Validation can enforce constraints (positive radii, normalized directions)
- Future parametric rigging can track proportions correctly

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

## Known SDF Limitations

### Surface Bumps on Large Bodies
**Problem**: Small spheres added to create bumps on a large body get absorbed or appear as floating disconnected objects.

**Why**:
- `smoothUnion` with ANY k value absorbs small surface features
- Hard `union` preserves geometry but creates disconnected floaters
- No SDF operation creates integrated surface bumps from discrete primitives

**Solution**: Use `displace` modifier with noise instead of adding spheres.
```json
{
  "type": "displace",
  "amount": 0.12,
  "scale": 6.0,
  "noiseType": "turbulence",
  "child": { /* body to add texture to */ }
}
```

## Debugging Tips

1. **Feature not visible?** Increase size 50-100%
2. **Too much blending?** Reduce smoothUnion k-value
3. **Wrong orientation?** Check rotate order (XYZ Euler)
4. **Color not showing?** Ensure material wrapper is outermost
5. **Shapes disappearing?** Check transform positions - may be off-camera
6. **Proportions wrong?** Measure ratios against reference
7. **Surface bumps absorbed?** Use `displace` modifier instead of small spheres

## Future: Scene-Level Parameters (Planned)

Scene parameters will allow named values that expressions can reference:

```json
{
  "params": {
    "bodyLength": { "value": 12.0, "type": "scalar", "min": 8, "max": 16 },
    "bodyRadius": { "value": 1.8, "type": "scalar", "min": 1, "max": 3 },
    "flipperRatio": { "value": 0.31, "type": "scalar", "min": 0.2, "max": 0.4 }
  },
  "root": {
    "type": "ellipsoid",
    "params": {
      "radii": [
        { "var": "bodyRadius" },
        { "expr": "mul", "args": [{ "var": "bodyRadius" }, 0.86] },
        { "expr": "div", "args": [{ "var": "bodyLength" }, 2] }
      ]
    }
  }
}
```

**Benefits:**
- Replace magic numbers with named params
- Enable constraint checking (e.g., flipperSpan/bodyLength = 0.31)
- Live parameter tweaking in UI
- Goal-blind critics can validate numeric ratios

See `lucid/PARAMETRIC-RIGGING-PLAN.md` for implementation details.

## Demo Scene Statistics

Analysis of all 54 demo scenes reveals common patterns:

| Pattern | Usage | Primary Use Case |
|---------|-------|------------------|
| Defs/Ref | 72% | Reusable shapes (legs, arms, invaders) |
| Expressions | 52% | Animation, per-instance variation |
| Mirror | 48% | Bilateral symmetry (creatures, ships) |
| SmoothUnion | 41% | Organic blending (bodies, joints) |
| Ellipsoid | 33% | Organic forms (creatures, whale) |
| Repeat | 26% | Fields, grids, particle systems |
| Radial | 22% | Flowers, starfish, wheel spokes |
| Displace | 15% | Surface texture (skin, rock) |
| ExposeId | 13% | Per-instance randomization |
