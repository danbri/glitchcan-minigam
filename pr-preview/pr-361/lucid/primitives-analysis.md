# Primitives Analysis: Our Implementation vs Dreams

## Dreams' Primitive Set (R to L order from slides)

### Basic Geometric Primitives
1. **Cubic strokes** - Likely rounded/filleted cubes or swept cubic bezier curves
2. **Cylinders** ⚠️ **WE DON'T HAVE THIS**
3. **Cones** ⚠️ **WE DON'T HAVE THIS**
4. **Cuboids** ✅ We have "box" (same thing)
5. **Ellipsoids** ✅ We have this
6. **Triangular prisms** ⚠️ **WE DON'T HAVE THIS**
7. **Donuts** (torus) ⚠️ **WE DON'T HAVE THIS**
8. **Biscuits** - Unknown, possibly torus with different proportions or rounded cylinder
9. **Markoids** - Super-ellipsoids with variable x,y,z powers ⚠️ **WE DON'T HAVE THIS**
10. **Pyramids** ⚠️ **WE DON'T HAVE THIS**

### What We Have (5 primitives)
1. ✅ **sphere** - Not in Dreams list (too basic?)
2. ✅ **box** - Same as "cuboids"
3. ✅ **capsule** - Not in Dreams list, but very useful
4. ✅ **ellipsoid** - In Dreams list
5. ✅ **plane** - Not in Dreams list (infinite primitive)

## Critical Missing Primitives

### High Priority (Dreams used, we don't have)
1. **Cylinder** - Fundamental building block
   - Used for: limbs, tubes, pillars, mechanical parts
   - Dreams clearly relied on this heavily
   - SDF: `length(p.xz) - r` with height bounds

2. **Cone** - Fundamental building block
   - Used for: tapers, horns, roof peaks, funnels
   - Natural counterpart to cylinder
   - SDF: Slightly more complex angle-based formula

3. **Torus** (Donut) - Important organic primitive
   - Used for: joints, rings, rounded corners
   - Demo 2 needs this!
   - SDF: `length(vec2(length(p.xz) - majorR, p.y)) - minorR`

### Medium Priority
4. **Pyramid** - Architectural primitive
5. **Triangular Prism** - Architectural primitive
6. **Markoid** (Super-ellipsoid) - Advanced primitive for organic shapes

### Unknown
7. **Cubic strokes** - Need more context (bezier curves? rounded cubes?)
8. **Biscuits** - Need clarification

## Why Our Demo Shows "Only One Capsule"

Looking at Demo 5 ("Capsule Chain"):
```ink
cap = capsule(
  a = [0.0, sin(time)*0.5, 0.0],
  b = [cos(time)*0.8, -sin(time)*0.5, sin(time)*0.4],
  radius = 0.2,
  color = [0.8, 1.0, 0.3]
)
```

This IS only one capsule - with animated endpoints. The name "Capsule Chain" is misleading; it should be "Capsule Motion" or "Animated Capsule".

**There's no chain because we can't do multiple objects without operators!**

## The Real Problem: We Can't Build Anything Complex

Dreams could build models with **1 to 100,000 edits**. Each edit was:
- A primitive (cylinder, cone, torus, etc.)
- An operation (add, subtract, soft blend)
- Applied in a **list**, not a tree

### What This Means
To build a simple **table** in Dreams:
```
edit1: add cuboid (tabletop)
edit2: add cylinder (leg 1)
edit3: add cylinder (leg 2)
edit4: add cylinder (leg 3)
edit5: add cylinder (leg 4)
```

### To Build Same Table in Our System
We'd need:
```ink
leg1 = cylinder(...)  # ❌ DON'T HAVE CYLINDER
leg2 = cylinder(...)
leg3 = cylinder(...)
leg4 = cylinder(...)
top = box(...)
legs = union(a=leg1, b=leg2)  # ⚠️ union only takes 2 inputs
legs = union(a=legs, b=leg3)  # nested unions = ugly
legs = union(a=legs, b=leg4)
table = union(a=top, b=legs)
out = table
```

**And this assumes our union operator even works!** (which it might not based on user report)

## Dreams' CSG Architecture Advantage

### Their Approach: List-Based
```javascript
edits = [
  { prim: "cylinder", op: "add", params: {...} },
  { prim: "cylinder", op: "add", params: {...} },
  { prim: "cylinder", op: "add", params: {...} },
  { prim: "cuboid",   op: "add", params: {...} }
]

// Evaluate as sequential list
for (edit of edits) {
  if (edit.op === "add")
    d = min(d, edit.distance(p))
  else if (edit.op === "subtract")
    d = max(d, -edit.distance(p))
}
```

### Our Approach: Tree-Based
```javascript
// Must build nested tree structure
table = union(
  box(...),
  union(
    cylinder(...),
    union(
      cylinder(...),
      union(
        cylinder(...),
        cylinder(...)
      )
    )
  )
)
```

**Tree nesting becomes unwieldy fast.**

## What Dreams Had That We Don't

1. **More primitives** - 10+ vs our 5
2. **List-based CSG** - Natural for incremental building
3. **Cylinder & cone** - Fundamental primitives we're missing
4. **Torus** - Critical for organic/mechanical shapes
5. **Soft blend** - We have smoothUnion but missing smoothSubtract/smoothIntersect
6. **Color-only ops** - Non-geometric editing
7. **100K edit capacity** - Our nested tree would choke

## Immediate Action Items

### Must-Have Primitives (To Match Dreams Basics)
1. **Cylinder** - Add to parser + codegen
2. **Cone** - Add to parser + codegen
3. **Torus** - Add to parser + codegen (demo 2 needs this!)

### Must-Have Operators
4. **smoothSubtract** - Add to parser + codegen (demo 6 needs this!)
5. **smoothIntersect** - Complete the soft blend set

### Architecture Consideration
Should we support **list-style unions**?
```ink
# Instead of nested unions
parts = union(leg1, leg2, leg3, leg4, top)

# Codegen as:
# float d = min(d_leg1, min(d_leg2, min(d_leg3, min(d_leg4, d_top))))
```

This would make multi-part objects much easier to express.

## Why Demos Are Broken - Summary

| Demo | Issue | Root Cause |
|------|-------|-----------|
| 1 | ✅ Works | Single sphere primitive |
| 2 | ❌ Broken | Uses **torus** (not implemented) |
| 3 | ❓ Maybe broken | Uses smoothUnion with 2 spheres (operator input parsing) |
| 4 | ❓ Maybe broken | Uses union with box + sphere (operator input parsing) |
| 5 | ✅ Works | Single capsule primitive (not a chain, just one moving capsule) |
| 6 | ❌ Broken | Uses **smoothSubtract** (not implemented) |

**Only single-primitive demos work because operators are broken AND we're missing primitives.**

## Recommendation

1. **Fix operators first** - Verify my input parsing fix actually works
2. **Add missing primitives** - torus, cylinder, cone
3. **Add smoothSubtract** - Complete the operator set
4. **Test systematically** - Each primitive + each operator
5. **Consider Dreams architecture** - List-based CSG for easier multi-part models
