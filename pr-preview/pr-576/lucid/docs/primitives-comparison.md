# Lucid vs hg-sdf Primitives Comparison

## Primitives

| Shape | Lucid Native | hg-sdf | Notes |
|-------|--------------|--------|-------|
| Sphere | `sdSphere(p, r)` | `fSphere(p, r)` | Identical |
| Box | `sdBox(p, b)` | `fBox(p, b)` | hg also has `fBoxCheap` |
| Torus | `sdTorus(p, vec2(R,r))` | `fTorus(p, r, R)` | Param order differs |
| Cylinder | `sdCylinder(p, h, r)` | `fCylinder(p, r, h)` | Param order differs |
| Capsule | `sdCapsule(p, h, r)` | `fCapsule(p, r, c)` | Similar |
| Ellipsoid | `sdEllipsoid(p, r)` | ❌ | Lucid only |
| Cone | `sdCone(p, h, r)` | `fCone(p, r, h)` | Param order differs |
| Plane | ❌ | `fPlane(p, n, d)` | hg only |
| Disc | ❌ | `fDisc(p, r)` | hg only |
| Circle | ❌ | `fCircle(p, r)` | hg only (2D in 3D) |
| Line Segment | ❌ | `fLineSegment(p, a, b)` | hg only |
| Hexagon | ❌ | `fHexagonCircumcircle`, `fHexagonIncircle` | hg only |
| Blob | ❌ | `fBlob(p)` | hg only (metaball) |

## Polyhedra (hg-sdf only)

| Shape | hg-sdf Function |
|-------|-----------------|
| Octahedron | `fOctahedron(p, r)` |
| Dodecahedron | `fDodecahedron(p, r)` |
| Icosahedron | `fIcosahedron(p, r)` |
| Truncated Octahedron | `fTruncatedOctahedron(p, r)` |
| Truncated Icosahedron | `fTruncatedIcosahedron(p, r)` |

## CSG Operations

| Operation | Lucid Native | hg-sdf | Notes |
|-----------|--------------|--------|-------|
| Union | `opUnion(a, b)` | `min(a, b)` | Same |
| Subtract | `opSubtract(a, b)` | `max(a, -b)` | Same |
| Intersect | `opIntersect(a, b)` | `max(a, b)` | Same |
| Smooth Union | `opSmoothUnion(a, b, k)` | `fOpUnionRound(a, b, r)` | Similar |
| Smooth Subtract | `opSmoothSubtract(a, b, k)` | `fOpDifferenceRound(a, b, r)` | Similar |
| Smooth Intersect | `opSmoothIntersect(a, b, k)` | `fOpIntersectionRound(a, b, r)` | Similar |
| Chamfer Union | ❌ | `fOpUnionChamfer(a, b, r)` | hg only |
| Columns | ❌ | `fOpUnionColumns(a, b, r, n)` | hg only |
| Stairs | ❌ | `fOpUnionStairs(a, b, r, n)` | hg only |
| Pipe | ❌ | `fOpPipe(a, b, r)` | hg only |
| Engrave | ❌ | `fOpEngrave(a, b, r)` | hg only |
| Groove | ❌ | `fOpGroove(a, b, ra, rb)` | hg only |
| Tongue | ❌ | `fOpTongue(a, b, ra, rb)` | hg only |

## Domain Operations

| Operation | Lucid Native | hg-sdf | Notes |
|-----------|--------------|--------|-------|
| Mirror X/Y/Z | `mirror` node | `pMirror(p, dist)` | Lucid is axis-based |
| Repeat 1D | ❌ | `pMod1(p, size)` | hg only |
| Repeat 2D | ❌ | via `pMod1` twice | hg only |
| Repeat Polar | ❌ | `pModPolar(p, n)` | hg only |
| Repeat with Mirror | ❌ | `pModMirror1(p, size)` | hg only |
| Repeat Interval | ❌ | `pModInterval1(p, size, start, stop)` | hg only (finite repeat) |
| Rotate 2D | transform node | `pR(p, angle)` | Both have |
| Rotate 45° | ❌ | `pR45(p)` | hg shortcut |

## Unique to hg-sdf

### GDF (Generalized Distance Functions)
Platonic solids via `fGDF*` functions - mathematically elegant approach using dot products with predefined direction vectors.

### Soft Operations
`fOpUnionSoft(a, b, r)` - alternative smooth blending.

### Architectural Operations
- `fOpPipe` - creates pipe-like intersection
- `fOpEngrave` - carving effect
- `fOpGroove` / `fOpTongue` - interlocking shapes

## Integration Priority

**High value adds from hg-sdf:**
1. `pMod1` / `pMod2` - domain repetition (infinite grids)
2. `pModPolar` - radial repetition (flowers, gears)
3. `fOpUnionColumns` / `fOpUnionStairs` - decorative blends
4. Polyhedra (`fOctahedron`, etc.) - geometric shapes

**Already covered by Lucid:**
- Basic primitives (sphere, box, torus, cylinder, capsule, cone)
- Smooth CSG operations
- Basic transforms

## Proposed `hg:` Prefix Mappings

```json
{ "type": "hg:box", "size": [1, 0.5, 0.3] }       → fBox(p, vec3(...))
{ "type": "hg:octahedron", "r": 1.0 }             → fOctahedron(p, r)
{ "type": "hg:repeat1d", "axis": "x", "size": 2 } → pMod1(p.x, 2.0)
{ "type": "hg:polar", "count": 8 }                → pModPolar(p.xz, 8.0)
```
