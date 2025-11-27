## Overview

This document outlines a domain-specific language for describing 3D scenes that compile to signed distance function (SDF) shaders for raymarching. The language supports primitive shapes, constructive solid geometry (CSG) operations, hierarchical transforms, and reusable component definitions.

The design draws from VRML/OpenInventor scene graph conventions, functional graphics DSL patterns (particularly Conal Elliott's work), and modern SDF compilers like Matt Keeter's Fidget.

## Core Concepts

### Primitives

Primitives are defined at the origin with intrinsic properties only. Position, rotation, and scale come from transforms.
```
box({ size: [1.0, 0.5, 0.3] })
sphere({ r: 0.5 })
cylinder({ r: 0.3, h: 1.0 })
cone({ r: 0.5, h: 0.8 })
```

Primitives can carry material properties:
```
box({ size: [1.0, 0.5, 0.3], color: [0.8, 0.2, 0.1] })
```

### CSG Operations

Combine primitives using union, subtraction, and intersection. These accept variadic arguments:
```
union(a, b, c)
subtract(base, hole1, hole2)
intersect(a, b)
```

Smooth blending variants take a radius parameter:
```
union_smooth(a, b, { r: 0.1 })
subtract_smooth(base, hole, { r: 0.05 })
```

### Transforms

Transforms can be applied inline on any shape or use-site:
```
sphere({ r: 0.5, translate: [1.0, 0.0, 0.0] })
sphere({ r: 0.5, rotate: [0.0, 1.57, 0.0] })
sphere({ r: 0.5, scale: [1.0, 2.0, 1.0] })
```

Transform order is scale → rotate → translate. Rotation is specified as Euler angles in radians (XYZ order).

### Groups

Groups apply a transform to all children. Child transforms compose with the parent (child transforms are relative to parent space).
```
let limb = group({
  translate: [1.0, 0.0, 0.0],
  rotate: [0.0, 0.0, time],
  children: [
    box({ size: [0.8, 0.2, 0.2] }),
    sphere({ r: 0.15, translate: [0.5, 0.0, 0.0] })
  ]
});
```

Groups can be nested arbitrarily, forming a scene graph.

### Definitions and Instances

`def` declares a reusable shape or assembly at the origin:
```
def wheel {
  let rim = cylinder({ r: 0.4, h: 0.1, color: [0.3, 0.3, 0.3] });
  let hub = cylinder({ r: 0.1, h: 0.15, color: [0.8, 0.8, 0.8] });
  return union(rim, hub);
}
```

`use` instantiates a definition with transform and property overrides:
```
use wheel { translate: [1.0, -0.5, 0.5] }
use wheel { translate: [-1.0, -0.5, 0.5], color: [1.0, 0.0, 0.0] }
```

Property overrides (like `color`) apply to the root of the definition. Child nodes within the def retain their own properties unless a more sophisticated inheritance model is adopted.

### Animation

Expressions can reference `time` (seconds since start) and use standard math functions:
```
sphere({ r: 0.5, translate: [sin(time), 0.0, 0.0] })

let pendulum = group({
  rotate: [0.0, 0.0, 0.5 * sin(time * 2.0)],
  children: [arm, weight]
});
```

## Full Example
```
// Reusable invader shape defined at origin
def invader {
  let body = box({ size: [0.5, 0.4, 0.3] });
  let eye1 = sphere({ r: 0.1, translate: [-0.12, 0.08, 0.2], color: [0.0, 0.0, 0.0] });
  let eye2 = sphere({ r: 0.1, translate: [0.12, 0.08, 0.2], color: [0.0, 0.0, 0.0] });
  return subtract(body, eye1, eye2);
}

// Top row
let row_top = group({
  translate: [0.0, 0.6, 0.0],
  children: [
    use invader { translate: [-1.5, 0, 0], color: [0.0, 1.0, 0.5] },
    use invader { translate: [0.0, 0, 0], color: [0.0, 1.0, 0.5] },
    use invader { translate: [1.5, 0, 0], color: [0.0, 1.0, 0.5] }
  ]
});

// Bottom row
let row_bottom = group({
  translate: [0.0, -0.6, 0.0],
  children: [
    use invader { translate: [-1.5, 0, 0], color: [1.0, 0.3, 0.8] },
    use invader { translate: [0.0, 0, 0], color: [1.0, 0.3, 0.8] },
    use invader { translate: [1.5, 0, 0], color: [1.0, 0.3, 0.8] }
  ]
});

// Animated formation
let formation = group({
  rotate: [0.0, time * 0.5, 0.0],
  children: [row_top, row_bottom]
});

out = formation;
```

## Open Questions

**Parameterised definitions**: Should `def` support parameters beyond transforms?
```
def invader(eye_size) {
  let eye1 = sphere({ r: eye_size, ... });
  ...
}
```

This makes definitions more like macros or functions. An alternative is to keep `def` pure and add a separate `template` construct for parameterised generators.

**Property inheritance**: When `use` specifies a `color`, what happens?

- Option A: Override only the root node of the definition
- Option B: Override all nodes that don't have explicit colours
- Option C: Require explicit inheritance markers in the definition

**Transform specification**: Euler angles are simple but have gimbal lock issues. Alternatives include axis-angle (`rotate_axis: [0, 1, 0, 1.57]`) or quaternions (less readable).

**Instancing semantics**: Is `use` a true instance (shared geometry in compiled output) or just syntactic sugar for copy-paste? For SDF compilation, true instancing requires care to avoid re-evaluating the same SDF multiple times.

## References

- Inigo Quilez, SDF functions and operations: https://iquilezles.org/articles/distfunctions/
- Matt Keeter, Fidget SDF compiler: https://github.com/mkeeter/fidget
- VRML97 specification, grouping and transforms: https://www.web3d.org/documents/specifications/14772/V2.0/
- Conal Elliott, Compiling to Categories: http://conal.net/papers/compiling-to-categories/
- Pixar USD, composition and instancing: https://openusd.org/docs/USD-Glossary.html
