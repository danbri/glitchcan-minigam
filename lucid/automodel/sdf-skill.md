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

## Scene Parameters (Rigging)

Scene parameters replace magic numbers with named, sliders-adjustable values. Used in 60%+ of demo scenes.

```json
{
  "title": "Parametric Demo",
  "params": {
    "bodyLength": { "value": 12.0, "type": "scalar", "min": 8, "max": 16, "description": "Total body length" },
    "pulseSpeed": { "value": 1.0, "type": "scalar", "min": 0.2, "max": 5.0, "description": "Animation speed" },
    "mainColor": { "value": [0.4, 0.8, 1.0], "type": "color3", "description": "Primary color" }
  },
  "root": {
    "type": "sphere",
    "params": {
      "r": { "var": "bodyLength" },
      "color": { "var": "mainColor" }
    }
  }
}
```

### Parameter Types
| Type | Description | UI Widget | Example Value |
|------|-------------|-----------|---------------|
| `scalar` | Single number | Slider | `1.5` |
| `color3` | RGB 0-1 | Color picker | `[1.0, 0.5, 0.2]` |
| `position3` | XYZ location | 3 sliders | `[0, 1.5, -2]` |
| `radii3` | Ellipsoid axes | 3 sliders (positive) | `[1.8, 1.2, 0.6]` |

### Variable References
Use `{ "var": "paramName" }` to reference scene parameters:
```json
"r": { "var": "sphereRadius" }
```

---

## Expressions (Animation)

Animate any numeric value with math expressions. Used in 52% of demo scenes.

### Two Serialization Formats

Lucid supports **two equivalent expression formats** for different use cases:

#### Explicit JSON Format (Canonical, Stored in Files)
Machine-friendly nested structure. This is what gets saved in `.json` scene files:
```json
{
  "expr": "add",
  "args": [
    0.5,
    { "expr": "mul", "args": [
      0.1,
      { "expr": "sin", "args": [{ "var": "time" }] }
    ]}
  ]
}
```

#### Flat Readable Format (Tree View Display)
Human-friendly function-call syntax. Displayed in Tree view for readability:
```
add(0.5, mul(0.1, sin(time)))
```

#### S-Expression DSL Format (DSL View)
Lisp-style prefix notation, used in DSL view:
```
(add 0.5 (mul 0.1 (sin $time)))
```

**Round-trip:** All three formats represent the same expression tree and can be converted between each other.

### Expression Syntax Reference

| JSON Format | Flat Format | DSL Format |
|-------------|-------------|------------|
| `{ "var": "time" }` | `time` | `$time` |
| `{ "expr": "sin", "args": [x] }` | `sin(x)` | `(sin x)` |
| `{ "expr": "add", "args": [a, b] }` | `add(a, b)` | `(add a b)` |
| `{ "expr": "mul", "args": [a, b, c] }` | `mul(a, b, c)` | `(mul a b c)` |
| `[1.0, 0.5, 0.2]` | `vec3(1.0, 0.5, 0.2)` | `[1 0.5 0.2]` |

### Available Variables
- `{ "var": "time" }` - Elapsed time in seconds
- `{ "var": "x" }`, `{ "var": "y" }`, `{ "var": "z" }` - Current position (in custom GLSL)
- `{ "var": "instanceId" }` - Per-instance ID (when using `exposeId`)
- `{ "var": "paramName" }` - Any scene parameter defined in `params` block

### Available Operations
- **Arithmetic**: `add`, `sub`, `mul`, `div`, `mod`, `neg`
- **Trigonometry**: `sin`, `cos`, `tan`
- **Math**: `abs`, `floor`, `ceil`, `fract`, `min`, `max`, `pow`, `sqrt`
- **Interpolation**: `clamp`, `step`, `smoothstep`, `mix`
- **Noise**: `noise`, `fbm`, `turbulence`, `hash`

### Expression Patterns

