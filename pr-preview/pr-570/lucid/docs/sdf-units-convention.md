# SDF Units Convention

> **Status**: Draft specification fragment
> **Default**: 1 unit = 1 meter
> **Future**: `units` and `scale` fields for normalization

## Overview

Signed Distance Functions return distances in abstract "units". For content interoperability, realistic physics, and consistent raymarching behavior, Lucid adopts **1 unit = 1 meter** as the default convention.

## Rationale

### Why Meters?

| Benefit | Explanation |
|---------|-------------|
| **Human scale** | Character height ~1.7 units, arm reach ~0.7 units |
| **Physics compatibility** | Gravity = 9.8 m/s², standard constants work |
| **Asset interoperability** | Most game engines (Unity, Unreal, Godot) use meters |
| **VR/AR standard** | 1:1 meter mapping for immersive experiences |
| **Intuitive reasoning** | "Is 0.001 a reasonable hit threshold?" → Yes, 1mm precision |

### Industry Conventions

| Context | Typical Convention |
|---------|-------------------|
| Game engines (Unity, Unreal, Godot) | 1 = 1 meter |
| Shadertoy / demoscene | Unitless, scene in [-2, 2] |
| Physics simulations | SI units (meters) |
| CAD/engineering | Millimeters or meters |
| VR/AR applications | 1 = 1 meter |
| Blender (default) | 1 = 1 meter |
| Maya (common) | 1 = 1 centimeter |

## Implications for Raymarching

With 1 unit = 1 meter, these parameter values make physical sense:

```javascript
// Raymarching settings (meter scale)
{
  hitThreshold: 0.001,    // 1mm - surface detection precision
  minStep: 0.001,         // 1mm - minimum ray advance
  maxDistance: 100.0,     // 100m - maximum view distance
  normalEpsilon: 0.001,   // 1mm - normal calculation offset

  // Adaptive stepping thresholds
  nearThreshold: 0.01,    // 1cm - start being careful
  farThreshold: 0.1       // 10cm - can take aggressive steps
}
```

## Real-World Reference Sizes

For scene composition and model validation:

| Object | Expected Size (units/meters) |
|--------|------------------------------|
| Human adult | 1.6 - 1.9 |
| Human hand | 0.18 - 0.20 |
| Humpback whale | 12 - 16 |
| Wolf | 1.0 - 1.5 (shoulder height) |
| House door | 2.0 height, 0.9 width |
| Car | 4.5 length, 1.8 width |
| Basketball | 0.24 diameter |
| Coin | 0.02 - 0.03 diameter |

## Content Mixing Considerations

When combining content from multiple sources:

### Problem Scenarios

1. **Scale mismatch**: Model A uses 1=1m, Model B uses 1=1cm
   - Result: 100x size difference
   - Fix: Apply scale transform

2. **Origin conventions**: Some models center at origin, others sit on ground plane
   - Result: Objects floating or buried
   - Fix: Translate to consistent origin

3. **Orientation**: Y-up vs Z-up coordinate systems
   - Result: Models rotated 90°
   - Fix: Apply rotation transform

### Validation Heuristics

When loading external content, warn if:
- Bounding box larger than 1000 units (likely millimeter scale)
- Bounding box smaller than 0.01 units (likely normalized [-1,1])
- All geometry below Y=0 (likely wrong origin convention)

## Future Schema Extensions

### Proposed `units` Field

```json
{
  "name": "Humpback Whale",
  "units": "meters",
  "root": { ... }
}
```

Supported values:
- `"meters"` (default, can be omitted)
- `"centimeters"` → auto-scale by 0.01
- `"millimeters"` → auto-scale by 0.001
- `"normalized"` → scene fits in [-1, 1], apply contextual scaling

### Proposed `scale` Field

For explicit scaling without changing source data:

```json
{
  "name": "Imported Model",
  "units": "millimeters",
  "scale": 0.001,
  "root": { ... }
}
```

The loader would apply: `finalScale = unitScale * explicitScale`

## BVH and Spatial Optimization

Knowing the unit convention enables:

1. **Appropriate BVH granularity**: Split threshold ~0.1m for architectural scenes
2. **LOD distance bands**: Near (0-10m), medium (10-50m), far (50m+)
3. **Culling distances**: Skip objects smaller than 1 pixel at distance

## References

- [Inigo Quilez SDF Functions](https://iquilezles.org/articles/distfunctions/)
- [Unity Manual: Units](https://docs.unity3d.com/Manual/BestPracticeUnderstandingPerformanceInUnity.html)
- [Blender Units](https://docs.blender.org/manual/en/latest/scene_layout/scene/properties.html#units)

---

*This document is part of the Lucid SDF specification. See also: primitives-comparison.md, instanced-splats-spec.md*
