# Stinkyfish (WebGPU/WGSL) Bug Tracker

Last updated: 2026-01-14

## Status Summary

| Issue | Status | Details |
|-------|--------|---------|
| Mirror compound axes | ✅ FIXED | Commit b186a5f |
| Radial variable count | ✅ FIXED (WGSL) | GLSL still broken |
| Grid array/table legs merge | ❌ OPEN | Algorithm mismatch |
| Infinite field distortion | ❌ OPEN | Radial algorithm mismatch |
| Sunflowers/poppies position | ✅ FIXED | Transform added |
| Snowman size | ✅ FIXED | Camera settings added |
| Backend switch shader error | ✅ FIXED | Commit 12b3785 |
| Cobra spinning | ✅ WORKING | Intentional animation |
| Bouncing balls container | ✅ FIXED | Container positioned |
| Rotated boxes color | ✅ FIXED | Commit 6a3c9b6 |

---

## OPEN BUGS

### 1. Grid Array / Table Legs Merge ("Pogo Stick")

**Symptom:** In scenes using `repeat` with multiple instances (e.g., table legs), instances can appear merged together instead of distinct.

**Root Cause:** WGSL uses different domain folding algorithm than GLSL:

| Backend | Algorithm | Code |
|---------|-----------|------|
| GLSL | `mod(p + half, period) - half` | Continuous modulo folding |
| WGSL | `p - spacing * round(p / spacing)` | Discrete round-based |

The `round()` approach can cause aliasing where multiple instances converge into same cell.

**Location:** `wgsl-codegen.js:965-988` `generateRepeat()`

**Fix Required:** Rewrite WGSL repeat to use modulo-based folding:
```wgsl
let half = spacing * 0.5;
let rp = (p + half) % spacing - half;  // or use fract()
```

---

### 2. Infinite Field / Repeat+Radial Distortion

**Symptom:** Scenes combining `repeat` and `radial` (sunflower-field, poppy-field) show distortion in WGSL that doesn't appear in GLSL. Animation is disabled in these scenes due to this issue.

**Root Cause:** WGSL radial uses discrete quantization vs GLSL's continuous modulo:

| Backend | Radial Algorithm |
|---------|-----------------|
| GLSL | `mod(angle + seg*0.5, seg) - seg*0.5` |
| WGSL | `floor(angle/seg + 0.5) * seg` |

When repeat+radial combine, the different algorithms don't compose correctly, causing phase discontinuities.

**Location:** `wgsl-codegen.js:947-954` in `generateRadial()`

**Fix Required:** Align WGSL radial to use modulo-based folding:
```wgsl
let sector = 6.283185 / count;
let a = fract((angle + sector * 0.5) / sector) * sector - sector * 0.5;
```

---

### 3. GLSL Radial Variable Count (Mayfly bug, not Stinkyfish)

**Symptom:** Radial scenes with variable count (e.g., `{"var": "petalCount"}`) fail to load in Mayfly (GLSL), but work in Stinkyfish (WGSL).

**Root Cause:** GLSL `generateRadial()` does compile-time division on object:
```javascript
// json-codegen.js:1313
const segment = (2 * Math.PI / count).toFixed(6);
// When count = {type: "var", name: "petalCount"} → NaN
```

**Location:** `json-codegen.js:1287-1313`

**Fix Required:** Use `valueToGlsl()` for count and emit runtime division in shader.

---

## RESOLVED BUGS

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

### WGSL vs GLSL Algorithm Differences

The two remaining open bugs (grid array, infinite field) share a common theme: WGSL implementations use mathematically different algorithms than GLSL. While both produce similar results for simple cases, they diverge when:

1. Multiple domain modifiers are nested (repeat + radial)
2. Viewing at certain angles or scales
3. Using dynamic parameters

**Recommended approach:** Align WGSL algorithms to match GLSL exactly, using modulo-based domain folding rather than round/floor-based quantization.
