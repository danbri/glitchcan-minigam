# GitHub Issue: Investigate hg_sdf library for optimized SDF primitives

**Create at**: https://github.com/danbri/glitchcan-minigam/issues/new

---

## Title
Investigate hg_sdf library for optimized SDF primitives

## Body

### Summary
Consider integrating Mercury's hg_sdf library for optimized SDF primitives and operations.

**Repository**: https://github.com/jcowles/hg_sdf
**Original docs**: http://mercury.sexy/hg_sdf/

### Why
The hg_sdf library (originally from Mercury demoscene group) provides:
- Optimized SDF primitives (often more efficient than naive implementations)
- Domain operations (repetition, rotation, mirroring)
- Polyhedral SDFs
- Well-tested, production-quality GLSL code

### Current Performance Context
The yeti physics mode with multiple quadruped creatures is slow due to:
- 12 primitives per creature in smoothUnion
- Multiple creatures = 50+ primitive evaluations per raymarch step
- Added bounding sphere optimization (LCD-049) helps but more gains possible

Key optimization advice from research:
> "GLSL SDF raymarching speed is dominated by sphere tracing and step limits rather than the toolkit itself; efficient distance estimators and early ray termination are key. For max performance, keep your SDF functions branchless, use spatial repetition and bounding heuristics where possible, and minimize per-pixel loop counts."

### Potential Benefits
1. **Faster primitives** - hg_sdf implementations may be more efficient
2. **Better smooth operations** - optimized smooth min/max
3. **Domain repetition** - could help with arena walls, grids
4. **Proven code** - battle-tested in demoscene productions

### Integration Approach
1. Review hg_sdf license (MIT-compatible?)
2. Identify primitives/operations that could replace current codegen output
3. Benchmark before/after on yeti physics scene
4. Either vendor the GLSL or adapt patterns into json-codegen.js

### Key hg_sdf Features to Evaluate
- `pMod*` - domain repetition (infinite/limited)
- `pMirror*` - domain mirroring
- `fOpUnionRound`, `fOpIntersectionRound` - smooth ops
- Primitive implementations vs current Lucid codegen

### References
- [Inigo Quilez SDF functions](https://iquilezles.org/articles/distfunctions/)
- [SDF Bounding Volumes](https://iquilezles.org/articles/sdfbounding/)
- LCD-049: Bounding sphere optimization (implemented in json-codegen.js)

### Labels
`enhancement`, `performance`
