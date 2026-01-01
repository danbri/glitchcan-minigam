# SDF Skill Reference - Lucid JSON Format

## Overview
This skill document provides the SDF (Signed Distance Field) primitives and operations available in the Lucid raymarcher for constructing 3D models.

## Primitives

### Ellipsoid
The primary primitive for organic forms.
```json
{
  "type": "ellipsoid",
  "params": { "radii": [x, y, z] },
  "transform": {
    "translate": [x, y, z],
    "rotate": [rx, ry, rz]  // degrees
  }
}
```
- `radii`: Semi-axes lengths in x, y, z directions
- `translate`: Position offset
- `rotate`: Euler angles in degrees

## Boolean Operations

### Union
Combines multiple shapes.
```json
{
  "type": "union",
  "children": [ /* shapes */ ]
}
```

### SmoothUnion
Blended combination with organic transitions.
```json
{
  "type": "smoothUnion",
  "k": 0.3,  // blend radius (0.1-1.0)
  "children": [ /* shapes */ ]
}
```
- `k`: Higher = more blending, lower = sharper transitions
- Typical values: 0.2-0.5 for organic forms, 0.1 for subtle blends

### Subtract
Carves one shape from another.
```json
{
  "type": "subtract",
  "children": [
    { /* shape to keep */ },
    { /* shape to remove */ }
  ]
}
```

### Mirror
Creates bilateral symmetry.
```json
{
  "type": "mirror",
  "axis": "x",  // "x", "y", or "z"
  "child": { /* shape to mirror */ }
}
```

## Materials

### Material Wrapper
Applies color to geometry.
```json
{
  "type": "material",
  "params": { "color": [r, g, b] },  // 0.0-1.0
  "child": { /* geometry */ }
}
```

## Coordinate System
- **X-axis**: Left-right (positive = right)
- **Y-axis**: Up-down (positive = up)
- **Z-axis**: Front-back (positive = forward/nose)

## Common Patterns

### Whale Flipper (3-section compound)
```json
{
  "type": "smoothUnion", "k": 0.3,
  "children": [
    { "type": "ellipsoid", "params": { "radii": [5.0, 0.28, 1.5] },
      "transform": { "translate": [1.8, -0.4, 1.5], "rotate": [20, 28, -15] } },
    { "type": "ellipsoid", "params": { "radii": [4.2, 0.22, 2.0] },
      "transform": { "translate": [5.5, -1.0, 0.0], "rotate": [28, 35, -20] } },
    { "type": "ellipsoid", "params": { "radii": [3.0, 0.16, 1.2] },
      "transform": { "translate": [9.5, -1.8, -1.5], "rotate": [35, 42, -25] } }
  ]
}
```
Key: Z-radii control WIDTH (should be ~1/4 of x-radii for paddle shape)

### Tubercles (bumpy surface detail)
```json
{
  "type": "union",
  "children": [
    { "type": "ellipsoid", "params": { "radii": [0.3, 0.25, 0.25] },
      "transform": { "translate": [x, y, z] } }
    // ... more bumps
  ]
}
```
- Radii ~0.2-0.4 for visible bumps
- Reduce smoothUnion k-value to prevent blending into surface

### Tail Flukes (flat horizontal paddles)
```json
{
  "type": "subtract",
  "children": [
    {
      "type": "mirror", "axis": "x",
      "child": {
        "type": "ellipsoid",
        "params": { "radii": [3.5, 0.15, 0.8] },  // wide, FLAT, moderate depth
        "transform": { "translate": [1.8, 0, -5.5] }
      }
    },
    { "type": "ellipsoid", "params": { "radii": [0.3, 0.2, 0.5] },
      "transform": { "translate": [0, 0, -5.5] } }  // center notch
  ]
}
```

## Humpback Whale Proportions

| Feature | Proportion | Notes |
|---------|-----------|-------|
| Flipper length | 30-33% body | THE defining feature |
| Flipper width | 25-33% of flipper length | Paddle, not stick |
| Tail fluke span | 40% body length | Wide horizontal paddles |
| Tail fluke thickness | <5% of span | Very flat |
| Head tubercles | Radius 0.3-0.5 | Prominent bumps |
| Body length:width | 7:1 to 8:1 | Chunky, not sleek |

## Debugging Tips

1. **Feature not visible?** Increase size 50-100%
2. **Too much blending?** Reduce smoothUnion k-value
3. **Wrong orientation?** Check rotate order (applied x, y, z)
4. **Color not showing?** Ensure material wrapper is outermost
