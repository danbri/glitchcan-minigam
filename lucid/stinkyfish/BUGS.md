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

### Cobra spinning weirdly (FIXED)
- **Root cause**: WGSL applied Euler rotations in XYZ order, but GLSL applies them in ZYX order (reverse). This is required for correct SDF point transformation.
- **Fix**: Changed rotation application order to ZYX in all rotation handling paths

### Shader compilation error: vector/struct member access (FIXED)
- **Error**: `Shader compilation error: invalid member access expression. Expected vector or struct, got 'f32'`
- **Root cause**: `generateScaledNode()` used `s.x` on scale value without checking if it's a scalar or vec3. Uniform scale (single number) would produce `let s = 0.5;` then fail on `s.x`.
- **Fix**: Detect uniform vs non-uniform scale; for uniform scale, expand to `vec3f(scalar)` and multiply by scalar directly instead of using `.x` accessor

## Remaining Issues

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
- [x] Cobra animates smoothly
- [ ] Infinite demos tile correctly
- [ ] Snowman at correct scale
- [ ] All flowers above ground
- [ ] Physics container positioned correctly
