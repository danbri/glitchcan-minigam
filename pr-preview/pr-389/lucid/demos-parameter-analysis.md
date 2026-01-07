# Demo Parameter Analysis - Systematic Review

## Executive Summary

**All 6 demos should now work!** ✅

The `center` parameter fix (just merged) was the primary blocking issue. All parameter aliasing is correctly implemented in the parser.

---

## Demo-by-Demo Analysis

### Demo 1: Pulsing Sphere ✅ WORKING
```ink
s0 = sphere(
  r = 1.0 + 0.3*sin(time),
  color = [0.4 + 0.4*sin(time), 0.6, 1.0],
  offset = [0.0, 0.3*sin(time*0.7), 0.0]
)
```

**Parameters Used:**
- `r` (radius) - animated
- `offset` (position)
- `color`

**Parser Handling:**
- Line 217-218: Converts `r` → `radius`
- Line 220: Defaults to `radius = "1.0"`

**Codegen Expects:**
- Line 229: `params.radius` ✅
- Line 211: `params.offset` ✅

**Status:** ✅ WORKING (already confirmed by user)

---

### Demo 2: Rotating Torus ⚠️ FIXED (needs verification)
```ink
t0 = torus(
  majorR = 1.2,
  minorR = 0.3,
  center = [sin(time), 0.0, cos(time)],
  color = [1.0, 0.5 + 0.3*sin(time*2.0), 0.3]
)
```

**Parameters Used:**
- `majorR` (outer radius)
- `minorR` (tube radius)
- `center` (position) - animated circular orbit
- `color` - animated

**Parser Handling:**
- Line 247: Accepts `majorR` or `r1`
- Line 248: Accepts `minorR` or `r2`

**Codegen Expects:**
- Torus codegen: `majorR`, `minorR` ✅
- Line 211: `params.offset || params.center` ✅ **JUST FIXED**

**Status:** ✅ SHOULD NOW WORK (center parameter fix merged)

**Previous Issue:** Torus rendered at origin (squashed shape) because codegen only checked `params.offset`, not `params.center`

---

### Demo 3: Smooth Union ⚠️ FIXED (needs verification)
```ink
s1 = sphere(
  r = 0.8,
  center = [sin(time)*0.5, 0.3, 0.0],
  color = [0.3, 0.8, 1.0]
)
s2 = sphere(
  r = 0.8,
  center = [-sin(time)*0.5, -0.3, 0.0],
  color = [1.0, 0.3, 0.8]
)
blend = smoothUnion(a=s1, b=s2, k=0.4)
```

**Parameters Used:**
- Sphere: `r`, `center`, `color`
- Operator: `smoothUnion` with inputs `a=s1, b=s2` and param `k=0.4`

**Parser Handling:**
- Spheres: Converts `r` → `radius` ✅
- Operator: `parseInputsAndParams` distinguishes inputs from params ✅

**Codegen Expects:**
- Sphere: `params.radius` ✅
- Position: `params.offset || params.center` ✅ **JUST FIXED**
- Operator: Multi-input support already exists ✅

**Status:** ✅ SHOULD NOW WORK

**Previous Issues Resolved:**
1. ✅ Operator input parsing fixed (distinguishes `a=s1` as input, not param)
2. ✅ Center parameter now supported

---

### Demo 4: Box & Sphere Dance ⚠️ FIXED (needs verification)
```ink
b1 = box(
  size = [0.6, 0.6, 0.6],
  center = [0.0, sin(time*1.5)*0.4, 0.0],
  color = [1.0, 0.7, 0.2]
)
s1 = sphere(
  r = 0.5,
  center = [cos(time)*0.8, 0.0, sin(time)*0.8],
  color = [0.2, 0.7, 1.0]
)
combo = union(a=b1, b=s1)
```

**Parameters Used:**
- Box: `size`, `center`, `color`
- Sphere: `r`, `center`, `color`
- Operator: `union` with inputs `a=b1, b=s1`

**Parser Handling:**
- Box: Accepts `size` or `s` alias (line 223-224)
- Sphere: Converts `r` → `radius`
- Operator: Input parsing distinguishes `a=b1` as input ✅

**Codegen Expects:**
- Box: `params.size` ✅
- Sphere: `params.radius` ✅
- Both: `params.offset || params.center` ✅ **JUST FIXED**

**Status:** ✅ SHOULD NOW WORK

---

### Demo 5: Capsule Chain ✅ WORKING
```ink
cap = capsule(
  a = [0.0, sin(time)*0.5, 0.0],
  b = [cos(time)*0.8, -sin(time)*0.5, sin(time)*0.4],
  radius = 0.2,
  color = [0.8, 1.0, 0.3]
)
```

**Parameters Used:**
- `a` (start point) - animated
- `b` (end point) - animated
- `radius` (tube radius)
- `color`

