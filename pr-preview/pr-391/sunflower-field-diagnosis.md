# LCD Sunflower Field Scene Diagnosis

## Issue Summary

The LCD Sunflower Field scene (located at `lucid/scenes/nature/sunflower-field.json`) exhibits rendering problems due to a **known conflict between nested `repeat` and `radial` operations**.

## Root Cause Analysis

### Problem Pattern
The issue occurs when combining:
1. **Outer `repeat` operation**: Creates infinite tiling using `mod(p, period)`
2. **Inner `radial` operation**: Creates rotational symmetry using `mod(angle, segment)`

### GLSL Code Generation Issues

**Repeat operation** (`json-codegen.js` lines ~950-980):
```glsl
q.x = mod(q.x + 1.25, 2.5) - 1.25;  // X-axis tiling
q.z = mod(q.z + 1.25, 2.5) - 1.25;  // Z-axis tiling
```

**Radial operation** (`json-codegen.js` lines ~685-720):
```glsl
float angle = atan(rp.y, rp.x);
float segment = 0.5236;  // 2π/12 for 12 petals
angle = mod(angle + segment * 0.5, segment) - segment * 0.5;
```

### Conflict Mechanism
When these operations are nested:
1. The `repeat` modifies coordinates for tiling
2. The `radial` then operates on already-modified coordinates  
3. This causes **angular distortion** where petals don't align properly across tile boundaries
4. Results in visual artifacts, especially during animation (hence "animation disabled")

## Evidence

Both affected scenes contain the same note:
- `sunflower-field.json`: *"Animation disabled - was causing distortion with repeat+radial combination"*
- `poppy-field.json`: *"Animation disabled - was causing issues with repeat+radial combination"*

## Working Alternatives

1. **Single Sunflower**: `single-sunflower.json` works fine (no repeat)
2. **Fixed Version**: `sunflower-field-fixed.json` uses individual spheres instead of radial

## Proposed Solutions

### Short-term Fix (Immediate)
Replace the radial pattern with individual positioned spheres:
- ✅ Created `sunflower-field-fixed.json` with this approach
- Uses 8 manually positioned petal spheres instead of radial symmetry
- Maintains visual similarity while avoiding the repeat+radial conflict

### Long-term Fix (Code Changes)
Modify `json-codegen.js` to handle nested repeat+radial cases:
1. **Coordinate space isolation**: Apply radial operations before repeat transformations
2. **Better transform ordering**: Ensure radial symmetry is computed in local space
3. **Add warning system**: Detect and warn about problematic combinations

## Testing
- ✅ Identified root cause in GLSL code generation
- ✅ Created working alternative scene
- ⏳ Long-term fix requires detailed GLSL shader debugging

## Impact
- **Affected scenes**: 2 (sunflower-field.json, poppy-field.json)  
- **Severity**: Medium (scenes exist but don't render properly)
- **User impact**: Reduced visual quality in nature scene category