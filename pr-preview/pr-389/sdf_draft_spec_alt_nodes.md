# SDF JSON Representation — Specification v1.0

This document defines a **pure JSON** format for Signed Distance Field (SDF) / Constructive Solid Geometry (CSG) scenes, including primitives, transforms, groups, materials, templates, and animation expressions.

Everything is valid JSON. No functions. No JS execution. All animation uses symbolic expressions.

---

# 1. Node Model

Every element in the scene is a **node**:

```json
{
  "type": "string",
  "...": "type-specific fields"
}
```

Rules:

- `type` is required.
- Unknown fields must be ignored (forward-compatible).
- Nodes with multiple children use `"children": [...]`.
- Wrapper nodes use `"child": {...}`.
- Any numeric value (scalar or vector component) may be a constant or an **expression object** (see §7).

---

# 2. Primitive SDF Nodes

## 2.1 Sphere

```json
{
  "type": "sphere",
  "params": {
    "r": 1.0
  }
}
```

## 2.2 Box

```json
{
  "type": "box",
  "params": {
    "size": [1, 1, 1]
  }
}
```

## 2.3 Torus

```json
{
  "type": "torus",
  "params": {
    "major": 1.0,
    "minor": 0.3
  }
}
```

## 2.4 Cylinder

```json
{
  "type": "cylinder",
  "params": {
    "h": 2.0,
    "r": 0.5
  }
}
```

## 2.5 Capsule

```json
{
  "type": "capsule",
  "params": {
    "a": [0, 0, 0],
    "b": [0, 1, 0],
    "r": 0.2
  }
}
```

## 2.6 Ellipsoid

```json
{
  "type": "ellipsoid",
  "params": {
    "r": [1, 0.6, 0.3]
  }
}
```

## 2.7 Plane

```json
{
  "type": "plane",
  "params": {
    "normal": [0, 1, 0],
    "offset": 0.0
  }
}
```

---

# 3. CSG Nodes

## 3.1 Union

```json
{
  "type": "union",
  "children": [ ...nodes... ]
}
```

## 3.2 Subtract

```json
{
  "type": "subtract",
  "children": [ baseNode, subtractor1, subtractor2 ]
}
```

## 3.3 Intersect

```json
{
  "type": "intersect",
  "children": [ ...nodes... ]
}
```

## 3.4 Smooth Union / Smooth Subtract / Smooth Intersect

Example:

```json
{
  "type": "smoothUnion",
  "k": 0.2,
  "children": [ ... ]
}
```

`smoothSubtract` and `smoothIntersect` are identical except for `type`.

---

# 4. Transform Node

Transform nodes wrap a **single** child:

```json
{
  "type": "transform",
  "transform": {
    "translate": [0, 1, 0],
    "rotate": [0, 1.57, 0],
    "scale": [1, 2, 1],
    "mat4": null
  },
  "child": { ...node... }
}
```

Notes:

- `translate`, `rotate`, and `scale` accept constants or expressions.
- If `mat4` is present (array of 16 floats), it overrides the others.

---

# 5. Group Node

```json
{
  "type": "group",
  "children": [ ...nodes... ],
  "transform": {
    // optional, same schema as transform node
  }
}
```

---

# 6. Material Node

Materials wrap a single child:

```json
{
  "type": "material",
  "params": {
    "color": [0.8, 0.2, 0.1],
    "emit": 0.0,
    "metallic": 0.0,
    "roughness": 0.5
  },
  "child": { ...node... }
}
```

All params are optional.

---

# 7. Animation Expressions

Any number or vector component may be replaced with an **expression object**.

## 7.1 Constant
A plain number:

```json
1.0
```

## 7.2 Variable

```json
{ "var": "time" }
```

Variables are supplied externally.

## 7.3 Expression

```json
{
  "expr": "mul",
  "args": [
    { "var": "time" },
    0.5
  ]
}
```

## 7.4 Supported ops

```
var, const
add, sub, mul, div
sin, cos, tan
min, max
neg
clamp
smoothstep
```

Nested expressions allowed.

---

# 8. Prefabs / Templates

## 8.1 Top-level definitions

```json
{
  "defs": {
    "invader": { ...node... },
    "wing": { ...node... }
  },
  "root": { ...node... }
}
```

## 8.2 Reference node

```json
{
  "type": "ref",
  "id": "invader",
  "params": {
    // optional overrides
  }
}
```

---

# 9. Full Example: Animated Invader

```json
{
  "version": "1.0",

  "defs": {
    "invader": {
      "type": "subtract",
      "children": [
        {
          "type": "box",
          "params": { "size": [0.5, 0.4, 0.3] }
        },
        {
          "type": "sphere",
          "params": { "r": 0.1 },
          "transform": {
            "translate": [-0.12, 0.08, 0.2]
          }
        },
        {
          "type": "sphere",
          "params": { "r": 0.1 },
          "transform": {
            "translate": [0.12, 0.08, 0.2]
          }
        }
      ]
    }
  },

  "root": {
    "type": "transform",
    "transform": {
      "translate": [
        {
          "expr": "add",
          "args": [
            -1.5,
            {
              "expr": "mul",
              "args": [ { "var": "time" }, 0.2 ]
            }
          ]
        },
        0,
        0
      ],
      "rotate": [0, { "var": "time" }, 0]
    },
    "child": {
      "type": "ref",
      "id": "invader"
    }
  }
}
```

---

# 10. Codegen Requirements (summary)

A compliant WGSL/GLSL generator must:

1. Walk the JSON node tree.
2. Emit uniforms for all `var` references.
3. Convert expression objects to shader expressions.
4. Compose transforms into matrices.
5. Inline primitive SDF functions.
6. Apply CSG ops in child-array order.
7. Attach material parameters to the surface record or shading system.

---

# 11. Versioning

Optional:

```json
"version": "1.0"
```

Major mismatches should be rejected; minor mismatches should warn.
