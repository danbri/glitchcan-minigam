# Stinkyfish (WebGPU/WGSL) Bug Tracker

Last updated: 2026-01-14

## Status Summary

| Issue | Status | Details |
|-------|--------|---------|
| Mirror compound axes | ✅ FIXED | Commit b186a5f |
| Radial variable count | ✅ FIXED | Both GLSL and WGSL |
| Grid array/table legs merge | ✅ FIXED | fract-based modulo |
| Infinite field distortion | ✅ FIXED | Per-axis repeat + fract-based radial |
| Sunflowers/poppies position | ✅ FIXED | Transform added |
| Snowman size | ✅ FIXED | Camera settings added |
| Backend switch shader error | ✅ FIXED | Commit 12b3785 |
| Cobra spinning | ✅ WORKING | Intentional animation |
| Bouncing balls container | ✅ FIXED | Container positioned |
| Rotated boxes color | ✅ FIXED | Commit 6a3c9b6 |

---

## ALL BUGS RESOLVED

All previously open bugs have been fixed in this session.

---

## RESOLVED BUGS

### Grid Array / Table Legs Merge (Fixed: Jan 14 2026)

**Was:** In scenes using `repeat` with multiple instances (e.g., table legs), instances appeared merged ("pogo stick").

**Root Cause:**
- WGSL used `round()`-based quantization instead of continuous modulo folding
- IR array format `{type: 'array', values: [...]}` wasn't being extracted, causing `undefined` values

**Fix:**
1. WGSL `generateRepeat()` rewritten to use `fract()`-based modulo per-axis
2. Both GLSL and WGSL now properly extract IR array values
3. Axes with period=0 are skipped to avoid division by zero

### Infinite Field / Repeat+Radial Distortion (Fixed: Jan 14 2026)

**Was:** Scenes combining `repeat` and `radial` showed distortion. Also, scenes with partial repeat (e.g., X and Z only, not Y) failed completely.

**Root Cause:**
- WGSL radial used `floor()` quantization vs GLSL's continuous modulo
- Vector-based repeat `p / spacing` caused NaN when any spacing component was 0

**Fix:**
1. WGSL radial rewritten to use `fract()`-based angle folding with polar reconstruction
2. Both codegens now handle per-axis repeat, skipping axes where period=0

### GLSL Radial Variable Count (Fixed: Jan 14 2026)

**Was:** Radial scenes with variable count (e.g., `{"var": "petalCount"}`) failed in Mayfly (GLSL).

**Root Cause:** GLSL did compile-time division `(2 * Math.PI / count).toFixed(6)` which returned NaN when count was an object.

**Fix:** Use `valueToGlsl()` for count and emit runtime division `6.283185 / ${countGlsl}` in shader.

### Mirror Compound Axes (Fixed: b186a5f, Jan 13 2026)

**Was:** Switch statement only handled single axes ('x', 'y', 'z'), compound axes like 'xz' fell through to default.

**Fix:** Changed to `axis.includes()` pattern matching all combinations.

### Backend Switch Shader Error (Fixed: 12b3785, Jan 13 2026)

**Was:** "invalid member access expression. Expected vector or struct, got 'f32'" when scale was scalar.

**Fix:** Check if scale is vector before member access, expand scalars to `vec3f()`.

### Rotated Boxes Color Mismatch (Fixed: 6a3c9b6, Jan 14 2026)

**Was:** GLSL showed B&W boxes while WGSL showed colors. Ref color overrides weren't being merged.

**Fix:** Added param merge step to GLSL `applyParamOverrides()` matching WGSL behavior.

### Array Variable Handling (Fixed: b186a5f, Jan 13 2026)

**Was:** Array elements used `formatFloat()` which returned '0.0' for non-numbers.

**Fix:** Changed to recursive `valueToWgsl()` for proper var/expr handling.

### Sunflowers/Poppies Position (Fixed: scene files)

**Fix:** Added `transform.translate: [0, 0.35, 0]` to sunflower-field.json and `[0, 0.4, 0]` to poppy-field.json.

### Snowman Size (Fixed: 12b3785, Jan 13 2026)

**Fix:** Added camera settings: `distance: 5, phi: 0.5, theta: 0.3, target: [0, 0.4, 0]`

### Bouncing Balls Container (Fixed: scene file)

**Fix:** Repositioned ground to y=0 with proper wall boundaries at ±1.95.

---

## Notes

### Cobra Spinning
This is **working as intended**. The cobra has Y-axis rotation animated via `rotationSpeed * time` expression (default 20°/sec). This is an intentional demo animation, not a bug.

### Algorithm Alignment Complete

WGSL and GLSL now use the same algorithms for domain folding:

| Operation | Algorithm |
|-----------|-----------|
| Repeat | `(fract(p/spacing + 0.5) - 0.5) * spacing` |
| Radial | `(fract(angle/sector + 0.5) - 0.5) * sector` with polar reconstruction |

Both backends properly handle:
- Variable parameters via `valueToWgsl()`/`valueToGlsl()`
- IR array format `{type: 'array', values: [...]}`
- Partial repeat (period=0 on some axes)
