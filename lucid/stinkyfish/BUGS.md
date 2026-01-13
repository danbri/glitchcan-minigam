# Stinkyfish Renderer Bugs

Known issues where Stinkyfish (WebGPU/WGSL) renders differently from Mayfly (WebGL/GLSL).

## Fixed Issues ✅

### Mirror scene - no mirroring (FIXED)
- **Root cause**: WGSL mirror only handled single-axis (`'x'`, `'y'`, `'z'`), not multi-axis strings like `"xz"`
- **Fix**: Updated `generateMirror()` to use `axis.includes('x')` pattern like GLSL

### Radial flower won't load (FIXED)
- **Root cause**: `generateRadial()` used raw `node.count` instead of `valueToWgsl(node.count)`, causing `[object Object]` in shader when count was a variable reference
- **Fix**: Converted count to WGSL using `valueToWgsl(countValue, ctx)`

### Grid array - table legs merge like pogo stick (FIXED)
- **Root cause**: Primitives used hardcoded `'p'` instead of `ctx.currentP || 'p'` in `applyTransform()`. When nested inside `transform` nodes, the transformed point was ignored.
- **Fix**: All primitives and CSG operations now use `applyTransform(ctx.currentP || 'p', node.transform, ctx)`

## Remaining Issues

### Critical - Shader Compilation Errors

#### Backend switch failed: vector/struct member access
- **Error**: `Shader compilation error: invalid member access expression. Expected vector or struct, got 'f32'`
- **Symptom**: Scene fails to load entirely
- **Likely cause**: WGSL codegen producing `.x`/`.y`/`.z` on scalar float instead of vec3

### High Priority - Incorrect Rendering

#### Infinite field - space folding demos broken
- **Scene**: Various in `transforms/`
- **Expected**: Infinite repetition of objects
- **Actual**: Single instance or broken geometry
- **Likely cause**: `opRepeat`, `opRepeatLimited`, `mod()` handling differences

#### Snowman - weirdly huge
- **Scene**: `creatures/snowman.json`
- **Expected**: Normal scale snowman
- **Actual**: Massively oversized
- **Likely cause**: Scale parameter not applied, or applied inversely

#### Cobra - spinning weirdly
- **Scene**: `creatures/cobra.json`
- **Expected**: Smooth animation
- **Actual**: Erratic or wrong rotation axis
- **Likely cause**: Animation time uniform or rotation matrix issues

### Medium Priority - Positioning Issues

#### Sunflowers/poppies below ground plane
- **Scene**: `plants/sunflower.json`, `plants/poppy.json`
- **Expected**: Flowers above ground
- **Actual**: Flowers intersecting or below ground
- **Fix needed**: Raise Y position in scene files OR fix transform order

#### Bouncing balls - physics container position
- **Scene**: `physics/bouncing-balls.json`
- **Expected**: Container aligned with ground plane
- **Actual**: Container too low
- **Fix needed**: Move lowest part of physics container up to plane level

## Testing Checklist

- [x] Mirror scene shows symmetry
- [x] Radial flower loads and displays
- [x] Grid array shows distinct objects
- [ ] Infinite demos tile correctly
- [ ] Snowman at correct scale
- [ ] Cobra animates smoothly
- [ ] All flowers above ground
- [ ] Physics container positioned correctly