Flat format examples (equivalent JSON shown in comments):
```
// Pulsing: add(baseRadius, mul(amplitude, sin(mul(time, speed))))
// JSON: { "expr": "add", "args": [{ "var": "baseRadius" }, { "expr": "mul", "args": [{ "var": "amplitude" }, { "expr": "sin", "args": [{ "expr": "mul", "args": [{ "var": "time" }, { "var": "speed" }] }] }] }] }

// Phase offset: sin(add(mul(time, speed), phase))
// Per-instance random: add(time, hash(instanceId))
// Conditional gate: smoothstep(0.0, 1.0, time)
// Random decision: step(0.6, hash(id))  → 60% true
```

### Expressions in Params (Derived Values)
Combine params with expressions for computed properties:
```json
{
  "params": {
    "bodyLength": { "value": 12.0, "type": "scalar" },
    "flipperRatio": { "value": 0.31, "type": "scalar" }
  },
  "root": {
    "type": "ellipsoid",
    "params": {
      "radii": [
        { "var": "bodyLength" },
        { "expr": "mul", "args": [{ "var": "bodyLength" }, 0.15] },
        { "expr": "mul", "args": [{ "var": "bodyLength" }, { "var": "flipperRatio" }] }
      ]
    }
  }
}
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

## View Formats & Round-Trip

Lucid provides three synchronized views of scene data:

### JSON View (Canonical)
- Primary storage format (`.json` files)
- Explicit expression syntax: `{ "expr": "sin", "args": [...] }`
- Editable - changes update Tree and DSL views

### Tree View (Interactive)
- Collapsible node hierarchy
- Readable expression format: `sin(time)`
- Clickable values open sliders/pickers
- Path-based navigation for keyboard editing

### DSL View (Read-Only)
- S-expression syntax for compact overview
- Variables prefixed with `$`: `$time`, `$bodyLength`
- Future: will be made editable for expert users

### Round-Trip Architecture
```
JSON (storage) ←→ Tree (editing) ←→ DSL (overview)
     ↓                  ↓                ↓
  Explicit          Readable        S-expression
  { "expr":... }    sin(time)       (sin $time)
```

All formats represent the same expression AST. Editing in JSON or Tree view updates the others.

---

## Rigging & Parametric Control

Scene parameters enable rigging - named controls that drive geometry. See `lucid/PARAMETRIC-RIGGING-PLAN.md` for full architecture.

**Benefits:**
- Replace magic numbers with named params
- Enable constraint checking (e.g., flipperSpan/bodyLength = 0.31)
- Live parameter tweaking in UI slider panel
- Goal-blind critics can validate numeric ratios

### Physical Constraints

The `rig.constraints` block defines physical limits and coupled parameter relationships. When a "driver" parameter changes, the UI automatically adjusts "follower" parameters to maintain valid configurations.

**Constraint Types:**

| Type | Purpose | Example |
|------|---------|---------|
| `min/max` | Simple bounds | Elbow cannot hyperextend past 135° |
| `coupled` | Auto-adjust followers | When shoulder > 120°, reduce elbow max |

**Coupled Constraint Format:**

```json
"rig": {
  "constraints": {
    "shoulderElbowCoupling": {
      "type": "coupled",
      "driver": "shoulderAngle",
      "follower": "elbowAngle",
      "rule": "when shoulderAngle > 120, elbowAngle.max = 135 - (shoulderAngle - 120) * 1.5",
      "reason": "Prevent forearm collision with upper arm",
      "severity": "HIGH"
    }
  }
}
```

**Rule Syntax:**
- Pattern: `when DRIVER > THRESHOLD, FOLLOWER.max = EXPRESSION`
- The expression can use arithmetic operators and the driver variable name
- When driver exceeds threshold, follower is clamped to new max

**UI Enforcement:**

The slider panel in `lucid/index.html` enforces constraints in real-time:

1. When user adjusts a slider, `enforceConstraints()` is called
2. Function scans all constraints where this param is the driver
3. For coupled constraints:
   - Parse the rule to extract threshold and expression
   - If driver > threshold, calculate new max for follower
   - If follower.value > newMax, clamp it down
   - Update follower's slider position, displayed value, and max attribute
   - Update renderer with clamped value
4. Console logs constraint activations: `⚙️ Constraint: elbowAngle clamped to 112.50 (max=112.50) due to shoulderAngle=135`

**Example Scene:** `tut/constraints.json` - Robotic arm demonstrating coupled angle constraints.

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