**Parser Handling:**
- Line 229-230: Converts `radius` → `r`
- Line 232: Defaults to `r = "0.5"`

**Codegen Expects:**
- Line 246-248: `params.a`, `params.b`, `params.r` ✅

**Status:** ✅ WORKING (already confirmed by user)

**Note:** Demo title "Capsule Chain" is misleading - it's actually a single capsule with animated endpoints, not multiple capsules.

---

### Demo 6: Smooth Subtract ⚠️ FIXED (needs verification)
```ink
s1 = sphere(
  r = 1.0,
  center = [0.0, 0.0, 0.0],
  color = [0.9, 0.4, 0.6]
)
s2 = sphere(
  r = 0.8,
  center = [sin(time)*0.4, cos(time*1.3)*0.4, 0.0],
  color = [0.3, 0.6, 1.0]
)
carved = smoothSubtract(a=s1, b=s2, k=0.3)
```

**Parameters Used:**
- Sphere: `r`, `center`, `color`
- Operator: `smoothSubtract` with inputs `a=s1, b=s2` and param `k=0.3`

**Parser Handling:**
- Spheres: Converts `r` → `radius` ✅
- Operator: Now recognized (line 257) ✅

**Codegen Expects:**
- Sphere: `params.radius` ✅
- Position: `params.offset || params.center` ✅ **JUST FIXED**
- Operator: `g_opSmoothSubtract` function implemented ✅

**Status:** ✅ SHOULD NOW WORK

**Previous Issues Resolved:**
1. ✅ `smoothSubtract` operator implemented (parser + codegen)
2. ✅ Center parameter now supported
3. ✅ Input parsing distinguishes `a=s1, b=s2` as inputs

---

## Parameter Aliasing Summary

### Sphere
- **Parser prefers:** `radius`
- **Codegen expects:** `radius`
- **Aliases:** `r` → converts to `radius`

### Capsule
- **Parser prefers:** `r`
- **Codegen expects:** `r`
- **Aliases:** `radius` → converts to `r`

### Box
- **Parser prefers:** `size`
- **Codegen expects:** `size`
- **Aliases:** `s` → converts to `size`

### Torus
- **Parser prefers:** `majorR`, `minorR`
- **Codegen expects:** `majorR`, `minorR`
- **Aliases:** `r1` → `majorR`, `r2` → `minorR`

### Cylinder
- **Parser prefers:** `r`, `h`
- **Codegen expects:** `r`, `h`
- **Aliases:** `radius` → `r`, `height` → `h`

### Cone
- **Parser prefers:** `r`, `h`
- **Codegen expects:** `r`, `h`
- **Aliases:** `radius` → `r`, `height` → `h`

### Position Parameter (ALL primitives)
- **Codegen now supports BOTH:**
  - `offset` - traditional parameter
  - `center` - more intuitive parameter name
- **Implementation:** `params.offset || params.center || default` (line 211)

---

## Critical Fixes Applied

### 1. ✅ Center Parameter Support
**File:** `lucid/core/glsl-codegen.js` line 211
```javascript
// BEFORE
const off = vec3Expr(params.offset || ["0.0", "0.0", "0.0"], "0.0", "offset");

// AFTER
const off = vec3Expr(params.offset || params.center || ["0.0", "0.0", "0.0"], "0.0", "offset");
```
**Impact:** Demos 2, 3, 4, 6 now render at correct positions

### 2. ✅ Operator Input Parsing
**File:** `lucid/core/dsl-parser.js` lines 123-136
```javascript
const isInputRef = typeof val === "string" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(val);
if (isInputRef) {
  node.inputs[key] = val;
  node.inputOrder.push(val);
} else {
  node.params[key] = val;
  node.paramOrder.push(key);
}
```
**Impact:** Operators like `union(a=s1, b=s2)` correctly distinguish inputs from parameters

### 3. ✅ smoothSubtract Operator
**Added to parser** (line 257) and **codegen** (lines 151-154)
**Impact:** Demo 6 now renders carved sphere effect

### 4. ✅ Missing Primitives
**Added:** torus, cylinder, cone (parser + codegen + GLSL helpers)
**Impact:** Demo 2 (torus) can now render

---

## Conclusion

With all fixes now merged to master, **all 6 demos should be functional**:

1. ✅ **Pulsing Sphere** - Already working
2. ✅ **Rotating Torus** - Center fix applied
3. ✅ **Smooth Union** - Center fix + operator input parsing
4. ✅ **Box & Sphere Dance** - Center fix + operator input parsing
5. ✅ **Capsule Chain** - Already working
6. ✅ **Smooth Subtract** - Center fix + operator implementation + input parsing

## Recommended Next Steps

1. **Test all 6 demos** at https://danbri.github.io/glitchcan-minigam/lucid/demos.html
2. **Check browser console** for any remaining GLSL compilation errors
3. **Verify visual output** matches demo descriptions
4. **Document any remaining issues** for further investigation
