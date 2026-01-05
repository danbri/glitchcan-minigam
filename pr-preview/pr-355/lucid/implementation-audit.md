# SDF Engine Implementation Audit

## Currently Implemented

### Primitives (Parser + Codegen)
- ✅ **sphere** - `g_sdSphere(p, r)`
- ✅ **box** - `g_sdBox(p, size)`
- ✅ **capsule** - `g_sdCapsule(p, a, b, r)`
- ✅ **ellipsoid** - `g_sdEllipsoid(p, r)`
- ✅ **plane** - `g_sdPlane(p, n, d)`

### Operators (Parser + Codegen)
- ✅ **union** - min(d1, d2)
- ✅ **subtract** - max(d1, -d2)
- ✅ **smoothUnion** - smooth min with k parameter
- ✅ **alias** - reference forwarding (e.g., `out = s0`)

### Transform Support
- ✅ **offset** - translation via `p - offset`
- ✅ **rot** - XYZ rotation via `g_rotateXYZ`
- ✅ **rotq** - quaternion rotation via `g_qrotate`
- ✅ **color** - per-primitive coloring

## Demo Analysis

| Demo | Primitives Used | Operators | Status | Issue |
|------|----------------|-----------|--------|-------|
| 1. Pulsing Sphere | sphere | - | ✅ **WORKS** | - |
| 2. Rotating Torus | **torus** | - | ❌ **BROKEN** | torus not implemented |
| 3. Smooth Union | sphere | smoothUnion | ❓ **UNKNOWN** | operators may be broken |
| 4. Box & Sphere Dance | box, sphere | union | ❓ **UNKNOWN** | operators may be broken |
| 5. Capsule Chain | capsule | - | ✅ **WORKS** | - |
| 6. Smooth Subtract | sphere | smoothSubtract | ❌ **BROKEN** | smoothSubtract not implemented! |

## Missing Primitives

### Used in Demos
- ❌ **torus** (donut) - used in demo 2

### From Dreams (not in demos)
- ❌ **cylinder** - basic primitive
- ❌ **cone** - basic primitive
- ❌ **triangular prism**
- ❌ **biscuit** (?)
- ❌ **markoid** (super-ellipsoid with variable x,y,z powers)
- ❌ **pyramid**
- ❌ **cubic stroke** (?)

## Missing Operators

### From Demos
- ❌ **smoothSubtract** - demo 6 uses this!

### From Dreams
- ❌ **soft blend** (already have smoothUnion, need smoothSubtract)
- ❌ **color-only** operation (non-geometric)

## Critical Bugs Found

### 1. smoothSubtract Not Implemented
**Demo 6** uses `smoothSubtract(a=s1, b=s2, k=0.3)` but:
- Parser doesn't recognize it (line 245: only union, subtract, smoothUnion)
- Codegen doesn't handle it (line 258: only subtract, not smoothSubtract)
- **Result**: Creates placeholder node → renders as d=9999.0 (invisible)

### 2. Operator Input Parsing (CLAIMED FIXED)
The fix I made should have resolved `union(a=s1, b=s2)` parsing, but user reports operators still don't work. Need to verify with browser console logs.

### 3. Torus Not Implemented
**Demo 2** uses torus, but it's not in parser or codegen.
- Parser creates "unknown function" error + placeholder node
- Codegen else clause returns d=9999.0 (invisible)

## Comparison with Dreams

### Dreams Capabilities
- **10+ primitives** vs our 5
- **List-based CSG** (1-100K edits) vs our tree
- **Soft blend operators** (we have partial)
- **Volume texture storage** (83³ fp16 blocks)
- **Incremental updates**
- **GPU marching cubes** with histopyramids
- **Stream compaction** for index buffer generation

### Our Capabilities
- **5 primitives** (sphere, box, capsule, ellipsoid, plane)
- **3 operators** (union, subtract, smoothUnion)
- **Tree-based composition** via function calls
- **Realtime raymarching** (no marching cubes)
- **Transform support** (offset, rot, rotq)

## Immediate Fixes Needed

### Priority 1: Fix Broken Demos
1. ✅ **Add torus primitive** (parser + codegen)
2. ✅ **Add smoothSubtract operator** (parser + codegen)
3. **Verify operator input fix works** (check browser console)

### Priority 2: Dreams-Inspired Additions
1. **Add cylinder** (common primitive)
2. **Add cone** (common primitive)
3. **Add smoothIntersect** operator
4. **Implement color-only operator**

### Priority 3: Architecture
1. Consider list-based CSG (Dreams style) vs current tree
2. Volume texture caching for complex scenes
3. GPU compute shader path (future)

## Testing Strategy

### Browser Console Verification
With the debugging I added, each demo should log:
```
=== Demo: [Name] ===
Parsed nodes: [array of node objects]
Generated GLSL: [shader code]
✅ Shader compiled and linked successfully
```

For broken demos, look for:
- Parse errors
- Empty input arrays in operators
- GLSL compilation failures
- Missing function definitions

### Fix Verification
After adding torus and smoothSubtract:
- Demo 2 should show rotating donut
- Demo 6 should show carved sphere
- Demos 3 & 4 should show blended/combined shapes

## Next Steps

1. **Read browser console logs** to confirm operator bug status
2. **Add torus primitive** to parser and codegen
3. **Add smoothSubtract operator** to parser and codegen
4. **Test all 6 demos** systematically
5. **Document primitives** that Dreams used but we don't have
